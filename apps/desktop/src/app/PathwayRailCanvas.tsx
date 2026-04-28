import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type WheelEvent as ReactWheelEvent,
} from "react";

import WorkflowCanvasPane from "./main/presentation/WorkflowCanvasPane";
import {
  buildCanvasEdgeLines,
  NODE_HEIGHT,
  NODE_WIDTH,
  nodeCardSummary,
  snapToLayoutGrid,
  snapToNearbyNodeAxis,
  turnModelLabel,
} from "../features/workflow/graph-utils";
import { nodeStatusLabel, nodeTypeLabel, turnRoleLabel } from "../features/workflow/labels";
import type { GraphData, GraphNode, NodeAnchorSide } from "../features/workflow/types";
import type { DragState, MarqueeSelection, NodeRunState } from "./main/types";
import type {
  GraphBundle,
  GraphEdgeRecord,
  GraphNodeRecord,
  GraphNodeTypeDefinition,
  RevisionProposalRecord
} from "../lib/types";

export type LayoutNode = {
  node: GraphNodeRecord;
  x: number;
  y: number;
  depth: number;
  childCount: number;
  width: number;
  height: number;
  isContextOnly: boolean;
  radialSector?: string;
};

export type LayoutBounds = {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
};

type PathwayEdgeSides = {
  fromSide: NodeAnchorSide;
  toSide: NodeAnchorSide;
};

type CanvasPanState = {
  pointerClientX: number;
  pointerClientY: number;
  scrollLeft: number;
  scrollTop: number;
};

type PathwayTone = "sky" | "iris" | "mist" | "goal";

const TERMINAL_GOAL_DATA_ROLE = "terminal_goal";
const PRIMARY_GOAL_DATA_ROLE = "primary_goal";
const PERSONAL_LEARNING_DATA_ROLE = "personal_learning";
const PATHWAY_NODE_WIDTH = 268;
const PATHWAY_NODE_HEIGHT = 64;
const PATHWAY_GOAL_WIDTH = 320;
const PATHWAY_LEARNING_WIDTH = 280;
const PATHWAY_INITIAL_MIN_READABLE_ZOOM = 0.68;
const PATHWAY_INITIAL_MAX_ZOOM = 1.18;

const PATHWAY_RADIAL_SECTORS = [
  { id: "upper-right", signX: 1, signY: -1 },
  { id: "lower-right", signX: 1, signY: 1 },
  { id: "upper-left", signX: -1, signY: -1 },
  { id: "lower-left", signX: -1, signY: 1 },
] as const;

export type PersonalLearningDisplayTask = {
  id: string;
  date: string;
  title: string;
  notes?: string;
  minutes?: number;
  completed?: boolean;
  quizScore?: number | null;
};

function normalizeGraphSearchText(value: unknown): string {
  return String(value ?? "").trim().toLowerCase();
}

function semanticTextIncludesGoal(value: string): boolean {
  return value.includes("goal") || value.includes("objective") || value.includes("목표");
}

function nodeLooksLikeGoal(definition: GraphNodeTypeDefinition | undefined, node: GraphNodeRecord): boolean {
  const dataRole = normalizeGraphSearchText((node.data as Record<string, unknown> | undefined)?.pathway_display_role);
  if (dataRole === TERMINAL_GOAL_DATA_ROLE || dataRole === PRIMARY_GOAL_DATA_ROLE) {
    return true;
  }
  const value = normalizeGraphSearchText(`${definition?.id ?? ""} ${definition?.label ?? ""} ${node.type} ${node.label}`);
  return semanticTextIncludesGoal(value);
}

function nodeHasDisplayRole(node: GraphNodeRecord, role: string): boolean {
  return normalizeGraphSearchText((node.data as Record<string, unknown> | undefined)?.pathway_display_role) === role;
}

function nodeSemanticRole(definition: GraphNodeTypeDefinition | undefined): string {
  return normalizeGraphSearchText(definition?.semantic_role);
}

function hashString(value: string): number {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash;
}

function nodeSemanticFamily(definition: GraphNodeTypeDefinition | undefined, node: GraphNodeRecord): string {
  const value = `${definition?.id ?? ""} ${definition?.label ?? ""} ${node.type} ${node.label}`.toLowerCase();
  const dataRole = normalizeGraphSearchText((node.data as Record<string, unknown> | undefined)?.pathway_display_role);
  const semanticRole = normalizeGraphSearchText(definition?.semantic_role);
  if (nodeLooksLikeGoal(definition, node)) {
    return "goal";
  }
  if (
    dataRole === PERSONAL_LEARNING_DATA_ROLE ||
    semanticRole === "practice" ||
    value.includes("learning") ||
    value.includes("학습")
  ) {
    return "learning";
  }
  if (semanticRole === "risk" || value.includes("risk") || value.includes("warning")) {
    return "risk";
  }
  if (
    semanticRole === "resource" ||
    value.includes("resource") ||
    value.includes("asset") ||
    value.includes("capital")
  ) {
    return "resource";
  }
  if (
    semanticRole === "route_choice" ||
    semanticRole === "switch_condition" ||
    value.includes("decision") ||
    value.includes("branch") ||
    value.includes("gate")
  ) {
    return "decision";
  }
  if (
    semanticRole === "evidence" ||
    value.includes("evidence") ||
    value.includes("signal") ||
    value.includes("research")
  ) {
    return "evidence";
  }
  if (
    semanticRole === "constraint" ||
    value.includes("constraint") ||
    value.includes("blocker") ||
    value.includes("limit")
  ) {
    return "constraint";
  }
  return "route";
}

function toneForFamily(family: string, node: GraphNodeRecord): PathwayTone {
  const fallbackTones: PathwayTone[] = ["sky", "iris", "mist"];
  if (family === "goal") {
    return "goal";
  }
  if (family === "decision") {
    return "iris";
  }
  if (family === "evidence") {
    return "sky";
  }
  if (family === "learning") {
    return "sky";
  }
  if (family === "resource" || family === "constraint" || family === "risk") {
    return "mist";
  }
  return fallbackTones[hashString(`${node.type}:${node.label}`) % fallbackTones.length] ?? "sky";
}

function measurePathwayNode(_node: GraphNodeRecord, _depth: number, _childCount: number): { width: number; height: number } {
  if (
    normalizeGraphSearchText((_node.data as Record<string, unknown> | undefined)?.pathway_display_role) ===
    TERMINAL_GOAL_DATA_ROLE
  ) {
    return { width: PATHWAY_GOAL_WIDTH, height: PATHWAY_NODE_HEIGHT };
  }
  if (
    normalizeGraphSearchText((_node.data as Record<string, unknown> | undefined)?.pathway_display_role) ===
    PERSONAL_LEARNING_DATA_ROLE
  ) {
    return { width: PATHWAY_LEARNING_WIDTH, height: PATHWAY_NODE_HEIGHT };
  }
  return { width: PATHWAY_NODE_WIDTH, height: PATHWAY_NODE_HEIGHT };
}

function makeUniqueNodeId(baseId: string, existingIds: Set<string>): string {
  if (!existingIds.has(baseId)) {
    return baseId;
  }
  let index = 2;
  while (existingIds.has(`${baseId}_${index}`)) {
    index += 1;
  }
  return `${baseId}_${index}`;
}

function makeUniqueEdgeId(baseId: string, existingIds: Set<string>): string {
  if (!existingIds.has(baseId)) {
    return baseId;
  }
  let index = 2;
  while (existingIds.has(`${baseId}_${index}`)) {
    index += 1;
  }
  return `${baseId}_${index}`;
}

function ensureGoalNodeType(bundle: GraphBundle): string {
  const existingGoalType = bundle.ontology.node_types.find((definition) => {
    const value = normalizeGraphSearchText(`${definition.id} ${definition.label}`);
    return semanticTextIncludesGoal(value);
  });
  if (existingGoalType) {
    return existingGoalType.id;
  }

  bundle.ontology.node_types.push({
    id: "goal",
    label: "GOAL",
    description: "사용자가 기입한 최종 목표",
    semantic_role: "goal",
    default_style: { tone: "goal", shape: "rounded_card" },
    fields: [{ key: "source", label: "Source", value_type: "text", required: false }],
  });
  return "goal";
}

function ensureProgressionEdgeType(bundle: GraphBundle): string {
  const existingProgressionType = bundle.ontology.edge_types.find((item) => item.role === "progression");
  if (existingProgressionType) {
    return existingProgressionType.id;
  }
  bundle.ontology.edge_types.push({
    id: "progresses_to",
    label: "진행",
    role: "progression",
    default_style: { line: "curved" },
  });
  return "progresses_to";
}

