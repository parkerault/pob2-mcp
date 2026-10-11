# R1a: brainstorm (`build-guide-researcher`)

Slice 03 §5.2 (the brainstorm phase) and §7.5; spine C-36, C-51, C-52, C-53, D-287, D-290, D-298, D-319, D-335,
D-339. Three researchers run in parallel in each brainstorm round, each on its own focus. Each writes one
research file (the dossier's mechanics, synergy search and config gaps) and 3 **cards**, each the brainstorm
half of a candidate build, at least one of them built on a pattern-library shape you judge under-played. A coordinator step then deals the deck from the round's cards (`R1a-assemble.md`), the user
picks the cards to verify at the brainstorm gate, and R1b compiles them (`R1b.md`).

## Researchers and their focus

The runner assigns the foci and letters you when it starts you: researcher `n` writes
`research/p<k>-r1a-<n>.md` and its cards `cards/r<k>-<letter>-<m>.md` (D-319).

| Researcher | Letter | Focus | Sections | Cards |
|---|---|---|---|---|
| 1 | `a` | `mechanics` | `Mechanics`, `Config gaps` | 3, each led by a skill, its supports or a mechanic |
| 2 | `b` | `items` | `Synergy search` | 3, each led by key items (uniques) |
| 3 | `c` | `tree` | `Synergy search` | 3, each led by tree notables, keystones or ascendancy nodes |

Each focus starts from the brief's fixed pieces (D-287):

| Brief | Mechanics | Items | Tree |
|---|---|---|---|
| names a skill | from the skill, its supports and what it reads | from `around`, or from uniques that change how the skill plays | from the ascendancy's nodes |
| names no skill | from the pattern library's families and the playstyle tags | (same) | (same) |
| names no ascendancy | (as above) | (same) | from ascendancies that suit the playstyle, or the user's `popularity` notes (D-335) |

The brief's other fields steer every focus: `playstyle` (each card's tags, from the same vocabulary),
`budget`, `around`, `like` (a reference build and what to change), `notes`, and `popularity` (the user's own
notes on what players run, each card's only player evidence). A fixed roll (a brief naming `ascendancy` and
`skill`) fixes every card's identity: its named damage source is that skill.

**An under-played card** (D-298, D-339). Whatever the brief names, at least one of your 3 cards is built on a
pattern-library shape that you judge under-played: one few builds use with this skill, ascendancy or
playstyle. Label it in its pitch, `Under-played (judgment): <the shape, and why you judge it under-played>`.
It is your judgment, never a measurement: no tool counts what players run (D-335). The brief's `popularity`
notes may inform it; cite them as the user's notes.

## Inputs

- **Header:** `stage: "R1a"`, `attempt`, `mode`, `runFolder`, `compile: "none"`, `findings` (on a re-run,
  the note that an earlier attempt returned without its files), and `writes`: your research file
  `research/p<k>-r1a-<n>.md` and your cards `cards/r<k>-<letter>-1.md` to `cards/r<k>-<letter>-3.md`
  (round `k`, researcher `n`, your letter).
- **Prompt:** the parsed brief, your focus and letter, your marker-id prefix, and in a later round the user's
  note for the round.
- **A re-run** (`attempt` 2: a researcher that returned without its files runs again once): your files may
  hold the dead attempt's partial work. Write them whole.
- **A later round** (`k` ≥ 2): read `cards.md` in the run folder first, and `dossier.md` when it exists.
  Write only cards the deck doesn't already hold, and follow the user's note. Add to Mechanics or Config gaps
  only what is new.

## Work, by focus

**The pattern library first** (C-53, D-290). Read `.claude/skills/build-guide/references/patterns.md` whole
before anything else: its brainstorm questions open it, then the shapes, each with its search step, how PoB
follows it and its cautions. A shape is a starting point, never a fact: re-check every use against current
game data with a lookup, and cite the lookup, not the library.

Use the lookup tools (`.claude/skills/build-guide/references/lookups.md`), the data under `data/`, and,
online only, the web on the allowed hosts (your agent definition). Look things up rather than recalling
them: a game fact you didn't look up is a `judgment`, with a confidence.

**Discovery calls** (every focus may use them):

- supports: `mcp__pob2__list_gems {type: "support", tag: <a tag of the skill>}`, and
  `mcp__pob2__lookup_game_data {mode: "mechanic", query: <a mechanic of the skill>, kind: "gem"}` (`kind` lists one
  kind only, D-240); then `mcp__pob2__lookup_game_data {mode: "gem", query: <support>}` says what each support can
  and can't support;
- uniques: `mcp__pob2__lookup_game_data {mode: "unique", query: <a name, mod text or slot>}` (several matches come in
  brief; full item text comes only when exactly one unique matches, so look a candidate up by its exact
  name, D-239), and `mcp__pob2__lookup_game_data {mode: "mechanic", query, kind: "unique"}`;
- the tree: `mcp__pob2__search_tree_nodes {query}` for notables and keystones, `mcp__pob2__search_tree_nodes {ascendancy}` for
  the ascendancy's own nodes;
- what PoB models: `mcp__pob2__check_model_coverage` with `gems`, `item_text` or `nodes`. A line that is unparsed,
  partly parsed (PoB then applies **none** of it), parsed to nothing, possibly unread, or marked "check
  config" is a modelling gap.

