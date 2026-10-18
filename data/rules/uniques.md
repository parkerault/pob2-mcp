# Uniques: the rule changers

The rule-changer index's unique file (amendment 8, D-401), written from the pinned Path of Building 2 (v0.23.1) game
text. One block per unique that changes how a standard mechanic works; a unique with no rule change has no block,
and uniques PoB marks no longer obtainable are left out. Grep it by mechanic or family; never read it whole.

Most uniques give up the resistances, life and defences a rare provides; a block lists only the penalties its own lines state.

A block: the heading names the unique, its item type and its level requirement; `Rule` says the rule it changes;
`Lines` quotes the lines that change it; `Creates` and `Pays off on` use `vocabulary.md`'s families; `Penalties`
quotes its explicit penalty lines; `PoB models it` comes from `check_model_coverage` on the quoted lines (`yes` every
line fully parsed, `no` none, `partly` some). A unique carries no price here: a price is popularity plus rarity,
not evidence that players build around it.

### Beacon of Azis (Amulet, level 30)
- Id: beacon-of-azis
- Rule: Critical Hits ignore enemy monsters' Elemental Resistances.
- Lines: "Critical Hits ignore Enemy Monster Elemental Resistances"
- Creates: none | Pays off on: crit
- Penalties: none
- PoB models it: yes

### Choir of the Storm (Amulet, level 55)
- Id: choir-of-the-storm
- Rule: Critical Hits ignore enemy monsters' Lightning Resistance and trigger the amulet's Lightning Bolt.
- Lines: "Critical Hits Ignore Enemy Monster Lightning Resistance", "Trigger Lightning Bolt Skill on Critical Hit"
- Creates: none | Pays off on: crit
- Penalties: none
- PoB models it: partly — a compile measures only part of what it adds

### Defiance of Destiny (Amulet, level 56)
- Id: defiance-of-destiny
- Rule: You recover part of your missing Life just before an enemy Hit lands.
- Lines: "Recover (20-30)% of Missing Life before being Hit by an Enemy"
- Creates: recovery | Pays off on: none
- Penalties: none
- PoB models it: no — a compile measures what it gives up, not what it adds

### Igniferis (Amulet, level 1)
- Id: igniferis
- Rule: Life Regeneration no longer heals continuously; every 4 seconds it heals in one pulse instead.
- Lines: "Life Recovery from Regeneration is not applied", "Every 4 seconds, Recover 1 Life for every 0.2 Life Recovery per second from Regeneration"
- Creates: none | Pays off on: recovery
- Penalties: "25% reduced Light Radius"
- PoB models it: partly — a compile measures only part of what it adds

### Immaculate Adherence (Amulet, level 30)
- Id: immaculate-adherence
- Rule: Skills cost Divinity, made from your Energy Shield, instead of Mana or Life, and all damage is taken from Mana before Life.
- Lines: "100% of Damage is taken from Mana before Life", "Cannot have Energy Shield", "Convert 100% of maximum Energy Shield to maximum Divinity", "Skills Cost Divinity instead of Mana or Life"
- Creates: none | Pays off on: mana, energy-shield
- Penalties: "20% reduced maximum Divinity per Corrupted Item Equipped"
- PoB models it: partly — a compile measures only part of what it adds

### Ligurium Talisman (Amulet, level 35)
- Id: ligurium-talisman
- Rule: Your Life Regeneration regenerates Energy Shield instead.
- Lines: "Life Regeneration is applied to Energy Shield instead"
- Creates: energy-shield | Pays off on: recovery
- Penalties: none
- PoB models it: yes

### Serpent's Egg (Amulet, level 35)
- Id: serpents-egg
- Rule: Every Charge you gain comes with another.
- Lines: "Gain an additional Charge when you gain a Charge"
- Creates: endurance-charge, frenzy-charge, power-charge | Pays off on: none
- Penalties: none
- PoB models it: no — a compile measures what it gives up, not what it adds

### Strugglescream (Amulet, level 52)
- Id: strugglescream
- Rule: The amulet can hold three more Instilled modifiers.
- Lines: "Can have 3 additional Instilled Modifiers"
- Creates: item-modifiers | Pays off on: amulet-slot
- Penalties: none
- PoB models it: no — a compile measures what it gives up, not what it adds

### The Pandemonius (Amulet, level 52)
- Id: the-pandemonius
- Rule: Your Hits Blind Chilled enemies.
- Lines: "Blind Chilled enemies on Hit"
- Creates: blind | Pays off on: chill
- Penalties: none
- PoB models it: no — a compile measures what it gives up, not what it adds

### Ungil's Harmony (Amulet, level 25)
- Id: ungils-harmony
- Rule: Your Critical Hits deal no extra damage, which suits builds that want Critical Hits for their effects.
- Lines: "You have no Critical Damage Bonus"
- Creates: crit | Pays off on: none
- Penalties: none
- PoB models it: yes

### Bijouborne (Belt, level 44)
- Id: bijouborne
- Rule: The belt has two more Charm slots and grants Cast on Charm Use, so Charms trigger Spells.
- Lines: "Grants Skill: Level (1-20) Cast on Charm Use", "+2 Charm Slots"
- Creates: charm | Pays off on: none
- Penalties: "(10-50)% reduced Charm Effect Duration"
- PoB models it: yes

### Birthright Buckle (Belt, level 14)
- Id: birthright-buckle
- Rule: Life and Mana Flasks recover instantly when used on Low Life or Low Mana.
- Lines: "Life Flasks used while on Low Life apply Recovery Instantly", "Mana Flasks used while on Low Mana apply Recovery Instantly"
- Creates: none | Pays off on: flask, low-life
- Penalties: none
- PoB models it: yes

### Cat O' Nine Tails (Belt, level 55)
- Id: cat-o-nine-tails
- Rule: Recovery other than Flasks can't raise your Life above Low Life, which keeps you on Low Life.
- Lines: "Life Recovery other than Flasks cannot Recover Life to above Low Life"
- Creates: low-life | Pays off on: flask
- Penalties: none
- PoB models it: no — a compile measures what it gives up, not what it adds

### Coward's Legacy (Belt, level 40)
- Id: cowards-legacy
- Rule: You count as on Low Life at 75% of your maximum Life or below.
- Lines: "You are considered on Low Life while at 75% of maximum Life or below instead"
- Creates: low-life | Pays off on: none
- Penalties: "-(20-10) to Strength"
- PoB models it: yes

### Darkness Enthroned (Belt, level 62)
- Id: darkness-enthroned
- Rule: The belt's socketed items grant the bonuses they grant in a Body Armour, Boots, Gloves, a Helmet or a Shield, by variant.
- Lines: "This item gains bonuses from Socketed Items as though it was a Body Armour", "This item gains bonuses from Socketed Items as though it was Boots", "This item gains bonuses from Socketed Items as though it was Gloves", "This item gains bonuses from Socketed Items as though it was a Helmet", "This item gains bonuses from Socketed Items as though it was a Shield"
- Creates: none | Pays off on: socket
- Penalties: none
- PoB models it: no — a compile measures what it gives up, not what it adds

### Goregirdle (Belt, level 24)
- Id: goregirdle
- Rule: You defend with double your Armour, but your Physical damage reduction is capped at 50%.
- Lines: "Defend with 200% of Armour", "Maximum Physical Damage Reduction is 50%"
- Creates: none | Pays off on: armour
- Penalties: none
- PoB models it: yes

### Headhunter (Belt, level 50)
- Id: headhunter
- Rule: Killing a Rare monster grants you its modifiers for 60 seconds.
- Lines: "When you kill a Rare monster, you gain its Modifiers for 60 seconds"
- Creates: none | Pays off on: on-kill
- Penalties: none
- PoB models it: no — a compile measures what it gives up, not what it adds

### Mageblood (Belt, level 55)
- Id: mageblood
- Rule: You have the Legacies of four Charms at all times, by variant.
- Lines: "Legacy of Amethyst", "Legacy of Basalt", "Legacy of Bismuth", "Legacy of Diamond"
- Creates: none | Pays off on: charm
- Penalties: none
- PoB models it: yes

### Shavronne's Satchel (Belt, level 62)
- Id: shavronnes-satchel
- Rule: Life recovery from your Flasks also recovers Energy Shield.
- Lines: "Life Recovery from Flasks also applies to Energy Shield"
- Creates: energy-shield | Pays off on: flask
- Penalties: "(20-30)% reduced Flask Life Recovery rate"
- PoB models it: yes

### Soul Tether (Belt, level 20)
- Id: soul-tether
- Rule: Life Leech beyond your maximum Life goes to Energy Shield, which drains 5% per second.
- Lines: "Excess Life Recovery from Leech is applied to Energy Shield"
- Creates: energy-shield | Pays off on: leech
- Penalties: "You lose 5% of maximum Energy Shield per second"
- PoB models it: no — a compile measures what it gives up, not what it adds

### The Gnashing Sash (Belt, level 60)
- Id: the-gnashing-sash
- Rule: Life Flasks can recover Life above your maximum, which drains 5% per second.
- Lines: "Life Recovery from Flasks can Overflow Maximum Life"
- Creates: life | Pays off on: flask
- Penalties: "Lose 5% of maximum Life per second"
- PoB models it: no — a compile measures what it gives up, not what it adds

### Umbilicus Immortalis (Belt, level 24)
- Id: umbilicus-immortalis
- Rule: Your Life Flask also applies to your Minions, and they can't die while it does.
- Lines: "Your Life Flask also applies to your Minions", "Minions cannot Die while affected by a Life Flask"
- Creates: none | Pays off on: flask
- Penalties: "(30-40)% reduced Flask Effect Duration"
- PoB models it: no — a compile measures what it gives up, not what it adds

### Waistgate (Belt, level 50)
- Id: waistgate
- Rule: Life and Mana Flasks can go in either Flask slot.
- Lines: "Life and Mana Flasks can be equipped in either slot"
- Creates: none | Pays off on: flask
- Penalties: none
- PoB models it: no — a compile measures what it gives up, not what it adds

