import { useMemo, useState } from "react";
import {
  completeLearningTask,
  createLearningTask,
  gradeLearningQuiz,
  type LearningTask,
  type LearningTaskDraft,
} from "./learningTasks";

type LearningTasksPageProps = {
  activeGoalId: string | null;
  activeGoalTitle: string;
  tasks: LearningTask[];
  onTasksChange: (tasks: LearningTask[]) => void;
  onPrepareGraphUpdate: (summary: string) => void;
};

const WEEKDAY_LABELS = ["일", "월", "화", "수", "목", "금", "토"];

function toDateKey(date: Date): string {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function addMonths(date: Date, months: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + months, 1);
}

function formatMonthLabel(date: Date): string {
  return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function formatDayLabel(dateKey: string): string {
  const date = new Date(`${dateKey}T00:00:00`);
  return `${date.getMonth() + 1}/${date.getDate()} ${WEEKDAY_LABELS[date.getDay()]}`;
}

function buildMonthCells(monthDate: Date): Array<{ key: string; inMonth: boolean; day: number }> {
  const start = startOfMonth(monthDate);
  const firstCell = addDays(start, -start.getDay());
  return Array.from({ length: 42 }, (_, index) => {
    const date = addDays(firstCell, index);
    return {
      key: toDateKey(date),
      inMonth: date.getMonth() === monthDate.getMonth(),
      day: date.getDate(),
    };
  });
}

function totalMinutes(tasks: LearningTask[]): number {
  return tasks.reduce((sum, task) => sum + task.minutes, 0);
}

function taskSummary(tasks: LearningTask[], goalTitle: string): string {
  const completed = tasks.filter((task) => task.completed);
  if (completed.length === 0) {
    return "";
  }
  const rows = completed
    .slice(-6)
    .map((task) => `- ${task.date}: ${task.title}${task.quizResult ? ` (quiz ${task.quizResult.score}점)` : ""}`);
  return [
    `GOAL "${goalTitle || "현재 목표"}"를 향한 개인 학습 TASK 완료 기록입니다.`,
    ...rows,
    "기존 그래프는 제거하지 말고, 개인 학습 루트와 필요한 보강 조사/연결만 추가하세요.",
  ].join("\n");
}

export default function LearningTasksPage({
  activeGoalId,
  activeGoalTitle,
  tasks,
  onTasksChange,
  onPrepareGraphUpdate,
}: LearningTasksPageProps) {
  const today = toDateKey(new Date());
  const [selectedDate, setSelectedDate] = useState(today);
  const [visibleMonth, setVisibleMonth] = useState(startOfMonth(new Date()));
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [draft, setDraft] = useState<LearningTaskDraft>({
    date: today,
    title: "",
    notes: "",
    resource: "",
    minutes: 30,
  });

  const tasksByDate = useMemo(() => {
    const map = new Map<string, LearningTask[]>();
    tasks.forEach((task) => {
      const rows = map.get(task.date) ?? [];
      rows.push(task);
      map.set(task.date, rows);
    });
    map.forEach((rows, key) => {
      map.set(key, [...rows].sort((left, right) => left.createdAt.localeCompare(right.createdAt)));
    });
    return map;
  }, [tasks]);

  const monthCells = useMemo(() => buildMonthCells(visibleMonth), [visibleMonth]);
  const selectedDateTasks = tasksByDate.get(selectedDate) ?? [];
  const completedTasks = tasks.filter((task) => task.completed);
  const selectedTask = tasks.find((task) => task.id === selectedTaskId) ?? selectedDateTasks[0] ?? tasks[0] ?? null;
  const completionRate = tasks.length > 0 ? Math.round((completedTasks.length / tasks.length) * 100) : 0;

  const updateTask = (taskId: string, updater: (task: LearningTask) => LearningTask) => {
    onTasksChange(tasks.map((task) => (task.id === taskId ? updater(task) : task)));
  };

  const addTask = () => {
    const title = draft.title.trim();
    if (!title) {
      return;
    }
    const task = createLearningTask(activeGoalId, { ...draft, date: selectedDate, title });
    onTasksChange([...tasks, task]);
    setSelectedTaskId(task.id);
    setDraft((current) => ({ ...current, title: "", notes: "", resource: "", minutes: 30 }));
  };

  const toggleComplete = (task: LearningTask) => {
    const nextCompleted = !task.completed;
    updateTask(task.id, (current) => completeLearningTask(current, nextCompleted));
    setSelectedTaskId(task.id);
  };

  const updateAnswer = (taskId: string, questionId: string, answer: string) => {
    updateTask(taskId, (task) => ({
      ...task,
      answers: { ...task.answers, [questionId]: answer },
      quizResult: null,
      updatedAt: new Date().toISOString(),
    }));
  };

  const gradeQuiz = (task: LearningTask) => {
    updateTask(task.id, (current) => ({
      ...current,
      quizResult: gradeLearningQuiz(current),
      updatedAt: new Date().toISOString(),
    }));
  };

  const removeTask = (taskId: string) => {
    onTasksChange(tasks.filter((task) => task.id !== taskId));
    if (selectedTaskId === taskId) {
      setSelectedTaskId(null);
    }
  };

  const prepareGraphUpdate = () => {
    const summary = taskSummary(tasks, activeGoalTitle);
    if (!summary) {
      return;
    }
    onPrepareGraphUpdate(summary);
  };

  return (
    <section className="pathway-learning workspace-tab-panel" aria-label="Pathway learning tasks">
      <div className="pathway-learning-head">
        <div>
          <span className="pathway-panel-kicker">Learning Tasks</span>
          <strong>GOAL까지 실제로 한 일을 날짜별로 기록</strong>
          <p className="pathway-panel-copy">
            완료된 TASK는 워크플로우 그래프에 개인 학습 루트로 붙습니다. 기존 그래프는 직접 삭제하기 전까지 보존됩니다.
          </p>
        </div>
        <div className="pathway-learning-goal">
          <span>ACTIVE GOAL</span>
          <strong>{activeGoalTitle || "아직 선택된 목표가 없습니다"}</strong>
        </div>
      </div>

      <div className="pathway-learning-grid">
        <aside className="pathway-learning-calendar panel-card" aria-label="TASK calendar">
          <div className="pathway-learning-calendar-head">
            <button type="button" onClick={() => setVisibleMonth((current) => addMonths(current, -1))}>‹</button>
            <strong>{formatMonthLabel(visibleMonth)}</strong>
            <button type="button" onClick={() => setVisibleMonth((current) => addMonths(current, 1))}>›</button>
          </div>
          <div className="pathway-learning-weekdays">
            {WEEKDAY_LABELS.map((label) => <span key={label}>{label}</span>)}
          </div>
          <div className="pathway-learning-month-grid">
            {monthCells.map((cell) => {
              const rows = tasksByDate.get(cell.key) ?? [];
              const done = rows.filter((task) => task.completed).length;
              return (
                <button
                  className={`${cell.key === selectedDate ? "is-selected" : ""} ${cell.inMonth ? "" : "is-muted"}`.trim()}
                  key={cell.key}
                  onClick={() => {
                    setSelectedDate(cell.key);
                    setDraft((current) => ({ ...current, date: cell.key }));
                  }}
                  type="button"
                >
                  <span>{cell.day}</span>
                  {rows.length > 0 ? (
                    <em aria-label={`${rows.length} tasks, ${done} completed`}>
                      {done}/{rows.length}
                    </em>
                  ) : null}
                </button>
              );
            })}
          </div>
          <div className="pathway-learning-stats">
            <div>
              <span>완료율</span>
              <strong>{completionRate}%</strong>
            </div>
            <div>
              <span>완료 TASK</span>
              <strong>{completedTasks.length}</strong>
            </div>
            <div>
              <span>누적 시간</span>
              <strong>{totalMinutes(completedTasks)}m</strong>
            </div>
          </div>
        </aside>

        <main className="pathway-learning-agenda panel-card" aria-label="Selected day tasks">
          <div className="pathway-learning-section-head">
            <div>
              <span className="pathway-panel-kicker">Daily input</span>
              <strong>{formatDayLabel(selectedDate)} TASK</strong>
            </div>
            <button className="mini-action-button pathway-primary-button" type="button" onClick={addTask} disabled={!draft.title.trim()}>
              등록
            </button>
          </div>
          <div className="pathway-learning-form">
            <input
              value={draft.title}
              onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))}
              placeholder="오늘 GOAL을 위해 한 TASK"
            />
            <input
              value={draft.resource}
              onChange={(event) => setDraft((current) => ({ ...current, resource: event.target.value }))}
              placeholder="참고 자료 / 강의 / 문서"
            />
            <input
              min={5}
              max={480}
              type="number"
              value={draft.minutes}
              onChange={(event) => setDraft((current) => ({ ...current, minutes: Number(event.target.value) }))}
              aria-label="minutes"
            />
            <textarea
              value={draft.notes}
              onChange={(event) => setDraft((current) => ({ ...current, notes: event.target.value }))}
              placeholder="배운 내용, 막힌 부분, GOAL과 연결되는 이유"
            />
          </div>
          <div className="pathway-learning-task-list">
            {selectedDateTasks.length === 0 ? (
              <div className="pathway-learning-empty">이 날짜에는 아직 TASK가 없습니다.</div>
            ) : selectedDateTasks.map((task) => (
              <article
                className={`pathway-learning-task ${selectedTask?.id === task.id ? "is-active" : ""} ${task.completed ? "is-complete" : ""}`.trim()}
                key={task.id}
              >
                <button className="pathway-learning-check" type="button" onClick={() => toggleComplete(task)}>
                  {task.completed ? "✓" : ""}
                </button>
                <button className="pathway-learning-task-body" type="button" onClick={() => setSelectedTaskId(task.id)}>
                  <strong>{task.title}</strong>
                  <span>{task.notes || "메모 없음"}</span>
                  <small>{task.minutes}m · {task.resource || "자료 미지정"}</small>
                </button>
                <button className="pathway-learning-delete" type="button" onClick={() => removeTask(task.id)}>
                  삭제
                </button>
              </article>
            ))}
          </div>
        </main>

        <aside className="pathway-learning-review panel-card" aria-label="Quiz review">
          <div className="pathway-learning-section-head">
            <div>
              <span className="pathway-panel-kicker">Agent quiz</span>
              <strong>이해도 확인</strong>
            </div>
            <button
              className="mini-action-button"
              type="button"
              onClick={prepareGraphUpdate}
              disabled={completedTasks.length === 0}
            >
              그래프 반영 준비
            </button>
          </div>
          {!selectedTask ? (
            <div className="pathway-learning-empty">TASK를 선택하면 퀴즈가 열립니다.</div>
          ) : !selectedTask.completed ? (
            <div className="pathway-learning-empty">TASK를 완료 체크하면 이해도 확인 문제가 생성됩니다.</div>
          ) : (
            <div className="pathway-learning-quiz">
              <div className="pathway-learning-quiz-target">
                <span>{selectedTask.date}</span>
                <strong>{selectedTask.title}</strong>
              </div>
              {selectedTask.quiz.map((question) => (
                <label key={question.id}>
                  <span>{question.prompt}</span>
                  <textarea
                    value={selectedTask.answers[question.id] ?? ""}
                    onChange={(event) => updateAnswer(selectedTask.id, question.id, event.target.value)}
                    placeholder="내 답변"
                  />
                </label>
              ))}
              <button className="mini-action-button pathway-primary-button" type="button" onClick={() => gradeQuiz(selectedTask)}>
                답변 확인
              </button>
              {selectedTask.quizResult ? (
                <div className="pathway-learning-result">
                  <strong>이해도 {selectedTask.quizResult.score}점</strong>
                  {selectedTask.quizResult.feedback.map((line) => <p key={line}>{line}</p>)}
                  <span>추천 보강 리소스</span>
                  {selectedTask.quizResult.resources.map((line) => <p key={line}>{line}</p>)}
                </div>
              ) : null}
            </div>
          )}
        </aside>
      </div>
    </section>
  );
}
