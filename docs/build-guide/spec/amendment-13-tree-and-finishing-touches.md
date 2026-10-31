# Amendment 13: a tree search judged on targets, the finishing touches, and the run's rough edges

**Status: APPROVED, revision 2, 2026-10-30.** Revision 1 followed the independent review (§26: four lenses, two
skeptical verifiers and a consistency pass); revision 2 folds the user's answer on HG-31, a file-only build's claims
pass (D-477, §15). The user approved it on 2026-10-30: "1. verify on file-only build. Approve." It formalizes the
amendment 13 candidate list (the coordinator's running list, items 1–5 and 7–14), with:
- the user's rulings of 2026-10-28 to 2026-10-30, quoted where they're used;
- the finishing-touches study in the user's private guide library (`analysis/finishing-touches/`, cited as
  [finishing]): one reference build, Lexd's Shield Wall + Rake Bleed Titan, measured piece by piece, and the
  library's 36 endgame guides surveyed;
- the tree experiment of 2026-10-29 (§2), measured on the Titan Rake live test's two builds (WU-126), cited as
  [experiment];
- a gap analysis of the candidates (2026-10-29), whose questions the user answered on 2026-10-30, and whose
  defaults the user saw;
- three read-only surveys of the code and docs (2026-10-29), cited by file and line, and re-read at `cbfa546`.

Item 6 of the list, charge generation, moved to amendment 14 (the user, 2026-10-29); it waits on reference builds
the user will pick.

It is written against spec v1.6 and amendments 8 to 12, all built (M-25). Paths are from the repository root, except
stage files (`D1-build.md` and so on), under `.claude/skills/build-guide/references/stages/`, and the skill's other
files, under `.claude/skills/build-guide/`. Decisions continue from D-463, work units from WU-127, criteria from
AC-W100 (pipeline), AC-P86 (plan compiler) and AC-K76 (server tools), risks from R-61, gates from HG-27; the milestone
is M-26. It adds PG-101 and PG-102 to `docs/build-guide/pob-gaps.md`. The plan schema gains version 9 (§5, §8, §9,
§10, §12; the list in §22). Each decision ends with the rows and rules it amends. Appendix A fixes the formats; §25 lists the user's
answers, the defaults the user saw and the proceed-on assumptions; §26 is the review.

**Names.**
- The **start of a rung's tree search** is the rung as D1-tree finds it, after the floor holds and the user's requests
  are applied: its `TotalEHP`, its lowest max hit (amendment 12's: the least of PoB's five per-type maximum hits
  taken, with its type), its boss figure and each boss-rotation entry's figure. D1-tree writes them in the plan as
  `tree.start` (§8).
- The **toughness targets** of a rung are its start's `TotalEHP` and lowest max hit. The tree search may trade
  toughness inside a move, but the finished tree meets both (the user's choice "A", 2026-10-29).
- The **boss figure** of a rung is the rotation figure: the ledger entry `boss_<stage>` when the plan has one, else the
  compile's `measures.damage.boss`. `boss_<stage>` is a hand estimate (D-447, `D1-finish.md`:149–179): its record
  references re-evaluate at each compile, so a tree move shows in it at once; its corrections (time shares for entries
  that take turns, trigger rates and the like) stand until the step that writes the entry re-checks them.
- The **pace exchange** is the user's 3× rule (2026-10-29): a move may cost X% of a pace figure when it gains at least
  3X% damage. The **pace figures** are the clear skill's uses per second, the clear skill's radius and movement speed.
- **Repair** is node power's step that buys back toughness after a damage refill: it frees the allocated branch with
  the least damage per point and adds the nodes with the most target gain per damage lost, until both targets hold.
- A **pinned weapon** is one item that sits in both weapon sets: the game lets the player pin it; PoB lets one item
  fill both slots (the user, 2026-10-28).
- A **draft** is the design gate's PoB file: `<name> (draft).xml` in the builds folder (§7).
- An **over-budget rune** is a "Legacy of …" soul core or the Raven-Touched Shard (§6; the shard is proceed-on).
- A **cheap unique** is a unique whose uncorrupted price is under 1 divine orb (§12; the user, 2026-10-30).
- A **revision-13 run** is a run whose log holds `skillRevision: 13`, read by boundary as amendment 12 set it up.

## 1. The user's direction

On the candidates (2026-10-28):
- Split Personality: "add it to the next amendment";
- the pinned weapon: "PoB2 doesn't require you to create a copy of an item to put it in both weapon sets, you can just
  assign the same item to both";
- ailment types: "ailments of different types *do* stack, and they all scale on four stats ... It would be a good thing
  to have in the library if a user asks for a poison build", and lines that change how ailments work, "making fire
  damage apply to bleed magnitude, or making bleed damage also apply stun, etc. This can often unlock powerful
  synergies"; "We can increase the word cap if necessary";
- the "Legacy of …" soul cores: "make sure the agents don't try to use any of those soul cores unless the user
  explicitly asks for it, since that soul core alone will exceed the non-budget variant cap";
- the brainstorm gate's text: the user agreed to six cuts ("Agreed"), about 700–900 words, the plain-words pitch as
  the main body.

On the design gate and the files (2026-10-29):
- "at the design gate, the user will want to see the PoB file before they make their decision to accept or revise";
  "Write a preview into the builds folder, include 'draft' in the title"; and, "Yes to both suggestions": F1 removes
  the draft once the final file is written; after `stop` the draft stays;
- "The build files are being named with the ascendency, skill, date, and id instead of the name used in the session,
  i.e. 'Royal Fury Rake Titan'"; "Accept both suggestions": refused characters replaced, a clash adds the run's date,
  then a counter;
- "The custom config lines in PoB will ignore any line that doesn't parse; this can be used to add comments to the
  lines ... I want the designers to add these so it's clear to a reader why 'Rake deals 20% more Damage' isn't just
  the build author inflating DPS."

On the tree search (2026-10-29):
- "I'm wondering if the designer is building the tree without the final gear or missing some config options";
- "in most cases speed is preferable to *very small* damage increases, but a big damage boost is always going to be
  better than a little bit more speed. Attack speed can come from a variety of sources, so prioritize damage in most
  cases"; "I'm less concerned about how long it takes than the quality of the output"; "Yes, 3x sounds good";
- the repair's target: "A" (the starting tree's EHP and lowest max hit, not the toughness band);
- on the boss guard: "I don't know if it's a good idea to have rules that strictly forbid a change based on a rigid
  metric, since it depends on the context. Is there a different way we can measure the skills separately while still
  giving the designers some flexibility?"; then "Yes" to the rotation figure as a target, each entry shown, the
  designer's reason and the alternative tree.

On the finishing touches (2026-10-29): they "are currently a big gap in our skill. Those are typically the finishing
touches that make the character viable for farming the hardest content"; "adding more levels to the skill will almost
always outperform any other single affix."

The answers of 2026-10-30, to the gap analysis:
- the tool contract changes: "yes to all"; the Titan Rake plans as test fixtures: "yes"; the library cap: "raise to
  17,000"; the bleed-to-stun example: "Bloodhound's Mark"; the edited draft and the comment lines: the recommendations;
  the pace exchange: "Yes, one rule for all three";
- corruption: "Corruption is random, and getting the corruption effect you're looking for is expensive because every
  failed attempt means starting over from scratch or buying a new item ... My suggested rule would be to allow
  corrupted mods on cheap uniques and skill gems, but don't factor that into the budget since the player can simply
  buy a bunch of the unique, then corrupt until they get the mod they need. Low level skill gems can be upgraded after
  they're corrupted, so it's cheaper to corrupt a bunch of low level skill gems until you get the +1 level corruption,
  then upgrade it to level 20. If the build uses a corrupted cheap unique or level 21 skill gem, the guide should
  mention this. Don't use corrupt mods on rares, since those cut the trade supply by an order of magnitude at least";
  and, on what counts as cheap: "anything less than 1 divine";
- flasks and charms: "Add life and mana flasks to the build, but the stats don't really matter unless the build uses
  some unconventional effect based on flask usage ('during effect of any flask', etc). For charms, we'll include those
  in the 'finishing touches' survey, so for now just leave them empty";
- the swap loop's guard: "30 swaps is fine, just inform the user at the gate if the cap gets hit";
- timeless jewels: "they can be incredibly powerful, but usually in very specific cases. We should follow up on that
  ... Skip for now";
- the second anoint: "the raven-touched shard soul core is currently 196 divines, so it's too expensive for our budget
  cap".

## 2. What the studies showed

**The tree search leaves damage on the table** ([experiment], on each build's `n`, the non-budget rung). PoB's node
power showed Coated Arms +20.2% for 4 points, Impair +19.8% for 4, Crushing Verdict +24.2% for 3 and five more
notables 3–4 points off the bleed-and-poison build's tree (r2-s-2), on the record's own map figure: not gear, config
or radius. The causes, read in `pob-api/API/NodePower.lua` and the run's transcripts:
- the swap search frees the 5 weakest branches by damage alone (`NodePower.lua`:37–45); Block, Shield Defences and
  long Strength chains fail the 2% EHP guard, the tries run out, "none". The guard-safe Bleed Chance branch [43778]
  (3 points, no EHP), freed for Crushing Verdict, gains +20.1%;
- that swap is still refused by the clear skill's uses-per-second guard (`D1-tree.md`:55–59 passes `clearUses: 2`):
  Crushing Verdict's 5% reduced attack speed costs Rake 2.55%, though the damage figure already counts the slower
  attacks;
- the rebuild found +88% at −20% EHP and was dropped, and nothing showed the user the damage option;
- attribute nodes beyond the requirements were kept (Strength 319 against 157 needed, Dexterity 197 against 157);
- the weapon-set-2 pool ranks by the main group's figure, which is 0 on set 2, so the boss skill's own passives are
  never ranked against the boss figure (a pool ranks by Full DPS only when the main group sits in the other set's
  weapon slot, else by Main damage, `NodePower.lua`:1477–1501; D-437).

**Rebuild, then repair.** On each `n`: `rebuild` at `max_distance` 12, `keep` only the structural needs (splash,
Rage, Doomsayer, Blood Magic, Cranial Impact, the weapon-set pools), guards off; then a repair by hand, freeing the
weakest damage-per-point branch (3–4 points) for the best EHP-per-point nodes (Backup Plan [53853] with [36170], plain
Armour):

| Build | Rake (map) | EHP | Lowest max hit | Rake uses/s | Shield Wall (set 2) | Life |
|---|---|---|---|---|---|---|
| r2-s-2 | 170,138 → 310,159 (+82%) | 17,585 → 20,674 | 3,627 → 3,673 | 0.998 → 0.998 | 444,061 → 666,873 (+50%) | 3,138 → 2,943 |
| r2-s-1 | 363,901 → 702,261 (+93%) | 20,102 → 21,893 | 4,019 → 4,045 | 0.933 → 0.898 | 339,412 → 541,396 (+60%) | 3,467 → 3,298 |

- **Not binding:** the distance cap (reach 6 and 12 gave the same top nodes and rebuild), the 3% swap floor, the
  8-swap cap and the boss guard (the boss figures rose).
- **Binding:** the 2% EHP and max-hit cap per move with no repair; the speed guard; the one-sided search (only damage
  branches freed, only damage nodes added); the rebuild judged under the per-move guards.
- **Plain node power isn't the answer:** its rebuild ranks on damage only and drops 20% EHP. What worked is "maximize
  damage while toughness stays at the start". After it, swaps still found +4.4% (r2-s-2) and +2% (r2-s-1).
- **Caveats:** the lean trees drop the Herald Damage nodes, which PoB doesn't measure (Herald of Blood shows 782 DPS),
  so a rebuild-first search needs a complete needs list; Backup Plan's 40% armour holds only when not hit recently
  (without it r2-s-2 still sits at about 17,900 EHP); Life fell 5–6%, elemental max hits 3–4%; not compiled through V1.

**The finishing touches** ([finishing]). Lexd's Shield Wall is about 6× the bleed-and-poison build's under the same
assumptions. Each piece taken out alone loses: 6 extra Shield Wall levels 57%; Poison III on Shield Wall 28%; four
set-2 crit damage passives 26%; Supercritical 20%; Megalomaniac (Greatest Defence) 16%; Crimson Assault 16%; a
Time-Lost Emerald 13%; the gloves' magnitude lines 11%; fully broken armour 10%; Heart of the Well 8%. Most are cheap
(jewels 0.5–14 divines; Brass Dome, Nebuloch and Constricting Command under half a divine); the +2-level gloves cost
20–70 divines. Across the 36 endgame guides: Heart of the Well in 28 (18 of 24 PoBs roll the build's extra-damage
element), Time-Lost rare jewels 18, From Nothing 16, timeless jewels 10, Prism of Belief 7, Megalomaniac 6; corrupted
gear 31 (the main gem corrupted to 21 in 13); an amulet anoint 33, an anoint-only notable 13; a second anoint 9; the
amulet's +3/+4 levels 30; unique charms 31 and flasks 24. Melee main skills carry a median +7 levels from gear, spells
+12. Lexd's supports don't transfer alone: Poison III and Supercritical in r2-s-2's Shield Wall cut it 20% (no poison
chance beyond the gem, no crit bonus to stack).

**The live run's rough edges** (the Titan Rake run, 2026-10-28 to 2026-10-29): node power's `free` refuses
weapon-set nodes, so a set-1 need reads "not measured"; `compile_stage` hit the engine's 30 s limit twice on a 3-rung
plan, and the next call said the loaded build couldn't be restored; the checker read `[^|]` inside a code span as a
footnote marker, refused a definition holding two refs joined by `;`, and had no piece kind for an anoint; D1-build left
a stray file in the repository root; a stale session server sent three trade searches 4–9 s apart.

## 3. What already fits

- **PoB models Split Personality's start.** The jewel parses to `AlternateClassStart` (`Modules/ModParser.lua`:
  2755–2756, `Classes/Item.lua`:2075–2077), and PoB paths through that start while the jewel sits in an allocated
  socket (`Classes/PassiveSpec.lua`:1403–1412, :1770–1777, :1989–1991). Only our checks refuse it (§4).
- **The needs rule exists:** a node that feeds only another damage group is a need (`D1-build.md`:316–317); §8
  makes the list complete enough for a rebuild-first search.
- **The rebuild exists** (`NodePower.lua`:84–89) and so do the guards (:50–56, :115–125); §8 adds a repair and
  targets to it.
- **The rotation formula exists:** D1-finish's `boss_<stage>` weights each entry by its share of the fight
  (`D1-finish.md`:150–175); §9 moves it to D1-build and makes it the boss figure.
- **The write ledger and the writer** (D-211, `src/plan/compiler.ts`:921–949; `src/services/buildFileWriter.ts`:
  1–25, the backup step at :17) already decide when a builds-folder file may be replaced; §7 adds a draft and a delete.
- **The custom-modifier parse rule** is PoB's own: a line is applied only when it parses whole
  (`Modules/ConfigOptions.lua`:2279–2297); our compiler mirrors it (`pob-api/API/Compile.lua`:830–843, :1085–1088), so
  a comment can be written once the compiler expects it (§10).
