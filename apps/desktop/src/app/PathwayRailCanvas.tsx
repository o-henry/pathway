import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type WheelEvent as ReactWheelEvent,
} from "react";

import WorkflowCanvasPane from "./main/presentation/WorkflowCanvasPane";
import { buildCanvasEdgeLines, NODE_HEIGHT, NODE_WIDTH, nodeCardSummary, turnModelLabel } from "../features/workflow/graph-utils";
import { nodeStatusLabel, nodeTypeLabel, turnRoleLabel } from "../features/workflow/labels";
import type { GraphData, GraphEdge, GraphNode, NodeAnchorSide } from "../features/workflow/types";
import type { DragState, MarqueeSelection, NodeRunState } from "./main/types";
import type { GraphBundle, GraphEdgeRecord, GraphNodeRecord, GraphNodeTypeDefinition } from "../lib/types";

type LayoutNode = {
  node: GraphNodeRecord;
  x: number;
  y: number;
  depth: number;
  childCount: number;
  width: number;
  height: number;
};

type PathwayTone = "sky" | "iris" | "mist";

function hashString(value: string): number {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash;
}

function nodeSemanticFamily(definition: GraphNodeTypeDefinition | undefined, node: GraphNodeRecord): string {
  const value = `${definition?.id ?? ""} ${definition?.label ?? ""} ${node.type} ${node.label}`.toLowerCase();
  if (value.includes("risk") || value.includes("warning")) {
    return "risk";
  }
  if (value.includes("resource") || value.includes("asset") || value.includes("capital")) {
    return "resource";
  }
  if (value.includes("decision") || value.includes("branch") || value.includes("gate")) {
    return "decision";
  }
  if (value.includes("evidence") || value.includes("signal") || value.includes("research")) {
    return "evidence";
  }
  if (value.includes("constraint") || value.includes("blocker") || value.includes("limit")) {
    return "constraint";
  }
  return "route";
}

function toneForFamily(family: string, node: GraphNodeRecord): PathwayTone {
  const fallbackTones: PathwayTone[] = ["sky", "iris", "mist"];
  if (family === "decision") {
    return "iris";
  }
  if (family === "evidence") {
    return "sky";
  }
  if (family === "resource" || family === "constraint" || family === "risk") {
    return "mist";
  }
  return fallbackTones[hashString(`${node.type}:${node.label}`) % fallbackTones.length] ?? "sky";
}

