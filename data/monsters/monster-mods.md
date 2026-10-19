# Rare monster modifiers

Written by `.claude/skills/build-guide/scripts/monster-mods.mjs` from poe2db's pages saved 2026-10-18 (amendment 8,
D-402). Re-run the script to change it; its judgments are in the script.

- **Source.** https://poe2db.tw/us/Monster_Modifiers, its "Archnemesis Mods" list (268 rows), and
  https://poe2db.tw/us/Tame_Beast, its own "Archnemesis Mods" list (178 rows). One block per name: 97 modifiers, 97 on
  Tame_Beast's list; 25 modelled as stats, 13 as a condition, 59 not at all. Left out: 75 rows with no name (lower-value
  variants of named modifiers, and expedition-rune, affliction and Runic Ward rows; many with internal stat ids or no
  lines).
- **Read it by Grep:** a family (`chilled-ground`) in the index below, then the block by its heading
  (`grep -n -A14 '^### Trail of Ice' data/monsters/monster-mods.md`). A citation is
  `data | monsters/monster-mods.md#<id>`.
- **Lines** are the game's words, quoted. `internal stat id:` marks a stat poe2db shows by its id with its value in
  brackets, which the game words differently. Many modifiers show their lines only in a hover the saved page doesn't
  hold: their judgment rests on the name and the keyword it links, unless the modifier's own keyword page is saved
  beside the lists (4 are). Then **Page text** is that page's sentence, verbatim, and the lines marked
  `from the page text:` are PoB's wording of it; `from the internal stat id:` marks PoB's wording of an internal stat
  id.
- **Tamed beast keeps it:** the Tame Beast gem says "Tamed Beast retains up to four monster modifiers when summoned";
  `yes` means Tame_Beast's list has the modifier. That list is poe2db's whole table with duplicate rows dropped, so it
  singles out none: every `yes` is an inference from a list that doesn't filter, not a confirmation.
- **Model,** how a plan models the modifier on a tamed beast that keeps it: `stats`, its lines go in as custom modifiers
  (D-293), each an estimate the record marks; `condition`, what it supplies is the config entry its `Config` line names,
  as enemies on Chilled Ground are; `none`, PoB can't take it, and the card says so.