- **Gem corruption is modelled:** PoB keeps `corrupted` and `corruptLevel` per gem and adds the level
  (`Modules/CalcSetup.lua`:1874–1885); our bridge sets PoB's four states (`pob-api/API/BuildOps.lua`:2006–2014).
- **Item corruption lines are enchants** in PoB2: the corrupt dialog writes its outcome as an enchant line
  (`Classes/ItemsTab.lua`:2767, "currently enchants are always either corruptions or anoints"), and a `Corrupted` line
  marks the item (`Classes/Item.lua`:438–442).
- **The pace floor exists** (D-461, `src/server/createServer.ts`:254–262); only its visibility is missing (§15).
- **The run's revision mark is ordered** (`run-log.mjs`:206, amendment 12 §22); this amendment stamps 13.

**Contracts this amendment touches:**

| Contract | Tag | Delta | Compatibility |
|---|---|---|---|
| C-31 plan file | modified | schema 9: a Swap slot's `sameAs`, a gem's `corrupt`, `tree.start`, `tree.end`, `tree.search`, a required one-line custom-modifier reason (§5, §8, §9, §10, §12, §22, Appendix A) | schema 1–8 plans compile as before |
| C-33 record | unchanged | the boss figure reads the ledger the record already evaluates (`src/plan/record.ts`:1509); `customModsWritten` stays the modifier lines only, its doc (`record.ts`:1421–1422) noting the `#` comments written beside them (§10) | `RECORD_VERSION` stays 2 |
| C-41 `compile_plan` | modified | a draft mode (write, `remove_draft`), `first_free` names, comment lines on schema 9, Split Personality's start (any schema), the pinned weapon, gem corruption, V1's `corruption` (§4, §5, §7, §10, §12) | `measure_only` with `build_name` is still refused; old calls unchanged |
| C-17 build-file writes | modified | a delete, backed up first, for a draft only (§7) | additive |
| C-55 `get_node_power` | modified | `targets`, `pace_exchange`, `pool_groups`, the attribute guard, `free` on a pool node, Split Personality's start (§8, §15) | a call without the new arguments returns what it returns today, but for the attribute guard (§8) |
| C-48 `update_tree_delta`; D-360's path tools | modified | paths may leave the start a socketed Split Personality names (§4) | a call refused before may now succeed |
| C-14 `find_upgrades`; D-71 `search_trade_items`, D-72 `get_item_price` (stabilization) | modified (additive) | a pace line on every reply that may send a search, errors included; `find_upgrades`' search link stays last (§15) | one added line |
| C-36 stage artifacts | modified (additive) | `trades.json` kind `boss`; the design field's boss entries; the run log's `displays[].numbers`, `builds[].draftFile`; `skillRevision` 13 (Appendix A) | a run at revision 12 reads as before |
| C-52 cards | unchanged | the over-budget rule reads the cards' Pieces rows (§6) | none |
| C-53 pattern library | modified | the ailment-type entry, the pivots, the Split Personality line, the cap 17,000 (§11) | the stale "12,000" in C-53 is corrected at integration |

## 4. D-463: Split Personality's start

The user's request (2026-10-28). Split Personality, a Ruby limited to 1, has one variant per start (Mercenary, Ranger,
Shadow, Sorceress, Templar, Warrior; `Data/Uniques/jewel.lua`:66–82, itself `Corrupted`). Today the connection check
seeds only the class start and the ascendancy start (`Compile.lua`:605–607), and `tree_starts` adds only an
ascendancy's alternate starts (:344–366), so a tree grown from the jewel's start is refused. As M-25 did for Voices:
- **The compiler** (`check_tree`, `tree_starts`): when the stage socketed Split Personality in a socket connected
  **without** the jewel's own start, the start its variant names joins the seeds and the stage's `starts`, with
  `grantedBy` the socket and `grantedByName` "Split Personality". This is stricter than PoB, which also accepts a socket
  reachable only through the start it opens (`PassiveSpec.lua`:1403–1412 reads any allocated socket); the game's
  behaviour is unverified, so the stricter rule stands (proceed-on, R-63).
- **V1's `tree-shape`** counts the jewel's start like any open start: it holds at most one tree (D-360's limit gains
  one start, not one tree).
- **A variant that names the class's own start**, or a start the ascendancy already opens, adds nothing: V1 reports
  it (`tree-shape`, rule `alternate-class-start`).
- **Node power** counts the jewel's start in `start_counts` (`NodePower.lua`:623–658) and seeds it in `unreached`
  (:677–700), so its swaps and rebuilds keep that tree legal (§8), with the compiler's rule: only while the socket is
  reached without the jewel's own start, so a move that frees the class-side path to the socket loses the start.
- **The path tools** (`find_path_to_node`, `get_nearby_nodes`, `update_tree_delta`'s auto-path) may leave that start
  for a tree it doesn't hold yet: `treeStepRule` (`src/services/treeService.ts`:384–413) treats it as an open start,
  from the loaded build's socketed jewel, under the same rule. `update_tree_delta`'s auto-path uses PoB's own pathing
  (`pob-api/API/BuildOps.lua`), which takes PoB's looser rule, and keeps it: a tree it makes that the compiler's rule
  refuses is refused at the compile, as any illegal tree is.
- **A spike compile first** (B3's import-order bug was found only by its test compile): a fixture stage with the jewel
  socketed and a tree from the Warrior start compiles with no connection defect, before the rest of the unit.
- **The library** then drops "but our compiler doesn't yet accept that start" (`patterns.md`:1258–1260).

Amends D-360 (one more kind of open start), C-41, C-55, C-48 and D-360's path tools, `Compile.lua`'s `check_tree`
and `tree_starts`, `src/plan/checks/v1.ts`'s `checkTreeShape` (:620–668), `NodePower.lua`, `treeService.ts`,
`patterns.md`'s "Radius jewel instead of an anoint".

## 5. D-464: a pinned weapon in both sets

Today a plan names each slot once (`src/plan/schema.ts`:240–244), and the compiler adds a new item for every slot
entry (`Compile.lua`:1567–1576; the off-hands at :1483–1484, :2590), so the same text in `Weapon 2` and `Weapon 2
Swap` makes two items, and the pricing counts a shared entry once per slot (`render-audit.mjs`:236–237).
- **The plan** (schema 9): a Swap slot entry may be `{slot: "Weapon 1 Swap", sameAs: "Weapon 1"}` or `{slot: "Weapon 2
  Swap", sameAs: "Weapon 2"}`, in place of `text`. Only a set-1 weapon slot and its own Swap slot share (the game's
  pin rule beyond that is unverified, proceed-on). The named slot must hold an item on the stage; a `sameAs` on any
  other slot, or naming an empty slot, is an error at its path.
- **The compiler** puts the set-1 slot's item id in both slots (PoB's `itemSet[slot].selItemId`), so the saved file
  holds one item. A spike compile first: PoB accepts one item id in two slots, and the record's set-2 measure equals
  a compile with two copies.
- **A shared Swap slot still uses set 2**: `useSecondWeaponSet` and V1's `empty-weapon-set` read it as filled.
- **Pricing counts it once:** D1-finish writes no price entry for the shared slot; the D1 gate's budget part
  (`gates.md`:86–89, `D1-gate.md`:95), the checker's "every filled slot priced" (`check-run.mjs`:5712–5724) and
  `rungBudget` (`render-audit.mjs`:242–270) map it to the set-1 slot's entry and count that entry once for both (today
  they share an entry only for identical item text, and a `sameAs` slot has none).
- **The guide** says to pin the weapon: one line where the gear names it.

Amends C-31, C-41, D-249's slot rule (one entry, two slots), `schema.ts`'s items, `Compile.lua`'s `equip`,
`check-run.mjs`'s `recomputeBudget`, `render-audit.mjs`'s `rungBudget`, `D1-finish.md`'s prices, `gates.md`'s budget
part, `D1-gate.md`:95, W1 and the guide templates' gear lines, `plan-reference.md`.

## 6. D-465: over-budget runes only on request

The "Legacy of …" soul cores are made with Aldur's Legacy and cost hundreds of divines; `n`'s whole budget is 100–200
divines (`pricing.md`:90). The Raven-Touched Shard (`Data/ModRunes.lua`:5675), the helmet rune that adds a second
anoint, cost 196 divines on 2026-10-30. Today nothing keeps them out: pricing sends a Legacy core to the trade site by
name (`pricing.md`:242), and D1-build's culling example is one ("Legacy of Deathblow's Culling Strike",
`D1-build.md`:219).
- **The rule:** research and design leave every over-budget rune out unless the brief asks for it: the brief's
  `around`, `like` or `notes` names it (or "Legacy" cores generally), or a gate answer's words name it. Names match
  "Legacy of " at the start (the pin has 63 such cores in `ModRunes.lua`; the league file
  `data/league/runes-of-aldur.md`:142–157 lists 16 of them, so the rule matches the prefix, never a list), and
  "Raven-Touched Shard" (proceed-on: the user called it too expensive for the budget cap); never a name merely
  containing "Legacy" (Coward's Legacy).
- **The checker** fails a card's Pieces row with status `in` or `scheduled`, or a plan's item text holding a rune line
  of an over-budget rune, without the brief's say (`around`, `like`, `notes`) or a gate answer's (the run log's
  `checkpoints[].answer`, `changes` and `note`, `references/run-log.md`:34). `out` rows and research mentions are
  allowed. It applies to a card dealt, or a build whose last D1 gate ran, at or after revision 13's boundary (§22). The
  server can't see the brief, so there is no server rule.
- **The culling examples** are replaced by a node or support confirmed by lookup: D1-build's and the plan reference's
  (`plan-reference.md`:424, :452).
- **No second anoint:** the Raven-Touched Shard is the only way to one, so designers don't consider it (gap 11e,
  dropped).

Amends `R1a.md`, `R1a-synthesize.md`, `R1b.md`, `D1-build.md` (:217–219 and its gear rules), `plan-reference.md`
(:424, :452), `pricing.md`:242, `check-run.mjs`, the researcher agent's definition where it lists what cards may carry.

## 7. D-466: the draft PoB file and the files' names

**The draft** (item 7). Today the design gate shows numbers only (`checkpoints.md`:259–376), and the first PoB file the
user sees is F1's. A measure-only compile already writes `compiled-build.xml` beside the plan (`src/plan/record.ts`:94)
and refuses `build_name` (`src/handlers/planHandlers.ts`:96–105, D-208).
- **A draft mode of `compile_plan`** (C-41): `{plan_path, draft_name}`, no `measure_only`, no `stages`; `draft_name`
  is the build's session name (below). It runs no engine (the router gives a draft-mode call engine kind `none`,
  `src/server/toolRouter.ts`; today `compile_plan` is `load`, `toolMeta.ts`:56): it copies the run's
  `compiled-build.xml` into the builds folder through `buildFileWriter` (kind `bytes`) and the write ledger (D-211).
  The server cleans the name (below) and appends ` (draft)`; when that file is one the user changed, or one this build
  didn't write, it uses ` (draft 2)`, then ` (draft 3)` (drafts have no dated form). It is refused when the plan's sha1
  isn't the last compile record's `planSha1`, or that compile named `stages` (the draft is the whole plan as the gate
  saw it). Its reply names the file it wrote (proceed-on: a copy, not a compile).
- **When:** the D1 gate's step 6 writes it on a pass that leads to the design gate (a new rule: today step 6 writes the
  verdict on every attempt, `D1-gate.md`:164); each `revise:` that passes again overwrites it. On an escalation's
  `accept`, which goes on to the design gate as if the gate passed (`SKILL.md`:260–262), the runner calls the draft mode
  before the design gate.
- **A draft the user changed** (saved in PoB, 7d) is never overwritten or removed: the ledger's changed-on-disk test
  finds it, and the next draft goes to ` (draft 2)`.
- **F1 removes it** after the final file is written: `compile_plan {plan_path, remove_draft: <the path in
  builds[].draftFile>}` deletes that file through `buildFileWriter`'s new delete, which backs it up first
  (`<stateDir>/backups/<relpath>/<id>_before-delete.xml`) and drops its ledger entry. It refuses anything but a draft
  this build wrote (the ledger entry's `kind` and `plan`, below), or a file changed on disk; F1 then leaves it and
  records `draftLeft: <path>` in its verdict (Appendix A), which the final display prints. After `stop`, a dropped build
  or an escalation stop, the draft stays: it is the build's only file.
- **The ledger** (D-211) gains, per entry, `kind` (`final` or `draft`) and `plan` (the plan path that wrote it), at
  ledger version 2 (`src/plan/writeLedger.ts`:25–35 keys on the run folder only today); a version-1 ledger reads as
  `kind: final` with no `plan`.
- **The run log** holds the draft's one home, `builds[].draftFile` (the latest draft's path): the runner records it
  from the draft mode's reply, on a gate pass and on an escalation's `accept` alike, and sets it to null after F1
  removes the draft. The design display prints its name in one line.

**The names** (item 8). Today `buildName` is `<slug>-<YYYY-MM-DD>-<n>-<card id>` (D-412; `F1.md`:18, `SKILL.md`:249),
with `-campaign` for a campaign's file (D-415, `SKILL.md`:305), held by the checker (`check-run.mjs`:1408–1428).
- **The name** is the build's session name: `builds[].name` when a revision renamed it (D-435), else the card's `name`.
  The final file is `<name>.xml`, the draft `<name> (draft).xml`, a campaign's `<name> (campaign).xml`.
