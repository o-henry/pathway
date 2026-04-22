import { type KeyboardEvent as ReactKeyboardEvent, type RefObject, useEffect } from "react";
import { useI18n } from "../../../i18n";
import type { TurnExecutor } from "../../../features/workflow/domain";
import type { KnowledgeFileRef } from "../../../features/workflow/types";
import { DEFAULT_TURN_REASONING_LEVEL } from "../../../features/workflow/reasoningLevels";
import {
  DEFAULT_RUNTIME_MODEL_VALUE,
  findRuntimeModelOption,
} from "../../../features/workflow/runtimeModelOptions";

type WorkflowQuestionComposerProps = {
  attachedFiles: KnowledgeFileRef[];
  canRunGraphNow: boolean;
  isWorkflowBusy: boolean;
  onRunGraph: () => Promise<void>;
  onApplyModelSelection: (selection: {
    modelValue: string;
    modelLabel: string;
    executor: TurnExecutor;
    turnModel?: string;
    reasoningLevel?: string;
  }) => void;
  questionInputRef: RefObject<HTMLTextAreaElement | null>;
  setWorkflowQuestion: (value: string) => void;
  workflowQuestion: string;
  onOpenKnowledgeFilePicker: () => void;
  onRemoveKnowledgeFile: (fileId: string) => void;
  onSubmitMessage?: (message: string) => void;
};

export default function WorkflowQuestionComposer({
  attachedFiles,
  canRunGraphNow,
  isWorkflowBusy,
  onRunGraph,
  onApplyModelSelection,
  onOpenKnowledgeFilePicker,
  onRemoveKnowledgeFile,
  questionInputRef,
  setWorkflowQuestion,
  workflowQuestion,
  onSubmitMessage,
}: WorkflowQuestionComposerProps) {
  const { t } = useI18n();
  const selectedModelOption = findRuntimeModelOption(DEFAULT_RUNTIME_MODEL_VALUE);
  const selectedReasonLevel = DEFAULT_TURN_REASONING_LEVEL;
  const hasQuestion = workflowQuestion.trim().length > 0;
  const composerDisabled = isWorkflowBusy;
  const placeholder = t("workflow.question.placeholder");

  useEffect(() => {
    onApplyModelSelection({
      modelValue: selectedModelOption.value,
      modelLabel: selectedModelOption.label,
      executor: selectedModelOption.executor,
      turnModel: selectedModelOption.turnModel,
      reasoningLevel: selectedReasonLevel,
    });
  }, [onApplyModelSelection, selectedModelOption.executor, selectedModelOption.label, selectedModelOption.turnModel, selectedModelOption.value, selectedReasonLevel]);

  const onSubmitWorkflowComposer = () => {
    const text = workflowQuestion.trim();
    if (!text) {
      return;
    }
    if (!canRunGraphNow) {
      return;
    }
    onSubmitMessage?.(text);
    setWorkflowQuestion(`[model=${selectedModelOption.value}, reason=${selectedReasonLevel}] ${text}`);
    window.setTimeout(() => {
      void onRunGraph();
    }, 0);
  };

  const onComposerKeyDown = (event: ReactKeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== "Enter" || event.shiftKey) {
      return;
    }
    event.preventDefault();
    if (!canRunGraphNow || !hasQuestion) {
      return;
    }
    onSubmitWorkflowComposer();
  };

  return (
    <div className="question-input agents-composer workflow-question-input">
      <textarea
        disabled={composerDisabled}
        onChange={(e) => setWorkflowQuestion(e.currentTarget.value)}
        onKeyDown={onComposerKeyDown}
        placeholder={placeholder}
        ref={questionInputRef}
        rows={1}
        value={workflowQuestion}
      />
      {attachedFiles.length > 0 && (
        <div className="agents-file-list" aria-label="Attached files">
          {attachedFiles.map((file) => (
            <span key={file.id} className="agents-file-chip">
              <span
                className={`agents-file-chip-name${file.enabled === false ? " is-disabled" : ""}`}
                title={file.path}
              >
                {file.name}
              </span>
              <button
                aria-label={`${file.name} ${t("common.delete")}`}
                className="agents-file-chip-remove"
                onClick={() => onRemoveKnowledgeFile(file.id)}
                type="button"
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}
      <div className="question-input-footer">
        <div className="agents-composer-left">
          <button
            aria-label={t("workflow.knowledge.addFile")}
            className="agents-icon-button"
            disabled={composerDisabled}
            onClick={onOpenKnowledgeFilePicker}
            type="button"
          >
            <img alt="" aria-hidden="true" src="/plus-large-svgrepo-com.svg" />
          </button>
        </div>
        <button
          className="primary-action question-create-button agents-send-button"
          disabled={composerDisabled || !canRunGraphNow || !hasQuestion}
          onClick={onSubmitWorkflowComposer}
          type="button"
        >
          <img alt="" aria-hidden="true" className="question-create-icon" src="/up.svg" />
        </button>
      </div>
    </div>
  );
}