### Zerphi's Genesis (Belt, level 56)
- Id: zerphis-genesis
- Rule: Charges spent by Charms go to your Life Flasks, and charges spent by Life Flasks go to your Charms.
- Lines: "50% of Charges consumed by used Charms are granted to your Life Flasks", "50% of Charges consumed by used Life Flasks are granted to your Charms"
- Creates: none | Pays off on: flask, charm
- Penalties: none
- PoB models it: no — a compile measures what it gives up, not what it adds

### Apron of Emiran (Body Armour, level 1)
- Id: apron-of-emiran
- Rule: Your Bleeding is Aggravated.
- Lines: "Bleeding you inflict is Aggravated"
- Creates: none | Pays off on: bleed
- Penalties: none
- PoB models it: yes

### Atziri's Splendour (Body Armour, level 65)
- Id: atziris-splendour
- Rule: Only Soul Cores fit its sockets, and they also grant the bonuses they grant in Boots, Gloves, a Helmet or a Shield, by variant; Corrupted gems' skills pay half their Mana cost in Life.
- Lines: "Only Soul Cores can be Socketed in this item", "This item gains bonuses from Socketed Soul Cores as though it was also Boots", "This item gains bonuses from Socketed Soul Cores as though it was also Gloves", "This item gains bonuses from Socketed Soul Cores as though it was also a Helmet", "This item gains bonuses from Socketed Soul Cores as though it was also a Shield", "Skills from Corrupted Gems have 50% of Mana Costs Converted to Life Costs"
- Creates: none | Pays off on: socket, life
- Penalties: none
- PoB models it: partly — a compile measures only part of what it adds

### Belly of the Beast (Body Armour, level 33)
- Id: belly-of-the-beast
- Rule: Life recovery from your Flasks is instant.
- Lines: "Life Recovery from Flasks is instant"
- Creates: none | Pays off on: flask
- Penalties: none
- PoB models it: no — a compile measures what it gives up, not what it adds

### Bitterbloom (Body Armour, level 5)
- Id: bitterbloom
- Rule: Using a Mana Flask starts your Energy Shield recharge.
- Lines: "Energy Shield Recharge starts when you use a Mana Flask"
- Creates: energy-shield | Pays off on: flask
- Penalties: none
- PoB models it: no — a compile measures what it gives up, not what it adds

### Blackbraid (Body Armour, level 1)
- Id: blackbraid
- Rule: Your Armour also applies to Elemental damage.
- Lines: "+(100-150)% of Armour also applies to Elemental Damage"
- Creates: none | Pays off on: armour
- Penalties: none
- PoB models it: yes

### Bramblejack (Body Armour, level 1)
- Id: bramblejack
- Rule: Melee Physical damage you take is reflected to the attacker two and a half times over, but you can't Evade Attacks.
- Lines: "250% of Melee Physical Damage taken reflected to Attacker"
- Creates: none | Pays off on: none
- Penalties: "Cannot Evade Enemy Attacks"
- PoB models it: no — a compile measures what it gives up, not what it adds

### Briskwrap (Body Armour, level 22)
- Id: briskwrap
- Rule: You gain Deflection Rating from your Evasion Rating.
- Lines: "Gain Deflection Rating equal to (20-30)% of Evasion Rating"
- Creates: deflection | Pays off on: evasion
- Penalties: none
- PoB models it: yes

### Bristleboar (Body Armour, level 1)
- Id: bristleboar
- Rule: You gain Rage when enemies Hit you, more on Critical Hits.
- Lines: "Gain 5 Rage when Hit by an Enemy", "Gain 10 Rage when Critically Hit by an Enemy"
- Creates: rage | Pays off on: none
- Penalties: "50% reduced Evasion Rating"
- PoB models it: partly — a compile measures only part of what it adds

### Cloak of Defiance (Body Armour, level 65)
- Id: cloak-of-defiance
- Rule: Half of the damage you take comes from Mana before Life.
- Lines: "50% of Damage is taken from Mana before Life"
- Creates: none | Pays off on: mana
- Penalties: none
- PoB models it: yes

### Cospri's Will (Body Armour, level 73)
- Id: cospris-will
- Rule: Your Curses and Withered never expire, and your Curses affect Hexproof enemies.
- Lines: "Curses you inflict have infinite Duration Curses you inflict can affect Hexproof Enemies", "Withered you inflict has infinite Duration"
- Creates: none | Pays off on: curse
- Penalties: none
- PoB models it: partly — a compile measures only part of what it adds

### Couture of Crimson (Body Armour, level 52)
- Id: couture-of-crimson
- Rule: Life Leech can take you above your maximum Life.
- Lines: "Life Leech can Overflow Maximum Life"
- Creates: life | Pays off on: leech
- Penalties: none
- PoB models it: no — a compile measures what it gives up, not what it adds

### Decree of Loyalty (Body Armour, level 70)
- Id: decree-of-loyalty
- Rule: Your Chaos Resistance above zero converts maximum Life into twice as much Armour, you defend with more Armour while you have Energy Shield, and damage over time can't bypass your Energy Shield.
- Lines: "Convert 1% of maximum Life to twice as much Armour per 1% Chaos Resistance above 0%", "Defend with (150-200)% of Armour while you have Energy Shield", "Damage over Time cannot bypass your Energy Shield"
- Creates: armour | Pays off on: resistance, energy-shield
- Penalties: none
- PoB models it: no — a compile measures what it gives up, not what it adds

### Doryani's Prototype (Body Armour, level 37)
- Id: doryanis-prototype
- Rule: Your Lightning Resistance no longer reduces Lightning damage you take; instead enemies in your Presence share it, and your Armour applies to Lightning damage.
- Lines: "+100% of Armour also applies to Lightning Damage", "Enemies in your Presence have Lightning Resistance equal to yours", "Lightning Resistance does not affect Lightning damage taken"
- Creates: none | Pays off on: resistance, armour
- Penalties: none
- PoB models it: yes

### Forgotten Warden (Body Armour, level 70)
- Id: forgotten-warden
- Rule: You gain Deflection Rating per missing Energy Shield, and your Companion takes part of the damage of Hits you Deflect.
- Lines: "+(70-100) to Deflection Rating per 50 missing Energy Shield", "(10-15)% of Damage from Deflected Hits is taken from Damageable Companion's Life before you"
- Creates: deflection | Pays off on: companion, energy-shield
- Penalties: none
- PoB models it: partly — a compile measures only part of what it adds

### Geofri's Sanctuary (Body Armour, level 65)
- Id: geofris-sanctuary
- Rule: Your maximum Energy Shield is set by your Strength and can't be converted, and you have Zealot's Oath.
- Lines: "Your maximum Energy Shield is equal to (200-300)% of your Strength", "Maximum Energy Shield cannot be Converted", "Zealot's Oath"
- Creates: energy-shield | Pays off on: recovery
- Penalties: none
- PoB models it: partly — a compile measures only part of what it adds

### Ghostwrithe (Body Armour, level 1)
- Id: ghostwrithe
- Rule: A third of your maximum Life becomes Energy Shield.
- Lines: "35% of Maximum Life Converted to Energy Shield"
- Creates: energy-shield | Pays off on: life
- Penalties: none
- PoB models it: yes

### Gloamgown (Body Armour, level 45)
- Id: gloamgown
- Rule: Your Energy Shield's base recharge delay is 10 seconds, but it recharges eleven times as fast.
- Lines: "1000% increased Energy Shield Recharge Rate", "Your base Energy Shield Recharge Delay is 10 seconds"
- Creates: none | Pays off on: energy-shield
- Penalties: none
- PoB models it: yes

### Icetomb (Body Armour, level 16)
- Id: icetomb
- Rule: You gain Cold Thorns damage from your maximum Mana.
- Lines: "Gain Cold Thorns Damage equal to (10-18)% of your maximum Mana"
- Creates: none | Pays off on: mana
- Penalties: none
- PoB models it: yes

### Irongrasp (Body Armour, level 16)
- Id: irongrasp
- Rule: You have Iron Grip and Iron Will.
- Lines: "Iron Grip", "Iron Will"
- Creates: none | Pays off on: none
- Penalties: none
- PoB models it: yes

### Kingsguard (Body Armour, level 33)
- Id: kingsguard
- Rule: Consuming an Endurance Charge recovers 5% of your maximum Life.
- Lines: "Recover 5% of maximum Life for each Endurance Charge consumed"
- Creates: recovery | Pays off on: endurance-charge
- Penalties: "25% reduced Endurance Charge Duration"
- PoB models it: no — a compile measures what it gives up, not what it adds

### Pragmatism (Body Armour, level 52)
- Id: pragmatism
- Rule: Your Charms use no charges.
- Lines: "Charms use no Charges"
- Creates: charm | Pays off on: none
- Penalties: none
- PoB models it: no — a compile measures what it gives up, not what it adds

### Prayers for Rain (Body Armour, level 28)
- Id: prayers-for-rain
- Rule: Damage no longer interrupts an Energy Shield recharge that began recently.
- Lines: "Energy Shield Recharge is not interrupted by Damage if Recharge began Recently"
- Creates: none | Pays off on: energy-shield
- Penalties: "30% slower start of Energy Shield Recharge"
- PoB models it: no — a compile measures what it gives up, not what it adds

### Quatl's Molt (Body Armour, level 36)
- Id: quatls-molt
- Rule: You gain Deflection Rating from your Evasion Rating.
- Lines: "Gain Deflection Rating equal to (40-60)% of Evasion Rating"
- Creates: deflection | Pays off on: evasion
- Penalties: none
- PoB models it: yes

### Queen of the Forest (Body Armour, level 51)
- Id: queen-of-the-forest
- Rule: Your Movement Speed comes from your Evasion Rating, and other Movement Speed modifiers except Sprinting don't apply.
- Lines: "Increases Movement Speed by 25%, plus 1% per 600 Evasion Rating, up to a maximum of 75%", "Other Modifiers to Movement Speed except for Sprinting do not apply"
- Creates: movement-speed | Pays off on: evasion
- Penalties: none
- PoB models it: no — a compile measures what it gives up, not what it adds

