# Adversarial review: build-guide workflow design (2026-10-07)

## How it ran

- **Artifact:** `2026-10-07-build-guide-workflow.md`, after the Phase 1 grounding fold-back (commit
  `e61777b`).
- **Lenses:** three agents, each hunting one class of problem:
  - gaps and intent fit;
  - false assumptions;
  - reasoning errors and self-contradiction.
- **Merging:** the lenses returned 30 findings, merged into 16 clusters. 11 clusters were raised by two or
  three lenses independently.
- **Verification:** one skeptic agent tried to refute every cluster, defaulting to "refuted", against
  the code, the pinned PoB2 source, the stabilization spec and the grounding reports.
- **Result:** 11 clusters confirmed, 5 partly confirmed, none refuted. The coordinator re-checked three
  load-bearing facts:
  - auto-level estimation (`Modules/Build.lua:1001-1017`);
  - quest checkboxes defaulting to on (`Modules/ConfigOptions.lua:78`);
  - "+5 to any Attribute" parsing to an empty mod list (`Data/ModCache.lua:830`).

## Findings and fixes

Ranked by blast radius. "Rows" are decision rows in the design doc.

| # | Finding | Verdict | Fix |
|---|---|---|---|
| K1 | Character level, main skill and level mode are build-wide, so the PoB file can't reproduce per-stage numbers. Row 13's "the file is the source of truth" was false | partial: the stale-output path is GUI-only, because the bridge's `set_level` forces manual mode and rebuilds | Row 13: the plan is the source of truth, numbers come from the compile record. P2 sets the level per stage and keeps the main-skill index consistent. Auto-level mode raised as row 49 |
| K2 | Nothing checked that a claim or hand calculation is true; V3 checked tags only and ran before W1 | confirmed | V4, claim verification (row 42). V3 covers the guide. The ledger holds formulas that P2 re-evaluates |
| K3 | The config check was wrong both ways: it rejected required scenario config, and it missed defaults that are on (quest rewards add 100 Spirit to an Act 1 set) | confirmed | Row 14: two config classes plus a default audit. P2 writes every value explicitly. V2 takes E1 and C1 as inputs |
| K4 | The 12-search cap came from a 60 s burst window and couldn't price what the quality bar requires | confirmed | Row 33: paced, cached, priority-ordered, every slot priced |
| K5 | The plan, compiler and set tools lacked weapon-set passives, attribute-node choices (which give 0 attributes when unset), tree jewels, flask toggles, and the main-skill index | confirmed | L1 and P1 extended (Target state 5) |
| K6 | No failure paths. D1 was not gated before D2. Build order and run order were mixed | confirmed | Row 41; D1 needs V1 and V2; a separate run-order list |
| K7 | Research needs engine and trade work, but research agents were lookup-only; lookups take the engine lock anyway | confirmed | R1 split into R1a (parallel lookups) and R1b (coordinator); row 30's premise corrected |
| K8 | E1 couldn't be filled as written: stale "Uber" naming, 0.5.5 resistances missing, monster-life source mis-tagged, mapping got weaker checks than the Arbiter | partial: base hits are datamined; the Pinnacle preset is only overridable placeholders | E1 and rows 16, 19, 32 revised; the Arbiter check is reported, not gated; mapping reference hits added |
| K9 | V1 can't rely on PoB warnings (endgame caps only, no level-requirement checks); endgame levels were unstated | partial: V1 already listed its own checks | V1 computes its limits and filters info lines; C1 gets trial gates; row 46 |
| K10 | M2 changes stabilization contracts (D-77); tree continuity was unaddressed | partial: the count of 8 is D-78; AC-E39 only orders results; D2's K/M dependencies are transitive | Rows 43 and 44 |
| K11 | No capability produces the PoB2 import code | confirmed | Row 45 |
| K12 | The first guide mixes 0.5.4 engine data with 0.5.5 prices and boss data, against row 7; regeneration had no owner | partial: regenerating isn't "re-checking" | Rows 7 and 39 |
| K13 | D1's objective contradicted itself: strongest within budget vs. cheapest to reach T15; the rolled skill's role while mapping | confirmed | User decisions: rows 47 and 48 |
| K14 | "Fully parsed" isn't "modelled", and a single-line re-parse misreports PoB's two-line mods | confirmed | K2 adds "parsed to nothing", "possibly unread" and two-line joins; the census figures are lower bounds |
| K15 | Pausing a running workflow at checkpoint 1 is unverified | confirmed | Row 29: two workflows split at checkpoint 1 |
| K16 | Current-state misstatements: offense fields, `list_gems` weightings, the `plan_leveling` level comparison | confirmed | Current state corrected |

## Notes that would have misled a fix

- **K1 and K5 are authoring problems.** Fix them with setters and a consistent main-skill index. The
  bridge's existing handling of stale output is already correct.
- **"+5 to any Attribute" has no unparsed remainder,** so a remainder-only coverage check reports it as
  fully parsed. Hence K2's "parsed to nothing" status.
- **Explicit enemy inputs override the Pinnacle placeholders.** E1's real conflict was with the config
  check (K3), not with the preset.

The raw lens reports and the merged clusters were working files and were not kept.
