# R1a-synthesize: compose the builds (`build-guide-coordinator`)

One step per brainstorm round (D-429), after the round's R1a researchers return; in a new run it takes the place of
`R1a-assemble.md`. A designer brainstorms widely, then builds one build from everything found rather than keeping one
idea and dropping the rest, and so does this step: it groups the run's cards by structure and composes one candidate
build per structure, a **composite**, from every compatible piece the brainstorm found, on any card or in any research
file's `## Ideas`. It writes the deck `cards.md` the user picks from at the brainstorm gate and each composite's card.
It compiles nothing and prices nothing: R1b measures each piece inside its composite (D-433). A run whose first
brainstorm round ran `R1a-assemble` keeps that step for every later round, so this step never runs in it.

**Names** (amendment 10):

- A **piece** is one mechanism a researcher confirmed in game text (a skill, a support, a unique, a rare's mod line,
  a node, a keystone, a rune, a mechanic or config condition) doing one job for a build: a damage layer, a scaler of
  another piece, a supply, a way around a limit, a defence, a boss answer.
- A **structure** is a card's identity `{className, ascendancy, named damage source}` (D-286), or its engine when
  every card shares one identity (step 1).
- A **layer** is one way the build's buttons deal damage: the hit, an ailment, an explosion, a detonation, a second
  skill. A **limit** is what caps the build's rate or uptime: mana per cry, a cooldown, a charge count.
- A piece is **in**, **scheduled** (on a second button, a second weapon set or a boss setup, so it doesn't fight
  another piece) or **out**, with why.

## Inputs

- **Header:** `stage: "R1a-synthesize"`, `attempt`, `mode`, `runFolder`, `compile: "none"`, `findings` (only an
  earlier attempt's note that it returned without its files: `cards.md` and the composites' cards may then hold its
  partial work, so write them whole), `writes: ["cards.md", "cards/r<k>-s-<n>.md", …]`: the deck, each composite's
  card, and the round's researcher cards for a rename only (step 8).
- **Prompt:** a `json` block for the round: `round`, the parsed `brief`, the user's `note` (a later round), and
  `researchers`, each `{letter, focus, researchFile, cards, returned}`; `returned: false` means that researcher
  returned without its files, so its cards or its Ideas may be missing or partial.
