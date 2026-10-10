# Amendment 3: open-ended builds

**Status: PROPOSED, 2026-10-10, for the user's review.** The user set the direction on 2026-10-10
(`../worklog.md`, from "The user's answers and a new direction" through "The user's answers (2026-10-10,
continued)"). The user approved drafting this memo ("Go ahead"). The user then took the recommendations on Q1–Q7 and
asked about EHP (`TotalEHP`) next to the headline; Q8 folds it in. The contents stay proposals until the user
approves the memo. It was revised after an adversarial review, whose findings were checked against the code
(`../worklog.md`, the same section).

Section ids run O1–O11. At finalization the memo folds into the spine (`README.md`), slice 02
(`02-plan-compiler.md`), slice 03 (`03-pipeline.md`) and amendments 1 and 2. Paths without a directory are
under `.claude/skills/build-guide/`.

**Names.**

| Name | Meaning |
|---|---|
| R1a | The three researchers |
| R1b | Compiles one PoB skeleton per concept, measure only |
| R1b-assemble | Writes `dossier.md` and the comparison |
| Checkpoint 1 | Today's pick, more or stop, after the skeletons |
| Checkpoint 2 | The final accept or changes |
| D1 | Designs the endgame stages; the D1 gate checks them |
| D2 | Designs the campaign stages |
| W1 | Writes the guide |
| V4 | The verifiers |
| The checker | `scripts/check-run.mjs` |
| PG-n | An entry in `../pob-gaps.md`, the list of PoB gaps and bugs |

**Evidence.**

- `../reference-builds.md`: 30 user-supplied entries, 21 off-meta builds and 9 random-build playthroughs.
- The pattern families and process heuristics in `../worklog.md`, "Off-meta builds 7–30".
- `../pob-gaps.md`.

**The user's decisions this memo carries out** (`../worklog.md`, 2026-10-10):

1. **Constraints as the input.** A user may name an ascendancy, a skill, a playstyle, any mix, or almost
   nothing. The randomizer roll is one case.
2. **A pattern library and a text-check sniff test.** The numbers are run only for candidates that pass.
3. **Three phases, each gated by the user:** brainstorm, verification and finalization.
   - Each surviving concept goes to the user with what has and hasn't been verified stated plainly.
   - The user moves it to the next phase or asks for more candidates.
4. **Count in the plan and the compiler,** with Full DPS as the headline. O6 refines how the headline is
   computed, because PoB's Full DPS mode breaks the compile-time limits (Q7).
5. **PoB's role:**
   - PoB keeps its job for defences and the delivered file.
   - DPS that rests on Count or a hand calculation is labelled an estimate, not verified for exactness.
   - The finished guide still checks that every stated interaction exists in game text.
6. **The main-damage rule** follows the build's named damage source. The user's clarification of D-122: the
   rolled skill's own hits, ailments and projectiles count when another skill fires, spreads or copies them.
7. **poe.ninja is on by default** (popularity and the build index), with an override flag.
   - Only requests that need PII or a cookie require explicit approval.
   - Development agents may call poe.ninja politely.
8. **The won't-do list** (O11).

## 1. Summary

- **The input is a brief:** a set of optional constraints (O1).
- **Three phases, three gates** (O2):
  - **Brainstorm** deals a deck of candidate cards. Each card fixes a class, an ascendancy and a named damage
    source. Its links are checked against game text, with no PoB numbers yet.
  - **Verification** compiles quick PoB skeletons for the cards the user picks, with an advisory checklist.
  - **Finalization** is today's D1 onward.
- **A pattern library** gives the brainstorm its starting points and its questions (O3).
- **The candidate card** says what is confirmed, estimated, at risk and unchecked (O4).
- **The verification checklist** reports. It is never a gate and starts no fix rounds (O5).
- **Count and custom modifiers** go into the plan with reasons. The headline is the named source's figure with
  Count applied, which is what PoB's Full DPS shows for that group (O6).
- **poe.ninja on by default,** through server tools (O7).
- **Lookup additions and coverage flags** for the gaps found (O8).
- **Campaign additions:** bridge skills, and "dormant until" lines (O9).
- **Cost:** research stays about the same, and runs end early when the user doesn't want a concept (O10).

## 2. O1: the brief, and each card's identity

