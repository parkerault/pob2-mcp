# Ronarray's Storm Wave + Flicker Invoker (Mobalytics)

A study for the pattern library (brief: `briefs/2026-10-18-mobalytics-review.md`), written 2026-10-18 from the page
text saved that day, paraphrased. Cited as `[mob-invoker]`. "Checked" means a pob2 lookup or a grep of the pinned
data (`vendor/PathOfBuilding-PoE2/src/`, pin 0.5.4) confirmed the line; the rest is the guide's claim.

## 1. Header

- **Guide:** "[0.5] NUKE Storm Wave + Flicker Invoker Build (T4 Simu / T4 Bosses / All Content)" by Ronarray,
  https://mobalytics.gg/poe-2/builds/coc-balls-invoker-ronarray. Verified tab, tagged End Game and Starter.
- **Favourites:** 11.6K, the most in this review; 0 comments. **Updated:** May 24, 2026.
- **Patch:** the title says 0.5, the intro 0.4 and 0.5 with few 0.5 changes, a badge 0.5.5; some notes date from
  0.2 and 0.3.
- **Variant tabs:** ES (Main Version) → T4 Bosses Swap (1 Item + 1 Gem) → Full Tank (T4 Simu) → Old Version
  (Legacy, the 0.2 build).
- **Not captured:** item affixes; the tree (only counters: 123 main points, 20 per weapon set); supports in the
  numbered gem order (icons); quest rewards (all "Not Specified"); the video; the linked leveling guide.
- **Rough edges:** the boss tab's prose names Upheaval and Voltaic Mark where its panel has Branching Fissures II and
  Profane Ritual; the main tab's prose names Pinpoint Critical, its panel Rapid Attacks II; "Inevitable Critical"
  is Inexorable Critical (the pin has only I and II, checked); the boss swap changes two items, not one.

## 2. What the build is

- **Damage:** quarterstaff attacks, lightning crit. Storm Wave (a wave that converts 80% of physical to lightning,
  100% more chance to shock, checked) clears with Herald of Ash and Herald of Thunder. Flicker Strike, which
  teleports and strikes 2 more times per Power Charge (checked), kills bosses and tough rares after Charged Staff,
  Infernal Cry and Unbound Avatar buff it.
- **Ascendancy:** Invoker. Sunder my Enemies... makes crits ignore enemy elemental resistances that aren't negative
  (checked), so crit chance doubles as penetration and capping it is the build's centre. I am the Thunder... adds
  10% of damage as extra lightning; Lead me through Grace... gives 1 Spirit per 8 energy shield on the body armour
  and none from gear; ...and I Shall Rage grants Unbound Avatar, which the guide names instead (all checked).
- **Packs:** Storm Wave at about 90% crit, with Herald explosions; never Flicker into packs.
- **Bosses:** a set-up ritual (§3), then Unbound Avatar, Infernal Cry twice, Flicker. It claims tier-4 pinnacle
  one-shots, with no numbers.
- **Feel:** two clear buttons, a weapon swap and a scripted boss opener; its own cons are mana and set-up.

## 3. The kit

**Weapons.** Set 1: a Sinister Quarterstaff with at least 11% base crit. Set 2: a Rattling Sceptre for Skeletal
Warriors, and Redblade Banner, which the guide says improves Infernal Cry.

**Groups (main tab).**

| Group | Supports | Set | Job |
|---|---|---|---|
| Storm Wave | Lightning Attunement, Branching Fissures II, Deliberation, Elemental Armament II, Rapid Attacks II | 1 | clear |
| Flicker Strike | Perpetual Charge, Overextend, Ambrosia, Garukhan's Resolve, Excise | | boss burst |
| Charged Staff | Culling Strike II, Prolonged Duration II, Innervate, Lightning Attunement | | charge buff |
| Herald of Ash | Magnified Area I, Fire Mastery | 1 | clear |
| Herald of Thunder | Longshot I, Lightning Attunement, Elemental Armament II | 1 | clear |
| Infernal Cry | Raging Cry, Enraged Warcry I, Second Wind I | 2 | boss buff |
| Profane Ritual | Charge Profusion II, Unleash | 2 | boss charges |
| Sacrifice | Corpse Conservation | both | corpses |
| Skeletal Warrior | | 2 | corpses |
| Cast on Critical | Profane Ritual, Overabundance I, Efficiency II, Boundless Energy II | 1 | map charges |

