# Audit: Titan / Blood Hunt, Blood Hunt bleed burst

## Estimates

| Entry | Claim | Value | Formula |
|---|---|---|---|
| `bleed_bonus` | The damage per second consuming Blood Loss adds to Blood Hunt on the budget variant, as a share of its DPS | 7500.00 | b.TotalDPS * share / 100 |

- **Count:** Blood Hunt on stage n counts 2 copies: fixture value: two copies act at once, so the D1 gate compares the figure × 2 (D-293, D-340).

## Stage detail

| Loadout | Level | Life | Named source DPS | Fire / cold / lightning / chaos | Max hit, physical / least of the others | Reference hit, physical / largest of the others | Effective HP |
|---|---|---|---|---|---|---|---|
| Act 1 (L8) {1} | 8 | 310 | 140 | 55/55/55/0% | — / — | — | 1900 |
| Act 2 (L30) {2} | 30 | 900 | 1900 | 60/60/60/0% | — / — | — | 6200 |
| Entering maps (L65) {m} | 65 | 2600 | 9000 | 75/75/75/10% | 2900 / 1900 | 299 / 72 | 18400 |
| Endgame budget (L90) {b} | 90 | 4200 | 50000 | 75/75/75/75% | 5100 / 3000 | 402 / 97 | 31500 |
| Endgame non-budget (L95) {n} | 95 | 5600 | 100000 | 75/75/75/75% | 7400 / 7000 | 439 / 106 | 52300 |

## Checks

### Entering maps (L65) {m}

- Chaos resistance stays at 10% because no slot within 5 divines can carry chaos resistance without dropping a resistance the floor needs.
- Budget: 4.4 divines against the 5-divine ceiling.
- Clear speed: slow, a rough estimate from Blood Hunt's area. Movement speed: not measured.

### Endgame budget (L90) {b}

- Budget: 21.9 divines against 20.
  21.9 divines is near the ceiling: over 20, within the 22-divine tolerance.
- The Arbiter of Divinity: survives its hits; its worst, physical hit, is 0.68 of your max hit.
- Clear speed: slow, a rough estimate from Blood Hunt's area. Movement speed: not measured.

### Endgame non-budget (L95) {n}

- Total: 172 divines against the ~200-divine reference, which is no cap.
- The Arbiter of Divinity: survives its hits; its worst, physical hit, is 0.47 of your max hit.
- Clear speed: slow, a rough estimate from Blood Hunt's area. Movement speed: not measured.

## What PoB doesn't model

None.

## Inputs by confidence

- **M:** `stages[2].variantBasis.level`: a character that has finished the campaign and runs T1 to T5 maps sits near level 65; `stages[2].variantBasis.gemLevels`: the campaign's uncut gems reach level 16 by its end; `stages[2].variantBasis.ascendancyPoints`: the campaign's trials grant six ascendancy points; stage m's chaos resistance exception: no slot within 5 divines can carry chaos resistance without dropping a resistance the floor needs; `m-budget` on stage m: Players usually finish the campaign with 5 to 10 divines; `m-boots` on stage m: Buy the boots first: they carry the only lightning resistance on the rung; `stages[3].variantBasis.level`: a budget character reaching T15 maps sits near level 90; `stages[3].variantBasis.gemLevels`: uncut gems of tier 20 are cheap by endgame; `stages[3].variantBasis.ascendancyPoints`: https://maxroll.gg/poe2/getting-started/trials-of-ascendancy; `b-meta` on stage b: Spear builds clear T15 maps on a budget this league; `stages[4].variantBasis.level`: a geared character pushing area 82 sits near level 95; `stages[4].variantBasis.gemLevels`: uncut gems of tier 20 are cheap by endgame; `stages[4].variantBasis.ascendancyPoints`: https://maxroll.gg/poe2/getting-started/trials-of-ascendancy.
- **L:** input `share` (15) of `bleed_bonus`: The damage per second consuming Blood Loss adds to Blood Hunt on the budget variant, as a share of its DPS.

## Known issues

None.
