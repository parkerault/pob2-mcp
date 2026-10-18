# Amendment 7: gates as interviews

**Status: APPROVED by the user, 2026-10-18** ("Amendment 7 looks good, I accept the recommendations"), with §15's
recommended option in each choice. Drafted 2026-10-18; §4's new-card rule added the same day at the user's request.
It folds in the user's feedback from the Varashta baseline run
(`../studies/2026-10-17-varashta-run-feedback.md`, "the feedback study"), as the user asked on 2026-10-17: one
amendment for all of it. It also carries the gate lessons of the comparison with Navira's guide
(`../studies/2026-10-17-varashta-comparison.md`, "the comparison", §6 and §7) and one decision the defect batch left
open. The coordinator folds it into the spine and slice 03 with amendments 5 and 6 and D-381…D-388 at v1.6. Paths
without a directory are under `.claude/skills/build-guide/`.

**Names.** A *gate* is one of the four points where the run stops for the user: the brainstorm gate (pick cards to
verify), the verification gate (finalize one card), the design gate (judge the endgame build) and the final gate (the
guide). An *escalation* is the question the D1 and D2 gates ask after repeated failures. A *visit* is one stop at a
gate. The *runner* is the user's session following `SKILL.md`. A *card* is one candidate build (`cards/<id>.md`); the
*deck* is `cards.md`. A gate's *display* is what `run-log.mjs display <gate>` prints at the start of a visit (D-367).

## 1. The user's direction

- **Gates are a pitch.** "This step is a pitch, so tell the user why they might want to pick it." The brainstorm
  gate's one-line cards "leave a lot to be desired. A human looking at this wall of text is going to have more
  questions than answers."
- **"This one, but…"** "When I first encountered it, what I really wanted wasn't 'this one', it was 'this one,
  but...'."
- **A new card for a new idea** (2026-10-18). Asked whether "I like mechanic X from card A and mechanic Y from card
  B" would go back to the brainstorm, the user agreed to a "new card for change requests that aren't a
  straightforward revision of an existing card".
- **An interview, not a multiple choice.** "I'm fairly certain that the user is going to have questions 99% of the
  time. The cards are abstracting away an ocean of gameplay mechanics … If it makes testing more complex, I'd rather
  sacrifice that than good UX."
- **Legacy gems.** "Anything marked 'legacy' isn't allowed in the build."
- **How players judge a build** (2026-10-18, on the comparison): by damage and screen clear, "how quickly it can
  clear screens of enemies, which is a combination of damage, AoE, and how fast the player can move from pack to
  pack". Bosses are under 5% of play time, and more damage solves them anyway.

**What the run showed:**

- **The build's engine came from the user's question at the brainstorm gate.** The question was "investigate
  whether Unholy Might + cast on minion death could create an engine for creating frozen ground" (`dossier.md:3`).
  The gate could only carry it as a note into a whole new brainstorm round.
- **The design gate's question was answered by the plan's own note.** The question was whether the designer
  measured Skeletal Cleric. The plan's note `b-cleric` held the answer, but the gate had no route to it (feedback
  study §4).
- **The final gate's display was pipeline jargon:** "compiled pass, v1 pass, v2 pass, floor pass, budget
  unverified" (feedback study §5.1).

## 2. D-389: every gate is an interview

**A visit runs like this:**

1. **The display.** The runner prints it, as now (D-265, D-367), then one line inviting questions and a decision in
   the user's own words. Gates no longer use AskUserQuestion; the user answers in free text. The unsaved-build
   question stays a fixed question.
2. **Questions.** The runner answers each one (D-390), as many as the user asks, before anything is chosen. When a
   message holds both questions and a decision, the answers come first.
3. **The decision.** The runner maps the user's words to the gate's fixed answer, as today: `pick:<id>…`, `more`,
   `stop`, `accept`, `revise:<text>` and the rest. It adds any revisions and new cards (D-391), restates the
   decision in player terms with the cards' names, and waits for a yes. Anything unclear, it asks about.
4. **The record.** The checkpoint entry is as now, plus:
   - `questions`: how many the user asked;
   - `changes` and `newCards` (D-391), or `note` for a brainstorm-more answer;
   - the visit's interview notes.

**The interview notes.** `interviews/<gate>-<visit>.md` is written by the runner with Write. Each question gets:
- the user's question, trimmed;
- the answer, in at most three lines;
- its source: a file, a lookup, or a gate question step's report (D-390).

