---
name: build-guide
description: Build a Path of Exile 2 guide (level 1 through the campaign to two endgame variants) and a PoB2 build from an open brief, through the pob2 MCP server. Brainstorm a deck of candidate builds, verify the ones the user picks, let the user finalize one, then design and compile the plan, write the guide and verify its claims. Use when the user runs /build-guide <free text> [--offline [--test <path>]] [--no-ninja], the fixed roll /build-guide <ascendancy> <skill> included, or asks for a build guide.
---

# build-guide

You are the **runner**: you start the run, call one agent per step with the Agent tool, ask the user at the
gates, keep the run log, write the verifiers' reports and run the run checker. Agents research, design,
compile, write and check (slice 03 of `docs/build-guide/spec/`, as its amendments 1 to 3 change it; spine C-36,
C-51, C-52).

The run has **three phases, each ending at a gate the user answers** (D-287): the brainstorm (researchers write
candidate cards and a coordinator step deals the deck; gate `brainstorm`), the verification (the picked cards
are compiled and checked; gate `verification`) and the finalization (the design, the guide and its checks; gate
`final`). Only the user starts a round. Every card names its **named damage source**, the main source of damage,
never a token role (D-122 as D-295 words it); the card the user finalizes gives the run its roll.

## Hard rules (for you and for every agent)

- **Never read, print or copy any `.env` file**, and never set `POESESSID`. The trade cookie stays with
  the server.
- **Never contact pathofexile.com or poe.ninja yourself**: no WebFetch, WebSearch or Bash to them. There are
  no poe.ninja tools beyond the currency rates (`mcp__pob2__get_currency_rates`, D-335): poe.ninja's terms
  close its builds API, so no tool supplies player evidence, and a card cites the brief's `popularity` notes or
  says "no player evidence". Trade and the currency rates are reached only through the server's price tools,
  only by coordinator steps (`references/pricing.md`). Web research uses only poe2db.tw, maxroll.gg, game8.co,
  poe-vault.com and patch-note mirrors, and none at all in offline mode.
- **Write only inside the run folder.** You write `run-log.json`, the V4 reports under `reports/`, and the
  open findings into the `Known issues` of `guide.md` and `audit.md` (step 14). Each agent writes only its
  header's `writes`.
  The PoB file reaches the builds folder only through the final compile.
- **Your pob2 tools** are `mcp__pob2__get_classes`, `mcp__pob2__lookup_game_data` and
  `mcp__pob2__search_tree_nodes` for the brief check (the last for the ascendancy lock, D-342), and
  `mcp__pob2__guide_run {new_run}` (FR-W3). Every compile, every engine change and every price call is a
  coordinator step's.
- **Agents run only through the Agent tool, as one of the four build-guide types**, named in
  `subagent_type` (`.claude/agents/build-guide/`). A default agent would see every tool.
- **Read only what routes the run:** the gate verdict files under `reports/gates/`, the deck `cards.md` (you
  show it at the brainstorm gate), your own `run-log.json`, the test config, the agents' returns and the
  verifiers' reports. Never read `plan.json`, a compile record, `dossier.md` or `guide.md` (one final record was
  268 KB), with Read or with Bash; step 14 reads only the `Known issues` lines it edits, in `guide.md` and
  `audit.md`.
- **Your Bash reads, and runs the run checker; nothing else** (D-265). The whole list:
  - `ls`, `cat`, `head`, `tail`, `wc`, `grep` and `jq`, alone or piped into one another (`cd` before them is
    fine), each with no redirection (`>`, `>>`, `<`), no `tee`, no flag that writes a file (`-o`, `-i` or
    `-delete` where the tool writes with it), and no command substitution (`$(…)`, backticks) feeding
    another tool;
  - the run checker, `node .claude/skills/build-guide/scripts/check-run.mjs <runFolder>`.

  Nothing else: no other `node` call (`node -e` included), no `git`, `find`, `sort`, `sed`, `awk`, network
  client (`curl`, `wget`, `nc`, `ssh`) or host, and nothing that writes, moves or deletes a file. Write every
  file with Write (or Edit), never with Bash or a script. The agents have no Bash at all.

