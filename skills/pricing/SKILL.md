---
name: pricing
description: Price a Path of Exile 2 character from its Path of Building (PoB) file through the pob2 MCP server. It reports what the character's gear costs to replace (the cheapest way to the same must-have stats, by slot and in all), which endgame rung that cost places it on (entering maps, budget or non-budget, or still in the campaign), and, with a budget the player names, the trade listings that improve it within that budget, each with PoB's gain, its price and its link. Use when a player asks "what is my gear worth", "how much would it cost to rebuild my character", "price my build MyCharacter123", "is my character budget or non-budget", "which rung is my character on" or "what should I buy for 50 divines", when the user runs /pob2:pricing <build name or import code> [--budget <divines>] [--offline] [--no-ninja], or resumes a stopped run with /pob2:pricing --resume <run folder>. It reads a builds-folder file or an import code and never writes the player's file. Not for a build guide, from a brief or from the player's own build (use /pob2:build-guide). Not for measuring the character or making it better (use /pob2:compile). Not for a game question (use /pob2:game-knowledge).
---

# pricing

You are the **runner** of the pricing piece (D-520, C-64): on a player's Path of Building file you report what its gear
costs to replace, place the character on the endgame ladder by that cost, and, with a budget the player names, show the
upgrades within it. You start the run, read the file into a plan, call one coordinator step to price it, show the
player the result and run the run checker. A root-relative path in its references is under `${CLAUDE_PLUGIN_ROOT}`,
the plugin root.

**Before anything else, read `${CLAUDE_PLUGIN_ROOT}/skills/build-guide/references/runner-rules.md` whole**, and again
after a compaction: the rules every pob2 runner follows (D-501), on `.env`, the network, trade and pricing, where you
write, agents and your Bash. A step, gate or `writes` it names is `/pob2:build-guide`'s; yours are below. Search with
`grep` through Bash, as the runner rules allow, and Read a file whole (D-515).

**After a compaction** during a pricing run, before your next step: re-read this file and the runner rules whole, and
the run's `run-log.json`.

## What you never do

- **Write the player's file.** The file reader reads a builds-folder file or an import code and keeps its own copy,
  `source.xml`, in the run folder; nothing goes into the builds folder. An import code goes only to the reader: never
  into the log, a header or a reply.
- **Price, compile or change the engine's build yourself.** Every price, league, rate and compile call is the
  coordinator step's (D-178). Your pob2 tools are `mcp__pob2__list_builds`, `mcp__pob2__guide_run` (`{new_run:
  "pricing"}`, `{resume: <run folder>}`) and `mcp__pob2__plan_from_build`.
- **Read `plan.json` or the compile record.** Route on the reader's reply, `read.json`, the step's return,
  `prices.md` and `upgrades.json`.
- **Assume a rung.** The replace cost places the character; without trade, or with a price or a rate missing, the
  player names the rung (answer 2). Never assume non-budget.

## The build the player names (D-516)

"Price my build MyCharacter123" names a builds-folder file: call `mcp__pob2__list_builds`; a file whose name equals
the name the player gave, ignoring case and `.xml`, is the build. Otherwise list the closest names and ask; never
guess. A pasted import code is the reader's `import_code`.

## The steps

| # | Step | Who | Writes | Does |
|---|---|---|---|---|
| 1 | Start | you | `run-log.json` | `mcp__pob2__guide_run {new_run: "pricing"}`; `pob2-run-log <runFolder> init` with `piece: "pricing"`; the budget asked |
| 2 | `read` | you | `source.xml`, `plan.json`, `read.json` | `mcp__pob2__plan_from_build`; its questions asked as an interview; its second call with the answers |
| 3 | The notice | you | — | before any trade request, the pricing notice; over 30 searches, the player's yes first |
| 4 | `price` | `pob2:build-guide-coordinator`, fresh | `plan.json`, `prices.md`, `upgrades.json` | `${CLAUDE_PLUGIN_ROOT}/skills/pricing/references/stages/price.md`: a measure-only compile, the league, the replace cost, the place, the upgrades |
| 5 | The display | you | `upgrades.json`'s `chosen` and `spent` | short: the replace cost by slot and in all, the place, each slot's upgrades for the player to pick |
| 6 | End | you | — | `pob2-check-run <runFolder>`; status `completed`, or `stopped` |

**1. Start.** Read the arguments: the build (a name or an import code), `--budget <divines>`, `--offline` (no trade or
poe.ninja call at all) and `--no-ninja` (no currency rates, D-333). Call `mcp__pob2__guide_run {new_run: "pricing"}`
for the run folder, `Guides/pricing/<date>-<n>/`, then write the log's first entry:

```
pob2-run-log <runFolder> init - <<'JSON'
{"piece": "pricing", "mode": "online", "testConfig": "none", "noNinja": false, "source": {"kind": "builds-folder", "name": "MyCharacter123"}}
JSON
```

`source` is `{"kind": "import-code"}` for a code, with no name. Without `--budget`, ask once whether the player wants
upgrades, and for how many divines; "no" means no upgrade search. Offline, nothing can price it: after the read, ask
for the rung (entering maps, budget, non-budget, or in the campaign), unless the reader's reply puts the character under
level 65, below the endgame, whose place is in the campaign (choice A).

**2. Read.** `mcp__pob2__plan_from_build {run_folder: <runFolder>, build_name | import_code}`. Its reply names what it
left out and its questions: the main skill (`main_group`; PoB's choice may be its guess), the loadout when the file holds
several, an older tree (`tree`), a stand-in for a base the pin lacks (`stand_in`). Ask them as an interview, the reply's
numbers and the file's beside them, never as a multiple choice; then make the second call with the answers. Log
`pob2-run-log <runFolder> stage` `{"stage": "read", "attempt": 1, "outcome": "done"}`, or `"fail"` when the reader
refused the file, and stop there with its reason. The Spirit question is compile's: pricing measures the file as read.

**3. The notice** (D-461, `${CLAUDE_PLUGIN_ROOT}/skills/pricing/references/pricing.md`, "Pace"). Online, before step 4:
tell the player that pricing starts, about how many searches it makes (one depth check a rare and rare jewel, one a
unique or magic item, and with a budget about two a gear slot: from the reader's `<k> items`, about <k> plus 2 a gear
slot), that they go at least 45 s apart (about <n> minutes), and that their browser shares the trade site's limit.
Over 30 searches, wait for the player's yes first. Offline, no notice.

**4. Price.** Call one fresh coordinator, alone:

````
```json
{"stage": "price", "attempt": 1, "mode": "online", "runFolder": "<abs>", "runFolderRel": "pricing/2026-12-01-1",
 "buildFolder": ".", "compile": "measure-only", "league": null, "budget": 50, "rung": null, "faults": [],
 "writes": ["plan.json", "prices.md", "upgrades.json"], "root": "<the plugin root>",
 "reference": "skills/pricing/references/stages/price.md"}
