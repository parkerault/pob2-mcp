#!/bin/sh
# The pob2 compaction rule (D-420), for a SessionStart hook with the "compact" matcher: what this
# prints joins the session's context after a compaction, which keeps at most 5,000 tokens of an invoked
# skill and none of its references. The plugin's hooks/hooks.json wires the hook, and
# skills/build-guide/SKILL.md carries the same numbered lines in its first 40 lines. The hook runs in every
# session that has it, so the rule is worded for any pob2 run with a run-log.json in progress, a
# /pob2:build-guide run or a piece's (/pob2:compile, /pob2:pricing, /pob2:writer; D-516), whose runner
# re-reads that command's SKILL.md.
#
# The text keeps ${CLAUDE_PLUGIN_ROOT} as SKILL.md writes it, so its numbered lines equal SKILL.md's; the
# copy printed names the plugin root itself (D-501): CLAUDE_PLUGIN_ROOT's value, which a plugin's hook gets
# in its environment, or, when that is unset, the folder above this script's own.
root=${CLAUDE_PLUGIN_ROOT:-$(cd -P "$(dirname "$0")/.." && pwd -P)}
POB2_PLUGIN_ROOT=${root%/} awk 'BEGIN { root = ENVIRON["POB2_PLUGIN_ROOT"]; token = "${CLAUDE_PLUGIN_ROOT}" }
{
  out = ""
  while ((i = index($0, token)) > 0) {
    out = out substr($0, 1, i - 1) root
    $0 = substr($0, i + length(token))
  }
  print out $0
}' <<'EOF'
If a pob2 run with a `run-log.json` is in progress (/pob2:build-guide, /pob2:compile, /pob2:pricing or /pob2:writer), this session was just compacted, which kept at most part of the command's skill and none of its references. Before your next step or answer:
1. Re-read `${CLAUDE_PLUGIN_ROOT}/skills/build-guide/SKILL.md` and `${CLAUDE_PLUGIN_ROOT}/skills/build-guide/references/runner-rules.md` whole, the run's `run-log.json`, the current step's reference and, at a gate, the visit's notes (`interviews/<gate>-<visit>.md`, with its `## Pending decision`); in a /pob2:compile, /pob2:pricing or /pob2:writer run, that command's `${CLAUDE_PLUGIN_ROOT}/skills/<piece>/SKILL.md` in place of build-guide's.
2. At a gate, print its display again with `pob2-run-log <runFolder> display <gate> [--build <id>]` (the design and final gates take `--build <id>`, the build at the gate), which records no second visit.
3. Act on no yes the notes don't hold: a yes you remember that the notes don't record isn't one, so restate the pending decision and wait for it.
If no pob2 run is in progress, ignore this.
EOF
