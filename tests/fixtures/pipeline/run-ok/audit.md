# Audit: Titan / Blood Hunt, Blood Hunt bleed burst

## Hand calculations

| Entry | Claim | Value | Formula, in words |
|---|---|---|---|
| `ttk_arbiter` | The Arbiter of Divinity takes about N seconds of single-target damage. | 160 | the Arbiter's extrapolated life over the budget variant's Blood Hunt DPS |
| `hit_m_physical` | Stage m's waystone-scaled physical reference hit at area 69 | 298.10 | the area-69 monster damage × (1 + 24 / 100) |
| `hit_m_fire` | Stage m's waystone-scaled fire reference hit at area 69 | 71.54 | the physical hit × 24 / 100 |
| `hit_b_physical` | Stage b's waystone-scaled physical reference hit at area 79 | 402.00 | the area-79 monster damage × (1 + 24 / 100) |
| `hit_b_fire` | Stage b's waystone-scaled fire reference hit at area 79 | 96.48 | the physical hit × 24 / 100 |
| `hit_n_physical` | Stage n's waystone-scaled physical reference hit at area 82 | 438.55 | the area-82 monster damage × (1 + 24 / 100) |
| `hit_n_fire` | Stage n's waystone-scaled fire reference hit at area 82 | 105.25 | the physical hit × 24 / 100 |

## Stage detail

| Loadout | Life | Blood Hunt DPS | Fire / cold / lightning / chaos | Effective HP |
|---|---|---|---|---|
| Act 1 (L8) {1} | 310 | — | 55/55/55/0% | 1,900 |
| Act 2 (L30) {2} | 900 | 1,900 | 60/60/60/0% | 6,200 |
| Entering maps (L65) {m} | 2,600 | 9,000 | 75/75/75/10% | 18,400 |
| Endgame budget (L90) {b} | 4,200 | 50,000 | 75/75/75/28% | 31,500 |
| Endgame non-budget (L95) {n} | 5,600 | 140,000 | 75/75/75/75% | 52,300 |

## What PoB doesn't model

- Blood Loss stacks: no config option; the Blood Hunt figure assumes every lunge consumes them.

## Inputs by confidence

- M: the waystone modifiers' tops (24% increased damage, 24% extra as an element).
- L: the Arbiter's extrapolated fight life.
- Needs an external source (external source unavailable in this offline run): what a campaign usually leaves a player; spear builds on a budget.

## Run notes

- Why this concept: the test config picked it at the verification gate by the rule `first-viable`.
- The D1 gate's budget totals: unavailable for `m` and `b` (offline run); no rates were fetched.

## Known issues

| Id | Lens or gate | Stage | Sentence in the guide |
|---|---|---|---|
| v4-prose-1 | prose | — | The How to play it section is wrong to call Rolling Slam your clear skill: Blood Hunt does the clearing damage, so lead packs with Blood Hunt. |
