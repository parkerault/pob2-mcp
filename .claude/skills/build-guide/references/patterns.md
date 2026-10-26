# Pattern library (v1)

How off-meta builds link a damage source to the pieces that make it work, as shapes to search for (C-53,
D-290). R1a researchers read it whole before writing cards; D1-build, before designing `b` and `n`.

## Brainstorm questions

Ask these of every candidate; the builds in brackets showed why.

1. What is the damage source, what does it read, and which slot carries it? (Shield Charge, Enervating
   Nova)
2. Fix the payoff first, then judge each piece by whether it feeds it. (Empyrean)
3. What does the payoff consume or require, and can the skill create it? If not, it's a builder and a
   finisher, and the lock must fit by tag. (Wing Blast, Shockchain)
4. The enabler: name it, the level it arrives at, and how to get it ("dormant until X"). Its downside is the
   next buy. (Eye of Winter, Gathering Storm)
5. Which routine action already produces the resource it needs? (Empyrean, Walking Calamity)
6. Read the skill's own text for payout conditions, ramps and hidden scaling. (Wing Blast, Varashta, Eye of
   Winter)
7. Tag audit: which +level sources and supports can reach it? (Walking Calamity, Fangs)
8. Search other skills' text for the main skill's tags, and pair-test the planned skills. (Shield Charge,
   Empyrean)
9. Give it the standard kit before calling it weak. (Bone Cage; the kits are under Standard kits)
10. How does the required state fail? Plan one fix per failure. (Fangs)

The answers fill the card (`templates/card-template.md`). The questions and the ten families come from
[worklog], "Off-meta builds 7–30"; the earlier patterns from its "Off-meta builds 2–6".

## Brainstorm questions 11–19: the engine and the synthesis

Ask these after 1–10 (D-409). Navira's Fracturing against our Varashta build showed why: tuning can't find a
better structure, and the pieces of one sat unused in the research ([comparison] §7.1). Questions 15–19 are the
synthesis questions (D-431): the synthesis asks them of each composite, and D1-build again after a conversion, a
keystone or a limit named as a con. Spud's Warcryer carried six damage layers to our build's two ([spud] §4).

