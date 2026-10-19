# MisoxShiru's Glacial Lance Ritualist (Mobalytics page)

An agent's study report (2026-10-18). Brief: `briefs/2026-10-18-mobalytics-review.md`, guide 15, cited as
`[mob-glacial-lance]`. "Checked" means a lookup at the pin (0.5.4) or a grep of `vendor/PathOfBuilding-PoE2/src/`
confirmed it; "unverified" means only the guide says so.

---

## 1. Header

- **Guide:** "[0.5.5] Infinite Frenzy Charge Glacial Lance Ritualist (Extremely Satisfying Build)", by MisoxShiru.
  URL: https://mobalytics.gg/poe-2/builds/misoxshiru-glacial-lance-ritualist
- **Tab:** Verified. 792 favourites. Patch 0.5.5. Updated Aug 31, 2026. Tags: Huntress, Ritualist, End Game,
  Starter.
- **Variant tabs, in order:** Act 1 → Act 2 → Act 3 → Act 4 & Interlude → Pre-Glacial Lance Endgame → Endgame →
  Uber Endgame.
- **What the capture couldn't hold:**
  - every item's affixes (only base and unique names);
  - the tree and the ascendancy order (only point counters);
  - the video, the PoB code and the build file;
  - the levels of Glacial Lance and Barrage on the endgame tabs.

  The Endgame tab announces unique jewels but lists none; the Uber tab names them. The comments were ignored.

## 2. What the build is

- **Damage:** Glacial Lance (checked: gem lookup).
  - A spear attack that throws one piercing lance, which leaves chilling fragments.
  - If it can consume a Frenzy Charge, the first lance's fragments explode after about 1 s. The explosion is a
    second stat set: 670% of base, all cold, against the lance's 405% at 80% cold.
  - Its projectile count can't be modified, so the guide scales repeats, not projectiles.
- **Ascendancy:** Ritualist. The overview's whole pitch is a frenzy engine that keeps every lance charged (§3).
- **Packs:** pierce, the fragment explosions, Herald of Ice, and freezing the whole screen quickly.
- **Bosses** (Uber tab):
  1. Disengage until you hold 6 frenzy charges.
  2. Barrage. It consumes them all for repeats: +2, plus 1 per charge, each repeat at 50% less damage (checked).
  3. Disengage onto the boss for Shocked Ground and one more charge.
  4. Release Glacial Lance, which spends that fresh charge on its explosion.
- **Feel:** the strengths are looks, clear and being "surprisingly tanky". The weakness: single target "can be a
  bit RNG".

## 3. The kit

