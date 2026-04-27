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
const SOURCE_HINT_URL_SEEDS: ReadonlyArray<{ patterns: string[]; url: string }> = [
  {
    patterns: ['cefr', 'council of europe', 'common european framework'],
    url: 'https://www.coe.int/en/web/common-european-framework-reference-languages/table-1-cefr-3.3-common-reference-levels-global-scale',
  },
  {
    patterns: ['actfl', 'proficiency guidelines'],
    url: 'https://www.actfl.org/educator-resources/actfl-proficiency-guidelines',
  },
  {
    patterns: ['cambridge', 'b2 first'],
    url: 'https://www.cambridgeenglish.org/exams-and-tests/qualifications/first/',
  },
  {
    patterns: ['british council'],
    url: 'https://learnenglish.britishcouncil.org/level/improve-your-english-level/how-improve-your-english-speaking',
  },
  {
    patterns: ['plos', 'willingness to communicate'],
    url: 'https://journals.plos.org/plosone/article?id=10.1371/journal.pone.0328226',
  },
  {
    patterns: ['arxiv', 'preprint', 'paper', 'academic paper', '논문', '학술', 'empirical study'],
    url: 'https://arxiv.org/search/?query=goal+learning+intervention&searchtype=all&source=header',
  },
  {
    patterns: ['semantic scholar', 'citation', 'literature review', 'systematic review', 'meta-analysis', '메타분석'],
    url: 'https://www.semanticscholar.org/search?q=learning%20intervention%20systematic%20review&sort=relevance',
  },
  {
    patterns: ['pubmed', 'pmc', 'health', 'behavior change', 'habit', 'intervention study'],
    url: 'https://pubmed.ncbi.nlm.nih.gov/?term=behavior+change+intervention+systematic+review',
  },
  {
    patterns: ['openreview', 'machine learning paper', 'ai research'],
    url: 'https://openreview.net/search?term=learning%20intervention&group=all&content=all',
  },
  {
    patterns: ['doi', 'publisher', 'journal article'],
    url: 'https://doi.org/',
  },
  {
    patterns: ['language exchange', 'tandem', 'speaking gains'],
    url: 'https://pubmed.ncbi.nlm.nih.gov/37251019/',
  },
  {
    patterns: ['task repetition', 'oral performance'],
    url: 'https://www.sciencedirect.com/science/article/pii/S0346251X25002787',
  },
  {
    patterns: ['learner experience', 'learned english', 'how i learned english'],
    url: 'https://www.fluentu.com/blog/english/how-did-you-learn-english/',
  },
  {
    patterns: ['native speaker', 'language exchange', 'free tutor'],
    url: 'https://reallifeglobal.com/the-truth-about-speaking-with-native-speakers/',
  },
  {
    patterns: ['englishclub', 'confidence', 'speaking'],
    url: 'https://www.englishclub.com/esl-forums/viewtopic.php?t=70225',
  },
  {
    patterns: ['reddit', 'confidence', 'speaking'],
    url: 'https://www.reddit.com/r/EnglishLearning/comments/1s8zjrh/how_can_i_become_more_confidence_on_speaking/',
  },
  {
    patterns: ['reddit', 'native speaker', 'talk'],
    url: 'https://www.reddit.com/r/EnglishLearning/comments/1crpj60/how_to_meet_a_native_english_speaker_to_talk/',
  },
  {
    patterns: ['youtube', '유튜브', 'open learning media', 'video', '강연'],
    url: 'https://www.youtube.com/results?search_query=english+speaking+practice+routine',
  },
  {
    patterns: ['course', 'curriculum', 'lecture', '강의', '강좌', 'class'],
    url: 'https://www.coursera.org/search?query=english%20speaking',
  },
  {
    patterns: ['academy', '학원', 'tutor', '튜터', 'program'],
    url: 'https://www.italki.com/en/teachers/english',
  },
  {
    patterns: ['community', 'forum', '커뮤니티', 'learner story', 'review'],
    url: 'https://www.reddit.com/r/EnglishLearning/search/?q=speaking%20routine&restrict_sr=1',
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

function sourceSeedUrlsForHints(values: string[]): string[] {
  const normalizedHints = values.map((value) => cleanLine(value).toLowerCase()).filter(Boolean);
  return SOURCE_HINT_URL_SEEDS
    .filter((seed) =>
      normalizedHints.some((hint) => seed.patterns.some((pattern) => hint.includes(pattern))),
    )
    .map((seed) => seed.url);
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
    const explicitUrls = uniqueStrings([
      ...extractUrls(rawHints),
      ...sourceSeedUrlsForHints(rawHints),
    ]).slice(0, targetBudget);
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