- **Read** only these; you read every card, so keep to this list (the independent reads in one response):
  - every card's brainstorm half: this round's (the prompt's `cards`), the earlier rounds', the gate-made ones
    (`r<j>-g-<n>`), the rival's (`r<j>-x-<n>`) and the earlier composites (`r<j>-s-<n>`). Grep
    `-n "^## Verification half"` across `cards/` for each card's line, and Read each card up to it;
  - each research file's `## Ideas` and `## Supply search` sections: Grep `^- i[0-9]` across `research/` for the
    Ideas lines, and `^## Supply search` with the lines under it;
  - `cards.md`, when an earlier round wrote it;
  - the card template `.claude/skills/build-guide/templates/card-template.md`;
  - `data/rules/vocabulary.md`, the engine words (step 1);
  - the pattern library's entry for each shape an under-played label names (step 6): Grep `^### ` in
    `.claude/skills/build-guide/references/patterns.md` and Read those entries only.

  The identity check with its ascendancy lock, the sniff test and unique names are
  `.claude/skills/build-guide/references/stages/R1a-assemble.md`'s steps 2, 3 and 7: Read those three steps there,
  as this step cites them. The lookups each step needs are named in it, by their full names.

## Work

1. **Structures** (D-429). Group the run's cards by structure: this round's, every earlier round's, the gate-made
   ones and the rival's (D-408). An earlier composite isn't a member, since its pieces are its sources'. A structure
   is the card's identity `{className, ascendancy, named damage source}`, as its `### Identity` gives it.
   - **Keyed by engine under one identity.** When every card shares one identity (a fixed roll, a brief naming the
     ascendancy and the skill, a skill locked to one ascendancy, or researchers who converged), key the structures by
     engine instead, so the round still yields alternatives: `<consumed> from <supply>`, from each card's `Consumes or
     requires: <X>, supplied by <Y>` line, each one word of `data/rules/vocabulary.md` (D-405), so cards that word one
     engine differently share a key. Every card whose consumed word is `none` shares the one key `none`.
   - D-405's cap of half a round on one engine doesn't apply: composites differ by structure, or by the side of a
     split (step 5).
2. **Which structures this round composes.** Round 1: every structure. **A later round** adds its cards and Ideas
   to the pool, and recomposes only structures that gained pieces: a new card of the structure, or a new piece (an
   Ideas line, or a piece on this round's or the rival's card) whose `needs:` the structure meets and that serves its
   damage, its limit or its bosses; a structure or piece the user's note names counts as gained. Any other structure
   keeps its composite as it stands.
3. **Check the cards** of each structure you compose, by `R1a-assemble.md`'s step 2: the identity check, the brief's
   fixed pieces and the ascendancy lock (D-342), each lookup once per class, skill or identity in the round
   (`mcp__pob2__get_classes`; `mcp__pob2__lookup_game_data {mode: "gem", query: <skill>}`; for the lock,
   `mcp__pob2__search_tree_nodes {query: "Grants Skill: <skill>"}` and `mcp__pob2__lookup_game_data {mode:
   "mechanic", query: "<skill>", kind: "unique"}`). A card that fails is out, as R1a-assemble holds it back: it starts
   no composite, and its confirmed pieces stay in the pool. A structure none of whose cards passes isn't composed:
   `## Not composed` gives `- <structure>: <each card's failed check, in R1a-assemble's words>`.
4. **At most 4 composites a round** (D-429; NFR-23 as amended): one per structure, 1 to 4. When the structures to
   compose, with splits, number more than 4, keep those whose cards confirm the most load-bearing links, summed over
   the structure's cards that pass step 3 (a link is confirmed when its links-table row says `confirmed in game
   text`; ties: the lower first card id). The rest go under `## Not composed`, `- <structure>: the round holds 4
   composites; its cards confirm <n> load-bearing links`. A split counts two; when only one slot is left for a split,
   settle its conflict by question 18's last resort instead (step 5), with no split.
5. **Compose each structure.** Start from its **strongest card**, the one whose links table confirms most (ties: the
   lower id), and take every piece of the pool that fits it: the structure's other cards, the other structures'
   cards, the obvious card, and the research files' Ideas (D-430). Merge the lines that name the same piece and kind
   into one row, listing every source. Each piece is in, scheduled or out, with its reason, by the **synthesis
   questions**, the pattern library's brainstorm questions 15 to 19 (D-431), in short:
   - **15, climb the chain:** what scales the damage, what scales that, and what scales that.
   - **16, breadth:** what else each button can cause (an ailment, an explosion, a detonation, a skill it triggers,
     a second warcry). Search each layer's payoff by its damage type after conversion, and weigh it by the hit that
     starts it: an ailment pays on a big, slow hit more than on a fast one.
   - **17, the limit:** what caps the build's rate or uptime, and what removes the cap rather than feeding it (a cost
     moved to another pool, a refund, a cooldown ignored).
   - **18, conflicts:** which pieces fight (one consumes what another needs). Schedule the conflict before leaving a
     piece out (a clear button and a boss button, a second weapon set); as a last resort, drop the piece the other side
     needs when it is worth less. A payoff thief (the library's anti-pattern) is scheduled, or weighed against the piece
     it robs, before it rules a piece out.
   - **19, bosses:** when the clear skill is capped by a limit or shaped for packs, what is the boss button?

   **A conflict that can't be scheduled splits** the structure into two composites, one per side ("mana engine" and
   "life engine"), each taking a slot within the 4: both start from the strongest card, and each takes its own side's
   pieces in and the other side's out, its why naming the split.

   **The ascendancy lock on every skill a composite takes** (D-342): a skill from another structure's card or an
   Ideas line passes the lock for the composite's ascendancy, the lock's two lookups (step 3) once per skill in the
   round. A skill locked to another ascendancy is out, its why in R1a-assemble's words (`its ascendancy can't use
   <skill>: …`).

   **The sniff test**, `R1a-assemble.md`'s step 3, as D-430 bounds it: every load-bearing link of the composite (one
   without which its payoff stops working) is confirmed in game text. **An Ideas line's lookup counts as its piece's
   confirmation**, and so does a card's links-table row marked `confirmed in game text` with its lookup: don't repeat
   them. Run the sniff test's lookup **only for a load-bearing link that has none**: a link the composite makes
   between pieces from different sources, or one a card left `not checked yet`. A piece whose load-bearing link
   nothing confirms is out, why `not confirmed: <link>`; when the link is the named damage source's own, the structure
   isn't composed: `- <structure>: no game text confirms <link>`.
6. **Under-played labels** (D-339 as D-429 moves it). A label is an Ideas line's last field, `under-played: <the
   shape>`, or a card's `Under-played (judgment)` line, which goes with the piece that makes its shape. Read the
   library's entry for the shape, and keep the label when you too judge the shape one few builds use with this skill,
   ascendancy or playstyle; no tool counts what players run (D-335). **A kept label moves to the composite that takes
   the piece** (in or scheduled): the piece's row carries it in `Kind` (`, under-played`), and the composite's round
   line and its Pitch carry it. A researcher's card keeps its own label as written.
7. **The obvious card** (D-403), `r1-a-1` when it passes step 3, stays as the baseline: one line under `## The
   obvious build`, never a composite and never edited. It is **judged as written**, before any borrowing: its pieces
   join the pool, and the composite of its own structure says how it beats the card it grew from.
8. **Names** (D-392), by `R1a-assemble.md`'s step 7: no two cards of the run share a name, composites included.
   Give each composite a player's name of 2–4 words that no card and no line of `cards.md` has (Grep the `- Name:`
   lines across `cards/`); a successor's name differs from the composite it supersedes. A card of this round whose
   name another card of the run already has is renamed, the later id, with Edit in its `- Name:` line and its H1. A
   name shown at a gate never changes.
9. **A recomposed structure** (D-429). A composite shown at a gate (every composite `cards.md` lists) is never edited
   in place by a later synthesis: its successor is a new composite of this round, under a new id and a new name, and
   the old one goes under `## Superseded`, `- <old id> "<name>" → <new id>`, its round line kept, still pickable.
   **A verified or built composite is never superseded**: one is verified when its card's `### Structure check` holds
   more than `Not checked yet.` (Grep `-A1 "^### Structure check"` across `cards/`), and a recomposition of its
   structure is a separate composite, with no `## Superseded` line.
10. **A short round** (D-339 as D-429 amends it): the round composes fewer than 2, or none of its composites takes a
    piece marked under-played. Give the reason in your return as one line, `short: <why>` ("one structure: every card
    shares one engine"; "no composite takes an under-played piece: the one label was dropped"). The runner records it
    in the run log, and the brainstorm gate says so.
11. **Write** each composite's card and `cards.md` (below).

## Writes: the composites' cards and `cards.md`

**A composite's card**, `cards/r<k>-s-<n>.md` (C-52, D-319's letter `s`), `n` from 1 in the round, in its starting
cards' id order: from the card template, its whole brainstorm half, and under `## Verification half` the template's
H3s, `### Pieces measured` among them, each with the one line `Not checked yet.`, for R1b.

- **Identity:** its structure's, as its strongest card gives it, with that card's `Granted by:`, `Weapon sets:` and
  `Can't be finalized yet` lines where they apply.
- **Pitch:** in player terms, as the template asks. Its How it clears says how it clears faster than the obvious
  card, or why it's worth picking anyway; the composite of the obvious card's own structure says instead how it beats
  the card it grew from. Its `Under-played (judgment)` line when it takes a kept label (step 6); no `Obvious build:`
  line.
- **Chain, Enabler, Links:** the composite's own, every load-bearing link with its confirming text and the lookup
  that returned it, from its sources or from the sniff test.
- **Evidence, Risks so far:** over all its pieces, as the template asks.

**`### Pieces`** (D-433; amendment 10's Appendix A), after `### Risks so far`, one row per piece the composite weighs:

```
### Pieces

| Key | Piece | Kind | Status | Where | Why | From |
|---|---|---|---|---|---|---|
| i1b-4 | Blistering Bond | unique, under-played | in | Ring 2 | fire sets bleeding's magnitude | r1-b-2, i1b-4 |
| cr1-a-3-2 | Hammer of the Gods | skill | scheduled | weaponSet 1, single_target | boss button | r1-a-3 |
| i1a-7 | Elemental Focus | support | out | — | forbids the ignite and bleeding layers | i1a-7 |
```

- **Rows:** every piece in or scheduled; every piece a card of its structure uses; every other piece whose `needs:`
  the structure meets that it leaves out. A piece whose needs it can't meet (another class, ascendancy or weapon) is
  no row. The named damage source and its enabler come first, then the pieces in by how much the composite leans on
  each, then the scheduled ones, then the out ones: R1b's leave-one-out probes take the rest in this order.
- **Key:** the piece's Ideas id, `i<k><letter>-<m>` (the first in id order, when several lines name it), else
  `c<card id>-<m>`, from the first card in id order that names it, `m` counting the pieces its links table names, in
  row order, from 1. A piece already keyed in `cards.md` or an earlier composite keeps its key. **From** lists every
  source, card ids and Ideas ids.
- **Kind:** `skill`, `support`, `unique`, `mod`, `node`, `keystone`, `rune` or `config`, with `, under-played` for a
  kept label. **Status:** `in`, `scheduled` or `out`. **Where:** a slot, group, set or node for `in` and `scheduled`
  (a boss button is a `single_target` group; a skill on one weapon set, `weaponSet <n>`, D-426); `—` for `out`.
  **Why:** the job it does, required for `scheduled` and `out` (what it fights, forbids or lacks).

**`cards.md`** (D-432), rewritten each round for the whole deck, its H2s in this order:

```
# Deck

## What the composites share

Every composite is a Titan Warrior whose Seismic Cry is the damage: each cry hits the pack around you, and a shield
blocks between cries. They differ in what the cry feeds on.

## How they differ

"Ember Quake" (armour-break from on-hit) breaks armour with every cry and adds ignite and bleeding as fire, its cries
paid with life; "Corpse Quake" (corpse from on-kill) spends the pack's corpses on explosions that clear while the cry
recovers, with Hammer of the Gods on its own weapon set for bosses.

## The obvious build

- r1-a-1 "Seismic Shouter" | the warcry kit: Seismic Cry with its standard supports, on the Titan's intended play

## Round 1

- r1-s-1 "Ember Quake" | armour-break from on-hit | hit, ignite, bleeding as fire | mana: Blood Magic moves the cries' cost to life | under-played (judgment: cost redirection, rarely paired with warcries)
- r1-s-2 "Corpse Quake" | corpse from on-kill | hit, corpse explosion, its ignite | the cooldown: the explosions clear while the cry recovers

## Cards

- r1-a-1 "Seismic Shouter" | armour-break from on-hit | fed: r1-s-1
- r1-b-2 "Burning Bond" | armour-break from on-hit | seed | fed: r1-s-1, r1-s-2
- r1-c-1 "Bellow Pyre" | corpse from on-kill | fed: r1-s-2

## Pieces not used

- i1a-7 Elemental Focus: forbids the ignite and bleeding layers both composites take

## Not composed

None.
```

The example is a fixed roll, so its structures are engines (step 1), and it shows three of the round's nine cards.

- **The header**, for the whole deck: `## What the composites share`, the common core once, in player terms, in at most
  80 words; `## How they differ`, one paragraph naming each composite's structure and what sets it apart.
- **`## The obvious build`:** one line, `- <id> "<name>" | <its kit>`, the kit from its `Obvious build:` line; or
  `None.` when the run has no obvious card or it failed step 3.
- **One `## Round <k>` per brainstorm round**, each line one of that round's composites: `- <id> "<name>" |
  <structure> | <layers> | <the limit's answer> | <under-played label>`, the structure as `<className>, <ascendancy>,
  <named damage source>` or as its engine key, the label as `under-played (judgment: <the shape, and why>)` and only on
  a composite that takes a kept label, then `can't be finalized yet: <why>` (D-303) with `waits on the pin: <entry>`
  (D-400) where they apply. A later round keeps every line already in `cards.md`, gate-made ones and superseded ones
  included, and adds its own `## Round <k>` after the last; `None.` when it composed none.
- **`## Cards`:** every card of the run but this step's composites (`r<j>-s-<n>`), each `- <id> "<name>" |
  <structure> | seed | fed: <composite ids | none>`: the researchers' cards, the gate-made ones and the rival's;
  `seed` only on the seed card (D-393); `fed:` the composites that take one of its pieces, in or scheduled.
- **`## Pieces not used`:** at most 10 lines, the strongest first, each `- <key> <piece>: <why no composite takes
  it>`; or `None.`. The research files' `Supply search` lines say why a card left a supplier out.
- **`## Not composed`:** `- <structure>: <why>`, from steps 3, 4 and 5; or `None.`.
- **`## Superseded`**, only once a later round recomposed: `- <old id> "<name>" → <new id>` (step 9).

Fields are separated by ` | `, as the deck's lines always were. "Not confirmed in game" is every card's default, which
the display says once: no line repeats it.

## Returns

At most 7 lines: `composites: <n>`, then one line per composite of the round, `r<k>-s-<n>: <name>`, then `cards: <n>
listed | not composed: <n> | superseded: <n>` (the deck's `## Cards` lines, its `## Not composed` lines, and the
composites this round superseded), and for a short round its `short:` line:

```
composites: 2
r1-s-1: Ember Quake
r1-s-2: Corpse Quake
cards: 9 listed | not composed: 0 | superseded: 0
```

```
composites: 1
r1-s-1: Ember Quake
cards: 9 listed | not composed: 1 | superseded: 0
short: one structure: every other card failed its identity check
```

## Fault directives

None. Faults never reach R1a-synthesize.
