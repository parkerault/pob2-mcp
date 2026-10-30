/**
 * The build-file writer's delete (D-466, C-17; AC-K78's `remove_draft` rows at the writer), unit class: the real
 * `BuildFileWriter` over temp folders, with one fs operation failing where a row says so.
 *
 * - The file is backed up to `<stateDir>/backups/<relpath>/<id>_before-delete.xml` first, then deleted.
 * - A file whose bytes don't match the given sha1, or that changed since this process wrote it, is refused, with
 *   nothing deleted and no backup; so is a missing file.
 * - A backup that fails leaves the file in place.
 */
import crypto from 'crypto';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';
import { BuildFileWriter, BuildFileWriteError, nodeWriterFs, type WriterFs } from '../../src/services/buildFileWriter';

const sha1 = (data: Buffer | string) => crypto.createHash('sha1').update(data).digest('hex');

let tmp: string;
let builds: string;
let state: string;

beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'pob2-delete-'));
  builds = path.join(tmp, 'builds');
  state = path.join(tmp, 'state');
  fs.mkdirSync(builds);
});
afterEach(() => {
  fs.rmSync(tmp, { recursive: true, force: true });
});

function writer(fsImpl: WriterFs = nodeWriterFs, written: string[] = []): BuildFileWriter {
  return new BuildFileWriter({
    pobDirectory: builds,
    stateDir: state,
    loaded: () => null,
    fs: fsImpl,
    now: () => new Date('2026-10-30T12:00:00.000Z'),
    onWritten: (rel) => written.push(rel),
  });
}

const backupDir = (rel: string) => path.join(state, 'backups', ...rel.split('/'));

describe('AC-K78: buildFileWriter.deleteBuildFile (D-466)', () => {
  it('backs the file up as <id>_before-delete.xml under the state folder, then deletes it', async () => {
    const bytes = Buffer.from('<PathOfBuilding2>draft</PathOfBuilding2>');
    fs.writeFileSync(path.join(builds, 'Royal Fury Rake (draft).xml'), bytes);
    const invalidated: string[] = [];
    const result = await writer(nodeWriterFs, invalidated).deleteBuildFile({ name: 'Royal Fury Rake (draft)', sha1: sha1(bytes) });
    expect(result.path).toBe('Royal Fury Rake (draft).xml');
    expect(result.bytes).toBe(bytes.length);
    expect(fs.existsSync(path.join(builds, 'Royal Fury Rake (draft).xml'))).toBe(false);
    expect(path.dirname(result.backupPath)).toBe(backupDir('Royal Fury Rake (draft).xml'));
    expect(path.basename(result.backupPath)).toBe('2026-10-30T12-00-00-000Z_before-delete.xml');
    expect(fs.readFileSync(result.backupPath).equals(bytes)).toBe(true);
    expect(invalidated).toEqual(['Royal Fury Rake (draft).xml']);
  });

  it('a file whose bytes no longer match the sha1 given is refused: nothing deleted, no backup', async () => {
    const target = path.join(builds, 'mine (draft).xml');
    fs.writeFileSync(target, 'saved in PoB2');
    const error = await writer().deleteBuildFile({ name: 'mine (draft).xml', sha1: sha1('as written') }).catch((e) => e);
    expect(error).toBeInstanceOf(BuildFileWriteError);
    expect((error as Error).message).toContain('mine (draft).xml changed on disk');
    expect(fs.readFileSync(target, 'utf8')).toBe('saved in PoB2');
    expect(fs.existsSync(backupDir('mine (draft).xml'))).toBe(false);
  });

  it("a file changed since this writer wrote it is refused by C-17's guard, with no sha1 given", async () => {
    const w = writer();
    await w.writeBuildFile({ name: 'guarded (draft)', bytes: 'v1', kind: 'bytes' });
    fs.writeFileSync(path.join(builds, 'guarded (draft).xml'), 'v2, saved in PoB2');
    const error = await w.deleteBuildFile({ name: 'guarded (draft)' }).catch((e) => e);
    expect(error).toBeInstanceOf(BuildFileWriteError);
    expect((error as Error).message).toContain('changed on disk');
    expect(fs.readFileSync(path.join(builds, 'guarded (draft).xml'), 'utf8')).toBe('v2, saved in PoB2');
  });

  it('a missing file is refused', async () => {
    const error = await writer().deleteBuildFile({ name: 'gone (draft)' }).catch((e) => e);
    expect(error).toBeInstanceOf(BuildFileWriteError);
    expect((error as Error).message).toContain("gone (draft).xml doesn't exist");
  });

  it('a failed backup leaves the file in place', async () => {
    fs.writeFileSync(path.join(builds, 'kept (draft).xml'), 'draft');
    const failing: WriterFs = {
      ...nodeWriterFs,
      copyFileExclusive: async () => {
        throw Object.assign(new Error('EACCES: permission denied'), { code: 'EACCES' });
      },
    };
    const error = await writer(failing).deleteBuildFile({ name: 'kept (draft)', sha1: sha1('draft') }).catch((e) => e);
    expect(error).toBeInstanceOf(BuildFileWriteError);
    expect((error as Error).message).toContain('could not back up kept (draft).xml before deleting it');
    expect(fs.readFileSync(path.join(builds, 'kept (draft).xml'), 'utf8')).toBe('draft');
  });

  it("after a delete, the writer has forgotten the file: a new write of the name is a plain new file", async () => {
    const w = writer();
    await w.writeBuildFile({ name: 'again (draft)', bytes: 'one', kind: 'bytes' });
    await w.deleteBuildFile({ name: 'again (draft)', sha1: sha1('one') });
    const second = await w.writeBuildFile({ name: 'again (draft)', bytes: 'two', kind: 'bytes' });
    expect(second.replaced).toBe(false);
    expect(second.notices).toEqual([]);
    expect(fs.readFileSync(path.join(builds, 'again (draft).xml'), 'utf8')).toBe('two');
  });
});
