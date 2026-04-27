import { useEffect, useRef, useState } from 'react';

import {
  setLocalApiToken,
} from '../lib/api';
import { invoke, openPath, openUrl } from '../shared/tauri';
import type { AuthProbeResult, LoginChatgptResult } from './main/types';
import {
  extractAuthMode,
  isEngineAlreadyStartedError,
  loadPersistedAuthMode,
  loadPersistedCodexMultiAgentMode,
  loadPersistedCwd,
  loadPersistedLoginCompleted,
} from './mainAppUtils';
import type { PathwayAuthMode } from './pathwayCollectorContracts';
import {
  formatUiError,
} from './pathwayWorkspaceUtils';

type UsePathwayEngineAuthOptions = {
  hasTauriRuntime: boolean;
  setErrorMessage: (message: string) => void;
  setStatusMessage: (message: string) => void;
};

export function usePathwayEngineAuth({
  hasTauriRuntime,
  setErrorMessage,
  setStatusMessage,
}: UsePathwayEngineAuthOptions) {
  const [engineStarted, setEngineStarted] = useState(false);
  const [cwd, setCwd] = useState(() => loadPersistedCwd('.'));
  const [loginCompleted, setLoginCompleted] = useState(() => loadPersistedLoginCompleted());
  const [authMode, setAuthMode] = useState<PathwayAuthMode>(() => loadPersistedAuthMode());
  const [codexAuthBusy, setCodexAuthBusy] = useState(false);
  const [codexMultiAgentMode] = useState(() => loadPersistedCodexMultiAgentMode());
  const [usageInfoText, setUsageInfoText] = useState('');
  const [usageResultClosed, setUsageResultClosed] = useState(false);
  const engineStartedRef = useRef(false);
  const engineStartPromiseRef = useRef<Promise<void> | null>(null);
  const authStateLastCheckedAtRef = useRef(0);

  useEffect(() => {
    engineStartedRef.current = engineStarted;
  }, [engineStarted]);

  useEffect(() => {
    try {
      window.localStorage.setItem('rail.settings.cwd', cwd);
    } catch {
      // noop
    }
  }, [cwd]);

  useEffect(() => {
    try {
      window.localStorage.setItem('rail.settings.login_completed', loginCompleted ? '1' : '0');
    } catch {
      // noop
    }
  }, [loginCompleted]);

  useEffect(() => {
    try {
      window.localStorage.setItem('rail.settings.auth_mode', authMode);
    } catch {
      // noop
    }
  }, [authMode]);

  useEffect(() => {
    try {
      window.localStorage.setItem('rail.settings.codex_multi_agent_mode', codexMultiAgentMode);
    } catch {
      // noop
    }
  }, [codexMultiAgentMode]);

  async function refreshLocalApiTokenFromShell() {
    if (!hasTauriRuntime) {
      return;
    }
    if (String(import.meta.env.VITE_PATHWAY_LOCAL_API_TOKEN ?? '').trim()) {
      return;
    }
    try {
      const token = await invoke<string>('local_api_auth_token');
      setLocalApiToken(token);
    } catch {
      // Older dev shells may not expose the token command; unauthenticated dev API still works.
    }
  }

  async function ensureEngineStarted() {
    if (!hasTauriRuntime) {
      await refreshLocalApiTokenFromShell();
      return;
    }
    if (engineStartedRef.current) {
      await refreshLocalApiTokenFromShell();
      return;
    }
    if (engineStartPromiseRef.current) {
      await engineStartPromiseRef.current;
      return;
    }
    const startPromise = (async () => {
      try {
        await invoke('engine_start', { cwd });
        await refreshLocalApiTokenFromShell();
        engineStartedRef.current = true;
        setEngineStarted(true);
      } catch (error) {
        if (isEngineAlreadyStartedError(error)) {
          engineStartedRef.current = true;
          setEngineStarted(true);
          return;
        }
        throw error;
      } finally {
        engineStartPromiseRef.current = null;
      }
    })();
    engineStartPromiseRef.current = startPromise;
    await startPromise;
  }

  async function stopEngine() {
    if (!hasTauriRuntime) {
      return;
    }
    await invoke('engine_stop');
    engineStartPromiseRef.current = null;
    engineStartedRef.current = false;
    setEngineStarted(false);
  }

  async function refreshAuthStateFromEngine(showStatus = false): Promise<AuthProbeResult | null> {
    try {
      await ensureEngineStarted();
      const result = await invoke<AuthProbeResult>('auth_probe');
      const nextMode = extractAuthMode(result.authMode ?? result.raw ?? null) ?? 'unknown';
      setAuthMode(nextMode);
      if (result.state === 'authenticated') {
        setLoginCompleted(true);
        if (showStatus) {
          setStatusMessage('CODEX 로그인이 연결되어 있습니다.');
        }
      } else if (result.state === 'login_required') {
        setLoginCompleted(false);
        if (showStatus) {
          setStatusMessage('CODEX 로그인이 필요합니다. 설정에서 로그인 후 다시 실행하세요.');
        }
      } else if (showStatus) {
        setStatusMessage('CODEX 인증 상태를 확인했습니다.');
      }
      authStateLastCheckedAtRef.current = Date.now();
      return result;
    } catch (error) {
      if (showStatus) {
        setErrorMessage(formatUiError(error, 'CODEX 인증 상태를 확인하지 못했습니다.'));
      }
      return null;
    }
  }

  async function refreshAuthStateIfStale(maxAgeMs: number) {
    if (Date.now() - authStateLastCheckedAtRef.current < maxAgeMs) {
      return;
    }
    await refreshAuthStateFromEngine(true);
  }

  async function handleToggleCodexLogin() {
    if (codexAuthBusy) {
      return;
    }
    if (!hasTauriRuntime) {
      setErrorMessage('CODEX 로그인은 Tauri 앱에서만 사용할 수 있습니다.');
      return;
    }
    try {
      setCodexAuthBusy(true);
      setErrorMessage('');
      await ensureEngineStarted();

      if (loginCompleted) {
        await invoke('logout_codex');
        await stopEngine();
        setLoginCompleted(false);
        setAuthMode('unknown');
        setUsageInfoText('');
        setStatusMessage('CODEX에서 로그아웃했습니다.');
        return;
      }

      const probed = await refreshAuthStateFromEngine(false);
      if (probed?.state === 'authenticated') {
        setStatusMessage('이미 CODEX에 로그인되어 있습니다.');
        return;
      }

      const result = await invoke<LoginChatgptResult>('login_chatgpt');
      const authUrl = typeof result?.authUrl === 'string' ? result.authUrl.trim() : '';
      if (!authUrl) {
        throw new Error('로그인 URL을 받지 못했습니다.');
      }
      await openUrl(authUrl);
      const deviceCode = typeof result?.deviceCode === 'string' ? result.deviceCode.trim() : '';
      setStatusMessage(
        deviceCode
          ? `브라우저에서 CODEX 로그인을 진행하고 코드 ${deviceCode} 를 입력하세요. 완료 후 설정 탭에서 상태를 다시 확인할 수 있습니다.`
          : '브라우저에서 CODEX 로그인을 진행하세요. 완료 후 설정 탭에서 상태를 다시 확인할 수 있습니다.',
      );
    } catch (error) {
      setErrorMessage(formatUiError(error, loginCompleted ? 'CODEX 로그아웃에 실패했습니다.' : 'CODEX 로그인 시작에 실패했습니다.'));
    } finally {
      setCodexAuthBusy(false);
    }
  }

  async function handleSelectCwdDirectory() {
    if (!hasTauriRuntime) {
      setErrorMessage('작업 폴더 선택은 Tauri 앱에서만 사용할 수 있습니다.');
      return;
    }
    try {
      setErrorMessage('');
      const selected = await invoke<string | null>('dialog_pick_directory');
      const nextCwd = typeof selected === 'string' ? selected.trim() : '';
      if (!nextCwd) {
        return;
      }
      setCwd(nextCwd);
      setStatusMessage(`작업 경로를 ${nextCwd.toLowerCase()} 로 바꿨습니다.`);
    } catch (error) {
      setErrorMessage(formatUiError(error, '작업 폴더 선택에 실패했습니다.'));
    }
  }

  async function handleOpenRunsFolder() {
    if (!hasTauriRuntime) {
      setErrorMessage('작업 폴더 열기는 Tauri 앱에서만 사용할 수 있습니다.');
      return;
    }
    try {
      await openPath(cwd);
    } catch (error) {
      setErrorMessage(formatUiError(error, '작업 폴더를 열지 못했습니다.'));
    }
  }

  return {
    authMode,
    codexAuthBusy,
    cwd,
    engineStarted,
    ensureEngineStarted,
    handleOpenRunsFolder,
    handleSelectCwdDirectory,
    handleToggleCodexLogin,
    loginCompleted,
    refreshAuthStateIfStale,
    refreshAuthStateFromEngine,
    refreshLocalApiTokenFromShell,
    setUsageResultClosed,
    stopEngine,
    usageInfoText,
    usageResultClosed,
  };
}
