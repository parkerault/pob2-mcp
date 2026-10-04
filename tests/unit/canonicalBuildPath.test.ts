/**
 * AC-E60 (D-52), unit part: `canonicalBuildPath` against an injected case-insensitive filesystem.
 * The fake's `readdir` returns on-disk casing, as drvfs does; a `stat` fake answers any casing, which
 * is why the resolution must come from `readdir`, never from `stat`/`realpath`.
 */
import { describe, it, expect } from '@jest/globals';
import path from 'path';
import { canonicalBuildPath, type CanonicalFs } from '../../src/utils/pathSanitizer';

const BASE = '/builds';

/** A case-insensitive tree: directory path (lower-cased) → entries in on-disk casing. */
function caseInsensitiveFs(tree: Record<string, string[]>): CanonicalFs & { stat(p: string): Promise<{ isFile(): boolean }> } {
  const dirs = new Map(Object.entries(tree).map(([dir, entries]) => [dir.toLowerCase(), entries]));
  return {
    async readdir(dir: string) {
      const entries = dirs.get(path.resolve(dir).toLowerCase());
      if (!entries) throw Object.assign(new Error(`ENOENT: ${dir}`), { code: 'ENOENT' });
      return [...entries];
    },
    // Like drvfs: any casing stats to the one file.
    async stat(p: string) {
      const dir = path.dirname(p).toLowerCase();
      const name = path.basename(p).toLowerCase();
      const entries = dirs.get(dir);
      if (!entries?.some((e) => e.toLowerCase() === name)) throw Object.assign(new Error('ENOENT'), { code: 'ENOENT' });
      return { isFile: () => true };
    },
  };
}

describe('AC-E60: canonicalBuildPath (D-52) on a case-insensitive filesystem', () => {
  const fs = caseInsensitiveFs({
    '/builds': ['Grenadator.xml', 'Sub', 'Twin.xml', 'twin.XML', 'exact.xml', 'EXACT.xml'],
    '/builds/sub': ['X.xml'],
  });

  it('AC-E60: "grenadator" resolves to the on-disk Grenadator.xml (stat alone would keep the caller casing)', async () => {
    await expect(fs.stat('/builds/grenadator.xml')).resolves.toBeDefined();
    await expect(canonicalBuildPath('grenadator', BASE, fs)).resolves.toBe('Grenadator.xml');
    await expect(canonicalBuildPath('GRENADATOR.XML', BASE, fs)).resolves.toBe('Grenadator.xml');
  });

  it('AC-E60: sub/x.xml resolves both segments', async () => {
    await expect(canonicalBuildPath('sub/x.xml', BASE, fs)).resolves.toBe('Sub/X.xml');
    await expect(canonicalBuildPath('SUB\\x', BASE, fs)).resolves.toBe('Sub/X.xml');
  });

  it('AC-E60: a new name keeps the caller spelling (also below a new folder)', async () => {
    await expect(canonicalBuildPath('NewBuild', BASE, fs)).resolves.toBe('NewBuild.xml');
    await expect(canonicalBuildPath('sub/Fresh.xml', BASE, fs)).resolves.toBe('Sub/Fresh.xml');
    await expect(canonicalBuildPath('NewDir/Deep/B', BASE, fs)).resolves.toBe('NewDir/Deep/B.xml');
  });

  it('AC-E60: two case-insensitive matches and no exact one is "ambiguous build name"; an exact match wins', async () => {
    await expect(canonicalBuildPath('TWIN.xml', BASE, fs)).rejects.toThrow('ambiguous build name');
    await expect(canonicalBuildPath('exact.xml', BASE, fs)).resolves.toBe('exact.xml');
    await expect(canonicalBuildPath('EXACT.xml', BASE, fs)).resolves.toBe('EXACT.xml');
  });

  it('refuses traversal and absolute names before touching the filesystem', async () => {
    await expect(canonicalBuildPath('../etc/passwd', BASE, fs)).rejects.toThrow(/traversal/);
    await expect(canonicalBuildPath('/etc/passwd', BASE, fs)).rejects.toThrow(/relative/);
  });
});
