/**
 * WU-65 (amendment 4; D-353, D-356, D-358): the anoint, the record's `measures`, the reference hits from the data
 * and the key-figure lines, through `compile_plan`, in process and engine-required.
 *
 * The real server runs in process (`startSessionFixture`, test actions on for Lua queries) over private builds,
 * state and guides folders. Every plan is the committed two-stage fixture with endgame stages added, written into
 * a run folder that `guide_run {new_run}` made. Expectations come from PoB itself (Lua queries, the saved file),
 * the committed data files read here, and a stage compiled without the change, never from the record alone.
 *
 * - AC-P61 (D-358): a recipe notable's anoint compiles: the amulet carries `{enchant}Allocates <notable>`, PoB
 *   grants the node, the stage's figures move against the same stage without it, and the record gives the
 *   tree's three-emotion recipe; a notable without a recipe, an allocated one, or a stage without an amulet is
 *   `isError` naming the stage.
 * - AC-P62 (D-353): `measures.arbiter` has a row per damage type the Arbiter deals and per mixed hit (the hit,
 *   the max hit, the ratio, the verdict); a stage whose physical max hit is below the slam reads `one-shot`, one
 *   with the life to take every hit `survives`; `m` has no Arbiter rows.
 * - AC-P63 (D-353, D-254, D-256): `dps` is the headline and `ehp` is `TotalEHP`; `clearSpeed` follows the bands
 *   (below 2 m slow, below 4 m medium, else fast) and the steps (on-death text one faster, a use over 1 second one
 *   slower), a stage per band and per step; a stage without reference hits gets D-256's whole numbers at its
 *   rung's area level, and one that lists a hit keeps it.
 * - D-363: `clearSpeed` reads the clear skill's first stat set: Earthquake's Impact, not its Aftershock, whose
 *   radius PoB resolves in hash order.
 * - AC-P64 (D-356): `compile_plan`'s reply has a key-figure line after each stage's line.
 *
 * WU-120 (amendment 12 §4, D-449; AC-P84, AC-P85): the Arbiter rows read the Pinnacle pass, so AC-P62 checks them
 * against the same stages compiled separately with `enemyIsBoss: "Pinnacle"`, and AC-P64's line carries the resisting
 * figure and the lowest max hit. The second block is the toughness reading on its own fixtures (the header there).
 */
import fs from 'fs';
import path from 'path';
import os from 'os';
import { afterAll, beforeAll, describe, expect, it, jest } from '@jest/globals';
import { engineDescribe } from '../helpers/engine';
import { startSessionFixture, type SessionFixture } from '../helpers/engineSession';
import { compilePlan, type CompileResult } from '../../src/plan/compiler';
import { loadReferenceData } from '../../src/plan/referenceData';
import { readPin } from '../../src/engine/pinCheck';
import { OFFENSE_STAT_FIELDS } from '../../src/handlers/luaHandlers';
import { PoBLuaApiClient } from '../../src/pobLuaBridge';
import type { ArbiterRow, CompileRecord, StageRecord } from '../../src/plan/record';

const REPO = path.resolve(__dirname, '..', '..');
const FIXTURE = path.join(REPO, 'tests', 'fixtures', 'plans', 'two-stage', 'plan.json');
const DATA = path.join(REPO, 'data', 'enemies');
const ENGINE_TIMEOUT = 300_000;

type Json = Record<string, any>;
const fixturePlan = (): Json => JSON.parse(fs.readFileSync(FIXTURE, 'utf8'));
const facts = (file: string): Json => JSON.parse(fs.readFileSync(path.join(DATA, file), 'utf8')).facts;
const judgment = (ref: string) => ({ kind: 'judgment', ref, confidence: 'L' });

const AMULET = { slot: 'Amulet', text: 'Rarity: Normal\nCrimson Amulet' };
/** A notable with a three-emotion recipe at the pin: "3% increased maximum Life" (tree 0_5, node 1352). */
const NOTABLE = 'Unbending';
/** A notable of the tree without a recipe at the pin. */
const NO_RECIPE = 'Anger Management';
/** From the Warrior start to Devastation (48006), a notable with a recipe; the four attribute nodes on the way. */
const PATH_TO_DEVASTATION = [38646, 23570, 41031, 54232, 16168, 55478, 48006];
const PATH_ATTRIBUTES = [23570, 41031, 54232, 16168];

/**
 * An endgame stage: stage 2's content at `level` on rung `variant`, with an amulet, its clear group's gem
 * replaced by `clear` when given.
 */
function endgameStage(plan: Json, id: string, variant: string, level: number, clear?: string): Json {
  const s = JSON.parse(JSON.stringify(plan.stages[1]));
  const name = { 'entering-maps': 'Entering maps', budget: 'Budget', 'non-budget': 'Non-budget' }[variant];
  Object.assign(s, {
    id,
    loadoutName: `${name} ${id} (L${level}) {${id}}`,
    level,
    progress: 'endgame',
    variant,
    ascendancyPoints: 0,
    variantBasis: { level: judgment('test level'), gemLevels: judgment('test gem levels'), ascendancyPoints: judgment('test points') },
  });
  s.claims = [];
  s.items.slots.push({ ...AMULET });
  if (clear !== undefined) {
    s.skills.groups[1] = { label: clear, enabled: true, role: 'clear', gems: [{ name: clear, level: 10, quality: 0, enabled: true }] };
  }
  return s;
}

/**
 * The measured plan: the campaign stages, then `m`, `b` (anointed), `bplain` (`b` without the anoint), `bs` (life
 * enough to take every Arbiter hit), `n` (listing its own physical hit), and a budget stage per clear band and step.
 */
function ladderPlan(): Json {
  const plan = fixturePlan();
  const add = (s: Json) => plan.stages.push(s);
  add(endgameStage(plan, 'm', 'entering-maps', 70));
  const b = endgameStage(plan, 'b', 'budget', 80);
  b.items.anoint = { notable: NOTABLE, reason: 'test: 3% increased maximum Life off the tree' };
  add(b);
  add(endgameStage(plan, 'bplain', 'budget', 80));
  const bs = endgameStage(plan, 'bs', 'budget', 80);
  bs.config.customMods = [{ text: '+40000 to maximum Life', reason: 'test: life enough to take every Arbiter hit' }];
  add(bs);
  const n = endgameStage(plan, 'n', 'non-budget', 90);
  n.config.scenario.push({
    option: 'enemyPhysicalDamage',
    value: 500,
    source: { file: 'enemies/map-monsters.json', key: 'damage.by-level[82]' },
    tag: judgment('test: a hit the plan states'),
  });
  add(n);
  // Stampede's first stat set, Footsteps, has a base radius of 12 (1.2 m): slow as it is, medium with 250% increased
  // area (2.2 m), fast with 1100% (4.1 m).
  add(endgameStage(plan, 'cs', 'budget', 80, 'Stampede'));
  const cm = endgameStage(plan, 'cm', 'budget', 80, 'Stampede');
  cm.config.customMods = [{ text: '250% increased Area of Effect', reason: 'test: an area from 2 m to below 4 m' }];
  add(cm);
  const cf = endgameStage(plan, 'cf', 'budget', 80, 'Stampede');
  cf.config.customMods = [{ text: '1100% increased Area of Effect', reason: 'test: an area of 4 m or more' }];
  add(cf);
  add(endgameStage(plan, 'cd', 'budget', 80, 'Contagion'));
  add(endgameStage(plan, 'cl', 'budget', 80, 'Leap Slam'));
  add(endgameStage(plan, 'ce', 'budget', 80, 'Earthquake'));
  return plan;
}

