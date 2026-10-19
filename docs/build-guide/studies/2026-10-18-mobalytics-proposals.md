# Mobalytics review: proposed pattern-library changes (2026-10-18)

For the user's approval (C-53); nothing is in `patterns.md` yet. Each proposal reads as it would in the library,
marked **checked** (a lookup at the pin confirmed it) or **unverified**. Nine lookups (pin 0.5.4) settled lines.

## 1. Summary

- Every kit gains common-practice lines; Crossbows, Spears and Totems get a popular kit beside their off-meta one.
- New kits: Shapeshifting (two studies), Plants (with [oracle]), Companions, Shields and Automated loops (one guide
  each). Grenades join Crossbows; ballistas join Totems.
- Two new entries and ten field updates, chiefly a wider Weapon set 2 job: all 17 guides use set 2.
- The studies contradict the library on Herald triggers, the minion focus, the totem order and Fresh Clip II; guides
  contradict the pin on Danse Macabre, Fury of the Mountain, Excise with Garukhan's Resolve and Gem Studded.
- Fourteen PoB gaps, chiefly Herald of Ice's explosion, Lunar Blessing, Shield Wall's doubling, Contagion's ramp
  and plant Overgrowth.

## 2. Kit changes

### Minions

**M1** replace "**Kit:** a sceptre, lots of Spirit…" · *checked*
- **Kit:** a sceptre, lots of Spirit and more minion types [comparison] §7.2 (1); both Infernalist guides keep a
  Rattling Sceptre (100 Spirit, its own Skeletal Warrior) all game and carry a shield for block, not a focus
  [mob-mattjestic] §3; [mob-thyworm] §3. "Sceptres and lots of Spirit" is a minion player's first thought (the
  user, [amendment-8] §1).

**M2** replace "**Levers:** minion levels, Spirit…" · *unverified* (one guide's order)
- **Levers:** minion levels (they set minion flat damage), increased minion damage, more multipliers (Muster,
  Feeding Frenzy II), enemy-side debuffs, then more minions through Spirit [mob-thyworm] §4; the same four as
  [comparison] §7.2 (4).

**M3** append to "**Spirit:** a sceptre's base 100…" · *checked*; the 600 is one guide's arithmetic
- … Both Infernalist guides add Enfolding Dawn (+100 Spirit) and Bones of Ullr (20–30% reservation efficiency for
  undead minions) (pin), and Beidat's Will [mob-mattjestic] §3; [mob-thyworm] §3; an eight-type zoo reserves about
  600 base Spirit, more than visible gear gives [mob-mattjestic] §6.

**M4** add after Types · *checked* for thyworm's monsters; Mattjestic's *unverified*
- **Spectres:** picked for the monster's skill, whose tags decide which supports apply: a Vaal Guard grenadier at
  Act 3 (50 Spirit), then a Powered Zealot casting Spark (55) with Wildshards II and Pierce III [mob-thyworm] §3, §5
  (pin: `Data/Spectres.lua`); a melee spectre with Minion Splash II in the other guide [mob-mattjestic] §3. The
  guides differ on the monster; both give it Feeding Frenzy and Muster.

**M5** add · *checked* (the lookup settles the two studies)
- **Offering:** Pain Offering with Danse Macabre (30% more damage, 30% increased buff effect, pin) in three guides
  [mob-mattjestic] §3; [mob-thyworm] §3; [mob-beastmaster] §3; two feed it Skeletal Warriors with Sacrificial Lamb,
  which makes your skills target that skill's minions within 6 metres first (pin).

**M6** replace "**Survival:** when the damage or a buff…" · *checked*
- **Survival:** Loyalty on a damageable companion (the Infernal Hound, a tamed beast) takes 10% of your hit damage
  first, in three guides [mob-mattjestic] §7; [mob-thyworm] §7; [mob-beastmaster] §7; when the damage or
  a buff lives on the minions, cap their resistances first [chayula-minions] §2 (6), §6.

**M7** add · *checked* (gem text); the gas ignition *unverified*
- **Campaign:** both Infernalists pair a fire minion with Flame Wall: Raging Spirits, which your fire casts summon
  [mob-mattjestic] §2, §5, or the Skeletal Sniper's Gas Arrow, ignited by the wall [mob-thyworm] §2, §5.

**M8** remove "**A tamed beast** reserves a percentage…": it moves to Companions (C3).

### Companions (tamed beasts), new

**C1** add · *checked* (node, bear, crit); two tames at once is the tabs' reading
- **Kit:** (thin: one study) a Spirit Walker with The Natural Order tames a unique beast, Mighty Silverfist from
  Act 3 (25% base crit, pin), beside a rare tame kept for its modifier and the Bear Spirit, outside the companion
  limit [mob-beastmaster] §2, §3.

**C2** add · *checked* against `data/monsters/monster-mods.md`
- **Rare tame's modifier:** Haste Aura first (20% attack and cast speed, 10% movement speed to allies within 5
  metres), not Hasted, which speeds the beast alone; then a shock trail or a defensive aura [mob-beastmaster] §5, §8.

