/**
 * Build-file writer, state dir and `lua_save_build` (WU-22: C-16, C-17, D-18, D-60), in process and
 * engine-required: the real Client, router, handlers, session, writer, luajit and the vendor pin, over a
 * private temp builds folder and state dir.
 */
import fs from 'fs';
import os from 'os';
import path from 'path';
import { it, expect, beforeAll, afterAll } from '@jest/globals';
import { engineDescribe } from '../helpers/engine';
import { GOLDEN_XML, CALL_TIMEOUT_MS, goldenWithLevel, startSessionFixture, writeBuild, type SessionFixture, type ToolOutcome } from '../helpers/engineSession';
import { startTestServer, type TestServer } from '../helpers/server';

const T = 180000;

function walk(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? [p, ...walk(p)] : [p];
  });
}

const PATHOFBUILDING2_ROOT = /^\s*(<\?xml[^>]*\?>\s*)?<PathOfBuilding2[\s>]/;

engineDescribe('AC-E46 (WU-22, C-17): lua_save_build writes through the build-file writer', () => {
  let f: SessionFixture;
  let stateDir: string;
  beforeAll(async () => {
    f = await startSessionFixture();
    stateDir = f.server.deps.stateDir;
  }, T);
  afterAll(async () => f?.close(), 30000);

  let firstBytes: Buffer;

  it('AC-E46 (a): lua_save_build {build_name:"new1"} writes new1.xml with a <PathOfBuilding2> root; the message has the byte count', async () => {
    expect((await f.call('lua_load_build', { build_name: 'grenadator.xml' })).isError).toBe(false);
    const out = await f.call('lua_save_build', { build_name: 'new1' });
    expect(out.isError).toBe(false);
    const file = path.join(f.builds, 'new1.xml');
    firstBytes = fs.readFileSync(file);
    expect(firstBytes.toString('utf8')).toMatch(PATHOFBUILDING2_ROOT);
    expect(out.text).toContain('new1.xml');
    expect(out.text).toContain(`(${firstBytes.length} bytes)`);
  }, T);

  it('AC-E46 (b): repeating it without overwrite → isError "already exists … overwrite: true"', async () => {
    const out = await f.call('lua_save_build', { build_name: 'new1' });
    expect(out.isError).toBe(true);
    expect(out.text).toMatch(/new1\.xml already exists.*overwrite: true/);
    expect(fs.readFileSync(path.join(f.builds, 'new1.xml')).equals(firstBytes)).toBe(true);
  }, T);

  it('AC-E46 (c): with overwrite:true it succeeds, <stateDir>/backups/new1.xml/ holds the previous bytes, and the message says "re-open it there"', async () => {
    // Change the engine's build so the replaced bytes differ from the new ones.
    expect((await f.call('set_character_level', { level: 77 })).isError).toBe(false);
    const out = await f.call('lua_save_build', { build_name: 'new1', overwrite: true });
    expect(out.isError).toBe(false);
    expect(out.text).toContain('re-open it there');
    const backupDir = path.join(stateDir, 'backups', 'new1.xml');
    const backups = fs.readdirSync(backupDir);
    expect(backups).toHaveLength(1);
    expect(backups[0]).toMatch(/^\d{4}-\d\d-\d\dT\d\d-\d\d-\d\d-\d{3}Z_backup\.xml$/);
    expect(fs.readFileSync(path.join(backupDir, backups[0])).equals(firstBytes)).toBe(true);
    const now = fs.readFileSync(path.join(f.builds, 'new1.xml'), 'utf8');
    expect(now).toMatch(/<Build\b[^>]*\blevel="77"/);
  }, T);

  it('AC-E46 (d): load grenadator.xml, mutate, modify it on disk → lua_save_build {grenadator, overwrite:true} is isError "changed on disk since" and the file keeps the on-disk modification', async () => {
    const file = path.join(f.builds, 'grenadator.xml');
    expect((await f.call('lua_load_build', { build_name: 'grenadator.xml' })).isError).toBe(false);
    expect((await f.call('set_character_level', { level: 60 })).isError).toBe(false);
    const pob2Save = goldenWithLevel(95);
    writeBuild(file, pob2Save);
    const out = await f.call('lua_save_build', { build_name: 'grenadator', overwrite: true });
    expect(out.isError).toBe(true);
    expect(out.text).toContain('changed on disk since');
    expect(fs.readFileSync(file, 'utf8')).toBe(pob2Save);
    expect(fs.existsSync(path.join(stateDir, 'backups', 'grenadator.xml'))).toBe(false);
  }, T);

  it('AC-E46 (e): saving as new2 re-points loaded.path to new2.xml and isDirty() is false', async () => {
    expect(f.session.isDirty()).toBe(true);
    const out = await f.call('lua_save_build', { build_name: 'new2' });
    expect(out.isError).toBe(false);
    expect(f.session.loaded?.path).toBe('new2.xml');
    expect(f.session.loaded?.displayName).toBe('new2');
    expect(f.session.isDirty()).toBe(false);
    expect(out.text).toContain('Build: new2 (new2.xml)');
  }, T);

  it('AC-E46 (f): no *.pob2mcp-tmp file remains in the builds folder', () => {
    const all = walk(f.builds);
    expect(all.length).toBeGreaterThan(0);
    expect(all.filter((p) => p.endsWith('.pob2mcp-tmp'))).toEqual([]);
  });
});

