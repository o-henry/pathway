import { type ReactNode, useEffect, useMemo, useState } from 'react';

import AppNav from '../components/AppNav';
import {
  acceptRevisionPreview,
  analyzeGoal,
  createGoal,
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

type WorkspaceTab = 'tasks' | 'workflow' | 'knowledge' | 'adaptation';
const WORKSPACE_TAB_SHORTCUTS: WorkspaceTab[] = ['tasks', 'workflow', 'knowledge', 'adaptation'];

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
  if (tab === 'knowledge') {
    return <img alt="" aria-hidden="true" className="nav-workflow-image nav-database-image" src="/data-service-svgrepo-com.svg" />;
  }
  if (tab === 'adaptation') {
    return <img alt="" aria-hidden="true" className="nav-workflow-image" src="/star.svg" />;
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

export default function MainApp() {
  const [workspaceTab, setWorkspaceTab] = useState<WorkspaceTab>('workflow');
  const [showWorkflowInspector, setShowWorkflowInspector] = useState(true);
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

  const [goalForm, setGoalForm] = useState({
    title: '',
    description: '',
    category: 'general',
    successCriteria: ''
  });
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
    () => buildExampleGraphBundle(activeGoal?.title || goalForm.title || undefined),
    [activeGoal?.title, goalForm.title]
  );
  const visibleBundle = activeBundle && revisionPreview
    ? mergePreviewBundle(activeBundle, revisionPreview)
    : activeBundle;
  const displayBundle = visibleBundle ?? demoBundle;
  const effectiveSelectedNodeId = selectedNodeId ?? displayBundle.nodes[0]?.id ?? null;
  const selectedNode = findSelectedNode(displayBundle, effectiveSelectedNodeId);
  const selectedEvidence = selectedNode ? getEvidenceForNode(displayBundle, selectedNode.id) : [];
  const selectedAssumptions = selectedNode ? getAssumptionsForNode(displayBundle, selectedNode.id) : [];
  const selectedNodePreviewChange =
    selectedNode && revisionPreview
      ? revisionPreview.diff.node_changes.find((item) => item.node_id === selectedNode.id) ?? null
      : null;
  const hasWorkflowRail = Boolean(goalAnalysis || routeSelection || currentState || stateUpdates.length > 0);

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
    setSelectedNodeId(chosenMap?.graph_bundle.nodes[0]?.id ?? null);

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
        setErrorMessage(error instanceof Error ? error.message : '목표를 불러오지 못했습니다.');
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
        setErrorMessage(error instanceof Error ? error.message : '목표 작업공간을 불러오지 못했습니다.');
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

  async function handleCreateGoal() {
    if (!goalForm.title.trim() || !goalForm.successCriteria.trim()) {
      setErrorMessage('목표 제목과 성공 기준은 필수입니다.');
      return;
    }

    try {
      setIsBusy(true);
      setErrorMessage('');
      const created = await createGoal({
        title: goalForm.title.trim(),
        description: goalForm.description.trim(),
        category: goalForm.category.trim() || 'general',
        success_criteria: goalForm.successCriteria.trim()
      });
      setGoalForm({ title: '', description: '', category: 'general', successCriteria: '' });
      setStatusMessage('목표가 생성되었습니다. 이제 새 목표를 기준으로 Pathway가 전개됩니다.');
      await refreshGoals(false);
      setActiveGoalId(created.id);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : '목표 생성에 실패했습니다.');
    } finally {
      setIsBusy(false);
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
      setErrorMessage(error instanceof Error ? error.message : '목표 분석에 실패했습니다.');
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
      setErrorMessage(error instanceof Error ? error.message : 'Pathway 그래프 생성에 실패했습니다.');
    } finally {
      setIsBusy(false);
    }
  }

  async function handleSelectNode(nodeId: string) {
    setSelectedNodeId(nodeId);
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
      setErrorMessage(error instanceof Error ? error.message : '루트 선택 업데이트에 실패했습니다.');
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
      setErrorMessage(error instanceof Error ? error.message : '그래프 변경 미리보기를 생성하지 못했습니다.');
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
      setErrorMessage(error instanceof Error ? error.message : '그래프 미리보기를 적용하지 못했습니다.');
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
      setErrorMessage(error instanceof Error ? error.message : '그래프 미리보기를 닫지 못했습니다.');
    } finally {
      setIsBusy(false);
    }
  }

  function renderWorkflowTab() {
    const hasLiveGraph = Boolean(visibleBundle);
    const hasGraph = Boolean(displayBundle);
    const shouldShowInspector = showWorkflowInspector && Boolean(selectedNode);
    const previewNodeChanges = revisionPreview?.diff.node_changes ?? [];
    const previewEdgeChanges = revisionPreview?.diff.edge_changes ?? [];
    const workflowCanvasStats = hasGraph ? (
      <div className="pathway-canvas-status-strip" aria-label="그래프 상태">
        <span className="pathway-canvas-status-label">{hasLiveGraph ? '활성 그래프' : '데모 그래프'}</span>
        <span className="pathway-canvas-stat-badge">노드 {displayBundle.nodes.length}</span>
        <span className="pathway-canvas-stat-badge">루트 {displayBundle.edges.length}</span>
        <span className="pathway-canvas-stat-badge">근거 {displayBundle.evidence.length}</span>
        <span className="pathway-canvas-stat-badge pathway-canvas-stat-badge-status" title={statusMessage}>
          {statusMessage}
        </span>
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
          <img alt="" aria-hidden="true" className="canvas-control-icon" src="/icon-eye.svg" />
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
          <img alt="" aria-hidden="true" className="canvas-control-icon" src="/icon-magic-wand.svg" />
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
          <img alt="" aria-hidden="true" className="canvas-control-icon" src="/icon-branch.svg" />
          <span className="sr-only">루트 생성</span>
        </button>
      </>
    );

    return (
      <section className="pathway-workflow-shell workspace-tab-panel">
        <div className="pathway-workflow-frame panel-card">
          <div className={`pathway-workflow-body ${shouldShowInspector ? 'has-inspector' : ''}`.trim()}>
              {hasWorkflowRail ? (
              <aside className="pathway-workflow-rail">
                {goalAnalysis ? (
                  <section className="pathway-workflow-rail-card">
                    <span className="pathway-panel-kicker">자원 모델</span>
                    <strong>{goalAnalysis.resource_dimensions.length}개 자원 축 로드됨</strong>
                    <p className="pathway-panel-copy">{goalAnalysis.analysis_summary}</p>
                  </section>
                ) : null}

                {routeSelection ? (
                  <section className="pathway-workflow-rail-card">
                    <span className="pathway-panel-kicker">현재 루트</span>
                    <strong>{routeSelection.selected_node_id}</strong>
                    {routeSelection.rationale ? (
                      <p className="pathway-panel-copy">{routeSelection.rationale}</p>
                    ) : null}
                  </section>
                ) : null}

                {currentState || stateUpdates.length > 0 ? (
                  <section className="pathway-workflow-rail-card">
                    <span className="pathway-panel-kicker">현실 상태</span>
                    <strong>{currentState?.state_summary ?? `${stateUpdates.length}개 업데이트 기록됨`}</strong>
                    <p className="pathway-panel-copy">
                      {stateUpdates.length > 0 ? `${stateUpdates.length}개의 현실 업데이트가 그래프 수정에 사용 가능합니다.` : '현재 목표에 대한 상태 데이터가 준비되어 있습니다.'}
                    </p>
                  </section>
                ) : null}
              </aside>
            ) : null}

            <div className="pathway-workflow-main">
              {hasGraph ? (
                <section className="pathway-workflow-canvas-panel">
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
                          ? '그래프 노드를 선택하면 루트 정보, 근거, 가정을 바로 확인할 수 있습니다.'
                          : '실제 데이터가 아직 없어서 데모 그래프를 먼저 보여주고 있습니다. 목표를 만들고 루트 생성 버튼을 누르면 이 캔버스가 실제 경로로 교체됩니다.'}
                    </div>
                  ) : null}
                  <PathwayRailCanvas
                    bundle={displayBundle}
                    baseBundle={activeBundle ?? undefined}
                    overlayActions={workflowCanvasActions}
                    overlayStats={workflowCanvasStats}
                    revisionPreview={revisionPreview}
                    selectedNodeId={effectiveSelectedNodeId}
                    selectedRouteId={routeSelection?.selected_node_id ?? null}
                    onSelectNode={handleSelectNode}
                  />
                </section>
              ) : (
                <section className="pathway-workflow-canvas-panel">
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

              {activeMap ? (
                <section className="pathway-request-panel">
                  <div className="pathway-request-head">
                    <div>
                      <span className="pathway-panel-kicker">그래프 수정 요청</span>
                      <strong>기존 그래프를 유지한 채 먼저 변경 미리보기 생성</strong>
                    </div>
                    {revisionPreview ? null : (
                      <button className="mini-action-button pathway-primary-button" onClick={handlePreviewStateUpdate} type="button" disabled={!activeGoalId || isBusy}>
                        변경 미리보기
                      </button>
                    )}
                  </div>

                  {revisionPreview ? (
                    <p className="pathway-preview-note">
                      현실 기록은 먼저 저장되고, 현재 화면의 미리보기만 선택적으로 적용 또는 폐기할 수 있습니다.
                    </p>
                  ) : null}

                  <label className="pathway-field">
                    <span>현실에서 무엇이 달라졌나요?</span>
                    <textarea
                      className="pathway-textarea pathway-request-textarea"
                      value={stateForm.progress_summary}
                      onChange={(event) => setStateForm((current) => ({ ...current, progress_summary: event.target.value }))}
                      placeholder="진행 상황, 막힌 점, 새로 불가능해진 길, 혹은 그래프에 반영할 개인적인 방식을 적어주세요."
                    />
                  </label>

                  <div className="pathway-request-grid">
                    <label className="pathway-field">
                      <span>막히거나 약해진 경로</span>
                      <input
                        className="pathway-input"
                        value={stateForm.blockers}
                        onChange={(event) => setStateForm((current) => ({ ...current, blockers: event.target.value }))}
                        placeholder="어떤 루트의 실현 가능성이 떨어졌나요?"
                      />
                    </label>
                    <label className="pathway-field">
                      <span>새로운 루트 또는 방법</span>
                      <input
                        className="pathway-input"
                        value={stateForm.next_adjustment}
                        onChange={(event) => setStateForm((current) => ({ ...current, next_adjustment: event.target.value }))}
                        placeholder="새로 연결해야 할 브랜치는 무엇인가요?"
                      />
                    </label>
                    <label className="pathway-field">
                      <span>사용 시간</span>
                      <input
                        className="pathway-input"
                        value={stateForm.actual_time_spent}
                        onChange={(event) => setStateForm((current) => ({ ...current, actual_time_spent: event.target.value }))}
                        placeholder="예: 12"
                      />
                    </label>
                    <label className="pathway-field">
                      <span>사용 금액</span>
                      <input
                        className="pathway-input"
                        value={stateForm.actual_money_spent}
                        onChange={(event) => setStateForm((current) => ({ ...current, actual_money_spent: event.target.value }))}
                        placeholder="예: 450000"
                      />
                    </label>
                  </div>
                </section>
              ) : null}
            </div>

            {shouldShowInspector ? (
              <aside className="pathway-workflow-inspector is-open">
                <header className="pathway-workflow-inspector-head">
                  <div>
                    <span className="pathway-panel-kicker">노드 인스펙터</span>
                    <strong>{selectedNode?.label ?? '노드를 선택하세요'}</strong>
                  </div>
                  <button className="mini-action-button" onClick={() => setShowWorkflowInspector(false)} type="button">
                    닫기
                  </button>
                </header>

                {selectedNode ? (
                  <div className="pathway-workflow-inspector-body">
                    <p className="pathway-panel-copy">{selectedNode.summary}</p>

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
                      <span className="pathway-panel-kicker">루트 정보</span>
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
                      <span className="pathway-panel-kicker">근거</span>
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
                      <span className="pathway-panel-kicker">가정</span>
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
                  </div>
                ) : null}
              </aside>
            ) : null}
          </div>
        </div>
      </section>
    );
  }

  function renderTasksTab() {
    return (
      <section className="pathway-grid-layout workspace-tab-panel">
        <section className="panel-card pathway-form-card">
          <div className="pathway-panel-head">
            <div>
              <span className="pathway-panel-kicker">목표 입력</span>
              <strong>Pathway가 모델링할 목표 정의</strong>
            </div>
          </div>
          <textarea
            className="pathway-textarea pathway-textarea-large"
            value={goalForm.title}
            onChange={(event) => setGoalForm((current) => ({ ...current, title: event.target.value }))}
            placeholder="자연어로 목표를 설명하세요. 시스템이 실제로 중요한 자원 축을 추론합니다."
          />
          <textarea
            className="pathway-textarea"
            value={goalForm.description}
            onChange={(event) => setGoalForm((current) => ({ ...current, description: event.target.value }))}
            placeholder="배경 맥락, 현재 제약, 미리 알아야 할 조건을 적어주세요."
          />
          <div className="pathway-input-row">
            <input
              className="pathway-input"
              value={goalForm.category}
              onChange={(event) => setGoalForm((current) => ({ ...current, category: event.target.value }))}
              placeholder="카테고리"
            />
            <input
              className="pathway-input"
              value={goalForm.successCriteria}
              onChange={(event) => setGoalForm((current) => ({ ...current, successCriteria: event.target.value }))}
              placeholder="성공 기준"
            />
          </div>
          <div className="pathway-actions-row">
            <button className="mini-action-button pathway-primary-button" onClick={handleCreateGoal} type="button" disabled={isBusy}>
              목표 생성
            </button>
            <button className="mini-action-button" onClick={handleAnalyzeGoal} type="button" disabled={!activeGoalId || isBusy}>
              자원 분석
            </button>
            <button className="mini-action-button" onClick={handleGeneratePathway} type="button" disabled={!activeGoalId || isBusy}>
              그래프 생성
            </button>
          </div>
        </section>

        <section className="panel-card pathway-list-card">
          <div className="pathway-panel-head">
            <div>
              <span className="pathway-panel-kicker">목표 목록</span>
              <strong>최근 Pathway 목표</strong>
            </div>
          </div>
          {goals.length === 0 ? (
            <EmptyState title="목표가 아직 없습니다" copy="첫 목표를 만들어 로컬 의사결정 그래프를 시작하세요." />
          ) : (
            <ul className="pathway-goal-list">
              {goals.map((goal) => (
                <li key={goal.id}>
                  <button
                    className={`pathway-list-button ${activeGoalId === goal.id ? 'is-active' : ''}`}
                    onClick={() => setActiveGoalId(goal.id)}
                    type="button"
                  >
                    <strong>{goal.title}</strong>
                    <span>{goal.category}</span>
                    <span>{goal.success_criteria}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </section>
    );
  }

  function renderKnowledgeTab() {
    return (
      <section className="pathway-grid-layout workspace-tab-panel">
        <section className="panel-card pathway-list-card">
          <div className="pathway-panel-head">
            <div>
              <span className="pathway-panel-kicker">자원 축</span>
              <strong>{goalAnalysis ? '이 목표에 실제로 중요한 것' : '먼저 목표를 분석하세요'}</strong>
            </div>
          </div>
          {goalAnalysis ? (
            <ul className="pathway-detail-list">
              {goalAnalysis.resource_dimensions.map((dimension) => (
                <li key={dimension.id}>
                  <strong>{dimension.label}</strong>
                  <span>{dimension.question}</span>
                  <p>{dimension.relevance_reason}</p>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState
              title="자원 모델이 아직 없습니다"
              copy="활성 목표를 분석하면 관련 자원 축, 후속 질문, 조사 입력이 생성됩니다."
              action={
                <button className="mini-action-button pathway-primary-button" onClick={handleAnalyzeGoal} type="button" disabled={!activeGoalId || isBusy}>
                  목표 분석
                </button>
              }
            />
          )}
        </section>

        <section className="panel-card pathway-list-card">
          <div className="pathway-panel-head">
            <div>
              <span className="pathway-panel-kicker">근거와 가정</span>
              <strong>{selectedNode?.label ?? '워크플로우 노드를 선택하세요'}</strong>
            </div>
          </div>
          {selectedNode ? (
            <div className="pathway-knowledge-stack">
              <section>
                <h3>근거</h3>
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
              <section>
                <h3>가정</h3>
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
            </div>
          ) : (
            <EmptyState title="선택된 노드가 없습니다" copy="워크플로우 탭에서 노드를 선택하면 근거와 명시적 가정을 확인할 수 있습니다." />
          )}
        </section>
      </section>
    );
  }

  function renderAdaptationTab() {
    return (
      <section className="pathway-grid-layout workspace-tab-panel">
        <section className="panel-card pathway-form-card">
          <div className="pathway-panel-head">
            <div>
              <span className="pathway-panel-kicker">현실 업데이트</span>
              <strong>실제로 일어난 일을 기록</strong>
            </div>
          </div>
          <textarea
            className="pathway-textarea pathway-textarea-large"
            value={stateForm.progress_summary}
            onChange={(event) => setStateForm((current) => ({ ...current, progress_summary: event.target.value }))}
            placeholder="지난 업데이트 이후 현실에서 무엇이 달라졌나요?"
          />
          <input
            className="pathway-input"
            value={stateForm.blockers}
            onChange={(event) => setStateForm((current) => ({ ...current, blockers: event.target.value }))}
            placeholder="현재 막히는 점"
          />
          <input
            className="pathway-input"
            value={stateForm.next_adjustment}
            onChange={(event) => setStateForm((current) => ({ ...current, next_adjustment: event.target.value }))}
            placeholder="다음 조정안"
          />
          <div className="pathway-input-row">
            <input
              className="pathway-input"
              value={stateForm.actual_time_spent}
              onChange={(event) => setStateForm((current) => ({ ...current, actual_time_spent: event.target.value }))}
              placeholder="사용 시간"
            />
            <input
              className="pathway-input"
              value={stateForm.actual_money_spent}
              onChange={(event) => setStateForm((current) => ({ ...current, actual_money_spent: event.target.value }))}
              placeholder="사용 금액"
            />
            <input
              className="pathway-input"
              value={stateForm.mood}
              onChange={(event) => setStateForm((current) => ({ ...current, mood: event.target.value }))}
              placeholder="컨디션"
            />
          </div>
          <button className="mini-action-button pathway-primary-button" onClick={handlePreviewStateUpdate} type="button" disabled={!activeGoalId || isBusy}>
            변경 미리보기
          </button>
        </section>

        <section className="panel-card pathway-list-card">
          <div className="pathway-panel-head">
            <div>
              <span className="pathway-panel-kicker">상태 타임라인</span>
              <strong>가장 최근 적응 로그</strong>
            </div>
          </div>
          <p className="pathway-panel-copy">
            {currentState?.state_summary ?? '아직 요약된 현재 상태가 없습니다. 현실 업데이트를 기록하면 그래프를 진화시킬 수 있습니다.'}
          </p>
          {stateUpdates.length === 0 ? (
            <EmptyState title="업데이트가 아직 없습니다" copy="현실 제약과 진행이 쌓일수록 그래프는 더 유용해집니다." />
          ) : (
            <ul className="pathway-detail-list">
              {stateUpdates.map((update) => (
                <li key={update.id}>
                  <strong>{update.update_date}</strong>
                  <span>{update.progress_summary}</span>
                  <p>{update.blockers || '기록된 장애 요소 없음'}</p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </section>
    );
  }

  return (
    <main className="app-shell">
      <div aria-hidden="true" className="window-drag-region" data-tauri-drag-region />
      <AppNav
        activeTab={workspaceTab}
        onSelectTab={(tab) => setWorkspaceTab(tab as WorkspaceTab)}
        renderIcon={(tab, active) => <NavIcon active={active} tab={tab as WorkspaceTab} />}
      />
      <section className={`workspace ${errorMessage ? 'workspace-has-error' : ''}`.trim()}>
        {errorMessage ? (
          <div className="error">
            <span>{errorMessage}</span>
          </div>
        ) : null}

        {workspaceTab === 'workflow' && renderWorkflowTab()}
        {workspaceTab === 'tasks' && renderTasksTab()}
        {workspaceTab === 'knowledge' && renderKnowledgeTab()}
        {workspaceTab === 'adaptation' && renderAdaptationTab()}
      </section>
    </main>
  );
}
