# Dossier: <the brief, in a few words>

<!--
Template for dossier.md (slice 03 section 7.2), written by the R1b-assemble step
(.claude/skills/build-guide/references/stages/R1b-assemble.md), its only writer, once per verification round.
Keep the six H2 headings below exactly, in this order, and add no other H2. Under Concepts, one H3
"<id>: <title>" per verified card, its id the card's (r1-a-2). Every claim carries a footnote marker; every
marker has exactly one definition line, and all definitions go at the very end of the file, below Not
carried, with no heading after them (source-markers.md). Replace every <placeholder>; delete this comment.
-->

## Roll and mode

Brief: <its fields as parsed: ascendancy, skill, playstyle, budget, around, like, notes, popularity; or
"empty: surprise me">. Mode: <offline: no web source and no price was consulted | online>.
League: <none (offline) | <league>, from get_leagues | <league>, unverified: trade couldn't be reached, so
D1 doesn't take the league from here>.

- Brainstorm round 1: started with the run.
- Brainstorm round <k>: <the user's note>.
- Verification round <v>: <the cards it verified>.

## Mechanics

<What each card's named damage source does, its stat sets with base damage and critical hit chance, its
weapon, and when it can first be used; how the ascendancy interacts with it; what PoB doesn't model of
it.>[^p1r1-1]

## Synergy search

<Uniques, supports, ascendancy notables and keystones that change how the skill plays, and why.>[^p1r2-1]

## Config gaps

<Each combo, stack, buff or condition the build depends on: covered by a PoB config option, or a hand
calculation, Count or custom modifier with the inputs it needs (D-123, D-293).>[^p1r1-2]

## Concepts

### r1-a-2: <title>

- Key uniques: <names, or None>
- Ascendancy nodes: <names>
- Supports: <the named damage source's supports>
- Keystones: <names, or None>
- Feasibility read: <can it reach the endgame bar: all four resistances capped, the named damage source the
  main source of damage, a budget variant within 20 divines; what it rests on>
- Risks: <what could sink it, the checklist's risks among them>
- What PoB can't verify: <the flagged lines, config gaps and estimates it needs>
- Proposed in: cards/r1-a-2.md
- Skeleton: concepts/r1-a-2/plan.json
- Compile: <compiled, no errors | failed after <N> attempts: <the last errors>>
- Record: <concepts/r1-a-2/compile-record.json | none>
- Key numbers: <field> <value>, …, TotalEHP <value>; a figure resting on Count above 1 or a custom modifier
  marked "estimate" (D-296)[^r1-a-2-1]
- Key-item prices: <item>: <amount currency, dated YYYY-MM-DD | unavailable (<note>)>[^r1-a-2-2]
- Status: <viable | failed: <evidence>>

### r1-c-3: <title>

[only for a card whose damage source isn't a skill (D-303, D-334): it compiled nothing, so it has no skeleton,
record or prices, and it is never a failure; drop this note]

- Key uniques: <names, or None>
- Ascendancy nodes: <names>
- Supports: <None, or the supports its chain names>
- Keystones: <names, or None>
- Feasibility read: <what the read-only checks found, and what finalizing it waits on: a plan field for an
  item-effect damage source (HG-21)>
- Risks: <what could sink it, the checklist's risks among them>
- What PoB can't verify: <its damage source, and every figure that rests on it>
- Proposed in: cards/r1-c-3.md
- Skeleton: none
- Compile: not compiled: its damage source isn't a skill
- Record: none
- Key numbers: none (not compiled)
- Key-item prices: none (not compiled)
- Status: can't be finalized yet: its damage source isn't a skill

## Not carried

- <id> "<title>" (cards.md): dealt, not verified yet; the verification gate can still verify it.

[^p1r1-1]: pob-data | lookup_game_data gem "<Skill>" | patch: <enginePatch>
[^p1r2-1]: judgment | <the reasoning, in a few words> | confidence: <H|M|L>
[^p1r1-2]: pob-data | check_model_coverage gem "<Skill>" | patch: <enginePatch>
[^r1-a-2-1]: pob-computed | r1a2e.<Field>
[^r1-a-2-2]: price | r1-a-2-<item>
