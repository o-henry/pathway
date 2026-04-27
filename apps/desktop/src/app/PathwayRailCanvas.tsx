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

type LayoutNode = {
  node: GraphNodeRecord;
  x: number;
  y: number;
  depth: number;
  childCount: number;
  width: number;
  height: number;
};

type LayoutBounds = {
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
const PERSONAL_LEARNING_DATA_ROLE = "personal_learning";
const PATHWAY_NODE_WIDTH = 220;
const PATHWAY_NODE_HEIGHT = 56;
const PATHWAY_GOAL_WIDTH = 260;
const PATHWAY_LEARNING_WIDTH = 240;

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
  if (dataRole === TERMINAL_GOAL_DATA_ROLE) {
    return true;
  }
  const value = normalizeGraphSearchText(`${definition?.id ?? ""} ${definition?.label ?? ""} ${node.type} ${node.label}`);
  return semanticTextIncludesGoal(value);
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
  if (nodeLooksLikeGoal(definition, node)) {
    return "goal";
  }
  if (dataRole === PERSONAL_LEARNING_DATA_ROLE || value.includes("learning") || value.includes("학습")) {
    return "learning";
  }
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
  const fallbackGoalLabel =
    userGoalLabel ||
    next.nodes.find((node) => nodeLooksLikeGoal(nodeTypes.get(node.type), node))?.label ||
    next.map.title ||
    "GOAL";

  let goalNode = next.nodes.find((node) => nodeLooksLikeGoal(nodeTypes.get(node.type), node));
  if (!goalNode) {
    const goalNodeId = makeUniqueNodeId("goal", existingNodeIds);
    goalNode = {
      id: goalNodeId,
      type: goalTypeId,
      label: fallbackGoalLabel,
      summary: "사용자가 기입한 최종 목표입니다. 모든 진행 루트는 이 노드로 수렴합니다.",
      data: {
        source: "user_goal",
        pathway_display_role: TERMINAL_GOAL_DATA_ROLE,
      },
      evidence_refs: [],
      assumption_refs: [],
    };
    next.nodes.push(goalNode);
    existingNodeIds.add(goalNodeId);
  } else {
    goalNode.type = goalTypeId;
    goalNode.label = fallbackGoalLabel;
    goalNode.summary = goalNode.summary || "사용자가 기입한 최종 목표입니다.";
    goalNode.data = {
      ...goalNode.data,
      source: (goalNode.data as Record<string, unknown> | undefined)?.source ?? "user_goal",
      pathway_display_role: TERMINAL_GOAL_DATA_ROLE,
    };
  }

  const goalNodeId = goalNode.id;
  const nonGoalNodeIds = new Set(
    next.nodes.filter((node) => node.id !== goalNodeId).map((node) => node.id),
  );
  const nonProgressionEdges = next.edges.filter((edge) => edge.type !== progressionTypeId);
  const nonGoalProgressionEdges = next.edges.filter(
    (edge) => edge.type === progressionTypeId && edge.source !== goalNodeId && edge.target !== goalNodeId,
  );
  const outgoing = new Map<string, number>();
  nonGoalNodeIds.forEach((nodeId) => outgoing.set(nodeId, 0));
  nonGoalProgressionEdges.forEach((edge) => {
    if (nonGoalNodeIds.has(edge.source) && nonGoalNodeIds.has(edge.target)) {
      outgoing.set(edge.source, (outgoing.get(edge.source) ?? 0) + 1);
    }
  });

  const terminalNodeIds = [...nonGoalNodeIds].filter((nodeId) => (outgoing.get(nodeId) ?? 0) === 0);
  const existingEdgeIds = new Set(next.edges.map((edge) => edge.id));
  const terminalGoalEdges = terminalNodeIds.map((nodeId) => {
    const baseId = `terminal_goal_${nodeId}`;
    const edgeId = makeUniqueEdgeId(baseId, existingEdgeIds);
    existingEdgeIds.add(edgeId);
    return {
      id: edgeId,
      type: progressionTypeId,
      source: nodeId,
      target: goalNodeId,
      label: "GOAL",
    };
  });

  next.edges = [...nonProgressionEdges, ...nonGoalProgressionEdges, ...terminalGoalEdges];
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

  if (target.depth > source.depth) {
    return { fromSide: "right", toSide: "left" };
  }

  if (Math.abs(dx) >= Math.abs(dy)) {
    return dx >= 0
      ? { fromSide: "right", toSide: "left" }
      : { fromSide: "left", toSide: "right" };
  }

  return dy >= 0
    ? { fromSide: "bottom", toSide: "top" }
    : { fromSide: "top", toSide: "bottom" };
}

