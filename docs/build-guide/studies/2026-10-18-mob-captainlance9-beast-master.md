# Mobalytics review 3: CaptainLance9's Spirit Walker Beast Master

A study for the pattern library, cited as `[mob-beastmaster]`, written on 2026-10-18 from the page text saved that day
(brief: `briefs/2026-10-18-mobalytics-review.md`, row 3; the library's gap: tamed beasts). Paraphrased; nothing of the
page is copied beyond names and a few short phrases. The comments were ignored. "Pin" marks a check against the pinned
PoB (0.5.4), by lookup or by a grep of `vendor/PathOfBuilding-PoE2/src/`; "the table" is
`data/monsters/monster-mods.md`.

## 1. Header

- **Guide:** "[0.5] CaptainLance9's Spirit Walker Beast Master", Huntress, by CaptainLance9.
- **URL:** https://mobalytics.gg/poe-2/builds/spirit-walker-beast-master
- **Tab:** Verified. **Favourites:** 3.9K. **Patch:** the title says 0.5; the page's badge reads 0.5.5. **Last
  update:** Sep 15, 2026. A widget shows a level 95 Spirit Walker in Runes of Aldur.
- **Variant tabs, in order:** Act 1, Act 2, Act 3, Act 3 SWAP, Act 4, Interludes, Red Maps, Endgame, Zoo: seven
  leveling stages, then two endgame builds. Act 4 and Interludes hold the same kit.
- **What the capture couldn't hold:**
  - Item affixes and each item card's notes: rares are base names only.
  - The beasts' species: every tame shows in the gem panels as the placeholder "Companion: {0}", so which beast holds
    which slot comes only from the prose.
  - The tree: only its counters (points left of 123, and of 20 per weapon set). No ascendancy order is in the text.
  - Per-tab blurbs (none came through) and seven linked videos, which hold the explanations of rare-modifier rolling
    and of Refutation. Not watched.

## 2. What the build is

- **Damage source:** tamed beasts. The Spirit Walker notable The Natural Order lets Tame Beast capture unique beasts,
  one summoned at a time (pin). The guide builds around Mighty Silverfist, the Act 3 unique ape, "by far the strongest
  single target", for its 25% base crit (pin: `critChance = 25`, `Data/Spectres.lua`) and a crit-bonus
  line (the guide says an extra 100%; the pin's entry carries 150% increased crit multiplier). Other unique tames
  work, it says, but the ape is an outlier.
- **Support actors:** a rare tame kept for a modifier (Haste Aura first); the Bear Spirit (Wild Protector, an
  ascendancy skill outside the companion limit, pin) for Intimidate; skeletons as sacrifices and extra minion types.
- **Packs and bosses:** the companions clear alone while the player loots behind them; on bosses the player adds a
  mark, Pain Offering, Pounce (in no gem panel) and Parry on weapon set 2.
- **Its verdict:** relaxed, high damage, cheap, tanky; companions body-block and mistarget.
- **Two endgames:** Endgame keeps a rare sceptre (better single target). Zoo takes Sylvan's Effigy, whose "You can
  have any number of Companions of different types" (pin) runs four tames plus wolves and stacks Loyalty (better
  clear, and room for a defensive companion body armour).

## 3. The kit

- **Weapons:** set 1, a main hand (a spear while leveling, Trenchtimbre from Red Maps: +1–2 minion skill levels,
  20–30% attack speed, minion attack speed modifiers also affect you, pin) and a sceptre (Omen, Rattling, then Shrine;
  the Effigy in Zoo). Set 2, a second sceptre and a buckler (Leather Buckler, then the unique Dunkelhalt) for Parry. My
  reading: a sceptre in both sets keeps the Spirit, so the companions, through the swap; the FAQ fixes a despawn bug
  by keeping Wolf Pack on set 1 only.
- **The weapon feeds the beasts:** The Catha's Balance (the guide calls it Catha's Blessing) gives companions added
  attack damage equal to 60% of the main hand weapon's damage (pin). So the main hand is bought for the companions:
  Tyranny's Grip, slightly above Trenchtimbre; late, a +4 Chober Chaber or a high-physical Ironwood Greathammer held
  in one hand by Giant's Blood (pin: triple attribute requirements), its Strength met by a reduced-requirements suffix
  and Legacy of Greymake. Lord of the Wilds (a sceptre beside a talisman, at 50% less Spirit, pin) is the alternative.
