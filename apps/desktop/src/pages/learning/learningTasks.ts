export type LearningQuizQuestion = {
  id: string;
  prompt: string;
  expected: string;
};

export type LearningQuizResult = {
  checkedAt: string;
  score: number;
  feedback: string[];
  resources: string[];
};

export type LearningTask = {
  id: string;
  goalId: string;
  date: string;
  title: string;
  notes: string;
  resource: string;
  minutes: number;
  completed: boolean;
  completedAt: string | null;
  quiz: LearningQuizQuestion[];
  answers: Record<string, string>;
  quizResult: LearningQuizResult | null;
  createdAt: string;
  updatedAt: string;
};

export type LearningTaskDraft = {
  date: string;
  title: string;
  notes: string;
  resource: string;
  minutes: number;
};

const STORAGE_PREFIX = "pathway.learningTasks.v1";

function todayKey(): string {
  const date = new Date();
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

function storageKey(goalId: string | null | undefined): string {
  return `${STORAGE_PREFIX}:${String(goalId || "demo-goal").trim() || "demo-goal"}`;
}

function makeTaskId(): string {
  return `learn_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function cleanText(value: unknown): string {
  return String(value ?? "").trim();
}

function normalizeMinutes(value: unknown): number {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return 25;
  }
  return Math.max(5, Math.min(480, Math.round(numeric)));
}

export function loadLearningTasks(goalId: string | null | undefined): LearningTask[] {
  if (typeof window === "undefined") {
    return [];
  }
  try {
    const raw = window.localStorage.getItem(storageKey(goalId));
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed
      .map((item): LearningTask | null => {
        const id = cleanText(item?.id);
        const title = cleanText(item?.title);
        if (!id || !title) {
          return null;
        }
        const quiz = Array.isArray(item?.quiz) ? item.quiz : [];
        return {
          id,
          goalId: cleanText(item?.goalId) || cleanText(goalId) || "demo-goal",
          date: cleanText(item?.date) || todayKey(),
          title,
          notes: cleanText(item?.notes),
          resource: cleanText(item?.resource),
          minutes: normalizeMinutes(item?.minutes),
          completed: Boolean(item?.completed),
          completedAt: item?.completedAt ? cleanText(item.completedAt) : null,
          quiz: quiz
            .map((question: any): LearningQuizQuestion | null => {
              const questionId = cleanText(question?.id);
              const prompt = cleanText(question?.prompt);
              if (!questionId || !prompt) {
                return null;
              }
              return {
                id: questionId,
                prompt,
                expected: cleanText(question?.expected),
              };
            })
            .filter(Boolean) as LearningQuizQuestion[],
          answers: typeof item?.answers === "object" && item.answers ? item.answers : {},
          quizResult: item?.quizResult ?? null,
          createdAt: cleanText(item?.createdAt) || new Date().toISOString(),
          updatedAt: cleanText(item?.updatedAt) || new Date().toISOString(),
        };
      })
      .filter(Boolean) as LearningTask[];
  } catch {
    return [];
  }
}

export function saveLearningTasks(goalId: string | null | undefined, tasks: LearningTask[]): void {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.setItem(storageKey(goalId), JSON.stringify(tasks));
}

function titleKeyword(task: Pick<LearningTask, "title" | "notes">): string {
  const words = `${task.title} ${task.notes}`
    .split(/[\s,.;:!?()[\]{}"']+/)
    .map((word) => word.trim())
    .filter((word) => word.length >= 2);
  return words[0] ?? task.title;
}

export function buildQuizForTask(task: Pick<LearningTask, "id" | "title" | "notes" | "resource">): LearningQuizQuestion[] {
  const keyword = titleKeyword(task);
  const resourceHint = task.resource ? ` 참고한 자료(${task.resource})와 연결해서` : "";
  return [
    {
      id: `${task.id}_q1`,
      prompt: `"${task.title}"에서 오늘 가장 핵심으로 이해한 개념을 한 문장으로 설명하세요.`,
      expected: keyword,
    },
    {
      id: `${task.id}_q2`,
      prompt: `이 TASK를 GOAL 달성 루트에 적용한다면 다음 행동은 무엇인가요?`,
      expected: "다음 행동",
    },
    {
      id: `${task.id}_q3`,
      prompt: `헷갈렸던 부분이나 아직 검증해야 할 가정을${resourceHint} 적어주세요.`,
      expected: "가정",
    },
  ];
}

export function createLearningTask(goalId: string | null | undefined, draft: LearningTaskDraft): LearningTask {
  const now = new Date().toISOString();
  const task: LearningTask = {
    id: makeTaskId(),
    goalId: cleanText(goalId) || "demo-goal",
    date: draft.date || todayKey(),
    title: cleanText(draft.title),
    notes: cleanText(draft.notes),
    resource: cleanText(draft.resource),
    minutes: normalizeMinutes(draft.minutes),
    completed: false,
    completedAt: null,
    quiz: [],
    answers: {},
    quizResult: null,
    createdAt: now,
    updatedAt: now,
  };
  return task;
}

export function completeLearningTask(task: LearningTask, completed: boolean): LearningTask {
  const now = new Date().toISOString();
  return {
    ...task,
    completed,
    completedAt: completed ? task.completedAt ?? now : null,
    quiz: completed && task.quiz.length === 0 ? buildQuizForTask(task) : task.quiz,
    quizResult: completed ? task.quizResult : null,
    updatedAt: now,
  };
}

function answerLooksGrounded(answer: string, expected: string, task: LearningTask): boolean {
  const normalizedAnswer = answer.toLowerCase();
  const expectedToken = expected.toLowerCase();
  if (answer.trim().length >= 28) {
    return true;
  }
  if (expectedToken && normalizedAnswer.includes(expectedToken)) {
    return true;
  }
  return task.title
    .toLowerCase()
    .split(/\s+/)
    .filter((word) => word.length >= 2)
    .some((word) => normalizedAnswer.includes(word));
}

export function gradeLearningQuiz(task: LearningTask): LearningQuizResult {
  const feedback: string[] = [];
  let correct = 0;
  task.quiz.forEach((question, index) => {
    const answer = cleanText(task.answers[question.id]);
    if (answerLooksGrounded(answer, question.expected, task)) {
      correct += 1;
      feedback.push(`${index + 1}. 충분히 구체적입니다.`);
    } else {
      feedback.push(`${index + 1}. 답이 짧거나 TASK 내용과의 연결이 약합니다. 예시, 다음 행동, 검증할 가정을 더 적어주세요.`);
    }
  });
  const score = task.quiz.length > 0 ? Math.round((correct / task.quiz.length) * 100) : 0;
  const resources = score >= 75
    ? [
        "오늘 답변을 그래프 노드의 근거/가정 메모로 정리하세요.",
        "같은 내용을 24시간 뒤 다시 짧게 회상해 유지되는지 확인하세요.",
      ]
    : [
        "TASK 자료를 10분 재검토하고 핵심 개념 3개를 직접 정의하세요.",
        "틀린 문항마다 실제 예시 1개와 반례 1개를 추가하세요.",
        "다음 학습 TASK를 더 작은 단위로 쪼개서 다시 등록하세요.",
      ];
  return {
    checkedAt: new Date().toISOString(),
    score,
    feedback,
    resources,
  };
}
