# Pattern library (v1)

How off-meta builds link a damage source to the pieces that make it work, as shapes to search for (spine
C-53, D-290). Every R1a researcher reads this file whole before writing cards. Start with the questions.

## Brainstorm questions

Ask these of every candidate; the builds in brackets showed why.

1. What is the damage source, what does it read, and which slot carries it? (Shield Charge, Enervating
   Nova)
2. Fix the payoff first, then judge each piece by whether it feeds it. (Empyrean)
3. What does the payoff consume or require, and can the skill create it? If not, it's a builder and a
   finisher, and the lock must fit by tag. (Wing Blast, Shockchain)
4. The enabler: name it, the level it arrives at, and how to get it ("dormant until X"). Its downside is the
   next buy. (Eye of Winter, Gathering Storm)
5. Which routine action already produces the resource it needs? (Empyrean, Walking Calamity)
6. Read the skill's own text for payout conditions, ramps and hidden scaling. (Wing Blast, Varashta, Eye of
   Winter)
7. Tag audit: which +level sources and supports can reach it? (Walking Calamity, Fangs)
8. Search other skills' text for the main skill's tags, and pair-test the planned skills. (Shield Charge,
   Empyrean)
9. Give it the standard kit before calling it weak. (Bone Cage)
10. How does the required state fail? Plan one fix per failure. (Fangs)

The answers fill the card (`templates/card-template.md`). The questions and the ten families come from
[worklog], "Off-meta builds 7–30"; the earlier patterns from its "Off-meta builds 2–6".

## How to read an entry

- **Shapes only.** Re-check every use against current game data with a lookup: names, numbers and wording
  change between patches. The studies span 0.3 to 0.5.5 plus one Path of Exile 1 video (each source's
  patch is in Sources); the pin is 0.5.4.
- **The studies show what players do, not game truth.** They are agents' reports on creators' videos and
  write-ups, and creators err. A card is dealt only when a lookup confirms every load-bearing link in game
  text (the sniff test, R1a-assemble). A claim marked unverified here needs that check, or "needs in-game
  testing" on the card. An interaction no game text documents is never used.
- **Fields.** **Shape:** one sentence true of any skill. **Search:** the starting point, the lookups, what to
  check. **PoB:** how PoB follows it, in six labels: **modelled**; **Count** (the group's Count multiplies
  its damage); **custom modifier** (a hand-calculated line PoB applies as a modifier); **config stand-in** (a
  config option stands for the mechanic); **hand calculation** (a ledger entry); **not modelled**. PG-n is
  an entry in [pob-gaps]. "Not established" means no study checked it: count it not modelled until
  coverage shows the line applies. **Examples:** one to three builds, each citing its study. **Cautions:**
  what went wrong, or what to check first.
- **Lookups in short form.** `mechanic "<phrase>" (<kind>)` is `mcp__pob2__lookup_game_data {mode:
  "mechanic", query, kind}`; "gem lookup" and "unique lookup" are its other modes; `tree "<text>"` is
  `mcp__pob2__search_tree_nodes {query}` (`{ascendancy}` for its nodes); coverage is
  `mcp__pob2__check_model_coverage`. Mechanic search is a substring match capped at 20–30 results (PG-48),
  so keep phrases narrow and set `kind`. It can't see Gemling quality effects (PG-46) or item-base
  implicits until D-299's lookup additions land.
- **Maintenance.** After each study the user supplies, the coordinator proposes entries and the user
  approves them (§7.6, C-53).
- **Seen in two or more independent builds:** relay past a self-exclusion, stat-to-damage bridge, cost
  redirection, cost to a gated resource, builder and finisher with a payoff thief, Archon of Undeath with
  Muster on command skills, Concussive Runes shockwaves, Gemling quality [worklog].

## 1. Loops and relays

### Inputs and outputs

- **Shape:** list what the skill consumes and produces (resources, objects it leaves, ailments, events) and
  who else supplies or consumes each; links between skills are usually one of these.
- **Search:** from the damage source's gem text, one narrow mechanic search per noun (`mechanic "mana
  spent" (unique)`, "corpse", "Ice Crystal"); check who supplies and consumes it, and whether the text treats
  "you" and "other" differently. Re-run on the next bottleneck.
- **PoB:** not modelled for most links: energy-based meta gems have no trigger rate (PG-9), so the rate is a
  hand calculation; each skill's own hit is usually modelled.
- **Examples:** The Eraser: the chaos ignite charges Cast on Elemental Ailment, which casts a level-1
  Contagion to spread it [eraser]. Melting Maelstrom: Decompose spends the mana the flask pays out as
  damage [maelstrom].
- **Cautions:** "ignite" matches about 55 gem descriptions, past the cap [eraser].

### Closed trigger loop

- **Shape:** a trigger's output recreates its own condition, so one seed keeps it running until a decay
  timer lapses.
- **Search:** for each trigger (a Cast on X gem, a Herald, an on-shatter effect) list its outputs; check
  whether one reaches its condition; name the seed and the timer.
- **PoB:** not modelled: the trigger (PG-9); Verglas needs a custom modifier (PG-22).
- **Examples:** Earthshatter: freezes trigger Frost Wall, Earthshatter breaks the walls, Verglas refreshes
  for 6 s; a manual Frost Wall seeds it [earthshatter].