### Redflare Conduit (Body Armour, level 33)
- Id: redflare-conduit
- Rule: Hits grant Power Charges, but reaching the maximum loses them all and Shocks you.
- Lines: "20% chance to gain a Power Charge on Hit", "Lose all Power Charges on reaching maximum Power Charges"
- Creates: power-charge | Pays off on: on-hit
- Penalties: "Shocks you when you reach maximum Power Charges"
- PoB models it: no — a compile measures what it gives up, not what it adds

### Reverie (Body Armour, level 28)
- Id: reverie
- Rule: You can't use Life Flasks; instead non-unique Life Flasks apply their effects constantly.
- Lines: "Cannot use Life Flasks", "Non-Unique Life Flasks apply their Effects constantly"
- Creates: recovery | Pays off on: flask
- Penalties: "Recovery from Life Flasks cannot be Instant", "Recovery from your Life Flasks cannot be applied to anything other than you", "(40-60)% less Life Flask Recovery"
- PoB models it: no — a compile measures what it gives up, not what it adds

### Sacrosanctum (Body Armour, level 68)
- Id: sacrosanctum
- Rule: Damage you take that is Recouped as Life is also Recouped as Energy Shield.
- Lines: "Damage taken Recouped as Life is also Recouped as Energy Shield"
- Creates: energy-shield | Pays off on: recovery
- Penalties: none
- PoB models it: yes

### Sierran Inheritance (Body Armour, level 16)
- Id: sierran-inheritance
- Rule: Chill on you is reversed and speeds you up, and all damage from Hits you take builds Chill on you.
- Lines: "All Damage taken from Hits Contributes to Magnitude of Chill inflicted on you", "The Effect of Chill on you is reversed"
- Creates: movement-speed | Pays off on: chill
- Penalties: none
- PoB models it: partly — a compile measures only part of what it adds

### Silks of Veneration (Body Armour, level 68)
- Id: silks-of-veneration
- Rule: Your current Energy Shield also grants Elemental damage reduction.
- Lines: "Current Energy Shield also grants Elemental Damage reduction"
- Creates: none | Pays off on: energy-shield
- Penalties: none
- PoB models it: yes

### Skin of the Loyal (Body Armour, level 1)
- Id: skin-of-the-loyal
- Rule: Your uncapped Resistances raise your defences: Fire your Armour, Cold your Energy Shield, Lightning your Evasion and Chaos your Ailment Threshold.
- Lines: "Elemental Ailment Threshold is increased by Uncapped Chaos Resistance", "Armour is increased by Uncapped Fire Resistance", "Energy Shield is increased by Uncapped Cold Resistance", "Evasion Rating is increased by Uncapped Lightning Resistance"
- Creates: armour, evasion, energy-shield | Pays off on: resistance
- Penalties: none
- PoB models it: yes

### Tetzlapokal's Desire (Body Armour, level 33)
- Id: tetzlapokals-desire
- Rule: Your Life recharges.
- Lines: "Life Recharges"
- Creates: none | Pays off on: energy-shield, life
- Penalties: none
- PoB models it: no — a compile measures what it gives up, not what it adds

### The Auspex (Body Armour, level 65)
- Id: the-auspex
- Rule: Your chance to Deflect is Lucky while on Low Life.
- Lines: "Chance to Deflect is Lucky while on Low Life"
- Creates: none | Pays off on: deflection, low-life
- Penalties: "100% increased Attribute Requirements"
- PoB models it: yes

### The Barrow Dweller (Body Armour, level 11)
- Id: the-barrow-dweller
- Rule: On Low Life, enemies' Hit damage against you is Unlucky, and Hits have a 50% chance not to kill you.
- Lines: "Damage of Enemies Hitting you is Unlucky while you are on Low Life", "50% chance to Avoid Death from Hits"
- Creates: none | Pays off on: low-life
- Penalties: none
- PoB models it: no — a compile measures what it gives up, not what it adds

### The Black Doubt (Body Armour, level 11)
- Id: the-black-doubt
- Rule: While you aren't on Full Life, you sacrifice Mana every second to recover as much Life.
- Lines: "While not on Full Life, Sacrifice 10% of maximum Mana per Second to Recover that much Life"
- Creates: recovery | Pays off on: mana
- Penalties: "Damage over Time bypasses your Energy Shield"
- PoB models it: yes

### The Coming Calamity (Body Armour, level 65)
- Id: the-coming-calamity
- Rule: Enemies in your Presence have no Elemental Resistances.
- Lines: "Enemies in your Presence have no Elemental Resistances"
- Creates: exposure | Pays off on: none
- Penalties: none
- PoB models it: yes

### The Covenant (Body Armour, level 40)
- Id: the-covenant
- Rule: Skills cost Life equal to their Mana cost on top of it, and grants Life Remnants.
- Lines: "Grants Skill: Level (1-20) Life Remnants", "Skills Gain 100% of Mana Cost as Extra Life Cost"
- Creates: remnant | Pays off on: life
- Penalties: none
- PoB models it: yes

### The Mutable Star (Body Armour, level 45)
- Id: the-mutable-star
- Rule: You defend against Hits as though you had 1% more Armour per 1% of your current Energy Shield.
- Lines: "Defend against Hits as though you had 1% more Armour per 1% current Energy Shield"
- Creates: armour | Pays off on: energy-shield
- Penalties: none
- PoB models it: yes

### The Sunken Vessel (Body Armour, level 45)
- Id: the-sunken-vessel
- Rule: All your Armour becomes Evasion Rating, and enemies' Physical Hit damage against you is Unlucky.
- Lines: "Physical Damage of Enemies Hitting you is Unlucky", "Convert All Armour to Evasion Rating"
- Creates: evasion | Pays off on: armour
- Penalties: "30% reduced Life Recovery rate"
- PoB models it: no — a compile measures what it gives up, not what it adds

### Wandering Reliquary (Body Armour, level 27)
- Id: wandering-reliquary
- Rule: Half of the Physical damage your Armour prevents is Recouped as Life.
- Lines: "50% of Physical Damage prevented Recouped as Life"
- Creates: recovery | Pays off on: armour
- Penalties: none
- PoB models it: no — a compile measures what it gives up, not what it adds

### Waveshaper (Body Armour, level 51)
- Id: waveshaper
- Rule: Mana Regeneration modifiers also speed your Energy Shield recharge, and part of your maximum Mana becomes Armour.
- Lines: "Increases and Reductions to Mana Regeneration Rate also apply to Energy Shield Recharge Rate", "Gain (30-50)% of Maximum Mana as Armour"
- Creates: armour | Pays off on: mana
- Penalties: none
- PoB models it: yes

### Widow's Reign (Body Armour, level 45)
- Id: widows-reign
- Rule: Life you would lose to damage is Reserved instead, until you take no Life damage for 3 seconds.
- Lines: "Life that would be lost by taking Damage is instead Reserved", "until you take no Damage to Life for 3 seconds"
- Creates: none | Pays off on: life
- Penalties: none
- PoB models it: partly — a compile measures only part of what it adds

### Yriel's Fostering (Body Armour, level 52)
- Id: yriels-fostering
- Rule: You can have two Companions of different types.
- Lines: "You can have two Companions of different types"
- Creates: companion, minion-count | Pays off on: none
- Penalties: none
- PoB models it: no — a compile measures what it gives up, not what it adds

### Ab Aeterno (Boots, level 65)
- Id: ab-aeterno
- Rule: Your Dodge Roll avoids all Hits, but it leaves you Overencumbered for 4 seconds.
- Lines: "Dodge Roll avoids all Hits", "Gain Overencumbrance for 4 seconds when you Dodge Roll"
- Creates: none | Pays off on: on-dodge
- Penalties: "Gain Overencumbrance for 4 seconds when you Dodge Roll"
- PoB models it: no — a compile measures what it gives up, not what it adds

### Atziri's Step (Boots, level 65)
- Id: atziris-step
- Rule: You gain Deflection Rating from your Evasion Rating, though Deflection prevents a little less damage.
- Lines: "Gain Deflection Rating equal to (40-60)% of Evasion Rating"
- Creates: deflection | Pays off on: evasion
- Penalties: "-(12-6)% to amount of Damage Prevented by Deflection"
- PoB models it: yes

### Beetlebite (Boots, level 52)
- Id: beetlebite
- Rule: Enemies entering your Presence have your Bleeding on them Aggravated.
- Lines: "Aggravate Bleeding on Enemies when they Enter your Presence"
- Creates: none | Pays off on: bleed
- Penalties: none
- PoB models it: no — a compile measures what it gives up, not what it adds

### Birth of Fury (Boots, level 33)
- Id: birth-of-fury
- Rule: You drop Ignited Ground while moving, which Ignites from your maximum Life.
- Lines: "Drop Ignited Ground while moving, which lasts 8 seconds and Ignites as though dealing Fire Damage equal to 10% of your maximum Life"
- Creates: ignited-ground, ignite | Pays off on: moving, life
- Penalties: none
- PoB models it: no — a compile measures what it gives up, not what it adds

### Bushwhack (Boots, level 33)
- Id: bushwhack
- Rule: Your Physical damage builds Pin.
- Lines: "Physical Damage is Pinning"
- Creates: pin | Pays off on: none
- Penalties: none
- PoB models it: yes

### Decree of Flight (Boots, level 65)
- Id: decree-of-flight
- Rule: Dodge Rolling grants Guard from missing Energy Shield, and your maximum Guard comes from your maximum Energy Shield.
- Lines: "Gain Guard equal to (10-20)% of missing Energy Shield for 4 seconds when you Dodge Roll", "Maximum amount of Guard is based on maximum Energy Shield instead", "Divine Flight"
- Creates: none | Pays off on: energy-shield, on-dodge
- Penalties: none
- PoB models it: no — a compile measures what it gives up, not what it adds

### Ghostmarch (Boots, level 16)
- Id: ghostmarch
- Rule: Your Dodge Roll passes through enemies.
- Lines: "Dodge Roll passes through Enemies"
- Creates: none | Pays off on: on-dodge
- Penalties: none
- PoB models it: no — a compile measures what it gives up, not what it adds

