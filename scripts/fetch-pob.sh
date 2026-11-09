#!/usr/bin/env bash
# Fetch the pinned PathOfBuilding-PoE2 checkout (pob-pin.json, C-6) into vendor/.
# Sparse + blob-less + depth-1 clone of the pinned tag (spike S-2): ~5 MiB download, ~50 MB on disk.
#
#   bash scripts/fetch-pob.sh                         the pin into vendor/PathOfBuilding-PoE2
#   bash scripts/fetch-pob.sh <tag> <commit> <dest>   another tag of the pin's repository into <dest>
#
# No arguments: idempotent. When vendor/ is already a complete, unmodified checkout of the pinned commit it exits
# before any git network command. HEAD alone is not enough: a `--no-checkout` clone has HEAD at the pin before a
# single file is written, and a locally edited file leaves HEAD unchanged. Any other state (absent, interrupted,
# partial, edited, wrong commit) is replaced by a fresh clone.
#
# The tag-and-destination mode is the pin upgrade's staging tree (scripts/pin-upgrade.mjs, amendment 16 §4 step 1,
# D-508): the same sparse clone of <tag> from pob-pin.json's `repo`, which must point at <commit> (the tag's commit as
# `git ls-remote` gave it, so a tag moved in between fails loudly), into <dest>, which must not exist yet. It never
# touches vendor/PathOfBuilding-PoE2 or pob-pin.json. A relative <dest> is relative to the repository root.
set -euo pipefail
cd "$(dirname "$0")/.."
pin() { node -p "require('./pob-pin.json').$1"; }
URL=$(pin repo)

# clone_tag <tag> <commit> <dir>: the sparse clone of <tag> into <dir> (absent), checked out at <commit>. With
# TAG_IS_COMMIT=1 the tag itself must point at <commit>: a partial clone fetches any other commit on demand, so the
# checkout alone would succeed on a commit that isn't the tag's.
clone_tag() {
  GIT_TERMINAL_PROMPT=0 git -c advice.detachedHead=false clone --quiet --filter=blob:none --no-checkout --depth 1 --branch "$1" "$URL" "$3"
  if [ "${TAG_IS_COMMIT:-0}" = 1 ] && [ "$(git -C "$3" rev-parse HEAD)" != "$2" ]; then
    echo "fetch-pob: $1 is at $(git -C "$3" rev-parse HEAD), not $2" >&2
    return 1
  fi
  git -C "$3" sparse-checkout set --no-cone /manifest.xml /runtime/lua/ /src/ '!/src/Export/' '!*.png' '!*.zst' '!*.jpg'
  GIT_TERMINAL_PROMPT=0 git -c advice.detachedHead=false -C "$3" checkout --quiet "$2"   # fails loudly if the tag was moved
  test "$(git -C "$3" rev-parse HEAD)" = "$2"
  test -f "$3/src/HeadlessWrapper.lua"
}

if [ $# -eq 3 ]; then
  DEST=$3
  if [ -e "$DEST" ]; then
    echo "fetch-pob: $DEST already exists; give a folder that doesn't" >&2
    exit 2
  fi
  PARENT=$(dirname "$DEST")
  mkdir -p "$PARENT"
  STAGE=$(mktemp -d "$PARENT/.fetch-pob.XXXXXX")
  trap 'rm -rf "$STAGE"' EXIT
  TAG_IS_COMMIT=1 clone_tag "$1" "$2" "$STAGE/pob"
  mv "$STAGE/pob" "$DEST"
  exit 0
fi
if [ $# -ne 0 ]; then
  echo "usage: bash scripts/fetch-pob.sh [<tag> <commit> <dest>]" >&2
  exit 2
fi

TAG=$(pin tag); COMMIT=$(pin commit); DEST=vendor/PathOfBuilding-PoE2

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
clone_tag "$TAG" "$COMMIT" "$STAGE/pob"
rm -rf "$DEST"
mv "$STAGE/pob" "$DEST"
pinned_and_clean
