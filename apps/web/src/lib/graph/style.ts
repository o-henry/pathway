import type {
  GraphEdgeTypeDefinition,
  GraphNodeTypeDefinition,
  NodeShape,
  ToneToken
} from './types';

export const tonePalette: Record<
  ToneToken,
  {
    background: string;
    border: string;
    accent: string;
    text: string;
    chip: string;
  }
> = {
  mint: {
    background: '#e7fbf0',
    border: '#70b89a',
    accent: '#2f8e67',
    text: '#204938',
    chip: '#d2f4df'
  },
  lavender: {
    background: '#efe9ff',
    border: '#9579c9',
    accent: '#7450bb',
    text: '#34244d',
    chip: '#e1d7ff'
  },
  peach: {
    background: '#fff0e6',
    border: '#d89a78',
    accent: '#bf6d3c',
    text: '#4f3223',
    chip: '#ffe4d3'
  },
  sky: {
    background: '#ebf7ff',
    border: '#79adcf',
    accent: '#3f7fa7',
    text: '#20384a',
    chip: '#d9eeff'
  },
  rose: {
    background: '#ffedf2',
    border: '#d58da2',
    accent: '#bc5877',
    text: '#56283b',
    chip: '#ffd9e5'
  },
  sand: {
    background: '#f9f0de',
    border: '#b89a67',
    accent: '#8d7042',
    text: '#4f4029',
    chip: '#efe2c1'
  },
  yellow: {
    background: '#fff7c9',
    border: '#d4b54f',
    accent: '#ae861a',
    text: '#4c3b09',
    chip: '#ffed9f'
  },
  slate: {
    background: '#eef2f5',
    border: '#8f9ca8',
    accent: '#536272',
    text: '#2b3640',
    chip: '#dde5ec'
  }
};

export function normalizeTone(token?: string): ToneToken {
  if (!token) {
    return 'slate';
  }

  return token in tonePalette ? (token as ToneToken) : 'slate';
}

export function normalizeShape(shape?: string): NodeShape {
  return shape === 'pill' ? 'pill' : 'rounded_card';
}

export function resolveNodeStyle(nodeType?: GraphNodeTypeDefinition) {
  const tone = normalizeTone(nodeType?.default_style?.tone);
  const shape = normalizeShape(nodeType?.default_style?.shape);

  return {
    tone,
    shape,
    accent: nodeType?.default_style?.accent ?? 'none',
    colors: tonePalette[tone]
  };
}

export function resolveEdgeStyle(edgeType?: GraphEdgeTypeDefinition) {
  return {
    role: edgeType?.role ?? 'reference',
    line: edgeType?.default_style?.line ?? 'curved',
    accent: edgeType?.default_style?.accent ?? 'none'
  };
}
