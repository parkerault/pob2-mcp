# Mattjestic's pure-summoner Infernalist (Mobalytics)

An agent's study report (2026-10-18), guide 1 of the Mobalytics review. Brief:
`briefs/2026-10-18-mobalytics-review.md`. Cited as `[mob-mattjestic]`.
Its claims are the agent's. **Checked** means confirmed in the pinned data (PoB 0.5.4), by a lookup or a grep of
`vendor/PathOfBuilding-PoE2/src/` ("pin:"); **unverified** means read off the page's widgets or inferred.

---

## 1. Header

- **Guide:** "0.5 FASTEST Minions Leveling & Mapping PURE SUMMONER Build!" by Mattjestic,
  https://mobalytics.gg/poe-2/builds/god-slayer-minions-mattjestic.
- **Tab:** Creator. **Favourites:** 1.6K. **Updated:** May 31, 2026. **Patch:** the title says 0.5; the tag row
  reads "0.5.5 FR". Tags: Witch, Infernalist, Starter, Speed Leveling.
- **Variant tabs, in order:** (Witch Path) Act 1 → Act 2-3 (infernalist) → Act 3-5 & Early Mapping → Meele
  Splash: Early Mapping → T10+ (5 Div Setup). Act 1 is the default.
- **Prose:** none beyond a five-item strengths list.
- **What the capture couldn't hold:** item affixes (base names only), so no minion levels, Spirit rolls or
  resistances from rares; the passive tree and ascendancy order, beyond the points-left counters; the spectre's
  monster (every spectre group reads "Spectre: {0}", the gem's own name template, pin:
  `Data/Skills/act_int.lua`); the support steps of the gem order (unlabelled numbers); the jewels (a label
  only); the video, PoB code and build file.

## 2. What the build is

- **Damage source:** minions only. From the Meele Splash tab on, the player casts no damage skill (checked
  against the gem panels).
- **Campaign: fire.** Raging Spirits is a 30-Spirit persistent buff: fire spells you cast summon short-lived
  flaming skulls, one per 1.5 m of an area spell's radius, at most two per cast (pin). Flame Wall feeds it,
  with Fortress I making the wall a circle (pin) and, from Act 2, Rapid Casting I for more casts. Skeletal
  Arsonists, the Infernal Hound's ignite, Fire Attunement, Fire Exposure and Elemental Weakness complete the
  fire kit. Contagion heads the Act 1 gem order: the player's own damage until minions arrive. (Gem text
  checked; the play is inferred.)
- **Mapping: physical.** A spectre with Brutality III, Feeding Frenzy II, Rapid Attacks II, Muster and Minion
  Splash II (its strikes gain melee splash, pin), so a melee striker, with ranged skeletons (Sniper, Storm Mage,
  Arsonist) beside it; Vulnerability replaces Elemental Weakness. That the spectre deals most of the damage is
  unverified; it carries the heaviest support load.
- **Ascendancy:** Infernalist. Loyal Hellhound grants Summon Infernal Hound (checked), the first group in the
  Act 2-3 tab, so it is the first pick (inferred); the rest of the order isn't captured.
- **Packs and bosses:** the page doesn't say.
- **How it plays:** easy, cheap and good for the move into endgame, per its strengths list; slower than ranger
  builds, and minions path badly in tight areas.

## 3. The kit

**Weapon and off hand.** A Rattling Sceptre in every tab: 100 Spirit and a granted Skeletal Warrior, level 1–20
by item (pin). The Warrior's panel reads 3 → 3 → 10 → 14 → 14, presumably as better sceptres replace it, and
it is missing from the Act 1 gem order: there is no gem to buy. A Twig Focus in Act 1 only; from Act 2-3 a
tower shield (Effigial → Bulwark → Runeforged Bulwark), each granting Raise Shield (pin). From Meele Splash,
weapon set 2 holds a Chiming Staff, whose granted Sigil of Power (level 14) is a spell-damage buff for you and
allies standing in it, stronger with mana spent there (pin).

**The minion kit by tab** (gem levels as listed; — is absent):

