# Stage references

One file per step, `<stage>.md`, named by the task header's `stage` (`task-header.md`): `R1a.md`,
`R1b.md`, `R1b-assemble.md`, `dossier-fix.md`, `D1.md`, `D1-gate.md`, `D2.md`, `D2-gate.md`, `W1.md`,
`V3.md`, `V4.md` and `revise-map.md`. Every agent's header names its file in `reference`, and both
orchestrations (the workflows and the Agent-tool fallback) send the same file, so the step behaves the
same either way.

A stage reference says, for its step:

- **Inputs**: what it reads (paths relative to `runFolder`) and which header fields it uses.
- **Work**: what it does, and the tools it may call: lookups (`../lookups.md`), compiles as the
  header's `compile` allows, prices (`../pricing.md`, coordinator steps only).
- **Writes**: exactly the header's `writes`, inside the run folder.
- **Returns**: the JSON it ends with, which its workflow validates with a schema: a gate verdict
  (`../gates.md`), a V3/V4 report (`../source-markers.md`), or the step's own result, always with
  `priceCalls` for a step that priced (`../pricing.md`).
- **Fault directives** it applies in offline test mode (`../offline-and-test.md`).

The agent definitions in `.claude/agents/build-guide/` hold each type's standing rules and tool
allowlist; a stage reference holds only what is specific to its step.
