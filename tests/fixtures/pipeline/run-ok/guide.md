# Titan / Blood Hunt

## Versions, prices and import code

Engine data: PoB2 v0.23.1 (game 0.5.4). Prices and boss data: 0.5.5. Date: 2026-10-08. League: none. Mode: offline: prices are unavailable and no external source was consulted. PoB file: titan-blood-hunt-2026-10-08-1.xml. Each stage is a loadout, and the file is in auto-level mode.

```
eNrtWV1v2zYUfc-vIPS-FixtureImportCode-0001
```

## Summary

Blood Hunt bursts rares while Rolling Slam clears.[^g1] The dossier keeps the alternatives.

## How it works

Blood Hunt consumes Blood Loss.[^g2] Ledger: ttk_arbiter, about 160 s, the Arbiter's life over Blood Hunt's damage.[^g7]

## Leveling

### Act 1 (L8) {1}

Levels 1 to 8. Blood Hunt as soon as it drops.[^g3]

### Act 2 (L30) {2}

Levels 9 to 30. Rolling Slam joins for packs.[^g4]

## Campaign rewards

Take the cold resistance at Beira.[^g3]

## Endgame: budget variant

Gear by slot and a tree jewel, gems at level 20, 8 ascendancy points.[^g8]

### Checks

- Fire, cold and lightning resistances are capped at the Endgame −60% penalty.[^g5]
- Chaos resistance stays at 28% (47% under its cap) because no slot can carry chaos resistance without dropping a core item or breaking the budget.
- Budget: prices are unavailable in this offline run, so the variant can't be claimed to be under 20 divines.[^g6]
- Max hit taken against the waystone-scaled T15 hits (the top of each waystone damage modifier's range): physical 5100 against 402.[^g11]
- The Arbiter of Divinity takes about 160 seconds to kill.[^g7]

## Endgame: non-budget variant

The same, with more damage.[^g9]

### Checks

- All four resistances are capped.[^g5]
- Max hit taken against the waystone-scaled area-82 hits: physical 7400 against 438.55.[^g12]
- Total against the ~200-divine reference: unavailable offline.

## Rotation

Rolling Slam clears; Blood Hunt bursts.

## Defences and resistances

Resistances climb through the campaign penalties to −60%.[^g4]

## FAQ and common mistakes

Don't skip the Act 1 cold resistance.

## Confidence and what PoB can't model

Blood Loss uptime is a hand calculation.[^g10]

## Changelog

- 2026-10-08: first version.

## Sources

[^g1]: judgment | Rolling Slam's area against Blood Hunt's single lunge | confidence: M
[^g2]: pob-data | lookup_game_data gem "Blood Hunt" | patch: 0.5.4
[^g3]: pob-data | Data/QuestRewards.lua:7 | patch: 0.5.4
[^g4]: data | campaign/limits.json#resistance-penalty.act2
[^g5]: pob-computed | b.MissingFireResist
[^g6]: price | b-helmet
[^g7]: ledger | ttk_arbiter
[^g8]: pob-data | lookup_game_data gem "Bloodlust" | patch: 0.5.4
[^g9]: external-unavailable | external source unavailable (offline run) | confidence: L
[^g10]: judgment | PoB has no Blood Loss stack option | confidence: L
[^g11]: ledger | hit_b_physical
[^g12]: ledger | hit_n_physical
