/**
 * WU-119 (amendment 12 §6, §7, §10; AC-P82's V1 rows over hand-made stage inputs): V1 on a schema-8 plan. The engine rows
 * (PoB's read of the caps and the custom lines, the compile's predecessor and `treeChange`) are
 * `tests/integration/compileSchema8.test.ts`.
 *
 * - §7 (D-452): `tree-continuity` runs on a plan of schema 7 or earlier only; `predecessorOf` skips a temporary stage
 *   (an id starting `tmp`, §8); the compiler's `treeChangeOf` counts the nodes the stage before holds that this one
 *   doesn't, and the reverse, on a schema-8 plan only.
 * - §10 (D-455): `curse-level-cap`, on schema 8, for an enabled gem whose cap is above 0 and below the stage's area level:
 *   the rung's (69, 79, 82), a campaign stage's C1 `<progress>.area-level`; a card skeleton is skipped; the message names
 *   the gem, its level, the debuff, its cap and the area level. The caps used here are the pinned data's
 *   (`vendor/…/Data/Skills/act_int.lua`: Elemental Weakness and Despair 72 at gem level 14, 76 at 16, 78 at 17, 0 from
 *   18; Despair 47 at 9, 52 at 10; Frost Bomb's exposure 78 at 17, 100 from 18).
 * - §6 (D-451): `custom-defence`, on schema 8, for a plan's custom line whose parsed modifiers include a pool or defence
 *   stat and whose reason gives no `coverage: <status>` result; a damage line never is; a companion's lines aren't the
 *   plan's.
 */
import fs from 'fs';
import path from 'path';
import { describe, expect, it } from '@jest/globals';
import { checkV1, COVERAGE_MARKER, isDefenceMod, predecessorOf, type V1Input } from '../../src/plan/checks/v1';
import { rungAreaLevel, treeChangeOf } from '../../src/plan/compiler';
import { loadReferenceData } from '../../src/plan/referenceData';
import { validatePlan, type Plan, type Stage } from '../../src/plan/schema';
import type { StageChecks } from '../../src/engine/schemas';
import type { Finding } from '../../src/plan/record';

type Json = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
const REPO = path.resolve(__dirname, '..', '..');
const ref = loadReferenceData(path.join(REPO, 'data'));
const TWO_STAGE = path.join(REPO, 'tests', 'fixtures', 'plans', 'two-stage', 'plan.json');
const judgment = (r: string) => ({ kind: 'judgment', ref: r, confidence: 'L' });
const CAMPAIGN = 'q.act-4-isle-of-kin-blind-beast'; // C1's area level 51

type Kind = 'entering-maps' | 'budget' | 'non-budget' | 'skeleton' | 'campaign';

/** A stage of the two-stage fixture's stage-2 content: `kind` decides its variant or progress. */
function rawStage(id: string, kind: Kind, nodes?: number[]): Json {
  const p = JSON.parse(fs.readFileSync(TWO_STAGE, 'utf8')) as Json;
  const s = p.stages[1];
  Object.assign(s, { id, loadoutName: `Stage ${id} (L14) {${id}}`, claims: [] });
  if (kind === 'campaign') s.progress = CAMPAIGN;
  else {
    s.progress = 'endgame';
    if (kind !== 'skeleton') Object.assign(s, { variant: kind, ascendancyPoints: 0, variantBasis: { level: judgment('t'), gemLevels: judgment('t'), ascendancyPoints: judgment('t') } });
  }
  if (nodes !== undefined) {
    s.tree.nodes = nodes;
    s.tree.attributeChoices = s.tree.attributeChoices.filter((c: Json) => nodes.includes(c.node));
  }
  return s;
}

/** A validated plan of `stages` at `version`. */
function planOf(version: number, stages: Json[]): Plan {
  const p = JSON.parse(fs.readFileSync(TWO_STAGE, 'utf8')) as Json;
  p.schemaVersion = version;
  p.stages = stages;
  p.ledger = [];
  const r = validatePlan(p, ref);
  if (!r.ok) throw new Error(JSON.stringify(r.errors));
  return r.plan;
}

/** V1's inputs with `gems` and `customMods`, nothing else that finds anything. */
function checksWith(gems: Json[] = [], customMods?: Json[]): StageChecks {
  return {
    counts: { used: 0, ascendancy: 0, secondaryAscendancy: 0, sockets: 0, weaponSet1: 0, weaponSet2: 0 },
    extraPoints: 0,
    passivePointsToWeaponSetPoints: 0,
    attributes: { Str: 500, Dex: 500, Int: 500, ReqStr: 0, ReqDex: 0, ReqInt: 0 },
    requirementSources: {},
    gems,
    items: [],
    warnings: [],
    nodeNames: [],
    activeSkills: [],
    config: { input: {}, placeholder: {} },
    shownOptions: [],
    grantedSkills: [],
    ...(customMods !== undefined ? { customMods } : {}),
  } as unknown as StageChecks;
}

