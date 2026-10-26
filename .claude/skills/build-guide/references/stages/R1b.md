# R1b: card skeleton, measure-only compile, key-item prices, the checklist (`build-guide-coordinator`)

One step per picked card, one at a time, at most 3 per verification round. It
checks the card's structure on paper, turns the card into an endgame skeleton plan, compiles it measure-only,
prices the card's key items, runs the advisory checklist with its probes, and writes the card's verification
half. On a **composite** (any card with `### Pieces`, whatever its id letter: one R1a-synthesize composed, or one a
gate made from pieces, D-429, D-432), the skeleton carries every piece the composite takes, and leave-one-out probes
measure each piece inside it (D-433; "A composite's pieces" below).

**Verification checks that the build works** (D-436): the user's test is "it compiles and the skills work as
expected", and the user decides which cards to finalize. Numbers come at the design gate, measured on the full
build, so the card, the dossier and the display carry no damage, life or EHP figure. R1b makes **three checks**:
1. **It compiles:** `verdict.compiled: "pass"`.
2. **The named source deals the card's damage:** each kind of damage the card names shows a figure above 0 on the
   named source's group in the skeleton's record (the damage check, below). A kind that shows nothing is a
   `damage-missing` finding, and the attempt fails.
3. **Each piece in does something:** on a composite, each leave-one-out answers `yes`, `no`, `PoB can't see it` or
   `not measured (<why>)` ("A composite's pieces").

**Gate:** the skeleton compiled with no compile error, and the named source shows every kind of damage the card
names. You write the gate's verdict file yourself. A failed attempt (a failed compile, or a `damage-missing`
finding) re-runs with your verdict as findings, at most 2 counted retries; then the card is `failed`, its last
verdict the evidence (D-141). A card that failed `damage-missing` can still be finalized anyway at the
verification gate (`checkpoints.md`).

## Inputs

- **Header:** `stage: "R1b"`, `attempt`, `concept` (the card id, `r<round>-<letter>-<n>`, D-319), `mode`,
  `runFolder`, `runFolderRel`, `compile: "measure-only"`, `findings` (the earlier attempt's verdict file and
  its findings: fix what each names), `faults` (FI-1, offline test runs only), `changes` (a gate's change,
  below), and `writes:
  ["concepts/<id>/plan.json", "reports/gates/R1b-<id>-a<attempt>.json", "cards/<id>.md",
  "probes/<id>/<n>/"]`: the card, for its verification half, and its probes, `n` from 1 to 4 (D-338), to 8 on a
  composite (D-433).
- **Prompt:** the card's id and name, the gate's interview notes when the user asked questions, and how to price
  in this run (offline; stopped, with only the currency exchange's items still priced; or paced; and with
  `--no-ninja`, no currency rates).
- **The card's identity** `{className, ascendancy, skill}`, `skill` its **named damage source** (D-286), is the
  skeleton's `roll`. The named damage source is the main source of damage, never a token role: its group is
  the skeleton's `rolledGroup`. A minion skill's group holds its summon and names it as `minionSkill` (D-379).
