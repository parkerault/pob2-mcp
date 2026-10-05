/**
 * WU-13, in process (real Client, router, handlers; no engine: every tool here is `engine: 'none'`):
 * - AC-E53: `list_builds` lists a subfolder build by its relative path;
 * - AC-E64 (D-58): `get_build_notes` sees notes rewritten on disk within the old 60 s window;
 * - AC-E54 (C-20): the watch tools' listed descriptions don't claim to reload the engine.
 */
import fs from 'fs';
import os from 'os';
import path from 'path';
import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { startTestServer, type TestServer } from '../helpers/server';
import { GOLDEN_XML, writeBuild } from '../helpers/engineSession';

interface Result {
  isError?: boolean;
  content?: Array<{ type: string; text?: string }>;
}
const textOf = (r: Result) => (r.content ?? []).map((c) => c.text ?? '').join('\n');

/** The golden XML with its notes replaced (a stand-in for a PoB2 save that edits the notes). */
function goldenWithNotes(notes: string): string {
  const out = GOLDEN_XML.replace(/<Notes>[\s\S]*?<\/Notes>/, `<Notes>${notes}</Notes>`);
  if (out === GOLDEN_XML) throw new Error('golden <Notes> not found');
  return out;
}

describe('WU-13 file tools, in process', () => {
  let tmp: string;
  let builds: string;
  let server: TestServer;
  let spawns = 0;

  beforeAll(async () => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'pob2-files-'));
    builds = path.join(tmp, 'builds');
    fs.mkdirSync(path.join(builds, 'sub'), { recursive: true });
    fs.mkdirSync(path.join(builds, '.hidden'), { recursive: true });
    fs.writeFileSync(path.join(builds, 'grenadator.xml'), GOLDEN_XML, 'utf8');
    fs.writeFileSync(path.join(builds, 'sub', 'inner.xml'), GOLDEN_XML, 'utf8');
    fs.writeFileSync(path.join(builds, '.hidden', 'skipped.xml'), GOLDEN_XML, 'utf8');
    fs.writeFileSync(path.join(builds, '~~temp~~.xml'), GOLDEN_XML, 'utf8');
    server = await startTestServer({
      pobDirectory: builds,
      stateDir: path.join(tmp, 'state'),
      env: { POB_DIRECTORY: builds, XDG_STATE_HOME: path.join(tmp, 'xdg') },
      // These tools never touch the engine: a spawn would be a bug.
      spawn: (() => {
        spawns += 1;
        throw new Error('no engine in this test');
      }) as never,
    });
  });

  afterAll(async () => {
    await server?.close();
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  const call = (name: string, args: Record<string, unknown> = {}) =>
    server.client.callTool({ name, arguments: args }) as Promise<Result>;

  it('AC-E53: list_builds lists sub/inner.xml from a subfolder (and skips dot folders and ~~temp~~)', async () => {
    const r = await call('list_builds');
    expect(r.isError).not.toBe(true);
    const text = textOf(r);
    expect(text).toMatch(/^\d+\. sub\/inner\.xml$/m);
    expect(text).toMatch(/^\d+\. grenadator\.xml$/m);
    expect(text).not.toContain('skipped.xml');
    expect(text).not.toContain('~~temp~~');
    // The listed name works with the other build tools.
    const stats = await call('get_build_stats', { build_name: 'sub/inner.xml' });
    expect(stats.isError).not.toBe(true);
    expect(spawns).toBe(0);
  });

  it('AC-E64: get_build_notes, then the notes rewritten on disk, then get_build_notes within 60 s shows the new notes', async () => {
    const file = path.join(builds, 'grenadator.xml');
    writeBuild(file, goldenWithNotes('first notes'));
    const first = await call('get_build_notes', { build_name: 'grenadator.xml' });
    expect(first.isError).not.toBe(true);
    expect(textOf(first)).toContain('first notes');

    const t0 = Date.now();
    writeBuild(file, goldenWithNotes('second notes, written by PoB2'));
    const second = await call('get_build_notes', { build_name: 'grenadator.xml' });
    expect(Date.now() - t0).toBeLessThan(60000);
    expect(second.isError).not.toBe(true);
    expect(textOf(second)).toContain('second notes, written by PoB2');
    expect(textOf(second)).not.toContain('first notes');
    expect(spawns).toBe(0);
  });

  it('AC-E64: a build named without .xml reads the same file under the canonical key, and sees the next change', async () => {
    const a = await call('get_build_notes', { build_name: 'grenadator' });
    expect(textOf(a)).toContain('second notes, written by PoB2');
    writeBuild(path.join(builds, 'grenadator.xml'), goldenWithNotes('third notes'));
    const b = await call('get_build_notes', { build_name: 'grenadator.xml' });
    expect(textOf(b)).toContain('third notes');
  });

  it("AC-E54: the watch tools' listed descriptions don't claim they reload the engine, and say the next engine call does", async () => {
    const { tools } = await server.client.listTools();
    const watchTools = ['start_watching', 'stop_watching', 'get_recent_changes', 'watch_status'];
    for (const name of watchTools) {
      const description = tools.find((t) => t.name === name)?.description ?? '';
      expect(description).not.toBe('');
      expect(description).not.toMatch(/auto-?reload|automatically reload|will (now )?be (automatically )?reloaded|reloads? (the )?builds? when/i);
    }
    const start = tools.find((t) => t.name === 'start_watching')?.description ?? '';
    expect(start).toMatch(/does not reload the engine/i);
    expect(start).toMatch(/next engine call/i);
    expect(start).toMatch(/whether or not watching is on/i);

    // The tool texts say the same.
    const started = await call('start_watching');
    expect(textOf(started)).not.toMatch(/automatically reloaded/i);
    expect(textOf(started)).toMatch(/does not reload the engine/i);
    expect(textOf(await call('watch_status'))).not.toMatch(/automatic build reloading/i);
    await call('stop_watching');
  });
});
