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
 * - WU-68 (D-356): `view` reads part of a plan without the engine (kind `none`): `{plan, stage}` one stage's
 *   section with its key figures from the record beside the plan, `{plan, claims: true}` every claim, compact;
 *   its argument and file errors are `isError` and change nothing. AC-P67 (engine): on the fifteen-stage
 *   fixture, after a measure-only compile, the stage view's key-figure line is `compile_plan`'s, and each view
 *   is under 25K tokens. Tokens are bounded by UTF-8 bytes: every token of a byte-level BPE tokenizer covers
 *   at least one byte, so a reply of at most 25,000 bytes is at most 25,000 tokens.
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
import { VIEW_MAX_CHARS } from '../../src/handlers/planHandlers';
import { keyFigureLine } from '../../src/plan/compiler';
import type { CompileRecord } from '../../src/plan/record';

const FIXTURE = path.resolve(__dirname, '..', 'fixtures', 'plans', 'two-stage', 'plan.json');
const FIFTEEN = path.resolve(__dirname, '..', 'fixtures', 'plans', 'fifteen-stage', 'plan.json');
/** Read's cut-off, and Claude Code's default for an MCP tool reply, in tokens (D-356). */
const CUT_OFF_TOKENS = 25_000;
/** At most this many tokens: each token of a byte-level BPE tokenizer covers at least one UTF-8 byte. */
const tokenBound = (text: string) => Buffer.byteLength(text, 'utf8');
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

/** The stage view's plan section: the JSON after its `stages[<i>]:` line. */
function sectionOf(text: string, index: number): unknown {
  const marker = `\nstages[${index}]:\n`;
  const at = text.indexOf(marker);
  if (at < 0) throw new Error(`no stages[${index}] section in: ${text.slice(0, 300)}`);
  return JSON.parse(text.slice(at + marker.length));
}

/** What the claims view prints for one claim (D-356): `- <id> (<kind>): <text> [<source>]`. */
function claimLine(c: Json): string {
  const src =
    typeof c.source === 'string'
      ? c.source
      : [`${c.source.kind} ${c.source.ref}`, ...Object.entries(c.source).filter(([k]) => k !== 'kind' && k !== 'ref').map(([k, v]) => `${k} ${v}`)].join(', ');
  return `- ${c.id}${c.kind ? ` (${c.kind})` : ''}: ${c.text} [${src}]`;
}

