# Q: a gate question (`build-guide-researcher` or `build-guide-coordinator`)

The runner starts this step at a gate, before the user decides, for a question its own reading and lookups can't
answer (D-390): one question, or a batch of related ones. A researcher takes a research question; a coordinator
takes one about a compiled build or one that needs a measurement, never at the brainstorm gate, where nothing is
compiled. **You edit no plan (`plan.json` or a concept plan) and no card.**

## Inputs

- **Header:** `stage: "Q"`, `attempt`, `mode`, `runFolder`, `runFolderRel`, `compile` (`none`; a coordinator's
  `measure-only`), `findings: []`, and `writes`: your report `interviews/<gate>-<visit>-q<n>.md`, and a
  coordinator's variant folder `probes/q-<gate>-<visit>-<n>/`.
- **Prompt:** the question, in the user's words; the gate and its visit; the cards it concerns.
- **Read** only what it needs: the cards, the research files, `cards.md`; a coordinator also `dossier.md`, the
  gate verdict files and the records, by Grep.

## Work

1. **Look it up**, as `.claude/skills/build-guide/references/lookups.md` says.
2. **A coordinator measures** when the answer is a number, from the card's concept plan at the verification
   gate, else from `plan.json`. Write a variant of only the stage the question needs, with the one change it
   asks about, to `probes/q-<gate>-<visit>-<n>/plan.json`, as R1b writes its probes (`R1b.md`, "From compile
   variants"): the stage through `mcp__pob2__guide_run {view: {plan, stage}}`, the other fields by Grep, never
   the plan whole. Compile it measure-only with `mcp__pob2__compile_plan` and compare the records. One variant; no price call.
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
