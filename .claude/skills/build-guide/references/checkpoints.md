# Gates, questions and escalations

The runner stops for the user at three gates, one per phase (`brainstorm`, `verification` and `final`), at a
fourth inside the finalization, the design gate (`design`, D-362), and at two kinds of question (slice 03 §10,
§5.4, as amendments 1 to 9 change them; D-125, D-157, D-210, D-235, D-236, D-287, D-288, D-389, D-411). The
verification gate finalizes 1 to 3 cards, and each becomes a **build** (D-411, D-412): the design and final gates
are a build's, visited once per build in turn, and their checkpoints name it (`concept`, the card id). Every gate
visit and every escalation is an interview (below); the unsaved-build question stays a fixed question. In offline
test mode the test config answers instead (`offline-and-test.md`), and only there (A-28). Every answer is recorded in
the run log's `checkpoints[]` under the gate's or question's name (`answer`, `answeredBy`, and `rule` for a
pre-supplied or default answer; `run-log.md`).

**Every gate visit starts with its display** (D-265, D-367), at the brainstorm, verification, design and final
gates and at an escalation, whoever answers: run `node .claude/skills/build-guide/scripts/run-log.mjs <runFolder>
display <gate>` (`brainstorm`, `verification`, `design`, `final` or `escalation`; the design and final gates
`display design --build <id>` and `display final --build <id>`, the build at the gate). Its output is the display:
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
   unclear. **A question is never a decision.** The restated decision goes into the notes before you ask for the
   yes (step 3).
3. **The record, as you go** (D-389, D-420). A compaction can come while the run waits at a gate, and it keeps
   no reference and only part of `SKILL.md`, so the visit's notes are written during the interview, never only at
   the decision: `interviews/<gate>-<visit>.md` (the checkpoint's gate name; the display's visit), with Write the
   first time and Edit after.
   - **Interview notes after each answer:** write each question's section as soon as you have answered it, before
     the next message.
   - **`## Pending decision` before a yes:** before you ask the user to confirm, write the restated decision under
     the H2 `## Pending decision`, with the user's words verbatim: a revision's `changes` (`"<id>": "<the user's
     words>"`), a new card's proposed name and id with its `from` and the user's words, a brainstorm-more note.
     Write the file at a visit with no questions too when a decision is pending; replace the section whole when the
     decision changes before the yes. The run checker exempts it from its question rules and from the count.

   ```
   # Questions at the brainstorm gate, visit 1

   ## Q1: <the user's question, trimmed>

   Answer: <at most 3 lines, with its status words>

   Source: <a file | a lookup call | interviews/brainstorm-1-q1.md (a gate question step, build-guide-researcher)>

   ## Pending decision

   Verify Blood Hunt Slam (r1-a-1) and a new card, Bleeding Shield Wall (r1-g-1, from r1-a-1 and r1-c-2).
   changes: r1-a-1 "use a two-handed spear"
   new card r1-g-1 "Bleeding Shield Wall", from r1-a-1, r1-c-2: "the lunge behind a shield"
   ```

   On the yes, log the checkpoint **from the notes**: `questions` (always, `0` too: the `Q<n>` sections, the
   pending decision not counted), and `changes`, `newCards` or `note` as the pending decision holds them. A yes the
   notes don't hold isn't one (after a compaction, restate and ask again). Give the notes' path to the next step:
   R1a, R1b, D1-build or the revision's owner. W1 reads them for the FAQ.

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
  together are 1–3; a pick of new cards only is `pick:` or `verify:` with no id. In a run that composes (D-432),
  `from` may also name piece keys, a `### Pieces` row's or an Ideas line's, and a composite's `changes` may add or
  drop pieces (the brainstorm gate, below).
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
`loadedBuildUnsaved: true`; and once per resume (D-415), right after its `resume` entry, when `mcp__pob2__guide_run
{resume}` replied so. The run's next compile replaces the engine's loaded build, so:

- **proceed**: the run continues, and the loaded build's unsaved changes will be discarded;
- **stop**: the run ends `stopped`. Nothing has been compiled in this session.

