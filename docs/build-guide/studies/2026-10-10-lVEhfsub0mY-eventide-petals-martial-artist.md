# Eventide Petals Martial Artist (Lolcohol)

An agent's study report, kept verbatim (2026-10-10). Brief: `briefs/offmeta-brief-2.md`.
Its claims are the agent's; the PoB gaps it cites were re-checked in `../pob-gaps.md`, and its patterns are consolidated in `../worklog.md`.

---

OFF-META CARD: lVEhfsub0mY

1. HEADER
- Video: lVEhfsub0mY, "PoE 2 0.5 - Move Over Whirling Assault... | Eventide Petals Martial Artist Build Guide"
- Creator: Lolcohol. Uploaded 2026-06-06, early in 0.5. PoB tags the amulet with the Runes of Aldur league. Our pin is 0.5.4, and the pinned comment links a later "build update" video, so some numbers may have moved.
- Ascendancy: Martial Artist (Monk).
- Main damage: Midnight Zenith ice crystals, granted by the Eventide Petals amulet. Shattering Palm, Herald of Ice/Thunder and Tempest Bell feed it.
- Budget: the creator calls it "fairly modest" and "very cheap". Emergent Possibility is the expensive late upgrade.

2. THE CHAIN
- **Engine (00:35).** Midnight Zenith is a buff. Critical hits from other skills give Arctic Petals when they kill (+1 per Power of the target) or when they crit a Rare or Unique (+2 to 4). Every 10 petals become 5 Ice Crystals near the target. The limit is 10 crystals, each lasting 10 s, and each deals 47–70 cold at level 20. The skill's own crits give no petals. Confirmed on the 00:42 frame and in PoB data (Data/Skills/other.lua:11090, 11211, 11235). One mismatch: the frame shows "Requires Level 18", PoB data says 55.
- **Detonator (01:24).** The Ice Crystal keyword text says skills that Consume Freeze instantly shatter crystals, for more damage in a larger area. Confirmed on the 01:27 frame. Not in PoB data.
- **Consumer (04:56).** Biting Frost II on Herald of Ice and Herald of Thunder makes the herald explosions consume freezes, which shatters crystals and frees room under the 10-crystal limit. The gem exists (sup_int.lua:899). The links are speech plus the 05:40 loop diagram. No gem panel is shown.
- **Loop (05:28).** Shattering Palm crits make petals and crystals. Kills set off the Herald of Ice explosions. Those crit (new petals) and consume freeze (crystals shatter), and the crystal kills fire the herald again. Confirmed on the 05:40 diagram.
- **Crit feeders (03:48–04:34):**
  - Hollow Focus Technique: hits on its bells are always crits (other.lua:8618).
  - Hollow Resonance: rings out on crits from other skills.
  - Pinpoint Critical on the heralds: 60% more crit chance for 30% less crit bonus (speech).
  - Way of the Stonefist (gloves): +melee skill levels turn into gem quality, and Shattering Palm's quality is crit chance. Crit-bonus mods turn into base crit (speech).
- **Boss mode (06:53–09:00):**
  - Open with Whirling Assault for combo. Delayed Gratification on Tempest Bell gets several bells onto a single boss.
  - Data disagrees with the speech: +150% combo cost and 1 extra use (sup_dex.lua:1821), not "1.5x" and three bells.
  - Bosses stay frozen because the heralds only fire on kills, so Biting Frost is idle. The Heavy Frost notable then lets hits ignore non-negative elemental resistances of frozen enemies (parsed, ModCache.lua:5940).
  - Extras: Rend for 50% extra lightning, paid with power charges from Killing Palm on the bells. Curses via Hand of Chayula.

