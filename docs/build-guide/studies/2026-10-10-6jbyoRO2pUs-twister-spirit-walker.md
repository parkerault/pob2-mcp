# Twister Spirit Walker (SiahZ)

An agent's study report, kept verbatim (2026-10-10). Brief: `briefs/offmeta-brief-2.md`.
Its claims are the agent's; the PoB gaps it cites were re-checked in `../pob-gaps.md`, and its patterns are consolidated in `../worklog.md`.

---

## Header
- Video: 6jbyoRO2pUs, "Path of Exile 2 | BEST Twister Spirit Walker Build! (PoE 2 0.5 Huntress Guide)".
- Creator: SiahZ. Uploaded 2026-06-09.
- Patch: 0.5 (from the title).
- Ascendancy check: Spirit Walker is in PoB's data with all the nodes he names, so the ascendancy is not newer than our data. Two catches:
  - Whisper's "Mach's Gift" is The Mhacha's Gift, and "Sacred Union" is Sacred Unity.
  - The in-game Mhacha's Gift text (frame 10:44) says "up to **3** Owl Feathers". PoB's tree data says "up to **2**". So the video's patch differs from our data in at least this node.
- Ascendancy / skill: Spirit Walker (Huntress), with Twister as the main skill.
- Budget: he frames it as an endgame update. He names cheaper fallbacks: Palm of the Heart instead of Sacred Flame, and The Ordained as a "middle ground" next to a top-tier rare spear.

