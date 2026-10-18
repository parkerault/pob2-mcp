# Stage references

One file per step, `<stage>.md`, named by the task header's `stage` (`task-header.md`): `R1a.md`,
`R1a-assemble.md`, `R1b.md`, `R1b-assemble.md`, `D1-build.md`, `D1-finish.md` (D1's two steps, D-356),
`D1-gate.md`, `D2.md`, `D2-gate.md`, `W1.md`, `V4.md`, and `Q.md` (a gate question, D-390). The runner starts
every step with the Agent tool, its prompt the header and a line naming this file, so the step reads its job
here.

A stage reference says, for its step:

- **Inputs**: what it reads (paths relative to `runFolder`), which header fields it uses, and what the
  prompt adds.
- **Work**: what it does, and the tools it may call, each by its full name (`mcp__pob2__lookup_game_data`):
  lookups (`../lookups.md`), compiles as the header's `compile` allows, prices (`../pricing.md`, coordinator
  steps only).
- **Writes**: exactly the header's `writes`, inside the run folder. A gate step writes its own verdict file
  (`../gates.md`).
- **Returns**: at most 8 lines, the files written and the outcome; the runner routes on them and on the
  verdict files. The verifier too: it writes its own report, `reports/V4-<n>.md` (`../source-markers.md`),
  which the runner reads.
- **Fault directives** it applies in offline test mode (`../offline-and-test.md`).

The agent definitions in `.claude/agents/build-guide/` hold each type's standing rules and tool
allowlist; a stage reference holds only what is specific to its step. A stage reference states the rules its
step needs, as excerpts, rather than sending the agent to read a whole shared file or a bare D-number (D-356):
it names a section to read only where the step needs all of it.
