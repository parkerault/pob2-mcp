# WU-64: the per-run output counter

Date 2026-10-11. Claude Code 2.1.296, model `claude-opus-5-5`. **[V]** = measured or read here,
**[I]** = inference.

**Decision:** pending the control run (`WU-64-control.md`).

## The counter

`scripts/run-usage.mjs` (Node, no dependencies):

```bash
node scripts/run-usage.mjs <session.jsonl> [--telemetry <events.jsonl>] [--json <out.json>] [--fit]
```

It reads the main transcript and every `<session>/subagents/*.jsonl`, and prints per agent, per step kind
(the brief's `"stage"` marker, else the agent type), per family (the kind before its `-`) and in total:
turns, recorded and estimated output, thinking and visible output, input, cache read and write, and peak
context (the largest input + cache read + cache write of one request).

**Method.**

| Step | Rule |
|---|---|
| Dedupe | One request per message id (else request id). Claude Code logs one entry per content block; the request's blocks are the union of its entries. |
| Usage | A **complete** record carries `output_tokens_details.thinking_tokens` and `iterations` (the final usage); the request keeps it. Otherwise it keeps the largest **stale** count, the `message_start` value (3–32 tokens) [V]. |
| Recorded | The kept `output_tokens`, as the transcript says. |
| Estimated | A complete record's count as is; a stale request's count estimated from its content. |
| Thinking | The transcript keeps only the encrypted signature. Estimate: 0.346 × (signature chars − 890) per block, the 890 being the envelope of an empty block (828 chars ↔ 9 tokens) [V]. |
| Visible | Text plus tool input as JSON: chars / 2.144 + 92 per request + 13 per tool call + 10.5 per text block. |
| Calibration | Each agent rescales the thinking and visible parts by the ratio its own complete records show (when they predict ≥ 2K tokens). Thinking per signature character ranges 0.23–0.50 by agent in run A, by content [V]. |
| Constants | Least squares over run A's 1,271 complete records (`--fit`). |
| Check | Each agent's complete records in two folds: each fold estimated as if stale, calibrated on the other fold, and compared with its records. |

**Run A's records** [V]: 1,696 requests; 1,271 (75%) have a complete record and 425 don't. The stale
ones are the multi-block responses: thinking with one or more tool calls, 1.84 tool calls on average
against 1.37. The 60K-character Write is one of them: three entries, each at 8 tokens; estimated 27K.

## Run A

Transcripts of session `17907107…` (the runner and 36 subagents). The runner's transcript gained one
request (+8.5K output) after the study's tally.

| | Study (cost 1, §3) | Counter |
|---|---|---|
| Recorded output | 1.78M | 1.79M |
| Estimated output | 2.3–2.5M (table: 2.52M) | 2.50M |
| Thinking | 1.60M | 1.59M (64%) |
| Cache read | — | 296.2M |

By step kind:

| Kind | Agents | Turns | Recorded | Estimated | Thinking | Visible | Cache read | Cache write | Peak context | Check % |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| V4 | 11 | 572 | 476.5K | 750.5K | 568.6K | 181.8K | 104.87M | 3.37M | 378.8K | 1.3 |
| W1 | 4 | 108 | 478K | 483.9K | 371.6K | 112.3K | 16.31M | 1.67M | 438.5K | -1 |
| D1 | 4 | 170 | 160.1K | 318.6K | 154.3K | 164.2K | 41.16M | 901.3K | 545.1K | 0.8 |
| R1a | 3 | 250 | 206.3K | 298.9K | 178.5K | 120.5K | 36.84M | 808.3K | 289.8K | -0.1 |
| D2 | 3 | 146 | 140.6K | 187.5K | 116.7K | 70.8K | 35.96M | 642.8K | 495.9K | 0.7 |
| R1b | 4 | 177 | 76.7K | 167.2K | 85.9K | 81.3K | 25.46M | 610.1K | 284.9K | 1.4 |
| runner | 1 | 119 | 123K | 123K | 19.6K | 103.4K | 21.59M | 607.7K | 330.6K | -0.6 |
| R1b-assemble | 1 | 37 | 84.4K | 100.8K | 62.4K | 38.4K | 4.7M | 212.9K | 229.1K | 0 |
| D1-gate | 3 | 67 | 29.1K | 31.5K | 9.7K | 21.8K | 6.07M | 350.2K | 146.8K | -0.4 |
| R1a-assemble | 1 | 30 | 9K | 29.7K | 21.7K | 8K | 2.61M | 142.1K | 142.1K | 5.2 |
| D2-gate | 2 | 20 | 3.5K | 5.2K | 0.4K | 4.9K | 648.8K | 48.4K | 40.7K | -1.4 |
| **Total** | 37 | 1696 | 1.79M | 2.5M | 1.59M | 907.4K | 296.21M | 9.36M | 545.1K | 0.2 |

The study's grouping, for comparison: V4 750K (study 731K), W1 484K (489K), D1 with its gate 350K (326K),
R1a with assembly 329K (311K), D2 with its gate 193K (196K), R1b 167K (174K; R1b-assemble 101K is
separate here), runner 123K (124K).

**Peak context per agent.** 23 of 37 agents passed the 150K design target (D-357); the largest are D1's
first attempt (545K), D2's first attempt (496K) and W1's first attempt (438K).

| Agent | Kind | Turns | Complete | Recorded | Estimated | Thinking | Cache read | Peak context | Check % |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|
| D1 r1-a-1 attempt 1 | D1 | 104 | 50% | 90.8K | 237.5K | 114.8K | 32.66M | 545.1K | 1.5 |
| D2 r1-a-1 attempt 1 | D2 | 109 | 66% | 118.7K | 154.4K | 93.1K | 33.69M | 495.9K | 0.5 |
| W1 r1-a-1 attempt 1 | W1 | 39 | 95% | 206K | 207.3K | 142.5K | 6.96M | 438.5K | -6.3 |
| V4 sources full r1-a-1 | V4 | 87 | 79% | 66.8K | 99.3K | 71.3K | 20.64M | 378.8K | -0.2 |
| V4 prose full r1-a-1 | V4 | 51 | 73% | 91.1K | 130.7K | 118.1K | 11.98M | 349.9K | 20.4 |
| W1 r1-a-1 fix round (attempt 2) | W1 | 32 | 97% | 135.9K | 138K | 104.3K | 5.98M | 335K | 2.8 |
| main session | runner | 119 | 100% | 123K | 123K | 19.6K | 21.59M | 330.6K | -0.6 |
| V4 sources full r1-a-1 (revision) | V4 | 74 | 69% | 47.6K | 76.4K | 58.8K | 14.98M | 320.8K | -0.2 |
| V4 prose full r1-a-1 (revision) | V4 | 44 | 77% | 57.5K | 85.8K | 61.2K | 8.34M | 314.5K | -8.2 |
| V4 sources recheck r1-a-1 | V4 | 69 | 75% | 32.3K | 63.6K | 39.8K | 13.89M | 299K | 3.6 |
| R1a round 1 researcher a | R1a | 104 | 71% | 81.5K | 102K | 50.8K | 16.73M | 289.8K | 0 |
| R1b r1-a-1 attempt 2 | R1b | 93 | 68% | 39.8K | 84.7K | 45.4K | 15.35M | 284.9K | 0.8 |
| R1a round 1 researcher c | R1a | 69 | 74% | 73.9K | 107.5K | 67K | 9.97M | 275K | 0.1 |
| V4 prose recheck r1-a-1 | V4 | 46 | 76% | 31K | 93.8K | 81.9K | 8.22M | 266.7K | -12.9 |
| V4 ledger full r1-a-1 | V4 | 62 | 87% | 47.4K | 61.3K | 46.8K | 9.94M | 258.8K | 0 |
| R1b r1-b-1 attempt 2 | R1b | 51 | 53% | 26.9K | 68.3K | 35.4K | 8.39M | 250.5K | 0 |
| R1a round 1 researcher b | R1a | 77 | 53% | 50.9K | 89.5K | 60.6K | 10.14M | 243.6K | -0.5 |
| V4 ledger full r1-a-1 (revision) | V4 | 47 | 81% | 26.2K | 35.3K | 25.2K | 6.56M | 240.2K | 2.5 |
| D1 r1-a-1 fix round (attempt 3) | D1 | 45 | 87% | 65.6K | 69.8K | 33.6K | 7.34M | 232.6K | -0.4 |
| R1b-assemble verification round 1 | R1b-assemble | 37 | 95% | 84.4K | 100.8K | 62.4K | 4.7M | 229.1K | 0 |
| V4 prose recheck r1-a-1 (revision) | V4 | 31 | 81% | 46.1K | 60.7K | 37.9K | 3.89M | 227.1K | -12.7 |
| V4 ledger recheck r1-a-1 | V4 | 40 | 88% | 18.8K | 25.8K | 15.5K | 5.14M | 195.1K | 0.1 |
| W1 r1-a-1 fix round (attempt 4) | W1 | 28 | 96% | 94.5K | 96.1K | 86.2K | 2.86M | 174.8K | 2.6 |
| D1-gate r1-a-1 attempt 3 (fix round) | D1-gate | 26 | 92% | 9K | 9.7K | 2.2K | 2.49M | 146.8K | -8.9 |
| R1a-assemble round 1 | R1a-assemble | 30 | 37% | 9K | 29.7K | 21.7K | 2.61M | 142.1K | 5.2 |
| D1-gate r1-a-1 attempt 2 | D1-gate | 17 | 94% | 7.6K | 8.2K | 2.1K | 1.45M | 127.9K | 3.5 |
| D1-gate r1-a-1 attempt 1 | D1-gate | 24 | 88% | 12.5K | 13.7K | 5.4K | 2.12M | 124.2K | 3.4 |
| W1 r1-a-1 revision (attempt 3) | W1 | 9 | 89% | 41.6K | 42.5K | 38.6K | 503.2K | 112.4K | 4.2 |
| D2 r1-a-1 fix round (attempt 3) | D2 | 19 | 68% | 12.6K | 21.4K | 15.8K | 1.17M | 94.3K | 1.1 |
| D1 r1-a-1 revision (attempt 4) | D1 | 12 | 58% | 2.2K | 8.6K | 5.3K | 721.4K | 91.5K | 8.2 |
| V4 sources recheck r1-a-1 (revision) | V4 | 21 | 76% | 11.6K | 17.8K | 12.1K | 1.28M | 87.7K | 3.2 |
| D2 r1-a-1 fix round (attempt 2) | D2 | 18 | 78% | 9.4K | 11.8K | 7.8K | 1.09M | 84.9K | 3.2 |
| R1b r1-a-1 attempt 1 | R1b | 21 | 67% | 5.3K | 8.2K | 3.1K | 1.22M | 81.3K | 5.5 |
| D1 r1-a-1 attempt 2 | D1 | 9 | 67% | 1.5K | 2.6K | 0.6K | 437K | 64.5K | 6.4 |
| R1b r1-b-1 attempt 1 | R1b | 12 | 75% | 4.8K | 5.9K | 2K | 505.9K | 58.1K | 10.4 |
| D2-gate r1-a-1 attempt 2 (fix round) | D2-gate | 10 | 70% | 1.9K | 2.7K | 0.2K | 326.4K | 40.7K | -4 |
| D2-gate r1-a-1 attempt 1 | D2-gate | 10 | 70% | 1.6K | 2.5K | 0.2K | 322.4K | 40.1K | 1.7 |

## The check against complete records

| Set | Records | Recorded | Estimate, constants only | Estimate, calibrated |
|---|---:|---:|---:|---:|
| Run A, held out per agent | 1,271 | 1.78M | 1.78M (−0.1%, in sample) | 1.79M (+0.2%) |
| Run A, per step kind | | | | −1.4% … +5.2% |
| Run A, per agent | | | | −12.9% … +20.4% |
| P1 (`a30c5754…`, agents off; every record complete) | 30 | 12.2K | 15.1K (+24.3%) | 12.7K (+4.0%) |

The calibrated estimate applies only to the 425 stale requests (713K of run A's 2.50M). Weighting each
agent's check error by its stale output bounds the error on the total at ±27.6K (1.1%); signed, +2.0K.
P1 shows why the calibration matters: its thinking runs 0.27 tokens per signature character against run
A's 0.35. The check cannot see a bias particular to stale requests (they hold more parallel tool calls);
the control does, request by request.

## The telemetry route

Confirmed in the 2.1.296 binary [V]:

| Setting | Value |
|---|---|
| Switch | `CLAUDE_CODE_ENABLE_TELEMETRY=1` |
| Exporters | `OTEL_METRICS_EXPORTER`, `OTEL_LOGS_EXPORTER`: `console`, `otlp` (metrics also `prometheus`) |
| Protocol | `OTEL_EXPORTER_OTLP_PROTOCOL` (or the `_LOGS_`/`_METRICS_` variants): `grpc`, `http/json`, `http/protobuf` |
| Endpoint | `OTEL_EXPORTER_OTLP_ENDPOINT`; the HTTP exporters post to `/v1/logs` and `/v1/metrics` |
| Intervals | `OTEL_LOGS_EXPORT_INTERVAL` default 5000 ms; `OTEL_METRIC_EXPORT_INTERVAL` default 60000 ms |
| Temporality | `OTEL_EXPORTER_OTLP_METRICS_TEMPORALITY_PREFERENCE`, set to `delta` when unset |
| `api_request` | `model`, `input_tokens`, `output_tokens`, `cache_read_tokens`, `cache_creation_tokens`, `cost_usd`, `duration_ms`, `request_id` (the transcript's `requestId`), `query_source`, `effort`, `agent.name` |
| Identity | `user.id`, `user.email`, `user.account_uuid`, `user.account_id`, `organization.id`, `identity.*`, `terminal.type`, `session.id` |

`scripts/otlp-receiver.mjs` binds 127.0.0.1 and appends to a JSONL file only the `api_request` and
`api_error` events and the token and cost metrics. It drops every other event unread, never writes
resource attributes, and drops any attribute whose key names an identity or whose value looks like an
email address. Tested with synthetic payloads: identity keys and an email value dropped, prompts dropped,
gzip read, protobuf refused with 415. `run-usage.mjs --telemetry` totals the file by query source and
agent, and joins it with the transcripts by request id.

**The session ledger** [V]. At exit, Claude Code writes a `cost-state` entry into the main transcript: its
running totals per model (output, thinking, input, cache), the figures `/usage` shows. In P1 it reads
12,728 output and 5,561 thinking against the transcript's 12,162 and 5,021 (all complete): about 0.6K
output and 421K cache read from requests the transcript doesn't hold [I: side requests such as prompt
suggestions]. Run A's transcript has no `cost-state` entry.

## The control

Pending: `WU-64-control.md`.

## Decision

Pending the control.
