import type { Dispatch, ReactNode, SetStateAction } from 'react';

import PathwayRailCanvas from './PathwayRailCanvas';
import {
  evidenceReliabilityLabel,
} from './pathwayWorkspaceUtils';
import type {
  AssumptionItem,
  CurrentStateSnapshot,
  EvidenceItem,
  GoalAnalysisRecord,
  GraphBundle,
  GraphNodeRecord,
  RevisionProposalRecord,
  RouteSelectionRecord,
  StateUpdateRecord,
} from '../lib/types';

export type PathwayStateForm = {
  progress_summary: string;
  blockers: string;
  next_adjustment: string;
  actual_time_spent: string;
  actual_money_spent: string;
  mood: string;
};

type NodeActionGuidance = {
  title: string;
  steps: string[];
  note: string;
};

type ProgressUpdateSummary = {
  update: StateUpdateRecord;
  matchedNodes: GraphNodeRecord[];
};

type PreviewNodeChange = RevisionProposalRecord['diff']['node_changes'][number];

type PathwayWorkflowPanelProps = {
  activeGoalId: string | null;
  activeGoalTitle: string | null;
  activeMapExists: boolean;
  activeProgressNodeIds: Set<string>;
  currentState: CurrentStateSnapshot | null;
  displayBaseBundle: GraphBundle | undefined;
  displayBundle: GraphBundle | undefined;
  effectiveSelectedNodeId: string | null;
  goalAnalysis: GoalAnalysisRecord | null;
  isBusy: boolean;
  progressUpdateSummaries: ProgressUpdateSummary[];
  researchPlanCollectionStatus: string;
  revisionPreview: RevisionProposalRecord | null;
  routeSelection: RouteSelectionRecord | null;
  selectedAssumptions: AssumptionItem[];
  selectedContentEvidence: EvidenceItem[];
  selectedNode: GraphNodeRecord | null;
  selectedNodeActionGuidance: NodeActionGuidance | null;
  selectedNodePreviewChange: PreviewNodeChange | null;
  showStateUpdatePanel: boolean;
  showWorkflowInspector: boolean;
  stateForm: PathwayStateForm;
  stateUpdates: StateUpdateRecord[];
  statusMessage: string;
  workflowCanvasFullscreen: boolean;
  onAcceptRevisionPreview: () => void;
  onDismissRevisionPreview: () => void;
  onGeneratePathway: () => void;
  onPreviewStateUpdate: () => void;
  onSelectNode: (nodeId: string) => void;
  setShowStateUpdatePanel: Dispatch<SetStateAction<boolean>>;
  setShowWorkflowInspector: Dispatch<SetStateAction<boolean>>;
  setStateForm: Dispatch<SetStateAction<PathwayStateForm>>;
  setWorkflowCanvasFullscreen: Dispatch<SetStateAction<boolean>>;
};

