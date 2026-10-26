# Boss damage of published league starters, estimated the guides' way (2026-10-25)

**Why.** The first boss study (`2026-10-25-boss-damage.md`) measured what PoB reads. The user then asked for the
library's builds to be estimated by the method amendment 11 gives our own designs (§9b, D-447), to set a floor from:
"we should estimate the boss DPS in the guide library the same way we do in our guides so we can set the floor based
on that study." This study estimates; the floor is the user's decision.

**The builds.** The first study's 30 level-90+ builds from the private reference library of Mobalytics' verified
league-starter guides, cited by page slug. 19 are current (their PoB file has the current 0_5 tree); 11 have an
0_2, 0_3 or 0_4 tree, though some guides' text is updated for the current patch.

**The method** (five agents of six builds each, grouped by the correction each build needs most; about 1.94M agent
tokens: 314K, 378K, 405K, 408K and 430K):
1. **The rotation's entries**, as D1-build would name them: what the build presses on a boss and what runs together,
   one entry per group, active skill and stat set; a spell a meta gem triggers is an entry, never the meta gem.
2. **Copies acting at once** (totems, companions) in the group's count, as the compiler's Count rule does.
3. **PoB's figure** for each entry against a Pinnacle boss, under the first study's realistic config (only the
   conditions the guide justifies, no custom modifiers); seven builds were re-measured where an entry or a stat was
   missing (one on a copy of its file with the guide's companion gem in place of the file's). **PoB alone** is §9b's `damage.boss`: the sum of the entries PoB rates itself.
4. **The hand estimate**, as D1-finish's `boss_<stage>` ledger entry would make it: one formula over the entries'
   figures, each input sourced as a ledger input is (a record field, gem or item text, the guide's words, or a
   judgment with its confidence). The corrections in §9b's list: a triggered spell's rate from its meta gem's energy
   rules; procs; hits that all land on one boss; buffs PoB has no stat for. Corrections outside the list were allowed
   and recorded apart (marked * below): the rotation's share of the player's time, a charged burst over its cycle, a
   condition's uptime, and other gaps. Corrections lower a figure as readily as they raise it.
5. **The estimate** is sustained damage per second over the boss rotation's cycle; the **burst** is one cycle's
   damage and its length; the **range** varies the judgment inputs. Three builds are marked not estimable: one whose
   two unknowns multiply, one with no rotation text, and one PoB reads at a sliver of its in-game damage.

## Results

