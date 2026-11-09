/**
 * Amendment 16's M-30, WU-159 (D-516, C-61, Appendix A.6): piece runs, each script spawned as a real `node` process with
 * an explicit env and the test clock (`BUILD_GUIDE_TEST_NOW`, `tests/helpers/runningDigests.ts`'s `TEST_NOW`).
 *
 * - AC-W145 (a piece run's log): `pob2-run-log <folder> init` with `piece` and no slug or brief writes A.6's fields at skill
 *   revision 16, and refuses a piece outside the three, a slug or a brief beside a piece, and a source its piece doesn't
 *   take; the checker refuses a piece-run log with a slug or a brief; `resume` works on a piece folder; a piece run logs
 *   only its piece's steps.
 * - AC-W146 (a stop ends a piece run): a `price` entry counting `rate_limited` records its `pricing.stops[]` entry, and the
 *   script's line tells the runner to ask for the rung first when none is placed, set the status stopped and stop; the
 *   status is `stopped`; `pricing` is refused in a piece run; a resume clears the stop, so the step's next run may price.
 * - AC-W147 (the checker by piece; its unit parts): every pipeline fixture passes as it did at `cf16e07`; the fixture
 *   compile, pricing and writer runs (`tests/fixtures/pieces/`) pass, each fails on a planted fault of its piece's rule
 *   and on that rule only, and a fault of another piece's rule fails none; the slug-from-brief and flow rules don't fire
 *   on a piece run; the id `file` and the scopes `better` and `ladder` pass at write and in the checker, where a compile
 *   run or a file run takes them; the renders take a piece run's root build; `display design` serves a compile run's
 *   better round.
 *
 * check-run and render-audit load the server's compiled `build/plan/`: `mise run test` builds first.
 */
import { describe, it, expect, afterAll } from '@jest/globals';
import { spawnSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { digestReport, runningNames, TEST_NOW, TEST_NOW_MS } from '../helpers/runningDigests';

type Json = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

const REPO = path.resolve(__dirname, '..', '..');
const SCRIPTS = path.join(REPO, 'skills', 'build-guide', 'scripts');
const CHECKER = path.join(SCRIPTS, 'check-run.mjs');
const RUN_LOG = path.join(SCRIPTS, 'run-log.mjs');
const RENDER_AUDIT = path.join(SCRIPTS, 'render-audit.mjs');
const RENDER_NOTES = path.join(SCRIPTS, 'render-notes.mjs');
const PIPELINE = path.join(REPO, 'tests', 'fixtures', 'pipeline');
const PIECES = path.join(REPO, 'tests', 'fixtures', 'pieces');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'piece-runs-'));
afterAll(() => fs.rmSync(TMP, { recursive: true, force: true }));

const ENV = { PATH: '/usr/bin:/bin', LANG: 'C', BUILD_GUIDE_TEST_NOW: TEST_NOW };
function node(script: string, args: string[]) {
  const r = spawnSync(process.execPath, [script, ...args], { cwd: TMP, env: ENV, encoding: 'utf8', timeout: 60000 });
  return { code: r.status, stdout: r.stdout, stderr: r.stderr };
}
const check = (dir: string) => node(CHECKER, [dir]);
const write = (dir: string, kind: string, entry: Json) => node(RUN_LOG, [dir, kind, JSON.stringify(entry)]);
/** The broken rule's lines on stderr. */
const lines = (stderr: string, rule: string) => stderr.split('\n').filter((l) => l.startsWith(`check-run: [${rule}] `));
/** Every rule a checker's stderr names. */
const rulesIn = (stderr: string) => [...new Set(stderr.split('\n').map((l) => /^check-run: \[([^\]]+)\] /.exec(l)?.[1]).filter((x): x is string => x !== undefined))];
function passes(dir: string): void {
  const r = check(dir);
  expect({ stderr: r.stderr, code: r.code }).toEqual({ stderr: '', code: 0 });
}
const readJson = (dir: string, rel: string): Json => JSON.parse(fs.readFileSync(path.join(dir, rel), 'utf8')) as Json;
function writeJson(dir: string, rel: string, v: Json): void {
  fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
  fs.writeFileSync(path.join(dir, rel), `${JSON.stringify(v, null, 2)}\n`);
}
function editJson(dir: string, rel: string, edit: (v: Json) => void): void {
  const v = readJson(dir, rel);
  edit(v);
  writeJson(dir, rel, v);
}

let copies = 0;
/** A copy of a fixture run in its own guides root, `<root>/<piece or slug>/<date>-<n>/`, its log's runFolder that folder. */
function copy(from: string, folder: string): string {
  const dir = path.join(TMP, `root-${++copies}`, folder);
  fs.mkdirSync(path.dirname(dir), { recursive: true });
  fs.cpSync(from, dir, { recursive: true });
  editJson(dir, 'run-log.json', (l) => {
    l.runFolder = dir;
  });
  return dir;
}
const piece = (name: 'compile' | 'pricing' | 'writer') => copy(path.join(PIECES, `${name}-run`), `${name}/2026-12-01-1`);
/** A new, empty run folder under a guides root, `<root>/<segment>/2026-12-01-1`. */
function folder(segment: string): string {
  const dir = path.join(TMP, `root-${++copies}`, segment, '2026-12-01-1');
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}
const PRICING_INIT = { piece: 'pricing', mode: 'online', testConfig: 'none', noNinja: false, source: { kind: 'builds-folder', name: 'Fixture Titan' } };

