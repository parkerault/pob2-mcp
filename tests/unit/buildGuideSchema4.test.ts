/**
 * AC-W76 (WU-94, amendment 9: D-411…D-424): the run scripts on schema 4, each spawned as a real `node` process with an
 * explicit env.
 *
 * - `run-log.mjs`: `init` writes schema 4 with `noNinja`, the pin's commit from `pob-pin.json` and the newest league
 *   digest; `migrate` rewrites a schema-3 log (the build as `builds[0]` in "." with `concept` on its design and final
 *   checkpoints, a decline prefixed `decline:`); `build`, `resume`, the answer forms and F1's escalation; the displays
 *   `design --build` and `final --build`, the verification display's builds.
 * - `check-run.mjs` on `tests/fixtures/pipeline/run-builds`, a schema-4 run with two builds in `builds/<id>/`: r1-a-1 the
 *   full build (finalized `accept:file`, its campaign added after a resume, `campaign:r1-a-1`) and r1-a-2 an endgame-only
 *   build (F1, the endgame guide). Its order rules on copies whose log is rewritten from a compact script (`logFrom`);
 *   those copies are held to the flow's rules only (`flow`), their artifacts being run-builds'.
 * - `render-audit.mjs --build`, and `scripts/run-usage.mjs` over several transcripts with a shared telemetry file.
 *
 * check-run and render-audit load the server's compiled `build/plan/`: `mise run test` builds first.
 */
import { describe, it, expect, afterAll } from '@jest/globals';
import { spawnSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';

type Json = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

const REPO = path.resolve(__dirname, '..', '..');
const SCRIPTS = path.join(REPO, '.claude', 'skills', 'build-guide', 'scripts');
const CHECKER = path.join(SCRIPTS, 'check-run.mjs');
const RUN_LOG = path.join(SCRIPTS, 'run-log.mjs');
const RENDER = path.join(SCRIPTS, 'render-audit.mjs');
const USAGE = path.join(REPO, 'scripts', 'run-usage.mjs');
const FIXTURES = path.join(REPO, 'tests', 'fixtures', 'pipeline');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'schema4-'));
afterAll(() => fs.rmSync(TMP, { recursive: true, force: true }));

const ENV = { PATH: '/usr/bin:/bin', LANG: 'C' };
function node(script: string, args: string[], input?: string) {
  const r = spawnSync(process.execPath, [script, ...args], { cwd: TMP, env: ENV, encoding: 'utf8', timeout: 30000, input });
  return { code: r.status, stdout: r.stdout, stderr: r.stderr };
}
const check = (dir: string) => node(CHECKER, [dir]);
function passes(dir: string): void {
  const r = check(dir);
  expect({ stderr: r.stderr, code: r.code }).toEqual({ stderr: '', code: 0 });
}
/** The broken rule's lines on stderr. */
const lines = (stderr: string, rule: string) => stderr.split('\n').filter((l) => l.startsWith(`check-run: [${rule}] `));
/** The control flow's rules: the order, the routing, the caps, the escalations, the design gate, the V4 checks, builds[]. */
const FLOW = ['order', 'routing', 'caps', 'escalation', 'design-gate', 'verification', 'run-log'];
const flow = (dir: string) => FLOW.flatMap((rule) => lines(check(dir).stderr, rule));