engineDescribe('AC-E62 (WU-22, D-60): a save to the loaded path leaves the engine clean', () => {
  let f: SessionFixture;
  beforeAll(async () => {
    f = await startSessionFixture();
  }, T);
  afterAll(async () => f?.close(), 30000);

  it('AC-E62: after lua_save_build to the loaded path, isDirty() is false and the next engine call shows no disk-change warning', async () => {
    expect((await f.call('lua_load_build', { build_name: 'grenadator.xml' })).isError).toBe(false);
    expect((await f.call('set_character_level', { level: 66 })).isError).toBe(false);
    expect(f.session.isDirty()).toBe(true);

    const save = await f.call('lua_save_build', { build_name: 'grenadator', overwrite: true });
    expect(save.isError).toBe(false);
    expect(f.session.loaded?.path).toBe('grenadator.xml');
    expect(f.session.isDirty()).toBe(false);
    expect(fs.readFileSync(path.join(f.builds, 'grenadator.xml'), 'utf8')).toMatch(/<Build\b[^>]*\blevel="66"/);

    const revision = f.session.revision;
    const next = await f.call('lua_get_build_info');
    expect(next.isError).toBe(false);
    expect(next.text).not.toMatch(/Warning:|changed on disk|Reloaded /);
    expect(next.text).toContain('Level: 66');
    expect(f.session.revision).toBe(revision);
  }, T);
});

engineDescribe('AC-E55 (WU-22, D-18): server state lives in the state dir, never in the builds folder', () => {
  let tmp: string;
  let builds: string;
  let xdg: string;
  let server: TestServer;
  const call = async (tool: string, args: Record<string, unknown> = {}): Promise<ToolOutcome> => {
    const result = (await server.client.callTool({ name: tool, arguments: args }, undefined, { timeout: CALL_TIMEOUT_MS })) as {
      isError?: boolean;
      content?: Array<{ type: string; text?: string }>;
    };
    return { isError: result.isError === true, text: (result.content ?? []).map((c) => c.text ?? '').join('\n') };
  };

  beforeAll(async () => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'pob2-statedir-'));
    builds = path.join(tmp, 'builds');
    xdg = path.join(tmp, 'xdg');
    fs.mkdirSync(builds);
    fs.writeFileSync(path.join(builds, 'grenadator.xml'), GOLDEN_XML, 'utf8');
    // pobDirectory and stateDir follow the entry's defaults for this env (C-16: <XDG_STATE_HOME>/pob2-mcp).
    server = await startTestServer({ env: { POB_DIRECTORY: builds, XDG_STATE_HOME: xdg } });
    expect(server.deps.stateDir).toBe(path.join(xdg, 'pob2-mcp'));
  }, T);
  afterAll(async () => {
    if (server) await server.close();
    if (tmp) fs.rmSync(tmp, { recursive: true, force: true });
  }, 30000);

  it('AC-E55: after snapshot_build, export_build (default directory) and save_config_preset {name:"p1"}, nothing named .pob-mcp* is in POB_DIRECTORY and the artifacts are under <XDG_STATE_HOME>/pob2-mcp/{snapshots,exports,presets}/', async () => {
    expect((await call('lua_load_build', { build_name: 'grenadator.xml' })).isError).toBe(false);
    const snap = await call('snapshot_build', { build_name: 'grenadator.xml', tag: 'e55' });
    expect(snap.isError).toBe(false);
    const exp = await call('export_build', { build_name: 'grenadator.xml', output_name: 'e55-export' });
    expect(exp.isError).toBe(false);
    const preset = await call('save_config_preset', { name: 'p1' });
    expect(preset.isError).toBe(false);

    // find $POB_DIRECTORY -name '.pob-mcp*' is empty.
    expect(walk(builds).filter((p) => path.basename(p).startsWith('.pob-mcp'))).toEqual([]);

    const state = path.join(xdg, 'pob2-mcp');
    const snapshots = fs.readdirSync(path.join(state, 'snapshots', 'grenadator.xml'));
    expect(snapshots.some((n) => /_e55\.xml$/.test(n))).toBe(true);
    expect(snapshots.some((n) => /_metadata\.json$/.test(n))).toBe(true);
    expect(fs.existsSync(path.join(state, 'exports', 'e55-export.xml'))).toBe(true);
    expect(JSON.parse(fs.readFileSync(path.join(state, 'presets', 'p1.json'), 'utf8'))).toBeTruthy();

    // restore_snapshot's backup of the replaced build goes to the state dir too (C-16 backups/).
    const id = /Snapshot ID: (\S+)/.exec(snap.text)?.[1];
    expect(id).toBeTruthy();
    const restored = await call('restore_snapshot', { build_name: 'grenadator.xml', snapshot_id: id as string });
    expect(restored.isError).toBe(false);
    expect(fs.readdirSync(path.join(state, 'backups', 'grenadator.xml')).some((n) => n.endsWith('_before-restore.xml'))).toBe(true);
    expect(walk(builds).filter((p) => path.basename(p).startsWith('.pob-mcp'))).toEqual([]);
    expect(walk(builds).map((p) => path.relative(builds, p))).toEqual(['grenadator.xml']);
  }, T);
});
