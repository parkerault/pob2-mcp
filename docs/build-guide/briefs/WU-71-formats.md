# WU-71: the formats the checker and scripts must match

Written by the coordinator on 2026-10-12 from the M-15 units' reports and reviews (WU-65, WU-69, WU-70). The
spec is binding: `docs/build-guide/spec/03-pipeline.md`, "### WU-71", AC-W54, AC-W55, and the checker clauses of
AC-W59 and AC-W60. This file lists what the merged skill text now says, so the checker agrees with it. If this file
and the skill text disagree, the skill text wins: report the difference.

## Coordinator rulings, not yet in the spec (binding)

- **D-363:** `clearSpeed` reads the main selection's stat set when the clear skill is the main skill, else stat set 1.
- **D-364:** a tree is a connected group of allocated nodes, the start not counted. A start holds at most one tree.
- **D-365:** V4 compares guide figures only with the record's measured values. The checker's `[ledger]` owns the
  ledger: it evaluates the plan's **current** formulas (not the record's ledger values, which are stale after a
  ledger-only fix), and covers the guide's figures that cite a ledger entry.
- **D-366:** D2 may write about 10 `reason` claims naming each campaign stage's tree path, plus one per reward pick.
  They count toward AC-W58's cap of 56 claims.

## Scripts (`.claude/skills/build-guide/scripts/`)

- **The round copy (A-34):** `node .claude/skills/build-guide/scripts/check-run.mjs <runFolder> --snapshot <n>`.
  - It copies `plan.json`, `compile-record.json` and `guide.md` into `rounds/<n>/`.
  - `<n>` is the number of the V4 report the round answers.
  - It is already on `SKILL.md`'s Bash list.
- **`--changed <n>`:** prints the items changed since `rounds/<n>/`, one per line on stdout, exactly in one of these
  forms, and nothing else:
  - `claim stages[<i>].claims[<k>] (<id>)`, for a claim whose text, source or cited record values changed;
  - `section <H2 title>`, for a changed guide H2.

  The runner copies these lines verbatim into the re-check's task-header `changed`. The report's `## Checked`
  repeats them verbatim. A re-check numbered `<n>` uses `--changed <n-1>`.
- **`render-audit.mjs <runFolder>`** (new; D-355). It renders `audit.md` in the exact form of
  `templates/audit-template.md`:
  - **Six H2s, in order:** `Estimates`, `Stage detail`, `Checks` (one H3 per rung, titled with its loadout name),
    `What PoB doesn't model`, `Inputs by confidence`, `Known issues`.
  - **No Run notes.** The render writes `None.` under `Known issues`.
  - **Re-renders:** run after the D2 gate's final compile and before W1, and again after any recompile in a fix round
    or revision. A re-render keeps the rows W1 added under `Known issues` (the accepted gate findings).
  - **Each Checks block holds:**
    - the chaos-exception line (D-234);
    - the budget lines, with "near the ceiling" (5 → 5.5, 20 → 22) and the "Prices are unavailable" wording;
    - the Arbiter line on `b` and `n`;
    - "Clear speed: …, a rough estimate … Movement speed: …".

    The template doesn't name the record field movement speed comes from: choose it, and report your choice.
  - **Budget totals and rates** come from the D1 gate verdict's `basis.budget`. That basis may include
    `{stage: "b", slot: "Anoint", priceId: "b-anoint"}`; D1-gate.md:121-123 and :146 don't define the form further.
    Choose the smallest form, and report it.
  - **The coverage flags' source** is undecided: choose it from the record, and report it.
- **`run-log.mjs`** (new; D-356): appends the run log, so the runner stops writing `run-log.json` with Write. Wire it
  into `SKILL.md`'s Bash list and the run-log card.
- **`SKILL.md`** is capped at 221 lines by a static test. Its new render and log steps replace text; they don't add
  to it.

## The run log (`references/run-log.md`)

- **Stage names:**
  - `D1-build` (`done`, `infeasible` or `missing`) and `D1-finish` (`done`, `claims-edited` or `missing`, with
    `priceOutcomes`) replace `D1`;
  - `V4` and `V4-recheck` replace `V4-<lens>`.
