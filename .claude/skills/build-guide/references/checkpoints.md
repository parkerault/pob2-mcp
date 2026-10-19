# Gates, questions and escalations

The runner stops for the user at three gates, one per phase (`brainstorm`, `verification` and `final`), at a
fourth inside the finalization, the design gate (`design`, D-362), and at two kinds of question (slice 03 §10,
§5.4, as amendments 1 to 7 change them; D-125, D-157, D-210, D-235, D-236, D-287, D-288, D-389). Every gate
visit and every escalation is an interview (below); the unsaved-build question stays a fixed question. In offline
test mode the test config answers instead (`offline-and-test.md`), and only there (A-28). Every answer is recorded in
the run log's `checkpoints[]` under the gate's or question's name (`answer`, `answeredBy`, and `rule` for a
pre-supplied or default answer; `run-log.md`).

**Every gate visit starts with its display** (D-265, D-367), at the brainstorm, verification, design and final
gates and at an escalation, whoever answers: run `node .claude/skills/build-guide/scripts/run-log.mjs <runFolder>
display <gate>` (`brainstorm`, `verification`, `design`, `final` or `escalation`). Its output is the display:
print it in your reply as it is, then resolve the answer (the interview, or the test config's) and log it with
`checkpoint`, which refuses a visit whose display wasn't printed. Each **Show** below is what it prints; it ends
by inviting questions and a decision in the user's own words.

## The interview (D-389 to D-391)

No gate uses AskUserQuestion: the user answers in free text.

1. **Questions first.** Answer each question, as many as the user asks, before anything is decided; when a
   message holds both, the answers come first. Your sources, cheapest first:
   - the display, the deck, the gate verdict files and your run log, and on demand the card files
     (`cards/<id>.md`) and research files (`research/`); never `plan.json`, a compile record, `dossier.md` or
     `guide.md`;
   - your lookups: `mcp__pob2__lookup_game_data`, `mcp__pob2__search_tree_nodes`, and
     `mcp__pob2__check_model_coverage` for whether PoB models a line;
   - a **gate question step**, stage `Q` (`stages/Q.md`), one per question or batch of related ones: a research
     question goes to a `build-guide-researcher`; one about a compiled build, or that needs a measurement, to a
     `build-guide-coordinator`. At the brainstorm gate nothing is compiled: a researcher gives a labelled
     estimate, or you offer to verify the card. Before starting one, say in one line what you start and why; don't ask first,
     but the user can say not to. Its report is `interviews/<gate>-<visit>-q<n>.md`, `n` from 1 per visit. Up to
     3 research steps run in parallel; a coordinator step runs alone. Log each as `{"stage": "Q", "attempt": 1,
     "outcome": "done"}`, and give the user its answer and its report's path.

   Say how you know, in the cards' status words: confirmed in game text, modelled in PoB, estimate (with its
   reason), or needs in-game testing. An answer that rests on nothing you looked up says so.
2. **The decision.** Map the user's words (a card by its name, a clear part of it, or its number) to the gate's
   fixed answer, with any revisions and new cards (below). Restate the decision in player terms, by the cards'
   names, saying which change is a revision and which a new card, and wait for a yes; ask about anything
   unclear. **A question is never a decision.**
3. **The record.** When the user asked questions, write the visit's notes with Write,
   `interviews/<gate>-<visit>.md` (the checkpoint's gate name; the display's visit):

   ```
   # Questions at the brainstorm gate, visit 1

   ## Q1: <the user's question, trimmed>

   Answer: <at most 3 lines, with its status words>

   Source: <a file | a lookup call | interviews/brainstorm-1-q1.md (a gate question step, build-guide-researcher)>
   ```

   Then log the checkpoint with `questions` (always, `0` too), and `changes`, `newCards` or `note`. Give the
   notes' path to the next step: R1a, R1b, D1-build or the revision's owner. W1 reads them for the FAQ.

