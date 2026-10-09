# Source markers, claims and the V4 report

Every claim shows its source (D-105, C-30). This page is how a claim is tagged in the plan and in
markdown (slice 03 §7.3), the three rules every claim keeps, and the V4 report shape (§7.4, as amendment 1
changes it). The run checker checks that every marker resolves and parses as a tag; the V4 verifiers check
that every claim is true.

## Source tags (C-30)

A tag is `{kind, ref, accessed?, patch?, confidence?}`:

| `kind` | `ref` | Also required |
|---|---|---|
| `pob-computed` | a compile-record field: `<stageId>.<Field>`, or `<stageId>.g<group>s<skill>p<statSet>.<Field>` | — |
| `pob-data` | a pinned PoB `file:line`, or a lookup-tool result (`lookup_game_data gem "Blood Hunt"`) | — |
| `external` | an `http(s)` URL | `accessed` (YYYY-MM-DD) and `confidence` |
| `judgment` | the reasoning, in a few words | `confidence` |
| `external-unavailable` | exactly `external source unavailable (offline run)` | `confidence`; offline runs only |

`confidence` is `H`, `M` or `L`; `patch` names the game patch the source describes (`0.5.5`).

Instead of a tag, a claim may cite:

- `ledger:<id>`: a `ledger[]` entry of the plan (C-33), whose inputs carry their own tags;
- `price:<id>`: a `prices[]` entry, which holds the date, league and query (D-237);
- `data:<file>#<key>`: a C1/E1 fact, `<file>` relative to `data/`, `<key>` a fact id optionally followed
  by `[<member>]` (`data:enemies/map-monsters.json#life.by-level[79]`). The fact carries its own citation
  (D-232).

## In the plan

A claim is a `stages[].claims[]` entry `{id, text, source}`, where `source` is a tag object or one of
the citation strings above. The full schema is `docs/build-guide/plan-reference.md`.

## In markdown (`dossier.md`, `guide.md`, `research/*.md`)

A claim carries one or more footnote markers `[^<id>]`. Each id has **exactly one** definition line, and
the definitions sit under the file's **last heading** (`Sources` in the guide):

```
[^<id>]: <kind> | <ref> [| accessed: YYYY-MM-DD] [| patch: <p>] [| confidence: H|M|L]
[^<id>]: ledger | <ledgerId>
[^<id>]: data | <file>#<key>
[^<id>]: price | <priceId>
```

For example:

```
Blood Hunt consumes Blood Loss for a burst.[^g2] Chaos resistance stays at 28%.[^g5]

## Sources

[^g2]: pob-data | lookup_game_data gem "Blood Hunt" | patch: 0.5.4
[^g5]: pob-computed | b.ChaosResist
[^g6]: price | b-helmet
[^g9]: external | https://maxroll.gg/poe2/build-guides/… | accessed: 2026-10-08 | patch: 0.5.5 | confidence: M
[^g10]: judgment | PoB has no Blood Loss stack option | confidence: L
```

Every marker needs a definition; every `ledger`, `price` and `data` definition must name an existing
entry or fact. In `guide.md` they resolve against `plan.json`; in the dossier and research files, against
any plan of the run (concept skeletons included).

## The claim rules

Every step that writes a claim keeps these three rules, and the V4 lenses check every claim against them
(amendment 1 S7):

1. **Supported in every part.** The source supports all of the claim: each number, each mechanic and each
   qualifier ("always", "on hit", "against bosses"). A part its source doesn't support gets its own source,
   or goes.
2. **It cites each fact it rests on.** A claim resting on two facts (a gem's base damage and a support's
   multiplier; a quest reward and the act it is in) carries a marker, or a ledger entry, for each.
3. **It carries its source's caveats.** A source of confidence M or L, a fact whose `note` records a dispute,
   a `judgment`, or a mechanic no lookup confirmed is stated with that caveat wherever the claim appears
   (Summary, Rotation, the FAQ), never as settled.

A number or a mechanic stated without a marker is a claim without a source: the V4 `sources` lens reports
it.

## The V4 report

The verifiers can't write (R-5): a report is the verifier's return, and the runner writes it unchanged to
`reports/v4-<lens>.json` (the full pass, `check: "full"`) or `reports/v4-<lens>-recheck.json` (the re-check,
`check: "recheck"`).

```json
{
  "stage": "V4",
  "lens": "sources",
  "check": "full",
  "concept": "c1",
  "mode": "offline",
  "findings": [
    { "id": "v4-sources-1", "artifact": "plan.json", "location": "stages[2].claims[5]",
      "claim": "…", "issue": "tagged external-unavailable", "evidence": "the run log's mode is offline",
      "owner": "D1", "status": "accepted-offline" }
  ],
  "verdict": "pass"
}
```

- `stage` is `V4`; `lens` is `ledger`, `sources` or `prose`; `check` is `full` or `recheck`, as the header
  says; `mode` is the run log's. The dossier isn't verified: it serves the checkpoint-1 pick, and the guide
  can't cite it (amendment 1 S3).
- Each finding has `id`, `artifact` (`plan.json` or `guide.md`), `location`, `claim`, `issue`, `evidence`,
  `reader` (only when `unresolved`), `owner` (`W1`, `D1` or `D2`: the step that wrote the claim) and
  `status`: `unresolved`, `accepted-offline`, or in a re-check `fixed` (a finding of the header's `findings`
  that now holds).
- `reader` (D-265) is one plain sentence the guide's reader can act on: what is wrong in the guide and what
  is true instead, in the guide's words, with no pipeline words (lens, finding, owner, claim, location) and
  no JSON path: "The Act 1 resistance line is wrong: stage 2 already has 40% fire resistance." Only an
  `unresolved` finding can become a known issue, so only it carries one; the run checker fails an
  `unresolved` finding without it. A `fixed` or `accepted-offline` finding needs none.
- `verdict` is `pass` exactly when no finding is `unresolved`.
- `accepted-offline` is only for an `external-unavailable` claim in an offline run (C-30), and only in the
  V4 `sources` report, its `location` naming that claim (`stages[<i>].claims[<k>]` or `<file> [^<id>]`).
  In an online run such a claim is `unresolved`. The run checker resolves the location and fails any other
  `accepted-offline`.
- **Open findings.** A finding is open after the re-check when its lens's re-check reports it
  `unresolved`, or when the full pass reports it `unresolved` and no re-check reports it `fixed`. The runner
  replaces the guide's `Known issues` list every cycle: W1's accepted-gate-finding lines, then every open
  finding as `- <reader> (<id>)`, its `reader` sentence as the report gives it, then its id in parentheses
  (SKILL.md step 14, D-265). The run checker finds each line by its id, requires its text to be the finding's
  `reader` sentence, and fails any other line.
- A superseded report (a later report of its lens ran after it) is checked against the artifact as it was
  when it was written: once a step wrote that artifact after it, the run checker doesn't resolve its
  locations (D-265).