const codes = (fs: readonly Finding[], code: string) => fs.filter((f) => f.code === code);

describe('§7 (D-452): one tree per loadout', () => {
  // The two-stage fixture's stage-2 tree, and the same less its Armour branch (6529, 32416) plus one node.
  const FULL = [3936, 46325, 13397, 33556, 55473, 39581, 6839, 5710, 43164, 6529, 32416, 53443, 59767];
  const LESS = [...FULL.filter((n) => n !== 6529 && n !== 32416), 38323];

  it('AC-P82: a schema-8 stage that drops nodes of the one before has no tree-continuity finding; at schema 7 it has one', () => {
    for (const version of [7, 8]) {
      const plan = planOf(version, [rawStage('m', 'entering-maps', FULL), rawStage('b', 'budget', LESS)]);
      const b = plan.stages[1];
      const v1 = checkV1({ stage: b, predecessor: predecessorOf(plan.stages, 1), checks: checksWith(), ref, schemaVersion: version });
      expect({ version, continuity: codes(v1.verdict.findings, 'tree-continuity').map((f) => f.data) }).toEqual({
        version,
        continuity: version === 7 ? [{ predecessor: 'm', dropped: [6529, 32416] }] : [],
      });
    }
  });

  it('AC-P82: a tmp stage (tmpb1) that copies b is not n\'s predecessor, wherever it is listed; its own predecessor is b', () => {
    const after = planOf(8, [rawStage('m', 'entering-maps', FULL), rawStage('b', 'budget', LESS), rawStage('tmpb1', 'budget', LESS), rawStage('n', 'non-budget', LESS)]);
    const ids = (plan: Plan) => plan.stages.map((s, i) => [s.id, predecessorOf(plan.stages, i)?.id ?? null]);
    expect(ids(after)).toEqual([['m', null], ['b', 'm'], ['tmpb1', 'b'], ['n', 'b']]);
    const before = planOf(8, [rawStage('m', 'entering-maps', FULL), rawStage('tmpb1', 'budget', LESS), rawStage('b', 'budget', LESS), rawStage('n', 'non-budget', LESS)]);
    expect(ids(before)).toEqual([['m', null], ['tmpb1', 'm'], ['b', 'm'], ['n', 'b']]);
    // A campaign track skips a temporary stage too.
    const campaign = planOf(8, [rawStage('c1', 'campaign', FULL), rawStage('tmpc', 'campaign', LESS), rawStage('c2', 'campaign', LESS), rawStage('m', 'entering-maps', LESS)]);
    expect(ids(campaign)).toEqual([['c1', null], ['tmpc', 'c1'], ['c2', 'c1'], ['m', 'c2']]);
  });

  it('AC-P82: treeChange counts the nodes the stage before holds that this one doesn\'t, and the reverse, on schema 8 only', () => {
    const plan = planOf(8, [rawStage('m', 'entering-maps', FULL), rawStage('b', 'budget', LESS), rawStage('tmpb1', 'budget', FULL), rawStage('n', 'non-budget', FULL)]);
    expect(plan.stages.map((s) => treeChangeOf(plan, s))).toEqual([
      null,
      { from: 'm', refunded: 2, added: 1 },
      { from: 'b', refunded: 1, added: 2 },
      { from: 'b', refunded: 1, added: 2 },
    ]);
    const seven = planOf(7, [rawStage('m', 'entering-maps', FULL), rawStage('b', 'budget', LESS)]);
    expect(seven.stages.map((s) => treeChangeOf(seven, s))).toEqual([null, null]);
  });
});

