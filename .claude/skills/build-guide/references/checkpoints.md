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
  round and `n` the run's next gate-made card in it, `from` any cards `cards.md` lists. Propose its name in the
  restatement, one no card of the run has, carrying **the main skill and the ascendancy** (D-442): a few words of
  the build's own, then the main skill (the card's named damage source, not a skill that feeds it), then the
  ascendancy, like "Reaping Bonfire Detonate Dead Blood Mage"; the user may change it before the yes. Picks and new cards
  together are 1–3; a pick of new cards only is `pick:` or `verify:` with no id. In a run that composes (D-432),
  `from` may also name piece keys, a `### Pieces` row's or an Ideas line's, and a composite's `changes` may add or
  drop pieces (the brainstorm gate, below).
- **A question that became an idea** can go into brainstorm more as its note; the next round's researchers get
  its answer file.

**No rival** (D-443): the rival step is removed, so a request for "a rival" or "a faster structure" is a
question (a gate question step) or a new card, by the rule above.

## The pricing question (D-444)

After a pricing step hit a rate limit or a lockout (`rate_limited` or `locked_out` in its `priceOutcomes`), trade-site
pricing stops until the user approves a retry: `run-log.mjs` records the stop in `pricing.stops[]` with that step's
`stage` entry (`run-log.md`). poe.ninja's exchange stays allowed, so every item the currency exchange sells keeps
its price. **The next gate asks first**, whichever gate it is: after its display and before its other questions,
ask `Pricing stopped at <step> after <outcome>: retry?` (`<outcome>` in words: "a rate limit", "a lockout"), and
log the answer with `run-log.mjs pricing` before anything else of the visit:

```
node .claude/skills/build-guide/scripts/run-log.mjs <runFolder> pricing - <<'JSON'
{"checkpoint": "verification", "answer": "retry-pricing"}
JSON
```

- **`retry-pricing`**: the stop clears. At the verification gate, the next pricing step prices (R1b, or the build's
  D1-build and D1-finish); at the design gate, the D1 gate's re-price pass runs before F1 (on `accept`, a D1 gate,
  then F1, with no second design gate). Say that a second limit stops pricing again.
- **`no-retry`**: the stop holds; every later step prices only the currency exchange's items, the rest
  `unavailable`, and the next gate asks again.

