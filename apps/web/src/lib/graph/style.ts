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
    background: '#e5ece6',
    border: '#93a39a',
    accent: '#53695d',
    text: '#29352f',
    chip: '#dfe7e0'
  },
  lavender: {
    background: '#ece9f3',
    border: '#958cad',
    accent: '#655d7c',
    text: '#3c3550',
    chip: '#e3deed'
  },
  peach: {
    background: '#efe4d8',
    border: '#aa917b',
    accent: '#7f6751',
    text: '#4a3a2e',
    chip: '#e6d9cd'
  },
  sky: {
    background: '#e2eaed',
    border: '#8ba0aa',
    accent: '#516d78',
    text: '#2a3841',
    chip: '#d8e1e5'
  },
  rose: {
    background: '#eddedd',
    border: '#a48a8a',
    accent: '#7a6160',
    text: '#493432',
    chip: '#e4d5d4'
  },
  sand: {
    background: '#ece1cf',
    border: '#a29073',
    accent: '#735f45',
    text: '#473a2c',
    chip: '#e2d6c0'
  },
  yellow: {
    background: '#efe5b7',
    border: '#b09f61',
    accent: '#7b6d35',
    text: '#493d1f',
    chip: '#e5daaa'
  },
  slate: {
    background: '#e4e7ea',
    border: '#9199a1',
    accent: '#606973',
    text: '#333b44',
    chip: '#dce1e5'
  }
};

export function normalizeTone(token?: string): ToneToken {
  if (!token) {
    return 'slate';
  }

  return token in tonePalette ? (token as ToneToken) : 'slate';
}

export function normalizeShape(shape?: string): NodeShape {
  if (shape === 'circle') {
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
