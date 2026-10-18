# Build fixtures

## `grenadator.xml` (the golden build)

The user's own level-90 Mercenary / Gemling Legionnaire build: weapon swap, charms, 12 skill groups.
It is the golden build for the engine invariants (spec AC IDs tagged I-1).

| | |
|---|---|
| Source | `/mnt/c/Users/parke/Documents/Path of Building (PoE2)/Builds/Grenadator.xml` (last saved by the user's PoB2 app on 2026-09-28) |
| Source sha1 | `fa69cdc8674e60c0c94216c4a81983e544a01125`, the same file spike S-2 verified |
| Committed | 2026-10-03 |
| Change from source | `<Import lastCharacterHash>` blanked, because it is derived from the character name. It plays no part in calculations. |
| Fixture sha1 | `e0c16f36270d98cb8fc288c1b935e1e8787f99ab` |
| Recorded values | its 109 `<PlayerStat>` elements, as saved by the user's app |
| Verified | On PoB2 `v0.23.1`, loading then saving reproduces all 109 `(stat, value)` pairs exactly, before (S-2) and after the blanking (re-checked 2026-10-03). |

The source file is the user's live build and may change. Never re-copy it without re-running that check
and updating this table. On a PoB pin bump, the recorded values are re-recorded from the new pin (see
`docs/stabilization/spikes/S-2-pin-v0.23.1.md`, "Upgrade procedure").

## `grenadator-low-str.xml` (unmet Strength requirement, AC-A1)

A copy of `grenadator.xml` with one edit, so that PoB's own warning "You do not meet the Strength
requirement of …" fires (spec AC-A1, "Str case").

| | |
|---|---|
| Edit | Ring 1, the rare "Gale Eye" Prismatic Ring (`<Item id="8">`): its mod line `+17 to Strength` becomes `+7 to Strength`. Nothing else changes. |
| Effect | Strength drops from 119 to 109. |
| Requirement it breaks | The Herald of Ash gem's Strength requirement, 116 (the build's highest, `ReqStr`; the golden build meets it with 119). On PoB2 `v0.23.1`, `get_warnings` returns `You do not meet the Strength requirement of Herald of Ash`. |
| Fixture sha1 | `37394f542982c7ee5b1b8e693ac54aee5d00a447` |

Regenerate it from the golden build if that ever changes (the same one-line edit), and re-check the
requirement on a PoB pin bump.

## `granted-supports.xml` (supports in a granted group, D-398)

Written by hand from the game data, not from any player's build: a level-60 Mercenary / Gemling Legionnaire
with node 34882 and Essence of Virtue (node 11641, "Grants Skill: Virtuous Barrier"). Its skill set has a
socketed Flash Grenade group with Heft, and Essence of Virtue's granted group (`source="Tree:11641"`) holding
Virtuous Barrier at the grant's level 1 with Precision I and Clarity I, two supports that take a persistent buff.

| | |
|---|---|
| Effect | On PoB2 `v0.23.1`, the load keeps only Virtuous Barrier in the granted group, and `load_build_xml`'s `droppedSupports` names Precision I and Clarity I (`tests/integration/grantedGroupSupports.test.ts`). |
| Re-check | On a PoB pin bump: whether PoB still rebuilds granted groups (`Modules/CalcSetup.lua`, the granted-skill loop). |

## `runic-ward-gloves.xml` (an item PoB's save changes, D-399)

Written by hand from the game data, not from any player's build: a level-60 Mercenary with no passives, wearing
rare Runeforged Gold Gloves (the base's Energy Shield 33 and Ward 52, the Ward line written "Runic Ward: 52" as
the game names it) with a Greater Storm Rune in their one socket, and one socketed Flash Grenade group with Heft.

| | |
|---|---|
| Effect | PoB2 `v0.23.1` reads only "Ward:", so the item's text doesn't read back the same: before D-399, every export (`ItemsTab:Save`'s `BuildAndParseRaw`) gave the gloves one more socket and one more rune (`tests/integration/snapshotItemText.test.ts`). |
| Re-check | On a PoB pin bump: whether PoB reads "Runic Ward:" (`Classes/Item.lua`, `ParseRaw`). |