export function buildTerminalGoalDisplayBundle(bundle: GraphBundle, userGoalTitle?: string | null): GraphBundle {
  const next = structuredClone(bundle);
  const progressionTypeId = ensureProgressionEdgeType(next);
  const goalTypeId = ensureGoalNodeType(next);
  const nodeTypes = new Map(next.ontology.node_types.map((item) => [item.id, item]));
  const existingNodeIds = new Set(next.nodes.map((node) => node.id));
  const userGoalLabel = String(userGoalTitle ?? "").trim();
  const terminalDisplayNodeIds = new Set(
    next.nodes.filter((node) => nodeHasDisplayRole(node, TERMINAL_GOAL_DATA_ROLE)).map((node) => node.id),
  );
  if (terminalDisplayNodeIds.size > 0) {
    next.nodes = next.nodes.filter((node) => !terminalDisplayNodeIds.has(node.id));
    next.edges = next.edges.filter(
      (edge) => !terminalDisplayNodeIds.has(edge.source) && !terminalDisplayNodeIds.has(edge.target),
    );
  }
  const generatedGoalNode = next.nodes.find(
    (node) => !nodeHasDisplayRole(node, TERMINAL_GOAL_DATA_ROLE) && nodeLooksLikeGoal(nodeTypes.get(node.type), node),
  );
  const fallbackGoalLabel =
    userGoalLabel ||
    generatedGoalNode?.label ||
    next.map.title ||
    "GOAL";

  let displayGoalNode = generatedGoalNode;
  if (!displayGoalNode) {
    const goalNodeId = makeUniqueNodeId("display_goal", existingNodeIds);
    displayGoalNode = {
      id: goalNodeId,
      type: goalTypeId,
      label: fallbackGoalLabel,
      summary: "사용자가 기입한 목표입니다. 이 노드에서 조사 기반 경로가 펼쳐집니다.",
      data: {
        source: "user_goal",
        pathway_display_role: PRIMARY_GOAL_DATA_ROLE,
      },
      evidence_refs: [],
      assumption_refs: [],
    };
    next.nodes.push(displayGoalNode);
    existingNodeIds.add(goalNodeId);
  } else {
    displayGoalNode.label = fallbackGoalLabel;
    displayGoalNode.summary = displayGoalNode.summary || "사용자가 기입한 목표입니다.";
    displayGoalNode.data = {
      ...displayGoalNode.data,
      source: (displayGoalNode.data as Record<string, unknown> | undefined)?.source ?? "user_goal",
      pathway_display_role: PRIMARY_GOAL_DATA_ROLE,
    };
  }

  const goalNodeId = displayGoalNode.id;
  const progressionEdges = next.edges.filter((edge) => edge.type === progressionTypeId);
  const incoming = new Map<string, number>();
  const outgoing = new Map<string, number>();
  next.nodes.forEach((node) => {
    incoming.set(node.id, 0);
    outgoing.set(node.id, 0);
  });
  progressionEdges.forEach((edge) => {
    incoming.set(edge.target, (incoming.get(edge.target) ?? 0) + 1);
    outgoing.set(edge.source, (outgoing.get(edge.source) ?? 0) + 1);
  });

  const connectableRootRoles = new Set([
    "checkpoint",
    "curriculum",
    "fallback_route",
    "milestone",
    "practice",
    "route",
    "route_choice",
    "switch_condition",
  ]);
  const nonRootRoles = new Set([
    "assumption",
    "constraint",
    "cost",
    "evidence",
    "goal",
    "opportunity_cost",
    "resource",
    "risk",
  ]);
  const rootRouteNodeIds = next.nodes
    .filter((node) => {
      if (node.id === goalNodeId || (incoming.get(node.id) ?? 0) !== 0) {
        return false;
      }
      const semanticRole = nodeSemanticRole(nodeTypes.get(node.type));
      if (connectableRootRoles.has(semanticRole)) {
        return true;
      }
      if (nonRootRoles.has(semanticRole)) {
        return false;
      }
      const family = nodeSemanticFamily(nodeTypes.get(node.type), node);
      return family === "decision" || family === "learning" || family === "route";
    })
    .map((node) => node.id);
  const goalHasProgressionEdges = progressionEdges.some((edge) => edge.source === goalNodeId || edge.target === goalNodeId);
  if (!goalHasProgressionEdges && rootRouteNodeIds.length > 0) {
    const existingEdgeIds = new Set(next.edges.map((edge) => edge.id));
    const displayGoalRootEdges = rootRouteNodeIds.map((nodeId) => {
      const baseId = `display_goal_root_${nodeId}`;
      const edgeId = makeUniqueEdgeId(baseId, existingEdgeIds);
      existingEdgeIds.add(edgeId);
      return {
        id: edgeId,
        type: progressionTypeId,
        source: goalNodeId,
        target: nodeId,
        label: "시작",
      };
    });
    next.edges = [...next.edges, ...displayGoalRootEdges];
  }
  return next;
}

function ensureLearningNodeType(bundle: GraphBundle): string {
  const existingType = bundle.ontology.node_types.find((definition) => definition.id === "personal_learning_task");
  if (existingType) {
    return existingType.id;
  }
  bundle.ontology.node_types.push({
    id: "personal_learning_task",
    label: "개인 학습 TASK",
    description: "사용자가 실제로 완료하고 퀴즈로 점검한 개인 학습 경로",
    semantic_role: "practice",
    default_style: { tone: "learning", shape: "rounded_card" },
    fields: [
      { key: "date", label: "날짜", value_type: "date", required: true },
      { key: "minutes", label: "학습 시간", value_type: "number", required: false },
      { key: "quiz_score", label: "퀴즈 점수", value_type: "number", required: false },
    ],
  });
  return "personal_learning_task";
}

export function buildLearningRouteDisplayBundle(
  bundle: GraphBundle,
  learningTasks: PersonalLearningDisplayTask[],
): GraphBundle {
  const completedTasks = learningTasks.filter((task) => task.completed && task.title.trim());
  if (completedTasks.length === 0) {
    return bundle;
  }

  const next = structuredClone(bundle);
  const progressionTypeId = ensureProgressionEdgeType(next);
  const learningTypeId = ensureLearningNodeType(next);
  const nodeTypes = new Map(next.ontology.node_types.map((item) => [item.id, item]));
  const goalNode = next.nodes.find((node) => nodeLooksLikeGoal(nodeTypes.get(node.type), node));
  if (!goalNode) {
    return next;
  }

  const existingNodeIds = new Set(next.nodes.map((node) => node.id));
  const existingEdgeIds = new Set(next.edges.map((edge) => edge.id));
  completedTasks.forEach((task, index) => {
    const baseNodeId = `personal_learning_${String(task.id).replace(/[^a-zA-Z0-9_-]+/g, "_")}`;
    const nodeId = makeUniqueNodeId(baseNodeId, existingNodeIds);
    existingNodeIds.add(nodeId);
    const scoreText = typeof task.quizScore === "number" ? ` · quiz ${task.quizScore}점` : "";
    next.nodes.push({
      id: nodeId,
      type: learningTypeId,
      label: task.title,
      summary: `${task.date}에 완료한 개인 학습 TASK${scoreText}. ${task.notes ?? ""}`.trim(),
      data: {
        pathway_display_role: PERSONAL_LEARNING_DATA_ROLE,
        date: task.date,
        minutes: task.minutes ?? null,
        quiz_score: task.quizScore ?? null,
        route_label: "개인 학습 루트",
      },
      evidence_refs: [],
      assumption_refs: [],
    });
    const edgeId = makeUniqueEdgeId(`personal_learning_to_goal_${index + 1}_${task.id}`, existingEdgeIds);
    existingEdgeIds.add(edgeId);
    next.edges.push({
      id: edgeId,
      type: progressionTypeId,
      source: nodeId,
      target: goalNode.id,
      label: "학습 누적",
    });
  });

  return next;
}

type PathwayNodeFootprint = {
  width: number;
  height: number;
  childCount: number;
  footprintWidth: number;
  footprintHeight: number;
};

function hasAlternateProgressionPath(
  edges: GraphEdgeRecord[],
  sourceId: string,
  targetId: string,
  skippedEdgeIndex: number,
): boolean {
  const outgoing = new Map<string, string[]>();
  edges.forEach((edge, index) => {
    if (index === skippedEdgeIndex) {
      return;
    }
    const rows = outgoing.get(edge.source) ?? [];
    rows.push(edge.target);
    outgoing.set(edge.source, rows);
  });

  const visited = new Set<string>();
  const queue = [...(outgoing.get(sourceId) ?? [])];
  while (queue.length > 0) {
    const current = queue.shift() as string;
    if (current === targetId) {
      return true;
    }
    if (visited.has(current)) {
      continue;
    }
    visited.add(current);
    queue.push(...(outgoing.get(current) ?? []));
  }
  return false;
}

