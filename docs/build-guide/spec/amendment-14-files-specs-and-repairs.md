# Amendment 14: a PoB file at every gate, items as specs, and the tree tools' repairs

**Status: APPROVED, revision 2, 2026-11-02.** Revision 1 folded the independent review (§29: four lenses, two
skeptical verifiers, then a consistency pass on the fold; 90 raw findings, 61 material, none refuted; 27
disagreements left by the fold, all folded); revision 2 folds the user's yes on HG-33, the open-spell fixtures. The
user approved it on 2026-11-02: "You may copy this run's two plans (r1-s-4, r1-s-2) from my run folder into the test
fixtures (HG-33). Continue." It formalizes items 4 to 26 of the
amendment 14 candidate list (the coordinator's running list), with:
- the user's 15 notes from the live test of amendment 13 (WU-135, the open-spell run of 2026-10-31, builds r1-s-4
  "Threaded Hex Coiling Bolts Lich", taken as its PoB file only, and r1-s-2 "Rupture Relay Arc Lich", with its endgame
  guide), kept in the user's private guide library (`analysis/live-test-open-spell/user-feedback.md`, cited as [notes]);
- four reviews of that run in the same folder, each citing the run folder and the code: `review-design.md` [RD],
  `review-checks-pricing.md` [RC], `review-pob-data.md` [RP], `review-gates.md` [RG]; and the design-gate display as
  the user wants it, `gate-rewrite.md` [GR];
- the user's words in the session (2026-11-01 and 2026-11-02), quoted where they're used (§1) and kept in the
  coordinator's memory files;
- a gap analysis of the candidates (2026-11-02) and the user's answers to it, in two rounds (§28);
- three read-only surveys of the code and docs at `94c8747` (2026-11-02: gates and files, items and pricing, the tree
  tools), cited by file and line.

Deferred to a later amendment, by the user's word (2026-11-02): charge generation (item 1, waiting on reference builds
the user will pick), charms (item 2, waiting on the finishing-touches survey), timeless jewels (item 3, waiting on a
source for their transformed nodes), and tuning the trade pacing (item 27: "I want to tune the request timeout at some
point; we may have set it too conservatively"; it needs live requests, so the user's approval and a pricing run).

It is written against spec v1.6 and amendments 8 to 13, all built (M-26). Paths are from the repository root, except
stage files (`D1-build.md` and so on), under `.claude/skills/build-guide/references/stages/`, and the skill's other
files (`SKILL.md`, `references/`, `scripts/`, `templates/`), under `.claude/skills/build-guide/`; the repository root's
own `scripts/` folder is never meant. Decisions continue from D-478, work units from WU-136, criteria from AC-W107
(pipeline), AC-P90 (plan compiler) and AC-K81 (server tools), risks from R-73, gates from HG-32; the milestone is
M-27. It adds PG-103 to PG-105 to `docs/build-guide/pob-gaps.md`. The plan schema gains version 10 (§25). Each
decision ends with the rows and rules it amends. Appendix A fixes the formats; §28 lists the user's answers, the
defaults the user saw, the points where this spec departs from them, and the drafter's proceed-on assumptions.

**Names.**
- A **skeleton file** is the verification gate's PoB file, `<card name> skeleton (draft).xml` in the builds folder: the
  card's skeleton plan as R1b last compiled it (§5). A **draft** is still the design gate's `<name> (draft).xml`
  (amendment 13's D-466).
- **Reading back** is the server comparing a PoB file the user edited with the file the server wrote, and the runner
  showing the differences as a revision (§5). **Adopting** a file is the server taking the edited file as its own once
  the user says yes, so the next write replaces it (§5).
- A **one-item swap** is a revision that changes one slot's item, on one or more rungs, and nothing else (§7).
- The **user's words** are the text of a revision as the user wrote it, kept verbatim beside any restatement; for a
  read-back, the server's list of differences (§8).
- A rare's **must-haves** are the 3 or 4 affixes its figures rely on, each at a **tier** (the game's numbering: T1 the
  best a base can roll); a rare's **spec** is its base, its must-haves with their tiers, and the weights that ranked
  them (§9).
- A rung's **item level** for affix tiers is 69 on `m` and 82 on `b` and `n`, this amendment's own choice (§28: `b`'s
  35% boots, D-440, need item level 82); a campaign stage's is its C1 area level, as V1's `movement-tier` reads it. The
  **best tier allowed** for an affix is the best tier PoB's mod data lets that base roll at that item level; the **floor
  tier** is two tiers under it (T3 when T1 is allowed).
- The **budget search** and the **depth check** are the searches that price a rare spec (§9); the **depth price** is
  the 5th-cheapest of at least 10 listings sorted by price.
- An **over-budget find** is a dearer item the design left out for its price, measured and priced (§12); **late
  endgame scaling** is the guide section and notes block that list them when the user asks for it.
- **Unconfirmed** is the status word that replaces "needs in-game testing" (§15).
- An **exclude list** is a rung's nodes the tree search may never add (§16).
- A step's **scope** is a task-header field that narrows a step: D1-finish's `swap` and `scaling`, W1's `notes` (§7,
  §12, §13).
- A **revision-14 run** is a run whose log holds `skillRevision: 14`, read by boundary as amendment 12 set it up.

## 1. The user's direction

From the live test's notes (2026-11-01; the numbers are [notes]'s, the quotes the user's words in the session):
- 1: the brainstorm gate is "much better", but its first section isn't useful; the second (rotation, what makes it
  work, the catch) is all that's needed: "Move any key info from section one into section two and drop section one";
- 2: when designers find gear that gives a big boost but is too dear, note it; before finalization, ask whether the
  user wants late endgame scaling; if yes, the dear items go into the guide's late endgame scaling section, not a new
  tier or loadout, just enough to point the player the right way;
- 3: a file-only build's PoB notes carry how to play and when to switch (minimum levels for gear, skills and
  ascendancy nodes), and late endgame scaling; a guide build's carry the guide;
- 4: the verification gate's output is fine but needs formatting: bold titles and labels, bullets;
- 5: the design gate's output is bloated with stats; the data structures of the build tools and design process leak
  into the format; wanted: a high-level summary and a PoB file; trade-offs as "{item 1} was swapped for {item 2};
  adding it back gives +8% damage and −1.3% EHP for 100 divines";
- 6: "what I really need at each gate (aside from brainstorming) is a PoB file I can look at. Interviewing the agent is
  too inefficient"; "Tell me what would need to change to make that possible";
- 7, 8, 13: "you can't base a build guide on an item that only has one listing ... A build guide has to be flexible
  enough that any player could implement it from whatever is currently available"; design an item with the mods the
  build needs and use trade for a ballpark price; search the 3–4 affixes that matter and accept whatever else the item
  has; drop or swap an affix until in budget; when a search returns only a few items, look for another source of the
  stat; random-roll uniques with a wanted corruption (Morior Invictus) are statistical outliers;
- 9: standard gear has 1 rune socket, two-handed weapons and body armours 2; check whether PoB has the count;
- 10: "The agents keep telling me to test things in-game. This isn't practical advice, since most of the time 'test
  in-game' means start a new character, beat the campaign, and get to level 65+";
- 11: was Crystalline Phylactery skipped because PoB doesn't model its line?
- 12: rares named by their item name are meaningless; say the key affixes instead;
- 14: the Arc Lich's staff revise: "Are you going to spend another million tokens now and run the entire pipeline to
  swap the weapon?"; "What on earth did you just spend an hour doing?? The whole point of the revision was to use the 5
  divine staff";
- 15: weighted trade-search links per gear slot, in the PoB notes and the guides.

During the run (2026-11-01): "Wait, I didn't say I wanted a guide" (after "accept as it stands" was restated with the
guide). On revisions (2026-11-01, the coordinator's record of the ruling): a revise goes to the step as the user said
it, with no added latitude, and the run stops at the first return that departs from it, instead of reporting and running
on.

Rulings of 2026-11-02:
- **Corruption:** "extra sockets allowed within budget, corruption implicits out (it could potentially go as a line in
  the scaling guide, but not in the standard build rungs)"; on cheap uniques, "that rule still stands; my last message
  was intended as an extension to that rule for non-cheap uniques".
- **Sockets:** 1 per gear item, 2 on body armours and two-handers; Exceptional bases may drop with one more; Corona
  Amulet, Grasping Ring and Stalking Belt have 1, and PoB's base data has no line for them; uniques carry PoB's
  `Sockets:` line for a count that isn't standard; new bases may come later.
- **Weighted links:** "The link works"; ctrl-click from the terminal "didn't open it reliably", pasting into Firefox
  worked: "Acceptable".

The answers to the gap analysis (2026-11-02), first round: "Take your defaults for anything that isn't covered below";
- reading edits back: "this is a great idea, and it should work at any gate";
- which search prices a rare: the must-have search; and how does PoB build its weighted search's values, "We might be
  able to use that as a shortcut to determine the must-have affixes instead of making assumptions. However, this is
  vulnerable to skipping affixes for effects that PoB doesn't model";
- what the compiled rare holds: "use the must-have affixes, at the highest tier allowed at that item level (based on
  character progression at that rung)"; "Players tend to price T1 items at a premium, even if the difference between
  tiers is small, so lowering the search to T2 or T3 will often drastically reduce the price without sacrificing too
  much performance. The strategy I use is decrementing the minimum tier of the least important affixes to see if that
  makes the item affordable. Usually the items are within the budget rung range with a mix of T3-T1 affixes. If the item
  is still unaffordable even at lower tiers, I remove the least important affix";
- campaign gear late in the league: from about the second week, players on their second characters "drive up the
  prices of the best gear usable at low levels"; "a T8 item at item level 20 will be nearly as expensive as a T1 or T2
  item at item level 82"; "Usually the solution to this is to only use two or three affixes in campaign guide gear";
- market depth and the search budget: "agreed as stated";
- movement speed: "most players will assume that the skill penalty to movement speed is not included in the stated
  value. The agent should use the regular movement speed in its messages"; and the user's recollection that 35%
  movement speed boots are mandatory: the rule exists as D-440 (30% on `m`, 35% on `b` and `n`, unless the plan records
  a boots exception), and both open-spell builds recorded one (§2).

Second round: "Take your recommendation on must-haves", the recommendation being: PoB ranks the slot's affixes, the
designer takes the must-haves from the top, adds what the build needs that PoB scores at zero, keeps prefixes and
suffixes legal, and gives a one-line reason both ways, which the checker holds; with the user's note that PoB's
"adjust search weights" list weights more than damage and EHP ("mana regen, attributes, minion stats, etc."); and,
accepted with "Everything else looks good", the coordinator's loop: the compiled rare at the tiers the loop ends at,
each line at its tier's lowest roll; the least important affix measured, not guessed; a budget search at the floor
tiers capped at the target, then a depth check at the mix it shows; under 10 listings at the floor, drop the least
important affix; usually 2 searches a slot, at most 4; `n` starting at T1; `b` and `n` sharing a sequence when their
spec is the same. Where revision 1 departs from this loop, §28 says so.

## 2. What the live test showed

**The gates** [RG], [RD §1]. The brainstorm display's first section (key pieces, `scheduled:`, the shared header)
repeats `cards.md`; the runner's pitch under it is what the user read. The verification display prints
`Label: value` lines and one run-on tail (risks, PoB can't verify, stronger structure) of several hundred words a card
(`run-log.mjs`:1860–1884). The design display measured 2,528 to 3,586 words a visit (`run-log.mjs`:2304–2374); the
draft's line was third, and the user never saw it. The draft was written, shown and removed at every pass (D-466 as
built), and the run folder keeps no trace of it after F1.

**The revise** [RD §8], [notes 14]. The user asked for a 5-divine staff, with "if it's not a crit build, it doesn't
need the crit damage suffix". The runner's brief turned the condition into "say what goes in that suffix instead" and
added "n may take better rolls"; D1-build wrote dearer staffs; the runner reported and ran on: D1-build 296K, D1-tree
287K (it found nothing), D1-finish 468K, D1-gate 257K tokens, about 69 minutes. Visit 4's improvised route (D1-finish
alone, its brief overriding its card) cost about 493K, left `tree.start` and `tree.end` stale, and `n`'s boss figure
fell from 519,477 to 400,434 with no reason shown [RD §4]; three defence trades relabelled "measured on the earlier
staff" failed `DEFENCE_REASON` (`check-run.mjs`:5517) [RD §9.2].

**Accept** [RC §1]. "Accept as it stands" was restated as the design gate's `accept` (F1, then the guide); the user
said yes, then "Wait, I didn't say I wanted a guide" once W1 had started. No entry can amend a logged answer
(`run-log.mjs`:556–563), and the checker's flow sends F1's pass after `accept` only to W1 (`check-run.mjs`:4065):
27 violations, 19 of them that cascade. The `audit.md` F1's route rendered says "Known issues: None." while two
findings stayed open.

**Items** [RD §5, §7], [RC §2, §4, §5]. The runner's brief told D1-finish "match the plan's item to the listing", so
D1-finish rewrote every rare of `b` and `n` on r1-s-2 to the priced listing (14 copies), against D-371. Prices take the
weighted search's first listing with no count (`pricing.md`:161–164); the staff on both rungs rests on one listing.
D1-build's rares held rolls over their caps (body flat energy shield +100 and +150 against 96 beside Spirit, helmet +90
against 73, gloves +70 against 60, belt mana +150 against 124), found only at pricing. Morior Invictus was searched with
`min_rune_sockets: 4` and no corrupted filter; corrupted listings were credited with "the fourth socket", and a
125-divine corrupted listing's price sits on the plain compiled copy, while the 509-divine uncorrupted figure has no
price entry. Designers wrote corruption-only sockets onto unmarked items (Alpha's Howl with two runes; r1-s-2's
three-socket rare body and two-socket rare gloves), likely from the base lookup's "Sockets: up to 4"
(`src/handlers/lookupHandlers.ts`:308, PoB's ceiling); runes past an item's sockets are dropped silently
(`vendor/PathOfBuilding-PoE2/src/Classes/Item.lua`:1642). 37 generated rare names reached the notes and the chat
[RC §7]. One `find_upgrades` session fallback (`Trade search not run: …`, with no `[trade:<kind>]` prefix,
`src/trade/renderUpgrades.ts`:59–61) was read as `no_session` and marked nine rares unavailable, though the anonymous
searches kept working [RC §3]. D1-tree made six trade searches no notice announced and the run log couldn't record
(`run-log.mjs`:415–416) [RC §3].

**The tree search** [RD §3], [RP §2]. r1-s-4's every rebuild was illegal on attributes; r1-s-2's added Mind Over
Matter, which the build leaves out for mana; steps hand-edited the rebuilds and logged them `taken`. The swap cap was
never hit; node power took 8–35 s at the median, 57 s at most, with no timeouts. After D1-finish's listing rewrite
lowered `n`'s EHP and lowest max hit under `tree.start`, the gate's judge, held to the old targets, found +5.37% with
Mind Over Matter, and the `tree-swap` retry rewrote `tree.start` against `D1-tree.md`:161. Crystalline Phylactery
(node 17788) went out unmeasured and the user wasn't told.

**The claims** [RC §1], [RD §9.4]. The runner briefed r1-s-4's fix round "claims only … leave n's two sapphire item
texts as they are", with a false fact; the re-check refuted the result; the shipped PoB file still holds the impossible
"Withered Magnitude" sapphire line; a file-only build's open findings reached the user only in the run's last message.

**The words** [RC §6], [RC §8]. "Needs in-game testing" appeared 44 times in the run's markdown and 38 in chat. The
guide's toughness sentence says `n` is under its band only "with every condition against it" while its plain EHP is
always under (12,100 against 20,000), a checker rule bug (`check-run.mjs`:5932); its level labels disagree (74/88/93 in
"Survival by stage", 72/84/90 in the triggers).

**The movement figure.** Both builds wore Windscream (10–20% movement speed, `Data/Uniques/boots.lua`:145–154) under a
recorded boots exception (D-440): r1-s-2 because the user asked for it, r1-s-4 because its "Curses have no Activation
Delay" carries the build. The record's movement figures (+11.6% to +15.4%) were PoB's for those boots; the Titan Rake
fixture's boots hold the rule (30%, 35%, 35%).

## 3. What already fits

- **The draft mode accepts a skeleton.** `compile_plan`'s draft mode takes any plan in a run folder whose record is its
  whole measure-only compile (`src/plan/compiler.ts`:1725–1761); R1b's last compile is one (`R1b.md`:266–268), and the
  draft is a byte copy of `compiled-build.xml` (:1781–1789). `remove_draft` matches the ledger entry's `plan` (:1808),
  so a skeleton is removed with its concept's plan path. Only the skill's rules block a skeleton draft
  (`references/task-header.md`:60–64; the coordinator's definition; `SKILL.md`:44–49).
- **The XML is already parsed** for builds (`src/services/buildService.ts`:1–44), so a read-back is a comparison, not a
  new parser.
- **PoB's notes** are the `<Notes>` element's plain text, with `^0`–`^9` and `^xRRGGBB` colour codes and no length
  limit (`vendor/PathOfBuilding-PoE2/src/Classes/NotesTab.lua`:17–19, :34, :77–90); escaping `& < >` suffices
  (`src/services/buildExportService.ts`:84–86). `set_build_notes` writes them through `buildFileWriter` but never
  updates the write ledger (`src/handlers/buildHandlers.ts`:400–418).
- **PoB's weighted search runs headless with no request.** `trade_generate_query` is pure Lua (`pob-api/API/Trade.lua`:
  378–517). It puts a blank rare of the slot's base in the slot (`TradeQueryGenerator.lua`:782, :833–845) and tests
  each affix of the slot's item class (`Data/QueryMods.lua`, one range per class) alone at the middle of the class's
  range, weighing the gain in the chosen stats (default Full DPS 1, `TotalEHP` 0.5; any stat of PoB's list,
  `data.powerStatList`, `Modules/Data.lua`:127–172, among them Spirit, mana regeneration, the attributes and movement
  speed); weight = gain per point (:681). It orders affixes by the gain at the middle roll (`meanStatDiff`, :939–946;
  `Trade.lua`:371–376), not by weight. `find_upgrades` takes the stats to weight (`sort_stats`, 0.01–1 each), required
  affixes with minimums (at most 3), a price cap, `include_non_upgrades`, `weight_corrupted_mods` and `rune_behaviour`
  (`src/server/toolSchemas.ts`:1553–1586); one call usually makes two trade searches (its description, :1548). The
  `?q=` link needs no request when the league is known (`src/trade/links.ts`:23–26). It costs 80–129 engine
  evaluations, 2.3–4.5 s a slot (`docs/stabilization/spikes/S-1-headless-trade-generator.md`:61–67).
- **Trade replies carry each affix line's tiers** in the line's `mods[]` (`tier`, e.g. "P3", "S1"; one line can merge
  several mods), not in an `extended.mods` block (`docs/stabilization/spikes/S-3-trade2-fixtures.md`:27, :42–44, :56;
  the committed fixture `tests/fixtures/trade2/fetch-ring-divine.response.json`); our parser keeps them
  (`src/trade/modLines.ts`:30, :71–84), though only `search_trade_items`' path calls it today.
- **PoB's mod data holds every tier** (`Data/ModItem.lua`: text, range, item level, group, prefix or suffix, base
  tags) and reproduces the run's four caps exactly (body 96, :209; helmet 73, :206; gloves 60, :205; belt mana 124,
  :107); the affix counts are PoB's too (a rare 3 and 3, a rare jewel 2 and 2, `Classes/Item.lua`:1302–1306).
  `movement_tiers` already reads tiers headless (`pob-api/API/Compile.lua`:1455–1474). No tool shows a tier's item
  level today: the lookup drops it before it replies (`pob-api/API/Lookup.lua`:1623–1624).
