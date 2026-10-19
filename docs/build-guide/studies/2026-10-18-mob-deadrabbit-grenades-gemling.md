# Grenades Gemling League Starter (DEADRABB1T, Mobalytics, 0.5.5)

An agent's study report (2026-10-18). Brief: `briefs/2026-10-18-mobalytics-review.md`, guide 12, key `mob-grenades`.
Its claims are the agent's, paraphrased from the saved page text. "Checked" means confirmed in the pinned PoB data
(0.5.4) by a lookup or a grep of `vendor/PathOfBuilding-PoE2/src/`; the guide is 0.5.5, so numbers may have moved.

---

## 1. Header

- **Guide:** "[0.5.5] Grenades Gemling League Starter (Level 1 to Endgame)", by DEADRABB1T.
- **URL:** https://mobalytics.gg/poe-2/builds/deadrabbit-grenades-gemling-league-starter
- **Tab:** Verified. **Favourites:** 1.6K. **Patch:** 0.5.5 (Forbidden Rites). **Updated:** Oct 15, 2026.
- **Tags:** Mercenary, Gemling, Starter, Beginner.
- **Variant tabs, in order:** ACT 1, ACT 2, ACT 3/4, Interludes, Early Endgame, Mid Endgame, Uber Endgame (labelled
  a live build that may change).
- **What the capture couldn't hold:** item affixes; the tree, except its counters (the main one falls from 105 to 3
  of 123, so it reads as points left); the gem priority lists' support steps; the jewels' names; the video. Mid and
  Uber Endgame have no prose, only widgets.

## 2. What the build is

- **Damage source:** crossbow grenades from level 1 to the end, with no bolt skill at any stage.
  - **Explosive Grenade** is the main hit for clear and single target: a fire blast when its 3 s fuse ends, 80% of
    physical converted to fire, 878% of base damage at gem level 20 (checked).
  - **Gas, Flash and Oil Grenades** join it in the campaign.
  - **Cluster Grenade** arrives at level 52: a grenade that bursts into 18 mini grenades (checked).
  - **Mirage Archer** fires Cluster Grenade from Early Endgame.
- **Ascendancy:** Gemling Legionnaire, chiefly for Advanced Thaumaturgy: gem quality grants each skill an extra
  effect.
- **How it kills:** Multishot throws extra grenades, which bounce and detonate on their fuses; Herald of Ash's
  overkill explosions spread ignites through packs. Bosses get the same rotation, plus Oil Grenade's exposure and,
  on the Uber tab, Flash Grenade's armour break.
- **How it plays:** a rotation of five cooldown skills; three tabs remind the reader that Demolitionist pays for
  firing different grenades. The guide's one listed weakness is visual clutter.

## 3. The kit

- **Weapon set 1:** a crossbow all game: rare physical ones crafted at levels 16, 33 and 59 (§5), then a Trarthan
  Cannon (Early Endgame), Redemption, a unique Trarthan Cannon (Mid), and a rare Siege Crossbow (Uber).
- **Weapon set 2:** a Changeling Talisman for Pounce, a werewolf leap that triggers Predator's Mark, or a socketed
  Mark gem instead (checked). It is for movement, and from Act 2 it carries Mark for Death (physical damage breaks
  armour) and Mark of Siphoning (mana leech on attack hits).
- **Grenade cooldowns and stored uses** at the pin (`Data/Skills/act_str.lua`, constant across gem levels,
  checked):

  | Grenade | Cooldown | Uses | Role |
  |---|---|---|---|
  | Explosive | 5 s | 3 | main hit; the kit's only Detonator |
  | Gas | 3 s | 3 | poison cloud (limit 6); a burning effect or a Detonator explodes it as fire |
  | Oil | 4 s | 3 | oil ground: 40% slow, 20% exposure; a Detonator or ignited ground lights it |
  | Flash | 5 s | 1 | blind; 500% more stun buildup |
  | Cluster | 10 s | 1 | the big hit from level 52; Mirage Archer copies it |

