# ExecPlan Template for Codex

Use this document when a task is bigger than a small one-file change.

## Rules

- The ExecPlan must be self-contained.
- It must describe the current state, desired state, exact changes, tests, and rollback notes.
- Keep it short enough to remain usable.
- Update it as implementation proceeds.

## Template

```markdown
# ExecPlan: <phase/task name>

## Goal

<What user-visible or developer-visible outcome this change creates.>

## Context

<Relevant files, constraints, and known limitations.>

## Non-goals

<What this phase must not implement.>

## Files to read

- AGENTS.md
- docs/...

## Planned changes

1. <change>
2. <change>
3. <change>

## Validation

Commands to run:

```bash
<pnpm command>
<uv command>
```

Expected results:

- <result>

## Risks

- <risk>

## Rollback

- <how to revert safely>

## Completion notes

- Completed:
- Tests run:
- Known gaps:
```
```
