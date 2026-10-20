# D1-build: the endgame rungs' build (`build-guide-coordinator`)

The first of D1's three steps (D-356, D-418). You design the three endgame stages of `plan.json`, the rungs of
the endgame ladder: entering maps (`m`), budget (`b`) and non-budget (`n`), with the needs their trees keep, and
take them to a passing survival floor with measure-only compiles. The endgame is designed first, and a campaign,
when the user asks for one, is planned backward from it (D-104). D1-tree (`D1-tree.md`), a fresh step, then
spends the trees' spare points and shortens their travel by PoB's node power; D1-finish (`D1-finish.md`), a fresh
step, then adds the anoint, the prices, the ledger and the claims; a fresh D1 gate step (`D1-gate.md`) checks
them all; after the user's design gate, F1 (`F1.md`) runs the final compile, and D2 adds the campaign only on
request (D-411, D-413).

## Inputs

- **The build's folder** (D-412): the header's `buildFolder` under `runFolder`, `builds/<id>`, or `.` for a run
  migrated from schema 3. `plan.json`, `compile-record.json` and the compiled XML are there; below, a bare
  `plan.json` or `compile-record.json` is that folder's, and `<plan>` is `<runFolderRel>/<buildFolder>/plan.json`
  (`<runFolderRel>/plan.json` when `buildFolder` is `.`). The cards, the dossier and `run-log.json` are at the run
  folder's root.
