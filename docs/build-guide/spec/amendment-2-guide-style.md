# Amendment 2: guide style

**Status: APPROVED by the user, 2026-10-09,** with one change and the four open questions answered:
- **Lighter verification.** There is no per-fact trace table. The plan holds the facts and is verified as
  today, and the guide renders the plan. The prose lens reads the guide like an editor. The checker keeps
  cheap structural guards and one number check (G3, G6).
- **Entering-maps budget:** 5 divines. Players usually finish the campaign with 5–10.
- **The first person marks advice.**
- **One tree track** from `m` to `b` to `n`. V1 checks each respec and its gold cost.
- **Trade links.** Affix targets are written as text for now. A link field comes with WU-48, the live
  Titan / Blood Hunt run, if the price tool returns a link.

**Revised 2026-10-09, after guide comparison 2** (ronarray's Martial Artist Monk guide and its videos,
`../worklog.md:875-955`). The user approved the additions and softened two of them: fallbacks and threshold
triggers are used where they exist, never required, and the prose lens doesn't flag their absence. The
additions:
- trigger lines and the loadout ladder;
- "when you're short";
- hold and save rows;
- the entering-maps buy order;
- config assumptions;
- affix sources;
- traps;
- either/or picks;
- a rotation clause.

The vendor search regex is deferred (§10). Section budgets were rebalanced to about 2,840 words.

The memo carries out the guide style the user settled after comparing our output with Fubgun's guides
(`../worklog.md:832-856`). At finalization it folds into the spine (`README.md`), slice 03
(`03-pipeline.md`) and amendment 1 (`amendment-1-simplify.md`). Paths without a directory are under
`.claude/skills/build-guide/`.

**Names.**
- W1 writes the guide.
- D1 designs the endgame stages, and D2 the campaign stages.
- The D1 gate checks D1's stages: the survival floor, the budget, and the rolled skill as the main damage.
- V4 is three verifiers, one per lens: `ledger`, `sources`, `prose`.
- The runner is the user's session. The checker is `scripts/check-run.mjs`.

**Evidence.** Run A of WU-47 attempt 3, the recorded offline run
(`/tmp/m12b.B0zi/guides/titan-blood-hunt/2026-10-08-2/`):
- `guide.md`: 9,766 body words, 609 markers (one per 16 words), 49 "confidence L" labels and 297 source
  lines.
- `plan.json`: 232 stage claims, 45 ledger entries and 21 prices.
- Token figures: run A's subagent transcripts, summed per agent.

## 1. Summary

- **The guide.** `guide.md` becomes a reader layer of about 2,850 words, capped at 3,000. Everything kept for
  agents moves to `audit.md`.
- **The guide renders the plan,** with no markers and no fact or number of its own. The plan is verified as
  today; the prose lens checks the guide against it.
- **Advice** is in the first person and isn't verified.
- **Fewer claims.** D1 and D2 write about 75–95 stage claims instead of 232.
- **A bridge rung,** "entering maps", between the campaign's end and the budget variant.
- **Cost.** V4's cache reads fall from 37.6M to roughly 11–14M per run (§4.4).

## 2. G1: the reader layer

**Rules for every section.**
- **Facts.** A fact is a plain statement of something the plan or the record holds.
- **Advice.** Advice is in the first person ("I", "my"); that is its label.
- **Each caveat once,** where the reader acts on it. A later mention doesn't hedge it again, and never states
  it as settled.
- **Not a tutorial** (G4).
- **No pipeline text.** No markers, confidence labels, finding ids or pipeline words. No stage ids outside the
  loadout names.
- **Numbers** come from the plan or the record, rounded as a guide would ("about 2,740").
- **Fallbacks where they exist.** When a caveat, a choice or a gear target has an obvious fallback, say it in
  the same place ("if you can't fit it, I drop Herald of Ash first"). The fallbacks come from alternatives D1
  and D2 already weighed; none is required, a slot table's fallback cell may be empty, and the prose lens
  doesn't flag a missing one.
- **Triggers.** A "Move here when" or "when to swap" line uses a threshold when the plan has one: a stat, an
  item owned, a level. It adds what to keep until then ("until then, keep Storm Wave"). Otherwise a
  first-person judgment trigger is fine ("when you can afford it", "once clears start to feel slow"). The
  prose lens doesn't check a trigger's form.
