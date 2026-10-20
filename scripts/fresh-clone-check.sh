#!/usr/bin/env bash
# Fresh-clone check (AC-G4): a clone of HEAD becomes a working server by the README's steps.
#
#   scripts/fresh-clone-check.sh
#
# 1. git clone this repository at HEAD into a temp dir;
# 2. mise trust, then mise run setup (the only network: npm registry and GitHub for the PoB pin);
# 3. start node build/index.js over stdio from a temp cwd, without POESESSID/POE_SESSION_ID, with
#    POB_DIRECTORY=<clone>/tests/fixtures/builds, XDG_STATE_HOME=<temp>, POE_LEAGUE="Forbidden Rites",
#    POE_TRADE_BASE=http://127.0.0.1:9/api/trade2 (a tripwire: any trade request fails) and
#    POE_NINJA_DISABLED=true;
# 4. through scripts/fresh-clone-check.mjs (an MCP SDK client): 85 tools are listed (D-91, C-37, C-42, C-38, C-40, C-39, C-41, C-50, C-55),
#    lua_load_build grenadator.xml reports Life 2,977, and find_upgrades {slot:"Ring 1"} starts with
#    "Trade search not run:" (D-49: no request is made, so the tripwire is never hit).
#
# Exits non-zero on any failed step. Removes the temp dir on exit. Contains no pipes.
set -euo pipefail
unset POESESSID POE_SESSION_ID

REPO=$(git -C "$(dirname "$0")/.." rev-parse --show-toplevel)
HEAD_SHA=$(git -C "$REPO" rev-parse HEAD)
WORK=$(mktemp -d "${TMPDIR:-/tmp}/pob2-mcp-fresh-clone.XXXXXX")
trap 'rm -rf "$WORK"' EXIT
CLONE="$WORK/pob2-mcp"

step() { printf '\n=== %s\n' "$*"; }

step "1. git clone $REPO at HEAD ($HEAD_SHA) into $CLONE"
git clone --quiet --no-checkout "$REPO" "$CLONE"
git -C "$CLONE" -c advice.detachedHead=false checkout --quiet --detach "$HEAD_SHA"
test "$(git -C "$CLONE" rev-parse HEAD)" = "$HEAD_SHA"
if [ -e "$CLONE/.env" ]; then
  echo "FAIL: the clone has a .env file"
  exit 1
fi

step "2. mise trust, then mise run setup"
cd "$CLONE"
mise trust
mise run setup
test -f "$CLONE/build/index.js"
test -f "$CLONE/vendor/PathOfBuilding-PoE2/src/HeadlessWrapper.lua"

step "3-4. start node build/index.js over stdio and run the MCP checks"
mkdir -p "$WORK/state" "$WORK/cwd"
cd "$WORK/cwd"
mise exec -C "$CLONE" -- node "$CLONE/scripts/fresh-clone-check.mjs" "$CLONE" "$WORK/state"

step "fresh-clone check passed ($HEAD_SHA)"
