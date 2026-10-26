# Defence layers in published league starters (2026-10-26)

**Why.** The toughness study (`2026-10-25-toughness-floors.md`) set the non-budget rung's EHP targets, 20,000 for a
build that fights close and 15,000 for one that fights at a distance, from one number per published build. The design
gate shows that number beside the Arbiter verdict, and D1-finish offers a defence trade when a rung is under its band.
Neither says which layer makes a build's EHP, which layers also hold a big hit, or what a trade should buy. This study
takes the same 30 builds apart, one layer at a time.

**The builds.** The toughness study's 30 level-90+ files, unchanged: each was copied into a temporary builds folder and
hashed before and after. Their base EHP equals the toughness study's for all 30. Guides are cited by their page slug,
engagement (close or distance) is the toughness study's, and only our own measurements are given.

**The measure.** PoB v0.23.1 (game 0.5.4), under the design's own enemy for the non-budget rung: not a boss, the
endgame resistance penalty of −60, area 82's reference hits (439 physical and 106 each of fire, cold, lightning and
chaos), enemy level 85. The file's own buffs and conditions are kept, as in the toughness study.
- **EHP** is PoB's `TotalEHP`: how much of the reference hits the character takes, on average, before dying.
  The layers that work by chance count in it as averages. Evade and block (avoidance) stop a share of hits outright.
  Deflection takes 40% off the share of hits it deflects.
- **Max hit** is PoB's maximum hit taken of each damage type, the largest single hit the character survives. The
  **Arbiter verdict** is the design's one-shot check: the Arbiter's largest hit of each type (3,486 physical, 3,969
  lightning) against the build's max hit of that type, one-shot at a ratio of 1 or more.
- **A layer's factor** is EHP with it ÷ EHP without it (and the same for the lowest max hit). Each layer was removed
  alone ("knocked out") by a custom modifier PoB parses fully, a config option, or a tree change: "Cannot Evade Enemy
  Attacks" for evade; "100% less Deflection Rating"; "Cannot Block"; armour turned off for physical hits but kept as a
  stat; each resistance lowered to 0; each physical-taken-as share cancelled; curse gems off; "100% less maximum Energy
  Shield"; a negative damage-from-mana-first share; the barrier skill's group off; the companion's life set to 0;
  keystones unallocated.
- **The bare pool** is EHP with every avoidance and mitigation layer removed at once (and curses off): what the pool
  alone (life, energy shield, mana under damage-from-mana-first, a barrier, an ally's share) is worth. A layer's
  **share** is ln(its factor) ÷ ln(EHP ÷ bare pool), so the shares of layers that multiply add to about 100%.
- **Conditions:** "Have you been Hit Recently?" on, the enemy not blinded, Wind Dancer at 0 stages with no dodge roll
  recently, PoB's unlucky switch (each evade and block roll is the worst of two; PoB leaves deflection's roll alone),
  and all four at once.
- **One-shot fixes:** for each build the Arbiter one-shots, the smallest single added line (life, energy shield,
  armour, physical taken as fire, maximum resistances) that brings the worst ratio under 1, by binary search.
- **Jewels:** each socketed jewel replaced by a blank one, EHP and damage (the boss study's first boss skill) read
  without it. **Tree points:** PoB's node power on the active tree, damage first and EHP first.

## What each layer is worth

| Layer | Builds | EHP factor, median (range) | Close | Distance | Lowest max hit factor, median (range) | Physical max hit factor (range) |
|---|---|---|---|---|---|---|
| Evade chance | 23 | 2.04 (1.01–5.05) | 2.05 | 2.04 | 1.00 (1.00–1.00) | 1.00 everywhere |
| Evasion rating, with all it feeds | 23 | 2.24 (1.01–13.04) | 2.34 | 2.17 | 1.00 (1.00–1.88) | 1.00–1.88 |
| Deflection | 16 | 1.18 (1.01–1.61) | 1.21 | 1.11 | 1.00 | 1.00 everywhere |
| Block | 2 | 1.20 and 1.60 | – | 1.40 | 1.00 | 1.00 |
| Armour against physical hits | 19 | 1.33 (1.03–9.50) | 3.03 | 1.31 | 1.02 (1.00–3.18) | 1.00–3.18 |
| Armour on elemental hits | 10 | 1.61 (1.02–2.30) | 1.67 | 1.61 | 1.00 (1.00–1.03) | 1.00 |
| Resistances | 30 | 1.61 (1.30–2.24) | 1.47 | 1.66 | 1.32 (1.00–3.18) | 1.00 (1.00–1.68) |
| Physical taken as an element | 7 | 1.04 (1.03–1.51) | 1.04 | 1.05 | 1.04 (1.04–1.48) | 1.04–1.68 |
| Curses on the enemy (Enfeeble) | 3 | 1.52 (1.52–1.57) | – | 1.52 | 1.52 (1.45–1.52) | 1.45–1.52 |
| Energy shield (not Chaos Inoculation) | 14 | 1.69 (0.70–7.98) | 2.56 | 1.32 | 1.72 (1.04–7.82) | 1.04–8.02 |
| Damage taken from mana first | 9 | 1.12 (1.03–14.66) | 1.11 | 1.12 | 1.12 (1.03–14.67) | 1.03–14.67 |
| A barrier skill | 7 | 1.37 (1.01–1.96) | 1.70 | 1.36 | 1.23 (1.01–1.96) | 1.01–1.96 |
| Runic Ward | 3 | 1.08 (1.01–1.23) | 1.01 | 1.16 | 1.07 (1.01–1.57) | 1.01–1.49 |
| A companion's share of hits | 4 | 1.09 (1.06–1.11) | 1.11 | 1.09 | 1.09 (1.05–1.11) | 1.05–1.11 |

"Builds" counts those where the layer moves EHP by more than 0.5%. The Witchhunters' energy shield is left out (see
the Witchhunter correction). By archetype, part 1's medians: evade ×1.90 casters (3), ×2.10 melee (11), ×2.00 minion
(2), ×2.17 ranged attack (7); resistances ×1.58, ×1.57, ×1.38, ×1.72.

