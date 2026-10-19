# Mobalytics review 2: thyworm's Detailed SSF Minion Infernalist

An agent's study report (2026-10-18), cited as `[mob-thyworm]`; brief: `briefs/2026-10-18-mobalytics-review.md`.
Claims marked checked were looked up at the pin (0.5.4); the rest are the guide's.

---

## 1. Header

- **Guide:** "Thy's Detailed SSF Minion Infernalist Guide for 0.5.5", by thyworm, at
  https://mobalytics.gg/poe-2/builds/thyworm-infernalist-leveling. Creator tab, 1.2K favourites, 0 comments.
- **Patch:** tagged 0.5.5, updated Sep 4, 2026, but the content is 0.5: the changelog stops on 06-06-2026 and the
  last three tabs are named for days of 0.5. The page lists the author's level 98 Infernalist in SSF Runes of
  Aldur.
- **Variant tabs, in order (17):** Lvl 5, Lvl 10, End of Act 1, End of Act 2, Act 3 - Before Spectre Swap, Act 3 -
  Vaal Guard Spectres, End of Act 4, End of Interludes, Lvl 67 - Powered Zealot Swap, Lvl 70, Lvl 75, Lvl 80, Lvl
  85, Lvl 90, Day 4 in 0.5, Day 6 in 0.5, Final Update for 0.5. Each shows the author's own character at that
  point.
- **What the capture couldn't hold:**
  - Item affixes (cards are bare base names) and the jewels (a label only).
  - The spectre's monster: every gem panel shows a placeholder for it, so the monsters come from the prose and
    FAQ. The Day 4 to Final panels drop its gem level too.
  - The tree: only point counters, negative from Lvl 80 on, so not points left.
  - The quest-reward picks (three Act 4 choices show as options), the video, loot filter and PoB code.
