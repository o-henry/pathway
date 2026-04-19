import ELK from 'elkjs/lib/elk.bundled.js';
import type { Edge, Node } from '@xyflow/svelte';

import type { MindMapEdgeData, MindMapNodeData } from './types';

const elk = new ELK();

export async function layoutFlow(
  nodes: Node<MindMapNodeData>[],
  edges: Edge<MindMapEdgeData>[]
): Promise<Node<MindMapNodeData>[]> {
  if (nodes.length === 0) {
    return nodes;
  }

  const graph = {
    id: 'life-map',
    layoutOptions: {
      'elk.algorithm': 'layered',
      'elk.direction': 'RIGHT',
      'elk.layered.spacing.nodeNodeBetweenLayers': '100',
      'elk.spacing.nodeNode': '48'
    },
    children: nodes.map((node) => ({
      id: node.id,
      width: node.width ?? (node.data.shape === 'pill' ? 220 : 280),
      height: node.height ?? (node.data.shape === 'pill' ? 110 : 180)
    })),
    edges: edges.map((edge) => ({
      id: edge.id,
      sources: [edge.source],
      targets: [edge.target]
    }))
  };

  try {
    const layout = await elk.layout(graph);
    const positions = new Map(layout.children?.map((child) => [child.id, child]) ?? []);

    return nodes.map((node) => {
      const child = positions.get(node.id);
      return child
        ? {
            ...node,
            position: { x: child.x ?? node.position.x, y: child.y ?? node.position.y }
          }
        : node;
    });
  } catch {
    return nodes;
  }
}
