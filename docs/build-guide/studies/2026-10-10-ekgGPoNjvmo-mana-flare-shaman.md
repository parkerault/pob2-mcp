# 20k Mana Flare Shaman (Swedge)

An agent's study report, kept verbatim (2026-10-10). Brief: `briefs/offmeta-brief-2.md`.
Its claims are the agent's; the PoB gaps it cites were re-checked in `../pob-gaps.md`, and its patterns are consolidated in `../worklog.md`.

---

**Header**
- Video: ekgGPoNjvmo, "[0.5] The 20k Mana Flare Shaman: One-shot the game | PoE2 Runes of Aldur build guide"
- Creator: Swedge
- Patch: 0.5, Runes of Aldur league. It mentions 0.5.2 and was uploaded 2026-06-16.
- Build: Shaman. The main skill is Mana Flare, a triggered support. Entangle delivers it in maps and Frost Darts against bosses.
- Budget, in his words: "a very expensive endgame build" (07:00). He borrowed some gear.

**The chain**
1. **Mana Flare is the damage (02:07).** When a supported spell crits, it triggers a fire hit worth 25% of current mana. Gem level doesn't matter, so he ignores spell levels. PoB data confirms it: base fire comes from 25% of current mana (sup_int.lua:6782-6815), with a 1 s cooldown, 1 stored use and 7% base crit.
2. **Four things scale off max mana.**
   - Archmage gives 4% of damage as extra lightning per 100 max mana, which is 800% at 20k (02:30). Confirmed in the data (act_int.lua, Archmage stat map).
   - A Rathpith Globe gives 6% increased damage and 3% crit chance per 100 max mana (02:39). On the frame at 02:42 these two lines are red, like the tooltip's unsupported line, and are worded "maximum Mana". The base unique says "maximum Life" (focus.lua:60-71), so this is a mutated variant. He calls it "cultivated". The item also has 30% cooldown recovery, and its drawback ("spells cost an additional 6% of maximum Life") is priced in life.
   - The Arcane Intensity notable gives 3% spell damage per 100 max mana. Confirmed on the frame and in the tree.
   - He shows a curve of hit damage against max mana at 03:00. It bends upward, reaching about 15M at 20k.
3. **Where the mana comes from (08:00-09:50).**
   - Runeseeker's Call has "200% increased effect of Socketed Runes", which triples each rune (wand.lua:69).
   - Shaman's Wisdom of the Maji (the transcript says "Magi") turns on runes' Bonded modifiers, the extra rune lines only some characters get (tree.lua:93135).
   - A Perfect Mind Rune in a wand gives +90 mana and a Bonded 5% increased max mana (ModRunes.lua:2112). Tripled across 6 sockets that is 1,620 flat mana and 90% increased, which matches what he says.
   - Legacy of Runeseeker's Call is in the data (ModRunes.lua:4759). By my sum, using it in place of one Mind Rune adds about 442 mana at 275% rune effect, which matches his "440 more". So his bug is that the rune's own 75% isn't tripled.
4. **Carriers.**
   - In maps (04:23 gem panel): Entangle level 19 with level-1 Mana Flare, Eonyr's Thunder, Magnified Area II, Branching Fissures II and Pinpoint Critical.
   - Against bosses (06:35 gem panel): Frost Darts level 3 with Mana Flare, Concentrated Area, Execute III, Rakiata's Flow and Pinpoint Critical.
   - Arctic Armour carries its own Mana Flare and hits back at melee attackers (05:48).
5. **Clear chain (03:52).** Archmage's extra lightning lets Eonyr's Thunder electrocute. Enemies killed while electrocuted explode as Voltaic Fulmination, for a share of their max life. Confirmed in sup_dex.lua:2006.
6. **Speech only.**
   - A permanent low-life item ("Ziri's Communion") feeds Pain Attunement for crit damage (05:10).
   - Katal's Rejuvenation gives about 40% cooldown reduction (05:23).
   - Rakiata's Flow inverts elemental resistance (06:38).
   - 54% of damage is taken from mana before life via ring and amulet quality (07:34).