- **Supports on the Uber tab:**
  - Explosive: Multishot II, Deliberation, Elemental Armament II, Defy II, Short Fuse I.
  - Cluster: Multishot II, Deliberation, Cooldown Recovery II, Defy II, Vorana's Siege. Vorana's Siege is a lineage
    support: 35% increased area, 20% more hit damage against Isolated enemies (checked).
  - Mirage Archer: Cluster Grenade, Multishot II, Cooldown Recovery II, Prolonged Duration II, Magnified Area II.
  - Gas: Multishot II, Elemental Armament II, Magnified Area II, Corrosion.
  - Flash: Multishot II, Heft, Defy II, Armour Break III, Armour Demolisher II.
  - Oil: Potent Exposure, Magnified Area II, Persistent Ground III, Encroaching Ground, Ignite III.
- **Spirit (flat costs, checked):**
  - Herald of Ash, 30 (Magnified Area II, Swift Affliction II, Fire Mastery). Attrition, 30, is the campaign
    alternative.
  - Mirage Archer, 60. Its Gemling quality line is 40% increased reservation efficiency.
  - Time of Need, 30, with Cooldown Recovery II: periodic healing and removal of curses and elemental ailments.
  - Virtuous Barrier, from Essence of Virtue, appears from Act 2 to Early Endgame, not later.
- **Uniques:**
  - Redemption (Mid Endgame). At the pin it can't load or fire ammunition, has 300–400% increased physical damage,
    no crit damage bonus and 20–40% reduced cooldown recovery. Grenade uses build Explosive Rhythm into Explosive
    Fervour, whose effect has no text in the pin (checked).
  - Constricting Command (helmet, Mid and Uber): fewer enemies needed to count as Surrounded (checked).
  - Headhunter (belt, Uber).
- **Ascendancy order:** Essence of Virtue at levels 22–28; then Advanced Thaumaturgy, Gem Studded, and Implanted Gems
  "last" (+2 levels to skills with a Strength, Dexterity or Intelligence requirement, by mastery; grenades need
  Strength and Dexterity, checked). That Essence of Virtue is later dropped is my inference from the gem panels.
- **The tree:** Demolitionist, Grenadier and Repeating Explosives are named; spare attributes go to Strength.

## 4. The levers

The guide never ranks them. This is the order its text implies.

1. **The weapon.** Physical or elemental damage first, then projectile levels. The Bombard, Cannonade and Siege
   bases all carry "Grenade Skills Fire an additional Projectile" (`Data/Bases/crossbow.lua`, checked). The guide
   doesn't give that as its reason.
2. **Gem levels and quality.** Levels go to Explosive, then Cluster, Gas, Oil and Flash; Gemcutter's Prisms go to
   Explosive, with spares saved for Cluster.
   - Quality powers the Gemling lines. At 20% with Advanced Thaumaturgy (checked):
     - Explosive Grenade fires +2 projectiles;
     - Cluster Grenade gets 40% reduced detonation time;
     - Oil Grenade's exposure lowers resistances by a further 10%;
     - Flash Grenade gains 10% of damage as extra lightning;
     - Gas Grenade deals 20% more fire damage. The guide omits this one.
   - Plain quality gives each grenade 20% increased cooldown recovery.
3. **Different grenades.** Demolitionist gives 4% of damage as extra fire for each different grenade fired in the
   past 8 s (checked): about 20% with all five.
4. **Projectile count.** Multishot II goes on every grenade: 2 more projectiles, 25% less damage and 20% less skill
   speed (checked).
5. **Cooldown uses and recovery.**
   - Grenadier gives grenades +1 cooldown use, and Repeating Explosives a 15% chance to go off a second time
     (checked).
   - Cooldown Recovery II (30% increased) goes on Cluster, the Mirage and Time of Need.
   - Payload, on the Early Endgame tab only, gives a 50% chance of a second activation for 70% reduced cooldown
     recovery (checked). The guide doesn't explain dropping it. My arithmetic, at 65% increased recovery: where the
     cooldown limits, 1.5 × 0.95 ÷ 1.65 is about 0.86, a net loss outside the banked uses.
6. **Exposure.** Frost Bomb applies it until Oil Grenade arrives with the first level-9 gem; Potent Exposure goes on
   Oil from then on.
7. **Damage supports.** Elemental Armament II, Deliberation (20% more damage, slower movement while using the skill,
   checked), Fire Attunement, Fire Penetration II and Defy II (lucky hit damage).

**What it skips:** bolts and reloads, crit (Redemption removes the crit damage bonus), and Payload after Early
Endgame. Pounce stays at gem level 3.

## 5. Leveling

