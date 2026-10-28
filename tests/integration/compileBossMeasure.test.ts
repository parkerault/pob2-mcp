/**
 * WU-111 (amendment 11 §5, §9b; D-437, D-447): the damage figure against map monsters and a Pinnacle boss, the boss
 * rotation, PoB's trigger test, the ailments that don't stack, the cull, the source's types, `CastRate` and `Cooldown`,
 * and C-33's `boss.` references, through `compile_plan`, in process and engine-required. AC-P81's engine bullets.
 *
 * The real server runs in process (`startSessionFixture`) over private builds, state and guides folders. Every plan is
 * written from the committed two-stage fixture (a Warrior / Titan) and the pinned game data's gems and bases, into a run
 * folder `guide_run {new_run}` made. Each plan has a twin: the same stages with `enemyIsBoss: "Pinnacle"` in their
 * scenario, compiled separately, so every boss figure is checked against PoB's own measure of the stage against a
 * Pinnacle boss, and every expected figure is worked out here from PoB's raw per-skill fields by the spec's rules (the
 * Names' damage figure; §9b's sum), never from the record's measures alone.
 *
 * - `attacks` (roll Boneshatter): `n` states no rotation; `nE` names Earthquake's two stat sets (Impact, Aftershock, one
 *   use), the second with `turns`; `nI` two attacks that both ignite (custom modifiers adding fire damage and a 100%
 *   ignite chance), `nP` two that both poison, `nPS` the same with PoisonCanStack ("Targets can be affected by +1 of your
 *   poisons at the same time", ModParser's flag); `nC` and `nN` Culling Strike, with and without `skills.cull`; `n2` the
 *   named source on weapon set 2 (a Slim Mace on set 1, a Wooden Club on set 2: Data/Bases/mace.lua), `nR2` a rotation
 *   entry on weapon set 2. Its ledger reads `nI.boss.g1s1p1.ignite`, `nI.boss.measured` and `nE.boss.g3s1p2`.
 * - `spells` (roll Spark): group 1 is Cast on Critical with Spark (the named source, active skill 2), group 2
 *   Boneshatter, group 3 Spell Totem with Spark, group 4 Infernal Cry with Corrupting Cry I (whose Corrupted Cry has
 *   PoB's InbuiltTrigger and Triggered types, Data/Skills/sup_str.lua), group 5 Frost Bomb (a 6-second cooldown,
 *   Data/Skills/act_int.lua). `t` names Spark alone; `ts` is a card skeleton; `tm` names Boneshatter, the triggered
 *   Spark, the totem's Spark and Corrupted Cry.
 *
 * WU-120 (amendment 12 §4, §9; D-449, D-454; AC-P84): `attacks` gains `nF`, the named source with Enfeeble beside it (a
 * curse PoB halves against a Pinnacle boss), and `nL2`, a rotation entry on weapon set 2 whose set-2 club carries +800
 * life, so the two sets' max hits differ. The Arbiter rows read the Pinnacle pass's max hits, checked against the twin.
 * `elements` (the resisting figure) names Frostbolt (cold) on `fc` and Essence Drain (chaos) on `xc`; its twin has the
 * enemy's fire, cold and lightning resistance at 40 (the waystone modifier's top roll) in the scenario.
 */
import fs from 'fs';
import path from 'path';
import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import { engineDescribe } from '../helpers/engine';
import { startSessionFixture, type SessionFixture } from '../helpers/engineSession';
import type { CompileRecord, StageRecord } from '../../src/plan/record';

const REPO = path.resolve(__dirname, '..', '..');
const FIXTURE = path.join(REPO, 'tests', 'fixtures', 'plans', 'two-stage', 'plan.json');
const ENGINE_TIMEOUT = 600_000;

type Json = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
const judgment = (ref: string) => ({ kind: 'judgment', ref, confidence: 'L' });
const gem = (name: string, level = 10) => ({ name, level, quality: 0, enabled: true });
const mod = (text: string) => ({ text, reason: `test: ${text}` });
const SLIM_MACE = { slot: 'Weapon 1', text: 'Rarity: Normal\nSlim Mace' };
const CLUB_SWAP = { slot: 'Weapon 1 Swap', text: 'Rarity: Normal\nWooden Club' };

/** Equal within a relative 1e-9 (the record sums in another order than the test). */
function close(a: number | null | undefined, b: number): boolean {
  return typeof a === 'number' && Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(b));
}

