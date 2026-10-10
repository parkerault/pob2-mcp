# Crossbow Titan, Double Vision (Struth Builds, 0.4)

An agent's study report, kept verbatim (2026-10-10). Brief: `briefs/offmeta-brief-2.md`.
Its claims are the agent's; the PoB gaps it cites were re-checked in `../pob-gaps.md`, and its patterns are consolidated in `../worklog.md`.

---

HEADER
- Video: 9Z9ep97Whkg, "A Truly Off-Meta Crossbow Titan - Double Vision Dyad 0.4 POE2"
- Creator: Struth Builds. Patch: 0.4 (uploaded 2026-02-03).
- Build: Titan (Warrior). The main skill is Armour Piercing Rounds (APR), which carries Gemini Surge from the Double Vision unique crossbow. Bossing is done on weapon set 2 with grenades.
- Budget, as the creator states it: "5 to 10 div, maybe less". He bought the crossbows for 1 to 60 exalts.

THE CHAIN
1. Payload (00:04, 08:50). Double Vision (Dyad Crossbow) says: "When you reload, triggers Gemini Surge to alternately gain 6 Cold Surges or 6 Fire Surges." Each APR bolt uses up one surge and explodes at the end of its flight. The surges are "the bulk of our damage" (02:14). APR is "mostly just a vehicle", there to stun and break armour. Confirmed on a frame (08:50) and in PoB data.
2. Engine (01:28). Double Barrel III says "Supported Skills reload automatically when Heavy Stunning an enemy." So every heavy stun means a reload, and every reload means new surges, with no manual reload. Confirmed on a frame (03:30) and in PoB data.
3. Lower threshold (01:36). Titan's Crushing Impacts says "Your Hits are Crushing Blows" and gives 25% more damage against Heavy Stunned enemies. A Crushing Blow heavy-stuns an enemy that is "Primed for Stun", which happens at 40% stun buildup on normal enemies, 50% magic, 60% rare and 70% unique. Confirmed on a frame (01:39) and in PoB data.
4. Event protection (02:36). Pin II says "Supported Skills cannot cause Stun Buildup" and adds 50% increased crit chance against Immobilised enemies. On Gemini Surge, this stops the big surge hits from using up the heavy stuns that APR needs for reloads. The surges are fully elemental, so they don't Pin either. Confirmed on a frame (02:39) and in PoB data.
5. Stun-rate tuning (03:27 to 05:02). Stun II gives "70% more Stun buildup" (frame, 03:46). Chain I is used because it doubles the targets hit, so more stun chances. He avoids Chain II and pierce because surges explode only once, at the end of the path. The Shatter Palm anoint adds Daze, and Dazed enemies take 50% more stun buildup. His "~500% extra" figure is speech only and looks overstated. Fresh Clip II, Rapid Attacks II and Eternal Rage (shown as Rage 47/47 on frames) are flat multipliers.

WHAT CHANGED IN 0.5.4 DATA
- Unchanged:
  - Double Vision: Data/Uniques/crossbow.lua:6-16.
  - Gemini Surge: act_str.lua:6941. Its damage multiplier at level 20 is 181% and at level 30 is 345%, exactly the creator's 08:00 numbers.
  - Double Barrel III: sup_str.lua:2637.
  - Pin II: sup_dex.lua:3780.
  - Crushing Impacts: tree.lua:122325.
  - Stun II, Fresh Clip II, Rapid Attacks II, Chain I, Eternal Rage, Scavenged Plating and APR are all present.
- Changed: Shatter Palm.
  - In 0.4 (frame 04:21): "30% increased Stun Buildup / 10% chance to Daze on Hit".
  - In 0.5.4 (tree.lua:92275-92287): "20% increased Critical Damage Bonus / 30% increased Stun Buildup". The Daze is gone.
  - Nearest substitute: Seeing Stars (tree.lua:31844), which is anointable and gives "10% chance to Daze on Hit / 25% increased Daze Duration".