- **Cleaned** by the server (under `first_free` and in the draft mode): each character Windows refuses
  (`< > : " / \ | ? *`) is replaced with a space, runs of spaces become one, a trailing `.xml` goes, leading spaces and
  trailing dots and spaces go (as built, WU-129: a name starting with a space hides in PoB's list), and an empty
  result is refused; a name
  that is a Windows device name whole (CON, PRN, AUX, NUL, COM1–COM9, LPT1–LPT9) gains " (build)" (proceed-on: the
  user accepted "replaced"; a space is the replacement). Names compare without case (D-52).
- **The first free name** (`first_free`, on a build's **first** final write, F1's, and on its first campaign write, the
  D2 gate's): the cleaned name; then `<name> <run date>`; then `<name> <run date> <k>` from 2; a campaign's ends
  ` (campaign)` after the date (`<name> 2026-10-28 (campaign)`). A name is free when no file has it, or **this build**
  wrote it (the ledger's `plan`) and nobody changed it. The run date is the run folder's `<YYYY-MM-DD>` segment. The
  server returns the name it chose (the record's `pobFile.path`), and the runner records it in `builds[].pobFile` (the
  campaign's where D-415 records it today).
- **Re-compiles** (a revision's F1 over the endgame file, a later D2 gate over the campaign file) pass that file's
  recorded name as `build_name`, without `first_free`, so D-211's refusal over a file the user changed, and F1's
  escalation, stay as today (`F1.md`:48–62).
- **The checker** cleans each run-log name by the rule above, accepts the three forms of a final or campaign name and
  the two of a draft (` (draft)`, ` (draft <k>)`) from them, fails two
  builds recording one file, and no longer derives `<runName>-<id>`, for a build held to revision 13 (§22); an older
  build keeps its rule.
- The run folder, date and card id stay traceable through the run log and the record.

Amends D-208 (a measure-only compile still writes no builds-folder file; the draft mode is its own call), D-211 (the
ledger also keeps drafts and drops a deleted one), D-412 and D-415 (the names), D-413's "F1 is the only write of the
final file" (unchanged; the draft is another file), C-17, C-41, `planHandlers.ts`'s `compileRequestOf`,
`compiler.ts`'s `checkTarget`, `writeLedger.ts` (version 2), `buildFileWriter.ts`, `toolRouter.ts` (the draft mode's
engine kind), `D1-gate.md` step 6, `F1.md`:18 and its steps, `D2-gate.md`:18, `SKILL.md`:249, :260–262 and :305,
`checkpoints.md`'s design gate, `run-log.mjs`, `check-run.mjs`:1408–1428, and the coordinator's standing rules that
allow builds-folder writes only through a final compile and state the old `buildName`
(`.claude/agents/build-guide/build-guide-coordinator.md`:20–23, :31–33, :152–155; `references/task-header.md`:38;
`references/fix-round.md`:107–108).

## 8. D-467: the tree search judged on targets

The user's rulings of 2026-10-29: rebuild first at reach 12; repair to the start's EHP and lowest max hit; a swap loop
with a 1% floor and no 8-swap cap (a runaway guard of 30, surfaced at the gate); the pace exchange; attribute needs
become a requirement check; targets on the finished tree and visible trades, not vetoes on each move. This
**supersedes** D-418's swap floor (3%) and cap (8), D-456's boss guard (§9), and D1-tree's per-move EHP and max-hit
caps (`D1-tree.md`:55–60).

**Node power** (C-55; `NodePower.lua`), new arguments, each off when absent:
- **`targets {ehp, maxHit}`**: the toughness targets. With them, the `TotalEHP` share of `maxLoss` and the `maxHit`
  guard no longer judge a move: a swap, a rebuild or a `free` refill is legal when its result's `TotalEHP` and lowest
  max hit are at or above the targets.
- **Repair**, under `targets`: after a refill (a rebuild's, or a swap's) that misses a target, free the allocated
  branch outside the protected nodes with the least first-stat loss per point, and add the unallocated nodes whose
  paths fit with the most gain on the failing target per first-stat loss (EHP and max hit both counted when both
  fail), PoB recomputing paths after each pick; repeat until both targets hold, or no step raises a failing target.
  A repaired result that still misses a target is reported with its figures and isn't legal. The reply names each
  repair step's points.
- **The swap search under `targets`** judges each try after its repair; a try the repair can't bring to the targets
  doesn't count toward the 5 legal tries, while the 40-try cap stays (proceed-on: the experiment's tries ran out on
  over-limit branches, §2).
- **`pace_exchange: <r>`** (D1-tree passes 3): each pace figure (the clear entry's uses per second and radius, the
  movement speed) may fall by L% when the move's `MainDamage` gain G% is at least r × L, each figure on its own
  (proceed-on); a figure that falls more is over its guard. With `pace_exchange` the three pace guards' `maxLoss`
  values are ignored. A call with `pace_exchange` whose `stats` lack `MainDamage` is refused (the exchange buys damage
  with pace, nothing else).
- **The attribute guard**, always on: a move is legal only when its result meets PoB's own `ReqStr`, `ReqDex` and
  `ReqInt` (PoB has already applied its satisfaction flags to them: `IgnoreAttributeRequirements`,
  `StrengthSatisfiesMeleeWeaponsAndSkills` and gems met by the highest attribute, `Modules/CalcPerform.lua`:1832–1910).
  A tree V1's `attributes` finding would refuse is never a legal swap (proceed-on: on by default).
- **`pool_groups {"1"?: <group>, "2"?: <group>}`**: a weapon-set pool ranks by that group's figure (the `MainDamage`
  Count rule on that group) on the boss config, in place of what it ranks by today (§2's set-2 finding). Node power sets
  the config itself, as the compiler's `measure_boss` does (`enemyIsBoss` "Pinnacle", the mod list rebuilt, put back
  after; `Compile.lua`:2377, :2508), without calling the compiler. Only the ranking figure is read on the boss config:
  the pool's EHP, max-hit and pace guards stay on the map config, against the same targets (proceed-on: the boss
  config, R-64). D1-tree passes it only for a weapon set that doesn't hold the clear (main) group, naming the boss
  rotation's largest entry on that set; the clear group's set keeps `MainDamage` on the map config, since the clear is
  what the build is judged on.
- **A stale server:** `get_node_power` ignores keys it doesn't know (`treeHandlers.ts`:804–817), so a session server
  built before M-26 would run D1-tree's loop under the old guards without a word. D1-tree's first call checks that the
  reply's rebuild line names its targets, in either of Appendix A's forms (`(target …)`, or `misses its targets after
  repair: … of …`); when it doesn't, D1-tree stops with the outcome `stale-server` (`run-log.mjs`'s D1-tree outcomes
  gain it beside `done` and `respec`, :189), and the runner asks the user to reconnect with `/mcp`, then re-runs
  D1-tree.
- **`free` on a weapon-set node** frees it within its pool and refills from that pool's candidates, as a pool move
  (today it refuses tagged nodes, `NodePower.lua`:90–93).
- **Split Personality's start** (§4).

