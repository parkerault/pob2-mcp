/**
 * Amendment 16's M-30, WU-165 (D-522, C-65; §18, §12, §15, §16): `/pob2:writer`, a guide for a build that passed F1,
 * written in its own run folder from a source run folder. Each script is spawned as a real `node` process with an
 * explicit env and the test clock (`BUILD_GUIDE_TEST_NOW`, `tests/helpers/runningDigests.ts`'s `TEST_NOW`), on committed
 * fixtures laid out in a temporary guides root, each with its source beside it:
 * - `tests/fixtures/pieces/writer-file-run`, a writer run on WU-164's fixture file run (`tests/fixtures/file-run` with
 *   `file-run-completed` laid over it, `file/2026-12-01-1`, its build `file`), made by the real path: `init` on the source,
 *   `pob2-render-audit` and `pob2-render-notes` reading it, W1's guide (the one W1 wrote for that build), the status;
 * - `tests/fixtures/pieces/writer-better-run`, a writer run on WU-162's fixture better round
 *   (`tests/fixtures/pieces/compile-better-run`, `compile/2026-12-01-1`), the endgame guide of its one rung, its source
 *   laid out with the owned legacy gem the round kept (Bloodlust) dropped, as a guide needs.
 *
 * AC-W158 (its unit parts): the fixture writer run on the file run passes the checker, its guide and audit in its own
 * folder and none in the source (a source holding no guide too; the renders and the checker write nothing there); the
 * checker holds the guide and the audit to the source's plan, record and verdicts (a planted fault of each fails its
 * rule alone); `pob2-run-log init` refuses a measure-only compile run as the source, naming the better round, and every
 * other source that isn't a build that passed F1; on a better round's source the guide is its one rung's, the owned rares
 * are specs (a guide printing an owned rare's own roll fails `owned-guide`) and a legacy gem, a Legacy soul core and a
 * corrupted rare are refused, at `init` and by the checker; the renders read the source with `--source` and `--build`.
 *
 * check-run and render-audit load the server's compiled `build/plan/`: `mise run test` builds first.
 */
import { describe, it, expect, afterAll } from '@jest/globals';
import { spawnSync } from 'child_process';
import crypto from 'crypto';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { TEST_NOW } from '../helpers/runningDigests';

type Json = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

const REPO = path.resolve(__dirname, '..', '..');
const SCRIPTS = path.join(REPO, 'skills', 'build-guide', 'scripts');
const CHECKER = path.join(SCRIPTS, 'check-run.mjs');
const RUN_LOG = path.join(SCRIPTS, 'run-log.mjs');
const RENDER_AUDIT = path.join(SCRIPTS, 'render-audit.mjs');
const RENDER_NOTES = path.join(SCRIPTS, 'render-notes.mjs');
const FIXTURES = path.join(REPO, 'tests', 'fixtures');
const PIECES = path.join(FIXTURES, 'pieces');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'writer-piece-'));
afterAll(() => fs.rmSync(TMP, { recursive: true, force: true }));

const ENV = { PATH: '/usr/bin:/bin', LANG: 'C', BUILD_GUIDE_TEST_NOW: TEST_NOW };
function node(script: string, args: string[]) {
  const r = spawnSync(process.execPath, [script, ...args], { cwd: TMP, env: ENV, encoding: 'utf8', timeout: 60000 });
  return { code: r.status, stdout: r.stdout, stderr: r.stderr };
}
const check = (dir: string) => node(CHECKER, [dir]);
const write = (dir: string, kind: string, entry: Json) => node(RUN_LOG, [dir, kind, JSON.stringify(entry)]);
const lines = (stderr: string, rule: string) => stderr.split('\n').filter((l) => l.startsWith(`check-run: [${rule}] `));
const rulesIn = (stderr: string) => [...new Set(stderr.split('\n').map((l) => /^check-run: \[([^\]]+)\] /.exec(l)?.[1]).filter((x): x is string => x !== undefined))].sort();
function passes(dir: string): void {
  const r = check(dir);
  expect({ stderr: r.stderr, code: r.code }).toEqual({ stderr: '', code: 0 });
}
const readJson = (dir: string, rel: string): Json => JSON.parse(fs.readFileSync(path.join(dir, rel), 'utf8')) as Json;
function editJson(dir: string, rel: string, edit: (v: Json) => void): void {
  const v = readJson(dir, rel);
  edit(v);
  fs.writeFileSync(path.join(dir, rel), `${JSON.stringify(v, null, 2)}\n`);
}
const editText = (file: string, edit: (t: string) => string) => fs.writeFileSync(file, edit(fs.readFileSync(file, 'utf8')));
/** Every file under a folder with its sha1, so a folder is compared before and after. */
function tree(dir: string): Record<string, string> {
  const out: Record<string, string> = {};
  const walk = (d: string) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else out[path.relative(dir, p)] = crypto.createHash('sha1').update(fs.readFileSync(p)).digest('hex');
    }
  };
  walk(dir);
  return out;
}

