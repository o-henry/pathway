import { useEffect, useRef, useState } from 'react';

import { invoke } from '../shared/tauri';
import type { ResearchPlanCollectorJob } from './researchPlanCollectorJobs';
import type {
  CollectorFetchResult,
  CollectorHealthResult,
  CollectorInstallResult,
  CollectorJobAttemptResult,
} from './pathwayCollectorContracts';
import {
  cleanCollectorMessage,
  formatUiError,
  isTauriUnavailableError,
  truncateCollectorMessage,
} from './pathwayWorkspaceUtils';

const RESEARCH_COLLECTION_PARALLELISM = 4;

type UsePathwayResearchCollectorOptions = {
  cwd: string;
  ensureEngineStarted: () => Promise<void>;
  defaultJobs: ResearchPlanCollectorJob[];
  resetKey: string | null | undefined;
  setErrorMessage: (message: string) => void;
  setStatusMessage: (message: string) => void;
};

export function usePathwayResearchCollector({
  cwd,
  defaultJobs,
  ensureEngineStarted,
  resetKey,
  setErrorMessage,
  setStatusMessage,
}: UsePathwayResearchCollectorOptions) {
  const [, setResearchPlanCollecting] = useState(false);
  const [researchPlanCollectionStatus, setResearchPlanCollectionStatus] = useState('');
  const collectorReadyPromisesRef = useRef<Map<string, Promise<void>>>(new Map());

  useEffect(() => {
    setResearchPlanCollectionStatus('');
  }, [resetKey]);

  function cancelResearchPlanCollection() {
    setResearchPlanCollecting(false);
  }

  async function prepareCollectorForJob(providerId: string): Promise<void> {
    const health = await invoke<CollectorHealthResult>('dashboard_crawl_provider_health', {
      cwd,
      provider: providerId,
    });
    if (health?.ready) {
      return;
    }
    if (health?.installable) {
      const initialMessage = String(health?.message ?? '').trim();
      setResearchPlanCollectionStatus(
        `${providerId} 수집기가 아직 준비되지 않아 자동 설치/준비를 시도합니다.${initialMessage ? ` · ${initialMessage}` : ''}`,
      );
      await invoke<CollectorInstallResult>('dashboard_crawl_provider_install', {
        cwd,
        provider: providerId,
      });
      const recheckedHealth = await invoke<CollectorHealthResult>('dashboard_crawl_provider_health', {
        cwd,
        provider: providerId,
      });
      if (recheckedHealth?.ready) {
        return;
      }
      const recheckedMessage =
        String(recheckedHealth?.message ?? '').trim() || `${providerId} 수집기 자동 설치 후에도 준비되지 않았습니다.`;
      throw new Error(`${providerId}: ${recheckedMessage}`);
    }
    const message = String(health?.message ?? '').trim() || `${providerId} 수집기가 준비되지 않았습니다.`;
    throw new Error(`${providerId}: ${message}`);
  }

  async function ensureCollectorReadyForJob(providerId: string): Promise<void> {
    const cached = collectorReadyPromisesRef.current.get(providerId);
    if (cached) {
      return cached;
    }

    const promise = prepareCollectorForJob(providerId).catch((error) => {
      collectorReadyPromisesRef.current.delete(providerId);
      throw error;
    });
    collectorReadyPromisesRef.current.set(providerId, promise);
    return promise;
  }

  async function runResearchPlanCollectorJob(job: ResearchPlanCollectorJob, provider: string): Promise<CollectorFetchResult> {
    await ensureCollectorReadyForJob(provider);
    return invoke<CollectorFetchResult>('dashboard_crawl_provider_fetch_url', {
      cwd,
      provider,
      url: job.url,
      topic: job.topic,
    });
  }

  async function runResearchPlanCollectorJobWithFallbacks(job: ResearchPlanCollectorJob): Promise<CollectorJobAttemptResult> {
    const providers = job.providerCandidates.length > 0 ? job.providerCandidates : [job.provider];
    const errors: string[] = [];

    for (const provider of providers) {
      try {
        const result = await runResearchPlanCollectorJob(job, provider);
        const ok = String(result?.status ?? '').toLowerCase() === 'ok';
        const sourceError = cleanCollectorMessage(result?.source_meta?.source_library_error);
        if (ok && !sourceError) {
          return { ok: true, provider, targetLabel: job.targetLabel };
        }
        const resultError = cleanCollectorMessage(result?.error || sourceError || result?.status || 'fetch failed');
        errors.push(`${provider}: ${resultError}`);
      } catch (error) {
        errors.push(`${provider}: ${formatUiError(error, '실패')}`);
      }
    }

    return {
      ok: false,
      targetLabel: job.targetLabel,
      error: truncateCollectorMessage(errors.join(' / '), 360),
    };
  }

  async function collectResearchPlanTargetsForGraph(triggerLabel: string, jobs = defaultJobs) {
    if (jobs.length === 0) {
      const message = '조사할 수집 타깃이 아직 없습니다. 그래프를 만들기 전에 목표 분석의 research plan부터 다시 생성해야 합니다.';
      setResearchPlanCollectionStatus(message);
      throw new Error(message);
    }

    setResearchPlanCollecting(true);
    setErrorMessage('');
    let successCount = 0;
    let failureCount = 0;
    const failureReasons: string[] = [];
    try {
      await ensureEngineStarted();
      const results: CollectorJobAttemptResult[] = [];
      let nextJobIndex = 0;
      let completedCount = 0;
      const workerCount = Math.min(RESEARCH_COLLECTION_PARALLELISM, jobs.length);

      const runWorker = async () => {
        while (nextJobIndex < jobs.length) {
          const index = nextJobIndex;
          nextJobIndex += 1;
          const job = jobs[index]!;
          const providers = job.providerCandidates.length > 0 ? job.providerCandidates : [job.provider];
          setResearchPlanCollectionStatus(
            `${triggerLabel} 전 자동 수집 병렬 실행 중 · 시작 ${index + 1}/${jobs.length} · ${job.targetLabel} · ${providers.join(' → ')}`,
          );
          const result = await runResearchPlanCollectorJobWithFallbacks(job);
          results[index] = result;
          completedCount += 1;
          setResearchPlanCollectionStatus(
            `${triggerLabel} 전 자동 수집 병렬 실행 중 · 완료 ${completedCount}/${jobs.length} · 최근 완료: ${job.targetLabel}`,
          );
        }
      };

      await Promise.all(Array.from({ length: workerCount }, () => runWorker()));

      for (const result of results) {
        if (!result) {
          continue;
        }
        if (result.ok) {
          successCount += 1;
        } else {
          failureCount += 1;
          failureReasons.push(`${result.targetLabel}: ${result.error}`);
        }
      }
      setResearchPlanCollectionStatus(
        `자동 수집 완료 · source library 적재 성공 ${successCount}건 / 실패 ${failureCount}건`,
      );
      if (successCount === 0) {
        const reasonSummary = failureReasons.slice(0, 3).join(' / ');
        throw new Error(
          `자동 수집이 완료되지 않아 ${triggerLabel}을 중단했습니다. 성공 0건 / 실패 ${failureCount}건. ${reasonSummary}`,
        );
      }
      if (failureReasons.length > 0) {
        setResearchPlanCollectionStatus(
          `자동 수집 완료 · source library 적재 성공 ${successCount}건 / 실패 ${failureCount}건 · 일부 실패: ${failureReasons
            .slice(0, 2)
            .join(' / ')}`,
        );
      }
      setStatusMessage(`자동 수집을 완료했습니다. 수집된 자료를 바탕으로 ${triggerLabel}을 계속합니다.`);
    } catch (error) {
      if (isTauriUnavailableError(error)) {
        setResearchPlanCollectionStatus('자동 수집은 Tauri 앱에서만 실행할 수 있습니다.');
      } else {
        setResearchPlanCollectionStatus(formatUiError(error, '자동 수집 준비 실패'));
      }
      throw error;
    } finally {
      setResearchPlanCollecting(false);
    }
  }

  return {
    cancelResearchPlanCollection,
    collectResearchPlanTargetsForGraph,
    researchPlanCollectionStatus,
  };
}
