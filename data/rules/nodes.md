# Nodes: every ascendancy notable and keystone

The rule-changer index's node file (amendment 8, D-401), written from the pinned Path of Building 2 (v0.23.1) game
text: one line per ascendancy notable (22 ascendancies, 208 notables) and keystone (33). A tree focus reads its
ascendancy's section and the keystones whole; the node's own lines come from a lookup, not from this file.

A line is `- <Name> (<node id>, <Ascendancy or keystone>) — <what it does>.` A node that changes how a standard
mechanic works is marked `[rule]`, says the rule it changes in plain words, and carries its tags: `creates:` and
`pays off on:`, words from `vocabulary.md` (or `none`), and `PoB models it:`, from `check_model_coverage` on the
node's lines (`yes` every line fully parsed, `no` none, `partly` some). A multiple-choice notable lists its options.
`rules-index.mjs check` checks every line; `pairs.md` joins the tags.

## Infernalist

- Altered Flesh (18348, Infernalist) — takes 20% of Physical damage as Chaos and 20% of Lightning and Cold damage as Fire.
- Beidat's Gaze (36564, Infernalist) [rule] — reserves a quarter of your Life and turns maximum Life into maximum Mana (1 per 6 Life). creates: mana | pays off on: life | PoB models it: yes
- Beidat's Hand (24039, Infernalist) [rule] — reserves a quarter of your Life and turns maximum Life into maximum Energy Shield (1 per 8 Life). creates: energy-shield | pays off on: life | PoB models it: yes
- Beidat's Will (46644, Infernalist) [rule] — reserves a quarter of your Life and turns maximum Life into maximum Spirit (1 per 25 Life). creates: spirit | pays off on: life | PoB models it: yes
- Bringer of Flame (18158, Infernalist) [rule] — all damage from you and allies in your Presence counts toward Flammability and Ignite magnitude, not only Fire damage. creates: ignite | pays off on: none | PoB models it: yes
- Demonic Possession (25239, Infernalist) — grants the skill Demon Form.
- Grinning Immolation (34419, Infernalist) [rule] — your Critical Hits Ignite you, burning 15% of your Life and Energy Shield per second, for 50% more Critical Damage Bonus. creates: ignite | pays off on: crit | PoB models it: partly
- Loyal Hellhound (17754, Infernalist) — grants the skill Summon Infernal Hound.
- Mastered Darkness (61267, Infernalist) [rule] — Demon Form's Demonflame has no maximum, so it keeps stacking. creates: none | pays off on: none | PoB models it: yes
- Pyromantic Pact (13174, Infernalist) [rule] — replaces Mana with twice as much Infernal Flame, which skills gain instead of spending Mana; at its maximum you take your Life and Energy Shield as Fire damage and lose it all. creates: none | pays off on: mana | PoB models it: no
- Seething Body (10694, Infernalist) [rule] — casting a Spell on high Infernal Flame grants Elemental Archon, which lasts while the Flame stays high and ends when it reaches maximum. creates: none | pays off on: mana | PoB models it: no

## Blood Mage

- Blood Barbs (26282, Blood Mage) [rule] — Elemental damage also adds to Bleeding magnitude, and your Bleeding on Cursed targets is Aggravated. creates: bleed | pays off on: curse | PoB models it: yes
- Crimson Power (31223, Blood Mage) [rule] — the Energy Shield on your equipped Body Armour also grants as much maximum Life. creates: life | pays off on: body-slot, energy-shield | PoB models it: yes
- Gore Spike (52703, Blood Mage) — 1% increased Critical Damage Bonus per 50 current Life.
- Grasping Wounds (56162, Blood Mage) [rule] — a quarter of the Life a Hit would take is lost over 4 seconds instead of at once. creates: none | pays off on: life | PoB models it: yes
- Sanguimancy (8415, Blood Mage) [rule] — skills cost Life equal to their base Mana cost on top of it, and grants the skill Life Remnants. creates: remnant | pays off on: life | PoB models it: yes
- Sanguine Tides (65518, Blood Mage) [rule] — Life Flasks stop recovering Life and fill from Life you spend; hitting with a full Life Flask spends its charges for extra Physical damage. creates: damage-conversion | pays off on: life, flask | PoB models it: no
- Sunder the Flesh (26383, Blood Mage) [rule] — Spells' base Critical Hit chance is 15%, whatever the skill's own. creates: crit | pays off on: none | PoB models it: yes
- Vitality Siphon (23416, Blood Mage) — 20% of Spell damage Leeched as Life.
- Whispers of the Flesh (27667, Blood Mage) [rule] — targets you Curse have at least 15% of their Life Reserved and no Life Regeneration. creates: none | pays off on: curse | PoB models it: yes

## Lich

