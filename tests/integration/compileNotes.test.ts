/**
 * AC-K84 (WU-138, D-487): `compile_plan`'s notes mode and `set_build_notes`' ledger refresh, through MCP in process, over
 * a private builds, state and guides folder.
 *
 * - The write rows (no engine): a final compile's leftovers written by the test as the compiler leaves them (the record
 *   naming its builds-folder file, the `final-build.xml` copy beside it, the file, and its write-ledger entry), the XML
 *   being `tests/fixtures/plans/m27-wu138/readback-base.xml` (the two-stage plan's compile at the pin).
 * - The re-compile rows (engine-required): an endgame plan's final compile, then the notes write or `set_build_notes`, then
 *   a re-compile of the same file, which must not be refused.
 */
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import { engineDescribe } from '../helpers/engine';
import { startSessionFixture, writeBuild, type SessionFixture } from '../helpers/engineSession';
import { WRITE_LEDGER_FILE } from '../../src/plan/writeLedger';
import type { EngineEvent } from '../../src/engine/session';

const REPO = path.resolve(__dirname, '..', '..');
const FIXTURES = path.join(REPO, 'tests', 'fixtures', 'plans');
const BASE_XML = fs.readFileSync(path.join(FIXTURES, 'm27-wu138', 'readback-base.xml'), 'utf8');
const ENDGAME = path.join(FIXTURES, 'clear-group-granted', 'plan.json');
const ENGINE_TIMEOUT = 240_000;

type Json = Record<string, any>;
const sha1 = (data: Buffer | string) => crypto.createHash('sha1').update(data).digest('hex');

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
  rel: string;
}

function helpers(get: () => SessionFixture) {
  const ledgerPath = () => path.join(get().server.deps.stateDir, WRITE_LEDGER_FILE);
  const ledger = (): { ledgerVersion: number; entries: Json[] } =>
    fs.existsSync(ledgerPath()) ? JSON.parse(fs.readFileSync(ledgerPath(), 'utf8')) : { ledgerVersion: 2, entries: [] };
  const entryOf = (rel: string) => ledger().entries.find((e) => e.path === rel);
  async function newRun(slug: string): Promise<Run> {
    const out = await get().call('guide_run', { new_run: slug });
    if (out.isError) throw new Error(`guide_run failed: ${out.text}`);
    const abs = /^Created run folder (.+)$/m.exec(out.text)![1];
    const rel = path.posix.dirname(/^plan_path for this run: (\S+)$/m.exec(out.text)![1]);
    return { abs, rel };
  }
  const builds = (name: string) => path.join(get().builds, name);
  return { ledgerPath, ledger, entryOf, newRun, builds };
}

/** PoB's notes as the file holds them. */
const notesOf = (xml: string): string => /<Notes>([\s\S]*?)<\/Notes>/.exec(xml)![1];

