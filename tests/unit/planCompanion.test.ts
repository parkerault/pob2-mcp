/**
 * WU-87 (amendment 8 §4, D-402): the plan's `companion` (schema version 5), the monster-modifier table as the server
 * reads it, and the compile's pure steps for a tamed beast (`src/plan/companion.ts`). The engine's half, AC-P72, is
 * `tests/integration/compileCompanion.test.ts`.
 *
 * - Schema version 5 adds a stage's `companion {species, mods}`; versions 1 to 4 stay accepted, and there a companion is
 *   the one error at its path, naming version 5 (D-320, D-332).
 * - `mods` holds at most four ids (the Tame Beast gem's text, "Tamed Beast retains up to four monster modifiers when
 *   summoned"), each once; with the reference data, an id the table lacks, a row a tamed beast doesn't keep, and a
 *   `condition` row's option the stage lists itself are refused, at their paths. A `none` modifier is accepted.
 * - The table reader: each row's model, reach, writable lines and config option; a row the compile can't use fails,
 *   naming it.
 * - The compile's steps: a `condition` row's option is written once as earned state the Tame Beast produces; a `stats`
 *   row's lines are written as custom modifiers with a reason marking each an estimate, the ones PoB can't parse left
 *   out; the record says how each kept modifier was applied.
 */
import fs from 'fs';
import path from 'path';
import { describe, expect, it } from '@jest/globals';
import { PLAN_SCHEMA_VERSIONS, TAMED_BEAST_MOD_LIMIT, validatePlan, type PlanError, type Stage } from '../../src/plan/schema';
import os from 'os';
import { loadReferenceData } from '../../src/plan/referenceData';
import { companionLine, companionLines, MonsterModTableError, parseMonsterMods, reachOf } from '../../src/plan/monsterMods';
import {
  COMPANION_OPTIONS,
  companionCheckOf,
  companionPlanOf,
  companionPlansOf,
  companionRecordOf,
  TAME_BEAST_GEM,
  withCompanionConditions,
  withCompanionLines,
} from '../../src/plan/companion';
import { groupSets } from '../../src/plan/compiler';

type Json = Record<string, any>;

const REPO = path.resolve(__dirname, '..', '..');
const FIXTURE_TEXT = fs.readFileSync(path.join(REPO, 'tests', 'fixtures', 'plans', 'two-stage', 'plan.json'), 'utf8');
const ref = loadReferenceData();
const table = ref.monsterMods;

/** The two-stage fixture at `version`, its stage 2 holding a Tame Beast gem and, with `companion`, naming its beast. */
function withCompanion(version: number, companion?: Json): Json {
  const p = JSON.parse(FIXTURE_TEXT) as Json;
  p.schemaVersion = version;
  p.stages[1].skills.groups.push({ label: 'Beast', enabled: true, role: 'utility', gems: [{ name: TAME_BEAST_GEM, level: 10, quality: 0, enabled: true }] });
  if (companion !== undefined) p.stages[1].companion = companion;
  return p;
}

function errorsOf(input: unknown, data = ref): PlanError[] {
  const r = validatePlan(input, data);
  return r.ok ? [] : r.errors;
}

