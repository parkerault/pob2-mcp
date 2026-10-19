# Woolie's "Wolfman" Oracle Druid (Mobalytics, 0.5.5)

A study for the pattern library's Mobalytics review (guide 5 of `briefs/2026-10-18-mobalytics-review.md`), cited as
`[mob-wolfman]`, written on 2026-10-18 from the page text saved that day, paraphrased. **Checked** means confirmed in
the pinned data (PoB2 v0.23.1) by a lookup or a grep of `vendor/PathOfBuilding-PoE2/src/`; **unverified** is the
guide's word.

## 1. Header

- **Guide:** "[0.5.5] Woolie's WOLFMAN (Leaguestart friendly)", Druid, Oracle, by Woolie;
  https://mobalytics.gg/poe-2/builds/woolie-wolfman. **Tab:** Verified. **Favourites:** 4.7K. **Patch:** 0.5.5 on
  the badge; the change notes (dated 5/21) cover 0.5: Pounce's cooldown 4 → 5.1 s, Moonbeams no longer melee,
  Bhatair's Vengeance and Overextend out, about 7–8% less damage. **Updated:** Aug 30, 2026.
- **Variant tabs, in order:** Acts 1-3 → Act 4+ (t4 supports) → Early Endgame → Mid Endgame [READ NOTES] → Late
  Endgame → HYPER Endgame.
- **Not captured:** item affixes; the tree beyond its counters (points left 57, 22, 7, 4, 1, −9) and notes; the
  gem priority lists' support steps; the video and PoB code. Mobalytics can't show Entwined Realities' allocations,
  so the late trees omit them (hence −9).

## 2. What the build is

Werewolf melee on a Talisman: each wolf skill shapeshifts you when used (checked: the pin's six Werewolf skills are
Lunar Assault, Shred, Cross Slash, Pounce, Arctic Howl and Lunar Blessing). Physical weapon damage turns cold: Lunar
Assault converts 80% (checked), and Lunar Blessing's buff adds 59% of damage as extra cold at level 20 and calls
Moonbeams on werewolf melee hits (checked). Crits come from the Oracle's Forced Outcome.

- **Packs:** Lunar Blessing kept up (Moonbeams hit the target and up to 5 others within 6 metres, checked), then
  Lunar Assault and Pounce (a travel slam, checked) pack to pack; Herald of Ice and the Moonbeams do the rest.
- **Bosses, a freeze combo:** Pounce, a meta gem with the Mark tag (checked), applies the Freezing Mark socketed in
  it; Lunar Assault's 506% more freeze buildup (checked) primes the target; Arctic Howl freezes a primed enemy and
  empowers attacks with added cold (checked); Shred on the frozen target makes Ice Fragments (checked: once per use,
  three projectiles exploding after 2.5 s); Cross Slash pulls every fragment within 7 metres to where its gouges
  cross and detonates them, and both gouges on a marked enemy activate the mark (checked). The guide fits two Shreds
  per freeze and puts Arctic Howl's threshold at 60% buildup on rares, 70% on uniques (unverified). Savage Fury on
  bosses: 29% more damage and Onslaught for 3% of maximum life a second (checked).
- **Feel:** fast and freezing; mana-hungry until Blood Magic, fragile until some currency goes in.

**Against a bear build.** The pin's bear skills (Furious Slam, Rampage, Molten Crash, Fury of the Mountain, Walking
Calamity, the warcry Ferocious Roar) are Strength slams and charges, most spending Rage on the hit (types Bear, Slam,
ConsumesRage; pin: `Data/Skills/act_str.lua`). The wolf's are cold strikes needing Strength and Intelligence equally
(checked) that freeze rather than make fissures and fire, and its Rage buys one buff's duration (Lunar Blessing: 0.2 s
per Rage spent, checked). It borrows only Ferocious Roar, for Rage.

## 3. The kit

- **Weapon:** a Talisman, a two-hander (checked), so no off hand. Amor Mandragora (a unique Talisman, checked) early
  in Act 1, then Rabid, Howling and Cruel; Spiny is best in slot for crit, Maji and
  Fungal good too. At the pin Spiny has 11% base crit against 8–9% on the others named, Maji the highest physical top
  roll (114) and Fungal the fastest attacks (1.4 against 1.25) (`Data/Bases/talisman.lua`, checked).
