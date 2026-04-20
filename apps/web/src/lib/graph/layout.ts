import { type Edge, type Node } from '@xyflow/svelte';

import type { MindMapEdgeData, MindMapNodeData } from './types';

const ROOT_X = 72;
const ROOT_Y = 72;
const COLUMN_GAP = 292;
const ROW_GAP = 78;
const FALLBACK_SECTION_GAP = 120;

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
    outgoing.set(edge.source, dedupe(nextOutgoing));

    const nextIncoming = incoming.get(edge.target) ?? [];
    nextIncoming.push(edge.source);
    incoming.set(edge.target, dedupe(nextIncoming));
  }

  const rootId =
    (goalId && nodeLookup.has(goalId) ? goalId : null) ??
    nodes.find((node) => (incoming.get(node.id)?.length ?? 0) === 0)?.id ??
    nodes[0]?.id;

  if (!rootId) {
    return { nodes, edges };
  }

  const positioned = new Map<string, { x: number; y: number }>();
  const visited = new Set<string>();

  const subtreeMemo = new Map<string, number>();
  const subtreeHeight = (nodeId: string): number => {
    if (subtreeMemo.has(nodeId)) {
      return subtreeMemo.get(nodeId) ?? 0;
    }

    const node = nodeLookup.get(nodeId);
    const ownHeight = node ? getNodeHeight(node) : 132;
    const children = dedupe(outgoing.get(nodeId) ?? []).filter((childId) => childId !== nodeId);

    if (children.length === 0) {
      subtreeMemo.set(nodeId, ownHeight);
      return ownHeight;
    }

    const stackedHeight = children.reduce((sum, childId, index) => {
      return sum + subtreeHeight(childId) + (index > 0 ? ROW_GAP : 0);
    }, 0);

    const value = Math.max(ownHeight, stackedHeight);
    subtreeMemo.set(nodeId, value);
    return value;
  };

  function placeTree(nodeId: string, depth: number, top: number) {
    if (visited.has(nodeId)) {
      return;
    }

    const node = nodeLookup.get(nodeId);
    if (!node) {
      return;
    }

    const ownWidth = getNodeWidth(node);
    const ownHeight = getNodeHeight(node);
    const children = dedupe(outgoing.get(nodeId) ?? []).filter((childId) => childId !== nodeId);
    const blockHeight = subtreeHeight(nodeId);
    const centerY = top + blockHeight / 2;

    positioned.set(nodeId, {
      x: ROOT_X + depth * COLUMN_GAP,
      y: centerY - ownHeight / 2
    });
    visited.add(nodeId);

    if (children.length === 0) {
      return;
    }

    let childTop = top;
    for (const childId of children) {
      const childBlockHeight = subtreeHeight(childId);
      placeTree(childId, depth + 1, childTop);
      childTop += childBlockHeight + ROW_GAP;
    }

    void ownWidth;
  }

  placeTree(rootId, 0, ROOT_Y);

  const remainingIds = nodes.map((node) => node.id).filter((nodeId) => !visited.has(nodeId));
  if (remainingIds.length > 0) {
    let fallbackTop = ROOT_Y + subtreeHeight(rootId) + FALLBACK_SECTION_GAP;
    for (const nodeId of remainingIds) {
      const node = nodeLookup.get(nodeId);
      if (!node) {
        continue;
      }

      positioned.set(nodeId, { x: ROOT_X, y: fallbackTop });
      visited.add(nodeId);
      fallbackTop += getNodeHeight(node) + ROW_GAP;
    }
  }

  const laidOutNodes = nodes.map((node) => ({
    ...node,
    width: getNodeWidth(node),
    height: getNodeHeight(node),
    position: positioned.get(node.id) ?? node.position
  }));

  const laidOutEdges = assignHandles(edges, laidOutNodes);
  return { nodes: laidOutNodes, edges: laidOutEdges };
}

function assignHandles(edges: PositionedEdge[], nodes: PositionedNode[]): PositionedEdge[] {
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

    return {
      ...edge,
      sourceHandle: handleId(pickHandle(source, target), 'source'),
      targetHandle: handleId(pickHandle(target, source), 'target')
    };
  });
}

function handleId(position: 'top' | 'right' | 'bottom' | 'left', kind: 'source' | 'target') {
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

function getNodeWidth(node: PositionedNode): number {
  if (node.data.shape === 'circle') {
    return 214;
  }

  return 222;
}

function getNodeHeight(node: PositionedNode): number {
  if (node.data.shape === 'circle') {
    return 214;
  }

  return 118;
}

function dedupe(values: string[]) {
  return [...new Set(values)];
}
