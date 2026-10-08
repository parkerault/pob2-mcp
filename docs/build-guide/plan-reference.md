# Build plan reference (`plan.json`, schema version 1)

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
- **Version first.** `schemaVersion` must be `1`. Any other value, or none, gives exactly one error, at
  `schemaVersion`, listing the accepted versions `[1]`; nothing else is checked.
- **Cross-references** (one field's rule depending on another's value) are checked once each field has
  the right type, each with its own path: a repeated stage id errs at the later stage's `id`, a weapon-set
  node outside the tree at `tree.weaponSetNodes.set1[n]`, a bad ledger formula at `ledger[n].formula`.
- **Unions.** Where a field takes several types (a claim's `source`, a config `value`), the errors are
  those of the type the value has: a source tag object missing `accessed` errs at `source.accessed`.
- **Reference data.** Two checks need the committed C1/E1 data files under `data/`: that each `progress`
  is a C1 progress key, and that each `data:<file>#<key>` claim names a loaded fact (D-214, D-232). They
  run where the server loads that data (`src/plan/referenceData.ts`, C-35), with errors at
  `stages[n].progress` and `stages[n].claims[m].source`, reported together with the schema's errors.

Some rules are checked at compile time, against PoB, rather than by the schema: gem names, item text,
node ids and tree connectivity, config option names and values, and the main skill's index (C-41 step 5).

## Terms

### Source tags (C-30)

Every claim carries a **source tag**, `{kind, ref, accessed?, patch?, confidence?}` (D-105). The tag's
rules depend on its `kind`:

| `kind` | `ref` | Also required |
|---|---|---|
| `pob-computed` | A compile-record field: `<stageId>.<Field>` (a main output, e.g. `1.Life`) or `<stageId>.g<group>s<skill>p<statSet>.<Field>` (a per-skill breakdown field, C-45) | — |
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

Validation fails on a syntax error (an unexpected token, a missing `)`, an empty formula), an unknown
input, or a reference to a stage the plan doesn't have, each with its 0-based column. At compile time, a reference to an output the record doesn't hold, a
stage the compile didn't include, a division by zero or a non-finite result sets that entry's value to
null with the error in the record; the compile still succeeds. Values are unrounded doubles.

### Shared sets (A-P2)

The compiler gives every stage its own tree, titled `loadoutName`. Stages whose `items` (likewise
`skills`, `config`) are deep-equal share one PoB set, titled `<base> {<ids>}`: `base` is the content's
`setTitle`, else the first sharing stage's `loadoutName` without its ` {<id>}`; `ids` are the sharing
stages' ids in plan order, joined by `,` (D-103).

## Fields

`SourceTag` rows follow the source-tag rules above. "Required" says whether the key must be present; a
rule may require an optional key in some cases.

| Path | Type | Required | Rule | Decision |
|---|---|---|---|---|
| `schemaVersion` | `1` | yes | Must be `1`. Any other value, or none, is the only error reported, and it lists the accepted versions `[1]` | C-31, D-167 |
| `roll` | object | yes | The roll the guide is built around | C-31 |
| `roll.className` | string | yes | Non-empty. A PoB2 class, e.g. `Warrior` | C-31 |
| `roll.ascendancy` | string | yes | Non-empty. Its ascendancy, e.g. `Titan` | C-31, D-238 |
| `roll.skill` | string | yes | Non-empty. The rolled skill gem's name; `skills.rolledGroup` names a group holding a gem of this name (case-insensitive) | C-31, D-217 |
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
| `stages[].variant` | `budget` or `non-budget` | no | Marks an endgame variant stage. `variant`, `ascendancyPoints` and `variantBasis` are all present or all absent; a missing one errs at its own path | C-31, D-193 |
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
| `stages[].tree.nodes` | integer[] | yes | Every allocated non-ascendancy node id, a complete list connected to the class start through listed nodes. The class start node, which PoB allocates itself, isn't listed. Existence and connectivity are checked at compile | C-31, D-213 |
| `stages[].tree.ascendancyNodes` | integer[] | yes | Every allocated ascendancy node id, without the ascendancy's start node, which PoB allocates itself | C-31 |
| `stages[].tree.weaponSetNodes` | object | yes | The nodes tagged to weapon set 1 or 2. A tagged node paths only through untagged nodes and nodes of its own set | C-31, D-213 |
| `stages[].tree.weaponSetNodes.set1` | integer[] | yes | Each node is in `tree.nodes` (error at `set1[n]`) | C-31 |
| `stages[].tree.weaponSetNodes.set2` | integer[] | yes | Each node is in `tree.nodes` and not in `set1` (error at `set2[n]`) | C-31 |
| `stages[].tree.attributeChoices` | object[] | yes | The attribute picked on each `+5 to any Attribute` node | C-31 |
| `stages[].tree.attributeChoices[].node` | integer | yes | In `tree.nodes` | C-31 |
| `stages[].tree.attributeChoices[].attribute` | `strength`, `dexterity` or `intelligence` | yes | The attribute the node grants | C-31 |
| `stages[].respec` | object | no | Present wherever the tree drops a node the previous stage on its track had; the guide lists it with its gold cost | D-144, A-P3 |
| `stages[].respec.dropped` | integer[] | yes | Exactly the node ids dropped from the previous stage's tree | D-144 |
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
| `stages[].items.slots[].text` | string | yes | Non-empty. The item in PoB's item-text form (a `Rarity:` line, the name, the base for a rare or unique, then mod lines), lines joined by `\n`. Parsed at compile | C-31 |
| `stages[].items.treeJewels` | object[] | yes | The jewels socketed in the tree | C-31 |
| `stages[].items.treeJewels[].node` | integer | yes | A jewel-socket node in `tree.nodes` | C-31 |
| `stages[].items.treeJewels[].text` | string | yes | Non-empty. The jewel's item text | C-31 |
| `stages[].items.toggles` | object[] | yes | Flask and charm activation, kept on the item set as PoB does. An active toggle is earned state, produced by the item in its slot | C-31, C-32 |
| `stages[].items.toggles[].slot` | `Flask 1`, `Flask 2`, `Charm 1`, `Charm 2` or `Charm 3` | yes | The flask or charm slot | C-31 |
| `stages[].items.toggles[].active` | boolean | yes | Whether it is active when the stage is measured | C-32 |
| `stages[].items.toggles[].uptime` | string | no | Non-empty. Required when `active` is true: how often it is up | C-32 |
| `stages[].items.useSecondWeaponSet` | boolean | yes | Whether weapon set 2 is the one in use | C-31 |
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
| `stages[].skills.main` | object | yes | The main skill selection | C-31, C-44 |
| `stages[].skills.main.group` | integer | yes | At least 1. The main skill's group, the same in every stage (error at the stage that differs from `stages[0]`) | C-31 |
| `stages[].skills.main.activeSkill` | integer | yes | At least 1. The active skill within that group | C-31, C-44 |
| `stages[].skills.main.statSet` | integer | no | At least 1. The active skill's stat set | C-44 |
| `stages[].skills.rolledGroup` | integer | no | At least 1. The group holding a gem named `roll.skill`. Set wherever the stage has the rolled skill; required on an endgame variant stage | D-217 |
| `stages[].config` | object | yes | The config set: earned player state and scenario inputs. Each option appears once across `earned` and `scenario`. Stages with deep-equal `config` share one set | C-32, A-P2 |
| `stages[].config.setTitle` | string | no | Non-empty, no braces. The shared set's base title | A-P2 |
| `stages[].config.earned` | object[] | yes | Earned player state: stacks, charges, conditions, each with what produces it | C-32, D-114 |
| `stages[].config.earned[].option` | string | yes | Non-empty. A PoB config option, e.g. `multiplierRage`. Appears once across both lists (a repeat errs at the later entry) | C-32 |
| `stages[].config.earned[].value` | boolean, number or string | yes | The value written | C-32 |
| `stages[].config.earned[].producer` | object | no | Required when the value is on: what produces the state in this stage. The config check (V2) confirms it exists and is in the stage | A-P5, D-114, D-221 |
| `stages[].config.earned[].producer.kind` | `item`, `gem`, `passive`, `skill`, `flask` or `charm` | yes | The producer's kind | C-32 |
| `stages[].config.earned[].producer.name` | string | yes | Non-empty. Its name as PoB has it | C-32 |
| `stages[].config.earned[].uptime` | string | no | Non-empty. Required when the value is on: how the state is kept up | A-P5, C-32 |
| `stages[].config.scenario` | object[] | yes | Scenario inputs: enemy level, `enemyIsBoss`, enemy damage and resistances, waystone modifiers, quest rewards, the resistance penalty. Must list `enemyIsBoss`, which the compiler writes into every config set (error at `config.scenario`). The config check (V2) reports `default-unlisted` for every option PoB has on by default (`resistancePenalty`) or fills from a placeholder that this stage doesn't list and `data/config-baseline.json` doesn't cover. The list covers an option PoB shows only for some builds (a skill's toggle, such as `FlickerStrikeBypassCD`) only while PoB hides it, so list it in `earned`, with its producer and uptime, once the stage has that skill (D-250). On a boss stage (`enemyIsBoss` other than `None`) list the enemy's level, armour, evasion, resistances and crit here, citing E1 (D-252). A reward quest's checkbox is on by default and in the baseline list; list it `false` in `earned` while its quest is beyond `progress` (`quest-not-reached`) | C-32, D-119, A-P4, D-212, D-230, D-250, D-252 |
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
| `stages[].claims` | object[] | yes | The stage's claims, each with its source | C-30, D-105 |
| `stages[].claims[].id` | string | yes | Non-empty | C-30 |
| `stages[].claims[].text` | string | yes | Non-empty. The claim as the guide states it | C-30 |
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
| `prices[].query` | any JSON | yes | The trade query used | C-31, D-169 |
| `prices[].amount` | number or null | yes | At least 0. Set when `status` is `ok`, null when `unavailable` | D-164 |
| `prices[].currency` | string or null | yes | Non-empty. Set when `status` is `ok`, null when `unavailable` | D-164 |
| `prices[].date` | string | yes | `YYYY-MM-DD`, the day the price was taken | D-169 |
| `prices[].league` | string or null | yes | Equal to the plan's `league` | D-233 |
| `prices[].status` | `ok` or `unavailable` | yes | `unavailable` when trade couldn't be reached (no cookie, rate-limited, down, disabled or offline) | D-164 |
| `prices[].note` | string | no | Non-empty. Required when `unavailable`: the reason, `offline run` in an offline run | C-31, D-233 |

## Worked example

The two-stage plan below is `tests/fixtures/plans/two-stage/plan.json`, and it validates. It is a Warrior
Titan who rolled Boneshatter.

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
  "schemaVersion": 1,
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
        "nodes": [3936, 46325, 13397, 38646],
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
        "nodes": [3936, 46325, 13397, 38646, 33556, 55473, 39581, 6839, 5710, 1913, 4665, 61534, 7721],
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
