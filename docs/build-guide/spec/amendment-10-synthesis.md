# Amendment 10: one build from the whole brainstorm

**Status: DRAFT, 2026-10-23.** The user took §15's five choices on 2026-10-23 (four as recommended; the cap
decided in M-22); the independent review is next. It carries:
- the user's direction after the live test (WU-99): the brainstorm's ideas are synthesized into builds, not dealt
  as independent cards of which all but one are dropped;
- the user's two choices the same day: **composites drawing on all cards** (one composite per compatible structure,
  borrowing transferable ideas from every card), and **M-22 built now, in parallel** with this amendment's review;
- the lessons of the live test's comparison study (`../studies/2026-10-23-spud-warcryer-comparison.md`, cited as
  [study]) and the run's own findings (work-log 2026-10-23).

It is written against spec v1.6, amendment 8 (built as M-20), amendment 9 (M-21 built and merged at `9efb779`; M-22,
D-425…D-428, building beside this review). Paths are from the repository root, except stage files (`R1a.md` and so
on), which are under `.claude/skills/build-guide/references/stages/`. Decisions continue from D-429, work units from
WU-104, criteria from AC-W83 and AC-P77, contracts from C-57, PoB gaps from PG-74; the milestone is M-23. Each
decision ends with the rows and rules it amends.

**Names.**
- A **piece** is one mechanism a researcher confirmed in game text: a skill, a support, a unique, a node, a rune,
  a keystone, a mechanic. It does one job for a build: a damage layer, a scaler of another piece, a supply, a way
  around a limit, a defence, a boss answer.
- A **structure** is a card's identity, `{className, ascendancy, named damage source}` (D-286).
- A **composite** is one candidate build per structure, composed from every compatible piece the brainstorm found,
  on that structure's cards and on any other card or research file. Its card, `cards/r<k>-s-<n>.md`, is a card
  like any other (C-52) with a **Pieces** table.
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

From [study] (§1, §6):
- **The run found the core** a skilled designer found for warcries as a main skill: Warcaller's Bellow spam, Avatar
  of Fire, a cheap wand in the slot the cry doesn't read, the shield's block as fire, armour break into Imploding
  Impacts.