- **PoB's socket ceiling** (`socketLimit`: 3 on one-slot gear and one-handers, 4 on body armours and two-handers)
  equals the user's count plus 2 (Exceptional and corruption) on every armour and weapon base. Nine uniques carry a
  `Sockets:` line (`Data/Uniques/*.lua`) and two helmet variants a "Has 4 Augment Sockets" line; every other unique has
  its base's count.
- **An ascendancy jewel socket compiles** below the schema: the socket list holds 17788 (`toolSchemas.ts`:28–35), the
  compiler counts `containJewelSocket` nodes (`Compile.lua`:294–296) and slots the jewel before the tree import
  (:1615–1626), and PoB scales it by `SocketedJewelEffect` (`Modules/CalcSetup.lua`:1131–1137). Only `schema.ts`:575–578
  refuses it.
- **Node power has an internal exclude list** (`pick.exclude`, `NodePower.lua`:886, :939–945), used by `free` and the
  repair; the tool argument is a small change.
- **The boots rule holds** (D-440, `D1-build.md`:420–431): 30% movement speed on `m`, 35% on `b` and `n`, unless
  `items.bootsException`; V1's `movement-tier` checks it.
- **The run's revision mark is ordered** (`run-log.mjs`:233–239); this amendment stamps 14.

**Contracts this amendment touches:**

| Contract | Tag | Delta | Compatibility |
|---|---|---|---|
| C-31 plan file | modified | schema 10: a price entry's `listing` and `spec`; `tree.exclude`; `tree.search.targets` and `userMoves`; `rebuild: "none: <why>"`; `tree.end.endAfter`; `items.treeJewels` in an ascendancy socket; the plan's `itemSwaps` (§7, §9, §10, §16, §18; Appendix A) | schema 1–9 plans compile as before |
| C-33 record | modified (additive) | a no-area clear skill's `chains` and `projectiles` (§17) | `RECORD_VERSION` stays 2 |
| C-41 `compile_plan` | modified | read-back and adopt modes (§5), a notes mode (§13), a trade-links mode (§14), `final-build.xml` beside a final record (§5), `groupCount` on every counted group (§19); V1's `affix-cap`, `sockets` and `ascendancy-jewel` (§11, §18) | old calls unchanged; V1 may find more on old plans |
| C-17 build-file writes | modified | the ledger's `baseSha1` and `adopted`; the writer takes an adopted file's fingerprint (§5); `set_build_notes` refreshes a ledgered file's entry (§13) | additive |
| C-55 `get_node_power` | modified | `exclude`; the attribute repair; the attribute choice for added attribute nodes; a 0.5 tolerance on targets; rounded figures in its reasons (§16) | a call without `exclude` returns what it returns today, but for the attribute repair and choice (§16) |
| C-14 `find_upgrades` | modified | `link_only` (§9); each listing's required affixes' tiers; the fallback's prefix by cause (§20) | additive; the search link stays last |
| C-37 `lookup_game_data` | modified | a mod hit's tiers show their item level; the base mode's socket line; a generated unique's variants drop item-only skills (§11, §20) | wording changes on two lines |
| C-36 stage artifacts | modified (additive) | the design field's `summary`; `trades.json`'s `price`, `from`, `to` and kind `scaling`; `readback.json`, `notes.txt`, `trade-links.json`, `final-build.xml`; the run log's answer change, `ask` checkpoints, outcome `cancelled`, `skeletonFile`, `skeletonRemoved`, `withdrawn`, `scope`, request lines, the design checkpoint's `scaling`, D1-tree's `priceOutcomes`; `final-build-campaign.xml`; the D1 gate's `draft` and F1's `draftRemoved`; the task header's `scope` and `writes`; `skillRevision` 14 (Appendix A) | a run at revision 13 reads as before, but for the layout lists (§25) |
| C-35 data facts | modified (additive) | `data/items/sockets.json` and `data/items/item-only-skills.json`; the loader reads `data/items/` (§11, §20) | new files |
| C-52 cards | modified | "unconfirmed" with a fallback replaces "needs in-game testing"; "How it clears" says standing or walking (§15, §17) | old cards keep their words |
| C-53 pattern library | modified | the status word; the movement-penalty reducers (§15, §17) | within the 17,000 cap |

## 4. D-478: gate displays for players

The user's notes 1, 4 and 5, and the design-gate sample [GR]. In a revision-14 run (`run-log.mjs`'s displays; the
forms in Appendix A):
- **Brainstorm** (amends D-475): the script prints one header per composite or dealt card, `**1. Name** (Class,
  Ascendancy, Skill; under-played: yes|no)` and its `drawn from <host>` line, and still records the number-to-id map in
  `displays[].numbers`, so `pick:` stays checked. Under each header the runner writes the card's rotation, what makes it
  work and the catch, in plain words (the pitch rule, `checkpoints.md`'s brainstorm section, its 700–900-word target
  kept), naming the card's key pieces (its uniques, mechanic-changing supports and notables), its scheduled pieces, and
  in the catch any unconfirmed point with its fallback (§15): the user's "Move any key info from section one into
  section two". The script's key-piece lists, `scheduled:` lines, shared header and not-confirmed sentence leave the
  display (they stay in `cards.md`). The obvious build, the plain cards and a short round's reason stay, one line each,
  at the end.
- **Verification** (amends D-436's display): the same content, in markdown: `**<n>. <Name>**: <status>`, then one
  bullet per field with a bold label; the run-on tail becomes three bullets, **Risks**, **PoB can't verify** and
  **Stronger structure**; the card's skeleton file first (§5). No cuts.
- **Design**: the user's form [GR]: the PoB file's name first; then, for `b` and `n` in full and `m` in two lines
  (rung name, level, damage and EHP; the draft holds the rest):
  - **How it works**: up to three sentences, from the D1 gate's new `summary.how`;
  - a table of five rows: map damage (with "the same on 40%-resistance rares" or the resisting figure), pinnacle boss,
    toughness (EHP and the lowest max hit with its type), the Arbiter's hit, and speed (the clear word or a no-area
    clear skill's chains and projectiles, §17, the regular movement figure, and the travel skill or "no travel skill");
  - **Gear** by slot, from `summary.gear[]`: uniques by name, with a corruption, sockets or price where it matters;
    rares by base and key affixes (§15); a boots exception with its movement figure;
  - **Skills**: each group's skill and its supports, from the plan's `skills.groups`;
  - **The catch**: up to two sentences, from `summary.catch`, with any unconfirmed point and its fallback (§15);
  - **Over budget**: at most 3 lines a rung, measured finds first by gain and an unmeasured one marked "(estimate)", one per
    over-budget find (§12): "<from> was swapped for
    <to>; adding it back: +a% damage, −b% EHP, about N divines more"; the defence, avoidance and boss trades one line
    each in plain words;
  - **Options**: the runner's `not made:`, `jewel:` and `stronger structure:` lines, one each (`checkpoints.md`:380–386).
- Today's measurement lines (boss entries, Life, swap cap, rebuild, removed, skill levels, estimates, the verdict's
  parts) leave the display: `run-log.mjs display design --build <id> --detail` prints today's display on request, and
  the checker keeps holding the design field as today.
- **Final**: unchanged, but for its PoB file line coming first.
- **The design field** (D1-gate step 6) gains `summary {how, gear: [{stage, slot, text}], catch}`: `how` at most 400
  characters, each `gear` text at most 120, `catch` at most 300; written from the plan, the card and the record, rares
  by their affixes (§15). The checker fails a revision-14 design field without it or over a cap. The D1 gate that
  follows a swap (§7) rewrites the swapped slot's `gear` line and any sentence that names the old item.
- **Tests that pin today's displays** (about 15 files, among them `buildGuideScripts.test.ts`:659–685,
  `buildGuideAmendment12.test.ts`, `buildGuideAmendment13.test.ts`:196–290 and :585–588,
  `buildGuideAmendment13Design.test.ts`:108–119 and :334–383, which reads amendment 13's Appendix A) keep their
  revision-13 fixtures and assertions; revision 14 gets its own fixtures.

