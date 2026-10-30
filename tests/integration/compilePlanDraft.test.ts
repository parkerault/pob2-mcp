/**
 * AC-K78 (WU-129, D-466): `compile_plan`'s draft mode, `remove_draft`, `first_free` names and the write ledger's
 * version 2, through MCP in process, over a private builds, state and guides folder.
 *
 * - The draft rows (no engine): each run folder is made by `guide_run {new_run}`, and its plan, compile record and
 *   `compiled-build.xml` are written by the test, as a measure-only compile leaves them; the draft mode runs as engine
 *   kind `none` and the session never starts.
 * - The final-compile rows (engine-required): the committed two-stage plan, compiled for real; the names are read from
 *   the builds folder, the write ledger and the compile record, not from the reply alone.
 * - The name cleaning and the candidate order are unit rows over the compiler's exported helpers.
 */
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import { engineDescribe } from '../helpers/engine';
import { startSessionFixture, writeBuild, type SessionFixture } from '../helpers/engineSession';
import { engineKindFor } from '../../src/server/toolRouter';
import { WRITE_LEDGER_FILE } from '../../src/plan/writeLedger';
import { cleanBuildName, draftCandidates, firstFreeCandidates } from '../../src/plan/compiler';
import type { EngineEvent } from '../../src/engine/session';
import type { CompileRecord } from '../../src/plan/record';

const REPO = path.resolve(__dirname, '..', '..');
const TWO_STAGE = path.join(REPO, 'tests', 'fixtures', 'plans', 'two-stage', 'plan.json');
const ENGINE_TIMEOUT = 240_000;

type Json = Record<string, any>;
const sha1 = (data: Buffer | string) => crypto.createHash('sha1').update(data).digest('hex');

/** Every file under `dir`, relative path → sha1. */
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

interface Run {
  abs: string;
  /** `<slug>/<YYYY-MM-DD>-<n>`. */
  rel: string;
  date: string;
}

/** The fixture's helpers shared by both describes. */
function helpers(get: () => SessionFixture) {
  const ledgerPath = () => path.join(get().server.deps.stateDir, WRITE_LEDGER_FILE);
  const ledger = (): { ledgerVersion: number; entries: Json[] } =>
    fs.existsSync(ledgerPath()) ? JSON.parse(fs.readFileSync(ledgerPath(), 'utf8')) : { ledgerVersion: 0, entries: [] };
  const entryOf = (rel: string) => ledger().entries.find((e) => e.path === rel);
  async function newRun(slug: string): Promise<Run> {
    const out = await get().call('guide_run', { new_run: slug });
    if (out.isError) throw new Error(`guide_run failed: ${out.text}`);
    const abs = /^Created run folder (.+)$/m.exec(out.text)![1];
    const rel = path.posix.dirname(/^plan_path for this run: (\S+)$/m.exec(out.text)![1]);
    return { abs, rel, date: /(\d{4}-\d{2}-\d{2})-\d+$/.exec(rel)![1] };
  }
  const builds = (name: string) => path.join(get().builds, name);
  return { ledgerPath, ledger, entryOf, newRun, builds };
}

// ---------------------------------------------------------------------------------------------------
// The draft rows: no engine