- **ACT 1.**
  - Gems: Explosive Grenade from Renly's quest; Frost Bomb from the Clearfell campsite, for exposure; Flash Grenade
    and Pounce as the first two level-3 gems; Herald of Ash from Freythorn, or Attrition; Gas Grenade as the level-5
    gem from Leitis' quest.
  - Supports: Multishot I on each damage grenade, Elemental Armament I on Explosive and Gas, and Magnified Area I and
    Swift Affliction I on the Herald.
  - Gear: a Tense Crossbow from the Red Vale's weapon racks; movement boots, flat-damage gloves and Iron Rings from
    vendors, with a vendor regex.
- **ACT 2.**
  - At level 16, craft or gamble a Varnished Crossbow at the Ardura Caravan, saving Act 1's currency for it.
  - Supports go to tier II; the marks join Pounce; Virtuous Barrier comes with the first ascension.
  - The first Lesser Jeweller's Orb opens a Fire Attunement socket on Explosive, the second Magnified Area I on Gas.
- **ACT 3/4.**
  - At level 33, at the Ziggurat Encampment, craft a Bombard Crossbow: from a white base with transmutes, augments,
    regals, essences and a Jawbone, or with an Essence of Abrasion on a good magic base.
  - Oil Grenade (Potent Exposure, Persistent Ground I) replaces Frost Bomb. Gas gets Deliberation, Flash gets Stun
    I, and Attrition or Herald of Ash comes with Act 3's Spirit.
- **Interludes.**
  - Cluster Grenade at level 52, with the first level-13 gem (Multishot II, Cooldown Recovery II, Deliberation,
    Short Fuse I). Oil gets Ignite II.
  - At level 59, a crafted Cannonade Crossbow (steps credited to another creator). From here the setup changes
    little and carries well into maps, the guide says.

## 6. Gear and budget

- **Progression:**
  - Campaign: armour bases. The body armour goes Chain Mail, Raider Plate, Explorer Armour.
  - Early Endgame: a Trarthan Cannon, a Solar Amulet (a Spirit implicit, checked) and an Ornate Plate.
  - Mid Endgame: Redemption, Constricting Command, a Soldier Cuirass, a Mail Belt and jewels.
  - Uber Endgame: a Siege Crossbow, a Lunar Amulet, Vaal Mitts and Headhunter.
- **Stat priorities**, the same on every tab: damage, then projectile levels on the crossbow; flat damage on gloves
  and rings; movement speed on boots; life, armour and resistances on body and helmet; projectile levels on the
  amulet; life and Strength on the belt.
- **Budget:** never given in currency. The guide calls the build cheap and gear-light, yet it crafts three
  crossbows. The expensive pieces are Headhunter, Redemption, Constricting Command and a level-79 Siege Crossbow.
  On the campaign tabs the numbered equipment list puts the crossbow last, against the prose's weapon-first rule.

## 7. Defences

- **Layers:**
  - armour bases, "by far the strongest" defensively in the campaign;
  - life and resistances on every slot;
  - Gem Studded's red line;
  - Virtuous Barrier, then Time of Need;
  - control: Flash Grenade's blind and stun, and Oil's 40% slow (checked);
  - Mark of Siphoning's mana leech.
- **Quest picks:** a charm slot, stun threshold, 30% increased global defences and the +5% resistances.
- **No numbers:** no armour, life or max-hit figures.
- **A correction.** The guide calls Gem Studded complete crit immunity. At the pin its red line reads "Hits against
  you have no Critical Damage Bonus" (checked): crits still land, without the extra damage.
- **Gem Studded's colours.** It grants the line for each support colour that is most numerous, and the guide implies
  all three. Counting the panels by the pin's gem colours, lineage supports aside:
  - Uber: 12 red, 12 green, 7 blue, so it loses blue's 30% less cost;
  - Mid: 11 red, 10 green, 7 blue, so red alone.
  - PoB applies only one colour on a tie, red first (PG-1, the colour-tie gap).

## 8. What players pick

The guide says nothing about what most players do. Its only signals: its own labels (Beginner, Starter, probably
among the strongest league starters); Herald of Ash or Attrition at the reader's choice; crafting steps borrowed
from another creator; and the page's standing (Verified, 1.6K favourites, one of five featured builds, one live
level-98 character).

## 9. For the library