**The frenzy engine (the Ritualist's part).** The overview names three uniques and a charm:
1. **Scold's Bridle** (helmet): you take 25–100% of the mana costs you pay for skills as physical damage
   (checked: unique lookup).
2. **Lightning Coil** (body): 30–50% of physical damage from hits taken is taken as lightning (checked).
3. **Valako's Roar** (Topaz Charm): used when you take lightning damage from a hit, and grants a Frenzy Charge on
   use (checked).
4. **Bijouborne** (belt): the guide wants the highest reduced charm duration roll, so the charm fires again
   sooner.
   - At the pin, the belt grants Cast on Charm Use and two charm slots, with a penalty of (10–50)% reduced Charm
     Effect Duration (checked: `data/rules/uniques.md`).
   - That a charm can't fire while its effect lasts is the guide's premise (unverified).
   - The Topaz base's effect is a 4 s buff of +25% lightning resistance (checked, pin: `Data/Bases/flask.lua`).
5. **Mind Phylacteries** (Ritualist): a charm without enough charges can be used for 25% of maximum Mana instead
   (checked: `data/rules/nodes.md`). The guide says this is why no other ascendancy can run the engine: their
   charm runs dry in a long fight.

**The loop.**
1. Every skill use costs mana.
2. The Bridle turns the mana cost into physical damage to you.
3. The Coil turns it into lightning.
4. The lightning sets off the charm, which grants a frenzy charge.

So each lance pays for the next one's charge, the "infinite" of the title. No text confirms that the Bridle's
self-damage counts as a hit, which both the Coil and the charm need (unverified, and load-bearing).

**What else feeds or pays for it** (our reading of game text):
- **Valako's Charge.** Lightning Coil grants it (checked). Taking lightning damage builds up to a chaining bolt
  that adds electrocution buildup (checked). The guide runs it at level 18 with Living Lightning II, Elemental
  Armament II, Lightning Mastery and Elemental Focus.
- **Combat Frenzy.** It gives a frenzy charge on a freeze, an electrocute or a pin, at most once every 6.1 s at
  level 20 (checked: coverage).
- **Cast on Charm Use** triggers Profane Ritual, with Overabundance I, Compressed Duration II, Charge Profusion II
  and Boundless Energy II.
  - The ritual consumes a corpse for a Power Charge (checked: gem lookup), and Charge Profusion adds one of a
    random type.
  - Charge Regulation spends the charges.
  - The guide never explains the group.
- **The mana.** Mana leech on the rings, Mana Remnants and the Bridle's 80–100 maximum mana (checked) read as the
  budget for Mind Phylacteries' 25%.

**Weapons.**
- **Pre-lance:**
  - Weapon set 1: Tangletongue and a buckler for Parry. Calgyra's Arc is best because it parries from range.
  - Weapon set 2: Skysliver, the cheap fast spear, with an empty off hand for Dance with Death. At the pin that
    keystone gives 25% more skill speed with an empty off hand and a one-handed martial weapon (checked).
- **Endgame:** Tangletongue, as high crit as you can find. The off hand is Guiding Palm of the Eye, or a
  high-Spirit sceptre.
- **Uber:** a rare Akoyan Spear with high crit, high physical, +projectile levels and gain as extra physical.
  Sacred Flame (with a Rabbit Idol) is the off hand, for gain as extra fire.
- **Set 2 at endgame:** both endgame tabs put Disengage on set 2 but list no set-2 weapon. Keeping the Skysliver
  with an empty off hand would serve Disengage and Dance with Death, which From Nothing reaches on Uber (our
  reading).

**Endgame socket groups** (Str 55, Dex 70, Int 90):
- **Glacial Lance:** Elemental Armament II, Cold Penetration, Cold Attunement, Ice Bite II, Blindside. On Uber:
  Rakiata's Flow, Garukhan's Resolve, Elemental Armament II, Rapid Attacks II, Ice Bite II.
- **Barrage:** Prolonged Duration II, Olroth's Conviction, Heightened Charges, Cooldown Recovery II, Second Wind II.
  - The guide says to runeforge the Bridle for enough Runic Ward for Barrage.
  - At the pin, Olroth's Conviction adds a Ward cost equal to the life and mana cost, and empowers 2 more uses
    (checked, pin: `Data/Skills/other.lua`).
- **Disengage** (set 2): Shocking Leap, Commiserate, Overcharge, Pinpoint Critical, Blind II.
  - It grants frenzy charges only when it consumes Parried (3 at level 20, checked), and the endgame kit has no
    Parry.
  - So the boss sequence's charges come from the loop (our reading).
- **Spirit:** Purity of Ice (of Fire on Uber) with five supports, Combat Frenzy, Ghost Dance, Mana Remnants,
  Charge Regulation, Eternal Rage, Herald of Ice and Wind Dancer.
  - Herald of Ice takes Armour Break III, Magnified Area II and three others.
- **Spear Stab** (Freeze, Magnified Area II, Ice Bite II) is never explained.
  - The anoint, Crystallised Immunities, grants immunity to Shock while most of your socketed supports are green
    (checked: tree search).
  - So the stab's group looks like filler for that count, which keeps the Coil's lightning from shocking you (our
    inference).

**Tree.** It isn't captured; the only rule is the crit gate (§5). The counters (Act 1 106 of 123, then 82, 64,
24, −6, −5, −5) read as points left, so the endgame trees overspend by 5–6 (our reading).

## 4. The levers

In the guide's order:
1. **+projectile skill levels:** the top priority on gloves and amulet from Act 1, +3 on the endgame amulet, and
   required on the Uber spear.
