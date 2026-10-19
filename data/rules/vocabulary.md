# Mechanic families: the shared vocabulary

The words that `Creates:` and `Pays off on:` use in `data/rules/` (amendment 8, D-401), in the monster-modifier
table `data/monsters/monster-mods.md` (D-402), and in a deck line's `engine: <family> from <family>` (D-405). Each
is a family, never one resource: `infusion` covers Cold, Fire, Lightning and Verisium Infusions alike (D-404).

**Rules.** Use only these words, lowercase, comma-separated. `none` is the empty value: an entry that creates, or
pays off on, nothing in this list. A thing that fits none is a proposal: a build unit names it in its report, and
the coordinator adds it here. Never invent a family in an entry.

## Resources

- `life`: Life, its cost, its recovery and its reservation.
- `mana`: Mana, its cost, its recovery and its reservation.
- `energy-shield`: Energy Shield and its recharge.
- `ward`: Ward and Runic Ward.
- `spirit`: Spirit and what reserves it, flat or by percentage.
- `rage`: Rage.
- `endurance-charge`, `frenzy-charge`, `power-charge`: each charge type.
- `infusion`: Elemental and Verisium Infusions.
- `remnant`: Remnants that a skill or a kill leaves to be picked up.
- `combo`: Combo, spent by Monk skills.
- `volatility`: Volatility.
- `glory`: Glory, spent by Warrior skills.
- `energy`: meta skills' Energy, gained to trigger socketed skills.
- `ammunition`: crossbow bolts and other loaded ammunition.
- `stacking-buff`: a buff that builds stacks over time and pays out, or costs, per stack.

## Conditions and grounds

- `chilled-ground`, `shocked-ground`, `ignited-ground`: each elemental ground.
- `other-ground`: any other ground effect (desecrated, caustic, jagged, and so on).
- `corpse`: corpses, made or consumed.
- `low-life`, `full-life`: life thresholds.
- `on-kill`, `on-hit`, `on-crit`, `on-block`, `on-dodge`: what happens when.
- `recently`: a "recently" window (within the last four seconds).
- `stationary`, `moving`: whether the player is standing still.

## Ailments and debuffs

- `ignite`, `chill`, `freeze`, `shock`, `electrocute`: elemental ailments.
- `bleed`, `poison`: damaging ailments.
- `stun`: Stun and Heavy Stun buildup.
- `pin`, `daze`, `blind`, `maim`, `hinder`: other debuffs.
- `curse`: curses and hexes.
- `exposure`: elemental exposure.
- `armour-break`: broken armour and Crushing Blows.

## Minions and companions

- `minion-count`: how many minions, or how many kinds, a build runs (Muster, At your Command).
- `minion-death`: minions dying, or being sacrificed.
- `minion-revive`: minions reviving.
- `companion`: a companion, a tamed beast included.
- `totem`: totems.

## Speed, area and skill shape

- `attack-speed`, `cast-speed`, `movement-speed`: each speed.
- `crit`: critical hit chance and damage.
- `accuracy`: accuracy and hit chance, including always hitting.
- `luck`: lucky and unlucky rolls.
- `area`: area of effect.
- `projectile`: projectile count, speed and chaining.
- `cooldown`: cooldowns and their recovery.
- `duration`: skill and effect durations.
- `damage-conversion`: damage converted, or gained as extra damage of another type.

## Defences

- `armour`, `evasion`, `block`, `deflection`: each defence.
- `thorns`: damage dealt back to attackers.
- `resistance`: elemental and chaos resistances, their maximums included.
- `recovery`: life, mana and energy shield recovery other than leech.
- `leech`: life and mana leech.

## Gear

- `weapon-slot`, `offhand-slot`, `glove-slot`, `boot-slot`, `helmet-slot`, `body-slot`, `ring-slot`,
  `amulet-slot`, `belt-slot`: a slot whose item a rule changes or rewards.
- `item-modifiers`: an item's explicit modifiers made stronger or changed (Way of the Stonefist).
- `socket`: sockets, and the runes, soul cores and jewels in them.
- `flask`, `charm`: flasks and charms.
- `attribute`: Strength, Dexterity and Intelligence, as a requirement or a scaling stat.
- `passive-tree`: the passive tree itself changed: allocation, connections, or nodes transformed (timeless jewels).
- `support-gem`: how support gems socket, link or apply (more supports, supports from items).
