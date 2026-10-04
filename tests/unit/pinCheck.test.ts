import { describe, it, expect, afterAll } from '@jest/globals';
import crypto from 'crypto';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { checkPin, readPin, type PobPin } from '../../src/engine/pinCheck';

const REPO = path.resolve(__dirname, '..', '..');
const VENDOR_SRC = path.join(REPO, 'vendor', 'PathOfBuilding-PoE2', 'src');

/** Independent reference implementation of PoB's update_manifest.py:104-108 hashing. */
function manifestHash(buf: Buffer): string {
  const data = buf.includes(0)
    ? buf
    : Buffer.from(buf.toString('latin1').replace(/\r\n?|\n/g, '\r\n'), 'latin1');
  return crypto.createHash('sha1').update(data).digest('hex');
}
function rawHash(buf: Buffer): string {
  return crypto.createHash('sha1').update(buf).digest('hex');
}

const COMMIT = '1111111111111111111111111111111111111111';
const WRAPPER = Buffer.from('-- headless wrapper\nlocal x = 1\nreturn x\n');
const PIN: PobPin = {
  repo: 'https://example.invalid/pob.git',
  tag: 'v9.9.9',
  commit: COMMIT,
  version: '9.9.9',
  headlessWrapperSha1: manifestHash(WRAPPER),
};

interface TreeFile {
  name: string; // manifest name ({space} allowed)
  part: string;
  content: Buffer;
  /** sha1 written into the manifest; defaults to the correct manifest hash. */
  sha1?: string;
  /** listed in the manifest but not written to disk */
  absent?: boolean;
}

const tmpRoots: string[] = [];

/** Build a tiny synthetic checkout: manifest.xml + files + src/HeadlessWrapper.lua + .git/HEAD. Returns its src/. */
function makeTree(opts: {
  version?: string;
  head?: string | null;
  wrapper?: Buffer;
  files?: TreeFile[];
  mutate?: (root: string) => void;
} = {}): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'pincheck-'));
  tmpRoots.push(root);
  const files: TreeFile[] = opts.files ?? defaultFiles();
  const partRoot = (part: string) =>
    part === 'default' ? root : part === 'runtime' ? path.join(root, 'runtime') : path.join(root, 'src');
  const entries = files.map((f) => {
    if (!f.absent) {
      const file = path.join(partRoot(f.part), f.name.replace(/\{space\}/g, ' '));
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, f.content);
    }
    return `\t<File name="${f.name}" part="${f.part}" sha1="${f.sha1 ?? manifestHash(f.content)}" />`;
  });
  fs.writeFileSync(
    path.join(root, 'manifest.xml'),
    `<?xml version='1.0' encoding='UTF-8'?>\n<PoBVersion>\n\t<Version number="${opts.version ?? PIN.version}" />\n${entries.join('\n')}\n</PoBVersion>\n`,
  );
  fs.mkdirSync(path.join(root, 'src'), { recursive: true });
  fs.writeFileSync(path.join(root, 'src', 'HeadlessWrapper.lua'), opts.wrapper ?? WRAPPER);
  const head = opts.head === undefined ? `${COMMIT}\n` : opts.head;
  if (head !== null) {
    fs.mkdirSync(path.join(root, '.git'), { recursive: true });
    fs.writeFileSync(path.join(root, '.git', 'HEAD'), head);
  }
  opts.mutate?.(root);
  return path.join(root, 'src');
}

function defaultFiles(): TreeFile[] {
  return [
    { name: 'changelog.txt', part: 'default', content: Buffer.from('v9.9.9\nchanges\n') },
    { name: 'Modules/CalcDefence.lua', part: 'program', content: Buffer.from('local calcs = {}\nreturn calcs\n') },
    { name: 'Modules/Common.lua', part: 'program', content: Buffer.from('function new() end\n') },
    { name: 'TreeData/0_5/tree.json', part: 'tree', content: Buffer.from('{"nodes":{}}') },
    { name: 'lua/xml.lua', part: 'runtime', content: Buffer.from('return {}\n') },
    { name: 'Path{space}of{space}Building.txt', part: 'default', content: Buffer.from('spaced name\n') },
  ];
}

function changeByte(file: string) {
  const buf = fs.readFileSync(file);
  buf[0] = buf[0] ^ 0x01;
  fs.writeFileSync(file, buf);
}

afterAll(() => {
  for (const r of tmpRoots) fs.rmSync(r, { recursive: true, force: true });
});