describe('AC-K84: compile_plan notes_path (D-487) and set_build_notes (C-17), on a final compile the test wrote', () => {
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

  /** The final compile's leftovers: plan, record, `final-build.xml`, the builds-folder file and its ledger entry. */
  function finalBuild(run: Run, id: string, name: string, notes: string) {
    const dir = path.join(run.abs, 'builds', id);
    fs.mkdirSync(dir, { recursive: true });
    const plan = `${JSON.stringify({ schemaVersion: 9, stages: [{ id: '1' }, { id: '2' }] }, null, 2)}\n`;
    fs.writeFileSync(path.join(dir, 'plan.json'), plan);
    fs.writeFileSync(path.join(dir, 'final-build.xml'), BASE_XML);
    fs.writeFileSync(h.builds(name), BASE_XML);
    const planPath = `${run.rel}/builds/${id}/plan.json`;
    const record = {
      recordVersion: 2,
      planSha1: sha1(plan),
      mode: 'final',
      stagesCompiled: ['1', '2'],
      pobFile: { location: 'builds', path: name, sha1: sha1(BASE_XML), bytes: Buffer.byteLength(BASE_XML) },
    };
    fs.writeFileSync(path.join(dir, 'compile-record.json'), JSON.stringify(record));
    fs.writeFileSync(path.join(dir, 'notes.txt'), notes);
    const ledger = h.ledger();
    ledger.ledgerVersion = 2;
    ledger.entries.push({ path: name, sha1: sha1(BASE_XML), baseSha1: sha1(BASE_XML), runFolder: run.rel, writtenAt: '2026-11-02T10:00:00.000Z', kind: 'final', plan: planPath });
    fs.mkdirSync(path.dirname(h.ledgerPath()), { recursive: true });
    fs.writeFileSync(h.ledgerPath(), JSON.stringify(ledger));
    return { planPath, dir, notesPath: `${run.rel}/builds/${id}/notes.txt` };
  }

  const NOTES = '^xE05030Rake Titan^7 & friends <fast>\nLevel with any Warrior, then switch at 68.\n';

  it('replaces <Notes> with notes.txt\'s text, & < > escaped and ^x codes kept, updates the ledger\'s sha1 (not its baseSha1), backs the file up, and starts no engine', async () => {
    const run = await h.newRun('notes');
    const b = finalBuild(run, 'r1', 'Noted.xml', NOTES);
    const out = await f.call('compile_plan', { plan_path: b.planPath, notes_path: b.notesPath });
    expect(out.isError).toBe(false);
    expect(out.text).toBe(`Notes written: Noted.xml (${NOTES.length} characters)`);
    const written = fs.readFileSync(h.builds('Noted.xml'), 'utf8');
    expect(notesOf(written)).toBe('^xE05030Rake Titan^7 &amp; friends &lt;fast&gt;\nLevel with any Warrior, then switch at 68.\n');
    // Only the notes changed.
    expect(written.replace(/<Notes>[\s\S]*?<\/Notes>/, '')).toBe(BASE_XML.replace(/<Notes>[\s\S]*?<\/Notes>/, ''));
    expect(h.entryOf('Noted.xml')).toMatchObject({ sha1: sha1(written), baseSha1: sha1(BASE_XML), kind: 'final', plan: b.planPath });
    const backups = path.join(f.server.deps.stateDir, 'backups', 'Noted.xml');
    expect(fs.readdirSync(backups).map((n) => fs.readFileSync(path.join(backups, n), 'utf8'))).toContain(BASE_XML);
    expect(events).toEqual([]);
    expect(f.session.enginePid()).toBeNull();
  });

  it('a second notes write over the first is taken: the ledger and the writer both know the first one\'s bytes', async () => {
    const run = await h.newRun('notes-twice');
    const b = finalBuild(run, 'r1', 'Twice Noted.xml', NOTES);
    expect((await f.call('compile_plan', { plan_path: b.planPath, notes_path: b.notesPath })).isError).toBe(false);
    fs.writeFileSync(path.join(b.dir, 'notes.txt'), 'The second cycle\'s notes.');
    const out = await f.call('compile_plan', { plan_path: b.planPath, notes_path: b.notesPath });
    expect(out.isError).toBe(false);
    expect(notesOf(fs.readFileSync(h.builds('Twice Noted.xml'), 'utf8'))).toBe("The second cycle's notes.");
  });

  it('on a final file changed on disk since the ledger\'s write it refuses and writes nothing', async () => {
    const run = await h.newRun('notes-changed');
    const b = finalBuild(run, 'r1', 'Changed Noted.xml', NOTES);
    writeBuild(h.builds('Changed Noted.xml'), BASE_XML.replace('+12 to maximum Life', '+14 to maximum Life'));
    const before = treeOf(f.tmp);
    const out = await f.call('compile_plan', { plan_path: b.planPath, notes_path: b.notesPath });
    expect(out.isError).toBe(true);
    expect(out.text).toContain('no notes were written to Changed Noted.xml: it changed on disk since the server wrote it');
    expect(out.text).toContain('Nothing was written');
    expect(treeOf(f.tmp)).toEqual(before);
  });

  it('a read-back of the final file after a notes write still succeeds, with no changes: its baseSha1 is unchanged and notes are never compared', async () => {
    const run = await h.newRun('notes-readback');
    const b = finalBuild(run, 'r1', 'Read Noted.xml', NOTES);
    expect((await f.call('compile_plan', { plan_path: b.planPath, notes_path: b.notesPath })).isError).toBe(false);
    const out = await f.call('compile_plan', { plan_path: b.planPath, read_back: 'Read Noted.xml' });
    expect(out.isError).toBe(false);
    expect(out.text).toBe('Read back: Read Noted.xml: no changes');
    expect(JSON.parse(fs.readFileSync(path.join(b.dir, 'readback.json'), 'utf8'))).toMatchObject({ base: 'final-build.xml', baseSha1: sha1(BASE_XML) });
  });

  it("refuses, writing nothing, when the plan's last compile wasn't final or notes_path names no file", async () => {
    const run = await h.newRun('notes-refused');
    const b = finalBuild(run, 'r1', 'Refused Noted.xml', NOTES);
    const before = treeOf(f.tmp);
    const missing = await f.call('compile_plan', { plan_path: b.planPath, notes_path: `${run.rel}/builds/r1/none.txt` });
    expect(missing.isError).toBe(true);
    expect(missing.text).toContain('names no file in the guides root');
    const record = JSON.parse(fs.readFileSync(path.join(b.dir, 'compile-record.json'), 'utf8'));
    fs.writeFileSync(path.join(b.dir, 'compile-record.json'), JSON.stringify({ ...record, mode: 'measure-only', pobFile: { ...record.pobFile, location: 'run' } }));
    const measured = await f.call('compile_plan', { plan_path: b.planPath, notes_path: b.notesPath });
    expect(measured.isError).toBe(true);
    expect(measured.text).toContain("the plan's last compile wasn't a final compile");
    expect(fs.readFileSync(h.builds('Refused Noted.xml'), 'utf8')).toBe(BASE_XML);
    expect(h.ledger().entries.find((e) => e.path === 'Refused Noted.xml')).toMatchObject({ sha1: sha1(BASE_XML) });
    expect(Object.keys(treeOf(f.tmp)).filter((k) => !before[k])).toEqual([]);
  });

  it('set_build_notes on a ledgered file refreshes its entry (sha1 the bytes written, baseSha1 kept); a file changed before the notes keeps its entry', async () => {
    const run = await h.newRun('set-notes');
    finalBuild(run, 'r1', 'Set Noted.xml', NOTES);
    const out = await f.call('set_build_notes', { build_name: 'Set Noted.xml', notes: 'set by hand' });
    expect(out.isError).toBe(false);
    const written = fs.readFileSync(h.builds('Set Noted.xml'), 'utf8');
    expect(notesOf(written)).toBe('set by hand');
    expect(h.entryOf('Set Noted.xml')).toMatchObject({ sha1: sha1(written), baseSha1: sha1(BASE_XML) });

    // The user changed the file in PoB first: the notes are written (C-17's own rules), the ledger entry is left.
    const run2 = await h.newRun('set-notes-changed');
    finalBuild(run2, 'r1', 'Set Changed.xml', NOTES);
    fs.writeFileSync(h.builds('Set Changed.xml'), BASE_XML.replace('+12 to maximum Life', '+14 to maximum Life'));
    expect((await f.call('set_build_notes', { build_name: 'Set Changed.xml', notes: 'over a change' })).isError).toBe(false);
    expect(h.entryOf('Set Changed.xml')).toMatchObject({ sha1: sha1(BASE_XML) });
  });
});

