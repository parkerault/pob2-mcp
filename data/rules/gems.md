# Gems: the rule changers

The rule-changer index's gem file (amendment 8, D-401), written from the pinned Path of Building 2 (v0.23.1) game
text. One block per gem whose text changes how a standard mechanic works, among the gems whose text holds a
rule-change phrase (`rules-index.mjs candidates`); gems PoB marks legacy are left out. Grep it by mechanic or
family; never read it whole.

A block: the heading names the gem, its kind (support, skill, spirit or meta gem) and its tier (0 where PoB's
data gives none, as for Lineage supports and skills a passive or an item grants); `Rule` says the
rule it changes; `Lines` quotes the lines that change it; `Creates` and `Pays off on` use `vocabulary.md`'s
families; `Penalties` quotes its explicit penalty lines; `PoB models it` comes from `check_model_coverage` on the
gem as a whole (`yes` every line it checks fully parsed and no flag, `no` none fully parsed or no line to check,
`partly` between).

### Abyssal Apparition (skill gem, tier 0)
- Id: abyssal-apparition
- Rule: Casting a damaging Spell consumes a Power Charge to trigger an Abyssal Apparition that casts the same Spell for you.
- Lines: "Consume a Power Charge when you cast a damaging Spell to trigger an Abyssal Apparition who will also cast that same Spell for you. Does not work with Channelling Spells, Spells with a Cooldown, Triggered Spells, Spells granted by items, or Spells which already consume a Power Charge. This Skill is not directly Supportable."
- Creates: none | Pays off on: power-charge
- Penalties: "Spells cast by Apparition deal 50% less Damage"
- PoB models it: no

### Adhesive Grenades I (support gem, tier 2)
- Id: adhesive-grenades-i
- Rule: Supported Grenades don't bounce; they stop where they first land, for lower damage.
- Lines: "Supports Grenade Skills. Grenades from Supported Skills do not bounce, instead halting movement where they intially land, but doing lower damage when they detonate."
- Creates: none | Pays off on: none
- Penalties: "Supported Grenade Skills deal 10% less Damage"
- PoB models it: partly

### Adhesive Grenades II (support gem, tier 3)
- Id: adhesive-grenades-ii
- Rule: Supported Grenades don't bounce; they stop where they first land.
- Lines: "Supports Grenade Skills. Grenades from Supported Skills do not bounce, instead halting movement where they intially land."
- Creates: none | Pays off on: none
- Penalties: none
- PoB models it: no

### Ahn's Citadel (support gem, tier 0)
- Id: ahns-citadel
- Rule: Supported wall skills create their walls along a Fissure instead of a line.
- Lines: "Walls from Supported Skills are created along a Fissure instead"
- Creates: none | Pays off on: none
- Penalties: none
- PoB models it: no

### Artillery Ballista (skill gem, tier 7)
- Id: artillery-ballista
- Rule: Modifiers to the number of Projectiles add Hits per salvo instead.
- Lines: "Hits 4 times per salvo Modifiers to number of Projectiles fired instead apply to number of Hits per salvo"
- Creates: none | Pays off on: projectile
- Penalties: none
- PoB models it: partly

### Astral Projection (support gem, tier 3)
- Id: astral-projection
- Rule: Supported Nova skills happen at the targeted location instead of around you.
- Lines: "Supported Skills Cast at the targeted location instead of around you"
- Creates: none | Pays off on: none
- Penalties: "Supported Skills have 25% less Area of Effect"
- PoB models it: yes

### Atalui's Bloodletting (support gem, tier 0)
- Id: ataluis-bloodletting
- Rule: Supported skills pay part of their Mana cost in Life and gain part of that Life cost as extra Physical damage.
- Lines: "Supports any Skill, turning a portion of its Mana cost into a Life cost. Does not support Skills which reserve Spirit. Supported Skills Gain a portion of their Life cost as extra Physical Damage."
- Creates: damage-conversion | Pays off on: life
- Penalties: none
- PoB models it: yes

### Atziri's Communion (support gem, tier 0)
- Id: atziris-communion
- Rule: Supported Persistent skills reserve Life instead of Spirit.
- Lines: "Supports Persistent Skills, making them Reserve Life instead of Spirit. Cannot Support Skills which create Minions."
- Creates: none | Pays off on: life
- Penalties: none
- PoB models it: yes

### Battershout (support gem, tier 1)
- Id: battershout
- Rule: Supported Warcries consume Fully Broken Armour to set off Physical explosions, but can't Break Armour themselves.
- Lines: "Supports Warcry Skills. Supported Skills Consume Fully Broken Armour to trigger Physical Damage explosions on Enemies within their range but cannot themselves Break Armour. "
- Creates: area | Pays off on: armour-break
- Penalties: "Supported Skills cannot Break Armour"
- PoB models it: partly

