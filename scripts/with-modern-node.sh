#!/bin/zsh
set -euo pipefail

for candidate in \
  "/Users/henry/.nvm/versions/node/v24.13.1/bin" \
  "/Users/henry/.nvm/versions/node/v22.12.0/bin" \
  "/Users/henry/.nvm/versions/node/v21.5.0/bin"
do
  if [ -x "${candidate}/node" ]; then
    export PATH="${candidate}:${PATH}"
    exec "$@"
  fi
done

echo "Pathway could not find a Node runtime new enough for Vite 7." >&2
echo "Expected one under ~/.nvm/versions/node/ (for example v24.13.1)." >&2
exit 1
