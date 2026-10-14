# Audit: <Ascendancy> / <Skill>, <concept title>

<!--
The form of audit.md, the audit layer (slice 03 section 7.8, as D-355 amends it). No agent fills this template:
the runner renders audit.md with scripts/render-audit.mjs after the final compile, from plan.json,
compile-record.json and the D1 gate's last verdict file, and the run checker fails an audit.md, or a guide
Checks block, that differs from the render, Known issues aside. No player is expected to read it: it keeps what
the guide leaves out. Every number is the plan's or the record's as they hold it, not rounded as the guide
rounds it. No Run notes, no hand-calculation prose, no kill time and no hits to kill (D-353). <the worst hit> is
the record's measures.arbiter.worst: its type, a mixed hit's types joined by " and ", then "hit" ("lightning
hit", "physical and lightning hit"), the words the guide's survival label uses; <ratio> is its ratio to 2
decimals. A missing number is "—"; a total the D1 gate's basis leaves null is "unknown" in place of "<total>
divines"; an Arbiter verdict the record leaves null reads "The Arbiter of Divinity: not measured.". <why> is each
unavailable price's note, or "no rate for <currency>", from the rung's basis slots (the anoint's among them, as
{stage, slot: "Anoint", priceId}) and the plan's prices named <stage id>-<…>.
W1 copies each block under Checks, verbatim, into the guide's Checks H3 of that rung, and writes the accepted
gate findings' rows under Known issues; the runner fills that table at step 14.
-->

## Estimates

| Entry | Claim | Value | Formula |
|---|---|---|---|
| `<ledger id>` | <the entry's claim> | <its value: the plan's current formula over compile-record.json's stages, to 2 decimals (D-365)> | <the formula, as the plan holds it> |

- [only when the plan has a Count above 1] **Count:** <the group> on <the stages> counts <n> copies: <its countReason>.
- [only when the plan has a custom modifier] **Custom modifier:** `<its text>` on <the stage>: <its reason>. The figures of <each stage the record marks computedWithCustomMods> are estimates (D-296).

## Stage detail

| Loadout | Level | Life | Named source DPS | Fire / cold / lightning / chaos | Max hit, physical / least of the others | Reference hit, physical / largest of the others | Effective HP |
|---|---|---|---|---|---|---|---|
| <loadoutName> | <level> | <Life> | <the named source's Count-scaled figure; measures.dps on an endgame rung> | <n>/<n>/<n>/<n>% | <n> / <n> | <on an endgame rung, its configWritten hits; — on a campaign stage> | <TotalEHP; measures.ehp on an endgame rung> |

## Checks

### <the entering-maps loadout name, exactly as the record has it>

- [only when the stage has a chaosResistException; one line, the reason in full] Chaos resistance stays at <the record's ChaosResist>% because <the exception's reason, in full>.
- Budget: <total> divines against the 5-divine ceiling.
  [only when the total is over 5 and at most 5.5] <total> divines is near the ceiling: over 5, within the 5.5-divine tolerance.
  [only when any price is unavailable] Prices are unavailable (<why>), so this rung can't be claimed to fit 5 divines.
- Clear speed: <slow | medium | fast>, a rough estimate from <the clear skill>'s area. Movement speed: +<(the record's outputs.EffectiveMovementSpeedMod − 1) × 100, rounded>%.

### <the budget loadout name>

- [only when the stage has a chaosResistException; one line, the reason in full] Chaos resistance stays at <the record's ChaosResist>% because <the exception's reason, in full>.
- Budget: <total> divines against 20.
  [only when the total is over 20 and at most 22] <total> divines is near the ceiling: over 20, within the 22-divine tolerance.
  [only when any price is unavailable] Prices are unavailable (<why>), so this variant can't be claimed to be under 20 divines.
- The Arbiter of Divinity: <survives its hits; its worst, <the worst hit>, is <ratio> of your max hit | one-shot by its <the worst hit>, at <ratio> of your max hit>.
- Clear speed: <slow | medium | fast>, a rough estimate from <the clear skill>'s area. Movement speed: +<(the record's outputs.EffectiveMovementSpeedMod − 1) × 100, rounded>%.

### <the non-budget loadout name>

- [only when the stage has a chaosResistException; one line, the reason in full] Chaos resistance stays at <the record's ChaosResist>% because <the exception's reason, in full>.
- Total: <total> divines against the ~200-divine reference, which is no cap.
  [only when any price is unavailable] Prices are unavailable (<why>), so this total isn't known.
- The Arbiter of Divinity: <as for the budget variant>.
- Clear speed: <as for the budget variant>.

## What PoB doesn't model

- Stage <id>: <each line of its record customModsWritten, in backticks, joined by ", ">, hand-calculated as custom modifiers for effects PoB doesn't model[, so its figures are estimates (D-296): only when the record marks the stage computedWithCustomMods].
- Stage <id>: PoB warns "<each line of its record pobWarnings.kept>".
[The record's consequences of the mcp__pob2__check_model_coverage flags the build rests on; "None." when it has neither.]

## Inputs by confidence

- **M:** <each input or claim of confidence M, and what rests on it>.
- **L:** <each of confidence L, and what rests on it>.
- [only in an offline run] **Needs an external source** (external source unavailable in this offline run): <each claim tagged external-unavailable>.

## Known issues

[The render writes the one line "None.". W1 replaces it with the table head and one row per gate finding the user accepted at an escalation, when there is one; at step 14 the runner replaces it with those rows and one row per V4 finding open after the re-check, or "None." (SKILL.md step 14). The sentence cell is the line the guide's Known issues prints.]

| Id | Lens or gate | Stage | Sentence in the guide |
|---|---|---|---|
| <an accepted gate finding's code> | <D1-gate or D2-gate> | <its plan stage, or —> | <the sentence W1 wrote for it in the guide> |
| <an open V4 finding's id, v4-<n>-<k>> | V4 | — | <its reader sentence, word for word> |
