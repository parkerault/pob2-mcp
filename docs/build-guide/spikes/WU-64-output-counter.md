# WU-64: the per-run output counter

Date 2026-10-14. Claude Code 2.1.296, model `claude-opus-5-5`. **[V]** = measured or read here,
**[I]** = inference.

## Decision

| Question | Answer |
|---|---|
| What backs D-357's output budget | **Telemetry**: the `api_request` events, kept by `scripts/otlp-receiver.mjs`. They are the API's own count of every request, side requests included. On the lean run they matched the transcripts' 573 complete records exactly and the session ledger to the token (1,232,323). |
| Cross-check | **The session ledger**: the `cost-state` entry Claude Code writes into the main transcript on `/exit`, the totals `/usage` shows. It needs no setup but gives one total only. It is missing when the session doesn't end with `/exit` (run A has none). |
| Fallback | **The transcript estimate** (`scripts/run-usage.mjs`), used only when telemetry is missing. Allow ±7% (cost study 1's error): a run within 7% of the 1M limit is undecided. Measured error on totals: +0.35% on the lean run, +0.2% on run A's held-out records. |
| Per-step and per-agent figures | **The transcripts, joined to telemetry on `request_id`.** Telemetry labels every custom agent the same (`query_source` `agent:custom`, `agent.name` `custom`), so it can't attribute output to steps. With the join, each agent's output is the API's count, and its peak context and cache read come from the transcripts, which match telemetry on every request. |
| `agent_summary` | It counts toward the run's output, because it is the run's spend: 5.85K, 0.5% of output. Report its cache read on a line of its own: 47.9M, 27% of the lean run's 177.5M. It is Claude Code's progress summary of running subagents, not a pipeline step (see the control). |

**The lean-run procedure.** Always start the receiver first.

| Step | Action |
|---|---|
| 1 | Start `node scripts/otlp-receiver.mjs --out <dir>/events.jsonl`, then launch `claude` with the telemetry variables (the command in `WU-64-control.md`). |
| 2 | End the session with `/exit`, so the ledger is written. |
| 3 | Run `node scripts/run-usage.mjs <transcript.jsonl> --telemetry <dir>/events.jsonl --json <out.json>`. |
| 4 | Health check: `0 only in the transcripts`, and `session ledger output … vs telemetry … (0%)`. If either fails, or telemetry is absent, use the estimate with its ±7%. |
| 5 | Read the budget from telemetry's total output. Read output per step, peak context per agent and cache read per step from the joined table, and give `agent_summary` its own line. |

## The counter

`scripts/run-usage.mjs` (Node, no dependencies):

```bash
node scripts/run-usage.mjs <session.jsonl> [--telemetry <events.jsonl>] [--json <out.json>] [--fit]
```

It reads the main transcript and every `<session>/subagents/*.jsonl`. It reports per agent, per step kind
(the brief's `"stage"` marker, else the agent type), per family (the kind before its `-`) and in total:
- turns;
- recorded and estimated output;
- thinking and visible output;
- input, cache read and cache write;
- peak context, the largest input + cache read + cache write of one request.

With `--telemetry` it totals the events by query source and joins them to the transcripts, request by
request.

**Method.**

| Step | Rule |
|---|---|
| Dedupe | One request per message id (else request id). Claude Code logs one entry per content block; the request's blocks are the union of its entries. |
| Usage | A **complete** record carries `output_tokens_details.thinking_tokens` and `iterations`, the final usage; the request keeps it. Otherwise the request keeps the largest **stale** count, the `message_start` value of 2–77 tokens [V]. A stale record's input and cache counts are right: they equal telemetry on all 837 lean-run requests [V]. |
| Recorded | The kept `output_tokens`, as the transcript says. |
| Estimated | A complete record's count as is; a stale request's count estimated from its content. |
| Thinking | The transcript keeps only the encrypted signature. Estimate: 0.346 × (signature chars − 890) per block. The 890 is the envelope of an empty block (828 chars carry 9 tokens) [V]. |
| Visible | Text plus tool input as JSON: chars / 2.144, plus 92 per request, 13 per tool call and 10.5 per text block. |
| Calibration | Each agent rescales the thinking and visible parts by the ratio its own complete records show, once those records predict at least 2K tokens. In run A, thinking per signature character ranges 0.23–0.50 by agent, depending on content [V]. |
| Constants | Least squares over run A's 1,271 complete records (`--fit`). |
| Check | Each agent's complete records are split into two folds. Each fold is estimated as if stale, calibrated on the other fold, and compared with its records. |

**Stale records** [V]. They are the multi-block responses: thinking plus one or more tool calls.
- Run A: 425 of 1,696 requests are stale; they average 1.84 tool calls, against 1.37 for complete ones.
- Lean run: 264 of 837 requests are stale.
- Run A's 60K-character Write is one of them: three entries, each logged at 8 tokens. The estimate is 27K.

## Run A

Transcripts of session `17907107…`: the runner and 36 subagents. The runner's transcript gained one
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

For comparison with the study's grouping (study figure in parentheses):

| Group | Counter | Study |
|---|---:|---:|
| V4 | 750K | 731K |
| W1 | 484K | 489K |
| D1 with its gate | 350K | 326K |
| R1a with assembly | 329K | 311K |
| D2 with its gate | 193K | 196K |
| R1b | 167K | 174K |
| Runner | 123K | 124K |

R1b-assemble (101K) is a separate kind here.

**Peak context per agent.** 23 of 37 agents went past the 150K design target (D-357). The largest:
D1 attempt 1 (545K), D2 attempt 1 (496K), W1 attempt 1 (438K).

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
| Run A, total | 1,271 | 1.78M | 1.78M (−0.1%, in sample) | 1.79M (+0.2%) |
| Run A, per step kind | | | | −1.4% … +5.2% |
| Run A, per agent | | | | −12.9% … +20.4% |
| P1 (`a30c5754…`, agents off, every record complete) | 30 | 12.2K | 15.1K (+24.3%) | 12.7K (+4.0%) |
| Lean run, total | 573 | 867.3K | 896.0K (+3.3%) | 888.4K (+2.4%) |

**Why the calibration matters.** P1's thinking runs at 0.27 tokens per signature character, against
run A's 0.35.

**Where the estimate's error matters.** The estimate applies only to stale requests: 713K of run A's
2.50M. Weighting each agent's check error by its stale output bounds run A's total error at ±27.6K
(1.1%); signed, the error is +2.0K.

## The control: the lean run (WU-72)

**The ground truth.** The user didn't run the short protocol (`WU-64-control.md`); the lean recorded run
took its place. It used telemetry through the receiver, and it is a better control:
- the API's own counts for all 1,104 requests;
- 264 stale requests across 11 step kinds, where the short protocol would give a handful.

Its transcripts are session `a3f7b5d1…`: the runner and 21 subagents. The events file holds no email or
account id [V].

**Totals** [V].

| Counter | Output | Cache read |
|---|---:|---:|
| Telemetry, `api_request` (1,104 requests) | 1,232,323 | 177.49M |
| Telemetry, `claude_code.token.usage` | 1,232,323 | 177.49M |
| Session ledger (`cost-state`, as `/usage`) | 1,232,323 | 177.49M |
| Telemetry, without `agent_summary` (837 requests) | 1,226,473 | 129.61M |
| Transcripts, recorded | 869,907 (−29.1%) | 129.61M |
| Transcripts, estimated | 1,230,810 (+0.35%) | 129.61M |

**Join on `request_id`.** All 837 transcript requests matched; 267 telemetry requests matched nothing.

| Records | Requests | Transcript | Telemetry | Error |
|---|---:|---:|---:|---:|
| Complete | 573 | 867.3K recorded | 867.3K | 573 of 573 exact |
| Stale, recorded | 264 | 2.6K | 359.2K | −99.3% |
| Stale, estimated with constants only | 264 | 384.7K | 359.2K | +7.1% |
| Stale, estimated with calibration | 264 | 363.5K | 359.2K | +1.2% |
| Telemetry only (`agent_summary`) | 267 | — | 5.85K | — |

**Stale records, per request** (calibrated estimate against telemetry):

| p5 | p25 | Median | p75 | p95 | Min | Max | Token-weighted absolute error |
|---:|---:|---:|---:|---:|---:|---:|---:|
| −33.3% | −10.3% | +2.2% | +12.8% | +33.3% | −59.6% | +163.2% | 9.4% |

214 of 264 are within ±25%, and 254 within ±50%. A single request's estimate is rough, but the errors
cancel in a sum.

| Telemetry output per request | Requests | Telemetry | Calibrated | Constants only |
|---|---:|---:|---:|---:|
| under 500 | 101 | 26.6K | +2.9% | +7.4% |
| 500–2,000 | 113 | 104.3K | −5.1% | −0.4% |
| 2,000–8,000 | 45 | 169.5K | +3.5% | +9.4% |
| 8,000 and over | 5 | 58.8K | +4.9% | +13.6% |

**Known lower bounds.** No stale request's telemetry count falls below its written characters / 4. The
largest stale request, a 33.4K-character D1-build Write, has a stale record of 3 tokens; telemetry
counts 15.8K and the estimate 16.8K.

**By step kind** (estimated against telemetry; thinking is the transcript estimate, which telemetry
doesn't split out):

| Kind | Agents | Turns | Stale | Recorded | Estimated | Telemetry | Error % | Thinking (est.) | Cache read | Peak context |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| R1a | 3 | 159 | 61 | 167.8K | 257.9K | 261K | -1.2 | 160.2K | 23.4M | 312.1K |
| W1 | 3 | 55 | 4 | 222.4K | 226.1K | 225K | 0.5 | 148.1K | 6.43M | 349.5K |
| D2 | 2 | 103 | 33 | 126.3K | 165.8K | 165.2K | 0.4 | 106.2K | 20.82M | 394.6K |
| D1-build | 1 | 129 | 66 | 65.9K | 162K | 159.7K | 1.4 | 91.4K | 32.65M | 413.8K |
| V4 | 3 | 85 | 11 | 102.5K | 133.5K | 133.8K | -0.2 | 97.9K | 9.7M | 252.7K |
| R1b | 2 | 107 | 43 | 66.8K | 132.1K | 127.2K | 3.8 | 63.4K | 14.63M | 248.3K |
| D1-finish | 3 | 65 | 31 | 45.8K | 71.6K | 71.6K | 0.1 | 43.9K | 7.19M | 220.6K |
| runner | 1 | 92 | 0 | 37.9K | 37.9K | 37.9K | 0 | 7.4K | 12.57M | 196.4K |
| R1a-assemble | 1 | 12 | 7 | 16.6K | 22.3K | 23.8K | -6 | 16.6K | 745.7K | 106.5K |
| D1-gate | 1 | 17 | 4 | 12.1K | 14.3K | 14.3K | -0.2 | 6.7K | 1.06M | 95.9K |
| R1b-assemble | 1 | 7 | 1 | 5.2K | 5.9K | 5.8K | 2.6 | 2.1K | 256K | 53.1K |
| D2-gate | 1 | 6 | 3 | 0.7K | 1.4K | 1.3K | 11.4 | 0K | 160.1K | 31.5K |

**Per agent.** 12 of 22 agents went past 150K. Every agent above 10K output is within −6.0% … +6.6% of
telemetry; the outlier is D2-gate at 1.4K (+11.4%).

| Agent | Kind | Turns | Stale | Estimated | Telemetry | Error % | Cache read | Peak context |
|---|---|---:|---:|---:|---:|---:|---:|---:|
| D1-build r1-a-1 attempt 1 | D1-build | 129 | 66 | 162K | 159.7K | 1.4 | 32.65M | 413.8K |
| D2 r1-a-1 attempt 1 | D2 | 91 | 28 | 148.7K | 148.5K | 0.2 | 20.21M | 394.6K |
| W1 r1-a-1 attempt 1 | W1 | 32 | 2 | 165.4K | 164.6K | 0.5 | 4.9M | 349.5K |
| R1a researcher a (mechanics) | R1a | 69 | 29 | 114.6K | 115.4K | -0.7 | 11.86M | 312.1K |
| V4 full pass, report 1 | V4 | 37 | 5 | 71.9K | 72.5K | -0.9 | 5.24M | 252.7K |
| R1b r1-a-1 attempt 1 | R1b | 63 | 28 | 79.3K | 74.4K | 6.6 | 10.04M | 248.3K |
| R1a researcher b (items) | R1a | 60 | 19 | 85.3K | 86.8K | -1.8 | 8.7M | 240.5K |
| D1-finish r1-a-1 attempt 1 | D1-finish | 49 | 25 | 60.3K | 60.6K | -0.5 | 6.51M | 220.6K |
| main session | runner | 92 | 0 | 37.9K | 37.9K | 0 | 12.57M | 196.4K |
| V4 re-check, report 2 | V4 | 30 | 4 | 48.7K | 48.5K | 0.4 | 3.31M | 168.9K |
| R1b r1-a-2 attempt 1 | R1b | 44 | 15 | 52.8K | 52.9K | -0.1 | 4.59M | 166.8K |
| R1a researcher c (tree) | R1a | 30 | 13 | 58K | 58.8K | -1.3 | 2.85M | 153.9K |
| W1 r1-a-1 fix round | W1 | 16 | 1 | 53.7K | 53.6K | 0.2 | 1.31M | 147.1K |
| R1a-assemble round 1 | R1a-assemble | 12 | 7 | 22.3K | 23.8K | -6 | 745.7K | 106.5K |
| D1-gate r1-a-1 attempt 1 | D1-gate | 17 | 4 | 14.3K | 14.3K | -0.2 | 1.06M | 95.9K |
| V4 re-check, report 3 | V4 | 18 | 2 | 12.9K | 12.8K | 1 | 1.15M | 95.7K |
| D2 r1-a-1 fix round | D2 | 12 | 5 | 17.1K | 16.7K | 2.5 | 603.6K | 73.1K |
| D1-finish r1-a-1 fix round | D1-finish | 8 | 3 | 6.1K | 6K | 2.7 | 337K | 72.2K |
| D1-finish r1-a-1 revision | D1-finish | 8 | 3 | 5.2K | 5K | 4.7 | 343K | 67.8K |
| W1 r1-a-1 revision | W1 | 7 | 1 | 6.9K | 6.8K | 2.1 | 220.1K | 60.3K |
| R1b-assemble round 1 | R1b-assemble | 7 | 1 | 5.9K | 5.8K | 2.6 | 256K | 53.1K |
| D2-gate r1-a-1 attempt 1 | D2-gate | 6 | 3 | 1.4K | 1.3K | 11.4 | 160.1K | 31.5K |

**The cache-read gap is `agent_summary`, all of it** [V]. Telemetry exceeds the transcripts by exactly
the `agent_summary` requests:

| | Gap | `agent_summary` |
|---|---:|---:|
| Cache read | 47.88M | 47.88M |
| Uncached input | 650.8K | 650.8K |
| Cache write | 758.8K | 758.8K |
| Output | 5.85K | 5.85K |

What `agent_summary` is:
- **What it does.** In the 2.1.296 binary, a timer forks a running subagent's context to write a short
  progress summary for the UI (`[AgentSummary] Forking for summary`). The fork has `skipTranscript` set,
  so no transcript records it.
- **Its size.** 267 requests, 22 output tokens each on average, carrying contexts of up to 414K. That is
  why they read so much cache for so little output.
- **The steps behind it.** Telemetry doesn't say which subagent each summary was for, so they can't be
  assigned to steps.
- **Turning it off.** Not investigated.

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
| `api_request` | `model`, `input_tokens`, `output_tokens`, `cache_read_tokens`, `cache_creation_tokens`, `cost_usd`, `duration_ms`, `request_id` (the transcript's `requestId`), `query_source` (`repl_main_thread`, `agent:custom`, `agent_summary`), `effort`, `agent.name` (`custom` for every custom agent) |
| Identity | `user.id`, `user.email`, `user.account_uuid`, `user.account_id`, `organization.id`, `identity.*`, `terminal.type`, `session.id` |

`scripts/otlp-receiver.mjs` binds 127.0.0.1 and appends to a JSONL file. What it keeps and drops:
- It keeps only the `api_request` and `api_error` events and the token and cost metrics.
- It drops every other event unread, and never writes resource attributes.
- It drops any attribute whose key names an identity or whose value looks like an email address.

It was tested with synthetic payloads (identity keys and an email value dropped, prompts dropped, gzip
read, protobuf refused with 415) and used in the lean run.

## AC-W51

| Part | Status |
|---|---|
| Names the counter and its method | Met: `scripts/run-usage.mjs`, The counter. |
| Runs it on run A | Met: Run A. |
| Runs it on a control with known output | Met, with the lean run in place of the short protocol. The API's counts cover all 1,104 requests, and the written characters were checked as lower bounds. The short protocol (`WU-64-control.md`) stays available and wasn't run. |
| Agrees with complete usage records within 7%, or says why not | Met. Lean run: +0.35% in total, +1.2% on the stale records, +2.4% in the check. Run A: +0.2% in the check. P1: +4.0%. Per request the estimate is rough (p5–p95 ±33%), and the errors cancel in a sum. |
| Decides whether it can back a budget AC | Met: telemetry backs it, with the ledger as a cross-check and the estimate as the fallback (Decision). |
| Each agent's peak context | Met: both runs, per agent. |