**The brief's fields, all optional:**

| Field | Example |
|---|---|
| `ascendancy` | Titan |
| `skill` | Blood Hunt |
| `playstyle` | Tags from the vocabulary below, plus free text |
| `budget` | `budget` or `non-budget` (the two endgame variants), or a figure in divines |
| `around` | An item or mechanic to build around: "Melting Maelstrom", "block" |
| `like` | A reference build and what to change: "like the Eraser, but not Gemling" |
| `notes` | Anything else |

A randomizer roll is `{ascendancy, skill}`. An empty brief means "surprise me" (Q2).

**Playstyle vocabulary** (proposed, Q1). Cards use the same tags.

- **Delivery:** `melee`, `ranged-attack`, `spell`, `minion`, `totem-trap`, `mixed`.
- **Buttons:** `one-button`, `few-buttons`, `combo`.
- **Focus:** `clear`, `boss`, `balanced`.
- **Defence:** `tanky`, `balanced`, `glass`.
- **Pace:** `fast`, `steady`.

**Invocation:** `/build-guide <free text> [--offline [--test <path>]] [--no-ninja]`.

- The coordinator parses the free text into the brief and echoes it at the top of the brainstorm gate.
- Today's form, `/build-guide <ascendancy> <skill>` (`SKILL.md:3, :114-115`), still works.
- Named fields are checked the way today's roll is (`SKILL.md:124-135`, D-238).

**Each card's identity.** A card fixes `{className, ascendancy, skill}`, where `skill` is the named damage source
(O6).

- At deck assembly (O2), each identity is checked the way D-238 checks a roll: `get_classes`, then
  `lookup_game_data` with `Kind: active`.
- R1b uses the card's identity as the skeleton's `roll` (`src/plan/schema.ts:314`, `R1b.md:55`).
- At the verification gate's pick, the card's identity becomes the run's `roll`.
- The run log's `roll` changes. Today it is `{ascendancy, skill}` (`references/run-log.md:15`,
  `check-run.mjs:1043-1047`). It becomes `{className, ascendancy, skill}`, like the plan's, and stays null
  until the pick.

**The run folder's slug** comes from the brief at the start, for example `titan-blood-hunt`, `titan-open` or
`open-<first playstyle tag>`. The picked card is recorded in the run log, not in the folder name.

## 3. O2: three phases, three gates

| Phase | Steps (run-log `stage`) | Output | Gate options |
|---|---|---|---|
| **Brainstorm** | `R1a`: three researchers, 2–3 cards each. `R1a-assemble`: the coordinator agent deals the deck | Card files `cards/<id>.md`; `cards.md` (the dealt deck, plus "Not dealt") | Verify 1–3 cards; brainstorm more (with a note); or stop |
| **Verification** | `R1b` per picked card, with the checklist (O5); `R1b-assemble` | Skeletons; each card's verification half; `dossier.md`; the comparison | Finalize one (a failed card may be picked anyway, as today); verify other cards from the deck; brainstorm more; or stop |
| **Finalization** | D1 through the checker, unchanged | `guide.md`, `audit.md`, the PoB file | Accept, ask for changes (D-236), or anything else, which ends the run `not-accepted`; unchanged (`references/checkpoints.md:39-56`) |

**Deck assembly** (`R1a-assemble`, a new step for the `build-guide-coordinator` agent):

1. Read the researchers' card files.
2. Merge duplicates and check each card's identity (O1).
3. Apply the sniff test. A card is dealt only when every load-bearing link is confirmed in game text by a
   lookup. Otherwise it goes under "Not dealt", naming the unconfirmed link, and the user can ask for it at the
   gate.
4. Write `cards.md`: one line per dealt card, like `R1b-assemble`'s comparison (`R1b-assemble.md:65-76`). The
   stale example at `:73` is fixed at the same time.

**R1a's foci.** The three angles stay: mechanics, items and tree (`R1a.md:12-17, :53-74`). Each starts from the
brief's fixed pieces:

| Brief | Mechanics | Items | Tree |
|---|---|---|---|
| Names a skill | From the skill, as today | From `around`, or from uniques that change how a skill plays (`R1a.md:67`) | From the ascendancy's nodes |
| Names no skill | From the library's families and the playstyle tags | (same) | (same) |
| Names no ascendancy | (as above) | (same) | From ascendancies that suit the playstyle, and under-played ones when poe.ninja is on |