### Black Powder Blitz (spirit gem, tier 0)
- Id: black-powder-blitz
- Rule: Replaces your Dodge Roll with an explosive leap that Blinds and Ignites enemies where you left.
- Lines: "Replaces your dodge roll with an explosive-assisted leap, firing off a round from your prosthetic cannon leg that Blinds and Ignites enemies in the area you escape from. The explosion will cause any Grenades in its area of effect to also explode.", "Always Ignites"
- Creates: ignite, blind | Pays off on: on-dodge
- Penalties: none
- PoB models it: partly

### Breachlord's Amalgam (support gem, tier 0)
- Id: breachlords-amalgam
- Rule: Supported Projectile skills gain a cooldown, and their Projectiles Return, Piercing on the way.
- Lines: "Supports Lightning or Cold skills you use yourself which fire Projectiles and do not already have cooldowns, adding a cooldown and making the Projectiles return, piercing through targets as they do so."
- Creates: projectile | Pays off on: none
- Penalties: none
- PoB models it: partly

### Burning Inscription (support gem, tier 4)
- Id: burning-inscription
- Rule: Runic Inscriptions trigger Burning Inscription when they expire, creating Ignited Ground from your maximum Mana.
- Lines: "Supports any Skill which creates Runic Inscriptions when Cast, causing those Runic Inscriptions to trigger Burning Inscription when they expire. Burning Inscription is a Spell which creates Ignited Ground based off of your Maximum Mana.", "Create Ignited Ground, Igniting enemies as though dealing Fire Damage equal to 20% of your Maximum Mana"
- Creates: ignited-ground | Pays off on: mana
- Penalties: none
- PoB models it: partly

### Cackling Companions (spirit gem, tier 0)
- Id: cackling-companions
- Rule: The cackle of Hyenas counts as one Companion for effects that count or limit Companions.
- Lines: "Activate to summon a cackle of Hyena Companions. The cackle is treated as a single Companion for effects that count or limit Companions, regardless of the number of Hyenas in the cackle. Hyenas whoop when they first appear, Hindering nearby enemies, and have a chance to Maim enemies they Hit."
- Creates: companion, minion-count | Pays off on: none
- Penalties: none
- PoB models it: yes

### Catha's Brilliance (support gem, tier 0)
- Id: cathas-brilliance
- Rule: Supported Companions Ignite and Blind nearby enemies, the Ignite based on the Companion's Life.
- Lines: "Supports skills which create Companions, causing enemies near them to be Blinded and Ignited. The damage of the Ignite is based on the Life of the supported Minion.", "Minions from Supported Skills Ignite Enemies within a radius of 2 metres as though dealing Base Fire Damage equal to 10% of Minion's Maximum Life"
- Creates: ignite, blind | Pays off on: companion
- Penalties: none
- PoB models it: no

### Catharsis (support gem, tier 2)
- Id: catharsis
- Rule: The supported skill detonates the Volatility on you, and can be used only while you have enough of it.
- Lines: "Supports any Skill you use yourself, causing supported Skill to detonate Volatility that is present on you. Supported Skill can only be used while you have a certain amount of Volatility and cannot support Skills which already have another Condition."
- Creates: none | Pays off on: volatility
- Penalties: none
- PoB models it: no

### Chaotic Freeze (support gem, tier 3)
- Id: chaotic-freeze
- Rule: Enemies taking damage over time from the supported Spells' Debuffs build Freeze from Chaos damage Hits of any source.
- Lines: "Supports Spells that deal non-Ailment Chaos damage over time. Enemies taking damage over time from Debuffs caused by supported skills will suffer Freeze build up from Chaos damage Hits from any source. Does not Support Skills used by Minions."
- Creates: freeze | Pays off on: none
- Penalties: none
- PoB models it: yes

### Cirel's Cultivation (support gem, tier 0)
- Id: cirels-cultivation
- Rule: You can have only one of the supported Totem, which grows stronger with each allied Totem near it.
- Lines: "Supports Skills which create Totems, preventing you from having more than one of that Totem but granting significant benefits for Supported Totems based how many allied Totems are near them. Does not Support Skills used by Minions.", "Supported Skills can only have one active Totem"
- Creates: none | Pays off on: totem
- Penalties: "Supported Skills can only have one active Totem"
- PoB models it: no

### Combat Frenzy (spirit gem, tier 8)
- Id: combat-frenzy
- Rule: Freezing, Electrocuting or Pinning an enemy grants a Frenzy Charge, at most once every few seconds.
- Lines: "While active, grants you a Frenzy Charge when you Freeze, Electrocute or Pin an enemy. This can only occur once every few seconds."
- Creates: frenzy-charge | Pays off on: freeze, electrocute, pin
- Penalties: none
- PoB models it: partly

### Creeping Chill (support gem, tier 1)
- Id: creeping-chill
- Rule: Ice Crystals from the supported skill consume a Power Charge to create Chilled Ground, which Chills from the Crystal's Life.
- Lines: "Supports any Skill that creates Ice Crystals, causing that Skill to Consume a Power Charge if possible to create Chilled Ground around the Crystal.", "Created Chilled Ground Chills as though dealing damage equal to 100% of the Ice Crystal's maximum Life"
- Creates: chilled-ground | Pays off on: power-charge
- Penalties: none
- PoB models it: partly

