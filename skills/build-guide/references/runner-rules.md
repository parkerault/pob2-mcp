# The shared rules: what every pob2 runner follows

The rules every runner follows (D-501, amendment 15 §6), the runner being the session following a pob2 skill:
`/pob2:build-guide` and each piece's command. Read this whole before anything else, and again after a compaction. A
step, a gate or a `writes` named here is `/pob2:build-guide`'s (`skills/build-guide/SKILL.md`); a runner with none
skips that part. The agents don't read this file: each agent type's rules are in its definition, and each step's in
its stage reference (D-356). The legacy rule (D-395) is game knowledge's: `skills/game-knowledge/references/lookups.md`
states it.

## Never .env

- **Never read, print or copy any `.env` file**, and never set `POESESSID`.

## The network

- **Never contact pathofexile.com or poe.ninja yourself**: no WebFetch, WebSearch or Bash to them. There are no
  poe.ninja tools beyond the currency rates (`mcp__pob2__get_currency_rates`, D-335) and no player evidence.
- **poe2db.tw needs no approval** (D-497): request its pages without asking, at the league digest's pace: one at a
  time, at least 3 s apart, no cookie, one retry after 60 s on a 429 or 5xx, and nothing fetched twice.

## Trade and pricing

- **No trade request after pricing stops, until the user approves a retry** (D-415, D-422, D-444). A step whose
  `priceOutcomes` counts a `locked_out`, `rate_limited` or `pace` call (D-474: then ask the user to reconnect the
  server with `/mcp`) stops trade-site pricing until a gate's `retry-pricing` or a resume: the next gate asks first,
  after its display; log the answer with `pob2-run-log <runFolder> pricing`. Tell every coordinator step until then:
  no `mcp__pob2__get_leagues`, `mcp__pob2__get_item_price` for an item, `mcp__pob2__search_trade_items`,
  `mcp__pob2__search_stats` or `mcp__pob2__find_upgrades`; the exchange stays allowed
  (`skills/pricing/references/pricing.md`).
- **In a piece run, a pricing stop ends the run** (D-516): a `/pob2:compile` or `/pob2:pricing` run has no gate that
  asks to retry. When a step's `priceOutcomes` counts a stop, `pob2-run-log` records it as above; then ask the user for
  the rung first when none is placed (entering maps, budget or non-budget, or "in the campaign"), set the status
  `stopped` (`pob2-run-log <runFolder> set`), tell the user when the lockout ends, and stop. The retry is
  `/pob2:<piece> --resume <run folder>` after the lockout: the resume clears the stop, and the step runs again, reusing
  every price the plan holds. A piece run logs no `pricing` answer, and no trade request comes before the lockout ends.
- **Tell the user before pricing starts** (D-461): that it starts, about how many searches, at least 45 s apart,
  and that their browser shares the limit; one trade call at a time (`skills/pricing/references/pricing.md`,
  "Pace").

## Where you write

- **Write only inside the run folder**: the `Known issues` lists (step 14) and the interview notes; by script the
  run log, the round copy, `audit.md` and `notes.txt`; each agent its header's `writes`. One script writes outside it:
  `pob2-league-digest`, only in the league folder `guide_run {new_run}` names (D-523).

## Agents

- **Agents run only through the Agent tool, as one of the four build-guide types**, named in `subagent_type` with
  the plugin's prefix: `pob2:build-guide-coordinator`, `pob2:build-guide-researcher`, `pob2:build-guide-verifier` or
  `pob2:build-guide-writer`.

## Your Bash

- **Your Bash reads, and runs the run checker and the three scripts; nothing else** (D-265). The whole list:
  - `ls`, `cat`, `head`, `tail`, `wc`, `grep` and `jq`, alone or piped into one another (`cd` before them is fine),
    each with no redirection (`>`, `>>`, `<`), no `tee`, no flag that writes a file (`-o`, `-i` or `-delete` where
    the tool writes with it), and no command substitution (`$(…)`, backticks) feeding another tool;
  - the run checker, `pob2-check-run <runFolder>`, with `--changed <n>`
    for a re-check's set (step 13), and with `--snapshot <n>` for the round copy (step 12, A-34), each with
    `--build <id>`, the build's folder (D-412);
  - the audit render, `pob2-render-audit <runFolder> --build <id>` (D-355),
    and its withdrawal after an answer change, `pob2-render-audit <runFolder> --withdraw <id>` (D-480);
  - the notes render, `pob2-render-notes <runFolder> --build <id>` (D-487); in a piece run each render takes its one
    build at the folder's root, with no `--build` (D-516);
  - the run log, `pob2-run-log <runFolder> <kind> - <<'JSON'`, the entry, `JSON` (D-356),
    its migration, `pob2-run-log <runFolder> migrate` (D-415),
    a gate's display, `pob2-run-log <runFolder> display <gate>` (D-367),
    and `pob2-run-log <runFolder> test-config <path>` (D-394);
  - the running league digests, `node <root>/skills/game-knowledge/scripts/leagues.mjs [--at <instant>]` (D-507),
    `<root>` the plugin root: it prints what `init` and `resume` print after their first line, with `--league
    <leagueFolder>` the league folder's digests too (D-523);
  - a running league's digest made on the user's side, `pob2-league-digest --running --out <leagueFolder>` (D-523), at
    a run's start, online and not under `--test`, `<leagueFolder>` the folder `guide_run {new_run}` names, never one
    you resolve yourself;
  - `git status --porcelain` in the session's working directory, **the stray-file check** (D-474, D-501): when that
    folder, the one the session started in, is a git work tree, keep the untracked paths at the run's start or resume
    in your context; after each step, tell the user each new one, and delete nothing. When it isn't one (git says
    `not a git repository`), the check is skipped: say so once, at the start.

  Nothing else: no other `node` call (`node -e` included), no other `git`, no `find`, `sort`, `sed`, `awk`,
  network client (`curl`, `wget`, `nc`, `ssh`) or host, and nothing else that writes, moves or deletes a file. Write
  every other file with Write (or Edit), never with Bash. The agents have no Bash at all.
