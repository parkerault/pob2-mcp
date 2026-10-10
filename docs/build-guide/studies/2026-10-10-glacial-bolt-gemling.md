# Glacial Bolt Gemling: Phylaris and josiahyeet

An agent's study report, kept verbatim (2026-10-10). Brief: `briefs/offmeta-brief.md`.
Its claims are the agent's; the PoB gaps it cites were re-checked in `../pob-gaps.md`, and its patterns are consolidated in `../worklog.md`.

---

## Glacial Bolt Gemling: 3a (Phylaris) and 3b (josiahyeet)

**What I used:** 5 transcripts, about 17 frames and 5 burst sheets, PoB data greps, and the guide worktree. I opened no links. This used about 235K tokens of context.

### 1. The chain, as the videos show it

- **Where the damage comes from.** All of it is Glacial Bolt's own crystal explosion, the "Wall" stat set. It is the player's crossbow attack hit, whoever breaks the crystal.
  - In PoB's data the explosion's base multiplier at gem level 20 is 2.45; the bolt's own hit is 1.45 (`act_str.lua:9764,9933`).
  - The in-game Wall tab (5lyd 09:36) shows:
    - 52,341 average damage per use;
    - "Additional fissures created 3";
    - "Less damage in first 0.5 seconds 80%";
    - "More area of effect if Shattered 50%";
    - a 4.3 m explosion radius.
  - Josiah's reasoning: the high multiplier "is balanced around needing to manually explode the wall… what if we could spam explode" it (_-V6 02:42–03:18).
- **What multiplies it:**
  - Trinity (a "more" damage buff that needs fire, cold and lightning balanced), through Painter's Servant or a tri-element crossbow;
  - Rage with Berserk; 16 rage is about "a whole Elemental Armament" (5lyd 05:50);
  - Rakiata's Flow, Elemental Armament II and Vorana's Siege (frames 7WCQ 19:36–19:45);
  - Emergency Reload, about 50% more for 5 bolts (7WCQ 06:54);
  - Gemling quality, which adds about 2 m of explosion radius (_-V6 18:04);
  - **crystal overlap.** Both creators aim so the boss sits inside the fissure fan and "gets shotgunned" by many crystals (7WCQ 06:31–06:51; 7T64 14:41–15:13).
- **More crystals:** Ahn's Citadel (walls laid along a fissure) plus Kaom's Madness (3 more fissures).
- **Detonators.** None of them adds meaningful damage of its own:
  - Pounce wolves with Biting Frost II and Brutus' Brain. Brutus' Brain reads "Minions… deal no Damage" (frame 7WCQ 20:26), yet the wolves still pop walls. The pop doesn't depend on damage.
  - Verisium Manifestations: kept at a low level (8, frame 20:36) to cut its ward cost, and it needs about 200 ward (pxiFA 17:13).
  - Herald of Thunder with Mórrigan's Insight and Living Lightning, in Josiah's build only (frame _-V6 06:42).
  - Cast on Elemental Ailment → Entangle at level 2, with Biting Frost II and Branching Fissures (frames 7T64 11:25, 11:38). Entangled mobs become "wall destruction bombs" (11:22–11:50).
  - Seismic Cry with Vruun's Aftermath: "Supported Warcries cause Ice Crystals to explode" (frame 7WCQ 19:55).
  - Whirling Slash with Mórrigan's Insight (Phylaris).
- **The key enabler is undocumented.** Minions "socketed with biting frost… one shot it, it doesn't matter the HP" (_-V6 03:45). Neither Biting Frost's in-game text (frame 7T64 11:38) nor PoB's data mentions Ice Crystals. KattKills discovered it, and both creators credit him.
  - A plausible mechanism, unconfirmed: crystals count as Frozen, and consuming the freeze "Shatters" them.
  - The nearest game text is Fragmentation Rounds: "Bolts that hit an Ice Crystal cause it to explode" (`act_str.lua:8909`).

**Corrections to the written entry (`reference-builds.md`):**
- Phylaris's Whirling Slash carries Knockback, Mórrigan's Insight, Rigwald's Ferocity, Rage III and Rapid Attacks (frames 19:56–19:59). It has no Biting Frost II: Mórrigan's is in the Biting Frost category, so the two can't share a skill.
- Phylaris's Herald of Thunder (Armour Explosion, Magnified Area, Elemental Armament, Longshot, Shock) is **not** a detonator.
- Josiah's Cast on Elemental Ailment holds Biting Frost **II** in 7T64, not I.
- The "wolves without a talisman" tech is how 3a keeps its wolves: summon them with a talisman, swap to the spear, and they persist (10:22–10:47).

### 2. How they found it and how they show it works

