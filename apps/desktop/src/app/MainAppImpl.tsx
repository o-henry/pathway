import { type ReactNode, useEffect, useMemo, useRef, useState } from 'react';

import AppNav from '../components/AppNav';
import TasksPage from '../pages/tasks/TasksPage';
import SettingsPage from '../pages/settings/SettingsPage';
import { invoke, openPath, openUrl } from '../shared/tauri';
import {
  acceptRevisionPreview,
  analyzeGoal,
  createGoal,
  createRevisionPreview,
  createStateUpdate,
  deleteGoal,
  fetchCurrentState,
  fetchGoal,
  fetchGoalAnalysis,
  fetchGoalMaps,
  fetchGoals,
  fetchRevisionPreview,
  fetchRouteSelection,
  fetchStateUpdates,
  generatePathway,
  getAssumptionsForNode,
  getEvidenceForNode,
  rejectRevisionPreview,
  setLocalApiToken,
  updateGoal,
  updateRouteSelection
} from '../lib/api';
import PathwayRailCanvas, {
  buildTerminalGoalDisplayBundle,
} from './PathwayRailCanvas';
import {
  extractAuthMode,
  isEngineAlreadyStartedError,
  loadPersistedAuthMode,
  loadPersistedCodexMultiAgentMode,
  loadPersistedCwd,
  loadPersistedLoginCompleted,
} from './mainAppUtils';
import {
  buildResearchPlanCollectorJobs,
  type ResearchPlanCollectorJob,
} from './researchPlanCollectorJobs';
import type {
  CurrentStateSnapshot,
  EvidenceItem,
  GoalAnalysisRecord,
  GoalRecord,
  GraphBundle,
  GraphNodeRecord,
  LifeMap,
  RevisionProposalRecord,
  RouteSelectionRecord,
  StateUpdateRecord
} from '../lib/types';
import type { AuthProbeResult, LoginChatgptResult } from './main/types';

type WorkspaceTab = 'tasks' | 'workflow' | 'settings';
const WORKSPACE_TAB_SHORTCUTS: WorkspaceTab[] = ['tasks', 'workflow', 'settings'];
const SETTINGS_AUTH_REFRESH_COOLDOWN_MS = 60_000;
const SETTINGS_COLLECTOR_DOCTOR_REFRESH_COOLDOWN_MS = 5 * 60_000;
const SETTINGS_DEFERRED_REFRESH_DELAY_MS = 120;
const RESEARCH_COLLECTION_PARALLELISM = 4;
type PathwayAuthMode = 'chatgpt' | 'apikey' | 'unknown';

type CollectorDoctorState = 'checking' | 'ready' | 'error';

type CollectorDoctorStatus = {
  id: string;
  label: string;
  detail: string;
  state: CollectorDoctorState;
  message: string;
  installable?: boolean;
  installed?: boolean;
  configured?: boolean;
};

type CollectorHealthResult = {
  provider?: string;
  available?: boolean;
  ready?: boolean;
  configured?: boolean;
  installed?: boolean;
  installable?: boolean;
  message?: string;
  capabilities?: string[];
};

type CollectorInstallResult = {
  provider?: string;
  installed?: boolean;
  message?: string;
};

type CollectorFetchResult = {
  provider?: string;
  status?: string;
  url?: string;
  fetched_at?: string;
  summary?: string;
  content?: string;
  markdown_path?: string;
  json_path?: string;
  source_meta?: Record<string, unknown>;
  error?: string;
};

type CollectorJobAttemptResult =
  | { ok: true; provider: string; targetLabel: string }
  | { ok: false; error: string; targetLabel: string };

const COLLECTOR_DOCTOR_DEFINITIONS: ReadonlyArray<{
  id: string;
  label: string;
  detail: string;
}> = [
  { id: 'scrapling', label: 'Scrapling', detail: '허용된 HTML 파싱 fallback' },
  { id: 'crawl4ai', label: 'Crawl4AI', detail: 'LLM-ready 문서 추출' },
  { id: 'lightpanda_experimental', label: 'Lightpanda', detail: '가벼운 JS 렌더러' },
  { id: 'steel', label: 'Steel', detail: '외부 브라우저 세션 추출' },
  { id: 'playwright_local', label: 'Playwright Local', detail: '로컬 상호작용 브라우저' },
  { id: 'scrapy_playwright', label: 'Scrapy Playwright', detail: '배치 크롤링 오케스트레이션' },
  { id: 'browser_use', label: 'Browser Use', detail: '브라우저 자동화 provider' },
];

function formatFieldValue(value: unknown): string {
  if (value == null) {
    return '데이터 없음';
  }
  if (Array.isArray(value)) {
    return value.join(', ');
  }
  if (typeof value === 'object') {
    return JSON.stringify(value);
  }
  return String(value);
}

function cleanCollectorMessage(value: unknown): string {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function truncateCollectorMessage(value: string, maxLength = 220): string {
  const clean = cleanCollectorMessage(value);
  if (clean.length <= maxLength) {
    return clean;
  }
  return `${clean.slice(0, maxLength - 1)}…`;
}

function isMetadataOnlyEvidence(item: EvidenceItem): boolean {
  return item.reliability === 'public_url_metadata' || /metadata-only|candidate source/i.test(item.quote_or_summary);
}

function evidenceReliabilityLabel(item: EvidenceItem): string {
  if (isMetadataOnlyEvidence(item)) {
    return '후보 URL · 원문 미수집';
  }
  if (item.reliability === 'public_url_allowed') {
    return '원문 수집됨';
  }
  if (item.reliability === 'manual_note') {
    return '사용자/수동 노트';
  }
  return item.reliability;
}

function NavIcon({ tab }: { tab: WorkspaceTab; active?: boolean }) {
  if (tab === 'tasks') {
    return <img alt="" aria-hidden="true" className="nav-workflow-image" src="/scroll.svg" />;
  }
  if (tab === 'workflow') {
    return <img alt="" aria-hidden="true" className="nav-workflow-image" src="/node-svgrepo-com.svg" />;
  }
  if (tab === 'settings') {
    return <img alt="" aria-hidden="true" className="nav-workflow-image" src="/setting.svg" />;
  }
  return <img alt="" aria-hidden="true" className="nav-workflow-image" src="/scroll.svg" />;
}

function EmptyState({
  title,
  copy,
  action
}: {
  title: string;
  copy: string;
  action?: ReactNode;
}) {
  return (
    <section className="pathway-empty-state">
      <strong>{title}</strong>
      <p>{copy}</p>
      {action}
    </section>
  );
}

function mergePreviewBundle(baseBundle: GraphBundle, proposal: RevisionProposalRecord | null): GraphBundle {
  if (!proposal) {
    return baseBundle;
  }

  const proposedBundle = proposal.proposed_graph_bundle;
  const mergedNodeTypes = new Map(
    [...baseBundle.ontology.node_types, ...proposedBundle.ontology.node_types].map((item) => [item.id, item])
  );
  const mergedEdgeTypes = new Map(
    [...baseBundle.ontology.edge_types, ...proposedBundle.ontology.edge_types].map((item) => [item.id, item])
  );
  const mergedEvidence = new Map(
    [...baseBundle.evidence, ...proposedBundle.evidence].map((item) => [item.id, item])
  );
  const mergedAssumptions = new Map(
    [...baseBundle.assumptions, ...proposedBundle.assumptions].map((item) => [item.id, item])
  );
  const mergedNodes = new Map(proposedBundle.nodes.map((item) => [item.id, item]));
  const mergedEdges = new Map(proposedBundle.edges.map((item) => [item.id, item]));

  for (const change of proposal.diff.node_changes) {
    if (change.change_type !== 'removed') {
      continue;
    }
    const existingNode = baseBundle.nodes.find((item) => item.id === change.node_id);
    if (existingNode) {
      mergedNodes.set(existingNode.id, existingNode);
    }
  }

  for (const change of proposal.diff.edge_changes) {
    if (change.change_type !== 'removed') {
      continue;
    }
    const existingEdge = baseBundle.edges.find(
      (item) =>
        item.id === change.edge_id ||
        (item.source === change.source && item.target === change.target)
    );
    if (existingEdge) {
      mergedEdges.set(existingEdge.id, existingEdge);
    }
  }

  return {
    ...proposedBundle,
    ontology: {
      node_types: [...mergedNodeTypes.values()],
      edge_types: [...mergedEdgeTypes.values()]
    },
    nodes: [...mergedNodes.values()],
    edges: [...mergedEdges.values()],
    evidence: [...mergedEvidence.values()],
    assumptions: [...mergedAssumptions.values()]
  };
}

function findSelectedNode(
  bundle: GraphBundle | null,
  selectedNodeId: string | null
): GraphNodeRecord | null {
  if (!bundle || !selectedNodeId) {
    return null;
  }
  return bundle.nodes.find((node) => node.id === selectedNodeId) ?? null;
}

function getVisibleNodeFields(node: GraphNodeRecord): Array<[string, unknown]> {
  return Object.entries(node.data).filter(([key]) => !key.startsWith('__'));
}

function normalizeProgressMatchText(value: unknown): string {
  return String(value ?? '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenizeProgressText(value: string): string[] {
  return [...new Set(normalizeProgressMatchText(value).split(' ').filter((token) => token.length >= 2))];
}

function buildNodeSearchText(node: GraphNodeRecord): string {
  return normalizeProgressMatchText([
    node.label,
    node.summary,
    ...Object.values(node.data ?? {}).map((value) => {
      if (value == null) {
        return '';
      }
      if (typeof value === 'object') {
        return JSON.stringify(value);
      }
      return String(value);
    })
  ].join(' '));
}

function stateUpdateMatchesNode(update: StateUpdateRecord, node: GraphNodeRecord): boolean {
  if (normalizeProgressMatchText((node.data as Record<string, unknown>)?.pathway_display_role) === 'terminal_goal') {
    return false;
  }
  const updateText = normalizeProgressMatchText([
    update.progress_summary,
    update.blockers,
    update.next_adjustment,
    update.mood
  ].join(' '));
  if (!updateText) {
    return false;
  }
  const nodeText = buildNodeSearchText(node);
  const labelText = normalizeProgressMatchText(node.label);
  if (labelText && (updateText.includes(labelText) || labelText.includes(updateText))) {
    return true;
  }
  const updateTokens = tokenizeProgressText(updateText);
  if (updateTokens.length === 0) {
    return false;
  }
  const matchedTokenCount = updateTokens.filter((token) => nodeText.includes(token)).length;
  return matchedTokenCount >= Math.min(2, updateTokens.length);
}

function sortStateUpdatesNewestFirst(updates: StateUpdateRecord[]): StateUpdateRecord[] {
  return [...updates].sort((left, right) => {
    const leftTime = Date.parse(left.created_at ?? left.update_date) || Date.parse(left.update_date) || 0;
    const rightTime = Date.parse(right.created_at ?? right.update_date) || Date.parse(right.update_date) || 0;
    return rightTime - leftTime;
  });
}

function formatUiError(error: unknown, fallback: string): string {
  const message = error instanceof Error ? error.message : fallback;
  if (/authorization is required|unauthorized|401/i.test(message)) {
    return 'Pathway 로컬 API 인증 토큰이 맞지 않습니다. pnpm dev를 재시작하면 desktop shell이 API를 같은 토큰으로 다시 띄웁니다.';
  }
  if (/failed to fetch|networkerror|load failed/i.test(message)) {
    return 'Pathway 로컬 백엔드가 아직 준비되지 않았습니다. 잠시 후 자동 재시도하거나 pnpm dev의 api 서비스를 확인하세요.';
  }
  return message || fallback;
}

function isLocalApiTransientError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? '');
  return /failed to fetch|networkerror|load failed|Pathway local backend is not reachable/i.test(message);
}

