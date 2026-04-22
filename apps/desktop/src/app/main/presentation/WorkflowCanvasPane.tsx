import { useCallback, useEffect, useMemo, useRef, useState, type Dispatch, type KeyboardEvent as ReactKeyboardEvent, type MouseEvent as ReactMouseEvent, type ReactNode, type RefObject, type SetStateAction, type WheelEvent as ReactWheelEvent } from "react";
import { useI18n } from "../../../i18n";
import type { PmPlanningMode } from "../../../features/studio/pmPlanningMode";
import type { MarqueeSelection, NodeRunState, PendingWebTurn } from "../types";
import type { GraphNode, KnowledgeFileRef, NodeAnchorSide, NodeExecutionStatus } from "../../../features/workflow/types";
import type { TurnExecutor } from "../../../features/workflow/domain";
import type { WorkflowGraphViewMode } from "../../../features/workflow/viaGraph";
import WorkflowCanvasNodesLayer from "./WorkflowCanvasNodesLayer";
import WorkflowQuestionComposer from "./WorkflowQuestionComposer";

type EdgeLine = {
  key: string;
  edgeKey: string;
  readOnly?: boolean;
  path: string;
  startPoint: { x: number; y: number };
  endPoint: { x: number; y: number };
  previewChange?: string;
  previewReason?: string;
};

type WorkflowCanvasPaneProps = {
  canvasVariant?: "default" | "pathway";
  pathwayOverlayActions?: ReactNode;
  pathwayOverlayStats?: ReactNode;
  panMode: boolean;
  onCanvasKeyDown: (event: ReactKeyboardEvent<HTMLDivElement>) => void;
  onCanvasMouseDown: (event: ReactMouseEvent<HTMLDivElement>) => void;
  onCanvasMouseMove: (event: ReactMouseEvent<HTMLDivElement>) => void;
  onCanvasMouseUp: (event: ReactMouseEvent<HTMLDivElement>) => void;
  onCanvasWheel: (event: ReactWheelEvent<HTMLDivElement>) => void;
  graphCanvasRef: RefObject<HTMLDivElement | null>;
  onActivateWorkspacePanels: () => void;
  boundedStageWidth: number;
  boundedStageHeight: number;
  canvasZoom: number;
  graphViewMode: WorkflowGraphViewMode;
  stageInsetX: number;
  stageInsetY: number;
  stageInsetBottom: number;
  edgeLines: EdgeLine[];
  selectedEdgeKey: string;
  selectedEdgeNodeIdSet: Set<string>;
  setNodeSelection: (nodeIds: string[], focusedNodeId?: string) => void;
  setSelectedEdgeKey: (edgeKey: string) => void;
  onEdgeDragStart: (
    event: ReactMouseEvent<SVGPathElement | SVGCircleElement>,
    edgeKey: string,
    startPoint: { x: number; y: number },
    endPoint: { x: number; y: number },
  ) => void;
  connectPreviewLine: string | null;
  canvasNodes: GraphNode[];
  graphNodes: GraphNode[];
  nodeStates: Record<string, NodeRunState>;
  selectedNodeIds: string[];
  draggingNodeIds: string[];
  isConnectingDrag: boolean;
  questionDirectInputNodeIds: Set<string>;
  onNodeAnchorDragStart: (event: ReactMouseEvent<HTMLButtonElement>, nodeId: string, side: NodeAnchorSide) => void;
  onNodeAnchorDrop: (event: ReactMouseEvent<HTMLButtonElement>, nodeId: string, side: NodeAnchorSide) => void;
  onAssignSelectedEdgeAnchor: (nodeId: string, side: NodeAnchorSide) => boolean;
  isNodeDragAllowedTarget: (target: EventTarget | null) => boolean;
  onNodeDragStart: (event: ReactMouseEvent<HTMLDivElement>, nodeId: string) => void;
  nodeAnchorSides: readonly NodeAnchorSide[];
  collapsedPathwayNodeIds: Set<string>;
  onTogglePathwayBranch: (nodeId: string) => void;
  nodeCardSummary: (node: GraphNode) => string;
  turnModelLabel: (node: GraphNode) => string;
  turnRoleLabel: (node: GraphNode) => string;
  nodeTypeLabel: (type: GraphNode["type"]) => string;
  nodeStatusLabel: (status: NodeExecutionStatus) => string;
  deleteNode: (nodeId: string) => void;
  onOpenFeedFromNode: (nodeId: string) => void;
  onOpenWebInputForNode: (nodeId: string) => void;
  runtimeNowMs: number;
  formatNodeElapsedTime: (state: NodeRunState | undefined, nowMs: number) => string;
  openTerminalNodeId: string;
  onToggleNodeTerminal: (nodeId: string) => void;
  onSetPmPlanningMode: (nodeId: string, mode: PmPlanningMode) => void;
  expandedRoleNodeIds: string[];
  onToggleRoleInternalExpanded: (nodeId: string) => void;
  onAddRolePerspectivePass: (nodeId: string) => void;
  onAddRoleReviewPass: (nodeId: string) => void;
  marqueeSelection: MarqueeSelection | null;
  onCanvasZoomIn: () => void;
  onCanvasZoomOut: () => void;
  canvasFullscreen: boolean;
  setCanvasFullscreen: Dispatch<SetStateAction<boolean>>;
  setPanMode: Dispatch<SetStateAction<boolean>>;
  canRunGraphNow: boolean;
  onRunGraph: () => Promise<void>;
  isGraphRunning: boolean;
  onCancelGraphRun: () => Promise<void>;
  suspendedWebTurn: PendingWebTurn | null;
  pendingWebTurn: PendingWebTurn | null;
  onReopenPendingWebTurn: () => void;
  undoStackLength: number;
  redoStackLength: number;
  onUndoGraph: () => void;
  onRedoGraph: () => void;
  onClearGraph: () => void;
  canClearGraph: boolean;
  isWorkflowBusy: boolean;
  onApplyModelSelection: (selection: {
    modelValue: string;
    modelLabel: string;
    executor: TurnExecutor;
    turnModel?: string;
    reasoningLevel?: string;
  }) => void;
  agentTerminalIsland?: ReactNode;
  setWorkflowQuestion: (value: string) => void;
  workflowQuestion: string;
  questionInputRef: RefObject<HTMLTextAreaElement | null>;
  attachedFiles: KnowledgeFileRef[];
  onOpenKnowledgeFilePicker: () => void;
  onRemoveKnowledgeFile: (fileId: string) => void;
};

