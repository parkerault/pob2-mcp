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
Virtuous Barrier at the grant's level 1 with Precision I and Clarity I, two supports that take a persistent buff. A
normal Stoic Sceptre (its base implicit "Grants Skill: Level (1-20) Discipline", written at level 10) is in Weapon 1,
and its granted group (`source="Item:1:Stoic Sceptre"`) holds Discipline with Precision II and Clarity II.

| | |
|---|---|
| Effect | On PoB2 `v0.23.1`, the load keeps only Virtuous Barrier and Discipline in the granted groups, and `load_build_xml`'s `droppedSupports` names the four supports, one entry per group (`tests/integration/grantedGroupSupports.test.ts`). |
| Re-check | On a PoB pin bump: whether PoB still rebuilds granted groups (`Modules/CalcSetup.lua`, the granted-skill loop). |

## `runic-ward-gloves.xml` (an item PoB's save changes, D-399)

Written by hand from the game data, not from any player's build: a level-60 Mercenary with no passives, wearing
rare Runeforged Gold Gloves (the base's Energy Shield 33 and Ward 52, the Ward line written "Runic Ward: 52" as
the game names it) with a Greater Storm Rune in their one socket, and one socketed Flash Grenade group with Heft.

| | |
|---|---|
| Effect | PoB2 `v0.23.1` reads only "Ward:", so the item's text doesn't read back the same: before D-399, every export (`ItemsTab:Save`'s `BuildAndParseRaw`) gave the gloves one more socket and one more rune (`tests/integration/snapshotItemText.test.ts`). |
| Re-check | On a PoB pin bump: whether PoB reads "Runic Ward:" (`Classes/Item.lua`, `ParseRaw`). |

## `pg109-rune-wand.xml` and `pg109-pob-copies.xml` (rolls on an item with a rune, PG-109, D-511)

Written by hand from the game data and the open-spell plan's items (`tests/fixtures/plans/open-spell/r1-s-4/plan.json`),
not from any player's build: a level-90 Witch with no passives and one Spark group, holding the corrupted Liminal Coil
(`Data/Uniques/wand.lua`) with Hedgewitch Assandra's Rune of Wisdom, whose two wand lines are the item's two rune lines
(`Data/ModRunes.lua`), and the Veilpiercer ring, with no rune. `pg109-rune-wand.xml` writes both items' rolls as
`{range:}` tags, as a plan does, and holds no `<ModRange>`. `pg109-pob-copies.xml` holds the wand as PoB2 `v0.23.1`'s
own save writes it (the text with its tags and eight `<ModRange>` copies, numbered across the rune lines) and the ring
as an older PoB writes one: its text with bare ranges, its rolls (1, 0.25, 0.9, 0.75) only in `<ModRange>`.

| | |
|---|---|
| Effect | On PoB2 `v0.23.1` unpatched, one save and load moves the wand's rolls: 9% Cast Speed reads 13% and the per-curse gains 29% read 27%. With the bridge's PG-109 patch, the rolls stay (`tests/integration/pg109.test.ts`). |
| Re-check | On a PoB pin bump: whether PoB's load still skips the rune lines (`Classes/ItemsTab.lua`, `ItemsTabClass:Load`); the retirement test says so. |

## `imported-character.xml`, its code `imported-character.code.txt`, and `imported-ninja.xml` (the file reader, D-517)

Written by hand from the game data (the pin's `Data/Bases`, `Data/Gems.lua`, `Data/Skills`, `Data/ModRunes.lua`,
`Data/Uniques` and the 0_5 passive tree), not from any player's build, with no character hash and no account name
(amendment 16 §20). `tests/unit/planFromBuildReader.test.ts` and `tests/mcp/planFromBuild.test.ts` read them through
`plan_from_build`.

`imported-character.xml` is in PoB2's own importer's shape: a level-90 Mercenary / Gemling Legionnaire with
`<Import lastRealm lastLeague exportParty>`, every group on, PoB's own granted groups saved after the plain ones, and
`useSecondWeaponSet="nil"`. It holds:

| Case | Where |
|---|---|
| Each granted skill twice (PG-108): a supported plain copy kept over an unsupported one (Spear Throw, granted by the Weapon 1 and Weapon 1 Swap spears: both sets); an unsupported copy at another level than PoB's group's, kept (Virtuous Barrier, 20 against the tree's 1); one at PoB's level, dropped (Lightning Bolt, from Choir of the Storm); a granted group with a support added in desktop PoB kept over an unsupported copy (Parry, from the buckler in Weapon 2) | file groups 1–6, 14–19 |
| A quality 20 Shrine Sceptre in Weapon 2 Swap, its Purity of Ice copy planted at quality 5 (PG-114) | item 4, group 4 |
| Every skill on, the Spirit buffs over the Spirit (PG-107) | Herald of Ice, Trinity, Wind Dancer, Combat Frenzy, Blasphemy, Virtuous Barrier |
| PoB's guessed main group, the one with the most gems, not the damage skill (PG-113) | `mainSocketGroup="11"` (Whirling Slash; Twister is group 7) |
| A group of two active skills, `mainActiveSkill="2"` | group 10 (Blasphemy, Despair) |
| `<ModRange range="0.5">` on plain lines; a line whose roll lives only in `<ModRange>` | items 1, 2 and 10 |
| A soul core on an item whose ranged lines carry `{range:}` tags, with PoB's misnumbered `<ModRange>` copies (PG-109) | item 8, the boots |
| An item on a base the pin lacks, and a gem the pin lacks (PG-110) | item 7 (Runemastered Plated Mitts), Glacial Bloom in group 8 |
| A base the pin defines more than once, with no `Implicits:` line (PG-111) | item 9 (Two-Stone Ring) |
| Crafted, fractured, desecrated and corrupted lines, an Exceptional base's extra socket, a Legacy soul core | item 5, the body armour |
| A gem corrupted +1 and one corrupted -1 | groups 7 and 13 |
| A legacy gem | Bloodlust in group 11 |
| A magic flask and charm, a filled charm slot, a filled `Arm` slot, a tree jewel, attribute choices, weapon-set tags | items 12–15, the spec |
| Custom modifiers, an enemy setting and a filled party tab, for the measure's callouts | the config set, `<Party>` |
| A second loadout | spec, item, skill and config sets titled "Leveling" |

`imported-character.code.txt` is the fixture as a PoB2 import code (`encodePobCode`), decoding to it byte for byte.

`imported-ninja.xml` is small, in poe.ninja's export's shape: a level-75 Witch / Lich, `<Import exportParty>` only (no
league), a spec with no title, its main group set by the export (Essence Drain, group 1), saved on weapon set 2
(`useSecondWeaponSet="true"`), Mana Drain granted by both wands, and a wand line whose roll lives only in `<ModRange>`.

| | |
|---|---|
| Re-check | On a PoB pin bump: whether the bases, gems and nodes they name are still in the pin (the reader names any it lacks). |

## `pricing-character.xml` (the pricing piece's runs, D-520)

Written by hand from the pin's game data for `/pob2:pricing`'s fixture runs (WU-163,
`tests/integration/pricingRun.test.ts`); no player's build, no character hash and no account name. A level-75 Witch /
Lich (the endgame, choice A) in `imported-ninja.xml`'s shape, its `<Import lastLeague>` Forbidden Rites (the league
price.md takes when trade lists it), one skill group (Essence Drain) and three items, each owned once read:

| What | Item |
|---|---|
| An owned rare of three explicit lines, priced by its spec (life 60, cold 35, fire 28: Stout's T6, the Polar Bear's T3, the Furnace's T4 on a helmet at item level 82, `Data/ModItem.lua`) | item 1, a Soldier Greathelm |
| An owned rare with a rune in its one socket, priced apart from poe.ninja's exchange | item 2, Lizardscale Boots with a Greater Iron Rune |
| An owned unique, priced by name | item 3, Choir of the Storm |

| | |
|---|---|
| Re-check | On a PoB pin bump: whether the bases, the unique, the rune, the gems and the nodes are still in the pin, and the tiers. |
