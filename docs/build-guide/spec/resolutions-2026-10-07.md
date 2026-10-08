# Coordinator resolutions of the slice writers' open items (2026-10-07)

These are binding. The spec fix pass folds them into the spine and slices, then this file can be deleted.
Item S3-4 is flagged to the user as a game-knowledge choice.

## Slice 3, pipeline

- **S3-1. C-36's wording.**
  - Lookups (`read`-kind tools) may be called by the R1a research agents and the V4 agent.
  - Engine-mutating calls and all trade calls are made only by the coordinator.
  - C-36 is corrected to match D-130.
- **S3-2. Offline V4 and the data files.** Offline, V4 checks a claim derived from C1/E1 against the
  data-file entry and the citation stored there, using the tag `data:<file>#<key>`. Fetching the
  external URL is not required offline.
- **S3-3. Offline league.** The plan's `league` may be null only when every price is
  `unavailable (offline run)`. The schema enforces this conditionally.
- **S3-4. Survival floor resistances.** The gate is fire, cold and lightning resistance at their caps.
  Chaos resistance is reported, not gated. PROPOSED, and flagged to the user.
- **S3-5. The concept cap.** The 3-concept cap applies per research round. "Ask for more" starts a new
  round of up to 3 concepts. Only the user can start one, never automatically, and the run log records
  every round.
- **S3-6. Revisions and escalation.**
  - At checkpoint 2 the user may ask for changes. The coordinator maps each request to the stage
    responsible, re-runs it and every later stage, and re-runs the checks.
  - User-requested revisions don't count against the retry cap, but the run log records them.
  - When retries are exhausted, the escalation offers four choices:
    1. accept, with the failure stated in the guide;
    2. give guidance and retry once more;
    3. go back to checkpoint 1;
    4. stop.
- **S3-7. Price claim tags.** A price claim uses `price:<entry-id>`, pointing to the plan's price entry,
  which holds the date, league and query.
- **S3-8. An invalid roll.** Before any agent runs, the skill checks that:
  - the ascendancy exists (`get_classes`);
  - the main skill is an active skill gem (gem lookup).

  If either check fails, it stops and lists the closest valid names. No run folder is created.

## Slice 2, plan and compiler

- **S2-1. The compile spike's pass mark (HG-13's margin).**
  - Every per-stage engine request finishes in under 20 s, a third under `POB_TIMEOUT_MS`.
  - A 15-stage plan compiles in at most 100 s in total.

  A miss is HG-13.
- **S2-2. Neutral defaults.** C-32's scenario inputs gain a "baseline" subclass: default-on options that
  model a neutral state, such as full life or mana.
  - Such an option may stay at its default only if it is listed, with a one-line rationale, in the
    committed `data/config-baseline.json`.
  - The default audit accepts listed options.
  - Any other default-on option must be justified or set explicitly.
- **S2-3. Spirit gem availability isn't grounded.** V1 only notes it, and it is recorded as an
  assumption. Accepted.
- **S2-4. Respec gold costs aren't sourced.** They carry judgment tags. Accepted.
- **S2-5. D-156 is amended.** A compile call makes one engine request per stage, plus at most one
  read-only preflight request.

## Slice 1, server tools

- **S1-1. The spine's C-2/C-5 row is a modified contract.** It lists the additive params and reply
  fields on existing Lua actions:
  - `search_nodes`;
  - `get_stats`, including its additive reply field;
  - `set_level`;
  - `set_tree`;
  - `set_main_selection`, whose `skillPart` becomes `statSet`. No external caller uses `skillPart`;
  - `update_tree_delta`'s reply.

  Backward compatibility: every change is additive except the `skillPart` → `statSet` rename, which is
  internal.
- **S1-2. Jewel slots.** They go into `add_item`'s enum only, and AC-E38 is unchanged. Accepted.
- **S1-3. Pricing (C-49) gets no batch mode.** Each call prices one item, and the limiter does the
  pacing. Accepted.
- **S1-4. Lookup result limits.** The default is 20, capped at 30. Accepted.
- **S1-5. The "possibly unread" heuristic** follows S-b's by-name scan. Accepted.
- **S1-6. `include_ascendancy`.** Notables beyond the build's remaining ascendancy points are marked,
  not hidden.
- **S1-7. Gem info (C-37)** gains the gem's level requirement per level and its attribute requirements,
  which the D2 and V1 work needs.
