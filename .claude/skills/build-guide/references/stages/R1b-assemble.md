# R1b-assemble: the dossier (`build-guide-coordinator`)

Slice 03 §5.2 step 4 and §7.2. One step per research round, after every R1b step of the round. It writes
`dossier.md`, what checkpoint 1 shows the user and what the design steps read: the round's research and
every concept with its skeleton's result.

## Inputs

- **Header:** `stage: "R1b-assemble"`, `attempt`, `mode`, `runFolder`, `compile: "none"`, `findings`
  (only an earlier attempt's note that it returned without its file: `dossier.md` may then hold its partial
  work, so make it whole), `writes: ["dossier.md"]`.
- **Prompt:** a `json` block for the round: `round`, `firstId`, the user's `note`; `researchFiles`
  (`{file, returned}`: `returned: false` means that researcher returned without its file, so its file may
  be missing or partial); and `concepts`, each `{id, title, proposedIn, status, attempts, verdict}`:
  `status` `viable`, `failed` or `not-carried`, and for a carried concept the R1b attempts it made and its
  last verdict file.
- **Read:** the template `.claude/skills/build-guide/templates/dossier-template.md`; the round's
  research files; each carried concept's last verdict file (its errors, `recordPath` and
  `leagueUnverified`), its `concepts/<id>/plan.json` (the key-item prices) and, where it compiled,
  `concepts/<id>/compile-record.json` (the key numbers: the rolled skill's damage figures, its
  `g<group>s<skill>p<statSet>` fields, `Life`, `EnergyShield`, the four `Missing<Elem>Resist` values and
  each `<Type>MaximumHitTaken`); `dossier.md` when an earlier round wrote it.

## Work

1. **Confirm each record** (§5.2 step 4). For every concept the input calls `viable`, check that
   `concepts/<id>/compile-record.json` exists beside its skeleton. If it doesn't, the concept is `failed`:
   say so in its entry and in its comparison line.
2. **Write the dossier from the template**, keeping its H2s exactly, in order: `Roll and mode`,
   `Mechanics`, `Synergy search`, `Config gaps`, `Concepts`, `Not carried`. Nothing else is an H2.
   - **Roll and mode:** the roll (class, ascendancy, rolled skill), the mode (offline: no web source and
     no price was consulted), the league (offline: none; online: the skeletons' league, and when any
     concept has `leagueUnverified`, that it is **unverified** because trade couldn't be reached, so D1
     must not take it from here), and one line per research round with its note.
   - **Mechanics, Synergy search, Config gaps:** the research files' sections, merged and shortened
     where they repeat, every claim keeping its marker. A researcher that returned without its file leaves
     a line saying which part is missing (`research/p<k>-r1a-<n>.md returned no result`).
   - **Concepts:** one H3 `<id>: <title>` per carried concept (viable or failed), in id order, with the
     template's labelled fields: the seven from its proposal (copied from the research file), then
     `Proposed in`, `Skeleton`, `Compile` (compiled, or failed after N attempts with the last errors),
     `Record`, `Key numbers` (from the record, with markers), `Key-item prices` (each dated, or
     `unavailable` with its note) and `Status` (`viable`, or `failed` with its evidence). When the
     concept's payoff rests on a mechanic no lookup confirmed, or that has no source in the concept (no
     item, node or gem that grants it), its `Risks` says so.
   - **Not carried:** one line per `not-carried` concept: its id, title, research file and why (the round
     already carried 3, D-235); or `None.`
3. **A later round** (`round` ≥ 2) keeps everything already in `dossier.md`: add this round's line under
   Roll and mode, its new material to Mechanics, Synergy search and Config gaps (start each addition
   with `Round <k>:`), its concepts' H3s after the existing ones, its not-carried lines, and its
   definitions after the existing ones. If `dossier.md` is missing (an earlier round's assembly never
   returned its file), write it from the template for this round, and say under Roll and mode which earlier
   rounds have no dossier entry.
4. **Markers** (`.claude/skills/build-guide/references/source-markers.md`). A claim copied from a
   research file keeps its marker and its definition line exactly: research ids (`p<k>r<n>-<m>`) are
   unique in the run. Your own claims use ids `<id>-<m>` (`c2-1`): a number from a skeleton's record is
   `pob-computed | <stageId>.<Field>` (the skeleton's stage id starts with the concept id, so the ref
   names its record); a price is `price | <priceId>`, an entry of that concept's skeleton. Every marker
   has exactly one definition, and all definitions go at the end of the file, below the `Not carried`
   section, with no heading after them.

## Writes

`dossier.md` only.

## Returns

At most 8 lines: `dossier.md`, then the checkpoint-1 comparison, one line per concept of this round in id
order: its id, its status, its synergy in a few words, its key numbers from the record, its key prices
(dated, or `unavailable`), and its main risk; a failed concept's line names its last verdict file.

```
dossier.md
c1 viable: bleed burst on rares; Blood Hunt 50,000 DPS (c1e.g1s1p1.TotalDPS), Life 4,210; prices unavailable (offline); risk: chaos resistance
c2 failed after 3 attempts: FI-1 Unknown Gem (reports/gates/R1b-c2-a3.json)
c4 not carried: the round already carried 3
```

## Fault directives

None.