3. PATTERNS
- **inputs-and-outputs:** crits and kills go in, crystals come out, and freeze-consumers use them up.
- **quality as a stat line:** Stonefist levels become quality, which is Shattering Palm's crit chance.
- **filler to satisfy a count:** Runic Meridians' 5 extra rune sockets feed Emergent Possibility (1% of damage as a random element per socketed rune).
- **inert minions (widened to spawnable targets):** the Hollow Focus bells are always-crit, cullable targets that yield charges.
- **NEW, relay around self-exclusion.** The generator ignores its own hits, so close the loop through a second skill triggered by the generator's output (kills or shatters set off Herald of Ice). Search: start from the "cannot gain X from this skill" line, list what the engine's output does, then grep skill text for triggers on that event ("Shatter", "on kill", "when an enemy dies").
- **NEW, count events, not damage.** When the payoff counts qualifying hits, add cheap hits that always qualify, and trade magnitude for rate (Pinpoint Critical). Search: take the noun in the engine's trigger ("Critical Hits with other skills") and grep "always Critical Hits", "Critical Hits with other Skills cause", and supports that raise the rate at the cost of size.
- **NEW, kill-gated consumer.** Put a consume support on a skill that only fires on kills, so it runs while clearing and goes quiet on bosses. The boss keeps the state (Frozen) a single-target payoff needs. Search: when the build wants a state consumed in packs but kept on bosses, list its on-kill skills (heralds) and the "Consume" supports they can take.

4. HOW POB FOLLOWS IT
- **Modelled:**
  - The hit skills.
  - Biting Frost's 40% more damage against frozen enemies (sup_int.lua:926).
  - Heavy Frost, Pinpoint, Rend and curses.
  - Per-crystal base damage through the Crystal stat set: its cold damage stats are mapped (SkillStatMap.lua:51). Its baseFlags block is empty, so check in the skeleton that PoB actually gives it a hit.
- **Count-approximated:** Count = crystals shattered per second. That only works if PoB rates the set at one use per second from castTime = 1 (other.lua:11098). On a boss, crystals/s ≈ crits/s landed by other skills × petals per crit (3 at gem level 11–19, 4 at 20) ÷ 2, capped by the 10 crystals and 10 s duration.
- **Can't be followed:**
  - Nothing in Modules/ models petal gain or crystal creation. The only ice-crystal code computes crystal life (CalcOffence.lua:1571).
  - The "shatter on consumed freeze, more damage, larger area" bonus has no number anywhere. The mapping loop is hand calculation at best.
- **Gaps in PoB's data:**
  - The amulet's crystal-life line isn't parsed (ModCache.lua:5949). It doesn't matter here.
  - Way of the Stonefist isn't parsed (ModCache.lua:5692–5694). The Fists of Stone base exists (Data/Bases/gloves.lua:2039), so imported gloves work, but theorycrafted ones need their transformed mods typed in by hand.

5. EVIDENCE AND QUALITY
- No PoB. The pinned comment says the build "was created on vibes, not numbers".
- Map clear footage, an Arbiter of Divinity fight (09:10, no kill seen on frame), and a stream kill of The Aberration with loot drops (09:45–09:50).
- The character shows about 1.7k life, 2.7k energy shield and 450 Runic Ward.
- The creator says the build is about 80% done and has no leveling plan.
- Quality: the mechanics are well explained, with tooltips and a loop diagram, and the scaling split is careful. There are no numbers, and some claims are loose (Delayed Gratification).

6. FOR THE BRAINSTORM PHASE
- **Split the scaling (10:43):** list which mods reach the payload. Crystals ignore weapon flat damage, weapon base crit and attack-only crit bonus. Then itemize the triggers and the payload separately.
- **Read the keyword text of the engine's output:** the Ice Crystal tooltip is what showed the cheap detonator.
- **Reject nodes whose side effect fights the setup:** the creator skips the Whirling Assault notable because it knocks back on crit and pushes bosses out of the bell and crystal zone (19:02).

7. LINKS SEEN (unopened)
- mobalytics.gg/poe-2/builds/lolcohol-eventide-monk (written build)
- tinyurl.com/vk6ppaa7 and mobalytics.gg/poe-2
- pathofexile.com/account/view-profile/Lolcohol-4777
- youtu.be/Ue8HgVYTp28 (update video)
- Twitch, Discord and Patreon links
- No PoB, pobb.in or poe.ninja links.

8. REFERENCE ENTRY
- lVEhfsub0mY (Lolcohol, 0.5, Martial Artist): Eventide Petals' Midnight Zenith turns crits from other skills into Ice Crystals. Biting Frost II on kill-triggered heralds consumes freeze to shatter them, and the herald crits re-feed the petals.
- Patterns: inputs-and-outputs, quality as a stat line, filler count (runes), plus new relay-around-self-exclusion, count-events-not-damage and kill-gated-consumer.
- PoB: no export ("vibes, not numbers"). The crystal loop isn't modelled; Count = crystals shattered per second.

7 of 10 frames used.
