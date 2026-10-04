/**
 * Build-file writer (C-17, D-52), unit class: the real `BuildFileWriter` and `canonicalBuildPath` over an
 * injected in-memory filesystem, which can be case-insensitive (like drvfs `/mnt/c`) and can fail one
 * operation with an OS error code. The engine's `loaded` record and `noteSaved` are the writer's
 * collaborators from the session (C-3), faked here as the AC describes them.
 */
import { describe, it, expect } from '@jest/globals';
import crypto from 'crypto';
import path from 'path';
import { BuildFileWriter, TEMP_SUFFIX, type WriterFs } from '../../src/services/buildFileWriter';
import { canonicalBuildPath } from '../../src/utils/pathSanitizer';
import type { Fingerprint, LoadedBuild } from '../../src/engine/session';

const BASE = '/builds';
const STATE = '/state/pob2-mcp';

type Op = 'readdir' | 'stat' | 'readFile' | 'mkdir' | 'copyFileExclusive' | 'writeFile' | 'rename' | 'unlink';

function osErr(code: string, op: string, p: string): NodeJS.ErrnoException {
  return Object.assign(new Error(`${code}: operation failed, ${op} '${p}'`), { code });
}

/** An in-memory fs; with `caseInsensitive`, every lookup ignores case and keeps the on-disk casing. */
class MemFs implements WriterFs {
  private files = new Map<string, { real: string; data: Buffer; mtimeMs: number }>();
  private dirs = new Map<string, string>();
  private clock = 1_700_000_000_000;
  failures: Partial<Record<Op, string>> = {};

  constructor(private readonly caseInsensitive: boolean) {
    this.addDir('/');
  }

  private key(p: string): string {
    const n = path.posix.normalize(p);
    return this.caseInsensitive ? n.toLowerCase() : n;
  }
  private addDir(p: string): void {
    this.dirs.set(this.key(p), path.posix.normalize(p));
  }
  private maybeFail(op: Op, p: string): void {
    const code = this.failures[op];
    if (code) throw osErr(code, op, p);
  }
  private requireParent(p: string, op: string): void {
    if (!this.dirs.has(this.key(path.posix.dirname(p)))) throw osErr('ENOENT', op, p);
  }

  /** Test setup: put a file (creating its folders), with a fresh mtime. */
  put(p: string, data: string | Buffer): void {
    let dir = path.posix.dirname(p);
    const chain: string[] = [];
    while (!this.dirs.has(this.key(dir))) {
      chain.push(dir);
      dir = path.posix.dirname(dir);
    }
    for (const d of chain.reverse()) this.addDir(d);
    const existing = this.files.get(this.key(p));
    this.clock += 1000;
    this.files.set(this.key(p), { real: existing?.real ?? p, data: Buffer.from(data), mtimeMs: this.clock });
  }
  get(p: string): Buffer | undefined {
    return this.files.get(this.key(p))?.data;
  }
  /** Every file path, in on-disk casing. */
  list(): string[] {
    return [...this.files.values()].map((f) => f.real).sort();
  }

