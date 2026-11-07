# The run folder

Every run of the build-guide skill works inside one run folder, which the server creates. This page is
the layout, who writes each file, how the PoB file is named, and what the run checker holds a run folder
to (slice 03 §2 and FR-W7, as amendments 1, 3 and 9 to 13 change them; spine C-34, C-36, C-52; D-412, D-415, D-466).

## Creating it

After the brief check, the runner's first server write is `mcp__pob2__guide_run {new_run: <slug>}` (D-207,
D-216). It makes no engine call, and replies with three lines:

```
Created run folder <absolute path>
plan_path for this run: <slug>/<YYYY-MM-DD>-<n>/plan.json
loadedBuildUnsaved: true | false
```

- `runFolder` is the absolute path. Every step and every agent uses it; no agent needs the guides root.
- `runFolderRel` is `<slug>/<YYYY-MM-DD>-<n>`, the run folder relative to the guides root. A plan's
  `plan_path` for `mcp__pob2__compile_plan` and `mcp__pob2__guide_run {validate}` is
  `<runFolderRel>/builds/<id>/plan.json` for a build (`<runFolderRel>/plan.json` for a build migrated from
  schema 3, in `.`), `<runFolderRel>/concepts/<id>/plan.json` for a card's skeleton, or
  `<runFolderRel>/probes/<id>/<n>/plan.json` for one of its probes.
- `loadedBuildUnsaved` says whether the engine's loaded build has unsaved changes. The first compile
  replaces that build, so when it is `true` the runner asks the user first (D-210, `skills/build-guide/references/checkpoints.md`).

**The slug** comes from the brief (D-285), in lower case, with each run of characters outside `[a-z0-9]`
replaced by one `-` and no `-` at either end; the server takes at most 64 characters:

- the brief names an ascendancy and a skill: `<ascendancy>-<skill>` (Titan / Blood Hunt gives
  `titan-blood-hunt`);
- an ascendancy and no skill: `<ascendancy>-open` (`titan-open`);
- a skill and no ascendancy: `open-<skill>` (`open-blood-hunt`);
- neither: `open-<first playstyle tag>` (`open-minion`), or `open` for a brief with no playstyle tag.

The cards the user finalizes are recorded in the run log, not in the folder name. Each run gets a new dated
folder; only a resume writes into an earlier run's folder, its own (D-153 as D-415 amends it).

## Resuming it (D-415)

`/pob2:build-guide --resume <run folder>` (or `--campaign <run folder> <id>`) goes on with an earlier run in a later
session. The run folder is absolute, or relative to the guides root. The runner's first server call is
`mcp__pob2__guide_run {resume: <run folder>}`: like `new_run` it makes no engine call, and it writes nothing. It
checks that the folder is a run folder (two levels below the guides root) holding a `run-log.json`, and replies
with three lines:

```
Resuming run folder <absolute path>
runFolderRel: <slug>/<YYYY-MM-DD>-<n>
loadedBuildUnsaved: true | false
```

`runFolder`, `runFolderRel` and `loadedBuildUnsaved` are then as for a new run; the unsaved-build question is
asked once per resume (`skills/build-guide/references/checkpoints.md`).

## Layout and ownership

