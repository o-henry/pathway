import { useEffect, useRef, type KeyboardEvent as ReactKeyboardEvent, type RefObject } from "react";
import type { CoordinationMode } from "../../features/orchestration/agentic/coordinationTypes";
import { findRuntimeModelOption } from "../../features/workflow/runtimeModelOptions";
import { useI18n } from "../../i18n";
import type { TaskAgentMentionMatch, TaskAgentMentionOption } from "./taskAgentMentions";
import { getTaskAgentLabel, stripCoordinationModeTags } from "./taskAgentPresets";
import type { ThreadRoleId } from "./threadTypes";
import type { TasksWebProviderStatus } from "./useTasksWebProviderStatus";

type AttachedFile = {
  id: string;
  name: string;
  path: string;
  enabled?: boolean;
};

type RuntimeModelOption = {
  value: string;
  label: string;
  executor?: string;
};

type TasksThreadComposerProps = {
  pathwayMode?: boolean;
  composerRef: RefObject<HTMLTextAreaElement | null>;
  modelMenuRef: RefObject<HTMLDivElement | null>;
  reasonMenuRef: RefObject<HTMLDivElement | null>;
  mentionMatch: TaskAgentMentionMatch | null;
  mentionIndex: number;
  attachedFiles: AttachedFile[];
  selectedComposerRoleIds: ThreadRoleId[];
  autoSelectedComposerRoleIds?: ThreadRoleId[];
  composerProviderOverrides?: string[];
  providerStatuses?: TasksWebProviderStatus[];
  providerStatusPending?: boolean;
  autoSelectedProviderModel?: string | null;
  creativeModeEnabled: boolean;
  composerCoordinationModeOverride: CoordinationMode | null;
  composerDraft: string;
  selectedModelOption: RuntimeModelOption;
  isModelMenuOpen: boolean;
  isReasonMenuOpen: boolean;
  reasoning: string;
  reasoningLabel: string;
  showStopButton: boolean;
  canUseStopButton: boolean;
  canInterruptCurrentThread: boolean;
  stoppingComposerRun: boolean;
  onSelectMention: (option: TaskAgentMentionOption) => void;
  onRemoveAttachedFile: (id: string) => void;
  onRemoveComposerRole: (roleId: ThreadRoleId) => void;
  onClearCoordinationModeOverride: () => void;
  onComposerKeyDown: (event: ReactKeyboardEvent<HTMLTextAreaElement>) => void;
  onComposerDraftChange: (value: string, cursor: number) => void;
  onComposerCursorChange: (cursor: number) => void;
  onOpenAttachmentPicker: () => void;
  onOpenProviderSession: (provider: string) => void;
  onRefreshProviderStatuses: () => void;
  onSetModel: (value: string) => void;
  onToggleModelMenu: () => void;
  onSetReasoning: (value: string) => void;
  onToggleReasonMenu: () => void;
  onClearComposerProviderOverrides: () => void;
  onToggleCreativeMode: () => void;
  onRemoveComposerProvider: (value: string) => void;
  onSubmit: () => void;
  onStop: () => void;
};

export function canSubmitTasksComposer(input: string | null | undefined): boolean {
  return Boolean(stripCoordinationModeTags(String(input ?? "")).trim());
}

export function shouldShowTasksComposerStopButton(params: {
  canInterruptCurrentThread: boolean;
  composerSubmitPending: boolean;
}): boolean {
  return Boolean(params.canInterruptCurrentThread || params.composerSubmitPending);
}

type SelectedTasksComposerBadge = {
  key: string;
  kind: "agent" | "auto-agent" | "mode" | "provider" | "auto-provider";
  label: string;
  roleId?: ThreadRoleId;
  mode?: CoordinationMode;
  value?: string;
};

function coordinationModeLabel(mode: CoordinationMode): string {
  if (mode === "fanout") {
    return "FANOUT";
  }
  if (mode === "team") {
    return "TEAM";
  }
  return "QUICK";
}

function composerProviderLabel(value: string): string {
  const normalized = String(value ?? "").trim();
  if (!normalized) {
    return "";
  }
  return findRuntimeModelOption(normalized).label;
}