**A revision or a new card** (D-391). Sort each change the user asks for, and the restatement says which:
- a **revision** keeps the card's identity (its class, ascendancy and named damage source) and the core of its
  chain, the loop that makes the damage. It adds or swaps supporting pieces (a support gem, an item, passives, a
  defensive layer), perhaps borrowed from another card ("with the djinn-buff card's Leer Cast");
- a **new card** is anything else: a different main skill, ascendancy or engine, another card's core mechanic,
  or two cards' ideas combined ("X from card A and Y from card B").

**When unsure, a new card**: it costs the same verification, and the cards it draws on stay intact. The user can
overrule your call either way.

- **Recorded:** a revision as `changes: {"<id>": "<the user's words>"}`, keyed by a card the answer picks; a new
  card as `newCards: [{"id": "r<k>-g-<n>", "name", "from": ["<id>"…], "words"}]`, `k` the latest brainstorm
  round and `n` the run's next gate-made card in it, `from` any cards `cards.md` lists. Propose its name, 2–4
  words no card of the run has, in the restatement; the user may change it before the yes. Picks and new cards
  together are 1–3; a pick of new cards only is `pick:` or `verify:` with no id.
- **A question that became an idea** can go into brainstorm more as its note; the next round's researchers get
  its answer file.

**A rival on request** (D-408). At any gate the user may ask for a rival: a researcher with fresh context looks
for a structure that clears faster. Start stage `RV` (`stages/RV.md`), not a gate question step, between the
display and the answer as a question step runs, with the run's own rival's prompt (the brief and its card id
`r<k>-x-<n>`), and log it `RV`. Relay its return: the card's name and its five pitch lines in the display's form,
or that it found no structure that clears faster, with what it tried. That visit's answer or a later one verifies
its card by id: `pick:` at the brainstorm gate (counted among the 1–3), `verify:` at the verification gate.

## The unsaved-build question (FR-W2 step 4; D-210)

Asked once, right after the run log's first write, when `mcp__pob2__guide_run {new_run}` replied
`loadedBuildUnsaved: true`. The run's first compile replaces the engine's loaded build, so:

- **proceed**: the run continues, and the loaded build's unsaved changes will be discarded;
- **stop**: the run ends `stopped`. Nothing has been compiled, and no research has started.

Say which build it is when the reply names it, and that the user can save it first (with
`mcp__pob2__lua_save_build`, outside this run) and start again. Recorded as checkpoint `unsaved-build`.
With a test config, `answers.unsavedBuild` answers it; with none there, the answer is `stop`
(`answeredBy: "default"`).

## The brainstorm gate: pick cards to verify

Shown after every brainstorm round's R1a-assemble (D-287). Recorded as checkpoint `brainstorm`.

- **Show** (`display brainstorm`, D-392) the brief in a line, the deck's header, every dealt card not verified
  yet by name, numbered, with its pitch, the "Not dealt" cards with their reasons, and the findings no card used;
  ids last, under "For reference". The deck's header names each engine with its count (D-405); the obvious card
  shows its `Obvious build:` line (D-403). A card whose damage source isn't a skill is marked "can't be finalized
  yet" (D-303); a minion skill is a skill (D-379); a card resting on an entry the PoB pin doesn't know says it
  waits on PoB (D-400). After a short round (D-339: fewer than 6 cards passed, the deck holds fewer than two
  under-played cards, or one engine filled it, D-405), say so, with the reason R1a-assemble gave, which the run
  log keeps as its `shortReason`.
- **Answers:**
  - **verify** 1–3 cards, picked (a not-dealt one included) and made at the gate together, any with a revision:
    `pick:<id>[,<id>…]`, with its `changes` and `newCards`. They go to R1b as a new verification round
    (SKILL.md step 3).
  - **brainstorm more** (D-235, D-287): a new brainstorm round with the user's note, `k` one more than the
    last. Only this answer, here or at the verification gate, starts a brainstorm round; the runner never
    starts one on its own. Recorded as `more`, with `note`.
  - **stop**: the run ends `stopped`.

## The verification gate: finalize one card

