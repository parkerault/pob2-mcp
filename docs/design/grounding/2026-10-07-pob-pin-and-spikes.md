# Grounding: repo state, PoB pin facts, spikes S-a and S-b

Date: 2026-10-07. Grounds `docs/design/2026-10-07-build-guide-workflow.md` (the build-guide change-vision).
Pin: PathOfBuilding-PoE2 v0.23.1 (`7d6f530`), passive tree version `0_5`, unique variants labelled
"Pre 0.5.0 / Current", so the data is patch 0.5.

**Method.** I read `src/`, `pob-api/` and the pinned `vendor/PathOfBuilding-PoE2/src` (cited as `pob:` below).
I also ran scratch luajit scripts that boot PoB headless exactly as `pob-api/bootstrap.lua` does (vanilla
`HeadlessWrapper.lua`, dev autosave off), but run a payload instead of `API/Server.lua`. Every run started from
a `mktemp -d` dir with temp `POB_DIRECTORY`/`XDG_STATE_HOME`, trade and poe.ninja disabled, no network, and the
engine's cwd at PoB `src/` as the server sets it. I called the mise-installed luajit directly (`mise.toml` is
untrusted in this session; I did not run `mise trust`). `vendor/` and the repo were unchanged afterwards. The
scripts are in the session scratchpad, `grounding-pob/` (`boot.lua`; payloads `sa`, `sa2`, `sb`, `b2`, `b3`,
`b5`, `m1`).

Verdicts: **confirmed / partial / refuted**.

## A. Current state (the doc's "Current state" bullets)

| Claim | Verdict | Evidence |
|---|---|---|
| 77 tools | confirmed | 77 `TOOL_META` keys (`src/server/toolMeta.ts:26-122`), with matching schemas and router cases. Disabling trade hides 6 and disabling ninja hides 1 (`:127-131`) |
| One engine, one loaded build, one lock per call | confirmed | One `Session` per server (`src/server/createServer.ts:194`) holds one client and one `loadedValue` (`src/engine/session.ts:258-260`) behind a FIFO mutex (`:276`). Tools with `engine:'none'` skip the lock (`toolRouter.ts:158`) |
| `search_tree_nodes` matches names and stats | confirmed | Case-insensitive substring match on `node.name`, then `node.sd`, then the modList text (`pob-api/API/BuildOps.lua:1337-1468`) |
| Spec tools (`list/select/create/delete/rename_spec`) | confirmed | `BuildOps.lua:1721-1830` |
| `list_gems`: names, tags, requirements | partial | Returns name, kind, type, family, tags, maxLevel, `tier` and `reqStr/Dex/Int` (`BuildOps.lua:1473-1520`). The `req*` fields are attribute **weightings** (e.g. 0/100/0), not requirements; the real figure comes from `calcLib.getGemStatRequirement` (pob:`Classes/SkillsTab.lua:1309`) |
| Items by text; item sets only list/select | confirmed | `add_item` and `add_multiple_items` (`toolSchemas.ts:552-567, 853-871`); item sets have only `list_item_sets`/`select_item_set` (`BuildOps.lua:1840-1869`) |
| No skill-set or config-set tools | confirmed | Nothing in `pob-api/`. `src/` only parses the *active* `SkillSet`/`ConfigSet` from XML (`src/types.ts:57,94-117`) |
| Config tools | confirmed | `set_enemy_stats` exposes only level, the four resists, armour and evasion (`src/handlers/configHandlers.ts:209-217`). Enemy damage needs `set_config` (B5) |
| Checks, `export_build_summary`, trade and ninja tools | confirmed | Router lines 546-664. The ninja tool is `get_currency_rates` |
| `plan_leveling` data and accuracy | refuted as reusable data | A.2 |
| Gap: offense output thin | confirmed | The default `lua_get_stats` whitelist (`BuildOps.lua:37-53`) has only `TotalDPS`/`FullDPS`/`CombinedDPS` for offense, and zeros are dropped (`src/handlers/luaHandlers.ts:325`). `category:'offense'` returns 38 main-skill fields (hit, speed, crit, Bleed/Ignite/Poison DPS; `:290-300`). Missing: a per-skill and per-stat-set breakdown |
| Gap: no skill-part selection | partial | An undocumented `skill_part` (`toolRouter.ts:481` → `BuildOps.lua:553-557`) sets `srcInstance.skillPart`, which is PoE1-style `parts` (pob:`Modules/CalcActiveSkill.lua:459-466`). PoE2 stat sets use `srcInstance.statSet[grantedEffectId] = i` (pob:`Modules/Build.lua:375-381`), which nothing in the repo sets. Probe m1: setting it headlessly works (Blood Hunt Dash 2.86 DPS → Explosion 7.23, test gear) |
| Gap: no ascendancy listing | confirmed | No ascendancy filter. `node_type:'ascendancy'` misses ascendancy **notables**, because `isNotable` is tested first (`BuildOps.lua:1369-1377`). A query is required and results are capped at 30 (`luaHandlers.ts:604`). The loop stops at the cap before sorting (`BuildOps.lua:1361` vs `:1457`), so broad queries return an arbitrary subset |
| Gap: no gem text | confirmed | No description or stat text; the data exists (B2) |
| Gap: no PoE2 bosses | confirmed | `Data/Bosses.lua`: 22 PoE1 bosses, used only to average the Pinnacle/Uber armour and evasion means (pob:`Modules/Data.lua:838-864`). `Data/BossSkills.lua`: 10 PoE1 presets |
| Gap: Blood Hunt payoff not computed | confirmed | The explosion stats `blood_hunt_explosion_%_blood_loss_to_deal_as_life_loss` and `…area_of_effect_+%_final_per_X_blood_loss_consumed…` have no stat map. No calc code names them (S-b), and the Explosion stat set computes only its weapon hit (m1) |
| Gap: partly parsed lines dropped | confirmed, cite corrected | B3 |