- **Chance layers never move the max hit.** Evade, deflection and block read 1.00 on the max hit in every build. PoB's
  max hit assumes the hit is neither evaded, blocked nor deflected. It counts deflection only at a 100% chance, which
  the 95% cap rules out (`Modules/CalcDefence.lua`:2459). Evasion
  moves it only where it sizes a pool: the Witchhunters' Sorcery Ward is 30% of armour plus evasion, so their evasion
  rating reads ×1.88 and ×1.62 on the max hit.
- **Evade is the biggest layer where present:** median ×2.04, from ×1.25 at 20% evade to ×5.05 at 80%. Its factor is
  1 ÷ (1 − the chance not to be hit) within 0.05 in all 24 builds, so it can be read off the evade chance. PoB's base
  evade chance is 95% × r ÷ (r + 4), r the evasion rating ÷ the enemy's accuracy (2,357 at level 85, 20% less when
  blinded), before lines that add evade chance; the evasion builds sit at r = 3.9 to 20.3.
- **Deflection is a damage reduction on some hits, not avoidance.** A deflected hit still lands, with 40% of its
  damage prevented (the game's "Prevent +X% of Damage from Deflected Hits", base `BasePercentDamageDeflected` 40).
  PoB applies that to all five damage types and to attacks and spells alike. Armour's share shrinks as the hit grows
  (armour ÷ (armour + 10 × hit)), but deflection's 40% doesn't, so a deflected boss slam loses more to it than to
  most builds' armour. The catch is the chance: a hit that isn't deflected takes full damage.
- **Deflection's worth in EHP follows its chance:** ×1.01–1.61 here. PoB averages it over every hit, each hit × (1 −
  chance × 40%), so it is at most 1 ÷ (1 − 95% × 40%) at the cap: a 38% cut on every hit that lands, taken on top of
  evade, since the two roll apart. The chance is front-loaded. Half the cap's rating already gives about 70%, and the
  last 25 points need as much rating again. The cap needs about 14.4 × the enemy's accuracy: 34k against PoB's
  level-85 monster, 27k when it is blinded. Six of the 16 builds deflect 67–95%, at 45–106% of the cap's rating; the
  other ten sit at 3–43%. Read back from the knock-outs, its effect is 38–43% on all 16 builds. On
  Snoobae's Twister this holds only with its companion removed (see "Snoobae's Twister and its companion" below).
  Deflection comes from evasion in every build but two, whose
  rating comes from armour (Alkaizer's SSF Tactician, 3.7k; Ruetoo's Tactician, 284). Only the explosive Witchhunter
  is over the cap, at 15.2 × accuracy against the cap's 14.4.
- **Block counts at ¾:** PoB applies plain block to attacks and projectiles, three of the four hit kinds of its
  "Average" enemy. Woolie's Firebringer blocks 50% and reads ×1.60, the Twister Legionnaire 20% and ×1.20.
- **Armour reads its best case in EHP.** Against the 439 reference hit the eight armour builds (4.3k–54k armour) cut
  71–90% of physical damage, and armour is worth ×3.0–9.5 in their EHP. Against the hit that kills them (2–7k
  physical) it is worth ×1.19–1.88 on the max hit (×3.18 on the Comet Infernalist, whose pool is tiny). The other 11
  builds with some armour read ×1.03–1.34.
- **Armour on elemental hits** raises EHP ×1.35–2.30 on the eight builds with 87% or more (Fubgun's Flameblast, 280%,
  reads ×2.30) and never the lowest max hit, which stays physical.
- **Resistances** are worth ×1.30–2.24 in every build. They move the physical max hit only where physical damage is
  taken as an element (MisoxShiru's Glacial Lance ×1.68, Balrog's Bear Smith ×1.19).
