import { type ReactNode, useEffect, useMemo, useState } from 'react';

import AppNav from '../components/AppNav';
import TasksPage from '../pages/tasks/TasksPage';
import SettingsPage from '../pages/settings/SettingsPage';
import { invoke, openPath, openUrl } from '../shared/tauri';
import {
  acceptRevisionPreview,
  analyzeGoal,
  createRevisionPreview,
  createStateUpdate,
  fetchCurrentState,
  fetchGoalMaps,
  fetchGoals,
  fetchRevisionPreview,
  fetchRouteSelection,
  fetchStateUpdates,
  generatePathway,
  getAssumptionsForNode,
  getEvidenceForNode,
  rejectRevisionPreview,
  updateRouteSelection
} from '../lib/api';
import { buildExampleGraphBundle } from '../lib/exampleGraphBundle';
import PathwayRailCanvas from './PathwayRailCanvas';
import {
  extractAuthMode,
  isEngineAlreadyStartedError,
  loadPersistedAuthMode,
  loadPersistedCodexMultiAgentMode,
  loadPersistedCwd,
  loadPersistedLoginCompleted,
} from './mainAppUtils';
import type {
  CurrentStateSnapshot,
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
type PathwayAuthMode = 'chatgpt' | 'apikey' | 'unknown';

type CollectorDoctorState = 'checking' | 'ready' | 'error';

type CollectorDoctorStatus = {
  id: string;
  label: string;
  detail: string;
  state: CollectorDoctorState;
  message: string;
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

function formatUiError(error: unknown, fallback: string): string {
  const message = error instanceof Error ? error.message : fallback;
  if (/failed to fetch|networkerror|load failed/i.test(message)) {
    return '로컬 API에 아직 연결되지 않았습니다. 데모 그래프로 작업면을 먼저 확인할 수 있습니다.';
  }
  return message || fallback;
}

export default function MainApp() {
  const hasTauriRuntime =
    typeof window !== 'undefined' &&
    typeof (window as typeof window & { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__ !== 'undefined';
  const [workspaceTab, setWorkspaceTab] = useState<WorkspaceTab>('tasks');
  const [showWorkflowInspector, setShowWorkflowInspector] = useState(true);
  const [workflowCanvasFullscreen, setWorkflowCanvasFullscreen] = useState(false);
  const [goals, setGoals] = useState<GoalRecord[]>([]);
  const [activeGoalId, setActiveGoalId] = useState<string | null>(null);
  const [activeGoal, setActiveGoal] = useState<GoalRecord | null>(null);
  const [goalAnalysis, setGoalAnalysis] = useState<GoalAnalysisRecord | null>(null);
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

  const [stateForm, setStateForm] = useState({
    progress_summary: '',
    blockers: '',
    next_adjustment: '',
    actual_time_spent: '',
    actual_money_spent: '',
    mood: ''
  });

  const activeBundle = activeMap?.graph_bundle ?? null;
  const demoBundle = useMemo(
    () => buildExampleGraphBundle(activeGoal?.title || undefined),
    [activeGoal?.title]
  );
  const visibleBundle = activeBundle && revisionPreview
    ? mergePreviewBundle(activeBundle, revisionPreview)
    : activeBundle;
  const displayBundle = visibleBundle ?? demoBundle;
  const effectiveSelectedNodeId =
    selectedNodeId ?? (activeBundle ? routeSelection?.selected_node_id ?? null : null);
  const selectedNode = findSelectedNode(displayBundle, effectiveSelectedNodeId);
  const selectedEvidence = selectedNode ? getEvidenceForNode(displayBundle, selectedNode.id) : [];
  const selectedAssumptions = selectedNode ? getAssumptionsForNode(displayBundle, selectedNode.id) : [];
  const selectedNodePreviewChange =
    selectedNode && revisionPreview
      ? revisionPreview.diff.node_changes.find((item) => item.node_id === selectedNode.id) ?? null
      : null;
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
    if (!hasTauriRuntime) {
      throw new Error('Tauri runtime unavailable');
    }
    try {
      await invoke('engine_start', { cwd });
      setEngineStarted(true);
    } catch (error) {
      if (isEngineAlreadyStartedError(error)) {
        setEngineStarted(true);
        return;
      }
      throw error;
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
      return result;
    } catch (error) {
      if (showStatus) {
        setErrorMessage(formatUiError(error, 'CODEX 인증 상태를 확인하지 못했습니다.'));
      }
      return null;
    }
  }

  async function refreshGoals(preserveSelection = true) {
    const nextGoals = await fetchGoals();
    setGoals(nextGoals);
    if (nextGoals.length === 0) {
      setActiveGoalId(null);
      setActiveGoal(null);
      return;
    }

    const preferredGoalId =
      preserveSelection && activeGoalId && nextGoals.some((goal) => goal.id === activeGoalId)
        ? activeGoalId
        : nextGoals[0]?.id;
    setActiveGoalId(preferredGoalId ?? null);
  }

  async function refreshGoalWorkspace(goalId: string, preferredMapId?: string | null) {
    setRevisionPreview(null);
    setWorkflowCanvasFullscreen(false);
    const goal = goals.find((item) => item.id === goalId) ?? (await fetchGoals()).find((item) => item.id === goalId) ?? null;
    setActiveGoal(goal);

    const [nextMaps, nextUpdates, nextCurrentState] = await Promise.all([
      fetchGoalMaps(goalId),
      fetchStateUpdates(goalId),
      fetchCurrentState(goalId)
    ]);

    setMaps(nextMaps);
    setStateUpdates(nextUpdates);
    setCurrentState(nextCurrentState);

    const chosenMap =
      (preferredMapId ? nextMaps.find((item) => item.id === preferredMapId) : null) ??
      nextMaps[0] ??
      null;
    setActiveMap(chosenMap);
    setActiveMapId(chosenMap?.id ?? null);
    setSelectedNodeId(null);
    setShowWorkflowInspector(Boolean(chosenMap));

    if (chosenMap) {
      const nextRouteSelection = await fetchRouteSelection(chosenMap.id);
      setRouteSelection(nextRouteSelection);
    } else {
      setRouteSelection(null);
    }
  }

  useEffect(() => {
    void (async () => {
      try {
        await refreshGoals(false);
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
    if (workspaceTab !== 'settings') {
      return;
    }
    if (!hasTauriRuntime) {
      setStatusMessage('브라우저 프리뷰에서는 CODEX 로그인 브리지를 확인할 수 없습니다. Tauri 앱에서 설정을 열어주세요.');
      setCollectorDoctorStatuses(
        COLLECTOR_DOCTOR_DEFINITIONS.map((collector) => ({
          ...collector,
          state: 'checking',
          message: 'Tauri 앱에서 확인할 수 있습니다.',
        })),
      );
      return;
    }
    void refreshAuthStateFromEngine(true);
    void refreshCollectorDoctor();
  }, [hasTauriRuntime, workspaceTab]);

  async function refreshCollectorDoctor() {
    if (!hasTauriRuntime) {
      setCollectorDoctorStatuses(
        COLLECTOR_DOCTOR_DEFINITIONS.map((collector) => ({
          ...collector,
          state: 'checking',
          message: 'Tauri 앱에서 확인할 수 있습니다.',
        })),
      );
      return;
    }
    setCollectorDoctorPending(true);
    try {
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
            } satisfies CollectorDoctorStatus;
          } catch (error) {
            return {
              ...collector,
              state: 'error',
              message: formatUiError(error, '상태 확인 실패'),
            } satisfies CollectorDoctorStatus;
          }
        }),
      );
      setCollectorDoctorStatuses(results);
    } finally {
      setCollectorDoctorPending(false);
    }
  }

  async function handleAnalyzeGoal() {
    if (!activeGoalId) {
      return;
    }
    try {
      setIsBusy(true);
      setErrorMessage('');
      const analysis = await analyzeGoal(activeGoalId);
      setGoalAnalysis(analysis);
      setStatusMessage('목표 분석이 갱신되었습니다. 필요한 자원 축과 조사 입력이 업데이트되었습니다.');
    } catch (error) {
      setErrorMessage(formatUiError(error, '목표 분석에 실패했습니다.'));
    } finally {
      setIsBusy(false);
    }
  }

  async function handleGeneratePathway() {
    if (!activeGoalId) {
      return;
    }
    try {
      setIsBusy(true);
      setErrorMessage('');
      const nextMap = await generatePathway(activeGoalId);
      setStatusMessage('새 경로 그래프를 생성했고 워크플로우 화면에 반영했습니다.');
      await refreshGoalWorkspace(activeGoalId, nextMap.id);
      setWorkspaceTab('workflow');
    } catch (error) {
      setErrorMessage(formatUiError(error, 'Pathway 그래프 생성에 실패했습니다.'));
    } finally {
      setIsBusy(false);
    }
  }

  async function handleSelectNode(nodeId: string) {
    setSelectedNodeId(nodeId);
    setShowWorkflowInspector(true);
    if (revisionPreview) {
      return;
    }
    if (!activeMap) {
      setStatusMessage('데모 그래프를 탐색 중입니다. 목표를 만들고 루트 생성 버튼을 누르면 실제 그래프로 교체됩니다.');
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
      setErrorMessage('현실 변경 사항을 기록하려면 진행 요약이 필요합니다.');
      return;
    }

    try {
      setIsBusy(true);
      setErrorMessage('');
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
      const preview = await createRevisionPreview(activeMap.id, {
        checkin_id: stateUpdate.id
      });
      const hydratedPreview = await fetchRevisionPreview(preview.id);
      setRevisionPreview(hydratedPreview);
      setStatusMessage('그래프 변경 미리보기를 생성했습니다. 캔버스에서 약해진 선, 차단된 루트, 새 브랜치를 먼저 검토하세요.');
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
      setStatusMessage('브라우저에서 CODEX 로그인을 진행하세요. 완료 후 설정 탭에서 상태를 다시 확인할 수 있습니다.');
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
    const hasLiveGraph = Boolean(visibleBundle);
    const hasGraph = Boolean(displayBundle);
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
    const workflowCanvasStats = hasGraph ? (
      <div className="pathway-canvas-status-strip" aria-label="그래프 상태" title={statusMessage}>
        <span className="pathway-canvas-status-label">{hasLiveGraph ? '활성 그래프' : '데모 그래프'}</span>
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
              {hasGraph ? (
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
                        : hasLiveGraph
                          ? '노드를 선택하면 오른쪽 컨텍스트 패널에서 루트 정보, 근거, 가정과 현실 수정 요청을 함께 다룰 수 있습니다.'
                          : '실제 데이터가 아직 없어서 데모 그래프를 먼저 보여주고 있습니다. 목표를 만들고 루트 생성 버튼을 누르면 이 캔버스가 실제 경로로 교체됩니다.'}
                    </div>
                  ) : null}
                  <PathwayRailCanvas
                    bundle={displayBundle}
                    baseBundle={activeBundle ?? undefined}
                    overlayActions={workflowCanvasActions}
                    overlayStats={workflowCanvasStats}
                    onFullscreenChange={setWorkflowCanvasFullscreen}
                    revisionPreview={revisionPreview}
                    selectedNodeId={effectiveSelectedNodeId}
                    selectedRouteId={routeSelection?.selected_node_id ?? null}
                    onSelectNode={handleSelectNode}
                  />
                  {hasGraph ? (
                    <section className="pathway-request-panel pathway-canvas-update-floater">
                      <div className="pathway-request-head">
                        <div>
                          <span className="pathway-panel-kicker">현실 업데이트</span>
                          <strong>지금 상태를 반영해 그래프 다시 계산하기</strong>
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
                        placeholder="Pathway가 목표 기준으로 필요한 정보가 부족하면 되물으면서 다음 그래프에 필요한 제약, 막힘, 새 분기를 수집합니다."
                      />
                    </section>
                  ) : null}
                </section>
              ) : (
                <section className="pathway-workflow-canvas-panel panel-card">
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
                  {selectedNode ? (
                    <section className="pathway-workflow-sidebar-card pathway-workflow-sidebar-card-featured">
                      <span className="pathway-panel-kicker">현재 보고 있는 루트</span>
                      <strong>{selectedNode.label}</strong>
                      <p className="pathway-panel-copy">
                        {selectedNode.summary || '이 루트가 현재 그래프에서 어떤 역할을 하는지 요약합니다.'}
                      </p>

                      <div className="pathway-node-summary-grid" aria-label="선택 노드 요약">
                        <article className="pathway-node-summary-card">
                          <span className="pathway-panel-kicker">노드 유형</span>
                          <strong>{selectedNode.type.replaceAll('_', ' ')}</strong>
                        </article>
                        <article className="pathway-node-summary-card">
                          <span className="pathway-panel-kicker">연결 근거</span>
                          <strong>{selectedEvidence.length}개</strong>
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

                      <section className="pathway-inspector-section">
                        <span className="pathway-panel-kicker">구조화된 노드 정보</span>
                        <ul className="pathway-fact-list">
                          {getVisibleNodeFields(selectedNode).map(([key, value]) => (
                            <li key={key}>
                              <span>{key.replaceAll('_', ' ')}</span>
                              <strong>{formatFieldValue(value)}</strong>
                            </li>
                          ))}
                        </ul>
                      </section>

                      <section className="pathway-inspector-section">
                        <span className="pathway-panel-kicker">이 판단을 받치는 근거</span>
                        {selectedEvidence.length === 0 ? (
                          <p className="pathway-panel-copy">이 노드에 연결된 근거가 아직 없습니다.</p>
                        ) : (
                          <ul className="pathway-detail-list">
                            {selectedEvidence.map((item) => (
                              <li key={item.id}>
                                <strong>{item.title}</strong>
                                <span>{item.quote_or_summary}</span>
                                <p>{item.reliability}</p>
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
        onOpenWorkflow={() => setWorkspaceTab('workflow')}
        onOpenSettings={() => setWorkspaceTab('settings')}
        onSelectGoal={(goalId) => {
          setActiveGoalId(goalId);
          if (!goalId) {
            setActiveGoal(null);
          }
        }}
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
          cwd={cwd}
          engineStarted={engineStarted}
          isGraphRunning={false}
          loginCompleted={loginCompleted}
          onCloseUsageResult={() => setUsageResultClosed(true)}
          onOpenRunsFolder={() => void handleOpenRunsFolder()}
          onRefreshCollectorDoctor={() => void refreshCollectorDoctor()}
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
