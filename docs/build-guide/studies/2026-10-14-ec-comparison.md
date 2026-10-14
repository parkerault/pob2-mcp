# Explosive Concoction: our build against two poe.ninja builds (2026-10-14)

**EC** is our offline test run (`/tmp/m15.C1xp/guides/open-explosive-concoction/2026-10-12-1`), non-budget rung, L95. **EC-78k** and **EC-98k** are poe.ninja imports. All read-only; figures are PoB's unless marked as estimates.

## 1. Summary

1. The real builds model Explosive Concoction as we did: a level-20 gem group with five supports. PoB's own level-1 granted copy sits unused in all three files.
2. Hit DPS gap: ×3.10 (98k) and ×2.19 (78k). Combined, with our ignite: ×1.67 and ×1.33.
3. Largest cause: speed. They make 2.33 and 1.94 throws a second to our 1.60.
4. Second: base damage, ×1.32 a hit. Sunsplinter's +3 fire levels make the gem 26 to our 23, plus added fire on three slots to our one.
5. Third: conditions they hold permanently, a flask effect (Lavianga's Spirits) and moving. Ours went into ignite.
6. Our research found those conditions and Multishot II (cards r1-c-2, r1-c-3, r1-a-3), but the test run's pick-the-first-two rule never sent them to design. No step searched fire skill levels.
7. EC leaves free value: no charms, an empty allocated jewel socket, 12 of 36 rare affix slots open, and a support that adds no damage (Mana Bounty; Deliberation measures +20%).
8. EC's paths are as short as any route to its notables. Its non-budget gear is its budget gear with better rolls.

## 2. The three builds side by side

| Defence | EC (L95) | EC-78k (L93) | EC-98k (L91) |
|---|---|---|---|
| Life / ES | 2,583 / 44 | 2,574 / 0, ward 1,037 | 1,981 / 669 |
| EHP | 11,198 | 18,271 | 13,926 |
| Res fire / cold / light / chaos | 75/75/75/75 | 78/77/76/72 | 76/78/77/67 |
| Max hit phys / fire / cold / light / chaos | 3.9k / 10.6k / 10.6k / 10.6k / 10.4k | 4.7k / 15.4k / 14.8k / 14.3k / 12.9k | 3.6k / 10.2k / 11.0k / 10.6k / 7.3k |

| Offence (main group) | EC | EC-78k | EC-98k |
|---|---|---|---|
| Hit / ignite / combined DPS | 31,654 / 27,365 / 59,019 | 69,240 / 9,451 / 78,691 | 98,269 / 0 / 98,269 |
| Average hit, throws a second | 19,798, 1.60 | 35,775, 1.94 | 42,209, 2.33 |
| Crit chance, multiplier | 6%, 3.5 | 5%, 2.0 | 5%, 2.07 |
| Fire penetration | 40% (18 from the anoint) | 36% | 48% |
| Enemy in config | map monster, 0% res | Pinnacle, 50% res | Pinnacle, 50% res |

| Passives | EC | EC-78k | EC-98k |
|---|---|---|---|
| Ascendancy, beyond the shared Brew Concoction, Path Seeker, Relentless Pursuit | Sustainable Practices, Evasion | Enduring Elixirs, Life Flask Charges | Running Assault, 2nd Skill Speed |
| Keystone | none | Iron Reflexes | none |
| Speed notables | Blood Rush | Sand in the Eyes, Stimulants | the same, plus Acceleration and Imbibed Power |
| Conditional damage | Fulmination, Sigil of Fire, Total Incineration (all against ignited enemies) | Crystal Elixir, Spray and Pray, Run and Gun, Ichlotl's Inferno, Giantslayer | the same, plus Harness the Elements and Maiming Strike |
| Ignite / crit notables | 5 / 3 | 0 / 0 | 0 / 0 |
| Main-tree points | 123 | 146 (likely incl. weapon-set passives) | 120 |

| Gear (explicit affixes on rares) | EC | EC-78k | EC-98k |
|---|---|---|---|
| Off hand | rare buckler (4) | Sunsplinter | Sunsplinter |
| Helmet, body | rare (4), Lightning Coil | rare (6+rune), rare (6+rune) | The Hollow Mask, Morior Invictus |
| Gloves, boots | Candlemaker, rare (4) | rare (6), rare (6+rune) | rare (6), rare (6) |
| Amulet (all +3 projectile) | rare (4), Cremation anoint | rare (6), Imbibed Power anoint | rare (6), Fulmination anoint |
| Rings, belt | Cracklecreep, rare (5); belt (3), 1 charm slot | rares (6, 6); belt (6), 3 charm slots | rares (6, 6); belt (6), 3 charm slots |
| Jewels | 1 Ruby, 2nd socket empty | 3 rare | 2 rare, Heart of the Well |
| Charms | none | Thawing, Beira's Anguish, For Utopia | Thawing, Sanguis Heroum, Stone |
| Flasks | plain Life, Mana; toggled off | Life, Lavianga's Spirits; on | Life, Lavianga's Spirits; on |

## 3. Why their Explosive Concoction does more

| The skill | EC | EC-78k | EC-98k |
|---|---|---|---|
| Source, skill level with gear | gem group, 20 → 23 | gem group, 20 → 26 | gem group, 20 → 26 |
| Supports | Elemental Armament II, Fire Attunement, Ignite III, Fire Exposure, Mana Bounty | Elemental Armament II, Fire Attunement, Multishot II, Longshot II, Vorana's Siege | Elemental Armament II, Elemental Focus, Deliberation, Immolate, Multishot II |

98k against EC. Hit DPS ×3.10 = average hit ×2.13 × speed ×1.46. Causes, largest first:

| # | Cause | Size | Evidence |
|---|---|---|---|
| 1 | Attack and skill speed | ×1.46, measured | +107% increased (tree 85%, gloves 16%, Heart of the Well 6%), less Multishot II's 20%, against our +14%. The sums reproduce the measured ratio. |
| 2 | +3 levels, flat fire | ×1.32 a hit | Level 26: 566–849 base at 224% effectiveness; level 23: 471–707 at 204% (gem lookup). Added fire to attacks: 56–87 on three slots against our 25–40 on one. |
| 3 | Increased damage | ≈×1.22 | About +740% against our +590%. About 250 points of theirs are conditional: moving 102%, flask effect 65%, Rage 30%, rare or unique target 57%. |
| 4 | Support multipliers | ≈×1.17 | Theirs: 1.25 × 1.25 × 1.2 × 1.3 × 0.75 ≈ 1.83. Ours: 1.25 × 1.25 ≈ 1.56. Ignite III and Fire Exposure buy our 27k ignite instead, and Mana Bounty adds nothing. |
| 5 | Extra fire | ≈×1.05 | Heart of the Well's 11% against Cremation's 6%. |
| 6 | Crit, in our favour | ≈×0.92 | Three crit notables give us +10% at 6% chance. |
| – | Not attributed | ≈×1.17 | Resistance handling and small modifiers. |

Rows 2–6 are estimates from gem data and modifier sums. The real builds build the throw's hit. EC spends 9 notables on ignite and on hits against ignited enemies, and ignite is 46% of its DPS. EC-78k has the same tree and gear engine less Imbibed Power and Primal Sundering, and no Elemental Focus. It adds Longshot II: 35% more damage beyond 7 m, applied in full at PoB's default 20 m distance.

**Model check:** both real builds show the skill at level 20 with five supports at L91–93, as the gem's level table predicts (level 20 needs L90). The gap isn't a modelling artifact.

## 4. The user's observations

### 4.1 Left on the table: confirmed

- **Charms:** none in EC, three in each real build. PoB can't measure charm triggers (they're unparsed), so ranking by PoB never picks one.
- **Jewel socket:** socket 26725, allocated in Act 3 as a path node, stays empty at every rung. Filling it costs no point.
- **Affixes:** EC's six rares use 24 of 36 affix slots. Every real rare has 6, plus runes on the 78k's armour.

