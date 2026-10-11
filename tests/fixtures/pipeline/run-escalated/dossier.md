# Dossier: open, a melee tank

## Roll and mode

The brief: a melee tank (playstyle melee, tanky) on a budget. An offline run: no web source and no price was consulted.

- Brainstorm round 1: no note; a short round, 5 of 9 cards dealt.
- Verification round 1: r1-a-1, r1-c-1.

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
- Skeleton: concepts/r1-a-1/plan.json, compiled, no errors; record concepts/r1-a-1/compile-record.json; TotalDPS 50,000.

### r1-c-1: Melting Maelstrom nova

- Skeleton: none.
- Compile: not compiled: its damage source isn't a skill.
- Record: none.
- Key numbers: none (not compiled).
- Status: can't be finalized yet: its damage source isn't a skill.

## Not carried

None: the round proposed two concepts.

[^d1]: pob-data | lookup_game_data gem "Blood Hunt" | patch: 0.5.4
[^d2]: judgment | Rolling Slam's area against Blood Hunt's single lunge | confidence: M
[^d3]: pob-data | check_model_coverage gem "Blood Hunt" | patch: 0.5.4
[^d4]: price | r1-a-1-weapon
