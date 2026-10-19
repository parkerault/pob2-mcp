# Mobalytics review 9: LexD's Shield Wall + Avatar of Fire Smith of Kitava

An agent's study (2026-10-18), cited as `[mob-shield-wall]`; brief: `briefs/2026-10-18-mobalytics-review.md`,
guide 9 (gap: shields and block), from the page text saved that day. "Lookup" is a pob2 lookup or coverage check;
`pin:` paths are under `vendor/PathOfBuilding-PoE2/src/` (0.5.4). Unmarked claims are the guide's.

## 1. Header

- **Guide:** "0.5.5 Shield Wall + Avatar of Fire Smith of Kitava Build" by LexD,
  https://mobalytics.gg/poe-2/builds/avatar-of-fire-smith-of-kitava-lexd, Creator tab; 783 favourites at capture
  (787 in the brief); patch 0.5.5; updated 2026-10-14; tagged Starter, End Game, HC, SSF.
- **Tabs, in order:** Act 1 → Act 2 → Act 3 → Act 4 → Interludes → Mapping Start (Tiers 1–5, SSF Friendly) →
  Mapping Endgame (5–10, SSF Friendly) → Mapping Endgame (10–15) → Nebuloch + Constricting Command Lategame →
  Nebuloch + Constricting Command Optimized → Thrillsteel Version.
- **Not captured:** affixes (hover only), the tree, the video, the PoB code. **The five tabs after Mapping Start have
  no prose**, only item, gem and priority widgets, so the endgame reasoning is in the Build Overview and Mapping
  Start. The tree counter (points left of 123) goes negative from Mapping Endgame on (−10 to −21), so its total
  misses some point source. Gem levels and Set 1 / Set 2 labels appear only from Mapping Start. "Guiding Palm of
  the Heart" (a set-1 main hand) is in neither the pin's bases nor its uniques.

## 2. What the build is

- **Damage source: Shield Wall,** a shield attack raising a wall whose segments explode when shattered: the off
  hand's base damage plus 5–7 physical per 15 shield armour, 100% more when your own skills shatter it, 80% less if
  something else breaks it within 0.5 s. Slams, warcries and Shield Charge shatter it at once; two walls, 6 s each
  (lookup, checked).
- **Detonator: Fortifying Cry,** a warcry granting Guard (a short damage-absorbing buffer) that Triggers Shield Wave
  when later shield attacks deal damage, one per 5 enemy Power (nearby monsters weighted by rarity). Shield Wave
  also adds 5–7 physical per 15 shield armour and counts as Empowered (lookup, checked). Infernal Cry goes first,
  empowering the next melee attacks (pin: `Data/Skills/act_str.lua`).
- **Boss order:** Resonating Shield to break armour, full Rage, Sunder, then Infernal Cry → Shield Wall → Fortifying
  Cry, repeating the last two. While the cry recovers, Resonating Shield taps fire stocked Shield Waves, which the
  guide says break later walls (unverified).
- **Avatar of Fire** (75% of damage converted to fire, no non-fire damage; checked) makes the hit fire, so ignite
  carries bosses. It comes after The Molten One's Gift, which makes Fully Broken Armour (the debuff on an enemy whose
  armour is fully broken) raise fire damage taken from hits, offsetting the 25% the keystone discards.
- **Smith of Kitava is the defence.** Its notables are granted through the body armour; Smith's Masterwork allows
  only a normal-rarity one, +200 armour per connected notable (lookup, checked). Its only damage is two 20% small
  nodes.
- **Packs:** Boneshatter on stun-primed packs in the campaign; Shield Wall with Fortifying Cry from Mapping Start;
  Ahn's Citadel and Kaom's Madness on Shield Wall from Mapping Endgame, credited with easy 200% Delirium and juiced
  Grand Expeditions.
- **Feel:** very tanky, cheap to resist-cap, not zoomy. Ignite is only "serviceable" on bosses, and his bleed build
  now does more damage after a nerf to Fortifying Cry hitting Shield Wall.

## 3. The kit