Say which build it is when the reply names it, and that the user can save it first (with
`mcp__pob2__lua_save_build`, outside this run) and start again. Recorded as checkpoint `unsaved-build`.
With a test config, `answers.unsavedBuild` answers it; with none there, the answer is `stop`
(`answeredBy: "default"`).

## The brainstorm gate: pick cards to verify

Shown after every brainstorm round's R1a-synthesize (D-429), which composes the round's builds; in a run whose
first brainstorm round ran R1a-assemble, after its R1a-assemble (D-287), for every later round too. Recorded as
checkpoint `brainstorm`.

- **Show** (`display brainstorm`, D-392, D-432) the brief in a line, the deck's header (what the composites share,
  how they differ), then **each composite** not verified yet, numbered: its round line (its name, its structure,
  its layers, the limit's answer and its under-played label), then its pieces in short, `in:`, `scheduled:` (each
  with where it goes) and `out:` (each with its reason in a few words); the composites a later round superseded,
  still pickable; then **the obvious build's line**, the baseline as its card was written (D-403); then **every
  plain card's name and structure**, one line each, numbered on (the researchers', the gate-made and the rival's
  cards `## Cards` lists), each one the user can verify too; ids last, under "For reference". A card whose damage
  source isn't a skill is marked "can't be finalized yet" (D-303); a minion skill is a skill (D-379); a card
  resting on an entry the PoB pin doesn't know says it waits on PoB (D-400). After a short round (D-429: fewer
  than 2 composites, or none taking a piece marked under-played), say so, with the reason R1a-synthesize gave,
  which the run log keeps as its `shortReason`.
- **Show, in a run whose first brainstorm round ran R1a-assemble** (`display brainstorm`, D-392): the brief in a
  line, the deck's header, every dealt card not verified yet by name, numbered, with its pitch, the "Not dealt"
  cards with their reasons, and the findings no card used; ids last, under "For reference". The deck's header names
  each engine with its count (D-405); the obvious card shows its `Obvious build:` line (D-403). A card whose damage
  source isn't a skill is marked "can't be finalized yet" (D-303); a minion skill is a skill (D-379); a card
  resting on an entry the PoB pin doesn't know says it waits on PoB (D-400). After a short round (D-339: fewer
  than 6 cards passed, the deck holds fewer than two under-played cards, or one engine filled it, D-405), say so,
  with the reason R1a-assemble gave, which the run log keeps as its `shortReason`.
- **Answers:**
  - **verify** 1–3 composites or cards (D-432), picked and made at the gate together, each named by its number or
    its name as the display shows it (a superseded composite, a plain card or a not-dealt one included), any with
    a revision: `pick:<id>[,<id>…]`, with its `changes` and `newCards`. They go to R1b as a new verification round
    (SKILL.md step 3).
    - **`changes` on a picked composite** may add or drop pieces, by name or key ("add Blood Magic", "drop
      i1b-4"): a revision, recorded under the composite's id with the user's words, which R1b applies to its
      `### Pieces` table. A piece that would change the composite's named damage source, ascendancy or engine
      makes a new card instead.
    - **A gate-made card's `from`** may name cards, composites and piece keys: a `### Pieces` row's key, or an
      Ideas line's id (`i<k><letter>-<m>`, `research/`). One that draws on pieces (a piece key, or a composite) is
      a composite, with Pieces tables and leave-one-out probes (R1b, D-433).
  - **brainstorm more** (D-235, D-287): a new brainstorm round with the user's note, `k` one more than the
    last. Only this answer, here or at the verification gate, starts a brainstorm round; the runner never
    starts one on its own. Recorded as `more`, with `note`.
  - **stop**: the run ends `stopped`.

## The verification gate: finalize 1 to 3 cards

Renamed from checkpoint 1 (D-287). Shown after every verification round's R1b-assemble, after a design
that was `infeasible` or an escalation sent the run back here, after a final gate's `accept:verification` once the
queue is empty, and at a resume (D-415). Recorded as checkpoint `verification`.

- **Show** (`display verification`) R1b-assemble's comparison, the dossier's table: one line per card verified in
  the run (every verification round, not only the last): its synergy, numbers from its skeleton's record (the
  named damage source's Count-scaled figure, `Life` and `TotalEHP`, D-294, the EHP naming the hit it was measured
  against, the rungs' T15 map hits, so it compares with the design gate's, D-423; a minion skill's figure its minion's
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
  (D-141); a card that can't be finalized yet is listed with its status, never as a failure. In a schema-4 run the
  display then lists every build of the run with its status (D-411), says when PoB's version (the pin's commit)
  or the league digest changed since the run last ran (D-415: a card verified on the old pin may still be
  finalized, its skeleton's figures the old pin's, and its design measures afresh), and after a resume names the
  answers a resume adds.
