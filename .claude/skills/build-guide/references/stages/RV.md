# RV: the rival (`build-guide-researcher`)

Once per run, after the first verification round's R1b-assemble and before its gate, and again at a gate when the
user asks (D-408). The pipeline settles on its first structure and tunes it. You come to the run fresh, to find a
**structure** that clears faster: the engine (what the damage consumes and what supplies it) and the choices that
shape the whole build, such as the weapon's job, the number of minion types or a second damage source. You write
one card, or find that none clears faster. Your card is a plain card (D-429: no Pieces tables): R1b verifies it with
the checklist's probes, and the next brainstorm round's synthesis takes its pieces into the pool.

## Inputs

- **Header:** `stage: "RV"`, `attempt`, `mode`, `runFolder`, `compile: "none"`, `findings` (on a re-run, the note
  that an earlier attempt returned without its file), and `writes: ["cards/r<k>-x-<n>.md"]`, your card (`k` the
  latest brainstorm round, `n` counting the run's rival cards in it from 1).
- **Prompt:** the parsed brief and your card id.
- **Read**, the independent reads in one response:
  - `.claude/skills/build-guide/references/patterns.md`, the pattern library, whole, first: its questions 11–19
    and its Standard kits are this step's tools;
  - `dossier.md` in the run folder, when it exists: one row per verified card, the composites' rows among them,
    with its status, its synergy in a few words, its DPS, Life, EHP and clear speed, and a composite's key pieces.
    These are the structures to beat;
  - the league digest, `data/league/<slug>.md`, the newest league's: its head whole (up to its `## Body` line),
    its body by Grep;
  - the rule-changer index, `data/rules/`: `nodes.md`'s section for the brief's ascendancy (each candidate's,
    when it names none) and its `## Keystones`, whole; `uniques.md`, `gems.md` and `pairs.md` by Grep;
  - `data/monsters/monster-mods.md` by Grep;
  - the card template `.claude/skills/build-guide/templates/card-template.md`, and `R1a.md` (in this folder),
    "The cards" under "Writes", for how a card is written.
- **Never read** the run's research files (`research/`), its cards (`cards/`, `cards.md`) or the interview notes
  (`interviews/`), apart from your own card: you mustn't share their blind spots.

## Work

1. **The brief binds you** where it is fixed: a named ascendancy or skill stays. What it leaves open is open to
   you. The ascendancy lock binds you as it binds R1a (`R1a.md`, "The ascendancy lock").
2. **Read each verified card's structure** from its dossier row: its engine, its weapon's job, its count of
   minion types or of damage sources, its clear speed. A composite's row (D-429) is one build composed from the
   whole brainstorm, its structure its identity `{className, ascendancy, named damage source}` or, under a fixed
   identity, its engine, and its `key pieces` the pieces it was measured with: beat the composite, not the cards
   it grew from. With no dossier yet (a rival the user asked for at the brainstorm gate), the structure to beat
   is the archetype's standard kit.
3. **Flip their assumptions.** Ask questions 11–19 of the best rows, and reverse each load-bearing assumption
   in a paragraph of your own reasoning: the supply (search it by family, as `R1a.md`'s supply search does: the
   family and its substitutes, every source kind, one lookup for each unfamiliar term), the weapon, the count,
   a premium slot that props up the engine, a rule changer (Grep `pairs.md`, and `creates:` across the index and
   the monster table); and, by questions 16–19, a layer no row's buttons start, a limit that caps the fastest
   row, a conflict a row settles by dropping a piece, and its boss button.
4. **Pick the flip that clears fastest on paper,** a structure that differs from every dossier row, with the
   arithmetic: a rough multiplier on clearing a pack against the dossier's fastest row (damage × area × pace
   between packs; a count's gain, a slot freed). Rough on purpose, but every link confirmed in game text: a
   lookup, or a league-digest or monster-table entry.
5. **Write the card** as R1a writes one: identity, pitch, chain, enabler, links with their lookups, evidence and
   risks, the verification half's H3s each `Not checked yet.`. No `Obvious build:` line and no under-played
   label. A plain card: no `### Pieces` and no `### Pieces measured` (a card with `### Pieces` is a composite,
   which R1b would measure piece by piece); R1b runs the checklist's 4 probes on it. Its How it clears gives the
   arithmetic: how it clears faster than the fastest row, and by about how much.
6. **Or none.** When no structure you can confirm clears faster, write no card.

**Lookups, and PoB's source for how only** (D-425), as `R1a.md` says: data questions go through the lookups (a
node's distance from the class start with `mcp__pob2__search_tree_nodes`' `from`, a gem's cost and Spirit by level,
`mode: "base"`, `mode: "config"`, `kind: "constant"`); Grep PoB's `vendor/PathOfBuilding-PoE2/src/Modules/` only for
how the engine computes something, cited by file and line; no scratch builds (FR-W3).

**Weapon sets** (D-426). Weapon set 2 is one of the assumptions to flip in step 3: a second tree for a skill that
scales differently, a second weapon, or a buff cast from set 2 that keeps set 2's effect while set 1 is out. Judge
from each dossier row's synergy and weapon whether it uses set 2 (you never read the cards); when the fastest rows
use one set, ask whether set 2 would lift their clear, and weigh what the swap costs: set 2's points are converted
regular points, and its Spirit and Life are its own. Your card's identity carries its `Weapon sets:` line, checked
as R1a checks it (`R1a.md`, "Weapon sets").

Offline (`mode: "offline"`): no web, as for R1a.

## Writes

Only your card, `cards/r<k>-x-<n>.md`: no research file and no deck line. R1b verifies it, and R1b-assemble adds
its dossier row. Its pieces join the next round's pool (D-429): a later brainstorm round's synthesis reads your
card, keys the pieces its links table names `c<card id>-<m>`, and lists it under the deck's `## Cards`.

## Returns

At most 8 lines. With a card, its path, then its id, its name and the multiplier:

```
cards/r1-x-1.md
r1-x-1: Slam-opened lunge: about ×1.2 on packs against the fastest row
```

With none, the outcome and what you tried, in a sentence, which the runner logs as `tried`:

```
none-found
tried: a sceptre and two more minion types, the infusion family for the ground, and Kelari as a second djinn
```

## Fault directives

None. Faults never reach RV.
