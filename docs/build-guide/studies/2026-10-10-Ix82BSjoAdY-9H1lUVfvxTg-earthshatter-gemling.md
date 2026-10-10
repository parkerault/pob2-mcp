# Earthshatter Gemling, endgame and budget (Phylaris POE)

An agent's study report, kept verbatim (2026-10-10). Brief: `briefs/offmeta-brief-2.md`.
Its claims are the agent's; the PoB gaps it cites were re-checked in `../pob-gaps.md`, and its patterns are consolidated in `../worklog.md`.

---

CARD: Earthshatter Gemling Legionnaire (endgame Ix82BSjoAdY, budget 9H1lUVfvxTg)

HEADER
- Videos: Ix82BSjoAdY, "The funnest build I have EVER played – Earthshatter Gemling Legionnaire Endgame Guide [POE2 0.5]" (21:41). 9H1lUVfvxTg, "[POE2 0.5] The strongest budget build I've played – Earthshatter Gemling Legionnaire" (29:00).
- Creator: Phylaris POE. Patch: 0.5, Runes of Aldur league, week 3 (uploaded June 2026).
- Ascendancy: Gemling Legionnaire. Main skill: Earthshatter.
- Budget as stated: endgame is about level 98 with Mageblood, but still a 1-divine weapon. Budget is under 50 divines for everything.

THE CHAIN (endgame)
1. The engine. Gemling's Advanced Thaumaturgy says "Gem Quality grants Socketed Skills an additional effect", i.e. each gem also gets its alternate-quality line. Confirmed in data (tree.lua:47513; PoB flag at ModCache.lua:5683).
2. Earthshatter.
   - It leaves a spike. A warcry shatters the spike for 541% versus 147% for the slam (budget 05:15).
   - Aftershocks hit for the explosion damage without the spike being shattered (budget 05:44). This rests on speech only.
   - Frame (budget 06:07), at 39% quality: "11% more Damage with Hits for each Spike" (limit 6) and "39% chance to cause an additional Aftershock". This matches the data (act_str.lua:4298).
   - Branching Fissures puts out more spikes per attack (endgame 11:26).
3. Base damage.
   - Frost Wall's alternate quality gives +20% ice crystal life per quality point (data). The frame shows "Maximum Life 219952" (budget 07:14).
   - The Verglas frame says: "Destroying an Ice Crystal grants Supported Skills 1% of Damage Gained as extra Cold for 6 seconds, per two thousand maximum Life" (budget 07:27).
   - That works out to about 110% gained as cold on budget and "over 120%" on endgame (01:03).
4. The loop.
   - The Absent Amulet "Grants Skill: Level 18 Cast on Elemental Ailment" (frame 05:52), with a second Frost Wall socketed in it.
   - Freezes spawn walls, Earthshatter breaks them, and Verglas refreshes.
   - Seeding it: a manual Frost Wall, plus Infernal Cry with Vruun's Aftermath, which makes warcries "destroy Ice Crystals" (data other.lua:20664). He does this at map start and before bosses (12:40). Hitting the walls also builds Rage.
5. Freeze consistency. The frame of the Runemastered Olrovasara shows "100% of Lightning Damage Converted to Cold Damage", and its added lightning stacks up to +500 from enemy Power (02:16). So it stays cold even when Verglas lapses.
6. Clear.
   - Herald of Ice runs Armour Explosion and Embitter. Embitter treats Sacred Flame's gain-as-fire as gain-as-cold (data sup_int.lua:3809).
   - Rite of Passage gives "Spirit Of The Wolf" (frame 09:32). Per speech, Wolf breaks armour with any damage (09:34).
   - Loreweave carries "Enemies Chilled by your Hits can be Shattered as though Frozen" (frame 05:10).
   - Result: a shatter explodes, the explosion breaks armour, Armour Explosion chills, and the chilled enemy shatters into the next Herald.