**Extra defects.** `search_tree_nodes` advertises `node_type:'any'` (`toolSchemas.ts:461`), but Lua compares `'any'`
literally, so it matches nothing. There is also the truncate-before-sort issue above.

**A.2 `plan_leveling`.** A hand-written TS table (`src/data/poe2Campaign.ts:53-138`) citing maxroll and game8,
"verified 2026-06" (`:17-21`); the handler reads only this table (`src/handlers/levelingHandlers.ts:176-195`).
It holds Acts 1-4 and Interludes 1-3 (boss, start/end *character* level, notes, the two trials at +2 ascendancy
points each), but no area levels, quest passive points or gem levels. Its header calls `QuestRewards.lua`
Acts 4-6 "stale PoE1 areas" (`:4-7`); at the pin that file holds PoE2 Act 4 and Interlude areas (B7). Its
targets sit 6-9 levels above PoB's area levels:

  | Point | Table level | PoB area level |
  |---|---|---|
  | Act 1 end | 22 | 15 (Ogham Manor, `Data/WorldAreas.lua:1534`) |
  | Act 2 end | 38 | 31 |
  | Act 3 end | 52 | 45 |
  | Interludes | 62-65 | 54-56 |

Judgment: prose hints only, not C1 data.

**A.3 Trade budget** (`src/trade/rateLimiter.ts`). Rules are learned from the `X-Rate-Limit-*` headers, one
state per policy (`:99-112`), in memory only (D-35), one limiter per server. It stops one short of each window's
max (`:344`), and the server's hit count wins when higher (`:396-421`). A penalty or a 429 locks the policy for
max(active, Retry-After), default 60 s (`locked_out`); a wait over 30 s fails with `would_wait` instead of
sleeping (`:117`). Observed limits (fixtures, `docs/stabilization/spec/03-trade.md:52`):

  | Endpoint | Limits |
  |---|---|
  | Anonymous search (per IP) | 5/10 s, 15/60 s, 30/300 s (1800 s penalty), 600/6 h |
  | Logged-in search (per account) | 3/5 s |
  | Logged-in fetch (per account) | 6/4 s |

Cost: `get_item_price` and `search_trade_items` take 1 search plus 1 fetch. `find_upgrades` typically takes 1
search plus 2 fetches, worst case 5 searches (`findUpgrades.ts:67`) and up to 10 fetches.