**Who reads them:**
- **The next step after the gate** gets the notes' path: R1a for a new round, R1b, D1-build, or the revision's owner.
- **W1's FAQ** answers the user's gate questions that a reader of the guide would ask too. The run's Skeletal Cleric
  question was one, and its guide answered it.

**Escalations take questions too.** Their four choices are unchanged.

**A question is never a decision.** The final gate's "any other answer ends the run `not-accepted`" becomes "the user
declines the guide".

**What doesn't change:** each gate's routes, that only the user starts a brainstorm round, and that `stop` ends the
run.

## 3. D-390: how the runner answers a question

The runner uses these sources, cheapest first.

1. **What it may read at a gate:**
   - the display, the deck, the gate verdict files and its run log, as now;
   - **new:** the card files and the research files, read on demand for a question.

   It still never reads `plan.json`, a compile record, `dossier.md` or `guide.md`. They can be large: one final
   record was 268 KB (amendment 1).
2. **Its lookup tools:** `lookup_game_data` and `search_tree_nodes`, as now. **New:** `check_model_coverage`, so it can
   say whether PoB models a line.
3. **A gate question step** (stage `Q`, a new `stages/Q.md`). One agent per question, or per batch of related
   questions:
   - **A research question** ("can Unholy Might and Cast on Minion Death make a ground engine?") goes to a
     `build-guide-researcher`. It uses the lookups, and the web in an online run.
   - **A question about a compiled build, or one that needs a measurement** ("would Skeletal Cleric help?"), goes
     to a `build-guide-coordinator`. It reads the plan, the records and the dossier. It may compile a variant under
     `probes/q-<gate>-<visit>-<n>/`. It never edits `plan.json`, a concept plan or a card.
   - **What it writes:** `interviews/<gate>-<visit>-q<n>.md`. It returns at most 8 lines. The runner gives the user
     the answer and the file's path, and logs the step in `stages[]` as stage `Q`.
   - **Before starting one,** the runner says in one line what it is starting and why. It doesn't ask first, but the
     user can say not to. Research steps may run up to 3 in parallel. A coordinator step runs alone, as every
     coordinator step does (FR-W3).

**The evidence rules.** A gate answer uses the cards' status words: confirmed in game text, modelled in PoB, estimate
(with its reason), or needs in-game testing. The runner says which applies. An answer that rests on nothing it looked
up says so. The user's point stands: the bare tools are spotty, and a confident wrong answer is worse than none.

**A question that turns into an idea.** The user can take it into "brainstorm more" with the answer as the note. The
next round's researchers get the answer file, so the idea starts from what the gate already found. The comparison's
lesson (§6) was that such a question should be answered at the gate, not only carried as a note.

## 4. D-391: a choice can carry changes, or make a new card

**A revision or a new card.** The runner sorts each change the user asks for into one of two kinds, and its
restatement says which (the user, 2026-10-18: a new card "for change requests that aren't a straightforward revision
of an existing card").

- **A revision** keeps the card's identity: its class, ascendancy and named damage source (the card's Identity
  section), and the core of its chain, the loop that makes the damage. It adds or swaps supporting pieces: a support
  gem, an item, passives, a defensive layer. It may borrow one from another card, as in "with the djinn-buff card's
  Leer Cast".
- **A new card** is anything else:
  - a different main skill, ascendancy or engine;
  - another card's core mechanic;
  - two cards' ideas combined, as in "I like X from card A and Y from card B".
- **When unsure, a new card.** It costs the same verification as a revision, and the cards it draws on stay intact.
  The user can overrule the runner's call either way.

**At the brainstorm gate:**

- **A revision** rides on a pick: `changes: {"<id>": "<the user's words>"}`.
  - R1b handles it before it builds the skeleton. Its header carries the card's `changes`. It first revises the
    card's brainstorm half:
    - it adds `- Changed at the gate (visit <n>): <the user's words>` under Pitch;
    - it makes the edits;
    - it re-checks the links the change touches, and any new ones.
  - The card keeps its id and its name. A change that breaks the card fails it, with the reason, as any R1b failure
    does.
