/**
 * WU-93 (amendment 9 §9, D-415; AC-P74's `resume` bullet): `guide_run {resume: <run folder>}`, in process.
 *
 * A resume goes on with an earlier run in a later session: the skill's `/build-guide --resume <run folder>`. The tool
 * takes the folder absolute or relative to the guides root, resolves and confines it as `new_run`'s and the plans'
 * paths are (C-34), checks it is a run folder (`<slug>/<YYYY-MM-DD>-<n>`) holding a `run-log.json`, and replies in
 * three lines, as `new_run` does:
 *
 * ```
 * Resuming run folder <absolute path>
 * runFolderRel: <slug>/<YYYY-MM-DD>-<n>
 * loadedBuildUnsaved: true | false
 * ```
 *
 * with `new_run`'s fourth line naming the loaded build when it has unsaved changes (D-210). It writes nothing and never
 * touches the engine: the router runs it as kind `none`, beside `new_run` (D-216). A folder with no run log, or a path
 * outside the guides root, is refused, and nothing changes.
 *
 * The unsaved case needs a loaded build, so it is engine-required (`engineDescribe`); every folder is a private temp dir.
 */
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import { engineDescribe } from '../helpers/engine';
import { canonicalExport, startSessionFixture, type SessionFixture } from '../helpers/engineSession';
import { localDateStamp } from '../../src/utils/guidesPath';

const ENGINE_TIMEOUT = 240_000;
const sha1 = (data: Buffer) => crypto.createHash('sha1').update(data).digest('hex');

/** Every file and folder under `dir`: relative path → sha1, "dir", or the link's target. */
function treeOf(dir: string): Record<string, string> {
  const out: Record<string, string> = {};
  const walk = (d: string) => {
    if (!fs.existsSync(d)) return;
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      const rel = path.relative(dir, p).split(path.sep).join('/');
      if (e.isSymbolicLink()) out[rel] = `link:${fs.readlinkSync(p)}`;
      else if (e.isDirectory()) {
        out[rel] = 'dir';
        walk(p);
      } else if (e.isFile()) out[rel] = sha1(fs.readFileSync(p));
    }
  };
  walk(dir);
  return out;
}

/** A run folder made by `new_run`, with a run log in it as the skill's `run-log.mjs init` leaves one. */
async function startedRun(f: SessionFixture, slug: string, withLog = true): Promise<{ abs: string; rel: string }> {
  const made = await f.call('guide_run', { new_run: slug });
  if (made.isError) throw new Error(`new_run failed: ${made.text}`);
  const abs = /^Created run folder (.+)$/m.exec(made.text)![1];
  const rel = /^plan_path for this run: (\S+)\/plan\.json$/m.exec(made.text)![1];
  if (withLog) fs.writeFileSync(path.join(abs, 'run-log.json'), `${JSON.stringify({ schema: 3, status: 'stopped' })}\n`);
  return { abs, rel };
}

