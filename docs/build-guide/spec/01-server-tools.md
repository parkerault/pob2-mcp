# Slice 01: Server tools (lookups, coverage, measurement, rankers, set and tree-state authoring, dated prices)

Part of the [spec spine](README.md). It covers work units WU-31…WU-36 and WU-49 (built), and WU-50, WU-52,
WU-53, WU-54 and WU-60 (not built), and acceptance criteria AC-K1…AC-K52. The spine wins any disagreement;
fold fixes back into it. The adversarial review's fixes for this slice (D-218) and the coordinator's
resolutions of its open items (D-222…D-228) are folded in under their spine IDs. The build's decisions
D-239…D-247, D-307…D-309 and the amendments' D-277, D-297, D-299, D-300 are folded in under their spine
IDs (fold applied 2026-10-10). This slice hosts amendment 3's server units, WU-50, WU-52, WU-53 and WU-54
(D-318), and amendment 2's lookup unit, WU-60 (D-317).

**Target design.** Amendments 2 and 3 are approved but not built. Text that describes behaviour not built
yet carries a one-line *Target (WU-nn, D-nnn)* marker, and the as-built behaviour stands beside it until
that unit merges.

This slice delivers goals G-10 and G-11, plus T1. It gives the pipeline the server tools it needs before a
plan can be compiled:
- **K1** reads PoB2's loaded gem, unique, passive and mod data, and lists an ascendancy's nodes. *Target:*
  a mod's base types and the essences (WU-60), and amendment 3's lookup additions (WU-53; §2.2).
- **K2** says, per line, whether PoB applies it, and which skill stats PoB probably ignores. *Target:*
  flags for more of what PoB doesn't model (WU-54; §2.4).
- **M1** measures offense per active skill and per stat set (PoB2's "skill part"), and makes
  `set_main_skill` select the stat set instead of writing PoE1's `skillPart`.
- **M2** makes both rankers list what PoB can't measure.
- **L1** authors a stage's state: sets and loadouts, weapon-set passives, attribute choices, tree jewels,
  per-set flask toggles, a build-wide main-skill index, and auto-level mode (bridge only).
- **T1** puts the date and league on price results, and a stable error-kind prefix on trade-tool errors
  (D-218).
- It also fixes the `update_tree_delta` defect and the two `search_tree_nodes` bugs.
- **N1** (*target*, WU-50, WU-52; D-297) adds poe.ninja popularity and build-index tools in group `ninja`
  (C-54, §2.10).

Throughout, a `read` tool never changes the build (D-176), and nothing caches a price (D-46).

## 1. Existing system context (this slice)

Citations are in the recon ([`../recon.md`](../recon.md) §1) and the pin grounding
([`../../design/grounding/2026-10-07-pob-pin-and-spikes.md`](../../design/grounding/2026-10-07-pob-pin-and-spikes.md),
cited as "pin §"). `vendor/` is `vendor/PathOfBuilding-PoE2/src` at v0.23.1.

| Component | Today | Changed by |
|---|---|---|
| `search_tree_nodes`: schema `toolSchemas.ts:450-470`, router `toolRouter.ts:420-430`, handler `luaHandlers.ts:584-671`, Lua `search_nodes` `BuildOps.lua:1337-1468` | `query` is required. `'any'` is compared literally, so it matches nothing (`:1369-1377`). The loop stops at `maxResults` (`:1361`) before sorting (`:1457`). Ascendancy notables are typed `notable`. Default 20, cap 30 (`luaHandlers.ts:604`) | WU-31 (C-43) |
| `list_gems` (`BuildOps.lua:1473-1536`) | No description, stat text, stat sets or support rules. Nothing in `pob-api/` touches the stat describer, `main.uniqueDB` or `modLib.parseMod` | unchanged; C-37 is new |
| `set_main_skill`: schema `toolSchemas.ts:611-627`, handler `itemSkillHandlers.ts:316-358`, alias `toolRouter.ts:481`, Lua `set_main_selection` `BuildOps.lua:542-562` | The undocumented `skill_part` sets PoE1's `srcInstance.skillPart`. PoB2 keeps the choice in `srcInstance.statSet[grantedEffectId]` (`vendor/Modules/Build.lua:375-381`) and saves it as `<Gem><StatSetIndex grantedEffect index>` (`vendor/Classes/SkillsTab.lua:370-378, :506-512`) | WU-33 (C-44) |
| `lua_get_stats`: handler `luaHandlers.ts:278-374`, Lua `get_stats` → `export_stats` `BuildOps.lua:69-95` | `category:'offense'` reads 38 fields (`luaHandlers.ts:289-300`) from `mainOutput` only and shows ≤ 50 non-zero lines. On C-1's 5000-char truncation list (`createServer.ts:80-83`) | WU-33 (C-45) |
| `suggest_supports` (`poe2SkillHandlers.ts:73-125`, `poe2SkillService.ts:300-319`); `get_passive_upgrades` (`treeHandlers.ts:361-505`) | A null delta sorts as −∞ and falls off the list. Ascendancy notables are dropped (`:411-426`). Only improvers are listed | WU-34 (C-47) |
| Item sets (`BuildOps.lua:1840-1869`); no skill- or config-set actions | At the pin: `New`/`Copy`/`SetActive` for item sets (`vendor/Classes/ItemsTab.lua:1439-1476`), skill sets (`SkillsTab.lua:1496-1541`) and config sets (`ConfigTab.lua:994-1031`). Loadouts come from `SyncLoadouts` (pin §B1) | WU-35 (C-39) |
| `set_level` (`BuildOps.lua:175-190`) | Always sets `characterLevelAutoMode = false` | WU-35 (D-196) |
| `set_tree`, `update_tree_delta` (`BuildOps.lua:126-162, :259-281`); handler `luaHandlers.ts:533-582` | `reimport_nodes` preserves weapon-set tags (`allocMode`) and attribute choices (`hashOverrides`), but nothing sets them. Lua doesn't auto-path and doesn't cap ascendancy points. The handler renders `autoPathedNodes`, `skippedAscendancyNodes` and `tree.ascendancyPointsUsed`, which Lua never sends | WU-36 (C-40, C-48) |
| `add_item` (`toolSchemas.ts:552-569`); `add_item_text` (`BuildOps.lua:577-622`) | The enum is `ITEM_SLOTS` (`toolSchemas.ts:22-26`). `create_socket_group` (`:641`) and `setup_skill_with_gems` (`:846`) share it, and AC-E38 pins both. A tree socket's slot is `Jewel <nodeId>`, which writes `spec.jewels` (`vendor/Classes/ItemSlotControl.lua:74-86`) | WU-36 (C-46) |
| `get_item_price` (`tradeHandlers.ts:265-339`); `search_trade_items` (`:89-200`) | Both name the league; neither gives a date. Each makes 1 search and 1 fetch through the limiter (C-11), which refuses any wait over 30 s as `would_wait` and names the wait. A failure is a `TradeError` with a `kind` (`src/trade/errors.ts:7-19`), but `wrapHandler` re-throws only its message (`src/utils/errorHandling.ts:25-35`), so the caller sees `Error: Failed to <action>: <message>` (`toolRouter.ts:189-192`) and the kind is lost | WU-49 (C-49, D-218) |
| poe.ninja client `src/services/poeNinjaClient.ts`; the currency cache `src/trade/currency.ts`; group `ninja` (`toolMeta.ts:138-139, :147`) | Fetches only the currency exchange overview, for C-12's currency rates (`get_currency_rates` and the price tools' normalization), with conditional requests and a 60-minute cache per league (`currency.ts:97-98`). No rate limiter. `POE_NINJA_DISABLED` hides group `ninja` (only `get_currency_rates` today) and is checked at `currency.ts:127` | WU-52 (C-54; *target*, D-297) |

**Pin facts relied on** (pin §B2–§D, re-probed for this slice):
- **Tree.** Titan has 17 nodes with `ascendancyName == "Titan"`, 8 of them notables. The tree has 19
  jewel-socket nodes (`type == "Socket"` or `containJewelSocket`; `vendor/Classes/ItemsTab.lua:278-290`).
- **Line joins.** A failed item line is re-parsed joined with the next line (`Item.lua:946-959`). A
  failed passive line is joined with one or more following lines, and the absorbed lines get an empty
  mod list (`PassiveTree.lua:448-466`). Clean joins at the pin include:
  - Waveshaper's "…Mana Regeneration Rate also" + "apply to Energy Shield Recharge Rate";
  - Demolitionist's "Gain 4% of Damage as Extra Fire Damage for" + "every different Grenade fired in the
    past 8 seconds". Demolitionist is node 38570, allocated in the golden build.
- **`modLib.parseMod` results:**
  - "+5 to any Attribute" gives an empty mod list;
  - "Charms use no Charges" gives the flag `CharmsUseNoCharges`, which no file in `Modules/` or
    `Classes/` names except `ModParser.lua`;
  - "Your Hits are Crushing Blows" gives no mod list.
- **Stat sets.** The golden build's Gas Grenade has Impact, Poison Cloud and Explosion. Blood Hunt has Dash
  and Explosion.
- **Red-tooltip rule.** A described line is unsupported when its stat is in neither `statSet.statMap` nor
  `data.skillStatMap` (`vendor/Classes/GemTooltip.lua:17-37`).

## 2. Contract detail

The spine's §3.2 rows are binding. This section adds the argument types, defaults, output, errors and
bridge actions that the spine delegates to this slice.
- **Errors.** Tool errors are `isError` (D-27). A failing `mutate` changes neither the export nor
  `revision` (C-3).
- **Slice choices.** Choices made within that delegation are marked **[slice]** and listed in §6. Those
  the coordinator accepted on 2026-10-07 are marked **[slice, accepted]**.

### 2.1 Bridge changes (C-2, C-5; modified)

| Lua action | Module | Params (camelCase) | Reply | WU |
|---|---|---|---|---|
| `lookup_game_data` (new) | `pob-api/API/Lookup.lua` | `mode`, `query?`, `level?`, `quality?`, `slot?`, `kind?` (mechanic mode, D-240), `maxResults?` | `{result:{mode, total, results[]}}`, carrying what §2.2 renders; mechanic mode adds `kinds`, every kind's hit total (D-240) | WU-31 |
| `search_nodes` | `BuildOps.lua` | adds `ascendancy?`; with it, `keyword` is optional | same shape; sorted before the cap | WU-31 |
| `check_coverage` (new) | `pob-api/API/Coverage.lua` | `itemText?`, `nodes?`, `gems?`, `build?`; `sourceNames` (required: the server's name scan, §2.4); `sourceTemplates?` (the scan's concatenation templates, D-243) | `{result:{counts, entries[], gems[], checked}}`: `counts` per status over every checked line; each entry `{kind, source, line, status, remainder?, joinedWith?, unread?, stat?, nodeId?}` (`kind` is `item`, `node` or `gem`; `unread` names the mods the name scan didn't find; `stat` is a gem line's stat id; `nodeId` a node line's node); each of `gems[]` `{name, level, quality, fromBuild}`, the level and quality it was checked at; `checked` `{items, nodes, gems}` (`src/engine/schemas.ts:785-821`) | WU-32 |
| `get_stats` | `BuildOps.lua` | adds `breakdown?: {groupIndex?, fields}` | unchanged without `breakdown`. With it, adds `breakdown: {groupIndex, label, skills:[{index, name, grantedEffectId, statSets:[{index, label, output}]}]}` | WU-33 |
| `set_main_selection` | `BuildOps.lua` | `skillPart` is renamed `statSet` (only `set_main_skill` calls it) | adds an optional `statSet` `{index, label, count, skill, grantedEffectId}`, present when the request has `statSet` (D-309) | WU-33 |
| `manage_sets` (new) | `pob-api/API/Sets.lua` | `setType`, `action`, `id?`, `title?`, `useSecondWeaponSet?` | `{result:{setType, activeId?, sets[], loadouts?}}` | WU-35 |
| `set_level` | `BuildOps.lua` | adds `autoMode?` (default false) | unchanged | WU-35 |
| `set_tree` | `BuildOps.lua` | adds `weaponSets?: {[nodeId]: 1\|2}`, which replaces the preserved tags, and `attributeChoices?: {[nodeId]: "strength"\|"dexterity"\|"intelligence"}`, which is applied over the preserved choices. Without either, `set_tree` behaves as today (AC-E29) | unchanged | WU-36 |
| `update_tree_delta` | `BuildOps.lua` | unchanged | adds `autoPathedNodes`, `skippedAscendancyNodes` and `tree.ascendancyPointsUsed` (already read at `pobLuaBridge.ts:858` and `luaHandlers.ts:616-617, :640`), the points counted as PoB's `CountAllocNodes` counts them (D-307). Refuses, after a dry run and with the build unchanged, an add that would change an allocated node's weapon-set tag; nodes allocated before the call keep their attribute choices (D-308) | WU-36 |
| `lookup_game_data` (*target*) | `pob-api/API/Lookup.lua` | set by the unit | *Target (WU-60, D-277):* a mod hit's base types and essence hits. *Target (WU-53, D-299):* amendment 3's additions (§2.2). Formats set by each unit | WU-60, WU-53 |
| `check_coverage` (*target*) | `pob-api/API/Coverage.lua` | unchanged | *Target (WU-54, D-300):* entries gain the new flags (§2.4); their names are set by the unit | WU-54 |

**Compatibility.** The spine's C-2/C-5 row is a modified contract that lists these changes (D-222). Every
change is additive except `set_main_selection`'s `skillPart` → `statSet` rename, which is internal: only
`set_main_skill` calls the action, and no external caller uses `skillPart`.

New modules are merged by one line in `Handlers.lua`, as `Trade.lua` is. Every new or changed action gets,
in the same merge, its C-5 schema, its typed wrapper and a `contract.test.ts` case (AC-B4). If anything
A-20 assumes is missing after a headless boot, the unit reports `blocked` (HG-12).

### 2.2 C-37 `lookup_game_data` (new, `read`, group `core`)

**Arguments.** `mode` (`gem`, `unique` or `mechanic`); `query` (a case-insensitive substring, required
for `gem` and `mechanic`); `gem_level` (**[slice]** default `naturalMaxLevel`); `gem_quality` (0–20,
**[slice]** default 0); `slot` (unique mode only: PoB's item type, such as `Gloves`, `Spear` or `Jewel`;
unique mode needs `query`, `slot` or both); `kind` (mechanic mode only: `gem`, `unique`, `passive` or `mod`;
D-240); `max_results` (**[slice, accepted]** default 20, cap 30, as in `search_tree_nodes`; D-225).

**Order [slice].** Results are sorted, then cut: exact name matches first, then by name, then by id.
Mechanic hits sort by kind (gem, unique, passive, mod), then by name.

**gem mode** matches `data.gems` names. Each gem shows its name, kind, tier (PoB's own `Tier`,
`vendor/Data/Gems.lua`, as one line `Tier: <n>`; D-258), `data.skills[id].description` and weapon
requirement (`weaponRequirements`, else `weaponTypes`). Then come its stat sets in PoB's order,
each with its label and the lines `data.describeStats(calcLib.buildSkillInstanceStats({level, quality},
grantedEffect, statSet), statSet.statDescriptionScope)` (pin §B2).

**Base lines (D-241).** After each stat set's label, before its lines, come `Attack Damage: <n>% of base`
and `Critical Hit Chance: <n.nn>%` where PoB's tooltip shows them. Their values come from PoB's merge of the
effect's level and the stat set's level (`CalcActiveSkill.lua:792-797`; `Lookup.lua:205-218`). The "of
base" wording is the gem header's, so it differs slightly from PoB's per-stat-set tooltip
(`GemTooltip.lua:217-221`).

Then come the gem's quality effects as PoB's tooltip shows them: under "At +20% Quality", each
`qualityStats` entry is described at value × 20 (`vendor/Classes/SkillsTab.lua:917-930`). A support also
gets "Supports:" (`requireSkillTypes`) and "Can't support:" (`excludeSkillTypes`) lines, as `SkillType`
names.

**Requirements (for D2's gem plan and V1's validity check; D-228).** Each gem also shows its requirements at
every gem level l from 1 to `naturalMaxLevel`, computed as PoB's gem tooltip computes them
(`vendor/Classes/GemTooltip.lua:186-192`):
- the character level `grantedEffect.levels[l].levelRequirement`;
- per attribute, `calcLib.getGemStatRequirement(<that level requirement>, gemData.reqStr | reqDex |
  reqInt, grantedEffect.support)` (`vendor/Modules/CalcTools.lua:129-135`). It is 0 for a support, and
  for an attribute whose weight is 0.

**[slice]** Format: one line `Requires level (gem levels 1–<n>): <r1>, <r2>, …`, then one line
`<Str|Dex|Int> (gem levels 1–<n>): <v1>, <v2>, …` per attribute with a non-zero weight. A support gets
the level line only.

**unique mode (D-239)** matches a unique's name, any of its mod lines (every variant's; legacy "Pre x.y"
variants are skipped), or, with `slot`, its type. Each match shows its name, type and base, then its
matched lines, at most 5, with `(and <n> more matching lines)` after them when there are more. A line that
comes from a variant other than the selected one names its variants; a match by name alone shows
`Matched: its name`. Only when exactly one unique is returned does `main.uniqueDB.list[…]:BuildRaw()` follow,
in a fenced block ready for `add_item`, with the selected variant named. When several are returned, a line
says how to get one's full text (its exact name, or `max_results` 1). Printing every match's text had made
`{slot:"Jewel"}` about 100 KB (`lookupHandlers.ts:123-150`, `Lookup.lua:420-464`).

