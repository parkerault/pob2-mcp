# Build plan reference (`plan.json`, schema version 6)

A build plan is the JSON file an agent writes into a guide run folder as `plan.json`. `compile_plan`
turns it into one PoB2 build with a loadout per stage, and `guide_run`'s validate mode checks it without
compiling (C-31, C-41, C-50). This page is the agents' reference for the plan: every field, its rules,
how errors are reported, and a worked example.

The schema itself is `planSchema` in `src/plan/schema.ts` (zod). `tests/static/planReference.test.ts`
keeps the field table below equal to it, and `tests/unit/planSchema.test.ts` keeps the worked example
equal to `tests/fixtures/plans/two-stage/plan.json` and valid.

## Validation and error paths

A plan is validated in full before any engine work. If anything is wrong, nothing is compiled, and every
error is reported as one line `<path>: <message>` (FR-P1, D-163).

- **Paths** follow zod's issue path, with `.` between keys and `[n]` for array indices, counted from 0:
  `stages[1].config.scenario[0].source`. The root is `$`, and so is a file that isn't valid JSON.
- **Objects are strict.** A key the schema doesn't define is an error at the path of the object that
  holds it (`$` for a top-level key).
- **Version first.** A new plan declares `schemaVersion: 6`. Versions `1`, `2`, `3`, `4`, `5` and `6` are accepted.
  Any other value, or none, gives exactly one error, at `schemaVersion`, listing the accepted versions
  `[1, 2, 3, 4, 5, 6]`; nothing else is checked.
- **Older versions** (D-320, D-332). A plan of version 1 to 5 still validates and compiles, with its
  version's shape: it takes the defaults of what later versions added, and each use of an addition errs at
  its own path, naming the version that added it. Version 2 added:
  - the `entering-maps` variant (`stages[].variant`, D-281); a version-1 plan has no entering-maps stage;
  - a group's `count` and `countReason` (`stages[].skills.groups[]`, D-293); in a version-1 plan every group
    counts as 1, and the keys are errors;
  - `config.customMods` (D-293); a version-1 plan has none, though it may list PoB's `customMods` option as
    an `earned` or `scenario` entry, which the compile record marks like custom modifiers.

  Version 3 added (D-351, D-358):
  - a claim's `kind` (`stages[].claims[].kind`); an earlier plan's claims have none;
  - `items.anoint` (`stages[].items.anoint`); an earlier plan has no anoint.

  Version 4 added (D-377):
  - a group's minion skill, `minionSkill` and `minionStatSet` (`stages[].skills.groups[]`); in an earlier
    plan a minion uses its first skill, and the keys are errors.

  Version 5 added (D-402):
  - a stage's tamed beast, `companion` (`stages[].companion`); an earlier plan has none, and the key is an error.

  Version 6 added (D-418):
  - a stage's tree needs, `tree.needs` (`stages[].tree.needs`); an earlier plan has none, and the key is an error;
  - (M-22, D-426) a group's weapon set, `weaponSet` (`stages[].skills.groups[]`); in an earlier plan every group is
    active on both weapon sets, and the key is an error.
- **Cross-references** (one field's rule depending on another's value) are checked once each field has
  the right type, each with its own path: a repeated stage id errs at the later stage's `id`, a weapon-set
  node outside the tree at `tree.weaponSetNodes.set1[n]`, a bad ledger formula at `ledger[n].formula`.
