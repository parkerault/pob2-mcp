# Q: a gate question (`build-guide-researcher` or `build-guide-coordinator`)

The runner starts this step at a gate, before the user decides, for a question its own reading and lookups can't
answer (D-390): one question, or a batch of related ones. A researcher takes a research question; a coordinator
takes one about a compiled build or one that needs a measurement. **You edit no plan (`plan.json` or a concept
plan) and no card.**

## Inputs

- **Header:** `stage: "Q"`, `attempt`, `mode`, `runFolder`, `runFolderRel`, `compile` (`none`; a coordinator's
  `measure-only`), `findings: []`, and `writes`: your report `interviews/<gate>-<visit>-q<n>.md`, and a
  coordinator's variant folder `probes/q-<gate>-<visit>-<n>/`.
- **Prompt:** the question, in the user's words; the gate and its visit; the cards it concerns.
- **Read** only what it needs: the cards, the research files, `cards.md`; a coordinator also `dossier.md`, the
  gate verdict files, and the plans and records through `mcp__pob2__guide_run`'s views or by Grep, never whole.

## Work

1. **Look it up**, as `.claude/skills/build-guide/references/lookups.md` says; online, a researcher may use the
   web on its allowed hosts.
2. **A coordinator measures** when the answer is a number: copy the plan to
   `probes/q-<gate>-<visit>-<n>/plan.json`, make the one change asked about, compile it measure-only
   (`mcp__pob2__compile_plan {plan_path: "<runFolderRel>/probes/q-<gate>-<visit>-<n>/plan.json", measure_only:
   true}`), and compare the records. One variant; no price call.
3. **Say how you know**, in the cards' status words: confirmed in game text, modelled in PoB, estimate (with
   its reason), or needs in-game testing. An answer that rests on nothing you looked up says so.

## Writes

Only the header's `writes`. The report:

```
# Gate question <n>: the <gate> gate, visit <v>

- Asked: <the question>
- Agent: <build-guide-researcher | build-guide-coordinator>

## Answer

<the answer, in player terms, with its status words>

## Sources

- <one item per lookup, file or probe>
```

## Returns

At most 8 lines: the report's path, then the answer in at most 3 lines.

## Fault directives

None.
