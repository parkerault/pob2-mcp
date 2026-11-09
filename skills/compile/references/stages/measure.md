# measure: the character's measure, its callouts and the file card (`build-guide-coordinator`)

A coordinator step of `/pob2:compile` (D-519, amendment 16 §15), and of a file run's first steps (§18): the plan
`mcp__pob2__plan_from_build` read from the player's PoB file is the character as it is today, its items, groups and
tree jewels owned, with their exact rolls. You measure it under its own configuration, find what in that
configuration seems wrong, ask nothing yourself, and write what the runner shows the user. You design nothing: the
character stays as read, and you change nothing in the file's configuration (the user's answer 4: "Keep as set, but
call out anything that seems wrong to the user").

## Inputs

- **Header:** `stage: "measure"`, `attempt`, `mode`, `runFolder`, `runFolderRel`, `buildFolder: "."` (a piece run's
  files sit at the run folder's root), `compile` and `writes` (paths relative to the run folder). With `compile:
  "measure-only"` you do the whole step, and `writes` names the measure report (`<runFolder>/measure.md`), `plan.json`
  (the engagement alone) and, when the better round follows, `cards/file.md`. With `compile: "none"` you write the
  file card alone, from the plan, the record and the report the last measure left: the user asked for the better round
  after the measure. In a file run (`/pob2:build-guide` from a PoB file, §18) `writes` also names `dossier.md`.
- **Prompt:** the user's words about the character, verbatim (that it is in the campaign; what it is for), and
  whether the better round follows.
- **Read**, the independent calls in one response: `read.json` whole (what the reader left out, dropped, kept at
  another level, named legacy or unconfirmed; `grantedQuality`, `partyFilled`, `importLeague`); the read stage
  through `mcp__pob2__guide_run {view: {plan: "<runFolderRel>/plan.json", stage: "<its id>"}}` (`f`, or its rung's
  id once placed): its `level`, `skills.groups`, `skills.main`, `items.slots`, `config.file` and `config.scenario`;
  `skills/build-guide/references/toughness-targets.json` and `skills/build-guide/references/boss-floor.json`; and
  `docs/build-guide/plan-reference.md`'s `skills.engagement` row (Grep `engagement`).

## Work

1. **The engagement** (D-441; a proceed-on, §30): write the read stage's `skills.engagement {kind, reason}` into
   `plan.json` with Edit, as D1-build takes it: how close the character stands while the main skill deals its damage,
   `close` or `distance`, with the reason. By default, from the gem's tags (`mcp__pob2__lookup_game_data {mode: "gem"}`),
   a minion, totem, trap or mine, or a projectile that travels, is `distance`, and a strike, slam or area around the
   character `close`; the other kind only when the build plays otherwise, saying why. It picks the toughness target.
   Change nothing else in the plan.
2. **The measure-only compile** of the read stage under its own configuration: `mcp__pob2__compile_plan {plan_path:
   "<runFolderRel>/plan.json", measure_only: true, measure_as: "non-budget"}`. It writes `config.file` as set, fills no
   reference hit on the stage, and gives it the passes a non-budget rung gets (the Pinnacle boss pass with the Arbiter
   read, the resisting and conditioned reads, the toughness read at that rung's reference hits), each putting the
   file's configuration back after; the stage gets no variant, so V1's rung rules don't apply. Owned content passes the
   rules that would reject what the game allows; a switched buff is measured on and off (§14). A compile error ends
   the step: write it in the report and return `fail`.
3. **Read the record** through the compile's reply (each stage's key-figure line, the V1 and V2 findings) and Grep
   `compile-record.json` for what the reply lacks, never whole: `stages.<id>.measures` (damage on maps, resisting and
   on the boss; `ehp`; `toughness.lowestMaxHit`; `arbiter`; `clearSpeed`), `outputs` (the resistances,
   `Missing<Element>Resist`), `spirit` (each buff's reservation on the measured weapon set), `switches`, `owned`,
   `v2.findings` and `configEffective`.
4. **The Spirit question** (§13, §14; PG-107), only when `spirit.unreserved` is below 0 on the measured set: list
   each buff with its group and reservation, and for each buff the user might switch as needed, a proposed list of
   the groups switched off for it, the fewest buffs whose reservation makes room for it; beside them, the option to
   move a buff to the other weapon set. The runner asks it and passes the user's confirmed lists back to
   `mcp__pob2__plan_from_build` as `buffs_on` (kept on), `buffs_swap` (moved to the other weapon set) and `switch_off`
   (`{<switched buff's group>: [<its off groups>]}`, the coordinator's call at M-30, beside A.7's two): the buffs in
   neither list become switched as needed, `when: "as needed"`. Name groups by the plan's numbers, the file's
   (`read.json`'s `groups`) beside them.
5. **The callouts** (the user's answer 4), each with why, none changed: the user decides.
   - (a) **A state nothing in the build produces.** V2's `unproduced-state` callouts (`kind: "from-file"`) cover the
     inputs PoB itself gates, its "conditional with missing source". PoB gates none of the rest, so judge them
     yourself by what the build produces (its skills, supports, items and nodes, by lookup): a charge count (power,
     frenzy, endurance), an enemy condition (Chilled, Shocked, Ignited, Bleeding, Poisoned, Blinded, Intimidated,
     Hindered) and any other "is the enemy …" or "do you have …" input set on. One with no producer is an (a) callout.
   - (b) **A custom modifier line** no item or node explains; (c) **an enemy setting** other than PoB's default
     (boss tier, level, resistances, armour, evasion) that seems wrong for the character. Each only when you judge it
     wrong, with the reason; the rest of both are listed in the report only, not shown.
   - (d) **A filled party tab** (`read.json`'s `partyFilled`): the reader doesn't read it, and the measure leaves it
     out.
   - (e) **A condition or charge count held up** that the build's producers can't keep up (its uptime), with why.
   - (f) **A granted skill's gem quality** the game can't give, from `read.json`'s `grantedQuality` (§8): only wands,
     staves and sceptres give a granted skill quality.
   - (g) Anything else that seems wrong to you, with its reason.
   (a), (d) and (f) are mechanical; the rest are your judgment.
6. **The summary against the non-budget rung's targets**, the only rung that has them: the toughness band (`ehp`
   against the toughness targets' figure for the engagement: under, within or over) with the lowest max hit and
   its type beside it; the boss figure against the boss floor's; the one-shot floor (80% of the Arbiter's hits
   survived, `arbiter.hitsSurvivedFloor`); clear speed (a rough estimate). Each with its distance, as where the
   character is headed, never as a failure. Below the endgame (choice A: level under 65, or the user's word that it is
   in the campaign), say so first: the character isn't placed, and these are the endgame's targets for later.
   Uncapped resistances are stated as facts.
7. **The measure report**, `<runFolder>/measure.md` (Write): a `# Measure: <source name> (<loadout>, level <n>)` title;
   `## Headline` (the main skill's damage on maps, on 40%-resistance rares and on a Pinnacle boss; effective HP and
   the lowest max hit; life, energy shield, the resistances); `## Targets` (step 6); `## Callouts` (each shown callout
   `- (<letter>) <input>: <why>`, or `None.`); `## Listed` (the custom lines and enemy settings judged fine, one line
   each); `## Spirit` (step 4, or `Spirit fits: <unreserved> unreserved.`); `## Read` (what `read.json` left out,
   dropped or named, and the main skill's question while it is unconfirmed). Short and player-facing: numbers in whole
   figures, items by base and key affixes, skills by name.
8. **The file card**, `cards/file.md`, only when `writes` names it (§15, §17): the card format's brainstorm half
   (`skills/build-guide/templates/card-template.md`: Identity, Pitch, Chain, Enabler, the defence line, how it
   clears, the traps), written from the read plan, the record, the report and the user's words, with no verification
   half. Its name is the source's name and the main skill ("MyCharacter's Ice Strike"). It is the minimum the steps
   that read a card need when there was no brainstorm (D1, D2, W1).
9. **The dossier row**, only when `writes` names `dossier.md` (a file run, §18), so D2 and W1 find their row: write
   `dossier.md` whole, `# Dossier: <source name>`, a line `Brief: from <source name>. Mode: <offline | online>.`, then
   the verification gate's table with its nine columns (Card, Round, Status, Synergy, Damage, Pieces, Key prices,
   League, Main risk) and one row: `file`, `—`, `viable`, the card's synergy, the named source and the damage kinds PoB
   shows for it (`Twister: hit`), `—`, `—`, the league or `none (offline)`, and its main risk in a few words, no figure.

## Writes

`plan.json` (step 1's `skills.engagement` only), the measure report and, when named, `cards/file.md` and
`dossier.md`; the server writes
`compile-record.json` and `compiled-build.xml` beside the plan. Nothing in the builds folder.

## Returns

At most 8 lines: `done` or `fail`, the headline in one line, `callouts: <n> shown`, `spirit: fits` or `spirit: over by
<n>, question written`, `card: cards/file.md` when written, and `refused: <tool>` when the permission system refused a
call (D-421).

```
measure done: Ice Strike 412,000 on maps, 288,000 on the boss; EHP 18,400, lowest max hit 3,900 cold
callouts: 2 shown (a: Shocked with no shock source; f: Purity of Ice at quality 20)
spirit: over by 39, question written
card: cards/file.md
```