- Not checkable: PoB data can't show 0.5 changes to game behaviour, such as the primed-stun thresholds or how surges are used up.
- Overall: the core loop's links are all intact, and only the stun-spike helper changed.

PATTERNS
- Routine action as damage: reloading fires the item's payload.
- New, "automate the routine action": find an event the build already produces (heavy stun) that performs the action for free, which closes the loop hit → stun → reload → payload. This works for any "when you X" item.
  - Search step: start from the trigger verb on the item ("reload", "dodge", "use a flask"). Grep support and node text for "automatically [verb]" / "[verb] when you".
- New, "keep the event for the engine": when the payload does most of the damage, it also takes the events the loop depends on. Disable that event on the payload ("cannot cause Stun Buildup") so it lands on the carrier skill.
  - Search step: for each event in the loop, list every damage source that can also cause it, then grep supports for "cannot [event]" / "instead of".
- Forced condition: Crushing Blows lower the heavy-stun threshold to the primed level.
- Inputs-and-outputs: APR is a carrier. It is picked for shots per second and stun, not damage. Chain count is tuned to where the payload lands.
- Weapon set 2: a different job, but a damage one (grenade bossing), not the library's non-damage job.

HOW POB FOLLOWS IT
- Gemini Surge is modelled as a granted skill showing the average damage of one explosion, not DPS.
- The reload trigger line isn't parsed (Data/ModCache.lua:6901), and CalcTriggers has no reload or surge trigger.
- Double Barrel III's "crossbow_reload_on_heavy_stun" has no entry in its stat-to-modifier map (sup_str.lua:2668-2670). That map is what turns a gem stat into something PoB calculates.
- "Your Hits are Crushing Blows" isn't parsed (ModCache.lua:7010). Its 25% more damage is parsed (ModCache.lua:2413) behind the "Is the enemy Heavy Stunned?" config option.
- The Daze config option exists (ConfigOptions.lua:1684).
- Count doesn't fit, because the surge result is a per-hit number. Hand calculation: surge average hit × APR bolts per second, as long as heavy stuns keep reloads coming. Whether that holds (stun rate against fire rate) can't be followed in PoB.
- No content is missing from PoB's data.

EVIDENCE AND QUALITY
- Map footage, claiming juiced tier 15/16 maps.
- The in-game skill panel shows Gemini Surge doing 9,264 damage per hit (02:39).
- There is no PoB walkthrough and no boss kill with the surge setup. He says it can't boss.
- The mechanic reasoning is careful (Pin II, Chain I vs II, avoiding pierce) and every key tooltip is shown on screen. The passive tree is admittedly by gut feel ("I haven't run the numbers").

FOR THE BRAINSTORM PHASE
- Start from an unused unique with a conditional trigger, then ask which support or node makes that condition happen automatically.
- Event-theft check: if the payload outdamages the carrier, check whether it also takes the loop's trigger event.
- Tune spread modifiers (chain, pierce) to where the payload lands, not to the raw number of targets hit.

LINKS SEEN (unopened)
- maxroll.gg/poe2/pob/lo95l0o4 (the PoB export)
- Unrelated to the build: struthgaminggear.com and a Steam store page.

REFERENCE ENTRY
9Z9ep97Whkg (Struth Builds, 0.4): Titan, Double Vision crossbow. APR bolts carry Gemini Surge explosions, and heavy stuns from Crushing Impacts + Double Barrel III auto-reload to refill the surges.
Pin II on the surges keeps the heavy stuns for APR. Chain I and Daze (Shatter Palm anoint, lost in 0.5: use Seeing Stars) raise how often heavy stuns happen.
Patterns: routine action as damage; automate the routine action (new); keep the event for the engine (new); forced condition.
PoB: surge shows hit size only, the reload trigger isn't modelled, DPS is a hand calculation. PoB: maxroll.gg/poe2/pob/lo95l0o4.

Frames used: 8 of 10.