- **Unions.** Where a field takes several types (a claim's `source`, a config `value`), the errors are
  those of the type the value has: a source tag object missing `accessed` errs at `source.accessed`.
- **Reference data.** Two checks need the committed C1/E1 data files under `data/`: that each `progress`
  is a C1 progress key, and that each `data:<file>#<key>` claim names a loaded fact (D-214, D-232). They
  run where the server loads that data (`src/plan/referenceData.ts`, C-35), with errors at
  `stages[n].progress` and `stages[n].claims[m].source`, reported together with the schema's errors. The same
  data gives `data/monsters/monster-mods.md` for a companion's modifiers (D-402), read only for a plan that names a
  companion: an id the table lacks, or a row that says a tamed beast doesn't keep it, errs at
  `stages[n].companion.mods[m]`, and an option a kept `condition` modifier writes errs where the stage lists it too
  (`stages[n].config.earned[m].option`).

Some rules are checked at compile time, against PoB, rather than by the schema: gem names, item text,
node ids and tree connectivity, config option names and values, the main skill's index, that PoB parses
each custom modifier line whole, an anoint's notable (it has a three-emotion recipe, the stage's tree
doesn't allocate it, and the stage has an amulet), a group's minion skill (its group holds one summon
whose minion can use it, and its stat set exists; C-41 step 5, D-358, D-377), and a companion's species and its
Tame Beast gem (D-402). A missing `countReason` or custom-modifier `reason` isn't a
schema error either: the compile's validity check (V1) reports it as `missing-reason` (D-322), and so is a tree need
with no `claim`, or one naming no claim of its stage (D-418).

## Terms

### Source tags (C-30)

Every claim carries a **source tag**, `{kind, ref, accessed?, patch?, confidence?}` (D-105). The tag's
rules depend on its `kind`:

| `kind` | `ref` | Also required |
|---|---|---|
| `pob-computed` | A compile-record field: `<stageId>.<Field>` (a main output, e.g. `1.Life`) or `<stageId>.g<group>s<skill>p<statSet>.<Field>` (a per-skill breakdown field, C-45). A minion's numbers are ordinary fields named `Minion<Field>`: `b.g1s1p1.MinionTotalDPS` (D-376) | — |
| `pob-data` | A pinned PoB file and line (`Data/QuestRewards.lua:7`) or a lookup-tool result | — |
| `external` | An `http` or `https` URL | `accessed` (`YYYY-MM-DD`) and `confidence` |
| `judgment` | The reasoning, in a few words | `confidence` |
| `external-unavailable` | Exactly `external source unavailable (offline run)`, for a claim that would need an external source in an offline run (D-201) | `confidence` |

`confidence` is `H`, `M` or `L`, the grounding's scale. `patch` names the game patch the source describes
(`0.5.5`). The schema accepts `external-unavailable` in any plan; the claim verifier (V4) accepts it only
in an offline run.

### Citations

Instead of a tag, a claim's `source` may be a citation string:

- `ledger:<id>` cites a `ledger[]` entry (C-33), whose inputs carry their own tags. The id must exist.
- `price:<id>` cites a `prices[]` entry, with its date, league and query (D-237). The id must exist.
- `data:<file>#<key>` cites a C1/E1 fact, `<file>` relative to `data/`
  (`data:campaign/limits.json#passive-points.max`). The fact carries its own citation (D-232). As in a
  scenario `source.key`, `<key>` may end in `[<member>]` to cite one member of the fact's value: a key of
  an object (`data:enemies/map-monsters.json#life.by-level[79]`) or a 0-based index of a list.

### "On" (A-P5)

A config value is **on** when it is `true`, a non-zero number, or a string (a list value). An earned
config entry that is on must name its `producer` and state its `uptime`; one that is off needs neither.
The schema can't see an option's list, so it counts every string value as on.

### Progress keys (D-214)

`progress` names the campaign point a stage has reached: `start`, `endgame`, or `q.<key>` for a
quest-reward row of PoB's `Data/QuestRewards.lua`. `<key>` is the row's `Description`, `Area` and `Info`
joined with spaces and lowercased, with every run of characters outside `a-z0-9` replaced by one `-` and
none leading or trailing (A-P13). Act 1's Clearfell row, Beira, gives `q.act-1-clearfell-beira`. The
progress points run in that order: `start`, the quest rows in file order, then `endgame` (A-P10).

### Ledger formulas (C-33)

A ledger formula is arithmetic over numbers and named references, evaluated from the compile record on
every compile, with no `eval` (D-170):

```
expr    := term (('+' | '-' | '−') term)*
term    := unary (('*' | '/' | '×' | '÷') unary)*
unary   := ('-' | '−' | '+') unary | primary
primary := NUMBER | REF | '(' expr ')'
WORD    := a maximal run of [A-Za-z0-9_.]; whitespace separates tokens and is otherwise ignored
NUMBER  := a WORD matching ^\d+(\.\d+)?([eE]\d+)?$
REF     := a WORD matching ^[A-Za-z0-9_]+(\.[A-Za-z_][A-Za-z0-9_]*)+$ or ^[A-Za-z_][A-Za-z0-9_]*$
```

A WORD that is neither a NUMBER nor a REF is a syntax error. So `12`, `2.5` and `2.5e3` are numbers,
but `.5`, `1e-3` and `1E+3` are syntax errors (write `0.5`, `0.001` and `1e3`). A REF takes one of three
forms:

- `x`, one segment: an input of this entry;
- `1.Life`, `<stageId>.<Field>`: a stage's main output;
- `2.g1s1p1.TotalDPS`, `<stageId>.g<group>s<skill>p<statSet>.<Field>`: a per-skill breakdown field (C-45).
  A minion's figure is an ordinary field of the same forms: `b.MinionTotalDPS`, `b.g1s1p1.MinionTotalDPS`
  (D-376).

Validation fails on a syntax error (an unexpected token, a missing `)`, an empty formula), an unknown
input, or a reference to a stage the plan doesn't have, each with its 0-based column. At compile time, a reference to an output the record doesn't hold, a
stage the compile didn't include, a division by zero or a non-finite result sets that entry's value to
null with the error in the record; the compile still succeeds. Values are unrounded doubles.

### Tree tracks (D-144, D-282)

Each stage's tree contains its predecessor's, the previous stage on its track, except the nodes its
`respec` drops. The respec names exactly those nodes and carries the respec's gold cost, which the guide
lists. The compile's validity check (V1) reports `tree-continuity` when a stage drops a node without a
respec, or when `respec.dropped` isn't exactly the dropped set.

- **The campaign track:** the stages without `variant`, in plan order.
- **The endgame ladder:** the stages with `variant`, one track by rung: `entering-maps` (`m`) continues from
  the last campaign stage in the plan (the campaign's end, wherever the plan lists `m`), `budget` (`b`) from
  `m`, and `non-budget` (`n`) from `b`. The rung order holds even if the plan lists the rungs in another
  order; within a rung, stages follow plan order. A rung the plan doesn't have is skipped, so without `m`,
  `b` continues from the last campaign stage. In a plan with no campaign stage, the first rung continues from
  none.

### A tree's needs (D-418)

Schema version 6 lets a stage's tree say what it keeps whatever node power says: `tree.needs[] {nodes, stat?, claim?}`.
Node power (PoB's ranking of passives by what each adds to one stat per point) can't see sustain, area for clear, a
boss-only gain on a clear config, an attribute a gem needs, or what PoB doesn't model, so the tree step (D1-tree) keeps a
need's nodes out of every swap.

- **`nodes`** lists the nodes the need keeps, at least one, each one of the stage's `tree.nodes`: a node the stage's
  tree lacks errs at `stages[n].tree.needs[m].nodes[k]`.
- **`stat`** names the node power stat that measures the need when PoB has one, by its PoB id (`ManaRegen`,
  `TotalEHP`); none for a need PoB can't measure, such as area for clear.
- **`claim`** is the id of the stage's `reason` claim saying why the tree keeps these nodes. D1-build and D1-tree write a
  need without it, and D1-finish writes the claim and sets it. A need with no `claim`, or one naming no claim of its
  stage, is the compile's V1 finding `missing-reason` (`data.path` `tree.needs[<m>].claim`), not a schema error.
- **`buildSha1`** leaves out only `claim` (D-266): setting or changing a need's claim needs no recompile, while a change
  to its `nodes` or `stat` changes the hash, so it recompiles and re-runs the D1 gate, whose tree verdict keeps them.
- The compile reads no need: a plan with needs compiles as it would without them.

```json
"needs": [
  { "nodes": [44683, 18496], "stat": "ManaRegen", "claim": "b-mana-sustain" },
  { "nodes": [36778] }
]
```

### Count and custom modifiers (D-293)

Two kinds of estimate cover what PoB doesn't model on its own. Each carries its reason, and the compile
record marks what rests on it.

- **Count.** A socket group's `count` is how many copies of it act at once, such as several totems or
  minions each casting the skill. It is a whole number of at least 1, and 1 when absent. Above 1 the group
  needs a `countReason` saying why that many act at once; without one, V1 reports `missing-reason` on the
  stage.
  - The named source's group, `rolledGroup`, is put in PoB's Full DPS with its count (PoB's `groupCount`).
    Every other group stays out of Full DPS, and its count lives only in the plan and the record.
  - PoB applies that group's count in three places. It multiplies the group's damage when it adds up Full
    DPS. It multiplies the reservation of a skill that reserves once per copy, and of totems under Ancestral
    Bond. And it scales Umbral Well's buffs by it. A skill's own damage figures stay those of one copy.
  - The compile record keeps PoB's figures as measured, in `outputs` and `skillOutputs`. Its counted fields,
    `countedOutputs` and `countedSkillOutputs`, apply Count to those per-copy figures by PoB's Full DPS rule:
    hits are multiplied by the count, damage over time only when it stacks, and the ailments count once.
    A minion's hits (`MinionTotalDPS`, `MinionImpaleDPS`) are multiplied by the count, and its damage over time
    (`MinionTotalDot`) and its ailments count once (D-378).
  - The raw `outputs.FullDPS` and `outputs.FullDotDPS` are PoB's Full DPS totals. They are non-zero because
    the named source's group is in Full DPS (D-337), and PoB has already multiplied them by Count, so they
    are never multiplied again.
- **Custom modifiers.** `config.customMods` lists hand-calculated effects, one PoB modifier line each, such
  as `10% more Damage`. The compiler writes them into PoB's custom modifier box after the stage's config
  options.
  - A line PoB can't parse whole would add nothing, so it fails the compile.
  - Each entry needs a `reason` saying what it stands for and how it was worked out; without one, V1
    reports `missing-reason`.
  - Every figure of a stage with custom modifiers, defences included, is marked in the compile record, and
    so is every ledger value that reads one. From version 2 on, don't list `customMods` in `earned` or
    `scenario`. A version-1 plan may still list PoB's `customMods` option there, and its stage is marked the
    same way.

```json
{
  "label": "Ancestral Warrior Totem",
  "enabled": true,
  "role": "single_target",
  "gems": [{ "name": "Ancestral Warrior Totem", "level": 10, "quality": 0, "enabled": true }],
  "count": 2,
  "countReason": "two totems are up at once: the stage's tree grants +1 to maximum number of Summoned Totems"
}
```

```json
"customMods": [
  { "text": "10% more Damage", "reason": "<the effect PoB doesn't model, and how 10% was worked out from it>" }
]
```

### A minion's skill (D-377, D-378, D-380)

Schema version 4 lets a socket group choose the skill its summon's minion uses: Navira's Fracturing, the Water
Djinn's second skill, rather than its first.

- **`minionSkill`** names the minion skill as the gem lookup names it. **`minionStatSet`** (a whole number of
  at least 1, default 1) picks that skill's stat set, and is allowed only with `minionSkill`. The fields sit on
  the group, because PoB keeps the choice per summon.
- **The group holds exactly one summon**, an active skill that creates a minion. A summon's "Command" skill has
  no minion. On the main group, `main.activeSkill` is the summon, never its "Command" skill.
- **Resolved by name at every compile.** The compiler matches the name, ignoring case, against the minion's
  live skill list (its own skills in data order, then any its supports add). A plan never holds an index.
  The compile refuses, naming the stage, a group with no summon or two, a name the minion can't use (listing its
  skills), a name its list holds twice, a stat set beyond the skill's, and a main active skill that isn't the
  summon.
- **The record** keeps each group's resolved selection (`stages.<id>.minionSkills`: the minion, the skill's name,
  its index and its stat set), and the saved build carries PoB's own fields, as PoB's minion-skill dropdown sets
  them.
- **The group's figure** is its minion's `MinionTotalDPS`, at the same key `g<group>s<skill>p<statSet>`, in place
  of `TotalDPS` (which is 0 for a summon). The headline `measures.dps` is the main group's figure × its Count, and
  the clear measure reads the minion's `MinionAreaOfEffectRadiusMetres` and `MinionSpeed`.
- **The rolled skill** may be a minion skill: `rolledGroup` then names it as its `minionSkill` (D-217).
- **A skill a passive grants** (its line reads `Grants Skill: <name>`) is checked by V1, because PoB measures it
  either way: a group whose skill gem a passive grants ("Navira, the Last Mirage", node 32705) or whose
  `minionSkill` one grants (Navira's Fracturing, node 10561) on a stage that allocates none of those passives is
  the finding `not-granted` (D-380).

```json
{
  "label": "Navira",
  "enabled": true,
  "role": "single_target",
  "gems": [{ "name": "Navira, the Last Mirage", "level": 20, "quality": 0, "enabled": true }],
  "minionSkill": "Navira's Fracturing"
}
```

### A tamed beast (D-402)

Schema version 5 lets a stage name its tamed beast: `companion {species, mods}`. The Tame Beast gem captures a rare
beast and then summons it as a companion, which keeps up to four of its rare monster modifiers. PoB measures the
beast's damage, defences and Spirit cost from its species; it has no rare monster modifiers (PG-56), so the compile
writes each kept modifier as its row in `data/monsters/monster-mods.md` says.

- **The Tame Beast gem.** The stage holds exactly one gem named `Tame Beast`, as the gem lookup names it, enabled and
  in an enabled group; any group and role will do, and it may be the main group. The compile turns it into PoB's
  companion gem, which summons the beast, as the game turns the gem once it captures one. The record and the saved
  build name it as PoB does, `Companion: <beast>`. Without `companion`, a Tame Beast gem stays the uncaptured gem
  and summons nothing, as before version 5.
- **`species`** names the beast as PoB's beast library does ("Manage Beasts…": the monsters of `Data/Spectres.lua`
  in category `Beast`), ignoring case, such as `Diretusk Boar`, or by its monster id
  (`Metadata/Monsters/GoreCharger/GoreCharger`). Several beasts share some names (two `Quill Crab`s, at different
  Spirit costs); such a name is refused with their ids, and the plan names one of them.
- **`mods`** lists the kept modifiers by their ids in the table, at most four ("Tamed Beast retains up to four
  monster modifiers when summoned"), each once. Each is applied by its row's model:
  - `stats`: its lines join the stage's custom modifiers after the plan's own, each with a reason marking it an
    estimate, so the record marks every figure of the stage, as for any custom modifier. A line on the beast itself
    (its row's reach is `the beast`) is written `Companions have <line>`, which PoB gives companion skills only, or in
    PoB's wording for a companion where it can't parse that (`Companions have 4 additional Projectiles` for "Skills
    fire 4 additional Projectiles"); a line that reaches its allies is written as is for the player and as
    `Minions have <line>` for the minions. A line PoB can't parse whole would add nothing, so the compile leaves it
    out, and the record says so.
  - `condition`: the config option its row's `Config` names is written as earned state, on, produced by the Tame
    Beast gem. The stage doesn't list that option itself (an error at the listing).
  - `none`: nothing; PoB can't take it, and the record says so.
- **Spirit.** A beast reserves a percentage of the player's Spirit, its species' own (`companionReservation`), where
  most minions reserve a flat amount: each point of Spirit a build stacks raises the beast's cost too.
- **Refused by the compile,** naming the stage: a species the library lacks (with the nearest names), a name several
  beasts share, and no Tame Beast gem, two, or one that is disabled or in a disabled group. `guide_run`'s validate
  mode refuses them too.
- **PoB's companion options.** With a companion, PoB shows three options, each on by default: `companionInPresence`
  ("Is a Companion in your Presence?"), `summonCompanionEnableBuffs` and `summonCompanionEnableCurses`. The compile
  writes each one the stage doesn't list as earned state, on, produced by the Tame Beast gem, so V2 finds them listed
  (D-250). A stage lists one itself only to change it, such as `companionInPresence` off for a beast kept away.
- **Shared sets.** Stages that name different beasts, or one names none, never share a skill set.
- **The record** gives `stages.<id>.companion`: the beast PoB summons (`monster`, `monsterId`), its group,
  active skill and breakdown key, its DPS (its minion's `MinionTotalDPS` there), the player's `spirit`, the
  species' percentage (`speciesReservationPercent`), PoB's reservation for it (`reservedSpiritPercent`,
  `reservedSpirit`), and each kept modifier with how it was applied (`mods[]`: `applied` is `custom-modifiers`,
  `config` or `nothing`, with the lines written, the option set, and `how` in words).

```json
"companion": { "species": "Diretusk Boar", "mods": ["haste-aura", "trail-of-ice"] }
```

### A base's implicits (D-435)

The game gives every item its base's implicit (a spear's Spear Throw, a ring's resistance, an amulet's attribute),
but PoB reads only the lines an item's text holds, so a bare base would have none. **An item whose text has no
`Implicits:` line gets its base's implicits:** the compile writes the base's implicit lines (`Data/Bases/*.lua`'s
`implicit`) into the item as PoB's own rare list and crafting window fill a base's (`Modules/Main.lua:170-176`), a
range at PoB's default roll, its middle (0.5, `Modules/Main.lua:105`). So `Rarity: Normal` and `Ruby Ring` is a ring
with +25% to Fire Resistance, and a bare Hardwood Spear grants Spear Throw, which PoB measures in a group of its own.
The compile lists PoB's own groups after the plan's, so a plan group's number in PoB is its number in the plan and the
record, in every loadout. The saved build holds the filled item. Kept as written:

- **A text with an `Implicits:` line,** `Implicits: 0` included: write `Implicits: <n>` and its lines to give an item
  other implicits than its base's (another roll, a corrupted implicit), or none.
- **A unique** (or a relic): PoB's unique data carries its own implicits, so write a unique's text whole, its
  `Implicits:` line included, as the unique lookup gives it.
- **A base whose implicit has variants** isn't filled: at the pin, the Lament, Portent and Absent Amulets, each
  variant granting another skill (`variantList`). Which variant an item has is the item's, so the compile leaves it
  without an implicit, and V1 reports `implicit-variant`, naming the base and its variants, its `data` `{slot, base,
  variants, path}` (`path` the item's `items.slots[<k>].text`): write the variant's implicit line after an
  `Implicits:` line.

```json
{ "slot": "Weapon 1", "text": "Rarity: Normal\nHardwood Spear" }
```

### Claim kinds and the anoint (D-351, D-358)

Schema version 3 adds two fields.

- **A claim's `kind`** says why the claim is written (D-351): `hinge`, a fact whose being wrong would make
  the build fail at its rung, or `reason`, a reason that rests on a measurement. What the compile proves
  needs no claim.
- **`items.anoint`** names one notable passive the stage's amulet is anointed with, and why
  (`{notable, reason}`). It is allowed on the budget and non-budget rungs (`b`, `n`) only; on the
  entering-maps rung `m` or a campaign stage it is an error at `stages[n].items.anoint` (D-358, Q5).
  - The compiler writes it on the stage's amulet as `{enchant}Allocates <notable>`, which PoB grants with no
    path and no passive point.
  - The compile refuses it, naming the stage, when the notable has no recipe of three Distilled Emotions,
    when the stage's tree already allocates it, or when the stage has no amulet.
  - The compile record gives the notable's recipe (`stages.<id>.anoint`: the notable, its node id, the three
    emotions as the tree names them and as PoB's item names).

```json
"anoint": { "notable": "Unbending", "reason": "3% increased maximum Life, off the stage's tree path" }
```

```json
{ "id": "b-arbiter", "text": "The budget rung survives the Arbiter's slam.", "kind": "hinge", "source": { "kind": "pob-computed", "ref": "b.PhysicalMaximumHitTaken" } }
```

### Reference hits and measures (D-353, D-407)

On an endgame stage (one with `variant`), the compiler fills each of the five reference hits the scenario
leaves out (`enemyPhysicalDamage`, `enemyFireDamage`, `enemyColdDamage`, `enemyLightningDamage`,
`enemyChaosDamage`) from the data, at the rung's area level: 69 for `m`, 79 for `b`
(`enemies/waystones.json#area-level.offset` plus the tier, 5 or 15) and `area-level.max`, 82, for `n`. A hit
is the map monsters' damage at that level (`enemies/map-monsters.json#damage.by-level[<level>]`) × (1 + the
top of `mods.increased-monster-damage` / 100), and × the top of `mods.extra-damage-as-element` / 100 for fire,
cold, lightning and chaos, rounded up to a whole number after rounding to 2 decimals (D-254, D-256): 402 and 97
at level 79. A hit the plan lists stays as listed. The record's `configWritten` holds every hit written.

A card skeleton (an endgame stage with no `variant`, `progress` `endgame`) gets the budget rung's hits, the T15 map hit
at area level 79, filled the same way, so its Effective HP compares with the rungs' (D-423). A campaign stage gets none.

The compiler also measures each endgame stage (`stages.<id>.measures` in the record), so no plan needs a
ledger entry for them: `dps` (the main group's Count-scaled figure: its minion's `MinionTotalDPS` when it names a
minion skill, else `TotalDPS`; D-294, D-378), `ehp` (`TotalEHP`), on `b` and `n`
the Arbiter of Divinity's largest hit of each damage type and each mixed hit over the stage's max hit
(`survives` below 1, else `one-shot`), a rough `clearSpeed` and the player's `movementSpeed`. No ledger entry is
needed for a reference hit, a kill time or hits to kill.

A card skeleton (R1b's one endgame stage with no `variant`) is measured too, with the pace measures only (D-407):
its `measures` hold `clearSpeed` and `movementSpeed`, and no `dps`, `ehp` or Arbiter rows. A campaign stage has no
`measures`.

- **`clearSpeed`** is rough, assuming one use kills a normal monster (D-353): `speed` is `band`, the clear skill's
  radius `radiusMetres` banded (below 2 m `slow`, from 2 m `medium`, from 4 m `fast`), a step faster when its gem
  text explodes monsters or spreads an effect on death (`onDeath`) and a step slower when a use takes over 1 second
  (`longUse`). The clear skill is the first enabled `clear` group, else the main group, and a summon's is its
  minion's (D-397); a clear group with `weaponSet: 2` is read from `skillOutputsSet2`, its own set's figures.
  **`noArea`** is true when PoB gives the clear skill no radius, as for a Skeletal Warrior's strike: its band is then
  `slow` for want of an area, not from a small one, and a display says `slow (PoB gives no area)`.
- **`movementSpeed`** is PoB's `EffectiveMovementSpeedMod`, the player's movement speed × action speed as a
  multiplier (the sidebar's "Movement Speed Modifier"): 1.25 is +25%. It is null when PoB gives none.
- **`clearSpeed.travel`** (D-427) is the stage's travel skill, beside the movement speed: `{group, skill,
  usesPerSecond}`, the first enabled group, other than the clear group, whose active skill has PoB's Travel skill type
  (`list_gems {skill_type: "Travel"}` lists them), by group number; `skill` is PoB's name for it and `usesPerSecond`
  PoB's `Speed` at its first stat set, from `skillOutputsSet2` for a group with `weaponSet: 2`, else `skillOutputs`
  (null when PoB gives none). It is `null` when the stage has no such skill. PoB gives no distance per use, so no
  pace is computed from it, and the band stays the clear skill's radius.

`compile_plan`'s reply prints a key-figure line after each stage's line (D-356), so a compile needs no read of
the record for these: the headline DPS (the main group's Count-scaled figure, followed by the minion skill's name
when a minion deals it: `DPS 649 (Navira's Fracturing, minion)`), life, energy shield, EHP, the
fire, cold, lightning and chaos resistances, and the stage's V1 and V2 finding counts; on an endgame variant stage
also the Arbiter verdict with its worst hit and ratio (`b`, `n`) and the rough clear speed. A card skeleton's pace
measures and every measured stage's movement speed are in the record only. Numbers are rounded to whole numbers.

```
Stage b "Budget (L80) {b}" level 80: V1 fail, V2 pass
  Key figures: DPS 5; life 1121; ES 0; EHP 1136; resists 0/10/0/0 (fire/cold/lightning/chaos); findings V1 9, V2 0; Arbiter one-shot (worst: lightning hit volatile-explode, 3.54 of max hit); clear slow (rough)
```

### Weapon set 2's measure (D-426)

PoB measures a loadout with one weapon set active, the one `items.useSecondWeaponSet` names: passives tagged to a
set apply only while it is active, a skill group follows a set only through the slot it is socketed in, and set 2's
weapons are the `Weapon 1 Swap` and `Weapon 2 Swap` slots. So a stage that **uses weapon set 2** (a node in
`tree.weaponSetNodes.set2`, an item in a Swap slot, or a skill group socketed in one: a group with `weaponSet: 2`, or
PoB's own group for a Swap item's granted skill) is measured twice: with set 2 active, then as the plan says. The record's `stages.<id>.outputsSet2`
is the second weapon set's measure, the same key-figure map as `outputs` (every finite number of PoB's main output,
the minion's as `Minion<Field>`): Life, energy shield, Spirit and `SpiritUnreserved`, the resistances, Full DPS and
the rest, all with set 2 active. `outputs`, `skillOutputs`, the counted figures, the measures and the key-figure line
stay the plan's own set's, set 1's unless `useSecondWeaponSet` is true; a stage measured on set 2 has `outputsSet2`
equal to `outputs`. A stage that doesn't use set 2 has no `outputsSet2`, and compiles as before.

**A skill on a weapon set** (D-426, §24.2). A group's `weaponSet` (`1` or `2`) puts it on that set: the compiler
sockets it in one of the set's two weapon slots, and PoB enables a group only while its slot's set is active
(`Modules/CalcSetup.lua:1728-1729`), so its skill, buff or reservation counts on its own set only. The slot is the
set's main hand (`Weapon 1` for set 1, `Weapon 1 Swap` for set 2, PoB's "Socketed in" choice) unless the item there
grants a skill, then its off-hand (`Weapon 2`, `Weapon 2 Swap`; an empty slot grants none, as a two-hander's set's):
PoB gives an item's granted skill the supports of every group in its slot, which the game doesn't (PG-74). When both
of the set's slots hold an item that grants a skill (a spear and a shield), the group stays in the main hand, and V1
reports `weapon-skill-supports`, naming the granted skill whose figure PoB overstates, its `data` `{group, weaponSet,
slot, skills, supports, path}` (an enabled group, or the main group, with an enabled support). Stages whose items put
the same groups in different slots get separate skill sets. The slot also raises the group's curses in PoB's curse
priority, when more curses are cast than the limit allows (`Modules/CalcPerform.lua:547`: 1000 in a main hand, 4000 in
an off-hand, nothing with no slot); PoB matches triggers by slot only with an item-granted skill
(`Modules/CalcTriggers.lua:35`), which the chosen slot doesn't hold. A group without `weaponSet` gets no slot and is
active on both sets, as before: a buff or a reservation in it counts on each. A group on set 2 makes its stage one that
uses set 2. On such a stage the record gains `stages.<id>.skillOutputsSet2` beside `skillOutputs`: every group's figures
measured with set 2 active, keyed as `skillOutputs` is (`g<group>s<skill>p<statSet>`), so a skill on either set has a
figure of its own: read a set-1 group's in `skillOutputs`, a set-2 group's in `skillOutputsSet2`, and a group on both
sets in either, except on a stage measured with set 2 active (`items.useSecondWeaponSet` true), where both maps are set
2's and no figure is measured on set 1. Its figures are raw (no Count). On a stage measured with set 2 active it is
`skillOutputs` itself; a stage that doesn't use set 2 has none. The clear measure and `travel` read a group on set 2
from `skillOutputsSet2`. V1 reports a group on a set whose weapon slots are both empty as `empty-weapon-set` (the
stage's `items.slots` fill neither `Weapon 1` nor `Weapon 2`, or neither Swap slot), its `data` `{group, weaponSet,
slots, path}`.

```json
"skills": { "groups": [
  { "label": "Boneshatter", "enabled": true, "role": "single_target", "weaponSet": 1, "gems": [ … ] },
  { "label": "Infernal Cry", "enabled": true, "role": "utility", "weaponSet": 2, "gems": [ … ] }
], … }
```

V1's Spirit check reads both sets. PoB's own warning lines are the measured set's ("Your unreserved Spirit is
negative", a `pob-warning`), and on a stage measured on set 1, V1 applies PoB's rule to `outputsSet2` too: a
negative `SpiritUnreserved` there is the `pob-warning` `Your unreserved Spirit is negative on weapon set 2`, its
`data` `{line, set: 2, spirit, unreserved}`, and the line joins `pobWarnings.kept`.

```json
"outputs": { "Life": 274, "Spirit": 130, "SpiritUnreserved": 70, "FullDPS": 20.6, "…": 0 },
"outputsSet2": { "Life": 244, "Spirit": 30, "SpiritUnreserved": -30, "FullDPS": 18.2, "…": 0 }
```

A buff cast from set 2 keeps set 2's effect while set 1 is out, which PoB can't show on set 1: measure it with set 2
active, and carry it to set 1 as a `config.customMods` entry whose `reason` says so (D-293). PoB counts the socketed
supports of both sets, where the game counts only the active set's (PG-71).

### The level the build works from (D-413)

Every compiled stage's record gives `requirements {level, by[]}` (`stages.<id>.requirements`): the highest level
requirement among the stage's equipped items and socketed gems, as PoB computes them, and which items or gems set it.
The endgame guide says when the build comes online from `m`'s.

- A gem's requirement is PoB's for its gem level (the gem's `levelRequirement` at that level, as PoB's skills tab sets
  it), for every gem of the plan's groups, enabled or not; an item's is PoB's `requirements.level` (its text's
  `Requires Level` or `LevelReq`, else its base's, raised to its runes'), for every item in the item slots. These are
  the figures V1's `gem-level-requirement` and `item-level-requirement` compare with the stage's level.
- `level` is the highest of them, at least 1. `by` lists every item and gem whose requirement is `level`, items first
  in slot order, then gems in group order: an item as `{kind: "item", name, slot}`, a gem as `{kind: "gem", name,
  group, gemLevel}`, `group` the plan's group number. `by` is empty when nothing requires a level.

```json
"requirements": { "level": 90, "by": [{ "kind": "gem", "name": "Wolf Pack", "group": 1, "gemLevel": 20 }] }
```

### Shared sets (A-P2)

The compiler gives every stage its own tree, titled `loadoutName`. Stages whose `items` (likewise
`skills`, `config`) are deep-equal share one PoB set, titled `<base> {<ids>}`: `base` is the content's
`setTitle`, else the first sharing stage's `loadoutName` without its ` {<id>}`; `ids` are the sharing
stages' ids in plan order, joined by `,` (D-103). A skill set's content includes the stage's companion, the beast
its Tame Beast gem summons (D-402).

## Fields

`SourceTag` rows follow the source-tag rules above. "Required" says whether the key must be present; a
rule may require an optional key in some cases.

| Path | Type | Required | Rule | Decision |
|---|---|---|---|---|
| `schemaVersion` | `1`, `2`, `3`, `4`, `5` or `6` | yes | `6` for a new plan; `1` to `5` are still accepted, each with its version's shape (see older versions above). Any other value, or none, is the only error reported, and it lists the accepted versions `[1, 2, 3, 4, 5, 6]` | C-31, D-167, D-320, D-332, D-351, D-377, D-402, D-418 |
| `roll` | object | yes | The roll the guide is built around | C-31 |
| `roll.className` | string | yes | Non-empty. A PoB2 class, e.g. `Warrior` | C-31 |
| `roll.ascendancy` | string | yes | Non-empty. Its ascendancy, e.g. `Titan` | C-31, D-238 |
| `roll.skill` | string | yes | Non-empty. The rolled skill's name: a skill gem's, or a minion skill's (a command such as Navira's Fracturing); `skills.rolledGroup` names a group holding a gem of this name, or naming it as its `minionSkill` (case-insensitive) | C-31, D-217, D-379 |
| `versions` | object | yes | The versions the plan was written against; the compile record notes each one that differs from the running engine | C-31, D-107 |
| `versions.pobTag` | string | yes | Non-empty. The PoB pin's tag, e.g. `v0.23.1` | D-107 |
| `versions.pobCommit` | string | yes | Non-empty. The pin's commit | D-107 |
| `versions.treeVersion` | string | yes | Non-empty. PoB's passive-tree version, e.g. `0_5` | D-107 |
| `versions.enginePatch` | string | yes | Non-empty. The game patch the engine data targets, e.g. `0.5.4` | D-107 |
| `versions.externalPatch` | string | yes | Non-empty. The patch of the prices and boss data, e.g. `0.5.5` | D-107 |
| `league` | string or null | yes | Non-empty: the pricing league. Null only in an offline run, when every price is `unavailable` with note `offline run` (error at `league`) | C-31, D-233 |
| `stages` | object[] | yes | At least one. Plan order is progression order | C-31 |
| `stages[].id` | string | yes | Letters and digits only (`[A-Za-z0-9]+`), so it works as a brace id. Unique: a repeat errs at the later stage | A-P1, D-103 |
| `stages[].loadoutName` | string | yes | Contains `(L<level>)` with the stage's own level, ends with ` {<id>}`, and has no other braces, e.g. `Act 2 (L25) {2}`. Also the stage's tree title | A-P1, D-103, D-138 |
| `stages[].level` | integer | yes | 1 to 100. The level the stage is measured at | D-138 |
| `stages[].progress` | string | yes | A progress key: `start`, `endgame` or `q.<key>` with `<key>` lowercase letters and digits in `-`-joined runs (`q.act-1-clearfell-beira`); a C1 key once the data is loaded | D-214, A-P13 |
| `stages[].variant` | `entering-maps`, `budget` or `non-budget` | no | Marks an endgame variant stage, a rung of the endgame ladder: `entering-maps` (stage `m`, between the campaign's end and `b`; schema version 2), `budget` (`b`) or `non-budget` (`n`). `variant`, `ascendancyPoints` and `variantBasis` are all present or all absent; a missing one errs at its own path. Every variant-stage rule applies to each rung alike | C-31, D-193, D-281 |
| `stages[].ascendancyPoints` | integer | no | 0 to 8. The variant's ascendancy points | D-193 |
| `stages[].variantBasis` | object | no | Where the variant's level, gem levels and ascendancy points come from | D-193 |
| `stages[].variantBasis.level` | object (SourceTag) | yes | The source of the stage's level | D-193 |
| `stages[].variantBasis.level.kind` | source kind | yes | See source tags | C-30 |
| `stages[].variantBasis.level.ref` | string | yes | Non-empty; its form depends on `kind` | C-30 |
| `stages[].variantBasis.level.accessed` | string | no | `YYYY-MM-DD`; required for `external` | C-30 |
| `stages[].variantBasis.level.patch` | string | no | Non-empty, e.g. `0.5.5` | C-30, D-107 |
| `stages[].variantBasis.level.confidence` | `H`, `M` or `L` | no | Required for `external`, `judgment` and `external-unavailable` | C-30 |
| `stages[].variantBasis.gemLevels` | object (SourceTag) | yes | The source of the gem levels | D-193 |
| `stages[].variantBasis.gemLevels.kind` | source kind | yes | See source tags | C-30 |
| `stages[].variantBasis.gemLevels.ref` | string | yes | Non-empty; its form depends on `kind` | C-30 |
| `stages[].variantBasis.gemLevels.accessed` | string | no | `YYYY-MM-DD`; required for `external` | C-30 |
| `stages[].variantBasis.gemLevels.patch` | string | no | Non-empty, e.g. `0.5.5` | C-30, D-107 |
| `stages[].variantBasis.gemLevels.confidence` | `H`, `M` or `L` | no | Required for `external`, `judgment` and `external-unavailable` | C-30 |
| `stages[].variantBasis.ascendancyPoints` | object (SourceTag) | yes | The source of the ascendancy points | D-193 |
| `stages[].variantBasis.ascendancyPoints.kind` | source kind | yes | See source tags | C-30 |
| `stages[].variantBasis.ascendancyPoints.ref` | string | yes | Non-empty; its form depends on `kind` | C-30 |
| `stages[].variantBasis.ascendancyPoints.accessed` | string | no | `YYYY-MM-DD`; required for `external` | C-30 |
| `stages[].variantBasis.ascendancyPoints.patch` | string | no | Non-empty, e.g. `0.5.5` | C-30, D-107 |
| `stages[].variantBasis.ascendancyPoints.confidence` | `H`, `M` or `L` | no | Required for `external`, `judgment` and `external-unavailable` | C-30 |
| `stages[].chaosResistException` | object | no | Only on an endgame variant stage (one with `variant`). Lets the survival floor accept uncapped chaos resistance, with a finding. Use it only when capping chaos resistance is infeasible | D-234 |
| `stages[].chaosResistException.reason` | string | yes | Non-empty. What makes the cap infeasible, e.g. Chaos Inoculation, or no slot that can carry chaos resistance without dropping a core item or breaking the budget | D-234 |
| `stages[].chaosResistException.tag` | object (SourceTag) | yes | The source of the reason | D-234 |
| `stages[].chaosResistException.tag.kind` | source kind | yes | See source tags | C-30 |
| `stages[].chaosResistException.tag.ref` | string | yes | Non-empty; its form depends on `kind` | C-30 |
| `stages[].chaosResistException.tag.accessed` | string | no | `YYYY-MM-DD`; required for `external` | C-30 |
| `stages[].chaosResistException.tag.patch` | string | no | Non-empty, e.g. `0.5.5` | C-30, D-107 |
| `stages[].chaosResistException.tag.confidence` | `H`, `M` or `L` | no | Required for `external`, `judgment` and `external-unavailable` | C-30 |
| `stages[].tree` | object | yes | The stage's passive tree | C-31 |
| `stages[].tree.nodes` | integer[] | yes | Every allocated non-ascendancy node id, a complete list connected to the class start through listed nodes. The class start node, which PoB allocates itself, isn't listed. Existence and connectivity are checked at compile. A node whose unlock constraint is unmet (most name the Oracle's The Unseen Path, 5571) is refused at compile (D-383). The tree's shape is V1's `tree-shape`: a tree is a connected group of these nodes, the start not counted; each start holds at most one tree, which may touch two of its exits; an alternate start (Path of the Sorceress, 12795) holds a tree only while its node is listed (D-360, D-364) | C-31, D-213, D-360, D-364, D-383 |
| `stages[].tree.ascendancyNodes` | integer[] | yes | Every allocated ascendancy node id, without the ascendancy's start node, which PoB allocates itself | C-31 |
| `stages[].tree.weaponSetNodes` | object | yes | The nodes tagged to weapon set 1 or 2. A tagged node paths only through untagged nodes and nodes of its own set | C-31, D-213 |
| `stages[].tree.weaponSetNodes.set1` | integer[] | yes | Each node is in `tree.nodes` (error at `set1[n]`) | C-31 |
| `stages[].tree.weaponSetNodes.set2` | integer[] | yes | Each node is in `tree.nodes` and not in `set1` (error at `set2[n]`) | C-31 |
| `stages[].tree.attributeChoices` | object[] | yes | The attribute picked on each `+5 to any Attribute` node | C-31 |
| `stages[].tree.attributeChoices[].node` | integer | yes | In `tree.nodes` | C-31 |
| `stages[].tree.attributeChoices[].attribute` | `strength`, `dexterity` or `intelligence` | yes | The attribute the node grants | C-31 |
| `stages[].tree.needs` | object[] | no | What the tree keeps whatever node power says: sustain, an attribute a gem needs, area for clear, a boss-only gain, a node that grants the skill (see a tree's needs above). Schema version 6 | D-418 |
| `stages[].tree.needs[].nodes` | integer[] | yes | At least one. The nodes the need keeps, each in `tree.nodes` (error at `nodes[k]`) | D-418 |
| `stages[].tree.needs[].stat` | string | no | Non-empty. The node power stat that measures the need, by PoB's id (`ManaRegen`), when PoB has one | D-418 |
| `stages[].tree.needs[].claim` | string | no | Non-empty. The id of the stage's `reason` claim saying why; set by D1-finish. Missing, or naming no claim of the stage, V1 reports `missing-reason`. Left out of `buildSha1` | D-266, D-418 |
| `stages[].respec` | object | no | Present wherever the tree drops a node the previous stage on its track had (see tree tracks); the guide lists it with its gold cost | D-144, D-282 |
| `stages[].respec.dropped` | integer[] | yes | Exactly the node ids dropped from the tree of the previous stage on its track | D-144, D-282 |
| `stages[].respec.goldCost` | object | yes | The respec's gold cost | D-144 |
| `stages[].respec.goldCost.value` | number | yes | At least 0 | D-144 |
| `stages[].respec.goldCost.source` | object (SourceTag) | yes | The source of the cost | D-144 |
| `stages[].respec.goldCost.source.kind` | source kind | yes | See source tags | C-30 |
| `stages[].respec.goldCost.source.ref` | string | yes | Non-empty; its form depends on `kind` | C-30 |
| `stages[].respec.goldCost.source.accessed` | string | no | `YYYY-MM-DD`; required for `external` | C-30 |
| `stages[].respec.goldCost.source.patch` | string | no | Non-empty, e.g. `0.5.5` | C-30, D-107 |
| `stages[].respec.goldCost.source.confidence` | `H`, `M` or `L` | no | Required for `external`, `judgment` and `external-unavailable` | C-30 |
| `stages[].respec.note` | string | yes | Non-empty. Why the tree changes | D-144 |
| `stages[].items` | object | yes | The item set. Stages with deep-equal `items` share one set | C-31, A-P2 |
| `stages[].items.setTitle` | string | no | Non-empty, no braces. The shared set's base title | A-P2 |
| `stages[].items.slots` | object[] | yes | One entry per filled slot | C-31 |
| `stages[].items.slots[].slot` | item slot | yes | One of `Weapon 1`, `Weapon 1 Swap`, `Weapon 2`, `Weapon 2 Swap`, `Helmet`, `Body Armour`, `Gloves`, `Boots`, `Amulet`, `Ring 1`, `Ring 2`, `Ring 3`, `Belt`, `Charm 1`, `Charm 2`, `Charm 3`, `Flask 1`, `Flask 2`. Unique within `slots` (a repeat errs at the later entry) | C-31 |
| `stages[].items.slots[].text` | string | yes | Non-empty. The item in PoB's item-text form (a `Rarity:` line, the name, the base for a rare or unique, then mod lines), lines joined by `\n`. Parsed at compile; a text with no `Implicits:` line, not a unique, gets its base's implicits (see a base's implicits above) | C-31, D-435 |
| `stages[].items.treeJewels` | object[] | yes | The jewels socketed in the tree | C-31 |
| `stages[].items.treeJewels[].node` | integer | yes | A jewel-socket node in `tree.nodes` | C-31 |
| `stages[].items.treeJewels[].text` | string | yes | Non-empty. The jewel's item text | C-31 |
| `stages[].items.toggles` | object[] | yes | Flask and charm activation, kept on the item set as PoB does. An active toggle is earned state, produced by the item in its slot | C-31, C-32 |
| `stages[].items.toggles[].slot` | `Flask 1`, `Flask 2`, `Charm 1`, `Charm 2` or `Charm 3` | yes | The flask or charm slot | C-31 |
| `stages[].items.toggles[].active` | boolean | yes | Whether it is active when the stage is measured | C-32 |
| `stages[].items.toggles[].uptime` | string | no | Non-empty. Required when `active` is true: how often it is up | C-32 |
| `stages[].items.useSecondWeaponSet` | boolean | yes | Whether weapon set 2 is the one in use | C-31 |
| `stages[].items.anoint` | object | no | The notable the stage's amulet is anointed with (see the anoint above). Only on the `budget` and `non-budget` rungs: on `entering-maps` or a campaign stage it errs here. The compile refuses a notable without a three-emotion recipe, one the stage's tree allocates, or a stage without an amulet. Schema version 3 | C-31, D-358 |
| `stages[].items.anoint.notable` | string | yes | Non-empty. The notable's PoB name, e.g. `Unbending`, matched ignoring case; written as `{enchant}Allocates <notable>` on the amulet | D-358 |
| `stages[].items.anoint.reason` | string | yes | Non-empty. Why this notable: what it adds, and why it isn't on the tree | D-358 |
| `stages[].skills` | object | yes | The skill set. Stages with deep-equal `skills` share one set | C-31, A-P2 |
| `stages[].skills.setTitle` | string | no | Non-empty, no braces. The shared set's base title | A-P2 |
| `stages[].skills.groups` | object[] | yes | The socket groups, in order; other fields index them from 1 | C-31 |
| `stages[].skills.groups[].label` | string | no | Non-empty | C-31 |
| `stages[].skills.groups[].enabled` | boolean | yes | Whether the group is enabled | C-31 |
| `stages[].skills.groups[].role` | `clear`, `single_target`, `utility` or `leveling` | yes | The group's job; the rolled-skill gate compares the rolled skill with the stage's other skills of its role | D-217 |
| `stages[].skills.groups[].gems` | object[] | yes | At least one gem, the active skill first | C-31 |
| `stages[].skills.groups[].gems[].name` | string | yes | Non-empty. The gem's PoB name, e.g. `Boneshatter`, `Rage I`. An unknown gem fails the compile, with suggestions | C-31 |
| `stages[].skills.groups[].gems[].level` | integer | yes | At least 1 | C-31, D-193 |
| `stages[].skills.groups[].gems[].quality` | integer | yes | At least 0 | C-31 |
| `stages[].skills.groups[].gems[].enabled` | boolean | yes | Whether the gem is enabled | C-31 |
| `stages[].skills.groups[].count` | integer | no | At least 1; 1 when absent. How many copies of the group act at once (see Count above). On the `rolledGroup` it is PoB's Count in Full DPS; the compile record applies it to every group's figures. Schema version 2 | C-31, D-293, D-320 |
| `stages[].skills.groups[].countReason` | string | no | Non-empty. Why `count` copies act at once; needed when `count` is above 1, else V1 reports `missing-reason`. Schema version 2 | D-293, D-322 |
| `stages[].skills.groups[].minionSkill` | string | no | Non-empty. The skill the group's summon's minion uses, as the gem lookup names it (see a minion's skill above). The group holds exactly one summon; the compile resolves the name against the minion's skill list, ignoring case, and refuses a name it can't use, listing its skills. The group's damage figure is then its minion's `MinionTotalDPS`. Schema version 4 | D-377, D-378 |
| `stages[].skills.groups[].minionStatSet` | integer | no | At least 1; 1 when absent. The minion skill's stat set; only with `minionSkill`. The compile refuses one beyond the skill's stat sets. Schema version 4 | D-377 |
| `stages[].skills.groups[].weaponSet` | `1` or `2` | no | The weapon set the group is on: the compiler sockets it in one of that set's weapon slots, the main hand unless its item grants a skill (PG-74; see a skill on a weapon set above), so PoB enables it only while that set is active. Absent, it is active on both sets. A group on set 2 makes the stage one that uses set 2; V1 reports a group on a set whose weapon slots are empty (`empty-weapon-set`). Schema version 6 | D-426 |
| `stages[].skills.main` | object | yes | The main skill selection | C-31, C-44 |
| `stages[].skills.main.group` | integer | yes | At least 1. The main skill's group, the same in every stage (error at the stage that differs from `stages[0]`) | C-31 |
| `stages[].skills.main.activeSkill` | integer | yes | At least 1. The active skill within that group; when the group names a `minionSkill`, its summon | C-31, C-44, D-377 |
| `stages[].skills.main.statSet` | integer | no | At least 1. The active skill's stat set | C-44 |
| `stages[].skills.rolledGroup` | integer | no | At least 1. The group holding a gem named `roll.skill`, or naming `roll.skill` as its `minionSkill` (its summon's minion casts it). Set wherever the stage has the rolled skill; required on an endgame variant stage. The compiler puts this group, and only it, in PoB's Full DPS, with its `count` | D-217, D-293, D-337, D-379 |
| `stages[].config` | object | yes | The config set: earned player state and scenario inputs. Each option appears once across `earned` and `scenario`. Stages with deep-equal `config` share one set | C-32, A-P2 |
| `stages[].config.setTitle` | string | no | Non-empty, no braces. The shared set's base title | A-P2 |
| `stages[].config.earned` | object[] | yes | Earned player state: stacks, charges, conditions, each with what produces it | C-32, D-114 |
| `stages[].config.earned[].option` | string | yes | Non-empty. A PoB config option, e.g. `multiplierRage`. Appears once across both lists (a repeat errs at the later entry) | C-32 |
| `stages[].config.earned[].value` | boolean, number or string | yes | The value written | C-32 |
| `stages[].config.earned[].producer` | object | no | Required when the value is on: what produces the state in this stage. The config check (V2) confirms it exists and is in the stage | A-P5, D-114, D-221 |
| `stages[].config.earned[].producer.kind` | `item`, `gem`, `passive`, `skill`, `flask` or `charm` | yes | The producer's kind | C-32 |
| `stages[].config.earned[].producer.name` | string | yes | Non-empty. Its name as PoB has it | C-32 |
| `stages[].config.earned[].uptime` | string | no | Non-empty. Required when the value is on: how the state is kept up | A-P5, C-32 |
| `stages[].config.scenario` | object[] | yes | Scenario inputs: enemy level, `enemyIsBoss`, enemy damage and resistances, waystone modifiers, quest rewards, the resistance penalty. On an endgame stage the compiler fills each reference hit (`enemy<Type>Damage`) the list leaves out, from the data at the rung's area level (see reference hits above, D-353). Must list `enemyIsBoss`, which the compiler writes into every config set (error at `config.scenario`). The config check (V2) reports `default-unlisted` for every option PoB has on by default (`resistancePenalty`) or fills from a placeholder that this stage doesn't list and `data/config-baseline.json` doesn't cover. The list covers an option PoB shows only for some builds (a skill's toggle, such as `FlickerStrikeBypassCD`) only while PoB hides it, so list it in `earned`, with its producer and uptime, once the stage has that skill (D-250). On a boss stage (`enemyIsBoss` other than `None`) list the enemy's level, armour, evasion, resistances and crit here, citing E1 (D-252). A reward quest's checkbox is on by default and in the baseline list; list it `false` in `earned` while its quest is beyond `progress` (`quest-not-reached`). A reward choice (a quest whose C1 data has `q.<key>.options`) defaults to Nothing; once the stage's `progress` is at or after its quest, list the pick here: `option` the quest's `q.<key>.pob-config-key`, `value` one of the options exactly, `source` `{file: "campaign/progress.json", key: "q.<key>.options[<i>]"}`, the same pick on every such campaign stage (the run checker holds a build-guide plan to it, D-265) | C-32, D-119, A-P4, D-212, D-230, D-250, D-252, D-265 |
| `stages[].config.scenario[].option` | string | yes | Non-empty. A PoB config option. Appears once across both lists (a repeat errs at the later entry) | C-32 |
| `stages[].config.scenario[].value` | boolean, number or string | yes | The value written, taken from the cited fact | C-32 |
| `stages[].config.scenario[].source` | object | yes | The C1/E1 fact the value comes from | C-32, C-35 |
| `stages[].config.scenario[].source.file` | string | yes | Non-empty. A data file relative to `data/`, e.g. `campaign/limits.json` | C-35, A-P11 |
| `stages[].config.scenario[].source.key` | string | yes | Non-empty. A fact id, optionally followed by `[<member>]` to pick one member, e.g. `life.by-level[79]` | C-35 |
| `stages[].config.scenario[].tag` | object (SourceTag) | yes | The fact's own tag, copied with its value | D-168 |
| `stages[].config.scenario[].tag.kind` | source kind | yes | See source tags | C-30 |
| `stages[].config.scenario[].tag.ref` | string | yes | Non-empty; its form depends on `kind` | C-30 |
| `stages[].config.scenario[].tag.accessed` | string | no | `YYYY-MM-DD`; required for `external` | C-30 |
| `stages[].config.scenario[].tag.patch` | string | no | Non-empty, e.g. `0.5.5` | C-30, D-107 |
| `stages[].config.scenario[].tag.confidence` | `H`, `M` or `L` | no | Required for `external`, `judgment` and `external-unavailable` | C-30 |
| `stages[].config.customMods` | object[] | no | Custom modifiers: hand-calculated effects, written into PoB's custom modifier box after `earned` and `scenario`, one line per entry (see custom modifiers above). The compile record marks every figure of the stage. From version 2 on, `customMods` is never an `earned` or `scenario` option. Schema version 2 | C-32, D-293, D-320 |
| `stages[].config.customMods[].text` | string | yes | Non-empty, one line. A PoB modifier line, e.g. `10% more Damage`; a line PoB can't parse whole fails the compile | D-293 |
| `stages[].config.customMods[].reason` | string | no | Non-empty. What the line stands for and how it was worked out; without it, V1 reports `missing-reason` | D-293, D-322 |
| `stages[].companion` | object | no | The stage's tamed beast: its species and the rare monster modifiers it keeps (see a tamed beast above). The stage holds exactly one `Tame Beast` gem, enabled, in an enabled group, which the compile turns into the beast. Schema version 5 | D-402 |
| `stages[].companion.species` | string | yes | Non-empty. The beast, as PoB's beast library names it (ignoring case), or its monster id when several beasts share the name; the compile refuses a species the library lacks or a shared name | D-402 |
| `stages[].companion.mods` | string[] | yes | The kept modifiers' ids in `data/monsters/monster-mods.md`, at most 4, each once; `[]` for none. Each is applied by its row's model: `stats` as custom-modifier estimates, `condition` as its config option, `none` not at all. An id the table lacks errs here; an option a `condition` row writes errs where the stage lists it too | D-402 |
| `stages[].claims` | object[] | yes | The stage's claims, each with its source | C-30, D-105 |
| `stages[].claims[].id` | string | yes | Non-empty | C-30 |
| `stages[].claims[].text` | string | yes | Non-empty. The claim as the guide states it | C-30 |
| `stages[].claims[].kind` | `hinge` or `reason` | no | Why the claim is written: a fact whose being wrong would make the build fail at its rung (`hinge`), or a reason resting on a measurement (`reason`). Schema version 3 | D-351 |
| `stages[].claims[].source` | object (SourceTag) or string | yes | A source tag, or a citation: `ledger:<id>` or `price:<id>` naming an existing entry, or `data:<file>#<key>` naming a C1/E1 fact | C-30, D-232, D-237 |
| `stages[].claims[].source.kind` | source kind | yes | See source tags | C-30 |
| `stages[].claims[].source.ref` | string | yes | Non-empty; its form depends on `kind` | C-30 |
| `stages[].claims[].source.accessed` | string | no | `YYYY-MM-DD`; required for `external` | C-30 |
| `stages[].claims[].source.patch` | string | no | Non-empty, e.g. `0.5.5` | C-30, D-107 |
| `stages[].claims[].source.confidence` | `H`, `M` or `L` | no | Required for `external`, `judgment` and `external-unavailable` | C-30 |
| `ledger` | object[] | yes | Derived numbers, evaluated from the compile record on every compile | C-33, D-170 |
| `ledger[].id` | string | yes | `[A-Za-z_][A-Za-z0-9_]*`; unique. What a `ledger:<id>` claim cites | C-33 |
| `ledger[].claim` | string | yes | Non-empty. The claim the number supports | C-33 |
| `ledger[].formula` | string | yes | Parses as a ledger formula, and each reference names an input of this entry or a plan stage | C-33, D-163, D-170 |
| `ledger[].inputs` | object[] | yes | The named constants the formula uses | C-33 |
| `ledger[].inputs[].name` | string | yes | `[A-Za-z_][A-Za-z0-9_]*`; unique within the entry | C-33 |
| `ledger[].inputs[].value` | number | yes | Finite | C-33 |
| `ledger[].inputs[].tag` | object (SourceTag) | yes | The value's source | C-30, C-33 |
| `ledger[].inputs[].tag.kind` | source kind | yes | See source tags | C-30 |
| `ledger[].inputs[].tag.ref` | string | yes | Non-empty; its form depends on `kind` | C-30 |
| `ledger[].inputs[].tag.accessed` | string | no | `YYYY-MM-DD`; required for `external` | C-30 |
| `ledger[].inputs[].tag.patch` | string | no | Non-empty, e.g. `0.5.5` | C-30, D-107 |
| `ledger[].inputs[].tag.confidence` | `H`, `M` or `L` | no | Required for `external`, `judgment` and `external-unavailable` | C-30 |
| `prices` | object[] | yes | Dated prices. Re-runs within a run reuse them; the server keeps no price cache | C-31, D-169 |
| `prices[].id` | string | yes | `[A-Za-z0-9_-]+`; unique (a repeat errs at the later entry). What a `price:<id>` claim cites | D-237 |
| `prices[].item` | string | yes | Non-empty. What was priced | C-31 |
| `prices[].query` | any JSON | yes | The trade query used. A rare of `b` or `n` is `{slot, required, target}`, written by D1-build before it is priced: `slot` as `find_upgrades` names it (`Helmet`, `Ring 1`, `Jewel <node id>`), `required` its required affixes, at most 3, each `{affix, min}`, and `target` `{divines, day}` (on `n`, with `reason` when the slot takes more than its share); the pricing step adds the arguments of the call whose price it records (`find_upgrades`', or the over-target `search_trade_items`'). A Distilled Emotion is `{"exchange": "Delirium", "name": "<emotion>"}`. The schema checks none of this | C-31, D-169, D-370, D-372, D-387 |
| `prices[].amount` | number or null | yes | At least 0. Set when `status` is `ok`, null when `unavailable` | D-164 |
| `prices[].currency` | string or null | yes | Non-empty. Set when `status` is `ok`, null when `unavailable` | D-164 |
| `prices[].date` | string | yes | `YYYY-MM-DD`, the day the price was taken | D-169 |
| `prices[].league` | string or null | yes | Equal to the plan's `league` | D-233 |
| `prices[].status` | `ok` or `unavailable` | yes | `unavailable` when trade couldn't be reached (no cookie, rate-limited, down, disabled or offline) | D-164 |
| `prices[].note` | string | no | Non-empty. Required when `unavailable`: the reason, `offline run` in an offline run. On a priced `b` or `n` rare, its fit against the designed item (`fit 85%`), or `over target`. Not build content: `buildSha1` leaves it out (D-386) | C-31, D-233, D-372, D-386 |

## Worked example

The two-stage plan below is `tests/fixtures/plans/two-stage/plan.json`, and it validates. It is a Warrior
Titan who rolled Boneshatter, written at schema version 3, which version 4 still accepts: it names no minion
skill. Both stages are campaign stages, so neither has an anoint; a claim's `kind`, an endgame stage's anoint and
a group's minion skill are shown above.

- **Stage `1`** is level 5 at Beira, the first Act 1 quest reward (`q.act-1-clearfell-beira`). Its tree
  spends 4 points from the Warrior's start, one of them on an attribute node set to strength.
- **Stage `2`** is level 14 at Candlemass (`q.act-1-ogham-manor-candlemass`). Its tree contains stage 1's,
  so it needs no `respec`.
- Both stages have the same `items`, so the compiler gives them one item set, `Act 1 gear {1,2}`. Their
  `skills` differ (gem levels and a support gem), and so do their `config` values, so each gets its own.
- The main skill is group 1 in both stages, and `rolledGroup` points at the group holding Boneshatter.
  Each earned entry that is on names its producer and uptime; each scenario entry cites a C1/E1 fact and
  copies its tag, and `enemyIsBoss` is listed in both.
- The claims use every tag kind and every citation form. `ledger:life_gain_pct` cites the one ledger
  entry, which reads both stages' `Life`; `price:rough-greaves-life` cites the `ok` price, beside an
  `unavailable` one whose note gives the reason.

```json
{
  "schemaVersion": 3,
  "roll": { "className": "Warrior", "ascendancy": "Titan", "skill": "Boneshatter" },
  "versions": {
    "pobTag": "v0.23.1",
    "pobCommit": "7d6f530cbdab20389ff8bc6ba97a37ac27f74e41",
    "treeVersion": "0_5",
    "enginePatch": "0.5.4",
    "externalPatch": "0.5.5"
  },
  "league": "Forbidden Rites",
  "stages": [
    {
      "id": "1",
      "loadoutName": "Act 1 Clearfell (L5) {1}",
      "level": 5,
      "progress": "q.act-1-clearfell-beira",
      "tree": {
        "nodes": [3936, 46325, 13397, 33556],
        "ascendancyNodes": [],
        "weaponSetNodes": { "set1": [], "set2": [] },
        "attributeChoices": [{ "node": 13397, "attribute": "strength" }]
      },
      "items": {
        "setTitle": "Act 1 gear",
        "slots": [
          { "slot": "Weapon 1", "text": "Rarity: Normal\nWooden Club" },
          { "slot": "Body Armour", "text": "Rarity: Normal\nRusted Cuirass" },
          { "slot": "Boots", "text": "Rarity: Magic\nHale Rough Greaves\n+12 to maximum Life" },
          { "slot": "Flask 1", "text": "Rarity: Normal\nLesser Life Flask" }
        ],
        "treeJewels": [],
        "toggles": [
          { "slot": "Flask 1", "active": true, "uptime": "drunk when life drops in a fight; active about a third of the time" }
        ],
        "useSecondWeaponSet": false
      },
      "skills": {
        "groups": [
          {
            "label": "Boneshatter",
            "enabled": true,
            "role": "single_target",
            "gems": [
              { "name": "Boneshatter", "level": 1, "quality": 0, "enabled": true },
              { "name": "Rage I", "level": 1, "quality": 0, "enabled": true }
            ]
          },
          {
            "label": "Rolling Slam",
            "enabled": true,
            "role": "clear",
            "gems": [{ "name": "Rolling Slam", "level": 1, "quality": 0, "enabled": true }]
          }
        ],
        "main": { "group": 1, "activeSkill": 1 },
        "rolledGroup": 1
      },
      "config": {
        "earned": [
          {
            "option": "multiplierRage",
            "value": 10,
            "producer": { "kind": "gem", "name": "Rage I" },
            "uptime": "built by Boneshatter hits through Rage I; held during a pack fight, lost between packs"
          },
          { "option": "questAct 1FreythornKing In The Mists", "value": false },
          { "option": "questAct 1Ogham ManorCandlemass", "value": false },
          { "option": "questAct 2Spires of DesharSisters of Garukhan Shrine", "value": false },
          { "option": "questAct 3Azak BogIgnagduk", "value": false },
          { "option": "questAct 3Jiquani's MachinariumBlackjaw", "value": false },
          { "option": "questAct 4Eye of HinekoraSilent Hall", "value": false },
          { "option": "questInterlude 2Khari CrossingMolten Shrine", "value": false },
          { "option": "questInterlude 3Kriar VillageLythara", "value": false }
        ],
        "scenario": [
          {
            "option": "enemyIsBoss",
            "value": "None",
            "source": { "file": "enemies/map-monsters.json", "key": "pob-enemy-is-boss" },
            "tag": { "kind": "pob-data", "ref": "Modules/ConfigOptions.lua:1964", "patch": "0.5.4", "confidence": "H" }
          },
          {
            "option": "resistancePenalty",
            "value": 0,
            "source": { "file": "campaign/limits.json", "key": "resistance-penalty.act1" },
            "tag": { "kind": "pob-data", "ref": "Modules/ConfigOptions.lua:113", "patch": "0.5.4", "confidence": "H" }
          }
        ]
      },
      "claims": [
        {
          "id": "s1-life",
          "text": "Stage 1's maximum life, as PoB computes it at level 5.",
          "source": { "kind": "pob-computed", "ref": "1.Life" }
        },
        {
          "id": "s1-beira",
          "text": "Beira's quest reward is +10% to Cold Resistance.",
          "source": { "kind": "pob-data", "ref": "Data/QuestRewards.lua:7", "patch": "0.5.4" }
        },
        {
          "id": "s1-boneshatter",
          "text": "Boneshatter carries a Titan through the campaign from Act 1.",
          "source": {
            "kind": "external",
            "ref": "https://maxroll.gg/poe2/build-guides/boneshatter-titan-leveling-guide",
            "accessed": "2026-10-07",
            "patch": "0.5.5",
            "confidence": "M"
          }
        },
        {
          "id": "s1-roles",
          "text": "Rolling Slam clears packs; Boneshatter takes rare monsters and bosses.",
          "source": {
            "kind": "judgment",
            "ref": "Rolling Slam's two slams cover an area, while Boneshatter strikes one target",
            "confidence": "M"
          }
        },
        {
          "id": "s1-penalty",
          "text": "Act 1 has no elemental resistance penalty.",
          "source": "data:campaign/limits.json#resistance-penalty.act1"
        }
      ]
    },
    {
      "id": "2",
      "loadoutName": "Act 1 Ogham Manor (L14) {2}",
      "level": 14,
      "progress": "q.act-1-ogham-manor-candlemass",
      "tree": {
        "nodes": [3936, 46325, 13397, 33556, 55473, 39581, 6839, 5710, 43164, 6529, 32416, 53443, 59767],
        "ascendancyNodes": [],
        "weaponSetNodes": { "set1": [], "set2": [] },
        "attributeChoices": [{ "node": 13397, "attribute": "strength" }]
      },
      "items": {
        "setTitle": "Act 1 gear",
        "slots": [
          { "slot": "Weapon 1", "text": "Rarity: Normal\nWooden Club" },
          { "slot": "Body Armour", "text": "Rarity: Normal\nRusted Cuirass" },
          { "slot": "Boots", "text": "Rarity: Magic\nHale Rough Greaves\n+12 to maximum Life" },
          { "slot": "Flask 1", "text": "Rarity: Normal\nLesser Life Flask" }
        ],
        "treeJewels": [],
        "toggles": [
          { "slot": "Flask 1", "active": true, "uptime": "drunk when life drops in a fight; active about a third of the time" }
        ],
        "useSecondWeaponSet": false
      },
      "skills": {
        "groups": [
          {
            "label": "Boneshatter",
            "enabled": true,
            "role": "single_target",
            "gems": [
              { "name": "Boneshatter", "level": 3, "quality": 0, "enabled": true },
              { "name": "Rage I", "level": 1, "quality": 0, "enabled": true },
              { "name": "Brutality I", "level": 1, "quality": 0, "enabled": true }
            ]
          },
          {
            "label": "Rolling Slam",
            "enabled": true,
            "role": "clear",
            "gems": [{ "name": "Rolling Slam", "level": 3, "quality": 0, "enabled": true }]
          }
        ],
        "main": { "group": 1, "activeSkill": 1, "statSet": 1 },
        "rolledGroup": 1
      },
      "config": {
        "earned": [
          {
            "option": "multiplierRage",
            "value": 20,
            "producer": { "kind": "gem", "name": "Rage I" },
            "uptime": "built by Boneshatter hits through Rage I; held during a pack fight, lost between packs"
          },
          { "option": "questAct 2Spires of DesharSisters of Garukhan Shrine", "value": false },
          { "option": "questAct 3Azak BogIgnagduk", "value": false },
          { "option": "questAct 3Jiquani's MachinariumBlackjaw", "value": false },
          { "option": "questAct 4Eye of HinekoraSilent Hall", "value": false },
          { "option": "questInterlude 2Khari CrossingMolten Shrine", "value": false },
          { "option": "questInterlude 3Kriar VillageLythara", "value": false }
        ],
        "scenario": [
          {
            "option": "enemyIsBoss",
            "value": "None",
            "source": { "file": "enemies/map-monsters.json", "key": "pob-enemy-is-boss" },
            "tag": { "kind": "pob-data", "ref": "Modules/ConfigOptions.lua:1964", "patch": "0.5.4", "confidence": "H" }
          },
          {
            "option": "resistancePenalty",
            "value": 0,
            "source": { "file": "campaign/limits.json", "key": "resistance-penalty.act1" },
            "tag": { "kind": "pob-data", "ref": "Modules/ConfigOptions.lua:113", "patch": "0.5.4", "confidence": "H" }
          }
        ]
      },
      "claims": [
        {
          "id": "s2-life-gain",
          "text": "Stage 2 has about N% more maximum life than stage 1.",
          "source": "ledger:life_gain_pct"
        },
        {
          "id": "s2-greaves",
          "text": "Rough Greaves with +10 or more to maximum Life cost about 1 Exalted Orb.",
          "source": "price:rough-greaves-life"
        },
        {
          "id": "s2-candlemass",
          "text": "Candlemass's quest reward is +20 to maximum Life.",
          "source": "data:campaign/progress.json#q.act-1-ogham-manor-candlemass.life"
        },
        {
          "id": "s2-rage",
          "text": "Rage stays near 20 through Ogham Manor's packs.",
          "source": { "kind": "external-unavailable", "ref": "external source unavailable (offline run)", "confidence": "L" }
        }
      ]
    }
  ],
  "ledger": [
    {
      "id": "life_gain_pct",
      "claim": "Stage 2 has about N% more maximum life than stage 1.",
      "formula": "(2.Life − 1.Life) ÷ 1.Life × per_cent",
      "inputs": [
        {
          "name": "per_cent",
          "value": 100,
          "tag": { "kind": "judgment", "ref": "unit conversion: a ratio times 100 is a percentage", "confidence": "H" }
        }
      ]
    }
  ],
  "prices": [
    {
      "id": "rough-greaves-life",
      "item": "Rough Greaves with +10 or more to maximum Life",
      "query": {
        "query": {
          "status": { "option": "online" },
          "type": "Rough Greaves",
          "stats": [{ "type": "and", "filters": [{ "id": "explicit.stat_3299347043", "value": { "min": 10 } }] }]
        },
        "sort": { "price": "asc" }
      },
      "amount": 1,
      "currency": "exalted",
      "date": "2026-10-07",
      "league": "Forbidden Rites",
      "status": "ok"
    },
    {
      "id": "wooden-club",
      "item": "Wooden Club",
      "query": {
        "query": { "status": { "option": "online" }, "type": "Wooden Club" },
        "sort": { "price": "asc" }
      },
      "amount": null,
      "currency": null,
      "date": "2026-10-07",
      "league": "Forbidden Rites",
      "status": "unavailable",
      "note": "trade search unavailable: no session cookie configured"
    }
  ]
}
```