function EmptyState({
  title,
  copy,
  action,
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

export default function PathwayWorkflowPanel({
  activeGoalId,
  activeGoalTitle,
  activeMapExists,
  activeProgressNodeIds,
  currentState,
  displayBaseBundle,
  displayBundle,
  effectiveSelectedNodeId,
  goalAnalysis,
  isBusy,
  progressUpdateSummaries,
  researchPlanCollectionStatus,
  revisionPreview,
  routeSelection,
  selectedAssumptions,
  selectedContentEvidence,
  selectedNode,
  selectedNodeActionGuidance,
  selectedNodePreviewChange,
  showStateUpdatePanel,
  showWorkflowInspector,
  stateForm,
  stateUpdates,
  statusMessage,
  workflowCanvasFullscreen,
  onAcceptRevisionPreview,
  onDismissRevisionPreview,
  onGeneratePathway,
  onPreviewStateUpdate,
  onSelectNode,
  setShowStateUpdatePanel,
  setShowWorkflowInspector,
  setStateForm,
  setWorkflowCanvasFullscreen,
}: PathwayWorkflowPanelProps) {
  const hasSidebarContent =
    Boolean(selectedNode) ||
    Boolean(goalAnalysis) ||
    Boolean(routeSelection) ||
    Boolean(currentState) ||
    stateUpdates.length > 0 ||
    activeMapExists;
  const shouldShowInspector = showWorkflowInspector && hasSidebarContent;
  const previewNodeChanges = revisionPreview?.diff.node_changes ?? [];
  const previewEdgeChanges = revisionPreview?.diff.edge_changes ?? [];
  const updateDraftReady = stateForm.progress_summary.trim().length > 0;
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
        aria-label={showWorkflowInspector ? '인스펙터 숨기기' : '인스펙터 보기'}
        className={`pathway-canvas-icon-button ${showWorkflowInspector ? 'is-active' : ''}`.trim()}
        onClick={() => setShowWorkflowInspector((current) => !current)}
        title={showWorkflowInspector ? '인스펙터 숨기기' : '인스펙터 보기'}
        type="button"
      >
        <img alt="" aria-hidden="true" className="canvas-control-icon" src="/icon-inspector-panel.svg" />
        <span className="sr-only">{showWorkflowInspector ? '인스펙터 숨기기' : '인스펙터 보기'}</span>
      </button>
      <button
        aria-label={showStateUpdatePanel ? '업데이트 입력 닫기' : '업데이트 입력 열기'}
        className={`pathway-canvas-icon-button ${showStateUpdatePanel ? 'is-active' : ''}`.trim()}
        disabled={!activeGoalId || isBusy}
        onClick={() => setShowStateUpdatePanel((current) => !current)}
        title={showStateUpdatePanel ? '업데이트 입력 닫기' : '업데이트 입력 열기'}
        type="button"
      >
        <img alt="" aria-hidden="true" className="canvas-control-icon" src="/icon-magic-stick.svg" />
        <span className="sr-only">{showStateUpdatePanel ? '업데이트 입력 닫기' : '업데이트 입력 열기'}</span>
      </button>
      <button
        aria-label="루트 생성"
        className="pathway-canvas-icon-button pathway-canvas-icon-button-primary"
        disabled={!activeGoalId || isBusy}
        onClick={onGeneratePathway}
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
                      <button className="mini-action-button pathway-primary-button" onClick={onAcceptRevisionPreview} type="button" disabled={isBusy}>
                        미리보기 적용
                      </button>
                      <button className="mini-action-button" onClick={onDismissRevisionPreview} type="button" disabled={isBusy}>
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
                  onSelectNode={onSelectNode}
                />
                {displayBundle && showStateUpdatePanel ? (
                  <section className="pathway-request-panel pathway-canvas-update-floater">
                    <div className="pathway-request-head">
                      <div>
                        <span className="pathway-panel-kicker">업데이트</span>
                        <strong>GOAL을 위해 실제로 한 일을 적으면 그래프가 바로 반영됩니다</strong>
                        <p className="pathway-panel-copy">
                          추가된/변경된 사항을 입력하면 다음 리비전이 기존 그래프를 보존한 채 이어서 붙습니다.
                        </p>
                      </div>
                      {revisionPreview ? null : (
                        <button
                          className="mini-action-button pathway-primary-button"
                          disabled={!activeGoalId || isBusy || !updateDraftReady}
                          onClick={onPreviewStateUpdate}
                          type="button"
                        >
                          전송
                        </button>
                      )}
                    </div>

                    <textarea
                      className="pathway-textarea pathway-request-textarea"
                      value={stateForm.progress_summary}
                      onChange={(event) => setStateForm((current) => ({ ...current, progress_summary: event.target.value }))}
                      onKeyDown={(event) => {
                        if (event.key !== 'Enter' || event.shiftKey) {
                          return;
                        }
                        event.preventDefault();
                        if (updateDraftReady && !isBusy && !revisionPreview) {
                          onPreviewStateUpdate();
                        }
                      }}
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
                      <button className="mini-action-button pathway-primary-button" onClick={onGeneratePathway} type="button" disabled={isBusy}>
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
                  <span className="pathway-panel-kicker">선택한 노드</span>
                  <strong>{selectedNode?.label ?? activeGoalTitle ?? '현재 워크스페이스'}</strong>
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
                {!selectedNode && progressUpdateSummaries.length > 0 ? (
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
                                  onClick={() => onSelectNode(node.id)}
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
                    <span className="pathway-panel-kicker">실행 패널</span>
                    <strong>{selectedNode.label}</strong>

                    {selectedNodeActionGuidance ? (
                      <section className="pathway-inspector-section pathway-node-action-guide">
                        <span className="pathway-panel-kicker">지금 할 일</span>
                        <strong>{selectedNodeActionGuidance.title}</strong>
                        <ol className="pathway-action-list">
                          {selectedNodeActionGuidance.steps.map((step, index) => (
                            <li key={`${selectedNode.id}:action:${index}`}>{step}</li>
                          ))}
                        </ol>
                        <p className="pathway-panel-copy">{selectedNodeActionGuidance.note}</p>
                      </section>
                    ) : null}

                    {selectedNode.summary ? (
                      <section className="pathway-inspector-section">
                        <span className="pathway-panel-kicker">왜 이 노드가 있나</span>
                        <p className="pathway-panel-copy">{selectedNode.summary}</p>
                      </section>
                    ) : null}

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
                      <span className="pathway-panel-kicker">근거</span>
                      {selectedContentEvidence.length === 0 ? (
                        <p className="pathway-panel-copy">수집된 원문 근거가 아직 없습니다. 실행 판단에 쓰려면 먼저 근거를 붙이거나 이 노드를 보강해야 합니다.</p>
                      ) : (
                        <ul className="pathway-detail-list">
                          {selectedContentEvidence.slice(0, 4).map((item) => (
                            <li className="pathway-evidence-item" key={item.id}>
                              <em className="pathway-evidence-badge">{evidenceReliabilityLabel(item)}</em>
                              <strong>{item.title}</strong>
                              <span>{item.quote_or_summary}</span>
                              {item.ranking_reason || item.query_labels?.length ? (
                                <p>
                                  랭킹: {item.ranking_reason ?? item.query_labels?.join(', ')}
                                </p>
                              ) : null}
                              {item.url ? <p>{item.url}</p> : null}
                            </li>
                          ))}
                        </ul>
                      )}
                    </section>

                    {selectedAssumptions.length > 0 ? (
                      <section className="pathway-inspector-section">
                        <span className="pathway-panel-kicker">성립을 전제로 둔 가정</span>
                        <ul className="pathway-detail-list">
                          {selectedAssumptions.map((item) => (
                            <li key={item.id}>
                              <strong>{item.text}</strong>
                              <p>{item.risk_if_false}</p>
                            </li>
                          ))}
                        </ul>
                      </section>
                    ) : null}
                  </section>
                ) : null}

                {!selectedNode && goalAnalysis ? (
                  <section className="pathway-workflow-sidebar-card">
                    <span className="pathway-panel-kicker">자원 모델</span>
                    <strong>{goalAnalysis.resource_dimensions.length}개 자원 축 로드됨</strong>
                    <p className="pathway-panel-copy">{goalAnalysis.analysis_summary}</p>
                  </section>
                ) : null}

                {!selectedNode && goalAnalysis?.followup_questions?.length ? (
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

                {!selectedNode && researchPlanCollectionStatus ? (
                  <section className="pathway-workflow-sidebar-card">
                    <span className="pathway-panel-kicker">자동 수집 상태</span>
                    <p className="pathway-panel-copy pathway-collector-status">
                      {researchPlanCollectionStatus}
                    </p>
                  </section>
                ) : null}

                {!selectedNode && (routeSelection || currentState || stateUpdates.length > 0) ? (
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
