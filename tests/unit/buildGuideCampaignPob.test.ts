/**
 * WU-95's fix round, the coordinator's ruling (a D-415 clarification): a campaign's final compile writes a **new** PoB
 * file, the build's PoB name and `-campaign` (`<slug>-<YYYY-MM-DD>-<n>-<id>-campaign`; for a migrated build in ".",
 * `<slug>-<YYYY-MM-DD>-<n>-campaign`), and leaves the endgame file F1 wrote as it was: by the time the user asks for
 * the campaign they have likely saved the endgame file in PoB, and a rewrite would meet the write ledger's refusal
 * (D-211) every time.
 *
 * The run checker's PoB file name rule, on copies of `tests/fixtures/pipeline/run-builds`: `r1-a-1` is the full build
 * after a campaign (finalized `accept:file`, F1 wrote `…-r1-a-1.xml`; then `campaign:r1-a-1` after a resume, its D2
 * gate wrote `…-r1-a-1-campaign.xml`), `r1-a-2` the endgame-only build (F1's `…-r1-a-2.xml`). check-run loads the
 * server's compiled `build/plan/`: `mise run test` builds first.
 */
import { describe, it, expect, afterAll } from '@jest/globals';
import { spawnSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';

type Json = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

const REPO = path.resolve(__dirname, '..', '..');
const CHECKER = path.join(REPO, '.claude', 'skills', 'build-guide', 'scripts', 'check-run.mjs');
const FIXTURE = path.join(REPO, 'tests', 'fixtures', 'pipeline', 'run-builds');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'campaign-pob-'));
afterAll(() => fs.rmSync(TMP, { recursive: true, force: true }));

let copies = 0;
function copy(): string {
  const dir = path.join(TMP, `run-builds-${++copies}`);
  fs.cpSync(FIXTURE, dir, { recursive: true });
  return dir;
}
function check(dir: string) {
  const r = spawnSync(process.execPath, [CHECKER, dir], { cwd: TMP, env: { PATH: '/usr/bin:/bin', LANG: 'C' }, encoding: 'utf8', timeout: 60000 });
  return { code: r.status, stderr: r.stderr };
}
const layout = (stderr: string) => stderr.split('\n').filter((l) => l.startsWith('check-run: [layout] '));
const readJson = (dir: string, rel: string): Json => JSON.parse(fs.readFileSync(path.join(dir, rel), 'utf8')) as Json;
function editJson(dir: string, rel: string, edit: (v: Json) => void): void {
  const v = readJson(dir, rel);
  edit(v);
  fs.writeFileSync(path.join(dir, rel), `${JSON.stringify(v, null, 2)}\n`);
}
/** Renames a build's final PoB file in its record and in builds[], as a final compile under that name would. */
function pobNamed(dir: string, id: string, name: string): void {
  editJson(dir, `builds/${id}/compile-record.json`, (r) => (r.pobFile.path = name));
  editJson(dir, 'run-log.json', (l) => (l.builds.find((b: Json) => b.id === id).pobFile = name));
}

describe("a campaign's final compile writes its own PoB file, -campaign, beside the endgame one (D-415)", () => {
  it('the fixture passes: the full build after its campaign has the -campaign file, its F1 wrote the endgame file, and the endgame-only build has no suffix', () => {
    const dir = copy();
    expect(check(dir)).toEqual({ code: 0, stderr: '' });
    expect(readJson(dir, 'builds/r1-a-1/compile-record.json').pobFile.path).toBe('titan-blood-hunt-2026-10-08-1-r1-a-1-campaign.xml');
    expect(readJson(dir, 'reports/gates/F1-r1-a-1-a1.json').finalCompile.pobFile).toBe('titan-blood-hunt-2026-10-08-1-r1-a-1.xml');
    expect(readJson(dir, 'reports/gates/D2-gate-r1-a-1-a1.json').finalCompile.pobFile).toBe('titan-blood-hunt-2026-10-08-1-r1-a-1-campaign.xml');
    expect(readJson(dir, 'builds/r1-a-2/compile-record.json').pobFile.path).toBe('titan-blood-hunt-2026-10-08-1-r1-a-2.xml');
  });

  it("fails a campaign's final compile that rewrote the endgame file, the name without -campaign", () => {
    const dir = copy();
    pobNamed(dir, 'r1-a-1', 'titan-blood-hunt-2026-10-08-1-r1-a-1.xml');
    expect(layout(check(dir).stderr)).toEqual([
      'check-run: [layout] builds/r1-a-1: the final compile wrote "titan-blood-hunt-2026-10-08-1-r1-a-1.xml"; its build_name is "titan-blood-hunt-2026-10-08-1-r1-a-1-campaign", the run folder\'s last two segments joined, then the card id (D-412), then -campaign, the campaign\'s own file beside the endgame one (D-415) (§2)',
    ]);
  });

  it('fails an endgame-only build whose F1 wrote a -campaign file: no campaign was asked for', () => {
    const dir = copy();
    pobNamed(dir, 'r1-a-2', 'titan-blood-hunt-2026-10-08-1-r1-a-2-campaign.xml');
    expect(layout(check(dir).stderr)).toEqual([
      'check-run: [layout] builds/r1-a-2: the final compile wrote "titan-blood-hunt-2026-10-08-1-r1-a-2-campaign.xml"; its build_name is "titan-blood-hunt-2026-10-08-1-r1-a-2", the run folder\'s last two segments joined, then the card id (D-412) (§2)',
    ]);
  });

  it('the suffix follows the campaign answer: without it, the same D2 gate record would be held to the plain name', () => {
    const dir = copy();
    // The resume's campaign:r1-a-1 is the build's campaign answer; with it gone the -campaign name is no longer due.
    const log = readJson(dir, 'run-log.json');
    const at = (log.checkpoints as Json[]).findIndex((c) => c.checkpoint === 'verification' && c.answer === 'campaign:r1-a-1');
    expect(at).toBeGreaterThanOrEqual(0);
    editJson(dir, 'run-log.json', (l) => (l.checkpoints[at].answer = 'more'));
    expect(layout(check(dir).stderr)).toContain(
      'check-run: [layout] builds/r1-a-1: the final compile wrote "titan-blood-hunt-2026-10-08-1-r1-a-1-campaign.xml"; its build_name is "titan-blood-hunt-2026-10-08-1-r1-a-1", the run folder\'s last two segments joined, then the card id (D-412) (§2)',
    );
  });
});