### Crystalline Shards (support gem, tier 1)
- Id: crystalline-shards
- Rule: Explosions of Ice Crystals from the supported skill Impale, with Cold damage counted as Physical.
- Lines: "Supports Skills which create Ice Crystals. Damaging Explosions caused by Ice Crystals from Supported Skills will Impale Enemies.", "Ice Crystals created by Supported Skills can Impale with Cold Damage as though it was Physical"
- Creates: none | Pays off on: none
- Penalties: "Supported Skills cannot Extract Impale"
- PoB models it: no

### Delayed Reaction (support gem, tier 4)
- Id: delayed-reaction
- Rule: Supported Hazards can trigger only when created or when they expire, with a much shorter duration and more damage.
- Lines: "Supports Skills which create Hazards, causing those Hazards to only be able to trigger immediately after creation or at the end of their duration. Created Hazards have significantly lowered duration, and deal more damage."
- Creates: none | Pays off on: none
- Penalties: "Hazards created by Supported Skills have 70% less duration"
- PoB models it: partly

### Einhar's Beastrite (support gem, tier 0)
- Id: einhars-beastrite
- Rule: Supported Strikes steal a modifier from each Rare monster they kill, but can damage only enemies on Low Life.
- Lines: "Supports Melee Strike skills, causing them to steal a Modifier from Rare monsters they kill for a lengthy duration, while being unable to damage enemies not on low Life. Does not modify skills used by Minions."
- Creates: none | Pays off on: on-kill
- Penalties: "Supported Skills can only Damage Low Life Enemies"
- PoB models it: no

### Elemental Discharge (support gem, tier 3)
- Id: elemental-discharge
- Rule: Supported Spells consume Elemental Ailments on Hit to trigger a Discharge of the matching Elements.
- Lines: "Supports any Spell that Hits enemies, causing it to Consume Elemental Ailments on hit to trigger an Elemental Discharge. Cannot support the skills of Minions or skills which already Consume Elemental Ailments.", "Only deals Damage of Elements matching Consumed Ailments Deals no Damage of other Damage Types"
- Creates: none | Pays off on: ignite, chill, freeze, shock, electrocute
- Penalties: "Supported Skills Cannot inflict Freeze, Shock or Ignite"
- PoB models it: partly

### Embitter (support gem, tier 2)
- Id: embitter
- Rule: Any extra damage the supported skills would gain as another type is gained as extra Cold damage instead.
- Lines: "If Supported Skills would gain extra Damage of any Type other than Cold, they gain extra Cold Damage instead"
- Creates: damage-conversion | Pays off on: none
- Penalties: none
- PoB models it: yes

### Enraged Warcry I (support gem, tier 4)
- Id: enraged-warcry-i
- Rule: Supported Warcries spend Rage instead of an Endurance Charge to bypass their cooldown.
- Lines: "Supported Warcries spend 20 Rage to bypass their Cooldown, instead of an Endurance Charge"
- Creates: none | Pays off on: rage, cooldown
- Penalties: none
- PoB models it: no

### Enraged Warcry II (support gem, tier 5)
- Id: enraged-warcry-ii
- Rule: Supported Warcries spend Rage instead of an Endurance Charge to bypass their cooldown.
- Lines: "Supported Warcries spend 15 Rage to bypass their Cooldown, instead of an Endurance Charge"
- Creates: none | Pays off on: rage, cooldown
- Penalties: none
- PoB models it: no

### Esh's Prowess (support gem, tier 0)
- Id: eshs-prowess
- Rule: Supported Lightning skills roll only the minimum or the maximum of their Lightning damage.
- Lines: "Supported Skills only roll the minimum or maximum Damage value for Lightning Damage"
- Creates: luck | Pays off on: none
- Penalties: none
- PoB models it: partly

### Extraction (support gem, tier 3)
- Id: extraction
- Rule: Supported Spells sacrifice part of your Life when used, for extra Chaos damage.
- Lines: "Supports Spell Skills which cause Damaging Hits. Using supported Spells will cause you to Sacrifice a portion of your Life on use, gaining extra Chaos Damage in exchange. Does not support Persistent Skills, Minion Skills, or Triggered Skills."
- Creates: damage-conversion | Pays off on: life
- Penalties: none
- PoB models it: partly

### Flame Pillar (support gem, tier 0)
- Id: flame-pillar
- Rule: Supported skills consume Ignite on Hit to raise pillars of flame, but can't Ignite themselves.
- Lines: "Supports any Skill you use yourself which can cause Damaging Hits. Supported Skills Consume Ignite on Hit to create pillars of flame, but cannot themselves inflict Ignite. Cannot Support Skills which already Consume Ignite, and does not modify the Skills of Minions."
- Creates: none | Pays off on: ignite
- Penalties: "Supported Skills cannot Ignite"
- PoB models it: partly

