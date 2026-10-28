# D1-build: the endgame rungs' build (`build-guide-coordinator`)

The first of D1's three steps (D-356, D-418). You design the three endgame stages of `plan.json`, the rungs of
the endgame ladder: entering maps (`m`), budget (`b`) and non-budget (`n`), each with its own tree and the needs it
keeps (one tree per loadout, D-452), pick the build's defence before you tune it (D-451), and take the rungs to a
passing survival floor with measure-only compiles. The endgame is designed first, and a campaign,
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
  `compile: "measure-only"`, `writes: ["<buildFolder>/plan.json", "<buildFolder>/pieces.md"]`, `accepted`
  (findings the user accepted at an escalation; they need no fix), and `findings`:
  - on a D1 gate retry, the earlier verdict file and its findings (`{part, code, stage, message}`): fix what
    each failing one names (an `over-target`, `chaos-exception` or `boots-exception` finding is information:
    leave it; a `tree-swap` finding is D1-tree's, which runs after you); a note when an earlier attempt returned
    without writing;
  - a user's request about the tree alone on a plan still at schema 7 (a build designed before amendment 12):
    move the plan to schema 8 (step 1) and leave the tree to D1-tree, which makes the request after you (D-452);
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
  - `dossier.md`, the verification gate's comparison table: the card's row (Grep `^| <id> |`), with its damage
    kinds, its pieces, key prices and league (D-355, D-436). It holds no figure: the design measures them;
  - the card `cards/<id>.md` (its chain with its `Means:` lines, enabler, links, structure check, checklist
    results and estimates, and its Pitch's `Defence:` line; a composite's `### Pieces` and `### Pieces measured`
    tables), and
    its skeleton `concepts/<id>/plan.json` through `mcp__pob2__guide_run {view: {plan:
    "<runFolderRel>/concepts/<id>/plan.json", stage: "<stage id>"}}`, one call per stage, batched;
  - the pieces (D-434): the deck's `## Pieces not used` (Grep `-A11 "^## Pieces not used"` in `cards.md`), and
    `<buildFolder>/pieces.md` when an earlier attempt wrote it;
  - `docs/build-guide/plan-reference.md` by section, never whole: Grep `^#` for its headings and Read the
    worked example and "Count and custom modifiers" ("A minion's skill" too, for a minion skill); when
    `validate` names a field, Grep that field's table row;
  - the facts under `data/`: `data/campaign/limits.json` (`passive-points.max`, `ascendancy.max`,
    `resistance-penalty.endgame`) and `data/enemies/waystones.json` (`area-level.offset`, `area-level.max`); with
    no campaign stage, `data/campaign/progress.json`'s reward choices (step 7);
  - `run-log.json`, at the run folder's root: is pricing stopped (D-444)? A `pricing.stops[]` entry with no
    `retry-pricing` answer in `pricing.retries[]` and no resume (`resumes[].lengths.stages`) after it
    (`references/run-log.md`, "Pricing stops"): then no trade-site request until a gate's `retry-pricing`;
  - `.claude/skills/build-guide/references/toughness-targets.json` (D-441), the non-budget rung's toughness targets,
    and its `arbiter.hitsSurvivedFloor` (0.8, D-449): a rung isn't one-shot by an Arbiter hit when it survives the
    full hit or at least 80% of those hits, evading or deflecting them;
  - `.claude/skills/build-guide/references/patterns.md`, the pattern library, **whole**, before you design `b`
    and `n` (D-375, step 3), and the rule-changer index (D-401): `data/rules/nodes.md`'s section for the card's
    ascendancy and its `## Keystones`, and Grep `uniques.md`, `gems.md` and `pairs.md` there for the build's
    families. An index line is a lead: confirm it with a lookup.

## Work

1. **Start.** When the prompt says to write `plan.json` anew, write it whole from the card's skeleton, at
   `schemaVersion: 8` (`docs/build-guide/plan-reference.md`, "Defence that holds and one tree per loadout"): its
   `roll` and `versions`, `prices: []` (step 6 adds the rares' entries), and only the endgame stages below. A
   `plan.json` already in the build's folder belongs to an earlier design and is replaced. Otherwise edit
   `plan.json`: fix what each finding names, and keep any campaign stage D2 wrote and everything D1-tree and
   D1-finish wrote that your change doesn't touch. **A plan at an earlier version goes to 8 whenever you edit it**
   (D-452, §22): write `schemaVersion: 8`, drop every stage's `respec` (a schema-8 plan refuses it), and add
   `defence` on `n` (step 8); schema 7's fields stay.
   - **Temporary stages** (D-453): every measuring copy you add, here or in any D1 step, has an id that starts
     `tmp`, then letters and digits like every stage id (`tmpb1`, `tmpn2`); no stage counts it as its
     predecessor. Remove each before you finish, and when you start, remove any `tmp` stage a crashed step left in
     the plan.
2. **League** (C-31, D-233, D-422):
   - offline: `null`;
   - online: `mcp__pob2__get_leagues`' current trade league (not Standard, Hardcore or a private league);
   - **while pricing is stopped** (Read, above), no trade call at all, `mcp__pob2__get_leagues` included: keep the
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
     and the measurement, never the library. Questions 20 to 24 (D-458): 20 is the defence plan's (step 8), 21 puts
     the next buy in the emptiest multiplier pool, 22 (the ascendancy's fit) the card already settled, 23 is the
     shared scaling (below) and 24 the buttons a proxy could press.
   - **The wall rule** (D-457). Name each payoff apart from the means that supply it (question 2), and give each
     load-bearing supply a second means: the card's `Means:` lines, `<payoff>: <means>; second means <means | none
     found>`, are your start. **When a rung fails because a means doesn't deliver** (a supply that runs dry, an
     ailment that won't apply, a condition that won't hold), search other means to the same payoff before you tune
     the one that failed, and write a `## Searched` line in `pieces.md` for each search. When the best means changes
     the skill, the weapon or the ascendancy, return `stronger structure: <the means>: <why>` and write the same
     line under `pieces.md`'s `## Searched` (it survives a compaction or a resume): the runner offers it at the
     design gate, a `revise:` when the roll (class, ascendancy, skill) stays, a successor card when it changes.
   - **The levers, measured** (D-406, D-456). Then redo the levers line of the card's `### Structure check` with
     the skeleton's compiled figures (its record, by Grep): for each big lever of its archetype's Standard kits
     entry (minion levels, Spirit and minion types for a minion build), what `b` and `n` pull. **On `b`, measure
     the enemy-side levers beside crit, not before it:** Rage with Berserk on attacks, a reliable shock, exposure
     and curses. Budget crit items sell at the trade floor, so "crit costs more for less" isn't a reason to skip
     it. **Never inversion on `b`** (Rakiata's Flow costs about 185 divines; the user, 2026-10-26). On `n`, a
     build that inverts resistance skips the resistance levers (reduction, curses and exposure lower its damage).
     Two are not budget levers here: an ailment-type payoff and penetration with a lowered floor (penetration shows
     on the resisting figure, step 4). Pull what the design can; return each lever it leaves unpulled as `lever
     unpulled: <lever>: <why>`.
   - **The pieces: the design keeps synthesizing** (D-434). A composite (a card with `### Pieces`) was composed
     from the whole brainstorm, and its design goes on composing: start from its Pieces table (each piece in,
     scheduled or out, with why), its Pieces measured (each piece's drops) and the deck's `## Pieces not used`. A
     plain card's pieces are those its links table names, keyed `c<card id>-<m>` as R1a-synthesize keys them.
     Every piece's status ends in `pieces.md` (Writes). (A live run's design judged its pieces alone, and after
     Avatar of Fire entered searched mana sustain four times, fire payoffs and life costs never.)
     - **Ask the synthesis questions again** whenever the design adds a conversion or a keystone, or would name a
       limit as a con: the library's questions 15–19 (climb the chain, breadth, the limit, conflicts, bosses),
       and after a conversion its entries "Type conversion so another mechanic applies" and "Convert into the
       ailment's type". Search each with a lookup, and write a `## Searched` line for each.
     - **Revisit an out piece** whose reason the design changed (Zerphi's Infamy, out because the build spends
       mana, once Blood Magic moves the costs to life), and measure it as below.
     - **Judge a piece with the pieces it needs,** measuring the set together, before rejecting any of them (an
       ignite payoff with the conversion that makes the hit fire, and without the support that forbids ailments).
       Add a temporary stage that copies the rung with the set in, or without it when it is in, each piece left
       out by its kind (a support removed from its group; a skill's group disabled; a unique replaced by the
       slot's plain base of the same base type; a rare's mod line or a rune removed from the item; a node with the
       nodes that depend on it; a keystone with the custom modifiers that stand for it; a config condition turned
       off). Compile the two measure-only with `stages` naming them, compare, and remove the stage before you
       finish. Compare on each of the three kinds of figure (D-433), the total and each group, never summed across
       groups: **per second, for clear**, each enabled `clear` group's figure, the named source's Count-scaled one
       first; **per corpse**, each on-kill group's (a corpse explosion's) hit and its ignite per corpse; **for
       bosses**, each enabled `single_target` group's figure. A group's figure is the record's at the key of its
       main active skill and stat set (`countedSkillOutputs`, else `skillOutputs`; `skillOutputsSet2` for a group
       on set 2), a disabled group's counting as 0; the total is the named source's damage figure against map
       monsters, the key-figure line's `damage <map> against map monsters` (`measures.damage.map`). A set may pay
       on one figure and not another (Blistering Bond: 5% of the cry, 22% of the boss skill): weigh it on each
       before you leave it out.
     - **Schedule before rejecting** (question 18): a piece that fights another goes on its own button (a
       `single_target` group for bosses; a second clear group keeps role `clear` below the named source, step 4),
       its own weapon set (`skills.groups[].weaponSet`, "Weapon sets" in step 4) or a boss setup before it is out.
       It is out only when no schedule holds both sides and it is worth less than the piece it fights.
     - **Answer question 19 on every build** (D-458): what it presses on a boss; when the clear skill is limited
       (a cost, a cooldown, a charge count) or shaped for packs, the boss button, else why none is needed, in a
       `## Searched` line.
   - **One tree per loadout** (D-452). The user's ruling (2026-10-26): players respec freely, so each rung's tree is
     the best one for its loadout, and the only constraint across stages is one start node. Write each rung's
     `tree.scales`, one short line naming the stats that scale it ("crit damage, ailment magnitude, physical spell
     levels"); **with two or more damage skills** (question 23, D-458), the stats every damage group shares, and a
     node that feeds only another group is a need (step 5), measured on that group's figure. **Seed each rung's
     tree from the stage before it**, then design it free: `m` from the campaign's last stage, or from the
     skeleton's tree when the plan has none; `b` from `m`; `n` from `b`. A rung keeps none of the rung before's
     nodes by rule, so it drops what no longer serves it. **Mark no respec:** a schema-8 plan has no `respec`, and
     the record's `treeChange {from, refunded, added}` gives the guide each rung's change from the stage before.
     Gold is a note, never a reason to keep a node. A respec the user asks for is a tree request: D1-tree makes it.
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
     opens on the main stat set, so the guide's damage figures must be that set's. A skill whose damage
     comes from a later stat set (an explosion after a dash) names that set here. `skills.main.group` is the
     `rolledGroup`, and the rolled figure, or every breakdown field a ledger figure's formula reads, is
     `<stage>.g<main.group>s<main.activeSkill>p<main.statSet>`. For a minion skill `statSet` is the summon's (1).
   - **The damage figure** (D-437) on each rung is the named source's group figure by the record's Count rule
     (`TotalDPS` × Count, `TotalDot` × Count when its damage over time stacks, `IgniteDPS`, `BleedDPS` and
     `PoisonDPS` once; a minion's `MinionTotalDPS`), measured against map monsters and again against a Pinnacle
     boss (`measures.damage {map, boss}`), never PoB's Full DPS. **The resisting figure** (D-454) beside them,
     `measures.damage.resisting`: the same figure against the map enemy with 40% fire, cold and lightning
     resistance and curses at full strength, so penetration and resistance reduction show (they read zero on the
     map figure, PG-90), and a build that inverts resistance reads higher there. It has no threshold and no trade.
     **`skills.cull`**, on a rung whose rotation
     culls: the user (2026-10-25), "Map damage with cull if and only if the build explicitly utilizes culling in
     its skill rotation. Otherwise, map damage, no cull." Write it only then, a short text naming the culling
     source and the button that uses it ("Legacy of Deathblow's Culling Strike on Detonate Dead"); the map figure
     then carries the named source's `CullMultiplier`. A cull only another skill carries isn't counted, nor a
     skill's own incidental cull (Reap's) unless you state it here.
   - **The boss rotation** (D-447), on each rung: `skills.boss {entries, note}`, what the build presses or procs
     on a boss. Each entry selects one figure as `skills.main` does, `{group, activeSkill, statSet}` (the
     record's key `g<group>s<activeSkill>p<statSet>`); a Cast on Critical group names its spell, not the meta
     gem. List every skill the build presses or procs on a boss: what runs together (procs, both parts of one
     use, a setup and its payoff) and what takes turns (a filler between cooldowns, a charge builder and its
     finisher). **Write `turns: true` on an entry that takes turns with another.** **A skill's two stat sets**
     are two entries when both happen in one use (a hit and its explosion); alternatives (a plain or an infused
     cast) are entries only when the rotation uses both, and then they take turns (`turns: true`). `note` says
     how the fight goes: the order, what waits on a cooldown or on charges, what takes turns. Without
     `skills.boss` the rotation is the named source alone. Totems and other copies acting at once go in the
     group's `count`, never in the rotation. The compile measures each entry against a Pinnacle boss
     (`measures.bossGroups`, `triggered` by PoB's own trigger test) and sums the untriggered ones into
     `damage.boss`; D1-finish estimates by hand what PoB can't read (`boss_<stage>`), always for a triggered
     entry or one with `turns`.
   - **The engagement** (D-441), on `n`: `skills.engagement {kind, reason}`, how close the character stands to
     the enemies while it deals its damage, `close` (in or next to the pack or the boss) or `distance` (well
     away), with the reason from how the build plays ("Reap and the corpse blasts need the pack next to you"). The
     user (2026-10-25): "it's not so much the skill as how close the character has to be to the monsters." **The
     default rule**, from the named source's PoB skill types in the record (`measures.sourceTypes`): a minion,
     totem, trap or mine type, or a projectile skill that travels, is `distance`; a strike, slam or area around
     the character is `close`; write the other kind only when the build plays otherwise, and say why. It picks
     the rung's toughness target in `references/toughness-targets.json` (20,000 close, 15,000 distance), which
     the design gate shows beside the reason, so the user can correct it; the run checker fails a non-budget
     rung without it.
   - One loadout has a one-click clear and a single-target setup (D-120). Every group has a `role`; every
     gem its level and quality. **No dead gems** (D-396): every gem in a stage's loadout does something at that
     stage, and one whose condition the stage can't meet stays out of it: return it as `left out: <gem> on
     <stages>: <why>`. `mcp__pob2__suggest_supports` ranks supports and lists
     what PoB can't measure (C-47).
   - **A curse's level cap** (D-455). A curse stops applying above a monster level its gem level sets (Despair: 72
     at gem level 14, 78 at 17, none from 18), as do Frost Bomb's exposure and Thunderstorm's Wet, and PoB never
     reads the cap (PG-86). Give such a gem a level whose cap isn't below the stage's area level (69 on `m`, 79 on
     `b`, 82 on `n`), its +levels from gear counted; V1's `curse-level-cap` names a gem whose cap is, with its
     level, the debuff, its cap and the area level. It mostly guards a low gem level planned on `m`.
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
     (`missing-reason`); a line that adds a pool or a defence follows step 8's coverage rule first (D-451). Both
     are estimates (D-296): the record applies Count to the named source's figures
     (`countedSkillOutputs`) and marks every figure of a stage with a custom modifier
     (`computedWithCustomMods`), and the guide lists each with its reason. **After setting Count** on a group
     whose skill reserves once per copy, on totems under Ancestral Bond, or on a group whose Umbral Well buffs
     it scales, check the stage's reservation and those buffs in the record: Count multiplies them too.
   - **Weapon sets** (D-426). Build the card's `Weapon sets:` line into each rung: set 2's passives in
     `tree.weaponSetNodes.set2` (set 1's own in `set1`), set 2's weapons in `Weapon 1 Swap` and `Weapon 2 Swap`
     (an item in both sets is equipped in both slots: PoB has no item in both sets), and `items.useSecondWeaponSet`
     `false`, so the stage's own measure is set 1's. **Measure every set the card's skills use:** on a stage that
     uses set 2 (set-2 passives, an item in a Swap slot, or a skill socketed in one), the compile also measures it
     with set 2 active and records the same key figures as `outputsSet2` beside `outputs` (`plan-reference.md`,
     "Weapon set 2's measure"): set 2's Life, defences and Spirit, and the main skill's figures with set 2 active.
     The named source and the floor are judged by `outputs`. To measure a skill the player uses from set 2, add a
     temporary stage that copies the rung with `skills.main` on that skill's group, compile the two (`stages`
     naming them), read its `outputsSet2`, and remove the stage before you finish. **Spirit on each set:** V1 reports PoB's Spirit warning on set 1 and `Your unreserved
     Spirit is negative on weapon set 2` on set 2, both `pob-warning`; fix either like any finding. **A set-2 buff**
     (a buff cast from set 2, which keeps set 2's effect while set 1 is out) is measured on set 2: read its effect
     with set 2 active (the figure it moves in `outputsSet2`, or its skill's effect there), then carry it to set 1
     as a `config.customMods` entry whose `reason` says it is the set-2 buff's effect, measured on set 2, and how
     its number was worked out. PoB counts the socketed supports of both sets, where the game counts only the active
     set's (PG-71): on a build with a set-2 skill, a per-support modifier (Gem Studded) is overstated, so
     hand-calculate it as a custom modifier with its reason.
5. **Tree.** A node list within the points the level allows (`data/campaign/limits.json`:
   `passive-points.max`; the ascendancy at most `ascendancy.max`), with its weapon-set nodes and attribute
   choices. Seed each rung's tree from the stage before it (step 3); `m`, with no campaign stage, starts from the
   skeleton's tree, a sketch of the card's targets (D-418). Keep the card's targets with their paths, and path to
   what the needs below require; never path to a further target for damage or clear. That
   tuning is D1-tree's: it spends the points you leave unspent on each rung's best nodes per point, their paths
   counted, and swaps weak branches by PoB's node power, minimizing travel (the user's rule, `patterns.md`).
   - **The needs** (D-418, plan schema 6): what each rung's tree must keep whatever node power says, as
     `tree.needs[] {nodes, stat?}`, written **without `claim`** (D1-finish writes the `reason` claim and sets
     it). `nodes` are nodes of that stage's `tree.nodes` (a schema error otherwise); `stat` is the power stat
     that measures the need, by PoB's id as `mcp__pob2__get_node_power` names it (`ManaRegen`, `TotalEHP`),
     when PoB has one, and none for one it can't measure (area for clear). **Write a need on every rung that holds
     its nodes** (D-452): no rung keeps the rung before's nodes any more, since D1-tree's `keep` is the rung's own
     needs, so a need written on `m` alone leaves `b` and `n` free to drop it. Node
     power can't see these, so each is a need:
     - mana or life sustain the build's skills run on;
     - an attribute a gem or item of the stage requires;
     - area or movement for clear;
     - a boss-only gain: penetration and exposure count for nothing on a clear config with no enemy
       resistances;
     - a defence the floor needs;
     - **deflection or evasion taken for hits survived** (step 8, D-451): node power ranks by EHP and can't see
       hits survived, so each avoidance source the design keeps is a need on each rung that holds it, its claim
       saying why;
     - a node that feeds only a damage group other than the named source's (question 23), its `stat` none, as
       measured on that group's figure;
     - a node the card's engine names, and a node that grants a skill of the stage (`Grants Skill:`);
     - a node a custom modifier depends on (the keystone whose conversion the modifier stands for), so node
       power's swaps never drop it while the modifier stays (D-434);
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
       most 200. D1-tree adds the jewels its socket tests take (D-453), and D1-finish re-splits `n`'s default
       share over them before pricing.
     A target guides what you design; it is never a reason to drop or weaken a piece the build needs (D-371).
   - **Boots carry the best movement speed for the level** (D-440). The user (2026-10-25): "Any build should
     always be using the highest movement speed tier for that level. 30% on entering maps, 35% on budget and
     non-budget." The tier per rung: **30% on `m`, 35% on `b` and `n`** (the boots tiers, `Data/ModItem.lua`:
     30% from item level 65, 35% from 82); a corruption's extra is never required. `b`'s and `n`'s rare boots
     name the tier's movement speed in `query.required` (`{"affix": "#% increased Movement Speed", "min": 35}`, one
     of the 3), and D1-finish prices `m`'s boots with it among `mods`. Boots under the tier are V1's
     `movement-tier` finding, unless the stage carries `items.bootsException {kind, reason}` (schema 7), and
     only then: `kind: "travel"` when the build moves with its travel skill (the record's
     `measures.clearSpeed.travel`), `reason` naming the affix the boots slot gains in place of the speed; `kind:
     "unique"` when unique boots are required for another of the build's mechanics ("Unique boots can bypass
     this rule if and only if the unique is required to make some other aspect of the build work"), `reason`
     saying what they give and why it is worth at least the speed they give up ("Movement speed is a premium
     stat, so whatever the build gets in exchange must be of equal or greater value"). A valid exception is V1's
     note `boots-exception`, which fails nothing; the design gate shows it as a trade (D1-finish).
   - **Gear searches** (D-444). You may price a gear choice with `mcp__pob2__find_upgrades` (a loaded rung, its
     loadout selected) while pricing isn't stopped, one call at a time (`references/pricing.md`, "Pace"): count
     its calls by outcome for your return, which the runner logs as your `priceOutcomes`. Never while pricing is
     stopped (Read, above); offline, never. Never judge a weapon by a listing's DPS (D-456): D1-finish re-checks
     weapons on the build's own figure.
7. **Config** (C-32, D-114; `config.earned` and `config.scenario`).
   - **Earned state**, `{option, value, producer, uptime}`: every stack, charge, buff or condition the
     numbers rely on, with the producer present in the stage (V2 checks it) and an honest uptime. Every
     skill-conditional option PoB shows for the stage's skills is earned state too, listed with its
     producer and uptime (D-250): the baseline list covers such an option only while PoB hides it.
     - **Conditions under hits** (D-451): a line that holds only while you aren't hit (Hyrri's Ire, "if you
       haven't been hit recently"), stacks lost when you are hit (Wind Dancer, Virtuous Barrier's motes, Ghost
       Shroud) and "Is the enemy Blinded?" are earned state with an uptime under hits, never a full one; blind
       needs a producer that hits the attackers.
     - **Wither stacks** (D-456): steady stacks are the duration ÷ the application interval, at most 10, unless
       another Wither source is named.
     - **An ailment's uptime from PoB's figures** (D-456): an earned ailment condition's uptime cites PoB's
       per-hit chance or buildup for the main skill, `<Ailment>ChancePerHit` or `<Ailment>BuildupAvg` in a
       record's `outputs` (else `mcp__pob2__lua_get_stats` on that loaded stage), against the enemy it is read
       for: the map enemy from the rung's own compile; **the Pinnacle boss from a temporary stage** that copies
       the rung with the boss's scenario (`enemyIsBoss` from `enemies/arbiter-of-divinity.json#pob-enemy-is-boss`,
       and the enemy's level, armour, evasion, resistances and crit citing E1, D-252), since the record's own boss
       measure carries no per-hit figure. A `judgment` from the gem text only where PoB shows neither. Say how
       many hits apply it; more than 5 on the Pinnacle boss is a risk, and starts the wall rule (step 3).
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
8. **The defence step** (D-451): pick the build's defence before you tune it.
   - **The family follows the class's attributes** (the user, 2026-10-26: "the type of character dictates the type
     of defenses that can be used because each type has high requirements of a particular stat"): strength for
     armour, dexterity for evasion, intelligence for energy shield, two attributes for a hybrid base. A family off
     the class's attributes is allowed; count its cost, the attribute lines on gear and the tree points its bases'
     requirements take, and say it in the `defence` texts.
   - **`stages[].defence` on `n`** (schema 8), beside `skills.engagement`: `{base, chance, mitigation, pool,
     physicalHit}`, `base` one of `armour`, `evasion`, `energy shield`, `armour/evasion`, `armour/energy shield`
     and `evasion/energy shield` (the bases' attribute families), the others short texts, names only (`none` for
     a role the build leaves empty): the chance layers (evade, deflect, block), the mitigation (armour,
     resistances, damage taken), the pool (life, energy shield, mana under damage taken from mana first) and what
     holds the Arbiter's physical hit. Start from the card's `Defence:` line. The run checker fails `n` without it;
     an evasion base, pure or hybrid, is what makes D1-finish write the avoidance trade.
   - **Deflection on evasion builds, pure or hybrid**: take avoidance sources (the tree's Deflection nodes, gear
     lines, increased deflection rating, more deflected share) as far as they stay competitive with the other
     defence picks, valued by EHP and by **hits survived** (the key-figure line's `hits survived <x>%`, the
     deciding Arbiter row's), not by EHP alone. No cap is required. Measure a source on a temporary stage like any
     piece; keep what you take as a need on each rung that holds it (step 5), and say why in the need's reason.
     Glancing Blows is no deflection source.
   - **The toughness reading** (D-449): beside EHP, the key-figure line gives the lowest max hit and the Arbiter's
     deciding row (one-shot or not, and hits survived on a rung that evades or deflects). A `b` or `n` the
     Arbiter's hit one-shots under the 80% floor is a one-shot rung: D1-finish measures its defence trade, so
     don't tune it away by guesswork, but a defence pick that clears it is worth its cost.
   - **No custom line for a layer PoB models** (D-451). A `config.customMods` line that adds a pool or a defence
     first shows, through `mcp__pob2__check_model_coverage`, that PoB doesn't model the mechanic it stands for,
     and its `reason` names that result as `coverage: <status>` (`unparsed`, `partly parsed`, `parsed to nothing`
     or `possibly unread`); PoB parses a `possibly unread` line, so measure it on a temporary stage too (D-243).
     V1's `custom-defence` names a schema-8 line whose parsed mods include a pool or defence stat and whose reason
     has no `coverage:` result; V4 re-runs the coverage check on it. (Two Witchhunter builds typed Sorcery Ward as
     energy shield, counting the ward twice.)
   - Then **the survival floor** (D-118, D-119, D-234), on each of the three rungs. At the −60% penalty, fire,
     cold, lightning **and chaos** resistance are capped (`Missing<Elem>Resist` 0), and each of the five
     reference hits the record wrote is below its `<Type>MaximumHitTaken`. Cap chaos resistance. Only when capping
     it is **infeasible** (Chaos Inoculation; no slot can carry chaos resistance without dropping a core item or
     going far over its price target) add `chaosResistException {reason, tag}` to that stage: one sentence naming
     what makes the cap infeasible, tagged. Never add it to avoid work; a stage with the exception and a capped
     chaos resistance needs none.
9. **Measure.** Validate with `mcp__pob2__guide_run {validate: "<plan>"}` until it reports no
   error, then compile measure-only (`mcp__pob2__compile_plan {plan_path: "<plan>",
   measure_only: true}`). Its reply gives each stage's key-figure line (on a rung the named source's damage
   figure, `damage <map> against map monsters, <resisting> against resisting rares, <boss> against a Pinnacle
   boss`, and its trigger line when a meta gem triggers it; life, energy shield, EHP, `lowest max hit <n>
   <type>`, the four resistances, the V1 and V2 finding counts, the Arbiter verdict by its deciding row with
   `hits survived <x>%` on a rung that evades or deflects, and the rough clear speed) and its V1 and V2 findings:
   read the floor there, and Grep
   `compile-record.json` only for what the reply lacks (`<Type>MaximumHitTaken`, the hits in `configWritten`,
   `countedSkillOutputs`, `measures.bossGroups` and `measures.sourceTypes`, and on a stage that uses weapon set
   2 its `outputsSet2`: the key-figure line is set 1's). Iterate on clear speed and damage
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
   any other: write a node the user asked for as a need (step 5), on each rung that holds it. A respec the user
   asks for is a tree request, D1-tree's (D-452): you run for it only on a plan still at schema 7, to move the
   plan to 8 (step 1).
2. **Leave the rest to D1-finish.** The anoint, the prices, the ledger and the claims are D1-finish's. A
   change to a ledger entry's formula or inputs needs no recompile: the record's `buildSha1` leaves out the
   ledger, and the run checker re-evaluates the plan's current ledger (D-352).
3. **`pieces.md`:** when a change moves a piece in, scheduled or out, edit its row; when it asks a question
   again (a conversion, a keystone, a limit named as a con), add its `## Searched` line.

## Writes

`<buildFolder>/plan.json` and `<buildFolder>/pieces.md` (D-434), nothing else. The server writes the record and
the XML beside the plan.

**`pieces.md`**, the build's pieces as designed: written whole on attempt 1 of a fresh design (one already in the
build's folder belongs to an earlier design and is replaced), edited after. No round copy takes it, and the
checker's `--changed` doesn't list it: only D1-build writes it, but for its `## Jewel lines` section, which D1-tree
writes (D-453) and you leave as it is.

```
# Pieces: Corpse Quake

| Key | Piece | Kind | Status | Where | Why | From |
|---|---|---|---|---|---|---|
| cr1-a-1-1 | Seismic Cry | skill | in | group 1, clear | the named damage source | r1-a-1, r1-c-1 |
| cr1-b-2-1 | Avatar of Fire | keystone | in | tree | every hit fire, so the whole hit ignites | r1-b-2 |
| i1c-2 | Deidbell | unique | in | Helmet | warcries explode corpses: a second corpse explosion | r1-c-1, i1c-2 |
| i1b-4 | Blistering Bond | unique, under-played | in | Ring 2 | fire sets bleeding's magnitude: Seismic Cry (clear) −5% | r1-b-2, i1b-4 |
| cr1-s-2-1 | Blood Magic | keystone | in | tree | the cries' mana cost moved to life | design |
| cr1-b-2-3 | Zerphi's Infamy | support | in | group 1 | the cries' life cost makes its Glory | r1-b-2 |
| cr1-a-3-2 | Hammer of the Gods | skill | scheduled | weaponSet 1, single_target | boss button | r1-a-3 |
| i1a-7 | Elemental Focus | support | out | — | forbids the ignite and bleeding layers | i1a-7 |

## Searched

- Q17 after mana per cry was named a con: searched "Converted to Life Costs" and life on kill; found Blood Magic, now in
- Q15 after Blood Magic entered: searched "of Life spent" (gem); found Zerphi's Infamy, out while the cries spent mana, now in
- Q19 after the cry was named mana-limited on bosses: searched a boss button; found Hammer of the Gods, scheduled on weapon set 1
- Q2 after b's corpse supply ran dry between packs: searched other means to corpses; found Deidbell's explosion, now in
```

- **Title:** `# Pieces: <build name>`, the build's `name` in `run-log.json`'s `builds[]`, else the card's name.
- **The table:** the card's Pieces columns and order (the named damage source and its enabler first, then the
  pieces in, scheduled and out), one row per piece the design weighed: the card's rows, each `## Pieces not used`
  piece you weighed, and each piece the questions found, keyed `c<the build's card id>-<m>` (`m` counting on
  from the table's largest such key, else from 1), its From `design`. Where is the plan's place (a slot, `group
  <n>`, `weaponSet <n>`, or `tree` for a node or keystone); Why is required for
  `scheduled` and `out`, and for a piece you measured gives its drops as the card's Pieces measured writes them,
  `<group> (<clear | per corpse | boss>) −<x>%`, for D1-finish's claim.
- **`## Searched`:** one line per question asked again, `- Q<n> after <the change>: searched <what>; found
  <result>`, the line answering question 19, a `Q2` line for each search the wall rule made (step 3) and each
  `- stronger structure: <the means>: <why>` you return; `None.` when no question was asked again.
- **`## Jewel lines`** (D-453), D1-tree's, after `## Searched` when a socket test chose them: the jewel lines and the
  `tree.scales` they serve.

## Returns

At most 8 lines: your claim, `done` or `infeasible` with its reason in a sentence; how many
`mcp__pob2__compile_plan` calls you made; your price calls counted by outcome when you made any (`prices: ok
2`, D-444); `league unverified` when no league could be verified online (step 2);
each `left out:`, `lever unpulled:`, `override:` and `stronger structure:` line (step 3); with findings, the
finding ids you fixed and the locations you changed (`plan.json stages[3].items`); for D1-tree, which runs after
you, one line `for D1-tree:` with each rung's floor (`floor holds on m, b, n`, or the rungs where it fails) and its
needs counted (`needs m 3, b 3, n 2`); and one line `pieces: <n> in, <n> scheduled, <n> out`, `pieces.md`'s rows
counted by Status (D-434).

```
D1-build r1-a-2 attempt 1: done
compiles: 4
for D1-tree: floor holds on m, b, n; needs m 3, b 3, n 2
pieces: 5 in, 0 scheduled, 1 out
```

```
D1-build r1-a-2 attempt 3: done
compiles: 1
fixed: v4-1-3
changed: plan.json stages[6].items, plan.json stages[6].tree
pieces: 5 in, 0 scheduled, 1 out
```

## Fault directives

None. FI-2 and FI-3 are the D1 gate's (`D1-gate.md`).
