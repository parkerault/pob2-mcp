# R1a-assemble: deal the deck (`build-guide-coordinator`)

One step per brainstorm round (D-287), after the round's R1a researchers return. It turns their cards into the
deck the user picks from at the brainstorm gate: it merges duplicates, checks each card's identity, deals a card
only when game text confirms its load-bearing links, at most half a round on one engine, and writes `cards.md`.
It compiles nothing, prices nothing, and edits a card only to rename it (step 7) or drop its under-played label
(step 4).

## Inputs

- **Header:** `stage: "R1a-assemble"`, `attempt`, `mode`, `runFolder`, `compile: "none"`, `findings` (only an
  earlier attempt's note that it returned without its file: `cards.md` may then hold its partial work, so make
  it whole), `writes: ["cards.md", <the round's cards>]`, the cards for a rename or a dropped label only.
- **Prompt:** a `json` block for the round: `round`, the parsed `brief`, the user's `note` (a later round),
  and `researchers`, each `{letter, focus, researchFile, cards, returned}`; `returned: false` means that
  researcher returned without its files, so its cards may be missing or partial.
- **Read**, the independent reads in one response: each card the prompt lists (`cards/r<k>-<letter>-<m>.md`,
  its brainstorm half); the card template `.claude/skills/build-guide/templates/card-template.md`; `cards.md`
  when an earlier round wrote it; for step 4, the pattern library's entry for each shape a card's
  under-played label names: Grep `^#` in `.claude/skills/build-guide/references/patterns.md` and Read those
  entries only; each research file's `## Supply search` sections (Grep `^## Supply search` with the lines under
  it); and `data/rules/vocabulary.md`, the engine words (step 5). The lookups each step needs are named in it, by
  their full names.

## Work

1. **Merge duplicates.** Two cards are duplicates when they share the identity and the chain (the same payoff,
   read from the same slot). Deal the one whose links table confirms more; the other goes under "Not dealt" as
   `the same build as "<Name>"`. A later round's card that duplicates one already in `cards.md` isn't dealt either.