Renamed from checkpoint 1 (D-287). Shown after every verification round's R1b-assemble, and after a design
that was `infeasible` or an escalation sent the run back here. Recorded as checkpoint `verification`.

- **Show** (`display verification`) R1b-assemble's comparison, the dossier's table: one line per card verified in
  the run (every verification round, not only the last): its synergy, numbers from its skeleton's record (the
  named damage source's Count-scaled figure, `Life` and `TotalEHP`, D-294; a minion skill's figure its minion's
  `MinionTotalDPS`, D-378; the figure labelled `estimate` when its group's Count is above 1 or the stage is
  `computedWithCustomMods`, D-296), key prices (converted, as ranges with their league day, D-374; or
  `unavailable`), risks, what PoB can't verify, and its status: `viable`, `failed`, or "can't be finalized yet:
  its damage source isn't a skill" (D-303, D-334; from its R1b verdict's `not-a-skill` finding). A card whose R1b
  verdict's finding is `wrong-ascendancy` (D-342) is `failed`, shown with that reason: its ascendancy doesn't own
  the passive-tree node that grants its skill, the node the finding names. Each card's block leads with its
  skeleton's measured clear speed and movement speed, then its Bosses line, the boss floor (D-407); a card's
  `A stronger structure?` line, from its structure check, sits under it, and the user can make a new card from it
  (D-406). The rival's card is marked as the rival, and a rival that found nothing says so, with what it tried
  (D-408). A `not-in-pin` card is "can't be finalized yet: waits on the pin" (D-400); the rival's `not-dealt`
  card is `failed`. Give the dossier's path. After an `infeasible` design or an escalation, show that card's
  evidence: its last verdict file. With no viable card, show each failed card's last verdict and why it fails
  (D-141); a card that can't be finalized yet is listed with its status, never as a failure.
