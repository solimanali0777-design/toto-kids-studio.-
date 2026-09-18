#!/usr/bin/env bash
set -euo pipefail

echo "[render] compiling AppDeploy compatibility API"
npm install --no-save typescript@5.7.3 @types/node@22
rm -rf .render-build web-dist
mkdir -p .render-build
./node_modules/.bin/tsc backend/appdeployCompatApi.mts \
  --target ES2022 \
  --module NodeNext \
  --moduleResolution NodeNext \
  --lib ES2022,DOM \
  --types node \
  --skipLibCheck \
  --outDir .render-build \
  --rootDir backend
cp .render-build/appdeployCompatApi.mjs backend/appdeployCompatApi.mjs

echo "[render] building standalone web UI"
cd web
npm install
npm run build
cd ..
cp -R web/dist web-dist

echo "[render] build complete"
