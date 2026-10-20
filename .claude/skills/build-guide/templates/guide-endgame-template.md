# <Ascendancy> / <Skill>: <concept title>

<!--
Template for the endgame guide (amendment 9 section 8, D-414): guide.md for a build whose plan has no campaign
stage, written by W1 (.claude/skills/build-guide/references/stages/W1.md) in the build's folder; audit.md beside
it is the runner's render, unchanged. The plan decides the template: no campaign stage (every stage has a
variant), this one; else templates/guide-template.md, the full guide. It is a game guide, not a design document,
for a player who levels with any build of the class and switches to this one for maps.
- Headings: keep the H1 (it names the roll) and the twelve H2s below exactly, in this order, and add no other H2:
  At a glance, Your PoB file, Switching over, Survival by stage, Priorities, Endgame: entering maps, Endgame:
  budget, Endgame: non-budget, How to play it, What PoB can't show, FAQ, Changelog. Under each Endgame H2, the H3
  Checks, and no other H3. What PoB can't show ends with the H3 Known issues. The full guide's Leveling, Campaign
  route and rewards, and Gem and ascendancy timing are not here: Switching over replaces them.
- The guide renders the plan and the record: every fact and number is one they hold, rounded as a guide rounds
  it ("about 2,740"). Advice is in the first person ("I", "my"). Each caveat appears once, where the reader acts
  on it. No markers, confidence labels, finding ids or pipeline words, and no stage ids outside loadout names.
- Not a tutorial: a sentence about how the game or PoB works stays only when it names this build's skill,
  supports, nodes, key items, an attribute or level requirement, or a plan number, and changes what the reader
  does. If it would read as true word for word in a guide for another skill on another class, cut it.
- At most 2,300 words, the H1, the import code and the Known issues list not counted (the full guide's cap stays
  3,000). The word counts below are each section's budget, about 2,100 in all. Each section states its budget,
  as "About <n> words." in its prose placeholder or as a note of its own in square brackets.
- Your PoB file lists the three rung loadouts only: the plan has no campaign loadout.
- Switching over, about 250 words, says four things, in this order:
  - level with any build of the class (the card's Class); the build works from level <m's requirements.level in
    compile-record.json>, because of <what sets it: m's requirements.by[] in the record, an item {kind: "item",
    name, slot} by its name and slot, a gem {kind: "gem", name, group, gemLevel} by its name and gem level>;
  - the ascendancy, and the order to take its nodes: the order the plan's reason claim on m names them in (D1-finish
    writes it, D-413), with the reason it gives. W1 reads no node ids: the claim is the names' and the order's
    only source;
  - each campaign reward pick the plan makes (the rungs' config.scenario entry citing
    campaign/progress.json#q.<key>.options[<i>], the same on every rung): its quest, then the option by its first
    line exactly as data/campaign/progress.json lists it (the run checker looks for it in this section), then the
    reason its claim gives. Never list a choice's options without its pick;
  - for a respec, or a player switching from a levelling build: the PoB file holds the whole tree for each rung, so
    refund what the rung doesn't use; the gold cost isn't computed, since it depends on the tree the reader brings.
    Say that once, here.
- Ledger tables, per-loadout numbers, coverage flags and confidence levels are audit.md's, never here. audit.md
  is rendered by script (templates/audit-template.md is its form): each rung's Checks is its block there,
  copied verbatim.
- The rungs only (D-414): no act route, no quest list beyond the reward picks, no levelling gems, gear or
  tree, and no crafting: the reader buys gear on trade.
- The endgame measures are the record's: DPS, Effective HP, the Arbiter verdict and a rough clear speed. No kill
  time and no hits to kill anywhere (D-353).
- Never tell the reader to save or use Jeweller's Orbs for a skill a passive grants: they add sockets to items
  only (D-359).
Replace every <placeholder>. Keep a line marked [only when ...] only when it applies, and a line marked
[optional] only where the build has it; drop the mark. Delete every line that is only a note in square brackets,
such as [About 90 words.], and this comment.
-->

## At a glance

<About 150 words. What the build does and how it kills: <Skill>, its payoff, and the item, node or support that makes it work.>

- **Pros:** <what it does well>.
- **Cons:** <what it struggles with>.
- **Difficulty:** <easy | medium | hard>, because <why>.

## Your PoB file

[About 90 words.]

Import this code in PoB2 (Import/Export Build, then Import from code):

```
<importCode, copied exactly from compile-record.json>
```

The file is `<the file name of the record's pobFile.path>`. Its loadouts, in order: <the entering-maps loadout name> when <its trigger> → <the budget loadout name> when <its trigger> → <the non-budget loadout name> when <its trigger>. The items are stat examples: match the affixes, not the item. Engine: PoB2 <pobTag> (patch <enginePatch>); boss data <externalPatch>. <online: Prices are from the <league> league, checked <date>, <day <n> of the league | on a league day I don't know>. I estimate early endgame gear at about day 7 of a league and late endgame at about day 21[only when the day is under 21: ; these prices are from an early market, so I didn't convert them]. Trade moves a lot: re-price the build with the build-guide skill any time. | offline: Made offline, so no prices were checked.>