let roots = 0;
/** A fresh guides root. */
const newRoot = () => {
  const root = path.join(TMP, `root-${++roots}`);
  fs.mkdirSync(root, { recursive: true });
  return root;
};
/** A copy of run folder(s) at `<root>/<rel>`, laid one over the other, its log's runFolder that folder. */
function lay(root: string, rel: string, ...from: string[]): string {
  const dir = path.join(root, ...rel.split('/'));
  fs.mkdirSync(path.dirname(dir), { recursive: true });
  for (const f of from) fs.cpSync(f, dir, { recursive: true });
  editJson(dir, 'run-log.json', (l) => {
    l.runFolder = dir;
  });
  return dir;
}
/** WU-164's completed file run, the writer fixture's source. */
const fileSource = (root: string) => lay(root, 'file/2026-12-01-1', path.join(FIXTURES, 'file-run'), path.join(FIXTURES, 'file-run-completed'));
/** WU-162's better round, as committed (it keeps the character's legacy gem Bloodlust, owned), or with it dropped. */
function betterSource(root: string, dropLegacy = true): string {
  const dir = lay(root, 'compile/2026-12-01-1', path.join(PIECES, 'compile-better-run'));
  if (dropLegacy) {
    editJson(dir, 'plan.json', (p) => {
      for (const g of p.stages[0].skills.groups) g.gems = g.gems.filter((m: Json) => m.name !== 'Bloodlust');
    });
  }
  return dir;
}
/** The writer fixture on the file run, its source beside it. */
function fileWriter(): { root: string; source: string; writer: string } {
  const root = newRoot();
  const source = fileSource(root);
  return { root, source, writer: lay(root, 'writer/2026-12-01-1', path.join(PIECES, 'writer-file-run')) };
}
/** The writer fixture on the better round, its source beside it. */
function betterWriter(dropLegacy = true): { root: string; source: string; writer: string } {
  const root = newRoot();
  const source = betterSource(root, dropLegacy);
  return { root, source, writer: lay(root, 'writer/2026-12-02-1', path.join(PIECES, 'writer-better-run')) };
}
/** A writer's `init` in a fresh folder of `root`; the folder and the result. */
function init(root: string, source: Json, n = 9) {
  const dir = path.join(root, 'writer', `2026-12-0${n}-1`);
  fs.mkdirSync(dir, { recursive: true });
  return { dir, r: write(dir, 'init', { piece: 'writer', mode: 'offline', testConfig: 'none', noNinja: false, source }) };
}

// ---------------------------------------------------------------------------------------------------
// The fixture writer run on a file run's folder
// ---------------------------------------------------------------------------------------------------