function reduceProgressionEdgesForDisplay(edges: GraphEdgeRecord[]): GraphEdgeRecord[] {
  return edges.filter(
    (edge, index) => !hasAlternateProgressionPath(edges, edge.source, edge.target, index),
  );
}

function resolvePathwayEdgeSides(source: LayoutNode, target: LayoutNode): PathwayEdgeSides {
  const targetRole = normalizeGraphSearchText((target.node.data as Record<string, unknown> | undefined)?.pathway_display_role);
  if (targetRole === TERMINAL_GOAL_DATA_ROLE) {
    return { fromSide: "right", toSide: "left" };
  }

  const sourceCenterX = source.x + source.width / 2;
  const sourceCenterY = source.y + source.height / 2;
  const targetCenterX = target.x + target.width / 2;
  const targetCenterY = target.y + target.height / 2;
  const dx = targetCenterX - sourceCenterX;
  const dy = targetCenterY - sourceCenterY;

  if (Math.abs(dx) >= Math.abs(dy)) {
    return dx >= 0
      ? { fromSide: "right", toSide: "left" }
      : { fromSide: "left", toSide: "right" };
  }

  return dy >= 0
    ? { fromSide: "bottom", toSide: "top" }
    : { fromSide: "top", toSide: "bottom" };
}