2. **Flat physical and cold damage** on gloves and rings, and physical damage on weapons.
3. **Crit:** the 40–50% gate, crit chance then crit damage on jewels, and Tangletongue.
4. **Gain as extra on Uber:** physical on the spear, fire on Sacred Flame, and Heart of the Well.
5. **Frenzy charges** for Barrage's repeats and the explosion.

What it says you can skip:
- the exact items, which are stat guidelines;
- Calgyra's Arc, since any buckler parries;
- Guiding Palm, for a sceptre.

## 5. Leveling

- **Act 1:** Twister, fed by Whirling Slash's whirlwinds.
  - Whirling Slash takes Rage I and Rapid Attacks I; Twister takes Retreat I and Elemental Armament I.
  - Fangs of Frost with Parry handles tanky rares and bosses.
  - Also War Banner, Ice-Tipped Arrows and Frost Bomb.
  - The notes name the boss or chest that gives each uncut gem.
  - Gear: life on armour; physical damage on weapons, rings and gloves; cold resistance for Count Geonor, even at
    the cost of a ring.
- **Act 2:**
  - Whirling Slash moves to weapon set 2.
  - Frost Nexus stands in on Twister until the Buried Shrines' Lesser Jeweller's Orb opens a socket for Elemental
    Armament II. The note says Glacial Cascade, a leftover.
  - Freezing Mark and Barrage (Rapid Casting I, Second Wind I) arrive.
- **Act 3:** tier II supports, Perpetual Charge on Barrage, and Combat Frenzy (Charge Profusion I), the first frenzy
  source.
- **Act 4 & Interlude:**
  - Tier III Rage and Rapid Attacks.
  - Projectile Acceleration III on Twister, from Ngakanu's Greater Jeweller's Orb.
  - Herald of Ice and Charge Profusion II.
- **Pre-Glacial Lance Endgame:** still Twister, adding Salvo, Blazing Critical, Heightened Charges and Elemental
  Focus. Fangs of Frost goes.
- **Swap point:** to Glacial Lance once the Bridle, Coil, Bijouborne and Roar are in hand. Keep the pre-lance tree
  until the lance reaches 40–50% crit chance.

## 6. Gear and budget

- **Pre-lance buy order** (the numbered Equipment Priority list):
  1. an energy shield helmet;
  2. Tangletongue;
  3. Calgyra's Arc;
  4. a rare amulet with +3 projectile levels (anoint Overwhelming Strike);
  5. body, gloves and belt;
  6. Skysliver;
  7. two rings;
  8. Wake of Destruction, best in slot for its Shocked Ground.
- **Endgame order:**
  1. Scold's Bridle: most ES, lowest self-damage roll, runeforged;
  2. Tangletongue;
  3. Guiding Palm;
  4. three rings (an Unset Ring in the extra slot);
  5. a rare amulet with Crystallised Immunities;
  6. Lightning Coil: highest conversion, The Greatwolf's Rune of Willpower runeforged;
  7. gloves;
  8. Bijouborne;
  9. Drakeskin Boots.
- **Uber additions:**
  - the rare spear and Sacred Flame;
  - Mystic Alloy for Spirit on boots, without which the spirit gems don't fit;
  - From Nothing, Heart of the Well, Controlled Metamorphosis and a rare Time-Lost jewel.
- **Budget:** the three required uniques are called very cheap, with no currency figures. Guiding Palm and the
  Uber pieces are the expensive end.
- **Pin check:** gloves can't roll the +projectile levels the page wants; amulets (+3), quivers and spears (+4)
  can (checked, pin: `Data/ModItem.lua`).

## 7. Defences

There are no numbers. The layers:
- energy shield on the helmet, and evasion/ES on the body and amulet;
- life on armour;
- Ghost Dance;
- Runic Ward from the runeforged Bridle and chest;
- Blind II on Wind Dancer and Disengage;
- the Purity with Vitality II and Cannibalism II;
- freeze as control.

The quest picks are resistances, 30% elemental ailment threshold, flask life recovery and 3% movement speed. The
Coil's −30 to −40% lightning resistance is offset only by the Topaz buff's +25% while the charm is active
(checked), and Bijouborne's penalty shortens that (our reading).

## 8. What players pick

