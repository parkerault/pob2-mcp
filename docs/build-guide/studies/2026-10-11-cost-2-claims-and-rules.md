# Cost study 2: what run A's build needs, and the rules that force the rest

Run A: Pathfinder / Explosive Concoction (`/tmp/m14.zfPx/guides/open-explosive-concoction/2026-10-11-3`).
Shorthands: **SP** the spine, `docs/build-guide/spec/README.md`; **P3** `spec/03-pipeline.md`; **SK**
`.claude/skills/build-guide/`.

## 1. The 133 claims

| Class | Campaign | Endgame | Total | Examples |
|---|---|---|---|---|
| H: the build hinges on it | 5 | 24 | 29 | `m-trap-weapon` (a main-hand weapon switches the skill off); `m-pool` (5 flask charges a throw); `b-boss` (about 1,760 DPS once the flask is dry) |
| C: the compile proves it | 30 | 12 | 42 | `s4-requirements` (level 36, 59 Dex); `s3-support-drop` (an uncut gem's drop area); `s4-penalty` (−20% resistances) |
| R: why a choice | 12 | 15 | 27 | `s6-ignite` (Ignite III over Elemental Armament II); `b-either-supports`; `m-buy-1` (the Sylvan flask first) |
| S: superfluous or costly | 12 | 23 | 35 | 12 Arbiter kill times; `s4-eternal-flame` (a 200-word burn-gap calculation); `s5-tawhoa` (+5% lightning pick) |

- **H:** 9 are "needs in-game testing" tags, which the sources lens only stamps; 9 cite the ledger.
- **C:** the rules require most: 5 requirements, 6 drop areas, 3 trial timings, 8 tree lists, 4 resistance
  penalties. The compiler's plan check (V1) already checks requirements, gem availability, trials and penalties.
- **Cuts by direction:** no campaign resistance maths (D-346) drops 8; no boss kill time (D-347) drops 13.

**What the claim checkers (V4) touched**, from `reports/` and `run-log.json`:
- **Round 1, ledger lens:** 3 fixed findings: the 5-charge caveat on `full_flask_seconds_b` (H), the income
  rounding in `boss_dps_b` (H) and the drink cost in `m-trap-drink` (S). The fix rewrote six kill times (S); the
  endgame designer (D1) recompiled, so both gates, the campaign designer (D2), the writer (W1) and all three lenses
  re-ran in full. Round 2 overwrote round 1's sources and prose reports.
- **Round 2**, after the test's `revise:` added `b-throw-cost` (H, a duplicate of `m-pool`): `s4-eternal-flame`
  (S, untouched by the revise), the audit's Run-notes credit (pipeline text), and a missing undercount caveat on
  the boss figures (H).
- **Stamps:** 10 `accepted-offline` findings, 9 on H caveats.
- **Pattern:** the surviving reports find no C or R claim wrong.

## 2. Content verdicts

| Item | Words | Verdict |
|---|---|---|
| At a glance, Timing, Priorities, How to play it, FAQ | 754 | keep |
| Your PoB file | 151 | generate |
| Survival by stage, campaign | ~90 | cut resistances; target life per act, from the record's `Life` |
| Survival by stage, endgame | ~110 | generate, Arbiter over map hits: both rungs read "solid", yet its slam kills them (0.66, 0.85) |
| Leveling | 476 | keep tree and supports; generate attributes; cut flask seconds and burn gaps |
| Campaign route and rewards | 200 | shrink to the build's picks |
| The three endgame H2s | 647 | keep buy orders, slot table, mod targets |
| Per-rung Checks | 306 | generate budget, Arbiter max hit, hits to kill, movement; cut kill times |
| What PoB can't show | 297 | shrink to hinge caveats, once each |
| audit: Hand calculations | 1,656 | generate, or cut |
| audit: Stage detail | 883 | generate the table; cut the prose |
| audit: the other three H2s | 1,325 | generate the coverage flags and the confidence list; cut Run notes |
| `dossier.md` | 7,681 | shrink to the comparison table |
| Ledger, 40 entries | n/a | cut 12 kill times and 2 campaign entries; compiler-compute 15 reference hits, 4 Arbiter ratios, 3 hits-to-kill; keep `boss_dps_*`, `full_flask_seconds_b` |

## 3. The rules behind each costly layer

- **Claims and source tags.** Every claim carries a source tag (C-30, SP:222-241). The guide states no fact of
  its own (D-276, SP:779), so each needs a claim (D-279, SP:782; P3:1015).
  - In SK: `references/source-markers.md`:31-37 (requirements, timing and picks need claims) and :73-86;
    `stages/D1.md`:198-211; `stages/D2.md`:94-108.
- **The ledger**, hand calculations a lens re-derives. C-33 (SP:323-366), D-179 (SP:687); D1.md:150-162 and
  :188-197 ("always, for `b` and `n`"); V4.md:99-130. The run checker already re-evaluates every formula (D-271,
  SP:774; `check-run.mjs`:53).
- **Three lenses, full re-pass.** D-264 (SP:767), D-268 (SP:771); NFR-23 says "3 V4 lenses per pass" (SP:1165);
  P3:656-697. A revision runs "steps 11 to 16 again" (P3:699-706, SKILL.md:392-400; V4.md:81-97).
- **`audit.md`**, W1's audit file. D-278 (SP:781); P3:990-1004; AC-W2 (z) (P3:1593); W1.md:149-160;
  `templates/audit-template.md`. The prose lens reads its Run notes (V4.md:83-86).
- **The dossier**, R1b-assemble's merge for the pick. D-200 (SP:704); D-269 (SP:772); P3:803-824;
  R1b-assemble.md:33-63. Its readers are D1.md:25-26, D2.md:24 and W1.md:41.
- **Reference hits, kill time, Survival by stage**: five waystone-scaled hits gate each rung; `b` and `n` report
  Arbiter kill times. D-116, D-119 (SP:625, :628); D-254, D-256 (SP:757-759); A-30 (SP:864); D-283 (SP:786);
  D-294 (SP:797); D1.md:133-169 and :191-194; gates.md:50-70; V4.md:109-130; P3:1041 and :1054-1077; AC-W2 (x)
  (P3:1592); guide-template.md:52-66 and :147-148; W1.md:62-79 and :128-129.
- **Campaign resistances and max hits.** P3:1041; guide-template.md:56-60; D2.md:38, :70-72 and :76-77 (pick "a
  resistance it lacks"); W1.md:151-153.
- **Three endgame rungs.** D-116, D-117 (SP:625-626); D-219 (SP:722); D-281, D-282 (SP:784-785);
  D1.md:55-74 and :170-177; P3:1046-1048; W1.md:118-129. Rung `m` carries a full floor, a budget, 5 reference hits
  and 10 prices, but no Arbiter measure (D-281).

## 4. Brainstorm and verification

- **R1a, the brainstorm researchers:** 3 a round (D-287, SP:790). Each reads `patterns.md` whole (R1a.md:73;
  6,000 words at most, C-53) and writes a research file and 3 cards of 250–400 words (R1a.md:142; the spine says
  2–3, SP:432).
- **R1a-assemble:** a lookup for every load-bearing link (R1a-assemble.md:49-52); it deals 6–9 (:62).
- **R1b, the card verification:** at most 3 cards a round (R1b.md:4); 2 compiles an attempt (R1b.md:31, D-311);
  up to 4 probes (R1b.md:204, D-292); 8 checks (R1b.md:160-201); 2 counted retries (D-272).
- **Run A's cache read:** R1a 36.8M, R1b 25.5M, assembles and gates 14.0M.

## 5. The endgame measures D-347 wants

- **DPS, computed.** The verdict line quotes the record's `TotalDPS` (D-294), the hit alone (budget variant:
  10,150). `CombinedDPS` adds the ignite (14,200). Once the flask is dry, the boss figure is `boss_dps_b` (1,760).
- **EHP, computed.** `TotalEHP` (6,040), on the verdict line.
- **Arbiter max hit, hand-computed** for `b` and `n` only: `arbiter_<rung>_<type>` is `<Type>MaximumHitTaken` over
  a hit from `data/enemies/arbiter-of-divinity.json` (D1.md:191-194). A plain comparison: the compiler can
  produce it.
- **Clear speed** can rest on hits to kill (`map_throws_*`, monster life ÷ `AverageDamage`, D-132: 5 throws on
  the budget variant, 3 on the non-budget) and the record's `AreaOfEffectRadiusMetres` (1.8), `Speed` (1.58) and
  two movement-speed fields (D-121). PoB lacks charges per kill, which also limit it.