### Flamepierce (support gem, tier 0)
- Id: flamepierce
- Rule: The first Projectile of supported skills always Pierces Ignited enemies, but they can't Ignite themselves.
- Lines: "Supports Skills which can fire Projectiles. Initial Projectile created by Supported Skills will always Pierce Ignited Enemies, but Supported Skills cannot inflict Ignite themselves."
- Creates: projectile | Pays off on: ignite
- Penalties: "Supported Skills cannot Ignite"
- PoB models it: yes

### Fortress I (support gem, tier 1)
- Id: fortress-i
- Rule: Supported wall skills create their walls in a circle instead of a line, for less Hit damage.
- Lines: "Walls from Supported Skills are created in a Circle instead"
- Creates: none | Pays off on: none
- Penalties: "Supported Skills deal 40% less damage with Hits"
- PoB models it: partly

### Fortress II (support gem, tier 3)
- Id: fortress-ii
- Rule: Supported wall skills create their walls in a circle instead of a line, for less Hit damage and area.
- Lines: "Walls from Supported Skills are created in a Circle instead"
- Creates: none | Pays off on: none
- Penalties: "Supported Skills have 20% less Area of Effect", "Supported Skills deal 30% less damage with Hits"
- PoB models it: partly

### Freezefork (support gem, tier 0)
- Id: freezefork
- Rule: Projectiles of supported skills always Fork when the first one Hits a Frozen enemy, but the skills can't build Freeze.
- Lines: "Supports Skills which can fire Projectiles. Projectiles from Supported Skills always Fork when the initial Projectile Hits Frozen Enemies, but Supported Skills cannot build up Freeze themselves."
- Creates: projectile | Pays off on: freeze
- Penalties: "Supported Skills cannot cause Freeze buildup"
- PoB models it: partly

### Heightened Accuracy II (support gem, tier 3)
- Id: heightened-accuracy-ii
- Rule: Supported Attacks never miss enemies on Full Life.
- Lines: "Supported Skills Always Hit Enemies on full Life"
- Creates: accuracy | Pays off on: none
- Penalties: none
- PoB models it: partly

### Hit and Run (support gem, tier 4)
- Id: hit-and-run
- Rule: The supported Attack can be used only after you move a certain distance, with much more Skill Speed.
- Lines: "Supports Attack Skills you use yourself which do not already have some Condition for use. Supported Skills can only be used after you have moved a certain distance, but have massively increased Skill Speed. Cannot support Skills which have a cooldown."
- Creates: none | Pays off on: moving
- Penalties: none
- PoB models it: partly

### Infernal Legion I (support gem, tier 2)
- Id: infernal-legion-i
- Rule: Supported Minions Ignite themselves and nearby enemies, the Ignite based on the Minion's Life.
- Lines: "Supports skills which create Minions which can be damaged, causing them and enemies near them to Ignite. The damage of the Ignite is based on the Life of the supported Minion.", "Minions from Supported Skills Ignite Enemies within a radius of 1.5 metres as though dealing Base Fire Damage equal to 10% of Minion's Maximum Life"
- Creates: ignite | Pays off on: none
- Penalties: none
- PoB models it: partly

### Infernal Legion II (support gem, tier 5)
- Id: infernal-legion-ii
- Rule: Supported Minions Ignite themselves and nearby enemies, the Ignite based on the Minion's Life.
- Lines: "Supports skills which create Minions which can be damaged, causing them and enemies near them to Ignite. The damage of the Ignite is based on the Life of the supported Minion.", "Minions from Supported Skills Ignite Enemies within a radius of 2 metres as though dealing Base Fire Damage equal to 10% of Minion's Maximum Life"
- Creates: ignite | Pays off on: none
- Penalties: none
- PoB models it: partly

### Jagged Ground II (support gem, tier 5)
- Id: jagged-ground-ii
- Rule: Aftershocks of supported Slams always create Jagged Ground.
- Lines: "Supports Slam skills. Aftershocks caused by Supported Slam Skills always create patches of Jagged Ground."
- Creates: other-ground | Pays off on: none
- Penalties: none
- PoB models it: no

### Lifetap (support gem, tier 2)
- Id: lifetap
- Rule: Supported skills cost Life instead of Mana.
- Lines: "Supports any Skill, turning its Mana cost into a Life cost. Does not support Skills which reserve Spirit."
- Creates: none | Pays off on: life
- Penalties: none
- PoB models it: yes

### Malady (support gem, tier 0)
- Id: malady
- Rule: Supported skills swap their base chances: base Poison chance sets the Bleeding chance and base Bleeding chance the Poison chance.
- Lines: "Chance to inflict Bleeding with Supported Skills is calculated from their base chance to Poison instead", "Chance to Poison with Supported Skills is calculated from their base chance to inflict Bleeding instead"
- Creates: bleed, poison | Pays off on: none
- Penalties: none
- PoB models it: no

### Minion Pact I (support gem, tier 1)
- Id: minion-pact-i
- Rule: Supported skills drain Life from one of your Minions when used, for more damage.
- Lines: "Supports damaging skills you use yourself, draining the life from one of your Minions on use in order to boost the skill's damage. Only takes effect if you have a Minion with enough life to drain the full amount."
- Creates: none | Pays off on: none
- Penalties: none
- PoB models it: yes