Amends D-475, D-436, D-442's display rows, `run-log.mjs`'s `compositeDisplay13`, `verifiedCardLines` and
`designDisplay` (:1688–1725, :1860–1884, :2304–2374), `checkpoints.md` (each gate's Show), `R1a-synthesize.md`:266–267
and `R1a-assemble.md` (the display's not-confirmed sentence), `D1-gate.md` step 6, `gates.md`'s design field,
`references/run-log.md`.

## 5. D-479: a PoB file at every gate, and reading the user's edits back

The user's note 6, and the answer "it should work at any gate".

**The skeleton file** (the verification gate).
- R1b's last act on a damage pass, after its whole-skeleton measure-only compile (`R1b.md`:266–268), is
  `compile_plan {plan_path: "<runFolderRel>/concepts/<id>/plan.json", draft_name: "<card name> skeleton"}`, which writes
  `<card name> skeleton (draft).xml` through the existing draft mode (no server change; the name differs from the
  build's later `<name> (draft).xml`, and the ledger records the concept's plan path). The call doesn't count toward
  R1b's two compiles (`R1b.md`:80, :300). R1b returns `skeleton: <relpath>`; the runner records it on the R1b stage
  entry as `skeletonFile`; the verification display prints it first under each card, marked "key pieces only; its
  numbers aren't the build's" (a skeleton has one stage, a tree of targets and paths, the key uniques and plain bases,
  and no flasks or anoint, `R1b.md`:181–190).
- `task-header.md`:60–64 and the coordinator's definition allow R1b this one draft write.
- **Cleanup**: when a picked card's build gets its first design draft, the runner removes its skeleton with
  `compile_plan {plan_path: "<runFolderRel>/concepts/<id>/plan.json", remove_draft: <skeletonFile>}` and records
  `skeletonRemoved` on the R1b entry. A skeleton the user changed and didn't have adopted isn't removed (D-466's rule;
  the server refuses it) and the display says so. Unpicked cards' skeletons stay: the user revisits cards.

**The draft and the final file.** The design display prints the draft first (§4). The D1 gate's verdict keeps
`draft: <relpath>` (reversing `D1-gate.md`:263's "its one home is the run log"); F1's verdict adds
`draftRemoved: <relpath> | null` beside `draftLeft`. The final gate prints the final file first. A final compile also
writes `final-build.xml`, a copy of the written bytes, beside its record (a campaign's final compile,
`final-build-campaign.xml`), so a final file can be read back.

**Reading back** (C-41; at the verification, design and final gates).
- **Who**: the runner, when the user says they edited the file (`SKILL.md`'s tool list gains the call).
- `compile_plan {plan_path, read_back: <relpath>}`, engine kind `none`. The base is the copy of what the server last
  wrote for that file: the `compiled-build.xml` beside the plan for a skeleton or a draft, `final-build.xml` (or the
  campaign copy) for a final file, used only while its sha1 equals the ledger entry's `baseSha1` (the sha1 of the bytes
  the server wrote, which nothing but a new write changes); otherwise the read-back is refused, "the file was written
  again since", and the runner tells the user which visit's file is current.
- The comparison, per loadout (PoB's item set, skill set and tree spec, matched by the titles the compiler wrote;
  an unmatched loadout is listed): items by slot (added, removed, each changed line), gems by group (added, removed,
  level, quality, enabled), tree nodes (added, removed, ascendancy nodes, jewels by socket, attribute choices), config
  (changed inputs, custom modifiers), each with its name, not only an id. The server writes `readback.json` beside the
  plan (Appendix A) and replies with a summary.
- **The runner** shows the changes in a player's words, naming which visit's file they were read against, and asks.
  On a yes: `compile_plan {plan_path, adopt: <relpath>}` adopts the file, and the changes go as the user's revision,
  the request's words being `readback.json`'s changes, verbatim, with the runner's restatement beside them (§8).
  Routing: one item changed → the one-item swap (§7); a tree change only → D1-tree; anything else → the full chain from
  D1-build. At the verification gate the changes join the picked card's design brief as user requests; at the final
  gate they go as a `revise:` there. On a no, nothing is adopted, and the edited file keeps D-466's protection.
- **Adopting** (C-17): the ledger entry's sha1 becomes the edited file's, `adopted: true` is set, and
  `buildFileWriter` records the edited file's fingerprint as its own (its in-process changed-on-disk guard,
  `buildFileWriter.ts`:8–13, :282–283, otherwise refuses the next write). The next draft or re-compile then replaces it
  (after the writer's backup) instead of forking to ` (draft 2)` or being refused, and a skeleton's cleanup removes it.
  `baseSha1` stays, so a second read-back of the same file works.
- **An edited item is taken literally**: the plan takes the user's lines as written, and its price is the depth price
  (§9) of a search for its lines at their values (the four heaviest by the slot's weights when it has more).

Amends D-466, D-436, D-211 (the ledger's `baseSha1` and adoption), C-41, C-17, `compiler.ts`'s draft and final paths,
`writeLedger.ts`, `buildFileWriter.ts`, `R1b.md`:80 and :300, `task-header.md`, the coordinator's definition,
`checkpoints.md`, `SKILL.md`:44–49 and :63–84 (the runner's tools, reads and Bash), `run-log.mjs` (`skeletonFile`,
`skeletonRemoved`, the verification display).

## 6. D-480: guide or file, asked outright; changing the answer after F1

- **The question.** On any accept at the design gate, the restatement asks "the endgame guide, or the PoB file
  only?" as its own question, unless the user's words named one; "accept" alone never maps to the guide. The late
  endgame scaling question rides beside it (§12). In a test config (`references/offline-and-test.md`:71–72),
  `accept` still means the guide, and a design answer may carry `scaling` (default `false`).
- **Changing it after F1.** A run-log entry `answer-change {checkpoint, visit, from: "accept", to: "accept:file",
  note: <the user's words>}` is legal after F1's pass and before W1's stage entry is recorded. A W1 already running is
  stopped and recorded with the new outcome `cancelled`, legal only for W1 after an answer change (`missing` keeps its
  meaning, "returned without its file, re-run once"). The build then takes the file-only route: the claims pass
  (D-477), the notes (§13). `render-audit.mjs --withdraw <id>` removes an `audit.md` F1's route rendered and a partial
  `guide.md` the cancelled W1 left (a file-only build holds neither), and logs a `withdrawn` entry.
- **The checker's flow** (`check-run.mjs`'s `checkFlow4`, :3623–4375; F1's routing at :4065) reads the changed answer.
- The reverse, file to guide, stays `guide:<id>` after a resume (D-477).

Amends D-362, D-411, D-413, D-477, `SKILL.md`:238–255, `checkpoints.md`:387–420, `offline-and-test.md`, `run-log.mjs`
(`ANSWERS4`, the entries), `check-run.mjs`, `render-audit.mjs`, `references/run-log.md`.

## 7. D-481: the one-item swap

The user's note 14. Today any gear change runs D1-build, D1-tree, D1-finish and the D1 gate (D-418,
`checkpoints.md`:403–405, `SKILL.md`:212–216), about 1.3M tokens on the Arc Lich.
- **A swap** is one slot's item, on one or more rungs, named by the user (a unique by name, a rare by the affixes the
  user names, or a read-back's changed item, §5), with no gem, tree or config change. Anything more runs the full
  chain.
- **The route** (the user's default): D1-finish with `scope: "swap"`, then the D1 gate; an exception to D-418's "every
  D1-build is followed by the tree step" (no D1-build runs). The restatement names the route and its cost before the
  yes ("a one-item swap: the finishing step and the design check, about 0.5M tokens"; visit 4's improvised route cost
  493K). At the final gate (a guide build's: a file-only build ends at its claims pass), a one-item revision runs D1-finish
  (`swap`), the D1 gate, F1, then W1's patch and the re-check, instead of the fix round's full chain (`fix-round.md`:
  29–34).
- **D1-finish's `swap` scope**:
  - it writes the item as the user gave it: a read-back's item exactly as edited; a unique as named; a rare whose
    affixes the user named, those affixes as its must-haves, with §9's loop only setting tiers the user didn't state
    and pricing it. Nothing the user didn't ask for is added (§8); a departure returns `request: <id> departs: <how>`;
  - it compiles measure-only, rewrites `tree.end` from its compile and marks it `endAfter: "swap"` (`tree.start` stays
    as written);
  - it re-measures its own trades on the swapped rungs (on temporary stages, as today, the plan then
    restored), so no trade is "measured on the earlier item"
    and `DEFENCE_REASON` stays strict;
  - it drops D1-tree's `boss` trades on the swapped rungs until the tree reruns (they were measured on the old item;
    gap 12b); D1-tree's `unmodelled` trades stay (they name pieces, not measures of the item);
  - it re-checks the claims that cite the slot or a figure that moved, re-prices the slot (writing a `scaling` find
    when its loop left a dearer spec), and records the swap in the plan's `itemSwaps[]`: `{stages, slot, from, to,
    bossBefore, bossAfter, reason}` (`from` and `to` by unique name or base and affixes); a boss figure that fell needs
    its `reason`.
- **The D1 gate** runs as today. When its tree part fails, the `tree-swap` route (D1-tree, D1-finish, gate) runs with
  §16's targets after gear moved.
- **The checker**, in a revision-14 build: the flows design-gate `revise` → D1-finish (`swap`) → D1-gate and final-gate
  `revise` → D1-finish (`swap`) → D1-gate → F1 → W1 → `V4-recheck` pass; for a rung whose `tree.end` reads
  `endAfter: "swap"`, the `itemSwaps[]` reason stands in for the boss trade a fall on the tree needs (`check-run.mjs`:6025)
  and for the damage or boss trade an `n` under the floor needs (:5743); a swap D1-finish without a `itemSwaps[]` entry
  fails.

Amends D-418, D-439 (D1-finish drops D1-tree's `boss` trades on a swap), D-448, D-468 (a boss fall's reason after a
swap), `checkpoints.md`:403–405, `SKILL.md`:212–216, `fix-round.md`:29–34, `D1-finish.md`:26–27 and :396–410,
`gates.md`, `check-run.mjs`.

## 8. D-482: the user's words stay literal; the fix round's briefs

The user's note 14 and the ruling that a revise goes to the step as the user said it.
- **Each user-request finding carries `words`**, the user's text verbatim (for a read-back, `readback.json`'s changes,
  §5). The runner adds no request of its own; a restatement rides beside the words, never in place of them. A
  condition stays a condition ("if it's not a crit build, it doesn't need the crit damage suffix" goes as written, not
  as "say what goes in that suffix instead"); no "may" or "where it earns" a step could widen.
- **Conditions added in the same message as a yes** are restated and confirmed again before the brief.
- **Each step that takes requests returns one line per request**, outside its 8-line return as D1-tree's `jewel:`
  lines are (`D1-tree.md`:344): `request: <id> made` or `request: <id> departs: <how>`. The runner stops at the first
  `departs`, or at an item, a price or a latitude the request didn't name, before the next step starts, and asks the
  user; the question and answer are logged as an `ask {kind: "departs", answer}` checkpoint.
- **The stage entry logs the requests' words** (`requests: [{id, words, result}]`); the checker fails a revision-14
  build whose logged words aren't in the checkpoint's answer, its note, or the read-back's `readback.json`.
- **The fix round's briefs** carry the V4 finding ids and the report path only, with no scope and no facts of the
  runner's (as fresh verifiers' briefs already do, `task-header.md`:54–56); the owner decides what to recompile.
- **An open finding after the one re-check** (a guide build's fix round, or a file-only build's claims pass, D-477)
  that needs a gear change: the runner asks the user at once (the user's default), logged as an `ask {kind:
  "open-finding", answer}` checkpoint: one more round, with its token cost, or ship with the issue in the PoB notes
  (§13). "One more round" is one more fix round and one more `V4-recheck`, at most once a build (an exception to "one
  re-check", `SKILL.md`:152–153, `fix-round.md`:68–69, `check-run.mjs`:3620, allowed only behind that checkpoint).
  Open findings are told at once after the last re-check, before the next build starts, written into the notes, and
  listed under `audit.md`'s known issues (`render-audit.mjs` reads them from the last V4 report).

Amends `task-header.md`:41 and :54–56, `checkpoints.md`:42–56, `D1-build.md`:32–34, `fix-round.md`, `SKILL.md`:95,
:100, :152–153 and :322–323, D-477 (open findings told at once, not at the run's end), `run-log.mjs`, `check-run.mjs`,
`render-audit.mjs`, the coordinator's definition.

## 9. D-483: items as specs: the must-haves, the tiers and the budget loop

The user's notes 7, 8 and 13, and the answers of 2026-11-02. For every rare gear slot and rare tree jewel of `b` and
`n` (D-372's scope); `m`'s rares are written as specs (must-haves at their tiers' lowest rolls) and priced by the depth
check alone, its other slots by `search_trade_items` with `mods` as today (`pricing.md`:78–79).

1. **Rank** (D1-build, after a measure-only compile with the slot's base and the rung's loadout selected, as D-372's
   procedure does): `find_upgrades {slot, link_only: true, sort_stats: <the weights>, weight_corrupted_mods: false}`
   sends no request and returns PoB's ranking of the affixes of the slot's item class, in PoB's order (the gain at the
   middle roll), each with its weight per point (the top 12), and the `?q=` link (§20). **The weights** are Full DPS 1
   and `TotalEHP` 0.5, plus the stats this build needs from PoB's list (Spirit for its reservations, mana regeneration
   for its sustain, an attribute for a requirement, movement speed on boots), each with a one-line reason.
2. **The base and its tiers**: PoB ranks per item class, so D1-build looks each ranked affix up (`lookup_game_data`'s
   mechanic mode, whose mod hits now show each tier's item level, §20) and drops what the base can't roll. The
   remaining tiers on the base at the rung's item level give each affix's best tier allowed, its floor and each tier's
   lowest roll. **PoB's top 4** are the first four in PoB's order that the base can roll.
3. **The must-haves**: 3 or 4, from the top of the ranking. The designer adds what PoB scores at zero but the build
   needs (an effect PoB doesn't model, a requirement, the boots' movement speed, D-440) and keeps prefixes and suffixes
   legal (at most 3 and 3; 2 and 2 on a rare jewel). A must-have outside PoB's top 4 carries a one-line `why`; each of
   PoB's top 4 left out carries one in `leftOut`. The checker holds both. **A must-have PoB scores at zero is always
   required and is never lowered or dropped for its importance** (D-372's "an affix PoB can't value is always required",
   kept).
4. **Importance** is the loss of one tier step, from PoB's measured gain per point: weight × (this tier's lowest roll −
   the next tier's lowest roll), with no extra compile.
5. **`n` first, at T1**: `n`'s must-haves start at their best tier allowed, and its first search is a depth check
   there: `search_trade_items {category or base, mods: <the must-haves at those tiers' lowest rolls>, corrupted: false,
   min_rune_sockets: <the base's standard count, §11>, limit: 10}`, sorted by price. With at least 10 found and the 5th cheapest within `n`'s target, that is `n`'s price
   (one trade search). When `b`'s must-haves are the same and that 5th cheapest is within `b`'s target too, `b` takes it.
6. **The budget search** (`b`, and `n` when its first check fails): `find_upgrades {slot, required_mods: <the 3 most
   important must-haves at their floor tiers' lowest rolls, a must-have PoB scores at zero always among them>,
   sort_stats: <the weights, which carry a 4th>, weight_corrupted_mods: false, include_non_upgrades: true, max_price:
   <the target, converted as D-373>, fetch_pages: 1, rune_behaviour: "remove", its rune-socket minimum at the base's standard count}` (one call,
   usually two trade searches).
   Its reply names each listing's must-have tiers (§20). The designer sets each must-have to the best tier at which at
   least 5 of the listings under the target meet all of them together: the best mix the budget buys.
7. **The depth check** at that mix (one trade search, as in step 5): at least 10 found and the 5th cheapest within the
   target prices the slot.
8. **Over the target or thin** (fewer than 10): lower the least important must-have one tier (never under its floor,
   never one PoB scores at zero) and check depth again; with every such must-have at its floor, drop the least important
   one and record "another source of <stat>: <where>" (another slot, the tree, a unique), which the designer takes or
   the gate shows. **At most 5 trade searches a slot**, the budget search counting as 2. Past the cap, or with nothing
   left to lower or drop, the designer moves the stat to another source (another slot, the tree, a unique); with none,
   the slot's entry is `unavailable`, `note` `thin: <count>`, and the gate shows it. No slot is priced from fewer than
   10 listings.
9. **The compiled rare** holds its must-haves at the tiers the loop ended at, each line at its tier's lowest roll (so
   every listing found meets the PoB file's figures), with its base's implicit lines and its runes in its sockets (§11),
   and nothing else. Its title is its key affixes (§15).
10. **The dearer spec** the loop started from (before a tier was lowered or an affix dropped) is the slot's over-budget
    find (§12) when it gains anything; the gate shows the largest 3 a rung (§4).

- **When the loop can't run.** Offline, or without the trade tools: no ranking (`ranking: null`); the designer picks
  the must-haves with their reasons, the checker skips the `why` and `leftOut` rules for that spec, and rares compile at
  their floor tiers' lowest rolls. With a pricing stop open: `link_only` (no request) stays allowed; no search runs;
  rares compile at the tiers the loop reached (else their floors) and their entries are `unavailable`, as today. With no
  session cookie (`find_upgrades` returns only its link): the loop runs as depth checks alone (`search_trade_items`
  searches anonymously), from the best tier down one step at a time within the cap. With `--no-ninja` (no rate, so no
  target becomes a `max_price`): no budget search; one depth check a spec, at its floor tiers on `b` and its best tiers
  allowed on `n`, recorded as seen, and the totals `unverified` (D-333; a gap WU-142 filled, folded at its merge). The
  final re-price pass
  (`pricing.md`:288–294) prices each spec as compiled, by a depth check, and never re-runs the loop.
- **D1-tree's rare jewels.** D1-tree writes a rare jewel's lines as must-haves at their best tier allowed (amending the
  middle and top rolls, `D1-tree.md`:206) and leaves its entry `not priced yet`; D1-finish ranks its lines (step 1, the jewel's socket as the slot) to order
  their importance (step 4), then runs steps 5 to 10 for it, an exception to "D1-finish never edits an item for its price": it may lower that jewel's tiers or drop an affix as the
  loop says, never add one, and re-measures as it does today.
- **Who**: D1-build, while it designs (D-444 already lets it price), so D1-tree measures in-budget items and its
  targets aren't stranded by a later gear change. D1-finish re-prices each spec as compiled on its day and records; it
  never rewrites an item to a listing. The runner can't brief a listing match (a doc rule; no checker heuristic, the
  user's default).
- **Random-roll uniques** (Morior Invictus): `search_trade_items {item_name, corrupted: <as the plan's copy>,
  min_rune_sockets: <the plan's count when above the unique's own>, mods: [<each line the figures rely on, at its
  range's midpoint>]}`, the same depth rule. PoB's default roll is the midpoint (`Modules/Main.lua`:105), so the plan's
  text and the query agree.
- **"Weapons by compile"** (`pricing.md`:179–183) compares specs, never listings; a listing's lines never enter a plan.
- **Pricing calls pass `rune_behaviour: "remove"`**: the default `copy` puts the plan's runes, and sockets up to the
  plan's count, on every listing (`Classes/ItemsTab.lua`:1761–1763).
- **Notes**: a price entry's `note` records the count and the price's position, never a listing's name; fit notes go.
- **The `-fallback` entries retire** in a revision-14 build: the dearer item is an over-budget find instead. Their
  readers keep them for older builds (`render-audit.mjs`:24–28 and :509–576, `run-log.mjs`:2460, `W1.md`:224,
  `audit-template.md`:23, `gates.md`:253 and :308).
- **Search volume**: a `b` slot usually takes 3 trade searches (the budget search's two and a depth check), an `n` slot
  usually 1, at most 5 a slot; about 20 to 35 a build, 15 to 26 minutes at the 45 s pace (D-461). The pricing notice
  counts them before the step starts.
- **Campaign gear** (D2 and `pricing.md`, the user): from about the second week of a league, low-level gear's price
  tracks the best tier its item level allows, not a levelling player's wealth; campaign rares use two or three affixes,
  and a late-league price for low-level gear is read as that, not as the league-start price the day conversion assumes.

Supersedes D-372's core (a rare priced by the weighted search's first listing; its "an affix PoB can't value is always
required" kept) and, for rares, D-371's "an over-target slot keeps its designed item; D1-finish may add a fallback".
Amends D-370 (targets unchanged), D-444, D-453 (D1-tree's jewel rolls), the 3-required limit (kept: the 4th rides in
the weights), `pricing.md` ("A rare of `b` or `n`", "Recording a price", the notice, "After pricing stops", "The final
re-price pass"), `D1-build.md`:365–369 and :401–437, `D1-tree.md`:206 and :224–233, `D1-finish.md`:100–152, `D2.md`,
`gates.md`'s budget part, `plan-reference.md`, `check-run.mjs`'s budget rules, the coordinator's definition (the
`link_only` call during a pricing stop).

## 10. D-484: what a price records; corrupted and socketed uniques

- **A price entry's `listing`** (schema 10, optional, left out of `buildSha1` like `note`, D-386): `{corrupted,
  sockets, count, position}` (the listing's corruption and rune sockets, the search's total, the price's place in it).
  A `b` or `n` rare's entry also holds its `spec` (Appendix A), likewise left out of `buildSha1`.
- **The priced copy matches the compiled copy**: the checker fails an entry whose `listing.corrupted` differs from
  the item's `Corrupted` line, or whose `listing.sockets` is fewer than the item's `Sockets:` count, except a cheap unique priced uncorrupted under
  the rule below (its `note` says so); a rare's searches ask for its base's standard sockets (§9), so its listing has them.
- **Uniques** are priced by name (`get_item_price`) unless their corruption or sockets matter; then by
  `search_trade_items` with `item_name`, `corrupted` and `min_rune_sockets` (`get_item_price` can't filter or show
  either, `src/handlers/tradeHandlers.ts`:387–396).
- **Corrupted uniques** (amends D-471, the user's rulings): a cheap unique (under 1 divine uncorrupted) may carry a
  corruption outcome, an implicit or an extra socket, priced uncorrupted, the guide telling the player to corrupt
  copies (the user's default for Alpha's Howl). A unique that isn't cheap may be bought corrupted with an extra socket,
  priced as that corrupted copy, when it is in budget; its corruption implicits never enter the standard rungs (one may
  be a late endgame scaling find, §12). A bare `Corrupted` line passes the checker (`check-run.mjs`:6093) only on a
  unique PoB's data marks always corrupted, a cheap unique under the rule, or one with the extra socket.
- **An over-budget alternative's price** lives in its `trades.json` entry (`price`, §12), counted in no total (the
  uncorrupted Morior's 509 divines had none), so the gate's one-liner cites a price.
- **Socket claims** cite the socket table (`data:items/sockets.json#<fact>`) or the unique's lookup; V1's `sockets`
  (§11) flags a count the item can't have.

Amends C-31, D-386 (two more fields out of the hash), D-471, `pricing.md`:80–85, `D1-finish.md`:100–152,
`check-run.mjs`:6064–6117 and the budget rules, `plan-reference.md`.

## 11. D-485: item lines checked against caps and sockets

V1 findings from `compile_check` (C-41), so D1-build's own compile catches them before D1-tree measures:
- **`affix-cap`**: each explicit line of a rare (not rune, enchant or implicit lines) against the best value its base
  can roll at the stage's item level (Names: 69 on `m`, 82 on `b` and `n`, a campaign stage's C1 area level), summed
  over the mod groups that write that stat, within 3 prefixes and 3 suffixes (2 and 2 on a rare jewel), counting
  desecrated and essence mods as the lookup does (`pob-api/API/Lookup.lua`:975–984). A unique's line outside its data
  range gets the same finding. A line no mod matches is a note, never a finding.
- **`sockets`**, against `data/items/sockets.json` (a C-35 fact file; Appendix A): body armours and two-handers 2;
  other armour, shields, foci and one-handers 1; Corona Amulet, Grasping Ring and Stalking Belt 1; other jewellery and
  belts 0; quivers 0 (the user's default); Exceptional +1 and corruption +1; its source a `judgment` tag citing the
  user's ruling of 2026-11-02. The loader reads `data/items/` (`src/plan/referenceData.ts`:27–28). A static test pins
  PoB's `socketLimit` − 2 to the table on every armour and weapon base. A unique's count is its data's `Sockets:` or
  "Has n Augment Sockets" line when it has one (nine `Sockets:` lines, and two "Has 4 Augment Sockets" helmet variants), else its base's count. The finding: more sockets than that
  count allows (a designed rare never counts the Exceptional +1 on the standard rungs, the user's default; a
  `Corrupted` unique counts +1), a rune line beyond the sockets, or runes on an item with no `Sockets:` line (which the
  compiler drops today, `Item.lua`:1642).
- **`lookup_game_data`'s base mode** prints the table's count, with PoB's ceiling named as such: `Sockets: 2 (PoB's
  ceiling 4 counts Exceptional and corruption)` (today `Sockets: up to 4`, `src/handlers/lookupHandlers.ts`:308), and
  `lookups.md`:78–82 says the same.

Amends C-41's V1 table (`src/plan/checks/v1.ts`:8–34), C-35's loader, C-37, D-277, `Compile.lua`'s `compile_check`,
`D1-build.md` step 6, `lookups.md`, `02-plan-compiler.md`'s V1 rows (at integration).

## 12. D-486: late endgame scaling

The user's note 2, and the answer taking the defaults.
- **The record**: `trades.json` kind `scaling`, with the fields every revision-14 trade has (`from`, `to`, `price`)
  and its own: `{stage, slot, damage, ehp, measured, repriced, by}` (`from` the dear item, `to` the kept one, by unique
  name or base and affixes; `damage` and `ehp` in percent; `price` `{amount, currency, count, date}`). D1-build writes
  a find when its loop or a choice leaves a dearer item out (§9, step 10), and D1-finish when its own loops do (D1-tree's
  jewels, a swap): a kind both write, each replacing only the entries it wrote (`by`; D-439 amended; the task header's
  `writes` gives both `trades.json` for it). D1-finish measures the finds on temporary stages, as today, at most 5 a
  build, the largest gains first.
- **The design gate** prints the largest 3 a rung under "Over budget" (§4).
- **The question**: at the design gate's accept, beside "guide or file" (§6): "late endgame scaling, yes or no?",
  logged on the checkpoint (`scaling: true | false`).
- **On yes**: after the accept and before F1, D1-finish with `scope: "scaling"` re-prices the finds by the depth rule
  (announced, paced, at most 15 trade searches a build) and measures any of the top 5 not yet measured, on temporary stages
  as today. It writes only `trades.json` (`price`, `repriced`, and for a find it measures, `damage`, `ehp` and
  `measured`) and restores the plan byte for byte, so F1's checks of the plan hold. Finds stay out of the rungs and their totals. Offline, the finds are listed unpriced.
- **The guide**: an H2, "Late endgame scaling", after "Endgame: non-budget", about 150 words inside the word cap, up to
  5 finds, one line each with its gain and price; a dear unique's corruption implicit may appear here (the corruption
  ruling). In the full guide (the campaign's) it sits at the same place. A guide without scaling has no such H2; the
  checker allows it only when the answer was yes, through its own constant `SCALING_H2` (`ENDGAME_GUIDE_H2` and
  `GUIDE_H2` keep their 12 and 14).
- **The PoB notes** carry the same lines (§13).

Amends D-371 (a dearer item is a find, not a fallback), D-439, the guide templates' H2 lists
(`templates/guide-endgame-template.md`:9–13, `guide-template.md`; `check-run.mjs`:182–216;
`tests/static/buildGuideEndgameGuide.test.ts`:85–129), `task-header.md`:46, `checkpoints.md`, `D1-build.md`,
`D1-finish.md`, `W1.md`, `offline-and-test.md`.

## 13. D-487: PoB notes

The user's note 3. Nothing writes `<Notes>` today, and `set_build_notes` bypasses the write ledger, so a later
re-compile or `remove_draft` is refused (RP §3). F1 writes the final file before W1 writes the guide and before a
file-only build's claims pass, so notes can't come from a plan field at compile time.
- **The writer** (C-41): `compile_plan {plan_path, notes_path}`, engine kind `none`: it replaces `<Notes>` in the
  final file of the build's latest final compile (the record's `pobFile.path`) with the text of `notes_path`
  (`<buildFolder>/notes.txt`), escaped, through `buildFileWriter`, and updates the ledger entry's sha1 and the
  writer's fingerprint (not its `baseSha1`: a read-back compares no notes), as the draft mode does. It is refused when the file changed on disk since the ledger's write
  (D-211); the runner then tells the user and leaves it.
- **Who and when**: the runner. A guide build: after step 14 writes the guide's known issues (`SKILL.md`:293–294), on
  every cycle, a revision's included. A file-only build: after its claims pass, or its re-check when one runs,
  whichever is last. After the campaign's guide is final (its known issues written), the campaign file gets the full guide's notes; the endgame file
  keeps its own.
- **What**: a guide build's `notes.txt` is `guide.md` rendered to plain text by a new script, `render-notes.mjs`:
  headings as coloured lines (`^x` codes), tables as "slot: affixes" lines, each trade link on its own line from
  `trade-links.json` (§14), no import-code block. A file-only build's `notes.txt` is written by W1 with
  `scope: "notes"`: how to play; when to switch (each rung's stage level, with gear from the record's `requirements.level`, the gem and
  ascendancy order from the claims); the late endgame scaling lines if taken (§12); the trade links (§14); the open
  findings (§8). Its statements come from the plan, the claims the claims pass judged and the card's pitch; no V4 pass
  reads them (§28).
- **The guide's import code** stays the record's code, without notes (a code holding the guide would be circular).
- **`set_build_notes`** refreshes the ledger entry when it writes a ledgered file (C-17, a defect fix); the pipeline
  doesn't call it.

Amends C-41, C-17, D-211, D-413 ("F1 is the only write of the final file": the notes write is a second, ledgered
write), `SKILL.md` (the runner's tools and Bash), `W1.md`, `task-header.md`:46 (W1's `writes`), the writer's
definition, `references/run-folder.md`.

## 14. D-488: weighted trade links

The user's note 15 and their test (2026-11-02): the link works pasted into a browser.
- **F1's second call**, after the final write: `compile_plan {plan_path, trade_links: true}` (engine kind `load`, its
  own request, so the final compile's time bound, NFR-20, is unchanged) writes `trade-links.json` beside the record:
  per rare gear slot and rare tree jewel of `b` and `n`, `{stage, slot, url, ids}`, built headless by PoB's generator with
  no request (`pob-api/API/Trade.lua`:378–517): the spec's weights (PoB's defaults when it has none), its 3 most
  important must-haves required (one PoB scores at zero first), corrupted mods unweighted (`includeCorrupted: false`),
  a `misc_filters.corrupted: false` filter (rares are never corrupted), the maximum level the rung's, the rune-socket
  minimum the base's count from the socket table, PoB's own minimum weight (half the compiled item's score), the
  prefit's complexity budget (`src/trade/prefit.ts`:19–21, :126), the plan's league; the URL
  `tradeQueryUrl(league, query)` (`src/trade/links.ts`:23–26). A stat id missing from the server's cached `/data/stats`
  is dropped; with no cache, the entry says `ids unchecked`. About 30 to 55 s of engine time a build. An offline run
  with no league gets none.
- **The guide** prints them under each rung's gear, one per line in a fenced block labelled by slot, outside the word
  cap, with "copy the whole line into your browser" once (the user: ctrl-click from a terminal was unreliable). This
  reverses `W1.md`:296–297 for these links.
- **The PoB notes** carry the same lines (§13).

Amends C-41, D-276's trade-link question (HG-22: settled by the user's answer on item 18), `W1.md`, the guide
templates, `F1.md`, the coordinator's definition (F1's second call).

## 15. D-489: "unconfirmed", and rares by their affixes

The user's notes 10 and 12.
- **"Unconfirmed (<what>; if it fails: <the fallback and its cost>)"** replaces the status word "needs in-game
  testing" everywhere: `templates/card-template.md`:17–25, `checkpoints.md`:40–41, `Q.md`:29–30, `patterns.md`:85,
  :927 and :973. Tests pin today's word: `buildGuidePipeline.test.ts`:1829 and :3508, `patternLibraryEngine.test.ts`:
  545. The revision-14 brainstorm display stops printing `run-log.mjs`'s `NOT_CONFIRMED` sentence (:1545), which older
  displays keep.
- **No advice to test in game**: W1, the gate rules and the agents' definitions say so; the checker flags "test … in
  game", "in-game test" and "needs in-game testing" in a revision-14 build's `guide.md`, `notes.txt` and plan claims.
- **Every unconfirmed hinge claim states its fallback**; V4 checks it.
- **A piece left out unmeasured reaches the user**: an ascendancy notable, or a piece PoB can't measure, that the
  design leaves out gets an `unmodelled` trade line naming it and its estimate: D1-build marks it out unmeasured in `pieces.md`
  with its estimate, and D1-tree writes the line (Crystalline Phylactery went out untold).
- **Rares by their affixes**: D1-build titles each rare by its key affixes ("+2 spell levels, Spirit, chaos
  resistance"); PoB shows "<title>, <base>" (`Classes/Item.lua`:1040–1041). User-facing text (the design field, trades,
  gate answers, the guide, the notes) names a rare by its base and key affixes. The checker fails a revision-14 plan's
  rare whose title has a comma-separated part matching none of its explicit lines (a generated name).

Amends C-52, C-53, D-442 (out pieces named), `card-template.md`, `checkpoints.md`, `Q.md`, `patterns.md`,
`run-log.mjs`, `check-run.mjs`, `W1.md`, `V4.md`, `D1-build.md`, the agents' definitions.

## 16. D-490: the tree search's exclude list, attribute repair and targets after gear moved

The review's tree findings [RD §3]: the rebuild with repair never worked unaided.
- **`exclude`** (C-55): `get_node_power {…, exclude: [node ids]}`: no swap, rebuild, repair or `free` refill adds an
  excluded node or paths through one (the refill's internal list, `NodePower.lua`:886, :939–945); an excluded node
  already allocated refuses the call, naming it.
- **The plan's `tree.exclude`** (schema 10): `stages[].tree.exclude: [{nodes, reason}]`, written by D1-build from its
  "out" decisions (Mind Over Matter on a build that leaves it out for mana; a node whose cost PoB drops, PG-104), a
  reason required; D1-tree may add an entry, with its reason shown in the audit; D1-tree and the D1 gate's judge pass
  the rung's list.
- **The attribute repair** (C-55): after a refill (a rebuild's or a swap's) and the toughness repair, when PoB's
  `Str`, `Dex` or `Int` falls under `ReqStr`, `ReqDex` or `ReqInt` (requirements come only from items and gems,
  `Modules/CalcSetup.lua`:1165): (1) re-point the move's added attribute nodes to the short attribute (no points, one
  measure); (2) add attribute nodes, ⌈shortfall/5⌉ points, freeing the weakest damage-per-point branches, each step one
  swap and one measure, as a toughness step is. The reply names each step. A shortfall it can't close leaves the move
  illegal in today's form (`NodePower.lua`:1159–1170: "<Attribute> would be <x>, under the <y> its gear and gems
  need"), with " after repair" added. The cause: the rebuild frees every attribute node outside the protected ones and
  refills only nodes that gain damage, so freed attribute nodes never come back; amendment 13 relied on the attribute
  guard, which only refuses a move; its regression fixture (a Strength Warrior) hid it.
- **The attribute choice**: an added attribute node takes the attribute with the largest shortfall under the result's
  requirements, else the class's main attribute (Strength today, `NodePower.lua`:1039–1049).
- **No attribute needs in `keep`** (D-467 stands).
- **No hand edits**: a rebuild the tool calls illegal is recorded `rebuild: "none: <the tool's reason>"`, a value the
  checker accepts beside `taken`, `none` and `undone: <why>` (`check-run.mjs`:5974).
- **Targets**: a figure within 0.5 of its target meets it; D1-tree writes `tree.start` unrounded. The reasons' figures
  are rounded to at most 2 decimals (`NodePower.lua`:1764).
- **The user's own tree moves** count in `tree.search.userMoves`, not `tree.search.swaps`.
- **Targets after gear moved**: when gear changed after D1-tree (a swap, a revision, D1-finish), a tree retry's
  targets, and the gate judge's, are per figure the lower of `tree.start` and the rung's current compile (as node power
  already does for the other weapon set's pool, `NodePower.lua`:2012–2016); `tree.start` stays as written; D1-tree
  records the targets it used in `tree.search.targets {ehp, maxHit, why}`.
- **A boss fall from a gear change after D1-tree**: D1-finish writes `boss-fall-<rung>` when the final boss figure is
  more than 2% under `tree.end`'s, naming the item (after a swap, §7's record).
- **D1-tree makes no trade calls**: its card and the runner's brief say so (the "how to price" line goes to pricing
  steps only); a D1-tree stage entry may carry `priceOutcomes` (`run-log.mjs`:221, :415–416 refuse it today) so the
  calls are logged, and the checker fails any non-zero count.
- **A schema-10 field goes only into a schema-10 plan**: a step that would write one (`tree.search.targets`,
  `userMoves`, `listing`) into a schema-9 plan runs D1-build first, as §25 says for swaps.

Amends C-55, D-467, D-468, `NodePower.lua`, `D1-tree.md` ("The arguments", :55–83; :158–170), `D1-build.md`:345–347,
`D1-gate.md`:139–150, `gates.md`:124–136, `run-log.mjs`, `check-run.mjs`.

## 17. D-491: movement speed and the clear label

The user's question on the casting slow (item 5) and the answer: "The agent should use the regular movement speed in
its messages."
- **Messages state PoB's regular movement figure** (`EffectiveMovementSpeedMod`, as the record has it,
  `Modules/CalcDefence.lua`:1909); a skill's use penalty is never folded in.
- **Cards stop pitching "hold it as you walk"**: the card template's "How it clears" (`card-template.md`:53–54) says
  whether the clear skill is cast standing or walking and how many casts a pack takes; a pattern entry names the
  penalty's reducers ("reduced movement speed penalty from using skills while moving", `Modules/ModParser.lua`:
  6099–6102).
- **No change** to the clear band (`clearSpeedOf`, D-407's rough label) or node power's pace exchange.
- **A clear skill with no area** (Coiling Bolts): the record's `clearSpeed` gains `chains` (PoB's `ChainMax`) and
  `projectiles` (`ProjectileCount`) when the clear skill has no radius (both added to `MEASURE_FIELDS`,
  `src/plan/compiler.ts`:1120–1127); `run-log.mjs`'s `clearPhrase` (:1432–1438) reads "no area: chains N, projectiles
  M" for it; the card's estimate leads.
- **The boots rule stays** (D-440); a boots exception shows in the design gate's gear line with its movement figure.

Amends D-407 (the no-area label), C-33, C-52, C-53, `record.ts`'s `clearSpeedOf` (:737–768), `run-log.mjs`,
`card-template.md`, `patterns.md`.

## 18. D-492: ascendancy jewel sockets and Crystalline Phylactery

The user's note 11.
- **Schema 10**: `stages[].items.treeJewels` may name a node in `tree.ascendancyNodes` whose node has
  `containJewelSocket` (`schema.ts`:575–578 is the only refusal today); any other ascendancy node errs at its path.
- **V1 `ascendancy-jewel`**: a base other than a basic jewel (Ruby, Emerald, Sapphire) in a socket whose node allows
  only a "non-Unique Basic Jewel" (PoB parses that line to nothing [RP §2]). A unique, or a jewel with a subtype, never
  reaches V1: PoB refuses it in that socket (`Classes/ItemsTab.lua`:2289–2294), so the compile's check reports it as a
  defect naming D-492 and nothing compiles (folded at WU-137's merge).
- **The bridge corrects PoB's reading of the current wording** (the user's default): PoB's tree at the pin says "100%
  increased Effect of bonuses gained from Socketed Jewel" (`TreeData/0_5/tree.lua`:52976), which PoB parses only partly
  (`Data/ModCache.lua`:1356; `Modules/ModParser.lua`:895–897 maps the older "Effect of the Socketed Jewel"), so the
  line adds nothing. After the tree loads (inside `pob-api/bootstrap.lua`'s `dofile('HeadlessWrapper.lua')`,
  `Modules/Main.lua`:142), the bridge sets that line's entry in `modLib.parseModCache` (`Modules/ModTools.lua`:48;
  keyed by the exact line, `ModParser.lua`:7307–7324) to `SocketedJewelEffect INC 100` and re-processes node 17788's
  stats and each of its switch copies (`options[*]`, the Abyssal Lich's among them, `PassiveTree.lua`:423, :546–567;
  `PassiveSpec.lua`:1438–1442). No file in `vendor/` changes. The fix lives in one bridge file,
  `pob-api/API/ParseFixes.lua`, each entry naming its PG id (PG-103); an engine test asserts that PoB's own parse of
  the line still leaves a remainder (so a pin upgrade that parses it fails the test, and the entry goes), and
  CLAUDE.md's pin-upgrade steps name the file. It is the first time the bridge corrects PoB's parse; it changes the
  figures of any build that takes the node with a jewel in it.
- **D1-build values it** by a socket test on the ascendancy: a jewel measured in 17788 on a temporary stage against
  the notable it displaces.
- **Node power** still doesn't rank or swap ascendancy notables (C-55 by design, `amendment-9-endgame-first.md`:400,
  :409–412).
- **Left out unmeasured**, an ascendancy notable reaches the user as an `unmodelled` trade line (§15).

Amends C-31, C-41 (V1), C-6's pin-upgrade procedure (a step), `D1-build.md`'s ascendancy choice, `pob-gaps.md`.

## 19. D-493: a counted group's count

The M-26 build's finding (R-64). The compile sets PoB's `groupCount` only on the named source's group
(`compiler.ts`:1063–1066), so node power's `pool_groups` ranks a group counted above 1 at PoB's count of 1.
- **Every group with a plan `count`** gets `groupCount` in every stage and both compile modes; `includeInFullDPS`
  stays on the named source only (Full DPS and the record don't move: the record applies Count itself,
  `record.ts`:189–213).
- **What moves**: Spirit reservation × count on skills with `SkillType.MultipleReservation` (eight skeleton summons
  and Summon Spectre at the pin) and totems under Ancestral Bond (`Modules/CalcDefence.lua`:284–288), so V1's Spirit
  warning may fire on a plan that passed before (correct: the named group already reserves × count); Umbral Well's
  per-minion buff (`CalcPerform.lua`:1318–1330); node power's `MainDamage` for a counted group that isn't the named
  source. Finished runs aren't re-checked.
- **AC-K76's original bullet** is restored: a pool gain under `pool_groups` within 1 point of the record's, at the
  plan's count.

Amends D-293's file clause ("on the named source's groups only", settled by the user 2026-10-10; a default the user took,
§28), D-337, C-41, AC-K76, `D1-build.md`'s Count text.

## 20. D-494: the smaller fixes

- **A percent against its fraction**: the checker's ledger rule accepts the ledger value × 100 as well as an input ×
  100 (`check-run.mjs`:2028–2055), and `D1-finish.md`:276–278 says so (today it allows only an input × 100). Five true
  claims failed on it [RD §9.2].
- **The toughness sentence**: a warning kind `under`, for an EHP under its band in every condition, with its own
  guide wording; `conditioned` fires only when the plain EHP is within or over its band (`check-run.mjs`:5932,
  `D1-gate.md`:241–243, `guide-endgame-template.md`:200). Amends D-449.
- **Level labels**: the guide names one level per rung, the plan's stage level, with "gear from level <the record's
  `requirements.level`>" once; triggers are named by that level; the checker holds it (`W1.md`:115, :201–203).
- **The fallback's cause** (C-14): `find_upgrades`' fallback reply (`renderUpgrades.ts`:59–61) carries its cause:
  `[trade:no_session]`, `[trade:session_rejected]` or `[trade:too_complex]` (`findUpgrades.ts`:913–918). Pricing reads
  the first two as a session problem for the step (the rest is priced by depth checks, which search anonymously, and
  the runner tells the user at once) and the third as a cue to drop the least important must-have. An item is
  `unavailable` only after its own failed call.
- **`find_upgrades {link_only: true}`** (C-14): no request; PoB's ranking (the top 12, in PoB's order, each with its
  gain at the middle roll and its weight per point) and the `?q=` link (§9).
- **Listing tiers** (C-14): each listing in a `find_upgrades` reply names its required affixes' tiers, read from each
  affix line's `mods[].tier` (one line may merge several mods; each is named), through `src/trade/modLines.ts`.
- **The lookup's tiers** (C-37): `lookup_game_data`'s mechanic-mode mod hits show each tier's item level and range
  (`pob-api/API/Lookup.lua`:1483–1499, :1623, which drop `level` today).
- **Generated unique variants** (C-37): a lookup of a generated unique's variants (Prism of Belief) drops the skills
  listed in `data/items/item-only-skills.json` (a C-35 fact file: skills only items grant, the first Coiling Bolts, the
  user's ruling that Prism of Belief rolls only gem skills). A skill some unique grants that is also a gem (Spark,
  Herald of Ash) stays. PoB's generator already leaves out a skill its data marks `fromItem` (Volatile Dead,
  `Data/Skills/act_int.lua`:22337; `Data/Uniques/Special/Generated.lua`:85), though the game has its gem (folded at
  WU-139's merge). PG-105.

Amends C-14, C-37, D-449, D-365, `check-run.mjs`, `D1-finish.md`:276–278, `pricing.md`'s outcome table (:207–225),
`renderUpgrades.ts`, `findUpgrades.ts`, `Lookup.lua`, `lookupHandlers.ts`.

## 21. D-495: the PoB gaps, and the fold

- **`docs/build-guide/pob-gaps.md`** gains a section "Found in amendment 14 (2026-11-02)": PG-103, Crystalline
  Phylactery's current wording is parsed only partly (corrected in our bridge, §18); PG-104, Event Horizon's cost line
  "Lose 3% of maximum Life and Energy Shield when you use a Chaos Skill" is parsed partly and dropped
  (`Data/ModCache.lua`:6137) while its chaos damage counts (handled by the exclude list or a custom modifier with its
  reason); PG-105, Prism of Belief's generated list holds skills only items grant
  (`Data/Uniques/Special/Generated.lua`:78–104; filtered in the lookup, §20). Each in the file's skeleton.
- **At integration** the coordinator writes V1's new rows (`affix-cap`, `sockets`, `ascendancy-jewel`) into
  `02-plan-compiler.md`, HG-32 to HG-36 into the spine's §6.3 (written with this amendment), the HG-12 grant (written
  at approval), HG-22 marked settled (§14), D-293's note and C-53's.

## 22. Costs

Baseline: the open-spell run (amendment 13's pipeline). Estimated changes, for a run with two builds:
- **Displays**: the design gate about −2,500 words a visit (about −3.5K tokens in the runner's context each visit);
  the brainstorm gate about −1,000 words; verification unchanged in length.
- **Skeleton files and read-backs**: no engine time (copies and comparisons); one tool call a card, two a read-back
  (the read and the adoption), and the runner's restatement.
- **The spec loop** (§9): D1-build gains a ranking call and a few lookups a rare slot (2.3–4.5 s of engine time for the
  ranking); a `b` slot usually takes 3 trade searches, an `n` slot 1, at most 5 a slot: about 20 to 35 trade searches a
  build, 15 to 26 minutes at the 45 s pace, against the open-spell run's 1 to 3 a slot in D1-finish. About +50K to
  +100K output tokens a build in D1-build; D1-finish's pricing shrinks to the depth re-check.
- **A one-item swap**: about 0.5M tokens against about 1.3M for the full chain.
- **Late endgame scaling**, when asked: up to 15 trade searches and about +60K to +120K tokens a build.
- **Notes**: a file-only build's notes from W1's `notes` scope, about +30K to +60K tokens; a guide build's by script,
  no tokens; one tool call a write.
- **Links**: F1's second call, about 30 to 55 s of engine time a build; no tokens beyond the call.
- **The attribute repair**: a few more measures a rebuild (engine time inside node power's 120 s long action).

About +150K to +300K output tokens on a two-build run, less any one-item swap's saving. D-349's cap (spine) is already
exceeded by today's runs; the user weighs the cost at approval.

## 23. Work units (M-27)

| Unit | What | touches |
|---|---|---|
| WU-136 | Node power: first the fixtures (HG-33, granted: the open-spell run's plans r1-s-4 and r1-s-2, copied unchanged); `exclude`, the attribute repair and its illegal form, the attribute choice, the 0.5 tolerance, rounded reasons (§16) | `pob-api/API/NodePower.lua`; `src/engine/schemas.ts` (the `node_power` request and reply only); `src/handlers/treeHandlers.ts` (node power's functions only); `src/server/toolSchemas.ts` (`get_node_power`); the README table; `tests/fixtures/plans/m27-wu136/` and `tests/fixtures/plans/open-spell/` (HG-33); `tests/fixtures/tool-calls.json`; `tests/integration/nodePower*.test.ts` (in `nodePowerTitanRake.test.ts`, all but the `pool_groups` block) |
| WU-137 | Plan schema 10, the compiler and V1: the schema's additions (Appendix A); `groupCount` on every counted group (§19); V1's `affix-cap`, `sockets` and `ascendancy-jewel` (§11, §18); `data/items/sockets.json` and the loader's `items` folder; the record's `chains` and `projectiles` (§17); the plan reference | `src/plan/schema.ts`, `src/plan/buildHash.ts`, `src/plan/referenceData.ts` (`DATA_FOLDERS`), `src/plan/compiler.ts` (`stageParams`, the group writer and `MEASURE_FIELDS` only), `src/plan/record.ts` (`clearSpeedOf` and its type only), `src/plan/checks/v1.ts`, `pob-api/API/Compile.lua` (`compile_check`'s checks and the group writer), `src/engine/schemas.ts` (the compile reply's `checks`), `data/items/sockets.json`, `docs/build-guide/plan-reference.md`, `tests/fixtures/plans/m27-wu137/`; `tests/unit/planSchema*.test.ts`, `tests/unit/v1*.test.ts`, `tests/static/planReference.test.ts`, `tests/static/referenceData.test.ts`, `tests/integration/compileCount.test.ts`, the `pool_groups` block of `tests/integration/nodePowerTitanRake.test.ts`, `tests/unit/planPace.test.ts`, new `tests/integration/compileSchema10*.test.ts` and `tests/static/socketTable.test.ts` |
| WU-138 | Server tools: `compile_plan`'s read-back, adopt, notes and trade-links modes, `final-build.xml` (§5, §13, §14); the ledger's `baseSha1` and `adopted`, the writer's adoption; `find_upgrades`' `link_only`, listing tiers and the fallback's causes (§20); `set_build_notes`' ledger refresh (§13) | `src/handlers/planHandlers.ts`, `src/plan/compiler.ts` (the modes and the final path only), `src/plan/writeLedger.ts`, `src/services/buildFileWriter.ts`, `src/handlers/buildHandlers.ts` (`set_build_notes` only), `src/trade/findUpgrades.ts`, `src/trade/renderUpgrades.ts`, `src/trade/rankUpgrades.ts` (the listing lines), `src/trade/modLines.ts` (reused), `pob-api/API/Trade.lua` (the links' query settings), `src/server/toolRouter.ts` (the modes' engine kinds), `src/server/toolSchemas.ts` (`compile_plan`, `find_upgrades`, each description within 2,048 characters: about 250 more each), `src/engine/schemas.ts` (the links reply), the README table, `tests/fixtures/plans/m27-wu138/`; `tests/integration/compilePlan*.test.ts`, `tests/unit/writeLedger*.test.ts`, `tests/unit/buildFileWriter*.test.ts`, the `buildFiles` tests, `tests/mcp/findUpgrades*.test.ts`, `tests/unit/findUpgrades*.test.ts`, `tests/static/buildGuideTravelSkills.test.ts` (the description cap), new `tests/integration/compileReadBack.test.ts`, `compileNotes.test.ts` and `compileTradeLinks.test.ts` |
| WU-139 | Game data: the bridge's parse fix (§18); the lookup's tier levels, base socket line and generated-variant filter with `data/items/item-only-skills.json` (§11, §20); PG-103 to PG-105 (§21); CLAUDE.md's pin-upgrade step | new `pob-api/API/ParseFixes.lua`, `pob-api/bootstrap.lua` (loading it), `pob-api/API/Lookup.lua` (mod hits' levels and generated variants only), `src/handlers/lookupHandlers.ts` (the base mode's socket line and the variant filter only), `data/items/item-only-skills.json`, `docs/build-guide/pob-gaps.md`, `CLAUDE.md` (the pin-upgrade list only), `tests/fixtures/plans/m27-wu139/`; new `tests/integration/parseFixes.test.ts`, the lookup tests for uniques, bases and mechanics |
| WU-140 | Scripts: the revision-14 displays and `--detail`, the no-area label (§4, §17); the layout lists, for every revision (§25); `skeletonFile`, `skeletonRemoved`, the answer change, `withdrawn`, `cancelled`, `ask` checkpoints, `scope`, request words, the scaling answer and D1-tree's `priceOutcomes` in the run log; the checker's new flows (swap, answer change, notes, scaling, the extra round) and rules (§4–§16, §20); `SCALING_H2`; the `-fallback` readers held to their revision; `render-audit.mjs`'s `--withdraw` and known issues (§6, §8); the new `render-notes.mjs` (§13); `trades.json`'s additions; `skillRevision` 14 and the per-build boundary for every new rule | `scripts/run-log.mjs`, `scripts/check-run.mjs`, `scripts/render-audit.mjs`, new `scripts/render-notes.mjs` (all under the skill), `references/run-log.md`, `references/run-folder.md`, `tests/fixtures/pipeline/`, `tests/unit/buildGuide*.test.ts` (the script-side assertions) |
| WU-141 | Research docs and the library: R1b's skeleton file and its compile count (§5); "unconfirmed" in the card template, Q and the library, "How it clears" (§15, §17); the penalty reducers' entry; R1a-synthesize's and R1a-assemble's display sentence (§4); the researcher's definition | `references/stages/R1b.md`, `Q.md`, `R1a-synthesize.md`, `R1a-assemble.md`, `templates/card-template.md`, `references/patterns.md`, `.claude/agents/build-guide/build-guide-researcher.md`; their `describe` blocks in `buildGuidePipeline.test.ts`, `patternLibraryEngine.test.ts`, `buildGuideAmendment11Research.test.ts`, `buildGuideSynthesis.test.ts` |
| WU-142 | Design and pricing docs: D1-build (the spec loop, weights, must-haves, tiers by lookup, titles, `tree.exclude`, the ascendancy socket test, out pieces with estimates, scaling finds, request lines, the Count note), D1-tree (§16, the jewels' tiers, the `unmodelled` lines for out pieces), D1-finish (the `swap` and `scaling` scopes, the jewels' loop, re-pricing, probes, the boss fall after gear moved, trades' `price`, `from`, `to`), D1-gate (the `summary`, the draft in the verdict, the judge's `exclude` and targets), D2 (the campaign note), `pricing.md` (§9, §10, §20: the loop, when it can't run, the fallback's causes, the notice's count, the re-price pass, the campaign note), `gates.md`, `lookups.md` | `references/stages/D1-build.md`, `D1-tree.md`, `D1-finish.md`, `D1-gate.md`, `D2.md`; `references/pricing.md`, `gates.md`, `lookups.md`; their `describe` blocks in `buildGuideAmendment12Design.test.ts`, `buildGuideAmendment13Design.test.ts`, `buildGuideD1Tree.test.ts`, `buildGuidePipeline.test.ts`, `buildGuideDesignPieces.test.ts` |
| WU-143 | Gate, route and guide docs: `SKILL.md` (the routes; the runner's tools, reads and Bash; the scripts' writes), `checkpoints.md` (each gate's form, the two accept questions, the user's words and request lines, the `ask` checkpoints, open findings told at once, "unconfirmed"), `task-header.md` (`scope`, `writes`, words, request lines, fix-round briefs), `fix-round.md` (the extra round, the final-gate swap), `offline-and-test.md`, F1 (`draftRemoved`, the links call), W1 (the `notes` scope, the scaling H2, the link block, one level a rung, no test advice, the `under` wording), V4 (the fallback check), the templates, the coordinator's, writer's and verifier's definitions | `SKILL.md`; `references/checkpoints.md`, `task-header.md`, `fix-round.md`, `offline-and-test.md`; `references/stages/F1.md`, `W1.md`, `V4.md`; `templates/guide-endgame-template.md`, `guide-template.md`, `audit-template.md`; `.claude/agents/build-guide/build-guide-coordinator.md`, `build-guide-writer.md`, `build-guide-verifier.md`; their `describe` blocks in `buildGuidePipeline.test.ts`, `buildGuideEndgameGuide.test.ts`, `buildGuideAmendment11Design.test.ts`, `buildGuideAmendment12Design.test.ts` (every `SKILL.md` line-count pin) |
| WU-144 | The live test, the user's, with the coordinator, after M-27 is built | the work-log |

**Spikes first**, each its unit's first step, recorded in the work-log: the fixtures and a timing of the attribute
repair on the attribute-tight fixture (WU-136); a compile of 17788 holding a jewel under schema 10 (WU-137); the links
mode on a fixture, its time and the longest link (WU-138); the parse fix's effect on a jewel in 17788, for a Lich and an
Abyssal Lich, and PoB's unfixed parse (WU-139). A spike that fails stops its unit, and the coordinator reports to the
user; the units that wait on it wait.

**Order.**
- **Wave 1:** WU-136, WU-137, WU-138 and WU-139 in parallel, the formats fixed by Appendix A. Merge order: WU-136, then
  WU-137, then WU-138 and WU-139 (each rebases).
- **Wave 2:** WU-140 (it can start in wave 1 against Appendix A, and rebases onto WU-137 and WU-138) and WU-141.
- **Wave 3:** WU-142 and WU-143 in parallel, after WU-140 merges: their docs' examples run through WU-140's scripts.
- **Then WU-144.**

**Shared files and how they split:**
- `src/plan/compiler.ts`: WU-137 owns `stageParams`, the group writer and `MEASURE_FIELDS`; WU-138 owns the modes and
  the final path. WU-137 merges first; WU-138 rebases.
- `src/engine/schemas.ts`: WU-136 the `node_power` schemas; WU-137 the compile reply's `checks`; WU-138 the links
  reply. Merged by rebase in that order.
- `src/server/toolSchemas.ts` and the README table: WU-136 (`get_node_power`) merges first; WU-138 (`compile_plan`,
  `find_upgrades`) rebases.
- `tests/integration/nodePowerTitanRake.test.ts`: WU-136 everything but the `pool_groups` block, WU-137 that block;
  WU-136 merges first.
- `tests/fixtures/plans/`: each wave-1 unit its own `m27-<unit>/` folder (WU-136 also `open-spell/`).
- `src/plan/referenceData.ts`: WU-137 only; WU-139's `item-only-skills.json` loads once WU-137 merges.
- `NodePower.lua`: WU-136 only. `Compile.lua`: WU-137 only. `Trade.lua`: WU-138 only. `Lookup.lua`, `bootstrap.lua`
  and `lookupHandlers.ts`: WU-139 only.
- `SKILL.md`, `checkpoints.md`, `task-header.md`: WU-143 only. `pricing.md`, `gates.md`: WU-142 only.
- Shared static test files are edited by `describe` block (amendment 11 §16's rule); an `it` that runs a doc's example
  through a script is the doc's unit's.

## 24. Acceptance criteria (M-27)

- **AC-K81 (WU-136).** Engine, on the fixtures:
  - with `exclude: [<a node>]`, `rebuild: true`, a swap search and a `free` refill return no tree holding it and no
    path through it (a fixture whose best path runs through an excluded small node takes another path, or none);
    `exclude` naming an allocated node refuses the call, naming it;
  - on the attribute-tight fixture's `n`, a rebuild under `targets` returns a result with `Str ≥ ReqStr`,
    `Dex ≥ ReqDex` and `Int ≥ ReqInt`, its reply naming the attribute repair's steps (Appendix A); a fixture whose
    shortfall the repair can't close reads today's illegal attribute form with "after repair" (short of a legal rebuild
    on the fixture's `n`: HG-34);
  - an added attribute node takes the attribute with the largest shortfall (a fixture short of Dexterity: Dexterity);
  - a figure 0.4 under its target meets it; 0.6 under doesn't;
  - every figure in the reply's reasons has at most 2 decimals;
  - on the Titan Rake fixtures, a call without `exclude` still meets AC-K76's gains (+41% on r2-s-2, +46% on r2-s-1).
- **AC-K82 (WU-136).** The README table equals `pnpm docs:tools`' output; `tool-calls.json` holds a `get_node_power`
  sample with `exclude`; AC-B5's golden values hold; the work-log records the fixtures' source, and the
  copied plans' sha1s equal those of the run folder's files (HG-33).
- **AC-P90 (WU-137).** Schema 10, unit: a plan with a price entry's `listing` and `spec`, `tree.exclude`,
  `tree.search.targets` and `userMoves`, `rebuild: "none: <why>"`, `tree.end.endAfter: "swap"` and `itemSwaps` validates;
  each errs at its path on schema 9; a `tree.exclude` entry with no reason errs; `buildSha1` is equal with and without
  `listing` and `spec`; `items.treeJewels` naming an ascendancy node with no socket errs at its path. Engine:
  `items.treeJewels` naming 17788 (in `tree.ascendancyNodes`) compiles with the jewel in `Jewel 17788`.
- **AC-P91 (WU-137).** Engine: a plan with two counted groups, the named source ×2 and another ×2, saves `groupCount`
  2 on both and `includeInFullDPS` on the named source only; a counted skeleton-summon group that isn't the named source
  reserves its Spirit ×2; on the Titan Rake r2-s-2's `n`, the `pool_groups` gain for Shield Wall is within 1 point of
  the record's percentage at the plan's count (AC-K76's original bullet); AC-P56's test asserts `groupCount` on every
  counted group.
- **AC-P92 (WU-137).** Engine, V1 `affix-cap` on rares of a fixture stage at item level 82: an intelligence body
  armour with Spirit and "+100 to maximum Energy Shield" is a finding naming 96, at +96 none; a helmet's +90 names 73;
  gloves' +70 names 60; a belt's "+150 to maximum Mana" names 124; a rare with 4 prefixes, and a rare jewel with 3, are
  findings; a line no mod matches is a note and no finding; a unique line over its data range is a finding; on `m` the
  finding names the cap PoB's data gives at item level 69 (the test reads it from the data); a campaign stage uses its
  C1 area level.
- **AC-P93 (WU-137).** `data/items/sockets.json` loads through `referenceData.ts` as a C-35 fact file (a `judgment`
  source citing the user's ruling), and a claim citing `data:items/sockets.json#sockets.body-armour` compiles; a static
  test holds PoB's `socketLimit` − 2 equal to the table on every armour and weapon base, and Corona Amulet, Grasping
  Ring and Stalking Belt at 1. Engine, V1 `sockets`: a rare helmet with `Sockets: S S`, and a rare body with three, are
  findings; a rare body with two isn't; Morior Invictus with four isn't, with five and `Corrupted` isn't, with five and
  no `Corrupted` is; a unique with no `Sockets:` line in PoB's data (Alpha's Howl) with one socket isn't, with two is,
  with two and `Corrupted` isn't; a `Rune:` line on an item with no `Sockets:` line, and three rune lines on two
  sockets, are findings. V1 `ascendancy-jewel`: a rare Diamond in 17788 is a finding, a Ruby isn't; a unique jewel in
  17788 is the compile check's defect naming D-492 and nothing compiles, since PoB refuses it there
  (`Classes/ItemsTab.lua`:2289–2294; folded at WU-137's merge).
- **AC-P94 (WU-137).** A fixture whose clear skill has no radius and chains (Arc) records `clearSpeed` with `noArea`,
  `chains` and `projectiles` equal to PoB's `ChainMax` and `ProjectileCount`; a skill with a radius has neither.
- **AC-K83 (WU-138).** In-process MCP with a temp builds folder and a hand-written record and XML, the same server (and
  writer) that wrote the draft:
  - `read_back` on an unchanged draft replies `no changes`; with one item line, one gem level, two tree nodes and one
    config input changed, `readback.json` lists each under its loadout with its name (Appendix A) and the reply
    summarizes them; the call starts no engine (engine kind `none`);
  - after a new draft write over the base, a read-back of a copy of the older file is refused, writing nothing;
  - two read-backs of the same edited file both succeed;
  - after `adopt`, the next draft write replaces the edited file and leaves a backup, with no ` (draft 2)`; without
    `adopt`, the next draft forks to ` (draft 2)` as today; an adopted skeleton is removed by `remove_draft`;
  - an engine-required row: a final compile writes `final-build.xml` byte-equal to the final file, and a read-back of
    an edited final file compares against it; a campaign's final compile writes `final-build-campaign.xml`.
- **AC-K84 (WU-138).** The notes mode replaces `<Notes>` with `notes.txt`'s text (`& < >` escaped, `^x` codes kept)
  and updates the ledger's sha1 and the writer's fingerprint; on a final file changed on disk it refuses and writes
  nothing; it starts no engine; a read-back of the final file after a notes write still succeeds (its `baseSha1`
  unchanged); `set_build_notes` on a ledgered file refreshes its entry. Engine-required: a re-compile
  of that build's final file after a notes write isn't refused, and after `set_build_notes` likewise.
- **AC-K85 (WU-138).** Engine: the trade-links mode on a fixture plan with rares on `b` and `n` writes
  `trade-links.json` with an entry for each rare slot and rare jewel, each a
  `https://www.pathofexile.com/trade2/search/poe2/<league>?q=` URL whose decoded query holds a `weight` stat group, no
  weighted corrupted mod, a `corrupted: false` filter, at most 3 required filters, and a complexity within the prefit's
  budget; no request is sent (global `fetch` throws); with no cached stat list the entry says `ids unchecked`; a plan
  with no league writes none; a slot holding a unique has none.
- **AC-K86 (WU-138).** With a faked generator: `find_upgrades {link_only: true}` makes no request (the fixture fetch
  counts zero calls) and replies with at most 12 affixes in PoB's order, each with its gain at the middle roll and its
  weight per point, and the link last. On a committed trade2 fixture, each listing names its required affixes' tiers
  from the lines' `mods[].tier`, a merged line naming each. The three fallback causes carry `[trade:no_session]`,
  `[trade:session_rejected]` and `[trade:too_complex]`. The README table equals `pnpm docs:tools`; both descriptions
  stay within 2,048 characters.
- **AC-P95 (WU-139).** Engine, loading build XMLs directly (not through `compile_plan`): with 17788 allocated and a Ruby
  in it, a jewel line's value counts twice against the same jewel in a main-tree socket, for a Lich and an Abyssal Lich;
  with the fix list off, PoB's own parse of the line leaves a remainder (the test says it fails once PoB parses the
  line); AC-B5's golden values hold.
- **AC-K87 (WU-139).** Engine: `lookup_game_data` for Prism of Belief lists no Coiling Bolts variant and keeps Spark,
  Herald of Ash and Arc (Volatile Dead is absent from PoB's own list at the pin, §20; folded at WU-139's merge); a mechanic-mode mod hit shows each tier's item level and range; the base mode
  prints a body armour's sockets as `Sockets: 2 (PoB's ceiling 4 counts Exceptional and corruption)`.
- **AC-W107 (WU-139).** Static: `pob-gaps.md` holds PG-103 to PG-105 with kind, status and Where; CLAUDE.md's
  pin-upgrade steps name `pob-api/API/ParseFixes.lua`; `data/items/item-only-skills.json` is a C-35 fact file.
- **AC-W108 (WU-140).** Script unit, on a revision-14 fixture run beside the revision-13 fixtures:
  - the brainstorm display holds only the headers, `drawn from` lines and the closing lines, and a `pick:` naming a
    number's card passes; the verification display has a bold label on every field, the three tail bullets and the
    skeleton line first; the design display has the PoB file first, How it works, the five-row table (a no-area clear
    skill reading "no area: chains <n>, projectiles <m>"), Gear, Skills, The catch, at most 3 Over budget lines a rung
    from `trades.json`'s `from`, `to` and `price`, and Options, with `m` in two lines and none of today's measurement
    lines; `--detail` prints the revision-13 form; the final display's first line is the PoB file; every revision-13
    fixture's display is unchanged;
  - a build folder holding `final-build.xml`, `final-build-campaign.xml`, `readback.json`, `notes.txt` and
    `trade-links.json`, and a concept folder
    holding `readback.json`, pass `layout`, at revision 13 and 14 alike;
  - a revision-14 design field without `summary`, or over a cap, fails; a revision-14 plan's rare whose title has a part
    matching none of its lines fails, and one titled by its affixes passes;
  - accept → F1 → `answer-change` → W1 `cancelled` → `V4-claims` → W1 (`scope: "notes"`) → the build's end passes; an
    answer change before F1's pass or after W1's entry fails; `cancelled` on another stage fails; `--withdraw` removes
    `audit.md` and a partial `guide.md` and logs `withdrawn`;
  - design-gate `revise` → D1-finish (`scope: "swap"`) → D1-gate passes only with a `itemSwaps[]` entry; final-gate
    `revise` → D1-finish (`swap`) → D1-gate → F1 → W1 → `V4-recheck` passes; on a rung whose `tree.end` reads
    `endAfter: "swap"`, a fall with no `boss` trade and an `n` under the floor pass with the `itemSwaps[]` reason and fail
    without it;
  - accept with `scaling: true` → D1-finish (`scope: "scaling"`) → F1 passes; a scaling D1-finish without `scaling:
    true`, or after F1, fails;
  - after a fix round's re-check, an `ask {kind: "open-finding"}` checkpoint answered for one more round allows one more
    fix round and `V4-recheck`; without it, or a third, fails;
  - a stage entry whose request words aren't in the checkpoint's answer, its note or `readback.json` fails; an `ask
    {kind: "departs"}` checkpoint after a return with a `departs` line passes, and one with none before it fails;
  - a changed skeleton left in place prints its line on the next verification display; `audit.md` lists D1-tree's
    `tree.exclude` entries with their reasons;
  - "test it in game", "in-game test" and "needs in-game testing" in `guide.md`, `notes.txt` or a plan claim fail;
  - a price entry with `listing.corrupted` unlike the item's `Corrupted` line fails, as does one whose
    `listing.sockets` is under the item's; a `spec` must-have outside PoB's top 4 without `why` fails, a top-4 affix
    left out without `why` fails, and a spec with `ranking: null` is held to neither;
  - a bare `Corrupted` unique over 1 divine without the extra socket fails; with it, passes; a cheap one passes;
  - `rebuild: "none: <why>"` passes; a D1-tree entry with a non-zero `priceOutcomes` fails;
  - a ledger claim of 86 against an entry evaluating to 0.86 passes; an EHP under its band in every condition gives the
    `under` kind; a guide naming two levels for one rung fails;
  - a `scaling` trade with its fields passes; the guide's "Late endgame scaling" H2 passes (in an endgame guide and a
    full guide) only with the checkpoint's `scaling: true`; a revision-14 build's `-fallback` entry fails and an older
    build's passes;
  - `audit.md`'s known issues list a fixture's open findings;
  - `render-notes.mjs` renders a fixture guide with no `#`, `|` or `**` markup, `^x` headings, each link on its own line
    and no import code;
  - `init` writes `skillRevision: 14`; a resume of a revision-13 log stamps 14 with its boundary; every new rule but
    the layout lists holds only a build whose last D1 gate ran at or after revision 14's boundary.
- **AC-W109 (WU-141).** Static, one assertion each: `R1b.md` has the skeleton write, its `skeleton:` return and the
  draft call outside its two compiles; the card template has "unconfirmed (… if it fails: …)", no "needs in-game
  testing", and "How it clears" asks standing or walking; `Q.md` uses the same word; `patterns.md` holds no "needs
  in-game testing" and has the reducers' entry; `R1a-synthesize.md` and `R1a-assemble.md` no longer say the display
  carries the not-confirmed sentence; the library is at most 17,000 words, or the unit stopped at HG-35 with the count;
  the researcher's definition advises no test in game.
- **AC-W110 (WU-142).** Static, one assertion each, on the D1 stages and D2: `D1-build.md` returns one `request:` line per request (:32–34), marks
  out pieces unmeasured in `pieces.md` with an estimate, ranks with `link_only`, the
  build's weights and `weight_corrupted_mods: false`, drops affixes the base can't roll by lookup, takes 3 or 4
  must-haves with `why` and `leftOut`, keeps a must-have PoB scores at zero required, starts `n` at T1 with a depth
  check, runs the budget search with `include_non_upgrades: true` and the depth check, holds a slot to 5 trade searches,
  compiles each must-have at its tier's lowest roll, titles rares by their affixes, writes `tree.exclude` with reasons,
  socket-tests 17788, writes scaling finds and the Count note; `D1-tree.md` writes jewels at their best tier allowed, writes an `unmodelled` line for each piece
  `pieces.md` marks out unmeasured,
  passes `exclude`, uses the targets after gear moved and writes `tree.search.targets`, counts `userMoves`, records
  `none: <why>`, hand-edits no rebuild and makes no trade call; `D1-finish.md` accepts a ledger value × 100 (:276–278), has the `swap` and `scaling` scopes and
  their steps, runs the loop on D1-tree's jewels, never edits an item to a listing, measures on temporary stages and restores the plan, writes its own loops' scaling finds, the
  boss fall after gear moved and the trades' `price`, `from` and `to`; `D1-gate.md` writes `summary` (gear per rung) within its caps, has the `under` wording (:241–243),
  keeps the draft in its verdict and passes the judge `exclude` and the targets; `D2.md` has the campaign note.
- **AC-W111 (WU-142).** Static, one assertion each: `pricing.md` prices a rare at the 5th-cheapest of at least 10
  listings, starts `n` at T1, runs the budget search with tiers, passes `rune_behaviour: "remove"`, records `listing`,
  prices uniques with corruption or sockets by `search_trade_items`, states the corrupted-unique rule (cheap, extra
  socket, implicits out), says what the loop does offline, during a stop and without a session, reads the fallback's
  three causes, counts trade searches in its notice, prices an edited item on its four heaviest lines, re-prices a spec
  as compiled, has the campaign note, and has no "first listing" and no `-fallback` for a revision-14 build; `gates.md`'s
  budget and tree parts and the swap's fall rule; `lookups.md`'s socket counts and tier levels.
- **AC-W112 (WU-143).** Static, one assertion each: `SKILL.md` routes the swap (with its cost line), the answer change
  and `cancelled`, the skeleton and its removal, a read-back and an adoption at each gate, the notes write after step 14
  and after the claims steps, the scaling question and pass, and the extra round behind its `ask`; its tool list holds
  `read_back`, `adopt`, `notes_path` and a skeleton's `remove_draft`, its reads `readback.json`, its Bash
  `render-notes.mjs` and `render-audit.mjs --withdraw`; it is at most 331 lines plus the lines the work-log names, the
  new cap set in all three pins; `checkpoints.md` has each gate's form, the two accept questions, the user's words
  verbatim with request lines, the `ask` checkpoints, open findings told at once, and "unconfirmed" in place of "needs
  in-game testing"; `task-header.md` has `scope`, D1-build's `scaling` trades and W1's `notes.txt` in `writes`, R1b's
  draft, words and request lines, and fix-round briefs of finding ids only; `fix-round.md` has the extra round and the
  final-gate swap; `offline-and-test.md` says a test `accept` is the guide and has `scaling`; `F1.md` has
  `draftRemoved` and the links call; `W1.md` and `checkpoints.md` give the regular movement figure; `W1.md` has the `notes` scope, the scaling H2, the link block with its copy line,
  one level a rung, no test advice and the `under` wording; `V4.md` checks the fallback; both guide templates carry the
  scaling H2 and the links; the coordinator's definition names R1b's skeleton call, F1's links call, D1-finish's scopes,
  D1-tree's no-trade rule and `link_only` during a stop; the writer's names the `notes` scope; the verifier's names the
  fallback check.
- **AC-W113 (WU-144).** The live test: the user's judgment, recorded in the work-log with the decisions it exercised
  (the displays, the skeleton files, a read-back and an adoption, the guide-or-file question, a swap if any, the spec
  loop's searches and depth prices, a scaling section if asked, the notes, the links, the exclude list, the attribute
  repair, a Phylactery if a Lich) and those it didn't; the trade searches a build and their time; whether listings
  carried their tiers.

**Test strategy.** The spine's classes (§12) apply. Engine-required tests (`engineDescribe`): AC-K81, AC-P90's 17788
row, AC-P91 to AC-P95, AC-K83's final-compile row, AC-K84's re-compile rows, AC-K85, AC-K87. Unit tests with fakes:
AC-P90's schema rows, AC-K83's ledger and writer rows, AC-K84's write rows, AC-K86. In-process MCP: AC-K83, AC-K84,
AC-K86. Script checks on `tests/fixtures/pipeline/`: AC-W108. Static tests over the skill and docs: AC-P93's table
test, AC-W107, AC-W109 to AC-W112. Checked by the verifier, not Jest: the work-log rows of AC-K82 and the spikes, and at
integration §21's rows. Human: AC-W113. No test makes a network request: HTTP only through `fixtureFetch`, and Jest's
setup makes global `fetch` throw (D-34). The golden values (AC-B5) hold.

## 25. Migration and compatibility

- **Which rules a run is held to:** `run-log.mjs init` writes `skillRevision: 14`; a resume stamps 14 on an older log
  with its boundary. Every new display, route and checker rule holds a build only when its last D1 gate ran at or after
  revision 14's boundary, and a card only when it was dealt at or after it. A revision-13 log, and a build before the
  boundary, pass the checker unchanged, with one exception: the layout lists admit the new files for every build,
  because the M-27 server writes `final-build.xml` at every final compile.
- **Plans:** schema 10 adds a price entry's `listing` and `spec`, `tree.exclude`, `tree.search.targets` and
  `userMoves`, `rebuild: "none: <why>"`, `tree.end.endAfter`, the plan's `itemSwaps`, and an ascendancy node in
  `items.treeJewels`. A schema-9 plan compiles as before. In a revision-14 run D1-build moves any plan it edits to
  schema 10; a step that would write a schema-10 field into a schema-9 plan (a swap, a tree-only change, D1-tree's
  targets, D1-finish's `listing`, after a resume) runs D1-build first, as amendment 13 did for schema 8.
- **V1** gains `affix-cap`, `sockets` and `ascendancy-jewel`; an old plan may get findings it didn't; finished runs
  aren't re-checked.
- **Records:** additive (`clearSpeed.chains` and `projectiles`); `RECORD_VERSION` stays 2.
- **The write ledger:** entries gain `baseSha1` and `adopted`; an entry without `baseSha1` takes its sha1 as its base.
  The format stays version 2.
- **Node power:** a call without `exclude` returns what it returns today, except that the attribute repair and the
  attribute choice are always on.
- **The trade tools:** additive; `find_upgrades`' search link stays last; the fallback gains a prefix.
- **Files:** a final file gains notes, and its record a `final-build.xml` copy and `trade-links.json`, from M-27 on;
  old files keep theirs.
- **Guides already written** keep their text.
- **Rollback:** each unit is its own commits on M-27's branch; nothing changes a user's builds during the build.

## 26. Risks

| ID | Risk | Likelihood / impact | Mitigation |
|---|---|---|---|
| R-73 | Trade's tier labels ("P3", "S1") number tiers unlike PoB's data, so the budget search's mix reads wrong | low / medium | spike S-3 shows the labels are present; AC-K86 on a committed fixture; the live test compares one listing's tiers with PoB's |
| R-74 | Rares holding only must-haves at their tiers' lowest rolls lower the PoB figures, so more rungs read under their toughness band or the boss floor | medium / medium | the designer picks the must-haves the build's toughness needs; the gate shows the figures; the live test records the change |
| R-75 | Four-affix specs seldom reach 10 listings, so many slots drop an affix or end `thin` | medium / low | the floor and the drop rule; `thin` shown at the gate; the number is the user's to tune |
| R-76 | 20 to 35 trade searches a build at 45 s add 15 to 26 minutes of pacing | high / low | `n`'s one-search path, the notice's count; item 27 (the pacing's tuning) is deferred |
| R-77 | A read-back matches loadouts by the titles the compiler wrote; a renamed set doesn't match | low / low | the read-back lists unmatched loadouts and the runner asks |
| R-78 | The parse fix outlives PoB's own fix, or misfires on another tree version | low / medium | AC-P95's test fails when PoB parses the line; the pin-upgrade step names the file |
| R-79 | The attribute repair can't close the shortfall on attribute-tight builds, so their rebuilds are never taken | medium / medium | HG-34; the swap loop still runs; the gate shows `none: <why>` |
| R-80 | A link is longer than the trade site takes | low / low | the prefit's budget; the user's 1,222-character link worked; WU-138's spike records the longest |
| R-81 | The user's PoB holds a file open and saves over the pipeline's write | low / low | the ledger's and the writer's changed-on-disk refusals; the runner tells the user |
| R-82 | An answer change stops W1 mid-write | low / low | `cancelled`; the withdrawal removes a partial `guide.md` |
| R-83 | The user edits an older draft left open in PoB, so the read-back would show the pipeline's own revision as the user's edit | low / medium | the base check refuses a file written over since; the restatement names the visit; the user's yes before anything is adopted |
| R-84 | `item-only-skills.json` names only Coiling Bolts; another item-only skill still reaches Prism of Belief's list | medium / low | pricing finds no listings for it (the depth rule); the user adds names as they're found |

## 27. Operational guardrails and human-decision gates

**Guardrails.**
- **Trade:** no agent sends a trade request during the build; test servers keep trade off (`spawnServer`). In the
  live test, one trade client at a time, through the session's server; the user told before each pricing step, with
  its count of trade searches.
- **The builds folder:** skeletons, drafts, notes and adoptions reach it only through `buildFileWriter` and the
  ledger, backed up first, in the live test; the read-back only reads a file the ledger names; tests use temp folders.
- **The guides folder:** WU-136 reads it only for HG-33, copying the two plans unchanged and recording their sha1s;
  no machine path enters the repository.
- **The private library stays private:** nothing of it is committed.
- No agent contacts pathofexile.com or sends a request carrying a cookie or personal data without the user; poe.ninja
  only through its documented economy endpoints, politely (D-297, D-335). Never read `.env`; never set `POESESSID`.
- `vendor/` is never modified: the parse fix lives in `pob-api/`.

**Human-decision gates.**

| ID | Condition | Unblocks with |
|---|---|---|
| HG-32 | The build of M-27 starting: the user's approval of this amendment. It grants HG-12, for M-27 only, for: `compile_plan`'s read-back, adopt, notes and trade-links modes, `final-build.xml`, `groupCount` on every counted group, and V1's `affix-cap`, `sockets` and `ascendancy-jewel` (C-41); the record's `chains` and `projectiles` (C-33); the ledger's `baseSha1` and `adopted`, the writer's adoption, and `set_build_notes`' refresh (C-17); node power's `exclude`, attribute repair and its form, attribute choice, 0.5 tolerance and rounded reasons (C-55); `find_upgrades`' `link_only`, listing tiers and the fallback's prefixes (C-14); the lookup's tier levels, base socket line and generated-variant filter (C-37); the bridge's parse fix (C-6's procedure gains a step); plan schema 10 (C-31); `data/items/sockets.json`, `data/items/item-only-skills.json` and the loader's `items` folder (C-35). Most were in the gap analysis's grant list the user took (2026-11-02, gap X3); added to the grant since, for the
user's read (the user saw several as defaults, but not as tool changes): the adopt mode and the writer's adoption, `baseSha1`, the trade-links mode as its own call, `final-build.xml`, `link_only` and listing tiers, the lookup's tier levels, socket line and filter, V1's three findings, the 0.5 tolerance and rounded reasons, the fallback's three prefixes, the two data files | the user's approval |
| HG-33 | WU-136's fixtures: copying the open-spell run's two plans (r1-s-4, r1-s-2) from the user's run folder into `tests/fixtures/plans/open-spell/` (HG-6's kind) | granted at approval (2026-11-02, "You may copy this run's two plans (r1-s-4, r1-s-2) from my run folder into the test fixtures") |
| HG-34 | WU-136's attribute repair can't return a legal rebuild on the attribute-tight fixture's `n`: the unit stops with the figures and the steps | the user's decision |
| HG-35 | WU-141's library over 17,000 words after its additions (16,561 today) | the user's cap |
| HG-36 | The live test, WU-144, after M-27 is built: live trade through the server, web research on D-171's hosts, writes to the real builds folder (skeletons, drafts, notes, adoptions) | the user starts it |

## 28. Choices for the user, and proceed-on assumptions

**The user's answers and rulings** (§1): the 15 notes (2026-11-01); the revise ruling (2026-11-01); corruption's
extension, the socket counts, the weighted link's test (2026-11-02); the gap analysis's answers (2026-11-02): the
defaults taken, reading back at any gate, the must-have search, the compiled rare at the best tier allowed with the
tier-lowering loop, the campaign note, the depth rule and search budget, the regular movement figure; second round:
the must-haves chosen by PoB's ranking and the designer together, with the build's weights, and the coordinator's loop
("Everything else looks good"); at approval, the yes on HG-33, the open-spell plans as fixtures (2026-11-02).

**Where this spec departs from what the user accepted**, for the user's read at approval:
- **Importance** is estimated from PoB's measured gain per point (weight × the roll one tier step loses), with no extra
  compile; round 2 said "measured (the engine's loss per tier step)" (§9 step 4). A compile per must-have and step would
  measure it exactly, at about one compile a step.
- **Search counts** are in trade searches: one `find_upgrades` call usually makes two, so a `b` slot usually takes 3
  and the cap is 5 a slot (round 2: "usually 2 searches a slot, at most 4", counted in calls) (§9).
- **`b` and `n` sharing a sequence** becomes `n`'s T1 depth check answering `b` when its 5th cheapest fits `b`'s target
  (§9 step 5).
- **A slot still thin past the cap** goes to another source of the stat and, with none, is `unavailable` with
  `thin: <count>`, never priced from fewer than 10 listings (§9 step 8; gap 15e said "then another source").
- **The scaling pass runs before F1**, not after (gap 16c): after F1, its compiles would overwrite the final record and
  its prices change the plan's hash (§12). Finds' prices live in `trades.json`, not in plan entries (gap 7f).
- **The notes are written after step 14** (a guide build) and after the last claims step (a file-only build), not "after
  the last V4 pass" or "after each revision's F1" (gap 17a), so they carry the known issues and the patched guide (§13).
- **Adoption happens on the user's yes** to a read-back's restatement, not at the read-back (gap 14g), so an edit the
  user declines keeps D-466's protection (§5).
- **The links** use the spec's weights (PoB's defaults only without a spec; gap 18c said PoB's defaults), in their own
  call after F1, not inside the final compile (its time bound, NFR-20) (§14).
- **A swap keeps D1-tree's `unmodelled` trades** and drops only its `boss` trades (gap 12b dropped both) (§7).
- **The rung item levels** (69, 82, 82) are this amendment's own choice, grounded on D-440's 35% boots on `b`; the gap
  list credited them to `movement-tier`, which sets none. The code's area levels are 69, 79 and 82
  (`compiler.ts`:666–675), so with 79 a `b` rare would be one tier lower on some affixes (Names).
- **A file-only build's notes** (how to play, levels, the order) get no V4 pass: they draw only on the plan, the claims
  the claims pass judged and the card's pitch (§13). The user's "verify on file-only build" (D-477) predates the notes.

**Defaults the user saw** (the gap analysis, 2026-11-02), written above as decisions:
- `SKILL.md` within 331 lines, trimmed to fit, or more by named lines; rules by revision 14; one record of over-budget
  finds (`trades.json`'s `from`, `to`, `price`); a flow rule for every new route; display prose from a step's field;
  costs in tokens; a live test closing M-27;
- the guide-or-file question; the answer change, `cancelled`, the audit's withdrawal, no file-to-guide switch (§6);
- the swap's definition and route (D1-finish, then the gate), its records, its re-measured trades, today's tree route
  on a tree failure, the cost in the restatement (§7);
- the displays: brainstorm headers, verification formatting, the design form, `b` and `n` in full and `m` in two lines,
  the `summary` field, the one-liners, `--detail`, the options lines, revision gating (§4);
- the skeleton file, its record, its cleanup (picked removed, unpicked kept), the draft's record, the read-back, an
  edited item taken literally (§5);
- late endgame scaling's record, its question at accept, the re-price pass, the H2 of about 150 words, at most 5 finds
  and 15 searches (§12);
- the notes writer as a post-F1 ledgered write, `set_build_notes`' fix, the rendered guide, the notes-free import code,
  W1's notes for a file-only build (§13);
- the links for rare slots and jewels only, corrupted mods off, the rung's level, the socket minimum, the fenced block
  (§14);
- "unconfirmed" with its fallback, the checker's flag, V4's check; rares by affixes (§15);
- the user's words, request lines and the stop, re-confirmed conditions, logged words (§8); the fix round's briefs,
  the ask after the one re-check, open findings told at once (§8);
- the toughness `under` kind, one level a rung, the fallback's handling, per-item `unavailable`, D1-tree without trade
  (§16, §20);
- the price entry's `listing`, matching copies, uniques by `search_trade_items` when it matters, the bare `Corrupted`
  rule, socket claims (§10);
- `affix-cap` and its notes (§11); the socket table and check, no Exceptional socket on designed rares, the cheap
  socketed unique priced uncorrupted, quivers 0 (§10, §11);
- the percent rule (§20); every counted group's `groupCount` (§19);
- the exclude list and where it lives, the attribute repair and choice, no hand edits, the tolerance, `userMoves`, the
  targets after gear moved, the boss fall after gear moved (§16);
- the ascendancy socket in schema 10, the basic-jewel finding, the bridge's parse fix, the socket test, no ascendancy
  swaps, the `unmodelled` line (§18);
- the regular movement figure, the card's standing-or-walking line, the no-area label (§17);
- the PG entries (§21).

**Proceed-on assumptions** (the drafter's, for the user's read):
- the floor tier two tiers under the best allowed (Names);
- the mix "at least 5 of the listings under the target meet every must-have"; PoB's top 4 (the first four the base can
  roll) for the `why` rule; 12 affixes in `link_only`'s reply (§9);
- `m`'s rares written as specs and priced by the depth check alone (§9);
- when the loop can't run: rares at their floor tiers offline, at the tiers reached during a stop, depth checks alone
  without a session (§9);
- D1-finish running the loop on D1-tree's rare jewels, which D1-tree writes at their best tier allowed (§9);
- an edited item priced on its four heaviest lines (§5); read-back changes at the verification gate joining the card's
  brief (§5);
- the skeleton file named `<card name> skeleton (draft).xml` through the existing draft mode, outside R1b's two
  compiles (§5);
- `final-build.xml` (and `final-build-campaign.xml`), `readback.json`, `trade-links.json`, `notes.txt`; loadouts
  matched by the compiler's titles (§5, §13, §14);
- the `summary` caps of 400, 120 and 300 characters; 3 Over budget lines a rung (§4);
- `render-notes.mjs`'s form (§13); the notes refused on a changed file left as is, the user told (§13);
- the links' `corrupted: false` filter and `ids unchecked` marker (§14);
- the checker's words rule ("in the checkpoint's answer, its note, or `readback.json`") (§8); the request lines outside
  the 8-line return (§8); the extra round at most once a build (§8);
- the `scope` field's name and values; the `ask` checkpoint's kinds (§7, §8, §12, §13);
- the `unmodelled` line widened from ascendancy notables to any piece PoB can't measure (§15); the rare-title check by
  its parts (§15);
- a boots exception shown in the gear line (§4, §17);
- the fix list's file, `ParseFixes.lua`, and its re-processing of the switch copies (§18);
- `item-only-skills.json` as the filter's source, starting with Coiling Bolts (§20, R-84);
- the withdrawal also removing a partial `guide.md` (§6, R-82);
- rares searched with their base's standard socket count, so price, listing and link describe one item (§9, §10, §14);
- unmeasured over-budget finds shown marked "(estimate)" (§4); `scaling` finds written by D1-build and D1-finish, each
  replacing its own (`by`) (§12);
- the field names `itemSwaps` (the plan's swaps) and `userMoves` (the user's tree moves), apart from
  `tree.search.swaps` and a stage entry's `requests` (§7, §16).

## 29. The independent review and its resolution

The review (2026-11-02), on revision 0: four lenses with fresh context, read only (invented decisions 232K tokens,
task graph and criteria 293K, ground-truth fidelity 417K, completeness and fit 310K), found 90 raw findings (12 high,
49 medium, 29 low), clustered into eight (K1–K8); two skeptical verifiers (239K and 265K, both resumed once after a
login expired mid-run), defaulting to "refuted", confirmed 43 of the 61 high and medium findings, partly confirmed 18
and refuted none. Revision 1 folds them all, and the lows that held on a check; where a verifier's narrower fix kept a
default the user took, revision 1 follows the verifier. Two findings change what the user accepted (the search counts,
the rung item levels) and go to the user in §28's departures list. A fresh consistency pass on the folded text (260K)
found 27 places where two parts disagreed (4 high: the notes write moving the read-back's base, measures on probe plans
no folder admits, the price-match rule failing the cheap unique and every socketed rare); all 27 are folded: the notes
write leaves `baseSha1`, measures stay on today's temporary stages, the cheap unique is excepted, and rares are searched
with their base's standard sockets.

| Cluster | Verdict | Resolved in |
|---|---|---|
| K1 the spec loop: tiers with no data source, per-class ranking and its order, zero-scored must-haves dropped, corrupted weights, `include_non_upgrades`, a price read off a weighted page, two searches a call, `n` at T1, the thin end state, D1-tree's jewels, no path offline or in a stop | confirmed (two partly) | §9, §20, Appendix A, AC-W110, AC-W111 |
| K2 the read-back: the base check against an adopted sha1, the writer's own guard, adopted skeletons removed, adoption before the yes, a stale base, the user's words | confirmed or partly | §5, §8, R-83, AC-K83 |
| K3 the routes: the scaling pass after F1 breaks the final record, the notes' timing, the extra round against "one re-check", no scope field, the test config, the campaign path, schema-10 fields on a resumed plan, the run log's records | confirmed or partly | §6, §8, §12, §13, §16, §25, Appendix A, AC-W108 |
| K4 files and actors: the layout lists reject every new file (even at revision 13), the runner's closed lists, R1b's compile cap | confirmed | §5, §13, §23, §25, AC-W108, AC-W112 |
| K5 the swap: a rare rewritten by the loop against the user's words, the boss-trade and floor rules, the final gate, `endAfter: "gear"` undefined | confirmed or partly | §7, AC-W108 |
| K6 the user's decisions: the grant list, round 2's loop unlabelled, "move key info", file-only notes unverified, the rung item levels credited to `movement-tier`, quotes and labels | confirmed or partly | §1, §4, §27, §28, Names |
| K7 data and tools: the socket file not C-35's shape, uniques without a `Sockets:` line, the lookup's "up to 4", the Prism filter too wide, the Abyssal Lich copy, listing tiers' real field, the fallback's three causes, links against NFR-20, the rare-title rule self-contradicting, the attribute reply's form, D1-tree's calls unloggable | confirmed or partly | §10, §11, §14, §15, §16, §18, §20, AC-K81, AC-K85 to AC-K87, AC-P93, AC-P95 |
| K8 units, criteria and tests: a test file two units edit, the H2 pin breaking WU-140's gate, the no-area label's owner, "unconfirmed" in `checkpoints.md` unowned, test classes, two over-budget field sets, the `SKILL.md` cap's number, touch lists, description caps | confirmed or partly | §12, §23, §24 |

## Appendix A. Formats

### The plan (schema 10)

- A price entry gains `listing?: {corrupted: <bool>, sockets: <n>, count: <n>, position: <n>}` and, on a `b` or `n`
  rare or rare jewel, `spec?: {base, weights: [{stat, weight, why?}], ranking: [{affix, gain, weight}] | null,
  mustHaves: [{affix, tradeId, tier, min, zeroScored?: true, why?}], leftOut: [{affix, why}], searches: <n>}`
  (`ranking` PoB's top 4 the base can roll, or null when the loop couldn't rank; `why` on a weight other than Full DPS
  and `TotalEHP`; `searches` in trade searches). Both are left out of `buildSha1`.
- `stages[].tree.exclude?: [{nodes: [ids], reason}]`, a reason required.
- `stages[].tree.search` gains `targets?: {ehp, maxHit, why}` and `userMoves?: <n>`; `rebuild` may read `"none: <the
  tool's reason>"`.
- `stages[].tree.end` gains `endAfter?: "swap"`.
- `itemSwaps?: [{stages: [ids], slot, from, to, bossBefore: {<stage>: <n>}, bossAfter: {<stage>: <n>}, reason}]` at the
  plan's top level.
- `stages[].items.treeJewels` may name a `containJewelSocket` node of `tree.ascendancyNodes`.
- A rare's title is its key affixes (`+2 spell levels, Spirit, chaos resistance`).
- V1 codes: `affix-cap`, `sockets`, `ascendancy-jewel` (each finding names the item, the line or the count, and the
  limit).

### `compile_plan` (C-41)

- Read-back: `{plan_path, read_back: <relpath>}`, engine kind `none`; reply `Read back: <relpath> against <the base>:
  <n> changes (<summary>)`, `Read back: <relpath>: no changes`, or its refusal; it writes `readback.json` beside the
  plan.
- Adopt: `{plan_path, adopt: <relpath>}`, engine kind `none`; reply `Adopted: <relpath>`.
- Notes: `{plan_path, notes_path}`, engine kind `none`; reply `Notes written: <relpath> (<n> characters)` or its
  refusal.
- Trade links: `{plan_path, trade_links: true}`, engine kind `load`; reply `Trade links: <n> written to
  trade-links.json`.
- A final compile also writes `final-build.xml` (a campaign's, `final-build-campaign.xml`) beside its record.

### The write ledger (version 2, additions)

Each entry gains `baseSha1` (the sha1 of the bytes a compile or a draft wrote; the notes write and an adoption leave
it) and `adopted?: true`.
An entry without `baseSha1` takes its `sha1`.

### `readback.json`

```json
{"file": "<relpath>", "base": "compiled-build.xml", "baseSha1": "<sha1>", "loadouts": [{"title": "b",
  "items": [{"slot": "Weapon 1", "removed": ["…"], "added": ["…"]}],
  "gems": [{"group": 2, "skill": "Arc", "changes": ["Controlled Destruction: removed"]}],
  "tree": {"added": [{"id": 123, "name": "…"}], "removed": [{"id": 456, "name": "…"}], "ascendancy": [],
    "jewels": [], "attributes": []},
  "config": [{"input": "enemyIsBoss", "label": "…", "from": "Pinnacle", "to": "Uber"}]}], "unmatched": []}
```

### `trade-links.json`

`[{stage, slot, url, ids: "checked" | "unchecked"}]`, beside the final record.

### The record (additions)

`measures.clearSpeed` gains `chains` and `projectiles` when the clear skill has no radius.

### `get_node_power` (C-55)

- Added: `exclude: [node ids]`.
- The rebuild line gains `; attributes repaired: re-pointed <n> to <attribute>, added <m> (<names>)`; an unclosed
  shortfall reads `<Attribute> would be <x>, under the <y> its gear and gems need, after repair`; a refused call reads
  `Excluded node <id> (<name>) is allocated`; an added attribute node's line names its attribute.

### `find_upgrades` (C-14)

- `link_only: true`: no request; the reply lists `Ranking (PoB's order: gain at the middle roll, weight per point):
  <affix> <gain> <w>; …` (at most 12) and the link, last.
- A listing line gains `tiers: <affix> T<n>, …` for its required affixes (a merged line names each mod's tier).
- The fallback reads `[trade:no_session] …`, `[trade:session_rejected] …` or `[trade:too_complex] Trade search not
  run: <reason>.`

### `lookup_game_data` (C-37)

- A mechanic-mode mod hit lists its tiers: `T<n> (item level <l>): <range>`.
- The base mode's socket line: `Sockets: <count> (PoB's ceiling <socketLimit> counts Exceptional and corruption)`.

### `data/items/sockets.json` (C-35)

```json
{"schemaVersion": 1,
 "sources": [{"id": "user-sockets-2026-11-02", "kind": "judgment",
   "ref": "the user's ruling on rune sockets (2026-11-02, citing pob2wiki)", "patch": "0.5.x", "confidence": "H"}],
 "facts": {
   "sockets.body-armour": {"value": 2, "source": "user-sockets-2026-11-02", "patch": "0.5.x", "confidence": "H"},
   "sockets.two-hand-weapon": {"value": 2, "source": "user-sockets-2026-11-02", "patch": "0.5.x", "confidence": "H"},
   "sockets.one-hand-weapon": {"value": 1, "…": "…"},
   "sockets.helmet": {"value": 1}, "sockets.gloves": {"value": 1}, "sockets.boots": {"value": 1},
   "sockets.shield": {"value": 1}, "sockets.focus": {"value": 1},
   "sockets.amulet": {"value": 0}, "sockets.ring": {"value": 0}, "sockets.belt": {"value": 0},
   "sockets.quiver": {"value": 0, "note": "the user's default; the ruling doesn't name quivers"},
   "sockets.corona-amulet": {"value": 1}, "sockets.grasping-ring": {"value": 1}, "sockets.stalking-belt": {"value": 1},
   "sockets.exceptional-extra": {"value": 1}, "sockets.corruption-extra": {"value": 1}}}
```
(Every fact carries `source`, `patch` and `confidence` as the first two show.)

### `data/items/item-only-skills.json` (C-35)

`{"schemaVersion": 1, "sources": [{"id": "user-prism-2026-10-31", "kind": "judgment", "ref": "the user: Prism of
Belief rolls only gem skills; Coiling Bolts is granted by Liminal Coil", …}], "facts": {"item-only-skills.coiling-bolts":
{"value": "Coiling Bolts", "source": "user-prism-2026-10-31", "patch": "0.5.x", "confidence": "H"}}}`

### `<buildFolder>/trades.json` (additions)

Every entry of a revision-14 build gains `price: {amount, currency, count, date} | null`, `from` and `to` (by unique
name or base and affixes, or null). `kind` gains `"scaling"`: `{stage, slot, damage, ehp, measured, repriced}` beside
those. `scaling` entries carry `by: "D1-build" | "D1-finish"`, each step replacing only its own; D1-finish measures and
re-prices them all.

### The task header

`scope?: "swap" | "scaling" | "notes"` (D1-finish's `swap` and `scaling`, W1's `notes`), recorded on the stage entry.
`writes` gains `trades.json` (kind `scaling`) for D1-build, `scaling` beside its own kinds for D1-finish, and
`notes.txt` for W1.

### The D1 gate's design field and verdicts

- The design field gains `summary: {how, gear: [{stage, slot, text}], catch}` (400, 120 and 300 characters at most).
- The D1 gate's verdict keeps `draft: <relpath>`; F1's verdict gains `draftRemoved: <relpath> | null`.

### The run log

- `skillRevision: 14`.
- R1b's stage entry: `skeletonFile: <relpath> | null`, `skeletonRemoved?: true`.
- `answer-change {checkpoint, visit, from, to, note}`; `withdrawn {build, files}`; outcome `cancelled` (W1 after an
  answer change).
- `ask {kind: "departs" | "open-finding", build, answer}` checkpoints.
- A stage entry: `scope?`; `requests?: [{id, words, result: "made" | "departs: <how>"}]`; D1-tree's `priceOutcomes`
  (any non-zero count fails).
- The design checkpoint's accept: `scaling: true | false`.
- The layout lists: `BUILD_FILES` gains `final-build.xml`, `final-build-campaign.xml`, `readback.json`, `notes.txt`
  and `trade-links.json`; `PLAN_FILES` gains `readback.json`.

### The displays (revision 14)

Brainstorm:
```
**1. Rupture Relay Arc Lich** (Witch, Lich, Arc; under-played: yes)
drawn from mobalytics.gg
<the runner's rotation, what makes it work, its key and scheduled pieces, the catch>
…
Obvious build: …
Plain cards: …
<a short round's reason>
```

Verification:
```
**1. Rupture Relay Arc Lich**: verified
- **PoB file:** Rupture Relay Arc Lich skeleton (draft).xml (key pieces only; its numbers aren't the build's)
- **Damage:** …
- **Risks:** …
- **PoB can't verify:** …
- **Stronger structure:** …
```

Design (after [GR]; figures illustrative):
```
PoB file: Threaded Hex Coiling Bolts Lich (draft).xml in your Builds folder

**Threaded Hex Coiling Bolts Lich: budget endgame** (level 88)

**How it works.** <up to three sentences>

| | |
|---|---|
| Damage, map packs | 272K per second (the same on 40%-resistance rares) |
| Damage, pinnacle boss | 314K per second |
| Toughness | 9,017 effective HP; lowest max hit 3,751 (physical) |
| Arbiter of Divinity | survives its hardest hit (93% of your max hit) |
| Speed | no area: chains 6, projectiles 1; movement +13%, no travel skill |

**Gear**
- Wand: Liminal Coil, under 1 div: corrupt copies until one rolls +1 chaos spell levels
- Boots: Windscream, 18% movement speed on the boots (its curse line carries the build)
- Amulet: rare Solar Amulet, +2 spell levels, +45 Spirit, chaos resistance
…
**Skills**
- Coiling Bolts: Chaos Mastery, Rapid Casting II, Controlled Destruction, Unleash, Mobility
…
**The catch.** <up to two sentences, with any unconfirmed point and its fallback>

**Over budget**
- Against the Darkness was swapped for a 5-div sapphire; adding it back: +8% damage, −1% EHP, about 100 div more.

**Options**
- not made: …
- jewel: …
- stronger structure: …
```

### The PoB notes (`notes.txt`)

Plain text, PoB's colour codes for headings (`^xE0C080<heading>`), one link a line, no import code; a file-only
build's sections: How to play, When to switch (levels), Late endgame scaling (if taken), Trade links, Open findings.