// ---------------------------------------------------------------------------------------------------
// The re-compile rows: the engine

engineDescribe('AC-K84: a re-compile after the notes write or set_build_notes is not refused (engine)', () => {
  let f: SessionFixture;
  const h = helpers(() => f);

  beforeAll(async () => {
    f = await startSessionFixture({ files: {} });
  }, ENGINE_TIMEOUT);
  afterAll(async () => {
    await f?.close();
  });

  it("re-compiles the build's final file after a notes write, and again after set_build_notes", async () => {
    const run = await h.newRun('recompile-notes');
    const plan = `${run.rel}/builds/r1/plan.json`;
    fs.mkdirSync(path.join(run.abs, 'builds', 'r1'), { recursive: true });
    fs.copyFileSync(ENDGAME, path.join(f.guides, plan));
    fs.writeFileSync(path.join(run.abs, 'builds', 'r1', 'notes.txt'), 'How it plays.');
    expect((await f.call('compile_plan', { plan_path: plan, build_name: 'Recompiled Notes', first_free: true })).isError).toBe(false);

    const notes = await f.call('compile_plan', { plan_path: plan, notes_path: `${run.rel}/builds/r1/notes.txt` });
    expect(notes.text).toBe('Notes written: Recompiled Notes.xml (13 characters)');
    expect(notesOf(fs.readFileSync(h.builds('Recompiled Notes.xml'), 'utf8'))).toBe('How it plays.');
    const again = await f.call('compile_plan', { plan_path: plan, build_name: 'Recompiled Notes' });
    expect({ isError: again.isError, text: again.isError ? again.text : '' }).toEqual({ isError: false, text: '' });
    expect(again.text).toContain('Wrote Recompiled Notes.xml in the builds folder (replaced;');

    expect((await f.call('set_build_notes', { build_name: 'Recompiled Notes.xml', notes: 'by hand' })).isError).toBe(false);
    const third = await f.call('compile_plan', { plan_path: plan, build_name: 'Recompiled Notes' });
    expect({ isError: third.isError, text: third.isError ? third.text : '' }).toEqual({ isError: false, text: '' });
    const final = fs.readFileSync(h.builds('Recompiled Notes.xml'));
    expect(h.entryOf('Recompiled Notes.xml')).toMatchObject({ sha1: sha1(final), baseSha1: sha1(final) });
  }, ENGINE_TIMEOUT);
});