### Shankgonne (Boots, level 45)
- Id: shankgonne
- Rule: You gain Deflection Rating from your Armour, but you can't Sprint.
- Lines: "Gain Deflection Rating equal to 20% of Armour"
- Creates: deflection | Pays off on: armour
- Penalties: "You cannot Sprint"
- PoB models it: yes

### The Knight-errant (Boots, level 6)
- Id: the-knight-errant
- Rule: You have Iron Reflexes: all your Evasion Rating becomes Armour.
- Lines: "Iron Reflexes"
- Creates: armour | Pays off on: evasion
- Penalties: none
- PoB models it: yes

### Trampletoe (Boots, level 27)
- Id: trampletoe
- Rule: Part of the damage beyond a kill hits enemies near the one you killed.
- Lines: "Deal 30% of Overkill damage to enemies within 2 metres of the enemy killed"
- Creates: area | Pays off on: on-kill
- Penalties: "50% increased Attribute Requirements"
- PoB models it: no — a compile measures what it gives up, not what it adds

### Wake of Destruction (Boots, level 16)
- Id: wake-of-destruction
- Rule: You drop Shocked Ground while moving.
- Lines: "Drop Shocked Ground while moving, lasting 8 seconds"
- Creates: shocked-ground | Pays off on: moving
- Penalties: none
- PoB models it: no — a compile measures what it gives up, not what it adds

### Windscream (Boots, level 33)
- Id: windscream
- Rule: Your Curses have no activation delay.
- Lines: "Curses have no Activation Delay"
- Creates: none | Pays off on: curse
- Penalties: none
- PoB models it: yes

### Atziri's Acuity (Gloves, level 33)
- Id: atziris-acuity
- Rule: You have Vaal Pact, and part of your Hits' Physical damage causes Blood Loss.
- Lines: "10% of Physical damage dealt by your Hits causes Blood Loss", "Vaal Pact"
- Creates: none | Pays off on: leech
- Penalties: none
- PoB models it: partly — a compile measures only part of what it adds

### Blessed Bonds (Gloves, level 56)
- Id: blessed-bonds
- Rule: Igniting inflicts Cold Exposure, Shocking inflicts Fire Exposure, and Critical Hits inflict Lightning Exposure.
- Lines: "Inflict Cold Exposure on Igniting an Enemy", "Inflict Fire Exposure on Shocking an Enemy", "Inflict Lightning Exposure on Critical Hit"
- Creates: exposure | Pays off on: ignite, shock, on-crit
- Penalties: none
- PoB models it: no — a compile measures what it gives up, not what it adds

### Blueflame Bracers (Gloves, level 33)
- Id: blueflame-bracers
- Rule: All your Fire damage is converted to Cold.
- Lines: "100% of Fire Damage Converted to Cold Damage"
- Creates: damage-conversion | Pays off on: none
- Penalties: none
- PoB models it: yes

### Death Articulated (Gloves, level 65)
- Id: death-articulated
- Rule: Rage no longer decays and regenerates 5 per second, while you lose 5% of your Life per second.
- Lines: "Regenerate 5 Rage per second", "No Inherent loss of Rage"
- Creates: rage | Pays off on: none
- Penalties: "Lose 5% of maximum Life per second"
- PoB models it: yes

### Demon Stitcher (Gloves, level 33)
- Id: demon-stitcher
- Rule: Casting a Spell sacrifices part of your Life to gain as much Energy Shield.
- Lines: "Sacrifice (5-15)% of maximum Life to gain that much Energy Shield when you Cast a Spell"
- Creates: energy-shield | Pays off on: life
- Penalties: none
- PoB models it: no — a compile measures what it gives up, not what it adds

### Dreadfist (Gloves, level 27)
- Id: dreadfist
- Rule: Critical Hits inflict Impale, but can't extract it.
- Lines: "Critical Hits inflict Impale", "Critical Hits cannot Extract Impale"
- Creates: none | Pays off on: crit
- Penalties: none
- PoB models it: no — a compile measures what it gives up, not what it adds

### Empire's Grasp (Gloves, level 52)
- Id: empires-grasp
- Rule: Your Knockback pulls enemies toward you instead.
- Lines: "Knockback direction is reversed"
- Creates: none | Pays off on: none
- Penalties: none
- PoB models it: yes

### Essentia Sanguis (Gloves, level 52)
- Id: essentia-sanguis
- Rule: Your Life Leech leeches Energy Shield instead.
- Lines: "Life Leech is Converted to Energy Shield Leech"
- Creates: energy-shield | Pays off on: leech
- Penalties: none
- PoB models it: yes

### Facebreaker (Gloves, level 1)
- Id: facebreaker
- Rule: With both hands empty you Attack as though wielding a One Hand Mace, using the gloves' own damage.
- Lines: "Can Attack as though using a One Handed Mace while both of your hand slots are empty", "Unarmed Attacks that would use an Equipped One Hand Mace's damage use this Item's damage"
- Creates: none | Pays off on: glove-slot
- Penalties: none
- PoB models it: yes

### Gravebind (Gloves, level 5)
- Id: gravebind
- Rule: Enemies in your Presence killed by anyone count as killed by you, but your other Rarity modifiers don't apply.
- Lines: "Enemies in your Presence killed by anyone count as being killed by you instead"
- Creates: on-kill | Pays off on: none
- Penalties: "Your other Modifiers to Rarity of Items found do not apply"
- PoB models it: no — a compile measures what it gives up, not what it adds

### Hateforge (Gloves, level 33)
- Id: hateforge
- Rule: Reaching maximum Rage grants a random Charge and empties your Rage.
- Lines: "Gain a random Charge on reaching Maximum Rage, no more than once every (3-6) seconds", "Lose all Rage on reaching Maximum Rage"
- Creates: endurance-charge, frenzy-charge, power-charge | Pays off on: rage
- Penalties: none
- PoB models it: no — a compile measures what it gives up, not what it adds

### Idle Hands (Gloves, level 28)
- Id: idle-hands
- Rule: You count as on Full Mana at 90% of your maximum Mana or above.
- Lines: "You count as on Full Mana while at 90% of maximum Mana or above"
- Creates: none | Pays off on: mana
- Penalties: none
- PoB models it: yes

### Jarngreipr (Gloves, level 6)
- Id: jarngreipr
- Rule: Strength can meet the other Attribute requirements of Melee weapons and Melee skills.
- Lines: "Strength can satisfy other Attribute Requirements of Melee Weapons and Melee Skills"
- Creates: none | Pays off on: none
- Penalties: none
- PoB models it: yes

### Killjoy (Gloves, level 16)
- Id: killjoy
- Rule: Your On-Kill effects happen twice, but Flasks don't recover Life.
- Lines: "On-Kill Effects happen twice"
- Creates: none | Pays off on: on-kill
- Penalties: "Flasks do not recover Life"
- PoB models it: no — a compile measures what it gives up, not what it adds

### Kitoko's Current (Gloves, level 26)
- Id: kitokos-current
- Rule: Lightning damage from your Hits builds Electrocution.
- Lines: "Lightning damage from Hits Contributes to Electrocution Buildup"
- Creates: electrocute | Pays off on: none
- Penalties: none
- PoB models it: no — a compile measures what it gives up, not what it adds

### Leopold's Applause (Gloves, level 52)
- Id: leopolds-applause
- Rule: Your Hits can Penetrate Elemental Resistances down to -50%.
- Lines: "Your Hits can Penetrate Elemental Resistances down to a minimum of -50%"
- Creates: none | Pays off on: exposure
- Penalties: none
- PoB models it: yes

### Lochtonial Caress (Gloves, level 16)
- Id: lochtonial-caress
- Rule: You share your Charges with allies in your Presence.
- Lines: "Share Charges with Allies in your Presence"
- Creates: none | Pays off on: endurance-charge, frenzy-charge, power-charge
- Penalties: none
- PoB models it: no — a compile measures what it gives up, not what it adds

### Maligaro's Virtuosity (Gloves, level 45)
- Id: maligaros-virtuosity
- Rule: Your Critical Damage Bonus is fixed at 250%, and your Critical Hit chance can't be rerolled.
- Lines: "Your Critical Hit Chance cannot be Rerolled", "Your Critical Damage Bonus is 250%"
- Creates: none | Pays off on: crit
- Penalties: none
- PoB models it: partly — a compile measures only part of what it adds

### Nightscale (Gloves, level 45)
- Id: nightscale
- Rule: You regenerate Mana only if you dealt a Critical Hit recently, and much faster when you did.
- Lines: "150% increased Mana Regeneration Rate if you've dealt a Critical Hit Recently", "Cannot Regenerate Mana if you haven't dealt a Critical Hit Recently"
- Creates: mana | Pays off on: on-crit
- Penalties: "Cannot Regenerate Mana if you haven't dealt a Critical Hit Recently"
- PoB models it: yes

### Northpaw (Gloves, level 1)
- Id: northpaw
- Rule: Attacks with weapons have a base Critical Hit chance of 7%, whatever the weapon's own.
- Lines: "Base Critical Hit Chance for Attacks with Weapons is 7%"
- Creates: crit | Pays off on: none
- Penalties: none
- PoB models it: yes

### Painter's Servant (Gloves, level 1)
- Id: painters-servant
- Rule: Your Elemental damage is spread evenly across Cold, Fire and Lightning.
- Lines: "33% of Elemental Damage Converted to Cold Damage", "33% of Elemental Damage Converted to Fire Damage", "33% of Elemental Damage Converted to Lightning Damage"
- Creates: damage-conversion | Pays off on: none
- Penalties: none
- PoB models it: yes

### Plaguefinger (Gloves, level 1)
- Id: plaguefinger
- Rule: All damage from your Hits builds Poison magnitude, but you can't inflict Elemental Ailments.
- Lines: "All Damage from Hits Contributes to Poison Magnitude"
- Creates: poison | Pays off on: none
- Penalties: "Cannot inflict Elemental Ailments"
- PoB models it: yes