- Blackened Heart (2877, Lich) — 4% increased magnitude of Unholy Might you grant per 100 maximum Mana.
- Crystalline Phylactery (17788, Lich) [rule] — adds a socket for a non-unique basic Jewel, whose bonuses have 100% increased effect; skills cost 50% more Mana while you have no Energy Shield. creates: socket | pays off on: energy-shield | PoB models it: partly
- Eldritch Empowerment (58932, Lich) [rule] — casting a Spell sacrifices 5% of your Energy Shield, without interrupting its recharge, for 30% more Spell damage. creates: none | pays off on: energy-shield | PoB models it: partly
- Eternal Life (28431, Lich) [rule] — your Life can't change while you have Energy Shield. creates: none | pays off on: energy-shield | PoB models it: yes
- Incessant Cacophony (59, Lich) [rule] — your Curses never expire, and you can apply one more. creates: curse | pays off on: none | PoB models it: partly
- Necromantic Conduit (26085, Lich) [rule] — you and allies in your Presence have Unholy Might while you aren't on Low Mana, and you lose 5% of your Mana per second. creates: damage-conversion | pays off on: mana | PoB models it: yes
- Price of Power (2516, Lich) [rule] — Spells consume a Power Charge when they can, for 40% more damage. creates: none | pays off on: power-charge | PoB models it: yes
- Rupture the Soul (23352, Lich) [rule] — Cursed enemies killed by you or your allies may explode for a quarter of their Life as Chaos damage. creates: area | pays off on: curse, on-kill | PoB models it: yes
- Soulless Form (33570, Lich) [rule] — no inherent Mana Regeneration; you regenerate Mana equal to 6% of maximum Life per second, and 10% of damage taken bypasses Energy Shield. creates: mana | pays off on: life | PoB models it: yes

## Deadeye

- Avidity (37336, Deadeye) — gaining a Frenzy Charge has a 50% chance to grant another.
- Bullseye (24226, Deadeye) — consuming a Mark on an enemy applies 10 Critical Weakness to it.
- Called Shots (59913, Deadeye) — grants the skill Called Shots.
- Endless Munitions (12033, Deadeye) — skills fire an additional Projectile.
- Gathering Winds (30, Deadeye) — gain Tailwind when you use a skill, and lose it all when Hit.
- Mirage Deadeye (5817, Deadeye) — grants the skill Mirage Deadeye.
- Projectile Proximity Specialisation (42416, Deadeye) — choose Point Blank (up to 20% more Projectile Hit damage close by) or Far Shot (up to 20% more far away).
- Thrilling Chase (23508, Deadeye) [rule] — the benefits of a skill consuming Frenzy Charges have a 50% chance to be doubled. creates: none | pays off on: frenzy-charge | PoB models it: yes

## Pathfinder

- Brew Concoction (57141, Pathfinder) — choose one Concoction skill: Bleeding, Shattering, Explosive, Fulminating or Acidic.
- Enduring Elixirs (41619, Pathfinder) [rule] — Life Flask effects keep running when your Life is full and no longer queue behind one another. creates: none | pays off on: flask | PoB models it: partly
- Overwhelming Toxicity (29074, Pathfinder) [rule] — doubles how many of your Poisons a target can have at once, for 50% less Poison duration. creates: none | pays off on: poison | PoB models it: yes
- Path Seeker (16433, Pathfinder) [rule] — choose to allocate passives from the Sorceress's or the Warrior's starting point as well, with 4 extra passive points. creates: none | pays off on: none | PoB models it: yes
- Relentless Pursuit (24868, Pathfinder) — Slows don't affect your speed.
- Running Assault (61991, Pathfinder) — you can't be Heavy Stunned while Sprinting, and using skills while moving slows you 30% less.
- Sustainable Practices (40, Pathfinder) [rule] — half your Evasion Rating also grants Elemental damage reduction. creates: none | pays off on: evasion | PoB models it: yes
- Traveller's Wisdom (46454, Pathfinder) [rule] — Attribute passives can grant 5% increased Damage, defences or Cost Efficiency in place of an Attribute. creates: none | pays off on: none | PoB models it: no

## Titan

- Ancestral Empowerment (3762, Titan) — every second Slam you use yourself is Ancestrally Boosted.
- Colossal Capacity (60634, Titan) — carry a Chest with 20 more inventory slots.
- Crushing Impacts (59372, Titan) [rule] — every Hit you deal is a Crushing Blow, and you deal 25% more damage to Heavy Stunned enemies. creates: armour-break | pays off on: stun | PoB models it: partly
- Earthbreaker (42275, Titan) — Slams you use yourself have a 25% chance to cause an additional Aftershock.
- Hulking Form (30115, Titan) — 50% increased effect of small passives.
- Mountain Splitter (59540, Titan) — every third Slam you use yourself that makes no Fissures causes 3 more Aftershocks ahead and to each side.
- Mysterious Lineage (12000, Titan) — 15% more maximum Life.
- Stone Skin (24807, Titan) — 50% more Armour from your equipped Body Armour.

## Warbringer