/**
 * The Names' damage figure of one key of a stage, from PoB's raw fields there and the group's Count: `TotalDPS` ×
 * Count, `TotalDot` × Count only when its damage over time stacks (the record's `countedSkillOutputs` flag), and
 * `IgniteDPS`, `BleedDPS`, `PoisonDPS` once. `set2` reads `skillOutputsSet2`.
 */
function figureAt(s: StageRecord, key: string, count = 1, set2 = false): { hit: number; ignite: number; bleed: number; poison: number; total: number } {
  const f = (set2 ? s.skillOutputsSet2! : s.skillOutputs)[key]?.fields;
  if (f === undefined) throw new Error(`no ${key} in the stage's ${set2 ? 'skillOutputsSet2' : 'skillOutputs'}`);
  const stacks = s.countedSkillOutputs[key]?.dotCanStack === true;
  const hit = (f.TotalDPS ?? 0) * count + (f.TotalDot ?? 0) * (stacks ? count : 1);
  const [ignite, bleed, poison] = [f.IgniteDPS ?? 0, f.BleedDPS ?? 0, f.PoisonDPS ?? 0];
  return { hit, ignite, bleed, poison, total: hit + ignite + bleed + poison };
}

/** A non-budget stage `id` from the fixture's stage 2, at level 90, with an amulet and `groups`, edited by `edit`. */
function rung(base: Json, id: string, groups: Json[], main: Json, edit: (s: Json) => void = () => undefined, variant: string | null = 'non-budget'): Json {
  const s = JSON.parse(JSON.stringify(base));
  Object.assign(s, { id, loadoutName: `Stage ${id} (L90) {${id}}`, level: 90, progress: 'endgame', claims: [] });
  if (variant !== null) {
    Object.assign(s, { variant, ascendancyPoints: 0, variantBasis: { level: judgment('t'), gemLevels: judgment('t'), ascendancyPoints: judgment('t') } });
  }
  s.items.slots.push({ slot: 'Amulet', text: 'Rarity: Normal\nCrimson Amulet' });
  s.skills = { groups: JSON.parse(JSON.stringify(groups)), main, ...(variant !== null ? { rolledGroup: 1 } : {}) };
  s.config.earned = s.config.earned.filter((e: Json) => e.option !== 'multiplierRage');
  edit(s);
  return s;
}

const ATTACK_GROUPS = [
  { label: 'Boneshatter', enabled: true, role: 'single_target', gems: [gem('Boneshatter')] },
  { label: 'Rolling Slam', enabled: true, role: 'clear', gems: [gem('Rolling Slam')] },
  { label: 'Earthquake', enabled: true, role: 'single_target', gems: [gem('Earthquake')] },
];
const BONE = { group: 1, activeSkill: 1, statSet: 1 };
const QUAKE = { group: 3, activeSkill: 1, statSet: 1 };

