/**
 * V1 and V2 inside the compile (WU-42, slice 2 §3.7, D-192): engine-required, in process.
 *
 * The real server runs in process (`startSessionFixture`, test actions on for Lua queries) over private
 * builds, state and guides folders; every plan is the committed two-stage fixture or a variant of it, in a
 * run folder `guide_run {new_run}` made. Expectations come from PoB itself (Lua queries of the compiled
 * build, the pinned source's text), from the C1 data files read here as plain JSON, and from the plan:
 * never from the checks' own output.
 *
 * - AC-P39: the fixture's final compile passes V1 and V2 in both stages.
 * - AC-P40, AC-P41: each row is a measure-only compile of a variant; the stage's findings hold the code.
 * - AC-P42: the default audit's `default-unlisted` set, with an empty baseline list injected, equals the
 *   default-on options (a Lua query of PoB's option list) plus the stage's placeholder-driven options (a Lua
 *   query of its config set); listing them, or the committed baseline list, clears them. Static: the
 *   committed list names only `ConfigOptions` vars, each with a one-line rationale.
 * - AC-P43: reliance on an M fact (trial 3, the Martyr point) is a note, not a finding.
 * - AC-P44: a V1 finding doesn't stop a final compile.
 * - AC-P50: the record's `configEffective` against the plan, PoB's option list and the config sets.
 */
import fs from 'fs';
import os from 'os';
import path from 'path';
import { performance } from 'perf_hooks';
import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import { engineDescribe } from '../helpers/engine';
import { startSessionFixture, type SessionFixture } from '../helpers/engineSession';
import { compilePlan, type CompileResult } from '../../src/plan/compiler';
import { loadConfigBaseline } from '../../src/plan/checks/configBaseline';
import { loadReferenceData } from '../../src/plan/referenceData';
import { readPin } from '../../src/engine/pinCheck';
import { OFFENSE_STAT_FIELDS } from '../../src/handlers/luaHandlers';
import type { CompileRecord, Finding } from '../../src/plan/record';

const REPO = path.resolve(__dirname, '..', '..');
const FIXTURE = path.join(REPO, 'tests', 'fixtures', 'plans', 'two-stage', 'plan.json');
const DATA = path.join(REPO, 'data');
const POB_SRC = path.join(REPO, 'vendor', 'PathOfBuilding-PoE2', 'src');
const ENGINE_TIMEOUT = 300_000;
const JUNK = /undefined|NaN|\[object Object\]/;

type Json = Record<string, any>;
const fixturePlan = (): Json => JSON.parse(fs.readFileSync(FIXTURE, 'utf8'));
const readJson = (rel: string): Json => JSON.parse(fs.readFileSync(path.join(DATA, rel), 'utf8'));

// ---------------------------------------------------------------------------------------------------
// C1, read here as plain JSON (the checks read it through the C-35 loader)

const PROGRESS = readJson('campaign/progress.json');
const ASCENDANCY = readJson('campaign/ascendancy.json');
const GEMS = readJson('campaign/gems.json');
const LIMITS = readJson('campaign/limits.json');
const BASELINE = readJson('config-baseline.json');
const ORDER: string[] = PROGRESS.facts.order.value;
const fact = (file: Json, id: string): Json => {
  if (!(id in file.facts)) throw new Error(`no fact ${id}`);
  return file.facts[id];
};
const idx = (key: string) => {
  const i = ORDER.indexOf(key);
  if (i < 0) throw new Error(`no progress key ${key}`);
  return i;
};
/** A fact's tag as C-35 builds it: its source's kind, ref and accessed, its own patch and confidence. */
function tagOf(file: Json, id: string): Json {
  const f = fact(file, id);
  const s = file.sources.find((x: Json) => x.id === f.source);
  return { kind: s.kind, ref: s.ref, ...(s.accessed ? { accessed: s.accessed } : {}), patch: f.patch, confidence: f.confidence };
}
/** PoB's quest-reward config var → its progress key (C1 `.pob-config-key`). */
const QUEST_OF: Record<string, string> = Object.fromEntries(
  ORDER.filter((k) => `${k}.pob-config-key` in PROGRESS.facts).map((k) => [PROGRESS.facts[`${k}.pob-config-key`].value, k]),
);
const questPoints = (progress: string, field: string) =>
  ORDER.slice(0, idx(progress) + 1).reduce((sum, k) => sum + (PROGRESS.facts[`${k}.${field}`]?.value ?? 0), 0);
/** The trial gates: per trial its points and the key it is available from. */
const TRIALS = [1, 2, 3, 4].map((n) => ({
  n,
  points: fact(ASCENDANCY, `trial.${n}.points`).value as number,
  from: fact(ASCENDANCY, `trial.${n}.available-from`).value as string,
}));
const trialPoints = (progress: string) => TRIALS.filter((t) => idx(t.from) <= idx(progress)).reduce((s, t) => s + t.points, 0);
const uncutMax = (series: string, progress: string) => {
  let max = 0;
  for (let n = 1; `${series}.${n}.available-from` in GEMS.facts; n++) {
    if (idx(GEMS.facts[`${series}.${n}.available-from`].value) <= idx(progress)) max = n;
  }
  return max;
};

/** Titan ascendancy nodes, each linked to the one before it from the ascendancy start (PoB's tree). */
const TITAN_CHAIN = [19424, 60634, 27418, 30115, 29323, 24807, 13715, 59372];

/** The quest-reward checkboxes (a reward without a choice of options), each on by default in PoB. */
const CHECK_QUESTS = Object.entries(QUEST_OF).filter(([, key]) => !(`${key}.options` in PROGRESS.facts));

/** List every quest-reward checkbox whose quest is beyond the stage's progress as false (earned, off). */
function setQuests(stage: Json): void {
  const quest = (e: Json) => QUEST_OF[e.option] !== undefined;
  stage.config.earned = stage.config.earned.filter((e: Json) => !quest(e));
  stage.config.scenario = stage.config.scenario.filter((e: Json) => !quest(e));
  for (const [option, key] of CHECK_QUESTS) if (idx(key) > idx(stage.progress)) stage.config.earned.push({ option, value: false });
}

/** A stage's level and its loadout name's `(L<level>)` together (A-P1). */
function setLevel(stage: Json, level: number): void {
  stage.level = level;
  stage.loadoutName = stage.loadoutName.replace(/\(L\d+\)/, `(L${level})`);
}

function setPenalty(stage: Json, region: string): void {
  const e = stage.config.scenario.find((x: Json) => x.option === 'resistancePenalty');
  e.value = fact(LIMITS, `resistance-penalty.${region}`).value;
  e.source = { file: 'campaign/limits.json', key: `resistance-penalty.${region}` };
  e.tag = tagOf(LIMITS, `resistance-penalty.${region}`);
}

