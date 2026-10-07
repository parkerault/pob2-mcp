# External game data for the build-guide workflow (grounding, 2026-10-07)

Grounds the external-game-fact rows of the design doc's "References to ground" table
(`docs/design/2026-10-07-build-guide-workflow.md`). Every URL was accessed **2026-10-07**. Sources are
tagged `[Sn]` and listed at the end; `[PoB]` means a read of the pinned checkout in `vendor/` (v0.23.1).
Confidence: **H** high, **M** medium, **L** low.

Pages were read through a summarizing fetcher, so a "quote" may be lightly paraphrased; poe2db numbers
were cross-checked against the pin's tables. No pathofexile.com or poe.ninja host was requested.
poe2wiki.net (bot protection) and mobalytics.gg (403) could not be read. SEO and boosting-service blogs
(timesaver, switchblade, poe2hub, boostmatch) are marked **L** unless a better source agrees.

## 1. Live patch vs. the pin

| Fact | Patch | Conf. | Source |
|---|---|---|---|
| Latest client patch is **0.5.5e (2026-10-05)**, preceded by 0.5.5b–d (09-11, 09-17, 09-28). The 0.5.5 notes are dated 09-02 | 0.5.5 | H | [S1] |
| 0.5.5 "Forbidden Rites" is an event league launched **2026-09-04** on a fresh economy. It sits on 0.5.0 "Return of the Ancients" (2026-05-29; league "Runes of Aldur") | 0.5.x | H | [S2][S3][S4] |
| One snippet gave 0.5's date as May 21; Wikipedia and game8 both say May 29 | 0.5.0 | H (May 29) | [S3][S4] |
| **There is no 0.6.** 0.5 is the last Early Access league. **1.0 launches 2026-12-11** (announced at Gamescom on 2026-08-25). Both current leagues end at 1.0 | — | H; leagues ending: M | [S3][S5][S49] |
| PoB2 **v0.23.1 was released 2026-07-28** (the same day as the pinned commit). It is still the newest PoB2 release; nothing came out in Aug–Oct | — | H | [S6] |
| v0.23.1 targets **game 0.5.4**. The live patch at the time was 0.5.4d (07-24) / 0.5.4e (07-29). The tree folder `0_5` is the 0.5 tree. This is inferred from dates and release notes (v0.21.0 = 0.5.2 tree, v0.21.1 = after 0.5.3) | 0.5.4 | M | [S6][S7] |
| **Gap from pin to live (0.5.5e):** no class, skill, passive or ascendancy balance (postponed to 1.0). Changed in 0.5.5: 17 new Soul Cores and big rework of existing ones; Arbiter of Ash and Arbiter of Divinity resistances; Trial of Chaos rework; Rituals in every campaign area; Expedition/Runes of Aldur moved to core | 0.5.5 | M-H | [S2][S8] |

## 2. Campaign (0.5.x: four acts, three interludes, no Cruel)

**Area levels** (poe2db per-act pages, checked against `[PoB]` `Data/WorldAreas.lua`; H):