- **Cautions:** plan the reseed (map start, before bosses).

### Relay past a self-exclusion

- **Shape:** the engine ignores its own hits, so a second skill triggered by its output closes the loop.
- **Search:** from a "non-<type>" or "other skills" clause, list the engine's outputs; `mechanic "Shatter"
  (gem)`, "on kill", "Heavy Stun" for triggers; check the triggered skill lacks the excluded type.
- **PoB:** not modelled: the Runic Shockwave has no skill definition (PG-10); crystal creation isn't modelled
  (PG-17).
- **Examples:** Eventide Petals: kill-triggered Heralds shatter the crystals other skills' crits made, and
  re-feed the petals [eventide]. Flicker Monk: the Concussive Runes shockwave is a non-Herald attack, so it
  re-fires both Heralds [flicker].
- **Cautions:** the chain is as reliable as its weakest gate (stun buildup, crit) [flicker].

### Routine action as damage

- **Shape:** an action the build does anyway (reload, walk, block, flask use) fires the payload, best when an
  event the build already makes performs it.
- **Search:** from the trigger verb on an item or skill, `mechanic "automatically" (gem)` and "when you";
  check event → action → payload closes.
- **PoB:** not modelled for reloads (PG-12): hand calculation, surge hit × bolts per second. Volcanic Steps:
  Count = movement speed ÷ 12 (PG-13).
- **Examples:** Crossbow Titan: Double Barrel III reloads on heavy stun, refilling Double Vision's surges
  [crossbow]. Ancestral Cry Titan: Volcanic Steps every 12 units travelled [ancestral-cry].
- **Cautions:** input demand is a con. Melting Maelstrom's stacking windows are the creator's observation,
  not item text [maelstrom].

### Kill-gated consumer

- **Shape:** a consume support on an on-kill skill works in packs and idles on bosses, so the boss keeps the
  state a single-target payoff needs.
- **Search:** list the on-kill skills (Heralds) and the supports they take with `mechanic "Consume" (gem)`.
- **PoB:** modelled for Biting Frost's more damage against frozen enemies; the kill gating is not modelled.
- **Examples:** Eventide Petals: Biting Frost II on the Heralds; bosses stay frozen for Heavy Frost
  [eventide].
- **Cautions:** run the payoff-thief audit.

### Debuff loop split across two skills

- **Shape:** one skill applies a debuff with a lasting per-application bonus; another consumes it but can't
  apply it, so the first re-applies.
- **Search:** from the debuff (`mechanic "fully broken" (gem)`), pair an applier with a consumer that cannot
  apply it; check the cap.
- **PoB:** hand calculation: Uruk's Smelting's damage taken is not modelled [mirage-sniper].
- **Examples:** Bone Cage: Uruk's Smelting on Vines, +5% physical taken per break up to 20%; Exploit
  Weakness consumes it [bone-cage].
- **Cautions:** a 0.4 source; re-check the numbers.

### Condition carrier

- **Shape:** an off-skill whose only job is to trigger a support's buff on you and allies.
- **Search:** supports granting a buff on an ailment (`mechanic "<ailment>" (gem)`); rank same-weapon skills
  by built-in buildup.
- **PoB:** not modelled until coverage shows otherwise (not established).
- **Examples:** Walking Calamity: Lunar Assault's 436% more freeze buildup carries Bhatair's Vengeance
  [walking-calamity].
- **Cautions:** for an unmet condition climb a ladder, cheapest first: supports, a stronger skill, a
  same-weapon skill with a built-in multiplier, a new weapon [walking-calamity].

### Placed detonator

- **Shape:** one skill places an object and the main skill breaks it for a bigger hit.
- **Search:** `mechanic "shatter" (gem)`, "explode"; match the text's "your <tag>" to the main skill's
  types.
- **PoB:** not modelled until coverage shows otherwise (not established; the study found the data only).
- **Examples:** Shield Charge: "your Slams, Warcries, and Shield Charge will instantly shatter" Shield Wall
  [shield-charge].
- **Cautions:** 80% less if enemies break it within 0.5 s; Glacial Bolt's crystals have a like penalty
  [glacial-bolt].

## 2. State consumers (builder and finisher)

### Builder that can't spend

- **Shape:** the payoff consumes a state the skill can't create, or the payload would take the engine's
  event; a "builds X but cannot cause X" support keeps it for the finisher.
- **Search:** `mechanic "cannot cause" (gem)`, "instead of"; check the lock's required types against the
  builder (gem lookup).
- **PoB:** config stand-in for the state where an option exists (Heavy Stunned, PG-32); who spends it first is
  not modelled. The payoff may be its own stat set.
- **Examples:** Wing Blast: Brink on Wind Blast; grenades failed because Brink supports Melee only
  [wing-blast]. Crossbow Titan: Pin II keeps the surges from taking the heavy stuns [crossbow].
- **Cautions:** run the payoff-thief audit.

### Staged handover

- **Shape:** the skill that applies the condition is the main and the payoff a burst, until supply lets the
  payoff take over.
- **Search:** for a skill with "Consumes X" or "Cannot X", list what applies X; check uptime with and
  without each.
- **PoB:** config stand-in: the condition on and off at a realistic uptime (checklist 6).
- **Examples:** Shockchain Arrow cannot shock; Lightning Arrow stayed main until Spreading Shocks raised
  supply [shockchain].
- **Cautions:** chains need several targets: ask what happens on one [shockchain].

### State-keyed payoffs

- **Shape:** list the states the build always applies, then collect "against X enemies" modifiers.
- **Search:** the skeleton's guaranteed states (Frozen, Cursed, Heavy Stunned); `mechanic "against <state>"
  (passive)`, then unique and mod.
- **PoB:** config stand-in where the option exists (Heavy Stunned, Isolated); else not modelled.
- **Examples:** Fangs of Frost: Exploit the Elements and Honourless against frozen enemies [fangs]. Ancestral
  Cry: Sine Aequo's 41% threshold keeps "against heavy stunned" on [ancestral-cry].
- **Cautions:** a consumer added later removes the state [fangs].

### Payoff thief (anti-pattern)

- **Shape:** an independent hit source spends the state, or takes the event, before the finisher does.
- **Search:** list every hit-making child: triggered skills, minions, ascendancy procs, explosions, item
  effects (D-299's hit-making children once built); check the lock reaches each.
- **PoB:** not modelled: a risk, never a number.
- **Examples:** Wing Blast: gloves, stags, wolves and curse explosions stole the stun [wing-blast]. Fangs:
  Elemental Sundering consumed the freeze Honourless needed [fangs]. Flicker: Charged Staff spends Flicker's
  charges [flicker].
- **Cautions:** re-run it whenever a consumer joins.

## 3. Resource conversions

### Zeroed resource

- **Shape:** make a resource count for nothing, then harvest every drawback priced in it.
- **Search:** from the zeroing line (Chaos Inoculation, "does not affect"), search drawbacks in that
  resource (`mechanic "less maximum Life" (unique)`); check each costs nothing.
- **PoB:** modelled: CI, Black Scythe Training, Doryani's self side.
- **Examples:** HotG: under CI, Flesh Crucible's and Medved's life costs are free [hotg]. Enervating Nova:
  lightning resistance stops protecting you, so negative rolls are free [enervating].
- **Cautions:** patch the hole you open [enervating]; under CI the chaos floor needs D1's exception (D-234).

### Not consume to 100%

- **Shape:** a chance not to consume, pushed to 100%, turns a per-use cost into a one-time unlock.
- **Search:** the skill's costs and gates (Glory, charges); `mechanic "not consume" (gem)`, "not remove",
  quality lines; work out the threshold.
- **PoB:** not modelled: Glory (PG-7) and charge retention (PG-29). Hand calculation: uses per second =
  income ÷ requirement, until 100%.
- **Examples:** HotG: 44% quality gives 110% chance not to consume Glory [hotg]. Stormcaller: 94% chance not
  to remove Barrage's charges [stormcaller].
- **Cautions:** a Glory-gated skill computes as spammable: its figure is an upper bound [hotg].

### Cost redirection

- **Shape:** costs move to a second pool (split pools), so the first stays full as a damage stat or a
  defence buffer.
- **Search:** from scaling keyed to a full pool (Archmage, Zenith, Mind over Matter), `mechanic "Life cost"
  (gem)`, "instead of Mana"; then the paying pool's sustain.
- **PoB:** modelled: Archmage, Atalui's Bloodletting; Zenith is a config stand-in.
- **Examples:** Widowhail Spark: Lifetap and Atalui's move costs to life [widowhail]. Oracle Entangle: life
  pays, mana defends [oracle].
- **Cautions:** Wildsurge's cost cut shrinks the life cost Atalui's bonus reads [oracle].

### Cost to a gated resource

- **Shape:** a spent resource turns into a gated one (Glory, energy), so costs and drawbacks become fuel.
- **Search:** `mechanic "of Life spent" (gem)`; supports raising cost or cooldown uses; for a trigger event,
  supports whose drawback causes it.
- **PoB:** not modelled: Glory (PG-7), meta-gem energy (PG-9); hand calculation.
- **Examples:** Ancestral Cry: Zerphi's Infamy turns life spent into Glory [ancestral-cry]. Empyrean: Blood
  Mage's life costs fuel Starborn Onslaught [empyrean]. Bone Cage: Minion Pact's drain makes the minion
  deaths a trigger needs [bone-cage].
- **Cautions:** PoB applies Zerphi's more damage without its Glory requirement [hotg].

### Overflow resource

- **Shape:** a resource fills only while another is capped; a threat-scaled generator refills it when the
  burst matters.
- **Search:** `mechanic "while already at maximum" (gem)`, "counted monster Power"; rank by gain rate.
- **PoB:** not modelled (PG-7): hand calculation.
- **Examples:** Walking Calamity: Glory from Rage gained at maximum; Raging Cry by a boss fills it
  [walking-calamity].
- **Cautions:** Fireflower's self-damage firing Ngamahu's Chosen is unverified ("from a Hit").

### The enabler funds its own payoffs

- **Shape:** a forced-condition enabler's other line produces the resource its payoffs cost.
- **Search:** read the enabler's other lines against the payoffs' costs.
- **PoB:** modelled for low life from reservation [stormcaller]; the spirit line is not established, so not
  modelled until coverage shows otherwise.
- **Examples:** Gathering Storm: Beidat's Will reserves 25% of life and grants spirit per 25 life, paying
  for Direstrike II [gathering-storm].
- **Cautions:** "funds itself" is the study's inference.

### Mirrored stat

- **Shape:** an effect copies your stat onto enemies, so push yours low, with its drawback cancelled.
- **Search:** `mechanic "equal to yours" (unique)`; then every negative source of that stat (low rolls,
  Vaal outcomes, catalyst quality, Kalandra's Touch).
- **PoB:** modelled: enemy resistance set to yours, floored at −200, in Presence.
- **Examples:** Enervating Nova: Doryani's Prototype at −200% lightning resistance [enervating].
- **Cautions:** only enemies in Presence.

## 4. Stat bridges

### Stat-to-damage bridge

- **Shape:** a clause makes a non-damage stat, or another actor's stat, count for your damage ("also apply
  to", "also affects you").
- **Search:** `mechanic "also apply to" (gem)`, "also affect" (unique, passive), filtered by the skill's
  types; then the bridged stat's sources.
- **PoB:** modelled: Projectile Acceleration III; scope bridges not established.
- **Examples:** Widowhail and Twister: projectile speed becomes damage [widowhail] [twister]. Empyrean:
  Trenchtimbre makes minion attack speed yours [empyrean].
- **Cautions:** Twister's speed source, Primal Bounty, is not modelled (PG-16), and The Mhacha's Gift lags the
  game (PG-44).

### Pivot and broadcast bridges

- **Shape:** an "X also applies to Y" line carries invested X across a pivot, or broadcasts a stat to its
  siblings.
- **Search:** `mechanic "also applies to" (unique)`, then passive, with X an invested stat.
- **PoB:** not modelled until coverage shows otherwise (not established).
- **Examples:** Fangs: Sacrosanctum's recoup survived the CI pivot [fangs]. Bone Cage: Coal Stoker counts
  fire resistance at 50% for cold and lightning [bone-cage].
- **Cautions:** old sources; Sacrosanctum's values changed [fangs].

### Attribute bridge

- **Shape:** one attribute pays for both damage and defence.
- **Search:** from a "per X Strength" damage line (gem), search "per N Strength" defence lines in
  keystones, timeless jewels and uniques.
- **PoB:** modelled.
- **Examples:** Supporting Fire: minion damage per Strength; Black Scythe Training gives energy shield per 2
  Strength [supporting-fire].
- **Cautions:** Giant's Blood triples attribute requirements.

### Object stat as damage

- **Shape:** a support pays out a spawned object's stat as damage, so cheap modifiers on that stat scale
  damage.
- **Search:** from skills that spawn objects, `mechanic "Ice Crystal" (gem)`; then what raises the object's
  stat.
- **PoB:** custom modifier: Verglas (PG-22), X% extra cold with X = crystal life ÷ 2000.
- **Examples:** Earthshatter and Stormcaller: Frost Wall crystals feed Verglas [earthshatter]
  [stormcaller].
- **Cautions:** Verglas lasts 6 s.

### Stat-as-base convergence

- **Shape:** a damage source whose base reads a pool stat, plus every "per X of that stat" multiplier,
  compounds faster than linearly.
- **Search:** `mechanic "per 100 maximum" (unique)` with the stat, then passive; check mutated uniques.
- **PoB:** modelled, with the "Current Mana %" config option; Count stays 1 (a 1 s cooldown caps procs).
- **Examples:** Mana Flare Shaman: 25% of current mana as a hit, at 20k mana [mana-flare].
- **Cautions:** mutated uniques aren't in the data (PG-42); mana sustain is a hand calculation.

### Damage-source substitution

- **Shape:** the skill's damage reads something other than the weapon, so only what reads that source
  counts.
- **Search:** read the skill's added-damage stats (gem lookup); keep supports and mods that read it.
- **PoB:** not modelled until coverage shows otherwise (not established; the data has damage per 15
  shield armour).
- **Examples:** Shield Charge: shield armour is the damage [shield-charge].
- **Cautions:** re-audit supports when the source moves [shield-charge].

### Defence that scales damage

- **Shape:** a defence stat also pays damage (block, armour), or sizes another defence.
- **Search:** `mechanic "per 1% Chance to Block" (passive)`, "of Armour"; then unique and gem.
- **PoB:** modelled: block to damage, Refraction III; Arctic Armour's per-stage armour is not modelled
  (PG-30), so armour reads low.
- **Examples:** The Eraser and Infernal Cry: block as damage [eraser] [infernal-cry]. Earthshatter: armour
  into exposure [earthshatter].
- **Cautions:** a layer sized from another stat costs some of it: Sorcery Ward takes armour
  [walking-calamity].

### Type conversion so another mechanic applies

- **Shape:** change the damage type, or grant a type permission, so another mechanic applies.
- **Search:** after an "instead of", "Converted" or "can <ailment>" line, search the new type's phrase
  (`mechanic "Chaos damage over time" (gem)`).
- **PoB:** modelled: Blackflame's chaos ignite; the spread is not modelled (PG-21).
- **Examples:** The Eraser: Blackflame's chaos ignite lets Contagion spread it [eraser]. Twister: cold
  conversion lets freeze apply [twister].
- **Cautions:** a non-DPS floor may follow: ignite of at least 2 s [eraser].

## 5. Copies and rate

### Proxy multiplier

- **Shape:** copies or helpers fire the damage source again; instances up at once = duration ÷ cooldown,
  or the limit.
- **Search:** meta gems accepting the skill (D-299's "usable by"; today `mechanic "ranged attack" (gem)`
  finds Mirage Archer); `mechanic "Repeat" (gem)`, "fired at".
- **PoB:** Count: mirages (PG-4), Spell Cascade (PG-6), mimics (PG-14), Now and Again (PG-15), aftershocks
  (PG-24); Tornado Shot's copies are zero (PG-21).
- **Examples:** Mirage Sniper: about 6 Mirage Archers fire Snipe [mirage-sniper]. Enervating Nova: Spell
  Cascade and mimics [enervating].
- **Cautions:** coverage gives Mirage Archer a false all-clear (PG-49); Count also multiplies per-copy
  reservation [worklog].

### Repeat to cap

- **Shape:** the payload adds N stacks per trigger against a cap M, so an echo turns one press into
  ceil(M/N) triggers.
- **Search:** pair a stacks-per-application stat with a stage limit (gem lookup); then echo supports.
- **PoB:** config stand-in: the stack count option; Count stays 1.
- **Examples:** Infernal Cry: Echoing Cry fills Corrupted Blood's 10 stacks in one press [infernal-cry].
- **Cautions:** whether the echo's damage penalty reaches the payload is unconfirmed.

### Cooldown recovery as DPS

- **Shape:** a skill held by its cooldown is multiplied by cooldown recovery; a buff that procs on a kind of
  skill is fed by its cheapest one (a proc farm).
- **Search:** cooldown above use time: `mechanic "Cooldown Recovery" (passive)`; `mechanic "when you use a"
  (passive)`, then rank that kind's skills by cost.
- **PoB:** Count about 2.5, hand-derived: Archon of Undeath is not modelled (PG-11).
- **Examples:** Supporting Fire: Archon's 200% more command cooldown recovery, proc-farmed [supporting-fire].
  Varashta: Archon feeds the ramp [varashta].
- **Cautions:** the 2.5 holds only while the cooldown limits; the proc spam is the creator's claim.

### Sequence ramp fed by use rate

- **Shape:** damage ramps with consecutive uses inside a window, so more uses per window multiply it.
- **Search:** the skill's text: "per consecutive", "in sequence"; then cooldown recovery or extra uses for its
  type.
- **PoB:** custom modifier at the expected step (PG-25); Count is the wrong tool for ramps.
- **Examples:** Varashta: Kelari's Deception, 50% more per consecutive use up to 300% [varashta].
- **Cautions:** the node's "Grants Skill" line parses to nothing (PG-40).

### Count events, not damage

- **Shape:** when the payoff counts qualifying hits, add cheap hits that always qualify, trading size for
  rate.
- **Search:** the noun in the engine's trigger; `mechanic "always Critical" (gem)`; rate-for-size supports.
- **PoB:** Count = crystals shattered per second, a hand calculation (PG-17).
- **Examples:** Eventide Petals: always-crit bells and Pinpoint Critical [eventide].
- **Cautions:** the Count holds only if PoB rates the crystal at one use per second [eventide].

### Burst-window stacking

- **Shape:** temporary and next-hit multipliers lined up for one charged release.
- **Search:** list cries, mantras and combo buffs; confirm each applies to the release hit.
- **PoB:** not modelled until coverage shows otherwise (not established).
- **Examples:** Gathering Storm: four buffs before the dash [gathering-storm].
- **Cautions:** the charge-up is the exposed phase.

### Stacking rate caps

- **Shape:** a ramp gains per hit and may cap stacks per second, so a few big hits gain little.
- **Search:** the ramp's text; stacks per second at the real hit rate.
- **PoB:** hand calculation: rate caps aren't in the data (PG-45).
- **Examples:** Shield Charge: Inner Turmoil's one stack per 0.1 s gave 5–6 stacks [shield-charge].
- **Cautions:** reject ramps that want many small hits for a big-hit build.

### Speed as a damage dial

- **Shape:** when damage grows with travel or the emitter moves, projectile speed is a dial both ways;
  many small hits turn per-hit effects into sustain.
- **Search:** "constantly releases", "gains damage" in gem text; hits per second to rank per-hit mods.
- **PoB:** not modelled until a skill-shape probe shows otherwise (checklist 8): a Path of Exile 1 source.
- **Examples:** Eye of Winter: Slower Projectiles raised damage [eye-of-winter].
- **Cautions:** none of its game facts apply to PoE2.

## 6. Levels, quality and tags

### Level-carrier host

- **Shape:** a support-granted skill takes the host's level (the creator's claim), so pick the host for its
  +level sources.
- **Search:** support-granted skills with a level table on a one-level support; rank hosts by +level
  sources.
- **PoB:** not modelled (PG-2): set the support's level by hand (untested).
- **Examples:** Infernal Cry: Twisted Pact at 39 in game, about 3 in PoB [infernal-cry].
- **Cautions:** the game rule is unverified; lineage supports need level 65.

### Quality as a stat line

- **Shape:** quality grants a second effect (Gemling, or a gem's own line), so quality scales.
- **Search:** each gem's quality lines (gem lookup; Gemling lines unseen until D-299, PG-46).
- **PoB:** modelled where mapped (47 of 244 Gemling stats aren't, PG-31); Gem Studded ties give one colour
  (PG-1).
- **Examples:** Stormcaller: +1 arrow per 10% quality [stormcaller]. HotG: Glory retention [hotg].
- **Cautions:** the user expects a Gemling nerf in 1.0 [worklog]; a quality threshold is a stage.

### Low-level utility gems

- **Shape:** a gem whose job isn't damage stays low-level to cut its cost.
- **Search:** read each utility gem's cost by level (gem lookup).
- **PoB:** modelled.
- **Examples:** Glacial Bolt: Verisium at 8, Entangle at 2 [glacial-bolt]. The Eraser: Contagion at 1
  [eraser].
- **Cautions:** an over-levelled gem can lock you out on attributes [empyrean].

### Type-granting support unlock

- **Shape:** a support adds a skill type another support requires.
- **Search:** read the wanted support's required types; find supports adding them (D-299 once built).
- **PoB:** not modelled until coverage shows otherwise, for the unlocked effect (not established).
- **Examples:** Flicker Monk: Culmination II lets Ailith's Chimes support Whirling Assault [flicker].
- **Cautions:** "infinite power charges" is the creator's word.

### Tag audit

- **Shape:** the payoff's skill types decide which +level sources and supports reach it.
- **Search:** the payoff's types (gem lookup); the matching +level and "X skills" mods.
- **PoB:** modelled: level bonuses match tags.
- **Examples:** Walking Calamity: only "+level of fire skills" applied [walking-calamity]. Fangs: the Area
  tag let area supports hit the stab [fangs].
- **Cautions:** check which part each support touches (checklist 5).

### Filler to satisfy a count

- **Shape:** cheap gems or minions raise a counter (support colours, socketed gems, minion types).
- **Search:** `mechanic "different type" (gem)`, "for each"; count what the plan holds.
- **PoB:** modelled, but Gem Studded ties wrongly (PG-1) and Muster counts by granted effect (PG-3).
- **Examples:** Stormcaller: unused supports for 17/17/17 [stormcaller]. Supporting Fire: a Muster zoo
  [supporting-fire].
- **Cautions:** in PoB a 17/17/17 balance gets Red only.

## 7. Conditions

### Forced condition

- **Shape:** make a condition always true by lowering its threshold or reserving into it.
- **Search:** from a "while X" payoff, search X (passive, unique); thresholds: "fewer", "instead of";
  reservation: "Reserves".
- **PoB:** config stand-in; modelled where PoB derives it (low life from reservation, Surrounded at one
  enemy).
- **Examples:** Gathering Storm: Coward's Legacy and Beidat's Will hold life at 75% [gathering-storm]. HotG:
  Constricting Command makes one enemy surround you [hotg].
- **Cautions:** permanence needs reservation of at least 1 minus the threshold; Crushing Blows are unparsed
  (PG-32).

### Outcome lock

- **Shape:** a node fixes a random effect to its best variant.
- **Search:** `mechanic "are Purple" (passive)`, "All"; ascendancy text.
- **PoB:** modelled for your own flames.
- **Examples:** Chayula: every flame purple [chayula-minions].
- **Cautions:** relayed to minions, see Buff relay.

### Saturated type count

- **Shape:** one enabler fills a "per distinct type" counter, so every scaler reading it is full.
- **Search:** `mechanic "for each type of" (passive)`, from an item granting several types.
- **PoB:** config stand-in: tick all three ground boxes (PG-35).
- **Examples:** Twister: The Taming feeds Harness the Elements and Trinity [twister].
- **Cautions:** Trinity wants the three elements kept balanced [twister].

### Drawback cancellation and offload

- **Shape:** a node removes a penalty, or a "cannot X" support sits where another skill supplies X.
- **Search:** nodes reducing each drawback (passive); supports saying "cannot", then a free slot for X.
- **PoB:** modelled for Gem Studded's movement line; the offload not established.
- **Examples:** Shockchain: Gem Studded's movement penalty cut [shockchain]. Twister: Blindside's lost Blind
  comes from the companion [twister].
- **Cautions:** check the bonus doesn't need what it stops.

## 8. Item and slot tricks

### Amplified slot as stat stick

- **Shape:** wear an item the skill doesn't use because it multiplies another slot's matching mods.
- **Search:** mods by the skill's tags; `mechanic "bonuses gained from Equipped" (unique)`.
- **PoB:** modelled; a roll above the data range is typed in (PG-41).
- **Examples:** Widowhail Spark: a caster's bow for a ×4 quiver [widowhail].
- **Cautions:** a 0.4 source.

### Socket amplifier plus latent lines

- **Shape:** an item multiplies its sockets, and an ascendancy turns on hidden lines there.
- **Search:** `mechanic "effect of Socketed" (unique)`; the runes' Bonded lines.
- **PoB:** modelled.
- **Examples:** Mana Flare: Runeseeker's Call triples runes; Wisdom of the Maji enables Bonded lines
  [mana-flare].
- **Cautions:** the creator reports one rune line not tripled.

### Support moved to gear

- **Shape:** an item mod copying a support gem frees its slot.
- **Search:** each planned support's effect (unique, mod).
- **PoB:** not modelled until coverage shows otherwise (not established).
- **Examples:** Empyrean: bleed-chance armour replaced Bleed I [empyrean].
- **Cautions:** the armour's name is unchecked.

### Skill granted by an item base

- **Shape:** an implicit skill on a base can be the main skill, free to cast and scaled by +levels.
- **Search:** item-base implicits (unsearchable until D-299, PG-48); the skill's roll range.
- **PoB:** hand calculation: Enervating Nova's edge bonus is unmapped (PG-26).
- **Examples:** Enervating Nova on a Paralysing Staff [enervating].
- **Cautions:** a wide roll favours min-or-max and luck.

### Bimodal roll plus luck

- **Shape:** min-or-max rolls change nothing alone; add lucky and the max lands 75% of the time.
- **Search:** "minimum or maximum" and lucky sources of the damage type.
- **PoB:** hand calculation: PoB averages lucky as uniform (PG-8), about 7% low.
- **Examples:** Enervating Nova: Esh's Prowess with 48% lucky [enervating].
- **Cautions:** check the roll range first.

### Weapon set 2 job

- **Shape:** the second weapon set does a non-damage job: casts a buff, primes a resource, unlocks a skill.
- **Search:** skills needing another weapon (gem lookup); items that prime the resource (unique).
- **PoB:** not modelled: a buff cast from set 2 at its higher level (the level carrying over is unverified: the
  creator hedges) [ancestral-cry]; Gem Studded counts every set's supports [hotg].
- **Examples:** HotG: Fury of the King primes Glory [hotg]. Wing Blast: the builder on set 2 [wing-blast].
- **Cautions:** a swap ritual is input demand.

## 9. Actors

### Inert minions

- **Shape:** minions that deal no damage serve as triggers, headcount or carriers.
- **Search:** `mechanic "deal no Damage" (gem)`; per-minion multipliers.
- **PoB:** config stand-in: Predator's Mark's count; Muster counts by granted effect (PG-3).
- **Examples:** Mirage Sniper: 14 wolves for Predator's Mark [mirage-sniper]. Maelstrom: clerics as corpses
  [maelstrom].
- **Cautions:** Glacial Bolt's minion detonation is in no game text, so it fails the sniff test
  [glacial-bolt].

### Buff relay

- **Shape:** a support or item turns a player-only buff into one on allies or minions.
- **Search:** `mechanic "instead of you" (gem)`, "as well as you"; check the stat is skill-agnostic.
- **PoB:** custom modifier (PG-27), "Allies in your Presence Gain N% of Damage as Extra Chaos Damage", with
  Count = the minions.
- **Examples:** Chayula minions: Selfless Remnants relays purple flames [chayula-minions].
- **Cautions:** Presence radius is uptime; a dead minion loses the stacks.

### Actor rerouting

- **Shape:** you press the button but another actor deals the damage, opening its multiplier pool.
- **Search:** granted command skills (`tree` on the ascendancy, gem lookup); that actor's multipliers.
- **PoB:** modelled as a minion skill; Archon is not modelled (PG-11).
- **Examples:** Varashta: Kelari's Deception as minion damage [varashta].
- **Cautions:** Muster's count can differ from the game's (PG-3).

### Reactive carrier

- **Shape:** a defensive buff that deals spell hits carries a trigger support.
- **Search:** spells with damage and buff types (gem lookup).
- **PoB:** not modelled until coverage shows otherwise (not established).
- **Examples:** Mana Flare: Arctic Armour carries Mana Flare [mana-flare].
- **Cautions:** the creator's description only.

### Movement delivers the radius

- **Shape:** a self-centred aura or curse rides a skill that lands you among enemies.
- **Search:** if the skill ends in melee range, list proximity auras and curses.
- **PoB:** not modelled until coverage shows otherwise (not established).
- **Examples:** Gathering Storm: Blasphemy on the dash [gathering-storm].
- **Cautions:** match the delivery to how the skill moves you.

### Control as defence

- **Shape:** freeze, slow or immobilise carries survival when damage is low.
- **Search:** the build's ailments that stop enemies acting; the class's slows.
- **PoB:** not modelled as defence: report it beside effective HP and max hit, never instead.
- **Examples:** Fangs: freeze and slows carried bosses [fangs]. Shockchain: electrocute [shockchain].
- **Cautions:** say plainly when control carries.

## 10. Tree

### Keystone as pathing anchor

- **Shape:** passives near a keystone are allocated without a path, so keystones are taken for their radius.
- **Search:** the ascendancy's nodes; keystones with harmless drawbacks near wanted notables.
- **PoB:** not modelled until coverage shows otherwise (not established).
- **Examples:** Oracle Entangle: Entwined Realities [oracle].
- **Cautions:** a 0.5.5 source.

### Node-effect multiplier steers cluster choice

- **Shape:** "increased effect of Small Passive Skills" makes small-node clusters the best paths.
- **Search:** `tree "effect of Small Passive Skills"`; rank clusters; force their conditions.
- **PoB:** modelled.
- **Examples:** Ancestral Cry Titan: Hulking Form with Constricting Command [ancestral-cry].
- **Cautions:** conditional small nodes need their condition forced.

### Radius jewel instead of an anoint

- **Shape:** a radius jewel reaches a notable without the anoint or a path.
- **Search:** before an anoint, check whether a radius jewel such as From Nothing reaches the notable.
- **PoB:** modelled.
- **Examples:** Twister: From Nothing near CI reaches Heavy Frost [twister].
- **Cautions:** From Nothing's radius belongs to one named node.

## Sources

Paths are from this file; each title is the source's patch.

[worklog]: ../../../../docs/build-guide/worklog.md "work-log"
[pob-gaps]: ../../../../docs/build-guide/pob-gaps.md "pin v0.23.1"
[maelstrom]: ../../../../docs/build-guide/studies/2026-10-09-GsLBMXy3tDk-melting-maelstrom-shaman.md "0.5.5"
[mirage-sniper]: ../../../../docs/build-guide/studies/2026-10-10-FUeS6JNqHrw-mirage-sniper.md "0.5"
[eraser]: ../../../../docs/build-guide/studies/2026-10-10-4BVTG_E7N-w-the-eraser.md "0.5.5"
[glacial-bolt]: ../../../../docs/build-guide/studies/2026-10-10-glacial-bolt-gemling.md "0.5, 0.5.5"
[stormcaller]: ../../../../docs/build-guide/studies/2026-10-10-L_bhEMOtqEI-stormcaller-arrow.md "0.5"
[hotg]: ../../../../docs/build-guide/studies/2026-10-10-r6yQKNRoVlI-hotg-hammer-engine.md "0.5.5"
[enervating]: ../../../../docs/build-guide/studies/2026-10-10-q8dhc4DOBPU-enervating-nova-chronomancer.md "0.5"
[infernal-cry]: ../../../../docs/build-guide/studies/2026-10-10-QO5Un_eRyQM-infernal-cry-gemling.md "0.5"
[eventide]: ../../../../docs/build-guide/studies/2026-10-10-lVEhfsub0mY-eventide-petals-martial-artist.md "0.5"
[oracle]: ../../../../docs/build-guide/studies/2026-10-10-p5aRVgy0pM4-oracle-entangle.md "0.5.5"
[flicker]: ../../../../docs/build-guide/studies/2026-10-10-t2o56g88DHk-whirling-assault-flicker-monk.md "0.5.5"
[earthshatter]: ../../../../docs/build-guide/studies/2026-10-10-Ix82BSjoAdY-9H1lUVfvxTg-earthshatter-gemling.md "0.5"
[crossbow]: ../../../../docs/build-guide/studies/2026-10-10-9Z9ep97Whkg-crossbow-titan-double-vision.md "0.4"
[mana-flare]: ../../../../docs/build-guide/studies/2026-10-10-ekgGPoNjvmo-mana-flare-shaman.md "0.5"
[chayula-minions]: ../../../../docs/build-guide/studies/2026-10-10-yeuHB5HnJFM-chayula-minion-monk.md "0.5"
[supporting-fire]: ../../../../docs/build-guide/studies/2026-10-10-cpbNC4toSxU-supporting-fire-tactician.md "0.5"
[widowhail]: ../../../../docs/build-guide/studies/2026-10-10-YHIm3ACDtHc-widowhail-spark-blood-mage.md "0.4"
[ancestral-cry]: ../../../../docs/build-guide/studies/2026-10-10-5W5YX6Zsb5Q-concussive-ancestral-cry-titan.md "0.5"
[varashta]: ../../../../docs/build-guide/studies/2026-10-10-d2QbaO-sJ3o-varashta-djinn.md "0.5"
[twister]: ../../../../docs/build-guide/studies/2026-10-10-6jbyoRO2pUs-twister-spirit-walker.md "0.5"
[eye-of-winter]: ../../../../docs/build-guide/studies/2026-10-10-X9wCdbgep5I-eye-of-winter-pathfinder-poe1.md "Path of Exile 1"
[empyrean]: ../../../../docs/build-guide/studies/2026-10-10-urJZoOU-w48-twisted-empyrean-blood-mage.md "0.5"
[wing-blast]: ../../../../docs/build-guide/studies/2026-10-10-S0diAweTCeI-wing-blast-spirit-walker.md "0.5"
[shockchain]: ../../../../docs/build-guide/studies/2026-10-10-zRIEdxQ20fQ-shockchain-arrow-gemling.md "0.4"
[gathering-storm]: ../../../../docs/build-guide/studies/2026-10-10-bdxU10Jjz30-gathering-storm-infernalist.md "0.4"
[bone-cage]: ../../../../docs/build-guide/studies/2026-10-10-rXDZlCW2dF8-bone-cage-smith-of-kitava.md "0.4"
[walking-calamity]: ../../../../docs/build-guide/studies/2026-10-10-aeT9rsQZ4dM-walking-calamity-witchhunter.md "0.4"
[fangs]: ../../../../docs/build-guide/studies/2026-10-10-gLac8n8iBeA-fangs-of-frost-chronomancer.md "0.3.1"
[shield-charge]: ../../../../docs/build-guide/studies/2026-10-10-1ZqM9dJ9MF0-shield-charge-chayula.md "0.3.x"
