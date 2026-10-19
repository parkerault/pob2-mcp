# Brief: the Mobalytics review for the pattern library (2026-10-18)

**The user's direction.** "Use playwright to navigate the mobalytics builds home page and pick the ones you think
we currently have poor coverage on" (`https://mobalytics.gg/poe-2/builds`), using the Ascendancy filter and, where
the verified list is thin, the Creator and Community tabs. The coordinator picked the 16 below; the user approved
them ("The guides are fine"). The five optional guides were not taken. Picking other sources still needs the user.

**Why.** WU-90's standard kits are thin for want of common-practice sources (amendment 8, D-403, D-409): the
studies so far are mostly off-meta builds. These guides are popular builds in the archetypes the library covers
worst.

| # | Gap | Guide | URL | Tab | Fav. | Patch |
|---|---|---|---|---|---|---|
| 1 | Minions | Mattjestic, Fastest Minions Leveling & Mapping Pure Summoner | https://mobalytics.gg/poe-2/builds/god-slayer-minions-mattjestic | Creator | 1.6K | 0.5 |
| 2 | Minions | thyworm, Detailed SSF Minion Infernalist | https://mobalytics.gg/poe-2/builds/thyworm-infernalist-leveling | Creator | 1.2K | 0.5.5 |
| 3 | Tamed beast | CaptainLance9, Spirit Walker Beast Master | https://mobalytics.gg/poe-2/builds/spirit-walker-beast-master | Verified | 3.9K | 0.5 |
| 4 | Shapeshifting, talismans | Ronarray, Shaman Bear Druid | https://mobalytics.gg/poe-2/builds/bear-druid-build-league-starter-to-endgame | Verified | 8.4K | 0.5 |
| 5 | Shapeshifting | Woolie, Wolfman (Oracle) | https://mobalytics.gg/poe-2/builds/woolie-wolfman | Verified | 4.7K | 0.5.5 |
| 6 | Plants | Raxxanterax, Plant Oracle Druid Endgame | https://mobalytics.gg/poe-2/builds/plant-druid-oracle-endgame-guide | Verified | 3.2K | 0.5.5 |
| 7 | Lich; chaos damage over time | DEADRABB1T, ED Contagion Lich | https://mobalytics.gg/poe-2/builds/chaos-dot-lich-starter-deadrabbit | Verified | 6.7K | 0.5.5 |
| 8 | Poison | Path of Evening, Poison Pathfinder (leveling and endgame pages) | https://mobalytics.gg/poe-2/builds/poisonburst-arrow-pathfinder-leveling and https://mobalytics.gg/poe-2/builds/poison-burst-arrow-pathfinder | Creator | 821 | 0.5.5 |
| 9 | Shields, block | LexD, Shield Wall + Avatar of Fire Smith of Kitava | https://mobalytics.gg/poe-2/builds/avatar-of-fire-smith-of-kitava-lexd | Creator | 787 | 0.5.5 |
| 10 | Totems | Ky, 1-Button Arc Totems Gemling | https://mobalytics.gg/poe-2/builds/arc-gemling-path-of-ky | Verified | 1.7K | 0.5.5 |
| 11 | Ballistas | Lazy Exile, 1-Button Ballista Totem Cluster Grenade | https://mobalytics.gg/poe-2/builds/1-button-ballista-totem-cluster-grenade-lazy-exile | Verified | 454 | 0.5.5 |
| 12 | Crossbows, grenades | DEADRABB1T, Grenades Gemling League Starter | https://mobalytics.gg/poe-2/builds/deadrabbit-grenades-gemling-league-starter | Verified | 1.6K | 0.5.5 |
| 13 | Crossbows | Woolie, Run n Gun Witchhunter | https://mobalytics.gg/poe-2/builds/woolie-run-n-gun-witch-hunter | Verified | 4.7K | 0.5.5 |
| 14 | Spears; Amazon | Lazy Exile, Lightning Spear Amazon | https://mobalytics.gg/poe-2/builds/lazyexile-amazon-league-starter | Verified | 3.2K | 0.5 |
| 15 | Spears; Ritualist | MisoxShiru, Glacial Lance Ritualist | https://mobalytics.gg/poe-2/builds/misoxshiru-glacial-lance-ritualist | Verified | 792 | 0.5.5 |
| 16 | Invoker; cast on critical | Ronarray, Storm Wave + Flicker Invoker | https://mobalytics.gg/poe-2/builds/coc-balls-invoker-ronarray | Verified | 11.6K | 0.5 |

Not found: a spectre guide with real use (the only one had 2 favourites). Already studied: Fubgun's Lightning Arrow,
ronarray's Martial Artist, Navira's Fracturing.

**How it runs** (after M-20 merges, or alongside it):
1. The coordinator saves each guide page's text through Playwright, one page at a time, to a folder outside the
   repository (the pages are copyrighted; nothing of them is committed).
2. Study agents (no tests, no network) read the saved text and write one study each under
   `docs/build-guide/studies/`, in the existing studies' format, paraphrased: the archetype's kit, levers, leveling,
   gear, defences, and what the guide says players pick.
3. The coordinator proposes library changes (the kits first) from the studies; the user approves them (C-53).

**Cost:** about 150–200K tokens per guide, 2.5–3.5M in all.
