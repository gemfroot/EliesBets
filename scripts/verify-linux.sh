#!/usr/bin/env bash
# Run on Linux to validate build + lint (e.g. Claude: cd /home/dev/EliesBets && ./scripts/verify-linux.sh).
# Usage: chmod +x scripts/verify-linux.sh && ./scripts/verify-linux.sh
#        SKIP_CI=1 ./scripts/verify-linux.sh   # skip npm ci when node_modules is fresh
set -euo pipefail
cd "$(dirname "$0")/.."
echo "==> $(pwd)"
echo "==> node $(node -v) npm $(npm -v)"
if [[ "${SKIP_CI:-}" != "1" ]]; then
  npm ci
else
  echo "==> SKIP_CI=1 — skipping npm ci"
fi
echo "==> npm run build"
npm run build
echo "==> npm run lint"
npm run lint
echo "==> OK"