function buildLayout(bundle: GraphBundle): { nodes: LayoutNode[]; width: number; height: number; bounds: LayoutBounds; progressionTypeIds: Set<string> } {
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
  const goalNodeId =
    bundle.nodes.find(
      (node) =>
        normalizeGraphSearchText((node.data as Record<string, unknown> | undefined)?.pathway_display_role) ===
        TERMINAL_GOAL_DATA_ROLE,
    )?.id ?? null;
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

  const compareNodeIds = (leftId: string, rightId: string) =>
    (nodeById.get(leftId)?.label ?? leftId).localeCompare(nodeById.get(rightId)?.label ?? rightId);

  parents.forEach((items, nodeId) => {
    parents.set(nodeId, [...items].sort(compareNodeIds));
  });

  outgoing.forEach((items, nodeId) => {
    outgoing.set(nodeId, [...items].sort(compareNodeIds));
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

  if (goalNodeId) {
    const directGoalParentIds = (parents.get(goalNodeId) ?? []).filter((nodeId) => !learningNodeIds.includes(nodeId));
    const terminalLaneDepth = Math.max(
      0,
      ...bundle.nodes
        .filter((node) => node.id !== goalNodeId && !learningNodeIds.includes(node.id))
        .map((node) => depth.get(node.id) ?? 0),
    );
    directGoalParentIds.forEach((nodeId) => {
      depth.set(nodeId, terminalLaneDepth);
    });
    const goalDepth = terminalLaneDepth + 1;
    depth.set(goalNodeId, goalDepth);
    learningNodeIds.forEach((nodeId) => {
      depth.set(nodeId, Math.max(0, goalDepth - 1));
    });
  }
  const directGoalParentIdSet = new Set(
    goalNodeId ? (parents.get(goalNodeId) ?? []).filter((nodeId) => !learningNodeIds.includes(nodeId)) : [],
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
  const laneDepths = [...new Set(bundle.nodes.map((node) => depth.get(node.id) ?? 0))].sort((a, b) => a - b);
  const rootBaseY = 108;
  const horizontalGap = 56;
  const rootRowGap = 48;
  const laneSiblingGap = 72;
  const lanePaddingBottom = 24;
  const laneStartX = new Map<number, number>();
  let laneCursorX = 120;
  laneDepths.forEach((laneDepth) => {
    const laneNodes = bundle.nodes.filter((node) => (depth.get(node.id) ?? 0) === laneDepth);
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
  const rowByNodeId = new Map<string, number>();
  roots.forEach((node, index) => {
    rowByNodeId.set(node.id, index);
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

  laneDepths
    .filter((laneDepth) => laneDepth > 0)
    .forEach((laneDepth) => {
      const laneNodeIds = bundle.nodes
        .filter((node) => (depth.get(node.id) ?? 0) === laneDepth && !learningNodeIds.includes(node.id))
        .sort((left, right) => compareNodeIds(left.id, right.id))
        .map((node) => node.id);
      if (laneNodeIds.length === 0) {
        return;
      }

      laneNodeIds.forEach((nodeId) => {
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
        if (Math.abs(originalNextRow - originalPrevRow) >= 0.75) {
          continue;
        }
        const minRow = (rowByNodeId.get(prevId) ?? 0) + minRowGapForNodes(prevId, nextId);
        if ((rowByNodeId.get(nextId) ?? 0) < minRow) {
          rowByNodeId.set(nextId, minRow);
        }
      }
    });

  if (goalNodeId) {
    const directGoalParentIds = (parents.get(goalNodeId) ?? [])
      .filter((parentId) => rowByNodeId.has(parentId) && !learningNodeIds.includes(parentId))
      .sort((leftId, rightId) => {
        const leftHasParent = (parents.get(leftId) ?? []).some((parentId) => parentId !== goalNodeId);
        const rightHasParent = (parents.get(rightId) ?? []).some((parentId) => parentId !== goalNodeId);
        if (leftHasParent !== rightHasParent) {
          return leftHasParent ? -1 : 1;
        }
        const depthDiff = (depth.get(rightId) ?? 0) - (depth.get(leftId) ?? 0);
        if (depthDiff !== 0) {
          return depthDiff;
        }
        return compareNodeIds(leftId, rightId);
      });
    const primaryGoalParentId = directGoalParentIds[0];
    if (primaryGoalParentId) {
      const primaryParentRows = (parents.get(primaryGoalParentId) ?? [])
        .filter((parentId) => parentId !== goalNodeId)
        .map((parentId) => rowByNodeId.get(parentId))
        .filter((value): value is number => typeof value === "number");
      const primaryRow =
        primaryParentRows.length > 0
          ? primaryParentRows.reduce((sum, value) => sum + value, 0) / primaryParentRows.length
          : rowByNodeId.get(primaryGoalParentId) ?? 0;
      directGoalParentIds.forEach((nodeId, index) => {
        rowByNodeId.set(nodeId, primaryRow + index);
      });
    }
  }

  if (goalNodeId) {
    const goalParentRows = (parents.get(goalNodeId) ?? [])
      .filter((parentId) => rowByNodeId.has(parentId) && !learningNodeIds.includes(parentId))
      .map((parentId) => rowByNodeId.get(parentId))
      .filter((value): value is number => typeof value === "number");
    if (goalParentRows.length > 0) {
      rowByNodeId.set(
        goalNodeId,
        goalParentRows.reduce((sum, value) => sum + value, 0) / goalParentRows.length,
      );
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
    .filter((node) => !learningNodeIds.includes(node.id))
    .forEach((node) => {
      setRowPosition(node.id, rowByNodeId.get(node.id) ?? 0);
    });

  if (learningNodeIds.length > 0) {
    const goalRow = goalNodeId ? rowByNodeId.get(goalNodeId) ?? 0 : 0;
    learningNodeIds
      .slice()
      .sort(compareNodeIds)
      .forEach((nodeId, index) => {
        setRowPosition(nodeId, goalRow + 1 + index * 0.6);
      });
  }

  laneDepths.forEach((laneDepth) => {
    const laneNodes = bundle.nodes
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
        x: nodeX,
        y: positionedY.get(node.id) ?? rootBaseY,
      });
    });
  });

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
const PATHWAY_STAGE_INSET_X = 16;
const PATHWAY_STAGE_INSET_Y = 20;
const PATHWAY_STAGE_INSET_BOTTOM = 132;

function clampZoom(value: number): number {
  return Math.max(0.72, Math.min(1.8, Number(value.toFixed(2))));
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
    const layout = buildLayout(bundle);
    const nodeTypes = new Map(bundle.ontology.node_types.map((item) => [item.id, item]));
    const layoutNodeById = new Map(layout.nodes.map((item) => [item.node.id, item]));
    const nodes: GraphNode[] = layout.nodes.map(({ node, x, y, depth, childCount, width, height }) => {
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
          pathwayPreviewChange: previewVisual?.changeType ?? "",
          pathwayPreviewStatus: previewVisual?.nextStatus ?? "",
          pathwayPreviewReason: previewVisual?.reason ?? "",
          pathwayProgressActive: activeProgressNodeIds.has(node.id),
        },
      };
    });
    const edges = reduceProgressionEdgesForDisplay(bundle.edges.filter((edge) => layout.progressionTypeIds.has(edge.type)))
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

  const visibleBounds = useMemo(() => {
    if (graphData.nodes.length === 0) {
      return adapted.bounds;
    }

    const rects = graphData.nodes.map((node) => {
      const config = (node.config as Record<string, unknown>) ?? {};
      const width = Number(config?.pathwayVisualWidth ?? NODE_WIDTH);
      const height = Number(config?.pathwayVisualHeight ?? NODE_HEIGHT);
      return {
        minX: node.position.x,
        minY: node.position.y,
        maxX: node.position.x + width,
        maxY: node.position.y + height,
      };
    });

    return {
      minX: Math.min(...rects.map((item) => item.minX)),
      minY: Math.min(...rects.map((item) => item.minY)),
      maxX: Math.max(...rects.map((item) => item.maxX)),
      maxY: Math.max(...rects.map((item) => item.maxY)),
    };
  }, [adapted.bounds, graphData.nodes]);

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

      const contentWidth = Math.max(1, visibleBounds.maxX - visibleBounds.minX + 120);
      const contentHeight = Math.max(1, visibleBounds.maxY - visibleBounds.minY + 120);
      const fitX = (bounds.width - 72) / contentWidth;
      const fitY = (bounds.height - 72) / contentHeight;
      const nextZoom = clampZoom(Math.min(1.42, fitX, fitY));
      setCanvasZoom(nextZoom);
      const contentCenterX = ((visibleBounds.minX + visibleBounds.maxX) / 2) * nextZoom;
      const targetScrollLeft = Math.max(0, PATHWAY_STAGE_INSET_X + contentCenterX - bounds.width / 2);
      const targetScrollTop = Math.max(0, PATHWAY_STAGE_INSET_Y + visibleBounds.minY * nextZoom - 72);
      const applyScroll = () => {
        canvas.scrollLeft = targetScrollLeft;
        canvas.scrollTop = targetScrollTop;
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
  }, [adapted.bounds, adapted.height, adapted.width, visibleBounds]);

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
      preferNearTargetElbow: (node) => {
        const config = node.config as Record<string, unknown> | undefined;
        return String(config?.sourceKind ?? "").trim() === "pathway"
          && String(config?.pathwayFamily ?? "").trim() === "goal";
      },
      forceCenteredTargetEntry: (node) => {
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
    setCanvasZoom((current) => Math.max(0.55, Number((current - 0.1).toFixed(2))));
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