  async readdir(dir: string): Promise<string[]> {
    this.maybeFail('readdir', dir);
    const k = this.key(dir);
    if (!this.dirs.has(k)) throw osErr('ENOENT', 'scandir', dir);
    const real = [...this.files.values()].map((f) => f.real).concat([...this.dirs.values()]);
    return real.filter((r) => r !== '/' && this.key(path.posix.dirname(r)) === k).map((r) => path.posix.basename(r));
  }
  async stat(p: string) {
    this.maybeFail('stat', p);
    const f = this.files.get(this.key(p));
    if (!f) throw osErr('ENOENT', 'stat', p);
    return { size: f.data.length, mtimeMs: f.mtimeMs };
  }
  async readFile(p: string): Promise<Buffer> {
    this.maybeFail('readFile', p);
    const f = this.files.get(this.key(p));
    if (!f) throw osErr('ENOENT', 'open', p);
    return Buffer.from(f.data);
  }
  async mkdir(p: string): Promise<void> {
    this.maybeFail('mkdir', p);
    let dir = path.posix.normalize(p);
    const chain: string[] = [];
    while (!this.dirs.has(this.key(dir))) {
      chain.push(dir);
      dir = path.posix.dirname(dir);
    }
    for (const d of chain.reverse()) this.addDir(d);
  }
  async copyFileExclusive(src: string, dest: string): Promise<void> {
    this.maybeFail('copyFileExclusive', dest);
    const f = this.files.get(this.key(src));
    if (!f) throw osErr('ENOENT', 'copyfile', src);
    this.requireParent(dest, 'copyfile');
    if (this.files.has(this.key(dest))) throw osErr('EEXIST', 'copyfile', dest);
    this.clock += 1;
    this.files.set(this.key(dest), { real: dest, data: Buffer.from(f.data), mtimeMs: this.clock });
  }
  async writeFile(p: string, data: Buffer): Promise<void> {
    this.maybeFail('writeFile', p);
    this.requireParent(p, 'open');
    const existing = this.files.get(this.key(p));
    this.clock += 1;
    this.files.set(this.key(p), { real: existing?.real ?? p, data: Buffer.from(data), mtimeMs: this.clock });
  }
  async rename(from: string, to: string): Promise<void> {
    this.maybeFail('rename', to);
    const f = this.files.get(this.key(from));
    if (!f) throw osErr('ENOENT', 'rename', from);
    this.requireParent(to, 'rename');
    const existing = this.files.get(this.key(to));
    this.files.delete(this.key(from));
    this.files.set(this.key(to), { real: existing?.real ?? to, data: f.data, mtimeMs: f.mtimeMs });
  }
  async unlink(p: string): Promise<void> {
    this.maybeFail('unlink', p);
    if (!this.files.delete(this.key(p))) throw osErr('ENOENT', 'unlink', p);
  }
}

function fingerprintOf(bytes: Buffer, mtimeMs: number): Fingerprint {
  return { size: bytes.length, mtimeMs, sha1: crypto.createHash('sha1').update(bytes).digest('hex') };
}

const ENGINE_XML = '<?xml version="1.0" encoding="UTF-8"?>\n<PathOfBuilding2><Build level="91"/></PathOfBuilding2>\n';
const ON_DISK_XML = '<?xml version="1.0" encoding="UTF-8"?>\n<PathOfBuilding2><Build level="90"/></PathOfBuilding2>\n';

function setup(opts: { caseInsensitive?: boolean; loaded?: LoadedBuild | null } = {}) {
  const fs = new MemFs(opts.caseInsensitive ?? false);
  fs.put(path.posix.join(BASE, '.keep-dir'), '');
  let loaded: LoadedBuild | null = opts.loaded ?? null;
  const saved: Array<{ rel: string; fp: Fingerprint }> = [];
  const invalidated: string[] = [];
  const writer = new BuildFileWriter({
    pobDirectory: BASE,
    stateDir: STATE,
    loaded: () => loaded,
    onWritten: (rel) => invalidated.push(rel),
    fs,
    now: () => new Date('2026-10-04T12:34:56.789Z'),
  });
  const ctx = { noteSaved: (rel: string, fp: Fingerprint) => saved.push({ rel, fp }) };
  return {
    fs,
    writer,
    ctx,
    saved,
    invalidated,
    setLoaded: (l: LoadedBuild | null) => {
      loaded = l;
    },
  };
}

const tempFiles = (fs: MemFs) => fs.list().filter((p) => p.endsWith(TEMP_SUFFIX));
const backups = (fs: MemFs) => fs.list().filter((p) => p.startsWith(`${STATE}/backups/`));

