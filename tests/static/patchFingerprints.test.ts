/**
 * AC-W133's static half (WU-152, amendment 16 §5 and Appendix A.3, D-509, C-60): the bridge patches' entries and
 * fingerprints, no engine.
 *
 * Both patch modules, `pob-api/API/ParseFixes.lua` (data fixes) and `pob-api/API/Patches.lua` (function patches), list
 * per entry its PG id, the fingerprints of the PoB code it relies on and its retirement test. `scripts/patch-fingerprints.mjs`
 * reads them, cuts each fingerprint's lines from the PoB tree (a function to its unindented `end`, a data line, a line
 * range) and hashes them under PoB's manifest scheme; it fails naming the patch, the file and what changed. The engine
 * half (bootstrap applies them; an apply over a missing method refuses) is `tests/integration/patches.test.ts`.
 */
import { spawnSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { manifestSha1 } from '../../src/engine/pinCheck';

const REPO = path.resolve(__dirname, '..', '..');
const SCRIPT = path.join(REPO, 'scripts', 'patch-fingerprints.mjs');
const POB_SRC = path.join(REPO, 'vendor', 'PathOfBuilding-PoE2', 'src');
const MODULES = ['pob-api/API/ParseFixes.lua', 'pob-api/API/Patches.lua'];

/**
 * The entries laid out as stubs for the units that build them (WU-152's layout, amendment 16 §24). WU-153 and WU-154 built
 * PG-109's and PG-114's, so none is left; a unit that lays out a stub adds its PG id here, and deletes it when it builds it.
 */
const STUBS = new Set<string>([]);

interface Fingerprint {
  file: string;
  func?: string;
  line?: string;
  from?: string;
  to?: string;
  sha1: string;
  form: 'function' | 'line' | 'range' | null;
  at: [number, number] | null;
  actual: string | null;
  ok: boolean;
  problem: string | null;
}

interface Entry {
  module: string;
  pg: string;
  stub: boolean;
  fingerprints: Fingerprint[];
  test: { file?: string; case?: string } | null;
}

interface Result {
  src: string;
  entries: Entry[];
  failures: string[];
}

function run(args: string[]): { status: number | null; stdout: string; stderr: string } {
  const r = spawnSync(process.execPath, [SCRIPT, ...args], { cwd: os.tmpdir(), env: { PATH: '/usr/bin:/bin', LANG: 'C' }, encoding: 'utf8', timeout: 60000 });
  return { status: r.status, stdout: r.stdout, stderr: r.stderr };
}

function check(src?: string): { status: number | null; result: Result } {
  const r = run(['--json', ...(src ? ['--src', src] : [])]);
  expect({ stderr: r.stderr }).toEqual({ stderr: '' });
  return { status: r.status, result: JSON.parse(r.stdout) as Result };
}

let onPin: { status: number | null; result: Result };
beforeAll(() => {
  onPin = check();
});

describe('AC-W133 (WU-152): every patch entry has a PG id, fingerprints and its test (D-509, Appendix A.3)', () => {
  it('reads both modules: PG-103 in ParseFixes.lua; PG-106, PG-109 and PG-114 in Patches.lua', () => {
    const byModule = (m: string) => onPin.result.entries.filter((e) => e.module === m).map((e) => e.pg);
    expect(byModule(MODULES[0])).toEqual(['PG-103']);
    expect(byModule(MODULES[1])).toEqual(['PG-106', 'PG-109', 'PG-114']);
  });

  it('each entry has a PG id, at least one fingerprint of a known form with a sha1, and a test with a file and a case', () => {
    for (const e of onPin.result.entries) {
      expect({ pg: e.pg, id: /^PG-\d+$/.test(e.pg), fingerprints: e.fingerprints.length > 0 }).toEqual({ pg: e.pg, id: true, fingerprints: true });
      for (const fp of e.fingerprints) {
        expect({ pg: e.pg, file: fp.file, form: fp.form !== null, sha1: /^[0-9a-f]{40}$/.test(fp.sha1) })
          .toEqual({ pg: e.pg, file: fp.file, form: true, sha1: true });
      }
      expect({ pg: e.pg, file: typeof e.test?.file, case: typeof e.test?.case }).toEqual({ pg: e.pg, file: 'string', case: 'string' });
    }
  });

  it("each built entry's test is a case in its file whose title says to remove the entry; only the laid-out stubs aren't built", () => {
    expect(onPin.result.entries.filter((e) => e.stub).map((e) => e.pg)).toEqual([...STUBS]);
    for (const e of onPin.result.entries.filter((x) => !x.stub)) {
      const file = path.join(REPO, e.test!.file!);
      expect({ pg: e.pg, file: e.test!.file, exists: fs.existsSync(file) }).toEqual({ pg: e.pg, file: e.test!.file, exists: true });
      expect({ pg: e.pg, inFile: fs.readFileSync(file, 'utf8').includes(e.test!.case!) }).toEqual({ pg: e.pg, inFile: true });
      expect(e.test!.case).toContain(`remove ${e.pg}'s entry from ${e.module}`);
    }
  });

  it('the three fingerprint forms are in use: a function, a data line (PG-103) and a line range (PG-114)', () => {
    const forms = (pg: string) => onPin.result.entries.find((e) => e.pg === pg)!.fingerprints.map((fp) => fp.form);
    expect(forms('PG-103')).toEqual(['line']);
    expect(forms('PG-106')).toEqual(['function']);
    expect(forms('PG-114')).toEqual(['function', 'range']);
  });
});

describe('AC-W133 (WU-152): the fingerprints match the pin, and a changed line fails naming the patch and the file (D-509)', () => {
  const tmps: string[] = [];
  afterAll(() => {
    for (const t of tmps) fs.rmSync(t, { recursive: true, force: true });
  });

  it('on the pin every fingerprint matches, and each sha1 is manifestSha1 of the cut lines', () => {
    expect({ status: onPin.status, failures: onPin.result.failures }).toEqual({ status: 0, failures: [] });
    for (const e of onPin.result.entries) {
      for (const fp of e.fingerprints) {
        const lines = fs.readFileSync(path.join(POB_SRC, fp.file), 'utf8').split(/\r\n|\r|\n/);
        const [first, last] = fp.at!;
        const cut = lines.slice(first - 1, last);
        expect({ pg: e.pg, ok: fp.ok, sha1: manifestSha1(Buffer.from(`${cut.join('\n')}\n`)) })
          .toEqual({ pg: e.pg, ok: true, sha1: fp.sha1 });
        // The cut starts on the anchor and, for a function, ends on its unindented `end`.
        if (fp.form === 'function') expect([cut[0], cut[cut.length - 1]]).toEqual([fp.func, 'end']);
        if (fp.form === 'line') expect(cut).toHaveLength(1);
        if (fp.form === 'range') expect([cut[0].trim().startsWith(fp.from!), cut[cut.length - 1].trim().startsWith(fp.to!)]).toEqual([true, true]);
      }
    }
  });

  /** A temporary src tree holding a copy of every fingerprinted file, with `edit` applied to `file`. */
  function treeWith(file: string, edit: (text: string) => string): string {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'pob2-fingerprints-'));
    tmps.push(root);
    const files = new Set(onPin.result.entries.flatMap((e) => e.fingerprints.map((fp) => fp.file)));
    for (const f of files) {
      fs.mkdirSync(path.dirname(path.join(root, f)), { recursive: true });
      fs.copyFileSync(path.join(POB_SRC, f), path.join(root, f));
    }
    const target = path.join(root, file);
    const before = fs.readFileSync(target, 'utf8');
    const after = edit(before);
    expect(after).not.toBe(before);
    fs.writeFileSync(target, after);
    return root;
  }

  it.each([
    {
      what: "a line changed inside PG-106's function",
      pg: 'PG-106',
      file: 'Classes/SkillsTab.lua',
      edit: (t: string) => t.replace('\tlocal countSocketGroups = 0\n', '\tlocal countSocketGroups = 1\n'),
      says: 'the code changed',
    },
    {
      what: "PG-103's data line changed",
      pg: 'PG-103',
      file: 'Data/ModCache.lua',
      edit: (t: string) => t.replace('c["100% increased Effect of bonuses gained from Socketed Jewel"]={{[1]={flags=0,keywordFlags=0,name="LocalEffect"', 'c["100% increased Effect of bonuses gained from Socketed Jewel"]={{[1]={flags=0,keywordFlags=0,name="SocketedJewelEffect"'),
      says: 'the code changed',
    },
    {
      what: "a line changed inside PG-114's range",
      pg: 'PG-114',
      file: 'Modules/CalcSetup.lua',
      edit: (t: string) => t.replace('\t\t\t\t\tquality = 0,\n', '\t\t\t\t\tquality = 1,\n'),
      says: 'the code changed',
    },
    {
      what: "PG-109's Save method renamed",
      pg: 'PG-109',
      file: 'Classes/ItemsTab.lua',
      edit: (t: string) => t.replace('function ItemsTabClass:Save(xml)\n', 'function ItemsTabClass:SaveItems(xml)\n'),
      says: 'is missing',
    },
  ])('with $what, it exits 1 naming $pg and $file, and only that fingerprint differs', ({ pg, file, edit, says }) => {
    const src = treeWith(file, edit);
    const { status, result } = check(src);
    expect(status).toBe(1);
    const bad = result.entries.flatMap((e) => e.fingerprints.filter((fp) => !fp.ok).map((fp) => ({ pg: e.pg, file: fp.file })));
    expect(bad).toEqual([{ pg, file }]);
    expect(result.failures).toHaveLength(1);
    expect(result.failures[0]).toMatch(new RegExp(`^${pg} \\(pob-api/API/\\w+\\.lua\\): ${file.replace('.', '\\.')}, `));
    expect(result.failures[0]).toContain(says);
    // The plain output names them too.
    const plain = run(['--src', src]);
    expect(plain.status).toBe(1);
    expect(plain.stdout).toContain(`${pg} (`);
    expect(plain.stdout).toContain(`): ${file}, `);
  });
});

describe('AC-W133 (WU-152): bootstrap applies 5c, then 5d, before the server starts (D-509)', () => {
  it('ParseFixes.apply() then Patches.apply_all(), both after the wrapper boots PoB and before Server.lua', () => {
    const bootstrap = fs.readFileSync(path.join(REPO, 'pob-api', 'bootstrap.lua'), 'utf8');
    const wrapper = bootstrap.indexOf("dofile('HeadlessWrapper.lua')");
    const fixes = bootstrap.indexOf("require('API.ParseFixes').apply()");
    const patches = bootstrap.indexOf("require('API.Patches').apply_all()");
    const server = bootstrap.indexOf("dofile(SCRIPT_DIR .. '/API/Server.lua')");
    expect([wrapper, fixes, patches, server].every((i) => i > 0)).toBe(true);
    expect(wrapper).toBeLessThan(fixes);
    expect(fixes).toBeLessThan(patches);
    expect(patches).toBeLessThan(server);
    expect(bootstrap).toContain("'[Patches] not applied: '");
    const module = fs.readFileSync(path.join(REPO, 'pob-api', 'API', 'Patches.lua'), 'utf8');
    expect(module).toContain("'[Patches] ' .. tostring(e.pg) .. ' not applied: '");
  });
});
