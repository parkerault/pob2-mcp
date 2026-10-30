/**
 * P2, the plan compiler (WU-41, C-41, C-33, D-211): `compile_plan`, in process and engine-required.
 *
 * The real server runs in process (`startSessionFixture`: real `Client`, router, handler, session, bridge and
 * luajit, with test actions on for Lua queries), over private builds, state and guides folders. Every plan is
 * the committed two-stage fixture (or a variant of it), copied into a run folder that `guide_run {new_run}`
 * made. Expectations are read from PoB itself (Lua queries, the saved file, the existing read tools) and from
 * the files on disk, never from the tool's own text alone.
 *
 * - AC-P21…AC-P27, AC-P29, AC-P31…AC-P36, AC-P45, AC-P46, AC-P47 (the compile and validate parts) and
 *   AC-P49 run here; AC-P47's unit part is `tests/unit/compileAllocation.test.ts`.
 * - AC-B8 (write roots): a final and a measure-only compile change only the files C-34 and D-211 allow.
 * - The deferred rebuilds (WU-30's lever): each stage's outputs and breakdown equal the non-deferred path's.
 * - AC-P37 (static part) and AC-P38 (static part) are the plain describes at the end; AC-P37's timing runs in
 *   `compilePlanNfr.test.ts`, alone, in the same step as AC-T22's (`tradeQueryNfr.test.ts`).
 * - WU-41 review: off-hands that fit only with a passive (the `off-hand-fresh` and `off-hand-shared` fixtures,
 *   Instruments of Power) compile, measure and reload as planned on the deferred and eager paths, a plan that
 *   can't hold its off-hand is refused, and the record warns about PoB2's loadout switch; config values PoB's
 *   save drops are put back (D-248), so every stage reloads as recorded.
 */
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';
import { afterAll, beforeAll, describe, expect, it, jest } from '@jest/globals';
import { engineDescribe } from '../helpers/engine';
import {
  GOLDEN_XML,
  canonicalExport,
  canonicalize,
  startSessionFixture,
  writeBuild,
  type SessionFixture,
} from '../helpers/engineSession';
import { startTestServer } from '../helpers/server';
import { PoBLuaApiClient } from '../../src/pobLuaBridge';
import { decodePobCode } from '../../src/utils/buildCode';
import { TOOL_META } from '../../src/server/toolMeta';
import { getLuaToolSchemas } from '../../src/server/toolSchemas';
import { WRITE_LEDGER_FILE } from '../../src/plan/writeLedger';
import { buildSha1 } from '../../src/plan/buildHash';
import type { CompileRecord } from '../../src/plan/record';

const REPO = path.resolve(__dirname, '..', '..');
const FIXTURE = path.join(REPO, 'tests', 'fixtures', 'plans', 'two-stage', 'plan.json');
const ENGINE_TIMEOUT = 240_000;
const JUNK = /undefined|NaN|\[object Object\]/;

type Json = Record<string, any>;
const fixturePlan = (): Json => JSON.parse(fs.readFileSync(FIXTURE, 'utf8'));
const sha1 = (data: Buffer | string) => crypto.createHash('sha1').update(data).digest('hex');

/** Every file under `dir`, relative path → sha1 (missing dir → empty). */
function treeOf(dir: string): Record<string, string> {
  const out: Record<string, string> = {};
  const walk = (d: string) => {
    if (!fs.existsSync(d)) return;
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.isFile()) out[path.relative(dir, p).split(path.sep).join('/')] = sha1(fs.readFileSync(p));
    }
  };
  walk(dir);
  return out;
}

/** The paths that differ between two trees (added, removed or changed). */
function changed(before: Record<string, string>, after: Record<string, string>): string[] {
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  return [...keys].filter((k) => before[k] !== after[k]).sort();
}

const buildTag = (xml: string) => /<Build\b[^>]*>/.exec(xml)![0];