- **Physical taken as an element** is large on two builds: Balrog's Bear Smith, 30% as fire, ×1.51 on EHP and ×1.33
  on the lowest max hit; MisoxShiru's Glacial Lance, 51% as lightning, ×1.44 and ×1.48. Five builds carry 5% spread
  over three elements, ×1.03–1.07.
- **Enfeeble moves both figures:** ×1.52–1.57 on EHP and ×1.45–1.52 on the max hit, on the three casters that curse
  with it (the Arc Gemling, as the second curse Whispers of Doom allows; the Grim Pillars Oracle; Ignatius's
  Stormweaver).
- **Pools move both figures alike.** Energy shield where it isn't the whole pool: median ×1.69 on EHP, ×1.72 on the max
  hit. Damage from mana first: ×4.13–14.66 on the three Mind over Matter or Eldritch Battery casters, ×1.03–1.15 on six
  builds with a 4–15% share. A barrier skill: Sorcery Ward ×1.96 and ×1.70 on the two Witchhunters. Runic Ward ×1.23
  on EHP and ×1.57 on the max hit for the Comet Infernalist. A companion's share (Romira's Requital's 10% on three
  builds, a 5% companion line on the Beast Master): ×1.06–1.11 on both.
- **Chaos Inoculation** (life 1, immune to chaos): unallocating it costs ×1.12–1.28 of EHP and ×1.31–1.66 of the
  lowest max hit on five builds, since chaos hits then drain energy shield at double rate. On Ronarray's Hollow Palm
  Monk it reads ×0.97 and ×0.81: the build's life lines return without it.
- **Virtuous Barrier is a buff, not a pool.** Part 1 grouped it with the barriers. On five Gemlings it adds life,
  evasion and armour by motes of each attribute (×1.01–1.68 EHP, ×1.01–1.26 max hit; the animeprincess Twister reads
  ×1.68). The game drops a mote when the character is hit; PoB counts the motes from the socketed gems and has no
  option for the loss, so the figure is a full-motes reading.

## Which layer carries each build

Each layer's share of the EHP over the bare pool, medians where present (part 1's table 3):

| Archetype | Builds | Evade | Deflection | Block | Armour | Resistances | Physical taken as | Curses |
|---|---|---|---|---|---|---|---|---|
| caster | 7 | 20% (3) | 9% (1) | – | 41% (5) | 45% (7) | – | 47% (3) |
| melee | 13 | 53% (11) | 12% (7) | 19% (1) | 68% (6) | 29% (13) | 17% (3) | – |
| minion | 2 | 33% (2) | 18% (1) | – | 10% (1) | 53% (2) | – | – |
| ranged attack | 8 | 53% (7) | 9% (7) | 14% (1) | 9% (7) | 29% (8) | 2% (4) | – |
| close | 15 | 53% (14) | 12% (9) | – | 65% (7) | 29% (15) | 1% (3) | – |
| distance | 15 | 51% (9) | 7% (7) | 16% (2) | 21% (12) | 33% (15) | 3% (4) | 47% (3) |

The builds fall into six defence families. The physical max hit follows the pool, not EHP:

| Family | Builds | EHP min / median / max | Physical max hit min / median / max | EHP with all conditions, median | One-shot |
|---|---|---|---|---|---|
| Evasion with an energy shield pool | 10 | 17.3k / 23.6k / 52.0k | 4.5k / 6.2k / 19.1k | 14.6k | 0 |
| Evasion with a life pool | 5 | 7.7k / 17.9k / 28.9k | 2.2k / 3.5k / 7.4k | 10.9k | 3 |
| Evasion with Sorcery Ward (corrected) | 2 | 158k / 182k / 206k | 11.6k / 13.2k / 14.8k | 22.9k | 0 |
| Armour with a life pool | 8 | 4.6k / 29.3k / 95.9k | 2.1k / 5.0k / 7.4k | 25.6k | 1 |
| A mana pool (Mind over Matter, Eldritch Battery) | 3 | 14.2k / 16.9k / 19.1k | 8.4k / 9.0k / 10.7k | 16.9k | 0 |
| Energy shield, no evasion | 2 | 16.5k / 20.7k / 24.8k | 9.7k / 12.0k / 14.2k | 20.4k | 0 |

- Evasion with an energy shield pool: the five Martial Artists, the Hollowed One Amazon, Skadoosh's Pathfinder, the
  Invoker and the two Twister builds with 2.4–2.5k energy shield. Close melee builds dominate it.
- Evasion with a life pool: the animeprincess Twister, LazyExile's Amazon, MisoxShiru's Ritualist, the Beast Master,
  Ruetoo's Tactician. They read about the same EHP as the mana casters and half the physical max hit; three of the
  five are one-shot. Their life is part of why: a median 2.1k, and 1.5–2.2k on the three Huntresses (a dexterity
  class), against 2.9k for the armour builds. Strength adds 2 base life a point before life increases; dexterity
  adds only accuracy (`Modules/CalcPerform.lua`:499–510).
