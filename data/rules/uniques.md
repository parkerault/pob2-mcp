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