| Group, base Spirit | Act 1 | Act 2-3 | Act 3-5 | Melee Splash | T10+ |
|---|---|---|---|---|---|
| Skeletal Warrior (sceptre), 60 | 3 | 3 | 10 | 14 | 14 |
| Raging Spirits, 30 | 4 | 9 | 13 | — | — |
| Skeletal Arsonist, 90 | 5 | 8 | — | 14 | 16 |
| Unearth (temporary) | 4 | 7 | — | 14 | 16 |
| Infernal Hound (ascendancy), 0 | — | 9 | 14 | 16 | 19 |
| Spectre, 16–127 | — | — | 12 | 14 | 18 |
| Skeletal Cleric, 60 | — | — | — | 14 | 16 |
| Skeletal Frost Mage, 120 | — | — | — | 13 | 16 |
| Skeletal Sniper, 90 | — | — | — | 14 | 16 |
| Skeletal Storm Mage, 120 | — | — | — | 14 | 14 |
| Reviving types | 2 | 3 | 3 | 8 | 8 |
| Base Spirit reserved | 180 | 180 | 90 + spectre | 540 + spectre | 540 + spectre |
| Spirit on visible bases | 100 | 200 | 210–215 | 210–215 | 100 |

Spirit costs are flat at every level (pin: `Data/Skills/act_int.lua`); a spectre's is set by its monster, 16–127,
median 57 (`Data/Spectres.lua`). The skeletons, Hound and spectre are Reviving (pin); Raging Spirits and
Unearth's constructs aren't. Visible Spirit: the sceptre's 100, Enfolding Dawn's 100, the Solar Amulet's 10–15.

**Supports, as they grow.**
- **Damage dealers.** Act 1: Rapid Attacks I on Raging Spirits; Multishot I and Magnified Area I on the
  Arsonist; Act 2-3 adds Fire Attunement to both. Act 3-5: Feeding Frenzy II (minions deal and take more
  damage, pin) and Prolonged Duration II on Raging Spirits; the first spectre is a fire projectile setup (Fire
  Attunement, Multishot I, Rapid Attacks II, Feeding Frenzy I). Meele Splash: the melee spectre setup above;
  Sniper with Rapid Attacks I and Feeding Frenzy II; Storm Mage with Feeding Frenzy I and Overcharge. T10+:
  Heft (30% more maximum physical hit damage, pin) replaces Minion Splash II; Armour Break I moves from Unearth
  to the Sniper; the Arsonist keeps only Magnified Area I.
- **Front line.** The Hound: Loyalty and Meat Shield I, then Meat Shield II and Fire Exposure, then Last Gasp;
  at T10+ Romira's Requital, Meat Shield II, Minion Mastery and Last Gasp. The Warrior: Sacrificial Lamb I and
  Meat Shield I; at T10+ Amanamu's Tithe, Infernal Legion II and Sacrificial Lamb II. The Cleric: Rapid Casting
  I and Meat Shield I. The Frost Mage has no support in either tab.
- **Offering and curse.** Pain Offering from Act 2-3 with Prolonged Duration and Danse Macabre, plus
  Sacrificial Offering from Act 3-5. Elemental Weakness with Focused and Heightened Curse, then Vulnerability
  with the same two plus Efficiency II.
- **Campaign extras.** Contagion with Profanity I (Act 1, 2-3); Unearth with Prolonged Duration I; Eternal
  March (Act 2-3, 3-5), which spends Runic Ward to revive minions (pin).

**Uniques.** Enfolding Dawn (pin: +100 Spirit, 50–100% increased armour and energy shield, +5–15% to all
elemental resistances, no inherent bonus from Intelligence), Act 2-3 to Meele Splash. Bones of Ullr (pin: 5–15%
movement speed, +20–40 life, 20–30% increased reservation efficiency of skills that create undead minions),
Act 2-3 to T10+. No other unique appears.

**Tree.** The main counter reads 103, 80, 38, 31 and 20 of 123: as points left, about 20, 43, 85, 92 and 103
allocated (unverified reading). Both weapon-set counters stay at 20 of 20. No direction is readable.

## 4. The levers

The page ranks no damage levers. What the widgets show:
1. **Minion types.** Reviving types go 2 → 3 → 3 → 8 → 8, and Muster joins at eight: 7% more per reviving type
   (pin), about ×1.56. The Frost Mage, unsupported and missing from both gem orders, looks kept for the count
   (inferred). The spectre carries five supports, the most of any group.
