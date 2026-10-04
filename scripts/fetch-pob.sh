#!/usr/bin/env bash
# Fetch the pinned PathOfBuilding-PoE2 checkout (pob-pin.json, C-6) into vendor/.
# Sparse + blob-less + depth-1 clone of the pinned tag (spike S-2): ~5 MiB download, ~50 MB on disk.
# Idempotent: when vendor/ is already at the pinned commit it exits before any git network command.
set -euo pipefail
cd "$(dirname "$0")/.."
pin() { node -p "require('./pob-pin.json').$1"; }
URL=$(pin repo); TAG=$(pin tag); COMMIT=$(pin commit); DEST=vendor/PathOfBuilding-PoE2
if [ "$(git -C "$DEST" rev-parse HEAD 2>/dev/null)" = "$COMMIT" ]; then exit 0; fi
rm -rf "$DEST"
mkdir -p vendor
GIT_TERMINAL_PROMPT=0 git -c advice.detachedHead=false clone --quiet --filter=blob:none --no-checkout --depth 1 --branch "$TAG" "$URL" "$DEST"
git -C "$DEST" sparse-checkout set --no-cone /manifest.xml /runtime/lua/ /src/ '!/src/Export/' '!*.png' '!*.zst' '!*.jpg'
GIT_TERMINAL_PROMPT=0 git -c advice.detachedHead=false -C "$DEST" checkout --quiet "$COMMIT"   # fails loudly if the tag was moved
test "$(git -C "$DEST" rev-parse HEAD)" = "$COMMIT"