function buildIntakeGoalTitle(input: string): string {
  const normalized = input.replace(/\s+/g, ' ').trim();
  if (!normalized) {
    return '새 Pathway 목표';
  }
  return normalized.length > 72 ? `${normalized.slice(0, 72).trim()}...` : normalized;
}

function buildIntakeSuccessCriteria(input: string): string {
  const normalized = input.replace(/\s+/g, ' ').trim();
  if (!normalized) {
    return '상담을 통해 성공 기준을 구체화한다.';
  }
  return normalized.length > 160 ? `${normalized.slice(0, 160).trim()}...` : normalized;
}

function isTauriUnavailableError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? '');
  return /tauri runtime unavailable|__tauri|tauri|ipc|invoke/i.test(message);
}

export default function MainApp() {
  const hasTauriRuntime =
    typeof window !== 'undefined' &&
    (
      typeof (window as typeof window & { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__ !== 'undefined' ||
      typeof (window as typeof window & { __TAURI__?: unknown }).__TAURI__ !== 'undefined' ||
      /tauri/i.test(window.navigator.userAgent)
    );
  const [workspaceTab, setWorkspaceTab] = useState<WorkspaceTab>('tasks');
  const [showWorkflowInspector, setShowWorkflowInspector] = useState(false);
  const [workflowCanvasFullscreen, setWorkflowCanvasFullscreen] = useState(false);
  const [goals, setGoals] = useState<GoalRecord[]>([]);
  const [activeGoalId, setActiveGoalId] = useState<string | null>(null);
  const [activeGoal, setActiveGoal] = useState<GoalRecord | null>(null);
  const [pathwayNewGoalMode, setPathwayNewGoalMode] = useState(false);
  const [goalAnalysis, setGoalAnalysis] = useState<GoalAnalysisRecord | null>(null);
  const [goalAnalysisError, setGoalAnalysisError] = useState<{ goalId: string; message: string } | null>(null);
  const [, setMaps] = useState<LifeMap[]>([]);
  const [activeMapId, setActiveMapId] = useState<string | null>(null);
  const [activeMap, setActiveMap] = useState<LifeMap | null>(null);
  const [currentState, setCurrentState] = useState<CurrentStateSnapshot | null>(null);
  const [stateUpdates, setStateUpdates] = useState<StateUpdateRecord[]>([]);
  const [routeSelection, setRouteSelection] = useState<RouteSelectionRecord | null>(null);
  const [revisionPreview, setRevisionPreview] = useState<RevisionProposalRecord | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [statusMessage, setStatusMessage] = useState('Pathway 로컬 작업공간이 준비되었습니다. 목표를 만들고, 자원을 분석한 뒤, 그래프를 확장하세요.');
  const [isBusy, setIsBusy] = useState(false);
  const [engineStarted, setEngineStarted] = useState(false);
  const [cwd, setCwd] = useState(() => loadPersistedCwd('.'));
  const [loginCompleted, setLoginCompleted] = useState(() => loadPersistedLoginCompleted());
  const [authMode, setAuthMode] = useState<PathwayAuthMode>(() => loadPersistedAuthMode());
  const [codexAuthBusy, setCodexAuthBusy] = useState(false);
  const [codexMultiAgentMode] = useState(() => loadPersistedCodexMultiAgentMode());
  const [usageInfoText, setUsageInfoText] = useState('');
  const [usageResultClosed, setUsageResultClosed] = useState(false);
  const [collectorDoctorStatuses, setCollectorDoctorStatuses] = useState<CollectorDoctorStatus[]>(
    COLLECTOR_DOCTOR_DEFINITIONS.map((collector) => ({
      ...collector,
      state: 'checking',
      message: '상태 확인 전',
    })),
  );
  const [collectorDoctorPending, setCollectorDoctorPending] = useState(false);
  const [collectorInstallPendingId, setCollectorInstallPendingId] = useState<string | null>(null);
  const authStateLastCheckedAtRef = useRef(0);
  const collectorDoctorLastCheckedAtRef = useRef(0);
  const collectorDoctorInFlightRef = useRef(false);
  const collectorReadyPromisesRef = useRef<Map<string, Promise<void>>>(new Map());
  const pathwayWorkCancelledRef = useRef(false);
  const [, setResearchPlanCollecting] = useState(false);
  const [researchPlanCollectionStatus, setResearchPlanCollectionStatus] = useState('');

  const [stateForm, setStateForm] = useState({
    progress_summary: '',
    blockers: '',
    next_adjustment: '',
    actual_time_spent: '',
    actual_money_spent: '',
    mood: ''
  });

  const activeBundle = activeMap?.graph_bundle ?? null;
  const visibleBundle = activeBundle && revisionPreview
    ? mergePreviewBundle(activeBundle, revisionPreview)
    : activeBundle;
  const displayBundle = useMemo(
    () => (visibleBundle ? buildTerminalGoalDisplayBundle(visibleBundle, activeGoal?.title) : undefined),
    [activeGoal?.title, visibleBundle],
  );
  const displayBaseBundle = useMemo(
    () => (activeBundle ? buildTerminalGoalDisplayBundle(activeBundle, activeGoal?.title) : undefined),
    [activeBundle, activeGoal?.title],
  );
  const researchPlanCollectorJobs = useMemo(
    () => buildResearchPlanCollectorJobs(goalAnalysis),
    [goalAnalysis],
  );
  const effectiveSelectedNodeId =
    selectedNodeId ?? (activeBundle ? routeSelection?.selected_node_id ?? null : null);
  const selectedNode = displayBundle ? findSelectedNode(displayBundle, effectiveSelectedNodeId) : null;
  const selectedNodeVisibleFields = selectedNode ? getVisibleNodeFields(selectedNode) : [];
  const selectedEvidence = selectedNode && displayBundle ? getEvidenceForNode(displayBundle, selectedNode.id) : [];
  const selectedMetadataEvidence = selectedEvidence.filter(isMetadataOnlyEvidence);
  const selectedContentEvidence = selectedEvidence.filter((item) => !isMetadataOnlyEvidence(item));
  const selectedAssumptions = selectedNode && displayBundle ? getAssumptionsForNode(displayBundle, selectedNode.id) : [];
  const selectedNodePreviewChange =
    selectedNode && revisionPreview
      ? revisionPreview.diff.node_changes.find((item) => item.node_id === selectedNode.id) ?? null
      : null;
  const persistedProgressUpdates = useMemo(
    () => sortStateUpdatesNewestFirst(stateUpdates),
    [stateUpdates],
  );
  const latestProgressUpdate = persistedProgressUpdates[0] ?? null;
  const activeProgressNodeIds = useMemo(() => {
    if (!displayBundle || !latestProgressUpdate) {
      return new Set<string>();
    }
    return new Set(
      displayBundle.nodes
        .filter((node) => stateUpdateMatchesNode(latestProgressUpdate, node))
        .map((node) => node.id),
    );
  }, [displayBundle, latestProgressUpdate]);
  const progressUpdateSummaries = useMemo(
    () =>
      persistedProgressUpdates.slice(0, 8).map((update) => {
        const matchedNodes = displayBundle?.nodes.filter((node) => stateUpdateMatchesNode(update, node)) ?? [];
        return {
          update,
          matchedNodes: matchedNodes.slice(0, 3),
        };
      }),
    [displayBundle, persistedProgressUpdates],
  );
  function authModeLabel(mode: PathwayAuthMode): string {
    if (mode === 'chatgpt') {
      return 'ChatGPT';
    }
    if (mode === 'apikey') {
      return 'API Key';
    }
    return '알 수 없음';
  }

  async function ensureEngineStarted() {
    try {
      await invoke('engine_start', { cwd });
      await refreshLocalApiTokenFromShell();
      setEngineStarted(true);
    } catch (error) {
      if (isEngineAlreadyStartedError(error)) {
        setEngineStarted(true);
        return;
      }
      throw error;
    }
  }

  function setCollectorDoctorPreviewFallback(message = 'Tauri 앱에서 확인할 수 있습니다.') {
    setCollectorDoctorStatuses(
      COLLECTOR_DOCTOR_DEFINITIONS.map((collector) => ({
        ...collector,
        state: 'checking',
        message,
        installable: false,
        installed: false,
        configured: false,
      })),
    );
  }

  async function refreshLocalApiTokenFromShell() {
    if (!hasTauriRuntime) {
      return;
    }
    if (String(import.meta.env.VITE_PATHWAY_LOCAL_API_TOKEN ?? '').trim()) {
      return;
    }
    try {
      const token = await invoke<string>('local_api_auth_token');
      setLocalApiToken(token);
    } catch {
      // Older dev shells may not expose the token command; unauthenticated dev API still works.
    }
  }

  async function refreshAuthStateFromEngine(showStatus = false): Promise<AuthProbeResult | null> {
    try {
      await ensureEngineStarted();
      const result = await invoke<AuthProbeResult>('auth_probe');
      const nextMode = extractAuthMode(result.authMode ?? result.raw ?? null) ?? 'unknown';
      setAuthMode(nextMode);
      if (result.state === 'authenticated') {
        setLoginCompleted(true);
        if (showStatus) {
          setStatusMessage('CODEX 로그인이 연결되어 있습니다.');
        }
      } else if (result.state === 'login_required') {
        setLoginCompleted(false);
        if (showStatus) {
          setStatusMessage('CODEX 로그인이 필요합니다. 설정에서 로그인 후 다시 실행하세요.');
        }
      } else if (showStatus) {
        setStatusMessage('CODEX 인증 상태를 확인했습니다.');
      }
      authStateLastCheckedAtRef.current = Date.now();
      return result;
    } catch (error) {
      if (showStatus) {
        setErrorMessage(formatUiError(error, 'CODEX 인증 상태를 확인하지 못했습니다.'));
      }
      return null;
    }
  }

  async function refreshGoals(preserveSelection = true) {
    try {
      await ensureEngineStarted();
    } catch (error) {
      if (!isTauriUnavailableError(error)) {
        throw error;
      }
      await refreshLocalApiTokenFromShell();
    }
    const nextGoals = await fetchGoals();
    setGoals(nextGoals);
    if (nextGoals.length === 0) {
      setPathwayNewGoalMode(false);
      setActiveGoalId(null);
      setActiveGoal(null);
      setGoalAnalysis(null);
      setActiveMap(null);
      setActiveMapId(null);
      setCurrentState(null);
      setStateUpdates([]);
      setRouteSelection(null);
      setRevisionPreview(null);
      return null;
    }

    if (preserveSelection && pathwayNewGoalMode) {
      setActiveGoalId(null);
      return null;
    }

    const preferredGoalId =
      preserveSelection && activeGoalId && nextGoals.some((goal) => goal.id === activeGoalId)
        ? activeGoalId
        : nextGoals[0]?.id;
    setActiveGoalId(preferredGoalId ?? null);
    return preferredGoalId ?? null;
  }

  async function syncPathwayWorkspace(preserveSelection = true) {
    const nextGoalId = await refreshGoals(preserveSelection);
    if (!nextGoalId) {
      return;
    }
    const preferredMapId =
      preserveSelection && activeGoalId === nextGoalId
        ? activeMapId
        : null;
    await refreshGoalWorkspace(nextGoalId, preferredMapId);
  }

  async function refreshGoalWorkspace(goalId: string, preferredMapId?: string | null) {
    setRevisionPreview(null);
    setWorkflowCanvasFullscreen(false);
    const goal = goals.find((item) => item.id === goalId) ?? (await fetchGoals()).find((item) => item.id === goalId) ?? null;
    setActiveGoal(goal);

    const [rawMaps, nextUpdates, nextCurrentState, existingAnalysis] = await Promise.all([
      fetchGoalMaps(goalId),
      fetchStateUpdates(goalId),
      fetchCurrentState(goalId),
      fetchGoalAnalysis(goalId),
    ]);
    const nextMaps = [...rawMaps].sort((left, right) => {
      const leftTime = Date.parse(left.updated_at ?? left.created_at ?? '') || 0;
      const rightTime = Date.parse(right.updated_at ?? right.created_at ?? '') || 0;
      return rightTime - leftTime;
    });

    setMaps(nextMaps);
    setStateUpdates(nextUpdates);
    setCurrentState(nextCurrentState);
    if (existingAnalysis) {
      setGoalAnalysis(existingAnalysis);
      setGoalAnalysisError(null);
    } else if (goalAnalysis?.goal_id === goalId) {
      setGoalAnalysis(null);
    }

    const chosenMap =
      (preferredMapId ? nextMaps.find((item) => item.id === preferredMapId) : null) ??
      nextMaps[0] ??
      null;
    setActiveMap(chosenMap);
    setActiveMapId(chosenMap?.id ?? null);
    setSelectedNodeId(null);
    setShowWorkflowInspector(false);

    if (chosenMap) {
      const nextRouteSelection = await fetchRouteSelection(chosenMap.id);
      setRouteSelection(nextRouteSelection);
    } else {
      setRouteSelection(null);
    }
  }

  async function handleSelectPathwayGoal(goalId: string | null) {
    setPathwayNewGoalMode(!goalId);
    setActiveGoalId(goalId);
    setErrorMessage('');
    setGoalAnalysis(null);
    setGoalAnalysisError(null);

    if (!goalId) {
      setActiveGoal(null);
      setGoalAnalysisError(null);
      setActiveMap(null);
      setActiveMapId(null);
      setCurrentState(null);
      setStateUpdates([]);
      setRouteSelection(null);
      setRevisionPreview(null);
      setSelectedNodeId(null);
      setShowWorkflowInspector(false);
      return;
    }

    setPathwayNewGoalMode(false);
    const nextGoal = goals.find((item) => item.id === goalId) ?? null;
    setActiveGoal(nextGoal);
    await refreshGoalWorkspace(goalId);
    try {
      setIsBusy(true);
      if (hasTauriRuntime) {
        await ensureEngineStarted();
      }
      const analysis = await analyzeGoal(goalId);
      setGoalAnalysis(analysis);
      setGoalAnalysisError(null);
      setStatusMessage('선택한 목표의 확인 질문을 갱신했습니다.');
    } catch (error) {
      const message = formatUiError(error, '선택한 목표의 확인 질문을 생성하지 못했습니다.');
      setErrorMessage(message);
      setGoalAnalysisError({ goalId, message });
    } finally {
      setIsBusy(false);
    }
  }

  async function handleDeletePathwayGoal(goalId: string) {
    try {
      setErrorMessage('');
      await deleteGoal(goalId);
      const deletedActiveGoal = activeGoalId === goalId;
      if (deletedActiveGoal) {
        setActiveGoalId(null);
        setActiveGoal(null);
        setGoalAnalysis(null);
        setGoalAnalysisError(null);
        setActiveMap(null);
        setActiveMapId(null);
        setCurrentState(null);
        setStateUpdates([]);
        setRouteSelection(null);
        setRevisionPreview(null);
        setSelectedNodeId(null);
        setShowWorkflowInspector(false);
      }
      await syncPathwayWorkspace(!deletedActiveGoal);
    } catch (error) {
      setErrorMessage(formatUiError(error, '목표를 삭제하지 못했습니다.'));
    }
  }

  useEffect(() => {
    void (async () => {
      try {
        await syncPathwayWorkspace(false);
      } catch (error) {
        setErrorMessage(formatUiError(error, '목표를 불러오지 못했습니다.'));
      }
    })();
  }, []);

  useEffect(() => {
    if (!activeGoalId) {
      return;
    }
    void (async () => {
      try {
        setErrorMessage('');
        await refreshGoalWorkspace(activeGoalId, activeMapId);
      } catch (error) {
        setErrorMessage(formatUiError(error, '목표 작업공간을 불러오지 못했습니다.'));
      }
    })();
  }, [activeGoalId]);

  useEffect(() => {
    if (workspaceTab !== 'tasks' && workspaceTab !== 'workflow') {
      return;
    }
    void (async () => {
      try {
        setErrorMessage('');
        await syncPathwayWorkspace(true);
      } catch (error) {
        setErrorMessage(formatUiError(error, '목표 작업공간을 새로고침하지 못했습니다.'));
      }
    })();
  }, [workspaceTab]);

  useEffect(() => {
    const syncIfPathwayVisible = () => {
      if (document.visibilityState !== 'visible') {
        return;
      }
      if (workspaceTab !== 'tasks' && workspaceTab !== 'workflow') {
        return;
      }
      void (async () => {
        try {
          setErrorMessage('');
          await syncPathwayWorkspace(true);
        } catch (error) {
          setErrorMessage(formatUiError(error, '목표 작업공간을 새로고침하지 못했습니다.'));
        }
      })();
    };

    window.addEventListener('focus', syncIfPathwayVisible);
    document.addEventListener('visibilitychange', syncIfPathwayVisible);
    return () => {
      window.removeEventListener('focus', syncIfPathwayVisible);
      document.removeEventListener('visibilitychange', syncIfPathwayVisible);
    };
  }, [workspaceTab, activeGoalId, activeMapId, goals, pathwayNewGoalMode]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!event.metaKey || event.ctrlKey || event.altKey) {
        return;
      }

      const target = event.target as HTMLElement | null;
      const tagName = target?.tagName ?? '';
      const isTypingContext =
        tagName === 'INPUT' ||
        tagName === 'TEXTAREA' ||
        tagName === 'SELECT' ||
        target?.isContentEditable;
      if (isTypingContext) {
        return;
      }

      const index = Number(event.key) - 1;
      if (index >= 0 && index < WORKSPACE_TAB_SHORTCUTS.length) {
        event.preventDefault();
        setWorkspaceTab(WORKSPACE_TAB_SHORTCUTS[index] as WorkspaceTab);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem('rail.settings.cwd', cwd);
    } catch {
      // noop
    }
  }, [cwd]);

  useEffect(() => {
    try {
      window.localStorage.setItem('rail.settings.login_completed', loginCompleted ? '1' : '0');
    } catch {
      // noop
    }
  }, [loginCompleted]);

  useEffect(() => {
    try {
      window.localStorage.setItem('rail.settings.auth_mode', authMode);
    } catch {
      // noop
    }
  }, [authMode]);

  useEffect(() => {
    try {
      window.localStorage.setItem('rail.settings.codex_multi_agent_mode', codexMultiAgentMode);
    } catch {
      // noop
    }
  }, [codexMultiAgentMode]);

  useEffect(() => {
    setResearchPlanCollectionStatus('');
  }, [goalAnalysis?.goal_id]);

  useEffect(() => {
    if (workspaceTab !== 'settings') {
      return;
    }
    if (!hasTauriRuntime) {
      setStatusMessage('브라우저 프리뷰에서는 일부 설정 연결이 제한될 수 있습니다. 가능하면 Tauri 앱에서 확인하세요.');
    }
    const refreshTimer = window.setTimeout(() => {
      const now = Date.now();
      if (now - authStateLastCheckedAtRef.current >= SETTINGS_AUTH_REFRESH_COOLDOWN_MS) {
        void refreshAuthStateFromEngine(true);
      }
      if (now - collectorDoctorLastCheckedAtRef.current >= SETTINGS_COLLECTOR_DOCTOR_REFRESH_COOLDOWN_MS) {
        void refreshCollectorDoctor();
      }
    }, SETTINGS_DEFERRED_REFRESH_DELAY_MS);
    return () => {
      window.clearTimeout(refreshTimer);
    };
  }, [hasTauriRuntime, workspaceTab]);

  async function refreshCollectorDoctor() {
    if (collectorDoctorInFlightRef.current) {
      return;
    }
    collectorDoctorInFlightRef.current = true;
    setCollectorDoctorPending(true);
    try {
      if (!hasTauriRuntime) {
        setCollectorDoctorPreviewFallback('브라우저 프리뷰에서는 수집기 상태를 확인할 수 없습니다. Tauri 앱에서 다시 확인하세요.');
        return;
      }
      await ensureEngineStarted();
      const results = await Promise.all(
        COLLECTOR_DOCTOR_DEFINITIONS.map(async (collector) => {
          try {
            const health = await invoke<CollectorHealthResult>('dashboard_crawl_provider_health', {
              cwd,
              provider: collector.id,
            });
            const ready = Boolean(health?.ready);
            const message = String(health?.message ?? '').trim();
            let fallback = '작동 가능';
            if (!ready) {
              if (health?.available === false) {
                fallback = '현재 환경에서 사용할 수 없습니다.';
              } else if (health?.configured === false) {
                fallback = '설정이 필요합니다.';
              } else if (health?.installed === false) {
                fallback = '설치가 필요합니다.';
              } else {
                fallback = '현재 작동할 수 없습니다.';
              }
            }
            return {
              ...collector,
              state: ready ? 'ready' : 'error',
              message: message || fallback,
              installable: Boolean(health?.installable),
              installed: Boolean(health?.installed),
              configured: Boolean(health?.configured),
            } satisfies CollectorDoctorStatus;
          } catch (error) {
            if (isTauriUnavailableError(error)) {
              return {
                ...collector,
                state: 'checking',
                message: 'Tauri 앱에서 확인할 수 있습니다.',
                installable: false,
                installed: false,
                configured: false,
              } satisfies CollectorDoctorStatus;
            }
            return {
              ...collector,
              state: 'error',
              message: formatUiError(error, '상태 확인 실패'),
              installable: false,
              installed: false,
              configured: false,
            } satisfies CollectorDoctorStatus;
          }
        }),
      );
      setCollectorDoctorStatuses(results);
      collectorDoctorLastCheckedAtRef.current = Date.now();
    } catch (error) {
      if (isTauriUnavailableError(error)) {
        setCollectorDoctorPreviewFallback('브라우저 프리뷰에서는 수집기 상태를 확인할 수 없습니다. Tauri 앱에서 다시 확인하세요.');
      } else {
        setCollectorDoctorStatuses(
          COLLECTOR_DOCTOR_DEFINITIONS.map((collector) => ({
            ...collector,
            state: 'error',
            message: formatUiError(error, '상태 확인 실패'),
            installable: false,
            installed: false,
            configured: false,
          })),
        );
      }
    } finally {
      collectorDoctorInFlightRef.current = false;
      setCollectorDoctorPending(false);
    }
  }

  async function handleInstallCollector(providerId: string) {
    setCollectorInstallPendingId(providerId);
    setStatusMessage(`${providerId} 설치를 시작합니다...`);
    try {
      await ensureEngineStarted();
      const result = await invoke<CollectorInstallResult>('dashboard_crawl_provider_install', {
        cwd,
        provider: providerId,
      });
      const installMessage = String(result?.message ?? '').trim();
      setStatusMessage(installMessage || `${providerId} 설치를 마쳤습니다.`);
      await refreshCollectorDoctor();
    } catch (error) {
      if (isTauriUnavailableError(error)) {
        setStatusMessage('수집기 설치는 Tauri 앱에서만 실행할 수 있습니다.');
        setCollectorDoctorPreviewFallback('브라우저 프리뷰에서는 설치를 실행할 수 없습니다. Tauri 앱에서 다시 시도하세요.');
      } else {
        setStatusMessage(formatUiError(error, `${providerId} 설치 실패`));
      }
      await refreshCollectorDoctor();
    } finally {
      setCollectorInstallPendingId(null);
    }
  }

  async function prepareCollectorForJob(providerId: string): Promise<void> {
    const health = await invoke<CollectorHealthResult>('dashboard_crawl_provider_health', {
      cwd,
      provider: providerId,
    });
    if (health?.ready) {
      return;
    }
    if (health?.installable) {
      const initialMessage = String(health?.message ?? '').trim();
      setResearchPlanCollectionStatus(
        `${providerId} 수집기가 아직 준비되지 않아 자동 설치/준비를 시도합니다.${initialMessage ? ` · ${initialMessage}` : ''}`,
      );
      await invoke<CollectorInstallResult>('dashboard_crawl_provider_install', {
        cwd,
        provider: providerId,
      });
      const recheckedHealth = await invoke<CollectorHealthResult>('dashboard_crawl_provider_health', {
        cwd,
        provider: providerId,
      });
      if (recheckedHealth?.ready) {
        return;
      }
      const recheckedMessage =
        String(recheckedHealth?.message ?? '').trim() || `${providerId} 수집기 자동 설치 후에도 준비되지 않았습니다.`;
      throw new Error(`${providerId}: ${recheckedMessage}`);
    }
    const message = String(health?.message ?? '').trim() || `${providerId} 수집기가 준비되지 않았습니다.`;
    throw new Error(`${providerId}: ${message}`);
  }

  async function ensureCollectorReadyForJob(providerId: string): Promise<void> {
    const cached = collectorReadyPromisesRef.current.get(providerId);
    if (cached) {
      return cached;
    }

    const promise = prepareCollectorForJob(providerId).catch((error) => {
      collectorReadyPromisesRef.current.delete(providerId);
      throw error;
    });
    collectorReadyPromisesRef.current.set(providerId, promise);
    return promise;
  }

  async function runResearchPlanCollectorJob(job: ResearchPlanCollectorJob, provider: string): Promise<CollectorFetchResult> {
    await ensureCollectorReadyForJob(provider);
    return invoke<CollectorFetchResult>('dashboard_crawl_provider_fetch_url', {
      cwd,
      provider,
      url: job.url,
      topic: job.topic,
    });
  }

  async function runResearchPlanCollectorJobWithFallbacks(job: ResearchPlanCollectorJob): Promise<CollectorJobAttemptResult> {
    const providers = job.providerCandidates.length > 0 ? job.providerCandidates : [job.provider];
    const errors: string[] = [];

    for (const provider of providers) {
      try {
        const result = await runResearchPlanCollectorJob(job, provider);
        const ok = String(result?.status ?? '').toLowerCase() === 'ok';
        const sourceError = cleanCollectorMessage(result?.source_meta?.source_library_error);
        if (ok && !sourceError) {
          return { ok: true, provider, targetLabel: job.targetLabel };
        }
        const resultError = cleanCollectorMessage(result?.error || sourceError || result?.status || 'fetch failed');
        errors.push(`${provider}: ${resultError}`);
      } catch (error) {
        errors.push(`${provider}: ${formatUiError(error, '실패')}`);
      }
    }

    return {
      ok: false,
      targetLabel: job.targetLabel,
      error: truncateCollectorMessage(errors.join(' / '), 360),
    };
  }

  async function collectResearchPlanTargetsForGraph(triggerLabel: string, jobs = researchPlanCollectorJobs) {
    if (jobs.length === 0) {
      const message = '조사할 수집 타깃이 아직 없습니다. 그래프를 만들기 전에 목표 분석의 research plan부터 다시 생성해야 합니다.';
      setResearchPlanCollectionStatus(message);
      throw new Error(message);
    }

    setResearchPlanCollecting(true);
    setErrorMessage('');
    let successCount = 0;
    let failureCount = 0;
    const failureReasons: string[] = [];
    try {
      await ensureEngineStarted();
      const results: CollectorJobAttemptResult[] = [];
      let nextJobIndex = 0;
      let completedCount = 0;
      const workerCount = Math.min(RESEARCH_COLLECTION_PARALLELISM, jobs.length);

      const runWorker = async () => {
        while (nextJobIndex < jobs.length) {
          const index = nextJobIndex;
          nextJobIndex += 1;
          const job = jobs[index]!;
          const providers = job.providerCandidates.length > 0 ? job.providerCandidates : [job.provider];
          setResearchPlanCollectionStatus(
            `${triggerLabel} 전 자동 수집 병렬 실행 중 · 시작 ${index + 1}/${jobs.length} · ${job.targetLabel} · ${providers.join(' → ')}`,
          );
          const result = await runResearchPlanCollectorJobWithFallbacks(job);
          results[index] = result;
          completedCount += 1;
          setResearchPlanCollectionStatus(
            `${triggerLabel} 전 자동 수집 병렬 실행 중 · 완료 ${completedCount}/${jobs.length} · 최근 완료: ${job.targetLabel}`,
          );
        }
      };

      await Promise.all(Array.from({ length: workerCount }, () => runWorker()));

      for (const result of results) {
        if (!result) {
          continue;
        }
        if (result.ok) {
          successCount += 1;
        } else {
          failureCount += 1;
          failureReasons.push(`${result.targetLabel}: ${result.error}`);
        }
      }
      setResearchPlanCollectionStatus(
        `자동 수집 완료 · source library 적재 성공 ${successCount}건 / 실패 ${failureCount}건`,
      );
      if (successCount === 0) {
        const reasonSummary = failureReasons.slice(0, 3).join(' / ');
        throw new Error(
          `자동 수집이 완료되지 않아 ${triggerLabel}을 중단했습니다. 성공 0건 / 실패 ${failureCount}건. ${reasonSummary}`,
        );
      }
      if (failureReasons.length > 0) {
        setResearchPlanCollectionStatus(
          `자동 수집 완료 · source library 적재 성공 ${successCount}건 / 실패 ${failureCount}건 · 일부 실패: ${failureReasons
            .slice(0, 2)
            .join(' / ')}`,
        );
      }
      setStatusMessage(`자동 수집을 완료했습니다. 수집된 자료를 바탕으로 ${triggerLabel}을 계속합니다.`);
    } catch (error) {
      if (isTauriUnavailableError(error)) {
        setResearchPlanCollectionStatus('자동 수집은 Tauri 앱에서만 실행할 수 있습니다.');
      } else {
        setResearchPlanCollectionStatus(formatUiError(error, '자동 수집 준비 실패'));
      }
      throw error;
    } finally {
      setResearchPlanCollecting(false);
    }
  }

  async function handleAnalyzeGoal() {
    if (!activeGoalId) {
      return;
    }
    try {
      setIsBusy(true);
      setErrorMessage('');
      setGoalAnalysisError(null);
      if (hasTauriRuntime) {
        await ensureEngineStarted();
      }
      const analysis = await analyzeGoal(activeGoalId);
      setGoalAnalysis(analysis);
      setStatusMessage('목표 분석이 갱신되었습니다. 필요한 자원 축과 조사 입력이 업데이트되었습니다.');
    } catch (error) {
      const message = formatUiError(error, '목표 분석에 실패했습니다.');
      setErrorMessage(message);
      setGoalAnalysisError({ goalId: activeGoalId, message });
    } finally {
      setIsBusy(false);
    }
  }

  async function analyzeGoalInBackground(goalId: string) {
    try {
      if (hasTauriRuntime) {
        await ensureEngineStarted();
      }
      const analysis = await analyzeGoal(goalId);
      if (pathwayWorkCancelledRef.current) {
        return;
      }
      setGoalAnalysis(analysis);
      setGoalAnalysisError(null);
      setStatusMessage('목표 분석이 백그라운드에서 갱신되었습니다.');
    } catch (error) {
      if (pathwayWorkCancelledRef.current) {
        return;
      }
      if (isLocalApiTransientError(error)) {
        setStatusMessage('목표 분석은 백그라운드에서 대기 중입니다. 로컬 API가 준비되면 다시 이어집니다.');
        return;
      }
      const message = formatUiError(error, '백그라운드 목표 분석에 실패했습니다.');
      setGoalAnalysisError({ goalId, message });
      setStatusMessage(message);
    }
  }

  async function handleStartPathwayIntake(goalText: string) {
    const normalizedGoal = goalText.trim();
    if (!normalizedGoal) {
      throw new Error('목표를 먼저 입력해 주세요.');
    }
    pathwayWorkCancelledRef.current = false;
    let createdGoalId: string | null = null;
    try {
      setIsBusy(true);
      setErrorMessage('');
      setGoalAnalysisError(null);
      if (hasTauriRuntime) {
        await ensureEngineStarted();
      }
      const goal = await createGoal({
        title: buildIntakeGoalTitle(normalizedGoal),
        description: normalizedGoal,
        category: 'general',
        success_criteria: buildIntakeSuccessCriteria(normalizedGoal),
      });
      if (pathwayWorkCancelledRef.current) {
        await deleteGoal(goal.id);
        throw new Error('Pathway 작업이 중단되었습니다.');
      }
      createdGoalId = goal.id;
      setPathwayNewGoalMode(false);
      setGoals((current) => [goal, ...current.filter((item) => item.id !== goal.id)]);
      setActiveGoalId(goal.id);
      setActiveGoal(goal);
      setActiveMap(null);
      setActiveMapId(null);
      setCurrentState(null);
      setStateUpdates([]);
      setRouteSelection(null);
      setRevisionPreview(null);
      setGoalAnalysis(null);
      setGoalAnalysisError(null);
      setStatusMessage('목표를 만들었습니다. 무거운 목표 분석은 백그라운드에서 이어갑니다.');
      void analyzeGoalInBackground(goal.id);
      return { goal, analysis: null };
    } catch (error) {
      const message = formatUiError(error, '목표 상담을 시작하지 못했습니다.');
      setErrorMessage(message);
      if (createdGoalId) {
        setGoalAnalysisError({ goalId: createdGoalId, message });
      }
      throw new Error(message);
    } finally {
      setIsBusy(false);
    }
  }

  async function handleGeneratePathwayFromIntake(goalId: string, answers: string[]) {
    if (!goalId) {
      throw new Error('그래프를 만들 목표가 없습니다.');
    }
    pathwayWorkCancelledRef.current = false;
    try {
      setIsBusy(true);
      setErrorMessage('');
      if (hasTauriRuntime) {
        await ensureEngineStarted();
      }
      const answerBlock = answers.map((answer, index) => `${index + 1}. ${answer.trim()}`).filter(Boolean).join('\n');
      const goal = await fetchGoal(goalId);
      if (pathwayWorkCancelledRef.current) {
        throw new Error('Pathway 작업이 중단되었습니다.');
      }
      if (answerBlock) {
        const nextDescription = [
          goal?.description?.trim() || '',
          '[Pathway intake answers]',
          answerBlock,
        ].filter(Boolean).join('\n\n');
        const updatedGoal = await updateGoal(goalId, {
          description: nextDescription,
          success_criteria: goal?.success_criteria || buildIntakeSuccessCriteria(answerBlock),
        });
        if (pathwayWorkCancelledRef.current) {
          throw new Error('Pathway 작업이 중단되었습니다.');
        }
        setGoals((current) => current.map((item) => (item.id === updatedGoal.id ? updatedGoal : item)));
        setActiveGoalId(updatedGoal.id);
        setActiveGoal(updatedGoal);
      }
      const analysisForCollection =
        goalAnalysis?.goal_id === goalId && goalAnalysis.research_plan
          ? goalAnalysis
          : await analyzeGoal(goalId);
      if (pathwayWorkCancelledRef.current) {
        throw new Error('Pathway 작업이 중단되었습니다.');
      }
      setGoalAnalysis(analysisForCollection);
      setGoalAnalysisError(null);
      await collectResearchPlanTargetsForGraph('그래프 생성', buildResearchPlanCollectorJobs(analysisForCollection));
      if (pathwayWorkCancelledRef.current) {
        throw new Error('Pathway 작업이 중단되었습니다.');
      }
      const nextMap = await generatePathway(goalId);
      if (pathwayWorkCancelledRef.current) {
        throw new Error('Pathway 작업이 중단되었습니다.');
      }
      setStatusMessage('상담 내용을 반영해 새 경로 그래프를 생성했습니다.');
      await refreshGoalWorkspace(goalId, nextMap.id);
      setWorkspaceTab('workflow');
    } catch (error) {
      const message = formatUiError(error, 'Pathway 그래프 생성에 실패했습니다.');
      setErrorMessage(message);
      throw new Error(message);
    } finally {
      setIsBusy(false);
    }
  }

  async function handleGeneratePathway() {
    if (!activeGoalId) {
      return;
    }
    pathwayWorkCancelledRef.current = false;
    try {
      setIsBusy(true);
      setErrorMessage('');
      if (hasTauriRuntime) {
        await ensureEngineStarted();
      }
      await collectResearchPlanTargetsForGraph('그래프 생성');
      if (pathwayWorkCancelledRef.current) {
        throw new Error('Pathway 작업이 중단되었습니다.');
      }
      const nextMap = await generatePathway(activeGoalId);
      if (pathwayWorkCancelledRef.current) {
        throw new Error('Pathway 작업이 중단되었습니다.');
      }
      setStatusMessage('새 경로 그래프를 생성했고 워크플로우 화면에 반영했습니다.');
      await refreshGoalWorkspace(activeGoalId, nextMap.id);
      setWorkspaceTab('workflow');
    } catch (error) {
      setErrorMessage(formatUiError(error, 'Pathway 그래프 생성에 실패했습니다.'));
    } finally {
      setIsBusy(false);
    }
  }

  async function handleCancelPathwayWork() {
    pathwayWorkCancelledRef.current = true;
    setIsBusy(false);
    setResearchPlanCollecting(false);
    setStatusMessage('Pathway 작업을 중단했습니다.');
  }

  async function handleSelectNode(nodeId: string) {
    setSelectedNodeId(nodeId);
    setShowWorkflowInspector(true);
    if (revisionPreview) {
      return;
    }
    if (!activeMap) {
      setStatusMessage('활성 그래프가 없습니다. 목표를 선택하고 루트를 생성해 주세요.');
      return;
    }
    try {
      const selection = await updateRouteSelection(activeMap.id, {
        selected_node_id: nodeId,
        rationale: ''
      });
      setRouteSelection(selection);
      setStatusMessage('그래프에서 현재 루트를 선택했습니다.');
    } catch (error) {
      setErrorMessage(formatUiError(error, '루트 선택 업데이트에 실패했습니다.'));
    }
  }

  async function handlePreviewStateUpdate() {
    if (!activeGoalId || !activeMap) {
      return;
    }
    if (!stateForm.progress_summary.trim()) {
      setErrorMessage('GOAL을 위해 실제로 한 일이나 새로 알게 된 내용을 자연어로 적어주세요.');
      return;
    }

    try {
      setIsBusy(true);
      setErrorMessage('');
      await collectResearchPlanTargetsForGraph('리비전 미리보기');
      const stateUpdate = await createStateUpdate(activeGoalId, {
        update_date: new Date().toISOString().slice(0, 10),
        actual_time_spent: stateForm.actual_time_spent ? Number(stateForm.actual_time_spent) : null,
        actual_money_spent: stateForm.actual_money_spent ? Number(stateForm.actual_money_spent) : null,
        mood: stateForm.mood.trim() || null,
        progress_summary: stateForm.progress_summary.trim(),
        blockers: stateForm.blockers.trim(),
        next_adjustment: stateForm.next_adjustment.trim(),
        resource_deltas: {},
        learned_items: [],
        source_refs: [],
        pathway_id: activeMap.id
      });
      setStateUpdates((current) =>
        sortStateUpdatesNewestFirst([
          stateUpdate,
          ...current.filter((update) => update.id !== stateUpdate.id),
        ]),
      );
      const preview = await createRevisionPreview(activeMap.id, {
        checkin_id: stateUpdate.id
      });
      const hydratedPreview = await fetchRevisionPreview(preview.id);
      setRevisionPreview(hydratedPreview);
      setStatusMessage('현실 업데이트를 바탕으로 그래프 변경 미리보기를 생성했습니다. 캔버스에서 약해진 선, 새 연결, 보강 루트를 먼저 확인하세요.');
    } catch (error) {
      setErrorMessage(formatUiError(error, '그래프 변경 미리보기를 생성하지 못했습니다.'));
    } finally {
      setIsBusy(false);
    }
  }

  async function handleAcceptRevisionPreview() {
    if (!activeGoalId || !revisionPreview) {
      return;
    }

    try {
      setIsBusy(true);
      setErrorMessage('');
      const acceptedMap = await acceptRevisionPreview(revisionPreview.id);
      setRevisionPreview(null);
      setStateForm({
        progress_summary: '',
        blockers: '',
        next_adjustment: '',
        actual_time_spent: '',
        actual_money_spent: '',
        mood: ''
      });
      setStatusMessage('변경 미리보기를 적용했습니다. 그래프가 새로운 현실을 반영하도록 갱신되었습니다.');
      await refreshGoalWorkspace(activeGoalId, acceptedMap.id);
    } catch (error) {
      setErrorMessage(formatUiError(error, '그래프 미리보기를 적용하지 못했습니다.'));
    } finally {
      setIsBusy(false);
    }
  }

  async function handleDismissRevisionPreview() {
    if (!revisionPreview) {
      return;
    }

    try {
      setIsBusy(true);
      setErrorMessage('');
      await rejectRevisionPreview(revisionPreview.id);
      setRevisionPreview(null);
      setStatusMessage('변경 미리보기를 닫았습니다. 기존 그래프는 그대로 유지됩니다.');
    } catch (error) {
      setErrorMessage(formatUiError(error, '그래프 미리보기를 닫지 못했습니다.'));
    } finally {
      setIsBusy(false);
    }
  }

  async function handleToggleCodexLogin() {
    if (codexAuthBusy) {
      return;
    }
    if (!hasTauriRuntime) {
      setErrorMessage('CODEX 로그인은 Tauri 앱에서만 사용할 수 있습니다.');
      return;
    }
    try {
      setCodexAuthBusy(true);
      setErrorMessage('');
      await ensureEngineStarted();

      if (loginCompleted) {
        await invoke('logout_codex');
        await invoke('engine_stop');
        setEngineStarted(false);
        setLoginCompleted(false);
        setAuthMode('unknown');
        setUsageInfoText('');
        setStatusMessage('CODEX에서 로그아웃했습니다.');
        return;
      }

      const probed = await refreshAuthStateFromEngine(false);
      if (probed?.state === 'authenticated') {
        setStatusMessage('이미 CODEX에 로그인되어 있습니다.');
        return;
      }

      const result = await invoke<LoginChatgptResult>('login_chatgpt');
      const authUrl = typeof result?.authUrl === 'string' ? result.authUrl.trim() : '';
      if (!authUrl) {
        throw new Error('로그인 URL을 받지 못했습니다.');
      }
      await openUrl(authUrl);
      const deviceCode = typeof result?.deviceCode === 'string' ? result.deviceCode.trim() : '';
      setStatusMessage(
        deviceCode
          ? `브라우저에서 CODEX 로그인을 진행하고 코드 ${deviceCode} 를 입력하세요. 완료 후 설정 탭에서 상태를 다시 확인할 수 있습니다.`
          : '브라우저에서 CODEX 로그인을 진행하세요. 완료 후 설정 탭에서 상태를 다시 확인할 수 있습니다.',
      );
    } catch (error) {
      setErrorMessage(formatUiError(error, loginCompleted ? 'CODEX 로그아웃에 실패했습니다.' : 'CODEX 로그인 시작에 실패했습니다.'));
    } finally {
      setCodexAuthBusy(false);
    }
  }

  async function handleSelectCwdDirectory() {
    if (!hasTauriRuntime) {
      setErrorMessage('작업 폴더 선택은 Tauri 앱에서만 사용할 수 있습니다.');
      return;
    }
    try {
      setErrorMessage('');
      const selected = await invoke<string | null>('dialog_pick_directory');
      const nextCwd = typeof selected === 'string' ? selected.trim() : '';
      if (!nextCwd) {
        return;
      }
      setCwd(nextCwd);
      setStatusMessage(`작업 경로를 ${nextCwd.toLowerCase()} 로 바꿨습니다.`);
    } catch (error) {
      setErrorMessage(formatUiError(error, '작업 폴더 선택에 실패했습니다.'));
    }
  }

  async function handleOpenRunsFolder() {
    if (!hasTauriRuntime) {
      setErrorMessage('작업 폴더 열기는 Tauri 앱에서만 사용할 수 있습니다.');
      return;
    }
    try {
      await openPath(cwd);
    } catch (error) {
      setErrorMessage(formatUiError(error, '작업 폴더를 열지 못했습니다.'));
    }
  }

  function renderWorkflowTab() {
    const hasSidebarContent =
      Boolean(selectedNode) ||
      Boolean(goalAnalysis) ||
      Boolean(routeSelection) ||
      Boolean(currentState) ||
      stateUpdates.length > 0 ||
      Boolean(activeMap);
    const shouldShowInspector = showWorkflowInspector && hasSidebarContent;
    const previewNodeChanges = revisionPreview?.diff.node_changes ?? [];
    const previewEdgeChanges = revisionPreview?.diff.edge_changes ?? [];
    const workflowCanvasStats = displayBundle ? (
      <div className="pathway-canvas-status-strip" aria-label="그래프 상태" title={statusMessage}>
        <span className="pathway-canvas-status-label">활성 그래프</span>
        <div className="pathway-canvas-status-metrics">
          <span className="pathway-canvas-stat-badge">노드 <span className="pathway-canvas-stat-count">{displayBundle.nodes.length}</span></span>
          <span className="pathway-canvas-stat-badge">루트 <span className="pathway-canvas-stat-count">{displayBundle.edges.length}</span></span>
          <span className="pathway-canvas-stat-badge">근거 <span className="pathway-canvas-stat-count">{displayBundle.evidence.length}</span></span>
        </div>
      </div>
    ) : null;
    const workflowCanvasActions = (
      <>
        <button
          aria-label={showWorkflowInspector ? "인스펙터 숨기기" : "인스펙터 보기"}
          className={`pathway-canvas-icon-button ${showWorkflowInspector ? "is-active" : ""}`.trim()}
          onClick={() => setShowWorkflowInspector((current) => !current)}
          title={showWorkflowInspector ? "인스펙터 숨기기" : "인스펙터 보기"}
          type="button"
        >
          <img alt="" aria-hidden="true" className="canvas-control-icon" src="/icon-inspector-panel.svg" />
          <span className="sr-only">{showWorkflowInspector ? "인스펙터 숨기기" : "인스펙터 보기"}</span>
        </button>
        <button
          aria-label="입력 분석"
          className="pathway-canvas-icon-button"
          disabled={!activeGoalId || isBusy}
          onClick={handleAnalyzeGoal}
          title="입력 분석"
          type="button"
        >
          <img alt="" aria-hidden="true" className="canvas-control-icon" src="/icon-magic-stick.svg" />
          <span className="sr-only">입력 분석</span>
        </button>
        <button
          aria-label="루트 생성"
          className="pathway-canvas-icon-button pathway-canvas-icon-button-primary"
          disabled={!activeGoalId || isBusy}
          onClick={handleGeneratePathway}
          title="루트 생성"
          type="button"
        >
          <img alt="" aria-hidden="true" className="canvas-control-icon" src="/icon-git-commit.svg" />
          <span className="sr-only">루트 생성</span>
        </button>
      </>
    );

    return (
      <section className="pathway-workflow-shell workspace-tab-panel">
        <div
          className={`pathway-workflow-frame ${workflowCanvasFullscreen ? 'is-canvas-fullscreen' : ''}`.trim()}
        >
          <div
            className={`pathway-workflow-body ${shouldShowInspector ? 'has-inspector' : 'no-inspector'}`.trim()}
          >
            <div className="pathway-workflow-main">
              {displayBundle ? (
                <section className="pathway-workflow-canvas-panel panel-card">
                  {revisionPreview ? (
                    <div className="pathway-preview-banner">
                    <div>
                      <span className="pathway-panel-kicker">변경 미리보기</span>
                      <strong>요청을 반영하면 그래프가 이렇게 달라집니다</strong>
                      <p className="pathway-panel-copy">
                          초록은 새 루트, 주황은 수정 또는 약화, 자주색 점선과 X는 차단되거나 제거되는 경로입니다.
                        </p>
                        <p className="pathway-panel-copy">
                          노드 {previewNodeChanges.length}개 / 연결 {previewEdgeChanges.length}개 변화
                        </p>
                    </div>
                      <div className="pathway-preview-banner-actions">
                        <button className="mini-action-button pathway-primary-button" onClick={handleAcceptRevisionPreview} type="button" disabled={isBusy}>
                          미리보기 적용
                        </button>
                        <button className="mini-action-button" onClick={handleDismissRevisionPreview} type="button" disabled={isBusy}>
                          미리보기 폐기
                        </button>
                      </div>
                    </div>
                  ) : null}

                  {!selectedNode ? (
                    <div className="pathway-canvas-cue">
                      {revisionPreview
                        ? '노드 또는 연결선을 확인해 어떤 루트가 추가되고, 약해지고, 막히는지 먼저 검토하세요.'
                        : '노드를 선택하면 오른쪽 컨텍스트 패널에서 루트 정보, 근거, 가정과 현실 수정 요청을 함께 다룰 수 있습니다.'}
                    </div>
                  ) : null}
                  <PathwayRailCanvas
                    bundle={displayBundle}
                    baseBundle={displayBaseBundle}
                    overlayActions={workflowCanvasActions}
                    overlayStats={workflowCanvasStats}
                    onFullscreenChange={setWorkflowCanvasFullscreen}
                    revisionPreview={revisionPreview}
                    selectedNodeId={effectiveSelectedNodeId}
                    selectedRouteId={routeSelection?.selected_node_id ?? null}
                    activeProgressNodeIds={activeProgressNodeIds}
                    onSelectNode={handleSelectNode}
                  />
                  {displayBundle ? (
                    <section className="pathway-request-panel pathway-canvas-update-floater">
                      <div className="pathway-request-head">
                        <div>
                          <span className="pathway-panel-kicker">업데이트</span>
                          <strong>GOAL을 위해 실제로 한 일을 적고 그래프에 반영하기</strong>
                          <p className="pathway-panel-copy">
                            추가된/변경된 사항을 입력하면 다음 리비전이 기존 그래프를 보존한 채 이어서 붙습니다.
                          </p>
                        </div>
                        {revisionPreview ? null : (
                          <button className="mini-action-button pathway-primary-button" onClick={handlePreviewStateUpdate} type="button" disabled={!activeGoalId || isBusy}>
                            미리보기
                          </button>
                        )}
                      </div>

                      <textarea
                        className="pathway-textarea pathway-request-textarea"
                        value={stateForm.progress_summary}
                        onChange={(event) => setStateForm((current) => ({ ...current, progress_summary: event.target.value }))}
                        placeholder="예: 오늘 원어민 대화 15분을 시도했고 표현 우회 설명 연습을 했다."
                      />
                    </section>
                  ) : null}
                </section>
              ) : (
                <section className="pathway-workflow-canvas-panel pathway-workflow-empty-panel panel-card">
                  <EmptyState
                    title={activeGoalId ? '그래프가 아직 생성되지 않았습니다' : '선택된 목표가 없습니다'}
                    copy={
                      activeGoalId
                        ? '활성 목표를 기준으로 경로 그래프를 생성하면 이 캔버스가 주 작업면으로 열립니다.'
                        : '먼저 목표를 만들거나 선택하세요. 백엔드에서 실제 Pathway 데이터가 준비되면 그래프 작업면이 열립니다.'
                    }
                    action={
                      activeGoalId ? (
                        <button className="mini-action-button pathway-primary-button" onClick={handleGeneratePathway} type="button" disabled={isBusy}>
                          루트 생성
                        </button>
                      ) : undefined
                    }
                  />
                </section>
              )}
            </div>

            {shouldShowInspector ? (
              <aside className="pathway-workflow-sidebar panel-card is-open">
                <header className="pathway-workflow-sidebar-head">
                  <div>
                    <span className="pathway-panel-kicker">컨텍스트 패널</span>
                    <strong>{selectedNode?.label ?? activeGoal?.title ?? '현재 워크스페이스'}</strong>
                  </div>
                  <button
                    aria-label="컨텍스트 패널 닫기"
                    className="pathway-icon-close-button"
                    onClick={() => setShowWorkflowInspector(false)}
                    title="컨텍스트 패널 닫기"
                    type="button"
                  >
                    <img alt="" aria-hidden="true" className="pathway-close-icon" src="/icon-xmark.svg" />
                    <span className="sr-only">컨텍스트 패널 닫기</span>
                  </button>
                </header>

                <div className="pathway-workflow-sidebar-body">
                  {progressUpdateSummaries.length > 0 ? (
                    <section className="pathway-workflow-sidebar-card pathway-progress-history-card">
                      <div>
                        <span className="pathway-panel-kicker">진행 기록</span>
                        <strong>최근 업데이트 {progressUpdateSummaries.length}개</strong>
                      </div>
                      <ul className="pathway-progress-history-list">
                        {progressUpdateSummaries.map(({ update, matchedNodes }, index) => (
                          <li className={index === 0 ? 'is-current' : undefined} key={update.id}>
                            <div className="pathway-progress-history-row">
                              <span>{update.update_date}</span>
                              {index === 0 ? <em>현재 위치</em> : null}
                            </div>
                            <p>{update.progress_summary}</p>
                            {matchedNodes.length > 0 ? (
                              <div className="pathway-progress-history-tags" aria-label="연결된 그래프 노드">
                                {matchedNodes.map((node) => (
                                  <button
                                    key={`${update.id}:${node.id}`}
                                    onClick={() => void handleSelectNode(node.id)}
                                    type="button"
                                  >
                                    {node.label}
                                  </button>
                                ))}
                              </div>
                            ) : (
                              <span className="pathway-progress-history-empty">아직 직접 연결된 노드는 없습니다</span>
                            )}
                          </li>
                        ))}
                      </ul>
                    </section>
                  ) : null}

                  {selectedNode ? (
                    <section className="pathway-workflow-sidebar-card pathway-workflow-sidebar-card-featured">
                      <span className="pathway-panel-kicker">현재 보고 있는 루트</span>
                      <strong>{selectedNode.label}</strong>
                      <p className="pathway-panel-copy">
                        {selectedNode.summary || '이 루트가 현재 그래프에서 어떤 역할을 하는지 요약합니다.'}
                      </p>

                      <div className="pathway-node-summary-grid" aria-label="선택 노드 요약">
                        <article className="pathway-node-summary-card">
                          <span className="pathway-panel-kicker">연결 근거</span>
                          <strong>{selectedContentEvidence.length}개</strong>
                        </article>
                        <article className="pathway-node-summary-card">
                          <span className="pathway-panel-kicker">후보 URL</span>
                          <strong>{selectedMetadataEvidence.length}개</strong>
                        </article>
                        <article className="pathway-node-summary-card">
                          <span className="pathway-panel-kicker">연결 가정</span>
                          <strong>{selectedAssumptions.length}개</strong>
                        </article>
                      </div>

                      {selectedNodePreviewChange ? (
                        <section className="pathway-inspector-section">
                          <span className="pathway-panel-kicker">미리보기 영향</span>
                          <ul className="pathway-detail-list">
                            <li>
                              <strong>{selectedNodePreviewChange.change_type}</strong>
                              <span>{selectedNodePreviewChange.reason}</span>
                              {selectedNodePreviewChange.next_status ? (
                                <p>다음 상태: {selectedNodePreviewChange.next_status}</p>
                              ) : null}
                            </li>
                          </ul>
                        </section>
                      ) : null}

                      {selectedNodeVisibleFields.length > 0 ? (
                        <section className="pathway-inspector-section">
                          <span className="pathway-panel-kicker">구조화된 노드 정보</span>
                          <ul className="pathway-fact-list">
                            {selectedNodeVisibleFields.map(([key, value]) => (
                              <li key={key}>
                                <span>{key.replaceAll('_', ' ')}</span>
                                <strong>{formatFieldValue(value)}</strong>
                              </li>
                            ))}
                          </ul>
                        </section>
                      ) : null}

                      <section className="pathway-inspector-section">
                        <span className="pathway-panel-kicker">이 판단을 받치는 근거</span>
                        {selectedEvidence.length === 0 ? (
                          <p className="pathway-panel-copy">이 노드에 연결된 근거가 아직 없습니다.</p>
                        ) : (
                          <ul className="pathway-detail-list">
                            {selectedEvidence.map((item) => (
                              <li
                                className={isMetadataOnlyEvidence(item) ? 'pathway-evidence-item is-metadata-only' : 'pathway-evidence-item'}
                                key={item.id}
                              >
                                <em className="pathway-evidence-badge">{evidenceReliabilityLabel(item)}</em>
                                <strong>{item.title}</strong>
                                <span>{item.quote_or_summary}</span>
                                {item.url ? <p>{item.url}</p> : null}
                              </li>
                            ))}
                          </ul>
                        )}
                      </section>

                      <section className="pathway-inspector-section">
                        <span className="pathway-panel-kicker">성립을 전제로 둔 가정</span>
                        {selectedAssumptions.length === 0 ? (
                          <p className="pathway-panel-copy">이 노드에 연결된 가정이 없습니다.</p>
                        ) : (
                          <ul className="pathway-detail-list">
                            {selectedAssumptions.map((item) => (
                              <li key={item.id}>
                                <strong>{item.text}</strong>
                                <p>{item.risk_if_false}</p>
                              </li>
                            ))}
                          </ul>
                        )}
                      </section>
                    </section>
                  ) : null}

                  {goalAnalysis ? (
                    <section className="pathway-workflow-sidebar-card">
                      <span className="pathway-panel-kicker">자원 모델</span>
                      <strong>{goalAnalysis.resource_dimensions.length}개 자원 축 로드됨</strong>
                      <p className="pathway-panel-copy">{goalAnalysis.analysis_summary}</p>
                    </section>
                  ) : null}

                  {goalAnalysis?.followup_questions?.length ? (
                    <section className="pathway-workflow-sidebar-card">
                      <span className="pathway-panel-kicker">조사 전 확인 질문</span>
                      <ul className="pathway-detail-list">
                        {goalAnalysis.followup_questions.slice(0, 6).map((question) => (
                          <li key={question.id}>
                            <strong>{question.question}</strong>
                            <p>{question.why_needed}</p>
                          </li>
                        ))}
                      </ul>
                    </section>
                  ) : null}

                  {researchPlanCollectionStatus ? (
                    <section className="pathway-workflow-sidebar-card">
                      <span className="pathway-panel-kicker">자동 수집 상태</span>
                      <p className="pathway-panel-copy pathway-collector-status">
                        {researchPlanCollectionStatus}
                      </p>
                    </section>
                  ) : null}

                  {routeSelection || currentState || stateUpdates.length > 0 ? (
                    <section className="pathway-workflow-sidebar-card">
                      <span className="pathway-panel-kicker">현실 상태</span>
                      {routeSelection ? <strong>{routeSelection.selected_node_id}</strong> : null}
                      {routeSelection?.rationale ? (
                        <p className="pathway-panel-copy">{routeSelection.rationale}</p>
                      ) : null}
                      <p className="pathway-panel-copy">
                        {currentState?.state_summary ??
                          (stateUpdates.length > 0
                            ? `${stateUpdates.length}개의 현실 업데이트가 그래프 수정에 사용 가능합니다.`
                            : '현재 목표에 대한 상태 데이터가 준비되어 있습니다.')}
                      </p>
                    </section>
                  ) : null}

                </div>
              </aside>
            ) : null}
          </div>
        </div>
      </section>
    );
  }

  function renderTasksTab() {
    return (
      <TasksPage
        appendWorkspaceEvent={() => {}}
        activeGoalId={activeGoalId}
        activeGoalTitle={activeGoal?.title ?? null}
        codexAuthCheckPending={false}
        cwd={cwd}
        hasTauriRuntime={hasTauriRuntime}
        invokeFn={invoke}
        isActive={workspaceTab === 'tasks'}
        loginCompleted={loginCompleted}
        onCancelPathwayWork={handleCancelPathwayWork}
        onOpenWorkflow={() => setWorkspaceTab('workflow')}
        onGeneratePathwayFromIntake={handleGeneratePathwayFromIntake}
        onDeleteGoal={(goalId) => {
          void handleDeletePathwayGoal(goalId);
        }}
        onOpenSettings={() => setWorkspaceTab('settings')}
        onSelectGoal={(goalId) => {
          void handleSelectPathwayGoal(goalId);
        }}
        onStartPathwayIntake={handleStartPathwayIntake}
        pathwayGoalAnalysis={goalAnalysis}
        pathwayGoalAnalysisError={goalAnalysisError}
        pathwayGoals={goals}
        pathwayMode
        publishAction={() => {}}
        setStatus={setStatusMessage}
      />
    );
  }

  function renderSettingsTab() {
    return (
      <section className="panel-card settings-view workspace-tab-panel">
        <SettingsPage
          authModeText={authModeLabel(authMode)}
          codexAuthBusy={codexAuthBusy}
          compact={false}
          collectorDoctorPending={collectorDoctorPending}
          collectorDoctorStatuses={collectorDoctorStatuses}
          collectorInstallPendingId={collectorInstallPendingId}
          cwd={cwd}
          engineStarted={engineStarted}
          isGraphRunning={false}
          loginCompleted={loginCompleted}
          onCloseUsageResult={() => setUsageResultClosed(true)}
          onOpenRunsFolder={() => void handleOpenRunsFolder()}
          onRefreshCollectorDoctor={() => void refreshCollectorDoctor()}
          onInstallCollector={(providerId) => void handleInstallCollector(providerId)}
          onSelectCwdDirectory={() => void handleSelectCwdDirectory()}
          onToggleCodexLogin={() => void handleToggleCodexLogin()}
          running={isBusy}
          status={statusMessage}
          usageInfoText={usageInfoText}
          usageResultClosed={usageResultClosed}
        />
        <section className="pathway-settings-note" aria-label="작업면 정리 안내">
          <div className="pathway-panel-head">
            <div>
              <span className="pathway-panel-kicker">작업면 정리</span>
              <strong>상위 탭을 입력 / 워크플로우 / 설정으로 재정렬</strong>
            </div>
          </div>
          <p className="pathway-panel-copy">
            자원 모델, 근거, 가정, 현실 수정 요청은 이제 워크플로우 화면 안에서 함께 다루고, 시스템 연결과 인증만 설정 탭에서 관리합니다.
          </p>
        </section>
      </section>
    );
  }

  return (
    <main className={`app-shell ${workspaceTab === 'workflow' && workflowCanvasFullscreen ? 'canvas-fullscreen-mode' : ''}`.trim()}>
      <div aria-hidden="true" className="window-drag-region" data-tauri-drag-region />
      <AppNav
        activeTab={workspaceTab}
        hidden={workspaceTab === 'workflow' && workflowCanvasFullscreen}
        onSelectTab={(tab) => setWorkspaceTab(tab as WorkspaceTab)}
        renderIcon={(tab, active) => <NavIcon active={active} tab={tab as WorkspaceTab} />}
      />
      <section
        className={`workspace workspace-simple-shell ${workspaceTab === 'workflow' && workflowCanvasFullscreen ? 'canvas-fullscreen-active' : ''} ${errorMessage ? 'workspace-has-error' : ''}`.trim()}
      >
        {errorMessage ? (
          <div className="error">
            <span>{errorMessage}</span>
          </div>
        ) : null}

        {workspaceTab === 'workflow' && renderWorkflowTab()}
        {workspaceTab === 'tasks' && renderTasksTab()}
        {workspaceTab === 'settings' && renderSettingsTab()}
      </section>
    </main>
  );
}