| Path in the run folder | Written by (only) | Content |
|---|---|---|
| `run-log.json` | the runner, through `skills/build-guide/scripts/run-log.mjs` (D-356) | the run log (`skills/build-guide/references/run-log.md`) |
| `research/p<k>-r1a-<n>.md` | R1a agent `n` of brainstorm round `k` | its sections, with source markers (`skills/game-knowledge/references/source-markers.md`) |
| `cards/<id>.md` | R1a (the brainstorm half; R1a-synthesize or R1a-assemble only to rename it), or R1a-synthesize for a composite `r<k>-s-<n>` (its brainstorm half, `### Pieces` included, D-429), then R1b (the verification half, with no figure, a composite's `### Pieces measured` answers included, D-433, D-436; after a gate's change; a card made at a gate whole) | a candidate card (`skills/build-guide/templates/card-template.md`, C-52); a card with `### Pieces` is a composite |
| `cards.md` | the R1a-synthesize step (the R1a-assemble step in a run whose first brainstorm round used it); R1b-assemble adds a gate-made card's line | the deck: its header, the obvious build, the composites by round, every card with the composites it fed, the pieces not used, the structures not composed and the superseded composites (D-429, D-432, `skills/build-guide/references/stages/R1a-synthesize.md`); in an R1a-assemble run, the dealt cards by round with their engines, "Not dealt" and "Found, not used" (D-287, D-392, D-405) |
| `interviews/<gate>-<visit>.md` | the runner, with Write and Edit, during the interview: after each answer, and the pending decision before a yes (D-420) | a gate visit's interview notes and its `## Pending decision` (D-389, `skills/build-guide/references/checkpoints.md`) |
| `interviews/<gate>-<visit>-q<n>.md`, `probes/q-<gate>-<visit>-<n>/` | a gate question step (Q) | its report, and a coordinator's measured variant (D-390, `skills/build-guide/references/stages/Q.md`) |
| `concepts/<id>/plan.json` | the R1b step for card `<id>` | an endgame skeleton plan (C-31) with its key-item prices |
| `concepts/<id>/compile-record.json`, `concepts/<id>/compiled-build.xml` | `mcp__pob2__compile_plan`, measure-only (D-208) | the skeleton's compile record (C-33) and compiled XML; from amendment 14, R1b's draft write copies the XML into the builds folder as the skeleton file, `<card name> skeleton (draft).xml` (D-479) |
| `concepts/<id>/readback.json` | `mcp__pob2__compile_plan {plan_path, read_back}` (D-479) | the differences between the skeleton file the user edited and the XML beside the plan, by loadout (Appendix A) |
| `probes/<id>/<n>/plan.json`, and its record and XML | the R1b step for card `<id>`; `mcp__pob2__compile_plan`, measure-only | a probe variant, one stage, `n` from 1 to 4, or to 8 on a composite (D-292, D-331, D-338, D-433) |
| `dossier.md` | the R1b-assemble step | the dossier, the verification gate's comparison table (slice 03 §7.2, D-355): each verified card's status, synergy, damage kinds, pieces, key prices, league and main risk, no figure (D-436) |
| `builds/<id>/` | the build's steps, one folder per finalized card (D-412) | everything that is one build's: the rows below |
| `builds/<id>/plan.json` | D1's three steps (D1-build, D1-tree, D1-finish) and D2; the D1 gate step only to apply FI-2 and the final re-price pass | the build's plan (C-31) |
| `builds/<id>/trades.json` | D1-tree (its `unmodelled` trades) and D1-finish (its `boots`, `defence` and `damage` trades), each replacing only its own kinds' entries (D-439) | the design's trades, `{"trades": [{stage, kind, what, ehpChange, damageChange, bossAfter, reason}]}` (amendment 11, Appendix A): what each measured option gains and costs, which the D1 gate reads into its design field and the design gate shows; outside the record's `buildSha1`; a build designed before amendment 11 has none. In a build held to amendment 12 (D-450, §22) D1-finish also writes its `avoidance` trades (on `b` and `n`), defence trades may be on `b` or `n`, and every entry carries `maxHit {type, before, after}` (a one-shot rung's defence and damage entries: the deciding row's Pinnacle-pass max hit) and `hitsSurvived {before, after}` (the defence and avoidance entries of a build that evades or deflects), `null` where they don't apply; a build held to 11 keeps the 7 fields. In a build held to amendment 13 (D-468, §22) D1-tree also writes a `boss` trade on a rung whose boss figure fell on its tree (the best tree it measured at or above the start's boss figure), which D1-finish keeps, and every entry carries `bossEntries [{label, before, after}]` and `nodes {remove: [ids], add: [ids]}`, `null` but on a boss trade: 11 fields, a boss trade with its `bossAfter`. In a build held to amendment 14 (D-486, §25) every entry also carries `price {amount, currency, count, date}` (or `null`), `from` and `to` (by unique name or base and affixes, or `null`): 14 fields; and the kind `scaling`, a find over the budget D1-build or D1-finish writes, has its own 11, `{stage, kind, slot, from, to, price, damage, ehp, measured, repriced, by}` (`damage` and `ehp` in percent, `by` the step that wrote it, each step replacing only its own), which the design gate's Over budget lines print |
| `builds/<id>/pieces.md` | D1-build (D-434); D1-tree its `## Jewel lines` only (D-453) | the build's pieces as designed: its Pieces table (the card's columns), each piece's status and reason, then `## Searched`, each synthesis question asked again and what it found; no round copy takes it |
| `builds/<id>/compile-record.json`, `builds/<id>/compiled-build.xml` | `mcp__pob2__compile_plan` | the record of the last compile of the build's plan; after its final compile (F1's, or the D2 gate's for its campaign) it names the PoB file and holds `importCode` |
| `builds/<id>/final-build.xml`, `builds/<id>/final-build-campaign.xml` | `mcp__pob2__compile_plan`'s final compile (D-479) | a copy of the bytes the final compile wrote (a campaign's, `final-build-campaign.xml`), the base a read-back of the final file compares with |
| `builds/<id>/readback.json` | `mcp__pob2__compile_plan {plan_path, read_back}` (D-479) | the differences between a draft or final file the user edited and the server's copy, by loadout, each with its name (Appendix A); a request's words may quote them (D-482) |
| `builds/<id>/notes.txt` | the runner, rendered by `pob2-render-notes --build <id>` from the guide (a guide build), or W1 with `scope: "notes"` (a file-only build) (D-487) | the PoB notes, plain text with PoB's colour codes, which `compile_plan {plan_path, notes_path}` writes into the final file's `<Notes>` |
| `builds/<id>/trade-links.json` | `mcp__pob2__compile_plan {plan_path, trade_links: true}`, F1's second call (D-488) | the weighted trade links, `[{stage, slot, url, ids}]`, one per rare slot and rare tree jewel of `b` and `n`; none in an offline run with no league |
| `builds/<id>/guide.md` | W1; the runner replaces its `Known issues` list each cycle (step 14, D-265) | the guide, the reader layer (slice 03 §8, D-276): the endgame guide, or the full guide once the build has its campaign (D-414) |
| `builds/<id>/audit.md` | the runner, rendered by `pob2-render-audit --build <id>` after the final compile (D-355); W1 adds the accepted gate findings' rows to its `Known issues`, and the runner fills that table each cycle (step 14) | the audit layer (slice 03 §7.8, D-278) |
| `builds/<id>/audit.md`, amendment 14 | the render adds, in a build held to 14, a Known issues row for each finding the last V4 report leaves unresolved (D-482); `pob2-render-audit --withdraw <id>` removes it, with a partial `guide.md`, after an answer change to the PoB file only, and logs `withdrawn` (D-480) | its Stage detail lists each rung's `tree.exclude` entries with their reasons (D-490), a plan from before schema 10 having none |
| `builds/<id>/reports/V4-<n>.md` | the verifier itself, one per pass, never overwritten (D-352) | the build's V4 full pass's, re-check's or campaign pass's report, or a file-only build's claims pass's (`V4-claims`, H1 `# V4-<n>: claims pass`, `check: claims`, D-477) (`skills/game-knowledge/references/source-markers.md`, `skills/build-guide/references/stages/V4.md`) |
| `builds/<id>/rounds/<n>/` | the run checker's `--snapshot <n> --build <id>`, which the runner runs before a fix round, a revision or a campaign (A-34) | the round copy: `plan.json`, `compile-record.json` and `guide.md` as they stood, which `--changed <n> --build <id>` compares with; a build with no guide (a file-only build's claims round, D-477) copies its plan and its record, and `--changed` then lists claims only; nobody reads it |
| `reports/gates/<stage>-<concept>-a<attempt>.json` | the gate step itself: R1b, D1-gate, F1 or D2-gate | its verdict (`skills/build-guide/references/gates.md`), at the run folder's root and keyed by the card id; R1b's adds its damage check, `verdict.damage`, and on a composite its leave-one-outs' drops, `pieces[]` (D-436, `skills/build-guide/references/stages/R1b.md`); F1's adds `draftLeft`, the draft it couldn't remove, or `null` (D-466) |

