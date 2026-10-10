# Stormcaller Arrow "GPU Nuker" (poe2builder)

An agent's study report, kept verbatim (2026-10-10). Brief: `briefs/offmeta-brief.md`.
Its claims are the agent's; the PoB gaps it cites were re-checked in `../pob-gaps.md`, and its patterns are consolidated in `../worklog.md`.

---

## Build 4: Stormcaller Arrow "GPU Nuker" (poe2builder, video `L_bhEMOtqEI`, patch 0.5)

The ascendancy is **Gemling Legionnaire**. The character sheet at 19:42 reads "Level 97 Gemling Legionnaire". "GEMBIT" is not an item: the quiver is a rare (15:40), and no frame shows Cadiro's Gambit. It looks like the creator's nickname for the Gemling. In `reference-builds.md`, entry 4 should say Gemling Legionnaire.

I used about 34 frames and 2 burst sheets. Paths below are relative to `/home/parker/projects/pob2-mcp/vendor/PathOfBuilding-PoE2/src/` (PoB) and `/home/parker/projects/pob2-mcp-wt/guide/` (our tool).

### 1. The chain

**Arrows per shot**
- Advanced Thaumaturgy: "Gem Quality grants Socketed Skills an additional effect" (03:20).
- For Stormcaller Arrow that extra effect is +1 projectile per 10% quality (`Data/Skills/act_dex.lua:8679`). He aims for 40% quality (11:52–12:11).
- Quality sources on frames: the Absent Amulet's "+5% to Quality of all Skills" (20:58) and Morior Invictus's "Bonded: +5% to Quality of all Skills" (18:05).
- Paragon is recommended, but it shows "Unallocated" (11:52). His amulet's anoint is Thaumaturgic Generator.
- The bow has "Bow Attacks fire an additional Arrow" (13:22).
- Surpassing chance: +195% on the bow (13:22), +60% on the quiver (15:40, which Master Fletching raises by 20%) and +58% on the gloves (22:46). He aims for 300%, which is about +3 arrows.

**Repeats**
- Barrage makes the next attack repeat, and consumes Frenzy Charges for extra repeats.
- Olroth's Conviction: "Supported Skills Empower 2 additional Skill uses", and the cost becomes Runic Ward (34:33).
- Heightened Charges doubles the effect: "six… if heightened charges procs it's 12" (35:09).
- The Barrage panel shows "Chance to not remove Charges 94%" (35:22). It is built from:
  - Perpetual Charge, 25%;
  - The Fabled Stag, 10%, through a Megalomaniac (09:40);
  - the Sekhema Sandals, 15% on the frame, where he says 50 (23:20);
  - by inference, the rest from Barrage's own Gemling quality effect, 1% per quality (`act_dex.lua:161`).

**Tornado Shot**
- Its gem text: "Arrows… fired at the Tornado are sucked into it, causing the Tornado to spit out a ring of copied Projectiles" (`act_dex.lua:9133`).
- Overabundance gives more tornadoes and Durability gives 12 hits (30:54–31:17). Its Gemling quality effect is +1 tornado per 10% (`:9143`).
- He uses it on bosses and packs (30:15).

**Multipliers**
- Garukhan's Resolve: crit chance is capped at 50% but rolled twice ("Bifurcates", 27:24). He builds to exactly 50% (14:05).
- Rakiata's Flow treats enemy elemental resistances as inverted (29:17).
- Vorana's Siege: 35% increased area, and 20% more damage against isolated targets (28:44).
- Compressed Duration II shortens the detonation delay (27:50).
- Verglas: "1% of Damage Gained as extra Cold for 6 seconds, per two thousand maximum Life of the destroyed Ice Crystal" (29:14).
  - The crystals come from Frost Wall, cast automatically by Cast on Elemental Ailment, which the Absent Amulet grants (20:58).
  - Glacier gives the crystals "100% more Life" (26:40).
  - His crystal-life figure (heard as "45,000" or "245,000", 21:20) is not on any frame.
- Low life:
  - Atziri's Communion on Eternal Rage reserves "Life equal to 66% of base Spirit Reservation" (32:30), leaving 376 of 1,808 life unreserved (19:42).
  - Pain Attunement comes from a Flesh Crucible Diamond (10:56): 30% more Critical Damage Bonus on low life.
  - Direstrike sits on his persistent buffs. The name is from the transcript only ("darestrike", 30:09). In PoB, Direstrike II is +70% attack damage on low life.
- Feathered Fletching makes projectile speed (46% on the quiver) count as bow damage.
- Harness the Elements gives 20% per ailment type. Fire, cold and lightning flats on the Rift Nail ring (17:35) apply all three. A Kalandra's Touch mirrors that ring (transcript only).