**Suggested cap: 12 priced searches per guide** (about 8 price checks plus 2 `find_upgrades`). It stays under the
14 usable searches per 60 s and far from the 29/300 s window, whose breach is a 30-minute lockout. It also leaves
room for one `find_upgrades` worst case and the user's own browsing on the same IP.

## B. PoB pin facts

**B1 Loadouts: confirmed, with constraints.**

The pin's `help.txt` matches decision 3: identical names, or `{id}` with comma lists such as `Early Game {1,2}`
(Loadouts section, lines 140-155 of `git show HEAD:help.txt`). A single set of a type is assigned to every
loadout (trees excepted). The code is `buildMode:SyncLoadouts` (pob:`Modules/Build.lua:617-753`):
- **Brace pattern.** It is `%{([%w,]+)%}` (`:641,669`): letters, digits and commas only, **no spaces**. `{1, 2}`
  isn't a link.
- **Position.** Braces anywhere in the name work; the help text's "at the end" isn't enforced.
- **Loadout name.** It comes from the **tree** set (`:709`). A tree set can itself be shared:
  `SharedTree {6,7}` gave loadouts `SharedTree {6}` and `SharedTree {7}`.
- **Duplicate ids.** If two sets of one type claim the same id, the later one wins (`:682`).
- **Lookup crash.** `GetLoadoutByName` indexes the link table without a nil check (`:885,901`), so a `{id}` name
  whose links weren't in the last sync raises "attempt to index a nil value". `CopyLoadout` (`:769-783`) always
  hits this with `{id}` names, because it doesn't sync first (reproduced in sa2).
- **XML elements.** Trees: `<Tree activeSpec><Spec title nodes treeVersion …>` (pob:`Classes/TreeTab.lua:523-533`).
  Items: `<Items activeItemSet><ItemSet id title><Slot name itemId>`, items shared across sets by id
  (`Classes/ItemsTab.lua:1250-1257`). Skills: `<Skills activeSkillSet><SkillSet id title><Skill><Gem>` with
  `StatSetIndex` children (`Classes/SkillsTab.lua:451-535`). Config: `<Config activeConfigSet><ConfigSet id
  title><Input name number|string|boolean>`, non-default inputs only (`Classes/ConfigTab.lua:734-760`).
- **Character level is per build.** It lives in `<Build level characterLevelAutoMode>`, not per set
  (`Build.lua:1153-1161`). In auto mode it is re-estimated from the active tree's points
  (`EstimatePlayerProgress`, `:1001-1017`).

**B2 Data reachable from the bridge: confirmed** (probe b2). All of it is in memory after boot.
- **Gems.** `data.gems[id]` has `Tier`, `naturalMaxLevel`, `weaponRequirements` ("Spear"), `reqStr/Dex/Int`,
  `tags`, `grantedEffect` and `additionalStatSet1`.
- **Skills.**
  - `data.skills[id]` has `description`, `weaponTypes`, `qualityStats`/`altQualityStats`, and
    `statSets[i].label` ("Dash", "Explosion").
  - Supports add `requireSkillTypes`/`addSkillTypes`/`excludeSkillTypes`: what they can and can't support.
- **Stat describer works headlessly.** Call `data.describeStats(stats, statSet.statDescriptionScope)`
  (pob:`Modules/Data.lua:678`, `Modules/StatDescriber.lua:231`) on
  `calcLib.buildSkillInstanceStats({level=20,quality=0}, ge, statSet)`. For Blood Hunt level 20:
  - Dash: "+0.15 seconds to Total Attack Time".
  - Explosion: "Explosion radius is 1.3 metres", "Enemies lose Life equal to 25% of Consumed Blood Loss" and
    "10% more area of effect per 381 Blood Loss Consumed, up to 500%".
  - The second return value, `lineMap`, maps each line to its stat.
- **Ascendancy nodes.** `build.spec.tree.nodes` with `ascendancyName=="Titan"` gives 17 nodes: 8 notables
  (Ancestral Empowerment, Colossal Capacity, Crushing Impacts, Earthbreaker, Hulking Form, Mountain Splitter,
  Mysterious Lineage, Stone Skin), the start node and 8 minors. Each has `node.unknown`/`node.extra` parse flags
  (pob:`Classes/PassiveTree.lua:468-473`).