- **Read:** the card `cards/<id>.md` (its brainstorm half: identity, chain, enabler, links and risks; on a
  composite, its `### Pieces` table, the pieces to carry and to probe) and the round's research files for the
  mechanics; `docs/build-guide/plan-reference.md` by section, never whole (Grep
  `^#` for its headings and Read the worked example, and "A minion's skill" for a minion skill; when `validate`
  names a field, Grep that field's row); the pattern library's "Standard kits" entry for the card's archetype,
  for the structure check (Grep `^#` in `.claude/skills/build-guide/references/patterns.md`, Read that entry);
  `pob-pin.json` (the pin's tag and commit); the data under `data/` for scenario inputs and the entries the card
  cites; `run-log.json` (is a pricing stop open? step 6); the other plans of this run (`concepts/*/plan.json`), for
  prices to reuse. On attempt 2 or 3, your earlier skeleton at `concepts/<id>/plan.json` is there to fix.

## Work

**A gate's change, first** (D-391), when the header's `changes` holds one, before the lock and any compile:

- **A revision**, `{visit, words}`: add `- Changed at the gate (visit <visit>): <words>` as the Pitch's last
  line, make the edits to the brainstorm half, and re-check with the lookups every link the change touches and
  any new one. The card keeps its id and its name.
- **A card made at the gate** (`r<k>-g-<n>`), `{visit, name, from, words}`: write `cards/<id>.md` from the
  template, its brainstorm half from the user's words, the cards in `from` and their research files, like any
  card: its name `name`, and `- Made at the gate (visit <visit>): from <name> and <name>: <words>` as the
  Pitch's last line, naming the `from` cards. Every link is new: confirm each with a lookup.
- **A piece added or dropped on a composite** (D-432), a revision whose words name a piece by its name or key ("add
  Blood Magic", "drop i1b-4"): move the piece's `### Pieces` row. An added piece is `in` (or `scheduled`, with its
  why, when it fights a piece in), under the key `cards.md`, a card's Pieces table or an Ideas line gives it (Grep the
  key or the name across `cards/` and `research/`), else `c<this card's id>-<m>`, `m` one past the card's highest; its
  From names its sources and `gate (visit <visit>)`. A dropped piece is `out`, Where `—`, Why `dropped at the gate
  (visit <visit>): <the user's words>`. Re-check every link it touches, as for any revision.
- **A card made at the gate from pieces** (D-432): when `from` names a piece key (a Pieces row's or an Ideas
  line's) or a composite, the new card is a composite. Its brainstorm half also has `### Pieces`, in
  `R1a-synthesize.md`'s form (its "Writes"; Read that section): the named damage source and its enabler first, then
  every piece `from` names by key and every piece of a composite it names, each with its key and sources kept, in,
  scheduled or out by the user's words, with its why. It is measured as a composite (below). The Made line names
  each piece by its name.

A change that breaks the card (a load-bearing link no lookup confirms, a chain that no longer holds) fails the
attempt: write only the verdict, `compiled: "fail"`, one finding `{part: "compiled", code: "gate-change",
message: "<why>"}`, `errors: []`, `compiles: 0`, `recordPath: null`, `faultsApplied: []`. A retry keeps the
user's words and the line, and fixes only what its findings name, never reworking the change.

At most **two compiles per attempt**, both measure-only: an optional bootstrap compile (step 3), then the
last compile of the whole skeleton (step 8). Validation comes before any price call, so no trade call (the
trade site's limits are shared with the user's account) is spent on an item validation would reject. The
verification checklist's probe variants (below) come on top: up to 4 per card (D-292), and up to 8 on a composite:
the checklist's 4, then 4 leave-one-out probes (D-433).

**The ascendancy lock** (D-342), the identity check every card gets first, before any compile and before
FI-1. For every skill the card names (its named damage source, and each skill in its chain and links; a minion
skill's summon too, D-379), run `mcp__pob2__search_tree_nodes {query: "Grants Skill: <skill>"}` and
`mcp__pob2__lookup_game_data {mode: "mechanic", query: "<skill>", kind: "unique"}`. A skill is locked when a
node grants it (its stats list `Grants Skill: <skill>`), every such node is an ascendancy node (an
`Ascendancy: <name>` line), and no unique has a line `Grants Skill: <skill>` or `Grants Skill: Level
(<range>) <skill>`.

- **The card uses a locked skill, and no node that grants it is the card's ascendancy's:** the card's
  character can't use that skill, so the card fails at once. Write no skeleton, compile nothing, run no
  checklist or probe, price nothing and leave the card as R1a wrote it; write only the verdict (step 9) with
  `compiled: "fail"`, one finding per such skill, `{part: "compiled", code: "wrong-ascendancy", message:
  "<skill> is granted by <each node, <name>'s node \"<node name>\" (<node id>)>; the card's ascendancy is
  <ascendancy> (D-342)"}` (`granted only by` when one node is the skill's only source), `errors: []`,
  `compiles: 0`, `recordPath: null` and `faultsApplied: []`. It is terminal: the runner never re-runs it, since
  no retry can change the card's identity. Unlike a card whose damage source isn't a skill, it is a plain
  failure: its status is `failed`, and it counts among the failed cards when none is viable (D-141).
- **A skill a non-ascendancy node grants, which the card takes from that node:** step 1's tree targets
  include the node.
- **Otherwise** (the card's ascendancy owns a granting node, a unique or a non-ascendancy node grants the
  skill, or nothing does): go on.

A card that passes the lock and whose damage source isn't a skill (D-334) gets none of steps 1 to 8: see "A
card whose damage source isn't a skill" below. A minion skill is a skill, even one a passive grants: it gets
every step (D-379). Nor does a card whose named damage source or load-bearing link is a league-digest entry
marked `[not in pin]` (D-400): the same paragraph says what it gets.

**The structure check** (D-406), on paper, for every card that passes the lock, before step 1: a few paragraphs
of rough arithmetic and no compile, from the card and its archetype's Standard kits entry.

- **The levers:** for the archetype's big levers, what the card pulls and what it leaves ("100 Spirit on a
  minion build" is one line).
- **Flip the assumptions:** the card's two or three load-bearing assumptions, each reversed in a paragraph.
  "The ground needs a freeze" leads to a supply search by family (`R1a.md`, D-404); "the weapon is a wand", to a
  sceptre and the army; "one djinn", to a second.
- **Counts:** what grows with a count (Muster with minion types) and what pays for a bigger count (a sceptre's
  Spirit), rough on purpose: Muster at eight types is about 7% × 8. A tamed beast reserves a percentage of
  your Spirit, so each point of Spirit buys a little less once one is out (D-402).
- **Premium slots:** what each premium slot serves. One that props up the engine rather than the damage is a
  lead: search for a supply that frees it.

Write it as the card's `### Structure check`, one `- ` line per step. When a flip beats the card on paper, the
last line is `- A stronger structure? <the flip, in a sentence, and the rough multiplier>`: the verification gate
shows it, and the user can make a new card from it. The skeleton still tests the card as written.

**On a composite**, after the last compile (step 8), compare each other enabled `clear` group's figure with the
named damage source's (the measure's per-second figures, "A composite's pieces" below). When one is larger, the
last line is `- A stronger structure? <the group's skill> as the named source` (D-433): the user may make that card
at the verification gate (D-391), and the next round's synthesis composes the structure. The section has one such
line, its last: with a flip too, it is `- A stronger structure? <the group's skill> as the named source; <the
flip, and its multiplier>`. **Whenever you write a composite's `### Structure check`, write its `### Pieces
measured` before the verdict too**, whatever happens after: a piece no probe measured is `not measured (<why>)`,
so a failed attempt's rows say why (the run checker holds a composite with a written structure check to its table).

1. **Tree targets.** From the card's chain and links, list the ascendancy nodes, notables and keystones the
   card rests on, and for a minion skill the passives that grant it and its summon (the lock's `Grants Skill:`
   nodes; PoB measures the skill without them, but V1 reports `not-granted`, D-380), each with its node id
   (`mcp__pob2__search_tree_nodes {query}`, or `{ascendancy}` for the ascendancy's own nodes).
   `mcp__pob2__search_tree_nodes` gives no links between nodes, so the paths come from step 3.
2. **FI-1**, only when the header's `faults` holds it: FI-1 goes into this attempt's **first** compile, so a
   faulted attempt compiles nothing clean and a card FI-1 fails leaves no clean record (D-265). That first
   compile is the bootstrap (step 3), which you then always run, even when the skeleton's tree is already
   pathed: add `{"name": "FI-1 Unknown Gem", "level": 1, "quality": 0, "enabled": true}` to the gems of the
   bootstrap skeleton's main socket group (`skills.main.group`) before you compile it. Don't validate first,
   and don't remove the gem in this attempt. The compile fails with an error naming the gem; stop there, as
   step 3 says, and write the verdict (step 9). Without FI-1 in the header, the skeleton holds no
   `FI-1 Unknown Gem`: remove one an earlier attempt left.
3. **Bootstrap compile** (at most once per attempt; skip it when the skeleton's tree is already pathed,
   e.g. on a retry whose findings aren't about the tree, unless step 2 applies FI-1). Write
   `concepts/<id>/plan.json` as a tree-minimal skeleton: the roll, versions and league of step 4, its one
   stage with an empty tree (no
   `nodes`, `ascendancyNodes`, weapon-set nodes or attribute choices), no item slots, jewels or toggles,
   the named damage source alone in one group (with its `role`, `main` and `rolledGroup`; for a minion skill,
   its summon, with `main.activeSkill` on the summon, never on its "Command" skill, the skill as the group's
   `minionSkill`, `minionStatSet` when it has several stat sets, and the plan at `schemaVersion: 5`, D-379),
   the scenario's
   `enemyIsBoss` and resistance penalty, no claims and no prices. Compile it:
   `mcp__pob2__compile_plan {plan_path: "<runFolderRel>/concepts/<id>/plan.json", measure_only: true}`. The engine
   then holds the class and ascendancy with only their start nodes allocated, so
   `mcp__pob2__find_path_to_node {target_node_id: <id>}` gives the nodes between the start and each target, and
   `mcp__pob2__get_nearby_nodes` shows what lies around them. The last compile overwrites the bootstrap's record and
   XML. If the bootstrap compile fails, stop: report its errors with `compiled: false`.
4. **Write the skeleton** `concepts/<id>/plan.json` (C-31), a plan that tests the card at the
   endgame, not a guide:
   - `roll` is the card's identity (class, ascendancy, named damage source), exactly as the card names it
     (D-286).
   - `versions`: `pobTag` and `pobCommit` from `pob-pin.json`; `treeVersion`, `enginePatch` and
     `externalPatch` as the plan reference describes. The compile record notes any that differ from the
     engine.
   - `league`: offline, `null`; online, the current trade league from `mcp__pob2__get_leagues`. If trade can't be
     reached, reuse the league of another plan in this run, else `Standard`, and return
     `leagueUnverified: true`. The dossier then marks the league unverified, and **D1 doesn't take its
     league from a skeleton whose league is unverified**. **While a pricing stop is open** (step 6's test), make
     no trade-site call, `mcp__pob2__get_leagues` included (D-422, D-444): the league is one a plan of this run
     recorded before the stop (not one marked unverified); with none, `Standard`, and return `leagueUnverified: true`.
   - **One stage**, `id` the card id without its hyphens, then `e` (`r1a2e` for card `r1-a-2`: a stage id
     is letters and digits only, so a dossier ref like `r1a2e.Life` names this card's record),
     `progress: "endgame"`, no `variant`, a `level` the card is meant to play at (90 when the card doesn't
     say), and `loadoutName` `<the card's name> (L<level>) {<stage id>}`.
   - `tree`: the targets of step 1 and the paths step 3 found to them, so every node connects to the
     class start through listed nodes, and no more points than the level allows
     (`data/campaign/limits.json`).
   - `items`: each key unique's text from `mcp__pob2__lookup_game_data {mode: "unique", query: <exact name>}`
     (full text comes only for a single match); plain bases or simple rares for the other slots the
     skill needs (its weapon first).
   - `skills`: the named damage source's group with the card's supports (a minion skill's: its summon's
     group, as step 3 writes it), each group with a `role` (the named source's is `clear` or
     `single_target`), `main` on the named source, and `rolledGroup`; a
     `count` with its `countReason` where the card's chain has several copies act at once (D-293).
   - **A composite's skeleton** (D-433) carries **every piece its `### Pieces` table has `in` or `scheduled`**,
     each where its `Where` puts it (a support in its group, a unique or a rare's mod line in its slot, a node on
     the tree, a rune in its item, a config condition in `config`), and **a scheduled piece in its own group**: a
     boss button, a group with role `single_target`; a skill on one weapon set, a group with `weaponSet: <n>`
     (amendment 9 §24.2, D-426), its figure from the record's `skillOutputs`, or `skillOutputsSet2` on set 2. **A
     second clear group keeps role `clear`** and stays below the named source (the D1 gate's `rolled-not-largest`
     check, as today): never re-role it to hide a larger figure; the structure check records it (above). A piece
     out stays out. A piece PoB doesn't model stays in the skeleton as the card's links say PoB follows it
     (`How PoB follows it`), and its value is the card's hand estimate (below).
   - `companion`, when the card's chain has a tamed beast (D-402, schema 5): `{species, mods}`, the species as
     PoB's beast library names it and `mods` its kept modifiers' ids in `data/monsters/monster-mods.md`, at most
     4, with one `Tame Beast` gem, enabled, in an enabled group. The compile writes PoB's three companion options
     and each kept `condition` modifier's option as earned state: list none of them
     (`docs/build-guide/plan-reference.md`, "A tamed beast").
   - `config`: the earned states the card relies on, each that is on with its producer and uptime;
     `scenario` lists `enemyIsBoss` and the endgame resistance penalty, each from a data fact with its
     tag, as in the worked example.
   - `claims` may stay empty: the skeleton serves the verification gate, and the guide never cites it. A claim
     is written only where the build hinges (D-351), with its `kind`, `hinge` (a fact whose being wrong would
     make the build fail) or `reason` (a reason resting on a measurement), and a source. A `data:` source names a
     JSON fact: a claim resting on a digest, index or monster-table entry cites its lookup, or a `judgment`
     naming the entry (D-400). `ledger` is `[]`.
   - `prices`: offline, the key items' `unavailable` entries of step 6; online, `[]` for now.
5. **Validate**: `mcp__pob2__guide_run {validate: "<runFolderRel>/concepts/<id>/plan.json"}`. Fix every error it
   reports (schema errors by JSON path; unknown gems with suggestions; item text; nodes and their
   connection; config options) and validate again, until it reports none. If one can't be fixed, stop
   before any price call and report it with `compiled: false`.
6. **Prices**, one `prices[]` entry per key item
   (each key unique; a key base only where the card depends on it), with id `<id>-<item>` (e.g.
   `r1-a-2-weapon`):
   - **offline:** no price call. Each entry is `unavailable` with note `offline run`, `amount`,
     `currency` and `league` null, dated the run folder's date (the `YYYY-MM-DD` in its last path
     segment).
   - **a pricing stop is open** (D-444; the prompt says so, or `run-log.json`'s `pricing.stops[]` holds a stop with
     no `pricing.retries[]` entry answered `retry-pricing` after it and no resume after it, `resumes[].lengths.stages`
     past its `at`): the stop holds until the user approves a retry at a gate. Make no trade-site call. An item the
     currency exchange sells (a rune, soul core, idol, Distilled Emotion, lineage support gem and the rest,
     `pricing.md`) is still priced from poe.ninja's exchange with `mcp__pob2__get_item_price` (not with
     `--no-ninja`), which sends no trade request; every other entry (a unique, a base) is `unavailable`, note
     `pricing stopped`.
   - **online:** reuse an entry with the same item, query and league from any plan of this run first;
     otherwise one call per item, paced by order: `mcp__pob2__get_item_price` for a unique and for an item the
     currency exchange sells, which it prices from poe.ninja's exchange by its category with no trade request
     (`query` `{"exchange": "<category>", "name": "<item>"}`, `pricing.md`). An entry is
     `{id, item, query, amount, currency, date, league, status}`: each result's league and its `Checked:` date;
     `unavailable` has `amount` and `currency` null and a `note`. Classify a failed call by its
     `[trade:<kind>]` prefix only: `would_wait` (price others, call it again later; its third refusal makes it
     `unavailable`, note `rate-limited`); `locked_out` or `rate_limited` (pricing stops: no more trade-site calls
     until the user approves a retry at the next gate, so every remaining item is `unavailable` but the exchange's);
     any other kind, `unavailable`. Count every call by its outcome for your return, an exchange price as
     `exchange` (`pricing.md`, "Reporting the calls").
   - **converted for the card** (D-373, D-374): a key price reaches the user as a range at a league day, never
     as a raw number from another market. Get the rates with `mcp__pob2__get_currency_rates` once (not with
     `--no-ninja`), and convert each `ok` price to day 7, when the reader buys the early endgame gear a key item
     is for, with `data/economy/prices.json`: the league day is the price's date less its league's `start`; the
     price in divines, `p`, times `conversion.under-10.to-day-7` when `p` is under 10, else
     `conversion.10-or-more.to-day-7`; past day 60 or the league's `end`, the low factor over 4 and the high
     over 2; before day 21, factors 1; a league not in the file, its day unknown, converts as days 21–60. Round
     each end to a whole divine at 10 or more and to one decimal under 10. The plan keeps the price as seen.
     **A range that rounds to 0.0 divines** is written as seen, with no conversion, in players' words (D-442):
     `1 exalt (seen 2026-10-24)`, never "0.0–0.0 divines" and never the trade id `exalted` ("exalt" and "exalts",
     "divine" and "divines", "chaos").
7. **Validate again** once the prices are written (the schema checks them and the league), so the last
   compile compiles the priced plan and its record's `planSha1` is that plan's.
8. **The last compile**, of the whole skeleton, measure-only and never with `build_name`:
   `mcp__pob2__compile_plan {plan_path: "<runFolderRel>/concepts/<id>/plan.json", measure_only: true}`. It writes
   `concepts/<id>/compile-record.json` and `concepts/<id>/compiled-build.xml` beside the plan and
   nothing to the builds folder (D-208). If it fails, don't fix and recompile: put its error lines in the
   verdict. The runner re-runs the step with them as findings. If it succeeds, run the damage check (below);
   when it passes, the verification checklist (below), on a composite then its leave-one-out probes ("A
   composite's pieces"), then write the card's verification half (below), before the verdict. When the damage
   check fails, run no probe (the card's probes count against its cap across attempts): write the verification
   half with what the check found, every checklist row `not checked`, and on a composite each Pieces measured row
   `not measured (the damage check failed: <the kind> shows nothing)`.
9. **The verdict file** `reports/gates/R1b-<id>-a<attempt>.json`, written last, whatever happened:

   ```json
   { "stage": "R1b", "concept": "r1-a-2", "attempt": 1, "verdict": { "compiled": "pass", "damage": "pass" },
     "findings": [], "errors": [], "compiles": 2, "recordPath": "concepts/r1-a-2/compile-record.json",
     "faultsApplied": [], "leagueUnverified": false }
   ```

   - `verdict.compiled`: whether the last compile (step 8) succeeded. A failure has one finding per error
     line, `{part: "compiled", code: "compile-error", stage: "<stage id>", message: <the line verbatim>}`, and
     `errors` lists the lines (the `stage <id>: …` lines, or the schema's `<path>: <message>` lines). An
     error that stopped you before the compile (a validation error you couldn't fix, a refused call) is a
     failure too.
   - `verdict.damage` (D-436), once the last compile succeeded: `pass` when the named source shows every kind of
     damage the card names, `fail` when one shows nothing, with one finding per such kind, `{part: "damage",
     code: "damage-missing", stage: "<stage id>", message: "<kind> shows nothing on <the named source>"}` ("bleed
     shows nothing on Detonate Dead"). A `damage-missing` finding fails the attempt though the skeleton compiled,
     and the runner re-runs it within the counted retries; after them the card is `failed` with that finding.
     Leave `damage` out when the last compile didn't succeed: nothing was measured.
   - `pieces` (D-436), on a composite whose leave-one-outs ran: `[{key, figure, dropPercent}]`, one entry per
     figure each probe read for its piece ("A composite's pieces"), `figure` named as the measure names it
     (`Rolling Slam (clear)`, `Bellow's explosion's ignite (per corpse)`), `dropPercent` the drop to one decimal,
     negative for a fall (`-18`, `-0.4`). The percentages live here only: the card, the dossier and the displays
     carry the answers, never a figure. A piece PoB can't see, or a probe that wasn't measured, has no entry.
   - `compiles`: how many `mcp__pob2__compile_plan` calls this attempt made (the bootstrap and the last; at most 2).
   - `recordPath`: the last compile's record, relative to the run folder; `null` when the last compile
     didn't succeed (a record beside the skeleton is then the bootstrap's or an earlier attempt's; never a
     faulted attempt's, whose first compile failed).
   - `faultsApplied`: `[{"id": "FI-1", "observed": "<the compile error naming the gem>"}]` when you
     applied FI-1, else `[]`.
   - `leagueUnverified`: `true` when trade couldn't be reached online and the league is a fallback (step 4).

A `possibly unread` line the card depends on goes under what PoB can't verify; D1-build confirms it by
measurement (two stages, with and without the line, D-243), not R1b.

## The damage check (D-436)

After the last compile succeeds, before the checklist: **does the named source deal the card's damage?** The
kinds the card names are those its `### Chain` gives its named damage source (its `Damage source:` line, and the
ailments and damage over time its multipliers and links make on it), on a composite also its `cards.md` round
line's layers that are the named source's own. Read each kind's field on the named source's group in the
skeleton's record, by Grep, never the record whole: the key `g<group>s<skill>p<statSet>` of `skills.main` in
`countedSkillOutputs` (its Count applied by each field's rule), its `fields`:

| Kind the card names | Field above 0 |
|---|---|
| a hit | `TotalDPS`, or `AverageDamage` for an on-kill group (a corpse explosion, which fires once per kill) |
| damage over time (the skill's own) | `TotalDot` |
| an ignite, a bleed, a poison | `IgniteDPS`, `BleedDPS`, `PoisonDPS` |
| a minion's damage (a group that names a minion skill, D-378) | `MinionTotalDPS` |

- **Every kind shows a figure above 0:** `verdict.damage: "pass"`. The kinds PoB shows are the card's Damage
  line (its verification half) and the dossier's Damage cell, in these words: `hit`, `damage over time`,
  `ignite`, `bleed`, `poison`, `minion damage` (`Detonate Dead: hit, bleed, ignite`).
- **A kind shows nothing** (its field is 0 or absent): a `damage-missing` finding for it, `verdict.damage:
  "fail"`, and the attempt fails. A retry fixes what makes the kind show nothing (a support, a conversion, the
  config condition the ailment reads), never the card's named damage source or its chain.
- **A source a meta gem triggers** (the record's `measures.trigger {by, usesPerSecond}`: Cast on Critical and its
  kind) is rated by PoB at its hand-cast speed and PoB doesn't model Energy: the Damage line says `(rated at its
  hand-cast speed)` after its kinds, and so does the dossier.

## Verification checklist (advisory, D-292)

Slice 03 §7.7. Run these eight checks on the card's skeleton after the last compile (step 8) and before
the verdict file (step 9). Write each result into the card's `Checklist results` table
(`.claude/skills/build-guide/templates/card-template.md`): one of the four words **verified, estimate,
risk, not checked**, and one line of detail. None is a gate: a result never changes the verdict, and none
starts a fix round or a retry. If the last compile failed, or the damage check did, every check is `not checked`.

**From the plan and the record (no extra compile):**

1. **Pillars** for ailments and damage over time: base damage, type-specific scaling, duration, and 100%
   application. A pillar with no source is a `risk`.
2. **The enabler's conditions** at the target level, in numbers, and what they force out of the build
   (Minion Pact needs a minion with at least your maximum life, so your own life is held under it). A forced
   condition gets a permanence check: reservation of at least 1 minus the threshold (life at 75% needs 25%
   reserved).
3. **Attribute requirements** at the target level, for the defining items and every gem
   (`mcp__pob2__lookup_game_data {mode: "gem", query}` gives a gem's requirements by level), including after
   a swap that removes a supplier.
4. **Risks PoB can't show:** payoff thieves (from the lookup's hit-making children of the build's
   skills, D-299: triggered and granted skills, minions), placement and targeting limits, the exposed
   phase, cooldown dead windows on interruptible casts, and hidden clauses on links ("from a Hit", "you use
   yourself"), stated as theory. Each is `risk` or `not checked`, never `verified`.

**From compile variants (probes).** You change no build with a tool here (D-231): the one `mutate` tool you
hold, `mcp__pob2__manage_sets`, is for D1-finish's loadout select before pricing, and R1b doesn't use it. So each
probe is a copy of the skeleton plan with one change, written to `probes/<card-id>/<n>/plan.json` (D-331;
`n` counts from 1 in run order) and compiled measure-only as one stage:
`mcp__pob2__compile_plan {plan_path: "<runFolderRel>/probes/<card-id>/<n>/plan.json", measure_only: true}`.
Compare its record with the skeleton's.

5. **A dead-slot audit:** remove one support or source, the one most likely dead (the chain doesn't name
   it, or it touches only the activation), and compare. A change below 1% is a `risk`. Say for each support
   whether it touches the activation or the payload.
6. **Condition on and off:** toggle the earned config entry the payoff rests on off, and compare. Report
   the figure at a realistic uptime, on × uptime + off × (1 − uptime), as an `estimate` with the uptime's
   reason.
7. **Encounter mods:** in the scenario config, add the top of the waystone's monster elemental resistance
   range (`enemies/waystones.json#mods.monster-elemental-resistance`, its `max`, as D1 takes the top of
   each waystone modifier) to the enemy's resistance against the damage source's element. Without a
   compile, read whether the bosses resist that element (`enemies/arbiter-of-divinity.json#res.<element>`),
   and report each that does as a `risk`.
8. **A skill-shape probe,** only where the skill's text suggests one, such as projectile speed up and down
   for damage that grows with travel.

**The probe budget.** Up to 4 probe variants per card, beyond the attempt's two compiles, run in the order
above (5, 6, 7, 8): each a one-stage, measure-only compile, within NFR-21's per-request limit. A probe that
doesn't fit the budget, or whose compile fails, is reported `not checked`, and it never fails the step.
Probes don't count in the verdict's `compiles`. **A composite's cap is 8** (D-433): the checklist's 4 first, in this
order, then the 4 leave-one-out probes of "A composite's pieces", numbered on in `probes/<card-id>/<n>/`. A
checklist probe left unrun frees no fifth leave-one-out. A plain card (no `### Pieces`) keeps 4 and has no Pieces
tables.

A card whose damage source isn't a skill (D-334) has no skeleton: run checks 1–4 from the card and the
lookups, report 5–8 `not checked`, and write "not compiled: its damage source isn't a skill" in its
verification half ("not compiled: <entry> isn't in the PoB pin" for a `not-in-pin` card, D-400).

## A composite's pieces (D-433)

A composite is one build composed from many pieces, so R1b checks that each piece in does something inside it
(D-436): a probe leaves one piece out, and its record says what each figure loses. A piece can pay on one figure
and not another: in the study behind amendment 10, Blistering Bond was 5% of the warcry's clear and 22% of the boss
skill. The card says whether each piece does something; the percentages go in the verdict file's `pieces[]` only.

**The measure: three kinds of figure, never summed across groups.** Read each from the record (the skeleton's,
then each probe's), at the group's own selection, the record's key `g<group>s<skill>p<statSet>` for the group's
main active skill and stat set:

- **Per second, for clear:** each enabled `clear` group's figure, the named damage source's first, Count-scaled
  (`countedSkillOutputs`, as the Verified line reads it).
- **Per corpse:** each of PoB's own on-kill groups (a corpse explosion an ascendancy node or a unique grants; the
  record numbers PoB's groups after the plan's): its hit, `AverageDamage` (one explosion, which PoB sizes from a
  normal monster's life), and its ignite, `IgniteDPS` (a rate, read for its drop only: a piece that
  changes the ignite's duration moves the damage per corpse more than the rate shows). A corpse explosion fires once
  per kill, so its hit is never a figure per second.
- **For bosses:** each enabled `single_target` group's figure.

A group's figure is its damage per second, its hit and its damage over time with its ailments: `TotalDPS +
TotalDot + IgniteDPS + BleedDPS + PoisonDPS` at its key, each field PoB gives there (a skill's own damage over time
is `TotalDot`, and an ailment's carrier pays only in its ailment's field). A group whose damage is its minion's (it
names a minion skill, or its skill summons one, D-378, D-397) reads `MinionTotalDPS`, the field the record holds for
a minion's figure. The named source's fields come from `countedSkillOutputs`, its Count applied by each field's rule;
every other group's from `skillOutputs`, or `skillOutputsSet2` for a group with `weaponSet: 2`. Never `CombinedDPS`
or `TotalDotDPS`: neither has a Count rule, and `CombinedDPS` is per use for a skill PoB measures by its average
damage. **Never add figures across groups**: summed,
one explosion's ignite drowns the skills a player presses, and buttons that compete for the player's time can't all
run at once. PoB's Full DPS still counts the named source only (D-337), so it is no sum of them either.

**Which pieces:** up to 4 of the Pieces table's `in` rows, never the named damage source or its enabler (the
table's first rows), the least certain value first:
1. a piece the skeleton stands for with a custom modifier (`config.customMods`);
2. a layer on another group (a second skill, an explosion, a detonation);
3. an ailment's carrier (a piece that makes or scales an ailment on a hit);
4. then the rest in the table's row order, the synthesis's own (by how much the composite leans on each).

**Leaving a piece out,** by its kind, each probe a copy of the skeleton with that one change:
- a **support**: removed from its group;
- a **skill**: its group disabled (`enabled: false`). **A skill left out counts as 0**: the compile measures every
  group as the main skill, a disabled one included, so its own figure in the probe's record isn't what the build
  loses; its drop on its own figure is −100%;
- a **unique**: the slot's plain base of the same base type (the unique's base, with no modifier);
- a **rare's mod line**: removed from the item;
- a **node**: removed with every node that depends on it (the tree still connects); other pieces among them are
  named in `Left out by`;
- a **keystone**: removed, with every custom modifier that stands for its mechanic;
- a **rune**: removed from the item;
- a **config condition**: turned off.

**A piece PoB can't see** (`mcp__pob2__check_model_coverage` calls it unmodelled, or its links row says `not
modelled`; Battershout's detonation shows no DPS): no probe, and its answer is `PoB can't see it`. It takes one of
the 4 rows, and it doesn't change the card's status (the dossier's Pieces cell says so).

**The order and the cap:** the checklist's probes 5–8 first, then the leave-one-outs, at most 8 in all. A probe a
failed compile cuts is `not measured (<why>)`, with `Left out by` `—`: its own compile's failure (`not measured (the
probe's compile failed: <the error>)`), or the skeleton's, which cuts every row (`not measured (the skeleton didn't
compile: <the first error>)`, or `not measured (not compiled: <the reason>)` on a card that compiles nothing, D-334,
D-400), the 4 pieces chosen as above.

**The drop** of a figure is (the probe's − the skeleton's) ÷ the skeleton's, in percent to one decimal, each figure
named `<the group's skill> (<clear | per corpse | boss>)` (a corpse explosion's two figures `<skill>'s hit (per
corpse)` and `<skill>'s ignite (per corpse)`), the verdict file's `pieces[]` entries. **The answer** (D-436):
- `yes` when leaving the piece out moves any of its figures by 1% or more (the dead-slot audit's line, check 5);
- `no` when none moves by 1%: the piece does nothing in PoB, and the card is `viable, except <the piece> does
  nothing in PoB` in the dossier;
- `PoB can't see it` for a piece PoB doesn't model (above);
- `not measured (<why>)` when the probe's compile failed, or none ran.

**`### Pieces measured`** (Appendix A), in the verification half after `### Key item prices`, one row per piece
left out, `in` rows only, in the order probed:

```
### Pieces measured

| Key | Left out by | Does something |
|---|---|---|
| i1b-4 | the slot's plain Ruby Ring | yes |
| i1a-2 | Fist of War removed from group 1 | no |
| i1c-1 | — | PoB can't see it |
| i1a-5 | — | not measured (the probe's compile failed: <the error>) |
```

`Key` is the piece's key in `### Pieces`, an `in` row's; `Left out by` is how the probe left it out (`—` for a piece
PoB can't see, or one not measured); `Does something` is the answer. No figure goes in the table: the drops are the
verdict file's. Pieces not probed are left out of the table, so it holds at most 4 rows.

## The card's verification half (C-52)

Write it into `cards/<id>.md`, under `## Verification half`, replacing the `Not checked yet.` lines R1a left
(`.claude/skills/build-guide/templates/card-template.md`). Edit only that half: the brainstorm half is R1a's, but
for a gate's change (a composite's is R1a-synthesize's, its `### Pieces` included).

- **Verified** (D-436): the three checks' answers, **no figure** (no damage, life, EHP or clear-speed number:
  numbers come at the design gate, measured on the full build): that the skeleton compiled, with its stage id;
  the damage check's line, `Damage: <the named source>: <the kinds PoB shows>` (`Detonate Dead: hit, bleed,
  ignite`, with `(rated at its hand-cast speed)` for a source a meta gem triggers), or the kind that shows nothing;
  on a composite, how many of the `in` pieces probed do something, as `### Pieces measured` answers.
- **Estimates** (D-296): each Count above 1 with its `countReason`, each custom modifier with its reason, and
  which figures the record marks `computedWithCustomMods`, by name, with no number. On a composite, that line names
  the groups of each kind of figure in the measure: `Clear: <its groups>. Per corpse: <its groups>. Boss: <its
  groups>. Kept separate, never summed.`
- **Checklist results**, from the checklist above; **a fallback ladder**, cheapest first; **key item prices**,
  from step 6, each converted to a range around day 7 with the price as seen and its date and league day, a range
  that rounds to 0.0 as seen in players' words (`1 exalt (seen 2026-10-24)`), or `unavailable` with its note (the
  template's form).
- **Pieces measured**, on a composite only, after the key item prices: the table of "A composite's pieces" above,
  even when the attempt failed after its structure check (its rows then `not measured (<why>)`). A plain card has
  neither Pieces table.

**A card whose damage source isn't a skill** (D-334) compiles nothing, so it has no skeleton, record or probe.
Run checks 1–4, write its verification half as above, and write the verdict with `compiled: "fail"`, one
finding `{part: "compiled", code: "not-a-skill", message: "not compiled: its damage source isn't a skill
(D-334)"}`, `compiles: 0` and `recordPath: null`. The runner doesn't re-run it: no retry can compile it, and
the card can't be finalized yet (D-303). **So does a card that rests on a digest entry the PoB pin doesn't
know** (D-400), its finding `{part: "compiled", code: "not-in-pin", message: "not compiled: <entry> isn't in the
PoB pin"}`: the pin can't compile it until an upgrade.

## Writes

Only the header's `writes` (D-338): `concepts/<id>/plan.json`, the verdict file
`reports/gates/R1b-<id>-a<attempt>.json`, the card `cards/<id>.md` (its verification half, and a gate's
change), and each probe's `probes/<id>/<n>/plan.json`, `n` from 1 to 4, to 8 on a composite (D-433). The server
writes each compile's record and XML beside its plan.

## Returns

At most 8 lines: the outcome (`compiled`, with the damage kinds PoB shows; `compiled, damage missing: <the
finding's message>`, a failed attempt; or `failed: <why>`), the verdict file, the card with its checklist and probe
counts (`probes <n>`: every probe run, a probe whose compile failed included; on a composite, then its pieces
measured, `pieces <n> measured (<n> not measured)`), and your price calls counted by outcome (`pricing.md`):

```
R1b r1-a-2 attempt 1: compiled; damage: hit, bleed
reports/gates/R1b-r1-a-2-a1.json
cards/r1-a-2.md: checklist 8 run (2 not checked), probes 3
prices: none (offline)
```

```
R1b r1-s-1 attempt 1: compiled; damage: hit, ignite
reports/gates/R1b-r1-s-1-a1.json
cards/r1-s-1.md: checklist 8 run (1 not checked), probes 7, pieces 4 measured (1 not measured)
prices: none (offline)
```

```
R1b r1-a-1 attempt 1: compiled, damage missing: bleed shows nothing on Blood Hunt
reports/gates/R1b-r1-a-1-a1.json
cards/r1-a-1.md: checklist 8 run (8 not checked), probes 0
prices: ok 1, exchange 1
```

## Fault directives

**FI-1** (`.claude/skills/build-guide/references/offline-and-test.md`): step 2, in the attempt's first
compile, the bootstrap, which always runs then (D-265). It must make that compile fail with a per-stage
error naming the gem (D-162), and the attempt stops there: no clean compile, so no clean record. Report the
error in the verdict's `errors` and `faultsApplied`.