describe('WU-68 (D-356): guide_run views read a plan without the engine', () => {
  let f: SessionFixture;
  const PLAN = 'fifteen/2026-10-11-1/plan.json';
  const plan = JSON.parse(fs.readFileSync(FIFTEEN, 'utf8')) as Json;
  let events: string[];
  let off: () => void;

  /** Write `data` as a plan at `rel` in the guides root. */
  const put = (rel: string, data: unknown) => {
    fs.mkdirSync(path.dirname(path.join(f.guides, rel)), { recursive: true });
    fs.writeFileSync(path.join(f.guides, rel), typeof data === 'string' ? data : JSON.stringify(data, null, 2));
  };

  beforeAll(async () => {
    f = await startSessionFixture();
    put(PLAN, plan);
    events = [];
    off = f.session.onEvent((e) => events.push(`${e.tool}:${e.phase}`));
  });

  afterAll(async () => {
    off?.();
    // No view call entered the session or started the engine.
    expect(events).toEqual([]);
    expect(f.session.enginePid()).toBeNull();
    await f?.close();
  }, 60_000);

  it('D-356: a view call is routed as kind none, whatever else it carries', () => {
    const view = { plan: PLAN, stage: '1' };
    expect(engineKindFor('guide_run', { view })).toBe('none');
    expect(engineKindFor('guide_run', { view: { plan: PLAN, claims: true } })).toBe('none');
    expect(engineKindFor('guide_run', { view, validate: PLAN })).toBe('none');
    expect(engineKindFor('guide_run', { view, new_run: 'x' })).toBe('none');
    expect(engineKindFor('guide_run', { validate: PLAN })).toBe('read');
  });

  it("D-356: {plan, stage} returns that stage's plan section, and says there are no key figures before a compile", async () => {
    const out = await f.call('guide_run', { view: { plan: PLAN, stage: '7' } });
    expect(out.isError).toBe(false);
    const lines = out.text.split('\n');
    expect(lines.slice(0, 3)).toEqual([
      `Plan ${PLAN}, stage 7: stages[6] of 15.`,
      'Key figures: none yet: there is no compile-record.json beside the plan (compile_plan writes it).',
      'stages[6]:',
    ]);
    expect(sectionOf(out.text, 6)).toEqual(plan.stages[6]);
    expect(f.session.enginePid()).toBeNull();
  });

  it('D-356: {plan, claims: true} returns every claim, one line each under its stage, with kind and source', async () => {
    const out = await f.call('guide_run', { view: { plan: PLAN, claims: true } });
    expect(out.isError).toBe(false);
    const expected = [`Plan ${PLAN}: 15 claims in 15 of its 15 stages, one line each: - <id> (<kind>): <text> [<source>]`];
    plan.stages.forEach((s: Json, i: number) => expected.push(`Stage ${s.id}, stages[${i}]: 1 claim`, ...s.claims.map(claimLine)));
    expect(out.text).toBe(expected.join('\n'));
    expect(out.text).toContain("- s15-life: Stage 15's maximum life at level 90. [pob-computed 15.Life]");

    // A claim's kind, a tag's other fields and a citation string; a stage without claims is left out.
    const varied = JSON.parse(JSON.stringify(plan));
    varied.stages[1].claims = [
      { id: 'hinge-1', kind: 'hinge', text: 'Blood Hunt hits harder.', source: { kind: 'external', ref: 'https://example.com/x', accessed: '2026-10-01', confidence: 'M' } },
      { id: 'reason-1', kind: 'reason', text: 'The ledger says so.', source: 'ledger:dps_gain' },
    ];
    varied.stages[2].claims = [];
    put('varied/2026-10-11-1/plan.json', varied);
    const v = await f.call('guide_run', { view: { plan: 'varied/2026-10-11-1/plan.json', claims: true } });
    expect(v.isError).toBe(false);
    expect(v.text).toContain(
      [
        'Stage 2, stages[1]: 2 claims',
        '- hinge-1 (hinge): Blood Hunt hits harder. [external https://example.com/x, accessed 2026-10-01, confidence M]',
        '- reason-1 (reason): The ledger says so. [ledger:dps_gain]',
        'Stage 4, stages[3]: 1 claim',
      ].join('\n'),
    );
    expect(v.text.split('\n')[0]).toBe(
      'Plan varied/2026-10-11-1/plan.json: 15 claims in 14 of its 15 stages, one line each: - <id> (<kind>): <text> [<source>]',
    );
  });

  it("D-356: the claims view stops at a stage's boundary under VIEW_MAX_CHARS and names the stages it leaves out", async () => {
    const big = JSON.parse(JSON.stringify(plan));
    big.stages.forEach((s: Json, i: number) => {
      s.claims = Array.from({ length: 40 }, (_, k) => ({ id: `c${i}-${k}`, text: `${'word '.repeat(60)}end.`, source: `ledger:x${k}` }));
    });
    put('big/2026-10-11-1/plan.json', big);
    const out = await f.call('guide_run', { view: { plan: 'big/2026-10-11-1/plan.json', claims: true } });
    expect(out.isError).toBe(false);
    expect(out.text.length).toBeLessThanOrEqual(VIEW_MAX_CHARS);
    const lines = out.text.split('\n');
    const shownStages = lines.filter((l) => /^Stage \S+, stages\[\d+\]: 40 claims$/.test(l)).length;
    const shownClaims = lines.filter((l) => l.startsWith('- c')).length;
    expect(shownStages).toBeGreaterThan(0);
    expect(shownClaims).toBe(shownStages * 40);
    const left = big.stages.slice(shownStages).map((s: Json) => s.id);
    expect(lines[lines.length - 1]).toBe(
      `${600 - shownClaims} more claims, in stages ${left.join(', ')}, are left out to keep this reply under 25K tokens; ` +
        'view each with {view: {plan, stage}}.',
    );
  });

  it('D-356: view argument and file errors are isError naming the problem, and change nothing', async () => {
    put('broken/2026-10-11-1/plan.json', '{"stages": [');
    const view = { plan: PLAN, stage: '1' };
    const cases: [Json, RegExp][] = [
      [{ view: { plan: PLAN, stage: '1', claims: true } }, /view\.stage and view\.claims conflict/],
      [{ view: { plan: PLAN } }, /view needs stage or claims/],
      [{ view: { plan: PLAN, claims: false } }, /view\.claims must be true/],
      [{ view: { plan: PLAN, stage: 3 } }, /view\.stage must be a non-empty string/],
      [{ view: { stage: '1' } }, /view\.plan must be a non-empty string/],
      [{ view: PLAN }, /view must be an object: \{plan, stage\}/],
      [{ view: { ...view, page: 2 } }, /view takes only plan, stage, claims; it has no key "page"/],
      [{ view, validate: PLAN }, /validate and view conflict: give exactly one of new_run, validate and view/],
      [{ view, new_run: 'x' }, /new_run and view conflict/],
      [{ view, stages: ['1'] }, /stages goes only with validate, not with view/],
      [{ view: { plan: 'fifteen/nowhere/plan.json', stage: '1' } }, /view\.plan "fifteen\/nowhere\/plan\.json" names no file in the guides root/],
      [{ view: { plan: '../outside/plan.json', claims: true } }, /view\.plan "\.\.\/outside\/plan\.json" has a "\.\." segment/],
      [{ view: { plan: 'broken/2026-10-11-1/plan.json', claims: true } }, /isn't JSON/],
      [{ view: { plan: PLAN, stage: '99' } }, /the plan has no stage "99"; its stages are 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15/],
    ];
    const before = treeOf(f.tmp);
    for (const [args, re] of cases) {
      const out = await f.call('guide_run', args);
      expect({ args, isError: out.isError, matches: re.test(out.text) || out.text }).toEqual({ args, isError: true, matches: true });
    }
    expect(treeOf(f.tmp)).toEqual(before);
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

  it("AC-P67 (WU-68, D-356): on the fifteen-stage fixture, the views give one stage's section with its key figures, and every claim compact, each under 25K tokens", async () => {
    const made = await f.call('guide_run', { new_run: 'fifteen-views' });
    const planPath = /^plan_path for this run: (\S+)$/m.exec(made.text)![1];
    const planFile = path.join(f.guides, planPath);
    fs.copyFileSync(FIFTEEN, planFile);
    const plan = JSON.parse(fs.readFileSync(FIFTEEN, 'utf8')) as Json;

    // Measure the last, largest stage, as an agent does before it reads the stage.
    const compile = await f.call('compile_plan', { plan_path: planPath, measure_only: true, stages: ['15'] });
    expect({ isError: compile.isError, text: compile.isError ? compile.text : '' }).toEqual({ isError: false, text: '' });
    const compiled = compile.text.split('\n');
    const replyLine = compiled[compiled.findIndex((l) => l.startsWith('Stage 15 ')) + 1];
    expect(replyLine).toMatch(/^  Key figures: DPS \d+; life \d+; /);
    const record = JSON.parse(fs.readFileSync(path.join(path.dirname(planFile), 'compile-record.json'), 'utf8')) as CompileRecord;

    const events: string[] = [];
    const off = f.session.onEvent((e) => events.push(`${e.tool}:${e.phase}`));
    const revision = f.session.revision;
    const stage = await f.call('guide_run', { view: { plan: planPath, stage: '15' } });
    expect(stage.isError).toBe(false);
    expect(stage.text.split('\n').slice(0, 4)).toEqual([
      `Plan ${planPath}, stage 15: stages[14] of 15.`,
      `Key figures from compile-record.json (measure-only compile of ${record.compiledAt}), current: the plan's build is unchanged since:`,
      keyFigureLine(record.stages['15'], plan.stages[14].skills.main),
      'stages[14]:',
    ]);
    // The same line compile_plan printed for the stage.
    expect(stage.text.split('\n')[2]).toBe(replyLine);
    expect(sectionOf(stage.text, 14)).toEqual(plan.stages[14]);

    const claims = await f.call('guide_run', { view: { plan: planPath, claims: true } });
    expect(claims.isError).toBe(false);
    for (const s of plan.stages as Json[]) for (const c of s.claims) expect(claims.text.split('\n')).toContain(claimLine(c));
    expect(claims.text.split('\n').filter((l) => l.startsWith('- '))).toHaveLength(15);

    // Each view, every stage's included, is under the cut-off.
    const sizes: Record<string, number> = { claims: tokenBound(claims.text) };
    for (const s of plan.stages as Json[]) {
      const v = await f.call('guide_run', { view: { plan: planPath, stage: s.id } });
      expect(v.isError).toBe(false);
      sizes[`stage ${s.id}`] = tokenBound(v.text);
    }
    console.error(`[AC-P67] view sizes in UTF-8 bytes (at most that many tokens): ${JSON.stringify(sizes)}`);
    for (const [view, bytes] of Object.entries(sizes)) expect({ view, under: bytes <= CUT_OFF_TOKENS }).toEqual({ view, under: true });
    off();
    expect(events).toEqual([]);
    expect(f.session.revision).toBe(revision);

    // A stage the record doesn't hold has no key figures; a build edit makes the figures stale, a claim edit doesn't.
    const other = await f.call('guide_run', { view: { plan: planPath, stage: '1' } });
    expect(other.text.split('\n')[1]).toBe(
      `Key figures: none: compile-record.json (measure-only compile of ${record.compiledAt}) holds stage 15, not 1; ` +
        'a measure-only compile with stages ["1"] measures it.',
    );
    const edited = JSON.parse(JSON.stringify(plan));
    edited.stages[14].claims[0].text = 'Reworded.';
    fs.writeFileSync(planFile, JSON.stringify(edited, null, 2));
    expect((await f.call('guide_run', { view: { plan: planPath, stage: '15' } })).text.split('\n')[1]).toMatch(/, current: /);
    edited.stages[14].items.slots[0].text += '\n+1 to Strength';
    fs.writeFileSync(planFile, JSON.stringify(edited, null, 2));
    expect((await f.call('guide_run', { view: { plan: planPath, stage: '15' } })).text.split('\n')[1]).toMatch(
      /, stale: the plan's build changed since, so compile again before relying on them:$/,
    );
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
