# Guide comparison 1: Fubgun's Lightning Arrow Deadeye guides vs our run A guide

An agent's study report, kept verbatim (2026-10-09). Brief: given in the prompt.
Its claims are the agent's; the PoB gaps it cites were re-checked in `../pob-gaps.md`, and its patterns are consolidated in `../worklog.md`.

---

## Fubgun guides compared with our generated guide

Both Mobalytics pages loaded, and I clicked through every variant tab: 6 on the leveling page, 4 on the endgame page. I also read every quest-reward filter and every "Show All" priority list, and pulled the item hover cards on the leveling 40-60+ and endgame Early tabs.

What I could not read:
- **Passive tree:** it is an interactive planner canvas, so the allocated nodes can't be read as text.
- **"Video Guide":** it is Fubgun's live Twitch channel player, not a recorded guide.
- **Build file:** I did not download it.

Side effect: the Playwright tool saved snapshots, screenshots and console logs to `/home/parker/projects/pob2-mcp/.playwright-mcp/`. That folder is gitignored globally, and I left it in place.

### 1. Structure

**Leveling guide** (v0.5.5, updated Jun 5 2026). About 1,000 distinct words across all tabs; one tab reads at roughly 350–450.
- **Build Overview (~95 words).** Says who it's for ("Ranger or Huntress… easy and SSF viable") and links the endgame guide. Tells you to keep gold for the respec. Gives a vendor regex to paste. The text is stale: it still says "campaign in 0.4" and "updated for 0.3".
- **Build Variants.** Level-band tabs drive every section below: 1-5, 6-14, 15-27, 28-40, 40-60+, plus "Twink uniques".
- **Equipment (110–170 words per tab).** A paper doll of example items:
  - each item has a hover card with base type, affix roll ranges and tier labels (e.g. "+(30-39) to maximum Life P11");
  - each has a trade-search link with minimum values and a priority number;
  - the prose covers what matters in that band, the bow bases to switch to and when, and loot habits.
- **Skill Gems (100–290 words per tab).** Numbered skill groups with their supports, a "Support Gem Requirements: Str/Dex/Int" box, and a note on how to use each skill.
- **Passive Tree (20–50 words).** The planner embed for each band, plus "use dexterity for your small attribute nodes" and the ascendancy order.
- **Quest Rewards (~370 words).** A Mobalytics widget, identical on both pages: rewards per act, filterable by Choices / Skill Points / Character Upgrades. Choice rows show one option and no reason.
- **Comments, build-file download, Twitch embed.**

**Endgame guide** (v0.5.5, updated Jun 17 2026). About 2,300 distinct words, of which about 1,000 is the crafting guide.
- **Overview (20 words):** "Fully updated for 0.5", plus a link to the leveling guide.
- **Variants: Early / midgame / Hybrid / Crit**, each with a short gate note of 0–70 words, e.g. "Requires a Crit bow… Do not swap without currency".
- **Equipment (430–525 words per variant).**
  - "Mandatory Stats" first, then one paragraph per slot.
  - Then: a rarity target, jewels and an anoint.
  - From midgame on, a "Mana Issues" block with 3 numbered fixes.
  - Each slot has the same item cards and trade links as the leveling guide, plus an Equipment Priority list.
- **Skill Gems (145–205 words).** 8–9 groups of up to 5 supports, then "Quality prio" and "Link prio" lines, then swaps for bosses and pinnacles.
- **Passive Tree.** Planner only, plus jewel notes (Heart of the Well, Against the Darkness).
- **Quest widget.**
- **How it Plays (35 words):** the rotation.
- **How it Works (80 words):** six numbered "Quest rewards to take", and the ascendancy order.
- **Crafting Guide (~1,000 words):** step-by-step recipes for a non-crit bow, a crit bow, a quiver (cheap and expensive routes), an amulet and a helmet (two routes).
- **Extras:** a loot filter (copy code or download), the build file, 5 comments.

### 2. How they handle each topic