| Agent type (`subagent_type`) | Steps |
|---|---|
| `build-guide-researcher` | R1a: lookup-only brainstorm, up to 3 in parallel |
| `build-guide-coordinator` | R1a-assemble, R1b, R1b-assemble, D1, D1-gate, D2, D2-gate (and its final compile); the only type that compiles or prices |
| `build-guide-writer` | W1: writes `guide.md` and `audit.md` |
| `build-guide-verifier` | V4: every claim true, one lens each (`ledger`, `sources`, `prose`), a full pass or a re-check; it can't write |

## Calling an agent

Every step is one Agent call, for example:

```
Agent({subagent_type: "build-guide-coordinator", description: "D1 r1-a-2 attempt 1", prompt: "<header, then the reference line>"})
```

- **The prompt** is the task header (`references/task-header.md`), a fenced `json` block, then one line
  naming its stage reference: `Read .claude/skills/build-guide/references/stages/<stage>.md and do that
  step.` Add only what the stage reference lists under "Prompt".
- **In flight:** at most 3 agents at once, and a coordinator step never overlaps another agent (FR-W3: one
  engine, one coordinator). R1a's researchers and the V4 lenses run in parallel with
  `run_in_background: true`; every other step runs alone.
- **Returns.** An agent writes its header's `writes` and returns at most 8 lines: what it wrote and the
  outcome. A gate step's verdict is its own file under `reports/gates/`: read that file to route. The
  verifier can't write (R-5): it returns its report as JSON, and you write that JSON unchanged with Write
  to `reports/v4-<lens>.json`, or `reports/v4-<lens>-recheck.json` for a re-check.
- **A missing return.** An agent that returns without its file (a gate step without its verdict file, a
  verifier without a report) is re-run once, uncounted, its attempt logged `missing`. A second miss ends
  the run `stopped`, naming the step.
- **The run log.** Rewrite `run-log.json` whole after every step, gate and question
  (`references/run-log.md`), so an interrupted run still leaves one.

The verifier's prompt is always exactly this, the header and the reference line, so it carries nothing a
producing step wrote (R-5, D-142):

````
```json
<the task header: stage V4, its lens and check>
```
Read .claude/skills/build-guide/references/stages/V4.md and do that step.
````

## The steps

Step 2 is the brainstorm phase, in three parts (2a to 2c); steps 3 to 5 are the verification phase; steps 6
to 16 are the finalization.