### Shackles of the Wretched (Gloves, level 16)
- Id: shackles-of-the-wretched
- Rule: After each Chill, Freeze, Ignite or Shock you are immune to it for 6 seconds, but your Curses are reflected back to you.
- Lines: "You cannot be Chilled for 6 seconds after being Chilled", "You cannot be Frozen for 6 seconds after being Frozen", "You cannot be Ignited for 6 seconds after being Ignited", "You cannot be Shocked for 6 seconds after being Shocked", "Curses you inflict are reflected back to you"
- Creates: none | Pays off on: curse
- Penalties: none
- PoB models it: no — a compile measures what it gives up, not what it adds

### Sine Aequo (Gloves, level 65)
- Id: sine-aequo
- Rule: Enemies are Immobilised at half the usual buildup.
- Lines: "Immobilise enemies at 50% buildup instead of 100%"
- Creates: freeze, pin, stun, electrocute | Pays off on: none
- Penalties: none
- PoB models it: yes

### Treefingers (Gloves, level 11)
- Id: treefingers
- Rule: You have Giant's Blood: you can wield Two-Handed Axes, Maces and Swords in one hand.
- Lines: "Giant's Blood"
- Creates: none | Pays off on: weapon-slot, offhand-slot
- Penalties: none
- PoB models it: yes

### Valako's Vice (Gloves, level 45)
- Id: valakos-vice
- Rule: All your Fire damage is converted to Lightning.
- Lines: "100% of Fire damage Converted to Lightning damage"
- Creates: damage-conversion | Pays off on: none
- Penalties: none
- PoB models it: yes

### Atsak's Sight (Helmet, level 28)
- Id: atsaks-sight
- Rule: Your Critical Hits Poison the enemy.
- Lines: "Critical Hits Poison the enemy"
- Creates: poison | Pays off on: crit
- Penalties: none
- PoB models it: yes

### Blood Price (Helmet, level 51)
- Id: blood-price
- Rule: Enemies in your Presence have at least 10% of their Life Reserved.
- Lines: "Enemies in your Presence have at least 10% of Life Reserved"
- Creates: none | Pays off on: none
- Penalties: none
- PoB models it: yes

### Corona of the Red Sun (Helmet, level 36)
- Id: corona-of-the-red-sun
- Rule: When you Leech Life from your Hits, allies in your Presence Leech as much.
- Lines: "Leeching Life from your Hits causes Allies in your Presence to also Leech the same amount of Life"
- Creates: none | Pays off on: leech
- Penalties: none
- PoB models it: no — a compile measures what it gives up, not what it adds

### Crown of Eyes (Helmet, level 45)
- Id: crown-of-eyes
- Rule: Your increases and reductions to Spell damage also apply to Attacks.
- Lines: "Increases and Reductions to Spell damage also apply to Attacks"
- Creates: none | Pays off on: none
- Penalties: none
- PoB models it: yes

### Crown of the Pale King (Helmet, level 16)
- Id: crown-of-the-pale-king
- Rule: Your Thorns can Retaliate against every Hit.
- Lines: "Thorns can Retaliate against all Hits"
- Creates: none | Pays off on: none
- Penalties: none
- PoB models it: no — a compile measures what it gives up, not what it adds

### Decree of Acuity (Helmet, level 65)
- Id: decree-of-acuity
- Rule: You are always Blind, but Blind's effect on you is reversed.
- Lines: "You are Blind", "The Effect of Blind on you is reversed"
- Creates: none | Pays off on: none
- Penalties: none
- PoB models it: yes

### Deidbell (Helmet, level 33)
- Id: deidbell
- Rule: Your Warcries explode Corpses.
- Lines: "Warcries Explode Corpses dealing 10% of their Life as Physical Damage"
- Creates: area | Pays off on: corpse
- Penalties: none
- PoB models it: yes

### Elevore (Helmet, level 33)
- Id: elevore
- Rule: The helmet adds Charm slots, and Charms gain a charge every second.
- Lines: "Charms gain 1 charge per Second", "+(1-2) Charm Slot"
- Creates: charm | Pays off on: none
- Penalties: none
- PoB models it: yes

### Ezomyte Peak (Helmet, level 12)
- Id: ezomyte-peak
- Rule: You have Unwavering Stance: you can't be Light Stunned, and you can't Dodge Roll or Sprint.
- Lines: "Unwavering Stance"
- Creates: none | Pays off on: none
- Penalties: none
- PoB models it: yes

### Glimpse of Chaos (Helmet, level 52)
- Id: glimpse-of-chaos
- Rule: The helmet can be modified while Corrupted.
- Lines: "Can be modified while Corrupted"
- Creates: item-modifiers | Pays off on: none
- Penalties: "Chaos Resistance is zero"
- PoB models it: no — a compile measures what it gives up, not what it adds

### Greymake (Helmet, level 5)
- Id: greymake
- Rule: The helmet has four Augment sockets, at the cost of Attributes per character level.
- Lines: "Has 4 Augment Sockets"
- Creates: socket | Pays off on: none
- Penalties: "-1 to all Attributes per Level"
- PoB models it: no — a compile measures what it gives up, not what it adds

### Heatshiver (Helmet, level 52)
- Id: heatshiver
- Rule: You gain Cold damage as extra Fire damage by the Chill magnitude on the enemy.
- Lines: "Gain 1% of Cold damage as Extra Fire damage per 1% Chill Magnitude on enemy"
- Creates: damage-conversion | Pays off on: chill
- Penalties: none
- PoB models it: yes

### Horns of Bynden (Helmet, level 1)
- Id: horns-of-bynden
- Rule: Each point of Rage also grants Armour.
- Lines: "Every Rage also grants 1% increased Armour"
- Creates: armour | Pays off on: rage
- Penalties: none
- PoB models it: yes

### Indigon (Helmet, level 65)
- Id: indigon
- Rule: Spells deal more damage, and skills cost more, by the Mana you spent recently, and only Regeneration can recover your Mana.
- Lines: "(10-15)% increased Spell damage for each 200 total Mana you have Spent Recently", "Mana Recovery other than Regeneration cannot Recover Mana"
- Creates: none | Pays off on: mana
- Penalties: "(5-10)% increased Cost of Skills for each 200 total Mana Spent Recently"
- PoB models it: partly — a compile measures only part of what it adds

### Ironride (Helmet, level 16)
- Id: ironride
- Rule: You have no Accuracy penalty at distance.
- Lines: "You have no Accuracy Penalty at Distance"
- Creates: none | Pays off on: none
- Penalties: none
- PoB models it: yes

### Keeper of the Arc (Helmet, level 62)
- Id: keeper-of-the-arc
- Rule: Every 5 seconds you alternate between taking 40% less damage from Hits and 40% less damage over time.
- Lines: "Alternating every 5 seconds:", "Take 40% less Damage from Hits", "Take 40% less Damage over time"
- Creates: none | Pays off on: none
- Penalties: none
- PoB models it: partly — a compile measures only part of what it adds

### Mask of the Sanguimancer (Helmet, level 10)
- Id: mask-of-the-sanguimancer
- Rule: You have Blood Magic: no Mana, and skills cost Life instead.
- Lines: "Blood Magic"
- Creates: none | Pays off on: life
- Penalties: none
- PoB models it: yes

### Mask of the Stitched Demon (Helmet, level 33)
- Id: mask-of-the-stitched-demon
- Rule: You can't have Energy Shield; instead your maximum Energy Shield regenerates Life.
- Lines: "Cannot have Energy Shield", "Regenerate 0.05 Life per second per Maximum Energy Shield"
- Creates: recovery | Pays off on: energy-shield
- Penalties: none
- PoB models it: yes

### Mind of the Council (Helmet, level 65)
- Id: mind-of-the-council
- Rule: Attacks cost part of your maximum Mana and gain Lightning damage from it.
- Lines: "Attacks cost an additional 6% of your maximum Mana", "Attacks have Added maximum Lightning Damage equal to (6-9)% of maximum Mana"
- Creates: none | Pays off on: mana
- Penalties: none
- PoB models it: yes

### Radiant Grief (Helmet, level 16)
- Id: radiant-grief
- Rule: Enemies in your Presence are Ignited as though you dealt them Fire damage.
- Lines: "Enemies in your Presence are Ignited as though dealt 200 Base Fire Damage"
- Creates: ignite | Pays off on: none
- Penalties: none
- PoB models it: no — a compile measures what it gives up, not what it adds

### Solus Ipse (Helmet, level 65)
- Id: solus-ipse
- Rule: You can socket two more copies of each Lineage Support Gem, in different skills.
- Lines: "You can Socket 2 additional copies of each Lineage Support Gem, in different Skills"
- Creates: none | Pays off on: none
- Penalties: "Equipment and Skill Gems have 25% increased Attribute Requirements"
- PoB models it: yes

### Starkonja's Head (Helmet, level 50)
- Id: starkonjas-head
- Rule: Your Companion takes part of the damage of Hits for you.
- Lines: "15% of Damage from Hits is taken from your Damageable Companion's Life before you"
- Creates: none | Pays off on: companion
- Penalties: none
- PoB models it: yes

### The Bringer of Rain (Helmet, level 52)
- Id: the-bringer-of-rain
- Rule: You can't use a Body Armour; the helmet takes its place, with four Augment sockets that grant Body Armour bonuses, and you can wield Two-Handed weapons in one hand.
- Lines: "Can't use Body Armour", "You can wield Two-Handed Axes, Maces and Swords in one hand", "This item gains bonuses from Socketed Items as though it was a Body Armour", "Has 4 Augment Sockets"
- Creates: socket | Pays off on: weapon-slot, offhand-slot
- Penalties: none
- PoB models it: partly — a compile measures only part of what it adds

### The Devouring Diadem (Helmet, level 10)
- Id: the-devouring-diadem
- Rule: Every 3 seconds you consume a nearby Corpse to recover 20% of your maximum Life.
- Lines: "Every 3 seconds, Consume a nearby Corpse to Recover 20% of maximum Life"
- Creates: recovery | Pays off on: corpse
- Penalties: none
- PoB models it: no — a compile measures what it gives up, not what it adds