- **Leveling.** Organised by level bands with a few act anchors, not act by act.
  - **Boss order:** "Devourer > cold witch > hut witch > rust king".
  - **Skill timeline:**
    - Lightning Arrow from level 1, with Bow Shot, Lightning Rod and Contagion ("drop it after the redvale zone") and Frost Bomb for bosses ("lvl 3 Frost Bomb will only work on bosses lvl 25 or below").
    - Herald of Thunder, Barrage, Electrocuting Arrow and Voltaic Mark join at 15–27, Wind Dancer at 28–40, Tornado Shot at 40+.
  - **Tree:** no detail in the prose at all.
- **Gear.** Weapon milestones tied to levels: Warden Bow plus a rune at 11, Dualstring at 28 ("use whatever currency you have to make it 5-6 mods"), Twin Bow at 55.
  - Swap rule: change bows only "if it gives you 50% or more tooltip dps".
  - Currency habits: "Always salvage weapons with quality for whetstones… sockets for artificers orb"; sell rares to gamble with gold.
  - **No prices anywhere.** Budget tiers appear only as variants with gates ("this variant is not cheap"). Crafting is an exact orb-by-orb sequence.
  - The priority numbers come with no reason. On Early: chest 1, gloves 2, boots 3 … bow 10, even though the prose says "highest dps… weapon you can afford".
- **Passive tree.** A planner per variant with a points counter, but no node list and no allocation order.
  - The ascendancy gets a one-line order: "Gathering winds > Point blank > Endless munitions > Mirage Archer".
  - Almost no reasons; one exception is "evasion chest… specially when combined with Beastial Skin".
  - A commenter reports that the planner and the downloadable build file disagree.
- **Gems.** Supports are listed in priority order: "take out the last gem if you don't have a 6l".
  - Explicit order lines: "Quality prio: lightning rods > herald of thunder > lightning arrow"; "Link prio: Lightning rods > lightning arrow > herald".
  - Conditional swaps: "swap Innervate for Chain II on bosses… only when your lightning rod is 4 linked".
- **Campaign to maps.** Only "requires very little gold, but… don't gamble away all of it so you can respec", plus the Early variant's "Use this as you're entering maps". There is no atlas tree, no waystone-tier progression and no guidance on when to move between variants beyond the gate notes.
- **Defences.** One paragraph:
  - "75% fire/cold/lightning… Chaos… I usually aim for 30-50%";
  - an evasion chest with Beastial Skin, an ES helmet for Subterfuge Mask, and "Ghost Dance… your only way to recover ES".
  - No life, ES or max-hit numbers. A comment reads "This build is too squishy."
- **Mechanics ("why").** Rare and short, e.g. "Frost Bomb… you only care for the debuff", "Voltaic Mark combos with Electrocuting Arrow". Overwhelmingly "do this".
- **Playstyle.** "For mapping you're just using Lightning Arrow, for map bosses you shoot down at least 8 Lightning Rod, press Tornado Shot once and spam Lightning Arrow."
  - Other tips: pre-fire rods before a boss spawns, and put Lightning Rod on weapon set 2 for Rigwald's Ferocity.
- **FAQ, changelog and extras.** No FAQ; warnings are inline instead ("!!!!Important!!!!!", "Don't use Elemental Armament III, only level 2", "I would never swap out movement speed boots"). No changelog beyond the "Updated on" date. Extras are the vendor regex, loot filter, trade links, build file and quest tracker. The comments show real gaps: mana on bosses, squishiness, and the planner/file mismatch.

### 3. Precision and voice

- **Numbers.** Few, and they are thresholds or rules of thumb: levels 11/28/55, "at least 8" rods, 100% rarity, 45 spirit, "50% or more tooltip dps", 2% mana on kill. Item cards carry roll ranges and tiers, and trade links carry minimums. No DPS, life, EHP or prices, and no sources: the authority is the streamer.
- **Voice.** About half the sentences are first-person or evaluative ("I personally prefer", "chain doesn't feel good to use", "pretty RNG", "don't stress").
- **Uncertainty.** Always turned into a fallback, never a confidence label:
  - "Before you have access to Obliterator Bow, just use the highest DPS bow you find";
  - "If you don't have Garukhan's Resolve and Rakiata's Flow, replace it for Rapid Attacks II and Lightning Penetration";
  - "Concentrated Area or Lightning Attunement, this just depends on your gear";
  - "If you have a 45 spirit amulet, you can also add in Wind Dancer".

