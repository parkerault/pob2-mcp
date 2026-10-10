# Off-meta build 1: Melting Maelstrom Shaman (Troy Tesko)

An agent's study report, kept verbatim (2026-10-09). Brief: given in the prompt.
Its claims are the agent's; the PoB gaps it cites were re-checked in `../pob-gaps.md`, and its patterns are consolidated in `../worklog.md`.

---

## Melting Maelstrom Shaman (Troy Tesko, uploaded 2026-10-04, patch 0.5.5): findings

I used about 25 frames. All the item text I needed was readable at 720p, so no 1080p re-fetch is needed. I opened no links.

### 1. The build

**How using the flask turns into damage:**
1. **Melting Maelstrom** (Ultimate Mana Flask, corrupted, frame 07:58) has these lines:
   - "Effect is not removed when Unreserved Mana is Filled"
   - "250% increased Duration"
   - "Every 3 seconds during Effect, deal 100% of Mana spent in those seconds as Chaos Damage to Enemies within 3 metres"
   - "Deals 25% of current Mana as Chaos Damage to you when Effect ends"
   - It needs level 60, and each use takes 10 of its 75 charges.
2. **Spamming the flask is the multiplier.** Each use starts its own 3-second window that counts the same mana spent, so the novas overlap and stack (03:09–03:37). This is not in the item text. It is the creator's in-game observation, which I could not confirm. Hence the "health warning" about your wrists (01:53–03:02). A commenter mentions binding the flask to the scroll wheel.
3. **The mana spender is automatic.** Corpsewade (Iron Greaves, 07:51) says "Trigger Decompose every 1.2 metres travelled". Decompose is a spell that costs 0 mana (05:16). The Archmage buff (06:08) adds "cost an additional 6.7% of your maximum Mana" to non-channelling spells, which is about 324 mana at 4,836 max mana. That cost is then raised by:
   - the cost multipliers of Magnified Area II (130%, 05:36), Prolonged Duration and Bursting Plague (05:35–05:47);
   - Eldritch Battery, which converts ES to mana and doubles mana costs (13:42);
   - the Raw Mana node and an Overzealous Megalomaniac jewel (13:53, 14:40).

   My inference from the boots' wording, not stated in the video: you must keep moving to keep spending mana.
4. **Corpses come from minions.** The Sacrifice buff (06:19) lets skills use your undead reviving minions in place of corpses. Nine Skeletal Clerics with Brutus' Brain ("cannot be Damaged", "deal no Damage", 06:36) revive each other. The chance not to destroy the corpse totals 75% (13:28) from:
   - the Corpse Conservation support, 25% (05:26);
   - Enezun's Charge (wand), 25% (08:46);
   - the Meat Recycling node.
5. **Flask charges.** Gorge on Decompose gives "10 Mana Flask Charges for each Corpse Consumed" (05:20). The Hollow Mask grants Wildwood's Gifts (07:42), whose blooms restore flask and charm charges. PoB's data says 5 life-flask, 5 mana-flask and 5 charm charges per bloom (`Data/Skills/other.lua:21011-21013`).
6. **Mana sustain and the self-hit.**
   - Forsaken Bangle (Amethyst Charm, 08:22): "Used when you take Chaos damage from a Hit; 50% of Chaos damage you prevent when Hit Recouped as Life and Mana".
   - The flask's end-of-effect self-damage is meant to fire this charm (00:40–00:57). That this damage counts as a hit is the creator's claim and is unconfirmed.
   - The Magnum Opus anoint (11:03) gives "100% increased Effect per empty Charm slot". With two empty slots that is ×3, which he says triples both the chaos resistance and the recoup (11:09).
   - Shaman's Sacred Flow node gives "+40 to Spirit for each of your empty Charm slots" (12:34), which pays for the clerics. Wisdom of the Maji (bonded rune and idol modifiers) is his other ascendancy node.
   - Mageblood adds "20% of Flask Recovery applied Instantly" (11:20). He says it is optional and names Darkness Enthroned or a rare utility belt instead.
   - With a Waistgate belt ("Life and Mana Flasks can be equipped in either slot", 12:13) you can run two Maelstroms.
7. **Damage scaling beyond mana spent:** only enemy chaos resistance. Blasphemy with Despair applies −50% (05:52), and a "−5% chaos res to cursed enemies" augment sits on the mask (07:45).