- **A new card** is made and verified in the same round, with no brainstorm round:
  `newCards: [{"id", "name", "from": ["<id>"…], "words"}]`.
  - **Its id** is `r<k>-g-<n>`: `k` is the latest brainstorm round, `g` marks a card made at the gate, and `n`
    counts the run's gate-made cards in that round. The letters `a` to `c` stay the researchers' (D-319).
  - **Its name** is proposed by the runner in its restatement. The user can change it before confirming. After that
    it is fixed, as every name is (D-392).
  - **It counts toward the pick's 1–3 cards.**
  - **R1b writes its brainstorm half first,** from the user's words, the cards it draws on and their research files:
    - an Identity, a Pitch and a Chain, like any card;
    - `- Made at the gate (visit <n>): from <name> and <name>: <the user's words>` under Pitch;
    - every link checked with the lookups, since all of them are new.

    Then it verifies the card as usual. A card that doesn't hold together fails, with the reason.
  - **R1b-assemble adds its line to the deck,** under round `k`, marked "made at the gate".
  - **The cards it draws on stay in the deck** unchanged, still open to a pick.

**At the verification gate:**

- **A revision** may ride on the finalized card. D1-build's first attempt gets it as findings, with code
  `user-request`, as the design gate's revisions do.
- **A new card** can't be finalized before it is verified. It goes to a verification round, as "verify other cards"
  does, and the user finalizes it at the next visit.

**At the design gate,** `revise:<text>` already carries the user's words. A revise that isn't a revision of the
finalized build isn't a revise. The runner says so and offers the gate's existing route back to the verification
gate, where it becomes a new card.

**The final gate is unchanged.**
- **A brainstorm-more note** is now recorded in the checkpoint's `note`. Today R1a gets it but the log doesn't keep it,
  and a test config's `more` can't carry one.

## 5. D-392: cards are pitches, and every display speaks plainly

**Card names:**

- **Every card has a name,** 2–4 words, a player's name for the build ("Skeleton Death Engine").
  - R1a proposes it; for a card made at the gate, the runner does (D-391).
  - R1a-assemble keeps names unique in the run. On a clash, it renames the newer card. The runner proposes no name
    the deck already holds.
  - A name never changes and is never reused.
- **Displays show names, never ids.** Ids stay in the run log and the files.
- **The user may refer to a card** by its name, a clear part of it, or its number in the display. The runner's
  restatement uses the name.

**The card's Pitch** (`templates/card-template.md`) replaces Title and the two free lines with:

- **Name.**
- **Why pick it:** the hook in player terms, at most two sentences.
- **How it clears:** how a pack dies, which buttons the player presses, and how fast it moves between packs. Players
  judge a build by clear speed, which is damage, area and pace (the user, 2026-10-18).
- **Bosses:** its answer to one tough enemy, in a sentence. This is a minimum check, not the judge.
- **Needs:**
  - the key items, gems and passives;
  - when the build comes online (level or act);
  - a respec, if it takes one;
  - a rough cost, when known.
- **The catch:** the main risk or cost, in a sentence.
- **Under-played,** as now (D-339), shown as "Unusual: <why few builds do this>".

The playstyle tags stay in the card for matching the brief's vocabulary. Displays don't show them.

**The deck's header** (`cards.md`, written by R1a-assemble):

- **What the cards share:** the common core once, in player terms, in at most 80 words. Each card then shows only what
  it adds.
- **How they differ:** one line on the deck's shape, such as "five of eight are one loop with a different add-on".
- **Found, not used:** up to five strong research findings that no card uses, each with its reason (the comparison,
  §7.2 item 10). Muster with a +4 sceptre would have been one.
- **Not dealt:** each card with its reason, in plain words.

**Confidence in plain words, only where it differs** (feedback study §1):
- "Not confirmed in game" is the deck's default, said once in the header.
- No line repeats "links confirmed n of m" or "no player evidence".
- A card whose load-bearing link isn't confirmed says which link, and what it would change.

**Every display leads with plain words.** Codes, ids and verdict paths come last, under "For reference".

| Gate | The display |
|---|---|
| Brainstorm | the brief in a line, the deck's header, each card's pitch, numbered, the not-dealt cards, the found-not-used list, and the invitation |
| Verification | each verified card by name, with: its pitch's "why"; figures with units and what they're measured against (damage against map monsters, effective HP); rough clear speed; key prices; the catch, confirmed or new; its status in words ("works", "failed: <why>", "can't be built yet: <why>") |
| Design | each endgame rung's block, every figure with its unit and what it means |
| Final | plain sentences in place of the check list: what was checked, what passed, what's open |
| Escalation | what failed and why in a sentence, then the attempts and findings for reference |