All three researchers read the library (O3) first.

**Rounds and caps** (NFR-23, `references/run-log.md:66-70`):

- **A brainstorm round:**
  - at most 3 R1a entries and one `R1a-assemble`;
  - deals 6–9 cards (Q3);
  - only the user starts one, as today (D-235);
  - a later round reads `cards.md` and adds only new cards.
- **A verification round:**
  - compiles at most 3 cards;
  - "verify other cards from the deck" starts a new verification round without a brainstorm;
  - the checker opens a round at R1a today (`check-run.mjs:1351-1364`). It gains the verification round, so a
    second pick from the same deck doesn't trip the cap.

**Gate presentation.** `references/checkpoints.md:4-5` already splits long questions.

- The brainstorm gate prints the deck.
- It asks with AskUserQuestion in `multiSelect` mode: up to 4 cards per question, up to 3 questions, plus one
  for more or stop.
- The pick is the union of the selections, up to 3. More than 3 is asked again.

**Routes back.** Every route that goes "back to checkpoint 1" today goes to the verification gate:

- the escalation's option 3 (`references/checkpoints.md:66-77`);
- D-125 and D-141;
- `SKILL.md:186-187` and `:214`;
- fault FI-3 (`references/offline-and-test.md:72`).

The escalation's test answer `checkpoint-1` (`references/checkpoints.md:89`, `check-run.mjs:93`) becomes
`verification`.

**Offline test answers** (`references/offline-and-test.md:31-44`):

- **`answers.brainstorm[]`:**
  - `pick:<id>[,<id>…]` (1–3 ids);
  - `first-n:<n>` (n = 1–3): the first n dealt cards not yet verified;
  - `more`;
  - `stop`.
- **`answers.verification[]`,** renamed from `answers.checkpoint1[]`:
  - `first-viable`;
  - `pick:<id>`;
  - `verify:<id>[,<id>…]`;
  - `more` (a new brainstorm round);
  - `stop`.
- When answers are missing or run out, the run ends `stopped` with the rule recorded, as today
  (`references/checkpoints.md:98-103`).