- **Tame supports:** the first tame takes Muster, Feeding Frenzy, Rage and Rapid Attacks, then Hulking Minions and
  Minion Mastery; the second, Rapid Attacks, Rage and Muster. Zoo's tames and wolves trade Rage for Minion Splash II
  and add Loyalty.
- **The bear:** Wild Protector with Loyalty from Act 2, later with Catha's Brilliance, Romira's Requital (a lineage
  support carrying Loyalty's line, pin), Rapid Attacks II and Muster.
- **Other skills:** Freezing Mark, then Sniper's Mark; Malice, whose crit weakness feeds an Extra Crits tame; Pain
  Offering (Danse Macabre, Sacrificial Offering); three or four skeleton types; Parry; Refutation on set 2; Ghost
  Dance and two Purity of Ice groups in Endgame; Wolf Pack, Azmerian Wolf (granted by the Effigy, pin) and Spirit
  Vessel in Zoo.
- **What the beasts reserve:** the text gives no Spirit figure. Silverfist reserves 47.4% of maximum Spirit (pin:
  `companionReservation`), more than 561 of the pin's 619 monsters (median 32.7%). The guide's rares, matched by me
  from its names: Diretusk Boar 39%, werewolves 30.6–35.4%, Plague Harvester 42.3% (pin). Two tames take 78–90% of
  maximum Spirit before efficiency; the bear, skeletons, Purity of Ice and Ghost Dance share the rest. PoB applies
  reservation efficiency to percentage reservations too (pin: `Modules/CalcDefence.lua`), so efficiency makes the room:
  Idol of Ralakesh (8%, the guide), and the Spirit Walker's Idolatry, 2% reservation efficiency and 10% companion
  damage per Idol worn (pin), which the guide never names but which would explain its Idol list (my inference).
- **Zoo's arithmetic:** four tames at the median would reserve about 131% of Spirit before efficiency, so the Zoo must
  use cheaper species or far more efficiency; the capture names neither (inference, unchecked).
- **Tree:** companion damage and attack speed, Captivating Companionship, jewel sockets. Anoints: Gigantic Following
  (rare sceptre), Relentless Fallen, Warlord Berserker (Effigy).

## 4. The levers

In the Offence section's order:

1. The unique tame itself.
2. A rare tame with Haste Aura (the guide: 20% attack speed) or Trail of Lightning (its shock: 20% increased damage
   taken).
3. Intimidate from the bear (10%).
4. Companion damage: tree, jewels, a sceptre modifier, Idols.
5. Companion and minion attack speed: tree, jewels, sceptre, Haste Aura.
6. Minion levels: helmet +1–2, amulet +1–4, sceptre +1–5, Trenchtimbre +1–2, Prism of Belief +1–3, corruption +1.
   The pin's regular rolls stop one lower on an amulet and a sceptre.
7. The Catha's Balance with a high-physical main hand.
8. A tablet's extra modifier on the unique tame: Extra Crits (300% increased crit chance, the table), which the guide
   says caps crit alone; Enraged; an Extra-x Damage (gain 40% as extra, the table); Hasted (30% speed, the table).
9. Parry on set 2 for 100% more attack damage taken (hedged).
10. Minion crit bonus on jewels (15–25%) and Malice, riding Extra Crits.
11. Pain Offering with sacrificed skeletons, 30% speed and 60% damage at level (unverified).

Ultra late: The Adorned with magic Diamond jewels (companion damage, minion crit bonus), and jewel sockets bought by
dropping weaker companion passives. **Skippable:** the rare sceptre's levels (the Effigy costs about four, barely
noticed, it says).

## 5. Leveling

- **Acts 1–3:** Twister with Whirling Slash, the strongest early Huntress by the author's testing, with Barrage, War
  Banner, Fangs of Frost and Frost Bomb; Act 2 adds Ice-Tipped Arrows, Freezing Mark, Malice, Herald of Ice and the
  bear, on a spear and an Omen Sceptre. Flat damage on gloves, rings and spear carries it.
