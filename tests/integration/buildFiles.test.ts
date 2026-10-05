/**
 * WU-13: build files, snapshots, import/export, in process and engine-required (spine §12): the real
 * Client, router, handlers, session, build-file writer and engine, over a private temp builds folder
 * and state dir (`startSessionFixture`). No HTTP is sent by any of these tools.
 *
 * - AC-E48 (I-1d): `export_build` without notes is a byte copy; with notes the engine writes a
 *   `<PathOfBuilding2>` copy through `withTemporaryBuild`; the engine state is unchanged either way.
 * - AC-E49 (D-42): `output_directory` outside the builds folder and the state dir is refused.
 * - AC-E50 (C-16/C-17): snapshot → list → restore, artifacts in the state dir, and the next engine
 *   call reloads a restored loaded file.
 * - AC-E51 (D-9): `analyze_build`/`compare_builds` on another file leave the engine state unchanged.
 * - AC-E52: `import_build` accepts only `<PathOfBuilding2>` and caps inflation at 16 MiB.
 * - AC-E63 (C-17 step 6): byte/text writes to the loaded file leave `loaded.fingerprint` alone.
 * - AC-E64 (D-58, engine part): `get_build_stats` after `lua_save_build` reflects the saved file.
 */
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
import { describe, it, expect, beforeAll, afterAll, jest } from '@jest/globals';
import { engineDescribe } from '../helpers/engine';
import {
  CALL_TIMEOUT_MS,
  GOLDEN_XML,
  canonicalize,
  engineLevel,
  goldenWithLevel,
  startSessionFixture,
  writeBuild,
  type SessionFixture,
} from '../helpers/engineSession';
import { canonicalizeAcrossReload } from '../helpers/reloadCanonical';
import { fixtureFetch } from '../helpers/fixtureFetch';

const T = CALL_TIMEOUT_MS + 60000;

const sha1 = (bytes: Buffer | string) => crypto.createHash('sha1').update(bytes).digest('hex');

/** The `(stat, value)` pairs of every `<PlayerStat>`, as sorted `stat=value` strings. */
function playerStatPairs(xml: string): string[] {
  const pairs: string[] = [];
  for (const m of xml.matchAll(/<PlayerStat\b[^>]*>/g)) {
    const stat = /\sstat="([^"]*)"/.exec(m[0])?.[1];
    const value = /\svalue="([^"]*)"/.exec(m[0])?.[1];
    pairs.push(`${stat}=${value}`);
  }
  return pairs.sort();
}

function rootOf(xml: string): string | undefined {
  return /^\s*(?:<\?xml[^>]*\?>\s*)?<([A-Za-z_][\w.:-]*)/.exec(xml)?.[1];
}

function notesOf(xml: string): string | undefined {
  return /<Notes\s*>([\s\S]*?)<\/Notes\s*>/.exec(xml)?.[1];
}

/** A PoB export code (base64url of zlib-deflated bytes). */
function code(bytes: Buffer | string): string {
  return zlib.deflateSync(typeof bytes === 'string' ? Buffer.from(bytes, 'utf8') : bytes)
    .toString('base64').replace(/\+/g, '-').replace(/\//g, '_');
}

interface EngineState {
  /** `export_build_xml` as exported. */
  xml: string;
  loaded: unknown;
  revision: number;
}

async function exportXml(f: SessionFixture): Promise<string> {
  const { value } = await f.session.run({ tool: 'test:export', kind: 'read' }, (ctx) => ctx.client.exportBuildXml());
  return value;
}

async function engineState(f: SessionFixture): Promise<EngineState> {
  return { xml: await exportXml(f), loaded: structuredClone(f.session.loaded), revision: f.session.revision };
}

/**
 * `revision`, `loaded` and the canonical export are unchanged. Without a reload in between the strict
 * AC-E16 canonical export must be identical; `acrossReload` (a tool that ran `withTemporaryBuild`, D-9)
 * compares it modulo PoB's `pairs()` serialization order (`tests/helpers/reloadCanonical.ts`).
 */
async function expectUnchanged(f: SessionFixture, before: EngineState, opts: { acrossReload?: boolean } = {}): Promise<void> {
  expect(f.session.revision).toBe(before.revision);
  expect(f.session.loaded).toEqual(before.loaded);
  const canon = opts.acrossReload ? canonicalizeAcrossReload : canonicalize;
  expect(canon(await exportXml(f))).toBe(canon(before.xml));
}

function filesUnder(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...filesUnder(full));
    else out.push(full);
  }
  return out;
}