describe('D-415: guide_run {resume} without the engine', () => {
  let f: SessionFixture;
  let events: string[];
  let off: () => void;
  let run: { abs: string; rel: string };

  beforeAll(async () => {
    f = await startSessionFixture();
    events = [];
    off = f.session.onEvent((e) => events.push(`${e.tool}:${e.phase}`));
    run = await startedRun(f, 'open-clear');
  });

  afterAll(async () => {
    off?.();
    // No resume entered the session or started the engine.
    expect(events).toEqual([]);
    expect(f.session.enginePid()).toBeNull();
    await f?.close();
  }, 60_000);

  it('AC-P74: resume returns its three lines for a run folder holding a run log, relative or absolute, with no engine running, and writes nothing', async () => {
    const today = localDateStamp(new Date());
    expect(run.rel).toBe(`open-clear/${today}-1`);
    const lines = [`Resuming run folder ${run.abs}`, `runFolderRel: ${run.rel}`, 'loadedBuildUnsaved: false'];
    const before = treeOf(f.tmp);
    for (const given of [run.rel, `${run.rel}/`, run.abs, path.join(f.guides, 'open-clear', '.', `${today}-1`)]) {
      const out = await f.call('guide_run', { resume: given });
      expect({ given, isError: out.isError, text: out.text }).toEqual({ given, isError: false, text: lines.join('\n') });
    }
    expect(path.isAbsolute(run.abs)).toBe(true);
    expect(treeOf(f.tmp)).toEqual(before);
    expect(f.session.enginePid()).toBeNull();
  });

  it('AC-P74: resume refuses a folder with no run log, and anything that is no run folder inside the guides root, changing nothing', async () => {
    const bare = await startedRun(f, 'no-log', false);
    const dirLog = await startedRun(f, 'dir-log', false);
    fs.mkdirSync(path.join(dirLog.abs, 'run-log.json'));
    // A run folder that is a link out of the guides root, holding a run log there.
    const outside = path.join(f.tmp, 'outside', '2026-10-19-1');
    fs.mkdirSync(outside, { recursive: true });
    fs.writeFileSync(path.join(outside, 'run-log.json'), '{}\n');
    fs.mkdirSync(path.join(f.guides, 'linked'), { recursive: true });
    fs.symlinkSync(outside, path.join(f.guides, 'linked', '2026-10-19-1'));
    // A run log that is a link out of the guides root.
    const linkedLog = await startedRun(f, 'linked-log', false);
    fs.symlinkSync(path.join(outside, 'run-log.json'), path.join(linkedLog.abs, 'run-log.json'));
    const cases: [unknown, RegExp][] = [
      [bare.rel, new RegExp(`resume "${bare.rel}" names ${bare.rel}, which holds no run-log\\.json: only a run the build-guide skill started can be resumed`)],
      [bare.abs, /which holds no run-log\.json/],
      [dirLog.rel, /which holds no run-log\.json/],
      ['open-clear/2001-01-01-1', /names no folder in the guides root \(open-clear\/2001-01-01-1\)/],
      ['open-clear', /is open-clear in the guides root, not a run folder: a run folder is <slug>\/<YYYY-MM-DD>-<n>/],
      [`${run.rel}/builds`, /not a run folder: a run folder is <slug>\/<YYYY-MM-DD>-<n>/],
      [f.guides, /is the guides root itself, not a run folder/],
      ['.', /is the guides root itself, not a run folder/],
      [`../${path.basename(f.tmp)}/outside/2026-10-19-1`, /has a "\.\." segment: it must stay inside the guides root/],
      [outside, /resolves to \S*outside\/2026-10-19-1, outside the guides root's real path/],
      ['linked/2026-10-19-1', /outside the guides root's real path/],
      [linkedLog.rel, /outside the guides root's real path/],
      ['C:\\Users\\me\\Guides\\open-clear\\2026-10-19-1', /is a Windows path/],
      ['', /resume must be a non-empty string/],
      [{ folder: run.rel }, /resume must be a non-empty string/],
    ];
    const before = treeOf(f.tmp);
    for (const [given, re] of cases) {
      const out = await f.call('guide_run', { resume: given });
      expect({ given, isError: out.isError, matches: re.test(out.text) || out.text }).toEqual({ given, isError: true, matches: true });
    }
    for (const [args, re] of [
      [{ resume: run.rel, new_run: 'x' }, /new_run and resume conflict/],
      [{ resume: run.rel, stages: ['1'] }, /stages goes only with validate, not with resume/],
    ] as [Record<string, unknown>, RegExp][]) {
      const out = await f.call('guide_run', args);
      expect({ args, isError: out.isError, matches: re.test(out.text) || out.text }).toEqual({ args, isError: true, matches: true });
    }
    expect(treeOf(f.tmp)).toEqual(before);
  });
});

engineDescribe('D-415, D-210: guide_run {resume} with unsaved changes', () => {
  let f: SessionFixture;

  beforeAll(async () => {
    f = await startSessionFixture();
  }, ENGINE_TIMEOUT);

  afterAll(async () => f?.close(), 60_000);

  it("resume says loadedBuildUnsaved: true and names the loaded build, as new_run does, changing nothing in the engine", async () => {
    const run = await startedRun(f, 'open-clear');
    expect((await f.call('lua_load_build', { build_name: 'grenadator' })).isError).toBe(false);
    expect((await f.call('set_character_level', { level: 77 })).isError).toBe(false);
    const before = { export: await canonicalExport(f.session), revision: f.session.revision, files: treeOf(f.guides) };
    const events: string[] = [];
    const off = f.session.onEvent((e) => events.push(`${e.tool}:${e.phase}`));
    const out = await f.call('guide_run', { resume: run.rel });
    off();
    expect(out.isError).toBe(false);
    expect(out.text.split('\n')).toEqual([
      `Resuming run folder ${run.abs}`,
      `runFolderRel: ${run.rel}`,
      'loadedBuildUnsaved: true',
      expect.stringMatching(/^The engine's loaded build "grenadator" has unsaved changes\. The next compile_plan replaces it, so save it first/),
    ]);
    expect(events).toEqual([]);
    expect(f.session.revision).toBe(before.revision);
    expect(await canonicalExport(f.session)).toBe(before.export);
    expect(treeOf(f.guides)).toEqual(before.files);
  }, ENGINE_TIMEOUT);
});
