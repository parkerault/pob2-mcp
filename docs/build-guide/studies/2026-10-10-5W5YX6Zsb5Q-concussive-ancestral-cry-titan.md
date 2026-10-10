# Concussive Ancestral Cry Titan (ccs)

An agent's study report, kept verbatim (2026-10-10). Brief: `briefs/offmeta-brief-2.md`.
Its claims are the agent's; the PoB gaps it cites were re-checked in `../pob-gaps.md`, and its patterns are consolidated in `../worklog.md`.

---

HEADER
- Video: 5W5YX6Zsb5Q, "PoE 2 0.5 STUNNING Concussive Ancestral Cry Titan Build Guide | Just Run Them Over!"
- Creator: ccs
- Patch: 0.5. The title says so; the sub-patch isn't stated. Uploaded 2026-08-01.
- Build: Titan. The damage is Ancestral Cry's Volcanic Steps, plus shockwaves from the Concussive Runes support.
- Budget: he never states one. The gear is top-end: Mageblood, corrupted uniques, about 130M gold on screen. He adapted the build from a Bilibili creator's Marohi Erqi version.

THE CHAIN
- Damage source: While Ancestral Cry is up, you trigger Volcanic Steps every 12 units you travel. Volcanic Steps is a fire slam attack that converts 100% of physical damage to fire (act_str.lua:103, 157). So movement speed works as attack rate. He stacks it with Mageblood's Quicksilver legacy, Onslaught and boots (13:57, 20:24). Data-confirmed.
- Second layer: Concussive Runes is socketed in Ancestral Cry (frame 02:33). Any supported attack that heavy stuns an enemy erupts a Runic Shockwave under it, paid for in Runic Ward. The tooltip lists Volcanic Steps, both Heralds, Earthshatter and Wind Dancer as supportable. Herald of Ice/Thunder and armour-break explosions (from a wolf charm) chain off the stuns (08:40–10:22, speech only).
- Heavy stun on the first hit: Sine Aequo gloves (frame 18:45, corrupted) read "Immobilise enemies at 41% buildup instead of 100%" and "41% increased Damage against Immobilised Enemies". He adds stun buildup and Overwhelming Presence with presence area.
- Payoffs that need heavy stun: Crushing Impacts (frame 23:57, "25% more Damage against Heavy Stunned Enemies"), plus an anoint and cluster notables (24:20, speech).
- Multipliers:
  - Zerphi's Infamy on Ancestral Cry (frame 02:12): 50% more damage and 50% increased area. Volcanic Steps is listed as supportable.
  - Weapon: a rare two-hand mace with 715–1018 physical and "+5 to Level of all Melee Skills" (frame 12:52). It's paired with a Guiding Palm of the Mind sceptre through Giant's Blood (speech) for 25% gain as extra lightning and spirit for Trinity.
  - Against the Darkness, a Time-Lost Diamond (frame 25:08): each notable in radius grants 4% gain as extra cold and 4% as extra lightning. He has 7 notables, so 28% each.
- Enabler, Glory: Ancestral Cry normally builds Glory by igniting.
  - Zerphi's Infamy adds "Glory equal to 5% of Life spent on other Skills".
  - Animus Exchange at level 21 (frame 02:56) "sacrifices up to 822 Life" and gives back 70% as Runic Ward that can overflow. He supports it with Lifetap and Second Wind III, which raises cost to 150% and doubles cooldown uses. Two casts fill Glory (02:53–06:35).
  - Demo frame 05:17 shows life at 1,705/3,093 and Ward at 726/484, overflowed. So the same cast also refills the Ward that the shockwaves spend. He never says this; the data and the frame show it.
- Weapon set 2: he casts Ancestral Cry on set 2 (a second +5 mace, with skill-duration points) for level 38 instead of 33 and a longer buff, then swaps back (03:56–06:03). Speech only, and he hedges ("maybe I'm wrong", about 10 s of duration lost).

PATTERNS
- routine action as damage: walking is the trigger. This widens the pattern from item effects to a skill's own movement trigger.
- inputs-and-outputs: heavy stun is the event and Runic Ward is the fuel. Animus Exchange outputs both life spent (becomes Glory) and Ward (fuels shockwaves).
- forced condition: the 41% threshold keeps the "against heavy stunned" multipliers nearly always on. The Constricting Command helmet (frame 14:12, "Require 4 fewer enemies to be Surrounded") does the same for the Surrounded clusters.
- weapon set 2 job: the buff is cast from the swap set and appears to keep its level (snapshot).
- NEW, inflated cost as fuel: when something converts a spent resource into a gated one, every cost multiplier becomes a gain multiplier. Take a cheap cooldown skill, add cost-raising and extra-use supports, and cast it a few times. Works for any skill gated on Glory or charges.
  - Search: start from the chosen skill's gated resource. Grep gem and mod text for "spent" / "of Life spent". Then find supports with a cost multiplier above 100% and extra cooldown uses.