describe('canonicalizeAcrossReload (the canonical export compared across a withTemporaryBuild reload)', () => {
  interface Doc {
    nodes?: string;
    mastery?: string;
    sockets?: string[];
    weaponSets?: string[];
    placeholders?: string[];
    gems?: string[];
    level?: number;
  }
  const gemsAB = ['<Gem nameSpec="A"/>', '<Gem nameSpec="B"/>'];
  const doc = ({
    nodes = '1,2,3',
    mastery = '{10,1},{20,2}',
    sockets = ['<Socket nodeId="2491" itemId="2"/>', '<Socket nodeId="54127" itemId="1"/>'],
    weaponSets = ['<WeaponSet1 nodes="4,5"/>', '<WeaponSet2 nodes="6"/>'],
    placeholders = ['<Placeholder name="x" number="1"/>', '<Placeholder name="y" number="2"/>'],
    gems = gemsAB,
    level = 90,
  }: Doc = {}) =>
    `<PathOfBuilding2>\n<Build level="${level}">\n<PlayerStat stat="Life" value="${level}"/>\n</Build>\n` +
    `<Tree><Spec treeVersion="0_5" masteryEffects="${mastery}" nodes="${nodes}"><URL>\nhttps://x/${nodes}\n</URL>\n` +
    `${weaponSets.join('\n')}\n<Sockets>\n${sockets.join('\n')}\n</Sockets>\n` +
    `<Overrides><AttributeOverride strNodes="7,8" dexNodes="9"/></Overrides></Spec></Tree>\n` +
    `<Skills><Skill>${gems.join('\n')}</Skill></Skills>\n` +
    `<Config><ConfigSet id="1">\n<Input name="a" boolean="true"/>\n${placeholders.join('\n')}\n</ConfigSet></Config>\n</PathOfBuilding2>`;

  const reordered = doc({
    nodes: '3,1,2',
    mastery: '{20,2},{10,1}',
    sockets: ['<Socket itemId="1" nodeId="54127"/>', '<Socket nodeId="2491" itemId="2"/>'],
    weaponSets: ['<WeaponSet2 nodes="6"/>', '<WeaponSet1 nodes="5,4"/>'],
    placeholders: ['<Placeholder number="2" name="y"/>', '<Placeholder name="x" number="1"/>'],
  }).replace('strNodes="7,8" dexNodes="9"', 'dexNodes="9" strNodes="8,7"');

  it('ignores what the pinned PoB2 writes in pairs() order: node-id sets, masteryEffects, the tree URL, Socket/WeaponSet/Input/Placeholder order, attribute order', () => {
    expect(canonicalizeAcrossReload(reordered)).toBe(canonicalizeAcrossReload(doc()));
  });

  it('the strict AC-E16 canonical export (engineSession canonicalize) does not ignore that order', () => {
    expect(canonicalize(reordered)).not.toBe(canonicalize(doc()));
    // ...but it does drop the PlayerStat elements (AC-E16 step 1).
    expect(canonicalize(doc({ level: 90 }))).not.toContain('PlayerStat');
  });

  it('still sees real changes: a value, a node, a mastery, a jewel, the order of gems', () => {
    const base = canonicalizeAcrossReload(doc());
    expect(canonicalizeAcrossReload(doc({ placeholders: ['<Placeholder name="x" number="5"/>', '<Placeholder name="y" number="2"/>'] }))).not.toBe(base);
    expect(canonicalizeAcrossReload(doc({ nodes: '1,2,4' }))).not.toBe(base);
    expect(canonicalizeAcrossReload(doc({ mastery: '{10,1},{20,3}' }))).not.toBe(base);
    expect(canonicalizeAcrossReload(doc({ sockets: ['<Socket nodeId="2491" itemId="3"/>', '<Socket nodeId="54127" itemId="1"/>'] }))).not.toBe(base);
    expect(canonicalizeAcrossReload(doc({ weaponSets: ['<WeaponSet1 nodes="4"/>', '<WeaponSet2 nodes="6"/>'] }))).not.toBe(base);
    expect(canonicalizeAcrossReload(doc({ gems: [...gemsAB].reverse() }))).not.toBe(base);
    expect(canonicalizeAcrossReload(doc({ level: 80 }))).not.toBe(base);
  });
});

engineDescribe('AC-E48 (WU-13, I-1d): export_build is a byte copy, or an engine-written PoE2 copy with notes', () => {
  let f: SessionFixture;
  let stateDir: string;
  beforeAll(async () => {
    f = await startSessionFixture();
    stateDir = path.join(f.tmp, 'state');
    expect((await f.call('lua_load_build', { build_name: 'grenadator.xml' })).isError).toBe(false);
  }, T);
  afterAll(async () => f?.close(), 30000);

  it('AC-E48: without notes, <stateDir>/exports/e1.xml has the source sha1, and revision, loaded and the canonical export are unchanged', async () => {
    const before = await engineState(f);
    const out = await f.call('export_build', { build_name: 'grenadator.xml', output_name: 'e1' });
    expect(out.isError).toBe(false);
    const exported = path.join(stateDir, 'exports', 'e1.xml');
    expect(fs.existsSync(exported)).toBe(true);
    expect(sha1(fs.readFileSync(exported))).toBe(sha1(fs.readFileSync(path.join(f.builds, 'grenadator.xml'))));
    await expectUnchanged(f, before);
  }, T);

  it('AC-E48: with notes "x", the output root is <PathOfBuilding2>, its notes are x, it loads as the same class, level and 109 PlayerStat values, and the engine state is unchanged', async () => {
    const before = await engineState(f);
    const out = await f.call('export_build', { build_name: 'grenadator.xml', output_name: 'e2', notes: 'x' });
    expect(out.isError).toBe(false);
    const xml = fs.readFileSync(path.join(stateDir, 'exports', 'e2.xml'), 'utf8');
    expect(rootOf(xml)).toBe('PathOfBuilding2');
    expect(notesOf(xml)?.trim()).toBe('x');
    await expectUnchanged(f, before, { acrossReload: true });

    // The copy's saved stats are the golden build's 109 pairs.
    const golden = playerStatPairs(GOLDEN_XML);
    expect(golden).toHaveLength(109);
    expect(playerStatPairs(xml)).toEqual(golden);

    // Loading it yields the same class and level, and the engine computes the same 109 values.
    fs.writeFileSync(path.join(f.builds, 'e2.xml'), xml, 'utf8');
    expect((await f.call('lua_load_build', { build_name: 'e2.xml' })).isError).toBe(false);
    const info = await f.call('lua_get_build_info');
    expect(info.text).toContain('Class: Mercenary');
    expect(info.text).toContain('Level: 90');
    expect((await f.call('lua_save_build', { build_name: 'e2-resaved' })).isError).toBe(false);
    expect(playerStatPairs(fs.readFileSync(path.join(f.builds, 'e2-resaved.xml'), 'utf8'))).toEqual(golden);
  }, T);
});