- Armour with a life pool: Alkaizer's melee Gemling and SSF Tactician, Balrog's Bear Smith, the Shaman bear, Woolie's
  Wolfman and Firebringer, Fubgun's Flameblast, the Comet Infernalist. Conditions barely move them.

## What the gate sees and what it can't

| Defence | EHP | Max hit (the Arbiter verdict) |
|---|---|---|
| Evade, deflection, block, blind, Wind Dancer | yes | no |
| Armour, armour on elemental hits, resistances, physical taken as an element | yes, armour at the reference hit | yes, at the hit's own size |
| Life, energy shield, damage from mana first, Sorcery Ward, Runic Ward, a companion's share | yes | yes |
| Enfeeble and other enemy-damage curses | yes, at map-monster strength | yes, at map-monster strength |
| Armour past the cap against the reference hit | no | yes |
| Recovery: regeneration, leech, recoup, instant flasks, energy shield recharge | no | no |
| Stun and ailment thresholds, slows and chill on enemies, decoys | no | no |
| Lines PoB doesn't parse | no | no |

- **The Arbiter verdict is the only figure that reads a one-shot.** EHP can pass its target on chance layers alone: the
  animeprincess Twister reads 17.9k, inside the distance band, and is one-shot.
- **Armour past the cap is invisible to EHP.** The Comet Infernalist's 22.8k armour already cuts 90% of the reference
  hit; adding 11.1k leaves its EHP at 4.6k and clears its one-shot.
- **Curses are credited at map strength in both figures.** Without Enfeeble the three casters' worst Arbiter ratios
  rise from 0.33, 0.39 and 0.41 to 0.50, 0.59 and 0.60. PoB halves curse effect on a pinnacle boss; at half strength
  (×1.2 instead of ×1.52, our estimate) the ratios would be about 0.42, 0.49 and 0.52. No verdict flips.
- **What the gate can't see is present in most builds** (line counts by pattern on the tree, items, jewels and custom
  lines, so approximate): regeneration in 26 builds, instant flask recovery in 24, stun lines in 24, leech in 19,
  energy shield recharge lines in 19, slows on enemies in 16, chill or freeze in 15 (17 more by gem), ailment threshold
  in 15, recoup in 8. Two to 23 defence lines per build aren't fully parsed (median 9.5); the commonest are Nascent
  Hope's recharge on use (13 builds), Ghost Dance's two lines (12), Lavianga's Spirits' constant effect (12), reduced
  slowing potency (10), Olroth's Resolve's guard (4) and Blade Catcher's armour against crits (3).

## The one-shot builds

Four builds are one-shot by the Arbiter, all by its physical hit. Each fix is one line added alone, the smallest that
brings the worst ratio under 1:

| Build | Engagement | EHP | Worst ratio | Life / energy shield / armour | Life | Energy shield | Armour | Physical taken as fire |
|---|---|---|---|---|---|---|---|---|
| coc-spark-comet-recoup-infernalist-by-ignatius | distance | 4.6k | 1.66 | 885 (300 unreserved) / 0 / 22.8k | +3.6k (14.0k) | +342 (11.6k) | +11.1k (4.6k) | 45% (5.4k) |
| spirit-walker-beast-master | distance | 12.9k | 1.55 | 1.5k / 523 / 1.3k | +1.1k (20.8k) | +640 (19.9k) | +16.3k (28.5k) | 48% (16.8k) |
| animeprincess-twister-gemling-league-starter | distance | 17.9k | 1.01 | 2.0k / 975 / 721 | +30 (18.1k) | +13 (18.1k) | +138 (18.9k) | 2% (18.1k) |
| lazyexile-amazon-league-starter | distance | 7.7k | 1.50 | 2.2k / 111 / 350 | +1.1k (11.7k) | +1.1k (11.5k) | +17.1k (20.7k) | 45% (10.8k) |

EHP after the fix in brackets.
- Three are evasion builds with a life pool (47–66% evade, 7.7–17.9k EHP); the fourth has a big armour and a tiny
  pool, since two thirds of its life is reserved.
- A pool line is the cheapest fix in every case; armour fixes them all but needs 11–17k; a physical shift needs 45–48%
  on the three far from the line. Raising every maximum resistance by up to 30% fixes none.
- Node power ranks by EHP, and the best EHP nodes in these builds are evasion and energy shield nodes; none of our
  tools ranks a node by a type's max hit, so how many tree points each fix costs is not measured.
- **Deflection makes three of the four one-shots a chance, not a certainty.** A deflected slam deals 60% of its
  damage, so the worst ratio falls to about 0.6 × the ratio when the slam is deflected. Their armour is too small to
  bend this. The Twister Gemling deflects 84% of hits and survives a deflected slam (about 0.61). The Beast Master
  deflects 67% and survives one at about 0.93. The Amazon deflects 21% and survives one at about 0.90. The Comet
  Infernalist has no deflection. So a slam kills them about 16%, 33%, 79% and 100% of the time. The deflect chances
  are at the design enemy's accuracy; a boss's may be higher, so treat these as the best case. The Arbiter verdict
  shows none of this.