Ten groups need an Unset Ring, whose implicit grants a skill slot (checked, `Data/Bases/ring.lua:85`).

**What triggers what.**
- **In maps:** crits fill Cast on Critical's Energy; at maximum it casts Profane Ritual, which marks a corpse and,
  when the ritual ends, consumes it for a Power Charge (checked). The charges keep Charged Staff up (1–22 added
  lightning per charge consumed, 6 s of buff per charge, checked) and pay for Flicker on map bosses.
- **Energy limits (checked):** 1 Energy per Power of the enemy crit, scaled by the share of its ailment threshold
  the crit deals; 57% increased at gem level 20, plus 45% from Boundless Energy II. The maximum is 10 Energy per
  0.1 s of the socketed spell's base cast time, 1 s for Profane Ritual (pin: `Data/Skills/act_int.lua`), so 100 per
  trigger. Its text shows no cooldown; the other limits are corpses and 5 active rituals. Overabundance I adds
  one ritual and halves the 2 s duration (pin: `Data/Skills/sup_dex.lua`). The trigger's 20% less damage is free:
  the ritual is there for its charge.
- **Before bosses:** swap to set 2 to raise the skeletons. Sacrifice, a persistent buff that must be active in both
  weapon sets (checked), lets reviving undead minions stand in for corpses. Cast Profane Ritual on them (Unleash
  repeats it) to the maximum, usually 6–7 charges; cast Charged Staff; refill; then the opener.
- **Set rules:** Cast on Critical and the Heralds on set 1, Profane Ritual and Infernal Cry on set 2. Without the
  spare slot, drop Cast on Critical (the swap ritual still works), or socket Infernal Cry over a Herald for
  pinnacles.

**Spirit** comes from body energy shield; short of it, drop the persistent supports Precision, then Herbalism,
then Clarity (prose only). Blink may replace Sacrifice for mapping.

**Uniques:** Headhunter (best belt), Shavronne's Satchel on a budget, Darkness Enthroned for damage; Olroth's
Resolve; Heart of the Well (Rage); Against the Darkness (extra lightning); Powertread for pinnacles.

**Ascendancy order** (main, boss and legacy tabs): Sunder my Enemies → I am the Thunder → Lead me through Grace
→ Unbound Avatar.

**Tree:** lightning crit, chance before damage until capped; both charge notables early; Chaos Inoculation (life
1, chaos immunity) with energy shield and evasion; Conservative Casting for mana; anoint Stormcharged (8%
elemental penetration, 5% elemental attack and cast speed, checked).

## 4. The levers

In the guide's order:
1. **Crit chance to the cap:** weapon base 11%+, helmet 20%+, amulet, jewels, every crit node on the way; about 90%
   on Storm Wave with Pinpoint Critical, about 100% on Flicker with Excise and Inexorable Critical. With Sunder, a
   crit is also resistance ignore.
2. **+melee skill levels**, the top affix on weapon, gloves and amulet.
3. **Crit damage:** Soul Core of Ticaba (Greater Iron Rune on a budget).
4. **Maximum Power Charges:** Overflowing Power (+2) and The Power Within (+1, checked, `TreeData/0_5/tree.lua`);
   each charge adds Charged Staff lightning and two Flicker strikes.
5. **Flat lightning** on rings, lightning or fire on gloves, extra-lightning jewels.
6. **Pinnacle burst:** Unbound Avatar (40% more elemental damage for about 10 s, once ailments fill it, checked),
   Infernal Cry twice, Overcharge on Charged Staff, Powertread.

