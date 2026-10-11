# R1a-assemble: deal the deck (`build-guide-coordinator`)

Slice 03 §5.2 and §7.5; spine C-52, C-53, D-286, D-287, D-298, D-319, D-334, D-335, D-339. One step per
brainstorm round, after the round's R1a researchers return. It turns their cards into the deck the user picks
from at the brainstorm gate: it merges duplicates, checks each card's identity, deals a card only when lookups
confirm its load-bearing links in game text, and writes `cards.md`. It compiles nothing, prices nothing and
never edits a card.

## Inputs

- **Header:** `stage: "R1a-assemble"`, `attempt`, `mode`, `runFolder`, `compile: "none"`, `findings` (only an
  earlier attempt's note that it returned without its file: `cards.md` may then hold its partial work, so make
  it whole), `writes: ["cards.md"]`.
- **Prompt:** a `json` block for the round: `round`, the parsed `brief`, the user's `note` (a later round),
  and `researchers`, each `{letter, focus, researchFile, cards, returned}`; `returned: false` means that
  researcher returned without its files, so its cards may be missing or partial.
- **Read:** each card the prompt lists (`cards/r<k>-<letter>-<m>.md`, its brainstorm half); the card template
  `.claude/skills/build-guide/templates/card-template.md`; the pattern library
  `.claude/skills/build-guide/references/patterns.md`; `.claude/skills/build-guide/references/lookups.md`;
  and `cards.md` when an earlier round wrote it.

## Work

1. **Merge duplicates.** Two cards are duplicates when they share the identity and the chain (the same payoff,
   read from the same slot). Deal the one whose links table confirms more; the other goes under "Not dealt" as
   `duplicate of <id>`. A later round's card that duplicates one already in `cards.md` isn't dealt either.
2. **Check each card's identity** `{className, ascendancy, skill}`, `skill` being the named damage source
   (D-286), as the runner checks a brief:
   - the ascendancy: `mcp__pob2__get_classes` lists it (case-insensitive), under the card's class;
   - a named damage source that is a skill: `mcp__pob2__lookup_game_data {mode: "gem", query: <skill>}` gives
     a result headed `## <skill>` that says `Kind: active`;
   - a damage source that isn't a skill (an item, a passive or a modifier; D-334): a lookup by its kind
     returns it (`{mode: "unique", query: <exact name>}`, or `{mode: "mechanic", query: <its line>}` with
     `kind: "passive"` or `kind: "mod"`). Such a card can be dealt, marked "can't be finalized yet" (D-303);
   - the brief's fixed pieces: a card whose identity contradicts the brief's `ascendancy` or `skill` isn't
     dealt;
   - a skill the tree grants (D-342): run `mcp__pob2__search_tree_nodes {query: "Grants Skill: <skill>"}`
     again, once per skill the cards name, and read each node whose stats list `Grants Skill: <skill>`. With
     an `Ascendancy: <name>` line, the card's ascendancy must be `<name>`, and its identity must name the node;
     with none, the card must allocate the node. A card that breaks the lock isn't dealt: "Not dealt" gives
     `wrong-ascendancy: <skill> is granted only by <name>'s node "<node name>" (<node id>)`, or `doesn't
     allocate "<node name>" (<node id>), the node that grants <skill>`. When the brief names an `ascendancy`
     other than `<name>`, no card can pass: the round is short (step 6), `short: the brief's ascendancy can't
     use <skill>: only <name>'s node "<node name>" grants it`.

   A failed check holds the card back, naming what failed. Use the names exactly as the tools give them.
3. **The sniff test** (D-287). A link in the card's links table is load-bearing when the payoff stops working
   without it. Deal the card only when a lookup confirms every load-bearing link in game text: repeat the
   lookup the card names for the link, or the one that finds its text, and check that the quoted text is
   there. A load-bearing link no lookup confirms holds the card back, and "Not dealt" names that link. A hidden
   clause stated as theory ("from a Hit") doesn't hold a card back by itself, but the link it sits on still
   needs its text.
4. **Under-played cards** (D-298 as D-335 restates it; D-339). Each researcher built at least one of its 3
   cards on a pattern-library shape it judges under-played, labelled `Under-played (judgment)` in its pitch.
   Read each label against the library: keep it when the shape is one few builds use with this skill,
   ascendancy or playstyle, in your judgment too, and drop it otherwise. A kept label goes in the card's
   `cards.md` line as `under-played (judgment: <the shape, and why>)`. There is no popularity threshold and
   no tool for it: poe.ninja's builds API is closed to third parties (D-335). The brief's `popularity` notes,
   where they speak to a card, are the card's evidence, cited as the user's notes, never as your judgment.
5. **Deal 6–9 cards** for the round, in card-id order, from the cards that pass steps 1 to 3: the ones that
   differ most (delivery, damage source, focus), keeping **at least two under-played cards in the deck**. The
   deck is every round's dealt cards together, and a later round adds only new cards, so count the
   under-played cards already dealt in `cards.md`, and deal this round's under-played cards first when the
   deck needs them. Put the cards you don't deal under "Not dealt" as `round full`.
6. **A short round.** When fewer than 6 cards pass steps 1 to 3, or the deck still holds fewer than two
   under-played cards after this round, the round is short: deal what passes, and give the reason in your
   return as one line, `short: <why>` ("4 of 9 cards passed the sniff test"; "the deck holds one under-played
   card: the other two failed their identity check"). The runner records it in the run log, and the
   brainstorm gate says so.
7. **Write `cards.md`** (below).

## Writes: `cards.md`

`cards.md` only:

```
# Deck

## Round 1

- r1-a-1 "Bleed burst with Blood Hunt" | Warrior Titan, Blood Hunt | melee, few-buttons, boss | links confirmed 4 of 4 | evidence: no player evidence
- r1-b-2 "Totem slam relay" | Warrior Titan, Blood Hunt | totem-trap, one-button, clear | links confirmed 3 of 3 | under-played (judgment: a loop shape, rarely paired with Blood Hunt) | evidence: no player evidence

## Not dealt

- r1-c-1 "Rage cycling" | Warrior Titan, Blood Hunt | no lookup confirms "<the unconfirmed link>"
- r1-a-3 "Bleed burst, two-hander" | duplicate of r1-a-1
```

- One H2 per brainstorm round, `## Round <k>`, each line one dealt card: its id, its title in quotes, its
  identity (class, ascendancy, named damage source), its playstyle tags, how many of its links lookups
  confirmed, its under-played label when it has one, and its evidence (the user's notes, or "no player
  evidence"). A card that can't be finalized yet says so (D-303).
- The last H2 is `## Not dealt`: every card held back in any round, with what held it back: the link no
  lookup confirmed, the identity check that failed, `duplicate of <id>`, or `round full`. The user can still
  ask for one at the brainstorm gate. `None.` when nothing was held back.
- A later round keeps everything already in `cards.md`, adds its `## Round <k>` after the last round, and adds
  its held-back cards to `Not dealt`.

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
