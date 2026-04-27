import {
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { RUNTIME_MODEL_OPTIONS } from "../../features/workflow/runtimeModelOptions";
import { t as translate, useI18n } from "../../i18n";
import {
  getThreadStageLabel,
  type ThreadStageId,
} from "./taskAgentPresets";
import {
  getTaskAgentMentionMatch,
  stripTaskAgentMentionMatch,
  type TaskAgentMentionOption,
} from "./taskAgentMentions";
import { buildThreadFileTree } from "./threadFileTree";
import { buildLiveAgentCards, resolveLiveServiceStatus } from "./liveAgentState";
import { type ComposerProviderModel, useTasksThreadState } from "./useTasksThreadState";
import { useTasksWebProviderStatus } from "./useTasksWebProviderStatus";
import { TasksThreadNavPane } from "./TasksThreadNavPane";
import { TasksThreadHeaderBar } from "./TasksThreadHeaderBar";
import { TasksThreadConversation } from "./TasksThreadConversation";
import { TasksThreadReviewPane } from "./TasksThreadReviewPane";
import { shouldShowTasksComposerStopButton, TasksThreadComposer } from "./TasksThreadComposer";
import type { GoalAnalysisRecord, GoalRecord } from "../../lib/types";

type InvokeFn = <T>(command: string, args?: Record<string, unknown>) => Promise<T>;

type TasksPageProps = {
  pathwayMode?: boolean;
  pathwayGoals?: GoalRecord[];
  activeGoalId?: string | null;
  activeGoalTitle?: string | null;
  pathwayGoalAnalysis?: GoalAnalysisRecord | null;
  pathwayGoalAnalysisError?: { goalId: string; message: string } | null;
  pathwayHasActiveGraph?: boolean;
  onSelectGoal?: (goalId: string | null) => void;
  onDeleteGoal?: (goalId: string) => void;
  onOpenWorkflow?: () => void;
  onStartPathwayIntake?: (goalText: string) => Promise<{ goal: GoalRecord; analysis: GoalAnalysisRecord }>;
  onGeneratePathwayFromIntake?: (goalId: string, answers: string[]) => Promise<void>;
  onCancelPathwayWork?: () => Promise<void> | void;
  cwd: string;
  hasTauriRuntime: boolean;
  isActive?: boolean;
  loginCompleted: boolean;
  codexAuthCheckPending: boolean;
  invokeFn: InvokeFn;
  publishAction: (action: any) => void;
  appendWorkspaceEvent: (params: {
    source: string;
    message: string;
    actor?: "user" | "ai" | "system";
    level?: "info" | "error";
    runId?: string;
    topic?: string;
  }) => void;
  setStatus: (message: string) => void;
  onOpenSettings?: () => void;
};

const REASONING_LABELS: Record<string, string> = {
  낮음: "LOW",
  중간: "MEDIUM",
  높음: "HIGH",
  "매우 높음": "VERY HIGH",
};

function displayReasoningLabel(input: string | null | undefined) {
  const value = String(input ?? "").trim();
  return REASONING_LABELS[value] || value || "MEDIUM";
}

function normalizeThreadTitle(input: string | null | undefined) {
  const value = String(input ?? "").trim();
  if (!value) return translate("tasks.thread.new");
  const normalized = value.toLowerCase();
  if (
    normalized === "new thread"
    || normalized === "새 thread"
    || normalized === "새 스레드"
    || normalized === translate("tasks.thread.new").toLowerCase()
  ) {
    return translate("tasks.thread.new");
  }
  return value;
}

function displayThreadPath(input: string | null | undefined) {
  return String(input ?? "").trim().toUpperCase();
}

function displayThreadTitle(input: string | null | undefined) {
  return normalizeThreadTitle(input);
}

const EMPTY_THREAD_MESSAGES: never[] = [];
const EMPTY_APPROVALS: never[] = [];
const EMPTY_RUNTIME_SESSIONS: never[] = [];

type PathwayIntakePhase = "idle" | "analyzing" | "clarifying" | "ready" | "generating";

type PathwayIntakeMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
};

type PathwayIntakeState = {
  phase: PathwayIntakePhase;
  goalId: string | null;
  answers: string[];
  messages: PathwayIntakeMessage[];
};

const EMPTY_PATHWAY_INTAKE_STATE: PathwayIntakeState = {
  phase: "idle",
  goalId: null,
  answers: [],
  messages: [],
};
const PATHWAY_INTAKE_STORAGE_KEY = "pathway:intake:v1";

const APPROVAL_PATTERN = /^(ok|okay|yes|y|go|오케이|오케|ㅇㅋ|좋아|좋습니다|진행|시작|생성|해줘|그래|확인|승인)[\s.!?。]*$/i;