## Conditions and luck

| Condition | Builds it moves | EHP factor | Max hit factor |
|---|---|---|---|
| Been hit recently | 4 (8 files already set it) | Witchhunters ×0.44 and ×0.47; Snoobae's Twister ×0.77; Scorpius ×0.97 | Witchhunters ×0.77 and ×0.81, else 1.00 |
| Enemy not blinded | 11 (the files that blind) | ×0.78–0.90 | 1.00 |
| Wind Dancer at 0, no dodge roll | 7 (the files with 3 stacks) | ×0.70–0.88 | Witchhunters ×0.89 and ×0.91, else 1.00 |
| Unlucky (worst of two rolls) | 16 builds over 40% evade | ×0.55–0.68 (they lose 32–45%) | 1.00 |
| All four at once | evasion builds | ×0.38–0.68 | Witchhunters only |

- **The Witchhunters' body armour is read:** Hyrri's Ire doubles evasion while not hit recently, and turning "been hit
  recently" on halves their EHP and cuts their max hit by a fifth, because Sorcery Ward is sized from evasion.
  Snoobae's Twister loses a third of its evasion to a not-hit-recently line (not traced).
- **Luck matters only to avoidance.** Armour, energy shield and mana builds lose 0–11% under the unlucky switch, and
  PoB's switch leaves deflection alone.
- **Under the band.** At base 5 builds are under 90% of their target (2 close, 3 distance). Unlucky alone puts 11
  under (5, 6); all four conditions 13 (6, 7). With all four, the close median falls from 36.3k to 20.2k and the
  distance median from 18.1k to 14.2k: about the targets themselves.

## Jewels and tree points

- **Sockets:** 2 to 9 allocated per build (median 4). The 85 rare jewels mostly carry damage lines; 70 have four or
  more lines.
- **Jewels that hold no nodes (107):** median ×1.00 on EHP and ×1.07 on damage; 70 add over 5% damage, 11 over 5% EHP;
  the 64 with a defence line read a median ×1.02 on EHP.
- **Radius jewels that allocate nodes** are in 12 builds and give the largest single-jewel effects: From Nothing in 9
  (up to ×1.23 EHP on Snoobae's Twister, up to ×1.58 damage on the Arc Gemling), Controlled Metamorphosis in 3 (×1.41
  damage on Facebreaker's Monk, ×1.28 EHP on Ignatius's Stormweaver), Voices in 3 (×1.16–1.33 damage). The Arc
  Gemling's Split Personality holds its whole tree.
- **Tree points:** the weakest damage branch costs a median 0.72% of damage a point, and the best unallocated EHP node
  gains a median 5.5% of EHP a point (29 builds; Fubgun's tree has no damage branch with a loss). Close builds 0.87% :
  5.61%, distance 0.65% : 4.72%. The best EHP nodes are evasion, energy shield and armour nodes and, in four builds,
  Mind over Matter. Gains don't add, so this is a rate at the margin, not a budget.
- **Deflection nodes rank mid-pack on EHP.** On six evasion builds node power offers deflection nodes among its top
  picks, at 2.8–6.5% EHP a point against those builds' best pick at 4.3–9.4% (Ruetoo's Tactician's best, the Knight
  of Tarcus armour cluster, reads 40.7% on a build with almost no armour). Their worth against a big hit, a 40% cut on most hits, is not in EHP, so a ranking by EHP puts
  them behind evasion and energy shield nodes. That may be why most of these builds left deflection well under the
  cap. The other likely reason is history: deflection was weak before 0.5 and buffed heavily in it (the user,
  2026-10-26). A file's tree version shows only when it was last saved: 13 of the 18 evasion builds' files are on
  the 0.5 tree, and those still deflect anywhere from 0% to 95%.
- At those rates, D1-finish's defence trade (damage may fall 15%) buys about 20 points.

## The Witchhunter correction

Both Witchhunters' entire energy shield is one custom modifier (10,400 energy shield in Woolie's file, 8,100 before
increases in the explosive build's) that stands in for Sorcery Ward. PoB already models the ward from the skill the
Obsessive Rituals node grants (a barrier of 30% of armour plus evasion, up to 32,000, that takes physical and chaos
hits with Ceremonial Ablution), so the ward counted twice.

| Build | EHP as published | Without the stand-in | Also hit recently, not blinded, Wind Dancer 0, unlucky | Physical max hit as published / without | Arbiter ratio without |
|---|---|---|---|---|---|
| woolie-run-n-gun-witch-hunter | 338.0k | 205.7k | 25.2k | 25.6k / 14.8k | 0.24 |
| explosive-witchhunter | 309.1k | 157.8k | 20.7k | 23.8k / 11.6k | 0.30 |