- **It stopped there.** The reference build carries six damage layers to ours two (ignite, bleeding as fire
  through Blistering Bond, a second corpse explosion from Deidbell, Battershout's armour detonation), removes the
  limit our guide names as its main con (mana, by Blood Magic and life per kill), counts three warcries for
  Escalation where ours counts one, and has a boss setup.
- **The deck held his pieces on separate cards.** Deidbell's explosion was "Triple Corpse Bellow", not dealt as a
  duplicate; Hammer of the Gods for bosses was "Seismic Hammerfall", dealt and not picked; Rage was on the Titan and
  Shaman cards; Battershout was on r1-b-3's own card, ruled out as a payoff thief.
- **The design judged pieces alone** against its structure (Deidbell by its area line, ignite at 0.8% of DPS once
  Elemental Focus forbade ailments, Zerphi's Infamy because the build spends mana), and **asked no lens again** after
  Avatar of Fire entered at the gate: four searches on mana sustain, none on fire payoffs or life costs.
- **The tree step had no part** (D-418 worked: one swap, the engine's keystone kept as a need).
- **Avatar of Fire:** the user's gate ruling that gained cold and lightning convert first was wrong; PoB is right
  (the user, 2026-10-23, after research). Recorded in amendment 9 §24 with M-22, which owns PG-72 and the library's
  damage-order rule. r1-b-3's custom modifiers overstate its damage by about a quarter; it was a test, so the
  work-log notes it and nothing re-runs.

Smaller findings from the run: the clear group's number (§10), V4's stray report line, `audit.md`'s stale title, the
checker against a stale server build, and the telemetry's background summaries (§10).

## 3. What already fits

- **Cards made at a gate** (D-391): a card `r<k>-g-<n>` made from named cards (`from`), which the run log, the
  checker and R1b already handle. A composite is the same idea done by the coordinator before the gate.
- **The deck's checks** (R1a-assemble): duplicates, the identity check and the ascendancy lock (D-342), the sniff
  test (D-287), unique names (D-392), "Found, not used". They stay; they now run on pieces and composites.
- **R1b's probes** (D-292, D-331, `probes/<id>/<p>/`): a probe compile is how a composite's pieces are measured
  inside it.
- **The library's lenses** (questions 1–15, the shapes) and the `left out:` lines D1-build already returns.
- **Weapon sets** (D-426, M-22): a second set is one way to schedule a conflict, as the reference build puts Hammer of
  the Gods on set 2.

## 4. D-429: composites, drawing on all cards

The brainstorm round still runs three researchers, foci `mechanics`, `items` and `tree`, 3 cards each (D-287). Its
coordinator step changes from dealing cards to composing builds:

- **Structures.** The round's cards, every earlier round's cards and the gate-made cards are grouped by structure.
  A card that fails its identity check or the ascendancy lock is out, as today; its confirmed pieces stay in the
  pool.
- **One composite per structure,** at most 4, from the structures with the most confirmed load-bearing links (the
  sniff test, per piece). The composite starts from its structure's strongest card (the one whose links table
  confirms most) and takes every piece of the pool that fits it: the structure's other cards, the other structures'
  cards, and the research files' Ideas (D-430). Each piece is in, scheduled or out with its reason, by the synthesis
  questions (D-431).
- **A conflict that can't be scheduled splits** a structure into two composites, one per side ("mana engine" and
  "life engine"), within the cap of 4.
- **The obvious card** (D-403) stays: it is written as today and shown at the gate as the baseline, one line, not a
  composite; each composite's How it clears says how it beats it. Its pieces join the pool.
- **Under-played** (D-339): at least one composite rests on a shape its researchers judged under-played; the label
  moves to the composite that uses the piece.
- **The engine rule** (D-405, at most half a round on one engine) is dropped: composites differ by structure, or by
  the side of a split.
- **A later round** (brainstorm more, with the user's note) adds cards and Ideas to the pool; the synthesis then
  composes anew. A composite shown at a gate keeps its id and name (D-392); a recomposed one gets a new id, and the
  old one is listed under `Superseded` with its successor.

Amends D-287 (the coordinator step's job), D-339 (the under-played rule's unit), D-403 (the obvious card as a
baseline line), D-405 (dropped), and C-52 (the composite's card and id letter `s`).

## 5. D-430: the research file's Ideas

Each research file gains `## Ideas`, after its focus's sections and before `## Sources`: one line per piece the
researcher confirmed, used on its cards or not.

```
## Ideas

- <piece> (<kind>) | role: <layer | scaler of <X> | supply of <X> | limit: <X> | defence | boss> | needs: <class,
  ascendancy, skill types, weapon or slot it requires | any> | conflicts: <what it consumes or forbids | none> |
  <lookup> | <PoB label> | on: <card ids | none>
```

It holds at most 25 lines; the supply search's suppliers (D-404) are among them. Ideas are the synthesis's pool, so
a piece no card uses reaches a build. Amends R1a's research-file format (slice 03 §7.5) and D-404 (its suppliers
listed as Ideas too).

## 6. D-431: the synthesis questions

The library's brainstorm questions gain four, asked by the synthesis of each composite, by D1-build of the design,
and by the rival:

16. **Breadth.** What else can this button cause? Each layer its hits can start: ailments, explosions, detonations, a
    skill it triggers, a second warcry. Search each layer's payoff by its damage type after conversion.
17. **The limit.** What caps this build's rate or uptime, and what removes the cap rather than feeding it? A cost
    moved to another pool, a refund, a cooldown ignored.
18. **Conflicts.** Which pieces fight (one consumes what another needs)? Schedule the conflict before leaving a piece
    out: a clear button and a boss button, a second weapon set.
19. **Bosses.** When the clear skill is capped by a limit or shaped for packs, what is the boss button?

Two entries change:
- **Cost redirection:** its Search also starts from a resource that caps the build's rate (mana per cast), not only
  from scaling keyed to a full pool.
- **Payoff thief (anti-pattern):** before a thief rules a piece out, try scheduling it on another button or set
  ([study] §6.2: Battershout on the clear warcry, none on the boss warcry).

Amends the library (C-53): questions 16–19 and two entries, within the 13,000-word cap M-22 sets (amendment 9
§24.1). Question 16's ailment payoffs follow the library's "Convert into the ailment's type" (M-22).

## 7. D-432: the brainstorm gate shows composites

The deck (`cards.md`) is rewritten for composites:
- `## What the composites share`, `## How they differ` (one line per composite: its structure and what sets it
  apart);
- `## The obvious build`, one line;
- `## Round <k>`, one line per composite: id, name, its structure, its layers and its limit's answer, its
  under-played label;
- `## Pieces not used`: each pool piece no composite took, with why (the old "Found, not used");
- `## Not composed`: a structure without a composite, with why; `## Superseded`, when a later round recomposed.

The display shows each composite with its pieces in short: in, scheduled, out, with each out piece's reason in a few
words. The answers stay (D-391, D-411): **verify** 1–3 composites, picked or made at the gate (a gate-made card may
name composites, cards or pieces in `from`); `changes` on a picked composite may add or drop pieces ("add Blood
Magic", "drop Deidbell"); **brainstorm more**; **stop**. A plain card can still be verified, on the user's request.

Amends the brainstorm gate (`gates.md`, `checkpoints.md`), D-391 (`from` may name pieces) and the deck's format.

## 8. D-433: R1b measures each piece inside its composite

R1b compiles the composite's skeleton with every piece in, and its scheduled pieces in their own groups or set. Then,
inside its probe budget (D-292), it measures up to 4 pieces by leaving each out of the skeleton: the pieces that are
neither the named damage source nor its enabler, those with the least certain value first (a custom modifier, a
hand calculation, a layer PoB doesn't fold into the main skill's DPS). Each result goes into the Pieces table's
`measured` column (`−18% Full DPS without it`) and the dossier row's "key pieces" field. A piece the skeleton can't
carry (PoB can't model it) is measured by its ledger estimate, marked so.

Measured this way, a piece is judged with every piece it needs, the opposite of adding one piece to a bare
structure ([study] §6.2). Amends R1b (its probes), R1b-assemble and the dossier template.

## 9. D-434: the design keeps synthesizing

D1-build reads the composite's Pieces table and the deck's `Pieces not used`, and:
- **asks the synthesis questions again** whenever the design adds a conversion or a keystone, or its own return
  would name a limit as a con (questions 15–19 and the type-conversion entry), and records what it searched;
- **revisits an out piece** whose reason the design changed (Zerphi's Infamy after costs move to life);
- **judges a piece with the pieces it needs,** measuring a set together before rejecting any of them;
- **schedules before rejecting** (question 18), a second weapon set included (D-426);
- **answers question 19** on every build whose clear skill is limited or pack-shaped: a boss button, or why none is
  needed;
- returns a `left out:` line for every composite piece it drops (D-406 as today), and a new `scheduled:` line for each
  piece on a second button or set.

A node that a custom modifier depends on (the keystone whose conversion the modifier stands for) is a need (D-418),
so node power's swaps never drop it while the modifier stays.

The design display gains one line per rung: `- Pieces: <n> in, <n> scheduled, <n> out (<names>)`.

Amends D1-build (D-375, D-406, D-418's needs list) and the design display (D-419).

## 10. D-435: the live test's fixes

- **The clear group** (D-418, D-419). The record keys skill groups by the plan's group number (`g<N>`), while
  `get_node_power`'s `clear_group` counts the engine's socket groups, where item-granted skills come first: on r1-b-3,
  plan group 1 (Seismic Cry) was engine group 3, after the wand's Mana Drain and Bellow's explosion. The record's
  `skillOutputs` entries gain `engineGroup`, the engine's socket-group index; D1-tree and the D1 gate pass it as
  `clear_group`. Amends C-41's record (`compile_plan`) and the two stage files.
- **V4's report:** a format slip in the verifier's own report (a stray `- ` line) fails the checker, and V4 may not
  rewrite its file. V4 may Edit its own report once, before returning, to fix its format; never its findings.
- **`audit.md`'s title** keeps a card's old name when the finalize revision renamed the build: the build's name is
  logged in `builds[].name` at W1, and `render-audit.mjs` takes it from there.
- **The checker against a stale build:** `check-run.mjs` loads the server's `build/` for the build hash; it now prints
  a warning, not a violation, when `build/` is older than the newest file under `src/plan/`.
- **Background summaries:** the resumed session's telemetry holds 130 `agent_summary` requests, 29.6M cache read
  that the transcripts don't show (Claude Code summarizing running subagents). WU-108 finds whether a setting turns
  them off for runs, and `run-usage.mjs` reports them as their own line.

Amends D-418, D-419, V4 (D-352), `render-audit.mjs` (D-355), the checker, and `run-usage.mjs` (D-357).

## 11. Costs

From the open-clear run's first session (output tokens, the usage script's estimates): R1a 371K for three
researchers, R1a-assemble 42K, R1b about 105K a card, RV 83K. Estimated changes:
- the Ideas tables: about +10% on R1a, +35K;
- the synthesis step: about 80K, against R1a-assemble's 42K;
- R1b on a composite: about +25K a composite (bigger skeleton, up to 4 leave-one-out probes);
- D1-build: about +15% for the questions asked again and the sets measured, about +20K a build.

About +100K on the shared phases for two verified composites, within D-416's 1.2M target. The user verifies fewer,
better candidates, which is where a saving can come from.

## 12. Work units (M-23, after M-22 merges)

| Unit | What |
|---|---|
| WU-104 | `R1a.md` (the Ideas section, D-430); the new `R1a-synthesize.md`, replacing `R1a-assemble.md` (D-429, D-432's deck format); the card template's Pieces table and the composite's id; the researcher's definition |
| WU-105 | `run-log.mjs` (the stage `R1a-synthesize`, the `s` id letter, the brainstorm display's composites and pieces, `from` naming pieces); `check-run.mjs` (the deck rules for composites, the stage's caps and order, the Pieces table, the design display's pieces line); fixtures; `render-audit.mjs` and `run-usage.mjs` (D-435) |
| WU-106 | `R1b.md` (the composite's skeleton, the leave-one-out probes), `R1b-assemble.md` and the dossier template, `gates.md` and `checkpoints.md` (the brainstorm gate), `SKILL.md` (steps 2b and 2c, the names) |
| WU-107 | `D1-build.md` (D-434), `RV.md` (questions 16–19), `references/patterns.md` (questions 16–19, the two entries, the cap) |
| WU-108 | The record's `engineGroup` and the two stage files' `clear_group`; V4's one Edit; the checker's stale-build warning; the background-summary investigation |
| WU-109 | The live test: a run with an open brief, the user's, with the coordinator |

Order: WU-108 first (server); WU-104 and WU-105 in parallel, with the formats fixed in the handoff; then WU-106 and
WU-107; then WU-109.

## 13. Acceptance criteria (M-23)

- **AC-W83 (WU-104).** Static: `R1a.md` asks for `## Ideas` with the line form and the 25-line cap; `R1a-synthesize.md`
  groups by structure, composes at most 4 composites from every card and the Ideas, splits on an unschedulable
  conflict, keeps the obvious card as a baseline line, keeps the identity, lock, sniff and name checks, and writes the
  deck's H2s; the card template has `### Pieces` with `in`, `scheduled` and `out` rows and a `measured` column.
- **AC-W84 (WU-105).** Script unit, on fixture runs: a run with an `R1a-synthesize` step and composites `r1-s-1` and
  `r1-s-2` passes; a composite card without a Pieces table fails; a Pieces row with `out` and no reason fails; a
  `from` naming a piece no Ideas line holds fails; the brainstorm display lists each composite's pieces; a schema-4
  run with `R1a-assemble` still passes (old runs readable); `run-usage.mjs` prints the background summaries as their
  own line.
- **AC-W85 (WU-106).** Static: `R1b.md` measures up to 4 pieces by leaving each out, in its probe budget, and fills
  `measured`; the dossier template has the key-pieces field; `gates.md` and `checkpoints.md` show composites and accept
  piece changes; `SKILL.md` names `R1a-synthesize`.
- **AC-W86 (WU-107).** Static: `D1-build.md` asks questions 15–19 again after a conversion, a keystone or a limit,
  revisits out pieces, measures sets, schedules before rejecting, answers question 19, returns `scheduled:` lines,
  and lists a custom modifier's nodes as needs; `RV.md` asks 11–19; `patterns.md` holds questions 16–19, the two
  amended entries, and stays under its cap.
- **AC-P77 (WU-108).** Engine, on a fixture build whose weapon grants a skill: the record's `skillOutputs` entry for
  the clear group carries `engineGroup` equal to the engine's socket-group index, and `get_node_power` called with it
  guards that group's skill.
- **AC-W87 (WU-108).** Static and script: `V4.md` allows one Edit of its own report's format; the checker warns,
  without failing, on a `build/` older than `src/plan/`; `render-audit.mjs` titles the audit with `builds[].name`.
- **AC-W88 (WU-109).** The live test: the user's judgment of the composites and the finished build, recorded in the
  work-log.

## 14. Risks

- **A composite can sprawl:** every piece in makes a skeleton PoB measures poorly and a guide too long. The
  leave-one-out probes and the out reasons keep it honest; the gate lets the user drop pieces.
- **Fewer, bigger candidates** narrow the user's choice; the split rule and the cap of 4 keep alternatives where
  they are real.
- **The synthesis reads every card** (about 9 cards of 400 words and three Ideas tables per round); a later round
  doubles it. The step reads brainstorm halves and Ideas only.
- **Leave-one-out isn't free:** 4 probes a composite is about 4 compiles; the probe budget holds.
- **Old runs:** schema 4 runs with `R1a-assemble` stay readable; the checker keeps both forms.

## 15. Choices for the user

All taken on 2026-10-23, walked through one at a time.

1. **How many composites:** at most 4 (recommended; taken), or at most 3.
2. **Leave-one-out probes:** up to 4 pieces per composite (recommended; taken), none (cheaper, but pieces are judged
   unmeasured), or every piece.
3. **The library's cap:** decided: 13,000 words (the user, 2026-10-23: "Raise the cap"), set in M-22 (amendment 9
   §24.1).
4. **The obvious card:** kept as the gate's baseline line (recommended; taken), or dropped once composites exist.
5. **The order:** M-23 after M-22 merges (recommended; taken, since weapon sets are one way to schedule a conflict),
   the independent review running while M-22 builds.
