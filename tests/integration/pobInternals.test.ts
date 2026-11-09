/**
 * AC-W138's probe (WU-155, amendment 16 §4 step 2, D-508), engine-required: S-2's internals probe, committed as
 * `scripts/pob-internals.lua` with its list `scripts/pob-internals.symbols.json`, run on the pinned tree as the upgrade
 * script runs it (cwd the tree's src/, temporary POB_DIRECTORY, XDG_STATE_HOME and TMPDIR, the golden build loaded).
 *
 * Every listed symbol resolves on the pin, each function to the PoB file that defines it with a body hash; a method the
 * bridge patches reads as PoB's own (the probe boots vanilla PoB, none of the bridge's patches); and two runs give the
 * same result, which the upgrade script's dry run (the pin to itself, no judgment item) relies on.
 */
import { spawnSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterAll, expect, it } from '@jest/globals';
import { engineDescribe } from '../helpers/engine';

const REPO = path.resolve(__dirname, '..', '..');
const TREE = path.join(REPO, 'vendor', 'PathOfBuilding-PoE2');
const LIST = path.join(REPO, 'scripts', 'pob-internals.symbols.json');
const PIN = JSON.parse(fs.readFileSync(path.join(REPO, 'pob-pin.json'), 'utf8')) as { version: string };
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'pob-internals-'));

afterAll(() => fs.rmSync(TMP, { recursive: true, force: true }));

interface Probe {
  version: string;
  build: string;
  symbols: Record<string, { type: string; file?: string; line?: number; lastLine?: number; sha1?: string; at?: string }>;
}

function probe(n: number): Probe {
  const dir = path.join(TMP, String(n));
  const env: NodeJS.ProcessEnv = { PATH: process.env.PATH, HOME: process.env.HOME, LANG: 'C' };
  for (const k of ['POB_DIRECTORY', 'XDG_STATE_HOME', 'TMPDIR']) {
    env[k] = path.join(dir, k);
    fs.mkdirSync(env[k]!, { recursive: true });
  }
  const runtime = path.join(TREE, 'runtime');
  env.LUA_PATH = `${runtime}/lua/?.lua;${runtime}/lua/?/init.lua;;`;
  env.LUA_CPATH = `${runtime}/?.so;${path.join(os.homedir(), '.luarocks', 'lib', 'lua', '5.1')}/?.so;;`;
  const out = path.join(dir, 'out.json');
  const list = JSON.parse(fs.readFileSync(LIST, 'utf8')) as { build: string };
  const r = spawnSync('luajit', [path.join(REPO, 'scripts', 'pob-internals.lua'), LIST, out, path.join(REPO, list.build)], {
    cwd: path.join(TREE, 'src'),
    env,
    input: '',
    encoding: 'utf8',
    timeout: 120_000,
  });
  if (r.status !== 0) throw new Error(`the probe failed (exit ${r.status}): ${r.stdout}\n${r.stderr.slice(-2000)}`);
  return JSON.parse(fs.readFileSync(out, 'utf8')) as Probe;
}

engineDescribe('AC-W138 (WU-155): the internals probe on the pin (D-508)', () => {
  const list = JSON.parse(fs.readFileSync(LIST, 'utf8')) as { groups: Record<string, string[]> };
  const symbols = Object.values(list.groups).flat();
  let first: Probe;

  it('resolves every listed symbol inside the loaded golden build; each function to its PoB file, lines and body hash', () => {
    first = probe(1);
    expect(first.version).toBe(PIN.version);
    expect(first.build).toBe('grenadator.xml');
    expect(Object.keys(first.symbols).sort()).toEqual([...symbols].sort());
    const unresolved = symbols.filter((s) => ['nil', 'error'].includes(first.symbols[s].type));
    expect(unresolved).toEqual([]);
    for (const s of symbols.filter((x) => first.symbols[x].type === 'function')) {
      const r = first.symbols[s];
      expect({ s, file: typeof r.file, line: typeof r.line, sha1: r.sha1 }).toEqual({ s, file: 'string', line: 'number', sha1: expect.stringMatching(/^[0-9a-f]{40}$/) });
      expect(fs.existsSync(path.join(TREE, 'src', r.file!))).toBe(true);
    }
    // A method the bridge patches reads as PoB's own: the probe boots vanilla PoB.
    expect(first.symbols['build.skillsTab:ProcessSocketGroup']).toEqual(expect.objectContaining({ type: 'function', file: 'Classes/SkillsTab.lua' }));
    expect(first.symbols['build.itemsTab:Save'].file).toBe('Classes/ItemsTab.lua');
  }, 180_000);

  it('gives the same result on a second run, so the pin probed against itself lists no symbol', () => {
    expect(probe(2)).toEqual(first);
  }, 180_000);
});