/** The attack plan, schema 7: the stages the header lists. */
function attacks(): Json {
  const plan = JSON.parse(fs.readFileSync(FIXTURE, 'utf8')) as Json;
  const base = plan.stages[1];
  plan.schemaVersion = 7;
  const main = { group: 1, activeSkill: 1, statSet: 1 };
  const boss = (entries: Json[]) => (s: Json) => (s.skills.boss = { entries, note: 'test rotation' });
  const both = (mods: string[]) => (s: Json) => {
    s.config.customMods = mods.map(mod);
    boss([BONE, QUAKE])(s);
  };
  plan.stages = [
    rung(base, 'n', ATTACK_GROUPS, main),
    rung(base, 'nE', ATTACK_GROUPS, main, boss([QUAKE, { group: 3, activeSkill: 1, statSet: 2, turns: true }])),
    rung(base, 'nI', ATTACK_GROUPS, main, both(['Adds 30 to 50 Fire Damage to Attacks', '100% chance to Ignite'])),
    rung(base, 'nP', ATTACK_GROUPS, main, both(['Adds 30 to 50 Chaos Damage to Attacks', '100% chance to Poison on Hit'])),
    rung(base, 'nPS', ATTACK_GROUPS, main, both(['Adds 30 to 50 Chaos Damage to Attacks', '100% chance to Poison on Hit', 'Targets can be affected by +1 of your poisons at the same time'])),
    rung(base, 'nC', ATTACK_GROUPS, main, (s) => {
      s.config.customMods = [mod('Culling Strike')];
      s.skills.cull = "test: Culling Strike on Boneshatter's hits";
    }),
    rung(base, 'nN', ATTACK_GROUPS, main, (s) => (s.config.customMods = [mod('Culling Strike')])),
    rung(base, 'n2', ATTACK_GROUPS, main, (s) => {
      s.items.slots = s.items.slots.filter((i: Json) => i.slot !== 'Weapon 1');
      s.items.slots.push({ ...SLIM_MACE }, { ...CLUB_SWAP });
      s.skills.groups[0].weaponSet = 2;
    }),
    rung(base, 'nR2', ATTACK_GROUPS, main, (s) => {
      s.items.slots = s.items.slots.filter((i: Json) => i.slot !== 'Weapon 1');
      s.items.slots.push({ ...SLIM_MACE }, { ...CLUB_SWAP });
      s.skills.groups[2].weaponSet = 2;
      boss([BONE, QUAKE])(s);
    }),
    // WU-120 (D-449): Enfeeble beside the named source; a rotation entry on set 2 whose club adds life on set 2 only.
    rung(base, 'nF', [...ATTACK_GROUPS, { label: 'Enfeeble', enabled: true, role: 'utility', gems: [gem('Enfeeble', 20)] }], main),
    rung(base, 'nL2', ATTACK_GROUPS, main, (s) => {
      s.items.slots = s.items.slots.filter((i: Json) => i.slot !== 'Weapon 1');
      s.items.slots.push({ ...SLIM_MACE }, { slot: 'Weapon 1 Swap', text: 'Rarity: Rare\nTest Bludgeon\nWooden Club\n+800 to maximum Life' });
      s.skills.groups[2].weaponSet = 2;
      boss([BONE, QUAKE])(s);
    }),
  ];
  plan.ledger = [
    { id: 'boss_ignite', claim: "nI's Boneshatter ignite against a Pinnacle boss.", formula: 'nI.boss.g1s1p1.ignite', inputs: [] },
    { id: 'boss_measured', claim: "nI's boss figure, PoB alone.", formula: 'nI.boss.measured', inputs: [] },
    { id: 'boss_aftershock', claim: "nE's Aftershock against a Pinnacle boss.", formula: 'nE.boss.g3s1p2', inputs: [] },
  ];
  return plan;
}

const SPELL_GROUPS = [
  { label: 'Spark on crit', enabled: true, role: 'single_target', gems: [gem('Cast on Critical'), gem('Spark')] },
  { label: 'Boneshatter', enabled: true, role: 'single_target', gems: [gem('Boneshatter')] },
  { label: 'Totem', enabled: true, role: 'single_target', gems: [gem('Spell Totem'), gem('Spark')] },
  { label: 'Cry', enabled: true, role: 'utility', gems: [gem('Infernal Cry'), gem('Corrupting Cry I', 1)] },
  { label: 'Frost Bomb', enabled: true, role: 'utility', gems: [gem('Frost Bomb')] },
];
const SPARK = { group: 1, activeSkill: 2, statSet: 1 };
const TOTEM_SPARK = { group: 3, activeSkill: 2, statSet: 1 };
const CORRUPTED_CRY = { group: 4, activeSkill: 3, statSet: 1 };

/** The spell plan, schema 7: roll Spark, the stages the header lists. */
function spells(): Json {
  const plan = JSON.parse(fs.readFileSync(FIXTURE, 'utf8')) as Json;
  const base = plan.stages[1];
  plan.schemaVersion = 7;
  plan.roll.skill = 'Spark';
  const main = { group: 1, activeSkill: 2, statSet: 1 };
  plan.stages = [
    rung(base, 't', SPELL_GROUPS, main, (s) => (s.skills.boss = { entries: [SPARK], note: 'Spark by Cast on Critical alone' })),
    rung(base, 'ts', SPELL_GROUPS, main, () => undefined, null),
    rung(base, 'tm', SPELL_GROUPS, main, (s) => (s.skills.boss = { entries: [{ group: 2, activeSkill: 1, statSet: 1 }, SPARK, TOTEM_SPARK, CORRUPTED_CRY], note: 'test rotation' })),
  ];
  plan.ledger = [];
  return plan;
}

/**
 * WU-120 (D-454): a resisting figure's plan, schema 7, rolled on `skill`: one rung `id` whose named source is that spell,
 * Frostbolt (cold) or Essence Drain (chaos).
 */