- **Reach,** who the modifier acts on: `the beast`, lines for the companion alone, written as `Companions have …` lines
  (PoB gives them to companion skills only, `Modules/ModParser.lua:1272-1273`, and the tamed beast's skill is one);
  `its allies: the player and minions`, player lines and `Minions have` lines; enemies, for what it inflicts or leaves
  on the ground.
- **Creates** is what the beast supplies to the build beyond its own stats; **Pays off on** is what makes the modifier
  worth more (`companion`: the beast's own damage or survival). Both use the words of `data/rules/vocabulary.md`, or
  `none`.

## Index

- Extra Fire Damage (extra-fire-damage): stats; creates none; pays off on companion; keeps: yes
- Extra Cold Damage (extra-cold-damage): stats; creates none; pays off on companion; keeps: yes
- Extra Lightning Damage (extra-lightning-damage): stats; creates none; pays off on companion; keeps: yes
- Hasted (hasted): stats; creates none; pays off on companion; keeps: yes
- Extra Crits (extra-crits): stats; creates none; pays off on companion; keeps: yes
- Stuns (stuns): stats; creates stun; pays off on companion; keeps: yes
- Armoured (armoured): none; creates none; pays off on companion; keeps: yes
- Evasive (evasive): none; creates none; pays off on companion; keeps: yes
- Extra Energy Shield (extra-energy-shield): stats; creates none; pays off on companion; keeps: yes
- Always Poisons (always-poisons): condition; creates poison; pays off on none; keeps: yes
- Always Bleeds (always-bleeds): condition; creates bleed; pays off on none; keeps: yes
- Periodically unleashes Fire (periodically-unleashes-fire): none; creates none; pays off on none; keeps: yes
- Burning Ground on Death (burning-ground-on-death): condition; creates ignited-ground; pays off on minion-death; keeps: yes
- Periodically unleashes Ice (periodically-unleashes-ice): none; creates none; pays off on none; keeps: yes
- Chilled Ground on Death (chilled-ground-on-death): condition; creates chilled-ground; pays off on minion-death; keeps: yes
- Periodically unleashes Lightning (periodically-unleashes-lightning): none; creates none; pays off on none; keeps: yes
- Shocked Ground on Death (shocked-ground-on-death): condition; creates shocked-ground; pays off on minion-death; keeps: yes
- Increased Stun Threshold (increased-stun-threshold): stats; creates none; pays off on companion; keeps: yes
- Stun Resistant (stun-resistant): stats; creates none; pays off on companion; keeps: yes
- Fire Resistant (fire-resistant): stats; creates none; pays off on companion; keeps: yes
- Cold Resistant (cold-resistant): stats; creates none; pays off on companion; keeps: yes
- Lightning Resistant (lightning-resistant): stats; creates none; pays off on companion; keeps: yes
- Breaks Armour (breaks-armour): condition; creates armour-break; pays off on none; keeps: yes
- Accurate (accurate): stats; creates none; pays off on companion; keeps: yes
- Extra Chaos Damage (extra-chaos-damage): stats; creates none; pays off on companion; keeps: yes
- Regenerates Life (regenerates-life): stats; creates none; pays off on companion; keeps: yes
- Additional Projectiles (additional-projectiles): stats; creates none; pays off on companion; keeps: yes
- Increased Area of Effect (increased-area-of-effect): stats; creates none; pays off on companion; keeps: yes
- All Damage Ignites (all-damage-ignites): condition; creates ignite; pays off on none; keeps: yes
- All Damage Chills (all-damage-chills): condition; creates chill; pays off on none; keeps: yes
- All Damage Shocks (all-damage-shocks): condition; creates shock; pays off on none; keeps: yes
- Trail of Fire (trail-of-fire): condition; creates ignited-ground; pays off on none; keeps: yes
- Trail of Ice (trail-of-ice): condition; creates chilled-ground; pays off on none; keeps: yes
- Trail of Lightning (trail-of-lightning): condition; creates shocked-ground; pays off on none; keeps: yes
- Slow Resistant (slow-resistant): none; creates none; pays off on companion; keeps: yes
- Crit Resistant (crit-resistant): stats; creates none; pays off on companion; keeps: yes
- Chaos Resistant (chaos-resistant): stats; creates none; pays off on companion; keeps: yes
- Periodic Fire Explosions (periodic-fire-explosions): none; creates none; pays off on none; keeps: yes
- Periodic Cold Explosions (periodic-cold-explosions): none; creates none; pays off on none; keeps: yes
- Periodic Lightning Explosions (periodic-lightning-explosions): none; creates none; pays off on none; keeps: yes
- Fire Explosion on Death (fire-explosion-on-death): none; creates none; pays off on minion-death; keeps: yes
- Cold Explosion on Death (cold-explosion-on-death): none; creates none; pays off on minion-death; keeps: yes
- Lightning Explosion on Death (lightning-explosion-on-death): none; creates none; pays off on minion-death; keeps: yes
- Powerful Minions (powerful-minions): none; creates none; pays off on none; keeps: yes
- Empowered (empowered): stats; creates none; pays off on companion; keeps: yes
- Extra Physical Damage Aura (extra-physical-damage-aura): stats; creates none; pays off on none; keeps: yes
- Haste Aura (haste-aura): stats; creates attack-speed, cast-speed, movement-speed; pays off on none; keeps: yes
- Energy Shield Aura (energy-shield-aura): stats; creates energy-shield; pays off on none; keeps: yes
- Elemental Resistance Aura (elemental-resistance-aura): stats; creates resistance; pays off on none; keeps: yes
- Temporal Bubble (temporal-bubble): none; creates none; pays off on companion; keeps: yes
- Hinder Aura (hinder-aura): condition; creates hinder; pays off on none; keeps: yes
- Prevents Recovery Above 50% (prevents-recovery-above-50): none; creates none; pays off on none; keeps: yes
- Periodic Invulnerability Aura (periodic-invulnerability-aura): none; creates none; pays off on none; keeps: yes
- Empowered Periodic Invulnerability Aura (empowered-periodic-invulnerability-aura): none; creates none; pays off on none; keeps: yes
- Increased Life (increased-life): stats; creates none; pays off on companion; keeps: yes
- Siphons Mana and Deals Lightning Damage (siphons-mana-and-deals-lightning-damage): none; creates none; pays off on none; keeps: yes
- Heals Allies and Suppresses Foe Recovery (heals-allies-and-suppresses-foe-recovery): none; creates recovery; pays off on none; keeps: yes
- Siphons Flask Charges (siphons-flask-charges): none; creates none; pays off on none; keeps: yes
- Reviving Minions (reviving-minions): none; creates none; pays off on none; keeps: yes
- Empowered Reviving Minions (empowered-reviving-minions): none; creates none; pays off on none; keeps: yes
- Damage Taken From Minions First (damage-taken-from-minions-first): none; creates none; pays off on companion; keeps: yes
- Shroud Walker (shroud-walker): none; creates none; pays off on none; keeps: yes
- Periodically Enrages (periodically-enrages): none; creates none; pays off on companion; keeps: yes
- Enraged (enraged): none; creates none; pays off on companion; keeps: yes
- Explodes Nearby Corpses (explodes-nearby-corpses): none; creates none; pays off on corpse; keeps: yes
- Lightning Mirage When Hit (lightning-mirage-when-hit): none; creates none; pays off on none; keeps: yes
- Lightning Mirages When Hit (lightning-mirages-when-hit): none; creates none; pays off on none; keeps: yes
- Magma Barrier (magma-barrier): none; creates none; pays off on companion; keeps: yes
- Conjures Ice Prisons (conjures-ice-prisons): none; creates none; pays off on none; keeps: yes
- Conjures Flamewalls (conjures-flamewalls): none; creates none; pays off on none; keeps: yes
- Conjures Lightning Storms (conjures-lightning-storms): none; creates none; pays off on none; keeps: yes
- Volatile Crystals (volatile-crystals): none; creates none; pays off on none; keeps: yes
- Volatile Plants (volatile-plants): none; creates none; pays off on none; keeps: yes
- Empowering Volatile Plants (empowering-volatile-plants): none; creates none; pays off on none; keeps: yes
- Volatile Crag (volatile-crag): none; creates none; pays off on none; keeps: yes
- Empowering Volatile Crag (empowering-volatile-crag): none; creates none; pays off on none; keeps: yes
- Proximal Tangibility (proximal-tangibility): none; creates none; pays off on companion; keeps: yes
- Bombardier (bombardier): none; creates none; pays off on none; keeps: yes
- Soul Eater (soul-eater): none; creates none; pays off on none; keeps: yes
- Conjures Elemental Hazards (conjures-elemental-hazards): none; creates none; pays off on none; keeps: yes
- Volatile Souls (volatile-souls): none; creates none; pays off on none; keeps: yes
- Soul Siphoner (soul-siphoner): none; creates none; pays off on none; keeps: yes
- Kurgal's Last Gasp (kurgals-last-gasp): none; creates none; pays off on none; keeps: yes
- Undying Will (undying-will): none; creates none; pays off on companion; keeps: yes
- Lithomantic Runes (lithomantic-runes): none; creates none; pays off on none; keeps: yes
- Meteoric Demise (meteoric-demise): none; creates none; pays off on none; keeps: yes
- Kulemak's Desecration (kulemaks-desecration): none; creates none; pays off on none; keeps: yes
- Ulaman's Legion (ulamans-legion): none; creates none; pays off on none; keeps: yes
- Amanamu's Void (amanamus-void): none; creates none; pays off on none; keeps: yes
- Lifestealer Aura (lifestealer-aura): none; creates none; pays off on none; keeps: yes
- Unstable Revenants (unstable-revenants): none; creates none; pays off on none; keeps: yes
- Bubonic Trail (bubonic-trail): none; creates other-ground; pays off on none; keeps: yes
- Crystalline Barrier (crystalline-barrier): none; creates none; pays off on companion; keeps: yes
- Soulflame Geysers (soulflame-geysers): none; creates none; pays off on none; keeps: yes
- Shade Walker (shade-walker): none; creates none; pays off on none; keeps: yes
- Eruption of Souls (eruption-of-souls): none; creates none; pays off on none; keeps: yes
- Corrupted (corrupted): none; creates none; pays off on none; keeps: yes

## Modifiers

### Extra Fire Damage
- Id: extra-fire-damage
- Kind: standard
- Lines:
  - "Gain 40% of Damage as Extra Fire Damage"
- URL: https://poe2db.tw/us/Extra_Fire_Damage
- Tamed beast keeps it: yes
- Model: stats
- Reach: the beast
- Creates: none | Pays off on: companion
- Note: A plan writes its lines as `Companions have …` lines, which PoB gives the companion alone.

### Extra Cold Damage
- Id: extra-cold-damage
- Kind: standard
- Lines:
  - "Gain 40% of Damage as Extra Cold Damage"
- URL: https://poe2db.tw/us/Extra_Cold_Damage
- Tamed beast keeps it: yes
- Model: stats
- Reach: the beast
- Creates: none | Pays off on: companion
- Note: A plan writes its lines as `Companions have …` lines, which PoB gives the companion alone.

### Extra Lightning Damage
- Id: extra-lightning-damage
- Kind: standard
- Lines:
  - "Gain 40% of Damage as Extra Lightning Damage"
- URL: https://poe2db.tw/us/Extra_Lightning_Damage
- Tamed beast keeps it: yes
- Model: stats
- Reach: the beast
- Creates: none | Pays off on: companion
- Note: A plan writes its lines as `Companions have …` lines, which PoB gives the companion alone.

### Hasted
- Id: hasted
- Kind: standard
- Lines:
  - "30% increased Movement Speed"
  - "30% increased Attack and Cast Speed"
- URL: https://poe2db.tw/us/Hasted
- Tamed beast keeps it: yes
- Model: stats
- Reach: the beast
- Creates: none | Pays off on: companion
- Note: A plan writes its lines as `Companions have …` lines, which PoB gives the companion alone. Its speed is the
  beast's own; Haste Aura is the modifier whose speed reaches its allies.

### Extra Crits
- Id: extra-crits
- Kind: standard
- Lines:
  - "300% increased Critical Hit Chance"
- URL: https://poe2db.tw/us/Extra_Crits
- Tamed beast keeps it: yes
- Model: stats
- Reach: the beast
- Creates: none | Pays off on: companion
- Note: A plan writes its lines as `Companions have …` lines, which PoB gives the companion alone.

### Stuns
- Id: stuns
- Kind: standard
- Lines:
  - "100% increased Stun Buildup"
- URL: https://poe2db.tw/us/Stuns
- Tamed beast keeps it: yes
- Model: stats
- Reach: the beast
- Creates: stun | Pays off on: companion
- Note: A plan writes its lines as `Companions have …` lines, which PoB gives the companion alone. The buildup is the
  beast's: enemies it hits are stunned sooner.

### Armoured
- Id: armoured
- Kind: standard
- Lines:
  - internal stat id: monster additional strength ratio % for armour [100]
- URL: https://poe2db.tw/us/Armoured
- Tamed beast keeps it: yes
- Model: none
- Reach: the beast
- Creates: none | Pays off on: companion
- Note: Its only lines are internal stat ids, which PoB can't take as lines.

### Evasive
- Id: evasive
- Kind: standard
- Lines:
  - internal stat id: monster additional dexterity ratio % for evasion [100]
- URL: https://poe2db.tw/us/Evasive
- Tamed beast keeps it: yes
- Model: none
- Reach: the beast
- Creates: none | Pays off on: companion
- Note: Its only lines are internal stat ids, which PoB can't take as lines.

### Extra Energy Shield
- Id: extra-energy-shield
- Kind: standard
- Lines:
  - internal stat id: base maximum life % to gain as total energy shield [25]
  - from the internal stat id: "Gain 25% of maximum Life as Extra maximum Energy Shield"
- URL: https://poe2db.tw/us/Extra_Energy_Shield
- Tamed beast keeps it: yes
- Model: stats
- Reach: the beast
- Creates: none | Pays off on: companion
- Note: A plan writes its lines as `Companions have …` lines, which PoB gives the companion alone. Its line is PoB's
  wording of its internal stat id, as Energy Shield Aura's is of the same stat; an estimate the record marks.

### Always Poisons
- Id: always-poisons
- Kind: standard
- Lines:
  - "Poison on Hit"
- URL: https://poe2db.tw/us/Monster_Modifiers
- Keyword: Poison, https://poe2db.tw/us/Poison
- Tamed beast keeps it: yes
- Model: condition
- Reach: enemies it hits
- Config: conditionEnemyPoisoned ("Is the enemy Poisoned?")
- Creates: poison | Pays off on: none

### Always Bleeds
- Id: always-bleeds
- Kind: standard
- Lines:
  - "Inflict Bleeding on Hit"
- URL: https://poe2db.tw/us/Monster_Modifiers
- Keyword: Bleeding, https://poe2db.tw/us/Bleeding
- Tamed beast keeps it: yes
- Model: condition
- Reach: enemies it hits
- Config: conditionEnemyBleeding ("Is the enemy Bleeding?")
- Creates: bleed | Pays off on: none

### Periodically unleashes Fire
- Id: periodically-unleashes-fire
- Kind: standard
- Lines: none on the page (poe2db shows them only in a hover)
- URL: https://poe2db.tw/us/Monster_Modifiers
- Keyword: Fire Damage, https://poe2db.tw/us/Fire_Damage
- Tamed beast keeps it: yes
- Model: none
- Reach: enemies near it
- Creates: none | Pays off on: none
- Note: Damage the beast deals on its own, which PoB can't add; the page gives no lines.

### Burning Ground on Death
- Id: burning-ground-on-death
- Kind: standard
- Lines: none on the page (poe2db shows them only in a hover)
- URL: https://poe2db.tw/us/Monster_Modifiers
- Keyword: Ignited Ground, https://poe2db.tw/us/Ignited_Ground
- Tamed beast keeps it: yes
- Model: condition
- Reach: enemies where it dies
- Config: conditionEnemyIgnited ("Is the enemy Ignited?")
- Creates: ignited-ground | Pays off on: minion-death
- Note: Judged from its name and the Ignited Ground keyword it links. Only where the beast dies, so a reviving companion
  supplies it rarely. PoB has no option for an enemy on Ignited Ground, so the plan takes an Ignited enemy.

### Periodically unleashes Ice
- Id: periodically-unleashes-ice
- Kind: standard
- Lines: none on the page (poe2db shows them only in a hover)
- URL: https://poe2db.tw/us/Monster_Modifiers
- Keyword: Cold Damage, https://poe2db.tw/us/Cold_Damage
- Tamed beast keeps it: yes
- Model: none
- Reach: enemies near it
- Creates: none | Pays off on: none
- Note: Damage the beast deals on its own, which PoB can't add; the page gives no lines.

### Chilled Ground on Death
- Id: chilled-ground-on-death
- Kind: standard
- Lines: none on the page (poe2db shows them only in a hover)
- URL: https://poe2db.tw/us/Monster_Modifiers
- Tamed beast keeps it: yes
- Model: condition
- Reach: enemies where it dies
- Config: conditionEnemyOnChilledGround ("Is the enemy on Chilled Ground?")
- Creates: chilled-ground | Pays off on: minion-death
- Note: Judged from its name: the page gives no lines. Only where the beast dies, so a reviving companion supplies it
  rarely.

### Periodically unleashes Lightning
- Id: periodically-unleashes-lightning
- Kind: standard
- Lines: none on the page (poe2db shows them only in a hover)
- URL: https://poe2db.tw/us/Monster_Modifiers
- Keyword: Lightning Damage, https://poe2db.tw/us/Lightning_Damage
- Tamed beast keeps it: yes
- Model: none
- Reach: enemies near it
- Creates: none | Pays off on: none
- Note: Damage the beast deals on its own, which PoB can't add; the page gives no lines.

### Shocked Ground on Death
- Id: shocked-ground-on-death
- Kind: standard
- Lines: none on the page (poe2db shows them only in a hover)
- URL: https://poe2db.tw/us/Monster_Modifiers
- Tamed beast keeps it: yes
- Model: condition
- Reach: enemies where it dies
- Config: conditionEnemyOnShockedGround ("Is the enemy on Shocked Ground?")
- Creates: shocked-ground | Pays off on: minion-death
- Note: Judged from its name: the page gives no lines. Only where the beast dies, so a reviving companion supplies it
  rarely.

### Increased Stun Threshold
- Id: increased-stun-threshold
- Kind: standard
- Lines:
  - "Cannot be Stunned"
- URL: https://poe2db.tw/us/Increased_Stun_Threshold
- Tamed beast keeps it: yes
- Model: stats
- Reach: the beast
- Creates: none | Pays off on: companion
- Note: A plan writes its lines as `Companions have …` lines, which PoB gives the companion alone.

### Stun Resistant
- Id: stun-resistant
- Kind: standard
- Lines:
  - "250% increased Stun Threshold"
- URL: https://poe2db.tw/us/Stun_Resistant
- Tamed beast keeps it: yes
- Model: stats
- Reach: the beast
- Creates: none | Pays off on: companion
- Note: A plan writes its lines as `Companions have …` lines, which PoB gives the companion alone.

### Fire Resistant
- Id: fire-resistant
- Kind: standard
- Lines:
  - "+10% to Maximum Fire Resistance"
  - "+50% to Fire Resistance"
- URL: https://poe2db.tw/us/Fire_Resistant
- Tamed beast keeps it: yes
- Model: stats
- Reach: the beast
- Creates: none | Pays off on: companion
- Note: A plan writes its lines as `Companions have …` lines, which PoB gives the companion alone.

### Cold Resistant
- Id: cold-resistant
- Kind: standard
- Lines:
  - "+10% to Maximum Cold Resistance"
  - "+50% to Cold Resistance"
- URL: https://poe2db.tw/us/Cold_Resistant
- Tamed beast keeps it: yes
- Model: stats
- Reach: the beast
- Creates: none | Pays off on: companion
- Note: A plan writes its lines as `Companions have …` lines, which PoB gives the companion alone.

### Lightning Resistant
- Id: lightning-resistant
- Kind: standard
- Lines:
  - "+10% to Maximum Lightning Resistance"
  - "+50% to Lightning Resistance"
- URL: https://poe2db.tw/us/Lightning_Resistant
- Tamed beast keeps it: yes
- Model: stats
- Reach: the beast
- Creates: none | Pays off on: companion
- Note: A plan writes its lines as `Companions have …` lines, which PoB gives the companion alone.

### Breaks Armour
- Id: breaks-armour
- Kind: standard
- Lines:
  - "Break Armour equal to 1000% of Physical Damage dealt"
- URL: https://poe2db.tw/us/Breaks_Armour
- Tamed beast keeps it: yes
- Model: condition
- Reach: enemies it hits
- Config: conditionEnemyArmourBroken ("Is enemy Armour Broken?")
- Creates: armour-break | Pays off on: none
- Note: The beast's physical hits break enemies' armour.

### Accurate
- Id: accurate
- Kind: standard
- Lines:
  - "200% increased Accuracy Rating"
- URL: https://poe2db.tw/us/Accurate
- Tamed beast keeps it: yes
- Model: stats
- Reach: the beast
- Creates: none | Pays off on: companion
- Note: A plan writes its lines as `Companions have …` lines, which PoB gives the companion alone.

### Extra Chaos Damage
- Id: extra-chaos-damage
- Kind: standard
- Lines:
  - "Gain 40% of Damage as Extra Chaos Damage"
- URL: https://poe2db.tw/us/Extra_Chaos_Damage
- Tamed beast keeps it: yes
- Model: stats
- Reach: the beast
- Creates: none | Pays off on: companion
- Note: A plan writes its lines as `Companions have …` lines, which PoB gives the companion alone.

### Regenerates Life
- Id: regenerates-life
- Kind: standard
- Lines:
  - "Regenerate 2% of maximum Life per second"
- URL: https://poe2db.tw/us/Regenerates_Life
- Tamed beast keeps it: yes
- Model: stats
- Reach: the beast
- Creates: none | Pays off on: companion
- Note: A plan writes its lines as `Companions have …` lines, which PoB gives the companion alone.

### Additional Projectiles
- Id: additional-projectiles
- Kind: standard
- Lines:
  - "Skills fire 4 additional Projectiles"
- URL: https://poe2db.tw/us/Additional_Projectiles
- Tamed beast keeps it: yes
- Model: stats
- Reach: the beast
- Creates: none | Pays off on: companion
- Note: A plan writes its lines as `Companions have …` lines, which PoB gives the companion alone. Worth something only
  when the beast's own skills fire projectiles.

### Increased Area of Effect
- Id: increased-area-of-effect
- Kind: standard
- Lines:
  - "100% more Area of Effect"
- URL: https://poe2db.tw/us/Increased_Area_of_Effect
- Tamed beast keeps it: yes
- Model: stats
- Reach: the beast
- Creates: none | Pays off on: companion
- Note: A plan writes its lines as `Companions have …` lines, which PoB gives the companion alone. It widens the beast's
  own skills.

### All Damage Ignites
- Id: all-damage-ignites
- Kind: standard
- Lines:
  - "Hits always Ignite"
  - "All Damage from Hits Contributes to Flammability and Ignite Magnitudes"
- URL: https://poe2db.tw/us/Monster_Modifiers
- Keyword: Ignite, https://poe2db.tw/us/Ignite
- Tamed beast keeps it: yes
- Model: condition
- Reach: enemies it hits
- Config: conditionEnemyIgnited ("Is the enemy Ignited?")
- Creates: ignite | Pays off on: none

### All Damage Chills
- Id: all-damage-chills
- Kind: standard
- Lines:
  - "All Damage from Hits Contributes to Chill Magnitude"
  - "Chills from your Hits always reduce Action Speed by at least 10%"
- URL: https://poe2db.tw/us/Monster_Modifiers
- Keyword: Chill, https://poe2db.tw/us/Chill
- Tamed beast keeps it: yes
- Model: condition
- Reach: enemies it hits
- Config: conditionEnemyChilled ("Is the enemy Chilled?")
- Creates: chill | Pays off on: none

### All Damage Shocks
- Id: all-damage-shocks
- Kind: standard
- Lines:
  - "Hits always Shock"
  - "All Damage from Hits Contributes to Shock Chance"
- URL: https://poe2db.tw/us/Monster_Modifiers
- Keyword: Shock, https://poe2db.tw/us/Shock
- Tamed beast keeps it: yes
- Model: condition
- Reach: enemies it hits
- Config: conditionEnemyShocked ("Is the enemy Shocked?")
- Creates: shock | Pays off on: none

### Trail of Fire
- Id: trail-of-fire
- Kind: standard
- Lines: none on the page (poe2db shows them only in a hover)
- URL: https://poe2db.tw/us/Monster_Modifiers
- Keyword: Ignited Ground, https://poe2db.tw/us/Ignited_Ground
- Tamed beast keeps it: yes
- Model: condition
- Reach: enemies on its trail
- Config: conditionEnemyIgnited ("Is the enemy Ignited?")
- Creates: ignited-ground | Pays off on: none
- Note: Judged from its name and the Ignited Ground keyword it links: the page gives no lines. PoB has no option for an
  enemy on Ignited Ground, so the plan takes an Ignited enemy.

### Trail of Ice
- Id: trail-of-ice
- Kind: standard
- Lines: none on the page (poe2db shows them only in a hover)
- URL: https://poe2db.tw/us/Monster_Modifiers
- Keyword: Chilled Ground, https://poe2db.tw/us/Chilled_Ground
- Tamed beast keeps it: yes
- Model: condition
- Reach: enemies on its trail
- Config: conditionEnemyOnChilledGround ("Is the enemy on Chilled Ground?")
- Creates: chilled-ground | Pays off on: none
- Note: Judged from its name and the Chilled Ground keyword it links: the page gives no lines. It is the only ice trail
  on either page, so it is taken to be the "Frozen Ground Trail" a guide names.

### Trail of Lightning
- Id: trail-of-lightning
- Kind: standard
- Lines: none on the page (poe2db shows them only in a hover)
- URL: https://poe2db.tw/us/Trail_of_Lightning
- Tamed beast keeps it: yes
- Model: condition
- Reach: enemies on its trail
- Config: conditionEnemyOnShockedGround ("Is the enemy on Shocked Ground?")
- Creates: shocked-ground | Pays off on: none
- Note: Judged from its name, as Trail of Fire and Trail of Ice are: the page gives no lines.

### Slow Resistant
- Id: slow-resistant
- Kind: standard
- Lines:
  - "50% less Slowing Potency of Debuffs on me"
- URL: https://poe2db.tw/us/Slow_Resistant
- Tamed beast keeps it: yes
- Model: none
- Reach: the beast
- Creates: none | Pays off on: companion
- Note: PoB likely doesn't parse its line: it leaves "…% reduced Slowing Potency of Debuffs on You" unparsed
  (`Data/ModCache.lua:1321`).

### Crit Resistant
- Id: crit-resistant
- Kind: standard
- Lines:
  - "Hits against you have 80% reduced Critical Damage Bonus"
- URL: https://poe2db.tw/us/Crit_Resistant
- Tamed beast keeps it: yes
- Model: stats
- Reach: the beast
- Creates: none | Pays off on: companion
- Note: A plan writes its lines as `Companions have …` lines, which PoB gives the companion alone.

### Chaos Resistant
- Id: chaos-resistant
- Kind: standard
- Lines:
  - "+50% to Chaos Resistance"
- URL: https://poe2db.tw/us/Chaos_Resistant
- Tamed beast keeps it: yes
- Model: stats
- Reach: the beast
- Creates: none | Pays off on: companion
- Note: A plan writes its lines as `Companions have …` lines, which PoB gives the companion alone.

### Periodic Fire Explosions
- Id: periodic-fire-explosions
- Kind: standard
- Lines: none on the page (poe2db shows them only in a hover)
- URL: https://poe2db.tw/us/Monster_Modifiers
- Keyword: Fire Damage, https://poe2db.tw/us/Fire_Damage
- Tamed beast keeps it: yes
- Model: none
- Reach: enemies near it
- Creates: none | Pays off on: none
- Note: Damage the beast deals on its own, which PoB can't add; the page gives no lines.

### Periodic Cold Explosions
- Id: periodic-cold-explosions
- Kind: standard
- Lines: none on the page (poe2db shows them only in a hover)
- URL: https://poe2db.tw/us/Monster_Modifiers
- Keyword: Cold Damage, https://poe2db.tw/us/Cold_Damage
- Tamed beast keeps it: yes
- Model: none
- Reach: enemies near it
- Creates: none | Pays off on: none
- Note: Damage the beast deals on its own, which PoB can't add; the page gives no lines.

### Periodic Lightning Explosions
- Id: periodic-lightning-explosions
- Kind: standard
- Lines: none on the page (poe2db shows them only in a hover)
- URL: https://poe2db.tw/us/Monster_Modifiers
- Keyword: Lightning Damage, https://poe2db.tw/us/Lightning_Damage
- Tamed beast keeps it: yes
- Model: none
- Reach: enemies near it
- Creates: none | Pays off on: none
- Note: Damage the beast deals on its own, which PoB can't add; the page gives no lines.

### Fire Explosion on Death
- Id: fire-explosion-on-death
- Kind: standard
- Lines: none on the page (poe2db shows them only in a hover)
- URL: https://poe2db.tw/us/Monster_Modifiers
- Tamed beast keeps it: yes
- Model: none
- Reach: enemies where it dies
- Creates: none | Pays off on: minion-death
- Note: Damage where the beast dies, which PoB can't add; the page gives no lines.

### Cold Explosion on Death
- Id: cold-explosion-on-death
- Kind: standard
- Lines: none on the page (poe2db shows them only in a hover)
- URL: https://poe2db.tw/us/Monster_Modifiers
- Tamed beast keeps it: yes
- Model: none
- Reach: enemies where it dies
- Creates: none | Pays off on: minion-death
- Note: Damage where the beast dies, which PoB can't add; the page gives no lines.

### Lightning Explosion on Death
- Id: lightning-explosion-on-death
- Kind: standard
- Lines: none on the page (poe2db shows them only in a hover)
- URL: https://poe2db.tw/us/Monster_Modifiers
- Tamed beast keeps it: yes
- Model: none
- Reach: enemies where it dies
- Creates: none | Pays off on: minion-death
- Note: Damage where the beast dies, which PoB can't add; the page gives no lines.

### Powerful Minions
- Id: powerful-minions
- Kind: standard
- Lines: none on the page (poe2db shows them only in a hover)
- URL: https://poe2db.tw/us/Powerful_Minions
- Tamed beast keeps it: yes
- Model: none
- Reach: its minions
- Creates: none | Pays off on: none
- Note: What it does for a tamed beast's minions isn't on the page.

### Empowered
- Id: empowered
- Kind: standard
- Lines:
  - "50% increased maximum Life"
  - "25% increased Damage"
- URL: https://poe2db.tw/us/Monster_Modifiers
- Tamed beast keeps it: yes
- Model: stats
- Reach: the beast
- Creates: none | Pays off on: companion
- Note: A plan writes its lines as `Companions have …` lines, which PoB gives the companion alone.

### Extra Physical Damage Aura
- Id: extra-physical-damage-aura
- Kind: standard
- Lines:
  - from the page text: "40% increased Physical Damage"
- Page text: "Monster creates an Aura that grants 40% increased Physical Damage to Allies within 5 metres."
- URL: https://poe2db.tw/us/Extra_Physical_Damage_Aura
- Tamed beast keeps it: yes
- Model: stats
- Reach: its allies within 5 metres: the player and minions
- Creates: none | Pays off on: none
- Note: Its lines are PoB's wording of its own page's text, each an estimate the record marks. The vocabulary has no
  family for a damage buff, so it creates none.

### Haste Aura
- Id: haste-aura
- Kind: standard
- Lines:
  - from the page text: "20% increased Attack Speed"
  - from the page text: "20% increased Cast Speed"
  - from the page text: "10% increased Movement Speed"
- Page text: "Monster creates an Aura that grants 20% increased Attack and Cast speed and 10% increased Movement speed
  to Allies within 5 metres."
- URL: https://poe2db.tw/us/Haste_Aura
- Tamed beast keeps it: yes
- Model: stats
- Reach: its allies within 5 metres: the player and minions
- Creates: attack-speed, cast-speed, movement-speed | Pays off on: none
- Note: Its lines are PoB's wording of its own page's text, each an estimate the record marks.

### Energy Shield Aura
- Id: energy-shield-aura
- Kind: standard
- Lines:
  - from the page text: "Gain 20% of maximum Life as Extra maximum Energy Shield"
- Page text: "Monster creates an Aura that grants 20% of Maximum life as added Energy Shield to Allies within 5 metres."
- URL: https://poe2db.tw/us/Energy_Shield_Aura
- Tamed beast keeps it: yes
- Model: stats
- Reach: its allies within 5 metres: the player and minions
- Creates: energy-shield | Pays off on: none
- Note: Its lines are PoB's wording of its own page's text, each an estimate the record marks.

### Elemental Resistance Aura
- Id: elemental-resistance-aura
- Kind: standard
- Lines:
  - from the page text: "+35% to all Elemental Resistances"
- Page text: "Monster creates an Aura that grants +35% to all Elemental Resistances to Allies within 5 metres."
- URL: https://poe2db.tw/us/Elemental_Resistance_Aura
- Tamed beast keeps it: yes
- Model: stats
- Reach: its allies within 5 metres: the player and minions
- Creates: resistance | Pays off on: none
- Note: Its lines are PoB's wording of its own page's text, each an estimate the record marks.

### Temporal Bubble
- Id: temporal-bubble
- Kind: standard
- Lines:
  - internal stat id: cannot be damaged by things outside radius [0]
- URL: https://poe2db.tw/us/Temporal_Bubble
- Tamed beast keeps it: yes
- Model: none
- Reach: the beast
- Creates: none | Pays off on: companion
- Note: Its only lines are internal stat ids, which PoB can't take as lines.

### Hinder Aura
- Id: hinder-aura
- Kind: standard
- Lines: none on the page (poe2db shows them only in a hover)
- URL: https://poe2db.tw/us/Hinder_Aura
- Tamed beast keeps it: yes
- Model: condition
- Reach: enemies near it
- Config: conditionEnemyHindered ("Is the enemy Hindered?")
- Creates: hinder | Pays off on: none
- Note: Judged from its name: the page gives no lines.

### Prevents Recovery Above 50%
- Id: prevents-recovery-above-50
- Kind: standard
- Lines: none on the page (poe2db shows them only in a hover)
- URL: https://poe2db.tw/us/Prevents_Recovery_Above_50%25
- Tamed beast keeps it: yes
- Model: none
- Reach: enemies near it
- Creates: none | Pays off on: none
- Note: It stops enemies' recovery, which PoB doesn't model; the page gives no lines.

### Periodic Invulnerability Aura
- Id: periodic-invulnerability-aura
- Kind: standard
- Lines:
  - internal stat id: monster allies cannot take damage pulse owner [1]
- URL: https://poe2db.tw/us/Periodic_Invulnerability_Aura
- Tamed beast keeps it: yes
- Model: none
- Reach: its allies: the player and minions
- Creates: none | Pays off on: none
- Note: Its only lines are internal stat ids, which PoB can't take as lines. The id names "monster allies".

### Empowered Periodic Invulnerability Aura
- Id: empowered-periodic-invulnerability-aura
- Kind: standard
- Lines:
  - internal stat id: monster allies cannot take damage pulse owner [1]
- URL: https://poe2db.tw/us/Empowered_Periodic_Invulnerability_Aura
- Tamed beast keeps it: yes
- Model: none
- Reach: its allies: the player and minions
- Creates: none | Pays off on: none
- Note: Its only lines are internal stat ids, which PoB can't take as lines. The id names "monster allies".

### Increased Life
- Id: increased-life
- Kind: standard
- Lines:
  - "50% increased maximum Life"
- URL: https://poe2db.tw/us/Monster_Modifiers
- Tamed beast keeps it: yes
- Model: stats
- Reach: the beast
- Creates: none | Pays off on: companion
- Note: A plan writes its lines as `Companions have …` lines, which PoB gives the companion alone.

### Siphons Mana and Deals Lightning Damage
- Id: siphons-mana-and-deals-lightning-damage
- Kind: standard
- Lines: none on the page (poe2db shows them only in a hover)
- URL: https://poe2db.tw/us/Siphons_Mana_and_Deals_Lightning_Damage
- Tamed beast keeps it: yes
- Model: none
- Reach: enemies near it
- Creates: none | Pays off on: none
- Note: Damage the beast deals on its own, which PoB can't add; the page gives no lines.

### Heals Allies and Suppresses Foe Recovery
- Id: heals-allies-and-suppresses-foe-recovery
- Kind: standard
- Lines: none on the page (poe2db shows them only in a hover)
- URL: https://poe2db.tw/us/Heals_Allies_and_Suppresses_Foe_Recovery
- Tamed beast keeps it: yes
- Model: none
- Reach: its allies: the player and minions, and enemies near it
- Creates: recovery | Pays off on: none
- Note: Judged from its name: the page gives no lines, and PoB has no line for an ally's periodic heal.

### Siphons Flask Charges
- Id: siphons-flask-charges
- Kind: standard
- Lines:
  - "Flasks gain -0.05 charges per Second"
- URL: https://poe2db.tw/us/Siphons_Flask_Charges
- Tamed beast keeps it: yes
- Model: none
- Reach: enemies near it
- Creates: none | Pays off on: none
- Note: It drains flask charges, which a tamed beast's enemies don't have.

### Reviving Minions
- Id: reviving-minions
- Kind: standard
- Lines: none on the page (poe2db shows them only in a hover)
- URL: https://poe2db.tw/us/Reviving_Minions
- Tamed beast keeps it: yes
- Model: none
- Reach: its minions
- Creates: none | Pays off on: none
- Note: What it does for a tamed beast's minions isn't on the page.

### Empowered Reviving Minions
- Id: empowered-reviving-minions
- Kind: standard
- Lines: none on the page (poe2db shows them only in a hover)
- URL: https://poe2db.tw/us/Empowered_Reviving_Minions
- Tamed beast keeps it: yes
- Model: none
- Reach: its minions
- Creates: none | Pays off on: none
- Note: What it does for a tamed beast's minions isn't on the page.

### Damage Taken From Minions First
- Id: damage-taken-from-minions-first
- Kind: standard
- Lines:
  - internal stat id: damage removed from pack minions before life or es % [50]
- URL: https://poe2db.tw/us/Damage_Taken_From_Minions_First
- Tamed beast keeps it: yes
- Model: none
- Reach: the beast
- Creates: none | Pays off on: companion
- Note: Its only lines are internal stat ids, which PoB can't take as lines.

### Shroud Walker
- Id: shroud-walker
- Kind: standard
- Lines: none on the page (poe2db shows them only in a hover)
- URL: https://poe2db.tw/us/Shroud_Walker
- Tamed beast keeps it: yes
- Model: none
- Reach: the beast
- Creates: none | Pays off on: none
- Note: Judged from its name: the page gives no lines.

### Periodically Enrages
- Id: periodically-enrages
- Kind: standard
- Lines: none on the page (poe2db shows them only in a hover)
- URL: https://poe2db.tw/us/Periodically_Enrages
- Tamed beast keeps it: yes
- Model: none
- Reach: the beast
- Creates: none | Pays off on: companion
- Note: Judged from its name: the page gives no lines. A plan has no figure for the enrage.

### Enraged
- Id: enraged
- Kind: standard
- Lines: none on the page (poe2db shows them only in a hover)
- URL: https://poe2db.tw/us/Enraged
- Tamed beast keeps it: yes
- Model: none
- Reach: the beast
- Creates: none | Pays off on: companion
- Note: Judged from its name: the page gives no lines. A plan has no figure for the enrage.

### Explodes Nearby Corpses
- Id: explodes-nearby-corpses
- Kind: standard
- Lines: none on the page (poe2db shows them only in a hover)
- URL: https://poe2db.tw/us/Monster_Modifiers
- Keyword: Corpses, https://poe2db.tw/us/Corpses
- Tamed beast keeps it: yes
- Model: none
- Reach: enemies near it
- Creates: none | Pays off on: corpse
- Note: It uses up corpses near the beast; the page gives no lines.

### Lightning Mirage When Hit
- Id: lightning-mirage-when-hit
- Kind: standard
- Lines: none on the page (poe2db shows them only in a hover)
- URL: https://poe2db.tw/us/Lightning_Mirage_When_Hit
- Tamed beast keeps it: yes
- Model: none
- Reach: the beast
- Creates: none | Pays off on: none
- Note: Judged from its name: the page gives no lines.

### Lightning Mirages When Hit
- Id: lightning-mirages-when-hit
- Kind: standard
- Lines: none on the page (poe2db shows them only in a hover)
- URL: https://poe2db.tw/us/Lightning_Mirages_When_Hit
- Tamed beast keeps it: yes
- Model: none
- Reach: the beast
- Creates: none | Pays off on: none
- Note: Judged from its name: the page gives no lines.

### Magma Barrier
- Id: magma-barrier
- Kind: standard
- Lines: none on the page (poe2db shows them only in a hover)
- URL: https://poe2db.tw/us/Magma_Barrier
- Tamed beast keeps it: yes
- Model: none
- Reach: the beast
- Creates: none | Pays off on: companion
- Note: Judged from its name: the page gives no lines.

### Conjures Ice Prisons
- Id: conjures-ice-prisons
- Kind: standard
- Lines: none on the page (poe2db shows them only in a hover)
- URL: https://poe2db.tw/us/Conjures_Ice_Prisons
- Tamed beast keeps it: yes
- Model: none
- Reach: enemies near it
- Creates: none | Pays off on: none
- Note: Damage the beast deals on its own, which PoB can't add; the page gives no lines.

### Conjures Flamewalls
- Id: conjures-flamewalls
- Kind: standard
- Lines: none on the page (poe2db shows them only in a hover)
- URL: https://poe2db.tw/us/Conjures_Flamewalls
- Tamed beast keeps it: yes
- Model: none
- Reach: enemies near it
- Creates: none | Pays off on: none
- Note: Damage the beast deals on its own, which PoB can't add; the page gives no lines.

### Conjures Lightning Storms
- Id: conjures-lightning-storms
- Kind: standard
- Lines: none on the page (poe2db shows them only in a hover)
- URL: https://poe2db.tw/us/Monster_Modifiers
- Keyword: Lightning Damage, https://poe2db.tw/us/Lightning_Damage
- Tamed beast keeps it: yes
- Model: none
- Reach: enemies near it
- Creates: none | Pays off on: none
- Note: Damage the beast deals on its own, which PoB can't add; the page gives no lines.

### Volatile Crystals
- Id: volatile-crystals
- Kind: standard
- Lines: none on the page (poe2db shows them only in a hover)
- URL: https://poe2db.tw/us/Volatile_Crystals
- Tamed beast keeps it: yes
- Model: none
- Reach: enemies near it
- Creates: none | Pays off on: none
- Note: Damage the beast deals on its own, which PoB can't add; the page gives no lines.

### Volatile Plants
- Id: volatile-plants
- Kind: standard
- Lines: none on the page (poe2db shows them only in a hover)
- URL: https://poe2db.tw/us/Volatile_Plants
- Tamed beast keeps it: yes
- Model: none
- Reach: enemies near it
- Creates: none | Pays off on: none
- Note: Damage the beast deals on its own, which PoB can't add; the page gives no lines.

### Empowering Volatile Plants
- Id: empowering-volatile-plants
- Kind: standard
- Lines: none on the page (poe2db shows them only in a hover)
- URL: https://poe2db.tw/us/Empowering_Volatile_Plants
- Tamed beast keeps it: yes
- Model: none
- Reach: enemies near it
- Creates: none | Pays off on: none
- Note: Damage the beast deals on its own, which PoB can't add; the page gives no lines.

### Volatile Crag
- Id: volatile-crag
- Kind: standard
- Lines: none on the page (poe2db shows them only in a hover)
- URL: https://poe2db.tw/us/Volatile_Crag
- Tamed beast keeps it: yes
- Model: none
- Reach: enemies near it
- Creates: none | Pays off on: none
- Note: Damage the beast deals on its own, which PoB can't add; the page gives no lines.

### Empowering Volatile Crag
- Id: empowering-volatile-crag
- Kind: standard
- Lines: none on the page (poe2db shows them only in a hover)
- URL: https://poe2db.tw/us/Empowering_Volatile_Crag
- Tamed beast keeps it: yes
- Model: none
- Reach: enemies near it
- Creates: none | Pays off on: none
- Note: Damage the beast deals on its own, which PoB can't add; the page gives no lines.

### Proximal Tangibility
- Id: proximal-tangibility
- Kind: standard
- Lines:
  - internal stat id: ignore cannot be damaged by enemies [0]
- URL: https://poe2db.tw/us/Proximal_Tangibility
- Tamed beast keeps it: yes
- Model: none
- Reach: the beast
- Creates: none | Pays off on: companion
- Note: Its only lines are internal stat ids, which PoB can't take as lines.

### Bombardier
- Id: bombardier
- Kind: standard
- Lines: none on the page (poe2db shows them only in a hover)
- URL: https://poe2db.tw/us/Monster_Modifiers
- Tamed beast keeps it: yes
- Model: none
- Reach: enemies near it
- Creates: none | Pays off on: none
- Note: Damage the beast deals on its own, which PoB can't add; the page gives no lines.

### Soul Eater
- Id: soul-eater
- Kind: abyss
- Lines: none on the page (poe2db shows them only in a hover)
- URL: https://poe2db.tw/us/Soul_Eater
- Tamed beast keeps it: yes
- Model: none
- Reach: the beast
- Creates: none | Pays off on: none
- Note: Judged from its name: the page gives no lines.

### Conjures Elemental Hazards
- Id: conjures-elemental-hazards
- Kind: standard
- Lines: none on the page (poe2db shows them only in a hover)
- URL: https://poe2db.tw/us/Monster_Modifiers
- Tamed beast keeps it: yes
- Model: none
- Reach: enemies near it
- Creates: none | Pays off on: none
- Note: Damage the beast deals on its own, which PoB can't add; the page gives no lines.

### Volatile Souls
- Id: volatile-souls
- Kind: abyss
- Lines: none on the page (poe2db shows them only in a hover)
- URL: https://poe2db.tw/us/Monster_Modifiers
- Tamed beast keeps it: yes
- Model: none
- Reach: enemies near it
- Creates: none | Pays off on: none
- Note: Damage the beast deals on its own, which PoB can't add; the page gives no lines.

### Soul Siphoner
- Id: soul-siphoner
- Kind: abyss
- Lines: none on the page (poe2db shows them only in a hover)
- URL: https://poe2db.tw/us/Monster_Modifiers
- Tamed beast keeps it: yes
- Model: none
- Reach: not on the page
- Creates: none | Pays off on: none
- Note: Judged from its name: the page gives no lines.

### Kurgal's Last Gasp
- Id: kurgals-last-gasp
- Kind: abyss-special
- Lines: none on the page (poe2db shows them only in a hover)
- URL: https://poe2db.tw/us/Monster_Modifiers
- Tamed beast keeps it: yes
- Model: none
- Reach: not on the page
- Creates: none | Pays off on: none
- Note: Judged from its name: the page gives no lines.

### Undying Will
- Id: undying-will
- Kind: abyss
- Lines:
  - internal stat id: ignore cannot be damaged by enemies [1]
  - internal stat id: ignore cannot be damaged by enemies [0]
- URL: https://poe2db.tw/us/Monster_Modifiers
- Tamed beast keeps it: yes
- Model: none
- Reach: the beast
- Creates: none | Pays off on: companion
- Note: Its only lines are internal stat ids, which PoB can't take as lines.

### Lithomantic Runes
- Id: lithomantic-runes
- Kind: abyss
- Lines: none on the page (poe2db shows them only in a hover)
- URL: https://poe2db.tw/us/Monster_Modifiers
- Tamed beast keeps it: yes
- Model: none
- Reach: not on the page
- Creates: none | Pays off on: none
- Note: Judged from its name: the page gives no lines.

### Meteoric Demise
- Id: meteoric-demise
- Kind: abyss
- Lines: none on the page (poe2db shows them only in a hover)
- URL: https://poe2db.tw/us/Monster_Modifiers
- Tamed beast keeps it: yes
- Model: none
- Reach: not on the page
- Creates: none | Pays off on: none
- Note: Judged from its name: the page gives no lines.

### Kulemak's Desecration
- Id: kulemaks-desecration
- Kind: abyss
- Lines: none on the page (poe2db shows them only in a hover)
- URL: https://poe2db.tw/us/Monster_Modifiers
- Tamed beast keeps it: yes
- Model: none
- Reach: not on the page
- Creates: none | Pays off on: none
- Note: Judged from its name: the page gives no lines.

### Ulaman's Legion
- Id: ulamans-legion
- Kind: abyss-special
- Lines:
  - internal stat id: grant actor scale +% to aura owner on death [0]
  - internal stat id: grant attack speed +% to aura owner on death [0]
  - internal stat id: grant damage reduction % to aura owner on death [0]
  - internal stat id: soul is consumed on death [0]
- URL: https://poe2db.tw/us/Monster_Modifiers
- Tamed beast keeps it: yes
- Model: none
- Reach: the beast
- Creates: none | Pays off on: none
- Note: Its only lines are internal stat ids, which PoB can't take as lines. They name the "aura owner", the beast.

### Amanamu's Void
- Id: amanamus-void
- Kind: abyss-special
- Lines: none on the page (poe2db shows them only in a hover)
- URL: https://poe2db.tw/us/Monster_Modifiers
- Tamed beast keeps it: yes
- Model: none
- Reach: not on the page
- Creates: none | Pays off on: none
- Note: Judged from its name: the page gives no lines.

### Lifestealer Aura
- Id: lifestealer-aura
- Kind: abyss
- Lines: none on the page (poe2db shows them only in a hover)
- URL: https://poe2db.tw/us/Monster_Modifiers
- Tamed beast keeps it: yes
- Model: none
- Reach: enemies near it
- Creates: none | Pays off on: none
- Note: Judged from its name: the page gives no lines.

### Unstable Revenants
- Id: unstable-revenants
- Kind: abyss
- Lines: none on the page (poe2db shows them only in a hover)
- URL: https://poe2db.tw/us/Monster_Modifiers
- Tamed beast keeps it: yes
- Model: none
- Reach: not on the page
- Creates: none | Pays off on: none
- Note: Judged from its name: the page gives no lines.

### Bubonic Trail
- Id: bubonic-trail
- Kind: abyss
- Lines: none on the page (poe2db shows them only in a hover)
- URL: https://poe2db.tw/us/Monster_Modifiers
- Tamed beast keeps it: yes
- Model: none
- Reach: enemies on its trail
- Creates: other-ground | Pays off on: none
- Note: Judged from its name, a trail as Trail of Ice is: the page gives no lines, so its ground's kind is unknown and
  PoB has no option for it.

### Crystalline Barrier
- Id: crystalline-barrier
- Kind: abyss
- Lines: none on the page (poe2db shows them only in a hover)
- URL: https://poe2db.tw/us/Monster_Modifiers
- Tamed beast keeps it: yes
- Model: none
- Reach: the beast
- Creates: none | Pays off on: companion
- Note: Judged from its name: the page gives no lines.

### Soulflame Geysers
- Id: soulflame-geysers
- Kind: abyss
- Lines: none on the page (poe2db shows them only in a hover)
- URL: https://poe2db.tw/us/Monster_Modifiers
- Tamed beast keeps it: yes
- Model: none
- Reach: enemies near it
- Creates: none | Pays off on: none
- Note: Damage the beast deals on its own, which PoB can't add; the page gives no lines.

### Shade Walker
- Id: shade-walker
- Kind: abyss
- Lines: none on the page (poe2db shows them only in a hover)
- URL: https://poe2db.tw/us/Monster_Modifiers
- Tamed beast keeps it: yes
- Model: none
- Reach: the beast
- Creates: none | Pays off on: none
- Note: Judged from its name: the page gives no lines.

### Eruption of Souls
- Id: eruption-of-souls
- Kind: abyss
- Lines: none on the page (poe2db shows them only in a hover)
- URL: https://poe2db.tw/us/Monster_Modifiers
- Tamed beast keeps it: yes
- Model: none
- Reach: enemies near it
- Creates: none | Pays off on: none
- Note: Damage the beast deals on its own, which PoB can't add; the page gives no lines.

### Corrupted
- Id: corrupted
- Kind: corrupted
- Lines:
  - internal stat id: hits against you have decimating strike [1]
  - internal stat id: hits against you have culling strike [1]
  - internal stat id: cannot be dominated [1]
  - internal stat id: corpse cannot be destroyed [1]
  - internal stat id: monster raises after death [1]
  - internal stat id: is gigantic [1]
- URL: https://poe2db.tw/us/Monster_Modifiers
- Tamed beast keeps it: yes
- Model: none
- Reach: the beast
- Creates: none | Pays off on: none
- Note: Its only lines are internal stat ids, which PoB can't take as lines. Several rows share this name, each a
  different effect.