2. **Check each card's identity** `{className, ascendancy, skill}`, `skill` being the named damage source
   (D-286), as the runner checks a brief:
   - the ascendancy: `mcp__pob2__get_classes` lists it (case-insensitive), under the card's class;
   - a named damage source that is a skill: `mcp__pob2__lookup_game_data {mode: "gem", query: <skill>}` gives
     a result headed `## <skill>` that says `Kind: active`, or `Kind: minion skill` when no active gem has the
     name and the name's results hold exactly one `Cast by:` summon, which the card names (D-379);
   - a damage source that isn't a skill (an item, a passive or a modifier; never a minion skill the gem lookup
     finds, even one a passive grants, D-379; D-334): a lookup by its kind returns it (`{mode: "unique",
     query: <exact name>}`, or `{mode: "mechanic", query: <its line>}` with `kind: "passive"` or `kind:
     "mod"`). Such a card can be dealt, marked "can't be finalized yet" (D-303);
   - the brief's fixed pieces: a card whose identity contradicts the brief's `ascendancy` or `skill` isn't
     dealt;
   - the ascendancy lock (D-342): for every skill a card names (its named damage source, its chain and its
     links, and a minion skill's summon, D-379), once per skill in the round, run
     `mcp__pob2__search_tree_nodes {query: "Grants Skill: <skill>"}` and `mcp__pob2__lookup_game_data {mode:
     "mechanic", query: "<skill>", kind: "unique"}` again. A skill is
     locked when a node grants it (its stats list `Grants Skill: <skill>`), every such node is an ascendancy
     node (an `Ascendancy: <name>` line), and no unique has a line `Grants Skill: <skill>` or `Grants Skill:
     Level (<range>) <skill>`. A card that uses a locked skill must be one of those ascendancies, its identity
     naming the node; a card that uses a skill a non-ascendancy node or a unique grants must name the source
     it uses. A card that breaks either isn't dealt: "Not dealt" gives `its ascendancy can't use <skill>: it is
     granted by <each node, "<node name>" (<node id>), with its ascendancy>` (`granted only by` when there is
     exactly one source), or `nothing on the card grants <skill>: <the nodes and uniques that do>`.

   A failed check holds the card back, naming what failed. Use the names exactly as the tools give them.
3. **The sniff test** (D-287). A link in the card's links table is load-bearing when the payoff stops working
   without it. Deal the card only when a lookup confirms every load-bearing link in game text: repeat the
   lookup the card names for the link, or the one that finds its text, and check that the quoted text is
   there. A league-digest or monster-table entry's text confirms a link too (D-400, D-402): for a link the card
   cites `data \| league/<slug>.md#<id>` or `data \| monsters/monster-mods.md#<id>`, Grep `- Id: <id>` in that
   file and check its block. An index line (`data/rules/`) is a lead, never the confirming text. A load-bearing
   link nothing confirms holds the card back, and "Not dealt" names that link. A hidden clause stated as theory
   ("from a Hit") doesn't hold a card back by itself, but the link it sits on still needs its text. A card whose
   named damage source or load-bearing link is a digest entry marked `[not in pin]` passes, dealt as `can't be
   finalized yet: <why> | waits on the pin: <entry>`, the entry by its digest name (D-400).
4. **Under-played cards** (D-298 as D-335 restates it; D-339). Each researcher built at least one of its 3
   cards on a pattern-library shape it judges under-played, labelled `Under-played (judgment)` in its pitch.
   Read each label against the library: keep it when the shape is one few builds use with this skill,
   ascendancy or playstyle, in your judgment too. Otherwise drop it, and delete the card's `Under-played
   (judgment)` line, which the gate would show as "Unusual". A kept label goes in the card's
   `cards.md` line as `under-played (judgment: <the shape, and why>)`. There is no popularity threshold and
   no tool for it: poe.ninja's builds API is closed to third parties (D-335). The brief's `popularity` notes,
   where they speak to a card, are the card's evidence, cited as the user's notes, never as your judgment.
5. **Deal 6–9 cards** for the round, in card-id order, from the cards that pass steps 1 to 3: the obvious card
   `r1-a-1` whenever it passes (D-403), and the ones that differ most (delivery, damage source, focus, engine),
   keeping **at least two under-played cards in the deck**. The deck is every round's dealt cards together, and a
   later round adds only new cards, so count the under-played cards already dealt in `cards.md`, and deal this
   round's under-played cards first when the deck needs them. Put the cards you don't deal under "Not dealt" as
   `the round was full`.
   - **The engine** (D-405): what the card's damage consumes and what supplies it, from its chain's `Consumes
     or requires: <X>, supplied by <Y>` line, as `engine: <consumed> from <supply>`, each one word of
     `data/rules/vocabulary.md` (`none` included), so cards that word one engine differently match. Two cards
     share an engine when both words match; a consumed `none` is no engine.
   - **At most half a round on one engine**, rounded down: 4 of 8 or 9 dealt cards, 3 of 6 or 7. Deal the ones
     that differ first; each card the rule holds back goes under "Not dealt" as `- <id> "<Name>" | the round
     already holds <n> cards on this engine | engine: <consumed> from <supply>`. It yields to the minimum: when
     it would leave fewer than 6 cards, deal the fewest extra that reach 6, and the round is short, `short: <n>
     cards share one engine`. It yields to the user: when the user's note for the round names an engine's
     consumed family (`chilled ground`), the rule skips that engine, and the deck's `How they differ` says so.
6. **A short round.** When fewer than 6 cards pass steps 1 to 3, or the deck still holds fewer than two
   under-played cards after this round, the round is short: deal what passes, and give the reason in your
   return as one line, `short: <why>` ("4 of 9 cards passed the sniff test"; "the deck holds one under-played
   card: the other two failed their identity check"). So is a round the engine rule fills to 6 (step 5); a
   round short for that and another reason puts the engine's first, `short: <n> cards share one engine;
   <other>`. The runner records it in the run log, and the brainstorm gate says so.
7. **Unique names** (D-392). No two cards of the run share a name. On a clash with a card already in
   `cards.md` or another card of the round, rename the newer one (the later id) with Edit, in its `- Name:`
   line and its H1. A name shown at a gate never changes.
8. **Write `cards.md`** (below).

## Writes: `cards.md`

`cards.md` (D-287, D-392), in plain words a player reads:

```
# Deck

## What the cards share

Every card is a Titan Warrior with a spear, and Blood Hunt is its damage: it lunges at a bleeding enemy and
consumes its Blood Loss for a burst of physical damage.

## How they differ

Three engines: bleed from on-hit (3), bleed from on-crit (2), rage from on-hit (2); two cards change the defence.

## Round 1

- r1-a-1 "Bleed Burst Lunge" | one lunge spends the bleed you built, so rares melt in two presses | engine: bleed from on-hit
- r1-b-2 "Totem Slam Relay" | totems slam the pack while you lunge | engine: bleed from on-hit | under-played (judgment: a loop shape, rarely paired with Blood Hunt)

## Not dealt

- r1-c-1 "Rage Cycling" | no lookup confirms that rage feeds the burst
- r1-a-3 "Two-Handed Bleed" | the same build as "Bleed Burst Lunge"
- r1-b-3 "Spear Bleed Slam" | the round already holds 3 cards on this engine | engine: bleed from on-hit

## Found, not used

- Herald of Blood as the main clear: its explosions need a bleeding kill first.
```

- **The header**, rewritten each round for the whole deck: `## What the cards share`, the common core once, in
  player terms, in at most 80 words; `## How they differ`, one line on the deck's shape, naming each engine with
  its count of dealt cards over every round, `<consumed> from <supply> (<n>)`, and an engine the user's note
  exempted.
- **One `## Round <k>` per brainstorm round**, each line one dealt card: its id, its name in quotes, what it adds
  to the shared core, its engine, then its under-played label and `can't be finalized yet: <why>` (D-303) with
  `waits on the pin: <entry>` where they apply. "Not confirmed in game" is every card's default, which the
  display says once: no line repeats it, a links count or "no player evidence".
- **`## Not dealt`**: every card held back in any round, with its reason in plain words. The user can still ask
  for one at the brainstorm gate. `None.` when nothing was held back.
- **`## Found, not used`**, the last H2: up to five strong research findings no card uses, each `- <finding>:
  <why no card uses it>`, or `None.` The research files' `Supply search` sections name the suppliers no card
  uses.
- A later round keeps every card line already in `cards.md`, gate-made ones included, adds its `## Round <k>`
  after the last round, and adds its held-back cards to `Not dealt`.

## Returns

At most 8 lines: `cards.md`, the round's counts, the deck's under-played ids, and for a short round its
`short:` line:

```
cards.md
round 1: dealt 7, not dealt 2
under-played: r1-b-2, r1-c-3
```

```
cards.md
round 1: dealt 4, not dealt 5
under-played: r1-b-2, r1-c-3
short: 4 of 9 cards passed the sniff test
```

## Fault directives

None. Faults never reach R1a-assemble.
