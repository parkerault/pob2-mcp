# The fix round, the re-check and the known issues (steps 12 to 14)

The runner's steps 12 to 14 in full, and the chain a revision at the final gate runs (slice 03 §5.2, as D-264
and D-352 amend it; `SKILL.md` §6). Read this when the full pass's report has an `unresolved` finding, or at
a revision.

## The round copy (A-34)

Before a fix round or a revision, run `node .claude/skills/build-guide/scripts/check-run.mjs <runFolder>
--snapshot <n>`, `<n>` the number of the report the round answers (for a revision, the last report's). It
copies `plan.json`, `compile-record.json` and `guide.md` into `rounds/<n>/` without you reading them, and you
never read them, there or in the run folder. Step 13's `--changed <n>` compares the run folder with that copy.

## Step 12, the fix round

Once, only when the report has an `unresolved` finding (D-264, D-352), after the round copy. Send each
`unresolved` finding to its `owner`: D1, D2 or W1. A finding marked `hinge: no` is fixed by removing or
narrowing the statement, never by new research or a recompile. Each owner fixes, in place with Edit, every
claim the issue touches, not only the flagged location: the claim's wording, citation, caveat or source. It
recompiles only when a finding needs a build change: gear, tree, gems or config. A change to a ledger entry's
formula or inputs, like a claim edit, needs no recompile and no gate: the run checker re-evaluates the ledger.
It returns the ids it fixed, the locations it changed and whether it recompiled.

- **D1 is D1-finish first** (D-356): D1's findings go to D1-finish, which fixes the claims, ledger, prices and
  anoint. When it returns `build: <ids>`, run D1-build with those findings, then D1-finish once more, its
  header's `changed` the locations D1-build returned: it re-prices, re-measures and re-claims what moved, and
  returns no `build:`. Then the gates.
- **The order.** The earliest owner runs first (D1, then D2), and W1 always runs last: it fixes its own
  findings and patches the guide in place wherever it repeats a claim another owner changed (their locations
  in its header's `changed`).
- **No owner recompiled** (claims only): no gate runs; D1 → W1, D2 → W1, D1 → D2 → W1 or W1 alone. Log each D1
  or D2 of the round with outcome `claims-edited`. The final record and the PoB file stay the last D2 gate's.
- **An owner recompiled:** its gates run as now: **D1** → D1 gate → D2 gate → W1; **D2** → D2 gate → W1. A
  step that is itself an owner gets its findings in `findings` (D2 after D1: D1 → D1 gate → D2 → D2 gate →
  W1; that D2 runs its gate even for claim edits, since the D1 gate's compile replaced the final record). Log
  each owner as `run-log.md` says: `done` when it recompiled, or when its gate follows a recompile before it
  (the D1-finish after D1-build, the D2 after a recompiled D1); `claims-edited` when it edited claims only (a
  claims-only D1 before a D2 that recompiled).
  W1 still patches the guide in place, its header's `changed` `"all"`: the import code and every record number
  the guide quotes may have moved.
- **No design gate** runs in the round: the user judged the build at the design gate, and the final gate
  shows the result.

The round is uncounted; the gates in it keep their 2 counted retries, and an escalation in it is a gate
escalation.

## Step 13, the re-check

Run `node .claude/skills/build-guide/scripts/check-run.mjs <runFolder> --changed <n>`, `<n>` the round copy's
number: it prints the claims whose text, source or cited record values changed since `rounds/<n>/`, and the
guide's changed H2s, one per line (`claim stages[<i>].claims[<k>] (<id>)`, `section <H2 title>`). Then start one
verifier, `check: "recheck"`, `writes: ["reports/V4-<n+1>.md"]`, `findings` the ids of report `<n>`'s
`unresolved` findings, and `changed` the lines the checker printed, as printed. It re-checks only those,
whether or not an owner recompiled: no re-check covers every claim (D-352). After a fix round's re-check there
is no further round: what stays open is a known issue; after a revision's, steps 12 to 16 follow (step 16).

## Step 14, known issues

The open findings are the `unresolved` findings of the last report, the `reports/V4-<n>.md` with the highest
`<n>`: a re-check reports again every finding still open. **Replace both lists whole** with Edit, every cycle
(D-265, D-276), reading only the lines you edit, from the line numbers W1 returned last (W1 returns them on its
first write and on every patch; no Grep: if a line isn't the heading, Read the file in parts until you find
it), down to the next heading or the end of the file:

- in `guide.md`, under `### Known issues`: first W1's lines for the accepted gate findings, as W1 wrote them;
  then one line per open finding, `- <reader>`, the finding's `reader` sentence exactly as its report gives
  it, with no id; or, with neither, the one line `None.`;
- in `audit.md`, under `## Known issues`: the table head, W1's rows for the accepted gate findings, then one
  row per open finding, `| <id> | V4 | — | <reader> |`; or, with neither, the one line `None.`.

Drop every other line and row: one from an earlier cycle is stale.

## A revision (the final gate's changes)

Asking for changes at the final gate is a revision (D-236), for guide-level changes; a build change belongs at
the design gate (D-362), though one asked here still runs through its owner. Map each request to D1, D2 or W1
by step 12's owners (the guide's text is W1's; an endgame stage, its ledger entries and prices D1's; a
campaign stage D2's). Make the round copy, `<n>` the last report's number; run that chain as step 12 does
(claims in place, the gates only after a recompile), with the requests as `findings` (`code:
"user-request"`); then step 13's re-check over `--changed <n>`, in the full pass's place: **a revision runs no
full pass** (D-352). Steps 12 to 16 then follow as after a full pass. A revision counts against no cap.
