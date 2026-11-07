# Dossier: <the brief, in a few words>

<!--
Template for dossier.md, the verification gate's comparison table (slice 03 section 7.2, as D-355 reduces it and
D-436 amends it), written by the R1b-assemble step (.claude/skills/build-guide/references/stages/R1b-assemble.md),
its only writer, once per verification round. One line for the brief and the rounds, then one table with one row
per verified card, in id order; a later round adds its rows below the earlier ones. No H2, no H3 and no markers.
Verification checks that the build works (it compiles and the skills work as expected), so the table carries no
figure: no damage, life, EHP or clear-speed number, which come at the design gate, measured on the full build
(D-436). Its nine columns, in this order, are the run checker's for a run held to amendment 11 (skillRevision 11);
the older forms with figure columns (ten, eleven, or twelve with "key pieces") are older runs', never written now.
Status is viable, "viable, except <piece> does nothing in PoB", "failed after <N> attempts: ..." (a damage-missing
failure among them) or "can't be finalized yet: ...". Damage is the named source and the kinds PoB shows for it;
Pieces a composite's count of the in pieces probed that do something, "—" for a plain card. Each price is the
card's converted key price, a range with its day (D-374), or as seen in players' words when its range rounds to 0.0
(D-442), found by the card's id. The design steps and W1 read their card (cards/<id>.md) and its row. A cell holds
no "|". Replace every <placeholder>; delete this comment.
-->

Brief: <its fields as parsed: ascendancy, skill, playstyle, budget, around, like, notes, popularity; or "empty: surprise me">. Mode: <offline: no web source and no price was consulted | online>. Rounds: <brainstorm 1, started with the run; brainstorm <k>, "<the user's note>"; verification <v>: <its card ids>>.

| Card | Round | Status | Synergy | Damage | Pieces | Key prices | League | Main risk |
|---|---|---|---|---|---|---|---|---|
| r1-s-1 | <v> | <viable, or viable, except <piece> does nothing in PoB when a row of its Pieces measured answers no> | <its synergy in a few words> | <the named source: the kinds PoB shows for it, of hit, damage over time, ignite, bleed, poison, minion damage ("Detonate Dead: hit, bleed, ignite"), with "(rated at its hand-cast speed)" when a meta gem triggers it> | <of the in pieces probed: "4 of 4 do something", or "3 of 4: <piece> does nothing in PoB; <piece>: PoB can't see it"; "—" for a plain card> | <item: about <low>–<high> divines around day 7, or <amount> <exalt or exalts, divine or divines, chaos> (seen YYYY-MM-DD) when its range rounds to 0.0, or unavailable (<note>); each key item> | <none (offline) or <league> or <league>, unverified> | <what could sink it, the checklist's risks among them> |
| r1-b-1 | <v> | failed after <N> attempts: <the last errors, or damage-missing: <its message>>; reports/gates/R1b-r1-b-1-a<N>.json | <its synergy> | — | — | — | — | <its main risk> |
| r1-c-3 | <v> | can't be finalized yet: its damage source isn't a skill | <its synergy> | — | — | — | — | <what finalizing it waits on> |