export function buildPathwayLayout(bundle: GraphBundle): { nodes: LayoutNode[]; width: number; height: number; bounds: LayoutBounds; progressionTypeIds: Set<string> } {
  const progressionTypeIds = new Set(
    bundle.ontology.edge_types.filter((item) => item.role === "progression").map((item) => item.id),
  );
  const progressionEdges = reduceProgressionEdgesForDisplay(bundle.edges.filter((edge) => progressionTypeIds.has(edge.type)));
  const nodeById = new Map(bundle.nodes.map((node) => [node.id, node]));
  const learningNodeIds = bundle.nodes
    .filter(
      (node) =>
        normalizeGraphSearchText((node.data as Record<string, unknown> | undefined)?.pathway_display_role) ===
        PERSONAL_LEARNING_DATA_ROLE,
    )
    .map((node) => node.id);
  const terminalGoalNodeId =
    bundle.nodes.find(
      (node) =>
        normalizeGraphSearchText((node.data as Record<string, unknown> | undefined)?.pathway_display_role) ===
        TERMINAL_GOAL_DATA_ROLE,
    )?.id ?? null;
  const primaryGoalNodeId =
    bundle.nodes.find(
      (node) =>
        normalizeGraphSearchText((node.data as Record<string, unknown> | undefined)?.pathway_display_role) ===
        PRIMARY_GOAL_DATA_ROLE,
    )?.id ??
    bundle.nodes.find((node) => nodeLooksLikeGoal(bundle.ontology.node_types.find((item) => item.id === node.type), node))?.id ??
    null;
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

  const nodeTypes = new Map(bundle.ontology.node_types.map((item) => [item.id, item]));
  const nodeSortRank = (nodeId: string): number => {
    if (nodeId === primaryGoalNodeId) {
      return 0;
    }
    const node = nodeById.get(nodeId);
    const family = node ? nodeSemanticFamily(nodeTypes.get(node.type), node) : "route";
    if ((outgoing.get(nodeId)?.length ?? 0) > 0 && (family === "route" || family === "decision" || family === "learning")) {
      return 1;
    }
    if ((outgoing.get(nodeId)?.length ?? 0) > 0) {
      return 2;
    }
    if (family === "route" || family === "decision" || family === "learning") {
      return 3;
    }
    return 4;
  };
  const compareNodeIds = (leftId: string, rightId: string) => {
    const rankDiff = nodeSortRank(leftId) - nodeSortRank(rightId);
    if (rankDiff !== 0) {
      return rankDiff;
    }
    return (nodeById.get(leftId)?.label ?? leftId).localeCompare(nodeById.get(rightId)?.label ?? rightId);
  };

  parents.forEach((items, nodeId) => {
    parents.set(nodeId, [...items].sort(compareNodeIds));
  });

  outgoing.forEach((items, nodeId) => {
    outgoing.set(nodeId, [...items].sort(compareNodeIds));
  });

  const contextOnlyNodeIds = new Set(
    bundle.nodes
      .filter(
        (node) =>
          node.id !== primaryGoalNodeId &&
          node.id !== terminalGoalNodeId &&
          (incoming.get(node.id) ?? 0) === 0 &&
          (outgoing.get(node.id)?.length ?? 0) === 0,
      )
      .map((node) => node.id),
  );

  const roots = bundle.nodes
    .filter((node) => (incoming.get(node.id) ?? 0) === 0 && !contextOnlyNodeIds.has(node.id))
    .sort((left, right) => compareNodeIds(left.id, right.id));
  const mainNodes = bundle.nodes.filter((node) => !contextOnlyNodeIds.has(node.id));
  const queue = roots.length > 0 ? roots.map((node) => node.id) : mainNodes.slice(0, 1).map((node) => node.id);
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

  if (terminalGoalNodeId) {
    const routeMaxDepth = Math.max(
      0,
      ...bundle.nodes
        .filter((node) => node.id !== terminalGoalNodeId && !learningNodeIds.includes(node.id))
        .map((node) => depth.get(node.id) ?? 0),
    );
    const goalDepth = routeMaxDepth + 1;
    depth.set(terminalGoalNodeId, goalDepth);
    learningNodeIds.forEach((nodeId) => {
      depth.set(nodeId, Math.max(0, goalDepth - 1));
    });
  }
  const directGoalParentIdSet = new Set(
    terminalGoalNodeId ? (parents.get(terminalGoalNodeId) ?? []).filter((nodeId) => !learningNodeIds.includes(nodeId)) : [],
  );

  const nodeFootprintById = new Map<string, PathwayNodeFootprint>();
  bundle.nodes.forEach((node) => {
    const childCount = outgoing.get(node.id)?.length ?? 0;
    const measured = measurePathwayNode(node, depth.get(node.id) ?? 0, childCount);
    nodeFootprintById.set(node.id, {
      ...measured,
      childCount,
      footprintWidth: measured.width + 72,
      footprintHeight: measured.height + 44,
    });
  });

  const positioned: LayoutNode[] = [];
  const positionedY = new Map<string, number>();
  const laneDepths = [...new Set(mainNodes.map((node) => depth.get(node.id) ?? 0))].sort((a, b) => a - b);
  const rootBaseY = 108;
  const horizontalGap = 56;
  const rootRowGap = 48;
  const laneSiblingGap = 72;
  const lanePaddingBottom = 24;
  const laneStartX = new Map<number, number>();
  let laneCursorX = 120;
  laneDepths.forEach((laneDepth) => {
    const laneNodes = mainNodes.filter((node) => (depth.get(node.id) ?? 0) === laneDepth);
    const laneFootprintWidth = Math.max(
      ...laneNodes.map((node) => nodeFootprintById.get(node.id)?.footprintWidth ?? 0),
      0,
    );
    const laneHasMergeTarget = laneNodes.some((node) => (parents.get(node.id)?.length ?? 0) > 1);
    const mergePullLeft = laneHasMergeTarget && laneDepth > 0 ? 36 : 0;
    laneCursorX -= mergePullLeft;
    laneStartX.set(laneDepth, laneCursorX);
    laneCursorX += laneFootprintWidth + horizontalGap;
  });
  const rowGap = Math.max(
    ...bundle.nodes.map((node) => nodeFootprintById.get(node.id)?.height ?? NODE_HEIGHT),
    NODE_HEIGHT,
  ) + rootRowGap;
  const minRowGapForNodes = (previousNodeId: string, nextNodeId: string) => {
    const previousHeight = nodeFootprintById.get(previousNodeId)?.height ?? NODE_HEIGHT;
    const nextHeight = nodeFootprintById.get(nextNodeId)?.height ?? NODE_HEIGHT;
    return ((previousHeight + nextHeight) / 2 + laneSiblingGap) / Math.max(1, rowGap);
  };
  const rowByNodeId = new Map<string, number>();
  const visiting = new Set<string>();
  let nextLeafRow = 0;
  const assignRowFromDescendants = (nodeId: string): number => {
    const existingRow = rowByNodeId.get(nodeId);
    if (typeof existingRow === "number") {
      return existingRow;
    }
    if (visiting.has(nodeId)) {
      const cycleRow = nextLeafRow;
      nextLeafRow += 1;
      rowByNodeId.set(nodeId, cycleRow);
      return cycleRow;
    }
    visiting.add(nodeId);
    const childIds = (outgoing.get(nodeId) ?? [])
      .filter((childId) => childId !== terminalGoalNodeId)
      .sort(compareNodeIds);
    let row: number;
    if (childIds.length === 0) {
      row = nextLeafRow;
      nextLeafRow += 1;
    } else {
      const childRows = childIds.map(assignRowFromDescendants);
      row = childRows.reduce((sum, value) => sum + value, 0) / childRows.length;
    }
    visiting.delete(nodeId);
    rowByNodeId.set(nodeId, row);
    return row;
  };

  roots.forEach((node) => {
    assignRowFromDescendants(node.id);
  });
  bundle.nodes.forEach((node) => {
    if (contextOnlyNodeIds.has(node.id)) {
      return;
    }
    assignRowFromDescendants(node.id);
  });

  const spreadRowsWithinLanes = () => {
    laneDepths.forEach((laneDepth) => {
      const laneNodeIds = bundle.nodes
        .filter(
          (node) =>
            (depth.get(node.id) ?? 0) === laneDepth &&
            !learningNodeIds.includes(node.id) &&
            !contextOnlyNodeIds.has(node.id),
        )
        .sort((left, right) => compareNodeIds(left.id, right.id))
        .map((node) => node.id);
      if (laneNodeIds.length === 0) {
        return;
      }

      laneNodeIds.forEach((nodeId) => {
        if (rowByNodeId.has(nodeId)) {
          return;
        }
        const parentIds = parents.get(nodeId) ?? [];
        if (parentIds.length === 0) {
          rowByNodeId.set(nodeId, rowByNodeId.size);
          return;
        }
        const parentRows = parentIds
          .map((parentId) => rowByNodeId.get(parentId))
          .filter((value): value is number => typeof value === "number");
        if (parentRows.length === 0) {
          rowByNodeId.set(nodeId, 0);
          return;
        }
        rowByNodeId.set(nodeId, parentRows.reduce((sum, value) => sum + value, 0) / parentRows.length);
      });

      const orderedNodeIds = [...laneNodeIds].sort((leftId, rightId) => {
        const leftRow = rowByNodeId.get(leftId) ?? 0;
        const rightRow = rowByNodeId.get(rightId) ?? 0;
        if (Math.abs(leftRow - rightRow) > 0.0001) {
          return leftRow - rightRow;
        }
        return compareNodeIds(leftId, rightId);
      });

      const originalRows = new Map(orderedNodeIds.map((nodeId) => [nodeId, rowByNodeId.get(nodeId) ?? 0]));
      for (let index = 1; index < orderedNodeIds.length; index += 1) {
        const prevId = orderedNodeIds[index - 1];
        const nextId = orderedNodeIds[index];
        const originalPrevRow = originalRows.get(prevId) ?? 0;
        const originalNextRow = originalRows.get(nextId) ?? 0;
        const requiredRowGap = minRowGapForNodes(prevId, nextId);
        if (Math.abs(originalNextRow - originalPrevRow) >= requiredRowGap) {
          continue;
        }
        const minRow = (rowByNodeId.get(prevId) ?? 0) + requiredRowGap;
        if ((rowByNodeId.get(nextId) ?? 0) < minRow) {
          rowByNodeId.set(nextId, minRow);
        }
      }
    });
  };

  const recenterParentRowsFromChildren = () => {
    [...laneDepths].reverse().forEach((laneDepth) => {
      const laneNodeIds = bundle.nodes
        .filter(
          (node) =>
            (depth.get(node.id) ?? 0) === laneDepth &&
            !learningNodeIds.includes(node.id) &&
            !contextOnlyNodeIds.has(node.id),
        )
        .map((node) => node.id);
      laneNodeIds.forEach((nodeId) => {
        const childRows = (outgoing.get(nodeId) ?? [])
          .filter((childId) => childId !== terminalGoalNodeId && !learningNodeIds.includes(childId))
          .map((childId) => rowByNodeId.get(childId))
          .filter((value): value is number => typeof value === "number");
        if (childRows.length === 0) {
          return;
        }
        rowByNodeId.set(nodeId, childRows.reduce((sum, value) => sum + value, 0) / childRows.length);
      });
    });
  };

  spreadRowsWithinLanes();
  recenterParentRowsFromChildren();
  spreadRowsWithinLanes();
  recenterParentRowsFromChildren();
  spreadRowsWithinLanes();

  if (terminalGoalNodeId) {
    const goalParentRows = (parents.get(terminalGoalNodeId) ?? [])
      .filter((parentId) => rowByNodeId.has(parentId) && !learningNodeIds.includes(parentId))
      .map((parentId) => rowByNodeId.get(parentId))
      .filter((value): value is number => typeof value === "number");
    if (goalParentRows.length > 0) {
      const orderedRows = [...goalParentRows].sort((left, right) => left - right);
      rowByNodeId.set(terminalGoalNodeId, orderedRows[Math.floor(orderedRows.length / 2)] ?? 0);
    }
  }

  const minRow = Math.min(...[...rowByNodeId.values()], 0);
  const baseCenterY = rootBaseY + NODE_HEIGHT / 2;
  const setRowPosition = (nodeId: string, row: number) => {
    const footprint = nodeFootprintById.get(nodeId);
    const centerY = baseCenterY + (row - minRow) * rowGap;
    positionedY.set(nodeId, Math.round(centerY - (footprint?.height ?? NODE_HEIGHT) / 2));
  };

  bundle.nodes
    .filter((node) => !learningNodeIds.includes(node.id) && !contextOnlyNodeIds.has(node.id))
    .forEach((node) => {
      setRowPosition(node.id, rowByNodeId.get(node.id) ?? 0);
    });

  if (learningNodeIds.length > 0) {
    const goalRow = terminalGoalNodeId ? rowByNodeId.get(terminalGoalNodeId) ?? 0 : 0;
    learningNodeIds
      .slice()
      .sort(compareNodeIds)
      .forEach((nodeId, index) => {
        setRowPosition(nodeId, goalRow + 1 + index * 0.6);
      });
  }

  laneDepths.forEach((laneDepth) => {
    const laneNodes = mainNodes
      .filter((node) => (depth.get(node.id) ?? 0) === laneDepth)
      .sort((left, right) => (positionedY.get(left.id) ?? 0) - (positionedY.get(right.id) ?? 0));
    const laneFootprintWidth = Math.max(
      ...laneNodes.map((node) => nodeFootprintById.get(node.id)?.footprintWidth ?? 0),
      0,
    );
    const laneX = laneStartX.get(laneDepth) ?? 120;
    laneNodes.forEach((node) => {
      const footprint = nodeFootprintById.get(node.id);
      const width = footprint?.width ?? NODE_WIDTH;
      const height = footprint?.height ?? NODE_HEIGHT;
      const hasParent = (parents.get(node.id)?.length ?? 0) > 0;
      const nodeX = hasParent || laneDepth === 0 || directGoalParentIdSet.has(node.id)
        ? Math.round(laneX)
        : Math.round(laneX + Math.max(0, (laneFootprintWidth - width) / 2));
      positioned.push({
        node,
        depth: laneDepth,
        childCount: footprint?.childCount ?? 0,
        width,
        height,
        isContextOnly: false,
        x: nodeX,
        y: positionedY.get(node.id) ?? rootBaseY,
      });
    });
  });

  laneDepths.forEach((laneDepth) => {
    const laneItems = positioned
      .filter((item) => item.depth === laneDepth && !item.isContextOnly)
      .sort((left, right) => left.y - right.y);
    let laneCursorY = Number.NEGATIVE_INFINITY;
    laneItems.forEach((item) => {
      const minY = laneCursorY + laneSiblingGap;
      if (item.y < minY) {
        item.y = Math.round(minY);
      }
      laneCursorY = item.y + item.height;
    });
  });

  const primaryGoalItem = positioned.find((item) => item.node.id === primaryGoalNodeId);
  if (primaryGoalItem) {
    const radialNodeIds = new Set(positioned.map((item) => item.node.id));
    const adjacency = new Map<string, string[]>();
    positioned.forEach((item) => {
      adjacency.set(item.node.id, []);
    });
    progressionEdges.forEach((edge) => {
      if (!radialNodeIds.has(edge.source) || !radialNodeIds.has(edge.target)) {
        return;
      }
      adjacency.get(edge.source)?.push(edge.target);
      adjacency.get(edge.target)?.push(edge.source);
    });
    adjacency.forEach((items, nodeId) => {
      adjacency.set(nodeId, [...new Set(items)].sort(compareNodeIds));
    });

    const directGoalNeighborIds = (adjacency.get(primaryGoalItem.node.id) ?? [])
      .filter((nodeId) => nodeId !== primaryGoalItem.node.id)
      .sort(compareNodeIds);
    const branchSeedIds: string[] = [];
    const branchSeedIdSet = new Set<string>();
    const addSeed = (nodeId: string) => {
      if (nodeId === primaryGoalItem.node.id || branchSeedIdSet.has(nodeId)) {
        return;
      }
      branchSeedIdSet.add(nodeId);
      branchSeedIds.push(nodeId);
    };
    directGoalNeighborIds.forEach(addSeed);
    let seedFrontier = directGoalNeighborIds;
    const maxSeedCount = Math.min(
      8,
      Math.max(4, positioned.length - 1),
    );
    while (branchSeedIds.length < maxSeedCount && seedFrontier.length > 0) {
      const nextFrontier: string[] = [];
      seedFrontier.forEach((nodeId) => {
        (adjacency.get(nodeId) ?? []).forEach((neighborId) => {
          if (neighborId === primaryGoalItem.node.id) {
            return;
          }
          if (!branchSeedIdSet.has(neighborId)) {
            nextFrontier.push(neighborId);
          }
          addSeed(neighborId);
        });
      });
      seedFrontier = [...new Set(nextFrontier)].sort(compareNodeIds);
    }
    if (branchSeedIds.length === 0) {
      positioned
        .filter((item) => item.node.id !== primaryGoalItem.node.id)
        .sort((left, right) => compareNodeIds(left.node.id, right.node.id))
        .forEach((item) => addSeed(item.node.id));
    }

    const rootByNodeId = new Map<string, string>();
    const radialDistanceByNodeId = new Map<string, number>();
    const radialQueue: string[] = [];
    branchSeedIds.forEach((nodeId) => {
      rootByNodeId.set(nodeId, nodeId);
      radialDistanceByNodeId.set(nodeId, 1);
      radialQueue.push(nodeId);
    });
    while (radialQueue.length > 0) {
      const current = radialQueue.shift() as string;
      const rootId = rootByNodeId.get(current) ?? current;
      const currentDistance = radialDistanceByNodeId.get(current) ?? 1;
      (adjacency.get(current) ?? []).forEach((neighborId) => {
        if (neighborId === primaryGoalItem.node.id || rootByNodeId.has(neighborId)) {
          return;
        }
        rootByNodeId.set(neighborId, rootId);
        radialDistanceByNodeId.set(neighborId, currentDistance + 1);
        radialQueue.push(neighborId);
      });
    }
    positioned.forEach((item) => {
      if (item.node.id === primaryGoalItem.node.id || rootByNodeId.has(item.node.id)) {
        return;
      }
      rootByNodeId.set(item.node.id, item.node.id);
      radialDistanceByNodeId.set(item.node.id, 1);
      addSeed(item.node.id);
    });

    const sectorByRootId = new Map<string, (typeof PATHWAY_RADIAL_SECTORS)[number]>();
    branchSeedIds.forEach((rootId, index) => {
      sectorByRootId.set(rootId, PATHWAY_RADIAL_SECTORS[index % PATHWAY_RADIAL_SECTORS.length]);
    });
    const sectorItems = new Map<string, LayoutNode[]>(
      PATHWAY_RADIAL_SECTORS.map((sector) => [sector.id, []]),
    );
    positioned
      .filter((item) => item.node.id !== primaryGoalItem.node.id)
      .forEach((item) => {
        const rootId = rootByNodeId.get(item.node.id) ?? item.node.id;
        const sector = sectorByRootId.get(rootId) ?? PATHWAY_RADIAL_SECTORS[0];
        item.radialSector = sector.id;
        sectorItems.get(sector.id)?.push(item);
      });

    const goalCenterX = 1120;
    const goalCenterY = 620;
    primaryGoalItem.radialSector = "goal";
    primaryGoalItem.x = Math.round(goalCenterX - primaryGoalItem.width / 2);
    primaryGoalItem.y = Math.round(goalCenterY - primaryGoalItem.height / 2);
    PATHWAY_RADIAL_SECTORS.forEach((sector) => {
      const items = (sectorItems.get(sector.id) ?? []).sort((left, right) => {
        const leftRoot = rootByNodeId.get(left.node.id) ?? left.node.id;
        const rightRoot = rootByNodeId.get(right.node.id) ?? right.node.id;
        const rootDiff = branchSeedIds.indexOf(leftRoot) - branchSeedIds.indexOf(rightRoot);
        if (rootDiff !== 0) {
          return rootDiff;
        }
        const distanceDiff =
          (radialDistanceByNodeId.get(left.node.id) ?? 1) -
          (radialDistanceByNodeId.get(right.node.id) ?? 1);
        if (distanceDiff !== 0) {
          return distanceDiff;
        }
        return compareNodeIds(left.node.id, right.node.id);
      });
      items.forEach((item, index) => {
        const distance = Math.max(1, radialDistanceByNodeId.get(item.node.id) ?? 1);
        const radialX = primaryGoalItem.width / 2 + 190 + (distance - 1) * 315;
        const radialY = primaryGoalItem.height / 2 + 128 + index * 116;
        item.x = Math.round(
          sector.signX > 0
            ? goalCenterX + radialX
            : goalCenterX - radialX - item.width,
        );
        item.y = Math.round(goalCenterY + sector.signY * radialY - item.height / 2);
      });
    });
  }

  const contextNodes = bundle.nodes
    .filter((node) => contextOnlyNodeIds.has(node.id))
    .sort((left, right) => compareNodeIds(left.id, right.id));
  if (contextNodes.length > 0) {
    const maxMainX = Math.max(...positioned.map((item) => item.x + item.width), 120);
    const contextColumns = contextNodes.length > 3 ? 2 : 1;
    const contextStartX = maxMainX + 96;
    const contextStartY = rootBaseY;
    const contextColumnGap = PATHWAY_NODE_WIDTH + 64;
    const contextRowGap = PATHWAY_NODE_HEIGHT + 76;
    contextNodes.forEach((node, index) => {
      const footprint = nodeFootprintById.get(node.id);
      const width = footprint?.width ?? NODE_WIDTH;
      const height = footprint?.height ?? NODE_HEIGHT;
      const column = index % contextColumns;
      const row = Math.floor(index / contextColumns);
      positioned.push({
        node,
        depth: depth.get(node.id) ?? 0,
        childCount: 0,
        width,
        height,
        isContextOnly: true,
        x: Math.round(contextStartX + column * contextColumnGap),
        y: Math.round(contextStartY + row * contextRowGap),
      });
    });
  }

  const minX = Math.min(...positioned.map((item) => item.x), 120);
  const minY = Math.min(...positioned.map((item) => item.y));
  const maxX = Math.max(...positioned.map((item) => item.x + item.width), 0);
  const maxY = Math.max(...positioned.map((item) => item.y + item.height), 0);
  const contentWidth = Math.max(1, maxX - minX);
  const contentHeight = Math.max(1, maxY - minY);
  const horizontalPadding = 20;
  const topPadding = 76;
  const bottomPadding = 24;

  const normalized = positioned.map((item) => ({
    ...item,
    x: Math.round(item.x - minX + horizontalPadding),
    y: Math.round(item.y - minY + topPadding),
  }));

  const normalizedMinX = Math.min(...normalized.map((item) => item.x), horizontalPadding);
  const normalizedMinY = Math.min(...normalized.map((item) => item.y), topPadding);
  const normalizedMaxX = Math.max(...normalized.map((item) => item.x + item.width), contentWidth);
  const normalizedMaxY = Math.max(...normalized.map((item) => item.y + item.height), contentHeight);
  const width = Math.max(560, contentWidth + horizontalPadding * 2);
  const height = Math.max(260, contentHeight + topPadding + bottomPadding + lanePaddingBottom);

  return {
    nodes: normalized,
    width,
    height,
    bounds: { minX: normalizedMinX, minY: normalizedMinY, maxX: normalizedMaxX, maxY: normalizedMaxY },
    progressionTypeIds,
  };
}