- NEW, node-effect multiplier steers cluster choice: Hulking Form's "50% increased effect of Small Passive Skills" makes clusters dense with small nodes, including conditional ones, the best paths. Force the condition so they're always on.
  - Search: from any node or keystone with "effect of Small Passive Skills", rank clusters by small-node value, then look for an item that forces their condition.

HOW POB FOLLOWS IT
- Volcanic Steps per hit: modelled. It's a granted skill (Gems.lua:17804), and Zerphi's "more" applies to Area skills.
- Volcanic Steps rate: Count-approximated. The every-12-units stat (act_str.lua:103) has no mapping anywhere in Modules. Set Count to steps per second, which is movement speed in units per second ÷ 12, worked out by hand. First check what base rate PoB assumes for this triggered skill.
- Level-38 snapshot: not modelled. Set the gem level by hand.
- Runic Shockwave: can't be followed. The support (Data/Skills/other.lua:4358) grants ConcussiveRunesPlayer (Data/Gems.lua:19614), which has no skill definition. Its stat support_trigger_pummel_on_heavy_stun (other.lua:4378) is unmapped. This content is missing from PoB's data.
- Heavy-stun multipliers: modelled through the enemy "Heavy Stunned" config. Crushing Impacts parses (ModCache.lua:2413) and the 41% line parses (ModParser.lua:5800). "Your Hits are Crushing Blows" is unparsed (ModCache.lua:7010). Glory generation is unparsed (ModCache.lua:1660), which doesn't affect DPS.
- Pinned comment: Volcanic Steps combines both maces' damage when dual-wielding. Unverified.

EVIDENCE AND QUALITY
- Tooltips show Mace Strike at about 104–116k DPS and a 36.7k Herald of Ice hit. Nothing is shown for Volcanic Steps or the shockwaves.
- There's a hideout demo of the Glory fill.
- Boss melting and "tested many versions" are speech only. I didn't frame-check any gameplay.
- Mid detail: he explains each item's job and gives alternatives (Headhunter, rare gloves), but shows no PoB numbers for the main damage and is unsure about the swap mechanic.

TITAN NODES REUSABLE BY ANY SKILL
- Hulking Form, 50% increased effect of Small Passive Skills: parsed (ModCache.lua:3215). Pick clusters by small-node value. Pairs with Constricting Command for the Surrounded clusters.
- Crushing Impacts, 25% more damage against heavy stunned enemies plus Crushing Blows: fits any stun-heavy setup. Sine Aequo makes it close to permanent.
- Mysterious Lineage, 15% more maximum life: he takes the "more life" node (24:03, speech).
- Unused here: Earthbreaker (unparsed, ModCache.lua:2256), Ancestral Empowerment, Stone Skin (50% more armour from body armour) and Mountain Splitter. All four say "Slam you use yourself", so they probably don't apply to triggered slams like Volcanic Steps. That's my reading, not tested.

FOR THE BRAINSTORM PHASE
- Read a support's in-game "Supportable Skills" list to find every skill it can ride. Here Concussive Runes rides heralds, Wind Dancer and Earthshatter.
- Replace a narrow enabler with a broad one. The original's Marohi Erqi only heavy stuns enemies on full life; he swapped in a lower stun threshold.
- With heavy gain-as-extra stacking, maximise the raw base hit: physical on the weapon rather than mixed elements (13:07).

LINKS SEEN (unopened)
- https://maxroll.gg/poe2/planner/qasixz0t
- https://space.bilibili.com/46512837
- https://www.youtube.com/@%E5%AD%99%E7%85%9C%E8%B6%85
- No PoB, pobb.in or poe.ninja links.

REFERENCE ENTRY
- 5W5YX6Zsb5Q (ccs, 0.5, Titan): Ancestral Cry's Volcanic Steps trigger every 12 units travelled, so movement speed is DPS. Concussive Runes shockwaves fire on heavy stun, made near-guaranteed by Sine Aequo's 41% threshold. Glory comes from Zerphi's Infamy and Animus Exchange with Lifetap and Second Wind III, which also refills Runic Ward.
- Patterns: routine action as damage (movement), inputs-and-outputs, forced condition, weapon set 2 job, plus new: inflated cost as fuel; node-effect multiplier steers cluster choice.
- PoB: Runic Shockwave is missing; the Volcanic Steps rate needs Count. Links: maxroll planner qasixz0t only.