**Defences and stats (15:09):** level 92; 1,382 life, 0 ES, 4,836 mana, 422 spirit; resistances 75/75/75 with 39% chaos; mana regen 481/s; 47% of damage taken recouped as mana. Mind Over Matter is the main defence, with no armour, evasion or block. Warding Potions removes a curse per mana-flask use (14:15). An instant life flask is spammed for about 1,100 life (08:07). He admits big hits still one-shot you (15:28).

**Cost and leveling:**
- No prices are stated. He calls Dream Fragments the budget ring (09:53).
- The core is four items: Melting Maelstrom, Forsaken Bangle, Corpsewade and Hollow Mask. With only those he "blasted" from 60 to 80 (03:52–04:12).
- Several are corrupted: the flask, the boots, and the twice-corrupted wand.
- It doesn't work in the campaign at all, because of the flask's level 60 requirement (03:40).

**Weaknesses:**
- The minion engine fails when the clerics get separated (07:03–07:20).
- Wrist strain.
- One-shots.

### 2. How he found and justifies it

There is no discovery story. He just says he built around the flask "after a week of developing" (15:56) and then retired it for wrist reasons.

His evidence is gameplay only:
- intro clips captioned "ALL GAMEPLAY IS 200% DELIRIUM" (00:20);
- a level-82 map with an Irradiated tablet (15:39), including a map boss with a health bar (17:42; name not legible).

He shows no PoB numbers, DPS figure or pinnacle boss kill.

### 3. Can PoB model it?

Pin v0.23.1, tree 0_5. The item texts match the video.

| Link | In PoB data | Parsed and applied? |
|---|---|---|
| Maelstrom nova line | `Data/Uniques/flask.lua:55` | **Not parsed** (`Data/ModCache.lua:5363` → `nil`). No skill or stat for it. PoB's only mana-spent logic is the Manaforged trigger (`Modules/CalcTriggers.lua:463-536`) and a "Mana spent Recently" config (`Modules/ConfigOptions.lua:1256`). **The damage is zero in PoB.** |
| Maelstrom self-damage | flask.lua:57 | Not parsed (ModCache:5175) |
| "Effect not removed…" | | Parsed to a flag (ModCache:5235) that only the tooltip reads (`Classes/Item.lua:2034`, `Classes/ItemsTab.lua:3953`) |
| Forsaken Bangle trigger | flask.lua:119 | Not parsed (ModCache:6856) |
| Bangle recoup | flask.lua:121 | **Partly parsed** (ModCache:3233; parsed as bogus `ChaosDamage BASE 50`, the rest left over). PoB applies a partly parsed line not at all (`Classes/Item.lua:2138`, `if not modLine.extra`). |
| Magnum Opus | anoint-only node `TreeData/0_5/tree.lua:89040` | Not parsed (ModCache:5022). Charm effect isn't tripled, so chaos resistance is understated. |
| Sacred Flow | | Parsed (ModCache:795; `EmptyCharms` at `Modules/CalcPerform.lua:1771`) |
| Wisdom of the Maji | | Parsed (ModCache:5680) |
| Eldritch Battery | | Parsed (ModCache:5068, 6158) |
| Corpsewade trigger | `boots.lua:35` | Not parsed (ModCache:6813). PoB treats Decompose as a 0.8 s self-cast, so its mana per second is wrong. |
| Archmage cost | `Data/Skills/act_int.lua:225-227` | Modelled as `ManaCostNoMult`, which is added after the supports' cost multipliers (`Modules/CalcOffence.lua:2087`). The creator says those multipliers scale it, so PoB likely understates Decompose's cost (which is right is unconfirmed). |
| Gorge, Wildwood's Gifts charges | sup_int.lua:5340; other.lua:21011 | In the data, but not used by any calculation |
| Waistgate dual-flask line | | Not parsed (ModCache:6119) |
| Mageblood instant recovery | | Parsed (ModCache:2160) |

