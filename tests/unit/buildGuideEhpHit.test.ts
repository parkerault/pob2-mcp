/**
 * WU-95 (D-423, amendment 9 §15): comparable Effective HP. Each display names the hit its Effective HP was measured
 * against, so the verification gate's and the design gate's figures compare:
 *
 * - the design display's Effective HP line appends the rung's `ehpHit`, which the D1 gate writes on each design rung
 *   (`T15 map hits, area 79: 402 physical`), as `- Effective HP: <ehp> (against <ehpHit>).`; a rung without one (a
 *   verdict from before amendment 9) keeps the plain line;
 * - the verification display's Toughness line names the hit the dossier's EHP column gives (`31,500 vs T15 map
 *   hits`, R1b-assemble's form), as `… effective HP against <hit> (…)`; a cell that names none keeps the plain line.
 *
 * Spawned as a real `node` process on copies of `tests/fixtures/pipeline/run-builds`, with an explicit env.
 */
import { describe, it, expect, afterAll } from '@jest/globals';
import { spawnSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';

type Json = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

const REPO = path.resolve(__dirname, '..', '..');
const RUN_LOG = path.join(REPO, '.claude', 'skills', 'build-guide', 'scripts', 'run-log.mjs');
const FIXTURE = path.join(REPO, 'tests', 'fixtures', 'pipeline', 'run-builds');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'ehp-hit-'));
afterAll(() => fs.rmSync(TMP, { recursive: true, force: true }));

let copies = 0;
function copy(): string {
  const dir = path.join(TMP, `run-builds-${++copies}`);
  fs.cpSync(FIXTURE, dir, { recursive: true });
  return dir;
}
function display(dir: string, ...args: string[]): string[] {
  const r = spawnSync(process.execPath, [RUN_LOG, dir, 'display', ...args], { cwd: TMP, env: { PATH: '/usr/bin:/bin', LANG: 'C' }, encoding: 'utf8', timeout: 30000 });
  expect({ code: r.status, stderr: r.stderr }).toEqual({ code: 0, stderr: '' });
  return r.stdout.split('\n');
}
function editJson(file: string, edit: (v: Json) => void): void {
  const v = JSON.parse(fs.readFileSync(file, 'utf8')) as Json;
  edit(v);
  fs.writeFileSync(file, `${JSON.stringify(v, null, 2)}\n`);
}

describe('D-423: the design display names the hit each rung\'s Effective HP was measured against', () => {
  it('appends the rung\'s ehpHit to its Effective HP line, and keeps the plain line for a rung without one', () => {
    const dir = copy();
    const verdict = path.join(dir, 'reports', 'gates', 'D1-gate-r1-a-2-a1.json');
    editJson(verdict, (v) => {
      const rungs = v.design.rungs as Json[];
      rungs.find((r) => r.stage === 'm')!.ehpHit = 'T15 map hits, area 69: 260 physical';
      rungs.find((r) => r.stage === 'b')!.ehpHit = 'T15 map hits, area 79: 402 physical';
    });
    const rows = display(dir, 'design', '--build', 'r1-a-2');
    expect(rows.filter((l) => l.startsWith('- Effective HP:'))).toEqual([
      '- Effective HP: 18,400 (against T15 map hits, area 69: 260 physical).',
      '- Effective HP: 31,500 (against T15 map hits, area 79: 402 physical).',
      '- Effective HP: 52,300.',
    ]);
    // Each Effective HP line still follows its rung's Damage line.
    const at = rows.indexOf('- Effective HP: 31,500 (against T15 map hits, area 79: 402 physical).');
    expect(rows[at - 1]).toMatch(/^- Damage: [\d,]+ per second\.$/);
  });

  it('an empty or blank ehpHit names no hit', () => {
    const dir = copy();
    editJson(path.join(dir, 'reports', 'gates', 'D1-gate-r1-a-2-a1.json'), (v) => {
      for (const r of v.design.rungs as Json[]) r.ehpHit = '  ';
    });
    expect(display(dir, 'design', '--build', 'r1-a-2').filter((l) => l.startsWith('- Effective HP:'))).toEqual([
      '- Effective HP: 18,400.',
      '- Effective HP: 31,500.',
      '- Effective HP: 52,300.',
    ]);
  });
});

describe('D-423: the verification display names the hit the dossier\'s EHP column gives', () => {
  it('names "vs <hit>" from a card\'s EHP cell on its Toughness line, and nothing for a cell with no hit', () => {
    const dir = copy();
    const dossier = path.join(dir, 'dossier.md');
    const text = fs.readFileSync(dossier, 'utf8');
    const row = text.split('\n').find((l) => l.startsWith('| r1-a-1 |'))!;
    const cells = row.split(' | ');
    const ehpAt = text.split('\n').find((l) => l.startsWith('| Card |'))!.split(' | ').indexOf('EHP');
    expect(cells[ehpAt]).toBe('31500');
    cells[ehpAt] = '31,500 vs T15 map hits';
    fs.writeFileSync(dossier, text.replace(row, cells.join(' | ')));
    const toughness = display(dir, 'verification').filter((l) => l.trim().startsWith('Toughness:'));
    expect(toughness).toEqual([
      "   Toughness: 4,200 life and 31,500 effective HP against T15 map hits (PoB's estimate of the damage it takes to kill you).",
      "   Toughness: 4,200 life and 31,500 effective HP (PoB's estimate of the damage it takes to kill you).",
    ]);
  });

  it("names PoB's default hit when the dossier says the skeleton was measured against it", () => {
    const dir = copy();
    const dossier = path.join(dir, 'dossier.md');
    const text = fs.readFileSync(dossier, 'utf8');
    const row = text.split('\n').find((l) => l.startsWith('| r1-a-2 |'))!;
    fs.writeFileSync(dossier, text.replace(row, row.replace('| 31500 |', "| 31500 vs PoB's default hit |")));
    const toughness = display(dir, 'verification').filter((l) => l.trim().startsWith('Toughness:'));
    expect(toughness[1]).toBe("   Toughness: 4,200 life and 31,500 effective HP against PoB's default hit (PoB's estimate of the damage it takes to kill you).");
  });
});