### Minion Pact II (support gem, tier 4)
- Id: minion-pact-ii
- Rule: Supported skills drain Life from one of your Minions when used, for more damage.
- Lines: "Supports damaging skills you use yourself, draining the life from one of your Minions on use in order to boost the skill's damage. Only takes effect if you have a Minion with enough life to drain the full amount."
- Creates: none | Pays off on: none
- Penalties: none
- PoB models it: yes

### Momentum (support gem, tier 2)
- Id: momentum
- Rule: Supported skills deal more damage if you move far enough while using them.
- Lines: "Supports any damaging skill that you use yourself, causing it to deal more damage if you move a sufficient distance while using the skill. Teleportation does not count towards the distance travelled."
- Creates: none | Pays off on: moving
- Penalties: none
- PoB models it: yes

### Nova Projectiles I (support gem, tier 2)
- Id: nova-projectiles-i
- Rule: Supported Projectile skills fire their Projectiles in a circle.
- Lines: "Supports Projectile Skills, making them fire Projectiles in a circle. Does not Support Skills which rain down Projectiles from above."
- Creates: projectile | Pays off on: none
- Penalties: none
- PoB models it: no

### Nova Projectiles II (support gem, tier 4)
- Id: nova-projectiles-ii
- Rule: Supported Projectile skills fire extra Projectiles in a circle, for less damage and a cooldown.
- Lines: "Supports Projectile Skills, making them fire extra Projectiles in a circle, at the cost of Damage and gaining a cooldown. Does not Support Skills which rain down Projectiles from above. Cannot Support Skills which already have a cooldown."
- Creates: projectile | Pays off on: none
- Penalties: "Supported Skills deal 50% less Damage"
- PoB models it: partly

### Oisin's Oath (support gem, tier 0)
- Id: oisins-oath
- Rule: Mana Leech from supported skills recovers from Elemental damage instead of Physical.
- Lines: "Mana Leech from Supported Skills recovers based on Elemental Damage Types instead of Physical Damage"
- Creates: leech | Pays off on: none
- Penalties: none
- PoB models it: yes

### Perpetual Charge (support gem, tier 1)
- Id: perpetual-charge
- Rule: Supported skills that consume Charges may keep each Charge while still gaining its benefit.
- Lines: "Supported Skills have 25% chance to not remove Charges but still count as consuming them"
- Creates: none | Pays off on: endurance-charge, frenzy-charge, power-charge
- Penalties: none
- PoB models it: no

### Persistent Ground II (support gem, tier 3)
- Id: persistent-ground-ii
- Rule: Ground Surfaces from supported skills last much longer and end only when their duration expires.
- Lines: "Supports Skills which create Ground Surfaces, causing created Surfaces to last much longer and only end when their duration expires."
- Creates: none | Pays off on: chilled-ground, shocked-ground, ignited-ground, other-ground
- Penalties: none
- PoB models it: no

### Persistent Ground III (support gem, tier 5)
- Id: persistent-ground-iii
- Rule: Ground Surfaces from supported skills last much longer, end only when their duration expires, and slow enemies' cooldowns.
- Lines: "Supports Skills which create Ground Surfaces, causing created Surfaces to last much longer as well as lowering the Cooldown Recovery Speed of affected Enemies. Ground Surfaces from Supported Skills only end when their duration expires."
- Creates: none | Pays off on: chilled-ground, shocked-ground, ignited-ground, other-ground
- Penalties: none
- PoB models it: no

### Pin I (support gem, tier 1)
- Id: pin-i
- Rule: Supported skills' Stun buildup modifiers apply to Pin buildup instead, and the skills can't Stun.
- Lines: "Modifiers to Stun Buildup for Supported Skills instead apply to Pin Buildup Supported Skills cannot cause Stun Buildup"
- Creates: pin | Pays off on: stun
- Penalties: "Modifiers to Stun Buildup for Supported Skills instead apply to Pin Buildup Supported Skills cannot cause Stun Buildup"
- PoB models it: partly

### Pin II (support gem, tier 2)
- Id: pin-ii
- Rule: Supported skills' Stun buildup modifiers apply to Pin buildup instead, and the skills can't Stun.
- Lines: "Modifiers to Stun Buildup for Supported Skills instead apply to Pin Buildup Supported Skills cannot cause Stun Buildup"
- Creates: pin | Pays off on: stun
- Penalties: "Modifiers to Stun Buildup for Supported Skills instead apply to Pin Buildup Supported Skills cannot cause Stun Buildup"
- PoB models it: partly

### Pin III (support gem, tier 5)
- Id: pin-iii
- Rule: Supported skills' Stun buildup modifiers apply to Pin buildup instead, and the skills can't Stun.
- Lines: "Modifiers to Stun Buildup for Supported Skills instead apply to Pin Buildup Supported Skills cannot cause Stun Buildup"
- Creates: pin | Pays off on: stun
- Penalties: "Modifiers to Stun Buildup for Supported Skills instead apply to Pin Buildup Supported Skills cannot cause Stun Buildup", "Hits with Supported Skills cause 60% less Pin buildup"
- PoB models it: partly

