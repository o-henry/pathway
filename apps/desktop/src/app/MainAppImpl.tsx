import { useEffect, useMemo, useRef, useState } from 'react';

import AppNav from '../components/AppNav';
import TasksPage from '../pages/tasks/TasksPage';
import SettingsPage from '../pages/settings/SettingsPage';
import { invoke } from '../shared/tauri';
import {
  analyzeGoal,
  checkLocalApiReady,
  getApiBaseUrl,
} from '../lib/api';
import PathwayWorkflowPanel, { type PathwayStateForm } from './PathwayWorkflowPanel';
import {
  buildResearchPlanCollectorJobs,
} from './researchPlanCollectorJobs';
import type { PathwayAuthMode } from './pathwayCollectorContracts';
import {
  delay,
  formatUiError,
  isLocalApiTransientError,
} from './pathwayWorkspaceUtils';
import { usePathwayCollectorDoctor } from './usePathwayCollectorDoctor';
import { usePathwayEngineAuth } from './usePathwayEngineAuth';
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

type WorkspaceTab = 'tasks' | 'workflow' | 'settings';
const WORKSPACE_TAB_SHORTCUTS: WorkspaceTab[] = ['tasks', 'workflow', 'settings'];
const SETTINGS_AUTH_REFRESH_COOLDOWN_MS = 60_000;
const SETTINGS_COLLECTOR_DOCTOR_REFRESH_COOLDOWN_MS = 5 * 60_000;
const SETTINGS_LOCAL_API_REFRESH_COOLDOWN_MS = 30_000;
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
  const [localApiStatus, setLocalApiStatus] = useState<{
    state: 'checking' | 'ready' | 'error';
    message: string;
    url: string;
    checkedAt: string | null;
  }>(() => ({
    state: 'checking',
    message: '아직 로컬 API 연결을 확인하지 않았습니다.',
    url: getApiBaseUrl(),
    checkedAt: null,
  }));
  const [localApiStatusPending, setLocalApiStatusPending] = useState(false);
  const goalAnalysisPromiseRef = useRef<Map<string, Promise<GoalAnalysisRecord>>>(new Map());
  const pathwayWorkCancelledRef = useRef(false);
  const localApiStatusLastCheckedAtRef = useRef(0);
  const localApiStatusInFlightRef = useRef(false);

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
    authMode,
    codexAuthBusy,
    cwd,
    engineStarted,
    ensureEngineStarted,
    handleOpenRunsFolder,
    handleSelectCwdDirectory,
    handleToggleCodexLogin,
    loginCompleted,
    refreshAuthStateIfStale,
    refreshLocalApiTokenFromShell,
    setUsageResultClosed,
    stopEngine,
    usageInfoText,
    usageResultClosed,
  } = usePathwayEngineAuth({
    hasTauriRuntime,
    setErrorMessage,
    setStatusMessage,
  });
  const {
    activeProgressNodeIds,
    displayBaseBundle,
    displayBundle,
    effectiveSelectedNodeId,
    progressUpdateSummaries,
    selectedAssumptions,
    selectedContentEvidence,
    selectedNode,
    selectedNodeActionGuidance,
    selectedNodePreviewChange,
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
    preflightPathwayGeneration,
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

  async function refreshLocalApiStatus() {
    if (localApiStatusInFlightRef.current) {
      return;
    }
    localApiStatusInFlightRef.current = true;
    setLocalApiStatusPending(true);
    setLocalApiStatus((current) => ({
      ...current,
      state: 'checking',
      message: '로컬 API 연결을 확인하는 중입니다.',
      url: getApiBaseUrl(),
    }));
    try {
      if (hasTauriRuntime) {
        await ensureEngineStarted();
      } else {
        await refreshLocalApiTokenFromShell();
      }
      await checkLocalApiReady();
      localApiStatusLastCheckedAtRef.current = Date.now();
      setLocalApiStatus({
        state: 'ready',
        message: '목표 저장, 체크리스트 분석, 조사, 그래프 생성을 시작할 수 있습니다.',
        url: getApiBaseUrl(),
        checkedAt: new Date().toLocaleTimeString('ko-KR', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        }),
      });
    } catch (error) {
      localApiStatusLastCheckedAtRef.current = Date.now();
      setLocalApiStatus({
        state: 'error',
        message: formatUiError(error, '로컬 API 연결 확인에 실패했습니다.'),
        url: getApiBaseUrl(),
        checkedAt: new Date().toLocaleTimeString('ko-KR', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        }),
      });
    } finally {
      localApiStatusInFlightRef.current = false;
      setLocalApiStatusPending(false);
    }
  }

  async function refreshLocalApiStatusIfStale(maxAgeMs: number) {
    if (Date.now() - localApiStatusLastCheckedAtRef.current < maxAgeMs) {
      return;
    }
    await refreshLocalApiStatus();
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
    if (workspaceTab !== 'settings') {
      return;
    }
    if (!hasTauriRuntime) {
      setStatusMessage('브라우저 프리뷰에서는 일부 설정 연결이 제한될 수 있습니다. 가능하면 Tauri 앱에서 확인하세요.');
    }
    const refreshTimer = window.setTimeout(() => {
      void refreshAuthStateIfStale(SETTINGS_AUTH_REFRESH_COOLDOWN_MS);
      void refreshCollectorDoctorIfStale(SETTINGS_COLLECTOR_DOCTOR_REFRESH_COOLDOWN_MS);
      void refreshLocalApiStatusIfStale(SETTINGS_LOCAL_API_REFRESH_COOLDOWN_MS);
    }, SETTINGS_DEFERRED_REFRESH_DELAY_MS);
    return () => {
      window.clearTimeout(refreshTimer);
    };
  }, [hasTauriRuntime, workspaceTab]);


  async function handleCancelPathwayWork() {
    cancelPathwayWorkWithoutEngineStop();
    try {
      await stopEngine();
    } catch {
      // Cancellation has already been reflected in UI state.
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
        selectedNode={selectedNode}
        selectedNodeActionGuidance={selectedNodeActionGuidance}
        selectedNodePreviewChange={selectedNodePreviewChange}
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
        onPreflightPathwayGeneration={preflightPathwayGeneration}
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
          localApiStatus={localApiStatus}
          localApiStatusPending={localApiStatusPending}
          loginCompleted={loginCompleted}
          onCloseUsageResult={() => setUsageResultClosed(true)}
          onOpenRunsFolder={() => void handleOpenRunsFolder()}
          onRefreshCollectorDoctor={() => void refreshCollectorDoctor()}
          onRefreshLocalApiStatus={() => void refreshLocalApiStatus()}
          onInstallCollector={(providerId) => void handleInstallCollector(providerId)}
          onSelectCwdDirectory={() => void handleSelectCwdDirectory()}
          onToggleCodexLogin={() => void handleToggleCodexLogin()}
          running={isBusy}
          status={statusMessage}
          usageInfoText={usageInfoText}
          usageResultClosed={usageResultClosed}
        />
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