### The Hollow Mask (Helmet, level 5)
- Id: the-hollow-mask
- Rule: Remnants you collect also affect allies in your Presence.
- Lines: "Remnants you create affect Allies in your Presence as well as you when collected"
- Creates: none | Pays off on: remnant
- Penalties: "-10% to all Elemental Resistances"
- PoB models it: no — a compile measures what it gives up, not what it adds

### The Smiling Knight (Helmet, level 26)
- Id: the-smiling-knight
- Rule: Your Critical Hits with Attacks Aggravate Bleeding.
- Lines: "Aggravate Bleeding on targets you Critically Hit with Attacks"
- Creates: none | Pays off on: bleed, crit
- Penalties: none
- PoB models it: no — a compile measures what it gives up, not what it adds

### The Three Dragons (Helmet, level 45)
- Id: the-three-dragons
- Rule: Each element builds another's ailment: Fire builds Shock, Cold builds Ignite and Lightning builds Freeze.
- Lines: "Fire Damage from Hits Contributes to Shock Chance instead of Flammability and Ignite Magnitudes", "Cold Damage from Hits Contributes to Flammability and Ignite Magnitudes instead of Chill Magnitude or Freeze Buildup", "Lightning Damage from Hits Contributes to Freeze Buildup instead of Shock Chance"
- Creates: shock, ignite, freeze | Pays off on: none
- Penalties: none
- PoB models it: yes

### The Vertex (Helmet, level 33)
- Id: the-vertex
- Rule: Skill Gems have no Attribute requirements (and, by variant, neither does equipment).
- Lines: "Skill Gems have no Attribute Requirements"
- Creates: none | Pays off on: none
- Penalties: none
- PoB models it: yes

### Vestige of Darkness (Helmet, level 65)
- Id: vestige-of-darkness
- Rule: Physical damage from your Hits builds Chill and Freeze.
- Lines: "Physical damage from Hits Contributes to Chill Magnitude and Freeze Buildup"
- Creates: chill, freeze | Pays off on: none
- Penalties: none
- PoB models it: yes

### Visage of Ayah (Helmet, level 16)
- Id: visage-of-ayah
- Rule: You have Eldritch Battery: your maximum Energy Shield becomes maximum Mana.
- Lines: "Eldritch Battery"
- Creates: mana | Pays off on: energy-shield
- Penalties: none
- PoB models it: yes

### Wings of Caelyn (Helmet, level 1)
- Id: wings-of-caelyn
- Rule: Each point of Rage also raises your Stun Threshold.
- Lines: "Every Rage also grants 1% increased Stun Threshold"
- Creates: none | Pays off on: rage
- Penalties: none
- PoB models it: yes

### Berek's Grip (Ring, level 42)
- Id: bereks-grip
- Rule: Wind skills that Elemental Ground can boost count as boosted by Shocked Ground.
- Lines: "Wind Skills which can be boosted by Elemental Ground Surfaces count", "as being boosted by Shocked Ground"
- Creates: shocked-ground | Pays off on: none
- Penalties: none
- PoB models it: no — a compile measures what it gives up, not what it adds

### Berek's Pass (Ring, level 42)
- Id: bereks-pass
- Rule: Wind skills that Elemental Ground can boost count as boosted by Chilled Ground.
- Lines: "Wind Skills which can be boosted by Elemental Ground Surfaces count", "as being boosted by Chilled Ground"
- Creates: chilled-ground | Pays off on: none
- Penalties: none
- PoB models it: no — a compile measures what it gives up, not what it adds

### Berek's Respite (Ring, level 42)
- Id: bereks-respite
- Rule: Wind skills that Elemental Ground can boost count as boosted by Ignited Ground.
- Lines: "Wind Skills which can be boosted by Elemental Ground Surfaces count", "as being boosted by Ignited Ground"
- Creates: ignited-ground | Pays off on: none
- Penalties: none
- PoB models it: no — a compile measures what it gives up, not what it adds

### Blackflame (Ring, level 20)
- Id: blackflame
- Rule: Your Ignites deal Chaos damage instead of Fire, and your Withered never expires on Ignited enemies and also raises their Fire damage taken.
- Lines: "Ignite you inflict deals Chaos Damage instead of Fire Damage", "Withered you inflict also increases Fire Damage taken", "Withered does not expire on Enemies Ignited by you"
- Creates: none | Pays off on: ignite
- Penalties: "(60-75)% reduced Ignite Duration on Enemies"
- PoB models it: partly — a compile measures only part of what it adds

### Blistering Bond (Ring, level 8)
- Id: blistering-bond
- Rule: Your Bleeding deals Fire damage and Fire damage builds Bleeding, while Bleeding on you deals Fire damage instead of Physical.
- Lines: "You take Fire Damage instead of Physical Damage from Bleeding", "Fire Damage also Contributes to Bleeding Magnitude", "Bleeding you inflict deals Fire Damage instead of Physical Damage"
- Creates: bleed | Pays off on: none
- Penalties: none
- PoB models it: partly — a compile measures only part of what it adds

### Bursting Decay (Ring, level 60)
- Id: bursting-decay
- Rule: The ring grants an extra skill slot, and Attacks gain Physical damage from your maximum Life, while you lose 5% of your Life per second.
- Lines: "Grants 1 additional Skill Slot", "Attacks have added Physical damage equal to 3% of maximum Life"
- Creates: none | Pays off on: life
- Penalties: "Lose 5% of maximum Life per second"
- PoB models it: yes

### Call of the Brotherhood (Ring, level 32)
- Id: call-of-the-brotherhood
- Rule: All your Lightning damage is converted to Cold.
- Lines: "100% of Lightning Damage Converted to Cold Damage"
- Creates: damage-conversion | Pays off on: none
- Penalties: none
- PoB models it: yes

### Cracklecreep (Ring, level 8)
- Id: cracklecreep
- Rule: Your Ignites spread to enemies that stay near the Ignited one.
- Lines: "Ignites you inflict spread to other Enemies that stay within 1.5 metres for 1 second"
- Creates: ignite | Pays off on: none
- Penalties: none
- PoB models it: no — a compile measures what it gives up, not what it adds

### Doedre's Damning (Ring, level 1)
- Id: doedres-damning
- Rule: You can apply one more Curse.
- Lines: "You can apply an additional Curse"
- Creates: curse | Pays off on: none
- Penalties: none
- PoB models it: yes

### Gifts from Above (Ring, level 35)
- Id: gifts-from-above
- Rule: You have Consecrated Ground around you while stationary.
- Lines: "You have Consecrated Ground around you while stationary"
- Creates: other-ground | Pays off on: stationary
- Penalties: none
- PoB models it: yes

### Glowswarm (Ring, level 1)
- Id: glowswarm
- Rule: Using a Mana Flask grants Guard equal to what it recovers.
- Lines: "Using a Mana Flask grants Guard equal to 100% of Flask's recovery amount for 4 seconds"
- Creates: none | Pays off on: flask
- Penalties: none
- PoB models it: no — a compile measures what it gives up, not what it adds

### Icefang Orbit (Ring, level 36)
- Id: icefang-orbit
- Rule: All damage from your Hits against Poisoned enemies builds Chill, and all Hit damage you take while Poisoned builds Chill on you.
- Lines: "All Damage taken from Hits while Poisoned Contributes to Magnitude of Chill on you", "All Damage from Hits against Poisoned targets Contributes to Chill Magnitude"
- Creates: chill | Pays off on: poison
- Penalties: "All Damage taken from Hits while Poisoned Contributes to Magnitude of Chill on you"
- PoB models it: partly — a compile measures only part of what it adds

### Kalandra's Touch (Ring, level 1)
- Id: kalandras-touch
- Rule: The ring copies the ring in your other ring slot.
- Lines: "Reflects opposite Ring"
- Creates: none | Pays off on: ring-slot
- Penalties: none
- PoB models it: no — a compile measures what it gives up, not what it adds

### Original Sin (Ring, level 20)
- Id: original-sin
- Rule: All your Elemental damage is converted to Chaos.
- Lines: "100% of Elemental Damage Converted to Chaos Damage"
- Creates: damage-conversion | Pays off on: none
- Penalties: none
- PoB models it: yes

### Polcirkeln (Ring, level 12)
- Id: polcirkeln
- Rule: Enemies Chilled by your Hits can be Shattered as though Frozen.
- Lines: "Enemies Chilled by your Hits can be Shattered as though Frozen"
- Creates: none | Pays off on: chill
- Penalties: none
- PoB models it: no — a compile measures what it gives up, not what it adds

### Prized Pain (Ring, level 48)
- Id: prized-pain
- Rule: Your Melee Attack Hits can deal your Thorns damage.
- Lines: "(15-25)% chance to deal your Thorns Damage to Enemies you Hit with Melee Attacks"
- Creates: none | Pays off on: none
- Penalties: "Skills Gain 10% of Mana Cost as Extra Life Cost"
- PoB models it: no — a compile measures what it gives up, not what it adds

### Snakepit (Ring, level 32)
- Id: snakepit
- Rule: By ring slot, your Spell Projectiles Fork (left) or Chain one more time (right), and they can't Pierce.
- Lines: "Left ring slot: Projectiles from Spells cannot Chain", "Left ring slot: Projectiles from Spells Fork", "Right ring slot: Projectiles from Spells Chain +1 times", "Right ring slot: Projectiles from Spells cannot Fork", "Projectiles from Spells cannot Pierce"
- Creates: projectile | Pays off on: ring-slot
- Penalties: none
- PoB models it: yes

### The Burrower (Ring, level 16)
- Id: the-burrower
- Rule: Enemies' Lightning Hit damage against you is Unlucky.
- Lines: "Lightning Damage of Enemies Hitting you is Unlucky"
- Creates: none | Pays off on: none
- Penalties: none
- PoB models it: no — a compile measures what it gives up, not what it adds

