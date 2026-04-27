import { useEffect, useMemo, useRef, useState } from 'react';

import AppNav from '../components/AppNav';
import TasksPage from '../pages/tasks/TasksPage';
import SettingsPage from '../pages/settings/SettingsPage';
import { invoke, openPath, openUrl } from '../shared/tauri';
import {
  analyzeGoal,
  setLocalApiToken,
} from '../lib/api';
import PathwayWorkflowPanel, { type PathwayStateForm } from './PathwayWorkflowPanel';
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
} from './researchPlanCollectorJobs';
import {
  type PathwayAuthMode,
} from './pathwayCollectorContracts';
import {
  delay,
  formatUiError,
  isLocalApiTransientError,
} from './pathwayWorkspaceUtils';
import { usePathwayCollectorDoctor } from './usePathwayCollectorDoctor';
import { usePathwayGoalWorkspaceController } from './usePathwayGoalWorkspaceController';
import { usePathwayMutationController } from './usePathwayMutationController';
import { usePathwayResearchCollector } from './usePathwayResearchCollector';
import { usePathwayWorkspaceDerivedState } from './usePathwayWorkspaceDerivedState';
import type {
  CurrentStateSnapshot,
  GoalAnalysisRecord,
  GoalRecord,
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
const GOAL_ANALYSIS_RETRY_DELAYS_MS = [0, 1000, 2500, 5000] as const;

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
  const [showStateUpdatePanel, setShowStateUpdatePanel] = useState(false);
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
  const engineStartedRef = useRef(false);
  const engineStartPromiseRef = useRef<Promise<void> | null>(null);
  const goalAnalysisPromiseRef = useRef<Map<string, Promise<GoalAnalysisRecord>>>(new Map());
  const authStateLastCheckedAtRef = useRef(0);
  const pathwayWorkCancelledRef = useRef(false);

  const [stateForm, setStateForm] = useState<PathwayStateForm>({
    progress_summary: '',
    blockers: '',
    next_adjustment: '',
    actual_time_spent: '',
    actual_money_spent: '',
    mood: ''
  });

  const researchPlanCollectorJobs = useMemo(
    () => buildResearchPlanCollectorJobs(goalAnalysis),
    [goalAnalysis],
  );
  const {
    activeProgressNodeIds,
    displayBaseBundle,
    displayBundle,
    effectiveSelectedNodeId,
    progressUpdateSummaries,
    selectedAssumptions,
    selectedContentEvidence,
    selectedEvidence,
    selectedMetadataEvidence,
    selectedNode,
    selectedNodeActionGuidance,
    selectedNodePreviewChange,
    selectedNodeVisibleFields,
  } = usePathwayWorkspaceDerivedState({
    activeGoal,
    activeMap,
    revisionPreview,
    routeSelection,
    selectedNodeId,
    stateUpdates,
  });
  const {
    collectorDoctorPending,
    collectorDoctorStatuses,
    collectorInstallPendingId,
    handleInstallCollector,
    refreshCollectorDoctor,
    refreshCollectorDoctorIfStale,
  } = usePathwayCollectorDoctor({
    cwd,
    ensureEngineStarted,
    hasTauriRuntime,
    setStatusMessage,
  });
  const {
    cancelResearchPlanCollection,
    collectResearchPlanTargetsForGraph,
    researchPlanCollectionStatus,
  } = usePathwayResearchCollector({
    cwd,
    defaultJobs: researchPlanCollectorJobs,
    ensureEngineStarted,
    resetKey: goalAnalysis?.goal_id,
    setErrorMessage,
    setStatusMessage,
  });
  const {
    handleDeletePathwayGoal,
    handleSelectPathwayGoal,
    refreshGoalWorkspace,
    syncPathwayWorkspace,
  } = usePathwayGoalWorkspaceController({
    activeGoalId,
    activeMapId,
    analyzeGoalInBackground,
    analyzeGoalWithRetry,
    ensureEngineStarted,
    goalAnalysis,
    goalAnalysisError,
    goals,
    pathwayNewGoalMode,
    refreshLocalApiTokenFromShell,
    setActiveGoal,
    setActiveGoalId,
    setActiveMap,
    setActiveMapId,
    setCurrentState,
    setErrorMessage,
    setGoalAnalysis,
    setGoalAnalysisError,
    setGoals,
    setIsBusy,
    setMaps,
    setPathwayNewGoalMode,
    setRevisionPreview,
    setRouteSelection,
    setSelectedNodeId,
    setShowStateUpdatePanel,
    setShowWorkflowInspector,
    setStateUpdates,
    setStatusMessage,
    setWorkflowCanvasFullscreen,
  });
  const {
    handleAcceptRevisionPreview,
    handleCancelPathwayWork: cancelPathwayWorkWithoutEngineStop,
    handleDismissRevisionPreview,
    handleGeneratePathway,
    handleGeneratePathwayFromIntake,
    handlePreviewStateUpdate,
    handleSelectNode,
    handleStartPathwayIntake,
  } = usePathwayMutationController({
    activeGoalId,
    activeMap,
    analyzeGoalWithRetry,
    cancelResearchPlanCollection,
    collectResearchPlanTargetsForGraph,
    ensureEngineStarted,
    goalAnalysis,
    hasTauriRuntime,
    openWorkflowTab: () => setWorkspaceTab('workflow'),
    pathwayWorkCancelledRef,
    refreshGoalWorkspace,
    researchPlanCollectorJobs,
    revisionPreview,
    setActiveGoal,
    setActiveGoalId,
    setActiveMap,
    setActiveMapId,
    setCurrentState,
    setErrorMessage,
    setGoalAnalysis,
    setGoalAnalysisError,
    setGoals,
    setIsBusy,
    setPathwayNewGoalMode,
    setRevisionPreview,
    setRouteSelection,
    setSelectedNodeId,
    setShowStateUpdatePanel,
    setShowWorkflowInspector,
    setStateForm,
    setStateUpdates,
    setStatusMessage,
    stateForm,
  });
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
      await refreshLocalApiTokenFromShell();
      return;
    }
    if (engineStartedRef.current) {
      await refreshLocalApiTokenFromShell();
      return;
    }
    if (engineStartPromiseRef.current) {
      await engineStartPromiseRef.current;
      return;
    }
    const startPromise = (async () => {
      try {
        await invoke('engine_start', { cwd });
        await refreshLocalApiTokenFromShell();
        engineStartedRef.current = true;
        setEngineStarted(true);
      } catch (error) {
        if (isEngineAlreadyStartedError(error)) {
          engineStartedRef.current = true;
          setEngineStarted(true);
          return;
        }
        throw error;
      } finally {
        engineStartPromiseRef.current = null;
      }
    })();
    engineStartPromiseRef.current = startPromise;
    await startPromise;
  }

  useEffect(() => {
    engineStartedRef.current = engineStarted;
  }, [engineStarted]);

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

  async function analyzeGoalWithRetry(goalId: string, statusLabel = '목표 분석'): Promise<GoalAnalysisRecord> {
    const existing = goalAnalysisPromiseRef.current.get(goalId);
    if (existing) {
      return existing;
    }

    const promise = (async () => {
      let lastError: unknown = null;
      for (let attemptIndex = 0; attemptIndex < GOAL_ANALYSIS_RETRY_DELAYS_MS.length; attemptIndex += 1) {
        const delayMs = GOAL_ANALYSIS_RETRY_DELAYS_MS[attemptIndex] ?? 0;
        if (delayMs > 0) {
          await delay(delayMs);
        }
        try {
          if (hasTauriRuntime) {
            await ensureEngineStarted();
          }
          return await analyzeGoal(goalId);
        } catch (error) {
          lastError = error;
          const isLastAttempt = attemptIndex >= GOAL_ANALYSIS_RETRY_DELAYS_MS.length - 1;
          if (!isLocalApiTransientError(error) || isLastAttempt) {
            throw error;
          }
          setStatusMessage(`${statusLabel} 중 로컬 API 준비를 기다리고 있습니다. 재시도 ${attemptIndex + 1}/${GOAL_ANALYSIS_RETRY_DELAYS_MS.length - 1}`);
        }
      }
      throw lastError instanceof Error ? lastError : new Error(`${statusLabel}에 실패했습니다.`);
    })();

    goalAnalysisPromiseRef.current.set(goalId, promise);
    try {
      return await promise;
    } finally {
      if (goalAnalysisPromiseRef.current.get(goalId) === promise) {
        goalAnalysisPromiseRef.current.delete(goalId);
      }
    }
  }

  async function analyzeGoalInBackground(goalId: string, statusLabel = '목표 분석') {
    try {
      const analysis = await analyzeGoalWithRetry(goalId, statusLabel);
      if (pathwayWorkCancelledRef.current) {
        return;
      }
      setGoalAnalysis(analysis);
      setGoalAnalysisError(null);
      setStatusMessage(`${statusLabel}이 완료되었습니다.`);
    } catch (error) {
      if (pathwayWorkCancelledRef.current) {
        return;
      }
      if (isLocalApiTransientError(error)) {
        return;
      }
      const message = formatUiError(error, `${statusLabel}에 실패했습니다.`);
      setGoalAnalysisError({ goalId, message });
      setStatusMessage(message);
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
      void refreshCollectorDoctorIfStale(SETTINGS_COLLECTOR_DOCTOR_REFRESH_COOLDOWN_MS);
    }, SETTINGS_DEFERRED_REFRESH_DELAY_MS);
    return () => {
      window.clearTimeout(refreshTimer);
    };
  }, [hasTauriRuntime, workspaceTab]);


  async function handleCancelPathwayWork() {
    cancelPathwayWorkWithoutEngineStop();
    if (!hasTauriRuntime) {
      return;
    }
    try {
      await invoke('engine_stop');
      engineStartPromiseRef.current = null;
      engineStartedRef.current = false;
      setEngineStarted(false);
    } catch {
      // Cancellation has already been reflected in UI state.
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
        engineStartPromiseRef.current = null;
        engineStartedRef.current = false;
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
    return (
      <PathwayWorkflowPanel
        activeGoalId={activeGoalId}
        activeGoalTitle={activeGoal?.title ?? null}
        activeMapExists={Boolean(activeMap)}
        activeProgressNodeIds={activeProgressNodeIds}
        currentState={currentState}
        displayBaseBundle={displayBaseBundle}
        displayBundle={displayBundle}
        effectiveSelectedNodeId={effectiveSelectedNodeId}
        goalAnalysis={goalAnalysis}
        isBusy={isBusy}
        progressUpdateSummaries={progressUpdateSummaries}
        researchPlanCollectionStatus={researchPlanCollectionStatus}
        revisionPreview={revisionPreview}
        routeSelection={routeSelection}
        selectedAssumptions={selectedAssumptions}
        selectedContentEvidence={selectedContentEvidence}
        selectedEvidence={selectedEvidence}
        selectedMetadataEvidence={selectedMetadataEvidence}
        selectedNode={selectedNode}
        selectedNodeActionGuidance={selectedNodeActionGuidance}
        selectedNodePreviewChange={selectedNodePreviewChange}
        selectedNodeVisibleFields={selectedNodeVisibleFields}
        showStateUpdatePanel={showStateUpdatePanel}
        showWorkflowInspector={showWorkflowInspector}
        stateForm={stateForm}
        stateUpdates={stateUpdates}
        statusMessage={statusMessage}
        workflowCanvasFullscreen={workflowCanvasFullscreen}
        onAcceptRevisionPreview={handleAcceptRevisionPreview}
        onDismissRevisionPreview={handleDismissRevisionPreview}
        onGeneratePathway={handleGeneratePathway}
        onPreviewStateUpdate={handlePreviewStateUpdate}
        onSelectNode={(nodeId) => {
          void handleSelectNode(nodeId);
        }}
        setShowStateUpdatePanel={setShowStateUpdatePanel}
        setShowWorkflowInspector={setShowWorkflowInspector}
        setStateForm={setStateForm}
        setWorkflowCanvasFullscreen={setWorkflowCanvasFullscreen}
      />
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
        pathwayHasActiveGraph={Boolean(activeMap)}
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