describe('D-402: schema version 5, a stage\'s companion', () => {
  it('version 5 added the companion, and versions 1 to 4 stay accepted (D-320, D-332); version 9 (amendment 13) is the current one', () => {
    expect([...PLAN_SCHEMA_VERSIONS]).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    for (const version of [3, 4, 5]) {
      const r = validatePlan(withCompanion(version), ref);
      expect({ version, ok: r.ok ? true : r.errors }).toEqual({ version, ok: true });
    }
  });

  it('accepts a companion with its species and up to four kept modifiers, a none modifier among them', () => {
    const companion = { species: 'Diretusk Boar', mods: ['hasted', 'haste-aura', 'trail-of-ice', 'temporal-bubble'] };
    expect(table.byId.get('temporal-bubble')!.model).toBe('none');
    const r = validatePlan(withCompanion(5, companion), ref);
    expect(r.ok ? r.plan.stages[1].companion : r.errors).toEqual(companion);
    // A beast that keeps no modifier the plan names.
    expect(errorsOf(withCompanion(5, { species: 'Diretusk Boar', mods: [] }))).toEqual([]);
  });

  it('a plan of version 1 to 4 naming a companion is refused by the version rule, at the companion, naming version 5', () => {
    for (const version of [1, 2, 3, 4]) {
      const p = withCompanion(version, { species: 'Diretusk Boar', mods: [] });
      if (version < 3) for (const s of p.stages) for (const c of s.claims) delete c.kind;
      expect(errorsOf(p)).toEqual([
        {
          path: 'stages[1].companion',
          message: `a stage's companion, the tamed beast (D-402) needs schemaVersion 5 or later; this plan declares schemaVersion ${version}, whose plans have no companion (D-320, D-332)`,
        },
      ]);
    }
  });

  it('the companion is strict: a non-empty species, a mods list of ids, at most four, each once', () => {
    expect(errorsOf(withCompanion(5, { species: '', mods: [] })).map((e) => e.path)).toEqual(['stages[1].companion.species']);
    expect(errorsOf(withCompanion(5, { species: 'Diretusk Boar' })).map((e) => e.path)).toEqual(['stages[1].companion.mods']);
    expect(errorsOf(withCompanion(5, { species: 'Diretusk Boar', mods: [], level: 3 })).map((e) => e.path)).toEqual(['stages[1].companion']);
    expect(errorsOf(withCompanion(5, { species: 'Diretusk Boar', mods: ['Hasted'] })).map((e) => e.path)).toEqual(['stages[1].companion.mods[0]']);
    const five = ['hasted', 'haste-aura', 'trail-of-ice', 'temporal-bubble', 'accurate'];
    expect(TAMED_BEAST_MOD_LIMIT).toBe(4);
    expect(errorsOf(withCompanion(5, { species: 'Diretusk Boar', mods: five }))).toEqual([
      { path: 'stages[1].companion.mods', message: expect.stringContaining('a tamed beast keeps up to 4 monster modifiers ("Tamed Beast retains up to four monster modifiers when summoned"') },
    ]);
    expect(errorsOf(withCompanion(5, { species: 'Diretusk Boar', mods: ['hasted', 'accurate', 'hasted'] }))).toEqual([
      { path: 'stages[1].companion.mods[2]', message: 'modifier "hasted" is already named at mods[0]' },
    ]);
  });

  it('with the reference data, an id the table lacks is refused at its path, naming the table', () => {
    expect(errorsOf(withCompanion(5, { species: 'Diretusk Boar', mods: ['hasted', 'frozen-ground-trail'] }))).toEqual([
      { path: 'stages[1].companion.mods[1]', message: '"frozen-ground-trail" is no modifier id of monsters/monster-mods.md (a "- Id:" line there, D-402)' },
    ]);
    // Without it, only the shape is checked (as for data: claims); the compile always has it.
    expect(validatePlan(withCompanion(5, { species: 'Diretusk Boar', mods: ['frozen-ground-trail'] })).ok).toBe(true);
  });

  it("a condition modifier's option is written by the compile, so the stage listing it too is refused at the listing", () => {
    const p = withCompanion(5, { species: 'Diretusk Boar', mods: ['trail-of-ice'] });
    p.stages[1].config.earned.push({
      option: 'conditionEnemyOnChilledGround',
      value: true,
      producer: { kind: 'gem', name: TAME_BEAST_GEM },
      uptime: 'test: the beast walks among them',
    });
    const at = p.stages[1].config.earned.length - 1;
    expect(errorsOf(p)).toEqual([
      {
        path: `stages[1].config.earned[${at}].option`,
        message: expect.stringMatching(/^option "conditionEnemyOnChilledGround" is written from companion\.mods\[0\], Trail of Ice \(trail-of-ice\): a condition the tamed beast supplies sets its config option \(D-402\)/),
      },
    ]);
  });

  it("a modifier the table says a tamed beast doesn't keep is refused", () => {
    const text = [
      '## Modifiers',
      '',
      '### Kept',
      '- Id: kept',
      '- Lines: none on the page (poe2db shows them only in a hover)',
      '- Tamed beast keeps it: yes',
      '- Model: none',
      '- Reach: the beast',
      '',
      '### Unkept',
      '- Id: unkept',
      '- Lines: none on the page (poe2db shows them only in a hover)',
      '- Tamed beast keeps it: no',
      '- Model: none',
      '- Reach: the beast',
    ].join('\n');
    const data = { ...ref, monsterMods: parseMonsterMods(text) };
    expect(errorsOf(withCompanion(5, { species: 'Diretusk Boar', mods: ['kept', 'unkept'] }), data)).toEqual([
      { path: 'stages[1].companion.mods[1]', message: "Unkept (unkept) is a modifier monsters/monster-mods.md says a tamed beast doesn't keep (D-402)" },
    ]);
  });
});