11. What does the obvious build do, and how is this card faster? Start from its archetype's entry under
    Standard kits. (Navira's Fracturing)
12. What grows with a count, and what pays for a bigger count? See A count as a multiplier. (Navira's
    Fracturing, Supporting Fire)
13. What does each premium slot serve? A slot that props up the engine rather than the damage is a lead:
    search for a supply that frees it (Supply by family). (Navira's Fracturing)
14. Which rule changer touches this engine? Grep `data/rules/pairs.md` for its families (A rule changer).
    (Flicker Monk, Eventide Petals)
15. Climb the chain. What scales the damage, what scales that, and what scales that? Search each scaler's
    name as the target of another line ("effect of", "bonuses gained from", "also apply to", "per"), not only
    as a stat to stack. See Scale the scaler. (Widowhail, Mana Flare Shaman)
16. Breadth. What else can this button cause? Each layer its hits can start: ailments, explosions, detonations, a
    skill it triggers, a second warcry. Search each layer's payoff by its damage type after conversion, and weigh it
    by the hit that starts it: an ailment pays on a big, slow hit more than on a fast one (Convert into the ailment's
    type). (Spud's Warcryer)
17. The limit. What caps this build's rate or uptime, and what removes the cap rather than feeding it? A cost moved
    to another pool (Cost redirection), a refund, a cooldown ignored. (Spud's Warcryer)
18. Conflicts. Which pieces fight (one consumes what another needs)? Schedule the conflict before leaving a piece
    out: a clear button and a boss button, a second weapon set; or drop the piece the other side needs, if it is worth
    less (Spud's character takes Jade Heritage in place of Imploding Impacts, so Battershout competes with nothing).
    See Payoff thief.
19. Bosses. When the clear skill is capped by a limit or shaped for packs, what is the boss button? (Spud's
    Warcryer: Hammer of the Gods on its own weapon set)

## How to read an entry

- **Shapes only.** Re-check every use against current game data with a lookup: names, numbers and wording
  change between patches. The studies span 0.1 to 0.5.5 plus one Path of Exile 1 video (each source's
  patch is in Sources); the pin is 0.5.4.
- **The studies show what players do, not game truth.** They are agents' reports on creators' videos and
  write-ups, and creators err. A card is dealt only when a lookup confirms every load-bearing link in game
  text (the sniff test, R1a-assemble). A claim marked unverified here needs that check, or "needs in-game
  testing" on the card. An interaction no game text documents is never used.
- **Damage order.** Flat damage is converted first. The skill's own conversion comes first, then every
  other conversion once, on what it left, with no chains. Gain-as-extra lines then add a share of each type's damage after conversion and before
  any increase; the gained damage keeps its new type, and no later conversion touches it. Increased and more
  modifiers apply last, by the type each part ends as, with no Path of Exile 1 double dipping: increased cold does
  nothing for cold converted to fire, or for fire gained from cold. Avatar of Fire loses gained cold and lightning
  only through its "Deal no Non-Fire Damage" (the user, 2026-10-23; the gain-as-extra order, the user, 2026-10-26;
  PoB agrees).
- **Defence figures:** EHP is PoB's `TotalEHP`, the average damage taken before death; it counts the chance layers
  (evade, block, deflection) as averages. The max hit is PoB's largest hit survived per type, assuming every chance
  roll fails; the Arbiter verdict reads it, and no chance layer moves it. Take evasion and deflection thresholds
  from PoB's formulas at the rung's enemy level (accuracy 2,357 at level 85), never from a video's table: two
  explainers used Path of Exile 1's [vid-scale-defence] [vid-defence-guide].
- **Fields.** **Shape:** one sentence true of any skill. **Search:** the starting point, the lookups, what to
  check. **PoB:** how PoB follows it, in six labels: **modelled**; **Count** (the group's Count multiplies
  its damage); **custom modifier** (a hand-calculated line PoB applies as a modifier); **config stand-in** (a
  config option stands for the mechanic); **hand calculation** (a ledger entry); **not modelled**. PG-n is
  an entry in [pob-gaps]. "Not established" means no study checked it: count it not modelled until
  coverage shows the line applies. **Examples:** one to five builds, each citing its study. **Cautions:**
  what went wrong, or what to check first.
- **Lookups in short form.** `mechanic "<phrase>" (<kind>)` is `mcp__pob2__lookup_game_data {mode:
  "mechanic", query, kind}`; "gem lookup" and "unique lookup" are its other modes; `tree "<text>"` is
  `mcp__pob2__search_tree_nodes {query}` (`{ascendancy}` for its nodes); coverage is
  `mcp__pob2__check_model_coverage`. Mechanic search is a substring match capped at 20–30 results (PG-48),
  so keep phrases narrow and set `kind`; `…` in a phrase matches any text. It searches Gemling quality
  lines and item-base implicits (`kind` `base`) too (D-299).
- **Maintenance.** After each study the user supplies, the coordinator proposes entries and the user
  approves them (§7.6, C-53).
- **Reviewed.** Questions 11–14, Standard kits, A count as a multiplier, Supply by family, Bank the resource, A
  tamed rare beast and A rule changer (amendment 8, D-409) were reviewed by the user on 2026-10-18 with no
  corrections. The kits were thin for want of common-practice sources; the Mobalytics review of 17 popular
  guides (the `mob-` keys) revised them, added five kits, Meta trigger as a supply and Self-firing buff, and was
  approved by the user on 2026-10-19 (C-53). Question 15 and Scale the scaler are the user's lens (2026-10-23:
  search for what scales the thing that scales the thing being scaled), approved as worded. The damage-order rule,
  Convert into the ailment's type and the corpse-explosion line are the user's (2026-10-23), as [amendment-9] §24.1
  words them. Questions 16–19 and the changes to Cost redirection and Payoff thief are amendment 10's (D-431),
  approved by the user on 2026-10-23. The Defence family, the defence line in Standard kits and the defence edits to
  other entries come from the defence study [defence-layers] and seven videos the user picked (the `vid-` keys),
  approved by the user on 2026-10-26.
- **Seen in two or more independent builds:** relay past a self-exclusion, stat-to-damage bridge, cost
  redirection, cost to a gated resource, builder and finisher with a payoff thief, Archon of Undeath with
  Muster on command skills, Concussive Runes shockwaves, Gemling quality [worklog]; placed detonator and condition
  carrier (their examples).

## Standard kits

What an average player reaches for first in each archetype, and its big levers (D-403). Question 9 and the
obvious card start here; R1b's structure check reads the card's archetype here (D-406). Each line cites a study
by its key and section, the pinned data (`pin:`, a grep of the files under `vendor/PathOfBuilding-PoE2/src/`,
2026-10-18; a bare "(pin)" is a lookup at the pin) or the user; a line with no source stays out. Where guides
differ, the line gives both. Kits are common wisdom and go stale after a patch: re-check the numbers.

- **Every archetype, for defence:** the class's attributes pick the defence family: armour bases need strength,
  evasion bases dexterity, energy shield bases intelligence and a hybrid base two, so a family off the class's
  attributes pays its requirements in tree points and gear stats. In 30 published level-90+ league starters the main
  defence follows the class's attributes in 26: every Huntress, Ranger and Monk evades, the Warriors and two of
  three Druids wear armour, and the Mercenaries split, three on armour and five on evasion. Under the non-budget
  enemy, as median EHP and median physical max hit [defence-layers] families: evasion with an energy shield pool,
  24k and 6.2k (15k with every condition against it); evasion with a life pool, 18k and 3.5k, three of five
  one-shot, so a pool and deflection come before more evasion; armour with a life pool, 29k and 5.0k, which
  conditions don't move; a mana pool (Mind over Matter, Eldritch Battery), 17k and 9.0k; energy shield without
  evasion, 16.5–25k and 10–14k; evasion with Sorcery Ward (two Witchhunters), 158–206k and 12–15k. Capped
  resistances are worth ×1.30–2.24 in all 30, and all four one-shots fail on the physical hit.
- **Every archetype, for clear:** an explosion on kill (a corpse explosion from a warcry, a node or a unique; a
  Herald's) turns each kill into a hit sized by the monster's life, so a pack chain-explodes once the first
  monsters die: one of the strongest and most fun additions to map clear (the user, 2026-10-23). PoB sizes it per
  corpse, and its Full DPS counts it once a second ([spud] §9).

### Minions

- **Kit:** a sceptre, lots of Spirit and more minion types [comparison] §7.2 (1); both Infernalist guides keep a
  Rattling Sceptre (100 Spirit, its own Skeletal Warrior) all game and carry a shield for block, not a focus
  [mob-mattjestic] §3; [mob-thyworm] §3. "Sceptres and lots of Spirit" is a minion player's first thought (the
  user, [amendment-8] §1).
- **Levers:** minion levels (they set minion flat damage), increased minion damage, more multipliers (Muster,
  Feeding Frenzy II), enemy-side debuffs, then more minions through Spirit [mob-thyworm] §4; the same four as
  [comparison] §7.2 (4).
- **Levels:** up to +4 on a sceptre, +3 on an amulet, +2 on a helmet; a focus gets +1–2 only from the "of
  Amanamu" suffix (pin: `Data/ModItem.lua`, `Data/ModVeiled.lua`). Navira's guide reaches +12, counting a
  fractured amulet at +4, above a regular roll's +3 [comparison] §2.
- **Spirit:** a sceptre's base 100 and up to 65% increased; up to +50 on an amulet and +61 on body armour
  (pin: `Data/Bases/sceptre.lua`, `Data/ModItem.lua`). Navira's runs 334 to our run's 100 [comparison] §2. Both
  Infernalist guides add Enfolding Dawn (+100 Spirit) and Bones of Ullr (20–30% reservation efficiency for undead
  minions) (pin), and Beidat's Will [mob-mattjestic] §3; [mob-thyworm] §3; an eight-type zoo reserves about 600
  base Spirit, more than visible gear gives [mob-mattjestic] §6.
- **Types:** one of each type rather than more of the best one, adding a type with each Spirit gain [varashta]
  §2, §6. Muster (7% more per reviving type, pin: `Data/Skills/sup_int.lua`) and At your Command (10%
  increased command damage per persistent type, pin: `TreeData/0_5/tree.lua`) grow with the count; see A
  count as a multiplier.
- **Spectres:** picked for the monster's skill, whose tags decide which supports apply: a Vaal Guard grenadier at
  Act 3 (50 Spirit), then a Powered Zealot casting Spark (55) with Wildshards II and Pierce III [mob-thyworm] §3, §5
  (pin: `Data/Spectres.lua`); a melee spectre with Minion Splash II in the other guide [mob-mattjestic] §3. The
  guides differ on the monster; both give it Feeding Frenzy and Muster.
- **Commands:** a command skill deals minion damage, so minion levels, Muster, Pain Offering and Archon of
  Undeath (25% more minion damage, 200% more command cooldown recovery) scale it [varashta] §2;
  [supporting-fire] chain 6.
- **Offering:** Pain Offering with Danse Macabre (30% more damage, 30% increased buff effect, pin) in three guides
  [mob-mattjestic] §3; [mob-thyworm] §3; [mob-beastmaster] §3; two feed it Skeletal Warriors with Sacrificial Lamb,
  which makes your skills target that skill's minions within 6 metres first (pin).
- **Survival:** Loyalty on a damageable companion (the Infernal Hound, a tamed beast) takes 10% of your hit damage
  first, in three guides [mob-mattjestic] §7; [mob-thyworm] §7; [mob-beastmaster] §7; when the damage or a buff
  lives on the minions, cap their resistances first [chayula-minions] §2 (6), §6. Romira's Requital's 10% and
  a 5% companion line read ×1.06–1.11 on EHP and the max hit [defence-layers] families.
- **Campaign:** both Infernalists pair a fire minion with Flame Wall: Raging Spirits, which your fire casts summon
  [mob-mattjestic] §2, §5, or the Skeletal Sniper's Gas Arrow, ignited by the wall [mob-thyworm] §2, §5.

### Companions (tamed beasts)

- **Kit:** (thin: one study) a Spirit Walker with The Natural Order tames a unique beast, Mighty Silverfist from
  Act 3 (25% base crit, pin), beside a rare tame kept for its modifier and the Bear Spirit, outside the companion
  limit [mob-beastmaster] §2, §3.
- **Rare tame's modifier:** Haste Aura first (20% attack and cast speed, 10% movement speed to allies within 5
  metres), not Hasted, which speeds the beast alone; then a shock trail or a defensive aura [mob-beastmaster] §5, §8.
- **Spirit:** a tame reserves 13.8–56.1% of maximum Spirit (32.7% at the median), not a flat amount (the user,
  [amendment-8] §4; pin: `Modules/CalcDefence.lua:204`); two tames take 78–90%, and reservation efficiency cuts
  the percentage (Idol of Ralakesh, Idolatry); Sylvan's Effigy allows several types (pin) [mob-beastmaster] §3, §7.
- **Levers:** companion damage and attack speed, minion levels, and a high-physical main hand for The Catha's
  Balance (companions gain 60% of its damage, pin) [mob-beastmaster] §4.

### Spells

- **Kit:** a staff or wand for spell levels: up to +5–6 on a staff, +4 on a wand, +3 on an amulet, +2 on a focus
  (pin: `Data/ModItem.lua`); a +4/+5 staff and Magnified Area are the cheap path [enervating] header.
- **Levers:** spell levels first [enervating] chain 1; [mob-ed-lich] §4 (wand, focus, amulet); copies and repeats
  (Spell Cascade, mimics, Now and Again) [enervating] chain 5; spell crit [widowhail] §2 (5); maximum mana for
  Archmage [mana-flare] chain 2, about 5k in [mob-arc-totems] §2.
- **Before calling a spell weak:** placement or multi-cast supports (Astral Projection, Spell Cascade), area
  uniques and curses [bone-cage] arc (15:02), process 5, phases.
- **Area:** Magnified Area on the clear skill, Concentrated Area on the boss skill [mana-flare] chain 4.
- **Curses:** Temporal Chains on Blasphemy in four more guides [mob-ed-lich] §3; [mob-arc-totems] §7;
  [mob-invoker] §8; [mob-plants] §6; [enervating] chain 2; [fangs] arc (46:16); Elemental Weakness for elemental
  hits [mob-arc-totems] §3; [mob-thyworm] §3.
- **Crit:** Cast on Critical into Arc "is standard" [widowhail] §3; two later guides fire it for what the spell
  makes: Thunderstorm's wet for Overgrowth [mob-plants] §3, Profane Ritual's Power Charges [mob-invoker] §3;
  Pinpoint Critical trades crit bonus for chance [enervating] chain 6.
- **Defence:** Mind over Matter or Eldritch Battery on a large mana pool [enervating] chain 7; [oracle] chain 9.
  Three published casters read 14–19k EHP and 8–11k physical max hit on it, all three with Enfeeble (×1.52)
  [defence-layers] families; see Mana as a hit pool.
- **Weapon set 2:** a Chiming Staff's Sigil of Power (spell damage in its area, growing with mana spent there, pin)
  in four guides [mob-plants] §3; [mob-ed-lich] §3; [mob-mattjestic] §3; [oracle] chain 4–6; curses and exposure
  cast from set 2 [mob-ed-lich] §3; [mob-arc-totems] §2.

### Attacks, any weapon

- **Kit:** a Herald to clear, in nine of eleven attack guides at endgame: Herald of Ice explodes enemies a
  non-Herald attack shatters [mob-bear] §3; [mob-wolfman] §3; [mob-glacial-lance] §3; Herald of Thunder strikes
  your next attacks' targets after an attack kills a shocked enemy [mob-witchhunter] §3; [mob-spear-amazon] §3;
  [flicker] §2; Herald of Ash [mob-shield-wall] §3; [mob-grenades] §3; [mob-invoker] §3. Trinity (about 6% more
  elemental damage per 30 affinity, 100 Spirit) when hits carry two or three elements, and Wind Dancer once an
  amulet adds about 60 Spirit [ronarray-videos] §1.
- **Levers:** attack speed, then skill levels and flat added damage on several slots: the better of two
  poe.ninja Explosive Concoction builds beat ours ×3.1 (the other ×2.2), ×1.46 of it from speed and ×1.32 from
  +3 levels and added fire on three slots [ec-comparison] §3; search +level sources for every tag and slot
  [ec-comparison] §5 (1); flat added damage on the weapon and both rings, right for any attack build in three
  guides [mob-ballista] §8; [mob-spear-amazon] §8; [mob-witchhunter] §4.
- **Supports:** Elemental Armament II, Rakiata's Flow (enemy elemental resistances inverted), Concentrated Area
  against bosses [flicker] §2; [glacial-bolt] §1.
- **Defence:** Chaos Inoculation on energy shield and evasion from about 4–6k energy shield, with Ghost Dance
  for recovery [ronarray-videos] §1. Four published Chaos Inoculation attack builds carry 6.2–19.1k energy
  shield and read 17–52k EHP [defence-layers] families; Ghost Dance's lines aren't parsed, so its recovery is
  off the gate.
- **Rage:** Eternal Rage (5 Rage a second, active in both weapon sets, pin; 100 Spirit) in five guides
  [mob-spear-amazon] §3; [mob-witchhunter] §3; [mob-ballista] §3; [mob-wolfman] §3; [mob-glacial-lance] §3, with
  Berserk at about 114–230 Spirit [mob-ballista] §3; [mob-witchhunter] §6.
- **Weapon sets:** lock the one weapon to both sets, so set 2 is a second set of skills and points
  [mob-witchhunter] §3; [mob-bear] §3; [mob-shield-wall] §2; Rigwald's Ferocity picks the damage set: 30% more
  damage, 10% reduced attack speed in set II, the reverse trade in set I (pin) [mob-poison] §3; [fubgun] §2.
- **Crit cap:** Garukhan's Resolve caps the skill's crit chance at 50%, bifurcated, and can't support Cooldown,
  Triggered or Persistent skills (pin) [mob-wolfman] §3; [mob-invoker] §4.

### Bows

- **Kit:** Fubgun's Lightning Arrow Deadeye: Lightning Arrow and Herald of Thunder to clear, Lightning Rods and
  Tornado Shot against bosses, Frost Bomb for its debuff, Wind Dancer on a 45-Spirit amulet; the highest-DPS bow
  you can afford, swapped at +50% tooltip DPS [fubgun] §2, §3.
- **Levers:** arrows per shot ("Bow Attacks fire an additional Arrow", Surpassing chance), repeats (Barrage on
  Frenzy Charges) and Tornado Shot's copies [stormcaller] §1.
- **Levels:** up to +4 projectile levels on a bow, +3 on an amulet, +1 on a quiver (pin: `Data/ModItem.lua`).
- **Campaign:** a high-physical bow with Lightning Arrow and Lightning Rod until the build's skill arrives, in both
  bow guides [mob-poison] §5, §8; [fubgun] §2.

### Crossbows

- **Kit:** (bolts) Woolie's Witchhunter (4.7K favourites): one crossbow in both sets, a clear ammo on set 1
  (Galvanic Shards, Herald of Thunder), a boss ammo on set 2 (Stormblast Bolts), Emergency Reload between clips
  [mob-witchhunter] §2, §3; [glacial-bolt] §1. Fresh Clip II is one off-meta study's [crossbow] header.
- **Kit:** (grenades) DEADRABB1T's Gemling (1.6K): five grenades from level 1, no bolt skill: Explosive Grenade
  the main hit, Flash, Gas, Oil, Cluster Grenade at 52, Mirage Archer re-firing Cluster at endgame; Pounce on set 2
  [mob-grenades] §2, §3.
- **Levers:** the crossbow's DPS with +Attack or +Projectile levels: 500+ and +2–4 at 1–3 divines, 700+ and +3–5
  at 10 [mob-witchhunter] §4, §6; Rage with Berserk [glacial-bolt] §1; [mob-ballista] §3; Rakiata's Flow and
  Elemental Armament II [glacial-bolt] §1; [mob-witchhunter] §3.
- **Grenade levers:** each grenade waits on a cooldown with stored uses (Explosive 5 s ×3, pin:
  `Data/Skills/act_str.lua`), so Grenadier's +1 use and cooldown recovery; Demolitionist's 4% extra fire per
  grenade type fired in 8 s rewards rotating; Multishot II and a base adding a grenade projectile [mob-grenades] §4.
- **Reloads:** a 1-bolt clip takes reload help: Double Barrel II, then Ratha's Assault (bolts load on a dodge roll)
  and Arjun's Medal (a kill may load every crossbow skill) [mob-witchhunter] §3.
- **Levels:** up to +5 projectile levels on a crossbow (pin: `Data/ModItem.lua`).
- **Campaign:** a freeze shotgun in two guides: Permafrost Bolts, Fragmentation Rounds, Herald of Ice, one ammo per
  set so neither reloads [mob-ballista] §5; [mob-witchhunter] §5.

### Maces

- **Kit:** a two-hand mace with high physical damage and +5 melee levels [ancestral-cry] chain (the most a
  two-hander rolls, pin: `Data/ModItem.lua`); Rage, with Berserk [hotg] §1 (5); Herald of Ice to clear
  [earthshatter] chain 6.
- **Levers:** weapon damage and melee levels; Rage; heavy stun, whose payoffs include a Titan's Crushing
  Impacts, 25% more damage against Heavy Stunned enemies [ancestral-cry] chain; [crossbow] chain 3.
- **Clear:** warcries and aftershocks: a warcry shatters Earthshatter's spike, an Aftershock repeats the slam
  [earthshatter] chain 2, 4; [hotg] §1 (8).
- **Spirit:** Giant's Blood wields a two-hander in one hand, freeing the off hand for a sceptre's Spirit, at
  triple attribute requirements [supporting-fire] chain 4; [ancestral-cry] chain.

### Quarterstaves

- **Kit:** ronarray's Whirling Assault Martial Artist (11.3K favourites): Whirling Assault and the Heralds to
  clear; Trinity with Herald of Ash, and Herald of Ice or Wind Dancer with about 60 Spirit on the amulet;
  Killing Palm on the ascendancy's bells for Power Charges, then Charged Staff, against bosses [ronarray-page]
  intro, §2; [ronarray-videos] §1.
- **Kit:** (Invoker) ronarray's Storm Wave + Flicker Invoker (11.6K favourites): Storm Wave and Heralds of Ash and
  Thunder to clear; Flicker Strike on bosses after Charged Staff, Infernal Cry and Unbound Avatar [mob-invoker] §2,
  §3.
- **Levers:** crit first in both ronarray guides: about 80% on a 10% base [ronarray-videos] §1, 90–100% on 11% with
  Sunder my Enemies (crits ignore elemental resistance) [mob-invoker] §4; then melee levels, Power Charges, Trinity's
  balance, 35% movement speed [ronarray-page] §2.
- **Bosses:** fill Power Charges, cast Charged Staff, then burst: Killing Palm's bells [ronarray-page] §2, or
  Profane Ritual on set 2's skeletons [mob-invoker] §3.

### Spears

- **Kit:** Lazy Exile's Lightning Spear Amazon (3.2K favourites): Lightning Spear to clear, Storm Lance then
  Explosive Spear (a Detonator) on bosses, Herald of Thunder, a Talisman on set 2 [mob-spear-amazon] §2, §3.
  Twister [twister] chain 3–6 levels a second guide, until Glacial Lance at 40–50% crit [mob-glacial-lance] §3, §5.
- **Frenzy Charges:** Lightning Spear, Storm Lance, Explosive Spear and Barrage spend them (pin), so both guides
  ration them [mob-spear-amazon] §2; [mob-glacial-lance] §2; supply: Combat Frenzy with Charge Profusion
  [mob-glacial-lance] §5.
- **Levers:** flat damage on the spear and rings, then Spirit for Eternal Rage, Herald of Thunder and Wind Dancer
  [mob-spear-amazon] §4; crit, flat physical and cold [mob-glacial-lance] §4; projectile count and repeats
  [twister] chain 4, 6.
- **Levels:** up to +4 projectile and +4 melee levels on a spear (pin: `Data/ModItem.lua`).
- **Amazon:** Predatory Instinct first (50% more against an Open Weakness, revealed on rares and uniques), Critical
  Strike, Elemental Surge; Dance with Death (25% more skill speed, empty off hand) to early maps
  [mob-spear-amazon] §3; [mob-glacial-lance] §3.

### Damage over time

- **Kit:** a debuff that deals the damage and a spreader: Contagion, triggered by Cast on Elemental Ailment [eraser]
  §1, or cast by hand beside Essence Drain, a death spreading Contagion, curses and chaos DoT debuffs
  [mob-ed-lich] §2, §3; Wither from Withering Presence [eraser] §1; [mob-ed-lich] §3; Despair on Blasphemy
  [maelstrom] §1 (7) or on set 2 [mob-ed-lich] §3.
- **Levers:** the skill's level, ailment magnitude, enough duration to spread (an ignite of 2–3 s) [eraser] §1;
  Swift Affliction, Brutality and Herald of Blood on Corrupted Blood [infernal-cry] chain 4, which is said to
  take its host cry's level, 17 of it from items (unverified, PG-2) [infernal-cry] chain 2.
- **Ramp:** Contagion deals 100% more per spread, up to 300% (pin) [mob-ed-lich] §2.
- **Bosses:** a hit keyed to the DoT: Dark Effigy bombards only enemies with a chaos DoT debuff (pin)
  [mob-ed-lich] §3; Toxic Growth's pustules store the poison Gas Arrow's cloud puts on them [mob-poison] §2.
- **Poison:** one poison per enemy until stack sources add one each (Escalating Poison, Building Toxins, Snakebite);
  Overwhelming Toxicity doubles them at 50% less duration; Deadly Poison II (100% more magnitude, 30% less hit
  damage) on every poison skill [mob-poison] §3, §4.
- **Campaign:** Contagion opens six studied campaigns [comparison] §2; [fubgun] §2; [mob-ed-lich] §5;
  [mob-autobomber] §5; [mob-mattjestic] §3; [mob-thyworm] §4.

### Totems

- **Kit:** two popular kits make the totem the whole damage: Ky's Arc Totems Gemling (1.7K favourites), Spell
  Totem casting Arc with Dominus' Grasp under Ancestral Bond [mob-arc-totems] §2, §3; Lazy Exile's Mortar Cannon
  ballistas firing a socketed Cluster Grenade [mob-ballista] §2, §3; or a totem repeats the combo [empyrean]
  process 6.
- **Levers:** count, from Spirit under Ancestral Bond (a Spirit amulet beats a +levels one if it reaches the next
  totem) [mob-arc-totems] §4, or from gem quality and the weapon for ballistas [mob-ballista] §4; Urgent Totems III
  at every tier [mob-arc-totems] §3; [mob-ballista] §3; the totem gems grant their own resistances (pin).
- **Order:** guides differ: survival supports before a second totem [empyrean] process 6; count first, with no
  Hardy or Reinforced Totems [mob-arc-totems] §7; [mob-ballista] §9.
- **Limits:** Spell Totem and Ancestral Warrior Totem consume three charges per totem (pin:
  `Data/Skills/act_str.lua`); Ancestral Bond doubles the limit and drops the charges, at 75 Spirit a totem
  (pin: `TreeData/0_5/tree.lua`).
- **Ballistas:** one, +1 from Mortar Cannon's Gemling quality, +1 from an Ulaman crossbow prefix; its grenades take
  50% less attack speed and damage for 100% increased cooldown recovery [mob-ballista] §4.

### Warcries

- **Kit:** Spud the King's Warbringer: Warcaller's Bellow (warcries ignore cooldowns and explode corpses, pin:
  `TreeData/0_5/tree.lua`) spams Seismic Cry under Avatar of Fire; a warcry reads no weapon, so a cheap rare wand
  carries fire lines, and the shield's block scales damage (Renly's Training, Chernobog's Pillar) [spud] §1, §3. The
  open-clear run's obvious card borrowed the Maces kit's line for want of this one [worklog].
- **Levers:** Avatar of Fire and Xoph's Blood scale every skill (each left out costs 48% and 18% of Full DPS), then
  armour break and ailments, which pay on big hits (Blistering Bond) [spud] §4.1, §9.
- **Clear:** Bellow's and Deidbell's corpse explosions (25% and 10% of corpse life, pin: `TreeData/0_5/tree.lua`,
  `Data/Uniques/helmet.lua`), Bellow's above three seconds of the cry; Battershout on Infernal Cry [spud] §4.1, §9.
- **Costs:** a spammed cry runs out of mana; Blood Magic moves costs to life, refilled per kill [spud] §4.2.
- **Bosses:** a second button on its own weapon set and tree: Hammer of the Gods on set 1, or Shield Wall detonated
  by warcries [spud] §4.4, §9.
- **Count:** Escalation (20% increased damage per different warcry used recently, pin: `TreeData/0_5/tree.lua`) adds
  about 3% at three warcries: the increases pool is already deep [spud] §9.

### Shapeshifting (talismans)

- **Kit:** a two-hand Talisman, which every bear and wolf skill requires (pin): no off hand without Lord of the
  Wilds, and it is most of the damage, so replace it often [mob-bear] §3, §4; [mob-wolfman] §3, §4.
- **Bear:** slams that spend Rage on the hit: Maul builds it, Furious Slam spends 10, Rampage travels and clears;
  Shaman's Furious Wellspring regenerates 6% of maximum Rage a second, raised by mana regeneration [mob-bear] §2, §3.
- **Wolf:** cold strikes that freeze: Lunar Assault primes, Arctic Howl freezes, Shred makes Ice Fragments, Cross
  Slash detonates them; Lunar Blessing (59% of damage as extra cold, longer per Rage spent, pin) [mob-wolfman] §2, §3.
- **Levers:** weapon physical damage and gain as extra, then melee levels (gloves +2, amulet +3, pin); Rampage's run
  reads movement speed [mob-bear] §4; Spiny's 11% base crit for a crit wolf [mob-wolfman] §3; Herald of Ice in both,
  with Polcirkeln's chill-shatter for the bear [mob-bear] §4.
- **Weapon sets:** one talisman in both sets, buffs cast from set 2 [mob-bear] §3; Savage Fury on set 2 alone is
  said to reserve no Spirit; Eternal Rage must be active in both sets and Savage Fury needn't (pin), but no text says
  it reserves nothing [mob-wolfman] §3.

### Plants

- **Kit:** Raxxanterax's Plant Oracle (3.2K favourites): Entangle to clear, Thrashing Vines on bosses, Forced
  Outcome's crits firing Thunderstorm through Cast on Critical to keep plants Overgrown, Sigil of Power on set 2;
  the core of [oracle] chain 4–6 [mob-plants] §2, §3.
- **Supports:** Accelerated Growth II and Branching Fissures II on Entangle; Concentrated Area and Heft on Thrashing
  Vines, in both builds [mob-plants] §3; [oracle] chain 1, 7.
- **Levers:** Overgrowth: Thrashing Vines 50% more damage and 50% larger, Entangle 3 more vines per enemy (pin);
  Thrashing Vines placed once per 8 s, Entangle spammed between [mob-plants] §2, §4.
- **Costs:** guides differ: life pays and mana defends [oracle] chain 2, 9; costs stay on mana, which Zenith II and
  Sigil of Power read [mob-plants] §3, §8.

### Shields

- **Kit:** (thin: one guide) a high-armour tower shield in both sets and a one-hand mace; Shield Wall placed,
  Infernal Cry to empower it, Fortifying Cry to shatter it [mob-shield-wall] §2, §3; Shield Charge reads the same
  armour [shield-charge].
- **Levers:** shield armour: Shield Wall and Shield Wave add 5–7 physical per 15, Greatest Defence 4% increased
  attack damage per 75; about 350 in Act 3, 800–900 in early maps [mob-shield-wall] §4.
- **Detonation:** a wall your skill shatters deals 100% more, one enemies break inside 0.5 s 80% less; Kaom's
  Madness on Ahn's Citadel adds 3 fissures [mob-shield-wall] §2, §3.
- **Fire:** Avatar of Fire only after The Molten One's Gift, which carries Fully Broken Armour to fire
  [mob-shield-wall] §2, §4.

### Automated loops

- **Kit:** (thin: one study) Entangle fills 100 Glory, Apocalypse fires a disaster every 0.75 s for 12 s,
  Trampletoe's overkill splash chains the kills, the player sprints; sparse content waits per pack
  [mob-autobomber] §2.
- **Levers:** Apocalypse's level from every element's level lines, cast from set 2; Rising Tempest's 12% per element
  used recently; sprint speed for clear [mob-autobomber] §3, §4.

## 1. Loops and relays

### Inputs and outputs

- **Shape:** list what the skill consumes and produces (resources, objects it leaves, ailments, events) and
  who else supplies or consumes each; links between skills are usually one of these.
- **Search:** from the damage source's gem text, one narrow mechanic search per noun (`mechanic "mana
  spent" (unique)`, "corpse", "Ice Crystal"); check who supplies and consumes it, and whether the text treats
  "you" and "other" differently. Re-run on the next bottleneck.
- **PoB:** not modelled for most links: energy-based meta gems have no trigger rate (PG-9), so the rate is a
  hand calculation; each skill's own hit is usually modelled.
- **Examples:** The Eraser: the chaos ignite charges Cast on Elemental Ailment, which casts a level-1
  Contagion to spread it [eraser]. Melting Maelstrom: Decompose spends the mana the flask pays out as
  damage [maelstrom].
- **Cautions:** "ignite" matches about 55 gem descriptions, past the cap [eraser].

### Closed trigger loop

- **Shape:** a trigger's output recreates its own condition, so one seed keeps it running until a decay
  timer lapses.
- **Search:** for each trigger (a Cast on X gem, a Herald, an on-shatter effect) list its outputs; check
  whether one reaches its condition; name the seed and the timer.
- **PoB:** not modelled: the trigger (PG-9); Verglas needs a custom modifier (PG-22).
- **Examples:** Earthshatter: freezes trigger Frost Wall, Earthshatter breaks the walls, Verglas refreshes
  for 6 s; a manual Frost Wall seeds it [earthshatter].
- **Cautions:** plan the reseed (map start, before bosses).

### Relay past a self-exclusion

- **Shape:** the engine ignores its own hits, so a second skill triggered by its output closes the loop.
- **Search:** from a "non-<type>" or "other skills" clause, list the engine's outputs; `mechanic "Shatter"
  (gem)`, "on kill", "Heavy Stun" for triggers; check the triggered skill lacks the excluded type.
- **PoB:** not modelled: the Runic Shockwave has no skill definition (PG-10); crystal creation isn't modelled
  (PG-17).
- **Examples:** Eventide Petals: kill-triggered Heralds shatter the crystals other skills' crits made, and
  re-feed the petals [eventide]. Flicker Monk: the Concussive Runes shockwave is a non-Herald attack, so it
  re-fires both Heralds [flicker].
- **Cautions:** the chain is as reliable as its weakest gate (stun buildup, crit) [flicker].

### Routine action as damage

- **Shape:** an action the build does anyway (reload, walk, block, flask use) fires the payload, best when an
  event the build already makes performs it.
- **Search:** from the trigger verb on an item or skill, `mechanic "automatically" (gem)` and "when you";
  check event → action → payload closes.
- **PoB:** not modelled for reloads (PG-12): hand calculation, surge hit × bolts per second. Volcanic Steps:
  Count = movement speed ÷ 12 (PG-13).
- **Examples:** Crossbow Titan: Double Barrel III reloads on heavy stun, refilling Double Vision's surges
  [crossbow]. Ancestral Cry Titan: Volcanic Steps every 12 units travelled [ancestral-cry].
- **Cautions:** input demand is a con. Melting Maelstrom's stacking windows are the creator's observation,
  not item text [maelstrom].

### Kill-gated consumer

- **Shape:** a consume support on an on-kill skill works in packs and idles on bosses, so the boss keeps the
  state a single-target payoff needs.
- **Search:** list the on-kill skills (Heralds) and the supports they take with `mechanic "Consume" (gem)`.
- **PoB:** modelled for Biting Frost's more damage against frozen enemies; the kill gating is not modelled.
- **Examples:** Eventide Petals: Biting Frost II on the Heralds; bosses stay frozen for Heavy Frost
  [eventide].
- **Cautions:** run the payoff-thief audit.

### Debuff loop split across two skills

- **Shape:** one skill applies a debuff with a lasting per-application bonus; another consumes it but can't
  apply it, so the first re-applies.
- **Search:** from the debuff (`mechanic "fully broken" (gem)`), pair an applier with a consumer that cannot
  apply it; check the cap.
- **PoB:** hand calculation: Uruk's Smelting's damage taken is not modelled [mirage-sniper].
- **Examples:** Bone Cage: Uruk's Smelting on Vines, +5% physical taken per break up to 20%; Exploit
  Weakness consumes it [bone-cage].
- **Cautions:** a 0.4 source; re-check the numbers.

### Condition carrier

- **Shape:** an off-skill whose only job is to trigger a support's buff on you and allies.
- **Search:** supports granting a buff on an ailment (`mechanic "<ailment>" (gem)`); rank same-weapon skills
  by built-in buildup.
- **PoB:** not modelled until coverage shows otherwise (not established).
- **Examples:** Walking Calamity: Lunar Assault's 436% more freeze buildup carries Bhatair's Vengeance
  [walking-calamity]. Bear and wolf: Lunar Assault again, the freeze carrier [mob-bear]; [mob-wolfman].
- **Cautions:** for an unmet condition climb a ladder, cheapest first: supports, a stronger skill, a
  same-weapon skill with a built-in multiplier, a new weapon [walking-calamity].

### Placed detonator

- **Shape:** one skill places an object and the main skill breaks it for a bigger hit.
- **Search:** `mechanic "shatter" (gem)`, "explode"; a Detonator-typed skill (gem lookup); match the text's
  "your <tag>" to the main skill's types.
- **PoB:** not modelled until coverage shows otherwise: Storm Lance's detonation and Shield Wall's 100% more are
  possibly unmodelled (coverage; PG-60, PG-66).
- **Examples:** Shield Charge: "your Slams, Warcries, and Shield Charge will instantly shatter" Shield Wall
  [shield-charge]; Fortifying Cry shatters it too [mob-shield-wall]. Spears and crossbows: Storm Lance and
  Explosive Spear [mob-spear-amazon]; Stormblast and Mirage Archer [mob-witchhunter]. Wolf: Cross Slash detonates
  Shred's Ice Fragments [mob-wolfman].
- **Cautions:** 80% less if enemies break it within 0.5 s; Glacial Bolt's crystals have a like penalty
  [glacial-bolt].

### Meta trigger as a supply

- **Shape:** a Cast on X gem fires a spell for what it makes (a charge, a state), so its damage penalty is free.
- **Search:** the payoff's resource; spells making it (`mechanic "Power Charge" (gem)`, "Overgrown"); the Energy
  cap, 10 per 0.1 s of the spell's base cast time.
- **PoB:** not modelled: meta-gem Energy (PG-9); hand calculation, the resource by config.
- **Examples:** Invoker: Profane Ritual for Power Charges [mob-invoker]. Plant Oracle: Thunderstorm for Overgrowth
  [mob-plants]; [oracle].
- **Cautions:** the spell's level sets its cost [mob-plants].

### Self-firing buff

- **Shape:** a buff fires damage on a timer at targets it picks, so play is moving and refilling its gate.
- **Search:** Glory-gated buffs (`mechanic "Glory" (gem)`); kill chains (`mechanic "Overkill" (unique)`).
- **PoB:** hand calculation: each hit is modelled, the interval and Glory aren't (PG-7).
- **Examples:** Autobomber: Apocalypse on Entangle's Glory [mob-autobomber].
- **Cautions:** one niche study (20 favourites).

## 2. State consumers (builder and finisher)

### Builder that can't spend

- **Shape:** the payoff consumes a state the skill can't create, or the payload would take the engine's
  event; a "builds X but cannot cause X" support keeps it for the finisher.
- **Search:** `mechanic "cannot cause" (gem)`, "instead of"; check the lock's required types against the
  builder (gem lookup).
- **PoB:** config stand-in for the state where an option exists (Heavy Stunned, PG-32); who spends it first is
  not modelled. The payoff may be its own stat set.
- **Examples:** Wing Blast: Brink on Wind Blast; grenades failed because Brink supports Melee only
  [wing-blast]. Crossbow Titan: Pin II keeps the surges from taking the heavy stuns [crossbow].
- **Cautions:** run the payoff-thief audit.

### Staged handover

- **Shape:** the skill that applies the condition is the main and the payoff a burst, until supply lets the
  payoff take over.
- **Search:** for a skill with "Consumes X" or "Cannot X", list what applies X; check uptime with and
  without each.
- **PoB:** config stand-in: the condition on and off at a realistic uptime (checklist 6).
- **Examples:** Shockchain Arrow cannot shock; Lightning Arrow stayed main until Spreading Shocks raised
  supply [shockchain].
- **Cautions:** chains need several targets: ask what happens on one [shockchain].

### State-keyed payoffs

- **Shape:** list the states the build always applies, then collect "against X enemies" modifiers.
- **Search:** the skeleton's guaranteed states (Frozen, Cursed, Heavy Stunned); `mechanic "against <state>"
  (passive)`, then unique and mod.
- **PoB:** config stand-in where the option exists (Heavy Stunned, Dazed [crossbow], Isolated); else not
  modelled.
- **Examples:** Fangs of Frost: Exploit the Elements and Honourless against frozen enemies [fangs]. Ancestral
  Cry: Sine Aequo's 41% threshold keeps "against heavy stunned" on [ancestral-cry].
- **Cautions:** a consumer added later removes the state [fangs].

### Payoff thief (anti-pattern)

- **Shape:** an independent hit source spends the state, or takes the event, before the finisher does.
- **Search:** list every hit-making child: triggered skills, minions, ascendancy procs, explosions, item
  effects (a gem lookup's `Hit-making children:`, D-299); check the lock reaches each.
- **PoB:** not modelled: a risk, never a number.
- **Examples:** Wing Blast: gloves, stags, wolves and curse explosions stole the stun [wing-blast]. Fangs:
  Elemental Sundering consumed the freeze Honourless needed [fangs]. Flicker and spears: Charged Staff spends
  Flicker's charges [flicker]; every spear skill spends the same Frenzy Charges [mob-spear-amazon];
  [mob-glacial-lance].
- **Cautions:** re-run it whenever a consumer joins. Before a thief rules a piece out, try scheduling it on
  another button or set, or weigh it against the piece it robs (question 18): Spud puts Battershout on his clear
  cry, where packs die whether their armour stays broken or not [spud].

### Supply by family

- **Shape:** search what the payoff consumes by its whole family and its substitutes, from every kind of
  source; the best supplier may never name the resource, so follow every term you can't place.
- **Search:** the family, not the resource: `mechanic "Infusion" (gem)`, not "Cold Infusion"; Grep
  `-i 'creates: [^|]*<family>'` across `data/rules/` and `data/monsters/monster-mods.md` (`pairs.md` lists a
  family only when an entry also pays off on it), and the family's word in the league digest's body
  (`data/league/`); cover gems, uniques, passives, ascendancy nodes and monster modifiers; one lookup per
  unfamiliar term in a result ("Verisium Infusion") before stopping. Record each supplier in the research
  file's `## Supply search` (D-404).
- **PoB:** config stand-in for what the supply makes (Chilled Ground: "Is the enemy on Chilled Ground?"); the
  supply itself is not modelled: Powered by Verisium (the index: "PoB models it: no") and a beast's trail
  (PG-56).
- **Examples:** Navira's Fracturing: Powered by Verisium spends Runic Ward for Verisium Infusions, "used in
  place of any Elemental Infusions", so Ice Nova lays Chilled Ground without a freeze; a tamed beast's Frozen
  Ground Trail lays the same ground [comparison]. Our run searched "Cold Infusion" five times and missed it, and
  two researchers saw "Verisium Infusion Remnant" without asking what it was [feedback].
- **Cautions:** Powered by Verisium costs Runic Ward (20 at level 1, 155 at level 20), so it needs a Ward source
  [feedback]; that the guide's Frozen Ground Trail is the table's Trail of Ice is the table's inference.

## 3. Resource conversions

### Zeroed resource

- **Shape:** make a resource count for nothing, then harvest every drawback priced in it.
- **Search:** from the zeroing line (Chaos Inoculation, "does not affect"), search drawbacks in that
  resource (`mechanic "less maximum Life" (unique)`); check each costs nothing.
- **PoB:** modelled: CI, Black Scythe Training, Doryani's self side.
- **Examples:** HotG: under CI, Flesh Crucible's and Medved's life costs are free [hotg]. Enervating Nova:
  lightning resistance stops protecting you, so negative rolls are free [enervating].
- **Cautions:** patch the hole you open [enervating]; under CI the chaos floor needs D1's exception (D-234).
  Chaos Inoculation also makes you immune to bleeding at the pin [vid-defence-guide]. On five published builds it
  is worth ×1.12–1.28 on EHP and ×1.31–1.66 on the lowest max hit, since chaos otherwise drains energy shield at
  double rate [defence-layers].

### Not consume to 100%

- **Shape:** a chance not to consume, pushed to 100%, turns a per-use cost into a one-time unlock.
- **Search:** the skill's costs and gates (Glory, charges); `mechanic "not consume" (gem)`, "not remove",
  quality lines; work out the threshold.
- **PoB:** not modelled: Glory (PG-7) and charge retention (PG-29). Hand calculation: uses per second =
  income ÷ requirement, until 100%.
- **Examples:** HotG: 44% quality gives 110% chance not to consume Glory [hotg]. Stormcaller: 94% chance not
  to remove Barrage's charges [stormcaller].
- **Cautions:** a Glory-gated skill computes as spammable: its figure is an upper bound [hotg].

### Cost redirection

- **Shape:** costs move to a second pool (split pools), so the first stays full as a damage stat or a
  defence buffer.
- **Search:** from scaling keyed to a full pool (Archmage, Zenith, Mind over Matter), or from a resource that
  caps the build's rate (mana per cast); `mechanic "Life cost" (gem)`, "instead of Mana", "Converted to Life
  Costs"; then the paying pool's sustain.
- **PoB:** modelled: Archmage, Atalui's Bloodletting; Zenith is a config stand-in.
- **Examples:** Widowhail Spark: Lifetap and Atalui's move costs to life [widowhail]. Oracle Entangle: life
  pays, mana defends [oracle].
- **Cautions:** Wildsurge's cost cut shrinks the life cost Atalui's bonus reads [oracle].

### Cost to a gated resource

- **Shape:** a spent resource turns into a gated one (Glory, energy), so costs and drawbacks become fuel.
- **Search:** `mechanic "of Life spent" (gem)`; supports raising cost or cooldown uses; for a trigger event,
  supports whose drawback causes it.
- **PoB:** not modelled: Glory (PG-7), meta-gem energy (PG-9); hand calculation.
- **Examples:** Ancestral Cry: Zerphi's Infamy turns life spent into Glory [ancestral-cry]. Empyrean: Blood
  Mage's life costs fuel Starborn Onslaught [empyrean]. Bone Cage: Minion Pact's drain makes the minion
  deaths a trigger needs [bone-cage].
- **Cautions:** PoB applies Zerphi's more damage without its Glory requirement [hotg].

### Overflow resource

- **Shape:** a resource fills only while another is capped; a threat-scaled generator refills it when the
  burst matters.
- **Search:** `mechanic "while already at maximum" (gem)`, "counted monster Power"; rank by gain rate.
- **PoB:** not modelled (PG-7): hand calculation.
- **Examples:** Walking Calamity: Glory from Rage gained at maximum; Raging Cry by a boss fills it
  [walking-calamity].
- **Cautions:** Fireflower's self-damage firing Ngamahu's Chosen is unverified ("from a Hit").

### The enabler funds its own payoffs

- **Shape:** a forced-condition enabler's other line produces the resource its payoffs cost.
- **Search:** read the enabler's other lines against the payoffs' costs.
- **PoB:** modelled for low life from reservation [stormcaller]; the spirit line is not established, so not
  modelled until coverage shows otherwise.
- **Examples:** Gathering Storm: Beidat's Will reserves 25% of life and grants spirit per 25 life, paying
  for Direstrike II [gathering-storm].
- **Cautions:** "funds itself" is the study's inference.

### Mirrored stat

- **Shape:** an effect copies your stat onto enemies, so push yours low, with its drawback cancelled.
- **Search:** `mechanic "equal to yours" (unique)`; then every negative source of that stat (low rolls,
  Vaal outcomes, catalyst quality, Kalandra's Touch).
- **PoB:** modelled: enemy resistance set to yours, floored at −200, in Presence.
- **Examples:** Enervating Nova: Doryani's Prototype at −200% lightning resistance [enervating].
- **Cautions:** only enemies in Presence.

### Charge-type converter

- **Shape:** make one charge type cheaply and convert it to the type the payoff reads.
- **Search:** the payoff's type; `mechanic "instead of Endurance Charges" (passive)`, "random type" (gem).
- **PoB:** config stand-in for the counts; the rate is a hand calculation.
- **Examples:** Resonance with Armour Break III; Charge Profusion II [nerd-interactions].
- **Cautions:** Resonance changes every generator's type.

## 4. Stat bridges

### Stat-to-damage bridge

- **Shape:** a clause makes a non-damage stat, or another actor's stat, count for your damage ("also apply
  to", "also affects you").
- **Search:** `mechanic "also apply to" (gem)`, "also affect" (unique, passive), filtered by the skill's
  types; then the bridged stat's sources.
- **PoB:** modelled: Projectile Acceleration III; scope bridges not established.
- **Examples:** Widowhail and Twister: projectile speed becomes damage [widowhail] [twister]. Empyrean:
  Trenchtimbre makes minion attack speed yours [empyrean].
- **Cautions:** Twister's speed source, Primal Bounty, is not modelled (PG-16), and The Mhacha's Gift lags the
  game (PG-44).

### Pivot and broadcast bridges

- **Shape:** an "X also applies to Y" line carries invested X across a pivot, or broadcasts a stat to its
  siblings.
- **Search:** `mechanic "also applies to" (unique)`, then passive, with X an invested stat.
- **PoB:** not modelled until coverage shows otherwise (not established).
- **Examples:** Fangs: Sacrosanctum's recoup survived the CI pivot [fangs]. Bone Cage: Coal Stoker counts
  fire resistance at 50% for cold and lightning [bone-cage].
- **Cautions:** old sources; Sacrosanctum's values changed [fangs].

### Attribute bridge

- **Shape:** one attribute pays for both damage and defence.
- **Search:** from a "per X Strength" damage line (gem), search "per N Strength" defence lines in
  keystones, timeless jewels and uniques.
- **PoB:** modelled.
- **Examples:** Supporting Fire: minion damage per Strength; Black Scythe Training gives energy shield per 2
  Strength [supporting-fire].
- **Cautions:** Giant's Blood triples attribute requirements.

### Object stat as damage

- **Shape:** a support pays out a spawned object's stat as damage, so cheap modifiers on that stat scale
  damage.
- **Search:** from skills that spawn objects, `mechanic "Ice Crystal" (gem)`; then what raises the object's
  stat.
- **PoB:** custom modifier: Verglas (PG-22), X% extra cold with X = crystal life ÷ 2000.
- **Examples:** Earthshatter and Stormcaller: Frost Wall crystals feed Verglas [earthshatter]
  [stormcaller].
- **Cautions:** Verglas lasts 6 s.

### Stat-as-base convergence

- **Shape:** a damage source whose base reads a pool stat, plus every "per X of that stat" multiplier,
  compounds faster than linearly.
- **Search:** `mechanic "per 100 maximum" (unique)` with the stat, then passive; check mutated uniques.
- **PoB:** modelled, with the "Current Mana %" config option; Count stays 1 (a 1 s cooldown caps procs).
- **Examples:** Mana Flare Shaman: 25% of current mana as a hit, at 20k mana [mana-flare].
- **Cautions:** mutated uniques aren't in the data (PG-42); mana sustain is a hand calculation.

### Scale the scaler

- **Shape:** A is what the build scales (its damage, or the stat its hit reads); B scales A, C scales B and
  D scales C. Each link multiplies everything below it, and the higher pools are usually empty, so one line two
  links up can outweigh another increase in a damage pool that already holds hundreds of percent.
- **Search:** climb from the payoff one link at a time. Search the last link's name as the target of a line,
  not as a stat to stack: `mechanic "effect of <link>"`, then "bonuses gained from", "also apply to",
  "per … <link>", "to Level of" and "Quality", across gems, uniques, the tree, ascendancy nodes, runes and
  base implicits. Do each link's arithmetic before compiling (300% quiver effect is a 4× quiver). Stop when
  the next link would multiply something small, or costs a slot a plain damage line would beat.
- **PoB:** modelled: quiver effect [widowhail], rune effect and Bonded lines [mana-flare]; check coverage at
  every link, since one unparsed link hides the whole chain above it.
- **Examples:** Widowhail: Spark's damage ← projectile speed (Projectile Acceleration III) ← the quiver's
  lines ← Widowhail's "increased bonuses gained from Equipped Quiver" (280%) ← the tree's 32% on top, for 300%
  and a 4× quiver [widowhail]. Mana Flare Shaman: a hit worth 25% of current mana ← maximum mana ← six Mind
  Runes ← Runeseeker's Call's "200% increased effect of Socketed Runes", with Wisdom of the Maji turning on the
  runes' Bonded lines: 1,620 flat mana and 90% increased from the wand alone [mana-flare].
- **Cautions:** a link is worth nothing until the one below it is built up (a 300% Widowhail over a weak
  quiver), so a ranking of single upgrades by DPS never climbs: assemble the chain on paper first, as with A
  count as a multiplier. A search that stops at B finds what the obvious build already has (question 11).

### Damage-source substitution

- **Shape:** the skill's damage reads something other than the weapon, so only what reads that source
  counts.
- **Search:** read the skill's added-damage stats (gem lookup); keep supports and mods that read it.
- **PoB:** modelled: shield armour damage parses on Shield Wall and Shield Wave (coverage) [mob-shield-wall].
- **Examples:** Shield Charge: shield armour is the damage [shield-charge].
- **Cautions:** re-audit supports when the source moves [shield-charge].

### Defence that scales damage

- **Shape:** a defence stat also pays damage (block, armour); a layer sized from another is Derived defence layer.
- **Search:** `mechanic "per 1% Chance to Block" (passive)`, "of Armour"; then unique and gem.
- **PoB:** modelled: block to damage, Refraction III; Arctic Armour's per-stage armour is not modelled
  (PG-30), so armour reads low.
- **Examples:** The Eraser and Infernal Cry: block as damage [eraser] [infernal-cry]. Earthshatter: armour
  into exposure [earthshatter].
- **Cautions:** a layer sized from another stat costs some of it: Sorcery Ward takes armour
  [walking-calamity] (0.4). At the pin PoB sizes the ward itself at 30% of armour plus evasion, so a custom
  line for it counts it twice [defence-layers].

### Type conversion so another mechanic applies

- **Shape:** change the damage type, or grant a type permission, so another mechanic applies.
- **Search:** after an "instead of", "Converted" or "can <ailment>" line, search the new type's phrase
  (`mechanic "Chaos damage over time" (gem)`).
- **PoB:** modelled: Blackflame's chaos ignite; the spread is not modelled (PG-21).
- **Examples:** The Eraser: Blackflame's chaos ignite lets Contagion spread it [eraser]. Twister: cold
  conversion lets freeze apply [twister].
- **Cautions:** a non-DPS floor may follow: ignite of at least 2 s [eraser]. Converted damage scales by its new
  type only (the damage-order rule, "How to read an entry").

### Convert into the ailment's type

- **Shape:** an ailment reads one type of the hit (ignite fire; bleeding physical; poison physical and chaos).
  Converting every source of the hit into that type, added and gained damage included, makes the whole hit feed
  the ailment. The ailment then scales with its type's increases, damage over time, its magnitude and its
  duration.
- **Search:** from a conversion line (Avatar of Fire, "Converted to"), the ailment's magnitude, chance and
  duration (`mechanic "Ignite Magnitude"`, "Magnitude of Bleeding", "Flammability"), lines that let another type
  count ("also Contributes to": Blistering Bond), and the base shares (kind `constant`).
- **PoB:** modelled: ignite, bleeding and poison read the hit after conversion (pin: `Modules/Data.lua:440`,
  `Data/Misc.lua:86-96`).
- **Examples:** Spud's warcry Warbringer: Avatar of Fire makes every hit fire, so the whole hit ignites, and
  Blistering Bond lets the same fire set bleeding's magnitude [spud].
- **Cautions:** the keystone forbids every other type, so an ailment that reads another type needs a line like
  Blistering Bond's. A support that forbids ailments (Elemental Focus) turns the layer off. Only the strongest
  ignite applies, so it favours big hits over fast ones (the creator's claim, [spud] §5).

## 5. Copies and rate

### Proxy multiplier

- **Shape:** copies or helpers fire the damage source again; instances up at once = duration ÷ cooldown,
  or the limit.
- **Search:** meta gems accepting the skill (the gem lookup's `Usable by:`, D-299: Snipe lists Mirage
  Archer); `mechanic "Repeat" (gem)`, "fired at".
- **PoB:** Count: mirages (PG-4), Spell Cascade (PG-6), mimics (PG-14), Now and Again (PG-15), aftershocks
  (PG-24); Tornado Shot's copies are zero (PG-21).
- **Examples:** Mirage Sniper: about 6 Mirage Archers fire Snipe [mirage-sniper]. Enervating Nova: Spell
  Cascade and mimics [enervating]. Totems: Spell Totems [mob-arc-totems] and ballistas [mob-ballista], their count
  unmapped (PG-68).
- **Cautions:** coverage gives Mirage Archer a false all-clear (PG-49); Count also multiplies per-copy
  reservation [worklog].

### Repeat to cap

- **Shape:** the payload adds N stacks per trigger against a cap M, so an echo turns one press into
  ceil(M/N) triggers.
- **Search:** pair a stacks-per-application stat with a stage limit (gem lookup); then echo supports.
- **PoB:** config stand-in: the stack count option; Count stays 1.
- **Examples:** Infernal Cry: Echoing Cry fills Corrupted Blood's 10 stacks in one press [infernal-cry].
- **Cautions:** whether the echo's damage penalty reaches the payload is unconfirmed.

### Cooldown recovery as DPS

- **Shape:** a skill held by its cooldown is multiplied by cooldown recovery; a buff that procs on a kind of
  skill is fed by its cheapest one (a proc farm).
- **Search:** cooldown above use time: `mechanic "Cooldown Recovery" (passive)`; `mechanic "when you use a"
  (passive)`, then rank that kind's skills by cost.
- **PoB:** Count about 2.5, hand-derived: Archon of Undeath is not modelled (PG-11).
- **Examples:** Supporting Fire: Archon's 200% more command cooldown recovery, proc-farmed [supporting-fire].
  Varashta: Archon feeds the ramp [varashta].
- **Cautions:** the 2.5 holds only while the cooldown limits; the proc spam is the creator's claim.

### Sequence ramp fed by use rate

- **Shape:** damage ramps with consecutive uses inside a window, so more uses per window multiply it.
- **Search:** the skill's text: "per consecutive", "in sequence"; then cooldown recovery or extra uses for its
  type.
- **PoB:** custom modifier at the expected step (PG-25); Count is the wrong tool for ramps.
- **Examples:** Varashta: Kelari's Deception, 50% more per consecutive use up to 300% [varashta].
- **Cautions:** PoB never checks the node that unlocks it (PG-40).

### Count events, not damage

- **Shape:** when the payoff counts qualifying hits, add cheap hits that always qualify, trading size for
  rate.
- **Search:** the noun in the engine's trigger; `mechanic "always Critical" (gem)`; rate-for-size supports.
- **PoB:** Count = crystals shattered per second, a hand calculation (PG-17).
- **Examples:** Eventide Petals: always-crit bells and Pinpoint Critical [eventide].
- **Cautions:** the Count holds only if PoB rates the crystal at one use per second [eventide].

### Burst-window stacking

- **Shape:** temporary and next-hit multipliers lined up for one charged release.
- **Search:** list cries, mantras and combo buffs; confirm each applies to the release hit.
- **PoB:** not modelled until coverage shows otherwise (not established).
- **Examples:** Gathering Storm: four buffs before the dash [gathering-storm].
- **Cautions:** the charge-up is the exposed phase.

### Stacking rate caps

- **Shape:** a ramp gains per hit and may cap stacks per second, so a few big hits gain little.
- **Search:** the ramp's text; stacks per second at the real hit rate.
- **PoB:** hand calculation: rate caps aren't in the data (PG-45).
- **Examples:** Shield Charge: Inner Turmoil's one stack per 0.1 s gave 5–6 stacks [shield-charge].
- **Cautions:** reject ramps that want many small hits for a big-hit build.

### Speed as a damage dial

- **Shape:** when damage grows with travel or the emitter moves, projectile speed is a dial both ways;
  many small hits turn per-hit effects into sustain.
- **Search:** "constantly releases", "gains damage" in gem text; hits per second to rank per-hit mods.
- **PoB:** not modelled until a skill-shape probe shows otherwise (checklist 8): a Path of Exile 1 source.
- **Examples:** Eye of Winter: Slower Projectiles raised damage [eye-of-winter].
- **Cautions:** none of its game facts apply to PoE2.

### Travel by action

- **Shape:** the build moves by an action it scales (a closing strike, a dodge roll, a teleport): buy its
  rate or reach, not movement speed. A travel skill covers a fixed distance, so it covers ground faster as attack,
  cast or skill speed rises; Leap Slam's travel adds up to 0.5 s to its attack time (the user, 2026-10-19 [worklog]).
- **Search:** the Travel skills, `mcp__pob2__list_gems {skill_type: "Travel"}` (C-56); relocating actions
  (`mechanic "teleport" (gem)`, "Dodge Roll distance") and their speed sources.
- **PoB:** not modelled: travel is no output; the compile record gives a travel skill's uses a second (`travel`,
  D-427).
- **Examples:** Boneshatter at 6.76 attacks a second; Lightning Warp to Ball Lightning [nerd-interactions].
- **Cautions:** a strike's travel needs in-game testing.

### Duration to the floor

- **Shape:** a skill built around a delay (a fuse, a hover, a ritual) fires at once at its minimum duration.
- **Search:** delay text ("at the end of their duration"); then `mechanic "reduced Skill Effect Duration"
  (passive)`, Compressed Duration, Overabundance.
- **PoB:** not modelled until coverage shows otherwise (not established).
- **Examples:** Spearfield with Delayed Reaction; Profane Ritual at 0.13 s [nerd-interactions].
- **Cautions:** duration often pays damage too.

### Bank the resource

- **Shape:** a supply stored between packs (infusions held, charges kept full) lets the engine fire as the
  player arrives, so it clears faster than one made on the spot.
- **Search:** from the consumed resource, what raises its maximum (`tree "Infusions"`, `mechanic "maximum
  Power Charges" (passive)`), then what refills it between packs; compare the refill time with the walk to the
  next pack.
- **PoB:** not modelled: pace is no output. The record's clear-speed band reads the skill's area, with movement
  speed beside it (D-407); the card's "How it clears" estimates the time to first damage.
- **Examples:** Navira's Fracturing banks Verisium Infusions between packs with the three infusion-limit
  passives (Frozen, Infernal and Shocking Limit: +1 to maximum Cold, Fire or Lightning Infusions, pin:
  `TreeData/0_5/tree.lua`), so the nova lays ground on arrival; ours made ground only as skeletons died inside
  the pack [comparison]. Whirling Assault Monk: Killing Palm on the bells fills Power Charges before a boss
  [ronarray-videos].
- **Cautions:** the banking is the comparison's reading, not measured, and whether the elemental limits hold
  Verisium Infusions is unchecked; a second spender drains the bank (Charged Staff spends the Power Charges
  Flicker needs) [flicker].

## 6. Levels, quality and tags

### Level-carrier host

- **Shape:** a support-granted skill takes the host's level (the creator's claim), so pick the host for its
  +level sources.
- **Search:** support-granted skills with a level table on a one-level support; rank hosts by +level
  sources.
- **PoB:** not modelled (PG-2): set the support's level by hand (untested).
- **Examples:** Infernal Cry: Twisted Pact at 39 in game, about 3 in PoB [infernal-cry].
- **Cautions:** the game rule is unverified; lineage supports need level 65.

### Quality as a stat line

- **Shape:** quality grants a second effect (Gemling, or a gem's own line), so quality scales.
- **Search:** each gem's quality lines, Gemling lines labelled (gem lookup, D-299; PG-46).
- **PoB:** modelled where mapped (47 of 244 Gemling stats aren't, PG-31); Gem Studded ties give one colour
  (PG-1).
- **Examples:** Stormcaller: +1 arrow per 10% quality [stormcaller]. HotG: Glory retention [hotg].
- **Cautions:** the user expects a Gemling nerf in 1.0 [worklog]; a quality threshold is a stage.

### Low-level utility gems

- **Shape:** a gem whose job isn't damage stays low-level to cut its cost.
- **Search:** read each utility gem's cost by level (gem lookup).
- **PoB:** modelled.
- **Examples:** Glacial Bolt: Verisium at 8, Entangle at 2 [glacial-bolt]. The Eraser: Contagion at 1
  [eraser].
- **Cautions:** an over-levelled gem can lock you out on attributes [empyrean].

### Type-granting support unlock

- **Shape:** a support adds a skill type another support requires.
- **Search:** the skill's gem lookup, its `Unlocked by another support:` line (D-299): each support it
  gains, after the supports that add the types it requires.
- **PoB:** not modelled until coverage shows otherwise, for the unlocked effect (not established).
- **Examples:** Flicker Monk: Culmination II lets Ailith's Chimes support Whirling Assault [flicker].
- **Cautions:** "infinite power charges" is the creator's word.

### Tag audit

- **Shape:** the payoff's skill types decide which +level sources and supports reach it.
- **Search:** the payoff's types (gem lookup); the matching +level and "X skills" mods.
- **PoB:** modelled: level bonuses match tags.
- **Examples:** Walking Calamity: only "+level of fire skills" applied [walking-calamity]. Fangs: the Area
  tag let area supports hit the stab [fangs].
- **Cautions:** check which part each support touches (checklist 5); Excise adds the Cooldown type Garukhan's
  Resolve can't support [mob-invoker].

### Filler to satisfy a count

- **Shape:** cheap gems or minions raise a counter (support colours, socketed gems, minion types).
- **Search:** `mechanic "different type" (gem)`, "for each"; count what the plan holds.
- **PoB:** modelled, but Gem Studded ties wrongly (PG-1) and Muster counts by granted effect (PG-3).
- **Examples:** Stormcaller: unused supports for 17/17/17 [stormcaller]. Supporting Fire: a Muster zoo
  [supporting-fire]. Three Gemlings: supports picked to tie Gem Studded's colours [mob-arc-totems];
  [mob-ballista]; [mob-grenades].
- **Cautions:** in PoB a 17/17/17 balance gets Red only. When the count multiplies damage, see A count as a
  multiplier.

### A count as a multiplier

- **Shape:** a multiplier that grows with a count (minion types) is worth building around once the count is
  high, and something else pays for each step (Spirit for a type); see Filler to satisfy a count for counters
  that only unlock.
- **Search:** `mechanic "each different type" (gem)`, then passive; for each count, what pays for one more
  (Spirit, a socket group), and rough arithmetic before any compile: Muster at eight types is 7% × 8, about
  ×1.56.
- **PoB:** modelled for Muster, by PoB's own count, which runs one or two types high (PG-3, PG-53); At your
  Command adds nothing (PG-52), so a custom modifier stands in at the build's type count. Demolitionist: config
  stand-in, `# different Grenade Types Shot`.
- **Examples:** Navira's Fracturing: about eight types on a sceptre's 334 Spirit, where Muster measures ×1.63
  [comparison]. Supporting Fire: a zoo of the cheapest types for Muster [supporting-fire]. Varashta: a new
  skeleton type with each Spirit gain [varashta]. Gemlings: Demolitionist's grenade types [mob-grenades]; Spell
  Totem's cast-speed line per totem, each 75 Spirit [mob-arc-totems].
- **Cautions:** at two or three types it loses to a plain damage support, so a slot-by-slot ranking drops it
  and no run of single upgrades reaches the army [comparison]; count the reviving types by hand (PG-53).

## 7. Conditions

### Forced condition

- **Shape:** make a condition always true by lowering its threshold or reserving into it.
- **Search:** from a "while X" payoff, search X (passive, unique); thresholds: "fewer", "instead of";
  reservation: "Reserves".
- **PoB:** config stand-in; modelled where PoB derives it (low life from reservation, Surrounded at one
  enemy).
- **Examples:** Gathering Storm: Coward's Legacy and Beidat's Will hold life at 75% [gathering-storm]. HotG:
  Constricting Command makes one enemy surround you [hotg].
- **Cautions:** permanence needs reservation of at least 1 minus the threshold; Crushing Blows are unparsed
  (PG-32).

### Outcome lock

- **Shape:** a node fixes a random effect to its best variant.
- **Search:** `mechanic "are Purple" (passive)`, "All"; ascendancy text.
- **PoB:** modelled for your own flames.
- **Examples:** Chayula: every flame purple [chayula-minions].
- **Cautions:** relayed to minions, see Buff relay.

### Saturated type count

- **Shape:** one enabler fills a "per distinct type" counter, so every scaler reading it is full.
- **Search:** `mechanic "for each type of" (passive)`, from an item granting several types.
- **PoB:** config stand-in: tick all three ground boxes (PG-35).
- **Examples:** Twister: The Taming feeds Harness the Elements and Trinity [twister].
- **Cautions:** Trinity wants the three elements kept balanced [twister].

### Drawback cancellation and offload

- **Shape:** a node removes a penalty, or a "cannot X" support sits where another skill supplies X.
- **Search:** nodes reducing each drawback (passive); supports saying "cannot", then a free slot for X.
- **PoB:** modelled for Gem Studded's movement line; the offload not established.
- **Examples:** Shockchain: Gem Studded's movement penalty cut [shockchain]. Twister: Blindside's lost Blind
  comes from the companion [twister].
- **Cautions:** check the bonus doesn't need what it stops.

### Harmless self-trigger

- **Shape:** cancel an event's damage to you, then cause it on purpose for a payoff scaled by it.
- **Search:** self-event payoffs ("per … exploded"); `mechanic "Take no Damage from" (passive)`; `mechanic
  "detonate" (gem)`.
- **PoB:** custom modifier at the expected size; the volatility nodes don't parse.
- **Examples:** volatility with Inner Turmoil and Catharsis [nerd-interactions].
- **Cautions:** the base chaos payoff isn't in the pin.

## 8. Item and slot tricks

### Amplified slot as stat stick

- **Shape:** wear an item the skill doesn't use because it multiplies another slot's matching mods.
- **Search:** mods by the skill's tags; `mechanic "bonuses gained from Equipped" (unique)`.
- **PoB:** modelled; a roll above the data range is typed in (PG-41).
- **Examples:** Widowhail Spark: a caster's bow for a ×4 quiver [widowhail].
- **Cautions:** a 0.4 source.

### Socket amplifier plus latent lines

- **Shape:** an item multiplies its sockets, and an ascendancy turns on hidden lines there.
- **Search:** `mechanic "effect of Socketed" (unique)`; the runes' Bonded lines.
- **PoB:** modelled.
- **Examples:** Mana Flare: Runeseeker's Call triples runes; Wisdom of the Maji enables Bonded lines
  [mana-flare].
- **Cautions:** the creator reports one rune line not tripled.

### Support moved to gear

- **Shape:** an item mod copying a support gem frees its slot.
- **Search:** each planned support's effect (unique, mod).
- **PoB:** not modelled until coverage shows otherwise (not established).
- **Examples:** Empyrean: bleed-chance armour replaced Bleed I [empyrean].
- **Cautions:** the armour's name is unchecked.

### Skill granted by an item base

- **Shape:** an implicit skill on a base can be the main skill, free to cast and scaled by +levels.
- **Search:** item-base implicits (`mechanic "<skill>" (base)`, D-299); the skill's roll range.
- **PoB:** hand calculation: Enervating Nova's edge bonus is unmapped (PG-26).
- **Examples:** Enervating Nova on a Paralysing Staff [enervating].
- **Cautions:** a wide roll favours min-or-max and luck.

### Bimodal roll plus luck

- **Shape:** min-or-max rolls change nothing alone; add lucky and the max lands 75% of the time.
- **Search:** "minimum or maximum" and lucky sources of the damage type.
- **PoB:** hand calculation: PoB averages lucky as uniform (PG-8), about 7% low.
- **Examples:** Enervating Nova: Esh's Prowess with 48% lucky [enervating].
- **Cautions:** check the roll range first.

### Weapon set 2 job

- **Shape:** the second weapon set does what set 1 can't (a buff, a boss button, a more-damage support); one
  weapon locked to both sets makes it a second set of skills and points.
- **Search:** skills needing another weapon (gem lookup); items that prime the resource (unique).
- **PoB:** not modelled: a buff cast from set 2 at its higher level (the level carrying over is unverified: the
  creator hedges) [ancestral-cry]; Gem Studded counts every set's supports [hotg]; "active in both weapon sets" is
  never read (PG-70).
- **Examples:** HotG: Fury of the King primes Glory [hotg]. Wing Blast: the builder on set 2 [wing-blast].
  Witchhunter and Poison Pathfinder: a boss ammo on set 2 [mob-witchhunter]; Rigwald's Ferocity's damage set
  [mob-poison].
- **Cautions:** a swap ritual is input demand; Eternal Rage and Sacrifice must be active in both sets (pin).

### A weapon set per skill

- **Shape:** each weapon set holds up to 24 passive points of its own, and using a skill assigned to a set swaps to
  it, so two skills that scale differently each get a tree. Three shapes: two trees for two skills; two weapons
  sharing an off-hand (a mace in set 1, a wand in set 2, one shield); both items in both sets, so the swap changes
  only the tree (the user, and poe2wiki's "Weapon set" as the user pasted it, 2026-10-19 [worklog]).
- **Search:** where the card's skills want different notables or weapons, give each a set: the plan's
  `skills.groups[].weaponSet` and `tree.weaponSetNodes`; the card names its weapon-set use (D-426).
- **PoB:** modelled: set passives apply on their set only, a group follows its set's slot
  (`Modules/CalcSetup.lua:854`, `:1729`), and the compile measures set 2 on a stage that uses it; supports count
  across both sets (PG-71).
- **Examples:** Spud's Warbringer: Hammer of the Gods on set 1's Hoghunt with crit notables, the warcries on set 2's
  wand and shield with warcry notables [spud] §9. Witchhunter: one crossbow in both sets [mob-witchhunter].
- **Cautions:** set points are converted regular points, not extra ones; keystones and jewel sockets can't be set
  passives; a swap drops Life to a lower new maximum; Blink must be on both sets (the wiki, [worklog]).

### Off-tree defence layer

- **Shape:** a defence from gear and a spirit skill, refilled on kill, frees the tree's defence points.
- **Search:** `mechanic "Runic Ward" (unique)`; refills: `mechanic "Remnant" (gem)`.
- **PoB:** modelled in part: Runic Ward is a pool in EHP and the max hit (the Comet Infernalist's Brass Dome and
  weapon: ×1.23 and ×1.57 [defence-layers]); its regeneration, guard and Remnant lines are unparsed (coverage).
- **Examples:** Brass Dome, Olroth's Resolve, Remnants of Kalguur [nerd-interactions].
- **Cautions:** it costs the chest's 60-spirit prefix.

## 9. Actors

### Inert minions

- **Shape:** minions that deal no damage serve as triggers, headcount or carriers.
- **Search:** `mechanic "deal no Damage" (gem)`; per-minion multipliers.
- **PoB:** config stand-in: Predator's Mark's count; Muster counts by granted effect (PG-3).
- **Examples:** Mirage Sniper: 14 wolves for Predator's Mark [mirage-sniper]. Maelstrom: clerics as corpses
  [maelstrom].
- **Cautions:** Glacial Bolt's minion detonation is in no game text, so it fails the sniff test
  [glacial-bolt].

### Buff relay

- **Shape:** a support or item turns a player-only buff into one on allies or minions.
- **Search:** `mechanic "instead of you" (gem)`, "as well as you"; check the stat is skill-agnostic.
- **PoB:** custom modifier (PG-27), "Allies in your Presence Gain N% of Damage as Extra Chaos Damage", with
  Count = the minions.
- **Examples:** Chayula minions: Selfless Remnants relays purple flames [chayula-minions].
- **Cautions:** Presence radius is uptime; a dead minion loses the stacks.

### Actor rerouting

- **Shape:** you press the button but another actor deals damage, opening its multiplier pool.
- **Search:** granted commands (`tree` on the ascendancy, gem lookup); the actor's multipliers.
- **PoB:** modelled as the group's `minionSkill`, its unlock unchecked (PG-40); Archon not modelled (PG-11).
- **Examples:** Varashta: Kelari's Deception as minion damage [varashta].
- **Cautions:** Muster's count may differ in game (PG-3).

### Reactive carrier

- **Shape:** a defensive buff that deals spell hits carries a trigger support.
- **Search:** spells with damage and buff types (gem lookup).
- **PoB:** not modelled until coverage shows otherwise (not established).
- **Examples:** Mana Flare: Arctic Armour carries Mana Flare [mana-flare].
- **Cautions:** the creator's description only.

### Movement delivers the radius

- **Shape:** a self-centred aura or curse rides a skill that lands you among enemies.
- **Search:** if the skill ends in melee range, list proximity auras and curses.
- **PoB:** not modelled until coverage shows otherwise (not established).
- **Examples:** Gathering Storm: Blasphemy on the dash [gathering-storm].
- **Cautions:** match the delivery to how the skill moves you.

### A tamed rare beast

- **Shape:** a tamed rare beast keeps up to four of its monster modifiers, which supply a condition (a ground
  trail) or stats (an aura's speed for its allies), and it reserves a percentage of Spirit, not a flat amount.
- **Search:** the engine's family in the index of `data/monsters/monster-mods.md` (`chilled-ground`), then the
  block by its heading (`grep -n -A14 '^### Trail of Ice'`): its `Model`, its `Reach` (the beast, or its allies
  within 5 metres) and its `Config`; the plan names the beast as `companion {species, mods}` (D-402).
- **PoB:** custom modifier for a `stats` row (`Companions have …` for the beast's own, each an estimate); config
  stand-in for a `condition` row; not modelled for a `none` row (PG-56). The beast's damage and reserved Spirit
  are measured from its species (D-402).
- **Examples:** Navira's Fracturing: a beast with Frozen Ground Trail lays the Chilled Ground the command
  consumes, in the guide's text only [comparison]. Infernal Cry Gemling: a Plague Harvester with a physical
  damage aura and "all damage shocks", kept alive by Brutus' Brain [infernal-cry]. Beast Master: a rare tame
  kept for Haste Aura beside Mighty Silverfist [mob-beastmaster].
- **Cautions:** the cost is 13.8–56.1% of maximum Spirit by species (32.7% at the median,
  `Modules/CalcDefence.lua:204`), so it grows with the Spirit a build stacks, unlike a flat-cost minion's (the
  user, [amendment-8] §4); Haste is "usually the mod that most players prioritize" (the user, [amendment-8] §4),
  and the Haste most players prioritize is Haste Aura [mob-beastmaster] §8: the table's Hasted speeds the beast
  alone, Haste Aura its allies; every keep flag is an inference (the table);
  a minion that deals no damage applying shock is doubtful [infernal-cry].

## 10. Tree

### Minimize travel distance

- **Shape:** judge a cluster by its gain per point with its path, never by its gain alone: a tree that runs one
  route out through its clusters beats long branches to separate clusters of average payoff (the user,
  2026-10-19: "minimize travel distance").
- **Search:** `mcp__pob2__get_node_power` on the loaded build: unallocated nodes by path gain per point, allocated
  branches by loss per point, the travel count (points that give nothing alone) and the best legal swap.
- **PoB:** modelled: node power is PoB's own ranking, on any stat it offers; it can't see sustain, area, a
  boss-only gain on a clear config or an attribute a gem needs, so those are the tree's needs.
- **Examples:** Executioner's Howl (Warbringer, Arctic Howl): reachable nodes worth 13–19% Full DPS each sat
  unallocated while two Dexterity branches of 7 and 8 points gave nothing [amendment-9] §1, §4.
- **Cautions:** gains aren't additive, and paths change once a branch is removed: measure a swap on the tree
  after the removal; a branch that looks idle may hold the floor or the sustain.

### Keystone as pathing anchor

- **Shape:** passives near a keystone are allocated without a path, so keystones are taken for their radius.
- **Search:** the ascendancy's nodes; keystones with harmless drawbacks near wanted notables.
- **PoB:** not modelled until coverage shows otherwise (not established).
- **Examples:** Oracle Entangle: Entwined Realities [oracle].
- **Cautions:** a 0.5.5 source.

### Node-effect multiplier steers cluster choice

- **Shape:** "increased effect of Small Passive Skills" makes small-node clusters the best paths.
- **Search:** `tree "effect of Small Passive Skills"`; rank clusters; force their conditions.
- **PoB:** modelled.
- **Examples:** Ancestral Cry Titan: Hulking Form with Constricting Command [ancestral-cry].
- **Cautions:** conditional small nodes need their condition forced.

### Radius jewel instead of an anoint

- **Shape:** a radius jewel reaches notables, or saves travel, without a path or the anoint.
- **Search:** before an anoint, check whether a radius jewel such as From Nothing reaches the notable.
- **PoB:** modelled.
- **Examples:** Twister: From Nothing near CI reaches Heavy Frost [twister]. From Nothing in 9 and Controlled
  Metamorphosis in 3 of 30 published league starters, the largest single-jewel effects there: up to ×1.23 EHP
  and ×1.58 damage [defence-layers]. Controlled Metamorphosis [vid-build-process].
- **Cautions:** From Nothing's radius belongs to one named node. Controlled Metamorphosis costs 5–20% of every
  elemental resistance. Our compiler's connection check may refuse the disconnected nodes (read from the code,
  untested).

### A rule changer

- **Shape:** a node, keystone, gem or unique changes how a standard mechanic works, so what it touches (a
  slot, a resource) becomes worth building around; a naive search misses it, because it doesn't name what it
  enables.
- **Search:** read `data/rules/nodes.md`'s section for the brief's ascendancy, and its keystones, whole; Grep
  `data/rules/uniques.md` and `gems.md` by mechanic or family (`Creates:`, `Pays off on:`), and `pairs.md` for
  the engine's families; confirm each entry's lines with a lookup (`tree "Stonefist"`, a unique or gem lookup).
- **PoB:** not modelled where the entry says "PoB models it: no": Way of the Stonefist's transform (PG-36), so
  type the transformed modifiers; otherwise as the entry's line says, from coverage.
- **Examples:** Way of the Stonefist (Martial Artist) turns equipped gloves into Fists of Stone with stronger
  related modifiers [comparison]: flat-damage glove mods become gain as extra [flicker], and +melee levels
  become gem quality, Shattering Palm's crit [eventide].
- **Cautions:** a pair is a lead, not a proof; a unique's entry lists only its explicit penalties, while most
  uniques give up the resistances, life and defences a rare provides (the user, [amendment-8] §1).

## 11. Defence

### Defence layers in hit order

- **Shape:** a hit meets the chance layers first (evade and block stop it; deflection takes 40% off it), then the
  mitigation every hit gets (armour, resistances, a physical shift, an enemy-damage curse), then a pool (life,
  energy shield, mana taken first, a barrier, an ally's share); the chance layers raise only EHP, mitigation and the
  pool raise EHP and the max hit alike.
- **Search:** the class's attributes and armour bases give the first layer (the defence line in Standard kits), then
  what it feeds (Derived defence layer); then a pool line for the Arbiter's worst type: `mechanic "to maximum Life"
  (mod)`, `mechanic "to maximum Energy Shield" (mod)`, `mechanic "taken from Mana before Life"`. Read the record's
  EHP and Arbiter verdict together.
- **PoB:** modelled: the chance layers count in `TotalEHP` only, as averages (deflection as each hit × (1 − chance ×
  40%)); the max hit assumes every chance roll fails and counts deflection only at 100%, which its 95% cap rules
  out. Mitigation and pools count in both. Recovery, stun and control count in neither.
- **Examples:** in 30 published league starters, factors on EHP and on the max hit: evade ×1.25–5.05 and ×1.00;
  deflection ×1.01–1.61 and ×1.00; 50% block ×1.60 and ×1.00; armour on eight armour builds ×3.0–9.5 and ×1.19–1.88;
  resistances ×1.30–2.24, and ×1.00 on physical unless shifted; energy shield beside life, median ×1.69 and ×1.72;
  Sorcery Ward ×1.70–1.96 on both [defence-layers]. The layers by where a hit meets them [vid-scale-defence]; one
  hit traced through the checks [vid-defence-guide].
- **Cautions:** an EHP target can be met on chance layers alone, so read the Arbiter verdict for the max hit.
  Deflection is damage reduction on the hits it deflects: its 40% doesn't shrink as the hit grows, where armour's
  share does (armour ÷ (armour + 10 × hit)), but a hit it misses lands whole. Under PoB's unlucky switch the 16
  builds over 40% evade lose 32–45% of EHP, and armour, energy shield and mana builds 0–11%. Armour is sized on the
  hit, and the reference hit is small, so armour's EHP factor overstates it against a boss slam. A creator's rule
  that three of four layers make a character sturdy fails: the Beast Master has three and is one-shot
  [defence-layers]. The chance layers stop no damage over time.

### Defence the gate can't see

- **Shape:** recovery, control, decoys and thresholds keep a character alive between hits but raise neither EHP nor
  the max hit, so they go beside the gate's figures, never in them.
- **Search:** ailments that stop enemies acting, and slows (`mechanic "Slow" (gem)`, Temporal Chains); recovery
  (`mechanic "Recouped"`, leech, regeneration, instant flask recovery from a Utility Belt and flask suffixes, energy
  shield recharge); thresholds (`tree "Stun Threshold"`, `tree "Ailment Threshold"`); then coverage for the build's
  unparsed defence lines.
- **PoB:** not modelled as defence: recovery has its own figures, stun its own chance, control and decoys nothing.
  Report these beside EHP and the Arbiter verdict, never instead.
- **Examples:** Fangs: freeze and slows carried bosses [fangs]. Shockchain: electrocute [shockchain]. In 30
  published league starters, by line pattern: regeneration in 26, instant flask recovery in 24, stun lines in 24,
  leech in 19, slows on enemies in 16, chill or freeze in 15, recoup in 8; each has 2–23 unparsed defence lines,
  most often Nascent Hope's recharge, Ghost Dance and Lavianga's Spirits [defence-layers]. Instant recovery, slows,
  and stun and ailment thresholds [vid-secret-defence].
- **Cautions:** say plainly when control carries. Enemy-damage curses are the exception the gate does see, at
  map-monster strength in both figures (Enfeeble ×1.52); PoB halves curse effect on a pinnacle boss, and at half
  strength no reference verdict flips (estimate) [defence-layers]. Deflection also cuts the damaging ailments a
  deflected hit inflicts by its prevented share (the user, 2026-10-26), on average chance × prevented share (70%
  deflect: 28% less); resistances multiply apart from it, so an ignite under 75% fire resistance and 70% deflect
  does 0.25 × 0.72 = 18% of its raw size. PoB sizes enemy ignite and poison from the raw hit, with resistance on the
  damage over time, but applies no deflection and never models enemy bleeding. Staunch Deflection stops deflected
  hits inflicting bleeding and maim. Decoy minions are unverified: PoB has no model of what monsters target.
  Blasphemy's curses have 41% less magnitude at the pin [vid-secret-defence].

### Derived defence layer

- **Shape:** a line grants one defence as a share of another (deflection from evasion or armour, armour against
  elemental hits, a slot's evasion or armour from its energy shield, a barrier sized from armour and evasion), so
  one stat buys two layers.
- **Search:** `mechanic "Deflection Rating equal to"` (mod, unique, passive); `mechanic "of Armour also applies to
  Elemental" (mod)`; `tree "Item Energy Shield on Equipped"`, `tree "Item Evasion"`; gem lookup "Sorcery Ward"; then
  the source stat's size at the rung.
- **PoB:** modelled: deflection comes from final evasion and armour, after all their increases, and increased
  deflection rating multiplies the gained rating on top, so it stacks with every evasion increase; a flat "+X to
  Deflection Rating" isn't scaled by those increases. Armour on elemental hits is sized on the hit before
  resistance. Sorcery Ward is a barrier in EHP and the max hit; with Ceremonial Ablution it also takes physical and
  chaos hits.
- **Examples:** deflection comes from evasion on 14 of 16 published deflection builds and from armour on two
  Tacticians, worth ×1.01–1.61 on EHP by its chance; armour on elemental hits on eight armour builds, ×1.35–2.30 on
  EHP (Fubgun's Flameblast, at 280%), never on the lowest max hit; Sorcery Ward on two Witchhunters, 30% of armour
  plus evasion, ×1.96 and ×1.70 on both figures [defence-layers]. Subterfuge Mask and Iron Slippers
  [vid-scale-defence] and Spectral Ward [vid-build-process]: node power offers them at 3.6–8.0% EHP a point on four
  builds.
- **Cautions:** the derived layer keeps its source's conditions: Hyrri's Ire doubles evasion only while not hit
  recently, so the Witchhunters' ward and max hit fall ×0.77–0.81 once hit. Deflection caps at 95% at a rating of
  about 14.4 × the enemy's accuracy (34k against a level-85 monster); more is wasted. Never add a custom line for a
  layer PoB models: both Witchhunter files typed their ward as energy shield and counted it twice [defence-layers].
  Rates move between patches: Subterfuge Mask was +2 in 0.4 and is +1 at the pin [vid-scale-defence].

### Deflection beside evasion

- **Shape:** a build whose main defence is evasion takes as much deflection as its points and gear allow: evasion is
  all or nothing, safe until a big hit gets through whole, and deflection takes 40% off most of the hits that get
  through, whatever their size. No cap is required.
- **Search:** `tree "Deflection"` (small nodes, 5–8% of evasion as deflection rating), Trained Deflection and
  Enduring Deflection (more prevented share); `mechanic "Deflection Rating equal to"` (mod, unique, passive) for
  gear; `mechanic "increased Deflection Rating"`; Blind on the attackers (Blind as defence).
- **PoB:** modelled in EHP, each hit × (1 − chance × prevented share); not in the max hit, which assumes the roll
  fails; not in ailment damage (Defence the gate can't see).
- **Examples:** Snoobae's Twister (20% deflect): node power offers three Deflection nodes and Enduring Deflection at
  3.5% EHP a point, against 4.3% for its best pick; Woolie's Witchhunter ranks Enduring Deflection second. Three of
  the four published one-shots survive a deflected slam (it deals 60%): the Twister Gemling (84% deflect) dies to
  about 16% of slams, the Beast Master (67%) to 33%, the Amazon (21%) to 79%. The evasion-with-life builds carry a
  median 2.1k life against 2.9k for armour builds, since strength adds 2 base life a point and dexterity none
  [defence-layers]. 0.5 made high deflection reachable: evasion grown into deflection, with Pocket Sand, Trained
  Deflection and Hyrri's Ire [vid-deflection].
- **Cautions:** EHP undervalues it: a ranking by EHP puts deflection nodes behind evasion and energy shield nodes
  (2.8–6.5% a point against a best of 4.3–9.4%), so also ask how a deflected big hit fares: it is survived up to 1 ÷
  0.6 of the max hit, which the gate doesn't show yet. It doesn't replace a pool: a slam it misses lands whole, so a
  one-shot build still needs life, energy shield or armour for the type it fails. The chance is front-loaded: half
  the cap's rating gives about 70%. It rolls against the attacker's accuracy, so a boss deflects less often than the
  map enemy the figures use. It is for builds whose main defence is evasion; others take it only where it is cheap.
  Deflection was buffed heavily in 0.5 (the user, 2026-10-26): a guide from before, or not re-tuned since, may
  under-use it.

### Blind as defence

- **Shape:** blinding the enemies that hit you cuts their accuracy by a fifth, which raises evade and deflection
  together.
- **Search:** `mechanic "Blind" (gem)` (Twister, Whirling Slash, Flash Grenade, Blind I and II), `tree "Blind
  Effect"` (Pocket Sand), then unique; then check that it lands on the enemies that attack you, and how often.
- **PoB:** config stand-in: "Is the enemy Blinded?" gives the enemy 20% less accuracy and evasion, counted in EHP
  only.
- **Examples:** 11 of 30 published league starters blind the enemy; turned off, their EHP falls ×0.78–0.90 and the
  max hit doesn't move [defence-layers]. Twister blinds what it hits; Pocket Sand strengthens blind to 30% less
  accuracy [vid-deflection].
- **Cautions:** blind is earned state: it needs a producer and an honest uptime (D1-build step 7). Blindside stops
  the supported skill from blinding. Its effect on bosses isn't established. It never fixes a one-shot.

### Shift physical hits into a resisted type

- **Shape:** a share of physical hits taken as an element meets capped resistances (and any armour on elemental
  hits), which cut a big hit harder than armour does.
- **Search:** `mechanic "Physical Damage from Hits taken as"`, `mechanic "Physical Damage taken as"` (unique,
  passive, mod) and Molten Symbol (Smith of Kitava); then check resistance headroom for the new type.
- **PoB:** modelled: the taken-as table feeds EHP and every max hit.
- **Examples:** Balrog's Bear Smith, 30% as fire: ×1.51 on EHP, ×1.33 on the lowest max hit. MisoxShiru's Glacial
  Lance, 51% as lightning: ×1.44 and ×1.48. On the four one-shot builds, 2–48% as fire clears the one-shot alone
  [defence-layers]. Cloak of Flame and Lightning Coil [vid-secret-defence].
- **Cautions:** all four one-shot reference builds fail on a physical hit, but three need 45–48% (a body armour's
  worth), where 340–1,100 life or energy shield does the same [defence-layers]. Lightning Coil carries a lightning
  resistance penalty, so over-cap lightning first.

### Mana as a hit pool

- **Shape:** a share of each hit is taken from mana before life, so a large mana pool becomes a buffer.
- **Search:** `mechanic "taken from Mana before Life"` (passive, mod, unique: belts, body runes, Cloak of Defiance;
  Mind over Matter for all of it) and Eldritch Battery (energy shield converted to mana); then check unreserved mana
  and what skills spend.
- **PoB:** modelled in EHP and the max hit; mana recovery is in neither.
- **Examples:** the Arc Gemling (Mind over Matter and Eldritch Battery) reads ×14.66 on both figures, the Grim
  Pillars Oracle (a 93% share with Eldritch Battery) ×11.24, Ignatius's Stormweaver (81%) ×4.13; 4–15% shares on six
  builds read ×1.03–1.15, and Eldritch Battery itself ×1.11–1.72 [defence-layers]. Mana-first nodes, body runes and
  Cloak of Defiance [vid-secret-defence]; Mind over Matter [enervating] chain 7, [oracle] chain 9.
- **Cautions:** Mind over Matter has 50% less mana recovery. Under Blood Magic (no mana) it does nothing: Woolie's
  Wolfman takes both, and the keystone reads ×1.00. PoB doesn't parse Pyromantic Pact (maximum mana replaced by
  Infernal Flame), so it keeps a mana pool the Infernalist doesn't have, and node power offers Mind over Matter at
  +88.6% EHP a point [defence-layers]. Mana spent on skills isn't in the pool when the hit lands.

### An ally takes the hit first

- **Shape:** a companion, totem or spectre takes a share of each hit before you, so its life joins your pool while
  it lives.
- **Search:** `mechanic "Life before you"` (gem, unique, passive): Romira's Requital, Loyalty, Starkonja's Head,
  Trusted Partner, Captivating Companionship, Wooden Wall; then check the ally's life.
- **PoB:** modelled for companions, totems and spectres, in EHP and the max hit; our tools don't expose the
  companion's life.
- **Examples:** Romira's Requital's 10% on three published builds, and a 5% companion line on the Beast Master:
  ×1.06–1.11 on EHP and on the max hit [defence-layers]. Loyalty on a damageable companion [mob-mattjestic] §7;
  [mob-thyworm] §7; [mob-beastmaster] §7. Minions as a buffer [vid-scale-defence].
- **Cautions:** it is small, ×1.11 at most in the reference builds. The share stops when the ally dies. Romira's
  Requital costs its companion 30% of its life, and its recoup line may be unmodelled (coverage). With a companion's
  share, PoB's hit count can bend a layer's knock-out reading by about 3.5% (Snoobae's Twister) [defence-layers].

### EHP over its target but one-shot (a diagnosis)

- **Shape:** a rung that meets its EHP target but fails the Arbiter verdict owes its EHP to the chance layers, so
  the fix is the pool, armour or a physical shift, never more evasion.
- **Search:** read the record's Arbiter verdict (worst type and ratio) beside the evade and deflect chances; then
  measure each fix on a temporary stage: the cheapest pool line for that type on a slot (life, energy shield),
  armour, or a physical-taken-as line.
- **PoB:** modelled: the max hit has no evade term, and deflection enters it only at 100%.
- **Examples:** the animeprincess Twister reads 17.9k, inside the distance band, and is one-shot at 1.01; +30 life
  clears it. LazyExile's Amazon (7.7k) and the Beast Master (12.9k) need +1.1k life or +640–1,100 energy shield;
  16–17k armour or 45–48% physical as fire also work. +30% to every maximum resistance clears none of the four. With
  their deflection three of the four are a chance, not a certainty: a deflected slam deals 60%, so the Twister
  Gemling dies to about 16% of slams, the Beast Master to 33%, the Amazon to 79% [defence-layers].
- **Cautions:** node power ranks by EHP and offers evasion first, which never fixes a one-shot. Reserved life
  shrinks a life fix: the Comet Infernalist reserves two thirds of its life, so +342 energy shield beats +3.6k life.
  The max hit doesn't depend on the configured hits, so the verdict is the same on both rungs [toughness]. The
  deflect chances are at the map enemy's accuracy; a boss's may be higher.

## Sources

Paths are from this file; each title is the source's patch.

[worklog]: ../../../../docs/build-guide/worklog.md "work-log"
[pob-gaps]: ../../../../docs/build-guide/pob-gaps.md "pin v0.23.1"
[maelstrom]: ../../../../docs/build-guide/studies/2026-10-09-GsLBMXy3tDk-melting-maelstrom-shaman.md "0.5.5"
[mirage-sniper]: ../../../../docs/build-guide/studies/2026-10-10-FUeS6JNqHrw-mirage-sniper.md "0.5"
[eraser]: ../../../../docs/build-guide/studies/2026-10-10-4BVTG_E7N-w-the-eraser.md "0.5.5"
[glacial-bolt]: ../../../../docs/build-guide/studies/2026-10-10-glacial-bolt-gemling.md "0.5, 0.5.5"
[stormcaller]: ../../../../docs/build-guide/studies/2026-10-10-L_bhEMOtqEI-stormcaller-arrow.md "0.5"
[hotg]: ../../../../docs/build-guide/studies/2026-10-10-r6yQKNRoVlI-hotg-hammer-engine.md "0.5.5"
[enervating]: ../../../../docs/build-guide/studies/2026-10-10-q8dhc4DOBPU-enervating-nova-chronomancer.md "0.5"
[infernal-cry]: ../../../../docs/build-guide/studies/2026-10-10-QO5Un_eRyQM-infernal-cry-gemling.md "0.5"
[eventide]: ../../../../docs/build-guide/studies/2026-10-10-lVEhfsub0mY-eventide-petals-martial-artist.md "0.5"
[oracle]: ../../../../docs/build-guide/studies/2026-10-10-p5aRVgy0pM4-oracle-entangle.md "0.5.5"
[flicker]: ../../../../docs/build-guide/studies/2026-10-10-t2o56g88DHk-whirling-assault-flicker-monk.md "0.5.5"
[earthshatter]: ../../../../docs/build-guide/studies/2026-10-10-Ix82BSjoAdY-9H1lUVfvxTg-earthshatter-gemling.md "0.5"
[crossbow]: ../../../../docs/build-guide/studies/2026-10-10-9Z9ep97Whkg-crossbow-titan-double-vision.md "0.4"
[mana-flare]: ../../../../docs/build-guide/studies/2026-10-10-ekgGPoNjvmo-mana-flare-shaman.md "0.5"
[chayula-minions]: ../../../../docs/build-guide/studies/2026-10-10-yeuHB5HnJFM-chayula-minion-monk.md "0.5"
[supporting-fire]: ../../../../docs/build-guide/studies/2026-10-10-cpbNC4toSxU-supporting-fire-tactician.md "0.5"
[widowhail]: ../../../../docs/build-guide/studies/2026-10-10-YHIm3ACDtHc-widowhail-spark-blood-mage.md "0.4"
[ancestral-cry]: ../../../../docs/build-guide/studies/2026-10-10-5W5YX6Zsb5Q-concussive-ancestral-cry-titan.md "0.5"
[varashta]: ../../../../docs/build-guide/studies/2026-10-10-d2QbaO-sJ3o-varashta-djinn.md "0.5"
[twister]: ../../../../docs/build-guide/studies/2026-10-10-6jbyoRO2pUs-twister-spirit-walker.md "0.5"
[eye-of-winter]: ../../../../docs/build-guide/studies/2026-10-10-X9wCdbgep5I-eye-of-winter-pathfinder-poe1.md "Path of Exile 1"
[empyrean]: ../../../../docs/build-guide/studies/2026-10-10-urJZoOU-w48-twisted-empyrean-blood-mage.md "0.5"
[wing-blast]: ../../../../docs/build-guide/studies/2026-10-10-S0diAweTCeI-wing-blast-spirit-walker.md "0.5"
[shockchain]: ../../../../docs/build-guide/studies/2026-10-10-zRIEdxQ20fQ-shockchain-arrow-gemling.md "0.4"
[gathering-storm]: ../../../../docs/build-guide/studies/2026-10-10-bdxU10Jjz30-gathering-storm-infernalist.md "0.4"
[bone-cage]: ../../../../docs/build-guide/studies/2026-10-10-rXDZlCW2dF8-bone-cage-smith-of-kitava.md "0.4"
[walking-calamity]: ../../../../docs/build-guide/studies/2026-10-10-aeT9rsQZ4dM-walking-calamity-witchhunter.md "0.4"
[fangs]: ../../../../docs/build-guide/studies/2026-10-10-gLac8n8iBeA-fangs-of-frost-chronomancer.md "0.3.1"
[shield-charge]: ../../../../docs/build-guide/studies/2026-10-10-1ZqM9dJ9MF0-shield-charge-chayula.md "0.3.x"
[nerd-interactions]: ../../../../docs/build-guide/studies/2026-10-16-S1AzLxb3fZw-nerd-interactions.md "0.5.x"
[comparison]: ../../../../docs/build-guide/studies/2026-10-17-varashta-comparison.md "0.5.5 guide, pin 0.5.4"
[feedback]: ../../../../docs/build-guide/studies/2026-10-17-varashta-run-feedback.md "pin 0.5.4"
[amendment-8]: ../../../../docs/build-guide/spec/amendment-8-engine-lens.md "pin 0.5.4"
[amendment-9]: ../../../../docs/build-guide/spec/amendment-9-endgame-first.md "pin 0.5.4"
[spud]: ../../../../docs/build-guide/studies/2026-10-23-spud-warcryer-comparison.md "0.5.5, measured at pin 0.5.4"
[fubgun]: ../../../../docs/build-guide/studies/2026-10-09-guide-comparison-1-fubgun.md "0.5.5"
[ronarray-page]: ../../../../docs/build-guide/studies/2026-10-09-guide-comparison-2-ronarray-page.md "0.5.5"
[ronarray-videos]: ../../../../docs/build-guide/studies/2026-10-09-guide-comparison-2-ronarray-videos.md "0.5"
[ec-comparison]: ../../../../docs/build-guide/studies/2026-10-14-ec-comparison.md "pin 0.5.4"
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
[toughness]: ../../../../docs/build-guide/studies/2026-10-25-toughness-floors.md "published guides, measured at pin 0.5.4"
[defence-layers]: ../../../../docs/build-guide/studies/2026-10-26-defence-layers.md "published guides, measured at pin 0.5.4"
[vid-scale-defence]: ../../../../docs/build-guide/studies/2026-10-26-advice-videos.md "0.4"
[vid-defence-guide]: ../../../../docs/build-guide/studies/2026-10-26-advice-videos.md "0.1.0"
[vid-secret-defence]: ../../../../docs/build-guide/studies/2026-10-26-advice-videos.md "0.5"
[vid-deflection]: ../../../../docs/build-guide/studies/2026-10-26-advice-videos.md "0.5"
[vid-build-process]: ../../../../docs/build-guide/studies/2026-10-26-advice-videos.md "0.5"