- Answered Call (39411, Warbringer) — one more Totem, and summoning a Totem triggers the granted skill Ancestral Spirits.
- Anvil's Weight (58704, Warbringer) [rule] — every Hit Breaks Armour equal to 10% of its damage. creates: armour-break | pays off on: on-hit | PoB models it: yes
- Imploding Impacts (36659, Warbringer) [rule] — Fully Broken Armour you inflict increases all damage the enemy takes from Hits instead, and you can Break Armour below zero. creates: none | pays off on: armour-break | PoB models it: yes
- Jade Heritage (6127, Warbringer) — gain a stack of Jade every second, and grants the skill Encase in Jade.
- Renly's Training (23005, Warbringer) [rule] — your equipped Shield grants 35% base Block chance in place of its own value. creates: block | pays off on: offhand-slot | PoB models it: yes
- Turtle Charm (52068, Warbringer) [rule] — your maximum Block chance is 75%, but you take 20% of the damage of Blocked Hits. creates: none | pays off on: block | PoB models it: yes
- Warcaller's Bellow (47097, Warbringer) [rule] — Warcries ignore their cooldowns and explode Corpses for a quarter of their Life as Physical damage. creates: area | pays off on: corpse, cooldown | PoB models it: yes
- Wooden Wall (40915, Warbringer) [rule] — your nearest Totem takes 20% of the damage of Hits for you. creates: none | pays off on: totem | PoB models it: yes

## Smith of Kitava

- Against the Anvil (60298, Smith of Kitava) — grants the skill Temper Weapon.
- Coal Stoker (57959, Smith of Kitava) [rule] — your Fire Resistance modifiers also grant Cold and Lightning Resistance at half their value. creates: resistance | pays off on: none | PoB models it: yes
- Dedication to Kitava (64962, Smith of Kitava) [rule] — your Body Armour makes all of your Armour also apply to Chaos damage. creates: none | pays off on: armour, body-slot | PoB models it: yes
- Flowing Metal (13772, Smith of Kitava) [rule] — your Body Armour makes half of your Armour also apply to Elemental damage. creates: none | pays off on: armour, body-slot | PoB models it: yes
- Forged in Flame (48537, Smith of Kitava) [rule] — your maximum Fire Resistance modifiers also grant maximum Cold and Lightning Resistance. creates: resistance | pays off on: none | PoB models it: yes
- Heat of the Forge (22541, Smith of Kitava) — grants the skill Fire Spell on Hit.
- Heatproofing (25438, Smith of Kitava) — your Body Armour makes you Unaffected by damaging Ailments.
- Internal Layer (110, Smith of Kitava) — your Body Armour removes the Critical Damage Bonus of Hits against you.
- Kitavan Engraving (60913, Smith of Kitava) — your Body Armour grants 15% increased maximum Life.
- Kitavan Imprint (16276, Smith of Kitava) — your Body Armour grants 60% increased Glory generation.
- Leather Bindings (8525, Smith of Kitava) — your Body Armour grants 3% Life Regeneration per second.
- Living Weapon (47184, Smith of Kitava) — grants the skill Manifest Weapon.
- Molten Symbol (9997, Smith of Kitava) — your Body Armour makes you take 25% of Physical damage from Hits as Fire.
- Smith's Masterwork (9988, Smith of Kitava) [rule] — you can use only a Normal (white) Body Armour, and you gain 200 Armour for each connected notable you allocate. creates: armour | pays off on: body-slot | PoB models it: partly
- Spiked Plates (20195, Smith of Kitava) — your Body Armour grants 100% increased Thorns damage.
- Support Straps (49340, Smith of Kitava) — your Body Armour grants 20% increased Strength.
- Tantalum Alloy (61039, Smith of Kitava) — your Body Armour grants +75% Fire Resistance.
- Tribute to Utula (22908, Smith of Kitava) — your Body Armour grants 30% increased Spirit.

## Stormweaver

- Constant Gale (8867, Stormweaver) — you always have Arcane Surge.
- Force of Will (39204, Stormweaver) [rule] — 20% of damage taken comes from Mana before Life, and Arcane Surge grows stronger the more Mana you are missing. creates: none | pays off on: mana | PoB models it: partly
- Heavy Snows (61985, Stormweaver) [rule] — targets can have two of your Chills at once, which can Slow up to 35%, for 25% less Chill magnitude. creates: none | pays off on: chill | PoB models it: yes
- Multiplying Squalls (38578, Stormweaver) — +2 to the Limit of Elemental skills.
- Refracted Infusion (42522, Stormweaver) [rule] — collecting an Elemental Infusion also grants a different Elemental Infusion. creates: infusion | pays off on: none | PoB models it: no
- Shaper of Storms (39640, Stormweaver) [rule] — all damage from Hits counts toward Shock chance, not only Lightning damage. creates: shock | pays off on: none | PoB models it: yes
- Shaper of Winter (18849, Stormweaver) [rule] — all damage from Hits counts toward Chill magnitude, not only Cold damage. creates: chill | pays off on: none | PoB models it: yes
- Storm's Recollection (49189, Stormweaver) [rule] — Remnants you create appear again once, 3 seconds after you collect them, and can be collected from further away. creates: remnant | pays off on: none | PoB models it: no
- Strike Twice (2857, Stormweaver) [rule] — targets can have two of your Shocks at once, for 25% less Shock magnitude. creates: none | pays off on: shock | PoB models it: yes
- Tempest Caller (12882, Stormweaver) — Critical Hits with Spells trigger the granted skill Elemental Storm.