describe('AC-K78: compile_plan draft mode and remove_draft (D-466), with a hand-written measure-only compile', () => {
  let f: SessionFixture;
  const h = helpers(() => f);
  const events: EngineEvent[] = [];

  beforeAll(async () => {
    f = await startSessionFixture({ files: {} });
    f.session.onEvent((e) => events.push(e));
  });
  afterAll(async () => {
    await f?.close();
  });

  /**
   * A build folder `<run>/builds/<id>` holding a plan of `stages`, and the record and XML a measure-only compile of
   * `compiled` (default every stage) would leave beside it. Returns the plan_path and the XML's bytes.
   */
  function measuredBuild(run: Run, id: string, opts: { stages?: string[]; compiled?: string[]; xml?: string } = {}) {
    const stages = opts.stages ?? ['m', 'b', 'n'];
    const dir = path.join(run.abs, 'builds', id);
    fs.mkdirSync(dir, { recursive: true });
    const plan = `${JSON.stringify({ schemaVersion: 8, stages: stages.map((s) => ({ id: s })) }, null, 2)}\n`;
    fs.writeFileSync(path.join(dir, 'plan.json'), plan);
    const xml = Buffer.from(opts.xml ?? `<?xml version="1.0"?><PathOfBuilding2><Build note="${id}"/></PathOfBuilding2>`);
    fs.writeFileSync(path.join(dir, 'compiled-build.xml'), xml);
    const record = {
      recordVersion: 2,
      planSha1: sha1(plan),
      mode: 'measure-only',
      stagesCompiled: opts.compiled ?? stages,
      pobFile: { location: 'run', path: `${run.rel}/builds/${id}/compiled-build.xml`, sha1: sha1(xml), bytes: xml.length },
    };
    fs.writeFileSync(path.join(dir, 'compile-record.json'), JSON.stringify(record));
    return { planPath: `${run.rel}/builds/${id}/plan.json`, xml, dir };
  }

  it('draft_name "Royal Fury: Rake" writes Royal Fury Rake (draft).xml byte-equal to compiled-build.xml, with a ledger entry of kind draft and its plan, and starts no engine', async () => {
    const run = await h.newRun('royal-fury');
    const b = measuredBuild(run, 'r2-s-1');
    expect(engineKindFor('compile_plan', { plan_path: b.planPath, draft_name: 'Royal Fury: Rake' })).toBe('none');
    expect(engineKindFor('compile_plan', { plan_path: b.planPath, remove_draft: 'x (draft).xml' })).toBe('none');
    expect(engineKindFor('compile_plan', { plan_path: b.planPath, measure_only: true })).toBe('load');
    const before = { revision: f.session.revision, events: events.length };

    const out = await f.call('compile_plan', { plan_path: b.planPath, draft_name: 'Royal Fury: Rake' });
    expect(out.isError).toBe(false);
    expect(out.text).toBe('Draft written: Royal Fury Rake (draft).xml');
    expect(fs.readFileSync(h.builds('Royal Fury Rake (draft).xml')).equals(b.xml)).toBe(true);
    expect(h.ledger().ledgerVersion).toBe(2);
    expect(h.entryOf('Royal Fury Rake (draft).xml')).toMatchObject({
      sha1: sha1(b.xml),
      runFolder: run.rel,
      kind: 'draft',
      plan: b.planPath,
    });
    // Engine kind none: no session run at all, no engine started, the build's revision untouched.
    expect(events.length).toBe(before.events);
    expect(f.session.enginePid()).toBeNull();
    expect(f.session.revision).toBe(before.revision);
  });

  it('after a plan edit with no compile, or after a compile that named stages, the draft is refused and nothing is written', async () => {
    const run = await h.newRun('refusals');
    const edited = measuredBuild(run, 'edited');
    fs.appendFileSync(path.join(edited.dir, 'plan.json'), ' ');
    const subset = measuredBuild(run, 'subset', { compiled: ['n'] });
    const before = treeOf(f.tmp);
    const a = await f.call('compile_plan', { plan_path: edited.planPath, draft_name: 'Edited' });
    expect(a.isError).toBe(true);
    expect(a.text).toContain('the plan changed since its last compile');
    const b = await f.call('compile_plan', { plan_path: subset.planPath, draft_name: 'Subset' });
    expect(b.isError).toBe(true);
    expect(b.text).toContain("the plan's last compile named stages (n of m, b, n)");
    expect(treeOf(f.tmp)).toEqual(before);
  });

  it('a second draft of the same build over its unchanged draft replaces it; over a draft changed on disk it writes (draft 2) and leaves the changed one', async () => {
    const run = await h.newRun('second-draft');
    let b = measuredBuild(run, 'r1', { xml: '<PathOfBuilding2>first</PathOfBuilding2>' });
    expect((await f.call('compile_plan', { plan_path: b.planPath, draft_name: 'Second Draft' })).text).toBe('Draft written: Second Draft (draft).xml');

    // A revise that passes again: a new compile, then the draft again, over the unchanged draft.
    b = measuredBuild(run, 'r1', { xml: '<PathOfBuilding2>revised</PathOfBuilding2>' });
    const again = await f.call('compile_plan', { plan_path: b.planPath, draft_name: 'Second Draft' });
    expect(again.isError).toBe(false);
    expect(again.text).toBe("Draft written: Second Draft (draft).xml (replaced this build's earlier draft)");
    expect(fs.readFileSync(h.builds('Second Draft (draft).xml'), 'utf8')).toBe('<PathOfBuilding2>revised</PathOfBuilding2>');
    expect(fs.existsSync(h.builds('Second Draft (draft 2).xml'))).toBe(false);

    // The user saves the draft in PoB: it is never overwritten, and the next draft goes to (draft 2).
    writeBuild(h.builds('Second Draft (draft).xml'), '<PathOfBuilding2>the user\'s edit</PathOfBuilding2>');
    b = measuredBuild(run, 'r1', { xml: '<PathOfBuilding2>third</PathOfBuilding2>' });
    const third = await f.call('compile_plan', { plan_path: b.planPath, draft_name: 'Second Draft' });
    expect(third.isError).toBe(false);
    expect(third.text.split('\n')[0]).toBe('Draft written: Second Draft (draft 2).xml');
    expect(third.text).toContain('Left Second Draft (draft).xml');
    expect(fs.readFileSync(h.builds('Second Draft (draft).xml'), 'utf8')).toBe('<PathOfBuilding2>the user\'s edit</PathOfBuilding2>');
    expect(fs.readFileSync(h.builds('Second Draft (draft 2).xml'), 'utf8')).toBe('<PathOfBuilding2>third</PathOfBuilding2>');
    expect(h.entryOf('Second Draft (draft 2).xml')).toMatchObject({ kind: 'draft', plan: b.planPath });

    // A draft another build wrote is not this build's either.
    const other = measuredBuild(run, 'r2', { xml: '<PathOfBuilding2>other build</PathOfBuilding2>' });
    const otherOut = await f.call('compile_plan', { plan_path: other.planPath, draft_name: 'Second Draft' });
    expect(otherOut.text.split('\n')[0]).toBe('Draft written: Second Draft (draft 3).xml');
    expect(fs.readFileSync(h.builds('Second Draft (draft 2).xml'), 'utf8')).toBe('<PathOfBuilding2>third</PathOfBuilding2>');
  });

  it('remove_draft on an unchanged draft of this build deletes it, leaves a _before-delete backup and drops the ledger entry', async () => {
    const run = await h.newRun('remove');
    const b = measuredBuild(run, 'r1');
    await f.call('compile_plan', { plan_path: b.planPath, draft_name: 'Removed' });
    const events0 = events.length;
    const out = await f.call('compile_plan', { plan_path: b.planPath, remove_draft: 'Removed (draft).xml' });
    expect(out.isError).toBe(false);
    const m = /^Draft removed: Removed \(draft\)\.xml \(backup (.+)\)$/.exec(out.text);
    expect(m).not.toBeNull();
    const backup = m![1];
    expect(path.dirname(backup)).toBe(path.join(f.server.deps.stateDir, 'backups', 'Removed (draft).xml'));
    expect(path.basename(backup)).toMatch(/_before-delete\.xml$/);
    expect(fs.readFileSync(backup).equals(b.xml)).toBe(true);
    expect(fs.existsSync(h.builds('Removed (draft).xml'))).toBe(false);
    expect(h.entryOf('Removed (draft).xml')).toBeUndefined();
    expect(events.length).toBe(events0);
    expect(f.session.enginePid()).toBeNull();
  });

  it('remove_draft refuses, deleting nothing, on a changed draft, a final file, a draft another build or run wrote, and a pre-M-26 (version-1) entry', async () => {
    const run = await h.newRun('remove-refused');
    const mine = measuredBuild(run, 'r1');
    const sibling = measuredBuild(run, 'r2');
    const otherRun = await h.newRun('remove-other-run');
    const foreign = measuredBuild(otherRun, 'r1');
    await f.call('compile_plan', { plan_path: mine.planPath, draft_name: 'Changed' });
    writeBuild(h.builds('Changed (draft).xml'), '<PathOfBuilding2>saved in PoB</PathOfBuilding2>');
    await f.call('compile_plan', { plan_path: sibling.planPath, draft_name: 'Sibling' });
    await f.call('compile_plan', { plan_path: foreign.planPath, draft_name: 'Foreign' });
    // A final file this build wrote, and a version-1 entry, written into the ledger as a final compile and M-25 left them.
    fs.writeFileSync(h.builds('Final.xml'), 'final');
    fs.writeFileSync(h.builds('Old (draft).xml'), 'old');
    const ledger = h.ledger();
    ledger.entries.push({ path: 'Final.xml', sha1: sha1('final'), runFolder: run.rel, writtenAt: '2026-10-30T00:00:00Z', kind: 'final', plan: mine.planPath });
    fs.writeFileSync(h.ledgerPath(), JSON.stringify(ledger));
    const before = treeOf(f.tmp);
    const refused: Array<[string, string]> = [
      ['Changed (draft).xml', 'it changed on disk since this build wrote it'],
      ['Final.xml', "it is a build's final file, not a draft"],
      ['Sibling (draft).xml', `it is a draft of another build (${sibling.planPath})`],
      ['Foreign (draft).xml', `it is a draft of another build (${foreign.planPath})`],
      ['Nobody (draft).xml', 'no compile_plan wrote it'],
    ];
    for (const [file, why] of refused) {
      const out = await f.call('compile_plan', { plan_path: mine.planPath, remove_draft: file });
      expect({ file, isError: out.isError }).toEqual({ file, isError: true });
      expect(out.text).toContain(why);
      expect(out.text).toContain('Nothing was deleted');
    }
    expect(treeOf(f.tmp)).toEqual(before);

    // A version-1 ledger: its entries read as finals with no plan, so even its own run's draft-named file is refused.
    const v1 = { ledgerVersion: 1, entries: [{ path: 'Old (draft).xml', sha1: sha1('old'), runFolder: run.rel, writtenAt: '2026-10-01T00:00:00Z' }] };
    fs.writeFileSync(h.ledgerPath(), JSON.stringify(v1));
    const old = await f.call('compile_plan', { plan_path: mine.planPath, remove_draft: 'Old (draft).xml' });
    expect(old.isError).toBe(true);
    expect(old.text).toContain("it is a build's final file, not a draft");
    expect(fs.readFileSync(h.builds('Old (draft).xml'), 'utf8')).toBe('old');
    expect(JSON.parse(fs.readFileSync(h.ledgerPath(), 'utf8'))).toEqual(v1);
  });

  it('the draft mode takes plan_path only: draft_name or remove_draft with any other argument is refused without the engine', async () => {
    for (const extra of [{ build_name: 'x' }, { measure_only: true }, { stages: ['n'] }, { first_free: true }, { remove_draft: 'x (draft).xml' }]) {
      const out = await f.call('compile_plan', { plan_path: 'a/2026-10-30-1/plan.json', draft_name: 'X', ...extra });
      expect(out.isError).toBe(true);
      expect(out.text).toContain('conflict: draft_name (write the build\'s draft) and remove_draft (delete it) each take plan_path only');
    }
    expect(f.session.enginePid()).toBeNull();
  });
});