- **Discovery:**
  - KattKills found the minion detonation and the armour-break tech.
  - Josiah reasoned from the manual-detonation balance and the 0% play rate ("avoided some nerfs", _-V6 03:26).
  - Phylaris spotted the spear-vs-talisman opportunity cost and the persistent-wolf workaround (03:33–04:33).
- **Evidence:**
  - map showcases with tablet and remnant proof (5lyd 00:52; 7T64 00:43; pxiFA 00:42);
  - "hundreds" of Discord testers (5lyd 00:10);
  - Trinity balance checked from the in-game tooltip and poe.ninja (5lyd 09:23–10:04);
  - Phylaris's mana-cost test for Gem Studded balance (12:30–13:25).
- **No PoB walk-through.** "2 million pinnacle DPS" (_-V6 00:16) has no source on screen.

### 3. Linking patterns

- **P1, a skill that leaves an object, plus whoever consumes it.**
  - The damage sits in an object (crystals); the build's job is to supply the consumers.
  - Surfaced by listing what the skill creates, then mechanic lookups on that object: "Ice Crystal", "destroy", "explode".
- **P2, a zero-damage trigger.**
  - When a helper's job is only to touch something, a "deals no damage" drawback (Brutus' Brain) costs nothing and buys immortality.
  - It needs a reasoning step: "is this job damage-dependent?"
- **P3, a balance penalty you route around.**
  - The 80% less damage when "destroyed within 0.5 seconds by something other than you" separates self-detonators from minion ones.
  - Inference, unconfirmed: Phylaris's self-popping Whirling Slash sidesteps it. Neither creator says so.
- **P4, a count multiplier that costs per-hit damage.** Kaom's Madness trades 20% less damage and 30% less area for 3 more crystal lines that all land on a boss.
- **P5, a utility gem kept at low level.** Verisium at level 8 and Entangle at level 2 cut ward and mana cost, because their job isn't damage.
- **P6, a temporary item that leaves a lasting state.** Wolves outlive the talisman; disabled skills stay socketed after the unset rings come off.
- **P7, a mechanic that pays twice.** Whirling Slash is movement, detonator and Rage source, which frees 100 spirit by dropping Eternal Rage (02:37–03:17).

### 4. Can PoB model it?

- **Statset choice.** The explosion is a normal area attack (`act_str.lua:9865–9912`), but PoB opens on stat set 1, the bolt projectile (`CalcSetup.lua:1888`). Our tool's main-stat-set selection (C-44) and D1's rule to set `skills.main.statSet` (`D1.md:73–78`) handle this.
- **Unmapped, so it shows nothing** (no SkillStatMap or Calc entry):
  - the 0.5 s penalty (`act_str.lua:9892`), so minion pops may be overstated;
  - the Shatter area bonus (`:9891`);
  - Ahn's Citadel's length and fissure lines (`sup_int.lua:426,429`);
  - Kaom's Madness's +3 fissures (`sup_str.lua:4845`).
- **Wrong numbers:**
  - Kaom's *penalties* are applied (`sup_str.lua:4846–4848`), so PoB shows the fissure package as a pure loss.
  - PoB has no setting for crystal overlap (`ConfigOptions.lua` has nothing for crystals or walls), so it understates boss damage.
  - PoB computes crystal life (`CalcOffence.lua:1571–1580`), 12,714 at gem level 20. That implies detonators need real damage, which Biting Frost bypasses.
