# Oracle Entangle (Amonera)

An agent's study report, kept verbatim (2026-10-10). Brief: `briefs/offmeta-brief-2.md`.
Its claims are the agent's; the PoB gaps it cites were re-checked in `../pob-gaps.md`, and its patterns are consolidated in `../worklog.md`.

---

p5aRVgy0pM4: Oracle Entangle card

HEADER
- Video: p5aRVgy0pM4. Title: "2 Buttons to Do EVERYTHING | Oracle Entangle ultimate Build Guide | Path of Exile 2 FR 0.5.5".
- Creator: Amonera.
- Patch: 0.5.5 (Forbidden Rites). Our PoB pin is for 0.5.4.
- Build: Druid Oracle. The main skill is Entangle, with Thrashing Vines as a second button. The character is level 93.
- Budget: the creator calls it endgame with "many expensive items"; the rarity rings are the costliest piece. A budget pobb.in link is offered for league start.

THE CHAIN
1. Damage source: Entangle, a plant spell. It makes a crawling fissure, and vines from it latch onto nearby enemies. It is linked with Accelerated Growth II (trigger), Branching Fissures II, Rapid Casting II, Heft and Atalui's Bloodletting [02:25, frame]. PoB data says Branching Fissures II adds 2 side fissures at -30% damage.
2. Cost becomes damage: Atalui's Bloodletting turns all of the mana cost into a life cost. It also adds 2% of damage as extra physical per 20 life cost, capped at 40% [02:32, speech; text confirmed in PoB at sup_str.lua:462]. The creator calls life-for-costs "a trend on our gems": Cast on Critical's group carries Lifetap [02:59, frame].
3. Multiplier: Wildsurge Incantation. Storm and Plant spells deal 50% more damage, cost 50% less and have 75% less duration [08:40, burst + tree data]. Note that its cost cut lowers the life cost that item 2's bonus scales from; the creator doesn't address this.
4. Enabler: Inevitable Critical Hits (the Forced Outcome node). A hit that fails to crit re-rolls until it crits, losing crit bonus with each re-roll. Result: 100% crit with 227% crit bonus [08:35, burst; 01:53, poe.ninja frame].
5. Crit payoffs:
   - Nightscale gloves give "173% increased Mana Regeneration Rate if you've dealt a Critical Hit Recently" and "Cannot Regenerate Mana if you haven't" [05:36, frame]. The speech says "Knight's skill" and "life regen".
   - Cast on Critical (trigger) fires Bone Cage and Thunderstorm, with Astral Projection, Lifetap and Efficiency II [02:59, frame].
6. Second chain: Thunderstorm makes plants in its area Overgrown [03:08, speech; confirmed in its gem description]. Accelerated Growth II then triggers an explosion off each Overgrown plant (sup_int.lua:40). Thunderstorm also Drenches enemies. Entangle's data has a stat for +3 vines on wet enemies, but whether Drenched counts as wet is unconfirmed, and the creator never mentions it.
7. Thrashing Vines: Accelerated Growth II, Physical Mastery, Concentrated Area, Heft, Zarokh's Refrain [02:45, frame]. Zarokh's Refrain makes the spell echo three times on a 5-second cooldown. Speech puts Heft only on Entangle; the frame shows it on both.
8. Scaling: Prism of Belief adds levels to Entangle. The speech says +3; the 10:17 tooltip shows "+2 to Level of all Entangle Skills". Sacrificial Blood (spoken "Sacrifice of Blood") gives "40% increased Spell Damage with Spells that cost Life" in tree data; speech only on how it's obtained.
9. Defence (speech only):
   - Mind over Matter plus Eldritch Battery; the 08:36 tooltip shows the Oracle's Harmony Within ("Hit damage is taken from Mana before Life if…").
   - Heart of the Well jewel with 2-charge charms for mana on charm use.
   - Undying Hate for a life-spent regen keystone, which is not in tree text.

PATTERNS
- Item 6 (crit → Cast on Critical → Thunderstorm → Overgrown → explosion) maps to inputs-and-outputs.
- Item 4 (Inevitable Crits) maps to forced condition. It makes "crit recently" permanent, which switches on Nightscale and Cast on Critical.
- Item 3 (Wildsurge) is close to zeroed resource. The drawback is priced in duration, which matters little for a spammed spell.
- Sigil of Power and Vulnerability on weapon set 2, with curse-magnitude points [09:17], map to weapon set 2 job. The creator calls it optional.
- NEW, "split pools": move every skill cost onto the pool you don't defend with, and take bonuses keyed to paying it. Here, costs go to life so mana stays a full defensive buffer. Works with any skill.
  Search: start from a damage-from-mana-first defence (MoM, Harmony Within, Eldritch Battery). Search supports and nodes for "Life cost", "instead of Mana", "per X Life cost" and "Spells that cost Life".
