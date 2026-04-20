# Pathway

Pathway는 로컬 우선 방식으로 동작하는 개인용 decision graph workspace입니다.
사용자의 목표를 먼저 받고, 그 목표에 필요한 리소스 차원을 분석한 뒤,
시간/돈/거리/에너지/지속성 같은 현재 조건을 반영해 가능한 선택 경로를 그래프로 펼쳐 보여주는 구조를 목표로 합니다.

현재 저장소는 `Phase 8` 기반 위에, `Pathway` 리프레임의 첫 번째 foundation 단계가 올라간 상태입니다.
이 단계에서는 정적 `check-in` 흐름을 넘어서, `goal analysis -> current state -> state updates -> route selection -> revision preview` 흐름을 제품 표면에 추가했습니다.

## What works now

- 기본 프로필 저장
- 목표 생성 / 조회 / 수정 / 삭제
- goal analysis 생성
- current state snapshot 저장 / 조회
- 동적 ontology 기반 Pathway graph 저장
- source library 수동 저장 + 로컬 retrieval
- grounded map generation
- state update 작성
- route selection 저장
- revision preview 생성 / 수락 / 거절
- workspace history browser
- map JSON export / import
- map Markdown export
- keyboard-accessible node browser
- Playwright 기반 end-to-end 사용자 흐름 테스트

## Workspace layout

- `apps/web`: SvelteKit 기반 프론트엔드
- `apps/api`: FastAPI 기반 로컬 API
- `docs/`: phased implementation plan, architecture, security, state docs
- `assets/references/`: visual direction references
- `data/`: local runtime data directory, git ignored except `.gitkeep`

## Before changing code

1. Read `AGENTS.md`
2. Read `docs/CODEX_START_HERE.md`
3. Read `docs/PATHWAY_REFRAME.md`
4. Read `docs/DESIGN_RESEARCH_PLAYBOOK.md`
5. Read the current phase file under `docs/phases/`
6. Read `docs/state/CURRENT_STATE.md`

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

## Verification commands

Frontend unit/type:

```bash
pnpm test:web
pnpm typecheck
pnpm lint:web
```

Backend:

```bash
pnpm test:api
pnpm lint:api
```

Frontend e2e:

```bash
pnpm playwright:install
pnpm test:web:e2e
```

Security:

```bash
pnpm secret-scan
```

## Local data and backup

Pathway는 서버가 아니라 로컬 파일에 상태를 저장합니다.

- `data/local.db`
  - profiles, goals, pathways, goal analyses, current-state snapshots, state updates, route selections, revision previews
- `data/lancedb/`
  - source chunks와 retrieval index
- `data/uploads/`
  - 이후 파일 ingest 원본을 둘 위치

전체 워크스페이스를 백업하려면 아래 둘을 함께 보관하면 됩니다.

```bash
cp data/local.db /path/to/backup/local.db
cp -R data/lancedb /path/to/backup/lancedb
```

복원은 반대로 덮어쓰면 됩니다.

```bash
cp /path/to/backup/local.db data/local.db
cp -R /path/to/backup/lancedb data/lancedb
```

## Export and import

- UI의 `Export JSON`은 map snapshot 전체를 내보냅니다.
- `Export Markdown`은 현재 graph를 사람이 읽기 쉬운 문서로 변환합니다.
- `Import JSON`은 이전 snapshot을 현재 로컬 워크스페이스에 새 map으로 다시 추가합니다.

## Current implementation notes

- 기본 그래프 스키마는 고정 enum이 아니라 per-map ontology를 갖는 `GraphBundle`입니다.
- 백엔드가 graph bundle validation의 source of truth입니다.
- retrieval은 manual ingest 중심이며, 허용된 URL ingestion은 아직 preview/policy 판정 단계입니다.
- 목표 생성 직후 `goal analysis`를 만들어, 어떤 리소스 차원을 추적해야 하는지 명시적으로 남길 수 있습니다.
- `current state snapshot`은 최신 사용자 상태를 나타내고, `state updates`는 append-only 기록으로 누적됩니다.
- `route selection`과 `revision preview`를 통해, 현재 선택한 경로와 그래프 변경 후보를 분리해서 다룰 수 있습니다.
- 프론트의 graph engine chunk는 아직 큽니다. lazy loading은 적용했지만 추가 chunk split 최적화는 후속 과제입니다.
- SvelteKit production adapter는 아직 `adapter-auto` 상태입니다.
- 현재 제품은 Pathway 리프레임 foundation 상태이며, 다음 주요 과제는 그래프 중심 워크스페이스 자체를 더 강하게 밀어붙이는 UI 리디자인입니다.

## Phase status

Completed baseline:

- export/import
- markdown export
- backup/restore guidance
- e2e workflow coverage
- accessibility pass for node selection
- security checklist refresh

Latest additive foundation:

- goal analysis API + client flow
- current-state snapshot persistence
- append-only state update flow
- route selection persistence
- pathway alias endpoints
- revision preview naming at the UI edge
- selected-route / changed-node graph highlighting

후속 작업은 `docs/state/CURRENT_STATE.md`와 `docs/state/EXECPLAN_PATHWAY_VNEXT_FOUNDATION.md`를 기준으로 이어가면 됩니다.