A run migrated from schema 3 (`pob2-run-log migrate`, D-415) keeps its one build at the root, as before amendment 9:
its `builds[]` entry has `folder: "."`, and its plan, record, guide, audit, V4 reports and round copies are the
root's. Every agent finds a build's files by its header's `buildFolder`, `builds/<id>` or `.`.

- Card ids are `r<round>-<researcher letter>-<n>` (`r1-a-2`): the runner letters the researchers `a`, `b` and `c`
  when it starts them, so parallel researchers never collide and ids stay unique across rounds (D-319); a card
  made at a gate is `r<k>-g-<n>` (D-391), and a composite R1a-synthesize writes `r<k>-s-<n>` (D-429). (A run
  resumed from before amendment 11 may hold its rival's card `r<k>-x-<n>`, D-408: the rival is removed, D-443, and
  only the scripts read it, `skills/build-guide/references/run-log.md`.) A card holding `### Pieces` is a composite, whatever its letter (D-433). A step's `concept`, a gate
  file's `<concept>` and `concepts/<id>/` use the card id. (Runs before amendment 3 used concept ids `c1`, `c2`, ….)
- `<stage>` in a gate file is `R1b`, `D1-gate`, `F1` or `D2-gate`; `<attempt>` counts from 1 per (stage,
  concept), as the header and the run log's `stages[]` do. A V4 report's `<n>` counts the build's V4 passes
  from 1, full pass, re-checks, campaign pass and claims pass alike, apart from the other builds' (D-412, D-477).
