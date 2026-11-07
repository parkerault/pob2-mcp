# Stage references

One file per step, `<stage>.md`, named by the task header's `stage` (`skills/build-guide/references/task-header.md`): `skills/build-guide/references/stages/R1a.md`,
`skills/build-guide/references/stages/R1a-synthesize.md` (the round's composites, D-429), `skills/build-guide/references/stages/R1a-assemble.md` (the deck, in a run whose first brainstorm
round used it), `skills/build-guide/references/stages/R1b.md`, `skills/build-guide/references/stages/R1b-assemble.md`, `skills/build-guide/references/stages/D1-build.md`, `skills/build-guide/references/stages/D1-tree.md`,
`skills/build-guide/references/stages/D1-finish.md` (D1's three steps, D-356, D-418), `skills/build-guide/references/stages/D1-gate.md`, `skills/build-guide/references/stages/F1.md` (an endgame-only build's final compile,
D-413), `skills/build-guide/references/stages/D2.md`, `skills/build-guide/references/stages/D2-gate.md` (a build's campaign, D-415), `skills/build-guide/references/stages/W1.md`, `skills/build-guide/references/stages/V4.md` (its campaign pass, stage
`V4-campaign`, too), and `skills/build-guide/references/stages/Q.md` (a gate question, D-390). The runner starts every step with the Agent tool, its
prompt the header and a line naming this file, so the step reads its job here.

A stage reference says, for its step:

- **Inputs**: what it reads (paths relative to `runFolder`; a build's files in its folder, the header's
  `buildFolder`, D-412), which header fields it uses, and what the prompt adds.
- **Work**: what it does, and the tools it may call, each by its full name (`mcp__pob2__lookup_game_data`):
  lookups (`skills/game-knowledge/references/lookups.md`), compiles as the header's `compile` allows, prices (`skills/build-guide/references/pricing.md`, coordinator
  steps only).
- **Writes**: exactly the header's `writes`, inside the run folder. A gate step writes its own verdict file
  (`skills/build-guide/references/gates.md`).
- **Returns**: at most 8 lines (R1a-synthesize's 7), the files written and the outcome; the runner routes on them and on the
  verdict files. The verifier too: it writes its own report, `<buildFolder>/reports/V4-<n>.md`
  (`skills/game-knowledge/references/source-markers.md`), which the runner reads. A step whose tool call the permission system refused stops and
  returns `refused: <tool>` (D-421, `skills/build-guide/references/gates.md`).
- **Fault directives** it applies in offline test mode (`skills/build-guide/references/offline-and-test.md`).

The agent definitions in `agents/` hold each type's standing rules and tool
allowlist; a stage reference holds only what is specific to its step. A stage reference states the rules its
step needs, as excerpts, rather than sending the agent to read a whole shared file or a bare D-number (D-356):
it names a section to read only where the step needs all of it.
