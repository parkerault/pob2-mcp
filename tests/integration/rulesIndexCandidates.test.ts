/**
 * WU-85 (amendment 8, D-401): `rules-index.mjs candidates` against the pinned PoB, spawned as a real `node` process
 * from a temp cwd (it boots the pin headless with `luajit`, so it is an engine test):
 *
 * - `--json` lists the 22 ascendancies with their notables (a multiple-choice notable with its options), the
 *   keystones, the uniques (with a ring's jewel socket), and the gems a rule-change phrase finds;
 * - it leaves out the gems PoB marks legacy and the uniques it marks no longer obtainable (D-384), and names them;
 * - `check --text` passes the committed index against that dump: every quoted line is its item's own, verbatim, and
 *   no block says `Penalties: none` beside a penalty line of its item;
 * - the text listing prints a kind's section.
 */
import { it, expect, beforeAll, afterAll } from '@jest/globals';
import { spawnSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { engineDescribe } from '../helpers/engine';

const REPO = path.resolve(__dirname, '..', '..');
const SCRIPT = path.join(REPO, '.claude', 'skills', 'build-guide', 'scripts', 'rules-index.mjs');
const RULES = path.join(REPO, 'data', 'rules');

interface Line { line: string; variants?: string[]; source?: string }
interface Dump {
  ascendancies: string[];
  nodes: { id: number; name: string; ascendancy: string; choice?: boolean; lines: string[] }[];
  keystones: { id: number; name: string; lines: string[] }[];
  uniques: { name: string; type: string; sockets?: string; lines: Line[] }[];
  gems: { name: string; phrases: string[]; lines: Line[] }[];
  legacyGems: string[];
  unobtainableUniques: string[];
}

function run(...args: string[]) {
  const env: Record<string, string> = {};
  for (const [k, v] of Object.entries(process.env)) if (v !== undefined && !['POESESSID', 'POE_SESSION_ID'].includes(k)) env[k] = v;
  const r = spawnSync(process.execPath, [SCRIPT, ...args], { cwd: TMP, env, encoding: 'utf8', timeout: 180000, maxBuffer: 64 * 1024 * 1024 });
  return { code: r.status, stdout: r.stdout, stderr: r.stderr };
}

let TMP = '';
let dump: Dump;
let dumpFile = '';

engineDescribe('rules-index.mjs candidates on the pinned PoB (D-401, D-384)', () => {
  beforeAll(() => {
    TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rules-index-candidates-'));
    const r = run('candidates', '--json');
    expect({ code: r.code, stderr: r.stderr.slice(-2000) }).toEqual({ code: 0, stderr: '' });
    dumpFile = path.join(TMP, 'candidates.json');
    fs.writeFileSync(dumpFile, r.stdout);
    dump = JSON.parse(r.stdout) as Dump;
  }, 200000);
  afterAll(() => fs.rmSync(TMP, { recursive: true, force: true }));

  it('lists every ascendancy notable and keystone with its lines, a choice notable with its options', () => {
    expect(dump.ascendancies).toHaveLength(22);
    expect(dump.nodes.find((n) => n.id === 39595)).toMatchObject({ name: 'Way of the Stonefist', ascendancy: 'Martial Artist' });
    expect(dump.nodes.find((n) => n.id === 39595)!.lines).toContain('Ignore Attribute Requirements to equip Gloves');
    const pathSeeker = dump.nodes.find((n) => n.name === 'Path Seeker')!;
    expect(pathSeeker.choice).toBe(true);
    expect(pathSeeker.lines.some((l) => l.startsWith("Option Path of the Sorceress: Can Allocate Passive Skills from the Sorceress's starting point"))).toBe(true);
    expect(dump.keystones.map((k) => k.name)).toEqual(expect.arrayContaining(['Chaos Inoculation', 'Resolute Technique']));
  });

  it('lists the uniques with their lines and sockets, and the gems a rule-change phrase finds', () => {
    expect(dump.uniques.find((u) => u.name === "Safrin's Resolve")).toMatchObject({ type: 'Ring', sockets: 'J' });
    const verisium = dump.gems.find((g) => g.name === 'Powered by Verisium')!;
    expect(verisium.phrases).toContain('in place of');
    expect(verisium.lines.map((l) => l.line)).toContain('Spends Ward to generate Verisium Infusions, which can be used in place of any Elemental Infusions.');
  });

  it('leaves out legacy gems and uniques no longer obtainable, and names them', () => {
    expect(dump.legacyGems).toContain('Commandment');
    expect(dump.unobtainableUniques).toContain('Thunderstep');
    expect(dump.gems.map((g) => g.name)).not.toContain('Commandment');
    expect(dump.uniques.map((u) => u.name)).not.toContain('Thunderstep');
  });

  it('check --text passes the committed index against the dump', () => {
    expect(run('check', RULES, '--text', dumpFile)).toEqual({ code: 0, stderr: '', stdout: expect.stringMatching(/^rules-index check: ok \(/) });
  });

  it('prints one kind as a text listing', () => {
    const r = run('candidates', '--kind', 'keystones');
    expect(r.code).toBe(0);
    expect(r.stdout.split('\n')[0]).toBe('## Keystones');
    expect(r.stdout).toContain('- Chaos Inoculation (56349): Maximum Life is 1');
  }, 200000);
});