- Every V4 report is kept: a re-check, a revision's check or a campaign pass writes the build's next `<n>`, never
  over an earlier report.
- The layout lists admit amendment 14's files (`final-build.xml`, `final-build-campaign.xml`, `readback.json`, `notes.txt`,
  `trade-links.json`, and a skeleton's `readback.json`) at every revision, since the M-27 server writes them (§25).
- Nothing else goes in the run folder or a build's folder. No agent writes outside it (D-177), and agents
  running in parallel write different files (C-36).

## The PoB file

Only a build's final compile writes a PoB file into the builds folder, through the server (C-17, D-208): F1's for
an endgame-only build (D-413), or the D2 gate's once the build has its campaign. Its `build_name` is
`<slug>-<YYYY-MM-DD>-<n>-<id>`: the run folder's last two segments and the card id, joined with `-`, so every run
writes new files and two builds of one run never share one (D-113, D-199, D-412). A build migrated from schema 3,
in `.`, keeps `<slug>-<YYYY-MM-DD>-<n>`, with no card id: the run checker's PoB file name rule. **A campaign writes
its own file** (D-415): the D2 gate after a campaign compiles with the build's name and `-campaign`
(`<slug>-<YYYY-MM-DD>-<n>-<id>-campaign`, or `<slug>-<YYYY-MM-DD>-<n>-campaign` in `.`), and leaves the endgame file
F1 wrote as it was: the user has likely opened and saved that one in PoB by then, and a rewrite would meet the
write ledger's refusal every time. The build's `pobFile` is then the `-campaign` file. Every earlier compile, the
concept skeletons' and the D1 gate's included, is measure-only and writes only the record and the compiled XML
beside its plan.

