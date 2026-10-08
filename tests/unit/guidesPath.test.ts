/**
 * WU-37: the guides root (C-34), with real temp dirs.
 *
 * - AC-P4 / AC-B6: Jest's globalSetup points POB_GUIDES_DIRECTORY at a fresh temp dir, `spawnServerEnv`
 *   passes it explicitly, `startTestServer` takes it through `entryDefaults`, `startSessionFixture` uses
 *   its own `<tmp>/guides`, no test's guides path is under /mnt/, and only `src/index.ts` reads the
 *   variable.
 * - AC-P5 (R-30): `resolveInGuidesRoot` keeps a path inside the root, symlinks resolved.
 * - AC-P6: `createRunFolder` numbers run folders per slug and date, and refuses unsafe slugs.
 * - AC-P48 (unit part, WU-41, D-220): `checkGuidesRoot` refuses a root that equals, is inside, contains or links
 *   into the builds folder, naming both paths and their variables; `runFolderOf` (D-211) is a plan's run folder.
 */
import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import fs from 'fs';
import fsPromises from 'fs/promises';
import os from 'os';
import path from 'path';

import { checkGuidesRoot, createRunFolder, GuidesPathError, resolveInGuidesRoot, runFolderOf } from '../../src/utils/guidesPath';
import { spawnServerEnv } from '../helpers/spawnServer';
import { startTestServer } from '../helpers/server';
import { startSessionFixture } from '../helpers/engineSession';

const SRC = path.resolve(__dirname, '..', '..', 'src');
const TESTS = path.resolve(__dirname, '..');

function walk(dir: string, skip: Set<string> = new Set()): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return skip.has(e.name) ? [] : walk(p, skip);
    return /\.(ts|js|cjs|mjs)$/.test(e.name) ? [p] : [];
  });
}

/** The real path of `p`, or of its nearest existing ancestor (a guides root may not exist yet). */
function realOrAncestor(p: string): string {
  let current = p;
  while (!fs.existsSync(current)) current = path.dirname(current);
  return fs.realpathSync(current);
}

function expectNotUnderMnt(p: string): void {
  expect(p.startsWith('/mnt/')).toBe(false);
  expect(realOrAncestor(p).startsWith('/mnt/')).toBe(false);
}

/** Await `promise`, expecting a GuidesPathError whose message names every one of `parts`. */
async function expectRefusal(promise: Promise<unknown>, parts: string[]): Promise<void> {
  const error = await promise.then(
    () => null,
    (e: unknown) => e,
  );
  expect(error).toBeInstanceOf(GuidesPathError);
  for (const part of parts) expect((error as Error).message).toContain(part);
}

let tmp: string;
beforeEach(() => {
  tmp = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'pob2-mcp-guides-unit-')));
});
afterEach(() => {
  jest.restoreAllMocks();
  fs.rmSync(tmp, { recursive: true, force: true });
});

