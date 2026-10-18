# Offline mode, the test config and fault directives

(slice 03 §11; D-201, D-233, A-28, D-157, D-288, D-323, D-333, D-335, D-362, D-394)

## Offline mode (`--offline`)

Started only explicitly, with `--offline`; the run log records `mode: "offline"`. In offline mode:

- **No web and no prices.** No step calls a trade tool, `mcp__pob2__get_currency_rates`, WebSearch or WebFetch, even
  if one is available. In the M-12 environment those tools are removed, so the rule is enforced, not just
  followed.
- **Research uses only the server's lookup tools and the committed C1/E1 files** (`data/campaign/`,
  `data/enemies/`), not `docs/design/grounding/`. A claim taken from C1/E1 cites its fact as
  `data:<file>#<key>` in the plan, or `data | <file>#<key>` in markdown (D-232).
- **Every price is `unavailable`** with `note: "offline run"`, `league: null`, `amount` and `currency`
  null, dated the run folder's date (D-164); the plan's `league` is null, which the plan schema allows
  only when every price is like that (D-233). See `pricing.md`.
- **A claim that would need an external source** is tagged `external-unavailable`, with ref exactly
  `external source unavailable (offline run)` and a confidence (C-30). V4 accepts that tag (status
  `accepted-offline`) only when the run log's mode is `offline`; in any other run it is an `unresolved`
  finding, and the run checker fails it.
- The guide's `Your PoB file` says the run was offline and no price was checked (D-276); `audit.md`'s
  `Inputs by confidence` lists the claims that would need an external source (D-278).

## No currency rates (`--no-ninja`; D-333, D-335)

`--no-ninja` turns off group `ninja`, whose one tool is `mcp__pob2__get_currency_rates`: no step calls it. The
runner tells every pricing step, the D1 gate included, that there are no currency rates. Prices are still
checked online, but totals in divines are `unverified`, pricing's path when rates are missing (`pricing.md`),
so the guide can't state a rung's total. Offline mode turns the rates off anyway.

There are no poe.ninja tools beyond the currency rates (D-335): poe.ninja's terms close its builds API, so no
tool supplies player evidence. In every run, offline or not, a card says "no player evidence" unless the
brief's `popularity` notes speak to it, cited as the user's notes.

## The test config (`--test <path>`, offline only; A-28)

`--test <path>` names a JSON file:

```json
{
  "answers": {
    "brainstorm": [
      { "ask": ["Which card clears fastest?"], "answer": "pick:r1-a-1",
        "changes": { "r1-a-1": "use a two-handed spear" },
        "newCards": [{ "name": "Bleeding Shield Wall", "from": ["r1-a-1", "r1-c-2"], "words": "the lunge behind a shield" }] }
    ],
    "verification": ["first-viable"],
    "design": ["accept"],
    "final": ["accept"],
    "escalation": ["retry:keep the budget variant's helmet"],
    "unsavedBuild": "proceed"
  },
  "faults": [
    { "id": "FI-1", "concepts": ["r1-a-1"], "persistent": true },
    { "id": "FI-2", "concepts": "all", "persistent": false }
  ]
}
```

The answers are `brainstorm`, `verification`, `design` and `final`, one per gate (D-323, D-362;
`checkpoints.md` has their values), with `escalation` and `unsavedBuild` for the questions. `answers.design[]`
answers the design gate, one per visit: `accept`, `revise:<text>`, `verification` or `stop`; when it runs out,
the answer is `stop` (`answeredBy: "default"`, rule `no design answer left: stop`), so the run ends `stopped`.
`checkpoint1` and `checkpoint2` are retired with the run log's schema 3. A fault's `concepts` lists
card ids (D-319), or `"all"`.

**An answer entry scripts an interview** (D-394): a string, or an object `{ask?, answer, changes?, newCards?,
note?}`, `answer` one of the gate's strings. `changes`, `newCards` (each `{name, from, words}`; you assign the
id) and `note` go only on brainstorm and verification entries, with the answers `checkpoints.md` gives them; the
config says which kind each change is. First check each new card against `cards.md`: its `from` names cards the
deck lists, and its name, ignoring case, is none the deck or an earlier `newCards` holds. Then answer each `ask`
as you would the user's, gate question steps included, write the interview notes, and take `answer` with no
confirmation: the checkpoint's `rule` is `answer` as written, its `questions` the `ask` count.

- **Accepted only with `--offline`.** Then `testConfig: "accepted"`: its answers replace the user's at
  gates and questions (`checkpoints.md` lists what each answer means and the defaults when they run
  out), and its faults are applied.
- **Without `--offline`** the runner records `testConfig: "refused"`, ignores the file (no answer, no
  fault) and asks the user at every gate (D-157). Say so in the reply.
- A file that can't be read or isn't this shape, given with `--offline`, is refused too
  (`testConfig: "refused"`), and the run stops before research: status `stopped`, and the reason in the
  reply (`stopped: malformed test config <path>: <what is wrong>`), as `test-config` prints it (`start.md`).
- **An entry the deck refuses** (that first check): answer no `ask` and write no notes; the run ends `stopped`,
  logged answer `stop`, `answeredBy: "default"`, `questions: 0`, rule `refused answers.<gate>[<i>]: <why>`.
- Without `--test`, `testConfig: "none"`.

## Fault directives (test config only)

Each directive names its target cards (a list of card ids, or `"all"`) and whether it is `persistent`
(every attempt) or applies to attempt 1 only (`persistent` missing or `false`). The runner puts a
directive only into the task headers of the steps it targets, in the header's `faults` (`task-header.md`).
The step that applies one reports it, and the runner logs each directive in `faults[]` as
`{id, target, applied, observed}` (`target` as the test config wrote it; `applied` counts the headers that
carried it; `observed` says what failed as a result).

**Retries** (amendment 1 S6). An attempt failed by a directive that applies to attempt 1 only re-runs
free: it counts against no retry cap. A persistent directive's failed attempts count, so the cap still
ends the flow: a persistent FI-1 fails its card after 3 attempts (WU-47's run A failed concept `c1` so), and a
persistent FI-2 escalates the D1 gate on its third failure (run B's `c2`). The run checker counts the same way.

| Id | Applied by, when | Edit | Must then fail |
|---|---|---|---|
| FI-1 | the R1b step, before the attempt's first compile: the bootstrap, which then always runs (`stages/R1b.md` step 2), so a faulted attempt compiles nothing clean and a concept it fails leaves no clean record (D-265) | add a support gem named `FI-1 Unknown Gem` to the skeleton's main socket group | that first compile, with a per-stage error naming the gem (D-162); the attempt stops there. Unless the card already failed the ascendancy lock (`wrong-ascendancy`, D-342) or is `not-a-skill` (D-334): it then compiles nothing, so FI-1 applies to nothing |
| FI-2 | the D1 gate step, before its compile | set the first endgame stage's `level` to 1 in `plan.json`, and its `loadoutName`'s `(L<n>)` to `(L1)` so the plan stays valid (C-31 ties the two) | V1, for that stage: its points and requirements exceed level 1 |
| FI-3 | the D1 gate step | none: the gate's outcome is forced to `infeasible`, with evidence `FI-3 (injected)` | control flow only: the route back to the verification gate (D-287) |

FI-4 and FI-5 (the seeded V4 checks) are applied by the build coordinator to a copy of a run folder, not
through the skill.