- **Header:** `stage: "D1-build"`, `attempt`, `concept`, `mode`, `runFolder`, `runFolderRel`, `buildFolder`,
  `compile: "measure-only"`, `writes: ["<buildFolder>/plan.json"]`, `accepted` (findings the user accepted at an
  escalation; they need no fix), and `findings`:
  - on a D1 gate retry, the earlier verdict file and its findings (`{part, code, stage, message}`): fix what
    each failing one names (an `over-target` or `chaos-exception` finding is information: leave it; a
    `tree-swap` finding is D1-tree's, which runs after you); a note when an earlier attempt returned without
    writing;
  - on a guided retry, the escalated verdict's findings, then the user's guidance (`code: "user-guidance"`),
    which you follow;
  - the user's requests (`code: "user-request"`), which you make: on attempt 1, a revision that rode on the
    card the verification gate finalized (D-391); the design gate's `revise:<text>`; a final-gate revision. A
    passive node the user asks for is a need (step 5);
  - in the fix round, the V4 findings D1-finish handed on as build changes (`{id, artifact, location, claim,
    issue, evidence, owner}`).
- **Prompt:** whether to write `plan.json` anew (attempt 1 of a fresh design) or edit it, and the gate's
  interview notes when the user asked questions there: read them.
- **Read**, the independent reads in one response:
  - `dossier.md`, the verification gate's comparison table: the card's row (Grep `^| <id> |`), with its key
    numbers, prices and league (D-355);
  - the card `cards/<id>.md` (its chain, enabler, links, structure check, checklist results and estimates), and
    its skeleton `concepts/<id>/plan.json` through `mcp__pob2__guide_run {view: {plan:
    "<runFolderRel>/concepts/<id>/plan.json", stage: "<stage id>"}}`, one call per stage, batched;
  - `docs/build-guide/plan-reference.md` by section, never whole: Grep `^#` for its headings and Read the
    worked example and "Count and custom modifiers" ("A minion's skill" too, for a minion skill); when
    `validate` names a field, Grep that field's table row;
  - the facts under `data/`: `data/campaign/limits.json` (`passive-points.max`, `ascendancy.max`,
    `resistance-penalty.endgame`) and `data/enemies/waystones.json` (`area-level.offset`, `area-level.max`); with
    no campaign stage, `data/campaign/progress.json`'s reward choices (step 7);
  - `run-log.json`, at the run folder's root: has pricing stopped in this session (D-415, D-422)? A `stages[]`
    entry after the last resume (from index `resumes[<last>].lengths.stages`; every entry when the log has no
    resume) whose `priceOutcomes` counts a `locked_out` or `rate_limited` call;
  - `.claude/skills/build-guide/references/patterns.md`, the pattern library, **whole**, before you design `b`
    and `n` (D-375, step 3), and the rule-changer index (D-401): `data/rules/nodes.md`'s section for the card's
    ascendancy and its `## Keystones`, and Grep `uniques.md`, `gems.md` and `pairs.md` there for the build's
    families. An index line is a lead: confirm it with a lookup.

## Work

1. **Start.** When the prompt says to write `plan.json` anew, write it whole from the card's skeleton, at
   `schemaVersion: 6` (`docs/build-guide/plan-reference.md`): its `roll` and `versions`, `prices: []` (step 6
   adds the rares' entries), and only the endgame stages below. A `plan.json` already in the build's folder belongs to an earlier design and is
   replaced. Otherwise edit `plan.json`: fix what each finding names, and keep any campaign stage D2 wrote and
   everything D1-tree and D1-finish wrote that your change doesn't touch.
2. **League** (C-31, D-233, D-422):
   - offline: `null`;
   - online: `mcp__pob2__get_leagues`' current trade league (not Standard, Hardcore or a private league);
   - **once pricing has stopped** (Read, above), no trade call at all, `mcp__pob2__get_leagues` included: keep the
     league the plan already has, else take the league a price result of this run recorded before the stop (an
     `ok` entry of a card's skeleton);
   - if `mcp__pob2__get_leagues` can't be reached, a league a price result of this run recorded (an `ok` entry of a
     card's skeleton, whose league the trade site gave);
   - **never** a league the dossier or a skeleton marks unverified (R1b's fallback, `leagueUnverified`),
     and never a guess such as Standard. With no league known, write `"league": "unverified"` and return
     `leagueUnverified: true`: D1-finish then makes every price `unavailable` (note `trade unreachable`), and
     the guide says the league couldn't be verified.
3. **The three rungs**, after any campaign stage, in ladder order: `m`, `b`, `n`. Design `b` and `n` first,
   then `m` (D-281):

   | | Entering maps | Budget variant | Non-budget variant |
   |---|---|---|---|
   | `id`, `variant` | `m`, `entering-maps` | `b`, `budget` | `n`, `non-budget` |
   | `loadoutName` | `Entering maps (L<level>) {m}` | `Endgame budget (L<level>) {b}` | `Endgame non-budget (L<level>) {n}` |
   | Aim | the player's setup just after the campaign, plus buys toward a 5-divine target at day-7 prices (D-370): T1 to T5 maps, gated at T5 (area 69: `enemies/waystones.json#area-level.offset` plus 5); the cheapest setup that passes its gate with the same skill and supports as `b` (D-281) | T15 maps (area 79: `enemies/waystones.json#area-level.offset` plus the tier) without dying often, each rare aiming at about 5 divines at day-7 prices (D-370) | as strong as possible for 100–200 divines in all at day-21 prices, each rare with its own target (step 6; D-370): T16 (area 80) up to area 82, heavily modded waystones and tablets (D-115) |

   Each stage has `progress: "endgame"`, its own `level`, `ascendancyPoints` and per-gem levels, and
   `variantBasis` giving the source of each (D-193): a C-30 tag, or a `judgment` tag stating the
   rationale. The spec fixes no number: choose what a player of that rung has. `m`'s level is above the
   campaign's last stage. Within `m`'s 5-divine target the key item may fit `m` (a unique, or a rare with a stat
   floor, such as a weapon's elemental DPS or an energy shield total); when it doesn't, it is the trigger into `b`.
   - **The pattern library first** (D-375). Before you design `b` and `n`, read
     `.claude/skills/build-guide/references/patterns.md` whole, as the R1a researchers do. Ask its brainstorm
     questions of this build, not of a new concept: what feeds the payoff, which routine action already makes the
     resource it needs, which +level sources and supports reach the skill, and how its required state fails. A
     shape is a starting point, never a fact: check every use with a lookup and measure it with a measure-only
     compile like any other change. The `reason` that keeps it in the plan (D1-finish's claim) cites the lookup
     and the measurement, never the library.
   - **The levers, measured** (D-406). Then redo the levers line of the card's `### Structure check` with the
     skeleton's compiled figures (its record, by Grep): for each big lever of its archetype's Standard kits
     entry (minion levels, Spirit and minion types for a minion build), what `b` and `n` pull. Pull what the
     design can; return each lever it leaves unpulled as `lever unpulled: <lever>: <why>`.
   - **One tree track** (D-282): `m` continues from the campaign's last stage, `b` from `m` and `n` from `b` (`m`
     from none when the plan has no campaign stage), so each rung's tree contains the one before it, except where
     its `respec` drops nodes (`respec {dropped, goldCost, note}`, the gold cost a `judgment`, the note naming the
     dropped nodes as the tool names them, since W1 reads no node ids); V1 checks each rung's respec and its gold
     cost.
   - **The ascendancy order** (D-413): list `m`'s `tree.ascendancyNodes` in the order to take them, each node
     before the one that paths through it, the one the build needs first earliest; `b` and `n` keep that order
     for the nodes they share and add theirs after. D1-finish's claim names them in that order, which the guide
     gives the reader.
4. **Skills** (D-120, D-122, D-148, D-217, D-295). The card's named damage source is the plan's
   `roll.skill` (D-286).
   - **The build's named damage source is the main source of damage, never a token role.** (D-122, as D-295
     words it.) For a fixed skill that skill is the named source, and its own hits, ailments and projectiles
     count when another skill fires, spreads or copies them. Its group is `skills.rolledGroup` (the name
     stays, D-295).
   - **The named damage source should be the clear skill. It takes the single-target role only when it can't
     clear, and the guide says so.** (D-148, as D-295 words it.) Its group's role is then `single_target`, and
     D1-finish writes the claim that says why.
   - Its figure, × its Count, must be the largest of the stage's groups with that role: the gate compares
     one Count-scaled record field for every group (`countedSkillOutputs[g<group>s<skill>p<statSet>].fields.<Field>`,
     the same `<Field>` for each, named `g<group>s<skill>p<statSet>.<Field>`), or a ledger value. A group whose
     damage is its minion's (it names a minion skill, or its skill summons a minion, as a plain Skeletal Warrior
     does) is compared by its minion's `Minion<Field>` at the same key (`MinionTotalDPS`, D-378, D-385).
     Never give a damage skill the `utility` role to keep it out of the comparison.
   - Put the named source's group first (`skills.main.group: 1`, `main` on the named source): every
     stage shares the main group's index, and D2 holds a bridge skill there until the named source's
     requirement (D-301).
   - **A minion skill** (D-379) is its group's `minionSkill`, by the gem lookup's name: the group holds the
     summon its `Cast by:` line names, and `main.activeSkill` is the summon, never its "Command" skill. Add
     `minionStatSet` when the skill has several stat sets (Kelari's Deception has two), the one the gate
     compares.
   - **Set `skills.main.statSet`** on each variant stage to the named source's stat set whose figure the
     gate compares, `p<statSet>` in `g<group>s<skill>p<statSet>.<Field>` (amendment 1 S7): the PoB file
     opens on the main stat set, so the guide's headline figure must be that set's. A skill whose damage
     comes from a later stat set (an explosion after a dash) names that set here. `skills.main.group` is the
     `rolledGroup`, and the rolled figure, or every breakdown field a ledger figure's formula reads, is
     `<stage>.g<main.group>s<main.activeSkill>p<main.statSet>`. For a minion skill `statSet` is the summon's (1).
   - One loadout has a one-click clear and a single-target setup (D-120). Every group has a `role`; every
     gem its level and quality. **No dead gems** (D-396): every gem in a stage's loadout does something at that
     stage, and one whose condition the stage can't meet stays out of it: return it as `left out: <gem> on
     <stages>: <why>`. `mcp__pob2__suggest_supports` ranks supports and lists
     what PoB can't measure (C-47).
   - **Overriding PoB's ranking** (D-407). PoB ranks by damage and can't measure area, a supply's rate or pace
     between packs, so clear speed may want a support, passive or item it ranks lower. Return each such choice
     as `override: <PoB's first choice> → <ours>: <why>`.
   - **A tamed beast** (D-402) is a stage's `companion {species, mods}`, with one `Tame Beast` gem, enabled, in
     an enabled group (`docs/build-guide/plan-reference.md`, "A tamed beast"). The compile writes PoB's three
     companion options and each kept `condition` modifier's option as earned state: list none of them. Its
     Spirit cost is a percentage of your Spirit, so more Spirit costs it more.
   - **Count and custom modifiers** (D-293; `docs/build-guide/plan-reference.md`, "Count and custom
     modifiers"). Where several copies of a group act at once (totems, minions that each cast it, mirages),
     set the group's `count` with a `countReason` saying why that many act at once and what grants them
     (a node, an item or gem text, with its source). Where PoB doesn't model an effect the build relies on and
     a modifier line can stand for it, add a `config.customMods` entry `{text, reason}`: one PoB modifier line,
     its reason saying what it stands for and how its number was worked out. A missing reason is a V1 finding
     (`missing-reason`). Both are estimates (D-296): the record applies Count to the named source's figures
     (`countedSkillOutputs`) and marks every figure of a stage with a custom modifier
     (`computedWithCustomMods`), and the guide lists each with its reason. **After setting Count** on a group
     whose skill reserves once per copy, on totems under Ancestral Bond, or on a group whose Umbral Well buffs
     it scales, check the stage's reservation and those buffs in the record: Count multiplies them too.
5. **Tree.** A node list within the points the level allows (`data/campaign/limits.json`:
   `passive-points.max`; the ascendancy at most `ascendancy.max`), with its weapon-set nodes and attribute
   choices. Start from the skeleton's tree, a sketch of the card's targets (D-418): keep its targets with their
   paths, and path to what the needs below require; never path to a further target for damage or clear. That
   tuning is D1-tree's: it spends the points you leave unspent on each rung's best nodes per point, their paths
   counted, and swaps weak branches by PoB's node power, minimizing travel (the user's rule, `patterns.md`).
   - **The needs** (D-418, plan schema 6): what each rung's tree must keep whatever node power says, as
     `tree.needs[] {nodes, stat?}`, written **without `claim`** (D1-finish writes the `reason` claim and sets
     it). `nodes` are nodes of that stage's `tree.nodes` (a schema error otherwise); `stat` is the power stat
     that measures the need, by PoB's id as `mcp__pob2__get_node_power` names it (`ManaRegen`, `TotalEHP`),
     when PoB has one, and none for one it can't measure (area for clear). Write a need on the first rung that
     holds its nodes: the later rungs keep it, since D1-tree's `keep` holds the rung before's nodes. Node
     power can't see these, so each is a need:
     - mana or life sustain the build's skills run on;
     - an attribute a gem or item of the stage requires;
     - area or movement for clear;
     - a boss-only gain: penetration and exposure count for nothing on a clear config with no enemy
       resistances;
     - a defence the floor needs;
     - a node the card's engine names, and a node that grants a skill of the stage (`Grants Skill:`);
     - **every producer of the stage's earned config state** that is a passive node
       (`config.earned[].producer`, step 7), which V2 checks is present;
     - a node the user asked for, in a `revise:` or a gate's `changes`.
   - **The tree's shape** (D-360, as the coordinator's ruling D-364 states it), on every stage:
     - a tree is a connected group of allocated nodes, the class start not counted;
     - a start holds at most one tree, so a loop through two exits of one start is one tree, and legal;
     - an alternate start, such as Path of the Sorceress (12795, which links exits 4739 and 44871), is opened
       only while its node is allocated: so at most two trees with it, and one without;
     - the ascendancy tree is connected to its start;
     - the compile's V1 check `tree-shape` refuses the rest, naming the stage, the start and the trees.

   After a compile, the loaded build answers `mcp__pob2__find_path_to_node`, `mcp__pob2__get_nearby_nodes`
   and `mcp__pob2__get_passive_upgrades` (with `include_ascendancy: true` for ascendancy notables); both rankers
   list what PoB can't measure (C-47). The two path tools never open a second tree on a start; the tools that
   follow PoB's own paths (`mcp__pob2__get_passive_upgrades`) are caught only by `tree-shape` at the compile.
   Leave `mcp__pob2__get_node_power` to D1-tree.
6. **Items.** Every slot the variant uses (`Weapon 1` first) and every tree jewel, flasks and charms with
   their toggles. `b` and `n` wear an amulet: D1-finish anoints it (D-358), and leaves `m` without an anoint. A
   unique's text comes from `mcp__pob2__lookup_game_data {mode: "unique", query: <exact name>}`. A rare is an
   affix target: realistic rolls a buyer finds on trade around its target; nothing is crafted, and no
   item-base or mod-tier search serves crafting (D-348). When an affix can't roll on every base of its slot
   (`mcp__pob2__lookup_game_data {mode: "mechanic", query: <the affix text>, kind: "mod"}`: each `[mod]`
   hit's `Base types:` lists the bases that can roll it), fit the slot's item to that base. An off-hand made
   legal only by Giant's Blood, Instruments of Power or Lord of the Wilds needs that node or item in the same
   stage.
   - **Required affixes and targets** (D-370, D-372). For each rare gear slot and rare tree jewel of `b` and
     `n`, write its `prices[]` entry for D1-finish to price with PoB2's weighted trade search:
     `{"id": "b-helmet", "item": "<a short description>", "query": {"slot": …, "required": […], "target": {…}},
     "amount": null, "currency": null, "date": "<the run folder's date>", "league": <the plan's league>,
     "status": "unavailable", "note": "not priced yet"}` (offline, `"note": "offline run"`, which a null league
     needs), its `id` as D1-finish names it (`b-ring1`, `n-jewel-<node>`). When you change such a rare, write its
     entry again this way.
     - `slot`: the slot as `mcp__pob2__find_upgrades` names it (`Helmet`, `Ring 1`, `Jewel <node id>` for a
       tree jewel).
     - `required`: the slot's **required affixes**, at most 3, each `{"affix": "+# to maximum Life", "min":
       60}`: what the slot can't do without, such as the build's damage type, a resistance the floor needs, or
       skill levels. They become the trade search's AND group, and PoB's weights value the item's other
       affixes. An affix PoB can't value (one it doesn't parse) is always required.
     - `target`: on `b`, `{"divines": 5, "day": 7}`. On `n`, `{"divines": <its share>, "day": 21}`: by default
       150 divines shared evenly over `n`'s rare slots and rare tree jewels. A slot that carries the build (a
       weapon, a skill-levels amulet) may take more, with `"reason"` saying why; `n`'s targets together are at
       most 200.
     A target guides what you design; it is never a reason to drop or weaken a piece the build needs (D-371).
7. **Config** (C-32, D-114; `config.earned` and `config.scenario`).
   - **Earned state**, `{option, value, producer, uptime}`: every stack, charge, buff or condition the
     numbers rely on, with the producer present in the stage (V2 checks it) and an honest uptime. Every
     skill-conditional option PoB shows for the stage's skills is earned state too, listed with its
     producer and uptime (D-250): the baseline list covers such an option only while PoB hides it.
   - **Campaign reward picks** (D-265): the endgame stages carry the campaign's reward picks. For every
     reward choice a campaign stage picks (a `config.scenario` entry whose `source` is
     `campaign/progress.json#q.<key>.options[<i>]`), `m`, `b` and `n` list the same entry, the same pick, so
     the record's endgame numbers include the reward the guide tells the player to take. Whenever you edit a
     plan that has campaign stages, keep them, and add any a campaign stage picks that a rung lacks. The run
     checker fails an endgame stage that leaves a picked choice at Nothing or picks it another way.
   - **The reward picks without D2** (D-413): a plan with no campaign stage (an endgame-only build) gets its
     picks from you. For **every** reward choice the campaign offers, each quest with a `q.<key>.options` fact in
     `data/campaign/progress.json`, its PoB option the quest's `q.<key>.pob-config-key`, pick the option this
     build gains most from (what its skills use, or the defence its endgame leans on), and list it on **all
     three rungs**, the same pick on each: `{"option": <the pob-config-key's value>, "value": <the picked option,
     exactly as the fact lists it>, "source": {"file": "campaign/progress.json", "key": "q.<key>.options[<i>]"},
     "tag": <the fact's tag>}` in `config.scenario`. The endgame numbers then include them, and the endgame guide
     names each pick. D2 keeps your picks when the campaign is added later. The run checker fails a rung without
     a pick, or rungs that pick a choice two ways.
   - **Scenario inputs**, `{option, value, source: {file, key}, tag}`, each value the cited fact's own,
     with the fact's tag copied:
     - `enemyIsBoss` from `enemies/map-monsters.json#pob-enemy-is-boss`: the variants model mapping
       (D-119);
     - `resistancePenalty` from `campaign/limits.json#resistance-penalty.endgame` (−60, D-118);
     - **the five reference hits are the compiler's** (D-353): leave `enemyPhysicalDamage`,
       `enemyFireDamage`, `enemyColdDamage`, `enemyLightningDamage` and `enemyChaosDamage` out. The compiler
       fills each from the data at the rung's area level (69 for `m`, 79 for `b`, 82 for `n`): the map
       monsters' damage at that level × (1 + the top of the waystones' increased-damage modifier / 100), and
       × the top of their extra-damage modifier / 100 for an element, rounded up to a whole number; the
       record's `configWritten` holds every hit it wrote. Write no `hit_*` ledger entry. A hit you list stays
       as listed;
     - on a stage whose scenario is a boss (`enemyIsBoss` other than `None`), the enemy's level, armour,
       evasion, resistances and crit are scenario entries citing E1 (D-252).
8. **Survival floor** (D-118, D-119, D-234), on each of the three rungs. At the −60% penalty, fire, cold,
   lightning **and chaos** resistance are capped (`Missing<Elem>Resist` 0), and each of the five reference
   hits the record wrote is below its `<Type>MaximumHitTaken`. Cap chaos resistance. Only when capping it is
   **infeasible** (Chaos Inoculation; no slot can carry chaos resistance without dropping a core item or
   going far over its price target) add `chaosResistException {reason, tag}` to that stage: one sentence naming what makes
   the cap infeasible, tagged. Never add it to avoid work; a stage with the exception and a capped chaos
   resistance needs none.
9. **Measure.** Validate with `mcp__pob2__guide_run {validate: "<plan>"}` until it reports no
   error, then compile measure-only (`mcp__pob2__compile_plan {plan_path: "<plan>",
   measure_only: true}`). Its reply gives each stage's key-figure line (the headline DPS, life, energy shield,
   EHP, the four resistances, the V1 and V2 finding counts, the Arbiter verdict and the rough clear speed) and
   its V1 and V2 findings: read the floor there, and Grep `compile-record.json` only for what the reply
   lacks (`<Type>MaximumHitTaken`, the hits in `configWritten`, `countedSkillOutputs`). Iterate on clear speed and damage
   once the floor holds (D-118), with the gear, gems and config: the rough clear speed leads, and bosses are a
   floor (D-407); the tree's points beyond its targets and needs are D1-tree's. A V1 `missing-reason` on a need
   (`tree.needs[<m>].claim`) is expected: D1-finish writes the claims. Never a final compile.
   - **A `possibly unread` line** (`mcp__pob2__check_model_coverage`) the variant depends on is confirmed by
     measurement before any hand calculation (D-243): add a temporary stage that copies the stage under
     test without that line, compile measure-only with `stages` naming the two, and compare their
     outputs. Numbers that move mean PoB reads the line. Remove the temporary stage before you finish. A
     **partly parsed** line means PoB applies none of it: D1-finish hand-calculates the whole line.
10. **Claim.** `done` when the three rungs are written and you expect them to pass. `infeasible` only when
    this card can't meet the survival floor, or the named damage source as the main source of damage, at any
    arrangement you tried; give the reason in a sentence. A price is never a reason (D-371). The gate still
    runs and decides.

Offline mode: no WebSearch, WebFetch or price tool.

## The fix round and revisions (D-264, D-352)

With the D1 gate's findings, the user's requests or V4 findings in `findings`, you edit the plan in place; you
never write it anew.

1. **Recompile only for a build change**: gear (an item, a tree jewel, a flask or charm), the tree, the gems
   or the config (earned or scenario). Every change you make is one of these, so measure it as step 9 does;
   D1-tree runs after you (it keeps your needs and spends the points you leave), D1-finish then prices and
   claims what moved, and the D1 gate runs after it. A node you add or a need you change is a tree change like
   any other: write a node the user asked for as a need (step 5).
2. **Leave the rest to D1-finish.** The anoint, the prices, the ledger and the claims are D1-finish's. A
   change to a ledger entry's formula or inputs needs no recompile: the record's `buildSha1` leaves out the
   ledger, and the run checker re-evaluates the plan's current ledger (D-352).

## Writes

`<buildFolder>/plan.json` only. The server writes the record and the XML beside it.

## Returns

At most 8 lines: your claim, `done` or `infeasible` with its reason in a sentence; how many
`mcp__pob2__compile_plan` calls you made; `league unverified` when no league could be verified online (step 2);
each `left out:`, `lever unpulled:` and `override:` line; with findings, the finding ids you fixed and the locations you changed (`plan.json
stages[3].items`); and for D1-tree, which runs after you, one line `for D1-tree:` with each rung's floor (`floor
holds on m, b, n`, or the rungs where it fails) and its needs counted (`needs m 3, b 2, n 1`).

```
D1-build r1-a-2 attempt 1: done
compiles: 4
for D1-tree: floor holds on m, b, n; needs m 3, b 2, n 1
```

```
D1-build r1-a-2 attempt 3: done
compiles: 1
fixed: v4-1-3
changed: plan.json stages[6].items, plan.json stages[6].tree
```

## Fault directives

None. FI-2 and FI-3 are the D1 gate's (`D1-gate.md`).
