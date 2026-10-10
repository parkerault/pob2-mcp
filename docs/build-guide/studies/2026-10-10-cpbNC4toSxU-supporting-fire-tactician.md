# Supporting Fire Tactician (Crouching_Tuna)

An agent's study report, kept verbatim (2026-10-10). Brief: `briefs/offmeta-brief-2.md`.
Its claims are the agent's; the PoB gaps it cites were re-checked in `../pob-gaps.md`, and its patterns are consolidated in `../worklog.md`.

---

CARD: cpbNC4toSxU

HEADER
- Video: cpbNC4toSxU, "PoE 2 - 0.5 - Supporting Fire Tactician - Build Guide"
- Creator: Crouching_Tuna
- Patch: 0.5, Runes of Aldur league (from the poe.ninja link), uploaded 2026-06-06. Every link in the chain is in our PoB 0.23.1 data.
- Build: Tactician. The main skill is Supporting Fire, and its command is Death From Above. He doesn't state a budget, but it's clearly high: an "expensive anoint" (19:59), a corrupted weapon and 40%-quality rings.

THE CHAIN
1. **Source.** Supporting Fire puts artillery minions off screen. Your command, Death From Above, drops a flare that calls 6 arrow volleys (02:32; the 05:26 frame shows "Command: Death From Above"). It has a 10 s cooldown, so its damage is limited by the cooldown (minion.lua:1383). Confirmed in data and on a frame.
2. **Scaler: Strength.** The gem gives minions 1% increased damage per point of your Strength (other.lua:18019). In speech he only says "strength stack" (03:44). Confirmed in data.
3. **Scaler: gem levels.** Chober Chaber is a Leaden Greathammer, a two-hand mace (he calls it an axe). The frame at 03:47 shows "+4 to Level of all Minion Skills", corrupted. The gem is level 34 (05:26). PoB's current variant only has +(2–3) (Uniques/mace.lua:179), so +4 is a corruption result. Frame and data.
4. **Enabler: Giant's Blood.** This keystone lets you wield a two-handed mace in one hand, which keeps the off hand free for a Sceptre (04:21). In exchange it triples attribute requirements; the frame shows 294 Int required. He turns that Int into mana regeneration (13:08). Data.
5. **Same stat for defence.** Black Scythe Training is a keystone from the Heroic Tragedy (Vorana) jewel: "Gain no inherent bonus from Strength; 1% increased Energy Shield per 2 Strength" (LegionPassives.lua:8361). He is on Chaos Inoculation; every frame shows Life 1/1. He has 8k ES now and reached 14k at about 1000 Str in a min-maxed PoB (16:58).
6. **Multiplier: Archon of Undeath.** The 12:14 frame reads "25% more Minion Damage; 200% more Cooldown Recovery Rate for Command Skills". Because the skill is cooldown-limited, faster cooldowns are its biggest damage multiplier.
7. **Uptime.**
   - Dominion, the anoint, gives 50% reduced Archon effect but removes the waiting period before you can regain it (tree.lua:66186). Nodes give back about 10% effect (20:22).
   - Procs: a notable gives a 15% chance on command skill use (08:18). A crafted belt suffix gives "(35–50)% to gain Archon of Undeath when you create an Offering" (ModItem.lua:1766; he has 46%, 08:45). He spams the Skeletal Arsonist's command, Explosive Demise, as a free command use (07:48).
   - Puppet Master stacks remove the movement penalty for casting commands (13:51).
   - The nodes and belt are confirmed in data; the spam working rests on speech alone.
8. **Multiplier: Muster** (frame 05:40). It gives 7% more minion damage for each different kind of reviving minion. He runs a zoo of cheap types: an Eaten Rat spectre (the lowest-spirit spectre), Storm Mage, Brute, Arsonist and Wolf Pack. Bidding III gives 80% cooldown recovery (18:57; sup_int.lua:829). Minions breaking armour help because the skill deals pure physical damage (21:36). Speech only, apart from Muster.

