# The run log `run-log.json`

The runner writes `run-log.json` in the run folder as soon as the folder exists, and adds to it after every
step, gate and question, so an interrupted run still leaves one (FR-W2). Only the runner writes it, and only
through `skills/build-guide/scripts/run-log.mjs` (D-356, "Writing it" below), never with Write or Edit. It records the run's control flow; the artifacts record the rest, and the run checker reads both
(`skills/build-guide/references/run-folder.md`). This page is **schema version 4** (D-412), the run log of the three phases and their gates
with one build per finalized card (D-411); `pob2-run-log <runFolder> migrate` rewrites a schema-3 log as schema 4
(D-415), and the run checker also reads schemas 3 and 2, so runs recorded before amendments 9 and 3 still check
(D-326, the last section). A log carries the skill revision its run is held to, `skillRevision: 16` (amendment 16's
M-30, §24: piece runs, the file run, the id `file` and the scopes `better` and `ladder`, "Piece runs" below; `15`, M-29's
running leagues' `digest`, and `14`, `13`, `12` or `11` in a log written under those revisions' rules): `init` writes it,
and a resume stamps it on
an older log with one boundary per revision, so the entries after a revision's boundary are held to its rules and the
ones before it to their own. Revisions compare by order: amendment 11's rules hold from 11's boundary, amendment 12's from
12's, amendment 13's from 13's, amendment 14's from 14's, revision 15's from 15's, revision 16's from 16's, and a build is held to the rules of its
last D1 gate, a card to those of the round that dealt it ("Runs before amendment 11" to "Runs before revision 15", below;
"Amendment 14's entries" for what 14 adds).

## Fields

| Field | Content |
|---|---|
| `schemaVersion` | `4` |
| `skillRevision` | `16`: the run is held to revision 16's rules (amendment 16's M-30: piece runs, the file run, the id `file`, the scopes `better` and `ladder`, D-516), revision 15's (M-29: the running leagues' `digest`, D-507), and amendment 14's, 13's, 12's and 11's. `init` writes it; `resume` stamps it on a log below it or without it. A log written under amendment 14's rules has `14`, one under 13's `13`, one under 12's `12`, one under 11's `11` |
| `skillRevisionFrom` | only on a log a resume stamped: one boundary per revision it stamped, `{"11": {stages, checkpoints, escalations, displays}, "12": {…}, "13": {…}, "14": {…}, "15": {…}}`, each the four lists' lengths at the stamp, equal to that resume's `lengths`; the entries from a revision's boundary on are held to its rules, the ones before it to their own. A revision `init` wrote has no boundary and holds from the start. A log at `11` keeps amendment 11's flat form, `{stages, checkpoints, escalations, displays}`, read as `{"11": …}` |
| `runFolder` | the absolute path `mcp__pob2__guide_run {new_run}` returned |
| `slug` | the run's slug, from the brief (`skills/build-guide/references/run-folder.md`, D-285) |
| `brief` | the parsed brief (below, C-51); `{}` for an empty brief, "surprise me" |
| `status` | the run's: `running`, then `completed`, `not-accepted`, `stopped` or `escalated` (D-411: `completed` when any build ended `completed` or `file-only`, else the last build's end, or `stopped` when no card was finalized); a resume sets it `running` again |
| `mode` | `offline` or `online` |
| `testConfig` | `none`, `accepted` (a `--test` file with `--offline`) or `refused` (a `--test` file without `--offline`, or one that isn't the documented shape) |
| `noNinja` | `true` or `false`: whether the **current session** prices without poe.ninja's currency rates (`--no-ninja`, D-333): `init` records the first session's flag, and each `resume` replaces it with its session's (its `resumes[]` entry keeps that session's record). Every pricing step is told from here, never from memory (D-412, D-420); `null` in a migrated run until its first resume |
| `pinCommit` | the PoB pin's commit when `init` ran, which `pob2-run-log` reads from `pob-pin.json` (the runner runs no `git`); `null` in a migrated run |
| `digest` | the running leagues' digests when `init` ran (D-507): their file names in `data/league/`, the latest start first, possibly empty, as `pob2-run-log` reads them by each digest's `League:` sentence (`skills/game-knowledge/scripts/leagues.mjs`); in a log `init` wrote below revision 15, the one file name it recorded then (D-412), or `null` |
| `dossier` | `null` until R1b-assemble writes the dossier; then its path in the run folder, `dossier.md`, run-wide |
| `builds[]` | one per finalized card, in finalize order: `{id, roll, status, folder, guide, pobFile}` (below, D-412), with `name` after `roll` once a `build` entry gave one (D-435), and `draftFile` after `pobFile` in a log at 13 (D-466) |
| `stages[]` | one per agent call, in run order: `{stage, concept?, attempt, outcome, priceOutcomes?, probes?, skeletonFile?, shortReason?, tried?, scope?, requests?}`; R1b's `skeletonRemoved: true` once the runner removed its skeleton file (amendment 14, "Amendment 14's entries" below) |
| `checkpoints[]` | `{checkpoint, concept?, visit, answer, answeredBy, rule?, questions?, changes?, newCards?, note?}`; `concept`, the build's card id, on a design or final checkpoint only |
| `checkpoints[]`, amendment 14 | in a log at 14 also the `ask` checkpoint, `{checkpoint: "ask", kind, build, visit, answer, answeredBy, rule?, at}`, and a design `accept` or `accept:file`'s `scaling: true \| false` ("Amendment 14's entries", below) |
| `answerChanges[]` | amendment 14 only, once one is written (D-480): `{checkpoint: "design", concept, visit, from: "accept", to: "accept:file", note, at}`, a design accept changed to the PoB file only after F1, `at` the `stages[]` length when written |
| `withdrawals[]` | amendment 14 only, once one is written (D-480): `{build, files, at}`, the files `pob2-render-audit --withdraw` removed |
| `displays[]` | `{checkpoint, visit}`, one per gate visit whose display `display <gate>` printed (D-367, "Writing it" below); in a log at 13 a brainstorm visit's is `{checkpoint, visit, numbers}`, `numbers` the number-to-id map of the cards it numbered, `{"1": "<card id>", …}` (D-475), from which the runner maps the user's numbers to the `pick:` it logs |
| `escalations[]` | gate escalations only: `{stage, concept, verdict, choice, guidance?}` |
| `faults[]` | offline test mode only: `{id, target, applied, observed}`; empty otherwise |
| `resumes[]` | one per resume (D-415): `{date, pinCommit, digest, noNinja, lengths: {stages, checkpoints, escalations, displays}}` |
| `pricing` | the pricing stops and the user's answers to retry (D-444): `{stops: [{at, step, outcome}], retries: [{checkpoint, answer, at}]}` ("Pricing stops", below); `init` writes it empty, and a resume adds it to an older log |