function boundsFromRects(
  rects: Array<{ minX: number; minY: number; maxX: number; maxY: number }>,
  fallback: LayoutBounds,
): LayoutBounds {
  if (rects.length === 0) {
    return fallback;
  }

  return {
    minX: Math.min(...rects.map((item) => item.minX)),
    minY: Math.min(...rects.map((item) => item.minY)),
    maxX: Math.max(...rects.map((item) => item.maxX)),
    maxY: Math.max(...rects.map((item) => item.maxY)),
  };
}

export function buildPathwayInitialFocusBounds(layoutNodes: LayoutNode[], fallback: LayoutBounds): LayoutBounds {
  const primaryNodes = layoutNodes.filter((node) => !node.isContextOnly);
  const focusNodes = primaryNodes.length > 0 ? primaryNodes : layoutNodes;
  return boundsFromRects(
    focusNodes.map((item) => ({
      minX: item.x,
      minY: item.y,
      maxX: item.x + item.width,
      maxY: item.y + item.height,
    })),
    fallback,
  );
}

function boundsFromCanvasNodes(nodes: GraphNode[], fallback: LayoutBounds): LayoutBounds {
  return boundsFromRects(
    nodes.map((node) => {
      const config = (node.config as Record<string, unknown>) ?? {};
      const width = Number(config?.pathwayVisualWidth ?? NODE_WIDTH);
      const height = Number(config?.pathwayVisualHeight ?? NODE_HEIGHT);
      return {
        minX: node.position.x,
        minY: node.position.y,
        maxX: node.position.x + width,
        maxY: node.position.y + height,
      };
    }),
    fallback,
  );
}

