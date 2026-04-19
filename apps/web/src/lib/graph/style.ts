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
    background: '#dde7df',
    border: '#7f9582',
    accent: '#456352',
    text: '#25352b',
    chip: '#d3ddd5'
  },
  lavender: {
    background: '#e1dee8',
    border: '#8a8095',
    accent: '#5f5670',
    text: '#352f3f',
    chip: '#d5d2de'
  },
  peach: {
    background: '#eadfd3',
    border: '#a68a73',
    accent: '#7b6048',
    text: '#453428',
    chip: '#ddd1c4'
  },
  sky: {
    background: '#dae5e8',
    border: '#7d939c',
    accent: '#486874',
    text: '#273742',
    chip: '#d0dbdf'
  },
  rose: {
    background: '#e7d8d6',
    border: '#9b7d79',
    accent: '#735955',
    text: '#43302d',
    chip: '#dccfcd'
  },
  sand: {
    background: '#e8ddca',
    border: '#9c8767',
    accent: '#6f5a3d',
    text: '#433827',
    chip: '#ddd1bb'
  },
  yellow: {
    background: '#ebe0aa',
    border: '#a6944e',
    accent: '#75652b',
    text: '#433817',
    chip: '#dfd39c'
  },
  slate: {
    background: '#dde1e5',
    border: '#848d95',
    accent: '#55616b',
    text: '#2e3840',
    chip: '#d2d8dd'
  }
};

export function normalizeTone(token?: string): ToneToken {
  if (!token) {
    return 'slate';
  }

  return token in tonePalette ? (token as ToneToken) : 'slate';
}

export function normalizeShape(shape?: string): NodeShape {
  if (shape === 'pill' || shape === 'circle') {
    return shape;
  }

  return 'rounded_card';
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
