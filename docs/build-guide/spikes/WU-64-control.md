# WU-64: the control run

A short interactive session, run by the user, whose output is known in advance. It is the ground truth
for the output counter (`scripts/run-usage.mjs`): Claude Code's telemetry reports the API's own token
counts for each request, and the files the session writes give lower bounds. The comparison is in
`WU-64-output-counter.md`.

**Status.** Not run. The lean recorded run (WU-72), made with telemetry on through the same receiver,
served as the control in its place. This protocol stays available as a short re-check, for instance
after a Claude Code upgrade. The launch command below is also the one a recorded run uses.

**What it touches.** A fresh `mktemp -d` folder only. The session talks to the Anthropic API and to the
receiver on `127.0.0.1:4318`, and nothing else: no MCP servers (`--strict-mcp-config`), no web, no
shell commands, no `.env`, no `/mnt`. It takes about three minutes.

## Run it

In one terminal (zsh or bash), from any folder:

```bash
D=$(mktemp -d) && mkdir "$D/work" && echo "$D"
node ~/projects/pob2-mcp-wt/bg-64/scripts/otlp-receiver.mjs --out "$D/events.jsonl" 2>"$D/receiver.log" &
cd "$D/work" && env CLAUDE_CODE_ENABLE_TELEMETRY=1 OTEL_METRICS_EXPORTER=otlp OTEL_LOGS_EXPORTER=otlp OTEL_EXPORTER_OTLP_PROTOCOL=http/json OTEL_EXPORTER_OTLP_ENDPOINT=http://127.0.0.1:4318 OTEL_METRIC_EXPORT_INTERVAL=5000 OTEL_LOGS_EXPORT_INTERVAL=1000 OTEL_METRICS_INCLUDE_ACCOUNT_UUID=false claude --strict-mcp-config --permission-mode acceptEdits
```

If Claude Code asks whether to trust the folder, accept: it is the empty temp folder. In the session,
paste this prompt as one message:

```text
This is a token-counting control. Work only in the current folder. Don't read, search or fetch anything, and don't run shell commands.

1. Before any tool call, think it through: work out exactly how many characters squares.txt (below) will have, newlines included, and check the figure a second way.
2. Then, in one single response, call Write twice in parallel:
   - squares.txt: for n = 1 to 600, the line "n n^2", the two numbers separated by one space (for example "12 144");
   - cubes.txt: for n = 1 to 400, the line "n n^3" (for example "12 1728").
3. Then use the Agent tool once, subagent type general-purpose, with this task: "Think briefly about how many characters the files will have. Then, in one single response, call Write twice in parallel: numbers.txt with the integers 1 to 3000, one per line; and letters.txt with the line abcdefghijklmnopqrstuvwxyz repeated 300 times. Then reply DONE."
4. Finally reply with one line: DONE and your character count for squares.txt.
```

When it has replied DONE:

1. Run `/usage` (or `/cost`). If it shows token counts for the session, note the output (and thinking)
   figures. Copy numbers only, nothing that identifies the account.
2. Run `/exit`. Claude Code then writes its session ledger into the transcript and flushes telemetry.
3. Back in the shell:

```bash
kill %1; cat "$D/receiver.log"; wc -c "$D/events.jsonl" "$D"/work/*.txt
ls -t ~/.claude/projects/$(pwd | sed 's/[^A-Za-z0-9]/-/g')/*.jsonl | head -1
```

Hand back `$D`, the transcript path the last command prints, and the `/usage` figures if any.
`events.jsonl` holds only `api_request` and `api_error` events and the token and cost metrics; the
receiver drops prompts, tool results, resource attributes and every identity attribute before writing.

## What it gives

| Source | What it measures |
|---|---|
| The four files | Lower bounds. Correct content is 6,034 characters (squares), 4,696 (cubes), 13,893 (numbers) and 8,100 (letters): 32,723 in all, over 4,300 lines. Each line holds a number or the alphabet, so the Writes cost at least one token per line, and in practice far more. |
| Telemetry, `api_request` | The API's output, input and cache counts for every request, main and subagent, with its request id (the transcript's `requestId`), so the counter is checked request by request. |
| Telemetry, `claude_code.token.usage` | The same totals as a metric, by token type and query source. |
| The session ledger | The `cost-state` entry `/exit` writes into the transcript: the client's own running totals, output and thinking, as `/usage` shows them. |
| `/usage` | The same ledger, if the plan shows it. |

The parallel Writes in steps 2 and 3 make multi-block responses, the ones whose transcript entries
carry a stale output count, in both the main session and a subagent.

## Analysis (WU-64)

```bash
node scripts/run-usage.mjs <transcript.jsonl> --telemetry "$D/events.jsonl" --json <out.json>
```