## Chronomancer

- Apex of the Moment (49049, Chronomancer) — enemies in your Presence are Slowed by 20%.
- Footprints in the Sand (26638, Chronomancer) — grants the skill Temporal Rift.
- Inevitability (42035, Chronomancer) — grants the skill Inevitable Agony.
- Now and Again (10987, Chronomancer) — Cascadable Spells have a 20% chance to Echo and Repeatable Spells a 20% chance to Repeat.
- Phased Form (28153, Chronomancer) [rule] — you take 30% less damage, but 4 seconds after an enemy Hit you take 30% of its damage again. creates: none | pays off on: life | PoB models it: partly
- Quicksand Hourglass (10731, Chronomancer) — grants Sands of Time.
- Ultimate Command (58747, Chronomancer) — grants the skill Time Freeze.
- Unbound Encore (3605, Chronomancer) — grants the skill Time Snap.

## Disciple of Varashta

- Barya of Kelari (13289, Disciple of Varashta) — grants the skill Kelari, the Tainted Sands.
- Barya of Navira (32705, Disciple of Varashta) — grants the skill Navira, the Last Mirage.
- Barya of Ruzhan (34207, Disciple of Varashta) — grants the skill Ruzhan, the Blazing Sword.
- Baryanic Leylines (36891, Disciple of Varashta) — non-unique Time-Lost Jewels have 40% increased radius.
- Instruments of Power (20701, Disciple of Varashta) [rule] — you can equip a Focus while wielding a Staff, with 50% reduced bonuses from the Focus. creates: none | pays off on: weapon-slot, offhand-slot | PoB models it: yes
- Kelari's Deception (23265, Disciple of Varashta) — grants the skill Kelari's Deception.
- Kelari's Judgment (25653, Disciple of Varashta) — grants the skill Kelari's Judgment.
- Kelari's Malediction (36109, Disciple of Varashta) — grants the skill Kelari's Malediction.
- Navira's Fracturing (10561, Disciple of Varashta) — grants the skill Navira's Fracturing.
- Navira's Oasis (45602, Disciple of Varashta) — grants the skill Navira's Oasis.
- Navira's Well (43426, Disciple of Varashta) — grants the skill Navira's Well.
- Ruzhan's Fury (14131, Disciple of Varashta) — grants the skill Ruzhan's Fury.
- Ruzhan's Reckoning (25683, Disciple of Varashta) — grants the skill Ruzhan's Reckoning.
- Ruzhan's Trap (64591, Disciple of Varashta) — grants the skill Ruzhan's Trap.
- Sacred Rituals (56857, Disciple of Varashta) [rule] — 60% of your current Energy Shield counts as Armour for Physical damage reduction. creates: armour | pays off on: energy-shield | PoB models it: yes
- The Fourth Teaching (46091, Disciple of Varashta) — 1 second shorter Energy Shield recharge delay, and 40% more recharge rate on Low Energy Shield.
- Varashta's Intuition (2810, Disciple of Varashta) [rule] — all Elemental damage you take comes from Mana before Life. creates: none | pays off on: mana | PoB models it: yes

## Amazon

- Azmeri Brew (47312, Amazon) [rule] — Life Flasks also recover Mana, and Mana Flasks also recover Life. creates: recovery | pays off on: flask | PoB models it: no
- Critical Strike (9294, Amazon) [rule] — chance to Hit with Attacks can exceed 100%, and a quarter of the excess becomes Critical Hit chance. creates: crit | pays off on: none | PoB models it: yes
- Elemental Surge (7979, Amazon) — consuming a Charge triggers the granted skill Elemental Surge, for 3 Lightning Surges.
- In for the Kill (35187, Amazon) — 20% increased Movement Speed and 40% increased Skill Speed while an enemy with an Open Weakness is in your Presence.
- Mystic Harvest (3065, Amazon) [rule] — Life Leech recovers from your Elemental damage as well as Physical. creates: leech | pays off on: none | PoB models it: yes
- Penetrate (41008, Amazon) [rule] — Attacks with your Weapons gain added Physical damage equal to a quarter of the Weapon's Accuracy Rating. creates: none | pays off on: weapon-slot | PoB models it: yes
- Predatory Instinct (55796, Amazon) — reveals Weaknesses on Rare and Unique enemies, and 50% more damage against an enemy with an Open Weakness.
- Stalking Panther (63254, Amazon) [rule] — doubles the Evasion Rating of your Helmet, Gloves and Boots and halves your Body Armour's. creates: evasion | pays off on: helmet-slot, glove-slot, boot-slot | PoB models it: yes
- Surging Avatar (42441, Amazon) — consuming a Charge also triggers Elemental Surge for Fire and Cold Surges, with one fewer Lightning Surge.

## Spirit Walker

