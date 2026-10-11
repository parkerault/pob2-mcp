# Audit: Titan / Blood Hunt, Blood Hunt bleed burst

## Hand calculations

| Entry | Claim | Value | Formula, in words |
|---|---|---|---|
| `ttk_arbiter` | The Arbiter of Divinity takes about N seconds of single-target damage. | 160 | the Arbiter's extrapolated life over the budget variant's Blood Hunt DPS |
| `hit_m_physical` | Stage m's waystone-scaled physical reference hit at area 69 | 298.10 | the area-69 monster damage × (1 + 24 / 100) |
| `hit_b_physical` | Stage b's waystone-scaled physical reference hit at area 79 | 402.00 | the area-79 monster damage × (1 + 24 / 100) |
| `hit_n_physical` | Stage n's waystone-scaled physical reference hit at area 82 | 438.55 | the area-82 monster damage × (1 + 24 / 100) |

## Stage detail

| Loadout | Life | Blood Hunt DPS | Fire / cold / lightning / chaos |
|---|---|---|---|
| Entering maps (L65) {m} | 2,600 | 9,000 | 75/75/75/10% |
| Endgame budget (L90) {b} | 4,200 | 50,000 | 75/75/75/75% |
| Endgame non-budget (L95) {n} | 5,600 | 140,000 | 75/75/75/75% |

## What PoB doesn't model

- Blood Loss stacks: no config option; the Blood Hunt figure assumes every lunge consumes them.

## Inputs by confidence

- M: the waystone modifiers' tops; what a campaign usually leaves a player.
- L: the Arbiter's extrapolated fight life.

## Run notes

- Why this concept: the user finalized it at the verification gate.
- The D1 gate's budget totals: `m` 4.4 divines, `b` 21.5 divines (near the ceiling); `n` 172 against the 200-divine reference. Rates: an exalted 0.01 divines, a chaos 0.05.

## Known issues

None.