const judgment = (ref: string) => ({ kind: 'judgment', ref, confidence: 'M' });

const findingsOf = (record: CompileRecord, id: string, check: 'v1' | 'v2', code: string): Finding[] =>
  (record.stages[id][check]?.findings ?? []).filter((f) => f.code === code);

/** Every `var = "<name>"` of the pinned ConfigOptions.lua, plus the quest-reward vars it builds from QuestRewards.lua. */
function configOptionVars(): Set<string> {
  const text = fs.readFileSync(path.join(POB_SRC, 'Modules', 'ConfigOptions.lua'), 'utf8');
  const vars = new Set([...text.matchAll(/\bvar = "([^"]+)"/g)].map((m) => m[1]));
  const rewards = fs.readFileSync(path.join(POB_SRC, 'Data', 'QuestRewards.lua'), 'utf8');
  for (const row of rewards.split(/\n\t\},?\n/)) {
    const get = (k: string) => new RegExp(`\\["${k}"\\] = "([^"]*)"`).exec(row)?.[1];
    if (/\["useConfig"\] = true/.test(row) && get('Description') !== undefined) {
      vars.add(`quest${get('Description')}${get('Area')}${get('Info')}`);
    }
  }
  return vars;
}

describe('AC-P42 (static, D-230): the committed baseline list', () => {
  it('AC-P42: every option it names is a ConfigOptions var, and every rationale is one non-empty line', () => {
    const vars = configOptionVars();
    expect(vars.has('multiplierCurrentManaPercentage')).toBe(true);
    expect(vars.has('questAct 1ClearfellBeira')).toBe(true);
    expect(BASELINE.schemaVersion).toBe(1);
    const names = Object.keys(BASELINE.options);
    expect(names.length).toBeGreaterThan(0);
    expect(names.filter((n) => !vars.has(n))).toEqual([]);
    for (const [name, entry] of Object.entries<Json>(BASELINE.options)) {
      expect({ name, keys: Object.keys(entry) }).toEqual({ name, keys: ['rationale'] });
      expect({ name, ok: typeof entry.rationale === 'string' && entry.rationale.trim() !== '' && !/[\r\n]/.test(entry.rationale) })
        .toEqual({ name, ok: true });
    }
    // The loader the compile uses accepts it.
    expect(Object.keys(loadConfigBaseline(DATA).options)).toEqual(names);
  });
});

