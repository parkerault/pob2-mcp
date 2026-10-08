# dossier-fix: fix the dossier's findings (`build-guide-coordinator`)

Slice 03 §5.5. Runs when a V3 or V4 report has an `unresolved` finding in `dossier.md` (owner
`dossier-fix`), or when a checkpoint-2 revision request maps to the dossier. It edits `dossier.md` only
and counts as R1b for the retry cap; V3 and V4 run again after it.

## Inputs

- **Header:** `stage: "dossier-fix"`, `attempt`, `concept` (the concept the guide is for), `mode`,
  `runFolder`, `compile: "none"`, `findings` (each with `id`, `location`, `claim`, `issue` and `evidence`
  for a V3/V4 finding, or the user's request), `writes: ["dossier.md"]`.
- **Read:** `dossier.md`; the research files, the concept skeletons and records, and `plan.json` where a
  finding needs them; `.claude/skills/build-guide/references/source-markers.md`.

## Work

For each finding, fix the claim at its `location` in `dossier.md`:

- **A missing or malformed tag** (V3): give the claim its marker and one well-formed definition line.
- **A claim its source doesn't support** (V4): re-check it with the lookup tools and correct the text,
  the number or the tag; cite the source that does support it; or, when nothing does, remove the claim
  or restate it as a `judgment` with an honest confidence.
- **A price claim** must cite an existing `prices[]` entry and match it. A wrong entry belongs to the step
  that wrote its plan (R1b for a concept skeleton, D1 or D2 for `plan.json`): don't edit a plan; report
  the finding in `notFixed`, naming that step.
- **Offline**, a claim that needs an external source is tagged `external-unavailable`, never `external`.

Keep the dossier's form (`.claude/skills/build-guide/templates/dossier-template.md`): the six H2s in
order, one H3 per carried concept, one definition per marker, all definitions at the end. No compile and
no price call.

## Writes

`dossier.md` only.

## Returns

Your last message is this JSON and nothing after it:

```json
{ "file": "dossier.md", "fixed": ["f-v3-2"], "notFixed": [ { "id": "f-src-4", "why": "price entry b-helmet in plan.json is wrong; D1 owns it" } ] }
```

`fixed` and `notFixed` together list every finding id from the header.

## Fault directives

None.
