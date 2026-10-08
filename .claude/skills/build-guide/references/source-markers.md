# Source markers, claims and verifier reports

Every claim shows its source (D-105, C-30). This page is how a claim is tagged in the plan and in
markdown (slice 03 §7.3), how claims are counted, and the V3/V4 report shape (§7.4). The run checker
counts claims the same way and fails a report whose coverage doesn't match.

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

## Counting claims (§7.4)

- A claim is **one definition line** in a markdown artifact, or **one `stages[].claims[]` entry** in the
  plan.
- Its section is the H2 of its first marker; in the plan, its stage.
- **Endgame** means the guide's two `Endgame:` H2s and the plan's `variant` stages. Everything else, the
  whole dossier included, is **elsewhere**.
- The counted artifacts are `plan.json`, `dossier.md` and `guide.md` (not the research files).

## Verifier reports

V3 and V4 agents can't write; their report is their structured return, and the skill writes it to
`reports/v3-<concept>-p<pass>.json` or `reports/v4-<lens>-<concept>-p<pass>.json` unchanged.

```json
{
  "stage": "V4",
  "lens": "sources",
  "concept": "c1",
  "pass": 1,
  "mode": "offline",
  "coverage": { "external": 0, "opened": 0, "data": 4, "dataChecked": 4, "pobDataEndgame": 3,
                "recheckedEndgame": 3, "pobDataOther": 6, "recheckedOther": 2, "prices": 3, "matched": 3 },
  "findings": [
    { "id": "f-eu-1", "artifact": "plan.json", "location": "stages[2].claims[5]",
      "claim": "…", "issue": "tagged external-unavailable", "evidence": "the run log's mode is offline",
      "owner": "D1", "status": "accepted-offline" }
  ],
  "verdict": "pass"
}
```

- `stage` is `V3` or `V4`; `lens` (V4 only) is `ledger`, `sources` or `prose`; `mode` is the run log's.
- Each finding has `id`, `artifact`, `location`, `claim`, `issue`, `evidence`, `owner` (`W1`, `D1`,
  `D2` or `dossier-fix`: the step that wrote the claim) and `status` (`unresolved` or
  `accepted-offline`).
- `verdict` is `pass` exactly when no finding is `unresolved`.
- `accepted-offline` is only for an `external-unavailable` claim in an offline run (C-30). In an online
  run such a claim is `unresolved`.

**Coverage**, by report:

| Report | `coverage` | Must hold |
|---|---|---|
| V3 (provenance: every claim has a well-formed tag) | `{plan, dossier, guide}`: the claims counted in each artifact | each equals the checker's count |
| V4 `ledger` (re-derives every ledger entry from the final record and its tagged inputs, and compares the record's value and every guide number citing it) | `{entries, rederived}` | `entries` = the plan's ledger entries; `rederived` = `entries` |
| V4 `sources` (opens every `external` source; checks every `data` claim against its fact and stored citation, without fetching offline; re-checks `pob-data` claims with the lookup tools; checks every `price` claim's amount, currency, date and league against its entry) | `{external, opened, data, dataChecked, pobDataEndgame, recheckedEndgame, pobDataOther, recheckedOther, prices, matched}` | the five totals equal the checker's counts; `opened` = `external`; `dataChecked` = `data`; `recheckedEndgame` = `pobDataEndgame` (all of them, D-179); `recheckedOther` ≥ 1 in 5 of `pobDataOther`, rounded up |
| V4 `prose` (mechanics claims the sources don't support; the rolled skill shown as the main damage source, D-122; budget statements per D-164 and D-219) | an object of the lens's own counts | — |