- **Weapon and off hand:** a one-hand mace and a high-armour tower shield locked to both weapon sets (the most-asked
  point, stated three times). Two maces sit on set 2 for dual-wield Mace Strike and Boneshatter until Act 4.
  Endgame: Tawhoan Tower Shield (pin: 264 armour, 26% block, grants Raise Shield; `Data/Bases/shield.lua`); Nebuloch
  on set 2 (unique lookup: adds physical and chaos, +20–30% critical damage bonus, attacks consume an Endurance Charge
  to crit, you take 100 chaos damage per second per Endurance Charge); on set 1, Sacred Flame in Lategame and
  Thrillsteel (pin, `Data/Uniques/sceptre.lua`: grants Purity of Fire, 40–60% of damage as extra fire) or a Molten
  Hammer in Optimized.
- **Shield Wall's supports:** Mapping Start: Fire Attunement, Fire Penetration II, Rapid Attacks II, Elemental
  Armament II. Mapping Endgame: Ahn's Citadel, Kaom's Madness, Supercritical, Fire Attunement, Fire Penetration II;
  Lategame and Thrillsteel take Scouring Flame (pin: more ignite damage for a Runic Ward cost) for Fire Penetration.
  Optimized drops both lineage gems for Elemental Armament II and Rakiata's Flow, unexplained.
  - Ahn's Citadel builds the wall along a fissure, adding the type Kaom's Madness needs: 3 more fissures at 20% less
    damage, 20% less skill speed, 30% less area (lookup, checked).
  - Fire Attunement adds fire as extra, not by conversion (pin: `Data/Skills/sup_str.lua`), so it doesn't recover
    Avatar's lost 25%.
- **Other skills:** Fortifying Cry and Infernal Cry with Raging Cry and Enraged Warcry II; Resonating Shield with Rage
  III, Armour Demolisher II, Armour Break III; Shield Charge to move; Raise Shield with Ignite III and Steadfast II;
  Magma Barrier with Charge Profusion II for Endurance Charges; Sunder on bosses for its debuff only. Spirit: Purity of
  Fire, Herald of Ash, Berserk, Scavenged Plating, later Sniper's Mark; no reservation figures.
- **Uniques and when:** the lineage gems and Nebuloch at Mapping Endgame (5–10); Constricting Command (pin,
  `Data/Uniques/helmet.lua`: life, attributes, regeneration, fewer enemies needed for Surrounded) at 10–15; Sacred
  Flame in Lategame; Mageblood only in Optimized.
- **Ascendancy order** (checked against the node list): Coal Stoker on ascending in Act 2 (fire resistance mods also
  grant cold and lightning at 50%); Kitavan Engraving (15% increased maximum life) and Leather Bindings (3% life
  regeneration per second) with points 3–6, before Blood Magic; Heatproofing (unaffected by damaging ailments) and
  Dedication to Kitava (+100% of armour also applies to chaos) by the mapping tabs. The first three are must-haves.
- **Tree:** Strength stacking; one-handed notables early (Brutal, Smash, Impair, Reaving); then warcries (Vocal
  Empowerment: warcries empower an extra attack; Cacophony: 40% warcry damage, 25% warcry area), armour break (Pile
  On, The Molten One's Gift) and Avatar of Fire. Weapon-set points from Act 4: set 1 clear and area, set 2 boss
  ignite (Battle Trance, Ignore Pain, Fulmination). Later In Your Face (40% melee hit damage at close range),
  Greatest Defence (4% increased attack damage per 75 shield armour and evasion), Blood Magic, and Engineered Blaze
  near level 70. Quoted node lines checked (coverage).

## 4. The levers

In the guide's order:

1. **Shield armour.** The shield leads nearly every tab's priority list and is "your main damage-dealer" in maps:
   about 350 armour in Act 3, 800–900 for early maps. It pays three times: Shield Wall's and Shield Wave's damage
   per 15 armour, and Greatest Defence (checked).
2. **The mace's two rolls:** +melee levels (+4 at most, +3 will do) and increased elemental damage with attacks,
   which after Avatar he rates above +2 levels; physical rolls stop mattering.
3. **Fire resistance:** Fire Exposure, then Fire Penetration II in every hard hitter (fire-resistant monsters are
   the clunky spot), Rakiata's Flow in Optimized.
4. **Debuffs and burst:** Fully Broken Armour from Resonating Shield. PoB gives it 20% increased physical damage taken
   from hits, scaled by its effect, so the gift's 15% makes 23% and its flag adds fire (pin:
   `Modules/CalcPerform.lua:721`). Full Rage; Infernal Cry before every wall; Sunder, said to add another 20% fire
   damage taken, though its text raises physical damage taken (pin: `Data/Skills/act_str.lua:18628`), so the fire
   claim is unverified.