- **In the toughness study,** only the ranged-attack row and the close row's maximum move: ranged attack 75th
  percentile 99.0k → 61.1k and maximum 338.0k → 205.7k; close maximum 338k → 206k. Every minimum, 25th percentile and
  median stays, and so do the counts under and over the band. "The two Witchhunters over 300k" becomes "over 150k".
  In its "Every build" table both lose their energy shield (10.4k and 12.2k → 0) and their physical max hit falls as
  above; their elemental and chaos max hits weren't re-read.
- **In this study,** the Witchhunters' rows were measured with the stand-in present. Their avoidance, armour and
  resistance factors are ratios and stand; their energy shield factor (×1.64 and ×1.96) is the stand-in, and their
  bare pools (21.7k and 20.9k) include it.
- **With every condition against them,** the two read 25.2k and 20.7k: tough builds, near the close target, not
  outliers.

## Tool gaps found

- **Node power with EHP first fails its reply contract** (it returns "result: Invalid input") on 8 of the 30 builds;
  `get_passive_upgrades` stood in for the EHP ranking there.
- **Not exposed by our tools:** PoB's chance not to be hit and chance to take damage, the number of hits to die, the
  damage-from-mana-first share, a barrier's size, a companion's life, deflection's effect, the physical-taken-as table,
  stun threshold and self-stun chance. Evade by hit kind came from PoB's sidebar on a saved temporary copy.
- **Coverage flags three lines PoB reads as "possibly unread":** Hyrri's Ire's doubled evasion, the Sorcery Ward grant
  and Ceremonial Ablution. The knock-outs show all three at work.
- **Node power can't rank by a type's max hit;** its swap guard reads the lowest max hit, but no stat it ranks by is
  one.
- **A false lead:** node power offers Mind over Matter to the Comet Infernalist at +88.6% EHP a point, but its
  Pyromantic Pact (maximum mana replaced by Infernal Flame) is unparsed, so PoB counts a mana pool the character
  doesn't have.

## Open

- **Balrog's energy shield.** Removing its 818 energy shield raises EHP from 36.3k to 51.8k while its physical max hit
  falls from 7.4k to 6.3k, as it should. PoB's hits-to-die loop, which counts hits in accelerated batches and warns in
  its own comments of EHP jumps, is the likeliest cause; not traced. The same loop is behind Snoobae's companion
  reading, below.
- **Snoobae's Twister and its companion.** Its deflection first read back at a 23% effect. A probe set the prevented
  share directly, at 0%, 20%, 40% and 60% (base 40%):
  - On the control, Skadoosh's Pathfinder (27% deflect), EHP followed 1 ÷ (1 − chance × share) exactly: 18.2k, 19.2k,
    20.4k, 21.7k.
  - On Snoobae's Twister (20% deflect, a companion taking a share of each hit), EHP read 17.2k, 17.3k, 18.0k and
    18.8k. The steps from 20% to 40% to 60% (+4.3%, +4.5%) are the formula's. Only the step up from 0% is short
    (+0.6% against +4.2%): the 0% reading sits about 3.5% above where the formula puts it.
  - With the companion's life set to 0, removing deflection reads ×1.093 against the formula's ×1.087.

  So deflection's 40% holds on all 16 builds, and Snoobae's deflection is worth about ×1.09, not ×1.05. The likely
  cause, not traced: when nothing scales the hit, PoB reuses its plain hits-to-die count (`Modules/CalcDefence.lua`
  :3311), and with a companion's share that count disagrees with the scaled one. A knock-out that removes a build's
  last chance layer can be bent the same way on a companion build. Evade doesn't enter that switch: it is counted
  apart, as the chance not to be hit. The Beast Master's reading (41.6%) is unaffected because its recoup line (Hate
  Scarab) makes PoB take the full count every time.
- **Deflection before or after armour.** PoB works out armour on the full hit, then takes deflection's 40% off what is
  left (`Modules/CalcDefence.lua`:2459–2468, :3258). If the game takes the 40% off first, armour would cut a deflected
  hit by more, and PoB would undercount builds that have both (the two Tacticians, whose deflection comes from armour).
  The game data doesn't say which comes first.
- **Tailwind's deflection line does nothing in PoB.** PoB gives 1% increased deflection effect per Tailwind stack
  (`Modules/CalcSetup.lua`:726), but it adds up only flat changes to the prevented share (:1522), so the line is
  never read. Its own Tailwind tooltip doesn't list the line either. None of the 30 builds depends on it.
- **Vaal Pact** reads ×1.20 on Balrog's Bear Smith and Ruetoo's Tactician, though its text concerns only leech, which
  EHP doesn't count; **Giant's Blood** reads ×1.71 on EHP and ×0.91 on the max hit on Woolie's Firebringer. Not traced.
