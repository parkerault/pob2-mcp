/**
 * Amendment 16's M-30, WU-161 (§13 to §15, D-518, D-519's compile part, C-41), the units behind the engine rows of
 * `tests/integration/compileReadPlan.test.ts`: the compile on a read plan, over the importer fixture's read plan as
 * `plan_from_build` writes it (`tests/fixtures/builds/imported-character.xml`, read in process with no engine).
 *
 * - AC-W151: `config.file` is written as set (the listed options leave out every input it sets, and the stage gets no
 *   reference hit); V2's findings on it are callouts (`kind: 'from-file'`) and never fail its verdict, a scenario entry
 *   citing the read's copy of the file isn't resolved against the data, and each file input is listed (class `file`);
 *   `measure_as` gives a read stage the non-budget rung's passes (the boss pass with the Arbiter read, the resisting and
 *   conditioned reads, the toughness read at the rung's reference hits) with no variant, and `compile_plan` takes it only
 *   measure-only; owned content (an item, tree jewel or group marked `owned`) passes V1's `sockets`, `affix-cap`,
 *   `corruption` and `movement-tier`, and the same content without the mark fails them as today; the record's `owned`.
 * - AC-W152: each switched group is written disabled and marked `switched` for the recount, and measured once more with
 *   its `off` groups off, on its own weapon set or the stage's (set 2 on a stage measured on set 2); V1 reports
 *   `switched-spirit` for a switch that leaves Spirit below 0 and nothing for one that fits; a stage without `switch`
 *   gets none of the new parameters.
 * - The checker (AC-W151's "no checker failure for owned content"): in a compile or pricing run, owned content passes
 *   `runes`, `corruption`, both parts of `flasks`, `rare-title`, and pricing's `spec` and `listing`; unmarked, or in a run
 *   of another piece, it fails them as today.
 */
import { spawnSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import { readerLayout, textOf, type Json, type ReaderLayout } from '../helpers/planFromBuild';
import { TEST_NOW } from '../helpers/runningDigests';
import {
  checkAffixCap,
  checkCorruption,
  checkMovementTier,
  checkSockets,
  checkSwitchedSpirit,
  checkV1,
  ownedAt,
} from '../../src/plan/checks/v1';
import { checkV2, READ_SOURCE_FILE } from '../../src/plan/checks/v2';
import { FactReader } from '../../src/plan/checks/facts';
import {
  checkStageOf,
  fileStageHits,
  measuredRung,
  measuredWithCustomMods,
  ownedSlots,
  referenceHits,
  stageConfig,
  stageParams,
  switchesOf,
  withReferenceHits,
  writtenConfig,
} from '../../src/plan/compiler';
import { compileRequestOf } from '../../src/handlers/planHandlers';
import { loadReferenceData } from '../../src/plan/referenceData';
import { validatePlan, type Stage } from '../../src/plan/schema';
import type { StageChecks } from '../../src/engine/schemas';
import type { Finding } from '../../src/plan/record';

const REPO = path.resolve(__dirname, '..', '..');
const ref = loadReferenceData(path.join(REPO, 'data'));
const REFS = { item: { title: 'i' }, skill: { title: 's' }, config: { title: 'c' } };
const MEASURE = { arbiterAccuracy: 2357, resist: 40 };

/** V1's inputs for a stage that holds nothing beyond its plan. */
function checksOf(over: Partial<StageChecks> = {}): StageChecks {
  return {
    counts: { used: 0, ascendancy: 0, secondaryAscendancy: 0, sockets: 0, weaponSet1: 0, weaponSet2: 0 },
    extraPoints: 0,
    passivePointsToWeaponSetPoints: 0,
    attributes: { Str: 500, Dex: 500, Int: 500, ReqStr: 0, ReqDex: 0, ReqInt: 0 },
    requirementSources: {},
    gems: [],
    items: [],
    warnings: [],
    nodeNames: [],
    activeSkills: [],
    config: { input: {}, placeholder: {} },
    shownOptions: [],
    grantedSkills: [],
    ...over,
  } as StageChecks;
}

const valid = (plan: Json): Stage[] => {
  const r = validatePlan(JSON.stringify(plan), ref);
  if (!r.ok) throw new Error(JSON.stringify(r.errors));
  return r.plan.stages;
};
const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;
/** The plan with every owned mark taken off its slots, tree jewels and groups (a design's content). */
function unmarked(plan: Json): Json {
  const p = clone(plan);
  for (const s of p.stages) {
    for (const x of [...s.items.slots, ...s.items.treeJewels, ...s.skills.groups]) delete x.owned;
  }
  return p;
}
/** The read stage placed on the non-budget rung (§16): its rung's id and variant fields. */
function placed(plan: Json): Json {
  const p = clone(plan);
  const j = { kind: 'judgment', ref: 'placed', confidence: 'M' };
  Object.assign(p.stages[0], { id: 'n', loadoutName: p.stages[0].loadoutName.replace('{f}', '{n}'), variant: 'non-budget', ascendancyPoints: 8, variantBasis: { level: j, gemLevels: j, ascendancyPoints: j } });
  return p;
}

describe('WU-161 (AC-W151, AC-W152): the compile on a read plan, as pure functions', () => {
  let L: ReaderLayout;
  let plan: Json;
  let switched: Json;
  let stage: Stage;

  beforeAll(async () => {
    L = await readerLayout();
    const rel = L.run();
    const r = await L.call({ run_folder: rel, build_name: 'imported-character' });
    if (r.isError) throw new Error(textOf(r));
    plan = L.json(rel, 'plan.json');
    stage = valid(plan)[0];
    const rel2 = L.run();
    if ((await L.call({ run_folder: rel2, build_name: 'imported-character' })).isError) throw new Error('read');
    const r2 = await L.call({ run_folder: rel2, main_group: 4, buffs_on: [3, 5, 6], switch_off: { 9: [5] } });
    if (r2.isError) throw new Error(textOf(r2));
    switched = L.json(rel2, 'plan.json');
  }, 120_000);

  afterAll(async () => L?.close());

  describe("AC-W151: config.file is written as set", () => {
    it("the read stage's file inputs, enemyIsBoss among them, leave the listed options: the file's input is the one written", () => {
      expect(stage.config.file).toMatchObject({ enemyIsBoss: 'Boss', enemyLevel: 84, windDancerStacks: 3 });
      expect(stage.config.scenario.map((e) => e.option)).toEqual(['enemyIsBoss']);
      expect(stageConfig(stage)).toEqual({});
      expect(writtenConfig(stage)).toEqual(stage.config.file);
      // A scenario value the file overrides never reaches the config set: the file's wins.
      const p = clone(plan);
      p.stages[0].config.scenario[0].value = 'None';
      expect(writtenConfig(valid(p)[0]).enemyIsBoss).toBe('Boss');
      // The file's custom modifiers mark the stage's figures (D-321).
      expect(measuredWithCustomMods(stage)).toBe(true);
    });

    it('no reference hit is filled on its stage, though a card skeleton of its shape gets the budget rung\'s', () => {
      expect(withReferenceHits(stage, ref)).toBe(stage);
      const skeleton = clone(plan);
      delete skeleton.stages[0].config.file;
      delete skeleton.stages[0].source;
      const filled = withReferenceHits(valid(skeleton)[0], ref);
      expect(filled.config.scenario.map((e) => e.option)).toEqual(['enemyIsBoss', 'enemyPhysicalDamage', 'enemyFireDamage', 'enemyColdDamage', 'enemyLightningDamage', 'enemyChaosDamage']);
    });

    it('compile_check checks only the listed options; compile_stage gets the file inputs as fileConfig, after them', () => {
      expect(checkStageOf(stage, undefined, 0, 11).config).toEqual([]);
      const params = stageParams(stage, true, REFS, [], undefined, undefined, {}, MEASURE, 11);
      expect(params.config).toEqual({});
      expect(params.fileConfig).toEqual(stage.config.file);
    });

    it("V2's findings on a file's configuration are callouts (from-file): its verdict passes, each input is listed as the file's", () => {
      // The flask and charm the stage's toggles name are equipped, as compile_stage reports them.
      const items = ['Flask 1', 'Charm 1'].map((slot) => ({ slot, name: slot, baseName: slot, levelRequirement: 0, active: true }));
      const checks = checksOf({ items, config: { input: {}, placeholder: { enemyArmour: 6011 } } });
      const defaults = {
        enemyIsBoss: { type: 'list', apply: true, conditional: false, default: 'Pinnacle', first: 'None' },
        enemyArmour: { type: 'countAllowZero', apply: true, conditional: false },
        enemyLevel: { type: 'count', apply: true, conditional: false },
      };
      const baseline = { schemaVersion: 1 as const, options: {} };
      const v2 = checkV2({ stage, checks, producers: new Map(), defaults, baseline, ref });
      expect(v2.verdict.findings.map((f) => [f.code, f.kind])).toEqual([['default-unlisted', 'from-file']]);
      expect(v2.verdict.pass).toBe(true);
      expect(v2.configEffective.enemyIsBoss).toEqual({ value: 'Boss', origin: 'explicit', class: 'file' });
      expect(v2.configEffective.enemyLevel).toEqual({ value: 84, origin: 'explicit', class: 'file' });
      // The scenario's source is the read's copy of the file: not a C1/E1 fact, and not a finding.
      expect(stage.config.scenario[0].source.file).toBe(READ_SOURCE_FILE);
      expect(v2.verdict.findings.some((f) => f.code === 'source-unresolved')).toBe(false);
      // The same stage without config.file is held to V2 as today: its findings fail the verdict, the source unresolved.
      const plain = clone(plan);
      delete plain.stages[0].config.file;
      const today = checkV2({ stage: valid(plain)[0], checks, producers: new Map(), defaults, baseline, ref });
      expect(today.verdict.pass).toBe(false);
      expect(today.verdict.findings.map((f) => f.code).sort()).toEqual(['default-unlisted', 'source-unresolved']);
      expect(today.verdict.findings.every((f) => f.kind === undefined)).toBe(true);
    });
  });

  describe('AC-W151: measure_as, a read stage measured as the non-budget rung with no variant', () => {
    it('the read stage takes measure_as as its rung; a stage with a variant keeps its own, and any other stage none', () => {
      expect(stage.variant).toBeUndefined();
      expect(measuredRung(stage, 'non-budget')).toBe('non-budget');
      expect(measuredRung(stage, undefined)).toBeUndefined();
      expect(measuredRung(valid(placed(plan))[0], undefined)).toBe('non-budget');
      const notRead = clone(plan);
      delete notRead.stages[0].source;
      expect(measuredRung(valid(notRead)[0], 'non-budget')).toBeUndefined();
    });

    it("compile_stage gets the rung's passes: the boss pass with the Arbiter read, the resisting and conditioned reads, and the rung's reference hits for the toughness read", () => {
      const rung = measuredRung(stage, 'non-budget');
      const hits = fileStageHits(stage, rung, ref)!;
      expect(hits).toEqual(Object.fromEntries(referenceHits('non-budget', ref).map((e) => [e.option, e.value])));
      const params = stageParams(stage, true, REFS, [], undefined, undefined, {}, MEASURE, 11, { rung, referenceHits: hits });
      expect(params.boss).toMatchObject({ groups: [stage.skills.main.group], arbiter: { accuracy: MEASURE.arbiterAccuracy } });
      expect(params.resisting).toMatchObject({ groups: [stage.skills.main.group], resist: MEASURE.resist });
      expect(params.conditioned).toBe(true);
      expect(params.referenceHits).toEqual(hits);
      expect(params.spiritBuffs).toBe(true);
      // Without measure_as the read stage is a card skeleton's shape: none of the rung's passes.
      const bare = stageParams(stage, true, REFS, [], undefined, undefined, {}, MEASURE, 11);
      for (const k of ['boss', 'resisting', 'conditioned', 'referenceHits']) expect(bare).not.toHaveProperty(k);
      expect(fileStageHits(stage, undefined, ref)).toBeUndefined();
    });

    it('compile_plan takes measure_as "non-budget" with measure_only only, refusing every other value', () => {
      expect(compileRequestOf({ plan_path: 'compile/2026-12-01-1/plan.json', measure_only: true, measure_as: 'non-budget' })).toEqual({
        mode: 'measure-only',
        planPath: 'compile/2026-12-01-1/plan.json',
        measureAs: 'non-budget',
      });
      expect(() => compileRequestOf({ plan_path: 'p/2026-12-01-1/plan.json', build_name: 'x', measure_as: 'non-budget' })).toThrow(/measure_as needs measure_only: true/);
      expect(() => compileRequestOf({ plan_path: 'p/2026-12-01-1/plan.json', measure_only: true, measure_as: 'budget' })).toThrow(/measure_as must be "non-budget"/);
      expect(() => compileRequestOf({ plan_path: 'p/2026-12-01-1/plan.json', draft_name: 'x', measure_as: 'non-budget' })).toThrow(/conflict/);
    });
  });

  describe('AC-W151: owned content passes the rules that would reject what the game allows', () => {
    it("the record's owned lists every owned slot, then each owned tree jewel; a design's stage has none", () => {
      expect(ownedSlots(stage)).toEqual([...stage.items.slots.map((s) => s.slot), ...stage.items.treeJewels.map((j) => `Jewel ${j.node}`)]);
      expect(ownedSlots(valid(unmarked(plan))[0])).toBeUndefined();
      expect(ownedAt(stage, 'Body Armour')).toBe(true);
      expect(ownedAt(stage, `Jewel ${stage.items.treeJewels[0].node}`)).toBe(true);
      expect(ownedAt(valid(unmarked(plan))[0], 'Body Armour')).toBe(false);
      // compile_check and compile_stage are told what is owned.
      const check = checkStageOf(stage, undefined, 0, 11);
      expect(check.items.every((it) => it.owned === true)).toBe(true);
      expect(check.groups.every((g) => g.owned === true)).toBe(true);
      expect(check.jewels.every((j) => j.owned === true)).toBe(true);
      expect(stageParams(stage, true, REFS, [], undefined, undefined, {}, MEASURE, 11).items.every((it) => it.owned === true)).toBe(true);
      const plainCheck = checkStageOf(valid(unmarked(plan))[0], undefined, 0, 11);
      expect(plainCheck.items.some((it) => 'owned' in it) || plainCheck.groups.some((g) => 'owned' in g)).toBe(false);
    });

    /** The owned body armour's checks as compile_stage gives them: a corrupted rare with three sockets and a line over its cap. */
    const body: StageChecks['items'][number] = {
      slot: 'Body Armour', name: 'Loath Ward, Slipstrike Vest', title: 'Loath Ward', baseName: 'Slipstrike Vest', baseType: 'Body Armour', levelRequirement: 70,
      rarity: 'RARE', sockets: 3, runes: 3, corrupted: true,
      affixes: {
        prefixLimit: 3, suffixLimit: 3,
        lines: [{ text: '+92 to maximum Life', template: '+# to maximum Life', values: [92], lows: [92], groups: [{ key: 'Prefix:IncreasedLife', type: 'Prefix', group: 'IncreasedLife', tiers: [{ level: 80, max: [80], writes: ['+# to maximum Life'] }] }] }],
      },
    } as StageChecks['items'][number];
    const boots: StageChecks['items'][number] = { slot: 'Boots', name: 'Gale Stride, Lizardscale Boots', baseName: 'Lizardscale Boots', baseType: 'Boots', levelRequirement: 0, rarity: 'RARE', movementSpeed: 30 } as StageChecks['items'][number];
    const twister: StageChecks['gems'][number] = { group: 4, index: 1, name: 'Twister', level: 20, tier: 20, kind: 'skill', levelRequirement: 0 } as StageChecks['gems'][number];

    function run(s: Stage, fn: (findings: Finding[], notes: Finding[], facts: FactReader) => void): string[] {
      const findings: Finding[] = [];
      fn(findings, [], new FactReader(ref));
      return findings.map((f) => f.code);
    }

    it('sockets: the corrupted rare\'s three sockets pass owned and fail unmarked', () => {
      const s = valid(placed(plan))[0];
      expect(run(s, (f, _n, facts) => checkSockets(s, { items: [body] }, facts, f))).toEqual([]);
      const u = valid(unmarked(placed(plan)))[0];
      expect(run(u, (f, _n, facts) => checkSockets(u, { items: [body] }, facts, f))).toEqual(['sockets']);
    });

    it('affix-cap: an owned line over the base\'s best passes; unmarked it fails as today', () => {
      const s = valid(placed(plan))[0];
      expect(run(s, (f, n, facts) => checkAffixCap(s, { items: [body] }, facts, f, n))).toEqual([]);
      const u = valid(unmarked(placed(plan)))[0];
      expect(run(u, (f, n, facts) => checkAffixCap(u, { items: [body] }, facts, f, n))).toEqual(['affix-cap']);
    });

    it("corruption: the owned Twister corrupted to +1 level passes on the read stage; unmarked it fails, the read stage being no finishing rung", () => {
      expect(stage.skills.groups[3].gems[0]).toMatchObject({ name: 'Twister', corrupt: 'plus_one_level' });
      expect(run(stage, (f) => checkCorruption(stage, { gems: [twister] }, f))).toEqual([]);
      const u = valid(unmarked(plan))[0];
      expect(run(u, (f) => checkCorruption(u, { gems: [twister] }, f))).toEqual(['corruption']);
    });

    it("movement-tier: the owned 30% boots pass on the placed non-budget rung; unmarked they are under its 35% tier", () => {
      const tiers = [{ value: 30, itemLevel: 65 }, { value: 35, itemLevel: 82 }];
      const s = valid(placed(plan))[0];
      const input = { schemaVersion: 11, movementTiers: tiers, travel: null };
      expect(run(s, (f, n, facts) => checkMovementTier(s, { items: [boots] }, input, facts, f, n))).toEqual([]);
      const u = valid(unmarked(placed(plan)))[0];
      expect(run(u, (f, n, facts) => checkMovementTier(u, { items: [boots] }, input, facts, f, n))).toEqual(['movement-tier']);
    });

    it('through checkV1: the owned stage has none of the four codes, the unmarked one each', () => {
      const four = ['sockets', 'affix-cap', 'corruption', 'movement-tier'];
      const v1 = (s: Stage) =>
        checkV1({ stage: s, predecessor: null, checks: checksOf({ items: [body, boots], gems: [twister] }), ref, schemaVersion: 11, movementTiers: [{ value: 35, itemLevel: 82 }] })
          .verdict.findings.map((f) => f.code)
          .filter((c) => four.includes(c));
      expect(v1(valid(placed(plan))[0])).toEqual([]);
      // Placed, the corrupted gem is on a finishing rung; on the read stage, unmarked, it is the rung rule's, and the read
      // stage, with no rung, has no item level to cap a line at (its affixes are counted) nor a movement-speed tier.
      expect(v1(valid(unmarked(placed(plan)))[0]).sort()).toEqual(['affix-cap', 'movement-tier', 'sockets']);
      expect(v1(valid(unmarked(plan))[0]).sort()).toEqual(['corruption', 'sockets']);
    });
  });

  describe('AC-W152: switched buffs', () => {
    it('each switched group is written disabled and marked for the recount, and measured with its off groups off on the set the stage is measured on', () => {
      const s = valid(switched)[0];
      const groups = s.skills.groups.flatMap((g, k) => (g.switch ? [k + 1] : []));
      expect(groups).toEqual([2, 7, 9, 10]);
      const params = stageParams(s, true, REFS, [], undefined, undefined, {}, MEASURE, 11);
      expect(params.groups.flatMap((g, k) => (g.switched === true ? [{ group: k + 1, enabled: g.enabled }] : []))).toEqual(groups.map((group) => ({ group, enabled: false })));
      expect(params.switches).toEqual([
        { group: 2, off: [], set: 1 },
        { group: 7, off: [], set: 1 },
        { group: 9, off: [5], set: 1 },
        { group: 10, off: [], set: 1 },
      ]);
      // On a stage measured on weapon set 2, a switch is measured there; a group on its own set keeps it.
      const two = clone(switched);
      two.stages[0].items.useSecondWeaponSet = true;
      two.stages[0].skills.groups[6].weaponSet = 1;
      expect(switchesOf(valid(two)[0]).map((x) => [x.group, x.set])).toEqual([[2, 2], [7, 1], [9, 2], [10, 2]]);
    });

    it('a stage without switch gets none of the new parameters: its compile_stage request is as before', () => {
      const plain = clone(plan);
      delete plain.stages[0].source;
      delete plain.stages[0].config.file;
      for (const x of [...plain.stages[0].items.slots, ...plain.stages[0].items.treeJewels, ...plain.stages[0].skills.groups]) delete x.owned;
      const params = stageParams(valid(plain)[0], true, REFS, [], undefined, undefined, {}, MEASURE, 11);
      for (const k of ['switches', 'fileConfig', 'referenceHits', 'spiritBuffs', 'boss', 'resisting', 'conditioned']) expect(params).not.toHaveProperty(k);
      expect(params.groups.some((g) => 'switched' in g)).toBe(false);
      expect(params.items.some((it) => 'owned' in it)).toBe(false);
    });

    it('switched-spirit: a switch that leaves unreserved Spirit below 0 is a finding naming its group and off list; one that fits is none', () => {
      const s = valid(switched)[0];
      const findings: Finding[] = [];
      checkSwitchedSpirit(s, [
        { group: 7, off: [], set: 2, spiritUnreserved: -6, keyFigures: {} },
        { group: 9, off: [5], set: 2, spiritUnreserved: 70, keyFigures: {} },
        { group: 10, off: [], set: 2, spiritUnreserved: 0, keyFigures: {} },
      ], findings);
      expect(findings.map((f) => [f.code, f.data])).toEqual([
        ['switched-spirit', { group: 7, off: [], set: 2, spiritUnreserved: -6, path: 'skills.groups[6].switch' }],
      ]);
      expect(findings[0].message).toContain('skill group 7 (Blasphemy) is switched on as needed, but with it on and nothing switched off for it, PoB measures -6 unreserved Spirit on weapon set 2');
      const off: Finding[] = [];
      checkSwitchedSpirit(s, [{ group: 9, off: [5], set: 1, spiritUnreserved: -30, keyFigures: {} }], off);
      expect(off[0].message).toContain('group 5 (Herald of Ice) switched off for it');
      const none: Finding[] = [];
      checkSwitchedSpirit(s, undefined, none);
      expect(none).toEqual([]);
    });
  });
});

// ---------------------------------------------------------------------------------------------------
// The checker: owned content in a compile or pricing run (D-519)
// ---------------------------------------------------------------------------------------------------

const PIECES = path.join(REPO, 'tests', 'fixtures', 'pieces');
const CHECKER = path.join(REPO, 'skills', 'build-guide', 'scripts', 'check-run.mjs');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'read-plan-checker-'));
afterAll(() => fs.rmSync(TMP, { recursive: true, force: true }));
const RULES = ['runes', 'corruption', 'flasks', 'rare-title', 'spec', 'listing'];

