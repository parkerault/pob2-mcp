# Widowhail Spark Blood Mage (Barczi POE2, 0.4)

An agent's study report, kept verbatim (2026-10-10). Brief: `briefs/offmeta-brief-2.md`.
Its claims are the agent's; the PoB gaps it cites were re-checked in `../pob-gaps.md`, and its patterns are consolidated in `../worklog.md`.

---

**1. Header**
- Video: YHIm3ACDtHc, "Crazy Off Meta Blood Mage… ONE CLICK Clears Everything | PoE 2", by Barczi POE2, uploaded 2026-02-26.
- Patch: 0.4.x. The map panel on every frame reads "Fate of the Vaal League". This is the patch before ours (0.5.4).
- Ascendancy: Blood Mage. Main skill: Spark.
- Budget: the creator calls it "budget friendly" and says the bow and quiver are "really cheap". This video shows a "min-maxed" version, though, with a Headhunter belt, Atziri's Acuity gloves and a sanctified amulet. He says an earlier video covered a 100-divine version.

**2. The chain**
1. **The amplifier (00:40, frame 00:45).** The bow is a corrupted Widowhail Crude Bow rolled at "280% increased bonuses gained from Equipped Quiver". He says it needs at least 268%, because the tree adds 32% (00:46–00:54). The target is 300%, which multiplies every quiver line by four. Confirmed on a frame and in PoB data. PoB's data range is only (150-250)% (Data/Uniques/bow.lua:123), so the 280% roll has to be typed in by hand.
2. **The amplified stats (00:54–01:14, frame 01:03).** The quiver is a rare Serrated Quiver ("Kraken Quill") with:
   - +2 to Level of all Projectile Skills
   - 45% increased Projectile Speed
   - 25% chance to Pierce an Enemy
   - Projectiles deal 20% increased Damage with Hits against Enemies further than 6m

   Multiplied by four, these come to about +8 levels, about 180% projectile speed, about 100% pierce and 80% far-hit damage. Spark is a projectile spell (Data/Skills/act_int.lua:19899), so all four apply to it. Confirmed on a frame.
3. **Projectile speed becomes damage (02:15, frames 02:23 and 02:26).** Projectile Acceleration III: "Increases and reductions to Projectile speed also apply to Projectile Damage with Supported Skills", plus 40% more projectile speed. He says it "doubles our damage". I didn't see a DPS number on my frames. Confirmed on a frame and in PoB data.
4. **Mana as a damage stat, costs paid in life (02:28–03:00, 01:25–01:45).**
   - Archmage gives spells extra lightning damage per 100 maximum mana, and costs more mana (Data/Skills/act_int.lua:163–167). It is on screen at level 24 (frame 02:26).
   - Zenith on Spark gives more damage while above 90% of maximum mana (speech only).
   - Atalui's Bloodletting and Lifetap turn mana costs into life costs (speech only).
   - He stacks mana on rings and the amulet, and wants 25% life cost efficiency on the gloves (speech only).
   - I infer, without a frame, that the gloves are the pre-0.5 Atziri's Acuity, which has "Leech from Critical Hits is instant" (Data/Uniques/gloves.lua:9,21). That would refill life from his spell life leech.
   - Side note: in maps, life and mana both show 150% of their maximum (for example 5,652/3,768 mana). The video doesn't explain why. It makes Zenith's 90% condition trivial.
5. **Crit (03:11, frame 03:15).** The Blood Mage node Sunder the Flesh sets "Base Critical Hit Chance for Spells is 15%". The rest of the tree goes into spell crit. Cast on Critical (level 24, confirmed) triggers Arc. Confirmed on a frame.
6. **Clear speed.** Headhunter belt and Mana Remnants (speech only).

**3. Patterns**
- **New: amplified slot as stat stick.** Wear a weapon your skill doesn't use, because an item multiplies another slot whose mods match your skill's tags. Here a spell caster holds a bow only so Widowhail can multiply quiver projectile mods. This works with any projectile spell.
  - Search step: start from the skill's tags. Look through item mod pools by tag, not by slot ("Projectile" mods on quivers). Then grep uniques and the tree for "increased bonuses gained from Equipped <slot>" or "<slot> effect", and check what the slot requires (a quiver needs a bow equipped).
