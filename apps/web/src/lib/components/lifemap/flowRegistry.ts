import type { EdgeTypes, NodeTypes } from '@xyflow/svelte';

import GenericMindMapNode from './GenericMindMapNode.svelte';
import MindMapEdge from './MindMapEdge.svelte';

export const nodeTypes: NodeTypes = {
  mindmapNode: GenericMindMapNode
};

export const edgeTypes: EdgeTypes = {
  mindmapEdge: MindMapEdge
};
