import type { Edge, Node } from '@xyflow/svelte';

import type { GraphBundle, MindMapEdgeData, MindMapNodeData } from './types';

type FlowNode = Node<MindMapNodeData>;
type FlowEdge = Edge<MindMapEdgeData>;

export interface PreparedBundleArtifacts {
  progressionTypeIds: Set<string>;
  incomingProgression: Map<string, string[]>;
  laneGuides: string[];
}

const artifactsCache = new Map<string, PreparedBundleArtifacts>();

export function getBundleCacheKey(bundle: GraphBundle) {
  return [
    bundle.bundle_id,
    bundle.nodes.length,
    bundle.edges.length,
    bundle.ontology.node_types.length,
    bundle.ontology.edge_types.length
  ].join(':');
}

export function getPreparedBundleArtifacts(bundle: GraphBundle): PreparedBundleArtifacts {
  const cacheKey = getBundleCacheKey(bundle);
  const cached = artifactsCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  const progressionTypeIds = new Set(
    bundle.ontology.edge_types.filter((edgeType) => edgeType.role === 'progression').map((edge) => edge.id)
  );

  const incomingProgression = new Map<string, string[]>();
  const outgoingProgression = new Map<string, string[]>();
  const incomingCount = new Map<string, number>();

  for (const edge of bundle.edges) {
    if (!progressionTypeIds.has(edge.type)) {
      continue;
    }

    const incoming = incomingProgression.get(edge.target) ?? [];
    incoming.push(edge.source);
    incomingProgression.set(edge.target, dedupe(incoming));

    const outgoing = outgoingProgression.get(edge.source) ?? [];
    outgoing.push(edge.target);
    outgoingProgression.set(edge.source, dedupe(outgoing));

    incomingCount.set(edge.target, (incomingCount.get(edge.target) ?? 0) + 1);
  }

  const rootId =
    bundle.map.goal_id ??
    bundle.nodes.find((node) => !incomingCount.has(node.id))?.id ??
    bundle.nodes[0]?.id;

  const laneGuides = rootId
    ? buildLaneGuides(bundle, rootId, outgoingProgression)
    : ['Goal', 'Routes', 'Tradeoffs', 'Switches', 'Checkpoints'];

  const artifacts = {
    progressionTypeIds,
    incomingProgression,
    laneGuides
  };

  artifactsCache.set(cacheKey, artifacts);
  return artifacts;
}

export function cloneFlowNodes(nodes: FlowNode[]): FlowNode[] {
  return nodes.map((node) => ({
    ...node,
    position: { ...node.position },
    data: {
      ...node.data,
      node: node.data.node,
      nodeType: node.data.nodeType,
      fieldPreview: [...node.data.fieldPreview]
    }
  }));
}

export function cloneFlowEdges(edges: FlowEdge[]): FlowEdge[] {
  return edges.map((edge) => ({
    ...edge,
    data: {
      ...(edge.data as MindMapEdgeData),
      edge: (edge.data as MindMapEdgeData).edge,
      edgeType: (edge.data as MindMapEdgeData).edgeType
    }
  })) as FlowEdge[];
}

function buildLaneGuides(
  bundle: GraphBundle,
  rootId: string,
  outgoingProgression: Map<string, string[]>
) {
  const depths = new Map<string, number>([[rootId, 0]]);
  const queue = [rootId];

  while (queue.length > 0) {
    const nodeId = queue.shift();
    if (!nodeId) {
      continue;
    }

    const depth = depths.get(nodeId) ?? 0;
    for (const targetId of outgoingProgression.get(nodeId) ?? []) {
      if (!depths.has(targetId)) {
        depths.set(targetId, depth + 1);
        queue.push(targetId);
      }
    }
  }

  const maxDepth = Math.max(...depths.values());
  const laneLabels: string[] = [];

  for (let depth = 0; depth <= maxDepth; depth += 1) {
    const nodesAtDepth = bundle.nodes.filter((node) => (depths.get(node.id) ?? -1) === depth);
    if (nodesAtDepth.length === 0) {
      continue;
    }

    const counts = new Map<string, number>();
    for (const node of nodesAtDepth) {
      const label =
        bundle.ontology.node_types.find((item) => item.id === node.type)?.label ?? node.type;
      counts.set(label, (counts.get(label) ?? 0) + 1);
    }

    const sorted = [...counts.entries()].sort((left, right) => right[1] - left[1]);
    laneLabels.push(sorted[0]?.[0] ?? `Stage ${depth + 1}`);
  }

  return laneLabels.slice(0, 6);
}

function dedupe(values: string[]) {
  return [...new Set(values)];
}