**Excise** gives crit for an 8 s cooldown (checked), free on a once-per-fight skill. **Garukhan's Resolve** caps
crit at 50% and makes attack crit chance bifurcate (checked; the pin's mod ids call it rolling crit twice). The
guide says it helps reach 100% if you are capped without it; the Martial Artist videos said to stay at or under
50% with it [ronarray-videos] §1. Unverified. The pin says Excise adds the Cooldown type, which Garukhan's Resolve
excludes (`Data/Skills/sup_int.lua:4517`; gem lookup), so the main tab's Flicker pairs two supports that can't
both apply; the other tabs pair Excise with Inexorable Critical I.

**Skippable:** attack speed; Maiming Strike, Pure Energy, One with the Storm and small defence nodes when short of
points; Throatseeker, for small crit nodes; the crit supports, once the weapon caps crit.

## 5. Leveling

None on the page: it links a separate league-start guide (not saved). The numbered gem order puts Herald of Ash,
Storm Wave and Cast on Critical (step 5) first, then Charged Staff, Herald of Thunder, Sacrifice and Profane Ritual
(18–19), Flicker (21) and Infernal Cry (26).

Between tabs:
- **Boss swap:** Powertread, Overcharge on Charged Staff (not for mapping), Unbound Avatar socketed, Pinpoint
  Critical, Inexorable Critical I for Garukhan's Resolve; the panel also shows an Ingenuity belt.
- **Full Tank** (tier-4 Simulacrum): Cast on Critical and Infernal Cry make way for Blasphemy with Temporal Chains,
  Wind Dancer and a Convalescence group; the tree trades the charge nodes for evasion and energy shield, since
  charges can't be made reliably there.
- **Legacy (0.2):** Tempest Flurry and Tempest Bell crits fed Cast on Critical with Comet against bosses; Storm Wave
  with Upheaval and Ambush cleared. The guide says Cast on Shock lost energy in 0.2. Short of Spirit, Cast on
  Critical ran only for pinnacles, replacing both Heralds.

## 6. Gear and budget

- **Main:** rares around Headhunter. The upgrade order starts with set 2's banner, then the quarterstaff and
  sceptre.
- **Per slot:** weapon (melee levels > crit chance > crit damage > DPS); body (energy shield, for Spirit); helmet
  (350–400 energy shield, 20%+ crit); gloves (melee levels >> lightning or fire >> attack speed); boots (25%+
  movement speed, 250+ energy shield); amulet (melee levels > crit > energy shield); rings (flat lightning, one with
  mana); jewels (two or three with 2% mana on kill).
- **Belt:** the tank tab prefers the Satchel, saying Ingenuity now gives only 5–10% DPS.
- **Legacy:** Subterfuge Mask anointed (its main evasion), mana-regeneration rings, a stun-threshold jewel.
- **Expensive:** Headhunter, Powertread, Olroth's Resolve, Ticaba cores. No currency figures.

## 7. Defences

- **Layers:** Chaos Inoculation on energy shield with some evasion. The strengths list claims chaos and
  damage-over-time immunity; the second is unverified.
- **Recovery:** recharge after about 2 s; the Satchel applies life flasks to energy shield with an instant-recovery
  flask or Olroth's Resolve, tapped several times; Herbalism helps.
- **Stun and freeze:** Dampening Shield, an 8% small node near Chaos Inoculation, Stone and Thawing Charms, then
  Abasement and Shimmering Mirage.
- **Mana:** mana-on-kill jewels, Clarity, ring mana, Conservative Casting; a mana flask of about 120 charges for
  Ambrosia.
- **Numbers:** helmet and boots energy shield, 25% movement speed. No pool, resistances or maximum hit.

## 8. What players pick

Only the author's picks, never what most players run: Headhunter and Olroth's Resolve as the best; energy shield
alone on the helmet is "usually recommended"; Garukhan's Resolve strongly recommended; Blasphemy with Temporal
Chains plus Wind Dancer as the best Simulacrum pair. The intro recommends the author's Dragon Monk for 0.5 instead.
The 11.6K favourites is the only popularity signal.

## 9. For the library

**Kit lines (Quarterstaves unless named):**
1. **Kit:** ronarray's Storm Wave + Flicker Invoker (11.6K favourites): Storm Wave and the two Heralds to clear;
   Flicker Strike on bosses after Charged Staff, Infernal Cry and Unbound Avatar [mob-invoker] §2, §3. *Checked
   (names).*
2. **Levers:** crit to the cap, about 90% on the clear skill and 100% on the boss skill (Excise, Inexorable
   Critical); Invoker's Sunder my Enemies makes crits ignore non-negative elemental resistances [mob-invoker] §4.
   *Node checked; percentages unverified.*
3. **Levels:** melee levels before crit chance before crit damage, from 11% base crit [mob-invoker] §4.
   *Unverified.*
4. **Charges:** maximum Power Charges (Overflowing Power +2, The Power Within +1, pin: `TreeData/0_5/tree.lua`)
   raise Charged Staff's lightning and Flicker's strikes, 2 per charge [mob-invoker] §4. *Checked.*
5. **Spells, Crit:** on an attack build, Cast on Critical triggers Profane Ritual for a Power Charge per corpse;
   its Energy cap is 10 per 0.1 s of the spell's base cast time, 100 for the ritual [mob-invoker] §3. *Checked;
   rate unverified.*
6. **Weapon set 2:** a sceptre's skeletons serve as corpses through Sacrifice, active in both sets, for charges
   before a boss [mob-invoker] §3. *Checked (gem text).*
7. **Attacks, any weapon, Slots:** about ten groups need an Unset Ring's skill slot (pin:
   `Data/Bases/ring.lua:85`) [mob-invoker] §3. *Checked.*

