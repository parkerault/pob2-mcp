# R1b-assemble: the dossier (`build-guide-coordinator`)

One step per verification round, after every R1b step of the round, and a second pass after the rival's R1b
(D-408). It writes `dossier.md`, the verification gate's comparison table (D-355): one row per verified card,
with its status, its synergy, its key numbers from the record, its clear speed, its key prices and its main risk.
The user picks from it at the verification gate, and the design steps and W1 read their card and its row. The
research files and the cards keep the rest: the dossier merges no research.

## Inputs

- **Header:** `stage: "R1b-assemble"`, `attempt`, `mode`, `runFolder`, `compile: "none"`, `findings`
  (only an earlier attempt's note that it returned without its file: `dossier.md` may then hold its partial
  work, so make it whole), `writes: ["dossier.md"]`, with `"cards.md"` when the round verified a card made at a
  gate.
- **Prompt:** a `json` block for the round: `round` (the verification round), the parsed `brief`, the user's
  `note` for each brainstorm round; and `cards`, each `{id, name, status, attempts, verdict}`: `status`
  `viable`, `failed`, or `can't be finalized yet` (its last R1b verdict's finding is `not-a-skill`: its damage
  source isn't a skill, D-303, D-334; or `not-in-pin`: it rests on an entry the PoB pin doesn't know, D-400),
  with the R1b attempts it made and its last verdict file. **The rival's pass** (D-408): `cards` holds the
  rival's card alone, `r<k>-x-<n>`; keep every row and add its row below the round's.
- **Read**, the independent reads in one response:
  - the template `.claude/skills/build-guide/templates/dossier-template.md`, and `dossier.md` when an earlier
    round wrote it;
  - each card of the round, `cards/<id>.md`: its Why pick it (the synergy), its risks and its checklist's
    risks;
  - each card's last verdict file (its errors, `recordPath` and `leagueUnverified`);
  - where it compiled, its record's key numbers, by Grep, never the record whole: in
    `concepts/<id>/compile-record.json`, the named damage source's Count-scaled figure
    (`countedSkillOutputs[g<group>s<skill>p<statSet>].fields`, its group's `count`; `MinionTotalDPS` when the
    group names a minion skill, else `TotalDPS`, D-378), `Life`, `TotalEHP`, `computedWithCustomMods` and
    `measures.clearSpeed` (its `speed`, `noArea` and `skill`); and its key-item prices, converted, from the card's
    `Key item prices`.

## Work

1. **Confirm each record.** For every card the input calls `viable`, check that
   `concepts/<id>/compile-record.json` exists beside its skeleton. If it doesn't, the card is `failed`:
   say so in its row and in its comparison line. A card that can't be finalized yet has no skeleton,
   record or prices to confirm: it compiled nothing (D-334), and it is never `failed`.
2. **Write the dossier from the template**: its H1, the one brief line, and the table, with its eleven columns
   exactly, in order: `Card`, `Round`, `Status`, `Synergy`, `Named source DPS`, `Life`, `EHP`, `Clear speed`,
   `Key prices`, `League`, `Main risk`. No H2, no H3, no markers: each number is the card's record's, each price
   its skeleton's entry, and the row's card id finds both.
   - **The brief line:** the brief (its fields as parsed; a fixed roll names its class, ascendancy and skill),
     the mode (offline: no web source and no price was consulted), and the rounds: each brainstorm round with
     its note, each verification round with its cards.
   - **A viable card's row:** the named source's Count-scaled figure with its field, labelled `estimate` when its
     group's Count is above 1 or the stage is `computedWithCustomMods` (D-296); `Life`; `TotalEHP` as `EHP`
     (D-294); the clear speed (D-407), the record's `speed` with `(rough)`, or `<speed> (PoB gives no area)` when
     `noArea` is true and it names a skill; each key-item price as the card gives it, a range with its day
     (`about 3.2–7.2 divines around day 7`), or `unavailable` with its note; the league (offline:
     `none (offline)`; online: the skeleton's league, and `<league>, unverified` when its verdict has
     `leagueUnverified`, so D1 doesn't take it); and its main risk. When the card's payoff rests on a mechanic no
     lookup confirmed, or that has no source in the card (no item, node or gem that grants it), its main risk
     says so.
   - **A failed card's row:** `failed after <N> attempts: <the last errors>; <its last verdict file>`, and `—` in
     every number, clear speed, price and league cell. A `wrong-ascendancy` card (D-342) is `failed: <its
     finding's message>`, with `—` too: it compiled nothing. The rival's `not-dealt` card is `failed after 1
     attempt: not dealt: <the check it failed>; <its verdict file>` (D-408).
   - **A card that can't be finalized yet** (D-303, D-334): `can't be finalized yet: its damage source isn't
     a skill`, or `can't be finalized yet: waits on the pin` for a `not-in-pin` card (D-400), `—` in every
     number, clear speed, price and league cell, and its main risk what finalizing it waits on. It names no
     `concepts/<id>/` path: none exists.
3. **A later round** keeps every row already in `dossier.md` and adds this round's below them, in id order, and
   adds the round to the brief line; the rival's pass adds `and the rival r<k>-x-<n>` to its round there. If
   `dossier.md` is missing (an earlier round's assembly never returned its file), write it from the template for
   this round, and say in the brief line which earlier rounds have no rows.
4. **A card made at a gate** (`r<k>-g-<n>`, D-391), failed or not: add its line to `cards.md` under `## Round
   <k>`, after that round's last line, and change nothing else there:
   `- <id> "<Name>" | <what it adds> | made at the gate (visit <v>): from "<Name>" and "<Name>"`, the visit and
   the names from its card's `Made at the gate` line.

## Writes

`dossier.md`, and in `cards.md` only a gate-made card's line.

## Returns

At most 8 lines: `dossier.md`, then the verification gate's comparison, one line per card of this round in id
order: its id, its status, its synergy in a few words, its key numbers from the record (the named source's
Count-scaled figure, `Life`, `TotalEHP` and the clear speed), its key prices (ranges with their day, or `unavailable`), and its main risk; a
failed card's line names its last verdict file. The figure is labelled `estimate` when its group's Count is
above 1 or the stage is `computedWithCustomMods` (D-296). A card that can't be finalized yet says so, with no
numbers, and isn't a failure.

```
dossier.md
r1-a-2 viable: bleed burst on rares; Blood Hunt 50,000 DPS (r1a2e g1s1p1 TotalDPS), Life 4,210, EHP 31,500, clear medium (rough); prices unavailable (offline); risk: chaos resistance
r1-b-2 viable: totem relay; Ancestral Warrior Totem 84,000 DPS, estimate (Count 2: two totems), Life 3,900, EHP 27,800, clear slow (PoB gives no area); prices unavailable (offline); risk: totem placement
r1-b-1 failed after 3 attempts: FI-1 Unknown Gem (reports/gates/R1b-r1-b-1-a3.json)
r1-c-3 can't be finalized yet: its damage source isn't a skill (a flask nova); read-only checks only
```

## Fault directives

None.
