# The run log `run-log.json`

The runner writes `run-log.json` in the run folder as soon as the folder exists, and adds to it after every
step, gate and question, so an interrupted run still leaves one (FR-W2). Only the runner writes it, and only
through `scripts/run-log.mjs` (D-356, "Writing it" below), never with Write or Edit. It records the run's control flow; the artifacts record the rest, and the run checker reads both
(`run-folder.md`). This page is **schema version 3** (D-289), the run log of the three phases and their gates;
the run checker also reads schema 2, only so runs recorded before amendment 3 still check (D-326, the last
section).

## Fields

| Field | Content |
|---|---|
| `schemaVersion` | `3` |
| `runFolder` | the absolute path `mcp__pob2__guide_run {new_run}` returned |
| `slug` | the run's slug, from the brief (`run-folder.md`, D-285) |
| `brief` | the parsed brief (below, C-51); `{}` for an empty brief, "surprise me" |
| `roll` | `null` until the verification gate finalizes a card; then that card's identity `{className, ascendancy, skill}`, `skill` its named damage source, the names exactly as the tools gave them (D-286) |
| `status` | `running`, then `completed`, `not-accepted`, `stopped` or `escalated` |
| `mode` | `offline` or `online` |
| `testConfig` | `none`, `accepted` (a `--test` file with `--offline`) or `refused` (a `--test` file without `--offline`, or one that isn't the documented shape) |
| `stages[]` | one per agent call, in run order: `{stage, concept?, attempt, outcome, priceOutcomes?, probes?, shortReason?}` |
| `checkpoints[]` | `{checkpoint, visit, answer, answeredBy, rule?, questions?, changes?, newCards?, note?}` |
| `displays[]` | `{checkpoint, visit}`, one per gate visit whose display `display <gate>` printed (D-367, "Writing it" below) |
| `escalations[]` | gate escalations only: `{stage, concept, verdict, choice, guidance?}` |
| `faults[]` | offline test mode only: `{id, target, applied, observed}`; empty otherwise |
| `outputs` | `{plan, record, dossier, guide, pobFile}`: run-folder paths and the record's PoB path; `null` until produced. No import code: the record holds it (D-260) |

### The brief

`brief` holds the fields the runner parsed from the user's free text (`SKILL.md` §1), each one only when the
text gives it, with the names exactly as the brief check's tools gave them:

| Field | Value |
|---|---|
| `ascendancy`, `skill` | text: an ascendancy, and an active skill gem or a command a summon's minion casts (the named damage source, D-379) |
| `playstyle` | a list of strings: the vocabulary's tags in the user's order (`melee`, `tanky`, …), then any free text as one more string (`["melee", "tanky", "slow and heavy"]`) |
| `budget` | `"budget"`, `"non-budget"`, or a figure in divines (a number) |
| `around` | text, as the user wrote it; a support gem by its name as the lookup gave it (`"Fork"`, D-343) |
| `like`, `notes`, `popularity` | text, as the user wrote it |

The slug comes from it: `<ascendancy>-<skill>`, `<ascendancy>-open`, `open-<skill>`, or with neither
`open-<first playstyle tag>`, else `open` (`run-folder.md`). A finalized card whose identity contradicts the
brief's `ascendancy` or `skill` can't exist: R1a-assemble deals no such card.

### Entry rules

- **`stages[]`** has one entry per Agent call, in run order: each R1a researcher is its own entry, and so is
  each of D1's two steps. `stage` is `R1a`, `R1a-assemble`, `R1b`, `R1b-assemble`, `D1-build`, `D1-finish`,
  `D1-gate`, `D2`, `D2-gate`, `W1`, `V4` (the one full pass, D-352) or `V4-recheck` (a re-check), and `Q`, a
  gate question step (D-390); each V4 entry is one report, `reports/V4-<n>.md`. `concept` is the card id
  (`r<round>-<letter>-<n>`, D-319), set for every step but R1a, R1a-assemble, R1b-assemble and Q. `attempt`
  counts the calls of that (stage, card) from 1, re-runs included, and matches the header and the verdict file name; per log name, so a
  re-check's `attempt` counts that card's re-checks from 1, apart from its full pass (D-368). `outcome`:
  - `pass` or `fail` for a gate step (R1b, D1-gate, D2-gate) and a V4 entry (`fail`: its report has an
    `unresolved` finding);
  - `done` for a step that only produces (R1a, R1a-assemble, R1b-assemble, D1-finish, …), `infeasible` for
    D1-build claiming it and for a D1 gate routed so;
  - `claims-edited` for a D1-finish or D2 of the fix round or a revision that returned `recompiled: no` with no
    gate after it: it edited claims in place and compiled nothing (D-264). A D1-finish after D1-build, and a D2
    after a recompiled D1, are `done` whatever they return: their gate follows. The run checker
    tells it from a redesign: the final record stays current, the plan may differ from the record's
    `planSha1` only in its claims, source tags and ledger (its build projection's sha1 equals the record's
    `buildSha1`, D-266, D-352), and the re-check covers what `check-run.mjs --changed <n>` lists;
  - `escalated` for the gate attempt that escalated;
  - `missing` for an agent that returned without its file.
  A gate attempt's outcome is the one its verdict file routes to (`gates.md`), and the run checker holds the
  two together. An R1b `fail` whose verdict's finding is `not-a-skill` with `compiles: 0` is final: its card's
  damage source isn't a skill and no retry can compile it, so it never re-runs (D-334). So is one whose
  finding is `wrong-ascendancy` with `compiles: 0`: the card's ascendancy doesn't own the passive-tree node
  that grants its skill, and no retry can change the card's identity (D-342). That card is `failed`, and the
  verification gate can't finalize it.
- **`probes`**, on every R1b entry: how many probe variants that attempt ran, its return's `probes <n>`
  (`stages/R1b.md`): every probe run, a probe whose compile failed included, since each leaves its folder
  `probes/<card-id>/<n>/`. `0` when none (a failed attempt runs none: the checklist runs only after the last
  compile succeeded). A card's entries add up to the folders under `probes/<card-id>/`, and to at most 4, D-292's
  cap (D-338).
- **`shortReason`**, on an R1a-assemble entry only: the reason its return gave for a short round, its line
  `short: <why>` without the `short: ` (D-339). A round is short when it deals fewer than 6 cards, or the deck
  (every round's dealt cards so far) holds fewer than two under-played cards; the run checker counts both from
  `cards.md` and accepts a short round only with its reason.
- **`priceOutcomes`**, on a pricing step (R1b, D1-finish, D1-gate, D2) that made price calls: its calls counted by
  outcome, `{"ok": 12, "would_wait": 1}`, each key `ok`, `error` or a `[trade:<kind>]` kind (D-218,
  `pricing.md`). Never in an offline run. NFR-22 reads it: no `rate_limited` and no `locked_out`.
- **`checkpoints[]`**: `checkpoint` is `brainstorm`, `verification`, `design` (D-362), `final`,
  `unsaved-build` or `escalation` (`checkpoints.md`); `visit` counts that checkpoint's visits from 1; `answer` is the effective answer:
  - the brainstorm gate: `pick:<id>[,<id>…]` (1–3 cards to verify, new cards included; `pick:` alone makes
    only new cards), `more` or `stop`;
  - the verification gate: `pick:<id>` (finalize that card; its identity becomes `roll`), `verify:<id>[,<id>…]`
    (1–3 more cards from the deck, a verification round without a brainstorm; `verify:` alone, new cards
    only), `more` or `stop`;
  - the design gate: `accept` (on to D2), `revise:<text>` (D1 again, its gate and the design gate again),
    `verification` (back to the verification gate) or `stop`;
  - the final gate: `accept`, `revise:<text>`, or the note of a user who declines the guide (the run ends
    `not-accepted`);
  - the unsaved-build question: `proceed` or `stop`; an escalation: `accept`, `retry:<guidance>`, `verification`
    or `stop`.

  `answeredBy` is `user`, `pre-supplied` (the test config) or `default` (the test config had no answer left, or
  the deck refused its entry, `offline-and-test.md`). Only an accepted test config gives `pre-supplied` or `default`, and then `rule` records
  how the answer was reached: the test config's answer exactly as written (`first-viable`, `pick:r1-a-2`) for
  `pre-supplied`, or the default that applied (`no verification answer left: stop`) for `default`. A user's
  answer has no `rule`. The test config's answers are `answers.brainstorm`, `answers.verification`,
  `answers.design`, `answers.final`, `answers.escalation` and `answers.unsavedBuild` (D-323, D-362): a pre-supplied rule is one of their
  values, and `first-n:<n>` and `first-viable` resolve to the `pick:` they chose, or to `stop`. A default answer
  is `stop`. The entry that finalized the guide's card keeps its rule here; `audit.md` has no Run notes (D-355).

  A gate's or an escalation's entry always has `questions`, how many the user asked at the visit (`0` too);
  its interview notes hold as many (D-389). `changes`,
  `newCards` and `note` carry a pick's revisions, the cards made at the gate and a `more` answer's note
  (D-391, `checkpoints.md`).
- **`escalations[]`**: `stage` is `D1-gate` or `D2-gate`; `verdict` is the escalated attempt's verdict file,
  `reports/gates/<stage>-<card>-a<attempt>.json`, so the log copies no findings; `choice` is `accept`, `retry`,
  `verification` (back to the verification gate, which replaces `checkpoint-1`, D-289) or `stop` (D-236), with
  the user's `guidance` for `retry`. The escalations are in the order of the `stages[]` entries whose outcome is
  `escalated`, and the k-th one's `choice` is the answer of the k-th `escalation` checkpoint (`retry:<guidance>`
  is `retry` with that `guidance`).
- **`faults[]`**: each directive the test config gave, with its `target` as written (`{concepts, persistent}`,
  `concepts` a list of card ids or `"all"`), `applied` (how many headers carried it) and `observed` (what failed
  as a result).
- **`outputs`**: `plan`, `record`, `dossier` and `guide` are paths relative to the run folder; `pobFile` is
  the D2 gate verdict's `finalCompile.pobFile`. Don't copy the import code into the log: its one home is
  `compile-record.json`, which `record` names, and the guide holds a copy (D-260).

### Rounds, read from the gates

Only the user starts a round (D-287), so the log's gate answers say where every round begins:

- **A brainstorm round** is the run's first R1a entries, or the R1a entries after a `more` answer at either
  gate: up to 3 R1a researchers, then one R1a-assemble, then the brainstorm gate.
- **A verification round** is the R1b entries after a brainstorm `pick:<ids>` or a verification `verify:<ids>`:
  R1b for each named card, in that order, then each of its `newCards`, one at a time, then one R1b-assemble,
  then the verification gate. A card is verified once.
- **The design** follows a verification `pick:<id>`: D1-build, D1-finish and the D1 gate, then the design gate
  (D-362), and D2 only after its `accept`. A design `revise:<text>` runs D1 again (D1-build then D1-finish for a
  build change, D1-finish alone otherwise), the D1 gate and the design gate again. Every route back from the
  design (an `infeasible` D1 gate, an escalation's or the design gate's `verification`, FI-3) returns to the
  verification gate.
- **The fix round and a revision** (D-352): each starts with the round copy, `rounds/<n>/`, which the run
  checker's `--snapshot <n>` makes (`SKILL.md` step 12); no design gate is asked in them. A D1 finding runs
  D1-finish first; when it returns `build: <ids>`, D1-build runs with those findings, then D1-finish again,
  then the gates.

Each gate visit records its one answer in `checkpoints[]`, in order; `stop` ends the run `stopped`.

## Reading the requirements from the log

- **NFR-23** (the cost caps): per brainstorm round at most 3 R1a entries and one R1a-assemble, dealing 6–9
  cards; per verification round at most 3 cards compiled (a second verification round from the same deck has
  its own 3); one V4 pass, and one re-check per fix round or revision (D-352); at most 2 counted retries per
  gate (the run checker counts them from
  `stages[]`, S6 included); and at most 3 agents in flight, which the session's transcript shows.
- **D-292's probe cap**: each card's `probes`, summed over its R1b entries, at most 4.
- **NFR-22** (no 429s, no lock-outs): no `priceOutcomes` counts a `rate_limited` or `locked_out` call.

## Writing it (D-356)

One call per write, the entry as JSON on stdin (`-` in place of the JSON argument) through a quoted heredoc, so
an apostrophe in a brief's notes, a `revise:` text, a retry's guidance or a final-gate note needs no escaping;
its fields exactly as above, `<runFolder>` the absolute path `mcp__pob2__guide_run {new_run}` returned:

```
node .claude/skills/build-guide/scripts/run-log.mjs <runFolder> init - <<'JSON'
{"slug": "titan-blood-hunt", "brief": {"ascendancy": "Titan", "skill": "Blood Hunt"}, "mode": "offline", "testConfig": "accepted"}
JSON
node .claude/skills/build-guide/scripts/run-log.mjs <runFolder> stage - <<'JSON'
{"stage": "D1-finish", "concept": "r1-a-2", "attempt": 1, "outcome": "done", "priceOutcomes": {"ok": 12}}
JSON
node .claude/skills/build-guide/scripts/run-log.mjs <runFolder> display design
node .claude/skills/build-guide/scripts/run-log.mjs <runFolder> checkpoint - <<'JSON'
{"checkpoint": "design", "visit": 1, "answer": "revise:the build's helmet costs too much", "answeredBy": "user", "questions": 0}
JSON
node .claude/skills/build-guide/scripts/run-log.mjs <runFolder> escalation - <<'JSON'
{"stage": "D1-gate", "concept": "r1-a-2", "verdict": "reports/gates/D1-gate-r1-a-2-a3.json", "choice": "stop"}
JSON
node .claude/skills/build-guide/scripts/run-log.mjs <runFolder> set - <<'JSON'
{"status": "completed", "outputs": {"plan": "plan.json", "record": "compile-record.json", "dossier": "dossier.md", "guide": "guide.md", "pobFile": "<the D2 gate's pobFile>"}}
JSON
```

- `init` writes the first log (below): `runFolder` the folder given, `roll` null, the lists empty and every
  `outputs` path null, `status` `running`, or `stopped` with a refused test config. It never overwrites a log.
- `stage`, `checkpoint` and `escalation` each append one entry to `stages[]`, `checkpoints[]` or
  `escalations[]`.
- `display <gate>` (D-367; `brainstorm`, `verification`, `design`, `final` or `escalation`) prints that gate
  visit's display, built from the run folder's files (`checkpoints.md`), and records the visit in `displays[]`;
  printing it again records nothing new. A `checkpoint` entry for one of those gates is refused until its visit's
  display is recorded; the unsaved-build question has no display.
- `set` replaces `status`, `roll` (the verification gate's `pick:`), `outputs` or `faults` (`SKILL.md` §7).
- An entry with a field, stage name, outcome or answer outside this page's forms is refused, and nothing is
  written. The run checker checks the whole log and the flow it records.

## A first write

The log before any agent runs (`SKILL.md` §1, step 3), as `init` writes it: the brief as parsed and no roll yet.

```json
{
  "schemaVersion": 3,
  "runFolder": "/abs/guides/titan-blood-hunt/2026-10-08-1",
  "slug": "titan-blood-hunt",
  "brief": { "ascendancy": "Titan", "skill": "Blood Hunt" },
  "roll": null,
  "status": "running",
  "mode": "offline",
  "testConfig": "accepted",
  "stages": [],
  "checkpoints": [],
  "displays": [],
  "escalations": [],
  "faults": [],
  "outputs": { "plan": null, "record": null, "dossier": null, "guide": null, "pobFile": null }
}
```

## Schema 2: runs recorded before amendment 3

The run checker reads a `schemaVersion: 2` log only so recorded runs (WU-47's) still check (D-326). Never write
one. It differs from schema 3 in these fields: no `brief`, and its slug is `<ascendancy>-<skill>` of its roll;
`roll` is `{ascendancy, skill}`, set from the start; concept ids `c1`, `c2`, … in place of card ids, and no
R1a-assemble, `probes` or `shortReason`; D1 as one step, `D1`, in place of D1-build and D1-finish (its V4 entries
are `V4` and `V4-recheck`, each one report `reports/V4-<n>.md`, since the artifacts follow the current formats,
D-341); `checkpoint` `1` (the concept pick, answered `pick:<id>`, `more` or `stop`; its `more` answers start the
research rounds, D-235) and `2` (the guide) in place of the gates, with no design gate; and the escalation choice
`checkpoint-1` in place of `verification`. Its guide's verdict lines may end at the DPS, before D-294's Effective
HP.
