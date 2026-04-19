import type {
  AssumptionItem,
  EvidenceItem,
  GraphBundle,
  GraphFieldDefinition,
  GraphNodeRecord
} from './types';

export function formatFieldValue(field: GraphFieldDefinition, value: unknown): string {
  if (value == null) {
    return '정보 없음';
  }

  if (field.value_type === 'duration_range' && typeof value === 'object') {
    const range = value as { min_hours_per_week?: number; max_hours_per_week?: number };
    if (range.min_hours_per_week != null && range.max_hours_per_week != null) {
      return `주 ${range.min_hours_per_week}~${range.max_hours_per_week}시간`;
    }
  }

  if (field.value_type === 'money_range' && typeof value === 'object') {
    const money = value as {
      min?: number;
      max?: number;
      currency?: string;
      period?: string;
    };
    if (money.min != null && money.max != null) {
      const currency = money.currency ?? '';
      const period = money.period ? ` / ${money.period}` : '';
      return `${money.min.toLocaleString()}~${money.max.toLocaleString()} ${currency}${period}`.trim();
    }
  }

  if (Array.isArray(value)) {
    return value.join(', ');
  }

  if (typeof value === 'object') {
    return JSON.stringify(value, null, 2);
  }

  return String(value);
}

export function getEvidenceItems(bundle: GraphBundle, node: GraphNodeRecord): EvidenceItem[] {
  const refs = new Set(node.evidence_refs);
  return bundle.evidence.filter((item) => refs.has(item.id));
}

export function getAssumptionItems(bundle: GraphBundle, node: GraphNodeRecord): AssumptionItem[] {
  const refs = new Set(node.assumption_refs);
  return bundle.assumptions.filter((item) => refs.has(item.id));
}

export function formatScoreLabel(scoreKey: string): string {
  return scoreKey
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}