describe('D-466: the names cleaned, and the order first_free and the draft try them in', () => {
  it('each character Windows refuses becomes a space, runs of spaces one, trailing dots and spaces go; a device name gains (build)', () => {
    expect(cleanBuildName('Royal Fury: Rake')).toBe('Royal Fury Rake');
    expect(cleanBuildName('Royal Fury: Rake?')).toBe('Royal Fury Rake');
    expect(cleanBuildName('a<b>c"d/e\\f|g?h*i')).toBe('a b c d e f g h i');
    expect(cleanBuildName('Trailing dots... ')).toBe('Trailing dots');
    expect(cleanBuildName('CON')).toBe('CON (build)');
    expect(cleanBuildName('lpt9')).toBe('lpt9 (build)');
    expect(cleanBuildName('CON Rake')).toBe('CON Rake');
    expect(cleanBuildName('Named.xml')).toBe('Named');
    expect(() => cleanBuildName('?:*')).toThrow('has nothing left once cleaned');
  });

  it("first_free tries <name>, <name> <date>, then <name> <date> <k> from 2; a campaign's name keeps (campaign) last", () => {
    expect(firstFreeCandidates('Royal Fury: Rake', '2026-10-28', 4)).toEqual([
      'Royal Fury Rake',
      'Royal Fury Rake 2026-10-28',
      'Royal Fury Rake 2026-10-28 2',
      'Royal Fury Rake 2026-10-28 3',
    ]);
    expect(firstFreeCandidates('Royal Fury Rake (campaign)', '2026-10-28', 3)).toEqual([
      'Royal Fury Rake (campaign)',
      'Royal Fury Rake 2026-10-28 (campaign)',
      'Royal Fury Rake 2026-10-28 2 (campaign)',
    ]);
    expect(draftCandidates('Royal Fury: Rake', 3)).toEqual(['Royal Fury Rake (draft)', 'Royal Fury Rake (draft 2)', 'Royal Fury Rake (draft 3)']);
  });
});

