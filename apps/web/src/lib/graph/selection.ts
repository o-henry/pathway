import type { GraphBundle } from './types';

export function getProgressionPathNodeIds(bundle: GraphBundle, selectedNodeId: string | null): Set<string> {
  if (!selectedNodeId) {
    return new Set();
  }

  const progressionTypeIds = new Set(
    bundle.ontology.edge_types.filter((edgeType) => edgeType.role === 'progression').map((edge) => edge.id)
  );

  const incoming = new Map<string, string[]>();
  for (const edge of bundle.edges) {
    if (!progressionTypeIds.has(edge.type)) {
      continue;
    }

    const list = incoming.get(edge.target) ?? [];
    list.push(edge.source);
    incoming.set(edge.target, list);
  }

  const visited = new Set<string>();
  const stack = [selectedNodeId];

  while (stack.length > 0) {
    const current = stack.pop();
    if (!current || visited.has(current)) {
      continue;
    }

    visited.add(current);
    for (const parent of incoming.get(current) ?? []) {
      stack.push(parent);
    }
  }

  return visited;
}