**Patterns**
- **Low-level utility gems** and **inert minions:** the carriers are levels 1-3 and exist only to crit.
- **Conversion:** extra lightning from Archmage lets a fire hit electrocute.
- **Inputs-and-outputs:** electrocuted kills become corpse explosions.
- **Zeroed resource:** life is abandoned at low life (494/1,595 on frame), so Rathpith's life-priced cost is nearly free. This is my reading; he doesn't say it.
- **Forced condition:** permanent low life switches on Pain Attunement.
- New, **stat-as-base convergence:** a damage source whose base reads a pool stat, plus every "per X of that stat" multiplier, compounds faster than linearly.
  - Search step: start from the stat, grep "per 100 maximum <stat>" across uniques, the tree and buffs, and check for mutated unique variants.
- New, **socket amplifier plus latent lines:** an item multiplies what is socketed in it, and an ascendancy turns on hidden lines on those sockets.
  - Search step: grep uniques for "increased effect of Socketed", then the runes' Bonded lines for the target stat.
- New, **reactive carrier:** a defensive buff that deals spell hits (Arctic Armour) carries a trigger support, which gives thorns-like retaliation.
  - Search step: list spell skills that have the Damage type and also the Buff or Persistent type.

**How PoB follows it**
- **Modelled:**
  - the Mana Flare hit, with a "Current Mana %" setting (ConfigOptions.lua:117) that should be 100 for the first boss hit;
  - Archmage;
  - Arcane Intensity (ModCache.lua:2513);
  - rune effect and Bonded lines (ModCache.lua:2210, 5680);
  - Voltaic Fulmination, as a corpse explosion.
- **The mutated Rathpith isn't in the unique data.** The game names these lines "Vaal Unique" modifiers, and PoB imports them as mutated lines (Item.lua:501). The per-mana lines parse through the general "per N maximum mana" rule (ModParser.lua:1603).
- **Count stays 1.** Mana Flare's 1 s cooldown caps how often it fires, so extra Branching Fissures crits add coverage, not DPS. Read the per-hit number, which is his metric.
- **Hand calculation:** mana sustain. Each proc consumes 25% of current mana and Archmage adds cost, set against regeneration.
- **Can't follow:** the Rathpith's "Bonded: 45% increased effect of Archon Buffs on you" is marked "(Not supported in PoB yet)" on the 02:42 tooltip.

**Evidence and quality**
- PoB-style tooltips and gem panels are overlaid on the footage. He shows the damage-versus-mana curve, maps he claims are 200% delirium, and a boss killed between 06:34 and 06:48.
- His claim of tanking Arbiter of Ashes is speech only.
- He is careful and technical: exact numbers, an honest note on the Legacy rune bug, and a pinned correction that the build isn't really an autobomber. There is a full written guide.

**For the brainstorm phase**
- Count the independent axes that read one stat. He says "4 separate damage axes", then sanity-checks with a plot of damage against the stat.
- Diff patch changes for oversights. "GGG neglected to give one particular support gem a cost" is how Eonyr's Thunder got in.
- Choose the ascendancy by the percentage it adds to the one stat that matters ("about 40% more max mana than any other").

**Links seen (unopened)**
- https://www.poe-vault.com/poe2/guides/mana-flare-build-guide
- https://poe.ninja/poe2/pob/20256 (PoB snapshot)
- His Discord, mentioned but no URL given

**Reference entry**
- ekgGPoNjvmo (Swedge, 0.5): Shaman Mana Flare. Low-level Entangle or Frost Darts crits trigger a hit worth 25% of current mana. Archmage, a mutated Rathpith Globe and Arcane Intensity all scale off max mana. Runeseeker's Call triples runes, and Shaman unlocks their Bonded lines, for 20k mana.
- Patterns: stat-as-base convergence, socket amplifier plus latent lines, reactive carrier, low-level utility gems, conversion (Eonyr's Thunder), zeroed resource and forced condition (low life).
- PoB: per-hit modelled, Count 1. The mutated Rathpith must be imported; the Archon Bonded line is unsupported.
- Links: poe.ninja/poe2/pob/20256; poe-vault mana-flare-build-guide.

I used 6 of the 10 frames.
