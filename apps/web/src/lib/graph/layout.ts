import { Position, type Edge, type Node } from '@xyflow/svelte';

import type { MindMapEdgeData, MindMapNodeData } from './types';

const ROOT_CENTER = { x: 760, y: 540 };
const FIRST_RING_RADIUS = 330;
const RING_GAP = 255;
const ROOT_SPAN_DEGREES = 320;
const ROOT_START_DEGREES = -160;

type PositionedNode = Node<MindMapNodeData>;
type PositionedEdge = Edge<MindMapEdgeData>;

interface LayoutResult {
  nodes: PositionedNode[];
  edges: PositionedEdge[];
}

export async function layoutFlow(
  nodes: PositionedNode[],
  edges: PositionedEdge[],
  goalId?: string
): Promise<LayoutResult> {
  if (nodes.length === 0) {
    return { nodes, edges };
  }

  const nodeLookup = new Map(nodes.map((node) => [node.id, node]));
  const progressionEdges = edges.filter((edge) => (edge.data as MindMapEdgeData).role === 'progression');
  const outgoing = new Map<string, string[]>();
  const incoming = new Map<string, string[]>();

  for (const edge of progressionEdges) {
    const nextOutgoing = outgoing.get(edge.source) ?? [];
    nextOutgoing.push(edge.target);
    outgoing.set(edge.source, nextOutgoing);

    const nextIncoming = incoming.get(edge.target) ?? [];
    nextIncoming.push(edge.source);
    incoming.set(edge.target, nextIncoming);
  }

  const rootId =
    (goalId && nodeLookup.has(goalId) ? goalId : null) ??
    nodes.find((node) => (incoming.get(node.id)?.length ?? 0) === 0)?.id ??
    nodes[0]?.id;

  if (!rootId) {
    return { nodes, edges };
  }

  const positions = new Map<string, { x: number; y: number }>();
  const visited = new Set<string>();
  const directChildren = dedupe(outgoing.get(rootId) ?? []);

  positions.set(rootId, ROOT_CENTER);
  visited.add(rootId);

  const rootAngles = distributeAngles(directChildren.length, ROOT_START_DEGREES, ROOT_SPAN_DEGREES);

  directChildren.forEach((childId, index) => {
    placeSubtree({
      nodeId: childId,
      angle: rootAngles[index] ?? 0,
      radius: FIRST_RING_RADIUS,
      spread: 96,
      positions,
      visited,
      outgoing
    });
  });

  const remainingIds = nodes.map((node) => node.id).filter((nodeId) => !visited.has(nodeId));
  if (remainingIds.length > 0) {
    const fallbackAngles = distributeAngles(remainingIds.length, -120, 240);
    remainingIds.forEach((nodeId, index) => {
      positions.set(nodeId, polarToPoint(ROOT_CENTER, FIRST_RING_RADIUS + RING_GAP * 1.75, fallbackAngles[index] ?? 0));
      visited.add(nodeId);
    });
  }

  const laidOutNodes = normalizePositions(nodes, positions);
  const laidOutEdges = assignHandles(edges, laidOutNodes);

  return { nodes: laidOutNodes, edges: laidOutEdges };
}

function placeSubtree({
  nodeId,
  angle,
  radius,
  spread,
  positions,
  visited,
  outgoing
}: {
  nodeId: string;
  angle: number;
  radius: number;
  spread: number;
  positions: Map<string, { x: number; y: number }>;
  visited: Set<string>;
  outgoing: Map<string, string[]>;
}) {
  if (visited.has(nodeId)) {
    return;
  }

  positions.set(nodeId, polarToPoint(ROOT_CENTER, radius, angle));
  visited.add(nodeId);

  const children = dedupe(outgoing.get(nodeId) ?? []).filter((childId) => !visited.has(childId));
  if (children.length === 0) {
    return;
  }

  const nextSpread = clamp(spread * 0.72, 34, 90);
  const childAngles = distributeAngles(children.length, angle - spread / 2, spread);

  children.forEach((childId, index) => {
    placeSubtree({
      nodeId: childId,
      angle: childAngles[index] ?? angle,
      radius: radius + RING_GAP,
      spread: nextSpread,
      positions,
      visited,
      outgoing
    });
  });
}

function normalizePositions(
  nodes: PositionedNode[],
  positions: Map<string, { x: number; y: number }>
): PositionedNode[] {
  const sizedNodes = nodes.map((node) => ({
    node,
    width: getNodeWidth(node),
    height: getNodeHeight(node),
    position: positions.get(node.id) ?? node.position
  }));

  const minX = Math.min(...sizedNodes.map((item) => item.position.x - item.width / 2));
  const minY = Math.min(...sizedNodes.map((item) => item.position.y - item.height / 2));
  const shiftX = minX < 140 ? 140 - minX : 0;
  const shiftY = minY < 140 ? 140 - minY : 0;

  return sizedNodes.map(({ node, width, height, position }) => ({
    ...node,
    width,
    height,
    position: {
      x: position.x - width / 2 + shiftX,
      y: position.y - height / 2 + shiftY
    }
  }));
}

function assignHandles(
  edges: PositionedEdge[],
  nodes: PositionedNode[]
): PositionedEdge[] {
  const nodeLookup = new Map(
    nodes.map((node) => [
      node.id,
      {
        x: node.position.x + getNodeWidth(node) / 2,
        y: node.position.y + getNodeHeight(node) / 2
      }
    ])
  );

  return edges.map((edge) => {
    const source = nodeLookup.get(edge.source);
    const target = nodeLookup.get(edge.target);

    if (!source || !target) {
      return edge;
    }

    const sourceHandle = handleId(pickHandle(source, target), 'source');
    const targetHandle = handleId(pickHandle(target, source), 'target');

    return {
      ...edge,
      sourceHandle,
      targetHandle
    };
  });
}

function handleId(
  position: 'top' | 'right' | 'bottom' | 'left',
  kind: 'source' | 'target'
) {
  return `${kind}-${position}`;
}

function pickHandle(
  from: { x: number; y: number },
  to: { x: number; y: number }
): 'top' | 'right' | 'bottom' | 'left' {
  const dx = to.x - from.x;
  const dy = to.y - from.y;

  if (Math.abs(dx) >= Math.abs(dy)) {
    return dx >= 0 ? 'right' : 'left';
  }

  return dy >= 0 ? 'bottom' : 'top';
}

function distributeAngles(count: number, start: number, span: number): number[] {
  if (count <= 0) {
    return [];
  }

  if (count === 1) {
    return [start + span / 2];
  }

  const step = span / (count - 1);
  return Array.from({ length: count }, (_, index) => start + step * index);
}

function polarToPoint(
  center: { x: number; y: number },
  radius: number,
  angleInDegrees: number
) {
  const radians = (angleInDegrees * Math.PI) / 180;
  return {
    x: center.x + Math.cos(radians) * radius,
    y: center.y + Math.sin(radians) * radius
  };
}

function getNodeWidth(node: PositionedNode): number {
  if (node.data.shape === 'circle') {
    return 210;
  }

  return node.data.shape === 'pill' ? 190 : 230;
}

function getNodeHeight(node: PositionedNode): number {
  if (node.data.shape === 'circle') {
    return 210;
  }

  return node.data.shape === 'pill' ? 88 : 132;
}

function dedupe(values: string[]) {
  return [...new Set(values)];
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}
