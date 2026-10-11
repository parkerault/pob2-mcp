# Card <id>: <title>

<!--
Template for cards/<id>.md (slice 03 section 7.5, spine C-52), one candidate build. The id is
r<round>-<researcher letter>-<n> (r1-a-2). R1a writes the brainstorm half, about 250–400 words, from the
pattern library (references/patterns.md); R1b writes the verification half under it. Keep the two H2s
and their H3s below exactly, in this order, and add no other heading. Replace every <placeholder>, keep a
line marked [only when ...] only when it applies (and drop the marker), and delete this comment.

Status words, used everywhere on the card, exactly as written here, one per link, figure or claim:
- confirmed in game text: a lookup returned the text;
- modelled in PoB: a compile record holds the figure;
- estimate (<the reason>): a Count, a custom modifier or a hand calculation carries it;
- players use it (the user's notes): the brief's `popularity` notes say players run it, cited as
  user-supplied; no tool supplies player evidence (D-335);
- not checked yet: nothing has looked;
- needs in-game testing: no text or tool can settle it.
-->

## Brainstorm half

### Identity

- Class: <className>
- Ascendancy: <ascendancy>
- Named damage source: <the identity's skill: an active skill gem, or for a damage source that isn't a skill
  the item, passive or modifier that deals it, D-334>
- [only when the damage source isn't a skill] Can't be finalized yet: its damage source isn't a skill
  (D-303).
- [only when a passive-tree node grants the skill, D-342] Granted by: "<node name>" (<node id>), <a
  <ascendancy> ascendancy node | allocated by this card>.

### Pitch

- Title: <at most 60 characters; names the idea, not the roll>
- Playstyle: <tags from the brief's vocabulary: delivery, buttons, focus, defence, pace>
- [only on the card you judge under-played, at least one of each researcher's 3; D-339] Under-played
  (judgment): <the pattern-library shape, and why few builds use it with this skill, ascendancy or playstyle>
- <Line 1: what the build does.>
- <Line 2: how it kills.>

### Chain

- Damage source: <the named damage source>, reading <what it reads>, carried by <the slot>.
- Multipliers: <each, with what it multiplies>.
- Enablers: <each, with the link it makes possible>.
- Consumes or requires: <what the payoff consumes or requires>, supplied by <the skill, item or minion that
  supplies it | itself>.

### Enabler

- <The item, node or gem>: arrives at level <n>, by <how to get it: a drop, a vendor, a craft, an
  ascendancy trial>.
- Dormant until then: <what does nothing before it arrives | nothing>.

### Links

| Link | Game text | Lookup | How PoB follows it | Hidden clauses (theory) | Status |
|---|---|---|---|---|---|
| <A → B> | "<the confirming text, quoted>" | <the call that returned it> | <modelled \| Count \| custom modifier \| config stand-in \| hand calculation \| not modelled> (<PG ids>) | <"from a Hit", "you use yourself", "while in Bear form" \| none> | <a status word> |

### Evidence

- Player evidence: <the brief's `popularity` notes on this card's skill, ascendancy or combination,
  quoted and cited as user-supplied ("the user's notes") | no player evidence>
- Reference build: <the build and what it shows | none>

### Risks so far

- Payoff thieves: <hit sources that could spend the state first | none found>
- Placement limits: <where the skill can't land or target | none found>
- Exposed phase: <when the build is vulnerable, and what covers it | none found>
- Resistant bosses: <bosses that resist the damage source's element | none found>

## Verification half

### Verified

- Defences (modelled in PoB): life <`Life`>, energy shield <`EnergyShield`>, resistances <the four
  `Missing<Elem>Resist` values>, max hit <each `<Type>MaximumHitTaken`>, effective HP <`TotalEHP`>.
- Modelled DPS: <the named source's Count-scaled figure (`countedSkillOutputs`), its stat set and group>
  (modelled in PoB; an estimate when its Count is above 1 or a custom modifier is present).
- [only when the damage source isn't a skill] Not compiled: its damage source isn't a skill. Only the
  checklist's read-only checks ran (D-334).

### Estimates

- Count: <group> × <n>, because <the reason> (estimate).
- Custom modifier: "<the line>", because <the reason> (estimate).
- Computed with a custom modifier present: <each figure, defences included> (estimate: custom modifier
  present).
- Clear: <figure, its group>. Boss: <figure, its group>. Kept separate, never summed.

### Checklist results

| # | Check | Result | Detail |
|---|---|---|---|
| 1 | Pillars for ailments and damage over time | <verified \| estimate \| risk \| not checked> | <base, type-specific scaling, duration, 100% application> |
| 2 | Enabler's conditions at the target level | <result> | <the numbers; what they force out; permanence> |
| 3 | Attribute requirements at the target level | <result> | <the defining items and every gem> |
| 4 | Risks PoB can't show | <result> | <payoff thieves, placement, exposed phase, cooldown dead windows, hidden clauses> |
| 5 | Dead-slot audit | <result> | <what was removed, the change; activation or payload per support> |
| 6 | Condition on and off | <result> | <both figures, the uptime, the blend> |
| 7 | Encounter mods | <result> | <the figure with added resistance; the bosses that resist> |
| 8 | Skill-shape probe | <result> | <the probe and its change \| no shape in the text> |

### Fallback ladder

1. <The first fallback if a link fails, and what it costs.>
2. <The next, cheapest first.>

### Key item prices

- <item>: <amount currency, dated YYYY-MM-DD | unavailable (<note>)>