### Pinnacle of Power (skill gem, tier 0)
- Id: pinnacle-of-power
- Rule: Consumes all Power Charges for Elemental damage and the ability to inflict Elemental Ailments with other damage types.
- Lines: "Consume all Power Charges to master the elements, gaining Elemental Damage and the ability to apply Elemental Ailments with other damage types. Can only be used while you have maximum Power Charges."
- Creates: ignite, chill, freeze, shock | Pays off on: power-charge
- Penalties: none
- PoB models it: yes

### Powered by Verisium (skill gem, tier 0)
- Id: powered-by-verisium
- Rule: Spends Ward to make Verisium Infusions, which can be used in place of any Elemental Infusion.
- Lines: "Spends Ward to generate Verisium Infusions, which can be used in place of any Elemental Infusions."
- Creates: infusion | Pays off on: ward
- Penalties: none
- PoB models it: no

### Rageforged II (support gem, tier 5)
- Id: rageforged-ii
- Rule: Supported skills spend Rage for more damage, sometimes without spending it.
- Lines: "Supports any damaging skill that you use or Trigger yourself, causing it to spend Rage to deal more damage, with a chance to skip spending Rage while still benefitting as though it had. If you don't have enough Rage to spend, the damage bonus will not apply."
- Creates: none | Pays off on: rage
- Penalties: none
- PoB models it: partly

### Ratha's Assault (support gem, tier 0)
- Id: rathas-assault
- Rule: Supported Crossbow Ammunition skills can't reload normally; they load bolts when you Dodge.
- Lines: "Supports Crossbow Ammunition Skills, causing them to load multiple extra bolts and attack faster. Supported Skills cannot reload normally, instead loading bolts when you Dodge."
- Creates: none | Pays off on: on-dodge
- Penalties: "Supported Crossbow Ammunition Skills cannot reload"
- PoB models it: partly

### Retaliate II (support gem, tier 4)
- Id: retaliate-ii
- Rule: Supported Melee Attacks Stun as though they dealt more damage the fuller your own Stun bar is.
- Lines: "Hits from Supported Skills Stun Enemies as though dealing more Damage equivalent to the current percentage of your Stun Bar"
- Creates: stun | Pays off on: none
- Penalties: none
- PoB models it: no

### Sacrifice (spirit gem, tier 14)
- Id: sacrifice
- Rule: Your undead Reviving Minions can be used in place of Corpses, but they Revive more slowly.
- Lines: "Skills can use your undead Reviving Minions in place of Corpses Minions Revive 40% more slowly"
- Creates: corpse | Pays off on: minion-revive
- Penalties: "Skills can use your undead Reviving Minions in place of Corpses Minions Revive 40% more slowly"
- PoB models it: partly

### Sacrificial Lamb II (support gem, tier 3)
- Id: sacrificial-lamb-ii
- Rule: Minions from the supported skill always count as Detonatable, and your skills that target Minions pick them first.
- Lines: "Supports Skills which create Minions, causing your Skills which can target Minions to prioritise targeting Minions from the Supported Skill before your other Minions where possible, as well as causing them to always be considered Detonatable.", "Minions created by Supported Skills are always considered to be Detonatable"
- Creates: minion-death | Pays off on: none
- Penalties: none
- PoB models it: no

### Selfless Remnants (support gem, tier 2)
- Id: selfless-remnants
- Rule: Remnants from supported skills affect allies in your Presence instead of you.
- Lines: "Remnants from Supported Skills affect Allies in your Presence instead of you when collected"
- Creates: none | Pays off on: remnant
- Penalties: none
- PoB models it: no

### Seraph's Heart (support gem, tier 0)
- Id: seraphs-heart
- Rule: While the supported Persistent Buff is active, enemies may calculate their Hits as though your Resistances were 90%.
- Lines: "Supports Persistent Buff Skills, providing a chance for enemies to calculate their Hits as though your Resistances were 90% while the skill is active."
- Creates: none | Pays off on: none
- Penalties: none
- PoB models it: no

### Shard Scavenger (spirit gem, tier 8)
- Id: shard-scavenger
- Rule: Consuming Freeze, Shock, Ignite or Fully Broken Armour reloads your Crossbow, restores a Grenade cooldown use and briefly stops Crossbow Attacks from spending bolts.
- Lines: "While active, Consuming Freeze, Shock, Ignite, or Fully Broken Armour on an enemy reloads your Crossbow, restores one cooldown use for your Grenades and grants a Buff causing Crossbow Attacks to not consume bolts for a duration. This can only occur once every few seconds."
- Creates: none | Pays off on: freeze, shock, ignite, armour-break
- Penalties: none
- PoB models it: yes