**Against the kits.** The Quarterstaves kit is ronarray's Martial Artist [ronarray-page]. The two guides share a
staff with a crit floor (10% there, 11% here) and melee levels, Herald of Ash among the Heralds, Power Charges
filled before the boss then Charged Staff then a burst (Killing Palm's bells there, the set-2 ritual here), Chaos
Inoculation with the Satchel and an instant flask, Conservative Casting as the mana fix, and Garukhan's Resolve
with opposite crit advice. Storm Wave
is the Martial Artist's leveling skill [ronarray-videos] §1. The Spells kit's Cast on Critical into Arc
[widowhail] is damage; this guide used it for damage in 0.2 (Comet) and for supply since.

**Pattern shapes:**
- **Inputs and outputs (existing):** crit → Energy → Profane Ritual → corpse → Power Charge → Charged Staff and
  Flicker. *Links checked; rate unverified.*
- **Bank the resource (existing):** charges kept full in maps, refilled on set 2 before bosses. *Unverified.*
- **Weapon set 2 job and Inert minions (existing):** set 2 primes the charges; skeletons serve as corpses.
  *Checked.*
- **Payoff thief (existing):** Charged Staff spends Flicker's charges; the guide's fix is the order (fill, Charged
  Staff, refill). *Checked.*
- **Burst-window stacking (existing):** Unbound Avatar, Infernal Cry twice, Flicker. *Unverified.*
- **Duration to the floor (existing):** Overabundance I halves the ritual. *Checked.*
- **A rule changer (existing):** Sunder my Enemies turns crit into resistance ignore. *Checked.*
- **Tag audit (existing), caution:** Excise adds the Cooldown type Garukhan's Resolve excludes. *Checked.*
- **New, meta trigger as a supply:** a Cast on X gem fires a spell for what it creates, so its damage penalty is
  free and its Energy cap follows the spell's cast time. *Checked.*
- **New, a drawback the rotation never meets:** Excise's cooldown on a once-per-fight skill. *Checked.*
- **Not a match:** Closed trigger loop; charges don't make crits.

**What PoB may not model:** Cast on Critical's Energy (a coverage flag), so the charge rate is a hand calculation;
Profane Ritual's ritual limit and Sacrifice's both-sets line (possibly unmodelled), and minions as corpses (not
established); Charged Staff's duration per charge (mapped, read nowhere), though its damage per charge and Flicker's
strikes are parsed, so set the charge count; Garukhan's Resolve beside Excise (not established); the set-2 ritual.
Unbound Avatar and Sunder my Enemies were not coverage-checked.