engineDescribe('AC-E49 (WU-13, D-42): export_build output_directory is confined', () => {
  let f: SessionFixture;
  beforeAll(async () => {
    f = await startSessionFixture();
  }, T);
  afterAll(async () => f?.close(), 30000);

  it('AC-E49: output_directory "/tmp/elsewhere" is isError and writes nothing there', async () => {
    const out = await f.call('export_build', { build_name: 'grenadator.xml', output_name: 'e3', output_directory: '/tmp/elsewhere' });
    expect(out.isError).toBe(true);
    expect(out.text).toContain('outside the builds folder');
    expect(fs.existsSync('/tmp/elsewhere/e3.xml')).toBe(false);
  }, T);

  it('AC-E49: an output_directory inside POB_DIRECTORY succeeds (absolute, and relative to the builds folder)', async () => {
    const inside = path.join(f.builds, 'exported');
    const abs = await f.call('export_build', { build_name: 'grenadator.xml', output_name: 'e4', output_directory: inside });
    expect(abs.isError).toBe(false);
    expect(sha1(fs.readFileSync(path.join(inside, 'e4.xml')))).toBe(sha1(GOLDEN_XML));

    const rel = await f.call('export_build', { build_name: 'grenadator.xml', output_name: 'e5', output_directory: 'exported' });
    expect(rel.isError).toBe(false);
    expect(fs.existsSync(path.join(f.builds, 'exported', 'e5.xml'))).toBe(true);
    // Writes into the builds folder go through C-17: no temp file is left behind.
    expect(filesUnder(f.builds).filter((p) => p.endsWith('.pob2mcp-tmp'))).toEqual([]);
  }, T);

  it('AC-E49: a symlink inside POB_DIRECTORY that points outside it is refused', async () => {
    const outside = path.join(f.tmp, 'outside');
    fs.mkdirSync(outside, { recursive: true });
    fs.symlinkSync(outside, path.join(f.builds, 'escape'));
    const out = await f.call('export_build', { build_name: 'grenadator.xml', output_name: 'e6', output_directory: 'escape' });
    expect(out.isError).toBe(true);
    expect(fs.existsSync(path.join(outside, 'e6.xml'))).toBe(false);
  }, T);

  it('AC-E49: an existing export is replaced only with overwrite: true', async () => {
    expect((await f.call('export_build', { build_name: 'grenadator.xml', output_name: 'e7' })).isError).toBe(false);
    const again = await f.call('export_build', { build_name: 'grenadator.xml', output_name: 'e7' });
    expect(again.isError).toBe(true);
    expect(again.text).toContain('overwrite: true');
    expect((await f.call('export_build', { build_name: 'grenadator.xml', output_name: 'e7', overwrite: true })).isError).toBe(false);
  }, T);
  it('D-88: output_directory inside <stateDir>/backups or <stateDir>/snapshots is isError, even with overwrite: true, and replaces nothing', async () => {
    const stateDir = path.join(f.tmp, 'state');
    // A writer backup and a snapshot copy exist under the reserved subtrees.
    const backupDir = path.join(stateDir, 'backups', 'grenadator.xml');
    const snapDir = path.join(stateDir, 'snapshots', 'grenadator.xml');
    fs.mkdirSync(backupDir, { recursive: true });
    fs.mkdirSync(snapDir, { recursive: true });
    fs.writeFileSync(path.join(backupDir, 'b1_backup.xml'), 'backup bytes');
    fs.writeFileSync(path.join(snapDir, 's1_snapshot.xml'), 'snapshot bytes');

    for (const [dir, name, sub] of [
      [backupDir, 'b1_backup', 'backups'],
      [snapDir, 's1_snapshot', 'snapshots'],
      [path.join(stateDir, 'backups'), 'top', 'backups'],
      [path.join(stateDir, 'exports', '..', 'snapshots'), 'dotdot', 'snapshots'],
    ] as const) {
      const out = await f.call('export_build', { build_name: 'grenadator.xml', output_name: name, output_directory: dir, overwrite: true });
      expect(out.isError).toBe(true);
      expect(out.text).toContain(`inside the server's ${sub} folder`);
    }
    expect(fs.readFileSync(path.join(backupDir, 'b1_backup.xml'), 'utf8')).toBe('backup bytes');
    expect(fs.readFileSync(path.join(snapDir, 's1_snapshot.xml'), 'utf8')).toBe('snapshot bytes');
    expect(fs.existsSync(path.join(stateDir, 'backups', 'top.xml'))).toBe(false);
    expect(fs.existsSync(path.join(stateDir, 'snapshots', 'dotdot.xml'))).toBe(false);

    // A symlink elsewhere in the state dir that resolves into backups is refused too.
    fs.mkdirSync(path.join(stateDir, 'exports'), { recursive: true });
    fs.symlinkSync(backupDir, path.join(stateDir, 'exports', 'to-backups'));
    const viaLink = await f.call('export_build', {
      build_name: 'grenadator.xml', output_name: 'b1_backup', output_directory: path.join(stateDir, 'exports', 'to-backups'), overwrite: true,
    });
    expect(viaLink.isError).toBe(true);
    expect(fs.readFileSync(path.join(backupDir, 'b1_backup.xml'), 'utf8')).toBe('backup bytes');

    // Elsewhere in the state dir is still allowed.
    const ok = await f.call('export_build', { build_name: 'grenadator.xml', output_name: 'e8', output_directory: path.join(stateDir, 'mine') });
    expect(ok.isError).toBe(false);
    expect(sha1(fs.readFileSync(path.join(stateDir, 'mine', 'e8.xml')))).toBe(sha1(GOLDEN_XML));
  }, T);
});