| # | Step | Agent type | Writes | Returns, user, retries |
|---|---|---|---|---|
| 1 | Start (§1) | you | `run-log.json` | parses and checks the brief; asks the user when `loadedBuildUnsaved` (D-210) |
| 2a | R1a, brainstorm round *k* | `build-guide-researcher`, ≤ 3 in parallel, lettered `a`, `b`, `c` | `research/p<k>-r1a-<n>.md`; 3 cards `cards/r<k>-<letter>-<m>.md`, their brainstorm halves | its files and its cards' titles |
| 2b | R1a-assemble | `build-guide-coordinator` | `cards.md` | the deck's counts: dealt, not dealt, under-played; `short: <why>` for a short round |
| 2c | The brainstorm gate (§2) | you | log | asks the user: verify 1–3 cards (step 3), brainstorm more (step 2a, round *k*+1) or stop |
| 3 | R1b, one picked card at a time, ≤ 3 per verification round | `build-guide-coordinator` | `concepts/<id>/plan.json`, `reports/gates/R1b-<id>-a<n>.json`, `cards/<id>.md` (its verification half), `probes/<id>/<p>/` | compiled or not; a compile failure re-runs, ≤ 2 counted retries, then the card is `failed` |
| 4 | R1b-assemble | `build-guide-coordinator` | `dossier.md` | the verification gate's comparison, one line per card |
| 5 | The verification gate (§3) | you | log | asks the user: finalize one card, verify other cards (step 3), brainstorm more (step 2a) or stop |
| 6 | D1, the endgame | `build-guide-coordinator` | `plan.json` (its endgame stages, `skills.main.statSet` set) | `done` or `infeasible` |
| 7 | D1-gate | `build-guide-coordinator`, fresh | `reports/gates/D1-gate-<c>-a<n>.json`; `plan.json` (FI-2 and the final re-price pass) | one verdict line; route by §4 |
| 8 | D2, the campaign | `build-guide-coordinator` | `plan.json` (its campaign stages) | `done` |
| 9 | D2-gate and the final compile | `build-guide-coordinator`, fresh | `reports/gates/D2-gate-<c>-a<n>.json`; the PoB file through the server | one verdict line; a failure re-runs D2, ≤ 2 counted retries, then escalates |
| 10 | W1, the guide and the audit layer | `build-guide-writer` | `guide.md`, `audit.md` | at most 8 lines, with its `known-issues-line` and `audit-known-issues-line` |
| 11 | V4, one full pass | `build-guide-verifier` ×3 in parallel (`ledger`, `sources`, `prose`) | none; you write `reports/v4-<lens>.json` | its report |
| 12 | Fix round, once, only with open findings, uncounted | the owners: D1, D2, W1 | their own files: claims edited in place; a compile only for a build change | the ids fixed, the locations changed, and whether it recompiled |
| 13 | V4 re-check | `build-guide-verifier`, in parallel: each lens that raised a finding and the sources lens, or all three when a gate re-ran in the fix round | none; you write `reports/v4-<lens>-recheck.json` | its report; no further round |
| 14 | Known issues | you | each open finding's `reader` sentence, into `guide.md`'s `Known issues`, and its row into `audit.md`'s | — |
| 15 | Run checker | you (Bash) | — | its result, shown at step 16 |
| 16 | The final gate (§6) | you | log | asks the user: accept, ask for changes (a revision), or anything else |

