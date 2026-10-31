# Audit: <Ascendancy> / <Skill>, <concept title>

<!--
The form of audit.md, the audit layer (slice 03 section 7.8, as D-355 amends it). No agent fills this template:
the runner renders audit.md with scripts/render-audit.mjs after the final compile, from plan.json,
compile-record.json and the D1 gate's last verdict file, and the run checker fails an audit.md, or a guide
Checks block, that differs from the render, Known issues aside. No player is expected to read it: it keeps what
the guide leaves out. Every number is the plan's or the record's as they hold it, not rounded as the guide
rounds it. No Run notes, no hand-calculation prose, no kill time and no hits to kill (D-353). The Arbiter line
reads the rung's deciding row of measures.arbiter.rows (D-449, D-459): its one-shot row with the lowest hits
survived, else its row with the largest ratio, against the floor of references/toughness-targets.json
(arbiter.hitsSurvivedFloor, 0.8). <type> is that row's type, a mixed hit's types joined by " and " ("physical and
lightning"), the words the guide's survival label uses; <ratio> is its ratio to 2 decimals ("over a max hit of 0"
in its place when the max hit of the type is 0); <x> its hits survived rounded down to a whole percent, the clause
"; it survives <x>% of them" only when x is above 0. A record whose rows carry no hits survived keeps the two older
forms, from measures.arbiter.worst: "survives its hits; its worst, <the worst hit>, is <ratio> of your max hit" or
"one-shot by its <the worst hit>, at <ratio> of your max hit". A missing number is "—"; an Arbiter verdict the
record leaves null reads "The Arbiter of Divinity: not measured.". The budget lines (D-374): <low>–<high> is the rung's total from the D1 gate's basis.budget.totals,
each end as the gate rounds it (a whole divine at 10 or more, one decimal under 10), and "<low>" alone when the
two are equal; a total the basis leaves null reads "unknown" in place of "about <low>–<high> divines around day
<n>". "Over target:" lists the rung's over-target findings on the budget and non-budget variants, in the D1
gate's order, each as its slot (a tree jewel as "Jewel <node id>") with its own range, joined by ", "; a slot
with a fallback (the plan's price <its priceId>-fallback) adds "; fallback about <low>–<high>" inside its
parentheses, the fallback's price converted to the rung's price day at the D1 gate's market and rates and
rounded as the totals are ("; fallback price unknown" when it is unavailable). The sentence is left out when
there are none, and kept when the total is unknown but a slot is known to be over its target. <why> is each
unavailable price's note, or "no rate for <currency>", from the rung's basis slots (the anoint's among them, as
{stage, slot: "Anoint", priceId}) and the plan's prices named <stage id>-<…>, fallbacks aside: a fallback counts
in no total. In a build held to amendment 13 no Flask slot counts (flasks are unpriced, D-472), a pinned weapon's
Swap slot (sameAs) counts once, by its set-1 slot's entry (D-464), and a corrupted unique counts at its uncorrupted
price (D-471). The custom modifier lines are the record's customModsWritten, the modifier lines only: the "#"
comment lines the compile writes before them on a schema-9 plan (D-469) aren't listed.
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

| Loadout | Level | Life | Damage, map / resisting / boss | Fire / cold / lightning / chaos | Max hit, physical / least of the others | Reference hit, physical / largest of the others | Effective HP |
|---|---|---|---|---|---|---|---|
| <loadoutName> | <level> | <Life> | <on an endgame rung, the named source's damage figure against map monsters, measures.damage.map, then the same against the map enemy with 40% fire, cold and lightning resistance, measures.damage.resisting (D-454), then its boss figure against a Pinnacle boss, the plan's boss_<stage> ledger value (its current formula over the record) when it has one, else measures.damage.boss (D-437, D-447); a campaign stage keeps its one figure, the named source's Count-scaled one, MinionTotalDPS for a group that names a minion skill (D-378)> | <n>/<n>/<n>/<n>% | <n> / <n> | <on an endgame rung, its configWritten hits; — on a campaign stage> | <TotalEHP; measures.ehp on an endgame rung> |

[A record from before amendment 12, with no measures.damage.resisting, keeps two figures: `| Loadout | Level | Life | Damage, map / boss | …`. A record from before amendment 11, with no measures.damage, keeps the older column: `| Loadout | Level | Life | Named source DPS | …`, the named source's Count-scaled figure, measures.dps on an endgame rung.]

## Checks

### <the entering-maps loadout name, exactly as the record has it>

- [only when the stage has a chaosResistException; one line, the reason in full] Chaos resistance stays at <the record's ChaosResist>% because <the exception's reason, in full>.
- Budget: about <low>–<high> divines around day 7, against a 5-divine target.
  [only when any price is unavailable] Prices are unavailable (<why>), so this rung's total isn't known.
- Clear speed: <slow | medium | fast>, a rough estimate from <the clear skill>'s area. Movement speed: +<(the record's outputs.EffectiveMovementSpeedMod − 1) × 100, rounded>%.

### <the budget loadout name>

- [only when the stage has a chaosResistException; one line, the reason in full] Chaos resistance stays at <the record's ChaosResist>% because <the exception's reason, in full>.
- Budget: about <low>–<high> divines around day 7, aiming at about 5 a slot. Over target: <slot> (about <low>–<high>).
  [only when any price is unavailable] Prices are unavailable (<why>), so this rung's total isn't known.
- The Arbiter of Divinity: <survives its hits; its worst, <type> hit, is <ratio> of your max hit | survives <x>% of its <type> hits, by evading or deflecting them; a full one is <ratio> of your max hit | one-shot by its <type> hit, at <ratio> of your max hit; it survives <x>% of them>.
- Clear speed: <slow | medium | fast>, a rough estimate from <the clear skill>'s area. Movement speed: +<(the record's outputs.EffectiveMovementSpeedMod − 1) × 100, rounded>%.

### <the non-budget loadout name>

- [only when the stage has a chaosResistException; one line, the reason in full] Chaos resistance stays at <the record's ChaosResist>% because <the exception's reason, in full>.
- Budget: about <low>–<high> divines around day 21, against the 100–200 target. Over target: <slot> (about <low>–<high>).
  [only when any price is unavailable] Prices are unavailable (<why>), so this rung's total isn't known.
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
