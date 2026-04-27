import type { GoalAnalysisRecord } from '../lib/types';

export type ResearchPlanCollectorJob = {
  id: string;
  targetId: string;
  targetLabel: string;
  provider: string;
  providerCandidates: string[];
  url: string;
  topic: string;
  kind: 'explicit_url' | 'search_probe';
};

const URL_PATTERN = /https?:\/\/[^\s<>()"'`]+/gi;
const MAX_TOTAL_RESEARCH_PLAN_JOBS = 24;
const DEFAULT_COLLECTOR_ORDER = ['scrapling', 'crawl4ai', 'lightpanda_experimental'];
const SUPPORTED_FETCH_COLLECTORS = new Set([
  'crawl4ai',
  'scrapling',
  'lightpanda_experimental',
]);
const SOURCE_FAMILY_SEARCH_SEEDS: ReadonlyArray<{
  id: string;
  patterns: string[];
  buildUrls: (query: string) => string[];
}> = [
  {
    id: 'academic',
    patterns: [
      'academic',
      'paper',
      'preprint',
      'research',
      'study',
      'empirical',
      'literature review',
      'systematic review',
      'meta-analysis',
      '논문',
      '학술',
      '연구',
      '메타분석',
    ],
    buildUrls: (query) => [
      `https://www.semanticscholar.org/search?q=${encodeURIComponent(query)}&sort=relevance`,
      `https://arxiv.org/search/?query=${encodeURIComponent(query)}&searchtype=all&source=header`,
      `https://pubmed.ncbi.nlm.nih.gov/?term=${encodeURIComponent(query)}`,
      `https://openreview.net/search?term=${encodeURIComponent(query)}&group=all&content=all`,
    ],
  },
  {
    id: 'official',
    patterns: ['official', 'guide', 'guideline', 'standard', 'framework', 'reference', '공식', '가이드', '기준'],
    buildUrls: (query) => [
      `https://www.google.com/search?q=${encodeURIComponent(`${query} official guide`)}`,
    ],
  },
  {
    id: 'open_media',
    patterns: ['youtube', '유튜브', 'open media', 'video', '강연', 'talk', 'lecture video'],
    buildUrls: (query) => [
      `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`,
    ],
  },
  {
    id: 'course',
    patterns: ['course', 'curriculum', 'lecture', 'class', '강의', '강좌', '커리큘럼', '수업'],
    buildUrls: (query) => [
      `https://www.coursera.org/search?query=${encodeURIComponent(query)}`,
      `https://www.classcentral.com/search?q=${encodeURIComponent(query)}`,
    ],
  },
  {
    id: 'guided_program',
    patterns: ['academy', '학원', 'tutor', '튜터', 'mentor', 'coach', 'program', 'cohort'],
    buildUrls: (query) => [
      `https://www.google.com/search?q=${encodeURIComponent(`${query} tutor academy program`)}`,
    ],
  },
  {
    id: 'community',
    patterns: ['community', 'forum', 'reddit', '커뮤니티', '포럼', 'experience', 'story', 'review', 'case'],
    buildUrls: (query) => [
      `https://www.reddit.com/search/?q=${encodeURIComponent(query)}`,
      `https://www.google.com/search?q=${encodeURIComponent(`${query} forum community experience`)}`,
    ],
  },
];

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

function resolveProviderCandidates(preferredCollectors: string[]): string[] {
  const preferred = preferredCollectors.map(cleanLine).filter((collector) => SUPPORTED_FETCH_COLLECTORS.has(collector));
  return uniqueStrings([...preferred, ...DEFAULT_COLLECTOR_ORDER]);
}

function buildSearchQuery(values: string[]): string {
  return cleanLine(values.find((value) => cleanLine(value).length >= 8) ?? values.join(' ')).slice(0, 180);
}

function sourceSearchUrlsForHints(values: string[]): string[] {
  const normalizedHints = values.map((value) => cleanLine(value).toLowerCase()).filter(Boolean);
  const query = buildSearchQuery(values);
  if (!query) {
    return [];
  }
  return SOURCE_FAMILY_SEARCH_SEEDS
    .filter((seed) =>
      normalizedHints.some((hint) => seed.patterns.some((pattern) => hint.includes(pattern))),
    )
    .flatMap((seed) => seed.buildUrls(query));
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

    const providerCandidates = resolveProviderCandidates(target.preferred_collectors);
    const provider = providerCandidates[0] ?? DEFAULT_COLLECTOR_ORDER[0]!;
    const targetBudget = Math.max(1, Math.min(target.max_sources || 1, MAX_TOTAL_RESEARCH_PLAN_JOBS - jobs.length));
    const rawHints = [
      target.search_intent,
      target.reason,
      ...target.source_examples,
      ...target.example_queries,
    ];
    const explicitUrls = extractUrls(rawHints).slice(0, targetBudget);
    const searchUrls = sourceSearchUrlsForHints(rawHints).slice(
      0,
      Math.max(0, targetBudget - explicitUrls.length),
    );
    const topic = `pathway:${analysis?.goal_id ?? 'goal'}:${safeToken(target.id)}:${safeToken(target.layer)}`;

    explicitUrls.forEach((url, index) => {
      jobs.push({
        id: `${target.id}:url:${index}`,
        targetId: target.id,
        targetLabel: target.label,
        provider,
        providerCandidates,
        url,
        topic,
        kind: 'explicit_url',
      });
    });
    searchUrls.forEach((url, index) => {
      jobs.push({
        id: `${target.id}:search:${index}`,
        targetId: target.id,
        targetLabel: target.label,
        provider,
        providerCandidates,
        url,
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
