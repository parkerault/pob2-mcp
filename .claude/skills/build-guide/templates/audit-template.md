# Audit: <Ascendancy> / <Skill>, <concept title>

<!--
Template for audit.md, the audit layer (slice 03 section 7.8, D-278), written by W1 beside guide.md and patched
with Edit; the runner fills its Known issues table at step 14. No player is expected to read it: it keeps, for
the agents and the verifiers, what the guide leaves out. Keep the H1 and the six H2s below exactly, in this
order, and add no other H2. Every number is the plan's or the record's as they hold it: a ledger value to 2
decimals, not rounded as the guide rounds it. Replace every <placeholder>, keep a line marked [only when ...]
only when it applies (and drop the mark), and delete this comment.
-->

## Hand calculations

| Entry | Claim | Value | Formula, in words |
|---|---|---|---|
| `<ledger id>` | <the entry's claim> | <its value in compile-record.json's ledger, to 2 decimals> | <the formula in words, with each input's source> |

## Stage detail

| Loadout | Level | Life | <Skill> <field> | Fire / cold / lightning / chaos | Max hit, physical / least of the others |
|---|---|---|---|---|---|
| <loadoutName> | <level> | <Life> | <the rolled-skill figure> | <n>/<n>/<n>/<n>% | <n> / <n> |

- **Resistances by stage:** <each loadout's resistances at its own penalty, and where each gap closes>.
- **Reference hits:** <per endgame rung, each `hit_<stage>_<type>` ledger value, and the whole number its scenario gives PoB>.
- **Mana and leech:** <per stage, the cost and the recovery the guide's advice rests on>.
- **The Arbiter of Divinity:** <its hits against each variant's max hit taken; the time to kill under each fight-life assumption>.
- **Mapping:** <for the budget and non-budget variants: movement speed, clicks per pack, the clear skill's hit against T15 monster life>.

## What PoB doesn't model

- <each mcp__pob2__check_model_coverage flag the build rests on, its status, and how the guide handles it>.

## Inputs by confidence

- **M:** <each input or claim of confidence M, and what rests on it>.
- **L:** <each of confidence L, and what rests on it>.
- [only in an offline run] **Needs an external source** (external source unavailable in this offline run): <each claim tagged external-unavailable>.

## Run notes

- **Why this concept:** <only what run-log.json's checkpoint 1 entry that picked it records: "the user picked it at checkpoint 1"; or, for a pre-supplied or default answer, "the test config picked it at checkpoint 1 by the rule `<the entry's rule, exactly>`". No other reason>. The dossier keeps the other concepts.
- **The D1 gate's budget:** <from its verdict file's basis.budget: each gated total (entering maps, budget), or unverified and why; the non-budget total against its reference; the rates used>.

## Known issues

[W1 writes the table head and one row per gate finding the user accepted at an escalation, or the one line "None."; at step 14 the runner replaces it with those rows and one row per V4 finding open after the re-check, or "None." (SKILL.md step 14). The sentence cell is the line the guide's Known issues prints.]

| Id | Lens or gate | Stage | Sentence in the guide |
|---|---|---|---|
| <an accepted gate finding's code> | <D1-gate or D2-gate> | <its plan stage, or —> | <the sentence you wrote for it in the guide> |
| <an open V4 finding's id> | <its lens: ledger, sources or prose> | — | <its reader sentence, word for word> |