let copies = 0;
function copy(fixture: string): string {
  const dir = path.join(TMP, `${fixture}-${++copies}`);
  fs.cpSync(path.join(FIXTURES, fixture), dir, { recursive: true });
  return dir;
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
function editText(dir: string, rel: string, from: string, to: string): void {
  const p = path.join(dir, rel);
  const t = fs.readFileSync(p, 'utf8');
  if (!t.includes(from)) throw new Error(`"${from}" not found in ${rel}`);
  fs.writeFileSync(p, t.replace(from, to));
}
const remove = (dir: string, rel: string) => fs.rmSync(path.join(dir, rel), { recursive: true, force: true });
/** A word as the checker counts one (D-283): a run of non-space characters holding a letter or a digit. */
const wordsIn = (text: string) => text.split(/\s+/).filter((t) => /[\p{L}\p{N}]/u.test(t)).length;

// ---------------------------------------------------------------------------------------------------
// A compact script of a run's log, so a variant of run-builds' flow is written in a few lines
// ---------------------------------------------------------------------------------------------------

/** A step `[stage, concept?, outcome, extra?]`; a gate's answer; an escalation; a resume. */
type Ev =
  | { s: string; c?: string; o: string; x?: Json }
  | { cp: string; a: string; c?: string; by?: string; rule?: string }
  | { esc: string; c: string; choice: string; g?: string }
  | { resume: true };
const ROUND = ['R1a', 'R1a-assemble', 'R1b-assemble', 'Q', 'RV'];
const step = (s: string, c: string | undefined, o: string, x?: Json): Ev => ({ s, ...(c ? { c } : {}), o, ...(x ? { x } : {}) });
const cp = (checkpoint: string, a: string, c?: string): Ev => ({ cp: checkpoint, a, ...(c ? { c } : {}) });
/**
 * The log `events` describe, on run-builds' fields: each step's attempt counted per (stage, card), each gate visit
 * numbered with its display, each escalation's verdict file its attempt's and its answer a checkpoint, and each resume
 * the four lists' lengths where it falls (D-415).
 */
function logFrom(base: Json, events: Ev[], fields: Json = {}): Json {
  const stages: Json[] = [];
  const checkpoints: Json[] = [];
  const displays: Json[] = [];
  const escalations: Json[] = [];
  const resumes: Json[] = [];
  const attempts = new Map<string, number>();
  const visits = new Map<string, number>();
  const visit = (gate: string) => {
    const v = (visits.get(gate) ?? 0) + 1;
    visits.set(gate, v);
    displays.push({ checkpoint: gate, visit: v });
    return v;
  };
  for (const e of events) {
    if ('s' in e) {
      const key = `${e.s}|${e.c}`;
      const n = ROUND.includes(e.s) ? 1 : (attempts.get(key) ?? 0) + 1;
      attempts.set(key, n);
      stages.push({ stage: e.s, ...(e.c ? { concept: e.c } : {}), attempt: n, outcome: e.o, ...(e.x ?? {}) });
    } else if ('cp' in e) {
      const v = visit(e.cp);
      checkpoints.push({ checkpoint: e.cp, ...(e.c ? { concept: e.c } : {}), visit: v, answer: e.a, answeredBy: e.by ?? 'user', ...(e.rule ? { rule: e.rule } : {}), questions: 0 });
    } else if ('esc' in e) {
      escalations.push({ stage: e.esc, concept: e.c, verdict: `reports/gates/${e.esc}-${e.c}-a${attempts.get(`${e.esc}|${e.c}`)}.json`, choice: e.choice, ...(e.g ? { guidance: e.g } : {}) });
      const v = visit('escalation');
      checkpoints.push({ checkpoint: 'escalation', visit: v, answer: e.choice === 'retry' ? `retry:${e.g}` : e.choice, answeredBy: 'user', questions: 0 });
    } else {
      resumes.push({ date: '2026-10-09', pinCommit: base.pinCommit, digest: base.digest, noNinja: false, lengths: { stages: stages.length, checkpoints: checkpoints.length, escalations: escalations.length, displays: displays.length } });
    }
  }
  return { ...base, stages, checkpoints, displays, escalations, resumes, ...fields };
}
/** run-builds' research and verification round, up to the verification gate. */
const RESEARCH: Ev[] = [
  step('R1a', undefined, 'done'), step('R1a', undefined, 'done'), step('R1a', undefined, 'done'), step('R1a-assemble', undefined, 'done'),
  cp('brainstorm', 'pick:r1-a-1,r1-a-2'),
  step('R1b', 'r1-a-1', 'pass', { probes: 2 }), step('R1b', 'r1-a-2', 'pass', { probes: 0 }), step('R1b-assemble', undefined, 'done'),
];
/** A design's D1 attempt: D1-build, D1-tree, D1-finish and the D1 gate (D-418). */
const D1 = (c: string, gate = 'pass'): Ev[] => [step('D1-build', c, 'done'), step('D1-tree', c, 'done'), step('D1-finish', c, 'done'), step('D1-gate', c, gate)];
/** r1-a-2 from its design to its accepted endgame guide. */
const ENDGAME_R1A2: Ev[] = [...D1('r1-a-2'), cp('design', 'accept', 'r1-a-2'), step('F1', 'r1-a-2', 'pass'), step('W1', 'r1-a-2', 'done'), step('V4', 'r1-a-2', 'pass')];
/** r1-a-1's campaign after the resume, as run-builds records it. */
const CAMPAIGN_R1A1: Ev[] = [
  { resume: true }, cp('verification', 'campaign:r1-a-1'),
  step('D2', 'r1-a-1', 'done'), step('D2-gate', 'r1-a-1', 'pass'), step('W1', 'r1-a-1', 'done'), step('V4', 'r1-a-1', 'fail'), step('W1', 'r1-a-1', 'done'), step('V4-recheck', 'r1-a-1', 'fail'),
  cp('final', 'accept', 'r1-a-1'),
];
/** run-builds' own log, as the script writes it. */
const RUN_BUILDS: Ev[] = [
  ...RESEARCH, cp('verification', 'pick:r1-a-1,r1-a-2'),
  ...D1('r1-a-1'), cp('design', 'accept:file', 'r1-a-1'), step('F1', 'r1-a-1', 'pass'),
  ...ENDGAME_R1A2, cp('final', 'accept', 'r1-a-2'),
  ...CAMPAIGN_R1A1,
];
/** A copy of run-builds whose log is `events`, with builds[]' statuses and the run's status given. */
function variant(events: Ev[], statuses: Record<string, string>, status = 'completed', extra: (dir: string) => void = () => {}): string {
  const dir = copy('run-builds');
  editJson(dir, 'run-log.json', (l) => {
    Object.assign(l, logFrom(l, events, { status }));
    for (const b of l.builds) if (statuses[b.id]) b.status = statuses[b.id];
  });
  extra(dir);
  return dir;
}
/** A gate verdict file, the D1 gate's shape for D1-gate (run-builds' attempt 1, with `verdict` and `findings`), else the D2 gate's. */
function gateFile(dir: string, stage: string, c: string, attempt: number, verdict: Json, findings: Json[] = []): void {
  const base = stage === 'D1-gate' ? readJson(path.join(FIXTURES, 'run-builds'), `reports/gates/D1-gate-${c}-a1.json`) : { stage, concept: c, attempt, verdict: {}, findings: [], finalCompile: { compiled: true, errors: [], recordPath: `builds/${c}/compile-record.json`, pobFile: `titan-blood-hunt-2026-10-08-1-${c}.xml` } };
  writeJson(dir, `reports/gates/${stage}-${c}-a${attempt}.json`, { ...base, attempt, verdict: { ...base.verdict, ...verdict }, findings });
}

// ---------------------------------------------------------------------------------------------------
// run-log.mjs: init, migrate, build, resume and the answer forms
// ---------------------------------------------------------------------------------------------------

describe('AC-W76: run-log.mjs writes schema 4 (D-412)', () => {
  const folder = () => {
    const dir = path.join(TMP, `log-${++copies}`);
    fs.mkdirSync(dir);
    return dir;
  };
  const write = (dir: string, kind: string, entry: Json) => node(RUN_LOG, [dir, kind, JSON.stringify(entry)]);
  const INIT = { slug: 'titan-blood-hunt', brief: { ascendancy: 'Titan', skill: 'Blood Hunt' }, mode: 'offline', testConfig: 'none' };

  it("init records noNinja, the pin's commit from pob-pin.json and the newest league digest, with builds[], no roll or outputs, and resumes[]", () => {
    const dir = folder();
    expect(write(dir, 'init', { ...INIT, noNinja: true })).toEqual({ code: 0, stdout: 'run-log: wrote the first log\n', stderr: '' });
    const log = readJson(dir, 'run-log.json');
    const pin = readJson(REPO, 'pob-pin.json').commit;
    // Amendment 11 (WU-113, §19, D-444): the skill revision and the pricing stops and retries; amendment 12 (§22): 12.
    expect(log).toEqual({
      schemaVersion: 4, skillRevision: 12, runFolder: dir, slug: 'titan-blood-hunt', brief: INIT.brief, status: 'running', mode: 'offline', testConfig: 'none',
      noNinja: true, pinCommit: pin, digest: 'runes-of-aldur.md', dossier: null, builds: [], stages: [], checkpoints: [], displays: [], escalations: [], faults: [], resumes: [],
      pricing: { stops: [], retries: [] },
    });
    // noNinja is the runner's to state: init refuses a first write without it (D-412, D-420).
    const other = folder();
    expect(write(other, 'init', INIT)).toMatchObject({ code: 1, stderr: expect.stringMatching(/^run-log: init entry refused: noNinja is true or false/) });
    expect(fs.readdirSync(other)).toEqual([]);
  });

  it('init reads the pin and the digest beside its own scripts: the newest digest by the fetch date on its third line, not by name', () => {
    // The repository's layout in a temp dir: the scripts, a pob-pin.json and two digests.
    const root = path.join(TMP, `repo-${++copies}`);
    const scripts = path.join(root, '.claude', 'skills', 'build-guide', 'scripts');
    fs.mkdirSync(scripts, { recursive: true });
    for (const f of fs.readdirSync(SCRIPTS).filter((x) => x.endsWith('.mjs'))) fs.copyFileSync(path.join(SCRIPTS, f), path.join(scripts, f));
    writeJson(root, 'pob-pin.json', { repo: 'x', tag: 'v0.0.1', commit: '0123456789abcdef0123456789abcdef01234567', version: '0.0.1', headlessWrapperSha1: 'x' });
    fs.mkdirSync(path.join(root, 'data', 'league'), { recursive: true });
    fs.writeFileSync(path.join(root, 'data', 'league', 'a-newer-league.md'), '# League digest: A\n\nA (0.6) on poe2db.tw, fetched 2026-11-02. In-pin flags: checked.\n');
    fs.writeFileSync(path.join(root, 'data', 'league', 'z-older-league.md'), '# League digest: Z\n\nZ (0.5) on poe2db.tw, fetched 2026-10-18. In-pin flags: checked.\n');
    fs.writeFileSync(path.join(root, 'data', 'league', 'z-older-league.rule-changers.json'), '{}');
    const dir = folder();
    expect(node(path.join(scripts, 'run-log.mjs'), [dir, 'init', JSON.stringify({ ...INIT, noNinja: false })]).code).toBe(0);
    expect(readJson(dir, 'run-log.json')).toMatchObject({ noNinja: false, pinCommit: '0123456789abcdef0123456789abcdef01234567', digest: 'a-newer-league.md' });
  });

  it('build adds a finalized card queued with its identity in builds/<id>, then changes its status, guide and PoB file; a card with a build is never finalized again', () => {
    const dir = folder();
    write(dir, 'init', { ...INIT, noNinja: false });
    const roll = { className: 'Warrior', ascendancy: 'Titan', skill: 'Blood Hunt' };
    expect(write(dir, 'build', { id: 'r1-a-2', roll, status: 'queued' })).toEqual({ code: 0, stdout: 'run-log: wrote builds[0]\n', stderr: '' });
    expect(write(dir, 'build', { id: 'r1-a-2', status: 'file-only', pobFile: 'titan-blood-hunt-2026-10-08-1-r1-a-2.xml' }).code).toBe(0);
    expect(write(dir, 'build', { id: 'r1-a-2', guide: 'endgame', status: 'completed' }).code).toBe(0);
    expect(readJson(dir, 'run-log.json').builds).toEqual([{ id: 'r1-a-2', roll, status: 'completed', folder: 'builds/r1-a-2', guide: 'endgame', pobFile: 'titan-blood-hunt-2026-10-08-1-r1-a-2.xml' }]);
    const refused: [Json, RegExp][] = [
      [{ id: 'r1-a-3', status: 'designing' }, /r1-a-3 has no build yet; a new build is \{"id", "roll", "status": "queued"\}/],
      [{ id: 'r1-a-2', roll, status: 'queued' }, /r1-a-2 already has a build \(completed\); a card with a build in the run isn't finalized again/],
      [{ id: 'r1-a-2', roll: { ...roll, skill: 'Sunder' } }, /r1-a-2's identity is .*; a build keeps its card's identity \(D-286\)/],
      [{ id: 'r1-a-2', status: 'done' }, /status is queued, designing, writing, completed, file-only, not-accepted, dropped, stopped, escalated/],
      [{ id: 'r1-a-2', guide: 'campaign' }, /guide is null, endgame or full \(D-414\)/],
      [{ id: 'r1-a-2', folder: '.' }, /"folder" isn't a field of a build entry/],
    ];
    for (const [entry, why] of refused) expect(write(dir, 'build', entry)).toMatchObject({ code: 1, stdout: '', stderr: expect.stringMatching(why) });
    // set takes schema 4's dossier; the run-level roll and outputs are gone.
    expect(write(dir, 'set', { dossier: 'dossier.md' }).code).toBe(0);
    expect(write(dir, 'set', { roll }).stderr).toMatch(/"roll" isn't a field of a set entry \(status, dossier, faults\)/);
  });

  it("resume appends {date, pinCommit, digest, noNinja, lengths} with the four lists' lengths and sets status running; a schema-3 log is migrated first", () => {
    const dir = copy('run-builds');
    editJson(dir, 'run-log.json', (l) => {
      l.resumes = [];
      l.status = 'completed';
    });
    // Amendment 11 (§19): the resume stamps the older log with the skill revision, held from here on.
    // Amendment 12 (Appendix A): an older log is stamped 12, with a boundary for each of amendments 11 and 12.
    expect(write(dir, 'resume', { noNinja: true })).toEqual({ code: 0, stdout: 'run-log: wrote resumes[0], status running, skillRevision 12 from stages[25] (the rules of amendments 11 and 12)\n', stderr: '' });
    const log = readJson(dir, 'run-log.json');
    expect(log.status).toBe('running');
    expect(log.resumes).toEqual([{ date: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/), pinCommit: readJson(REPO, 'pob-pin.json').commit, digest: 'runes-of-aldur.md', noNinja: true, lengths: { stages: 25, checkpoints: 7, escalations: 0, displays: 7 } }]);
    expect(write(dir, 'resume', {}).stderr).toMatch(/noNinja is true or false: whether this session prices without poe\.ninja/);
    const old = copy('run-ok');
    expect(write(old, 'resume', { noNinja: false }).stderr).toBe('run-log: resume entry refused: run-log.json is a schema-3 log; resume is schema 4\'s (amendment 9): run run-log.mjs <runFolder> migrate first\n');
  });

  it("takes schema 4's answer forms: 1–3 cards finalized, accept:file, the final gate's campaign, accept:verification and decline:<note>, a resume's guide:, campaign: and design:, F1's escalation", () => {
    const dir = copy('run-builds');
    const answer = (entry: Json) => {
      expect(node(RUN_LOG, [dir, 'display', entry.checkpoint, ...(entry.concept ? ['--build', entry.concept] : [])]).code).toBe(0);
      return write(dir, 'checkpoint', { answeredBy: 'user', questions: 0, ...entry, visit: readJson(dir, 'run-log.json').checkpoints.filter((c: Json) => c.checkpoint === entry.checkpoint).length + 1 });
    };
    for (const entry of [
      { checkpoint: 'design', concept: 'r1-a-2', answer: 'accept:file' },
      { checkpoint: 'final', concept: 'r1-a-2', answer: 'campaign' },
      { checkpoint: 'final', concept: 'r1-a-1', answer: 'accept:verification' },
      { checkpoint: 'final', concept: 'r1-a-1', answer: "decline:the guide's too long for me" },
      { checkpoint: 'verification', answer: 'pick:r1-a-3,r1-b-1' },
    ]) {
      expect({ entry, ...answer(entry) }).toEqual({ entry, code: 0, stdout: expect.stringMatching(/^run-log: wrote checkpoints\[\d+\]\n$/), stderr: '' });
    }
    // The resume's answers name a build in the status they take, and only after a resume.
    editJson(dir, 'run-log.json', (l) => {
      l.builds[0].status = 'file-only';
      l.builds[1].status = 'stopped';
    });
    for (const a of ['guide:r1-a-1', 'campaign:r1-a-1', 'design:r1-a-2']) expect({ a, ...answer({ checkpoint: 'verification', answer: a }) }).toMatchObject({ a, code: 0 });
    expect(answer({ checkpoint: 'verification', answer: 'design:r1-a-1' }).stderr).toMatch(/design:r1-a-1 needs a stopped or dropped build, and r1-a-1 is file-only \(D-415\)/);
    expect(answer({ checkpoint: 'verification', answer: 'pick:r1-a-1' }).stderr).toMatch(/r1-a-1 already has a build \(file-only\); a card with a build in the run isn't finalized again/);
    editJson(dir, 'run-log.json', (l) => (l.resumes = []));
    expect(answer({ checkpoint: 'verification', answer: 'guide:r1-a-1' }).stderr).toMatch(/guide:r1-a-1 is an answer a resume offers; this run hasn't been resumed \(D-415\)/);
    // A design or final checkpoint names its build; the final gate's stop is the default only.
    expect(write(dir, 'checkpoint', { checkpoint: 'design', visit: 4, answer: 'accept', answeredBy: 'user' }).stderr).toMatch(/a design checkpoint names its build: concept, the card id/);
    expect(node(RUN_LOG, [dir, 'display', 'final', '--build', 'r1-a-1']).code).toBe(0);
    expect(write(dir, 'checkpoint', { checkpoint: 'final', concept: 'r1-a-9', visit: 6, answer: 'accept', answeredBy: 'user' }).stderr).toMatch(/concept r1-a-9 names no build of the run/);
    expect(write(dir, 'checkpoint', { checkpoint: 'final', concept: 'r1-a-1', visit: 6, answer: 'stop', answeredBy: 'user' }).stderr).toMatch(/the final gate's stop is the default answer only; a user who declines the guide answers decline:<note>/);
    expect(write(dir, 'checkpoint', { checkpoint: 'final', concept: 'r1-a-1', visit: 6, answer: 'the guide reads long', answeredBy: 'user' }).stderr).toMatch(/"the guide reads long" isn't an answer of the final checkpoint/);
    // F1 escalates (D-413); stages D1-tree, F1, V4-campaign and the outcome refused (D-421).
    expect(write(dir, 'escalation', { stage: 'F1', concept: 'r1-a-2', verdict: 'reports/gates/F1-r1-a-2-a2.json', choice: 'retry', guidance: 'keep the boots' }).code).toBe(0);
    for (const s of [{ stage: 'D1-tree', concept: 'r1-a-2', attempt: 2, outcome: 'done' }, { stage: 'F1', concept: 'r1-a-2', attempt: 3, outcome: 'refused' }, { stage: 'V4-campaign', concept: 'r1-a-1', attempt: 1, outcome: 'pass' }]) {
      expect({ s, ...write(dir, 'stage', s) }).toMatchObject({ s, code: 0 });
    }
    expect(write(dir, 'stage', { stage: 'D1-tree', concept: 'r1-a-2', attempt: 3, outcome: 'pass' }).stderr).toMatch(/a D1-tree entry's outcome is done, respec, missing, not "pass"/);
    // A schema-3 log keeps schema 3's forms until it is migrated.
    const old = copy('run-ok');
    expect(write(old, 'stage', { stage: 'D1-tree', concept: 'r1-a-1', attempt: 1, outcome: 'done' }).stderr).toMatch(/stage "D1-tree" isn't one of .*\(D1-tree is schema 4's: migrate the log first\)/);
  });
});

describe('AC-W76: migrate rewrites a schema-3 log as schema 4 (D-415)', () => {
  const migrate = (dir: string) => node(RUN_LOG, [dir, 'migrate']);

  it('a run with a build: builds[0] in ".", its roll, status, guide and PoB file; concept on its design and final checkpoints; and the checker passes it', () => {
    const dir = copy('run-ok');
    const old = readJson(dir, 'run-log.json');
    expect(migrate(dir)).toEqual({ code: 0, stdout: 'run-log: migrated run-log.json to schema 4, r1-a-1 as builds[0] in "." (completed)\n', stderr: '' });
    const log = readJson(dir, 'run-log.json');
    expect(log.schemaVersion).toBe(4);
    expect('roll' in log || 'outputs' in log).toBe(false);
    expect(log.builds).toEqual([{ id: 'r1-a-1', roll: old.roll, status: 'completed', folder: '.', guide: 'full', pobFile: 'titan-blood-hunt-2026-10-08-1.xml' }]);
    expect({ dossier: log.dossier, noNinja: log.noNinja, pinCommit: log.pinCommit, digest: log.digest, resumes: log.resumes }).toEqual({ dossier: 'dossier.md', noNinja: null, pinCommit: null, digest: null, resumes: [] });
    expect(log.checkpoints.filter((c: Json) => ['design', 'final'].includes(c.checkpoint)).map((c: Json) => [Object.keys(c)[1], c.concept])).toEqual([['concept', 'r1-a-1'], ['concept', 'r1-a-1']]);
    expect(log.stages).toEqual(old.stages);
    passes(dir);
    expect(migrate(dir)).toEqual({ code: 1, stdout: '', stderr: 'run-log: migrate refused: run-log.json is already a schema-4 log; migrate rewrites a schema-3 log as schema 4 (D-415)\n' });
  });

  it('a run with no build (stopped at the verification gate) becomes schema 4 with no build, and passes', () => {
    const dir = copy('run-interview');
    expect(migrate(dir)).toEqual({ code: 0, stdout: 'run-log: migrated run-log.json to schema 4, with no build\n', stderr: '' });
    expect(readJson(dir, 'run-log.json').builds).toEqual([]);
    passes(dir);
  });

  it('an escalated run migrates its build escalated, and passes', () => {
    const dir = copy('run-escalated');
    expect(migrate(dir).stdout).toBe('run-log: migrated run-log.json to schema 4, r1-a-1 as builds[0] in "." (escalated)\n');
    passes(dir);
  });

  it('prefixes a schema-3 decline with decline:, and the build migrates not-accepted', () => {
    const dir = copy('run-ok');
    editJson(dir, 'run-log.json', (l) => {
      l.checkpoints[3] = { ...l.checkpoints[3], answer: "the guide's too long", answeredBy: 'user' };
      delete l.checkpoints[3].rule;
      l.status = 'not-accepted';
    });
    passes(dir);
    expect(migrate(dir).code).toBe(0);
    const log = readJson(dir, 'run-log.json');
    expect(log.checkpoints[3]).toEqual({ checkpoint: 'final', concept: 'r1-a-1', visit: 1, answer: "decline:the guide's too long", answeredBy: 'user' });
    expect(log.builds[0].status).toBe('not-accepted');
    passes(dir);
  });

  it("§16's path through the real scripts: a run stopped at its design gate migrates stopped, then a resume, design:<id> and accept:file give its PoB file through F1", () => {
    const dir = copy('run-ok');
    // run-ok, stopped at its design gate: no D2, no guide, no V4 (the open-clear run's shape).
    editJson(dir, 'run-log.json', (l) => {
      l.stages = l.stages.slice(0, l.stages.findIndex((s: Json) => s.stage === 'D2'));
      l.checkpoints = l.checkpoints.slice(0, 2).concat([{ checkpoint: 'design', visit: 1, answer: 'stop', answeredBy: 'user' }]);
      l.displays = l.displays.slice(0, 3);
      l.status = 'stopped';
      l.outputs = { plan: null, record: null, dossier: null, guide: null, pobFile: null };
    });
    for (const rel of ['guide.md', 'audit.md', 'reports/V4-1.md', 'reports/V4-2.md', 'rounds', 'reports/gates/D2-gate-r1-a-1-a1.json']) remove(dir, rel);
    expect(migrate(dir).stdout).toBe('run-log: migrated run-log.json to schema 4, r1-a-1 as builds[0] in "." (stopped)\n');
    const run = (...args: string[]) => node(RUN_LOG, [dir, ...args]);
    expect(run('resume', JSON.stringify({ noNinja: false })).code).toBe(0);
    const shown = run('display', 'verification');
    expect(shown.code).toBe(0);
    expect(shown.stdout).toContain('- Blood Hunt bleed burst: stopped.');
    expect(run('checkpoint', JSON.stringify({ checkpoint: 'verification', visit: 2, answer: 'design:r1-a-1', answeredBy: 'user', questions: 0 }))).toMatchObject({ code: 0 });
    const design = run('display', 'design', '--build', 'r1-a-1');
    expect(design.stdout).toMatch(/^## The design gate, visit 2\n\nThe endgame build for Blood Hunt bleed burst, rung by rung/);
    expect(run('checkpoint', JSON.stringify({ checkpoint: 'design', concept: 'r1-a-1', visit: 2, answer: 'accept:file', answeredBy: 'user', questions: 0 })).code).toBe(0);
    writeJson(dir, 'reports/gates/F1-r1-a-1-a1.json', { stage: 'F1', concept: 'r1-a-1', attempt: 1, verdict: { compiled: 'pass', v1: 'pass', v2: 'pass' }, findings: [], finalCompile: { compiled: true, errors: [], recordPath: 'compile-record.json', pobFile: 'titan-blood-hunt-2026-10-08-1.xml' } });
    expect(run('stage', JSON.stringify({ stage: 'F1', concept: 'r1-a-1', attempt: 1, outcome: 'pass' })).code).toBe(0);
    expect(run('build', JSON.stringify({ id: 'r1-a-1', status: 'file-only', pobFile: 'titan-blood-hunt-2026-10-08-1.xml' })).code).toBe(0);
    expect(run('set', JSON.stringify({ status: 'completed' })).code).toBe(0);
    passes(dir);
  });
});

// ---------------------------------------------------------------------------------------------------
// check-run.mjs: two builds, their guides, and the order rules
// ---------------------------------------------------------------------------------------------------

describe('AC-W76: the checker reads a schema-4 run with its builds in builds/<id>/ (D-412, D-414)', () => {
  it('passes run-builds: a full build and an endgame build, each guide held to its template', () => {
    passes(copy('run-builds'));
    // The fixture's log is the one the compact script writes, so the order variants below differ from it alone.
    const dir = variant(RUN_BUILDS, {});
    expect(readJson(dir, 'run-log.json')).toEqual(readJson(path.join(FIXTURES, 'run-builds'), 'run-log.json'));
  });

  it("holds each guide to its template's H2s: the endgame guide's twelve, the full guide's fourteen", () => {
    const endgame = copy('run-builds');
    editText(endgame, 'builds/r1-a-2/guide.md', '## Switching over\n', '## Leveling\n');
    expect(lines(check(endgame).stderr, 'guide-sections')).toEqual([expect.stringMatching(/^check-run: \[guide-sections\] builds\/r1-a-2: guide\.md's H2s are missing \["Switching over"\]; the endgame guide's \(D-414\) H2s are \["At a glance","Your PoB file","Switching over",.*"Changelog"\] in that order: its plan has no campaign stage$/)]);
    const full = copy('run-builds');
    editText(full, 'builds/r1-a-1/guide.md', '## Leveling\n', '## Switching over\n');
    expect(lines(check(full).stderr, 'guide-sections')).toEqual([expect.stringMatching(/^check-run: \[guide-sections\] builds\/r1-a-1: guide\.md's H2s are missing \["Leveling"\]; §8 wants/)]);
  });

  it("the endgame guide's 2,300-word cap, the H1, the import code and Known issues aside: 2,300 pass, 2,301 fail", () => {
    const padTo = (total: number) => {
      const dir = copy('run-builds');
      const text = fs.readFileSync(path.join(dir, 'builds/r1-a-2/guide.md'), 'utf8');
      const code = /```\n([^\n]*)\n```/.exec(text)![1];
      const counted = text.split('\n').filter((l) => !l.startsWith('# ') && l !== code && l !== 'None.').join('\n');
      expect(total - wordsIn(counted)).toBeGreaterThan(0);
      editText(dir, 'builds/r1-a-2/guide.md', '## Changelog\n', `${'filler '.repeat(total - wordsIn(counted))}\n\n## Changelog\n`);
      return dir;
    };
    passes(padTo(2300));
    expect(lines(check(padTo(2301)).stderr, 'word-cap')).toEqual(['check-run: [word-cap] builds/r1-a-2: guide.md has 2301 words, over the 2300-word cap of the endgame guide (D-414) (the H1, the import code and the Known issues list not counted; D-276, D-283)']);
  });

  it("the reward-pick rule for a plan with no campaign stage: every rung carries the same pick for each reward choice the campaign offers, and Switching over names each", () => {
    const missing = copy('run-builds');
    editJson(missing, 'builds/r1-a-2/plan.json', (p) => (p.stages[1].config.scenario = p.stages[1].config.scenario.filter((e: Json) => !/Tawhoa/.test(e.option))));
    expect(lines(check(missing).stderr, 'campaign-rewards')).toEqual([expect.stringMatching(/^check-run: \[campaign-rewards\] builds\/r1-a-2: rung b of a plan with no campaign stage picks no reward for q\.act-4-halls-of-the-dead-tawhoa-s-test: D1 makes each reward choice/)]);
    const twoWays = copy('run-builds');
    editJson(twoWays, 'builds/r1-a-2/plan.json', (p) => (p.stages[2].config.scenario.find((e: Json) => /Tawhoa/.test(e.option)).value = '+5% to Lightning Resistance'));
    expect(lines(check(twoWays).stderr, 'campaign-rewards')).toEqual([expect.stringMatching(/rungs m, b, n pick q\.act-4-halls-of-the-dead-tawhoa-s-test's reward 2 different ways/)]);
    const unnamed = copy('run-builds');
    editText(unnamed, 'builds/r1-a-2/guide.md', '- +5 to Dexterity.\n', '');
    expect(lines(check(unnamed).stderr, 'campaign-rewards')).toEqual([expect.stringMatching(/the plan picks "\+5 to Dexterity" for q\.act-4-halls-of-the-dead-tawhoa-s-test, but guide\.md's "Switching over" doesn't name it by its first line "\+5 to Dexterity"/)]);
  });

  it("fails a design checkpoint with no concept, and a build whose guide field disagrees with its plan (no campaign stage means endgame)", () => {
    const noConcept = copy('run-builds');
    editJson(noConcept, 'run-log.json', (l) => delete l.checkpoints[2].concept);
    expect(lines(check(noConcept).stderr, 'run-log')).toContainEqual('check-run: [run-log] run-log.json checkpoints[2]: is a design checkpoint with concept undefined; in schema 4 a design checkpoint names its build, the card id (D-412)');
    const wrongGuide = copy('run-builds');
    editJson(wrongGuide, 'run-log.json', (l) => (l.builds[1].guide = 'full'));
    expect(lines(check(wrongGuide).stderr, 'run-log')).toEqual(['check-run: [run-log] builds/r1-a-2: builds[] r1-a-2\'s guide is "full", but its plan has no campaign stage, so its guide is the endgame guide: "endgame" (D-414)']);
    const fullAsEndgame = copy('run-builds');
    editJson(fullAsEndgame, 'run-log.json', (l) => (l.builds[0].guide = 'endgame'));
    expect(lines(check(fullAsEndgame).stderr, 'run-log')).toEqual([expect.stringMatching(/builds\[\] r1-a-1's guide is "endgame", but its plan has 2 campaign stage\(s\), so its guide is the full guide: "full" \(D-414\)/)]);
  });

  it("the PoB file's name carries the card id (D-412)", () => {
    const dir = copy('run-builds');
    for (const rel of ['builds/r1-a-2/compile-record.json']) editJson(dir, rel, (r) => (r.pobFile.path = 'titan-blood-hunt-2026-10-08-1.xml'));
    editJson(dir, 'run-log.json', (l) => (l.builds[1].pobFile = 'titan-blood-hunt-2026-10-08-1.xml'));
    expect(lines(check(dir).stderr, 'layout')).toEqual(['check-run: [layout] builds/r1-a-2: the final compile wrote "titan-blood-hunt-2026-10-08-1.xml"; its build_name is "titan-blood-hunt-2026-10-08-1-r1-a-2", the run folder\'s last two segments joined, then the card id (D-412) (§2)']);
  });

  it('holds the layout: a build file at the root of a run with no migrated build, a folder builds[] doesn\'t name', () => {
    const dir = copy('run-builds');
    fs.copyFileSync(path.join(dir, 'builds/r1-a-2/plan.json'), path.join(dir, 'plan.json'));
    fs.mkdirSync(path.join(dir, 'builds/r1-b-1'));
    expect(lines(check(dir).stderr, 'layout')).toEqual([
      "check-run: [layout] plan.json isn't part of the run-folder layout (§2); a schema-4 run keeps each build's files in its folder builds/<id>/ (D-412); agents write only the files §2 names",
      "check-run: [layout] builds/r1-b-1 isn't the folder of a build run-log.json's builds[] names (D-412)",
    ]);
  });

  it("checks the D1 gate's tree part for its shape and its agreement with its findings (D-419)", () => {
    const failNoFinding = copy('run-builds');
    editJson(failNoFinding, 'reports/gates/D1-gate-r1-a-2-a1.json', (g) => (g.verdict.tree = 'fail'));
    expect(lines(check(failNoFinding).stderr, 'gate-report')).toEqual(['check-run: [gate-report] reports/gates/D1-gate-r1-a-2-a1.json: says tree: "fail" with no tree-swap finding; a failing tree part names each rung\'s swap, a tree-swap finding (D-419)']);
    const bigSwap = copy('run-builds');
    editJson(bigSwap, 'reports/gates/D1-gate-r1-a-2-a1.json', (g) => (g.design.rungs[1].tree.bestSwap.gainPercent = 6.1));
    expect(lines(check(bigSwap).stderr, 'gate-report')).toEqual(["check-run: [gate-report] reports/gates/D1-gate-r1-a-2-a1.json: rung b's best swap left gains 6.1% Full DPS, at least 5%, but no tree-swap finding names it: the tree part fails that rung (D-419)"]);
    const shape = copy('run-builds');
    editJson(shape, 'reports/gates/D1-gate-r1-a-2-a1.json', (g) => {
      delete g.verdict.tree;
      g.design.rungs[0].tree = { travel: 70, points: 64, bestSwap: { gainPercent: 1 }, needs: 'the life wheel' };
    });
    expect(lines(check(shape).stderr, 'gate-report')).toEqual([
      'check-run: [gate-report] reports/gates/D1-gate-r1-a-2-a1.json: design.rungs\'s "m" tree has travel 70 of points 64; both whole numbers, travel at most points (D-419)',
      'check-run: [gate-report] reports/gates/D1-gate-r1-a-2-a1.json: design.rungs\'s "m" tree\'s bestSwap is {"gainPercent":1}; null, or {gainPercent, removed: [names], added: [names]} (D-419)',
      'check-run: [gate-report] reports/gates/D1-gate-r1-a-2-a1.json: design.rungs\'s "m" tree\'s needs are "the life wheel"; the needs\' reasons, as text (D-418, D-419)',
      'check-run: [gate-report] reports/gates/D1-gate-r1-a-2-a1.json: verdict.tree is undefined; one of pass, fail, unverified',
    ]);
  });

  it('--snapshot and --changed take --build: the round copy and its comparison are the build\'s, in its folder', () => {
    const dir = copy('run-builds');
    expect(node(CHECKER, [dir, '--snapshot', '1', '--build', 'r1-a-2'])).toEqual({ code: 0, stdout: 'check-run: copied builds/r1-a-2/plan.json, builds/r1-a-2/compile-record.json, builds/r1-a-2/guide.md to builds/r1-a-2/rounds/1/\n', stderr: '' });
    expect(fs.readdirSync(path.join(dir, 'builds/r1-a-2/rounds/1')).sort()).toEqual(['compile-record.json', 'guide.md', 'plan.json']);
    editText(dir, 'builds/r1-a-2/guide.md', 'Blood Hunt takes the packs', 'Blood Hunt clears the packs');
    expect(node(CHECKER, [dir, '--changed', '1', '--build', 'r1-a-2'])).toEqual({ code: 0, stdout: 'section How to play it\n', stderr: '' });
    // r1-a-1's own round copy, run-ok's before its fix round: what that round changed.
    expect(node(CHECKER, [dir, '--changed', '1', '--build', 'r1-a-1'])).toEqual({ code: 0, stdout: node(CHECKER, [path.join(FIXTURES, 'run-ok'), '--changed', '1']).stdout, stderr: '' });
    expect(node(CHECKER, [dir, '--changed', '1'])).toEqual({ code: 1, stdout: '', stderr: 'check-run: a schema-4 run keeps each build in its folder: name the build with --build <card id> (D-412)\n' });
    expect(node(CHECKER, [dir, '--snapshot', '2', '--build', 'r1-a-9']).stderr).toBe('check-run: run-log.json has no build r1-a-9; builds[] holds r1-a-1, r1-a-2 (D-412)\n');
  });
});

describe('AC-W76: the order rules of schema 4, per build (D-411…D-415, D-418, D-421)', () => {
  it('F1 after a design accept and after accept:file, and not D2: a design accept goes to the final compile (D-413)', () => {
    expect(flow(variant(RUN_BUILDS, {}))).toEqual([]);
    const d2 = variant([...RESEARCH, cp('verification', 'pick:r1-a-2'), ...D1('r1-a-2'), cp('design', 'accept', 'r1-a-2'), step('D2', 'r1-a-2', 'done')], { 'r1-a-2': 'designing' }, 'running', (dir) => editJson(dir, 'run-log.json', (l) => (l.builds = [l.builds[1]])));
    expect(flow(d2)).toContainEqual(expect.stringMatching(/stages\[11\] \(D2 r1-a-2 attempt 1\): follows the design gate answered "accept", which goes on to r1-a-2's final compile, F1, not D2 r1-a-2 \(D-413\)/));
  });

  it('D1-build, D1-tree, D1-finish, then the D1 gate: a design without its tree step fails (D-418)', () => {
    const events = RUN_BUILDS.filter((e) => !('s' in e && e.s === 'D1-tree' && e.c === 'r1-a-2'));
    expect(flow(variant(events, {}))).toEqual(['check-run: [order] run-log.json stages[13] (D1-finish r1-a-2 attempt 1): can\'t follow D1-build r1-a-2 attempt 1 (outcome "done"); SKILL.md\'s step list allows D1-tree next']);
  });

  it('D1-tree after a tree failure, then D1-finish and the gate; D1-build there fails (D-418, D-419)', () => {
    const treeFail = (dir: string) => {
      gateFile(dir, 'D1-gate', 'r1-a-2', 1, { tree: 'fail' }, [{ part: 'tree', code: 'tree-swap', stage: 'b', message: 'b: +6.1% Full DPS by moving 2 points from Strength, Strength to Cold Nature' }]);
      editJson(dir, 'reports/gates/D1-gate-r1-a-2-a1.json', (g) => (g.design.rungs[1].tree.bestSwap.gainPercent = 6.1));
      gateFile(dir, 'D1-gate', 'r1-a-2', 2, {});
    };
    const r1a2 = (retry: Ev[]) => [...RESEARCH, cp('verification', 'pick:r1-a-1,r1-a-2'), ...D1('r1-a-1'), cp('design', 'accept:file', 'r1-a-1'), step('F1', 'r1-a-1', 'pass'),
      ...D1('r1-a-2', 'fail'), ...retry, step('D1-gate', 'r1-a-2', 'pass'), cp('design', 'accept', 'r1-a-2'), step('F1', 'r1-a-2', 'pass'), step('W1', 'r1-a-2', 'done'), step('V4', 'r1-a-2', 'pass'), cp('final', 'accept', 'r1-a-2'), ...CAMPAIGN_R1A1];
    expect(flow(variant(r1a2([step('D1-tree', 'r1-a-2', 'done'), step('D1-finish', 'r1-a-2', 'done')]), {}, 'completed', treeFail))).toEqual([]);
    expect(flow(variant(r1a2([step('D1-build', 'r1-a-2', 'done'), step('D1-tree', 'r1-a-2', 'done'), step('D1-finish', 'r1-a-2', 'done')]), {}, 'completed', treeFail))).toEqual([
      expect.stringMatching(/stages\[16\] \(D1-build r1-a-2 attempt 2\): can't follow D1-gate r1-a-2 attempt 1 \(outcome "fail"; its verdict fails only its tree part \(a swap left gains 5% or more\)\); SKILL\.md's step list allows D1-tree next/),
    ]);
  });

  it("a campaign answer is followed by D2, and a completed build's campaign by V4's campaign pass (D-415)", () => {
    const campaign = [...RESEARCH, cp('verification', 'pick:r1-a-1,r1-a-2'), ...D1('r1-a-1'), cp('design', 'accept:file', 'r1-a-1'), step('F1', 'r1-a-1', 'pass'),
      ...ENDGAME_R1A2, cp('final', 'campaign', 'r1-a-2'), step('D2', 'r1-a-2', 'done'), step('D2-gate', 'r1-a-2', 'pass'), step('W1', 'r1-a-2', 'done')];
    const withD2Gate = (dir: string) => gateFile(dir, 'D2-gate', 'r1-a-2', 1, { compiled: 'pass', v1: 'pass', v2: 'pass' });
    const ok = variant([...campaign, step('V4-campaign', 'r1-a-2', 'pass'), cp('final', 'accept', 'r1-a-2')], { 'r1-a-1': 'file-only' }, 'completed', withD2Gate);
    expect(flow(ok)).toEqual([]);
    const fullPass = variant([...campaign, step('V4', 'r1-a-2', 'pass'), cp('final', 'accept', 'r1-a-2')], { 'r1-a-1': 'file-only' }, 'completed', withD2Gate);
    expect(flow(fullPass)).toEqual(expect.arrayContaining([expect.stringMatching(/stages\[\d+\] \(V4 r1-a-2 attempt 2\): can't follow W1 r1-a-2 attempt 2 \(outcome "done"\); SKILL\.md's step list allows V4-campaign next/)]));
    const noD2 = variant([...campaign.slice(0, -3), step('W1', 'r1-a-2', 'done')], { 'r1-a-1': 'file-only', 'r1-a-2': 'writing' }, 'running', withD2Gate);
    expect(flow(noD2)).toContainEqual(expect.stringMatching(/\(W1 r1-a-2 attempt 2\): follows the final gate answered "campaign", which reopens r1-a-2 for its campaign: D2 next, after the round copy \(D-415\)/));
  });

  it('accept:verification is followed by a verification visit once the queue is empty; a plain accept with a visit after it fails', () => {
    const tail = (answer: string): Ev[] => [...RESEARCH, cp('verification', 'pick:r1-a-1,r1-a-2'), ...D1('r1-a-1'), cp('design', 'accept:file', 'r1-a-1'), step('F1', 'r1-a-1', 'pass'),
      ...ENDGAME_R1A2, cp('final', answer, 'r1-a-2'), cp('verification', 'stop'), ...CAMPAIGN_R1A1];
    expect(flow(variant(tail('accept:verification'), {}))).toEqual([]);
    expect(flow(variant(tail('accept'), {}))).toEqual([expect.stringMatching(/^check-run: \[order\] run-log\.json checkpoints\[5\] \(verification visit 2\) is recorded before resumes\[0\] \(at checkpoints\[6\]\), but no step before the resume follows it/)]);
  });

  it('decline:<note> ends the build not-accepted, and builds[] says so', () => {
    const declined = [...RESEARCH, cp('verification', 'pick:r1-a-1,r1-a-2'), ...D1('r1-a-1'), cp('design', 'accept:file', 'r1-a-1'), step('F1', 'r1-a-1', 'pass'), ...ENDGAME_R1A2, cp('final', 'decline:too costly for me', 'r1-a-2'), ...CAMPAIGN_R1A1];
    expect(flow(variant(declined, { 'r1-a-2': 'not-accepted' }))).toEqual([]);
    expect(flow(variant(declined, {}))).toEqual(['check-run: [run-log] run-log.json builds[] r1-a-2\'s status is "completed", but the run log\'s steps and answers end it "not-accepted" (D-411, D-412)']);
  });

  it("entries after a stop come only behind a resume, placed by the resume's recorded lengths", () => {
    const stopped = [...RESEARCH, cp('verification', 'pick:r1-a-1,r1-a-2'), ...D1('r1-a-1'), cp('design', 'accept:file', 'r1-a-1'), step('F1', 'r1-a-1', 'pass'), ...D1('r1-a-2'), cp('design', 'stop', 'r1-a-2')];
    const after: Ev[] = [cp('verification', 'campaign:r1-a-1'), step('D2', 'r1-a-1', 'done'), step('D2-gate', 'r1-a-1', 'pass'), step('W1', 'r1-a-1', 'done'), step('V4', 'r1-a-1', 'fail'), step('W1', 'r1-a-1', 'done'), step('V4-recheck', 'r1-a-1', 'fail'), cp('final', 'accept', 'r1-a-1')];
    expect(flow(variant([...stopped, { resume: true }, ...after], { 'r1-a-2': 'stopped' }))).toEqual([]);
    // With no resume, the D2 after the stop follows a run that ended.
    expect(flow(variant([...stopped, ...after], { 'r1-a-2': 'stopped' }))).toContainEqual(expect.stringMatching(/stages\[16\] \(D2 r1-a-1 attempt 1\): follows the design gate answered "stop", which ends the run: no card is queued and no answer asked for the verification gate; entries after it come only behind a resume/));
    // A resume recorded one checkpoint early places the design gate's stop after it.
    const early = variant([...stopped, { resume: true }, ...after], { 'r1-a-2': 'stopped' }, 'completed', (dir) => editJson(dir, 'run-log.json', (l) => (l.resumes[0].lengths.checkpoints -= 1)));
    expect(flow(early).length).toBeGreaterThan(0);
  });

  it("design:<id> after a resume shows a stopped build's design gate again, and its accept:file goes to F1; a completed build's fails", () => {
    const events = (id: string): Ev[] => [...RESEARCH, cp('verification', 'pick:r1-a-1,r1-a-2'), ...D1('r1-a-1'), cp('design', 'stop', 'r1-a-1'),
      ...ENDGAME_R1A2, cp('final', 'accept', 'r1-a-2'), { resume: true }, cp('verification', `design:${id}`), cp('design', 'accept:file', id), step('F1', id, 'pass')];
    expect(flow(variant(events('r1-a-1'), { 'r1-a-1': 'file-only' }))).toEqual([]);
    expect(flow(variant(events('r1-a-2'), { 'r1-a-1': 'stopped' }))).toEqual(expect.arrayContaining([expect.stringMatching(/follows the verification gate answered "design:r1-a-2", but r1-a-2 is completed; design:<id> takes a stopped or dropped build \(D-415\)/)]));
  });

  it("guide:<id> after a resume writes a file-only build's endgame guide: W1, V4's full pass, then its final gate (D-415)", () => {
    const events = (answer: string): Ev[] => [...RESEARCH, cp('verification', 'pick:r1-a-1,r1-a-2'), ...D1('r1-a-1'), cp('design', 'accept:file', 'r1-a-1'), step('F1', 'r1-a-1', 'pass'),
      ...ENDGAME_R1A2, cp('final', 'accept', 'r1-a-2'), { resume: true }, cp('verification', answer), step('W1', 'r1-a-1', 'done'), step('V4', 'r1-a-1', 'pass'), cp('final', 'accept', 'r1-a-1')];
    expect(flow(variant(events('guide:r1-a-1'), {}))).toEqual([]);
    // A completed build has its guide: guide:<id> takes a file-only one.
    expect(flow(variant(events('guide:r1-a-2'), { 'r1-a-1': 'file-only' }))).toEqual(expect.arrayContaining([expect.stringMatching(/follows the verification gate answered "guide:r1-a-2", but r1-a-2 is completed; guide:<id> takes a file-only build \(D-415\)/)]));
  });

  it("an accepted finding is its build's: it covers that card's later gates, not another build's (D-411)", () => {
    const v1 = [{ part: 'v1', code: 'level-points', stage: 'b', message: 'stage b spends 108 points at level 90' }];
    const gates = (dir: string) => {
      for (const a of [1, 2, 3]) gateFile(dir, 'D1-gate', 'r1-a-1', a, { v1: 'fail' }, v1);
      gateFile(dir, 'D1-gate', 'r1-a-2', 1, { v1: 'fail' }, v1);
    };
    const events = (r1a2: string): Ev[] => [...RESEARCH, cp('verification', 'pick:r1-a-1,r1-a-2'),
      ...D1('r1-a-1', 'fail'), ...D1('r1-a-1', 'fail'), ...D1('r1-a-1', 'escalated'), { esc: 'D1-gate', c: 'r1-a-1', choice: 'accept' }, cp('design', 'accept:file', 'r1-a-1'), step('F1', 'r1-a-1', 'pass'),
      ...D1('r1-a-2', r1a2)];
    // r1-a-1's accepted level-points (stage b, v1) passes no gate of r1-a-2's: its D1 gate fails, and re-runs D1.
    expect(flow(variant(events('pass'), { 'r1-a-1': 'file-only', 'r1-a-2': 'designing' }, 'running', gates))).toEqual([
      expect.stringMatching(/\(D1-gate r1-a-2 attempt 1\): is routed pass, but its verdict fails its compile, V1 or V2 .*, which isn't a pass/),
    ]);
    expect(flow(variant(events('fail'), { 'r1-a-1': 'file-only', 'r1-a-2': 'designing' }, 'running', gates))).toEqual([]);
  });

  describe('an F1 escalation with each of its four options (D-413)', () => {
    const upTo = (f1: Ev[]): Ev[] => [...RESEARCH, cp('verification', 'pick:r1-a-1,r1-a-2'), ...D1('r1-a-1'), cp('design', 'accept:file', 'r1-a-1'), step('F1', 'r1-a-1', 'pass'),
      ...D1('r1-a-2'), cp('design', 'accept', 'r1-a-2'), step('F1', 'r1-a-2', 'fail'), step('F1', 'r1-a-2', 'escalated'), ...f1];
    const failing = (dir: string) => {
      const v1 = [{ part: 'v1', code: 'level-points', stage: 'b', message: 'stage b spends 108 points at level 90' }];
      gateFile(dir, 'F1', 'r1-a-2', 1, { compiled: 'pass', v1: 'fail', v2: 'pass' }, v1);
      gateFile(dir, 'F1', 'r1-a-2', 2, { compiled: 'pass', v1: 'fail', v2: 'pass' }, v1);
      gateFile(dir, 'F1', 'r1-a-2', 3, { compiled: 'pass', v1: 'pass', v2: 'pass' });
      gateFile(dir, 'D1-gate', 'r1-a-2', 2, {});
    };
    const guide: Ev[] = [step('W1', 'r1-a-2', 'done'), step('V4', 'r1-a-2', 'pass'), cp('final', 'accept', 'r1-a-2')];

    it('1, accept: the failing findings join accepted, and F1 runs once more', () => {
      expect(flow(variant([...upTo([{ esc: 'F1', c: 'r1-a-2', choice: 'accept' }, step('F1', 'r1-a-2', 'pass'), ...guide]), ...CAMPAIGN_R1A1], {}, 'completed', failing))).toEqual([]);
    });
    it('2, guidance: D1, its gate and the design gate again, then F1', () => {
      const retry = [{ esc: 'F1', c: 'r1-a-2', choice: 'retry', g: 'keep the budget boots' } as Ev, step('D1-tree', 'r1-a-2', 'done'), step('D1-finish', 'r1-a-2', 'done'), step('D1-gate', 'r1-a-2', 'pass'), cp('design', 'accept', 'r1-a-2'), step('F1', 'r1-a-2', 'pass'), ...guide];
      expect(flow(variant([...upTo(retry), ...CAMPAIGN_R1A1], {}, 'completed', failing))).toEqual([]);
      // Without the design gate again, F1 can't follow the D1 gate.
      const skipped = retry.filter((e) => !('cp' in e && e.cp === 'design'));
      expect(flow(variant([...upTo(skipped), ...CAMPAIGN_R1A1], {}, 'completed', failing)).length).toBeGreaterThan(0);
    });
    it('3, back to the verification gate: the build ends dropped', () => {
      expect(flow(variant([...upTo([{ esc: 'F1', c: 'r1-a-2', choice: 'verification' }, cp('verification', 'stop')])], { 'r1-a-1': 'file-only', 'r1-a-2': 'dropped' }, 'completed', failing))).toEqual([]);
    });
    it('4, stop: the build ends escalated, and the run with it when no card is queued', () => {
      expect(flow(variant([...upTo([{ esc: 'F1', c: 'r1-a-2', choice: 'stop' }])], { 'r1-a-1': 'file-only', 'r1-a-2': 'escalated' }, 'completed', failing))).toEqual([]);
      expect(flow(variant([...upTo([{ esc: 'F1', c: 'r1-a-2', choice: 'stop' }])], { 'r1-a-1': 'file-only', 'r1-a-2': 'escalated' }, 'escalated', failing))).toEqual([
        'check-run: [order] run-log.json: the run ended (F1 r1-a-2\'s escalation answered stop), so its status is "completed", a build having ended completed or file-only, not "escalated" (D-411)',
      ]);
    });
    it("the write ledger's refusal escalates at once, and its accept retries F1", () => {
      const refused = (dir: string) => {
        gateFile(dir, 'F1', 'r1-a-2', 1, { compiled: 'fail', v1: 'unverified', v2: 'unverified' }, [{ part: 'compiled', code: 'ledger-refused', message: 'titan-blood-hunt-2026-10-08-1-r1-a-2.xml changed on disk' }]);
        gateFile(dir, 'F1', 'r1-a-2', 2, { compiled: 'pass', v1: 'pass', v2: 'pass' });
      };
      const events = [...RESEARCH, cp('verification', 'pick:r1-a-1,r1-a-2'), ...D1('r1-a-1'), cp('design', 'accept:file', 'r1-a-1'), step('F1', 'r1-a-1', 'pass'),
        ...D1('r1-a-2'), cp('design', 'accept', 'r1-a-2'), step('F1', 'r1-a-2', 'escalated'), { esc: 'F1', c: 'r1-a-2', choice: 'accept' } as Ev, step('F1', 'r1-a-2', 'pass'), ...guide, ...CAMPAIGN_R1A1];
      expect(flow(variant(events, {}, 'completed', refused))).toEqual([]);
    });
  });

  it('accepts a re-run after a refused entry or a tool-refused verdict, and still fails a D1 gate after a fail entry (D-421)', () => {
    const r1a2 = (gates: Ev[]): Ev[] => [...RESEARCH, cp('verification', 'pick:r1-a-1,r1-a-2'), ...D1('r1-a-1'), cp('design', 'accept:file', 'r1-a-1'), step('F1', 'r1-a-1', 'pass'),
      step('D1-build', 'r1-a-2', 'done'), step('D1-tree', 'r1-a-2', 'done'), step('D1-finish', 'r1-a-2', 'done'), ...gates, cp('design', 'accept', 'r1-a-2'),
      step('F1', 'r1-a-2', 'pass'), step('W1', 'r1-a-2', 'done'), step('V4', 'r1-a-2', 'pass'), cp('final', 'accept', 'r1-a-2'), ...CAMPAIGN_R1A1];
    const second = (dir: string) => {
      fs.renameSync(path.join(dir, 'reports/gates/D1-gate-r1-a-2-a1.json'), path.join(dir, 'reports/gates/D1-gate-r1-a-2-a2.json'));
      editJson(dir, 'reports/gates/D1-gate-r1-a-2-a2.json', (g) => (g.attempt = 2));
    };
    // The outcome refused: the same gate next, alone and uncounted.
    expect(flow(variant(r1a2([step('D1-gate', 'r1-a-2', 'refused'), step('D1-gate', 'r1-a-2', 'pass')]), {}, 'completed', second))).toEqual([]);
    // A verdict whose tree part a refused call left unverified routes to no producer: the gate re-runs.
    const toolRefused = (dir: string) => {
      second(dir);
      gateFile(dir, 'D1-gate', 'r1-a-2', 1, { tree: 'unverified' }, [{ part: 'tree', code: 'tool-refused', message: 'refused: mcp__pob2__get_node_power' }]);
    };
    expect(flow(variant(r1a2([step('D1-gate', 'r1-a-2', 'fail'), step('D1-gate', 'r1-a-2', 'pass')]), {}, 'completed', toolRefused))).toEqual([]);
    // A V1 failure logged fail routes to D1-build: the gate again is out of order.
    const v1Fail = (dir: string) => {
      second(dir);
      gateFile(dir, 'D1-gate', 'r1-a-2', 1, { v1: 'fail' }, [{ part: 'v1', code: 'level-points', stage: 'b', message: 'stage b spends 108 points' }]);
    };
    expect(flow(variant(r1a2([step('D1-gate', 'r1-a-2', 'fail'), step('D1-gate', 'r1-a-2', 'pass')]), {}, 'completed', v1Fail))).toEqual([
      expect.stringMatching(/stages\[16\] \(D1-gate r1-a-2 attempt 2\): can't follow D1-gate r1-a-2 attempt 1 \(outcome "fail"; its verdict fails its compile, V1 or V2 .*\); SKILL\.md's step list allows D1-build next/),
    ]);
    // A refused step that isn't re-run next is out of order.
    expect(flow(variant(r1a2([step('D1-gate', 'r1-a-2', 'refused'), step('D1-build', 'r1-a-2', 'done'), step('D1-tree', 'r1-a-2', 'done'), step('D1-finish', 'r1-a-2', 'done'), step('D1-gate', 'r1-a-2', 'pass')]), {}, 'completed', second))).toContainEqual(expect.stringMatching(/stages\[15\] \(D1-gate r1-a-2 attempt 1\): was refused by the permission system, but D1-build r1-a-2 attempt 2 follows; the runner asks the user to allow the tool and re-runs the refused step alone, next, uncounted \(D-421\)/));
  });

  it('a tool-error on the tree part re-runs the gate alone, once; a second escalates (D-419)', () => {
    const toolError = (attempts: number) => (dir: string) => {
      for (let a = 1; a <= attempts; a++) gateFile(dir, 'D1-gate', 'r1-a-2', a, { tree: 'unverified' }, [{ part: 'tree', code: 'tool-error', message: 'get_node_power timed out' }]);
      gateFile(dir, 'D1-gate', 'r1-a-2', attempts + 1, {});
    };
    const r1a2 = (gates: Ev[], tail: Ev[]): Ev[] => [...RESEARCH, cp('verification', 'pick:r1-a-1,r1-a-2'), ...D1('r1-a-1'), cp('design', 'accept:file', 'r1-a-1'), step('F1', 'r1-a-1', 'pass'),
      step('D1-build', 'r1-a-2', 'done'), step('D1-tree', 'r1-a-2', 'done'), step('D1-finish', 'r1-a-2', 'done'), ...gates, ...tail];
    const guide: Ev[] = [cp('design', 'accept', 'r1-a-2'), step('F1', 'r1-a-2', 'pass'), step('W1', 'r1-a-2', 'done'), step('V4', 'r1-a-2', 'pass'), cp('final', 'accept', 'r1-a-2'), ...CAMPAIGN_R1A1];
    expect(flow(variant(r1a2([step('D1-gate', 'r1-a-2', 'fail'), step('D1-gate', 'r1-a-2', 'pass')], guide), {}, 'completed', toolError(1)))).toEqual([]);
    expect(flow(variant(r1a2([step('D1-gate', 'r1-a-2', 'fail'), step('D1-gate', 'r1-a-2', 'escalated')], [{ esc: 'D1-gate', c: 'r1-a-2', choice: 'stop' }]), { 'r1-a-1': 'file-only', 'r1-a-2': 'escalated' }, 'completed', toolError(2)))).toEqual([]);
    expect(flow(variant(r1a2([step('D1-gate', 'r1-a-2', 'fail'), step('D1-gate', 'r1-a-2', 'fail')], []), { 'r1-a-1': 'file-only', 'r1-a-2': 'designing' }, 'running', toolError(2)))).toContainEqual(expect.stringMatching(/stages\[16\] \(D1-gate r1-a-2 attempt 2\): is routed fail, but a second tool failure escalates \(D-419\)/));
  });

  it('several cards finalized run in the order picked, ahead of the cards still queued; builds[] in finalize order', () => {
    const swapped = variant(RUN_BUILDS, {}, 'completed', (dir) => editJson(dir, 'run-log.json', (l) => (l.builds = [l.builds[1], l.builds[0]])));
    expect(flow(swapped)).toEqual(['check-run: [run-log] run-log.json builds[] is in the order r1-a-2, r1-a-1; it is the finalize order, r1-a-1, r1-a-2 (D-412)']);
    const outOfOrder = variant([...RESEARCH, cp('verification', 'pick:r1-a-1,r1-a-2'), step('D1-build', 'r1-a-2', 'done')], { 'r1-a-1': 'queued', 'r1-a-2': 'designing' }, 'running');
    expect(flow(outOfOrder)).toContainEqual(expect.stringMatching(/stages\[7\] \(D1-build r1-a-2 attempt 1\): follows a finalize, so the first queued card's design comes next: r1-a-1's D1-build, not D1-build r1-a-2 \(D-411\)/));
  });
});

describe('AC-W76: the interview notes and the deck (D-420, D-424)', () => {
  it('## Pending decision passes in a notes file, at a visit with or without questions', () => {
    // With questions: the pending decision after them, not counted (run-interview's brainstorm visit asked 2).
    const asked = copy('run-interview');
    fs.appendFileSync(path.join(asked, 'interviews', 'brainstorm-1.md'), "\n## Pending decision\n\nVerify Blood Hunt bleed burst, with the user's words: \"a cheaper helmet\". Waiting for a yes.\n");
    passes(asked);
    // With none: run-ok's brainstorm visit asked nothing, and its notes hold only the pending decision.
    const quiet = copy('run-ok');
    fs.mkdirSync(path.join(quiet, 'interviews'));
    fs.writeFileSync(path.join(quiet, 'interviews', 'brainstorm-1.md'), '# Questions at the brainstorm gate, visit 1\n\n## Pending decision\n\nVerify Blood Hunt bleed burst and Blood Hunt with Rolling Slam clear. Waiting for a yes.\n');
    passes(quiet);
    // A question still counts: one more H2 Q<n> than the checkpoint's count fails.
    fs.appendFileSync(path.join(quiet, 'interviews', 'brainstorm-1.md'), '\n## Q1: Is the slam fast enough?\n\nAnswer: yes, modelled in PoB.\n\nSource: cards/r1-a-2.md\n');
    expect(lines(check(quiet).stderr, 'interview')).toEqual([expect.stringMatching(/brainstorm visit 1 counts 0 question\(s\), but interviews\/brainstorm-1\.md holds 1/)]);
  });

  it('the [deck] rule passes a wrapped one-paragraph section', () => {
    const dir = copy('run-ok');
    const deck = fs.readFileSync(path.join(dir, 'cards.md'), 'utf8');
    const at = deck.split('\n').indexOf('## How they differ') + 2;
    const lines0 = deck.split('\n');
    const words = lines0[at].split(' ');
    lines0.splice(at, 1, words.slice(0, 6).join(' '), words.slice(6).join(' '));
    fs.writeFileSync(path.join(dir, 'cards.md'), lines0.join('\n'));
    passes(dir);
  });
});

// ---------------------------------------------------------------------------------------------------
// The displays and the render, per build
// ---------------------------------------------------------------------------------------------------

describe('AC-W76: display design --build, display final --build and render-audit --build read that build (D-412, D-419)', () => {
  it("design: the build's rungs from its D1 gate's verdict, each rung's travel and best swap left after the gear, then its needs", () => {
    const dir = copy('run-builds');
    const out = node(RUN_LOG, [dir, 'display', 'design', '--build', 'r1-a-2']);
    expect(out.code).toBe(0);
    const rows = out.stdout.split('\n');
    expect(rows[2]).toMatch(/^The endgame build for Blood Hunt with Rolling Slam clear, rung by rung/);
    expect(rows.filter((l) => /^- (Passive tree|Kept on the tree):/.test(l))).toEqual([
      '- Passive tree: 6 of 64 points on travel; best swap left: none',
      '- Kept on the tree: the life wheel keeps the floor: the entering-maps hit needs its life',
      '- Passive tree: 9 of 98 points on travel; best swap left: +3.2% Full DPS by moving 2 points from Strength, Strength to Cold Nature',
      '- Kept on the tree: Unbending holds armour where the tree has none',
      '- Passive tree: 10 of 104 points on travel; best swap left: none',
    ]);
    expect(rows).toContain('- Verdict file: reports/gates/D1-gate-r1-a-2-a1.json');
    expect(node(RUN_LOG, [dir, 'display', 'design']).stderr).toBe('run-log: display: the design gate is a build\'s: display design --build <card id> (D-411)\n');
    expect(node(RUN_LOG, [dir, 'display', 'verification', '--build', 'r1-a-2']).stderr).toBe('run-log: display: --build goes with the design and final gates, not verification\n');
    expect(node(RUN_LOG, [dir, 'display', 'final', '--build', 'r1-a-9']).stderr).toBe('run-log: display: r1-a-9 has no build in the run; builds[] holds r1-a-1, r1-a-2\n');
  });

  it("final: the build's guide, audit and PoB file in its folder, its F1, and each rung's travel beside its figures", () => {
    const dir = copy('run-builds');
    const rows = node(RUN_LOG, [dir, 'display', 'final', '--build', 'r1-a-2']).stdout.split('\n');
    expect(rows.slice(2, 5)).toEqual([
      `The guide for Blood Hunt with Rolling Slam clear: ${path.join(dir, 'builds/r1-a-2/guide.md')}`,
      `Its audit, how each number was checked: ${path.join(dir, 'builds/r1-a-2/audit.md')}`,
      'Your PoB file: titan-blood-hunt-2026-10-08-1-r1-a-2.xml',
    ]);
    expect(rows).toContain("- The endgame build's final compile: PoB built it; it's legal at each stage's level (passive points, gem levels, item and attribute requirements); its PoB settings match what each stage has.");
    expect(rows.filter((l) => /passive points on travel/.test(l)).map((l) => /, (\d+ of \d+) passive points on travel\.$/.exec(l)?.[1])).toEqual(['6 of 64', '9 of 98', '10 of 104']);
    expect(rows).toContain('- Run checker: ok');
  });

  it('verification: every build of the run with its status', () => {
    const dir = copy('run-builds');
    const rows = node(RUN_LOG, [dir, 'display', 'verification']).stdout.split('\n');
    const at = rows.indexOf('Builds in this run:');
    expect(rows.slice(at, at + 3)).toEqual(['Builds in this run:', '- Blood Hunt bleed burst: completed, with its full guide.', '- Blood Hunt with Rolling Slam clear: completed, with its endgame guide.']);
  });

  it("render-audit --build renders that build's audit.md from its plan, record and last D1 gate verdict file", () => {
    const dir = copy('run-builds');
    for (const id of ['r1-a-1', 'r1-a-2']) {
      const before = fs.readFileSync(path.join(dir, 'builds', id, 'audit.md'), 'utf8');
      remove(dir, `builds/${id}/audit.md`);
      expect(node(RENDER, [dir, '--build', id])).toEqual({ code: 0, stdout: `render-audit: wrote builds/${id}/audit.md from builds/${id}/plan.json, builds/${id}/compile-record.json and reports/gates/D1-gate-${id}-a1.json\n`, stderr: '' });
      const after = fs.readFileSync(path.join(dir, 'builds', id, 'audit.md'), 'utf8');
      // Known issues are W1's and step 14's rows, which a render of a folder with no audit.md has none of.
      expect(after.split('## Known issues')[0]).toBe(before.split('## Known issues')[0]);
    }
    expect(fs.readFileSync(path.join(dir, 'builds/r1-a-2/audit.md'), 'utf8')).toMatch(/^# Audit: Titan \/ Blood Hunt, Blood Hunt with Rolling Slam clear\n/);
    expect(node(RENDER, [dir])).toEqual({ code: 1, stdout: '', stderr: 'render-audit: a schema-4 run holds one folder per build: render-audit.mjs <runFolder> --build <card id> (D-412)\n' });
    expect(node(RENDER, [dir, '--build', 'r1-a-9']).stderr).toBe('render-audit: run-log.json has no build r1-a-9; builds[] holds r1-a-1, r1-a-2\n');
    expect(node(RENDER, [copy('run-ok'), '--build', 'r1-a-1']).stderr).toBe("render-audit: --build is schema 4's (amendment 9); this run log is schema 3\n");
  });
});

// ---------------------------------------------------------------------------------------------------
// scripts/run-usage.mjs (D-416, D-424)
// ---------------------------------------------------------------------------------------------------

describe('AC-W76: run-usage.mjs counts only the given transcripts\' sessions, and groups the design steps per build', () => {
  /** A main-session transcript with one request, and a subagent transcript whose task header names `concept`. */
  function session(dir: string, id: string, output: number, concept: string): string {
    const file = path.join(dir, `${id}.jsonl`);
    const usage = (n: number) => ({ input_tokens: 10, output_tokens: n, cache_read_input_tokens: 100, cache_creation_input_tokens: 5, output_tokens_details: { thinking_tokens: 0 } });
    const entry = (sid: string, req: string, n: number, prompt?: string) => [
      ...(prompt ? [{ type: 'user', sessionId: sid, message: { role: 'user', content: prompt } }] : []),
      { type: 'assistant', sessionId: sid, requestId: req, message: { id: `msg-${req}`, model: 'm', usage: usage(n), content: [{ type: 'text', text: 'x' }] } },
    ];
    fs.writeFileSync(file, entry(id, `${id}-main`, output, 'go').map((e) => JSON.stringify(e)).join('\n') + '\n');
    fs.mkdirSync(path.join(dir, id, 'subagents'), { recursive: true });
    const header = `\`\`\`json\n{"stage": "D1-build", "concept": "${concept}", "attempt": 1}\n\`\`\``;
    fs.writeFileSync(path.join(dir, id, 'subagents', 'agent-a1.jsonl'), entry(id, `${id}-sub`, output * 2, header).map((e) => JSON.stringify(e)).join('\n') + '\n');
    return file;
  }
  const event = (sid: string, req: string, out: number) => ({ kind: 'event', name: 'api_request', attributes: { 'session.id': sid, request_id: req, output_tokens: out, input_tokens: 1, cache_read_tokens: 0, cache_creation_tokens: 0, query_source: 'q', model: 'm' } });

  it('two transcripts, telemetry holding three sessions: only the two count, and each build has its row', () => {
    const dir = path.join(TMP, `usage-${++copies}`);
    fs.mkdirSync(dir);
    const a = session(dir, 'aaaa-1111', 100, 'r1-a-1');
    const b = session(dir, 'bbbb-2222', 300, 'r1-a-2');
    const tel = path.join(dir, 'events.jsonl');
    fs.writeFileSync(tel, [event('aaaa-1111', 'aaaa-1111-main', 100), event('aaaa-1111', 'aaaa-1111-sub', 200), event('bbbb-2222', 'bbbb-2222-main', 300), event('bbbb-2222', 'bbbb-2222-sub', 600), event('cccc-3333', 'cccc-3333-main', 5000)].map((e) => JSON.stringify(e)).join('\n') + '\n');
    const out = path.join(dir, 'out.json');
    const r = node(USAGE, [a, b, '--telemetry', tel, '--json', out]);
    expect({ code: r.code, stderr: r.stderr }).toEqual({ code: 0, stderr: '' });
    const res = readJson(dir, 'out.json');
    expect(res.sessions).toBe(2);
    expect(res.telemetry.total).toMatchObject({ requests: 4, output: 1200 });
    expect(res.join.telemetryOnly.requests).toBe(0);
    expect(res.total.recorded).toBe(1200);
    expect(res.builds.map((x: Json) => [x.key, x.recorded])).toEqual([['r1-a-2', 600], ['r1-a-1', 200]]);
    expect(r.stdout).toContain('Telemetry (the 2 sessions given): 4 api_request events, output 1.2K');
    // With no transcript, the telemetry counts whole.
    const all = node(USAGE, ['--telemetry', tel, '--json', out]);
    expect(all.code).toBe(0);
    expect(readJson(dir, 'out.json').telemetry.total.output).toBe(6200);
  });
});