engineDescribe('AC-E50 (WU-13, C-16/C-17): snapshot, list and restore', () => {
  let f: SessionFixture;
  let stateDir: string;
  let file: string;
  beforeAll(async () => {
    f = await startSessionFixture();
    stateDir = path.join(f.tmp, 'state');
    file = path.join(f.builds, 'grenadator.xml');
  }, T);
  afterAll(async () => f?.close(), 30000);

  it('AC-E50: snapshot_build → list_snapshots → restore_snapshot on grenadator.xml; artifacts under <stateDir>/snapshots and <stateDir>/backups (<id>_before-restore.xml); the next engine call reloads', async () => {
    expect((await f.call('lua_load_build', { build_name: 'grenadator.xml' })).isError).toBe(false);

    const snap = await f.call('snapshot_build', { build_name: 'grenadator.xml', tag: 't1', description: 'before notes' });
    expect(snap.isError).toBe(false);
    const snapshots = filesUnder(path.join(stateDir, 'snapshots', 'grenadator.xml'));
    expect(snapshots.some((p) => /_t1\.xml$/.test(p))).toBe(true);
    expect(snapshots.some((p) => /_metadata\.json$/.test(p))).toBe(true);
    expect(sha1(fs.readFileSync(snapshots.find((p) => p.endsWith('_t1.xml')) as string))).toBe(sha1(GOLDEN_XML));

    const list = await f.call('list_snapshots', { build_name: 'grenadator.xml' });
    expect(list.isError).toBe(false);
    expect(list.text).toContain('[t1]');

    // Change the file (a text write leaves the engine's record alone), and let the clean engine reload it.
    expect((await f.call('set_build_notes', { build_name: 'grenadator.xml', notes: 'changed' })).isError).toBe(false);
    const changedBytes = fs.readFileSync(file);
    expect((await f.call('lua_get_build_info')).text).toMatch(/^Reloaded grenadator\.xml/);

    const restore = await f.call('restore_snapshot', { build_name: 'grenadator.xml', snapshot_id: 't1' });
    expect(restore.isError).toBe(false);
    expect(sha1(fs.readFileSync(file))).toBe(sha1(GOLDEN_XML));
    const backups = filesUnder(path.join(stateDir, 'backups', 'grenadator.xml')).filter((p) => p.endsWith('_before-restore.xml'));
    expect(backups).toHaveLength(1);
    expect(sha1(fs.readFileSync(backups[0]))).toBe(sha1(changedBytes));

    // Nothing the server wrote is in the builds folder except the build itself.
    expect(filesUnder(f.builds).map((p) => path.relative(f.builds, p))).toEqual(['grenadator.xml']);

    const next = await f.call('lua_get_build_info');
    expect(next.isError).toBe(false);
    expect(next.text.startsWith('Reloaded grenadator.xml')).toBe(true);
  }, T);

  it('AC-E50: restore_snapshot always backs up, even with backup_current: false (D-51b)', async () => {
    const before = filesUnder(path.join(stateDir, 'backups', 'grenadator.xml')).length;
    const restore = await f.call('restore_snapshot', { build_name: 'grenadator.xml', snapshot_id: 't1', backup_current: false });
    expect(restore.isError).toBe(false);
    expect(filesUnder(path.join(stateDir, 'backups', 'grenadator.xml')).length).toBe(before + 1);
  }, T);
});