- [only when the league couldn't be verified] The league couldn't be verified: the trade site couldn't be reached when the endgame was priced.
- [only when compile-record.json has versionNotes] <each versionNotes line, in plain words>.
- [only when compile-record.json has loadoutWarnings] Switching loadouts can drop <the off-hand>: after you switch, check Weapon 2 and Weapon 2 Swap and re-equip it.
- [only when compile-record.json has saveWarnings] Saving the file in PoB2 drops <the options> from <the loadouts>: set them again after you save.

## Switching over

[About 250 words.]

Level with any <the card's Class> build you like: this one works from level <m's requirements.level in compile-record.json>, because <what sets it, in plain words: each item of m's requirements.by[] by its name and slot, each gem by its name and gem level>.

- **Ascendancy:** <the ascendancy>. I take its nodes in this order: <the nodes, in the order the plan's reason claim names them>, because <the reason that claim gives>.
- [one line per reward choice the plan picks, in route order] **<Act and quest>:** take <the first line of the option the plan picks, exactly as data/campaign/progress.json lists it>; <the reason its claim gives>.
- **Respeccing, or coming from a levelling build:** the PoB file holds the whole tree for each rung, so refund every point the rung you move to doesn't use, then allocate the rest. <That the gold cost isn't computed, since it depends on the tree you bring.>

## Survival by stage

[About 130 words.]

<A one-line legend: the entering-maps label is my judgment of its line against the map hits; the budget and non-budget labels are the Arbiter of Divinity's verdict.>

[one line per endgame rung, in this fixed form, word for word but the placeholders, and no campaign line (D-354); the run checker compares each number with the record by rounding it at its own last digit (D-283). The hits are the record's reference hits (configWritten). <Skill> is the named damage source and its DPS the Count-scaled headline figure; Effective HP is the stage's TotalEHP, beside max hit (D-294). The budget and non-budget label follows the record's measures.arbiter verdict (D-353): "survives the Arbiter's hits", or "one-shot by the Arbiter's <the worst hit>", the worst hit as audit.md's Checks names it]
- **Entering maps (L<level>): <solid|watch|risky>.** Resistances <fire>/<cold>/<lightning>/<chaos>% at −60%. Max hit <n> physical against about <hit>, and at least <n> elemental or chaos against about <hit>. <Skill> about <n> DPS. Effective HP about <n>.
- **Budget (L<level>): <survives the Arbiter's hits|one-shot by the Arbiter's <the worst hit>>.** Resistances <fire>/<cold>/<lightning>/<chaos>% at −60%. Max hit <n> physical against about <hit>, and at least <n> elemental or chaos against about <hit>. <Skill> about <n> DPS. Effective HP about <n>.
- **Non-budget (L<level>): <survives the Arbiter's hits|one-shot by the Arbiter's <the worst hit>>.** Resistances <fire>/<cold>/<lightning>/<chaos>% at −60%. Max hit <n> physical against about <hit>, and at least <n> elemental or chaos against about <hit>. <Skill> about <n> DPS. Effective HP about <n>.

## Priorities

[About 180 words.]

- **Supports:** my order is <support>, <support>, ….
- **Links and quality:** <…>.
- **Stats:** <the stat priority, in order>.
- **Weapon swap:** <the rule of thumb>.
- **When you're short:** short on <spirit | mana | an attribute>? I drop <first>, then <second> (<the record's numbers>).

## Endgame: entering maps

Move here when <the trigger>.

<About 250 words. What the loadout holds when you switch to it, then the buy order toward a 5-divine target:>

1. <the first buy>: <a short reason where it isn't obvious>.
2. <…>.