describe('D-402: the monster-modifier table as the server reads it', () => {
  it('the committed table loads with the reference data: every row with its id, model and, for stats and condition rows, what a plan writes', () => {
    expect(table.file).toBe('monsters/monster-mods.md');
    expect(table.mods.length).toBeGreaterThan(90);
    expect(table.byId.size).toBe(table.mods.length);
    for (const m of table.mods.filter((x) => x.model === 'stats')) {
      expect({ id: m.id, reach: m.reach, lines: m.lines.length > 0 }).toEqual({ id: m.id, reach: expect.stringMatching(/^(companion|allies)$/), lines: true });
    }
    for (const m of table.mods.filter((x) => x.model === 'condition')) expect({ id: m.id, option: m.option }).toEqual({ id: m.id, option: expect.stringMatching(/^condition\w+$/) });
  });

  it("Hasted is the beast's own and Haste Aura its allies': their lines as a plan writes them", () => {
    const hasted = table.byId.get('hasted')!;
    expect(hasted).toMatchObject({ name: 'Hasted', model: 'stats', reach: 'companion', lines: ['30% increased Movement Speed', '30% increased Attack and Cast Speed'] });
    expect(companionLines(hasted)).toEqual([
      { text: 'Companions have 30% increased Movement Speed', reaches: 'companion' },
      { text: 'Companions have 30% increased Attack and Cast Speed', reaches: 'companion' },
    ]);
    const aura = table.byId.get('haste-aura')!;
    expect(aura).toMatchObject({ model: 'stats', reach: 'allies', lines: ['20% increased Attack Speed', '20% increased Cast Speed', '10% increased Movement Speed'] });
    expect(companionLines(aura).slice(0, 2)).toEqual([
      { text: '20% increased Attack Speed', reaches: 'player' },
      { text: 'Minions have 20% increased Attack Speed', reaches: 'minions' },
    ]);
    // An internal stat id is no line a plan writes; PoB's wording of it is.
    expect(table.byId.get('extra-energy-shield')!.lines).toEqual(['Gain 25% of maximum Life as Extra maximum Energy Shield']);
    expect(table.byId.get('trail-of-ice')).toMatchObject({ model: 'condition', option: 'conditionEnemyOnChilledGround', lines: [] });
    expect(companionLines(table.byId.get('trail-of-ice')!)).toEqual([]);
  });

  it("a line PoB can't parse after `Companions have ` is written in PoB's wording for a companion; Crit Resistant has none, so it is modelled none", () => {
    expect(companionLine('Skills fire 4 additional Projectiles')).toBe('Companions have 4 additional Projectiles');
    expect(companionLine('30% increased Movement Speed')).toBe('Companions have 30% increased Movement Speed');
    const text = fs.readFileSync(path.join(REPO, 'data', 'monsters', 'monster-mods.md'), 'utf8');
    const block = (name: string) => text.slice(text.indexOf(`### ${name}\n`), text.indexOf('\n\n', text.indexOf(`### ${name}\n`))).replace(/\n  /g, ' ');
    expect(table.byId.get('additional-projectiles')).toMatchObject({ model: 'stats', lines: ['Skills fire 4 additional Projectiles'] });
    expect(block('Additional Projectiles')).toContain("PoB can't parse `Companions have Skills fire …`, so the compile writes PoB's wording, `Companions have 4 additional Projectiles`");
    expect(table.byId.get('crit-resistant')!.model).toBe('none');
    expect(block('Crit Resistant')).toContain("- Note: PoB can't take its line as `Companions have …`");
  });

  it('reach: the beast, or its allies (the player and minions); anything else is no reach a stats row can have', () => {
    expect(reachOf('the beast')).toBe('companion');
    expect(reachOf('its allies within 5 metres: the player and minions')).toBe('allies');
    expect(reachOf('its allies: the player and minions, and enemies near it')).toBe('allies');
    expect(reachOf('enemies near it')).toBeNull();
  });

  it('a row the compile cannot use fails the table, naming it', () => {
    const block = (name: string, lines: string[]) => [`### ${name}`, ...lines, ''];
    const text = [
      '## Modifiers',
      '',
      ...block('Far Stats', ['- Id: far-stats', '- Lines:', '  - "10% increased Damage"', '- Tamed beast keeps it: yes', '- Model: stats', '- Reach: enemies near it']),
      ...block('Bare Stats', ['- Id: bare-stats', '- Lines:', '  - internal stat id: some stat [3]', '- Tamed beast keeps it: yes', '- Model: stats', '- Reach: the beast']),
      ...block('Optionless', ['- Id: optionless', '- Lines: none on the page (poe2db shows them only in a hover)', '- Tamed beast keeps it: yes', '- Model: condition', '- Reach: enemies it hits']),
      ...block('Twice', ['- Id: far-stats', '- Lines: none on the page (poe2db shows them only in a hover)', '- Tamed beast keeps it: yes', '- Model: none', '- Reach: the beast']),
    ].join('\n');
    let errors: readonly string[] = [];
    try {
      parseMonsterMods(text);
    } catch (e) {
      expect(e).toBeInstanceOf(MonsterModTableError);
      errors = (e as MonsterModTableError).errors;
    }
    expect(errors).toEqual([
      'monsters/monster-mods.md: Far Stats: a stats row whose Reach "enemies near it" is neither the beast nor its allies (the player and minions)',
      'monsters/monster-mods.md: Bare Stats: a stats row with no line a plan can write',
      'monsters/monster-mods.md: Optionless: a condition row without its Config option',
      'monsters/monster-mods.md: Twice: Id "far-stats" is already used by Far Stats',
    ]);
  });
});