function elements(id: string, skill: string): Json {
  const plan = JSON.parse(fs.readFileSync(FIXTURE, 'utf8')) as Json;
  const base = plan.stages[1];
  plan.schemaVersion = 7;
  plan.roll.skill = skill;
  plan.stages = [rung(base, id, [{ label: skill, enabled: true, role: 'single_target', gems: [gem(skill, 20)] }], { group: 1, activeSkill: 1, statSet: 1 })];
  plan.ledger = [];
  return plan;
}

/** The resisting twin of a plan: its stages with the enemy's fire, cold and lightning resistance at the waystone modifier's top roll. */
function resisting(plan: Json): Json {
  const twin = JSON.parse(JSON.stringify(plan)) as Json;
  const source = { file: 'enemies/waystones.json', key: 'mods.monster-elemental-resistance' };
  for (const s of twin.stages) {
    for (const option of ['enemyFireResist', 'enemyColdResist', 'enemyLightningResist']) {
      s.config.scenario.push({ option, value: 40, source, tag: judgment('test: the resisting figure') });
    }
  }
  return twin;
}

/** The twin of a plan: its variant stages with `enemyIsBoss: "Pinnacle"` and no boss rotation or cull. */
function pinnacle(plan: Json): Json {
  const twin = JSON.parse(JSON.stringify(plan)) as Json;
  twin.stages = twin.stages.filter((s: Json) => s.variant !== undefined);
  for (const s of twin.stages) {
    s.config.scenario.find((e: Json) => e.option === 'enemyIsBoss').value = 'Pinnacle';
    delete s.skills.boss;
    delete s.skills.cull;
  }
  twin.ledger = [];
  return twin;
}

