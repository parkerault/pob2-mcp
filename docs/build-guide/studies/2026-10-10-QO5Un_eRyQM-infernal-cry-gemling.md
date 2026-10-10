# Infernal Cry Gemling (ExFluent)

An agent's study report, kept verbatim (2026-10-10). Brief: `briefs/offmeta-brief-2.md`.
Its claims are the agent's; the PoB gaps it cites were re-checked in `../pob-gaps.md`, and its patterns are consolidated in `../worklog.md`.

---

HEADER
- Video: QO5Un_eRyQM, "Infernal Cry Gemling Is My New Favorite Mapper | PoE 2 0.5 Build Guide", by ExFluent.
- Patch: 0.5, Runes of Aldur league, uploaded 2026-06-30.
- Build: Gemling Legionnaire. Infernal Cry is used only as a host for Paquate's Pact's Corrupted Blood.
- Budget: the creator says you can start right after the campaign (about level 62) on cheap uniques. The character shown is a level 94 with high-budget gold-farming gear (Headhunter, +6 Fireflower, Sunsplinter, Prism of Belief).

THE CHAIN
1. Damage source. Paquate's Pact (a lineage support) on Infernal Cry says "Supported Skills Trigger Twisted Pact for each enemy in range", and Twisted Pact applies Corrupted Blood, a physical damage over time (02:04, confirmed on frame 02:09 and in Data/Skills/sup_str.lua:5346). The same frame shows a cost the creator never mentions: 10% of max life per recent use, up to 30%.
2. Level is the main multiplier. The creator says to stack Infernal Cry levels (01:59, 26:58). Frame 02:00 shows level 39: 20 from the gem, +1 from corruption, +17 from global modifiers, +1 from support. The sources he names:
   - Fire Mastery support (burst at 02:08)
   - spear corrupted with +1 fire skills (12:02)
   - Fireflower +6 fire (14:26)
   - Sunsplinter +4 fire (15:04)
   - Crown of the Victor +1 all skills (12:56)
   - chest corruption, +1 to corrupted gems (09:42)
   - Gemling node "+2 to Level of all Skills with a Strength requirement" (20:00; tree.lua:77386)
   - Prism of Belief, a Diamond jewel with "+2 to Level of all Infernal Cry Skills" (frame 23:40)

   The item sources add up to exactly 17. The claim that Twisted Pact takes Infernal Cry's level rests on speech plus the data's shape. The support gem has one level, but Twisted Pact has a 40-level damage table: 886 base physical per minute at level 3, 368,359 at level 39 (sup_str.lua:5462+). No frame confirms it.
3. Filling the stack cap. Echoing Cry makes the cry echo twice (01:33, 03:06; sup_str.lua:2679). Each Twisted Pact applies 5 stacks (sup_str.lua:5460). The cap is 10, and each stack after the first adds 100% more damage, so the cap gives 10x (sup_str.lua:5456). One press reaches the cap. Echoing Cry's downsides (−40% damage, you must travel before reusing) hit the cry, and the cry does no damage here. Whether that −40% also carries to Twisted Pact is unconfirmed.
4. Other multipliers:
   - Swift Affliction and Brutality (02:56, speech).
   - Herald of Blood kept up at all times, plus Agonising Calamity instilled in the helmet: "40% increased Physical Damage while affected by Herald of Blood" (13:47; tree.lua:94458).
   - Megalomaniac's Blood Tearing (21:00, speech).
   - "1% increased Damage per 1% Chance to Block" at 60–62% block (23:05; tree.lua:99103).
   - Block comes partly from Magma Barrier's quality line, which grants max block through the Gemling node Advanced Thaumaturgy ("Gem Quality grants Socketed Skills an additional effect", frame 19:50).
   - Warcry damage nodes also apply to Twisted Pact (SkillStatMap.lua:170).
5. Helper companion. A Plague Harvester companion carries Brutus' Brain ("cannot be damaged", "deal no damage", frame 07:15), Incision and Rapid Attack. Its tamed-beast mods are a physical damage aura and "all damage shocks" (05:59). The creator says Incision makes enemies take more damage, but the gem text says it raises the chance to inflict Bleeding (sup_str.lua:4579). A minion that deals no damage applying shock is doubtful; it rests on his "I tested it".
6. Filler gems:
   - Unused red skill gems (Force Hammer, Sunder, Leap Slam, frame 07:15) add Strength motes through Virtuous Barrier, which means more life.
   - Support gems are socketed to reach Gem Enthusiast's "10 Red/Blue/Green Support Gems Socketed" (tree.lua:77426).