- Idolatry (56489, Spirit Walker) — per Idol in your equipment, Companions deal more damage and skills reserve more efficiently; per other Augment, -4% to Elemental Resistances.
- Primal Bounty (46070, Spirit Walker) — gain an Owl Feather every 4 seconds, up to 3, and Dodging spends one to trigger the granted skill Primal Bounty.
- Sacred Unity (28254, Spirit Walker) — the Bear Spirit gains Embrace of the Wild, Vivid Stags leap toward enemies, and Feather-Empowered Projectiles leave Soaring Ground.
- The Catha's Balance (765, Spirit Walker) [rule] — Companions gain added Attack damage equal to 60% of your main hand Weapon's damage. creates: none | pays off on: companion, weapon-slot | PoB models it: yes
- The Mhacha's Gift (4367, Spirit Walker) — Dodging can spend up to 2 Owl Feathers for a stronger Primal Bounty, and Feathers come 50% faster.
- The Mórrigan's Guidance (27773, Spirit Walker) — Vivid Stampede's Stags deal more damage and Shock harder per leap, and leave a Vivid Wisp when it ends.
- The Natural Order (39887, Spirit Walker) [rule] — Tame Beast can capture Unique Beasts, and one Unique Tamed Beast can be summoned, possessed by changing Azmeri Spirits. creates: companion | pays off on: none | PoB models it: no
- Vivid Stampede (41401, Spirit Walker) — every 10 metres you move grants a Vivid Wisp, up to 3, and Attacking spends them to trigger the granted skill Vivid Stampede.
- Wild Protector (62743, Spirit Walker) — grants the skill Wild Protector.

## Ritualist

- As the Whispers Demand (30233, Ritualist) — grants the skill Ritual Sacrifice.
- Corrupted Lifeforce (37046, Ritualist) — grants the skill Blood Boil, and 15% more damage against enemies it affects.
- Intricate Sigils (4891, Ritualist) [rule] — one more Charm slot, and 20% more Charm charges gained. creates: charm | pays off on: none | PoB models it: yes
- Mind Phylacteries (18280, Ritualist) [rule] — a Charm without enough charges can be triggered by spending 25% of your maximum Mana instead. creates: charm | pays off on: mana | PoB models it: no
- Mystic Attunement (7068, Ritualist) — 25% increased bonuses from your equipped Rings and Amulet.
- Unfurled Finger (34785, Ritualist) [rule] — one more Ring slot. creates: ring-slot | pays off on: none | PoB models it: yes
- Wildwood Persistence (62804, Ritualist) — 10% increased Life Recovery rate per 5% of your unreserved Life missing.

## Tactician

- A Solid Plan (15044, Tactician) — Persistent Buffs have 50% less Reservation.
- Cannons, Ready! (37523, Tactician) [rule] — Totems use their skills only when you fire an Attack Projectile, with 30% more skill speed, and one more Totem. creates: none | pays off on: totem, projectile | PoB models it: partly
- Polish That Gear (44371, Tactician) [rule] — gain Deflection Rating equal to 20% of your Armour, and your Evasion Rating as extra Ailment Threshold. creates: deflection | pays off on: armour, evasion | PoB models it: yes
- Right Where We Want Them (54838, Tactician) [rule] — Projectile damage builds Pin, and Pinned enemies can't act. creates: pin | pays off on: projectile | PoB models it: partly
- Stay Light, Use Cover (32637, Tactician) [rule] — you defend with double your Armour, and enemies lose Accuracy against you with distance, but your maximum Evade chance and Physical damage reduction are 50%. creates: none | pays off on: armour, evasion | PoB models it: yes
- Strategic Embankments (4086, Tactician) — Totems you place grant Embankment Auras.
- Suppressing Fire (44746, Tactician) — 40% more Immobilisation buildup.
- Unleash Hell! (1988, Tactician) — grants the skill Supporting Fire.
- Watch How I Do It (16249, Tactician) [rule] — allies in your Presence gain added Attack damage equal to a quarter of your main hand Weapon's damage. creates: none | pays off on: weapon-slot | PoB models it: yes
- Whoever Pays Best (10371, Tactician) [rule] — Banners have no Limit, and they gain 5 Glory per second. creates: glory | pays off on: none | PoB models it: no

## Witchhunter

- Ceremonial Ablution (6935, Witchhunter) — Sorcery Ward's Barrier also takes Physical and Chaos damage from Hits.
- Judge, Jury, and Executioner (17646, Witchhunter) — grants Decimating Strike.
- No Mercy (46535, Witchhunter) — up to 40% more damage against enemies by their missing Concentration.
- Obsessive Rituals (38601, Witchhunter) — grants the skill Sorcery Ward, for 50% less Armour and Evasion Rating.
- Pitiless Killer (61973, Witchhunter) — grants Culling Strike.
- Weapon Master (8272, Witchhunter) [rule] — 100 passive points become Weapon Set points, so each Weapon Set can have its own. creates: none | pays off on: weapon-slot | PoB models it: yes
- Witchbane (3704, Witchhunter) [rule] — enemies have Concentration equal to 30% of their Life; your Hits break it by the damage dealt, and it recovers after 5 seconds untouched. creates: none | pays off on: none | PoB models it: no
- Zealous Inquisition (37078, Witchhunter) [rule] — enemies you kill may explode for their maximum Life as Physical damage, twice as often for Undead and Demons. creates: area | pays off on: on-kill | PoB models it: partly