**C3** add (Minions' line, moved and extended) · *checked*
- **Spirit:** a tame reserves 13.8–56.1% of maximum Spirit (32.7% at the median), not a flat amount (the user,
  [amendment-8] §4; pin: `Modules/CalcDefence.lua:204`); two tames take 78–90%, and reservation efficiency cuts
  the percentage (Idol of Ralakesh, Idolatry); Sylvan's Effigy allows several types (pin) [mob-beastmaster] §3, §7.

**C4** add · *checked*
- **Levers:** companion damage and attack speed, minion levels, and a high-physical main hand for The Catha's
  Balance (companions gain 60% of its damage, pin) [mob-beastmaster] §4.

### Spells

**S1** replace "**Levers:** spell levels…" · *unverified* (the guides' order)
- **Levers:** spell levels first [enervating] chain 1; [mob-ed-lich] §4 (wand, focus, amulet); copies and repeats
  (Spell Cascade, mimics, Now and Again) [enervating] chain 5; spell crit [widowhail] §2 (5); maximum mana for
  Archmage [mana-flare] chain 2, about 5k in [mob-arc-totems] §2.

**S2** add · *checked* (the staff's implicit); set-2 curses *unverified*
- **Weapon set 2:** a Chiming Staff's Sigil of Power (spell damage in its area, growing with mana spent there, pin)
  in four guides [mob-plants] §3; [mob-ed-lich] §3; [mob-mattjestic] §3; [oracle] chain 4–6; curses and exposure
  cast from set 2 [mob-ed-lich] §3; [mob-arc-totems] §2.

**S3** replace "**Curses:** Temporal Chains on Blasphemy…" · *unverified*
- **Curses:** Temporal Chains on Blasphemy in four more guides [mob-ed-lich] §3; [mob-arc-totems] §7;
  [mob-invoker] §8; [mob-plants] §6; [enervating] chain 2; [fangs] arc (46:16); Elemental Weakness for elemental
  hits [mob-arc-totems] §3; [mob-thyworm] §3.

**S4** replace "**Crit:** Cast on Critical into Arc…" · *checked*; rates *unverified*
- **Crit:** Cast on Critical into Arc "is standard" [widowhail] §3; two later guides fire it for what the spell
  makes: Thunderstorm's wet for Overgrowth [mob-plants] §3, Profane Ritual's Power Charges [mob-invoker] §3;
  Pinpoint Critical trades crit bonus for chance [enervating] chain 6.

### Attacks, any weapon

**A1** replace "**Kit:** Herald of Ice and Herald of Thunder…" · *checked* (gem lookups)
- **Kit:** a Herald to clear, in nine of eleven attack guides at endgame: Herald of Ice explodes enemies a
  non-Herald attack shatters [mob-bear] §3; [mob-wolfman] §3; [mob-glacial-lance] §3; Herald of Thunder strikes
  your next attacks' targets after an attack kills a shocked enemy [mob-witchhunter] §3; [mob-spear-amazon] §3;
  [flicker] §2; Herald of Ash [mob-shield-wall] §3; [mob-grenades] §3; [mob-invoker] §3. Trinity and Wind Dancer as
  now [ronarray-videos] §1.

**A2** add · *checked*; 100 Spirit is one guide's figure
- **Rage:** Eternal Rage (5 Rage a second, active in both weapon sets, pin; 100 Spirit) in five guides
  [mob-spear-amazon] §3; [mob-witchhunter] §3; [mob-ballista] §3; [mob-wolfman] §3; [mob-glacial-lance] §3, with
  Berserk at about 114–230 Spirit [mob-ballista] §3; [mob-witchhunter] §6.

**A3** append to "**Levers:** attack speed…" · *unverified*
- … flat added damage on the weapon and both rings, right for any attack build in three guides [mob-ballista] §8;
  [mob-spear-amazon] §8; [mob-witchhunter] §4.

**A4** add · *checked*
- **Weapon sets:** lock the one weapon to both sets, so set 2 is a second set of skills and points
  [mob-witchhunter] §3; [mob-bear] §3; [mob-shield-wall] §2; Rigwald's Ferocity picks the damage set: 30% more
  damage, 10% reduced attack speed in set II, the reverse trade in set I (pin) [mob-poison] §3; [fubgun] §2.

**A5** add · *checked*
- **Crit cap:** Garukhan's Resolve caps the skill's crit chance at 50%, bifurcated, and can't support Cooldown,
  Triggered or Persistent skills (pin) [mob-wolfman] §3; [mob-invoker] §4.

### Bows

**B1** add · *unverified* (timing)
- **Campaign:** a high-physical bow with Lightning Arrow and Lightning Rod until the build's skill arrives, in both
  bow guides [mob-poison] §5, §8; [fubgun] §2.

### Crossbows

**X1** replace "**Kit:** (thin: two off-meta studies)…" · *checked* (ammo skills)
- **Kit (bolts):** Woolie's Witchhunter (4.7K favourites): one crossbow in both sets, a clear ammo on set 1
  (Galvanic Shards, Herald of Thunder), a boss ammo on set 2 (Stormblast Bolts), Emergency Reload between clips
  [mob-witchhunter] §2, §3; [glacial-bolt] §1. Fresh Clip II is one off-meta study's [crossbow] header.

**X2** add · *checked*
- **Kit (grenades):** DEADRABB1T's Gemling (1.6K): five grenades from level 1, no bolt skill: Explosive Grenade
  the main hit, Flash, Gas, Oil, Cluster Grenade at 52, Mirage Archer re-firing Cluster at endgame; Pounce on set 2
  [mob-grenades] §2, §3.

**X3** add · *checked*
- **Grenade levers:** each grenade waits on a cooldown with stored uses (Explosive 5 s ×3, pin:
  `Data/Skills/act_str.lua`), so Grenadier's +1 use and cooldown recovery; Demolitionist's 4% extra fire per
  grenade type fired in 8 s rewards rotating; Multishot II and a base adding a grenade projectile [mob-grenades] §4.

**X4** replace "**Levers:** Trinity, Rage with Berserk…" · *unverified* (one guide's thresholds)
- **Levers:** the crossbow's DPS with +Attack or +Projectile levels: 500+ and +2–4 at 1–3 divines, 700+ and +3–5
  at 10 [mob-witchhunter] §4, §6; Rage with Berserk [glacial-bolt] §1; [mob-ballista] §3; Rakiata's Flow and
  Elemental Armament II [glacial-bolt] §1; [mob-witchhunter] §3.

**X5** add · *checked*; not modelled (PG-12)
- **Reloads:** a 1-bolt clip takes reload help: Double Barrel II, then Ratha's Assault (bolts load on a dodge roll)
  and Arjun's Medal (a kill may load every crossbow skill) [mob-witchhunter] §3.

**X6** add · *checked* (tiers); the freeze pop *unverified*
- **Campaign:** a freeze shotgun in two guides: Permafrost Bolts, Fragmentation Rounds, Herald of Ice, one ammo per
  set so neither reloads [mob-ballista] §5; [mob-witchhunter] §5.

### Maces

No change (the one mace here sits beside a shield: Shields).

### Quarterstaves

**Q1** add · *checked*
- **Kit (Invoker):** ronarray's Storm Wave + Flicker Invoker (11.6K favourites): Storm Wave and Heralds of Ash and
  Thunder to clear; Flicker Strike on bosses after Charged Staff, Infernal Cry and Unbound Avatar [mob-invoker] §2,
  §3.

**Q2** replace "**Levers:** crit (about 80%…" · *unverified* (percentages)
- **Levers:** crit first in both ronarray guides: about 80% on a 10% base [ronarray-videos] §1, 90–100% on 11% with
  Sunder my Enemies (crits ignore elemental resistance) [mob-invoker] §4; then melee levels, Power Charges, Trinity's
  balance, 35% movement speed [ronarray-page] §2.

**Q3** add · *checked*; the rate *unverified*
- **Bosses:** fill Power Charges, cast Charged Staff, then burst: Killing Palm's bells [ronarray-page] §2, or
  Profane Ritual on set 2's skeletons [mob-invoker] §3.

### Spears

**P1** replace "**Kit:** (thin: two studies) Twister…" · *checked*
- **Kit:** Lazy Exile's Lightning Spear Amazon (3.2K favourites): Lightning Spear to clear, Storm Lance then
  Explosive Spear (a Detonator) on bosses, Herald of Thunder, a Talisman on set 2 [mob-spear-amazon] §2, §3.
  Twister [twister] chain 3–6 levels a second guide, until Glacial Lance at 40–50% crit [mob-glacial-lance] §3, §5.

**P2** add · *checked*
- **Frenzy Charges:** Lightning Spear, Storm Lance, Explosive Spear and Barrage spend them (pin), so both guides
  ration them [mob-spear-amazon] §2; [mob-glacial-lance] §2; supply: Combat Frenzy with Charge Profusion
  [mob-glacial-lance] §5.

**P3** replace "**Levers:** projectile count…" · *unverified*
- **Levers:** flat damage on the spear and rings, then Spirit for Eternal Rage, Herald of Thunder and Wind Dancer
  [mob-spear-amazon] §4; crit, flat physical and cold [mob-glacial-lance] §4; projectile count and repeats
  [twister] chain 4, 6.

**P4** add · *checked*
- **Amazon:** Predatory Instinct first (50% more against an Open Weakness, revealed on rares and uniques), Critical
  Strike, Elemental Surge; Dance with Death (25% more skill speed, empty off hand) to early maps
  [mob-spear-amazon] §3; [mob-glacial-lance] §3.

### Damage over time

**D1** replace "**Kit:** an ailment or debuff…" · *checked* (spread text)
- **Kit:** a debuff that deals the damage and a spreader: Contagion, triggered by Cast on Elemental Ailment [eraser]
  §1, or cast by hand beside Essence Drain, a death spreading Contagion, curses and chaos DoT debuffs
  [mob-ed-lich] §2, §3; Wither from Withering Presence [eraser] §1; [mob-ed-lich] §3; Despair on Blasphemy
  [maelstrom] §1 (7) or on set 2 [mob-ed-lich] §3.

**D2** add · *checked*
- **Ramp:** Contagion deals 100% more per spread, up to 300% (pin) [mob-ed-lich] §2.

**D3** add · *checked*; the pustules' filling *unverified*
- **Bosses:** a hit keyed to the DoT: Dark Effigy bombards only enemies with a chaos DoT debuff (pin)
  [mob-ed-lich] §3; Toxic Growth's pustules store the poison Gas Arrow's cloud puts on them [mob-poison] §2.

**D4** add · *checked*, except the base of one
- **Poison:** one poison per enemy until stack sources add one each (Escalating Poison, Building Toxins, Snakebite);
  Overwhelming Toxicity doubles them at 50% less duration; Deadly Poison II (100% more magnitude, 30% less hit
  damage) on every poison skill [mob-poison] §3, §4.

**D5** replace "**Campaign:** two of the studied guides…" · *unverified*
- **Campaign:** Contagion opens six studied campaigns [comparison] §2; [fubgun] §2; [mob-ed-lich] §5;
  [mob-autobomber] §5; [mob-mattjestic] §3; [mob-thyworm] §4.

### Totems

**T1** replace "**Kit:** (thin: one study)…" · *checked*
- **Kit:** two popular kits make the totem the whole damage: Ky's Arc Totems Gemling (1.7K favourites), Spell
  Totem casting Arc with Dominus' Grasp under Ancestral Bond [mob-arc-totems] §2, §3; Lazy Exile's Mortar Cannon
  ballistas firing a socketed Cluster Grenade [mob-ballista] §2, §3; or a totem repeats the combo [empyrean]
  process 6.

**T2** replace "**Levers:** (from the gem text, not practice)…" · *checked* (keystone, resistances)
- **Levers:** count, from Spirit under Ancestral Bond (a Spirit amulet beats a +levels one if it reaches the next
  totem) [mob-arc-totems] §4, or from gem quality and the weapon for ballistas [mob-ballista] §4; Urgent Totems III
  at every tier [mob-arc-totems] §3; [mob-ballista] §3; the totem gems grant their own resistances (pin).

**T3** add
- **Order:** guides differ: survival supports before a second totem [empyrean] process 6; count first, with no
  Hardy or Reinforced Totems [mob-arc-totems] §7; [mob-ballista] §9.

**T4** add · *checked*, except whether Artillery Strike reaches Mortar Cannon
- **Ballistas:** one, +1 from Mortar Cannon's Gemling quality, +1 from an Ulaman crossbow prefix; its grenades take
  50% less attack speed and damage for 100% increased cooldown recovery [mob-ballista] §4.

### Shapeshifting (talismans), new

**SH1** add · *checked*
- **Kit:** a two-hand Talisman, which every bear and wolf skill requires (pin): no off hand without Lord of the
  Wilds, and it is most of the damage, so replace it often [mob-bear] §3, §4; [mob-wolfman] §3, §4.

**SH2** add · *checked*; Maul standing the bear up *unverified*
- **Bear:** slams that spend Rage on the hit: Maul builds it, Furious Slam spends 10, Rampage travels and clears;
  Shaman's Furious Wellspring regenerates 6% of maximum Rage a second, raised by mana regeneration [mob-bear] §2, §3.

**SH3** add · *checked*
- **Wolf:** cold strikes that freeze: Lunar Assault primes, Arctic Howl freezes, Shred makes Ice Fragments, Cross
  Slash detonates them; Lunar Blessing (59% of damage as extra cold, longer per Rage spent, pin) [mob-wolfman] §2, §3.

**SH4** add · *checked*
- **Levers:** weapon physical damage and gain as extra, then melee levels (gloves +2, amulet +3, pin); Rampage's run
  reads movement speed [mob-bear] §4; Spiny's 11% base crit for a crit wolf [mob-wolfman] §3; Herald of Ice in both,
  with Polcirkeln's chill-shatter for the bear [mob-bear] §4.

**SH5** add · *unverified*: one guide; needs in-game testing
- **Weapon sets:** one talisman in both sets, buffs cast from set 2 [mob-bear] §3; Savage Fury on set 2 alone is
  said to reserve no Spirit; Eternal Rage must be active in both sets and Savage Fury needn't (pin), but no text says
  it reserves nothing [mob-wolfman] §3.

### Plants, new

**PL1** add · *checked*
- **Kit:** Raxxanterax's Plant Oracle (3.2K favourites): Entangle to clear, Thrashing Vines on bosses, Forced
  Outcome's crits firing Thunderstorm through Cast on Critical to keep plants Overgrown, Sigil of Power on set 2;
  the core of [oracle] chain 4–6 [mob-plants] §2, §3.

**PL2** add · *checked* (first two)
- **Supports:** Accelerated Growth II and Branching Fissures II on Entangle; Concentrated Area and Heft on Thrashing
  Vines, in both builds [mob-plants] §3; [oracle] chain 1, 7.

**PL3** add · *checked*; the gain in play *unverified*
- **Levers:** Overgrowth: Thrashing Vines 50% more damage and 50% larger, Entangle 3 more vines per enemy (pin);
  Thrashing Vines placed once per 8 s, Entangle spammed between [mob-plants] §2, §4.

**PL4** add
- **Costs:** guides differ: life pays and mana defends [oracle] chain 2, 9; costs stay on mana, which Zenith II and
  Sigil of Power read [mob-plants] §3, §8.

### Shields, new

**SW1** add · *checked*
- **Kit:** (thin: one guide) a high-armour tower shield in both sets and a one-hand mace; Shield Wall placed,
  Infernal Cry to empower it, Fortifying Cry to shatter it [mob-shield-wall] §2, §3; Shield Charge reads the same
  armour [shield-charge].

**SW2** add · *checked*; targets the guide's
- **Levers:** shield armour: Shield Wall and Shield Wave add 5–7 physical per 15, Greatest Defence 4% increased
  attack damage per 75; about 350 in Act 3, 800–900 in early maps [mob-shield-wall] §4.

**SW3** add · *checked*
- **Detonation:** a wall your skill shatters deals 100% more, one enemies break inside 0.5 s 80% less; Kaom's
  Madness on Ahn's Citadel adds 3 fissures [mob-shield-wall] §2, §3.

**SW4** add · *checked*
- **Fire:** Avatar of Fire only after The Molten One's Gift, which carries Fully Broken Armour to fire
  [mob-shield-wall] §2, §4.

### Automated loops, new

**AU1** add · *checked* (gem, boots)
- **Kit:** (thin: one study) Entangle fills 100 Glory, Apocalypse fires a disaster every 0.75 s for 12 s,
  Trampletoe's overkill splash chains the kills, the player sprints; sparse content waits per pack
  [mob-autobomber] §2.

**AU2** add · *checked* (lines); the set-2 snapshot *unverified*
- **Levers:** Apocalypse's level from every element's level lines, cast from set 2; Rising Tempest's 12% per element
  used recently; sprint speed for clear [mob-autobomber] §3, §4.

## 3. Pattern entries

**E1, new** in §1 · *checked*; rates *unverified*

### Meta trigger as a supply

- **Shape:** a Cast on X gem fires a spell for what it makes (a charge, a state), so its damage penalty is free.
- **Search:** the payoff's resource; spells making it (`mechanic "Power Charge" (gem)`, "Overgrown"); the Energy
  cap, 10 per 0.1 s of the spell's base cast time.
- **PoB:** not modelled: meta-gem Energy (PG-9); hand calculation, the resource by config.
- **Examples:** Invoker: Profane Ritual for Power Charges [mob-invoker]. Plant Oracle: Thunderstorm for Overgrowth
  [mob-plants]; [oracle].
- **Cautions:** the spell's level sets its cost [mob-plants].

**E2, new** in §1 · *checked* (gem); renewal *unverified*

### Self-firing buff

- **Shape:** a buff fires damage on a timer at targets it picks, so play is moving and refilling its gate.
- **Search:** Glory-gated buffs (`mechanic "Glory" (gem)`); kill chains (`mechanic "Overkill" (unique)`).
- **PoB:** hand calculation: each hit is modelled, the interval and Glory aren't (PG-7).
- **Examples:** Autobomber: Apocalypse on Entangle's Glory [mob-autobomber].
- **Cautions:** one niche study (20 favourites).

**Updates** (all *checked*):
- **E3, Placed detonator:** Search, add "a Detonator-typed skill (gem lookup)"; PoB: "Storm Lance's detonation and
  Shield Wall's 100% more possibly unmodelled (coverage)"; Examples, add Storm Lance and Explosive Spear
  [mob-spear-amazon], Stormblast and Mirage Archer [mob-witchhunter], Fortifying Cry [mob-shield-wall], Shred and
  Cross Slash [mob-wolfman]; list it under "seen in two or more".
- **E4, Weapon set 2 job:** Shape: "set 2 does what set 1 can't (a buff, a boss button, a more-damage support);
  one weapon in both sets makes it a second set of skills and points"; Examples, add [mob-witchhunter],
  [mob-poison]; Cautions, add "Eternal Rage and Sacrifice must be active in both sets (pin)".
- **E5, A count as a multiplier:** Examples, add Demolitionist [mob-grenades] and the per-totem Gemling line
  [mob-arc-totems]; PoB, add "Demolitionist: config `# different Grenade Types Shot`".
- **E6, A tamed rare beast:** Examples, add Silverfist [mob-beastmaster]; Cautions: "the Haste most players
  prioritize is Haste Aura" [mob-beastmaster] §8.
- **E7, Condition carrier:** Examples, add Lunar Assault [mob-bear]; [mob-wolfman]; list it under "seen in two or
  more".
- **E8, Payoff thief:** Examples, add the spears' Frenzy Charges [mob-spear-amazon]; [mob-glacial-lance].
- **E9, Damage-source substitution:** PoB: "modelled: shield armour damage parses on Shield Wall and Shield Wave
  (coverage)" [mob-shield-wall].
- **E10, Tag audit:** Cautions, add "Excise adds the Cooldown type Garukhan's Resolve can't support" [mob-invoker].
- **E11, Filler to satisfy a count:** Examples, add three Gemlings tying Gem Studded's colours [mob-arc-totems];
  [mob-ballista]; [mob-grenades].
- **E12, Proxy multiplier:** Examples, add Spell Totems [mob-arc-totems], ballistas [mob-ballista] (PG-68).

## 4. Contradictions and corrections

- **Danse Macabre:** a guide says it doubles; the pin gives 30% more damage and 30% buff effect [mob-thyworm] §9.
- **Fury of the Mountain:** a guide's Frenzy source, but its pin text names Rage and no "gain a Frenzy Charge" is in
  that kit [mob-spear-amazon] §9: run the family search first.
- **Excise with Garukhan's Resolve:** paired on Flicker, but Garukhan's can't support Cooldown skills, and its 50%
  cap defeats the guide's "helps reach 100%" (pin) [mob-invoker] §4; staying at 50% [ronarray-videos] §1 fits.
- **Gem Studded:** called crit immunity by a guide and one study [mob-arc-totems] §7; the red line removes the crit
  damage bonus only, and only the most numerous colours count (pin) [mob-grenades] §7.
- **Herald triggers:** the library says both fire on a non-Herald hit; Ice needs a shatter, Thunder a shocked kill
  (A1).
- **Off-meta lines the popular guides overturn:** the minion focus (M1), survival before totem count (T3), Fresh
  Clip II and grenades on set 2 (X1, X2).
- **Storm Lance:** the guide's quality-raised limit of 4; no quality effect at the pin [mob-spear-amazon] §9.

## 5. PoB gaps to log

Numbers follow PG-56. Established: coverage or code showed it; suspected: coverage says "possibly unmodelled".

- **PG-57, Herald of Ice's shatter explosion.** gap, established: mapped, read nowhere [mob-bear] §9.
- **PG-58, Lunar Blessing's 59% as cold and per-Rage duration.** gap, suspected [mob-wolfman] §9.
- **PG-59, Bhatair's Vengeance's buff.** gap, suspected [mob-bear] §9.
- **PG-60, Shield Wall's detonation** (100% more, 80% less, limit; Ahn's Citadel's fissure). half, suspected:
  Kaom's penalties parse [mob-shield-wall] §9.
- **PG-61, Contagion's ramp,** 100% more per spread. gap, suspected [mob-ed-lich] §9 (PG-21 is the spread).
- **PG-62, Eldritch Empowerment.** half, established: the 30% more parses, the energy shield drain doesn't
  [mob-ed-lich] §9.
- **PG-63, plant Overgrowth.** gap, established: no Overgrown line maps; Sigil of Power's stages don't parse
  [mob-plants] §9.
- **PG-64, Toxic Growth's stored poison and Gas Arrow's cloud.** gap, suspected [mob-poison] §9.
- **PG-65, Herald of Plague's spread, Herald of Blood's explosions.** gap, established [mob-poison] §9.
- **PG-66, Storm Lance's 16-bolt detonation.** gap, suspected [mob-spear-amazon] §9.
- **PG-67, Elemental Surge and Predatory Instinct's reveal.** gap, established [mob-spear-amazon] §9.
- **PG-68, totem count:** Spell Totem's and Mortar Cannon's totem stats unmapped. gap, established; the DPS effect
  suspected [mob-arc-totems] §9; [mob-ballista] §9.
- **PG-69, minion lines:** Raging Spirits' summons, Minion Splash, Sacrificial Lamb. gap, established
  [mob-mattjestic] §9; Wildshards II suspected [mob-thyworm] §9.
- **PG-70, per-set reservation:** PoB never reads "active in both weapon sets". gap, established in code
  [mob-wolfman] §3.

Smaller, established: The Natural Order unparsed [mob-beastmaster] §9; Trampletoe's splash dropped
[mob-autobomber] §9; Mind Phylacteries unparsed [mob-glacial-lance] §9. Already logged, add "Seen in": PG-1, PG-4,
PG-5, PG-7, PG-9, PG-12, PG-33.

## 6. Beyond the library

- The Beast Master runs two tames from Act 3 and four companions in Zoo; plan schema 5 holds one per stage
  [mob-beastmaster] §9.
- A unique tame's tablet modifier has no line in the pin's data [mob-beastmaster] §9.
- Mid-campaign respecs of ascendancy [mob-shield-wall] §8 or whole build [mob-beastmaster] §5; [mob-arc-totems] §5:
  the plan should say when, and the gold.
- Per-set skills and passive points: compile needs both sets [mob-witchhunter] §3; [mob-bear] §3.
- Ten groups need an Unset Ring's slot; compile must count ring slots [mob-invoker] §3.
- Movement or sprint speed is the clear lever for Rampage and sprinting; the clear-speed band (D-407) should read it
  [mob-bear] §4; [mob-autobomber] §4.
- A buff cast from set 2 that keeps set 2's stats must be measured on set 2 [mob-autobomber] §3.

## 7. Sources lines

```
[mob-mattjestic]: ../../../../docs/build-guide/studies/2026-10-18-mob-mattjestic-minion-infernalist.md "0.5"
[mob-thyworm]: ../../../../docs/build-guide/studies/2026-10-18-mob-thyworm-minion-infernalist.md "0.5, tagged 0.5.5"
[mob-beastmaster]: ../../../../docs/build-guide/studies/2026-10-18-mob-captainlance9-beast-master.md "0.5, badge 0.5.5"
[mob-bear]: ../../../../docs/build-guide/studies/2026-10-18-mob-ronarray-shaman-bear.md "0.5, badge 0.5.5"
[mob-wolfman]: ../../../../docs/build-guide/studies/2026-10-18-mob-woolie-wolfman-oracle.md "0.5.5"
[mob-plants]: ../../../../docs/build-guide/studies/2026-10-18-mob-raxx-plant-oracle.md "0.5.5"
[mob-ed-lich]: ../../../../docs/build-guide/studies/2026-10-18-mob-deadrabbit-ed-contagion-lich.md "0.5.5"
[mob-poison]: ../../../../docs/build-guide/studies/2026-10-18-mob-path-of-evening-poison-pathfinder.md "0.5.5"
[mob-shield-wall]: ../../../../docs/build-guide/studies/2026-10-18-mob-lexd-shield-wall-smith.md "0.5.5"
[mob-arc-totems]: ../../../../docs/build-guide/studies/2026-10-18-mob-ky-arc-totems-gemling.md "0.5.5"
[mob-ballista]: ../../../../docs/build-guide/studies/2026-10-18-mob-lazy-exile-ballista-grenade.md "0.5.5"
[mob-grenades]: ../../../../docs/build-guide/studies/2026-10-18-mob-deadrabbit-grenades-gemling.md "0.5.5"
[mob-witchhunter]: ../../../../docs/build-guide/studies/2026-10-18-mob-woolie-run-n-gun-witchhunter.md "0.5.5"
[mob-spear-amazon]: ../../../../docs/build-guide/studies/2026-10-18-mob-lazy-exile-lightning-spear-amazon.md "0.5, badge 0.5.5"
[mob-glacial-lance]: ../../../../docs/build-guide/studies/2026-10-18-mob-misoxshiru-glacial-lance-ritualist.md "0.5.5"
[mob-invoker]: ../../../../docs/build-guide/studies/2026-10-18-mob-ronarray-storm-wave-invoker.md "0.5, badge 0.5.5"
[mob-autobomber]: ../../../../docs/build-guide/studies/2026-10-18-mob-lyrthos-autobomber-shaman.md "0.5.5, title 0.5"
```