- A-28 (the coordinator answers an offline run's checkpoints) gains the brainstorm gate: pick the first dealt
  card, or follow the test config.

**Gate names in the run log** (`check-run.mjs:1099-1112`): `brainstorm`, `verification` and `final`, alongside
`unsaved-build` and `escalation`. The schema version goes to 3.

**A fixed roll** runs the same three phases, and every card's skill is the rolled skill.

## 4. O3: the pattern library

**Where and what.** `references/patterns.md`. Version 1 is built from:

- the ten families in `../worklog.md` ("Off-meta builds 7–30");
- the earlier studies;
- the brainstorm questions from the worklog's "Process heuristics, by phase", at the top.

**Each entry:**

- **Name and shape:** one general sentence that applies to any skill.
- **Search step:** the starting point, the lookup or phrase search (O8), and what to check.
- **How PoB follows it:** modelled, Count, custom modifier, config stand-in, hand calculation, or not modelled,
  citing PG ids.
- **Examples:** one to three builds, a line each, so the file reads on its own.
- **Cautions:** for example, a payoff thief alongside builder and finisher.

**Rules:**

- **Shapes only.** Each use is re-checked against current game data.
- **At most about 6,000 words,** so a researcher reads it whole.
- **Maintenance (Q6):** after each user-supplied study, the coordinator proposes entries and the user approves
  them.

## 5. O4: the candidate card

**The template** is `templates/card-template.md`. R1a fills the brainstorm half, about 250–400 words. R1b fills
the verification half.

**Brainstorm half:**

- **Identity:** class, ascendancy and named damage source (O1).
- **Pitch:** a title of at most 60 characters, playstyle tags, and two lines.
- **Chain:**
  - the named damage source, and what it reads (the slot that carries it);
  - its multipliers;
  - its enablers;
  - what the payoff consumes or requires, and who supplies it.
- **Enabler:** the item, node or gem, the level it arrives at, how to get it, and what is dormant until then.
- **Links table.** Each link gets:
  - the confirming game text, and the lookup that found it;
  - how PoB follows it (O3's labels, with PG ids);
  - any hidden clauses, stated as theory ("from a Hit", "you use yourself", "while in Bear form").
- **Evidence:**
  - poe.ninja popularity of the skill and the ascendancy;
  - how many characters use the combination, and at what level;
  - a reference build, if there is one.
- **Risks so far:** payoff thieves, placement limits, the exposed phase, resistant bosses.

**Verification half:**

- **Verified:**
  - defences from PoB: life, energy shield, resistances, max hit and effective HP (Q8);
  - modelled DPS.
- **Estimates:**
  - each Count and custom modifier, with its reason;
  - any figure computed with a custom modifier present;
  - clear and boss figures, kept separate.
- **Checklist results** (O5).
- **A fallback ladder.**
- **Key item prices.**

**Status words,** used everywhere on the card:

- confirmed in game text;
- modelled in PoB;
- estimate (with the reason);
- players use it (poe.ninja);
- not checked yet;
- needs in-game testing.

**Damage sources that aren't skills** (Q4). A card whose damage isn't a skill can be dealt and verified, but
can't be finalized under this memo, and the card says so. Melting Maelstrom's flask nova is the example.

## 6. O5: the verification checklist (advisory)

R1b runs these checks and writes the results into the card. None is a gate, and none starts a fix round. Each
result is reported as verified, estimate, risk or not checked.

**From reading the plan and the compile record (no extra compile):**

1. **Pillars** for ailments and damage over time: base, type-specific scaling, duration, and 100% application.
2. **The enabler's conditions** at the target level, in numbers, and what they force out of the build.
   - Example: Minion Pact needs a minion with at least your max life.
   - A forced condition gets a permanence check: reservation of at least 1 minus the threshold.
3. **Attribute requirements** at the target level, for the defining items and every gem.
4. **Risks PoB can't show:**
   - payoff thieves, found from the lookup's hit-making children (O8);
   - placement and targeting limits;
   - the exposed phase;
   - cooldown dead windows on interruptible casts;
   - hidden clauses.

**From compile variants.** The mutating tools (`toggle_gem`, `toggle_socket_group`, `set_config`) are `mutate`
tools (`src/server/toolMeta.ts:114-117`) that the coordinator doesn't hold (D-231). So each probe is a plan
variant, compiled measure-only as a single stage:

5. **A dead-slot audit.** The skeleton with one support or source removed; a change below 1% is flagged. The
   audit also says whether each support touches the activation or the payload.
6. **Condition on and off,** by toggling the earned config entry, at a realistic uptime.
7. **Encounter mods:** +resistance, and bosses that resist the element (scenario config).
8. **Skill-shape probes,** where the skill's text suggests one, such as projectile speed up and down.

**The compile budget.** R1b allows two compiles per attempt today (`R1b.md:26`). It gains up to 4 probe variants
per card, run in the order above. A probe that doesn't fit is reported as not checked. Each probe is a one-stage
compile, well within NFR-21's per-request limit.

## 7. O6: Count, custom modifiers, and the damage rule

**The plan's schema** (`src/plan/schema.ts`):

- **A skill group** (`:135-143`) gains:
  - `count`, an integer, default 1;
  - `countReason`, required when `count` is above 1. For example: "six mirages up at once at this cooldown and
    duration".
- **`config`** (`:182-205`) gains `customMods: [{text, reason}]`. Each entry is a hand-calculated effect, for
  example "Allies in your Presence Gain 180% of Damage as Extra Chaos Damage" for a remnant relay (PG-27).
  - It is a third kind of config entry beside C-32's `earned` and `scenario`. It has no producer and no source
    key, only its reason.
  - The compiler writes it to PoB's `customMods` text option (`vendor/.../Modules/ConfigOptions.lua:2279`), one
    line per entry, after `set_config` (`Compile.lua:658-664`).

**Figures with Count.** Players apply Count through PoB's Full DPS mode, but that mode breaks our compile-time
limits. A test run with every group in Full DPS mode took 160.68 s, with one stage at 25.50 s. That is against
the 100 s budget of D-159 and D-229, and NFR-21's per-stage limit (`../worklog.md:54-58`). WU-41 was built with
Full DPS off.

- **The compile record applies Count itself.** Each group's figure × count mirrors PoB's rule
  (`Modules/Calcs.lua:342-411`): hits are multiplied by count, and damage over time only when it stacks.
  Today's per-group figures (`Compile.lua:666-678`) ignore Count.
- **The headline** is the named source's main stat-set figure × its Count. Custom modifiers are config, so
  they're already applied. Clear and boss figures stay separate; groups of different roles are never summed.
- **Effective HP beside it** (Q8). PoB's `TotalEHP` is already in the record: the compiler copies every PoB
  output (`Compile.lua:961-964`), so it costs no compile time.
  - Max hit against the reference hits stays the basis of the survival verdict.
  - EHP depends on the assumed enemy damage, and it misses defences PoB doesn't model. So it is shown beside
    max hit, never alone. A figure computed with a custom modifier present is marked, as above.
- **The delivered PoB file** sets `groupCount` and `includeInFullDPS` on the named source's groups only. A reader
  who opens it sees Full DPS with the same Count.
  - `BuildOps.create_socket_group` (`BuildOps.lua:1291-1300`) gains `groupCount`. `add_gem`'s `count`
    (`:1465`) is a gem's own count, not the group's.
  - Spike S-N2 measures the compile cost of Full DPS with only those groups included. If it fits NFR-21, the
    final compile computes it normally. Otherwise the flags are written at export only.
- **Marking.** The record marks every figure computed while a custom modifier was present, defences included. V4
  and the card treat those figures as estimates.
- **The D1 gate's figure rule** (`references/gates.md:88-95`, `D1-gate.md:66-74`, `rolled-stat-set`) reads
  figure × count.
- **Caution.** Count also multiplies reservation for skills reserved per copy and for totems with Ancestral Bond
  (`Modules/CalcDefence.lua:283-288`), and it scales Umbral Well buffs (`Modules/CalcPerform.lua:1318`). D1
  checks reservation and buffs after setting Count on such a group.

**The damage rule.**

- **D-122** becomes: "The build's named damage source is the main source of damage, never a token role." For a
  fixed skill, that skill is the named source. Its own hits, ailments and projectiles count when another skill
  fires, spreads or copies them (the user, 2026-10-10).
- **D-148** becomes: "The named damage source should be the clear skill. It takes the single-target role only
  when it can't clear, and the guide says so."
- **`skills.rolledGroup`** (`schema.ts:152`, D-217) keeps its name, meaning the group that holds the named damage
  source. A rename would only add churn.
- **D1's figure rule** (`D1.md:64-69`): the named source's figure, × Count, must be the largest among the
  stage's groups with that role.
- **R1a's feasibility read** (`R1a.md:100-102`): "the rolled skill as the main damage source" becomes "the
  named damage source as the main damage source".
- **The headline rule** (`D1.md:73-78`) follows the headline defined above.
- **Amendment 2's verdict line** (`amendment-2-guide-style.md:306`) quotes the Count-scaled figure and ends with
  "Effective HP about <n>." The checker compares that number with the stage's `TotalEHP`, using the same
  rounding rule. "What PoB can't show" lists each Count and custom modifier with its reason, rendered from the
  plan.
- **R1b-assemble's key numbers** (`R1b-assemble.md:20-22`: Life, ES, missing resistances, max hit) add
  `TotalEHP`. The verification gate compares candidates on it too.

## 8. O7: poe.ninja on by default

**Uses:**

- popularity: the share of characters by skill and by ascendancy;
- the build index: characters using a combination, and their levels;
- peers: what similar characters run;
- prices, as today.

**Access:**

- **Only through server tools:** one client, one cache, one rate limiter, one user agent. Agents never fetch
  poe.ninja directly.
- **New tools** for popularity and the build index.
  - Their names and shapes come from spike S-N1, which grounds the PoE2 build index API: endpoints, response
    shape, rate limits and terms.
  - The user allows polite poe.ninja requests during development.
- **The `ninja` tool group.** The new tools join it (`src/server/toolMeta.ts:138-147`), so
  `POE_NINJA_DISABLED` hides them. The flag is checked at `src/trade/currency.ts:127`.
- **Who may call them:** researchers and the coordinator, which updates D-231's tool rights. Today only
  coordinator steps reach poe.ninja, through `get_currency_rates` (`SKILL.md:17-20`;
  `build-guide-coordinator.md:41-43`; `build-guide-researcher.md:31-33`).

**Off switches:**

- `--no-ninja`: the run doesn't call the poe.ninja tools, and cards say "no player evidence".
- `--offline`: all web is off, as today.
- `POE_NINJA_DISABLED`: the server's hard off.

**Politeness:** serial requests, back-off on HTTP 429, and a cache per league with a TTL set by S-N1. Currency
rates use 60 minutes (`currency.ts:97-98`). There is no rate limiter for poe.ninja today; the new client adds
one.

**Approval:**

- Only requests that need PII or a cookie need explicit approval.
- poe.ninja needs neither.
- Trade (the POESESSID cookie) keeps its current rules, and D-182's live-run approval (M-13, HG-14) still
  covers it. poe.ninja no longer needs D-182's approval.

**Rewording when built:**

- `SKILL.md:17-20` becomes "never contact pathofexile.com or poe.ninja yourself; poe.ninja only through the
  server's poe.ninja tools".
- The same change goes into both agent definitions.
- The project `CLAUDE.md` line "No agent or test makes requests to … poe.ninja" is reworded.
- **Tests stay offline (D-34),** with fixtures for the new endpoints.

## 9. O8: lookup additions and coverage flags

**Lookup** (`pob-api/API/Lookup.lua`, entry point `:748-788`):

- **Gemling quality effects:** `altQualityStats` are shown and searched alongside `qualityLines` (`:128`),
  labelled (PG-46, I5).
- **"Usable by":** an active gem's skill types, and the meta and trigger gems that accept it (I6).
- **Item-base implicits** become searchable (I7).
- **Type-granting unlocks:** for a support you can't socket, the supports whose added skill types meet its
  required types. Example: Culmination II, then Ailith's Chimes.
- **What a support can ride:** the active gems it can support.
- **Named phrase searches:**
  - "also apply to";
  - "while already at maximum";
  - "per 100 maximum";
  - "for each type of";
  - "cannot … but";
  - "instead of you";
  - "your <tag> … shatter".
- **A skill's hit-making children** (triggered skills, granted skills, minions), for the payoff-thief check.
- **Stat sets,** so the card names the set the payoff uses.

**Coverage** (`pob-api/API/Coverage.lua`). `checkGem` (`:388-404`) already flags a gem stat that has no stat-map
entry. New flags:

- **Energy-based meta gems:** the trigger rate isn't modelled (PG-9).
- **Skills granted by a support:** the level comes from the support (PG-2).
- **Granted skills with no definition** (PG-10).
- **Stats that are mapped but read nowhere,** such as Mirage Archer and aftershock chance (PG-4, PG-24). This
  fixes Mirage Archer's false all-clear (PG-49).
- **Gem Studded ties** (PG-1).

Rolls above the data range (PG-41) are deferred.

## 10. O9: campaign additions

- **D2: bridge skills.** When the named damage source arrives late (a level-gated skill, or an ascendancy skill
  at level 21), plan bridge skills that share its weapon, element or resource, so gear and tree investment carry
  over.
- **D2: bank the enabler** in amendment 2's hold and save rows, for example a white base for an Orb of Chance.
- **W1:**
  - Leveling says what is dormant until the enabler arrives.
  - Priorities marks the pillars bought early as "buy now, works at stage X".
  - Both are optional items in amendment 2's sense: used where they exist, never required.

## 11. O10: cost

Run A has no per-stage research figures, so these are relative estimates.

- **Brainstorm:**
  - today's R1a, plus the library (at most about 8K tokens in each turn's context) and a lookup per link;
  - cards replace proposals, and nothing is compiled before the gate;
  - `R1a-assemble` adds one coordinator agent per round.
- **Verification:**
  - only the cards the user picks, at most three and often one or two. Today every carried proposal is
    compiled;
  - up to 4 one-stage probes per card.
- **Finalization:** unchanged, plus small D1 work for Count, custom modifiers and their reasons.
- **The saving.** A concept the user doesn't want stops at a gate, before finalization. Finalization is still
  most of a run after amendment 2:
  - V4 is about 11–14M cache reads (estimated);
  - W1 about 6–8M;
  - plus D1, D2 and their gates.
- **poe.ninja:** a few requests per card, mostly cached. S-N1 sets the numbers.

## 12. O11: won't do

- **No interaction database or graph.** It would be huge, and every patch breaks one.
- **No hunting for undocumented interactions.** The tool uses one only once it's documented, through the
  library.
- **No modelling mechanics in Lua** beyond Count and custom modifiers, and no patching of `vendor/`.
- **No scoring candidates by formula.** The user picks at the gates.
- **No required gates from the checklist.**

## 13. What is superseded or changed

| Where | Change |
|---|---|
| Vision (`README.md:133-135`): "an ascendancy and a main skill, often a randomizer roll" | Any brief (O1) |
| C-31 (`README.md:201`): the plan's required `roll` | Each card's identity; the run's roll is fixed at the verification pick (O1) |
| C-32: config entries `earned` and `scenario` | Adds `customMods` (O6) |
| C-36 (`:310-322`): stage artifacts | Adds `R1a-assemble`, `cards.md` and the card files; R1a consumes the brief (O2) |
| D-122 (`:422`), D-148 (`:448`) | The named damage source (O6) |
| D-124 (`:424`): "research proposes 2–3 concepts" | 6–9 cards per brainstorm round (O2) |
| D-125 (`:425`), D-141 (`:441`) | Routes back to the verification gate; the brainstorm gate is added (O2) |
| D-157 (`:456`): checkpoint 1 | The verification gate (O2) |
| D-158 (`:457`) and `03-pipeline.md:365`: the run log | Schema version 3: `brief`, gate names, card ids, verification rounds (O2) |
| D-159, D-229 (`:458`): compile time | Unchanged; O6 keeps Full DPS out of measure compiles (S-N2) |
| D-171 (`:470`): research hosts | Unchanged; poe.ninja goes through server tools (O7) |
| D-182 (`:481`): live-run approval | Covers trade; poe.ninja no longer needs it (O7) |
| D-231: tool rights | Researchers gain the poe.ninja tools (O7) |
| D-235 (`:529`): 3 concepts per round | 3 cards per verification round; brainstorm rounds deal 6–9 (O2) |
| D-236 (`:530`): the escalation's "back to checkpoint 1" | Back to the verification gate (O2) |
| D-238 (`:532`): the roll check | Checks the brief's named fields, and each card's identity at deck assembly (O1) |
| NFR-23 (`references/run-log.md:66-70`): the cost caps | Per brainstorm round and per verification round (O2) |
| A-28 (`:553`): the coordinator answers offline checkpoints | Adds the brainstorm gate (O2) |
| Amendment 2: the verdict line (G6, `amendment-2-guide-style.md:306-318`), "What PoB can't show", `D1.md:75-76`'s headline rule | O6: the Count-scaled figure, plus "Effective HP about <n>" checked against `TotalEHP` |

## 14. Implementation impact

**Work units, with their dependencies:**

| Unit | What | Depends on |
|---|---|---|
| S-N1 (spike) | Ground poe.ninja's PoE2 build index and popularity API: endpoints, shape, rate limits, terms. Polite, serial, cached | — |
| S-N2 (spike) | Measure Full DPS compile cost with only the named groups included (O6) | — |
| N-1 | The poe.ninja tools in the `ninja` group, the rate limiter, fixtures, and the README tool table (`pnpm docs:tools --write`) | S-N1 |
| N-2 | Lookup additions (O8), with engine tests | — |
| N-3 | Coverage flags (O8), with engine tests | — |
| N-4 | Plan schema and compiler (details below) | S-N2 |
| N-5 | Content: `references/patterns.md` v1, `templates/card-template.md`, the checklist in `references/stages/R1b.md` | — |
| N-6 | The pipeline (details below) | N-4, N-5; N-1's tool names (stubbed offline until then) |
| N-7 | The checker and run log v3 (details below) | N-6 |
| N-8 | The offline end-to-end run with an open brief, like WU-47 | all |
| — | A live run. poe.ninja needs no approval; trade keeps D-182 | N-8 |

**N-4, plan schema and compiler:**

- `count`, `countReason` and `customMods`;
- figure × count in the record, and the record marks figures computed with custom modifiers;
- `BuildOps` `groupCount`;
- `includeInFullDPS` on the named groups at the final compile;
- the plan checks;
- `docs/build-guide/plan-reference.md`.

**N-6, the pipeline:**

- `SKILL.md`: invocation, steps, hosts and routes (`:3, :17-20, :87-104, :114-135, :147-171, :186-187, :214`);
- `R1a.md`: foci, cards, the library;
- a new `R1a-assemble.md`;
- `R1b.md`: the card's identity, the checklist, the probe budget;
- `R1b-assemble.md`, with `TotalEHP` in the key numbers;
- `templates/guide-template.md` and `W1.md`, for the verdict line's EHP;
- `references/checkpoints.md` and `references/offline-and-test.md`;
- `references/gates.md` and `D1-gate.md`: figure × count;
- `D1.md` (`:63-78`), `D2.md` and `W1.md`;
- the agent definitions;
- the "rolled skill" wording across 17 files (`grep -i 'rolled skill\|rolledGroup\|the roll'`).

**N-7, the checker and run log v3:**

- `RUN_LOG_FIELDS` (`check-run.mjs:90`);
- roll and brief (`:1043-1047`);
- the escalation answer (`:93`);
- checkpoints (`:1099-1112`);
- the flow from `:1173`: picks, mores, brainstorm and verification rounds, card ids, and the caps at
  `:1351-1364`;
- `recomputeRolledSkill` (`:1765`), with Count;
- the verdict-line check, which gains EHP;
- `references/run-log.md`;
- tests and fixtures.

**Parallel and serial:**

- S-N1, S-N2, N-2, N-3 and N-5 are independent.
- N-2 and N-3 edit different files in `pob-api/`.
- N-4 waits on S-N2.
- N-6 and N-7 run in series.

**Tests:**

- **`tests/static/buildGuidePipeline.test.ts`:** the brief, the gates, the card template, the D-122 wording.
- **`tests/unit/buildGuideCheckRun.test.ts`:** run log v3, both kinds of round, the caps, the renamed answers,
  and the verdict line's EHP (missing, wrong, mis-rounded).
- **`tests/unit/planChecks.test.ts`:** `countReason` and the `customMods` reasons.
- **The compiler's engine tests:**
  - figure × count, for hits and for stacking damage over time;
  - `customMods` reaching PoB's config;
  - the marking of figures computed with custom modifiers.
- **Fixtures rebuilt:** `run-ok`, `run-ok-online`, `run-escalated`.
- **Tool counts:** the tool-count tests (`gemCorruption.test.ts:306`, `findUpgrades.test.ts:1086`,
  `tradeQueryOptions.test.ts:86`) and the README tool table, for N-1's new tools.

## 15. Questions

The user took the recommendations on Q1–Q7 on 2026-10-10. Q8 is a recommendation.

- **Q1, the playstyle vocabulary** (O1). Decided: the five axes as listed, plus free text.
- **Q2, an empty brief.** Decided: allowed. The brainstorm then seeds from the library's families and, with
  poe.ninja on, from skills few characters play.
- **Q3, deck size.** Decided: 6–9 cards per round (three researchers, 2–3 each), with up to 3 verified at once.
- **Q4, damage sources that aren't skills,** such as a flask nova. Decided: DEFERRED for finalization. Cards may
  show them, marked "can't be finalized yet".
  - **Unblocked by:** a plan field for an item-effect damage source and its hand calculation.
- **Q5, favouring under-played builds.** Decided: with poe.ninja on, each deck includes at least two cards below a
  popularity threshold, set after S-N1.
- **Q6, library maintenance.** Decided: the coordinator proposes entries after each user-supplied study, and the
  user approves them.
- **Q7, the headline figure.** Decided:
  - the record computes the named source's figure × Count itself, which equals PoB's Full DPS for that group;
  - PoB's own Full DPS mode stays out of the measure compiles unless S-N2 shows it's cheap;
  - the delivered file still opens with Full DPS set up.
- **Q8, EHP beside the headline.** The user asked whether to include it now or later. Recommended: now (O6).
  - It's already in the record, so it costs no compile time.
  - Players compare builds on it, and poe.ninja shows it.
  - It is shown beside max hit and never replaces max hit as the basis of the survival verdict.
- **Still deferred:** the vendor search regex (amendment 2, Q6), and rolls above the data range (O8).