engineDescribe('WU-65: the anoint, measures, reference hits and key figures through compile_plan (D-353, D-356, D-358)', () => {
  let f: SessionFixture;
  let record: CompileRecord;
  /** WU-120 (D-449): b, bs and n compiled separately with enemyIsBoss "Pinnacle": the Arbiter rows' max hits. */
  let pinnacle: CompileRecord;
  let text: string;
  let xml: string;

  async function newRun(slug: string, plan: Json): Promise<{ abs: string; plan: string }> {
    const out = await f.call('guide_run', { new_run: slug });
    if (out.isError) throw new Error(`guide_run failed: ${out.text}`);
    const abs = /^Created run folder (.+)$/m.exec(out.text)![1];
    const planPath = /^plan_path for this run: (\S+)$/m.exec(out.text)![1];
    fs.writeFileSync(path.join(f.guides, planPath), `${JSON.stringify(plan, null, 2)}\n`);
    return { abs, plan: planPath };
  }

  async function lua<T>(code: string): Promise<T> {
    const { value } = await f.session.run({ tool: 'test:measures-query', kind: 'read' }, async (ctx) => {
      const reply = await ctx.client.request('__test_eval', { code });
      return reply.result as T;
    });
    return value;
  }

  beforeAll(async () => {
    f = await startSessionFixture({ testActions: true });
    const r = await newRun('measures', ladderPlan());
    const out = await f.call('compile_plan', { plan_path: r.plan, measure_only: true });
    expect({ isError: out.isError, text: out.isError ? out.text : '' }).toEqual({ isError: false, text: '' });
    text = out.text;
    record = JSON.parse(fs.readFileSync(path.join(r.abs, 'compile-record.json'), 'utf8')) as CompileRecord;
    xml = fs.readFileSync(path.join(r.abs, 'compiled-build.xml'), 'utf8');
    const twin = ladderPlan();
    twin.stages = twin.stages.filter((s: Json) => ['b', 'bs', 'n'].includes(s.id));
    twin.ledger = [];
    for (const s of twin.stages) s.config.scenario.find((e: Json) => e.option === 'enemyIsBoss').value = 'Pinnacle';
    const p = await newRun('measures-pinnacle', twin);
    const outP = await f.call('compile_plan', { plan_path: p.plan, measure_only: true });
    expect({ isError: outP.isError, text: outP.isError ? outP.text : '' }).toEqual({ isError: false, text: '' });
    pinnacle = JSON.parse(fs.readFileSync(path.join(p.abs, 'compile-record.json'), 'utf8')) as CompileRecord;
  }, ENGINE_TIMEOUT);

  afterAll(async () => f?.close(), 60_000);

  it('AC-P61 (D-358): the anoint goes on the amulet as {enchant}Allocates <notable>, and PoB grants the notable: the stage\'s life moves', async () => {
    // The saved file's anointed amulet; the plan's amulet text has no enchant.
    const items = [...xml.matchAll(/<Item\b[^>]*>([\s\S]*?)<\/Item>/g)].map((m) => m[1]);
    const anointed = items.filter((t) => /\{enchant\}Allocates /.test(t));
    expect(anointed).toHaveLength(1);
    expect(anointed[0]).toMatch(/Crimson Amulet/);
    expect(anointed[0]).toMatch(new RegExp(`^\\{enchant\\}Allocates ${NOTABLE}$`, 'm'));
    const node = await lua<number>(`return main:LoadTree(latestTreeVersion).notableMap['${NOTABLE.toLowerCase()}'].id`);
    expect(record.stages.b.anoint?.node).toBe(node);
    // No path and no point: the compile held PoB's allocation to the plan's tree (D-213), which doesn't list it.
    expect(ladderPlan().stages.find((s: Json) => s.id === 'b').tree.nodes).not.toContain(node);
    // "3% increased maximum Life": b's life is above bplain's, the same stage without the anoint.
    expect(record.stages.b.outputs.Life).toBeGreaterThan(record.stages.bplain.outputs.Life);
    expect(record.stages.b.outputs.Life / record.stages.bplain.outputs.Life).toBeCloseTo(1.03, 2);
    expect(record.stages.bplain.anoint).toBeUndefined();
  }, ENGINE_TIMEOUT);

  it("AC-P61 (D-358): the record gives the notable's recipe of three emotions, as the tree holds it, with PoB's item names", async () => {
    const recipe = await lua<string[]>(`return main:LoadTree(latestTreeVersion).notableMap['${NOTABLE.toLowerCase()}'].recipe`);
    expect(recipe).toHaveLength(3);
    const a = record.stages.b.anoint!;
    expect(a.notable).toBe(NOTABLE);
    expect(a.recipe).toEqual(recipe);
    const names = await lua<string[]>(
      `local out = {} for _, e in pairs(data.emotions) do if not e.radiusJewel then out[#out + 1] = e.name end end return out`,
    );
    expect(a.emotions).toHaveLength(3);
    a.emotions.forEach((name, i) => {
      expect({ name, known: names.includes(name), word: name.endsWith(` ${recipe[i]}`) }).toEqual({ name, known: true, word: true });
    });
  }, ENGINE_TIMEOUT);

  it('AC-P61 (D-358): a notable without a recipe, an allocated one and a stage without an amulet are each isError naming the stage; nothing is compiled', async () => {
    const plan = fixturePlan();
    const norecipe = endgameStage(plan, 'b', 'budget', 80);
    norecipe.items.anoint = { notable: NO_RECIPE, reason: 'test' };
    const allocated = endgameStage(plan, 'n', 'non-budget', 90);
    allocated.tree.nodes = [...PATH_TO_DEVASTATION];
    allocated.tree.attributeChoices = PATH_ATTRIBUTES.map((node) => ({ node, attribute: 'strength' }));
    allocated.items.anoint = { notable: 'Devastation', reason: 'test' };
    const bare = endgameStage(plan, 'b2', 'budget', 80);
    bare.items.slots = bare.items.slots.filter((s: Json) => s.slot !== 'Amulet');
    bare.items.anoint = { notable: NOTABLE, reason: 'test' };
    plan.stages.push(norecipe, allocated, bare);
    const r = await newRun('anoint-refused', plan);
    const out = await f.call('compile_plan', { plan_path: r.plan, measure_only: true });
    expect(out.isError).toBe(true);
    const lines = out.text.split('\n').filter((l) => /items\.anoint/.test(l));
    expect(lines).toEqual([
      expect.stringMatching(new RegExp(`^stage b: items\\.anoint: notable "${NO_RECIPE}" \\(node \\d+\\) has no recipe of three Distilled Emotions`)),
      expect.stringMatching(/^stage n: items\.anoint: notable "Devastation" \(node 48006\) is already allocated on the stage's tree/),
      expect.stringMatching(new RegExp(`^stage b2: items\\.anoint: the stage equips no amulet to anoint with "${NOTABLE}"`)),
    ]);
    // Only the anoints are wrong: the path to Devastation is connected, so no other defect is reported.
    expect(out.text).toMatch(/has 3 defects; nothing was compiled/);
    expect(fs.existsSync(path.join(r.abs, 'compile-record.json'))).toBe(false);
  }, ENGINE_TIMEOUT);

  it('AC-P62 (D-353): measures.arbiter has a row per damage type and mixed hit, each the largest hit\'s top roll over the max hit (WU-120: the Pinnacle pass\'s); the slam one-shots b, and bs survives every hit', () => {
    const arbiter = facts('arbiter-of-divinity.json');
    // The data's hits by type: the largest top roll of each plain type and each mix.
    const largest = new Map<string, { id: string; max: number }>();
    for (const [key, fact] of Object.entries<Json>(arbiter)) {
      const m = /^hits\.([a-z0-9-]+)$/.exec(key);
      if (!m) continue;
      const type = arbiter[`${key}.type`].value as string;
      if (!largest.has(type) || fact.value.max > largest.get(type)!.max) largest.set(type, { id: m[1], max: fact.value.max });
    }
    expect([...largest.keys()].sort()).toEqual(['lightning', 'physical', 'physical-lightning']);
    const cap = (t: string) => `${t[0].toUpperCase()}${t.slice(1)}MaximumHitTaken`;
    for (const id of ['b', 'bs', 'n']) {
      // WU-120 (D-449): the max hits of the stage against a Pinnacle boss, PoB's own measure in a separate compile.
      const out = pinnacle.stages[id].outputs;
      const a = record.stages[id].measures!.arbiter!;
      expect({ id, types: a.rows.map((r) => r.type).sort() }).toEqual({ id, types: [...largest.keys()].sort() });
      for (const row of a.rows) {
        const want = largest.get(row.type)!;
        const types = row.type.split('-');
        const ratio = types.reduce((sum, t) => sum + want.max / types.length / out[cap(t)], 0);
        expect({ id, type: row.type, hitId: row.hitId, hit: row.hit, mixed: row.mixed }).toEqual({ id, type: row.type, hitId: want.id, hit: want.max, mixed: types.length > 1 });
        expect(row.ratio).toBeCloseTo(ratio, 9);
        expect(row.maxHit).toBeCloseTo(types.length === 1 ? out[cap(types[0])] : want.max / ratio, 6);
        expect({ id, type: row.type, verdict: row.verdict }).toEqual({ id, type: row.type, verdict: ratio < 1 ? 'survives' : 'one-shot' });
      }
    }
    // b's physical max hit is below the slam (3486 at its top roll): one-shot.
    const slam = largest.get('physical')!;
    expect(slam.id).toBe('extendo-spear-combo-slam-1');
    expect(pinnacle.stages.b.outputs.PhysicalMaximumHitTaken).toBeLessThan(slam.max);
    const bPhys = record.stages.b.measures!.arbiter!.rows.find((r) => r.type === 'physical')!;
    expect(bPhys.verdict).toBe('one-shot');
    expect(record.stages.b.measures!.arbiter!.verdict).toBe('one-shot');
    // bs takes every hit.
    expect(record.stages.bs.measures!.arbiter!.rows.map((r) => r.verdict)).toEqual(['survives', 'survives', 'survives']);
    expect(record.stages.bs.measures!.arbiter!.verdict).toBe('survives');
    // The entering-maps rung and the campaign have no Arbiter rows.
    expect(record.stages.m.measures!.arbiter).toBeUndefined();
    expect(record.stages['2'].measures).toBeUndefined();
  });

  it('AC-P63 (D-353, D-294): dps is the named source\'s Count-scaled TotalDPS and ehp is TotalEHP, on every endgame stage', () => {
    for (const id of ['m', 'b', 'bplain', 'bs', 'n', 'cs', 'cm', 'cf', 'cd', 'cl', 'ce']) {
      const s = record.stages[id];
      // Stage 2's main selection: group 1 (Boneshatter, the rolled group), active skill 1, stat set 1.
      expect({ id, dps: s.measures!.dps, ehp: s.measures!.ehp }).toEqual({
        id,
        dps: s.countedSkillOutputs.g1s1p1.fields.TotalDPS,
        ehp: s.outputs.TotalEHP,
      });
      expect(s.measures!.dps).toBeGreaterThan(0);
    }
  });

  it('AC-P63 (D-353): clearSpeed follows the band of the clear skill\'s area and steps a band for on-death text and a long use', () => {
    // D-363: the clear skill's first stat set (group 2, active skill 1).
    const radius = (id: string) => record.stages[id].skillOutputs.g2s1p1.fields.AreaOfEffectRadiusMetres ?? 0;
    const band = (r: number) => (r < 2 ? 'slow' : r < 4 ? 'medium' : 'fast');
    const rows = ['cs', 'cm', 'cf', 'cd', 'cl'].map((id) => {
      const c = record.stages[id].measures!.clearSpeed;
      return { id, skill: c.skill, radius: c.radiusMetres, band: c.band, onDeath: c.onDeath, longUse: c.longUse, speed: c.speed, rough: c.rough };
    });
    for (const r of rows) expect({ id: r.id, radius: r.radius, band: r.band }).toEqual({ id: r.id, radius: radius(r.id), band: band(radius(r.id)) });
    for (const id of ['cs', 'cm', 'cf', 'cd', 'cl']) expect({ id, key: record.stages[id].measures!.clearSpeed.key }).toEqual({ id, key: 'g2s1p1' });
    expect(rows).toEqual([
      // A band each, with no step, by Stampede's Footsteps: as it is (under 2 m), with 250% increased area (2 m to
      // below 4 m), and with 1100% increased area (4 m or more).
      { id: 'cs', skill: 'Stampede', radius: expect.any(Number), band: 'slow', onDeath: false, longUse: false, speed: 'slow', rough: true },
      { id: 'cm', skill: 'Stampede', radius: expect.any(Number), band: 'medium', onDeath: false, longUse: false, speed: 'medium', rough: true },
      { id: 'cf', skill: 'Stampede', radius: expect.any(Number), band: 'fast', onDeath: false, longUse: false, speed: 'fast', rough: true },
      // Contagion spreads itself when its enemy dies: a step faster. Leap Slam's use takes over 1 second: a step slower.
      { id: 'cd', skill: 'Contagion', radius: expect.any(Number), band: 'slow', onDeath: true, longUse: false, speed: 'medium', rough: true },
      { id: 'cl', skill: 'Leap Slam', radius: expect.any(Number), band: 'medium', onDeath: false, longUse: true, speed: 'slow', rough: true },
    ]);
    const speedOf = (id: string) => record.stages[id].skillOutputs[record.stages[id].measures!.clearSpeed.key!].fields.Speed;
    expect(speedOf('cl')).toBeLessThan(1);
    for (const id of ['cs', 'cm', 'cf', 'cd']) expect({ id, slow: speedOf(id) < 1 }).toEqual({ id, slow: false });
  });

  it("D-363: an Earthquake clear stage reads its first stat set, Impact: its own 18 base radius, 1.8 m, slow", () => {
    const s = record.stages.ce;
    const c = s.measures!.clearSpeed;
    // Impact's base radius is 18 (Data/Skills/act_str.lua), and the stage has no area modifiers: 1.8 m.
    expect({ label: s.skillOutputs.g2s1p1.statSetLabel, radius: s.skillOutputs.g2s1p1.fields.AreaOfEffectRadiusMetres }).toEqual({ label: 'Impact', radius: 1.8 });
    expect({ skill: c.skill, key: c.key, radius: c.radiusMetres, band: c.band }).toEqual({ skill: 'Earthquake', key: 'g2s1p1', radius: 1.8, band: 'slow' });
  });

  it("AC-P63 (D-353, D-254, D-256): an endgame stage without reference hits gets D-256's whole numbers at its rung's area level; a hit the plan lists stays", () => {
    const monsters = facts('map-monsters.json');
    const way = facts('waystones.json');
    const damage = (level: number) => monsters['damage.by-level'].value[String(level)] as number;
    const inc = way['mods.increased-monster-damage'].value.max as number;
    const extra = way['mods.extra-damage-as-element'].value.max as number;
    const ceil2 = (v: number) => Math.ceil(Math.round(v * 100) / 100);
    const offset = way['area-level.offset'].value as number;
    const levels: Record<string, number> = { m: offset + 5, b: offset + 15, n: way['area-level.max'].value as number };
    expect(levels).toEqual({ m: 69, b: 79, n: 82 });
    for (const [id, level] of Object.entries(levels)) {
      const phys = ceil2(damage(level) * (1 + inc / 100));
      const element = ceil2(damage(level) * (1 + inc / 100) * (extra / 100));
      const want = {
        enemyPhysicalDamage: id === 'n' ? 500 : phys,
        enemyFireDamage: element,
        enemyColdDamage: element,
        enemyLightningDamage: element,
        enemyChaosDamage: element,
      };
      const s = record.stages[id];
      const written = Object.fromEntries(Object.keys(want).map((k) => [k, s.configWritten[k]]));
      expect({ id, written }).toEqual({ id, written: want });
      // PoB's config set holds each as an explicit scenario input.
      for (const [option, value] of Object.entries(want)) {
        expect({ id, option, effective: s.configEffective[option] }).toEqual({ id, option, effective: { value, origin: 'explicit', class: 'scenario' } });
      }
    }
    expect(record.stages.b.configWritten.enemyPhysicalDamage).toBe(402);
    expect(record.stages.b.configWritten.enemyFireDamage).toBe(97);
    // A campaign stage gets none.
    expect(record.stages['2'].configWritten.enemyPhysicalDamage).toBeUndefined();
  });

  it('AC-P64 (D-356): the reply has a key-figure line after each stage line, with its DPS, life, ES, EHP, resistances and finding counts, and on the endgame its Arbiter verdict and clear speed', () => {
    const lines = text.split('\n');
    const round = (v: number | null | undefined) => (typeof v === 'number' ? String(Math.round(v)) : '?');
    for (const id of record.stagesCompiled) {
      const s = record.stages[id];
      const at = lines.findIndex((l) => l.startsWith(`Stage ${id} "`));
      expect(at).toBeGreaterThanOrEqual(0);
      const line = lines[at + 1];
      const o = s.outputs;
      const dps = s.measures?.dps ?? s.countedOutputs.fields.TotalDPS;
      // WU-111 (D-437): an endgame variant stage leads with the named source's damage figure against map monsters and a
      // Pinnacle boss (its measures' `damage`); a campaign stage keeps the headline DPS.
      const damage = s.measures?.damage;
      // WU-120 (Appendix A): the resisting figure between the two (D-454), and the lowest max hit after EHP (D-449).
      const low = s.measures?.toughness?.lowestMaxHit;
      const want = [
        damage !== undefined
          ? `damage ${round(damage.map)} against map monsters, ${round(damage.resisting)} against resisting rares, ${round(damage.boss)} against a Pinnacle boss; life `
          : `DPS ${round(dps)}`,
        `life ${round(o.Life)}`,
        `ES ${round(o.EnergyShield)}`,
        s.measures !== undefined ? `EHP ${round(o.TotalEHP)}; lowest max hit ${round(low!.value)} ${low!.type}; resists ` : `EHP ${round(o.TotalEHP)}; resists `,
        `resists ${round(o.FireResist)}/${round(o.ColdResist)}/${round(o.LightningResist)}/${round(o.ChaosResist)} (fire/cold/lightning/chaos)`,
        `findings V1 ${s.v1!.findings.length}, V2 ${s.v2!.findings.length}`,
      ];
      const arbiter = s.measures?.arbiter;
      if (arbiter) want.push(`Arbiter ${arbiter.verdict}`);
      if (s.measures) want.push(`clear ${s.measures.clearSpeed.speed} (rough)`);
      expect({ id, starts: line.startsWith('  Key figures: ') }).toEqual({ id, starts: true });
      for (const part of want) expect({ id, line, has: line.includes(part) }).toEqual({ id, line, has: true });
      if (!s.measures) expect({ id, endgame: /Arbiter|clear |lowest max hit/.test(line) }).toEqual({ id, endgame: false });
      // No ladder stage evades or deflects at the Arbiter's accuracy: no hits survived.
      expect({ id, avoid: s.measures?.arbiter?.avoid, hits: line.includes('hits survived') }).toEqual({ id, avoid: undefined, hits: false });
    }
    // b names the hit that one-shots it.
    const bLine = lines[lines.findIndex((l) => l.startsWith('Stage b "')) + 1];
    const worst = record.stages.b.measures!.arbiter!.worst!;
    expect(bLine).toContain(`Arbiter one-shot (worst: ${worst.type} hit ${worst.hitId}, ${worst.ratio.toFixed(2)} of max hit)`);
  });
});

/**
 * WU-120 (amendment 12 §4, D-449; AC-P84, AC-P85): the toughness reading through `compile_plan`, engine-required. Every
 * expected figure comes from PoB itself in a separate compile (the same stages with `enemyIsBoss: "Pinnacle"`, or with the
 * conditioned read's four options in their scenario), from PoB's formulas as §4 names them, or from the data, never from
 * the record's measures alone. The fixtures are the two-stage fixture's stage 2 at level 90, with custom modifiers from
 * PoB's own modifier lines and bases from the pinned data (Leather Vest, Rawhide Boots: evasion bases with no armour):
 *
 * - `nE`: +20000 evasion, +3000 deflection rating and +2000 life on evasion gear (no armour): one-shot by the slams, the
 *   deflected hit survived; `nA`: the same with +6000 armour, where PoB applies armour to the full hit before deflection;
 * - `nCI`: Chaos Inoculation with +2000 energy shield: immune to chaos; `bP`: the plain stage, with neither evasion nor
 *   deflection at the Arbiter's accuracy.
 *
 * The data copies (`tests/fixtures/enemies/`) are the Arbiter's data with the slam, or the smaller slam, unevadable, and
 * with a chaos hit; they are compiled through `compilePlan` itself with that data.
 */
const EVASION_GEAR = [
  { slot: 'Body Armour', text: 'Rarity: Normal\nLeather Vest' },
  { slot: 'Boots', text: 'Rarity: Normal\nRawhide Boots' },
];
const CONDITIONED: [string, boolean | number][] = [
  ['EHPUnluckyWorstOf', 2],
  ['conditionBeenHitRecently', true],
  ['windDancerStacks', 0],
  ['conditionEnemyBlinded', false],
];
const ARBITER_ACCURACY = facts('arbiter-of-divinity.json')['base.accuracy'].value as number;
const MAX_HIT = (t: string) => `${t[0].toUpperCase()}${t.slice(1)}MaximumHitTaken`;
const TYPES = ['physical', 'fire', 'cold', 'lightning', 'chaos'];
/** PoB's `round` (Modules/Common.lua): half up. */
const pobRound = (x: number) => Math.floor(x + 0.5);
/** PoB's melee evade chance for a build with no evade-chance modifiers: 100 − calcs.monsterHitChance (CalcDefence.lua:40-46), capped at 95. */
const evadeAt = (evasion: number, accuracy: number) =>
  Math.min(95, 100 - Math.max(Math.min(pobRound((1 - (0.95 * evasion) / (evasion + 4 * accuracy)) * 100), 100), 5));
/** PoB's calcs.deflectChance (CalcDefence.lua:48-54), with its 95% cap. */
const deflectAt = (deflection: number, accuracy: number) =>
  deflection < 1 ? 0 : Math.max(Math.min(100 - pobRound((accuracy / (accuracy + deflection * 0.12)) * 150 - 50), 95), 0);

/** One leaf per line of a saved file's config sets, attributes in name order (PoB's save orders them per process). */
function savedConfigSets(xmlText: string): Record<string, string[]> {
  const sets: Record<string, string[]> = {};
  for (const m of xmlText.matchAll(/<ConfigSet\b([^>]*)>([\s\S]*?)<\/ConfigSet>/g)) {
    const title = /\btitle="([^"]*)"/.exec(m[1])![1];
    sets[title] = m[2]
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l !== '')
      .map((l) => {
        const e = /^<(\w+)((?:\s+[\w-]+="[^"]*")*)\s*\/>$/.exec(l);
        return e === null ? l : `<${e[1]} ${[...e[2].matchAll(/([\w-]+)="([^"]*)"/g)].map((a) => `${a[1]}="${a[2]}"`).sort().join(' ')}/>`;
      })
      .sort();
  }
  return sets;
}

