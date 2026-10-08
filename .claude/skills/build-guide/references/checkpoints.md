# Checkpoints, questions and escalations

The skill stops for the user at two checkpoints and at two kinds of question (slice 03 §10, §5.4;
D-125, D-157, D-210, D-235, D-236). Each is asked with AskUserQuestion; if the choices exceed one
question's option limit, split them across two questions. In offline test mode the test config answers
instead (`offline-and-test.md`), and only there (A-28). Every presentation and answer is recorded in the
run log's `checkpoints[]` (`shown`, `answer`, `answeredBy`, `at`), plus `timeline[]`.

## The unsaved-build question (FR-W2 step 4; D-210)

Asked once, right after the run log's first write, when `guide_run {new_run}` replied
`loadedBuildUnsaved: true`. The run's first compile replaces the engine's loaded build, so:

- **proceed**: the run continues, and the loaded build's unsaved changes will be discarded;
- **stop**: the run ends `stopped`. Nothing has been compiled, and no research has started.

Say which build it is when the reply names it, and that the user can save it first (with
`lua_save_build`, outside this run) and start again. Recorded as checkpoint `unsaved-build`. With a test
config, `answers.unsavedBuild` answers it; with none there, the answer is `stop`
(`answeredBy: "default"`).

## Checkpoint 1: pick a concept

Shown after every research round, and after a design result sends the run back here.

- **Show**, per concept of the run (every round, not only the last): its synergy in a line, numbers from
  its skeleton's record, key prices (dated, or `unavailable`), risks, what PoB can't verify, and its
  status (`viable`, `failed`, `not-carried`). Give the dossier's path. After an `infeasible` design
  result or an escalation sent back here, show that concept's evidence. With no viable concept, show the
  best attempts and why each fails (D-141).
- **Ask**: pick a concept (a failed one may be picked anyway), ask for more, or stop.
  - **pick**: the design workflow runs for that concept.
  - **ask for more** (D-235): a new research round of up to 3 concepts, with the user's note. Its
    `firstId` is one more than the highest concept id so far. Only this answer starts a round; the skill
    never starts one on its own.
  - **stop**: the run ends `stopped`.

## Checkpoint 2: the guide

Shown when the design workflow returns `ready`.

- **Show** the guide's path; the V3 and V4 verdicts with finding counts by status; the gate verdicts; a
  run-log summary (times as the log has them, agents, retries, revisions, price calls); when any price is
  `unavailable`, that the variant can't be claimed to be under budget (D-164); and in offline mode, that
  the guide is from an offline run.
- **Ask**: accept, ask for changes, or anything else.
  - **accept**: the run ends `completed`.
  - **changes** (D-236): a revision. The design workflow resumes with
    `{reason: "revision", round, requests}`; its `revise-map` step maps each request to the step that
    owns it, which re-runs with every later step and the checks. Revisions count against no retry cap.
    Record `{round, requests: [{text, owner}]}` in `revisions[]`, then come back to checkpoint 2.
  - **any other answer**: the run ends `not-accepted`, with the user's note recorded as the answer.

## Escalations (§5.4; D-127, D-141, D-236)

A step that fails its gate, errors or returns nothing has failed that attempt and re-runs with the
findings. After **2 retries per (stage, concept)** the workflow returns `escalated` with every attempt's
findings. The skill records it in `escalations[]`, shows the stage, the attempts, the findings and the
artifact paths, and asks:

1. **accept**: the design workflow resumes with `{reason: "accepted", stage, findings}`. Findings equal
   to these (same gate stage and `code`, or the same V3/V4 finding `id`) fail no gate afterwards, and the
   guide lists each under an H3 `Accepted failures` in "Confidence and what PoB can't model", by its
   `code` or `id` and its stage (the run checker looks for them there). **Not
   offered when the failure is a compile error**: nothing compiled to continue from.
2. **guidance and one more retry**: the user's guidance goes in; the design workflow resumes with
   `{reason: "guided-retry", stage, findings, guidance}`. That attempt counts against no cap, and if it
   fails, the run escalates again.
3. **back to checkpoint 1**, with the findings as that concept's evidence.
4. **stop**: the run ends `escalated`.

Record the choice (and any guidance) on the escalation entry, and the question as checkpoint
`escalation`. With a test config, `answers.escalation[]` answers each escalation in turn; with none left,
the answer is `stop` (`answeredBy: "default"`), so the run ends `escalated`.

## Pre-supplied answers (offline test mode only)

| Question | Test config answer | Meaning |
|---|---|---|
| unsaved build | `answers.unsavedBuild`: `proceed` or `stop` | none given: `stop`, `default` |
| checkpoint 1 | `answers.checkpoint1[]`, one per visit: `first-viable`, `pick:<id>`, `more` or `stop` | `first-viable` is the first `viable` concept not yet designed in this run, else `stop` |
| checkpoint 2 | `answers.checkpoint2[]`, one per visit: `accept`, `not-accept` or `revise:<text>` | |
| escalation | `answers.escalation[]`, one per escalation: `accept`, `retry:<guidance>`, `checkpoint-1` or `stop` | none left: `stop`, `default` |

When `checkpoint1` or `checkpoint2` answers run out, the run ends `stopped` (recorded as answer `stop`,
`answeredBy: "default"`). Record a used answer with
`answeredBy: "pre-supplied"` and the answer it resolved to (`first-viable` → `pick:c3`).