- **New: stat-to-damage bridge.** A modifier makes increases to a non-damage stat count as damage, so you stack that stat from its cheapest or most amplified source.
  - Search step: grep supports, the tree and uniques for "also apply to" or "apply to Damage". Then list every source of the bridged stat, preferring sources that are already amplified (like the quiver).
- **New: cost redirection.** Move skill costs onto a second pool so the first pool stays full and works purely as a damage stat. Sustain the second pool with leech. It sits next to **forced condition** (Zenith's above-90% condition is held true by never spending mana), but the enabler is different.
  - Search step: start from damage that scales with the size or fullness of a resource (Archmage, Zenith, "while on full X"). Then look up every "Mana cost into Life cost" converter (Lifetap, Atalui's Bloodletting, Blood Mage) and the sustain for the paying pool.
- Cast on Critical into Arc is standard, so it isn't a pattern.

**4. How PoB follows it**
- Modelled:
  - Quiver scaling (Modules/CalcSetup.lua:1449–1456, ModParser.lua:4908), including scaled skill levels (Data/ModCache.lua:327, keyOfScaledMod).
  - Projectile Acceleration III (Data/SkillStatMap.lua:899, Modules/CalcOffence.lua:845–850).
  - The far-hit mod, through the enemy-distance config (ModCache.lua:6461 pattern).
  - Archmage (act_int.lua:225–230), Zenith (via config), and the spell crit override (ModCache.lua:4849).
- Count is optional: set it to the number of sparks expected to hit one boss. The chain doesn't depend on it.
- Gaps against our 0.5.4 data:
  - Widowhail's 280% roll is above the data range.
  - Atziri's Acuity was reworked in 0.5.0. The instant-leech version is only a "Pre 0.5.0" variant.
  - Sanguimancy in our 0.5 data reads "Skills gain a Base Life Cost equal to Base Mana Cost" (TreeData/0_5/tree.lua:36706). That may not match the 0.4 version.
  - Spark in 0.5 has a Cold Infusion mechanic.
  - The life and mana overflow above maximum isn't explained.

**5. Evidence and quality**
- What he shows: in-game tooltips and the skill panel, then T17 map footage (3 rare tablets, an Abyss-overrun map from 05:26).
- No PoB numbers and no boss kill, although the description claims pinnacle kills.
- Quality: an 8-minute, item-by-item walkthrough. The mechanics explanation is good for the quiver arithmetic. The rest of the tree is mostly "here and here" pointing, and the cost and sustain logic is never stated outright.

**6. For the brainstorm phase**
- He back-solves the item roll from a target breakpoint: 300% total means a 4× quiver, so 268% on the bow plus 32% from the tree. Pick the multiplier you want, then compute the roll needed.
- He treats an equip restriction as a price, not a wall: the bow's only job is to unlock the quiver slot.
- He checks a support by toggling it and reading the in-game DPS change. That's a claim here; I didn't see the number.

**7. Links seen (unopened)**
- Mobalytics build: https://mobalytics.gg/poe-2/profile/52af3805-d6ed-481f-9889-daa674aef459/builds/44904455-02e0-4eab-9d0c-6fbe532e8443
- Discord: https://discord.gg/bTsxb4NVYh
- No PoB, pobb.in or poe.ninja links.

**8. Reference entry**
```
- YHIm3ACDtHc (Barczi POE2, 0.4) Widowhail Spark Blood Mage: Widowhail ~300% quiver effect x rare quiver
  (+2 proj levels, 45% proj speed, pierce, far-hit dmg) -> Projectile Acceleration III turns proj speed into
  damage; Archmage + Zenith scale off a full mana pool while Lifetap/Atalui's move costs to life; spell crit via Sunder the Flesh.
  Patterns: amplified slot as stat stick (new), stat-to-damage bridge (new), cost redirection (new) / forced condition.
  Links: mobalytics build only (no PoB). PoB gaps: Widowhail 280% over data range; pre-0.5 Atziri's Acuity.
```

Frames used: 9 (bursts at 00:42, 00:53, 01:00, 02:20; frames at 00:45, 01:03, 02:23, 02:26, 03:15).
