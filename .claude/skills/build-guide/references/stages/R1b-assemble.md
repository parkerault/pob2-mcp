# R1b-assemble: the dossier (`build-guide-coordinator`)

One step per verification round, after every R1b step of the round. It writes `dossier.md`, the verification
gate's comparison table (D-355, as D-436 amends it): one row per verified card, with its status, its synergy, the
kinds of damage PoB shows for its named source, on a composite how many of its pieces do something, its key
prices and its main risk. **It carries no figure**: verification checks that the build works (it compiles and the
skills work as expected), and numbers come at the design gate, measured on the full build (D-436).
The user picks from it at the verification gate, and the design steps and W1 read their card and its row for its
damage kinds and pieces. The research files and the cards keep the rest: the dossier merges no research.

## Inputs

- **Header:** `stage: "R1b-assemble"`, `attempt`, `mode`, `runFolder`, `compile: "none"`, `findings`
  (only an earlier attempt's note that it returned without its file: `dossier.md` may then hold its partial
  work, so make it whole), `writes: ["dossier.md"]`, with `"cards.md"` when the round verified a card made at a
  gate.
- **Prompt:** a `json` block for the round: `round` (the verification round), the parsed `brief`, the user's
  `note` for each brainstorm round; and `cards`, each `{id, name, status, attempts, verdict}`: `status`
  `viable`, `failed`, or `can't be finalized yet` (its last R1b verdict's finding is `not-a-skill`: its damage
  source isn't a skill, D-303, D-334; or `not-in-pin`: it rests on an entry the PoB pin doesn't know, D-400),
  with the R1b attempts it made and its last verdict file.