- **The `design` checkpoint** (D-362). Its answers are `accept`, `revise:<text>`, `verification` or `stop`. The
  default is `stop`, with the rule `no design answer left: stop`.
  - A `revise:` asking for a build change logs D1-build, D1-finish, D1-gate, design.
  - Any other `revise:` logs D1-finish, D1-gate, design. If that D1-finish returns `build:`, it logs D1-build, then
    D1-finish.
  - A D1-finish after D1-build, its header carrying `changed`, is logged `done`.
- **A fix round** logs D1-finish (then D1-build and D1-finish when it returns `build:`), D1-gate, D2-gate and W1,
  with no design visit. The rule that D2 needs a `design` visit applies to the design phase only. D2 or the D2 gate
  after a fix round's or a revision's D1 gate passes without one.
- **A revision cycle** starts with the round copy and a V4 re-check, not a full pass.

## The D1 gate's verdict file

When the compile ran, it holds `design: {rungs: [{stage, dps, ehp, arbiter, clearSpeed, anoint, gear, gems, tree}],
estimates: []}`. The runner prints the design gate's display from it (A-35).

## V4's reports (`references/stages/V4.md`)

- **The path** is `reports/V4-<n>.md`, never overwritten. An `exists:` return re-runs at the next free `<n>`.
- **The H1** is `# V4-<n>: full pass` or `# V4-<n>: re-check of rounds/<n-1>`.
- **Then four lines:** `- check:`, `- concept:`, `- mode:`, `- verdict:`.
- **Then the sections:** `## Checked`, then `## Findings`, holding `### <id>` blocks or `None.`.
- **Each finding's fields, in order:** status, hinge, owner, artifact, location, claim, issue, evidence, reader.
- **Ids** match `v4-\d+-\d+`. The audit row's second column is `V4`.
- **Artifacts** are `plan.json` and `guide.md`.
- **The open findings** are the `unresolved` findings of the highest-numbered report.

## The guide and the dossier

- **The survival label** on `b` and `n`, in place of solid/watch/risky:
  - "survives the Arbiter's hits";
  - "one-shot by the Arbiter's <type> hit", where `<type>` is `measures.arbiter.worst.type` and a mixed hit's types
    are joined by " and ";
  - a null verdict reads "not measured against the Arbiter".

  `m` keeps solid/watch/risky.
- **The verdict line's figures:** the hits come from `configWritten`'s `enemy<Type>Damage`, DPS is `measures.dps`,
  and EHP is `measures.ehp`.
- **The anoint line** on `b` and `n`: `**Anoint:** <notable>, from <three Distilled Emotions> (<price>): <reason>`.
  `m` gets one "If you can afford it before maps…" line naming `b`'s notable.
- **The dossier** has:
  - one H1, then a `Brief:` line;
  - then one table with the ten columns `Card | Round | Status | Synergy | Named source DPS | Life | EHP |
    Key prices | League | Main risk`, rows starting `| <id> |`;
  - no H2, H3 or markers.

  A failed or not-yet-finalizable card has `—` in its number, price and league cells. The `dossier-sections` check
  moves to this form.

## What `check-run.mjs` still expects, and must change

- **`:103`:** the finding-id pattern `v4-(ledger|sources|prose)-\d+` becomes `v4-\d+-\d+`.
- **`:1387`:** the audit table's lens column becomes `V4`.
- **`:795-797`:** `reports/V4-<n>.md` is rejected as a layout error.
- **`:1143-1153`:** the comment and failure text describe the old projection. WU-65's `buildHash.ts` now leaves out
  the ledger too.
- **`:1308`:** the reference hits come from ledger `hit_<stage>_<type>` entries. They now come from the record's
  compiler-written hits in `configWritten` (D-353).
- **Stage names:** the checker expects `D1` and `V4-<lens>`.
- **Three static cross-checks** in `tests/static/buildGuidePipeline.test.ts` were dropped by WU-70 and should be
  restored against the new forms: `DOSSIER_H2`, `AUDIT_H2`, and the Arbiter label in `VERDICT_FORM`.
- **`references/run-folder.md`'s "What the run checker checks"** still says "a revision's full pass".

## Not WU-71's

- **Spec text:** AC-W2 (t) and FI-4's `[ledger]` description are spec text. The coordinator updates them at the
  fold.
- **Prices in `buildSha1`:** `buildSha1` includes `prices`, so a price fix recompiles. That is left as built (N8).