**mechanic mode** searches gem descriptions and stat-set lines, unique mod lines, every passive's `sd`
lines (ascendancy nodes included) and the text of `data.itemMods`. Each hit is one line,
`[<kind>] <source>: <line>`, where kind is `gem`, `unique`, `passive` or `mod`. Passive hits name their
ascendancy; mod hits name their table.

**`kind` (D-240).** With `kind`, only that kind's hits are listed. When there are hits, the header gives
every kind's total whatever `kind` lists, as `<n> hits: <g> gem, <u> unique, <p> passive, <m> mod.`; when
hits are cut, the "Showing the first N of M" line suggests `kind` (`lookupHandlers.ts:205-240`). Broad
queries had filled every slot with gems.

**Errors:** an unknown `mode`; a missing required `query`; unique mode with neither `query` nor `slot`; an
unknown `slot`, answered with the valid types; an unknown `kind`; a `gem_level` that no returned gem has (a
returned gem without that level is shown at its default level, with a note; `toolSchemas.ts`'
`gem_level`). No match is not an error: the text says nothing matched, then lists the closest names
(D-258).

**Closest names (D-258, D-258a; amends C-37).** When a `query` matches nothing, the reply keeps "Nothing
matched …" and lists names of the kind searched, closest first:
- gem mode (D-258a): two groups. First up to 5 active gems, then up to 3 support gems, from every
  `data.gems` name with a granted effect, each labelled `active` or `support`. One ranking across both kinds
  could hold no active gem ("Ruthlss" is closest to five supports), and the invalid-roll refusal needs skill
  names;
- unique mode: up to 5 unique names, only of `slot`'s type when it is given, each labelled with its type;
- mechanic mode: up to 5 names of the sources it searches (gems, uniques, passives and `data.itemMods`
  entries), only of `kind` when it is given, each labelled with its kind and, where there is one, a
  unique's type, a passive's ascendancy or a mod's table.

Each name appears once per label. Each group is ranked by the optimal string alignment distance from the
query: the fewest insertions, deletions, substitutions and swaps of two adjacent characters (each costing 1),
over characters, with ASCII letters lowercased. Ties go by name (byte order), then by label. **[slice]**
Format: a line `Closest <kind> names (fewest edits from the query, then by name):` per group (gem mode:
`Closest active gem names …`, then `Closest support gem names …`), then one line `- <name> (<label>)` per
name. A misspelt or unknown skill gets 5 active names this way ("Blod Hunt" lists Blood Hunt first), so the
build-guide skill's invalid-roll refusal can quote them (D-238, AC-W26).

**[slice]** The ranking costs (query length) × (name length) per name, so only a query of at most 100
characters gets names. A longer one gets "Nothing matched …" and one line instead: `The query is <n>
characters long, over the 100 that closest names are listed for.` The reply then carries
`suggestionsSkipped` in place of `suggestions`.

*Target (WU-60, D-277):* a mod hit lists the base types that can roll it (those with a non-zero spawn
weight), and the essence table becomes searchable, so D1 can source an affix's limit on its base
(amendment 2, `amendment-2-guide-style.md:365`). WU-60 sets the format; AC-K51 checks it.

*Target (WU-53, D-299):* amendment 3's additions, which the brainstorm's researchers (R1a) and R1b's
advisory verification checklist (D-292) read (`amendment-3-open-builds.md:423-441`):
- Gemling quality effects: `altQualityStats`, shown and searched beside `qualityLines`, labelled (PG-46 in
  [`../pob-gaps.md`](../pob-gaps.md));
- "usable by": an active gem's skill types, and the meta and trigger gems that accept it;
- item-base implicits, searchable;
- type-granting unlocks: for a support you can't socket, the supports whose added skill types meet its
  required types;
- what a support can ride: the active gems it can support;
- the named phrase searches: "also apply to", "while already at maximum", "per 100 maximum", "for each type
  of", "cannot … but", "instead of you", "your <tag> … shatter";
- a skill's hit-making children (triggered skills, granted skills, minions), for the checklist's risks PoB
  can't show;
- stat sets named, so a candidate's card (C-52, slice 03) names the stat set its payoff uses.

Formats and checkable criteria are open: WU-53's first step pins them in this slice from the amendment's
text, and the coordinator reviews them before any code is written (A-33). That step also settles the
example "Culmination II, then Ailith's Chimes".

### 2.3 C-43 `search_tree_nodes` (modified, `read`)

- **`ascendancy`** (new; a case-insensitive name) keeps only nodes with that `ascendancyName`, notables
  included. An unknown name is an error listing the valid ones. With it, `query` becomes optional; with
  neither, the call fails as today.
- **`'any'`** (or no `node_type`) filters nothing; the other filters are unchanged. Ascendancy notables
  stay typed `notable`: retyping them is a contract change beyond this epic, which needs the user (HG-12).
- **Order [slice].** Matches are sorted before the cap: type rank (keystone, notable, jewel, mastery,
  ascendancy, normal), then name, then id. The default 20 and cap 30 are unchanged.

### 2.4 C-38 `check_model_coverage` (new, `read`, group `core`)

**Arguments.** One or more of `item_text` (one item, as `add_item` takes it), `nodes` (ids or exact
names; a name selects every node bearing it) and `gems` (names). Or **[slice]** `build: true` alone,
which checks the active item set's equipped items, the jewels in the active spec's allocated tree sockets
(D-242), the active spec's nodes and the active skill set's gems.

**Lines checked.** An item's implicit, explicit, rune and enchant lines (the ones `Item.lua:2158`
applies or drops), ranged as PoB ranges them; a node's `sd` lines.

**Status per line** (exactly one):

| Status | Rule |
|---|---|
| `fully parsed` | a non-empty mod list, no remainder |
| `partly parsed` | a non-empty mod list plus a remainder, which is shown. PoB applies none of such a line (`Item.lua:2158`, `PassiveTree.lua:489`) |
| `unparsed` | no mod list; also an empty mod list with a remainder, from which PoB applies nothing (`Coverage.lua`'s `M.classify`) |
| `parsed to nothing` | an empty mod list, no remainder |
| `possibly unread` | fully parsed, but some mod's name isn't read by name under the name scan's rules below (D-243). Advisory: the pipeline confirms it by measurement before working the effect out by hand. **[slice, accepted]** This applies S-b's by-name census (pin §B4) to mod names, through the server's scan below (D-226) |

**The name scan.** Headless PoB can't list files, so the server does the scan, with Node `fs`:
- **What.** It reads every `.lua` file directly under `Modules/` and `Classes/` of the PoB source the
  engine runs (`resolvePobSrc`, `src/engine/pobPath.ts`), except `Modules/ModParser.lua`. It collects
  every distinct identifier (`[A-Za-z_][A-Za-z0-9_]*`) in the file text: code, strings and comments
  alike, as S-b's by-name census did. At the pin that is 106 files and 18,805 names, about 0.3 MB as a
  JSON array (`pobSourceNames.ts:7-8`; an earlier count of 107 and 18,806 included `ModParser.lua`).
- **Templates (D-243).** It also collects the shapes of the names PoB computes by concatenation: each `..`
  chain's string literals, with `*` for each run of other operands (`source.name.."ConvertTo"..target.name`
  gives `*ConvertTo*`). Only chains whose literals could be part of a mod name (letters, digits, `_` and
  `:`) are kept, and comments are skipped (`pobSourceNames.ts:1-20`).
- **When.** Once per server process: lazily, on the first `check_model_coverage` call, then memoized.
  An engine restart doesn't repeat it.
- **How Lua gets it.** **[slice]** Each `check_coverage` request carries the names as `sourceNames` and
  the templates as `sourceTemplates`, so an engine restarted by the session needs no extra step. A request
  without `sourceNames` fails, rather than silently skipping the rule.
- **Which names are read (D-243).** Lua builds a set from the names per request. A mod name (a nested
  `value.mod` one included) is read when it is in that set; when it is a compound `Condition:X` whose parts
  are read; when it is, or ends with, a template literal of 6 or more characters that starts with a
  capital; or when it matches a template whose `*` parts are each empty or in the set (`Coverage.lua:17-32,
  :105-180`). A fully parsed line with a mod name that isn't read is `possibly unread`. With the
  templates, 27 mod names stay flagged, down from 132 ([`../worklog.md`](../worklog.md) lines 142-143).

**Joins (pin §B3).** Each line is first parsed alone with `modLib.parseMod`. Only a failed line is
re-parsed by its source's join rule: an item line with the next line (`Item.lua:946-959`), a passive
line with one or more following lines (`PassiveTree.lua:448-466`). A clean join is one entry naming all
its lines; a line absorbed by a join is never reported alone, so never as `parsed to nothing`. If the
join fails, the single line's status and remainder stand, never the joined remainder.

**Gems.** A gem is checked at the build's gem level and quality, or else at C-37's defaults. Every
described line whose `lineMap` stat is in neither `statSet.statMap` nor `data.skillStatMap` is marked
`possibly unmodelled; check config`. This is PoB's red-tooltip rule (pin §B4), which D-123 routes to
config.

**Output.** First, counts per status. Then the entries, grouped by source: `Item`, `Node <id> <name>`
or `Gem <name> / <stat set>`; a jewel in a tree socket is `Jewel socket <nodeId>: <name>` (D-242).
**[slice]** Build mode lists only entries that aren't `fully parsed`, but its counts cover every line.

*Target (WU-54, D-300):* new flags for what PoB doesn't model (`amendment-3-open-builds.md:443-451`;
PG ids in [`../pob-gaps.md`](../pob-gaps.md)), beside `checkGem`'s existing flag for a gem stat with no
stat-map entry:
- energy-based meta gems: the trigger rate isn't modelled (PG-9);
- skills granted by a support: the level comes from the support (PG-2);
- granted skills with no definition (PG-10);
- stats that are mapped but read nowhere, such as Mirage Archer and aftershock chance (PG-4, PG-24). This
  ends Mirage Archer's false all-clear (PG-49; AC-K50);
- Gem Studded ties (PG-1).

Their status names or wording are open: WU-54's first step pins them, with a test example per flag, and
the coordinator reviews them before any code is written (A-33). Rolls above PoB's data range (PG-41) stay
deferred (HG-20, D-304).

**Errors:** no input; `build` combined with another input; an unknown gem or node (named); item text that
doesn't construct.

### 2.5 C-44 `set_main_skill` and C-45 `lua_get_stats` (modified)

**C-44.** The schema documents `skill_part`: the 1-based stat set of the main active skill
(`active_skill_index` if given, else the group's current one). Lua sets the group and active skill, then
`srcInstance.statSet = srcInstance.statSet or {}` and `srcInstance.statSet[<active effect's granted
effect id>] = skill_part`, as PoB's own dropdown callback does (`vendor/Modules/Build.lua:375-381`). It
never writes `skillPart`. The output names the stat set's label. **[slice]** An index outside 1…n is an
error naming n and the labels, and changes nothing.

**C-45 [slice: the spine says "slice 1 bounds the breakdown"].** The bound is one group per call:
`breakdown: true` plus `group_index` (default: the main socket group).
- **Measure, then restore (D-176).** For each active skill in the group's `displaySkillList`, and each of
  its stat sets, Lua makes it the main selection, rebuilds and reads the 38 offense fields. It then
  restores `mainSocketGroup`, every `mainActiveSkill`, every touched `srcInstance.statSet` (nil stays nil)
  and `calcsTab.input.skill_number`, and rebuilds.
- **Output.** One block per skill and stat set, headed `## <skill> / <stat set label> [skill_part <i>]`,
  listing its non-zero fields as `<Field>: <value>` in the offense list's order.
- **Errors and edges.** A `category` other than `offense` with `breakdown`, or a `group_index` past the
  last group, is an error. A group without an active skill gets a plain note. Without `breakdown`, every
  view is unchanged.

### 2.6 C-47 ranker amendments (modified; amends D-77, D-78 per D-143)

**Ranking unchanged.** Each ranking keeps its candidates, its order (delta descending, ties by name;
AC-E39), its `count` or `max_results`, and each ranked entry's text.

**New section.** Both rankers add "What PoB can't fully measure" after the ranking. Each entry is a name
(plus an id for passives) with its reasons:
- **`suggest_supports`:** pool candidates with a null measurement (with the error), and pool candidates
  C-38's gem rule marks `possibly unmodelled` (C-38's "not fully parsed" for a gem).
- **`get_passive_upgrades`:** measured candidates with a line C-38 doesn't rate `fully parsed` (with the
  line and its status), and candidates whose measurement returned no value. With `include_ascendancy`, an
  ascendancy notable with no stat lines of its own (a multiple-choice notable, whose effect is the option
  chosen) is listed too, with the option nodes whose path runs through it (D-247).