engineDescribe('AC-E51 (WU-13, D-9): analyze_build and compare_builds never change the engine build', () => {
  let f: SessionFixture;
  beforeAll(async () => {
    f = await startSessionFixture({ files: { 'grenadator.xml': GOLDEN_XML, 'other.xml': goldenWithLevel(80) } });
    expect((await f.call('lua_load_build', { build_name: 'grenadator.xml' })).isError).toBe(false);
  }, T);
  afterAll(async () => f?.close(), 30000);

  it('AC-E51: analyze_build {other.xml} leaves revision, loaded and the canonical export identical', async () => {
    const before = await engineState(f);
    const out = await f.call('analyze_build', { build_name: 'other.xml' });
    expect(out.isError).toBe(false);
    expect(out.text).toContain('Level: 80');
    expect(out.text).toContain('Live Calculated Stats (PoB2 engine, this file)');
    await expectUnchanged(f, before, { acrossReload: true });
  }, T);

  it('AC-E51: compare_builds with it reports both levels (90 vs 80) and leaves the engine state identical', async () => {
    const before = await engineState(f);
    const out = await f.call('compare_builds', { build1: 'grenadator.xml', build2: 'other.xml' });
    expect(out.isError).toBe(false);
    expect(out.text).toContain('Build Comparison (Live Stats)');
    expect(out.text).toContain('Level: 90 vs 80');
    await expectUnchanged(f, before, { acrossReload: true });
  }, T);

  it('AC-E51: with unsaved engine changes, compare_builds keeps them (level, dirty flag)', async () => {
    expect((await f.call('set_character_level', { level: 70 })).isError).toBe(false);
    expect(f.session.isDirty()).toBe(true);
    const before = await engineState(f);
    const out = await f.call('compare_builds', { build1: 'grenadator.xml', build2: 'other.xml' });
    expect(out.isError).toBe(false);
    expect(out.text).toContain('Level: 90 vs 80');
    await expectUnchanged(f, before, { acrossReload: true });
    expect(await engineLevel(f.session)).toBe(70);
    expect(f.session.isDirty()).toBe(true);
  }, T);
});

engineDescribe('AC-E52 (WU-13): import_build accepts only PathOfBuilding2 and caps inflation', () => {
  let f: SessionFixture;
  beforeAll(async () => {
    f = await startSessionFixture();
    expect((await f.call('lua_load_build', { build_name: 'grenadator.xml' })).isError).toBe(false);
  }, T);
  afterAll(async () => f?.close(), 30000);

  it('AC-E52: a code whose XML root is <PathOfBuilding> is isError naming PathOfBuilding2, and the engine build is untouched', async () => {
    const before = await engineState(f);
    const poe1 = '<?xml version="1.0" encoding="UTF-8"?>\n<PathOfBuilding>\n  <Build level="90" className="Ranger"/>\n</PathOfBuilding>\n';
    const out = await f.call('import_build', { source: code(poe1) });
    expect(out.isError).toBe(true);
    expect(out.text).toContain('PathOfBuilding2');
    await expectUnchanged(f, before);
  }, T);

  it('AC-E52: a code that inflates beyond 16 MiB is isError "build code too large", and inflate is called with maxOutputLength 16777216', async () => {
    const spy = jest.spyOn(zlib, 'inflateSync');
    try {
      const out = await f.call('import_build', { source: code(Buffer.alloc(20 * 1024 * 1024)) });
      expect(out.isError).toBe(true);
      expect(out.text).toContain('build code too large');
      expect(spy).toHaveBeenCalled();
      for (const args of spy.mock.calls) {
        expect(args[1]).toEqual(expect.objectContaining({ maxOutputLength: 16777216 }));
      }
    } finally {
      spy.mockRestore();
    }
  }, T);

  it('WU-13 (C-17): import_build save_as writes through the writer as the engine build, and an existing name needs overwrite', async () => {
    const out = await f.call('import_build', { source: code(GOLDEN_XML), save_as: 'imported/imp1' });
    expect(out.isError).toBe(false);
    expect(fs.readFileSync(path.join(f.builds, 'imported', 'imp1.xml'), 'utf8')).toBe(GOLDEN_XML);
    expect(f.session.loaded?.path).toBe('imported/imp1.xml');
    expect(f.session.isDirty()).toBe(false);

    expect((await f.call('lua_load_build', { build_name: 'grenadator.xml' })).isError).toBe(false);
    const before = await engineState(f);
    const again = await f.call('import_build', { source: code(GOLDEN_XML), save_as: 'imported/imp1' });
    expect(again.isError).toBe(true);
    expect(again.text).toContain('already exists; pass overwrite: true');
    await expectUnchanged(f, before);

    const replaced = await f.call('import_build', { source: code(goldenWithLevel(77)), save_as: 'imported/imp1', overwrite: true });
    expect(replaced.isError).toBe(false);
    expect(replaced.text).toContain('re-open it there');
    expect(fs.readFileSync(path.join(f.builds, 'imported', 'imp1.xml'), 'utf8')).toContain('<Build level="77"');
  }, T);

  it('WU-13 (C-17 step 3): import_build save_as over the loaded file that changed on disk is refused before the load', async () => {
    const file = path.join(f.builds, 'grenadator.xml');
    writeBuild(file, GOLDEN_XML);
    expect((await f.call('lua_load_build', { build_name: 'grenadator.xml' })).isError).toBe(false);
    writeBuild(file, goldenWithLevel(66)); // PoB2 saved it meanwhile
    const before = { loaded: structuredClone(f.session.loaded), revision: f.session.revision };
    const out = await f.call('import_build', { source: code(goldenWithLevel(55)), save_as: 'grenadator', overwrite: true });
    expect(out.isError).toBe(true);
    expect(out.text).toContain('changed on disk since');
    expect(fs.readFileSync(file, 'utf8')).toBe(goldenWithLevel(66));
    expect(f.session.loaded).toEqual(before.loaded);
    expect(f.session.revision).toBe(before.revision);
  }, T);
});