**From amendment 13** (D-466, §22), a build whose last D1 gate is held to revision 13 names its files by its session
name, `builds[].name` when a revision renamed it, else its card's name, as the server cleans it: a trailing `.xml` gone,
each character Windows refuses (`< > : " / \ | ? *`) a space, runs of spaces one, leading spaces and trailing dots and
spaces gone, a Windows device name gaining ` (build)`; a name with nothing left is refused. F1's first write passes `first_free`: the final file is the first free of `<name>.xml`, `<name> <run
date>.xml` and `<name> <run date> <k>.xml` (k from 2; the run date the run folder's `<YYYY-MM-DD>`); a campaign's first
write, the D2 gate's, the same with ` (campaign)` after the date. A re-compile passes the recorded name, without
`first_free`. Names compare without case, and two builds never record one file. **The draft**: on a D1 gate pass that
leads to the design gate (and on an escalation's `accept`), `compile_plan`'s draft mode copies the gate's whole-plan
`compiled-build.xml` into the builds folder as `<name> (draft).xml`, or `<name> (draft <k>).xml` beside a draft the user
changed; the run log records it in `builds[].draftFile`, and F1 removes it after the final file is written, the server
backing it up first, or leaves it (`draftLeft`) when it changed on disk. After `stop`, a dropped build or an escalation's
stop, the draft stays.

A re-compile of the build (the fix round's or a revision's) rewrites its current file: F1's for an endgame-only
build, the `-campaign` file after its campaign. The
server's write ledger allows it only while the file is unchanged since this run wrote it; otherwise
`mcp__pob2__compile_plan` refuses, with C-17's changed-on-disk wording when someone edited the file (the user, in
PoB), or its "already exists" wording when the ledger has no entry for this run (D-211). A refusal is reported,
never worked around: F1 reports it as `ledger-refused` and escalates at once, since no retry changes it; the D2
gate reports it as a failed final compile (`final-compile`, `skills/build-guide/references/gates.md`).

## What the run checker checks

`pob2-check-run <runFolder>` checks what the folder holds, whatever
the run's status, and every build in its folder (D-412); when a guide exists, every guide check applies (amendment 1
§4.2). It uses Node built-ins,
the server's own compiled ledger evaluator, `build/plan/ledger.js`, and build projection,
`build/plan/buildHash.js` (D-266), and the audit render `skills/build-guide/scripts/render-audit.mjs` (D-355). Each violation is
one stderr line `check-run: [<rule>] <message>`.

- **The artifacts.** This layout. Every plan claim, the skeletons' and probes' included, has its `kind`, `hinge`
  or `reason` (D-351). The dossier is one H1, the `Brief:` line and one table with the comparison's eleven
  columns, clear speed among them (D-407; ten in a run from before amendment 8; twelve with `key pieces` in a run with
  composites, D-433), one row per card R1b verified,
  with no H2, H3 or marker; a failed or not-yet-finalizable card has `—` in its number, price and league cells
  (D-355). **In a run held to amendment 11** (`skillRevision`, §19): the dossier's nine columns, `Card`, `Round`,
  `Status`, `Synergy`, `Damage`, `Pieces`, `Key prices`, `League`, `Main risk`, no number among them; its Status
  `viable`, `viable, except <what>` (only with a piece its card's Pieces measured answers `no`), `failed after <N>
  attempts: …` or `can't be finalized yet: …`; a composite's Pieces measured `| Key | Left out by | Does something |`,
  `in` rows only, each answer held to its R1b verdict's `pieces[]` drops; an R1b attempt with a `damage-missing`
  finding a failure though it compiled (D-436); a build's `trades.json` in its shape (D-439). **In a build held to
  amendment 12** (its last D1 gate at or after 12's boundary, §22): `trades.json` in its 9 fields; a schema-8 plan's `n`
  with its defence plan, `defence {base, chance, mitigation, pool, physicalHit}` (D-451); the D1 gate's design field with
  `maxHit` on `b` and `n` (its deciding row and `oneShot` by `skills/build-guide/references/toughness-targets.json`'s floor of hits survived,
  0.8), `damage.resisting` on each rung, and on `n` `toughness`'s `chanceShare`, `conditioned`, `ailmentCut` and `warning`,
  each recomputed from the record while the gate is fresh (D-449, D-454); the record's Arbiter rows within Names' rule; a
  defence trade on a one-shot rung, a damage trade there that keeps its max hit, and an avoidance trade on `b` and `n` of
  an evasion build (D-450). **In a build held to amendment 13** (its last D1 gate at or after 13's boundary, §22): its
  PoB file named by its session name in one of the three forms (`<name>`, `<name> <date>`, `<name> <date> <k>`, a
  campaign's ending ` (campaign)`) and its `draftFile` in one of the two (`<name> (draft)`, `<name> (draft <k>)`), the
  name cleaned as the server cleans it (D-466; rule `layout`); `trades.json` in its 11 fields, a `boss` trade with its
  `bossAfter`, `bossEntries` and `nodes` (D-468; `trades`); the design field's `life`, `swapCap`, `rebuild`,
  `removedForOthers`, `levels` and the boss's `start`, `end`, `entries` and `bossFall`, equal to the plan's `tree.start`,
  `tree.end` and `tree.search` and each entry's final figure to the record's while the gate is fresh (`design-field`); a
  fall of the boss figure or an entry with its reason (`boss-fall`, its claim `boss-fall-<rung>` in the plan), a boss
  figure that fell with its boss trade (`trades`), `n`'s boss figure never taken under the floor by D1-tree from a start
  at or above it (`boss-floor`), and under the floor at the gate a damage or boss trade (D-448, D-468); no rune line of a
  "Legacy of …" soul core or the Raven-Touched Shard in its plan without the user's word (the brief's `around`, `like` or
  `notes`, or a gate answer's; rule `runes`, D-465); corruption only on a cheap unique on `b` and `n` (under
  `skills/build-guide/references/corruption.json`'s 1 divine, uncorrupted; an unpriced one's note `cheapness unchecked: <why>`, the offline
  note offline) and a `corrupt` gem, never a rare, magic or normal item, the guide naming each (`corruption`, D-471); a
  life flask in every endgame rung's `Flask 1`, no flask priced, no charm slot filled (`flasks`, D-472); a pinned
  weapon's Swap slot (`sameAs`) priced once by its set-1 slot's entry (D-464); and a file-only build's claims pass (D-477).
  A card dealt at or after 13's boundary takes no such rune in an `in` or `scheduled` Pieces row without the user's word
  (`runes`). **In a build held to amendment 14** (its last D1 gate at or after 14's boundary, §25): the design field's
  `summary {how, gear: [{stage, slot, text}], catch}`, within 400, 120 and 300 characters (`design-field`, D-478); each
  rare titled by its key affixes, every comma-separated part of its title naming one of its explicit lines (`rare-title`,
  D-489); no advice to test in game ("test … in game", "in-game test", "needs in-game testing") in its `guide.md`,
  `notes.txt` or plan claims (`test-advice`, D-489); no `-fallback` price entry (`budget`, D-483); a price entry's
  `listing {corrupted, sockets, count, position}` matching the compiled copy (its corruption the item's `Corrupted` line,
  its sockets at least the item's, a cheap unique priced uncorrupted saying so in its note; `listing`, D-484); a rare's
  `spec`, each must-have outside PoB's top 4 with its `why`, each of the top 4 left out in `leftOut` with its `why`, held
  to neither when `ranking` is `null`, each weight beside Full DPS and TotalEHP with its `why`, the must-haves most
  important first with one PoB scores at zero ahead of the others (the trade link requires the first three, D-488), at
  most 5 trade searches, and a spec only on a rare, gear or tree jewel, of `b` or `n` (`spec`, D-483); a bare `Corrupted` unique only when PoB's
  data marks it always corrupted, it has the extra socket, or it's cheap (`corruption`, D-484); each one-item swap
  (D1-finish, scope swap) since the last D1-build recorded in the plan's `itemSwaps[]`, a fall with its reason (`swap`,
  `boss-fall`, D-481), and on a rung whose `tree.end` reads `endAfter: "swap"` that reason standing in for a fall's boss
  trade and for the damage or boss trade an `n` under the floor needs; `rebuild: "none: <the tool's reason>"` accepted
  (D-490); the toughness warning `under` for an EHP under its band in every condition, `conditioned` only when the plain
  EHP is within or over it (D-494); a ledger claim's percent against its fraction (the value × 100, D-494); one level a
  rung in the guide's endgame sections, each character level named a rung's stage level and `gear from level <n>` a
  rung's gear requirement (`levels`, D-494); each step's request words in a checkpoint of the build or `readback.json`
  (`requests`, D-482); the late endgame scaling H2 only after an accept with `scaling: true` (D-486); `trades.json` in its
  14 fields, a `scaling` find in its 11 (D-486); and a file-only build's folder holding no `guide.md` or `audit.md`
  (D-480). The flow (D-480 to D-482, D-486, D-487): an answer change after F1's pass and before W1's entry, W1
  `cancelled` only after it; the claims pass, its round and re-check, then W1's notes (`scope: "notes"`), which end the
  file-only build; a swap right after a `revise:`; the scaling pass between the accept with `scaling: true` and F1; one
  more fix round and re-check only behind an `ask` checkpoint answered `round`, once a build; an `ask` of kind `departs`
  right after a return that departs, before the next step; and D1-tree with no price call. Every research marker
  resolves and parses as a C-30 tag. Offline, every price is `unavailable` and no step priced.
- **The reader layer** (D-276, D-283, D-414). The guide's template is its plan's: the endgame guide's 12 H2s
  for a plan with no campaign stage, at most 2,300 words, its `Switching over` naming each reward pick; else the
  full guide's 14 H2s in order, its Leveling H3s equal to the record's loadout names, at most 3,000 words. The
  build's `guide` in `builds[]` (`endgame` or `full`) is its plan's. Either guide has its `Checks` H3s and `What
  PoB can't show` ending with the H3 `Known issues`; its words count a word being a run of non-space characters holding a letter or a digit, the H1, the import code and
  the Known issues list not counted. No footnote marker (`[^`), confidence label (`confidence L`) or finding id
  (`v4-<n>-<k>`) anywhere outside the import code. The import code, the first fenced block of `Your PoB file`,
  equals the record's (D-205). One fixed-form verdict line per endgame rung in `Survival by stage`, each number
  equal to the record's value rounded at the written number's last significant digit ("2,740" matches 2,736):
  the level, the four resistances, the physical max hit and its hit, the least other max hit and the largest
  other hit (the hits the compiler wrote, the stage's `enemy<Type>Damage` in `configWritten`, D-353), and the
  damage: once the record measures both figures (D-437, D-447), `<Skill> about <map> DPS against map monsters,
  about <boss> against a Pinnacle boss.`, the map figure the record's `measures.damage.map` and the boss figure the
  `boss_<stage>` ledger value when the plan has one, else `measures.damage.boss`; a guide or record from before
  amendment 11, its one figure, the stage's `measures.dps`: the main group's figure × its Count, its minion's
  `MinionTotalDPS` when it names a minion skill (D-378). The budget and non-budget labels are the record's
  `measures.arbiter` verdict, in the template's words ("survives the Arbiter's hits", "one-shot by the Arbiter's
  <type> hit", "not measured against the Arbiter"); the entering-maps label stays solid, watch or risky (D-353).
  Amendment 12: once the record measures the resisting figure, the damage part has three, `<Skill> about <map> DPS
  against map monsters, about <resisting> against resisting rares, about <boss> against a Pinnacle boss.` (D-454); once
  its Arbiter rows carry hits survived, the label is the deciding row's in three forms, "survives the Arbiter's hits",
  "survives <x>% of the Arbiter's <type> hits, by evading or deflecting them" and "one-shot by the Arbiter's <type> hit
  (it survives <x>% of them)", read against the floor (D-459); and each stage whose record carries `treeChange` with a
  point refunded has one line, `Respec: refund <n> points and allocate <m>; respeccing costs gold.`, its counts the
  record's (D-452).
  Each rung's `Checks` block is its block in the render, copied verbatim (D-355). Every campaign reward choice
  the campaign passes is picked, the same pick on every stage after it, the endgame stages included, and the
  guide's `Campaign route and rewards` names each pick by its first line (D-265); a plan with no campaign stage
  carries the same pick on every rung for each reward choice the campaign offers, named in `Switching over`
  (D-413, D-414).
- **The audit layer** (D-278, D-355). `audit.md` beside a current guide, with its six H2s in order, equal to what
  `pob2-render-audit` renders from the current plan, final record and last D1 gate verdict file, `Known issues`
  aside.
- **The V4 reports** (D-352). One `reports/V4-<n>.md` in the build's folder per logged pass (`V4`, `V4-recheck`,
  `V4-campaign`, and amendment 13's `V4-claims`, whose report reads no guide: claims only, its findings the plan's,
  owned by D1, D-477), numbered in the build's run order from 1 and never overwritten, in `skills/build-guide/references/stages/V4.md`'s form: its H1 the pass's kind, its four fields, its
  `Checked` items and its findings (ids `v4-<n>-<k>`, fields in order, `reader` on each `unresolved` one, the
  verdict the log's outcome). A re-check of `rounds/<n-1>/` reports again every finding the report before it
  left open, and its `Checked` lists every item `--changed <n-1>` prints, as the files stood when it ran (the
  next round copy, or the run folder; the step-14 Known issues lines aside). An `accepted-offline` finding names
  a claim tagged external-unavailable in the plan as that report saw it: the round copy made after it, or the
  current plan when no step wrote it since.
- **Known issues, by sentence** (D-265, D-276). The open findings are the `unresolved` findings of the
  highest-numbered report of the guide. Each is under the guide's `Known issues` as its `reader` sentence, word
  for word, and in `audit.md`'s table as its row `| <id> | V4 | — | <reader> |`; every accepted gate finding has
  its row (code, gate, plan stage) and its sentence in the guide; no other line or row: no stale one from an
  earlier cycle, and `None.` only when nothing is open or accepted.
- **The final record.** V1 and V2 pass for every stage, accepted findings aside. `sha1(plan.json)` equals the
  record's `planSha1`, unless claims-only owners (`claims-edited`, D-264) edited the plan after the final
  compile: then the record must still be that compile's (final, its PoB file the one the build's last F1 or D2
  gate named),
  and the sha1 of the plan's build-affecting part (everything but `stages[].claims`, the `ledger`, the
  `source` and `tag` fields and each price's `note`, as the server's `build/plan/buildHash.js` computes it) must
  equal the record's `buildSha1` (D-266, D-352, D-386): a ledger-only or price-note edit passes, a gear edit fails. A record without `buildSha1` (from
  before D-266) is a violation only then. The decoded `importCode` matches the record's `pobFile` sha1, with one
  tree set per plan stage, titled by the record's loadout names (D-215). The ledger is the checker's (D-365):
  every entry's current formula evaluates over the record with the server's evaluator, that value and not the
  record's stored one is the entry's wherever the checker reads it, and a claim citing an entry states its
  value (at its last significant digit, or within 5%).
- **The D1 gate, recomputed** from the record and the plan (`skills/build-guide/references/gates.md`): the floor (at each rung's area
  level, 69 for entering maps, each reference hit the one the compiler wrote, D-254's formula rounded by D-256),
  the budget (every rung's total range at its price day and each `over-target` finding, by `skills/build-guide/references/gates.md`'s "Price
  days, targets and ranges", the anoint priced like a slot; it never fails, D-371) and the
  named damage source (the `rolledSkill` part), its figure's stat set equal to `skills.main.statSet`, and a
  group that names a minion skill compared by its minion's `Minion<Field>` (D-378); the `tree` part's shape and
  its agreement with its findings, which it can't recompute without the engine (D-419). The checker fails a
  verdict that differs from its own, and, once a guide exists, any failure no accepted finding covers.
- **The run log and the control flow** (`skills/build-guide/references/run-log.md`, schema 4): the fields and their values, `builds[]` in
  finalize order with each build's end, the stage names `R1a-synthesize` (a run keeps the brainstorm step its first round used, D-429), `D1-build`,
  `D1-tree`, `D1-finish`, `F1`, `V4`, `V4-recheck`, `V4-campaign` and `V4-claims` (`RV` only in an older run's entries,
  before amendment 11 removed the rival, D-443); `skillRevision` (11, 12 or 13, compared by order, each revision's rules
  from its own boundary in `skillRevisionFrom`; no D1-tree `respec` from 12's on, D-452) and the pricing stops and
  retries (D-444; the stop `pace`, D-474); D1-tree's `stale-server` followed by D1-tree again (D-467); a file-only build
  held to 13 through F1's pass, `V4-claims`, on a failure its round (the round copy, D1 alone, the D1 gate and F1 after
  a recompile, no design gate) and one `V4-recheck`, then its end (D-477); a brainstorm display's `numbers` naming cards
  of the run (D-475); steps in a legal order per build, each gate visit's answer followed (D-411): the
  queued cards designed in turn; in the design, D1-build, D1-tree, D1-finish, the D1 gate, then the design gate;
  F1 only after a `design` visit answered `accept` or `accept:file` (D-362, D-413), a `revise:` running D1 again,
  its gate and the design gate, and `verification` the verification gate; D2 only for a campaign; entries after a
  build's or the run's end only behind a resume, placed by its `resumes[]` entry's lengths (D-415); a refused step
  re-run next, alone (D-421); each gate attempt routed as its verdict file says; R1b
  at most 3 counted attempts and each gate at most 2 counted retries (S6 honoured: only an attempt-1 failure the
  verdict's `faultsApplied` explains is free); one full V4 pass per guide, and at most one re-check per fix
  round or revision, covering only what `pob2-check-run --changed <n>` lists (D-352); a revision checked by a
  re-check, never a full pass; a claims-only owner only before any gate of its round and never directly before
  a gate (a claims-only D1 may be followed by a D2 that recompiles, and its D2 gate); escalations only from the
  gates, each naming its verdict file; a `rule` on every pre-supplied or default answer; each gate visit's
  display in `displays[]` before its answer (D-367); the run's `completed` only when a build ended `completed`
  or `file-only` (checkpoint 2's accept, in a schema-2 log, whose D1 stays one step); and no `rate_limited` or
  `locked_out` price outcome (NFR-22).
- **What is current.** The runner can't delete files, so the log says which artifacts are current: a build's
  guide is when no design step of its card ran after its W1, and its final record when no producer that
  recompiled ran after its last F1 or D2 gate (a claims-only D1 or D2 leaves it current).
  A guide, V4 reports or a record from an earlier cycle or concept aren't held to the current plan.