2. **Pain Offering and the curse,** from Act 2-3 on; at level 20 the offering grants minions 58% increased
   damage and 29% attack and cast speed (pin).
3. **Spirit.** Enfolding Dawn, Bones of Ullr and the Solar Amulet arrive as the types grow.

The gem order puts the Hound and Warrior first from Act 2-3, and the spectre near the end (step 23 of 27). The
equipment order puts the helmet first and the sceptre second in every tab; whether that is the author's
ranking or the site's default isn't clear.

**What it drops** (an implicit skip list): Contagion and the Arsonist at Act 3-5 (the Arsonist returns at
Meele Splash); Raging Spirits, Flame Wall, Elemental Weakness and Eternal March at Meele Splash; Enfolding Dawn
at T10+.

## 5. Leveling

- **Act 1.** Campaign bases (Iron Crown, Twig Focus, Lapis Amulet, Leather Vest) and the sceptre; Contagion,
  Raging Spirits through Flame Wall, Arsonists, Unearth.
- **Act 2-3 (Infernalist).** The Hound, a tower shield, Enfolding Dawn, Bones of Ullr (level 16, pin), Pain
  Offering, Elemental Weakness, Eternal March; jewels appear.
- **Act 3-5 & Early Mapping.** The first spectre replaces the Arsonist; Contagion and Unearth leave.
  Runeforged Jungle Tiara (level 59, pin) and Spiral Wraps, Bulwark Tower Shield, Solar Amulet, Prismatic and
  Topaz rings. The tab runs into early maps.
- **Meele Splash: Early Mapping.** The pivot to physical: the melee spectre with Muster; Cleric, Frost Mage,
  Sniper and Storm Mage join, the Arsonist and Unearth return; Vulnerability; the Chiming Staff. Gear otherwise
  unchanged.
- **Attributes** (support requirements, Str/Dex/Int): 5/10/15 → 35/10/45 → 35/10/50 → 50/20/65 → 50/10/75.
- **Quest rewards:** the Act 2 Medallion lists both options (charm duration, a charm slot), so the pick is
  unclear; Act 3: elemental ailment threshold; Act 4 Goddess of Justice: flask life recovery; the rest are not
  specified.

## 6. Gear and budget

- **T10+ (5 Div Setup):** Runeforged helmet, shield, body (Utzaal Cuirass) and gloves, Sapphire and Iron
  rings, a Pearlescent Amulet, Bones of Ullr, the sceptre and staff.
- **Stat priorities:** none given. The chosen implicits are resistances (the rings; Pearlescent's +7–10% to all
  elemental) and Spirit (Solar Amulet) (pin).
- **Strength:** the endgame bases are strength armour (Utzaal Cuirass needs 121, pin); where a Witch finds it
  isn't shown.
- **Expensive pieces:** none named; the budget is the tab's "5 Div" label. The lineage supports (Romira's
  Requital, Amanamu's Tithe) appear only at T10+.
- **The Spirit gap** (unverified): at Meele Splash and T10+ the listed groups reserve about 600 base Spirit
  against 100–215 on visible bases. Bones of Ullr cuts the skeletons' share by about a quarter, if efficiency
  divides the cost, still leaving about 250–370 to come from rare rolls (sceptre, amulet, body), the tree or
  Beidat's Will (an Infernalist node: +1 Spirit per 25 maximum life for 25% of life reserved, checked), none of
  which the capture shows. For scale, the library's Navira guide runs 334 Spirit.

## 7. Defences

No numbers anywhere. The layers, from the widgets:
- **Block:** a tower shield and Raise Shield from Act 2-3.
- **Runic Ward:** the Runeforged bases carry it (pin: Jungle Tiara 104, Spiral Wraps 24; at T10+ helmet 49,
  shield 53, body 107, gloves 63). Eternal March, while carried, spends it to revive minions (pin).
- **Armour:** Enfolding Dawn, then strength armour bases at T10+.
- **Minions as a buffer:** Loyalty and Romira's Requital take 10% of hit damage from the Hound's life before
  yours, at 30% less minion life; Romira's recoups 200% of it as life (pin). Meat Shield II: 40% less damage
  taken and dealt (pin). The Cleric heals minions and revives skeletons (pin).