### Spar (support gem, tier 0)
- Id: spar
- Rule: Supported Melee Attacks Stun as though they dealt more damage the fuller your own Stun bar is.
- Lines: "Hits from Supported Skills Stun Enemies as though dealing more Damage equivalent to the current percentage of your Stun Bar"
- Creates: stun | Pays off on: none
- Penalties: none
- PoB models it: no

### Splinter Totem I (support gem, tier 3)
- Id: splinter-totem-i
- Rule: You can have only one of the supported Totem, but it splinters into weaker copies after each Attack or Spell.
- Lines: "Supports Skills which create Totems, preventing having more than one active Totem but causing that Totem to splinter into smaller versions of itself after it uses an Attack or Spell, with each Totem becoming less effective. Each splintered Totem can further splinter, up to a maximum. Does not Support Skills used by Minions. Only one Totem can be splintering at a time.", "Supported Skills can only have one active Totem"
- Creates: totem | Pays off on: none
- Penalties: "Supported Skills can only have one active Totem", "Totems created by Supported Skills have 20% less area of effect for each time they have splintered", "Totems created by Supported Skills deal 20% less damage for each time they have splintered", "Totems created by Supported Skills have 20% less maximum Life for each time they have splintered", "Totems created by Supported Skills have 10% less Skill Speed for each time they have splintered"
- PoB models it: no

### Splinter Totem II (support gem, tier 5)
- Id: splinter-totem-ii
- Rule: You can have only one of the supported Totem, but it splinters into weaker copies after each Attack or Spell.
- Lines: "Supports Skills which create Totems, preventing having more than one active Totem but causing that Totem to splinter into smaller versions of itself after it uses an Attack or Spell, with each Totem becoming less effective. Each splintered Totem can further splinter, up to a maximum. Does not Support Skills used by Minions. Only one Totem can be splintering at a time.", "Supported Skills can only have one active Totem"
- Creates: totem | Pays off on: none
- Penalties: "Supported Skills can only have one active Totem", "Totems created by Supported Skills have 15% less area of effect for each time they have splintered", "Totems created by Supported Skills deal 15% less damage for each time they have splintered", "Totems created by Supported Skills have 15% less maximum Life for each time they have splintered", "Totems created by Supported Skills have 7% less Skill Speed for each time they have splintered"
- PoB models it: no

### Stormchain (support gem, tier 0)
- Id: stormchain
- Rule: Supported skills always Chain when they first Hit a Shocked enemy, but can't Shock.
- Lines: "Supports Projectile Skills and Skills which can Chain. Supported Skills always Chain when initially Hitting a Shocked Enemy, but cannot themselves inflict Shock. Does not support Skills which cannot Chain."
- Creates: projectile | Pays off on: shock
- Penalties: "Supported Skills Cannot inflict Shock"
- PoB models it: partly

### Tame Beast (spirit gem, tier 7)
- Id: tame-beast
- Rule: A Rare Beast you defeat while it is engulfed is captured, and the gem then summons it as a Reviving Companion.
- Lines: "Conjure Azmeri wisps to engulf a Rare Beast for a duration, Hindering them. If you defeat the Beast while it is engulfed in wisps, it will be captured by this gem, transforming the gem to instead allow you to summon the Beast as a Reviving Companion."
- Creates: companion | Pays off on: none
- Penalties: none
- PoB models it: partly

### Uhtred's Augury (support gem, tier 0)
- Id: uhtreds-augury
- Rule: The supported skill gains levels only while it has exactly two other supports.
- Lines: "Supports Skills which can gain levels, granting them additional levels provided exactly two other supports are used with the supported Skill. Does not support skills which do not have levels."
- Creates: none | Pays off on: support-gem
- Penalties: none
- PoB models it: yes

### Uhtred's Exodus (support gem, tier 0)
- Id: uhtreds-exodus
- Rule: The supported skill gains many levels only while it has no other support.
- Lines: "Supports Skills which can gain levels, granting them many additional levels provided no other supports are used with the supported Skill. Does not support skills which do not have levels."
- Creates: none | Pays off on: support-gem
- Penalties: none
- PoB models it: yes

### Uhtred's Omen (support gem, tier 0)
- Id: uhtreds-omen
- Rule: The supported skill gains levels only while it has exactly one other support.
- Lines: "Supports Skills which can gain levels, granting them additional levels provided exactly one other support is used with the supported Skill. Does not support skills which do not have levels."
- Creates: none | Pays off on: support-gem
- Penalties: none
- PoB models it: yes

### Wild Protector (spirit gem, tier 0)
- Id: wild-protector
- Rule: The Bear Spirit doesn't count toward your Companion limit.
- Lines: "Call upon a Bear Spirit Companion to maul your foes. The Bear Spirit leaps at enemies to Maim them, Leeches Life with its slam, and periodically roars to Intimidate enemies. The Bear Spirit does not count toward your Companion limit."
- Creates: companion, minion-count | Pays off on: none
- Penalties: none
- PoB models it: no

