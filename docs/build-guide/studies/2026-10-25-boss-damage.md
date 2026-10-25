# Boss damage in published league starters (2026-10-25)

**Why.** Amendment 11 sets toughness targets from published builds (`2026-10-25-toughness-floors.md`). The user asked
whether damage should have a floor too, and chose to study boss damage first: "use the guide text to figure out which
skills and settings to use to get a realistic number. I want to see what the report says before I make any decisions
about how and what to measure." This study measures and explains; it decides nothing.

**The builds.** The 30 level-90+ builds of the toughness study, from the private reference library of Mobalytics'
verified league-starter guides. Guides are cited by page slug; quotes are short.

**The method** (one agent per five or six builds, after a three-build pilot; about 2.5M agent tokens in all):
1. **Read the guide** for how the build kills bosses: the variant matching the PoB file's tree, its gem list and
   notes, any boss or rotation text, and the video transcript by search.
2. **Configure honestly:** load the file, reset every config option it sets to PoB's default, set a Pinnacle boss,
   then set only the conditions the guide justifies (curses, exposure, ailments, charges, buffs, Rage, stacks), each
   with its quote. Creators' custom modifiers are cleared and reported only as sensitivity lines.
3. **Measure** each boss skill's damage figure by the repo's Count rule (`TotalDPS + TotalDot + IgniteDPS + BleedDPS +
   PoisonDPS`, a minion's `MinionTotalDPS`); sum only skills the guide runs together whose PoB rate is defensible,
   never a spell a meta gem triggers (PoB rates it at its hand-cast speed). Also measure **as saved**, under the
   file's own config.
4. **Judge** whether PoB can read the build's boss damage faithfully (`yes`, `partly`, `no`), note the creator's own
   figure where the guide states one, and the build's **engagement**: whether it deals its damage standing close to
   the enemies or from a distance (the user: "it's not so much the skill as how close the character has to be to the
   monsters").

"Figure" below is the rotation's sum when the guide gives one, else the largest single boss skill.

## Results

| Build | Class / ascendancy | Engagement | PoB reads it | Boss damage, realistic | As saved | Ratio | Figure | Judgment | EHP |
|---|---|---|---|---|---|---|---|---|---|
| 0-3-league-start-the-hollowed-one-detailed-league-start-guide-to-endgame-ignatius | Huntress / Amazon | close | no | 236.16M | 576.48M | 2.44× | largest single: Falling Thunder, projectiles | medium | 43k |
| twister-spirit-walker-snoobae | Huntress / Spirit Walker | distance | no | 413k | 806k | 1.95× | largest single: Twister | high | 18k |
| skadoosh-decompose-pathfinder | Ranger / Pathfinder | close | no | 278k | 2.47M | 8.88× | largest single: Decompose poison cloud | high | 20k |
| twister-gemling-legionnaire | Mercenary / Gemling Legionnaire | distance | no | 216k | 268k | 1.24× | largest single: Twister | high | 18k |
| firebringer-league-start-woolie | Warrior / Warbringer | distance | no | 182k | 396k | 2.17× | sum: Shockwave Slam (one totem) + Forge Hammer impact | high | 31k |
| spirit-walker-beast-master | Huntress / Spirit Walker | distance | no | 150k | 136k | 0.91× | sum: Main companion (the file's Antlion Charger) + Diretusk Boar (rare tame) + Wild Bear Spirit (Wild Protector) + Skeletal Reaver + Skeletal Sniper | high | 13k |
| ignatius-spark-stormweaver | Sorceress / Stormweaver | distance | no | 100k | 44k | 0.44× | largest single: Living Bomb (Cast on Elemental Ailment) | high | 19k |
| balrog-fire-bear-smith | Warrior / Smith of Kitava | close | no | 55k | 20k | 0.36× | largest single: Molten Crash slam | high | 36k |
| naviras-fracturing-varashta-league-starter | Sorceress / Disciple of Varashta | close | no | 7k | 3k | 0.50× | sum: Kelari's Deception + Kelari's Deception clone explosion | medium | 17k |
| ronarray-unarmed-hollow-palm-monk | Monk / Martial Artist | close | partly | 25.44M | 64.24M | 2.53× | largest single: Falling Thunder, projectiles | medium | 52k |
| fubgun-flameblast-oil-grenade | Mercenary / Gemling Legionnaire | distance | partly | 12.72M | 12.72M | 1.00× | sum: Flameblast | low | 96k |
| ruetoo-tactician-mirage | Mercenary / Tactician | distance | partly | 5.67M | 11.42M | 2.01× | sum: Galvanic Shards (fragments) + Galvanic Shards (beam) | high | 29k |
| coc-spark-comet-recoup-infernalist-by-ignatius | Witch / Infernalist | distance | partly | 2.42M | 5.18M | 2.14× | largest single: Comet (Cast on Critical), fire-infused | high | 5k |
| woolie-run-n-gun-witch-hunter | Mercenary / Witchhunter | close | partly | 1.54M | 2.07M | 1.35× | sum: Stormblast Bolts, explosion + Stormblast Bolts, impact | low | 338k |
| coc-balls-invoker-ronarray | Monk / Invoker | close | partly | 1.23M | 557k | 0.45× | largest single: Flicker Strike | medium | 17k |
| grim-totem-oracle-imexile | Druid / Oracle | distance | partly | 1.14M | 1.46M | 1.29× | sum: Grim Pillars (eruption) + Grim Pillars (explosion) | medium | 14k |
| facebreakers-hollow-palm-martial-artist-league-starter | Monk / Martial Artist | close | partly | 695k | 1.68M | 2.41× | sum: Flicker Strike + Hollow Resonance | medium | 27k |
| alkaizer-s-ssfhc-melee-gemling-alkaizerx | Mercenary / Gemling Legionnaire | close | partly | 646k | 655k | 1.01× | largest single: Perfect Strike (perfect timing) | medium | 44k |
| animeprincess-twister-gemling-league-starter | Mercenary / Gemling Legionnaire | distance | partly | 544k | 1.19M | 2.18× | largest single: Twister | high | 18k |
| plants-lich-deadrabb1t | Witch / Abyssal Lich | distance | partly | 464k | 154k | 0.33× | sum: Bonestorm projectile + Bonestorm explosion | medium | 25k |
| woolie-wolfman | Druid / Oracle | close | partly | 421k | 767k | 1.82× | sum: Shred (normal strikes) + Ice Fragments + Moonbeam (Lunar Blessing) | medium | 23k |
| misoxshiru-glacial-lance-ritualist | Huntress / Ritualist | distance | partly | 291k | 637k | 2.19× | sum: Glacial Lance + Glacial Lance fragment explosion | medium | 25k |
| explosive-witchhunter | Mercenary / Witchhunter | close | partly | 228k | 4.49M | 19.70× | largest single: Explosive Grenade | medium | 309k |
| bear-druid-build-league-starter-to-endgame | Druid / Shaman | close | partly | 217k | 288k | 1.33× | largest single: Maul | medium | 22k |
| alkaizer-s-hc-martial-artist-monk-alkaizerx | Monk / Martial Artist | close | partly | 100k | 97k | 0.97× | largest single: Quarterstaff Strike | high | 49k |
| martial-artist-league-starter-scorpius | Monk / Martial Artist | close | partly | 50k | 42k | 0.84× | sum: Whirling Assault + Hollow Resonance + Charged Shockwave | medium | 20k |
| lazyexile-amazon-league-starter | Huntress / Amazon | distance | partly | 10k | 10k | 1.00× | sum: Storm Lance (throw) + Storm Lance (lodged spear bolts) | high | 8k |
| alkaizer-s-ssfhc-tactician-mercenary-alkaizerx | Mercenary / Tactician | distance | partly | 5k | 5k | 1.00× | sum: Cluster Grenade primary + Cluster Grenade mini grenades | high | 27k |
| arc-gemling-path-of-ky | Mercenary / Gemling Legionnaire | distance | yes | 23.60M | 44.27M | 1.88× | sum: Arc (Spell Totem) + Frost Bomb | medium | 17k |
| martial-artist-monk-build-league-starter-to-endgame | Monk / Martial Artist | close | yes | 875k | 1.43M | 1.63× | sum: Whirling Assault + Hollow Resonance + Charged Shockwave | medium | 38k |

## What the study shows

- **PoB reads 2 of 30 builds' boss damage faithfully, 19 partly and 9 not at all.** The two it reads are a totem
  Arc Gemling (hits PoB models) and a Whirling Assault Martial Artist.
- **The realistic figures span five orders of magnitude**, from 5k (a self-found Tactician whose guide is five lines)
  to 25M on one Falling Thunder slam, and 236M for a retired 0.3 build whose file counts 21 projectiles. Among the
  builds PoB reads at least partly the median is about 0.5M. No floor separates good builds from weak ones here: the
  low figures are mostly builds whose damage PoB can't see.
- **Creators' files inflate more often than not.** As saved ÷ realistic: median 1.34×, quartiles 0.98× and 2.16×; 18
  of 30 read more than 10% higher as saved, 6 lower (files that set nothing, so the guide's conditions raised them),
  and one 19.7× (a grenade Witchhunter whose custom modifiers add "3x grenades hitting"). Dazed, Isolated, full life
  and unquoted shock are the common silent boosts; custom modifiers are how creators patch what PoB misses.
- **Creators state a figure in 13 of 30 guides**, mostly tooltip or in-game hits from other gear states. Where PoB
  models the skill they agree (DEADRABB1T's Entangle: 154k against the creator's 151k); where it doesn't, PoB reads
  far lower (Ignatius's Spark Stormweaver: Comet hits of 3–4M in game, about 50k in PoB; Woolie's Firebringer: "~1m
  dps" against 182k).

## What PoB can't read

Grouped from the 30 builds' notes; each is a reason a design built on these mechanics reads low in our own pipeline.
- **Trigger and proc rates:** spells Cast on Critical and Cast on Elemental Ailment trigger (rated at hand-cast
  speed); steps per metre walked (Ancestral Cry, Volcanic Steps, Stomping Ground); fissure procs up to 5 a second
  (Forge Hammer); meteors every 0.15 s (Walking Calamity); bells struck by other skills (Tempest Bell, Hollow Focus);
  Falling Thunder at attack speed instead of per charge cycle; Perfect Strike timed by its release alone; Flicker
  Strike's chain against Excise's cooldown.
- **Counts:** totems (PoB rates one of four), pillars per cast, grenades per throw, Cluster Grenade's mini grenades,
  projectiles per power charge, lodged spears, Barrage's repeats.
- **Buffs with no stat map:** Elemental Armament III, Bhatair's Vengeance, Walking Calamity's gain as fire, Mana
  Tempest's gain as lightning, Rend's gain as lightning, the Unbound and Empowered options (no effect).
- **Supports PoB drops** from skill groups a passive or item grants (Navira's Kelari loses Bidding II, Muster, Heft).
- **Other:** Decompose's share of a consumed corpse's life (not tied to the build's spectres); Plague Bearer's
  stored poison; Oil Grenade's added ignite; old trees (0_2, 0_3, 0_4) and legacy gems in older files.

## For the decision

- A boss-damage floor on PoB's figure would mostly flag builds for what PoB can't read, not for weak damage.
- Where PoB does read a build, the design already shows its boss figure beside the map figure (amendment 11 §5).
- The mechanics above belong in the design's "what PoB can't measure" lines and, where they recur, in the PoB gap list
  (`../pob-gaps.md`), so a design built on them says so rather than reading weak.