**Reason labels (D-247).** In `get_passive_upgrades`, each can't-measure reason is labelled, and the labels
shown are explained once (`treeHandlers.ts:621-653`):
- `not applied`: PoB applies nothing from the line (`unparsed`, `partly parsed`, `parsed to nothing`);
- `advisory`: a `possibly unread` line, whose effect the measured change may already include;
- `choice`: a multiple-choice notable, measured with no option chosen;
- `no value`: PoB's calculator returned nothing for it.

**`include_ascendancy`** (on `get_passive_upgrades`; boolean, default false; D-197: ascendancy notables
only on request). By default no ascendancy node appears anywhere, keeping D-77's exclusion. When it is
true:
- **[slice]** every unallocated, reachable notable of the build's own ascendancy is measured over its
  whole path, with no keyword selection, and priced in ascendancy points (PoB's `pathDist`);
- **[slice]** these are ranked by the same rule in their own section, "Ascendancy notables (cost in
  ascendancy points)", and also enter the can't-measure section;
- a notable beyond the build's remaining ascendancy points is marked, not hidden (D-227). The remaining
  points r are 8 minus the points used, counted as PoB's `PassiveSpec:CountAllocNodes` counts them: the
  start node, multiple-choice options and free-allocate nodes excluded, as C-48 counts them (D-307). An
  entry whose `pathDist` exceeds r ends, in either section, with **[slice]** ` (over budget: needs
  <pathDist>, <r> left)`.

