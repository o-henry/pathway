import { useI18n } from "../../i18n";

type CollectorDoctorStatus = {
  id: string;
  label: string;
  detail: string;
  state: "checking" | "ready" | "error";
  message: string;
  installable?: boolean;
  installed?: boolean;
  configured?: boolean;
};

type SettingsPageProps = {
  compact?: boolean;
  engineStarted: boolean;
  loginCompleted: boolean;
  authModeText: string;
  cwd: string;
  status: string;
  usageInfoText: string;
  usageResultClosed: boolean;
  running: boolean;
  isGraphRunning: boolean;
  codexAuthBusy: boolean;
  collectorDoctorStatuses: CollectorDoctorStatus[];
  collectorDoctorPending: boolean;
  collectorInstallPendingId: string | null;
  onSelectCwdDirectory: () => void;
  onToggleCodexLogin: () => void;
  onCloseUsageResult: () => void;
  onOpenRunsFolder: () => void;
  onRefreshCollectorDoctor: () => void;
  onInstallCollector: (providerId: string) => void;
};

export default function SettingsPage({
  compact = false,
  engineStarted,
  loginCompleted,
  authModeText,
  cwd,
  status,
  usageInfoText,
  usageResultClosed,
  running,
  isGraphRunning,
  codexAuthBusy,
  collectorDoctorStatuses,
  collectorDoctorPending,
  collectorInstallPendingId,
  onSelectCwdDirectory,
  onToggleCodexLogin,
  onCloseUsageResult,
  onOpenRunsFolder,
  onRefreshCollectorDoctor,
  onInstallCollector,
}: SettingsPageProps) {
  const { t } = useI18n();

  return (
    <section className={`controls ${compact ? "settings-compact" : ""}`}>
      <h3>{t("settings.title")}</h3>
      {!compact && (
        <div className="settings-badges">
          <span className={`status-tag ${engineStarted ? "on" : "off"}`}>
            {engineStarted ? t("settings.engine.connected") : t("settings.engine.waiting")}
          </span>
          <span className={`status-tag ${loginCompleted ? "on" : "off"}`}>
            {loginCompleted ? t("settings.login.done") : t("settings.login.required")}
          </span>
          <span className="status-tag neutral">{t("settings.auth.prefix")}: {authModeText}</span>
        </div>
      )}
      {!compact && (
        <label className="settings-codex-controls">
          <span>{t("settings.codexSection")}</span>
          <div className="button-row">
            <button
              className="settings-usage-button settings-account-button"
              disabled={running || isGraphRunning || codexAuthBusy}
              onClick={onToggleCodexLogin}
              type="button"
            >
              <span className="settings-button-label">
                {codexAuthBusy
                  ? t("settings.processing")
                  : loginCompleted
                    ? t("settings.codex.logout")
                    : t("settings.codex.login")}
              </span>
            </button>
          </div>
        </label>
      )}
      <label>
        {t("settings.cwd")}
        <div className="settings-cwd-row">
          <input className="lowercase-path-input" readOnly value={cwd} />
          <button className="settings-cwd-picker" onClick={onSelectCwdDirectory} type="button">
            {t("settings.pickFolder")}
          </button>
        </div>
      </label>
      <section className="settings-collector-doctor" aria-label="collector doctor">
        <div className="settings-collector-doctor-head">
          <div>
            <span className="settings-collector-doctor-kicker">Collector Doctor</span>
            <strong>수집기 상태</strong>
          </div>
          <button
            className="settings-refresh-button"
            disabled={collectorDoctorPending}
            onClick={onRefreshCollectorDoctor}
            type="button"
          >
            <span className="settings-refresh-label-text">
              {collectorDoctorPending ? "확인 중" : "새로고침"}
            </span>
          </button>
        </div>
        <div className="settings-collector-doctor-list">
          {collectorDoctorStatuses.map((collector) => (
            <article className="settings-collector-card" key={collector.id}>
              <div className="settings-collector-card-head">
                <span
                  aria-hidden="true"
                  className={`settings-collector-dot is-${collector.state}`.trim()}
                />
                <div className="settings-collector-card-copy">
                  <strong>{collector.label}</strong>
                </div>
                <span className="settings-collector-card-detail">{collector.detail}</span>
              </div>
              {collector.installable && collector.state !== "ready" ? (
                <div className="settings-collector-card-actions">
                  <button
                    className="settings-refresh-button settings-collector-install-button"
                    disabled={collectorDoctorPending || collectorInstallPendingId === collector.id}
                    onClick={() => onInstallCollector(collector.id)}
                    type="button"
                  >
                    {collectorInstallPendingId === collector.id ? "설치 중" : "설치"}
                  </button>
                </div>
              ) : null}
            </article>
          ))}
        </div>
      </section>
      <div className="usage-method usage-method-hidden">{t("settings.recentStatus")}: {status}</div>
      {usageInfoText && !usageResultClosed && (
        <div className="usage-result">
          <div className="usage-result-head">
            <button onClick={onCloseUsageResult} type="button">
              {t("common.close")}
            </button>
          </div>
          <pre>{usageInfoText}</pre>
        </div>
      )}
      {!compact && (
        <section className="settings-run-history settings-run-history-hidden">
          <div className="settings-run-history-head">
            <h3>{t("settings.log")}</h3>
            <button onClick={onOpenRunsFolder} type="button">
              {t("common.open")}
            </button>
          </div>
        </section>
      )}
    </section>
  );
}