### Wolf Pack (spirit gem, tier 8)
- Id: wolf-pack
- Rule: The pack of Wolves counts as one Companion for effects that count or limit Companions.
- Lines: "Activate to summon a pack of Wolf Companions. The pack treated as a single Companion for effects that count or limit Companions, regardless of the number of Wolves in the pack."
- Creates: companion, minion-count | Pays off on: none
- Penalties: none
- PoB models it: no

### Garukhan's Resolve (support gem, tier 0)
- Id: garukhans-resolve
- Rule: Supported Attacks' Critical Hit chance is capped at 50%, but it Bifurcates: PoB rolls it twice.
- Lines: "Maximum Critical Hit chance with Supported Skills is 50%", "Attack Critical Hit Chance with Supported Skills Bifurcates"
- Creates: crit | Pays off on: none
- Penalties: "Maximum Critical Hit chance with Supported Skills is 50%"
- PoB models it: yes

### Brambleslam (support gem, tier 5)
- Id: brambleslam
- Rule: The Brambles of supported Slams scale with Thorns: increases and reductions to Thorns damage apply to their Hit damage.
- Lines: "Increases and reductions to Thorns Damage apply to Hit Damage with this skill"
- Creates: none | Pays off on: thorns
- Penalties: "80% less damage if destroyed within 0.5 seconds by something other than you"
- PoB models it: partly

### Caltrops (support gem, tier 3)
- Id: caltrops
- Rule: Supported Ranged Spear Attacks leave Caltrops, whose Hit damage scales with increases and reductions to Thorns damage.
- Lines: "Projectiles from Supported Skills trigger Caltrops when they reach the end of their flight", "Increases and reductions to Thorns Damage apply to Hit Damage with this skill"
- Creates: none | Pays off on: thorns
- Penalties: none
- PoB models it: partly

### Last Gasp (support gem, tier 1)
- Id: last-gasp
- Rule: Supported Persistent Minions fight on when fatally wounded, dying 4 seconds after their Life reaches zero.
- Lines: "Supports Skills that create Persistent Minions, causing those Minions to fight on when they are fatally wounded, dying after a short duration.", "Minions from Supported Skills die 4 seconds after their Life is reduced to 0"
- Creates: none | Pays off on: minion-death
- Penalties: none
- PoB models it: no

### Tecrod's Revenge (support gem, tier 0)
- Id: tecrods-revenge
- Rule: Supported Persistent Minions fight on for 20 seconds when fatally wounded, with Soul Eater and more Attack and Cast Speed.
- Lines: "Minions from Supported Skills die 20 seconds after their Life is reduced to 0", "Minions from Supported Skills gain Soul Eater when their Life is reduced to 0", "Minions from Supported Skills gain 40% increased Attack and Cast Speed when their Life is reduced to 0"
- Creates: none | Pays off on: minion-death
- Penalties: none
- PoB models it: no

### Alchemist's Boon (spirit gem, tier 14)
- Id: alchemists-boon
- Rule: Recovery from your Flasks also applies, in part, to allies in your Presence.
- Lines: "While active, grants you Flask charges passively and causes Life and Mana recovery from your Flasks to also apply to Allies in your Presence.", "34% of recovery from your Flasks is also granted to Allies in your Presence"
- Creates: none | Pays off on: flask
- Penalties: none
- PoB models it: partly

### Projectile Acceleration III (support gem, tier 5)
- Id: projectile-acceleration-iii
- Rule: Increases and reductions to Projectile speed also apply to the supported skills' Projectile damage.
- Lines: "Increases and reductions to Projectile speed also apply to Projectile Damage with Supported Skills"
- Creates: none | Pays off on: projectile
- Penalties: none
- PoB models it: yes

### Refraction I (support gem, tier 2)
- Id: refraction-i
- Rule: Allies in the supported Banner's Aura gain Refractive Plating: Deflection Rating from Evasion, and part of their Armour applies to Elemental Hits.
- Lines: "Refractive Plating grants Deflection Rating equal to 15% of Evasion Rating", "Refractive Plating causes 20% of Armour to apply to Elemental Hit Damage taken"
- Creates: deflection | Pays off on: armour, evasion
- Penalties: none
- PoB models it: yes

### Refraction II (support gem, tier 3)
- Id: refraction-ii
- Rule: Allies in the supported Banner's Aura gain Refractive Plating: Deflection Rating from Evasion, and part of their Armour applies to Elemental Hits.
- Lines: "Refractive Plating grants Deflection Rating equal to 20% of Evasion Rating", "Refractive Plating causes 30% of Armour to apply to Elemental Hit Damage taken"
- Creates: deflection | Pays off on: armour, evasion
- Penalties: none
- PoB models it: yes

### Vilenta's Propulsion (support gem, tier 0)
- Id: vilentas-propulsion
- Rule: Three quarters of the increases and reductions to Cast Speed also apply to the supported Spells' Projectile speed.
- Lines: "75% of increases and reductions to Cast speed also apply to Projectile Speed for Supported Skills"
- Creates: none | Pays off on: cast-speed
- Penalties: none
- PoB models it: yes