/** The rules of `RULES` the checker reports on a run folder. */
function ownedRules(dir: string): string[] {
  const r = spawnSync(process.execPath, [CHECKER, dir], { cwd: TMP, env: { PATH: '/usr/bin:/bin', LANG: 'C', BUILD_GUIDE_TEST_NOW: TEST_NOW }, encoding: 'utf8', timeout: 60000 });
  return [...new Set(r.stderr.split('\n').map((l) => /^check-run: \[([^\]]+)\] /.exec(l)?.[1]).filter((x): x is string => x !== undefined && RULES.includes(x)))].sort();
}

let copies = 0;
/**
 * The fixture compile run (`tests/fixtures/pieces/compile-run`) as a better round leaves it after its D1 gate: the read
 * stage placed on the budget rung, holding owned content each rule would reject (a corrupted rare titled as the game titled
 * it, holding a "Legacy of …" soul core; a charm; a mana flask in Flask 1), priced from an uncorrupted listing by a spec
 * that names no why, the D1 gate's basis mapping that price to the rare. `mark` keeps or takes off the owned marks; `piece`
 * names the run's piece.
 */
function betterRound(mark: boolean, piece = 'compile'): string {
  const dir = path.join(TMP, `root-${++copies}`, piece, '2026-12-01-1');
  fs.mkdirSync(path.dirname(dir), { recursive: true });
  fs.cpSync(path.join(PIECES, 'compile-run'), dir, { recursive: true });
  const log = JSON.parse(fs.readFileSync(path.join(dir, 'run-log.json'), 'utf8')) as Json;
  log.runFolder = dir;
  log.piece = piece;
  log.stages.push({ stage: 'place', attempt: 1, outcome: 'done', priceOutcomes: { ok: 1 } }, { stage: 'D1-gate', concept: 'file', attempt: 1, outcome: 'pass' });
  fs.writeFileSync(path.join(dir, 'run-log.json'), `${JSON.stringify(log, null, 2)}\n`);
  const plan = JSON.parse(fs.readFileSync(path.join(dir, 'plan.json'), 'utf8')) as Json;
  const s = plan.stages[0];
  const j = { kind: 'judgment', ref: 'placed', confidence: 'M' };
  Object.assign(s, { variant: 'budget', ascendancyPoints: 8, variantBasis: { level: j, gemLevels: j, ascendancyPoints: j } });
  const own = mark ? { owned: true } : {};
  s.items.slots = [
    { slot: 'Body Armour', text: 'Rarity: RARE\nLoath Ward\nSlipstrike Vest\nSockets: S S S\nRune: Legacy of Blackbraid\n+92 to maximum Life\nCorrupted', ...own },
    { slot: 'Charm 1', text: 'Rarity: MAGIC\nThawing Charm\nUsed when you become Frozen', ...own },
    { slot: 'Flask 1', text: 'Rarity: MAGIC\nUltimate Mana Flask', ...own },
  ];
  plan.prices = [
    {
      id: 'body', item: 'Loath Ward', query: {}, amount: 1, currency: 'divine', date: '2026-12-01', league: 'Forbidden Rites', status: 'ok',
      listing: { corrupted: false, sockets: 2, count: 10, position: 1 },
      spec: { base: 'Slipstrike Vest', weights: [{ stat: 'Evasion', weight: 1 }], ranking: null, mustHaves: [], leftOut: [], searches: 9 },
    },
  ];
  fs.writeFileSync(path.join(dir, 'plan.json'), `${JSON.stringify(plan, null, 2)}\n`);
  fs.mkdirSync(path.join(dir, 'reports', 'gates'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'reports', 'gates', 'D1-gate-file-a1.json'), `${JSON.stringify({ verdict: {}, basis: { budget: { slots: [{ stage: s.id, slot: 'Body Armour', priceId: 'body' }] } } }, null, 2)}\n`);
  return dir;
}

describe("WU-161 (AC-W151): the checker's rules on owned content (D-519)", () => {
  it('in a compile run, owned content fails none of runes, corruption, flasks, rare-title, spec and listing; unmarked it fails each', () => {
    expect(ownedRules(betterRound(true))).toEqual([]);
    expect(ownedRules(betterRound(false))).toEqual([...RULES].sort());
  });

  it('a read stage\'s empty Flask 1 is the character\'s own slot; a designed stage\'s empty Flask 1 still fails', () => {
    const dir = betterRound(true);
    const plan = JSON.parse(fs.readFileSync(path.join(dir, 'plan.json'), 'utf8')) as Json;
    plan.stages[0].items.slots = plan.stages[0].items.slots.filter((x: Json) => x.slot !== 'Flask 1');
    fs.writeFileSync(path.join(dir, 'plan.json'), `${JSON.stringify(plan, null, 2)}\n`);
    expect(ownedRules(dir)).toEqual([]);
    delete plan.stages[0].source;
    fs.writeFileSync(path.join(dir, 'plan.json'), `${JSON.stringify(plan, null, 2)}\n`);
    expect(ownedRules(dir)).toEqual(['flasks']);
  });
});