- **Read**, the independent reads in one response:
  - the template `.claude/skills/build-guide/templates/dossier-template.md`, and `dossier.md` when an earlier
    round wrote it;
  - each card of the round, `cards/<id>.md`: its Why pick it (the synergy), its risks and its checklist's
    risks, its `### Verified` damage line (the kinds PoB shows for the named source), its key item prices, and on
    a **composite** (any card with `### Pieces`, D-433) its `### Pieces measured` answers and the names its
    `### Pieces` rows give those keys;
  - each card's last verdict file: its `verdict` (`compiled`, and `damage`, D-436), its findings (a
    `damage-missing` one among them), its errors, `recordPath` and `leagueUnverified`;
  - where it compiled, whether a meta gem triggers its named source: Grep `"trigger"` in
    `concepts/<id>/compile-record.json` (the record's `measures.trigger {by, usesPerSecond}`), never the record
    whole.

## Work

1. **Confirm each record.** For every card the input calls `viable`, check that
   `concepts/<id>/compile-record.json` exists beside its skeleton. If it doesn't, the card is `failed`:
   say so in its row and in its comparison line. A card that can't be finalized yet has no skeleton,
   record or prices to confirm: it compiled nothing (D-334), and it is never `failed`.
2. **Write the dossier from the template**: its H1, the one brief line, and the table, its **nine columns**
   exactly, in order: `Card`, `Round`, `Status`, `Synergy`, `Damage`, `Pieces`, `Key prices`, `League`, `Main
   risk` (D-436, Appendix A). No number column: the run checker rejects `Named source DPS`, `Life`, `EHP`, `Clear
   speed` and `key pieces` in a run held to amendment 11 (`skillRevision` in `run-log.json`, §19), and that is
   every run you write for. No H2, no H3, no markers: each price is its skeleton's entry, and the row's card id
   finds it.
   - **The brief line:** the brief (its fields as parsed; a fixed roll names its class, ascendancy and skill),
     the mode (offline: no web source and no price was consulted), and the rounds: each brainstorm round with
     its note, each verification round with its cards.
   - **Status** (D-436): `viable` when it compiled and its named source shows every kind of damage the card names;
     `viable, except <piece> does nothing in PoB` (several joined with `; `) when a row of its Pieces measured
     answers `no`, and only then; `failed after <N> attempts: <the last errors>; <its last verdict file>` for a
     failed compile, and `failed after <N> attempts: damage-missing: <the finding's message>; <its last verdict
     file>` for a card whose damage check failed after its retries; `can't be finalized yet: …` (below). A piece
     PoB can't see doesn't change the status: the Pieces cell says so.
   - **Damage:** the named damage source and the kinds PoB shows for it, from the card's damage line, `<named source>:
     <kinds>` in the damage check's words (`hit`, `damage over time`, `ignite`, `bleed`, `poison`, `minion
     damage`): `Detonate Dead: hit, bleed, ignite`. A source a meta gem triggers (its record's `measures.trigger`)
     adds `(rated at its hand-cast speed)`: `Detonate Dead: hit, bleed, ignite (rated at its hand-cast speed)`.
   - **Pieces**, a composite's: of the `in` pieces probed (its Pieces measured rows), how many do something, `4 of
     4 do something`; when one doesn't, `<n> of <m>: ` then each piece by name, `<piece> does nothing in PoB` for a
     `no`, `<piece>: PoB can't see it`, `<piece>: not measured`, joined with `; `: `3 of 4: Venopuncture does
     nothing in PoB; Beetlebite: PoB can't see it`. A plain card's is `—`.
   - **Key prices:** each key-item price as the card gives it, a range with its day (`about 3.2–7.2 divines around
     day 7`), a range that rounds to 0.0 as seen in players' words (`1 exalt (seen 2026-10-24)`, D-442), or
     `unavailable` with its note.
   - **League:** offline, `none (offline)`; online, the skeleton's league, and `<league>, unverified` when its
     verdict has `leagueUnverified`, so D1 doesn't take it.
   - **Main risk:** what could sink it, the checklist's risks among them. When the card's payoff rests on a
     mechanic no lookup confirmed, or that has no source in the card (no item, node or gem that grants it), its
     main risk says so.
   - **A failed card's row:** its Status as above, and `—` in its Damage, Pieces, Key prices and League cells. A
     `wrong-ascendancy` card (D-342) is `failed after 1 attempt: <its finding's message>; <its verdict file>`, with
     `—` too: it compiled nothing.
   - **A card that can't be finalized yet** (D-303, D-334): `can't be finalized yet: its damage source isn't
     a skill`, or `can't be finalized yet: waits on the pin` for a `not-in-pin` card (D-400), `—` in its Damage,
     Pieces, Key prices and League cells, and its main risk what finalizing it waits on. It names no
     `concepts/<id>/` path: none exists.
3. **A later round** keeps every row already in `dossier.md` and adds this round's below them, in id order, and
   adds the round to the brief line. A dossier an earlier session wrote in an older form (with figure columns,
   before amendment 11: the run was resumed since) is rewritten in the nine columns, each earlier row from its
   card and its last verdict file as above; its Pieces from an older `Key | Drops | How` table count a piece that
   does something when one of its drops is 1% or more. If `dossier.md` is missing (an earlier round's assembly
   never returned its file), write it from the template for this round, and say in the brief line which earlier
   rounds have no rows.
4. **A card made at a gate** (`r<k>-g-<n>`, D-391), failed or not: add its line to `cards.md` under `## Round
   <k>`, after that round's last line, and change nothing else there:
   `- <id> "<Name>" | <what it adds> | made at the gate (visit <v>): from "<Name>" and "<Name>"`, the visit and
   the names from its card's `Made at the gate` line.

## Writes

`dossier.md`, and in `cards.md` only a gate-made card's line.

## Returns

At most 8 lines: `dossier.md`, then the verification gate's comparison, one line per card of this round in id
order: its id, its status, its synergy in a few words, its damage kinds, a composite's pieces, its key prices
(ranges with their day, or `unavailable`), and its main risk; no figure. A failed card's line names its last
verdict file. A card that can't be finalized yet says so, and isn't a failure.

```
dossier.md
r1-a-2 viable: bleed burst on rares; Blood Hunt: hit, bleed; prices unavailable (offline); risk: chaos resistance
r1-b-2 viable: totem relay; Ancestral Warrior Totem: hit; prices unavailable (offline); risk: totem placement
r1-b-1 failed after 3 attempts: damage-missing: bleed shows nothing on Blood Hunt (reports/gates/R1b-r1-b-1-a3.json)
r1-c-3 can't be finalized yet: its damage source isn't a skill (a flask nova); read-only checks only
```

On a composite:

```
dossier.md
r1-s-1 viable, except Blistering Bond does nothing in PoB: the aftershock hits twice and the slam ignites; Rolling Slam: hit, ignite; pieces 3 of 4: Blistering Bond does nothing in PoB; Titan's slam notables: PoB can't see it; prices unavailable (offline); risk: the ignite rests on Blistering Bond
```

## Fault directives

None.