describe('§10 (D-455): curse-level-cap', () => {
  const gem = (name: string, level: number, cap: number, of: 'curse' | 'exposure' | 'wet' = 'curse', calculated = level, group = 3) => ({
    group,
    index: 1,
    name,
    level,
    tier: 0,
    kind: 'skill',
    levelRequirement: 1,
    curseCap: { cap, of, level: calculated },
  });
  /** A stage of `kind` with one enabled group per gem (after the fixture's two), checked at `version`. */
  function run(kind: Kind, gems: Json[], version = 8, edit: (s: Json) => void = () => undefined): Finding[] {
    const s = rawStage('x', kind);
    for (const g of gems) s.skills.groups.push({ label: g.name, enabled: true, role: 'utility', gems: [{ name: g.name, level: g.level, quality: 0, enabled: true }] });
    edit(s);
    const plan = planOf(version, [s]);
    const stage = plan.stages[0];
    const input: V1Input = { stage, predecessor: null, checks: checksWith(gems.map((g, k) => ({ ...g, group: 3 + k }))), ref, schemaVersion: version };
    if (stage.variant !== undefined) input.rungAreaLevel = rungAreaLevel(stage.variant, ref);
    return codes(checkV1(input).verdict.findings, 'curse-level-cap');
  }

  it('the rungs\' area levels are 69, 79 and 82', () => {
    expect((['entering-maps', 'budget', 'non-budget'] as const).map((v) => rungAreaLevel(v, ref).level)).toEqual([69, 79, 82]);
  });

  it('AC-P82: Elemental Weakness at gem level 16 on b (area 79) is curse-level-cap naming cap 76; at 18 (cap 0) it isn\'t', () => {
    const [f] = run('budget', [gem('Elemental Weakness', 16, 76)]);
    expect(f.data).toEqual({ gem: 'Elemental Weakness', group: 3, index: 1, level: 16, socketedLevel: 16, of: 'curse', cap: 76, areaLevel: 79, path: 'skills.groups[2].gems[0].level' });
    expect(f.message).toMatch(/^Elemental Weakness \(skill group 3 gem 1\) at gem level 16 doesn't apply its curse to monsters above level 76, under the area level 79 of the budget rung \(D-455\)/);
    expect(run('budget', [gem('Elemental Weakness', 18, 0)])).toEqual([]);
  });

  it('AC-P82: the cap is read at the calculated level: 16 with +2 from gear (18, cap 0) isn\'t; 15 with +1 (16, cap 76) is, naming both levels', () => {
    expect(run('budget', [gem('Elemental Weakness', 16, 0, 'curse', 18)])).toEqual([]);
    const [f] = run('budget', [gem('Elemental Weakness', 15, 76, 'curse', 16)]);
    expect(f.data).toMatchObject({ level: 16, socketedLevel: 15, cap: 76 });
    expect(f.message).toContain('at gem level 16 (15 socketed, +1 from the build)');
  });

  it('AC-P82: at level 16 on m (area 69) it isn\'t; Despair at 14 (cap 72) on m isn\'t and on b is', () => {
    expect(run('entering-maps', [gem('Elemental Weakness', 16, 76), gem('Despair', 14, 72)])).toEqual([]);
    expect(run('budget', [gem('Despair', 14, 72)]).map((f) => f.data)).toEqual([expect.objectContaining({ gem: 'Despair', cap: 72, areaLevel: 79 })]);
    // A cap equal to the area level lets the curse apply there.
    expect(run('budget', [gem('Despair', 14, 79)])).toEqual([]);
  });

  it('AC-P82: a Frost Bomb whose exposure cap is below 79 is, on b, naming the exposure; Thunderstorm\'s Wet is named too', () => {
    const [f] = run('budget', [gem('Frost Bomb', 17, 78, 'exposure')]);
    expect(f.data).toMatchObject({ gem: 'Frost Bomb', of: 'exposure', cap: 78, areaLevel: 79 });
    expect(f.message).toContain("doesn't apply its exposure to monsters above level 78");
    expect(run('budget', [gem('Frost Bomb', 18, 100, 'exposure')])).toEqual([]);
    expect(run('non-budget', [gem('Thunderstorm', 15, 74, 'wet')])[0].message).toContain("doesn't apply its Wet to monsters above level 74, under the area level 82 of the non-budget rung");
  });

  it('AC-P82: a campaign stage is checked against its C1 area-level (51 here); a card skeleton is skipped', () => {
    const [f] = run('campaign', [gem('Despair', 9, 47)]);
    expect(f.data).toMatchObject({ cap: 47, areaLevel: 51 });
    expect(f.message).toContain(`under the area level 51 of ${CAMPAIGN}`);
    expect(run('campaign', [gem('Despair', 10, 52)])).toEqual([]);
    expect(run('skeleton', [gem('Despair', 1, 20)])).toEqual([]);
  });

  it('AC-P82: not on a schema-7 plan; not for a disabled gem or group (PoB doesn\'t calculate it)', () => {
    expect(run('budget', [gem('Despair', 14, 72)], 7)).toEqual([]);
    expect(run('budget', [gem('Despair', 14, 72)], 8, (s) => (s.skills.groups[2].enabled = false))).toEqual([]);
    expect(run('budget', [gem('Despair', 14, 72)], 8, (s) => (s.skills.groups[2].gems[0].enabled = false))).toEqual([]);
  });
});

describe('§6 (D-451): custom-defence', () => {
  const ES = '+1000 to maximum Energy Shield';
  /** A `b` stage with `lines` as its custom modifiers, PoB's parse of each given as `names`. */
  function run(lines: { text: string; reason?: string; names: string[] }[], version = 8, extra: Partial<V1Input> = {}): Finding[] {
    const s = rawStage('b', 'budget');
    s.config.customMods = lines.map((l) => ({ text: l.text, ...(l.reason !== undefined ? { reason: l.reason } : {}) }));
    const plan = planOf(version, [s]);
    const checks = checksWith([], lines.map((l) => ({ text: l.text, modNames: l.names })));
    return checkV1({ stage: plan.stages[0], predecessor: null, checks, ref, schemaVersion: version, ...extra }).verdict.findings;
  }

  it('AC-P82: "+1000 to maximum Energy Shield" whose reason has no coverage: result is custom-defence; with coverage: unparsed it isn\'t', () => {
    const [f] = codes(run([{ text: ES, reason: 'a hand-calculated Sorcery Ward', names: ['EnergyShield'] }]), 'custom-defence');
    expect(f.data).toEqual({ path: 'config.customMods[0].reason', text: ES, stats: ['EnergyShield'] });
    expect(f.message).toMatch(/^custom modifier 1 \("\+1000 to maximum Energy Shield"\) adds EnergyShield, a pool or defence, and its reason gives no coverage result/);
    expect(codes(run([{ text: ES, reason: 'Sorcery Ward: coverage: unparsed', names: ['EnergyShield'] }]), 'custom-defence')).toEqual([]);
  });

  it('every coverage status that leaves a line to the plan is accepted; "coverage: parsed" is not one', () => {
    for (const status of ['unparsed', 'partly parsed', 'parsed to nothing', 'possibly unread']) {
      expect({ status, found: codes(run([{ text: ES, reason: `coverage: ${status}`, names: ['EnergyShield'] }]), 'custom-defence').length }).toEqual({ status, found: 0 });
    }
    expect(COVERAGE_MARKER.test('coverage: parsed')).toBe(false);
    expect(codes(run([{ text: ES, reason: 'coverage: parsed', names: ['EnergyShield'] }]), 'custom-defence')).toHaveLength(1);
  });

  it('AC-P82: a custom damage line never is; a line without a reason is custom-defence and missing-reason', () => {
    expect(codes(run([{ text: '10% more Damage', reason: 'test', names: ['Damage'] }]), 'custom-defence')).toEqual([]);
    expect(codes(run([{ text: '10% more Damage', names: ['Damage'] }]), 'custom-defence')).toEqual([]);
    const both = run([{ text: ES, names: ['EnergyShield'] }]);
    expect([codes(both, 'custom-defence').length, codes(both, 'missing-reason').length]).toEqual([1, 1]);
  });

  it('AC-P82: not on a schema-7 plan; a companion\'s lines after the plan\'s aren\'t checked; a line PoB\'s reply lacks is skipped', () => {
    expect(codes(run([{ text: ES, reason: 'x', names: ['EnergyShield'] }], 7), 'custom-defence')).toEqual([]);
    const lines = [
      { text: '10% more Damage', reason: 'x', names: ['Damage'] },
      { text: '+20% to all Elemental Resistances', reason: 'estimate (D-402): a kept modifier', names: ['ElementalResist'] },
    ];
    expect(codes(run(lines, 8, { planCustomMods: 1 }), 'custom-defence')).toEqual([]);
    expect(codes(run(lines, 8), 'custom-defence').map((f) => f.data!.path)).toEqual(['config.customMods[1].reason']);
    const s = rawStage('b', 'budget');
    s.config.customMods = [{ text: ES, reason: 'x' }];
    const plan = planOf(8, [s]);
    expect(codes(checkV1({ stage: plan.stages[0], predecessor: null, checks: checksWith(), ref, schemaVersion: 8 }).verdict.findings, 'custom-defence')).toEqual([]);
  });

  it('the pool and defence stats are PoB\'s modifier names for life, mana, energy shield, ward, armour, evasion, deflection, block, resistances and damage taken', () => {
    const yes = ['Life', 'Mana', 'EnergyShield', 'Ward', 'Armour', 'Evasion', 'MeleeEvasion', 'ArmourAndEvasion', 'Defences', 'DeflectionRating', 'DeflectEffect',
      'EvasionGainAsDeflection', 'BlockChance', 'SpellBlockChance', 'FireResist', 'ElementalResist', 'ChaosResistMax', 'DamageTaken', 'PhysicalDamageTaken',
      'DamageTakenFromManaBeforeLife', 'PhysicalDamageReduction', 'ArmourAppliesToFireDamageTaken', 'EvadeChanceMax'];
    const no = ['Damage', 'PhysicalDamage', 'LifeRegen', 'LifeLeech', 'ManaCost', 'EnergyShieldRecharge', 'EnemyPhysicalDamageReduction', 'ArmourBreakPerHit',
      'ElementalPenetration', 'ChanceToIgnoreEnemyPhysicalDamageReduction', 'MinionModifier', 'Speed'];
    expect({ yes: yes.filter((n) => !isDefenceMod(n)), no: no.filter(isDefenceMod) }).toEqual({ yes: [], no: [] });
  });
});
