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