| Build | Class / ascendancy | Engagement | Current | PoB alone | Estimate | Estimate ÷ PoB | Burst | Range | Confidence | Corrections (* outside §9b) |
|---|---|---|---|---|---|---|---|---|---|---|
| ronarray-unarmed-hollow-palm-monk | Monk / Martial Artist | close | yes | 29.49M | 30.62M | 1.04× | 96.99M / 3.17s | 15.50M–35.27M | medium | landing, procs, burst-cycle*, rotation-share* |
| fubgun-flameblast-oil-grenade | Mercenary / Gemling Legionnaire | distance | yes | 12.72M | 30.59M | 2.40× | – | 25.22M–35.96M | high | uptime*, other* |
| arc-gemling-path-of-ky | Mercenary / Gemling Legionnaire | distance | yes | 23.60M | 23.60M | 1.00× | – | 23.60M–41.51M | medium | buff |
| 0-3-league-start-the-hollowed-one-detailed-league-start-guide-to-endgame-ignatius | Huntress / Amazon | close | no | 12.37M | 15.81M | 1.28× | 59.14M / 3.74s | 6.33M–15.81M | medium | landing, burst-cycle*, rotation-share* |
| ruetoo-tactician-mirage | Mercenary / Tactician | distance | yes | 5.67M | 11.34M | 2.00× | – | 918k–17.02M | low (not estimable) | landing |
| grim-totem-oracle-imexile | Druid / Oracle | distance | yes | 4.55M | 9.51M | 2.09× | – | 7.86M–19.42M | low | landing, buff |
| coc-spark-comet-recoup-infernalist-by-ignatius | Witch / Infernalist | distance | yes | 583k | 4.81M | 8.24× | 21.75M / 4.52s | 2.54M–5.09M | medium | trigger-rate, landing, rotation-share*, other* |
| woolie-run-n-gun-witch-hunter | Mercenary / Witchhunter | close | no | 1.54M | 4.78M | 3.11× | – | 3.21M–4.78M | high | landing, buff, trigger-rate |
| martial-artist-league-starter-scorpius | Monk / Martial Artist | close | yes | 339k | 4.30M | 12.67× | 25.18M / 6s | 1.50M–5.70M | medium | landing, buff, procs, burst-cycle*, rotation-share* |
| plants-lich-deadrabb1t | Witch / Abyssal Lich | distance | no | 916k | 2.41M | 2.63× | 19.29M / 8s | 1.83M–2.51M | medium | landing, procs, buff, rotation-share*, uptime* |
| firebringer-league-start-woolie | Warrior / Warbringer | distance | no | 802k | 1.78M | 2.22× | 12.98M / 7.29s | 1.05M–2.49M | low | procs, rotation-share*, buff |
| martial-artist-monk-build-league-starter-to-endgame | Monk / Martial Artist | close | yes | 2.08M | 993k | 0.48× | 6.90M / 6.95s | 870k–1.34M | medium | procs, burst-cycle*, rotation-share* |
| explosive-witchhunter | Mercenary / Witchhunter | close | yes | 279k | 970k | 3.48× | 3.80M / 4.5s | 832k–1.30M | medium | landing, landing |
| coc-balls-invoker-ronarray | Monk / Invoker | close | no | 1.25M | 872k | 0.70× | 6.98M / 8s | 675k–872k | medium | burst-cycle*, procs, other* |
| spirit-walker-beast-master | Huntress / Spirit Walker | distance | yes | 150k | 684k | 4.56× | 8.95M / 13.1s | 323k–1.02M | low | other*, rotation-share*, buff, buff |
| bear-druid-build-league-starter-to-endgame | Druid / Shaman | close | no | 634k | 649k | 1.02× | 25.49M / 30s | 467k–850k | low | procs, buff, rotation-share*, uptime* |
| animeprincess-twister-gemling-league-starter | Mercenary / Gemling Legionnaire | distance | yes | 569k | 585k | 1.03× | 1.45M / 2.485s | 267k–1.27M | low | rotation-share*, procs, landing, buff |
| woolie-wolfman | Druid / Oracle | close | no | 1.40M | 449k | 0.32× | 3.23M / 7.19s | 414k–471k | medium | buff, procs, other*, rotation-share*, uptime* |
| twister-gemling-legionnaire | Mercenary / Gemling Legionnaire | distance | yes | 256k | 389k | 1.52× | 963k / 2.475s | 157k–928k | low | rotation-share*, procs, landing, buff, buff, uptime* |
| facebreakers-hollow-palm-martial-artist-league-starter | Monk / Martial Artist | close | yes | 695k | 288k | 0.41× | 1.68M / 5.83s | 186k–337k | medium | burst-cycle*, procs |
| misoxshiru-glacial-lance-ritualist | Huntress / Ritualist | distance | no | 307k | 268k | 0.87× | 6.44M / 24s | 232k–305k | medium | rotation-share*, other*, burst-cycle* |
| balrog-fire-bear-smith | Warrior / Smith of Kitava | close | no | 111k | 251k | 2.25× | – | 149k–312k | low | procs, trigger-rate, buff, uptime*, burst-cycle* |
| alkaizer-s-ssfhc-melee-gemling-alkaizerx | Mercenary / Gemling Legionnaire | close | yes | 646k | 250k | 0.39× | – | 193k–289k | high | rotation-share* |
| twister-spirit-walker-snoobae | Huntress / Spirit Walker | distance | yes | 458k | 212k | 0.46× | 1.48M / 7s | 96k–463k | low | rotation-share*, procs, landing, buff, buff |
| skadoosh-decompose-pathfinder | Ranger / Pathfinder | close | no | 278k | 146k | 0.52× | – | 97k–194k | low | other*, other*, uptime*, other* |
| alkaizer-s-hc-martial-artist-monk-alkaizerx | Monk / Martial Artist | close | yes | 148k | 122k | 0.82× | – | 100k–183k | low (not estimable) | procs |
| alkaizer-s-ssfhc-tactician-mercenary-alkaizerx | Mercenary / Tactician | distance | yes | 29k | 114k | 3.95× | – | 43k–221k | low | landing, landing, rotation-share* |
| naviras-fracturing-varashta-league-starter | Sorceress / Disciple of Varashta | close | yes | 11k | 61k | 5.65× | 921k / 15s | 56k–72k | medium | other*, trigger-rate, buff, burst-cycle* |
| ignatius-spark-stormweaver | Sorceress / Stormweaver | distance | no | 41k | 34k | 0.83× | – | 17k–51k | low (not estimable) | trigger-rate, landing, rotation-share*, other*, other* |
| lazyexile-amazon-league-starter | Huntress / Amazon | distance | yes | 10k | 29k | 3.00× | – | 10k–157k | medium | landing |

## The spread

| Builds | n | Lowest | 10th pct | 25th pct | Median | 75th pct |
|---|---|---|---|---|---|---|
| All 30 | 30 | 29k | 109k | 250k | 667k | 4.66M |
| Current | 19 | 29k | 103k | 231k | 684k | 7.16M |
| Current, estimable | 17 | 29k | 93k | 250k | 684k | 4.81M |
| Current, confidence high or medium | 11 | 29k | 61k | 269k | 993k | 14.2M |
| Current, close | 8 | 61k | 104k | 218k | 629k | 1.82M |
| Current, distance | 11 | 29k | 114k | 301k | 684k | 10.4M |
| Current, without the three SSF hardcore builds and the 1-divine variant | 15 | 61k | 242k | 487k | 993k | 10.4M |
| PoB alone, current | 19 | 10k | 25k | 203k | 569k | 3.31M |

