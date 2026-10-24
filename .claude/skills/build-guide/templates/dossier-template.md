# Dossier: <the brief, in a few words>

<!--
Template for dossier.md, the verification gate's comparison table (slice 03 section 7.2, as D-355 reduces it),
written by the R1b-assemble step (.claude/skills/build-guide/references/stages/R1b-assemble.md), its only writer,
once per verification round, and again for the rival's row (D-408). One line for the brief and the rounds, then
one table with one row per verified card, in id order; a later round adds its rows below the earlier ones, and
the rival's comes below its round's. No H2, no H3 and no markers: each number is the card's record's and each
price the card's converted key price, a range with its day (D-374), both found by the card's id. The EHP names
the hit it was measured against, the T15 map hits a skeleton's compile writes, so it compares with the design
gate's (D-423). The twelfth column, "key pieces", is a composite run's (one whose brainstorm rounds R1a-synthesize
composed, D-429, D-433): each composite's measured pieces with their largest drops, from its card's Pieces
measured, and "—" for a plain card. A run whose brainstorm rounds R1a-assemble dealt keeps the first eleven
columns, with no "key pieces"; the run checker rejects twelve there. The design steps
and W1 read their card (cards/<id>.md) and its row. A cell holds no "|". Replace every <placeholder>; delete this
comment.
-->

Brief: <its fields as parsed: ascendancy, skill, playstyle, budget, around, like, notes, popularity; or "empty: surprise me">. Mode: <offline: no web source and no price was consulted | online>. Rounds: <brainstorm 1, started with the run; brainstorm <k>, "<the user's note>"; verification <v>: <its card ids>>.

| Card | Round | Status | Synergy | Named source DPS | Life | EHP | Clear speed | Key prices | League | Main risk | key pieces |
|---|---|---|---|---|---|---|---|---|---|---|---|
| r1-s-1 | <v> | viable | <its synergy in a few words> | <Skill> <the Count-scaled figure> (<its field>: MinionTotalDPS for a minion skill, D-378), "estimate" when its group's Count is above 1 or the stage is computedWithCustomMods (D-296) | <Life> | <TotalEHP> vs <the hit it was measured against, from the record's configWritten: T15 map hits (D-423), or PoB's default hit when it holds none> | <the record's measures.clearSpeed.speed> (rough), or <speed> (PoB gives no area) when its noArea names a skill (D-407) | <item: amount currency, dated YYYY-MM-DD, or unavailable (<note>); each key item> | <none (offline) or <league> or <league>, unverified> | <what could sink it, the checklist's risks among them> | <each measured piece and its largest drop, with the figure it falls on: <piece> −<x>% (<the group's skill>, <clear, per corpse or boss>), joined with "; "; <piece> estimate (<reason>) or <piece> not measured; "—" for a plain card (D-433)> |
| r1-b-1 | <v> | failed after <N> attempts: <the last errors>; reports/gates/R1b-r1-b-1-a<N>.json | <its synergy> | — | — | — | — | — | — | <its main risk> | — |
| r1-c-3 | <v> | can't be finalized yet: its damage source isn't a skill | <its synergy> | — | — | — | — | — | — | <what finalizing it waits on> | — |
