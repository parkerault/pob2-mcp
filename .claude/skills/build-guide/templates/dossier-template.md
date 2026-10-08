# Dossier: <Ascendancy> / <Skill>

<!--
Template for dossier.md (slice 03 section 7.2), written by the R1b-assemble step
(.claude/skills/build-guide/references/stages/R1b-assemble.md) and fixed only by the dossier-fix step.
Keep the six H2 headings below exactly, in this order, and add no other H2. Under Concepts, one H3
"<id>: <title>" per carried concept. Every claim carries a footnote marker; every marker has exactly one
definition line, and all definitions go at the very end of the file, below Not carried, with no heading
after them (source-markers.md). Replace every <placeholder>; delete this comment.
-->

## Roll and mode

<Class> <Ascendancy> with <Skill>. Mode: <offline: no web source and no price was consulted | online>.

- Round 1: started with the run.
- Round <k>: <the user's note>.

## Mechanics

<What the rolled skill does, its stat sets with base damage and critical hit chance, its weapon, and when
it can first be used; how the ascendancy interacts with it; what PoB doesn't model of it.>[^p1r1-1]

## Synergy search

<Uniques, supports, ascendancy notables and keystones that change how the skill plays, and why.>[^p1r2-1]

## Config gaps

<Each combo, stack, buff or condition the build depends on: covered by a PoB config option, or a hand
calculation with the inputs it needs (D-123).>[^p1r1-2]

## Concepts

### c1: <title>

- Key uniques: <names, or None>
- Ascendancy nodes: <names>
- Supports: <the rolled skill's supports>
- Keystones: <names, or None>
- Feasibility read: <can it reach the endgame bar: all four resistances capped, the rolled skill the main
  damage source, a budget variant within 20 divines; what it rests on>
- Risks: <what could sink it>
- What PoB can't verify: <the flagged lines and config gaps it needs>
- Proposed in: research/p1-r1a-<n>.md
- Skeleton: concepts/c1/plan.json
- Compile: <compiled, no errors | failed after <N> attempts: <the last errors>>
- Record: <concepts/c1/compile-record.json | none>
- Key numbers: <field> <value>, …[^c1-1]
- Key-item prices: <item>: <amount currency, dated YYYY-MM-DD | unavailable (<note>)>[^c1-2]
- Status: <viable | failed: <evidence>>

## Not carried

- <id> "<title>" (research/p<k>-r1a-<n>.md): not carried; round <k> already carried 3 concepts (D-235).

[^p1r1-1]: pob-data | lookup_game_data gem "<Skill>" | patch: <enginePatch>
[^p1r2-1]: judgment | <the reasoning, in a few words> | confidence: <H|M|L>
[^p1r1-2]: pob-data | check_model_coverage gem "<Skill>" | patch: <enginePatch>
[^c1-1]: pob-computed | c1e.<Field>
[^c1-2]: price | c1-<item>