By focus:

- **`mechanics`**: sections `Mechanics` and `Config gaps`; cards led by a skill, its supports or a mechanic.
  - Each named damage source a card proposes: `mcp__pob2__lookup_game_data {mode: "gem", query: <skill>}`.
    Say what it does, its weapon requirement, its stat sets with base damage and critical hit chance, what
    quality adds, and the gem level and character level at which it can first be used (that bounds the
    leveling plan). Run `mcp__pob2__check_model_coverage {gems: [<skill>]}` on it.
  - Its supports: which supports it can take and which change how it plays (the discovery calls above).
  - The ascendancy: `mcp__pob2__search_tree_nodes {ascendancy: <ascendancy>}`, then `mcp__pob2__check_model_coverage
    {nodes: [...]}` on the notables that touch the skill's damage, defence or resources.
  - **Config gaps** (D-123): every combo, stack, buff or condition the skill or the ascendancy depends on,
    with whether PoB2's config covers it (a config option, a `check config` line) or it needs a hand
    calculation, Count or a custom modifier (the library's labels), and what that needs as inputs.
- **`items`**: section `Synergy search`; cards led by key items.
  - Uniques that change how a skill plays, found with the unique discovery calls; run
    `mcp__pob2__check_model_coverage {item_text}` on each candidate's text.
  - The supports each card needs, checked against its named damage source.
- **`tree`**: section `Synergy search`; cards led by tree notables, keystones or ascendancy nodes.
  - Ascendancy notables, keystones and notable clusters that fit the skill, with `mcp__pob2__check_model_coverage
    {nodes}` on each one the card relies on. Name each node with its id, so the coordinator can path
    to it, and by the name the tool gives it. Call a node a notable or a keystone only when the tool tags
    it so (`[NOTABLE]`, `[KEYSTONE]`).

## Writes: the research file and the cards

**The research file** holds what the dossier merges, with source markers:

```
# Research p<k>.<n>: <focus> for <the brief, in a few words>

## Mechanics                 (mechanics focus)
## Config gaps               (mechanics focus)
## Synergy search            (items and tree focus)

## Sources

[^p<k>r<n>-1]: pob-data | lookup_game_data gem "<skill>" | patch: <enginePatch>
```

- **Markers.** Every claim carries a marker `[^p<k>r<n>-<m>]`, `m` counting from 1, so the ids stay unique
  when the dossier copies them. Each id has exactly one definition line, and every definition sits under
  `## Sources`, the file's last heading (`.claude/skills/build-guide/references/source-markers.md`). A
  research file has no plan to cite, so use tags (`pob-data`, `judgment`, `external`,
  `external-unavailable`) and `data | <file>#<key>`, never `ledger` or `price`.

**The cards** (C-52): 3, each `cards/r<k>-<letter>-<m>.md`, from the template
`.claude/skills/build-guide/templates/card-template.md`. Write its H1 and its whole brainstorm half, about
250–400 words; under `## Verification half` keep the template's H3s, each with the one line `Not checked
yet.`, for R1b to fill.

- **Identity:** the class, the ascendancy and the **named damage source**, each exactly as the lookup gives
  it. The named damage source is the main source of damage, never a token role (D-122 as D-295 words it): an
  active skill gem, whose own hits, ailments and projectiles count when another skill fires, spreads or copies
  them. A damage source that isn't a skill (an item, a passive or a modifier, such as a flask nova) may lead a
  card, marked "can't be finalized yet" (D-303, D-334).
- **Pitch:** the title is short (at most 60 characters), names the idea rather than the roll, and is unique
  among your cards; the playstyle tags come from the brief's vocabulary; and on the under-played card, its
  `Under-played (judgment)` line.
- **Chain, Enabler and Links:** every link of the chain in the links table, with its confirming game text
  quoted and the lookup that returned it; how PoB follows it, by the library's six labels with PG ids; hidden
  clauses stated as theory ("from a Hit", "you use yourself"). A link no lookup confirmed is `not checked yet`:
  the coordinator deals a card only when every load-bearing link is confirmed (`R1a-assemble.md`).
- **Evidence** (D-335): the brief's `popularity` notes that speak to this card's skill, ascendancy or
  combination, quoted and cited as the user's notes; otherwise "no player evidence". No tool supplies player
  evidence. A reference build only from the brief's `like`, or a source on an allowed host online.
- **Risks so far:** payoff thieves, placement limits, the exposed phase, resistant bosses, and what stands
  between the card and the endgame bar: all four resistances capped, the named damage source as the main
  damage source, a budget variant within 20 divines.
- **Status words** exactly as the template lists them, one per link, figure or claim. A card cites its lookups
  in its links table, with no footnote markers.
- **Offline** (`mode: "offline"`): no web. A point that would need an external source (a play pattern,
  a community benchmark, a patch note) is tagged `external-unavailable | external source unavailable
  (offline run) | confidence: <H|M|L>` in the research file, and is `not checked yet` on a card.

## Returns

At most 8 lines: your research file, then each card's id and title, in id order:

```
research/p1-r1a-2.md
r1-b-1: Bleed burst with Blood Hunt
r1-b-2: Rolling Slam clear, Blood Hunt for rares
```

The coordinator's R1a-assemble step merges the round's cards and deals the deck (D-287).

## Fault directives

None. Faults never reach R1a.
