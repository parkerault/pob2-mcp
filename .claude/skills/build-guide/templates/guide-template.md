# <Ascendancy> / <Skill>: <concept title>

<!--
Template for guide.md (slice 03 section 8; the outline from the prior-art guides, external-game-data
grounding section 5), written by W1 (.claude/skills/build-guide/references/stages/W1.md).
Keep the H1 (it names the roll) and the thirteen H2 headings below exactly, in this order, and add no other
H2. Under Leveling, one H3 per campaign stage, titled with its loadout name exactly as compile-record.json
has it, in plan order, and no other H3. Under each Endgame H2, the H3 Checks. Every number comes from
compile-record.json, a ledger entry, a price entry or a C1/E1 fact, and carries its footnote marker; every
marker has exactly one definition line, under Sources, the last heading. Replace every <placeholder>, keep
a line marked [only when ...] only when it applies (and drop the marker), and delete this comment.
-->

## Versions, prices and import code

- Engine data: PoB2 <pobTag> (commit <pobCommit>), targeting game patch <enginePatch>. Prices and boss data: patch <externalPatch>.
- Date: <YYYY-MM-DD>. League: <league | none: an offline run>.
  [only when the league couldn't be verified] League: unverified: the trade site couldn't be reached when the endgame was priced, so no league was confirmed.
- Mode: <online: prices are dated trade listings | offline: prices are unavailable and no external source was consulted>.
- [only when compile-record.json has versionNotes] The engine differs from what the plan was written against: <each versionNotes line>.
- PoB file: `<the file name of the record's pobFile.path>`, in your Path of Building (PoE2) builds folder. Each guide stage is a loadout in it (switch loadouts at the top of PoB2), and the file is saved in auto-level mode at level <the highest stage's level>, so each loadout shows its stage at its own level.
- Import code (PoB2: Import/Export Build, then Import from code):

```
<importCode, copied exactly from compile-record.json>
```

- [only when compile-record.json has loadoutWarnings] Switching loadouts in PoB2 can drop an off-hand: <each loadoutWarnings line>. After you switch, check Weapon 2 and Weapon 2 Swap, and re-equip the planned off-hand if PoB2 removed it.
- [only when compile-record.json has saveWarnings] Saving the file in PoB2 drops some config options: <each saveWarnings line>. After saving, set them again in those stages' configuration.

## Summary

<The concept in two sentences: what the build does and how it kills.> <Skill> is the main damage source because <the mechanic that makes it work>.[^s1]

- **Pros:** <what it does well>.
- **Cons:** <what it struggles with>.
- **Difficulty:** <easy | medium | hard>, because <why>.
- **Why this concept:** <only what run-log.json's checkpoints[] entry that picked it records: "the user picked it at checkpoint 1"; or, for a pre-supplied or default answer, "the test config picked it by the rule `<the entry's rule, exactly>`". No other reason>. The dossier (`dossier.md`) keeps the other concepts and their results.

## How it works

<The mechanics: the skill, its stat sets, the supports, the ascendancy nodes and keystones the build rests on, each claim with its marker.>[^m1]

Hand calculations (the ledger), for what PoB doesn't model:

| Entry | Claim | Value | Formula, in words |
|---|---|---|---|
| `<ledger id>` | <the entry's claim> | <its value in compile-record.json's ledger>[^l1] | <the formula in words, with each input's source> |

## Leveling

<How to use this section: the leveling skill until <Skill>'s level requirement, then <Skill>; each stage below is a loadout in the PoB file.>

### <loadoutName of the first campaign stage, exactly as compile-record.json has it>

- **Levels:** <from> to <to>.
- **Skills:** <skill> (gem level <n>) with <supports>: <k> sockets. <the other groups the same way>
- **Tree:** add <n> points: <the nodes, in the order to take them>.
- [only when the stage has a respec] **Respec:** drop <the dropped nodes> (about <gold cost> gold).[^r1]
- **Ascendancy:** <the pick, and the trial that grants it>.
- **Gear:** <slot>: <item>, <amount currency, dated YYYY-MM-DD | unavailable (<the note>)>.[^p1]
- **Swap when:** <the trigger for the next stage>.
- **PoB numbers (this loadout):** Life <n>, <Skill> <field> <n>, resistances fire/cold/lightning/chaos <n>/<n>/<n>/<n>%.[^n1]

## Campaign rewards

<Every quest reward the campaign passes, in campaign order. A reward choice names the option to take and why: the plan's pick and its claim's reason (D-265). Never list a choice's options without the pick.>

- <quest and act>: <the reward>.[^c1]
- <quest and act, a reward choice>: take <the option the plan picks>, because <the one-line reason its claim gives>.[^c2]

## Endgame: budget variant

<What this variant is for: T15 maps (area 79) without dying often, as cheaply as possible, at most about 20 divines.>

- **Level and ascendancy:** character level <n>, <n> ascendancy points: <the nodes>.[^e1]
- [only when the stage has a respec] **Respec from the campaign:** drop <the dropped nodes> (about <gold cost> gold).[^r2]
- **Gear by slot** (each price dated, or unavailable with why):

| Slot | Item | Price |
|---|---|---|
| <slot> | <unique name, or the rare's affix targets> | <amount currency, YYYY-MM-DD, league | unavailable (<note>)>[^p2] |

- **Stat priorities:** <offence first or defence first, in order>.
- **Gem links:** <skill> (gem level <n>, quality <q>) with <supports>; <the other groups>.
- **Tree:** <the keystones and notables, and what each buys>.
- **Earned config** (what PoB assumes you keep up):

| Option | Value | Producer | Uptime |
|---|---|---|---|
| <option> | <value> | <producer kind and name> | <how it is kept up> |

### Checks

- **Survival floor**, at the Endgame −60% resistance penalty: fire <n>%, cold <n>% and lightning <n>% resistance, capped.[^f1]
  [only when the stage has no chaosResistException] Chaos resistance <n>%, capped.
  [only when the stage has a chaosResistException; one line, the reason in full] Chaos resistance stays at <the record's ChaosResist>% because <the exception's reason, in full>.
- **Max hit taken** against the waystone-scaled reference hits (T15 monster damage at the top of each waystone damage modifier's range): physical <PhysicalMaximumHitTaken> against <the hit's value in compile-record.json's ledger, not the scenario's whole number>[^h1]; fire <FireMaximumHitTaken> against <its ledger value>[^h2], and the same for cold, lightning and chaos, each with its own ledger entry's marker.
- **Budget:** <total> divines against the 20-divine ceiling: the slot and tree-jewel prices above, converted at the rates the D1 gate recorded.
  [only when the total is over 20 and at most 22] <total> divines is near the ceiling: over 20, within the 22-divine tolerance.
  [only when any price is unavailable] Prices are unavailable (<why>), so this variant can't be claimed to be under 20 divines.
- **The Arbiter of Divinity** (reported, not gated): its hits against your max hit taken, and a time to kill of <low> to <high> under the three fight-life assumptions, confidence L.[^a1]
- **Mapping signals:** movement speed <n>; clicks per pack <n>; the clear skill's hit against T15 monster life.[^k1]

## Endgame: non-budget variant

<What this variant is for: as strong as possible around the ~200-divine reference, T16 up to area 82 with heavily modded waystones.>

- **Level and ascendancy:** character level <n>, <n> ascendancy points: <the nodes>.[^e2]
- [only when the stage has a respec] **Respec from the campaign:** drop <the dropped nodes> (about <gold cost> gold).[^r3]
- **Gear by slot:**

| Slot | Item | Price |
|---|---|---|
| <slot> | <item> | <amount currency, YYYY-MM-DD, league | unavailable (<note>)>[^p3] |

- **Stat priorities**, **gem links**, **tree** and **earned config**: <as for the budget variant>.
- **Upgrade order from the budget variant:** 1. <the upgrade with the most gain per divine>; 2. <…>.

### Checks

- **Survival floor**, at the Endgame −60% resistance penalty: fire <n>%, cold <n>% and lightning <n>% resistance, capped.[^f3]
  [only when the stage has no chaosResistException] Chaos resistance <n>%, capped.
  [only when the stage has a chaosResistException; one line, the reason in full] Chaos resistance stays at <the record's ChaosResist>% because <the exception's reason, in full>.
- **Max hit taken** against the waystone-scaled reference hits (monster damage at the variant's top area level, at the top of each waystone damage modifier's range): physical <PhysicalMaximumHitTaken> against <the hit's value in compile-record.json's ledger, not the scenario's whole number>[^h3]; fire <FireMaximumHitTaken> against <its ledger value>[^h4], and the same for cold, lightning and chaos, each with its own ledger entry's marker.
- **Total:** <total> divines against the ~200-divine reference (a reference, not a cap).
  [only when any price is unavailable] Prices are unavailable (<why>), so this total isn't known.
- **The Arbiter of Divinity:** <as for the budget variant>.[^a2]
- **Mapping signals:** <as for the budget variant, at areas 80 to 82: a stated judgment>.

## Rotation

- **Clear:** 1. <step>; 2. <step>.
- **Single target:** 1. <step>; 2. <step>.
- [only when <Skill> isn't the clear skill] <Skill> is the single-target skill here because <why it can't clear>.

## Defences and resistances

<How resistances climb as the campaign penalties grow to −60%: where each gap is closed, by which item or reward.>

| Stage | Penalty | Fire | Cold | Lightning | Chaos |
|---|---|---|---|---|---|
| <loadout name> | <penalty>% | <n>% | <n>% | <n>% | <n>% |

## FAQ and common mistakes

- **<A question a newcomer asks>** <The answer.>
- **Never** <a hard warning, and why>.
- [only when compile-record.json has loadoutWarnings] **After switching loadouts in PoB2,** check Weapon 2 and Weapon 2 Swap and re-equip the planned off-hand.
- [only when compile-record.json has saveWarnings] **After saving the file in PoB2,** set the dropped options again in the stages named above.

## Confidence and what PoB can't model

- **What PoB doesn't model here** (check_model_coverage): <each line, and how the guide handles it>.
- **Hand calculations:** <the ledger entries above, and what each assumes>.
- **Medium and low-confidence inputs:** <each M or L input and the check that rests on it>.
- [only in an offline run] **Claims that need an external source** (external source unavailable in this offline run): <each>.

### Known issues

[always this H3, the last part of this section (amendment 1 Q1). W1 writes one line per gate finding the user accepted at an escalation, or the one line "None." when there is none; after the V4 checks the runner replaces the list with those lines and one line per finding they left open, or "None." (step 14). Each line is one plain sentence the reader can act on, then the finding's id in parentheses (D-265).] - <What is wrong, in plain words, and what is true instead> (<gate: D1-gate or D2-gate> <code>, stage <plan stage>).
[added by the runner at step 14] - <the finding's reader sentence, word for word: "The Act 1 resistance line is wrong: stage 2 already has 40% fire resistance."> (<V4 finding id>)

## Changelog

- <YYYY-MM-DD>: first version (<online | offline> run).

## Sources

[^s1]: pob-data | lookup_game_data gem "<Skill>" | patch: <enginePatch>
[^m1]: pob-data | lookup_game_data mechanic "<keyword>" | patch: <enginePatch>
[^l1]: ledger | <ledger id>
[^r1]: judgment | <why the respec costs about that much> | confidence: L
[^p1]: price | <priceId>
[^n1]: pob-computed | <stageId>.Life
[^c1]: data | campaign/progress.json#<progress key>.reward
[^c2]: data | campaign/progress.json#<progress key>.options[<the picked option's index>]
[^e1]: pob-computed | b.Life
[^p2]: price | <priceId>
[^f1]: pob-computed | b.MissingColdResist
[^r2]: judgment | <why the respec costs about that much> | confidence: L
[^h1]: ledger | hit_b_physical
[^h2]: ledger | hit_b_fire
[^a1]: ledger | <the Arbiter time-to-kill ledger id>
[^k1]: data | enemies/map-monsters.json#life.by-level[79]
[^e2]: pob-computed | n.Life
[^p3]: price | <priceId>
[^f3]: pob-computed | n.MissingColdResist
[^r3]: judgment | <why the respec costs about that much> | confidence: L
[^h3]: ledger | hit_n_physical
[^h4]: ledger | hit_n_fire
[^a2]: ledger | <the Arbiter time-to-kill ledger id>