**Retries, in full.** The R1b compile, the D1 gate and the D2 gate allow 2 counted retries each. These
attempts count against no cap: an attempt failed by a fault directive that applies to attempt 1 only (a
persistent directive's failed attempts do count: S6), a guided retry, the fix round and a revision, and the
re-run after a missing return. Verification never runs a lens again for its findings beyond the one
re-check, and never escalates; only the D1 and D2 gates escalate.

## 1. Start (FR-W1, FR-W2; C-51)

`/build-guide <free text> [--offline [--test <path>]] [--no-ninja]`. The free text is the **brief**: what the
user wants, in their words. The fixed roll `/build-guide <ascendancy> <skill>` still works, multi-word names
quoted (`/build-guide Titan "Blood Hunt"`): it is the brief `{ascendancy, skill}`. A brief that is exactly an
ascendancy and one gem name, with nothing else, is the fixed roll, and its second name is always `skill`
(D-343).

- `--offline` starts offline mode (`references/offline-and-test.md`): no web, no prices.
- `--test <path>` is a test config. It is accepted only with `--offline` (`testConfig: "accepted"`);
  without `--offline` it is refused (`testConfig: "refused"`), ignored, and you ask the user at every
  gate (D-157). No `--test`: `testConfig: "none"`.
- `--no-ninja` (D-333): the run calls no tool in group `ninja`, whose one tool is
  `mcp__pob2__get_currency_rates`. Tell every pricing step, the D1 gate included, to price without currency
  rates, so totals in divines are `unverified` (`references/pricing.md`).

**The brief** (D-285, D-335). Parse the free text into these fields, every one optional. Leave out a field the
text doesn't give, and never invent one:

| Field | Holds | Example |
|---|---|---|
| `ascendancy` | an ascendancy | Titan |
| `skill` | an active skill gem, the named damage source | Blood Hunt |
| `playstyle` | tags from the vocabulary below, plus free text | `melee`, `tanky`, "slow and heavy" |
| `budget` | `budget` or `non-budget` (the endgame variants), or a figure in divines | `budget` |
| `around` | an item, mechanic or support gem to build around | "Melting Maelstrom", "block", "Fork" |
| `like` | a reference build and what to change | "like the Eraser, but not Gemling" |
| `notes` | anything else | |
| `popularity` | the user's own notes on what players run, which cards cite as user-supplied | "Blood Hunt Titans are rare this league" |

- **The playstyle vocabulary** (cards use the same tags): delivery `melee`, `ranged-attack`, `spell`,
  `minion`, `totem-trap`, `mixed`; buttons `one-button`, `few-buttons`, `combo`; focus `clear`, `boss`,
  `balanced`; defence `tanky`, `balanced`, `glass`; pace `fast`, `steady`.
- **An empty brief** means "surprise me": the researchers start from the pattern library's families
  (`references/patterns.md`) and the coordinator's judgment of what is under-played.
- **A fixed roll** (a brief naming both `ascendancy` and `skill`) runs the same three phases, and every card's
  named damage source is that skill.
- **A support gem** the free text names as the build's subject goes in `around`, never in `skill` (D-343):
  only an active gem is a `skill`. Step 1's gem lookup tells them apart.
- **Player evidence** comes only from `popularity`: no tool supplies it (D-335).

In this order, before any agent runs:

1. **Brief check** (D-238, D-285). Check each field that names an ascendancy or a skill, as a roll is
   checked:
   - `ascendancy`: call `mcp__pob2__get_classes`. The ascendancy must be listed (case-insensitive). Note its
     class.
   - `skill`: call `mcp__pob2__lookup_game_data {mode: "gem", query: <skill>}`. A result headed `## <skill>`
     (case-insensitive) must say `Kind: active`. A support gem, or no such result, fails.
   - a gem the free text names as the build's subject (D-343): look it up this way before you place it. Only
     an active gem goes in `skill`. A support gem goes in `around`, and the run goes on: say it is a support
     gem, and that the researchers will look for skills it can support. The fixed roll's second name is
     always `skill`, so there a support gem fails: `/build-guide Pathfinder Fork` stops with "Fork is a
     support gem".
   - both, once each passes: **the ascendancy lock** (D-342). Call `mcp__pob2__search_tree_nodes {query:
     "Grants Skill: <skill>"}` and `mcp__pob2__lookup_game_data {mode: "mechanic", query: "<skill>", kind:
     "unique"}`. The ascendancy can't use the skill, and the check fails, when a node grants it (its stats
     list `Grants Skill: <skill>`), every such node is an ascendancy node (an `Ascendancy: <name>` line), none
     of them the brief's ascendancy, and no unique has a line `Grants Skill: <skill>` or `Grants Skill: Level
     (<range>) <skill>`.
   - On a failure, **stop**: list the closest valid names from those results, and say how to re-run.
     Ascendancies come from `mcp__pob2__get_classes`. For the skill, quote the names the lookup gave: when
     nothing matched, `mcp__pob2__lookup_game_data` says "Nothing matched …", then lists up to 5 names under
     `Closest active gem names (…):` and up to 3 under `Closest support gem names (…):`, each line
     `- <name> (active|support)` (D-258, D-258a). Quote the active names, in its order: only an active gem
     is a valid roll. When it matched only other gems, quote those gems' names; for a support gem, say
     "<name> is a support gem". A failed lock gives its reason instead: the nodes that grant the skill, each
     with its id and ascendancy, so a re-run names one of those ascendancies or none. Create no run folder
     and write nothing.
   - Use the names exactly as the tools gave them from here on. The run's `roll`,
     `{className, ascendancy, skill}`, is set only at the verification gate, from the card the user
     finalizes (D-286).
2. **Run folder.** Call `mcp__pob2__guide_run {new_run: <slug>}`, the slug from the brief
   (`references/run-folder.md`: `titan-blood-hunt`, `titan-open`, `open-<first playstyle tag>`). Keep its
   absolute path (`runFolder`), its root-relative path (`runFolderRel`) and `loadedBuildUnsaved`. The card
   finalized later goes in the run log, not in the folder name.
3. **Run log.** Read the test config if one was given with `--offline`. A file that can't be read or isn't
   the documented shape is refused (`testConfig: "refused"`) and stops the run (`stopped`, the reason in
   your reply; `references/offline-and-test.md`). Write `run-log.json` with `status: "running"`, the mode,
   `testConfig`, the parsed brief and no roll yet (`references/run-log.md` has a first write).
4. **Unsaved build** (D-210). If `loadedBuildUnsaved` is `true`, ask the user before the first compile:
   proceed (the loaded build's unsaved changes will be discarded) or stop (the run ends `stopped`). In
   offline test mode `answers.unsavedBuild` answers it (`references/checkpoints.md`).

Steps 1 to 4 always run as written, whatever tools the session has: never check for the Agent tool before
them. **No Agent tool** (D-344): if the Agent tool isn't available when the first agent step is due, the run
stops there, and no agent runs. Set `status: "stopped"` with no `stages[]` entry, finish (§7), and give the
reason in your reply, as for a refused test config (`stopped: the Agent tool isn't available`).