engineDescribe('WU-13 (C-17 step 3): import_build save_as never writes over a file that changed on disk', () => {
  let f: SessionFixture;
  let file: string;
  /** What the share-site fetch does before it answers (e.g. PoB2 saves the target meanwhile). */
  let duringFetch: () => void = () => undefined;
  let fetched = '';
  const ff = fixtureFetch([
    {
      match: /^https:\/\/pobb\.in\//,
      respond: () => {
        duringFetch();
        return new Response(fetched, { status: 200 });
      },
    },
  ]);
  beforeAll(async () => {
    f = await startSessionFixture({ files: { 'grenadator.xml': GOLDEN_XML, 'other.xml': goldenWithLevel(80) }, deps: { fetch: ff.fetch } });
    file = path.join(f.builds, 'grenadator.xml');
  }, T);
  afterAll(async () => f?.close(), 30000);

  it('a PoB2 save of the loaded target during the share-link fetch is refused at write time, not overwritten; the import stays loaded, unsaved', async () => {
    writeBuild(file, GOLDEN_XML);
    expect((await f.call('lua_load_build', { build_name: 'grenadator.xml' })).isError).toBe(false);
    ff.calls.length = 0;
    fetched = code(goldenWithLevel(55));
    duringFetch = () => writeBuild(file, goldenWithLevel(66)); // PoB2 saves it while the link is fetched
    try {
      const out = await f.call('import_build', { source: 'https://pobb.in/abcdef', save_as: 'grenadator', overwrite: true });
      expect(out.isError).toBe(true);
      expect(out.text).toContain('grenadator.xml changed on disk since the engine loaded or saved it');
      expect(out.text).toContain('The imported build is loaded in the engine but was not saved.');
    } finally {
      duringFetch = () => undefined;
    }
    expect(ff.calls.map((c) => c.url)).toEqual(['https://pobb.in/abcdef/raw']);
    expect(fs.readFileSync(file, 'utf8')).toBe(goldenWithLevel(66));
    expect(filesUnder(path.join(f.tmp, 'state', 'backups', 'grenadator.xml'))).toEqual([]);
    expect(await engineLevel(f.session)).toBe(55);
    expect(f.session.loaded?.path).toBeNull();
  }, T);

  it('the loaded target that the server wrote, then PoB2 saved and the engine reloaded, can be replaced (the loaded record wins over the stale write record)', async () => {
    writeBuild(file, GOLDEN_XML);
    expect((await f.call('lua_load_build', { build_name: 'grenadator.xml' })).isError).toBe(false);
    // The server writes the loaded file (its write record), and the clean engine reloads it.
    expect((await f.call('set_build_notes', { build_name: 'grenadator.xml', notes: 'server edit' })).isError).toBe(false);
    expect((await f.call('lua_get_build_info')).text).toMatch(/^Reloaded grenadator\.xml/);
    // PoB2 then saves it, and the clean engine reloads that save.
    writeBuild(file, goldenWithLevel(66));
    expect((await f.call('lua_get_build_info')).text).toMatch(/^Reloaded grenadator\.xml/);

    const out = await f.call('import_build', { source: code(goldenWithLevel(55)), save_as: 'grenadator', overwrite: true });
    expect(out.isError).toBe(false);
    expect(out.text).toContain('Saved grenadator.xml');
    expect(fs.readFileSync(file, 'utf8')).toBe(goldenWithLevel(55));
    expect(f.session.loaded?.path).toBe('grenadator.xml');
    expect(f.session.isDirty()).toBe(false);
  }, T);

  it('a target the server wrote that changed on disk since (not the loaded file) is refused before the load: the engine build is untouched', async () => {
    writeBuild(file, GOLDEN_XML);
    expect((await f.call('lua_load_build', { build_name: 'grenadator.xml' })).isError).toBe(false);
    const other = path.join(f.builds, 'other.xml');
    expect((await f.call('set_build_notes', { build_name: 'other.xml', notes: 'server edit' })).isError).toBe(false);
    writeBuild(other, goldenWithLevel(81)); // PoB2 saves other.xml
    const before = await engineState(f);
    const out = await f.call('import_build', { source: code(goldenWithLevel(55)), save_as: 'other', overwrite: true });
    expect(out.isError).toBe(true);
    expect(out.text).toContain('other.xml changed on disk since the engine loaded or saved it');
    expect(out.text).not.toContain('was not saved');
    expect(fs.readFileSync(other, 'utf8')).toBe(goldenWithLevel(81));
    await expectUnchanged(f, before);
  }, T);
});