describe('AC-E61 (WU-22, D-52 + C-17): case-insensitive drive', () => {
  it('AC-E61: on-disk Grenadator.xml loaded as "grenadator", changed on disk → a save to GRENADATOR with overwrite:true is refused with "changed on disk since"', async () => {
    const t = setup({ caseInsensitive: true });
    // 1. The on-disk file is Grenadator.xml.
    t.fs.put(`${BASE}/Grenadator.xml`, ON_DISK_XML);
    // 2. The engine loaded it as "grenadator": the session records the canonical path and the loaded bytes.
    const rel = await canonicalBuildPath('grenadator', BASE, t.fs);
    expect(rel).toBe('Grenadator.xml');
    const loadedBytes = await t.fs.readFile(`${BASE}/grenadator.xml`);
    const st = await t.fs.stat(`${BASE}/GRENADATOR.XML`);
    t.setLoaded({ path: rel, displayName: 'Grenadator', fingerprint: fingerprintOf(loadedBytes, st.mtimeMs), loadedRevision: 1, savedRevision: 1 });
    // 3. The file changes on disk (PoB2 saved it).
    const pob2Save = ON_DISK_XML.replace('level="90"', 'level="95"');
    t.fs.put(`${BASE}/Grenadator.xml`, pob2Save);

    // 4. A save to GRENADATOR with overwrite:true is refused.
    await expect(
      t.writer.writeBuildFile({ name: 'GRENADATOR', bytes: ENGINE_XML, overwrite: true, kind: 'engine', ctx: t.ctx }),
    ).rejects.toThrow(/Grenadator\.xml changed on disk since the engine loaded or saved it/);
    expect(t.fs.get(`${BASE}/Grenadator.xml`)?.toString()).toBe(pob2Save);
    expect(t.fs.list().filter((p) => p.startsWith(BASE) && p.endsWith('.xml'))).toEqual([`${BASE}/Grenadator.xml`]);
    expect(t.saved).toEqual([]);
    expect(backups(t.fs)).toEqual([]);
    expect(tempFiles(t.fs)).toEqual([]);
  });

  it('AC-E61 (control): unchanged on disk, the same save writes the canonical Grenadator.xml and notes it saved under that path', async () => {
    const t = setup({ caseInsensitive: true });
    t.fs.put(`${BASE}/Grenadator.xml`, ON_DISK_XML);
    const st = await t.fs.stat(`${BASE}/Grenadator.xml`);
    t.setLoaded({ path: 'Grenadator.xml', displayName: 'Grenadator', fingerprint: fingerprintOf(Buffer.from(ON_DISK_XML), st.mtimeMs), loadedRevision: 1, savedRevision: 1 });

    const res = await t.writer.writeBuildFile({ name: 'GRENADATOR', bytes: ENGINE_XML, overwrite: true, kind: 'engine', ctx: t.ctx });
    expect(res.path).toBe('Grenadator.xml');
    expect(t.fs.get(`${BASE}/Grenadator.xml`)?.toString()).toBe(ENGINE_XML);
    expect(t.fs.list().filter((p) => p.startsWith(BASE) && p.endsWith('.xml'))).toEqual([`${BASE}/Grenadator.xml`]);
    expect(t.saved.map((s) => s.rel)).toEqual(['Grenadator.xml']);
    expect(backups(t.fs)).toEqual([`${STATE}/backups/Grenadator.xml/2026-10-04T12-34-56-789Z_backup.xml`]);
    expect(t.fs.get(backups(t.fs)[0])?.toString()).toBe(ON_DISK_XML);
  });
});