```
Read <root>/skills/pricing/references/stages/price.md and do that step.
````

`budget` is the player's divines or `null`; `league` and `rung` are `null` until the player answers. Log its return as
`pob2-run-log <runFolder> stage` `{"stage": "price", "attempt": <n>, "outcome": "done", "priceOutcomes": {…}}` from its
`prices:` line (`{}` for `prices: none`). Route on its return:
- `league: ask (<leagues>)`: the file's league isn't one trade lists, or is Standard, hardcore or SSF. Ask which league
  to price in, then run the step again with `league`. Never price in another league without the player's word.
- `place: ask`: the cost can't place it (offline, an `unavailable` price, no rates under `--no-ninja`). Ask for the
  rung (entering maps, budget or non-budget, or in the campaign), then run the step again with `rung`: it reuses every
  price the plan holds and searches nothing new.
- **A pricing stop** (its counts hold `rate_limited`, `locked_out` or `pace`): `pob2-run-log` records it, and the run
  ends (D-516, the runner rules). Ask for the rung first when the return names none, run the step once more with
  `rung` (the stop open, it makes no trade request and writes the place), set the status `stopped` with
  `pob2-run-log <runFolder> set`, tell the player when the lockout ends, and stop.
- `fail` (the compile refused the plan): say so, set the status `stopped`, and stop.

**5. The display.** From `prices.md` and `upgrades.json`, short and in players' words ("exalts", "divines"): the
replace cost by slot and in all, the place and why, then each slot's upgrades, each with its gains (damage, EHP, the
lowest max hit), its price and its link, shown verbatim. Ask which, if any, the player picks; three unlike gains have
no exchange rate, so the player chooses. Write `chosen` (`[{"slot", "listing": <index>}]`) and `spent` (their total
in divines, by the rates `prices.md` names) into `upgrades.json` with Edit. Without a cookie, each slot shows its link
alone: the player opens it while logged in.

**6. End.** Set the status `completed` with `pob2-run-log <runFolder> set`, run `pob2-check-run <runFolder>`, and tell
the player the run folder, the files (`prices.md`, `upgrades.json`) and each violation the checker printed.

## Resuming a stopped run

`/pob2:pricing --resume <run folder>`, after the lockout ends, is the retry (D-516): `mcp__pob2__guide_run {resume:
<run folder>}`, then `pob2-run-log <runFolder> resume` with this session's `noNinja`, which clears the stop. Read
`run-log.json`; the read is done, so give the notice (step 3) and run step 4 again: it reuses every price the plan
holds, prices the rest and may place the character again. Then steps 5 and 6.
