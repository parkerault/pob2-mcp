# Dossier: Titan / Blood Hunt (a fixed roll)

## Roll and mode

The brief: Titan with Blood Hunt, a fixed roll. An offline run: no web source and no price was consulted.

- Brainstorm round 1: no note.
- Verification round 1: r1-a-1, r1-a-2.

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
- Feasibility read: compiles; prices unavailable (offline run).[^d4]
- Risks: low chaos resistance.
- What PoB can't verify: Blood Loss uptime.
- Skeleton: concepts/r1-a-1/plan.json, compiled, no errors; record concepts/r1-a-1/compile-record.json; TotalDPS 50,000; TotalEHP 31,500.
- Status: viable.

### r1-a-2: Blood Hunt with Rolling Slam clear

- Key uniques: none.
- Ascendancy nodes: Titan's slam notables.
- Supports: Brutality I.
- Keystones: none.
- Feasibility read: compiles.
- Risks: the clear skill isn't the named damage source.
- What PoB can't verify: Blood Loss uptime.
- Skeleton: concepts/r1-a-2/plan.json, compiled, no errors; record concepts/r1-a-2/compile-record.json; TotalDPS 50,000; TotalEHP 31,500.
- Status: viable.

## Not carried

- r1-b-1 "Blood Hunt on a two-hander": dealt in cards.md, not verified yet.
- r1-b-3 "Blood Hunt armour stacker": dealt in cards.md, not verified yet.
- r1-c-1 "Blood Hunt with Titan slam notables": dealt in cards.md, not verified yet.
- r1-c-2 "Blood Hunt block tank": dealt in cards.md, not verified yet.
- r1-c-3 "Blood Hunt rage cycling": dealt in cards.md, not verified yet.

[^d1]: pob-data | lookup_game_data gem "Blood Hunt" | patch: 0.5.4
[^d2]: judgment | Rolling Slam's area against Blood Hunt's single lunge | confidence: M
[^d3]: pob-data | check_model_coverage gem "Blood Hunt" | patch: 0.5.4
[^d4]: price | r1-a-1-weapon