function makePathwayMessage(role: PathwayIntakeMessage["role"], content: string): PathwayIntakeMessage {
  return {
    id: `${role}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    role,
    content,
  };
}

function isApprovalText(input: string): boolean {
  return APPROVAL_PATTERN.test(input.trim());
}

function isTransientBackendMessage(input: string): boolean {
  return /Pathway 로컬 백엔드가 아직 준비되지 않았습니다|failed to fetch|networkerror|load failed/i.test(input);
}

function normalizePathwayIntakeState(input: unknown, goalId: string): PathwayIntakeState | null {
  if (!input || typeof input !== "object") {
    return null;
  }
  const candidate = input as Partial<PathwayIntakeState>;
  if (candidate.goalId !== goalId || !Array.isArray(candidate.messages)) {
    return null;
  }
  const phase: PathwayIntakePhase =
    candidate.phase === "analyzing" || candidate.phase === "clarifying" || candidate.phase === "ready" || candidate.phase === "generating"
      ? candidate.phase
      : "idle";
  const messages = candidate.messages
    .filter((message): message is PathwayIntakeMessage => (
      Boolean(message)
      && (message.role === "user" || message.role === "assistant")
      && typeof message.content === "string"
      && typeof message.id === "string"
    ));
  return {
    phase: phase === "generating" ? "ready" : phase,
    goalId,
    answers: Array.isArray(candidate.answers)
      ? candidate.answers.filter((answer): answer is string => typeof answer === "string")
      : [],
    messages,
  };
}

function loadStoredPathwayIntake(goalId: string | null | undefined): PathwayIntakeState | null {
  const normalizedGoalId = String(goalId ?? "").trim();
  if (!normalizedGoalId || typeof window === "undefined") {
    return null;
  }
  try {
    const raw = window.localStorage.getItem(PATHWAY_INTAKE_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return normalizePathwayIntakeState(parsed?.[normalizedGoalId], normalizedGoalId);
  } catch {
    return null;
  }
}

function storePathwayIntake(state: PathwayIntakeState): void {
  const goalId = String(state.goalId ?? "").trim();
  if (!goalId || state.messages.length === 0 || typeof window === "undefined") {
    return;
  }
  try {
    const raw = window.localStorage.getItem(PATHWAY_INTAKE_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    window.localStorage.setItem(
      PATHWAY_INTAKE_STORAGE_KEY,
      JSON.stringify({
        ...parsed,
        [goalId]: state,
      }),
    );
  } catch {
    // Non-critical persistence; the in-memory conversation still works.
  }
}

function formatPathwayFollowups(analysis: GoalAnalysisRecord): string {
  const questions = analysis.followup_questions.slice(0, 8);
  if (questions.length === 0) {
    return [
      "목표 분석은 끝났지만 추가 체크리스트 질문은 생성되지 않았습니다.",
      "바로 진행하려면 OK라고 답하거나, 보완할 내용을 자연어로 더 적어주세요.",
    ].join("\n");
  }
  return [
    "좋아요. 바로 그래프를 만들기 전에 필요한 것만 확인할게요.",
    "",
    ...questions.map((question) => `- [ ] ${question.question}`),
    "",
    "아는 만큼만 답해 주세요. 답을 받으면 제가 상황을 정리하고, OK를 받은 뒤 조사와 그래프 생성을 시작하겠습니다.",
  ].join("\n");
}

function formatPathwayAnalysisPendingMessage(): string {
  return "목표를 저장했습니다. GPT-5.5가 이 목표를 분석해 체크리스트 질문을 만드는 중입니다.";
}

function formatPathwayReadyMessage(answer: string): string {
  const answerLines = answer
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const normalizedAnswerLines = answerLines.length > 0 ? answerLines : [answer.trim()];
  return [
    "받았어요. 지금 기준으로는 이렇게 진행할 수 있습니다.",
    "",
    "- [x] 사용자 상황 반영:",
    ...normalizedAnswerLines.map((line, index) => {
      if (/^\d+[\).]\s+/.test(line)) {
        return line;
      }
      return `${index + 1}. ${line}`;
    }),
    "- [ ] 목표 분석 결과와 답변을 합쳐 조사 질문으로 정리",
    "- [ ] 근거/가정/리스크가 구분되는 Pathway 그래프 생성",
    "",
    "이대로 조사와 그래프 생성을 시작해도 될까요? OK라고 답하거나, 보완할 내용을 더 적어주세요.",
  ].join("\n");
}

function renderPathwayMessageContent(content: string) {
  const lines = content.split("\n");
  const output: ReactNode[] = [];
  let listItems: ReactNode[] = [];
  const flushList = () => {
    if (listItems.length === 0) {
      return;
    }
    output.push(
      <ul className="pathway-intake-checklist" key={`list-${output.length}`}>
        {listItems}
      </ul>,
    );
    listItems = [];
  };

  lines.forEach((line, index) => {
    const checklistMatch = line.match(/^- \[( |x)\]\s+(.*)$/i);
    if (checklistMatch) {
      listItems.push(
        <li className={checklistMatch[1].toLowerCase() === "x" ? "is-done" : ""} key={`item-${index}`}>
          {checklistMatch[2]}
        </li>,
      );
      return;
    }
    flushList();
    if (!line.trim()) {
      output.push(<span aria-hidden="true" className="pathway-intake-break" key={`break-${index}`} />);
      return;
    }
    const answerLine = /^\d+[\).]\s+/.test(line.trim());
    output.push(<p className={answerLine ? "pathway-intake-answer-line" : undefined} key={`line-${index}`}>{line}</p>);
  });
  flushList();
  return output;
}

function isMultilinePathwayMessage(content: string): boolean {
  return content
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean).length > 1;
}

const EMPTY_LIVE_EVENTS: never[] = [];

export default function TasksPage(props: TasksPageProps) {
  const { t } = useI18n();
  const state = useTasksThreadState(props);
  const composerRef = useRef<HTMLTextAreaElement | null>(null);
  const conversationRef = useRef<HTMLDivElement | null>(null);
  const modelMenuRef = useRef<HTMLDivElement | null>(null);
  const reasonMenuRef = useRef<HTMLDivElement | null>(null);
  const [isModelMenuOpen, setIsModelMenuOpen] = useState(false);
  const [isReasonMenuOpen, setIsReasonMenuOpen] = useState(false);
  const [isEditingThreadTitle, setIsEditingThreadTitle] = useState(false);
  const [threadTitleDraft, setThreadTitleDraft] = useState("");
  const [selectedStageId, setSelectedStageId] = useState<ThreadStageId>("brief");
  const [pendingDeleteThreadId, setPendingDeleteThreadId] = useState("");
  const [pendingDeleteProjectPath, setPendingDeleteProjectPath] = useState("");
  const [collapsedProjects, setCollapsedProjects] = useState<Record<string, boolean>>({});
  const [collapsedDirectories, setCollapsedDirectories] = useState<Record<string, boolean>>({});
  const [isFilesExpanded, setIsFilesExpanded] = useState(false);
  const [composerCursor, setComposerCursor] = useState(0);
  const [mentionIndex, setMentionIndex] = useState(0);
  const [isMentionMenuHidden, setIsMentionMenuHidden] = useState(false);
  const [isMainSurfaceFullscreen, setIsMainSurfaceFullscreen] = useState(false);
  const [isThreadNavHidden, setIsThreadNavHidden] = useState(false);
  const [isReviewPaneOpen, setIsReviewPaneOpen] = useState(false);
  const [pathwayIntakeDraft, setPathwayIntakeDraft] = useState("");
  const [pathwayIntakePending, setPathwayIntakePending] = useState(false);
  const [pathwayPendingStartedAt, setPathwayPendingStartedAt] = useState<number | null>(null);
  const [pathwayPendingElapsedSeconds, setPathwayPendingElapsedSeconds] = useState(0);
  const pathwayRunRef = useRef<{ id: number; cancelled: boolean }>({ id: 0, cancelled: false });
  const [pathwayIntake, setPathwayIntake] = useState<PathwayIntakeState>(
    () => loadStoredPathwayIntake(props.activeGoalId) ?? EMPTY_PATHWAY_INTAKE_STATE,
  );
  const title = useMemo(() => displayThreadTitle(state.activeThread?.thread.title), [state.activeThread]);
  const headerTitle = state.activeThread ? title : "";
  const selectedModelOption = useMemo(
    () => RUNTIME_MODEL_OPTIONS.find((option) => option.value === state.model) ?? RUNTIME_MODEL_OPTIONS[0],
    [state.model],
  );
  const selectedStage = useMemo(() => {
    const workflow = state.activeThread?.workflow;
    if (!workflow) {
      return null;
    }
    return workflow.stages.find((stage) => stage.id === selectedStageId)
      ?? workflow.stages.find((stage) => stage.id === workflow.currentStageId)
      ?? null;
  }, [selectedStageId, state.activeThread]);
  const currentStageLabel = selectedStage ? getThreadStageLabel(selectedStage.id) : t("tasks.workflow.title");
  const showStopButton = useMemo(
    () => shouldShowTasksComposerStopButton({
      canInterruptCurrentThread: state.canInterruptCurrentThread,
      composerSubmitPending: state.composerSubmitPending,
    }),
    [state.canInterruptCurrentThread, state.composerSubmitPending],
  );
  const {
    providerStatuses,
    providerStatusPending,
    refreshProviderStatuses,
    openProviderSession,
  } = useTasksWebProviderStatus({
    hasTauriRuntime: props.hasTauriRuntime,
    invokeFn: props.invokeFn,
    modelValues: state.composerProviderOverrides,
    setStatus: props.setStatus,
  });
  useEffect(() => {
    setThreadTitleDraft(headerTitle);
    setIsEditingThreadTitle(false);
  }, [headerTitle, state.activeThreadId]);

  useEffect(() => {
    setSelectedStageId(state.activeThread?.workflow.currentStageId ?? "brief");
  }, [state.activeThread?.thread.threadId, state.activeThread?.workflow.currentStageId]);

  useEffect(() => {
    setPendingDeleteThreadId("");
    setPendingDeleteProjectPath("");
    setCollapsedDirectories({});
    setIsFilesExpanded(false);
  }, [state.activeThreadId]);

  useEffect(() => {
    if ((state.activeThread?.changedFiles.length ?? 0) > 0 || state.selectedFileDiff.trim()) {
      setIsReviewPaneOpen(true);
    }
  }, [state.activeThread?.thread.threadId, state.activeThread?.changedFiles.length, state.selectedFileDiff]);

  useEffect(() => {
    if (!state.activeThread) {
      setIsReviewPaneOpen(false);
    }
  }, [state.activeThread]);

  useEffect(() => {
    setComposerCursor(state.composerDraft.length);
  }, [state.composerDraft]);

  useEffect(() => {
    if (!props.pathwayMode || pathwayIntakePending) {
      return;
    }
    const activeGoalId = String(props.activeGoalId ?? "").trim();
    if (!activeGoalId) {
      setPathwayIntake(EMPTY_PATHWAY_INTAKE_STATE);
      return;
    }
    const analysis = props.pathwayGoalAnalysis?.goal_id === activeGoalId ? props.pathwayGoalAnalysis : null;
    const analysisError = props.pathwayGoalAnalysisError?.goalId === activeGoalId ? props.pathwayGoalAnalysisError.message.trim() : "";
    setPathwayIntake((current) => {
      const restored = current.goalId === activeGoalId && current.messages.length > 0
        ? current
        : loadStoredPathwayIntake(activeGoalId);
      if (restored && restored.goalId === activeGoalId && restored.messages.length > 0) {
        const activeRestored = props.pathwayHasActiveGraph
          ? {
              ...restored,
              messages: restored.messages.filter((message) => !isTransientBackendMessage(message.content)),
            }
          : restored;
        if (activeRestored.messages.length === 0) {
          return {
            phase: props.pathwayHasActiveGraph ? "ready" : "analyzing",
            goalId: activeGoalId,
            answers: activeRestored.answers,
            messages: [],
          };
        }
        const hasAssistantMessage = activeRestored.messages.some((message) => message.role === "assistant");
        if (analysis && !hasAssistantMessage) {
          return {
            ...activeRestored,
            phase: "clarifying",
            messages: [...activeRestored.messages, makePathwayMessage("assistant", formatPathwayFollowups(analysis))],
          };
        }
        if (analysis && hasAssistantMessage) {
          const nextFollowups = formatPathwayFollowups(analysis);
          const assistantIndex = activeRestored.messages.findIndex((message) => message.role === "assistant");
          if (assistantIndex >= 0 && activeRestored.messages[assistantIndex]?.content !== nextFollowups) {
            return {
              ...activeRestored,
              phase: activeRestored.phase === "idle" || activeRestored.phase === "analyzing" ? "clarifying" : activeRestored.phase,
              messages: activeRestored.messages.map((message, index) => (
                index === assistantIndex ? { ...message, content: nextFollowups } : message
              )),
            };
          }
        }
        const hasSameError = analysisError && activeRestored.messages.some((message) => message.content === analysisError);
        if (!analysis && analysisError && !hasSameError && !isTransientBackendMessage(analysisError) && !props.pathwayHasActiveGraph) {
          return {
            ...activeRestored,
            phase: "idle",
            messages: [...activeRestored.messages, makePathwayMessage("assistant", analysisError)],
          };
        }
        return activeRestored;
      }
      const goalText = String(props.activeGoalTitle ?? "").trim();
      const messages: PathwayIntakeMessage[] = [];
      if (goalText) {
        messages.push(makePathwayMessage("user", goalText));
      }
      if (analysis) {
        messages.push(makePathwayMessage("assistant", formatPathwayFollowups(analysis)));
      }
      if (!analysis && analysisError && !isTransientBackendMessage(analysisError) && !props.pathwayHasActiveGraph) {
        messages.push(makePathwayMessage("assistant", analysisError));
      }
      if (!analysis && (!analysisError || isTransientBackendMessage(analysisError)) && !props.pathwayHasActiveGraph) {
        messages.push(makePathwayMessage("assistant", formatPathwayAnalysisPendingMessage()));
      }
      return {
        phase: analysis ? "clarifying" : props.pathwayHasActiveGraph ? "ready" : "analyzing",
        goalId: activeGoalId,
        answers: [],
        messages,
      };
    });
  }, [
    props.activeGoalId,
    props.activeGoalTitle,
    props.pathwayGoalAnalysis,
    props.pathwayGoalAnalysisError,
    props.pathwayHasActiveGraph,
    props.pathwayMode,
    pathwayIntakePending,
  ]);

  useEffect(() => {
    if (!props.pathwayMode) {
      return;
    }
    storePathwayIntake(pathwayIntake);
  }, [props.pathwayMode, pathwayIntake]);

  useEffect(() => {
    if (!state.composerDraft) {
      setIsMentionMenuHidden(false);
    }
  }, [state.composerDraft]);

  useEffect(() => {
    if (!isModelMenuOpen && !isReasonMenuOpen) {
      return;
    }
    const onPointerDown = (event: PointerEvent) => {
      if (!modelMenuRef.current?.contains(event.target as Node)) {
        setIsModelMenuOpen(false);
      }
      if (!reasonMenuRef.current?.contains(event.target as Node)) {
        setIsReasonMenuOpen(false);
      }
    };
    window.addEventListener("pointerdown", onPointerDown);
    return () => window.removeEventListener("pointerdown", onPointerDown);
  }, [isModelMenuOpen, isReasonMenuOpen]);

  const handleNewThread = () => {
    void state.openNewThread();
    requestAnimationFrame(() => composerRef.current?.focus());
  };

  const commitThreadTitle = () => {
    const nextTitle = normalizeThreadTitle(threadTitleDraft);
    setThreadTitleDraft(nextTitle);
    setIsEditingThreadTitle(false);
    void state.renameThread(nextTitle);
  };

  const onComposerKeyDown = (event: ReactKeyboardEvent<HTMLTextAreaElement>) => {
    const currentMentionMatch = mentionMatch ?? getTaskAgentMentionMatch(
      event.currentTarget.value,
      event.currentTarget.selectionStart ?? event.currentTarget.value.length,
    );
    if (currentMentionMatch) {
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setMentionIndex((current) => Math.min(current + 1, currentMentionMatch.options.length - 1));
        return;
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        setMentionIndex((current) => Math.max(current - 1, 0));
        return;
      }
      if (event.key === "Enter" || event.key === "Tab") {
        event.preventDefault();
        selectMention(currentMentionMatch.options[mentionIndex]!, currentMentionMatch);
        return;
      }
      if (event.key === "Escape") {
        event.preventDefault();
        setMentionIndex(0);
        setIsMentionMenuHidden(true);
        return;
      }
    }
    if (event.key !== "Enter" || event.shiftKey) {
      return;
    }
    event.preventDefault();
    if (showStopButton) {
      if (state.canInterruptCurrentThread) {
        void state.stopComposerRun();
      }
      return;
    }
    void state.submitComposer();
  };

  const beginPathwayRun = () => {
    const nextRun = { id: pathwayRunRef.current.id + 1, cancelled: false };
    pathwayRunRef.current = nextRun;
    return nextRun.id;
  };

  const isCurrentPathwayRun = (runId: number) => pathwayRunRef.current.id === runId && !pathwayRunRef.current.cancelled;

  const cancelPathwayRun = async () => {
    pathwayRunRef.current = { ...pathwayRunRef.current, cancelled: true };
    setPathwayIntakePending(false);
    setPathwayIntake((current) => ({
      ...current,
      phase: current.phase === "generating" ? "ready" : current.phase,
      messages: [
        ...current.messages,
        makePathwayMessage("assistant", "실행이 중단되었습니다."),
      ],
    }));
    await props.onCancelPathwayWork?.();
  };

  const submitPathwayIntake = async () => {
    const input = pathwayIntakeDraft.trim();
    if (!input || pathwayIntakePending) {
      return;
    }
    const userMessage = makePathwayMessage("user", input);
    setPathwayIntakeDraft("");
    setPathwayIntake((current) => ({
      ...current,
      messages: [...current.messages, userMessage],
    }));

    if (pathwayIntake.phase === "idle") {
      if (!props.onStartPathwayIntake) {
        setPathwayIntake((current) => ({
          ...current,
          messages: [
            ...current.messages,
            makePathwayMessage("assistant", "목표 상담 API가 아직 연결되지 않았습니다."),
          ],
        }));
        return;
      }
      try {
        const runId = beginPathwayRun();
        setPathwayIntakePending(true);
        const result = await props.onStartPathwayIntake(input);
        if (!isCurrentPathwayRun(runId)) {
          return;
        }
        setPathwayIntake((current) => ({
          ...current,
          phase: "clarifying",
          goalId: result.goal.id,
          answers: [],
          messages: [...current.messages, makePathwayMessage("assistant", formatPathwayFollowups(result.analysis))],
        }));
      } catch (error) {
        if (pathwayRunRef.current.cancelled) {
          return;
        }
        const message = error instanceof Error ? error.message : "목표 상담을 시작하지 못했습니다.";
        setPathwayIntake((current) => ({
          ...current,
          messages: [...current.messages, makePathwayMessage("assistant", message)],
        }));
      } finally {
        if (!pathwayRunRef.current.cancelled) {
          setPathwayIntakePending(false);
        }
      }
      return;
    }

    if (pathwayIntake.phase === "analyzing") {
      setPathwayIntake((current) => ({
        ...current,
        messages: [
          ...current.messages,
          makePathwayMessage("assistant", formatPathwayAnalysisPendingMessage()),
        ],
      }));
      return;
    }

    if (pathwayIntake.phase === "clarifying") {
      if (isApprovalText(input)) {
        setPathwayIntake((current) => ({
          ...current,
          messages: [
            ...current.messages,
            makePathwayMessage("assistant", "좋아요. 다만 그래프 품질을 위해 위 체크리스트에 대한 답을 한 번만 적어주세요. 짧게 적어도 됩니다."),
          ],
        }));
        return;
      }
      setPathwayIntake((current) => ({
        ...current,
        phase: "ready",
        answers: [...current.answers, input],
        messages: [
          ...current.messages,
          makePathwayMessage("assistant", formatPathwayReadyMessage(input)),
        ],
      }));
      return;
    }

    if (pathwayIntake.phase === "ready") {
      if (!isApprovalText(input)) {
        setPathwayIntake((current) => ({
          ...current,
          answers: [...current.answers, input],
          messages: [
            ...current.messages,
            makePathwayMessage("assistant", formatPathwayReadyMessage(input)),
          ],
        }));
        return;
      }
      if (!pathwayIntake.goalId || !props.onGeneratePathwayFromIntake) {
        setPathwayIntake((current) => ({
          ...current,
          messages: [
            ...current.messages,
            makePathwayMessage("assistant", "그래프 생성 API가 아직 연결되지 않았습니다."),
          ],
        }));
        return;
      }
      try {
        const runId = beginPathwayRun();
        setPathwayIntakePending(true);
        setPathwayIntake((current) => ({
          ...current,
          phase: "generating",
          messages: [
            ...current.messages,
            makePathwayMessage("assistant", "승인 확인했습니다. 지금부터 답변을 목표 기록에 반영하고 조사/그래프 생성을 시작합니다."),
          ],
        }));
        await props.onGeneratePathwayFromIntake(pathwayIntake.goalId, pathwayIntake.answers);
        if (!isCurrentPathwayRun(runId)) {
          return;
        }
        setPathwayIntake((current) => ({
          ...current,
          messages: [
            ...current.messages,
            makePathwayMessage("assistant", "그래프를 생성했습니다. 워크플로우 탭에서 경로와 근거를 확인할 수 있습니다."),
          ],
        }));
      } catch (error) {
        if (pathwayRunRef.current.cancelled) {
          return;
        }
        const message = error instanceof Error ? error.message : "그래프 생성에 실패했습니다.";
        setPathwayIntake((current) => ({
          ...current,
          phase: "ready",
          messages: [...current.messages, makePathwayMessage("assistant", message)],
        }));
      } finally {
        if (!pathwayRunRef.current.cancelled) {
          setPathwayIntakePending(false);
        }
      }
    }
  };

  const onPathwayIntakeKeyDown = (event: ReactKeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== "Enter" || event.shiftKey) {
      return;
    }
    event.preventDefault();
    void submitPathwayIntake();
  };

  const visibleAgentLabels = useMemo(
    () => (state.activeThread?.agents ?? []).map((agent) => agent.label),
    [state.activeThread?.agents],
  );
  const liveAgents = useMemo(() => buildLiveAgentCards(state.activeThread, state.liveRoleNotes), [state.activeThread, state.liveRoleNotes]);
  const runtimeServiceStatus = useMemo(() => resolveLiveServiceStatus(state.activeThread), [state.activeThread]);
  const conversationMessages = state.activeThread?.messages ?? EMPTY_THREAD_MESSAGES;
  const deferredPendingApprovals = useDeferredValue(state.pendingApprovals ?? EMPTY_APPROVALS);
  const deferredLiveAgents = useDeferredValue(liveAgents);
  const deferredLiveProcessEvents = useDeferredValue(state.liveProcessEvents ?? EMPTY_LIVE_EVENTS);
  const fileTree = useMemo(() => buildThreadFileTree(state.activeThread?.files ?? []), [state.activeThread?.files]);
  const mentionMatch = useMemo(
    () => (props.pathwayMode || isMentionMenuHidden ? null : getTaskAgentMentionMatch(state.composerDraft, composerCursor)),
    [composerCursor, isMentionMenuHidden, props.pathwayMode, state.composerDraft],
  );
  const recentRuntimeSessions = useMemo(() => state.searchRuntimeSessions(""), [state.searchRuntimeSessions]);
  const deferredRecentRuntimeSessions = useDeferredValue(recentRuntimeSessions ?? EMPTY_RUNTIME_SESSIONS);
  const autoSelectedComposerRoleIds = useMemo(() => [], []);
  const autoSelectedProviderModel = null;
  const hasPathwayGoal = Boolean(props.activeGoalId || String(props.activeGoalTitle ?? "").trim());
  const pathwayPendingElapsedLabel = useMemo(() => {
    const minutes = Math.floor(pathwayPendingElapsedSeconds / 60);
    const seconds = pathwayPendingElapsedSeconds % 60;
    return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }, [pathwayPendingElapsedSeconds]);

  useEffect(() => {
    if (!pathwayIntakePending) {
      setPathwayPendingStartedAt(null);
      setPathwayPendingElapsedSeconds(0);
      return;
    }
    const startedAt = Date.now();
    setPathwayPendingStartedAt(startedAt);
    setPathwayPendingElapsedSeconds(0);
    const timer = window.setInterval(() => {
      setPathwayPendingElapsedSeconds(Math.floor((Date.now() - startedAt) / 1000));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [pathwayIntakePending]);

  useEffect(() => {
    setMentionIndex(0);
  }, [mentionMatch?.query]);

  const selectMention = (option: TaskAgentMentionOption, matchOverride?: typeof mentionMatch) => {
    const activeMatch = matchOverride ?? mentionMatch;
    if (!activeMatch) {
      return;
    }
    if (option.kind === "mode") {
      const nextValue = stripTaskAgentMentionMatch(state.composerDraft, activeMatch);
      const nextCursor = activeMatch.rangeStart;
      state.setComposerCoordinationModeOverride(option.mode ?? null);
      state.setComposerDraft(nextValue);
      setComposerCursor(nextCursor);
      setMentionIndex(0);
      setIsMentionMenuHidden(true);
      requestAnimationFrame(() => {
        composerRef.current?.focus();
        composerRef.current?.setSelectionRange(nextCursor, nextCursor);
      });
      return;
    }
    if (option.kind === "provider") {
      const nextValue = stripTaskAgentMentionMatch(state.composerDraft, activeMatch);
      const nextCursor = activeMatch.rangeStart;
      if (option.modelValue) {
        state.addComposerProviderOverride(option.modelValue as ComposerProviderModel);
      }
      state.setComposerDraft(nextValue);
      setComposerCursor(nextCursor);
      setMentionIndex(0);
      setIsMentionMenuHidden(true);
      requestAnimationFrame(() => {
        composerRef.current?.focus();
        composerRef.current?.setSelectionRange(nextCursor, nextCursor);
      });
      return;
    }
    const nextValue = stripTaskAgentMentionMatch(state.composerDraft, activeMatch);
    const nextCursor = activeMatch.rangeStart;
    if (!option.presetId) {
      return;
    }
    state.addComposerRole(option.presetId);
    state.setComposerDraft(nextValue);
    setComposerCursor(nextCursor);
    setMentionIndex(0);
    setIsMentionMenuHidden(true);
    requestAnimationFrame(() => {
      composerRef.current?.focus();
      composerRef.current?.setSelectionRange(nextCursor, nextCursor);
    });
  };

  useEffect(() => {
    const node = conversationRef.current;
    if (!node) {
      return;
    }
    node.scrollTop = node.scrollHeight;
  }, [conversationMessages.length, deferredLiveAgents.length, deferredPendingApprovals.length, pathwayIntake.messages.length, state.selectedFileDiff]);

  return (
    <section
      aria-label="Tasks 작업 공간"
      className={`tasks-thread-layout workspace-tab-panel${props.pathwayMode ? " pathway-goals-workspace" : ""}${isMainSurfaceFullscreen ? " is-main-surface-fullscreen" : ""}${isThreadNavHidden ? " is-thread-nav-hidden" : ""}${isReviewPaneOpen && state.activeThread ? " is-review-pane-open" : ""}`}
      data-e2e="tasks-workspace"
      role="region"
    >
      {props.pathwayMode ? (
        <aside aria-label="Pathway 목표 탐색" className="tasks-thread-nav pathway-tasks-nav" role="navigation">
          <section aria-label="Pathway 목표 탐색 아일랜드" className="tasks-thread-nav-island pathway-tasks-nav-island" role="region">
            <div className="tasks-thread-nav-actions">
              <button
                aria-label="새 목표"
                className="tasks-thread-new-button"
                onClick={() => {
                  setPathwayIntakeDraft("");
                  setPathwayIntake({
                    phase: "idle",
                    goalId: null,
                    answers: [],
                    messages: [],
                  });
                  props.onSelectGoal?.(null);
                  requestAnimationFrame(() => composerRef.current?.focus());
                }}
                type="button"
              >
                새 목표
              </button>
              <button aria-label="워크플로우 열기" className="tasks-thread-new-button" onClick={props.onOpenWorkflow} type="button">
                워크플로우
              </button>
              <div aria-label="현재 목표" className="tasks-thread-project-card" role="group">
                <strong>현재 목표</strong>
                <span title={props.activeGoalTitle ?? ""}>{props.activeGoalTitle || "-"}</span>
              </div>
            </div>
            <div aria-label="목표 목록 요약" className="tasks-thread-nav-copy" role="group">
              <strong>목표 목록</strong>
              <span>{`${props.pathwayGoals?.length ?? 0} goals`}</span>
            </div>
            <div aria-label="Pathway 목표 목록" className="tasks-thread-project-tree pathway-goal-tree" role="list">
              {(props.pathwayGoals?.length ?? 0) === 0 ? (
                <p className="tasks-thread-empty-copy">첫 목표를 만들어 로컬 의사결정 그래프를 시작하세요.</p>
              ) : (
                props.pathwayGoals!.map((goal) => (
                  <article
                    className={`tasks-thread-list-row${props.activeGoalId === goal.id ? " is-active" : ""}`}
                    key={goal.id}
                    role="listitem"
                  >
                    <button
                      aria-label={`${goal.title} 목표 삭제`}
                      className="tasks-thread-list-delete"
                      onClick={(event) => {
                        event.stopPropagation();
                        props.onDeleteGoal?.(goal.id);
                      }}
                      type="button"
                    >
                      <img alt="" aria-hidden="true" className="tasks-thread-list-delete-icon" src="/xmark.svg" />
                    </button>
                    <button
                      aria-label={`${goal.title} 목표 선택`}
                      className={`tasks-thread-list-item${props.activeGoalId === goal.id ? " is-active" : ""}`}
                      onClick={() => props.onSelectGoal?.(goal.id)}
                      type="button"
                    >
                      <div className="tasks-thread-list-title-row">
                        <strong>{goal.title}</strong>
                      </div>
                      <p>{goal.category || "uncategorized"}</p>
                      {goal.success_criteria ? (
                        <div className="tasks-thread-list-meta-row">
                          <span className="tasks-thread-list-stage is-active">{goal.success_criteria}</span>
                        </div>
                      ) : null}
                    </button>
                  </article>
                ))
              )}
            </div>
          </section>
        </aside>
      ) : (
      <TasksThreadNavPane
        activeThread={state.activeThread}
        activeThreadId={state.activeThreadId}
        collapsedDirectories={collapsedDirectories}
        collapsedProjects={collapsedProjects}
        currentStageLabel={currentStageLabel}
        cwd={props.cwd}
        fileTree={fileTree}
        hasActiveThread={Boolean(state.activeThread)}
        isFilesExpanded={isFilesExpanded}
        isReviewPaneOpen={isReviewPaneOpen}
        isThreadNavHidden={isThreadNavHidden}
        loading={state.loading}
        pendingApprovalsCount={state.pendingApprovals.length}
        projectGroups={state.projectGroups}
        projectPath={state.projectPath}
        selectedAgentDetail={state.selectedAgentDetail}
        selectedFilePath={state.selectedFilePath}
        selectedStage={selectedStage}
        onCompactSelectedAgentCodexThread={() => void state.compactSelectedAgentCodexThread()}
        onNewThread={handleNewThread}
        onOpenProjectDirectory={() => void state.openProjectDirectory()}
        onRequestDeleteProject={setPendingDeleteProjectPath}
        onRequestDeleteThread={setPendingDeleteThreadId}
        onSelectFilePath={state.setSelectedFilePath}
        onSelectProject={state.selectProject}
        onSelectThread={(threadId) => void state.selectThread(threadId)}
        onSetSelectedStageId={setSelectedStageId}
        onToggleReviewPane={() => {
          if (!state.activeThread) {
            return;
          }
          setIsReviewPaneOpen((current) => !current);
        }}
        onToggleThreadNav={() => setIsThreadNavHidden((current) => !current)}
        onToggleDirectory={(path) => setCollapsedDirectories((current) => ({ ...current, [path]: !current[path] }))}
        onToggleFilesExpanded={() => setIsFilesExpanded((current) => !current)}
        onToggleProject={(projectPath) => {
          const normalized = String(projectPath ?? "").trim();
          if (!normalized) {
            return;
          }
          setCollapsedProjects((current) => ({ ...current, [normalized]: !current[normalized] }));
        }}
      />
      )}

      <section aria-label="Tasks 메인 영역" className="tasks-thread-main-surface" role="region">
        <TasksThreadHeaderBar
          pathwayMode={props.pathwayMode}
          displayPath={displayThreadPath(state.projectPath || state.activeThread?.task.worktreePath || state.activeThread?.task.workspacePath || props.cwd)}
          hasActiveThread={Boolean(state.activeThread)}
          headerTitle={headerTitle}
          isEditingThreadTitle={isEditingThreadTitle}
          isMainSurfaceFullscreen={isMainSurfaceFullscreen}
          isReviewPaneOpen={isReviewPaneOpen}
          isThreadNavHidden={isThreadNavHidden}
          threadTitleDraft={threadTitleDraft}
          onCancelTitleEdit={() => {
            setThreadTitleDraft(headerTitle);
            setIsEditingThreadTitle(false);
          }}
          onChangeTitleDraft={setThreadTitleDraft}
          onCommitTitle={commitThreadTitle}
          onStartEditingTitle={() => setIsEditingThreadTitle(true)}
          onToggleMainSurfaceFullscreen={() => {
            if (!state.activeThread) {
              return;
            }
            setIsMainSurfaceFullscreen((current) => !current);
          }}
          onToggleReviewPane={() => {
            if (!state.activeThread) {
              return;
            }
            setIsReviewPaneOpen((current) => !current);
          }}
          onToggleThreadNav={() => setIsThreadNavHidden((current) => !current)}
        />

        {props.pathwayMode ? (
          <div aria-label="Pathway 상담 대화 영역" className="tasks-thread-conversation-scroll pathway-intake-conversation" ref={conversationRef}>
            {pathwayIntake.messages.length === 0 ? (
              <section aria-label="Pathway 상담 시작 상태" className="tasks-thread-empty-state pathway-intake-empty-state" role="region">
                {!hasPathwayGoal ? (
                  <div className="pathway-intake-empty-copy">
                    <strong>목표를 먼저 말해 주세요.</strong>
                    <p>에이전트가 필요한 것만 체크리스트로 다시 물어보고, 사용자가 OK하면 조사와 그래프 생성을 시작합니다.</p>
                  </div>
                ) : (
                  <div className="pathway-intake-empty-copy is-active-goal">
                    <span>CURRENT GOAL</span>
                    <strong>{props.activeGoalTitle}</strong>
                    <p>입력된 목표를 기준으로 필요한 확인만 이어서 묻고, 승인 후 그래프로 넘깁니다.</p>
                  </div>
                )}
              </section>
            ) : (
              <section aria-label="Pathway 상담 타임라인" className="tasks-thread-timeline pathway-intake-timeline" role="log">
                {pathwayIntake.messages.map((message) => {
                  const bodyClassName = `tasks-thread-log-line pathway-intake-message-body${
                    isMultilinePathwayMessage(message.content) ? " is-multiline" : ""
                  }`;
                  return (
                    <article
                      className={`tasks-thread-message-row is-${message.role} pathway-intake-message`}
                      key={message.id}
                    >
                      <span className="tasks-thread-message-label">{message.role === "user" ? "USER" : "PATHWAY"}</span>
                      <div className={bodyClassName}>
                        {renderPathwayMessageContent(message.content)}
                      </div>
                    </article>
                  );
                })}
                {pathwayIntakePending ? (
                  <article className="tasks-thread-message-row is-assistant pathway-intake-message is-pending">
                    <div className="pathway-intake-message-header">
                      <span className="tasks-thread-message-label">PATHWAY</span>
                      {pathwayPendingStartedAt ? (
                        <small className="pathway-intake-elapsed">{pathwayPendingElapsedLabel}</small>
                      ) : null}
                    </div>
                    <div className="tasks-thread-log-line pathway-intake-message-body">
                      <p className="pathway-intake-thinking">
                        <span>생각하는 중입니다</span>
                        <span aria-hidden="true" className="pathway-loading-dots">
                          <i />
                          <i />
                          <i />
                        </span>
                      </p>
                    </div>
                  </article>
                ) : null}
              </section>
            )}
          </div>
        ) : !state.activeThread ? (
          <div aria-label="빈 대화 영역" className="tasks-thread-conversation-scroll" ref={conversationRef}>
            <section aria-label="빈 스레드 상태" className="tasks-thread-empty-state" role="region">
              <strong>{t("tasks.empty.title")}</strong>
              <p>{t("tasks.empty.body")}</p>
            </section>
          </div>
        ) : (
          <TasksThreadConversation
            approvals={deferredPendingApprovals}
            conversationRef={conversationRef}
            liveAgents={deferredLiveAgents}
            liveProcessEvents={deferredLiveProcessEvents}
            latestRunInternalBadges={state.latestRunInternalBadges}
            messages={conversationMessages}
            orchestration={state.activeThreadCoordination}
            recentRuntimeSessions={deferredRecentRuntimeSessions}
            runtimeHeartbeatAt={state.runtimeHeartbeatAt}
            runtimeHeartbeatState={state.runtimeHeartbeatState}
            runtimeServiceStatus={runtimeServiceStatus}
            visibleAgentLabels={visibleAgentLabels}
            onApprovePlan={state.approveActiveCoordinationPlan}
            onCancelOrchestration={state.cancelActiveCoordination}
            onOpenRuntimeSession={state.selectThread}
            onRequestFollowup={state.requestCoordinationFollowup}
            onResolveApproval={state.resolveApproval}
            onResumeOrchestration={state.resumeActiveCoordination}
            onVerifyReview={state.verifyActiveCoordinationReview}
          />
        )}

        <TasksThreadComposer
          pathwayMode={props.pathwayMode}
          attachedFiles={state.attachedFiles}
          autoSelectedComposerRoleIds={autoSelectedComposerRoleIds}
          autoSelectedProviderModel={autoSelectedProviderModel}
          canUseStopButton={props.pathwayMode ? pathwayIntakePending : state.canInterruptCurrentThread}
          canInterruptCurrentThread={state.canInterruptCurrentThread}
          creativeModeEnabled={state.composerCreativeMode}
          composerCoordinationModeOverride={state.composerCoordinationModeOverride}
          composerDraft={props.pathwayMode ? pathwayIntakeDraft : state.composerDraft}
          composerProviderOverrides={state.composerProviderOverrides}
          composerRef={composerRef}
          providerStatusPending={providerStatusPending}
          providerStatuses={providerStatuses}
          isModelMenuOpen={isModelMenuOpen}
          isReasonMenuOpen={isReasonMenuOpen}
          mentionIndex={mentionIndex}
          mentionMatch={mentionMatch}
          modelMenuRef={modelMenuRef}
          reasonMenuRef={reasonMenuRef}
          reasoning={state.reasoning}
          reasoningLabel={displayReasoningLabel(state.reasoning)}
          selectedComposerRoleIds={state.selectedComposerRoleIds}
          selectedModelOption={selectedModelOption}
          showStopButton={props.pathwayMode ? pathwayIntakePending : showStopButton}
          stoppingComposerRun={state.stoppingComposerRun}
          onComposerCursorChange={setComposerCursor}
          onComposerDraftChange={(value, cursor) => {
            setComposerCursor(cursor);
            setIsMentionMenuHidden(false);
            if (props.pathwayMode) {
              setPathwayIntakeDraft(value);
              return;
            }
            state.setComposerDraft(value);
          }}
          onComposerKeyDown={props.pathwayMode ? onPathwayIntakeKeyDown : onComposerKeyDown}
          onClearCoordinationModeOverride={() => state.setComposerCoordinationModeOverride(null)}
          onClearComposerProviderOverrides={state.clearComposerProviderOverrides}
          onOpenAttachmentPicker={() => void state.openAttachmentPicker()}
          onOpenProviderSession={(provider) => void openProviderSession(provider as any)}
          onRefreshProviderStatuses={() => void refreshProviderStatuses()}
          onRemoveAttachedFile={state.removeAttachedFile}
          onRemoveComposerProvider={state.removeComposerProviderOverride}
          onRemoveComposerRole={state.removeComposerRole}
          onSelectMention={selectMention}
          onSetModel={(value) => {
            state.setModel(value);
            setIsModelMenuOpen(false);
          }}
          onSetReasoning={(value) => {
            state.setReasoning(value);
            setIsReasonMenuOpen(false);
          }}
          onStop={() => {
            if (props.pathwayMode) {
              void cancelPathwayRun();
              return;
            }
            void state.stopComposerRun();
          }}
          onSubmit={() => {
            if (props.pathwayMode) {
              void submitPathwayIntake();
              return;
            }
            void state.submitComposer();
          }}
          onToggleCreativeMode={() => state.setComposerCreativeMode((current) => !current)}
          onToggleModelMenu={() => setIsModelMenuOpen((prev) => !prev)}
          onToggleReasonMenu={() => setIsReasonMenuOpen((prev) => !prev)}
        />
      </section>

      {pendingDeleteThreadId ? (
        <div aria-hidden="true" className="modal-backdrop">
          <section aria-label="스레드 삭제 확인" className="approval-modal tasks-thread-confirm-modal" data-e2e="tasks-delete-thread-modal" role="dialog">
            <h2>{t("tasks.modal.threadDelete.title")}</h2>
            <p>{t("tasks.modal.threadDelete.body")}</p>
            <div className="tasks-thread-approval-actions">
              <button aria-label="스레드 삭제 취소" data-e2e="tasks-delete-thread-cancel" onClick={() => setPendingDeleteThreadId("")} type="button">{t("tasks.modal.cancel")}</button>
              <button
                aria-label="스레드 삭제 확인"
                className="tasks-thread-primary"
                data-e2e="tasks-delete-thread-confirm"
                onClick={() => {
                  void state.deleteThread(pendingDeleteThreadId);
                  setPendingDeleteThreadId("");
                }}
                type="button"
              >
                {t("tasks.modal.confirmDelete")}
              </button>
            </div>
          </section>
        </div>
      ) : null}

      {pendingDeleteProjectPath ? (
        <div aria-hidden="true" className="modal-backdrop">
          <section aria-label="프로젝트 숨기기 확인" className="approval-modal tasks-thread-confirm-modal" data-e2e="tasks-hide-project-modal" role="dialog">
            <h2>{t("tasks.modal.projectHide.title")}</h2>
            <p>{t("tasks.modal.projectHide.body")}</p>
            <div className="tasks-thread-approval-actions">
              <button aria-label="프로젝트 숨기기 취소" data-e2e="tasks-hide-project-cancel" onClick={() => setPendingDeleteProjectPath("")} type="button">{t("tasks.modal.cancel")}</button>
              <button
                aria-label="프로젝트 숨기기 확인"
                className="tasks-thread-primary"
                data-e2e="tasks-hide-project-confirm"
                onClick={() => {
                  state.removeProject(pendingDeleteProjectPath);
                  setPendingDeleteProjectPath("");
                }}
                type="button"
              >
                {t("tasks.modal.confirmHide")}
              </button>
            </div>
          </section>
        </div>
      ) : null}

      {state.activeThread && isReviewPaneOpen ? (
        <TasksThreadReviewPane
          activeThread={state.activeThread}
          selectedFileDiff={state.selectedFileDiff}
          selectedFilePath={state.selectedFilePath}
          onSelectFilePath={state.setSelectedFilePath}
        />
      ) : null}
    </section>
  );
}