function isContextOnlyCanvasNode(node: GraphNode): boolean {
  return Boolean((node.config as Record<string, unknown> | undefined)?.pathwayContextOnly);
}

export function buildPathwayCanvasInitialFocusBounds(nodes: GraphNode[], fallback: LayoutBounds): LayoutBounds {
  const primaryNodes = nodes.filter((node) => !isContextOnlyCanvasNode(node));
  return boundsFromCanvasNodes(primaryNodes.length > 0 ? primaryNodes : nodes, fallback);
}

export function resolvePathwayInitialViewport({
  canvasWidth,
  canvasHeight,
  focusBounds,
  stageInsetX,
  stageInsetY,
}: {
  canvasWidth: number;
  canvasHeight: number;
  focusBounds: LayoutBounds;
  stageInsetX: number;
  stageInsetY: number;
}): { zoom: number; scrollLeft: number; scrollTop: number } {
  const viewportPaddingX = Math.min(144, Math.max(80, canvasWidth * 0.08));
  const viewportPaddingY = Math.min(116, Math.max(72, canvasHeight * 0.12));
  const availableWidth = Math.max(120, canvasWidth - viewportPaddingX * 2);
  const availableHeight = Math.max(120, canvasHeight - viewportPaddingY * 2);
  const contentWidth = Math.max(1, focusBounds.maxX - focusBounds.minX);
  const contentHeight = Math.max(1, focusBounds.maxY - focusBounds.minY);
  const fitX = availableWidth / contentWidth;
  const fitY = availableHeight / contentHeight;
  const zoom = clampZoom(Math.max(PATHWAY_INITIAL_MIN_READABLE_ZOOM, Math.min(PATHWAY_INITIAL_MAX_ZOOM, fitX, fitY)));
  const scaledWidth = contentWidth * zoom;
  const scaledHeight = contentHeight * zoom;
  const focusCenterX = ((focusBounds.minX + focusBounds.maxX) / 2) * zoom;
  const focusCenterY = ((focusBounds.minY + focusBounds.maxY) / 2) * zoom;
  const centeredScrollLeft = stageInsetX + focusCenterX - canvasWidth / 2;
  const centeredScrollTop = stageInsetY + focusCenterY - canvasHeight / 2;
  const leftAnchoredScrollLeft = stageInsetX + focusBounds.minX * zoom - viewportPaddingX;
  const topAnchoredScrollTop = stageInsetY + focusBounds.minY * zoom - viewportPaddingY;
  const scrollLeft =
    scaledWidth <= availableWidth * 1.45
      ? centeredScrollLeft
      : leftAnchoredScrollLeft;
  const scrollTop =
    scaledHeight <= availableHeight * 1.35
      ? centeredScrollTop
      : topAnchoredScrollTop;

  return {
    zoom,
    scrollLeft: Math.max(0, scrollLeft),
    scrollTop: Math.max(0, scrollTop),
  };
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

type PathwayRailCanvasProps = {
  bundle: GraphBundle;
  baseBundle?: GraphBundle;
  overlayActions?: ReactNode;
  overlayStats?: ReactNode;
  onFullscreenChange?: (isFullscreen: boolean) => void;
  revisionPreview?: RevisionProposalRecord | null;
  selectedNodeId: string | null;
  selectedRouteId: string | null;
  activeProgressNodeIds?: Set<string>;
  onSelectNode: (nodeId: string) => void;
};

type PreviewNodeVisual = {
  changeType: string;
  nextStatus: string;
  reason: string;
};

type PreviewEdgeVisual = {
  changeType: string;
  reason: string;
};

function edgeIdentity(edge: GraphEdgeRecord): string {
  return `${edge.source}:${edge.target}`;
}

function buildPreviewNodeMap(proposal: RevisionProposalRecord | null): Map<string, PreviewNodeVisual> {
  const map = new Map<string, PreviewNodeVisual>();
  if (!proposal) {
    return map;
  }

  for (const change of proposal.diff.node_changes) {
    map.set(change.node_id, {
      changeType: change.change_type,
      nextStatus: change.next_status ?? "",
      reason: change.reason
    });
  }

  return map;
}

function buildPreviewEdgeMap(
  bundle: GraphBundle,
  baseBundle: GraphBundle | undefined,
  proposal: RevisionProposalRecord | null
): Map<string, PreviewEdgeVisual> {
  const map = new Map<string, PreviewEdgeVisual>();
  if (!proposal) {
    return map;
  }

  const visibleEdges = new Map(bundle.edges.map((edge) => [edge.id || edgeIdentity(edge), edge]));
  const baseEdges = new Map((baseBundle?.edges ?? []).map((edge) => [edge.id || edgeIdentity(edge), edge]));

  for (const change of proposal.diff.edge_changes) {
    const visibleEdge =
      visibleEdges.get(change.edge_id) ??
      bundle.edges.find((edge) => edge.source === change.source && edge.target === change.target);
    const baseEdge =
      baseEdges.get(change.edge_id) ??
      baseBundle?.edges.find((edge) => edge.source === change.source && edge.target === change.target);
    const targetEdge = visibleEdge ?? baseEdge;
    if (!targetEdge) {
      continue;
    }
    map.set(edgeIdentity(targetEdge), {
      changeType: change.change_type,
      reason: change.reason
    });
  }

  return map;
}

const EMPTY_NODE_STATES: Record<string, NodeRunState> = {};
const EMPTY_SELECTION: Set<string> = new Set();
const EMPTY_DIRECT_INPUTS: Set<string> = new Set();
const EMPTY_PROGRESS_NODE_IDS: Set<string> = new Set();
const EMPTY_ANCHORS: readonly NodeAnchorSide[] = [];
const PATHWAY_STAGE_INSET_X = 96;
const PATHWAY_STAGE_INSET_Y = 20;
const PATHWAY_STAGE_INSET_BOTTOM = 132;

function clampZoom(value: number): number {
  return Math.max(0.5, Math.min(1.8, Number(value.toFixed(2))));
}

function buildCollapsedDescendantSet(bundle: GraphBundle, collapsedNodeIds: Set<string>): Set<string> {
  if (collapsedNodeIds.size === 0) {
    return new Set();
  }

  const progressionTypeIds = new Set(
    bundle.ontology.edge_types.filter((item) => item.role === "progression").map((item) => item.id),
  );
  const outgoing = new Map<string, string[]>();

  bundle.nodes.forEach((node) => {
    outgoing.set(node.id, []);
  });

  bundle.edges.forEach((edge) => {
    if (!progressionTypeIds.has(edge.type)) {
      return;
    }
    outgoing.get(edge.source)?.push(edge.target);
  });

  const hiddenNodeIds = new Set<string>();
  for (const collapsedNodeId of collapsedNodeIds) {
    const queue = [...(outgoing.get(collapsedNodeId) ?? [])];
    while (queue.length > 0) {
      const current = queue.shift() as string;
      if (hiddenNodeIds.has(current) || collapsedNodeIds.has(current)) {
        continue;
      }
      hiddenNodeIds.add(current);
      queue.push(...(outgoing.get(current) ?? []));
    }
  }

  return hiddenNodeIds;
}

export default function PathwayRailCanvas({
  bundle,
  baseBundle,
  overlayActions,
  overlayStats,
  onFullscreenChange,
  revisionPreview = null,
  selectedNodeId,
  selectedRouteId,
  activeProgressNodeIds = EMPTY_PROGRESS_NODE_IDS,
  onSelectNode,
}: PathwayRailCanvasProps) {
  const [canvasZoom, setCanvasZoom] = useState(1);
  const [canvasFullscreen, setCanvasFullscreen] = useState(false);
  const [panMode, setPanMode] = useState(false);
  const [collapsedBranchNodeIds, setCollapsedBranchNodeIds] = useState<Set<string>>(new Set());
  const [selectedNodeIds, setSelectedNodeIds] = useState<string[]>(selectedNodeId ? [selectedNodeId] : []);
  const [selectedEdgeKey, setSelectedEdgeKey] = useState("");
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [marqueeSelection, setMarqueeSelection] = useState<MarqueeSelection | null>(null);
  const [panState, setPanState] = useState<CanvasPanState | null>(null);
  const graphCanvasRef = useRef<HTMLDivElement | null>(null);
  const viewportTouchedRef = useRef(false);
  const selectedNodeIdsRef = useRef<string[]>(selectedNodeId ? [selectedNodeId] : []);
  const previewNodeMap = useMemo(() => buildPreviewNodeMap(revisionPreview), [revisionPreview]);
  const previewEdgeMap = useMemo(
    () => buildPreviewEdgeMap(bundle, baseBundle, revisionPreview),
    [baseBundle, bundle, revisionPreview]
  );

  useEffect(() => {
    const fallbackId = selectedNodeId ?? selectedRouteId;
    setSelectedNodeIds(fallbackId ? [fallbackId] : []);
  }, [selectedNodeId, selectedRouteId]);

  useEffect(() => {
    selectedNodeIdsRef.current = selectedNodeIds;
  }, [selectedNodeIds]);

  useEffect(() => {
    onFullscreenChange?.(canvasFullscreen);
  }, [canvasFullscreen, onFullscreenChange]);

  const adapted = useMemo(() => {
    const layout = buildPathwayLayout(bundle);
    const nodeTypes = new Map(bundle.ontology.node_types.map((item) => [item.id, item]));
    const layoutNodeById = new Map(layout.nodes.map((item) => [item.node.id, item]));
    const goalLayoutNode = layout.nodes.find((item) => {
      if (item.radialSector === "goal") {
        return true;
      }
      const displayRole = normalizeGraphSearchText((item.node.data as Record<string, unknown> | undefined)?.pathway_display_role);
      return displayRole === PRIMARY_GOAL_DATA_ROLE || nodeSemanticFamily(nodeTypes.get(item.node.type), item.node) === "goal";
    });
    const nodes: GraphNode[] = layout.nodes.map(({ node, x, y, depth, childCount, width, height, isContextOnly, radialSector }) => {
      const previewVisual = previewNodeMap.get(node.id);
      return {
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
          pathwayContextOnly: isContextOnly,
          pathwaySector: radialSector ?? "",
          pathwayPreviewChange: previewVisual?.changeType ?? "",
          pathwayPreviewStatus: previewVisual?.nextStatus ?? "",
          pathwayPreviewReason: previewVisual?.reason ?? "",
          pathwayProgressActive: activeProgressNodeIds.has(node.id),
        },
      };
    });
    const edgeInputs = goalLayoutNode
      ? layout.nodes
          .filter((item) => item.node.id !== goalLayoutNode.node.id && !item.isContextOnly)
          .map((item) => ({
            edgeKey: `radial:${item.node.id}:${goalLayoutNode.node.id}`,
            source: item.node.id,
            target: goalLayoutNode.node.id,
          }))
      : reduceProgressionEdgesForDisplay(bundle.edges.filter((edge) => layout.progressionTypeIds.has(edge.type)))
          .map((edge) => ({
            edgeKey: edgeIdentity(edge),
            source: edge.source,
            target: edge.target,
          }));
    const edges = edgeInputs
      .map((edge) => {
        const source = layoutNodeById.get(edge.source);
        const target = layoutNodeById.get(edge.target);
        const sides =
          source && target
            ? resolvePathwayEdgeSides(source, target)
            : null;
        return {
          from: { nodeId: edge.source, port: "out" as const, side: sides?.fromSide },
          to: { nodeId: edge.target, port: "in" as const, side: sides?.toSide },
        };
      });
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
      bounds: layout.bounds,
      initialFocusBounds: buildPathwayInitialFocusBounds(layout.nodes, layout.bounds),
    };
  }, [activeProgressNodeIds, bundle, previewNodeMap]);

  const [graphData, setGraphData] = useState<GraphData>(adapted.graph);

  const hiddenNodeIds = useMemo(
    () => buildCollapsedDescendantSet(bundle, collapsedBranchNodeIds),
    [bundle, collapsedBranchNodeIds],
  );

  useEffect(() => {
    const visibleNodes = adapted.graph.nodes.filter((node) => !hiddenNodeIds.has(node.id));
    const visibleNodeIdSet = new Set(visibleNodes.map((node) => node.id));
    setGraphData({
      ...adapted.graph,
      nodes: visibleNodes,
      edges: adapted.graph.edges.filter(
        (edge) => visibleNodeIdSet.has(edge.from.nodeId) && visibleNodeIdSet.has(edge.to.nodeId),
      ),
    });
  }, [adapted.graph, hiddenNodeIds]);

  useEffect(() => {
    viewportTouchedRef.current = false;
  }, [bundle.bundle_id]);

  useEffect(() => {
    setCollapsedBranchNodeIds(new Set());
  }, [bundle.bundle_id]);

  const initialFocusBounds = useMemo(() => {
    if (graphData.nodes.length === 0) {
      return adapted.initialFocusBounds;
    }

    return buildPathwayCanvasInitialFocusBounds(graphData.nodes, adapted.initialFocusBounds);
  }, [adapted.initialFocusBounds, graphData.nodes]);

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

      const viewport = resolvePathwayInitialViewport({
        canvasWidth: bounds.width,
        canvasHeight: bounds.height,
        focusBounds: initialFocusBounds,
        stageInsetX: PATHWAY_STAGE_INSET_X,
        stageInsetY: PATHWAY_STAGE_INSET_Y,
      });
      setCanvasZoom(viewport.zoom);
      const applyScroll = () => {
        canvas.scrollLeft = viewport.scrollLeft;
        canvas.scrollTop = viewport.scrollTop;
      };
      applyScroll();
      window.requestAnimationFrame(applyScroll);
    };

    fitCanvas();

    const resizeObserver = new ResizeObserver(() => {
      fitCanvas();
    });
    resizeObserver.observe(canvas);

    return () => {
      resizeObserver.disconnect();
    };
  }, [adapted.bounds, adapted.height, adapted.width, initialFocusBounds]);

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
      routeStyle: "straight",
      preferNearTargetElbow: (node) => {
        const config = node.config as Record<string, unknown> | undefined;
        return String(config?.sourceKind ?? "").trim() === "pathway"
          && String(config?.pathwayFamily ?? "").trim() === "goal";
      },
      separateIncomingTargetAnchors: (node) => {
        const config = node.config as Record<string, unknown> | undefined;
        return String(config?.sourceKind ?? "").trim() === "pathway"
          && String(config?.pathwayFamily ?? "").trim() === "goal";
      },
      alignCloseBundledSplitMergeLanes: false,
    }).map((line) => {
      const previewVisual = previewEdgeMap.get(line.edgeKey);
      return {
        ...line,
        previewChange: previewVisual?.changeType,
        previewReason: previewVisual?.reason,
      };
    });
  }, [graphData, previewEdgeMap]);

  const setNodeSelection = (nodeIds: string[], focusedNodeId?: string) => {
    setSelectedNodeIds(nodeIds);
    const next = focusedNodeId ?? nodeIds[0];
    if (next) {
      onSelectNode(next);
    }
  };

  const togglePathwayBranch = (nodeId: string) => {
    viewportTouchedRef.current = true;
    setCollapsedBranchNodeIds((current) => {
      const next = new Set(current);
      if (next.has(nodeId)) {
        next.delete(nodeId);
      } else {
        next.add(nodeId);
      }
      return next;
    });
  };

  const zoomIn = () => {
    viewportTouchedRef.current = true;
    setCanvasZoom((current) => Math.min(1.8, Number((current + 0.1).toFixed(2))));
  };
  const zoomOut = () => {
    viewportTouchedRef.current = true;
    setCanvasZoom((current) => Math.max(0.5, Number((current - 0.1).toFixed(2))));
  };

  const getNodeVisualSize = (node: GraphNode): { width: number; height: number } => {
    const config = (node.config as Record<string, unknown>) ?? {};
    return {
      width: Number(config.pathwayVisualWidth ?? NODE_WIDTH),
      height: Number(config.pathwayVisualHeight ?? NODE_HEIGHT),
    };
  };

  const toLogicalPoint = (event: ReactMouseEvent<HTMLDivElement>): { x: number; y: number } | null => {
    const canvas = graphCanvasRef.current;
    if (!canvas) {
      return null;
    }
    const rect = canvas.getBoundingClientRect();
    return {
      x: (event.clientX - rect.left + canvas.scrollLeft - PATHWAY_STAGE_INSET_X) / canvasZoom,
      y: (event.clientY - rect.top + canvas.scrollTop - PATHWAY_STAGE_INSET_Y) / canvasZoom,
    };
  };

  const clientToLogicalPoint = (clientX: number, clientY: number): { x: number; y: number } | null => {
    const canvas = graphCanvasRef.current;
    if (!canvas) {
      return null;
    }
    const rect = canvas.getBoundingClientRect();
    return {
      x: (clientX - rect.left + canvas.scrollLeft - PATHWAY_STAGE_INSET_X) / canvasZoom,
      y: (clientY - rect.top + canvas.scrollTop - PATHWAY_STAGE_INSET_Y) / canvasZoom,
    };
  };

  const applyDragDelta = (clientX: number, clientY: number, shiftKey: boolean) => {
    if (!dragState) {
      return;
    }
    const pointer = clientToLogicalPoint(clientX, clientY);
    if (!pointer) {
      return;
    }
    const dx = pointer.x - dragState.pointerStart.x;
    const dy = pointer.y - dragState.pointerStart.y;
    let nextDx = dx;
    let nextDy = dy;
    if (shiftKey && dragState.nodeIds.length > 0) {
      const anchorNodeId = dragState.nodeIds[0];
      const anchorStart = dragState.startPositions[anchorNodeId];
      if (anchorStart) {
        const candidates = graphData.nodes.filter((node) => !dragState.nodeIds.includes(node.id));
        const snappedX = snapToLayoutGrid(
          snapToNearbyNodeAxis(anchorStart.x + dx, "x", candidates, 28),
          "x",
          28,
        );
        const snappedY = snapToLayoutGrid(
          snapToNearbyNodeAxis(anchorStart.y + dy, "y", candidates, 28),
          "y",
          28,
        );
        nextDx = Math.round(snappedX - anchorStart.x);
        nextDy = Math.round(snappedY - anchorStart.y);
      }
    }
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
            x: Math.round(start.x + nextDx),
            y: Math.round(start.y + nextDy),
          },
        };
      }),
    }));
  };

  const finalizeMarqueeSelection = (selection: MarqueeSelection) => {
    const hitPadding = Math.max(4, 8 / Math.max(canvasZoom, 0.55));
    const minX = Math.min(selection.start.x, selection.current.x) - hitPadding;
    const maxX = Math.max(selection.start.x, selection.current.x) + hitPadding;
    const minY = Math.min(selection.start.y, selection.current.y) - hitPadding;
    const maxY = Math.max(selection.start.y, selection.current.y) + hitPadding;
    const selectedByBox = graphData.nodes
      .filter((node) => {
        const size = getNodeVisualSize(node);
        const nodeLeft = node.position.x;
        const nodeTop = node.position.y;
        const nodeRight = node.position.x + size.width;
        const nodeBottom = node.position.y + size.height;
        const centerX = nodeLeft + size.width / 2;
        const centerY = nodeTop + size.height / 2;
        const overlapsBox = !(nodeRight < minX || nodeLeft > maxX || nodeBottom < minY || nodeTop > maxY);
        const containsCenter = centerX >= minX && centerX <= maxX && centerY >= minY && centerY <= maxY;
        return overlapsBox || containsCenter;
      })
      .map((node) => node.id);
    const nextSelected = selection.append
      ? Array.from(new Set([...selectedNodeIdsRef.current, ...selectedByBox]))
      : selectedByBox;
    setNodeSelection(nextSelected, nextSelected[nextSelected.length - 1]);
    setSelectedEdgeKey("");
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
    if (panState) {
      const canvas = graphCanvasRef.current;
      if (!canvas) {
        return;
      }
      canvas.scrollLeft = Math.max(0, panState.scrollLeft - (event.clientX - panState.pointerClientX));
      canvas.scrollTop = Math.max(0, panState.scrollTop - (event.clientY - panState.pointerClientY));
      return;
    }
    if (marqueeSelection) {
      const point = toLogicalPoint(event);
      if (!point) {
        return;
      }
      setMarqueeSelection((current) => (current ? { ...current, current: point } : current));
      return;
    }
    if (!dragState) {
      return;
    }
    applyDragDelta(event.clientX, event.clientY, event.shiftKey);
  };

  const onCanvasMouseUp = () => {
    if (panState) {
      setPanState(null);
    }
    if (marqueeSelection) {
      finalizeMarqueeSelection(marqueeSelection);
      setMarqueeSelection(null);
    }
    if (dragState) {
      setDragState(null);
    }
  };

  const onCanvasMouseDown = (event: ReactMouseEvent<HTMLDivElement>) => {
    const canvas = graphCanvasRef.current;
    if (!canvas) {
      return;
    }
    const target = event.target as HTMLElement | null;
    const isBackdrop =
      target === event.currentTarget ||
      target?.classList.contains("graph-stage-shell") ||
      target?.classList.contains("graph-stage") ||
      target?.classList.contains("edge-layer");
    if (!isBackdrop) {
      return;
    }
    viewportTouchedRef.current = true;
    if (panMode) {
      event.preventDefault();
      setPanState({
        pointerClientX: event.clientX,
        pointerClientY: event.clientY,
        scrollLeft: canvas.scrollLeft,
        scrollTop: canvas.scrollTop,
      });
      return;
    }
    if (!event.shiftKey) {
      setSelectedNodeIds([]);
    }
    setSelectedEdgeKey("");
    const point = toLogicalPoint(event);
    if (!point) {
      return;
    }
    event.preventDefault();
    setMarqueeSelection({
      start: point,
      current: point,
      append: event.shiftKey,
    });
  };

  useEffect(() => {
    if (!dragState && !marqueeSelection && !panState) {
      return;
    }

    const handleWindowMouseMove = (event: MouseEvent) => {
      if (panState) {
        const canvas = graphCanvasRef.current;
        if (!canvas) {
          return;
        }
        canvas.scrollLeft = Math.max(0, panState.scrollLeft - (event.clientX - panState.pointerClientX));
        canvas.scrollTop = Math.max(0, panState.scrollTop - (event.clientY - panState.pointerClientY));
        return;
      }
      if (marqueeSelection) {
        const point = clientToLogicalPoint(event.clientX, event.clientY);
        if (!point) {
          return;
        }
        setMarqueeSelection((current) => (current ? { ...current, current: point } : current));
        return;
      }
      if (dragState) {
        applyDragDelta(event.clientX, event.clientY, event.shiftKey);
      }
    };

    const handleWindowMouseUp = (event: MouseEvent) => {
      if (panState) {
        setPanState(null);
      }
      if (marqueeSelection) {
        const point = clientToLogicalPoint(event.clientX, event.clientY);
        const nextSelection = point ? { ...marqueeSelection, current: point } : marqueeSelection;
        finalizeMarqueeSelection(nextSelection);
        setMarqueeSelection(null);
      }
      if (dragState) {
        setDragState(null);
      }
    };

    window.addEventListener("mousemove", handleWindowMouseMove);
    window.addEventListener("mouseup", handleWindowMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleWindowMouseMove);
      window.removeEventListener("mouseup", handleWindowMouseUp);
    };
  }, [dragState, marqueeSelection, panState, graphData.nodes, selectedNodeIds]);

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
    if (!event.metaKey && !event.ctrlKey && !event.altKey) {
      const keyLower = event.key.toLowerCase();
      const isPanToggleKey = keyLower === "h" || event.key === "ㅗ" || event.code === "KeyH";
      if (isPanToggleKey) {
        event.preventDefault();
        setPanMode((current) => !current);
        return;
      }
    }
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
      {revisionPreview ? (
        <div className="pathway-canvas-preview-legend">
          <span className="pathway-canvas-preview-pill is-added">새 루트</span>
          <span className="pathway-canvas-preview-pill is-updated">약화/수정</span>
          <span className="pathway-canvas-preview-pill is-removed">차단/제거</span>
        </div>
      ) : null}
      <WorkflowCanvasPane
        canvasVariant="pathway"
        pathwayOverlayActions={overlayActions}
        pathwayOverlayStats={overlayStats}
        panMode={panMode}
        onCanvasKeyDown={onCanvasKeyDown}
        onCanvasMouseDown={onCanvasMouseDown}
        onCanvasMouseMove={onCanvasMouseMove}
        onCanvasMouseUp={onCanvasMouseUp}
        onCanvasWheel={onCanvasWheel}
        graphCanvasRef={graphCanvasRef}
        onActivateWorkspacePanels={() => {}}
        boundedStageWidth={adapted.width}
        boundedStageHeight={adapted.height}
        canvasZoom={canvasZoom}
        graphViewMode="graph"
        stageInsetX={PATHWAY_STAGE_INSET_X}
        stageInsetY={PATHWAY_STAGE_INSET_Y}
        stageInsetBottom={PATHWAY_STAGE_INSET_BOTTOM}
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
        collapsedPathwayNodeIds={collapsedBranchNodeIds}
        onTogglePathwayBranch={togglePathwayBranch}
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
        marqueeSelection={marqueeSelection}
        onCanvasZoomIn={zoomIn}
        onCanvasZoomOut={zoomOut}
        canvasFullscreen={canvasFullscreen}
        setCanvasFullscreen={setCanvasFullscreen}
        setPanMode={setPanMode}
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
