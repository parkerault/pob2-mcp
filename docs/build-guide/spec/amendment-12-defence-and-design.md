# Amendment 12: defence that holds, one tree per loadout, and the design's questions

**Status: APPROVED, revision 2, 2026-10-28.** Revision 1 followed the independent review (§26: four lenses and two
skeptical verifiers) and the user's answers; revision 2 folds a re-check of revision 1 (§26). The user approved it on
2026-10-28: "The amendment is approved, start the build. I won't do any live tests until the amendment is built." So
the build doesn't wait for amendment 11's live test (WU-116), which runs with this amendment's (WU-126, §19).
It formalizes the approved candidate list of the defence study (in the user's private guide library, "Amendment
candidates"), with:
- the user's answers and rulings of 2026-10-26 and 2026-10-27, quoted where they're used;
- the defence study (`../studies/2026-10-26-defence-layers.md`, cited as [defence]) and the sizing study
  (`../studies/2026-10-26-sizing.md`, cited as [sizing]);
- a gap analysis of the candidates (2026-10-27), whose defaults the user saw without objecting;
- two read-only surveys of the code and docs these changes touch (2026-10-27), cited by file and line.

It is written against spec v1.6 and amendments 8 to 11, all built (M-24). Paths are from the repository root, except
stage files (`D1-build.md` and so on), under `.claude/skills/build-guide/references/stages/`, and the skill's other
files, under `.claude/skills/build-guide/`. Decisions continue from D-449, work units from WU-117, criteria from
AC-W93 (pipeline), AC-P82 (plan compiler) and AC-K73 (server tools), risks from R-48, gates from HG-23; the milestone
is M-25. It adds PG-83, PG-84 and PG-86 to PG-100 to `docs/build-guide/pob-gaps.md` (PG-85 is dropped, and its number
skipped). The plan schema gains version 8 (§7, §6). Each decision ends with the rows and rules it amends. Appendix A
fixes the formats; §25 lists the defaults the user saw and the proceed-on assumptions; §26 is the review.

**Names.**
- The **lowest max hit** is the least of PoB's five `<Type>MaximumHitTaken` on a stage, with its type. A type PoB
  makes the build immune to (an infinite max hit) is left out and recorded as immune.
- The **Arbiter verdict** is D-353's: the Arbiter's largest hit of each type, top roll, against the stage's max hit of
  that type, `one-shot` at a ratio of 1 or more. From this amendment its max hits come from the Pinnacle pass (§4).
- The **chances at the Arbiter** are the build's evade and deflect chances against the Arbiter's accuracy, 3,786
  (`data/enemies/arbiter-of-divinity.json#base.accuracy`, monster level 79), with no blind: the evade chance by PoB's
  own melee evade formula (`vendor/…/Modules/CalcDefence.lua`:1460–1466, `calcs.monsterHitChance` at :40–46, on the
  build's `MeleeEvasion`), the deflect chance by `calcs.deflectChance` (:48–54) on its `DeflectionRating`. A hit whose
  data carries `hits.<id>.evadable: false` has an evade chance of 0 (§4).
- The **deflected verdict** is the Arbiter verdict re-read for a hit that is deflected: the hit less its deflected
  share (`DeflectEffect`, 40% at base) against the max hit. It survives below 1.
- **Hits survived** is the share of an Arbiter hit the build survives: 100% when it survives the full hit; else the
  evade chance plus (1 − the evade chance) × the deflect chance when it survives the deflected hit; else the evade
  chance. It is computed per hit, and a row keeps the least over its type's hits (§4). Block isn't in it: the user's
  metric is evade or deflect. The **share that kills** is 100% less hits survived.
- A **one-shot rung** is `b` or `n` with a one-shot row whose hits survived is under the floor, 80% (§4). It is the
  verdict the gates, the trades and the guide use. A rung's **deciding row** is its one-shot row with the lowest hits
  survived, else its row with the largest ratio (today's `worst`). Every single Arbiter figure of a rung (the label,
  the design field, the key-figure line, the trades' `maxHit`) comes from it.
- The **conditioned read** is a stage's EHP and lowest max hit with every condition against the build: PoB's unlucky
  switch on, "been hit recently" on, Wind Dancer at 0 stacks, the enemy not blinded.
- The **chance-layer share** is the part of a stage's EHP that evade, block and deflection make (§4).
- The **resisting figure** is the named source's damage figure against the map enemy with 40% fire, cold and lightning
  resistance (§9).
- A **pool line** is a gear line that raises the build's pool (life, energy shield, or mana under damage taken from
  mana first) on a rare slot.
- An **avoidance source** is a tree node, gear line or support that raises the evade chance, the deflect chance or the
  deflected share.
- The **defence plan** is the card's `Defence:` line and the plan's `stages[].defence` (§6).
- **One tree per loadout** (T1): each rung's tree is the best one for that loadout; the only constraint across stages
  is one start node (§7). A rung's tree is **seeded** from the stage before it, then free.
- The **wall rule** (P1): name the payoff apart from the means that supply it, and search other means before tuning (§12).
- The **pace floor** is the trade limiter's minimum gap between one search's start and the next, 45 s (§16).

## 1. The user's direction

On the defence study and its candidates (2026-10-26):
- the toughness reading: "EHP, the lowest max hit, and a warning when EHP misleads"; the band keeps reading
  `TotalEHP`;
- one tree per loadout: players respec freely, so each loadout gets the best tree for it. On the campaign: "The player
  can respec any time they want, as many times as they want";
- defence and attributes: "the type of character dictates the type of defenses that can be used because each type has
  high requirements of a particular stat";
- deflection on evasion builds, pure or hybrid: pure evasion feels tanky until a big hit gets past it; not every
  build. Near the cap the 40% applies to 19 hits in 20, so a deflection build is stronger against big hits than its
  max hit says;
- G2 (a max-hit ranking stat) deferred; PG-85 (block against spells) dropped, trusting PoB; one library trim on the
  final text, not one now and another later;
- after the 429: "we need to update our search policy".

On the gap analysis (2026-10-27):
- one amendment, one milestone (M-25), built in waves;
- D2: a third damage figure, the map enemy with 40% fire, cold and lightning resistance and curses at full strength,
  shown beside the map and boss figures, with no threshold;
- P11: measure, show, judge. Every evasion build measures deflection sources beside its best EHP nodes, the gate shows
  EHP and the share of Arbiter hits that kill for each, and the design takes deflection where it judges it pays;
- B7: a 45 s minimum gap between searches, enforced in the limiter and waited inside the tool call; the wait cap rises
  from 30 s to 60 s. `find_upgrades` keeps a fixed 90 s budget (the user's revised answer to gap 31, 2026-10-27,
  replacing "it grows"), so a call makes at most two searches, usually two, fetches the best listings of the searches
  it ran, and its stop line says the gap cut its loop short;
- G9's floor. First: "Half seems too low, but the cap of 95% might be too high. Needs more consideration." Then, on
  counting evasion: "chance to either deflect *or* evade. Maybe that should be the metric." The ruling: a rung isn't
  one-shot by an Arbiter hit when it survives the full hit, or survives at least 80% of those hits, evasion and
  deflection counting alike. And: "80% is the floor, but that doesn't mean the agent shouldn't try to go higher if
  possible. It would depend on whether the cost of the higher number is justified."

## 2. What the studies showed

From [defence] and [sizing], only what the decisions need:
- **EHP can pass its target on chance layers alone.** The animeprincess Twister Gemling reads 17.9k, inside the
  distance band, and the Arbiter's slam one-shots it ([defence], "The one-shot builds"). Chance layers never move the
  max hit, and the Arbiter verdict is the only figure that reads a one-shot.
- **Four of 30 reference builds are one-shot**, all by the physical hit; a pool line is the cheapest fix in each.
  Node power's EHP ranking offers evasion first, which never moves the max hit.
- **Deflection turns a one-shot into a chance.** At the Arbiter's accuracy the three evasion one-shots survive 79.6%,
  78% and 45% of slams counting evasion and deflection (the coordinator's measure, 2026-10-27).
- **Conditions and luck:** the unlucky switch costs builds over 40% evade 32–45% of EHP; with all four conditions 13
  of 30 fall under the band, against 5 at base.
- **Curses count at map strength** in the Arbiter verdict (Enfeeble ×1.45–1.52 on the max hit); halved, no verdict
  flips, measured on curses alone: the Pinnacle pass also sets 3% enemy penetration and level 82 (§4).
- **Two Witchhunter files typed Sorcery Ward as energy shield,** counting the ward twice.
- **Jewels:** a top-roll rare jewel is worth about 3.8 points of the best nodes; sockets sit 4–8 points from finished
  trees ([sizing], "Jewel sockets").
- **Resistance:** 40% on the main element costs a median 18%, 8% with penetration; 8 builds invert it ([sizing]).
- **Curse caps:** no reference build runs a capped curse; the cap ends at gem level 18 ([sizing]).
- **The 429:** one agent alone drew a 600 s lockout at its 19th search in about 4.5 minutes, inside the headers'
  windows; 7 searches 60–94 s apart met no limit ([sizing], "Side findings").

## 3. What already fits

- **P9's rule is in the library:** "take evasion and deflection thresholds from PoB's formulas" (`patterns.md`:76–80).
  Its accuracy (2,357, the map enemy's) and the library's deflection figures predate the Arbiter's 3,786; WU-123
  corrects them (§13).
- **D9 is done:** the gain-as-extra order is in the library's damage-order rule.
- **G2 is deferred** (the user, 2026-10-26). Revisit it if a live run meets a one-shot that node power's EHP ranking
  and the pool lines can't fix ([sizing], "Open").
- **P10's kit line** ("Every archetype, for defence", `patterns.md`:120–) and the Defence family's entries (Deflection
  beside evasion, Blind as defence, EHP over its target but one-shot) are in the library already; this amendment makes
  the stages apply them.
- **The record keeps every finite PoB output** (`pob-api/API/Compile.lua`:2109–2124), so B4's fields that PoB outputs
  are already in `outputs`; `lua_get_stats` is what lacks them.
- **The boss pass exists** (`measure_boss`, `Compile.lua`:2168–2224): G7 reads its max hits; P2's guard reads
  `measures.bossGroups`, each boss-rotation entry's figure, on stages already compiled.
- **The trade channel exists:** `trades.json` (D-439) carries every new trade; the checker's rules for a missing trade
  (`check-run.mjs`:5226–5227) extend to the one-shot rung.
- **The run's revision mark exists:** `skillRevision` (`run-log.mjs`:185); §22 makes it ordered.

**Contracts this amendment touches:**

| Contract | Tag | Delta | Compatibility |
|---|---|---|---|
| C-31 plan file | modified | schema 8: `stages[].defence` added, `stages[].respec` refused (§6, §7) | schema 1–7 plans compile as before, their Arbiter rows aside (§22) |
| C-33 record | modified (additive) | `measures.toughness`, `measures.arbiter.avoid` and its rows' fields, `measures.damage.resisting`, `treeChange` (§4, §7, §9) | `RECORD_VERSION` stays 2; old records lack them and readers fall back |
| C-41 `compile_plan` | modified | V1 codes `curse-level-cap` and `custom-defence`, on schema ≥ 8 only; `tree-continuity` on schema ≤ 7 only; radius jewels (§7, §10, §6, §15) | a schema-7 plan's findings are unchanged |
| C-36 stage artifacts | modified (additive) | `trades.json` kinds and fields by revision; the D1 gate's design field; the run log's per-revision boundary (Appendix A) | a build or log at revision 11 reads as before |
| C-53 pattern library | modified | questions 20–24, the enemy's side, the stale deflection lines, the trim (§13) | caps set at HG-24 |
| C-52 cards | modified | the card's `Defence:` and `Means:` lines (§6, §12) | old cards keep their fields |
| C-11 rate limiter | modified | the pace floor and 7 searches in 300 s, both options the server deps set; the 60 s wait cap (§16) | callers see `would_wait` less often, waits longer |
| C-14 `find_upgrades` | modified | the 90 s budget stays; under the floor a call makes at most two searches, returns its best listings, and the stop line names the gap (§16) | fewer searches a call |
| C-16 state dir | modified (additive) | `trade-429.jsonl` (§16) | additive |
| C-45 `lua_get_stats` | modified (additive) | defence fields (§15) | added lines |
| C-48 `update_tree_delta`; D-360's `find_path_to_node` | modified | paths to an untagged node run through untagged nodes only; the auto-path line names the nodes (§15) | a call refused before may now succeed |
| C-55 `get_node_power`, C-37 `lookup_game_data`, C-38 `check_model_coverage`, `load_config_preset` | existing (defects fixed) | each does what its description says (§15) | none |

## 4. D-449: the toughness reading

G4, G5, G7 and G9 are one reading of how tough a rung is. The band keeps reading `TotalEHP` (D-441 unchanged);
beside it the gate shows what EHP hides, and warns when EHP could mislead.

**What the compile records** (`src/plan/record.ts`, `src/plan/compiler.ts`, `pob-api/API/Compile.lua`):
- **On every variant stage**, `measures.toughness`:
  - `lowestMaxHit {type, value}`, from the stage's own measure (map monsters, as the floor reads it), and `immune`,
    the types whose max hit PoB makes infinite;
  - `chance {notHit, damage, factor, share}`: PoB's `ConfiguredNotHitChance` and `ConfiguredDamageChance`
    (`CalcDefence.lua`:2051–2061, :3310), `factor` = 1 ÷ ((1 − notHit/100) × damage/100), the EHP multiple the
    chance layers give, and `share` = 1 − 1 ÷ `factor`, the chance-layer share. No extra read.
- **On `n`**, `measures.toughness.conditioned {ehp, lowestMaxHit}`: a measure pass that sets `EHPUnluckyWorstOf` 2
  (Unlucky), `conditionBeenHitRecently` on, `windDancerStacks` 0 and `conditionEnemyBlinded` off, reads `TotalEHP` and
  the five max hits, and puts every option back, as `measure_boss` does, so the saved file and `configWritten` are
  unchanged. G3's "the compile reads toughness with been hit recently on" becomes this second read; the band still
  reads the build's own config.
- **The Arbiter verdict reads the Pinnacle pass** (G7): `measure_boss` also returns the five `<Type>MaximumHitTaken`
  and the immune types, read right after its first rebuild, on the stage's own weapon set, before any weapon-set-2
  rebuild (`Compile.lua`:2207–2213); `arbiterMeasure` (`record.ts`:301–340) reads those. The pass keeps PoB's
  Pinnacle settings as they are ("trust PoB"; proceed-on): curses at half effect, the enemy's 3% fire, cold and
  lightning penetration placeholders (`pinnacleBossPen`, `Data.lua`:293; `ConfigOptions.lua`:2073–2075) and enemy
  level 82. So the lightning rows of a build with positive lightning resistance move too, not only a cursing build's.
  The reference hits' floor still reads the map measure.
- **Per hit:** each hit in the Arbiter's data is read with its own ratio and `evadable` fact. A row (one per type and
  the physical-lightning mix, `record.ts`:301–317) keeps its largest hit's ratio and verdict, as D-353 has it, and its
  `hitsSurvived` is the least over the type's hits. A mixed row's max hit is the hit over the summed ratio
  (`record.ts`:327–328).
- **An immune type** (gap 26): today `output_map` keeps only finite outputs (`Compile.lua`:2112), so an infinite max
  hit vanishes and its Arbiter row's verdict is null. The bridge returns the immune types; such a row has `ratio` 0,
  `verdict` `survives` and `immune: true`, and the lowest max hit leaves the type out. In the mixed row an immune part
  counts 0 and the row reads the other part. A max hit of 0 is a one-shot. A row whose verdict stays null is never a
  pass: it reads "not measured against the Arbiter", as today (`check-run.mjs`:1940–1946).
- **On `b` and `n`, `measures.arbiter.avoid`** whenever the evade or deflect chance at the Arbiter is above 0:
  `{accuracy, evade, deflect, deflectEffect, method}`, the chances at the Arbiter computed by the bridge from the
  loaded build (PoB's formulas with 3,786 in place of the enemy's accuracy, a lucky or unlucky flag applied as PoB
  applies it, `CalcDefence.lua`:1476–1481, :1518–1521), because PoB's config can't set an accuracy above 2,357
  (enemy level clamps at 85; `CalcSetup.lua`:739). Each Arbiter row gains `deflectedRatio`, `deflectedVerdict` and
  `hitsSurvived` (Names).
- **A companion's share of deflected hits** (`TakenFromCompanionBeforeYouFromDeflected`, the unique body Forgotten
  Warden) is already in PoB's max hit, at PoB's own deflect chance (`CalcDefence.lua`:2959–2962), so such a build's
  hits survived counts deflection partly twice, and reads high at the floor: a known approximation (PG-100;
  proceed-on), which the gate notes on such a build. No reference file has it.
- **Evadable hits.** Arbiter hits can be evaded (proceed-on, R-54): since patch 0.3.0 removed Acrobatics, evasion
  covers almost every hit, the stated exceptions being damage over time and "specific boss moves" (the coordinator's
  web search for the user, 2026-10-27), and no source names the slam as unevadable. PoB has an enemy flag
  `CannotBeEvaded` (`CalcDefence.lua`:1447) but no per-skill data, so a hit in the Arbiter's data may carry the fact
  `hits.<id>.evadable: false`, which makes its evade chance 0; absent means evadable. Nothing sets it today;
  `arbiterHitsOf` (`record.ts`:238–249) reads it.
- **The deflected ratio** (gap 11; a spike first, WU-120): a measure pass in which deflection is certain, if PoB can be
  made to count it (PoB counts deflection in the max hit only at a 100% chance, `CalcDefence.lua`:2459, and caps the
  chance at 95%, `Data.lua`:245, so the pass changes `data.misc` at run time; `vendor/` stays unmodified, and the
  pass restores what it changed before it returns, however it ends); otherwise the ratio × (1 − `DeflectEffect` / 100),
  which is exact without armour and optimistic with it, since PoB applies armour to the full hit first. `method`
  records which (`pass` or `formula`).
- **The key-figure line** (`compiler.ts`'s `keyFigureLine`) gains `lowest max hit <n> <type>`, the deciding row's
  `hits survived <x>%` on a rung with `avoid`, and the resisting figure in its damage part (Appendix A).

**The floor** (the user, 2026-10-27). A rung isn't one-shot by an Arbiter hit when either:
1. it survives the full hit (the Arbiter verdict, top roll), or
2. its hits survived for that hit is at least 80%.

"At least", because PoB rounds chances to whole numbers. Displays round hits survived down to a whole percent (79.6%
shows as 79%), so no figure rounds up across the floor; the checks use the unrounded value. The verdict keeps the
hit's top roll (the slam rolls 2,324–3,486). Evasion and deflection count alike, so a build with no deflection can
pass on evasion alone: this **supersedes the ruling of 2026-10-26** that held a build without deflection to surviving
the full slam. In practice 80% evade at 3,786 needs about 81,000 evasion; the highest reference build has 38,000
(68%). The 80% lives in `references/toughness-targets.json` (Appendix A), which D1-finish, the D1 gate, W1 and the
checker read. On the reference set: the animeprincess Twister Gemling survives 79.6% (it needs 67% deflect, about
+800 rating), the Spirit Walker Beast Master 78% (55%, about +2,600), the LazyExile Amazon 45% (the full trade).

**Above the floor the design keeps judging** (the user: "80% is the floor, but that doesn't mean the agent shouldn't
try to go higher if possible. It would depend on whether the cost of the higher number is justified"): when more
evasion or deflection is cheap, the design takes it and says what it cost (§5's avoidance trade, §6). Below the floor
the rung is a one-shot rung: §5's defence trade and the warning below.

**The display** (Appendix A):
- On `b` and `n`: the Arbiter line from the deciding row, with hits survived and the chances at the Arbiter when the
  build evades or deflects, and `under the 80% floor` on a one-shot rung; then `Lowest max hit: <n> <type>`; on a
  build with a companion's share of deflected hits, one note that its hits survived is optimistic (PG-100).
- On `n` (where the band is, D-441): the Effective HP line gains the chance-layer share; then the conditioned read and
  its band; on a build that deflects, one line on deflection's average cut to ailment damage from hits: PoB's own
  `DeflectChance`, against the map enemy, × `DeflectEffect` (PG-97), which PoB doesn't apply.
- **The warning** (G4, with G5 as its first case), on `n`, in plain words, when:
  - the EHP is within or over the band and `n` is a one-shot rung: it names the deciding row's type, the chance-layer
    share and the fix family; or
  - the conditioned EHP falls under the band: it names the conditioned lowest max hit's type and the fix family.
  The fix family is "the pool, armour or a physical shift" for a physical type, "the pool or that type's resistance"
  for any other, and "the pool, armour, a physical shift or lightning resistance" for the physical-lightning mix
  (proceed-on, §25).
- The D1 gate's design field carries these (Appendix A); the checker recomputes the one-shot rung, the deciding row,
  the conditioned band and the warning from the record and the targets file, and fails a field that disagrees.

Amends D-353 (the Arbiter verdict's max hits; hits survived per hit; the immune row), D-441 (the toughness line's
companions, not its band), the 2026-10-26 ruling on builds without deflection, `record.ts`'s `arbiterMeasure` and
`stageMeasures`, `compiler.ts`'s `keyFigureLine`, `Compile.lua`'s `measure_boss` and `output_map`,
`D1-gate.md`:203–213, `checkpoints.md`'s design gate (:259–317), `run-log.mjs`'s design display, `check-run.mjs`'s
design checks (:5143–5233).

## 5. D-450: a defence trade on a one-shot rung, and the avoidance trade

**The defence trade fires on a one-shot rung** (G1), `b` or `n`, whatever its EHP band. This **diverges from D-441**,
which offers it on `n` under its band only; that case stays. D1-finish (step 5) measures, each on a temporary stage
that copies the rung, compiled measure-only and removed after (`D1-finish.md`:240–246), within the defence trade's
allowance (damage may fall at most 15%):
1. **pool lines**: the build's pool line on a rare slot that can roll it, at a realistic roll, in place of the slot's
   least valuable line;
2. on a build with evasion or deflection, **avoidance sources**: deflection and evasion nodes within reach, a rare
   slot's deflection or evasion line, more deflected share;
3. **tree moves**: node power's best swap ranked by `TotalEHP` and its best unallocated EHP nodes (`limit: 15`), up to
   5 of them measured for the deciding row's max hit (G2 stays deferred, so node power can't rank by it);
4. the existing unique-against-rare comparison when the rung has an armour-slot unique with no life, energy shield or
   resistances.

It writes up to three `defence` entries in G1's order (restored by the review, §26): first every entry that clears
the rung, its deciding row surviving the full hit or reaching the floor, pool lines first among them; then the rest,
by hits survived on a build that evades or deflects, else by the deciding row's max hit. Pool lines that don't clear
stay in the list. A clearing entry is never cut for a non-clearing one. Each carries `maxHit {type, before, after}`
and, on a build that evades or deflects, `hitsSurvived {before, after}`. None found: `none found: <why>`, as today.

**Which max hit.** Every one-shot figure here (the `maxHit` fields, "clears the full hit", the damage trade's rule
below) is the deciding row's max hit from the Pinnacle pass, measured on the temporary stage. Node power's `maxHit`
guard reads the map measure (`NodePower.lua`:458–466), so it is only a pre-filter.

**A damage trade on a one-shot rung** may not lower the deciding row's max hit: D1-finish measures its move on the
temporary stage, and passes node power `max_loss.maxHit: 0` as a pre-filter when that type is the lowest max hit. The
entry carries `maxHit` before and after.

**The avoidance trade** (P11's measure; the user, 2026-10-27, "measure, show, judge"). On `b` and `n` of every build
whose defence plan's base includes evasion, pure or hybrid (§6; the user's "every evasion build"), D1-finish writes an
`avoidance` entry: the next avoidance spend within the allowance, with its EHP change, damage change and hits
survived before and after, and in `reason` what the same points give on node power's best EHP nodes ("the same 20
points on the best EHP nodes: +14% EHP, hits survived 45%"). The **next avoidance spend** (proceed-on) is up to 20
tree points (the sizing study's comparison) on deflection and evasion nodes, chosen by hits survived per point, fewer
when the sources run out. A gear line is its own option, a second `avoidance` entry at its price and zero points: the
best deflection or evasion line a rare slot can roll. Both are shown on every such rung, one-shot or not, so the user
sees what more avoidance costs.

**The keep.** The defence trade's node power calls keep the rung's needs only (§7), so a trade on `n` may free nodes
the budget rung holds; this settles the design report's question C7.

**The checker** fails a one-shot rung with no `defence` entry, a damage trade on a one-shot rung whose `maxHit.after`
is below `maxHit.before`, and an evasion build's `b` or `n` with no `avoidance` entry (`none found: <why>` passes).

Amends D-441's defence trade (its trigger and keep), D-439's `trades.json` (kinds and fields), `D1-finish.md` step 5,
`D1-gate.md`'s design field, `checkpoints.md`'s trade lines, `check-run.mjs`'s `checkTradesFile` (:5037, :5075–5091)
and `checkDesignField`.

## 6. D-451: the defence plan

The design picks its defence before it tunes it.
- **The family follows the class's attributes** (P10; the user, §1): strength for armour, dexterity for evasion,
  intelligence for energy shield, two attributes for a hybrid base. In 26 of 30 reference builds the main defence
  follows them ([defence]). A family off the class's attributes is allowed, and D1-build counts its cost: attribute
  lines on gear and tree points for the bases' requirements.
- **The card's `Defence:` line** (G8; `templates/card-template.md`'s Pitch): the base family, the layers by role
  (chance, mitigation, pool) and what holds the Arbiter's physical hit. Names only, since cards carry no figures
  (D-436).
- **The plan's `stages[].defence`** (schema 8, Appendix A), written by D1-build on `n` beside `skills.engagement`:
  `{base, chance, mitigation, pool, physicalHit}`, `base` one of `armour`, `evasion`, `energy shield`,
  `armour/evasion`, `armour/energy shield`, `evasion/energy shield` (the bases' attribute families), the others short
  texts. The checker requires it on `n` of a schema-8 plan (§22), as it requires `engagement`.
- **Deflection on evasion builds, pure or hybrid** (P11): D1-build's defence step takes avoidance sources (tree
  Deflection nodes, gear lines, increased deflection rating, more deflected share) as far as they stay competitive with
  its other defence picks, valued by EHP and by hits survived, not by EHP alone; no cap is required; it measures a
  source on a temporary stage like any piece, keeps what it takes as a need on each rung that holds it (node power
  can't see hits survived, so D1-build's needs list names deflection taken for it), and says why in the need's claim.
  Glancing Blows is no deflection source ([sizing]).
- **Conditions under hits** (G3, D1-build step 7): a line that holds only while not hit (Hyrri's Ire, "if you haven't
  been hit recently"), stacks lost when hit (Wind Dancer, Virtuous Barrier's motes, Ghost Shroud) and "Is the enemy
  Blinded?" are earned state with an uptime under hits; blind needs a producer that hits the attackers.
- **No custom line for a layer PoB models** (G6). A `config.customMods` line that adds a pool or a defence first shows,
  through `check_model_coverage`, that PoB doesn't model the mechanic it stands for, and its `reason` names that
  result as `coverage: <status>` (`unparsed`, `partly parsed`, `parsed to nothing`, `possibly unread`); PoB parses a
  `possibly unread` line, so D1-build also measures it on a temporary stage (D-243). V1 gains **`custom-defence`**, on
  schema-8 plans: a custom line whose parsed mods include a pool or defence stat (life, energy shield, mana, ward,
  armour, evasion, deflection, block, resistance, damage taken) and whose `reason` has no `coverage:` result. The
  compile reports each custom line's parsed mod names in V1's input (`Compile.lua`, PoB's `modLib.parseMod`). V1 trusts
  the marker's text; V4 re-runs `check_model_coverage` on the line and fails a claim whose status differs (proceed-on).
  The Witchhunters' Sorcery Ward counted twice this way ([defence], "The Witchhunter correction").

Amends D-293's custom-modifier rule, `D1-build.md` steps 7 and 8 (a defence step) and its needs list, the card
template, `R1a.md`'s card rules, V1's table (`src/plan/checks/v1.ts`:11–31, and `02-plan-compiler.md`'s V1 table at
integration), `V4.md`'s checks, the plan schema, `plan-reference.md`.

## 7. D-452: one tree per loadout

The user's ruling (2026-10-26): players respec freely, so each loadout gets the best tree for it. The only tree
constraint across stages is one start node. It covers the campaign stages too ("The player can respec any time they
want, as many times as they want"). Gold is a note, never a reason to keep a node.

This **retires D-438** (respec when the scaling changes, otherwise grow, with its grow links; amendment 11 §6) and,
for schema-8 plans, **D-144** (tree continuity) and **D-282**'s respec checks and its gold weighing on `m` and campaign
stages; it amends D-418's `keep`.
- **The plan** (schema 8): `stages[].respec` is refused (an error at its path); a schema-7 plan keeps it. `tree.scales`
  stays: §13's shared-scaling rule uses it. In a revision-12 run, D1-build moves any plan it edits to schema 8: it
  writes `schemaVersion: 8` (today "at `schemaVersion: 7`", `D1-build.md`:62–68), drops `respec` and adds `defence`
  on `n`. A tree request on a build whose plan is still at 7 goes to D1-build first, for that move (proceed-on).
- **V1's `tree-continuity`** runs on schema-7 and older plans only (`checkContinuity`, `v1.ts`:513–540; the compiler
  passes no predecessor for a schema-8 plan, `compiler.ts`:1158). `predecessorOf` (`v1.ts`:108–131) still orders the
  stages for the record's tree change, and skips temporary stages (§8).
- **The record** gains, on each stage of a schema-8 plan with a stage before it, `treeChange {from, refunded, added}`
  (`StageRecord`, `record.ts`:1066): the stage before (by `predecessorOf`), and the counts of nodes it holds that this
  stage doesn't, and the reverse.
- **D1-build** writes each rung's tree seeded from the stage before (`m` from the campaign's last stage or the
  skeleton), with the rung's targets and needs, and marks no respec. **A need is written on every rung that holds its
  nodes**, since no rung keeps the one before's nodes any more (today: "the later rungs keep it", `D1-build.md`, The
  needs).
- **D1-tree** may change any node of a rung except its needs: `keep` is the rung's `tree.needs` nodes; `protect_for` is
  passed no more (the tool keeps the parameter); a change no longer goes up the ladder; the respec checks, the
  `respec:` return and `respec.dropped` go (`D1-tree.md`:38–55, :93–105, :128–142). The rebuild pass and the swap loop
  work on the whole rung.
- **The D1 gate's tree part** passes the same `keep` and no `protect_for` (`D1-gate.md`:136–146, `gates.md`:121–124).
- **The defence trade's keep** is the rung's needs (§5).
- **D2** designs each campaign stage's tree for that stage, seeded from the one before; its respec rules and gold
  weighing go on schema 8 (`D2.md`:96–121). The tree path stays: the stage before's nodes first when it keeps them.
- **The guide** gives each rung's tree (the PoB file holds it) and one line on what changes from the stage before:
  `refund <n> points and allocate <m>; respeccing costs gold`, from `treeChange`, counts only, no gold figure (no
  source table exists, A-32). The checker compares the counts. W1's and the templates' respec lines stay for schema 7.
- **Routes:** in a run held to this amendment's rules, D1-tree has no `respec` outcome, and a user's respec request is
  a tree request (D1-tree, then D1-finish). The checker keeps old runs' routes (`check-run.mjs`:378–385,
  :3701–3703, :3789–3790; `run-log.mjs`:170–171).

Amends D-438, D-144, D-282, D-418 (`keep`, needs per rung), D-428's lifted deferral (moot), `D1-build.md`'s
`schemaVersion` (:62–68), step 3 (:140–155), step 5's needs and its respec lines (:26–27, :417–418, and `respec n`
in the `for D1-tree:` line, :474–481), `D1-tree.md`, `D1-gate.md` (:25, :136–146), `gates.md`:45–51, :114–124 and
:315, `D2.md`, `W1.md`:73, :171–172, :192–195, :205–207, both guide templates' respec lines, `V4.md`:192,
`checkpoints.md`:329–334, `SKILL.md`'s D1 routing (:217–220), `references/run-log.md`:104 and :222–224,
`plan-reference.md`'s Tree tracks, `src/plan/schema.ts`, `src/plan/checks/v1.ts`, `src/plan/compiler.ts`,
`src/plan/record.ts`, `run-log.mjs`, `check-run.mjs`.

## 8. D-453: jewel sockets

T2 (the user's ruling: min-maxed builds path to many sockets and fill them with jewels of only the stats they scale).
D1-tree, on `b` and `n`, after its spare points (step 3.2) and before the swap loop:
- **Which sockets:** each empty jewel socket within 4 points of the rung's tree, nearest first, at most 3 measured per
  rung ([sizing]: the nearest sit 4–8 points away on finished trees; a socket pays at about 3 points or less).
- **The test:** a temporary stage that copies the rung, frees as many points as the socket's path costs from node
  power's weakest list ranked on `["MainDamage", "TotalEHP"]`, allocates the path, and puts a rare jewel in the socket;
  compiled with the rung, measure-only. The socket is taken as a change (the path's nodes and `items.treeJewels
  {node, text}`) when its `MainDamage` beats the rung's and its `TotalEHP` and lowest max hit fall no more than a
  swap's 2% (`D1-tree.md`:59–64). It weighs the jewel against the rung's weakest points, not T2's best nodes: once
  spare points are spent, the weakest are what a socket costs (proceed-on).
- **Temporary stages** (here and in every D1 step) get ids that start `tmp`, letters and digits like every stage id
  (`tmpb1`; `schema.ts`:97). `predecessorOf` skips them, and D1-build, D1-tree and D1-finish remove any `tmp` stage
  left in the plan (a crashed step's) when they start (proceed-on).
- **The lines,** chosen once per build at the first socket test: candidate affixes of the jewel base that serves the
  build's scaling (`tree.scales`), each measured alone on a temporary stage on the map figure, at most 8 candidates
  (proceed-on, §25), the boss figure read beside it; `b`'s jewel carries the best 3 lines at a middle roll, `n`'s 4 at
  the top roll. No crafted "Effect of Prefixes/Suffixes" line (PG-99). The damage-against-rares line is judged on the
  map figure like any other (the user judges builds on clear). D1-tree writes the chosen lines and the `tree.scales`
  they serve in `pieces.md` (`## Jewel lines`), and reuses them while `tree.scales` is unchanged.
- **Paths** avoid weapon-set nodes. D1-tree paths with `find_path_to_node`, which §15's B8 rule now covers.
- **Prices:** D1-tree writes each taken jewel's `prices[]` entry (`Jewel <node>`, D-372), its required affixes the
  chosen lines, its target `b`'s 5 divines or `n`'s share (`pricing.md`:84–90); before pricing, D1-finish re-splits
  `n`'s default 150 divines evenly over its rares and tree jewels, keeping any reasoned share (`D1-build.md`:321–324).
  [sizing] prices 3 good lines at about 5 divines (attack, middle roll) to 22 (caster, top roll), 3 minion lines at
  69–100, and a 4th line at 130–400, so the 4th line is `n`'s. An over-target jewel keeps its lines, like any
  over-target rare (`pricing.md`:95–100), so a minion build's `b` jewel stays, over target (proceed-on).
- **What the user sees:** D1-tree returns one `jewel: <rung> <node>: <lines>: +<x>% damage, boss <+y>%` line per
  socket taken, outside its 8-line cap (proceed-on); the runner prints them under the design gate's display, as it
  prints `not made:` lines.

Radius jewels that allocate nodes are B3 (§15). Amends `D1-tree.md` step 3, its Returns and its "Nothing else changes"
rule (it now writes tree jewels, their price entries and `pieces.md`'s jewel lines), `D1-finish.md`'s prices,
`D1-build.md`'s temporary stages, `SKILL.md`'s 6b row.

## 9. D-454: the resisting figure

D2, the user's answer (2026-10-27): beside the map figure (0% resistances) and the boss figure, a third figure
against the map enemy with 40% fire, cold and lightning resistance, the waystone modifier's top roll on all three
(`data/enemies/waystones.json#mods.monster-elemental-resistance`, 35–40), curses at full strength (the map enemy isn't
a boss). No threshold, no trade.
- **The measure:** a pass beside `measure_boss` (`Compile.lua`:2168–2224, called at :2300–2320) sets
  `enemyFireResist`, `enemyColdResist` and `enemyLightningResist` to 40 on the stage's own config, reads the named
  source's group as the main measure does, on its own weapon set as `measure_boss` does, and puts the options back.
  The record gains `measures.damage.resisting` on variant stages, with the cull multiplier on the same rule as the map
  figure (D-437).
- **Where it shows:** the design gate (`Resisting rares: <x> per second (40% fire, cold and lightning resistance)`),
  the final gate's rung lines, the audit's stage table, the guide's verdict line and the key-figure line
  (Appendix A). The checker compares each with the record.
- **Why it is shown:** penetration and resistance reduction read zero on the map figure (PG-90); a build that inverts
  resistance (Rakiata's Flow) reads higher here, which is the point ([sizing], "A resisting target").

Amends D-437's figures, `record.ts`'s `DamageMeasure` (:658–663) and `sourceMeasures`, `compiler.ts`'s params
(:956–958) and `keyFigureLine`, `src/engine/schemas.ts`'s compile reply, `run-log.mjs`'s design and final displays,
`render-audit.mjs`, `check-run.mjs`, W1, the guide and audit templates.

## 10. D-455: the curse level cap

D3. PoB never reads a curse's monster-level cap (PG-86): `skill_curses_cannot_apply_to_targets_above_level` is a
per-level stat, 72 at gem level 14, 78 at 17, none from 18 ([sizing]; Despair, `Data/Skills/act_int.lua`:5282–5310).
Frost Bomb's exposure and Thunderstorm's Wet have their own cap stats.
- **The read:** `stage_gems` (`Compile.lua`:1876–1895) finds any of three stats in the gem's stat set:
  `skill_curses_cannot_apply_to_targets_above_level` (curses),
  `frost_bomb_exposure_does_not_apply_to_enemies_of_level_higher_than_X` (Frost Bomb's exposure, `act_int.lua`:9111)
  and `thunderstorm_wet_debuff_cannot_apply_to_targets_above_level` (Thunderstorm's Wet, `act_str.lua`:19537). It
  returns `curseCap {cap, of}` at the level PoB's calculation uses, +levels from gear included, not the socketed
  `gem.level` (:1883): none when the gem lacks the stats; a cap of 0 means none.
- **V1 `curse-level-cap`**, on schema-8 plans: a gem with a cap above 0 and below the stage's area level:
  `rungAreaLevel` for a rung (`compiler.ts`:600–609: 69, 79, 82), C1's `<progress>.area-level` for a campaign stage
  (`v1.ts`:877); a card skeleton is skipped. The message names the gem, its level, the debuff, its cap and the area
  level. In practice it guards planned low gem levels on `m` and in the campaign.

Amends V1's table, `src/plan/checks/v1.ts`, `Compile.lua`'s `stage_gems`, `src/engine/schemas.ts` (`checks.gems[]`),
`D1-build.md`'s gem step (a line naming the cap).

## 11. D-456: the design's damage checks

- **Wither stacks** (D5, D1-build step 7): steady stacks are the duration ÷ the application interval, at most 10,
  unless another Wither source is named.
- **Weapons by compile** (D6, `pricing.md` and D1-finish's prices): never compare weapons by a listing's DPS; re-check
  the top 3 weapon listings (proceed-on, §25) on the build's own damage figure on a temporary stage, because
  `find_upgrades` scores by PoB's Full DPS (`pricing.md`:133–135), which D-437 rules out as the build's figure.
- **The budget levers** (D7, D1-build's levers line, D-406): on `b`, measure the enemy-side levers (Rage with Berserk
  on attacks, a reliable shock, exposure, curses) beside crit, not before it; never inversion on `b` (Rakiata's Flow
  costs about 185 divines, the user, 2026-10-26); each one left out is `lever unpulled:`. On `n`, a build that inverts
  resistance skips the resistance levers. [sizing] found budget crit items sell at the trade floor, so "crit costs more
  for less" fails in currency. The candidate's ailment-type payoff and penetration with a lowered floor are out: gap
  8's default, which the user saw, named only the four levers above; penetration shows on the resisting figure (§9).
- **Ailment uptime from PoB's figures** (D8, R1b's checklist item 2 and D1-build step 7): an earned ailment condition's
  uptime cites PoB's per-hit chance or buildup against the rung's enemy, read from the record's `outputs` where PoB
  computes it for the main skill (`<Ailment>ChancePerHit`, `CalcOffence.lua`:4949–5061), else from `lua_get_stats`;
  a `judgment` from the gem text only where neither shows it (proceed-on). The stage states the expected hits to
  apply it; more than 5 on the Pinnacle boss is a risk and starts the wall rule (§12).
- **A boss guard** (P2; bosses are a floor), on each boss-rotation entry of `measures.bossGroups`, triggered entries
  included: the summed `measures.damage.boss` isn't enough, since it leaves triggered entries out and can hide a cut
  boss button behind a raised main skill (`record.ts`:795–802).
  - **D1-tree's Check** gains one test for its own moves only (the loop's swaps, rebuilds, spare points and sockets),
    never a user's request or a trade the user takes (`D1-tree.md`:91 counts both as changes today): a move that cuts
    any entry by more than 2% is undone, like a floor failure. Its removed nodes become a need with no `stat`, whose
    claim names the boss-rotation entry it keeps, not the floor's `TotalEHP` need (`D1-tree.md`:114–115).
  - **D1-finish** measures each trade's entries on the temporary stage it compiles for the trade. The trade's
    `bossAfter` comes from that measure, not from boss × (1 + `damageChange` / 100) (`D1-finish.md`:251–253), and a
    trade that cuts any entry by more than 2% says so in its cost line. Trades stay the user's choice: nothing is
    undone.

Amends `D1-build.md` (levers line :102–105, step 7), `D1-tree.md`'s Check and Undo, `D1-finish.md`'s prices and
trades (:251–253), `pricing.md`, `R1b.md`:342–345.

## 12. D-457: the wall rule

P1. Today a failing rung routes to tuning, or to `infeasible` with nothing proposed, so a design that searched one means
per job can't see it sits at a local maximum.
- **D1-build step 3:** name each payoff apart from the means that supply it, and give each load-bearing supply a second
  means. When a rung fails because a means doesn't deliver, search other means to the same payoff before tuning, and
  write a `## Searched` line in `pieces.md` for each.
- **The card:** a `Means:` line in the Chain, `<payoff>: <means>; second means <means | none found>`.
- **Question 2** of the library ("Fix the payoff first…") gains: name the means apart from the payoff.
- **A stronger structure:** when the best means changes the skill, weapon or ascendancy, D1-build returns
  `stronger structure: <the means>: <why>`, also written under `pieces.md`'s `## Searched` to survive a compaction or
  a resume. The runner prints it under the design gate's display as a choice (gap 22): the user takes it as a
  `revise:` when the roll (class, ascendancy, skill) stays; one that changes the roll is a successor card, made at the
  verification gate (D-391).

Amends `D1-build.md` step 3, the card template, `patterns.md`'s question 2, `checkpoints.md`'s design gate,
`SKILL.md`'s D1-build row.

## 13. D-458: the library's new questions, the enemy's side, and the trim

**Questions 20–24**, a new section "Brainstorm questions 20–24: defence, pools and buttons", asked after 1–19
(numbers by gap 6):
- **20, defence layers** (P7, with P10): which layers does the character get cheaply (the armour base its attributes
  allow, what that base feeds, the pool)? Which figure does each move? What holds the Arbiter's physical hit?
- **21, empty pools** (D4): list the multiplier pools (your increases, more multipliers, gain as extra, crit, the
  enemy's resistance, the enemy's damage taken) and how full each is; the next buy goes in the emptiest. Its inversion
  branch: never reduce resistance on a build that inverts it, or buy it on one that ignores it. [sizing]: per 10
  points, enemy damage taken +9.7%, increased damage +2.3%.
- **22, ascendancy fit** (P3), for briefs that leave the ascendancy open: for each candidate ascendancy, which notables
  feed the build's layers, which only defend, which are dead; when another feeds clearly more, compose a split or
  successor card. R1a-synthesize asks it in step 5.
- **23, shared scaling** (P4), for builds with two or more damage skills: name the stats every damage group shares
  (D1-build writes them in `tree.scales`); a node that feeds only another group is a need, measured on that group's
  figure.
- **24, buttons, upkeep and proxies** (P5): presses per pack and per boss, buffs that need re-casting, and a proxy that
  could press each, with its cost; with a new section-5 entry "A proxy presses the button" (Mortar Cannon's 50% less
  damage and attack speed is the proxy's price).

**Question 19 for every build** (P6), no longer only when the clear skill is limited (`patterns.md`:57–58;
`D1-build.md`'s "Answer question 19", :138–139). Its text: "19. Bosses. What does the build press on a boss? When the
clear skill is capped by a limit or shaped for packs, name the boss button. (Spud's Warcryer: Hammer of the Gods on
its own weapon set)".

**The enemy's side** (D1), a new family section with: Resistance below zero; The damage-taken pool; and the changes to
existing entries: "A gained slice keeps its type" filed in section 4; Saturated type count gains Yoke of Suffering and
slices of each element from different slots (absorbing "Ailment variety as a multiplier"); the Attacks kit's Levers
gain the global weapon prefixes a listing's DPS hides. Each entry needs an inversion branch, a line in its Search or
Cautions that starts "On a build that inverts resistance:": 8 of the 26 builds whose main damage has a resistance
invert it, and there resistance reduction, curses and exposure lower damage (`Modules/CalcOffence.lua`:4200–4201).

**The stale deflection lines.** P9's line gives both accuracies, 2,357 for the map enemy and 3,786 for the Arbiter
(`patterns.md`:76–80). Deflection beside evasion (:1345–1357) and EHP over its target but one-shot (:1418–1436) give
the Arbiter's figures (79.6%, 78% and 45% of slams survived) in place of "84% deflect… about 16% of slams", name the
80% floor and the gate's deflected hit, and drop "never more evasion" (:1426) and the Caution's "which never fixes a
one-shot" (:1436): under the floor evasion counts.

**The trim** (L1; the user chose one trim on the final text, 2026-10-26). In the same unit as the additions, after
them, so no gate sees the untrimmed total: one pass over every entry and kit that cuts a point made both in an entry
and a kit line (the kit keeps a pointer), cautions repeated across entries, sentences that restate a skill step, and
examples beyond what an entry needs. It keeps the tests' structure (the family list, a field's text on its own line,
cited source keys, the kits preamble's last line), every string a test outside the unit's touches pins, and every
entry another file cites by name, unless the citation moves with it.
- **The caps:** the tests keep their provisional 16,000 words for the library and 4,000 for the kits. Over them after
  the trim, the unit stops with the counts (HG-24); the user sets the caps, provisional or final, and WU-123 raises the
  tests' caps to them and merges. The final caps that replace **amendment 9's 13,000** (§24.1, recorded as superseded)
  wait for the milestone's end.
- **Exact-list tests change with the unit** (gap 36): the question sections and their titles, the family list (12
  with the enemy's side), the kits.

Amends C-53, D-410 and amendment 9 §24.1's cap, `patterns.md`, `R1a-synthesize.md` step 5, `R1a.md`'s questions,
`D1-build.md`'s question lines, the tests that pin them.

## 14. D-459: the guide's defence lines

W1 and the two guide templates:
- **The verdict label** (D-353, with §4), from the deciding row, on `b` and `n`, in three forms (Appendix A): it
  survives every hit in full; it survives x% of the deciding row's hits, clearing the floor; or it is one-shot, with
  the share it survives when above 0.
- **The same three forms everywhere the verdict prints:** the audit's Checks block (`render-audit.mjs`'s
  `arbiterLine`, :538–545, and `audit-template.md`:60, which both guide templates copy), the final gate's rung lines
  and the design-to-final comparison (`run-log.mjs`'s `arbiterWords`, :1277–1290). Today they print "one-shot"
  whenever the ratio is 1 or more, from `worst`.
- **What PoB can't show** gains, each once and only when it applies: the design gate's warning in plain words (§4);
  for a deflecting build, what deflection does (the big hit past evasion loses 40% most of the time, which PoB's max
  hit ignores) and its average cut to ailment damage (PG-97); and, when the defence leans on recoup, regeneration,
  leech or recharge, that EHP leaves them out by PoB's design (gap 25).
- **How to play it** (P8) gains one line naming the first thing to change if the build stalls, and one optional line
  on defence the gate can't see (dodge timing, flasks, recharge delay, stun risk, blind upkeep).

Amends D-353's label, `W1.md` steps 4, 11 and 12, both guide templates (:148, :160–172), `audit-template.md`:60,
`render-audit.mjs`, `run-log.mjs`'s `arbiterWords`, `V4.md`'s checks of those lines, `check-run.mjs`'s label check.

## 15. D-460: tool fixes

Each tool does what its description says. The user's approval of this amendment grants HG-12 for these changes, for
M-25's build only (§24).
- **B1, `get_node_power` with `TotalEHP` first** returns "result: Invalid input" on 8 of 30 builds. The reply schema is
  a union at `result` (`src/engine/schemas.ts`:1746), and `EngineContractError` (`src/pobLuaBridge.ts`:149–157) prints
  only the top issue. First the error names each union member's failing path; then the unit reproduces the failure
  locally on the user's private guide library's failing builds, records the failing field in the work-log, fixes it,
  and builds a fixture of its own (not a copy of a library file), which it records failing before the fix. When no
  committable fixture reproduces it, the unit records the raw reply and the failing path and stops (HG-26).
- **B2, `lookup_game_data` with no `kind`** fails the same reply check on queries that match a game constant
  (`Data/Misc.lua`'s `BasePercentDamageDeflected` and `can_evade_spells`: the queries "Deflected" and
  "can_evade_spells"). Not reproduced from the code (a constant hit parses, `lookupHitSchema`); the same error fix
  shows the failing element, then the fix.
- **B3, radius jewels** (a test compile first, gap 39): the connection check (`check_tree`'s `reach`,
  `Compile.lua`:437–536, run by `check_stage` in `compile_check`, :1278–1289) works on static tree data, so a node that
  a socketed From Nothing, Controlled Metamorphosis or Voices allocates without a path is refused, though PoB allows it
  (`Classes/PassiveSpec.lua`:1378–1380, :1469–1471, :1887–1888). The check adds the radius nodes of the stage's radius
  jewel (`check_stage` already parses `st.jewels`, :867–879), V1's `tree-shape` accepts them, and `build_tree` sockets
  the jewel before the radius nodes need it (today it imports the tree first, :1418–1427). Node power ignores nodes
  already disconnected (`NodePower.lua`:713–716) and needs no change. 12 of 30 reference builds carry such a jewel.
- **B4, `lua_get_stats`' defence category** (`src/handlers/luaHandlers.ts`:386–396) gains the fields in Appendix A:
  the not-hit and damage chances, evade by hit kind, deflection's effect, hits to die, the stun threshold and self-stun
  chance, the companion's life. A figure PoB has no single output for (the damage-from-mana-first share, a barrier's
  size, the physical-taken-as table) goes in PG-82's list instead.
- **B5, coverage's false "possibly unread" flags** on Hyrri's Ire's doubled evasion, Obsessive Rituals' Sorcery Ward
  grant and Ceremonial Ablution: the unit traces the three and fixes the scan (`pob-api/API/Coverage.lua`:160–253,
  `src/engine/pobSourceNames.ts`) so they read as read. No allowlist entry.
- **B6, `load_config_preset`** clears a checkbox the preset doesn't hold to false (`src/handlers/configHandlers.ts`:
  133–136), though the tool promises PoB's default (`src/server/toolSchemas.ts`:1253). The handler sends `''` for every
  cleared option, and the bridge's config writer (`pob-api/API/BuildOps.lua`:874–890), which refuses `''` for a
  checkbox today, sets the option's `defaultState` (PoB's default, `Classes/ConfigTab.lua`:981), as it already resets a
  list or a number.
- **B8, `update_tree_delta`** auto-paths an added node along PoB's path even through weapon-set nodes, then refuses
  (`BuildOps.lua`:661–690, :742–753), and prints only a count (`luaHandlers.ts`:645–647). It auto-paths an untagged
  node through untagged nodes only (PoB's own rule, `CanPathThroughAllocMode`, as `Compile.lua`:520–521 states it), and
  lists each auto-pathed node by name and id; AC-K37's line (`tests/integration/treeState.test.ts`:441) takes the new
  form. **`find_path_to_node`** (D-360), which D1-tree paths with, gets the same rule (`src/services/treeService.ts`'s
  `findShortestPaths`); its arguments and output format are unchanged.

Amends C-55, C-37, C-38, C-45, C-48, D-360's path tool, AC-K37 and `load_config_preset`'s handler; the README table
for the descriptions that change.

## 16. D-461: the trade limiter's pace

B7 (the user, 2026-10-26: "we need to update our search policy"; the answers of 2026-10-27). The limiter
(`src/trade/rateLimiter.ts`, unchanged since WU-98) enforces the windows the site's headers state, and a search inside
them still drew a 429. This **amends D-422** (the 429 was to be investigated and ours fixed) and C-11.
- **The pace floor:** a search request (endpoint `search`, either request kind) is sent no sooner than 45 s after the
  previous search's send, and at most 7 searches go in any 300 s. `earliestSendTime` (:377–404) applies both beside
  the site's windows. Listing fetches don't wait on the floor. The state is per server process, as today. Both are
  limiter options the server deps set (`createServer.ts`:187 builds the limiter): on in `src/index.ts`, off or on a
  fake sleep in test servers (`tests/helpers/server.ts`, `spawnServer`) and trade tests, so a test can check the cap
  with the floor off.
- **The wait cap** rises from 30 s to 60 s in both places: the limiter's `DEFAULT_MAX_WAIT_MS` (:135) and
  `find_upgrades`' own `SEARCH_MAX_WAIT_MS` (`src/trade/findUpgrades.ts`:65), which it passes on every request (:694)
  and which today turns a 45 s wait into `would_wait`. A call waits for the floor inside the call; a wait over 60 s is
  `would_wait`.
- **`find_upgrades`' budget** (`FIND_UPGRADES_BUDGET_MS`, `src/server/toolRouter.ts`:82) stays 90 s (the user's
  revised answer, 2026-10-27; a growing budget would pass 120 s, where Claude Code backgrounds an MCP call, A-25). The
  deadline runs from the call's arrival (:199), and the limiter sends a search only with at least 1 s left
  (`rateLimiter.ts`:348–350), so a call makes at most two searches, usually two: one only when it starts within 1 s of
  the previous search or its engine steps run long. When the gap cuts the weight-adjust loop (at most 5 searches,
  `MAX_SEARCHES`) short, the call still fetches the best listings of the searches it ran, even when the site's count
  called for another narrowing search, and its stop line says the gap cut the loop short after how many searches. The
  deadline bounds the whole call at about 90 s (R-52). The description says so (C-14).
- **The 429 log:** each 429 appends one JSON line to `<stateDir>/trade-429.jsonl` (C-16): the time, the endpoint and
  request kind, the rate-limit headers (rules, limits, state), Retry-After, the lockout applied, and the limiter's own
  count in each window (what `describe429`, :452–472, prints today). Never a cookie, `POESESSID` or any request header.
  Appended, never rewritten whole, it is trimmed lazily to its last 200 entries. A log error (a missing folder, an
  unwritable or corrupt file) goes to stderr and never changes the call's result. The state dir reaches the
  limiter through the server deps (only `src/index.ts` reads the env, :24–38).
- **The pipeline:** the pricing steps keep running alone, each making one trade call at a time: parallel calls queue
  past the 60 s cap and come back `would_wait`. `pricing.md`'s pace says the limiter waits up to 60 s (today "refused a
  wait over 30 s", :187, :195). Before a pricing step, the runner tells the user that pricing starts, about how many
  searches, at least 45 s apart, and that their browser shares the limit.
- **CLAUDE.md's trade paragraph** is rewritten when this lands (gap 33), its pacing only: the server enforces the 45 s
  floor and 7 per 5 minutes, and the background-sleep pacing goes. Its other rules stay: the user's approval, one
  trade client at a time, telling the user before pricing, at most 30 searches without asking, and the stop on the
  first 429, `rate_limited` or `locked_out`.
- NFR-22 (no 429 or `locked_out` during pricing) is unchanged.

Amends D-422, D-160's "measured, not capped" (a cap now exists), C-11, C-14, C-16, `pricing.md`'s pace and its
`would_wait` row, `SKILL.md`'s pricing rule, CLAUDE.md's trade paragraph, the README's state-folder list.

## 17. D-462: the PoB gaps, and the fold

- **`docs/build-guide/pob-gaps.md`** gains, in a new section "Found in the defence study (2026-10-26)", PG-83 (Virtuous
  Barrier's motes aren't lost to hits), PG-84 (Pyromantic Pact's mana replacement unparsed), PG-86 (curses ignore their
  monster-level cap, with Frost Bomb's exposure and Thunderstorm's Wet), PG-87 (a gain keyed to one type reads it after
  gear conversions), PG-88 (a same-type conversion counts in the over-100% scaling), PG-89 (Yoke of Suffering counts
  Path of Exile 1 ailments), PG-90 (our enemies resist every element alike), PG-91 (the Arbiter verdict credits curses
  at map strength; fixed by §4, recorded closed), PG-92 (stun chance constants may be stale), PG-93 (Immaculate
  Adherence's Divinity lines unparsed), PG-94 (common defence lines PoB doesn't parse), PG-95 (Tailwind's deflection
  line never read), PG-96 (the hits-to-die count switches method when no chance layer is left), PG-97 (deflection
  doesn't cut ailment damage), PG-98 (enemy bleeding on the player is never modelled), PG-99 (crafted jewel effect
  lines unread), each in the file's skeleton (kind and status, Effect or Where, Seen in) as the candidate list states
  it, with a Workaround where the candidate gives one; and PG-100, which no candidate states: **ours, confirmed**
  (an approximation); Where: `CalcDefence.lua`:2959–2962, a companion's share of deflected hits already in PoB's max
  hit, so hits survived counts deflection partly twice and errs optimistic at the floor; Seen in: none of the 30
  (Forgotten Warden is the only source in the pinned data); Workaround: when a build carries the line, the gate adds
  one note that its hits survived is optimistic (§4). PG-85 is dropped (the user trusts PoB's block reading) and its
  number skipped. PG-82 gains B4's figures no tool exposes. The sizing study already cites PG-86 and PG-99.
- **Amendment 11's status paragraph** (its lines 3–10) still says it waits for approval; it was approved and built
  (work-log). The pob-gaps unit corrects it.
- **At integration** the coordinator writes V1's table rows (`curse-level-cap`, `custom-defence`, `tree-continuity`'s
  schema scope) into `02-plan-compiler.md`, and HG-23 to HG-26 into the spine's §6.3.

## 18. Costs

Baseline, amendment 11's open-brief run (output tokens): R1a 1.14M, R1b 683K, D1 1.59M for five design attempts.
Estimated changes, for a run with two builds:
- the toughness reading, the Arbiter's chances and the resisting figure: engine time (two more passes on `n`, one on
  `b`), no tokens; the design display, about +5K;
- the defence trade: about +30K a one-shot rung; the avoidance trade on `b` and `n`: about +25K an evasion build;
- one tree per loadout: D1-tree's node power calls take longer (R-48); about −5K a build, less respec handling;
- jewel sockets: up to 3 socket tests on each of two rungs and up to 8 line measures, about +40K a build;
- the wall rule: about +30K a build when a rung fails and other means are searched;
- questions 20–24: about +10K a researcher, +30K a brainstorm round; the trimmed library reads no dearer;
- the levers, Wither, weapons and ailment rules, and the trades' boss measures: about +10K a build;
- the pace floor: about 20 searches for two rungs take at least 15 minutes of wall time; no tokens.

About +170K to +270K on a two-build run with no failing rung, more with one-shot rungs and failed rungs.

## 19. Work units (M-25)

| Unit | What | touches |
|---|---|---|
| WU-117 | Tool fixes: B1 and B2 (the union error first, then repro and fix), B4, B5, B6, B8 with `find_path_to_node` | `src/pobLuaBridge.ts`; `src/engine/schemas.ts` (the `node_power` and `lookup` replies only); `pob-api/API/NodePower.lua`, `Lookup.lua`, `Coverage.lua`, `BuildOps.lua` (the tree delta and the config writer); `src/engine/pobSourceNames.ts`; `src/handlers/luaHandlers.ts`, `configHandlers.ts`, `treeHandlers.ts`; `src/services/treeService.ts`; `src/server/toolSchemas.ts` (`lua_get_stats`, `update_tree_delta`); the README table; `tests/fixtures/tool-calls.json`; `tests/integration/contract.test.ts`, `treeState.test.ts` and the tools' tests |
| WU-118 | The trade limiter: the pace floor and the 7-in-300 s cap as options, the 60 s caps (`DEFAULT_MAX_WAIT_MS`, `SEARCH_MAX_WAIT_MS`), `find_upgrades`' budget and stop, the 429 log, CLAUDE.md's rule | `src/trade/rateLimiter.ts`, `src/trade/findUpgrades.ts`, `src/server/toolRouter.ts`, `src/server/createServer.ts` (the options, the 429 sink), `src/index.ts`, `src/server/toolSchemas.ts` (`find_upgrades`), the README table and state-folder list, `CLAUDE.md`'s trade paragraph; `tests/helpers/server.ts`, `spawnServer.ts`; `tests/unit/rateLimiter.test.ts`, `findUpgrades.test.ts`, `findUpgradesDated.test.ts`, `tradeClient.test.ts`, `tradeRateLimitKinds.test.ts`; `tests/mcp/findUpgrades.test.ts`, `findUpgradesBounds.test.ts`, `searchTradeItems.test.ts`, `itemPrice.test.ts`, `tradeLazyStats.test.ts`; `tests/static/readme.test.ts` (CLAUDE.md's rule) |
| WU-119 | Plan schema 8 and V1: `stages[].defence`, `respec` refused on 8, `tree-continuity` on ≤ 7, `predecessorOf` skipping `tmp` stages, `treeChange`, `curse-level-cap` with its Lua read, `custom-defence` with the parsed custom lines, both on ≥ 8, B3 after its test compile | `src/plan/schema.ts`, `src/plan/checks/v1.ts`, `src/plan/compiler.ts` (predecessor, `treeChange`), `src/plan/record.ts` (`StageRecord.treeChange` only), `pob-api/API/Compile.lua` (`stage_gems`, the custom lines, `check_stage`'s radius nodes, `build_tree`'s order), `src/engine/schemas.ts` (the compile reply's `checks`), `docs/build-guide/plan-reference.md` (the plan part), plan fixtures and tests (`tests/unit/planSchema*.test.ts`, `planCompanion.test.ts`, `planNeeds.test.ts`, `tests/static/planReference.test.ts`, `tests/unit/v1*.test.ts`) |
| WU-120 | The compiler's measures: the G9 spike, then `measures.toughness`, the conditioned read, the Arbiter on the Pinnacle pass with `avoid`, hits survived per hit and the rows' fields, the immune types, `measures.damage.resisting`, the key-figure line | `pob-api/API/Compile.lua` (`measure_boss`, the conditioned and resisting passes, `output_map`'s immune list), `src/plan/record.ts`, `src/plan/compiler.ts` (the measure params, :956–958, and `keyFigureLine`), `src/engine/schemas.ts` (the compile reply's measures), `docs/build-guide/plan-reference.md` (the record part), `tests/integration/compileMeasures.test.ts`, `compileBossMeasure.test.ts`, `compilePlanNfr.test.ts`, `compileSkeletonPace.test.ts`, `compileMovementTier.test.ts` (its measures shape and `measures.arbiter` comparison), `tests/unit/planMeasures.test.ts`, `planPace.test.ts`, `planBossMeasures.test.ts`, fixtures (copies of the Arbiter's data: an `evadable` case, a chaos hit) |
| WU-121 | Scripts: the displays and checks of §4, §5, §7, §9 and §14; revisions by order and `skillRevision` 12; trade fields by revision; the targets file | `scripts/run-log.mjs` (with `arbiterWords`), `scripts/check-run.mjs`, `scripts/render-audit.mjs` (with `arbiterLine`), `references/toughness-targets.json`, `references/run-log.md`, `references/run-folder.md`, `tests/fixtures/pipeline/`, `tests/unit/buildGuideCheckRun.test.ts`, `buildGuideAmendment11.test.ts`, `buildGuideSchema4.test.ts`, `buildGuideResumeNoNinja.test.ts`, `buildGuideScripts.test.ts`, `tests/static/buildGuidePiecesMeasured.test.ts`, the script-side assertions of shared static tests |
| WU-122 | `docs/build-guide/pob-gaps.md` (PG-83, 84, 86–100, PG-82's additions); amendment 11's status paragraph | `docs/build-guide/pob-gaps.md`, `docs/build-guide/spec/amendment-11-live-test-fixes.md` (lines 3–10 only) |
| WU-123 | The library: questions 20–24 and their section, question 19's text, question 2's means, the enemy's side, the section-4 and section-5 entries, the Attacks kit's Levers, the stale deflection lines; then L1's trim and its counts | `references/patterns.md`; `tests/static/patternLibraryEngine.test.ts`, `patternLibraryM22.test.ts`; the library `describe` blocks of `buildGuidePipeline.test.ts`, `buildGuideDesignPieces.test.ts` (with both question-19 `it`s), `buildGuideAmendment11Design.test.ts` |
| WU-124 | Research docs: the card's `Defence:` and `Means:` lines and no respec clause, R1a's questions 20–24 and the defence line, R1a-synthesize's question 22, R1b's checklist item 2 | `templates/card-template.md`, `references/stages/R1a.md`, `R1a-synthesize.md`, `R1a-assemble.md` (the card fields it checks), `R1b.md`, `.claude/agents/build-guide/build-guide-researcher.md` where it lists the questions; their `describe` blocks in `buildGuidePipeline.test.ts` (AC-W27, AC-W29), `buildGuideSynthesis.test.ts`, `buildGuideDesignPieces.test.ts`, `buildGuideAmendment11Research.test.ts` |
| WU-125 | Design docs: D1-build (the defence step, schema 8, one tree per loadout, needs per rung, the wall rule, questions 19 and 23, Wither, levers, ailment uptime, the curse cap line, `tmp` stages), D1-tree (keep, no ladder, sockets, jewel prices and lines, the boss guard), D1-finish (the trades, the avoidance trade, jewel shares and weapon prices), D1-gate (the design field), `checkpoints.md`'s design gate and revise paths, `gates.md`, D2, W1, V4, the guide and audit templates, `pricing.md`, `SKILL.md` within 325 lines | `references/stages/D1-build.md`, `D1-tree.md`, `D1-finish.md`, `D1-gate.md`, `D2.md`, `W1.md`, `V4.md`; `references/checkpoints.md`, `gates.md`, `pricing.md`; `templates/guide-template.md`, `guide-endgame-template.md`, `audit-template.md`; `SKILL.md`; their `describe` blocks in `buildGuideAmendment11Design.test.ts`, `buildGuideD1Tree.test.ts`, `buildGuideEndgameGuide.test.ts`, `buildGuidePipeline.test.ts`, `buildGuideDesignPieces.test.ts` (D1-build's `it`) |
| WU-126 | The live test, the user's, with the coordinator, after M-25 is built; it covers amendment 11's WU-116 too | the work-log |

**Spikes first,** each its unit's first step, recorded in the work-log: G9's deflected ratio (WU-120: whether a
measure pass can make deflection certain); B1 and B2's repro after the error fix (WU-117); B3's test compile (WU-119).

**Order.**
- **The build doesn't wait for WU-116** (amendment 11's live test). The user, at approval (2026-10-28): "I won't do
  any live tests until the amendment is built." WU-116 runs as part of WU-126, after M-25: a revision-12 run is held to
  amendment 11's rules too (§22).
- **Wave 1:** WU-117, WU-118, WU-119, WU-120 and WU-122 in parallel, the formats fixed by Appendix A.
- **Wave 2:** WU-121 (it can start in wave 1 against Appendix A's formats, and rebases onto WU-119 and WU-120), WU-123
  (after WU-122: the library cites PG ids, and the pipeline test checks each exists), and WU-124 (after wave 1; it
  merges after WU-123, which owns the question-19 `it`s, so HG-24 holds it too).
- **Wave 3:** WU-125, after WU-121 merges: single `it`s run its docs' examples through WU-121's scripts
  (`buildGuideAmendment11Design.test.ts`:215–228, :310–321, :370–388; `buildGuidePipeline.test.ts`:940–955).
- **Then WU-126.**

**Shared files and how they split:**
- `src/server/toolSchemas.ts` and the README table: WU-117 (`lua_get_stats`, `update_tree_delta`) merges first;
  WU-118 (`find_upgrades`, the state-folder list) rebases, or merges first while WU-117 is stopped at HG-26.
- `src/engine/schemas.ts`: each unit edits only its actions' schemas (WU-117 `node_power` and `lookup`; WU-119 the
  compile reply's `checks`; WU-120 its measures); merged by rebase, WU-119 before WU-120.
- `pob-api/API/Compile.lua`, `src/plan/compiler.ts`, `src/plan/record.ts`, `docs/build-guide/plan-reference.md`:
  WU-119 owns `stage_gems`, the custom lines, the connection check, the predecessor, `treeChange` (`StageRecord`) and
  the plan part of the reference; WU-120 owns the measure passes, `output_map`, `keyFigureLine`, the rest of
  `record.ts` and the record part. WU-119 merges first; WU-120 rebases.
- `pob-api/API/BuildOps.lua`: WU-117 only.
- `checkpoints.md`, `pricing.md`, `SKILL.md`: WU-125 only. `card-template.md`, `R1b.md`: WU-124 only.
- Shared static test files are edited by `describe` block: each unit changes only the assertions on its own files
  (amendment 11 §16's rule). An `it` that runs a doc's example through a script is WU-125's; the question-19 `it`s of
  `buildGuideDesignPieces.test.ts` (:349–361, :383–394) are WU-123's.

## 20. Acceptance criteria (M-25)

- **AC-K73 (WU-117).** Engine and in-process MCP:
  - a contract test with a `node_power` reply that fails every member of its `result` union prints each member's
    failing path in the error;
  - `get_node_power` with `stats: ["TotalEHP", "MainDamage"]` on the unit's repro fixture returns a result, not
    "Invalid input"; the work-log records the fixture failing before the fix and the failing field (or, at HG-26, the
    raw reply and the failing path);
  - `lookup_game_data {mode: "mechanic"}` with no `kind` returns its hits, the constant among them, for the query
    "Deflected" and for "can_evade_spells";
  - `lua_get_stats {category: "defense"}` on the golden build prints every Appendix A field PoB sets on it, each equal
    to the loaded build's PoB output; a companion fixture prints the two companion fields;
  - `check_model_coverage` on Hyrri's Ire, the Obsessive Rituals node and Ceremonial Ablution reports none of their lines
    `possibly unread`; `tool-hygiene-allowlist.json` stays `[]`;
  - `load_config_preset` with a preset lacking a checkbox PoB defaults to on leaves it on, and a checkbox the build set
    on that PoB defaults to off goes off;
  - `update_tree_delta` adding an untagged node whose shortest path runs through an allocated weapon-set node, on a
    fixture with an untagged path, allocates it along untagged nodes with no refusal, and its output names each
    auto-pathed node with its id; AC-K37's assertion reads the new line;
  - `find_path_to_node` to the same node returns a path through untagged nodes only.
- **AC-K74 (WU-117).** The README table equals `pnpm docs:tools`' output; `tool-calls.json` holds a sample for each
  changed tool; AC-B2, AC-B3 and AC-B5 hold.
- **AC-K75 (WU-118).** Unit tests with a fake clock and `fixtureFetch`:
  - a search 10 s after another is sent 45 s after the first's send; a fetch isn't held by the floor;
  - with the floor off, 7 searches sent in 300 s hold an 8th until the window admits it;
  - a needed wait of 50 s is waited, under the limiter's default and under `find_upgrades`' own cap; 61 s is
    `would_wait`;
  - a `find_upgrades` call arriving 10 s after another call's search makes 2 searches, 45 s and 90 s after that
    search, within its deadline; one arriving 0.5 s after a search makes 1, starts none after its 90 s deadline,
    returns the best listings of that search though its count called for narrowing, and ends with the stop line
    naming 1 search and the gap; a loop that wants 3 searches runs at most 2;
  - `find_upgrades`' description states the 90 s budget and the 45 s gap;
  - a 429 appends one line to `<stateDir>/trade-429.jsonl` holding the rate-limit headers, Retry-After, the counts, the
    time and the request kind; a request sent with a sentinel cookie leaves no trace of the sentinel in the file; after
    205 429s the file holds the last 200; a log that can't be written leaves the call's result unchanged;
  - a static test finds in `CLAUDE.md`'s trade paragraph the server's 45 s floor, the user's approval, one trade
    client at a time, telling the user before pricing starts, the 30-search cap and the stop on the first refusal,
    and no background-sleep rule.
- **AC-P82 (WU-119).** Plan and engine, on fixture plans:
  - a schema-8 plan with `respec` errs at `stages[n].respec`; `stages[].defence` is accepted on 8 and errs at its path
    on 7; a schema-7 plan's record keeps every field but `measures.arbiter` equal to `record-before-schema8.json`,
    made before the change;
  - a schema-8 plan whose `b` drops nodes of `m` has no `tree-continuity` finding, and the same trees at schema 7 have
    one; `b.treeChange` equals the counts of nodes `m` holds that `b` doesn't, and the reverse; a `tmp` stage
    (`tmpb1`) that copies `b` is not `n`'s predecessor;
  - Elemental Weakness at gem level 16 on `b` (area 79) is `curse-level-cap`, naming cap 76; at level 18 it isn't, nor
    at 16 with +2 levels from gear; at level 16 on `m` (area 69) it isn't; Despair at level 14 on `m` isn't and on `b`
    is; a Frost Bomb whose exposure cap is below 79 is, on `b`, naming the exposure; a campaign stage is checked
    against its `area-level`; a card skeleton is skipped;
  - a custom line "+1000 to maximum Energy Shield" whose reason has no `coverage:` result is `custom-defence`; with
    `coverage: unparsed` in its reason it isn't; a custom damage line never is;
  - neither new code runs on a schema-7 or older plan: `two-stage-count`'s findings are unchanged.
- **AC-P83 (WU-119).** B3: the work-log records the test compile; a fixture stage with From Nothing socketed and a node
  inside its radius, unlinked to the tree, passes `compile_check` and compiles with no connection defect and no
  `tree-shape` finding; the same node without the jewel is refused as before. `plan-reference.md` equals the schema
  (`planReference.test.ts`).
- **AC-P84 (WU-120).** Engine, on fixture builds:
  - `measures.toughness.lowestMaxHit` equals the least of the five `<Type>MaximumHitTaken` with its type; a Chaos
    Inoculation fixture records `immune: ["chaos"]` and its lowest max hit from the other four; with a fixture copy of
    the Arbiter's data holding a chaos hit, that row is `survives`, ratio 0, `immune: true`, with a non-null verdict;
  - `measures.toughness.chance` equals the formula on the record's `ConfiguredNotHitChance` and
    `ConfiguredDamageChance`;
  - on `n`, `conditioned.ehp` equals `TotalEHP` in a separate compile of the stage with the four options set as §4
    says; the saved file's config set and `configWritten` equal a compile without the pass;
  - on a fixture that curses with Enfeeble, the Arbiter physical ratio is above the map measure's ratio for the same
    hit; `measures.arbiter` reads the Pinnacle pass's max hits, on the stage's own weapon set on a fixture with a boss
    group on set 2;
  - on a fixture with evasion and deflection, `avoid.evade` and `avoid.deflect` equal PoB's formulas at accuracy 3,786
    on the build's `MeleeEvasion` and `DeflectionRating`; `hitsSurvived` equals Names' rule on the row's
    `deflectedRatio`; a stage with neither has no `avoid`; with a data copy whose slam carries `evadable: false`, the
    slam's row counts an evade chance of 0 and the other rows don't change; when the unevadable hit is the type's
    smaller one, the row's `hitsSurvived` is that hit's;
  - `measures.damage.resisting` equals the named source's figure in a separate compile with enemy fire, cold and
    lightning resistance 40; a cold-damage fixture reads it below `damage.map`, a chaos-damage one equal to it;
  - the key-figure line carries the lowest max hit, the resisting figure and, on a rung with `avoid`, hits survived,
    in Appendix A's form;
  - after a compile with the deflected-ratio pass, `data.misc` holds its values from before.
- **AC-P85 (WU-120).** The work-log records the spike's method (`pass` or `formula`), and `avoid.method` holds it; NFR-21
  holds with the new passes on `schema6-ladder`, which has `b` and `n` (each stage request under 20 s), and the
  work-log records the compile time before and after.
- **AC-W93 (WU-121).** Script unit, on fixture runs:
  - a row one-shot at ratio 1.01 with hits survived 79.6% is a one-shot rung and displays 79%, and at 80% isn't; a row
    with no deflection and 80% evade isn't; a row whose deflected hit kills counts only the evade chance; beside a
    lightning row at 1.2 that clears on evasion, a physical row at 1.05 under the floor decides; the checker fails a
    design field whose `oneShot` or deciding row disagrees;
  - a one-shot rung (`b` or `n`) with no `defence` entry fails; with `none found: …` it passes; a damage trade on a
    one-shot rung with `maxHit.after` below `before` fails; an evasion build's `b` or `n` with no `avoidance` entry
    fails; a revision-12 build's trade without `maxHit` fails, and a revision-11 build's 7-field trade passes;
  - the warning: within the band and one-shot gives the one-shot warning; a conditioned EHP under the band gives the
    conditioned warning; neither gives none; a field's warning that disagrees fails;
  - the design display prints the Arbiter line with hits survived, the lowest max hit on `b` and `n`, and on `n` the
    chance-layer share, the conditioned line, the ailment line on a deflecting build and the warning, and PG-100's
    note on a companion build, in Appendix A's forms;
  - the resisting figure prints on the design and final gates and in the audit's stage table; a guide verdict line with
    three figures passes against the record, and an old guide's two-figure line against an old record;
  - a revision-11 log (`run-a11`) passes unchanged and keeps amendment 11's rules from its own boundary; a revision-11
    log resumed at 12 keeps 11's boundary and gains 12's; a log from before amendment 11 resumed at 12 gains both
    boundaries at the same lengths, so its earlier entries are held to neither amendment's rules;
  - in a `skillRevision: 12` run, a schema-8 plan's `n` without `defence` fails and a schema-7 plan's passes; a
    D1-tree `respec` outcome fails; an old run's `respec` route passes;
  - a guide's tree-change line whose counts differ from `treeChange` fails;
  - the verdict label's three forms pass against the record and the targets file, and a label that disagrees fails;
    the audit's Arbiter line, the final gate's rung lines and the design-to-final comparison print the same forms;
  - `references/toughness-targets.json` holds the Arbiter floor 0.8, and the checker reads it.
- **AC-W94 (WU-122).** Static: `pob-gaps.md` holds PG-83, PG-84 and PG-86 to PG-100, each with its kind and status,
  and a workaround where the candidate list (for PG-100, §17) gives one; no PG-85; PG-82 lists B4's unexposed
  figures; amendment 11's status paragraph says it was approved and built.
- **AC-W95 (WU-123).** Static and unit:
  - `patterns.md` has the section "Brainstorm questions 20–24" with questions 20–24 as §13 numbers them; question 19
    has §13's text; question 2 names the means;
  - the enemy's side is a family with Resistance below zero and The damage-taken pool, each with the five fields and an
    inversion branch in §13's form; "A gained slice keeps its type" is in section 4, "A proxy presses the button" in
    section 5; Saturated type count names Yoke of Suffering; the Attacks kit's Levers name the global weapon prefixes;
  - P9's line gives both accuracies; no line gives "84% deflect", "never more evasion" or "never fixes a one-shot";
    the one-shot diagnosis entry names the 80% floor;
  - after the trim the library is at most 16,000 words and the kits at most 4,000, or the caps the user set at HG-24;
    the work-log records both counts; the family list is 12; every entry heading that another skill file named before
    the trim still exists.
- **AC-W96 (WU-124).** Static, one assertion each: the card template has `Defence:` (base family, layers by role, what
  holds the Arbiter's physical hit, names only) and `Means:`, and its Needs line no respec clause; R1a asks questions
  20–24 and writes the defence line from the class's attributes; R1a-synthesize asks question 22 for an open
  ascendancy, with the split or successor rule; R1b's checklist item 2 cites PoB's per-hit chance or buildup and the
  5-hit rule.
- **AC-W97 (WU-125).** Static, one assertion each, on the D1 stages:
  - `D1-build.md` has the defence step (family from attributes and its cost, `stages[].defence`, deflection valued by
    hits survived, conditions under hits, the custom-defence rule), writes `schemaVersion: 8` and moves an edited plan
    to it, seeds each rung's tree, writes a need on every rung that holds it (deflection among the cases), marks no
    respec, names temporary stages `tmp`, and states the wall rule, `stronger structure:` in `pieces.md`, questions
    19 and 23, the Wither rule, the budget levers and the two left out, the ailment uptime rule and its source, and the
    curse cap line;
  - `D1-tree.md` keeps needs only, passes no `protect_for`, has no ladder propagation or `respec:` return, tests jewel
    sockets within 4 points (at most 3 a rung) against the weakest list on `MainDamage` and `TotalEHP` with the 2%
    guard, measures at most 8 line candidates, gives `b` 3 middle-roll lines and `n` 4 top-roll ones, no crafted line,
    writes each jewel's `prices[]` entry and the lines in `pieces.md`, and undoes a move of its own (never a user's
    request or a taken trade) that cuts any boss-rotation entry by more than 2%, with the boss need's own claim;
  - `D1-finish.md` writes the one-shot defence trade (pool lines, avoidance sources, tree moves; clearing entries first,
    pool lines first among them), keeps needs only, applies the damage trade's max-hit rule on the Pinnacle pass,
    writes the avoidance trade on `b` and `n` with its spend and gear option, measures each trade's boss-rotation
    entries for its `bossAfter` and names a cut over 2% in its cost line, re-splits `n`'s shares, and re-checks
    weapons;
  - `D1-gate.md`'s design field holds `maxHit`, the toughness additions and `damage.resisting`.
- **AC-W98 (WU-125).** Static, one assertion each, on the gates, guide and skill: `checkpoints.md`'s design gate shows
  §4's lines, the resisting figure, the trades and `stronger structure:` and `jewel:` lines, and a respec request is a
  tree request; `gates.md`'s tree part passes needs only; `D2.md` has no respec rule for schema 8; `W1.md` and both
  templates carry the tree-change line, the verdict label's forms (the copied Checks block's too), the three figures,
  the defence lines of §14 and the play lines, the stall line required; `V4.md` checks the verdict label, the
  tree-change line and a custom defence line's coverage status; `pricing.md` states the weapon rule, the 60 s wait,
  one trade call at a time and the pricing notice; `SKILL.md` tells the user before pricing, has no `respec:` route
  for new runs, and is at most 325 lines.
- **AC-W99 (WU-126).** The live test: the user's judgment of the run, recorded in the work-log with the decisions it
  exercised (a one-shot rung and its trade, the avoidance trade, the floor, one tree per loadout, a socket, the
  resisting figure, the paced pricing) and those it didn't; D1-tree's node power times per rung; the longest
  `find_upgrades` call and how often the gap cut its loop short; any 429 and its log line; and whether anything in the
  run showed the Arbiter's slam to be unevadable (if so, the coordinator adds `evadable: false` to the data with its
  source).

**Test strategy.** The spine's classes (§12) apply. Engine-required tests (`engineDescribe`): AC-K73, AC-P82 to AC-P85.
Unit tests with fakes: AC-K75 and AC-P82's schema rows; AC-K75's `CLAUDE.md` row is static. In-process MCP: AC-K73's
tool calls and AC-K74. Script checks on `tests/fixtures/pipeline/`: AC-W93. Static tests over the skill and docs:
AC-W94 to AC-W98. Checked by the verifier, not Jest: the work-log rows of AC-K73, AC-P83, AC-P85 and AC-W95, and at
integration §17's rows. Human: AC-W99. No test makes a network request: HTTP only through `fixtureFetch`, and Jest's
setup makes global `fetch` throw (D-34). The golden values (AC-B5) hold: no default output changes.

## 21. Risks

| ID | Risk | Likelihood / impact | Mitigation |
|---|---|---|---|
| R-48 | One tree per loadout makes every node swappable, so node power's calls on each rung take longer | high / medium | D1-tree seeds each rung from the stage before; AC-P79's 90 s a call stands; AC-W99 records the times |
| R-49 | The deflected ratio has no proven mechanism | medium / medium | WU-120's spike; the formula fallback, labelled optimistic with armour on the gate |
| R-50 | B3 comes from reading the code | medium / low | WU-119's test compile first |
| R-51 | The trimmed library may still exceed 16,000 words | medium / low | HG-24: the unit stops with its counts, and the user sets the caps |
| R-52 | Under the floor a `find_upgrades` call makes at most two searches, so its loop often stops short of the listing count it wanted | high / medium | The 90 s deadline bounds the call at about 90 s, under A-25's 120 s; the best listings of the searches run (§16); AC-W99 records the longest call and how often the gap cut a loop short |
| R-53 | The pace floor makes pricing a two-build run take at least 15 minutes, and the user's browser shares the limit | certain / low | the runner announces pricing; the floor is the user's |
| R-54 | A specific boss move may be unevadable; every Arbiter hit is counted as evadable, since no source names one that isn't | medium / medium | the `hits.<id>.evadable: false` fact (§4) sets a hit's evade chance to 0; the live test checks the slam (AC-W99) |
| R-55 | The Arbiter's chances use PoB's melee evade formula, ignore blind and distance, and count a companion's share of deflected hits twice (PG-100) | medium / low | no blind is the ruling; block is out by the user's metric; the gate names the accuracy |
| R-56 | The conditioned read stacks four pessimistic settings, so many evasion builds warn (13 of 30 under the band) | high / low | a warning, never a failure; the band still reads `TotalEHP` |
| R-57 | One-shot trades multiply temporary compiles | medium / medium | up to 5 tree candidates and 3 entries a rung |
| R-58 | Socket tests and line measures add compiles to D1-tree | medium / medium | at most 3 sockets a rung and 8 line candidates a build, the lines kept in `pieces.md` |
| R-59 | B1's failing field may not reproduce on a fixture the unit can commit | medium / low | the error fix names the field; the unit records the raw reply and stops at HG-26 |
| R-60 | The Pinnacle settings (3% penetration, level 82) move the Arbiter's lightning rows on most builds, beyond the halved curses | certain / low | trust PoB (the coordinator's ruling, §4); the gate names the Pinnacle pass |

## 22. Migration and compatibility

- **Which rules a run is held to:** `run-log.mjs init` writes `skillRevision: 12`; a resume stamps 12 on an older log,
  with one boundary per revision in `skillRevisionFrom` (Appendix A). The scripts compare revisions by order, not
  equality (`heldFrom`, `run-log.mjs`:573–576; `check-run.mjs`:2352): amendment 11's rules hold from 11's boundary,
  this amendment's from 12's. A revision-11 log passes the checker unchanged and keeps its rules: its respec routes,
  two-figure verdict lines, design fields and 7-field trades. A build is held to the rules of its last D1 gate, as
  today (`check-run.mjs`:1693–1699).
- **Plans:** schema 8 adds `stages[].defence` and refuses `respec`. A schema-7 plan compiles as before, `respec` and
  `tree-continuity` included, but for its Arbiter rows (below); `curse-level-cap` and `custom-defence` don't run on it.
  In a revision-12 run D1-build moves any plan it edits to schema 8 (§7).
- **Records:** the new `measures` fields are additive; `RECORD_VERSION` stays 2. A record without them shows the old
  lines, and the checks fall back. The Pinnacle pass changes any recompiled plan's Arbiter rows, so AC-P82's equality
  leaves `measures.arbiter` out; the pin's golden values don't move (AC-B5).
- **Reference files:** `toughness-targets.json` gains `arbiter` (Appendix A); old readers ignore it, and the test that
  pins the file whole (`buildGuideAmendment11.test.ts`:592–593) is loosened to `toMatchObject` (WU-121). `trades.json`'s
  new fields are present in a build held to revision 12, `null` where they don't apply, and absent before.
- **Guides already written** keep their two-figure verdict lines and labels, read by their build's revision.
- **State dir:** `trade-429.jsonl` is new (C-16, additive).
- **Rollback:** each unit is its own commits on M-25's branch; nothing changes a user's builds.

## 23. Operational guardrails

- **Trade:** no agent sends a trade request during the build; test servers keep trade off (`spawnServer`). In the
  live test, one trade client at a time, through the session's server, the user told before pricing starts. CLAUDE.md's
  interim rule holds until WU-118 merges; then its rewritten rule.
- **The 429 log never holds the cookie** or any request header (AC-K75).
- **No agent contacts pathofexile.com** or sends a request carrying a cookie or personal data without the user; poe.ninja
  only through its documented economy endpoints, politely (D-297, D-335). Tests reach HTTP only through `fixtureFetch`.
- **The private library stays private:** B1's repro reads it locally; no file of it is committed, and no machine path
  enters the repository.
- **The builds folder is the user's;** probes run from a temp folder with temp `POB_DIRECTORY` and `XDG_STATE_HOME`.
- Never read `.env`; never set `POESESSID`.

## 24. Human-decision gates

| ID | Condition | Unblocks with |
|---|---|---|
| HG-23 | The build of M-25 starting: the user's approval of this amendment after the review; it grants HG-12 for §15's and §16's tool changes and the schema and record changes, for M-25's build only | the user's approval |
| HG-24 | WU-123's trimmed library over 16,000 words or kits over 4,000: the unit stops with the counts, which holds WU-124's merge | the user's caps, provisional or final; WU-123 raises the tests' caps to them and merges. The final caps that replace amendment 9's 13,000 come after the milestone |
| HG-25 | The live test, WU-126, after M-25 is built (it covers WU-116): live trade through the server, web research on D-171's hosts (HG-14) | the user starts it |
| HG-26 | B1's failure doesn't reproduce on a fixture WU-117 can commit: the unit records the raw reply and the failing path in the work-log and stops | the user's decision |

G9's floor, which the gap analysis left open, is decided (§4): 80% of hits survived, evasion and deflection alike, the
top roll kept.

## 25. Choices for the user, and proceed-on assumptions

**The user's answers and rulings:** the toughness reading (2026-10-26); one tree per loadout, campaign included
(2026-10-26); defence follows attributes (2026-10-26); deflection on evasion builds, pure or hybrid (2026-10-26); G2
deferred, PG-85 dropped, one trim (2026-10-26); one amendment, one milestone (2026-10-27); D2's resisting figure
(2026-10-27); P11's measure, show, judge (2026-10-27); B7's pace, cap and budget (2026-10-27), the fixed 90 s budget
being the user's revised answer to gap 31 that day, recorded in the gap analysis; G9's floor at 80%, evasion and
deflection alike, the top roll kept, and the floor's nuance (2026-10-27), superseding the 2026-10-26 ruling on builds
without deflection.

**Defaults the user saw** (2026-10-27, the gap analysis, without objecting), written above as decisions:
- every approved candidate in scope except G2, PG-85 and D9; P9 already in the library; G5 as G4's first case (§3, §4);
- the live test is the user's (§19). The default that the build waits for WU-116 was replaced at approval
  (2026-10-28): one live test after M-25 covers both amendments;
- one tree per loadout covers the campaign; gold a note (§7);
- §4's reading: G7 from the Pinnacle pass; the Arbiter's chances by our code from PoB's formulas at 3,786, no blind;
  the deflected ratio by a pass if PoB allows it, else the formula, after a spike; G3 inside G4 (the band on the
  build's own config, one conditioned read with all four settings); the chance-layer share with no extra read; the
  band and warning on `n`, the one-shot parts on `b` and `n`; the immune max hit recorded as immune;
- G1's candidates: node power's EHP swaps re-ranked by the failing type's max hit, pool lines on a temporary stage,
  avoidance sources on evasion builds, the damage trade's max-hit rule (§5);
- G6's `custom-defence`; G8's card line and `stages[].defence` on `n`, schema 8 (§6);
- T1's shape: `respec` dropped, `tree.scales` kept, `tree-continuity` on schema ≤ 7, keep = needs, no `protect_for`,
  seeded trees, the defence trade's keep, the guide's per-rung line with counts only (§7);
- T2's limits: 4 points, 3 sockets a rung, lines once per build, 3 middle-roll lines on `b`, 4 top-roll on `n`, no
  crafted lines (§8);
- D5 in D1-build step 7; D6's pricing rule; D7 reshaped (the enemy-side levers beside crit, never inversion on `b`;
  gap 8 named Rage with Berserk, a reliable shock, exposure and curses, so the ailment payoff and penetration are out);
  D8's 5 hits on the Pinnacle boss, the number flagged for the user (§11);
- P1's `stronger structure:` as a design-gate choice through the revise path or a successor card (§12);
- the question numbers 20–24 and their section; L1's order (additions then trim in one unit, the provisional caps, a
  stop over them); exact-list tests changing with their units (§13);
- the "What PoB can't show" note in the guide, not in `pob-gaps.md` (§14);
- B1 and B2: the error names the failing field, then repro and fix; B5: trace the three lines, no allowlist (§15);
- the 429 log's place, content and 200 entries; CLAUDE.md's rule rewritten when B7 lands (§16);
- plan schema 8; `RECORD_VERSION` stays 2; the record fields of §4 (§22);
- `SKILL.md` within 325 lines, routes paid for by trims (§19); the numbering and the divergences recorded.

**Proceed-on assumptions** (the drafter's and the review's, for the user's read):
- every Arbiter hit evadable unless its data says `evadable: false` (the coordinator's, after a web search for the
  user, 2026-10-27), the evade chance by PoB's melee formula (§4, R-54);
- the Arbiter verdict on PoB's Pinnacle settings as they are, 3% penetration and level 82 included, read after the
  stage's own weapon-set rebuild ("trust PoB", the coordinator's ruling in the review; §4, R-60);
- the deciding row; the fix family for a non-physical type and for the physical-lightning mix (§4);
- a companion's share of deflected hits as a known approximation, with the gate's note, PG-100 (§4);
- the one-shot trade's caps, 5 tree candidates and 3 entries, a clearing entry never cut for a non-clearing one (§5);
- the next avoidance spend: up to 20 tree points by hits survived per point, fewer when sources run out; a gear line
  as its own entry at its price (§5);
- "evasion build" read from `stages[].defence.base`, an enum of the bases' attribute families, required on `n` of a
  schema-8 plan (§5, §6);
- the `coverage: <status>` marker, the stats behind `custom-defence`, and V4's re-check of the status (§6);
- a tree request on a schema-7 plan through D1-build first (§7); the tree-change line with no gold figure (§7);
- the socket test against the weakest points with a 2% guard; `tmp` stages; at most 8 jewel line candidates, kept in
  `pieces.md`; `jewel:` lines outside the 8-line cap; a minion build's `b` jewel kept over target (§8);
- the resisting figure wherever the map and boss figures show (§9);
- the top 3 weapon listings re-checked; the ailment judgment from the gem text where no tool shows the chance; P2's
  guard per boss-rotation entry, on D1-tree's own moves, with a boss need's own claim (§11);
- B1's fixture built by the unit, not copied from the private library (§15).

## 26. The independent review and its resolution

The review (2026-10-27): four lenses with fresh context, read only (ground-truth fidelity about 347K tokens, invented
decisions 271K, task graph and criteria 316K, completeness and compatibility 283K), found 90 raw findings, clustered
into 37 plus low notes; two skeptical verifiers (237K and 256K), defaulting to "refuted", confirmed 18, partly
confirmed 16 and refuted 3. The coordinator re-checked three in the code: K9's `SEARCH_MAX_WAIT_MS`, K1's `heldFrom`
equality and K22's `pinnacleBossPen`.

| Cluster | Verdict | Resolved in |
|---|---|---|
| K1 revision 12 broke revision-11 runs | confirmed | §22, Appendix A, WU-121, AC-W93 |
| K2 schema-7 plans redesigned in a revision-12 run | confirmed (the D2 part refuted) | §7, §6, §22, WU-119, WU-125, AC-W93, AC-W97 |
| K3 false compatibility claims; V1 codes unscoped | partly (the severity part refuted) | §3, §6, §10, §22, AC-P82 |
| K4 HG-24's stop and the milestone | partly | §13, HG-24, AC-W95 (since revision 2, HG-24 holds WU-124's merge) |
| K5 the trim and pinned library strings | partly | §13's keep list |
| K6 old "one-shot" wording in the audit and final gate | confirmed | §14, Appendix A, WU-121, AC-W93, AC-W98 |
| K7 which max hit the trades compare | confirmed | §5 ("Which max hit"), Appendix A's trades |
| K8 per hit against per row; no defined row | partly (a mixed row's max hit refuted) | Names (deciding row), §4, AC-P84, AC-W93 |
| K9 `find_upgrades` under the floor | confirmed | §1, §16 (the user's answer), §25, WU-118, AC-K75 |
| K10 the floor broke trade tests; an unfailable cap test | confirmed | §16, WU-118, AC-K75 |
| K11 WU-125 beside WU-121 | confirmed | §19 (wave 3) |
| K12 `TRADE_FIELDS` exact; null against optional | confirmed | §22, Appendix A, WU-121, AC-W93 |
| K13 the targets file pinned whole | confirmed | §22, WU-121 |
| K14 the boss guard read the summed figure | confirmed | §11, §25 |
| K15 the socket test's comparison; no defence guard | partly | §8, §25, AC-W97 |
| K16 nobody wrote the jewels' price entries | partly (the over-target part refuted) | §8, AC-W97 |
| K18 B8 never reached the pipeline | confirmed | §15 (`find_path_to_node`), §8, WU-117, AC-K73 |
| K19 B3 in the wrong phase | partly (node power needs no change) | §15, AC-P83 |
| K20 a companion's deflection counted twice | partly | §4, §17 (PG-100), R-55 |
| K21 melee evasion for every hit; block undecided | refuted: disclosed (R-55); block is out by the user's metric | Names |
| K22 the Pinnacle pass sets penetration and level; set 2 | confirmed | §2, §4 (proceed-on), R-60, AC-P84 |
| K23 the curse cap's other stat ids and +levels | confirmed | §10, AC-P82 |
| K24 `jewel:` and `stronger structure:` lines kept nowhere | partly | §8, §12 |
| K25 the guide can't name the nodes to refund | partly | kept, a default the user saw (§7) |
| K26 `SKILL.md`'s 325 lines, no trims named | refuted: the user saw "routes paid for by trims" | none |
| K27 B1's criterion unpassable or vacuous | partly | §15, HG-26, AC-K73 |
| K28 concurrent 429-log writes; a failing log | partly | §16, AC-K75 |
| K29 `treeChange` and `keyFigureLine` homes | confirmed | §7, §4, §19's split |
| K30 question 19's text; its tests across three units | partly | §13, §19, WU-123, WU-125 |
| K31 rules with no criterion | partly | AC-K75, AC-P82, AC-W97, AC-W98 |
| K32 NFR-21's fixture had no rungs | confirmed | AC-P85 |
| K33 the immune row; null rows | partly | §4, WU-120's fixtures, AC-P84 |
| K34 the library's stale deflection lines | confirmed | §3, §13, WU-123, AC-W95 |
| K35 the one-shot trade's order departed from G1 | confirmed | §5 (G1's order restored, a correction) |
| K36 P11 narrowed to one undefined entry on `n` | partly | §5 (`b` and `n`, the spend defined), §25 |
| K37 workarounds the candidates don't give | confirmed | §17, AC-W94 |
| K38 deflection nodes as needs | refuted: the existing needs rule | §6 (named in the needs list) |

**Low notes folded** (§4, §5, §6, §7, §8, §11, §14 to §17, §20, §22, Appendix A): the 79.6% example and the rounding;
the ailment line's deflect chance; the coverage re-check; CLAUDE.md's clauses; P8's stall line; D7's levers; the
ailment chance's source; guides already written; the respec rows; temporary ids and stored jewel lines; AC-K37's
line; B2's query; B4's fields; B6's `defaultState`; the work-log rows; the inversion branch and cited names; the
README's state folder; the key-figure line; `vendor/` unmodified; amendment 11's lines 3–10; D-438's grow links; the
card's respec clause; the damage trade's uncheckable clause, dropped.

**Revision 2.** One re-check pass (fresh context, about 272K tokens) found 3 high, 5 medium and 3 low findings, all
folded: `tmp` ids of letters and digits (§8); the boss guard on D1-tree's own moves, and D1-finish measuring each
trade's boss entries, as P2 asked (§11); at most two searches a `find_upgrades` call, usually two, about 90 s (§16);
a boundary per revision at a resume (Appendix A); three measures-shape tests in WU-120; the avoidance spend (§5); the
last stale Caution (§13); PG-100 in full (§17); the budget as the user's recorded answer (§1, §25); HG-24 holding
WU-124, and WU-118 free of HG-26 (§19). D7's left-out levers are gap 8's default (§25).

## Appendix A. Formats

### The plan (schema 8)

- Added: `stages[].defence`: optional `{base: "armour" | "evasion" | "energy shield" | "armour/evasion" |
  "armour/energy shield" | "evasion/energy shield", chance, mitigation, pool, physicalHit}` (texts); the checker requires
  it on `n` of a schema-8 plan in a `skillRevision: 12` run.
- Removed: `stages[].respec` errs at its path ("a schema-8 plan has no respec: each loadout's tree is its own (D-452)").
- Kept: `tree.scales`, and every schema-7 field.
- Temporary stages' ids start `tmp`, letters and digits only (`tmpb1`); `predecessorOf` skips them.
- V1 input: `checks.gems[].curseCap`: `{cap, of: "curse" | "exposure" | "wet"}` or null, at the gem's effective level;
  `checks.customMods[] {text, modNames}`.

### The record (additions)

- On each variant stage: `measures.toughness {lowestMaxHit: {type, value} | null, immune: [<type>], chance: {notHit,
  damage, factor, share}}`; on `n` also `conditioned: {ehp, lowestMaxHit: {type, value} | null}`.
- On `b` and `n`: `measures.arbiter` rows from the Pinnacle pass, an immune type's row `{ratio: 0, verdict: "survives",
  immune: true}`; each row `deflectedRatio | null`, `deflectedVerdict | null`, `hitsSurvived` (0–100, the least over
  the type's hits); `measures.arbiter.avoid {accuracy: 3786, evade, deflect, deflectEffect, method: "pass" |
  "formula"} | absent`.
- On each variant stage: `measures.damage.resisting` (a number).
- On each stage of a schema-8 plan with a stage before it: `treeChange {from, refunded, added}`.
- The key-figure line, its parts joined by `; ` as today: the damage part becomes `damage <map> against map monsters,
  <resisting> against resisting rares, <boss> against a Pinnacle boss`; `lowest max hit <n> <type>` follows `EHP <n>`;
  `hits survived <x>%` follows the Arbiter part on a rung with `avoid`.

### The Arbiter's data (`data/enemies/arbiter-of-divinity.json`)

An optional fact per hit, `hits.<id>.evadable` (boolean, with its source, patch and confidence like every fact):
`false` makes that hit's evade chance 0 in the verdict; absent or `true` means evadable. No hit carries it today.

### `references/toughness-targets.json`

```json
{"rung": "non-budget", "targets": {"close": 20000, "distance": 15000}, "under": 0.9, "over": 1.5,
 "source": "studies/2026-10-25-toughness-floors.md",
 "arbiter": {"hitsSurvivedFloor": 0.8, "accuracyFact": "enemies/arbiter-of-divinity.json#base.accuracy",
             "source": "the user, 2026-10-27; studies/2026-10-26-sizing.md"}}
```

A rung is a one-shot rung when an Arbiter row is `one-shot` and its `hitsSurvived` / 100 is below `hitsSurvivedFloor`.

### The D1 gate's design field (additions)

Per `b` and `n` rung: `maxHit {lowest: {type, value} | null, immune: [<type>], arbiter: {type, evade, deflect,
hitsSurvived, deflectedRatio, method} | null, oneShot: true | false}`, `arbiter` from the deciding row, `oneShot` by
the floor. Per variant rung: `damage.resisting`. On `n`, `toughness` gains `chanceShare` (percent), `conditioned {ehp,
band}`, `ailmentCut` (percent) or `null`, and `warning {kind: "one-shot" | "conditioned", type, fix} | null`.

### The design gate's display (the lines that change)

On `b` and `n`, from the deciding row, hits survived rounded down to a whole percent:
```
- The Arbiter of Divinity: survives its hits (its worst, a physical hit, is 0.71 of your max hit).
- The Arbiter of Divinity: survives 82% of its physical hits by evading or deflecting them (evades 40%, deflects 70% at its accuracy of 3,786; a deflected hit is 0.61 of your max hit, a full one 1.01).
- The Arbiter of Divinity: one-shot by its physical hit (1.50 of your max hit); survives 45% of them by evading or deflecting (evades 36%, deflects 15% at its accuracy of 3,786; a deflected hit is 0.90 of your max hit), under the 80% floor.
- Lowest max hit: 3,451 physical.
```
With `method: "formula"` and armour, the deflected part adds `(by formula; optimistic with armour)`. A deflected hit
that kills too reads `a deflected hit kills too, so only evading counts`. A build with a companion's share of
deflected hits adds `- Note: a companion takes part of each deflected hit, so hits survived reads high (PG-100).`

On `n`:
```
- Effective HP: 17,900 (against T16 map hits, area 82: 439 physical); 51% of it from chance layers (evade, block, deflection).
- Toughness: 17,900 against the 15,000 target for a distance build (Twister flies across the screen), within its band.
- With every condition against it (unlucky rolls, hit recently, not blinded, Wind Dancer at 0): 10,900, under its band (13,500).
- Deflection cuts ailment damage from hits by about 34% on average; PoB doesn't apply it.
- Warning: the EHP reads within its band, but the Arbiter's physical hit one-shots this build, and 51% of the EHP is chance layers. The fix is the pool, armour or a physical shift.
- Warning: with every condition against it the EHP falls under its band; its weakest hit is physical. The fix is the pool, armour or a physical shift.
```
Per variant rung, after the boss lines: `- Resisting rares: 1,700,000 per second (40% fire, cold and lightning resistance).`

Trades:
```
- Defence (one-shot): a rare body with +90 life: the Arbiter's physical max hit (Pinnacle pass) 3,451 → 3,520, survives the full hit; −0% damage.
- Defence (one-shot): 12 points into deflection (<nodes>): hits survived 79% → 84%; +4% EHP, −3% damage; cuts Hammer of the Gods against a boss by 4%.
- Avoidance: 20 points into deflection (<nodes>): hits survived 45% → 71%, +6% EHP, −8% damage (the same 20 points on the best EHP nodes: +14% EHP, hits survived 45%).
- Avoidance: a rare helmet's deflection rating line (about 2 divines, 0 points): hits survived 45% → 52%; +1% EHP, −0% damage.
```
Under the display, the runner's reply gives each `stronger structure:` and `jewel:` line. The figures are
illustrative.

### `<buildFolder>/trades.json` (additions)

`kind` gains `"avoidance"`, on `b` and `n`. `defence` entries may be on `b` or `n`, their `reason` `"one-shot by the
Arbiter's <type> hit"` or `"under the toughness band"`. In a build held to revision 12 every entry carries `maxHit`
and `hitsSurvived`, `null` where they don't apply; one held to 11 keeps the 7 fields (`TRADE_FIELDS`,
`check-run.mjs`:5038, :5081). `maxHit: {type, before, after}`, the deciding row's Pinnacle-pass max hit, is set on a
one-shot rung's defence and damage entries; `hitsSurvived: {before, after}` on defence and avoidance entries of a
build that evades or deflects. `bossAfter` is measured on the trade's temporary stage, and a cut over 2% to a
boss-rotation entry ends its cost line `cuts <entry> against a boss by <x>%`. Entries of a kind are in rank order.
Written by D1-finish (`defence`, `damage`,
`avoidance`, `boots`) and D1-tree (`unmodelled`), each replacing its own kinds' entries.

### The final gate, the guide and the audit

- The final gate's rung lines: `<rung label>: <map> damage per second against map monsters, <resisting> against
  resisting rares, <boss> against a Pinnacle boss; Effective HP <n>`.
- The guide's verdict line, the damage part: `<Skill> about <map> DPS against map monsters, about <resisting> against
  resisting rares, about <boss> against a Pinnacle boss.` A record without `damage.resisting` keeps two figures.
- The verdict label on `b` and `n`, from the deciding row: `survives the Arbiter's hits`; `survives <x>% of the
  Arbiter's <type> hits, by evading or deflecting them`; `one-shot by the Arbiter's <type> hit` with ` (it survives
  <x>% of them)` when x is above 0. The audit's Arbiter line (`audit-template.md`:60 and its copies in the guide
  templates), the final gate's rung lines and the design-to-final comparison use the same three forms.
- The tree-change line, on a schema-8 stage whose `treeChange.refunded` is above 0: `Respec: refund <n> points and
  allocate <m>; respeccing costs gold.`
- The audit's stage table: `Damage, map / boss` becomes `Damage, map / resisting / boss` on endgame rungs.

### Tool changes

- **`lua_get_stats`, `category: "defense"`** gains: `DeflectEffect`, `ConfiguredNotHitChance`, `ConfiguredDamageChance`,
  `ConfiguredEvadeChance`, `MeleeNotHitChance`, `ProjectileNotHitChance`, `SpellNotHitChance`,
  `SpellProjectileNotHitChance`, `MeleeEvadeChance`, `ProjectileEvadeChance`, `SpellEvadeChance`,
  `SpellProjectileEvadeChance`, `AvoidAllDamageFromHitsChance`, `NumberOfDamagingHits`,
  `NumberOfMitigatedDamagingHits`, `StunThreshold`, `SelfStunChance`, `TotalCompanionLife`,
  `CompanionAllyDamageMitigation`, each where PoB sets it.
- **`update_tree_delta`:** an untagged added node auto-paths through untagged nodes only; the output's auto-path line
  reads `Auto-pathed <n> node(s): <Name> [<id>], …`.
- **`find_path_to_node`:** a path to an untagged node runs through untagged allocated nodes only; arguments and output
  unchanged.
- **`load_config_preset`:** a cleared checkbox goes to its `defaultState`; description unchanged.
- **`find_upgrades`:** the description says the call has 90 s and, with searches at least 45 s apart, makes at most
  two searches, usually two, returning the best listings of the searches it ran. Its stop line: `Stopped early: the
  45 s gap between trade searches cut the loop short after <n> search(es).`
- **`get_node_power`, `lookup_game_data`, `check_model_coverage`:** no schema change; the replies stop failing.
- **The bridge's contract error:** `engine reply for "<action>" does not match its contract (C-5): <path>: <message>;
  union member <k>: <path>: <message>; …`.

### The 429 log (`<stateDir>/trade-429.jsonl`, one line per 429)

```json
{"at": "2026-10-27T14:03:11Z", "endpoint": "search", "kind": "auth", "status": 429,
 "rules": {"account": {"limits": "8:10:60,15:60:120,60:300:1800", "state": "9:10:60,15:60:0,19:300:0"}},
 "retryAfter": 600, "lockoutS": 600,
 "counted": [{"rule": "account", "period": 10, "max": 8, "n": 1}, {"rule": "account", "period": 300, "max": 60, "n": 19}]}
```
The example's rule name and numbers are illustrative. Numbers only from the headers; no cookie, session id or request
header. Appended; trimmed lazily to the last 200 lines.

### The run log

- `skillRevision: 12` (written at `init`, stamped at `resume`).
- `skillRevisionFrom` holds one boundary per revision a resume stamped: `{"11": {stages, checkpoints, escalations},
  "12": {…}}`. A resume writes a boundary, at the same lengths, for every revision above the log's old one, so a log
  from before amendment 11 gains both. A revision-11 log's flat `{stages, checkpoints, escalations}` reads as
  `{"11": …}`; a revision `init` wrote has no boundary and starts at 0. A log without `skillRevision` that no resume
  stamped is held to the rules before amendment 11, as today.
- In a `skillRevision: 12` run, D1-tree has no `respec` outcome; the routes to D1-build after D1-finish's `build`
  stay.