describe('AC-E61 (WU-22, C-17 failure paths): failing fs', () => {
  it('AC-E61: a backup failure → error naming the OS error, with the target unchanged', async () => {
    const t = setup();
    t.fs.put(`${BASE}/x.xml`, ON_DISK_XML);
    t.fs.failures.copyFileExclusive = 'EACCES';
    const err = await t.writer
      .writeBuildFile({ name: 'x', bytes: ENGINE_XML, overwrite: true, kind: 'engine', ctx: t.ctx })
      .catch((e: Error) => e);
    expect(err).toBeInstanceOf(Error);
    expect((err as Error).message).toContain('EACCES');
    expect((err as Error).message).toContain('x.xml');
    expect(t.fs.get(`${BASE}/x.xml`)?.toString()).toBe(ON_DISK_XML);
    expect(tempFiles(t.fs)).toEqual([]);
    expect(t.saved).toEqual([]);
  });

  it('AC-E61: a rename failure → error naming the target and backup paths, no temp file left, no fingerprint recorded', async () => {
    const t = setup();
    // A first, successful write: the writer records its fingerprint.
    await t.writer.writeBuildFile({ name: 'x', bytes: ON_DISK_XML, kind: 'bytes' });
    t.fs.failures.rename = 'EPERM';
    const err = await t.writer
      .writeBuildFile({ name: 'x', bytes: ENGINE_XML, overwrite: true, kind: 'engine', ctx: t.ctx })
      .catch((e: Error) => e);
    expect(err).toBeInstanceOf(Error);
    const message = (err as Error).message;
    expect(message).toContain('EPERM');
    expect(message).toContain(`${BASE}/x.xml`);
    const [backup] = backups(t.fs);
    expect(backup).toBe(`${STATE}/backups/x.xml/2026-10-04T12-34-56-789Z_backup.xml`);
    expect(message).toContain(backup);
    expect(tempFiles(t.fs)).toEqual([]);
    expect(t.fs.get(`${BASE}/x.xml`)?.toString()).toBe(ON_DISK_XML);
    expect(t.saved).toEqual([]);

    // Nothing was recorded for the failed write: the record is still the first write's, which matches the
    // file on disk, so the next write passes the changed-on-disk guard (a recorded failed write would not).
    t.fs.failures = {};
    const res = await t.writer.writeBuildFile({ name: 'x', bytes: ENGINE_XML, overwrite: true, kind: 'engine', ctx: t.ctx });
    expect(res.path).toBe('x.xml');
    expect(t.fs.get(`${BASE}/x.xml`)?.toString()).toBe(ENGINE_XML);
    // The second backup of the same instant gets its own name: backups are never replaced.
    expect(backups(t.fs)).toEqual([
      `${STATE}/backups/x.xml/2026-10-04T12-34-56-789Z-1_backup.xml`,
      `${STATE}/backups/x.xml/2026-10-04T12-34-56-789Z_backup.xml`,
    ]);
  });

  it('AC-E61: a missing parent folder is created', async () => {
    const t = setup();
    const res = await t.writer.writeBuildFile({ name: 'sub/deeper/new', bytes: ENGINE_XML, kind: 'engine', ctx: t.ctx });
    expect(res.path).toBe('sub/deeper/new.xml');
    expect(t.fs.get(`${BASE}/sub/deeper/new.xml`)?.toString()).toBe(ENGINE_XML);
    expect(res.replaced).toBe(false);
    expect(res.backupPath).toBeNull();
    expect(t.saved.map((s) => s.rel)).toEqual(['sub/deeper/new.xml']);
  });
});