- **Uniques.** Raw text is in `data.uniques[type]`: 30 types, 443 entries (pob:`Modules/Data.lua:1127-1131`).
  Built items are in `main.uniqueDB.list[name]` (`Modules/Main.lua:148-164`). `item:BuildRaw()` gives
  `add_item`-ready text with variants and `{range:0.5}`.
- **Mod parse status.** `modLib.parseMod(line)` returns `{modList, remainder}`, cached per line
  (pob:`Modules/ModParser.lua:7305-7324`); `Data/ModCache.lua` is that cache, precomputed. Item lines keep the
  remainder as `modLine.extra`, and PoB paints such lines `UNSUPPORTED` in tooltips
  (`Classes/ItemsTab.lua:3532,3550`; `PassiveTreeView.lua:1719`).

**B3 "`Classes/Item.lua:2138` skips lines with a remainder": confirmed, cite corrected.**
- **Which line does it.** Line 2138 is the flask and charm *buff* loop. Implicit, explicit, rune and enchant
  lines are skipped at **`Item.lua:2158`** (`if not modLine.extra then … AddMod`). Rune and soul-core scaling
  also skips them (`:2205`).
- **End to end.** Parsing (`:946-1032`) stores `extra` and keeps the partial `modList`. A line with no mods gets
  `extra = line`. Every apply path tests `not modLine.extra`.
- **The design's example.** "10% of Physical damage dealt by your Hits causes Blood Loss" parses to
  **`PhysicalDamage BASE 10`** (a bogus flat +10), with remainder " dealt by your Hits causes Blood Loss".
  Dropping it is the safe behaviour.
- **K2 caveat.** A failed line is retried joined with the *next* line, and the joined parse is kept
  (`:946-959`). Atziri's Acuity therefore stores the remainder "…causes Blood Loss  Pact", partly from the next
  line ("Vaal Pact"). A mod-line check must re-parse the single line with `modLib.parseMod`.

**B4 Skill-stat heuristic: confirmed; it is PoB's own; special cases key on skills, not stats.**
- **How stats become mods.** Only through `statSet.statMap[stat]` (pob:`Modules/CalcActiveSkill.lua:96-98`),
  with a fallback to `data.skillStatMap` (`Modules/Data.lua:899-940`). Unmapped stats are silently dropped.
- **PoB's own flag.** The gem tooltip paints a described line `UNSUPPORTED` when neither map has its stat
  (pob:`Classes/GemTooltip.lua:17-37`, `SkillsTab.lua:933`).
- **No calc code reads raw stats.** None of the 324 unmapped stats found in S-b appears by name in `Modules/` or
  `Classes/`.
- **Where the special cases are.** Calc code keyed on skill **names** (19 in `CalcTriggers.lua`, 19 in
  `CalcPerform.lua`, 8 in `CalcOffence.lua`, e.g. `calcAncestralBoost("Ancestral Call")` at `:3549`), per-skill
  funcs in `Data/Skills/*.lua`, and `skillTypes`/`baseFlags`. So absence from the map isn't proof (calibration
  in D).

**B5 Custom enemy config: partial.** Damage per type is settable; enemy life is not.
- **Damage per type works.** `enemy{Physical,Lightning,Cold,Fire,Chaos}Damage`, the pens,
  `enemyPhysicalOverwhelm`, `enemySpeed`, `enemyCritChance` and `enemyCritDamage`
  (pob:`Modules/ConfigOptions.lua:2261-2275`) have no apply function; `Modules/CalcDefence.lua:2101-2117` reads
  them. Probe b5: `set_config({enemyPhysicalDamage=12000, enemyFireDamage=3000, enemyLevel=82})` gave enemy
  damage of 12180 and 3045 (the extra 1.5% is expected enemy crit: 5% chance × 30% bonus).
- **Enemy stats** are BASE mods: armour, evasion, block, physical reduction, the four resists and
  `enemyMaxResist` (`:2144-2168`). `enemyLevel` is capped at 85.
