# Whirling Assault and Flicker Strike Martial Artist (Rynze)

An agent's study report, kept verbatim (2026-10-10). Brief: `briefs/offmeta-brief-2.md`.
Its claims are the agent's; the PoB gaps it cites were re-checked in `../pob-gaps.md`, and its patterns are consolidated in `../worklog.md`.

---

**1. Header**
- Video t2o56g88DHk, "Poe 2 - Monk build - Martial Artist Whirling Assault - Flicker Strike - 0.5.5 Final". Channel: Rynze.
- Patch: 0.5.5, Forbidden Rites league. Our PoB data is 0.5.4.
- Martial Artist. Whirling Assault with Herald of Ice and Herald of Thunder clears maps. Flicker Strike is for bosses only.
- Budget: the creator calls it the "final", high-end version (Mageblood, a boots rune he puts at about 500 div). Cheaper versions are in other videos.

**2. The chain**
- **Clear (02:29–04:31):** Concussive Runes is socketed in both Herald gems. When a Herald explosion heavy-stuns an enemy, it creates a Runic Shockwave. The Shockwave counts as a "non-Herald attack", so it can fire both Heralds again, which gives a chain reaction.
  - Confirmed on frame 08:30: the Concussive Runes tooltip on Herald of Ice. The same icon sits in the Herald of Thunder group.
  - Confirmed in PoB data: both Heralds fire only on a "non-Herald Attack Hit" (act_int.lua:11734, act_dex.lua:3508).
  - Requirements: the Heralds need about 900% stun buildup, and the build stacks lightning because "cold can't stun" (03:37, 04:28).
  - Each Shockwave costs Runic Ward. Remnants of Kalguur, with Harmonic Remnants II and Remnant Potency I, keeps ward up, and he wants 300+ ward on gear (09:02). The group name is confirmed on frame 10:40; the supports rest on speech.
- **Ice side:** Polcirkeln (the ring he calls his "port secret ring") lets chilled enemies be shattered as if frozen, so Herald of Ice fires on chill (09:37).
  - Ring text confirmed in ring.lua:278.
  - Embitter turns all "damage gained as" into gained as extra cold, so the build still chills (06:27). Gem text is confirmed in data. It sits in the Charged Staff group, and how that reaches the Heralds rests on speech.
- **Power charges, the Flicker fuel (05:34–05:50):** Whirling Assault is linked with Living Lightning II, Culmination II, Ailith's Chimes, a gem heard as "Ocean's Oath" (probably Oisín's Oath, not confirmed on a frame) and Rage.
  - The speech says "Elimination II". Frame 05:39 shows it is Culmination II.
  - Culmination II gives Whirling Assault the Combo-spending skill type (sup_dex.lua:1635). Ailith's Chimes requires that type (sup_dex.lua:121) and gives a 25% chance per Combo spent to gain a Power Charge.
  - Martial Master ("Gain Combo from all Attack Hits") and Martial Adept (an extra Combo each time you gain Combo) fill the Combo pool. Both are confirmed in tree.lua.
  - He describes the result as "infinite power charges".
- **Flicker Strike (07:21–08:18):** Linked with Hit and Run, Concentrated Area, Close Combat II, Elemental Armament II and Rakiata's Flow.
  - In-game panel: level 27, DMG 313,045 (frame 07:30).
  - Flicker spends Power Charges: each one adds 2 more teleporting strikes (act_int.lua:8702).
  - My inferences, not stated in the video:
    - Hit and Run only works after you've moved a distance. Whirling Assault advances while attacking, which meets that condition, and Hit and Run's speed covers Flicker's −50% attack speed.
    - Flicker teleports next to its target, so Close Combat's "closer enemies take more damage" bonus is always near its maximum.
  - In group Grand Expedition he moves Rakiata's Flow (enemy elemental resistances inverted) to Falling Thunder and stops using Flicker. Teleporting into elites that slow you and reflect chill felt bad (08:07).
- **Other links:**
  - Way of the Stonefist turns flat-damage glove mods into "gain as extra" (10:49). The transform is confirmed in tree.lua; the untransformed gloves are on frame 10:40.
  - Chaos Inoculation (CI): frame 00:50 shows Life 1/1 and 8,134 energy shield.
  - Charged Staff also spends all Power Charges (act_int.lua:3257), so it competes with Flicker for them. He doesn't address this.

Relative to the generic Whirling Assault Martial Artist, the distinctive parts are the Concussive Runes Herald loop and the Culmination → Ailith's Chimes charge battery that feeds Flicker. I haven't seen the ronarray card, so check the overlap yourself.