describe('the Jest guides redirect (C-18, AC-B6)', () => {
  it('AC-P4: POB_GUIDES_DIRECTORY is an existing temp dir named pob2-mcp-test-guides-*, not under /mnt/', () => {
    const dir = process.env.POB_GUIDES_DIRECTORY!;
    expect(dir).toBeTruthy();
    expect(fs.statSync(dir).isDirectory()).toBe(true);
    expect(path.dirname(dir)).toBe(path.resolve(os.tmpdir()));
    expect(path.basename(dir)).toMatch(/^pob2-mcp-test-guides-/);
    expectNotUnderMnt(dir);
  });

  it('AC-P4: spawnServerEnv passes POB_GUIDES_DIRECTORY explicitly, equal to the globalSetup dir', () => {
    expect(spawnServerEnv().POB_GUIDES_DIRECTORY).toBe(process.env.POB_GUIDES_DIRECTORY);
    expectNotUnderMnt(spawnServerEnv().POB_GUIDES_DIRECTORY);
    const source = fs.readFileSync(path.join(TESTS, 'helpers', 'spawnServer.ts'), 'utf8');
    expect(source).toContain('POB_GUIDES_DIRECTORY: process.env.POB_GUIDES_DIRECTORY,');
  });

  it('AC-P4: startTestServer().deps.guidesDirectory equals the globalSetup dir', async () => {
    const server = await startTestServer();
    try {
      expect(server.deps.guidesDirectory).toBe(process.env.POB_GUIDES_DIRECTORY);
      expectNotUnderMnt(server.deps.guidesDirectory);
    } finally {
      await server.close();
    }
  });

  it('AC-P4: startSessionFixture() uses its own <tmp>/guides in deps and env', async () => {
    const fixture = await startSessionFixture();
    try {
      const guides = path.join(fixture.tmp, 'guides');
      expect(fixture.guides).toBe(guides);
      expect(fixture.server.deps.guidesDirectory).toBe(guides);
      expect(fixture.server.deps.env.POB_GUIDES_DIRECTORY).toBe(guides);
      expect(guides).not.toBe(process.env.POB_GUIDES_DIRECTORY);
      expectNotUnderMnt(guides);
    } finally {
      await fixture.close();
    }
  });

  it('AC-P4: no test sets a guides path under /mnt/ (no line naming the guides folder holds a /mnt/ literal)', () => {
    const mntLiteral = new RegExp(`["'\`]/mnt/`);
    const guidesWord = /POB_GUIDES_DIRECTORY|guidesDirectory|[Gg]uides/;
    const hits = walk(TESTS, new Set(['fixtures'])).flatMap((file) =>
      fs
        .readFileSync(file, 'utf8')
        .split('\n')
        .map((line, i) => ({ line, at: `${path.relative(TESTS, file)}:${i + 1}` }))
        .filter(({ line }) => guidesWord.test(line) && mntLiteral.test(line))
        .map(({ at }) => at),
    );
    expect(hits).toEqual([]);
  });

  it('AC-B6: only src/index.ts reads POB_GUIDES_DIRECTORY', () => {
    const reads = /\.POB_GUIDES_DIRECTORY\b|\[\s*["'`]POB_GUIDES_DIRECTORY["'`]\s*\]|\{[^}]*\bPOB_GUIDES_DIRECTORY\b[^}]*\}\s*=/;
    const hits = walk(SRC)
      .filter((f) => reads.test(fs.readFileSync(f, 'utf8')))
      .map((f) => path.relative(SRC, f).split(path.sep).join('/'));
    expect(hits).toEqual(['index.ts']);
  });
});

describe('resolveInGuidesRoot (C-34, R-30)', () => {
  let root: string;
  let outside: string;
  beforeEach(() => {
    root = path.join(tmp, 'Guides');
    outside = path.join(tmp, 'elsewhere');
    fs.mkdirSync(path.join(root, 'a', 'b'), { recursive: true });
    fs.writeFileSync(path.join(root, 'a', 'b', 'plan.json'), '{}');
    fs.mkdirSync(outside);
    fs.writeFileSync(path.join(outside, 'plan.json'), '{}');
  });

  it('AC-P5: accepts a/b/plan.json, returning its real path inside the root', async () => {
    await expect(resolveInGuidesRoot(root, 'a/b/plan.json')).resolves.toBe(path.join(root, 'a', 'b', 'plan.json'));
    // A path that doesn't exist yet resolves through its deepest existing ancestor.
    await expect(resolveInGuidesRoot(root, 'a/new/plan.json')).resolves.toBe(path.join(root, 'a', 'new', 'plan.json'));
  });

  it('AC-P5: accepts a symlink inside the root that points inside it', async () => {
    fs.symlinkSync(path.join(root, 'a'), path.join(root, 'alias'));
    fs.symlinkSync(path.join(root, 'a', 'b', 'plan.json'), path.join(root, 'plan-link.json'));
    await expect(resolveInGuidesRoot(root, 'alias/b/plan.json')).resolves.toBe(path.join(root, 'a', 'b', 'plan.json'));
    await expect(resolveInGuidesRoot(root, 'plan-link.json')).resolves.toBe(path.join(root, 'a', 'b', 'plan.json'));
  });

  it("AC-P5: a root that is itself a symlink is compared by its real path", async () => {
    const rootLink = path.join(tmp, 'guides-link');
    fs.symlinkSync(root, rootLink);
    await expect(resolveInGuidesRoot(rootLink, 'a/b/plan.json')).resolves.toBe(path.join(root, 'a', 'b', 'plan.json'));
  });

  it.each([
    ['empty', '', 'is empty'],
    ['a NUL byte', 'a\0b', 'NUL byte'],
    ['absolute', '/etc/x', 'is absolute'],
    ['a leading ..', '../x/plan.json', '".." segment'],
    ['.. under /', 'a/../../x', '".." segment'],
    ['.. under \\', 'a\\..\\..\\x', '".." segment'],
  ])('AC-P5: rejects %s (%j), naming the argument and the root', async (_why, rel, reason) => {
    await expectRefusal(resolveInGuidesRoot(root, rel, 'plan_path'), ['plan_path', JSON.stringify(rel), root, reason]);
  });

  it('AC-P5: a ".." segment or an absolute path is refused by rule, even when it would land inside the root', async () => {
    await expectRefusal(resolveInGuidesRoot(root, 'a/../a/b/plan.json'), ['".." segment', root]);
    await expectRefusal(resolveInGuidesRoot(root, 'a\\..\\a'), ['".." segment', root]);
    await expectRefusal(resolveInGuidesRoot(root, path.join(root, 'a', 'b', 'plan.json')), ['is absolute', root]);
  });

  it('AC-P5: without a name, the argument is called "path"', async () => {
    await expectRefusal(resolveInGuidesRoot(root, ''), ['path "" is empty', root]);
  });

  it('AC-P5: rejects a file symlink that points outside the root', async () => {
    fs.symlinkSync(path.join(outside, 'plan.json'), path.join(root, 'plan.json'));
    await expectRefusal(resolveInGuidesRoot(root, 'plan.json', 'plan_path'), [
      'plan_path',
      '"plan.json"',
      root,
      outside,
      'outside the guides root',
    ]);
  });

  it('AC-P5: rejects link/plan.json where link is a directory symlink pointing outside the root', async () => {
    fs.symlinkSync(outside, path.join(root, 'link'));
    await expectRefusal(resolveInGuidesRoot(root, 'link/plan.json', 'plan_path'), [
      'plan_path',
      '"link/plan.json"',
      root,
      outside,
    ]);
    // Also when the file under the link doesn't exist yet: a write there would still land outside.
    await expectRefusal(resolveInGuidesRoot(root, 'link/new/plan.json'), ['path', '"link/new/plan.json"', root]);
  });

  it('AC-P5: rejects a dangling symlink whose target is outside the root (a write through it would land outside)', async () => {
    fs.symlinkSync(path.join(outside, 'not-yet.json'), path.join(root, 'dangling.json'));
    fs.symlinkSync(path.join(outside, 'not-yet-dir'), path.join(root, 'dangling-dir'));
    await expectRefusal(resolveInGuidesRoot(root, 'dangling.json'), ['"dangling.json"', root]);
    await expectRefusal(resolveInGuidesRoot(root, 'dangling-dir/plan.json'), ['"dangling-dir/plan.json"', root]);
    expect(fs.readdirSync(outside)).toEqual(['plan.json']);
  });

  it('AC-P5: a Windows-form absolute path is refused too', async () => {
    await expectRefusal(resolveInGuidesRoot(root, 'C:\\x\\plan.json'), ['"C:\\\\x\\\\plan.json"', root]);
  });
});

describe('createRunFolder (C-34, D-153, A-P7)', () => {
  const DATE = new Date(2026, 9, 7, 12, 0, 0); // 2026-10-07, local time
  let root: string;
  beforeEach(() => {
    root = path.join(tmp, 'Guides');
  });

  it('AC-P6: on an empty root it creates and returns titan-blood-hunt/2026-10-07-1', async () => {
    fs.mkdirSync(root);
    const run = await createRunFolder(root, 'titan-blood-hunt', DATE);
    expect(run).toEqual({
      relPath: 'titan-blood-hunt/2026-10-07-1',
      absPath: path.join(root, 'titan-blood-hunt', '2026-10-07-1'),
    });
    expect(fs.statSync(run.absPath).isDirectory()).toBe(true);
    expect(fs.readdirSync(path.join(root, 'titan-blood-hunt'))).toEqual(['2026-10-07-1']);
  });

  it('AC-P6: a missing root is created (mkdir -p), then the first run folder', async () => {
    const deep = path.join(tmp, 'not', 'yet', 'Guides');
    const run = await createRunFolder(deep, 'titan-blood-hunt', DATE);
    expect(run.relPath).toBe('titan-blood-hunt/2026-10-07-1');
    expect(fs.statSync(path.join(deep, 'titan-blood-hunt', '2026-10-07-1')).isDirectory()).toBe(true);
  });

  it('AC-P6: a second call returns -2', async () => {
    await createRunFolder(root, 'titan-blood-hunt', DATE);
    const second = await createRunFolder(root, 'titan-blood-hunt', DATE);
    expect(second.relPath).toBe('titan-blood-hunt/2026-10-07-2');
    expect(fs.readdirSync(path.join(root, 'titan-blood-hunt')).sort()).toEqual(['2026-10-07-1', '2026-10-07-2']);
  });

  it('AC-P6: with -1 and -3 present, the next is -4', async () => {
    fs.mkdirSync(path.join(root, 'titan-blood-hunt', '2026-10-07-1'), { recursive: true });
    fs.mkdirSync(path.join(root, 'titan-blood-hunt', '2026-10-07-3'));
    const run = await createRunFolder(root, 'titan-blood-hunt', DATE);
    expect(run.relPath).toBe('titan-blood-hunt/2026-10-07-4');
  });

  it('AC-P6: another date starts again at -1', async () => {
    await createRunFolder(root, 'titan-blood-hunt', DATE);
    await createRunFolder(root, 'titan-blood-hunt', DATE);
    const next = await createRunFolder(root, 'titan-blood-hunt', new Date(2026, 9, 8, 12, 0, 0));
    expect(next.relPath).toBe('titan-blood-hunt/2026-10-08-1');
  });

  it('AC-P6: a run folder taken by a concurrent creator (EEXIST) moves on to the next n', async () => {
    const realMkdir = fsPromises.mkdir.bind(fsPromises);
    const raced = path.join(root, 'titan-blood-hunt', '2026-10-07-1');
    jest.spyOn(fsPromises, 'mkdir').mockImplementation((async (p: fs.PathLike, opts?: fs.MakeDirectoryOptions) => {
      // Another creator makes -1 between the listing and this mkdir.
      if (String(p) === raced && !fs.existsSync(raced)) fs.mkdirSync(raced);
      return realMkdir(p, opts);
    }) as unknown as typeof fsPromises.mkdir);
    const run = await createRunFolder(root, 'titan-blood-hunt', DATE);
    expect(run.relPath).toBe('titan-blood-hunt/2026-10-07-2');
  });

  it.each([
    ['empty', ''],
    ['uppercase', 'Titan'],
    ['a separator', 'a/b'],
    ['..', '..'],
    ['a double hyphen', 'a--b'],
    ['a leading hyphen', '-a'],
    ['65 characters', 'a'.repeat(65)],
  ])('AC-P6: the slug %s (%j) is rejected, creating nothing', async (_why, slug) => {
    await expectRefusal(createRunFolder(root, slug, DATE), ['slug', JSON.stringify(slug), root]);
    expect(fs.existsSync(root)).toBe(false);
    expect(fs.readdirSync(tmp)).toEqual([]);
  });

  it.each([
    ['an invalid date', new Date(NaN), 'Invalid Date'],
    ['a five-digit year', new Date(10000, 0, 1, 12), '10000'],
  ])('AC-P6: %s is refused, naming the date and the root, creating nothing', async (_why, date, shownDate) => {
    await expectRefusal(createRunFolder(root, 'titan-blood-hunt', date), ['date', shownDate, root]);
    expect(fs.existsSync(root)).toBe(false);
    expect(fs.readdirSync(tmp)).toEqual([]);
  });

  it('AC-P6: a 64-character slug is accepted', async () => {
    const slug = 'a'.repeat(64);
    await expect(createRunFolder(root, slug, DATE)).resolves.toEqual({
      relPath: `${slug}/2026-10-07-1`,
      absPath: path.join(root, slug, '2026-10-07-1'),
    });
  });

  it('AC-P6: <root>/<slug> as a symlink to a folder outside is rejected, creating nothing outside', async () => {
    const outside = path.join(tmp, 'elsewhere');
    fs.mkdirSync(outside);
    fs.mkdirSync(root);
    fs.symlinkSync(outside, path.join(root, 'titan-blood-hunt'));
    await expectRefusal(createRunFolder(root, 'titan-blood-hunt', DATE), ['"titan-blood-hunt"', root, outside]);
    expect(fs.readdirSync(outside)).toEqual([]);
    expect(fs.readdirSync(root)).toEqual(['titan-blood-hunt']);
  });

  it('AC-P6: <root>/<slug> as a dangling symlink to outside is rejected, creating nothing outside', async () => {
    const outside = path.join(tmp, 'elsewhere');
    fs.mkdirSync(outside);
    fs.mkdirSync(root);
    fs.symlinkSync(path.join(outside, 'later'), path.join(root, 'titan-blood-hunt'));
    await expectRefusal(createRunFolder(root, 'titan-blood-hunt', DATE), ['"titan-blood-hunt"', root]);
    expect(fs.readdirSync(outside)).toEqual([]);
  });
});

describe('checkGuidesRoot (D-220) and runFolderOf (D-211)', () => {
  let tmp: string;
  let builds: string;

  beforeEach(() => {
    tmp = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'pob2-guides-root-')));
    builds = path.join(tmp, 'PoB', 'Builds');
    fs.mkdirSync(builds, { recursive: true });
  });
  afterEach(() => fs.rmSync(tmp, { recursive: true, force: true }));

  async function refusal(root: string): Promise<string> {
    try {
      await checkGuidesRoot(root, builds);
    } catch (error) {
      expect(error).toBeInstanceOf(GuidesPathError);
      return (error as Error).message;
    }
    throw new Error(`checkGuidesRoot accepted ${root}`);
  }

  it('AC-P48: the builds folder itself, a folder inside it, its parent and a symlink into it are refused, naming both paths and variables', async () => {
    fs.mkdirSync(path.join(builds, 'inner'));
    fs.symlinkSync(path.join(builds, 'inner'), path.join(tmp, 'link'));
    const cases: Array<[string, string]> = [
      [builds, 'is the builds folder itself'],
      [path.join(builds, 'Guides'), 'is inside the builds folder'],
      [path.dirname(builds), 'contains the builds folder'],
      [path.join(tmp, 'link'), 'is inside the builds folder'],
      [path.join(tmp, 'link', 'not-yet'), 'is inside the builds folder'],
    ];
    for (const [root, how] of cases) {
      const message = await refusal(root);
      expect({ root, message }).toEqual({ root, message: expect.stringContaining(how) });
      for (const part of [root, builds, 'POB_GUIDES_DIRECTORY', 'POB_DIRECTORY']) expect(message).toContain(part);
    }
  });

  it('AC-P48: a sibling root and a root elsewhere are accepted, existing or not', async () => {
    await expect(checkGuidesRoot(path.join(tmp, 'PoB', 'Guides'), builds)).resolves.toBeUndefined();
    await expect(checkGuidesRoot(path.join(tmp, 'elsewhere', 'guides'), builds)).resolves.toBeUndefined();
    // A name that only shares a prefix with the builds folder is not inside it.
    await expect(checkGuidesRoot(`${builds}-guides`, builds)).resolves.toBeUndefined();
  });

  it('D-211: runFolderOf is the first two segments of a plan path, or null outside a run folder', () => {
    expect(runFolderOf('titan-blood-hunt/2026-10-07-1/plan.json')).toBe('titan-blood-hunt/2026-10-07-1');
    expect(runFolderOf('titan-blood-hunt/2026-10-07-1/concepts/a/plan.json')).toBe('titan-blood-hunt/2026-10-07-1');
    expect(runFolderOf('titan-blood-hunt\\2026-10-07-1\\plan.json')).toBe('titan-blood-hunt/2026-10-07-1');
    expect(runFolderOf('./titan/run/plan.json')).toBe('titan/run');
    expect(runFolderOf('titan/plan.json')).toBeNull();
    expect(runFolderOf('plan.json')).toBeNull();
  });
});