### The Taming (Ring, level 42)
- Id: the-taming
- Rule: Wind skills that Elemental Ground can boost count as boosted by Ignited, Shocked and Chilled Ground at once.
- Lines: "Wind Skills which can be boosted by Elemental Ground Surfaces can be boosted by multiple Elemental Ground Surfaces", "Wind Skills which can be boosted by Elemental Ground Surfaces count", "as being boosted by Ignited, Shocked, and Chilled Ground"
- Creates: ignited-ground, shocked-ground, chilled-ground | Pays off on: none
- Penalties: none
- PoB models it: no — a compile measures what it gives up, not what it adds

### Veilpiercer (Ring, level 20)
- Id: veilpiercer
- Rule: Your Curses affect Hexproof enemies and spread when a Cursed enemy dies.
- Lines: "Curses you inflict can affect Hexproof Enemies", "Curses you inflict spread to enemies within 3 metres when Cursed enemy dies"
- Creates: curse | Pays off on: none
- Penalties: none
- PoB models it: partly — a compile measures only part of what it adds

### Venopuncture (Ring, level 36)
- Id: venopuncture
- Rule: All damage from your Hits against Bleeding enemies builds Chill, and all Hit damage you take while Bleeding builds Chill on you.
- Lines: "All Damage taken from Hits while Bleeding Contributes to Magnitude of Chill on you", "All Damage from Hits against Bleeding targets Contributes to Chill Magnitude"
- Creates: chill | Pays off on: bleed
- Penalties: "All Damage taken from Hits while Bleeding Contributes to Magnitude of Chill on you"
- PoB models it: partly — a compile measures only part of what it adds

### Vigilant View (Ring, level 26)
- Id: vigilant-view
- Rule: Enemies lose Accuracy against you with distance, but your maximum chance to Evade is 50%.
- Lines: "Enemies have an Accuracy Penalty against you based on Distance", "Maximum Chance to Evade is 50%"
- Creates: none | Pays off on: evasion
- Penalties: none
- PoB models it: yes

### Whisper of the Brotherhood (Ring, level 32)
- Id: whisper-of-the-brotherhood
- Rule: All your Cold damage is converted to Lightning.
- Lines: "100% of Cold Damage Converted to Lightning Damage"
- Creates: damage-conversion | Pays off on: none
- Penalties: none
- PoB models it: yes

### Alkem Eira (Shield, level 1)
- Id: alkem-eira
- Rule: Damage you Block is Recouped as Mana.
- Lines: "Damage Blocked is Recouped as Mana"
- Creates: mana | Pays off on: block
- Penalties: none
- PoB models it: no — a compile measures what it gives up, not what it adds

### Bloodbarrier (Shield, level 16)
- Id: bloodbarrier
- Rule: Blocking inflicts Corrupted Blood that deals half your maximum Life as Physical damage per second.
- Lines: "Inflict Corrupted Blood for 5 seconds on Block, dealing 50% of your maximum Life as Physical damage per second"
- Creates: none | Pays off on: block, life
- Penalties: none
- PoB models it: yes

### Calgyra's Arc (Shield, level 65)
- Id: calgyras-arc
- Rule: Your Parry has infinite range.
- Lines: "Infinite Parry Range"
- Creates: none | Pays off on: none
- Penalties: none
- PoB models it: no — a compile measures what it gives up, not what it adds

### Chernobog's Pillar (Shield, level 65)
- Id: chernobogs-pillar
- Rule: You gain damage as extra Fire damage by your chance to Block.
- Lines: "Gain 1% of damage as Fire damage per 1% Chance to Block"
- Creates: damage-conversion | Pays off on: block
- Penalties: none
- PoB models it: yes

### Doomgate (Shield, level 12)
- Id: doomgate
- Rule: Enemies whose Hits you Block are Culled, but you take part of the damage of Blocked Hits.
- Lines: "Enemies are Culled on Block"
- Creates: none | Pays off on: block
- Penalties: "You take (25-40)% of damage from Blocked Hits"
- PoB models it: no — a compile measures what it gives up, not what it adds

### Feathered Fortress (Shield, level 26)
- Id: feathered-fortress
- Rule: Raising the shield doesn't slow your movement.
- Lines: "No Movement Speed Penalty while Shield is Raised"
- Creates: none | Pays off on: block
- Penalties: none
- PoB models it: yes

### Kaltenhalt (Shield, level 22)
- Id: kaltenhalt
- Rule: Parry's Physical damage becomes Cold, and Stun buildup modifiers raise its Freeze buildup instead.
- Lines: "Modifiers to Stun Buildup apply to Freeze Buildup instead for Parry", "100% of Parry Physical Damage Converted to Cold Damage"
- Creates: freeze, damage-conversion | Pays off on: stun
- Penalties: none
- PoB models it: yes

### Lycosidae (Shield, level 28)
- Id: lycosidae
- Rule: Blocking damage Poisons the attacker.
- Lines: "Blocking Damage Poisons the Enemy as though dealing 200 Base Chaos Damage"
- Creates: poison | Pays off on: block
- Penalties: none
- PoB models it: no — a compile measures what it gives up, not what it adds

### Merit of Service (Shield, level 8)
- Id: merit-of-service
- Rule: Allies in your Presence have your chance to Block.
- Lines: "Allies in your Presence have Block Chance equal to yours"
- Creates: none | Pays off on: block
- Penalties: none
- PoB models it: no — a compile measures what it gives up, not what it adds

### Nocturne (Shield, level 5)
- Id: nocturne
- Rule: Parried enemies take more Spell damage instead of more Attack damage.
- Lines: "Parried enemies take more Spell Damage instead of more Attack Damage"
- Creates: none | Pays off on: none
- Penalties: none
- PoB models it: no — a compile measures what it gives up, not what it adds

### Prism Guardian (Shield, level 33)
- Id: prism-guardian
- Rule: Buff skills reserve Spirit more efficiently by your maximum Life.
- Lines: "1% increased Spirit Reservation Efficiency of Buff Skills per 100 Maximum Life"
- Creates: spirit | Pays off on: life
- Penalties: none
- PoB models it: yes

### Redblade Banner (Shield, level 33)
- Id: redblade-banner
- Rule: Enemies in your Presence count as having double Power.
- Lines: "Enemies in your Presence count as having double Power"
- Creates: none | Pays off on: none
- Penalties: none
- PoB models it: no — a compile measures what it gives up, not what it adds

### Rondel de Ezo (Shield, level 11)
- Id: rondel-de-ezo
- Rule: Blocking Curses the enemy with Enfeeble.
- Lines: "Curse Enemies with Enfeeble on Block"
- Creates: curse | Pays off on: block
- Penalties: none
- PoB models it: yes

### Saffell's Frame (Shield, level 16)
- Id: saffells-frame
- Rule: You can't Block; modifiers to maximum Block chance raise your maximum Resistances instead.
- Lines: "Cannot Block", "Modifiers to Maximum Block Chance instead apply to Maximum Resistances"
- Creates: resistance | Pays off on: block
- Penalties: none
- PoB models it: yes

### Svalinn (Shield, level 60)
- Id: svalinn
- Rule: Your chance to Block is Lucky, though Blocked Hits still deal part of their damage.
- Lines: "Chance to Block Damage is Lucky"
- Creates: none | Pays off on: block
- Penalties: "You take (0-20)% of damage from Blocked Hits"
- PoB models it: yes

### Window to Paradise (Shield, level 16)
- Id: window-to-paradise
- Rule: While the shield is raised, enemies in front of you take Elemental Exposure.
- Lines: "Inflict Elemental Exposure to Enemies 3 metres in front of you", "for 4 seconds, every 0.25 seconds while raised"
- Creates: exposure | Pays off on: block
- Penalties: none
- PoB models it: no — a compile measures what it gives up, not what it adds

### Carrion Call (Focus, level 16)
- Id: carrion-call
- Rule: Your Minions' Resistances equal yours.
- Lines: "Minions' Resistances are equal to yours"
- Creates: none | Pays off on: resistance
- Penalties: none
- PoB models it: yes

### Deathrattle (Focus, level 1)
- Id: deathrattle
- Rule: Killing an enemy can start your Energy Shield recharge.
- Lines: "20% chance for Energy Shield Recharge to start when you Kill an Enemy"
- Creates: energy-shield | Pays off on: on-kill
- Penalties: none
- PoB models it: no — a compile measures what it gives up, not what it adds

### Rathpith Globe (Focus, level 75)
- Id: rathpith-globe
- Rule: Non-Channelling Spells cost 6% of your maximum Life and gain damage and Critical Hit chance from it.
- Lines: "Non-Channelling Spells cost an additional 6% of your maximum Life", "Non-Channelling Spells have 3% increased Critical Hit Chance per 100 maximum Life", "Non-Channelling Spells deal 6% increased Damage per 100 maximum Life"
- Creates: none | Pays off on: life
- Penalties: none
- PoB models it: yes

### Serpent's Lesson (Focus, level 22)
- Id: serpents-lesson
- Rule: You count as on Low Life at 35% of your maximum Mana or below, and on Low Mana at 35% of your maximum Life or below.
- Lines: "You count as on Low Life while at 35% of maximum Mana or below", "You count as on Low Mana while at 35% of maximum Life or below"
- Creates: low-life | Pays off on: mana
- Penalties: none
- PoB models it: yes

### Threaded Light (Focus, level 6)
- Id: threaded-light
- Rule: Your Spell damage grows with your Spirit.
- Lines: "(8-12)% increased Spell Damage per 10 Spirit"
- Creates: none | Pays off on: spirit
- Penalties: none
- PoB models it: yes

### Asphyxia's Wrath (Quiver, level 1)
- Id: asphyxias-wrath
- Rule: Enemies Chilled by your Hits take more damage by the Chill's magnitude.
- Lines: "Enemies Chilled by your Hits increase damage taken by Chill Magnitude"
- Creates: none | Pays off on: chill
- Penalties: none
- PoB models it: yes

