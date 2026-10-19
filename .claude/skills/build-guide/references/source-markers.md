# Source markers, claims and the V4 report

Every claim shows its source (D-105, C-30): the plan's claims carry their tags, and the guide renders the
plan with no markers at all (D-276). This page is how a claim is tagged in the plan and in the research
markdown (slice 03 §7.3), the three rules every claim keeps, and the V4 report (§7.4, as amendment 4
changes it, D-352). The run checker checks that every marker resolves and parses as a tag, and that
`guide.md` carries none; the V4 verifier checks that every hinge claim is true.

## Source tags (C-30)

A tag is `{kind, ref, accessed?, patch?, confidence?}`:

| `kind` | `ref` | Also required |
|---|---|---|
| `pob-computed` | a compile-record field: `<stageId>.<Field>`, or `<stageId>.g<group>s<skill>p<statSet>.<Field>`; a minion's is `Minion<Field>` (`b.g1s1p1.MinionTotalDPS`, D-376) | — |
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
the citation strings above. The full schema is `docs/build-guide/plan-reference.md`. A claim exists only for
a fact the guide states or a gate needs (D-279): the mechanics the build depends on, why a support, node or
item is in or out, requirements, gem and trial timing, reward picks, rules of thumb with a number, traps, an
either/or pick's deciding factor and an affix's source where it limits the base. Gem levels, stage levels,
record numbers, ledger values and prices are held already and need none, and so does first-person advice.

## In markdown (`research/*.md`)

`guide.md` carries **no markers** (D-276): it renders the plan, whose claims carry its sources, and the run
checker fails a `[^`, a confidence label or a finding id anywhere in it. `audit.md` carries none either, nor
does the dossier, a table of record numbers and price entries found by each row's card id (D-355). In the
research files, a claim carries one or more footnote markers `[^<id>]`. Each id has **exactly
one** definition line, and the definitions sit under the file's **last heading**:

```
[^<id>]: <kind> | <ref> [| accessed: YYYY-MM-DD] [| patch: <p>] [| confidence: H|M|L]
[^<id>]: ledger | <ledgerId>
[^<id>]: data | <file>#<key>
[^<id>]: price | <priceId>
```

For example:

```
Blood Hunt consumes Blood Loss for a burst.[^d2] The skeleton keeps chaos resistance at 28%.[^d5]

## Sources

[^d2]: pob-data | lookup_game_data gem "Blood Hunt" | patch: 0.5.4
[^d5]: pob-computed | r1a2e.ChaosResist
[^d6]: price | r1-a-2-helmet
[^d9]: external | https://maxroll.gg/poe2/build-guides/… | accessed: 2026-10-08 | patch: 0.5.5 | confidence: M
[^d10]: judgment | PoB has no Blood Loss stack option | confidence: L
```

Every marker needs a definition; every `ledger`, `price` and `data` definition must name an existing
entry or fact, in any plan of the run (concept skeletons included). A research file's `data` definition may
also name an entry of a Markdown data file by its id, `data | league/<slug>.md#<id>` (`lookups.md`, D-400); a
plan never cites one.

## The claim rules

Every step that writes a claim keeps these three rules, and V4 checks every hinge claim against them
(amendment 1 S7, D-352):

1. **Supported in every part.** The source supports all of the claim: each number, each mechanic and each
   qualifier ("always", "on hit", "against bosses"). A part its source doesn't support gets its own source,
   or goes.
2. **It cites each fact it rests on.** A claim resting on two facts (a gem's base damage and a support's
   multiplier; a quest reward and the act it is in) carries a marker, or a ledger entry, for each.
3. **It carries its source's caveats.** A source of confidence M or L, a fact whose `note` records a dispute,
   a `judgment`, or a mechanic no lookup confirmed is stated with that caveat. In the guide the caveat
   appears once, where the reader acts on it, and is never later stated as settled (D-279).

A plan claim without a `source`, or a research or dossier claim without a marker, is a claim without a source:
V4 reports a plan claim's. A fact the guide states that no plan claim, record field, ledger entry or price
holds is a V4 finding of its editor read.