engineDescribe('WU-41: compile_plan (C-41) on the two-stage fixture', () => {
  let f: SessionFixture;
  /** The fixture's run folder and plan_path (relative to the guides root). */
  let run: { abs: string; rel: string; plan: string };

  async function newRun(slug: string, plan: Json = fixturePlan()): Promise<{ abs: string; rel: string; plan: string }> {
    const out = await f.call('guide_run', { new_run: slug });
    if (out.isError) throw new Error(`guide_run failed: ${out.text}`);
    const abs = /^Created run folder (.+)$/m.exec(out.text)![1];
    const planPath = /^plan_path for this run: (\S+)$/m.exec(out.text)![1];
    fs.writeFileSync(path.join(f.guides, planPath), `${JSON.stringify(plan, null, 2)}\n`);
    return { abs, rel: path.posix.dirname(planPath), plan: planPath };
  }

  function recordOf(r: { abs: string }): CompileRecord {
    return JSON.parse(fs.readFileSync(path.join(r.abs, 'compile-record.json'), 'utf8')) as CompileRecord;
  }

  async function compile(args: Json) {
    const out = await f.call('compile_plan', args);
    expect(out.text).not.toMatch(JUNK);
    return out;
  }

  async function luaQuery<T>(code: string): Promise<T> {
    const { value } = await f.session.run({ tool: 'test:compile-query', kind: 'read' }, async (ctx) => {
      const reply = await ctx.client.request('__test_eval', { code });
      return reply.result as T;
    });
    return value;
  }

  async function loadGolden(): Promise<void> {
    fs.writeFileSync(path.join(f.builds, 'grenadator.xml'), GOLDEN_XML, 'utf8');
    const out = await f.call('lua_load_build', { build_name: 'grenadator.xml' });
    if (out.isError) throw new Error(`loading the golden build failed: ${out.text}`);
  }

  /** The active tree spec's and item, skill and config sets' titles, and every spec's and set's title. */
  const TITLES_QUERY = String.raw`
    local function titles(tab, sets, order)
      local out = {}
      for _, id in ipairs(tab[order]) do out[#out + 1] = { id = id, title = tab[sets][id].title or 'Default' } end
      return out
    end
    local specs = {}
    for i, s in ipairs(build.treeTab.specList) do specs[#specs + 1] = { id = i, title = s.title or 'Default' } end
    return {
      active = {
        tree = build.spec.title or 'Default',
        item = build.itemsTab.activeItemSet.title or 'Default',
        skill = build.skillsTab.skillSets[build.skillsTab.activeSkillSetId].title or 'Default',
        config = build.configTab.configSets[build.configTab.activeConfigSetId].title or 'Default',
      },
      tree = specs,
      item = titles(build.itemsTab, 'itemSets', 'itemSetOrderList'),
      skill = titles(build.skillsTab, 'skillSets', 'skillSetOrderList'),
      config = titles(build.configTab, 'configSets', 'configSetOrderList'),
      autoMode = build.characterLevelAutoMode == true,
    }`;
  interface Titles {
    active: Record<'tree' | 'item' | 'skill' | 'config', string>;
    tree: { id: number; title: string }[];
    item: { id: number; title: string }[];
    skill: { id: number; title: string }[];
    config: { id: number; title: string }[];
    autoMode: boolean;
  }

  /** The loadout names in manage_sets' loadout list (`- "<name>" …` lines). */
  function loadoutNames(text: string): string[] {
    return text
      .split('\n')
      .map((l) => /^- "([^"]*)"/.exec(l))
      .filter((m): m is RegExpExecArray => m !== null)
      .map((m) => m[1]);
  }

  async function listedLoadouts(): Promise<string[]> {
    const out = await f.call('manage_sets', { set_type: 'loadout', action: 'list' });
    if (out.isError) throw new Error(out.text);
    return loadoutNames(out.text);
  }

  beforeAll(async () => {
    f = await startSessionFixture({ testActions: true });
    run = await newRun('titan-blood-hunt');
  }, ENGINE_TIMEOUT);

  afterAll(async () => {
    jest.restoreAllMocks();
    await f?.close();
  }, 60_000);

  // ---------------------------------------------------------------------------------------------------
  // The final compile and the saved file (M-11)

  it('AC-P21 (M-11, D-156): a final compile writes the file at the highest level in auto mode and the record, under one lock', async () => {
    await loadGolden();
    const events: string[] = [];
    const off = f.session.onEvent((e) => events.push(`${e.tool}:${e.phase}`));
    const compiling = compile({ plan_path: run.plan, build_name: 'm11-two-stage' });
    // A read sent mid-compile waits for the compile's lock.
    const deadline = performance.now() + 60_000;
    while (!events.includes('compile_plan:start') && performance.now() < deadline) await new Promise((r) => setTimeout(r, 5));
    const info = f.call('lua_get_build_info');
    const [out, infoOut] = await Promise.all([compiling, info]);
    off();
    expect(out.isError).toBe(false);
    expect(infoOut.isError).toBe(false);
    expect(events.indexOf('lua_get_build_info:start')).toBeGreaterThan(events.indexOf('compile_plan:end'));

    expect(out.text).toMatch(/^Compiled titan-blood-hunt\/\d{4}-\d{2}-\d{2}-1\/plan\.json: 2 stages \(final\) in [\d.]+ s\.$/m);
    expect(out.text).toContain('Stage 1 "Act 1 Clearfell (L5) {1}" level 5:');
    expect(out.text).toContain('Stage 2 "Act 1 Ogham Manor (L14) {2}" level 14:');
    expect(out.text).toContain('Wrote m11-two-stage.xml in the builds folder.');
    expect(out.text).toContain(`Wrote ${run.rel}/compile-record.json in the guides root.`);

    const xml = fs.readFileSync(path.join(f.builds, 'm11-two-stage.xml'), 'utf8');
    expect(buildTag(xml)).toMatch(/\blevel="14"/);
    expect(buildTag(xml)).toMatch(/\bcharacterLevelAutoMode="true"/);
    const record = recordOf(run);
    expect(record.mode).toBe('final');
    expect(record.stagesCompiled).toEqual(['1', '2']);
    // D-266: the record carries the build-affecting projection's sha1 beside the file's.
    const planText = fs.readFileSync(path.join(f.guides, run.plan), 'utf8');
    expect(record.planSha1).toBe(sha1(planText));
    expect(record.buildSha1).toBe(buildSha1(JSON.parse(planText)));
    for (const id of ['1', '2']) expect(record.stages[id].elapsedMs).toBeGreaterThan(0);
    expect(record.pobFile).toEqual({ location: 'builds', path: 'm11-two-stage.xml', sha1: sha1(xml), bytes: Buffer.byteLength(xml) });
    expect(record.savedLevel).toEqual({ level: 14, autoMode: true });
    expect(record.activeLoadout).toBe('Act 1 Ogham Manor (L14) {2}');
    expect(record.engine).toEqual({ pobTag: 'v0.23.1', pobCommit: '7d6f530cbdab20389ff8bc6ba97a37ac27f74e41', treeVersion: '0_5' });
    expect(record.versionNotes).toEqual([]);
    // Every stage holds the same weapon-fit flags and keeps its config through a PoB2 save: no warnings.
    expect(record.loadoutWarnings).toEqual([]);
    expect(record.saveWarnings).toEqual([]);
    // Only the named source's group (rolledGroup, group 1 in both stages) goes in with Full DPS on, with its Count;
    // every other group stays out (D-293, D-337 narrowing D-306; WU-51 measured it within the time margin).
    // Each stage has its own skill set, so the file holds two groups in Full DPS.
    expect((xml.match(/includeInFullDPS="true"/g) ?? []).length).toBe(2);
    for (const tag of xml.match(/<Skill\b[^>]*>/g) ?? []) {
      const named = tag.includes('label="Boneshatter"');
      expect({ tag, full: /includeInFullDPS="true"/.test(tag), count: /groupCount="1"/.test(tag) }).toEqual({ tag, full: named, count: named });
    }
    // The engine now holds the compiled build, saved: nothing unsaved.
    expect(f.session.loaded?.path).toBe('m11-two-stage.xml');
    expect(f.session.isDirty()).toBe(false);
  }, ENGINE_TIMEOUT);

  it('AC-P22 (M-11, D-215): the reloaded file has one loadout per stage, nothing titled Default, and each loadout selects its stage\'s four sets', async () => {
    const record = recordOf(run);
    const load = await f.call('lua_load_build', { build_name: 'm11-two-stage' });
    expect(load.isError).toBe(false);
    const names = await listedLoadouts();
    expect(names).toEqual(['Act 1 Clearfell (L5) {1}', 'Act 1 Ogham Manor (L14) {2}']);

    const titles = await luaQuery<Titles>(TITLES_QUERY);
    for (const kind of ['tree', 'item', 'skill', 'config'] as const) {
      expect(titles[kind].map((t) => t.title)).not.toContain('Default');
      // Spec 1 and set 1 of each type carry stage 1's titles.
      const stageOne = record.sets.find((s) => s.kind === kind && s.stages.includes('1'))!;
      expect(stageOne.id).toBe(1);
      expect(titles[kind].find((t) => t.id === 1)?.title).toBe(stageOne.title);
    }
    const itemSets = record.sets.filter((s) => s.kind === 'item');
    expect(itemSets).toHaveLength(1);
    expect(itemSets[0].title).toMatch(/\{1,2\}$/);
    const skillSets = record.sets.filter((s) => s.kind === 'skill');
    expect(skillSets).toHaveLength(2);
    expect(skillSets[0].id).not.toBe(skillSets[1].id);
    expect(titles.skill).toHaveLength(2);

    for (const [i, name] of names.entries()) {
      const id = String(i + 1);
      const sel = await f.call('manage_sets', { set_type: 'loadout', action: 'select', title: name });
      expect(sel.isError).toBe(false);
      const active = (await luaQuery<Titles>(TITLES_QUERY)).active;
      for (const kind of ['tree', 'item', 'skill', 'config'] as const) {
        const entry = record.sets.find((s) => s.kind === kind && s.stages.includes(id))!;
        expect({ stage: id, kind, title: active[kind] }).toEqual({ stage: id, kind, title: entry.title });
      }
    }
  }, ENGINE_TIMEOUT);

  it('AC-P23 (M-11, D-138): stage 1, selected and set to its level in the reloaded build, reads the record\'s Life and CombinedDPS', async () => {
    const record = recordOf(run);
    const plan = fixturePlan();
    expect(record.stages['1'].level).toBe(plan.stages[0].level);
    expect(record.stages['2'].level).toBe(plan.stages[1].level);
    expect(record.stages['1'].outputs.Life).not.toBe(record.stages['2'].outputs.Life);

    const sel = await f.call('manage_sets', { set_type: 'loadout', action: 'select', title: 'Act 1 Clearfell (L5) {1}' });
    expect(sel.isError).toBe(false);
    const lvl = await f.call('set_character_level', { level: 5 });
    expect(lvl.isError).toBe(false);
    const stats = await f.call('lua_get_stats', {});
    expect(stats.isError).toBe(false);
    for (const field of ['Life', 'CombinedDPS']) {
      const m = new RegExp(`^${field}: (\\S+)$`, 'm').exec(stats.text);
      expect({ field, line: m !== null }).toEqual({ field, line: true });
      const shown = Number(m![1]);
      const recorded = record.stages['1'].outputs[field];
      expect(recorded).toBeGreaterThan(0);
      expect(Math.abs(shown - recorded) / Math.abs(recorded)).toBeLessThanOrEqual(1e-9);
    }
  }, ENGINE_TIMEOUT);

  it('AC-P24 (M-11, D-180, D-215): the import code decodes to the file, and importing it gives the same loadouts and sets in auto mode', async () => {
    const record = recordOf(run);
    const bytes = fs.readFileSync(path.join(f.builds, 'm11-two-stage.xml'));
    const xml = decodePobCode(record.importCode);
    expect(Buffer.from(xml, 'utf8').equals(bytes)).toBe(true);
    expect(buildTag(xml)).toMatch(/\blevel="14"/);
    expect(buildTag(xml)).toMatch(/\bcharacterLevelAutoMode="true"/);

    const load = await f.call('lua_load_build', { build_name: 'm11-two-stage' });
    expect(load.isError).toBe(false);
    const fromFile = await luaQuery<Titles>(TITLES_QUERY);
    const fileLoadouts = await listedLoadouts();

    const imported = await f.call('import_build', { source: record.importCode });
    expect(imported.isError).toBe(false);
    const titles = await luaQuery<Titles>(TITLES_QUERY);
    const loadouts = await listedLoadouts();
    expect(loadouts).toEqual(fileLoadouts);
    expect(loadouts).toHaveLength(2);
    expect(loadouts).not.toContain('Default');
    for (const kind of ['tree', 'item', 'skill', 'config'] as const) {
      expect(titles[kind]).toEqual(fromFile[kind]);
      expect(titles[kind].map((t) => t.title)).not.toContain('Default');
    }
    expect(titles.autoMode).toBe(true);
  }, ENGINE_TIMEOUT);

  it('AC-P25 (C-32): before any reload, every stage\'s config set holds each listed option with its value, and enemyIsBoss', async () => {
    const r = await newRun('config-check');
    const out = await compile({ plan_path: r.plan, measure_only: true });
    expect(out.isError).toBe(false);
    const record = recordOf(r);
    const plan = fixturePlan();
    for (const stage of plan.stages) {
      const set = record.sets.find((s) => s.kind === 'config' && s.stages.includes(stage.id))!;
      const input = await luaQuery<Record<string, unknown>>(
        `local out = {} for k, v in pairs(build.configTab.configSets[${set.id}].input) do if type(v) ~= 'table' then out[k] = v end end return out`,
      );
      for (const e of [...stage.config.earned, ...stage.config.scenario]) {
        expect({ stage: stage.id, option: e.option, value: input[e.option] }).toEqual({ stage: stage.id, option: e.option, value: e.value });
      }
      expect(input.enemyIsBoss).toBeDefined();
      expect(record.stages[stage.id].configWritten).toEqual(
        Object.fromEntries([...stage.config.earned, ...stage.config.scenario].map((e: Json) => [e.option, e.value])),
      );
    }
  }, ENGINE_TIMEOUT);

  // ---------------------------------------------------------------------------------------------------
  // Refusals: defects, schema errors, paths

  /** A variant of the fixture with one change made by `edit`. */
  function variant(edit: (plan: Json) => void): Json {
    const plan = fixturePlan();
    edit(plan);
    return plan;
  }

  const DEFECTS: { name: string; edit: (plan: Json) => void; expect: RegExp[] }[] = [
    {
      name: 'an unknown gem (with suggestions)',
      edit: (p) => (p.stages[1].skills.groups[0].gems[2].name = 'Brutality'),
      expect: [/^stage 2: skills\.groups\[0\]\.gems\[2\]: unknown gem "Brutality"\. Did you mean: .*Brutality I/m],
    },
    {
      name: 'item text with no base',
      edit: (p) => (p.stages[1].items.slots[0].text = 'Rarity: Normal\nNo Such Base Item'),
      expect: [/^stage 2: item in Weapon 1: PoB can not parse its text into an item with a base type$/m],
    },
    {
      name: 'node id 999999',
      edit: (p) => p.stages[1].tree.nodes.push(999999),
      expect: [/^stage 2: node 999999 is not a passive tree node$/m],
    },
    {
      name: 'a disconnected node',
      edit: (p) => p.stages[1].tree.nodes.push(10029),
      expect: [/^stage 2: node 10029 \(Repulsion\) is not connected to its start through untagged nodes$/m],
    },
    {
      // D-383: PoB unlocks a node with an unlock constraint only while every node it names is allocated
      // (PassiveSpec.lua:1248-1251); The Unseen Path is the Oracle's, so a Titan never unlocks this node.
      name: 'an Oracle-only node in a Titan plan',
      edit: (p) => p.stages[1].tree.nodes.push(22133),
      expect: [
        /^stage 2: node 22133 \(Command Skill Cooldown\) is locked: PoB unlocks it only while node 5571 \(The Unseen Path, an Oracle node\) is allocated$/m,
      ],
    },
    {
      // D-384: PoB marks Commandment legacy (vendor Data/Skills/sup_int.lua, `legacy = true`).
      name: 'a legacy gem',
      edit: (p) => p.stages[1].skills.groups[0].gems.push({ name: 'Commandment', level: 1, quality: 0, enabled: true }),
      expect: [/^stage 2: skills\.groups\[0\]\.gems\[3\]: Commandment is a legacy gem: PoB marks it legacy, and it is no longer in the game$/m],
    },
    {
      // D-384: PoB's unique data says "Source: No longer obtainable" (vendor Data/Uniques/boots.lua).
      name: 'a unique no longer obtainable',
      edit: (p) => (p.stages[1].items.slots.find((s: Json) => s.slot === 'Boots').text = 'Rarity: UNIQUE\nThunderstep\nSteeltoe Boots'),
      expect: [/^stage 2: item in Boots: Thunderstep is no longer obtainable: PoB's unique data marks it so$/m],
    },
    {
      name: 'a weapon-set tag on an unlisted node',
      edit: (p) => p.stages[1].tree.weaponSetNodes.set1.push(58528),
      expect: [/^stages\[1\]\.tree\.weaponSetNodes\.set1\[0\] \(stage 2\): node 58528 isn't in tree\.nodes$/m],
    },
    {
      name: 'an attribute choice on a non-attribute node',
      edit: (p) => p.stages[1].tree.attributeChoices.push({ node: 3936, attribute: 'dexterity' }),
      expect: [/^stage 2: node 3936 \(Melee Damage\) has an attribute choice but is not an attribute node$/m],
    },
    {
      // Not one of AC-P26's rows: PoB gives an allocated attribute node no stat until one is chosen, so the
      // preflight refuses it (the WU-38 review's flag, made a compile error here).
      name: 'an attribute node without an attribute choice',
      edit: (p) => (p.stages[1].tree.attributeChoices = []),
      expect: [/^stage 2: attribute node 13397 has no attribute choice: PoB gives an allocated attribute node no stat/m],
    },
    {
      name: 'an unknown config option',
      edit: (p) => p.stages[1].config.earned.push({ option: 'noSuchConfigOption', value: false }),
      expect: [/^stage 2: unknown config option "noSuchConfigOption"$/m],
    },
    {
      name: 'defects in both stages',
      edit: (p) => {
        p.stages[0].tree.nodes.push(999998);
        p.stages[1].tree.nodes.push(999999);
      },
      expect: [/^stage 1: node 999998 is not a passive tree node$/m, /^stage 2: node 999999 is not a passive tree node$/m],
    },
  ];

  it('AC-P26 (D-162): each defect variant is isError naming the stage and the defect; nothing is written and the engine is untouched', async () => {
    await loadGolden();
    for (const [i, d] of DEFECTS.entries()) {
      const r = await newRun(`defect-${i + 1}`, variant(d.edit));
      const before = { tree: treeOf(f.tmp), revision: f.session.revision, export: await canonicalExport(f.session) };
      const out = await compile({ plan_path: r.plan, build_name: `defect-${i + 1}` });
      expect({ variant: d.name, isError: out.isError }).toEqual({ variant: d.name, isError: true });
      for (const re of d.expect) expect({ variant: d.name, text: out.text }).toEqual({ variant: d.name, text: expect.stringMatching(re) });
      expect({ variant: d.name, changed: changed(before.tree, treeOf(f.tmp)) }).toEqual({ variant: d.name, changed: [] });
      expect(fs.readdirSync(r.abs)).toEqual(['plan.json']);
      expect(f.session.revision).toBe(before.revision);
      expect(await canonicalExport(f.session)).toBe(before.export);
    }
  }, ENGINE_TIMEOUT);

  it('AC-P27 (D-163): stages[1].level 0 is isError naming the path; the export and revision are unchanged and nothing is written', async () => {
    await loadGolden();
    const r = await newRun('schema-error', variant((p) => (p.stages[1].level = 0)));
    const before = { tree: treeOf(f.tmp), revision: f.session.revision, export: await canonicalExport(f.session) };
    for (const args of [{ plan_path: r.plan, build_name: 'schema-error' }, { plan_path: r.plan, measure_only: true }]) {
      const out = await compile(args);
      expect(out.isError).toBe(true);
      expect(out.text).toContain('stages[1].level');
    }
    expect(changed(before.tree, treeOf(f.tmp))).toEqual([]);
    expect(f.session.revision).toBe(before.revision);
    expect(await canonicalExport(f.session)).toBe(before.export);
  }, ENGINE_TIMEOUT);

  it('AC-P32, AC-B8 (D-155): plan_paths escaping the guides root are refused and nothing is written anywhere', async () => {
    const outside = path.join(f.tmp, 'outside');
    fs.mkdirSync(outside, { recursive: true });
    fs.copyFileSync(FIXTURE, path.join(outside, 'plan.json'));
    fs.mkdirSync(f.guides, { recursive: true });
    fs.symlinkSync(outside, path.join(f.guides, 'link'));
    try {
      const before = treeOf(f.tmp);
      for (const planPath of ['../outside/plan.json', path.join(outside, 'plan.json'), 'link/plan.json']) {
        for (const extra of [{ measure_only: true }, { build_name: 'escape' }]) {
          const out = await compile({ plan_path: planPath, ...extra });
          expect({ planPath, isError: out.isError }).toEqual({ planPath, isError: true });
          expect(out.text).toContain('plan_path');
        }
      }
      expect(changed(before, treeOf(f.tmp))).toEqual([]);
    } finally {
      fs.unlinkSync(path.join(f.guides, 'link'));
    }
  }, ENGINE_TIMEOUT);

  // ---------------------------------------------------------------------------------------------------
  // Measure-only, subsets, the ledger, idempotence

  it('AC-P29 (D-208), AC-B8: measure_only writes the record and the XML beside the plan, never the builds folder; with build_name it is refused', async () => {
    const r = await newRun('measure-only');
    const builds = treeOf(f.builds);
    const before = treeOf(f.tmp);
    const out = await compile({ plan_path: r.plan, measure_only: true });
    expect(out.isError).toBe(false);
    expect(treeOf(f.builds)).toEqual(builds);
    expect(changed(before, treeOf(f.tmp))).toEqual([`guides/${r.rel}/compile-record.json`, `guides/${r.rel}/compiled-build.xml`]);
    const record = recordOf(r);
    const xml = fs.readFileSync(path.join(r.abs, 'compiled-build.xml'));
    expect(record.mode).toBe('measure-only');
    expect(record.pobFile).toEqual({ location: 'run', path: `${r.rel}/compiled-build.xml`, sha1: sha1(xml), bytes: xml.length });
    expect(Buffer.from(decodePobCode(record.importCode), 'utf8').equals(xml)).toBe(true);

    const r2 = await newRun('measure-only-conflict');
    const before2 = treeOf(f.tmp);
    const bad = await compile({ plan_path: r2.plan, measure_only: true, build_name: 'not-written' });
    expect(bad.isError).toBe(true);
    expect(bad.text).toMatch(/build_name and measure_only: true conflict/);
    expect(changed(before2, treeOf(f.tmp))).toEqual([]);
  }, ENGINE_TIMEOUT);

  it('AC-P33 (C-33): the ledger is evaluated on the record\'s outputs; an unknown output gives null with unknown-output and the call succeeds', async () => {
    const r = await newRun(
      'ledger',
      variant((p) => {
        p.ledger.push({ id: 'dps_ratio', claim: 'Stage 2 deals more damage than stage 1.', formula: '2.CombinedDPS / 1.CombinedDPS', inputs: [] });
        p.ledger.push({ id: 'no_output', claim: 'An output PoB doesn\'t have.', formula: '2.NoSuchOutput', inputs: [] });
      }),
    );
    const out = await compile({ plan_path: r.plan, measure_only: true });
    expect(out.isError).toBe(false);
    const record = recordOf(r);
    const o1 = record.stages['1'].outputs;
    const o2 = record.stages['2'].outputs;
    expect(record.ledger.dps_ratio).toEqual({ value: o2.CombinedDPS / o1.CombinedDPS, error: null, computedWithCustomMods: false });
    expect(record.ledger.life_gain_pct.value).toBeCloseTo(((o2.Life - o1.Life) / o1.Life) * 100, 10);
    expect(record.ledger.no_output.value).toBeNull();
    expect(record.ledger.no_output.error).toMatch(/^unknown-output at column 0: "2\.NoSuchOutput"/);
    expect(out.text).toContain(`dps_ratio = ${o2.CombinedDPS / o1.CombinedDPS}`);
    expect(out.text).toMatch(/^no_output: unknown-output at column 0: "2\.NoSuchOutput"/m);
  }, ENGINE_TIMEOUT);

  it('AC-P34 (A-P8): a measure-only subset compiles only its stages; a final compile with stages is refused', async () => {
    const r = await newRun('subset');
    const out = await compile({ plan_path: r.plan, measure_only: true, stages: ['2'] });
    expect(out.isError).toBe(false);
    const record = recordOf(r);
    expect(record.stagesCompiled).toEqual(['2']);
    expect(Object.keys(record.stages)).toEqual(['2']);
    expect(record.ledger.life_gain_pct.value).toBeNull();
    expect(record.ledger.life_gain_pct.error).toMatch(/^stage-not-compiled/);
    const xml = fs.readFileSync(path.join(r.abs, 'compiled-build.xml'), 'utf8');
    expect((xml.match(/<Spec\b/g) ?? []).length).toBe(1);
    expect(xml).toContain('title="Act 1 Ogham Manor (L14) {2}"');

    const before = treeOf(f.tmp);
    const bad = await compile({ plan_path: r.plan, build_name: 'subset', stages: ['2'] });
    expect(bad.isError).toBe(true);
    expect(bad.text).toMatch(/build_name and stages conflict/);
    const unknown = await compile({ plan_path: r.plan, measure_only: true, stages: ['zz'] });
    expect(unknown.isError).toBe(true);
    expect(unknown.text).toContain('"zz"');
    expect(changed(before, treeOf(f.tmp))).toEqual([]);
  }, ENGINE_TIMEOUT);

  it('AC-P36 (D-165): two measure-only compiles of the fixture give equal records and canonically equal XML', async () => {
    const r = await newRun('idempotent');
    expect((await compile({ plan_path: r.plan, measure_only: true })).isError).toBe(false);
    const first = recordOf(r);
    const xml1 = fs.readFileSync(path.join(r.abs, 'compiled-build.xml'), 'utf8');
    expect((await compile({ plan_path: r.plan, measure_only: true })).isError).toBe(false);
    const second = recordOf(r);
    const xml2 = fs.readFileSync(path.join(r.abs, 'compiled-build.xml'), 'utf8');
    const strip = (rec: CompileRecord): Json => {
      const { compiledAt: _c, timing: _t, importCode: _i, pobFile, stages, ...rest } = rec;
      return {
        ...rest,
        pobFile: { location: pobFile.location, path: pobFile.path },
        stages: Object.fromEntries(Object.entries(stages).map(([id, s]) => {
          const { elapsedMs: _e, ...kept } = s;
          return [id, kept];
        })),
      };
    };
    expect(strip(second)).toEqual(strip(first));
    expect(canonicalize(xml2)).toBe(canonicalize(xml1));
  }, ENGINE_TIMEOUT);

  it('WU-30 lever: the deferred rebuilds measure every stage exactly as rebuilding after every mutation does', async () => {
    const deferred = await newRun('deferred');
    expect((await compile({ plan_path: deferred.plan, measure_only: true })).isError).toBe(false);
    const eager = await newRun('eager');
    const original = PoBLuaApiClient.prototype.request;
    const stageCalls: Json[] = [];
    jest.spyOn(PoBLuaApiClient.prototype, 'request').mockImplementation(async function (this: PoBLuaApiClient, ...args: any[]) {
      if (args[0] === 'compile_stage') {
        args[1] = { ...args[1], __noDeferForTest: true };
        stageCalls.push(args[1]);
      }
      return (original as any).apply(this, args);
    } as any);
    try {
      expect((await compile({ plan_path: eager.plan, measure_only: true })).isError).toBe(false);
    } finally {
      jest.restoreAllMocks();
    }
    expect(stageCalls).toHaveLength(2);
    const a = recordOf(deferred);
    const b = recordOf(eager);
    for (const id of ['1', '2']) {
      expect({ id, outputs: a.stages[id].outputs }).toEqual({ id, outputs: b.stages[id].outputs });
      expect({ id, skillOutputs: a.stages[id].skillOutputs }).toEqual({ id, skillOutputs: b.stages[id].skillOutputs });
    }
  }, ENGINE_TIMEOUT);

  // ---------------------------------------------------------------------------------------------------
  // The write ledger (D-211)

  const ledgerPath = () => path.join(f.server.deps.stateDir, WRITE_LEDGER_FILE);
  const readLedger = () => JSON.parse(fs.readFileSync(ledgerPath(), 'utf8')) as { ledgerVersion: number; entries: Json[] };
  const backupsOf = (name: string) => {
    const dir = path.join(f.server.deps.stateDir, 'backups', name);
    return fs.existsSync(dir) ? fs.readdirSync(dir) : [];
  };

  it('AC-P31 (D-199, C-17): a second final compile overwrites with a backup; an existing file without a ledger entry is refused', async () => {
    const backups = backupsOf('m11-two-stage.xml').length;
    const out = await compile({ plan_path: run.plan, build_name: 'm11-two-stage' });
    expect(out.isError).toBe(false);
    expect(out.text).toContain('(replaced; the previous file is backed up in the state folder)');
    expect(backupsOf('m11-two-stage.xml').length).toBe(backups + 1);

    const golden = fs.readFileSync(path.join(f.builds, 'grenadator.xml'));
    const refused = await compile({ plan_path: run.plan, build_name: 'grenadator' });
    expect(refused.isError).toBe(true);
    expect(refused.text).toContain('grenadator.xml already exists');
    expect(fs.readFileSync(path.join(f.builds, 'grenadator.xml')).equals(golden)).toBe(true);
  }, ENGINE_TIMEOUT);

  it('AC-P45 (D-211): final, measure-only, final: the third overwrites; the ledger has one entry for the file; another run is refused', async () => {
    expect((await compile({ plan_path: run.plan, build_name: 'm11-two-stage' })).isError).toBe(false);
    const ledgerBytes = fs.readFileSync(ledgerPath());
    expect((await compile({ plan_path: run.plan, measure_only: true })).isError).toBe(false);
    expect(recordOf(run).pobFile.location).toBe('run');
    expect(fs.readFileSync(ledgerPath()).equals(ledgerBytes)).toBe(true);

    const backups = backupsOf('m11-two-stage.xml').length;
    const third = await compile({ plan_path: run.plan, build_name: 'm11-two-stage' });
    expect(third.isError).toBe(false);
    expect(backupsOf('m11-two-stage.xml').length).toBe(backups + 1);
    const bytes = fs.readFileSync(path.join(f.builds, 'm11-two-stage.xml'));
    const entries = readLedger().entries.filter((e) => e.path === 'm11-two-stage.xml');
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({ path: 'm11-two-stage.xml', sha1: sha1(bytes), runFolder: run.rel });
    expect(Number.isNaN(Date.parse(entries[0].writtenAt))).toBe(false);

    const other = await newRun('second-run');
    const ledgerBefore = fs.readFileSync(ledgerPath());
    const refused = await compile({ plan_path: other.plan, build_name: 'm11-two-stage' });
    expect(refused.isError).toBe(true);
    expect(refused.text).toContain('m11-two-stage.xml already exists');
    expect(refused.text).toContain(`written by run ${run.rel}`);
    expect(refused.text).toContain('Choose another build_name, or rename or move the existing file.');
    expect(fs.readFileSync(path.join(f.builds, 'm11-two-stage.xml')).equals(bytes)).toBe(true);
    expect(fs.readFileSync(ledgerPath()).equals(ledgerBefore)).toBe(true);
  }, ENGINE_TIMEOUT);

  it('AC-P46 (D-211): after the file is edited on disk, re-compiles are refused with the changed-on-disk text: same server, after an auto-reload, after a restart', async () => {
    expect((await compile({ plan_path: run.plan, build_name: 'm11-two-stage' })).isError).toBe(false);
    const target = path.join(f.builds, 'm11-two-stage.xml');
    writeBuild(target, GOLDEN_XML);
    const edited = fs.readFileSync(target);
    const ledger = fs.readFileSync(ledgerPath());
    const unchanged = () => {
      expect(fs.readFileSync(target).equals(edited)).toBe(true);
      expect(fs.readFileSync(ledgerPath()).equals(ledger)).toBe(true);
    };

    // (a) the same server
    const a = await compile({ plan_path: run.plan, build_name: 'm11-two-stage' });
    expect(a.isError).toBe(true);
    expect(a.text).toContain('m11-two-stage.xml changed on disk since the engine loaded or saved it');
    expect(a.text).toContain('Choose another build_name, or rename or move the existing file.');
    unchanged();

    // (b) after a read auto-reloaded the edited file (the in-memory guard now matches it)
    const info = await f.call('lua_get_build_info');
    expect(info.isError).toBe(false);
    expect(info.text).toContain('Reloaded m11-two-stage.xml');
    const b = await compile({ plan_path: run.plan, build_name: 'm11-two-stage' });
    expect(b.isError).toBe(true);
    expect(b.text).toContain('changed on disk');
    unchanged();

    // (c) a second server on the same folders: no in-memory guard at all
    const second = await startTestServer({
      pobDirectory: f.builds,
      stateDir: f.server.deps.stateDir,
      guidesDirectory: f.guides,
      env: { ...f.server.deps.env },
    });
    try {
      const c = (await second.client.callTool(
        { name: 'compile_plan', arguments: { plan_path: run.plan, build_name: 'm11-two-stage' } },
        undefined,
        { timeout: 120_000 },
      )) as { isError?: boolean; content: Array<{ text: string }> };
      expect(c.isError).toBe(true);
      expect(c.content.map((x) => x.text).join('\n')).toContain('changed on disk');
    } finally {
      await second.close();
    }
    unchanged();
  }, ENGINE_TIMEOUT);

  it('C-41: an invalid write ledger fails a final compile naming the file, and is never replaced', async () => {
    const saved = fs.readFileSync(ledgerPath());
    fs.writeFileSync(ledgerPath(), '{"ledgerVersion": 1, "entries": [{"path": 3}]}');
    try {
      const out = await compile({ plan_path: run.plan, build_name: 'ledger-invalid' });
      expect(out.isError).toBe(true);
      expect(out.text).toContain(ledgerPath());
      expect(fs.readFileSync(ledgerPath(), 'utf8')).toBe('{"ledgerVersion": 1, "entries": [{"path": 3}]}');
      expect(fs.existsSync(path.join(f.builds, 'ledger-invalid.xml'))).toBe(false);
    } finally {
      fs.writeFileSync(ledgerPath(), saved);
    }
  }, ENGINE_TIMEOUT);

  it('D-211: a final compile needs its plan inside a run folder (the ledger\'s key); a measure-only one doesn\'t', async () => {
    fs.mkdirSync(f.guides, { recursive: true });
    fs.copyFileSync(FIXTURE, path.join(f.guides, 'loose-plan.json'));
    const before = treeOf(f.tmp);
    const out = await compile({ plan_path: 'loose-plan.json', build_name: 'loose' });
    expect(out.isError).toBe(true);
    expect(out.text).toContain('is not inside a run folder');
    expect(changed(before, treeOf(f.tmp))).toEqual([]);
    const measured = await compile({ plan_path: 'loose-plan.json', measure_only: true });
    expect(measured.isError).toBe(false);
    expect(fs.existsSync(path.join(f.guides, 'compile-record.json'))).toBe(true);
    expect(fs.existsSync(path.join(f.builds, 'loose.xml'))).toBe(false);
  }, ENGINE_TIMEOUT);

  it('D-211 (WU-41 review): a plan in a folder whose name holds a backslash is refused, never keyed to another run', async () => {
    const dir = path.join(f.guides, 'probe\\2026-10-08-1');
    fs.mkdirSync(dir, { recursive: true });
    fs.copyFileSync(FIXTURE, path.join(dir, 'plan.json'));
    const before = treeOf(f.tmp);
    for (const extra of [{ build_name: 'backslash' }, { measure_only: true }]) {
      const out = await compile({ plan_path: 'probe\\2026-10-08-1/plan.json', ...extra });
      expect(out.isError).toBe(true);
      expect(out.text).toContain('whose folder names hold a backslash');
    }
    expect(changed(before, treeOf(f.tmp))).toEqual([]);
  }, ENGINE_TIMEOUT);

  it('AC-B8 (D-211): a final compile writes only the target file, its ledger entry and the record (plus the backup when it replaces)', async () => {
    const r = await newRun('write-roots');
    const before = treeOf(f.tmp);
    const out = await compile({ plan_path: r.plan, build_name: 'write-roots' });
    expect(out.isError).toBe(false);
    expect(changed(before, treeOf(f.tmp))).toEqual(
      ['builds/write-roots.xml', `guides/${r.rel}/compile-record.json`, `state/${WRITE_LEDGER_FILE}`].sort(),
    );
  }, ENGINE_TIMEOUT);

  // ---------------------------------------------------------------------------------------------------
  // Allocation, crashes, request counts

  it('AC-P47 (D-213): an untagged node reached only through a set-1 node is refused naming stage 2 and the node; guide_run validate reports it too', async () => {
    await loadGolden();
    const r = await newRun(
      'weapon-set-path',
      variant((p) => {
        p.stages[1].tree.nodes.push(58528, 45363);
        p.stages[1].tree.weaponSetNodes.set1.push(58528);
      }),
    );
    const before = { tree: treeOf(f.tmp), revision: f.session.revision, export: await canonicalExport(f.session) };
    const out = await compile({ plan_path: r.plan, build_name: 'weapon-set-path' });
    expect(out.isError).toBe(true);
    expect(out.text).toMatch(/^stage 2: node 45363 \(Smash\) is not connected to its start through untagged nodes$/m);
    expect(out.text).not.toMatch(/node 58528 .*not connected/);
    expect(changed(before.tree, treeOf(f.tmp))).toEqual([]);
    expect(f.session.revision).toBe(before.revision);
    expect(await canonicalExport(f.session)).toBe(before.export);
    const validate = await f.call('guide_run', { validate: r.plan });
    expect(validate.isError).toBe(true);
    expect(validate.text).toMatch(/^stage 2: node 45363 \(Smash\) is not connected to its start through untagged nodes$/m);
  }, ENGINE_TIMEOUT);

  it('AC-P35 (D-165): a crash at stage 2 fails the call, writes nothing, takes the no-snapshot path, and a later compile succeeds', async () => {
    const r = await newRun('crash');
    const before = treeOf(f.tmp);
    const original = PoBLuaApiClient.prototype.request;
    jest.spyOn(PoBLuaApiClient.prototype, 'request').mockImplementation(async function (this: PoBLuaApiClient, ...args: any[]) {
      if (args[0] === 'compile_stage' && args[1]?.id === '2') args[1] = { ...args[1], __crashForTest: true };
      return (original as any).apply(this, args);
    } as any);
    let out;
    try {
      out = await compile({ plan_path: r.plan, build_name: 'crash-target' });
    } finally {
      jest.restoreAllMocks();
    }
    expect(out.isError).toBe(true);
    expect(out.text).toContain('The engine stopped while running `compile_plan`');
    expect(changed(before, treeOf(f.tmp))).toEqual([]);

    const info = await f.call('lua_get_build_info');
    expect(info.isError).toBe(true);
    expect(info.text).toContain('the loaded build could not be restored');

    const again = await compile({ plan_path: r.plan, measure_only: true });
    expect(again.isError).toBe(false);
  }, ENGINE_TIMEOUT);

  it('AC-P49 (D-221): a compile sends one request per stage plus five; guide_run validate sends one', async () => {
    const info = await f.call('lua_get_build_info');
    expect(info.isError).toBe(false);
    const r = await newRun('request-count');
    const original = PoBLuaApiClient.prototype.request;
    const log: string[] = [];
    let recording = false;
    const off = f.session.onEvent((e) => {
      if (e.phase === 'start') recording = true;
      if (e.phase === 'end') recording = false;
    });
    jest.spyOn(PoBLuaApiClient.prototype, 'request').mockImplementation(async function (this: PoBLuaApiClient, ...args: any[]) {
      if (recording) log.push(args[0]);
      return (original as any).apply(this, args);
    } as any);
    const sent = async (tool: string, args: Json): Promise<string[]> => {
      log.length = 0;
      const out = await f.call(tool, args);
      expect({ tool, isError: out.isError, text: out.isError ? out.text : '' }).toEqual({ tool, isError: false, text: '' });
      return [...log];
    };
    try {
      expect(await sent('compile_plan', { plan_path: r.plan, build_name: 'request-count' })).toEqual([
        'compile_check', 'new_build', 'compile_stage', 'compile_stage', 'compile_finish', 'export_build_xml', 'export_build_xml',
      ]);
      expect(await sent('compile_plan', { plan_path: r.plan, measure_only: true, stages: ['2'] })).toEqual([
        'compile_check', 'new_build', 'compile_stage', 'compile_finish', 'export_build_xml', 'export_build_xml',
      ]);
      expect(await sent('guide_run', { validate: r.plan })).toEqual(['compile_check']);
    } finally {
      jest.restoreAllMocks();
      off();
    }
  }, ENGINE_TIMEOUT);
  // ---------------------------------------------------------------------------------------------------
  // WU-41 review: off-hands that need a passive, and config values PoB's save drops (D-248)

  const PLANS = path.join(REPO, 'tests', 'fixtures', 'plans');
  const planOf = (name: string): Json => JSON.parse(fs.readFileSync(path.join(PLANS, name, 'plan.json'), 'utf8'));

  /** Every finite number of the main output, Weapon 2's item and the active loadout's sets, by Lua query. */
  const STATE_QUERY = String.raw`
    local o = {}
    for k, v in pairs(build.calcsTab.mainOutput) do
      if type(k) == 'string' and type(v) == 'number' and v == v and v ~= math.huge and v ~= -math.huge then o[k] = v end
    end
    local set = build.itemsTab.activeItemSet
    local w2 = build.itemsTab.items[set['Weapon 2'].selItemId]
    return { outputs = o, weapon2 = w2 and w2.name or '' }`;

  /** Each stage of a saved build, from a fresh load: its loadout selected at its level, its outputs and Weapon 2. */
  async function reloadedStages(buildName: string, record: CompileRecord): Promise<Record<string, { outputs: Record<string, number>; weapon2: string }>> {
    const out: Record<string, { outputs: Record<string, number>; weapon2: string }> = {};
    for (const id of record.stagesCompiled) {
      // From the file as saved each time: PoB2's own loadout switch is the known limitation (loadoutWarnings).
      expect((await f.call('lua_load_build', { build_name: buildName })).isError).toBe(false);
      const sel = await f.call('manage_sets', { set_type: 'loadout', action: 'select', title: record.stages[id].loadoutName });
      expect(sel.isError).toBe(false);
      expect((await f.call('set_character_level', { level: record.stages[id].level })).isError).toBe(false);
      out[id] = await luaQuery(STATE_QUERY);
    }
    return out;
  }

  /** The outputs that differ from the record by more than relative 1e-9 (or exist in only one). */
  function outputDiffs(recorded: Record<string, number>, got: Record<string, number>): string[] {
    return [...new Set([...Object.keys(recorded), ...Object.keys(got)])].filter((k) => {
      const a = recorded[k];
      const b = got[k];
      if (a === undefined || b === undefined) return true;
      return Math.abs(a - b) > 1e-9 * Math.max(Math.abs(a), Math.abs(b), 1e-12);
    });
  }

  /** Compile `plan` in a new run, deferred or eager (`__noDeferForTest` on every stage). */
  async function compileWith(slug: string, plan: Json, args: Json, eager: boolean) {
    const r = await newRun(slug, plan);
    const original = PoBLuaApiClient.prototype.request;
    if (eager) {
      jest.spyOn(PoBLuaApiClient.prototype, 'request').mockImplementation(async function (this: PoBLuaApiClient, ...a: any[]) {
        if (a[0] === 'compile_stage') a[1] = { ...a[1], __noDeferForTest: true };
        return (original as any).apply(this, a);
      } as any);
    }
    try {
      return { run: r, out: await compile({ plan_path: r.plan, ...args }) };
    } finally {
      jest.restoreAllMocks();
    }
  }

  /** Each off-hand fixture and the weapon-fit flag its stages differ in. */
  const OFF_HAND_FIXTURES: Record<string, string> = {
    'off-hand-fresh': 'Instruments of Power',
    'off-hand-shared': 'Instruments of Power',
    // Treefingers' Giant's Blood: an item-granted flag, the gloves listed after the clubs.
    'off-hand-item': "Giant's Blood",
  };
  /** The Weapon 2 item a stage plans (a Normal item's name is its base, the text's second line), or ''. */
  const plannedWeapon2 = (stage: Json): string => {
    const w2 = stage.items.slots.find((x: Json) => x.slot === 'Weapon 2');
    return w2 ? String(w2.text).split('\n')[1] : '';
  };

  for (const [fixture, flagName] of Object.entries(OFF_HAND_FIXTURES)) {
    for (const eager of [false, true]) {
      const pathName = eager ? 'eager' : 'deferred';
      it(`WU-41 review (D-213 for items): ${fixture}, ${pathName}: every stage keeps its planned off-hand, is measured with it and reloads as recorded`, async () => {
        const plan = planOf(fixture);
        const buildName = `${fixture}-${pathName}`;
        const { run: r, out } = await compileWith(`${fixture}-${pathName}`, plan, { build_name: buildName }, eager);
        expect({ isError: out.isError, text: out.isError ? out.text : '' }).toEqual({ isError: false, text: '' });
        const record = recordOf(r);

        // The saved item sets hold exactly the planned off-hands.
        const sets = await luaQuery<Array<{ id: number; weapon2: string }>>(String.raw`
          local o = {}
          for _, id in ipairs(build.itemsTab.itemSetOrderList) do
            local s = build.itemsTab.itemSets[id]
            local it = build.itemsTab.items[s['Weapon 2'].selItemId]
            o[#o + 1] = { id = id, weapon2 = it and it.name or '' }
          end
          return o`);
        for (const s of sets) {
          const owner = record.sets.find((x) => x.kind === 'item' && x.id === s.id)!.stages[0];
          const want = plannedWeapon2(plan.stages.find((x: Json) => x.id === owner));
          expect({ set: s.id, weapon2: s.weapon2 }).toEqual({ set: s.id, weapon2: want });
        }

        // Each stage was measured with its own items (a Focus adds energy shield, a staff alone gives none),
        // and reloads as recorded.
        const reloaded = await reloadedStages(buildName, record);
        for (const stage of plan.stages) {
          const want = plannedWeapon2(stage);
          expect({ stage: stage.id, weapon2: reloaded[stage.id].weapon2 }).toEqual({ stage: stage.id, weapon2: want });
          if (flagName === 'Instruments of Power') {
            expect({ stage: stage.id, es: record.stages[stage.id].outputs.EnergyShield > 0 }).toEqual({ stage: stage.id, es: want !== '' });
          }
          expect({ stage: stage.id, diffs: outputDiffs(record.stages[stage.id].outputs, reloaded[stage.id].outputs) }).toEqual({ stage: stage.id, diffs: [] });
        }

        // The stages differ in the flag: the record and the text warn about PoB2's loadout switch.
        expect(record.loadoutWarnings).toHaveLength(1);
        expect(record.loadoutWarnings[0]).toMatch(new RegExp(`^Stages differ in ${flagName} \\(`));
        expect(record.loadoutWarnings[0]).toContain('re-equip the planned off-hand');
        expect(out.text).toContain(`Loadout warning: ${record.loadoutWarnings[0]}`);
      }, ENGINE_TIMEOUT);
    }
  }

  it('WU-41 review: the deferred and eager paths measure the off-hand stages identically', async () => {
    const plan = planOf('off-hand-shared');
    const a = await compileWith('off-hand-equal-deferred', plan, { measure_only: true }, false);
    const b = await compileWith('off-hand-equal-eager', plan, { measure_only: true }, true);
    expect(a.out.isError).toBe(false);
    expect(b.out.isError).toBe(false);
    const ra = recordOf(a.run);
    const rb = recordOf(b.run);
    for (const id of ra.stagesCompiled) {
      expect({ id, outputs: ra.stages[id].outputs, skills: ra.stages[id].skillOutputs }).toEqual({
        id,
        outputs: rb.stages[id].outputs,
        skills: rb.stages[id].skillOutputs,
      });
    }
  }, ENGINE_TIMEOUT);

  it('WU-41 review: a stage whose shared item set holds an off-hand it can\'t use is refused, naming the stage and the item; nothing is written', async () => {
    const plan = planOf('off-hand-shared');
    // Stage 3 has no Instruments of Power but now shares stages 2 and 4's staff-and-focus set.
    plan.stages[2].items = JSON.parse(JSON.stringify(plan.stages[1].items));
    for (const eager of [false, true]) {
      const before = treeOf(f.tmp);
      const { out } = await compileWith(`off-hand-invalid-${eager ? 'eager' : 'deferred'}`, plan, { build_name: 'off-hand-invalid' }, eager);
      expect({ eager, isError: out.isError }).toEqual({ eager, isError: true });
      expect(out.text).toMatch(/^stage 3: Weapon 2 is empty in PoB, but the plan equips "Twig Focus" there: PoB unequipped it/m);
      const after = treeOf(f.tmp);
      expect(changed(before, after).filter((p) => !p.endsWith('/plan.json'))).toEqual([]);
    }
  }, ENGINE_TIMEOUT);

  const PROBE_TAG = { kind: 'judgment', ref: 'a test value, to exercise the saved config', confidence: 'H' };
  const CONFIG_CASES: { name: string; option: string; edit: (p: Json) => void }[] = [
    {
      // Stage 2 (the saved, active stage) has the placeholder enemyLevel 14, stage 1 sets 14 explicitly.
      name: 'enemyLevel equal to the saved stage\'s placeholder',
      option: 'enemyLevel',
      edit: (p) => p.stages[0].config.scenario.push({ option: 'enemyLevel', value: 14, source: { file: 'campaign/areas.json', key: 'act1' }, tag: PROBE_TAG }),
    },
    {
      // Stage 2 fights a Pinnacle boss (placeholder enemyFireResist 50); stage 1 sets 50 explicitly.
      name: 'enemyFireResist equal to a Pinnacle stage\'s placeholder',
      option: 'enemyFireResist',
      edit: (p) => {
        p.stages[1].config.scenario.find((e: Json) => e.option === 'enemyIsBoss').value = 'Pinnacle';
        p.stages[0].config.scenario.push({ option: 'enemyFireResist', value: 50, source: { file: 'enemies/arbiter-of-divinity.json', key: 'res.fire' }, tag: PROBE_TAG });
      },
    },
  ];

  for (const [i, c] of CONFIG_CASES.entries()) {
    it(`D-248: ${c.name}: the saved file keeps stage 1's explicit value, and every stage reloads as recorded`, async () => {
      const plan = variant(c.edit);
      const buildName = `saved-config-${i + 1}`;
      const r = await newRun(`saved-config-${i + 1}`, plan);
      const out = await compile({ plan_path: r.plan, build_name: buildName });
      expect({ isError: out.isError, text: out.isError ? out.text : '' }).toEqual({ isError: false, text: '' });
      const record = recordOf(r);
      const xml = fs.readFileSync(path.join(f.builds, `${buildName}.xml`), 'utf8');
      const stageOneSet = record.sets.find((s) => s.kind === 'config' && s.stages.includes('1'))!;
      const setXml = new RegExp(`<ConfigSet\\b[^>]*\\bid="${stageOneSet.id}"[^>]*>([\\s\\S]*?)</ConfigSet>`).exec(xml);
      expect(setXml).not.toBeNull();
      expect(setXml![1]).toMatch(new RegExp(`<Input\\b(?=[^>]*\\bname="${c.option}")(?=[^>]*\\bnumber="${plan.stages[0].config.scenario.at(-1).value}")[^>]*/>`));
      expect(decodePobCode(record.importCode)).toBe(xml);
      // The file keeps the value; a save in PoB2 would drop it again, which the record and the text say.
      const value = plan.stages[0].config.scenario.at(-1).value;
      expect(record.saveWarnings).toEqual([expect.stringMatching(new RegExp(`^Saving this file in PoB2 drops these options from stage 1: .*\\b${c.option} = ${value}\\b`))]);
      expect(out.text).toContain(`Save warning: ${record.saveWarnings[0]}`);
      const reloaded = await reloadedStages(buildName, record);
      for (const id of record.stagesCompiled) {
        expect({ stage: id, diffs: outputDiffs(record.stages[id].outputs, reloaded[id].outputs) }).toEqual({ stage: id, diffs: [] });
      }
    }, ENGINE_TIMEOUT);
  }
});

// -----------------------------------------------------------------------------------------------------
// Static parts (no engine)

describe('AC-P38 (D-216): the plan tools\' metadata and schema (static)', () => {
  it('AC-P38: TOOL_META.compile_plan is {load, core} and guide_run {read, core}; compile_plan has no new_run or validate_only argument', () => {
    expect(TOOL_META.compile_plan).toEqual({ engine: 'load', group: 'core' });
    expect(TOOL_META.guide_run).toEqual({ engine: 'read', group: 'core' });
    const schema = getLuaToolSchemas().find((t) => t.name === 'compile_plan');
    expect(schema).toBeDefined();
    // D-466 (AC-K78): first_free, draft_name and remove_draft join the compile modes' arguments.
    expect(Object.keys(schema.inputSchema.properties).sort()).toEqual([
      'build_name',
      'draft_name',
      'first_free',
      'measure_only',
      'plan_path',
      'remove_draft',
      'stages',
    ]);
    expect(schema.inputSchema.properties).not.toHaveProperty('new_run');
    expect(schema.inputSchema.properties).not.toHaveProperty('validate_only');
  });

  it('AC-P38 (D-103): Compile.lua never calls CopyLoadout', () => {
    const lua = fs.readFileSync(path.join(REPO, 'pob-api', 'API', 'Compile.lua'), 'utf8');
    expect(lua).not.toContain('CopyLoadout');
  });
});

describe('AC-P37, AC-T22 (C-19, review S17): the timing NFR tests run only in their own --runInBand step (static)', () => {
  const NFR = ['tests/integration/compilePlanNfr.test.ts', 'tests/integration/tradeQueryNfr.test.ts'];
  const STEP = `pnpm exec jest --runInBand --testPathIgnorePatterns /node_modules/ -- ${NFR.join(' ')}`;
  const jest = (args: string[]) =>
    execFileSync(process.execPath, [path.join(REPO, 'node_modules', 'jest', 'bin', 'jest.js'), ...args], {
      cwd: REPO,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    })
      .split('\n')
      .filter((l) => l.trim() !== '')
      .map((l) => path.relative(REPO, l.trim()).split(path.sep).join('/'));

  it('AC-P37, AC-T22: the main run\'s selection lists neither NFR test, and the step\'s command lists exactly them', () => {
    const main = jest(['--listTests']);
    expect(main.length).toBeGreaterThan(50);
    for (const nfr of NFR) expect(main).not.toContain(nfr);
    const step = STEP.replace(/^pnpm exec jest /, '').split(' ');
    expect(jest(['--listTests', ...step]).sort()).toEqual([...NFR].sort());
  }, 120_000);

  it('AC-P37, AC-T22: mise.toml\'s test task runs that step as its own entry, after pnpm test, with no pipe', () => {
    const toml = fs.readFileSync(path.join(REPO, 'mise.toml'), 'utf8');
    const task = /\[tasks\.test\][\s\S]*?(?=\n\[|$)/.exec(toml)![0];
    const run = /^run = \[([\s\S]*?)\]$/m.exec(task)![1];
    const entries = [...run.matchAll(/"([^"]*)"/g)].map((m) => m[1]);
    expect(entries.indexOf('pnpm test')).toBeGreaterThanOrEqual(0);
    expect(entries.indexOf(STEP)).toBeGreaterThan(entries.indexOf('pnpm test'));
    for (const e of entries) expect(e).not.toContain('|');
  });
});
