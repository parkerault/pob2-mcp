# R1b-assemble: the dossier (`build-guide-coordinator`)

Slice 03 §5.2 (the verification phase) and §7.2; spine D-269, D-287, D-294, D-296, D-303, D-334. One step per
verification round, after every R1b step of the round. It writes `dossier.md`, what the verification gate shows
the user and what the design steps read: the brainstorm rounds' research and every verified card with its
skeleton's result.

## Inputs

- **Header:** `stage: "R1b-assemble"`, `attempt`, `mode`, `runFolder`, `compile: "none"`, `findings`
  (only an earlier attempt's note that it returned without its file: `dossier.md` may then hold its partial
  work, so make it whole), `writes: ["dossier.md"]`.
- **Prompt:** a `json` block for the round: `round` (the verification round), the parsed `brief`, the user's
  `note` for each brainstorm round; `researchFiles` (`{file, returned}`: `returned: false` means that
  researcher returned without its file, so its file may be missing or partial); and `cards`, each
  `{id, title, status, attempts, verdict}`: `status` `viable`, `failed`, or `can't be finalized yet` (its last
  R1b verdict's finding is `not-a-skill`: its damage source isn't a skill, D-303, D-334), with the R1b
  attempts it made and its last verdict file.
- **Read:** the template `.claude/skills/build-guide/templates/dossier-template.md`; the research files; each
  card of the round, `cards/<id>.md` (both halves); each card's last verdict file (its errors, `recordPath`
  and `leagueUnverified`), its `concepts/<id>/plan.json` (the key-item prices) and, where it compiled,
  `concepts/<id>/compile-record.json` (the key numbers: the named damage source's Count-scaled figures,
  `countedSkillOutputs[g<group>s<skill>p<statSet>].fields`, beside its raw `skillOutputs` fields; `Life`,
  `EnergyShield`, the four `Missing<Elem>Resist` values, each `<Type>MaximumHitTaken`, and `TotalEHP`);
  `cards.md` (the dealt cards not verified yet); `dossier.md` when an earlier round wrote it.

## Work

1. **Confirm each record.** For every card the input calls `viable`, check that
   `concepts/<id>/compile-record.json` exists beside its skeleton. If it doesn't, the card is `failed`:
   say so in its entry and in its comparison line. A card that can't be finalized yet has no skeleton,
   record or prices to confirm: it compiled nothing (D-334), and it is never `failed`.
2. **Write the dossier from the template**, keeping its H2s exactly, in order: `Roll and mode`,
   `Mechanics`, `Synergy search`, `Config gaps`, `Concepts`, `Not carried`. Nothing else is an H2.
   - **Roll and mode:** the brief (its fields as parsed; a fixed roll names its class, ascendancy and
     skill), the mode (offline: no web source and no price was consulted), the league (offline: none; online:
     the skeletons' league, and when any card has `leagueUnverified`, that it is **unverified** because trade
     couldn't be reached, so D1 must not take it from here), and one line per brainstorm round with its note
     and per verification round with its cards.
   - **Mechanics, Synergy search, Config gaps:** the research files' sections, merged and shortened
     where they repeat, every claim keeping its marker. A researcher that returned without its file leaves
     a line saying which part is missing (`research/p<k>-r1a-<n>.md returned no result`).
   - **Concepts:** one H3 `<id>: <title>` per verified card (viable or failed), in id order, with the
     template's labelled fields, filled from the card: `Key uniques`, `Ascendancy nodes`, `Supports` and
     `Keystones` from its chain, enabler and links; `Feasibility read` from its verification half, whether
     it reaches the endgame bar (all four resistances capped, the named damage source as the main damage
     source, a budget variant within 20 divines); `Risks` from its risks and its checklist's risks; `What
     PoB can't verify` from its links' "how PoB follows it" and its estimates. Then `Proposed in`
     (`cards/<id>.md`), `Skeleton`, `Compile` (compiled, or failed after N attempts with the last errors),
     `Record`, `Key numbers` (from the record, with markers, `TotalEHP` among them, D-294), `Key-item prices`
     (each dated, or `unavailable` with its note) and `Status` (`viable`, or `failed` with its evidence). When
     the card's payoff rests on a mechanic no lookup confirmed, or that has no source in the card (no item,
     node or gem that grants it), its `Risks` says so. A key number resting on Count above 1 or on a stage
     the record marks `computedWithCustomMods` is labelled `estimate` (D-296).
   - **A card that can't be finalized yet** (D-303, D-334): the same fields from its card, but `Skeleton:
     none`, `Compile: not compiled: its damage source isn't a skill`, `Record: none`, `Key numbers: none (not
     compiled)`, `Key-item prices: none (not compiled)`, and `Status: can't be finalized yet: its damage source
     isn't a skill`. It names no `concepts/<id>/` path: none exists.
   - **A `wrong-ascendancy` card** (D-342) is `failed`, and compiled nothing either: `Skeleton: none`,
     `Compile: not compiled: wrong-ascendancy`, `Record: none`, `Key numbers: none (not compiled)`,
     `Key-item prices: none (not compiled)`, and `Status: failed: <its finding's message>`.
   - **Not carried:** one line per card dealt in `cards.md` and not verified yet: its id, title and
     `cards.md`, which the verification gate can still verify; or `None.`
3. **A later round** keeps everything already in `dossier.md`: add this round's lines under Roll and mode,
   a new brainstorm round's material to Mechanics, Synergy search and Config gaps (start each addition with
   `Round <k>:`), its cards' H3s after the existing ones, the `Not carried` lines as they now stand, and its
   definitions after the existing ones. If `dossier.md` is missing (an earlier round's assembly never
   returned its file), write it from the template for this round, and say under Roll and mode which earlier
   rounds have no dossier entry.
4. **Markers** (`.claude/skills/build-guide/references/source-markers.md`). A claim copied from a
   research file keeps its marker and its definition line exactly: research ids (`p<k>r<n>-<m>`) are
   unique in the run. Your own claims use ids `<id>-<m>` (`r1-a-2-1`): a number from a skeleton's record is
   `pob-computed | <stageId>.<Field>` (the skeleton's stage id is the card id without its hyphens, then `e`,
   so the ref names its record); a price is `price | <priceId>`, an entry of that card's skeleton. Every
   marker has exactly one definition, and all definitions go at the end of the file, below the `Not carried`
   section, with no heading after them.

## Writes

`dossier.md` only.

## Returns

At most 8 lines: `dossier.md`, then the verification gate's comparison, one line per card of this round in id
order: its id, its status, its synergy in a few words, its key numbers from the record (the named source's
Count-scaled figure, `Life` and `TotalEHP`), its key prices (dated, or `unavailable`), and its main risk; a
failed card's line names its last verdict file. The figure is labelled `estimate` when its group's Count is
above 1 or the stage is `computedWithCustomMods` (D-296). A card that can't be finalized yet says so, with no
numbers, and isn't a failure.

```
dossier.md
r1-a-2 viable: bleed burst on rares; Blood Hunt 50,000 DPS (r1a2e g1s1p1 TotalDPS), Life 4,210, EHP 31,500; prices unavailable (offline); risk: chaos resistance
r1-b-2 viable: totem relay; Ancestral Warrior Totem 84,000 DPS, estimate (Count 2: two totems), Life 3,900, EHP 27,800; prices unavailable (offline); risk: totem placement
r1-b-1 failed after 3 attempts: FI-1 Unknown Gem (reports/gates/R1b-r1-b-1-a3.json)
r1-c-3 can't be finalized yet: its damage source isn't a skill (a flask nova); read-only checks only
```

## Fault directives

None.