## The chain
1. **Base hit.** Twister is on weapon set 2: the spear The Ordained (heard as "Ordained Grand Spear", 02:24), with a Sacred Flame sceptre for extra fire (03:35). Both are confirmed in PoB data only (spear.lua:44, sceptre.lua:103).
2. **All three elements for free.** The Taming ring (05:07, confirmed on frame 05:20 and at ring.lua:332) makes wind skills count as boosted by Ignited, Shocked and Chilled Ground at once. Twister gains 50% of its damage as each boosting element (Twister's own stat in act_dex.lua). Every "per element type" scaler then fills up (speech only):
   - the ring's own per-ailment-type line;
   - the Stormbreaker anoint (06:12);
   - Harness the Elements (12:42);
   - Trinity (09:47), which wants the three elements kept balanced.
3. **Whirlwind feed.** Whirling Slash runs on weapon set 1 with a fast Skysliver and an empty offhand (06:21–06:36). By PoB's game text, Twister consumes whirlwinds to spawn extra twisters, with 80% more damage per Whirling Slash stage. He never explains this link; it rests on PoB data.
4. **Extra projectiles.** Dodging spends Owl Feathers to trigger Primal Bounty, which gives the next projectile skill more projectiles and speed.
   - The Mhacha's Gift doubles that per extra feather (frame 10:44).
   - Olroth's Conviction (heard as "Oros Conviction") stretches one dodge to 3 attacks (06:50). Frame 06:53 shows "Empower 2 additional Skill uses".
   - He claims "20 projectiles" (12:01), speech only.
5. **Speed becomes damage.** Projectile Acceleration III is on Twister (frame 09:01: "increases and reductions to Projectile speed also apply to Projectile Damage"). That turns the projectile speed from Primal Bounty, Kite Runner (14:52) and a Timeless jewel (15:24) into damage.
6. **Repeats.** Barrage with Uhtred's Constellation (09:19) has 2 extra cooldown uses (PoB data, other.lua:19513), so it can be cast three times in a row.
7. **Resistance removal.**
   - Heavy Frost makes hits ignore non-negative elemental resistances of frozen enemies.
   - He reaches it through a From Nothing jewel placed near Chaos Inoculation instead of an anoint (14:09).
   - Freeze comes fast: Sine Aequo gloves (heard "Santa Cleo", 04:14; gloves.lua:402, "Immobilise at 50% buildup"), Ice-Tipped Arrows with the Freeze support (09:11), and the Hail notable (12:25).
   - Before the freeze lands, the Spirit Vessel companion from the Forgotten Warden Primal Markings body armour (00:53) casts Oil Barrage (heard "all brazen", 02:06). Brutus' Brain keeps the companion from dying (07:37).
8. **Crit.** Blindside on Twister (frame 08:24) means Twister can no longer Blind. A Blind support on the Spirit Vessel puts the Blind back (07:44).

## Patterns
- **Forced condition** (lower a threshold, or get a condition for free): The Taming supplies all three ground surfaces, and Sine Aequo halves the freeze buildup needed.
- **Proxy multiplier** (copies multiply the main skill): Primal Bounty's extra projectiles, spawned twisters and Barrage repeats.
- **Not-consume to 100%** (a per-use cost becomes a one-time unlock), stretched variant: Olroth's Conviction and Uhtred's Constellation spread one trigger over 3 uses.
- **Conversion** (change the damage type so another mechanic applies): Ice-Tipped Arrows turns physical into cold, so freeze and Heavy Frost apply (03:10).
- **Weapon set 2 job**, inverted: weapon set 1 does the setup (whirlwinds). Each set's own passive points go to attack speed or to damage (10:57–13:40).
- **Inert minions** (minions as triggers or headcount): an unkillable companion carries debuffs.
- NEW **saturated type count:** one enabler fills a "per distinct type" counter, then you collect every scaler that reads it. Search: start from an item or node that grants several types at once, then grep ModCache and the tree for "for each type of" / "per … type".
- NEW **stat bridge:** an "X also applies to damage" clause turns a cheap non-damage stat into damage. Search: grep the supports and ModCache for "also appl", filtered by the main skill's types, then list sources of X.
- NEW **drawback offload:** take a support whose cost is "cannot inflict X" while another skill or companion inflicts X. Search: grep support descriptions for "cannot", check whether the bonus depends on that debuff, then find a free skill slot to carry it.

## How PoB follows it
- **Modelled:**
  - Twister's element gains: three config checkboxes (ConfigOptions.lua:677–684) can stand in for The Taming. The ring's lines themselves aren't parsed (ModCache.lua:6907, 6915).
  - Whirlwind stages (ConfigOptions.lua:715).
  - Heavy Frost (ModCache.lua:5940).
  - Projectile Acceleration III (SkillStatMap.lua:899, CalcOffence.lua:845).
  - Barrage repeats (CalcOffence.lua:962–966).
- **Count-approximated:** twisters overlapping one boss, from the extra projectiles plus the spawned twisters. Roughly 2–4; it's a guess, since the video shows no single-target count.
- **Can't be followed:**
  - Primal Bounty's speed stat has no stat mapping; it appears only at Data/Skills/other.lua:12919. Its extra-projectile count isn't in the data at all.
  - The Mhacha's Gift isn't parsed (ModCache.lua:5222).
  - Olroth's Conviction's extra uses aren't modelled.
  - The fallback is a hand calculation: enter the speed as increased damage, weighted by uptime.
- **Missing from PoB's data:** nothing. Every unique, gem and node he names exists, apart from the Mhacha's Gift text difference noted in the header.

## Evidence and quality
- Evidence: boss footage only (The Bodach, with an unlabelled 12,641,233 counter at 00:08), plus in-game tooltips, the skill panel and the tree. No PoB numbers.
- His single "test" is "in my testing" for Concentrated Area (08:45).
- Quality: an update changelog that gives a one-line reason per pick but doesn't explain the core interactions (whirlwind consumption, how the ring works). Whisper misheard many names.

## For the brainstorm phase
- Price the unique against the equivalent rare and buy the cheaper one (02:47).
- If a support costs you a debuff you rely on, re-source the debuff from a slot that doesn't deal the damage (07:44).
- Before spending an anoint, check whether a radius jewel (From Nothing, Controlled Metamorphosis) can reach the notable (14:17).

## Links seen (unopened)
- mobalytics.gg/poe-2/profile/siahz/builds/siahz-s-spirit-walker-twister
- mobalytics.gg/poe-2/builds/spirit-walker-twister
- A filterblade.xyz loot filter
- Stream and social links only besides these. No PoB, pobb.in or poe.ninja links.

## Reference entry
- 6jbyoRO2pUs (SiahZ, 0.5): Spirit Walker Twister.
- Chain: The Taming gives all three elements, then per-type scalers; Primal Bounty plus Olroth's Conviction give extra projectiles over 3 attacks; Projectile Acceleration III turns speed into damage; Heavy Frost plus a fast freeze remove resistances.
- Patterns: forced condition, proxy multiplier, not-consume (stretched), conversion, weapon set job (inverted), plus new: saturated type count, stat bridge, drawback offload.
- PoB: the Primal Bounty chain is unmodelled. No PoB link; Mobalytics only.