export function buildSelectedTasksComposerBadges(params: {
  roleIds: ThreadRoleId[];
  autoRoleIds?: ThreadRoleId[];
  providerValues?: string[];
  autoProviderValue?: string | null;
  modeOverride: CoordinationMode | null;
}): SelectedTasksComposerBadge[] {
  const badges: SelectedTasksComposerBadge[] = params.roleIds.map((roleId) => ({
    key: `agent:${roleId}`,
    kind: "agent",
    label: getTaskAgentLabel(roleId),
    roleId,
  }));
  for (const roleId of params.autoRoleIds ?? []) {
    if (params.roleIds.includes(roleId)) {
      continue;
    }
    badges.push({
      key: `auto-agent:${roleId}`,
      kind: "auto-agent",
      label: getTaskAgentLabel(roleId),
      roleId,
    });
  }
  const providerValues = [...new Set((params.providerValues ?? []).map((value) => String(value ?? "").trim()).filter(Boolean))];
  for (const providerValue of providerValues) {
    badges.push({
      key: `provider:${providerValue}`,
      kind: "provider",
      label: composerProviderLabel(providerValue),
      value: providerValue,
    });
  }
  const autoProviderValue = String(params.autoProviderValue ?? "").trim();
  if (autoProviderValue && !providerValues.includes(autoProviderValue)) {
    badges.push({
      key: `auto-provider:${autoProviderValue}`,
      kind: "auto-provider",
      label: composerProviderLabel(autoProviderValue),
      value: autoProviderValue,
    });
  }
  if (params.modeOverride) {
    badges.push({
      key: `mode:${params.modeOverride}`,
      kind: "mode",
      label: coordinationModeLabel(params.modeOverride),
      mode: params.modeOverride,
    });
  }
  return badges;
}

