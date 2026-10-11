# Lookups and what PoB can't model

How the steps that may call lookups (the R1a researchers, the V4 verifiers and the coordinator) use the
game-data tools, and how to treat what PoB doesn't model (R-22: PoB ignores a line on about 13% of
unique mods, 30% of keystones and 32% of ascendancy notables, so hand calculations are routine).

## The lookup set L (server `pob2`; all kind `read`, they never change the build)

- `mcp__pob2__lookup_game_data` (C-37):
  - `{mode: "gem", query}`: each gem's kind (`active` or `support`), description, weapon, every stat set
    ("skill part") with its **base attack damage and base critical hit chance** (D-241) and PoB's tooltip
    lines at `gem_level` and `gem_quality`, the quality lines, the requirements at every gem level
    (D-228), and for a support what it can and can't support.
  - `{mode: "unique", query, slot?}`: with **several matches, each is shown in brief** (name, type,
    base, up to 5 matched lines with their variant); **full item text, ready for a plan's item slot, comes
    only when exactly one unique is returned** (D-239). Look a unique up by its exact name (or with
    `max_results: 1`) to get its text.
  - `{mode: "mechanic", query, kind?}`: keyword hits across gems, uniques, passives (ascendancy included),
    item mods and essences. **`kind` (`gem`, `unique`, `passive`, `mod` or `essence`) lists one kind
    only**; the header still counts every kind's hits (D-240). Use it when a broad query fills every slot
    with one kind.
  - **A mod hit's base types** (D-277). Under each `[mod]` hit, `Base types:` lists the bases that can
    roll that mod (PoB gives it a non-zero spawn weight), as PoB's own base types, separated by `;`:
    - `Gloves (all)`: every base of that item type;
    - `Gloves: Energy Shield`: every base of one of PoB's base types (item type, then defence);
    - `Staff (8 of 14 bases: …)`: only the named bases of that base type;
    - `none (no base has a spawn weight for it)`: the mod never rolls on an item. It comes from a unique,
      an essence or another source.

    A rune's mod has no line. Desecrated mods (table `Desecrated`) are often limited to a defence type.
  - **Essences** (D-277). An `[essence]` hit names the essence, the item types it applies that mod to,
    and whether the mod is a prefix or a suffix. Example: `[essence] Greater Essence of Haste (Bow,
    Crossbow; Suffix): (14-16)% increased Attack Speed`. A hit matches on the mod line or on the
    essence's name, so `{query: "Essence of Haste", kind: "essence"}` lists every tier.
  - **Sourcing an affix's limit on its base** (D1, amendment 2): look the affix up with `kind: "mod"`
    and `kind: "essence"`. When its base types (or an essence's item types) narrow the base, the guide
    says so. Example: "Arcane Surge on Crit is desecrated, so the gloves need energy shield".
  - `max_results` defaults to 20 and is capped at 30 (D-225).
- `mcp__pob2__check_model_coverage` (C-38): per line of an item, a node or a gem, whether PoB applies it.
- `mcp__pob2__search_tree_nodes` (C-43): nodes by text, or every node of an `ascendancy`.
- `mcp__pob2__list_gems`, `mcp__pob2__get_classes`.

## Reading `mcp__pob2__check_model_coverage`

| Status | Means | Do |
|---|---|---|
| fully parsed | PoB applies the line | PoB's numbers include it |
| **partly parsed** | PoB understood only part of the line and **applies none of it**; the remainder shows what it missed | treat the whole line as unmodelled: hand-calculate it in the ledger |
| unparsed | PoB ignores the line | hand-calculate it |
| parsed to nothing | read, but changes no stat | say so; hand-calculate if it matters |
| **possibly unread** | parsed, but a mod it makes is named nowhere in PoB's calculation code | **advisory** (D-243, D-226): confirm before hand-calculating (below) |
| possibly unmodelled; check config | a gem line PoB's own tooltip marks unsupported | the effect may live in a config option (D-123); look for it before hand-calculating |

**Confirm a `possibly unread` line by measurement** (D-243). Add a temporary stage to `plan.json` (or to
the concept's skeleton) that copies the stage under test without that line, compile measure-only with
`stages` naming the two stages, and compare their outputs in the record. Remove the temporary stage before
the step ends; no second plan file goes in the run folder. If the numbers move, PoB reads the line: use its numbers. If they don't, the line is unmodelled: hand-calculate
it in the ledger and say so in the guide's "Confidence and what PoB can't model". Only a coordinator step
compiles, so a researcher or verifier that meets such a line reports it for the coordinator instead of
guessing.

## Hand calculations

PoB numbers are used only where PoB models the mechanic (D-106). Otherwise the number is a ledger entry
(`{id, claim, formula, inputs}`, C-33) whose inputs carry their own tags, and the guide cites it as
`ledger:<id>`. Values that the grounding rates M or L are used as recorded, and a check that rests on
one says so (A-29).