- **Rough edges:** support prose lags the panels (Unearth's text keeps Brutality II after Heft replaces it).

## 2. What the build is

A Witch Infernalist summoner, played and written entirely in solo self-found. The damage source changes twice:

1. **Acts 1–3:** Skeletal Snipers fire Gas Arrow on command and the player's Flame Wall ignites the gas; with
   Multishot the guide counts three explosions. It is the rare and boss button. Flame Wall spam also spawns Raging
   Spirits and buffs the arrows for clear (the guide's description).
2. **Act 3 to about level 67:** Vaal Guard spectres throwing grenades.
3. **From level 65–70:** Powered Zealot spectres casting Spark.

After the first swap spectres "do everything, all you do is a bonus". The player's buttons are support: Pain
Offering on cooldown, Unearth for bone constructs, Elemental Weakness and Frost Bomb on bosses, Convalescence
from Lvl 75. From Lvl 90 a Skeletal Sniper returns as a boss debuffer with Culling Strike. The pitch is smooth
progression and easy gearing; the stated costs are speed (slower than most builds), minion lag and clutter.

## 3. The kit

- **Weapons:** a Rattling Sceptre all game (its implicit grants Skeletal Warrior, checked:
  `Data/Bases/sceptre.lua`) and a shield all game, Splintered Tower Shield then crest shields to a Blacksteel Crest
  Shield. From the Day 4 tab weapon set 2 is The Whispering Ice. At the pin it grants Icestorm and Heart of Ice and
  inflicts Elemental Exposure on hit, lowering total elemental resistances by 50–60% (checked). Elemental Weakness
  and Icestorm go on set 2, everything else on set 1.
- **Spectres and their supports** (gem level 11 in Act 3 to 19 at Lvl 90):

| Spectre | Where, cost | Supports |
|---|---|---|
| Vaal Guard, the grenade thrower | Utzaal, Act 3; 50 Spirit | Multishot II, Feeding Frenzy I, Rapid Attacks I; by Act 4 Feeding Frenzy II, Rapid Attacks II and Muster |
| Powered Zealot, the Spark caster | Etched Ravine, Interludes; 55 Spirit | Feeding Frenzy II, Projectile Acceleration III, Pierce III, Wildshards II; Muster from Lvl 80 |

  Monster, cost and zone match the pin's `Data/Spectres.lua`, which flags both as recommended spectres
  (checked). The guide's "Bind Spectre" is the pin's Summon Spectre.
- **Other skills:**
  - Pain Offering: Danse Macabre, Efficiency II, Meat Shield II, later Prolonged Duration II and Minion
    Mastery. It is fed by two Skeletal Warriors carrying Sacrificial Lamb, which the guide says makes the
    offering target only them.
  - Unearth: Brutality II, later Heft, Prolonged Duration II, Mobility, Feeding Frenzy II, Armour Break III and
    Muster.
  - Elemental Weakness: Heightened Curse, Efficiency II, Prolonged Duration II, later Rapid Casting II and
    Magnified Area II.
  - Frost Bomb: held at gem level 3 from Lvl 5 to the end, with Magnified Area, Potent Exposure and Rapid
    Casting.
  - Convalescence from Lvl 75: Cooldown Recovery II, Prolonged Duration II, Second Wind III (for two charges),
    Efficiency II.
  - Skeletal Cleric from the Interludes, for spare Spirit.
  - Endgame additions: a Skeletal Reaver with Rage III, Minion Splash II and Muster; Raise Shield; and a rotating
    caster slot: Wardbound Minions (Day 4), Skeletal Frost Mage (Day 6), then Skeletal Storm Mage with Overcharge
    and Shock (Final).
- **Reservation:** the guide prices only the spectres (50, 55) and Convalescence (30 Spirit). It calls the
  Infernal Hound free, so Hulking Minions costs nothing on it. It never states a Spirit total, and five to eight
  spectres at those prices need 250–400 Spirit before reservation efficiency, which the gear text can't confirm.
- **Uniques:** the final kit wears Bones of Ullr (20–30% increased reservation efficiency of undead-minion
  skills at the pin, checked), two Ventor's Gamble and The Whispering Ice; Ingenuity was worn on Days 4–6 and
  dropped. The wish list adds Trenchtimbre (minion levels, at the cost of the shield), Enfolding Dawn (+100 Spirit,
  checked), Prism Guardian, and Darkness Enthroned with an Idol of Ralakesh; early finds Pariah's Embrace,
  Waveshaper, Beacon of Azis and Gravebind. The Raven's Flock is bait: no minion levels.
- **Ascendancy:** Loyal Hellhound in Act 2, respecced at Act 3 to Beidat's Will (reserve 25% of life, +1 Spirit
  per 25 life, checked). The second pick isn't in the text. The third, only at Lvl 90, is the hound again, for
  Muster's count and some defence. The fourth is Beidat's Hand (+1 energy shield per 8 life, checked), held late
  because at level 65 the ES it scales is small.
- **Tree:** only text survives: a small pathing respec at Act 4, weapon-set points set up at the Interludes, and
  exposure nodes on set 2's points once The Whispering Ice is in.

## 4. The levers

The guide's offensive scaling section, in its order:

1. Minion flat damage, which minion levels set; hence +levels on sceptre, amulet and helmet.
2. Increased minion damage from any source (tree, sceptre, attack speed, Pain Offering).
3. More multipliers from supports: Muster and Feeding Frenzy II named.
4. Enemy-side damage: Elemental Weakness, Frost Bomb's exposure, shock from the Zealots or a Skeletal Storm
   Mage.
5. Last, more minions through more Spirit.
6. Wildshards II adds Zealot projectiles.

The gear focus list repeats on every tab: minion levels, Spirit, life, energy shield, resistances.

**What it skips:**
- Runic Ward: situational, another button, and a slot better spent on another minion.
- Contagion after Act 1, when it stops contributing.
- Supports on Contagion and Unearth early, and on Elemental Weakness until supports run spare.
- The Raven's Flock.

## 5. Leveling

- **Lvl 5–10:** Skeletal Sniper (Multishot I, then Fire Attunement) and Flame Wall (Ignite I, then Rapid Casting
  I) as the bossing combo. Contagion and Unearth clear unsupported. Frost Bomb for exposure. Skeletal Warriors
  from the sceptre. Buy +1 gear from vendors and do every Act 1 side quest for gems.
- **End of Act 1:** Contagion goes; Raging Spirits join. Army: 3 snipers, 2 warriors, 10 Raging Spirits and
  Unearth's constructs.
- **End of Act 2:** Bidding I on the sniper for command damage, Pain Offering with Danse Macabre, Elemental
  Weakness, and the hound. Army: 6 snipers.
- **Act 3, before the swap:** save uncut skill gems, a Lesser Jeweller's Orb for a 4-link and some supports; the
  hound becomes Beidat's Will. Army: 8 snipers.
- **Act 3 swap:** in Utzaal, after the Sun Temple. Pick the grenade-throwing Vaal Guard at 50 Spirit, not its
  look-alikes (the pin lists three Vaal Guards). Army: 5 guards, 6 by Act 4, 8 at the Interludes after a Greater
  Jeweller's Orb.
- **Zealot swap (Lvl 65–70):** the Zealot can be bound in the Interludes, but swap only with a 5-link and level-5
  supports. On a 4-link the guards are better, and an early swap "is gonna feel bad". Army: 7 Zealots and a
  cleric, 8 Zealots from Lvl 80.
- **Lvl 75–90:** Convalescence (75), Muster on the spectres (80), then the hound and sniper back (90).
- **Day 4 to Final:** The Whispering Ice swap, the Reaver, the caster rotation; in Final the Skeletal Warriors
  fight too (Rage III, Minion Splash II).

## 6. Gear and budget

No currency figures: everything is self-found or crafted.

- **Bases:** an Iron Crown helmet and a Rattling Sceptre on every tab from Lvl 5 to Lvl 90, the helmet first in
  the slot priority from Lvl 10; a Runeforged Jungle Tiara after. Bodies run Feathered Robe, Bone Raiment,
  Tideseer Mantle, then Conjurer Mantle (Lvl 80).
- **Crafting recipes:**
  - Sceptre: transmute and augment normal Rattling Sceptres until one shows +minion levels, then a Greater
    Essence of Command for minion damage. A Preserved Jawbone (forced to a prefix with an Omen of Sinistral
    Necromancy) gives a desecrated modifier, hopefully Spirit. Exalt the rest, then a Rabbit Idol (15% increased
    Spirit in a sceptre, checked).
  - Helmet: the same, with any essence and a Preserved Ribcage; a great helm takes an Idol of Ralakesh (8%
    increased reservation efficiency of minion skills, checked).
  - Amulet: four affixes, then a Fracturing Orb (a 25% chance at Spirit or +levels), then chaos orbs, possibly
    hundreds, until the other appears.
  - Other slots: a generic transmute, essence, exalt and desecrate recipe.
- **Vendors:** a regex for movement speed, +levels, Spirit and rarity, run on vendors into the endgame.
- **Sources:** the Breach tree for minion rings and belts; Ritual's unique offerings nearly guarantee Enfolding
  Dawn, Bones of Ullr and Ventor's Gamble. Trade players are told to buy his level 100 character's gear.

## 7. Defences

- **Energy shield:** over 8,000 despite 0.5's recharge nerf, with Convalescence to force a recharge; sapphire
  jewels get a guaranteed ES prefix from emotions.
- **Block:** a shield with an increased-block prefix for about 32%, which also keeps recharge from being
  interrupted.
- **Life:** some, because Beidat's Hand converts it and some damage bypasses ES.
- **The hound with Loyalty:** the guide says 10% less damage taken. At the pin it is 10% of hit damage taken from
  the hound's life first, at 30% less life for the hound (checked).
- **Minions:** they blind on hit (late setups, Blind II on the sniper) and body-block projectiles, at the cost of
  drawing attention.
- **Runic Ward:** rejected as hard to get, and it displaces other layers.
- **Flasks:** an instant life flask, and Lavianga's Spirits at a 70% roll.

There are no resistance, max-hit or effective-HP figures.

## 8. What players pick

The guide is first person throughout and rarely says what others do:

- Speed is judged against most builds (slower).
- As of June 7, 0.5 had turned up no standout new spectre, so the Zealots stayed. The author's Gargantuan
  wasps with Rage III and Minion Splash II cleared well but lacked single target.
- It points to a community spectre wiki for the best spectres: spectre choice is crowd-tested.
- Two FAQ entries on spectre timing show what readers ask most: when to swap, and which Vaal Guard.

## 9. For the library

**Kit lines for Standard kits, Minions:**

- **Spectres:** a two-step swap ladder: Vaal Guard grenadiers from Utzaal at Act 3 (50 Spirit, a 4-link), then
  spear Powered Zealots casting Spark from the Etched Ravine at 65–70 (55 Spirit), only once a 5-link and level-5
  supports are in hand [mob-thyworm] §5 (checked, pin: `Data/Spectres.lua`).
- **Spectre supports:** pick by the monster's skill: Multishot and Rapid Attacks for the grenade attack; Wildshards
  II, Pierce III and Projectile Acceleration III for Spark; Feeding Frenzy II on both, Muster once types grow
  [mob-thyworm] §3 (Wildshards II's 25% chance of 8 projectiles is checked; Multishot on the grenades is the
  guide's).
- **Campaign:** Skeletal Sniper from level 1, its Gas Arrow command ignited by Flame Wall for the rare and boss
  button, until the Act 3 spectre swap [mob-thyworm] §2, §5 (Gas Arrow is the Sniper's skill at the pin, checked;
  the ignition is unverified).
- **Offerings:** Pain Offering with Danse Macabre, fed by the Rattling Sceptre's Skeletal Warriors with
  Sacrificial Lamb [mob-thyworm] §3. Danse Macabre is 30% more damage and 30% increased buff effect at the pin,
  not the guide's doubling (checked); Sacrificial Lamb's targeting is unverified.
- **Debuffs:** Elemental Weakness and a level-3 Frost Bomb with Potent Exposure all game; in endgame The
  Whispering Ice on weapon set 2 for its 50–60% exposure on hit [mob-thyworm] §3 (the unique is checked; that its
  exposure helps the minions' hits is unverified).
- **Spirit without trade:** a Rabbit Idol in the sceptre (15% Spirit), an Idol of Ralakesh in the helmet (8%
  minion reservation efficiency), Bones of Ullr (20–30% for undead minions), Beidat's Will [mob-thyworm] §3, §6
  (checked).
- **Levers, in order:** minion levels, increased minion damage, more multipliers (Muster, Feeding Frenzy),
  enemy-side debuffs, then count via Spirit [mob-thyworm] §4.
- **Defence:** energy shield with Convalescence to force recharge, a block shield near 32%, and the free Infernal
  Hound with Loyalty taking 10% of hits first [mob-thyworm] §7 (Loyalty and Convalescence checked; the 32% is the
  guide's).

**Pattern shapes:**

- **Placed detonator** (existing): a minion's command lays gas, the player's Flame Wall ignites it (unverified).
- **Low-level utility gems** (existing): Frost Bomb held at level 3 all game.
- **Weapon set 2 job** (existing): a staff on set 2 for on-hit exposure, with the curse and exposure nodes there.
- **A count as a multiplier** (existing): Muster arrives as types grow; the Lvl 90 hound is partly for the count.
  The pin's Muster counts different reviving types, the guide's persistent minions.
- **Inert minions** (existing): Skeletal Warriors kept as offering fuel.
- **New, a debuffer minion:** a minion given damage-cutting supports (Rapid Attacks III, Blind II, Maim, Culling
  Strike II) only to apply debuffs; near Condition carrier (the guide's word only).
- **New, a borrowed monster skill:** a spectre's own skill decides which player supports apply, so the monster
  is chosen for its skill's tags; the pin tags both as allowing additional projectiles.

**What PoB might not model:**

- Wildshards II's extra projectiles and Danse Macabre's extra-skeleton condition are "possibly unmodelled" in
  coverage (checked); Danse Macabre's more damage, Muster, Loyalty and Feeding Frenzy II parse.
- The Gas Arrow ignition (not established).
- Spectre skills under player supports (not established).
- Set-2 exposure while set 1's minions hit (not established).
- Blinding and projectile-blocking minions as defence (not modelled).
- Muster's type count (PG-3, PG-53).
- Convalescence's forced recharge, which is a skill, not a stat (not established).
