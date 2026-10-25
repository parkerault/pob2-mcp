# Toughness targets from published league starters (2026-10-25)

**Why.** Amendment 11 shows a defence trade when a design's non-budget rung is too squishy (D-441). The user asked
for different targets for melee and ranged builds ("My gut is 8k-10k for ranged, 15k for melee"), set from published
builds rather than guessed: "Final draft waits on those studies."

**The builds.** The user listed Mobalytics' verified guides tagged as league starters (85 pages, 2026-10-25). A
private reference library outside this repo holds each guide's text, its PoB file and its video transcript; this
study cites guides by their page slug and gives only our own measurements. 38 pages had a PoB import code (36
decoded; two Paintmaster guides give a pobb.in user link the server's raw endpoint doesn't cover), 43 build pages had
none and 4 were general articles. **30 builds are level 90 or above** and enter the statistics; the 6 below are
levelling files, listed but left out.

**The measure.** Each PoB file was loaded read-only into a temporary builds folder and measured under the design's own
enemy for the non-budget rung, so the figures compare with a design gate's:
- the enemy isn't a boss (`enemyIsBoss: None`), the resistance penalty is −60, and the hits are area 82's reference
  hits, 439 physical and 106 each of fire, cold, lightning and chaos (the compiler's `referenceHits`, D-423);
- the enemy's level is the character's, at most 85, as in a compile (so only level-90+ builds compare cleanly);
- enemy-side settings a file sets (its level, crit, penetration, boss preset) are reset to PoB's defaults; the
  file's own buffs and conditions are kept, which a design wouldn't count unless its plan earns them;
- the Arbiter verdict is the design's own (`arbiterMeasure`): its largest hit of each type against the build's
  maximum hit taken of that type, "one-shot" at a ratio of 1 or more;
- the active tree, item set and skill set are what's measured.

**The archetype** is read from the main skill's PoB skill types, first match: minion, totem/trap/mine, `Melee`,
attack (ranged attack), spell (caster). Five files saved an aura, a meta gem, a cry or an on-kill explosion as their
main skill, so their archetype was set by hand from the guide's main gem group (marked `*`): Navira's Fracturing
Varashta (minion: Navira and Kelari), Ignatius's Spark Stormweaver (caster: Spark), Balrog fire bear Smith (melee:
Maul), DEADRABB1T's Plants Lich (caster: Entangle, Thrashing Vines), CaptainLance9's Beast Master (minion: the
Companion).

## Results

| Archetype | Builds (L90+) | Min | 25% | Median | 75% | Max | One-shot by the Arbiter |
|---|---|---|---|---|---|---|---|
| caster | 8 (7) | 4.6k | 15.5k | 19.1k | 22.6k | 95.9k | 1 of 7 |
| melee | 17 (13) | 17.3k | 23.3k | 31.3k | 43.4k | 52.0k | 0 of 13 |
| minion | 2 (2) | 12.9k | 13.8k | 14.7k | 15.6k | 16.5k | 1 of 2 |
| ranged attack | 9 (8) | 7.7k | 18.0k | 22.7k | 99.0k | 338.0k | 2 of 8 |

