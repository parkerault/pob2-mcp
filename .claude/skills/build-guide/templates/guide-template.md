# <Ascendancy> / <Skill>: <concept title>

<!--
Template for guide.md, the reader layer (slice 03 section 8; D-276, D-277, D-280), written by W1
(.claude/skills/build-guide/references/stages/W1.md) with audit.md beside it (templates/audit-template.md).
It is a game guide, not a design document.
- Headings: keep the H1 (it names the roll) and the fourteen H2s below exactly, in this order, and add no other
  H2. Under Leveling, one H3 per campaign stage, titled with its loadout name exactly as compile-record.json has
  it, in plan order, and no other H3. Under each Endgame H2, the H3 Checks. What PoB can't show ends with the H3
  Known issues.
- The guide renders the plan and the record: every fact and number is one they hold, rounded as a guide rounds
  it ("about 2,740"). Advice is in the first person ("I", "my"). Each caveat appears once, where the reader acts
  on it. No markers, confidence labels, finding ids or pipeline words, and no stage ids outside loadout names.
- Not a tutorial: a sentence about how the game or PoB works stays only when it names this build's skill,
  supports, nodes, key items, an attribute or level requirement, or a plan number, and changes what the reader
  does. If it would read as true word for word in a guide for another skill on another class, cut it.
- At most 3,000 words, the H1, the import code and the Known issues list not counted. The word counts below are
  each section's budget, about 2,840 in all. Each section states its budget, as "About <n> words." in its prose
  placeholder or as a note of its own in square brackets; a Leveling H3 has at most 110.
- Ledger tables, per-loadout numbers, coverage flags, confidence levels and why this concept was picked go in
  audit.md, never here.
Replace every <placeholder>. Keep a line marked [only when ...] only when it applies, and a line marked
[optional] only where the build has it; drop the mark. Delete every line that is only a note in square brackets,
such as [About 120 words.], and this comment.
-->

## At a glance

<About 150 words. What the build does and how it kills: <Skill>, its payoff, and the item, node or support that makes it work.>

- **Pros:** <what it does well>.
- **Cons:** <what it struggles with>.
- **Difficulty:** <easy | medium | hard>, because <why>.

## Your PoB file

[About 120 words.]

Import this code in PoB2 (Import/Export Build, then Import from code):

```
<importCode, copied exactly from compile-record.json>
```

The file is `<the file name of the record's pobFile.path>`. Its loadouts, in order: <first loadout name> → <next loadout name> at <its trigger> → … → <the entering-maps loadout name> when <its trigger> → <the budget loadout name> when <its trigger> → <the non-budget loadout name> when <its trigger>. The items are stat examples: match the affixes, not the item. Engine: PoB2 <pobTag> (patch <enginePatch>); boss data <externalPatch>. <online: Prices are from the <league> league, checked <date>. | offline: Made offline, so no prices were checked.>

