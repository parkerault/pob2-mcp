# R1a: research (`build-guide-researcher`)

Slice 03 §5.2 step 1; spine C-36. Three researchers run in parallel in each research round, each on its
own focus, each writing one file. Together they produce the dossier's mechanics, synergy search and
config gaps, and 2 or 3 concept proposals (the round carries at most 3, D-235). The coordinator then
compiles each proposal as a skeleton (`R1b.md`) and assembles the dossier (`R1b-assemble.md`).

## Researchers and their focus

Both orchestrations assign the foci the same way: researcher `n` writes `research/p<k>-r1a-<n>.md` with
this focus.

| Researcher | Focus | Sections | Proposes |
|---|---|---|---|
| 1 | `mechanics` | `Mechanics`, `Config gaps` | 0 or 1 concept, led by the rolled skill itself or its supports |
| 2 | `items` | `Synergy search` | 1 or 2 concepts, led by key items (uniques) |
| 3 | `tree` | `Synergy search` | 1 concept, led by tree notables, keystones or ascendancy nodes |

## Inputs

- **Header:** `stage: "R1a"`, `attempt`, `mode`, `runFolder`, `compile: "none"`, `findings` (on a re-run,
  the note that an earlier attempt returned nothing), and `writes`: your one file,
  `research/p<k>-r1a-<n>.md` (round `k`, researcher `n`).
- **Prompt:** the roll (class, ascendancy, rolled skill), your focus, your marker-id prefix, and in a
  later round the user's note for the round.
- **A re-run** (`attempt` ≥ 2; a researcher that returned nothing runs again, up to 2 retries): your file
  may hold the dead attempt's partial work. Write it whole.
- **A later round** (`k` ≥ 2): read `dossier.md` in the run folder first. Propose only concepts it
  doesn't already hold, and follow the user's note. Add to Mechanics or Config gaps only what is new.

## Work, by focus

Use the lookup tools (`.claude/skills/build-guide/references/lookups.md`), the data under `data/`, and,
online only, the web on the allowed hosts (your agent definition). Look things up rather than recalling
them: a game fact you didn't look up is a `judgment`, with a confidence.

**Discovery calls** (every focus may use them):

- supports: `list_gems {type: "support", tag: <a tag of the rolled skill>}`, and
  `lookup_game_data {mode: "mechanic", query: <a mechanic of the skill>, kind: "gem"}` (`kind` lists one
  kind only, D-240); then `lookup_game_data {mode: "gem", query: <support>}` says what each support can
  and can't support;
- uniques: `lookup_game_data {mode: "unique", query: <a name, mod text or slot>}` (several matches come in
  brief; full item text comes only when exactly one unique matches, so look a candidate up by its exact
  name, D-239), and `lookup_game_data {mode: "mechanic", query, kind: "unique"}`;
- the tree: `search_tree_nodes {query}` for notables and keystones, `search_tree_nodes {ascendancy}` for
  the ascendancy's own nodes;
- what PoB models: `check_model_coverage` with `gems`, `item_text` or `nodes`. A line that is unparsed,
  partly parsed (PoB then applies **none** of it), parsed to nothing, possibly unread, or marked "check
  config" is a modelling gap.

By focus:

- **`mechanics`**: sections `Mechanics` and `Config gaps`; 0 or 1 concept.
  - The rolled skill: `lookup_game_data {mode: "gem", query: <skill>}`. Say what it does, its weapon
    requirement, its stat sets with base damage and critical hit chance, what quality adds, and the gem
    level and character level at which it can first be used (that bounds the leveling plan). Run
    `check_model_coverage {gems: [<skill>]}` on it.
  - Its supports: which supports it can take and which change how it plays (the discovery calls above).
  - The ascendancy: `search_tree_nodes {ascendancy: <ascendancy>}`, then `check_model_coverage
    {nodes: [...]}` on the notables that touch the skill's damage, defence or resources.
  - **Config gaps** (D-123): every combo, stack, buff or condition the skill or the ascendancy depends on,
    with whether PoB2's config covers it (a config option, a `check config` line) or it needs a hand
    calculation, and what that calculation would need as inputs.
  - A concept only when the skill or a support package is itself the idea (a support that changes the
    skill's behaviour, a conversion, a trigger).
- **`items`**: section `Synergy search`; 1 or 2 concepts led by key items.
  - Uniques that change how the skill plays, found with the unique discovery calls; run
    `check_model_coverage {item_text}` on each candidate's text.
  - The supports each concept needs, checked against the rolled skill.
- **`tree`**: section `Synergy search`; 1 concept led by tree notables, keystones or ascendancy nodes.
  - Ascendancy notables, keystones and notable clusters that fit the skill, with `check_model_coverage
    {nodes}` on each one the concept relies on. Name each node with its id, so the coordinator can path
    to it, and by the name the tool gives it. Call a node a notable or a keystone only when the tool tags
    it so (`[NOTABLE]`, `[KEYSTONE]`).

## Writes: the research file

```
# Research p<k>.<n>: <focus> for <ascendancy> / <skill>

## Mechanics                 (mechanics focus)
## Config gaps               (mechanics focus)
## Synergy search            (items and tree focus)
## Concept: <title>          (one section per proposal)

- Key uniques: ...
- Ascendancy nodes: ...
- Supports: ...
- Keystones: ...
- Feasibility read: ...
- Risks: ...
- What PoB can't verify: ...

## Sources

[^p<k>r<n>-1]: pob-data | lookup_game_data gem "<skill>" | patch: <enginePatch>
```

- **A concept proposal** has C-36's seven fields, each a labelled bullet exactly as above. "None" is an
  answer; an empty field isn't. The feasibility read says whether the concept can reach the endgame
  bar (all four resistances capped, the rolled skill as the main damage source, a budget variant within
  20 divines) and what it rests on. "What PoB can't verify" lists the lines `check_model_coverage`
  flagged and the config gaps the concept needs.
- **The title** is short (at most 60 characters), names the idea rather than the roll, and is unique in
  the file. The coordinator finds your proposal by its `## Concept: <title>` heading.
- **Markers.** Every claim carries a marker `[^p<k>r<n>-<m>]`, `m` counting from 1, so the ids stay unique
  when the dossier copies them. Each id has exactly one definition line, and every definition sits under
  `## Sources`, the file's last heading (`.claude/skills/build-guide/references/source-markers.md`). A
  research file has no plan to cite, so use tags (`pob-data`, `judgment`, `external`,
  `external-unavailable`) and `data | <file>#<key>`, never `ledger` or `price`.
- **Offline** (`mode: "offline"`): no web. A point that would need an external source (a play pattern,
  a community benchmark, a patch note) is tagged `external-unavailable | external source unavailable
  (offline run) | confidence: <H|M|L>`.

## Returns

Your last message is this JSON and nothing after it, with the titles exactly as your `## Concept:`
headings have them, in file order:

```json
{ "file": "research/p1-r1a-2.md", "concepts": [ { "title": "Bleed burst with Blood Hunt" } ] }
```

The workflow assigns the concept ids in researcher order (1, 2, 3; each file's proposals in file order)
and carries at most 3 concepts per round (D-235); the rest are logged `not-carried`.

## Fault directives

None. Faults never reach R1a.
