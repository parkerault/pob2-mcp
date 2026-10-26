# Card <id>: <Name>

<!--
Template for cards/<id>.md (slice 03 section 7.5, spine C-52), one candidate build. The id is
r<round>-<researcher letter>-<n> (r1-a-2), r<round>-g-<n> for a card made at a gate (D-391), or r<round>-s-<n>
for a composite, one build composed from the whole brainstorm (D-429).
R1a writes the brainstorm half, about 250–400 words, from the pattern library
(references/patterns.md); R1a-synthesize writes a composite's whole brainstorm half, its Pieces table included
(stages/R1a-synthesize.md); R1b writes the verification half under it (and first, a gate's change to the
brainstorm half, stages/R1b.md), a composite's Pieces measured table included. Keep the two H2s and their H3s
below exactly, in this order, and add no other heading. The H3s "Pieces" and "Pieces measured" are a composite's
only (D-429, D-433): a card with "### Pieces" is a composite, whatever its id letter, and a plain card (a
researcher's, or a gate-made card drawn from cards only) has neither. The verification half carries no damage,
life or EHP figure: verification checks that the build works, and numbers come at the design gate (D-436). Replace every <placeholder>, keep
a line marked [only when ...] only when it applies (and drop the marker), and delete this comment.

Status words, used everywhere on the card, exactly as written here, one per link, figure or claim:
- confirmed in game text: a lookup returned the text;
- modelled in PoB: a compile record holds the figure;
- estimate (<the reason>): a Count, a custom modifier or a hand calculation carries it;
- players use it (the user's notes): the brief's `popularity` notes say players run it, cited as
  user-supplied; on a seed card, players use it (the user's reference) (D-393); no tool supplies player
  evidence (D-335);
- not checked yet: nothing has looked;
- needs in-game testing: no text or tool can settle it.
-->

## Brainstorm half

### Identity

- Class: <className>
- Ascendancy: <ascendancy>
- Named damage source: <the identity's skill: an active skill gem; a minion skill with its summon, "<skill>
  (cast by <minion>, summoned by <gem>)", D-379; or for a damage source that isn't a skill the item, passive or
  modifier that deals it, D-334>
- [only when the damage source isn't a skill] Can't be finalized yet: its damage source isn't a skill
  (D-303).
- [only when the card rests on a league-digest entry the PoB pin doesn't know] Can't be finalized yet: <entry>
  isn't in the PoB pin (D-400).
- [only when a passive-tree node or a unique grants a skill the card uses, D-342; one line per skill]
  Granted by: <skill>: "<node name>" (<node id>), <a <ascendancy> ascendancy node | allocated by this card>,
  or <the unique>, equipped by this card.
- Weapon sets: <none | a second tree | a second weapon | a set-2 buff, one or more, D-426>: <what set 2 holds
  (its passives' job, its weapon, the buff cast from it) and when the player swaps to it; "none" when the card
  uses one set>.

### Pitch

- Name: <a few words of the build's own, then its main skill (the named damage source, not a skill that feeds
  it), then the ascendancy: "Reaping Bonfire Detonate Dead Blood Mage" (D-442); unique in the run>
- Why pick it: <the hook in player terms, at most two sentences>
- How it clears: <how a pack dies, which buttons the player presses, how soon it hits a new pack and how fast
  it moves between packs; no "(an estimate)" mark: the gate adds it>
- Bosses: <its answer to one tough enemy, in one sentence>
- Needs: <the key items, gems and passives; when it comes online (level or act); a respec, if it takes one;
  a rough cost, when known>
- The catch: <the main risk or cost, in one sentence>
- [only on the obvious card, r1-a-1; D-403] Obvious build: <the kit it follows: its archetype's standard kit and
  the ascendancy's intended play>
- [only on an under-played card, at least one of each researcher's 3; D-339] Under-played (judgment): <the
  pattern-library shape, and why few builds use it with this skill, ascendancy or playstyle>
- [only when a load-bearing link isn't confirmed in game text] Not confirmed: <the link>: <what it would
  change>
- Playstyle: <tags from the brief's vocabulary: delivery, buttons, focus, defence, pace; never displayed>

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
- Reference build: <a published build guide the card draws on, by its title, and what it shows, with its marker
  `external | <url> | accessed: YYYY-MM-DD | confidence: <H|M|L>` (D-445; the brainstorm gate then shows "drawn
  from <host>") | Seed: <the reference the user named>, on a seed card (D-393) | none>

### Risks so far

- Payoff thieves: <hit sources that could spend the state first | none found>
- Placement limits: <where the skill can't land or target | none found>
- Exposed phase: <when the build is vulnerable, and what covers it | none found>
- Resistant bosses: <bosses that resist the damage source's element | none found>

### Pieces

[only on a composite (D-429, D-432): this H3 and its table, one row per piece it weighs; a plain card has neither]

| Key | Piece | Kind | Status | Where | Why | From |
|---|---|---|---|---|---|---|
| <i<k><letter>-<m>, an Ideas line's id \| c<card id>-<m>, from a card's links> | <the piece, by the name its lookup gives> | <skill \| support \| unique \| mod \| node \| keystone \| rune \| config>[, under-played] | <in \| scheduled \| out> | <a slot, group, set or node for in and scheduled \| — for out> | <the job it does; required for scheduled and out> | <every source: card ids and Ideas ids> |

## Verification half

### Structure check

- <one line each, on paper (D-406): the levers it pulls and leaves; each load-bearing assumption flipped; what
  grows with a count and what pays for it; what each premium slot serves>
- [only when a flip beats the card on paper] A stronger structure? <the flip, in a sentence, and the rough
  multiplier>

### Verified

- Compiled: <the skeleton compiled, stage <stage id> (modelled in PoB) | didn't compile: <the first error>>.
- Damage: <the named source>: <the kinds PoB shows for it, of hit, damage over time, ignite, bleed, poison, minion
  damage>[ (rated at its hand-cast speed), when a meta gem triggers it] | <the kind> shows nothing on <the named
  source> (damage-missing) (modelled in PoB; no figure: numbers come at the design gate, D-436).
- [only on a composite] Pieces: <n> of <m> in pieces probed do something, as Pieces measured answers.
- [only when the damage source isn't a skill] Not compiled: its damage source isn't a skill. Only the
  checklist's read-only checks ran (D-334).

### Estimates

- Count: <group> × <n>, because <the reason> (estimate).
- Custom modifier: "<the line>", because <the reason> (estimate).
- Computed with a custom modifier present: <which figures, by name, defences included; no number> (estimate:
  custom modifier present).
- Clear: <its groups>. Boss: <its groups>. Kept separate, never summed.

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

- <item>: <about <low>–<high> divines around day 7 (seen <amount currency> on YYYY-MM-DD, day <n> of <league>[, late] | <league>, its day unknown) | <amount> <exalt or exalts, divine or divines, chaos> (seen YYYY-MM-DD), when the range rounds to 0.0 divines (D-442) | <amount currency>, seen YYYY-MM-DD, not converted: no currency rates | unavailable (<note>)>

### Pieces measured

[only on a composite (D-433): this H3 and its table, R1b's leave-one-out probes of `in` pieces; a plain card has
neither. No figure: the drops go in R1b's verdict file (D-436)]

| Key | Left out by | Does something |
|---|---|---|
| <an `in` Pieces row's key> | <how the probe left the piece out \| —> | <yes, leaving it out moves one of its figures by 1% or more \| no \| PoB can't see it \| not measured (<why>)> |