engineDescribe('D-86 (FR-E4, C-17 step 3): a file the engine loaded or saved stays guarded after the engine switches away', () => {
  // One target per case, never written by the server before it: only the engine's record can guard it.
  const targets = ['t-load', 't-new', 't-import', 't-saveas', 't-control'];
  let f: SessionFixture;
  beforeAll(async () => {
    f = await startSessionFixture({
      files: { ...Object.fromEntries(targets.map((t) => [`${t}.xml`, GOLDEN_XML])), 'other.xml': goldenWithLevel(80) },
    });
  }, T);
  afterAll(async () => f?.close(), 30000);

  /** Load `<name>.xml`, run `switchAway`, let PoB2 save `<name>.xml`; overwrites of it are refused. */
  async function expectGuardedAfter(name: string, switchAway: () => Promise<void>): Promise<void> {
    const file = path.join(f.builds, `${name}.xml`);
    expect((await f.call('lua_load_build', { build_name: `${name}.xml` })).isError).toBe(false);
    await switchAway();
    expect(f.session.loaded?.path).not.toBe(`${name}.xml`);
    const pob2 = goldenWithLevel(66);
    writeBuild(file, pob2); // PoB2 saves the previously loaded file

    const save = await f.call('lua_save_build', { build_name: name, overwrite: true });
    expect(save.isError).toBe(true);
    expect(save.text).toContain(`${name}.xml changed on disk since the engine loaded or saved it`);
    const notes = await f.call('set_build_notes', { build_name: `${name}.xml`, notes: 'over PoB2' });
    expect(notes.isError).toBe(true);
    expect(notes.text).toContain('changed on disk since');
    expect(fs.readFileSync(file, 'utf8')).toBe(pob2);
  }

  it('after loading another build', async () => {
    await expectGuardedAfter('t-load', async () => {
      expect((await f.call('lua_load_build', { build_name: 'other.xml' })).isError).toBe(false);
    });
  }, T);

  it('after a new build', async () => {
    await expectGuardedAfter('t-new', async () => {
      expect((await f.call('lua_new_build')).isError).toBe(false);
    });
  }, T);

  it('after an import', async () => {
    await expectGuardedAfter('t-import', async () => {
      expect((await f.call('import_build', { source: code(goldenWithLevel(55)) })).isError).toBe(false);
    });
  }, T);

  it('after a Save As re-points the loaded build to another file', async () => {
    await expectGuardedAfter('t-saveas', async () => {
      expect((await f.call('lua_save_build', { build_name: 'copy', overwrite: true })).isError).toBe(false);
      expect(f.session.loaded?.path).toBe('copy.xml');
    });
  }, T);

  it('control: with no PoB2 save since, the previously loaded file can be overwritten', async () => {
    const file = path.join(f.builds, 't-control.xml');
    expect((await f.call('lua_load_build', { build_name: 't-control.xml' })).isError).toBe(false);
    expect((await f.call('lua_load_build', { build_name: 'other.xml' })).isError).toBe(false);
    const save = await f.call('lua_save_build', { build_name: 't-control', overwrite: true });
    expect(save.isError).toBe(false);
    expect(fs.readFileSync(file, 'utf8')).toMatch(/<Build [^>]*level="80"/);
    expect(f.session.loaded?.path).toBe('t-control.xml');
  }, T);
});