- **Optional items,** used when the build has them; none is fine: traps (§11), either/or picks (§13), a
  rotation clause (§6), hold and save rows (§4).
- **Kept from our current guides:** survival as a verdict, the stage-matched PoB file, gem and trial timing,
  reasons and the FAQ (`worklog.md:848-849`).
- **Held back:**
  - crafting recipes;
  - an atlas section;
  - affix tier labels (our lookups can't supply them, `references/lookups.md:9-23`);
  - trade links until WU-48;
  - a vendor search regex (deferred, §10).

Examples use run A's plan and record. The reward pick (`guide.md:184`), the entering-maps rung, the save row
(row 4) and the short line (row 5) are illustrative.

| # | Heading | Words | Holds | Example (Titan / Blood Hunt) |
|---|---|---|---|---|
| 1 | `## At a glance` | 150 | what the build does, its payoff, pros, cons, difficulty | "Blood Hunt lunges at a target, and on an enemy that has suffered Blood Loss it also sets off a 1.7-metre explosion. Atziri's Acuity makes 10% of your hits' physical damage cause Blood Loss, so in maps one button clears." |
| 2 | `## Your PoB file` | 120 | the import code (first fenced block), the file name; the loadouts as one ordered line, each with its trigger; that the items are stat examples; engine and boss-data versions, the offline line, PoB warnings | "Import the code below; each stage is a loadout at the top of PoB2: Act 1 Clearfell (L4) → Act 1 Ogham Manor (L15) → Act 2 Keth (L24) at 22, with Blood Hunt → … → Entering maps when the campaign is done → Endgame budget once you own Atziri's Acuity. The items are stat examples: match the affixes, not the item. Engine: PoB2 v0.23.1 (patch 0.5.4); boss data 0.5.5. Made offline, so no prices were checked." |
| 3 | `## Survival by stage` | 130 | a legend; one verdict per campaign group (Acts 1–2, Acts 3–4, the interludes and Epilogue); one line per endgame rung in G6's fixed form | "Acts 1–2, watch lightning: 38% at Keth after Act 2's −10%; take the Sisters of Garukhan's +10%." and "**Budget (L90): solid.** Resistances 75/75/75/75% at −60%. Max hit 3,498 physical against about 400, and at least 10,900 elemental or chaos against about 96. Blood Hunt about 20,700 DPS." |
| 4 | `## Gem and ascendancy timing` | 130 | a When / Change table: uncut-gem steps, trials and their nodes; optional hold rows (a gem kept at a lower level, or an investment delayed, with the reason) and save rows (what to stockpile before a swap) | "Level 22 and a level-7 uncut gem (Act 2 drops): Blood Hunt replaces Whirling Slash (needs 41 Dex)." and "Act 2: keep the first level-7 uncut gem for Blood Hunt at 22." |
| 5 | `## Priorities` | 180 | support, link, quality and stat priority; the weapon-swap rule of thumb; one "when you're short" line: what to drop first when spirit, mana or an attribute runs short, with the record's numbers | "My support order: Brutality, Rapid Attacks, Heavy Swing, Heft, then Physical Mastery." and "Short on mana before leech? I drop Physical Mastery first, then Heft." |
| 6 | `## Leveling` | 620 | one H3 per campaign stage (its loadout name), at most 110 words: setup, tree additions with reasons, attributes (have and need), gear targets (with a fallback where there is one), when to swap; a rotation clause when the stage's damage is a combo | `### Act 2 Keth (L24) {3}`: "At 22, swap Whirling Slash for Blood Hunt; Rake stays alone to open on rares. Dex 82, needs 41. Without mana leech I keep the mana flask going: packs cost about 6 mana a second more than you regain." |
| 7 | `## Campaign route and rewards` | 210 | reward quests in route order; each reward choice's pick with a reason; currency habits that serve this build | "Goddess of Justice, Act 4: take 30% increased Mana Recovery from Flasks. Vaal Pact switches your life flask off in maps." |
| 8 | `## Endgame: entering maps`, with `### Checks` | 250 | the gate in, changes from the Epilogue, a numbered buy order within 5 divines (each step with a short reason where it isn't obvious), fallbacks where there are any, checks (G5) | "Move here when the campaign is done and all four resistances are capped at −60%." |
| 9 | `## Endgame: budget`, with `### Checks` | 330 | the gate in, buy order (each step with a short reason where it isn't obvious), a slot table (slot, target, fallback: the affix to give up first, or empty), gems, tree with reasons, checks. A target names the affix's source when it limits the base ("Arcane Surge on Crit is desecrated, so the gloves need energy shield") | "Move here when you own Atziri's Acuity. Then buy 30% movement-speed boots with cold, lightning and chaos resistance." |
| 10 | `## Endgame: non-budget`, with `### Checks` | 180 | the gate in, the upgrade order, checks; affix sources as in §9 | "Upgrade first to a spear with +3 to melee skills." |
| 11 | `## How to play it` | 170 | clear and single target; the rolled skill as the main damage (D-122), and why when it isn't the clear skill (D-148); up to 4 trap bullets: interactions that break or kill the build, each one that item text, gem text or PoB confirms | "Bosses: Rake first so the target bleeds, then Blood Hunt, then Rake again once the Bleeding is consumed." and "**Trap:** Vaal Pact stops your life flask, so don't buy life-flask affixes after the switch." |
| 12 | `## What PoB can't show`, ending with `### Known issues` | 200 | each caveat once, by the figure it qualifies; the settings the headline figure assumes (charges, stacks, counts such as Trinity's resonance count), from the plan's config; Known issues hold the runner's sentences, outside the cap | "PoB has no switch for Blood Loss, so its explosion figure assumes every use explodes; I read it as a ceiling." and "The DPS averages Brutality's 20% chance to ignore physical damage reduction, and assumes the target isn't Bleeding." |
| 13 | `## FAQ` | 160 | 3–5 questions a player asks; up to 2 may be either/or picks, each with its deciding factor as a PoB damage or survival difference, plus the price difference when online | "**Why keep Life Regeneration under Vaal Pact?** It's the only path to Mysterious Lineage's 15% more maximum life." |
| 14 | `## Changelog` | 10 | dated entries | |
| | **Total** | **2,840** | cap 3,000 | |

**The endgame rungs.**
- Each rung's "Move here when" line appears once, at the top of its H2.
- Each `Checks` H3 holds what the verdict line doesn't:
  - the chaos exception, when there is one (D-234);
  - the budget line (D-219);
  - for `b` and `n`, the Arbiter of Divinity.

## 3. G2: the audit layer

**Where it lives.** `audit.md` is a separate file in the run folder, not an appendix to the guide.
- **Who writes it.** W1 writes it and patches it with Edit (D-257: the writer has Edit). The runner fills its
  `Known issues` table at step 14.
- **Why separate.** No human is expected to read it (`worklog.md:839-840`). The checker's cap and no-marker
  rule then apply to all of `guide.md`, with no boundary to parse.
- **Cost:** one more file in C-36 (the spine's table of which step writes which file), slice 03 §2 (the
  run-folder layout), W1's `writes` and SKILL.md steps 10 and 14.

| `audit.md` H2 | From run A's guide |
|---|---|
| `Hand calculations` | the ledger table (`guide.md:38-86`) |
| `Stage detail` | the per-loadout PoB numbers (`:100, :111, :123, :134, :146, :157`), the resistance table (`:274-283`), the mana and leech pairs, the Arbiter and mapping detail (`:225-226, :260-261`) |
| `What PoB doesn't model` | `mcp__pob2__check_model_coverage`'s flags and their handling (`:300-306`) |
| `Inputs by confidence` | the M and L inputs, and the claims needing an external source (`:308-309`) |
| `Run notes` | why this concept: the checkpoint-1 answer and its rule (`:22`); the D1 gate's budget totals and rates |
| `Known issues` | each open or accepted finding's id, its lens or gate, and the sentence the guide prints |

The guide's 297 source lines have no successor: the plan's claims carry the sources.

## 4. G3: claims and verification

### 4.1 The plan holds the facts

**Verified as today.**
- The `sources` lens verifies the D1 and D2 claims and the prices.
- The `ledger` lens verifies the ledger.
- The compiler produces the PoB record.

**What needs a claim.** The guide renders the plan, and W1 adds no fact or number
(`references/stages/W1.md:6-7`). A claim exists only for a fact the guide states or a gate needs.
- **No claim needed.** Gem levels, stage levels, record numbers, ledger values and prices are held already.
  The prose lens checks them directly.
- **A claim needed:**
  - the mechanics the build depends on (Blood Hunt's explosion on Blood Loss, Vaal Pact);
  - why a support, node or item is in or out;
  - requirements, gem and trial timing, and reward picks;
  - rules of thumb with a number, as D1 or D2 `judgment` claims;
  - traps (§11), each sourced to item text, gem text or the record;
  - an either/or pick's deciding factor (§13): the PoB difference and the comparison it came from;
  - an affix's source when it limits the base (§9, §10).
- **No claim needed for advice:** fallbacks, judgment triggers, drop orders and rotation clauses written in
  the first person. A number inside them is still a plan or record number.

### 4.2 The prose lens reads like an editor

It reads `guide.md` against the plan, the record and `audit.md`. It flags:
- a fact or number that isn't in the plan or record, contradicts it, or states it more strongly;
- first-person advice that asserts a fact the plan lacks ("I find every hit explodes");
- tutorial text (G4);
- a caveat repeated, or later stated as settled.

It doesn't flag a missing optional item: a fallback, a threshold trigger, a trap, an either/or pick, a hold or
save row, or a rotation clause.

It keeps today's checks of the gated statements: the rolled skill as the main damage (D-122, D-148), the
budget lines (D-164, D-219), the chaos line (D-234) and the offline line. It checks "why this concept" in
`audit.md`.

This is judgment, accepted as such: the user's direction is to verify what carries weight. The checker backs
it with one number check (G6).

**Claim rule 3 changes.** Amendment 1's S7 rule 3 puts a source's caveat "wherever the claim appears"
(`references/source-markers.md:75-77`; W1's "Keep every hedge", `references/stages/W1.md:128-131`). It
becomes: once in the guide, and never later stated as settled.

### 4.3 Claim counts

Of run A's 232 stage claims, 86 go outright: 77 restate a record number, 7 an act's resistance penalty and 2
the uncut-gem tier rule.

**Targets.**
- **D1: about 35–45 stage claims** across `m`, `b` and `n`: mechanics, gate lines, rules of thumb, traps,
  either/or picks and affix sources.
- **D2: about 40–50:** timing, requirements and tree reasons per stage, plus one claim per reward pick.
- **Ledger: about 30 entries,** down from 45: 15 reference hits, the Arbiter, and only the hand calculations
  the guide quotes.
- **Prices: about 30,** up from 21, with `m`'s slots.

That is about 135 checkable items instead of about 300.

### 4.4 Token effect

**Run A.** V4 used 37.6M of the run's 107.2M cache-read tokens (35.0%):
- the full pass used 19.7M: `sources` 8.2M, `prose` 7.2M, `ledger` 4.3M;
- the re-check used 17.9M: `sources` 9.8M, `prose` 5.6M, `ledger` 2.6M.

An agent's cache reads are its turns times its average context: 29–51 turns at 94K–196K tokens.

**Estimate.**
- **Full pass: about 9–11M.**
  - `sources`, about 3–4M: the plan only, about half the items, no markers.
  - `ledger`, about 3M: it loses its guide-number step (`references/stages/V4.md:119-121`).
  - `prose`, about 3–4M: a 2,850-word guide with no markers, plus an `audit.md` of about 25 KB, instead of
    a 96 KB guide.
- **Re-check: about 2–4M.**
  - In run A, 15 of the 21 unresolved `sources` findings and 4 of the 8 `prose` findings were missing
    citations or caveats on repeated text (`reports/v4-*.json`). This style removes that class.
  - D-264 already limits the re-check to changed claims. This part overlaps D-264's own estimate
    (`worklog.md:737-738`), so don't add the two.
- **V4 total: about 11–14M.**
- **W1:** from 10.0M to roughly 6–8M: a guide a quarter the length.
- **D1:** about +3–5M for the third rung, plus a compile per either/or pick it chooses to make.
- **Comparison-2 additions:** about 5–10 more claims, roughly +0.3M for `sources`, inside the estimate's
  range.

## 5. G4: not a tutorial

**The rule.** W1, D1 and D2 apply it, and the prose lens checks it. A sentence that explains how the game or
PoB works stays only when both of these hold:
- it names something this build uses, needs or avoids: its skill, supports, nodes, key items, an attribute
  or level requirement, or a plan number;
- it changes what the reader does with this build.

**The swap test.** If the sentence would read as true and useful, word for word, in a guide for another
skill on another class, cut it.

Campaign practicals are actions, not explanations, and they live in their own section.

| | Run A's guide | Why |
|---|---|---|
| Cut | `:95` "an uncut gem of level N cuts a skill of tier N or lower", cited 12 times (`:26`–`:151`) | The user's own example. Keep the consequence: "Blood Hunt needs a level-7 uncut gem" |
| Cut | `:161` "PoB counts each Book of Specialisation as 2 passive points toward the regular cap" | PoB bookkeeping; changes nothing the reader does |
| Cut | `:272` the penalty schedule, "-10% in Act 2, -20% in Act 3 … -60% in endgame areas" | True of every build; keep the gap it opens (lightning 38% at Keth). Also `:118` and `:207` |
| Kept | `:289` "Vaal Pact … stops all life recovery other than leech" | Why the endgame drops the life flask |
| Kept | `:30` "Bleed IV and Bloodlust are left out: their 30% more damage needs a Bleeding enemy" | Explains a support choice |
| Kept | `:290` Life Regeneration "is the only way from the Titan start to Mysterious Lineage" | Explains a node that looks dead under Vaal Pact |

## 6. G5: the entering-maps rung

**What it is.**
- A third endgame stage: id `m`, `variant: "entering-maps"`, loadout `Entering maps (L<level>) {m}`.
- It sits between the last campaign stage and `b`.
- It is the player's setup just after the campaign, plus buys within 5 divines.
- It fills AC-W22's gap, "no bridge from 62 to 90" (`worklog.md:711`). AC-W22 is the coordinator's review of
  whether a reader can follow the guide.

**Level and area.**
- **Level:** D1 sets it above the last campaign stage, with its basis (D-193: every endgame stage records why
  it has its level).
- **Area:** it covers waystone tiers 1–5 and is gated at T5, area level 69 (`waystones.json#area-level.offset`
  64, plus 5), with modifiers at the top of their range as for `b` and `n` (D-254: waystone-scaled reference
  hits).

**Gate.** The D1 gate checks `m` as it checks `b`:
- **The survival floor** (D-234): all four resistances capped at −60%, chaos only by a recorded exception,
  and max hit above all five reference hits.
- **The rolled skill as the main damage** (D-122).
- **The budget: 5 divines.** It passes at up to 5, and at up to 5.5 with "near the ceiling". That is D-219's
  pattern, which passes the budget variant at up to 20 and at up to 22 with the note. Offline, the budget is
  `unverified` (D-164: unavailable prices can't show a variant is under budget).
- `m` gets no Arbiter report and no mapping signals.

**D1 and D2.**
- D1 designs `m` after `b` and `n`: the cheapest setup that passes `m`'s gate with the same skill and supports.
  At 5 divines the key item may fit: a unique, or a rare with a stat floor (a weapon's elemental DPS, an energy
  shield total). When it doesn't, it is the gate into `b`.
- D1 orders `m`'s buys for the guide's numbered buy order (§8), with a short reason per step where it isn't
  obvious.
- D1 prices `m-<slot>` entries, adds the five hits `hit_m_<type>`, and writes claims for the gate lines and
  fallbacks.
- D2 plans the campaign backward to `m`.

**Schema.** `variant` gains `entering-maps` (`src/plan/schema.ts:217`); the PoB file gains its loadout
automatically, one per stage (D-103, D-215).

**Tree continuity.** Today each variant is its own track from the last campaign stage (A-P3,
`src/plan/checks/v1.ts:69-82`). It becomes one track: `m` from the last campaign stage, `b` from `m`, `n` from
`b`. V1, the compiler's check that each stage is valid at its level, then checks each rung's respec and gold
cost, which the "keep gold for the respec" advice rests on.

## 7. G6: deterministic guards

The checker:
1. **Word cap.** `guide.md` has at most 3,000 words, not counting the H1, the import code or the Known issues
   list.
2. **Headings.**
   - The H1 names the roll.
   - G1's H2s appear in order, with no others.
   - Leveling's H3s are the campaign loadout names, as now (`scripts/check-run.mjs:750-757`).
   - Each Endgame H2 has the H3 `Checks`.
   - `What PoB can't show` ends with the H3 `Known issues`.
   - `audit.md` has G2's H2s.
3. **No markers in `guide.md`:** no `[^`, no `confidence H|M|L`, and no finding id.
4. **Import code.** The import code equals the record's.
5. **One number check.** Each endgame rung has this fixed-form line in `Survival by stage`:

   ```
   - **<Entering maps|Budget|Non-budget> (L<level>): <solid|watch|risky>.** Resistances <fire>/<cold>/<lightning>/<chaos>% at −60%. Max hit <n> physical against about <hit>, and at least <n> elemental or chaos against about <hit>. <Skill> about <n> DPS.
   ```

   The checker finds the line by its label and compares each part with the record:

   | Part of the line | Compared with |
   |---|---|
   | the level | the stage's `level` |
   | the four resistances | `FireResist`, `ColdResist`, `LightningResist`, `ChaosResist` |
   | the physical max hit | `PhysicalMaximumHitTaken` |
   | the physical hit | the ledger value `hit_<stage>_physical` |
   | the other max hit | the least of the four other `<Type>MaximumHitTaken` |
   | the other hit | the largest of the four other `hit_<stage>_<type>` values |
   | the DPS | the rolled-skill figure the D1 gate's verdict names (`g1s1p2.TotalDPS`), read from the record |

   A written number matches when it equals the value's magnitude rounded at its own last significant digit:
   "2,740" matches 2,736, and "about 400" matches 401.996. The verdict word stays judgment.
6. **Kept checks.**
   - The offline line.
   - D-234's one-line chaos exception, in `Checks`.
   - D-219's "near the ceiling", in `Checks`, now for `m` too.
7. **Replacements for marker-based checks.**
   - **Reward picks, by name.** Each option the plan picks appears, by its first line, in
     `Campaign route and rewards`. This replaces `:1020-1031`.
   - **Known issues, by sentence.** Each open finding's reader sentence is a line of the guide's list, which
     has no other lines; its id is in `audit.md`. This replaces `:760-800`.

Everything else is judgment: the prose lens, then the user's review at checkpoint 2. The comparison-2
additions add no guard; the checker counts only their words, under the cap.

## 8. G7: what is superseded or changed

| Where | Change |
|---|---|
| D-105 (`README.md:405`, every claim shows its source) | The plan's claims show their sources, and the guide renders them without markers |
| C-30 (`README.md:180-195`, the source tag; "every claim in … the guide carries one") | The guide carries none. Markers stay in the dossier and research files |
| C-36 (`README.md:310-322`, which step writes which file) | W1 also writes `audit.md`, and D1 writes three endgame stages |
| D-116, D-117, D-147 (`:416-417, :447`, the variant targets); D-219 (`:513`, the budget tolerance) | Add the entering-maps target and its 5-divine ceiling |
| A-P3 (`02-plan-compiler.md:607`, each variant its own track) | One ladder track |
| Slice 03 §8 (`03-pipeline.md:459-477`, the guide's 13 required H2s) | Replaced by G1's 14 |
| Slice 03 §7.3 (`:420-428`, markers in markdown); §7.4's prose lens (`:453-455`) | §7.3 no longer covers `guide.md`. The prose lens is as G3 describes |
| Slice 03 §2 (`:66-79`, the run-folder table) | Adds `audit.md` |
| AC-W11 (`:837-838`, the template's H2s); AC-W22 (`:937-940`, the guide review) | AC-W11 takes G1's H2s; AC-W22 adds the style rules |
| Amendment 1 Q1 (`amendment-1-simplify.md:239`, where Known issues sit); S7 rule 3 (`:33`) | Known issues sit under `What PoB can't show`. A caveat appears once |
| D-265 (d) (`worklog.md:746-747`, a known issue with its id in parentheses) | The id moves to `audit.md` |
| D-256 (`references/stages/W1.md:92-93`, quote a hit at its ledger value, 438.55) | The guide rounds it ("about 440"). `audit.md` keeps the value |

## 9. G8: implementation impact

**Files.**

| File | Change |
|---|---|
| `templates/guide-template.md` | Rewritten to G1, with the fixed verdict lines. Its "why this concept" (`:38`), ledger table (`:44-48`) and Confidence (`:152-162`) go to `audit.md`, and Sources (`:168-192`) goes |
| `templates/audit-template.md` | New: G2's H2s |
| `references/stages/W1.md` | Renders the plan; the voice; the tutorial rule; each caveat once; the cap; writes both files; the ladder and stat-examples lines, the short line, the config assumptions, and the optional items (fallbacks and threshold triggers where they exist). Replaces rules 1, 6, 7 and 9 (`:48-49, :109-126`), "Keep every hedge" (`:128-131`) and Writes (`:150-155`) |
| `references/stages/V4.md` | The guide side of `sources` goes (`:145-154`), and so does `ledger` step 3 (`:119-121`). The prose lens becomes the editor (`:156-181`) and doesn't flag a missing optional item |
| `references/stages/D1.md` | The `m` rung (`:52-61`), its key-item gate and buy order, its hits and prices (`:109-145`), load-bearing claims (`:156-165`): traps, either/or picks (a compile each) and affix sources |
| `references/stages/D2.md` | Plans backward to `m` (`:34-38, :51-56`); load-bearing claims (`:87-92`); hold and save rows, rotation clauses, triggers |
| `pob-api/API/Lookup.lua`, `src/handlers/` lookup handler, `references/lookups.md` | A mod hit lists the base types that can roll it (non-zero spawn weights), and the essence table is searchable, so D1 can source an affix's limit on the base (§9) |
| `references/stages/D1-gate.md`, `references/gates.md` | `m`'s area level (`:66-68`) and budget (`:76-87`) |
| `references/source-markers.md` | Markers in the dossier and research only (`:35-63`); rule 3 (`:75-77`); Known issues by sentence (`:121-126`) |
| `SKILL.md` steps 10 and 14 (`:98, :102`); `references/run-folder.md:41`; `references/task-header.md` | Add `audit.md` |
| `scripts/check-run.mjs` | G6 and G5: heading constants (`:52-70`), `areaLevelOf` (`:298-302`), marker claims (`:550-571, :803`), sections (`:714-748`), Known issues (`:760-800`), reward picks (`:1020-1031`), budget (`:1711`) |
| `src/plan/schema.ts`, `src/plan/checks/v1.ts`, `docs/build-guide/plan-reference.md` | The `entering-maps` variant and the ladder track |

**Tests.**
- **`tests/static/buildGuidePipeline.test.ts`:** AC-W11 (`:726`) rewritten to G1; the marker and hedge tests
  (`:810, :884, :1054, :1137`) become editor-lens, caveat-once and tutorial wording; D-256 quoting (`:657`)
  moves to `audit.md`; reward picks by name (`:1284`); `m` in D1, D2 and the gates.
- **`tests/unit/buildGuideCheckRun.test.ts`:** Known issues by sentence plus the `audit.md` id (`:355`,
  `:505`); reward picks by name (`:1350`); the pick rule from `audit.md` (`:627`); new cases for the cap, a
  marker in the guide, a verdict line missing, wrong or mis-rounded, and `m`'s floor and budget (5 and 5.5).
- **`tests/fixtures/pipeline/run-ok` and `run-ok-online`:** a new-style `guide.md` plus `audit.md`.
- **`tests/unit/planChecks.test.ts`:** the ladder track and the variant value.
- **The lookup's engine tests:** a desecrated mod's base types (Arcane Surge on Crit: gloves with energy
  shield only, `ModVeiled.lua:163`) and an essence hit.

**Where the cost hides.**
1. **Markers carried three checks.** Two get G6's minimal replacements. The third, V4's comparison of
   guide numbers with the ledger and the record (`V4.md:119-121, :145-147`), becomes prose-lens judgment,
   except for the fixed verdict lines.
2. **Entering maps is more than an enum value.** The checker keys area level and budget on `'budget'`, the
   track change in `v1.ts` can move fixture verdicts, and D1 does a third design.
3. **Two rules cost us precision.**
   - D1.md:75-76 makes the headline figure the stat set the PoB file opens on. So the verdict line quotes PoB's
     explosion DPS, and its caveat stands once in `What PoB can't show`.
   - "Each caveat once" undoes S7 rule 3, which fixed run A's dropped caveats. Its replacement is judgment.

## 10. Open questions

The draft's four questions are answered in the status line.

**Q6, a vendor search regex: DEFERRED.** ronarray's guide gives a regex to paste into the vendor search
while leveling. The user notes the game's search takes regular expressions, and that community tools build
the shortest one for chosen mods. We could generate it from the plan's gear targets, and check it
deterministically against PoB's mod text.
- **Unblocked by:** grounding the game's supported regex syntax and length limit, from a source the user
  names.
- **Then decide:** whether the guide carries one regex per leveling band, and where (§6 or §7).
