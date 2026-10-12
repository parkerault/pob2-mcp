# Dossier: <the brief, in a few words>

<!--
Template for dossier.md, the verification gate's comparison table (slice 03 section 7.2, as D-355 reduces it),
written by the R1b-assemble step (.claude/skills/build-guide/references/stages/R1b-assemble.md), its only writer,
once per verification round. One line for the brief and the rounds, then one table with one row per verified
card, in id order; a later round adds its rows below the earlier ones. No H2, no H3 and no markers: each number
is the card's record's and each price its skeleton's entry, both found by the card's id. The design steps and
W1 read their card (cards/<id>.md) and its row. A cell holds no "|". Replace every <placeholder>; delete this
comment.
-->

Brief: <its fields as parsed: ascendancy, skill, playstyle, budget, around, like, notes, popularity; or "empty: surprise me">. Mode: <offline: no web source and no price was consulted | online>. Rounds: <brainstorm 1, started with the run; brainstorm <k>, "<the user's note>"; verification <v>: <its card ids>>.

| Card | Round | Status | Synergy | Named source DPS | Life | EHP | Key prices | League | Main risk |
|---|---|---|---|---|---|---|---|---|---|
| r1-a-2 | <v> | viable | <its synergy in a few words> | <Skill> <the Count-scaled figure> (<its field>), "estimate" when its group's Count is above 1 or the stage is computedWithCustomMods (D-296) | <Life> | <TotalEHP> | <item: amount currency, dated YYYY-MM-DD, or unavailable (<note>); each key item> | <none (offline) or <league> or <league>, unverified> | <what could sink it, the checklist's risks among them> |
| r1-b-1 | <v> | failed after <N> attempts: <the last errors>; reports/gates/R1b-r1-b-1-a<N>.json | <its synergy> | — | — | — | — | — | <its main risk> |
| r1-c-3 | <v> | can't be finalized yet: its damage source isn't a skill | <its synergy> | — | — | — | — | — | <what finalizing it waits on> |