engineDescribe('AC-E63 (WU-13, C-17 step 6): byte and text writes to the loaded file', () => {
  let f: SessionFixture;
  let file: string;
  beforeAll(async () => {
    f = await startSessionFixture();
    file = path.join(f.builds, 'grenadator.xml');
  }, T);
  afterAll(async () => f?.close(), 30000);

  it('AC-E63 (a): set_build_notes on the loaded file with a clean engine → the next lua_get_build_info starts with "Reloaded grenadator.xml"', async () => {
    expect((await f.call('lua_load_build', { build_name: 'grenadator.xml' })).isError).toBe(false);
    const notes = await f.call('set_build_notes', { build_name: 'grenadator.xml', notes: 'Notes from AC-E63 <&>' });
    expect(notes.isError).toBe(false);
    expect(notesOf(fs.readFileSync(file, 'utf8'))).toBe('Notes from AC-E63 &lt;&amp;&gt;');
    const info = await f.call('lua_get_build_info');
    expect(info.isError).toBe(false);
    expect(info.text.startsWith('Reloaded grenadator.xml')).toBe(true);
  }, T);

  it('AC-E63 (b): load, mutate, restore_snapshot on the same file → lua_save_build overwrite is refused "changed on disk since", and the restored bytes are intact', async () => {
    // The snapshot holds the golden bytes; the engine then loads a different version of the file.
    writeBuild(file, GOLDEN_XML);
    expect((await f.call('snapshot_build', { build_name: 'grenadator.xml', tag: 'golden' })).isError).toBe(false);
    writeBuild(file, goldenWithLevel(70));
    expect((await f.call('lua_load_build', { build_name: 'grenadator.xml' })).isError).toBe(false);
    expect((await f.call('set_character_level', { level: 60 })).isError).toBe(false);

    const restore = await f.call('restore_snapshot', { build_name: 'grenadator.xml', snapshot_id: 'golden' });
    expect(restore.isError).toBe(false);
    expect(fs.readFileSync(file, 'utf8')).toBe(GOLDEN_XML);

    const save = await f.call('lua_save_build', { build_name: 'grenadator', overwrite: true });
    expect(save.isError).toBe(true);
    expect(save.text).toContain('changed on disk since');
    expect(fs.readFileSync(file, 'utf8')).toBe(GOLDEN_XML);
  }, T);

  it('C-17 step 3: the server\'s own text and restore writes to the loaded file are not "changed on disk": back-to-back edits pass (clean and dirty engine); an engine save over them and a PoB2 save are still refused', async () => {
    writeBuild(file, GOLDEN_XML);
    expect((await f.call('snapshot_build', { build_name: 'grenadator.xml', tag: 'a' })).isError).toBe(false);
    writeBuild(file, goldenWithLevel(70));
    expect((await f.call('snapshot_build', { build_name: 'grenadator.xml', tag: 'b' })).isError).toBe(false);
    expect((await f.call('lua_load_build', { build_name: 'grenadator.xml' })).isError).toBe(false);

    // Clean engine, no engine call in between: two notes edits in a row, then restores A then B.
    for (const notes of ['first edit', 'second edit']) {
      const out = await f.call('set_build_notes', { build_name: 'grenadator.xml', notes });
      expect(out.isError).toBe(false);
      expect(notesOf(fs.readFileSync(file, 'utf8'))).toBe(notes);
    }
    for (const [tag, xml] of [['a', GOLDEN_XML], ['b', goldenWithLevel(70)]] as const) {
      const out = await f.call('restore_snapshot', { build_name: 'grenadator.xml', snapshot_id: tag });
      expect(out.isError).toBe(false);
      expect(fs.readFileSync(file, 'utf8')).toBe(xml);
    }

    // Dirty engine (the disk-change check warns instead of reloading): edits in a row still pass.
    expect((await f.call('lua_reload_build')).isError).toBe(false);
    expect((await f.call('set_character_level', { level: 61 })).isError).toBe(false);
    for (const notes of ['dirty one', 'dirty two']) {
      const out = await f.call('set_build_notes', { build_name: 'grenadator.xml', notes });
      expect(out.isError).toBe(false);
      expect(notesOf(fs.readFileSync(file, 'utf8'))).toBe(notes);
    }
    // An engine save still compares with what the engine loaded, so it does not overwrite the edit.
    const save = await f.call('lua_save_build', { build_name: 'grenadator', overwrite: true });
    expect(save.isError).toBe(true);
    expect(save.text).toContain('changed on disk since');
    expect(notesOf(fs.readFileSync(file, 'utf8'))).toBe('dirty two');

    // A PoB2 save after the server's own edit is still refused.
    const pob2 = goldenWithLevel(95);
    writeBuild(file, pob2);
    const refused = await f.call('set_build_notes', { build_name: 'grenadator.xml', notes: 'over PoB2' });
    expect(refused.isError).toBe(true);
    expect(refused.text).toContain('changed on disk since');
    expect(fs.readFileSync(file, 'utf8')).toBe(pob2);
  }, T);
});

engineDescribe('AC-E64 (WU-13, D-58): get_build_stats reflects a lua_save_build', () => {
  let f: SessionFixture;
  let file: string;
  beforeAll(async () => {
    f = await startSessionFixture();
    file = path.join(f.builds, 'grenadator.xml');
  }, T);
  afterAll(async () => f?.close(), 30000);

  it('AC-E64: after lua_save_build to a file, get_build_stats on it reflects the saved content', async () => {
    const lifeOf = (xml: string) => /<PlayerStat\b[^>]*\sstat="Life"[^>]*\svalue="([^"]*)"|<PlayerStat\b[^>]*\svalue="([^"]*)"[^>]*\sstat="Life"/.exec(xml);
    const first = await f.call('get_build_stats', { build_name: 'grenadator.xml' });
    expect(first.isError).toBe(false);
    const goldenLife = lifeOf(GOLDEN_XML);
    const goldenValue = (goldenLife?.[1] ?? goldenLife?.[2]) as string;
    const lifeLine = (value: string) => new RegExp(`^Life: ${value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'm');
    expect(first.text).toMatch(lifeLine(goldenValue));

    expect((await f.call('lua_load_build', { build_name: 'grenadator.xml' })).isError).toBe(false);
    expect((await f.call('set_character_level', { level: 40 })).isError).toBe(false);
    expect((await f.call('lua_save_build', { build_name: 'grenadator', overwrite: true })).isError).toBe(false);

    const saved = fs.readFileSync(file, 'utf8');
    const savedLife = lifeOf(saved);
    const savedValue = (savedLife?.[1] ?? savedLife?.[2]) as string;
    expect(savedValue).toBeDefined();
    expect(savedValue).not.toBe(goldenValue);
    const second = await f.call('get_build_stats', { build_name: 'grenadator.xml' });
    expect(second.isError).toBe(false);
    expect(second.text).toMatch(lifeLine(savedValue));
    expect(second.text).not.toMatch(lifeLine(goldenValue));
  }, T);
});
