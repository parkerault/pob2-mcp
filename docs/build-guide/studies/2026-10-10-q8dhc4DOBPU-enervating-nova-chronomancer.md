# Enervating Nova Chronomancer (Troy Tesko)

An agent's study report, kept verbatim (2026-10-10). Brief: `briefs/offmeta-brief-2.md`.
Its claims are the agent's; the PoB gaps it cites were re-checked in `../pob-gaps.md`, and its patterns are consolidated in `../worklog.md`.

---

HEADER
- Video: q8dhc4DOBPU, "Enervating Nova Chronomancer | Path of Exile 2 (0.5) Off-Meta Build Guide"
- Creator: Troy Tesko
- Patch: 0.5, the Runes of Aldur league (the character sheet shows this)
- Build: Chronomancer, level 93; main skill Enervating Nova. The creator gives no budget tier. The chase pieces are expensive (a high +skill staff, a Vaal-rolled Doryani's, a cast-on-crit amulet). His cheap path is a +4/+5 staff, a "10 exalt Doryani's" and Magnified Area (04:47, 05:53, 02:24).

THE CHAIN
1. Base skill (00:00, 04:36). Enervating Nova is an implicit skill on any Paralysing Staff. It costs 0 mana at every level (confirmed in data, sup_int.lua:4286; he mentions it at 03:46). It scales with +skill levels and shows level 30 on the frame at 02:20. Its damage roll is very wide: 14–265 at gem level 20.
2. The skill's own multiplier (00:58–01:27). Up to 100% more damage at the outer edge of the ring, none in the inner ring. Confirmed in data: `new_shock_nova_distance_based_damage_+%_final 100` (sup_int.lua:4360). Slows keep enemies at the edge: Temporal Chains on Blasphemy (03:20), and the ascendancy node he calls "Apex of the Nova", which the data names Apex of the Moment ("Enemies in your Presence are Slowed by 20%", tree.lua:104950).
3. Main multiplier: Doryani's Prototype (05:03). Confirmed on the 05:45 frame: "Enemies in your Presence have Lightning Resistance equal to yours", "Lightning Resistance does not affect Lightning damage taken", "+100% of Armour also applies to Lightning Damage". His copy also has a Vaal-rolled "-60% to Lightning Resistance".
   - Ventor's Gamble rolled to -48% lightning res, helped by "Quality (Lightning Modifiers) +20%" (06:45 frame). Kalandra's Touch mirrors it into the second ring (06:59, speech only).
   - Result: -200% (-201%) lightning res on the 05:20 frame, which is the floor.
   - The effect only reaches enemies inside Presence radius, so his Presence-area nodes are needed for damage (05:23).
4. Bimodal plus lucky (02:05, 10:38, 11:08). Esh's Prowess makes lightning roll only its minimum or maximum (data: other.lua:5778; not checked on a frame). Lightning Rod gives 30% chance for lightning hits to be lucky (frame) and Heart of the Well gives 18% (frame), so 48% lucky in total.
5. Copies (01:55, 08:42). Spell Cascade (speech only). Trickster's Shard: Fractured Mimics recast the spell at 50% less damage (01:58 frame). Now and Again: 20% chance to repeat. Vorana's Siege: 35% increased area and 20% more damage against isolated targets (02:20 frame; the transcript says "Varana's").
6. Secondary damage and speed:
   - Cast on Critical (granted by the amulet) with Lightning Warp (02:45, speech). Pinpoint Critical: 60% more crit chance, 30% less crit damage bonus (01:42 frame).
   - Skill speed: Combat Frenzy and Charge Regulation, plus the Thaumaturgical Dynamism anoint, which grants charges by the attribute requirements of your skill gems (04:04, 11:43; speech).
7. Defence: Mind over Matter on a 1,000-mana pool (03:53). Armour applies to lightning via Prism Guard and Shockproof. The 05:20 frame shows 14,912 armour and 81% physical damage reduction.

PATTERNS
- **Zeroed resource:** Doryani's makes your lightning resistance count for nothing against lightning damage you take. Every negative lightning-res roll then costs nothing.
- **NEW "mirrored stat":** an effect copies one of your own stats onto enemies, so you push that stat as low as it goes. The item doing the copying here also cancels the drawback. PoB's parser handles this for any resistance type (ModParser.lua:6005).
  - Search step: grep uniques and the tree for "equal to yours". Then, from the copied stat, list every source of a negative roll: unique ranges that go below zero, Vaal outcomes, catalyst quality (it enlarges a negative roll too), and Kalandra's Touch to double a ring.
- **NEW "bimodal roll plus luck":** making a roll min-or-max does not change the average on its own. Add lucky and the max comes up 75% of the time instead of the 67% you get from a uniform roll.
  - Search step: from the skill's damage type, find "minimum or maximum" sources and lucky sources of the same type. Prefer skills with a large max/min ratio.
- **Proxy multiplier:** Spell Cascade, Trickster's Shard mimics, Now and Again.
- **Weapon set 2 job:** a swap staff with Sigil of Power, plus weapon-set-2 passive points spent on cooldown recovery and area (02:29, 10:55).
- **Forced condition (weak fit):** slows hold enemies at the ring edge.

HOW POB FOLLOWS IT
- **Modelled:**
  - The Doryani's resistance copy: CalcOffence.lua:539-540 sets enemy resistance to yours, clamped at ResistFloor -200 (Modules/Data.lua:242). It is gated on EnemyInPresence, which compares Presence radius with the configured enemy distance (CalcPerform.lua:524).
  - The self side parses as SelfIgnoreLightningResistance (ModCache.lua:6125).
  - Kalandra's Touch (CalcSetup.lua:1305) and lucky chance (CalcOffence.lua:4074) are both handled.
- **Hand calculation:**
  - Esh's `lightning_damage_roll_always_min_or_max` is mapped nowhere. PoB averages a lucky roll as if uniform: min/3 + 2·max/3 (CalcOffence.lua:4077).
  - With min-or-max rolls, a lucky hit actually lands at the max 75% of the time, not the 67% of a uniform roll. At 48% lucky that puts the max weight at 0.62 against PoB's 0.58, so PoB undercounts by about 7%.
  - The edge-distance bonus (sup_int.lua:4360) is unmapped. Count it at up to 2x for edge hits and 0x inside the ring.
- **Count:**
  - Spell Cascade: PoB applies its 30% less damage but not its extra cascades. Use Count 1–3, by how many of the 3 novas hit one target.
  - Trickster's Shard: mimic stats unmapped (other.lua:19107, 19181; limit 4, 50% less damage). Use up to x1.5, if the mimics fill before they expire.
  - Now and Again: unparsed (ModCache.lua:6622). Use x1.2.
- **Unparsed:** Thaumaturgical Dynamism (ModCache.lua:5893).
- **Data coverage:**
  - Present: every named item, gem and node, including Heart of the Well (Special/Generated.lua:233) and the Runemastered Scale Mail base.
  - Not checked: the Vaal Cultivation Orb outcome.

EVIDENCE AND QUALITY
- **Evidence:**
  - In-game tooltips and the character sheet showing -200% lightning resistance.
  - The in-game skill DPS reading of 14,784; he never says whether it includes the enemy resistance change.
  - T16 seven-mod maps with three irradiated tablets.
  - Missing: no PoB numbers, no boss kill, and the claim about 200% delirium maps is not shown.
- **Quality:** a careful gem-by-gem and gear walkthrough with tooltips on screen and cheaper swaps named. The tree section is a loose tour.

FOR THE BRAINSTORM PHASE
- **Implicit skills on base items as main skills:** they cost no mana, scale with +skill levels, and have wide damage rolls. Check that the min/max range is wide before reaching for min/max or lucky effects.
- **Neutralise, then exploit:** when an item says a stat "does not affect" damage you take, every bad roll of that stat becomes free. Stop at the cap; he checks -200% on the character sheet.
- **Patch the hole you open on purpose:** once lightning resistance protects you from nothing, he stacks armour that applies to lightning and shows the resulting reduction.

LINKS SEEN (not opened)
- https://poe.ninja/poe2/pob/22dbc
- https://www.twitch.tv/troytesko

REFERENCE ENTRY
- q8dhc4DOBPU (Troy Tesko, 0.5): Enervating Nova Chronomancer.
- Chain: the 0-mana Enervating Nova from a Paralysing Staff → Doryani's Prototype copies your lightning res onto enemies in Presence, with your own res pushed to -200 by a Vaal-rolled Doryani's and a catalysed Ventor's Gamble doubled by Kalandra's Touch → Esh's Prowess plus 48% lucky → copies from Spell Cascade, Trickster's Shard and Now and Again.
- Patterns: mirrored stat (new), zeroed resource, bimodal roll plus luck (new), proxy multiplier, weapon set 2 job.
- PoB: https://poe.ninja/poe2/pob/22dbc
