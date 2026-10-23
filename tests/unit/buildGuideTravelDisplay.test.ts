/**
 * WU-102 (amendment 9 §24.2; D-427, C-55a): the design display (`run-log.mjs display design`) prints each rung's travel
 * skill beside its movement speed, from the record's clear measure (`measures.clearSpeed.travel`), and names the pool of
 * a best swap left that is a pool move (the D1 gate verdict's `bestSwap.weaponSet`), as get_node_power names it
 * (`Best swap (weapon set <n>)`; the WU-101 verifier's note).
 *
 * - a rung whose record has a travel skill: `- Movement speed: <+n% over your base speed>; travel skill <skill>, <n> uses
 *   a second.`;
 * - `travel: null`: `; no travel skill`; a record from before M-22, with no `travel`: the line as it was;
 * - a pool move: `best swap left (weapon set 2): …`; a main swap keeps `best swap left: …`.
 *
 * Spawned as a real `node` process on copies of `tests/fixtures/pipeline/run-builds`, with an explicit env.
 */
import { afterAll, describe, expect, it } from '@jest/globals';
import { spawnSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';

type Json = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

const REPO = path.resolve(__dirname, '..', '..');
const RUN_LOG = path.join(REPO, '.claude', 'skills', 'build-guide', 'scripts', 'run-log.mjs');
const FIXTURE = path.join(REPO, 'tests', 'fixtures', 'pipeline', 'run-builds');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'travel-display-'));
afterAll(() => fs.rmSync(TMP, { recursive: true, force: true }));

let copies = 0;
function copy(): string {
  const dir = path.join(TMP, `run-builds-${++copies}`);
  fs.cpSync(FIXTURE, dir, { recursive: true });
  return dir;
}
function display(dir: string): string[] {
  const r = spawnSync(process.execPath, [RUN_LOG, dir, 'display', 'design', '--build', 'r1-a-2'], {
    cwd: TMP,
    env: { PATH: '/usr/bin:/bin', LANG: 'C' },
    encoding: 'utf8',
    timeout: 30000,
  });
  expect({ code: r.status, stderr: r.stderr }).toEqual({ code: 0, stderr: '' });
  return r.stdout.split('\n');
}
function editJson(file: string, edit: (v: Json) => void): void {
  const v = JSON.parse(fs.readFileSync(file, 'utf8')) as Json;
  edit(v);
  fs.writeFileSync(file, `${JSON.stringify(v, null, 2)}\n`);
}
const recordOf = (dir: string) => path.join(dir, 'builds', 'r1-a-2', 'compile-record.json');
const verdictOf = (dir: string) => path.join(dir, 'reports', 'gates', 'D1-gate-r1-a-2-a1.json');

describe("D-427: the design display prints each rung's travel skill beside its movement speed", () => {
  it('names the travel skill and its uses a second, says when a rung has none, and keeps the old line for an older record', () => {
    const dir = copy();
    editJson(recordOf(dir), (r) => {
      r.stages.m.measures.movementSpeed = 1.1;
      r.stages.m.measures.clearSpeed.travel = { group: 3, skill: 'Leap Slam', usesPerSecond: 1.2345 };
      r.stages.b.measures.movementSpeed = 1.25;
      r.stages.b.measures.clearSpeed.travel = null;
      r.stages.n.measures.movementSpeed = 1.3;
    });
    const rows = display(dir).filter((l) => l.startsWith('- Movement speed:'));
    expect(rows).toEqual([
      '- Movement speed: +10% over your base speed; travel skill Leap Slam, 1.23 uses a second.',
      '- Movement speed: +25% over your base speed; no travel skill.',
      '- Movement speed: +30% over your base speed.',
    ]);
  });

  it('a travel skill PoB gave no Speed reads "uses a second not measured"', () => {
    const dir = copy();
    editJson(recordOf(dir), (r) => {
      r.stages.m.measures.clearSpeed.travel = { group: 2, skill: 'Shield Charge', usesPerSecond: null };
    });
    expect(display(dir).filter((l) => l.startsWith('- Movement speed:'))[0]).toBe(
      '- Movement speed: not measured; travel skill Shield Charge, uses a second not measured.',
    );
  });
});

describe("C-55a: the design display names a pool move's weapon set, as get_node_power does", () => {
  it('a best swap left with weaponSet reads "best swap left (weapon set <n>)"; a main swap is unchanged', () => {
    const dir = copy();
    editJson(verdictOf(dir), (v) => {
      v.design.rungs.find((r: Json) => r.stage === 'n').tree.bestSwap = { gainPercent: 2.5, removed: ['Strength'], added: ['Cold Nature'], weaponSet: 2 };
    });
    const rows = display(dir).filter((l) => l.startsWith('- Passive tree:'));
    expect(rows).toEqual([
      '- Passive tree: 6 of 64 points on travel; best swap left: none',
      '- Passive tree: 9 of 98 points on travel; best swap left: +3.2% Full DPS by moving 2 points from Strength, Strength to Cold Nature',
      '- Passive tree: 10 of 104 points on travel; best swap left (weapon set 2): +2.5% Full DPS by moving 1 points from Strength to Cold Nature',
    ]);
  });
});