7. Defence to damage.
   - Arctic Armour's alternate quality adds armour per stage. Scavenged Plating adds about 60% more armour. Together that is about 50k armour.
   - War Banner with Refraction III gives "2% elemental exposure per 1,000 armour, capped at 80%" (data sup_str.lua:6041ff).
8. Upkeep.
   - Balance red and blue supports for Gem Studded's "Skills have 30% less cost". His demo shows 75 versus 106 mana (10:27).
   - Uhtred's Chalice every 12 s plus Loreweave's "Using a Mana Flask grants Guard equal to 100% of Flask's recovery" gives about 1,400 guard (frame 05:10).

PATTERNS
- Gem quality as a stat line (Gemling): five gems use it, and it is the core of the build.
- inputs-and-outputs: crystals feed Verglas, the warcry and Rage.
- conversion: Olrovasara, Embitter.
- defence that scales damage: Refraction III.
- weapon set 2 job: set 1 is a spear for Whirling Slash movement, with per-set spirit.
- routine action: the flask gives guard.
- filler gems:
  - "dead" skills from the unset-ring trick, for four extra life motes;
  - Uhtred's Augury, which needs "exactly two other supports";
  - Mace Strike as colour ballast.
- low-level utility gems: Arctic Armour 20, Clarity I, Precision I.
- NEW, object stat as damage: a support reads a stat of a spawned object and pays it out as damage, so you scale that object stat with cheap non-damage modifiers. Search: start from skills that spawn objects (walls, totems, crystals), grep supports for "per … of the destroyed/[object]", then list what raises that stat (quality, passives).
- NEW, closed trigger loop: a trigger's output recreates its own condition, so one seed sustains it. Search: for each trigger (Cast on X, Herald, on-shatter), list its outputs (crystals, chill, armour break). Check whether one reaches the trigger's condition, and record the seed action and the decay timer (Verglas lasts 6 s).

HOW POB FOLLOWS IT
- Modelled:
  - the Gemling alternate quality (CalcSetup.lua:835);
  - crystal life (CalcOffence.lua:1572);
  - Scavenged Plating (act_str.lua:16684);
  - Refraction III.
- Hand calculation:
  - Verglas is unmapped (sup_int.lua:8560). Add a custom "X% gained as extra cold" with X = crystal life / 2000.
  - The per-spike "more" is unmapped (act_str.lua:4298).
  - Arctic Armour's per-stage armour is unmapped (act_int.lua:299), so armour is under-reported, and the Refraction exposure with it.
- Count-approximated: aftershock chance is mapped (SkillStatMap.lua:2706), but no calc consumes it. Use the Explosion stat set with Count = the number of aftershocks landing on the target. It is unverifiable.
- Can't follow: the Herald chain. Spirit of the Wolf is unparsed (ModCache.lua:6449), and so is chill-shatter (ModCache.lua:5259).
- Missing from data: Loreweave, the Runemastered Olrovasara (mace.lua:78 has only two variants), and Heart of the Well. "Virana's Siege" is Vorana's Siege in the data.

EVIDENCE AND QUALITY
- He shows 200% delirium mapping in both videos and side-by-side clips of budget and luxury gear.
- In-game tooltip DPS is 12,769 on budget and 17,849 on endgame.
- He shows the runeforge odds (2 hits in 6) and the mana demo.
- No PoB numbers appear on screen. The Simulacrum face-tank is a claim only.
- Careful and specific: breakpoints, item costs, and the downsides stated plainly (terrain fizzles, a clear-speed ceiling, the clunk of the 6 s Verglas buff).

FOR THE BRAINSTORM PHASE
- Read every alternate-quality line, looking for ones that feed a number another gem reads (crystal life read by Verglas).
- With a cheap weapon, look for gain-as-extra sources keyed to non-gear stats.
- For each loop, name its seed and its decay timer, and plan the reseed (Frost Wall at map start, or a cold-converted weapon).

