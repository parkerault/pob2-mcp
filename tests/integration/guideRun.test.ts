/**
 * `guide_run` (WU-41, C-50, D-207, D-216) and the guides-root overlap rule (D-220), in process.
 *
 * - AC-P30: `new_run` creates the next run folder without the engine (no session event, no engine start),
 *   and reports `loadedBuildUnsaved` from the session; bad slugs and mode conflicts create nothing.
 * - AC-P28: `validate` checks a plan's schema and, through `compile_check`, its stages against the game
 *   data, without changing the engine's build (no config set is created on the loaded build, review S21).
 * - AC-P48: a guides root that is, is inside, contains or links into the builds folder is refused by
 *   `guide_run {new_run}` and by a measure-only `compile_plan`, and nothing is created anywhere; a sibling
 *   root (the default layout) works.
 * The engine-required parts use `engineDescribe`; every folder is a private temp dir.
 */
import crypto from 'crypto';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import { engineDescribe } from '../helpers/engine';
import { canonicalExport, startSessionFixture, type SessionFixture } from '../helpers/engineSession';
import { startTestServer, type TestServer } from '../helpers/server';
import { localDateStamp } from '../../src/utils/guidesPath';
import { engineKindFor } from '../../src/server/toolRouter';

const FIXTURE = path.resolve(__dirname, '..', 'fixtures', 'plans', 'two-stage', 'plan.json');
const ENGINE_TIMEOUT = 240_000;
type Json = Record<string, any>;

const sha1 = (data: Buffer) => crypto.createHash('sha1').update(data).digest('hex');

/** Every file and folder under `dir`: relative path → sha1, or "dir" (missing dir → empty). */
function treeOf(dir: string): Record<string, string> {
  const out: Record<string, string> = {};
  const walk = (d: string) => {
    if (!fs.existsSync(d)) return;
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      const rel = path.relative(dir, p).split(path.sep).join('/');
      if (e.isDirectory()) {
        out[rel] = 'dir';
        walk(p);
      } else if (e.isFile()) out[rel] = sha1(fs.readFileSync(p));
      else if (e.isSymbolicLink()) out[rel] = `link:${fs.readlinkSync(p)}`;
    }
  };
  walk(dir);
  return out;
}

async function callOn(server: TestServer, tool: string, args: Json): Promise<{ isError: boolean; text: string }> {
  const r = (await server.client.callTool({ name: tool, arguments: args }, undefined, { timeout: 120_000 })) as {
    isError?: boolean;
    content?: Array<{ text?: string }>;
  };
  return { isError: r.isError === true, text: (r.content ?? []).map((c) => c.text ?? '').join('\n') };
}

describe('AC-P30 (D-216): guide_run new_run is routed as kind none', () => {
  it('AC-P30: engineKindFor gives none for any call carrying new_run, and read for validate', () => {
    expect(engineKindFor('guide_run', { new_run: 'x' })).toBe('none');
    expect(engineKindFor('guide_run', { new_run: 'x', validate: 'y' })).toBe('none');
    expect(engineKindFor('guide_run', { validate: 'a/b/plan.json' })).toBe('read');
    expect(engineKindFor('guide_run', { validate: 'a/b/plan.json', stages: ['1'] })).toBe('read');
  });
});