**Output bound (D-246).** `get_passive_upgrades` is on C-1's truncation list, which cut the can't-measure
section, rendered last, at its ascendancy entries. So the handler bounds its own text within C-1's 5000
characters, and no can't-measure line is ever cut. Over the limit, it leaves out the ranked entries' stat
lines first (`search_tree_nodes` gives them back), then the closing tip, then ranked entries from the
bottom of the longer ranking (D-247), and one line says what was left out. It also returns `refit`, which
renders the text again with room for the notices the session prepends, so they can't push a line past the
cut (D-53's mechanism, as `find_upgrades` uses it; `treeHandlers.ts:409, :725-758`).

### 2.7 C-39 `manage_sets` (new, `mutate`; `list` runs as `read`, D-244; group `core`) and auto-level (D-196)

**Arguments.** `set_type` (`item`, `skill`, `config` or `loadout`); `action` (`list`, `create`, `copy`,
`rename` or `select`; a loadout takes only `list` and `select`; there is no delete); `id` (the source for
`copy`, the target for `rename` and `select`); `title` (the new title, or the loadout name for a loadout
`select`); `use_second_weapon_set` (item sets only; **[slice]** it applies to the set the action
targets: the new set, or `id`).

**Behaviour.**
- `create` makes set `#sets+1` (`New…Set`); `copy` uses `Copy…Set`; neither activates it. `select` calls
  `SetActive…Set`. Every action except `list` rebuilds.
- **Kind (D-244).** `action:"list"` runs as kind `read`, through the router's per-call rule
  `engineKindFor` (`toolRouter.ts:138-147`), so a listing neither bumps `revision` nor marks the build
  unsaved. Every other action is `mutate`, the tool's `TOOL_META` kind.
- **Skill-set copies don't share choices.** PoB's `CopySkillSet` copies each gem shallowly
  (`vendor/Classes/SkillsTab.lua:1503-1520`), so a copied set's gems shared their stat-set choice tables
  with the original: a `skill_part` change on the copy changed the original too, and the export kept it.
  `copy` of a skill set now gives each gem its own copies of those tables (`statSet`, `statSetCalcs` and
  the two minion stat-set lookups), so a choice in one set never changes the other. This is WU-35's review
  fix, merged as `0ac33f5` (`pob-api/API/Sets.lua:112-126`; checked in AC-K24's test).
- Loadout actions first run `build:SyncLoadouts()` (pin §B1, R-29). The list is
  `build.controls.buildLoadouts.list` without its `^7^7` menu rows. A loadout `select` calls
  `SetActiveLoadout(GetLoadoutByName(title))`; an unknown name fails cleanly. `CopyLoadout` is never
  called: it crashes on `{id}` names (D-103).

**Titles (D-245).** A title holds at most one `{…}` tag, at its end, of non-empty comma-separated ids of
`[A-Za-z0-9]` (`{1}`, `{1,2}`). PoB links a set to loadouts by its title's first tag only
(`vendor/Modules/Build.lua:641,669`). Any other braces (a space or an empty id in the tag, two tags, a tag
not at the end, an unclosed brace) fail the call, naming the rule, and nothing changes; `create`, `copy`
and `rename` titles all follow it. An untitled `copy` takes the source's title without its tag, plus
` (Copy)`: "S {1}" gives "S (Copy)". A copy that kept the tag would take over the source's loadouts
(`pob-api/API/Sets.lua:11-22, :85-109`).

**Output.** Every action returns the type's list: id, title and the active marker. Item sets also show
`useSecondWeaponSet`. Skill sets also show the group at the build-wide `mainSocketGroup` (label and active
skills), or `none`. This is the main-skill-index check (Target state 5).

**Auto-level.** `set_level {autoMode:true}` sets `characterLevel` and `characterLevelAutoMode = true`.
Without the flag, `set_level` behaves as today. `set_character_level` gets no auto argument; exposing one
is HG-12.

### 2.8 C-40 `set_tree_state` (new, `mutate`, group `core`), C-46, C-48

**C-40 arguments.** Both act on the active spec; at least one is required.
- `weapon_set_nodes: {"1"?: string[], "2"?: string[]}` **[slice]** replaces the tags. Listed nodes get
  that set; every other allocated node gets none.
- `attribute_choices: {[nodeId]: "strength"|"dexterity"|"intelligence"}` **[slice]** merges. Unlisted
  nodes keep their choice.

The handler calls `set_tree` with the current nodes and these parameters.

**C-40 errors** (all-or-nothing; each names the node and the reason): an unallocated node; a weapon-set
node PoB never tags (an ascendancy node, a keystone, a socket, or a `containJewelSocket` node;
`vendor/Classes/PassiveSpec.lua:931`); a node in both lists; a choice on a node without `isAttribute`; a
value outside the enums; tags that would disconnect a node, which PoB connects untagged only through
untagged nodes, and tagged n only through untagged nodes and nodes tagged n (the error names each node
that would no longer be allocated, decided on a throwaway spec first; `BuildOps.lua:318-342`); any other
change to the allocated node set.

**C-40 output.** The tags per weapon set, the choices by node, and the resulting Str, Dex and Int.

**C-46.** `add_item`'s `slot_name` enum becomes `ITEM_SLOTS` followed by `Jewel <id>`, ascending, for each
jewel socket of the pinned tree (19 at the pin). `ITEM_SLOTS` itself, and so the enums AC-E38 pins, are
unchanged (D-223). Jewels reach `spec.jewels` through the existing slot path, and `IsItemValidForSlot` still
rejects non-jewels.

**C-48 (D-194).** Added nodes are processed in the order given.
- **Auto-path.** An unallocated node takes PoB's own path (`node.path`, as `search_nodes` exposes it);
  path nodes beyond the requested ones are `autoPathedNodes`. An adjacent node is allocated alone.
- **Ascendancy cap** (stated in `update_tree_delta`'s description, `toolSchemas.ts:481`). Ascendancy points
  are counted as PoB's `PassiveSpec:CountAllocNodes` counts them: nodes of the build's ascendancy, its start
  node, multiple-choice options and free-allocate nodes excluded (`BuildOps.lua:458`; D-307). A requested
  node whose path would exceed 8 is skipped and listed in `skippedAscendancyNodes`.
  `tree.ascendancyPointsUsed` is the count after the call.
- **Tags and choices kept (D-308).** Nodes allocated before the call keep their weapon-set tags and
  attribute choices; PoB's own allocation would reset a path's attribute nodes to its default
  (`PassiveSpec.lua:939`). An add whose path runs through allocated weapon-set nodes, which PoB's
  allocation would untag (`PassiveSpec.lua:900-909`), fails the whole call, naming the node and that
  branch. A dry run on a throwaway spec decides this first, so the build is left unchanged. Tags change
  only through `set_tree_state` (C-40).
- Removal is unchanged, and an empty delta changes nothing (AC-E28).

### 2.9 C-49 dated prices (modified, kind `none`, group `trade`)

**Output.** Every non-error result of `get_item_price` and `search_trade_items`, including "No price data
found" and "No priced listings found", carries `League: <id>` and `Checked: <YYYY-MM-DDTHH:MM:SSZ>` (the
UTC time the search was sent). Both lines come before the listings, so C-1's truncation can't drop them.
The time is wall-clock, `ServerDeps.now ?? Date.now`, as the currency cache's ages are
(`createServer.ts:179-180`). Nothing is cached (D-46).

**Error prefix (D-218).** Every `isError` result that a `TradeError` (C-10) causes in
`get_item_price`, `search_trade_items` or `get_leagues`, the trade handlers that call the trade client,
starts with a stable prefix naming the error's kind: `Error: [trade:<kind>] Failed to <action>:
<message>`.
- **Kinds.** `<kind>` is the `TradeErrorKind` value, unchanged (`src/trade/errors.ts:7-19`): `no_session`,
  `session_rejected`, `too_complex`, `invalid_query`, `rate_limited`, `locked_out`, `would_wait`, `auth`,
  `http`, `network`, `timeout` or `disabled`. A 429 from the trade site is `rate_limited`
  (`tradeClient.ts:287-293`).
- **How.** The trade handlers' wrapper keeps the kind that `wrapHandler` drops today.
- **Scope.** An error that isn't a `TradeError` gets no prefix. `find_upgrades` keeps C-14's own wording:
  its rate-limit stops aren't errors. `search_stats` and `trade_query_options` send no trade request.
- **Why.** The pipeline's pricing procedure (slice 3 §9) and run log classify outcomes by this prefix,
  not by parsing prose. NFR-22 (no 429s and no lockouts while pricing) is checked that way.

**No batch mode [slice, accepted; C-49 left this to slice 1; D-224].** Per-item calls already pace R1b's and
D1's pricing: the limiter answers an over-long wait with `would_wait` and names the wait, the signal D-202
relies on (C-11). A batch call would need a call deadline, which D-22/D-47 give only to `find_upgrades`
(changing that is HG-12). It would also need partial results after a refusal, and a way past A-25's 120 s
backgrounding. Input schemas are unchanged, and error answers change only by the prefix above; the
pipeline records errors as `unavailable` (D-164).

### 2.10 C-54 poe.ninja tools (new, group `ninja`)

*Target (WU-50, WU-52; D-297, D-298).* As built, the server reaches poe.ninja only for C-12's currency
rates (`get_currency_rates`, group `ninja`), through `src/services/poeNinjaClient.ts`, with no rate limiter
(§1); of the pipeline's agents, only coordinator steps call that tool. The design below comes from
amendment 3 (`amendment-3-open-builds.md:373-419`).

- **Uses.** Popularity: the share of characters by skill and by ascendancy. The build index: the
  characters using a combination, and their levels. Peers: what similar characters run. Prices stay as
  today (C-12).
- **Access.** Only server tools reach poe.ninja: one client, one cache, one rate limiter, one user agent.
  Agents never fetch poe.ninja directly. The new tools join group `ninja` (`toolMeta.ts:138-139`), so
  `POE_NINJA_DISABLED=true` hides them, as it hides `get_currency_rates` (C-1). There is one tool per
  distinct query shape, with no numeric cap (D-316).
- **Callers.** The researchers and the coordinator (D-297, which widens D-231's tool rights; slice 03).
  With poe.ninja on, each dealt deck of candidate builds holds at least two cards below a popularity
  threshold, which WU-50 sets from the data and records as a decision row (D-298, D-324).
- **Politeness.** Serial requests, back-off on HTTP 429, and a cache per league whose lifetime WU-50 sets.
  Currency rates use 60 minutes (`currency.ts:97-98`).
- **Approval.** poe.ninja requests carry no cookie and no PII, so they need no approval (D-297). Trade keeps
  its rules, and D-182's live-run approval covers trade only.
- **Off switches.** `POE_NINJA_DISABLED`, the server's hard off; the run's `--no-ninja` and `--offline`
  (slice 03).
- **Open until WU-50 merges.** The tools' names, arguments, outputs and engine kinds, the cache lifetime
  and the back-off are outputs of WU-50's report, recorded here when it merges (D-324).
- **Tests stay offline (D-34).** HTTP goes only through `fixtureFetch`, with committed fixtures for the new
  endpoints (AC-K48).

## 3. Work units

The serialized-wiring rule applies (spine §8). Each tool-adding unit here (WU-31, WU-32, WU-35, WU-36,
and the target WU-52), in its own merge: moves every count site (spine §1.3) up by its own new tools (+1
each) from its rebased base; adds a `tool-disposition.json` entry (`bucket:"new"`) and `expect:"ok"`
samples in `tool-calls.json` (state-changing arguments for `mutate`); and runs `pnpm build && pnpm
docs:tools --write`. A unit that changes an existing description regenerates the table too. WU-31,
WU-32, WU-35 and WU-36 added four of the epic's 7 new tools; with slice 2's, the total is 84, or 83
without poe.ninja (spine C-1).

*Target (WU-52, D-297):* WU-52 adds k poe.ninja tools in group `ninja`, k ≥ 1, one per distinct query
shape; WU-50 settles k. The total becomes 84 + k, still 83 with `POE_NINJA_DISABLED=true`, and WU-52
restates AC-B1's counts. There is no numeric tool cap: D-173's "at most 8 new tools, total under 86" is
lifted and NFR-24 withdrawn (D-316). D-173's principle stays: extend existing tools where natural, and
group new ones.

Status lines give the merge commits on the integration branch (the build's work-log,
[`../worklog.md`](../worklog.md)). Units WU-50, WU-52, WU-53, WU-54 and WU-60 are amendment 2's and 3's,
not built; their milestone is M-14 ("open builds offline", D-315).

### WU-31: K1 lookups and the `search_tree_nodes` fixes
- kind: build
- status: built (merge `32e17e5`)
- depends-on: []
- role: lua-dev + backend-dev
- touches: [`pob-api/API/Lookup.lua` (new), `pob-api/API/Handlers.lua` (merge line), `pob-api/API/BuildOps.lua` (`search_nodes`), `src/handlers/lookupHandlers.ts` (new), `src/handlers/luaHandlers.ts` (`handleSearchTreeNodes`), `src/server/toolRouter.ts` (`search_tree_nodes` case), `toolSchemas.ts`, `toolMeta.ts`, `src/engine/schemas.ts`, `src/pobLuaBridge.ts`, `tests/integration/contract.test.ts`, tool fixtures, count sites, README table]
- produces: [C-37, C-43, `Lookup.lua`'s gem-resolution and describer helpers (used by WU-32)]
- consumes: [C-2, C-3, C-5, C-8]
- acceptance: [AC-K1…AC-K9, AC-K45, AC-B1, AC-B2, AC-B3, AC-B4]
- milestone: M-10
- summary: Add the tool and Lua action (§2.2), including each gem's requirements per level. Extend
  `search_nodes`: `ascendancy`, an optional `keyword`, `'any'` as no filter, and a full sort before the
  cut. `search_tree_nodes`' schema gains
  `ascendancy` and drops `required`; its description states the rule, and the router follows. Samples:
  one per mode, and `search_tree_nodes {ascendancy:"Gemling Legionnaire"}`.

### WU-32: K2 `check_model_coverage`
- kind: build
- status: built (merge `8315c21`, review fixes `afea7f4`)
- depends-on: [WU-31]
- role: lua-dev + backend-dev
- touches: [`pob-api/API/Coverage.lua` (new), `pob-api/API/Handlers.lua` (merge line), `src/handlers/coverageHandlers.ts` (new), `src/engine/pobSourceNames.ts` (new; the name scan), tool wiring files, `src/engine/schemas.ts`, `src/pobLuaBridge.ts`, `tests/integration/contract.test.ts`, `tests/fixtures/items/coverage-amulet.txt` (new), `tests/e2e/serverTools.test.ts` (new), tool fixtures, count sites, README table]
- produces: [C-38, its per-line and per-gem classifiers (used by WU-34)]
- consumes: [WU-31's helpers, C-2, C-3, C-5, C-6 (the PoB source path)]
- acceptance: [AC-K10…AC-K14, AC-K42, AC-K46, AC-B1, AC-B2, AC-B3, AC-B4]
- milestone: M-10
- summary: Implement §2.4. The possibly-unread scan is §2.4's name scan: Node `fs` reads PoB's
  `Modules/` and `Classes/` once per server process, and each `check_coverage` request passes the names
  to Lua. Samples: `{item_text:"$RUBY_RING_TEXT"}` and `{build:true}`.

### WU-33: M1 per-skill breakdown and the stat-set fix
- kind: build
- status: built (merge `f71fa81`)
- depends-on: []
- role: lua-dev + backend-dev
- touches: [`pob-api/API/BuildOps.lua` (`set_main_selection`; `export_stats` or a helper `get_stats` calls), `pob-api/API/Handlers.lua` (`get_stats` passes `breakdown`), `src/handlers/luaHandlers.ts` (`handleLuaGetStats`), `src/handlers/itemSkillHandlers.ts` (`handleSetMainSkill`), `toolRouter.ts`, `toolSchemas.ts` (`skill_part`, `breakdown`, `group_index`), `src/engine/schemas.ts`, `src/pobLuaBridge.ts`, `tests/integration/contract.test.ts`, `tests/fixtures/tool-calls.json`]
- produces: [C-44, C-45, the `get_stats` breakdown that WU-41's compile record reads]
- consumes: [C-2, C-3, C-5]
- acceptance: [AC-K15…AC-K19, AC-B3, AC-B4, AC-B5]
- milestone: M-10
- summary: Replace the `skillPart` write with the `statSet` write and rename the bridge param. Add the
  breakdown with its exact restore. Samples: `set_main_skill` with `skill_part`, and the breakdown, both
  on the Gas Grenade group.

### WU-34: M2 ranker amendments
- kind: build
- status: built (merge `198888c`; follow-up `0d780cc`, D-246's `refit`)
- depends-on: [WU-32]
- role: backend-dev
- touches: [`src/handlers/treeHandlers.ts` (`handleGetPassiveUpgrades`), `src/handlers/poe2SkillHandlers.ts`, `src/services/poe2SkillService.ts`, `pob-api/API/BuildOps.lua` (`list_support_candidates`, only if errors need surfacing), `toolSchemas.ts` (`include_ascendancy`), `toolRouter.ts`, `tests/fixtures/tool-calls.json`]
- produces: [C-47 (amends D-77, D-78)]
- consumes: [C-38's classifiers (WU-32); the existing `calc_with`, `search_nodes`, `list_support_candidates`]
- acceptance: [AC-K20, AC-K21, AC-K22, AC-K44, AC-B3, AC-B5]
- milestone: M-10
- summary: Add the can't-measure section, computed in the same engine call, and `include_ascendancy`
  with its over-budget mark. AC-E32 and AC-E39 must still pass unchanged. Sample:
  `get_passive_upgrades {include_ascendancy:true}`.

### WU-35: L1 sets, loadouts and the auto-level flag
- kind: build
- status: built (merge `e96c8fa`, review fixes `0ac33f5`)
- depends-on: [WU-32]
- role: lua-dev + backend-dev
- touches: [`pob-api/API/Sets.lua` (new), `pob-api/API/Handlers.lua` (merge line; `set_level` passes `autoMode`), `pob-api/API/BuildOps.lua` (`set_level`), `src/handlers/setHandlers.ts` (new), tool wiring files, `src/engine/schemas.ts`, `src/pobLuaBridge.ts` (`setLevel` option), `tests/integration/contract.test.ts`, `tests/e2e/serverTools.test.ts` (its `tools/list` check gains `manage_sets`), tool fixtures, count sites, README table]
- produces: [C-39, `set_level`'s `autoMode` (D-196; used by WU-41)]
- consumes: [C-2, C-3, C-5]
- acceptance: [AC-K23…AC-K30, AC-B1, AC-B2, AC-B3, AC-B4]
- milestone: M-10
- summary: Implement §2.7. `list_item_sets` and `select_item_set` stay as they are. It depends on
  WU-32 because it extends WU-32's `tests/e2e/serverTools.test.ts`. Sample:
  `manage_sets {set_type:"skill", action:"create", title:"Sample {2}"}`.

### WU-36: L1 tree state, tree jewels, the `update_tree_delta` fix
- kind: build
- status: built (merge `3fd22ac`, review fixes `3070336`)
- depends-on: [WU-32]
- role: lua-dev + backend-dev
- touches: [`pob-api/API/BuildOps.lua` (`set_tree`, `reimport_nodes`, `update_tree_delta`; `add_item_text` only if the jewel path needs it), `src/handlers/luaHandlers.ts` (`handleUpdateTreeDelta`), `src/handlers/treeStateHandlers.ts` (new), `toolSchemas.ts` (the `add_item` enum and `set_tree_state`; **not** the shared `ITEM_SLOTS`, D-223), tool wiring files, `src/engine/schemas.ts`, `src/pobLuaBridge.ts`, `tests/integration/contract.test.ts`, `tests/e2e/serverTools.test.ts` (its `tools/list` check gains `set_tree_state`), `tests/integration/engineKinds.test.ts` and `tests/integration/toolHygiene.test.ts` (each one's `PLACEHOLDERS` map gains `$JEWEL_TEXT`), `tests/fixtures/items/jewel.txt` (new), tool fixtures, count sites, README table]
- produces: [C-40, C-46, C-48, the `set_tree` tag and choice params (used by WU-41)]
- consumes: [C-2, C-3, C-5]
- acceptance: [AC-K31…AC-K38, AC-B1, AC-B2, AC-B3, AC-B4, AC-B5]
- milestone: M-10
- summary: Implement §2.8. `handleUpdateTreeDelta` keeps its text, and now receives the fields it
  renders. It depends on WU-32 because it extends WU-32's `tests/e2e/serverTools.test.ts`. Samples:
  `set_tree_state` on a golden leaf node, and `add_item` of `$JEWEL_TEXT` (a new placeholder in both
  `PLACEHOLDERS` maps) into a free, allocated socket. Its edits to `engineKinds.test.ts` and
  `toolHygiene.test.ts` are serialized wiring (spine §8): WU-40 edits the same two files, so the two
  units merge one at a time.

### WU-49: T1 dated price outputs
- kind: build
- status: built (merge `26ecc02`)
- depends-on: []
- role: backend-dev
- touches: [`src/handlers/tradeHandlers.ts` (`handleGetItemPrice`, `formatSearchResults`, the no-result paths; the trade handlers' error wrapper), `tests/fixtures/trade2/search-empty.*` (new), `tests/mcp/datedPrices.test.ts` (new), `tests/mcp/tradeErrorPrefix.test.ts` (new)]
- produces: [C-49, the `[trade:<kind>]` error prefix (D-218)]
- consumes: [C-10, C-11, C-12]
- acceptance: [AC-K39, AC-K40, AC-K41, AC-K43]
- milestone: M-10
- summary: Add the `League:` and `Checked:` lines and the error prefix (§2.9). There is no schema change
  and no batch mode, so the README table and the counts don't move.

### WU-50: Spike: poe.ninja's PoE2 popularity and build-index API (S-N1)
- kind: spike
- status: not built
- depends-on: []
- role: backend-dev
- touches: [`docs/build-guide/spikes/WU-50-poe-ninja.md` (new)]. Requests to poe.ninja are polite, serial
  and cached, which the user allows in development (D-297); no request goes to pathofexile.com. A probe
  that starts the server runs only from `mktemp -d`, with temp `POB_DIRECTORY` and `XDG_STATE_HOME`.
- produces: [the report: the endpoints, response shape, rate limits and terms of poe.ninja's PoE2
  popularity and build-index API (`amendment-3-open-builds.md:525`); C-54's tool names, arguments, outputs,
  engine kinds, cache lifetime and back-off, recorded in §2.10 when it merges; the popularity threshold for
  D-298, recorded as a decision row (D-324)]
- consumes: [D-297's development allowance; the existing client's conventions (`poeNinjaClient.ts`)]
- acceptance: [AC-K52]
- milestone: M-14
- summary: Ground the API before any tool is designed on it (R-35: its shape, limits and terms are
  ungrounded today). Nothing in `src/` changes.

### WU-52: N1 poe.ninja tools (N-1)
- kind: build
- status: not built
- depends-on: [WU-50]
- role: backend-dev
- touches: [the poe.ninja client and its new rate limiter (`src/services/`), the new handlers
  (`src/handlers/`), `toolSchemas.ts`, `toolMeta.ts` (group `ninja`), `toolRouter.ts`, fixtures for the
  new endpoints, `tests/fixtures/tool-calls.json`, `tests/fixtures/tool-disposition.json`, count sites,
  README table]
- produces: [C-54's tools]
- consumes: [WU-50's report; C-1 (tool groups and their env flags); C-12 (the existing client and cache)]
- acceptance: [AC-K47, AC-K48, AC-K49, AC-B1, AC-B2]
- milestone: M-14
- summary: Implement §2.10 with WU-50's names and shapes. It moves every count site by k and restates
  AC-B1's counts with WU-50's number. Slice 03's pipeline (WU-57) uses the tool names, stubbed offline
  until this merges.

### WU-53: K1 lookup additions (N-2)
- kind: build
- status: not built
- depends-on: [WU-60]
- role: lua-dev + backend-dev
- touches: [`pob-api/API/Lookup.lua`, `src/handlers/lookupHandlers.ts`,
  `.claude/skills/build-guide/references/lookups.md`, `tests/integration/lookupGameData.test.ts`,
  `src/engine/schemas.ts`, `src/pobLuaBridge.ts`, `tests/integration/contract.test.ts` (the amended action's
  reply schema, wrapper types and contract case)]
- produces: [C-37's amendment-3 additions (§2.2's *Target (WU-53, D-299)*)]
- consumes: [C-37 as built]
- acceptance: [AC-K58…AC-K65, pinned by the unit's first step from `amendment-3-open-builds.md:425-443`
  and reviewed by the coordinator before any code is written (A-33); AC-B3, AC-B4]
- milestone: M-14
- summary: Add the lookup additions, with engine tests. It follows WU-60 because both edit `Lookup.lua`
  (D-317). WU-53 and WU-54 touch different `pob-api` files.

### WU-54: K2 coverage flags (N-3)
- kind: build
- status: not built
- depends-on: []
- role: lua-dev + backend-dev
- touches: [`pob-api/API/Coverage.lua`, `src/handlers/coverageHandlers.ts`,
  `tests/integration/modelCoverage.test.ts`, `src/engine/schemas.ts`, `src/pobLuaBridge.ts`,
  `tests/integration/contract.test.ts` (the amended action's reply schema, wrapper types and contract case)]
- produces: [C-38's new flags (§2.4's *Target (WU-54, D-300)*)]
- consumes: [C-38 as built]
- acceptance: [AC-K50; AC-K53…AC-K57, pinned by the unit's first step and reviewed by the coordinator
  before any code is written (A-33); AC-B3, AC-B4]
- milestone: M-14
- summary: Add the flags, with engine tests.

### WU-60: K1 mod base types and essences (amendment 2)
- kind: build
- status: not built
- depends-on: []
- role: lua-dev + backend-dev
- touches: [`pob-api/API/Lookup.lua`, `src/handlers/lookupHandlers.ts`,
  `.claude/skills/build-guide/references/lookups.md`, `tests/integration/lookupGameData.test.ts`,
  `src/engine/schemas.ts`, `src/pobLuaBridge.ts`, `tests/integration/contract.test.ts` (the amended action's
  reply schema, wrapper types and contract case)]
- produces: [C-37's mod base types and essence hits (§2.2's *Target (WU-60, D-277)*)]
- consumes: [C-37 as built]
- acceptance: [AC-K51, AC-B3, AC-B4]
- milestone: M-14
- summary: A mod hit lists the base types with a non-zero spawn weight for it, and the essence table is
  searchable, so D1 can source an affix's limit on its base (amendment 2's affix sources, which WU-62 may
  use). WU-53 follows it, because both edit `Lookup.lua` (D-317).

## 4. Acceptance criteria

The test classes are the spine's (§12). Terms used below:
- **Golden** is `tests/fixtures/builds/grenadator.xml`.
- **In-process, engine-required** means `startSessionFixture` (`tests/helpers/engineSession.ts`) inside
  `engineDescribe`.
- **Lua query** means `__test_eval`, with test actions on, run through `session.run`.
- **G** is the golden socket group whose active skill is Gas Grenade (Impact, Poison Cloud, Explosion),
  found by a Lua query. It isn't the main group.

Cross-checks compare against PoB's own data and functions, never against the tool's earlier output.

**K1 (WU-31)**: `tests/integration/lookupGameData.test.ts`, in-process, engine-required

- **AC-K1 (C-37 gem).** `{mode:"gem", query:"Blood Hunt", gem_level:20, gem_quality:0}`:
  - the first result is Blood Hunt, naming the weapon `Spear`;
  - its description equals `data.skills[<id>].description` (Lua query);
  - its stat sets are `Dash`, then `Explosion`. Each one's lines equal, in order, the Lua query's
    `data.describeStats(calcLib.buildSkillInstanceStats({level=20,quality=0}, ge, statSet),
    statSet.statDescriptionScope)`. Explosion's lines include "Enemies lose Life equal to 25% of
    Consumed Blood Loss";
  - its quality lines equal the Lua-computed `qualityStats` descriptions at value × 20.
- **AC-K2 (C-37 support rules).** A Lua query picks the first support gem by name that has non-empty
  `requireSkillTypes` and `excludeSkillTypes`. Its "Supports:" and "Can't support:" lines list exactly
  those `SkillType` names.
- **AC-K3 (C-37 unique).**
  - `{mode:"unique", query:"Atziri's Acuity"}` returns one match whose text equals the uniqueDB entry's
    `BuildRaw()` (Lua query) and contains "causes Blood Loss". `add_item` with that text into `Gloves`
    succeeds, and `get_equipped_items` shows it.
  - `query:"Aggravate Bleeding"` includes Saitha's Spear and The Smiling Knight (pin §D);
    `{query:"Blood Loss", slot:"Gloves"}` returns only `Gloves`; `slot:"Nonsense"` → `isError` listing the
    types.
- **AC-K4 (C-37 mechanic).** `query:"Crushing Blow"` includes `[passive] Crushing Impacts`, naming Titan,
  with "Your Hits are Crushing Blows". `query:"Blood Loss"` with `max_results:30` includes a `gem` hit for
  Blood Hunt and a `unique` hit for Atziri's Acuity. Every hit's kind is gem, unique, passive or mod, and
  every line contains the query (case-insensitive). **`kind` (D-240):**
  - for `query:"Bleeding"`, the header line `<n> hits: <g> gem, <u> unique, <p> passive, <m> mod.` gives the
    per-kind totals of the Lua action's full list (`maxResults:10000`), with or without `kind`;
  - with `kind:"unique", max_results:30`, the hits are the first min(30, u) of that list's unique hits, in
    its order; `kind:"nonsense"` → `isError`;
  - `{query:"Crushing Impact", kind:"passive"}` matches nothing and lists only passive closest names,
    Crushing Impacts (Titan) first.
- **AC-K5 (C-37 bounds, order, errors).**
  - In every mode, `max_results:50` yields ≤ 30 results and the default ≤ 20. The results equal the first
    N of the Lua action's full list (`maxResults:10000`), which is in §2.2's order.
  - Each is `isError`: an unknown `mode`; gem mode without `query`; unique mode with neither `query` nor
    `slot`; `gem_level:999`. `query:"zzzz"` isn't an error, and says nothing matched.
- **AC-K6 (C-37 read kind, D-176).** In `engineKinds.test.ts`, each mode's `ok` sample leaves the
  canonical export identical and `revision` unchanged (part of AC-B3).
- **AC-K45 (C-37 requirements; WU-31).** In `lookupGameData.test.ts`, `{mode:"gem", query:"Blood Hunt"}`:
  - the `Requires level` line lists, for gem levels 1…20, `grantedEffect.levels[l].levelRequirement`
    (Lua query; 0, 3, 6, 10, … 90 at the pin);
  - the `Dex` line lists `calcLib.getGemStatRequirement(<that requirement>, gemData.reqDex,
    grantedEffect.support)` for each level (Lua query);
  - there is no `Str` or `Int` line, since Blood Hunt's `reqStr` and `reqInt` are 0.

  For AC-K2's support gem, the level line is present and there is no attribute line.

**`search_tree_nodes` (WU-31)**: `tests/integration/searchTreeNodes.test.ts`, in-process, engine-required

- **AC-K7 (C-43 ascendancy).** On the golden build (a Gemling Legionnaire), `{ascendancy:"Titan"}` with
  no query lists exactly the ids with `ascendancyName == "Titan"`, per a Lua query over
  `build.spec.tree.nodes` (17 at the pin, pin §B2's 8 notables among them).
  `{ascendancy:"Titan", query:"Crushing"}` lists Crushing Impacts and only Titan nodes.
  `{ascendancy:"Nonesuch"}` → `isError` listing the names; `{}` → `isError`.
- **AC-K8 (C-43 `'any'`; regression).**
  - `{query:"Life", limit:30, node_type:"any"}` returns the same ids, in the same order, as without
    `node_type`.
  - With `keystone`, `notable` or `jewel`, every result has that type, and ascendancy notables still show
    `[NOTABLE]`.
  - The sample `{query:"Life", limit:5}` still passes the engine-kind check (AC-E16) and the hygiene
    checks.
- **AC-K9 (C-43 sort before cap).** `{query:"Life", limit:5}` returns, in output order, the first 5 of
  `search_nodes {keyword:"life", maxResults:100000}`, run through `session.run`. That full list is ordered
  by type rank (keystone, notable, jewel, mastery, ascendancy, normal), then by name, then by id.

**K2 (WU-32)**: `tests/integration/modelCoverage.test.ts`, in-process, engine-required

- **AC-K10 (C-38 item statuses).** `{item_text}` with `tests/fixtures/items/coverage-amulet.txt` reports the
  statuses below. Each equals the status re-derived by §2.4's rules from `modLib.parseMod(line)` (Lua
  query).

  | Line | Status |
  |---|---|
  | `+30 to maximum Life` | `fully parsed` |
  | `+5 to any Attribute` | `parsed to nothing` |
  | `Charms use no Charges` | `possibly unread` |
  | `10% of Physical damage dealt by your Hits causes Blood Loss` | `partly parsed`, remainder ` dealt by your Hits causes Blood Loss` |
  | `Your Hits are Crushing Blows` | `unparsed` |
- **AC-K11 (C-38 item join).** With Waveshaper's `BuildRaw()` (Lua query) as `item_text`, "…Mana
  Regeneration Rate also" and "apply to Energy Shield Recharge Rate" form one joined entry that isn't
  `unparsed`. Neither line appears alone.
- **AC-K12 (C-38 passives).** In `{nodes:["Crushing Impacts"]}`, "Your Hits are Crushing Blows" is
  `unparsed` and "25% more Damage against Heavy Stunned Enemies" is `fully parsed` (pin §D).
  `{nodes:["38570"]}` (Demolitionist) gives one joined entry with the joined parse's status (Lua query),
  and its second line is never `parsed to nothing`. An unknown node → `isError` naming it.
- **AC-K13 (C-38 gems).** `{gems:["Blood Hunt"]}` marks both Explosion lines about Consumed Blood Loss
  `possibly unmodelled; check config`. For Blood Hunt, Brutality I and Heft, the marked lines equal those
  whose `lineMap` stat is in neither `statSet.statMap` nor `data.skillStatMap` (Lua query); Brutality I
  and Heft get none (pin §D's true negatives). An unknown gem → `isError`.
- **AC-K14 (C-38 build mode, errors, read kind).** On the golden build, `{build:true}` lists no
  `fully parsed` entry. Each listed entry has the status a single-source call gives the same item text,
  node or gem. Demolitionist's second line is never listed as `parsed to nothing`, and the counts sum to
  the lines checked. `{}` and `{build:true, gems:["Heft"]}` → `isError`. The `engineKinds.test.ts`
  samples leave the export and `revision` unchanged.
- **AC-K42 (stdio).** Stdio end-to-end, engine-required: `tests/e2e/serverTools.test.ts`, through
  `spawnServer`.
  - `tools/list` includes `lookup_game_data` and `check_model_coverage` in group `core` (and
    `manage_sets` and `set_tree_state` once merged).
  - `lookup_game_data {mode:"gem", query:"Blood Hunt"}` and `check_model_coverage {item_text:<ruby-ring
    fixture>}` return non-error text naming Blood Hunt and a status.
  - Every stdout line is JSON-RPC (NFR-8).
- **AC-K46 (C-38 name scan; WU-32).** In `modelCoverage.test.ts`, plus a `contract.test.ts` case:
  - `pobSourceNames(<the PoB src dir>)` contains `Life` and lacks `CharmsUseNoCharges`, which only
    `Modules/ModParser.lua` names (§1). A second call returns the same `Set` instance.
  - Two `check_model_coverage` calls in one server list each of `Modules/` and `Classes/` at most once
    (an `fs` spy).
  - In `contract.test.ts`, `check_coverage` without `sourceNames` → `ok:false`. With `sourceNames:[]`,
    the line `+30 to maximum Life` is `possibly unread`, which shows Lua uses the names it is passed.

**M1 (WU-33)**: `tests/integration/skillBreakdown.test.ts`, in-process, engine-required

- **AC-K15 (C-44 stat set).** After `set_main_skill {group_index:G, skill_part:3}`:
  - (a) a Lua query shows `srcInstance.statSet[<Gas Grenade's granted effect id>] == 3` on the main active
    skill, and `srcInstance.skillPart == nil`;
  - (b) the export has `<StatSetIndex grantedEffect="<that id>" index="3"/>` on that gem;
  - (c) the output names `Explosion`;
  - (d) after `lua_save_build` under a new name and `lua_load_build`, (a) and (b) still hold;
  - (e) `lua_get_stats {category:"offense"}` differs from the `skill_part:1` result in at least one field.
- **AC-K16 (C-44 errors; regression).** `skill_part` 0 or 4 on G → `isError` naming 3 stat sets and their
  labels, with the export and `revision` unchanged. `set_main_skill {group_index:11}` (the golden main
  group) adds no `<StatSetIndex>`, and CombinedDPS stays 104489.78 ± 0.01. The schema lists `skill_part`,
  and no Lua under `pob-api/API/` writes `srcInstance.skillPart`.
- **AC-K17 (C-45 values).** `lua_get_stats {breakdown:true, group_index:G}` shows Impact, Poison Cloud and
  Explosion blocks, in that order. For each i, block i's lines equal the non-zero lines of
  `lua_get_stats {category:"offense"}` after `set_main_skill {group_index:G, skill_part:i}` on a fresh
  golden load.
- **AC-K18 (C-45 exact restore, D-176).** Across that breakdown:
  - the canonical export is identical and `revision` unchanged;
  - `lua_get_stats {category:"offense"}` is identical before and after;
  - a Lua query shows `mainSocketGroup`, every `mainActiveSkill`, every `srcInstance.statSet` (nil stays
    nil) and `calcsTab.input.skill_number` unchanged.

  The matching `engineKinds.test.ts` sample passes (AC-B3).
- **AC-K19 (C-45 bound and errors; regression).** The golden main group's breakdown is ≤ 5000 chars,
  with no truncation notice. `{breakdown:true, group_index:999}` and `{breakdown:true,
  category:"defense"}` → `isError`, and a group without an active skill gets a non-error note.
  `lua_get_stats {}` and `{category:"offense"}` contain no `## ` block, and AC-E25, AC-E26 and AC-E41 pass
  unchanged.

**M2 (WU-34)**: `tests/integration/rankerAmendments.test.ts`, in-process, engine-required

- **AC-K20 (C-47 `suggest_supports`).** On the golden main group, `{group_index:11, count:3}`: AC-E39's
  test passes unchanged, and the ranked entries are the pool's first 3 by delta descending, ties by name.
  The can't-measure section names exactly, each once, the union of the pool candidates
  (`list_support_candidates`) with a null measurement and those `check_model_coverage {gems:[name]}`
  marks `possibly unmodelled`.
- **AC-K21 (C-47 passive default).** On the golden build, `get_passive_upgrades {focus:"both",
  max_results:3}`:
  - every can't-measure entry has a line `check_model_coverage {nodes:[id]}` doesn't rate
    `fully parsed`, **or** a null measurement;
  - conversely, every candidate in the whole measured pool with such a line or a null measurement is in
    that section, not only the ranked ones. A Lua query rebuilds the pool as the handler builds it
    (`treeHandlers.ts:395-436`): for each of `focus:"both"`'s keywords (`damage`, `critical`, `life`,
    `energy shield`), `search_nodes`' 8 nearest unallocated, non-ascendancy notables with a path, by
    `pathDist`, then name, then id, skipping ids already taken. The pool's size equals the output's
    `Measured <n>` count, and `calc_with` over each path (Lua query) gives the null measurements;
  - no output id has an `ascendancyName` (Lua query; D-77 kept);
  - the whole default output is ≤ 5000 chars, and AC-E32 passes unchanged.

  **The bound (D-246).** The output stays within 5000 chars with no truncation notice, and every
  can't-measure line is whole. With the room a session notice takes reserved (`refit`), the text plus that
  room stays within 5000, and after an on-disk reload the "Reloaded" notice plus the text do too
  (`rankerAmendments.test.ts`, `tests/unit/passiveUpgradesBound.test.ts`).
- **AC-K22 (C-47 `include_ascendancy`, D-197).** After `lua_new_build {class_name:"Warrior",
  ascendancy:"Titan"}`, `{focus:"defence", include_ascendancy:true}`:
  - every id under "Ascendancy notables" is an unallocated Titan node priced at its `pathDist` (Lua
    query);
  - no other ascendancy's node appears, and the passive-point ranking holds none;
  - Crushing Impacts is in the can't-measure section.

  With `include_ascendancy` omitted, no Titan node appears.
- **AC-K44 (C-47 over-budget notables; WU-34).** In `rankerAmendments.test.ts`, after `lua_new_build
  {class_name:"Warrior", ascendancy:"Titan"}`:
  - **Setup.** A Lua query takes the `path` of Stone Skin, Mysterious Lineage and Colossal Capacity (2
    points each at the pin). `lua_set_tree` allocates the build's nodes plus those paths, so 6 points
    are used and r = 2 remain.
  - **Call.** `get_passive_upgrades {focus:"defence", include_ascendancy:true}`.
  - **Mark.** Every Titan notable in the output, in either section, ends with ` (over budget: needs
    <pathDist>, 2 left)` exactly when its `pathDist` (Lua query) exceeds 2.
  - **Not hidden.** Mountain Splitter (`pathDist` 4 at the pin; its line is unparsed, pin §D) is in the
    can't-measure section with the mark. Crushing Impacts (`pathDist` 2) is there without it.

**L1 sets (WU-35)**: `tests/integration/manageSets.test.ts`, in-process, engine-required

- **AC-K23 (C-39 basics).** On the golden build, for each of `item`, `skill` and `config`:
  - `create {title:"Act 2 (L25) {2}"}` lists id = previous count + 1 with that title, held in the export;
  - `copy {id:1, title:"Copy {3}"}` matches set 1's content: the same `<Slot>` item ids, the same socket
    groups and gems, or the same `<Input>`s;
  - `rename` changes only the title;
  - `select {id}` sets the export's `activeItemSet`, `activeSkillSet` or `activeConfigSet`.
- **AC-K24 (per-set authoring).** On a fresh golden load, which has one set of each type, `copy {id:1}`
  makes set 2 of each type, so set 2 is not empty: the golden item set 1 holds item 5 in `Charm 1`, not
  active, and skill set 1 holds the golden socket groups. After `select {id:2}` of each type:
  - `set_config` changes only config set 2's `<Input>`;
  - `toggle_flask {slot:"Charm 1", active:true}` gives `active="true"` only to item set 2's `Charm 1`.
    Item set 1's `Charm 1` still holds item 5, not active;
  - `add_gem` changes only skill set 2; set 1's socket groups and gems are unchanged.
- **AC-K25 (C-39 titles; D-245).** `create` with `"Early {1, 2}"` or `"Early {}"` → `isError` naming the
  `[A-Za-z0-9,]` rule; the export and `revision` are unchanged. `"Early {1,2}"` succeeds.
  - Two tags (`"Early {1} Late {2}"`), a tag not at the end (`"Early {1} late"`), an unclosed brace
    (`"Early {1"`) or an empty id (`"Early {,}"`, `"Early {1,}"`, `"Early {,1}"`, `"Early {1,,2}"`) →
    `isError` naming the rule, with the export and `revision` unchanged. `rename` and `copy` titles
    follow the same rule.
  - An untitled `copy` of a set titled `"S {1}"` is titled `"S (Copy)"`, so loadout 1 keeps the source
    set.
- **AC-K26 (C-39 second weapon set).** `create {set_type:"item", title:"Swap",
  use_second_weapon_set:true}` gives that `<ItemSet>` `useSecondWeaponSet="true"`, and the Lua flag is
  true. With `set_type:"skill"`, the argument → `isError`.
- **AC-K27 (C-39 loadouts).** Set up `create_spec {title:"Act 1 {1}"}` plus sets titled `Early {1}`,
  `Act 1 {1}` and `Campaign {1}`.
  - The loadout `list` includes `Act 1 {1}` and no `^7` row. `select {title:"Act 1 {1}"}` makes those
    four sets active in the export, even straight after a `rename` with no `list` in between.
  - An unknown name → `isError`, and `ping` still answers. A loadout `create`, `copy` or `rename` →
    `isError`.
  - The `action` enum is exactly list, create, copy, rename and select; `rg -n "CopyLoadout" pob-api src`
    finds nothing.
- **AC-K28 (C-39 main-skill index).** With an empty skill set 2, the skill `list` shows set 1's group at
  `mainSocketGroup` (label and active skills equal to `get_skill_setup`'s main group) and `none` for set 2.
- **AC-K29 (C-39 persistence).** Every set, title, `useSecondWeaponSet` and loadout from AC-K23…K27
  survives `lua_save_build` and `lua_load_build` (spike S-a).
- **AC-K30 (D-196 auto-level; regression).** Engine-required, through `session.run`, plus a
  `contract.test.ts` case:
  - `set_level {level:40, autoMode:true}` → `<Build level="40" characterLevelAutoMode="true">`;
  - `set_level {level:41}` → `characterLevelAutoMode="false"`;
  - `set_character_level {level:42}` writes manual mode, and its schema has no auto argument;
  - after an auto-mode `set_level` run as `mutate`, killing `session.enginePid()` and then calling
    `lua_get_build_info` restores a build whose export keeps `characterLevelAutoMode="true"` (D-198).

**L1 tree state (WU-36)**: `tests/integration/treeState.test.ts`, in-process, engine-required

- **AC-K31 (C-40 weapon sets).** On the golden build, a Lua query picks allocated leaf nodes a, b and c
  that PoB can tag (§2.8). `{weapon_set_nodes:{"1":[a,b], "2":[c]}}` gives `<WeaponSet1 nodes>` = {a,b}
  and `<WeaponSet2 nodes>` = {c}. Lua `allocMode` is 1, 1, 2, and the allocated set is unchanged. The
  output's Str/Dex/Int equal `lua_get_stats`'. A follow-up `{"1":[a]}` leaves only a tagged.
- **AC-K32 (C-40 attribute choices).** A Lua query picks an allocated `isAttribute` node n not set to
  intelligence. `{attribute_choices:{n:"intelligence"}}` puts n in `intNodes` and in neither `strNodes`
  nor `dexNodes`. It raises Int and lowers the old attribute (`lua_get_stats`), and leaves every other
  `<AttributeOverride>` entry unchanged.
- **AC-K33 (C-40 errors).** Each case → `isError` naming the node, with the export and `revision`
  unchanged:
  - an unallocated node;
  - a keystone, ascendancy node or socket in `weapon_set_nodes`;
  - one node in both lists;
  - a non-attribute node in `attribute_choices`;
  - `"wisdom"`;
  - no argument;
  - a call mixing a valid and an invalid entry.
- **AC-K34 (C-40 persistence).** After AC-K31's and AC-K32's changes, `lua_save_build` and then
  `lua_load_build` keep the `WeaponSetN` and `<AttributeOverride>` node lists equal as sets.
- **AC-K35 (C-46 enum).** Static and engine-required. `add_item`'s enum is `ITEM_SLOTS` followed by
  `Jewel <id>`, ascending, for exactly the ids a Lua query finds with `type == "Socket"` or
  `containJewelSocket` in `build.latestTree.nodes` (19 at the pin). `ITEM_SLOTS` is unchanged, and AC-E38
  passes unchanged.
- **AC-K36 (C-46 socketing).** With `tests/fixtures/items/jewel.txt`, `add_item` into `Jewel <s>`, for an
  allocated, empty socket s, adds `<Socket nodeId="s" itemId="<new id>">` to the active `<Spec>`. After
  `create_spec` and `select_spec`, the new spec's `<Sockets>` lacks it. The ruby ring into a jewel slot →
  `isError`, with nothing changed.
- **AC-K37 (C-48 auto-path; regression).** On the golden build, a Lua query picks an unallocated
  non-ascendancy notable with `pathDist` ≥ 3. `update_tree_delta {add_nodes:[id]}` allocates its whole
  pre-call `path` and reports `Auto-pathed <pathDist − 1> intermediate node(s)`. A node with `pathDist` 1
  adds exactly one node and reports no auto-path. AC-E28 passes unchanged.
- **AC-K38 (C-48 cap).** After `lua_new_build {class_name:"Warrior", ascendancy:"Titan"}`,
  `update_tree_delta` with the 8 Titan notables in name order:
  - leaves ≤ 8 Titan points used, as PoB's `CountAllocNodes` counts them (D-307; on this build, the
    allocated Titan nodes other than the start node, by Lua query);
  - allocates the first notable, and lists every notable left out after `BLOCKED:`;
  - returns, in `contract.test.ts`, a reply carrying `autoPathedNodes`, `skippedAscendancyNodes` and
    `tree.ascendancyPointsUsed`, the last equal to `CountAllocNodes`' count. On the golden build, a no-op
    delta reports 6 (`treeState.test.ts`).

**T1 (WU-49)**: `tests/mcp/datedPrices.test.ts`, in-process (`startTestServer`). HTTP goes only through
`fixtureFetch`, with the `trade2/` and `poeninja/` fixtures. The clock is injected:
`now = () => T0 + elapsed`, with T0 = `2026-10-07T12:00:00Z`.

- **AC-K39 (C-49 `get_item_price`).** `{item_name:"x", league:"Runes of Aldur"}` on the ring fixtures
  outputs `League: Runes of Aldur`, then a `Checked: <t>` line matching
  `^Checked: \d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ$` with T0 ≤ t ≤ T0 + elapsed, both before the first listing.
  With the new `trade2/search-empty` fixture, "No price data found" carries both lines.
- **AC-K40 (C-49 `search_trade_items`).** For `{league:"Runes of Aldur", item_type:"Ruby Ring",
  item_rarity:"rare", limit:5}`, both lines are among the first five output lines.
- **AC-K41 (C-49 no cache, no batch; regression).**
  - Two identical `get_item_price` calls make 2 searches and 2 fetches in `fixtureFetch`'s log (D-46),
    and each output has its own `Checked:` line.
  - `get_item_price`'s input properties are exactly `item_name, league, item_type, rarity`.
  - `search_trade_items`' input properties are exactly `league, item_name, item_type, min_price,
    max_price, price_currency, item_rarity, min_rune_sockets, corrupted, identified, mods, limit`.
  - `itemPrice.test.ts`, `searchTradeItems.test.ts` and `tradePrices.test.ts` pass unchanged.
- **AC-K43 (D-218 error prefix; WU-49).** In `tests/mcp/tradeErrorPrefix.test.ts`, in-process
  (`startTestServer`), with `fixtureFetch`'s synthetic responses (`tests/helpers/tradeFixtures.ts`), the
  injected clock and an explicit `league`. Each case starts a fresh server, except the lockout case,
  which follows the 429 on the same server:
  - a search answered 429 with `Retry-After: 60` → `get_item_price` is `isError`, and its text starts
    `Error: [trade:rate_limited] `;
  - the next `get_item_price` on that server starts `Error: [trade:locked_out] `, and `fixtureFetch`'s
    log shows no new request;
  - after a search whose rate-limit state headers report a full 300 s window, the next call starts
    `Error: [trade:would_wait] `, again with no new request;
  - a search answered 500 gives `[trade:http]`, and `search_trade_items` with a search answered 429 gives
    `[trade:rate_limited]`;
  - calling `handleGetItemPrice`, `handleSearchTradeItems` and `handleGetLeagues` directly, with a stub
    trade client that throws `new TradeError(kind, "m")`: for every `TradeErrorKind` value, the thrown
    message starts `[trade:<kind>] Failed to `. A stub that throws a plain `Error` gives no `[trade:`
    prefix.

**S-N1 (WU-50)**: script check. *Target (WU-50, D-324):* not built.

- **AC-K52 (WU-50, D-324; R-35).** Script check. The report at the WU-50 path
  (`docs/build-guide/spikes/WU-50-poe-ninja.md`) covers each item under WU-50's `produces`: the endpoints,
  response shape, rate limits and terms of poe.ninja's PoE2 popularity and build-index API; C-54's tool
  names, arguments, outputs, engine kinds, cache lifetime and back-off; and the popularity threshold for
  D-298, with a decision line for each.

**N1 (WU-52)**: in-process, `fixtureFetch`, no engine; WU-52 names the test file.
*Target (WU-52, D-297):* not built.

- **AC-K47 (C-54 group).** With `POE_NINJA_DISABLED=true`, `tools/list` holds none of the new tools;
  otherwise they are listed in group `ninja`.
- **AC-K48 (C-54 offline tests).** Their tests reach HTTP only through `fixtureFetch`, with committed
  fixtures for the new endpoints (D-34).
- **AC-K49 (C-54 politeness).** Requests are serial, an HTTP 429 gets back-off, and a cache per league
  keeps results for WU-50's cache lifetime. The numbers come from WU-50's report.

**K2 flags (WU-54)**: `tests/integration/modelCoverage.test.ts`, in-process, engine-required.
*Target (WU-54, D-300):* not built.

- **AC-K50 (C-38 gem stats PoB can't act on; D-336, PROPOSED).** Mirage Archer's false all-clear (PG-49)
  comes from a stat with no stat map and no tooltip line (PG-4), not from a mapped stat. AC-K50 pins two
  flags.
  - **`mapped but unread`** (PG-24). A gem line's stat has a stat-map entry (the skill's own `statMap`,
    else the global `data.skillStatMap`), and the entry yields a mod name that PoB reads nowhere. For this
    flag only, a name is read when it is one of these:
    - exactly a name the scan collected from `Modules/` and `Classes/`;
    - a string that a mod tag in the loaded skill data names: any tag field except `type` (`var`,
      `limitVar`, `scalar`, `stat` and so on), in every skill's stat maps and base mods and in the global
      stat map;
    - a minion's or spectre's `limit` in the loaded data (`Data/Minions.lua`), which
      `Modules/CalcPerform.lua:1298-1303` reads;
    - a string literal passed to a mod-list read (`:Sum`, `:Flag`, `:More`, `:Override`, `:Max`, `:Min`,
      `:List`, `:Tabulate`, `:HasMod`) in `Data/Skills/*.lua`. The server's scan collects these, and each
      request carries them as `sourceCallNames`;
    - a compound `X:Y` whose parts are read;
    - else, whether or not it holds a `:`, a whole fit to a concatenation template. Every fixed part
      matches, and each `*` is empty or a name read as above. D-243's suffix rule doesn't apply.
    - In a template PoB builds from `activeGrantedEffect.name` inside a mod-list read, a `*` may also be a
      skill's name with its whitespace removed. The server's scan finds these templates, and each request
      carries them as `sourceSkillTemplates`. At the pin they are `Multiplier:*MaxStages` and
      `Multiplier:*MinimumStage` (`Modules/CalcActiveSkill.lua:866-869`).

    The flag carries its line and that entry's source, and its note names the unread mod names. Line
    statuses, D-243's included, don't change (AC-K57).
    - `{gems:["Aftershock I"]}` flags "Supported skills have 25% chance to cause an additional
      Aftershock", naming `AftershockChance`.
    - `{gems:["Mirage Archer"]}` doesn't flag "Socketed Skills cannot consume Charges". Its mod,
      `Condition:CannotConsumeCharges`, is read: condition tags in skill data name `CannotConsumeCharges`.
    - PoB reads these, so none is flagged: Raise Zombie's limit line (`ActiveZombieLimit`, a minion limit),
      Flameblast's stage line (`Multiplier:FlameblastMaxStages`, a template fit) and Flicker Strike's extra
      strikes (`AdditionalFlickersPerPowerCharge`, `Data/Skills/act_int.lua:8673`).
    - One call covers every gem (Lua query). It flags exactly the lines that the rule above, applied in the
      test, gives for each gem's mapped lines and mod names, which a Lua query lists at the gem's checked
      level and quality. That is 24 lines at the pin at the default levels.
    - These are flagged, each named only in its own stat map: Combat Frenzy's `CombatFrenzyCooldown`
      (`Data/Skills/act_dex.lua:814`), Snipe's `AttackSpeedScalesCost` (`Data/SkillStatMap.lua:437`) and
      Pounce's `ActiveWolfLimit` (`Data/SkillStatMap.lua:2606`).
  - **`stat not mapped`** (PG-4, PG-49). A stat of a support or meta gem that PoB can't act on, and whose
    effect its tooltip check never sees. A support or meta gem is one whose own effect is a support, or
    that has a granted effect of skill type `Meta`. The stat qualifies when all of these hold:
    - it is non-zero at the checked level and quality, in any of the gem's granted effects;
    - it has no stat-map entry, global or the skill's own;
    - it is in no described line: removing it leaves the stat set's described lines unchanged (PoB's
      describer, `Modules/StatDescriber.lua`);
    - it isn't display-only. A display-only stat's id starts `display_` or `quality_display_`.

    At most one flag per gem, source `Gem <name>`, with no `line` (D-336, which also bars cutting stats by
    hand lists or id prefixes beyond the display-only rule). Its note lists every qualifying stat id of the
    gem, sorted: "PoB has no stat map for <ids>; what they drive may not be modelled. PoB may derive some
    of these from the gem's skill types." With one id, the note reads "what it drives" and "may derive it".
    - `{gems:["Mirage Archer"]}` reports one such flag, and its note names `triggered_by_lingering_mirage`.
      This ends the false all-clear.
    - One call covers every support or meta gem (Lua query). Its flags equal, as gem → sorted stat ids,
      the Lua query's pairs grouped by gem. That is 115 flags at the pin, listing 318 stats, at the
      default levels.

AC-K53…AC-K57 were pinned by WU-54's first step (A-33). Every WU-54 flag has one shape:
- **Beside the status, never a status.** `check_coverage`'s reply gains `flags[]`, each
  `{flag, source, note, line?}`. A flag about a gem has source `Gem <name>`; `stat not mapped` is one per
  gem. A line's flag carries the line and its entry's source: `Gem <name> / <stat set>`,
  `Node <id> <name>`, or an item's.
- **Shown in every mode.** The text lists each flag as `[<flag>] <source>`, then its line if it has one,
  then the note. Build mode lists every flag too, although it hides fully parsed lines.
- **Notes.** Where a criterion says a note names something, the test finds that text in the note.

- **AC-K53 (C-38 energy-based meta gems; PG-9).** PoB doesn't model Energy, so any trigger rate it shows
  for an energy-based meta gem isn't based on Energy.
  - `{gems:["Cast on Critical"]}` reports one flag `energy not modelled`, source `Gem Cast on Critical`,
    with no `line`. Its note is exactly "PoB doesn't model Energy; any trigger rate it shows isn't based on
    Energy." The gem's five lines keep their status, `possibly unmodelled; check config` (AC-K13's rule).
  - One call covers every gem with a granted effect of skill type `Meta` (Lua query; 29 at the pin), plus
    Trail of Caltrops. It flags exactly the gems with a granted effect whose `skillTypes` hold both
    `SkillType.Meta` and `SkillType.GeneratesEnergy` (`Data/Global.lua:467, :526`). That is 16 at the pin,
    Cast on Melee Kill, Spellslinger and Barrier Invocation among them.
  - Mirage Archer, a meta gem without Energy, gets no flag. Nor does Trail of Caltrops, which generates
    Energy but isn't a meta gem.
  - The flag rests on PoB never reading the type: `pobSourceNames(<the PoB src dir>)` lacks
    `GeneratesEnergy`, so no file in `Modules/` or `Classes/` names it.
- **AC-K54 (C-38 skills granted by a support; PG-2).** PoB computes a skill that a support gem grants at
  the support gem's level (`Modules/CalcSetup.lua:1851-1876`, `level = gemInstance.level`).
  - `{gems:["Paquate's Pact"]}` reports one flag `level from support`, source `Gem Paquate's Pact`, with
    no `line`. Its note names Twisted Pact and the gem level the call checked Paquate's Pact at (1, its
    `gems[]` level). Twisted Pact's lines (`Gem Paquate's Pact / Twisted Pact`) keep their statuses.
  - One call covers every support gem with an `additionalGrantedEffectId1` (Lua query). It gives one
    `level from support` flag per granted effect that PoB makes an active skill (`CalcSetup.lua:1855`):
    one with a `data.skills` entry, not itself a support, and not `hideFromSideBar`. Each note names the
    skill and its id. The flagged (gem, skill name, id) triples equal the Lua query's, 52 at the pin.
  - A granted skill with a global effect is computed only when its switch is on (`CalcSetup.lua:1855`), so
    its note adds "PoB computes it only when it is enabled in the skill's options." At the pin that is
    Morrigan's Insight's Nature's Exchange alone.
  - Edge cases: Empowered Sparks I gets exactly one flag, naming its visible skill
    (`TriggeredEmpoweredSparkPlayer`) and not its hidden one (`TriggeredSparkEmpowerPlayer`). Concussive
    Runes gets none, because its granted skill is undefined (AC-K55).
  - A gem that isn't a support gets no flag for its own granted skills: Pounce (Predator's Mark, Summon
    Wolf) and Mirage Archer.
- **AC-K55 (C-38 granted skills with no definition; PG-10).** PoB drops a granted effect id that has no
  `skills[...]` entry (`Modules/Data.lua:987-998`), so it never computes that skill.
  - `{gems:["Concussive Runes"]}` reports one flag `granted skill undefined`, source
    `Gem Concussive Runes`, with no `line`. Its note names `ConcussiveRunesPlayer` (`Data/Gems.lua:19614`).
    Its one line, "Supported Skills Trigger a Runic Shockwave on Heavy Stunning an enemy", keeps its status.
  - One call covers every gem with an `additionalGrantedEffectId1` (Lua query; 156 at the pin). It flags
    exactly the (gem, id) pairs whose `additionalGrantedEffectId<n>` has no `data.skills` entry.
  - At the pin those are Concussive Runes, Supporting Fire and six Skeletal gems: Arsonist, Brute, Frost
    Mage, Reaver, Sniper and Storm Mage. Their `Command…Player` skills are undefined.
  - The flag shows where no line would: Supporting Fire's two described lines are both `fully parsed`, and
    `{gems:["Skeletal Brute"]}` has no entries at all. Both still report the flag.
- **AC-K56 (C-38 Gem Studded ties; PG-1).** PoB sets one `MostNumerous<colour>SocketedSupports` condition
  through an if/elseif (`Modules/CalcSetup.lua:2155-2162`). On a tie, only one colour applies: red, then
  green, then blue. The node's text gives each colour that is most numerous.
  - `{nodes:["Gem Studded"]}` flags three of its lines `support colour tie`, each with its `line` and
    source `Node <id> Gem Studded`:
    - "Red: Hits against you have no Critical Damage Bonus";
    - "Blue: Skills have 30% less cost";
    - "Green: 40% less Movement Speed Penalty from using Skills while Moving".

    The test finds the node's id by Lua query (30996 in tree 0_5). Its first line, "For each colour of
    Socketed Support Gem that is most numerous, gain:", gets no flag, and every line keeps its status.
  - The rule applies to any item or node line. One call covers every passive node (Lua query). It flags
    exactly the lines whose parse has a mod with a `Condition` tag on `MostNumerousRedSocketedSupports`,
    `MostNumerousGreenSocketedSupports` or `MostNumerousBlueSocketedSupports`. At the pin those are Gem
    Studded's three.
  - Crystallised Immunities' lines get no flag: they use the strict-majority conditions
    `Majority…SocketedSupports` (`CalcSetup.lua:2146-2153`).
  - The flag is static: it is reported whatever the loaded build's support colours are.
- **AC-K57 (C-38 flags beside statuses; build mode).**
  - A flag changes no line's status and no count. AC-K10…AC-K14, AC-K46 and the C-47 criteria
    (AC-K20…AC-K22, AC-K44) pass unchanged.
  - Load the golden build and add a socket group holding Cast on Critical (gem level 20), Paquate's Pact
    and Concussive Runes (gem level 1). `{build:true}` then reports every flag that single-source calls
    report for the same items, nodes and gems (AC-K14's set). That includes the three gems' flags, although
    build mode lists no fully parsed line.

**K1 base types and essences (WU-60)**: `tests/integration/lookupGameData.test.ts`, in-process,
engine-required. *Target (WU-60, D-277):* not built.

- **AC-K51 (C-37 mod base types, essences).** The mod hit for Arcane Surge on Crit lists only gloves with
  energy shield (`vendor/Data/ModVeiled.lua:163`). An essence query returns an essence hit.

**K1 lookup additions (WU-53)**: `tests/integration/lookupGameData.test.ts`, in-process, engine-required;
the `lookups.md` check in its static block. *Target (WU-53, D-299):* not built.

AC-K58…AC-K65 were pinned by WU-53's first step (A-33), one per item of amendment 3's lookup list
(`amendment-3-open-builds.md:425-443`). Every value below was probed at the pin. Shared rules:
- **Where.** A gem-mode addition is lines in each gem's block; a mechanic-mode addition is hits. Each
  arrives as data in the Lua action's reply (its C-5 schema, wrapper types and contract case: AC-B3, AC-B4)
  and the handler renders it.
- **One gem or several (D-239's rule).** The two long lists, the active gems a support can support
  (AC-K62) and the supports another support unlocks (AC-K61), come only when exactly one gem is returned.
  Otherwise neither appears, and one line under the count line says to look a gem up by its exact name,
  or with `max_results` 1.
- **PoB's support rule.** "Can support" means PoB's `calcLib.canGrantedEffectSupportActiveSkill`
  (`Modules/CalcTools.lua:85-110`) is true for the support's effect and one of the gem's active effects,
  with that effect's own skill types and minion skill types. A gem's active effects are its granted
  effects that PoB makes active skills: not a support and not `hideFromSideBar`
  (`Modules/CalcSetup.lua:1855`). An active gem is one whose kind is `active` (§2.2).
- **Name lists** are sorted by name (byte order) and separated by `; `, because some gem names contain a
  comma (Kelari, the Tainted Sands).
- **The every-gem sweep.** Where a criterion covers every gem, the test reads the Lua action's gem
  results for the queries `a`, `e`, `i`, `o`, `u` and `y` (`maxResults:10000`). A Lua query confirms that
  together they return every gem with a granted effect (Syzygy has only the `y`).
- **Samples.** `tests/fixtures/tool-calls.json` gains `expect:"ok"` samples
  `{mode:"gem", query:"Whirling Assault"}`, `{mode:"mechanic", query:"cannot … but"}` and
  `{mode:"mechanic", query:"Spirit", kind:"base"}`. AC-K6's read-kind check and the hygiene checks cover
  them.
- **Unchanged.** AC-K1…AC-K5, AC-K45 and AC-K51 still pass. The only format changes are the mechanic
  gem-hit sources (AC-K65) and the header's base count (AC-K60).

- **AC-K58 (C-37 Gemling quality effects; PG-46, I5).** PoB applies a gem's `altQualityStats` only when
  the build has the `GemlingQuality` flag (`Modules/CalcTools.lua:147-151`). Advanced Thaumaturgy's line
  "Gem Quality grants Socketed Skills an additional effect" sets it (`Data/ModCache.lua:5683`), and PoB's
  tooltip then lists those effects beside the quality lines (`Classes/SkillsTab.lua:893-910`). The lookup
  shows them whatever the build, labelled.
  - **Gem mode.** After the "At +20% Quality:" lines, a gem with an `altQualityStats` entry in any granted
    effect gets the header `At +20% Quality, with the Gemling Legionnaire's Advanced Thaumaturgy:`. Under
    it, one line `  - <line>` per line PoB describes: each entry is described alone at value × 20 in its
    stat set's scope, as the quality lines are (`describeStats({[stat] = value × 20}, scope, true)`), in
    the block's effect order. A gem whose entries describe to no line shows `  (no described line)`. A gem
    without such an entry has no header.
    - `{mode:"gem", query:"Hammer of the Gods"}`: exactly "50% chance to not consume Glory", which isn't
      among its quality lines.
    - `{mode:"gem", query:"Blood Hunt"}`: exactly "Enemies lose Life equal to +4% of Consumed Blood Loss".
    - `{mode:"gem", query:"Snipe", max_results:1}`: "20% more Attack Speed", then "20% longer Perfect Timing
      window".
    - A Lua query over the tree finds that Advanced Thaumaturgy (Gemling Legionnaire) is the only node with
      the header's line (node 14429 at the pin).
    - The every-gem sweep: each gem's Gemling lines equal those a Lua query describes from its
      `altQualityStats` by the rule above. That is 257 gems at the pin. Four entries describe to no line
      (in Detonate Living, Flash Grenade, Fortifying Cry and Siege Cascade).
  - **Mechanic mode** also searches each gem's quality lines and Gemling lines, as gem hits with the
    sources `<gem> (quality)` and `<gem> (Gemling quality)`.
    - `{query:"not consume Glory", kind:"gem"}` includes `[gem] Hammer of the Gods (Gemling quality): 50%
      chance to not consume Glory`. As built, it has no hit.
    - `{query:"metres to explosion radius", kind:"gem"}` includes `[gem] Blood Hunt (quality): +0.4 metres
      to explosion radius`.
- **AC-K59 (C-37 "usable by"; I6).** Each active gem's block gains two lines:
  - `Skill types: <names>`: the `SkillTypeName` of each type in its granted effect's `skillTypes`,
    sorted by name and separated by `, `. Each `Also grants:` block of a non-support effect gets its own
    `Skill types:` line.
  - `Usable by: <meta gems>`: each meta gem whose support effect can support one of the gem's active
    effects (the shared rule), marked ` (trigger)` when that support effect has `isTrigger`. With none, it
    reads `Usable by: (no meta gem)`. A meta gem has a granted effect of skill type `Meta` (29 at the
    pin). Its support effect is its granted effect with `support` set; each meta gem has exactly one at the
    pin.

  Support gems get neither line.
  - `{mode:"gem", query:"Snipe", max_results:1}`: `Skill types: Area, Attack, Barrageable, Bow, Channel,
    Cold, MirageArcherCanUse, PerfectTiming, Projectile, ProjectilesFromUser, RangedAttack,
    SkillConsumesFreeze` and `Usable by: Animus Splinters; Mirage Archer; Mirage Deadeye` (I6's Snipe →
    Mirage Archer).
  - `{query:"Fireball"}` lists `Fire Spell on Hit (trigger)` but not Thundergod's Wrath.
    `{query:"Spark", max_results:1}` lists `Thundergod's Wrath (trigger)` but not Fire Spell on Hit. Both
    list `Cast on Critical (trigger)` and `Spell Totem`.
  - `{query:"Whirling Assault"}`: `Usable by: Animus Splinters; Hollow Form`.
  - The every-gem sweep: each active gem's line equals a Lua query that applies PoB's function to each
    meta gem's support effect and the gem's active effects.
- **AC-K60 (C-37 item-base implicits; I7, PG-48).** Mechanic mode gains a sixth hit kind, `base`.
  - **What it searches.** Each implicit line of every base in PoB's base lists (`data.itemBaseLists`, as
    AC-K51's base types use them; hidden bases are left out), with its `{variant:<n>}` tag removed. A hit
    matches on its line or on its base's name, as an essence hit does.
  - **Format.** `[base] <base name> (<item type>): <line>`. A line tagged with a variant names it from the
    base's `variantList`: `(<item type>; variant <name>)`.
  - **Order and filters.** Base hits sort after essence hits, then by name, then by line order.
    `kind:"base"` lists only them, and the header's totals end `, <e> essence, <b> base.`. The closest
    names of kind `base` are base names, each labelled with its item type.
  - `{query:"Cast on Critical", kind:"base"}` includes `[base] Absent Amulet (Amulet; variant Cast on
    Critical): Grants Skill: Level (1-20) Cast on Critical`.
  - `{query:"Spirit", kind:"base"}` includes `[base] Solar Amulet (Amulet): +(10-15) to Spirit`.
  - For the queries `Spirit`, `Grants Skill` and `Resistance`, the Lua action's base hits
    (`maxResults:100000`) are exactly the lines a Lua query reads from `data.itemBaseLists`, each base
    name once: every line containing the query, and every line of a base whose name contains it, in the
    order above. 501 bases have implicit lines at the pin.
  - `{query:"Solar Amulett", kind:"base"}` matches nothing and lists `Solar Amulet` (Amulet) first.
  - `{query:"Spirit", kind:"nonsense"}` is `isError`, and its message lists `base` among the kinds.
- **AC-K61 (C-37 type-granting unlocks; settles "Culmination II, then Ailith's Chimes").** PoB adds a
  supporting gem's `addSkillTypes` to the skill's types, then re-checks the supports it rejected
  (`Modules/CalcActiveSkill.lua:182-208`). It keeps a support only if it still applies with every added
  type (`:210-212`), and keeps one support per gem family (`Modules/CalcSetup.lua:517-527`).
  - **Format.** With exactly one active gem returned, its block gains `Unlocked by another support:`.
    Under it is one line `- <X>: after <Y1>; <Y2>; …` per support gem X, sorted by X's name, or
    `  (none)`.
  - **The rule.** X is listed with Y, a support gem, when both of these hold:
    1. X can support none of the gem's active effects with their own types.
    2. For one active effect E, all of these hold:
       - Y can support E, Y has `addSkillTypes`, and Y shares no `gemFamily` entry with X;
       - with Y's added types, X can support E;
       - with Y's and X's added types, both still can.

    One helper only: chains of two or more aren't listed.
  - **The example holds at the pin, as a pair on a skill.**
    - Whirling Assault's skill types are Area, Attack, Melee and MeleeSingleTarget. They lack
      `ComboStacking`, which Ailith's Chimes requires (`Data/Skills/sup_dex.lua:121`).
    - Culmination II supports Attack and Melee skills and adds `ComboStacking`
      (`Data/Skills/sup_dex.lua:1634-1635`).
    - So `{mode:"gem", query:"Whirling Assault"}` lists
      `- Ailith's Chimes: after Combo Finisher I; Combo Finisher II; Culmination I; Culmination II; Vruun's
      Inevitability`, one of its 29 lines.
  - **Family.** On Gas Grenade, Nova Projectiles I doesn't unlock Nova Projectiles II, although the type
    checks pass: the two share a family.
  - **Rule check.** For Whirling Assault, `{query:"Snipe", max_results:1}`, Fireball, Gas Grenade, Raise
    Zombie and Cast on Critical, the lines equal a Lua query that applies the rule with PoB's function.
    Over every active gem the rule gives 6,435 (gem, X) pairs at the pin; a gem lookup lists one gem's.
- **AC-K62 (C-37 what a support can ride).** With exactly one support gem returned, its block gains
  `Can support (<n> active gems): <names>`. It lists every active gem with an active effect that the
  support's own effect can support (the shared rule), or reads `Can support: (no active gem)`.
  - `{mode:"gem", query:"Ailith's Chimes"}`: `Can support (2 active gems): Mantra of Destruction; Tempest
    Bell`. Whirling Assault is reached only through AC-K61.
  - `{query:"Culmination II"}`: 93 active gems, Whirling Assault among them.
  - `{query:"Uhtred's Exodus"}`: 398 of the 399 active gems, all but Abyssal Apparition.
  - For Ailith's Chimes, Culmination II, Uhtred's Exodus, Paquate's Pact and
    `{query:"Living Lightning", max_results:1}`, the names equal a Lua query's.
  - `{query:"Culmination"}` returns Culmination I and Culmination II. Neither block has a `Can support`
    line, and the several-gems line is present.
- **AC-K63 (C-37 named phrase searches).** Mechanic mode's `query` may hold gaps, written `…` or `...`.
  - **Matching.** A line matches when the query's parts, split at the gaps and trimmed, appear in it in
    order without overlapping, case-insensitive. A query of gaps alone is an error, as an empty one is.
    Gem and unique modes are unchanged.
  - **The named searches.** `.claude/skills/build-guide/references/lookups.md` lists the seven, each in
    backticks: `also apply to`, `while already at maximum`, `per 100 maximum`, `for each type of`,
    `cannot … but`, `instead of you` and `your … shatter`. The amendment's "your <tag> … shatter" takes any
    text for `<tag>`, so it is a gap.
  - **Gap check.** The Lua action's full list (`maxResults:100000`) for `cannot … but` equals, in order,
    its full list for `cannot` filtered to the lines matching `/cannot.*but/i`, and `kinds` counts that
    list. The same holds for `your … shatter`, from `shatter` and `/your.*shatter/i`. `cannot ... but`
    gives the same list as `cannot … but`.
  - `cannot … but` includes Combo Finisher I's description and `[unique] Lavianga's Spirits (Flask): This
    Flask cannot be Used but applies its Effect constantly`.
  - `your … shatter` includes `[unique] Polcirkeln (Ring): Enemies Chilled by your Hits can be Shattered as
    though Frozen` (PG-33).
  - The five searches without a gap each return at least one hit, and every hit's line contains the
    phrase.
- **AC-K64 (C-37 a skill's hit-making children).** Each gem's block gains `Hit-making children:`, then
  one line per child, or `  (none)`. There are two kinds of child:
  - `- <name> (triggered)` or `- <name> (granted)`: each of the gem's other granted effects
    (`additionalGrantedEffects`, in order) that PoB makes an active skill. It is `triggered` when its skill
    types hold `Triggered` or `InbuiltTrigger`.
  - `- <skill> (minion <minion>)`: for each granted effect that PoB makes an active skill, its first
    included, each minion of its `minionList` with a `data.minions` entry, then each skill of that
    minion's `skillList` with a `data.skills` entry (`Modules/CalcActiveSkill.lua:900-919`).

  Granted effects come first, then minions' skills, each in data order. Each (name, label) is listed once.
  A child is listed only when it makes hits by PoB's rule (`Modules/CalcActiveSkill.lua:176`): one of its
  stat sets has `baseFlags.hit`, or its skill types hold `Attack`, `Damage` or `Projectile`.
  - `{mode:"gem", query:"Bloodhound's Mark"}`: exactly `- Blood Explosion (triggered)`.
  - `{query:"Pounce"}`: exactly `- Basic Attack (minion Wolf Companion)` and `- Leap Slam (minion Wolf
    Companion)`. Its Predator's Mark and Summon Wolf make no hits.
  - `{query:"Living Lightning", max_results:1}`, a support: exactly `- Zap (minion Living Lightning)`.
  - `{query:"Artillery Ballista"}`: exactly `- Ballista Bolt (granted)`. `{query:"Raise Zombie"}`:
    exactly `- Basic Attack (minion Raised Zombie)`.
  - `{query:"Snipe", max_results:1}` and `{query:"Mirage Archer"}`: `  (none)`. PoB has no skill data for
    Mirage Archer's mirages (PG-4).
  - The every-gem sweep: each gem's children equal a Lua query applying the rule. At the pin, 94 of the 126
    other granted effects that PoB makes active skills make hits, and 121 gems have a child.
- **AC-K65 (C-37 stat sets named).** Gem mode already names and numbers each stat set (`Stat set <n>:
  <label>`, AC-K1), and that number is what `skills.main.statSet` and `set_main_skill`'s `skill_part`
  take. Mechanic mode's gem hits now carry it too, so a card can name the stat set its payoff uses (C-52).
  - **Sources.** A hit from a stat set of the gem's first granted effect has the source
    `<gem> (stat set <n>: <label>)`. A hit from another granted effect has
    `<gem> / <effect> (stat set <n>: <label>)`, the effect named as its `Also grants:` line names it.
    Description, quality and Gemling hits keep `<gem>`, `<gem> (quality)` and `<gem> (Gemling quality)`.
  - `{query:"Consumed Blood Loss", kind:"gem"}` includes `[gem] Blood Hunt (stat set 2: Explosion): Enemies
    lose Life equal to 25% of Consumed Blood Loss`.
  - `{query:"originating from a Unique enemy", kind:"gem"}` includes `[gem] Wing Blast (stat set 2:
    Shockwave): 50% more damage with Hits for Shockwaves originating from a Unique enemy`, the payoff the
    Wing Blast study names.
  - `{query:"Heavy Stun buildup caused by Blood Loss", kind:"gem"}` includes `[gem] Bloodhound's Mark /
    Blood Explosion (stat set 1: Blood Explosion): Gains up to 100% more damage and 100% more area of
    effect based on the percentage of target's Heavy Stun buildup caused by Blood Loss`.
  - Every stat-set hit in the Lua action's full gem-hit list for `Explosion` names a stat set whose
    described lines include the hit's line, at the gem's default level and quality 0 (Lua query).

## 5. Test strategy (this slice)

| AC | Class | File |
|---|---|---|
| AC-K1…K6, AC-K45 | in-process, engine-required | `tests/integration/lookupGameData.test.ts`; AC-K6 in `engineKinds.test.ts` |
| AC-K7…K9 | in-process, engine-required | `tests/integration/searchTreeNodes.test.ts` |
| AC-K10…K14, AC-K46 | in-process, engine-required; AC-K46 also in `contract.test.ts` | `tests/integration/modelCoverage.test.ts` |
| AC-K15…K19 | in-process, engine-required | `tests/integration/skillBreakdown.test.ts` |
| AC-K20…K22, AC-K44 | in-process, engine-required; AC-K21's bound (D-246) also unit | `tests/integration/rankerAmendments.test.ts`; `tests/unit/passiveUpgradesBound.test.ts` |
| AC-K23…K30 | in-process, engine-required; AC-K30 via `session.run` and `contract.test.ts` | `tests/integration/manageSets.test.ts` |
| AC-K31…K38 | in-process, engine-required; AC-K35 also static | `tests/integration/treeState.test.ts` |
| AC-K39…K41 | in-process, `fixtureFetch`, no engine | `tests/mcp/datedPrices.test.ts` |
| AC-K42 | stdio end-to-end (`spawnServer`), engine-required | `tests/e2e/serverTools.test.ts` |
| AC-K43 | in-process, `fixtureFetch`, no engine; direct handler calls with a stub trade client | `tests/mcp/tradeErrorPrefix.test.ts` |
| AC-K47…K49 (*target*, WU-52) | in-process, `fixtureFetch`, no engine | named by WU-52 |
| AC-K50, AC-K53…K57 (*target*, WU-54) | in-process, engine-required | `tests/integration/modelCoverage.test.ts` |
| AC-K51 (*target*, WU-60) | in-process, engine-required | `tests/integration/lookupGameData.test.ts` |
| AC-K58…K65 (*target*, WU-53) | in-process, engine-required; AC-K63's `lookups.md` check static; the new samples also in `engineKinds.test.ts` (AC-K6) | `tests/integration/lookupGameData.test.ts` |
| AC-K52 (*target*, WU-50) | script check | `docs/build-guide/spikes/WU-50-poe-ninja.md` |

**Kind checks.** `engineKinds.test.ts` runs every new `ok` sample from §3. The `read` samples (the
three lookup modes, both coverage samples, G's breakdown, the ascendancy search, `include_ascendancy`,
and `manage_sets`' `list` samples, which run as `read` by D-244's per-call rule) leave the canonical export
and `revision` unchanged. The `mutate` samples change both; none declares `stateChange:false`.

**Fixture ownership** (spine §8). Each unit adds its own `tool-calls.json` and `tool-disposition.json`
entries. WU-32 owns `items/coverage-amulet.txt` and `tests/e2e/serverTools.test.ts`, whose `tools/list`
check WU-35 and WU-36 extend; both therefore depend on WU-32. WU-36 owns `items/jewel.txt` and
`$JEWEL_TEXT`, which it adds to the `PLACEHOLDERS` maps of `engineKinds.test.ts` and
`toolHygiene.test.ts`. Both files are serialized wiring shared with WU-40 (spine §8). WU-49 owns
`trade2/search-empty.*`. WU-31, WU-32, WU-35 and WU-36 each moved the count sites by +1. *Target:* WU-52
owns its new endpoints' fixtures and moves the count sites by k. WU-60 and WU-53 both edit `Lookup.lua`
and `lookupGameData.test.ts`, so WU-53 follows WU-60 (D-317).

**Regression guard.** Every unit gate keeps green, unchanged except for count literals: the stabilization
ACs AC-E16, AC-E28, AC-E29, AC-E32, AC-E35, AC-E38, AC-E39 and AC-E41; AC-T19 (`get_item_price`'s
primary-currency normalization); the golden tests (AC-B5); and the hygiene and static scans (AC-B2).

## 6. Compatibility, slice choices and open items

**Compatibility.** Every amended tool keeps its default output. Callers now get correct
`search_tree_nodes` results where they got none (`'any'`) or an arbitrary subset, connected trees from
`update_tree_delta`, PoB2's stat set from `skill_part`, and two new lines from the price tools. A trade
error's text gains the `[trade:<kind>] ` prefix after `Error: ` (D-218); its message is otherwise
unchanged. Set titles are stricter (D-245), `get_passive_upgrades` may leave out ranked entries' stat
lines to keep its can't-measure section whole (D-246), and `update_tree_delta` refuses an add that would
untag a weapon-set branch (D-308). The target units only add: new tools in group `ninja` (WU-52), new
lookup output (WU-53, WU-60) and new coverage flags (WU-54). Rollback is a revert of the unit's merge.

**Choices made here** (the [slice] marks; fold into the spine at ratification):
- **Accepted by the coordinator (2026-10-07), now spine decisions:**
  - lookup results default to 20, capped at 30 (D-225);
  - the possibly-unread method is S-b's by-name scan, run by the server (§2.4, D-226);
  - jewel slots join `add_item`'s enum only, so AC-E38 is unchanged (D-223);
  - C-49 has no batch mode: each call prices one item, and the limiter does the pacing (D-224);
  - the bridge param `skillPart` is renamed `statSet`, the one non-additive bridge change (§2.1, D-222).
- **Still for ratification:**
  - argument names and defaults (D-190 leaves names to the formalizer): gem level `naturalMaxLevel`,
    quality 0;
  - sorting before the cap, id as the last tiebreak;
  - C-37's requirement lines: one list per line, for gem levels 1 to `naturalMaxLevel`;
  - coverage: build mode lists only lines that aren't fully parsed and stands alone; the name scan
    travels with each `check_coverage` request as `sourceNames` and `sourceTemplates`;
  - C-45's bound: one group per call, non-zero fields only;
  - tree state: `weapon_set_nodes` replaces, `attribute_choices` merges, both all-or-nothing;
  - `use_second_weapon_set` applies to the set the action targets;
  - an out-of-range `skill_part` is an error;
  - with `include_ascendancy`, all the build's ascendancy notables are measured and ranked in their own
    section;
  - the over-budget mark's wording, ` (over budget: needs <pathDist>, <r> left)`.
- **Settled by the build (coordinator decisions during M-10, now spine rows):**
  - unique mode shows compact matches, and full item text only for a single unique (D-239);
  - mechanic mode's `kind` filter and per-kind totals (D-240);
  - each stat set's base attack damage and critical hit chance lines (D-241);
  - build-mode coverage includes jewels in allocated tree sockets (D-242);
  - the name scan's concatenation templates, and `possibly unread` as advisory (D-243);
  - `manage_sets {action:"list"}` runs as `read`, through `engineKindFor` (D-244);
  - one `{…}` tag per title, at its end, and the untitled copy's ` (Copy)` title (D-245);
  - `get_passive_upgrades` bounds its own output and returns `refit` (D-246);
  - multiple-choice notables listed as can't-measure, and the reason labels (D-247);
  - ascendancy points counted as `CountAllocNodes` counts them (D-307);
  - `update_tree_delta`'s refusal of an add that would change a weapon-set tag (D-308);
  - `set_main_selection`'s optional `statSet` reply (D-309).

**Former spine nits, settled 2026-10-07.** The spine's C-2/C-5 row is a modified contract listing §2.1's
changes (D-222). WU-36 edits `add_item`'s enum, never the shared `ITEM_SLOTS` (D-223).

**Open** (all target; each has a settled route):
- WU-53's output formats and checkable criteria, for each lookup addition. The unit's first step pins them
  in §2.2 and §4 from amendment 3's text, and the coordinator reviews them before any code is written
  (A-33);
- the status names or wording, and a test example, of the four WU-54 flags other than the Mirage Archer
  one (AC-K50). The same first-step rule applies (A-33);
- C-54's tool names, arguments, outputs, engine kinds, cache lifetime and back-off, and the popularity
  threshold: outputs of WU-50's report, recorded in §2.10 and the decision log when it merges (D-324).

**Settled earlier.** The two former open items:
- `include_ascendancy` marks notables beyond the build's remaining ascendancy points and never hides them
  (§2.6, AC-K44; D-227);
- C-37 gives each gem's level requirement per level and its attribute requirements (§2.2, AC-K45; D-228),
  which D2 and V1 need.