- **Answers:**
  - **finalize** 1 to 3 cards (`pick:<id>[,<id>…]`, D-411), in the user's order, each with any revision as
    `changes`, which that build's first D1-build attempt takes as a finding, `code: "user-request"`: a failed card
    may be finalized anyway; a card whose damage source isn't a skill can't be yet (D-303), nor one that waits on
    the pin (D-400). A card whose R1b failed `wrong-ascendancy` can't be finalized at all, not even anyway: the
    build it describes can't exist (D-342). Refuse such an answer and ask again. A test config that pre-supplies
    one has given an illegal answer: the run ends `stopped`, recorded as answer `stop` with the test config's
    `pick:<id>` as its `rule`. The same holds for the rival's card that ended `not-dealt`: it was never dealt
    (D-408). **A card that already has a build in the run isn't finalized again**: a second design of it is a
    `revise:` at its design gate, or a new card made from it here (D-391). Each card's identity `{className,
    ascendancy, skill}` becomes its build's `roll` (D-286), logged with `run-log.mjs build` as `queued`, in
    `builds/<id>/` (D-412), and the builds are designed in turn (below).
  - **verify other cards** (`verify:<id>[,<id>…]`, 1–3 composites or cards from the deck not verified yet, with
    `changes` and `newCards` as at the brainstorm gate, pieces among them, D-432): a new verification round (step
    3), without a brainstorm. A new card is verified before it can be finalized, at the next visit.
  - **brainstorm more** (`more`, with the user's note as `note`): a new brainstorm round (step 2a).
  - **stop**: the run ends, every card still queued `stopped`; its status is `stopped` unless a build ended
    `completed` or `file-only` before.
  - **after a resume** (D-415), each naming one build of the run: `guide:<id>` for a `file-only` build (W1 with
    the endgame template, V4's full pass, the fix round and the re-check, its final gate); `campaign:<id>` for a
    `completed` or `file-only` build (its campaign, `fix-round.md`); `design:<id>` for a `stopped` or `dropped`
    build whose last D1 gate passed: its design gate again, from that gate's verdict file, at no cost (F1 then
    checks the plan is the one that gate passed, by its `planSha1`).

**The queue** (D-411). The finalized cards are designed one build at a time, since the server holds one loaded
build (FR-W3): the first queued card's design, its design gate, its final compile, guide, checks and final gate,
then the next card's. A `pick:` puts its cards ahead of the cards still queued, in the user's order. Every route
back from a design comes here: an `infeasible` design (D-141), an escalation's option 3, the design gate's
`verification`, and FI-3. On such a visit the cards still queued stay queued, and resume after the visit, behind
any card it finalizes; its `stop` ends them `stopped`. The run ends when the queue is empty and the last answer
didn't ask for this gate (a final gate's `accept:verification` asks for it once the queue is empty).

## The design gate: judge the endgame build

A fourth user gate (D-362), once per build, after its passing D1 gate (or one whose escalation was accepted) and
before its final compile, F1 (D-413), and its guide: the user judges the endgame build before anything else is
written. Recorded as checkpoint `design`, with `concept` the build's card id. It runs between the D1 gate and F1
(SKILL.md step 7b), never in the fix round or a revision.

- **Show**, from the passing D1 gate's verdict file, its `design` field (A-35; `stages/D1-gate.md` step 6):
  you read no plan or record and call no tool for it; `display design --build <id>` prints it. First, once per
  build, before the rungs, the build's pieces from the design field's `pieces` (D-434), `- Pieces: <n> in, <n>
  scheduled (<names>), <n> out (<names>)`; a build with no `pieces.md` has none. Then one block per endgame rung, in
  ladder order:

  ```
  Budget endgame (level 92):
  - Clear speed: fast (rough).
  - Movement speed: +25% over your base speed; no travel skill.
  - The Arbiter of Divinity: survives its hits (its worst, a physical hit, is 0.82 of your max hit).
  - Damage: 98,412 per second.
  - Effective HP: 31,250 (against T15 map hits, area 79: 402 physical).
  - Anoint: Unbending: Ire, Guilt, Greed
  - Gear: Sekhema's Resolve; rare boots, 30% movement speed and resistances
  - Gems: Blood Hunt with Martial Tempo and Rupture; Herald of Blood
  - Passive tree: 11 of 104 points on travel; best swap left: none
  - Kept on the tree: mana sustain, Mental Toughness and its path, for Blood Hunt's cost
  - Kept on the tree: Dexterity for Martial Tempo's requirement
  ```

  Clear speed and movement speed lead, then the boss floor (D-407). The movement line names the rung's travel skill
  and its uses a second (`; travel skill <skill>, <n> uses a second`, or `; no travel skill`; D-427). `m` shows no Arbiter and no anoint. The
  Effective HP line names the hit it was measured against (the rung's `ehpHit`, D-423), so it compares with the
  dossier's EHP at the verification gate. The tree lines follow the Gems line (D-419): the points the rung spends
  on travel, nodes that give the build nothing themselves and only connect it to nodes that do, of its points; the
  best swap PoB's node power still finds (`+<x>% Full DPS by moving <n> points from <nodes> to <nodes>`, or
  `none`; a move within a weapon set's pool reads `best swap left (weapon set <n>): …`, C-55a); then each need the tree keeps whatever node power says, one line each, so the user sees why a long
  branch stays. Then the open estimates, one line each from `estimates[]`, the gate's verdict line, and the
  verdict file's path. Under the display, in your reply, give each `not made:` line D1-tree returned in this design
  (a tree change the user asked for that it couldn't make, with its why), so the user hears it before deciding.
- **Answers:**
  - **accept**: F1, the final compile (step 8), then the endgame guide, its checks and the build's final gate.
  - **file only** (`accept:file`, D-411): F1 and nothing after it: the build ends `file-only`, its PoB file and no
    guide. A guide can follow in a later session (`guide:<id>` after `--resume`, D-415).
  - **revise** (`revise:<text>`): a D1 fix round with the user's text as `findings` (`code: "user-request"`).
    A build change (gear, the gems or the config, with or without the tree) runs D1-build with it, then D1-tree,
    then D1-finish; a change to the tree alone runs D1-tree with it, then D1-finish (a node the user asks for
    becomes a need, D-418); a change to the anoint, the prices, the ledger or the claims runs D1-finish alone
    with it, and when it returns `build: <ids>`, D1-build with those, D1-tree, then D1-finish with its `changed`. Then the D1 gate, then this gate again. The revision counts against no retry cap; the D1 gate in it
    keeps its 2 counted retries. A change that isn't a revision of the finalized build (a new card, by the rule
    above) isn't a revise: say so, and offer **verification**. There the user's words carry into the
    restatement, as a new card whose `from` is the finalized card.
  - **verification**: the build ends `dropped`, and the verification gate (step 5) is shown, to finalize another
    card; the cards still queued wait behind the visit.
  - **stop**: the build ends `stopped`, and the next queued card's design starts; with none queued, the run ends.
    A default `stop` (the test config's design answers used up) ends the run, the queued cards `stopped`.

## The final gate: the build's guide

Checkpoint 2, once per build. Shown after the run checker (step 15). Recorded as checkpoint `final`, with
`concept` the build's card id.

- **Show** (`display final --build <id>`, which runs the run checker) the build's guide and `audit.md` paths; the
  PoB file (the verdict's `finalCompile.pobFile` of the build's last final compile, F1's or the D2 gate's); the
  gate verdicts; each endgame rung's figures from the final compile record, its DPS, EHP, Arbiter verdict with the
  worst ratio, rough clear speed and travel (the last D1 gate verdict's tree, D-419), with the design gate's
  beside them where they moved since (D-369); the known issues (the open V4 findings and the accepted gate
  findings); the run checker's result; each rung's total range at its price day against its target, and its
  over-target slots (the D1 gate's last verdict file, D-371, D-374); when any price is `unavailable`, that the
  rung's total isn't known (D-164); and in offline mode, that the guide is from an offline run.
- **Answers:**
  - **accept**: the build ends `completed`.
  - **accept, then verification** (`accept:verification`, D-411): the build ends `completed`, and once the queue
    is empty the verification gate is shown again, for more cards.
  - **campaign** (`campaign`, D-415): the build ends `completed` with its endgame guide, then reopens for its
    campaign (`fix-round.md`, "A build's campaign") and comes back to this gate with the full guide.
  - **changes** (D-236): a revision. The runner maps each request to the step that owns it, by the fix
    round's owners: the guide's text is W1's; an endgame stage of `plan.json`, its ledger entries and
    prices D1's; a campaign stage D2's. It runs that owner as the fix round does (SKILL.md step 12, D-264:
    claims in place, then W1; the owner's gates only after it recompiled: D1 → D1 gate → F1, or the D2 gate for
    a build with its campaign, → W1, D2 → D2 gate → W1) with the requests as `findings` (`code:
    "user-request"`), after the round copy to `rounds/<n>/`. Then the V4 re-check over what `check-run.mjs
    --changed <n> --build <id>` lists and the known issues again, and it comes back here: **a revision runs no
    full pass** (D-352). A revision counts against no retry cap. The answer is recorded as `revise:<text>`. The
    final gate's `revise:` is for guide-level changes; a build change belongs at the design gate (D-362), though
    one asked here still runs through its owner.
  - **decline** (`decline:<note>`): the user declines the guide, and the build ends `not-accepted`, with the
    user's note after the prefix, which tells a decline from the other answers.

Once the build ends, the next queued card's design starts; with none queued, the verification gate when an
answer asked for it, else the run ends: `completed` when any build ended `completed` or `file-only`, else the
last build's end, or `stopped` when no card was finalized. A default `stop` (the test config's final answers used
up) ends the run, the queued cards `stopped`.

## Escalations (D-127, D-141, D-236, D-413)

The D1 gate, the D2 gate and F1 escalate, each for its build: the D1 and D2 gates on the third counted failure of a
compile, V1 or V2 (the D2 gate's final compile included), F1 on its second failure, or at once on the write
ledger's refusal (`ledger-refused`), and each on a guided retry that fails again. Verification never escalates:
what it leaves open becomes a known issue. Record the escalation in `escalations[]` as `{stage, concept, verdict,
choice, guidance?}`, `verdict` the escalated attempt's verdict file, and the question as checkpoint
`escalation`. Show (`display escalation`) the stage, the attempts and the verdict file with its findings; after the
questions, the answers:

1. **accept**: the verdict's failing findings are accepted, **for that build** (D-411). A gate finding equal to
   an accepted one, **same plan stage, part and `code`**, fails no gate of that build afterwards, whichever gate
   reports it: the later headers of that build's steps carry them in `accepted`, matched by `concept` too, and
   another build's never do. The guide lists each under its H3 `Known issues` in "What PoB can't show", one
   line per finding: a plain sentence the reader can act on, with no id; `audit.md`'s `Known issues` table
   gives its row, with its `code`, its gate (`D1-gate`, `D2-gate` or `F1`) and its plan stage (D-265, D-276); the
   run checker looks for them there. After the D1 gate the run goes on as if it passed, to the design gate;
   after the D2 gate or F1, that step runs once more, uncounted, with them in `accepted`, so it runs the final
   compile. **Not offered when the failure is a compile error**, nor after F1's ledger refusal: nothing compiled
   to continue from. After a ledger refusal, the user can restore or remove the changed PoB file and answer
   accept: F1 runs again and accepts no finding.
2. **guidance and one more retry**: the producer (D1 or D2) gets one more attempt with the verdict and the
   user's guidance in `findings`, then its gate. That attempt counts against no cap, and if the gate fails,
   whatever part fails, it escalates again. After F1, D1 runs from the step the guidance needs (D1-build, D1-tree
   or D1-finish), then the D1 gate and the design gate again, since the build changed, then F1.
3. **back to the verification gate** (choice `verification`, which replaces `checkpoint-1`, D-289), with the
   verdict file as that card's evidence: the build ends `dropped`.
4. **stop**: the build ends `escalated`, and the next queued card's design starts; with none queued, the run
   ends.

With a test config, `answers.escalation[]` answers each escalation in turn; with none left, the answer is
`stop` (`answeredBy: "default"`), so the build ends `escalated`.

## Pre-supplied answers (offline test mode only; D-288, D-323)

| Question | Test config answer | Meaning |
|---|---|---|
| unsaved build | `answers.unsavedBuild`: `proceed` or `stop` | none given: `stop`, `default` |
| brainstorm gate | `answers.brainstorm[]`, one per visit: `pick:<id>[,<id>…]` (1–3 ids), `first-n:<n>`, `more` or `stop` | `first-n:<n>` (`n` 1–3) is the first `n` composites `cards.md`'s `## Round <k>` lines list, not verified yet, in the deck's order, never a superseded composite or a plain card (D-429); in a run that deals (R1a-assemble), the first `n` dealt cards not verified yet; else `stop` |
| verification gate | `answers.verification[]`, one per visit: `first-viable`, `pick:<id>[,<id>…]` (1–3 ids, D-411), `verify:<id>[,<id>…]`, `more` or `stop` | `first-viable` is the first `viable` card not yet finalized in this run, `pick:<id>`, else `stop`; a card that can't be finalized yet is never `viable` |
| design gate | `answers.design[]`, one per visit: `accept`, `accept:file`, `revise:<text>`, `verification` or `stop` | none left: `stop`, `default`, rule `no design answer left: stop` (D-362), which ends the run |
| final gate | `answers.final[]`, one per visit: `accept`, `accept:verification`, `campaign`, `not-accept`, `decline:<note>` or `revise:<text>` | `not-accept` resolves to `decline:<note>`, the note saying the test config declined (D-411); none left: `stop`, `default`, which ends the run |
| escalation | `answers.escalation[]`, one per escalation: `accept`, `retry:<guidance>`, `verification` or `stop` | none left: `stop`, `default`: the build ends `escalated` |

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
visit. At the final gate and at an escalation, the same holds for their displays: `display <gate>` prints each
(`--build <id>` at the design and final gates), on every visit.

When the `brainstorm`, `verification`, `design` or `final` answers run out, the run ends (recorded as answer
`stop`, `answeredBy: "default"`), `stopped` unless a build ended `completed` or `file-only` before it: a default
`stop` at a design or final gate ends the run, the build at the gate and every queued card `stopped`, where a
user's `stop` at the design gate ends that build only. Record a used answer with `answeredBy: "pre-supplied"` and the answer it
resolved to (`first-viable` → `pick:r1-a-2`, `first-n:2` → `pick:r1-a-1,r1-a-2`). Either way the entry's
`rule` keeps how the answer was reached: the test config's answer exactly as written
(`"rule": "first-viable"`), or the default that applied (`"rule": "no verification answer left: stop"`). The
guide's `audit.md` quotes the rule that finalized its card (`run-log.md`).