engineDescribe('WU-42: V1 and V2 inside compile_plan (§3.7, D-192)', () => {
  let f: SessionFixture;
  let runs = 0;

  async function newRun(plan: Json): Promise<{ abs: string; rel: string; plan: string }> {
    runs += 1;
    const out = await f.call('guide_run', { new_run: `checks-${runs}` });
    if (out.isError) throw new Error(`guide_run failed: ${out.text}`);
    const abs = /^Created run folder (.+)$/m.exec(out.text)![1];
    const planPath = /^plan_path for this run: (\S+)$/m.exec(out.text)![1];
    fs.writeFileSync(path.join(f.guides, planPath), `${JSON.stringify(plan, null, 2)}\n`);
    return { abs, rel: path.posix.dirname(planPath), plan: planPath };
  }

  const recordOf = (r: { abs: string }): CompileRecord =>
    JSON.parse(fs.readFileSync(path.join(r.abs, 'compile-record.json'), 'utf8')) as CompileRecord;

  /** A measure-only compile through the tool; returns the text and the record. */
  async function measure(plan: Json, stages?: string[]): Promise<{ text: string; record: CompileRecord }> {
    const r = await newRun(plan);
    const out = await f.call('compile_plan', { plan_path: r.plan, measure_only: true, ...(stages ? { stages } : {}) });
    expect(out.text).not.toMatch(JUNK);
    if (out.isError) throw new Error(`compile_plan failed: ${out.text}`);
    return { text: out.text, record: recordOf(r) };
  }

  async function luaQuery<T>(code: string): Promise<T> {
    const { value } = await f.session.run({ tool: 'test:checks-query', kind: 'read' }, async (ctx) => {
      const reply = await ctx.client.request('__test_eval', { code });
      return reply.result as T;
    });
    return value;
  }

  /** A measure-only compile through `compilePlan` itself, with the baseline list read from `dataDir`. */
  async function measureWithBaseline(plan: Json, dataDir: string, stages?: string[]): Promise<CompileRecord> {
    const r = await newRun(plan);
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
          referenceData: () => loadReferenceData(),
          configBaseline: () => loadConfigBaseline(dataDir),
          offenseFields: OFFENSE_STAT_FIELDS,
          engine: { pobTag: pin.tag, pobCommit: pin.commit },
          clock: () => performance.now(),
          wallClock: () => new Date(),
        },
        { mode: 'measure-only', planPath: r.plan, ...(stages ? { stages } : {}) },
      ),
    );
    // The record written beside the plan is the one returned (JSON drops the sign of a zero).
    expect(JSON.parse(JSON.stringify(value.record))).toEqual(recordOf(r));
    return value.record;
  }

  /** PoB's option list, as a new config set gets its values (ConfigTab.lua:979-987): the default-on options. */
  const DEFAULT_ON_QUERY = String.raw`
    local varList = LoadModule('Modules/ConfigOptions')
    local on = {}
    for _, v in ipairs(varList) do
      if v.var then
        local d = v.defaultState
        if v.defaultIndex then d = v.list[v.defaultIndex].val end
        local first = v.list and v.list[1] and v.list[1].val
        local isOn
        if v.type == 'list' then isOn = d ~= nil and d ~= first
        else isOn = d == true or (type(d) == 'number' and d ~= 0) end
        on[v.var] = isOn and { value = d } or false
      end
    end
    local out = {}
    for var, e in pairs(on) do if e then out[#out + 1] = { option = var, value = e.value } end end
    return out`;

  async function defaultOn(): Promise<Map<string, unknown>> {
    const rows = await luaQuery<{ option: string; value: unknown }[]>(DEFAULT_ON_QUERY);
    return new Map(rows.map((r) => [r.option, r.value]));
  }

  /**
   * The placeholder-driven options of config set `id` (§3.7 with D-212): a numeric option with no
   * effective input (nil, or 0 for a count) whose placeholder is set (non-zero for a count), and enemyLevel
   * when its input isn't above 0 and its placeholder is (ConfigTab.lua:870-900). Option → placeholder.
   */
  async function placeholderDriven(id: number): Promise<Map<string, unknown>> {
    const rows = await luaQuery<{ option: string; value: unknown }[]>(String.raw`
      local cs = build.configTab.configSets[${id}]
      local types = {}
      for _, v in ipairs(LoadModule('Modules/ConfigOptions')) do if v.var then types[v.var] = v.type end end
      local out = {}
      for var, t in pairs(types) do
        local i, p = cs.input[var], cs.placeholder[var]
        local driven = false
        if var == 'enemyLevel' then
          driven = not (type(i) == 'number' and i > 0) and type(p) == 'number' and p > 0
        elseif t == 'count' or t == 'integer' or t == 'countAllowZero' or t == 'float' then
          local hasInput = i ~= nil and (i ~= 0 or t ~= 'count')
          local set = p ~= nil and (p ~= 0 or t ~= 'count')
          driven = (not hasInput) and set
        end
        if driven then out[#out + 1] = { option = var, value = p } end
      end
      return out`);
    return new Map(rows.map((r) => [r.option, r.value]));
  }

  const configSetOf = (record: CompileRecord, id: string) => record.sets.find((s) => s.kind === 'config' && s.stages.includes(id))!.id;

  /** The show gates ConfigTab builds its shownFuncs from (`if varData.<gate> then`, Classes/ConfigTab.lua). */
  const SHOW_GATES = [
    ...new Set(
      [...fs.readFileSync(path.join(POB_SRC, 'Classes', 'ConfigTab.lua'), 'utf8').matchAll(/\bif varData\.(if[A-Za-z]+) then/g)].map((m) => m[1]),
    ),
  ];

  /**
   * The conditional options PoB shows for the build the engine holds (its active config set and last
   * calculation): every option with a show gate whose ConfigTab control says it is shown.
   */
  async function shownConditional(): Promise<Set<string>> {
    expect(SHOW_GATES).toEqual(expect.arrayContaining(['ifSkill', 'ifCond', 'ifFlag', 'ifOption']));
    const vars = await luaQuery<string[]>(String.raw`
      local gates = { ${SHOW_GATES.map((g) => `'${g}'`).join(', ')} }
      local out = {}
      for _, v in ipairs(LoadModule('Modules/ConfigOptions')) do
        local gated = false
        for _, g in ipairs(gates) do if v.var and v[g] ~= nil then gated = true end end
        local control = gated and build.configTab.varControls[v.var]
        if control then
          local shown = control.shown
          if type(shown) == 'function' then shown = shown() end
          if shown then out[#out + 1] = v.var end
        end
      end
      return out`);
    return new Set(vars);
  }

  /** D-252: the enemy stats a boss stage sets from E1, never covered by the baseline list there. */
  const BOSS_OPTIONS = ['enemyLevel', 'enemyArmour', 'enemyEvasion', 'enemyFireResist', 'enemyColdResist', 'enemyLightningResist', 'enemyChaosResist', 'enemyCritChance', 'enemyCritDamage'];

  beforeAll(async () => {
    f = await startSessionFixture({ testActions: true });
  }, ENGINE_TIMEOUT);

  afterAll(async () => {
    await f?.close();
  }, 60_000);

  // ---------------------------------------------------------------------------------------------------
  // AC-P39, AC-P50: the fixture

  it('AC-P39 (M-11): a final compile of the fixture records V1 and V2 passing in both stages, with no findings', async () => {
    const r = await newRun(fixturePlan());
    const out = await f.call('compile_plan', { plan_path: r.plan, build_name: 'checks-fixture' });
    expect(out.isError).toBe(false);
    const record = recordOf(r);
    for (const id of ['1', '2']) {
      const s = record.stages[id];
      expect({ id, v1: s.v1?.findings, v2: s.v2?.findings }).toEqual({ id, v1: [], v2: [] });
      expect({ id, v1: s.v1?.pass, v2: s.v2?.pass }).toEqual({ id, v1: true, v2: true });
      expect(s.pobWarnings.kept).toEqual([]);
      expect(out.text).toContain(`Stage ${id} "${s.loadoutName}" level ${s.level}: V1 pass, V2 pass`);
    }
  }, ENGINE_TIMEOUT);

  it('AC-P50 (D-212, D-230): each stage\'s configEffective is its listed, default-on and placeholder-driven options, classed by the baseline list', async () => {
    const plan = fixturePlan();
    const r = await newRun(plan);
    const out = await f.call('compile_plan', { plan_path: r.plan, build_name: 'checks-effective' });
    expect(out.isError).toBe(false);
    const record = recordOf(r);
    const defaults = await defaultOn();
    const baseline = new Set(Object.keys(BASELINE.options));
    for (const stage of plan.stages) {
      const expected: Record<string, unknown> = {};
      const listed = new Set<string>();
      for (const e of stage.config.earned) {
        listed.add(e.option);
        expected[e.option] = { value: e.value, origin: 'explicit', class: 'earned' };
      }
      for (const e of stage.config.scenario) {
        listed.add(e.option);
        expected[e.option] = { value: e.value, origin: 'explicit', class: 'scenario' };
      }
      for (const [option, value] of defaults) {
        if (!listed.has(option)) expected[option] = { value, origin: 'default', class: baseline.has(option) ? 'baseline' : 'unlisted' };
      }
      const placeholders = await placeholderDriven(configSetOf(record, stage.id));
      expect(placeholders.size).toBeGreaterThan(0);
      for (const [option, value] of placeholders) {
        if (!listed.has(option) && !(option in expected)) {
          expected[option] = { value, origin: 'placeholder', class: baseline.has(option) ? 'baseline' : 'unlisted' };
        }
      }
      expect({ stage: stage.id, effective: record.stages[stage.id].configEffective }).toEqual({ stage: stage.id, effective: expected });
    }

    // enemyLevel set explicitly to its placeholder in the saved stage: explicit in the record, though PoB's
    // own save leaves it out of the set (D-212). The compile puts it back into the file (D-248).
    const variant = fixturePlan();
    const top = variant.stages[1];
    const placeholderLevel = (await placeholderDriven(configSetOf(record, '2'))).get('enemyLevel');
    expect(placeholderLevel).toBe(top.level);
    top.config.scenario.push({
      option: 'enemyLevel',
      value: placeholderLevel,
      source: { file: 'campaign/progress.json', key: `${top.progress}.area-level` },
      tag: tagOf(PROGRESS, `${top.progress}.area-level`),
    });
    const r2 = await newRun(variant);
    const out2 = await f.call('compile_plan', { plan_path: r2.plan, build_name: 'checks-enemy-level' });
    expect(out2.isError).toBe(false);
    const record2 = recordOf(r2);
    expect(record2.stages['2'].configEffective.enemyLevel).toEqual({ value: placeholderLevel, origin: 'explicit', class: 'scenario' });
    const setId = configSetOf(record2, '2');
    const inputLine = (xml: string) => {
      const set = new RegExp(`<ConfigSet\\b[^>]*\\bid="${setId}"[^>]*>([\\s\\S]*?)</ConfigSet>`).exec(xml)?.[1] ?? '';
      return /<Input\b[^>]*name="enemyLevel"[^>]*\/>/.exec(set)?.[0] ?? null;
    };
    const pobSave = await luaQuery<string>(`return build:SaveDB('checks')`);
    expect(inputLine(pobSave)).toBeNull();
    expect(inputLine(fs.readFileSync(path.join(f.builds, 'checks-enemy-level.xml'), 'utf8'))).toMatch(new RegExp(`number="${placeholderLevel}"`));
  }, ENGINE_TIMEOUT);

  // ---------------------------------------------------------------------------------------------------
  // AC-P40: V1, one variant per row

  it('AC-P40 passive-points: stage 1 with one regular node more than (level - 1) + its book points', async () => {
    const plan = fixturePlan();
    const s = plan.stages[0];
    setLevel(s, s.tree.nodes.length - questPoints(s.progress, 'passive-points'));
    const { record } = await measure(plan, ['1']);
    const [used, , , , ws1, ws2] = await luaQuery<number[]>('return { build.spec:CountAllocNodes() }');
    const regular = used - Math.min(ws1, ws2);
    const allowed = s.level - 1 + questPoints(s.progress, 'passive-points') + (record.stages['1'].outputs.ExtraPoints ?? 0);
    expect(regular).toBe(allowed + 1);
    expect(findingsOf(record, '1', 'v1', 'passive-points').map((x) => x.data)).toEqual([{ used: regular, allowed }]);
    expect(record.stages['1'].v1?.pass).toBe(false);
  }, ENGINE_TIMEOUT);

  it('AC-P40 weapon-set-points: stage 1 tags more set1 nodes than its weapon-set points', async () => {
    const plan = fixturePlan();
    const s = plan.stages[0];
    s.tree.weaponSetNodes.set1 = [38646];
    const { record } = await measure(plan, ['1']);
    const [, , , , ws1] = await luaQuery<number[]>('return { build.spec:CountAllocNodes() }');
    expect(ws1).toBe(1);
    const allowed = questPoints(s.progress, 'weapon-set-points') + (record.stages['1'].outputs.PassivePointsToWeaponSetPoints ?? 0);
    expect(allowed).toBeLessThan(1);
    expect(findingsOf(record, '1', 'v1', 'weapon-set-points').map((x) => x.data)).toEqual([{ set: 1, used: 1, allowed }]);
  }, ENGINE_TIMEOUT);

  it('AC-P40 ascendancy-points: 4 ascendancy nodes before trial 2; and trial 1\'s key allows 2 at the end of Act 1', async () => {
    const usedOf = () => luaQuery<number>('local _, asc = build.spec:CountAllocNodes() return asc');
    // Stage 1, before any trial; stage 2 at the end of Act 1, where trial 1 is available and trial 2 isn't.
    for (const [index, id] of [[0, '1'], [1, '2']] as const) {
      const plan = fixturePlan();
      const s = plan.stages[index];
      expect(idx(s.progress)).toBeLessThan(idx(TRIALS[1].from));
      s.tree.ascendancyNodes = TITAN_CHAIN.slice(0, 4);
      const { record } = await measure(plan, [id]);
      expect(await usedOf()).toBe(4);
      const allowed = trialPoints(s.progress);
      expect(findingsOf(record, id, 'v1', 'ascendancy-points').map((x) => x.data)).toEqual([
        { used: 4, allowed, trials: TRIALS.filter((t) => idx(t.from) <= idx(s.progress)).map((t) => `trial.${t.n}`) },
      ]);
    }
    // Trial 1's progress key is the end of Act 1: 2 points spent there are no finding.
    const plan = fixturePlan();
    const s = plan.stages[1];
    expect(s.progress).toBe(TRIALS[0].from);
    s.tree.ascendancyNodes = TITAN_CHAIN.slice(0, TRIALS[0].points);
    const { record } = await measure(plan, ['2']);
    expect(await usedOf()).toBe(TRIALS[0].points);
    expect(findingsOf(record, '2', 'v1', 'ascendancy-points')).toEqual([]);
    expect(record.stages['2'].v1?.notes.some((n) => n.data?.fact === 'trial.1.points')).toBe(true);
  }, ENGINE_TIMEOUT);

  it('AC-P40 ascendancy-points (D-193): a variant stage with ascendancyPoints 6 and 8 nodes allocated', async () => {
    const plan = fixturePlan();
    const s = plan.stages[1];
    s.progress = ORDER[ORDER.length - 1];
    setLevel(s, 90);
    setQuests(s);
    setPenalty(s, 'endgame');
    s.variant = 'budget';
    s.ascendancyPoints = 6;
    s.variantBasis = { level: judgment('test level'), gemLevels: judgment('test gem levels'), ascendancyPoints: judgment('test points') };
    s.tree.ascendancyNodes = [...TITAN_CHAIN];
    const { record } = await measure(plan, ['2']);
    expect(await luaQuery<number>('local _, asc = build.spec:CountAllocNodes() return asc')).toBe(8);
    expect(trialPoints(s.progress)).toBe(8);
    expect(findingsOf(record, '2', 'v1', 'ascendancy-points').map((x) => x.data)).toEqual([{ used: 8, declared: 6 }]);
  }, ENGINE_TIMEOUT);

  it('AC-P40 gem-availability: an Act 1 stage holds a tier-7 skill gem', async () => {
    const plan = fixturePlan();
    const s = plan.stages[0];
    s.skills.groups.push({ label: 'Blood Hunt', enabled: true, role: 'clear', gems: [{ name: 'Blood Hunt', level: 1, quality: 0, enabled: true }] });
    const { record } = await measure(plan, ['1']);
    const tier = await luaQuery<number>(
      `for _, g in pairs(data.gems) do if g.name == 'Blood Hunt' then return g.Tier end end`,
    );
    expect(tier).toBe(7);
    const max = uncutMax('uncut-skill', s.progress);
    expect(max).toBeLessThan(tier);
    expect(findingsOf(record, '1', 'v1', 'gem-availability').map((x) => x.data)).toEqual([{ gem: 'Blood Hunt', tier, level: 1, max }]);
  }, ENGINE_TIMEOUT);

  it('AC-P40 gem-availability (review): a persistent minion gem with a skill tier is checked as a skill gem, not noted as Spirit', async () => {
    const gem = await luaQuery<{ tier: number; persistent: boolean }>(
      `for _, g in pairs(data.gems) do if g.name == 'Skeletal Brute' then return { tier = g.Tier, persistent = g.tags.persistent == true } end end`,
    );
    // A persistent (Spirit-reserving) gem whose tier is one of C1's skill tiers, not its Spirit tiers.
    expect(gem.persistent).toBe(true);
    expect(fact(GEMS, 'skill-tiers').value).toContain(String(gem.tier));
    expect(fact(GEMS, 'spirit-tiers').value).not.toContain(String(gem.tier));
    const plan = fixturePlan();
    const s = plan.stages[0];
    s.skills.groups.push({ label: 'Brute', enabled: true, role: 'clear', gems: [{ name: 'Skeletal Brute', level: 1, quality: 0, enabled: true }] });
    const { record } = await measure(plan, ['1']);
    const max = uncutMax('uncut-skill', s.progress);
    expect(max).toBeLessThan(gem.tier);
    expect(findingsOf(record, '1', 'v1', 'gem-availability').map((x) => x.data)).toEqual([{ gem: 'Skeletal Brute', tier: gem.tier, level: 1, max }]);
    expect(record.stages['1'].v1?.notes.filter((n) => n.data?.gem === 'Skeletal Brute')).toEqual([]);

    // A Spirit gem at a Spirit tier is still noted, not checked (A-31).
    const herald = await luaQuery<number>(`for _, g in pairs(data.gems) do if g.name == 'Herald of Ice' then return g.Tier end end`);
    expect(fact(GEMS, 'spirit-tiers').value).toContain(String(herald));
    const p2 = fixturePlan();
    p2.stages[0].skills.groups.push({ label: 'Herald', enabled: true, role: 'utility', gems: [{ name: 'Herald of Ice', level: 1, quality: 0, enabled: true }] });
    const noted = await measure(p2, ['1']);
    expect(findingsOf(noted.record, '1', 'v1', 'gem-availability')).toEqual([]);
    expect(noted.record.stages['1'].v1?.notes.filter((n) => n.data?.gem === 'Herald of Ice').map((n) => n.code)).toEqual(['gem-availability']);
  }, ENGINE_TIMEOUT);

  it('AC-P40 gem-level-requirement: Blood Hunt at gem level 15 in a level-40 stage', async () => {
    // The pin's Blood Hunt level table (Data/Skills/act_dex.lua:318-338): level 15's requirement.
    const table = fs.readFileSync(path.join(POB_SRC, 'Data', 'Skills', 'act_dex.lua'), 'utf8').split('\n').slice(317, 338).join('\n');
    const required = Number(/\[15\] = \{[^}]*levelRequirement = (\d+)/.exec(table)![1]);
    expect(required).toBe(64);
    const plan = fixturePlan();
    const s = plan.stages[1];
    setLevel(s, 40);
    s.skills.groups.push({ label: 'Blood Hunt', enabled: true, role: 'clear', gems: [{ name: 'Blood Hunt', level: 15, quality: 0, enabled: true }] });
    const { record } = await measure(plan, ['2']);
    expect(findingsOf(record, '2', 'v1', 'gem-level-requirement').map((x) => x.data)).toEqual([
      { gem: 'Blood Hunt', level: 15, levelRequirement: required, stageLevel: 40 },
    ]);
  }, ENGINE_TIMEOUT);

  it('AC-P40 item-level-requirement: an item requiring a level above the stage\'s', async () => {
    const plan = fixturePlan();
    const s = plan.stages[0];
    s.items.slots.find((x: Json) => x.slot === 'Body Armour').text = 'Rarity: Normal\nIron Cuirass';
    const { record } = await measure(plan, ['1']);
    const required = await luaQuery<number>(`return data.itemBases['Iron Cuirass'].req.level`);
    expect(required).toBeGreaterThan(s.level);
    expect(findingsOf(record, '1', 'v1', 'item-level-requirement').map((x) => x.data)).toEqual([
      { slot: 'Body Armour', item: 'Iron Cuirass', levelRequirement: required, stageLevel: s.level },
    ]);
  }, ENGINE_TIMEOUT);

  it('AC-P40 attributes: a gem whose Str requirement exceeds the stage\'s Str, with PoB\'s warning line', async () => {
    const plan = fixturePlan();
    const s = plan.stages[0];
    s.skills.groups[0].gems[0].level = 12;
    const { record } = await measure(plan, ['1']);
    const pob = await luaQuery<{ str: number; req: number; source: string }>(
      `local o = build.calcsTab.mainOutput return { str = o.Str, req = o.ReqStr, source = o.ReqStrItem.sourceGem.nameSpec }`,
    );
    expect(pob.req).toBeGreaterThan(pob.str);
    expect(findingsOf(record, '1', 'v1', 'attributes').map((x) => x.data)).toEqual([
      { attribute: 'Str', have: pob.str, required: pob.req, source: pob.source, sourceKind: 'gem' },
    ]);
    // PoB's own line (Modules/BuildDisplayStats.lua:96).
    const line = `You do not meet the Strength requirement of ${pob.source}`;
    expect(findingsOf(record, '1', 'v1', 'pob-warning').map((x) => x.data)).toContainEqual({ line });
    expect(record.stages['1'].pobWarnings.kept).toContain(line);
  }, ENGINE_TIMEOUT);

  it('AC-P40 resistance-penalty: -60 at an Act 2 progress point', async () => {
    const plan = fixturePlan();
    const s = plan.stages[1];
    s.progress = ORDER.find((k) => PROGRESS.facts[`${k}.region`]?.value === 'act2')!;
    setQuests(s);
    setPenalty(s, 'endgame');
    expect(s.config.scenario.find((x: Json) => x.option === 'resistancePenalty').value).toBe(-60);
    const { record } = await measure(plan, ['2']);
    expect(findingsOf(record, '2', 'v1', 'resistance-penalty').map((x) => x.data)).toEqual([
      { listed: -60, expected: fact(LIMITS, 'resistance-penalty.act2').value },
    ]);
  }, ENGINE_TIMEOUT);

  it('AC-P40 tree-continuity: stage 2 drops a stage 1 node with no respec; naming it in respec.dropped clears it', async () => {
    const plan = fixturePlan();
    const s = plan.stages[1];
    // 13397, an attribute node of stage 1, is a leaf of stage 2's tree: dropping it keeps the rest connected.
    s.tree.nodes = s.tree.nodes.filter((n: number) => n !== 13397);
    s.tree.attributeChoices = [];
    expect(plan.stages[0].tree.nodes).toContain(13397);
    const { record } = await measure(plan, ['2']);
    expect(findingsOf(record, '2', 'v1', 'tree-continuity').map((x) => x.data)).toEqual([{ predecessor: '1', dropped: [13397] }]);

    s.respec = { dropped: [13397], goldCost: { value: 100, source: judgment('test respec cost') }, note: 'refund the attribute point' };
    const again = await measure(plan, ['2']);
    expect(findingsOf(again.record, '2', 'v1', 'tree-continuity')).toEqual([]);
  }, ENGINE_TIMEOUT);

  it('AC-P40 pob-warning filter: set2 with fewer tagged nodes than set1 is no finding; PoB\'s line is in pobWarnings.filtered', async () => {
    const plan = fixturePlan();
    const s = plan.stages[1];
    s.tree.weaponSetNodes.set1 = [7721];
    const { record } = await measure(plan, ['2']);
    const [, , , , ws1, ws2] = await luaQuery<number[]>('return { build.spec:CountAllocNodes() }');
    expect([ws1, ws2]).toEqual([1, 0]);
    // Build.lua:1051-1055's format.
    const line = `You have ${Math.abs(ws2 - ws1)} Weapon set 2 passives available`;
    const st = record.stages['2'];
    expect(st.pobWarnings.filtered).toEqual([line]);
    expect(st.pobWarnings.kept).toEqual([]);
    expect(st.v1?.findings).toEqual([]);
  }, ENGINE_TIMEOUT);

  // ---------------------------------------------------------------------------------------------------
  // AC-P41: V2, one variant per row

  /** Stage 1 with an earned `buffOnslaught` entry. */
  function onslaught(value: boolean, producer?: { kind: string; name: string }): Json {
    const plan = fixturePlan();
    plan.stages[0].config.earned.push({
      option: 'buffOnslaught',
      value,
      ...(producer ? { producer, uptime: 'test uptime' } : {}),
    });
    return plan;
  }

  it('AC-P41 producer-absent, producer-unknown, and an entry that is off', async () => {
    const absent = await measure(onslaught(true, { kind: 'gem', name: 'Herald of Ice' }), ['1']);
    expect(await luaQuery<boolean>(`for _, g in pairs(data.gems) do if g.name == 'Herald of Ice' then return true end end return false`)).toBe(true);
    expect(findingsOf(absent.record, '1', 'v2', 'producer-absent').map((x) => x.data)).toEqual([
      { option: 'buffOnslaught', kind: 'gem', name: 'Herald of Ice' },
    ]);
    const unknown = await measure(onslaught(true, { kind: 'gem', name: 'Not A Gem' }), ['1']);
    expect(findingsOf(unknown.record, '1', 'v2', 'producer-unknown').map((x) => x.data)).toEqual([
      { option: 'buffOnslaught', kind: 'gem', name: 'Not A Gem' },
    ]);
    const off = await measure(onslaught(false), ['1']);
    const v2 = off.record.stages['1'].v2!;
    expect(v2.findings.filter((x) => x.code.startsWith('producer-'))).toEqual([]);
    expect(v2.pass).toBe(true);
  }, ENGINE_TIMEOUT);

  it('C-50 (D-221): guide_run {validate} lists an unknown producer without failing, and leaves the build unchanged', async () => {
    const r = await newRun(onslaught(true, { kind: 'gem', name: 'Not A Gem' }));
    const revision = f.session.revision;
    const out = await f.call('guide_run', { validate: r.plan });
    expect(out.isError).toBe(false);
    expect(out.text.split('\n')).toEqual([
      `Plan ${r.plan} is valid: 2 stages (1, 2).`,
      'Unknown producer: gem "Not A Gem" isn\'t in the game data; a compile reports it as producer-unknown (V2).',
    ]);
    expect(f.session.revision).toBe(revision);
  }, ENGINE_TIMEOUT);

  it('AC-P41 source-unresolved: an unknown scenario file, and an unknown key', async () => {
    for (const [file, key] of [
      ['data/enemies/nope.json', 'res.fire'],
      ['enemies/arbiter-of-divinity.json', 'res.nope'],
    ]) {
      const plan = fixturePlan();
      const e = plan.stages[0].config.scenario.find((x: Json) => x.option === 'resistancePenalty');
      e.source = { file, key };
      const { record } = await measure(plan, ['1']);
      expect(findingsOf(record, '1', 'v2', 'source-unresolved').map((x) => x.data)).toEqual([{ option: 'resistancePenalty', file, key }]);
    }
  }, ENGINE_TIMEOUT);

  it('AC-P41 quest-not-reached: an Act 1 stage lists Act 3\'s +30 Spirit quest option as true', async () => {
    const quest = ORDER.find((k) => PROGRESS.facts[`${k}.region`]?.value === 'act3' && PROGRESS.facts[`${k}.spirit`]?.value === 30)!;
    const option = PROGRESS.facts[`${quest}.pob-config-key`].value as string;
    const plan = fixturePlan();
    const s = plan.stages[0];
    expect(idx(quest)).toBeGreaterThan(idx(s.progress));
    s.config.earned = s.config.earned.filter((x: Json) => x.option !== option);
    s.config.scenario.push({ option, value: true, source: { file: 'campaign/progress.json', key: `${quest}.reward` }, tag: tagOf(PROGRESS, `${quest}.reward`) });
    const { record } = await measure(plan, ['1']);
    expect(findingsOf(record, '1', 'v2', 'quest-not-reached').map((x) => x.data)).toEqual([
      { option, quest, progress: s.progress, origin: 'explicit' },
    ]);
  }, ENGINE_TIMEOUT);

  it('AC-P41 toggle-empty: an active toggle on an empty Flask 1', async () => {
    const plan = fixturePlan();
    const s = plan.stages[0];
    s.items.slots = s.items.slots.filter((x: Json) => x.slot !== 'Flask 1');
    expect(s.items.toggles).toContainEqual(expect.objectContaining({ slot: 'Flask 1', active: true }));
    const { record } = await measure(plan, ['1']);
    expect(findingsOf(record, '1', 'v2', 'toggle-empty').map((x) => x.data)).toEqual([{ slot: 'Flask 1' }]);
  }, ENGINE_TIMEOUT);

  // ---------------------------------------------------------------------------------------------------
  // AC-P42: the default audit

  it('AC-P42 (A-P4, D-212, D-230): with an empty baseline list, default-unlisted is the default-on and placeholder-driven options; listing them, or the committed list, clears them', async () => {
    const emptyDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pob2-baseline-'));
    try {
      fs.writeFileSync(path.join(emptyDir, 'config-baseline.json'), JSON.stringify({ schemaVersion: 1, options: {} }));
      const only = (): Json => {
        const plan = fixturePlan();
        const s = plan.stages[0];
        s.config.earned = [];
        s.config.scenario = [
          {
            option: 'enemyIsBoss',
            value: fact(readJson('enemies/arbiter-of-divinity.json'), 'pob-enemy-is-boss').value,
            source: { file: 'enemies/arbiter-of-divinity.json', key: 'pob-enemy-is-boss' },
            tag: tagOf(readJson('enemies/arbiter-of-divinity.json'), 'pob-enemy-is-boss'),
          },
        ];
        return plan;
      };
      const record = await measureWithBaseline(only(), emptyDir, ['1']);
      const defaults = await defaultOn();
      defaults.delete('enemyIsBoss');
      const placeholders = await placeholderDriven(configSetOf(record, '1'));
      const expected = new Map<string, string>();
      for (const option of defaults.keys()) expected.set(option, 'default');
      for (const option of placeholders.keys()) if (!expected.has(option)) expected.set(option, 'placeholder');
      const got = findingsOf(record, '1', 'v2', 'default-unlisted');
      expect(new Map(got.map((x) => [x.data!.option as string, x.data!.origin as string]))).toEqual(expected);
      expect(got).toHaveLength(expected.size);
      // They include every quest-reward checkbox (ConfigOptions.lua:73-82), resistancePenalty, enemyLevel and
      // the four enemy resistances.
      const questChecks = Object.keys(QUEST_OF).filter((o) => defaults.has(o));
      expect(questChecks.length).toBeGreaterThan(0);
      for (const option of [...questChecks, 'resistancePenalty', 'enemyLevel', 'enemyFireResist', 'enemyColdResist', 'enemyLightningResist', 'enemyChaosResist']) {
        expect({ option, listed: expected.has(option) }).toEqual({ option, listed: true });
      }

      // Listing every one, a check off and any other value with a C1/E1 source, clears them.
      const all = only();
      const s = all.stages[0];
      for (const x of got) {
        const option = x.data!.option as string;
        const value = x.data!.value;
        if (typeof value === 'boolean') {
          s.config.earned.push({ option, value: false });
        } else {
          s.config.scenario.push({
            option,
            value,
            source: { file: 'enemies/arbiter-of-divinity.json', key: 'area-level' },
            tag: tagOf(readJson('enemies/arbiter-of-divinity.json'), 'area-level'),
          });
        }
      }
      const cleared = await measureWithBaseline(all, emptyDir, ['1']);
      expect(findingsOf(cleared, '1', 'v2', 'default-unlisted')).toEqual([]);

      // The committed list (the tool's own default, data/config-baseline.json) clears each option it names,
      // except a conditional one PoB shows for the stage (D-250) and, on this boss stage (the Arbiter is a
      // pinnacle boss), the enemy stats E1 gives (D-252).
      const committed = await measure(only(), ['1']);
      const shown = await shownConditional();
      const left = new Set(findingsOf(committed.record, '1', 'v2', 'default-unlisted').map((x) => x.data!.option as string));
      const listed = new Set(Object.keys(BASELINE.options));
      const covered = (o: string) => listed.has(o) && !shown.has(o) && !BOSS_OPTIONS.includes(o);
      expect(left).toEqual(new Set([...expected.keys()].filter((o) => !covered(o))));
      for (const option of BOSS_OPTIONS.filter((o) => listed.has(o) && expected.has(o))) {
        expect({ option, left: left.has(option) }).toEqual({ option, left: true });
      }
      for (const option of expected.keys()) {
        if (covered(option)) expect({ option, class: committed.record.stages['1'].configEffective[option]?.class }).toEqual({ option, class: 'baseline' });
      }

      // D-252: listing the boss's level, defences, resistances and crit from E1 clears them.
      const arbiter = readJson('enemies/arbiter-of-divinity.json');
      const fromE1: Record<string, string> = {
        enemyLevel: 'area-level',
        enemyArmour: 'base.armour',
        enemyEvasion: 'base.evasion',
        enemyFireResist: 'res.fire',
        enemyColdResist: 'res.cold',
        enemyLightningResist: 'res.lightning',
        enemyChaosResist: 'res.chaos',
        enemyCritChance: 'base.crit-chance',
        enemyCritDamage: 'base.crit-bonus',
      };
      expect(Object.keys(fromE1).sort()).toEqual([...BOSS_OPTIONS].sort());
      const bossPlan = only();
      for (const [option, key] of Object.entries(fromE1)) {
        bossPlan.stages[0].config.scenario.push({
          option,
          value: fact(arbiter, key).value,
          source: { file: 'enemies/arbiter-of-divinity.json', key },
          tag: tagOf(arbiter, key),
        });
      }
      const boss = await measure(bossPlan, ['1']);
      const bossLeft = new Set(findingsOf(boss.record, '1', 'v2', 'default-unlisted').map((x) => x.data!.option as string));
      expect(BOSS_OPTIONS.filter((o) => bossLeft.has(o))).toEqual([]);
      expect(boss.record.stages['1'].configEffective.enemyArmour).toEqual({ value: fact(arbiter, 'base.armour').value, origin: 'explicit', class: 'scenario' });
    } finally {
      fs.rmSync(emptyDir, { recursive: true, force: true });
    }
  }, ENGINE_TIMEOUT);

  it('AC-P42 (D-230): an invalid baseline list stops the compile naming the file and the option, before any engine request', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pob2-baseline-'));
    try {
      fs.writeFileSync(path.join(dir, 'config-baseline.json'), JSON.stringify({ schemaVersion: 1, options: { enemyLevel: { rationale: 'two\nlines' } } }));
      const revision = f.session.revision;
      await expect(measureWithBaseline(fixturePlan(), dir)).rejects.toThrow(/config-baseline\.json: options\["enemyLevel"\]\.rationale: the rationale is one line/);
      expect(f.session.revision).toBe(revision);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  }, ENGINE_TIMEOUT);

  it('AC-P42 (D-250): a conditional baseline option is covered only while PoB hides it: Flicker Strike absent and present', async () => {
    const option = 'FlickerStrikeBypassCD';
    expect(BASELINE.options[option]).toBeDefined();
    // Absent: PoB hides the option; the baseline list covers its default.
    const absent = await measure(fixturePlan(), ['1']);
    expect((await shownConditional()).has(option)).toBe(false);
    expect(absent.record.stages['1'].configEffective[option]).toEqual({ value: true, origin: 'default', class: 'baseline' });
    expect(findingsOf(absent.record, '1', 'v2', 'default-unlisted')).toEqual([]);

    // Present: PoB shows it, so its default is the stage's own unlisted state.
    const withSkill = () => {
      const plan = fixturePlan();
      plan.stages[0].skills.groups.push({ label: 'Flicker', enabled: true, role: 'clear', gems: [{ name: 'Flicker Strike', level: 1, quality: 0, enabled: true }] });
      return plan;
    };
    const present = await measure(withSkill(), ['1']);
    expect((await shownConditional()).has(option)).toBe(true);
    expect(present.record.stages['1'].configEffective[option]).toEqual({ value: true, origin: 'default', class: 'unlisted' });
    expect(findingsOf(present.record, '1', 'v2', 'default-unlisted').map((x) => x.data)).toEqual([{ option, value: true, origin: 'default' }]);

    // Listed as earned state, with its producer and uptime, it is explicit and clears the finding.
    const listed = withSkill();
    listed.stages[0].config.earned.push({ option, value: true, producer: { kind: 'skill', name: 'Flicker Strike' }, uptime: 'test uptime' });
    const done = await measure(listed, ['1']);
    expect(done.record.stages['1'].configEffective[option]).toEqual({ value: true, origin: 'explicit', class: 'earned' });
    expect(done.record.stages['1'].v2?.findings).toEqual([]);
  }, ENGINE_TIMEOUT);

  // ---------------------------------------------------------------------------------------------------
  // AC-P43: notes for M facts; AC-P44: a finding doesn't stop a final compile

  it('AC-P43 (A-29): a stage relying on trial 3 passes with a note naming trial.3 and its confidence', async () => {
    const plan = fixturePlan();
    const s = plan.stages[1];
    s.progress = TRIALS[2].from;
    setLevel(s, 51);
    setQuests(s);
    setPenalty(s, PROGRESS.facts[`${s.progress}.region`].value);
    const points = TRIALS[0].points + TRIALS[1].points + TRIALS[2].points;
    s.tree.ascendancyNodes = TITAN_CHAIN.slice(0, points);
    const { record } = await measure(plan, ['2']);
    const v1 = record.stages['2'].v1!;
    expect(v1.findings).toEqual([]);
    expect(v1.pass).toBe(true);
    const confidence = fact(ASCENDANCY, 'trial.3.points').confidence;
    expect(confidence).toBe('M');
    expect(v1.notes).toContainEqual(
      expect.objectContaining({ code: 'ascendancy-points', data: { file: 'campaign/ascendancy.json', fact: 'trial.3.points', confidence } }),
    );
  }, ENGINE_TIMEOUT);

  it('AC-P43 (A-29): an endgame stage with 124 regular points passes, with a note naming passive-points.martyr (M)', async () => {
    // 124 connected regular nodes from the Warrior's start (breadth first, ascendancy and jewel sockets left out).
    const tree = await luaQuery<{ nodes: number[]; attributes: number[] }>(String.raw`
      local tree = main:LoadTree(latestTreeVersion)
      local nodes, start = tree.nodes, nil
      for _, c in pairs(tree.classes) do if c.name == 'Warrior' then start = c.startNodeId end end
      local picked, attributes, seen, queue, qi = {}, {}, { [start] = true }, { start }, 1
      while qi <= #queue and #picked < 124 do
        local id = queue[qi]; qi = qi + 1
        local links = {}
        for _, o in ipairs(nodes[id].linkedId or {}) do links[#links + 1] = o end
        table.sort(links)
        for _, o in ipairs(links) do
          local n = nodes[o]
          if n and not seen[o] and #picked < 124 and not n.ascendancyName and n.type ~= 'ClassStart'
              and n.type ~= 'AscendClassStart' and not n.isMultipleChoiceOption and n.type ~= 'Socket' and not n.containJewelSocket then
            seen[o] = true
            queue[#queue + 1] = o
            picked[#picked + 1] = o
            if n.isAttribute then attributes[#attributes + 1] = o end
          end
        end
      end
      return { nodes = picked, attributes = attributes }`);
    expect(tree.nodes).toHaveLength(124);
    const plan = fixturePlan();
    const s = plan.stages[1];
    for (const n of plan.stages[0].tree.nodes) expect(tree.nodes).toContain(n);
    s.progress = ORDER[ORDER.length - 1];
    setLevel(s, 100);
    setQuests(s);
    setPenalty(s, 'endgame');
    s.tree.nodes = tree.nodes;
    s.tree.attributeChoices = tree.attributes.map((node) => ({ node, attribute: 'strength' }));
    const { record } = await measure(plan, ['2']);
    const [used, , , , ws1, ws2] = await luaQuery<number[]>('return { build.spec:CountAllocNodes() }');
    expect(used - Math.min(ws1, ws2)).toBe(124);
    const martyr = fact(LIMITS, 'passive-points.martyr');
    expect(99 + questPoints(s.progress, 'passive-points') + martyr.value).toBe(124);
    const v1 = record.stages['2'].v1!;
    expect(v1.findings).toEqual([]);
    expect(v1.pass).toBe(true);
    expect(v1.notes).toContainEqual(
      expect.objectContaining({ code: 'passive-points', data: { file: 'campaign/limits.json', fact: 'passive-points.martyr', confidence: martyr.confidence } }),
    );
    expect(martyr.confidence).toBe('M');
    // PoB caps regular points at 99 + its quest points (Build.lua:1007, 1030) and so warns; with the Martyr
    // point spent, its line is filtered, not a finding.
    expect(record.stages['2'].pobWarnings).toEqual({ kept: [], filtered: ['You have too many passive points allocated'] });
  }, ENGINE_TIMEOUT);

  it('AC-P44 (D-192): a final compile whose stage 1 has a V1 finding still writes the PoB file and the record, and the text says V1 fail', async () => {
    const plan = fixturePlan();
    const s = plan.stages[0];
    setLevel(s, s.tree.nodes.length - questPoints(s.progress, 'passive-points'));
    const r = await newRun(plan);
    const out = await f.call('compile_plan', { plan_path: r.plan, build_name: 'checks-v1-fail' });
    expect(out.isError).toBe(false);
    expect(fs.existsSync(path.join(f.builds, 'checks-v1-fail.xml'))).toBe(true);
    const record = recordOf(r);
    expect(record.pobFile.path).toBe('checks-v1-fail.xml');
    const finding = findingsOf(record, '1', 'v1', 'passive-points')[0];
    expect(finding).toBeDefined();
    expect(out.text).toContain(`Stage 1 "${s.loadoutName}" level ${s.level}: V1 fail, V2 pass`);
    expect(out.text).toContain(`  - passive-points: ${finding.message}`);
  }, ENGINE_TIMEOUT);
});