- **Mind over Matter under Blood Magic** (Woolie's Wolfman) adds nothing: the keystone reads ×1.00, and removing Blood
  Magic raises EHP ×1.19 by giving Mind over Matter a mana pool.

## Caveats

- 30 builds, league starters only, mostly patch 0.5 files measured at the 0.5.4 pin; two minion builds and no totem,
  trap or mine build. Families of two or three builds are examples, not norms.
- The files' own conditions are kept (8 set "been hit recently", 11 blind the enemy, 7 hold Wind Dancer stacks), so the
  base readings are each file's own optimism; the condition table shows how much.
- Factors are knock-outs of one layer from the full build. Layers overlap (armour and resistances act on the same
  hit), so factors don't multiply back exactly; the shares on six builds sum to 111–119%.
- Line counts for what the gate can't see are by pattern, not by PoB, and count presence, not size.
- Barrier sizes and the Virtuous Barrier reading are estimates from the max hit a group adds; PoB's barrier value isn't
  exposed.

## Every build

Largest layers: the four largest EHP factors, with an energy shield pool under Chaos Inoculation named as the pool.
Bare pool: EHP with every avoidance and mitigation layer and the curses removed. Conditions: EHP unlucky ÷ base, and
EHP with all four conditions.

| Guide | Archetype | Engagement | EHP | Bare pool | Largest layers (EHP factor) | Physical max hit (Arbiter) | Unlucky / all conditions | Notes |
|---|---|---|---|---|---|---|---|---|
| skadoosh-decompose-pathfinder | caster | close | 20.4k | 5.6k | energy shield pool (CI); evade ×1.99; res ×1.45; armour ×1.20 | 5.1k (survives 0.69) | 0.66 / 12.1k | blinds the enemy |
| ronarray-unarmed-hollow-palm-monk | melee | close | 52.0k | 7.0k | energy shield pool (CI); evade ×3.89; deflect ×1.39; res ×1.38 | 6.2k (survives 0.56) | 0.57 / 20.2k | blind, Wind Dancer 3; CI reads ×0.97 |
| alkaizer-s-hc-martial-artist-monk-alkaizerx | melee | close | 48.6k | 21.6k | energy shield pool (CI, 19.1k); evade ×1.50; res ×1.46 | 19.1k (survives 0.18) | 0.75 / 36.5k | the largest energy shield of the 30 |
| alkaizer-s-ssfhc-melee-gemling-alkaizerx | melee | close | 44.2k | 4.8k | armour ×5.96; res ×1.96; armour on elemental ×1.79; Virtuous Barrier ×1.31 | 7.2k (survives 0.49) | 0.99 / 43.7k | 36.3k armour, 89% against the reference hit |
| 0-3-league-start-the-hollowed-one-detailed-league-start-guid | melee | close | 43.4k | 3.9k | evade ×4.40; energy shield ×3.08; res ×1.68; deflect ×1.50 | 4.5k (survives 0.77) | 0.56 / 16.5k | blind, Wind Dancer 3; under the band with all conditions |
| martial-artist-monk-build-league-starter-to-endgame | melee | close | 37.6k | 8.8k | energy shield pool (CI); evade ×2.40; res ×1.47; deflect ×1.21 | 7.9k (survives 0.44) | 0.63 / 19.6k | blinds the enemy |
| balrog-fire-bear-smith | melee | close | 36.3k | 5.3k | armour ×3.83; armour on elemental ×1.83; res ×1.57; physical as fire ×1.51 | 7.4k (survives 0.47) | 1.00 / 36.3k | 30% physical as fire; energy shield reads ×0.70 (open) |
| facebreakers-hollow-palm-martial-artist-league-starter | melee | close | 26.8k | 7.3k | energy shield ×3.56; evade ×2.40; res ×1.41 | 8.3k (survives 0.42) | 0.63 / 14.9k | blind; 15% damage from mana first; under the band with all conditions |
| woolie-wolfman | melee | close | 23.3k | 4.3k | armour ×3.03; energy shield ×2.03; res ×1.74; armour on elemental ×1.35 | 5.5k (survives 0.63) | 0.92 / 21.3k | Mind over Matter with no mana (Blood Magic) |
| bear-druid-build-league-starter-to-endgame | melee | close | 22.2k | 3.0k | armour ×4.71; res ×1.78; armour on elemental ×1.55 | 4.6k (survives 0.76) | 0.98 / 21.8k | 121% armour on elemental hits |
| martial-artist-league-starter-scorpius | melee | close | 19.6k | 5.6k | energy shield ×4.16; evade ×2.10; res ×1.43; deflect ×1.17 | 6.2k (survives 0.56) | 0.66 / 12.6k | under the band unlucky |
| coc-balls-invoker-ronarray | melee | close | 17.3k | 9.5k | energy shield pool (CI); res ×1.45; evade ×1.25 | 8.4k (survives 0.41) | 0.83 / 14.3k | under the band at base |
| naviras-fracturing-varashta-league-starter | minion | close | 16.5k | 11.0k | energy shield pool (CI); res ×1.46; companion ×1.11 | 9.7k (survives 0.36) | 0.97 / 16.0k | under the band at base; Romira's Requital |
| woolie-run-n-gun-witch-hunter | ranged attack | close | 205.7k (338.0k as published) | 21.7k (with the stand-in) | evade ×5.05; res ×1.97; Sorcery Ward ×1.96; deflect ×1.38 | 14.8k (survives 0.24) | – / 25.2k | corrected; Hyrri's Ire, blind, Wind Dancer 3 |
| explosive-witchhunter | ranged attack | close | 157.8k (309.1k as published) | 20.9k (with the stand-in) | evade ×4.21; res ×1.88; Sorcery Ward ×1.70; deflect ×1.61 | 11.6k (survives 0.30) | – / 20.7k | corrected; 95% deflect, over the cap |
| fubgun-flameblast-oil-grenade | caster | distance | 95.9k | 3.6k | armour ×9.50; armour on elemental ×2.30; evade ×1.90; res ×1.57 | 6.1k (survives 0.57) | 0.68 / 65.1k | 54.1k armour, 280% on elemental hits |
| plants-lich-deadrabb1t | caster | distance | 24.8k | 12.4k | energy shield ×7.98; res ×1.67; armour ×1.33 | 14.2k (survives 0.25) | 1.00 / 24.8k | 8.7k energy shield, no evasion |
| ignatius-spark-stormweaver | caster | distance | 19.1k | 5.6k | mana first ×4.13; res ×1.73; curses ×1.57; armour ×1.34 | 8.4k (survives 0.41) | 0.89 / 17.0k | Enfeeble; 0.60 without it |
| arc-gemling-path-of-ky | caster | distance | 16.9k | 7.0k | mana first ×14.66; res ×1.58; curses ×1.52 | 10.7k (survives 0.33) | 1.00 / 16.9k | Mind over Matter; Enfeeble, 0.50 without it |
| grim-totem-oracle-imexile | caster | distance | 14.2k | 5.9k | mana first ×11.24; res ×1.58; curses ×1.52 | 9.0k (survives 0.39) | 1.00 / 14.2k | Eldritch Battery ×1.72; Enfeeble, 0.59 without it |
| coc-spark-comet-recoup-infernalist-by-ignatius | caster | distance | 4.6k | 680 | armour ×4.14; res ×1.87; armour on elemental ×1.62; Runic Ward ×1.23 | 2.1k (**one-shot** 1.66) | 1.00 / 4.6k | life two-thirds reserved; fix: +342 energy shield |
| firebringer-league-start-woolie | melee | distance | 31.3k | 2.6k | armour ×4.80; res ×1.91; armour on elemental ×1.62; block ×1.60 | 3.9k (survives 0.88) | 0.77 / 24.0k | 50% block; Giant's Blood ×1.71 (open) |
| misoxshiru-glacial-lance-ritualist | melee | distance | 24.7k | 3.0k | evade ×3.06; res ×2.24; physical as lightning ×1.44; energy shield ×1.19 | 5.4k (survives 0.64) | 0.60 / 10.9k | 51% physical as lightning; under the band with all conditions |
| spirit-walker-beast-master | minion | distance | 12.9k | 2.0k | evade ×2.97; deflect ×1.39; res ×1.30; energy shield ×1.29 | 2.2k (**one-shot** 1.55) | 0.60 / 7.8k | companion share ×1.06; fix: +640 energy shield |
| ruetoo-tactician-mirage | ranged attack | distance | 28.9k | 6.7k | evade ×1.97; res ×1.77; armour ×1.29; mana first ×1.12 | 7.4k (survives 0.47) | 0.66 / 17.6k | Vaal Pact ×1.20 (open) |
| alkaizer-s-ssfhc-tactician-mercenary-alkaizerx | ranged attack | distance | 27.2k | 3.1k | armour ×4.62; res ×1.88; armour on elemental ×1.61; deflect ×1.20 | 4.4k (survives 0.79) | 1.00 / 27.2k | deflection from armour; Glancing Blows |
| twister-gemling-legionnaire | ranged attack | distance | 18.1k | 4.7k | energy shield ×2.49; evade ×2.17; res ×1.45; Virtuous Barrier ×1.37 | 5.2k (survives 0.67) | 0.56 / 8.8k | 20% block ×1.20; under the band unlucky |
| twister-spirit-walker-snoobae | ranged attack | distance | 18.0k | 4.6k | evade ×2.46; energy shield ×2.29; res ×1.49 | 5.0k (survives 0.70) | 0.63 / 8.3k | deflect ×1.05 as measured, about ×1.09 (see Open); hit recently ×0.77 |
| animeprincess-twister-gemling-league-starter | ranged attack | distance | 17.9k | 3.0k | evade ×2.04; Virtuous Barrier ×1.68; res ×1.66; deflect ×1.55 | 3.5k (**one-shot** 1.01) | 0.66 / 11.8k | within the band and one-shot; fix: +30 life |
| lazyexile-amazon-league-starter | ranged attack | distance | 7.7k | 2.2k | evade ×1.90; res ×1.63 | 2.3k (**one-shot** 1.50) | 0.68 / 5.2k | fix: +1.1k life or energy shield |