- NEW, "keystone as pathing anchor": the Oracle's Entwined Realities lets you allocate non-keystone passives in a medium radius of any allocated keystone without a connecting path. Keystones are taken for their radius [08:53].
  Search: start from the Oracle ascendancy. List keystones with harmless drawbacks whose medium radius holds wanted notables.

HOW POB FOLLOWS IT
- Modelled:
  - Wildsurge: the combined line parses (ModCache.lua:6728).
  - Inevitable Crits: CalcOffence.lua:3740.
  - Atalui's Bloodletting extra-physical statMap.
  - Sacrificial Blood: ModCache.lua:2956.
  - Heft and Prism of Belief.
- Count-approximated: no entangle_* stats or number_of_branching_fissures are mapped anywhere in Modules/. So PoB shows one fissure plus one vine instance. A Count of about 2–3 on the vines would approximate branching fissures and several vines on one target. That is my estimate, not checked against the game.
- Can't follow:
  - The Accelerated Growth II explosion: Modules/ has no explosive_growth trigger handling.
  - Cast on Critical: PoB's handler (CalcTriggers.lua:1089, "cast on critical strike") requires an Attack as the trigger source. The PoE2 gem is energy-based (act_int.lua:2057), so Thunderstorm and Bone Cage rates are likely wrong.
- Missing or unverified content: 0.5.5 vs our 0.5.4; the Undying Hate life-spent keystone; "Kurgal's gaze" and the "Xerox's gift" anoint (names uncertain, unchecked).

EVIDENCE AND QUALITY
- The poe.ninja panel [01:53] shows Entangle at 100k DPS, Bone Cage 82k, Thrashing Vines 48k. The creator calls the number "very poorly calculated" and points to juiced Ritual map clears ("looks like upwards of a million"). No boss kill or test is shown in what I sampled.
- Defence numbers are spoken: 2k life, 2.5k mana, 14k effective HP, 75% all resistances including chaos.
- Quality: a tidy, chaptered gear and gem walkthrough with reasons per slot. It barely explains why the damage works, and small errors (Prism level, Heft placement, "Knight's skill") mean every name needs a frame check.

FOR THE BRAINSTORM PHASE
- Once a keystone makes a condition permanent (always crit), harvest every item and gem that keys off it, including the ones with downsides (Nightscale's no-regen clause).
- Pick one pool to pay costs and one to defend with, then convert all costs to the paying pool.
- For multi-instance skills (vines, fissures, triggered explosions), treat the sheet DPS as a floor. The creator sanity-checks with clear footage instead.

LINKS SEEN (unopened)
- Mobalytics planner: https://mobalytics.gg/poe-2/profile/pretty-dragon-wajcx0/builds/4845337f-ddd6-43aa-bdb6-97e304787d09
- poe.ninja character: https://poe.ninja/poe2/profile/handsolution-6795/forbiddenrites/character/Amonish
- Budget PoB: https://pobb.in/hzKQsR2Y5Ht2
- Also Twitch, StreamElements, Patreon and the YouTube streams page.

REFERENCE ENTRY
p5aRVgy0pM4 (Amonera, 0.5.5): Oracle Entangle, 2 buttons. Life-cost Entangle (Atalui's Bloodletting) with Wildsurge Incantation's more damage and Inevitable Crits for 100% crit. Crit drives Cast on Critical → Thunderstorm → Overgrown plants → Accelerated Growth II explosions. Mana is kept as the defence buffer.
Patterns: inputs-and-outputs, forced condition, zeroed resource (variant), weapon set 2 job; new: split pools, keystone as pathing anchor.
PoB: hit modelled; vines and fissures need Count; the explosion and Cast on Critical triggers aren't followed. Links: pobb.in/hzKQsR2Y5Ht2, poe.ninja Amonish.

I used 9 of the 10 frames. All frames are in /home/parker/projects/yt-library/videos/p5aRVgy0pM4/frames/.