- **Supports** (Late Endgame):
  - Shred: Rapid Attacks II, Elemental Armament III, Crescendo II, Close Combat II (then Garukhan's Resolve),
    Elemental Focus at level 90.
  - Lunar Assault: Ancestral Call II (Freeze for pinnacles), Elemental Armament II, Ice Bite II, Magnified Area II
    (Rakiata's Flow on HYPER), Deep Freeze.
  - Pounce: Freezing Mark, Charged Mark, Holy Descent, Ice Bite II, Blazing Critical.
  - Arctic Howl: Cold Exposure, Ice Bite II, Deep Freeze, Tireless.
  - Cross Slash: Execute II, Elemental Armament III, Culmination II, Concentrated Area, Heavy Swing.
  - Lunar Blessing: Prolonged Duration II, Cooldown Recovery II, Efficiency II, Magnified Area II, Elemental
    Armament II.
- **Spirit:** Herald of Ice (Frozen Spite until Late swaps in Uruk's Smelting, Armour Break III and Armour Explosion,
  a physical clear tech); Eternal Rage (constant Rage regeneration, checked); on HYPER, Overwhelming Presence
  (enemies in your presence are easier to ailment, checked).
- **Savage Fury on weapon set 2:** set to weapon set 2 alone, with the Talisman in set 1, it is said to work but
  reserve no Spirit (unverified). The pin flags Eternal Rage, not Savage Fury, as reserving in all sets
  (`Data/Skills/act_str.lua`), which fits; PoB never reads that flag (`Modules/`, `Classes/`).
- **Uniques, in order:** Garukhan's Resolve (a support: capped attack crit chance that bifurcates; checked); a
  Time-Lost jewel; Heart of the Well; Rakiata's Flow; Morior Invictus on HYPER. The 0.5 notes drop Bhatair's
  Vengeance, yet the Early Endgame blurb still says to buy it: stale text.
- **Ascendancy:** The Unseen Path (reveals hidden passives), The Lesser Harm (enemy crit chance and damage against you
  unlucky, checked), Forced Outcome (Inevitable Critical Hits, checked), Entwined Realities (non-keystone passives in
  a medium radius of an allocated keystone can be taken unconnected, checked). An optional Shaman start (Turning of
  the Seasons, Sacred Flow, Reactive Growth) respecs to Oracle at the third or fourth trial.
- **Tree:** shapeshift, Rage, crit and cold; Dexterity for Herald of Ice, then Strength and Intelligence
  alternately. Anger Management (+15 maximum Rage, 200% faster start of Rage loss, checked) waits for Eternal Rage.
  Through Entwined Realities, Ancestral Bond (harmless without totems) reaches Dimensional
  Weakspot, Stormcharged, Dangerous Blossom, Electrified Claw and the Wyvern notables; Blood Magic reaches In Your
  Face, Prism Guard and Vengeful Fury; on HYPER, Mind Over Matter reaches Touch the Arcane and Ruinic Helm. Anoints:
  Sundering, then Overwhelming Strike, then Desensitisation.

## 4. The levers

In the guide's order:
1. **The weapon** ("your LIFEBLOOD"): increased physical, flat physical and flat cold, then melee levels, crit bonus,
   attack speed. A two-hander rolls up to +5 melee levels (checked, `Data/ModItem.lua`); gloves, the next damage
   slot, up to +2, an amulet +3 (checked).
2. **Lunar Blessing kept up**, a "MASSIVE damage boost": Prolonged Duration II, Cooldown Recovery II, Rage spent for
   duration, the Interlude's 12% cooldown recovery, later Eternal Rage. A dodge just after the cast cancels its
   animation (unverified).
3. **Crit through Forced Outcome.** Each re-roll to a crit cuts the crit bonus by 30%, so the guide aims at 24–25%
   crit chance and at least +400% crit bonus, then buys crit bonus, for about 44% more damage. PoB
   (`Modules/CalcOffence.lua`) pays 100, 70, 40 and 10% of the bonus for a crit on the first to fourth roll; by hand
   the gain peaks near 25% (×1.40 at +400%, ×1.44 at +500%) and is flat from 15% to 35% (×1.35–1.40). Checked.
4. **Supports:** Elemental Armament, Ice Bite II, Cold Exposure, Deep Freeze; Rakiata's Flow and Freeze for
   pinnacles.
5. **Savage Fury** on bosses; **jewels** with crit, cold damage, skill speed while shapeshifted and energy shield; a
   Time-Lost jewel beside Blood Magic whose notables grant crit bonus.

**Skippable:** the Shaman start, Lavianga's Spirits, Rakiata's Flow outside high-end content, and the Herald tech
without the physical Essence mod.

## 5. Leveling

- **Acts 1–3:** Amor Mandragora, then a Rabid Talisman; Horns of Bynden (a unique helmet, checked); life,
  resistances, pure armour bases. Before Cross Slash, Shred is spammed with Bleed I and Rage I and Pounce carries Fist
  of War I then Stomping Ground. Then the combo's skills, mostly with Cold Attunement and Ice Bite I, Herald of Ice,
  and Ferocious Roar with Raging Cry (Rage by counted monster Power, checked). Spirit: Savage Fury on set 2, then
  Herald of Ice.
- **Shred is the basic attack**, gaining sockets with character level: third at 40, fourth at 65, fifth at 90
  (unverified).
- **Act 4+ (level-4 supports from about level 40):** Howling Talisman; Ancestral Call I replaces Cold Attunement on
  Lunar Assault; Lunar Blessing joins (a tier-13 gem, checked). With +30 Spirit on body or amulet and the Interludes
  done (100 Spirit), Eternal Rage replaces Ferocious Roar. Forced Outcome is the third ascendancy.
- **Quest picks:** charm charges, ailment threshold, attributes, flask recovery, 12% cooldown recovery.
- **Mana, in order:** a Sapphire with mana on kill; Mark of Siphoning II in Pounce; physical damage leeched as mana
  on a ring, since 20% of Lunar Assault's damage stays physical (checked); a better mana flask.

## 6. Gear and budget

| Tab | Budget | Weapon | Changes |
|---|---|---|---|
| Acts 1–3 | none | Rabid | the unique helmet first |
| Act 4+ | none | Howling | +30 Spirit on body or amulet |
| Early Endgame | not given | Cruel | save for a Spiny, Maji or Fungal |
| Mid Endgame | about 2 divines | Cruel | hybrid armour/energy shield; Blood Magic |
| Late Endgame | 5+ divines | Spiny | Garukhan's Resolve first |
| HYPER | 30+ divines | Spiny | Morior Invictus with Spirit; pure armour helmet |

- The weapon tops the slot priority on four tabs, then falls to last once bought.
- Late on: at least one roll of physical damage leeched as life, and an Ultimate Life Flask whose increased-recovery
  prefix takes some of it from mana. Under Blood Magic ("You have no Mana", checked) that cost is nothing.
- Pure energy shield boots for Iron Slippers (armour per boot energy shield, checked).

## 7. Defences

- **Layers:** freeze, the guide's main defence; The Lesser Harm; pure armour, then hybrid armour and energy shield
  with Iron Slippers; Prism Guard, Cold Coat, Projectile Bulwark and Scales of the Wyvern (energy shield recharge
  while shapeshifted, checked) through Entwined Realities. The only numbers: HYPER's helmet wants 1,000 armour and
  32% of armour applying to elemental damage; no life or max-hit totals.
- **Recovery:** 2% life on kill, physical leech as life, the life flask; Blood Magic from Mid Endgame moves costs to
  life (checked).
- **HYPER:** Zealot's Oath (excess life regeneration goes to energy shield, which stops recharging; checked) fed by
  Morior Invictus. Mind Over Matter (damage taken from mana first, checked) is taken for Entwined Realities; under
  Blood Magic it should do nothing (inference, unverified).

## 8. What players pick

Every such line, few as they are:
- An attack build's weapon is its key slot; buying one from a player is the easiest, cheapest upgrade.
- Pure armour bases until endgame; life and resistances on everything but weapon and gloves.
- Physical and cold are ideal on the weapon, but any type works in Acts 1–2.
- The Shaman start is optional smoothing; an ascendancy respec is costly.
- 0.5's skill-level nerf hits nearly every attack build.
- Spiny is best in slot; Maji and Fungal are also good.
- The atlas shown is a maximum-difficulty one: taking every explicit-modifier-effect node is a trap.
- Popularity: 4.7K favourites, Verified, "Leaguestart friendly" in the title.

## 9. For the library

**Kit lines** for a new "### Shapeshifting" section (thin: one wolf study; [mob-bear] adds the bear):
1. **Kit (wolf):** a two-hand Talisman and the werewolf set: Lunar Assault primes freeze, Pounce carries Freezing
   Mark, Arctic Howl freezes the primed target, Shred on it makes Ice Fragments and Cross Slash detonates them; Lunar
   Blessing and Herald of Ice clear [mob-wolfman] §2, §3. Checked (the skills' text).
2. **Levels and bases:** a Talisman is a two-hander, up to +5 melee levels (gloves +2, amulet +3; pin:
   `Data/ModItem.lua`); Spiny's 11% base crit against 8–9% makes it the crit base (pin: `Data/Bases/talisman.lua`)
   [mob-wolfman] §3, §4. Checked.
3. **Levers:** weapon physical and cold damage, then melee levels, crit bonus and attack speed; Lunar Blessing's
   uptime (59% of damage gained as cold at level 20, 5 s plus 0.2 s per Rage spent, pin) from duration, cooldown
   recovery and Rage [mob-wolfman] §4. The gem is checked; the priority is the guide's.
4. **Rage:** Ferocious Roar (a bear warcry) fills Rage until Eternal Rage regenerates it, at 100 Spirit plus 30 from
   gear; Anger Management's faster Rage loss waits for Eternal Rage [mob-wolfman] §3, §5. Texts checked; the
   threshold is the guide's.
5. **Bear against wolf:** bear skills are Strength slams that spend Rage on the hit (pin:
   `Data/Skills/act_str.lua`); wolf skills are Strength-and-Intelligence cold strikes that freeze, spending Rage on a
   buff [mob-wolfman] §2. Checked.
6. **Crit (Oracle):** Forced Outcome's gain peaks near 25% crit chance (×1.40 at +400% crit bonus by PoB's formula,
   pin: `Modules/CalcOffence.lua`), so buy crit bonus past it [mob-wolfman] §4. Checked by hand.
7. **Tree (Oracle):** Entwined Realities with keystones the build doesn't feel (Ancestral Bond without totems, Mind
   Over Matter under Blood Magic) as radius anchors [mob-wolfman] §3, §7. Texts checked; "doesn't feel" unverified.
8. **Spirit:** a persistent buff set to weapon set 2 alone (Savage Fury) is said to reserve nothing while the
   Talisman set fights [mob-wolfman] §3. Unverified; needs in-game testing.

**Candidate pattern shapes:**
- **Placed detonator** (existing): Shred places Ice Fragments on a frozen target, Cross Slash detonates them. Checked.
- **Condition carrier** (existing): Lunar Assault's freeze buildup carries the freeze Arctic Howl and Shred need, the
  gem of Walking Calamity's example. Checked.
- **State-keyed payoffs** and **Control as defence** (existing): Frozen is the guaranteed state, which Shred's
  fragments, Arctic Howl's empowerment and Frozen Spite key on, and the stated defence. Checked.
- **Outcome lock** (existing, a caution to add): Forced Outcome charges per re-roll, so it has a crit-chance
  breakpoint. Checked.
- **Keystone as pathing anchor** with **Zeroed resource** (existing): Blood Magic zeroes mana, so Mind Over Matter's
  mana side and the flask prefix's cost are free, and three keystones anchor radii. Unverified in game.
- **Weapon set 2 job** (existing): a reservation dodge, failing the sniff test until a game text documents it.
- **Drawback cancellation** (existing): Eternal Rage offsets Anger Management's faster Rage loss. Texts checked.
- **New, permanent cooldown buff:** a cooldown buff is permanent once its duration reaches the cooldown, so buy
  duration, cooldown recovery and the resource it spends for duration. Unverified for this build.
- **New, notable-count jewel over an anchor:** a radius jewel granting stats per notable (Time-Lost "Notables also
  grant") beside a keystone whose Entwined Realities radius brings notables in. Unverified.

**What PoB might not model** (coverage, 2026-10-18):
- Lunar Blessing's 59% gained as cold and per-Rage duration are "possibly unmodelled; check config": the guide's
  biggest damage buff may be missing from PoB's figure. The Moonbeam parses.
- Arctic Howl's empowered cold and freeze of the primed, Shred's fragment trigger, Cross Slash's pull, Freezing
  Mark's freeze (mapped, unread). Freeze is a config stand-in.
- Savage Fury's set-2 reservation: PoB reads no all-sets flag, so it should count the reservation (inference).
- The Unseen Path parses to nothing; Entwined Realities' line parses, but whether PoB's tree allocates the
  unconnected nodes is not established. Forced Outcome is modelled, with Garukhan's bifurcation.
