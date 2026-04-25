#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APP_NAME="PATHWAY.app"
INSTALL_DIR="${PATHWAY_INSTALL_DIR:-$HOME/Applications}"
SKIP_BROWSER_INSTALL="${PATHWAY_SKIP_PLAYWRIGHT_BROWSER_INSTALL:-1}"

cd "$ROOT_DIR"

if [[ "$(uname -s)" != "Darwin" ]]; then
  echo "This installer is for macOS." >&2
  exit 1
fi

if [[ "$(uname -m)" != "x86_64" ]]; then
  echo "This command is intended for Intel Mac (x86_64). Current arch: $(uname -m)" >&2
  echo "Set PATHWAY_ALLOW_NON_INTEL=1 to continue anyway." >&2
  if [[ "${PATHWAY_ALLOW_NON_INTEL:-0}" != "1" ]]; then
    exit 1
  fi
fi

missing=()
for command_name in pnpm uv cargo rustup; do
  if ! command -v "$command_name" >/dev/null 2>&1; then
    missing+=("$command_name")
  fi
done

if (( ${#missing[@]} > 0 )); then
  echo "Missing required commands: ${missing[*]}" >&2
  echo "Install them first. Homebrew example:" >&2
  echo "  brew install pnpm uv rustup-init" >&2
  echo "  rustup-init -y" >&2
  exit 1
fi

echo "==> Ensuring Rust Intel macOS target"
rustup target add x86_64-apple-darwin

echo "==> Installing JavaScript dependencies"
pnpm install

echo "==> Syncing Python dependencies"
UV_CACHE_DIR=.uv-cache uv sync

if [[ "$SKIP_BROWSER_INSTALL" != "1" ]]; then
  echo "==> Installing Playwright Chromium for local browser collectors"
  if ! pnpm --filter desktop exec playwright install chromium; then
    echo "Playwright browser install failed or was skipped by the environment." >&2
    echo "The app can still build, but browser-backed collectors may need:" >&2
    echo "  pnpm --filter desktop exec playwright install chromium" >&2
  fi
else
  echo "==> Skipping Playwright Chromium browser install"
  echo "    To include it, rerun with PATHWAY_SKIP_PLAYWRIGHT_BROWSER_INSTALL=0 pnpm install:intel-mac"
fi

echo "==> Building PATHWAY Intel macOS app"
pnpm build:desktop

BUILT_APP="src-tauri/target/release/bundle/macos/$APP_NAME"
if [[ ! -d "$BUILT_APP" ]]; then
  echo "Build completed, but $BUILT_APP was not found." >&2
  echo "Check src-tauri/target/release/bundle/ for the generated artifact." >&2
  exit 1
fi

mkdir -p "$INSTALL_DIR"
rm -rf "$INSTALL_DIR/$APP_NAME"
cp -R "$BUILT_APP" "$INSTALL_DIR/$APP_NAME"

RESOURCE_DIR="$INSTALL_DIR/$APP_NAME/Contents/Resources"
mkdir -p "$RESOURCE_DIR/apps/api"

echo "==> Copying repo runtime files into app resources"
rsync -a --delete \
  --exclude "__pycache__" \
  --exclude "*.pyc" \
  apps/api/lifemap_api "$RESOURCE_DIR/apps/api/"
cp pyproject.toml uv.lock "$RESOURCE_DIR/"

echo "==> Preparing bundled Python runtime environment"
(
  cd "$RESOURCE_DIR"
  UV_CACHE_DIR=.uv-cache uv sync
)

echo
echo "Installed: $INSTALL_DIR/$APP_NAME"
echo
echo "You can now launch PATHWAY directly from the Applications icon."
echo "The app will start its bundled local backend automatically."
echo "Terminal equivalent, if needed:"
echo "  open \"$INSTALL_DIR/$APP_NAME\""
echo
echo "If you only want the dev app with live collector status, use:"
echo "    pnpm dev"