- **No enemy life.** `set_config({enemyLife=…})` returns "unknown config option".
- **`enemyIsBoss` defaults to Pinnacle** (`defaultIndex = 3`, `:1964`). Out of the box, a new build reports enemy
  level 82 and 979 physical damage per hit.

  | Level | Lines | What it sets |
  |---|---|---|
  | None | `:1969-1997` | no mods |
  | Boss | `:1998-2038` | Unique flags; less curse, exposure and slow effect; more poise; 30% elemental resist; damage ×4/4.40 |
  | Pinnacle | `:2039-2078` | Boss, plus level ≥82, 50% resist, damage ×8/4.40, 3 pen, armour and evasion from the PoE1-derived means |
  | Uber | `:2079-2119` | Pinnacle, plus 70% less damage taken, damage ×10/4.25, 8 pen |

- **Boss skills.** `presetBossSkills` (`:2171-2250`) offers only PoE1 skills.

**B6 Monster life tables: partial.**
`data.monsterLifeTable` (pob:`Data/Misc.lua:7`, from `DefaultMonsterStats.dat`, 100 levels) gives base life by
monster level: L65 6555, L79 24852, L80 31065, L82 32956, L83 33945, L84 34963. It is never used as enemy life;
its only uses are corpse/explosion life and hostile minions (`CalcOffence.lua:1826,2222`;
`CalcActiveSkill.lua:955`). There are no magic, rare or unique life multipliers, and no waystone-tier area
levels (maps sit at base 65, citadels at 74-80 in `Data/WorldAreas.lua`). So "one-click kill" is a hand
calculation: the table, times an external rarity multiplier, at an external T15 area level.

**B7 Campaign data: partial.**
- **`Data/WorldAreas.lua`** has 428 areas with name, act, level, isMap, bosses and monsterVarieties. Acts are
  tagged `act=1..4`, interludes `6`, endgame `10`.
- **`Data/QuestRewards.lua`** (29 rows) is PoE2 data for Acts 1-4, Interludes 1-3 and an Epilogue. 12 rows give
  "+2 Weapon Set Passive Skill Points", 24 in total (e.g. Crowbell, `:16-18`); no row gives a regular passive
  point. Other rewards: resistances, Spirit (+30, +30, +40), life, mana, charm slots, attribute choices.
  `AreaLevel` runs 2-15 in Act 1, 51-52 in Act 4 and 61-64 in the interludes, where it disagrees with
  WorldAreas (Wolvenhold 64 vs 56).
- **How PoB uses the quest points.** `Modules/Build.lua:79-98` builds `acts` and `maxWeaponSets` from them; its
  `Type=="Cruel"` test is PoE1 residue. The level estimate (`:1009`) subtracts them from the regular points used.
  Whether the game also grants regular quest points needs an external check.
- **Gem availability.** There is no availability-by-level table, only a per-gem-level `levelRequirement` (Blood
  Hunt: L15 needs 64, L20 needs 90; `Data/Skills/act_dex.lua:318-338`).
- **`Tier`** (0-14; Blood Hunt = 7) is never defined in code. Its only use is the tooltip line "Tier: N"
  (`Classes/GemTooltip.lua:67-68`). It fits uncut-gem bands (supports 1-5, actives at odd tiers), but that is an
  inference and needs an external check.

## C. Spike S-a: compile feasibility. Verdict: **feasible headlessly**.

**sa run (one build, Warrior/Titan).** Trees `Act 1 {1}`, `Act 2 {2}`, `Act 3 {3}`, `Endgame` (2/5/8/12
points). Item sets `Early {1,2}` (Wooden Club), `Late {3}` (Spiked Club), `Endgame` (Warpick). Skill sets
`Act 1 {1}` (Boneshatter 3), `Act 2+ {2,3}` (Rolling Slam 6), `Endgame` (Blood Hunt 20). Config sets
`Campaign {1,2}` (enemy level 20), `Act 3 {3}` (40), `Endgame` (Pinnacle, 83).

**Result.** `SaveDB` wrote 20.7 KB of XML; after reloading it with `loadBuildFromXML`, every set, title and its
content survived. `SyncLoadouts` listed `Endgame | Act 1 {1} | Act 2 {2} | Act 3 {3}` before and after the save.
Activating each loadout selected exactly the expected tree, item set (weapon), skill set (gem) and config set
(enemy level), and calcs re-ran each time (e.g. `Act 2 {2}` → tree 2, `Early {1,2}`, `Act 2+ {2,3}`,
`Campaign {1,2}`).