## 2. Brainstorm (steps 2a to 2c)

- **R1a** (step 2a), brainstorm round `k`. Three researchers in parallel, foci `mechanics`, `items` and
  `tree` (`references/stages/R1a.md`), which you letter `a`, `b` and `c` when you start them, so parallel
  researchers never collide (D-319). Each reads the pattern library, `references/patterns.md`, first. Each
  writes its research file `research/p<k>-r1a-<n>.md` (`n` is 1, 2 or 3 for `a`, `b` or `c`) and 3 cards,
  `cards/r<k>-<letter>-<m>.md` (`m` from 1), each a card's brainstorm half (`templates/card-template.md`).
  Its header's `writes` are its research file and `cards/r<k>-<letter>-1.md` to `cards/r<k>-<letter>-3.md`.
  At least one of each researcher's 3 cards is built on a pattern-library shape it judges under-played,
  labelled `judgment` (D-298, D-339). The prompt carries the brief, the focus and letter, and in a later
  round the user's note.
- **R1a-assemble** (step 2b; `references/stages/R1a-assemble.md`), one coordinator step after the round's
  researchers return. It reads the round's cards, merges duplicates, checks each card's identity
  `{className, ascendancy, skill}` as step 1 checks a brief (D-286; for a damage source that isn't a skill,
  a lookup by its kind, D-334), and deals a card only when a lookup confirms every load-bearing link in game
  text. It writes the deck `cards.md`: 6–9 dealt cards a round, the ones that differ most, keeping at least
  two under-played cards in the deck by the coordinator's judgment from the pattern library (`judgment`,
  D-298, D-339), then a "Not dealt" list naming each held-back card's unconfirmed link. Its header's `writes`
  are `["cards.md"]`; the deck builds up over the rounds, and a later round adds only new cards. Its prompt
  lists the round, the brief, the user's note, and each researcher's letter, research file and cards, with
  whether it returned. **A short round** (fewer than 6 cards pass, or the deck holds fewer than two
  under-played cards): it returns `short: <why>`; record the reason in the run log, as `shortReason` on its
  `stages[]` entry (`references/run-log.md`), and say so at the brainstorm gate.
- **The brainstorm gate** (step 2c; `references/checkpoints.md`). Echo the parsed brief at the top, then
  print the deck from `cards.md`: the dealt cards not verified yet, and the "Not dealt" list; after a short
  round, its reason. Ask with
  AskUserQuestion in `multiSelect` mode, up to 4 cards a question and up to 3 questions, plus one question for
  more or stop:
  - **verify** 1–3 cards: the union of the selections, more than 3 asked again; a card under "Not dealt" may
    be named too. They go to step 3 as a new verification round;
  - **brainstorm more**, with the user's note: brainstorm round `k + 1` (step 2a); only this answer starts
    one;
  - **stop**: the run ends `stopped`.

## 3. Verification (steps 3 to 5)