## The V4 report

One verifier, one pass, no lenses (D-352). Each pass writes its own report, `reports/V4-<n>.md`, with its
one Write, and never overwrites one: `<n>` is one more than the last report's, 1 for the run's first. The
full pass checks every hinge claim and every H2 of `guide.md`; a re-check, after the fix round or a
revision, checks only what `check-run.mjs --changed <n-1>` printed, against the round copy `rounds/<n-1>/`.
The report is markdown, read by line; `stages/V4.md` (Writes) gives it with an example:

```markdown
# V4-<n>: <full pass, or re-check of rounds/<n-1>>

- check: <full or recheck>
- concept: <card id>
- mode: <offline or online, the run log's>
- verdict: <pass or fail>

## Checked

- claim stages[<i>].claims[<k>] (<claim id>)
- section <H2 title>

## Findings

### v4-<n>-<k>

- status: <unresolved, accepted-offline, or fixed in a re-check>
- hinge: <yes or no>
- owner: <D1, D2 or W1>
- artifact: <plan.json or guide.md>
- location: <stages[<i>].claims[<k>] (<claim id>), or <H2 title>, line <n>>
- claim: <the claim's text, or the guide's sentence>
- issue: <what is wrong>
- evidence: <what was looked up or derived, with the numbers>
- reader: <one plain sentence for the guide's reader; an unresolved finding only>
```

- Each field is one `- <key>: <value>` line with its value on that line, in this order. `## Findings` holds
  one H3 per finding, its id, or the one line `None.`.
- `## Checked` lists what the pass checked: in the full pass, every hinge claim and every H2 of `guide.md`;
  in a re-check, every line `--changed` printed, as printed. The run checker fails a re-check that misses one,
  and an overwritten report.
- `hinge` is the triage (`stages/V4.md`): a `hinge: no` finding is fixed by removing or narrowing the
  statement, never by new research or a recompile, and a difference under 5% in an estimate is no finding.
- `owner` is the step that wrote it: `W1` for `guide.md`; for a plan claim, `D1` on an endgame stage and `D2`
  on a campaign stage. The dossier isn't verified: it serves the verification gate's pick, and the guide
  can't cite it (amendment 1 S3).
- `status` is `unresolved`, `accepted-offline`, or in a re-check `fixed` (a finding of the header's
  `findings` that now holds). A re-check reports again, under its id, every finding still open: one nothing
  changed stays `unresolved` as it was.
- `reader` (D-265) is one plain sentence the guide's reader can act on: what is wrong in the guide and what is
  true instead, in the guide's words, with no pipeline words (lens, finding, owner, claim, location) and no JSON
  path: "The budget gloves line is wrong: Arcane Surge on Crit is a desecrated modifier, so the gloves need an
  energy shield base." Only an `unresolved` finding can become a known issue, so only it carries one; the run
  checker fails an `unresolved` finding without it. A `fixed` or `accepted-offline` finding needs none.
- `verdict` is `pass` exactly when no finding is `unresolved`.
- `accepted-offline` is only for an `external-unavailable` claim in an offline run (C-30), its `location`
  naming that plan claim (`stages[<i>].claims[<k>] (<claim id>)`). In an online run such a claim is
  `unresolved`. The run checker resolves the location and fails any other `accepted-offline`.
- **Open findings.** The findings open after the checks are the `unresolved` findings of the last report,
  the `reports/V4-<n>.md` with the highest `<n>`. The runner replaces both Known issues lists every cycle
  (SKILL.md step 14, D-265, D-276): in the guide, W1's accepted-gate-finding sentences, then every open
  finding as `- <reader>`, its `reader` sentence as the report gives it, with no id; in `audit.md`'s table,
  W1's accepted rows, then every open finding's row `| <id> | V4 | — | <reader> |`. The run checker finds
  each open finding's sentence in the guide, by sentence, and its id in `audit.md`, and fails any other line
  or row.
- A superseded report (a later report ran after it) is checked against the artifact as it was when it was
  written: once a step wrote that artifact after it, the run checker doesn't resolve its locations (D-265).