[only when the budget variant has an anoint; this rung has none (D-358)] If you can afford it before maps, anoint your amulet now with the budget variant's <notable> (<its three Distilled Emotions>).
[optional] <a fallback D1 weighed, where one exists>.

### Checks

[this rung's block from audit.md's Checks, copied verbatim: its chaos exception line when it has one, its budget around day 7 against a 5-divine target, its rough clear speed and movement speed]

## Endgame: budget

Move here when <the trigger: the key item, or a rare with a stat floor>.

<About 330 words. The buy order, each step with a short reason where it isn't obvious:>

1. <…>.

| Slot | Must have | Then | Fallback |
|---|---|---|---|
| <slot> | <its required affixes with their minimums, as text: what to buy; where an affix's source limits the base, say so ("Arcane Surge on Crit is desecrated, so the gloves need energy shield")> | <its other affixes, in priority order> | <only for an over-target slot: its fallback's affixes and price, the price as the Checks block's "Over target" sentence gives it (a range at the rung's price day), and that the fallback isn't measured; else empty> |

- **Gems:** <skill> (level <n>, quality <q>) with <supports>; <the other groups>.
- **Tree:** <the keystones and notables, each with what it buys>.
- **Anoint:** <the notable>, from <its three Distilled Emotions, as the record names them> (<its price, or unavailable>): <its reason, as the plan gives it>.
- [only when the stage has a respec] **Respec from the entering-maps loadout:** drop <the nodes> for about <gold cost> gold.

### Checks

[this rung's block from audit.md's Checks, copied verbatim: its chaos exception line when it has one, its budget around day 7 aiming at about 5 a slot with its over-target slots, the Arbiter of Divinity's verdict, its rough clear speed and movement speed]

## Endgame: non-budget

Move here when <the trigger>.

<About 180 words. The upgrade order from the budget variant:> 1. <the upgrade with the most gain per divine>; 2. <…>. <Affix sources as in the budget variant.>

**Anoint:** <the notable>, from <its three Distilled Emotions> (<its price, or unavailable>): <its reason, as the plan gives it>.
[only when the stage has a respec] Respec from the budget loadout: drop <the nodes> for about <gold cost> gold.

### Checks

[this rung's block from audit.md's Checks, copied verbatim: its chaos exception line when it has one, its budget around day 21 against the 100–200 target with its over-target slots, the Arbiter of Divinity's verdict, its rough clear speed and movement speed]

## How to play it

[About 170 words.]

- **Clear:** <…>.
- **Single target:** <…>.
- [only when <Skill> isn't the clear skill] <Skill> is the single-target skill because <why it can't clear>.
- [optional, up to 4, each confirmed by item text, gem text or PoB] **Trap:** <an interaction that breaks or kills the build>.

## What PoB can't show

<About 200 words. Each caveat the build hinges on, once, by the figure it qualifies: what PoB doesn't model or assumes there, and how I read that figure. No minor caveat (D-351).>

The headline figures assume <the plan's config they rest on: charges, stacks, counts>.

[only when the plan has a Count above 1 or a custom modifier; one line each, rendered from the plan (D-294)] <The group> counts <n> copies because <its countReason>. | <The custom modifier's effect, in plain words> stands in for <its reason>.

[only when a skill a passive grants holds supports; said once, here and nowhere else (D-359)] <The skill>'s support count is an estimate, as no source gives it: 3 supports below level 40, 4 from level 40 and 5 from level 60.

### Known issues

[always this H3, the last part of this section (D-276). W1 writes one plain sentence per gate finding the user accepted at an escalation, or the one line "None."; after the V4 checks the runner replaces the list with those lines and each open finding's reader sentence, or "None." (SKILL.md step 14). No ids here: each finding's id goes in audit.md's Known issues table. The list is outside the word cap.] - <What is wrong, in plain words, and what is true instead.>
[added by the runner at step 14] - <the finding's reader sentence, word for word: "The budget gloves line is wrong: Arcane Surge on Crit is a desecrated modifier, so the gloves need an energy shield base.">

## FAQ

[About 160 words.]

- **<One of the 3–5 questions a player asks>** <The answer.>
- [optional, up to 2] **<X or Y?>** <the deciding factor, as a PoB damage or survival difference>[online: , and the price difference].

## Changelog

[About 10 words.]

- <YYYY-MM-DD>: first version, endgame only (<online | offline> run).
