# ExecPlan: Modern Node Desktop Dev Boot

## Goal

Make `pnpm dev` launch the Pathway desktop UI with a Node runtime that satisfies `vite@7`, so local verification uses the current code instead of a stale older window.

## Context

- Root `pnpm dev` launches `tauri dev`.
- `tauri dev` runs `pnpm dev:desktop:services`, which in turn starts the desktop Vite dev server.
- The environment's default `node` is `18.16.1`, but `vite@7.3.2` requires `20.19+` or `22.12+`.
- A newer Node install exists under `~/.nvm/versions/node/v24.13.1/bin/node`.

## Non-goals

- Changing the product UI itself.
- Reworking the full frontend toolchain.
- Adding remote Node installers or environment managers.

## Files to read

- AGENTS.md
- docs/CODEX_START_HERE.md
- docs/PLANS.md
- README.md
- docs/state/CURRENT_STATE.md
- package.json
- scripts/dev-reset.mjs

## Planned changes

1. Add a small helper that prepends an available modern Node path before running frontend `pnpm` commands.
2. Route desktop/web Vite and frontend build/typecheck scripts through that helper.
3. Update README and current state notes, then re-run `pnpm dev` to verify the desktop stack starts with the fixed runtime.

## Validation

Commands to run:

```bash
zsh scripts/with-modern-node.sh node -v
pnpm dev
curl -sS http://127.0.0.1:1420/
cargo check --manifest-path src-tauri/Cargo.toml
```

Expected results:

- Helper resolves to Node 20.19+ or 22.12+.
- `pnpm dev` no longer dies with the Vite `crypto.hash` / old Node error.
- Desktop UI responds on port `1420`.

## Risks

- The helper may rely on machine-specific Node install paths.
- Some commands may still use the shell's old Node if not routed through the helper.

## Rollback

- Remove `scripts/with-modern-node.sh`.
- Restore the original `package.json` script commands.

## Completion notes

- Completed:
  - Added `scripts/with-modern-node.sh` to prefer a modern `~/.nvm` Node runtime before frontend `pnpm` commands.
  - Routed desktop/web Vite plus desktop build/typecheck scripts through the helper in `package.json`.
  - Documented the modern-Node behavior in `README.md`.
- Tests run:
  - `zsh scripts/with-modern-node.sh node -v`
  - `cargo check --manifest-path src-tauri/Cargo.toml`
  - `pnpm dev`
- Known gaps:
  - The helper currently prefers explicit local `~/.nvm` paths and is still machine-oriented rather than fully portable.
  - macOS window capture in this session kept targeting another visible Space, so runtime verification here relied on successful boot logs (`VITE v7.3.2 ready`) rather than a trustworthy in-app screenshot.