- **R1b** (step 3; `references/stages/R1b.md`), for each picked card in the order picked, one at a time, at
  most 3 per verification round. Its header's `concept` is the card id, and its `writes` are
  `concepts/<id>/plan.json`, `reports/gates/R1b-<id>-a<n>.json`, the card `cards/<id>.md` (its verification
  half) and its probes, `probes/<id>/<p>/` (D-338). The card's identity is the skeleton's `roll`. After the
  skeleton compiles, R1b runs the advisory checklist and up to 4 one-stage probe variants (D-292); none is a
  gate. A failed compile re-runs with that verdict file as `findings`, up to 2 counted retries; then the card
  is `failed`, its last verdict file the evidence (D-141). FI-1 applies here. A card whose damage source
  isn't a skill compiles nothing (D-334): its verdict's `not-a-skill` finding is never retried, and the card's
  status is "can't be finalized yet: its damage source isn't a skill" (D-303), never `failed`. A card whose
  ascendancy doesn't own the passive-tree node that grants its skill compiles nothing either (D-342): its
  verdict's `wrong-ascendancy` finding is never retried, and the card is `failed`.
- **R1b-assemble** (step 4) writes `dossier.md` from the brainstorm rounds' research files and the
  verification round's cards and skeletons; its key numbers add `TotalEHP` (D-294). Its prompt lists the
  verification round, the research files (and whether each researcher returned), and each card
  `{id, title, status, attempts, verdict}`, `status` being `viable`, `failed`, or `can't be finalized yet`
  when the last R1b verdict's finding is `not-a-skill`; it returns the verification gate's comparison.
- **The verification gate** (step 5; `references/checkpoints.md`). Show the comparison lines of every card
  verified in the run (`TotalEHP` included; a figure resting on Count or a custom modifier labelled
  `estimate`, D-296), each card's status (`viable`, `failed`, or "can't be finalized yet: its damage source
  isn't a skill") and the dossier's path. After an `infeasible` design or an escalation sent the run back
  here, show that card's evidence (its last verdict file); with no viable card, each failed card's last
  verdict as its evidence (D-141), and a card that can't be finalized yet with its status, not as a failure.
  Ask:
  - **finalize** one card (a failed one may be picked anyway; one that can't be finalized yet can't be,
    D-303; nor can a `wrong-ascendancy` card, failed or not, since the build it describes can't exist,
    D-342): its identity becomes the run's `roll`, which you record in the run log, and the design (steps 6
    to 9) runs for it;
  - **verify other cards** from the deck (1–3): a new verification round (step 3), without a brainstorm;
  - **brainstorm more**, with the user's note: brainstorm round `k + 1` (step 2a);
  - **stop**: the run ends `stopped`.

  Every route back from the design comes here: an `infeasible` design, an escalation's option 3, and FI-3.

## 4. Design (steps 6 to 9; `references/gates.md`)

`buildName` is `<slug>-<YYYY-MM-DD>-<n>`, the run folder's last two segments joined with `-`.

- **D1** writes `plan.json` anew on its first attempt of a fresh design, and edits it otherwise; its header
  carries the earlier D1 gate findings on a retry. It sets each skill group's Count and each custom modifier,
  each with its reason (D-293). It returns `done` or `infeasible`, with a reason.