engineDescribe('WU-41: guide_run (C-50)', () => {
  let f: SessionFixture;

  beforeAll(async () => {
    f = await startSessionFixture({ testActions: true });
  }, ENGINE_TIMEOUT);

  afterAll(async () => f?.close(), 60_000);

  async function luaQuery<T>(code: string): Promise<T> {
    const { value } = await f.session.run({ tool: 'test:guide-query', kind: 'read' }, async (ctx) => {
      const reply = await ctx.client.request('__test_eval', { code });
      return reply.result as T;
    });
    return value;
  }

  it('AC-P30 (D-207, D-210, D-216): new_run creates the next run folder without the engine, and reports unsaved changes', async () => {
    // A fresh server: the engine has never started.
    expect(f.session.enginePid()).toBeNull();
    const events: string[] = [];
    const off = f.session.onEvent((e) => events.push(`${e.tool}:${e.phase}`));
    const today = localDateStamp(new Date());
    const first = await f.call('guide_run', { new_run: 'titan-blood-hunt' });
    off();
    expect(first.isError).toBe(false);
    const abs = path.join(f.guides, 'titan-blood-hunt', `${today}-1`);
    expect(first.text).toBe(
      [`Created run folder ${abs}`, `plan_path for this run: titan-blood-hunt/${today}-1/plan.json`, 'loadedBuildUnsaved: false'].join('\n'),
    );
    expect(path.isAbsolute(abs)).toBe(true);
    expect(fs.statSync(abs).isDirectory()).toBe(true);
    expect(f.session.enginePid()).toBeNull();
    expect(events).toEqual([]);

    const second = await f.call('guide_run', { new_run: 'titan-blood-hunt' });
    expect(second.isError).toBe(false);
    expect(second.text).toContain(`plan_path for this run: titan-blood-hunt/${today}-2/plan.json`);

    // With unsaved changes on the loaded build, the reply names it; the call changes nothing in the engine.
    expect((await f.call('lua_load_build', { build_name: 'grenadator' })).isError).toBe(false);
    expect((await f.call('set_character_level', { level: 77 })).isError).toBe(false);
    const before = { export: await canonicalExport(f.session), revision: f.session.revision };
    const dirty = await f.call('guide_run', { new_run: 'titan-blood-hunt' });
    expect(dirty.isError).toBe(false);
    expect(dirty.text).toContain('loadedBuildUnsaved: true');
    expect(dirty.text).toMatch(/^The engine's loaded build "grenadator" has unsaved changes\./m);
    expect(f.session.revision).toBe(before.revision);
    expect(await canonicalExport(f.session)).toBe(before.export);

    // A slug that isn't one safe path segment, and new_run with validate, create nothing.
    const tree = treeOf(f.tmp);
    for (const args of [{ new_run: '../x' }, { new_run: 'Titan' }, { new_run: 'ok-slug', validate: 'a/b/plan.json' }, {}]) {
      const out = await f.call('guide_run', args);
      expect({ args, isError: out.isError }).toEqual({ args, isError: true });
    }
    expect(treeOf(f.tmp)).toEqual(tree);
  }, ENGINE_TIMEOUT);

  it('AC-P28 (D-167, D-216, A-P12): validate reports a valid plan without changing the loaded build or creating a config set', async () => {
    expect((await f.call('lua_load_build', { build_name: 'grenadator' })).isError).toBe(false);
    const made = await f.call('guide_run', { new_run: 'validate' });
    const planPath = /^plan_path for this run: (\S+)$/m.exec(made.text)![1];
    const runDir = path.join(f.guides, path.dirname(planPath));
    fs.copyFileSync(FIXTURE, path.join(f.guides, planPath));

    const configSets = () => luaQuery<number>('return #build.configTab.configSetOrderList');
    const before = { export: await canonicalExport(f.session), revision: f.session.revision, configSets: await configSets() };
    const out = await f.call('guide_run', { validate: planPath });
    expect(out.isError).toBe(false);
    expect(out.text).toBe(`Plan ${planPath} is valid: 2 stages (1, 2).`);
    expect(await canonicalExport(f.session)).toBe(before.export);
    expect(f.session.revision).toBe(before.revision);
    expect(await configSets()).toBe(before.configSets);
    expect(fs.readdirSync(runDir)).toEqual(['plan.json']);

    const subset = await f.call('guide_run', { validate: planPath, stages: ['2'] });
    expect(subset.text).toBe(`Plan ${planPath} is valid: 1 stage (2).`);
    const unknown = await f.call('guide_run', { validate: planPath, stages: ['zz'] });
    expect(unknown.isError).toBe(true);
    expect(unknown.text).toContain('"zz"');

    // An invalid plan: every error with its JSON path.
    const plan = JSON.parse(fs.readFileSync(FIXTURE, 'utf8'));
    plan.stages[1].level = 0;
    delete plan.ledger;
    fs.writeFileSync(path.join(f.guides, planPath), JSON.stringify(plan));
    const invalid = await f.call('guide_run', { validate: planPath });
    expect(invalid.isError).toBe(true);
    expect(invalid.text).toMatch(/^stages\[1\]\.level \(stage 2\): /m);
    expect(invalid.text).toMatch(/^ledger: /m);

    // A stage-2 unknown gem: named with the stage, the engine untouched.
    const gem = JSON.parse(fs.readFileSync(FIXTURE, 'utf8'));
    gem.stages[1].skills.groups[1].gems[0].name = 'Rolling Slamm';
    fs.writeFileSync(path.join(f.guides, planPath), JSON.stringify(gem));
    const beforeGem = { export: await canonicalExport(f.session), revision: f.session.revision };
    const bad = await f.call('guide_run', { validate: planPath });
    expect(bad.isError).toBe(true);
    expect(bad.text).toMatch(/^stage 2: skills\.groups\[1\]\.gems\[0\]: unknown gem "Rolling Slamm"/m);
    expect(f.session.revision).toBe(beforeGem.revision);
    expect(await canonicalExport(f.session)).toBe(beforeGem.export);
  }, ENGINE_TIMEOUT);
});

engineDescribe('AC-P48 (D-220): a guides root overlapping the builds folder is refused', () => {
  let tmp: string;

  beforeAll(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'pob2-guides-overlap-'));
  });
  afterAll(() => fs.rmSync(tmp, { recursive: true, force: true }));

  /** A server over `<case>/builds` (holding a valid run folder plan where the guides root can see it). */
  async function serverFor(name: string, guides: (builds: string, base: string) => string) {
    const base = path.join(tmp, name);
    const builds = path.join(base, 'PoB', 'Builds');
    fs.mkdirSync(builds, { recursive: true });
    const guidesDirectory = guides(builds, base);
    const server = await startTestServer({
      pobDirectory: builds,
      stateDir: path.join(base, 'state'),
      guidesDirectory,
      env: { POB_DIRECTORY: builds, XDG_STATE_HOME: path.join(base, 'xdg'), POB_GUIDES_DIRECTORY: guidesDirectory },
    });
    return { base, builds, guidesDirectory, server };
  }

  const OVERLAPS: { name: string; guides: (builds: string, base: string) => string }[] = [
    { name: 'the builds folder itself', guides: (builds) => builds },
    { name: 'a folder inside it', guides: (builds) => path.join(builds, 'Guides') },
    { name: 'its parent', guides: (builds) => path.dirname(builds) },
    {
      name: 'a symlink resolving inside it',
      guides: (builds, base) => {
        fs.mkdirSync(path.join(builds, 'inner'), { recursive: true });
        fs.symlinkSync(path.join(builds, 'inner'), path.join(base, 'guides-link'));
        return path.join(base, 'guides-link');
      },
    },
  ];

  for (const [i, c] of OVERLAPS.entries()) {
    it(`AC-P48: a guides root that is ${c.name}: new_run and a measure-only compile are refused naming both paths, nothing created`, async () => {
      const { base, builds, guidesDirectory, server } = await serverFor(`case-${i + 1}`, c.guides);
      try {
        const before = treeOf(base);
        const run = await callOn(server, 'guide_run', { new_run: 'x' });
        const compile = await callOn(server, 'compile_plan', { plan_path: `x/${localDateStamp(new Date())}-1/plan.json`, measure_only: true });
        for (const out of [run, compile]) {
          expect(out.isError).toBe(true);
          expect(out.text).toContain(guidesDirectory);
          expect(out.text).toContain(builds);
          expect(out.text).toContain('POB_GUIDES_DIRECTORY');
          expect(out.text).toContain('POB_DIRECTORY');
        }
        expect(treeOf(base)).toEqual(before);
      } finally {
        await server.close();
      }
    }, ENGINE_TIMEOUT);
  }

  it('AC-P48: a sibling guides root (the default layout) works', async () => {
    const { builds, server } = await serverFor('sibling', (b) => path.join(path.dirname(b), 'Guides'));
    try {
      const run = await callOn(server, 'guide_run', { new_run: 'x' });
      expect(run.isError).toBe(false);
      const planPath = /^plan_path for this run: (\S+)$/m.exec(run.text)![1];
      const guides = path.join(path.dirname(builds), 'Guides');
      fs.copyFileSync(FIXTURE, path.join(guides, planPath));
      const compile = await callOn(server, 'compile_plan', { plan_path: planPath, measure_only: true });
      expect(compile.isError).toBe(false);
      expect(fs.existsSync(path.join(guides, path.dirname(planPath), 'compile-record.json'))).toBe(true);
    } finally {
      await server.close();
    }
  }, ENGINE_TIMEOUT);
});