5. **Speed:** attack speed on gloves ahead of +2 melee gloves early; skill speed to pay for Kaom's Madness.
6. **Late crit and ignite:** Nebuloch, Supercritical, Scouring Flame, set 2's ignite points.

**Skippable, it says:** the Act 3 Trial of Chaos (a normal body armour with two Smith bonuses loses to a rare); a
pricey +4 mace; damaging-ailment charms; a perfect chaos cap (Dedication to Kitava).

## 5. Leveling

- **Act 1:** Mace Strike and Boneshatter bound to set 2's two maces; Raise Shield with Brink I, whose bash after a
  block primes most non-unique enemies for stun in one hit. Maces first, the shield a bonus, a Storm Rune to shock
  bosses.
- **Act 2:** Resonating Shield primes, dual-wield Boneshatter clears, Leap Slam travels. Shield Wall arrives, but with
  only Infernal Cry to detonate it the maces stay the damage. Coal Stoker.
- **Act 3:** Fortifying Cry arrives as the boss detonator. Enduring Impact I and Magma Barrier with Charge Profusion
  I bank Endurance Charges, so one Infernal Cry allows three or four wall-and-cry rounds. Supports are scarce.
- **Act 4:** Avatar of Fire after the gift; dual wield goes, the shield goes on both sets, weapon-set points begin.
  Fire Exposure on Shield Wall, Enraged Warcry I for the cooldown, Sunder for bosses.
- **Interludes:** Boneshatter clears until Engineered Blaze; Fire Penetration II replaces Fire Exposure; Lifetap for
  mana; the level-60 Trial of Sekhemas for points 5–6, then Blood Magic.
- **Swap points:** Shield Wall is the boss button from Act 3, the clear from Mapping Start, and gets the fissure
  supports at Mapping Endgame. Support attributes climb from 35 Strength (Act 1) to 165 Strength, 50 Dexterity, 40
  Intelligence (Optimized).

## 6. Gear and budget

- **Trade, first:** cheap fire-resistance gear to cap resistances through Coal Stoker; chaos resistance on belt,
  helmet and boots.
- **Mapping Start order:** shield (800–900 armour), mace, helmet, Ruby Rings, amulet, body, gloves, belt, boots;
  Thawing, Stone and Silver charms.
- **Later:** Nebuloch and a Runeforged Ornate Plate at Mapping Endgame; Constricting Command at 10–15; Mageblood in
  Optimized.
- **Budget:** no currency figures; the dear pieces named are a +4 mace, +2 melee gloves and Mageblood.

## 7. Defences

- **Layers:** armour (Smith's Masterwork, Scavenged Plating, the Act 4 quest's 30% defences), the ascendancy's life
  and regeneration, ailment immunity, armour against chaos, Guard, Blood Magic's life pool, block.
- **Block is a defence here, not the damage:** the tower shield's 26%; Resonating Shield blocks every blockable hit
  while channelled, Raise Shield while raised (pin: `Data/Skills/act_str.lua:15835`, `Data/Skills/other.lua:13506`).
  The only block-to-damage link is Raise Shield's campaign bash. No block figure is given.
- **Stun:** Ignore Pain with Battle Trance, Steadfast on Raise Shield (blocking too much while raised can heavy-stun
  you, pin), a Stone Charm.
- **Numbers:** 75% chaos resistance as the aim; nothing on life, armour, block or maximum hit.
- **Unmentioned:** Nebuloch's self-damage per Endurance Charge, while Magma Barrier keeps charges up.

## 8. What players pick

No popularity data; every "standard" is the author's word:
- the Avatar of Fire shield warrior, made on every Warrior ascendancy, this one the tankiest on a budget;
- Ahn's Citadel with Kaom's Madness as "the classic" Shield Wall clear;
- Fortifying Cry still the best detonator after the nerf;
- Raise Shield's bash with Brink I as the best Boneshatter primer for shield warriors;
- Warbringer to level, then a respec to Smith, as the faster route;
- two versions dropped after nerfs: a Fortifying Cry and Resonating Shield clear, and a Blackflame chaos ignite.

## 9. For the library

**Kit lines** for a proposed "Shields" entry under Standard kits:

- **Kit:** (thin: one guide) a high-armour tower shield locked to both weapon sets and a one-hand mace with +melee
  levels; Shield Wall placed, Fortifying Cry to shatter it, Infernal Cry first to empower it [mob-shield-wall] §2,
  §3. Checked: Shield Wall's text names warcries, slams and Shield Charge as its shatterers (lookup).