- **Answers:**
  - **finalize** (`pick:<id>`), with any revision as `changes`, which D1-build's first attempt takes as a
    finding, `code: "user-request"`: a failed card may be finalized anyway; a card whose damage source isn't a
    skill can't be yet (D-303), nor one that waits on the pin (D-400). A card whose R1b failed `wrong-ascendancy`
    can't be finalized at all, not even anyway: the build it describes can't exist (D-342). Refuse such an answer
    and ask again. A test config that pre-supplies one has given an illegal answer: the run ends `stopped`,
    recorded as answer `stop` with the test config's `pick:<id>` as its `rule`. The same holds for the rival's
    card that ended `not-dealt`: it was never dealt (D-408). The card's identity `{className, ascendancy, skill}`
    becomes the run's `roll` (D-286), and the design (steps 6 to 9) runs for it.
  - **verify other cards** (`verify:<id>[,<id>…]`, 1–3 cards from the deck not verified yet, with `changes` and
    `newCards` as at the brainstorm gate): a new verification round (step 3), without a brainstorm. A new card
    is verified before it can be finalized, at the next visit.
  - **brainstorm more** (`more`, with the user's note as `note`): a new brainstorm round (step 2a).
  - **stop**: the run ends `stopped`.

Every route back from the design comes here: an `infeasible` design (D-141), an escalation's option 3, the
design gate's `verification`, and FI-3.

## The design gate: judge the endgame build

A fourth user gate (D-362), after a passing D1 gate (or one whose escalation was accepted) and before D2, W1
and V4: the user judges the endgame build before the campaign's loadouts and the guide exist. Recorded as
checkpoint `design`. It runs between the D1 gate and D2 of the design (SKILL.md step 7b), never in the fix
round or a revision.

- **Show**, from the passing D1 gate's verdict file, its `design` field (A-35; `stages/D1-gate.md` step 6):
  you read no plan or record and call no tool for it; `display design` prints it. One block per endgame rung, in ladder order:

  ```
  Budget endgame (level 92):
  - Clear speed: fast (rough).
  - Movement speed: +25% over your base speed.
  - The Arbiter of Divinity: survives its hits (its worst, a physical hit, is 0.82 of your max hit).
  - Damage: 98,412 per second.
  - Effective HP: 31,250.
  - Anoint: Unbending: Ire, Guilt, Greed
  - Gear: Sekhema's Resolve; rare boots, 30% movement speed and resistances
  - Gems: Blood Hunt with Martial Tempo and Rupture; Herald of Blood
  - Passive tree: Brutal Fury and Crushing Impacts; the life and armour wheels by the Warrior start
  ```

  Clear speed and movement speed lead, then the boss floor (D-407). `m` shows no Arbiter and no anoint. Then the
  open estimates, one line each from `estimates[]`, the gate's verdict line, and the verdict file's path.
- **Answers:**
  - **accept**: on to D2 (step 8) and the guide.
  - **revise** (`revise:<text>`): a D1 fix round with the user's text as `findings` (`code: "user-request"`).
    A build change (gear, the tree, the gems or the config) runs D1-build with it, then D1-finish; a change to
    the anoint, the prices, the ledger or the claims runs D1-finish alone with it. Then the D1 gate, then this
    gate again. The revision counts against no retry cap; the D1 gate in it keeps its 2 counted retries. A
    change that isn't a revision of the finalized build (a new card, by the rule above) isn't a revise: say
    so, and offer **verification**. There the user's words carry into the restatement, as a new card whose
    `from` is the finalized card.
  - **verification**: back to the verification gate (step 5), to finalize another card.
  - **stop**: the run ends `stopped`.

## The final gate: the guide

Checkpoint 2, unchanged in what it asks. Shown after the run checker (step 15). Recorded as checkpoint `final`.

- **Show** (`display final`, which runs the run checker) the guide's and `audit.md`'s paths; the PoB file (the
  D2 gate verdict's `finalCompile.pobFile`); the gate verdicts; each endgame rung's figures from the final
  compile record, its DPS, EHP, Arbiter verdict with the worst ratio, and rough clear speed, with the design
  gate's beside them where they moved since (D-369); the known issues (the open V4 findings and the accepted
  gate findings); the run checker's result; each rung's total range at its price day against its target, and
  its over-target slots (the D1 gate's last verdict file, D-371, D-374); when any price is `unavailable`, that
  the rung's total isn't known (D-164); and in offline mode, that the guide is from an offline run.
- **Answers:**
  - **accept**: the run ends `completed`.
  - **changes** (D-236): a revision. The runner maps each request to the step that owns it, by the fix
    round's owners: the guide's text is W1's; an endgame stage of `plan.json`, its ledger entries and
    prices D1's; a campaign stage D2's. It runs that owner as the fix round does (SKILL.md step 12, D-264:
    claims in place, then W1; the owner's gates only after it recompiled: D1 → D1 gate → D2 gate → W1, D2 →
    D2 gate → W1) with the requests as `findings` (`code: "user-request"`), after the round copy to
    `rounds/<n>/`. Then the V4 re-check over what `check-run.mjs --changed <n>` lists and the known issues
    again, and it comes back here: **a revision runs no full pass** (D-352). A revision counts against no
    retry cap. The answer is recorded as `revise:<text>`. The final gate's `revise:` is for guide-level
    changes; a build change belongs at the design gate (D-362), though one asked here still runs through its
    owner.
  - **decline**: the user declines the guide, and the run ends `not-accepted`, with the user's note recorded as
    the answer.

## Escalations (D-127, D-141, D-236)

Only the D1 and D2 gates escalate: on the third counted failure of a compile, V1 or V2 (the D2 gate's
final compile included), and on a guided retry that fails again. Verification never escalates: what it
leaves open becomes a known issue. Record the escalation in `escalations[]` as `{stage, concept, verdict,
choice, guidance?}`, `verdict` the escalated attempt's verdict file, and the question as checkpoint
`escalation`. Show (`display escalation`) the stage, the attempts and the verdict file with its findings; after the
questions, the answers:

1. **accept**: the verdict's failing findings are accepted. A gate finding equal to an accepted one, **same
   plan stage, part and `code`**, fails no gate afterwards, whichever gate reports it: every later header's
   `accepted` carries them. The guide lists each under its H3 `Known issues` in "What PoB can't show", one
   line per finding: a plain sentence the reader can act on, with no id; `audit.md`'s `Known issues` table
   gives its row, with its `code`, its gate (`D1-gate` or `D2-gate`) and its plan stage (D-265, D-276); the
   run checker looks for them there. After the D1 gate the run goes on as if it passed;
   after the D2 gate, the D2 gate runs once more, uncounted, with them in `accepted`, so it runs the final
   compile. **Not offered when the failure is a compile error**: nothing compiled to continue from.
2. **guidance and one more retry**: the producer (D1 or D2) gets one more attempt with the verdict and the
   user's guidance in `findings`, then its gate. That attempt counts against no cap, and if the gate fails,
   whatever part fails, it escalates again.
3. **back to the verification gate** (choice `verification`, which replaces `checkpoint-1`, D-289), with the
   verdict file as that card's evidence.
4. **stop**: the run ends `escalated`.

With a test config, `answers.escalation[]` answers each escalation in turn; with none left, the answer is
`stop` (`answeredBy: "default"`), so the run ends `escalated`.

## Pre-supplied answers (offline test mode only; D-288, D-323)

| Question | Test config answer | Meaning |
|---|---|---|
| unsaved build | `answers.unsavedBuild`: `proceed` or `stop` | none given: `stop`, `default` |
| brainstorm gate | `answers.brainstorm[]`, one per visit: `pick:<id>[,<id>…]` (1–3 ids), `first-n:<n>`, `more` or `stop` | `first-n:<n>` (`n` 1–3) is the first `n` dealt cards in `cards.md` not verified yet, else `stop` |
| verification gate | `answers.verification[]`, one per visit: `first-viable`, `pick:<id>`, `verify:<id>[,<id>…]`, `more` or `stop` | `first-viable` is the first `viable` card not yet finalized in this run, else `stop`; a card that can't be finalized yet is never `viable` |
| design gate | `answers.design[]`, one per visit: `accept`, `revise:<text>`, `verification` or `stop` | none left: `stop`, `default`, rule `no design answer left: stop` (D-362) |
| final gate | `answers.final[]`, one per visit: `accept`, `not-accept` or `revise:<text>` | |
| escalation | `answers.escalation[]`, one per escalation: `accept`, `retry:<guidance>`, `verification` or `stop` | none left: `stop`, `default` |

`answers.checkpoint1` and `answers.checkpoint2` are retired with the run log's schema 3 (D-323): a test config
that holds them, or the escalation answer `checkpoint-1`, is malformed. An entry may be an object scripting an
interview (D-394, `offline-and-test.md`).

**A pre-supplied answer still prints the display** (D-265). The test config replaces only the question:
show everything the gate shows the user, then the answer it resolved to. At the brainstorm gate that is the
brief and the deck, on every visit. At the verification gate that is R1b-assemble's comparison lines, each
card's status and the dossier's path, on every visit; on a revisit after an `infeasible` design or an
escalation, that card's evidence (its last verdict file); with no viable card, each failed card's last
verdict. At
the design gate that is every rung's block and the open estimates from the D1 gate's verdict file, on every
visit. At the final gate and at an escalation, the same holds for their displays: `display <gate>` prints each, on every visit.

When the `brainstorm`, `verification`, `design` or `final` answers run out, the run ends `stopped` (recorded as answer
`stop`, `answeredBy: "default"`). Record a used answer with `answeredBy: "pre-supplied"` and the answer it
resolved to (`first-viable` → `pick:r1-a-2`, `first-n:2` → `pick:r1-a-1,r1-a-2`). Either way the entry's
`rule` keeps how the answer was reached: the test config's answer exactly as written
(`"rule": "first-viable"`), or the default that applied (`"rule": "no verification answer left: stop"`). The
guide's `audit.md` quotes the rule that finalized its card (`run-log.md`).
