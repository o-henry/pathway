export type PathwayAuthMode = 'chatgpt' | 'apikey' | 'unknown';

export type CollectorDoctorState = 'checking' | 'ready' | 'error';

export type CollectorDoctorStatus = {
  id: string;
  label: string;
  detail: string;
  state: CollectorDoctorState;
  message: string;
  installable?: boolean;
  installed?: boolean;
  configured?: boolean;
};

export type CollectorHealthResult = {
  provider?: string;
  available?: boolean;
  ready?: boolean;
  configured?: boolean;
  installed?: boolean;
  installable?: boolean;
  message?: string;
  capabilities?: string[];
};

export type CollectorInstallResult = {
  provider?: string;
  installed?: boolean;
  message?: string;
};

export type CollectorFetchResult = {
  provider?: string;
  status?: string;
  url?: string;
  fetched_at?: string;
  summary?: string;
  content?: string;
  markdown_path?: string;
  json_path?: string;
  source_meta?: Record<string, unknown>;
  error?: string;
};

export type CollectorJobAttemptResult =
  | { ok: true; provider: string; targetLabel: string }
  | { ok: false; error: string; targetLabel: string };

export const COLLECTOR_DOCTOR_DEFINITIONS: ReadonlyArray<{
  id: string;
  label: string;
  detail: string;
}> = [
  { id: 'scrapling', label: 'Scrapling', detail: '허용된 HTML 파싱 fallback' },
  { id: 'crawl4ai', label: 'Crawl4AI', detail: 'LLM-ready 문서 추출' },
  { id: 'lightpanda_experimental', label: 'Lightpanda', detail: '가벼운 JS 렌더러' },
  { id: 'steel', label: 'Steel', detail: '외부 브라우저 세션 추출' },
  { id: 'playwright_local', label: 'Playwright Local', detail: '로컬 상호작용 브라우저' },
  { id: 'scrapy_playwright', label: 'Scrapy Playwright', detail: '배치 크롤링 오케스트레이션' },
  { id: 'browser_use', label: 'Browser Use', detail: '브라우저 자동화 provider' },
];