- **The tame's timing:** Tame Beast arrives as a level-7 gem (pin: tier 7); the Act 3 tab holds one tame beside
  Twister. The full swap waits for Act 3's second ascendancy: at level 22 the tree is about 40% real passives and 60%
  travel, after Act 3 nearer 60/40. The respec costs about 20k gold, so spend nothing at Act 2–3 vendors beyond the
  first weapon upgrade.
- **Act 3 SWAP:** two tames at gem level 11, skeletons, Pain Offering, Freezing Mark, Parry, a buckler on set 2.
  **Act 4:** tames at 14, Dunkelhalt. **Red Maps:**
  Trenchtimbre, tames at 17–18, Skeletal Cleric, Wild Protector, Refutation.
- **Where the beasts come from:** Silverfist in Act 3; rare tames by resetting a checkpoint until the rare rolls the
  wanted modifiers: a boar (Infested Barrens), a werewolf (Ogham Village), the Plague Harvester (Khari Crossing).

## 6. Gear and budget

- **Sceptres first:** Red Maps' and Endgame's priority lists open with the two sceptres, then Dunkelhalt, rings and
  amulet; the main hand comes eighth to tenth. Zoo's list ends with the Effigy, so it may not be a buy order.
- **Spirit sources:** sceptres (the Effigy: 163 Spirit and 50–75% increased Spirit, pin), Stellar Amulet, +10 from an
  ascendancy node (pin).
- **Idols by slot:** Fox or Rabbit in the body, Hawk (companion attack speed) or Snake in the sceptre, Idol of
  Ralakesh or Primate in the helmet, Carved Majesty in the gloves; a Greater Rune of Leadership on the weapon.
- **Uniques:** Pariah's Embrace (Acts 2–3), Dunkelhalt (Act 4 on), Trenchtimbre (Red Maps); the expensive ones are
  Endgame's Andvarius, Morior Invictus and Mageblood, and Zoo's Effigy and Forgotten Warden. The guide calls the build
  low cost and gives no prices.

## 7. Defences

- **Damage taken by companions first:** Loyalty 10% per supported companion (pin), Romira's Requital the same (pin),
  Captivating Companionship 5% (pin), Starkonja's Head 15% (pin) or its Legacy rune, 5% (pin). Zoo multiplies it:
  Loyalty on two wolves, three tames and Spirit Vessel, Romira's Requital on the bear, and Forgotten Warden's 10–15% of
  deflected hit damage (pin). The guide calls the stack an "insanely free tank". Whether the shares add without limit
  is not established.
- **Pools and resistances:** life early and mid game; an evasion, deflection and energy shield hybrid; energy shield
  with Heroic Tragedy late. Elemental and chaos resistances capped on gear.
- **Intimidate** from the bear: 10% less enemy damage in the Defence list, 10% more damage taken in Offence
  (unverified).
- **Endgame:** Ghost Dance, two Purity of Ice, the rare tame's defensive auras (§8). No life, energy shield or max-hit
  figures.

## 8. What players pick

- **The beast:** the unique ape, an outlier above other viable unique tames.
- **The rare's modifier:** Haste Aura is the "#1 priority". Its figures (20% attack speed, 10% movement speed) are
  the table's Haste Aura (20% attack and cast speed, 10% movement to allies within 5 metres), not Hasted (30% movement,
  attack and cast speed, the beast's own). So the Haste most players prioritize on a rare tame is the aura, whose speed
  reaches the unique tame, the bear and the player. Hasted appears only among the unique tame's tablet buffs.
- **Haste Aura's limit:** the guide says it never rolls on species tagged fast movement, naming the Plague Harvester.
  The pin tags it `fast_movement` and `very_fast_movement` (Silverfist too); the spawn rule isn't in the pin
  (unverified).
- **The rest of the rare list, in order:** physical damage aura (the guide: 30% increased; the table: 40%), Temporal
  Bubble (the guide: slows enemies inside; the table: the beast takes no damage from outside the radius),
  invulnerability aura, a regeneration aura that stops enemy healing, Elemental Resistance Aura, Energy Shield Aura.
- **The unique's tablet modifier:** Extra Crits best, then Enraged (the guide: 30% damage, 25% attack, cast and
  movement speed, 33% less damage taken; the table has no lines), then an Extra-x Damage.

## 9. For the library