**What our headless PoB would see:** no build damage. Every skill group is a non-damager (Brutus' Brain minions, Archmage, Despair) or Decompose's small poison cloud. Chaos resistance would come out low: 39 + 18 instead of capped. All of the Bangle's recoup would be missing.

### 4. Could our pipeline reach it?

**Concept generation (R1a), probably not.**
- The items researcher looks for "uniques that change how the skill plays" (R1a.md:67). The mechanic keyword search across uniques (`lookup_game_data mode:"mechanic", kind:"unique"`) could surface the Maelstrom on a query like "mana spent".
- But nothing prompts resource-flow queries. The flask changes no skill; it turns a resource into damage.
- Each proposal's feasibility read must show "the rolled skill as the main damage source" (R1a.md:100-101), so the researcher would discard it before proposing it.

**The damage-source rules would reject it.** D-122 says the rolled skill is the main source of damage, never a token role. D1 step 4 requires the rolled skill's figure to be the largest of the stage's groups with its role, either a record field or a ledger value (D1.md:64-69). D-141 sends a concept whose rolled skill isn't the main damage source back to checkpoint 1.
- If the roll were Skeletal Cleric, Archmage, Sacrifice or Despair: rejected outright, since each is fuel or utility.
- If the roll were Decompose (item-granted, `fromItem=true`, act_int.lua:4989; in Gems.lua:6694): D-238 requires the roll to be an active skill gem, and whether the roll check accepts an item-granted skill is unconfirmed.
  - **Strict reading:** rejected. The flask deals the damage; Decompose only spends mana.
  - **Loophole:** the "or a ledger value" clause would let a coordinator credit the nova to Decompose's mana spend. That needs your ruling; V4, the claims verifier, should catch it today.
- D-148 (the rolled skill should be the clear skill) fails the same way.

**The facts the build hinges on aren't in any data.** These are:
- the overlapping per-use windows;
- the self-damage counting as a hit;
- Magnum Opus stacking the recoup above 100%.

They are empirical. Finding the build would need:
- mechanic searches for "mana spent", "flask charges" and "corpse";
- a search for cost multipliers (Archmage, Eldritch Battery, the supports, Overzealous);
- a way to find anoint-only nodes (whether `search_tree_nodes` returns Magnum Opus is unconfirmed);
- web or community evidence for the stacking behaviour.

### 5. Ideas for the tool

1. **Flag unmodelled lines that deal damage** (`check_model_coverage`, D1 step 4). Have the coverage check mark unparsed lines that match "deal … Damage to Enemies" as unmodelled damage sources, so D1 must ledger them. This guards the reverse case: PoB says the rolled skill is largest while an unmodelled item out-damages it. *Cheap.*
2. **A resource-flow pass in R1a's mechanics focus.** List what the rolled skill consumes and produces (mana, corpses, charges, flask charges) and run 2–3 keyword lookups on those resources across uniques. This finds both supplemental damage (a Maelstrom on a mana-hungry rolled spell keeps D-122 intact) and sustain engines. *Cheap prompt change; which leads to keep is a judgment call.*
3. **Input demand in a concept's Risks field and the clear-speed signals** (D-121 already counts movement speed and clicks per pack). Add "presses per second / must keep moving" as a judgment line. *Cheap.*
4. **An item-gated power spike in the campaign stage (D2).** The respec points from D-144 (tree continuity) already exist. When an engine item has a level gate (60 here), D2 needs a named swap stage, like the rolled-skill requirement. *Cheap, mostly wording.*
5. **Tag empirical interactions.** Behaviour absent from item text, like stacking windows or self-damage counting as a hit, is tagged as judgment or external at confidence L. The existing tagging rules (R1a.md:33-34) already cover this, so no change is needed. Just make sure the guide's "what PoB can't model" section names them.

**Deliberately don't:**
- relax D-122 into an "item is the build" mode. It defeats the randomizer premise, and every number would be a confidence-L hand calculation driven by how fast the player mashes. If ever, make it an opt-in at checkpoint 1, which is a large change;
- model the Maelstrom ourselves (`vendor/` is untouchable, and the mechanics are undocumented);
- run broad "search all uniques for interactions" research, because of the cost.

**Also:** the D1 survival floor caps chaos resistance (D-234). This build would fail it in PoB because Magnum Opus is unparsed, unless D1 hand-calculates the charm effect.

### 6. Links (none opened)
- `poe.ninja/poe2/pob/2abaf`: PoB export of the build.
- `youtube.com/playlist?list=PLTXChyYiMk9JhdkR5uQw7vPt49t965QjZ`: the creator's PoE2 guide playlist.
- `twitch.tv/troytesko`: his stream.
- No pinned comment. Five comments are stored, all praise or wrist jokes.

Frames are in `/home/parker/projects/yt-library/videos/GsLBMXy3tDk/frames/`.
