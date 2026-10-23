# Amendment 10: one build from the whole brainstorm

**Status: DRAFT, revision 1, 2026-10-23.** The user took the first draft's five choices on 2026-10-23 (§15, 1 to 5);
an independent review found 5 blockers, 17 should-fix findings and 9 nits, all resolved here (§16); two new choices
(§15, 6 and 7) wait for the user, then the reviewer's re-check. It carries:
- the user's direction after the live test (WU-99): the brainstorm's ideas are synthesized into builds, not dealt
  as independent cards of which all but one are dropped;
- the user's two choices the same day: **composites drawing on all cards** (one composite per compatible structure,
  borrowing transferable ideas from every card), and **M-22 built now, in parallel** with this amendment's review;
- the lessons of the live test's comparison study (`../studies/2026-10-23-spud-warcryer-comparison.md`, cited as
  [study]), its §9 measuring the reference build's PoB file in our engine, and the run's own findings (work-log
  2026-10-23).

It is written against spec v1.6, amendment 8 (built as M-20), and amendment 9: M-21 built and merged at `9efb779`;
M-22 (§17 and §24) building on branch `build-guide/m22`, whose §24 as revised there (`77bd695`: the user's damage-order
rule, the ailment-conversion entry, the library's cap at 13,000) is binding and reaches `main` with M-22's merge.
Paths are from the repository root, except stage files (`R1a.md` and so on), which are under
`.claude/skills/build-guide/references/stages/`. Decisions continue from D-429, work units from WU-104, criteria from
AC-W83 and AC-P77; no contract or PoB gap is added; the milestone is M-23. Each decision ends with the rows and rules
it amends. Appendix A fixes the formats.

**Names.**
- A **piece** is one mechanism a researcher confirmed in game text: a skill, a support, a unique, a rare's mod line, a
  node, a keystone, a rune, a mechanic or config condition. It does one job for a build: a damage layer, a scaler of
  another piece, a supply, a way around a limit, a defence, a boss answer. Each piece has a **key** (Appendix A).
- A **structure** is a card's identity, `{className, ascendancy, named damage source}` (D-286); when the brief fixes
  that identity, a structure is an engine instead (D-429).
- A **composite** is one candidate build per structure, composed from every compatible piece the brainstorm found,
  on that structure's cards and on any other card or research file. Its card, `cards/r<k>-s-<n>.md`, is a card
  like any other (C-52) with a **Pieces** table and a **Pieces measured** table.
- A **layer** is one way the build's buttons deal damage: the hit, an ailment, an explosion, a detonation, a second
  skill. A **limit** is what caps the build's rate or uptime (mana per cry, a cooldown, a charge count).
- A piece is **in**, **scheduled** (on a second button, a second weapon set or a boss setup, so it doesn't fight
  another piece) or **out** (with why).

## 1. The user's direction

> I've been thinking all this time that having multiple independent cards is not how a human build designer would
> work. They'd be doing the same brainstorm process, but synthesizing it into one build, not dropping all but one
> idea. (2026-10-23)

On the shape, the user weighed composites against keeping the cards and merging at design, with the gut feeling
that "even if some of the cards are for different structures, there may be ideas there that can be used as
inspiration". Composites drawing on all cards keeps that point (the synthesis reads every card, any structure) and
moves it before verification, so the user sees and steers the composite, and R1b measures what will be built.

## 2. What the live test showed

From [study] (§1, §6, §9):
- **The run found the core** a skilled designer found for warcries as a main skill: Warcaller's Bellow spam, Avatar
  of Fire, a cheap wand in the slot the cry doesn't read, the shield's block as fire, armour break.
- **It stopped there.** The reference build carries six damage layers to ours two (ignite, bleeding as fire through
  Blistering Bond, a second corpse explosion from Deidbell, Battershout's armour detonation), removes the limit our
  guide names as its main con (mana, by Blood Magic and life per kill), and has a boss setup on its own weapon set.
- **Measured in our engine** (its PoB file, [study] §9): Avatar of Fire carries half its Full DPS and Xoph's Blood a
  fifth; the corpse explosions out-damage the cry; the ailments are 11% of the fast cry's damage and half of Shield
  Wall's, its big slow boss hit, where Blistering Bond alone is worth 21%. A piece's worth shows only on the skill it
  pays on.
- **The deck held his pieces on separate cards.** Deidbell's explosion was "Triple Corpse Bellow", not dealt as a
  duplicate; Hammer of the Gods for bosses was "Seismic Hammerfall", dealt and not picked; Rage was on the Titan and
  Shaman cards; Battershout was on r1-b-3's own card, ruled out as a payoff thief.
- **The design judged pieces alone** against its structure (Deidbell by its area line, ignite at 0.8% of DPS once
  Elemental Focus forbade ailments, Zerphi's Infamy because the build spends mana), and **asked no lens again** after
  Avatar of Fire entered at the gate: four searches on mana sustain, none on fire payoffs or life costs.
- **The tree step had no part** (D-418 worked: one swap, the engine's keystone kept as a need).
- **Avatar of Fire:** the user's gate ruling that gained cold and lightning convert first was wrong; PoB is right
  (amendment 9 §24.1). r1-b-3's custom modifiers overstate its damage by about a quarter; it was a test, so the
  work-log notes it and nothing re-runs.

Smaller findings from the run: the clear group's number, V4's stray report line, `audit.md`'s stale title, the
checker against a stale server build, and the telemetry's background summaries (§10).

## 3. What already fits

- **Cards made at a gate** (D-391): a card `r<k>-g-<n>` made from named cards (`from`), which the run log, the
  checker and R1b already handle. A composite is the same idea done by the coordinator before the gate.
- **The deck's checks** (`R1a-assemble.md` steps 2, 3 and 7): the identity check and the ascendancy lock (D-342),
  the sniff test (D-287), unique names (D-392). They stay, cited by the synthesis and by R1b for the rival's card.
- **R1b's probes** (D-292, D-338, `probes/<id>/<p>/`): a probe compile is how a composite's pieces are measured
  inside it. Each leave-one-out in [study] §9 was a reload and one change through tools the server already has.
- **The record's `countedSkillOutputs`** (`pob-api/API/Compile.lua:1455-1469`): every group's figures, so a layer on
  another group can be measured without changing PoB's Full DPS (D-337).
- **Roles:** `single_target` already exists for a boss button, and the named-source check compares within a role.
- **Weapon sets** (D-426, M-22): a second set is one way to schedule a conflict, as the reference build puts Hammer of
  the Gods on set 2's own 24-point tree.

## 4. D-429: composites, drawing on all cards

The brainstorm round still runs three researchers, foci `mechanics`, `items` and `tree`, 3 cards each (D-287). Its
coordinator step changes from dealing cards to composing builds: `R1a-synthesize.md`, a new stage file, replaces
`R1a-assemble.md` for new runs (Appendix A has its interface).

- **Structures.** The round's cards, every earlier round's cards and the gate-made cards are grouped by structure,
  `{className, ascendancy, named damage source}`. **When the brief fixes that identity** (a fixed roll, or a brief
  naming ascendancy and skill), every card shares it, so structures are keyed by engine instead, `<consumed> from
  <supply>` in `data/rules/vocabulary.md`'s words (D-405), so a fixed roll still yields alternatives (choice 6). A
  card that fails its identity check or the ascendancy lock is out, as today; its confirmed pieces stay in the pool.
- **One composite per structure, 1 to 4 a round.** When structures, with splits, number more than 4, keep those whose
  cards confirm the most load-bearing links, summed over the structure's cards (ties: the lower first card id); the
  rest go under `## Not composed`. The composite starts from its structure's strongest card (the one whose links
  table confirms most; ties: the lower id) and takes every piece of the pool that fits it: the structure's other
  cards, the other structures' cards, the obvious card, and the research files' Ideas (D-430). Each piece is in,
  scheduled or out with its reason, by the synthesis questions (D-431).
- **A conflict that can't be scheduled splits** a structure into two composites, one per side ("mana engine" and
  "life engine"), each taking a slot within the 4.
- **The round's rule** (amends D-287's 6–9 and NFR-23's count): 1 to 4 composites. The round is short, with a
  `shortReason` as today (D-339), when it composes fewer than 2, or when no composite takes a piece its researcher
  judged under-played.
- **The obvious card** (D-403) stays: written as today and shown at the gate as the baseline, one line, not a
  composite. It is judged as written, before any borrowing, so the composite of its own structure says how it beats
  the card it grew from; its pieces join the pool.
- **The researchers' cards stay visible:** `cards.md`'s `## Cards` lists each, the seed card (D-393) marked, and the
  composite each fed. A plain card can still be verified on the user's request; it keeps the checklist's 4 probes and
  has no Pieces tables.
- **Under-played** (D-339): the label moves to the composite that takes the piece.
- **The engine rule** (D-405, at most half a round on one engine) is dropped for composites: they differ by structure
  or by the side of a split.
- **A later round** (brainstorm more, with the user's note) adds cards and Ideas to the pool; only structures that
  gained pieces are recomposed. A composite shown at a gate is never edited in place: its successor gets a new id
  and a new name (D-392), and the old one is listed under `## Superseded`, still pickable. A verified or built
  composite is never superseded; a recomposition of its structure is a separate card.
- **The rival** (D-408) writes a plain card, verified with the checklist's probes. "A structure that differs from
  every row in the dossier" reads the composites' rows. Its card's pieces join the next round's pool.
- **Old runs:** the run log stays schema 4, gaining the stage name `R1a-synthesize`. A run whose first brainstorm
  round used `R1a-assemble` keeps it for every later round; `R1a-assemble.md` stays for those runs.

Amends D-287 (the coordinator step and its count), D-319 (the id letter `s`), D-339 (the under-played rule's unit and
the short round), D-403 (the obvious card as a baseline line), D-405 (the engine as a fixed brief's structure key,
otherwise dropped), D-408 (the rival against composites), NFR-23 (1–4 composites a round) and C-52 (the composite's
card).

## 5. D-430: the research file's Ideas

Each research file gains `## Ideas`, after its focus's sections and before `## Sources`: one line per piece the
researcher confirmed, used on its cards or not, at most 25, in the form Appendix A gives. Lines its cards use come
first, then the widest spread of roles. A later round's researcher writes only pieces the earlier rounds' Ideas lack
(Grep their `## Ideas`). The supply search's suppliers (D-404) are among them. Ideas are the synthesis's pool, so a
piece no card uses can reach a build; the synthesis treats a line's lookup as its confirmation and runs a lookup
again only for a load-bearing link that has none.

Amends R1a's research-file format (slice 03's research file, `03-pipeline.md` R1a's writes) and D-404 (its suppliers
listed as Ideas too).

## 6. D-431: the synthesis questions

The library's brainstorm questions gain four, asked by the synthesis of each composite, by D1-build of the design,
and by the rival:

16. **Breadth.** What else can this button cause? Each layer its hits can start: ailments, explosions, detonations, a
    skill it triggers, a second warcry. Search each layer's payoff by its damage type after conversion, and weigh it
    by the hit that starts it: an ailment pays on a big, slow hit more than on a fast one ("Convert into the ailment's
    type").
17. **The limit.** What caps this build's rate or uptime, and what removes the cap rather than feeding it? A cost
    moved to another pool, a refund, a cooldown ignored.
18. **Conflicts.** Which pieces fight (one consumes what another needs)? Schedule the conflict before leaving a piece
    out: a clear button and a boss button, a second weapon set; or drop the piece the other side needs, if it is
    worth less (the reference build's character takes Jade Heritage in place of Imploding Impacts, so Battershout
    competes with nothing, [study] §6.2).
19. **Bosses.** When the clear skill is capped by a limit or shaped for packs, what is the boss button?

Two entries change:
- **Cost redirection:** its Search also starts from a resource that caps the build's rate (mana per cast), not only
  from scaling keyed to a full pool.
- **Payoff thief (anti-pattern):** before a thief rules a piece out, try scheduling it on another button or set, or
  weigh it against the piece it robs.

"Convert into the ailment's type" and the damage-order rule are M-22's (amendment 9 §24.1, WU-103), as is the
library's 13,000-word cap, which these four questions and two entries fit within. Amends the library (C-53).

## 7. D-432: the deck and the brainstorm gate

`cards.md` is rewritten for composites, its H2s in Appendix A's order: what the composites share, how they differ,
the obvious build, the round's composites, the cards, pieces not used, not composed, superseded. "How they differ"
stays one paragraph (D-392, D-424). `## Pieces not used` holds at most 10 lines, the strongest first.

The display (`display brainstorm`) shows the brief, then each composite: its line, then its pieces in short (in,
scheduled, out; each out piece's reason in a few words), then the obvious build's line and the cards' count. The
answers stay (D-391, D-411): **verify** 1–3 composites or cards, picked or made at the gate; `changes` on a picked
composite may add or drop pieces by name or key ("add Blood Magic", "drop i1b-4"); **brainstorm more**; **stop**. A
gate-made card's `from` may name cards, composites and piece keys (a Pieces row's or an Ideas line's); one that draws
on pieces is a composite, with Pieces tables and leave-one-out probes.

Amends the brainstorm gate (`checkpoints.md`), D-391 (`from` may name pieces) and the deck's format (C-52).

## 8. D-433: R1b measures each piece inside its composite

- **The tables.** The synthesis writes the composite's `### Pieces` in its brainstorm half; R1b writes `### Pieces
  measured` in its verification half (Appendix A). The card template gains both H3s (amends its fixed heading list).
- **The skeleton** carries every piece in, a scheduled piece in its own group: a boss button with role
  `single_target`; a piece on weapon set 2 in a group on set 2, through the plan field M-22's WU-101 provides for it,
  measured with set 2 active. A second clear group keeps role `clear` and stays below the named source (the
  `rolled-not-largest` check, as today); when it is larger, the synthesis named the wrong source, and the composite is
  recomposed around it.
- **The measure** is the composite's total: the named source's Count-scaled figure plus each damaging group's figure
  from the record's `countedSkillOutputs`, PoB's own groups (a corpse explosion) included. PoB's Full DPS still counts
  the named source only (D-337). A leave-one-out reports the drop in the total and in each damaging group, since a
  piece may pay on one skill and not another ([study] §9: Blistering Bond, 2% of the total and 21% of the boss skill).
- **Leaving a piece out,** by kind: a support, removed from its group; a skill, its group disabled; a unique, the
  slot's plain base of the same base type; a rare's mod line, removed from the item; a node, removed with every node
  that depends on it (other pieces among them named in `How`); a keystone, removed with every custom modifier that
  stands for its mechanic; a rune, removed from the item; a config condition, turned off.
- **Which pieces:** up to 4 pieces in, neither the named damage source nor its enabler, the least certain value first:
  a custom modifier, a layer on another group, an ailment's carrier, then the rest by the synthesis's own order.
- **A piece PoB doesn't model** (Battershout's detonation shows no DPS) is measured by the card's hand estimate,
  marked `estimate (<reason>)`, never a ledger entry: a skeleton has no ledger.
- **The budget:** a composite's probe cap is 8: the checklist's 4 (dead slots, the condition on and off, the
  encounter mods, the skill shape) and the 4 leave-one-out probes. A plain card keeps 4. Amends D-292, D-338, the
  checker's `PROBE_CAP` and `run-log.md`'s cap.
- **The dossier** (R1b-assemble) gains a twelfth column, `key pieces`: each measured piece and its drop in the total,
  from the card's Pieces measured.

Amends R1b (its probes and order), D-292, D-338, R1b-assemble and the dossier template (D-407's column list).

## 9. D-434: the design keeps synthesizing

D1-build reads the composite's Pieces tables and the deck's `## Pieces not used`, and:
- **asks the synthesis questions again** whenever the design adds a conversion or a keystone, or would name a limit
  as a con (questions 15–19 and the type-conversion entry);
- **revisits an out piece** whose reason the design changed (Zerphi's Infamy after costs move to life);
- **judges a piece with the pieces it needs,** measuring a set together, on the composite's total and each damaging
  group (D-433's measure), before rejecting any of them;
- **schedules before rejecting** (question 18), a second weapon set included (D-426);
- **answers question 19** on every build whose clear skill is limited or pack-shaped: a boss button, or why none is
  needed.

It writes `<buildFolder>/pieces.md` (Appendix A): the Pieces table as designed, each piece's status and reason, and
`## Searched`, each question it asked again and what the search found. Its return keeps its 8 lines and adds one,
`pieces: <n> in, <n> scheduled, <n> out`. D1-finish writes a `reason` claim for each scheduled piece and each
composite piece left out, from `pieces.md`, so W1 can explain the boss button and the swap; the `left out:` lines
(D-396) stay for dead gems.

A node that a custom modifier depends on (the keystone whose conversion the modifier stands for) is a need (D-418),
so node power's swaps never drop it while the modifier stays.

The D1 gate's `design` field gains `pieces {in, scheduled, out, scheduledNames, outNames}` for the build (pieces
belong to the build, not a rung), read from `pieces.md`, and the design display prints `- Pieces: <n> in, <n>
scheduled (<names>), <n> out (<names>)` once, before the rungs.

Amends D1-build (D-375, D-418's needs list), D1-finish (its claims), the D1 gate's design field and the design display
(D-419).

## 10. D-435: the live test's fixes

- **The clear group** (C-55, D-418, D-419). C-55 defines `clear_group` as the plan's group number, as the record
  numbers it, but the bridge reads it as PoB's socket-group index, where item- and ascendancy-granted skills come
  first: on r1-b-3, plan group 1 (Seismic Cry) was PoB's group 3. `get_node_power` maps `clear_group` from the plan's
  numbering with `Compile.lua`'s `group_indices` logic at call time, as C-55 already states: a defect fix, no record
  change and no new contract. D1-tree and the D1 gate keep passing the record's number.
- **V4's report:** a stray `- ` line in the verifier's own report failed the checker. The verifier keeps no Edit
  (R-5): V4 checks its report's list syntax before its one Write, and the checker ignores an empty list item in a V4
  report.
- **`audit.md`'s title:** `run-log.mjs build` takes `name` when the card is queued: the card's name, or the name its
  finalize revision gives the build. `render-audit.mjs` titles the audit with `builds[].name`, else the card's H1, so
  F1's render and the checker's re-render agree. Amends D-392: a build may carry the name its finalize revision gave
  it; the card keeps its own.
- **The checker against a stale build:** `check-run.mjs`'s result gains a `warnings` list, which `display final`
  prints. When `build/plan/ledger.js` or `build/plan/buildHash.js` is older than its source under `src/plan/`, it warns
  that a `record-plan` or ledger violation may come from the stale build; the violations stay.
- **Background summaries:** the resumed session's telemetry holds 130 `agent_summary` requests, 29.6M cache read the
  transcripts don't show. `run-usage.mjs` already prints a row per `query_source`; it gains the cache read in each
  row. WU-108 looks for a Claude Code setting that turns the summaries off for runs: a line in
  `docs/build-guide/run-settings.example.json` if one exists, else a work-log note saying none was found.

Amends C-55's implementation (not its text), D-392, R-5's V4 practice (not its rule), `render-audit.mjs` (D-355), the
checker, and `run-usage.mjs` (D-357).

## 11. Costs

Baseline, the open-clear run's first session (output tokens, the usage script's estimates): R1a 371K for three
researchers, R1a-assemble 42K, R1b about 105K a card with its share of R1b-assemble, RV 83K; the shared phases were
about 1.1M (amendment 9 §10). Estimated changes, for a run that verifies two composites:
- the Ideas tables: about +10% on R1a, +35K;
- the synthesis: about 110K, against R1a-assemble's 42K, +68K, its lookups bounded (D-430);
- R1b on a composite: 4 more probe compiles and the Pieces measured, about +30K a composite, +60K for two;
- D1-build: about +20K a build (questions asked again, sets measured, `pieces.md`).

About +163K on the shared phases, so about 1.26M against D-416's 1.2M target (choice 7). Fewer, better candidates are
where a saving can come from: two composites verified in place of three thin cards is about −100K.

## 12. Work units (M-23, after M-22 merges)

| Unit | What |
|---|---|
| WU-104 | `R1a.md` (the Ideas, D-430); the new `R1a-synthesize.md` (D-429, Appendix A's interface and deck); the card template's two H3s and the id letter; `references/stages/README.md`, `references/task-header.md` (the stage, `changes.from`, `writes`), `references/run-folder.md`; the researcher's and coordinator's definitions (their descriptions and the stage table, with the pinned assertions in `tests/static/buildGuidePipeline.test.ts`) |
| WU-105 | `run-log.mjs` (the stage, the `s` letter, the brainstorm display, `from` keys, `build`'s `name`); `check-run.mjs` (the deck rules for composites and `## Cards`, the round's count and short rule, the Pieces tables, the probe cap 8, the dossier's twelfth column, the mixed-run rule, the empty V4 item, `warnings`); `render-audit.mjs` (the title, the `s` letter); `scripts/run-usage.mjs` (the `s` letter, cache read per source); `tests/fixtures/pipeline/`; `references/run-log.md`; `references/offline-and-test.md` (`first-n` picks composites) |
| WU-106 | `R1b.md` (the composite's skeleton, the measure, leaving out by kind, the probe order and cap), `R1b-assemble.md` and the dossier template, `references/checkpoints.md` (the brainstorm gate), `SKILL.md` (steps 2b and 2c, the names) |
| WU-107 | `D1-build.md` (D-434, `pieces.md`), `D1-finish.md` (the pieces' claims), `D1-gate.md` (the design field's `pieces`), `RV.md` (questions 16–19, the rival under composites), `references/patterns.md` (questions 16–19, the two entries) |
| WU-108 | `get_node_power`'s `clear_group` mapping (`pob-api/API/NodePower.lua`, `src/handlers/treeHandlers.ts`); `V4.md`'s syntax check; the background-summary investigation |
| WU-109 | The live test: a run with an open brief and one with a fixed roll, the user's, with the coordinator |

Order: WU-104, WU-105 and WU-108 in parallel, the formats fixed by Appendix A; then WU-106 and WU-107; then WU-109.

## 13. Acceptance criteria (M-23)

- **AC-W83 (WU-104).** Static: `R1a.md` asks for `## Ideas` in Appendix A's form, at most 25 lines, a later round's
  only new; `R1a-synthesize.md` keys structures by identity, or by engine under a fixed identity, composes 1–4
  composites from every card and the Ideas, applies the tie-break, splits an unschedulable conflict, keeps the
  obvious card as a baseline judged as written, lists the cards, recomposes only gained structures under new ids and
  names, never supersedes a verified or built composite, cites `R1a-assemble.md`'s identity, lock, sniff and name
  steps, and writes Appendix A's deck; the card template has `### Pieces` and `### Pieces measured`; the task header,
  stage README and definitions name `R1a-synthesize`.
- **AC-W84 (WU-105).** Script unit, on fixture runs:
  - a run with `R1a-synthesize` and composites `r1-s-1` and `r1-s-2` passes; a third round of five composites fails;
  - a round of one composite without a `shortReason` fails; a fixed-roll fixture with two engine composites passes;
  - a composite without its Pieces tables fails; a Pieces row `out` with no reason fails; `## Cards` missing a
    researcher card fails;
  - a `from` naming a Pieces key or an Ideas id passes; one naming neither, nor a card, fails;
  - a composite with 8 probes passes and 9 fails; a plain card with 5 fails;
  - a schema-4 run with `R1a-assemble` passes, and one mixing `R1a-assemble` and `R1a-synthesize` rounds fails;
  - the dossier's twelve columns pass and eleven fail on a composite run;
  - a V4 report with an empty list item passes; `build` accepts `name`, and the re-rendered audit's title matches it;
  - the checker warns, and still reports the violation, when a fixture's `build/plan/buildHash.js` is older than its
    source;
  - the brainstorm display lists each composite's pieces; `run-usage.mjs` prints cache read per `query_source`.
- **AC-W85 (WU-106).** Static: `R1b.md` builds the composite's skeleton with scheduled pieces in their own groups,
  measures the total and each damaging group, leaves pieces out by kind, holds the probe order and the cap of 8,
  and marks an unmodelled piece's figure an estimate; the dossier template has `key pieces`; `checkpoints.md` shows
  composites and accepts piece changes and piece keys in `from`; `SKILL.md` names `R1a-synthesize`.
- **AC-W86 (WU-107).** Static: `D1-build.md` asks questions 15–19 again after a conversion, a keystone or a limit,
  revisits out pieces, measures sets on the total and each group, schedules before rejecting, answers question 19,
  writes `pieces.md` with `## Searched`, returns the `pieces:` line, and lists a custom modifier's nodes as needs;
  `D1-finish.md` writes the pieces' claims; `D1-gate.md` writes the design field's `pieces`; `RV.md` asks 11–19 and
  places the rival under composites; `patterns.md` holds questions 16–19 and the two amended entries, under its cap.
- **AC-P77 (WU-108).** Engine, on a fixture build whose weapon grants a skill: `get_node_power` called with the
  record's group number for the clear group guards that group's skill (its radius and uses per second), not the
  granted skill's.
- **AC-W87 (WU-108).** Static: `V4.md` checks its report's list syntax before its Write; the work-log or
  `run-settings.example.json` records the background-summary finding.
- **AC-W88 (WU-109).** The live test: the user's judgment of the composites and the finished build, recorded in the
  work-log.

## 14. Risks

- **A composite can sprawl:** every piece in makes a skeleton PoB measures poorly and a guide too long. The
  leave-one-out probes and the out reasons keep it honest; the gate lets the user drop pieces.
- **Fewer, bigger candidates** narrow the user's choice; the split rule, the engine key under a fixed identity and the
  cap of 4 keep alternatives where they are real; the cards stay visible and verifiable.
- **The synthesis reads every card** (about 9 brainstorm halves of 400 words and three Ideas tables a round) and runs
  few lookups (D-430); a later round adds to it. Its peak should stay under D-357's 150K-per-agent target.
- **The measure is a sum of groups,** not PoB's Full DPS: a reader comparing with PoB's sidebar sees a different
  number; the dossier and the display name it the composite's total.
- **Old runs:** schema-4 runs with `R1a-assemble` stay readable and keep it for later rounds.

## 15. Choices for the user

Taken on 2026-10-23, walked through one at a time:

1. **How many composites:** at most 4 (recommended; taken), or at most 3.
2. **Leave-one-out probes:** up to 4 pieces per composite (recommended; taken), none, or every piece. The review
   showed they don't fit the old budget, so a composite's cap rises to 8 (D-433).
3. **The library's cap:** 13,000 words (the user: "Raise the cap"), set in M-22 (amendment 9 §24.1 at `77bd695`).
4. **The obvious card:** kept as the gate's baseline line (recommended; taken), or dropped once composites exist.
5. **The order:** M-23 after M-22 merges (recommended; taken), the review running while M-22 builds.

New, from the review:

6. **A fixed roll's composites** (S1): keyed by engine, so `/build-guide <ascendancy> <skill>` still gets up to 4
   alternatives (recommended); or one composite (two after a split) plus the baseline.
7. **The shared phases' target** (S13): raise D-416's 1.2M to 1.3M for composites (recommended: the estimate is about
   1.26M, and the synthesis replaces verifying thin cards), or keep 1.2M and verify fewer.

## 16. The independent review and its resolution

The review (2026-10-23, one reviewer with fresh context, read only, about 398K tokens) found the numbering clean and
5 blockers, 17 should-fix findings and 9 nits:

| Finding | Resolved in |
|---|---|
| B1 the 13,000 cap isn't binding | The header and §6: amendment 9 §24.1 as revised on M-22's branch (`77bd695`), which the reviewer's `main` lacked |
| B2 leave-one-out against the 4-probe budget | §8: a composite's cap 8 (the checklist's 4 and 4 leave-one-out); D-292, D-338, `PROBE_CAP` amended; AC-W84 |
| B3 Full DPS can't see other groups; no ledger in a skeleton | §8: the composite's total from `countedSkillOutputs`, each group's drop; the card's hand estimate for an unmodelled piece |
| B4 V4 has no Edit | §10: no Edit; a syntax check before the Write, and the checker ignores an empty item |
| B5 the name after the audit render | §10: `build`'s `name` at queueing, before F1; D-392 amended |
| S1 a fixed roll yields one composite | §4: engine keys under a fixed identity; choice 6 |
| S2 the round's caps, short round, tie-breaks | §4: 1–4, short below 2 or with none under-played, the tie-break; NFR-23 |
| S3 recomposition | §4: only gained structures, new id and name, never a verified or built one |
| S4 the researchers' cards | §4, §7: `## Cards`, the seed marked, a plain card still verifiable |
| S5 piece identity and `from` | Appendix A's keys; §7: `from` names keys; a gate-made composite |
| S6 the Pieces tables and leaving out | §8 and Appendix A: two tables, one per half; leaving out by kind |
| S7 scheduling and second buttons | §8: `single_target` for a boss button; set 2 through WU-101's field; a larger clear group recomposes |
| S8 D1-build's returns and `scheduled:` | §9: `pieces.md`; one return line; D1-finish's claims; `left out:` is D-396's |
| S9 the display's pieces line | §9: the D1 gate's design field, per build |
| S10 `engineGroup` | §10: the tool maps C-55's number; no record field, no grant |
| S11 mixed runs | §4: schema 4 with one new stage; an `R1a-assemble` run keeps it; AC-W84 |
| S12 unowned files | §12's table |
| S13 costs | §11 re-added; choice 7 |
| S14 criteria | §13 |
| S15 the stale-build warning | §10: a `warnings` list; the violations stay |
| S16 the rival | §4 |
| S17 formats | Appendix A |

The nits: N1 (C-57 and PG-74 dropped) the header; N2 (the research file's citation) §5; N3 (the entry's name, in
§24.1 at `77bd695`) §6; N4 (D-319) §4; N5 (one paragraph) §7; N6 (the dossier is R1b-assemble's) §8; N7 (the summaries'
existing row; the deliverable) §10; N8 (R1b's figure includes its assemble) §11; N9 (the baseline judged as written)
§4.

## Appendix A. Formats

**A piece's key.** An Ideas line's id, `i<k><letter>-<m>` (round `k`, the researcher's letter, `m` from 1), or a Pieces
row's key, which reuses the Ideas id when the piece came from one, else `c<card id>-<m>` (from a card's links). The
synthesis merges lines naming the same piece and kind into one Pieces row, listing every source key.

**An Ideas line** (`## Ideas` in a research file):

```
- i<k><letter>-<m> | <piece> | <kind> | role: <layer | scaler of <X> | supply of <X> | removes limit: <X> | defence | boss> | needs: <class, ascendancy, skill types, weapon or slot | any> | conflicts: <what it consumes or forbids | none> | <lookup> | <PoB label> | on: <card ids | none>
```

`<kind>` is one of `skill`, `support`, `unique`, `mod`, `node`, `keystone`, `rune`, `config`; `<PoB label>` one of
the library's six; `<lookup>` the call that confirmed it, as a card's links table names it.

**The card's tables.** In the brainstorm half, after `### Risks so far`:

```
### Pieces

| Key | Piece | Kind | Status | Where | Why | From |
|---|---|---|---|---|---|---|
| i1b-4 | Blistering Bond | unique | in | Ring 2 | fire sets bleeding's magnitude | r1-b-2, i1b-4 |
| cr1-a-3-2 | Hammer of the Gods | skill | scheduled | set 1, single_target | boss button | r1-a-3 |
| i1a-7 | Elemental Focus | support | out | — | forbids the ignite and bleeding layers | i1a-7 |
```

`Status` is `in`, `scheduled` or `out`; `Where` a slot, group, set or node for `in` and `scheduled`, `—` for `out`;
`Why` is required for `scheduled` and `out`. In the verification half, after `### Key item prices`:

```
### Pieces measured

| Key | Total | Per group | How |
|---|---|---|---|
| i1b-4 | −2% | Shield Wall −21%, Seismic Cry −5% | the slot's plain Ruby Ring |
```

`Total` and `Per group` are the drops when the piece is left out, or `estimate (<reason>)` for a piece PoB doesn't
model; pieces not probed are left out of the table.

**`cards.md`**, H2s in this order:

```
# Deck

## What the composites share        (at most 80 words, D-392)
## How they differ                  (one paragraph, each composite's structure and what sets it apart)
## The obvious build                (one line: id, name, its kit; or None.)
## Round <k>                        (one line per composite: id, "name", structure, layers, the limit's answer,
                                     its under-played label)
## Cards                            (one line per researcher card: id, "name", its structure, seed when it is the
                                     seed card, fed: <composite ids | none>)
## Pieces not used                  (at most 10 lines: - <key> <piece>: <why no composite takes it>; or None.)
## Not composed                     (- <structure>: <why>; or None.)
## Superseded                       (- <old id> "<name>" → <new id>; only when a later round recomposed)
```

**`R1a-synthesize`'s interface.** Header: `stage: "R1a-synthesize"`, `attempt`, `mode`, `runFolder`, `compile:
"none"`, `findings`, `writes: ["cards.md", "cards/r<k>-s-<n>.md", …]` with any renames. Prompt: the round, the parsed
brief, the user's note, and the researchers `{letter, focus, researchFile, cards, returned}`. Reads: every card's
brainstorm half (this round's, the earlier rounds', the gate-made ones, the rival's), each research file's `## Ideas`
and `## Supply search`, `cards.md`, the card template, `data/rules/vocabulary.md`, and the library entries its labels
name (by Grep). Returns at most 8 lines: `composites: <n>`, then one line per composite (`r<k>-s-<n>: <name>`), `cards:
<n> listed`, `not composed: <n>`, `superseded: <n>`, and `short: <why>` for a short round.

**`pieces.md`** (D1-build, in the build's folder): `# Pieces: <build name>`, the Pieces table as designed (the card's
columns), then `## Searched`: one line per question asked again, `- Q<n> after <the change>: searched <what>; found
<result>`.

**The brainstorm display,** per composite: its round line, then `  in: <pieces>`, `  scheduled: <piece> (<where>)`,
`  out: <piece> (<why, a few words>)`, each on one line, names joined with commas.

**The design display's line:** `- Pieces: <n> in, <n> scheduled (<names>), <n> out (<names>)`, once per build, before
the rungs.