PATTERNS
- New, "level-carrier host": a skill granted by a support takes the host's level. So you pick the host for how many +level sources its tags, name and requirement collect, not for its own effect. Any other support that grants a skill could use this. Search step: start from support-granted skills (SkillType.SkillGrantedBySupport) that have a multi-level damage table while their support has naturalMaxLevel 1. List the hosts each support accepts (requireSkillTypes). Rank the hosts by +level sources: tag-wide uniques, name-specific Prism of Belief variants, requirement-based ascendancy nodes, corruptions.
- New, "repeat to cap": the payload adds N stacks per trigger against a cap M. A repeat or echo support turns one press into ceil(M/N) triggers. Search step: look for pairs of a stacks-per-application stat and a stage limit (MaxStages or limit=), then for echo or repeat supports the host can take.
- Zeroed resource, a variant: the host deals no damage, so penalties priced in host damage cost nothing.
- Forced condition: Herald of Blood is reserved so "while affected" is always true.
- Inert minions: the Brutus' Brain companion carries debuffs and an aura and can't die.
- Quality as a stat line: Magma Barrier's quality gives max block.
- Defence that scales damage: block chance becomes damage.
- Filler gems to satisfy a count: Virtuous Barrier motes and Gem Enthusiast.

HOW POB FOLLOWS IT
- PoB can't follow the core link. Modules/CalcSetup.lua:1876 gives Twisted Pact the support gem's own level. Level bonuses are matched against Paquate's Pact's tags (Modules/CalcTools.lua:113-125): it has no fire tag, and support gems are excluded from "all skills". So the +fire, +all skills and +Infernal Cry sources never reach it. Only Gemling's Strength-requirement +2 does (ModCache.lua:329). Default Twisted Pact is about level 3 against 39 in game, roughly 400x less base damage.
- Untested workaround: type 37 as the Paquate's Pact level by hand (SkillsTab.lua:852 doesn't clamp it).
- The stack count is set in config: "# of Corrupted Blood stacks", default 10 (ConfigOptions.lua:326). Count stays 1, because the echoes fill stacks rather than add copies.
- Modelled: the Gemling quality line (CalcSetup.lua:835), block to damage, the Herald of Blood condition, and Virtuous Barrier counting (CalcSetup.lua:1857).
- Config or hand-set: the companion's aura and shock, and Incision.
- Data notes:
   - Prism of Belief, Megalomaniac and Heart of the Well exist only as generated uniques (Data/Uniques/Special/Generated.lua:92,112,233).
   - PoB's Fireflower range (+1–4 fire) and Sunsplinter range (+1–3) are below the creator's +6 and +4, yet his 17 adds up only with those values. His items are probably corrupted, or PoB's data is behind.

EVIDENCE AND QUALITY
- He shows in-game map clears (he claims 200% Delirium, 9-mod corrupted maps), the character sheet (3k life, 60% block, 75% chaos resistance) and gem tooltips. There are no PoB numbers, no DPS figure, no boss kill, and no test of the level link.
- The walk-through goes slot by slot and is candid about gold-farming compromises and defence swaps. His grasp of the mechanics is loose ("if I am not mistaken" on the physical scaling, and he misreads Incision). He credits the idea to another creator.

FOR THE BRAINSTORM PHASE
- Check the sum of +level sources against the in-game tooltip's breakdown (gem / corruption / global / support).
- Sort slots into mandatory level carriers and swappable slots (farming or defence). That gives budget tiers for free.
- Check level gates: the build only comes online once the lineage support's level 65 requirement is met.

LINKS SEEN (unopened)
- https://poe.ninja/poe2/profile/Exfluent-1283/runesofaldur/character/ExFluento
- https://www.youtube.com/@josiah8486 (the creator he credits for the idea)
- No PoB or pobb.in export.

REFERENCE ENTRY
QO5Un_eRyQM (ExFluent, 0.5): Gemling Infernal Cry as a level carrier for Paquate's Pact's Twisted Pact (Corrupted Blood physical damage over time). +fire, +Strength-requirement and +Infernal Cry levels take it to 39. Echoing Cry fills the 10-stack cap in one press. Herald of Blood, block-to-damage and Magma Barrier quality scale it.
Patterns: level-carrier host (new), repeat to cap (new), zeroed resource, forced condition, inert minions, quality as a stat line, defence that scales damage, filler gems.
PoB: the Twisted Pact level isn't inherited (CalcSetup.lua:1876); hand-set the support level. Link: poe.ninja ExFluento character.

Frames used: 6 (02:00, 02:05 burst, 02:09, 07:15, 19:50, 23:40).
