import type { GoalAnalysisRecord } from '../lib/types';

export type ResearchPlanCollectorJob = {
  id: string;
  targetId: string;
  targetLabel: string;
  provider: string;
  url: string;
  topic: string;
  kind: 'explicit_url' | 'search_probe';
};

const URL_PATTERN = /https?:\/\/[^\s<>()"'`]+/gi;
const MAX_TOTAL_RESEARCH_PLAN_JOBS = 12;
const MAX_SEARCH_PROBES_PER_TARGET = 2;
const DEFAULT_COLLECTOR = 'crawl4ai';
const SUPPORTED_FETCH_COLLECTORS = new Set([
  'crawl4ai',
  'scrapling',
  'lightpanda_experimental',
]);

function cleanLine(value: unknown): string {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values.map(cleanLine).filter(Boolean))];
}

function safeToken(value: string): string {
  return cleanLine(value).replace(/[^a-z0-9_-]+/gi, '_').replace(/^_+|_+$/g, '').slice(0, 80) || 'target';
}

function extractUrls(values: string[]): string[] {
  return uniqueStrings(
    values.flatMap((value) => Array.from(value.matchAll(URL_PATTERN)).map((match) => match[0] ?? '')),
  );
}

function containsUrl(value: string): boolean {
  return extractUrls([value]).length > 0;
}

function searchProbeUrl(query: string): string {
  return `https://duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
}

function resolveProvider(preferredCollectors: string[]): string {
  return preferredCollectors.map(cleanLine).find((collector) => SUPPORTED_FETCH_COLLECTORS.has(collector)) ?? DEFAULT_COLLECTOR;
}

export function buildResearchPlanCollectorJobs(
  analysis: GoalAnalysisRecord | null,
): ResearchPlanCollectorJob[] {
  const targets = analysis?.research_plan?.collection_targets ?? [];
  const jobs: ResearchPlanCollectorJob[] = [];

  for (const target of targets) {
    if (jobs.length >= MAX_TOTAL_RESEARCH_PLAN_JOBS) {
      break;
    }

    const provider = resolveProvider(target.preferred_collectors);
    const targetBudget = Math.max(1, Math.min(target.max_sources || 1, MAX_TOTAL_RESEARCH_PLAN_JOBS - jobs.length));
    const rawHints = [
      target.search_intent,
      target.reason,
      ...target.source_examples,
      ...target.example_queries,
    ];
    const explicitUrls = extractUrls(rawHints).slice(0, targetBudget);
    const topic = `pathway:${analysis?.goal_id ?? 'goal'}:${safeToken(target.id)}:${safeToken(target.layer)}`;

    explicitUrls.forEach((url, index) => {
      jobs.push({
        id: `${target.id}:url:${index}`,
        targetId: target.id,
        targetLabel: target.label,
        provider,
        url,
        topic,
        kind: 'explicit_url',
      });
    });

    const remainingBudget = targetBudget - explicitUrls.length;
    if (remainingBudget <= 0 || jobs.length >= MAX_TOTAL_RESEARCH_PLAN_JOBS) {
      continue;
    }

    const searchQueries = uniqueStrings(target.example_queries)
      .filter((query) => !containsUrl(query))
      .slice(0, Math.min(remainingBudget, MAX_SEARCH_PROBES_PER_TARGET));
    searchQueries.forEach((query, index) => {
      jobs.push({
        id: `${target.id}:search:${index}`,
        targetId: target.id,
        targetLabel: target.label,
        provider,
        url: searchProbeUrl(query),
        topic,
        kind: 'search_probe',
      });
    });
  }

  return jobs.slice(0, MAX_TOTAL_RESEARCH_PLAN_JOBS);
}

export function summarizeResearchPlanJobBudget(analysis: GoalAnalysisRecord | null): {
  plannedMaxSources: number;
  runnableJobs: number;
} {
  const targets = analysis?.research_plan?.collection_targets ?? [];
  return {
    plannedMaxSources: targets.reduce((sum, target) => sum + Math.max(0, target.max_sources || 0), 0),
    runnableJobs: buildResearchPlanCollectorJobs(analysis).length,
  };
}
