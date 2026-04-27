import { useRef, useState } from 'react';

import { invoke } from '../shared/tauri';
import {
  COLLECTOR_DOCTOR_DEFINITIONS,
  type CollectorDoctorStatus,
  type CollectorHealthResult,
  type CollectorInstallResult,
} from './pathwayCollectorContracts';
import {
  formatUiError,
  isTauriUnavailableError,
} from './pathwayWorkspaceUtils';

type UsePathwayCollectorDoctorOptions = {
  cwd: string;
  ensureEngineStarted: () => Promise<void>;
  hasTauriRuntime: boolean;
  setStatusMessage: (message: string) => void;
};

export function usePathwayCollectorDoctor({
  cwd,
  ensureEngineStarted,
  hasTauriRuntime,
  setStatusMessage,
}: UsePathwayCollectorDoctorOptions) {
  const [collectorDoctorStatuses, setCollectorDoctorStatuses] = useState<CollectorDoctorStatus[]>(
    COLLECTOR_DOCTOR_DEFINITIONS.map((collector) => ({
      ...collector,
      state: 'checking',
      message: '상태 확인 전',
    })),
  );
  const [collectorDoctorPending, setCollectorDoctorPending] = useState(false);
  const [collectorInstallPendingId, setCollectorInstallPendingId] = useState<string | null>(null);
  const collectorDoctorLastCheckedAtRef = useRef(0);
  const collectorDoctorInFlightRef = useRef(false);

  function setCollectorDoctorPreviewFallback(message = 'Tauri 앱에서 확인할 수 있습니다.') {
    setCollectorDoctorStatuses(
      COLLECTOR_DOCTOR_DEFINITIONS.map((collector) => ({
        ...collector,
        state: 'checking',
        message,
        installable: false,
        installed: false,
        configured: false,
      })),
    );
  }

  async function refreshCollectorDoctor() {
    if (collectorDoctorInFlightRef.current) {
      return;
    }
    collectorDoctorInFlightRef.current = true;
    setCollectorDoctorPending(true);
    try {
      if (!hasTauriRuntime) {
        setCollectorDoctorPreviewFallback('브라우저 프리뷰에서는 수집기 상태를 확인할 수 없습니다. Tauri 앱에서 다시 확인하세요.');
        return;
      }
      await ensureEngineStarted();
      const results = await Promise.all(
        COLLECTOR_DOCTOR_DEFINITIONS.map(async (collector) => {
          try {
            const health = await invoke<CollectorHealthResult>('dashboard_crawl_provider_health', {
              cwd,
              provider: collector.id,
            });
            const ready = Boolean(health?.ready);
            const message = String(health?.message ?? '').trim();
            let fallback = '작동 가능';
            if (!ready) {
              if (health?.available === false) {
                fallback = '현재 환경에서 사용할 수 없습니다.';
              } else if (health?.configured === false) {
                fallback = '설정이 필요합니다.';
              } else if (health?.installed === false) {
                fallback = '설치가 필요합니다.';
              } else {
                fallback = '현재 작동할 수 없습니다.';
              }
            }
            return {
              ...collector,
              state: ready ? 'ready' : 'error',
              message: message || fallback,
              installable: Boolean(health?.installable),
              installed: Boolean(health?.installed),
              configured: Boolean(health?.configured),
            } satisfies CollectorDoctorStatus;
          } catch (error) {
            if (isTauriUnavailableError(error)) {
              return {
                ...collector,
                state: 'checking',
                message: 'Tauri 앱에서 확인할 수 있습니다.',
                installable: false,
                installed: false,
                configured: false,
              } satisfies CollectorDoctorStatus;
            }
            return {
              ...collector,
              state: 'error',
              message: formatUiError(error, '상태 확인 실패'),
              installable: false,
              installed: false,
              configured: false,
            } satisfies CollectorDoctorStatus;
          }
        }),
      );
      setCollectorDoctorStatuses(results);
      collectorDoctorLastCheckedAtRef.current = Date.now();
    } catch (error) {
      if (isTauriUnavailableError(error)) {
        setCollectorDoctorPreviewFallback('브라우저 프리뷰에서는 수집기 상태를 확인할 수 없습니다. Tauri 앱에서 다시 확인하세요.');
      } else {
        setCollectorDoctorStatuses(
          COLLECTOR_DOCTOR_DEFINITIONS.map((collector) => ({
            ...collector,
            state: 'error',
            message: formatUiError(error, '상태 확인 실패'),
            installable: false,
            installed: false,
            configured: false,
          })),
        );
      }
    } finally {
      collectorDoctorInFlightRef.current = false;
      setCollectorDoctorPending(false);
    }
  }

  async function refreshCollectorDoctorIfStale(maxAgeMs: number) {
    if (Date.now() - collectorDoctorLastCheckedAtRef.current < maxAgeMs) {
      return;
    }
    await refreshCollectorDoctor();
  }

  async function handleInstallCollector(providerId: string) {
    setCollectorInstallPendingId(providerId);
    setStatusMessage(`${providerId} 설치를 시작합니다...`);
    try {
      await ensureEngineStarted();
      const result = await invoke<CollectorInstallResult>('dashboard_crawl_provider_install', {
        cwd,
        provider: providerId,
      });
      const installMessage = String(result?.message ?? '').trim();
      setStatusMessage(installMessage || `${providerId} 설치를 마쳤습니다.`);
      await refreshCollectorDoctor();
    } catch (error) {
      if (isTauriUnavailableError(error)) {
        setStatusMessage('수집기 설치는 Tauri 앱에서만 실행할 수 있습니다.');
        setCollectorDoctorPreviewFallback('브라우저 프리뷰에서는 설치를 실행할 수 없습니다. Tauri 앱에서 다시 시도하세요.');
      } else {
        setStatusMessage(formatUiError(error, `${providerId} 설치 실패`));
      }
      await refreshCollectorDoctor();
    } finally {
      setCollectorInstallPendingId(null);
    }
  }

  return {
    collectorDoctorPending,
    collectorDoctorStatuses,
    collectorInstallPendingId,
    handleInstallCollector,
    refreshCollectorDoctor,
    refreshCollectorDoctorIfStale,
  };
}