Asked only while a stop is open (the script refuses it otherwise), once per gate visit. A resume clears a stop too,
as before (`pricing.md`).

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
  its layers, the limit's answer and its under-played label), then its pieces in short, `in:` and `scheduled:`
  (each with where it goes), with no `out:` line (D-442: the card's `### Pieces` and the build's `pieces.md` keep
  the out pieces and their reasons); the composites a later round superseded, still pickable; then **the obvious
  build's line**, the baseline as its card was written (D-403); then **every plain card's name and structure**, one
  line each, numbered on (the researchers' and the gate-made cards `## Cards` lists), each one the user can verify
  too; under a card that draws on a published guide (its Evidence's `external | <url>`), `drawn from <host>`, so the
  user can tell a known build from the pipeline's own (D-445); ids last, under "For reference". A card whose damage
  source isn't a skill is marked "can't be finalized yet" (D-303); a minion skill is a skill (D-379); a card
  resting on an entry the PoB pin doesn't know says it waits on PoB (D-400). After a short round (D-429: fewer
  than 2 composites, or none taking a piece marked under-played), say so, with the reason R1a-synthesize gave,
  which the run log keeps as its `shortReason`.
- **Show, in a run whose first brainstorm round ran R1a-assemble** (`display brainstorm`, D-392): the brief in a
  line, the deck's header, every dealt card not verified yet by name, numbered, with its pitch, the "Not dealt"
  cards with their reasons, and the findings no card used; ids last, under "For reference". The deck's header names
  each engine with its count (D-405); the obvious card shows its `Obvious build:` line (D-403), and a card that
  draws on a published guide its `drawn from <host>` line (D-445). A card whose damage
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

- **Show** (`display verification`, D-436) R1b-assemble's comparison, the dossier's table: one block per card
  verified in the run (every verification round, not only the last), **with no figure**: no damage, life, EHP,
  clear-speed or movement-speed number. Verification answers "it compiles and the skills work as expected"; the
  user decides which cards to finalize. Each card's block, by its name (no id, D-392):
  - its status, in words from the dossier's (D-392): `works` for `viable` (it compiled, and its named damage source
    shows every kind of damage the card names); `works, except <piece> does nothing in PoB` for `viable, except
    …`; `failed after <n> tries: <why>` for `failed after <N> attempts: …` (a failed compile, or `damage-missing`
    after its retries: a kind of damage the card names that shows nothing on its named source); "can't be built
    yet: …" for "can't be finalized yet: its damage source isn't a skill" (D-303, D-334; from its R1b verdict's
    `not-a-skill` finding) or "can't be finalized yet: waits on the pin" (a `not-in-pin` card, D-400). A card whose
    R1b verdict's finding is `wrong-ascendancy` (D-342) is `failed`, shown with that reason: its ascendancy doesn't
    own the passive-tree node that grants its skill, the node the finding names;
  - its synergy, and its pitch lines as written (Why pick it, How it clears, Bosses, Needs, The catch), its made
    and changed lines;
  - `Damage:` the named source and the kinds PoB shows for it (`Detonate Dead: hit, bleed, ignite`; `(rated at its
    hand-cast speed)` for a source a meta gem triggers);
  - `Pieces:` on a composite, how many of its `in` pieces probed do something, and which don't or PoB can't see;
  - its key prices, converted, as ranges with their league day (D-374), or as seen in players' words when a range
    rounds to 0.0 (`1 exalt (seen 2026-10-24)`, D-442), or `unavailable`;
  - its risks, what PoB can't verify, and its structure check's `A stronger structure?` line, from which the user
    can make a new card (D-406).

  Under the cards, one line: `Numbers come at the design gate, measured on the full build.` Give the dossier's
  path. After an `infeasible` design or an escalation, show that card's evidence: its last verdict file. With no
  viable card, show each failed card's last verdict and why it fails (D-141); a card that can't be finalized yet is
  listed with its status, never as a failure. In a schema-4 run the display then lists every build of the run with
  its status (D-411), says when PoB's version (the pin's commit) or the league digest changed since the run last
  ran (D-415: a card verified on the old pin may still be finalized, and its design measures afresh), and after a
  resume names the answers a resume adds. **A dossier written before amendment 11** (a resumed older run's, read by
  its header, §19) keeps its older display: each card's skeleton figures (its clear speed, damage, life and EHP),
  and an older run's rival card marked as the rival (D-408, removed by D-443).
- **Answers:**
  - **finalize** 1 to 3 cards (`pick:<id>[,<id>…]`, D-411), in the user's order, each with any revision as
    `changes`, which that build's first D1-build attempt takes as a finding, `code: "user-request"`: a failed card
    may be finalized anyway; a card whose damage source isn't a skill can't be yet (D-303), nor one that waits on
    the pin (D-400). A card whose R1b failed `wrong-ascendancy` can't be finalized at all, not even anyway: the
    build it describes can't exist (D-342). Refuse such an answer and ask again. A test config that pre-supplies
    one has given an illegal answer: the run ends `stopped`, recorded as answer `stop` with the test config's
    `pick:<id>` as its `rule`. The same holds for an older run's rival card that ended `not-dealt`, from before
    amendment 11 removed the rival (D-408, D-443): it was never dealt. A card that failed `damage-missing` may be
    finalized anyway: its design measures the full build. **A card that already has a build in the run isn't
    finalized again**: a second design of it is a `revise:` at its design gate, or a new card made from it here
    (D-391). Each card's identity `{className,
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
(SKILL.md step 7b), never in the fix round or a revision. Numbers come first here, measured on the full build
(D-436): verification showed none.

