#!/usr/bin/env bash
# Build everything the app serves, then ASSERT it is really there.
#
# Nothing is built on the Databricks Apps container: app/static is produced here
# and committed, because `databricks sync` honours .gitignore and would silently
# drop an ignored build directory (that failure prints "Deployment complete!").
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

# Vite runs with emptyOutDir:false (app/static also holds hand-managed fonts and
# the vendored renderer), so it never removes a PREVIOUS hashed bundle. Clear the
# hashed assets ourselves: otherwise every build leaves another orphan that ships,
# gets served, and makes the "index.html references every asset" check below fail.
echo "[build] clearing app/static/assets (hashed build output only)…"
rm -rf app/static/assets

echo "[build] client (vite → app/static)…"
cd client
if [ ! -d node_modules/vite ]; then
  echo "[build] installing client dev deps…"
  npm install --include=dev
fi
npm run build
cd "$ROOT"

echo "[build] architecture viewer (vendored renderer + arch/isaac-supervisor.arch.json)…"
node scripts/build-arch.mjs

# Build id = git sha + epoch. Feature presence is what actually proves a deploy
# (see /api/health), but a sha makes the version legible at a glance.
SHA="$(git rev-parse --short HEAD 2>/dev/null || echo nogit)"
DIRTY=""
# --porcelain, not `git diff`: an UNTRACKED file is exactly the case that matters
# here (a built asset that was never committed does not ship, because sync honours
# .gitignore and only the working tree is uploaded).
if [ -n "$(git status --porcelain 2>/dev/null)" ]; then DIRTY="-dirty"; fi
echo "${SHA}${DIRTY}-$(date +%s)" > app/BUILD_ID
echo "[build] BUILD_ID=$(cat app/BUILD_ID)"

echo "[build] asserting the outputs exist…"
fail=0
need_file() { [ -s "$1" ] || { echo "[build] MISSING/EMPTY: $1" >&2; fail=1; }; }
need_file app/static/index.html
need_file app/static/favicon.svg
need_file app/static/fonts/DMSans-100_1000-latin.woff2
need_file app/static/fonts/DMMono-400-latin.woff2
need_file app/static/fonts/DMMono-500-latin.woff2
need_file app/static/arch/architecture-viewer.html
need_file app/server.mjs
need_file app/app.yaml
js=$(ls app/static/assets/*.js 2>/dev/null | wc -l | tr -d ' ')
css=$(ls app/static/assets/*.css 2>/dev/null | wc -l | tr -d ' ')
[ "$js" -ge 1 ] || { echo "[build] no JS bundle in app/static/assets" >&2; fail=1; }
[ "$css" -ge 1 ] || { echo "[build] no CSS bundle in app/static/assets" >&2; fail=1; }
# The index must reference the bundle that actually exists (a stale index.html
# pointing at a deleted hash serves a blank page with a 404 in the console).
for f in app/static/assets/*.js app/static/assets/*.css; do
  base="$(basename "$f")"
  grep -q "$base" app/static/index.html || { echo "[build] index.html does not reference $base" >&2; fail=1; }
done
# The viewer must carry a real diagram, not the renderer's placeholder {}.
grep -q '"nodes"' app/static/arch/architecture-viewer.html || {
  echo "[build] arch viewer has no diagram in it" >&2; fail=1; }
node --check app/server.mjs
[ "$fail" -eq 0 ] || { echo "[build] FAILED" >&2; exit 1; }

echo "[build] ok — $(find app/static -type f | wc -l | tr -d ' ') static files, $(du -sh app/static | cut -f1) total"