## 6. D-393: a seed card from a build the user names

- **Naming a reference.** The brief or a brainstorm-more note may name a reference build the user picked: a guide
  page, a video, or a PoB file. The run reads only what the user named.
- **The seed card.** The next round gives one researcher the reference. It writes one card from it:
  - the card is marked `Seed: <the reference>`;
  - it has its chain, links and pitch like any card;
  - the lookups confirm the links;
  - the reference is its evidence, as "players use it (the user's reference)".

  R1b verifies it like any card.
- **In an offline run,** the reference must be a local file.
- **Why:** starting from an expert's build is the cheapest way out of our own local maximum (the comparison §7.1–7.2).
  It is also the feedback study's user who customises a community build (§3).

## 7. D-394: the test config scripts an interview

- **An answer entry** in `answers.brainstorm`, `verification`, `design`, `final` or `escalation` is either a string,
  as now, or an object:

  ```json
  { "ask": ["Which card clears fastest?", "Could skeleton deaths make the ground?"],
    "answer": "pick:r1-a-1,r1-b-1",
    "changes": { "r1-a-1": "use a sceptre for minion levels" } }
  ```

  `note` goes with `more`. A new card is scripted as
  `"newCards": [{ "name": "Frozen Djinn Army", "from": ["r1-a-1", "r1-b-2"], "words": "…" }]`, with a brainstorm
  `pick:` or a verification `verify:`. The runner assigns its id. The config says which kind each change is, so a
  test run never depends on the runner's call.
- **How the runner uses it.** It answers each `ask` as it would the user's, gate question steps included, and writes
  the interview notes. Then it takes `answer`, with no confirmation. The display rule holds (D-265).
- **These entries are malformed:**
  - `changes` naming a card the answer doesn't pick;
  - `newCards` with any other answer, `from` naming a card the deck doesn't hold, or a name the deck already holds;
  - picks and new cards together over 3;
  - `note` without `more`;
  - an empty question.

## 8. D-395: legacy means not in the game

- **The rule.** A gem PoB marks legacy isn't in the game, and neither is a unique PoB says is no longer obtainable.
  No build uses either.
- **The server already enforces it.** Since D-384, the lookups leave them out and name them, and `compile_plan`
  refuses them.
- **The skill states the rule** in one line in `SKILL.md`'s hard rules and in `references/lookups.md`. Then an agent
  that finds one some other way drops it, instead of keeping it as a risk. In the run, two R1b agents read PoB's
  files, found Commandment's flag, and did exactly that: they kept the gem and noted a risk (feedback study §2.1).
- **`Tier = 0` isn't legacy.** Granted skills have it too, Powered by Verisium among them.

## 9. D-396: no dead gems in a loadout

- **The rule.** Every gem in a stage's loadout does something at that stage. A gem whose condition the stage can't
  meet stays out, with the reason in the stage's notes.
- **The run's case** (feedback study §5): Minion Pact on Frost Bomb at the level 58, level 65 and entering-maps
  stages. There the player's life is above a skeleton's, so it can't drain one.
- **D1-build and D2 apply it.**

## 10. D-397: a plain summon's figure is its minion's

- **The open item from the defect batch.**
  - D-378 reads a group's damage figure as `MinionTotalDPS` when the group names a minion skill, and as `TotalDPS`
    otherwise.
  - A plain summon such as Skeletal Warrior names none. So when it is the main group, the headline would read 0.
  - The checker already reads such a group by its minion (D-385), and so does `get_passive_upgrades` (D-388).
- **The rule becomes:** a group's figure is `MinionTotalDPS` when it names a minion skill, or when its skill summons
  a minion. "Summons a minion" means its `skillOutputs` entry carries `Minion<Field>` fields, which is the checker's
  D-385 test. Otherwise the figure is `TotalDPS`.
- **It reaches:**
  - the headline (`measures.dps`);
  - the key-figure line, `DPS <n> (Skeletal Warrior, minion)`;
  - the rolled figure;
  - the verification display;
  - the checker and the renderer.
- **One test changes with it:** the `planMeasures` D-378 test, which asserts `TotalDPS` for such a main group.

## 11. Where the rest of the feedback went

