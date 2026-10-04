#!/usr/bin/env bash
# Fetch the pinned PathOfBuilding-PoE2 checkout (pob-pin.json, C-6) into vendor/.
# Sparse + blob-less + depth-1 clone of the pinned tag (spike S-2): ~5 MiB download, ~50 MB on disk.
# Idempotent: when vendor/ is already a complete, unmodified checkout of the pinned commit it exits
# before any git network command. HEAD alone is not enough: a `--no-checkout` clone has HEAD at the
# pin before a single file is written, and a locally edited file leaves HEAD unchanged. Any other
# state (absent, interrupted, partial, edited, wrong commit) is replaced by a fresh clone.
set -euo pipefail
cd "$(dirname "$0")/.."
pin() { node -p "require('./pob-pin.json').$1"; }
URL=$(pin repo); TAG=$(pin tag); COMMIT=$(pin commit); DEST=vendor/PathOfBuilding-PoE2

# Local-only checks (no git command here contacts the remote): $DEST is its own repository (not the
# enclosing worktree), HEAD is the pin, the entry point exists, and no tracked file differs from the
# index or the index from HEAD. Untracked files are ignored: they never affect checkPin's hashes.
pinned_and_clean() {
  [ -e "$DEST/.git" ] && [ -f "$DEST/src/HeadlessWrapper.lua" ] || return 1
  [ "$(git -C "$DEST" rev-parse HEAD 2>/dev/null)" = "$COMMIT" ] || return 1
  local st
  st=$(git -C "$DEST" status --porcelain --untracked-files=no --no-renames 2>/dev/null) || return 1
  [ -z "$st" ]
}
if pinned_and_clean; then exit 0; fi

# Clone into a staging dir and move it into place only once it is complete and verified, so an
# interrupted fetch never leaves a half-populated $DEST behind.
mkdir -p vendor
STAGE=$(mktemp -d vendor/.fetch-pob.XXXXXX)
trap 'rm -rf "$STAGE"' EXIT
GIT_TERMINAL_PROMPT=0 git -c advice.detachedHead=false clone --quiet --filter=blob:none --no-checkout --depth 1 --branch "$TAG" "$URL" "$STAGE/pob"
git -C "$STAGE/pob" sparse-checkout set --no-cone /manifest.xml /runtime/lua/ /src/ '!/src/Export/' '!*.png' '!*.zst' '!*.jpg'
GIT_TERMINAL_PROMPT=0 git -c advice.detachedHead=false -C "$STAGE/pob" checkout --quiet "$COMMIT"   # fails loudly if the tag was moved
test "$(git -C "$STAGE/pob" rev-parse HEAD)" = "$COMMIT"
test -f "$STAGE/pob/src/HeadlessWrapper.lua"
rm -rf "$DEST"
mv "$STAGE/pob" "$DEST"
pinned_and_clean
