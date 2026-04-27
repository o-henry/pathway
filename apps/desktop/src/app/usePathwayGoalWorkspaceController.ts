import type { Dispatch, SetStateAction } from 'react';

import {
  deleteGoal,
  fetchCurrentState,
  fetchGoalAnalysis,
  fetchGoalMaps,
  fetchGoals,
  fetchRouteSelection,
  fetchStateUpdates,
} from '../lib/api';
import type {
  CurrentStateSnapshot,
  GoalAnalysisRecord,
  GoalRecord,
  LifeMap,
  RevisionProposalRecord,
  RouteSelectionRecord,
  StateUpdateRecord,
} from '../lib/types';
import {
  formatUiError,
  isTauriUnavailableError,
} from './pathwayWorkspaceUtils';

type GoalAnalysisError = { goalId: string; message: string } | null;

export function resolvePreferredPathwayGoalId({
  activeGoalId,
  goals,
  pathwayNewGoalMode,
  preserveSelection,
}: {
  activeGoalId: string | null;
  goals: GoalRecord[];
  pathwayNewGoalMode: boolean;
  preserveSelection: boolean;
}): string | null {
  if (goals.length === 0) {
    return null;
  }
  if (preserveSelection && pathwayNewGoalMode) {
    return null;
  }
  if (preserveSelection && activeGoalId && goals.some((goal) => goal.id === activeGoalId)) {
    return activeGoalId;
  }
  return goals[0]?.id ?? null;
}

export function sortPathwayMapsNewestFirst(maps: LifeMap[]): LifeMap[] {
  return [...maps].sort((left, right) => {
    const leftTime = Date.parse(left.updated_at ?? left.created_at ?? '') || 0;
    const rightTime = Date.parse(right.updated_at ?? right.created_at ?? '') || 0;
    return rightTime - leftTime;
  });
}

type UsePathwayGoalWorkspaceControllerOptions = {
  activeGoalId: string | null;
  activeMapId: string | null;
  analyzeGoalInBackground: (goalId: string, statusLabel?: string) => Promise<void>;
  analyzeGoalWithRetry: (goalId: string, statusLabel?: string) => Promise<GoalAnalysisRecord>;
  ensureEngineStarted: () => Promise<void>;
  goalAnalysis: GoalAnalysisRecord | null;
  goalAnalysisError: GoalAnalysisError;
  goals: GoalRecord[];
  pathwayNewGoalMode: boolean;
  refreshLocalApiTokenFromShell: () => Promise<void>;
  setActiveGoal: Dispatch<SetStateAction<GoalRecord | null>>;
  setActiveGoalId: Dispatch<SetStateAction<string | null>>;
  setActiveMap: Dispatch<SetStateAction<LifeMap | null>>;
  setActiveMapId: Dispatch<SetStateAction<string | null>>;
  setCurrentState: Dispatch<SetStateAction<CurrentStateSnapshot | null>>;
  setErrorMessage: Dispatch<SetStateAction<string>>;
  setGoalAnalysis: Dispatch<SetStateAction<GoalAnalysisRecord | null>>;
  setGoalAnalysisError: Dispatch<SetStateAction<GoalAnalysisError>>;
  setGoals: Dispatch<SetStateAction<GoalRecord[]>>;
  setIsBusy: Dispatch<SetStateAction<boolean>>;
  setMaps: Dispatch<SetStateAction<LifeMap[]>>;
  setPathwayNewGoalMode: Dispatch<SetStateAction<boolean>>;
  setRevisionPreview: Dispatch<SetStateAction<RevisionProposalRecord | null>>;
  setRouteSelection: Dispatch<SetStateAction<RouteSelectionRecord | null>>;
  setSelectedNodeId: Dispatch<SetStateAction<string | null>>;
  setShowStateUpdatePanel: Dispatch<SetStateAction<boolean>>;
  setShowWorkflowInspector: Dispatch<SetStateAction<boolean>>;
  setStateUpdates: Dispatch<SetStateAction<StateUpdateRecord[]>>;
  setStatusMessage: Dispatch<SetStateAction<string>>;
  setWorkflowCanvasFullscreen: Dispatch<SetStateAction<boolean>>;
};

export function usePathwayGoalWorkspaceController({
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
}: UsePathwayGoalWorkspaceControllerOptions) {
  function clearGoalWorkspace() {
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
    setShowStateUpdatePanel(false);
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
      clearGoalWorkspace();
      return null;
    }

    if (preserveSelection && pathwayNewGoalMode) {
      setActiveGoalId(null);
      return null;
    }

    const preferredGoalId = resolvePreferredPathwayGoalId({
      activeGoalId,
      goals: nextGoals,
      pathwayNewGoalMode,
      preserveSelection,
    });
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
    const nextMaps = sortPathwayMapsNewestFirst(rawMaps);

    setMaps(nextMaps);
    setStateUpdates(nextUpdates);
    setCurrentState(nextCurrentState);
    if (existingAnalysis) {
      setGoalAnalysis(existingAnalysis);
      setGoalAnalysisError(null);
    } else {
      if (goalAnalysis?.goal_id === goalId) {
        setGoalAnalysis(null);
      }
      if (!goalAnalysisError || goalAnalysisError.goalId !== goalId) {
        void analyzeGoalInBackground(goalId, '목표 체크리스트 분석');
      }
    }

    const chosenMap =
      (preferredMapId ? nextMaps.find((item) => item.id === preferredMapId) : null) ??
      nextMaps[0] ??
      null;
    setActiveMap(chosenMap);
    setActiveMapId(chosenMap?.id ?? null);
    setSelectedNodeId(null);
    setShowWorkflowInspector(false);
    setShowStateUpdatePanel(false);

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
      clearGoalWorkspace();
      return;
    }

    setPathwayNewGoalMode(false);
    const nextGoal = goals.find((item) => item.id === goalId) ?? null;
    setActiveGoal(nextGoal);
    await refreshGoalWorkspace(goalId);
    try {
      setIsBusy(true);
      const analysis = await analyzeGoalWithRetry(goalId, '선택한 목표 체크리스트 분석');
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
        clearGoalWorkspace();
      }
      await syncPathwayWorkspace(!deletedActiveGoal);
    } catch (error) {
      setErrorMessage(formatUiError(error, '목표를 삭제하지 못했습니다.'));
    }
  }

  return {
    handleDeletePathwayGoal,
    handleSelectPathwayGoal,
    refreshGoalWorkspace,
    syncPathwayWorkspace,
  };
}