| The feedback (study section) | Where it went |
|---|---|
| The brainstorm display, pitches, "this one, but…", interviews (§1) | D-389 to D-392 |
| Legacy gems (§2.1) | D-384, the server (done); D-395 |
| Powered by Verisium missed (§2.2) | the engine-lens amendment: the supply search |
| The tool's users, the skill split (§3) | a short design doc after this amendment |
| The Oracle-only nodes (§4) | D-383 (done) |
| The Skeletal Cleric question (§4) | answered by the plan's note; D-390 makes that the normal path |
| The checker's rolled-skill violations (§5) | D-385 (done) |
| The trade site's 429 (§5.1, item 5) | the trade-429 item, later |
| The runner's gap list (§5.1): items 1–4, 6 and 7 | D-383 to D-388 (done) |
| At your Command, Muster's count (§5.1, item 8) | PG-52, PG-53 (done) |
| Minion Pact dead before the budget variant (§5.1) | D-396 |
| The final gate's jargon (§5.1) | D-392 |
| The comparison: the gate question researched at the gate (§6) | D-390 |
| The comparison: the pitch's clear, boss answer, cost, respec (§6, §7) | D-392 |
| The comparison: a seed card, the found-not-used list (§7.2, items 2 and 10) | D-393, D-392 |
| The deck's low variety, five of eight on one loop (§1) | the engine-lens amendment; this one only shows it (the deck's header) |

## 12. What changes

| Was | Becomes |
|---|---|
| A gate asks a multiple choice with AskUserQuestion | an interview: questions answered first, the decision in the user's words, restated and confirmed (D-389) |
| The runner can't answer a question about the build | it reads cards and research, looks things up, or starts a gate question step (D-390) |
| A pick is card ids only | a pick can carry a revision, or make a new card from the user's words and the cards it draws on, verified in the same round (D-391) |
| Combining two cards' ideas needs a whole brainstorm round | a new card, made by R1b (D-391) |
| Cards show an id, a title and unlabelled tags | a named pitch: why, how it clears, bosses, needs, the catch (D-392) |
| The deck repeats its shared core on every line | a header with the shared core, the deck's shape, and findings no card used (D-392) |
| The final gate lists pass/fail codes | plain sentences, codes last (D-392) |
| Only the run's own research makes cards | a reference the user names makes a seed card (D-393) |
| A test config answers with a fixed string | a string, or a scripted interview (D-394) |
| Nothing in the skill says what legacy means | legacy means not in the game (D-395) |
| A loadout can carry a gem that does nothing there | it can't (D-396) |
| A plain summon's headline reads `TotalDPS`, which is 0 | its minion's figure (D-397) |

## 13. Work units

| Unit | Slice | What | Depends on | Risk |
|---|---|---|---|---|
| WU-80 | 02 | A plain summon's figure (D-397): `figureField`, the key-figure line, the record's tests | — | low |
| WU-81 | 03 | The scripts: `run-log.mjs` (the checkpoint's `questions`, `changes`, `newCards` and `note`; the test config's object entries; every display rewritten, D-392), `check-run.mjs` (the interview checks; the card id takes the letter `g`; gate-made cards in the deck check), fixtures | — | medium: every display changes |
| WU-82 | 03 | The skill text: `SKILL.md`, `checkpoints.md`, `offline-and-test.md`, `run-log.md`, `run-folder.md`, `task-header.md` (stage `Q`), a new `stages/Q.md`, the card template, R1a, R1a-assemble, R1b, R1b-assemble, D1-build, D2, W1, `lookups.md` | WU-81 | medium: many files |

WU-80 runs beside WU-81; WU-82 follows WU-81, whose formats it describes.

**Acceptance criteria:**

- **AC-P70 (WU-80, D-397).** Engine. A plan whose main group is Skeletal Warrior, with no `minionSkill`, compiles:
  - `measures.dps` equals the main entry's `MinionTotalDPS` × its Count, and is above 0;
  - the key-figure line reads `(Skeletal Warrior, minion)`;
  - a group whose skill is the player's keeps `TotalDPS`.
- **AC-W67 (WU-81, D-392).** Script unit, on a fixture run in the new card format.
  - **`display brainstorm`** prints every dealt card's name and its five pitch lines, numbered. It prints the
    deck's header once, then the not-dealt reasons and the found-not-used list. It prints no card id outside "For
    reference", and none of "links confirmed", "no player evidence" or a bare tag list.
  - **`display final` and `display design`** print none of "compiled pass", "v1 pass", "v2 pass" or "floor pass"
    outside "For reference", and still print every figure they print today.
