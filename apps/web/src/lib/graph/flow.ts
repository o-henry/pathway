import type { Edge, Node } from '@xyflow/svelte';

import { formatFieldValue } from './format';
import { resolveEdgeStyle, resolveNodeStyle } from './style';
import type { GraphBundle, MindMapEdgeData, MindMapNodeData } from './types';

export function buildFlow(bundle: GraphBundle): {
  nodes: Node<MindMapNodeData>[];
  edges: Edge<MindMapEdgeData>[];
} {
  const nodeTypeLookup = new Map(bundle.ontology.node_types.map((nodeType) => [nodeType.id, nodeType]));
  const edgeTypeLookup = new Map(bundle.ontology.edge_types.map((edgeType) => [edgeType.id, edgeType]));

  const nodes: Node<MindMapNodeData>[] = bundle.nodes.map((node) => {
    const nodeType = nodeTypeLookup.get(node.type);
    const style = resolveNodeStyle(nodeType);
    const fieldPreview =
      nodeType?.fields.slice(0, 3).flatMap((field) => {
        const value = node.data[field.key];
        if (value == null) {
          return [];
        }

        return [
          {
            key: field.key,
            label: field.label,
            value: formatFieldValue(field, value)
          }
        ];
      }) ?? [];

    return {
      id: node.id,
      type: 'mindmapNode',
      position: node.position ?? { x: 0, y: 0 },
      data: {
        node,
        nodeType,
        tone: style.tone,
        shape: style.shape,
        accent: style.accent,
        typeLabel: nodeType?.label ?? `Unknown · ${node.type}`,
        evidenceCount: node.evidence_refs.length,
        assumptionCount: node.assumption_refs.length,
        fieldPreview,
        riskLevel: node.scores?.risk ?? null
      },
      draggable: false,
      selectable: true,
      focusable: true
    };
  });

  const edges: Edge<MindMapEdgeData>[] = bundle.edges.map((edge) => {
    const edgeType = edgeTypeLookup.get(edge.type);
    const style = resolveEdgeStyle(edgeType);

    return {
      id: edge.id,
      type: 'mindmapEdge',
      source: edge.source,
      target: edge.target,
      animated: false,
      selectable: false,
      data: {
        edge,
        edgeType,
        role: style.role,
        line: style.line,
        accent: style.accent,
        hovered: false,
        active: false
      }
    };
  });

  return { nodes, edges };
}
