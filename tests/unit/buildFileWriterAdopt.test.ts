/**
 * AC-K83 (WU-138, D-479; C-17): the build-file writer's adoption and its record of the versions it wrote over, unit
 * class: the real `BuildFileWriter` over temp folders.
 *
 * - Without adoption, a file the user changed since this writer wrote it refuses the next write (C-17 step 3).
 * - `adoptBuildFile` takes the edited bytes as the writer's own last write, so the next write replaces them, backed up
 *   first, and the next delete takes them; it refuses a missing file and bytes that aren't the sha1 given.
 * - For the engine's loaded file, a byte copy or text edit accepts the adopted bytes too.
 * - `replacedVersion` says whether bytes were once in the file and replaced (one of its backups).
 */
import crypto from 'crypto';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';
import { BuildFileWriter, BuildFileWriteError } from '../../src/services/buildFileWriter';
import type { LoadedBuild } from '../../src/engine/session';

const sha1 = (data: Buffer | string) => crypto.createHash('sha1').update(data).digest('hex');

let tmp: string;
let builds: string;
let state: string;

beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'pob2-adopt-'));
  builds = path.join(tmp, 'builds');
  state = path.join(tmp, 'state');
  fs.mkdirSync(builds);
});
afterEach(() => {
  fs.rmSync(tmp, { recursive: true, force: true });
});

let clock = 0;
function writer(loaded: () => LoadedBuild | null = () => null): BuildFileWriter {
  return new BuildFileWriter({ pobDirectory: builds, stateDir: state, loaded, now: () => new Date(Date.UTC(2026, 10, 2, 12, 0, clock++)) });
}

/** The user's save in PoB2: new bytes and a new mtime. */
function userSave(name: string, text: string): void {
  const file = path.join(builds, name);
  fs.writeFileSync(file, text);
  const t = new Date(Date.now() + 60_000);
  fs.utimesSync(file, t, t);
}

describe('AC-K83: buildFileWriter.adoptBuildFile (D-479)', () => {
  it('without adoption the next write over a file the user changed is refused; after it, the write replaces the edited file, backed up first', async () => {
    const w = writer();
    await w.writeBuildFile({ name: 'Draft (draft)', bytes: 'v1', kind: 'bytes' });
    userSave('Draft (draft).xml', 'the user edit');
    const refused = await w.writeBuildFile({ name: 'Draft (draft)', bytes: 'v2', kind: 'bytes', overwrite: true }).catch((e) => e);
    expect(refused).toBeInstanceOf(BuildFileWriteError);
    expect((refused as Error).message).toContain('changed on disk');

    const adopted = await w.adoptBuildFile({ name: 'Draft (draft)', sha1: sha1('the user edit') });
    expect(adopted.path).toBe('Draft (draft).xml');
    expect(adopted.fingerprint).toMatchObject({ sha1: sha1('the user edit'), size: 'the user edit'.length });
    // Nothing is written by the adoption.
    expect(fs.readFileSync(path.join(builds, 'Draft (draft).xml'), 'utf8')).toBe('the user edit');

    const result = await w.writeBuildFile({ name: 'Draft (draft)', bytes: 'v2', kind: 'bytes', overwrite: true });
    expect(result.replaced).toBe(true);
    expect(fs.readFileSync(result.backupPath!, 'utf8')).toBe('the user edit');
    expect(fs.readFileSync(path.join(builds, 'Draft (draft).xml'), 'utf8')).toBe('v2');
  });

  it('after adoption the delete takes the edited file', async () => {
    const w = writer();
    await w.writeBuildFile({ name: 'Skeleton (draft)', bytes: 'v1', kind: 'bytes' });
    userSave('Skeleton (draft).xml', 'edited');
    expect(await w.deleteBuildFile({ name: 'Skeleton (draft)' }).catch((e) => e)).toBeInstanceOf(BuildFileWriteError);
    await w.adoptBuildFile({ name: 'Skeleton (draft)', sha1: sha1('edited') });
    const deleted = await w.deleteBuildFile({ name: 'Skeleton (draft)', sha1: sha1('edited') });
    expect(fs.readFileSync(deleted.backupPath, 'utf8')).toBe('edited');
    expect(fs.existsSync(path.join(builds, 'Skeleton (draft).xml'))).toBe(false);
  });

  it("for the engine's loaded file, a text edit after the adoption is taken", async () => {
    fs.writeFileSync(path.join(builds, 'Final.xml'), 'compiled');
    const st = fs.statSync(path.join(builds, 'Final.xml'));
    const loaded: LoadedBuild = {
      path: 'Final.xml',
      displayName: 'Final',
      fingerprint: { size: 'compiled'.length, mtimeMs: st.mtimeMs, sha1: sha1('compiled') },
    } as LoadedBuild;
    const w = writer(() => loaded);
    userSave('Final.xml', 'saved in PoB2');
    expect(await w.writeBuildFile({ name: 'Final', bytes: 'notes', kind: 'text' }).catch((e) => e)).toBeInstanceOf(BuildFileWriteError);
    await w.adoptBuildFile({ name: 'Final', sha1: sha1('saved in PoB2') });
    expect((await w.writeBuildFile({ name: 'Final', bytes: 'notes', kind: 'text' })).replaced).toBe(true);
  });

  it('refuses a missing file and bytes that are not the sha1 given; a refused adoption records nothing', async () => {
    const w = writer();
    const missing = await w.adoptBuildFile({ name: 'Nowhere', sha1: sha1('x') }).catch((e) => e);
    expect(missing).toBeInstanceOf(BuildFileWriteError);
    expect((missing as Error).message).toBe("Nowhere.xml doesn't exist, so it was not adopted.");

    await w.writeBuildFile({ name: 'Moved', bytes: 'v1', kind: 'bytes' });
    userSave('Moved.xml', 'edit one');
    const stale = await w.adoptBuildFile({ name: 'Moved', sha1: sha1('another edit') }).catch((e) => e);
    expect(stale).toBeInstanceOf(BuildFileWriteError);
    expect((stale as Error).message).toContain('changed on disk again since it was read');
    expect(await w.writeBuildFile({ name: 'Moved', bytes: 'v2', kind: 'bytes', overwrite: true }).catch((e) => e)).toBeInstanceOf(BuildFileWriteError);
  });
});

describe('AC-K83 (R-83): buildFileWriter.replacedVersion (D-479)', () => {
  it('says whether bytes were once in the file and replaced or deleted: an older version, not the current one', async () => {
    const w = writer();
    expect(await w.replacedVersion({ name: 'Draft (draft)', sha1: sha1('v1') })).toBe(false);
    await w.writeBuildFile({ name: 'Draft (draft)', bytes: 'v1', kind: 'bytes' });
    await w.writeBuildFile({ name: 'Draft (draft)', bytes: 'v2', kind: 'bytes', overwrite: true });
    expect(await w.replacedVersion({ name: 'Draft (draft)', sha1: sha1('v1') })).toBe(true);
    expect(await w.replacedVersion({ name: 'Draft (draft)', sha1: sha1('v2') })).toBe(false);
    expect(await w.replacedVersion({ name: 'Other (draft)', sha1: sha1('v1') })).toBe(false);
  });
});
