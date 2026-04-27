import { describe, expect, it, vi } from 'vitest';

import { createPathwayResearchCollectorActions } from './usePathwayResearchCollector';
import type { ResearchPlanCollectorJob } from './researchPlanCollectorJobs';

function makeJob(overrides: Partial<ResearchPlanCollectorJob> = {}): ResearchPlanCollectorJob {
  return {
    provider: 'crawl4ai',
    providerCandidates: ['crawl4ai'],
    targetLabel: 'candidate source',
    topic: 'goal research',
    url: 'https://example.com/source',
    ...overrides,
  };
}

function createHarness(jobs: ResearchPlanCollectorJob[]) {
  const statuses: string[] = [];
  const statusMessages: string[] = [];
  const collecting: boolean[] = [];
  const invokeFn = vi.fn(async (command: string) => {
    if (command === 'dashboard_crawl_provider_health') {
      return { ready: true };
    }
    if (command === 'dashboard_crawl_provider_fetch_url') {
      return { status: 'ok' };
    }
    throw new Error(`unexpected command: ${command}`);
  });
  const actions = createPathwayResearchCollectorActions({
    cwd: '/tmp/pathway',
    defaultJobs: jobs,
    ensureEngineStarted: vi.fn(async () => undefined),
    invokeFn,
    readyPromises: new Map(),
    setErrorMessage: vi.fn(),
    setResearchPlanCollecting: (value) => collecting.push(value),
    setResearchPlanCollectionStatus: (message) => statuses.push(message),
    setStatusMessage: (message) => statusMessages.push(message),
  });
  return { actions, collecting, invokeFn, statusMessages, statuses };
}

describe('createPathwayResearchCollectorActions', () => {
  it('collects jobs and reports success counts', async () => {
    const { actions, collecting, invokeFn, statusMessages, statuses } = createHarness([makeJob()]);

    await actions.collectResearchPlanTargetsForGraph('그래프 생성');

    expect(invokeFn).toHaveBeenCalledWith('dashboard_crawl_provider_health', {
      cwd: '/tmp/pathway',
      provider: 'crawl4ai',
    });
    expect(invokeFn).toHaveBeenCalledWith('dashboard_crawl_provider_fetch_url', {
      cwd: '/tmp/pathway',
      provider: 'crawl4ai',
      topic: 'goal research',
      url: 'https://example.com/source',
    });
    expect(collecting).toEqual([true, false]);
    expect(statuses).toContain('자동 수집 완료 · source library 적재 성공 1건 / 실패 0건');
    expect(statusMessages).toContain('자동 수집을 완료했습니다. 수집된 자료를 바탕으로 그래프 생성을 계속합니다.');
  });

  it('tries fallback providers before failing a job', async () => {
    const job = makeJob({ providerCandidates: ['crawl4ai', 'scrapling'] });
    const { actions, invokeFn, statuses } = createHarness([job]);
    invokeFn.mockImplementation(async (command: string, payload?: { provider?: string }) => {
      if (command === 'dashboard_crawl_provider_health') {
        return { ready: true };
      }
      if (command === 'dashboard_crawl_provider_fetch_url' && payload?.provider === 'crawl4ai') {
        return { status: 'error', error: 'blocked' };
      }
      if (command === 'dashboard_crawl_provider_fetch_url' && payload?.provider === 'scrapling') {
        return { status: 'ok' };
      }
      throw new Error(`unexpected command: ${command}`);
    });

    await actions.collectResearchPlanTargetsForGraph('그래프 생성');

    expect(invokeFn).toHaveBeenCalledWith(
      'dashboard_crawl_provider_fetch_url',
      expect.objectContaining({ provider: 'crawl4ai' }),
    );
    expect(invokeFn).toHaveBeenCalledWith(
      'dashboard_crawl_provider_fetch_url',
      expect.objectContaining({ provider: 'scrapling' }),
    );
    expect(statuses).toContain('자동 수집 완료 · source library 적재 성공 1건 / 실패 0건');
  });

  it('throws when every collection attempt fails', async () => {
    const { actions, collecting, invokeFn, statuses } = createHarness([makeJob()]);
    invokeFn.mockImplementation(async (command: string) => {
      if (command === 'dashboard_crawl_provider_health') {
        return { ready: true };
      }
      if (command === 'dashboard_crawl_provider_fetch_url') {
        return { status: 'error', error: 'blocked' };
      }
      throw new Error(`unexpected command: ${command}`);
    });

    await expect(actions.collectResearchPlanTargetsForGraph('그래프 생성')).rejects.toThrow(
      '자동 수집이 완료되지 않아 그래프 생성을 중단했습니다.',
    );
    expect(statuses).toContain('자동 수집 완료 · source library 적재 성공 0건 / 실패 1건');
    expect(collecting).toEqual([true, false]);
  });
});