engineDescribe('WU-120: the toughness reading, the Arbiter on the Pinnacle pass and hits survived (D-449, AC-P84)', () => {
  let f: SessionFixture;
  let rec: CompileRecord;
  let recText: string;
  let recXml: string;
  let twin: CompileRecord;
  let conditioned: CompileRecord;
  let without: CompileRecord;
  let withoutXml: string;
  let slamUnevadable: CompileRecord;
  let slam2Unevadable: CompileRecord;
  let chaosHit: CompileRecord;
  let miscBefore: Json;
  let miscAfter: Json;
  let deflectAfter: number;

  /** The toughness plan, schema 7: the stages the header lists. */
  function toughnessPlan(): Json {
    const plan = fixturePlan();
    plan.schemaVersion = 7;
    const stage = (id: string, variant: string, mods: string[], evasionGear: boolean): Json => {
      const s = endgameStage(plan, id, variant, 90);
      if (evasionGear) s.items.slots = [...s.items.slots.filter((i: Json) => i.slot !== 'Body Armour' && i.slot !== 'Boots'), ...EVASION_GEAR];
      if (mods.length > 0) s.config.customMods = mods.map((text) => ({ text, reason: `test: ${text}` }));
      return s;
    };
    const evasion = ['+20000 to Evasion Rating', '+3000 to Deflection Rating', '+2000 to maximum Life'];
    plan.stages = [
      stage('nE', 'non-budget', evasion, true),
      stage('nA', 'non-budget', [...evasion, '+6000 to Armour'], true),
      stage('nCI', 'non-budget', ['Chaos Inoculation', '+2000 to maximum Energy Shield'], false),
      stage('bP', 'budget', [], false),
    ];
    plan.ledger = [];
    return plan;
  }

  /** The plan's stages `ids`, each with `edit` applied. */
  const subset = (ids: string[], edit: (s: Json) => void): Json => {
    const plan = toughnessPlan();
    plan.stages = plan.stages.filter((s: Json) => ids.includes(s.id));
    plan.stages.forEach(edit);
    return plan;
  };

  async function newRun(slug: string, plan: Json): Promise<{ abs: string; plan: string }> {
    const out = await f.call('guide_run', { new_run: slug });
    if (out.isError) throw new Error(`guide_run failed: ${out.text}`);
    const abs = /^Created run folder (.+)$/m.exec(out.text)![1];
    const planPath = /^plan_path for this run: (\S+)$/m.exec(out.text)![1];
    fs.writeFileSync(path.join(f.guides, planPath), `${JSON.stringify(plan, null, 2)}\n`);
    return { abs, plan: planPath };
  }

  async function compiled(slug: string, plan: Json): Promise<{ record: CompileRecord; text: string; xml: string }> {
    const r = await newRun(slug, plan);
    const out = await f.call('compile_plan', { plan_path: r.plan, measure_only: true });
    expect({ slug, isError: out.isError, text: out.isError ? out.text : '' }).toEqual({ slug, isError: false, text: '' });
    return {
      record: JSON.parse(fs.readFileSync(path.join(r.abs, 'compile-record.json'), 'utf8')) as CompileRecord,
      text: out.text,
      xml: fs.readFileSync(path.join(r.abs, 'compiled-build.xml'), 'utf8'),
    };
  }

  /** A measure-only compile through `compilePlan` itself, with the data's Arbiter file replaced by the fixture copy `name`. */
  async function withArbiterData(slug: string, plan: Json, name: string): Promise<CompileRecord> {
    const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pob2-wu120-data-'));
    fs.cpSync(path.join(REPO, 'data'), dataDir, { recursive: true });
    fs.copyFileSync(path.join(REPO, 'tests', 'fixtures', 'enemies', `${name}.json`), path.join(dataDir, 'enemies', 'arbiter-of-divinity.json'));
    const r = await newRun(slug, plan);
    const pin = readPin();
    const refuse = () => {
      throw new Error('a measure-only compile writes nothing into the builds folder');
    };
    const { value } = await f.session.run({ tool: 'compile_plan', kind: 'load' }, async (ctx): Promise<CompileResult> =>
      compilePlan(
        {
          ctx,
          pobDirectory: f.builds,
          stateDir: path.join(f.tmp, 'state'),
          guidesDirectory: f.guides,
          writer: { checkBuildFile: refuse, writeBuildFile: refuse } as never,
          referenceData: () => loadReferenceData(dataDir),
          offenseFields: OFFENSE_STAT_FIELDS,
          engine: { pobTag: pin.tag, pobCommit: pin.commit },
          clock: () => performance.now(),
          wallClock: () => new Date(),
        },
        { mode: 'measure-only', planPath: r.plan },
      ),
    );
    return value.record;
  }

  async function lua<T>(code: string): Promise<T> {
    const { value } = await f.session.run({ tool: 'test:toughness-query', kind: 'read' }, async (ctx) => (await ctx.client.request('__test_eval', { code })).result as T);
    return value;
  }

  const MISC = String.raw`
    local t = {}
    for k, v in pairs(data.misc) do
      if type(v) == 'number' and (v ~= v or v == math.huge or v == -math.huge) then t[k] = tostring(v)
      elseif type(v) ~= 'table' and type(v) ~= 'function' then t[k] = v end
    end
    return t`;

  beforeAll(async () => {
    f = await startSessionFixture({ testActions: true });
    // The engine is running before the first compile, so data.misc is read as PoB loaded it.
    const info = await f.call('lua_get_build_info');
    if (info.isError) throw new Error(info.text);
    miscBefore = await lua<Json>(MISC);
    const main = await compiled('toughness', toughnessPlan());
    [rec, recText, recXml] = [main.record, main.text, main.xml];
    miscAfter = await lua<Json>(MISC);
    deflectAfter = await lua<number>('return build.calcsTab.calcs.deflectChance(3000, 3786)');
    twin = (await compiled('toughness-pinnacle', subset(['nE', 'nA', 'nCI', 'bP'], (s) => {
      s.config.scenario.find((e: Json) => e.option === 'enemyIsBoss').value = 'Pinnacle';
    }))).record;
    conditioned = (await compiled('toughness-conditioned', subset(['nE', 'nCI'], (s) => {
      for (const [option, value] of CONDITIONED) {
        s.config.scenario.push({ option, value, source: { file: 'enemies/arbiter-of-divinity.json', key: 'base.accuracy' }, tag: judgment('test: the conditioned read') });
      }
    }))).record;
    // The same plan without the new passes: compile_stage's params lose the Arbiter's chances, the resisting measure and
    // the conditioned read.
    const original = PoBLuaApiClient.prototype.request;
    jest.spyOn(PoBLuaApiClient.prototype, 'request').mockImplementation(async function (this: PoBLuaApiClient, ...args: any[]) { // eslint-disable-line @typescript-eslint/no-explicit-any
      if (args[0] === 'compile_stage') {
        const { resisting: _r, conditioned: _c, ...rest } = args[1];
        args[1] = { ...rest, ...(rest.boss !== undefined ? { boss: { groups: rest.boss.groups, fields: rest.boss.fields } } : {}) };
      }
      return (original as any).apply(this, args); // eslint-disable-line @typescript-eslint/no-explicit-any
    } as any); // eslint-disable-line @typescript-eslint/no-explicit-any
    try {
      const w = await compiled('toughness-without', toughnessPlan());
      [without, withoutXml] = [w.record, w.xml];
    } finally {
      jest.restoreAllMocks();
    }
    slamUnevadable = await withArbiterData('toughness-slam', subset(['nE'], () => undefined), 'arbiter-slam-unevadable');
    slam2Unevadable = await withArbiterData('toughness-slam-2', subset(['nE'], () => undefined), 'arbiter-slam-2-unevadable');
    chaosHit = await withArbiterData('toughness-chaos', subset(['nE', 'nCI'], () => undefined), 'arbiter-chaos-hit');
  }, ENGINE_TIMEOUT * 2);

  afterAll(async () => f?.close(), 60_000);

  const rowOf = (s: StageRecord, type: string): ArbiterRow => s.measures!.arbiter!.rows.find((r) => r.type === type)!;

  describe('measures.toughness (§4)', () => {
    it("AC-P84: lowestMaxHit is the least of the stage's five <Type>MaximumHitTaken, with its type", () => {
      for (const id of ['nE', 'nA', 'bP']) {
        const o = rec.stages[id].outputs;
        const least = Math.min(...TYPES.map((t) => o[MAX_HIT(t)]));
        const low = rec.stages[id].measures!.toughness!.lowestMaxHit!;
        expect({ id, value: low.value, ofType: o[MAX_HIT(low.type)], immune: rec.stages[id].measures!.toughness!.immune }).toEqual({ id, value: least, ofType: least, immune: [] });
      }
    });

    it('AC-P84: a Chaos Inoculation stage records immune ["chaos"] and its lowest max hit from the other four', () => {
      const s = rec.stages.nCI;
      expect(s.outputs.ChaosMaximumHitTaken).toBeUndefined();
      expect(s.measures!.toughness!.immune).toEqual(['chaos']);
      const four = ['physical', 'fire', 'cold', 'lightning'];
      const least = Math.min(...four.map((t) => s.outputs[MAX_HIT(t)]));
      expect(s.measures!.toughness!.lowestMaxHit!.value).toBe(least);
      expect(four).toContain(s.measures!.toughness!.lowestMaxHit!.type);
    });

    it("AC-P84: chance equals the formula on the record's ConfiguredNotHitChance and ConfiguredDamageChance", () => {
      for (const id of ['nE', 'nA', 'nCI', 'bP']) {
        const o = rec.stages[id].outputs;
        const c = rec.stages[id].measures!.toughness!.chance!;
        const factor = 1 / ((1 - o.ConfiguredNotHitChance / 100) * (o.ConfiguredDamageChance / 100));
        expect({ id, notHit: c.notHit, damage: c.damage }).toEqual({ id, notHit: o.ConfiguredNotHitChance, damage: o.ConfiguredDamageChance });
        expect(c.factor).toBeCloseTo(factor, 9);
        expect(c.share).toBeCloseTo(1 - 1 / factor, 9);
      }
      // The evasion stage's chance layers carry a real share of its EHP.
      expect(rec.stages.nE.measures!.toughness!.chance!.share).toBeGreaterThan(0.5);
    });

    it("AC-P84: on n, conditioned.ehp equals TotalEHP in a separate compile with the four options set as §4 says, and its lowest max hit that compile's; the band's EHP stays the stage's own", () => {
      for (const id of ['nE', 'nCI']) {
        const c = rec.stages[id].measures!.toughness!.conditioned!;
        const o = conditioned.stages[id].outputs;
        expect({ id, ehp: c.ehp }).toEqual({ id, ehp: o.TotalEHP });
        const four = TYPES.filter((t) => o[MAX_HIT(t)] !== undefined);
        const least = Math.min(...four.map((t) => o[MAX_HIT(t)]));
        expect({ id, low: c.lowestMaxHit!.value, ofType: o[MAX_HIT(c.lowestMaxHit!.type)] }).toEqual({ id, low: least, ofType: least });
        expect(rec.stages[id].measures!.ehp).toBe(rec.stages[id].outputs.TotalEHP);
      }
      // Every condition against the evasion build lowers its EHP; the budget rung has no conditioned read.
      expect(rec.stages.nE.measures!.toughness!.conditioned!.ehp!).toBeLessThan(rec.stages.nE.outputs.TotalEHP);
      expect(rec.stages.bP.measures!.toughness!.conditioned).toBeUndefined();
    });

    it("AC-P84: the saved file's config sets and configWritten equal a compile without the new passes", () => {
      for (const id of rec.stagesCompiled) expect({ id, written: rec.stages[id].configWritten }).toEqual({ id, written: without.stages[id].configWritten });
      expect(savedConfigSets(recXml)).toEqual(savedConfigSets(withoutXml));
      expect(Object.keys(savedConfigSets(recXml)).length).toBeGreaterThan(0);
      // The compile without them has no chances, resisting figure or conditioned read; the stage's own figures are the same.
      expect(without.stages.nE.measures!.arbiter!.avoid).toBeUndefined();
      expect(without.stages.nE.measures!.toughness!.conditioned).toBeUndefined();
      for (const id of rec.stagesCompiled) expect({ id, outputs: rec.stages[id].outputs }).toEqual({ id, outputs: without.stages[id].outputs });
    });
  });

  describe('the Arbiter on the Pinnacle pass, with avoid (§4)', () => {
    it("AC-P84: measures.arbiter reads the Pinnacle pass's max hits: each row's max hit is the separate Pinnacle compile's", () => {
      for (const id of ['nE', 'nA', 'bP']) {
        for (const type of ['physical', 'lightning']) {
          expect({ id, type, maxHit: rowOf(rec.stages[id], type).maxHit }).toEqual({ id, type, maxHit: twin.stages[id].outputs[MAX_HIT(type)] });
        }
      }
    });

    it("AC-P84: avoid's evade and deflect equal PoB's formulas at accuracy 3,786 on the build's MeleeEvasion and DeflectionRating; method is the spike's, pass", () => {
      expect(ARBITER_ACCURACY).toBe(3786);
      for (const id of ['nE', 'nA']) {
        const o = twin.stages[id].outputs;
        const want = { accuracy: 3786, evade: evadeAt(o.MeleeEvasion, 3786), deflect: deflectAt(o.DeflectionRating, 3786), deflectEffect: o.DeflectEffect, method: 'pass' };
        expect({ id, avoid: rec.stages[id].measures!.arbiter!.avoid }).toEqual({ id, avoid: want });
        // At the map enemy's lower accuracy PoB's own chances are higher.
        expect(rec.stages[id].outputs.MeleeEvadeChance).toBeGreaterThan(want.evade);
        expect(want.evade).toBeGreaterThan(0);
        expect(want.deflect).toBeGreaterThan(0);
      }
    });

    it('AC-P84: a stage with neither evasion nor deflection at the Arbiter has no avoid', () => {
      for (const id of ['bP', 'nCI']) {
        const o = twin.stages[id].outputs;
        expect({ id, evade: evadeAt(o.MeleeEvasion ?? 0, 3786), deflect: deflectAt(o.DeflectionRating ?? 0, 3786), avoid: rec.stages[id].measures!.arbiter!.avoid }).toEqual({ id, evade: 0, deflect: 0, avoid: undefined });
        expect(rec.stages[id].measures!.arbiter!.rows.map((r) => r.hitsSurvived)).toEqual(rec.stages[id].measures!.arbiter!.rows.map((r) => (r.verdict === 'survives' ? 100 : 0)));
      }
    });

    it("AC-P84: each row's hitsSurvived equals Names' rule on its deflectedRatio; the slams one-shot nE and its deflected hit survives", () => {
      for (const id of ['nE', 'nA']) {
        const { evade, deflect } = rec.stages[id].measures!.arbiter!.avoid!;
        for (const r of rec.stages[id].measures!.arbiter!.rows) {
          const want = r.verdict === 'survives' ? 100 : r.deflectedRatio! < 1 ? evade + ((100 - evade) * deflect) / 100 : evade;
          expect({ id, type: r.type, deflectedVerdict: r.deflectedVerdict }).toEqual({ id, type: r.type, deflectedVerdict: r.deflectedRatio! < 1 ? 'survives' : 'one-shot' });
          expect({ id, type: r.type, hitsSurvived: Math.round(r.hitsSurvived! * 1e9) }).toEqual({ id, type: r.type, hitsSurvived: Math.round(want * 1e9) });
        }
      }
      const phys = rowOf(rec.stages.nE, 'physical');
      expect([phys.verdict, phys.deflectedVerdict]).toEqual(['one-shot', 'survives']);
      expect(phys.hitsSurvived).toBeGreaterThan(rec.stages.nE.measures!.arbiter!.avoid!.evade);
    });

    it("the deflected ratio is a pass (the G9 spike): without armour it is the ratio × (1 − DeflectEffect / 100); with armour PoB's deflected max hit is below the formula's", () => {
      const de = rec.stages.nE.measures!.arbiter!.avoid!.deflectEffect;
      for (const r of rec.stages.nE.measures!.arbiter!.rows) expect(r.deflectedRatio!).toBeCloseTo(r.ratio! * (1 - de / 100), 3);
      const phys = rowOf(rec.stages.nA, 'physical');
      expect(phys.deflectedRatio!).toBeGreaterThan(phys.ratio! * (1 - de / 100) * 1.02);
      const light = rowOf(rec.stages.nA, 'lightning');
      expect(light.deflectedRatio!).toBeCloseTo(light.ratio! * (1 - de / 100), 3);
    });

    it('AC-P84: after a compile with the deflected-ratio pass, data.misc holds its values from before, and PoB\'s deflect formula is its own', () => {
      expect(miscAfter).toEqual(miscBefore);
      expect(miscBefore.DeflectionChanceCap).toBe(95);
      expect(deflectAfter).toBe(deflectAt(3000, 3786));
    });

    it("AC-P84: with a data copy whose slam is unevadable, the slam's row counts an evade chance of 0 and the other rows don't change", () => {
      const base = rec.stages.nE.measures!.arbiter!;
      const got = slamUnevadable.stages.nE.measures!.arbiter!;
      const { deflect } = got.avoid!;
      expect(got.avoid).toEqual(base.avoid);
      const phys = got.rows.find((r) => r.type === 'physical')!;
      expect(phys.hitId).toBe('extendo-spear-combo-slam-1');
      expect(phys.hitsSurvived).toBeCloseTo(0 + (100 * deflect) / 100, 9);
      expect(phys.hitsSurvived).toBeLessThan(base.rows.find((r) => r.type === 'physical')!.hitsSurvived!);
      expect(got.rows.filter((r) => r.type !== 'physical')).toEqual(base.rows.filter((r) => r.type !== 'physical'));
    });

    it("AC-P84: when the unevadable hit is the type's smaller one (slam 2, one-shot too), the row's hitsSurvived is that hit's", () => {
      const got = slam2Unevadable.stages.nE.measures!.arbiter!;
      const phys = got.rows.find((r) => r.type === 'physical')!;
      const slam2 = facts('arbiter-of-divinity.json')['hits.slam-2'].value.max as number;
      // Slam 2 is one-shot and its deflected hit survived: its own hits survived is 0 + 100 × the deflect chance.
      expect(slam2 / phys.maxHit!).toBeGreaterThanOrEqual(1);
      expect(phys.hitId).toBe('extendo-spear-combo-slam-1');
      expect(phys.hitsSurvived).toBeCloseTo(got.avoid!.deflect, 9);
      expect(got.rows.filter((r) => r.type !== 'physical')).toEqual(rec.stages.nE.measures!.arbiter!.rows.filter((r) => r.type !== 'physical'));
    });

    it('AC-P84: with a data copy holding a chaos hit, a Chaos Inoculation stage\'s chaos row is survives, ratio 0, immune, with a non-null verdict', () => {
      const row = chaosHit.stages.nCI.measures!.arbiter!.rows.find((r) => r.type === 'chaos')!;
      expect(row).toMatchObject({ hitId: 'test-chaos-bolt', ratio: 0, verdict: 'survives', immune: true, hitsSurvived: 100 });
      // The immune type comes from the Pinnacle pass: the separate Pinnacle compile has no finite chaos max hit either.
      expect(twin.stages.nCI.outputs.ChaosMaximumHitTaken).toBeUndefined();
      // A stage that isn't immune reads the chaos hit against its max hit.
      const e = chaosHit.stages.nE.measures!.arbiter!.rows.find((r) => r.type === 'chaos')!;
      expect(e.immune).toBeUndefined();
      expect(e.ratio).toBeCloseTo(3000 / twin.stages.nE.outputs.ChaosMaximumHitTaken, 9);
    });
  });

  it('AC-P84: the key-figure line carries the lowest max hit, the resisting figure and, on a rung with avoid, hits survived, in Appendix A\'s form', () => {
    const lines = recText.split('\n');
    const round = (v: number | null | undefined) => (typeof v === 'number' ? String(Math.round(v)) : '?');
    for (const id of ['nE', 'bP']) {
      const s = rec.stages[id];
      const line = lines[lines.findIndex((l) => l.startsWith(`Stage ${id} "`)) + 1];
      const d = s.measures!.damage!;
      const low = s.measures!.toughness!.lowestMaxHit!;
      expect(line).toContain(`Key figures: damage ${round(d.map)} against map monsters, ${round(d.resisting)} against resisting rares, ${round(d.boss)} against a Pinnacle boss; life `);
      expect(line).toContain(`; EHP ${round(s.outputs.TotalEHP)}; lowest max hit ${round(low.value)} ${low.type}; resists `);
    }
    const nE = lines[lines.findIndex((l) => l.startsWith('Stage nE "')) + 1];
    const rows = rec.stages.nE.measures!.arbiter!.rows.filter((r) => r.verdict === 'one-shot');
    const deciding = rows.reduce((a, b) => (b.hitsSurvived! < a.hitsSurvived! || (b.hitsSurvived === a.hitsSurvived && b.ratio! > a.ratio!) ? b : a));
    expect(nE).toContain(`; Arbiter one-shot (worst: ${deciding.type} hit ${deciding.hitId}, ${deciding.ratio!.toFixed(2)} of max hit); hits survived ${Math.floor(deciding.hitsSurvived!)}%; clear `);
    const bP = lines[lines.findIndex((l) => l.startsWith('Stage bP "')) + 1];
    expect(bP).not.toContain('hits survived');
  });
});
