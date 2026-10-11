# R1a-assemble: deal the deck (`build-guide-coordinator`)

Slice 03 §5.2 and §7.5; spine C-52, C-53, D-286, D-287, D-298, D-319, D-334, D-335. One step per brainstorm
round, after the round's R1a researchers return. It turns their cards into the deck the user picks from at the
brainstorm gate: it merges duplicates, checks each card's identity, deals a card only when lookups confirm its
load-bearing links in game text, and writes `cards.md`. It compiles nothing, prices nothing and never edits a
card.

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
     dealt.

   A failed check holds the card back, naming what failed. Use the names exactly as the tools give them.
3. **The sniff test** (D-287). A link in the card's links table is load-bearing when the payoff stops working
   without it. Deal the card only when a lookup confirms every load-bearing link in game text: repeat the
   lookup the card names for the link, or the one that finds its text, and check that the quoted text is
   there. A load-bearing link no lookup confirms holds the card back, and "Not dealt" names that link. A hidden
   clause stated as theory ("from a Hit") doesn't hold a card back by itself, but the link it sits on still
   needs its text.
4. **Deal 6–9 cards** for the round, in card-id order, from the cards that pass steps 1 to 3. When more pass,
   deal the 9 that differ most (delivery, damage source, focus) and put the rest under "Not dealt" as
   `round full`. When fewer than 6 pass, deal those and say so in your return.
5. **Under-played cards** (D-298, as D-335 restates it). At least two dealt cards of the deck are ones you
   judge under-played: a shape from the pattern library that few builds use with this skill or ascendancy.
   Label each in its line `under-played (judgment: <the shape, and why>)`. There is no popularity threshold and
   no tool for it: poe.ninja's builds API is closed to third parties (D-335). The brief's `popularity` notes,
   where they speak to a card, are the card's evidence, cited as the user's notes, never as your judgment.
   When fewer than two dealt cards qualify, say so in your return.
6. **Write `cards.md`** (below).

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

At most 8 lines: `cards.md`, the round's counts, and the under-played ids:

```
cards.md
round 1: dealt 7, not dealt 2
under-played: r1-b-2, r1-c-3
```

## Fault directives

None. Faults never reach R1a-assemble.