- **Levers:** shield armour first: Shield Wall and Shield Wave add 5–7 physical per 15 shield armour, Greatest
  Defence 4% increased attack damage per 75 shield armour and evasion; the guide aims at about 350 armour in Act 3,
  800–900 in early maps [mob-shield-wall] §4. Numbers checked; targets the guide's.
- **Detonation:** a wall your own skill shatters deals 100% more, one enemies break inside 0.5 s 80% less; the cry's
  cooldown is bypassed with an Endurance Charge or Rage (Enraged Warcry II, pin: `Data/Skills/sup_str.lua`)
  [mob-shield-wall] §2, §3. Checked.
- **Clear:** Ahn's Citadel puts the wall on a fissure, so Kaom's Madness adds 3 fissures at 20% less damage, 20% less
  skill speed, 30% less area; buy skill speed [mob-shield-wall] §3. Gem lines checked; the clear is the guide's.
- **Fire:** Avatar of Fire only after The Molten One's Gift, so Fully Broken Armour's 20% increased damage taken from
  hits carries over to fire [mob-shield-wall] §2, §4. Checked (pin `Modules/CalcPerform.lua:721`).
- **Block:** a defence, not the damage: a tower shield's 26% (Tawhoan), full block while Resonating Shield is
  channelled or Raise Shield raised; in the campaign, Raise Shield's bash with Brink I primes stun [mob-shield-wall]
  §5, §7. Checked (pin).
- **Smith pairing:** the ascendancy is the defence (life, regeneration, ailment immunity, armour against chaos,
  through a normal body armour); Coal Stoker caps resistances from fire alone [mob-shield-wall] §3, §7. Checked.
- **Bosses:** weapon set 2's passive points on ignite, with Nebuloch (Endurance Charges spent for certain crits) and
  Supercritical [mob-shield-wall] §3. Item text checked; its worth is the guide's.

**Pattern shapes:**

- **Placed detonator** (existing): a second example, a warcry detonating; the Resonating Shield fallback is
  unverified.
- **Damage-source substitution** (existing): Shield Wall and Shield Wave read shield armour; coverage shows that line
  fully parsed on both, so the entry's "not established" can become modelled (checked).
- **Defence that scales damage** (existing): Greatest Defence, fully parsed (checked).
- **Type-granting support unlock** (existing): Ahn's Citadel unlocks Kaom's Madness on Shield Wall (checked).
- **Pivot and broadcast bridges** (existing): The Molten One's Gift carries the armour-break investment across the
  Avatar of Fire pivot, so the gift comes first; Coal Stoker again (checked).
- **Weapon set 2 job** (existing): set 2's passive points as a boss tree, the shield on both sets (how PoB splits
  set points is not established).
- **Burst-window stacking** (existing): Rage, Fully Broken Armour, Sunder, Infernal Cry, then wall and cry
  (Sunder's share unverified).
- **Cost redirection** (existing): Lifetap, then Blood Magic on the ascendancy's regeneration (unverified).
- **Payoff thief** (existing), a caution: Nebuloch's crits and the cries' cooldown bypass spend the same Endurance
  Charges; Enraged Warcry II may move the bypass onto Rage. This study's inference (unverified).
- **New: a charge spent for a certain crit** (Nebuloch), fed by charge generators (unverified in PoB).

**What PoB might not model** (coverage):

- Shield Wall's 100% more when your skill shatters it, the 80% less and the wall limit are "possibly unmodelled;
  check config": PoB may leave out the doubling the build relies on (a config stand-in is unverified).
- Fortifying Cry's Shield Waves and Guard per 5 enemy Power: possibly unmodelled.
- Ahn's Citadel's fissure and Kaom's 3 extra fissures are possibly unmodelled, while Kaom's penalties are fully
  parsed: PoB charges the cost without the gain.
- Smith's Masterwork's normal-body-armour rule is unparsed (a restriction, no stat).
- Fully parsed: The Molten One's Gift, Avatar of Fire, Greatest Defence, In Your Face, Heatproofing, Dedication to
  Kitava, Vocal Empowerment, Cacophony.
- Not checked: Nebuloch's charge-for-crit, Sundered Armour on fire, Sacred Flame's lines, per-set passive points.
