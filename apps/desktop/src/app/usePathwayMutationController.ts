import type { Dispatch, MutableRefObject, SetStateAction } from 'react';

import {
  acceptRevisionPreview,
  checkLocalApiReady,
  createGoal,
  createRevisionPreview,
  createStateUpdate,
  deleteGoal,
  fetchGoal,
  fetchRevisionPreview,
  generatePathway,
  rejectRevisionPreview,
  updateGoal,
  updateRouteSelection,
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
import type { PathwayStateForm } from './PathwayWorkflowPanel';
import { buildResearchPlanCollectorJobs } from './researchPlanCollectorJobs';
import {
  buildIntakeGoalTitle,
  buildIntakeSuccessCriteria,
  formatUiError,
  isLocalApiTransientError,
  sortStateUpdatesNewestFirst,
} from './pathwayWorkspaceUtils';

type GoalAnalysisError = { goalId: string; message: string } | null;

type UsePathwayMutationControllerOptions = {
  activeGoalId: string | null;
  activeMap: LifeMap | null;
  analyzeGoalWithRetry: (goalId: string, statusLabel?: string) => Promise<GoalAnalysisRecord>;
  cancelResearchPlanCollection: () => void;
  collectResearchPlanTargetsForGraph: (triggerLabel: string, jobs?: ReturnType<typeof buildResearchPlanCollectorJobs>) => Promise<void>;
  ensureEngineStarted: () => Promise<void>;
  goalAnalysis: GoalAnalysisRecord | null;
  hasTauriRuntime: boolean;
  openWorkflowTab: () => void;
  pathwayWorkCancelledRef: MutableRefObject<boolean>;
  refreshGoalWorkspace: (goalId: string, preferredMapId?: string | null) => Promise<void>;
  researchPlanCollectorJobs: ReturnType<typeof buildResearchPlanCollectorJobs>;
  revisionPreview: RevisionProposalRecord | null;
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
  setPathwayNewGoalMode: Dispatch<SetStateAction<boolean>>;
  setRevisionPreview: Dispatch<SetStateAction<RevisionProposalRecord | null>>;
  setRouteSelection: Dispatch<SetStateAction<RouteSelectionRecord | null>>;
  setSelectedNodeId: Dispatch<SetStateAction<string | null>>;
  setShowStateUpdatePanel: Dispatch<SetStateAction<boolean>>;
  setShowWorkflowInspector: Dispatch<SetStateAction<boolean>>;
  setStateForm: Dispatch<SetStateAction<PathwayStateForm>>;
  setStateUpdates: Dispatch<SetStateAction<StateUpdateRecord[]>>;
  setStatusMessage: Dispatch<SetStateAction<string>>;
  stateForm: PathwayStateForm;
};

export function usePathwayMutationController({
  activeGoalId,
  activeMap,
  analyzeGoalWithRetry,
  cancelResearchPlanCollection,
  collectResearchPlanTargetsForGraph,
  ensureEngineStarted,
  goalAnalysis,
  hasTauriRuntime,
  openWorkflowTab,
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
}: UsePathwayMutationControllerOptions) {
  async function preflightPathwayGeneration() {
    if (hasTauriRuntime) {
      await ensureEngineStarted();
    }
    await checkLocalApiReady();
  }

  async function recoverLocalApiAfterTransientFailure(stageLabel: string) {
    setStatusMessage(`${stageLabel} 중 로컬 API 연결을 다시 확인합니다.`);
    if (hasTauriRuntime) {
      await ensureEngineStarted();
    }
    await checkLocalApiReady();
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
      await preflightPathwayGeneration();
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
      setStatusMessage('목표를 저장했습니다. 체크리스트 질문을 생성하는 중입니다.');
      const analysis = await analyzeGoalWithRetry(goal.id, '목표 체크리스트 분석');
      if (pathwayWorkCancelledRef.current) {
        throw new Error('Pathway 작업이 중단되었습니다.');
      }
      setGoalAnalysis(analysis);
      setGoalAnalysisError(null);
      setStatusMessage('체크리스트 질문을 생성했습니다.');
      return { goal, analysis };
    } catch (error) {
      if (pathwayWorkCancelledRef.current) {
        setStatusMessage('실행이 중단되었습니다.');
        throw new Error('실행이 중단되었습니다.');
      }
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
      const answerBlock = answers.map((answer, index) => `${index + 1}. ${answer.trim()}`).filter(Boolean).join('\n');
      let goal: GoalRecord;
      try {
        goal = await fetchGoal(goalId);
      } catch (error) {
        if (!isLocalApiTransientError(error)) {
          throw error;
        }
        await recoverLocalApiAfterTransientFailure('그래프 생성');
        goal = await fetchGoal(goalId);
      }
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
          : await analyzeGoalWithRetry(goalId, '그래프 생성 전 목표 분석');
      if (pathwayWorkCancelledRef.current) {
        throw new Error('Pathway 작업이 중단되었습니다.');
      }
      setGoalAnalysis(analysisForCollection);
      setGoalAnalysisError(null);
      await collectResearchPlanTargetsForGraph('그래프 생성', buildResearchPlanCollectorJobs(analysisForCollection));
      if (pathwayWorkCancelledRef.current) {
        throw new Error('Pathway 작업이 중단되었습니다.');
      }
      let nextMap: LifeMap;
      try {
        nextMap = await generatePathway(goalId);
      } catch (error) {
        if (!isLocalApiTransientError(error)) {
          throw error;
        }
        await recoverLocalApiAfterTransientFailure('그래프 생성');
        nextMap = await generatePathway(goalId);
      }
      if (pathwayWorkCancelledRef.current) {
        throw new Error('Pathway 작업이 중단되었습니다.');
      }
      setStatusMessage('상담 내용을 반영해 새 경로 그래프를 생성했습니다.');
      await refreshGoalWorkspace(goalId, nextMap.id);
      openWorkflowTab();
    } catch (error) {
      if (pathwayWorkCancelledRef.current) {
        setStatusMessage('실행이 중단되었습니다.');
        throw new Error('실행이 중단되었습니다.');
      }
      const message = isLocalApiTransientError(error)
        ? '그래프 생성 중 로컬 API 연결이 끊겼고 자동 재확인 후에도 복구하지 못했습니다. 앱을 재시작한 뒤 다시 시도해 주세요.'
        : formatUiError(error, 'Pathway 그래프 생성에 실패했습니다.');
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
      await preflightPathwayGeneration();
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
      openWorkflowTab();
    } catch (error) {
      if (pathwayWorkCancelledRef.current) {
        setStatusMessage('실행이 중단되었습니다.');
        return;
      }
      setErrorMessage(formatUiError(error, 'Pathway 그래프 생성에 실패했습니다.'));
    } finally {
      setIsBusy(false);
    }
  }

  async function handleCancelPathwayWork() {
    pathwayWorkCancelledRef.current = true;
    setIsBusy(false);
    cancelResearchPlanCollection();
    setStatusMessage('실행이 중단되었습니다.');
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
        rationale: '',
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
      let jobsForCollection = researchPlanCollectorJobs;
      if (jobsForCollection.length === 0 || goalAnalysis?.goal_id !== activeGoalId) {
        const analysis = await analyzeGoalWithRetry(activeGoalId, '업데이트 입력 분석');
        setGoalAnalysis(analysis);
        setGoalAnalysisError(null);
        jobsForCollection = buildResearchPlanCollectorJobs(analysis);
      }
      await collectResearchPlanTargetsForGraph('리비전 미리보기', jobsForCollection);
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
        pathway_id: activeMap.id,
      });
      setStateUpdates((current) =>
        sortStateUpdatesNewestFirst([
          stateUpdate,
          ...current.filter((update) => update.id !== stateUpdate.id),
        ]),
      );
      const preview = await createRevisionPreview(activeMap.id, {
        checkin_id: stateUpdate.id,
      });
      const hydratedPreview = await fetchRevisionPreview(preview.id);
      setRevisionPreview(hydratedPreview);
      setShowStateUpdatePanel(false);
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
        mood: '',
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

  return {
    handleAcceptRevisionPreview,
    handleCancelPathwayWork,
    handleDismissRevisionPreview,
    handleGeneratePathway,
    handleGeneratePathwayFromIntake,
    handlePreviewStateUpdate,
    preflightPathwayGeneration,
    handleSelectNode,
    handleStartPathwayIntake,
  };
}