- [only when the league couldn't be verified] The league couldn't be verified: the trade site couldn't be reached when the endgame was priced.
- [only when compile-record.json has versionNotes] <each versionNotes line, in plain words>.
- [only when compile-record.json has loadoutWarnings] Switching loadouts can drop <the off-hand>: after you switch, check Weapon 2 and Weapon 2 Swap and re-equip it.
- [only when compile-record.json has saveWarnings] Saving the file in PoB2 drops <the options> from <the loadouts>: set them again after you save.

## Survival by stage

[About 130 words.]

<A one-line legend: solid, watch and risky against the reference hits.>

- **Acts 1–2: <solid | watch | risky>.** <the gap that matters, with its number and what closes it>.
- **Acts 3–4: <solid | watch | risky>.** <…>.
- **Interludes and Epilogue: <solid | watch | risky>.** <…>.

[one line per endgame rung, in this fixed form, word for word but the placeholders; the run checker compares each number with the record by rounding it at its own last digit (D-283). <Skill> is the named damage source and its DPS the Count-scaled headline figure; Effective HP is the stage's TotalEHP, beside max hit and never the basis of the verdict (D-294)]
- **Entering maps (L<level>): <solid|watch|risky>.** Resistances <fire>/<cold>/<lightning>/<chaos>% at −60%. Max hit <n> physical against about <hit>, and at least <n> elemental or chaos against about <hit>. <Skill> about <n> DPS. Effective HP about <n>.
- **Budget (L<level>): <solid|watch|risky>.** Resistances <fire>/<cold>/<lightning>/<chaos>% at −60%. Max hit <n> physical against about <hit>, and at least <n> elemental or chaos against about <hit>. <Skill> about <n> DPS. Effective HP about <n>.
- **Non-budget (L<level>): <solid|watch|risky>.** Resistances <fire>/<cold>/<lightning>/<chaos>% at −60%. Max hit <n> physical against about <hit>, and at least <n> elemental or chaos against about <hit>. <Skill> about <n> DPS. Effective HP about <n>.

## Gem and ascendancy timing

[About 130 words.]

| When | Change |
|---|---|
| <level, quest or trial> | <the uncut-gem step, or the trial and the ascendancy node it buys> |
| [optional] <when> | Hold: <a gem kept at a lower level, or an investment delayed>, because <why>. |
| [optional] <when> | Save: <what to stockpile before a swap>. |

## Priorities

[About 180 words.]

- **Supports:** my order is <support>, <support>, ….
- **Links and quality:** <…>.
- **Stats:** <the stat priority, in order>.
- **Weapon swap:** <the rule of thumb>.
- **When you're short:** short on <spirit | mana | an attribute>? I drop <first>, then <second> (<the record's numbers>).
- [optional] Buy <item> now; it works at <loadout name>.

## Leveling

[About 620 words in all: at most 110 words for each stage's H3.]

### <loadoutName of the first campaign stage, exactly as compile-record.json has it>

<At most 110 words. Setup: <skill> with <supports>. Tree: add <nodes>, with why. Attributes: <have> of the <need> <attribute> <gem or item> needs. Gear: <the target> [optional: , or <the fallback> D1 or D2 weighed]. Swap to the next loadout when <trigger>.>
[only when the stage has a respec] Respec: drop <the nodes> for about <gold cost> gold.
[optional] <a rotation clause, when the stage's damage is a combo>.
[optional] <the item or node> stays dormant until <loadout name or level>.

## Campaign route and rewards

[About 210 words.]

- <Act and quest>: <the reward, and what it does for this build>.
- <Act and quest, a reward choice>: take <the first line of the option the plan picks, exactly as data/campaign/progress.json lists it>; <the reason its claim gives>.
- <A currency habit that serves this build>.

## Endgame: entering maps

Move here when <the trigger>.

<About 250 words. The changes from the Epilogue, then the buy order within 5 divines:>

1. <the first buy>: <a short reason where it isn't obvious>.
2. <…>.

[optional] <a fallback D1 weighed, where one exists>.

### Checks

- [only when the stage has a chaosResistException; one line, the reason in full] Chaos resistance stays at <the record's ChaosResist>% because <the exception's reason, in full>.
- Budget: <total> divines against the 5-divine ceiling.
  [only when the total is over 5 and at most 5.5] <total> divines is near the ceiling: over 5, within the 5.5-divine tolerance.
  [only when any price is unavailable] Prices are unavailable (<why>), so this rung can't be claimed to fit 5 divines.

## Endgame: budget

Move here when <the trigger: the key item, or a rare with a stat floor>.

<About 330 words. The buy order, each step with a short reason where it isn't obvious:>

1. <…>.

| Slot | Target | Fallback |
|---|---|---|
| <slot> | <the affix targets, as text; where an affix's source limits the base, say so ("Arcane Surge on Crit is desecrated, so the gloves need energy shield")> | <the affix to give up first, or empty> |

- **Gems:** <skill> (level <n>, quality <q>) with <supports>; <the other groups>.
- **Tree:** <the keystones and notables, each with what it buys>.
- [only when the stage has a respec] **Respec from the entering-maps loadout:** drop <the nodes> for about <gold cost> gold.

### Checks

- [only when the stage has a chaosResistException; one line, the reason in full] Chaos resistance stays at <the record's ChaosResist>% because <the exception's reason, in full>.
- Budget: <total> divines against 20.
  [only when the total is over 20 and at most 22] <total> divines is near the ceiling: over 20, within the 22-divine tolerance.
  [only when any price is unavailable] Prices are unavailable (<why>), so this variant can't be claimed to be under 20 divines.
- The Arbiter of Divinity: <its hits against your max hit taken>; it takes about <low> to <high> seconds to kill.
- Mapping: <movement speed>; <clicks per pack>; <the clear skill's hit against a T15 monster's life>.

## Endgame: non-budget

Move here when <the trigger>.

<About 180 words. The upgrade order from the budget variant:> 1. <the upgrade with the most gain per divine>; 2. <…>. <Affix sources as in the budget variant.>

[only when the stage has a respec] Respec from the budget loadout: drop <the nodes> for about <gold cost> gold.

### Checks

- [only when the stage has a chaosResistException; one line, the reason in full] Chaos resistance stays at <the record's ChaosResist>% because <the exception's reason, in full>.
- Total: <total> divines against the ~200-divine reference, which is no cap.
  [only when any price is unavailable] Prices are unavailable (<why>), so this total isn't known.
- The Arbiter of Divinity: <as for the budget variant>.
- Mapping: <as for the budget variant, at areas 80 to 82>.

## How to play it

[About 170 words.]

- **Clear:** <…>.
- **Single target:** <…>.
- [only when <Skill> isn't the clear skill] <Skill> is the single-target skill because <why it can't clear>.
- [optional, up to 4, each confirmed by item text, gem text or PoB] **Trap:** <an interaction that breaks or kills the build>.

## What PoB can't show

<About 200 words. Each caveat once, by the figure it qualifies: what PoB doesn't model or assumes there, and how I read that figure.>

The headline figures assume <the plan's config they rest on: charges, stacks, counts>.

[only when the plan has a Count above 1 or a custom modifier; one line each, rendered from the plan (D-294)] <The group> counts <n> copies because <its countReason>. | <The custom modifier's effect, in plain words> stands in for <its reason>.

### Known issues

[always this H3, the last part of this section (D-276). W1 writes one plain sentence per gate finding the user accepted at an escalation, or the one line "None."; after the V4 checks the runner replaces the list with those lines and each open finding's reader sentence, or "None." (SKILL.md step 14). No ids here: each finding's id goes in audit.md's Known issues table. The list is outside the word cap.] - <What is wrong, in plain words, and what is true instead.>
[added by the runner at step 14] - <the finding's reader sentence, word for word: "The Act 1 resistance line is wrong: stage 2 already has 40% fire resistance.">

## FAQ

[About 160 words.]

- **<One of the 3–5 questions a player asks>** <The answer.>
- [optional, up to 2] **<X or Y?>** <the deciding factor, as a PoB damage or survival difference>[online: , and the price difference].

## Changelog

[About 10 words.]

- <YYYY-MM-DD>: first version (<online | offline> run).
