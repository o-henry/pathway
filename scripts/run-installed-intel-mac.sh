#!/usr/bin/env bash
set -euo pipefail

APP_PATH="${PATHWAY_APP_PATH:-$HOME/Applications/PATHWAY.app}"

if [[ ! -d "$APP_PATH" ]]; then
  echo "PATHWAY app not found at: $APP_PATH" >&2
  echo "Install it first:" >&2
  echo "  pnpm install:intel-mac" >&2
  exit 1
fi

open "$APP_PATH"