### 4. Comparison with our guide (Titan / Blood Hunt)

Our guide is about 9,800 words of body plus 2,500 words of sources. That is roughly three times both Fubgun pages combined.

By section: Leveling 2,855; How it works 2,365, which includes a 32-row table of hand calculations (formulas for what PoB doesn't model); budget endgame 1,176; non-budget 938; Confidence 575.

**They have, we lack:**
- fallbacks for missing items ("if you don't have X, use Y") and swap rules of thumb;
- support priority, plus link and quality priority;
- an attribute-requirements box per band;
- a per-slot "what to look for" with example items, tier labels and ready trade searches;
- a gear buy order;
- crafting recipes;
- mana troubleshooting;
- campaign boss order and per-boss skill notes;
- currency and loot habits (salvage, vendor checks, gold gambling, keeping gold for the respec);
- a vendor regex and a loot filter;
- gates on when to switch variants;
- a real pick for every reward choice. Ours says "The plan makes no pick for any of them, so this guide recommends none", which breaks the template's own rule that each reward choice names the pick and why.

**We have, they lack:**
- exact life, DPS and resistance numbers per stage;
- the resistance table through each act's penalty;
- max-hit checks and boss time-to-kill;
- the ascendancy pick per trial and when to do each trial;
- uncut-gem timing and gem levels;
- mana balance per stage;
- what PoB can't model;
- confidence labels and sources;
- an import code with one loadout per stage;
- an FAQ, a changelog and an explicit reason for each choice.

**Where ours is heavier than it needs to be:**
- **Markers:** 609 footnote markers in the body, about one every 16 words.
- **Caveats:** "confidence L" appears 49 times. The same caveat ("PoB probably counts an explosion on every use") repeats in every stage.
- **Gem-cutting rule:** "an uncut gem of level N cuts tier N or lower" is re-explained in every stage.
- **Price cells:** 21 cells read "unavailable (offline run), 2026-10-08, no league".
- **Hand-calculation table:** it sits in the reader's path.
- **Known issues:** shows internal gate IDs (`v4-sources-34`…), which is QA output leaking to the reader.
- **Stage titles:** carry braces like "(L4) {1}".
- **Tree gaps:** it admits "The plan doesn't name the other added nodes".

**Where theirs is thin:** no defensive numbers, no mechanics, no reasons for the tree, no prices or budget, no route into maps or the atlas, stale version text, the planner/file mismatch, priority numbers without reasons, and no mana guidance on the Early variant.

### 5. Top 8 recommendations (ranked by impact on the reader)

1. Split each section into a reader layer and an audit layer. Open each stage with 3–5 imperative bullets (do, swap at, buy or craft). Move the hand-calculation table, the model-coverage list, gate IDs and most markers to an appendix, and state each repeated caveat once.
2. Never leave a choice unmade. Every reward choice, tree notable and ascendancy node gets a pick and a three-to-six-word reason. Ban "no pick" and "doesn't name the other nodes".
3. Add fallbacks and swap rules per stage: "if you lack X, use Y", "short a socket? drop the last support", "swap weapon at +N% tooltip DPS".
4. List supports in priority order, with explicit link and quality priority lines and an attribute-requirement summary per stage.
5. For each gear slot, give affix targets with tiers, a ready trade-search filter, and a buy or upgrade order with a reason. Offline, collapse the unavailable prices into one line.
6. Add an "Into maps" section: respec gold, first waystone tiers, atlas or progression priorities, and a gate for when to move from budget to non-budget.
7. Add campaign practicals: notes on the key bosses, currency habits (salvage, vendor checks, gambling, keeping gold for the respec), and a vendor regex.
8. Add a numbered crafting recipe for the budget weapon or other key slot, and a mana and sustain troubleshooting list (the top complaint in their comments).