### 4.2 Pathing: efficient; it's the targets

| | EC | EC-78k | EC-98k |
|---|---|---|---|
| Notables + keystones, jewel sockets | 25, 2 | 34, 3 | 26, 3 |
| Nodes taken only to connect them | 96 | 102 (+7 dead-end) | 90 (+1) |
| …of them "+5 to any Attribute" | 49 | 35 | 39 |
| Greedy shortest connection, same targets | 99 | 103 | 88 |

EC connects its targets in fewer nodes than a greedy shortest route (on PoB's 0.5 tree), wasting nothing. It looks odd because its targets are far-apart ignite and crit clusters, reached through attribute nodes. The real builds route through damage nodes. `find_path_to_node` from EC's tree: Crystal Elixir 6 points, Spray and Pray 7, Forces of Nature 7, Smoke Inhalation 9, Stimulants 10.

### 4.3 Campaign order and respecs: confirmed, by design

The campaign rules (D2) require each stage's tree to contain the previous one, so EC's nine trees are nested and nothing is dropped. Hit DPS still rose at every stage, from 154 to 10,593. The weak stage is Act 3: 22 points, 19 of them connecting, for two notables and the empty socket. Respec planning would gain a modest speed-up there, at the cost of per-stage alternative trees, gold and guide steps.

### 4.4 Budget against non-budget: near-true

The sets differ in 6 of 10 slots, but only by rolls on the same bases and names. Two lines add damage: the amulet goes from +1 to +3 projectile levels, and the ring gains Adds 25–40 fire. The uniques, flasks, belt and empty slots match. A non-budget rung should change build-defining pieces: a +levels off hand, Lavianga's Spirits, a damage jewel, 6-affix rares with attack speed and added fire, and filled charm and jewel slots.

### 4.5 PoB warnings

| Build | Warning | Verdict |
|---|---|---|
| 98k | Spirit −39 | **PoB gap:** The Hollow Mask's "100% increased Reservation Efficiency of Remnant Skills" is partly parsed, so PoB applies none of it. |
| 78k | 10 gem groups, max 9 | **Import gap:** the export makes the ascendancy-granted Explosive Concoction an ordinary gem group, and PoB counts it. The game ran all 10. |
| Both | Chaos res 3% and 8% short | **Real, by choice:** a common trade, not a PoB error. |
| Both, unflagged | Level-12 Elemental Weakness on a level-82 enemy | **PoB overstates:** "Curse does not apply to enemies above level 61" is unmodelled. |

## 5. Lessons for the pipeline

Steps: research (R1a), card verification (R1b), endgame design (D1-build, then D1-finish), campaign (D2), guide writer (W1).

| # | Change | Step | Benefit | Cost | Do? |
|---|---|---|---|---|---|
| 1 | Search +level sources for every tag and slot of the main skill; a weaponless skill can use an off-hand such as Sunsplinter. | D1-build | ≈+20% hit | 2–3 lookups | **Do** |
| 2 | Run `suggest_supports` on the main group at the top rung. Swap a no-damage support for the top-measured one; sustain charges from belt mods. | D1-build | +20% measured | 1 call | **Do** |
| 3 | Measure the 2–3 largest multipliers from every dealt card (test runs verify only two). | D1-build | the 98k's engine, ≈×1.2–1.5 est. | ~3 measures | **Do cheaply** |
| 4 | Treat an unparsed key enabler (Lavianga's "applies its Effect constantly") as an earned config stand-in with an uptime note, not a reason to drop it. | R1b, D1-build | unlocks the flask-effect notables | rule text | **Do** |
| 5 | Fill every allocated jewel socket and charm slot (charms from a fixed freeze, stun, bleed and ignite checklist). Give non-budget rares 6 affixes. | D1-finish | free value; unmeasured | 1 compile | **Do cheaply** |
| 6 | Make the non-budget rung change build-defining items, not rolls. | D1-finish | a real second variant | none | **Do** |
| 7 | Also report top-rung DPS against a Pinnacle boss; penetration is worthless against our 0%-res monster. | D1-finish | honest boss DPS | 1 measure a rung | **Do cheaply** |
| 8 | Raise the granted-skill socket judgment's confidence (5 supports, level 20 at L90+) with this evidence. | data | removes a guide caveat | 1 entry | **Do** |
| 9 | Path optimisation. | D1-build | none: routes are already short | high | **Skip** |
| 10 | Campaign respec planning. | D2, W1 | modest, one or two stages | high | **Skip**; revisit if a stage misses its damage target |

## 6. Caveats

- PoB credits Multishot II only with its 25% less damage and 20% less speed, and ignores Run and Gun's extra projectiles. For all three builds it ignores the throw's 5 mana-flask charges, so a lone boss's real throw rate is charge-bound.
- The real numbers rest on toggles: moving, flask on, 30 Rage, enemy ignited and chilled, the 78k's banner. The 98k's throw can't ignite, so "enemy ignited" needs its other skills. EC uses only earned settings.
- §3's rows 2–6 are sums, not engine breakdowns.
- The poe.ninja builds are snapshots, not optima. EC's gear is unpriced, so nothing here speaks to cost.