## Gemling Legionnaire

- Adaptive Capability (53108, Gemling Legionnaire) [rule] — your highest Attribute can meet any gem's Attribute requirements. creates: none | pays off on: none | PoB models it: yes
- Advanced Thaumaturgy (14429, Gemling Legionnaire) [rule] — Gem Quality grants socketed skills an additional effect. creates: none | pays off on: none | PoB models it: yes
- Enhanced Effectiveness (58591, Gemling Legionnaire) [rule] — 20% less Attributes, but the inherent bonuses from Attributes are doubled. creates: none | pays off on: none | PoB models it: yes
- Essence of Virtue (11641, Gemling Legionnaire) — grants the skill Virtuous Barrier.
- Gem Studded (30996, Gemling Legionnaire) [rule] — a bonus by the most numerous colour of your socketed Support Gems: red, Hits against you have no Critical Damage Bonus; blue, 30% less skill cost; green, 40% less Movement Speed penalty while using skills. creates: none | pays off on: none | PoB models it: partly
- Implanted Gems (60287, Gemling Legionnaire) — choose +2 to the level of all skills with a Strength, an Intelligence or a Dexterity requirement.
- Integrated Efficiency (57819, Gemling Legionnaire) — skills gain damage, speed or Critical Hit chance per connected red, green or blue Support Gem.
- Thaumaturgical Infusion (36728, Gemling Legionnaire) — +1% to a maximum Resistance per 3 socketed Support Gems of its colour.

## Martial Artist

- Hollow Focus Technique (19370, Martial Artist) — grants the skill Hollow Focus.
- Hollow Form Technique (1739, Martial Artist) — grants the skill Hollow Form.
- Hollow Resonance Technique (17356, Martial Artist) — grants the skill Hollow Resonance.
- Martial Adept (41751, Martial Artist) — gaining Combo grants an extra Combo, and expending Combo shortens your Energy Shield recharge delay.
- Martial Master (61586, Martial Artist) [rule] — every Attack Hit builds Combo, and skills build and keep Combo whichever Weapon Set is in use. creates: combo | pays off on: none | PoB models it: no
- Runic Meridians (39552, Martial Artist) [rule] — tattooed Runes add Rune-only sockets: one each in Helmet, Gloves and Boots, and two in Body Armour. creates: socket | pays off on: none | PoB models it: no
- Way of the Mountain (51546, Martial Artist) — Immobilising an enemy grants Mountain's Teachings, up to 30, lost when you are Hit or use an Attack they empower.
- Way of the Stonefist (39595, Martial Artist) [rule] — equipped gloves become Fists of Stone, with stronger related explicit modifiers, and gloves ignore Attribute requirements. creates: item-modifiers | pays off on: glove-slot | PoB models it: no

## Invoker

- ...and I Shall Rage (64031, Invoker) — grants the skill Unbound Avatar.
- ...and Protect me from Harm (65173, Invoker) [rule] — Physical damage reduction from Armour uses your Armour and Evasion Rating combined, for 35% less Evasion Rating. creates: armour | pays off on: evasion | PoB models it: yes
- ...and Scatter Them to the Winds (52448, Invoker) — Melee Critical Hits trigger the granted skill Elemental Expression.
- Faith is a Choice (12876, Invoker) — grants the skill Meditate.
- I am the Blizzard... (23587, Invoker) [rule] — Freezing an enemy creates Chilled Ground, and you gain 10% of damage as extra Cold damage. creates: chilled-ground | pays off on: freeze | PoB models it: yes
- I am the Thunder... (7621, Invoker) [rule] — Shocking an enemy may create Shocked Ground, and you gain 10% of damage as extra Lightning damage. creates: shocked-ground | pays off on: shock | PoB models it: yes
- Lead me through Grace... (8143, Invoker) [rule] — your Spirit comes from your Body Armour's Energy Shield and Evasion Rating, not from equipment's Spirit modifiers. creates: spirit | pays off on: body-slot, energy-shield, evasion | PoB models it: yes
- Sunder my Enemies... (63713, Invoker) [rule] — Critical Hits ignore enemy monsters' non-negative Elemental Resistances. creates: none | pays off on: crit | PoB models it: yes
- The Soul Springs Eternal (63236, Invoker) — Meta skills gain 35% more Energy and reserve 50% more efficiently.

## Acolyte of Chayula