PATTERNS
- **inert minions + filler gems:** the cheapest specimen of each minion type, there only to raise Muster's headcount.
- **zeroed resource:** with no life on Chaos Inoculation, Giant's Blood halving life from Strength and Black Scythe removing Strength's bonus cost nothing.
- **not-consume to 100%, variant:** Dominion gives up half the buff's power for permanent uptime.
- **NEW, cooldown recovery as DPS:** when the main skill is held back by its cooldown, cooldown recovery multiplies damage just like "more damage". Search step: if the skill's cooldown is longer than its use time, look for "Cooldown Recovery" on the skill's own tags (here, Command).
- **NEW, proc farm with a free action:** a buff that triggers on using a certain kind of skill is fed by spamming the cheapest skill of that kind, plus a mod that removes that skill's penalty. Search step: grep tree and item mods for "chance to gain … when you use a <tag> skill", then rank skills with that tag by cost, cooldown and side effects.
- **NEW, attribute bridge:** one attribute pays for both damage and defence. Search step: start from a damage stat like "per X player Strength" (also on Ancestral Spirits and Manifest Weapon, other.lua:537, 10748). Then look in keystones, timeless jewels and uniques for "per N Strength" defence lines.

HOW POB FOLLOWS IT
- **Modelled:**
  - Strength scaling, gem level and Bidding.
  - The 6 volleys, counted as a DPS multiplier.
  - The rate is capped by the cooldown (CalcOffence.lua:2972).
  - Black Scythe parses (ModCache.lua:1044, 5678).
  - Muster counts persistent minion gems by id (CalcPerform.lua:1343–1348). That count includes Supporting Fire itself and treats all spectres as one, so it may differ from the game's "reviving minions" rule.
  - Pasting the item text gets Chober Chaber's +4.
- **Can't be followed: Archon of Undeath.**
  - No file in Modules/ mentions Archon.
  - The proc line is unparsed (ModCache.lua:1582 `{nil,…}`), and so is Dominion's no-waiting-period line (ModCache.lua:4761).
  - Archon effect and duration lines parse as generic mods with text left over (1108, 1272).
  - Puppet Master is unparsed (1572).
- **Count ≈ 2.5 on Supporting Fire (hand-derived):**
  - Archon runs at about 60% effect (Dominion's −50% plus ~10%).
  - Cooldown: 1 + 2.0×0.6 = 2.2. Damage: 1 + 0.25×0.6 = 1.15. Together that is 2.2 × 1.15 ≈ 2.5.
  - This only holds while the cooldown is still the limit: 10 / (1.8 × 2.2) ≈ 2.5 s, which is longer than the 1 s use time.

EVIDENCE AND QUALITY
- **Shown:**
  - Boss kills on Vessel of Kulemak (00:40) and Arbiter of Ash (01:35).
  - A clear of a heavily juiced Abyss map (02:07).
  - An in-game DPS panel showing 183,287 for Death From Above (05:26, apparently without Archon).
  - He claims about 1M single-target DPS (02:58), but no PoB numbers are on screen.
  - He shows the cooldown with and without Archon (12:37).
- **Quality:** an honest mechanics rundown, not a full guide (23:55). He is candid about weak spots, such as curses doing little on bosses and a jewel placement a patch made outdated. Numbers are off the cuff, and there's no levelling or gear progression.
- **Frames:** I used 8 of 10. Two missed (05:19 gameplay, 19:10 stash), so the five supports on Supporting Fire stayed unread apart from Muster.

FOR THE BRAINSTORM PHASE
- **Classify by tags, not looks.** "Technically a minion build" (03:23), so borrow minion scalers.
- **Price each slot against the cheapest headcount gain.** He weighs his curses against "an extra reviving minion… that extra 7%" (18:51).
- **Judge supports with the dominant buff active.** Bidding III's 80% beats Bidding II's 30% by less once Archon adds 200% (19:02–19:39).

LINKS SEEN (unopened)
- PoB: https://maxroll.gg/poe2/pob/ykd67a0y
- Planner: https://maxroll.gg/poe2/planner/o9ch0h06
- poe.ninja: https://poe.ninja/poe2/profile/Crouching_Tuna-1733/runesofaldur/character/Carpetbombtheirhouse

REFERENCE ENTRY
cpbNC4toSxU (Crouching_Tuna, 0.5): Supporting Fire Tactician.
Chain: Strength (1% minion damage per Str) + minion gem levels (corrupted +4 Chober Chaber, held one-handed via Giant's Blood) → cooldown-limited Death From Above → Archon of Undeath (200% more command cooldown recovery, 25% more minion damage), made permanent by Dominion and proc-farmed with a free command → Muster zoo. Strength also gives ES via Black Scythe Training on Chaos Inoculation.
Patterns: cooldown recovery as DPS, proc farm with a free action, attribute bridge (new); inert minions/filler, zeroed resource, not-consume variant.
PoB: maxroll.gg/poe2/pob/ykd67a0y. PoB doesn't model Archon; set Count ≈ 2.5.