**Kit lines for Crossbows**, best first. The current kit covers bolts only; these would add a grenade kit.

- **Grenade kit:** (1.6K favourites) five crossbow grenades from level 1 and no bolt skill: Explosive Grenade as the
  main hit, then Flash, Gas and Oil, Cluster Grenade at 52, and Mirage Archer firing Cluster in the endgame
  [mob-grenades] §2, §3. *Checked (names).*
- **Cooldowns, not ammo:** each grenade has a cooldown and stored uses (Explosive 5 s ×3, Gas 3 s ×3, Oil 4 s ×3,
  Flash 5 s ×1, Cluster 10 s ×1; pin: `Data/Skills/act_str.lua`), so the levers are Grenadier's +1 use,
  Cooldown Recovery II and quality's 20% recovery [mob-grenades] §3, §4. *Checked.*
- **Variety:** Demolitionist, 4% of damage as extra fire per different grenade fired in 8 s, about 20% with five, so
  the build rotates every grenade instead of spamming one [mob-grenades] §4. *Checked.*
- **Projectiles:** Multishot II on every grenade, and the Bombard, Cannonade and Siege bases, whose implicit adds a
  grenade projectile (pin: `Data/Bases/crossbow.lua`) [mob-grenades] §4. *Checked; the guide's reason is
  unstated.*
- **Gemling:** Advanced Thaumaturgy's grenade quality lines, Explosive's +2 projectiles first [mob-grenades] §4.
  *Checked.*
- **Exposure:** Oil Grenade with Potent Exposure, replacing Frost Bomb from level-9 gems [mob-grenades] §5.
  *Checked.*
- **Spirit:** Herald of Ash 30, Mirage Archer 60, Time of Need 30 [mob-grenades] §3. *Checked.*
- **Not the bolt kit:** none of Fresh Clip II, Rapid Attacks II or Emergency Reload appears. The kit's "grenades on
  weapon set 2" is reversed here: grenades on set 1, a Talisman's Pounce on set 2 [mob-grenades] §3.

**Pattern shapes:**

- **A count as a multiplier** (existing): Demolitionist's grenade count; each step costs a skill and its supports.
  PoB: a config stand-in, `# different Grenade Types Shot` (`Modules/ConfigOptions.lua:1642`), capped at the
  build's distinct grenade skills (`Modules/CalcPerform.lua:1354–1358`), so Mirage Archer's Cluster adds no step.
  *Checked.*
- **Placed detonator** (existing): Gas clouds and oil ground are placed, and Explosive Grenade, a Detonator, explodes
  the gas and lights the oil, whose ignite gains 150% of Oil's fire damage as unscalable damage. *Gem text checked;
  the guide never describes this, so it is unverified as play.*
- **Cooldown recovery as DPS** (existing): every grenade is held by its cooldown; Payload trades recovery for
  repeats (§4). *Checked.*
- **Proxy multiplier** (existing): Mirage Archer re-fires Cluster on each dodge roll for 6 s at 30% less damage
  (checked). PoB: the mirage count is set by hand (PG-4) and coverage wrongly reports Mirage Archer as modelled
  (PG-49).
- **Repeat chance** (new, or a note under Proxy multiplier): "activate a second time" from Repeating Explosives
  (15%) and Payload (50%). PoB models it, capped at 100% (`Modules/CalcOffence.lua:1130`). *Checked.*
- **Forced condition** (existing): Constricting Command lowers the Surrounded threshold, and Defy II (Explosive,
  Cluster, Flash) lets a skill be used without enough mana while Surrounded, and makes hits lucky (checked). *The
  pairing is my inference; the guide explains neither.*
- **Weapon set 2 job** (existing): a Talisman's Pounce for movement and a mark that carries Mark for Death and Mark
  of Siphoning. *Checked (Pounce's text).*

**What PoB might not model:**

- grenade lines PoB marks unsupported (coverage): "Consumes 15 Heat" on Explosive and Cluster, which the guide never
  mentions; Oil Ground's ignite addition and slow; Gas Grenade's cloud limit and radius growth;
- Redemption's Explosive Fervour, which has no effect text in the pin;
- Gem Studded's ties, one colour only (PG-1);
- not established: whether PoB's DPS respects the cooldowns, and whether a Detonator setting off gas and oil is
  modelled.