function familyBias(family: string): number {
  if (family === "resource" || family === "evidence") {
    return -14;
  }
  if (family === "risk" || family === "constraint") {
    return 14;
  }
  return 0;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function measurePathwayNode(node: GraphNodeRecord, depth: number, childCount: number): { width: number; height: number } {
  const textLength = node.label.trim().length;
  const isRoot = depth === 0;
  const baseWidth = isRoot ? 128 : childCount > 0 ? 156 : 170;
  const widthPerCharacter = isRoot ? 8.6 : 7.9;
  const minWidth = isRoot ? 188 : childCount > 0 ? 184 : 196;
  const maxWidth = isRoot ? 248 : childCount > 0 ? 278 : 312;
  const measuredWidth = clamp(Math.round(baseWidth + textLength * widthPerCharacter), minWidth, maxWidth);
  const height = isRoot ? 56 : textLength > 34 ? 58 : 48;
  return { width: measuredWidth, height };
}

function buildLayout(bundle: GraphBundle): { nodes: LayoutNode[]; width: number; height: number } {
  const progressionTypeIds = new Set(
    bundle.ontology.edge_types.filter((item) => item.role === "progression").map((item) => item.id),
  );
  const progressionEdges = bundle.edges.filter((edge) => progressionTypeIds.has(edge.type));
  const nodeTypeById = new Map(bundle.ontology.node_types.map((item) => [item.id, item]));
  const incoming = new Map<string, number>();
  const parents = new Map<string, string[]>();
  const outgoing = new Map<string, string[]>();

  bundle.nodes.forEach((node) => {
    incoming.set(node.id, 0);
    parents.set(node.id, []);
    outgoing.set(node.id, []);
  });

  progressionEdges.forEach((edge) => {
    incoming.set(edge.target, (incoming.get(edge.target) ?? 0) + 1);
    parents.get(edge.target)?.push(edge.source);
    outgoing.get(edge.source)?.push(edge.target);
  });

  const roots = bundle.nodes
    .filter((node) => (incoming.get(node.id) ?? 0) === 0)
    .sort((left, right) => left.label.localeCompare(right.label));
  const queue = roots.length > 0 ? roots.map((node) => node.id) : bundle.nodes.slice(0, 1).map((node) => node.id);
  const depth = new Map<string, number>();
  queue.forEach((id) => depth.set(id, 0));

  while (queue.length > 0) {
    const current = queue.shift() as string;
    const currentDepth = depth.get(current) ?? 0;
    for (const target of outgoing.get(current) ?? []) {
      const nextDepth = currentDepth + 1;
      if (!depth.has(target) || nextDepth > (depth.get(target) ?? 0)) {
        depth.set(target, nextDepth);
      }
      queue.push(target);
    }
  }

  const positioned: LayoutNode[] = [];
  const positionedY = new Map<string, number>();
  const laneDepths = [...new Set(bundle.nodes.map((node) => depth.get(node.id) ?? 0))].sort((a, b) => a - b);
  const rootBaseY = 172;
  const rootGap = 202;
  const horizontalGap = 274;
  const siblingGap = 122;
  const lanePaddingBottom = 228;

  roots.forEach((node, index) => {
    positionedY.set(node.id, rootBaseY + index * rootGap);
  });

  const maxDepth = laneDepths.at(-1) ?? 0;
  for (let laneDepth = 1; laneDepth <= maxDepth; laneDepth += 1) {
    const laneNodes = bundle.nodes
      .filter((node) => (depth.get(node.id) ?? 0) === laneDepth)
      .sort((left, right) => {
        const leftParents = parents.get(left.id) ?? [];
        const rightParents = parents.get(right.id) ?? [];
        const leftAnchor = leftParents.map((parentId) => positionedY.get(parentId) ?? rootBaseY).reduce((sum, value) => sum + value, 0) / Math.max(leftParents.length, 1);
        const rightAnchor = rightParents.map((parentId) => positionedY.get(parentId) ?? rootBaseY).reduce((sum, value) => sum + value, 0) / Math.max(rightParents.length, 1);
        if (leftAnchor !== rightAnchor) {
          return leftAnchor - rightAnchor;
        }
        return left.label.localeCompare(right.label);
      });

    laneNodes.forEach((node) => {
      const parentIds = parents.get(node.id) ?? [];
      const parentAnchors = parentIds.map((parentId) => positionedY.get(parentId) ?? rootBaseY);
      const averagedAnchor =
        parentAnchors.length > 0 ? parentAnchors.reduce((sum, value) => sum + value, 0) / parentAnchors.length : rootBaseY + laneDepth * 120;
      const primaryParentId = parentIds[0] ?? "";
      const siblingIds = primaryParentId
        ? (outgoing.get(primaryParentId) ?? [])
            .filter((candidateId) => (depth.get(candidateId) ?? 0) === laneDepth)
            .sort((leftId, rightId) => {
              const leftNode = bundle.nodes.find((candidate) => candidate.id === leftId);
              const rightNode = bundle.nodes.find((candidate) => candidate.id === rightId);
              return (leftNode?.label ?? leftId).localeCompare(rightNode?.label ?? rightId);
            })
        : [];
      const siblingIndex = Math.max(siblingIds.indexOf(node.id), 0);
      const siblingOffset = siblingIds.length > 0
        ? (siblingIndex - (siblingIds.length - 1) / 2) * siblingGap
        : 0;
      const family = nodeSemanticFamily(nodeTypeById.get(node.type), node);
      positionedY.set(node.id, Math.round(averagedAnchor + siblingOffset + familyBias(family)));
    });

    let previousY = Number.NEGATIVE_INFINITY;
    laneNodes.forEach((node) => {
      const current = positionedY.get(node.id) ?? rootBaseY;
      const minimum = previousY + 162;
      const next = current < minimum ? minimum : current;
      positionedY.set(node.id, next);
      previousY = next;
    });
  }

  laneDepths.forEach((laneDepth) => {
    bundle.nodes
      .filter((node) => (depth.get(node.id) ?? 0) === laneDepth)
      .sort((left, right) => (positionedY.get(left.id) ?? 0) - (positionedY.get(right.id) ?? 0))
      .forEach((node) => {
      positioned.push({
        node,
        depth: laneDepth,
        childCount: outgoing.get(node.id)?.length ?? 0,
        ...measurePathwayNode(node, laneDepth, outgoing.get(node.id)?.length ?? 0),
        x: 120 + laneDepth * horizontalGap + ((hashString(node.id) % 3) - 1) * 10,
        y: positionedY.get(node.id) ?? rootBaseY,
      });
    });
  });

  const width = Math.max(1480, Math.max(...positioned.map((item) => item.x + item.width), 0) + 260);
  const height = Math.max(920, Math.max(...positioned.map((item) => item.y + item.height), 0) + lanePaddingBottom);

  return { nodes: positioned, width, height };
}

function mapNodeType(definition: GraphNodeTypeDefinition | undefined, node: GraphNodeRecord): GraphNode["type"] {
  const id = `${definition?.id ?? ""} ${node.type} ${definition?.label ?? ""}`.toLowerCase();
  if (id.includes("decision") || id.includes("branch") || id.includes("gate")) {
    return "gate";
  }
  if (id.includes("constraint") || id.includes("resource") || id.includes("evidence") || id.includes("risk")) {
    return "transform";
  }
  return "turn";
}

function edgeToRailEdge(edge: GraphEdgeRecord): GraphEdge {
  return {
    from: { nodeId: edge.source, port: "out" },
    to: { nodeId: edge.target, port: "in" },
  };
}

type PathwayRailCanvasProps = {
  bundle: GraphBundle;
  selectedNodeId: string | null;
  selectedRouteId: string | null;
  onSelectNode: (nodeId: string) => void;
};

const EMPTY_NODE_STATES: Record<string, NodeRunState> = {};
const EMPTY_SELECTION: Set<string> = new Set();
const EMPTY_DIRECT_INPUTS: Set<string> = new Set();
const EMPTY_ANCHORS: readonly NodeAnchorSide[] = [];

function clampZoom(value: number): number {
  return Math.max(0.55, Math.min(1.8, Number(value.toFixed(2))));
}

export default function PathwayRailCanvas({
  bundle,
  selectedNodeId,
  selectedRouteId,
  onSelectNode,
}: PathwayRailCanvasProps) {
  const [canvasZoom, setCanvasZoom] = useState(1);
  const [canvasFullscreen, setCanvasFullscreen] = useState(false);
  const [selectedNodeIds, setSelectedNodeIds] = useState<string[]>(selectedNodeId ? [selectedNodeId] : []);
  const [selectedEdgeKey, setSelectedEdgeKey] = useState("");
  const [dragState, setDragState] = useState<DragState | null>(null);
  const graphCanvasRef = useRef<HTMLDivElement | null>(null);
  const viewportTouchedRef = useRef(false);

  useEffect(() => {
    const fallbackId = selectedNodeId ?? selectedRouteId;
    setSelectedNodeIds(fallbackId ? [fallbackId] : []);
  }, [selectedNodeId, selectedRouteId]);

  const adapted = useMemo(() => {
    const layout = buildLayout(bundle);
    const nodeTypes = new Map(bundle.ontology.node_types.map((item) => [item.id, item]));
    const nodes: GraphNode[] = layout.nodes.map(({ node, x, y, depth, childCount, width, height }) => ({
      id: node.id,
      type: mapNodeType(nodeTypes.get(node.type), node),
      position: { x, y },
      config: {
        role: nodeTypes.get(node.type)?.label ?? "PATHWAY NODE",
        model: node.label,
        promptTemplate: node.summary,
        sourceKind: "pathway",
        pathwayNodeType: node.type,
        pathwayFamily: nodeSemanticFamily(nodeTypes.get(node.type), node),
        pathwayTone: toneForFamily(nodeSemanticFamily(nodeTypes.get(node.type), node), node),
        pathwayDepth: depth,
        pathwayChildCount: childCount,
        pathwayVisualWidth: width,
        pathwayVisualHeight: height,
      },
    }));
    const edges = bundle.edges.map(edgeToRailEdge);
    const graph: GraphData = {
      version: 1,
      nodes,
      edges,
      knowledge: {
        files: [],
        topK: 0,
        maxChars: 0,
      },
    };

    return {
      graph,
      width: layout.width,
      height: layout.height,
    };
  }, [bundle]);

  const [graphData, setGraphData] = useState<GraphData>(adapted.graph);

  useEffect(() => {
    setGraphData(adapted.graph);
  }, [adapted.graph]);

  useEffect(() => {
    viewportTouchedRef.current = false;
  }, [bundle.bundle_id]);

  useEffect(() => {
    const canvas = graphCanvasRef.current;
    if (!canvas) {
      return;
    }

    const fitCanvas = () => {
      if (viewportTouchedRef.current) {
        return;
      }

      const bounds = canvas.getBoundingClientRect();
      if (bounds.width <= 0 || bounds.height <= 0) {
        return;
      }

      const fitX = (bounds.width - 120) / adapted.width;
      const fitY = (bounds.height - 140) / adapted.height;
      const nextZoom = clampZoom(Math.min(1.08, fitX, fitY));
      setCanvasZoom(nextZoom);
      canvas.scrollLeft = 0;
      canvas.scrollTop = 0;
    };

    fitCanvas();

    const resizeObserver = new ResizeObserver(() => {
      fitCanvas();
    });
    resizeObserver.observe(canvas);

    return () => {
      resizeObserver.disconnect();
    };
  }, [adapted.height, adapted.width]);

  const edgeLines = useMemo(() => {
    const nodeMap = new Map(graphData.nodes.map((node) => [node.id, node]));
    return buildCanvasEdgeLines({
      entries: graphData.edges.map((edge) => ({
        edge,
        edgeKey: `${edge.from.nodeId}:${edge.to.nodeId}`,
        readOnly: false,
      })),
      nodeMap,
      getNodeVisualSize: (nodeId) => {
        const node = nodeMap.get(nodeId);
        const config = node?.config as Record<string, unknown> | undefined;
        if (config && String(config.sourceKind ?? "").trim() === "pathway") {
          return {
            width: Number(config.pathwayVisualWidth ?? NODE_WIDTH),
            height: Number(config.pathwayVisualHeight ?? NODE_HEIGHT),
          };
        }
        return { width: NODE_WIDTH, height: NODE_HEIGHT };
      },
    });
  }, [graphData]);

  const setNodeSelection = (nodeIds: string[], focusedNodeId?: string) => {
    setSelectedNodeIds(nodeIds);
    const next = focusedNodeId ?? nodeIds[0];
    if (next) {
      onSelectNode(next);
    }
  };

  const zoomIn = () => {
    viewportTouchedRef.current = true;
    setCanvasZoom((current) => Math.min(1.8, Number((current + 0.1).toFixed(2))));
  };
  const zoomOut = () => {
    viewportTouchedRef.current = true;
    setCanvasZoom((current) => Math.max(0.55, Number((current - 0.1).toFixed(2))));
  };

  const toLogicalPoint = (event: ReactMouseEvent<HTMLDivElement>): { x: number; y: number } | null => {
    const canvas = graphCanvasRef.current;
    if (!canvas) {
      return null;
    }
    const rect = canvas.getBoundingClientRect();
    const stageInsetX = 24;
    const stageInsetY = 24;
    return {
      x: (event.clientX - rect.left + canvas.scrollLeft - stageInsetX) / canvasZoom,
      y: (event.clientY - rect.top + canvas.scrollTop - stageInsetY) / canvasZoom,
    };
  };

  const onNodeDragStart = (event: ReactMouseEvent<HTMLDivElement>, nodeId: string) => {
    viewportTouchedRef.current = true;
    const pointer = toLogicalPoint(event);
    if (!pointer) {
      return;
    }
    const activeIds = selectedNodeIds.includes(nodeId) ? selectedNodeIds : [nodeId];
    const startPositions = Object.fromEntries(
      graphData.nodes
        .filter((node) => activeIds.includes(node.id))
        .map((node) => [node.id, { ...node.position }]),
    );
    setSelectedNodeIds(activeIds);
    onSelectNode(nodeId);
    setDragState({
      nodeIds: activeIds,
      pointerStart: pointer,
      startPositions,
    });
  };

  const onCanvasMouseMove = (event: ReactMouseEvent<HTMLDivElement>) => {
    if (!dragState) {
      return;
    }
    const pointer = toLogicalPoint(event);
    if (!pointer) {
      return;
    }
    const dx = pointer.x - dragState.pointerStart.x;
    const dy = pointer.y - dragState.pointerStart.y;
    setGraphData((current) => ({
      ...current,
      nodes: current.nodes.map((node) => {
        const start = dragState.startPositions[node.id];
        if (!start) {
          return node;
        }
        return {
          ...node,
          position: {
            x: Math.round(start.x + dx),
            y: Math.round(start.y + dy),
          },
        };
      }),
    }));
  };

  const onCanvasMouseUp = () => {
    if (dragState) {
      setDragState(null);
    }
  };

  const onCanvasWheel = (event: ReactWheelEvent<HTMLDivElement>) => {
    if (!event.metaKey && !event.ctrlKey) {
      return;
    }
    event.preventDefault();
    viewportTouchedRef.current = true;
    if (event.deltaY < 0) {
      zoomIn();
    } else {
      zoomOut();
    }
  };

  const onCanvasKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if ((event.metaKey || event.ctrlKey) && event.key === "=") {
      event.preventDefault();
      setCanvasZoom((current) => clampZoom(current + 0.1));
    }
    if ((event.metaKey || event.ctrlKey) && event.key === "-") {
      event.preventDefault();
      setCanvasZoom((current) => clampZoom(current - 0.1));
    }
  };

  return (
    <div className="pathway-rail-canvas">
      <WorkflowCanvasPane
        canvasVariant="pathway"
        panMode={false}
        onCanvasKeyDown={onCanvasKeyDown}
        onCanvasMouseDown={() => {}}
        onCanvasMouseMove={onCanvasMouseMove}
        onCanvasMouseUp={onCanvasMouseUp}
        onCanvasWheel={onCanvasWheel}
        graphCanvasRef={graphCanvasRef}
        onActivateWorkspacePanels={() => {}}
        boundedStageWidth={adapted.width}
        boundedStageHeight={adapted.height}
        canvasZoom={canvasZoom}
        graphViewMode="graph"
        stageInsetX={28}
        stageInsetY={28}
        stageInsetBottom={36}
        edgeLines={edgeLines}
        selectedEdgeKey={selectedEdgeKey}
        selectedEdgeNodeIdSet={EMPTY_SELECTION}
        setNodeSelection={setNodeSelection}
        setSelectedEdgeKey={setSelectedEdgeKey}
        onEdgeDragStart={() => {}}
        connectPreviewLine={null}
        canvasNodes={graphData.nodes}
        graphNodes={graphData.nodes}
        nodeStates={EMPTY_NODE_STATES}
        selectedNodeIds={selectedNodeIds}
        draggingNodeIds={dragState?.nodeIds ?? []}
        isConnectingDrag={false}
        questionDirectInputNodeIds={EMPTY_DIRECT_INPUTS}
        onNodeAnchorDragStart={() => {}}
        onNodeAnchorDrop={() => {}}
        onAssignSelectedEdgeAnchor={() => false}
        isNodeDragAllowedTarget={() => true}
        onNodeDragStart={onNodeDragStart}
        nodeAnchorSides={EMPTY_ANCHORS}
        nodeCardSummary={nodeCardSummary}
        turnModelLabel={turnModelLabel}
        turnRoleLabel={turnRoleLabel}
        nodeTypeLabel={nodeTypeLabel}
        nodeStatusLabel={nodeStatusLabel}
        deleteNode={() => {}}
        onOpenFeedFromNode={() => {}}
        onOpenWebInputForNode={() => {}}
        runtimeNowMs={Date.now()}
        formatNodeElapsedTime={() => "Ready"}
        openTerminalNodeId=""
        onToggleNodeTerminal={() => {}}
        onSetPmPlanningMode={() => {}}
        expandedRoleNodeIds={[]}
        onToggleRoleInternalExpanded={() => {}}
        onAddRolePerspectivePass={() => {}}
        onAddRoleReviewPass={() => {}}
        marqueeSelection={null as MarqueeSelection | null}
        onCanvasZoomIn={zoomIn}
        onCanvasZoomOut={zoomOut}
        canvasFullscreen={canvasFullscreen}
        setCanvasFullscreen={setCanvasFullscreen}
        setPanMode={() => {}}
        canRunGraphNow={false}
        onRunGraph={async () => {}}
        isGraphRunning={false}
        onCancelGraphRun={async () => {}}
        suspendedWebTurn={null}
        pendingWebTurn={null}
        onReopenPendingWebTurn={() => {}}
        undoStackLength={0}
        redoStackLength={0}
        onUndoGraph={() => {}}
        onRedoGraph={() => {}}
        onClearGraph={() => {}}
        canClearGraph={false}
        isWorkflowBusy={false}
        onApplyModelSelection={() => {}}
        agentTerminalIsland={null}
        setWorkflowQuestion={() => {}}
        workflowQuestion=""
        questionInputRef={{ current: null }}
        attachedFiles={[]}
        onOpenKnowledgeFilePicker={() => {}}
        onRemoveKnowledgeFile={() => {}}
      />
    </div>
  );
}