No run-level `roll` or `outputs` (schema 3's): each build records its own identity and PoB file, and no log
holds the import code, whose one home is the record (D-260).

### Builds (D-411, D-412)

`builds[]` holds one entry per card the verification gate finalized, in finalize order, written only with
`pob2-run-log build` (below):

| Field | Content |
|---|---|
| `id` | the card id (`r1-a-2`); a card with a build is never finalized again (D-411) |
| `roll` | the card's identity `{className, ascendancy, skill}`, `skill` its named damage source, the names exactly as the tools gave them (D-286) |
| `name` | only once a `build` entry gave it: the build's name, the card's or the one its finalize revision gave the build (D-435). `pob2-render-audit` titles the build's `audit.md` with it, else with its card's H1, so F1's render and the run checker's re-render agree; the card keeps its own name |
| `status` | `queued` at the finalize; `designing` from its D1-build; `writing` once its final compile passed, and while its campaign runs; then its end: `completed` (the final gate's `accept`, `accept:verification` or `campaign`), `file-only` (F1 after the design gate's `accept:file`; in a build held to revision 13, once its claims pass, `V4-claims`, passed, or the re-check of its round ran, D-477), `not-accepted` (`decline:<note>`), `dropped` (back to the verification gate), `stopped` or `escalated` |
| `folder` | `builds/<id>`, the build's folder; `.` for a migrated run's build, whose files stayed at the root |
| `guide` | `null`, `endgame` or `full`: the template its plan decides (D-414: no campaign stage, the endgame guide), set once W1 wrote it |
| `pobFile` | `null` until a final compile wrote the PoB file (F1, or the D2 gate after its campaign); then the final record's PoB path, the verdict's `finalCompile.pobFile`. A build held to revision 13 names it by its session name (`name`, else its card's), cleaned: `<name>.xml`, `<name> <run date>.xml` or `<name> <run date> <k>.xml`, a campaign's ending ` (campaign)` (D-466); two builds never record one file |
| `draftFile` | in a log at 13 only (D-466): the latest draft's path, `<name> (draft).xml` or `<name> (draft <k>).xml`, as `compile_plan`'s draft mode returned it (on a D1 gate pass that leads to the design gate, and on an escalation's `accept`); `null` once F1 removed it, or before any draft. A log below 13 has none, and the run checker accepts both shapes |

### Resumes (D-415)

`resume` appends one entry per session that resumes the run: the date, the pin's commit and the running leagues'
digests (a list, D-507) as the repository and the clock give them then, the session's `noNinja`, and `lengths`, how many entries `stages[]`,
`checkpoints[]`, `escalations[]` and `displays[]` held at the resume. So every entry after it can be placed: the
run checker accepts entries after a build's or the run's end only behind a resume, and the pricing stop holds
only for the session it happened in (a `stages[]` entry from index `resumes[<last>].lengths.stages` on,
`skills/build-guide/references/pricing.md`). When the pin's commit or the digests differ from the run's last recorded ones, the verification
display says so: two lists compare as sets, and an older run's string with a list's first entry ("The league digests
changed since this run last ran").

### The brief

`brief` holds the fields the runner parsed from the user's free text (`skills/build-guide/SKILL.md` §1), each one only when the
text gives it, with the names exactly as the brief check's tools gave them:

| Field | Value |
|---|---|
| `ascendancy`, `skill` | text: an ascendancy, and an active skill gem or a command a summon's minion casts (the named damage source, D-379) |
| `playstyle` | a list of strings: the vocabulary's tags in the user's order (`melee`, `tanky`, …), then any free text as one more string (`["melee", "tanky", "slow and heavy"]`) |
| `budget` | `"budget"`, `"non-budget"`, or a figure in divines (a number) |
| `around` | text, as the user wrote it; a support gem by its name as the lookup gave it (`"Fork"`, D-343) |
| `like`, `notes`, `popularity` | text, as the user wrote it |

The slug comes from it: `<ascendancy>-<skill>`, `<ascendancy>-open`, `open-<skill>`, or with neither
`open-<first playstyle tag>`, else `open` (`skills/build-guide/references/run-folder.md`). A finalized card whose identity contradicts the
brief's `ascendancy` or `skill` can't exist: R1a-assemble deals no such card.

### Entry rules

- **`stages[]`** has one entry per Agent call, in run order: each R1a researcher is its own entry, and so is each
  of D1's three steps. `stage` is `R1a`, `R1a-assemble`, `R1b`, `R1b-assemble`, `D1-build`, `D1-finish`, `D1-gate`,
  `D2`, `D2-gate`, `W1`, `V4` (the one full pass, D-352) or `V4-recheck` (a re-check), and `Q`, a gate question
  step (D-390); and schema 4's `D1-tree` (D-418), `F1`, an endgame-only build's final
  compile (D-413), and `V4-campaign`, V4's campaign pass (D-415); amendment 13's `V4-claims`, a file-only build's
  claims pass (D-477); and amendment 10's `R1a-synthesize` (D-429),
  the brainstorm round's coordinator step that composes 1 to 4 builds, the composites, from every card and the research
  files' Ideas, in place of R1a-assemble's deal. A run whose first brainstorm round used `R1a-assemble` keeps it for
  every later round, and one that composed keeps `R1a-synthesize`: `pob2-run-log` refuses the other step, and the run
  checker fails a run that mixes them. Each V4 entry is one report, its build's
  `reports/V4-<n>.md`. `concept` is the card id (`r<round>-<letter>-<n>`, D-319; the letter `s` a composite's, `r<k>-s-<n>`, D-429), set
  for every step but R1a, R1a-assemble, R1a-synthesize, R1b-assemble and Q: a build's steps name their build.
  `attempt` counts the calls of that (stage, card) from 1, re-runs included, and matches the header and the
  verdict file name; per log name, so a re-check's `attempt` counts that card's re-checks from 1, apart from its
  full pass (D-368). `outcome`:
  - `pass` or `fail` for a gate step (R1b, D1-gate, F1, D2-gate) and a V4 entry (`fail`: its report has an
    `unresolved` finding), `V4-claims` among them; a D1 gate whose only issue is its tree part's `tool-error` is `fail` (D-419);
  - `stale-server` for a D1-tree whose first node power reply had no targets in its rebuild line (a session server
    built before M-26, D-467): the runner asks the user to reconnect the server with `/mcp`, and D1-tree runs again
    next, its next attempt;
  - `done` for a step that only produces (R1a, R1a-assemble, R1a-synthesize, R1b-assemble, D1-tree, D1-finish, …), `infeasible`
    for D1-build claiming it and for a D1 gate routed so;
  - `respec` for a D1-tree that returned `respec: <stage> needs one: <why>`, a scaling change D1-build missed (D-438),
    and `build` for a D1-finish that returned `build: <ids>` (§14): each routes D1-build next, in the same attempt, even
    when the attempt already ran D1-build. In a run held to amendment 12 (`skillRevision` 12) D1-tree has no `respec`:
    each loadout's tree is its own (D-452), and a user's respec request is a tree request, D1-tree then D1-finish;
  - `claims-edited` for a D1-finish or D2 of the fix round or a revision that returned `recompiled: no` with no
    gate after it: it edited claims in place and compiled nothing (D-264). A D1-finish after D1-build, and a D2
    after a recompiled D1, are `done` whatever they return: their gate follows. The run checker
    tells it from a redesign: the final record stays current, the plan may differ from the record's
    `planSha1` only in its claims, source tags and ledger (its build projection's sha1 equals the record's
    `buildSha1`, D-266, D-352), and the re-check covers what `pob2-check-run --changed <n>` lists;
  - `escalated` for the gate attempt that escalated;
  - `missing` for an agent that returned without its file;
  - `refused` for any step the permission system refused a tool call in (D-421): its return's `refused: <tool>`
    line, or a gate verdict with code `tool-refused`. The same step is re-run next, alone, and counts against no
    retry cap, though its `attempt` counts the call.
  A gate attempt's outcome is the one its verdict file routes to (`skills/build-guide/references/gates.md`), and the run checker holds the
  two together. An R1b `fail` whose verdict's finding is `not-a-skill` with `compiles: 0` is final: its card's
  damage source isn't a skill and no retry can compile it, so it never re-runs (D-334). So is one whose
  finding is `wrong-ascendancy` with `compiles: 0`: the card's ascendancy doesn't own the passive-tree node
  that grants its skill, and no retry can change the card's identity (D-342). That card is `failed`, and the
  verification gate can't finalize it. So is `not-in-pin` (the card rests on an entry the PoB pin doesn't know:
  it can't be finalized yet, D-400), with `compiles: 0`. An R1b attempt whose verdict has a `damage-missing` finding
  (a kind of damage the card names shows nothing on the named source, D-436), its part `damage` failing, is a `fail`
  though its skeleton compiled: it retries within R1b's counted retries, and after them the card is `failed` with
  that finding.
- **`probes`**, on every R1b entry: how many probe variants that attempt ran, its return's `probes <n>`
  (`skills/build-guide/references/stages/R1b.md`): every probe run, a probe whose compile failed included, since each leaves its folder
  `probes/<card-id>/<n>/`. `0` when none (a failed attempt runs none: the checklist runs only after the last
  compile succeeded). A card's entries add up to the folders under `probes/<card-id>/`, and to at most 4, D-292's
  cap (D-338). A composite's add up to at most 8 (D-433): the checklist's 4, then 4 leave-one-out probes. A composite
  is any card with a `### Pieces` table, whatever its id letter (a card made at a gate from pieces among them).
- **`shortReason`**, on an R1a-assemble or R1a-synthesize entry only: the reason its return gave for a short round, its line
  `short: <why>` without the `short: ` (D-339), except for a round short for one engine (D-405): that one keeps its
  whole line, starting `short: <n> cards share one engine` (any other reason follows a `;`), the words the run
  checker looks for, and the round deals no more than 6. A round is short when it deals fewer than 6 cards, or the
  deck (every round's dealt cards so far) holds fewer than two under-played cards; the run checker counts both from
  `cards.md` and accepts a short round only with its reason. A composed round (R1a-synthesize, D-429) composes 1 to 4
  composites, never more; it is short when it composes fewer than 2 (`None.` under its `## Round <k>` when it composed
  none), or when none of them takes a piece marked under-played (a row of its card's `### Pieces`, `in` or `scheduled`,
  whose Kind ends `, under-played`, D-339), and the run checker accepts it only with its R1a-synthesize entry's
  `shortReason`. The engine rule (D-405) doesn't apply to composites.
- **`priceOutcomes`**, on a pricing step (R1b, D1-build, D1-finish, D1-gate, D2) that made price calls: its calls
  counted by outcome, `{"ok": 12, "would_wait": 1}`, each key `ok`, `error` or a `[trade:<kind>]` kind (D-218,
  `skills/build-guide/references/pricing.md`), and `exchange` for the calls priced from poe.ninja's currency exchange, which send no trade request
  (D-444). D1-build logs its `find_upgrades` calls (D-444). Amendment 13 (D-474): `pace` counts the trade call whose
  reply had no pace line, or `Pace: off (test setting).`, after which the step made no more trade calls and returned
  the stop `pace: missing` or `pace: off`. Never in an offline run. NFR-22 reads it: no `rate_limited` and no
  `locked_out`.
- **Pricing stops** (D-444). A `stage` entry whose `priceOutcomes` counts a `rate_limited` or `locked_out` call, or
  amendment 13's `pace` (D-474), stops trade-site pricing: `pob2-run-log` records `pricing.stops[] {at, step, outcome}`
  with it (`at` that entry's index in `stages[]`, `outcome` `locked_out` when it counts one, else `rate_limited`, else
  `pace`). After a `pace` stop the runner asks the user to reconnect the server with `/mcp` before the retry. From then on no step makes a trade-site
  request (poe.ninja's exchange stays allowed, counted as `exchange`) until the user approves a retry at the next
  gate, or a resume clears the stop. That gate asks before its other questions ("Pricing stopped at <step> after
  <outcome>: retry?"), once its display printed, and the runner logs the answer with `pob2-run-log pricing`:
  `pricing.retries[] {checkpoint, answer, at}`, `answer` `retry-pricing` or `no-retry`, `at` the `stages[]` length
  then. A step logged at index `i` is under an open stop when the last stop before `i` has no `retry-pricing` and no
  resume (`resumes[].lengths.stages`) after it and up to `i`; every pricing step reads that, and the run checker fails
  a pricing step under an open stop that counts a call other than `exchange`. After `retry-pricing` at the design gate,
  the D1 gate's re-price pass runs before F1 (a D1 gate after the design gate's `accept`, then F1, with no second
  design gate); at the verification gate, the next pricing step prices.
- **`checkpoints[]`**: `checkpoint` is `brainstorm`, `verification`, `design` (D-362), `final`,
  `unsaved-build` or `escalation` (`skills/build-guide/references/checkpoints.md`); `visit` counts that checkpoint's visits from 1; `answer` is the effective answer:
  - the brainstorm gate: `pick:<id>[,<id>…]` (1–3 cards to verify, new cards included; `pick:` alone makes
    only new cards), `more` or `stop`;
  - the verification gate: `pick:<id>[,<id>…]` (finalize 1–3 cards, in the user's order, each logged with
    `build` as a queued build with its identity, D-411), `verify:<id>[,<id>…]` (1–3 more cards from the deck, a
    verification round without a brainstorm; `verify:` alone, new cards only), `more` or `stop`; after a resume
    (D-415) also `guide:<id>` (a `file-only` build's endgame guide), `campaign:<id>` (a `completed` or
    `file-only` build's campaign) and `design:<id>` (a `stopped` or `dropped` build's design gate again);
  - the design gate, with `concept` its build: `accept` (on to F1, then the guide), `accept:file` (F1 alone: the
    build ends `file-only`), `revise:<text>` (D1 again, its gate and the design gate again), `verification` (the
    build ends `dropped`, back to the verification gate) or `stop` (the build ends `stopped`; the default `stop`
    ends the run);
  - the final gate, with `concept` its build: `accept` (`completed`), `accept:verification` (`completed`, then
    the verification gate once the queue is empty), `campaign` (`completed`, then its campaign), `revise:<text>`,
    or `decline:<note>`, a user who declines the guide, the note after the prefix (the build ends
    `not-accepted`); its `stop` is the default only, and ends the run;
  - the unsaved-build question: `proceed` or `stop`; an escalation: `accept`, `retry:<guidance>`, `verification`
    or `stop`.

  `answeredBy` is `user`, `pre-supplied` (the test config) or `default` (the test config had no answer left, or
  the deck refused its entry, `skills/build-guide/references/offline-and-test.md`). Only an accepted test config gives `pre-supplied` or `default`, and then `rule` records
  how the answer was reached: the test config's answer exactly as written (`first-viable`, `pick:r1-a-2`) for
  `pre-supplied`, or the default that applied (`no verification answer left: stop`) for `default`. A user's
  answer has no `rule`. The test config's answers are `answers.brainstorm`, `answers.verification`,
  `answers.design`, `answers.final`, `answers.escalation` and `answers.unsavedBuild` (D-323, D-362): a pre-supplied rule is one of their
  values, and `first-n:<n>` and `first-viable` resolve to the `pick:` they chose, or to `stop`. A default answer
  is `stop`. The entry that finalized the guide's card keeps its rule here; `audit.md` has no Run notes (D-355).

  A gate's or an escalation's entry always has `questions`, how many the user asked at the visit (`0` too);
  its interview notes hold as many (D-389). `changes`,
  `newCards` and `note` carry a pick's revisions, the cards made at the gate and a `more` answer's note
  (D-391, `skills/build-guide/references/checkpoints.md`). A new card's `from` names cards and composites by id, or pieces by key (D-432): a
  `### Pieces` row's key on a card of the run, or an Ideas line's id in its research files; `pob2-run-log` refuses one
  that names none of these. A card made from pieces is a composite, with its Pieces tables.
- **`escalations[]`**: `stage` is `D1-gate`, `D2-gate` or `F1` (D-413); `verdict` is the escalated attempt's verdict file,
  `reports/gates/<stage>-<card>-a<attempt>.json`, so the log copies no findings; `choice` is `accept`, `retry`,
  `verification` (back to the verification gate, which replaces `checkpoint-1`, D-289) or `stop` (D-236), with
  the user's `guidance` for `retry`. The escalations are in the order of the `stages[]` entries whose outcome is
  `escalated`, and the k-th one's `choice` is the answer of the k-th `escalation` checkpoint (`retry:<guidance>`
  is `retry` with that `guidance`).
- **`faults[]`**: each directive the test config gave, with its `target` as written (`{concepts, persistent}`,
  `concepts` a list of card ids or `"all"`), `applied` (how many headers carried it) and `observed` (what failed
  as a result).
- **`builds[]`** and **`resumes[]`**: above. Log each build's status, guide and PoB file as they change: its
  `pobFile` is the F1 or D2 gate verdict's `finalCompile.pobFile`. Don't copy the import code into the log: its
  one home is the build's `compile-record.json`, and the guide holds a copy (D-260).

### Rounds, read from the gates

Only the user starts a round (D-287), so the log's gate answers say where every round begins:

- **A brainstorm round** is the run's first R1a entries, or the R1a entries after a `more` answer at either
  gate: up to 3 R1a researchers, then one R1a-assemble (one R1a-synthesize in a run that composes, D-429), then the
  brainstorm gate.
- **A verification round** is the R1b entries after a brainstorm `pick:<ids>` or a verification `verify:<ids>`:
  R1b for each named card, in that order, then each of its `newCards`, one at a time, then one R1b-assemble,
  then the verification gate. A card is verified once.
- **A build** follows a verification `pick:<ids>`, one at a time in the queue's order (D-411): its design,
  D1-build, D1-tree, D1-finish and the D1 gate, then the design gate (D-362), and F1 only after its `accept` or
  `accept:file` (D-413); after F1, W1, the V4 full pass, the fix round and the re-check, then its final gate. A
  design `revise:<text>` runs D1 again (D1-build, D1-tree, then D1-finish for a build change or a respec the user
  asks for, D-438; D1-tree then D1-finish for the tree alone; D1-finish alone otherwise), the D1 gate and the design
  gate again; a D1 gate's `tree` failure runs D1-tree, then D1-finish. Within an attempt, D1-tree's `respec` and
  D1-finish's `build` route D1-build next (D-438, §14). D2 and the D2 gate run only for a campaign (the final gate's
  `campaign`, or `campaign:<id>`), followed for a `completed` build by `V4-campaign`. D-477 (amendment 13): a build
  held to revision 13 that F1 passed after `accept:file` stays `designing` for its claims pass, `V4-claims`; on a
  pass it ends `file-only`; on a failure its fix round follows (the round copy, D1 alone, D1-finish first; a recompile
  runs the D1 gate, then F1 with no design gate), then one `V4-recheck`, and the build ends `file-only`. A later
  `guide:<id>` runs W1 and V4's full pass, its report numbered after the claims pass's. Every route back from a
  design (an `infeasible` D1 gate, an escalation's or the design gate's `verification`, FI-3) returns to the
  verification gate, the cards still queued waiting behind the visit.
- **The fix round, a revision and a campaign** (D-352, D-415): each starts with the round copy, `rounds/<n>/` in
  the build's folder, which the run checker's `--snapshot <n> --build <id>` makes (`skills/build-guide/SKILL.md` step 12); no design
  gate is asked in them. A D1 finding runs D1-finish first; when it returns `build: <ids>`, D1-build runs with
  those findings, then D1-tree, then D1-finish again, then the gates.
- **A resume** (D-415) places its entries by its `resumes[]` lengths: after a build's or the run's end, the next
  entries follow a resume and its verification visit.

Each gate visit records its one answer in `checkpoints[]`, in order; the run ends when the queue is empty and the
last answer didn't ask for the verification gate.

## Reading the requirements from the log

- **NFR-23** (the cost caps): per brainstorm round at most 3 R1a entries and one R1a-assemble, dealing 6–9 cards (or
  one R1a-synthesize, composing 1–4 composites, D-429);
  per verification round at most 3 cards compiled (a second verification round from the
  same deck has its own 3); one V4 pass per guide, and one re-check per fix round or revision (D-352); one claims pass
  per file-only build held to revision 13 (D-477); at most 2 counted
  retries per gate (the run checker counts them from `stages[]`, S6 included); and at most 3 agents in flight,
  which the session's transcript shows.
- **D-292's probe cap**: each card's `probes`, summed over its R1b entries, at most 4; a composite's at most 8 (D-433).
- **NFR-22** (no 429s, no lock-outs): no `priceOutcomes` counts a `rate_limited` or `locked_out` call.
- **D-416's output targets**, measured after the run by `scripts/run-usage.mjs` over its sessions' transcripts,
  grouped per build by the header's `concept`: the shared phases 1.2M, an endgame-only build 0.75M, a campaign
  0.4M. No step stops for them.

## Writing it (D-356)

One call per write, the entry as JSON on stdin (`-` in place of the JSON argument) through a quoted heredoc, so
an apostrophe in a brief's notes, a `revise:` text, a retry's guidance or a final-gate note needs no escaping;
its fields exactly as above, `<runFolder>` the absolute path `mcp__pob2__guide_run {new_run}` (or `{resume}`)
returned:

```
pob2-run-log <runFolder> init - <<'JSON'
{"slug": "titan-blood-hunt", "brief": {"ascendancy": "Titan", "skill": "Blood Hunt"}, "mode": "offline", "testConfig": "accepted", "noNinja": false}
JSON
pob2-run-log <runFolder> build - <<'JSON'
{"id": "r1-a-2", "roll": {"className": "Warrior", "ascendancy": "Titan", "skill": "Blood Hunt"}, "status": "queued"}
JSON
pob2-run-log <runFolder> stage - <<'JSON'
{"stage": "D1-finish", "concept": "r1-a-2", "attempt": 1, "outcome": "done", "priceOutcomes": {"ok": 12}}
JSON
pob2-run-log <runFolder> display design --build r1-a-2
pob2-run-log <runFolder> checkpoint - <<'JSON'
{"checkpoint": "design", "concept": "r1-a-2", "visit": 1, "answer": "revise:the build's helmet costs too much", "answeredBy": "user", "questions": 0}
JSON
pob2-run-log <runFolder> escalation - <<'JSON'
{"stage": "F1", "concept": "r1-a-2", "verdict": "reports/gates/F1-r1-a-2-a2.json", "choice": "stop"}
JSON
pob2-run-log <runFolder> build - <<'JSON'
{"id": "r1-a-2", "status": "escalated"}
JSON
pob2-run-log <runFolder> set - <<'JSON'
{"status": "escalated", "dossier": "dossier.md"}
JSON
pob2-run-log <runFolder> resume - <<'JSON'
{"noNinja": false}
JSON
pob2-run-log <runFolder> migrate
```

- `init` writes the first log (below): `skillRevision` 15, `runFolder` the folder given, `noNinja` the run's
  `--no-ninja` (`true` or `false`, required), the pin's commit and the running leagues' digests as the script reads them,
  `dossier` null, the lists empty, `pricing` with no stop or retry, `status` `running`, or `stopped` with a refused
  test config. It never overwrites a log. After its first line, `init` and `resume` print the running digests (D-507):
  `digests: [<paths>]`, the root-relative paths every task header's `digests` copies, newest first; then each one's
  third line (the staleness line, `skills/build-guide/references/start.md` step 5), or `No running league has a league
  digest: what is new in it isn't in the committed data.`; then `<path> records no league dates: re-run its digest
  script` for each undated digest. Tests set the instant with `BUILD_GUIDE_TEST_NOW`; a run never does.
- `stage`, `checkpoint` and `escalation` each append one entry to `stages[]`, `checkpoints[]` or
  `escalations[]`. A `stage` entry counting a `rate_limited`, `locked_out` or `pace` call also records its stop in
  `pricing.stops[]` (D-444, D-474). A log with `skillRevision` refuses a stage `RV`: the rival is removed (D-443); a log
  at 12 or later refuses a D1-tree `respec` (D-452). D1-tree's `stale-server` (D-467) and the stage `V4-claims` (D-477)
  are schema 4's.
- `pricing` (D-444) logs the user's answer to a gate's pricing question, `{"checkpoint", "answer"}`, `answer`
  `retry-pricing` or `no-retry`, as `pricing.retries[]` with `at` the `stages[]` length; refused when no stop is open,
  or before that gate visit's display printed. After a stop, at the design gate, before that visit's `checkpoint`
  entry:

  ```
  pob2-run-log <runFolder> pricing - <<'JSON'
  {"checkpoint": "design", "answer": "retry-pricing"}
  JSON
  ```
- `build` (D-412) adds a finalized card's build, `{"id", "roll", "status": "queued"}`, its folder `builds/<id>`,
  once per card the verification gate finalizes, with `"name"` when its finalize revision gave the build one (D-435);
  then `{"id", "name"?, "status"?, "guide"?, "pobFile"?, "draftFile"?}` updates it. A card with a build is refused as a
  new one, and a build keeps its card's identity. `draftFile` (D-466), a log at 13's: the draft mode's reply's path on a
  D1 gate pass that leads to the design gate and on an escalation's `accept`, and `null` once F1 removed the draft:

  ```
  pob2-run-log <runFolder> build - <<'JSON'
  {"id": "r1-a-2", "draftFile": "Royal Fury Rake Titan (draft).xml"}
  JSON
  ```
- `resume` (D-415) appends a `resumes[]` entry, `{date, pinCommit, digest, noNinja, lengths}`, from this session's
  `noNinja` (its `--no-ninja`) and the four lists' lengths, sets the top-level `noNinja` to this session's flag, and
  sets `status` `running`. On a log below `skillRevision` 15, or without it, it stamps `skillRevision` 15 and writes a
  boundary in `skillRevisionFrom`, its resume's lengths, for every revision above the log's old one: a log at 14 gains
  `"15"`; a log at 13 gains `"14"` and `"15"`; a log at 12 gains `"13"` to `"15"` (and keeps 11's or 12's boundary when a resume stamped them); a log at 11
  keeps 11's boundary (its flat form read as `"11"`) and gains `"12"` to `"15"`; a log without `skillRevision`
  gains `"11"` to `"15"` at the same lengths, so its earlier entries are held to none of those revisions' rules; it adds
  `pricing` (§19, amendment 12 §22, amendment 13 §22, amendment 14 §25, amendment 16 §24). It runs once per resume,
  before the resume's unsaved-build question and verification visit.
- `migrate` (D-415), with no JSON, rewrites a schema-3 log as schema 4: its finalized card becomes `builds[0]` with
  `folder: "."` (its files stay at the root), its status from the old `status` and last answer, `guide` from
  whether a guide exists; its design and final checkpoints get `concept` from the D1 gate entry before each; a
  final-gate decline's note gets the `decline:` prefix; `noNinja`, `pinCommit` and `digest` are `null`. It refuses a
  log that is already schema 4. A resume of a schema-3 run migrates first, before `resume`.
- `display <gate>` (D-367; `brainstorm`, `verification`, `design`, `final` or `escalation`) prints that gate
  visit's display, built from the run folder's files (`skills/build-guide/references/checkpoints.md`), and records the visit in `displays[]`;
  printing it again records nothing new. The design and final gates are a build's: `display design --build <id>`
  and `display final --build <id>` (D-411). A `checkpoint` entry for one of those gates is refused until its
  visit's display is recorded; the unsaved-build question has no display. In a run that composes (D-432), the
  brainstorm display shows each composite not verified yet, numbered: its round line, then its pieces in short, `  in:
  <pieces>`, `  scheduled: <piece> (<where>)` and `  out: <piece> (<why>)`; then the composites a later round
  superseded, still pickable; the obvious build's line; then every plain card `## Cards` lists, numbered on, its name
  and structure, one line each. The design display prints `- Pieces: <n> in, <n> scheduled (<names>), <n> out
  (<names>)` once, before the rungs, from the D1 gate's design field `pieces` (D-434). The final display prints the run
  checker's warnings under For reference, a server build older than its source among them (D-435).
  In a run held to amendment 11 (`skillRevision`): the verification display shows no damage, life, EHP, clear-speed
  or movement-speed figure, only each card's status in words ("works", "works, except <what>"), its synergy, its pitch
  lines as written, its made and changed lines, the damage kinds and the pieces from the dossier, its key prices in
  players' words and its risks, then `Numbers come at the design gate, measured on the full build.` (D-436); the
  brainstorm display drops a composite's `out:` line (D-442); the design display counts the out pieces without naming
  them, `- Pieces: <n> in, <n> scheduled (<names>), <n> out`, and prints each rung's damage against map monsters, its
  boss line (`about <estimate>` with what it corrects, else PoB alone), the non-budget rung's floor and toughness
  lines, the cull and trigger lines, the best swap in `damage`, and the rung's trades from the design field (D-437 to
  D-441, D-447, D-448); and the final display prints each rung's two figures, its boss figure the record's evaluated
  `boss_<stage>` when the plan estimates one (`about <n>`). Every run's brainstorm display says `drawn from <host>`
  under a card that cites a published guide (`external | <url>`, D-445).
  A D1 gate's design field written under amendment 12's rules (a rung with `maxHit` or `damage.resisting`, Appendix A)
  adds to the design display, on `b` and `n`, the Arbiter line from the deciding row, its hits survived rounded down to a
  whole percent with the chances at the Arbiter's accuracy, `under the 80% floor` on a one-shot rung, then `- Lowest max
  hit: <n> <type>.` and, on a stage whose gear gives a companion part of each deflected hit, PG-100's note; on each rung,
  after the boss lines, `- Resisting rares: <n> per second (40% fire, cold and lightning resistance).`; on `n`, the Effective
  HP line's chance-layer share, the conditioned line and its band, the ailment line on a build that deflects and the
  warning; and the trades' `- Defence (one-shot): …` and `- Avoidance: …` lines with their max hit and hits survived
  (D-449, D-450, D-454). A record with `measures.damage.resisting` gives the final display three figures, `<map> damage per
  second against map monsters, <resisting> against resisting rares, <boss> against a Pinnacle boss`, and a record whose
  Arbiter rows carry hits survived gives the verdict label's three forms there and in the design-to-final comparison
  (D-459).
  In a run held to amendment 13 (D-475, Appendix A), the brainstorm display, on the composite and the dealt-card paths
  alike, prints the header's first one or two sentences of "what they share" and no "How they differ"; each composite or
  dealt card not verified yet, numbered, on one first line, `<n>. <name>: <structure>; under-played: yes|no` (the
  structure the deck line's first part, under-played its `under-played (judgment: …)` label); under a composite at most 8
  key pieces, `  in: <pieces>` (by kind: its uniques, supports, keystones, under-played rows, then notables, then the
  rest), then `, + <N> more in cards.md`, and `  scheduled: <names>`, names only; `drawn from <host>`; the plain cards on
  one line, `Plain cards: <names>.` (a dealt deck's `Not dealt: <names>.`); the obvious build's line, a short round's
  reason and the not-confirmed sentence as before; and no "For reference": the visit's `displays[]` entry records
  `numbers`. A D1 gate's design field written under amendment 13's rules (a rung with `life`, `swapCap`, `rebuild`,
  `removedForOthers`, `levels`, or `boss.start`, Appendix A) adds to the design display, from the field alone: `- Boss
  rotation on <rung>: <start> → <end> on the tree, <final> at the gate (floor <n>). <entry> <start> → <end> (−<x>%) →
  <final>, … (valued by <reason>: +<x>% to the rotation, the designer): <reason for a fall> (the designer).` after the
  damage lines (an entry's percent on a fall, its `valuedBy` in place of it; the floor on `n`); `- Life on <rung>: <start>
  → <end> (EHP and the lowest max hit held their start).` after the toughness lines; after the tree lines `- Swap cap on
  <rung>: <swaps> swaps, the last +<x>%.`, `- Rebuild undone on <rung>: <why>.`, `- Removed on <rung>: <names>: lines for
  <skill>.` and `- Skill levels on <rung>: <skill> +<n>.`; among the trades `- Boss trade on <rung>: <what> (remove <r>,
  add <a>): boss <gate figure> → <bossAfter>, damage <±x>%, EHP <±y>%.`; and before the rungs, from the build's
  `draftFile`, `- Draft PoB file: <file name>, in your builds list.` (D-466, D-467, D-468, D-473). The final display
  prints F1's `draftLeft`, `Your draft PoB file stays: <file name>, which F1 didn't remove: it changed on disk, or this
  build didn't write it.` (Appendix A).
  In a run held to amendment 14 (D-478, Appendix A's displays): the brainstorm display prints, for each composite or dealt
  card not verified yet, numbered, its header `**<n>. <name>** (<class, ascendancy, skill>; under-played: yes|no)` and its
  `drawn from <host>` line, and under them the runner writes each card's rotation, what makes it work and the catch;
  then the superseded composites, `**<n>. <name>** (superseded by <name>, still pickable)`, and the closing lines, one
  each: `Obvious build: <name> (<class, ascendancy, skill>).` (or `none`), `Plain cards: <names>.` (a dealt deck's `Not
  dealt: <names>.` and `Found, not used: <items>.`) and `A short round: <why>`, then the invitation; no key pieces, no
  `scheduled:` line, no shared header and no not-confirmed sentence (they stay in `cards.md`); its `displays[]` entry
  records `numbers`. The verification display prints each card as `**<n>. <name>**: <status>`, then one bullet per field
  with a bold label: `- **PoB file:** <skeleton file name> (key pieces only; its numbers aren't the build's)` first, from
  the card's last R1b entry's `skeletonFile` (`; you changed it in PoB, so it stays` when its build's design ran and no
  removal was logged; no line once removed), `- **Synergy:** …`, the pitch lines, the made and changed lines, `-
  **Damage:** …`, `- **Pieces:** …`, `- **Key prices:** …`, then `- **Risks:** …`, `- **PoB can't verify:** …` and `-
  **Stronger structure:** …`. The design display of a build whose last D1 gate ran at or after 14's boundary is the
  user's form: `PoB file: <draft file name> in your Builds folder` (the build's `draftFile`, else, once F1 removed the draft, its `pobFile`);
  `**How it works.** <summary.how>`; each rung, `m` in two lines (`**<name>: entering maps** (level <n>)`, then `<damage>
  damage per second on map packs; <EHP> effective HP; the draft holds the rest.`), `b` and `n` as `**<name>: budget
  endgame** (level <n>)` with a five-row table (`Damage, map packs`, with `(the same on 40%-resistance rares)` or the
  resisting figure; `Damage, pinnacle boss`; `Toughness`, the EHP and the lowest max hit with its type; `Arbiter of
  Divinity`; `Speed`, the clear word or `no area: chains <n>, projectiles <m>`, the regular movement figure and the travel
  skill or `no travel skill`), `**Gear**` (`- <slot>: <text>` from `summary.gear[]`), `**Skills**` (`- <skill>:
  <supports>` per group of the plan) and `**Over budget**` (at most 3 lines a rung from `trades.json`'s `scaling` finds,
  measured first by gain, `- <from> was swapped for <to>; adding it back: +<a>% damage, −<b>% EHP, about <price> more.`,
  an unmeasured one with `(estimate)` after its EHP; then the rung's other trades, one line each, boots aside: they're in
  the gear line); `**The catch.** <summary.catch>`; the invitation; and `**Options**` last, under which the runner gives
  its `not made:`, `jewel:` and `stronger structure:` lines, one each. `display design --build <id> --detail` prints the
  measurement display of the older revisions (today's lines). The final display prints its PoB file first. Any display
  reads a clear skill with no area, once the record gives its `chains` and `projectiles`, as `no area: chains <n>,
  projectiles <m>` (D-491).
- `set` replaces `status`, `dossier` (once R1b-assemble wrote it) or `faults` (`skills/build-guide/SKILL.md` §8).
- Amendment 14's writes (a log at 14; "Amendment 14's entries", below): `skeleton` marks a card's skeleton file removed,
  `answer-change` changes a design accept to the PoB file only after F1, and `stage` and `checkpoint` take the new fields:

  ```
  pob2-run-log <runFolder> stage - <<'JSON'
  {"stage": "R1b", "concept": "r1-s-2", "attempt": 1, "outcome": "pass", "probes": 2, "skeletonFile": "Rupture Relay Arc Lich skeleton (draft).xml"}
  JSON
  pob2-run-log <runFolder> skeleton - <<'JSON'
  {"concept": "r1-s-2"}
  JSON
  pob2-run-log <runFolder> stage - <<'JSON'
  {"stage": "D1-finish", "concept": "r1-s-2", "attempt": 2, "outcome": "done", "scope": "swap", "requests": [{"id": "u1", "words": "use the 5 divine staff", "result": "made"}]}
  JSON
  pob2-run-log <runFolder> checkpoint - <<'JSON'
  {"checkpoint": "ask", "kind": "departs", "build": "r1-s-2", "visit": 1, "answer": "keep the crit suffix after all", "answeredBy": "user"}
  JSON
  pob2-run-log <runFolder> checkpoint - <<'JSON'
  {"checkpoint": "design", "concept": "r1-s-2", "visit": 2, "answer": "accept", "answeredBy": "user", "questions": 0, "scaling": true}
  JSON
  pob2-run-log <runFolder> answer-change - <<'JSON'
  {"checkpoint": "design", "visit": 2, "from": "accept", "to": "accept:file", "note": "Wait, I didn't say I wanted a guide"}
  JSON
  pob2-run-log <runFolder> stage - <<'JSON'
  {"stage": "W1", "concept": "r1-s-2", "attempt": 1, "outcome": "cancelled"}
  JSON
  pob2-run-log <runFolder> checkpoint - <<'JSON'
  {"checkpoint": "ask", "kind": "open-finding", "build": "r1-s-2", "visit": 2, "answer": "round", "answeredBy": "user"}
  JSON
  ```
- An entry with a field, stage name, outcome or answer outside this page's forms is refused, and nothing is
  written. The run checker checks the whole log and the flow it records.

## Amendment 14's entries

A log at 14 (§25, Appendix A's run log) takes these, each refused in an older log until a resume stamps it, and the run
checker holds a build to them only when its last D1 gate ran at or after 14's boundary (a card when the round that dealt
it did):

- **R1b's skeleton file** (D-479): R1b's last act on a damage pass writes `<card name> skeleton (draft).xml` through
  `compile_plan`'s draft mode and returns `skeleton: <relpath>`, logged on its entry as `skeletonFile` (a refused write
  returns `skeleton: none: <why>`, logged as `null`; a failed attempt returns no skeleton line and logs none). When a
  picked card's build gets its first design draft, the runner removes the skeleton (`compile_plan {plan_path, remove_draft}`)
  and logs `skeleton '{"concept"}'`, which sets `skeletonRemoved: true` on that card's last R1b entry with a file; it is
  refused for a card with no build (an unpicked card's skeleton stays) or one already removed. A skeleton the user changed
  isn't removed (the server refuses) and the verification display says so.
- **An answer change** (D-480): after the build's F1 passed on a design `accept` and before its W1's entry is logged,
  `answer-change '{"checkpoint": "design", "visit", "from": "accept", "to": "accept:file", "note"}'`, the user's words in
  `note`; kept in `answerChanges[]` with the build (`concept`) and `at`. A W1 already running is stopped and logged with
  the outcome `cancelled`, W1's only and only after an answer change for its build. The build then takes the file-only
  route: `V4-claims`, its fix round and re-check, then its notes. `pob2-render-audit <runFolder> --withdraw <id>` removes
  the build's `audit.md` and a partial `guide.md` and logs `withdrawals[] {build, files, at}` itself.
- **A step's `scope`** (D-481, D-486, D-487): `D1-finish`'s `swap` (a one-item swap: right after the design or final
  gate's `revise:`, then the D1 gate; each swap recorded in the plan's `itemSwaps[]`) or `scaling` (the late endgame
  scaling pass: right after a design `accept` or `accept:file` with `scaling: true`, or after the D1 gate's re-price pass
  that follows it, then F1), and `W1`'s `notes` (a file-only build's notes, after its claims pass or its re-check, which
  ends the build `file-only`).
- **A step's `requests`** (D-482), on R1b, D1-build, D1-tree, D1-finish, D2 or W1 when the brief carried the user's
  requests: `[{id, words, result}]`, `words` the user's text verbatim (for a read-back, `readback.json`'s changes),
  `result` `made` or `departs: <how>` from the step's `request:` lines. The words are in a checkpoint of the build (an
  answer, its changes or note, a new card's words), an answer change's note, or `readback.json`. After a return that
  departs, the runner asks the user before the next step and logs **the `ask` checkpoint**, `{"checkpoint": "ask",
  "kind": "departs", "build", "visit", "answer", "answeredBy"}`, the answer the user's words. After a re-check that leaves
  a finding needing a gear change open, it asks at once and logs `"kind": "open-finding"`, answered `round` (one more fix
  round and one more `V4-recheck`, at most once a build) or `ship` (the issue goes in the PoB notes). `visit` counts the
  ask checkpoints from 1; `pob2-run-log` adds `at`, the `stages[]` length when written. No display goes with an ask.
- **The scaling answer** (D-486): a design `accept` or `accept:file` carries `scaling: true` or `false`, the answer to
  "late endgame scaling, yes or no?"; a test config's design answer may carry it as an object, `{"answer": "accept",
  "scaling": true}` (default `false`).
- **D1-tree's `priceOutcomes`** (D-490): D1-tree makes no trade call; a log at 14 takes its count so one shows, and the
  run checker fails any non-zero count.
- An entry with a field, stage name, outcome or answer outside this page's forms is refused, and nothing is
  written. The run checker checks the whole log and the flow it records.

## A first write

The log before any agent runs (`skills/build-guide/SKILL.md` §1, step 3), as `init` writes it: the brief as parsed, no build yet, and
the pin's commit and the running leagues' digests as `pob2-run-log` reads them from the repository.

```json
{
  "schemaVersion": 4,
  "skillRevision": 16,
  "runFolder": "/abs/guides/titan-blood-hunt/2026-10-08-1",
  "slug": "titan-blood-hunt",
  "brief": { "ascendancy": "Titan", "skill": "Blood Hunt" },
  "status": "running",
  "mode": "offline",
  "testConfig": "accepted",
  "noNinja": false,
  "pinCommit": "<the pin's commit, from pob-pin.json>",
  "digest": ["<a running league's digest's file name, the latest start first>"],
  "dossier": null,
  "builds": [],
  "stages": [],
  "checkpoints": [],
  "displays": [],
  "escalations": [],
  "faults": [],
  "resumes": [],
  "pricing": { "stops": [], "retries": [] }
}
```

## Runs before amendment 11

A log without `skillRevision` is a run recorded before amendment 11 (§19), held to the rules it ran under; a log a
resume stamped holds its entries before 11's boundary in `skillRevisionFrom` to those rules, and an artifact written before the stamp is
read by its own format (the dossier by its header, a card's Pieces measured table by its columns). Such a run may
hold the rival (D-408, removed by D-443), which the scripts still read: its step `RV`, `done` when it wrote its card
`r<k>-x-<n>` or `none-found` with `tried`, what it tried in a sentence (only there), run once after the first
verification round's R1b-assemble (`RV done`, R1b for its card, a second R1b-assemble; or `RV none-found`) or at a
gate the user asked at; its card's R1b outside its round's cap of 3, and `not-dealt` (its card failed R1a-assemble's
identity or sniff check: `failed`, never finalized, with `compiles: 0`); and its dossier row. Its displays keep their
older forms. A run with `skillRevision` is dated amendment-8-or-later, as a run that ran the rival is: every round it
deals from its stamp on names each card's engine (D-405).

## Runs before amendment 12

A log at `skillRevision` 11 is a run recorded under amendment 11's rules, held to them throughout and to amendment 12's
nowhere; a log a resume stamped at 12 holds its entries before 12's boundary to their own rules, and an artifact written
before it is read by its own format: its `respec` routes (D-438), its two-figure verdict lines and labels, its design
fields without `maxHit` and its 7-field trades (`trades.json`, `skills/build-guide/references/run-folder.md`). A build is held to the rules of its last
D1 gate.

## Runs before amendment 13

A log at `skillRevision` 12 (or 11) is a run recorded under amendment 12's rules, held to amendment 13's nowhere; a log a
resume stamped at 13 holds its entries before 13's boundary to their own rules, and each build to the rules of its last
D1 gate (§22): a build whose last D1 gate is before 13's boundary keeps its PoB file `<slug>-<YYYY-MM-DD>-<n>-<card
id>`, its 9-field trades, its design field without amendment 13's additions, no claims pass after `accept:file`, and no
rule on runes over the budget, corruption, flasks or charms; a card dealt before the boundary takes no rune rule. Its brainstorm
displays keep their older form, and its builds no `draftFile` until a write after the stamp.

## Runs before amendment 14

A log at `skillRevision` 13 (or older) is a run recorded under amendment 13's rules, held to amendment 14's nowhere; a log
a resume stamped at 14 holds its entries before 14's boundary to their own rules, and each build to the rules of its last
D1 gate (§25): a build whose last D1 gate is before 14's boundary keeps its 11-field trades, its design field without
`summary` and its measurement display, its `-fallback` price entries, its rares' generated names, and no rule on the
words of advice to test in game, the listings, the specs, a bare `Corrupted` unique, the swaps or the guide's levels. Its
brainstorm and verification displays keep their older forms. The layout lists are the exception: `final-build.xml`,
`final-build-campaign.xml`, `readback.json`, `notes.txt` and `trade-links.json` in a build's folder, and `readback.json`
beside a skeleton's plan, pass at every revision, since the M-27 server writes them at every compile.

## Runs before revision 15

A log `init` wrote below `skillRevision` 15 records its top-level `digest` as one file name, the digest D-412's rule
chose then, or `null`, and keeps it; a resume after amendment 16's M-29 stamps 15 and records the running leagues'
list in its own `resumes[]` entry, and the run checker accepts each form where its revision puts it (D-507).

## Piece runs (revision 16)

A piece run is a piece started by its own command on what the user brings, `/pob2:compile`, `/pob2:pricing` or
`/pob2:writer`, in its own folder, `Guides/<piece>/<date>-<n>/` (`mcp__pob2__guide_run {new_run: "<piece>"}`, D-516,
C-61). Its first write is `pob2-run-log <runFolder> init` with `piece`, `mode`, `testConfig`, `noNinja`, `status`
(optional) and `source`, and no `slug` or `brief` (`init` refuses either, and a piece outside the three). The log:

```json
{"schemaVersion": 4, "skillRevision": 16, "piece": "compile", "runFolder": "<absolute>/compile/2026-12-01-1", "status": "running",
 "mode": "online", "testConfig": "none", "noNinja": false, "pinCommit": "…", "digest": ["forbidden-rites.md", "runes-of-aldur.md"],
 "source": {"kind": "builds-folder", "name": "Fixture Titan", "sha1": "…"},
 "stages": [], "checkpoints": [], "displays": [], "escalations": [], "faults": [], "resumes": [],
 "pricing": {"stops": [], "retries": []}}
```

- **`source`** is what the run started from, `{kind, name?, sha1?, build?}`: for compile and pricing a builds-folder file
  (`"builds-folder"`, `name` its name, `sha1` given at `init` when known: `source` is written only there, and
  `read.json` holds the file's sha1) or an import code (`"import-code"`, no name: the code itself goes only to the
  reader, never in the log); for the writer a run folder (`"run-folder"`, `name` relative to the guides
  root, `<slug>/<date>-<n>`, and `build`, its build's id when it has `builds/`).
- **Its steps** (Appendix A.6): compile `read`, `measure` and, with the better round, `place`, `D1-build`, `D1-tree`,
  `D1-finish`, `D1-gate` and `F1`; pricing `read` and `price`; the writer `W1`. `read` is `done` or `fail` (the reader
  refused the file), `measure` `done` or `fail`, `place` and `price` `done`; the four carry no `concept`, and `place` and
  `price` carry `priceOutcomes`. A file run (`/pob2:build-guide` from a PoB file, slug `file`) logs `read`, `measure` and
  `place` too. Any other step is refused.
- **The id `file`**: a compile run's and a file run's one build is `file` wherever a pipeline run names a card (a step's,
  a design checkpoint's and an escalation's `concept`, a file run's `builds[]` id, the gate verdicts
  `reports/gates/<stage>-file-a<n>.json`, the file card `cards/file.md`). A writer run's `W1` names its source's build,
  `source.build`, else `file`.
- **The scopes** `better` (the better round on a read plan, a compile run's or a file run's) and `ladder` (a file run's
  rungs around the placed one) go on D1-build, D1-tree, D1-finish and D1-gate.
- **Its files sit at the folder's root**, with no `builds/`, `dossier` or `builds[]`: compile's `source.xml`,
  `plan.json`, `read.json`, the measure's report (measure.md), `compile-record.json`, `compiled-build.xml`, `cards/file.md`, `pieces.md`,
  `trades.json`, `trade-links.json`, `reports/gates/`, `interviews/`, and F1's `final-build.xml` and `readback.json` in
  a better round (which Appendix A.6 leaves out); pricing's `source.xml`, `plan.json`,
  `read.json`, `compile-record.json`, `compiled-build.xml`, `prices.md` and `upgrades.json`; the writer's `guide.md`,
  `audit.md` and `notes.txt`. `pob2-render-audit <runFolder>` and `pob2-render-notes <runFolder>` take that root build
  with no `--build`. No `build` entry is written.
- **Gates**: only a compile run's better round has them, its design gate (`display design`, or `display design --build
  file`) and its escalation question, and an `ask` after a departure (D-482), each naming `file`; any other display or
  checkpoint is refused. Its design gate takes `accept`, `revise:<text>` or `stop`, its escalation no `verification`; an
  accepted D1 gate escalation carries `draftFile`, the draft the runner then wrote, since a compile run has no `builds[]`
  (D-521, a departure from Appendix A.6).
- **A pricing stop ends the run.** A piece run has no gate that asks to retry: a step whose `priceOutcomes` counts
  `rate_limited`, `locked_out` or `pace` records `pricing.stops[]` as above, and the runner asks for the rung first when
  none is placed, sets the status `stopped`, tells the user when the lockout ends, and stops. `/pob2:<piece> --resume
  <run folder>` after the lockout is the retry: `resume` clears the stop, and the step runs again. `pricing` is refused in
  a piece run.
- **The run checker** holds a piece run to the run's rules as they apply (its layout, its log), game knowledge's and its
  piece's (a compile run with a better round, pricing's too); it skips the slug-from-brief rule, the pipeline's lists and
  the pipeline's order (D-516, `RULE_PIECES` in `skills/build-guide/scripts/check-run.mjs`), but a compile run's better
  round keeps the D1 loop's order, D1-build to F1, its design gate taking `accept`, `revise:<text>` or `stop` (D-521).

## Runs before revision 16

A log at `skillRevision` 15 (or older) has none of revision 16's piece fields, steps, scopes or `file` id; a resume stamps
16 with its boundary and changes nothing else, since revision 16 adds only what a new piece run or file run writes.

## Schema 3: runs recorded before amendment 9

The run checker reads a `schemaVersion: 3` log, and `pob2-run-log` appends to one in its own form until `migrate`
rewrites it (D-415). Never start one. It differs from schema 4 in these fields: a run-level `roll` (the one
finalized card's identity, `null` until the verification gate's `pick:<id>`, one card) and `outputs` (`{plan,
record, dossier, guide, pobFile}`) in place of `builds[]` and `dossier`; no `noNinja`, `pinCommit`, `digest` or
`resumes[]`; its one build's files at the root; D1 as two steps, D1-build and D1-finish, with no `D1-tree`, `F1` or
`V4-campaign`; the design gate's `accept` going on to D2 and the D2 gate, its final compile the run's; checkpoints
with no `concept`; and a final-gate decline recorded as the user's note alone.

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