describe("AC-W158 (WU-165, D-522): a writer run on a fixture file run's folder", () => {
  it('passes the checker, its guide and audit in its own folder, and writes nothing in the source', () => {
    const { source, writer } = fileWriter();
    const before = tree(source);
    passes(writer);
    expect(fs.readdirSync(writer).sort()).toEqual(['audit.md', 'guide.md', 'notes.txt', 'run-log.json']);
    expect(readJson(writer, 'run-log.json')).toMatchObject({ piece: 'writer', status: 'completed', source: { kind: 'run-folder', name: 'file/2026-12-01-1', build: 'file' }, stages: [{ stage: 'W1', concept: 'file', attempt: 1, outcome: 'done' }] });
    // The renders read the source and write in the writer's folder: the fixture's audit and notes, byte for byte.
    const audit = fs.readFileSync(path.join(writer, 'audit.md'), 'utf8');
    const notes = fs.readFileSync(path.join(writer, 'notes.txt'), 'utf8');
    fs.rmSync(path.join(writer, 'audit.md'));
    fs.rmSync(path.join(writer, 'notes.txt'));
    expect(node(RENDER_AUDIT, [writer, '--source', 'file/2026-12-01-1', '--build', 'file'])).toEqual({ code: 0, stdout: 'render-audit: wrote audit.md from file/2026-12-01-1/builds/file/plan.json, file/2026-12-01-1/builds/file/compile-record.json and reports/gates/D1-gate-file-a1.json\n', stderr: '' });
    expect(node(RENDER_NOTES, [writer, '--source', source, '--build', 'file'])).toEqual({ code: 0, stdout: `render-notes: wrote notes.txt (${notes.length} characters) from guide.md\n`, stderr: '' });
    expect(fs.readFileSync(path.join(writer, 'audit.md'), 'utf8')).toBe(audit);
    expect(fs.readFileSync(path.join(writer, 'notes.txt'), 'utf8')).toBe(notes);
    // Without the options a writer run's render reads the source its log names (the runner's form, runner-rules.md).
    expect(node(RENDER_AUDIT, [writer]).code).toBe(0);
    expect(node(RENDER_NOTES, [writer]).code).toBe(0);
    expect(fs.readFileSync(path.join(writer, 'audit.md'), 'utf8')).toBe(audit);
    passes(writer);
    expect(tree(source)).toEqual(before);
  });

  it("passes on a source whose build holds no guide: the writer reads the source's design, never its guide", () => {
    const { source, writer } = fileWriter();
    for (const f of ['guide.md', 'audit.md', 'notes.txt']) fs.rmSync(path.join(source, 'builds', 'file', f));
    passes(writer);
    for (const f of ['guide.md', 'audit.md', 'notes.txt']) expect({ f, inSource: fs.existsSync(path.join(source, 'builds', 'file', f)) }).toEqual({ f, inSource: false });
  });

  it("holds the guide and the audit to the source's plan, record and verdicts: a planted fault fails its rule alone", () => {
    const planted: [string, (writer: string) => void][] = [
      // A verdict line's max hit, against the source's record.
      ['verdict-line', (w) => editText(path.join(w, 'guide.md'), (t) => t.replace('Max hit 1,667 physical against about 402', 'Max hit 2,500 physical against about 402'))],
      // A buff switched as needed in the source's plan, its line gone (D-518).
      ['switched-buffs', (w) => editText(path.join(w, 'guide.md'), (t) => t.split('\n').filter((l) => !l.startsWith('- Wind Dancer: switch it on')).join('\n'))],
      // The audit isn't the render of the source's plan, record and D1 gate verdict.
      ['audit-render', (w) => editText(path.join(w, 'audit.md'), (t) => t.replace('Movement speed: +26%', 'Movement speed: +40%'))],
      // The import code isn't the source's final record's.
      ['import-code', (w) => editText(path.join(w, 'guide.md'), (t) => t.replace(/```\neJ/, '```\neK'))],
      // A rung the source's plan holds, its H2 gone.
      ['guide-sections', (w) => editText(path.join(w, 'guide.md'), (t) => t.replace('## How to play it', '## Playing it'))],
    ];
    for (const [rule, plant] of planted) {
      const { writer } = fileWriter();
      plant(writer);
      expect({ rule, failed: rulesIn(check(writer).stderr) }).toEqual({ rule, failed: [rule] });
    }
  });

  it('fails writer-source when its source run folder is gone, and checks nothing else against it', () => {
    const { source, writer } = fileWriter();
    fs.rmSync(source, { recursive: true });
    expect(lines(check(writer).stderr, 'writer-source')).toEqual([expect.stringMatching(/run-log\.json source: source\.name "file\/2026-12-01-1" names no run folder with a run-log\.json under the guides root .*; the writer's source is a \/pob2:build-guide run's build, a file run's .* \(D-522\)/)]);
    expect(rulesIn(check(writer).stderr)).toEqual(['writer-source']);
  });
});

// ---------------------------------------------------------------------------------------------------
// init's refusal of a source that isn't a build that passed F1
// ---------------------------------------------------------------------------------------------------

describe("AC-W158 (WU-165, D-522): pob2-run-log init refuses a source that isn't a build that passed F1", () => {
  it('refuses a measure-only compile run as the source, naming the better round and a file run; nothing is written', () => {
    const root = newRoot();
    lay(root, 'compile/2026-12-01-1', path.join(PIECES, 'compile-run'));
    const { dir, r } = init(root, { kind: 'run-folder', name: 'compile/2026-12-01-1' });
    expect(r).toEqual({ code: 1, stdout: '', stderr: expect.stringMatching(/^run-log: init entry refused: source\.name "compile\/2026-12-01-1" is a \/pob2:compile run with its measure only: it has no D1-gate verdict and no final record, so no guide comes from it\. A guide needs the better round accepted \(\/pob2:compile on the file, asking to make the character better, then \/pob2:writer on that run\), or a guide from the file \(\/pob2:build-guide <the file>\) \(D-522\)\n$/) });
    expect(fs.existsSync(path.join(dir, 'run-log.json'))).toBe(false);
  });

  it("refuses a better round that wasn't accepted, a missing folder, a pricing run, a wrong or missing build, and a folder outside the guides root", () => {
    const root = newRoot();
    fileSource(root);
    lay(root, 'pricing/2026-12-01-1', path.join(PIECES, 'pricing-run'));
    const stopped = betterSource(root);
    editJson(stopped, 'run-log.json', (l) => {
      l.stages = l.stages.filter((s: Json) => s.stage !== 'F1');
    });
    const refused = (source: Json, why: RegExp) => {
      const { dir, r } = init(root, source);
      expect({ code: r.code, stderr: r.stderr }).toEqual({ code: 1, stderr: expect.stringMatching(why) });
      expect(fs.existsSync(path.join(dir, 'run-log.json'))).toBe(false);
    };
    refused({ kind: 'run-folder', name: 'compile/2026-12-01-1' }, /is a \/pob2:compile run whose better round wasn't accepted: no final compile \(F1\) passed, so no guide comes from it/);
    refused({ kind: 'run-folder', name: 'nope/2026-12-01-1' }, /names no run folder with a run-log\.json under the guides root/);
    refused({ kind: 'run-folder', name: 'pricing/2026-12-01-1' }, /is a \/pob2:pricing run, which designs no build/);
    refused({ kind: 'run-folder', name: 'file/2026-12-01-1' }, /source\.build is missing; it names source\.name "file\/2026-12-01-1"'s build, one of its builds\[\]: file/);
    refused({ kind: 'run-folder', name: 'file/2026-12-01-1', build: 'r1-a-1' }, /source\.build is "r1-a-1"/);
    refused({ kind: 'run-folder', name: '../2026-12-01-1' }, /isn't a run folder under the guides root/);
    // A build whose final compile didn't pass: F1's pass taken out of the file run's log.
    const noF1 = newRoot();
    const src = fileSource(noF1);
    editJson(src, 'run-log.json', (l) => {
      l.stages = l.stages.filter((s: Json) => s.stage !== 'F1');
    });
    const { r } = init(noF1, { kind: 'run-folder', name: 'file/2026-12-01-1', build: 'file' });
    expect(r.stderr).toMatch(/source\.name "file\/2026-12-01-1"'s build file lacks a final compile that passed \(F1, or the D2 gate\) with its final record; the writer writes the guide of a build that passed F1/);
  });

  it("takes a file run's build, a /pob2:build-guide run's build and an accepted better round; a compile run's names no build", () => {
    const root = newRoot();
    fileSource(root);
    lay(root, 'titan-blood-hunt/2026-10-08-1', path.join(FIXTURES, 'pipeline', 'run-a14'));
    betterSource(root);
    expect(init(root, { kind: 'run-folder', name: 'file/2026-12-01-1', build: 'file' }, 3).r).toMatchObject({ code: 0, stdout: expect.stringMatching(/^run-log: wrote the first log\n/) });
    expect(init(root, { kind: 'run-folder', name: 'titan-blood-hunt/2026-10-08-1', build: 'r1-a-2' }, 4).r.code).toBe(0);
    expect(init(root, { kind: 'run-folder', name: 'compile/2026-12-01-1' }, 5).r.code).toBe(0);
    expect(init(root, { kind: 'run-folder', name: 'compile/2026-12-01-1', build: 'file' }, 6).r).toMatchObject({ code: 1, stderr: expect.stringMatching(/a \/pob2:compile run's one build sits at its folder's root, so the source names no build/) });
  });
});

// ---------------------------------------------------------------------------------------------------
// A better round's source: its one rung, its owned rares as specs, what a guide can't carry refused
// ---------------------------------------------------------------------------------------------------

describe("AC-W158 (WU-165, D-522, §15, §16): a writer run on a better round's source", () => {
  it("refuses the round as committed, whose plan keeps the character's legacy gem, naming it and pointing to a file run", () => {
    const root = newRoot();
    betterSource(root, false);
    const { dir, r } = init(root, { kind: 'run-folder', name: 'compile/2026-12-01-1' });
    expect(r).toEqual({ code: 1, stdout: '', stderr: 'run-log: init entry refused: source.name "compile/2026-12-01-1" keeps the gem "Bloodlust" (stage b group 8), which a guide can\'t carry (legacy, D-395): in a guide owned content meets every rule, so a guide from this character is a file run\'s, whose ladder replaces it with a trade its design gate shows (/pob2:build-guide <the file>) (D-522)\n' });
    expect(fs.existsSync(path.join(dir, 'run-log.json'))).toBe(false);
  });

  it('refuses a planted Legacy soul core and a planted corrupted rare on owned items, naming each', () => {
    const root = newRoot();
    const src = betterSource(root);
    editJson(src, 'plan.json', (p) => {
      const slot = (name: string) => p.stages[0].items.slots.find((x: Json) => x.slot === name);
      slot('Boots').text = slot('Boots').text.replace('Rune: Soul Core of Topotante', 'Rune: Legacy of Atziri');
      slot('Belt').text = `${slot('Belt').text}\nCorrupted`;
    });
    const { r } = init(root, { kind: 'run-folder', name: 'compile/2026-12-01-1' });
    expect(r.code).toBe(1);
    expect(r.stderr).toContain('keeps the rune "Legacy of Atziri" (stage b Boots), which a guide can\'t carry (a rune over the budget, D-465)');
    expect(r.stderr).toContain('keeps a corrupted rare item (stage b Belt), which a guide can\'t carry (corruption never on a rare, magic or normal item, D-471)');
  });

  /** The better round's source with an owned normal spear and an owned unique amulet each carrying a bare Corrupted line. */
  function corruptedSource(root: string, amulet: Json | null): string {
    const src = betterSource(root);
    editJson(src, 'plan.json', (p) => {
      const slot = (name: string) => p.stages[0].items.slots.find((x: Json) => x.slot === name);
      slot('Weapon 1 Swap').text = `${slot('Weapon 1 Swap').text}\nCorrupted`;
      slot('Amulet').text = `${slot('Amulet').text}\nCorrupted`;
      if (amulet !== null) Object.assign(p.prices.find((x: Json) => x.id === 'b-amulet'), amulet);
    });
    return src;
  }

  it("refuses an owned normal item's corruption (D-471) and an owned dear unique's bare Corrupted line (D-484), at init and in the checker", () => {
    // Choir of the Storm priced 30 divines: a bare Corrupted line on a unique that dear is the corruption rule's failure.
    const root = newRoot();
    corruptedSource(root, { status: 'ok', amount: 30, currency: 'divine', note: null });
    const { dir, r } = init(root, { kind: 'run-folder', name: 'compile/2026-12-01-1' });
    expect(r.code).toBe(1);
    expect(r.stderr).toContain('keeps a corrupted normal item (stage b Weapon 1 Swap), which a guide can\'t carry (corruption never on a rare, magic or normal item, D-471)');
    expect(r.stderr).toMatch(/source\.name "compile\/2026-12-01-1" keeps owned content a guide can't carry: the source's plan\.json's stage b slot "Amulet" holds Choir of the Storm with a bare Corrupted line, priced 30 divine\(s\); a bare Corrupted line is allowed on a unique PoB's data marks always corrupted, one bought corrupted with the extra socket, or a cheap unique \(under 1 divine\).*\(\/pob2:build-guide <the file>\) \(D-522\)/);
    expect(fs.existsSync(path.join(dir, 'run-log.json'))).toBe(false);
    // The checker fails a writer log naming that source: both, under owned-guide, as init refused them.
    const writer = lay(root, 'writer/2026-12-02-1', path.join(PIECES, 'writer-better-run'));
    const failed = lines(check(writer).stderr, 'owned-guide');
    expect(failed).toEqual(expect.arrayContaining([
      expect.stringMatching(/run-log\.json source: source\.name "compile\/2026-12-01-1" keeps a corrupted normal item \(stage b Weapon 1 Swap\)/),
      expect.stringMatching(/run-log\.json source: source\.name "compile\/2026-12-01-1" keeps owned content a guide can't carry: the source's plan\.json's stage b slot "Amulet" holds Choir of the Storm with a bare Corrupted line, priced 30 divine\(s\)/),
    ]));
    expect(failed).toHaveLength(2);
  });

  it("takes an owned unique's bare Corrupted line the corruption rule allows: a cheap one, or one an offline round couldn't price", () => {
    // Cheap: under the rule's 1 divine.
    const cheap = newRoot();
    corruptedSource(cheap, { status: 'ok', amount: 0.5, currency: 'divine', note: null });
    const r1 = init(cheap, { kind: 'run-folder', name: 'compile/2026-12-01-1' }).r;
    expect(r1.stderr).not.toMatch(/Amulet/);
    expect(r1.stderr).toMatch(/Weapon 1 Swap/);
    // Offline and unpriced (its note "offline run"): the rule leaves its cheapness unchecked, as the pipeline's does.
    const offline = newRoot();
    corruptedSource(offline, null);
    expect(init(offline, { kind: 'run-folder', name: 'compile/2026-12-01-1' }).r.stderr).not.toMatch(/Amulet/);
  });

  it('the fixture writer run passes: the endgame guide of its one rung, its verdict line at the rung\'s hits, nothing in the source', () => {
    const { source, writer } = betterWriter();
    const before = tree(source);
    passes(writer);
    const guide = fs.readFileSync(path.join(writer, 'guide.md'), 'utf8');
    expect(guide.split('\n').filter((l) => l.startsWith('## Endgame'))).toEqual(['## Endgame: budget']);
    // The round's stage is on the player's own configuration: the record writes no reference hit, so the verdict line and
    // the audit's Stage detail take the rung's (D-254's formula at T15).
    expect(readJson(source, 'compile-record.json').stages.b.configWritten.enemyPhysicalDamage).toBeUndefined();
    expect(guide).toContain('Max hit 1,582 physical against about 402, and at least 1,582 elemental or chaos against about 97.');
    expect(fs.readFileSync(path.join(writer, 'audit.md'), 'utf8')).toContain('| Endgame (L90) {b} | 90 | 1582 | 37.685655 / 37.685655 / 36.896768622 | 60/29/49/0% | 1582 / 1582 | 402 / 97 |');
    editText(path.join(writer, 'guide.md'), (t) => t.replace('against about 402', 'against about 300'));
    expect(rulesIn(check(writer).stderr)).toEqual(['verdict-line']);
    // A guide holding all three rungs' H2s isn't its one rung's.
    const all = betterWriter().writer;
    editText(path.join(all, 'guide.md'), (t) => t.replace('## Endgame: budget', '## Endgame: entering maps\n\n### Checks\n\n## Endgame: budget'));
    expect(lines(check(all).stderr, 'guide-sections')).toEqual([expect.stringMatching(/guide\.md's H2s are unexpected \["Endgame: entering maps"\]/)]);
    expect(tree(source)).toEqual(before);
  });

  it("its owned rares are specs: a guide printing an owned rare's own roll fails owned-guide; at its spec's minimum it passes", () => {
    const { source, writer } = betterWriter();
    // Ring 1 is the character's own rare (owned), "+40 to maximum Life" and "+30% to Fire Resistance"; the Boots roll
    // "+(20-30)% to Fire Resistance" at 0.8, so print 28%.
    editText(path.join(writer, 'guide.md'), (t) => t.replace('a rare Two-Stone Ring with maximum life and fire resistance', 'a rare Two-Stone Ring with +40 to maximum Life and +30% to Fire Resistance; Lizardscale Boots with +28% to Fire Resistance'));
    const stderr = check(writer).stderr;
    expect(rulesIn(stderr)).toEqual(['owned-guide']);
    expect(lines(stderr, 'owned-guide')).toEqual(expect.arrayContaining([
      expect.stringMatching(/guide\.md prints "\+40 to maximum Life", the character's own roll on its owned rare in Ring 1 \(stage b\); in a guide an owned rare is a spec, what any player buys/),
      expect.stringMatching(/guide\.md prints "\+30% to Fire Resistance", the character's own roll on its owned rare in Ring 1 \(stage b\)/),
      expect.stringMatching(/guide\.md prints "\+28% to Fire Resistance", the character's own roll on its owned rare in Boots \(stage b\)/),
    ]));
    // Ring 1's price entry with its spec (pricing's placement, §16): life required at 40, the roll, so that line is the spec's.
    editJson(source, 'plan.json', (p) => {
      const e = p.prices.find((x: Json) => x.id === 'b-ring-1');
      e.query.slot = 'Ring 1';
      e.spec = { base: 'Two-Stone Ring', weights: [], ranking: null, mustHaves: [{ affix: '+# to maximum Life', min: 40, tradeId: 'explicit.stat_3299347043' }], leftOut: [], searches: 1 };
    });
    const now = lines(check(writer).stderr, 'owned-guide');
    expect(now.some((l) => l.includes('"+40 to maximum Life", the character\'s own roll on its owned rare in Ring 1'))).toBe(false);
    expect(now.some((l) => l.includes('"+30% to Fire Resistance", the character\'s own roll on its owned rare in Ring 1'))).toBe(true);
  });

  it("owned-guide reads only the lines naming the rare's slot or base, and a roll only as a whole number", () => {
    const { source, writer } = betterWriter();
    // Ring 1 also rolls 5% cold resistance; the guide's other lines name other items.
    editJson(source, 'plan.json', (p) => {
      const ring = p.stages[0].items.slots.find((x: Json) => x.slot === 'Ring 1');
      ring.text = `${ring.text}\n+5% to Cold Resistance`;
    });
    editText(path.join(writer, 'guide.md'), (t) => t.replace('a rare Two-Stone Ring with maximum life and fire resistance;', 'a rare Two-Stone Ring with +25% to Cold Resistance and maximum life;\n\n- Gloves: any rare gloves with +40 to maximum Life.\n\nAlso'));
    expect(lines(check(writer).stderr, 'owned-guide')).toEqual([]);
    // The same roll on the ring's own line fails.
    editText(path.join(writer, 'guide.md'), (t) => t.replace('+25% to Cold Resistance', '+5% to Cold Resistance'));
    expect(lines(check(writer).stderr, 'owned-guide')).toEqual([expect.stringMatching(/guide\.md prints "\+5% to Cold Resistance", the character's own roll on its owned rare in Ring 1 \(stage b\)/)]);
  });

  it('the checker refuses the source as init does: a log naming the round with its legacy gem fails owned-guide', () => {
    const { writer } = betterWriter(false);
    expect(lines(check(writer).stderr, 'owned-guide')).toEqual([expect.stringMatching(/^check-run: \[owned-guide\] run-log\.json source: source\.name "compile\/2026-12-01-1" keeps the gem "Bloodlust" \(stage b group 8\), which a guide can't carry \(legacy, D-395\)/)]);
  });
});

// ---------------------------------------------------------------------------------------------------
// The writer writes only its own folder
// ---------------------------------------------------------------------------------------------------

describe('AC-W158 (WU-165, D-522, choice G): a writer run writes only its own folder', () => {
  it("its scripts, init to the checker, leave the guides root and the builds folder as they were but for its folder", () => {
    const root = newRoot();
    const source = betterSource(root);
    // A builds folder beside it, holding the better round's final file under its own name.
    const builds = path.join(TMP, `builds-${roots}`);
    fs.mkdirSync(builds);
    fs.copyFileSync(path.join(source, 'final-build.xml'), path.join(builds, 'imported-character better.xml'));
    const before = { root: tree(root), builds: tree(builds) };
    const { dir, r } = init(root, { kind: 'run-folder', name: 'compile/2026-12-01-1' }, 2);
    expect(r.code).toBe(0);
    expect(node(RENDER_AUDIT, [dir]).code).toBe(0);
    expect(write(dir, 'stage', { stage: 'W1', concept: 'file', attempt: 1, outcome: 'done' }).code).toBe(0);
    fs.copyFileSync(path.join(PIECES, 'writer-better-run', 'guide.md'), path.join(dir, 'guide.md'));
    expect(node(RENDER_NOTES, [dir]).code).toBe(0);
    expect(write(dir, 'set', { status: 'completed' }).code).toBe(0);
    passes(dir);
    expect(fs.readdirSync(dir).sort()).toEqual(['audit.md', 'guide.md', 'notes.txt', 'run-log.json']);
    const after = tree(root);
    for (const f of Object.keys(after).filter((f) => f.startsWith(`writer${path.sep}`))) delete after[f];
    expect({ root: after, builds: tree(builds) }).toEqual(before);
  });
});

// ---------------------------------------------------------------------------------------------------
// The renders' --source
// ---------------------------------------------------------------------------------------------------

describe("AC-W158 (WU-165, D-522): pob2-render-audit and pob2-render-notes read a writer run's source", () => {
  it('take --source and --build naming the source the log names, and refuse any other; another run takes no --source', () => {
    const { root, source, writer } = fileWriter();
    expect(node(RENDER_AUDIT, [writer, '--source', path.join(root, 'file', '2026-12-01-1')]).code).toBe(0);
    expect(node(RENDER_AUDIT, [writer, '--source', 'file/2026-12-01-2'])).toEqual({ code: 1, stdout: '', stderr: expect.stringMatching(/^render-audit: --source file\/2026-12-01-2 isn't this writer run's source, file\/2026-12-01-1 \(.*\), which its log names \(D-522\)\n$/) });
    expect(node(RENDER_AUDIT, [writer, '--source', 'file/2026-12-01-1', '--build', 'r1-a-1'])).toMatchObject({ code: 1, stderr: expect.stringMatching(/--build r1-a-1 isn't the source's build; the writer run's source\.build is file \(D-522\)/) });
    expect(node(RENDER_NOTES, [writer, '--source', 'compile/2026-12-01-1'])).toMatchObject({ code: 1, stderr: expect.stringMatching(/--source compile\/2026-12-01-1 isn't this writer run's source/) });
    expect(node(RENDER_AUDIT, [source, '--source', 'file/2026-12-01-1', '--build', 'file'])).toMatchObject({ code: 1, stderr: expect.stringMatching(/--source is a writer run's/) });
    expect(node(RENDER_NOTES, [source, '--source', 'file/2026-12-01-1', '--build', 'file'])).toMatchObject({ code: 1, stderr: expect.stringMatching(/--source is a writer run's/) });
    expect(node(RENDER_AUDIT, [writer, '--source'])).toMatchObject({ code: 2 });
    // A better round's root build: no --build.
    const better = betterWriter().writer;
    expect(node(RENDER_AUDIT, [better, '--source', 'compile/2026-12-01-1'])).toEqual({ code: 0, stdout: 'render-audit: wrote audit.md from compile/2026-12-01-1/plan.json, compile/2026-12-01-1/compile-record.json and reports/gates/D1-gate-file-a1.json\n', stderr: '' });
    expect(fs.readFileSync(path.join(better, 'audit.md'), 'utf8')).toBe(fs.readFileSync(path.join(PIECES, 'writer-better-run', 'audit.md'), 'utf8'));
  });
});