**Filler gems.** Spellslinger and Parry hold unused supports so the support colours count 17/17/17 (26:14). He says this is "to get all benefits from Gem Studded" (25:58).

**Where the damage comes from.**
- Each landed arrow calls one lightning bolt, at roughly 9 arrows per shot.
- That is multiplied by up to 6–12 Barrage repeats, by 3 empowered uses, and by tornado copies.
- In-game DPS tooltips: Stormcaller Arrow 92,576–110,782; Tornado Shot 512,387–633,056 (27:19, 30:18, 31:59). The video never shows which one dominates on a boss.

### 2. How he found it and how he shows it

- He saw Stormcaller videos by @heyman7372 and @Dr3adful (description, 01:50).
- His Stormcaller Titan from the previous league had potential that was "too low". Low life, Garukhan's Resolve and Surpassing changed that (00:22–00:37).
- It began as a meme build with about 200 HP and was reworked for defence (00:44–01:28).
- Evidence is gameplay, in-game DPS tooltips, and claims of 200% delirium T15 and Expedition clears (19:22, 01:44). The FPS drop to 20 is also only a claim (10:10).
- No PoB is shown on screen.
- He is candid: Empowered Spark is socketed but untested ("no idea what it does", 35:50), and the Megalomaniac's second notable was luck (10:26).

### 3. Linking patterns