**D1-tree** (`D1-tree.md`), on each rung, in this order:
1. **The floor first** (unchanged, :113–116), then **the user's requests** (unchanged).
2. **The start:** compile the rung and write `tree.start` (Appendix A): `TotalEHP`, the lowest max hit with its type
   (the map measure's, `measures.toughness.lowestMaxHit`, which node power reads too), Life, the boss figure and each
   boss-rotation entry's figure. It is written when D1-build ran before D1-tree in this attempt, or after a user's
   tree request; a gate `tree-swap` retry keeps it, so a later attempt can't hide an earlier attempt's fall.
3. **Rebuild first:** `rebuild: true` at `max_distance: 12`, with `targets` from the start, `pace_exchange: 3`,
   `pool_groups`, `keep` = the rung's needs, `stats: ["MainDamage", "TotalEHP"]`. When its result is legal and gains
   Main damage, it is a change (§9's boss target applies). A rebuild that the compile check, the floor, a V1 finding or
   the boss target undoes writes **no** need (today an undone change's removed nodes become a floor need,
   `D1-tree.md`:107–111, which would freeze the whole tree): D1-tree records `rebuild: "undone: <why>"` for the rung.
   Spare points and the socket tests follow (unchanged, but the socket test's 2% guard becomes the same targets,
   `D1-tree.md`:164–171).
4. **The swap loop:** the same arguments, compact; while the best swap (main or pool) gains at least **1%** Main
   damage, make it a change and call again; stop at "none", under 1%, or after **30 swaps** on the rung, an undone one
   counted (`tree.search.swaps` counts undone swaps too).
5. **No unspent point** and **what PoB can't measure** (unchanged, :190–202).
6. **What the rebuild removed for other skills:** each removed passive whose lines name a skill or skill type the build
   uses other than the named source (a Herald, a warcry, a minion).
7. **The end:** D1-tree writes `tree.end` (the same figures as the start, on its finished tree, before D1-finish) and
   `tree.search` (Appendix A): the swaps tried (undone ones included), the last swap's gain, whether the cap of 30 was hit, the rebuild's
   outcome and step 6's removed passives. The D1 gate copies them into the design field, so a `design:` resume
   reprints them; the design gate prints the cap line (`Swap cap on <rung>: 30 swaps, the last +<x>%`) and the
   removed lines (`Removed on <rung>: <names>: lines for <skill>`), so a missing need is visible.

**The needs list is complete** (D1-build): beside today's cases (`D1-build.md`:307–323), a need for every node that
serves only another damage group or a mechanic PoB doesn't measure (the Herald Damage passives that feed a second
clear skill), and **no attribute need**: the attribute guard keeps the requirements. In a revision-13 run, D1-build
drops any attribute need a plan it edits carries.

**The D1 gate's tree part** (D-419, `D1-gate.md`:135–161) runs the same judge at reach 12: the swap search and the
rebuild with repair, with D1-tree's arguments and the plan's `tree.start` as `targets`; either result beating the
rung's tree by **5%** Main damage fails the part (unchanged threshold), one `tree-swap` finding per rung. On a rung whose
`tree.search.rebuild` is `undone: <why>`, the judge runs the swap search alone, and the design gate prints the
`Rebuild undone on <rung>: <why>` line.

**D1-finish's node power calls** (its defence and damage trades, `D1-finish.md`:292–301) pass D1-tree's arguments
**without `targets`**, so their `max_loss` allowances judge EHP as today (D-448's three). The damage trade passes
`pace_exchange: 3` in place of `clearUses: 2` (the user's one rule); the defence trade, which buys toughness, passes
no `pace_exchange` and keeps `clearUses: 2`.

**Conditional toughness:** the targets are the map measure's. A repair that buys toughness with a conditional line
(Backup Plan's armour "if you haven't been Hit Recently", [experiment]) is visible on `n` in the conditioned read
(D-449, every condition against the build), which the gate already shows; no new rule.

**What the user sees** (Appendix A): each rung's Life before and after (Life isn't a target, the user's toughness
reading is EHP and max hit; it is shown); the swap cap line; the removed-for-other-skills lines. On `n` under its
toughness band, D1-finish's defence trades stay (D-441), and the gate also shows the best damage move as a `damage`
trade. D1-finish's 15% trade allowance stays (a trade the user picks, not a veto; `D1-finish.md`:272, :296).

**The regression case** (the user's grant, 2026-10-30): the Titan Rake run's r2-s-1 and r2-s-2 plans (the pipeline's
output, in the user's guides folder) are copied unchanged into `tests/fixtures/plans/titan-rake/`, and an engine test
holds the rebuild with repair on their `n` to at least half the experiment's gain (§20; the bar is proceed-on). The
copy is WU-127's first
step; no other file of the guides folder is read.

Amends D-418 (`keep`, the 3% floor and the 8-swap cap), D-419 (the gate's judge), D-437's pool ranking, D-439 (the
rebuild's order and judge, `free`, the undo of a rebuild), D-452's needs per rung (no attribute need), C-55,
`NodePower.lua`, `src/engine/schemas.ts` (the `node_power` request and reply), `src/server/toolSchemas.ts`
(`get_node_power`), `D1-tree.md`, `D1-gate.md`:135–161 and step 6's design field, `gates.md`'s tree part
(:127–131, :317, "within `max_loss`"), `D1-build.md`'s needs (:307–323), `D1-finish.md`'s trades.

## 9. D-468: the boss figure as a target

The user's ruling (2026-10-29): judge the boss on the rotation, set a target on the finished tree, show each entry,
and give the alternative; a cut to one entry is a reason the designer gives, never an undo. The one undo left is the
agreed floor on `n` (below). This **supersedes D-456's boss
guard** in D1-tree (a move that cuts any entry by more than 2% was undone, `D1-tree.md`:102–111) and its trade line in
D1-finish (`D1-finish.md`:258, a cut over 2% named in the trade's `reason`).

**A correction:** `measures.damage.boss` isn't turn-aware. It sums the untriggered entries, each non-stacking ailment
once at its largest, and ignores `turns` (`src/plan/record.ts`:1092–1107). The rotation figure is the ledger's
`boss_<stage>`, which weights each entry by its share of the fight (`D1-finish.md`:150–175).
- **D1-build writes `boss_<stage>`** with `skills.boss` whenever today's rule requires it (a triggered entry or one with
  `turns`, `D1-build.md`:222–235); otherwise `measures.damage.boss` is right and no ledger entry is needed. D1-finish
  re-checks the entry after the anoint and the gear, as it writes it today.
- **The boss figure** is that entry's evaluated value (the record's `ledger`, `record.ts`:1509), else
  `measures.damage.boss`.
- **The target, on `n`:** the boss figure stays at or above `boss-floor.json`'s floor (250,000), an agreed floor (the
  user's ruling: "a target for the finished tree"): a change of D1-tree's own that takes it under is undone. A figure
  that falls under the floor after D1-tree (D1-finish's anoint or gear, a user's request) is D-448's case, a shown
  damage trade, not a failure; so is an `n` whose start is already under the floor. `m` and `b` have no floor, so no
  target.
- **Each entry shown:** the design field carries, per rung with a boss rotation, each entry's figure at D1-tree's
  start and end (`tree.start`, `tree.end`, so the change is the tree's alone) and the gate's final figure. When the
  boss figure or any entry falls from start to end, the designer says why, one reason that may cover several entries
  (the user's ruling: the designer says why "a fall is fine"): D1-tree writes it in `tree.search.bossFall`, and
  D1-finish turns it into the claim `boss-fall-<rung>`, which V4 checks like any hinge claim.
- **The alternative tree:** when `tree.end`'s boss figure is below `tree.start`'s, D1-tree writes a `boss` trade: the
  best tree it measured during the search whose boss figure is at least the start's (the start's own tree when none is
  better; proceed-on), with the nodes to remove and add against the final tree, its damage, EHP and boss changes. The
  user takes it with a `revise:` at the design gate, which reaches D1-tree as a user's request. D1-finish, which writes
  `trades.json` whole, keeps D1-tree's `boss` entries as it keeps the `unmodelled` ones (`D1-finish.md`:244–246).
- **A buff entry** (a warcry whose own hit is its figure) is valued, where its own figure misleads, by the boss figure
  with and without it on a temporary stage, and the display shows that value with its reason (the designer's
  judgment), from the entry's `valuedBy {figure, reason}` (Appendix A).

Amends D-456 (superseded in D1-tree and D1-finish's cost line), D-447's boss rotation (`boss_<stage>` written by
D1-build), D-448's floor (a target D1-tree holds), `D1-build.md`:222–235, `D1-tree.md`'s Check and Undo, `D1-finish.md`
:150–175 and its trades, the D1 gate's design field, `checkpoints.md`'s design gate, `trades.json`, `V4.md`.

## 10. D-469: comment lines in the custom modifiers

PoB adds a custom line only when it parses whole and skips the rest silently (`ConfigOptions.lua`:2279–2297), so a
line that doesn't parse reads as a comment. Today our compiler refuses such a line (`Compile.lua`:1085–1088, D-293).
- **The compiler writes the comment** on schema-9 plans: before each `config.customMods` line it writes
  `# <the entry's reason>` into PoB's `customMods` text (`Compile.lua`:1749–1756 writes the lines). The reason already
  exists (V1's `missing-reason` asks for it, D-293); no new field. On schema 9 the reason is required and is one line
  (no line break, as `text` already is, `schema.ts`:355), so a comment can't spill onto an unprefixed line.
- **A comment never adds a modifier:** the compiler refuses a stage whose `# <reason>` line PoB would parse whole
  (`parses_whole`), naming the entry, so the reason is reworded.
- **What reads custom lines skips comments:** the estimate mark (`compiler.ts`:546) and `custom-defence`
  (`custom_mod_names`, `Compile.lua`:845–861) read the plan's lines, not the written text; the saved-file check reads
  the written text with its comments.
- **D1-build's rule:** the reason is one plain sentence a PoB reader understands: what PoB misses and the source
  ("PoB doesn't apply Crimson Assault's aggravation; 20% more Rake damage stands in for it"). And one line on numbers:
  whole numbers only, since PoB doesn't parse "33.33%".
- **The guide's PoB note** says the comment lines show in red in PoB's config tab (its colour for a line it doesn't
  apply), on purpose.
- A schema-8 or older plan's file is unchanged.

Amends D-293 (the written text), C-41, `Compile.lua`'s customMods writer and its parse check, `D1-build.md`'s custom
modifier rules, the guide templates' PoB note, `plan-reference.md`.

## 11. D-470: the library: ailment types, the pivots, and the cap

**"A second ailment type"**, a new entry in section 5 (Copies and rate), about 250 words:
- **Shape:** a damaging ailment doesn't stack with itself, but bleed, ignite and poison run side by side, and the
  generic lines scale each, so a second type takes every generic line again.
- **Search:** the skill's other damage types; `tree "ailments"`; and lines that change how ailments work: another type
  feeds an ailment ("Contributes to … Magnitude": Blistering Bond, "Fire Damage also Contributes to Bleeding
  Magnitude", `Data/Uniques/ring.lua`:86–89; Blood Barbs, `tree.lua`:66284; Plaguefinger, every hit to poison,
  `gloves.lua`:377; and, for the non-damaging ailments, Vestige of Darkness, physical to chill and freeze,
  `helmet.lua`:462); a type
  feeds a different ailment (fire to shock and the like, `ModParser.lua`:3027–3036); an ailment ties into stun
  (Rupture, `sup_str.lua`:6424; Bloodhound's Mark, a skill, "Marked target receives Heavy Stun buildup equal to 300% of
  Blood Loss", `Data/Skills/act_dex.lua`:496–620 (the build-up stat at :570), `Data/StatDescriptions/Specific_Skill_Stat_Descriptions/
  bloodhounds_mark.lua`:52). Search skills as well as modifier lines, in the game's words ("Blood Loss").
- **PoB:** modelled for the types (one instance unless `<Ailment>CanStack`, `CalcOffence.lua`:5063–5069); Bloodhound's
  Mark's stun build-up isn't (PG-101).
- **Examples:** `[spud]` (Warbringer's ignite beside bleed through Blistering Bond, already a library source).
- **Cautions:** Contagion, Essence Drain and Decaying Hex's debuff aren't ailments: in PoB they take "damage over time"
  and "chaos damage over time" lines but not the four ailment lines (`CalcOffence.lua`:5874–5882 against :5040–5048;
  PoB's model, needs in-game testing); each type needs its own chance and damage type; duration raises damage only where
  stacks or uptime are short; a second ailment pays only with its chance sources ([finishing]: Poison III alone in
  r2-s-2's Shield Wall cut it 20%).
- A pointer from "Convert into the ailment's type" (`patterns.md`:791), and the Damage over time kit's "ailment
  magnitude" lever beside Contagion (:323) reworded, since Contagion isn't an ailment.

**The pivots** ([finishing], item 11i), each a short entry or a kit line: with crit guaranteed (Nebuloch's line),
stack crit damage bonus (Supercritical, crit clusters); a keystone that multiplies the build's ailment (Crimson
Assault for bleed); the second ailment's chance sources (above).

**Split Personality:** the line "our compiler doesn't yet accept that start" goes (§4).

**The cap:** 15,988 of 16,000 words today. The user raised it to **17,000** (2026-10-30, provisional, HG-24's
precedent); the tests' caps move with the unit (`tests/static/buildGuideDesignPieces.test.ts`:37,
`patternLibraryM22.test.ts`:26 and :154–160, `buildGuideAmendment11Design.test.ts`:239–249, and the pipeline and engine
library tests that pin it). Over 17,000 after the additions, the unit stops with its counts (HG-28). C-53's stale
"12,000" (spine, C-53's Rules) is corrected at integration.

Amends C-53, D-410's cap (through HG-24's provisional cap), `patterns.md`, the five cap tests.

## 12. D-471: corruption on cheap uniques and skill gems

The user's rule (2026-10-30). Corruption is random; a useful corruption on crafted gear costs the craft many times
over, while a cheap unique or a low-level gem can be bought in numbers and corrupted until one hits. So:
- **Allowed:** a corrupted line on a **cheap unique**, and a skill gem corrupted to +1 level, on `b` and `n` only
  (proceed-on: the finishing-touch rungs).
- **Never on rares** (corrupted rares cut the trade supply by an order of magnitude or more), nor on magic or normal
  items, jewels among them (proceed-on: the user's rule names only uniques and gems). A cheap unique jewel follows the
  unique rule.
- **Priced uncorrupted:** the budget doesn't count the corruption. The price entry searches the unique by name, without
  the corrupted line as a required affix, and notes "priced uncorrupted: buy copies and corrupt until one rolls
  <line>". A unique priced at or over the cheap line can't carry a corrupted line.
- **No price to judge by** (an offline run, an `unavailable` price, a pricing stop, `--no-ninja` with no rates,
  `references/offline-and-test.md`:16–33): the corrupted line is allowed, and the price entry's note says
  `cheapness unchecked: <why>` (proceed-on); the checker passes it with that note and fails it without.
- **The cheap line:** an uncorrupted price under **1 divine orb** (the user, 2026-10-30: "anything less than 1
  divine"), in `references/corruption.json`, converted at the run's rates.
- **The level-21 gem:** the plan writes the gem at its level with `corrupt: "plus_one_level"` (schema 9); the
  compiler sets PoB's corruption state (`BuildOps.lua`:2010–2014), so PoB calculates it one level higher
  (`CalcSetup.lua`:1884–1885). V1's `gem-availability` reads the written level, so a level-20 gem with the corruption
  passes (`v1.ts`:301–316). V1 **`corruption`**: a corrupt gem on `m` or a campaign stage, or a corrupt support gem.
- **Uniques that always come corrupted** (Split Personality's data carries `Corrupted`) are the item as it drops: no
  rule applies. A designed corruption is an enchant line on a unique (other than the amulet's `Allocates` anoint) with a
  `Corrupted` line.
- **The guide** says it for each: "Buy several <unique> and corrupt them until one rolls <line>" and "Corrupt cheap
  low-level <gem> gems until one gets +1 level, then level it to 20". The checker fails a guide without the line for
  each corrupted unique or gem in the plan; V4 reads it. The checker's corruption rules apply to a build whose last D1
  gate ran at or after revision 13's boundary (§22).
- D-348 (no crafting guidance) holds otherwise; this is its one exception, the user's.

Amends D-348, C-31 (a gem's `corrupt`), V1's table, `Compile.lua`'s gem step, `D1-build.md`, `pricing.md`, W1 and the
guide templates, `V4.md`, `check-run.mjs`.

## 13. D-472: flasks and charms

The user's rule (2026-10-30): life and mana flasks go in the build; their lines don't matter unless the build uses a
flask effect; charm slots stay empty for now.
- **D1-build writes**, on `m`, `b` and `n`, `Flask 1` a life flask and `Flask 2` a mana flask: plain normal items of
  the best base the rung's level allows (Ultimate Life Flask and Ultimate Mana Flask, level 60,
  `Data/Bases/flask.lua`:195, :277); no mana flask on a build that spends no mana (Blood Magic), with its reason in a
  claim (proceed-on).
- **Toggles** (proceed-on): each flask's toggle is written `active: false`, unless the build uses a flask-effect line ("during any
  flask effect", PoB's `UsingFlask`, `ModParser.lua`:1862–1866): then the designer picks the flask's lines for uptime,
  writes the toggle `active: true` with its uptime (earned state, D-114), and measures it.
- **Not priced** (proceed-on): a plain flask costs nothing worth counting. D1-finish writes no price entry for a Flask
  slot (today it prices "a flask, a charm" by trade search, `D1-finish.md`:74, :118; `pricing.md`:28, :76, :92), and
  the D1 gate's budget part (`gates.md`:86–89, `D1-gate.md`:95), the checker's "every filled slot priced" and
  `rungBudget` skip Flask slots.
- **Charms:** the charm slots stay empty; the checker fails a filled one (proceed-on). Charms move to amendment 14's
  list, after a survey of the library's charms.
- **The checker** fails an endgame rung without a life flask in `Flask 1` (proceed-on); the mana flask rule stays
  D1-build's judgment, with its claim. Both rules hold a build whose last D1 gate ran at or after revision 13's
  boundary (§22).
- **The guide** lists the flasks in one line.

Amends D-249's slot rule (flasks unpriced), `D1-build.md`'s gear step, `D1-finish.md`'s prices, `pricing.md`,
`gates.md`'s budget part, `D1-gate.md`:95, `check-run.mjs`, `render-audit.mjs`, W1 and the guide templates.

## 14. D-473: the finishing touches

Items 11a, 11b, 11f, 11j, 11k and 11l, on `b` and `n` unless said.
- **Skill levels** (the user: more levels "will almost always outperform any other single affix"): D1-build audits
  every damage skill of the boss rotation and the clear skill for +levels on its own weapon set, and writes the audit
  in `pieces.md` (`## Skill levels`). A damage skill at +0 is returned as `levels: <rung>: <skill> +0`, carried in the
  design field's `levels`, and printed at the design gate as `Skill levels on <rung>: <skill> +0`. Shared slots (amulet, gloves, helmet) serve the clear skill first, then the boss entry with the
  largest share of the fight. A +levels slot may take more than its even share of `n`'s budget, with its reason ("it
  carries the build", `pricing.md`:90). Pricing passes `find_upgrades`' `sort_stats` for a slot that serves a set-2
  skill (the default weights read the main skill).
- **Unique jewels:** D1-build proposes candidates by lookup: Heart of the Well with the build's extra-damage element,
  a Time-Lost jewel with radius lines, Prism of Belief for a skill the build uses, From Nothing for a keystone's radius,
  Megalomaniac by what it allocates (`Data/Uniques/Special/Generated.lua`:60, :92, :112, :233; Time-Lost bases,
  `Data/Bases/jewel.lua`:30–56). D1-tree's socket test measures them beside the rare jewel; "Limited to" (one each)
  is D1-tree's to hold when it sockets them (nothing in V1 or the bridge checks it today; a static D1-tree row, AC-W103,
  holds the rule). Each is priced by name (or
  by `search_trade_items` on the line it allocates), with no `target` in its query, which would send it to the weighted
  search (`D1-gate.md`:47–48); its share of the budget (`b` 5 divines like a rare jewel, `n` its share) goes in the
  price entry's `note` (the entry has no `reason`, `src/plan/schema.ts`:517–528). D1-tree, which writes a taken jewel's
  entry today with a `target` (`D1-tree.md`:172–177), writes a unique jewel's this way.
- **A spike first** (WU-128): a unique jewel written with its `Selected Variant` lines compiles and PoB reads the
  variant. The trade search with an option-form stat (Megalomaniac's "Allocates <notable>") is checked at the live
  test (proceed-on; no agent sends a trade request during the build); until then such a jewel's price may be
  `unavailable` with its note.
- **Timeless jewels are out** (the user: "Skip for now"; PoB's conquered-node code is unfinished,
  `Classes/PassiveSpec.lua`:1528–1571, PG-102). Follow-up in amendment 14's list.
- **Anoint-only notables** (16 at the pin: a notable with a `recipe`, no connections and the anoint frame,
  `TreeData/0_5/tree.lua`, e.g. Thaumaturgic Generator at :117918–117941) are always among D1-finish's anoint
  candidates.
- **Rotation conditions:** D1-build sweeps the conditions the rotation's own skills produce, shown or hidden in PoB
  (fully broken armour when the build breaks armour), and turns each on with its uptime and reason (earned state,
  D-114).
- **Pricing notes** (`pricing.md`): fractured lines are priced as plain explicit mods, the roll loosened one tier;
  unique jewels by what they allocate; the usual price drivers are +3 or more levels with only top matching damage
  lines, and amulets with Spirit, crit and defences.
- **Out:** budget tiers, Headhunter and Mageblood.

Amends D-358's anoint candidates, D-453's socket test (unique jewels), `D1-build.md`, `D1-tree.md`, `D1-finish.md`,
`pricing.md`.

## 15. D-474: trade pacing on a stale server, and the run's tool problems; D-477: a file-only build's claims

**The pace line** (item 12). A session server built before M-25 doesn't pace (three searches went out 4–9 s apart on
2026-10-29). Every reply of `search_trade_items`, `get_item_price` and `find_upgrades`, a trade error's included
(appended by `wrapTradeHandler`, `src/handlers/tradeHandlers.ts`:49–56), carries the pace line:
`Pace: 45 s between searches, at most 7 in 5 minutes.`, or `Pace: off (test setting).` when the server's pace is off
(`deps.tradePace === null`, `src/server/createServer.ts`:254–262; `src/index.ts`:41–48 sets it from
`POB_TEST_TRADE_PACE=off`, and `startTestServer` sets it directly). It is the last line, except in `find_upgrades`,
where it goes just before the search link, which C-14 keeps last (`03-trade.md`:556, :988;
`src/trade/renderUpgrades.ts`), inside D-53's 30,000-character budget. An argument error the router refuses before the
handler carries no line.
- **The check:** a pricing step's first trade call reads the line. Missing (a server built before M-26) or off, the
  step makes no more trade calls and returns the stop `pace: missing` or `pace: off`; the runner records it as a
  pricing stop (`STOP_OUTCOMES` gains `pace`, `run-log.mjs`:213–214) and asks the user to reconnect with `/mcp`, then
  re-runs the step. A first call that errs before reaching the handler doesn't count; the next call is read.
- `POB_TEST_TRADE_PACE=off` stays (14a); the line reports it.

**The tool problems** (item 13):
- **`free` on weapon-set nodes:** §8.
- **`compile_stage`'s 30 s limit** (`src/pobLuaBridge.ts`:96–97): first trace the failed restore after the timeout
  ("Engine restarted; the loaded build could not be restored"), recorded in the work-log; then make `compile_stage` a
  long action at 120 s, as `node_power`. This amends the spine's C-4 (its 30 s bound on each compile-stage request),
  NFR-21's 20 s target and its margin (D-156, D-229) for `compile_stage`: the live run's two 30 s misses are HG-13's
  case, which the user's approval of this amendment (HG-27) settles.
- **The checker:** `[markers]` skips inline code spans (`check-run.mjs`:609 matches inside them today);
  `[source-tags]` accepts one definition holding several `data | file#key` refs joined by `; ` (:646–651);
  `[pieces]` gains the kind `anoint` (`PIECE_KINDS`, `run-log.mjs`:981).
- **The stray file:** after each step the runner lists the repository's untracked files (`git status --porcelain`)
  and reports one not in the listing it took at the run's start or resume (held in its context, not the run log); it
  deletes nothing.

**D-477: a file-only build's claims pass** (item 13's last point, HG-31; the user, 2026-10-30: "verify on file-only
build", taking the recommendation "run the claim verifier on the build's claims anyway, without the guide edits").
A build accepted as its PoB file only (`accept:file`) ends after F1 today, with no V4 pass (`SKILL.md`:241–253,
`fix-round.md`:124, `check-run.mjs`:4010), so a claim error reaches the run's end with only the run checker to catch
it: r2-s-1's claim `m-piece-rapid-assault` cites `ledger:boss_m` but states 2. For a build held to revision 13 (§22):
- **The claims pass.** After F1 passes on `accept:file`, the build doesn't end yet. The runner starts one verifier,
  stage `V4-claims`, `check: "claims"`, `findings: []`, `writes: ["<buildFolder>/reports/V4-<n>.md"]`, `<n>` numbered
  as for the full pass. It checks every hinge claim of `plan.json` against its source, as the full pass does (`SKILL.md`
  step 11), and reads no guide, since the build has none. Its report's H1 is `# V4-<n>: claims pass`; its outcomes are
  `pass` and `fail`, as V4's.
- **Its fix round** (step 12), once, only with an `unresolved` finding, after the round copy. The owner is D1 alone:
  a file-only endgame build has no campaign stage and no guide, so no D2, no W1 and no audit render. A claims-only
  edit runs no gate; a recompile runs D1 → D1 gate → F1, F1 passing the recorded name (§7). No design gate.
- **The round copy** of a build with no `guide.md` copies `plan.json` and `compile-record.json` only
  (`snapshotRound`, `check-run.mjs`:5936–5946, refuses today unless all three exist), and `--changed <n>` then prints
  claim lines only.
- **Its re-check** (step 13): `--changed <n>`, then one `V4-recheck` verifier, as now. No further round.
- **Then the build ends `file-only`.** It stays `designing` through the claims pass and its round. Its open findings
  (the last report's `unresolved` findings) have no `Known issues` list to go in, so the runner tells the user each
  one's `reader` sentence at the run's end, beside the build's PoB file (`SKILL.md` §8, point 3, "its known issues").
- **A later guide or campaign** (`guide:<id>` after a resume; `campaign:<id>`, `fix-round.md`:124) runs as now: W1,
  then V4's full pass over every claim and every H2, its report numbered after the claims pass's. The claims pass is
  its own stage, so the checker's one-full-pass-per-guide rule (`check-run.mjs`:4031–4033) is untouched.
- **The checker:** a `file-only` build held to revision 13 has a logged `V4-claims` entry after the F1 pass that
  followed `accept:file` (a fix round's F1 may follow it), and its report; the build stays `designing` in `builds[]`
  until its end; the step order allows F1 (a pass after `accept:file`) → `V4-claims` → the fix round (the round copy, the
  D1 owners, then the D1 gate and F1 after a recompile) → `V4-recheck` → the build's end; a `V4-claims` entry for a
  build not accepted `file`, or after W1, fails; the report rules (`check-run.mjs`:1432–1452, :5106–5107) count
  `V4-claims` among the passes and read its H1. A build before the boundary keeps today's rule.

Amends D-411 and D-413 (a file-only build ended at F1's pass), D-352 (V4's passes), D-415's `guide:<id>` (its full
pass follows the claims pass's reports), `SKILL.md` §4, §6 and §8, `fix-round.md`, `V4.md`, `task-header.md`:29–32,
`checkpoints.md`:356, `gates.md`:375, the verifier's definition, `check-run.mjs`, `run-log.mjs`.

**M-25's leftovers** (item 14; the M-25 work-log):
- a rung with an Arbiter row that has no verdict can't read "survives its hits" in the design field (the checker
  fails it);
- failure messages round percentages (one decimal place);
- the spec fold: stabilization's `03-trade.md`:738 and :923 give 61 s for the old 40 s refusal example; amendment 12's
  §19 touches gain `pob-api/API/Handlers.lua` and the shared tests that moved with the key-figure line; its §15
  Voices citations become Voices' own code.

Amends C-14, D-71 and D-72 (a reply line), D-47's long actions, C-4, NFR-21, D-156 and D-229 (for `compile_stage`),
`pricing.md` (the check and the `pace` stop, :225–236), `SKILL.md`'s step loop, `check-run.mjs`, `run-log.mjs`,
`docs/stabilization/spec/03-trade.md`, `amendment-12-defence-and-design.md` §15 and §19.

## 16. D-475: the brainstorm gate's text

The user agreed to six cuts (2026-10-28); the visit measured about 3,000 words (display 2,213, pitch 779). In a
revision-13 run, on the composite and the dealt-card paths alike (`run-log.mjs`'s `brainstormDisplay`, :1593):
1. **One first line per composite:** its number, name, structure, and under-played yes or no (its `in:`,
   `scheduled:` and source lines follow, Appendix A); layers and the judgment stay in `cards.md` or go to the pitch.
2. **Key pieces only:** at most 8, chosen by kind (uniques, mechanic-changing supports, keystones, under-played rows,
   then notables; the user agreed to "its uniques, mechanic-changing supports and notables"), then
   `+ <N> more in cards.md`; the full list on request. No new card marker.
3. **`scheduled:`** names only (`run-log.mjs`:1514–1530).
4. **The header:** the first one or two sentences of `cards.md`'s "what they share"; "How they differ" stays in
   `cards.md` and isn't printed (:1556).
5. **Plain cards:** one line of names.
6. **No "For reference" ids** (:1482): the display's `displays[]` entry records the number-to-id map
   (`{checkpoint, visit, numbers}`), so the runner maps the user's numbers and `pick:` stays checked.
- The obvious-build line, `drawn from` and the "not confirmed in game" sentence stay.
- **The pitch rule** (each card's rotation, synergy source and catch in plain words) moves into `checkpoints.md`'s
  brainstorm section, with a target of 700–900 words for the whole visit (not machine-checked).

Amends D-367, D-392, D-432, D-442's display rows, `run-log.mjs`, `checkpoints.md`:143–187, `references/run-log.md`.

## 17. D-476: the PoB gaps, and the fold

- **`docs/build-guide/pob-gaps.md`** gains, in a new section "Found in amendment 13 (2026-10-30)": PG-101, Bloodhound's
  Mark's Heavy Stun build-up from Blood Loss isn't modelled (gap, confirmed in code: `act_dex.lua`:496–620, whose
  stat map at :556–560 holds only the explosion threshold; the build-up stat at :570); PG-102, timeless jewels' seeds aren't read (gap, confirmed in code: `PassiveSpec.lua`:
  1528–1571, "FIXME - continue implementing", the lookup commented out). Each in the file's skeleton.
- **At integration** the coordinator writes V1's new rows (`tree-shape`'s `alternate-class-start` rule, `corruption`)
  into `02-plan-compiler.md`, HG-27 to HG-31 into the spine's §6.3 (written with this amendment, HG-31 resolved at
  approval), the HG-12 grant (written at approval), C-53's cap, the spine's C-4 and NFR-21 for `compile_stage` (§15), and C-14's "search link last"
  note on the pace line (`docs/stabilization/spec/03-trade.md`:556, :988).

## 18. Costs

Baseline: the Titan Rake run (amendment 12's pipeline). Estimated changes, for a run with two builds:
- the tree search: rebuild at reach 12 with repair on each rung (engine time, up to 120 s a call), up to 30 swaps a
  rung each with its compile: about +60K to +150K output tokens a build when the loop runs long, against today's 8;
- the boss target: one compile's read per change (already made); the alternative tree and reasons: about +5K a build;
- the finishing touches: the skill-level audit, unique jewel candidates (up to 4 more socket tests a rung), rotation
  conditions, flasks: about +40K a build; pricing about 4 more searches a build at 45 s each;
- the draft: no engine time; a file write;
- the brainstorm gate: about −2,000 words displayed a visit (about −3K tokens a visit in the runner's context);
- the library's +1,000 words: read by each researcher and D1-build, about +1.5K tokens each;
- the file-only claims pass (D-477): one verifier pass a file-only build, short of a full pass by the guide's read,
  and a re-check when its fix round ran; none for a build accepted with its guide.

About +200K to +400K output on a two-build run, more when the swap loop runs to its cap. The user prefers quality
over time (2026-10-29). D-349's cap of 1M output tokens a run (spine) is already exceeded by today's runs (amendment
12 §18's baseline); the added cost is the user's to weigh at approval, and D-357's knobs stay theirs.

## 19. Work units (M-26)

| Unit | What | touches |
|---|---|---|
| WU-127 | Node power: first copy the Titan Rake fixtures (HG-6's grant, §8); then `targets` with repair, the swap search under targets, `pace_exchange`, the attribute guard, `pool_groups` on the boss config, `free` on a pool node, Split Personality's start in `start_counts` and `unreached`; the regression test | `pob-api/API/NodePower.lua`; `src/engine/schemas.ts` (the `node_power` request and reply only); `src/handlers/treeHandlers.ts` (node power's functions only: `nodePowerParams`, `handleGetNodePower`); `src/server/toolSchemas.ts` (`get_node_power`); the README table; `tests/fixtures/plans/titan-rake/`; `tests/fixtures/tool-calls.json`; `tests/integration/nodePower*.test.ts` |
| WU-128 | Plan schema 9 and the compiler: spikes first (Split Personality's compile, the pinned weapon's one item, a unique jewel's variant); Split Personality's start (`check_tree`, `tree_starts`, V1 `tree-shape`); `sameAs`; comment lines; a gem's `corrupt` and V1 `corruption`; `tree.start`, `tree.end`, `tree.search`; the one-line reason; the plan reference's culling example; `customModsWritten`'s doc | `src/plan/schema.ts`, `src/plan/record.ts` (the doc comment at :1421–1422 only), `src/plan/checks/v1.ts`, `src/plan/compiler.ts` (`stageParams` and the custom lines only), `pob-api/API/Compile.lua` (`check_tree`, `tree_starts`, `equip`, the gem step, the customMods writer and check), `src/engine/schemas.ts` (the compile reply's `checks`), `docs/build-guide/plan-reference.md`, plan fixtures and tests (`tests/unit/planSchema*.test.ts`, `tests/unit/v1*.test.ts`, `tests/static/planReference.test.ts`, new `tests/integration/compileSchema9*.test.ts` files; not `compilePlan*.test.ts`, which is WU-129's) |
| WU-129 | Server tools: `compile_plan`'s draft mode (write, remove) and `first_free` names; `buildFileWriter`'s delete; the pace line; `compile_stage`'s trace, then its long action; the path tools from Split Personality's start | `src/handlers/planHandlers.ts`, `src/plan/compiler.ts` (`checkTarget` and the modes only), `src/plan/writeLedger.ts`, `src/services/buildFileWriter.ts`, `src/handlers/tradeHandlers.ts` (`wrapTradeHandler`, the replies), `src/trade/renderUpgrades.ts` (the line before the link, inside D-53's budget), `src/server/toolRouter.ts` (the draft mode's engine kind), `src/pobLuaBridge.ts`, `src/services/treeService.ts`, `src/handlers/treeHandlers.ts` (the path tools' functions only), `pob-api/API/BuildOps.lua` (the socketed jewel's start, read only), `src/server/toolSchemas.ts` (`compile_plan`, the trade tools), the README table; `tests/unit/buildFileWriter*.test.ts`, `tests/unit/writeLedger*.test.ts`, `tests/mcp/*` for the trade tools (`findUpgrades.test.ts`, `findUpgradesBounds.test.ts` among them), `tests/integration/compilePlan*.test.ts`, `treeState.test.ts` |
| WU-130 | Scripts: the brainstorm display (§16); the names, drafts and `draftFile`; the over-budget rule; corruption, flasks and charms; the pinned weapon's price; the boss display and `boss` trades; the swap cap, rebuild-undone, Life, removed and skill-levels lines; the boss entries' `valuedBy`; `bossAfter` on `boss` trades (`check-run.mjs`:5233's kind list); F1's `draftLeft` in the final display; the D1-tree outcome `stale-server`; the checker fixes and leftovers; `skillRevision` 13 and the per-build boundary for every new checker rule; the `pace` stop outcome; one file per build; `references/corruption.json`; the file-only claims pass (D-477: the `V4-claims` stage, its order and report, the round copy with no guide) | `scripts/run-log.mjs`, `scripts/check-run.mjs`, `scripts/render-audit.mjs`, `references/run-log.md`, `references/run-folder.md`, `references/corruption.json`, `tests/fixtures/pipeline/`, `tests/unit/buildGuide*.test.ts` (the script-side assertions) |
| WU-131 | The library: "A second ailment type", the pointer and the kit's lever, the pivots, Split Personality's line, the 17,000 cap and its tests (first splitting `buildGuideAmendment11Design.test.ts`:239–249's mixed `it`, leaving its `SKILL.md` half to WU-133) | `references/patterns.md`; `tests/static/patternLibraryEngine.test.ts`, `patternLibraryM22.test.ts`, `buildGuideDesignPieces.test.ts` (the cap), `buildGuideAmendment11Design.test.ts` (the cap `it`), `buildGuidePipeline.test.ts` (the library `describe`) |
| WU-132 | Research docs: the over-budget rule in R1a, R1a-synthesize and R1b; the researcher's definition | `references/stages/R1a.md`, `R1a-synthesize.md`, `R1b.md`, `.claude/agents/build-guide/build-guide-researcher.md`; their `describe` blocks in `buildGuidePipeline.test.ts`, `buildGuideSynthesis.test.ts` |
| WU-133 | Design, gate and guide docs: D1-build (needs, no attribute need, `boss_<stage>`, skill levels, unique jewels, corruption, flasks, conditions, the comment reason, whole numbers, the culling example), D1-tree (§8, §9: `tree.start`, `tree.end`, `tree.search`, the stale-server check), D1-finish (the boss re-check, the `boss-fall` claim, keeping `boss` trades, its node power arguments, the best damage move, anoint-only notables, unique jewel prices, no flask entry, the `sameAs` slot), D1-gate (the draft, the tree judge on `tree.start`, step 6's design-field additions, the budget part's flask and `sameAs` rules), F1 and D2-gate (names, re-compiles without `first_free`, the draft's removal), `checkpoints.md` (the brainstorm pitch rule, the design gate), `gates.md` (the tree part, the budget part), `pricing.md` (the pace check and stop, over-budget runes at :242, flasks, corruption, unique jewels), W1 and the templates, V4, the coordinator's standing rules, `task-header.md`, `fix-round.md`, `SKILL.md` (names, `builds[].draftFile`, the escalation accept's draft, D1-tree's `stale-server` route, the tree-only route through D1-build on a schema-8 plan, the untracked-file listing, every `SKILL.md` line-count pin) within 325 lines or more by the lines a rule can't do without, named in the work-log; the file-only claims pass (D-477: `SKILL.md` §4, §6 and §8, `V4.md`'s claims mode, `fix-round.md`, `task-header.md`, `checkpoints.md`'s `accept:file`, `gates.md`:375, the verifier's definition) | `references/stages/D1-build.md`, `D1-tree.md`, `D1-finish.md`, `D1-gate.md`, `F1.md`, `D2-gate.md`, `W1.md`, `V4.md`; `references/checkpoints.md`, `gates.md`, `pricing.md`, `task-header.md`, `fix-round.md`; `templates/guide-template.md`, `guide-endgame-template.md`, `audit-template.md`; `SKILL.md`; `.claude/agents/build-guide/build-guide-coordinator.md`, `build-guide-verifier.md`; their `describe` blocks in `buildGuideAmendment11Design.test.ts`, `buildGuideAmendment12Design.test.ts` (the D1-tree and D1-finish blocks that pin the boss guard, the socket test's 2% and the boss-cut trade line), `buildGuideD1Tree.test.ts`, `buildGuideEndgameGuide.test.ts`, `buildGuidePipeline.test.ts`, `buildGuideDesignPieces.test.ts` |
| WU-134 | `pob-gaps.md` (PG-101, PG-102); the fold's leftovers | `docs/build-guide/pob-gaps.md`, `docs/stabilization/spec/03-trade.md` (:738, :923 only), `docs/build-guide/spec/amendment-12-defence-and-design.md` (§15's Voices lines and §19's touches only); a new `tests/static/buildGuideAmendment13Docs.test.ts` for AC-W105 |
| WU-135 | The live test, the user's, with the coordinator, after M-26 is built | the work-log |

**Spikes first,** each its unit's first step, recorded in the work-log: the Titan Rake fixtures' copy and a timing of
the rebuild with repair at reach 12 and of one swap search under `targets` (WU-127); Split Personality's compile, the
pinned weapon's one item, a unique jewel's variant (WU-128); the failed restore's trace (WU-129). A spike that fails
stops its unit, and the coordinator reports to the user (as R-66 says for the pinned weapon); the units that wait on
it wait. Split Personality fixtures for node power and the path tools are built with `lua_new_build` and
`lua_set_tree` or loaded XML, as today's tests do, so wave 1 doesn't wait on WU-128's compiler change.

**Order.**
- **Wave 1:** WU-127, WU-128, WU-129 and WU-134 in parallel, the formats fixed by Appendix A.
- **Wave 2:** WU-130 (it can start in wave 1 against Appendix A, and rebases onto WU-128 and WU-129), WU-131 (after
  WU-128 merges, so the compiler accepts the start before the library stops saying it doesn't, and WU-134 merges: the
  library cites PG-101) and WU-132.
- **Wave 3:** WU-133, after WU-130 merges: its docs' examples run through WU-130's scripts.
- **Then WU-135.**

**Shared files and how they split:**
- `src/plan/compiler.ts`: WU-128 owns `stageParams` and the custom lines; WU-129 owns `checkTarget` and the modes.
  WU-128 merges first; WU-129 rebases.
- `src/engine/schemas.ts`: WU-127 the `node_power` schemas; WU-128 the compile reply's `checks`. Merged by rebase.
- `src/server/toolSchemas.ts` and the README table: WU-127 (`get_node_power`) merges first; WU-129 (`compile_plan`,
  the trade tools) rebases.
- `src/handlers/treeHandlers.ts`: WU-127 node power's functions, WU-129 the path tools'. WU-127 merges first; WU-129
  rebases.
- `pob-api/API/BuildOps.lua`: WU-129 only (a read of the socketed jewel's start). `NodePower.lua`: WU-127 only (it
  sets the boss config itself, §8). `Compile.lua`: WU-128 only.
- `checkpoints.md`, `pricing.md`, `SKILL.md`: WU-133 only.
- Shared static test files are edited by `describe` block (amendment 11 §16's rule); an `it` that runs a doc's example
  through a script is WU-133's; the cap `it`s are WU-131's.

## 20. Acceptance criteria (M-26)

- **AC-K76 (WU-127).** Engine, on the Titan Rake fixtures (compiled measure-only, `n` loaded):
  - `get_node_power {rebuild: true, max_distance: 12, targets, pace_exchange: 3, keep: <the plan's needs less its
    attribute needs, the dropped needs listed by node id in the work-log>, stats: ["MainDamage", "TotalEHP"]}`,
    `targets` the compiled `n`'s `TotalEHP` and lowest max hit,
    returns a legal rebuild whose Main damage gain is at least **+41%** on r2-s-2 and **+46%** on r2-s-1 (half the
    experiment's), with `TotalEHP` and lowest max hit at or above the targets, each call within its 120 s long action;
    the work-log records the gains, the repair steps and the times (short of a threshold: HG-30); the reply's rebuild
    line has Appendix A's `(target …)` form;
  - with `targets` out of reach (an EHP target 10× the compiled figure), the rebuild line reads `misses its targets
    after repair` and no change is reported legal;
  - on r2-s-2's `n`, `free: [43778]` with `pace_exchange: 3` adds Crushing Verdict and its line reads legal; the same
    call with `max_loss: {clearUses: 2}` and no `pace_exchange` reads over the clear-uses guard;
  - the pace judge (engine-required: it lives in `NodePower.lua`): a 20% gain for a 2.55% uses loss passes at 3; a 4%
    gain for a 2.5% loss fails; a gain of exactly 3 × the loss passes; a move that passes on uses but loses 2% radius
    for a 4% gain fails (each figure on its own); `pace_exchange` with `stats` lacking `MainDamage` is refused;
  - a fixture whose best unguarded swap leaves Strength under `ReqStr` returns a swap that keeps `Str ≥ ReqStr`, or
    none;
  - with `pool_groups {"2": <Shield Wall's group>}` the set-2 pool line names that group and ranks by its figure;
    without it the line reads as today; one pool move's gain under `pool_groups` equals the change in that group's
    boss figure between measure-only compiles before and after the move, both at PoB's own count for the group, and
    its percentage is within 1 point of the record's (R-64; proceed-on, amended at WU-127's verification: the compile
    sets the plan's `count` as `groupCount` only on the named source's group, so a group counted above 1 ranks at
    PoB's count, while the record, whose figures the user sees, counts the plan's);
  - `free` on a set-1 need node (Cranial Impact's [44406, 63451]) returns a gain, not "not measured";
  - a fixture with Split Personality (Warrior) socketed and a tree from the Warrior start: a swap returned keeps that
    tree, and `unreached` counts its nodes as reached; with the socket reached only through the Warrior start, node
    power doesn't count that start.
- **AC-K77 (WU-127).** The README table equals `pnpm docs:tools`' output; `tool-calls.json` holds a `get_node_power`
  sample with the new arguments; AC-B5's golden values hold; `tests/fixtures/plans/titan-rake/` holds the two plans,
  whose sha1s equal those the work-log records from the run folder.
- **AC-P86 (WU-128).** Engine, on fixture plans:
  - the work-log records Split Personality's spike compile; a stage with the jewel (Warrior) in a socket the tree
    reaches without the Warrior start, and a tree from the Warrior start, passes `compile_check` with no connection
    defect and no `tree-shape` finding; the same tree with the jewel removed, or with the socket reached only through
    the Warrior start, is refused;
  - two trees from the jewel's start give `tree-shape` (`one-tree-per-start`); a Warrior's own variant on a Warrior
    gives `tree-shape` (`alternate-class-start`); `compile_check`'s stage `starts` (its `trees[].starts`, which V1's
    `tree-shape` reads; the record is unchanged, §22) holds the jewel's start with `jewel: true`, `grantedBy` the
    socket and `grantedByName` "Split Personality".
- **AC-P87 (WU-128).** The pinned weapon: the work-log records the spike; a schema-9 stage with `{slot: "Weapon 2 Swap",
  sameAs: "Weapon 2"}` saves one item, whose id fills both slots in the saved file; its set-2 figures equal a compile
  with two copies of the text; `sameAs` on `Helmet`, naming `Weapon 1` from `Weapon 2 Swap`, or naming an empty slot,
  errs at its path; `sameAs` on a schema-8 plan errs at its path; V1's `empty-weapon-set` reads a `sameAs` Swap slot
  as filled.
- **AC-P88 (WU-128).** Comment lines: a schema-9 stage's saved `customMods` text holds `# <reason>` before each line, in
  order; a reason that parses whole as a modifier is a compile defect naming the entry; a schema-8 plan's saved text
  equals the text before the change; the estimate mark and `custom-defence` findings are unchanged by the comments; on
  schema 9 a `customMods` entry with no reason, or a reason holding a line break, errs at its path.
- **AC-P89 (WU-128).** Corruption and the start: a level-20 skill gem with `corrupt: "plus_one_level"` on `n` is
  calculated at level 21 (PoB's `GemCorruptionLevel` mod present) with no `gem-availability` finding; the same on `m`,
  or on a support gem, gives `corruption`; `corrupt`, `tree.start`, `tree.end` and `tree.search` err at their paths on
  a schema-8 plan; they are accepted on 9 and change no figure; a unique jewel written with its `Selected Variant`
  compiles with the variant's lines (the spike, in the work-log); `plan-reference.md` equals the schema and holds no
  "Legacy of" example.
- **AC-K78 (WU-129).** In-process MCP with a temp builds folder; the draft rows use a compile record and
  `compiled-build.xml` written by the test, and the final-compile rows are engine-required:
  - the draft mode, given `draft_name` "Royal Fury: Rake", writes `Royal Fury Rake (draft).xml` byte-equal to
    `compiled-build.xml`, with a ledger entry of `kind: draft` and its `plan`, and starts no engine (engine kind
    `none`); after a plan edit with no compile, or after a `stages` compile, it's refused, writing nothing;
  - a second draft write of the same build over an unchanged draft replaces it; over a draft changed on disk it writes
    `<name> (draft 2).xml` and leaves the changed one;
  - `remove_draft` on an unchanged draft of this build deletes it, leaves a `_before-delete` backup and drops the ledger
    entry; on a changed draft, a final file, or a draft another build or run wrote, it refuses and deletes nothing;
  - `first_free`: a final name another run's file holds goes to `<name> <run date>`, then `<name> <run date> 2`; a
    name another build of the same run wrote goes to `<name> <run date>`, leaving that file; a name with `:` and `?`
    is cleaned; `CON` becomes `CON (build)`; a re-compile without `first_free` over this build's final file the user
    changed is refused (D-211); `measure_only` with `build_name` is still refused;
  - a version-1 ledger reads as entries of `kind: final` with no `plan`.
- **AC-K79 (WU-129).** `search_trade_items` and `get_item_price` replies end with the pace line; a `find_upgrades`
  reply has it just before the search link, which stays last, within the 30,000-character budget; a `startTestServer`
  reply (pace off by `tradePace: null`) carries `Pace: off (test setting).`; a `would_wait` error reply carries the
  line.
- **AC-K80 (WU-129).** The work-log records the restore trace's cause; `compile_stage` is a long action at 120 s (a
  unit test reads the bridge's timeout for it); `find_path_to_node` on a fixture with Split Personality socketed returns
  a path leaving the jewel's start for a node nearer that start than any other open start, and `update_tree_delta`'s
  auto-path to the same node leaves it too; the README table equals `pnpm docs:tools`.
- **AC-W100 (WU-130).** Script unit, on fixture runs:
  - the brainstorm display of a revision-13 fixture visit has no "For reference" block, at most 8 key pieces a
    composite then `+ <N> more in cards.md`, a header of at most two sentences, no "How they differ", `scheduled:` with
    names only and plain cards on one line; each composite's first line holds only its number, name, structure and
    under-played yes or no; the dealt-card path's display gets the same cuts; its `displays[]` entry holds `numbers`,
    and a `pick:` naming a number's card passes; a revision-12 fixture's display is unchanged;
  - for a build whose last D1 gate is at or after revision 13's boundary, the checker accepts a final file
    `<name>.xml`, `<name> <date>.xml` and `<name> <date> 2.xml` from the run log's names (a name with `:` matched as
    cleaned), and fails `<runName>-<id>.xml` and two builds recording one file; a build before the boundary keeps its
    rule; `builds[].draftFile` is recorded and printed by the design display; a log with and one without `draftFile`
    both pass;
  - a card row `in` or `scheduled` with "Legacy of Ashrend" fails without the brief's say and passes with
    `around: "Legacy cores"`, with it in `like` or `notes`, or with a gate answer naming it; a plan rune line
    "Raven-Touched Shard" fails likewise; an `out` row passes; "Coward's Legacy" passes; a card dealt before the
    boundary isn't held;
  - a rare item text with `Corrupted` fails; a unique with a corruption enchant on `m` fails, on `b` priced at 0.9
    divine passes, at 1 divine fails; an `unavailable` price passes with the note `cheapness unchecked: <why>` and fails
    without it; a cheap unique jewel with a corruption passes; a plan with a corrupted unique or a `corrupt` gem whose
    guide lacks its line fails; an always-corrupted unique (Split Personality) passes with no line; a build before the
    boundary isn't held;
  - for a build held to revision 13 (§22): an unpriced Flask slot passes; a filled Charm slot fails; an endgame rung
    without a life flask fails; a build before the boundary isn't held;
  - a `sameAs` slot maps to its set-1 slot's entry and `rungBudget` counts it once;
  - the design display prints, from the design field alone, each boss entry's start, end and final figure (and its
    `valuedBy` value and reason where set), the boss figure, the `boss-fall` reason line, the `boss` trade with its
    `bossAfter`, the swap-cap line, the rebuild-undone line, Life at the start and end, the `Removed on` lines and the
    `Skill levels on` lines, in Appendix A's forms, and the draft's name from `builds[].draftFile`; a design field whose
    figures disagree with the plan's `tree.start` and `tree.end` or the record fails; a rung whose `tree.end` boss
    figure, or an entry, is below `tree.start`'s with `bossFall: null` fails; one whose `tree.end` boss figure is below its start's with no `boss`
    trade fails; an `n` whose `tree.end` boss figure is under the floor while its start's was at or above it fails; an
    `n` under the floor at the gate with no `damage` or `boss` trade fails (D-448's rule, kept); a `boss` trade with
    `bossAfter` passes;
  - the final display prints F1's `draftLeft` when set; the run log accepts D1-tree's `stale-server` outcome;
  - a pricing stop `pace` is recorded like `rate_limited`, and the run log's stop list accepts it;
  - `trades.json` kind `boss` with its fields passes; a revision-12 build's trades keep their 9 fields;
  - `[markers]` ignores `` `[^|]` `` in a code span; a definition with two refs joined by `; ` passes `[source-tags]`; a
    Pieces row of kind `anoint` passes;
  - a rung with an Arbiter row that has no verdict fails a design field reading "survives"; a failure message prints
    "60.0%", not "59.980000000000004%";
  - `init` writes `skillRevision: 13`; a resume of a revision-12 log stamps 13 with its boundary;
  - a `file-only` build held to revision 13 passes with F1 → `V4-claims` (pass) → its end, and with F1 →
    `V4-claims` (fail) → the round copy → D1-finish (`claims-edited`) → `V4-recheck` → its end; it fails with no
    `V4-claims` entry, with a `V4-claims` entry and no report, and with a full `V4` pass in its place; a `V4-claims`
    entry for a build accepted with its guide fails; `--snapshot` on a build with no `guide.md` copies the plan and the
    record, and `--changed` prints claim lines only; a later `guide:<id>` runs W1 and a full pass numbered after the
    claims pass's reports and passes; a file-only build before the boundary passes with no `V4-claims` entry.
- **AC-W101 (WU-131).** Static: `patterns.md`'s section 5 has "A second ailment type" with its five fields, naming
  Bloodhound's Mark (PG-101) and the three chaos debuffs in its Cautions; "Convert into the ailment's type" points to
  it; the Damage over time kit's lever beside Contagion no longer calls it an ailment lever; the pivots are in;
  no line says the compiler doesn't accept Split Personality's start; the library is at most 17,000 words, or the
  unit stopped at HG-28, the work-log recording the count; the five cap tests pin 17,000.
- **AC-W102 (WU-132).** Static: R1a, R1a-synthesize, R1b and the researcher's definition state the over-budget rule
  (both kinds, the brief's say), one assertion each.
- **AC-W103 (WU-133).** Static, one assertion each, on the D1 stages:
  - `D1-build.md`: the needs for other groups and unmeasured mechanics, no attribute need, `boss_<stage>` written
    with `skills.boss` when an entry is triggered or takes turns, the skill-level audit and its `levels:` line, the
    unique jewel candidates, the corruption rule and the gem's `corrupt`, the flasks and the empty charm slots, the
    rotation conditions, the comment reason sentence, whole numbers, no "Legacy of" example, the over-budget gear rule;
  - `D1-tree.md`: `tree.start` (when written, kept on a `tree-swap` retry), `tree.end` and `tree.search`, rebuild first
    at `max_distance: 12` with `targets`, `pace_exchange: 3`, and `pool_groups` only for a set without the clear group,
    an undone rebuild writing no need, the 1% floor, 30 swaps, the removed passives, the boss target on `n`, the
    reason for a fall and the `boss` trade, the stale-server check, unique jewels in the socket test with "Limited to"
    held, no 2% boss guard, no 3% floor, no 8-swap cap, the socket test on the targets;
  - `D1-finish.md`: the `boss_<stage>` re-check after the anoint, the `boss-fall-<rung>` claim, keeping D1-tree's
    `boss` trades, its trade calls without `targets` and the damage trade's `pace_exchange: 3`, the best damage move
    under the band, the anoint-only notables, unique jewels priced by name, no price entry for a Flask or `sameAs` slot;
  - `D1-gate.md`: the draft write on a pass in step 6, step 6's design-field additions (Appendix A), the tree judge at
    reach 12 with the rebuild and repair on `tree.start`'s targets (swaps alone where the rebuild was undone), the
    budget part's flask and `sameAs` rules.
- **AC-W104 (WU-133).** Static, one assertion each: `checkpoints.md`'s brainstorm section has the pitch rule and the
  700–900-word target, and its design gate prints the draft's name, the boss entries, the swap cap, Life and the
  `Removed on` and `Skill levels on` lines; `F1.md` and `D2-gate.md` use the session name, `first_free` on a first write only and
  the recorded name on a re-compile, and F1 removes the draft with `remove_draft`; `gates.md`'s tree part has no
  "within `max_loss`", no 3% loop and ranks a set's pool by its group, and its budget part skips Flask slots and maps a
  `sameAs` slot; `pricing.md` checks the pace line first and returns the `pace` stop, sends no over-budget rune to the
  trade site without the brief's say (:242), prices no flask, prices corrupted
  uniques uncorrupted and unique jewels by name, and has the fractured, unique jewel and price-driver notes and
  `sort_stats` for set-2 slots; W1 and the templates carry the corruption lines, the flask line, the pinned weapon line
  and the red-comment note; `V4.md` checks the `boss-fall` claim and the corruption lines; the coordinator's standing
  rules, `task-header.md` and `fix-round.md` allow the draft calls and name files by the session name; `SKILL.md` names
  files by the session name, records `builds[].draftFile` from the draft mode's reply (and null after F1's removal),
  writes the draft on an escalation's `accept`, routes D1-tree's `stale-server` outcome to the user's `/mcp` and a
  re-run, runs a file-only build's claims pass, its D1-only fix round and its re-check after F1, and tells its open
  findings at the run's end (D-477; `V4.md`, `fix-round.md`, `task-header.md`, `checkpoints.md` and `gates.md` state
  the same; the verifier's definition names the claims pass), sends a tree-only change on a schema-8 plan
  in a revision-13 run through D1-build first, lists untracked files after each step against the run's first listing,
  and is at most 325 lines or more by the lines the work-log names (WU-133 owns every `SKILL.md` line-count pin:
  `buildGuideAmendment12Design.test.ts`:514, `buildGuidePipeline.test.ts`:2886 and the `SKILL.md` half of
  `buildGuideAmendment11Design.test.ts`:239–249, which WU-131 splits from the library's cap first).
- **AC-W105 (WU-134).** Static: `pob-gaps.md` holds PG-101 and PG-102 with kind, status and Where; `03-trade.md`'s two
  examples give 61 s; amendment 12's §19 lists `Handlers.lua` and the moved tests, and §15's Voices lines cite Voices'
  code.
- **AC-W106 (WU-135).** The live test: the user's judgment, recorded in the work-log with the decisions it exercised
  (the draft at the design gate, the names, the rebuild with repair and its gain, the swap cap if hit, the boss
  entries and any `boss` trade, a pinned weapon if any, the finishing touches taken, corruption, the flasks, the pace
  line, a file-only build's claims pass) and those it didn't; D1-tree's node power times per rung; whether the option-form trade search returned
  listings.

**Test strategy.** The spine's classes (§12) apply. Engine-required tests (`engineDescribe`): AC-K76 (its pace judge
included), AC-P86 to AC-P89 (their schema rows run as unit tests too), AC-K78's final-compile rows, AC-K80's path rows.
Unit tests with fakes: AC-K78's ledger rows, AC-K79, AC-K80's timeout row. In-process MCP: AC-K78's draft rows (a
hand-written record), AC-K79, AC-K80's tool rows. Script checks on `tests/fixtures/pipeline/`: AC-W100. Static tests over the skill and
docs: AC-W101 to AC-W105. Checked by the verifier, not Jest: the work-log rows of AC-K76, AC-K77, AC-P86, AC-P87, AC-P89,
AC-K80 and AC-W101, and at integration §17's rows. Human: AC-W106. No test makes a network request: HTTP only through
`fixtureFetch`, and Jest's setup makes global `fetch` throw (D-34). The golden values (AC-B5) hold.

## 21. Risks

| ID | Risk | Likelihood / impact | Mitigation |
|---|---|---|---|
| R-61 | A rebuild with repair at reach 12, or a swap search repairing each of its up to 40 tries, runs past node power's 120 s long action on a large tree | medium / medium | WU-127's timing spike times both; the work-log records the times; AC-K76 holds each call within 120 s |
| R-62 | The repair can't reach the targets on some rungs, so the rebuild is never taken there | medium / medium | the swap loop still runs; the gate's judge shows the gap; the live test records it |
| R-63 | Split Personality's socket rule is stricter than PoB's and the game's is unverified | low / low | the stricter rule refuses less than it allows wrongly; the live test or a user report settles it |
| R-64 | The set-2 pool measured on the boss config may differ from what PoB's misc calculator reads after the switch | medium / medium | WU-127 compares one pool move against a compile on the boss pass. Seen in the build: at the same count the two agree exactly (+60,258.73), but a group counted above 1 in the plan (r2-s-2's Shield Wall, 2) ranks at PoB's count of 1 (+13.57% against the record's +13.04%); the order of moves inside one pool barely changes. The fix, `groupCount` on every counted group (it also multiplies Spirit reservation), is left for a later amendment |
| R-65 | 30 swaps a rung, each compiled, raise D1-tree's cost and time | high / low | the user prefers quality over time; the cap is surfaced; costs in §18 |
| R-66 | One item in two slots may not round-trip through PoB's save | medium / medium | WU-128's spike first; on failure the unit stops and the coordinator reports (no fallback to copies without the user) |
| R-67 | A cleaned name or a dated name surprises the user in PoB's list | low / low | the runner records the name and the gates print it |
| R-68 | A comment line PoB parses whole would add a modifier | low / high | the compiler refuses it (AC-P88) |
| R-69 | A unique just under 1 divine can cost several divines to corrupt to the wanted line, which the budget doesn't count | medium / low | the user's rule; the guide's line tells the player to buy copies; the live test records corrupted uniques' prices |
| R-70 | The brainstorm cuts may hide a piece the user needs | medium / low | `+ N more in cards.md` and the full list on request |
| R-71 | The option-form trade stat (Megalomaniac) is unverified | medium / low | priced `unavailable` until the live test checks it |
| R-72 | Removing attribute needs lets a rebuild drop a node a gem needs | low / medium | the attribute guard on PoB's own requirements; V1's `attributes` at the compile |

## 22. Migration and compatibility

- **Which rules a run is held to:** `run-log.mjs init` writes `skillRevision: 13`; a resume stamps 13 on an older log
  with its boundary, as amendment 12 set up. Every new checker rule (§6, §7, §12, §13, the design field's and the
  trades' additions) holds a build only when its last D1 gate ran at or after revision 13's boundary, and a card only
  when it was dealt at or after it, as amendment 12's `a12Build` does (`check-run.mjs`:1713–1717). A revision-12 log, and a
  build of a stamped log before the boundary, pass the checker unchanged: file names, brainstorm display, trades, the
  per-move boss guard's results, no over-budget, corruption, flask or charm rule, and a file-only build with no claims
  pass (D-477).
- **Plans:** schema 9 adds `sameAs`, a gem's `corrupt`, `tree.start`, `tree.end` and `tree.search`, and requires a
  one-line reason on each custom modifier; the compiler writes comment lines on 9 only. A schema-8 plan compiles as
  before. In a revision-13 run D1-build moves any plan it edits to schema 9, dropping its attribute needs; a tree-only
  change (a user's tree request, a gate `tree-swap` retry) on a schema-8 plan runs D1-build first, as on schema 7
  today (`SKILL.md`:217–219).
- **The write ledger:** version 2 adds `kind` and `plan`; a version-1 ledger reads as finals with no `plan`, so a
  pre-M-26 file is never a draft the delete may remove.
- **Records:** unchanged (`RECORD_VERSION` 2). The boss figure reads the ledger the record already evaluates.
- **Node power:** a call without the new arguments returns what it returns today, except that the attribute guard is
  always on (§8). D1-finish's calls pass no `targets` (§8).
- **The trade tools:** one added line; `find_upgrades`' search link stays last (C-14).
- **Files:** old final files keep their names; the ledger's entries stay; a draft's entry goes with its delete.
- **Guides already written** keep their text.
- **Rollback:** each unit is its own commits on M-26's branch; nothing changes a user's builds during the build.

## 23. Operational guardrails

- **Trade:** no agent sends a trade request during the build; test servers keep trade off (`spawnServer`). In the
  live test, one trade client at a time, through the session's server, the user told before pricing starts; the
  pace line checked first.
- **The builds folder:** the draft mode and its delete reach it only through `buildFileWriter` and the ledger, in the
  live test; tests use temp folders. The delete backs up first and never touches a file the run didn't write or the
  user changed.
- **The guides folder:** WU-127 reads only the two plans the user granted (HG-6's grant at approval, §24), copies them
  unchanged, and records their sha1s; no machine path enters the repository.
- **The private library stays private:** nothing of it is committed.
- No agent contacts pathofexile.com or sends a request carrying a cookie or personal data without the user; poe.ninja
  only through its documented economy endpoints, politely (D-297, D-335). Never read `.env`; never set `POESESSID`.

## 24. Human-decision gates

| ID | Condition | Unblocks with |
|---|---|---|
| HG-27 | The build of M-26 starting: the user's approval of this amendment after the review. It grants HG-12 (the user's "yes to all", 2026-10-30) for: node power's new arguments and guards, `free` on a pool node and Split Personality's start (C-55); `compile_plan`'s draft mode, `remove_draft` and `first_free` names, and its schema-9 behaviour (Split Personality's start, `sameAs`, comment lines, gem corruption, V1's new rows) (C-41); `buildFileWriter`'s delete and the ledger's version 2 (C-17, D-211); the trade tools' pace line (C-14, D-71, D-72); the path tools from Split Personality's start (C-48); and `compile_stage`'s 120 s long action (C-4, NFR-21, HG-13's case; item 13b's default); and plan schema 9 (C-31).
Split Personality's start applies on any schema. It grants HG-6 for WU-127's copy of the two Titan Rake plans (the user's "yes", 2026-10-30). For M-26 only | the user's approval |
| HG-28 | WU-131's library over 17,000 words after its additions: the unit stops with the count | the user's cap |
| HG-29 | The live test, WU-135, after M-26 is built: live trade through the server, web research on D-171's hosts, writes to the real builds folder (the draft and its delete) | the user starts it |
| HG-30 | WU-127's rebuild with repair falls short of AC-K76's gains on a fixture: the unit stops with the figures and the repair steps | the user's decision (a lower bar, or more search) |
| HG-31 | Resolved (the user, 2026-10-30: "verify on file-only build"): a file-only build skipped V4, so a claim error reached the end with no fix route (the Titan Rake run's r2-s-1, item 13's last point); it now gets the claims pass (D-477, §15) | settled |

## 25. Choices for the user, and proceed-on assumptions

**The user's answers and rulings:** Split Personality, the pinned weapon, ailment types, the over-budget cores, the
brainstorm cuts (2026-10-28); the draft and its removal, the names, the comment lines, the rebuild with repair, the
3× exchange, target "A", the boss target, charge generation to amendment 14 (2026-10-29); the gap analysis's answers
(2026-10-30): the tool grants, the fixtures, 17,000, Bloodhound's Mark, the edited draft and the compiler-written
comment (the recommendations), one exchange for all three pace figures, the corruption rule and its cheap line (under
1 divine), life and mana flasks with
empty charm slots, 30 swaps surfaced at the gate, timeless jewels skipped, no second anoint (the shard's price); a
file-only build's claims pass (HG-31, with the approval, 2026-10-30).

**Defaults the user saw** (the gap analysis, 2026-10-29 and 2026-10-30), written above as decisions:
- `SKILL.md` within 325 lines, trimmed to fit, or more by the lines a rule can't do without, named in the work-log;
  rules by revision 13 (X1, X2);
- the live test closes M-26 (X5);
- Split Personality: the socket connected without its own start, one tree per start, a V1 finding for a useless
  variant, the scope, a spike first, the library line dropped (§4);
- the pinned weapon's form, the two pairs, set 2 still used, priced once, schema 9 (§5);
- the ailment entry's place, example key, kit wording, the chaos-debuff caveat, C-53's correction (§11);
- the over-budget names, what counts as the brief's say, the checker as the only enforcement, the culling example (§6);
- the brainstorm cuts' details (§16);
- the draft by a measure-only compile's XML (as reshaped here, §7), written on a pass, overwritten by a revise, removed
  by F1 with a backup, kept after a stop; the names' cleaning, the first free name, the checker's three forms (§7);
- the comment from the reason, never a modifier, skipped by the readers, red in PoB, whole numbers (§10);
- the boss figure's correction and `boss_<stage>` in D1-build; no target on `m` and `b`; `tree.start`; node power's
  targets mode; Life shown, not a target; the socket test on the targets; the 15% trade allowance kept; the runaway
  guard of 30; `pace_exchange` as an argument; the gate's judge at reach 12; the shown entries and the `boss` trade;
  needs completeness; the attribute guard; the pool's own group; a buff valued with and without; `free` on a pool node
  (§8, §9);
- skill levels, unique jewels with a spike, timeless out, anoint-only notables, rotation conditions, pricing notes,
  budget tiers and Headhunter out (§14);
- the pace line and the pricing step's check; the tool problems' fixes; the leftovers (§15).

**Proceed-on assumptions** (the drafter's, for the user's read):
- Split Personality's stricter socket rule (§4, R-63);
- only a weapon slot and its own Swap slot share an item (§5);
- the Raven-Touched Shard joins the over-budget rule beside the "Legacy of" cores (§6);
- the draft as its own `compile_plan` mode that copies the last whole-plan measure-only XML, so it runs no engine and is
  written only on a pass, or by the runner on an escalation's `accept` (§7; the gap list's default wrote it with the
  gate's compile); drafts count ` (draft 2)` and have no dated form; the ledger's `kind` and `plan` (§7);
- a refused character replaced with a space, then runs of spaces collapsed, leading spaces trimmed (the user accepted
  "replaced"; the trim is the build's, WU-129); a device
  name gains " (build)"; `first_free` only on a build's first final write (§7);
- under `targets`, tries the repair can't fix don't count toward the 5 legal tries (§8); each pace figure judged on its
  own against the Main damage gain (§8); the attribute guard on by default (§8); a pool ranked on the boss config, its
  guards on the map config, only for a set without the clear group, and AC-K76's 1% tolerance for it (§8, R-64);
  D1-finish's trade calls without `targets`, the damage trade with `pace_exchange: 3` (§8); an undone rebuild writes no
  need (§8); the stale-server check in D1-tree (§8);
- the alternative is the best measured tree at or above the start's boss figure (§9);
- AC-K76's thresholds at half the experiment's gains (§20, HG-30);
- corruption on `b` and `n` only; never on rare, magic or normal items, jewels among them, while a cheap unique jewel
  follows the unique rule; with no price to judge by, allowed with `cheapness unchecked` (§12);
- flasks on `m`, `b` and `n`, Ultimate bases, no mana flask on a build that spends no mana, toggles off unless a
  flask effect is used, flasks unpriced, a filled charm slot fails, a missing life flask fails (§13);
- the option-form trade check moved to the live test (§14); unique jewels priced by name with their share in the
  reason (§14);
- a missing or off pace line stops the pricing step with the `pace` stop (§15);
- PG-101 and PG-102 (§17);
- the claims pass's form: its own stage `V4-claims`, the build `designing` until the re-check, D1 the only owner, the
  open findings told at the run's end (D-477).

## 26. The independent review and its resolution

The review (2026-10-30), on revision 0: four lenses with fresh context, read only (invented decisions about 200K
tokens, task graph and criteria 226K, ground-truth fidelity 336K, completeness and compatibility 313K), found 100 raw
findings, clustered into 15 (K1–K15); two skeptical verifiers (275K and 264K), defaulting to "refuted", confirmed 46,
partly confirmed 33, refuted 20 and left one unjudged. The coordinator re-checked four in the code: K5's whole-file
`trades.json` write (`D1-finish.md`:244–246) and its trade arguments (:294–301), K6's ledger key
(`writeLedger.ts`:25–35) and `compile_plan`'s engine kind (`toolMeta.ts`:56), and found that nothing checks "Limited to"
today (§14). Revision 1 folds the confirmed and partly confirmed findings. A fresh consistency pass on revision 1
(245K) found 27 places where the fold left two sections disagreeing (2 high: the stale-server check would have stopped a
correct server whose repair missed its targets, and the D2 gate's first campaign write was called a re-compile); all 27
are folded. Revision 2 adds D-477 at the user's answer on HG-31, after the review: no lens read it, so WU-130's and
WU-133's unit reviews check it against `check-run.mjs`'s step order and the V4 report rules.

| Cluster | Verdict | Resolved in |
|---|---|---|
| K1 the boss floor: an undo of D1-tree's own move (the user's target) and a checker row wider than it | partly (the undo stands; the row was too wide; no bound under the floor refuted) | §9, AC-W100 |
| K2 a pool ranked on the boss: the clear set moved off the clear; today's ranking misdescribed; the boss config's home | confirmed (needing Compile.lua refuted) | §2, §8, AC-K76, R-64 |
| K3 the design field: no writer, `boss` redefined, display lines with no source | confirmed | §8 (step 7), §9, WU-133, AC-W100, AC-W103, Appendix A |
| K4 the gate's judge and `tree.start`: no targets, a drifting start, an undone rebuild freezing the tree | partly (an endless loop refuted) | §8, §9, AC-W103, Appendix A |
| K5 D1-finish: `boss` trades deleted, its node power arguments broken, flasks and `sameAs` still priced | confirmed | §5, §8, §9, §13, WU-133, AC-W103, AC-W104 |
| K6 names and drafts: two builds on one file, forked finals, no draft on an accept, the engine kind, old rules, the ledger | confirmed (the strict-shape break partly) | §7, §22, WU-129, WU-133, AC-K78, AC-W100, AC-W104, Appendix A |
| K7 the pace line: an unpassable row, errors, C-14's last line, the stop, a stale node power | confirmed or partly | §3, §8, §15, WU-129, WU-130, AC-K79, AC-W100, Appendix A |
| K8 waves: `treeHandlers.ts` shared, a test glob, amendment 12's static test, spike failures | partly (the wave-1 fixture and WU-133's order refuted) | §19 |
| K9 revision gating per build; a schema-8 plan on the tree-only route | partly | §6, §7, §12, §22, AC-W100, AC-W104 |
| K10 corruption: unique jewels, no price to judge by | confirmed or partly | §12, §25, AC-W100 |
| K11 Split Personality's socket rule in node power and the path tools | confirmed (coverage partly) | §4, AC-K76, AC-K80 |
| K12 `compile_stage` at 120 s against C-4 and NFR-21; the swap search untimed | confirmed or partly | §15, §19, R-61, HG-27 |
| K13 criteria: rounding, repair failure, boss obligations, sha1s, engine classes, rows missing | 13 confirmed or partly, 11 refuted | §20 |
| K14 facts: 63 cores, 16 anoint-only notables, D-418, contract IDs, the needs range, `customModsWritten`, Vestige, the boss estimate, the culling example, unique jewel prices, the reason's line | confirmed or partly (default weights, D1-gate.md:164, the stray-file baseline refuted) | Names, §3, §6, §8, §10, §11, §14, §15 |
| K15 labels and the user's words: key pieces, `SKILL.md`'s cap, the token cap, unlabelled assumptions, HG-30's wording, the grant list | partly (the 2% reason point refuted as labelled) | §6, §9, §16, §18, §24, §25, README HG-27, HG-30 |

The 2% point at which a boss reason was owed was refuted as an invented decision (it was labelled), but revision 1
follows the user's words instead: a reason for any fall (§9).

## Appendix A. Formats

### The plan (schema 9)

- `items.slots[]`: `{slot, text}` as before, or `{slot: "Weapon 1 Swap", sameAs: "Weapon 1"}` /
  `{slot: "Weapon 2 Swap", sameAs: "Weapon 2"}`; `sameAs` names a slot the stage fills with `text`.
- A skill gem: `{name, level, quality, enabled, corrupt?: "plus_one_level"}`; not on a support gem (V1 `corruption`).
- `stages[].tree.start?` and `stages[].tree.end?`: `{ehp: <number>, lowestMaxHit: {type, value}, life: <number>,
  boss: <number> | null, bossEntries: [{group, label, figure}]}`, written by D1-tree (the start per §8 step 2, the end
  on its finished tree); no compile reads them.
- `stages[].tree.search?`: `{swaps: <n>, lastGain: <percent> | null, capHit: <bool>, rebuild: "taken" | "none" |
  "undone: <why>", removed: [{names, skill}], bossFall: <the designer's reason> | null}`, written by D1-tree.
- Comment lines: the compiler writes `# <reason>` before each `config.customMods` line of a schema-9 stage; the plan
  holds no comment entries; a schema-9 entry's `reason` is required and holds no line break.
- V1 codes: `tree-shape` gains rule `alternate-class-start`; `corruption` (a `corrupt` gem on `m`, a campaign stage, or a
  support gem).

### `compile_plan` (C-41)

- Final: `{plan_path, build_name, first_free?: true}`; `first_free` on a build's first final write (and a campaign's
  first, the name ending ` (campaign)`), the recorded name without it on a re-compile. Measure-only:
  `{plan_path, measure_only: true, stages?}`.
- Draft: `{plan_path, draft_name}` writes `<cleaned name> (draft).xml` (or ` (draft 2)`, ` (draft 3)`, §7), engine
  kind `none`; `{plan_path, remove_draft: <relpath>}` deletes. Its reply: `Draft written: <relpath>` or
  `Draft removed: <relpath> (backup <path>)`, or its refusal.
- With `first_free`, the name is cleaned and the first free of `<name>`, `<name> <date>`, `<name> <date> <k>` is used;
  the reply and the record's `pobFile.path` name it.

### The write ledger (version 2)

Each entry: `{path, sha1, runFolder, writtenAt, kind: "final" | "draft", plan: <plan path>}`. A version-1 entry reads
as `kind: "final"` with no `plan`. A name is free for a write when no file has it, or this build (`plan`) wrote it and
it is unchanged on disk; the delete takes only a `draft` this build wrote, unchanged.

### `get_node_power` (C-55)

- Added: `targets {ehp, maxHit}`, `pace_exchange` (a number, D1-tree 3), `pool_groups {"1"?, "2"?}` (plan group
  numbers).
- The compact reply's rebuild line under `targets`: `Rebuild: +<x>% Main damage; EHP <a> (target <t>), lowest max hit
  <b> <type> (target <u>); repaired: freed <n> points (<names>), added <m> (<names>); …` or `Rebuild: misses its
  targets after repair: EHP <a> of <t>, lowest max hit <b> of <u>`.
- A pace figure over its exchange reads `<figure> −<L>% needs +<r×L>% damage, the move gains +<G>%`.

### The trade tools' pace line

On every `search_trade_items`, `get_item_price` and `find_upgrades` reply, errors from the handler included: the last
line, or in `find_upgrades` the line before the search link:
`Pace: 45 s between searches, at most 7 in 5 minutes.` or `Pace: off (test setting).` (the server's pace is off).

### `<buildFolder>/trades.json` (additions)

`kind` gains `"boss"`, written by D1-tree on a rung whose `tree.end` boss figure is below `tree.start`'s, and kept by
D1-finish's whole-file write. In a build held to
revision 13 every entry carries, beside the 9 fields, `bossEntries` (`[{label, before, after}]` on `boss` entries, else
`null`) and `nodes` (`{remove: [ids], add: [ids]}` on `boss` entries, else `null`); one held to 12 keeps its 9. A
`boss` entry also carries `bossAfter` (the alternative tree's boss figure), which the checker accepts on `boss` beside
`defence`, `damage` and `avoidance` (`check-run.mjs`:5233).

### The D1 gate's design field (additions)

Written by D1-gate step 6 from the plan's `tree.start`, `tree.end` and `tree.search` and its own compile. The rung's
existing `boss` (`measured`, `estimate`, `corrections`, and `floor` and `under` on `n`, `D1-gate.md`:199–212) gains
`start`, `end` (D1-tree's), `entries: [{label, start, end, final, valuedBy: {figure, reason} | null}]` and
`bossFall: {claim, reason} | null` (the reason from `tree.search.bossFall`, the claim id `boss-fall-<rung>`). Per rung:
`life {start, end}`, `swapCap: {swaps, lastGain} | null`, `rebuild: "taken" | "none" | "undone: <why>"`,
`removedForOthers: [{names, skill}]`, `levels: [{skill, plus}]` (from `pieces.md`'s `## Skill levels`, the skills at
+0). The draft's name isn't here: its one home is the run log's `builds[].draftFile`.

### F1's verdict (addition)

`draftLeft: <relpath> | null`: the draft F1 couldn't remove (changed on disk, or not this build's), which the final
display prints.

### The design gate's display (the lines that change)

```
- Draft PoB file: Royal Fury Rake Titan (draft).xml, in your builds list.
- Boss rotation on n: 380,000 → 405,000 on the tree, 412,000 at the gate (floor 250,000). Shield Wall 690,000 →
  655,000 (−5%) → 668,000, Rake 310,000 → 340,000 → 345,000, Seismic Cry 275 → 260 → 260 (valued by the buff: +6% to
  the rotation, the designer): Shield Wall gives up 5% for 8% more Rake on the clear (the designer).
- Boss trade on n: keep the start's set-2 crit nodes (remove 4, add 4): boss 412,000 → 430,000, damage −3%, EHP +0%.
- Life on n: 3,138 → 2,943 (EHP and the lowest max hit held their start).
- Swap cap on b: 30 swaps, the last +1.4%.
- Rebuild undone on m: the compile refused it (attributes).
- Removed on n: Herald Damage (2 notables): lines for Herald of Blood.
- Skill levels on n: Shield Wall +0.
```
The figures are illustrative.

### The brainstorm display (revision 13)

```
What the composites share: <one or two sentences>.
1. Royal Fury Rake Titan: spear Rake with Shield Wall on set 2; under-played: yes
  in: Nebuloch, Poison III, Doomsayer, Crimson Assault, Blood Magic, Tribal Fury, Rage, Cranial Impact, + 31 more in cards.md
  scheduled: Megalomaniac, Time-Lost Emerald
  drawn from mobalytics.gg
Plain cards: Ritual Pyre Rake, Bloodhound Rake, …
```

### `references/corruption.json`

```json
{"cheapUnique": {"under": 1, "currency": "divine"},
 "rungs": ["budget", "non-budget"],
 "source": "the user, 2026-10-30 (the rule and the line); the rungs are proceed-on"}
```

### The run log

- `skillRevision: 13` (written at `init`, stamped at `resume` with its boundary).
- `displays[]`: `{checkpoint, visit, numbers?: {"<n>": "<card id>"}}` (the brainstorm gate's, revision 13).
- `builds[]`: `draftFile` (the latest draft's path, or null) beside `pobFile`, on builds of a log holding revision 13;
  absent in older logs, and the checker accepts both shapes.
- Pricing stops: `STOP_OUTCOMES` gains `pace` (a missing or off pace line, §15), recorded like `rate_limited`.
- Stages: `V4-claims` (a file-only build's claims pass, D-477), outcomes `pass` and `fail`; its report
  `reports/V4-<n>.md`, H1 `# V4-<n>: claims pass`, `check: "claims"`.