export function TasksThreadComposer(props: TasksThreadComposerProps) {
  const { t } = useI18n();
  const mentionMenuRef = useRef<HTMLDivElement | null>(null);
  const mentionOptionRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const canSubmit = canSubmitTasksComposer(props.composerDraft);
  const composerDisabled = false;
  const composerPlaceholder = props.pathwayMode
    ? "현재 목표, 제약, 막힌 지점, 조사할 포인트, 그래프에 반영할 변화를 입력하세요."
    : t("tasks.composer.placeholder");
  const selectedBadges = buildSelectedTasksComposerBadges({
    roleIds: props.selectedComposerRoleIds,
    autoRoleIds: props.autoSelectedComposerRoleIds ?? [],
    providerValues: props.composerProviderOverrides,
    autoProviderValue: props.autoSelectedProviderModel,
    modeOverride: props.composerCoordinationModeOverride,
  });

  useEffect(() => {
    if (!props.mentionMatch) {
      mentionOptionRefs.current = [];
      return;
    }
    const activeOption = mentionOptionRefs.current[props.mentionIndex];
    const mentionMenu = mentionMenuRef.current;
    if (!activeOption || !mentionMenu) {
      return;
    }
    const menuPadding = 6;
    const optionTop = activeOption.offsetTop - menuPadding;
    const optionBottom = activeOption.offsetTop + activeOption.offsetHeight + menuPadding;
    const visibleTop = mentionMenu.scrollTop;
    const visibleBottom = mentionMenu.scrollTop + mentionMenu.clientHeight;
    if (optionTop < visibleTop) {
      mentionMenu.scrollTop = Math.max(0, optionTop);
      return;
    }
    if (optionBottom > visibleBottom) {
      mentionMenu.scrollTop = Math.max(0, optionBottom - mentionMenu.clientHeight);
    }
  }, [props.mentionIndex, props.mentionMatch]);

  return (
    <>
      {!props.pathwayMode && (props.providerStatuses?.length ?? 0) > 0 ? (
        <div
          aria-label="웹 AI provider 상태"
          id="tasks-provider-status-strip"
          className="tasks-thread-provider-status-strip"
          data-e2e="tasks-provider-status-strip"
          role="region"
        >
          {props.providerStatuses?.map((status) => (
            <div
              aria-label={`${status.label} 상태 ${status.message}`}
              className={`tasks-thread-provider-status-card is-${status.state}`}
              data-e2e={`tasks-provider-status-card-${status.provider}`}
              key={status.provider}
              role="group"
              title={status.url || status.message}
            >
              <strong>{status.label}</strong>
              <span>{status.message}</span>
              <div className="tasks-thread-provider-status-actions">
                <button
                  aria-label={`${status.label} 세션 열기`}
                  data-e2e={`tasks-provider-open-${status.provider}`}
                  onClick={() => props.onOpenProviderSession(status.provider)}
                  type="button"
                >
                  세션 열기
                </button>
                <button
                  aria-label={`${status.label} 상태 새로고침`}
                  className="tasks-thread-provider-status-refresh"
                  data-e2e={`tasks-provider-refresh-${status.provider}`}
                  disabled={props.providerStatusPending}
                  onClick={props.onRefreshProviderStatuses}
                  title="상태 새로고침"
                  type="button"
                >
                  <img alt="" aria-hidden="true" src="/reload.svg" />
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : null}
      <div
        aria-label="Tasks 질문 작성기"
        className={`tasks-thread-composer-shell question-input agents-composer${props.pathwayMode ? " is-pathway-mode" : ""}`.trim()}
        data-e2e="tasks-composer-shell"
        role="region"
      >
      {!props.pathwayMode && props.mentionMatch ? (
        <div
          aria-label={t("tasks.aria.agentMentions")}
          className="tasks-thread-mention-menu"
          data-e2e="tasks-mention-menu"
          id="tasks-mention-menu"
          ref={mentionMenuRef}
          role="listbox"
        >
          {props.mentionMatch.options.map((option, index) => {
            const previousKind = props.mentionMatch?.options[index - 1]?.kind;
            const startsSection = index > 0 && previousKind !== option.kind;
            return (
            <button
              aria-label={`${option.mention} ${option.label} ${option.description}`.trim()}
              id={`tasks-mention-option-${option.mention.replace(/[^a-z0-9_-]+/gi, "").toLowerCase()}`}
              aria-selected={index === props.mentionIndex}
              className={`tasks-thread-mention-option${index === props.mentionIndex ? " is-active" : ""}${startsSection ? " is-section-start" : ""}`}
              data-e2e={`tasks-mention-option-${option.mention.replace(/[^a-z0-9_-]+/gi, "").toLowerCase()}`}
              key={option.mention}
              ref={(node) => {
                mentionOptionRefs.current[index] = node;
              }}
              onMouseDown={(event) => {
                event.preventDefault();
                props.onSelectMention(option);
              }}
              title={`${option.mention} · ${option.label}`}
              type="button"
            >
              <strong>{option.mention}</strong>
              <span>{option.label}</span>
              <small>{option.description}</small>
            </button>
            );
          })}
        </div>
      ) : null}

      {props.attachedFiles.length > 0 ? (
        <div aria-label="첨부 파일 목록" className="agents-file-list" data-e2e="tasks-attached-files">
          {props.attachedFiles.map((file) => (
            <span aria-label={`${file.name} 첨부 파일`} className="agents-file-chip" data-e2e={`tasks-attached-file-${file.id}`} key={file.id}>
              <span className={`agents-file-chip-name${file.enabled === false ? " is-disabled" : ""}`} title={file.path}>
                {file.name}
              </span>
              <button
                aria-label={`${file.name} 첨부 파일 제거`}
                className="agents-file-chip-remove"
                data-e2e={`tasks-attached-file-remove-${file.id}`}
                onClick={() => props.onRemoveAttachedFile(file.id)}
                type="button"
              >
                ×
              </button>
            </span>
          ))}
        </div>
      ) : null}

      {!props.pathwayMode ? (
      <div aria-label="선택된 에이전트 및 provider" className="tasks-thread-selected-mentions" data-e2e="tasks-selected-badges">
          <button
            aria-label={props.creativeModeEnabled ? "창의성 모드 켜짐, 끄기" : "창의성 모드 꺼짐, 켜기"}
            aria-pressed={props.creativeModeEnabled}
            className={`tasks-thread-selected-mention-chip tasks-thread-creative-mode-toggle${props.creativeModeEnabled ? " is-active" : ""}`}
            data-e2e="tasks-creative-mode-toggle"
            onClick={props.onToggleCreativeMode}
            title={props.creativeModeEnabled ? "창의성 모드 켜짐, 끄기" : "창의성 모드 꺼짐, 켜기"}
            type="button"
          >
            {props.creativeModeEnabled ? "창의성 모드: ON" : "창의성 모드: OFF"}
          </button>
          {selectedBadges.map((badge) => (
            <span
              aria-label={`${badge.kind === "auto-agent" || badge.kind === "auto-provider" ? "자동 선택" : "선택됨"} ${badge.label}`}
              className={`tasks-thread-selected-mention-chip${badge.kind === "auto-agent" || badge.kind === "auto-provider" ? " is-auto" : ""}${badge.kind === "provider" || badge.kind === "auto-provider" ? " is-provider" : ""}`}
              data-e2e={`tasks-selected-badge-${badge.key.replace(/[^a-z0-9_-]+/gi, "-").toLowerCase()}`}
              key={badge.key}
              role="group"
              title={badge.kind === "auto-agent" || badge.kind === "auto-provider" ? "Orchestrator selected this automatically." : undefined}
            >
              <span>{badge.kind === "auto-agent" || badge.kind === "auto-provider" ? `AUTO: ${badge.label}` : badge.label}</span>
              {badge.kind === "auto-agent" || badge.kind === "auto-provider" ? null : (
                <button
                  aria-label={`${badge.label} 제거`}
                  data-e2e={`tasks-selected-badge-remove-${badge.key.replace(/[^a-z0-9_-]+/gi, "-").toLowerCase()}`}
                  onClick={() => {
                    if (badge.kind === "agent" && badge.roleId) {
                      props.onRemoveComposerRole(badge.roleId);
                      return;
                    }
                    if (badge.kind === "provider") {
                      props.onRemoveComposerProvider(badge.value ?? "");
                      return;
                    }
                    props.onClearCoordinationModeOverride();
                  }}
                  type="button"
                >
                  ×
                </button>
              )}
            </span>
          ))}
      </div>
      ) : null}
      <div aria-label="질문 입력 영역" className="tasks-thread-composer-input-wrap" role="group">
        <textarea
          ref={props.composerRef}
          aria-label="Tasks 질문 입력"
          aria-autocomplete="list"
          aria-controls={props.mentionMatch ? "tasks-mention-menu" : undefined}
          aria-expanded={Boolean(props.mentionMatch)}
          className="tasks-thread-composer-input"
          data-e2e="tasks-composer-input"
          id="tasks-composer-input"
          name="tasks-composer-input"
          disabled={composerDisabled}
          onClick={(event) => props.onComposerCursorChange(event.currentTarget.selectionStart ?? 0)}
          onChange={(event) => props.onComposerDraftChange(event.target.value, event.target.selectionStart ?? event.target.value.length)}
          onKeyDown={props.onComposerKeyDown}
          onKeyUp={(event) => props.onComposerCursorChange(event.currentTarget.selectionStart ?? 0)}
          placeholder={composerPlaceholder}
          rows={1}
          value={props.composerDraft}
        />
      </div>

      <div aria-label="질문 작성 도구막대" className="question-input-footer tasks-thread-composer-toolbar" role="group">
        <div aria-label="모델 및 파일 제어" className="agents-composer-left tasks-thread-composer-controls" role="group">
          <button
            aria-label="코드 파일 첨부"
            className="agents-icon-button"
            data-e2e="tasks-attach-files"
            disabled={composerDisabled}
            onClick={props.onOpenAttachmentPicker}
            type="button"
          >
            <img alt="" aria-hidden="true" src="/plus-large-svgrepo-com.svg" />
          </button>
        </div>

        <div aria-label="질문 전송 제어" className="agents-composer-actions" role="group">
          {props.showStopButton && !props.stoppingComposerRun ? (
            <button
              aria-label={props.stoppingComposerRun ? t("common.loading") : t("tasks.actions.stop")}
              className="agents-stop-button"
              data-e2e="tasks-stop-button"
              disabled={!props.canUseStopButton || props.stoppingComposerRun}
              onClick={props.onStop}
              title={props.stoppingComposerRun ? t("common.loading") : t("tasks.actions.stop")}
              type="button"
            >
              <img alt="" aria-hidden="true" src="/canvas-stop.svg" />
            </button>
          ) : (
            <button
              aria-label={props.stoppingComposerRun ? t("common.loading") : t("tasks.actions.send")}
              className="agents-send-button"
              data-e2e="tasks-send-button"
              disabled={props.stoppingComposerRun || composerDisabled || !canSubmit}
              onClick={props.onSubmit}
              title={props.stoppingComposerRun ? t("common.loading") : t("tasks.actions.send")}
              type="button"
            >
              <img alt="" aria-hidden="true" className="question-create-icon" src="/up.svg" />
            </button>
          )}
        </div>
      </div>
      </div>
    </>
  );
}
