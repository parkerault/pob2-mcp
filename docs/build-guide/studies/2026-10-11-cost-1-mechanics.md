# Cost study 1: run A's cost mechanics

**Method.** Per-turn context, deduplicated by message id, sums to 305.2M. An item costs its tokens times the turns after it. Results measured 2.25 characters per token, so chars/3.5 understates by 1.55×. This explains 96–98% of each subagent.

**Where it went:** `plan.json` 59M; reference docs 42M; retained thinking 39M; system prompt and brief 37M; pob2 tool results 24M; PoB Lua Greps 17M; `compile-record.json` 11M.

## 1. Context growth

| Agent | Turns | Mean context by fifth (K) | Costliest carried items |
|---|---|---|---|
| The design step (D1), attempt 1 | 104 | 135 235 310 402 504 | own thinking 5.7M; dossier read twice 2.7M; record read whole 2.3M |
| The campaign step (D2), attempt 1 | 109 | 125 225 318 412 478 | `plan.json` read 6 times 4.2M; `plan-reference.md` 2.3M |
| A claim checker (V4), sources lens, full pass | 87 | 105 185 259 299 353 | the whole plan in 4 pages 7.4M (35%) |
| Researcher a (R1a) | 104 | 64 125 170 203 251 | 47 lookups 2.9M; `patterns.md` 1.9M |
| The skeleton step (R1b), r1-a-1 attempt 2 | 93 | 76 119 167 211 261 | `plan-reference.md` 1.9M |
| The runner | 118 | 94 127 164 235 303 | 39 waiting turns 7.9M; 63K base × 118 turns 7.5M |

**Phases:**

- **D1:** 9 reading turns took it to 152K; then serial lookups, 14 item-base and mod-tier Grep turns, four whole-plan Writes (8.7–60K characters), 7 compiles.
- **D2:** learned the checks from `check-run.mjs`, `v1.ts` and `v2.ts`; then a support-tuning loop of compiles, `suggest_supports` (15–19K characters, 5 times) and 38 Edits.
- **V4:** paged through the plan, then checked one claim per turn.
- **R1a:** 22 turns (4.7M) hunting pipeline source for the marker format.
- **Runner:** every step is launch, wait, notification.

**Why `plan.json` was re-read:**

- Read stops at 25K tokens (lines 1–755 of 2848), so agents page 700 lines at a time; the whole plan is about 92K tokens.
- Claim checks Grep an id, then Read a window around it (e.g. 1358+400, stage m). Writers re-read 5–30-line windows to anchor Edits.
- `compile_plan` returns no stage outputs, so after each compile agents Grep the record (662 output keys per stage) at 2–10K characters a hit.

## 2. Instruction causes

- **Each stage's "Read:" list names whole files.** D1's: dossier, card, skeleton plan and record, all of `plan-reference.md`, four data files, four references.
- **V4 reads all of `plan.json`** and checks "every claim … no sampling" (133 claims × 3 lenses). The record note "Read it in parts, or Grep" invites paging.
- **`SKILL.md` step 13** re-checks every claim after any recompile (`changed: "all"`). A revision, the user's changes at the final gate, re-runs the full pass.
- **Rules cited only by D-number** send agents into source code: 88 reads carrying 5.0M.

| Reference | Size | Reads | Carried |
|---|---|---|---|
| `plan-reference.md` | 45K | 22 | 11.6M |
| `patterns.md` | 40K | 4 | 5.2M |
| `V4.md` | 19K | 11 | 5.0M |
| `source-markers.md` | 8K | 19 | 3.5M |
| All references | | | ≈46M |

## 3. Output tokens

**The recorded 1.78M undercounts.** Multi-block turns can log a stale count: a 60K-character Write shows 8 tokens. Estimating thinking at 0.28 tokens per signature character and visible output at chars/2.36 gives 2.3–2.5M, within 7% of complete records.

| Kind | Output | Thinking | Write/Edit |
|---|---|---|---|
| V4 (11 runs) | 731K | 561K | 0 |
| W1, the writer (4 runs) | 489K | 305K | 38K |
| D1 | 326K | 166K | 136K |
| R1a | 311K | 206K | 70K |
| D2 | 196K | 128K | 47K |
| R1b | 174K | 105K | 47K |
| Runner | 124K | 26K | 48K |
| Total | 2.52M | 1.60M | 0.42M |

**Getting under 1M.** One pass of each step: about 1.62M. The fix round (owners fixing V4's findings), the re-checks and the revision added 0.9M. Under 1M needs no second pass, plus:

| Cut | Output |
|---|---|
| V4 checks only the claims the build hinges on (D-345), with the ledger checked mechanically | 291K → 90K |
| D1 writes the plan once, then edits it | −80K |
| W1, with the audit file generated | 210K → 120K |
| R1a, R1b and assembly, with the dossier cut to its comparison table | 614K → 400K |
| D2, with a light campaign | 160K → 90K |

Total: about 0.97M. Thinking is 63% of output, so per-step effort is the remaining knob. Enforcing the budget needs a better counter than the transcript.

## 4. Levers, ranked

| Lever | Saves | Arithmetic |
|---|---|---|
| (e) Re-check only changed claims | ≈41M | The every-claim re-check (27.3M) plus the revision's full pass (29.9M) = 57.2M. Narrow re-checks: about 2.6M per lens, so 3 × 2 × 2.6M = 15.6M. Needs a record diff. |
| (a) Narrow plan and record views | ≈37M | V4's plan 39.4M × 55% (claims 48K characters compact vs 226K paged) = 22M; other kinds' plans 19.8M × 40% = 8M; outputs from `compile_plan`: 10.6M × 70% = 7M |
| (c) Batching | ≈32M | 987 single read-only turns; packing two per turn removes 359 turns, 64M, halved for dependent calls |
| (d) Split D1 and D2 | 17–23M | Context sum ≈ N·c₀ + g·N²/2. Restart at 100–150K: D1 (306K at turn 52) 8.1–10.7M, D2 (319K at turn 54) 9.3–12.0M |
| (b) Per-stage reference excerpts | ≈18M | `plan-reference.md` 11.6M → 2.6M; `V4.md` per lens −2.7M; unused references dropped −6M |
| (f) The runner (21.9M) | ≈6.5M | V4 writes its own report −2.5M (and 35K output); `guide_run` appends the run log −1.3M; a per-step card instead of `cat` −1.8M; `SKILL.md` halved −0.9M |
| (g) Model choice | 0 tokens | Possibly not Opus: the gates (6.8M), the card and dossier assembly steps (7.3M), V4's ledger lens (21.6M), runner bookkeeping |

They overlap ((a) and (b) shrink what (c) and (d) multiply): together about 100–130M of 296M, before scope cuts. Dropping crafting (D-348) also removes the item-base and mod-tier Greps (7M).