### Beyond Reach (Quiver, level 64)
- Id: beyond-reach
- Rule: Chaos damage from your Hits also builds Freeze and Electrocution.
- Lines: "Chaos Damage from Hits also Contributes to Freeze Buildup", "Chaos Damage from Hits also Contributes to Electrocute Buildup"
- Creates: freeze, electrocute | Pays off on: none
- Penalties: none
- PoB models it: yes

### Blackgleam (Quiver, level 8)
- Id: blackgleam
- Rule: Your Projectiles Pierce every Ignited enemy.
- Lines: "Projectiles Pierce all Ignited enemies"
- Creates: projectile | Pays off on: ignite
- Penalties: none
- PoB models it: no — a compile measures what it gives up, not what it adds

### Cadiro's Gambit (Quiver, level 66)
- Id: cadiros-gambit
- Rule: Every Arrow you fire is a random special Arrow: Crescendo, Splinter, Reversing, Diamond, Covetous or Blunt.
- Lines: "Each Arrow fired is a Crescendo, Splinter, Reversing, Diamond, Covetous, or Blunt Arrow"
- Creates: projectile | Pays off on: none
- Penalties: none
- PoB models it: no — a compile measures what it gives up, not what it adds

### Drillneck (Quiver, level 55)
- Id: drillneck
- Rule: Attack Projectiles Return after Piercing enough times, and gain damage and Critical Hit chance per Pierce.
- Lines: "Attack Projectiles Return if they Pierced at least (2-4) times", "Projectiles deal (42-64)% increased Damage with Hits for each time they have Pierced", "Projectiles have (42-64)% increased Critical Hit chance for each time they have Pierced"
- Creates: projectile | Pays off on: projectile
- Penalties: none
- PoB models it: no — a compile measures what it gives up, not what it adds

### Murkshaft (Quiver, level 39)
- Id: murkshaft
- Rule: Poisoning a target Blinds it.
- Lines: "Blind Targets when you Poison them"
- Creates: blind | Pays off on: poison
- Penalties: none
- PoB models it: no — a compile measures what it gives up, not what it adds

### The Lethal Draw (Quiver, level 16)
- Id: the-lethal-draw
- Rule: Bow Attacks spend Life Flask charges to deal added Physical damage from the Flask's recovery.
- Lines: "Bow Attacks consume 10% of your maximum Life Flask Charges if possible to deal added Physical damage equal to (5-10)% of Flask's Life Recovery amount"
- Creates: none | Pays off on: flask
- Penalties: none
- PoB models it: yes

### Against the Darkness (Jewel, level 1)
- Id: against-the-darkness
- Rule: Allocated small passives in the jewel's radius grant nothing; instead small and notable passives there also grant the jewel's chosen bonuses.
- Lines: "Notable Passive Skills in Radius also grant Allocated Small Passive Skills in Radius grant nothing"
- Creates: none | Pays off on: none
- Penalties: none
- PoB models it: yes

### Controlled Metamorphosis (Jewel, level 1)
- Id: controlled-metamorphosis
- Rule: Passives in the jewel's radius can be allocated without connecting them to your tree.
- Lines: "Passives in Radius can be Allocated without being connected to your tree"
- Creates: none | Pays off on: none
- Penalties: "-(20-5)% to all Elemental Resistances"
- PoB models it: yes

### Flesh Crucible (Jewel, level 1)
- Id: flesh-crucible
- Rule: The jewel grants a keystone, chosen by variant, for less defences.
- Lines: "Mind Over Matter"
- Creates: none | Pays off on: none
- Penalties: "(10-20)% less Armour, Evasion and Energy Shield"
- PoB models it: yes

### From Nothing (Jewel, level 1)
- Id: from-nothing
- Rule: Passives in the radius of a keystone, chosen by variant, can be allocated without connecting them to your tree.
- Lines: "Passives in radius of Ancestral Bond can be Allocated without being connected to your tree", "Passives in radius of Avatar of Fire can be Allocated without being connected to your tree", "Passives in radius of Blackflame Covenant can be Allocated without being connected to your tree"
- Creates: none | Pays off on: none
- Penalties: none
- PoB models it: yes

### Heroic Tragedy (Jewel, level 1)
- Id: heroic-tragedy
- Rule: Passives in the jewel's radius are Conquered by the Kalguur, which transforms them.
- Lines: "Remembrancing (100-8000) songworthy deeds by the line of Olroth", "Passives in radius are Conquered by the Kalguur"
- Creates: none | Pays off on: none
- Penalties: none
- PoB models it: partly — a compile measures only part of what it adds

### Megalomaniac (Jewel, level 1)
- Id: megalomaniac
- Rule: The jewel allocates notable passives, chosen by variant, without points or a path to them.
- Lines: "Allocates Abasement"
- Creates: none | Pays off on: none
- Penalties: none
- PoB models it: yes

### Split Personality (Jewel, level 1)
- Id: split-personality
- Rule: You can allocate passives from another class's starting point, chosen by variant.
- Lines: "Can Allocate Passive Skills from the Warrior's starting point"
- Creates: none | Pays off on: none
- Penalties: none
- PoB models it: yes

### Undying Hate (Jewel, level 1)
- Id: undying-hate
- Rule: Passives in the jewel's radius are Conquered by the Abyssals, which transforms them.
- Lines: "Glorifying the defilement of (100-8000) souls in tribute to Ulaman", "Passives in radius are Conquered by the Abyssals"
- Creates: none | Pays off on: none
- Penalties: none
- PoB models it: partly — a compile measures only part of what it adds

### Voices (Jewel, level 1)
- Id: voices
- Rule: The jewel allocates Sinister Jewel sockets (two to four, by variant).
- Lines: "Allocates 4 Sinister Jewel sockets"
- Creates: socket | Pays off on: none
- Penalties: none
- PoB models it: yes

### Arakaali's Gift (Charm, level 24)
- Id: arakaalis-gift
- Rule: Using the Charm recovers Life from your Mana Flask's recovery and Mana from your Life Flask's.
- Lines: "Recover Life equal to (15-20)% of Mana Flask's Recovery Amount when used", "Recover Mana equal to (15-20)% of Life Flask's Recovery Amount when used"
- Creates: recovery | Pays off on: flask
- Penalties: none
- PoB models it: no — a compile measures what it gives up, not what it adds

### Beira's Anguish (Charm, level 32)
- Id: beiras-anguish
- Rule: Using the Charm creates Ignited Ground that Ignites from five times your maximum Life.
- Lines: "Creates Ignited Ground for 4 seconds when used, Igniting enemies as though dealing Fire damage equal to 500% of your maximum Life"
- Creates: ignited-ground, ignite | Pays off on: life, charm
- Penalties: none
- PoB models it: no — a compile measures what it gives up, not what it adds

### Nascent Hope (Charm, level 12)
- Id: nascent-hope
- Rule: Using the Charm starts your Energy Shield recharge.
- Lines: "Energy Shield Recharge starts on use"
- Creates: energy-shield | Pays off on: charm
- Penalties: none
- PoB models it: no — a compile measures what it gives up, not what it adds

### Sanguis Heroum (Charm, level 18)
- Id: sanguis-heroum
- Rule: Using the Charm creates Consecrated Ground.
- Lines: "Creates Consecrated Ground on use"
- Creates: other-ground | Pays off on: charm
- Penalties: none
- PoB models it: no — a compile measures what it gives up, not what it adds

### Blood of the Warrior (Flask, level 40)
- Id: blood-of-the-warrior
- Rule: The Flask's effect continues at full Life, and during it Rage doesn't decay and builds when you are Hit.
- Lines: "Effect is not removed when Unreserved Life is Filled", "Gain (3-5) Rage when Hit by an Enemy during effect", "No Inherent loss of Rage during effect"
- Creates: rage | Pays off on: flask
- Penalties: "90% less Life Recovered"
- PoB models it: no — a compile measures what it gives up, not what it adds

### Lavianga's Spirits (Flask, level 49)
- Id: laviangas-spirits
- Rule: The Flask can't be used; instead its effect applies constantly.
- Lines: "This Flask cannot be Used but applies its Effect constantly"
- Creates: recovery | Pays off on: flask
- Penalties: "(70-80)% reduced Amount Recovered"
- PoB models it: no — a compile measures what it gives up, not what it adds

### Melting Maelstrom (Flask, level 60)
- Id: melting-maelstrom
- Rule: During the Flask's effect, which continues at full Mana, the Mana you spend is dealt as Chaos damage around you every 3 seconds.
- Lines: "Effect is not removed when Unreserved Mana is Filled", "Every 3 seconds during Effect, deal 100% of Mana spent in those seconds as Chaos Damage to Enemies within 3 metres"
- Creates: area | Pays off on: mana
- Penalties: "Deals 25% of current Mana as Chaos Damage to you when Effect ends"
- PoB models it: partly — a compile measures only part of what it adds

### Olroth's Resolve (Flask, level 60)
- Id: olroths-resolve
- Rule: Life recovery beyond your maximum becomes Guard for 20 seconds.
- Lines: "Excess Life Recovery added as Guard for 20 seconds"
- Creates: none | Pays off on: recovery
- Penalties: none
- PoB models it: no — a compile measures what it gives up, not what it adds

### Opportunity (Flask, level 60)
- Id: opportunity
- Rule: The Flask can't be used manually; it is used when you release a skill with Perfect Timing, and its effect continues at full Life.
- Lines: "Effect is not removed when Unreserved Life is Filled", "Cannot be Used manually", "Used when you release a skill with Perfect Timing"
- Creates: none | Pays off on: flask
- Penalties: none
- PoB models it: no — a compile measures what it gives up, not what it adds

### Uhtred's Chalice (Flask, level 50)
- Id: uhtreds-chalice
- Rule: During the Flask's effect, Mana recovery from Flasks can exceed your maximum Mana, but you lose Life without Runic Ward.
- Lines: "Mana Recovery from Flasks can Overflow maximum Mana during Effect"
- Creates: mana | Pays off on: flask, ward
- Penalties: "Lose 5% Life per second while you have no Runic Ward during Effect"
- PoB models it: no — a compile measures what it gives up, not what it adds