Little. It claims no other ascendancy can run the tech; calls Tangletongue easy to get, Skysliver the cheap fast
spear and Wake of Destruction best in slot; says any buckler parries and the items shown are guidelines. It never
says what most players do; its weight is the Verified badge and 792 favourites.

## 9. For the library

**Kit lines for "Spears":**
- **Kit:** MisoxShiru's Glacial Lance Ritualist (792 favourites, 0.5.5) levels on Twister fed by Whirling Slash,
  with the slash on a fast second spear (Skysliver, empty off hand for Dance with Death), then hands over to
  Glacial Lance at 40–50% crit [mob-glacial-lance] §3, §5. It is a second, non-Spirit Walker source for the
  kit's Twister line (checked: both guides list the gems).
- **Bosses:** Barrage spends the banked frenzy charges on repeats (+2, +1 per charge, 50% less each, pin: gem
  lookup), then one fresh charge pays for Glacial Lance's explosion [mob-glacial-lance] §2 (checked).
- **Levels:** +3 projectile levels on the amulet and a +projectile spear [mob-glacial-lance] §4, §6 (checked).
- **Frenzy supply:** Combat Frenzy from Act 3, with Charge Profusion I then II [mob-glacial-lance] §5. Disengage
  gives 3 charges only on Parried (pin: gem lookup) (checked).
- **Clear:** Glacial Lance's pierce, chill and freeze, with Herald of Ice (Armour Break III, Magnified Area II)
  [mob-glacial-lance] §2, §3 (checked: gem lookup).
- **Levers:** crit, flat physical and cold on gloves and rings, then gain as extra damage at the top end
  [mob-glacial-lance] §4 (unverified as multipliers).
- **Spirit:** eight spirit gems paid by a high-Spirit off hand and Spirit on boots [mob-glacial-lance] §6
  (unverified totals).

**Candidate patterns:**
- **Cost to a gated resource (match).**
  - Mana costs become self-damage, and self-damage becomes frenzy charges, through Scold's Bridle, Lightning Coil
    and Valako's Roar. Mind Phylacteries keeps the charm firing for mana.
  - Each item line is checked; the self-damage counting as a hit and the charm's re-arm timing are unverified.
- **New: self-hit relay.** Shape: a self-damage line turns every skill use into a hit on you, and a conversion picks
  the type that "when you take X damage" effects read. Nearest is Harmless self-trigger, but here nothing cancels
  the damage; the guide minimises the roll.
- **Supply by family (match, with a gap).**
  - Frenzy comes from six sources: a charm, a spirit gem, a Parried-consuming strike, Profane Ritual with Charge
    Profusion, Perpetual Charge, and Valako's Charge feeding electrocute.
  - A grep of `creates: [^|]*frenzy` in `data/rules/` finds only Combat Frenzy, Resonance, Serpent's Egg and
    Hateforge.
  - Valako's Roar, Scold's Bridle and Lightning Coil have no `uniques.md` entry, and `pairs.md` pairs Mind
    Phylacteries with four other charms (checked).
- **Payoff thief (match).** Barrage eats the charges the lance needs, and ordering is the fix (checked text; the
  order is the guide's).
- **Smaller matches:**
  - Staged handover: Twister until the crit gate.
  - Weapon set 2 job: the slash and Disengage.
  - Radius jewel instead of an anoint: From Nothing for Dance with Death.
  - A rule changer: Mind Phylacteries.
  - Filler to satisfy a count: Spear Stab for the green majority (an inference).
  - Burst-window stacking: Shocked Ground, Barrage, release.

**What PoB might not model:**
- **Not modelled:**
  - Mind Phylacteries is unparsed (checked: coverage).
  - Cast on Charm Use's Energy isn't modelled (checked: coverage). Whether a mana-paid charm use, with no charges
    used, gains Energy at all is unverified.
- **No status on the coverage line:**
  - Combat Frenzy's cooldown is mapped but unread (checked: coverage).
  - Barrage's cooldown line may be unmodelled (checked: coverage); its repeats are modelled [stormcaller].
- **Not established:**
  - The self-hit loop, so the frenzy count is a config stand-in.
  - Valako's Charge's trigger rate, a hand calculation.
  - The Bridle's self-damage and Olroth's Ward cost, not checked.