- Archon of Chayula (34567, Acolyte of Chayula) — grants the skill Archon of Chayula.
- Chayula's Gift (59759, Acolyte of Chayula) [rule] — your Chaos Resistance is doubled, and +10% to maximum Chaos Resistance. creates: resistance | pays off on: none | PoB models it: partly
- Deepening Shadows (34817, Acolyte of Chayula) — 1% increased maximum Darkness per 1% Chaos Resistance.
- Embrace the Darkness (41076, Acolyte of Chayula) [rule] — you have no Spirit; instead you have Darkness (100, plus 10 per level), which takes damage before Life and Energy Shield and returns after 5 seconds. creates: none | pays off on: none | PoB models it: partly
- Grasp of the Void (31116, Acolyte of Chayula) — grants the skill Void Illusion.
- Inner Turmoil (18826, Acolyte of Chayula) [rule] — inflicting an Elemental Ailment grants Volatility, and Volatility deals you no damage. creates: volatility | pays off on: ignite, chill, freeze, shock, electrocute | PoB models it: no
- Lucid Dreaming (52395, Acolyte of Chayula) — your Remnants have 50% increased effect and range, and you choose the colour of the Flames of Chayula you manifest: Purple, Blue or Red.
- Sap of Nightmares (25781, Acolyte of Chayula) [rule] — Leech recovers from your Chaos damage as well as Physical. creates: leech | pays off on: none | PoB models it: yes
- Unravelling (3781, Acolyte of Chayula) — grants Unravelling.
- Waking Dream (50098, Acolyte of Chayula) — grants the skill Into the Breach.

## Oracle

- Converging Paths (4197, Oracle) — grants the skill Moment of Vulnerability.
- Entwined Realities (32905, Oracle) [rule] — non-keystone passives within a medium radius of an allocated keystone can be allocated without connecting them to your tree. creates: none | pays off on: none | PoB models it: yes
- Fateful Vision (37782, Oracle) — grants the skill Align Fate.
- Forced Outcome (55135, Oracle) — grants Inevitable Critical Hits.
- Harmony Within (30904, Oracle) [rule] — while your Mana is higher than your Life, Hit damage is taken from Mana first, for 15% less maximum Life and Mana. creates: none | pays off on: mana | PoB models it: partly
- The Lesser Harm (34313, Oracle) [rule] — enemies' Critical Hit chance and Hit damage against you are Unlucky. creates: none | pays off on: none | PoB models it: partly
- The Unseen Path (5571, Oracle) — Walk the Paths Not Taken.
- Unnamed Heartwood (52374, Oracle) [rule] — Totems die 6 seconds after their Life reaches zero, and one more Totem. creates: none | pays off on: totem | PoB models it: partly

## Shaman

- Avatar of Evolution (61983, Shaman) — takes 5% of Physical damage as each Element, and Adaptations last 5 seconds with double effect.
- Bringer of the Apocalypse (28745, Shaman) — grants the skill Apocalypse.
- Druidic Champion (56933, Shaman) [rule] — Rage also empowers Spells: 1% more Spell damage per 2 Rage. creates: none | pays off on: rage | PoB models it: yes
- Furious Wellspring (35762, Shaman) [rule] — Rage no longer decays but regenerates (6% per second, scaled by Mana Regeneration modifiers), and skills cost 5 more Rage. creates: rage | pays off on: none | PoB models it: yes
- Reactive Growth (58646, Shaman) — 10% less Elemental damage taken, and you Adapt to each Hit's strongest Element for less damage of that Element.
- Sacred Flow (16204, Shaman) [rule] — each empty Charm slot grants 40 Spirit. creates: spirit | pays off on: charm | PoB models it: yes
- Turning of the Seasons (62523, Shaman) — enemies in your Presence have Exposure, and you gain 10% of damage as extra damage of a random Element.
- Wisdom of the Maji (42253, Shaman) [rule] — you gain the benefits of Bonded modifiers on your Runes and Idols. creates: none | pays off on: socket | PoB models it: no

## Keystones