describe("D-402: the compile's steps for a tamed beast", () => {
  const stageOf = (companion: Json): Stage => {
    const r = validatePlan(withCompanion(5, companion), ref);
    if (!r.ok) throw new Error(JSON.stringify(r.errors));
    return r.plan.stages[1];
  };

  it('a condition modifier is written once as earned state, on, which the Tame Beast gem produces; a second row on the same option adds none', () => {
    const s = stageOf({ species: 'Diretusk Boar', mods: ['all-damage-ignites', 'trail-of-fire', 'hasted'] });
    expect(table.byId.get('all-damage-ignites')!.option).toBe(table.byId.get('trail-of-fire')!.option);
    const plan = companionPlanOf(s, table)!;
    const written = withCompanionConditions(s, plan);
    const added = written.config.earned.slice(s.config.earned.length);
    expect(added[0]).toEqual({
      option: 'conditionEnemyIgnited',
      value: true,
      producer: { kind: 'gem', name: 'Tame Beast' },
      uptime: 'while the tamed beast is out: its kept modifier All Damage Ignites supplies it (D-402, data | monsters/monster-mods.md#all-damage-ignites)',
    });
    expect(added.map((e) => e.option)).toEqual(['conditionEnemyIgnited', ...COMPANION_OPTIONS]);
    // A stage without a companion is left as it is.
    const bare = stageOf({ species: 'Diretusk Boar', mods: [] });
    expect(withCompanionConditions({ ...bare, companion: undefined }, undefined)).toEqual({ ...bare, companion: undefined });
  });

  it("compile_check reads the species, the stats lines in the plan's order and each group's enabled flag", () => {
    const s = stageOf({ species: 'Diretusk Boar', mods: ['trail-of-ice', 'hasted', 'temporal-bubble'] });
    expect(companionCheckOf(s, companionPlanOf(s, table)!)).toEqual({
      species: 'Diretusk Boar',
      lines: ['Companions have 30% increased Movement Speed', 'Companions have 30% increased Attack and Cast Speed'],
      groupsEnabled: s.skills.groups.map((g) => g.enabled),
    });
  });

  it("the lines PoB parses join the stage's custom modifiers after its own, each an estimate citing its row; the record says how each modifier was applied", () => {
    const s = stageOf({ species: 'Diretusk Boar', mods: ['hasted', 'additional-projectiles', 'trail-of-ice', 'temporal-bubble'] });
    s.config.customMods = [{ text: '+10 to Spirit', reason: 'test' }];
    const plan = companionPlanOf(s, table)!;
    // Additional Projectiles' line is PoB's wording for a companion. Here compile_check answers that Hasted's two lines
    // parse and that one doesn't, to show a line PoB can't parse left out.
    expect(plan.mods[1].lines).toEqual([{ text: 'Companions have 4 additional Projectiles', reaches: 'companion' }]);
    const check = { parsed: [true, true, false] };
    const written = withCompanionLines(s, plan, check);
    expect(written.config.customMods!.map((m) => m.text)).toEqual([
      '+10 to Spirit',
      'Companions have 30% increased Movement Speed',
      'Companions have 30% increased Attack and Cast Speed',
    ]);
    for (const m of written.config.customMods!.slice(1)) {
      expect(m.reason).toMatch(/^estimate \(D-402\): the tamed beast's kept modifier Hasted \(data \| monsters\/monster-mods\.md#hasted\), its line for the companion alone;/);
    }
    const record = companionRecordOf(
      plan,
      check,
      { group: 3, activeSkill: 1, minion: 'Diretusk Boar', minionId: 'Metadata/Monsters/GoreCharger/GoreCharger', companionReservation: 39, reservedSpirit: 47, reservedSpiritPercent: 39 },
      { outputs: { Spirit: 120 }, skillOutputs: { g3s1p1: { skill: 'Basic Attack', statSetLabel: 'Basic Attack', fields: { MinionTotalDPS: 512.5 } } } },
    );
    expect(record).toMatchObject({
      species: 'Diretusk Boar',
      monster: 'Diretusk Boar',
      key: 'g3s1p1',
      dps: 512.5,
      spirit: 120,
      speciesReservationPercent: 39,
      reservedSpiritPercent: 39,
      reservedSpirit: 47,
    });
    expect(record.mods.map((m) => [m.id, m.applied])).toEqual([
      ['hasted', 'custom-modifiers'],
      ['additional-projectiles', 'nothing'],
      ['trail-of-ice', 'config'],
      ['temporal-bubble', 'nothing'],
    ]);
    expect(record.mods[0].estimate).toBe(true);
    expect(record.mods[1].lines).toEqual([{ text: 'Companions have 4 additional Projectiles', reaches: 'companion', written: false }]);
    expect(record.mods[1].how).toMatch(/PoB can't parse "Companions have 4 additional Projectiles" whole/);
    expect(record.mods[2]).toMatchObject({ option: 'conditionEnemyOnChilledGround' });
    expect(record.mods[3].how).toMatch(/model is none/);
    // No line written: the stage is left as it is.
    expect(withCompanionLines(s, plan, { parsed: [false, false, false] })).toBe(s);
  });

  it("PoB's three companion options are written on as earned state the Tame Beast produces, unless the stage lists one itself", () => {
    expect(COMPANION_OPTIONS).toEqual(['companionInPresence', 'summonCompanionEnableBuffs', 'summonCompanionEnableCurses']);
    const s = stageOf({ species: 'Diretusk Boar', mods: [] });
    const written = withCompanionConditions(s, companionPlanOf(s, table)!).config.earned.slice(s.config.earned.length);
    expect(written).toEqual(
      COMPANION_OPTIONS.map((option) => ({
        option,
        value: true,
        producer: { kind: 'gem', name: 'Tame Beast' },
        uptime: "while the tamed beast is out (D-402): PoB's option for a companion, on by default",
      })),
    );
    // The stage's own entry wins: a beast kept out of the player's presence stays out.
    const own = stageOf({ species: 'Diretusk Boar', mods: [] });
    own.config.earned.push({ option: 'companionInPresence', value: false });
    const kept = withCompanionConditions(own, companionPlanOf(own, table)!).config.earned;
    expect(kept.filter((e) => e.option === 'companionInPresence')).toEqual([{ option: 'companionInPresence', value: false }]);
    expect(kept.slice(own.config.earned.length).map((e) => e.option)).toEqual(['summonCompanionEnableBuffs', 'summonCompanionEnableCurses']);
  });

  it("stages naming different beasts, or one and none, get separate skill sets; the same beast by name and by id shares one", () => {
    const base = stageOf({ species: 'Diretusk Boar', mods: [] });
    const make = (id: string, companion?: Json): Stage => ({ ...base, id, loadoutName: `Stage ${id} (L${base.level}) {${id}}`, companion: companion as Stage['companion'] });
    const BOAR = 'Metadata/Monsters/GoreCharger/GoreCharger';
    const stages = [
      make('x', { species: 'Diretusk Boar', mods: [] }),
      make('y', { species: BOAR, mods: [] }),
      make('z'),
      make('w', { species: 'Coconut Crab', mods: [] }),
    ];
    const beasts: Record<string, string> = { x: BOAR, y: BOAR, w: 'Metadata/Monsters/CrabMonsters/CrabCoconut' };
    const skillSets = (g: ReturnType<typeof groupSets>) => g.skill.groups.map((x) => x.stageIds);
    expect(skillSets(groupSets(stages, (id) => beasts[id]))).toEqual([['x', 'y'], ['z'], ['w']]);
    // Without the resolved beasts the species names it: a name and an id are two sets.
    expect(skillSets(groupSets(stages))).toEqual([['x'], ['y'], ['z'], ['w']]);
    // The other kinds don't look at the companion.
    expect(groupSets(stages, (id) => beasts[id]).item.groups.map((x) => x.stageIds)).toEqual([['x', 'y', 'z', 'w']]);
  });
});

describe('D-402: the monster-modifier table is read only for a plan that names a companion', () => {
  /** A copy of the committed data/ whose monster table names no modifier, so reading it fails. */
  function brokenTableData(): string {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pob2-monster-mods-'));
    fs.cpSync(path.join(REPO, 'data'), dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'monsters', 'monster-mods.md'), '# Rare monster modifiers\n\nnothing here\n');
    return dir;
  }

  it('a plan without a companion validates against data whose table is broken; one with a companion errs at it', () => {
    const dir = brokenTableData();
    try {
      const data = loadReferenceData(dir);
      expect(validatePlan(withCompanion(5), data).ok).toBe(true);
      expect(companionPlansOf(withCompanion(5).stages, data).size).toBe(0);
      expect(errorsOf(withCompanion(5, { species: 'Diretusk Boar', mods: ['hasted'] }), data)).toEqual([
        { path: 'stages[1].companion', message: expect.stringContaining("the companion's modifiers can't be checked: invalid monster-modifier table (D-402)") },
      ]);
      expect(() => companionPlansOf(withCompanion(5, { species: 'Diretusk Boar', mods: [] }).stages, data)).toThrow(MonsterModTableError);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});