**Recipe for the compiler (P2), all calls verified.**
1. `BuildOps.new_build({className, ascendancy})`.
2. **Trees.** Set `treeTab.specList[1].title`. Add more with `BuildOps.create_spec({title, activate=true})` or
   `treeTab:CopyTree(id, name)`, then `spec:AllocNode(node)` and `spec:AddUndoState()`.
3. **Item sets.** `itemsTab:NewItemSet(#itemsTab.itemSets+1, title)` (or `CopyItemSet`), then
   `SetActiveItemSet(id)`, then `BuildOps.add_item_text({text, slotName})`, which equips into the active set.
4. **Skill sets.** `skillsTab:NewSkillSet(#skillsTab.skillSets+1, title)` (or `CopySkillSet`), then
   `SetActiveSkillSet(id)`, then `BuildOps.create_socket_group` and `add_gem`, which act on the active set.
5. **Config sets.** `configTab:NewConfigSet(#configTab.configSets+1, title)` (or `CopyConfigSet`), then
   `SetActiveConfigSet(id)`, then `BuildOps.set_config({...})`, which writes the active set.
6. `build:SyncLoadouts()`, then read `build.controls.buildLoadouts.list`. Entries starting `^7^7` are menu rows.
7. **Per loadout.** `build:SetActiveLoadout(build:GetLoadoutByName(name))`, then `build.buildFlag=true;
   runCallback('OnFrame')`, then read `build.calcsTab.mainOutput`. These are P2's per-stage numbers.
8. `build:SaveDB(name)`, the existing `export_build_xml` path (`BuildOps.lua:165-170`). Write the file through
   `buildFileWriter`.

Also verified: `buildMode:NewLoadout(name)` creates all four sets in one call, and the per-gem stat-set choice
is `srcInstance.statSet[grantedEffectId] = i` (m1).

**Limits.**
- **`CopyLoadout` crashes with `{id}` names** (B1): use the per-tab calls, or `SyncLoadouts` before any lookup.
  New-set ids use `#sets+1` (`ItemsTab.lua:1446-1454`, `ConfigTab.lua:1001-1010`) and can collide after a deletion.