| Part | Area levels | Boss / end | Typical char level (guides, M) |
|---|---|---|---|
| Act 1 | 1–15 | Count Geonor, Ogham Manor (15) | 1–14 |
| Act 2 | 16–31 | Jamanra, The Dreadnought (31). 0.5.0 removed "Dreadnaught Vanguard" | 14–30 |
| Act 3 | 33–45 | Doryani, Black Chambers (45) | 30–45 |
| Act 4 | 46–53 | Tavakai, Heart of the Tribe (53) | 45–53 |
| Interludes 1–3 (Curse of Holten, Stolen Barya, Doryani's Contingency) | base 54–56, hubs 64 | Can be played in **any order**. Area level rises with bosses killed in the other interludes, **about +8 by the end** (~62–64) | 54–65 |
| Endgame | 65+ (Waystone T1) | Characters leave the campaign at about level 60–65 | — |

Sources: [S9][S47][S48]. The interlude scaling is M. `[PoB]` lists interlude zones at their base 54–56, while
its quest-reward file shows 61–64 for the same zones.

**Permanent rewards.** maxroll (updated 2026-09-18, 0.5.5) [S10] matches `[PoB]` `Data/QuestRewards.lua` (H).
"Book" = a Book of Specialisation; the number after each area is its area level.

| Part | Rewards |
|---|---|
| Act 1 | Beira (Clearfell 2) +10% Cold res; Crowbell (10) book; King in the Mists (Freythorn 11) +30 Spirit; Una's Lute (12) book; Candlemass (Ogham Manor 15) +20 max Life |
| Act 2 | Kabala (Keth 25) book; Valley of the Titans (26) charm-medallion choice; Final Letter (Deshar 28) book; Sisters of Garukhan (30) +10% Lightning res |
| Act 3 | Silverfist (34) book; Ignagduk (36) +30 Spirit and an uncut Spirit gem; Venom Draught (35): permanent choice of stun threshold, ailment threshold or mana regen; Blackjaw (37) +10% Fire res; Aggorat (44) book |
| Act 4 (51–52) | One book (`[PoB]`: Blind Beast; maxroll: Omniphobia); Silent Hall +5% max Mana; three Halls of the Dead tests, each a permanent choice of +5% to one element's res or an attribute; Hinekora book; Goddess of Justice flask-recovery choice |
| Interludes | Oswin (Wolvenhold) book; Clearing the Way (Khari Bazaar) book; Molten Shrine +5% max Life; Seven Pillars swappable choice (one option is +5% all elemental res; the XP option has heavy penalties); Lythara +40 Spirit; Abominable Yeti book; Elder Madox free unique; Siege of Oriath (Kingsmarch; `[PoB]` "Epilog") book |

Totals:
- **12 books give 24 passive points.** Each book also unlocks 2 weapon-set passive points, so 24 of those
  too [S11][S12]. `[PoB]` writes each book as `+2 Weapon Set Passive Skill Points` with `questPoints = 2`.
- **Other totals:** 100 Spirit; +10% res per element (up to +20% with the Act 4 test and Seven Pillars);
  +20 life, +5% max life, +5% max mana.
- **Maximum passive points: 123** (99 from levels plus 24 from quests; poe-vault's planner shows "0 / 123"
  [S43]).
- **A possible 124th point** (M), the league-wide "Martyr" point: once a level-100 player in the league
  sacrifices their character, everyone can claim +1 passive point at the Site of the Chosen in the Fortress
  [S13][S35].
- Discounted (L): game8 says "20 points" while listing 12 books; boostmatch lists different interludes and
  "+25% life".

**Elemental resistance penalty** (M-H; [S14] and the `[PoB]` config, whose default is "Endgame (−60%)"):
−10% per stage. Act 2 −10, Act 3 −20, Act 4 −30, interludes −40 (area level 54–59) and −50 (60–64),
**endgame −60%**. Chaos is exempt. Capping at 75% in maps therefore needs about 115–125% from gear and tree.

**Ascendancy** (8 points in four pairs; M):
1. Trial of the Sekhemas in Act 2 (Balbala's Barya).
2. Trial of Chaos in Act 3 (Chimeral Inscribed Ultimatum).
3. A Barya of level 60+ with 3 trials, or an Ultimatum with 10 trials. Its required level is disputed:
   65+ [S15] or 75+ [S16].
4. A Barya of level 75+ with 4 trials plus Zarokh, or an Ultimatum of level 75+ with 10 trials plus the
   Trialmaster (maxroll: 65+ and three fragments).

The Act 4 third trial is not implemented. 0.5.5 reworked the Trial of Chaos but no change to the ascension
gates was found [S2].

**Gems by level:**
- **Tiers.** Skill gems have tiers 1/3/5/7/9/11/13; spirit and buff gems 4/8/14; supports 1–5. Tier 0 is
  not cuttable (`[PoB]` `Tier` counts). An Uncut Skill Gem of level N engraves a skill of tier ≤ N at gem
  level N [S17][S19] (H).
- **Uncut skill gems** [S17] (M; the page is dated 2026-09-10 but still has 0.1-era Cruel text):
  - L1 Bloated Miller; L2 Areagne or Brambleghast; L4 Freythorn ritual or Vargir; L5 Executioner or
    "Earning Passage" (start of Act 2).
  - L7 random from Act 2 (drop level 23 [S18]); L9 Rootdredge (Act 3 start); L11 late Act 3.
  - L13–15 at monster level 52–64; L16–20 in maps.
  - Gem level 20 needs character level 90 [S37].
- **Uncut support gem drop levels:** L1 4, L2 16, L3 33, L4 45, L5 55 [S18] (M). So tier N supports arrive
  around Act N, and tier 5 in the interludes.
- **Sockets** (M) [S20]: a new gem has 2 support sockets. Lesser Jeweller's Orb → 3 (item level ~25),
  Greater → 4 (~45), Perfect → 5, the maximum (~65+).
- **Blood Hunt** is tier 7 and needs a Spear, so Act 2 at the earliest. **Bloodhound's Mark** is tier 9,
  so Act 3 (`[PoB]`, H).

## 3. Endgame baseline (0.5.x; live 0.5.5e unless noted)

| Fact | Conf. | Source |
|---|---|---|
| Waystones T1–T15 drop; **T16 only by Vaal-corrupting a T15**. Area level = 64 + tier: **T15 = 79, T16 = 80**. "T15" is still the right name in 0.5.x. Since 0.5.0, waystones must be identified to run | H | [S21][S22][S4] |
| Above 80: Irradiated (an Irradiated Precursor tablet at a tower) gives +1, and a corrupted node gives +1, so the practical maximum is **82**. One source says an Overseer tablet also gives +1 | M; Overseer: L | [S50][S35] |
| The 0.5 Fortress gates by tier: east/west sections T6+, Enigma Chambers T10+, center T11+, **Patriarch/Matriarch Halls T15** | M | [S24] |
| **Monster life by level** (pin `Data/Misc.lua`): L65 6,555; L70 11,148; L75 18,609; **L79 24,852; L80 31,065**; L82 32,956; L84 34,963. There is a **+25% step at 70, 75 and 80**, then about 3% per level. `mapLevelLifeMult` is 1.0 at every level. Cross-check: poe2db's boss figures equal these table values times the boss multipliers | H | [PoB][S26] |
| **Monster damage by level:** L65 212; L79 324; L80 334; L82 354 (about 3% per level) | H | [PoB] |
| **Waystone mods, highest tier** (poe2db, current): (26–30)% more Monster Life; (20–24)% increased Monster Damage; (20–24)% of damage as extra Fire, Cold, Lightning or Chaos; +(35–40)% monster elemental res; (10–15)% increased attack, cast and movement speed; (80–300)% increased crit chance with +(11–30)% crit damage bonus; 25% more magic and rare monsters | M | [S21] |
| Sources disagree on mod size: a maxroll page labelled 0.2.0 lists (70–79)% more life and (36–40)% increased damage. Prefer poe2db for 0.5 | — | [S23] |
| Revives fall with mod count: 5 on a white waystone down to 0 on a 6-mod rare. Corruption can push a waystone to 5 prefixes + 5 suffixes. Up to 3 tablets per map | M-L | [S23][S50] |
| Magic and rare monster life multipliers: no trustworthy 0.5 source found (the hits were PoE1 data). Use PoB's own handling | L | — |
| Plain T15 targets in guides: 75% res, about 3k+ EHP, roughly 200–500k effective single-target DPS for comfortable farming | L | [S25] |

**"Juiced" mapping** stacks several things on top of plain T15:
- T16 (+25% base monster life) or area 81–82;
- 6–10 rare and corrupted mods: monster life, damage, extra element damage, res;
- 2–3 tablets of league content (Breach, Delirium, Ritual, Expedition, Abyss), plus Delirium fog.

The combined monster EHP and damage is several times plain T15. That is judgment, not a published number.

## 4. The Arbiter of Divinity (0.5.0+, stats as of 0.5.5)

- **It exists.** It was added in 0.5.0 as the pinnacle of the Precursor Fortress, replacing the Arbiter of
  Ash as the top boss [S4][S30] (H).
- **There is no "Uber" in 0.5 (H).** The 0.5.0 notes say every pinnacle now has a deterministic quest
  version and a repeatable "Infinite Farm" / non-quest version that "offer[s] a greater challenge". The old
  Uber Arbiter of Ash keys (Calamity Fragments) "can no longer be obtained" [S4]. The first Divinity kill
  is a weaker quest version [S22]. game8's index calls it "Uber" only informally [S30].
- **The old 0–4 difficulty slider** is said to be removed: the Atlas no longer sets pinnacle difficulty,
  and the Arbiter of Ash is now static with infinite portals [S29]. Two SEO sites still describe the slider
  [S33]. Conflict; M-L.
- **Access** (M-H) [S2][S24][S31]: kill the Arbiter of Ash (its Burning Monolith is now inside the
  Fortress). Clear the Patriarch Hall (Phya drops the Origin Spark) and the Matriarch Hall (Phyx drops the
  Origin Cradle); both need T15 waystones and allow limited boss attempts. Combine the two at the Precursor
  Reactor into an Origin Core and use it at the Origin Tower. Since 0.5.5, a non-quest kill completes the
  whole Fortress for the map owner.
- **Datamined base stats** (poe2db, current, monster level 79 [S26]; H for the base values):
  - Life 246,035 (990% multiplier) plus energy shield 24,603 (10% of life). Armour 6,356; evasion 887;
    accuracy 3,786; crit 5% with +30% bonus.
  - **Resistances: Fire −15%, Cold 0, Lightning 45%, Chaos 0.** These are the 0.5.5 values; before 0.5.5
    it had "All Elemental Resistances" [S2]. The pin predates the change.
  - poe2db and `[PoB]` list the Origin Tower arena at area level 79 [S28].
- **In-fight life is not published (L).** poe2db's base life is not the fight value. For comparison, the
  Arbiter of Ash's base is 147,381 at level 74 [S27], but its in-fight life was 5.04M normal and 22.6M old
  Uber (poe-vault, before 0.5) [S34]. Applying the same about 34× ratio would put Divinity near 8M. That
  is an extrapolation, not a fact.
- **Biggest hits** (poe2db, level-79 base, before mitigation, non-crit, no map mods). The physical attack
  base is 830–1,245 (= 324 × 3.2 × 0.8–1.2):

| Damage type | Skill | Hit |
|---|---|---|
| Physical | Extendo Spear Combo Slam 1 (180% more) | 2,324–3,486 |
| Physical | Slam 2 (170% more) | 2,241–3,362 |
| Physical | Spear Toss Sweep (85% more) | 1,536–2,303 |
| Physical + lightning | Phase 2 Triangulate Split (180% more, 50% converted to lightning) | 2,324–3,486 |
| Lightning | **Volatile Explode** | **1,323–3,969** |
| Lightning | Storm Blink Bolt (chains; shocks as though dealing 200% more) | 860–2,580 |
| Lightning | Triangulate sideways | 430–1,290 |
| Lightning | Zap Beams (500% more shock chance) | 99–298 |
| Lightning | Ground degen | 77,179/min (≈1,286/s) |

  - The datamined list has **no fire or chaos skill**, so SEO claims of "Fire and Lightning" are
    unsupported. A crit multiplies a hit by 1.3.
  - The actual encounter level is unknown. At 82 or 84, hits would scale by ×1.09 or ×1.16 per the damage
    table (an assumption).
- **Qualitative** (M) [S30][S31]: a two-phase, lightning-heavy spear duel. At about 40% life it summons
  Aspect clones, and Divine Power orbs grant 6 seconds of immunity. An arena-wide lightning attack leaves
  few safe spots. SEO targets (L) [S32]: 87% lightning res, 6k life or 12k ES, 1M+ DPS.

## 5. Prior art: public PoE2 guides (0.5.x editions)

Read: maxroll's Boneshatter Titan (leveling, 0.5.5) [S40], Shield Wall Titan (endgame, 0.5.5) [S41] and
Bleed Rake Amazon (0.5.x) [S42]; poe-vault's Stampede Titan leveling and endgame pair [S43][S44]; game8's
Facebreaker Titan (0.5.5) [S45]. Mobalytics returned 403.

| Aspect | What they do |
|---|---|
| Structure (maxroll) | Introduction/Summary, Pros/Cons → Equipment → Skills → Rotation → Gem Engraving Priority → Passive Tree (interactive, with leveling trees and weapon-set points colour-coded) → Ascendancy (ordered, with respec notes) → Story Rewards → Build File Export → FAQ → Video → Changelog |
| Leveling | Staged **by act and skill milestone**, each with the gem level that unlocks it. poe-vault example: Act 1 Rolling Slam + Boneshatter (Impact Shockwave); Act 2 Leap Slam (Crater) and Forge Hammer (lvl 9 gem); Act 3 Stampede (lvl 11 gem) replaces both; Act 4 and interludes Hammer of the Gods. The tree is a point slider (0–123) with milestone notables. Each trial has its ascendancy picks, including respecs |
| Gem links | Per skill, a ranked support list ("6-link Stampede first"). maxroll adds an engraving priority for scarce uncut gems. **Nobody gives socket counts per level** |
| Gear | Offence and defence stat-priority lists; slot-by-slot affixes; key uniques; rune and socketable picks; flasks and charms; campaign-bonus choices |
| Budget tiers | maxroll uses stage tabs (Campaign / Maps / Min-max) with no prices. game8 has "High-Budget Alternative" boxes. Only tier-list blogs quote divines: budget ≈1–20 div, "fully functional" ≈200 div, high end 1,000+ [S46] (L) |
| PoB / loadouts | game8 links pobb.in. maxroll has a "Build File Export" section. poe-vault embeds a tree planner. Endgame guides are often separate from leveling guides (game8: "for Level 65 and above") |
| Newcomer aids | Pros/cons; numbered rotations for clear vs. single target; mechanic FAQ ("how do I prime enemies?"); hard warnings ("NEVER allocate X"); links to survival and defence primers; a dated changelog per patch |

**Candidate guide template** (feeds W1, the guide writer):
1. Header: patch, PoB version, date, league, dated prices, PoB import code.
2. Summary: concept, why the rolled skill works, pros and cons, difficulty. 3. How it works: mechanics
   with sources, and the hand-calculation ledger summary.
4. Leveling, one subsection per stage/loadout (Act 1–4, Interludes, Early maps): level range, skills and
   supports with socket count, tree points to add, ascendancy pick, gear to equip or buy, swap triggers,
   PoB numbers. 5. Campaign rewards to pick (the Act 4 tests, Seven Pillars).
6. Endgame budget variant: gear by slot with dated prices, stat priority, gem links, tree, earned config,
   the checks (survival floor, time-to-kill, Arbiter check), mapping signals. 7. Non-budget variant: the
   same layout, plus the upgrade order from budget.
8. Rotation (clear, single target). 9. Defences and resistance plan (after the −60% penalty). 10. FAQ and
   common mistakes. 11. Confidence and what PoB can't model. 12. Changelog.

## 6. Blood Loss (0.5.x; poe2db reflects live, `[PoB]` reflects 0.5.4)

- **Definition** (poe2db keyword): "All Physical damage over time taken by a target (including Bleeding)
  is accumulated as Blood Loss" [S36] (H). It shows as a darker red segment of the life bar (search
  summary of poe2wiki; M).
- **What accrues it:** Bleeding and any other physical damage over time. In 0.5 the unique gloves
  Atziri's Acuity add "10% of Physical damage dealt by your Hits causes Blood Loss" [S36] and `[PoB]`.
  PoB can't parse that line.
- **Blood Hunt** (Spear, tier 7) [S37][S39]: a hit on an enemy that has suffered Blood Loss "cause[s] a
  blood explosion and also Consume[s] Bleeding". The explosion makes "Enemies lose Life equal to 25% of
  Consumed Blood Loss" (quality adds up to 4%) and gets "10% more area of effect per 1 Blood Loss
  Consumed, up to 500%". The dash "Cannot cause Bleeding". Since 0.3.0 the explosion is **Life Loss**
  rather than unscalable damage.
- **Bloodhound's Mark** (tier 9) [S38]: the marked target gets Heavy Stun buildup equal to 300% of its
  Blood Loss. The mark activates (consuming itself) on Heavy Stun, or on death with at least 5% buildup.
  It then triggers a blood explosion: physical attack damage not based on the weapon, with up to 100% more
  damage and area from the share of the buildup that came from Blood Loss. The `[PoB]` text adds that the
  mark's duration does not expire while the target suffers Blood Loss.
- **Also using Blood Loss:** Herald of Blood and Herald of the Royal Queen (granted by Atziri's Acuity),
  which explode enemies killed while they have Blood Loss [S36].
- **Open questions (L):** does consuming reset the Blood Loss counter? (A guide says it "consumes all
  Blood Loss"; fextralife says this is unclear.) Does Life Loss bypass energy shield? The Arbiter has 10%
  of its life as ES, which would matter for time-to-kill.

## Surprises: decision rows the facts change

- **The budget variant's "Uber Arbiter of Divinity" sanity check (row 16).** No "Uber" exists in 0.5:
  0.5.0 removed the old Uber model, and the nearest equivalent is **the repeatable non-quest Arbiter of
  Divinity**. Rename the check. Its in-fight life is unpublished, so the enemy reference profiles (E1)
  must state an assumption; the only hard numbers are §4's level-79 base stats and hits. Several sources
  call it the hardest fight in the game, so "budget builds usually manage it" is unverified. E1 must also
  use 0.5.5's resistances (Lightning 45%, Fire −15%; the pin predates them). Its damage is physical and
  lightning only.
- **The non-budget "high-difficulty scaled maps" target (row 17) and the mapping-strength estimate
  (row 32).** "T15" is still correct (area 79). Name the harder target concretely: T16 (area 80, a
  **+25% step in base monster life**), up to area 82 with Irradiated plus corruption, 6–10 mod waystones,
  and tablets. Row 32's "one-click kill at T15" uses L79 life of 24,852 times the waystone "more life"
  mods; magic and rare multipliers are still to ground in PoB.
- **The campaign data source (row 31) and the stage validity check (V1).** PoB's `QuestRewards.lua` matches
  the live campaign (24 points, 100 Spirit). Interlude area levels are **dynamic** (+8, depending on
  order), so `WorldAreas` base levels understate them. V1 must count the 24 weapon-set points too, and
  allow up to 123 (+1) passive points.
- **The capped-resistances survival floor (row 18).** The endgame penalty is −60% and the campaign offsets
  only +10–20% per element. Check that PoB's resistance-penalty config stays at its "Endgame" default.
- **One patch per guide (row 7) and pricing (rows 11, 12, 33).** The pin (0.5.4) to live (0.5.5e) gap is
  small: Soul Cores and boss resistances. But **1.0 ships 2026-12-11 and ends both leagues**, so a guide
  made now lives about nine weeks. Pricing needs an explicit league setting: Forbidden Rites (fresh economy
  since 09-04) or Runes of Aldur.
- **No change:** the 20 / 200 divine budget framing (rows 16, 17) matches the bands of the guides that
  quote prices; maxroll and poe-vault quote none. Letting the leveling skill differ (row 10) is needed
  anyway: Blood Hunt needs a Spear and an uncut gem of level 7+ (Act 2), so it can't carry Act 1.

## Sources (all accessed 2026-10-07)

Grouped by site; `md/` = `https://maxroll.gg/poe2/`, `g8/` = `https://game8.co/games/Path-of-Exile-2/archives/`, `db/` = `https://poe2db.tw/us/`.
- **maxroll:** S2 `md/news/0-5-5-forbidden-rites-patch-notes` · S10 `md/getting-started/permanent-stats-from-campaign` · S13 `md/getting-started/how-to-get-the-martyr-passive-point` · S15 `md/getting-started/trials-of-ascendancy` · S22 `md/resources/atlas-of-worlds-and-mapping` · S23 `md/resources/rolling-waystones-and-precursor-tablets` · S40 `md/build-guides/boneshatter-titan-leveling-guide` · S41 `md/build-guides/shield-wall-titan-endgame-build-guide` · S42 `md/build-guides/bleed-rake-amazon-build-guide` · S47 `md/getting-started/comprehensive-league-start-leveling-guide` · S48 `md/getting-started/path-of-exile-2-campaign-guide` (search snippet)
- **poe2db:** S9 `db/Act_1` … `db/Act_4`, `db/Interlude` · S19 `db/Uncut_Skill_Gem` · S21 `db/Waystones` · S26 `db/The_Arbiter_of_Divinity` · S27 `db/The_Arbiter_of_Ash` · S28 `db/The_Origin_Tower` · S36 `db/Blood_Loss` · S37 `db/Blood_Hunt` · S38 `db/Bloodhounds_Mark`
- **game8:** S4 `g8/601782` (0.5 patch summary) · S8 `g8/617539` (0.5.5 summary) · S11 `g8/513735` · S12 `g8/489986` · S17 `g8/488760` · S24 `g8/603859` · S30 `g8/604768` · S45 `g8/603964`
- **poe-vault:** S34 `https://www.poe-vault.com/poe2/guides/the-arbiter-of-ash-boss-guide` · S43 `…/poe2/warrior/titan/stampede-leveling-build` · S44 `…/poe2/warrior/titan/stampede-build-guide`
- **fextralife:** S29 `https://pathofexile2.wiki.fextralife.com/Endgame_Guide` · S39 `…/Blood+Hunt`
- **Release and news:** S1 `https://poepatchnotes.com/poe2` · S3 `https://en.wikipedia.org/wiki/Path_of_Exile_2` · S5 `https://www.thegamer.com/path-of-exile-2-final-release-date-december-2026/` · S6 `https://github.com/PathOfBuildingCommunity/PathOfBuilding-PoE2/releases` (and `/tag/v0.23.1`) · S7 0.5.4b–e dates from search snippets of `https://changelog.gg/games/path-of-exile-2-2694490/updates/2026-07-02-0-5-4b-patch-notes-c2d9092bc27d138c` and `https://patchbot.io/games/path-of-exile-2/articles/851-054c-patch-notes`
- **Other (mostly L):** S14 `https://novatus9.github.io/poe2-cheatsheets/resistances/` · S16 `https://www.switchbladegaming.com/path-of-exile-2/all-ascendancy-points/` · S18 `https://outof.games/realms/poe2/items/uncut-support-gem-level-2/` (also `-3`, `-4`, `-5`, `uncut-skill-gem-level-7`) · S20 `https://timesaver.gg/blog/poe2-perfect-jewellers-orb-guide` (search summary) · S25 `https://timesaver.gg/blog/poe2-t15-dps-requirement-0-5-5` · S31 `https://timesaver.gg/blog/poe2-arbiter-of-divinity-guide` · S32 `https://www.switchbladegaming.com/path-of-exile-2/endgame-boss-guide/` · S33 `https://poe2hub.net/bosses/arbiter-of-divinity/` · S35 `https://domistae.github.io/poe2-leveling/poe2_endgame_guide.html` · S46 `https://www.aoeah.com/news/4801--poe-2-055-best-budget-builds-%E2%80%93-top-5-cheap-builds-for-forbidden-rites` (search summary) · S49 `https://timesaver.gg/blog/poe2-1-0-wipe-currency-characters-what-happens` (search snippet) · S50 `https://odealo.com/articles/path-of-exile-2-precursor-towers-and-tablets-guide` and `https://maxroll.gg/poe2/resources/corruption-outcomes` (search summaries)
- **[PoB]** `vendor/PathOfBuilding-PoE2/src/`: `Data/Misc.lua`, `Data/QuestRewards.lua`, `Data/WorldAreas.lua`, `Data/Gems.lua`, `Data/Uniques/gloves.lua`, `Modules/ConfigOptions.lua` (read locally)