- **AC-W68 (WU-81, D-389, D-391, D-394).** Script unit.
  - **`run-log.mjs` accepts** a checkpoint with `questions`, `changes` keyed by picked ids, `newCards` with ids
    `r<k>-g-<n>`, and `note` with `more`.
  - **It refuses** `changes` naming an unpicked card, `newCards` whose `from` names a card the deck doesn't hold,
    picks and new cards over 3, and `note` on any other answer.
  - **The test config** accepts object entries and refuses the malformed ones (D-394).
  - **The checker passes** a fixture run whose checkpoint counts 2 questions and whose `interviews/brainstorm-1.md`
    holds 2, and which holds one gate-made card with its deck line.
  - **The checker fails:**
    - a count that differs from the notes;
    - a changed pick whose card lacks its "Changed at the gate" line;
    - a gate-made card without its "Made at the gate" line or its line in the deck.
- **AC-W69 (WU-82, D-389 to D-396).** Static.
  - `SKILL.md` and `checkpoints.md`: every gate and escalation takes questions before the decision; the runner's
    sources and its one-line notice before a gate question step; no AskUserQuestion at a gate.
  - `stages/Q.md` exists, with its two agent types, its writes, and its rule that it edits no plan and no card.
  - The card template carries Name, Why pick it, How it clears, Bosses, Needs and The catch.
  - **These files carry their new rules:**
    - R1a-assemble: the header, the found-not-used list and unique names;
    - R1b: the gate's revisions, and writing a gate-made card's brainstorm half;
    - R1b-assemble: a gate-made card's deck line;
    - `checkpoints.md`: what is a revision and what is a new card, "when unsure, a new card", and the design
      gate's revise that isn't one;
    - D1-build: the verification gate's changes, and dead gems;
    - D2: dead gems;
    - W1: the interview notes in the FAQ;
    - `lookups.md` and `SKILL.md`: legacy;
    - `offline-and-test.md`: object answers.

**The live check is the next run.** An interview can't be judged by a fixture. The next online run (the live alpha)
is where the user judges the gates. Its feedback goes into a study like this one.

## 14. Risks

- **The runner's context grows with each question.** Two things bound it: the runner reads only cards and research
  itself, and everything about plans and records goes through a gate question step, whose return is 8 lines.
- **A wrong answer at a gate steers the build.** The evidence rules (D-390) make the runner say how it knows. A
  measurement goes to the coordinator, which compiles rather than guesses.
- **Test runs cost more.** A scripted question that starts a gate question step adds an agent to an offline run. The
  user accepted that ("I'd rather sacrifice that than good UX").
- **A change can break a card.** R1b re-checks the touched links and fails the card with the reason, so the user
  learns why at the verification gate.
- **The runner can misjudge a revision for a new card, or the reverse.** Its restatement says which it chose, and the
  user can overrule. When unsure it makes a new card, so the worst case is an extra card, never a lost one.
- **A gate-made card skips the brainstorm round's checks.** No assemble step compares it with the deck before R1b.
  R1b checks every link itself, so a weak card fails at verification rather than slipping through.
- **Names can mislead.** A name is a label, not a claim. The pitch under it carries the claims, and those are
  checked.
- **The seed card's build may be heavy.** A guide author's build can run about eight minion types. On Navira's PoB,
  the engine's snapshot after a change timed out (the comparison §6, the server). That fix is in the next server
  batch; until then, a seed card that heavy may fail its R1b compile.

## 15. Choices for the user's review

These are the decisions with a real alternative. The draft takes the first option in each.

**The user's answer (2026-10-18):** the recommendations, the first option in each.

1. **The runner restates the decision and waits for a yes**, which costs one more reply per gate. The alternative is
   to act at once, and say what it did. A pick with changes is easy to misread, so the draft confirms.
2. **The runner starts a gate question step after a one-line notice, without asking.** The alternative is to ask
   first. The user's point was that the alternative to an answer is the user researching it themselves.
3. **The runner reads cards and research files itself.** The alternative is a gate question step for every question,
   which is slower but keeps the runner's context smallest.
4. **The seed card is in this amendment.** The alternative is to move it to the skill split's start-from-a-PoB path,
   where a PoB-to-plan tool would make it stronger.
