#!/bin/sh
# The build-guide compaction rule (D-420), for a SessionStart hook with the "compact" matcher: what this
# prints joins the session's context after a compaction, which keeps at most 5,000 tokens of an invoked
# skill and none of its references. The plugin's hooks/hooks.json wires the hook, and
# skills/build-guide/SKILL.md carries the same rule in its first 40 lines. The hook runs in every
# session that has it, so the rule is worded for a run in progress.
cat <<'EOF'
If a /build-guide run is in progress, this session was just compacted, which kept at most part of the skill and none of its references. Before your next step or answer:
1. Re-read `${CLAUDE_PLUGIN_ROOT}/skills/build-guide/SKILL.md` whole, the run's `run-log.json`, the current step's reference and, at a gate, the visit's notes (`interviews/<gate>-<visit>.md`, with its `## Pending decision`).
2. At a gate, print its display again with `pob2-run-log <runFolder> display <gate> [--build <id>]` (the design and final gates take `--build <id>`, the build at the gate), which records no second visit.
3. Act on no yes the notes don't hold: a yes you remember that the notes don't record isn't one, so restate the pending decision and wait for it.
If no /build-guide run is in progress, ignore this.
EOF
