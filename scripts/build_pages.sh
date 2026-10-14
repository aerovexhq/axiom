#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

cd "${ROOT_DIR}"

echo "=== [1/2] Building Axiom Web Studio (/studio) ==="
npm --prefix ui install
npm --prefix ui run build
mkdir -p docs/public/studio
cp -r ui/dist/* docs/public/studio/

echo "=== [2/2] Building VitePress Documentation (/) ==="
npm --prefix docs install
npm --prefix docs run docs:build
touch docs/.vitepress/dist/.nojekyll

echo "Axiom documentation and web studio assembled in docs/.vitepress/dist"
