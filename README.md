# Life Map

Life Map은 로컬 우선 방식으로 동작하는 개인용 시나리오 맵 애플리케이션입니다.
사용자의 목표, 제약, 시간/돈/에너지 조건을 바탕으로 가능한 선택 경로를 시각화하고,
이후 체크인과 근거 자료를 통해 지도를 갱신하는 구조를 목표로 합니다.

현재 저장소는 `Phase 0` 기준의 실행 가능한 모노레포 뼈대를 포함합니다.

## Workspace layout

- `apps/web`: SvelteKit 기반 프론트엔드
- `apps/api`: FastAPI 기반 로컬 API
- `docs/`: phased implementation plan, architecture, and security documents
- `assets/references/`: visual direction references
- `data/`: local runtime data directory, git ignored except `.gitkeep`

## Before changing code

1. Read `AGENTS.md`
2. Read `docs/CODEX_START_HERE.md`
3. Read the current phase file under `docs/phases/`
4. Check `docs/state/CURRENT_STATE.md`

## Install

```bash
pnpm install
uv sync
```

## Run web

```bash
pnpm dev:web
```

## Run API

```bash
pnpm dev:api
```

## Run all dev services

```bash
pnpm dev
```

## Test frontend

```bash
pnpm test:web
```

Optional e2e:

```bash
pnpm test:web:e2e
```

## Test backend

```bash
pnpm test:api
```

## Lint

```bash
pnpm lint
```

## Typecheck

```bash
pnpm typecheck
```

## Secret scan

```bash
pnpm secret-scan
```

## Phase 0 status

Phase 0 sets up:

- the root workspace scripts and guardrails
- a basic SvelteKit landing page
- a FastAPI `/health` endpoint
- minimal frontend/backend smoke tests

Graph generation, RAG, crawling, and dynamic ontology logic are intentionally deferred to later phases.
