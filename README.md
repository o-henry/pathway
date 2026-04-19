# Pathway

Pathway는 로컬 우선 방식으로 동작하는 개인용 decision graph workspace입니다.
사용자의 목표를 먼저 받고, 그 목표에 필요한 리소스 차원을 분석한 뒤,
시간/돈/거리/에너지/지속성 같은 현재 조건을 반영해 가능한 선택 경로를 그래프로 펼쳐 보여주는 구조를 목표로 합니다.

현재 저장소는 `Phase 8`까지 구현되어 있고, 이제 `Pathway` 리프레임과 그래프 중심 워크스페이스 리디자인을 진행하는 중입니다.

## What works now

- 기본 프로필 저장
- 목표 생성 / 조회 / 수정 / 삭제
- 동적 ontology 기반 Pathway graph 저장
- source library 수동 저장 + 로컬 retrieval
- grounded map generation
- check-in 작성
- revision proposal 생성 / 수락 / 거절
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
  - profiles, goals, maps, check-ins, revision proposals
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
- 프론트의 graph engine chunk는 아직 큽니다. lazy loading은 적용했지만 추가 chunk split 최적화는 후속 과제입니다.
- SvelteKit production adapter는 아직 `adapter-auto` 상태입니다.
- 현재 제품은 Pathway 리프레임 직전 상태이며, 그래프 중심 워크스페이스와 goal-first intake는 다음 주요 리디자인 과제입니다.

## Phase status

Phase 8 completes:

- export/import
- markdown export
- backup/restore guidance
- e2e workflow coverage
- accessibility pass for node selection
- security checklist refresh

후속 작업은 `docs/state/CURRENT_STATE.md`를 기준으로 이어가면 됩니다.