- **Level is per build**: rely on auto mode, or record each stage's level in the plan. **`enemyIsBoss` defaults to
  Pinnacle** in every new config set (defaults aren't written to XML), so the compiler should set it in each.
- **Not tested: the desktop GUI render.** It runs the same `SyncLoadouts` at the end of `Init` (`Build.lua:614`).

## D. Spike S-b: model-coverage census at the pin

These counts come from PoB's own parse flags (sb). A line is **unapplied** when it has a remainder: either
**partial** (some mods parsed) or **unparsed** (none).

| Population | Count | With any unapplied line | Unapplied lines |
|---|---|---|---|
| Unique mod lines (current variants) | 2334 | — | **12.9%** (65 partial, 237 unparsed) |
| Unique mod lines (all variants) | 4179 | — | 10.1% (106 partial, 316 unparsed) |
| Unique items | 443 | **198 (44.7%)**, current variant | — |
| Keystones | 33 | **10 (30.3%)** | 19/82 (23.2%) |
| Notables (non-ascendancy) | 984 | 225 (22.9%) | 252/1807 (13.9%) |
| Ascendancy notables | 208 | **67 (32.2%)** | 112/341 (32.8%) |
| Ascendancy minor / small passives | 199 / 2781 | 4.0% / 6.8% | 3.7% / 6.0% |

**Keystones with unapplied lines.** Ancestral Bond, Conduit, Elemental Equilibrium, Heartstopper, Primal Hunger,
Resonance, Ritual Cadence, Scarred Faith, Trusted Kinship and Vaal Pact.

**Titan.** Crushing Impacts' "Your Hits are Crushing Blows" is **unparsed** (its "25% more Damage against Heavy
Stunned Enemies" parses). Mountain Splitter is unparsed; Earthbreaker (an additional aftershock) is partial.

**Supports.** Of 567 distinct support effects in `data.gems` (including I/II/III tiers and lineage supports),
299 (52.7%) carry a stat with no stat map, and 275 (**48.5%**) have a *described* stat with no map, which PoB's
tooltip paints red.

**Calibration** (5 cases; the red test is the better signal):
- **Blood Hunt: true positive.** Red on both explosion stats. No code models them; m1 computes only the
  Explosion's weapon hit.
- **Brutality I and Heft: true negatives.** No flags, and both are modelled.
- **Ancestral Call I: false positive of the raw test only.** Its
  `support_ancestral_call_strike_is_ancestral_boosted` is undescribed and unmapped, yet the support is modelled:
  `ancestral_call_spirit_strike_interval_ms` maps to `AncestralCallCooldown` (pob:`Data/SkillStatMap.lua:2725`),
  and name-keyed code does the rest (`CalcOffence.lua:3546-3549`).
- **Arcane Surge: red, correctly.** Its stats feed nothing; the buff is modelled only through a config condition
  (`CalcDefence.lua:1605-1612`). So a flag should read "possibly unmodelled; check config" (decision 23's route).

**Examples for bleed, Blood Loss, Crushing Blow and Heavy Stun** (43 of 154 keyword hits are unapplied).

Unapplied:
- **Uniques.** Atziri's Acuity (the Blood Loss line, partial: bogus +10 physical); Saitha's Spear ("(25-40)%
  chance to Aggravate Bleeding on Hit", unparsed); The Smiling Knight ("Aggravate Bleeding on targets you
  Critically Hit", unparsed); Heart of the Well (the aggravate line, partial).
- **Passives.** Aggravation, Deep Wounds and Perfectly Placed Knife (aggravating Bleeding); Haemorrhaging Cuts;
  Cranial Impact and Flip the Script (on Heavy Stun).
- **Supports (red).** Rupture (aggravate on Heavy Stun), Rusted Spikes (aggravate on Pin), Syzygy (Crushing
  Blows vs ignited, armour-broken enemies), Brink I (`cannot_cause_stun_but_allow_stun_buildup`), Haemocrystals
  (Consume Bleeding).

Parsed, for contrast: "25% chance to inflict Bleeding on Hit" → `BleedChance BASE 25`; "100% increased
Magnitude of Bleeding" → `AilmentMagnitude INC 100 (Bleed)`; "Bleeding you inflict deals Damage 10% faster" →
`BleedFaster`.

**Pattern.** Base bleed scaling is modelled. Aggravation, Blood Loss, Crushing Blows and on-Heavy-Stun effects
mostly are not.

## Surprises: design rows the evidence changes

- **Row 3 (loadouts).** The mechanism holds, with constraints to record: braces hold `[A-Za-z0-9,]` with no
  spaces; the loadout name comes from the tree set; don't use `CopyLoadout` with `{id}` names; character level
  is per build, not per loadout. So row 8's per-stage validity check needs the stage level from auto mode or
  from the plan.
- **Row 31 (campaign data).** Don't reuse `plan_leveling`'s data (no area or quest data, levels 6-9 high, a false
  staleness claim). PoB's `QuestRewards.lua`/`WorldAreas.lua` are PoE2 and usable, but the quest points are 24
  *weapon-set* points, the files disagree on interlude levels, and `Tier` needs external grounding.
- **Row 32 (mapping strength).** PoB's monster life table is only an input. PoB never computes enemy life and
  has no rarity multipliers or T15 area level, so this is a hand calculation with external inputs.
- **Rows 18-19 and E1 (enemy profiles).** There is no enemy-life config, and damage per type goes through
  `set_config`, not `set_enemy_stats`. **The default enemy is a Pinnacle boss**, so map-tier numbers silently
  assume a boss unless every config set sets `enemyIsBoss`. Boss scaling uses PoE1-derived means.
- **Rows 6, 22 and 24 (hand-calculation burden).** About a third of ascendancy notables and keystones, about half
  of supports and 13% of unique lines are unapplied, Titan's Crushing Blow line among them. Plan for routine
  hand calculations, not exceptions.
- **K2.** Re-parse single lines (B3). The stored remainder can include the next line's text.
- **Row 33 (pricing).** A fixed cap of 12 priced searches per guide (A.3).
- **M1.** Stat-set selection is a one-line engine change (`srcInstance.statSet[id]=i`). The existing `skill_part`
  path drives only PoE1-style parts.