**Kit lines** (a "Companions" block under Standard kits, or lines in Minions):

- **Kit:** (one study) a Spirit Walker with The Natural Order tames a unique beast, Mighty Silverfist from Act 3 (25%
  base crit, pin: `Data/Spectres.lua`), beside one rare tame kept for its modifier and the Bear Spirit (Wild
  Protector, outside the companion limit); the player marks, Parries on weapon set 2 and loots [mob-beastmaster] §2,
  §3. *Checked: the node, the bear, the crit; two tames at once is the tabs' reading.*
- **Rare tame's modifier:** Haste Aura first (20% attack and cast speed, 10% movement speed to allies within 5 metres,
  the table), not Hasted, which speeds the beast alone; then a shock trail or a defensive aura; rerolled by resetting a
  checkpoint until the rare carries it [mob-beastmaster] §5, §8. *Checked against the table; the reroll unverified.*
- **Spirit:** two tames reserve 78–90% of maximum Spirit (Silverfist 47.4%, the guide's rares 30.6–42.3%, pin:
  `Data/Spectres.lua`), so the flat-cost gems share the rest; reservation efficiency, which cuts the percentage too
  (pin: `Modules/CalcDefence.lua`), makes room: Idol of Ralakesh, Idolatry's 2% per Idol [mob-beastmaster] §3.
  *Checked; Idolatry's place in the guide inferred.*
- **Levers:** companion damage and attack speed, minion levels (helmet, amulet, sceptre, Trenchtimbre), and a
  high-physical main hand for The Catha's Balance (companions gain 60% of its damage, pin) [mob-beastmaster] §4.
  *Node checked; the guide's level ranges run one above the pin's.*
- **Survival:** Loyalty on every damageable companion (10% of hit damage taken from it first, pin), Captivating
  Companionship and Starkonja's Head; Sylvan's Effigy allows any number of companions of different types (pin), each
  with its own Loyalty [mob-beastmaster] §7. *Lines checked; how the shares add is not established.*
- **Unique tame's modifier:** a tablet giving unique monsters an extra rare modifier puts Extra Crits (300% increased
  crit chance) on the tame [mob-beastmaster] §4, §8. *Unverified: no tablet line is in the pin.*
- **Campaign:** Twister and Whirling Slash until Act 3's second ascendancy, then a respec (about 20k gold) to the tames
  [mob-beastmaster] §5. *Tame Beast's tier checked.*

**Pattern shapes:**

- **A tamed rare beast** (existing): add a damage-dealing unique tame beside a supporting rare, the Haste reading of §8
  (it answers the entry's Hasted-or-Haste-Aura caution) and the two-tame Spirit sum. The guide's figures could fill
  table gaps (Enraged; Temporal Bubble; physical aura 30% against 40%), each unverified.
- **Stat-to-damage bridge** (existing, reversed): The Catha's Balance carries the player's weapon damage to the
  companions, so the main hand is bought for the beast; possibly a new entry.
- **Weapon set 2 job** (existing): Parry and Refutation on set 2, a second sceptre keeping the Spirit (inference).
- **A count as a multiplier** (existing): Zoo's Muster over many companion types. New: a per-actor defensive share,
  each extra damageable companion carrying one more Loyalty.
- **A rule changer** (existing): The Natural Order, Sylvan's Effigy, Giant's Blood, Lord of the Wilds.
- **Inert minions** (existing): skeletons as Pain Offering's sacrifices.

**What PoB, or our plan, might not model:**

- The Natural Order's four lines are unparsed, and Tame Beast's four-modifier line is possibly unmodelled (coverage);
  the kept modifiers go in as the table's custom modifiers or config entries (PG-56). Checked.
- A plan holds one companion per stage (`companion {species, mods}`, `src/plan/companion.ts`); the guide runs two
  tames from Act 3 SWAP and four in Zoo. Checked in code.
- The tablet's extra modifier isn't in the pin's data (lookup); Enraged, Temporal Bubble and the invulnerability
  aura are `none` rows in the table.
- The Catha's Balance, Idolatry and Loyalty are fully parsed (coverage); whether PoB sums several Loyalty shares is not
  established.
- Parry's 100% more attack damage taken, Intimidate's figure and Pain Offering's numbers: not established.
