# Gates, questions and escalations

The runner stops for the user at three gates, one per phase (`brainstorm`, `verification` and `final`), and at
two kinds of question (slice 03 §10, §5.4, as amendments 1 and 3 change them; D-125, D-157, D-210, D-235,
D-236, D-287, D-288). Each is asked with AskUserQuestion; if the choices exceed one question's option limit,
split them across questions. In offline test mode the test config answers instead (`offline-and-test.md`), and
only there (A-28). Every answer is recorded in the run log's `checkpoints[]` under the gate's or question's name
(`answer`, `answeredBy`, and `rule` for a pre-supplied or default answer; `run-log.md`).

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

- **Show** the parsed brief at the top, then the deck from `cards.md`: every dealt card not verified yet, one
  line each (its id, title, identity, playstyle tags, links confirmed, under-played label and evidence), and
  the "Not dealt" list, each with the link no lookup confirmed. A card whose damage source isn't a skill is
  marked "can't be finalized yet" (D-303). After a short round (D-339: fewer than 6 cards passed, or the deck
  holds fewer than two under-played cards), say so, with the reason R1a-assemble gave, which the run log
  keeps as its `shortReason`.
- **Ask** with AskUserQuestion in `multiSelect` mode: up to 4 cards a question and up to 3 questions, plus one
  question for brainstorm more or stop. With more than 12 cards to offer, offer the latest round's first; the
  user can name any other card id, a held-back one included, in the free-text answer.
  - **verify** 1–3 cards: the union of the selections; more than 3 is asked again. Recorded as
    `pick:<id>[,<id>…]`. They go to R1b as a new verification round (SKILL.md step 3).
  - **brainstorm more** (D-235, D-287): a new brainstorm round with the user's note, `k` one more than the
    last. Only this answer, here or at the verification gate, starts a brainstorm round; the runner never
    starts one on its own. Recorded as `more`.
  - **stop**: the run ends `stopped`.

## The verification gate: finalize one card

Renamed from checkpoint 1 (D-287). Shown after every verification round's R1b-assemble, and after a design
that was `infeasible` or an escalation sent the run back here. Recorded as checkpoint `verification`.

- **Show** R1b-assemble's comparison, one line per card verified in the run (every verification round, not
  only the last): its synergy, numbers from its skeleton's record (the named damage source's Count-scaled
  figure, `Life` and `TotalEHP`, D-294; the figure labelled `estimate` when its group's Count is above 1 or
  the stage is `computedWithCustomMods`, D-296), key prices (dated, or `unavailable`), risks, what PoB can't
  verify, and its status: `viable`, `failed`, or "can't be finalized yet: its damage source isn't a skill"
  (D-303, D-334; from its R1b verdict's `not-a-skill` finding). A card whose R1b verdict's finding is
  `wrong-ascendancy` (D-342) is `failed`, shown with that reason: its ascendancy doesn't own the passive-tree
  node that grants its skill, the node the finding names. Give the dossier's path. After an
  `infeasible` design or an escalation, show that card's evidence: its last verdict file. With no viable
  card, show each failed card's last verdict and why it fails (D-141); a card that can't be finalized yet is
  listed with its status, never as a failure.
- **Ask**: finalize one card, verify other cards, brainstorm more, or stop.
  - **finalize** (`pick:<id>`): a failed card may be finalized anyway; a card whose damage source isn't a
    skill can't be yet (D-303). A card whose R1b failed `wrong-ascendancy` can't be finalized at all, not even
    anyway: the build it describes can't exist (D-342). Refuse such an answer and ask again. A test config
    that pre-supplies one has given an illegal answer: the run ends `stopped`, recorded as answer `stop` with
    the test config's `pick:<id>` as its `rule`. The card's identity `{className, ascendancy, skill}` becomes
    the run's `roll` (D-286), and the design (steps 6 to 9) runs for it.
  - **verify other cards** (`verify:<id>[,<id>…]`, 1–3 cards from the deck not verified yet): a new
    verification round (step 3), without a brainstorm.
  - **brainstorm more** (`more`, with the user's note): a new brainstorm round (step 2a).
  - **stop**: the run ends `stopped`.

Every route back from the design comes here: an `infeasible` design (D-141), an escalation's option 3, and
FI-3.

## The final gate: the guide

Checkpoint 2, unchanged in what it asks. Shown after the run checker (step 15). Recorded as checkpoint `final`.

- **Show** the guide's path; the PoB file (the D2 gate verdict's `finalCompile.pobFile`); the gate
  verdicts; the known issues (the open V4 findings and the accepted gate findings); the run checker's
  result; when any price is `unavailable`, that the variant can't be claimed to be under budget (D-164);
  and in offline mode, that the guide is from an offline run.
- **Ask**: accept, ask for changes, or anything else.
  - **accept**: the run ends `completed`.
  - **changes** (D-236): a revision. The runner maps each request to the step that owns it, by the fix
    round's owners: the guide's text is W1's; an endgame stage of `plan.json`, its ledger entries and
    prices D1's; a campaign stage D2's. It runs that owner as the fix round does (SKILL.md step 12, D-264:
    claims in place, then W1; the owner's gates only after it recompiled: D1 → D1 gate → D2 gate → W1, D2 →
    D2 gate → W1) with the requests as `findings` (`code: "user-request"`), then the full V4 pass, the fix
    round, the re-check and the known issues again, and comes back here. A revision counts against no retry
    cap. The answer is recorded as `revise:<text>`.
  - **any other answer**: the run ends `not-accepted`, with the user's note recorded as the answer.

## Escalations (D-127, D-141, D-236)

Only the D1 and D2 gates escalate: on the third counted failure of a compile, V1 or V2 (the D2 gate's
final compile included), and on a guided retry that fails again. Verification never escalates: what it
leaves open becomes a known issue. Record the escalation in `escalations[]` as `{stage, concept, verdict,
choice, guidance?}`, `verdict` the escalated attempt's verdict file, and the question as checkpoint
`escalation`. Show the stage, the attempts and the verdict file, and ask:

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
| final gate | `answers.final[]`, one per visit: `accept`, `not-accept` or `revise:<text>` | |
| escalation | `answers.escalation[]`, one per escalation: `accept`, `retry:<guidance>`, `verification` or `stop` | none left: `stop`, `default` |

`answers.checkpoint1` and `answers.checkpoint2` are retired with the run log's schema 3 (D-323): a test config
that holds them, or the escalation answer `checkpoint-1`, is malformed. A brainstorm `more` from the test config
carries no note.

**A pre-supplied answer still prints the display** (D-265). The test config replaces only the question:
show everything the gate shows the user, then the answer it resolved to. At the brainstorm gate that is the
brief and the deck, on every visit. At the verification gate that is R1b-assemble's comparison lines, each
card's status and the dossier's path, on every visit; on a revisit after an `infeasible` design or an
escalation, that card's evidence (its last verdict file); with no viable card, each failed card's last
verdict. At
the final gate and at an escalation, the same holds for their displays.

When the `brainstorm`, `verification` or `final` answers run out, the run ends `stopped` (recorded as answer
`stop`, `answeredBy: "default"`). Record a used answer with `answeredBy: "pre-supplied"` and the answer it
resolved to (`first-viable` → `pick:r1-a-2`, `first-n:2` → `pick:r1-a-1,r1-a-2`). Either way the entry's
`rule` keeps how the answer was reached: the test config's answer exactly as written
(`"rule": "first-viable"`), or the default that applied (`"rule": "no verification answer left: stop"`). The
guide's `audit.md` quotes the rule that finalized its card (`run-log.md`).