engineDescribe('WU-111: the boss measure, the damage figure and boss references through compile_plan (D-437, D-447)', () => {
  let f: SessionFixture;
  let atk: CompileRecord;
  let atkBoss: CompileRecord;
  let spl: CompileRecord;
  let splBoss: CompileRecord;
  let spellText: string;
  /** WU-120: the cold and chaos rungs, `fc` and `xc`, each compiled alone and with the enemy's resistances at 40. */
  const ele: Record<string, CompileRecord> = {};
  const eleRes: Record<string, CompileRecord> = {};

  async function compile(slug: string, plan: Json): Promise<{ isError: boolean; text: string; record?: CompileRecord }> {
    const made = await f.call('guide_run', { new_run: slug });
    if (made.isError) throw new Error(`guide_run failed: ${made.text}`);
    const abs = /^Created run folder (.+)$/m.exec(made.text)![1];
    const planPath = /^plan_path for this run: (\S+)$/m.exec(made.text)![1];
    fs.writeFileSync(path.join(f.guides, planPath), `${JSON.stringify(plan, null, 2)}\n`);
    const out = await f.call('compile_plan', { plan_path: planPath, measure_only: true });
    const file = path.join(abs, 'compile-record.json');
    return { ...out, ...(out.isError ? {} : { record: JSON.parse(fs.readFileSync(file, 'utf8')) as CompileRecord }) };
  }

  async function compiled(slug: string, plan: Json): Promise<{ record: CompileRecord; text: string }> {
    const out = await compile(slug, plan);
    expect({ slug, isError: out.isError, text: out.isError ? out.text : '' }).toEqual({ slug, isError: false, text: '' });
    return { record: out.record!, text: out.text };
  }

  beforeAll(async () => {
    f = await startSessionFixture({ testActions: true });
    atk = (await compiled('boss-attacks', attacks())).record;
    atkBoss = (await compiled('boss-attacks-pinnacle', pinnacle(attacks()))).record;
    const s = await compiled('boss-spells', spells());
    spl = s.record;
    spellText = s.text;
    splBoss = (await compiled('boss-spells-pinnacle', pinnacle(spells()))).record;
    for (const [id, skill] of [['fc', 'Frostbolt'], ['xc', 'Essence Drain']]) {
      ele[id] = (await compiled(`resisting-${id}`, elements(id, skill))).record;
      eleRes[id] = (await compiled(`resisting-${id}-40`, resisting(elements(id, skill)))).record;
    }
  }, ENGINE_TIMEOUT);

  afterAll(async () => f?.close(), 60_000);

  describe('the named source against map monsters and a boss (§5)', () => {
    it("AC-P81: with no skills.boss, a variant stage's damage.boss equals the named source's figure in a separate compile of the stage with enemyIsBoss \"Pinnacle\"", () => {
      const n = atk.stages.n.measures!;
      const twin = atkBoss.stages.n;
      expect(close(n.damage!.boss, twin.measures!.damage!.map!)).toBe(true);
      expect(close(n.damage!.boss, figureAt(twin, 'g1s1p1').total)).toBe(true);
      // The map figure is the stage's own: the named source's figure under its own config, and the boss one is lower.
      expect(close(n.damage!.map, figureAt(atk.stages.n, 'g1s1p1').total)).toBe(true);
      expect(n.damage!.boss!).toBeLessThan(n.damage!.map!);
      // The rotation is the named source alone; the stage's own measure and saved config are the map monsters'.
      expect(n.bossGroups!.map((g) => [g.group, g.activeSkill, g.statSet, g.turns])).toEqual([[1, 1, 1, false]]);
      expect(atk.stages.n.configWritten.enemyIsBoss).toBe('None');
      expect(atk.stages.n.configEffective.enemyIsBoss).toMatchObject({ value: 'None', origin: 'explicit' });
    });

    it('AC-P81: a named source on weapon set 2 is read from set 2 both times', () => {
      const s = atk.stages.n2;
      const set2 = figureAt(s, 'g1s1p1', 1, true).total;
      expect(set2).toBeGreaterThan(0);
      expect(set2).not.toBeCloseTo(figureAt(s, 'g1s1p1').total, 3);
      expect(close(s.measures!.damage!.map, set2)).toBe(true);
      const twin = atkBoss.stages.n2;
      expect(close(s.measures!.damage!.boss, figureAt(twin, 'g1s1p1', 1, true).total)).toBe(true);
      expect(close(s.measures!.damage!.boss, twin.measures!.damage!.map!)).toBe(true);
    });

    it('AC-P81: with skills.cull, measures.cull holds both thresholds and the map figure carries the named source\'s multiplier; without it, neither', () => {
      const c = atk.stages.nC;
      const fields = c.skillOutputs.g1s1p1.fields;
      const bossCull = atkBoss.stages.nC.skillOutputs.g1s1p1.fields.CullPercent;
      expect(fields.CullPercent).toBeGreaterThan(0);
      expect(bossCull).toBeGreaterThan(0);
      expect(bossCull).toBeLessThan(fields.CullPercent);
      expect(c.measures!.cull).toEqual({ map: fields.CullPercent, boss: bossCull });
      expect(fields.CullMultiplier).toBeGreaterThan(1);
      expect(close(c.measures!.damage!.map, figureAt(c, 'g1s1p1').total * fields.CullMultiplier)).toBe(true);
      // The boss figure is never culled.
      expect(close(c.measures!.damage!.boss, figureAt(atkBoss.stages.nC, 'g1s1p1').total)).toBe(true);
      const plain = atk.stages.nN;
      expect(plain.skillOutputs.g1s1p1.fields.CullMultiplier).toBeGreaterThan(1);
      expect(plain.measures!.cull).toBeUndefined();
      expect(close(plain.measures!.damage!.map, figureAt(plain, 'g1s1p1').total)).toBe(true);
    });

    it("AC-P81: measures.sourceTypes holds the named source's PoB skill types (Spark: Spell; Boneshatter: Melee)", () => {
      expect(atk.stages.n.measures!.sourceTypes).toContain('Melee');
      expect(atk.stages.n.measures!.sourceTypes).not.toContain('Spell');
      for (const id of ['t', 'ts']) {
        expect({ id, spell: spl.stages[id].measures!.sourceTypes!.includes('Spell') }).toEqual({ id, spell: true });
      }
    });

    it('AC-P81: a group with Cast on Critical gives measures.trigger {by: "Cast on Critical", usesPerSecond}, on a skeleton stage too', () => {
      for (const id of ['t', 'ts', 'tm']) {
        const s = spl.stages[id];
        expect({ id, trigger: s.measures!.trigger }).toEqual({ id, trigger: { by: 'Cast on Critical', usesPerSecond: s.skillOutputs.g1s2p1.fields.Speed } });
      }
      // The skeleton has the trigger and the types, and no damage or boss measure.
      expect(spl.stages.ts.measures!.damage).toBeUndefined();
      expect(spl.stages.ts.measures!.bossGroups).toBeUndefined();
      // A group without the meta gem gives none.
      expect(atk.stages.n.measures!.trigger).toBeUndefined();
      // The key-figure line says the skill is rated at its hand-cast speed, on the skeleton too.
      const line = (id: string) => spellText.split('\n')[spellText.split('\n').findIndex((l) => l.startsWith(`Stage ${id} "`)) + 1];
      for (const id of ['t', 'ts']) expect(line(id)).toContain("Spark is triggered by Cast on Critical: PoB rates it at its hand-cast speed (");
    });
  });

  describe('the boss rotation (§9b)', () => {
    it("AC-P81: two entries of one group's two stat sets are both recorded and summed into damage.boss; an entry's turns is the plan's", () => {
      const s = atk.stages.nE.measures!;
      const twin = atkBoss.stages.nE;
      const impact = figureAt(twin, 'g3s1p1').total;
      const after = figureAt(twin, 'g3s1p2').total;
      expect([impact, after].every((v) => v > 0)).toBe(true);
      expect(s.bossGroups!.map((g) => [g.group, g.activeSkill, g.statSet, g.triggered, g.turns])).toEqual([
        [3, 1, 1, false, false],
        [3, 1, 2, false, true],
      ]);
      expect(close(s.bossGroups![0].figure, impact) && close(s.bossGroups![1].figure, after)).toBe(true);
      expect(close(s.damage!.boss, impact + after)).toBe(true);
    });

    it('AC-P81: two entries that both ignite sum their hits and only the larger ignite into damage.boss', () => {
      const twin = atkBoss.stages.nI;
      const [a, b] = [figureAt(twin, 'g1s1p1'), figureAt(twin, 'g3s1p1')];
      expect(a.ignite).toBeGreaterThan(0);
      expect(b.ignite).toBeGreaterThan(0);
      expect(a.ignite).not.toBeCloseTo(b.ignite, 3);
      const want = a.hit + b.hit + Math.max(a.ignite, b.ignite) + Math.max(a.bleed, b.bleed) + Math.max(a.poison, b.poison);
      expect(close(atk.stages.nI.measures!.damage!.boss, want)).toBe(true);
      expect(atk.stages.nI.measures!.bossGroups!.map((g) => g.ignite)).toEqual([a.ignite, b.ignite]);
    });

    it('AC-P81: the same for poison; with PoisonCanStack on the build, both poisons', () => {
      const one = atkBoss.stages.nP;
      const [a, b] = [figureAt(one, 'g1s1p1'), figureAt(one, 'g3s1p1')];
      expect(a.poison > 0 && b.poison > 0).toBe(true);
      expect(close(atk.stages.nP.measures!.damage!.boss, a.hit + b.hit + Math.max(a.poison, b.poison) + Math.max(a.ignite, b.ignite) + Math.max(a.bleed, b.bleed))).toBe(true);
      const stacking = atkBoss.stages.nPS;
      const [c, d] = [figureAt(stacking, 'g1s1p1'), figureAt(stacking, 'g3s1p1')];
      expect(c.poison > 0 && d.poison > 0).toBe(true);
      expect(close(atk.stages.nPS.measures!.damage!.boss, c.hit + d.hit + c.poison + d.poison + Math.max(c.ignite, d.ignite) + Math.max(c.bleed, d.bleed))).toBe(true);
      // A poison that stacks is listed as 0: it stays in its entry's figure.
      expect(atk.stages.nPS.measures!.bossGroups!.map((g) => g.poison)).toEqual([0, 0]);
    });

    it('AC-P81: an entry on weapon set 2 is read from set 2', () => {
      const twin = atkBoss.stages.nR2;
      const set2 = figureAt(twin, 'g3s1p1', 1, true).total;
      expect(set2).not.toBeCloseTo(figureAt(twin, 'g3s1p1').total, 3);
      const quake = atk.stages.nR2.measures!.bossGroups!.find((g) => g.group === 3)!;
      expect(close(quake.figure, set2)).toBe(true);
      expect(close(atk.stages.nR2.measures!.damage!.boss, figureAt(twin, 'g1s1p1').total + set2)).toBe(true);
    });

    it("AC-P81: a rotation of a triggered named source alone gives its hand-cast figure", () => {
      const t = spl.stages.t.measures!;
      expect(t.bossGroups!.map((g) => [g.group, g.activeSkill, g.triggered, g.triggeredBy])).toEqual([[1, 2, true, 'Cast on Critical']]);
      const handCast = figureAt(splBoss.stages.t, 'g1s2p1').total;
      expect(handCast).toBeGreaterThan(0);
      expect(close(t.damage!.boss, handCast)).toBe(true);
      expect(close(t.damage!.boss, splBoss.stages.t.measures!.damage!.map!)).toBe(true);
    });

    it('AC-P81: an entry Cast on Critical triggers is listed with triggeredBy and not summed; a Spell Totem\'s spell has triggered false and is summed; an inbuilt trigger has triggered true and triggeredBy null', () => {
      const tm = spl.stages.tm;
      // The selections are PoB's: the totem's Spark and Corrupting Cry's Corrupted Cry.
      expect([tm.skillOutputs.g3s2p1.skill, tm.skillOutputs.g4s3p1.skill]).toEqual(['Spark', 'Corrupted Cry']);
      expect(tm.measures!.bossGroups!.map((g) => ({ at: `g${g.group}s${g.activeSkill}p${g.statSet}`, triggered: g.triggered, by: g.triggeredBy }))).toEqual([
        { at: 'g2s1p1', triggered: false, by: null },
        { at: 'g1s2p1', triggered: true, by: 'Cast on Critical' },
        { at: 'g3s2p1', triggered: false, by: null },
        { at: 'g4s3p1', triggered: true, by: null },
      ]);
      const twin = splBoss.stages.tm;
      const totem = figureAt(twin, 'g3s2p1').total;
      expect(totem).toBeGreaterThan(0);
      expect(close(tm.measures!.damage!.boss, figureAt(twin, 'g2s1p1').total + totem)).toBe(true);
    });
  });

  describe('the measured fields and the ledger (§9b, C-33)', () => {
    it('AC-P81: a spell whose cooldown binds has CastRate and Cooldown in its record fields, with CastRate above Speed', () => {
      const bomb = spl.stages.t.skillOutputs.g5s1p1;
      expect(bomb.skill).toBe('Frost Bomb');
      expect(bomb.fields.Cooldown).toBeGreaterThan(0);
      expect(bomb.fields.CastRate).toBeGreaterThan(bomb.fields.Speed);
      // The cap: Speed is at most one use per cooldown.
      expect(bomb.fields.Speed).toBeLessThanOrEqual(1 / bomb.fields.Cooldown + 1e-9);
    });

    it('AC-P81: ledger formulas reading nI.boss.g1s1p1.ignite and nI.boss.measured evaluate to that entry\'s ignite against a Pinnacle boss and to damage.boss', () => {
      const ignite = figureAt(atkBoss.stages.nI, 'g1s1p1').ignite;
      expect(atk.ledger.boss_ignite).toEqual({ value: ignite, error: null, computedWithCustomMods: true });
      expect(atk.ledger.boss_measured).toEqual({ value: atk.stages.nI.measures!.damage!.boss, error: null, computedWithCustomMods: true });
    });

    it("AC-P81: a ledger formula reading nE.boss.g3s1p2 evaluates to that entry's figure against a Pinnacle boss", () => {
      expect(close(atk.ledger.boss_aftershock.value, figureAt(atkBoss.stages.nE, 'g3s1p2').total)).toBe(true);
      expect(atk.ledger.boss_aftershock.error).toBeNull();
    });
  });

  describe("an entry naming a group, skill or stat set the stage doesn't have errs at stages[n].skills.boss.entries[k]", () => {
    const withEntry = (plan: Json, entry: Json): Json => {
      plan.stages = [plan.stages[0]];
      plan.ledger = [];
      plan.stages[0].skills.boss = { entries: [{ group: 1, activeSkill: 1, statSet: 1 }, entry], note: 'test' };
      return plan;
    };

    it('AC-P81: a group the stage lacks (the schema), an active skill and a stat set beyond the group\'s (the preflight), each naming the path; nothing is compiled', async () => {
      const cases: [Json, RegExp][] = [
        [{ group: 9, activeSkill: 1, statSet: 1 }, /^stages\[0\]\.skills\.boss\.entries\[1\] \(stage n\): group 9 names no group; the stage has 3/m],
        [{ group: 1, activeSkill: 4, statSet: 1 }, /^stage n: stages\[0\]\.skills\.boss\.entries\[1\]: active skill 4 is outside group 1's 1 active skills$/m],
        [{ group: 1, activeSkill: 1, statSet: 3 }, /^stage n: stages\[0\]\.skills\.boss\.entries\[1\]: stat set 3 is beyond every active skill of group 1: the most any has is 2$/m],
      ];
      for (const [i, [entry, want]] of cases.entries()) {
        const out = await compile(`boss-entry-${i}`, withEntry(attacks(), entry));
        expect({ i, isError: out.isError, matches: want.test(out.text), record: out.record }).toEqual({ i, isError: true, matches: true, record: undefined });
      }
    }, ENGINE_TIMEOUT);

    it("AC-P81: a stat set the preflight's bound allows but PoB's boss measure lacks (Cast on Critical's second) errs at the entry's path; nothing is written", async () => {
      const out = await compile('boss-entry-measured', withEntry(spells(), { group: 1, activeSkill: 1, statSet: 2 }));
      expect(out.isError).toBe(true);
      expect(out.text).toMatch(/^stages\[0\]\.skills\.boss\.entries\[1\] \(stage t\): group 1 has no active skill 1 with stat set 2 in PoB's measure \(D-447\); its selections: g1s1p1 Cast on Critical/m);
      expect(out.record).toBeUndefined();
    }, ENGINE_TIMEOUT);
  });

  describe('WU-120: the Arbiter on the Pinnacle pass and the resisting figure (amendment 12 §4, §9)', () => {
    const MAX_HIT = (t: string) => `${t[0].toUpperCase()}${t.slice(1)}MaximumHitTaken`;
    const slam = JSON.parse(fs.readFileSync(path.join(REPO, 'data', 'enemies', 'arbiter-of-divinity.json'), 'utf8')).facts['hits.extendo-spear-combo-slam-1'].value.max as number;

    it('AC-P84: on a stage that curses with Enfeeble, the Arbiter physical ratio is above the map measure\'s ratio for the same hit, and its max hit is the Pinnacle compile\'s', () => {
      const s = atk.stages.nF;
      // Enfeeble raises the stage's own physical max hit, and PoB halves it against a Pinnacle boss.
      expect(s.outputs.PhysicalMaximumHitTaken).toBeGreaterThan(atk.stages.n.outputs.PhysicalMaximumHitTaken);
      const row = s.measures!.arbiter!.rows.find((r) => r.type === 'physical')!;
      expect(row.hit).toBe(slam);
      expect(row.ratio!).toBeGreaterThan(slam / s.outputs.PhysicalMaximumHitTaken);
      expect(row.maxHit).toBe(atkBoss.stages.nF.outputs.PhysicalMaximumHitTaken);
      // The lowest max hit is the stage's own measure, against map monsters.
      expect(s.measures!.toughness!.lowestMaxHit!.value).toBe(Math.min(...['physical', 'fire', 'cold', 'lightning', 'chaos'].map((t) => s.outputs[MAX_HIT(t)])));
    });

    it("AC-P84: measures.arbiter reads the Pinnacle pass's max hits on the stage's own weapon set, on a stage with a boss group on set 2", () => {
      const twin = atkBoss.stages.nL2;
      // The set-2 club's life moves set 2's max hits: the two sets differ.
      expect(twin.outputsSet2!.PhysicalMaximumHitTaken).toBeGreaterThan(twin.outputs.PhysicalMaximumHitTaken);
      for (const r of atk.stages.nL2.measures!.arbiter!.rows.filter((x) => !x.mixed)) {
        expect({ type: r.type, maxHit: r.maxHit }).toEqual({ type: r.type, maxHit: twin.outputs[MAX_HIT(r.type)] });
      }
      // The boss rotation's set-2 entry is still read on set 2.
      expect(atk.stages.nL2.measures!.bossGroups!.map((g) => g.group)).toEqual([1, 3]);
    });

    it("AC-P84: measures.damage.resisting equals the named source's figure in a separate compile with enemy fire, cold and lightning resistance 40; a cold source reads it below damage.map, a chaos one equal to it", () => {
      for (const id of ['fc', 'xc']) {
        expect({ id, resisting: ele[id].stages[id].measures!.damage!.resisting }).toEqual({ id, resisting: eleRes[id].stages[id].measures!.damage!.map });
      }
      const [fc, xc] = [ele.fc.stages.fc.measures!.damage!, ele.xc.stages.xc.measures!.damage!];
      expect(fc.map!).toBeGreaterThan(0);
      expect(fc.resisting!).toBeLessThan(fc.map!);
      expect(xc.map!).toBeGreaterThan(0);
      expect(xc.resisting).toBe(xc.map);
      // The map figure stays the stage's own: the saved config is the plan's, enemy resistances unlisted.
      expect(ele.fc.stages.fc.configWritten.enemyColdResist).toBeUndefined();
      // A physical source reads the same against resisting rares.
      expect(atk.stages.n.measures!.damage!.resisting).toBe(atk.stages.n.measures!.damage!.map);
    });
  });
});