- **Resistances:** ring and amulet implicits and Enfolding Dawn; Blind II on Unearth at T10+.

## 8. What players pick

The page never says what is standard or common; the signals are its 1.6K favourites and Starter tag. Against
the library's Minions kit:
- **Agrees:** a sceptre throughout, about eight types with Muster (as Navira's), Pain Offering, and Spirit added
  as types grow.
- **Differs:** no focus after Act 1 (a tower shield gives block, armour and Ward instead of the focus's minion
  levels); the endgame carrier is a spectre, not a skeleton; Brute and Reaver go unused; and the campaign runs
  on fire minions, not the endgame's damage type.

## 9. For the library

**Kit lines** (Minions):
- **A popular kit:** Mattjestic's Infernalist (1.6K favourites) keeps a Rattling Sceptre (100 Spirit, its own
  Skeletal Warrior) all game, trades the focus for a tower shield from Act 2, and adds Enfolding Dawn (+100
  Spirit) and Bones of Ullr (undead-minion reservation efficiency) by Act 2–3 [mob-mattjestic] §3. Checked;
  affixes unseen.
- **Types:** eight reviving types at mapping (the Infernal Hound, every skeleton but Brute and Reaver, a
  spectre), with Muster on the spectre, about ×1.56 [mob-mattjestic] §3, §4. Checked.
- **Carrier:** a melee spectre with Brutality III, Feeding Frenzy II, Rapid Attacks II, Muster and Minion
  Splash II (Heft at T10+), with Vulnerability [mob-mattjestic] §2, §3. Supports checked; monster unverified.
- **Campaign:** fire minions: Raging Spirits (30 Spirit; your fire casts summon skulls, two a cast) fed by Flame
  Wall with Fortress I and Rapid Casting I, Arsonists, Contagion first; physical at mapping [mob-mattjestic] §2,
  §5. Gem text checked; play inferred.
- **Spirit:** the mapping zoo reserves about 600 base Spirit against 100–215 on visible bases; budget the rest
  from rare rolls, Beidat's Will or efficiency [mob-mattjestic] §6. Arithmetic checked; sources unverified.
- **Buff and curse:** Pain Offering with Danse Macabre and Sacrificial Offering from Act 2; Focused and
  Heightened Curse [mob-mattjestic] §3. Checked.
- **Survival:** Meat Shield on the front line, Loyalty then Romira's Requital on the Hound, Runeforged armour
  (Runic Ward) and a tower shield [mob-mattjestic] §7. Checked.
- **Weapon set 2:** a Chiming Staff for Sigil of Power [mob-mattjestic] §3. Checked; its use to minions
  unverified.

**Pattern shapes:**
- **A count as a multiplier** (existing): eight reviving types with Muster, a new example. **Filler to satisfy a
  count** (existing): the unsupported Frost Mage (inferred).
- **Skill granted by an item base** (existing): the sceptre's Warrior as a free type, the staff's Sigil.
  **Weapon set 2 job** (existing): the Chiming Staff.
- **Inputs and outputs** (existing): your fire casts supply Raging Spirits, so cast rate and wall radius set
  the skull count; could stand alone as "casts as minion supply" (new).
- **Off-tree defence layer** (existing): Runeforged Ward, which here also fuels Eternal March.
- **New, unverified: steer the offering.** Sacrificial Lamb makes your skills target the supported minions
  within 6 m (pin), so Pain Offering likely picks the cheap Warrior or Storm Mage, not the carrier.
- **New: minion as damage buffer.** Loyalty-type supports move a share of your hits onto a reviving companion.
- **New: damage-type pivot.** The campaign's fire kit is replaced wholesale at mapping; a leveling plan needn't
  share the endgame's damage type.

**What PoB might not model** (coverage, checked): Raging Spirits' summons per cast and its two-per-cast cap;
Minion Splash's melee splash; the Hound's and Infernal Legion II's ignite auras; Danse Macabre's extra target
(its 30% more damage and buff effect are parsed); Romira's recoup; Amanamu's Tithe; Last Gasp; Sacrificial
Lamb (no stat map). Muster is parsed but counts high (PG-3, PG-53). Not established: Eternal March, Sigil of
Power's mana ramp, and the spectre, which PoB needs named.