**How many current builds a floor would put below it** (of 19; all 30 in brackets):
- 100k: 2 (3): the LazyExile Amazon's 1-divine variant (29k) and Navira's Varashta (61k).
- 200k: 4 (6): adds Alkaizer's hardcore Martial Artist (122k) and his SSF hardcore Tactician (114k).
- 250k: 5 (7): adds snoobae's Twister Spirit Walker (212k).
- 300k: 7 (11): adds Alkaizer's SSF hardcore melee Gemling (250k) and Facebreaker's Flicker Strike (288k).
- 500k: 8 (13): adds snoobae's Twister Gemling (389k).
- 1M: 12 (19).

Six builds' ranges straddle 250k (Alkaizer's melee Gemling, Balrog's Bear Smith, Facebreaker's Flicker Strike, the
Glacial Lance Ritualist, both of snoobae's Twisters), so a floor near the 25th percentile sits where the estimates
are least certain.

## What the study shows

- **The hand estimate moves PoB's figure both ways:** estimate ÷ PoB alone runs 0.32× to 12.7×, median 1.40×.
  Falling Thunder's projectiles, Cast on Critical's Comets and grenades' extra hits raise builds several times over;
  builds PoB rates as pressing one skill all the time fall to a half or less once the rotation shares the player's
  time (Woolie's Wolfman 0.32×, Alkaizer's Perfect Strike 0.39×, Facebreaker's Flicker Strike 0.41×).
- **Engagement doesn't split boss damage:** the 25th percentile is 218k close and 301k at a distance, the medians
  629k and 684k. One floor serves both, unlike toughness.
- **The low end is mostly a kind of build, not weak damage:** three of the five current builds under 250k are
  Alkaizer's self-found hardcore builds, one is a 1-divine "for fun" variant, and one is Navira's Varashta, whose
  damage PoB reads worst (its companion's supports dropped). Without the hardcore and 1-divine builds the current 25th
  percentile is 487k.
- **Confidence is low on many:** 3 high, 14 medium, 13 low. The low ones rest on a landing count (how many twisters,
  fragments or pillars hit one boss) or a rotation share no source states.
- **§9b's list of corrections is too short:** 23 of 30 builds needed a correction outside it. The rotation's share of
  the player's time (17 builds) and a burst over its cycle (9) are as common as the listed ones (landing 17, buffs
  17, procs 14). A design estimated by §9b as written would read differently from this study, so a floor from this
  study holds only if §9b gains them.

## Gaps in §9b's method the agents met

- **Totems aren't triggers.** Spell Totem is a meta gem, so a totem's spell reads "triggered" and would be left out of
  PoB alone; a totem casts at its own rate, which PoB rates.
- **One ignite.** Ignites don't stack, but the Count rule sums `IgniteDPS` across a rotation's entries.
- **PoB alone overstates** a rotation whose skills take turns (Woolie's Wolfman: 1.40M summed, 449k estimated) and
  sums a skill's alternative stat sets (plain and infused Spark).
- **Use times.** PoB's `Speed` is a cooldown cap for cooldown skills (Falling Thunder, Tempest Bell, grenades) and
  not the use time for channelled ones (Rampage, Perfect Strike); a rotation share needs the time a use takes.
- **Caps on copies** (Grim Pillars' 20 pillars, Forge Hammer's fissures at most 5 a second) and **hits per use**
  (Shred's final strike hits twice) have no correction kind.
- **Inputs no tool exposes:** an ignite's stack potential, maximum power and frenzy charges, ailment chance, a Frost
  Wall crystal's life. Agents derived them from data or an override probe.
- **Meta gems feed each other** (Cast on Critical's Comet ignites, filling Cast on Elemental Ailment, whose Comet crits
  refill Cast on Critical); rating each trigger alone misses the loop.
- **A buff with no stat map** has to be entered as the stat it grants, which the no-custom-modifier rule forbids in a
  measure; agents applied it in the formula instead.
- **Conditions the rotation guarantees** (Retreat III after three Whirling Slashes) and **Parry on companions** were
  rejected by the first study's rules though the rotation earns them.
- **Ranges** need several judgment inputs varied, not one.
- **One shared rule each** for Mana Tempest on totem spells, on-hit procs (per strike) and returning nova projectiles
  (about half land), so designs treat them alike.

## For the PoB gap list (`../pob-gaps.md`)

Beyond the first study's list: Bonestorm's spike count has no config option (its stage multiplier reads 0); Ice-Tipped
Arrows' conversion and Verglas's crystal-life gain have no stat map; Volcanic Steps reads as meta-gem triggered (it
fires per metre walked); monster skills carry no cooldowns, so a companion's slam rate is a judgment.

## For the decision

- **The floor's value.** The current builds' 25th percentile is about 230–250k, the toughness targets' precedent
  (20k and 15k sat near the 25th percentile). Without the hardcore and 1-divine builds it is about 490k.
- **Its rung.** These are level-90+ builds, so the floor would apply at non-budget, as the toughness targets do.
- **What a design below it gets** (the toughness band's precedent: under 90% of the target, a defence trade shown).
- **§9b's corrections:** the floor compares a design's estimate with this study's, so §9b would gain the corrections
  outside its list and the shared rules above.