- **No Verisium minion.** PoB has no minion definition for the Verisium Manifestation (absent from `Data/Minions.lua`). Since the detonators deal no damage, this doesn't hurt the headline number.
- `check_model_coverage` should flag the unmapped Glacial Bolt and fissure lines (`Coverage.lua:397`; the scope's parent is `skill_stat_descriptions`). I didn't run it.

### 5. Could our tool reach it?

- **Concept research (R1a): partly.**
  - The mechanics researcher sees two stat sets with the Wall's larger multiplier.
  - The lookup tool's mechanic search is a substring match (`Lookup.lua:518`):
    - "Ice Crystal" finds Vruun's Aftermath, Fragmentation Rounds and Verglas;
    - "wall" finds Ahn's Citadel;
    - "fissure" finds Kaom's Madness and Branching Fissures.
  - The minion + Biting Frost core is unreachable: no text holds it. Brutus' Brain would look absurd, and the 0.5 s line actively discourages minion pops.
- **Our two settled decisions both pass cleanly**, if the gate reads the Wall stat set:
  - "the rolled skill is the main source of damage, never a token role" (D-122);
  - "the rolled skill should be the clear skill" (D-148).
  - This is the build type our gates were designed for.
- **What's missing:**
  - the undocumented interaction;
  - a hand calculation (a ledger entry) for crystals per target and fissure count;
  - a way to state setup-state techs (P6) other than a note.

### 6. Budget ladder, against our rungs

| Tier | What it adds and keeps |
|---|---|
| Leveling (Phylaris) | Permafrost Bolts plus Fragmentation Rounds; Glacial Bolt "once you're done with campaign" (21:20–21:46) |
| Entry, about 7 divines (Josiah) | Life and armour, Morior Invictus, Alpha's Howl; nothing that loses value on resale; the recommended test (7T64 02:47–03:20). Its video, `bJ_JWxOqzZk`, isn't fetched |
| Ward version, about 50 divines | Sub-tiers "10 to 20" and "50 to 70" (_-V6 08:37). Vorana's Siege is optional (Magnified Area instead), +3 jewels too. Adaptive Capability in place of Gem Studded |
| Mageblood or Headhunter | Gem Studded, armour with Iron Reflexes, Rakiata's Flow instead of penetration nodes, a Trinity amulet |
| Headhunter with manual Trinity | Cast on Elemental Ailment, which needs 255 spirit (7T64 15:25) |
| Final | Rare +12-rage helm, Against the Darkness spirit, Endless Blizzard (+1 cold skills); a mana flask, because Cast on Elemental Ailment drains mana |
| Phylaris's whirling version | Only after "a few hundred divines", once one shot clears the screen (04:37–05:18). His character has 1,500–2,000 divines |

- **The cheap version keeps** the core: Glacial Bolt, Biting Frost wolves and Verisium Manifestations, and Trinity.
- **Fissure tech comes in** "once we get enough wall break sources" (Josiah's written guide).
- **Mapping to our rungs:**
  - our 5-divine entering-maps rung is about his 7-divine build;
  - our 20-divine budget rung is the ward version's "10–20" sub-tier;
  - our 200-divine non-budget rung lies between the 50–70 divine ward tier and Mageblood or Headhunter.
  - The whirling and Mageblood/Headhunter versions are above our ladder.

### 7. Two creators, same core

- **Shared:**
  - the Wall explosion as the damage;
  - Biting Frost-family detonators;
  - the Ahn's Citadel and Kaom's Madness fissures;
  - the same five Glacial Bolt supports (frames 7WCQ 19:36–19:45; 7T64 14:28);
  - Trinity;
  - persistent wolves and Verisium Manifestations.
- **Phylaris** detonates by himself (about 80% of crystals, 01:56–02:07) for speed and consistency, since minion AI "gets occupied" and crystals body-block (01:35–01:50).
  - The melee skill also generates Rage, which funds Scavenged Plating and Blasphemy.
  - Costs: fine keyboard cursor control (not on controller, 08:09–08:29), heavy attack speed, and a high budget.
- **Josiah** automates everything for "one button", "practicality and… the most affordable way to one-shot all content" (5lyd 13:56–14:02).
  - He adds Herald of Thunder and Cast on Elemental Ailment detonators, and pays in spirit and mana.
- **The split is speed versus accessibility.**

### 8. Ideas for our tool

- **Strengthen I1** (the resource-flow pass in concept research): count objects the skill leaves (crystals, fissures, corpses) as resources, and look up what consumes them. Tag each consumer "you" or "other", since game text can penalise one of them. Cheap.
- **Strengthen I2** (flagging unparsed damage lines): also flag unmapped *count* lines ("additional fissures", walls) and penalty lines, and pair each with a judgment-tagged hand calculation for hits per target in D1 (endgame design). A judgment call: the overlap count is a guess.
- **Strongly support I3** (input demand as a con): the same core splits on input demand alone.
- **Generalise I4** (a named stage for a level-gated engine item) to *budget*-gated engine pieces: fissure tech and whirling arrive at named rungs. Cheap.
- **D1, gem levels:** a utility gem's level may be chosen to minimise its cost (P5). Cheap, wording.
- **D1, movement spending:** spend on movement only when coverage saturates (Phylaris's rule), a judgment hint for the non-budget rung. This touches D-121, which says clear speed means movement speed first.

**Don't attempt:**
- hunting undocumented interactions (all supports × all objects);
- modelling minion targeting, crystal breaking or shotgun geometry;
- encoding P6 states in plans beyond a play note;
- optimising manual Trinity.

### New links seen (not opened)

- `bJ_JWxOqzZk`, the 7-divine budget video.
- Phylaris's Mobalytics: `/profile/stone-dagger-zuckm8/builds/a735cda4-4318-40cb-92db-7bdbf62aae8b`.
- Josiah's guide also appears under `/profile/deadly-golem-wt8y0n/builds/a7dc5f61…`.
- poe.ninja characters: Kebir-4166/Twinktowin (crit), Handy-6736/SvenSammeltSteine (Surround), PunkSviin-5658/RandomRunesOfAldur (Mageblood).
- Three Discord invites.