- **The D1 gate** is a fresh coordinator step after every D1 attempt. Route by its verdict file and D1's
  claim (gates.md's "The D1 gate's outcome", unchanged):
  - compiled, V1, V2, floor and `rolledSkill` (the named damage source's part) pass, budget pass or
    unverified: step 8;
  - a compile, V1 or V2 failure: D1 re-runs with the verdict, up to 2 counted retries; the third failure
    escalates (§5);
  - any part but the budget `unverified` (only the budget may stay unverified, D-164): a failure, routed as a
    compile, V1 or V2 failure;
  - only floor, budget or `rolledSkill` failing, D1 having claimed `infeasible`: `infeasible`, back to the
    verification gate with the verdict as evidence; D1 having claimed `done`: D1 re-runs, up to 2 counted
    retries, then `infeasible`;
  - a verdict with `"forced": "infeasible"` (FI-3): `infeasible`;
  - after a guided retry or an accepted re-run (§5), any failure: the gate escalates again.
  Log each gate attempt with the outcome its verdict file routes to; the run checker holds the log to the
  files.
- **D2** adds the campaign stages, with bridge skills while the named damage source is level-gated (D-301);
  **the D2 gate** checks every stage and, when the compile, V1 and V2 pass, runs the final compile with
  `buildName` in the same step. A failure (the final compile's included) re-runs D2 with the verdict, up to 2
  counted retries; the third escalates (§5). A pass goes to W1.
- **Pricing.** Tell each coordinator step how to price (the D1 gate reads it from `run-log.json` itself):
  offline; stopped (once any `stages[]` entry's `priceOutcomes` counts a `locked_out` or `rate_limited` call);
  or paced. With `--no-ninja`, add that there are no currency rates. Log each pricing step's outcome counts as
  its `priceOutcomes` (`references/pricing.md`).

## 5. Gate escalations (`references/checkpoints.md`; D-236)

Only the D1 and D2 gates escalate. Record the escalation as `{stage, concept, verdict, choice, guidance?}`,
`verdict` being the escalated attempt's verdict file, and the question as checkpoint `escalation`. Show
the stage, the attempts and the verdict file, and ask:

1. **accept** (not offered for a compile failure: nothing compiled). The verdict's failing findings are
   accepted: every later header's `accepted` carries them, an equal finding (same plan stage, part and
   code) fails no later gate, and W1 lists them under `Known issues`. After the D1 gate, go on as if it
   passed; after the D2 gate, run the D2 gate once more, uncounted, with them in `accepted`, so it runs the
   final compile.
2. **guidance and one more retry**: the producer (D1 or D2) gets one more attempt, uncounted, with the
   verdict and the user's guidance (`code: "user-guidance"`) in `findings`, then its gate. If the gate fails,
   whatever part fails, it escalates again.
3. **back to the verification gate** (the choice `verification`), the verdict file as that card's evidence.
4. **stop**: the run ends `escalated`.

## 6. Write, verify and the final gate (steps 10 to 16)

- **W1** writes `guide.md`, the reader layer, and `audit.md`, the audit layer beside it (D-276, D-278): its
  header's `writes` are both. Its header's `accepted` carries every accepted gate finding; its prompt names
  the last D1 gate verdict file (its budget totals and the named source's figures).
- **Step 11, the full pass.** Start the three lenses in parallel, `check: "full"`; each checks every claim
  of `plan.json` and `guide.md` in its lens, with no sampling. Write each report to `reports/v4-<lens>.json`.
- **Step 12, the fix round**, once, only when a report has an `unresolved` finding (D-264). Send each
  finding to its `owner`: D1, D2 or W1. Each owner fixes, in place with Edit, every claim the issue touches,
  not only the flagged location: the claim's wording, citation, caveat or source. It recompiles only when a
  finding needs a build change: gear, tree, gems, config, scenario or a ledger formula. It returns the ids it
  fixed, the locations it changed and whether it recompiled. The earliest owner runs first (D1, then D2), and
  W1 always runs last: it fixes its own findings and patches the guide in place wherever it repeats a claim
  another owner changed (their locations in its header's `changed`).
  - **No owner recompiled** (claims only): no gate runs; D1 → W1, D2 → W1, D1 → D2 → W1 or W1 alone. Log each
    D1 or D2 of the round with outcome `claims-edited`. The final record and the PoB file stay the last D2
    gate's.
  - **An owner recompiled:** its gates run as now: **D1** → D1 gate → D2 gate → W1; **D2** → D2 gate → W1. A
    step that is itself an owner gets its findings in `findings` (D2 after D1: D1 → D1 gate → D2 → D2 gate →
    W1; that D2 runs its gate even for claim edits, since the D1 gate's compile replaced the final record).
    Log each owner as `run-log.md` says: `done` when it recompiled, or when it is the D2 whose gate follows a
    recompiled D1; `claims-edited` when it edited claims only (a claims-only D1 before a D2 that recompiled).
    W1 still patches the guide in place, its header's `changed` `"all"`: the import code and every record or
    ledger number the guide quotes may have moved.

  The round is uncounted; the gates in it keep their 2 counted retries, and an escalation in it is a gate
  escalation.
- **Step 13, the re-check.** When a gate re-ran in the fix round (an owner recompiled), the plan and the
  guide's numbers are new: all three lenses run once more, in parallel, with `check: "recheck"`, their own
  open findings in `findings` and `changed: "all"`, and check every claim, as a full pass does. Otherwise
  (claims only) each lens that raised a finding runs once, in parallel, with its own open findings in
  `findings` and the owners' changed locations in `changed`, and checks only those; the **sources lens always
  runs**, even when it raised nothing, since an edited claim may cite something new. Write each report to
  `reports/v4-<lens>-recheck.json`. Either way there is no further round: what stays open is a known issue.
- **Step 14, known issues.** A finding is open when it is `unresolved` in its lens's re-check, or
  `unresolved` in the full pass and not reported `fixed` by a re-check. **Replace both lists whole** with
  Edit, every cycle (D-265, D-276), reading only the lines you edit, from the line numbers W1 returned last
  (W1 returns them on its first write and on every patch; no Grep: if a line isn't the heading, Read the file
  in parts until you find it), down to the next heading or the end of the file:
  - in `guide.md`, under `### Known issues`: first W1's lines for the accepted gate findings, as W1 wrote
    them; then one line per open finding, `- <reader>`, the finding's `reader` sentence exactly as its report
    gives it, with no id; or, with neither, the one line `None.`;
  - in `audit.md`, under `## Known issues`: the table head, W1's rows for the accepted gate findings, then one
    row per open finding, `| <id> | <lens> | — | <reader> |`; or, with neither, the one line `None.`.

  Drop every other line and row: one from an earlier cycle is stale.
- **Step 15.** Run the run checker (§7).
- **Step 16, the final gate** (once checkpoint 2). Show the guide's path, the PoB file (the D2 gate verdict's
  `finalCompile`), the gate verdicts, the known issues and the checker's result, and ask: **accept** (the run
  ends `completed`), **ask for changes**, or anything else (the run ends `not-accepted`, with the user's note).
  Asking for changes is a revision (D-236): map each request to D1, D2 or W1 by step 12's owners (the
  guide's text is W1's; an endgame stage, its ledger entries and prices D1's; a campaign stage D2's), run
  that chain as step 12 does (claims in place, the gates only after a recompile), with the requests as
  `findings` (`code: "user-request"`), then steps 11 to 16 again. A revision counts against no cap.

## 7. Finish

1. Set `status` and `outputs` (`plan`, `record`, `dossier`, `guide` and the PoB file; not the import code,
   whose one home is the record, D-260), and write the run log a last time.
2. Run the run checker, `node .claude/skills/build-guide/scripts/check-run.mjs <runFolder>`: at step 15,
   and once more after the last log write of every run. It checks the artifacts, recomputes the D1 gate
   from the record, and checks the run's control flow from the log (`references/run-folder.md`).
3. Tell the user: the run folder, the guide, the PoB file, where its import code is (the guide's `Your PoB
   file`, and `compile-record.json`), the final status, the known issues, and the checker's result
   (each violation it printed, if any).

## References

- `references/run-folder.md`: creating the run folder, the slug, the layout and who writes what, the PoB file
  name, what the run checker checks.
- `references/run-log.md`: every run-log field, and a first write.
- `references/task-header.md`: the header every agent prompt starts with.
- `references/checkpoints.md`: the brainstorm, verification and final gates, the unsaved-build and escalation
  questions, revisions, pre-supplied answers.
- `references/gates.md`: the gates, their verdict files, and what the run checker recomputes.
- `references/pricing.md`: the pricing procedure, outcome classification and the budget thresholds.
- `references/offline-and-test.md`: offline mode, `--no-ninja`, the test config and fault directives.
- `references/source-markers.md`: tags, citations and markers; the claim rules; the V4 report.
- `references/lookups.md`: the lookup tools, `mcp__pob2__check_model_coverage`'s statuses, hand calculations.
- `references/patterns.md`: the pattern library, the build shapes and brainstorm questions every researcher
  reads first (C-53).
- `references/stages/`: one stage reference per step, `references/stages/R1a-assemble.md` among them.
- `templates/card-template.md`: a candidate card, its brainstorm and verification halves (C-52).
- `scripts/check-run.mjs`: the run checker.