Grouped as the design will group them, melee (the main skill has PoB's `Melee` type) and ranged (everything else):

| Target | Melee under it (of 13) | Ranged under it (of 17) |
|---|---|---|
| 10,000 | 0 | 2 (4.6k, 7.7k; both one-shot) |
| 13,500 (90% of 15,000) | 0 | 3 (adds 12.9k; all three one-shot) |
| 15,000 | 0 | 4 (adds 14.2k) |
| 18,000 (90% of 20,000) | 1 (17.3k) | — |
| 20,000 | 2 (adds 19.6k) | 10 |

- Melee builds sit 5–10k above ranged ones at every point. No published melee build is under 17.3k, and the Arbiter
  one-shots none of them.
- Outside melee, the builds cluster from about 13k to 23k; the two outliers (Ignatius's Cast on Critical Comet
  Infernalist at 4.6k, Lazy Exile's Storm Lance Amazon at 7.7k) are one-shot by the Arbiter.
- Evasion and deflection builds read very high in PoB (the two Witchhunters over 300k), so medians and percentiles
  carry the comparison, not means.
- Armour builds read lower at non-budget than at budget: bigger hits get through more armour. Maximum hit taken
  doesn't depend on the configured hits, so the Arbiter verdict is the same on both rungs.
- For scale: the open-brief live test's two Reap Infernalists read about 6k (their own configs).

## The decision

The user (2026-10-25): "Melee 20k, ranged 15k would be a good target, but I think there should probably be a little
bit of wiggle room, maybe +/- 10%? That would get us in the range of "good" defenses and still allow some forgiveness
for builds that need it for DPS." Amendment 11 §9 (D-441): a non-budget rung under 90% of its target (18,000 melee,
13,500 ranged) gets a defence trade at the design gate; within the band is good.

## Caveats

- 30 builds, league starters only, mostly patch 0.5; two minion builds and no totem, trap or mine build.
- A file's own buffs are kept, so a design of the same build may read a little lower.
- Multi-tree files are measured on their saved active tree (the Trees column counts a file's trees).

## Every build

| Guide | Ascendancy | Lvl | Main skill | Archetype | EHP | Life / ES / Mana | Max hit phys / elem / chaos | Armour / Evasion (evade, deflect) / Block | Arbiter | Trees | Notes |
|---|---|---|---|---|---|---|---|---|---|---|---|
| fubgun-flameblast-oil-grenade | Gemling Legionnaire | 98 | Flameblast | caster | **95.9k** | 3.3k / 0 / 805 | 6.1k / 22.0k / 13.0k | 54.1k / 9.2k (47%, 0%) / 0% | survives physical 0.57 | 1 |  |
| plants-lich-deadrabb1t | Abyssal Lich | 96 | Entangle and Thrashing Vines* | caster | **24.8k** | 1.5k / 8.7k / 972 | 14.2k / 41.0k / 13.8k | 2.5k / 10 (0%, 0%) / 0% | survives physical 0.25 | 1 |  |
| skadoosh-decompose-pathfinder | Pathfinder | 93 | Decompose | caster | **20.4k** | 1 / 5.0k / 801 | 5.1k / 9.4k / – | 1.1k / 7.3k (49%, 27%) / 0% | survives physical 0.69 | 1 |  |
| ignatius-spark-stormweaver | Stormweaver | 96 | Spark* | caster | **19.1k** | 1.4k / 0 / 4.3k EB | 8.4k / 22.2k / 32.9k | 1.4k / 1.4k (12%, 0%) / 0% | survives physical 0.41 | 1 | Eldritch Battery allocated |
| arc-gemling-path-of-ky | Gemling Legionnaire | 98 | Arc | caster | **16.9k** | 1.6k / 0 / 6.6k MoM EB | 10.7k / 42.6k / 42.6k | 0 / 8 (0%, 0%) / 0% | survives physical 0.33 | 1 | Mind Over Matter allocated; Eldritch Battery allocated |
| grim-totem-oracle-imexile | Oracle | 97 | Grim Pillars | caster | **14.2k** | 1.5k / 0 / 5.4k EB | 9.0k / 35.9k / 35.9k | 0 / 10 (0%, 0%) / 0% | survives physical 0.39 | 5 | Eldritch Battery allocated |
| coc-spark-comet-recoup-infernalist-by-ignatius | Infernalist | 97 | Comet | caster | **4.6k** | 885 / 0 / 1.0k | 2.1k / 5.3k / 2.6k | 22.8k / 14 (0%, 0%) / 0% | ONE-SHOT physical 1.66 | 1 |  |
| hcssf-spark-oracle | Oracle | 54 | Spark | caster | **2.6k** | 1.1k / 0 / 625 | 1.3k / 1.3k / 1.1k | 2.4k / 7 (0%, 0%) / 31% | ONE-SHOT physical 2.71 | 4 | level 54 < 90: enemy level 54 follows character level |
| ronarray-unarmed-hollow-palm-monk | Martial Artist | 97 | Tempest Flurry | melee | **52.0k** | 1 / 6.2k / 715 | 6.2k / 11.3k / – | 0 / 24.5k (74%, 70%) / 0% | survives physical 0.56 | 1 |  |
| alkaizer-s-hc-martial-artist-monk-alkaizerx | Martial Artist | 98 | Quarterstaff Strike | melee | **48.6k** | 1 / 19.1k / 938 | 19.1k / 76.4k / – | 0 / 5.0k (33%, 7%) / 0% | survives physical 0.18 | 1 |  |
| alkaizer-s-ssfhc-melee-gemling-alkaizerx | Gemling Legionnaire | 93 | Perfect Strike | melee | **44.2k** | 4.1k / 17 / 612 | 7.2k / 21.3k / 12.8k | 36.3k / 90 (1%, 0%) / 0% | survives physical 0.49 | 1 |  |
| 0-3-league-start-the-hollowed-one-detailed-league-start-guid | Amazon | 93 | Falling Thunder | melee | **43.4k** | 1.4k / 3.0k / 647 | 4.5k / 12.1k / 11.4k | 0 / 31.5k (77%, 77%) / 0% | survives physical 0.77 | 1 |  |
| martial-artist-monk-build-league-starter-to-endgame | Martial Artist | 96 | Whirling Assault | melee | **37.6k** | 1 / 7.9k / 652 | 7.9k / 31.5k / – | 0 / 10.0k (58%, 43%) / 0% | survives physical 0.44 | 1 |  |
| balrog-fire-bear-smith | Smith of Kitava | 94 | Maul* | melee | **36.3k** | 3.2k / 818 / 0 | 7.4k / 20.0k / 8.8k | 4.3k / 7 (0%, 0%) / 0% | survives physical 0.47 | 1 |  |
| firebringer-league-start-woolie | Warbringer | 95 | Forge Hammer | melee | **31.3k** | 2.6k / 0 / 0 | 3.9k / 12.9k / 10.4k | 20.3k / 9 (0%, 0%) / 50% | survives physical 0.88 | 1 |  |
| meteor-bear-druid | Shaman | 59 | Pounce | melee | **28.6k** | 3.1k / 311 / 527 | 5.5k / 17.9k / 16.2k | 17.8k / 0 (0%, 0%) / 0% | survives physical 0.63 | 6 | level 59 < 90: enemy level 59 follows character level |
| facebreakers-hollow-palm-martial-artist-league-starter | Martial Artist | 97 | Flicker Strike | melee | **26.8k** | 1.6k / 6.2k / 1.1k | 8.3k / 33.2k / 6.1k | 0 / 10.8k (58%, 17%) / 0% | survives physical 0.42 | 10 |  |
| misoxshiru-glacial-lance-ritualist | Ritualist | 95 | Spear Stab | melee | **24.7k** | 2.1k / 675 / 728 | 5.4k / 12.6k / 4.8k | 789 / 16.2k (67%, 26%) / 0% | survives physical 0.64 | 7 |  |
| woolie-wolfman | Oracle | 96 | Shred | melee | **23.3k** | 1.9k / 2.6k / 0 MoM | 5.5k / 20.0k / 13.1k | 10.9k / 979 (9%, 0%) / 0% | survives physical 0.63 | 1 | Mind Over Matter allocated |
| bear-druid-build-league-starter-to-endgame | Shaman | 96 | Maul | melee | **22.2k** | 2.9k / 143 / 867 | 4.6k / 16.4k / 8.0k | 23.8k / 156 (2%, 0%) / 0% | survives physical 0.76 | 1 |  |
| martial-artist-league-starter-scorpius | Martial Artist | 93 | Whirling Assault | melee | **19.6k** | 1.4k / 4.9k / 881 | 6.2k / 18.9k / 5.8k | 0 / 11.4k (52%, 35%) / 0% | survives physical 0.56 | 1 |  |
| coc-balls-invoker-ronarray | Invoker | 96 | Flicker Strike | melee | **17.3k** | 1 / 8.4k / 1.1k | 8.4k / 31.2k / – | 0 / 2.5k (20%, 0%) / 0% | survives physical 0.41 | 1 |  |
| martialbreaker-monk-leaguestarter | Martial Artist | 86 | Hollow Form | melee | **3.5k** | 1.6k / 78 / 1.0k | 2.7k / 4.2k / 3.6k | 247 / 13 (0%, 0%) / 0% | ONE-SHOT physical 1.29 | 1 | level 86 < 90: enemy level 85 follows character level |
| hollow-assault-beyblade | Martial Artist | 66 | Whirling Assault | melee | **827** | 979 / 0 / 437 | 979 / 675 / 979 | 0 / 8 (0%, 0%) / 0% | ONE-SHOT lightning 5.88 | 7 | level 66 < 90: enemy level 66 follows character level |
| warrior-leveling-woolie | None | 18 | Earthquake | melee | **351** | 380 / 47 / 181 | 435 / 301 / 404 | 86 / 7 (1%, 0%) / 0% | ONE-SHOT lightning 13.19 | 4 | level 18 < 90: enemy level 18 follows character level |
| naviras-fracturing-varashta-league-starter | Disciple of Varashta | 97 | Navira and Kelari with Muster and Bidding* | minion | **16.5k** | 1 / 8.7k / 1.1k | 9.7k / 39.0k / – | 0 / 349 (3%, 0%) / 0% | survives physical 0.36 | 8 |  |
| spirit-walker-beast-master | Spirit Walker | 92 | the Companion* | minion | **12.9k** | 1.5k / 523 / 813 | 2.2k / 2.7k / 2.4k | 1.3k / 21.9k (66%, 67%) / 0% | ONE-SHOT physical 1.55 | 6 |  |
| woolie-run-n-gun-witch-hunter | Witchhunter | 99 | Stormblast Bolts | ranged attack | **338.0k** | 2.0k / 10.4k / 698 | 25.6k / 97.7k / 76.9k | 1.8k / 38.3k (80%, 68%) / 0% | survives physical 0.14 | 1 |  |
| explosive-witchhunter | Witchhunter | 97 | Explosive Grenade | ranged attack | **309.1k** | 1.7k / 12.2k / 563 | 23.8k / 94.5k / 70.0k | 1.8k / 29.4k (76%, 95%) / 0% | survives physical 0.15 | 3 |  |
| ruetoo-tactician-mirage | Tactician | 100 | Galvanic Shards | ranged attack | **28.9k** | 4.2k / 339 / 664 | 7.4k / 23.0k / 26.8k | 1.4k / 7.9k (50%, 3%) / 0% | survives physical 0.47 | 1 |  |
| alkaizer-s-ssfhc-tactician-mercenary-alkaizerx | Tactician | 93 | Crossbow Shot | ranged attack | **27.2k** | 3.0k / 12 / 780 | 4.4k / 14.4k / 12.4k | 18.7k / 314 (0.1%, 42.2%) / 0% | survives physical 0.79 | 1 |  |
| twister-gemling-legionnaire | Gemling Legionnaire | 94 | Twister | ranged attack | **18.1k** | 1.4k / 2.5k / 830 | 5.2k / 21.5k / 5.0k | 135 / 10.0k (54%, 0%) / 20% | survives physical 0.67 | 10 |  |
| twister-spirit-walker-snoobae | Spirit Walker | 97 | Twister | ranged attack | **18.0k** | 1.5k / 2.4k / 720 | 5.0k / 19.9k / 6.3k | 0 / 11.5k (59%, 20%) / 0% | survives physical 0.70 | 10 |  |
| animeprincess-twister-gemling-league-starter | Gemling Legionnaire | 96 | Twister | ranged attack | **17.9k** | 2.0k / 975 / 726 | 3.5k / 13.0k / 7.6k | 721 / 11.0k (51%, 84%) / 0% | ONE-SHOT physical 1.01 | 8 |  |
| lazyexile-amazon-league-starter | Amazon | 93 | Storm Lance | ranged attack | **7.7k** | 2.2k / 111 / 767 | 2.3k / 9.2k / 8.0k | 350 / 9.3k (47%, 21%) / 0% | ONE-SHOT physical 1.50 | 1 |  |
| rapid-permafrost-grenade-blast-scorpius | Gemling Legionnaire | 60 | Permafrost Bolts | ranged attack | **1.8k** | 1.6k / 184 / 796 | 2.0k / 1.3k / 1.8k | 490 / 162 (4%, 0%) / 0% | ONE-SHOT lightning 2.91 | 1 | level 60 < 90: enemy level 60 follows character level |