type WorkflowConversationMessage = {
  id: string;
  role: "user" | "agent";
  text: string;
};

export default function WorkflowCanvasPane({
  canvasVariant = "default",
  pathwayOverlayActions,
  pathwayOverlayStats,
  panMode,
  onCanvasKeyDown,
  onCanvasMouseDown,
  onCanvasMouseMove,
  onCanvasMouseUp,
  onCanvasWheel,
  graphCanvasRef,
  onActivateWorkspacePanels,
  boundedStageWidth,
  boundedStageHeight,
  canvasZoom,
  graphViewMode,
  stageInsetX,
  stageInsetY,
  stageInsetBottom,
  edgeLines,
  selectedEdgeKey,
  selectedEdgeNodeIdSet,
  setNodeSelection,
  setSelectedEdgeKey,
  onEdgeDragStart,
  connectPreviewLine,
  canvasNodes,
  graphNodes,
  nodeStates,
  selectedNodeIds,
  draggingNodeIds,
  isConnectingDrag,
  questionDirectInputNodeIds,
  onNodeAnchorDragStart,
  onNodeAnchorDrop,
  onAssignSelectedEdgeAnchor,
  isNodeDragAllowedTarget,
  onNodeDragStart,
  nodeAnchorSides,
  collapsedPathwayNodeIds,
  onTogglePathwayBranch,
  nodeCardSummary,
  turnModelLabel,
  turnRoleLabel,
  nodeTypeLabel,
  nodeStatusLabel,
  deleteNode,
  onOpenFeedFromNode,
  onOpenWebInputForNode,
  runtimeNowMs,
  formatNodeElapsedTime,
  openTerminalNodeId,
  onToggleNodeTerminal,
  onSetPmPlanningMode,
  expandedRoleNodeIds,
  onToggleRoleInternalExpanded,
  onAddRolePerspectivePass,
  onAddRoleReviewPass,
  marqueeSelection,
  onCanvasZoomIn,
  onCanvasZoomOut,
  canvasFullscreen,
  setCanvasFullscreen,
  setPanMode,
  canRunGraphNow,
  onRunGraph,
  isGraphRunning,
  onCancelGraphRun,
  suspendedWebTurn,
  pendingWebTurn,
  onReopenPendingWebTurn,
  undoStackLength,
  redoStackLength,
  onUndoGraph,
  onRedoGraph,
  onClearGraph,
  canClearGraph,
  isWorkflowBusy,
  onApplyModelSelection,
  agentTerminalIsland,
  setWorkflowQuestion,
  workflowQuestion,
  questionInputRef,
  attachedFiles,
  onOpenKnowledgeFilePicker,
  onRemoveKnowledgeFile,
}: WorkflowCanvasPaneProps) {
  const { t } = useI18n();
  const [, setConversationByNodeId] = useState<Record<string, WorkflowConversationMessage[]>>({});
  const nodeLogCursorRef = useRef<Record<string, number>>({});

  const canvasNodeById = useMemo(() => {
    const next = new Map<string, GraphNode>();
    canvasNodes.forEach((node) => next.set(node.id, node));
    return next;
  }, [canvasNodes]);

  const selectedConversationNode = useMemo(() => {
    for (const nodeId of selectedNodeIds) {
      const node = canvasNodeById.get(nodeId);
      if (node?.type === "turn") {
        return node;
      }
    }
    return null;
  }, [canvasNodeById, selectedNodeIds]);

  const selectedConversationNodeId = selectedConversationNode?.id ?? "";

  useEffect(() => {
    setConversationByNodeId((prev) => {
      let changed = false;
      let next = prev;
      for (const [nodeId, nodeState] of Object.entries(nodeStates)) {
        const logs = nodeState.logs ?? [];
        const previousCursor = nodeLogCursorRef.current[nodeId] ?? 0;
        const normalizedCursor = logs.length < previousCursor ? 0 : previousCursor;
        if (logs.length <= normalizedCursor) {
          nodeLogCursorRef.current[nodeId] = logs.length;
          continue;
        }
        const appended: WorkflowConversationMessage[] = logs
          .slice(normalizedCursor)
          .map((log, index) => ({
            id: `${nodeId}-agent-${normalizedCursor + index}-${Date.now()}`,
            role: "agent" as const,
            text: String(log ?? "").replace(/\s+/g, " ").trim(),
          }))
          .filter((item) => item.text.length > 0);
        nodeLogCursorRef.current[nodeId] = logs.length;
        if (appended.length === 0) {
          continue;
        }
        if (next === prev) {
          next = { ...prev };
        }
        const existing = next[nodeId] ?? [];
        next[nodeId] = [...existing, ...appended].slice(-120);
        changed = true;
      }
      return changed ? next : prev;
    });
  }, [nodeStates]);

  const onSubmitConversationMessage = useCallback(
    (nodeId: string, message: string) => {
      const trimmed = String(message ?? "").trim();
      const normalizedNodeId = String(nodeId ?? "").trim();
      if (!trimmed || !normalizedNodeId) {
        return;
      }
      setConversationByNodeId((prev) => {
        const next = { ...prev };
        const existing = next[normalizedNodeId] ?? [];
        const nextMessage: WorkflowConversationMessage = {
          id: `${normalizedNodeId}-user-${Date.now()}`,
          role: "user",
          text: trimmed,
        };
        next[normalizedNodeId] = [
          ...existing,
          nextMessage,
        ].slice(-120);
        return next;
      });
    },
    [],
  );

  return (
    <section className={`canvas-pane canvas-pane-${canvasVariant}`}>
      <div className="canvas-main-row">
        <div className={`graph-canvas-shell graph-canvas-shell-${canvasVariant}`}>
          <div
            className={`graph-canvas graph-canvas-${canvasVariant} ${panMode ? "pan-mode" : ""}`.trim()}
            onKeyDown={onCanvasKeyDown}
            onMouseDown={(event) => {
              event.currentTarget.focus();
              onActivateWorkspacePanels();
              onCanvasMouseDown(event);
            }}
            onMouseMove={onCanvasMouseMove}
            onMouseUp={onCanvasMouseUp}
            onWheel={onCanvasWheel}
            ref={graphCanvasRef}
            tabIndex={0}
          >
            <div
              className="graph-stage-shell"
              style={{
                width: Math.max(Math.round(boundedStageWidth * canvasZoom + stageInsetX * 2), 360),
                height: Math.max(Math.round(boundedStageHeight * canvasZoom + stageInsetY + stageInsetBottom), 260),
              }}
            >
              <div
                className="graph-stage"
                style={{
                  left: stageInsetX,
                  top: stageInsetY,
                  transform: `scale(${canvasZoom})`,
                  width: boundedStageWidth,
                  height: boundedStageHeight,
                }}
              >
                <svg className="edge-layer" overflow="visible">
                  <defs>
                    <marker id="edge-arrow" markerHeight="7" markerUnits="userSpaceOnUse" markerWidth="7" orient="auto" refX="6" refY="3.5">
                      <path d="M0 0 L7 3.5 L0 7 Z" fill="#70848a" />
                    </marker>
                    <marker id="edge-arrow-readonly" markerHeight="7" markerUnits="userSpaceOnUse" markerWidth="7" orient="auto" refX="6" refY="3.5">
                      <path d="M0 0 L7 3.5 L0 7 Z" fill="#c07a2f" />
                    </marker>
                    <marker id="edge-arrow-preview-added" markerHeight="7" markerUnits="userSpaceOnUse" markerWidth="7" orient="auto" refX="6" refY="3.5">
                      <path d="M0 0 L7 3.5 L0 7 Z" fill="#2d9960" />
                    </marker>
                    <marker id="edge-arrow-preview-warning" markerHeight="7" markerUnits="userSpaceOnUse" markerWidth="7" orient="auto" refX="6" refY="3.5">
                      <path d="M0 0 L7 3.5 L0 7 Z" fill="#c77a29" />
                    </marker>
                    <marker id="edge-arrow-preview-removed" markerHeight="7" markerUnits="userSpaceOnUse" markerWidth="7" orient="auto" refX="6" refY="3.5">
                      <path d="M0 0 L7 3.5 L0 7 Z" fill="#8c6ccf" />
                    </marker>
                  </defs>
                  {edgeLines.map((line) => (
                    <g key={line.key}>
                      {line.previewReason ? <title>{line.previewReason}</title> : null}
                      {!line.readOnly && (
                        <path
                          className="edge-path-hit"
                          d={line.path}
                          fill="none"
                          onClick={(e) => {
                            e.stopPropagation();
                            setNodeSelection([]);
                            setSelectedEdgeKey(line.edgeKey);
                          }}
                          onMouseDown={(e) => onEdgeDragStart(e, line.edgeKey, line.startPoint, line.endPoint)}
                          pointerEvents="stroke"
                          stroke="transparent"
                          strokeWidth={18}
                        />
                      )}
                      <path
                        className={`${selectedEdgeKey === line.edgeKey ? "edge-path selected" : "edge-path"} ${
                          line.readOnly ? "readonly" : ""
                        }`.trim()}
                        d={line.path}
                        fill="none"
                        markerEnd={
                          line.previewChange === "added"
                            ? "url(#edge-arrow-preview-added)"
                            : line.previewChange === "removed"
                              ? "url(#edge-arrow-preview-removed)"
                              : line.previewChange === "updated"
                                ? "url(#edge-arrow-preview-warning)"
                                : line.readOnly
                                  ? "url(#edge-arrow-readonly)"
                                  : "url(#edge-arrow)"
                        }
                        pointerEvents="none"
                        stroke={
                          line.previewChange === "added"
                            ? "#2d9960"
                            : line.previewChange === "removed"
                              ? "#8c6ccf"
                              : line.previewChange === "updated"
                                ? "#c77a29"
                                : line.readOnly
                                  ? "#c07a2f"
                                  : selectedEdgeKey === line.edgeKey
                                    ? "#4f83ff"
                                    : "#4f6271"
                        }
                        strokeDasharray={
                          line.previewChange === "removed"
                            ? "10 6"
                            : line.previewChange === "updated" || line.readOnly
                              ? "7 4"
                              : undefined
                        }
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={
                          line.previewChange === "added"
                            ? 2.5
                            : selectedEdgeKey === line.edgeKey
                              ? 3
                              : 2
                        }
                      />
                      {line.previewChange === "removed" ? (
                        <text
                          className="edge-preview-x"
                          x={(line.startPoint.x + line.endPoint.x) / 2}
                          y={(line.startPoint.y + line.endPoint.y) / 2 - 10}
                          textAnchor="middle"
                        >
                          X
                        </text>
                      ) : null}
                      {!line.readOnly && (
                        <circle
                          className="edge-arrow-handle"
                          cx={line.endPoint.x}
                          cy={line.endPoint.y}
                          fill="transparent"
                          onClick={(e) => {
                            e.stopPropagation();
                            setNodeSelection([]);
                            setSelectedEdgeKey(line.edgeKey);
                          }}
                          onMouseDown={(e) => onEdgeDragStart(e, line.edgeKey, line.startPoint, line.endPoint)}
                          r={12}
                        />
                      )}
                    </g>
                  ))}
                  {connectPreviewLine && (
                    <path
                      d={connectPreviewLine}
                      fill="none"
                      pointerEvents="none"
                      stroke="#5b8cff"
                      strokeDasharray="5 4"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                    />
                  )}
                </svg>

        <WorkflowCanvasNodesLayer
          canvasNodes={canvasNodes}
          graphNodes={graphNodes}
          graphViewMode={graphViewMode}
                  draggingNodeIds={draggingNodeIds}
                  formatNodeElapsedTime={formatNodeElapsedTime}
                  isConnectingDrag={isConnectingDrag}
                  isNodeDragAllowedTarget={isNodeDragAllowedTarget}
                  marqueeSelection={marqueeSelection}
                  nodeAnchorSides={nodeAnchorSides}
                  collapsedPathwayNodeIds={collapsedPathwayNodeIds}
                  nodeCardSummary={nodeCardSummary}
                  nodeStates={nodeStates}
                  nodeStatusLabel={nodeStatusLabel}
                  nodeTypeLabel={nodeTypeLabel}
                  onAssignSelectedEdgeAnchor={onAssignSelectedEdgeAnchor}
                  onNodeAnchorDragStart={onNodeAnchorDragStart}
                  onNodeAnchorDrop={onNodeAnchorDrop}
                  onNodeDragStart={onNodeDragStart}
                  onTogglePathwayBranch={onTogglePathwayBranch}
                  onOpenFeedFromNode={onOpenFeedFromNode}
                  onOpenWebInputForNode={onOpenWebInputForNode}
                  openTerminalNodeId={openTerminalNodeId}
                  onToggleNodeTerminal={onToggleNodeTerminal}
                  onSetPmPlanningMode={onSetPmPlanningMode}
                  expandedRoleNodeIds={expandedRoleNodeIds}
                  onToggleRoleInternalExpanded={onToggleRoleInternalExpanded}
                  onAddRolePerspectivePass={onAddRolePerspectivePass}
                  onAddRoleReviewPass={onAddRoleReviewPass}
                  questionDirectInputNodeIds={questionDirectInputNodeIds}
                  runtimeNowMs={runtimeNowMs}
                  selectedEdgeKey={selectedEdgeKey}
                  selectedEdgeNodeIdSet={selectedEdgeNodeIdSet}
                  selectedNodeIds={selectedNodeIds}
                  setNodeSelection={setNodeSelection}
                  setSelectedEdgeKey={setSelectedEdgeKey}
                  turnModelLabel={turnModelLabel}
                  turnRoleLabel={turnRoleLabel}
                  deleteNode={deleteNode}
                />
              </div>
            </div>
          </div>

          <div className={`canvas-overlay canvas-overlay-${canvasVariant}`}>
            {canvasVariant === "pathway" && pathwayOverlayStats ? (
              <div className="pathway-canvas-stats-overlay">{pathwayOverlayStats}</div>
            ) : null}

            <div className="canvas-zoom-controls">
              <div className="canvas-zoom-group">
                <button onClick={onCanvasZoomIn} title={t("workflow.canvas.zoomIn")} type="button"><img alt="" aria-hidden="true" className="canvas-control-icon is-plus" src="/pathway-plus.svg" /></button>
                <button onClick={onCanvasZoomOut} title={t("workflow.canvas.zoomOut")} type="button"><img alt="" aria-hidden="true" className="canvas-control-icon is-minus" src="/pathway-minus.svg" /></button>
              </div>
              <button
                aria-label={t("workflow.canvas.move")}
                className={`canvas-zoom-single ${panMode ? "is-active" : ""}`.trim()}
                onClick={() => setPanMode((prev) => !prev)}
                title={t("workflow.canvas.moveCanvas")}
                type="button"
              >
                <img alt="" aria-hidden="true" className="canvas-control-icon is-move" src="/icon-move.svg" />
              </button>
              <button
                className="canvas-zoom-single"
                onClick={() => setCanvasFullscreen((prev) => !prev)}
                title={canvasFullscreen ? t("workflow.canvas.defaultView") : t("workflow.canvas.fullView")}
                type="button"
              >
                <img alt="" aria-hidden="true" className="canvas-control-icon is-fullscreen" src="/canvas-fullscreen.svg" />
              </button>
            </div>

            {canvasVariant === "pathway" && pathwayOverlayActions ? (
              <div className="pathway-canvas-actions-overlay">{pathwayOverlayActions}</div>
            ) : null}

            {canvasVariant !== "pathway" ? (
              <div className="canvas-runbar">
                <button aria-label={t("workflow.canvas.run")} className={`canvas-icon-btn play ${canRunGraphNow ? "is-ready" : "is-disabled"}`} disabled={!canRunGraphNow} onClick={() => void onRunGraph()} title={t("workflow.canvas.run")} type="button">
                  <img alt="" aria-hidden="true" className="canvas-icon-image" src="/canvas-play.svg" />
                </button>
                <button aria-label={t("workflow.canvas.stop")} className="canvas-icon-btn stop" disabled={!isGraphRunning} onClick={() => void onCancelGraphRun()} title={t("workflow.canvas.stop")} type="button">
                  <img alt="" aria-hidden="true" className="canvas-icon-image" src="/canvas-stop.svg" />
                </button>
                {suspendedWebTurn && !pendingWebTurn && isGraphRunning && (
                  <button aria-label={t("workflow.canvas.reopenWebInput")} className="canvas-web-turn-reopen" onClick={onReopenPendingWebTurn} title={t("workflow.canvas.reopenWebInputWindow")} type="button">WEB</button>
                )}
                <button aria-label={t("workflow.canvas.undo")} className="canvas-icon-btn" disabled={undoStackLength === 0} onClick={onUndoGraph} title={t("workflow.canvas.undo")} type="button">
                  <img alt="" aria-hidden="true" className="canvas-icon-image" src="/canvas-undo.svg" />
                </button>
                <button aria-label={t("workflow.canvas.redo")} className="canvas-icon-btn" disabled={redoStackLength === 0} onClick={onRedoGraph} title={t("workflow.canvas.redo")} type="button">
                  <img alt="" aria-hidden="true" className="canvas-icon-image" src="/canvas-replay.svg" />
                </button>
                <button aria-label={t("workflow.canvas.clear")} className="canvas-icon-btn" disabled={!canClearGraph} onClick={onClearGraph} title={t("workflow.canvas.clear")} type="button">
                  <img alt="" aria-hidden="true" className="canvas-icon-image canvas-icon-image-clear" src="/clear.svg" />
                </button>
              </div>
            ) : null}
          </div>
        </div>

        {agentTerminalIsland}
      </div>

      {canvasVariant !== "pathway" ? (
        <div className="canvas-topbar">
          <WorkflowQuestionComposer
            attachedFiles={attachedFiles}
            canRunGraphNow={canRunGraphNow}
            isWorkflowBusy={isWorkflowBusy}
            onApplyModelSelection={onApplyModelSelection}
            onOpenKnowledgeFilePicker={onOpenKnowledgeFilePicker}
            onRemoveKnowledgeFile={onRemoveKnowledgeFile}
            onRunGraph={onRunGraph}
            onSubmitMessage={(message) => {
              if (!selectedConversationNodeId) {
                return;
              }
              onSubmitConversationMessage(selectedConversationNodeId, message);
            }}
            questionInputRef={questionInputRef}
            setWorkflowQuestion={setWorkflowQuestion}
            workflowQuestion={workflowQuestion}
          />
        </div>
      ) : null}
    </section>
  );
}