- Ancestral Bond (45202, keystone) [rule] — your Totem Limit is doubled and placing Totems needs no Charges, but each Totem reserves 75 Spirit. creates: totem | pays off on: spirit | PoB models it: partly
- Avatar of Fire (18684, keystone) [rule] — 75% of your damage is converted to Fire, and you deal no damage of other types. creates: damage-conversion | pays off on: none | PoB models it: yes
- Blackflame Covenant (42680, keystone) [rule] — Fire Spells convert all their Fire damage to Chaos, that Chaos damage still builds Flammability and Ignite, and their Ignites deal Chaos damage. creates: damage-conversion, ignite | pays off on: none | PoB models it: yes
- Blood Magic (51749, keystone) [rule] — you have no Mana, and skills cost Life instead. creates: none | pays off on: life | PoB models it: yes
- Bulwark (56605, keystone) [rule] — Dodge Roll no longer avoids damage; you take 30% less damage from Hits while Dodge Rolling instead. creates: none | pays off on: on-dodge | PoB models it: partly
- Chaos Inoculation (56349, keystone) [rule] — your maximum Life is 1, and you are immune to Chaos damage and Bleeding. creates: none | pays off on: energy-shield | PoB models it: yes
- Conduit (33979, keystone) [rule] — Charges you would gain go to allies in your Presence instead. creates: none | pays off on: endurance-charge, frenzy-charge, power-charge | PoB models it: no
- Crimson Assault (9085, keystone) [rule] — your Bleeding is Aggravated and lasts 1 second at base, with 50% more magnitude. creates: none | pays off on: bleed | PoB models it: yes
- Dance with Death (14226, keystone) — 25% more Skill Speed with an empty off hand and a one-handed Martial Weapon in the main hand.
- Eldritch Battery (57513, keystone) [rule] — your maximum Energy Shield becomes maximum Mana, and Mana costs are doubled. creates: mana | pays off on: energy-shield | PoB models it: yes
- Elemental Equilibrium (46742, keystone) [rule] — you create the next Element's Infusion Remnants instead: Lightning in place of Fire, Cold in place of Lightning, Fire in place of Cold. creates: infusion, remnant | pays off on: none | PoB models it: no
- Eternal Youth (33404, keystone) [rule] — your Life recharges instead of your Energy Shield, with 50% less Life recovery from Flasks. creates: none | pays off on: energy-shield, life | PoB models it: yes
- Giant's Blood (32349, keystone) [rule] — you can wield Two-Handed Axes, Maces and Swords in one hand, for triple Attribute requirements and half the Life from Strength. creates: none | pays off on: weapon-slot, offhand-slot | PoB models it: yes
- Glancing Blows (19288, keystone) [rule] — your chance to Evade is Unlucky and your chance to Deflect is Lucky. creates: none | pays off on: evasion, deflection | PoB models it: yes
- Heartstopper (34497, keystone) [rule] — you take 50% less damage over time from a source that started in the past second, and 50% more after that. creates: none | pays off on: none | PoB models it: no
- Hollow Palm Technique (64601, keystone) [rule] — with both hand slots empty you Attack as though wielding a Quarterstaff, its damage from the skill's level, with Attack speed from your armour's Evasion and Critical Hit chance from its Energy Shield. creates: none | pays off on: weapon-slot, evasion, energy-shield | PoB models it: yes
- Iron Reflexes (28492, keystone) [rule] — all your Evasion Rating becomes Armour. creates: armour | pays off on: evasion | PoB models it: yes
- Lord of the Wilds (61942, keystone) [rule] — you can equip a non-unique Sceptre while wielding a Talisman, for 50% less Spirit and 50% less Reservation Efficiency of non-Minion skills. creates: none | pays off on: weapon-slot, offhand-slot | PoB models it: yes
- Mind Over Matter (45918, keystone) [rule] — all damage is taken from Mana before Life, with 50% less Mana recovery. creates: none | pays off on: mana | PoB models it: yes
- Necromantic Talisman (39935, keystone) [rule] — every bonus from your equipped Amulet applies to your Minions instead of you. creates: none | pays off on: amulet-slot | PoB models it: no
- Oasis (25100, keystone) [rule] — you can't use Charms, for 30% more recovery from Flasks. creates: none | pays off on: flask | PoB models it: yes
- Pain Attunement (55048, keystone) — 30% more Critical Damage Bonus on Low Life, and 30% less on Full Life.
- Primal Hunger (37484, keystone) [rule] — Rage has no effect of its own, but its maximum doubles and it regenerates from Rage spent. creates: rage | pays off on: none | PoB models it: partly
- Resolute Technique (44017, keystone) [rule] — you never deal Critical Hits, and your Accuracy Rating is doubled. creates: none | pays off on: none | PoB models it: partly
- Resonance (25520, keystone) [rule] — you gain the next Charge type instead: Power in place of Frenzy, Frenzy in place of Endurance, Endurance in place of Power. creates: endurance-charge, frenzy-charge, power-charge | pays off on: none | PoB models it: no
- Ritual Cadence (11230, keystone) [rule] — Invocation skills trigger their Spells every 2 seconds instead, gaining no Energy meanwhile, and the Spells cost 50% less Energy. creates: none | pays off on: energy | PoB models it: no
- Scarred Faith (49547, keystone) [rule] — Energy Shield neither recharges nor regenerates and can't exceed your Armour; instead it recoups part of the Physical damage you prevent, more per enemy Power. creates: energy-shield | pays off on: armour | PoB models it: partly
- Trusted Kinship (41861, keystone) [rule] — you can have two Companions of different types, and Companion skills reserve more efficiently while other skills reserve less. creates: companion, minion-count | pays off on: none | PoB models it: partly
- Unwavering Stance (14540, keystone) [rule] — you can't be Light Stunned, and you can't Dodge Roll or Sprint. creates: none | pays off on: none | PoB models it: yes
- Vaal Pact (33369, keystone) [rule] — you recover Life only from Leech, which leeches 50% more but 67% more slowly and continues at full Life. creates: none | pays off on: leech | PoB models it: partly
- Whispers of Doom (47759, keystone) [rule] — you can apply one more Curse, and Curses take twice as long to activate. creates: curse | pays off on: none | PoB models it: yes
- Wildsurge Incantation (49363, keystone) — Storm and Plant Spells deal 50% more damage and cost 50% less, with 75% less duration.
- Zealot's Oath (52, keystone) [rule] — Energy Shield doesn't recharge; instead excess Life Regeneration goes to Energy Shield. creates: energy-shield | pays off on: recovery | PoB models it: yes
