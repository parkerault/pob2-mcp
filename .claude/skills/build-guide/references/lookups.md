# Lookups and what PoB can't model

How the steps that may call lookups (the researchers, the V4 verifiers, the coordinator, and the runner at a
gate) use the game-data tools, and how to treat what PoB doesn't model (R-22: PoB ignores a line on about 13%
of unique mods, 30% of keystones and 32% of ascendancy notables, so hand calculations are routine).

## The lookup set L (server `pob2`; all kind `read`, they never change the build)

- `mcp__pob2__lookup_game_data` (C-37):
  - `{mode: "gem", query}`: each gem's kind (`active` or `support`), description, weapon, every stat set
    ("skill part") with its **base attack damage and base critical hit chance** (D-241) and PoB's tooltip
    lines at `gem_level` and `gem_quality`, the quality lines, the requirements at every gem level
    (D-228), and for a support what it can and can't support. Amendment 3's additions (D-299):
    - **Gemling quality.** Under `At +20% Quality, with the Gemling Legionnaire's Advanced Thaumaturgy:`,
      the extra quality lines PoB applies only with that node (PG-46).
    - **Usable by.** An active gem's `Skill types:` and `Usable by:`, the meta gems that can socket it,
      `(trigger)` marking those that trigger it. Example: Snipe is usable by Mirage Archer.
    - **Hit-making children.** Its granted and triggered skills and its minions' skills that make hits, for
      the payoff-thief check. Example: Bloodhound's Mark's `Blood Explosion (triggered)`.
    - **With exactly one gem returned** (its exact name, or `max_results: 1`), or when every returned gem
      has exactly the queried name (each is then shown in full, and a repeated name in a list prints once as
      `<name> ×n`): a support's `Can support (<n>
      of <total> active gems)`, which names the gems it can't support (`all except …`) when it can support
      most; and an active gem's `Unlocked by another support:`, the supports it can take only after another
      support adds a skill type. Example: Whirling Assault lists `Ailith's Chimes: after … Culmination II …`.
    - **A minion skill** (D-379), by its exact name, after the gems of that name: `## <name>`, then
      `Kind: minion skill`, one `Cast by: <minion> (summoned by <gem>)` line per summon, `Commanded: yes` for a
      command, one `Granted by: <passive> (<ascendancy>, node <id>)` line per passive that grants it, its
      cooldown, skill types and stat sets. It isn't a gem: a plan selects it as its summon's group's
      `minionSkill`. Example: Navira's Fracturing, `Cast by: Navira, the Last Mirage (summoned by Navira, the
      Last Mirage)`, a command granted by node 10561.
  - `{mode: "unique", query, slot?}`: with **several matches, each is shown in brief** (name, type,
    base, up to 5 matched lines with their variant); **full item text, ready for a plan's item slot, comes
    only when exactly one unique is returned** (D-239). Look a unique up by its exact name (or with
    `max_results: 1`) to get its text.
  - `{mode: "mechanic", query, kind?}`: keyword hits across gems, uniques, passives (ascendancy included),
    item mods, essences and item-base implicits. **`kind` (`gem`, `unique`, `passive`, `mod`, `essence`
    or `base`) lists one kind only**; the header still counts every kind's hits (D-240). Use it when a
    broad query fills every slot with one kind. Amendment 3's additions (D-299):
    - **Stat sets by number.** A gem hit from a stat set names it as gem mode numbers it, the number a
      plan's `skills.main.statSet` takes: `[gem] Blood Hunt (stat set 2: Explosion): …`. A hit from
      another granted effect reads `<gem> / <effect> (stat set <n>: <label>)`.
    - **Quality lines** are hits too: `<gem> (quality)` and `<gem> (Gemling quality)`.
    - **Item-base implicits** are `[base]` hits, naming a variant when the line has one:
      `[base] Absent Amulet (Amulet; variant Cast on Critical): Grants Skill: Level (1-20) Cast on
      Critical`. A base's name matches every line of it.
    - **Gaps.** `…` (or `...`) in the query matches any text within one line.
  - **The named phrase searches** (D-299). Run these as mechanic queries when a concept leans on a hidden
    interaction; each finds a wording family the pattern library uses: `also apply to`,
    `while already at maximum`, `per 100 maximum`, `for each type of`, `cannot … but`, `instead of you`
    and `your … shatter`.
  - **A mod hit's base types** (D-277). Under each `[mod]` hit, `Base types:` lists the bases that can
    roll that mod (PoB gives it a non-zero spawn weight), as PoB's own base types, separated by `;`:
    - `Gloves (all)`: every base of that item type;
    - `Gloves: Energy Shield`: every base of one of PoB's base types (item type, then defence);
    - `Staff (8 of 14 bases: …)`: only the named bases of that base type;
    - `none (no base has a spawn weight for it)`: no base can roll the mod.
    - `none (Exclusive mods aren't rolled on a base)`: PoB never rolls this table's mods on a base, whatever
      their weights. They come from a unique, an essence or another fixed source. `IncursionLimb` mods, and
      Desecrated mods without a desecrated tag, say the same.

    A rune's mod has no line. Desecrated mods (table `Desecrated`) are often limited to a defence type.
  - **Essences** (D-277). An `[essence]` hit names the essence, the item types it applies that mod to,
    and Prefix or Suffix when PoB gives one. Example: `[essence] Greater Essence of Haste (Bow,
    Crossbow; Suffix): (14-16)% increased Attack Speed`. A hit matches on the mod line or on the
    essence's name, so `{query: "Essence of Haste", kind: "essence"}` lists every tier. An essence whose
    only mod has no text (Essence of Delirium) has no hits.
  - **Sourcing an affix's limit on its base** (D1, amendment 2): look the affix up with `kind: "mod"`
    and `kind: "essence"`. When its base types (or an essence's item types) narrow the base, the guide
    says so. Example: "Arcane Surge on Crit is desecrated, so the gloves need energy shield".
  - `max_results` defaults to 20 and is capped at 30 (D-225).
- `mcp__pob2__check_model_coverage` (C-38): per line of an item, a node or a gem, whether PoB applies it.
- `mcp__pob2__search_tree_nodes` (C-43): nodes by text, or every node of an `ascendancy`.
- `mcp__pob2__list_gems`, `mcp__pob2__get_classes`.

**Legacy means not in the game** (D-395). A gem PoB marks legacy, or a unique PoB says is no longer obtainable,
is in no build: the lookups and `mcp__pob2__compile_plan` refuse them, and one you find some other way is
dropped, never kept as a risk. `Tier = 0` isn't legacy: granted skills have it too (Powered by Verisium).

## Reading `mcp__pob2__check_model_coverage`

| Status | Means | Do |
|---|---|---|
| fully parsed | PoB applies the line | PoB's numbers include it |
| **partly parsed** | PoB understood only part of the line and **applies none of it**; the remainder shows what it missed | treat the whole line as unmodelled: hand-calculate it in the ledger |
| unparsed | PoB ignores the line | hand-calculate it |
| parsed to nothing | read, but changes no stat | say so; hand-calculate if it matters |
| **possibly unread** | parsed, but a mod it makes is named nowhere in PoB's calculation code | **advisory** (D-243, D-226): confirm before hand-calculating (below) |
| possibly unmodelled; check config | a gem line PoB's own tooltip marks unsupported | the effect may live in a config option (D-123); look for it before hand-calculating |

**An unparsed `Grants Skill: <minion skill>` line isn't a gap** (D-379, PG-40): PoB computes that skill from the
minion's skill list either way, and never checks that the passive is allocated (V1's `not-granted` does, D-380).

**Flags** (WU-54; D-300, D-336). They're listed beside the statuses, in every mode, and change no status. Each
names something PoB doesn't model, so treat it as a hand calculation, or as Count:
- `mapped but unread`: a gem line's stat maps to a mod PoB reads nowhere, so the line may change nothing.
- `stat not mapped`: a support or meta gem's stats with no stat map and no tooltip line (one flag per gem).
- `energy not modelled`: an Energy meta gem. PoB doesn't model Energy; any trigger rate it shows isn't based on Energy.
- `level from support`: PoB computes the skill a support grants at the support gem's level (a skill with a global effect
  only when it is enabled in the skill's options).
- `granted skill undefined`: the gem grants a skill PoB has no data for, so PoB never computes it.
- `support colour tie`: a Gem Studded colour line. On a tie, PoB applies only one colour.

**Confirm a `possibly unread` line by measurement** (D-243). Add a temporary stage to `plan.json` (or to
the concept's skeleton) that copies the stage under test without that line, compile measure-only with
`stages` naming the two stages, and compare their outputs in the record. Remove the temporary stage before
the step ends; no second plan file goes in the run folder. If the numbers move, PoB reads the line: use its numbers. If they don't, the line is unmodelled: hand-calculate
it in the ledger: the guide says so in "What PoB can't show", and `audit.md`'s render lists it under "What PoB
doesn't model" (D-355). Only a coordinator step
compiles, so a researcher or verifier that meets such a line reports it for the coordinator instead of
guessing.

## Hand calculations

PoB numbers are used only where PoB models the mechanic (D-106). Otherwise the number is a ledger entry
(`{id, claim, formula, inputs}`, C-33) whose inputs carry their own tags, and the guide cites it as
`ledger:<id>`. Values that the grounding rates M or L are used as recorded, and a check that rests on
one says so (A-29).
