# Amendment 2: guide style

**Status: PROPOSED, 2026-10-09.** Every decision here (G1…G8) and every open question (Q1…Q4) waits for
the user. The memo turns the guide style the user settled after comparing our output with Fubgun's
Lightning Arrow Deadeye guides (`../worklog.md:832-856`) into changes to the pipeline. That direction is
binding; this memo decides only how to carry it out. It amends the spine (`README.md`), slice 03
(`03-pipeline.md`, the pipeline), amendment 1 (`amendment-1-simplify.md`, the approved slim pipeline) and
the skill under `.claude/skills/build-guide/`.

Some names used throughout:
- W1 is the guide writer, D1 the endgame designer and D2 the campaign designer.
- V4 is the three verifiers, one per lens: `ledger`, `sources` and `prose`.
- The D1 gate is the fresh step that checks D1's endgame stages: the survival floor, the budget, and the
  rolled skill as the main damage.
- The runner is the user's session following `SKILL.md`, and the checker is `scripts/check-run.mjs`.
- File references without a directory are under `.claude/skills/build-guide/`.

**Evidence.** Run A of WU-47 attempt 3, the recorded offline run on Opus
(`/tmp/m12b.B0zi/guides/titan-blood-hunt/2026-10-08-2/`):
- `guide.md` has 9,766 body words, 609 footnote markers (one per 16 words), 49 "confidence L" labels and
  297 source lines;
- `plan.json` has 232 stage claims, 45 ledger entries and 21 prices.

Token figures are summed per agent from that session's subagent transcripts
(`~/.claude/projects/-home-parker-projects-pob2-mcp-wt-m12b/7aa36141-…/subagents/`).

## 1. Summary

- `guide.md` becomes a reader layer of about 2,600 words, at most 3,000, written in a guide's voice.
  Everything kept for agents moves to a new `audit.md` beside it.
- The reader text has no markers. Each fact is traced through a table in `audit.md`. The checker verifies
  every number deterministically, and V4 verifies the plan claims behind the facts.
- Facts are written plainly and traced. Advice is written in the first person and is not verified.
- D1 and D2 write about 90 stage claims instead of 232. No claim restates a record number.
- A third endgame rung, "entering maps", bridges the campaign's end (level 62 in run A) and the budget
  variant (level 90).
- V4's cache reads fall from 37.6M to roughly 13–16M per run (§4.5).

## 2. G1: the reader layer (PROPOSED)

**Rules for every section:**
- **Facts and advice.** A fact is a plain statement and has a trace row in `audit.md` (G2). Advice is in the
  first person ("I", "my"), which is its label (G3).
- **Each caveat once,** where the reader acts on it. Later mentions use the number without hedging it again,
  and never state the uncertain point as settled.