**3. Patterns**
- **New: relay trigger past a self-exclusion.** A skill that won't fire from its own hits gets a trigger support whose triggered skill lacks the excluded type, so it fires itself again.
  - Search step: grep skill descriptions for "non-<Type>" clauses. For each, find supports with a "trigger on <event>" stat whose required types match that skill (Heralds are typed Attack). Then check that the event (here, heavy stun) is reachable from the skill's own damage.
- **New: a support that grants a type to unlock another support.** Culmination II adds the Combo-spending type that Ailith's Chimes requires.
  - Search step: start from a support you want but can't socket. Read its required types (`requireSkillTypes`), then search the other supports' added types (`addSkillTypes`) for that type.
- **inputs-and-outputs:**
  - Power charges come out of Whirling Assault and are spent by Flicker Strike.
  - Combo comes from every attack hit.
  - Runic Ward is spent as trigger fuel.
- **forced condition:**
  - Polcirkeln lowers shatter from frozen to chilled.
  - Hit and Run's movement requirement is met by Whirling Assault.
  - Close Combat is always near maximum on a teleport-to-target skill.
- **conversion:** Embitter turns gained damage into cold. Lightning is kept for stun.
- **zeroed resource:** CI.

**4. How PoB follows it**
- **Modelled:**
  - Flicker Strike's burst: hits = 1 + 2 × Power Charges spent (act_int.lua:8673, 8684). Set the charge count; no Count needed.
  - Whirling Assault and the Heralds as gems.
  - Culmination II's 4% more damage per Combo (sup_dex.lua:1649).
- **Can't be followed:**
  - Runic Shockwave has no skill entry. Gems.lua:19614 names `ConcussiveRunesPlayer`, and no `skills["ConcussiveRunesPlayer"]` exists. The support's only stat, `support_trigger_pummel_on_heavy_stun` (other.lua:4378), has no handler in Modules.
  - Polcirkeln's shatter-on-chill line isn't parsed (ModCache.lua:5259 maps it to nil).
- **Count-approximated, weakly:** Count on the Herald groups = Herald explosions per pack. There's no principled number, so the chain is hand calculation plus footage.
- **Missing from or unidentified in PoB data:**
  - "Botter of Engines" on Charged Staff.
  - "Ocean's Oath": probably Oisín's Oath (Gems.lua:610), not confirmed.
  - The "legacy of Wanderlust" rune.
  - "Elimination II" was a mishearing of Culmination II.

**5. Evidence and quality**
- **Shown:**
  - In-game skill panel numbers (Whirling Assault 109,050; Herald of Ice 94,807; Herald of Thunder 26,252; Falling Thunder DPS 432,549).
  - Stated defences: 8k energy shield, 77% deflect, about 170k effective HP.
  - Minimum stats for tier-15 yellow maps.
  - Juiced map footage and party Grand Expedition footage.
  - No PoB on screen, and no narrated Flicker boss kill. I didn't view the Simulacrum footage.
- **Quality:** Medium. Gem lists, minimum stats and the stun/ward reasoning are clear. Flicker gets about one sentence, and its charge source is never connected to it.

**6. For the brainstorm phase**
- Publish minimum gate stats for each link of a proc chain (stun buildup, per-hit damage, crit), tied to the content tier. The chain is only as reliable as its weakest gate.
- Split elements by job: lightning to stun, cold to chill and shatter. Then use a converter to push gained damage into the ailment element you need.
- Swap skills by content. Check whether the boss skill's movement (a teleport) is dangerous in group content, and move the lineage support to whichever skill is in use.

**7. Links seen (none opened)**
- poe-vault.com/poe2/monk/martial-artist/herald-flicker-strike-build-guide
- poe-vault.com/poe2/monk/invoker/thunderstruck-monk-leveling-build
- youtu.be/xZFc40jhyAA (cheaper version)
- A pathofexile.com trade2 search for the Polcirkeln augment on Ornate Ringmail
- No PoB, pobb.in or poe.ninja links.

**8. Reference entry**
```
- t2o56g88DHk (Rynze, 0.5.5, Martial Artist): Concussive Runes in Herald of Ice/Thunder -> heavy stun spawns Runic Shockwave (a non-Herald attack) -> re-fires both Heralds (chain); Polcirkeln = shatter on chill.
  Culmination II makes Whirling Assault a Combo spender -> Ailith's Chimes -> Power Charges (Martial Master/Adept feed Combo) -> Flicker Strike (+2 strikes/charge, Hit and Run, Close Combat) for bosses.
  Patterns: relay trigger past a self-exclusion (new); type-granting support unlock (new); inputs-and-outputs; forced condition; conversion; zeroed resource (CI).
  PoB: Runic Shockwave absent (Gems.lua:19614, no skills entry); Flicker burst modelled. Guide: poe-vault herald-flicker-strike-build-guide (unopened).
```

I used 9 of the 10 allowed frames. They are in /home/parker/projects/yt-library/videos/t2o56g88DHk/frames/.