- **P1. A stat the meta ignores becomes the main scaler because the class converts it.** Here quality becomes projectiles, charge retention and tornadoes. Surfacing it means reading each gem's Gemling quality line whenever a node says "additional effect". Our lookup can't do that (§5).
- **P2. A consumer made nearly free.** Stack "chance to not remove Charges but still count as consuming them" to about 94%, so the consumption bonus repeats without new charges. Charge Regulation, another consumer, benefits from the same stack. A query for "not remove" across all kinds surfaces it.
- **P3. A helper skill that multiplies the main skill's projectiles or uses.** Here that is Tornado Shot's copies and Barrage with Olroth's Conviction. The query is the skill's delivery noun with a verb: "fired at", "Empower", "Repeat".
- **P4. A buff that scales with a life you control, so inflate that life.** Verglas plus a Glacier-supported Frost Wall. The trigger is already on screen: Stormcaller's bolt has a 500% "more shock chance" stat, which feeds Cast on Elemental Ailment.
- **P5. Reserve your way into a condition.** Reserving life keeps you on low life permanently; conditional multipliers pay for it, and energy shield becomes the real pool.
- **P6. Accept a cap and build exactly to it** (Garukhan's Resolve).
- **P7. An anti-synergy the creator names.** He says penetration on his gloves "works against me" with Rakiata's Flow (22:31). PoB inverts the resistance before applying penetration, so penetration does nothing against positive resistances (`Modules/CalcOffence.lua:4193-4201`). That is a disagreement to note, not resolve.

### 4. Can PoB model it?

**What PoB shows wrong or as zero**
- **The extra arrows add no damage.**
  - PoB does apply the Gemling quality effects, so the projectile count shows (`Modules/CalcSetup.lua:835`, `Modules/CalcTools.lua:147-151`).
  - But Stormcaller's bolt has no overlap stat, and overlap config exists only for Shrapnel Ballista and Toxic Rain (`Modules/ConfigOptions.lua:579`, `:665`).
  - So the arrow count never multiplies the DPS, an undercount of up to about 9×.
- **Barrage.**
  - It is modelled as an always-on buff: (1 + repeats) × repeat damage (`act_dex.lua:216-224`, `CalcOffence.lua:964-966`). Heightened Charges is included as an expected value (`Data/SkillStatMap.lua:3038`).
  - The charge retention is modelled nowhere:
    - the Fabled Stag and boots line is misparsed with leftover text, so it isn't applied (`Data/ModCache.lua:6675`);
    - `charge_skip_consume_chance_%` is unmapped, for both Perpetual Charge and Barrage's quality effect;
    - Olroth's `support_empowers_x_additional_other_skills` is unmapped (`Data/Skills/other.lua:12540`).
  - So PoB shows the same number with or without the 94% stack. It can't tell a working loop from a broken one.
- **Tornado Shot's copies:** zero. PoB computes only Tornado Shot's own impact and tornado damage.
- **Verglas:** zero. It has no stat map (`Data/Skills/sup_int.lua:8539`). Frost Wall's crystal life is computed (`CalcOffence.lua:1572`), so a hand calculation has its input.
- **Unparsed lines:** Thaumaturgic Generator (`ModCache.lua:5893`) and the Runic Ward lines (`ModCache.lua:194`).

**What PoB models correctly**
- Garukhan's Resolve (`SkillStatMap.lua:1035`, `CalcOffence.lua:3736`).
- Rakiata's Flow (`SkillStatMap.lua:966`, `CalcOffence.lua:4179`).
- Vorana's Siege, given the "Is the enemy Isolated?" config option (`ConfigOptions.lua:1875`).
- Low life, which PoB derives from life reservation (`ConfigOptions.lua:28`, Atziri's Communion at `SkillStatMap.lua:182`).
- Feathered Fletching (`ModCache.lua:5998`) and the Surpassing lines (`Modules/ModParser.lua:4838`).

**For the Gem Studded / Advanced Thaumaturgy agent.** This build needs two things:
- **The 17/17/17 colour tie.** PoB's if/elseif gives only the Red bonus (`CalcSetup.lua:2156-2162`), but the build wants all three. Blue's 30% less cost matters for Barrage's 80 Runic Ward cost.
- **Lookup visibility of the Gemling quality lines:** Stormcaller, Barrage and Tornado Shot (§5).

### 5. Could our tool reach it? (roll: Gemling Legionnaire + Stormcaller Arrow)

**Would concept research (R1a) propose it?** Only a partial version.
- The lookup never shows Gemling quality effects. `describeStatSet` calls `buildSkillInstanceStats` without that flag (`pob-api/API/Lookup.lua:114`), and `qualityLines` reads only `qualityStats` (`:128-145`).
- The gem lookup therefore shows Stormcaller's quality as shock duration only, and Advanced Thaumaturgy reads as inert. The core link is invisible.
- Barrage is likely found: a "Repeat" query on Stormcaller's Repeatable tag returns it near the top.
- Surpassing is found as an item mod.
- Tornado Shot is unlikely: an "arrow" query sorts it late, past the 20-result cut.
- Verglas and Frost Wall are unreachable. The lookup doesn't search item-base implicits (the Absent Amulet base is at `Data/Bases/amulet.lua:132-137`).
- The items researcher works from uniques, but this engine is rare affixes plus a base, so no researcher owns it.
- The likely proposal is "Barrage Stormcaller with Surpassing".

**Would the two settled decisions pass it?**
- **"The rolled skill is the main source of damage" (D-122).** Endgame design (D1) gates this by requiring the rolled skill's PoB figure to be the largest, or a ledger value (`D1.md:67-69`). Tornado Shot's own figure probably wins, since it is 5× in game. D1 forbids moving it to a utility role, so only an overlap hand calculation (confidence L) could carry Stormcaller.
- **"The rolled skill should be the clear skill" (D-148).** This passes; the con is the one-second detonation delay (28:00–28:38).

**What would be missing:** the Gemling quality lines, item-base implicits, an overlap calculation, and the charge retention.

### 6. Inspiration

**Cheap**
- Show and search Gemling quality lines in the gem and mechanic lookups (R1a), labelled "with Advanced Thaumaturgy". This is the highest value for any Gemling roll.
- Search item-base implicits in mechanic mode. The Absent Amulet recurs in all the Gemling references.
- **I1, the resource-flow pass, is strengthened.** Add "retention" queries ("not remove") and "condition holder" queries (low life through reservation).
- **I2, flagging unparsed damage lines, is weakened as worded.** Here the unseen damage is in gem stats and gem descriptions, not in item lines. Coverage already marks Verglas, Perpetual Charge and Olroth's Conviction as "possibly unmodelled" (`pob-api/API/Coverage.lua:397`). Instead, D1 could state a claim whenever PoB's default is optimistic, and name the enabler that makes it true (here Barrage's 94% retention).
- **I3, input demand as a con, is strengthened.** Barrage, then Stormcaller, then Tornado Shot, plus "delay to damage".
- **I4, a named stage for a level-gated engine item, is widened.** Five lineage supports each show "Requires Level 65" on frames, so the engine switches on at 65.
- Tag unconnected notables as jewel- or anoint-only. The Fabled Stag has no connections (`TreeData/0_5/tree.lua:35971-35990`).

**Judgment calls (yours)**
- Does a helper whose damage is copies of the rolled skill's projectiles count toward it under D-122?
- An overlap ledger entry for multi-projectile skills that hit in an area where they land.

**Don't attempt:** modelling the tornado copies, Verglas or the charge economy in Lua; broad unique-by-gem searches; relaxing D-122; Megalomaniac rolls.

**New links, not opened:** poe.ninja/poe2/pob/24ddc (the video's PoB) and /24de9 (budget version); a poe.ninja character profile (maringaku-0679/runesofaldur/kaygem); 13 trade2 searches in Runes of Aldur; a Discord invite; the @heyman7372 and @Dr3adful channels.