- **Show**, from the passing D1 gate's verdict file, its `design` field (A-35; `stages/D1-gate.md` step 6):
  you read no plan or record and call no tool for it; `display design --build <id>` prints it. First, once per
  build, before the rungs, the build's pieces from the design field's `pieces` (D-434), `- Pieces: <n> in, <n>
  scheduled (<names>), <n> out`, the out pieces counted without their names (D-442); a build with no `pieces.md`
  has none. Then one block per endgame rung, in ladder order:

  ```
  Non-budget endgame (level 95):
  - Clear speed: fast (rough).
  - Movement speed: +35% over your base speed; no travel skill.
  - The Arbiter of Divinity: survives its hits (its worst, a physical hit, is 0.71 of your max hit).
  - Damage: 2,717,385 per second against map monsters.
  - Boss damage: about 320,000 per second against a Pinnacle boss (PoB alone: 222,149 at Detonate Dead's hand-cast 1.46 a second; estimated: trigger rate: Cast on Critical's 2.1 a second from the crit rate).
  - Boss floor: about 320,000 against the 250,000 floor.
  - Culls normal monsters at 91%, bosses at 13%.
  - Detonate Dead is triggered by Cast on Critical: PoB rates it at its hand-cast speed (1.46 a second) and doesn't model Energy.
  - Effective HP: 16,900 (against T16 map hits, area 82: 439 physical).
  - Toughness: 16,900 against the 20,000 target for a close build (Reap and the corpse blasts need the pack next to you), under its band (18,000).
  - Anoint: Unbending: Ire, Guilt, Greed
  - Gear: Apron of Emiran; rare boots, 35% movement speed and resistances
  - Gems: Detonate Dead with Cast on Critical; Reap with Bloodlust
  - Passive tree: 13 of 118 points on travel; best swap left: +3.1% damage by moving 5 points from <nodes> to <nodes>
  - Kept on the tree: the attribute nodes the gems' requirements need
  - Kept for Cast on Critical's Energy, which PoB can't measure: the same 6 points elsewhere would add 17% damage.
  - Defence: a rare body with life and resistances and Crimson Assault: +17% EHP, −9% damage.
  ```

  Clear speed and movement speed lead, then the Arbiter line (D-407). The movement line names the rung's travel skill
  and its uses a second (`; travel skill <skill>, <n> uses a second`, or `; no travel skill`; D-427). `m` shows no
  Arbiter and no anoint. **The damage lines** (D-437, D-447, D-448): the named source's damage figure against map
  monsters, never PoB's Full DPS, with its cull only when the rung's rotation culls (`skills.cull`); then the boss
  line, `about <estimate>` with PoB's own figure and what the estimate corrects when D1-finish estimated it by
  hand (`boss_<stage>`), else the measured figure alone; on the non-budget rung the boss floor line, the boss
  figure against the 250,000 floor (`references/boss-floor.json`), `under the 250,000 floor` with a damage trade
  below it; the cull line; and the trigger line when a meta gem triggers the named source. The Effective HP line
  names the hit it was measured against (the rung's `ehpHit`, D-423). **On the non-budget rung, the toughness
  line** (D-441): its EHP against its target in `references/toughness-targets.json`, 20,000 for a close build and
  15,000 at a distance, with the engagement and its reason, so the user can correct it, and its band: under it
  (below 90%), within it, or over it (above 150%). The tree lines follow the Gems line (D-419): the points the rung
  spends on travel, nodes that give the build nothing themselves and only connect it to nodes that do, of its
  points; the best swap PoB's node power still finds (`+<x>% damage by moving <n> points from <nodes> to <nodes>`,
  or `none`; a move within a weapon set's pool reads `best swap left (weapon set <n>): …`, C-55a); then each need
  the tree keeps whatever node power says, one line each, so the user sees why a long branch stays. **Then the
  rung's trades** (D-439, D-440, D-441, D-448), each with what it gains and what it costs, for the user to take or
  leave: a need PoB can't measure, with what the same points would add elsewhere; boots under their tier by an
  exception, the speed given up and why; a defence trade on a rung under its band; a damage trade on a rung over
  its band or under the floor, with the boss figure it implies (`boss about <n>`); `none found: <why>` when the
  design found none. No trade is a gate failure. Then the open estimates, one line each from `estimates[]`, the
  gate's verdict line, and the verdict file's path. Under the display, in your reply, give each `not made:` line
  D1-tree returned in this design (a tree change the user asked for that it couldn't make, with its why), so the
  user hears it before deciding.
- **Taking a trade** is a revise: the user's words name the trade ("take the defence trade"), and the change
  goes to the step that owns it, below.
- **After a pricing stop** (D-444), the gate asks its pricing question before its other questions; after
  `retry-pricing` at this visit, an `accept` or `accept:file` runs the D1 gate's re-price pass before F1 (a D1
  gate after the answer, then F1, with no second design gate).
- **Answers:**
  - **accept**: F1, the final compile (step 8), then the endgame guide, its checks and the build's final gate.
  - **file only** (`accept:file`, D-411): F1 and nothing after it: the build ends `file-only`, its PoB file and no
    guide. A guide can follow in a later session (`guide:<id>` after `--resume`, D-415).
  - **revise** (`revise:<text>`): a D1 fix round with the user's text as `findings` (`code: "user-request"`).
    A build change (gear, the gems or the config, with or without the tree) runs D1-build with it, then D1-tree,
    then D1-finish; **a respec the user asks for runs D1-build first** (D-438), even when only the tree changes,
    so D1-build marks the rung and D1-tree completes it; any other change to the tree alone runs D1-tree with it,
    then D1-finish (a node the user asks for becomes a need, D-418); a change to the anoint, the prices, the
    ledger, the boss estimate, the claims or a trade's measure runs D1-finish alone with it, and when it returns
    `build: <ids>`, D1-build with those, D1-tree, then D1-finish with its `changed`. Within the attempt, D1-tree's
    `respec:` return and D1-finish's `build:` return each send it back to D1-build (`gates.md`, "The D1 gate's
    outcome"). Then the D1 gate, then this gate again. The revision counts against no retry cap; the D1 gate in it
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
  gate verdicts; each endgame rung's figures from the final compile record (D-437, D-447): `<rung label>: <map>
  damage per second against map monsters, <boss> against a Pinnacle boss; Effective HP <n>`, the map figure the
  named source's damage figure (culling counted only when the rung's `skills.cull` says the rotation culls) and the
  boss figure the record's evaluated `boss_<stage>` ledger value when the design estimated one (`about <n>`), else
  its measured `damage.boss`; then its Arbiter verdict with the worst ratio, rough clear speed and travel (the last
  D1 gate verdict's tree, D-419), with the design gate's beside them where they moved since (D-369); a build whose
  record predates amendment 11 shows its one DPS figure, `measures.dps`; the known issues (the open V4 findings and the accepted gate
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
| verification gate | `answers.verification[]`, one per visit: `first-viable`, `pick:<id>[,<id>…]` (1–3 ids, D-411), `verify:<id>[,<id>…]`, `more` or `stop` | `first-viable` is the first `viable` card (`viable, except …` included, D-436) not yet finalized in this run, `pick:<id>`, else `stop`; a card that can't be finalized yet is never `viable`, nor is a failed one (`damage-missing` included) |
| design gate | `answers.design[]`, one per visit: `accept`, `accept:file`, `revise:<text>`, `verification` or `stop` | none left: `stop`, `default`, rule `no design answer left: stop` (D-362), which ends the run |
| final gate | `answers.final[]`, one per visit: `accept`, `accept:verification`, `campaign`, `not-accept`, `decline:<note>` or `revise:<text>` | `not-accept` resolves to `decline:<note>`, the note saying the test config declined (D-411); none left: `stop`, `default`, which ends the run |
| escalation | `answers.escalation[]`, one per escalation: `accept`, `retry:<guidance>`, `verification` or `stop` | none left: `stop`, `default`: the build ends `escalated` |

`answers.checkpoint1` and `answers.checkpoint2` are retired with the run log's schema 3 (D-323): a test config
that holds them, or the escalation answer `checkpoint-1`, is malformed. An entry may be an object scripting an
interview (D-394, `offline-and-test.md`).

**A pre-supplied answer still prints the display** (D-265). The test config replaces only the question:
show everything the gate shows the user, then the answer it resolved to. At the brainstorm gate that is the
brief and the deck, on every visit. At the verification gate that is R1b-assemble's comparison lines, each
card's status and the dossier's path, with no figure and the line that numbers come at the design gate (D-436), on
every visit; on a revisit after an `infeasible` design or an
escalation, that card's evidence (its last verdict file); with no viable card, each failed card's last
verdict. At
the design gate that is every rung's block and the open estimates from the D1 gate's verdict file, on every
visit. At the final gate and at an escalation, the same holds for their displays: `display <gate>` prints each
(`--build <id>` at the design and final gates), on every visit.

A test config has no pricing answer: an offline run prices nothing, so no pricing stop opens and the pricing
question (above) is never asked.

When the `brainstorm`, `verification`, `design` or `final` answers run out, the run ends (recorded as answer
`stop`, `answeredBy: "default"`), `stopped` unless a build ended `completed` or `file-only` before it: a default
`stop` at a design or final gate ends the run, the build at the gate and every queued card `stopped`, where a
user's `stop` at the design gate ends that build only. Record a used answer with `answeredBy: "pre-supplied"` and the answer it
resolved to (`first-viable` → `pick:r1-a-2`, `first-n:2` → `pick:r1-a-1,r1-a-2`). Either way the entry's
`rule` keeps how the answer was reached: the test config's answer exactly as written
(`"rule": "first-viable"`), or the default that applied (`"rule": "no verification answer left: stop"`). The
guide's `audit.md` quotes the rule that finalized its card (`run-log.md`).