// ---------------------------------------------------------------------------------------------------
// AC-W145: a piece run's log
// ---------------------------------------------------------------------------------------------------

describe("AC-W145 (WU-159, D-516): a piece run's log", () => {
  it("init with piece pricing and no slug or brief writes Appendix A.6's fields at revision 16, in A.6's order", () => {
    const dir = folder('pricing');
    expect(write(dir, 'init', PRICING_INIT)).toEqual({ code: 0, stdout: `run-log: wrote the first log\n${digestReport(REPO, TEST_NOW_MS)}`, stderr: '' });
    const log = readJson(dir, 'run-log.json');
    expect(Object.keys(log)).toEqual(['schemaVersion', 'skillRevision', 'piece', 'runFolder', 'status', 'mode', 'testConfig', 'noNinja', 'pinCommit', 'digest', 'source', 'stages', 'checkpoints', 'displays', 'escalations', 'faults', 'resumes', 'pricing']);
    expect(log).toEqual({
      schemaVersion: 4, skillRevision: 16, piece: 'pricing', runFolder: dir, status: 'running', mode: 'online', testConfig: 'none', noNinja: false,
      pinCommit: readJson(REPO, 'pob-pin.json').commit, digest: runningNames(REPO, TEST_NOW_MS),
      source: { kind: 'builds-folder', name: 'Fixture Titan' },
      stages: [], checkpoints: [], displays: [], escalations: [], faults: [], resumes: [], pricing: { stops: [], retries: [] },
    });
    for (const k of ['slug', 'brief', 'dossier', 'builds']) expect(log).not.toHaveProperty(k);
    // The other two pieces, with their own sources: an import code (no name) and a run folder with its build.
    const compile = folder('compile');
    expect(write(compile, 'init', { piece: 'compile', mode: 'offline', testConfig: 'none', noNinja: true, source: { kind: 'import-code' } }).code).toBe(0);
    expect(readJson(compile, 'run-log.json')).toMatchObject({ piece: 'compile', source: { kind: 'import-code' } });
    const writer = folder('writer');
    expect(write(writer, 'init', { piece: 'writer', mode: 'online', testConfig: 'none', noNinja: false, source: { kind: 'run-folder', name: 'titan-blood-hunt/2026-10-08-1', build: 'r1-a-2' } }).code).toBe(0);
    expect(readJson(writer, 'run-log.json').source).toEqual({ kind: 'run-folder', name: 'titan-blood-hunt/2026-10-08-1', build: 'r1-a-2' });
  });

  it('refuses a piece outside the three, a slug or a brief beside a piece, and a source its piece takes no part of; nothing is written', () => {
    const refused = (entry: Json, why: RegExp) => {
      const dir = folder('pricing');
      const r = write(dir, 'init', entry);
      expect({ code: r.code, stdout: r.stdout, stderr: r.stderr }).toEqual({ code: 1, stdout: '', stderr: expect.stringMatching(why) });
      expect(fs.existsSync(path.join(dir, 'run-log.json'))).toBe(false);
    };
    refused({ ...PRICING_INIT, piece: 'review' }, /piece "review" isn't one of compile, pricing, writer/);
    refused({ ...PRICING_INIT, slug: 'pricing' }, /slug is a \/pob2:build-guide run's; a piece run's log has no slug or brief/);
    refused({ ...PRICING_INIT, brief: {} }, /brief is a \/pob2:build-guide run's; a piece run's log has no slug or brief/);
    refused({ ...PRICING_INIT, source: undefined }, /source is what the pricing run started from/);
    // An import code is no name: the code itself never goes in the log.
    refused({ ...PRICING_INIT, source: { kind: 'import-code', name: 'eNrtXW1z2ziS…' } }, /an import code is no name, and the code itself never goes in the log/);
    refused({ ...PRICING_INIT, source: { kind: 'import-code', code: 'eNrtXW1z2ziS' } }, /source has "code", which isn't one of kind, name, sha1, build/);
    refused({ ...PRICING_INIT, source: { kind: 'run-folder', name: 'titan-blood-hunt/2026-10-08-1' } }, /a pricing run starts from "builds-folder" or "import-code"/);
    refused({ ...PRICING_INIT, piece: 'writer', source: { kind: 'builds-folder', name: 'x' } }, /a writer run starts from "run-folder"/);
    refused({ ...PRICING_INIT, source: { kind: 'builds-folder', name: 'x', sha1: 'abc' } }, /source\.sha1 is "abc"/);
    // A /pob2:build-guide run's init takes no source.
    refused({ slug: 'titan-blood-hunt', brief: {}, mode: 'offline', testConfig: 'none', noNinja: false, source: { kind: 'import-code' } }, /source is a piece run's \(D-516\)/);
  });

  it('the checker refuses a piece-run log with a slug or a brief, and one whose folder isn\'t its piece\'s', () => {
    const dir = piece('compile');
    passes(dir);
    editJson(dir, 'run-log.json', (l) => {
      l.slug = 'compile';
      l.brief = {};
    });
    expect(lines(check(dir).stderr, 'run-log')).toEqual([
      expect.stringMatching(/run-log\.json slug: is a \/pob2:build-guide run's; a compile run's log has no slug/),
      expect.stringMatching(/run-log\.json brief: is a \/pob2:build-guide run's; a compile run's log has no brief/),
    ]);
    const moved = copy(path.join(PIECES, 'compile-run'), 'pricing/2026-12-01-1');
    expect(lines(check(moved).stderr, 'run-log')).toEqual([expect.stringMatching(/isn't an absolute <root>\/compile\/<YYYY-MM-DD>-<n> path, the folder guide_run \{new_run: "compile"\} makes/)]);
  });

  it('resume works on a piece folder: its entry, status running, no stamp (the log is revision 16 from init), and the checker passes', () => {
    const dir = piece('compile');
    expect(write(dir, 'set', { status: 'stopped' }).code).toBe(0);
    expect(write(dir, 'resume', { noNinja: true })).toEqual({ code: 0, stdout: `run-log: wrote resumes[0], status running\n${digestReport(REPO, TEST_NOW_MS)}`, stderr: '' });
    const log = readJson(dir, 'run-log.json');
    expect(log).toMatchObject({ skillRevision: 16, status: 'running', noNinja: true, resumes: [{ digest: runningNames(REPO, TEST_NOW_MS), noNinja: true, lengths: { stages: 2, checkpoints: 0, escalations: 0, displays: 0 } }] });
    expect(log).not.toHaveProperty('skillRevisionFrom');
    expect(write(dir, 'set', { status: 'completed' }).code).toBe(0);
    passes(dir);
  });

  it("a piece run logs only its piece's steps (Appendix A.6); a writer run's W1 names its source's build", () => {
    const compile = piece('compile');
    expect(write(compile, 'stage', { stage: 'price', attempt: 1, outcome: 'done' })).toMatchObject({ code: 1, stderr: expect.stringMatching(/price isn't a compile run's step; a compile run logs read, measure, place, D1-build, D1-tree, D1-finish, D1-gate, F1/) });
    expect(write(compile, 'stage', { stage: 'R1a', attempt: 1, outcome: 'done' })).toMatchObject({ code: 1, stderr: expect.stringMatching(/R1a isn't a compile run's step/) });
    expect(write(compile, 'stage', { stage: 'read', attempt: 2, outcome: 'done' })).toMatchObject({ code: 0 });
    expect(write(compile, 'stage', { stage: 'measure', concept: 'file', attempt: 2, outcome: 'done' })).toMatchObject({ code: 1, stderr: expect.stringMatching(/a measure entry has no concept/) });
    const pricing = piece('pricing');
    expect(write(pricing, 'stage', { stage: 'measure', attempt: 1, outcome: 'done' })).toMatchObject({ code: 1, stderr: expect.stringMatching(/measure isn't a pricing run's step; a pricing run logs read, price/) });
    const writer = piece('writer');
    expect(write(writer, 'stage', { stage: 'W1', concept: 'r1-a-1', attempt: 2, outcome: 'done' })).toMatchObject({ code: 1, stderr: expect.stringMatching(/a writer run's W1 writes the guide of its source's build, r1-a-2/) });
    expect(write(writer, 'stage', { stage: 'W1', concept: 'r1-a-2', attempt: 2, outcome: 'done' })).toMatchObject({ code: 0 });
    // The checker holds a log written by hand to the same rule.
    editJson(pricing, 'run-log.json', (l) => {
      l.stages.push({ stage: 'measure', attempt: 1, outcome: 'done' });
    });
    expect(lines(check(pricing).stderr, 'run-log')).toEqual([expect.stringMatching(/stages\[2\]: is "measure", which a pricing run doesn't log; it logs read, price/)]);
  });
});

// ---------------------------------------------------------------------------------------------------
// AC-W146: a stop ends a piece run
// ---------------------------------------------------------------------------------------------------

describe('AC-W146 (WU-159, D-516): a pricing stop ends a piece run, and a resume is the retry', () => {
  function stopped(): string {
    const dir = folder('pricing');
    expect(write(dir, 'init', PRICING_INIT).code).toBe(0);
    expect(write(dir, 'stage', { stage: 'read', attempt: 1, outcome: 'done' }).code).toBe(0);
    const r = write(dir, 'stage', { stage: 'price', attempt: 1, outcome: 'done', priceOutcomes: { ok: 4, exchange: 2, rate_limited: 1 } });
    // The script's line is the runner's next step: the rung first when none is placed, the status stopped, the lockout's end.
    expect(r).toEqual({ code: 0, stderr: '', stdout: "run-log: wrote stages[1], and pricing.stops[0]: trade-site pricing stopped after rate_limited, which ends this pricing run: ask the user for the rung first when none is placed, set the status stopped, tell the user when the lockout ends, and stop; /pob2:pricing --resume <run folder> after it is the retry (D-516)\n" });
    expect(write(dir, 'set', { status: 'stopped' }).code).toBe(0);
    return dir;
  }

  it("a price entry counting rate_limited has its pricing.stops[] entry, and the run's status is stopped", () => {
    const dir = stopped();
    expect(readJson(dir, 'run-log.json')).toMatchObject({ status: 'stopped', pricing: { stops: [{ at: 1, step: 'price', outcome: 'rate_limited' }], retries: [] } });
    // The stop is recorded as the checker wants it; NFR-22's zero rate limits stands, the run's one finding.
    expect(rulesIn(check(dir).stderr)).toEqual(['nfr-22']);
  });

  it('pob2-run-log … pricing is refused in a piece run, and nothing is written', () => {
    const dir = stopped();
    const before = fs.readFileSync(path.join(dir, 'run-log.json'), 'utf8');
    expect(write(dir, 'pricing', { checkpoint: 'design', answer: 'retry-pricing' })).toEqual({ code: 1, stdout: '', stderr: expect.stringMatching(/pricing entry refused: a pricing run has no gate that asks to retry pricing: a stop ends the run \(status stopped\), and \/pob2:pricing --resume <run folder> after the lockout is the retry/) });
    expect(fs.readFileSync(path.join(dir, 'run-log.json'), 'utf8')).toBe(before);
    // A log written by hand with a retry answer fails the checker.
    editJson(dir, 'run-log.json', (l) => {
      l.pricing.retries.push({ checkpoint: 'design', answer: 'retry-pricing', at: 2 });
    });
    expect(lines(check(dir).stderr, 'run-log')).toEqual([expect.stringMatching(/pricing\.retries: holds 1 answer\(s\); a pricing run has no gate that asks to retry pricing/)]);
  });

  it('resume clears the stop: the price step runs again and prices; without the resume, that call fails the checker', () => {
    const dir = stopped();
    expect(write(dir, 'resume', { noNinja: false }).code).toBe(0);
    expect(write(dir, 'stage', { stage: 'price', attempt: 2, outcome: 'done', priceOutcomes: { ok: 3 } })).toEqual({ code: 0, stdout: 'run-log: wrote stages[2]\n', stderr: '' });
    expect(lines(check(dir).stderr, 'pricing')).toEqual([]);
    // The same call with no resume before it prices while the stop is open.
    const open = stopped();
    editJson(open, 'run-log.json', (l) => {
      l.stages.push({ stage: 'price', attempt: 2, outcome: 'done', priceOutcomes: { ok: 3 } });
    });
    expect(lines(check(open).stderr, 'pricing')).toEqual([expect.stringMatching(/stages\[2\] \(price attempt 2\) makes 3 trade-site price call\(s\) \(ok 3\), but pricing stopped at stages\[1\] \(price, rate_limited\) and no gate's retry-pricing, nor a resume, came after it/)]);
  });

  // WU-159's fix round: `place` is a better round's first step and prices (Appendix A.6), so a compile run that logged it
  // is held to pricing's rules, as one that logged a D1 step is.
  /** An online copy of the compile fixture, placed with `priceOutcomes`. */
  function placed(priceOutcomes: Json, mode = 'online'): string {
    const dir = piece('compile');
    editJson(dir, 'run-log.json', (l) => {
      l.mode = mode;
      l.status = 'running';
    });
    expect(write(dir, 'stage', { stage: 'place', attempt: 1, outcome: 'done', priceOutcomes }).code).toBe(0);
    return dir;
  }

  it("a compile run stopped at place: its stop recorded, the run stopped, and NFR-22's zero rate limits holds it", () => {
    const dir = placed({ ok: 2, rate_limited: 1 });
    expect(write(dir, 'set', { status: 'stopped' }).code).toBe(0);
    expect(readJson(dir, 'run-log.json')).toMatchObject({ status: 'stopped', pricing: { stops: [{ at: 2, step: 'place', outcome: 'rate_limited' }] } });
    expect(rulesIn(check(dir).stderr)).toEqual(['nfr-22']);
  });

  it('a compile run that prices again at place before a resume fails pricing; after a resume it may', () => {
    const open = placed({ ok: 2, locked_out: 1 });
    expect(write(open, 'stage', { stage: 'place', attempt: 2, outcome: 'done', priceOutcomes: { ok: 2 } }).code).toBe(0);
    expect(lines(check(open).stderr, 'pricing')).toEqual([expect.stringMatching(/stages\[3\] \(place attempt 2\) makes 2 trade-site price call\(s\) \(ok 2\), but pricing stopped at stages\[2\] \(place, locked_out\) and no gate's retry-pricing, nor a resume, came after it/)]);
    const resumed = placed({ ok: 2, locked_out: 1 });
    expect(write(resumed, 'resume', { noNinja: false }).code).toBe(0);
    expect(write(resumed, 'stage', { stage: 'place', attempt: 2, outcome: 'done', priceOutcomes: { ok: 2 } }).code).toBe(0);
    expect(lines(check(resumed).stderr, 'pricing')).toEqual([]);
  });

  it("an offline compile run's place that makes trade calls fails offline-prices", () => {
    const dir = placed({ ok: 2 }, 'offline');
    expect(lines(check(dir).stderr, 'offline-prices')).toEqual([expect.stringMatching(/stages\[2\]: an offline run made 2 price call\(s\); offline, no step calls a trade or poe\.ninja tool/)]);
    // With no trade call it passes: the exchange-free place of an offline run is the user's word.
    const word = placed({}, 'offline');
    expect(lines(check(word).stderr, 'offline-prices')).toEqual([]);
  });
});

// ---------------------------------------------------------------------------------------------------
// AC-W147: the checker by piece
// ---------------------------------------------------------------------------------------------------

/**
 * run-rival's research cites made-up Markdown data (`tests/fixtures/pipeline/data/`), so it is checked in the repository's
 * layout in a temp dir, as buildGuideAmendment11.test.ts does: the scripts (game knowledge's too) and references copied,
 * the server's build and data's JSON folders linked, the vocabulary copied, the fixture's Markdown data under its data/.
 */
const LAYOUT = path.join(TMP, 'repo');
const LAYOUT_CHECKER = path.join(LAYOUT, 'skills', 'build-guide', 'scripts', 'check-run.mjs');
function layout(): void {
  if (fs.existsSync(LAYOUT_CHECKER)) return;
  fs.mkdirSync(path.dirname(LAYOUT_CHECKER), { recursive: true });
  for (const f of fs.readdirSync(SCRIPTS).filter((x) => x.endsWith('.mjs'))) fs.copyFileSync(path.join(SCRIPTS, f), path.join(path.dirname(LAYOUT_CHECKER), f));
  fs.cpSync(path.join(REPO, 'skills', 'game-knowledge', 'scripts'), path.join(LAYOUT, 'skills', 'game-knowledge', 'scripts'), { recursive: true });
  fs.cpSync(path.join(REPO, 'skills', 'build-guide', 'references'), path.join(LAYOUT, 'skills', 'build-guide', 'references'), { recursive: true });
  fs.symlinkSync(path.join(REPO, 'build'), path.join(LAYOUT, 'build'));
  fs.mkdirSync(path.join(LAYOUT, 'data', 'rules'), { recursive: true });
  for (const d of ['campaign', 'economy', 'enemies']) fs.symlinkSync(path.join(REPO, 'data', d), path.join(LAYOUT, 'data', d));
  fs.copyFileSync(path.join(REPO, 'data', 'rules', 'vocabulary.md'), path.join(LAYOUT, 'data', 'rules', 'vocabulary.md'));
  fs.cpSync(path.join(PIPELINE, 'data'), path.join(LAYOUT, 'data'), { recursive: true });
}

describe('AC-W147 (WU-159, D-516): the checker by piece', () => {
  it('every pipeline fixture gives the result it gave at cf16e07: it passes (AC-W162)', () => {
    const runs = fs.readdirSync(PIPELINE).filter((f) => f.startsWith('run-')).sort();
    expect(runs).toEqual(['run-a11', 'run-a12', 'run-a13', 'run-a14', 'run-builds', 'run-composite', 'run-escalated', 'run-fixed-roll', 'run-interview', 'run-ok', 'run-ok-online', 'run-ok-v2', 'run-rival']);
    layout();
    for (const run of runs) {
      const r = run === 'run-rival' ? node(LAYOUT_CHECKER, [path.join(PIPELINE, run)]) : check(path.join(PIPELINE, run));
      expect({ run, code: r.code, stderr: r.stderr }).toEqual({ run, code: 0, stderr: '' });
    }
  });

  it('the fixture compile, pricing and writer runs pass; the slug-from-brief and flow rules fire on none', () => {
    for (const name of ['compile', 'pricing', 'writer'] as const) {
      const dir = piece(name);
      passes(dir);
      // Their steps would break the pipeline's order (read first, no brainstorm), and their logs hold no slug or brief.
      expect(readJson(dir, 'run-log.json')).not.toHaveProperty('slug');
    }
  });

  it("each fails on a planted fault of its piece's rule, that rule alone; another piece's rule doesn't hold it", () => {
    // Compile: the read stage's main group isn't its named damage source's (S7, rolled-skill).
    const compile = piece('compile');
    editJson(compile, 'plan.json', (p) => {
      p.stages[0].skills.main.group = 2;
    });
    expect(rulesIn(check(compile).stderr)).toEqual(['rolled-skill']);
    // Pricing: an offline run's price that isn't unavailable (offline-prices).
    const pricing = piece('pricing');
    editJson(pricing, 'plan.json', (p) => {
      Object.assign(p.prices[0], { status: 'ok', amount: 3, currency: 'divine', note: null });
    });
    expect(rulesIn(check(pricing).stderr)).toEqual(['offline-prices']);
    // The writer: a footnote marker in its guide (guide-markers).
    const writer = piece('writer');
    const guide = path.join(writer, 'guide.md');
    fs.writeFileSync(guide, fs.readFileSync(guide, 'utf8').replace('## FAQ', '## FAQ\n\nSee the note.[^1]'));
    expect(rulesIn(check(writer).stderr)).toEqual(['guide-markers']);
    // A compile run (no better round) isn't held to pricing's offline-prices; a pricing run isn't held to compile's S7.
    const compileLeague = piece('compile');
    editJson(compileLeague, 'plan.json', (p) => {
      p.league = 'Standard';
    });
    passes(compileLeague);
    const pricingMain = piece('pricing');
    editJson(pricingMain, 'plan.json', (p) => {
      p.stages[0].skills.main.group = 2;
    });
    passes(pricingMain);
    // A piece run's layout is A.6's: a pipeline file at its root fails the run's layout rule.
    const stray = piece('pricing');
    fs.writeFileSync(path.join(stray, 'dossier.md'), '# Dossier\n');
    expect(lines(check(stray).stderr, 'layout')).toEqual([expect.stringMatching(/dossier\.md isn't part of a pricing run's folder, whose files sit at its root: run-log\.json, source\.xml, plan\.json, read\.json, compile-record\.json, compiled-build\.xml, prices\.md, upgrades\.json/)]);
    // A completed compile run holds what its read and its measure wrote.
    const missing = piece('compile');
    fs.rmSync(path.join(missing, 'read.json'));
    expect(lines(check(missing).stderr, 'layout')).toEqual([expect.stringMatching(/read\.json is missing; a completed compile run holds source\.xml, plan\.json and read\.json/)]);
  });

  it('the id file and the scopes better and ladder pass at write and in the checker, where a compile run or a file run takes them', () => {
    // A compile run's better round: its D1 steps name file, with scope better; ladder is a file run's.
    const compile = piece('compile');
    expect(write(compile, 'stage', { stage: 'place', attempt: 1, outcome: 'done', priceOutcomes: { ok: 2 } }).code).toBe(0);
    expect(write(compile, 'stage', { stage: 'D1-build', concept: 'file', attempt: 1, outcome: 'done', scope: 'better' })).toEqual({ code: 0, stdout: 'run-log: wrote stages[3]\n', stderr: '' });
    expect(write(compile, 'stage', { stage: 'D1-tree', concept: 'file', attempt: 1, outcome: 'done', scope: 'ladder' })).toMatchObject({ code: 1, stderr: expect.stringMatching(/scope ladder is a file run's/) });
    expect(write(compile, 'stage', { stage: 'D1-tree', concept: 'r1-a-1', attempt: 1, outcome: 'done', scope: 'better' })).toMatchObject({ code: 1, stderr: expect.stringMatching(/a compile run's one build is file/) });
    expect(lines(check(compile).stderr, 'run-log')).toEqual([]);
    // A file run (/pob2:build-guide from a file: its brief's from, slug file, D-522): read, measure and place, then D1
    // with scope ladder on build file.
    const run = folder('file');
    expect(write(run, 'init', { slug: 'file', brief: { from: 'Fixture Titan' }, mode: 'offline', testConfig: 'none', noNinja: false }).code).toBe(0);
    for (const [stage, outcome] of [['read', 'done'], ['measure', 'done'], ['place', 'done']]) expect(write(run, 'stage', { stage, attempt: 1, outcome }).code).toBe(0);
    expect(write(run, 'build', { id: 'file', roll: { className: 'Warrior', ascendancy: 'Titan', skill: 'Blood Hunt' }, status: 'queued' })).toEqual({ code: 0, stdout: 'run-log: wrote builds[0]\n', stderr: '' });
    expect(write(run, 'stage', { stage: 'D1-build', concept: 'file', attempt: 1, outcome: 'done', scope: 'ladder' }).code).toBe(0);
    expect(write(run, 'stage', { stage: 'price', attempt: 1, outcome: 'done' })).toMatchObject({ code: 1, stderr: expect.stringMatching(/price is \/pob2:pricing's step/) });
    // The checker takes each entry and the build's folder; the brief's `from` gives the slug file (D-522), and a file run's
    // order (its build queued from its read, not a verification gate) is WU-164's own test's (fileRun.test.ts).
    fs.mkdirSync(path.join(run, 'builds', 'file'), { recursive: true });
    const fileRun = check(run).stderr;
    expect(lines(fileRun, 'run-log').filter((l) => /stages\[\d+\]|builds\[\d+\]/.test(l))).toEqual([]);
    expect(lines(fileRun, 'layout')).toEqual([]);
    // A pipeline run takes neither the steps nor the scopes, and no build file.
    const pipeline = folder('titan-blood-hunt');
    expect(write(pipeline, 'init', { slug: 'titan-blood-hunt', brief: { ascendancy: 'Titan', skill: 'Blood Hunt' }, mode: 'offline', testConfig: 'none', noNinja: false }).code).toBe(0);
    expect(write(pipeline, 'stage', { stage: 'read', attempt: 1, outcome: 'done' })).toMatchObject({ code: 1, stderr: expect.stringMatching(/read is a file run's step \(\/pob2:build-guide from a PoB file, slug file\) or a piece run's/) });
    expect(write(pipeline, 'stage', { stage: 'D1-build', concept: 'r1-a-1', attempt: 1, outcome: 'done', scope: 'better' })).toMatchObject({ code: 1, stderr: expect.stringMatching(/scope better is the better round's, a compile run's or a file run's/) });
    expect(write(pipeline, 'stage', { stage: 'D1-build', concept: 'file', attempt: 1, outcome: 'done' })).toMatchObject({ code: 1, stderr: expect.stringMatching(/concept "file" isn't a card id r<round>-<letter>-<n>$/m) });
    editJson(pipeline, 'run-log.json', (l) => {
      l.stages.push({ stage: 'D1-build', concept: 'r1-a-1', attempt: 1, outcome: 'done', scope: 'better' }, { stage: 'read', attempt: 1, outcome: 'done' });
    });
    expect(lines(check(pipeline).stderr, 'run-log')).toEqual([
      expect.stringMatching(/stages\[0\]: has scope better, the better round's, a compile run's or a file run's/),
      expect.stringMatching(/stages\[1\]: is read, a piece run's or a file run's step \(revision 16, D-516\); this run is neither/),
    ]);
  });

  /** A compile run whose better round reached its design gate: run-a14's build as the round's plan, record and D1 gate. */
  function betterRound(): string {
    const dir = piece('compile');
    const build = path.join(PIPELINE, 'run-a14', 'builds', 'r1-a-2');
    for (const f of ['plan.json', 'compile-record.json', 'trades.json']) fs.copyFileSync(path.join(build, f), path.join(dir, f));
    fs.mkdirSync(path.join(dir, 'reports', 'gates'), { recursive: true });
    fs.copyFileSync(path.join(PIPELINE, 'run-a14', 'reports', 'gates', 'D1-gate-r1-a-2-a1.json'), path.join(dir, 'reports', 'gates', 'D1-gate-file-a1.json'));
    fs.mkdirSync(path.join(dir, 'cards'));
    fs.writeFileSync(path.join(dir, 'cards', 'file.md'), "# Card file: Fixture Titan's Blood Hunt\n\n### Pitch\n\n- Name: Fixture Titan's Blood Hunt\n");
    editJson(dir, 'run-log.json', (l) => {
      l.status = 'running';
      l.stages.push(...['D1-build', 'D1-tree', 'D1-finish'].map((stage) => ({ stage, concept: 'file', attempt: 1, outcome: 'done', scope: 'better' })), { stage: 'D1-gate', concept: 'file', attempt: 1, outcome: 'pass', scope: 'better' });
    });
    return dir;
  }

  it("the renders take a piece run's root build, with no --build; a file run's build is --build file", () => {
    const dir = betterRound();
    const audit = node(RENDER_AUDIT, [dir]);
    expect(audit).toEqual({ code: 0, stdout: 'render-audit: wrote audit.md from plan.json, compile-record.json and reports/gates/D1-gate-file-a1.json\n', stderr: '' });
    expect(fs.readFileSync(path.join(dir, 'audit.md'), 'utf8').split('\n')[0]).toBe("# Audit: Titan / Blood Hunt, Fixture Titan's Blood Hunt");
    expect(node(RENDER_AUDIT, [dir, '--build', 'r1-a-2'])).toMatchObject({ code: 1, stderr: expect.stringMatching(/a compile run keeps its one build at the folder's root: pob2-render-audit <runFolder>, with no --build/) });
    // `--build file` is a build id the render takes (a file run's), so it reads the log rather than refusing the usage.
    expect(node(RENDER_AUDIT, [dir, '--build', 'file']).code).toBe(1);
    expect(node(RENDER_AUDIT, [dir, '--build', 'nope']).code).toBe(2);
    const writer = piece('writer');
    fs.rmSync(path.join(writer, 'notes.txt'));
    expect(node(RENDER_NOTES, [writer])).toEqual({ code: 0, stdout: expect.stringMatching(/^render-notes: wrote notes\.txt \(\d+ characters\) from guide\.md\n$/), stderr: '' });
    expect(fs.readFileSync(path.join(writer, 'notes.txt'), 'utf8')).toBe(fs.readFileSync(path.join(PIECES, 'writer-run', 'notes.txt'), 'utf8'));
    expect(node(RENDER_NOTES, [writer, '--build', 'r1-a-2'])).toMatchObject({ code: 1, stderr: expect.stringMatching(/a writer run keeps its one build at the folder's root: pob2-render-notes <runFolder>, with no --build/) });
    // Only a piece run takes its root build with no --build: any other folder gets the usage error, as before.
    expect(node(RENDER_NOTES, [path.join(PIPELINE, 'run-a14')])).toEqual({ code: 2, stdout: '', stderr: expect.stringMatching(/^usage: node render-notes\.mjs <runFolder> --build <card id>/) });
    expect(node(RENDER_NOTES, [path.join(TMP, 'no-such-folder')])).toMatchObject({ code: 2 });
  });

  it("F1's final-build.xml and readback.json at a compile run's root are part of its layout (Appendix A.6 omits them)", () => {
    const dir = betterRound();
    expect(lines(check(dir).stderr, 'layout')).toEqual([]);
    fs.writeFileSync(path.join(dir, 'final-build.xml'), '<?xml version="1.0" encoding="UTF-8"?>\n<PathOfBuilding2><Build level="90"/></PathOfBuilding2>\n');
    writeJson(dir, 'readback.json', { file: 'Fixture Titan better.xml', changes: [] });
    expect(lines(check(dir).stderr, 'layout')).toEqual([]);
    // A pricing run has no F1, so neither file is its.
    const pricing = piece('pricing');
    fs.writeFileSync(path.join(pricing, 'final-build.xml'), '<PathOfBuilding2/>\n');
    expect(lines(check(pricing).stderr, 'layout')).toEqual([expect.stringMatching(/final-build\.xml isn't part of a pricing run's folder/)]);
  });

  it('a file run logs the withdrawal after an answer change (D-480) for its build file; a pipeline run takes no file', () => {
    // A file run (slug file) whose build file passed F1 after the design gate's accept, then changed to the PoB file only.
    const run = folder('file');
    expect(write(run, 'init', { slug: 'file', brief: { from: 'Fixture Titan' }, mode: 'offline', testConfig: 'none', noNinja: false }).code).toBe(0);
    for (const stage of ['read', 'measure', 'place']) expect(write(run, 'stage', { stage, attempt: 1, outcome: 'done' }).code).toBe(0);
    expect(write(run, 'build', { id: 'file', roll: { className: 'Warrior', ascendancy: 'Titan', skill: 'Blood Hunt' }, status: 'queued' }).code).toBe(0);
    const from = path.join(PIPELINE, 'run-a14', 'builds', 'r1-a-2');
    fs.mkdirSync(path.join(run, 'builds', 'file'), { recursive: true });
    for (const f of ['plan.json', 'compile-record.json', 'trades.json', 'guide.md', 'audit.md']) fs.copyFileSync(path.join(from, f), path.join(run, 'builds', 'file', f));
    fs.mkdirSync(path.join(run, 'reports', 'gates'), { recursive: true });
    fs.copyFileSync(path.join(PIPELINE, 'run-a14', 'reports', 'gates', 'D1-gate-r1-a-2-a1.json'), path.join(run, 'reports', 'gates', 'D1-gate-file-a1.json'));
    for (const stage of ['D1-build', 'D1-tree', 'D1-finish']) expect(write(run, 'stage', { stage, concept: 'file', attempt: 1, outcome: 'done' }).code).toBe(0);
    expect(write(run, 'stage', { stage: 'D1-gate', concept: 'file', attempt: 1, outcome: 'pass' }).code).toBe(0);
    expect(node(RUN_LOG, [run, 'display', 'design', '--build', 'file']).code).toBe(0);
    expect(write(run, 'checkpoint', { checkpoint: 'design', concept: 'file', visit: 1, answer: 'accept', answeredBy: 'user', questions: 0 }).code).toBe(0);
    expect(write(run, 'stage', { stage: 'F1', concept: 'file', attempt: 1, outcome: 'pass' }).code).toBe(0);
    expect(write(run, 'answer-change', { checkpoint: 'design', visit: 1, from: 'accept', to: 'accept:file', note: 'just the file, thanks' })).toEqual({ code: 0, stdout: 'run-log: wrote answerChanges[0] (file: accept to accept:file, at stages[8])\n', stderr: '' });
    expect(node(RENDER_AUDIT, [run, '--withdraw', 'file'])).toEqual({ code: 0, stdout: 'render-audit: withdrew builds/file/audit.md and builds/file/guide.md for file, and logged withdrawn\n', stderr: '' });
    expect(readJson(run, 'run-log.json').withdrawals).toEqual([{ build: 'file', files: ['builds/file/audit.md', 'builds/file/guide.md'], at: 8 }]);
    // The checker takes both entries naming file (the file run's order is WU-164's own test's, fileRun.test.ts).
    expect(lines(check(run).stderr, 'run-log').filter((l) => /answerChanges|withdrawals/.test(l))).toEqual([]);
    // A pipeline run's withdrawal names a card.
    const pipeline = copy(path.join(PIPELINE, 'run-a14'), 'titan-blood-hunt/2026-10-08-1');
    editJson(pipeline, 'run-log.json', (l) => {
      l.withdrawals = [{ build: 'file', files: [], at: 14 }];
    });
    expect(lines(check(pipeline).stderr, 'run-log').filter((l) => /withdrawals/.test(l))).toEqual([expect.stringMatching(/run-log\.json withdrawals\[0\]: is \{"build":"file","files":\[\],"at":14\}; a withdrawal is \{build, files, at\}/)]);
  });

  it("display design serves a compile run's better round from its root build; a piece run has no other gate", () => {
    const dir = betterRound();
    const shown = node(RUN_LOG, [dir, 'display', 'design']);
    expect({ code: shown.code, stderr: shown.stderr }).toEqual({ code: 0, stderr: '' });
    expect(shown.stdout).toMatch(/^## The design gate, visit 1\n/);
    expect(shown.stdout).toContain("**Fixture Titan's Blood Hunt: budget endgame**");
    expect(readJson(dir, 'run-log.json').displays).toEqual([{ checkpoint: 'design', visit: 1 }]);
    // --build file is the same build; the design checkpoint names it.
    expect(node(RUN_LOG, [dir, 'display', 'design', '--build', 'file']).code).toBe(0);
    expect(write(dir, 'checkpoint', { checkpoint: 'design', concept: 'file', visit: 1, answer: 'accept', answeredBy: 'user', questions: 0 })).toEqual({ code: 0, stdout: 'run-log: wrote checkpoints[0]\n', stderr: '' });
    expect(node(RUN_LOG, [dir, 'display', 'design', '--build', 'r1-a-2'])).toMatchObject({ code: 1, stderr: expect.stringMatching(/a compile run's one build is file, at the folder's root/) });
    for (const gate of ['brainstorm', 'verification', 'final']) expect(node(RUN_LOG, [dir, 'display', gate])).toMatchObject({ code: 1, stderr: expect.stringMatching(new RegExp(`a compile run has no ${gate} gate`)) });
    expect(node(RUN_LOG, [piece('pricing'), 'display', 'design'])).toMatchObject({ code: 1, stderr: expect.stringMatching(/a pricing run has no design gate/) });
    // No builds[]: a piece run takes no build entry.
    expect(write(dir, 'build', { id: 'file', roll: { className: 'Warrior', ascendancy: 'Titan', skill: 'Blood Hunt' }, status: 'queued' })).toMatchObject({ code: 1, stderr: expect.stringMatching(/a compile run has no builds\[\]/) });
  });
});