describe('checkPin (C-6, AC-F3)', () => {
  // Runs first, so the real checkout is not yet memoized and the timing covers a full check.
  it('AC-F3 (a): the real vendor/ checkout is ok in <= 1 s (NFR-2)', async () => {
    if (!fs.existsSync(path.join(VENDOR_SRC, 'HeadlessWrapper.lua'))) {
      throw new Error(`${VENDOR_SRC} is missing: run \`mise run pob:fetch\``);
    }
    const t0 = performance.now();
    const res = await checkPin({ pobSrc: VENDOR_SRC, pin: readPin(REPO), allowUnpinned: false });
    const elapsed = performance.now() - t0;
    expect(res).toEqual({ ok: true, warnings: [] });
    expect(elapsed).toBeLessThanOrEqual(1000);
  });

  it('AC-F3 baseline: an unmodified synthetic tree is ok', async () => {
    expect(await checkPin({ pobSrc: makeTree(), pin: PIN, allowUnpinned: false })).toEqual({ ok: true, warnings: [] });
  });

  it('AC-F3 (b): one changed byte in src/Modules/CalcDefence.lua is refused, naming the file', async () => {
    const src = makeTree({ mutate: (root) => changeByte(path.join(root, 'src', 'Modules', 'CalcDefence.lua')) });
    const res = await checkPin({ pobSrc: src, pin: PIN, allowUnpinned: false });
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.reason).toContain('Modules/CalcDefence.lua');
    expect(res.hint).toBe('run `mise run pob:fetch`');
  });

  it('AC-F3 (c): .git/HEAD != pin commit is refused', async () => {
    const res = await checkPin({ pobSrc: makeTree({ head: `${'2'.repeat(40)}\n` }), pin: PIN, allowUnpinned: false });
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.reason).toContain('2'.repeat(40));
    expect(res.hint).toContain('mise run pob:fetch');
  });

  it('AC-F3 (d): .git/HEAD = "ref: refs/heads/dev" is refused as not a pinned detached checkout', async () => {
    const res = await checkPin({ pobSrc: makeTree({ head: 'ref: refs/heads/dev\n' }), pin: PIN, allowUnpinned: false });
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.reason).toContain('not a pinned detached checkout');
  });

  it('AC-F3 (e): manifest version 0.23.2 is refused', async () => {
    const pin = { ...PIN, version: '0.23.1' };
    const res = await checkPin({ pobSrc: makeTree({ version: '0.23.2' }), pin, allowUnpinned: false });
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.reason).toContain('0.23.2');
  });

  it('AC-F3 (f): a changed HeadlessWrapper.lua is refused', async () => {
    const res = await checkPin({ pobSrc: makeTree({ wrapper: Buffer.from('-- patched wrapper\n') }), pin: PIN, allowUnpinned: false });
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.reason).toContain('HeadlessWrapper.lua');
  });

  it('AC-F3 (g): case (b) with allowUnpinned is ok, and warnings name the file', async () => {
    const src = makeTree({ mutate: (root) => changeByte(path.join(root, 'src', 'Modules', 'CalcDefence.lua')) });
    const res = await checkPin({ pobSrc: src, pin: PIN, allowUnpinned: true });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.warnings.some((w) => w.includes('Modules/CalcDefence.lua'))).toBe(true);
  });

  it('AC-F3 (h): a file listed in the manifest but absent on disk is skipped', async () => {
    const files = [...defaultFiles(), { name: 'Assets/missing.png', part: 'program', content: Buffer.from('x'), absent: true }];
    expect(await checkPin({ pobSrc: makeTree({ files }), pin: PIN, allowUnpinned: false })).toEqual({ ok: true, warnings: [] });
  });

  it('AC-F3 (i): a file with CRLF line endings whose CRLF hash matches is ok', async () => {
    const crlf = Buffer.from('line one\r\nline two\r\n');
    const files = [...defaultFiles(), { name: 'Modules/Crlf.lua', part: 'program', content: crlf }];
    // The manifest hash of a CRLF file equals that of its LF twin (both normalize to CRLF).
    expect(manifestHash(crlf)).toBe(manifestHash(Buffer.from('line one\nline two\n')));
    expect(await checkPin({ pobSrc: makeTree({ files }), pin: PIN, allowUnpinned: false })).toEqual({ ok: true, warnings: [] });
  });

  it('AC-F3 (j): a file containing a NUL byte is hashed raw', async () => {
    const binary = Buffer.from([0x41, 0x0a, 0x00, 0x42, 0x0a]);
    const raw = rawHash(binary);
    const normalized = crypto.createHash('sha1').update(Buffer.from([0x41, 0x0d, 0x0a, 0x00, 0x42, 0x0d, 0x0a])).digest('hex');
    expect(raw).not.toBe(normalized);
    const ok = [...defaultFiles(), { name: 'Assets/blob.bin', part: 'program', content: binary, sha1: raw }];
    expect(await checkPin({ pobSrc: makeTree({ files: ok }), pin: PIN, allowUnpinned: false })).toEqual({ ok: true, warnings: [] });
    const wrong = [...defaultFiles(), { name: 'Assets/blob.bin', part: 'program', content: binary, sha1: normalized }];
    const res = await checkPin({ pobSrc: makeTree({ files: wrong }), pin: PIN, allowUnpinned: false });
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.reason).toContain('Assets/blob.bin');
  });

  it('AC-F3 (k): a refused tree that is then fixed is ok on the next call (failures are not memoized)', async () => {
    const src = makeTree();
    const target = path.join(src, 'Modules', 'CalcDefence.lua');
    const original = fs.readFileSync(target);
    changeByte(target);
    const first = await checkPin({ pobSrc: src, pin: PIN, allowUnpinned: false });
    expect(first.ok).toBe(false);
    fs.writeFileSync(target, original);
    expect(await checkPin({ pobSrc: src, pin: PIN, allowUnpinned: false })).toEqual({ ok: true, warnings: [] });
  });

  it('AC-F3: part roots - default/runtime files are checked under the checkout root and runtime/', async () => {
    for (const rel of ['changelog.txt', path.join('runtime', 'lua', 'xml.lua'), 'Path of Building.txt']) {
      const src = makeTree({ mutate: (root) => changeByte(path.join(root, rel)) });
      const res = await checkPin({ pobSrc: src, pin: PIN, allowUnpinned: false });
      expect(res.ok).toBe(false);
    }
  });

  it('AC-F3: a missing checkout is refused with the fetch hint', async () => {
    const res = await checkPin({ pobSrc: path.join(os.tmpdir(), 'pincheck-does-not-exist', 'src'), pin: PIN, allowUnpinned: false });
    expect(res).toMatchObject({ ok: false, hint: 'run `mise run pob:fetch`' });
  });
});