- **Not a tutorial** (G4).
- **No pipeline text.** No markers, confidence labels, finding ids or pipeline words, and no stage ids outside
  the loadout names (which match PoB's).
- **Numbers.** Every number comes from the plan, the record, a ledger entry, a price or a data fact, rounded
  the way a guide would round it ("about 2,740").
- **Kept from our guides:** survival as a verdict, the stage-matched PoB file, gem and trial timing, reasons
  for choices, and the FAQ (`worklog.md:848-849`).
- **Held back:**
  - crafting recipes and an atlas section, as the user settled;
  - affix tier labels: our lookups return mods but no tiers (`references/lookups.md:9-23`), so a tier label
    couldn't be verified. Slot targets give values instead.
- Trade links: Q4.

In the table, examples use run A's plan and record. Two are illustrative, because run A's plan has no such
content: the reward pick (its plan made none, `guide.md:184`) and the whole entering-maps rung. Run A's trees
also lack the reasons G1 asks for (`worklog.md:712`).

| # | Heading | Words | Holds | Example (Titan / Blood Hunt) |
|---|---|---|---|---|
| — | `# <Ascendancy> / <Skill>: <concept>` | — | the roll | `# Titan / Blood Hunt: Atziri's Acuity, Blood Loss on every hit` |
| 1 | `## At a glance` | 160 | what the build does, its payoff mechanic, pros, cons, difficulty | "Blood Hunt lunges at a target, and on an enemy that has suffered Blood Loss it also sets off a 1.7-metre explosion. Atziri's Acuity makes 10% of your hits' physical damage cause Blood Loss, so in maps one button clears. Pros: a sturdy armour Titan, about 2,740 life on the budget setup. Cons: bosses need Rake first." |
| 2 | `## Your PoB file` | 80 | the import code (first fenced block), file name, loadouts, engine version and boss-data patch, the offline line, the record's PoB warnings | "Import the code below, or open `titan-blood-hunt-2026-10-08-2.xml`; each stage is a loadout at the top of PoB2. Engine: PoB2 v0.23.1 (patch 0.5.4); boss data 0.5.5. Made offline, so no prices were checked." |
| 3 | `## Survival by stage` | 130 | a legend line, then one verdict per stage group (Acts 1–2, Acts 3–4, the interludes and Epilogue, each endgame rung): the word, the numbers behind it, the gap and its fix | "*Solid: resistances capped for the area, and in maps every reference hit under half your max hit. Watch: one named gap. Risky: a known hit near your max hit.* Acts 1–2, watch lightning: 38% at Keth after Act 2's −10%; take the Sisters of Garukhan's +10%. Budget maps, solid: a 3,498 physical max hit against a hit of about 400, but the Arbiter's top slam (3,486) is risky." |
| 4 | `## Gem and ascendancy timing` | 110 | a When / Change table: each uncut-gem step and where it comes, each trial and its nodes | "Level 22 and a level-7 uncut gem (Act 2 drops): Blood Hunt replaces Whirling Slash (needs 41 Dex). Trial of the Sekhemas, Act 2: Life Regeneration, then Mysterious Lineage. Trial of Chaos, Act 3: Armour, then Stone Skin." |
| 5 | `## Priorities` | 140 | support, link, quality and stat priority; the weapon swap rule of thumb | "My support order: Brutality, Rapid Attacks, Heavy Swing, Heft, then Physical Mastery. Quality goes on Blood Hunt first. Stats: cap the elements, then life, then Dex for Blood Hunt's gem level (157 at 20)." |
| 6 | `## Leveling` | 660 | one H3 per campaign stage, titled with its loadout name exactly, at most 110 words: through level N; the setup; tree additions in order with what each buys; attributes (have and need); gear targets and a fallback; when to swap | `### Act 2 Keth (L24) {3}`: "Through level 24. At 22, swap Whirling Slash for Blood Hunt with Brutality II and Rapid Attacks I; Rake stays alone to open on rares. Dex 82, needs 41. Without mana leech on the spear I keep the mana flask going: packs cost about 6 mana a second more than you regain. Swap when Rootdredge drops the level-9 uncut gem." |
| 7 | `## Campaign route and rewards` | 240 | the reward quests worth doing, in route order; every reward choice's pick with a reason; currency habits that serve this build (gold for a respec, vendor checks for its weapon) | "Goddess of Justice, Act 4: take 30% increased Mana Recovery from Flasks. Vaal Pact switches your life flask off in maps, and the mana flask carries packs. I vendor-check every town for a spear with physical damage and mana leech." |
| 8 | `## Endgame: entering maps`, with `### Checks` | 200 | the gate in, what changes from the Epilogue, the fallback, checks (G5) | "Move here when the campaign is done and all four resistances are capped at −60%: the body armour, boots and both rings carry chaos. Play as in the campaign, Rake on rares and Blood Hunt on packs, until you own Atziri's Acuity." |
| 9 | `## Endgame: budget`, with `### Checks` | 330 | the gate in; buy order; a slot table (slot, target, what to use if you can't); gems; tree additions with reasons; final ascendancy; earned config in one line; checks | "Move here when you own Atziri's Acuity. Then buy 30% movement-speed boots with cold, lightning and chaos resistance, then a Pronged Spear with about 130% increased physical damage and mana leech. Checks: all four resistances 75% at −60%; a 3,498 physical max hit against about 400." |
| 10 | `## Endgame: non-budget`, with `### Checks` | 180 | the gate in, the upgrade order, checks | "Move here when the budget setup is capped and you have currency to spare. Upgrade in this order: a spear with +3 to melee skills, an amulet with +2, Prism of Belief (+3 Blood Hunt), then higher life rolls." |
| 11 | `## How to play it` | 110 | clear and single target; the rolled skill as the main damage (D-122), and why when it isn't the clear skill (D-148) | "Packs: press Blood Hunt. Bosses: Rake first so the target bleeds, then Blood Hunt, then Rake again once the Bleeding is consumed. Even the dash alone out-damages Rake: about 7,600 DPS to 1,290 on the budget setup." |
| 12 | `## What PoB can't show`, ending with `### Known issues` | 170 | each caveat once, next to the figure it qualifies. Known issues: the runner's plain sentences, outside the word count | "PoB has no switch for Blood Loss, so its explosion figure (about 20,700 DPS on the budget setup) assumes every use explodes; I read it as a ceiling. PoB also ignores Vaal Pact's slower leech: by hand you leech about 283 life a second when every use explodes, 142 when a use only dashes." |
| 13 | `## FAQ` | 110 | 3–5 questions a player of this build asks | "**Why keep Life Regeneration when Vaal Pact turns it off?** It's the only path from the Titan start to Mysterious Lineage's 15% more maximum life." |
| 14 | `## Changelog` | 10 | dated entries | "2026-10-08: first version (offline run)." |
| | **Total** | **2,630** | cap 3,000 (G6) | |

The rungs' gates ("Move here when …") appear once each, at the top of their own H2. The Survival section
holds the only per-group survival summary, so the Leveling H3s don't repeat it.

**Where today's sections go.** Summary goes to 1, except its "why this concept" line (`guide.md:22`), which is
pipeline information and goes to `audit.md`. Versions goes to 2 and Rotation to 11. How it works splits:
the payoff to 1, the caveats to 12, the ledger table to `audit.md`. Defences and resistances becomes 3's gaps
and fixes, with its table in `audit.md`. Confidence goes to 12 and `audit.md`; Sources to `audit.md`'s trace.

## 3. G2: the audit layer (PROPOSED)

**Where.** The audit layer is a separate `audit.md` in the run folder, not an appendix to `guide.md`. W1
writes it with Write and patches it with Edit, as it does the guide (D-257: the writer has Edit). The runner
fills its `Known issues` table at step 14, the step where it lists the open findings (amendment 1 §3).

Why a separate file:
1. **No human reads it** (`worklog.md:839-840`). `guide.md` stays the file the user opens and shares; an
   appendix would add thousands of words of tables under the guide.
2. **The checker's rules stay whole-file.** The word cap and the no-marker rule then apply to all of
   `guide.md`. An appendix would need a boundary rule, and a way to stop markers leaking across it.
3. **Drift is caught.** A trace row whose quoted text is gone from `guide.md` fails the checker (G6).

The cost is one more file in C-36 (the spine's table of which step writes which file), in slice 03 §2 (the
run-folder layout), in W1's `writes` and in SKILL.md steps 10 and 14.

**What moves there,** as H2s in this order:

| `audit.md` H2 | From run A's guide |
|---|---|
| `Trace` | replaces the 297 footnote definitions (`guide.md:323-621`) |
| `Hand calculations` | the ledger table, about 1,500 words (`guide.md:38-86`) |
| `Stage detail` | each loadout's PoB numbers (`:100, :111, :123, :134, :146, :157`), the resistance table (`:274-283`), the mana and leech pairs (`:121, :132, :143, :155, :209, :250`), the Arbiter and mapping detail (`:225-226, :260-261`) |
| `What PoB doesn't model` | `mcp__pob2__check_model_coverage`'s flags and how each is handled (`:300-306`) |
| `Inputs by confidence` | the M and L inputs and the claims that need an external source (`:308-309`) |
| `Run notes` | why this concept: the checkpoint-1 answer that picked it, and its rule (`:22`); the D1 gate's budget totals and rates |
| `Known issues` | per open finding or accepted gate finding: its id, its lens or gate, and the reader sentence the guide prints |

**The trace.** Each row is `| # | Section | Says | Backed by |`:
- `Says` is a verbatim fragment of the reader text, at most 15 words, that holds one fact.
- `Section` is the H2 or H3 the fragment sits under.
- `Backed by` is one or more refs:
  - `claim:<stage>/<claim id>`, a plan claim;
  - `record:<stage>.<Field>`, in the grammar of a `pob-computed` ref (`references/source-markers.md:14`);
  - `plan:<stage>.<path>`, a plain plan value such as a stage level or a gem level;
  - `ledger:<id>`, `price:<id>` or `data:<file>#<key>`, as today.

```
| 41 | Act 2 Keth (L24) {3} | At 22, swap Whirling Slash for Blood Hunt | claim:3/s3-swap |
| 42 | Act 2 Keth (L24) {3} | Dex 82, needs 41 | record:3.Dex, claim:3/s3-swap |
| 43 | Act 2 Keth (L24) {3} | about 6 mana a second more than you regain | ledger:mana_3_balance_dash |
```

The sources lens checks the plan claims behind the rows, the prose lens checks that each row says what its
backing says (G3), and the checker checks that rows resolve and numbers match (G6). A V4 location in the
guide stays `<section>, line <n>` (`references/stages/V4.md:60-63`); a finding on the trace uses
`audit.md Trace row <n>`.

## 4. G3: claims and verification (PROPOSED)

### 4.1 What is backed by a claim and verified

- **Every number in the reader layer:** traced, and matched by the checker (G6).
- **The mechanics the build depends on**, traced to plan claims that V4 verifies: the payoff (Blood Hunt's
  explosion on Blood Loss, Atziri's Acuity), what switches a resource off (Vaal Pact), why a support, node or
  item is taken or left out, the build's requirements (weapon type, attributes, level), and what PoB can't
  model wherever it changes a number the guide quotes.
- **The gated statements**, as now: the survival floor, the budget lines, the rolled skill as the main damage
  (D-122) and the offline line.

### 4.2 What is advice, and not verified

- **Advice:** priorities, fallbacks, rules of thumb, buy and upgrade order, campaign practicals, the play
  pattern, the reasons behind reward picks, and the verdict words (checked only against the legend).
- **Its label is the first person.** W1 writes advice as "I" or "my", so no marker is needed. A first-person
  sentence that asserts a game fact or a number with no trace row ("I find every hit explodes") is a fact
  dressed as advice: a prose finding.
- **A rule of thumb with a number** ("I swap spears at +30% DPS in PoB") is a D1 or D2 `judgment` claim and is
  traced, so W1 still never adds a number of its own (`references/stages/W1.md:6-7`).

### 4.3 V4's three lenses

| Lens | Today | Change |
|---|---|---|
| `sources` | every plan claim, plus every guide marker (`references/stages/V4.md:123-154`) | Unchanged on the plan. The guide side goes: no markers to check (`:152-154`); guide numbers move to the checker (`:145-147`); an `external-unavailable` claim is reported once, on its plan claim (`:148-151`) |
| `ledger` | re-derives every entry and the five reference hits (`:91-118`); compares guide numbers (`:119-121`) | Step 3, the guide numbers, moves to the checker. The rest is unchanged |
| `prose` | mechanics against markers, the gated statements, why this concept (`:156-181`) | Reads `guide.md` with the trace. Checks that each row says what its backing says, no stronger ("always"); that untraced sentences are advice with no fact or number; no tutorial text (G4); each caveat once, never later stated as settled; and that the guide agrees with itself, verdict words included. Gated statements as now; why this concept in `audit.md` |

**Claim rule 3 is amended.** Amendment 1's S7 added three claim rules: a claim is supported in every part,
it cites each fact it rests on, and it carries its source's caveats. Rule 3 currently puts the caveat
"wherever the claim appears" (`references/source-markers.md:75-77`; W1's "Keep every hedge",
`references/stages/W1.md:128-131`). It becomes: once in the reader layer, and never later stated as
settled.

### 4.4 How many claims D1 and D2 write

**The rule.** A claim exists only for a fact the reader layer states or a gate needs. No claim restates a
record field, a plan value or a data fact word for word: W1 traces those directly.

**Baseline.** Of run A's 232 stage claims, 86 go outright under this rule or G4: 77 restate a record
number, 7 an act's resistance penalty and 2 the uncut-gem tier rule.

**Targets.** D1 writes about 35–45 stage claims across the three rungs, and D2 about 45–55, including one per
reward pick. The ledger holds about 30 entries instead of 45: 15 reference hits over three rungs, the Arbiter,
and only the hand calculations the reader layer quotes. Prices rise to about 30 from 21, for the new rung's
slots. In all, about 150 checkable items instead of about 300.

### 4.5 Token effect on V4

**Run A.** V4 used 37.6M of the run's 107.2M cache-read tokens (35.0%): the full pass 19.7M (`sources`
8.2M, `prose` 7.2M, `ledger` 4.3M) and the re-check 17.9M (`sources` 9.8M, `prose` 5.6M, `ledger` 2.6M). An
agent's cache reads are its turns times its average context; V4's agents ran 29–51 turns at 94K–196K tokens.

**What changes.** There is roughly a quarter less to read: the plan's claims, about 38% of `plan.json`, shrink by
about 60%, and the 96 KB guide becomes about 30 KB (13.5 KB of it the import code, which no lens needs) plus
an `audit.md` of about 35 KB. There are roughly a third fewer turns, because record numbers leave the lenses'
work.

**Estimate.**
- **Full pass:** about half, roughly 10M (−10M).
- **Re-check: about 3–6M.** In run A, 15 of the sources lens's 21 unresolved findings, and 4 of the prose
  lens's 8, were missing citations or caveats on repeated text (`reports/v4-sources.json`,
  `reports/v4-prose.json`). The new style removes that kind of finding, and D-264 already makes the re-check
  targeted (claims fixed in place, re-checked only where they changed). This part overlaps D-264's own
  estimate (`worklog.md:737-738`), so don't add the two.
- **V4 total:** about 13–16M instead of 37.6M. Elsewhere, the new rung adds a third D1 design (about +3–5M on
  D1's 20.1M), and W1 stays roughly flat at 10.0M: a shorter guide, plus the trace.

## 5. G4: not a tutorial (PROPOSED)

**One rule,** applied by W1, by D1 and D2 when they write claims, and by the prose lens. A sentence that
explains how the game or PoB works stays only when it names something this build uses, needs or avoids (its
skill, supports, ascendancy nodes, key items, an attribute or level requirement, or a number from its plan)
and it changes what the reader does with this build. **The swap test:** if it would read as true and useful,
word for word, in a guide for another skill on another class, cut it. Campaign practicals are actions, not
explanations: the user adopted them, and they live in their own section within its word budget.

| | Run A's guide | Why |
|---|---|---|
| Cut | `:95` "an uncut gem of level N cuts a skill of tier N or lower", cited 12 times between `:26` and `:151` | Basic game knowledge, the user's own example. Keep only the build's consequence: "Blood Hunt needs a level-7 uncut gem" |
| Cut | `:161` "PoB counts each Book of Specialisation as 2 passive points toward the regular cap" | PoB bookkeeping; changes nothing the reader does |
| Cut | `:272` "it grows to -10% in Act 2, -20% in Act 3, -30% in Act 4, -50% in the interludes … and -60% in endgame areas" | True of every build. Keep the gap it opens here ("lightning 38% at Keth"). Also cut: "opened with Balbala's Barya" (`:118`), "support gems have a single level" (`:207`) |
| Kept | `:289` "Vaal Pact … stops all life recovery other than leech" | It is why the endgame drops the life flask and leech is the build's recovery; it drives the illustrative Goddess of Justice pick |
| Kept | `:30` "Bleed IV and Bloodlust are left out: their 30% more damage needs a Bleeding enemy" | Explains a support choice the reader would otherwise question |
| Kept | `:290` Life Regeneration "is the only way from the Titan start to Mysterious Lineage's 15% more maximum life" | Explains a node that looks dead under Vaal Pact |

## 6. G5: the entering-maps rung (PROPOSED)

**What it is.** A third endgame stage, id `m`, with `variant: "entering-maps"` and the loadout
`Entering maps (L<level>) {m}`, placed between the last campaign stage and `b`. It is the setup a player has
just after the campaign, plus cheap buys. It fills AC-W22's gap "no bridge from 62 to 90"
(`worklog.md:711`); AC-W22 is the coordinator's review of whether a reader can follow the guide.

**Level and area.** D1 chooses the level above the last campaign stage and records why (D-193: every
endgame stage records the basis for its level). The rung covers waystone tiers 1–5, and the gate checks it at
T5, area level 69 (`waystones.json#area-level.offset` 64, plus 5), with the modifiers at the top of their
range as for `b` and `n` (D-254: reference hits scaled by waystone modifiers).

**Gate.** The D1 gate checks `m` as it checks `b`:
- **the survival floor** (D-234): fire, cold, lightning and chaos capped at −60%, chaos uncapped only by a
  recorded exception, and max hit taken above all five reference hits;
- **the rolled skill as the main damage** (D-122);
- **the budget:** `m`'s ceiling (Q1), on D-219's tolerance pattern (up to 20 divines passes, up to 22 passes
  with "near the ceiling"). Offline it is `unverified`, as for `b` (D-164: unavailable prices can't show a
  variant is under budget).

`m` gets no Arbiter report and no mapping signals.

**What D1 and D2 do.** D1 designs `m` after `b` and `n`, as the cheapest subset of `b` that passes `m`'s gate:
the same skill and supports, fewer points, the key unique optional. It prices `m`'s slots as `m-<slot>`, adds
the five ledger hits `hit_m_<type>`, and writes claims for the gate lines and fallbacks. The guide's gates come
from those claims: `m` when the campaign is done, `b` at its key buy (here Atziri's Acuity), `n` once `b` is
capped with currency to spare. D2 then plans the campaign backward to `m` instead of to `b`.

**Schema, compiler and checker.** `variant` gains `entering-maps` (`src/plan/schema.ts:217`), and the PoB file
gains a ninth loadout automatically (one per stage, D-103, D-215). In the checker, `areaLevelOf`
(`scripts/check-run.mjs:298-302`) and the budget recompute (`:1711`) learn `m`, the heading list gains its H2,
and `hit_m_*` entries are required.

**Tree continuity.** Today each variant is its own track, continuing from the last campaign stage (A-P3,
`src/plan/checks/v1.ts:69-82`). Proposed: the ladder becomes one track, with `m` continuing from the last
campaign stage, `b` from `m` and `n` from `b` (Q3). V1, the compiler's check that each stage is valid at its
level, then checks every rung's respec and its gold cost, which the "keep gold for the respec" practical
needs.

## 7. G6: deterministic guards (PROPOSED)

The checker, on `guide.md` and `audit.md`:

1. **Headings.**
   - The H1 names the roll.
   - G1's H2s appear in order, and no other H2.
   - Leveling's H3s are the campaign loadout names, as now (`scripts/check-run.mjs:750-757`).
   - Each Endgame H2 has an H3 `Checks`, and `What PoB can't show` ends with the H3 `Known issues`.
   - `audit.md` has G2's H2s.
2. **The word cap.** The reader layer is at most 3,000 words, counted over `guide.md` without the import
   code, the H1 and the Known issues list. There is no floor: the headings and the trace already catch a
   missing section, and a floor invites padding.
3. **No pipeline text** in `guide.md`:
   - no `[^` markers and no `confidence H|M|L`;
   - no finding id (`v4-<lens>-<n>`) and no gate code;
   - none of a short jargon list: ledger, claim, finding, lens, plan.json, compile record, dossier.
4. **The trace resolves.**
   - Each row's `Says` occurs verbatim in its section.
   - Each ref names an existing claim, plan path, record field, ledger entry, price or fact.
5. **Every number is traced and matches.**
   - Every number in the reader layer lies inside a traced `Says`.
   - Exempt: fenced blocks, headings, inline code, `Act <n>`, `Interlude <n>`, `T<n>`, dates, version
     strings, list numbering, the Changelog and the Known issues list.
   - **Matching a value** (`record`, `ledger`, `plan` or `data` ref): the number equals the value's
     magnitude rounded at the number's own last significant digit. "2,740" matches 2,736 and "about 400"
     matches 401.996.
   - **Matching a claim:** the claim's text contains the number.
   - **Matching a price:** the amount and currency match.
6. **Kept checks, re-pointed:**
   - the import code, now in `Your PoB file`;
   - the offline line;
   - D-234's one-line chaos exception, and D-219's "near the ceiling" in Checks, now for `m` too;
   - **reward picks:** a trace row in `Campaign route and rewards` citing
     `data:campaign/progress.json#q.<key>.options[<i>]` replaces the marker check (`:1020-1031`);
   - **Known issues:** each open finding's reader sentence appears in `guide.md` and its id in `audit.md`'s
     table, replacing the match by id (`:760-800`).

**What stays judgment,** for the prose lens and then the user at checkpoint 2 (the user's review of the
guide): advice versus fact, the tutorial rule, each caveat once, paraphrase fidelity, consistency, the verdict
words, the quality of fallbacks and priorities, and the 2,000-word floor.

## 8. G7: what is superseded or changed (PROPOSED)

| Where | Change |
|---|---|
| D-105 (`README.md:405`, every claim shows its source) | The source shows in `audit.md`'s trace, not inline |
| C-30 (`README.md:180-195`, the source tag; "every claim in … the guide carries one") | The guide carries none. Markers stay in the dossier and the research files |
| C-36 (`README.md:310-322`, which step writes which file) | W1 writes `guide.md` and `audit.md`; D1 writes three endgame stages |
| D-116, D-117, D-147 (`README.md:416-417, :447`, the budget and non-budget targets); D-219 (`:513`) | Add the entering-maps target and its ceiling (G5, Q1) |
| A-P3 (`02-plan-compiler.md:607`, each variant its own track) | The ladder is one track (G5, Q3) |
| Slice 03 §8 (`03-pipeline.md:459-477`, the guide's 13 required H2s) | Replaced by G1's 14 |
| Slice 03 §7.3 (`:420-428`, markers in markdown) and §7.4's prose lens (`:453-455`) | §7.3 no longer applies to `guide.md`; the prose lens as G3 |
| Slice 03 §2 (`:66-79`, the run-folder table) | Adds `audit.md` |
| AC-W11 (`:837-838`, the template's H2s); AC-W22 (`:937-940`, the guide review) | AC-W11 takes G1's H2s. AC-W22 adds the style rules: cap, voice, tutorial, each caveat once |
| Amendment 1 Q1 (`amendment-1-simplify.md:239`) and S7's claim rule 3 (`:33`) | Known issues sit under `What PoB can't show`; a caveat appears once (G3) |
| D-265 (d) (`worklog.md:746-747`, a known issue with its id in parentheses) | The id moves to `audit.md` |
| D-256's quoting rule (`references/stages/W1.md:92-93`, quote a hit's ledger value, 438.55, not the whole number) | The reader layer rounds ("about 440"); `audit.md` keeps the ledger value |
| `templates/guide-template.md` | Rewritten. Its "why this concept" (`:38`), ledger table (`:44-48`), Confidence (`:152-162`) and Sources (`:168-192`) parts go to `audit.md` |
| `references/stages/W1.md` | Rules 1, 6, 7 and 9 (`:48-49, :109-126`), "Keep every hedge" (`:128-131`), "Write for a newcomer" (`:133`), Writes (`:150-155`) |
| `references/stages/V4.md` | Locations (`:60-63`), `:119-121`, `:145-154`, the prose lens (`:156-181`) |
| `references/stages/D1.md` | The variant table (`:52-61`), hits (`:109-129`), prices (`:139-145`), ledger and claims (`:156-165`) |
| `references/stages/D2.md` | Plan backward to `m` (`:34-38, :51-56`); claims (`:87-92`) |
| `references/source-markers.md` | Markdown markers (`:35-63`), claim rule 3 (`:75-77`), Known issues (`:121-126`) |
| `references/gates.md` | The floor's area level (`:66-68`) and the budget (`:76-87`) for `m` |
| `SKILL.md` steps 10 and 14 (`:98, :102`); `references/run-folder.md:41` | `audit.md` |
| `scripts/check-run.mjs` | The heading constants (`:52-70`), `areaLevelOf` (`:298-302`), the guide's marker claims (`:550-571, :803`), sections and import code (`:714-748`), Known issues (`:760-800`), the reward citation (`:1020-1031`), the chaos line lookup (`:1597-1602, :1639-1650`), the budget (`:1711`) |

## 9. G8: implementation impact (PROPOSED)

**Files:**
- `templates/guide-template.md`: rewrite to G1.
- `templates/audit-template.md`: new, the G2 H2s and the trace format.
- `references/stages/W1.md`: voice, facts versus advice, the tutorial rule, each caveat once, the trace, the
  cap; writes both files.
- `references/stages/V4.md`: lens scopes per G3; trace locations.
- `references/stages/D1.md`: the `m` rung; load-bearing claims only; `judgment` claims for rules of thumb.
- `references/stages/D2.md`: plan backward to `m`; load-bearing claims; reward-pick reasons.
- `references/stages/D1-gate.md` and `references/gates.md`: `m`'s area level and budget.
- `references/source-markers.md`: trace refs; markers for the dossier and research only; rule 3; Known
  issues.
- `SKILL.md`, `references/run-folder.md`, `references/task-header.md`: `audit.md`, W1's writes, step 14
  writing both files.
- `scripts/check-run.mjs`: G6 and G5's checker items.
- `src/plan/schema.ts`: the `entering-maps` variant.
- `src/plan/checks/v1.ts`: the ladder track (A-P3).
- `docs/build-guide/plan-reference.md`: the variant value and the track rule.
- The spine and slice 03: fold this in at finalization, with amendment 1 and D-239…D-266.

**Tests:**
- `tests/static/buildGuidePipeline.test.ts`:
  - the AC-W11 block (`:726`) is rewritten to G1;
  - the marker and hedge tests (`:810, :884, :1054, :1137`) become trace, caveat-once and tutorial wording
    tests;
  - D-256 quoting (`:657`) moves to `audit.md`;
  - reward picks (`:1284`) go through the trace;
  - new: `m` in D1, D2 and the gates.
- `tests/unit/buildGuideCheckRun.test.ts`:
  - Known issues (`:355`, `:505`) match by sentence plus the `audit.md` id;
  - the reward citation (`:1350`) goes through the trace;
  - the pick-rule test (`:627`) reads `audit.md`;
  - new cases: the cap, markers and jargon, an unresolved trace row, an untraced number, a mis-rounded
    number, and `m`'s floor and budget.
- `tests/fixtures/pipeline/run-ok` and `run-ok-online`: a new-style `guide.md` plus `audit.md`.
  `run-escalated` has no guide and is unchanged.
- `tests/unit/planChecks.test.ts`: the ladder track and the new variant value.

## 10. Open questions for the user

- **Q1. The entering-maps budget ceiling.**
  - **Recommendation:** 1 divine, with up to 1.1 passing "near the ceiling" (D-219's pattern). That keeps
    the rung honest: mostly found gear and a few cheap rares, with the build-enabling unique only when it is
    that cheap, and otherwise the fallback setup.
  - **Alternative:** 5 divines, so that the rung includes the key unique more often.
- **Q2. First person as the advice label** ("I'd", "my order").
  - **Recommendation:** yes. Fubgun writes advice this way, and it marks advice without markers.
  - **Alternative:** an impersonal voice with a fixed lead-in such as "Tip:".
- **Q3. The ladder as one tree track,** `m` then `b` then `n`.
  - **Recommendation:** yes. V1 then checks every rung's respec and its gold cost.
  - **Cost:** a non-budget tree that drops budget nodes now needs a declared respec, which can move
    fixture verdicts.
- **Q4. Trade links.** The user adopted "trade links online", but `prices[]` keeps the query and no link
  (`docs/build-guide/plan-reference.md:261-269`), and offline runs have none.
  - **Recommendation:** slot targets as text now; add a link field with the live Titan / Blood Hunt run
    (WU-48), if the price tool returns a link.