describe('C-17 writer rules (WU-22)', () => {
  it('an existing target without overwrite → "already exists; pass overwrite: true", nothing written', async () => {
    const t = setup();
    t.fs.put(`${BASE}/a.xml`, ON_DISK_XML);
    await expect(t.writer.writeBuildFile({ name: 'a', bytes: ENGINE_XML, kind: 'engine', ctx: t.ctx })).rejects.toThrow(
      'a.xml already exists; pass overwrite: true to replace it (a backup is kept).',
    );
    expect(t.fs.get(`${BASE}/a.xml`)?.toString()).toBe(ON_DISK_XML);
    expect(backups(t.fs)).toEqual([]);
  });

  it('restore and text writes imply overwrite; restore backs up as _before-restore; only engine writes call noteSaved', async () => {
    const t = setup();
    t.fs.put(`${BASE}/a.xml`, ON_DISK_XML);
    const restored = await t.writer.writeBuildFile({ name: 'a.xml', bytes: ENGINE_XML, kind: 'restore' });
    expect(restored.replaced).toBe(true);
    expect(restored.backupPath).toBe(`${STATE}/backups/a.xml/2026-10-04T12-34-56-789Z_before-restore.xml`);
    expect(restored.message).toContain('If this build is open in PoB2, re-open it there to see the changes.');
    const edited = await t.writer.writeBuildFile({ name: 'a', bytes: ON_DISK_XML, kind: 'text' });
    expect(edited.replaced).toBe(true);
    expect(t.saved).toEqual([]);
    expect(t.invalidated).toEqual(['a.xml', 'a.xml']);
  });

  it('a write to a file the writer wrote, changed on disk since → refused; no flag overrides it', async () => {
    const t = setup();
    await t.writer.writeBuildFile({ name: 'mine', bytes: ON_DISK_XML, kind: 'bytes' });
    t.fs.put(`${BASE}/mine.xml`, 'changed in PoB2');
    for (const kind of ['bytes', 'restore', 'text'] as const) {
      await expect(t.writer.writeBuildFile({ name: 'mine', bytes: ENGINE_XML, overwrite: true, kind })).rejects.toThrow(
        /mine\.xml changed on disk since the engine loaded or saved it \(probably saved in PoB2\)\. Reload it first \(lua_reload_build\) or save under a new name\./,
      );
    }
    expect(t.fs.get(`${BASE}/mine.xml`)?.toString()).toBe('changed in PoB2');
  });

  it('a recorded file that no longer exists is created again, with a notice', async () => {
    const t = setup();
    t.fs.put(`${BASE}/gone.xml`, ON_DISK_XML);
    const st = await t.fs.stat(`${BASE}/gone.xml`);
    t.setLoaded({ path: 'gone.xml', displayName: 'gone', fingerprint: fingerprintOf(Buffer.from(ON_DISK_XML), st.mtimeMs), loadedRevision: 0, savedRevision: 0 });
    await t.fs.unlink(`${BASE}/gone.xml`);
    const res = await t.writer.writeBuildFile({ name: 'gone', bytes: ENGINE_XML, kind: 'engine', ctx: t.ctx });
    expect(res.notices).toEqual(['gone.xml no longer existed on disk; created it again.']);
    expect(res.message).toBe(`Saved gone.xml (${Buffer.byteLength(ENGINE_XML)} bytes).`);
    expect(t.saved[0].fp).toMatchObject({ size: Buffer.byteLength(ENGINE_XML) });
  });

  it('a leftover temp file from an earlier crash is overwritten by the next write and does not survive it', async () => {
    const t = setup();
    t.fs.put(`${BASE}/left.xml${TEMP_SUFFIX}`, 'half-written');
    await t.writer.writeBuildFile({ name: 'left', bytes: ENGINE_XML, kind: 'bytes' });
    expect(t.fs.get(`${BASE}/left.xml`)?.toString()).toBe(ENGINE_XML);
    expect(tempFiles(t.fs)).toEqual([]);
  });

  it('a temp-write failure → error with the OS code, the temp file unlinked, the target untouched', async () => {
    const t = setup();
    t.fs.put(`${BASE}/w.xml`, ON_DISK_XML);
    t.fs.failures.writeFile = 'ENOSPC';
    await expect(t.writer.writeBuildFile({ name: 'w', bytes: ENGINE_XML, overwrite: true, kind: 'bytes' })).rejects.toThrow(/ENOSPC/);
    expect(t.fs.get(`${BASE}/w.xml`)?.toString()).toBe(ON_DISK_XML);
    expect(tempFiles(t.fs)).toEqual([]);
  });

  it('traversal outside the builds folder is refused before any write', async () => {
    const t = setup();
    await expect(t.writer.writeBuildFile({ name: '../escape', bytes: ENGINE_XML, kind: 'bytes' })).rejects.toThrow(/traversal/);
    expect(t.fs.list().filter((p) => !p.startsWith(BASE))).toEqual([]);
  });
});
