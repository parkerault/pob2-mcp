# Dossier: Titan, open

## Roll and mode

Titan (Warrior) with Blood Hunt, an online run.

## Mechanics

Blood Hunt consumes Blood Loss on its target for extra damage.[^d1]

## Synergy search

Rolling Slam clears packs; Blood Hunt takes rares.[^d2]

## Config gaps

Blood Loss stacks have no PoB config option; the ledger estimates them.[^d3]

## Concepts

### r1-a-1: Blood Hunt bleed burst

- Key uniques: none.
- Ascendancy nodes: Titan's slam notables.
- Supports: Bloodlust, Brutality I.
- Keystones: none.
- Feasibility read: compiles; key weapon priced.[^d4]
- Risks: low chaos resistance.
- What PoB can't verify: Blood Loss uptime.
- Skeleton: concepts/r1-a-1/plan.json, compiled, no errors; record concepts/r1-a-1/compile-record.json; TotalDPS 50,000.

### r1-c-2: Blood Hunt with Titan slam notables

- Key uniques: none.
- Ascendancy nodes: Titan's slam notables.
- Supports: Brutality I.
- Keystones: none.
- Feasibility read: compiles.
- Risks: the clear skill isn't the named damage source.
- What PoB can't verify: Blood Loss uptime.
- Skeleton: concepts/r1-c-2/plan.json, compiled, no errors; record concepts/r1-c-2/compile-record.json; TotalDPS 50,000.

### r1-b-3: Blood Hunt with a bleed unique

- Proposed in: cards/r1-b-3.md (verification round 2).
- Skeleton: concepts/r1-b-3/plan.json, compiled, no errors; record concepts/r1-b-3/compile-record.json; TotalDPS 50,000; TotalEHP 31,500.
- Status: viable.

## Not carried

None: the round proposed two concepts.

[^d1]: pob-data | lookup_game_data gem "Blood Hunt" | patch: 0.5.4
[^d2]: judgment | Rolling Slam's area against Blood Hunt's single lunge | confidence: M
[^d3]: pob-data | check_model_coverage gem "Blood Hunt" | patch: 0.5.4
[^d4]: price | r1-a-1-weapon