// ---------------------------------------------------------------------------------------------------
// The final-compile rows: the engine

engineDescribe('AC-K78: compile_plan first_free names and the draft of a real compile (D-466)', () => {
  let f: SessionFixture;
  const h = helpers(() => f);

  beforeAll(async () => {
    f = await startSessionFixture();
  }, ENGINE_TIMEOUT);
  afterAll(async () => {
    await f?.close();
  });

  async function planIn(run: Run, sub = ''): Promise<string> {
    const rel = sub ? `${run.rel}/${sub}/plan.json` : `${run.rel}/plan.json`;
    fs.mkdirSync(path.dirname(path.join(f.guides, rel)), { recursive: true });
    fs.copyFileSync(TWO_STAGE, path.join(f.guides, rel));
    return rel;
  }
  const recordOf = (plan: string): CompileRecord =>
    JSON.parse(fs.readFileSync(path.join(f.guides, path.posix.dirname(plan), 'compile-record.json'), 'utf8')) as CompileRecord;

  async function final(plan: string, name: string, firstFree = true) {
    return f.call('compile_plan', { plan_path: plan, build_name: name, ...(firstFree ? { first_free: true } : {}) });
  }

  it('a name another run\'s file holds goes to <name> <run date>, then <name> <run date> 2; the reply, the record and the ledger name it', async () => {
    const a = await h.newRun('first-free');
    const b = await h.newRun('first-free');
    const c = await h.newRun('first-free');
    const planA = await planIn(a);
    const planB = await planIn(b);
    const planC = await planIn(c);
    expect((await final(planA, 'Royal Fury: Rake')).isError).toBe(false);
    expect(fs.existsSync(h.builds('Royal Fury Rake.xml'))).toBe(true);
    const aBytes = fs.readFileSync(h.builds('Royal Fury Rake.xml'));

    const outB = await final(planB, 'Royal Fury: Rake');
    expect(outB.isError).toBe(false);
    expect(outB.text).toContain(`Wrote Royal Fury Rake ${b.date}.xml in the builds folder.`);
    expect(recordOf(planB).pobFile).toMatchObject({ location: 'builds', path: `Royal Fury Rake ${b.date}.xml` });
    expect(h.entryOf(`Royal Fury Rake ${b.date}.xml`)).toMatchObject({ kind: 'final', plan: planB, runFolder: b.rel });

    const outC = await final(planC, 'Royal Fury: Rake');
    expect(outC.isError).toBe(false);
    expect(recordOf(planC).pobFile.path).toBe(`Royal Fury Rake ${c.date} 2.xml`);
    expect(fs.existsSync(h.builds(`Royal Fury Rake ${c.date} 2.xml`))).toBe(true);
    // Run a's file is untouched.
    expect(fs.readFileSync(h.builds('Royal Fury Rake.xml')).equals(aBytes)).toBe(true);

    // The same build again with first_free: its own unchanged file is free, so it is overwritten, not renamed.
    const againA = await final(planA, 'Royal Fury: Rake');
    expect(againA.isError).toBe(false);
    expect(recordOf(planA).pobFile.path).toBe('Royal Fury Rake.xml');
    expect(againA.text).toContain('Wrote Royal Fury Rake.xml in the builds folder (replaced;');
  }, ENGINE_TIMEOUT);

  it('a name another build of the same run wrote goes to <name> <run date>, leaving that file', async () => {
    const run = await h.newRun('same-run');
    const one = await planIn(run, 'builds/r2-s-1');
    const two = await planIn(run, 'builds/r2-s-2');
    expect((await final(one, 'Shared Name')).isError).toBe(false);
    const bytes = fs.readFileSync(h.builds('Shared Name.xml'));
    const out = await final(two, 'Shared Name');
    expect(out.isError).toBe(false);
    expect(recordOf(two).pobFile.path).toBe(`Shared Name ${run.date}.xml`);
    expect(fs.readFileSync(h.builds('Shared Name.xml')).equals(bytes)).toBe(true);
    expect(h.entryOf('Shared Name.xml')).toMatchObject({ plan: one });
    expect(h.entryOf(`Shared Name ${run.date}.xml`)).toMatchObject({ plan: two });
  }, ENGINE_TIMEOUT);

  it('a name with : and ? is cleaned, and CON becomes CON (build)', async () => {
    const run = await h.newRun('cleaned');
    const plan = await planIn(run, 'builds/one');
    expect((await final(plan, 'Titan: Rake?')).isError).toBe(false);
    expect(recordOf(plan).pobFile.path).toBe('Titan Rake.xml');
    const con = await planIn(run, 'builds/con');
    expect((await final(con, 'CON')).isError).toBe(false);
    expect(recordOf(con).pobFile.path).toBe('CON (build).xml');
    expect(fs.existsSync(h.builds('CON (build).xml'))).toBe(true);
  }, ENGINE_TIMEOUT);

  it('a re-compile without first_free over this build\'s final file the user changed is refused (D-211); measure_only with build_name is still refused', async () => {
    const run = await h.newRun('recompile');
    const plan = await planIn(run);
    expect((await final(plan, 'Recompiled')).isError).toBe(false);
    writeBuild(h.builds('Recompiled.xml'), fs.readFileSync(h.builds('Recompiled.xml'), 'utf8').replace('<Build ', '<Build edited="1" '));
    const edited = fs.readFileSync(h.builds('Recompiled.xml'));
    const out = await final(plan, 'Recompiled', false);
    expect(out.isError).toBe(true);
    expect(out.text).toContain('Recompiled.xml changed on disk');
    expect(fs.readFileSync(h.builds('Recompiled.xml')).equals(edited)).toBe(true);
    const measured = await f.call('compile_plan', { plan_path: plan, measure_only: true, build_name: 'Recompiled' });
    expect(measured.isError).toBe(true);
    expect(measured.text).toContain('build_name and measure_only: true conflict');
  }, ENGINE_TIMEOUT);

  it('the draft of a real measure-only compile is byte-equal to its compiled-build.xml; a stages compile refuses it', async () => {
    const run = await h.newRun('real-draft');
    const plan = await planIn(run);
    expect((await f.call('compile_plan', { plan_path: plan, measure_only: true })).isError).toBe(false);
    const xml = fs.readFileSync(path.join(f.guides, run.rel, 'compiled-build.xml'));
    const out = await f.call('compile_plan', { plan_path: plan, draft_name: 'Real Draft' });
    expect(out.isError).toBe(false);
    expect(fs.readFileSync(h.builds('Real Draft (draft).xml')).equals(xml)).toBe(true);
    const stageIds = (JSON.parse(fs.readFileSync(TWO_STAGE, 'utf8')).stages as Array<{ id: string }>).map((s) => s.id);
    expect((await f.call('compile_plan', { plan_path: plan, measure_only: true, stages: [stageIds[0]] })).isError).toBe(false);
    const refused = await f.call('compile_plan', { plan_path: plan, draft_name: 'Real Draft' });
    expect(refused.isError).toBe(true);
    expect(refused.text).toContain("the plan's last compile named stages");
  }, ENGINE_TIMEOUT);
});
