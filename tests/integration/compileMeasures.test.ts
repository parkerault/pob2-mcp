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
 * - AC-P64 (D-356): `compile_plan`'s reply has a key-figure line after each stage's line.
 */
import fs from 'fs';
import path from 'path';
import { afterAll, beforeAll, expect, it } from '@jest/globals';
import { engineDescribe } from '../helpers/engine';
import { startSessionFixture, type SessionFixture } from '../helpers/engineSession';
import type { CompileRecord } from '../../src/plan/record';

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
  const cs = endgameStage(plan, 'cs', 'budget', 80, 'Stampede');
  cs.config.customMods = [{ text: '80% reduced Area of Effect', reason: 'test: an area under 2 m' }];
  add(cs);
  add(endgameStage(plan, 'cm', 'budget', 80, 'Stampede'));
  const cf = endgameStage(plan, 'cf', 'budget', 80, 'Stampede');
  cf.config.customMods = [{ text: '100% increased Area of Effect', reason: 'test: an area past 4 m' }];
  add(cf);
  add(endgameStage(plan, 'cd', 'budget', 80, 'Contagion'));
  add(endgameStage(plan, 'cl', 'budget', 80, 'Leap Slam'));
  return plan;
}

engineDescribe('WU-65: the anoint, measures, reference hits and key figures through compile_plan (D-353, D-356, D-358)', () => {
  let f: SessionFixture;
  let record: CompileRecord;
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

  it('AC-P62 (D-353): measures.arbiter has a row per damage type and mixed hit, each the largest hit\'s top roll over the max hit; the slam one-shots b, and bs survives every hit', () => {
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
      const out = record.stages[id].outputs;
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
    expect(record.stages.b.outputs.PhysicalMaximumHitTaken).toBeLessThan(slam.max);
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
    for (const id of ['m', 'b', 'bplain', 'bs', 'n', 'cs', 'cm', 'cf', 'cd', 'cl']) {
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
    const radius = (id: string) => {
      const s = record.stages[id];
      return Math.max(0, ...Object.entries(s.skillOutputs).filter(([k]) => /^g2s1p\d+$/.test(k)).map(([, e]) => e.fields.AreaOfEffectRadiusMetres ?? 0));
    };
    const band = (r: number) => (r < 2 ? 'slow' : r < 4 ? 'medium' : 'fast');
    const rows = ['cs', 'cm', 'cf', 'cd', 'cl'].map((id) => {
      const c = record.stages[id].measures!.clearSpeed;
      return { id, skill: c.skill, radius: c.radiusMetres, band: c.band, onDeath: c.onDeath, longUse: c.longUse, speed: c.speed, rough: c.rough };
    });
    for (const r of rows) expect({ id: r.id, radius: r.radius, band: r.band }).toEqual({ id: r.id, radius: radius(r.id), band: band(radius(r.id)) });
    expect(rows).toEqual([
      // A band each, with no step, by Stampede's slam: with 80% reduced area (under 2 m), as it is (2 to 4 m), and
      // with 100% increased area (past 4 m).
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
      const want = [
        `DPS ${round(dps)}`,
        `life ${round(o.Life)}`,
        `ES ${round(o.EnergyShield)}`,
        `EHP ${round(o.TotalEHP)}`,
        `resists ${round(o.FireResist)}/${round(o.ColdResist)}/${round(o.LightningResist)}/${round(o.ChaosResist)} (fire/cold/lightning/chaos)`,
        `findings V1 ${s.v1!.findings.length}, V2 ${s.v2!.findings.length}`,
      ];
      const arbiter = s.measures?.arbiter;
      if (arbiter) want.push(`Arbiter ${arbiter.verdict}`);
      if (s.measures) want.push(`clear ${s.measures.clearSpeed.speed} (rough)`);
      expect({ id, starts: line.startsWith('  Key figures: ') }).toEqual({ id, starts: true });
      for (const part of want) expect({ id, line, has: line.includes(part) }).toEqual({ id, line, has: true });
      if (!s.measures) expect({ id, endgame: /Arbiter|clear /.test(line) }).toEqual({ id, endgame: false });
    }
    // b names the hit that one-shots it.
    const bLine = lines[lines.findIndex((l) => l.startsWith('Stage b "')) + 1];
    const worst = record.stages.b.measures!.arbiter!.worst!;
    expect(bLine).toContain(`Arbiter one-shot (worst: ${worst.type} hit ${worst.hitId}, ${worst.ratio.toFixed(2)} of max hit)`);
  });
});
