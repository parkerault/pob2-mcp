# Checkpoints, questions and escalations

The runner stops for the user at two checkpoints and at two kinds of question (slice 03 §10, §5.4, as
amendment 1 changes them; D-125, D-157, D-210, D-235, D-236). Each is asked with AskUserQuestion; if the
choices exceed one question's option limit, split them across two questions. In offline test mode the
test config answers instead (`offline-and-test.md`), and only there (A-28). Every answer is recorded in
the run log's `checkpoints[]` (`answer`, `answeredBy`, and `rule` for a pre-supplied or default answer).

## The unsaved-build question (FR-W2 step 4; D-210)

Asked once, right after the run log's first write, when `mcp__pob2__guide_run {new_run}` replied
`loadedBuildUnsaved: true`. The run's first compile replaces the engine's loaded build, so:

- **proceed**: the run continues, and the loaded build's unsaved changes will be discarded;
- **stop**: the run ends `stopped`. Nothing has been compiled, and no research has started.

Say which build it is when the reply names it, and that the user can save it first (with
`mcp__pob2__lua_save_build`, outside this run) and start again. Recorded as checkpoint `unsaved-build`.
With a test config, `answers.unsavedBuild` answers it; with none there, the answer is `stop`
(`answeredBy: "default"`).

## Checkpoint 1: pick a concept

Shown after every research round, and after a design that was `infeasible` or an escalation sent the run
back here.

- **Show** R1b-assemble's comparison, one line per concept of the run (every round, not only the last): its
  synergy, numbers from its skeleton's record, key prices (dated, or `unavailable`), risks, what PoB can't
  verify, and its status (`viable`, `failed`, `not-carried`). Give the dossier's path. After an
  `infeasible` design or an escalation, show that concept's evidence: its last verdict file. With no viable
  concept, show each concept's last verdict and why it fails (D-141).
- **Ask**: pick a concept (a failed one may be picked anyway), ask for more, or stop.
  - **pick**: the design (steps 6 to 9) runs for that concept.
  - **ask for more** (D-235): a new research round of up to 3 concepts, with the user's note. Its
    `firstId` is one more than the highest concept id so far. Only this answer starts a round; the runner
    never starts one on its own.
  - **stop**: the run ends `stopped`.

## Checkpoint 2: the guide

Shown after the run checker (step 15).

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
   `accepted` carries them. The guide lists each under its H3 `Known issues` in "Confidence and what PoB
   can't model", one line per finding: a plain sentence the reader can act on, then its gate (`D1-gate` or
   `D2-gate`), `code` and plan stage in parentheses (D-265); the run checker looks for them there. After the D1 gate the run goes on as if it passed;
   after the D2 gate, the D2 gate runs once more, uncounted, with them in `accepted`, so it runs the final
   compile. **Not offered when the failure is a compile error**: nothing compiled to continue from.
2. **guidance and one more retry**: the producer (D1 or D2) gets one more attempt with the verdict and the
   user's guidance in `findings`, then its gate. That attempt counts against no cap, and if the gate fails,
   whatever part fails, it escalates again.
3. **back to checkpoint 1**, with the verdict file as that concept's evidence.
4. **stop**: the run ends `escalated`.

With a test config, `answers.escalation[]` answers each escalation in turn; with none left, the answer is
`stop` (`answeredBy: "default"`), so the run ends `escalated`.

## Pre-supplied answers (offline test mode only)

| Question | Test config answer | Meaning |
|---|---|---|
| unsaved build | `answers.unsavedBuild`: `proceed` or `stop` | none given: `stop`, `default` |
| checkpoint 1 | `answers.checkpoint1[]`, one per visit: `first-viable`, `pick:<id>`, `more` or `stop` | `first-viable` is the first `viable` concept not yet designed in this run, else `stop` |
| checkpoint 2 | `answers.checkpoint2[]`, one per visit: `accept`, `not-accept` or `revise:<text>` | |
| escalation | `answers.escalation[]`, one per escalation: `accept`, `retry:<guidance>`, `checkpoint-1` or `stop` | none left: `stop`, `default` |

**A pre-supplied answer still prints the display** (D-265). The test config replaces only the question:
show everything the checkpoint shows the user, then the answer it resolved to. At checkpoint 1 that is
R1b-assemble's comparison lines, each concept's status and the dossier's path, on every visit; on a revisit
after an `infeasible` design or an escalation, that concept's evidence (its last verdict file); with no
viable concept, each concept's last verdict. At checkpoint 2 and at an escalation, the same holds for their
displays.

When `checkpoint1` or `checkpoint2` answers run out, the run ends `stopped` (recorded as answer `stop`,
`answeredBy: "default"`). Record a used answer with `answeredBy: "pre-supplied"` and the answer it resolved
to (`first-viable` → `pick:c3`). Either way the entry's `rule` keeps how the answer was reached: the test
config's answer exactly as written (`"rule": "first-viable"`), or the default that applied
(`"rule": "no checkpoint1 answer left: stop"`). The guide quotes the rule that picked its concept
(`run-log.md`).