BUDGET VS ENDGAME
What it keeps: the whole damage chain (Earthshatter, Verglas, the Frost Wall loop, the Cast on Elemental Ailment amulet, Vruun's Aftermath), Gemling quality, Loreweave (1 div), Uhtred's Chalice (1 exalt to 1 div), the armour stack, Whirling Slash and Herald of Ice. He says the budget version already has the damage and tankiness it needs, and more spend is "luxury" (budget 02:24).

Swaps, and what each costs:
- Weapon: Sadist's Mercy (physical, 1 exalt at level 78) becomes the cold Olrovasara (under 1 div).
  - With a physical weapon it freezes only while Verglas is up.
  - The fix is Vestige of Darkness ("Physical damage from Hits Contributes to Chill Magnitude and Freeze Buildup", helmet.lua:462), which costs the helmet slot.
- Off-hand: an armour tower shield becomes Sacred Flame. You lose armour and Greatest Defence, and gain spirit, gain-as-fire, and free Purity of Fire supports.
- Amulet: an Absent Amulet with no spirit becomes +50 spirit. On budget there is no Scavenged Plating (about 1.6x armour), no Blasphemy and no Berserk.
- Anoint: Stimulants (5 exalt) instead of Paragon (5–6 div). That means 39% instead of 44% quality: six Arctic Armour stages (about 240% increased armour) instead of seven (about 350% with the Kurgal desecration), and about 40% aftershock chance instead of nearly 100%.
- Herald of Ice: Elemental Focus and Cold Mastery become Cold Attunement and Armour Explosion once you have Rite of Passage Wolf (under 80 div). Without it you lose the chain clear.
- Movement: a Skysliver (1 div, 2.4–2.5 attacks per second) becomes a 2.7 APS spear plus Rigwald's.
- Megalomaniac: Spike Shield becomes Augmented Flesh (+2 skill slots). From Nothing (about 13 div) is optional on budget.

Upgrade order (his explicit order covers only leveling and the anoints; the rest is inferred from his "first" and "next" statements):
- Level with a crossbow to 67. Then a rare Flanged Mace, Vestige and Loreweave, and start Earthshatter.
- At level 78, Sadist's Mercy (the level-72 version costs 5 div), or an Olrovasara from level 65.
- Then the Paragon anoint plus the Kurgal quality desecration.
- Then a spirit amulet, then Scavenged Plating (drop Freezing Mark first), then +melee levels, then the luxuries.
- Endgame anoint priority: Augmented Flesh, then Paragon, then Stimulants.

Thresholds and triggers:
- Arctic Armour at level 20; the next stage is at 27, which you won't reach.
- Put +levels on the amulet or the gloves, never both, because of mana.
- 44% quality gives the seventh Arctic Armour stage.
- A rare mace replacing Olrovasara needs at least 800 DPS and 1.9 APS, plus flat cold and gain-as-cold.
- Pop the flask every 12 s.
- Refraction III caps at 40k armour (from the data).

LINKS SEEN (unopened)
- mobalytics.gg/poe-2/profile/stone-dagger-zuckm8/builds/2b0c277f-2694-4799-8173-23a635161b40
- poe.ninja/poe2/pob/2154a (budget PoB)
- discord.gg/QZ6fprtDXU
- the budget video link inside the endgame description

REFERENCE ENTRY
- Ix82BSjoAdY / 9H1lUVfvxTg (Phylaris, 0.5): Gemling Earthshatter.
- Chain: quality-scaled Frost Wall crystal life → Verglas ~120% gain as cold → Cast on Elemental Ailment and Frost Wall freeze loop; aftershocks hit at explosion damage; armour → Refraction III exposure.
- Patterns: quality as a stat line, object stat as damage (new), closed trigger loop (new), defence that scales damage, conversion.
- PoB: Verglas and the per-spike multiplier are hand calculations; aftershocks need Count; the Herald chain is unmodelled. Budget PoB: poe.ninja/poe2/pob/2154a.

Frames: 12 of 14 used. About 1,080 words.
