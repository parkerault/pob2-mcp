/**
 * AC-W2 (WU-43, as amendment 1 §4.2 and §5 change it): the run checker
 * `.claude/skills/build-guide/scripts/check-run.mjs`, spawned as a real process with an explicit env. It passes
 * the fixture runs in `tests/fixtures/pipeline/` (run-ok, run-ok-online and run-escalated, with no `--partial`)
 * and fails each broken copy, naming the broken rule on stderr.
 *
 * - The artifacts: the layout, the markers, the guide, the D1 gate recomputed (Q3), and §4.2's new checks:
 *   (r) the record is of the plan, (s) the PoB file is the import code's, with one loadout per stage, (t) the
 *   ledger re-evaluates with the server's compiled evaluator, (u) the rolled figure's stat set is
 *   `skills.main.statSet` (S7), and (l) every finding open after the re-check is a known issue (S2, Q1).
 * - The control flow, from the run log (schema 2, S4): the invariants that stand in for the deleted workflow
 *   harness tests (the accepted cost of S1), each with a violating copy: steps in a legal order; the caps
 *   (R1b at most 3 counted attempts, each gate at most 2 counted retries, S6 honoured); one full V4 pass and at
 *   most one re-check per cycle; escalations only from the gates; the rule on pre-supplied and default answers.
 *
 * Check (t) loads the server's compiled `build/plan/ledger.js`: `mise run test` builds before Jest runs.
 */
import { describe, it, expect, afterAll } from '@jest/globals';
import { spawnSync } from 'child_process';
import crypto from 'crypto';
import fs from 'fs';
import os from 'os';
import path from 'path';
import zlib from 'zlib';
import { validatePlan } from '../../src/plan/schema';
import { loadReferenceData } from '../../src/plan/referenceData';

const REPO = path.resolve(__dirname, '..', '..');
const CHECKER = path.join(REPO, '.claude', 'skills', 'build-guide', 'scripts', 'check-run.mjs');
const FIXTURES = path.join(REPO, 'tests', 'fixtures', 'pipeline');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'check-run-'));
const RUNS = ['run-ok', 'run-ok-online', 'run-escalated'] as const;

afterAll(() => fs.rmSync(TMP, { recursive: true, force: true }));

function runChecker(dir: string, ...flags: string[]) {
  const r = spawnSync(process.execPath, [CHECKER, dir, ...flags], {
    env: { PATH: '/usr/bin:/bin', LANG: 'C' },
    encoding: 'utf8',
    timeout: 30000,
  });
  return { code: r.status, stdout: r.stdout, stderr: r.stderr };
}

let copies = 0;
/** A fresh copy of a fixture run, in a temp dir. */
function copyOf(fixture: (typeof RUNS)[number]): string {
  const dir = path.join(TMP, `${fixture}-${++copies}`);
  fs.cpSync(path.join(FIXTURES, fixture), dir, { recursive: true });
  return dir;
}
type Json = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
const readJson = (dir: string, rel: string): Json => JSON.parse(fs.readFileSync(path.join(dir, rel), 'utf8')) as Json;
const writeJson = (dir: string, rel: string, v: Json) => fs.writeFileSync(path.join(dir, rel), `${JSON.stringify(v, null, 2)}\n`);
function editJson(dir: string, rel: string, edit: (v: Json) => void): void {
  const v = readJson(dir, rel);
  edit(v);
  writeJson(dir, rel, v);
}
function editText(dir: string, rel: string, edit: (t: string) => string): void {
  const p = path.join(dir, rel);
  const before = fs.readFileSync(p, 'utf8');
  const after = edit(before);
  if (after === before) throw new Error(`the edit to ${rel} changed nothing`);
  fs.writeFileSync(p, after);
}
const replace = (from: string, to: string) => (t: string) => {
  if (!t.includes(from)) throw new Error(`"${from}" not found`);
  return t.replace(from, to);
};
const sha1 = (b: Buffer | string) => crypto.createHash('sha1').update(b).digest('hex');
/** Edits plan.json as a final compile of the edited plan would leave it: the record's planSha1 follows (r). */
function editPlan(dir: string, edit: (p: Json) => void): void {
  editJson(dir, 'plan.json', edit);
  editJson(dir, 'compile-record.json', (r) => (r.planSha1 = sha1(fs.readFileSync(path.join(dir, 'plan.json')))));
}
const editLog = (dir: string, edit: (l: Json) => void) => editJson(dir, 'run-log.json', edit);
const stageB = (plan: Json) => plan.stages.find((s: Json) => s.id === 'b');
const step = (stage: string, concept: string | null, attempt: number, outcome: string, extra: Json = {}) => ({ stage, ...(concept ? { concept } : {}), attempt, outcome, ...extra });

function passes(dir: string): void {
  const r = runChecker(dir);
  expect({ stderr: r.stderr, code: r.code }).toEqual({ stderr: '', code: 0 });
}
function failing(dir: string): string {
  const r = runChecker(dir);
  expect(r.code).toBe(1);
  return r.stderr;
}
/** The broken rule's lines on stderr. */
const lines = (stderr: string, rule: string) => stderr.split('\n').filter((l) => l.startsWith(`check-run: [${rule}] `));

// ---------------------------------------------------------------------------------------------------
// The passing fixtures
// ---------------------------------------------------------------------------------------------------

describe('AC-W2: the passing fixtures, in the slim shape (amendment 1 §4)', () => {
  it.each(RUNS)('exits 0 on %s, with no --partial', (fixture) => {
    const r = runChecker(path.join(FIXTURES, fixture));
    expect(r.stderr).toBe('');
    expect(r.code).toBe(0);
    expect(r.stdout).toMatch(/^check-run: ok: /);
  });

  it.each(RUNS)('%s holds a schema-2 run log, V4 reports named v4-<lens>[-recheck].json and no V3 report', (fixture) => {
    const dir = path.join(FIXTURES, fixture);
    const log = readJson(dir, 'run-log.json');
    expect(log.schemaVersion).toBe(2);
    expect(Object.keys(log).sort()).toEqual(['checkpoints', 'escalations', 'faults', 'mode', 'outputs', 'roll', 'runFolder', 'schemaVersion', 'slug', 'stages', 'status', 'testConfig']);
    for (const s of log.stages as Json[]) expect(Object.keys(s).filter((k) => !['stage', 'concept', 'attempt', 'outcome', 'priceOutcomes'].includes(k))).toEqual([]);
    for (const c of log.checkpoints as Json[]) expect(Object.keys(c).filter((k) => !['checkpoint', 'visit', 'answer', 'answeredBy', 'rule'].includes(k))).toEqual([]);
    const reports = fs.existsSync(path.join(dir, 'reports')) ? fs.readdirSync(path.join(dir, 'reports')).filter((f) => f !== 'gates') : [];
    for (const f of reports) expect(f).toMatch(/^v4-(ledger|sources|prose)(-recheck)?\.json$/);
  });

  it("run-ok is an offline run whose free FI-2 failure, W1 fix round and prose re-check leave one known issue in the guide", () => {
    const dir = path.join(FIXTURES, 'run-ok');
    const log = readJson(dir, 'run-log.json');
    expect(log.faults).toEqual([expect.objectContaining({ id: 'FI-2', target: { concepts: 'all', persistent: false } })]);
    expect(log.stages.map((s: Json) => `${s.stage}:${s.outcome}`).slice(5)).toEqual([
      'D1:done', 'D1-gate:fail', 'D1:done', 'D1-gate:pass', 'D2:done', 'D2-gate:pass', 'W1:done',
      'V4-ledger:pass', 'V4-sources:pass', 'V4-prose:fail', 'W1:done', 'V4-prose-recheck:fail',
    ]);
    expect(readJson(dir, 'reports/v4-prose-recheck.json').findings).toEqual([expect.objectContaining({ id: 'v4-prose-1', status: 'unresolved' })]);
    const guide = fs.readFileSync(path.join(dir, 'guide.md'), 'utf8');
    expect(guide).toMatch(/### Known issues\n\n- `v4-prose-1` \(V4 prose, guide\.md Rotation, line \d+\): /);
  });

  it('run-ok is an offline run with an endgame stage whose chaos resistance stays uncapped by its exception, stated in the guide (D-234)', () => {
    const dir = path.join(FIXTURES, 'run-ok');
    const plan = readJson(dir, 'plan.json');
    const record = readJson(dir, 'compile-record.json');
    const guide = fs.readFileSync(path.join(dir, 'guide.md'), 'utf8');
    expect(readJson(dir, 'run-log.json').mode).toBe('offline');
    const b = stageB(plan);
    expect(b.variant).toBe('budget');
    expect(record.stages.b.outputs.MissingChaosResist).toBeGreaterThan(0);
    expect(guide).toContain(b.chaosResistException.reason);
  });

  it('run-ok-online is an online run with ok prices totalling over 20 and at most 22 divines, the near-the-ceiling note, and its priced steps\' priceOutcomes (D-219, Q5)', () => {
    const dir = path.join(FIXTURES, 'run-ok-online');
    const plan = readJson(dir, 'plan.json');
    const gate = readJson(dir, 'reports/gates/D1-gate-c1-a1.json');
    const guide = fs.readFileSync(path.join(dir, 'guide.md'), 'utf8');
    const rates = new Map<string, number>(gate.basis.budget.rates.map((r: Json) => [r.currency, r.divines]));
    const prices = new Map<string, Json>(plan.prices.map((p: Json) => [p.id, p]));
    const total = gate.basis.budget.slots.reduce((sum: number, s: Json) => {
      const p = prices.get(s.priceId)!;
      expect(p.status).toBe('ok');
      return sum + p.amount * rates.get(p.currency)!;
    }, 0);
    expect(total).toBeGreaterThan(20);
    expect(total).toBeLessThanOrEqual(22);
    expect(guide).toContain('near the ceiling');
    const log = readJson(dir, 'run-log.json');
    expect(log.stages.find((s: Json) => s.stage === 'D1').priceOutcomes).toEqual({ ok: 13, would_wait: 1 });
  });

  it('run-escalated ends escalated at a D1 gate escalation answered by the default stop, its verdict file named, no findings copied (S4)', () => {
    const log = readJson(path.join(FIXTURES, 'run-escalated'), 'run-log.json');
    expect(log.status).toBe('escalated');
    expect(log.escalations).toEqual([{ stage: 'D1-gate', concept: 'c1', verdict: 'reports/gates/D1-gate-c1-a3.json', choice: 'stop' }]);
    expect(log.checkpoints[1]).toEqual(expect.objectContaining({ checkpoint: 'escalation', answeredBy: 'default' }));
    expect(fs.existsSync(path.join(FIXTURES, 'run-escalated', 'guide.md'))).toBe(false);
  });

  // validatePlan only: V1 and V2 need a compile's engine-side stage checks, so they run in the engine tests.
  it('every fixture plan passes validatePlan with the C1/E1 data (C-31), and sets every enemy<Type>Damage to a whole number (D-256)', () => {
    const ref = loadReferenceData();
    const plans: string[] = [];
    for (const run of RUNS) {
      plans.push(path.join(FIXTURES, run, 'plan.json'));
      for (const c of fs.readdirSync(path.join(FIXTURES, run, 'concepts'))) plans.push(path.join(FIXTURES, run, 'concepts', c, 'plan.json'));
    }
    for (const p of plans) {
      const text = fs.readFileSync(p, 'utf8');
      const result = validatePlan(text, ref);
      expect({ plan: path.relative(FIXTURES, p), errors: result.ok ? [] : result.errors }).toEqual({ plan: path.relative(FIXTURES, p), errors: [] });
      // PoB types these options countAllowZero, and the bridge refuses a fraction.
      const hits = (JSON.parse(text).stages as Json[]).flatMap((s) => (s.config.scenario as Json[]).filter((o) => /^enemy\w+Damage$/.test(o.option)));
      for (const o of hits) expect({ plan: path.relative(FIXTURES, p), option: o.option, whole: Number.isInteger(o.value) }).toEqual({ plan: path.relative(FIXTURES, p), option: o.option, whole: true });
    }
  });

  it('every fixture plan sets skills.main.statSet on its endgame stages, the stat set its D1 gate compares (S7)', () => {
    for (const run of RUNS) {
      const plan = readJson(path.join(FIXTURES, run), 'plan.json');
      for (const s of (plan.stages as Json[]).filter((x) => x.variant !== undefined)) expect({ run, stage: s.id, statSet: s.skills.main.statSet }).toEqual({ run, stage: s.id, statSet: 1 });
    }
  });

  it("run-ok's campaign stage 1 holds the leveling skill, not Blood Hunt below its tier 7 (D-259); Blood Hunt joins at gem level 10", () => {
    for (const fixture of ['run-ok', 'run-ok-online']) {
      const plan = readJson(path.join(FIXTURES, fixture), 'plan.json');
      const gems = (id: string) => (plan.stages.find((s: Json) => s.id === id).skills.groups as Json[]).flatMap((g) => g.gems as Json[]);
      expect(gems('1').map((g) => g.name)).toEqual(['Rolling Slam']);
      expect(gems('2').find((g) => g.name === 'Blood Hunt')!.level).toBeGreaterThanOrEqual(7);
    }
  });

  it("the final records' import codes decode to their PoB files, one tree set per plan stage (D-215)", () => {
    for (const run of ['run-ok', 'run-ok-online']) {
      const record = readJson(path.join(FIXTURES, run), 'compile-record.json');
      const xml = zlib.inflateSync(Buffer.from(record.importCode.replace(/-/g, '+').replace(/_/g, '/'), 'base64'));
      expect(sha1(xml)).toBe(record.pobFile.sha1);
      expect((xml.toString('utf8').match(/<Spec\b/g) ?? []).length).toBe(readJson(path.join(FIXTURES, run), 'plan.json').stages.length);
    }
  });
});

// ---------------------------------------------------------------------------------------------------
// The artifacts: broken copies
// ---------------------------------------------------------------------------------------------------

interface BrokenCase {
  name: string;
  fixture: (typeof RUNS)[number];
  edit: (dir: string) => void;
  rule: string;
  says: RegExp;
}

/** Encodes a PoB XML as an import code (C-42), as the compiler does. */
const encode = (xml: string) => zlib.deflateSync(Buffer.from(xml, 'utf8')).toString('base64').replace(/\+/g, '-').replace(/\//g, '_');
/** Replaces the final record's import code with `xml`'s, keeping the PoB file sha1 consistent with it and the guide's copy. */
function recode(dir: string, xml: string): void {
  const code = encode(xml);
  const old = readJson(dir, 'compile-record.json').importCode;
  editJson(dir, 'compile-record.json', (r) => {
    r.importCode = code;
    r.pobFile.sha1 = sha1(xml);
  });
  editText(dir, 'guide.md', replace(old, code));
}
const specs = (titles: string[]) => `<PathOfBuilding2>\n<Tree>\n${titles.map((t) => `<Spec title="${t}" nodes=""/>`).join('\n')}\n</Tree>\n</PathOfBuilding2>\n`;

const broken: BrokenCase[] = [
  // (a)
  { name: '(a) guide.md is missing from a completed run', fixture: 'run-ok', edit: (d) => fs.rmSync(path.join(d, 'guide.md')), rule: 'layout', says: /guide\.md is missing/ },
  { name: '(a) a stray file in the run folder', fixture: 'run-ok', edit: (d) => fs.writeFileSync(path.join(d, 'gen.py'), ''), rule: 'layout', says: /gen\.py isn't part of the run-folder layout/ },
  { name: "(a) a report named the old way (V3, or a V4 report with a pass number)", fixture: 'run-ok', edit: (d) => fs.writeFileSync(path.join(d, 'reports', 'v3-c1-p1.json'), '{}'), rule: 'layout', says: /reports\/v3-c1-p1\.json isn't named v4-<lens>\.json or v4-<lens>-recheck\.json/ },
  // (b)
  { name: '(b) a §8 H2 is missing', fixture: 'run-ok', edit: (d) => editText(d, 'guide.md', replace('## Rotation\n', '')), rule: 'guide-sections', says: /missing \["Rotation"\]/ },
  {
    name: '(b) §8 H2s out of order',
    fixture: 'run-ok',
    edit: (d) => editText(d, 'guide.md', (t) => t.replace('## Summary', '## @@').replace('## How it works', '## Summary').replace('## @@', '## How it works')),
    rule: 'guide-sections',
    says: /out of order/,
  },
  // (c)
  { name: "(c) a Leveling H3 differs from the record's loadout name", fixture: 'run-ok', edit: (d) => editText(d, 'guide.md', replace('### Act 2 (L30) {2}', '### Act 2 (L31) {2}')), rule: 'leveling', says: /Leveling H3s are .*"Act 2 \(L31\) \{2\}".*the record's campaign loadouts.*"Act 2 \(L30\) \{2\}"/ },
  // (d)
  { name: '(d) a marker has no definition', fixture: 'run-ok', edit: (d) => editText(d, 'guide.md', replace('Rolling Slam clears.[^g1]', 'Rolling Slam clears.[^g1][^nope]')), rule: 'markers', says: /marker \[\^nope\] has no definition/ },
  { name: '(d) a price definition names no prices[] entry', fixture: 'run-ok', edit: (d) => editText(d, 'guide.md', replace('[^g6]: price | b-helmet', '[^g6]: price | no-such-price')), rule: 'markers', says: /price "no-such-price" names no prices\[\] entry/ },
  { name: '(d) a ledger definition names no ledger entry', fixture: 'run-ok', edit: (d) => editText(d, 'guide.md', replace('[^g7]: ledger | ttk_arbiter', '[^g7]: ledger | no_such_entry')), rule: 'markers', says: /ledger "no_such_entry" names no ledger entry/ },
  { name: '(d) a data definition names no C1/E1 fact', fixture: 'run-ok', edit: (d) => editText(d, 'guide.md', replace('#resistance-penalty.act2', '#resistance-penalty.act9')), rule: 'markers', says: /names no C1\/E1 fact/ },
  // (e)
  { name: '(e) an external tag has no accessed', fixture: 'run-ok-online', edit: (d) => editText(d, 'guide.md', replace('blood-hunt-titan | accessed: 2026-10-08 |', 'blood-hunt-titan |')), rule: 'source-tags', says: /an external tag has no accessed date/ },
  // (f)
  { name: '(f) a judgment tag has no confidence', fixture: 'run-ok', edit: (d) => editText(d, 'guide.md', replace('no Blood Loss stack option | confidence: L', 'no Blood Loss stack option')), rule: 'source-tags', says: /a judgment tag has no confidence/ },
  // (g)
  {
    name: '(g) an external-unavailable tag in an online run',
    fixture: 'run-ok-online',
    edit: (d) => editText(d, 'guide.md', replace('[^g10]: judgment | PoB has no Blood Loss stack option | confidence: L', '[^g10]: external-unavailable | external source unavailable (offline run) | confidence: L')),
    rule: 'offline-tag',
    says: /external-unavailable tag in a "online" run/,
  },
  // (h)
  { name: "(h) the guide's import code differs from the record's", fixture: 'run-ok', edit: (d) => editText(d, 'guide.md', (t) => t.replace(/```\n([^\n]*)\n```/, '```\n$1x\n```')), rule: 'import-code', says: /import code differs from compile-record\.json's importCode/ },
  // (i)
  { name: '(i) a required run-log field is missing', fixture: 'run-ok', edit: (d) => editLog(d, (l) => delete l.outputs), rule: 'run-log', says: /run-log\.json has no outputs/ },
  { name: '(i) a schema-1 run log', fixture: 'run-ok', edit: (d) => editLog(d, (l) => (l.schemaVersion = 1)), rule: 'run-log', says: /schemaVersion: is 1; it is 2/ },
  // (k)
  {
    name: '(k) an offline run has a prices[] status ok',
    fixture: 'run-ok',
    edit: (d) => editPlan(d, (p) => {
      Object.assign(p.prices[0], { status: 'ok', amount: 1, currency: 'divine' });
      delete p.prices[0].note;
    }),
    rule: 'offline-prices',
    says: /price "b-weapon" is "ok"/,
  },
  { name: '(k) an offline run has a price call (priceOutcomes, Q5)', fixture: 'run-ok', edit: (d) => editLog(d, (l) => (l.stages.find((s: Json) => s.stage === 'D1').priceOutcomes = { ok: 1 })), rule: 'offline-prices', says: /an offline run made 1 price call/ },
  // (l)
  { name: '(l) a finding open after the re-check is missing from Known issues', fixture: 'run-ok', edit: (d) => editText(d, 'guide.md', (t) => t.replace(/- `v4-prose-1`[^\n]*\n/, 'None.\n')), rule: 'known-issues', says: /V4 prose finding "v4-prose-1" .* is open after the re-check, but guide\.md's Known issues doesn't list it/ },
  // (n)
  { name: '(n) a V4 finding misses a field', fixture: 'run-ok', edit: (d) => editJson(d, 'reports/v4-sources.json', (r) => delete r.findings[0].evidence), rule: 'report-shape', says: /v4-sources\.json: findings\[0\] has no evidence/ },
  { name: '(n) verdict pass alongside an unresolved finding', fixture: 'run-ok', edit: (d) => editJson(d, 'reports/v4-sources.json', (r) => (r.findings[0].status = 'unresolved')), rule: 'report-shape', says: /says verdict "pass" alongside 1 unresolved finding/ },
  { name: "(n) a report's check differs from its name", fixture: 'run-ok', edit: (d) => editJson(d, 'reports/v4-prose-recheck.json', (r) => (r.check = 'full')), rule: 'report-shape', says: /v4-prose-recheck\.json: check is "full"; its name says "recheck"/ },
  { name: "(n) a finding on the dossier, which V4 doesn't check (S3), or owned by dossier-fix", fixture: 'run-ok', edit: (d) => editJson(d, 'reports/v4-prose.json', (r) => Object.assign(r.findings[0], { artifact: 'dossier.md', owner: 'dossier-fix' })), rule: 'report-shape', says: /artifact is "dossier\.md"/ },
  // (o)
  { name: '(o) floor: pass, but the record has MissingColdResist above 0', fixture: 'run-ok', edit: (d) => editJson(d, 'compile-record.json', (r) => (r.stages.b.outputs.MissingColdResist = 5)), rule: 'floor', says: /says floor: "pass", but the records give "fail": .*MissingColdResist is 5/ },
  { name: '(o) MissingChaosResist above 0 and the chaosResistException removed (D-234)', fixture: 'run-ok', edit: (d) => editPlan(d, (p) => delete stageB(p).chaosResistException), rule: 'floor', says: /MissingChaosResist is 47 and it has no chaosResistException/ },
  { name: "(o) the exception's reason is missing from the guide's Checks (D-234)", fixture: 'run-ok', edit: (d) => editText(d, 'guide.md', replace('because no slot can carry chaos resistance', 'because of the')), rule: 'floor', says: /no line of the guide's "Endgame: budget variant" Checks states its full reason .* with the uncapped value 28% \(D-234\)/ },
  { name: "(o) the uncapped chaos value isn't stated with % on the reason's line (D-234)", fixture: 'run-ok', edit: (d) => editText(d, 'guide.md', replace('Chaos resistance stays at 28% (47% under its cap) because', 'Chaos resistance stays uncapped because')), rule: 'floor', says: /states its full reason .* with the uncapped value 28%/ },
  { name: '(o) an endgame stage lacks its waystone-scaled chaos reference hit (D-254)', fixture: 'run-ok', edit: (d) => editPlan(d, (p) => (stageB(p).config.scenario = stageB(p).config.scenario.filter((o: Json) => o.option !== 'enemyChaosDamage'))), rule: 'floor', says: /says floor: "pass", but the records give "fail": stage b has no waystone-scaled Chaos reference hit \(enemyChaosDamage\)/ },
  { name: "(o) a reference hit isn't the ceiling of its ledger entry's value (D-254, D-256)", fixture: 'run-ok', edit: (d) => editJson(d, 'compile-record.json', (r) => (r.ledger.hit_b_physical.value = 324.19000244141)), rule: 'floor', says: /stage b's enemyPhysicalDamage 402 isn't 325, the ceiling of its ledger entry hit_b_physical's value 324\.19000244141 rounded to 2 decimals \(D-256\)/ },
  // (p)
  { name: '(p) budget: pass, but the prices and rates give over 22 divines', fixture: 'run-ok-online', edit: (d) => editPlan(d, (p) => (p.prices.find((x: Json) => x.id === 'b-weapon').amount = 10)), rule: 'budget', says: /says budget: "pass", but the records give "fail": stage b totals 23\.5 divines, above 22/ },
  { name: '(p) a filled budget slot maps to no prices[] entry', fixture: 'run-ok-online', edit: (d) => editJson(d, 'reports/gates/D1-gate-c1-a1.json', (r) => (r.basis.budget.slots = r.basis.budget.slots.filter((s: Json) => s.slot !== 'Helmet'))), rule: 'budget', says: /filled slot "Helmet" maps to no prices\[\] entry/ },
  { name: '(p) a filled tree jewel maps to no prices[] entry (D-249)', fixture: 'run-ok-online', edit: (d) => editJson(d, 'reports/gates/D1-gate-c1-a1.json', (r) => (r.basis.budget.slots = r.basis.budget.slots.filter((s: Json) => s.jewel === undefined))), rule: 'budget', says: /filled tree jewel in node 1001 maps to no prices\[\] entry/ },
  { name: '(p) an expensive tree jewel tips the budget over 22 divines (D-249)', fixture: 'run-ok-online', edit: (d) => editPlan(d, (p) => (p.prices.find((x: Json) => x.id === 'b-jewel').amount = 200)), rule: 'budget', says: /says budget: "pass", but the records give "fail": stage b totals 23 divines, above 22/ },
  { name: '(p) two slots holding different items share a price entry', fixture: 'run-ok-online', edit: (d) => editJson(d, 'reports/gates/D1-gate-c1-a1.json', (r) => (r.basis.budget.slots.find((s: Json) => s.slot === 'Ring 2').priceId = 'b-ring1')), rule: 'budget', says: /share price entry "b-ring1" but hold different items/ },
  { name: '(p) over 20 divines and the guide lacks "near the ceiling"', fixture: 'run-ok-online', edit: (d) => editText(d, 'guide.md', replace('against 20, near the ceiling:', 'against 20:')), rule: 'budget', says: /lack "near the ceiling"/ },
  // (q)
  { name: '(q) rolledSkill: pass, but a same-role group has a larger figure in the record', fixture: 'run-ok', edit: (d) => editJson(d, 'compile-record.json', (r) => (r.stages.b.skillOutputs.g2s1p1.fields.TotalDPS = 60000)), rule: 'rolled-skill', says: /says rolledSkill: "pass", but the records give "fail": stage b's group 2 \(clear\) has 60000, more than the rolled group 1's 50000/ },
  { name: "(q) the rolled group's role is utility", fixture: 'run-ok', edit: (d) => editPlan(d, (p) => (stageB(p).skills.groups[0].role = 'utility')), rule: 'rolled-skill', says: /rolled group 1 has role "utility"/ },
  // (r), amendment 1 §4.2
  { name: "(r) plan.json's sha1 differs from the final record's planSha1", fixture: 'run-ok', edit: (d) => editJson(d, 'plan.json', (p) => (stageB(p).claims[0].text += ' Edited after the final compile.')), rule: 'record-plan', says: /sha1\(plan\.json\) is [0-9a-f]{40}, but the final record's planSha1 is "[0-9a-f]{40}": plan\.json changed after the final compile/ },
  // (s)
  { name: "(s) the import code isn't the PoB file's (its sha1 differs from the record's pobFile)", fixture: 'run-ok', edit: (d) => editJson(d, 'compile-record.json', (r) => (r.pobFile.sha1 = 'a9993e364706816aba3e25717850c26c9cd0d89d')), rule: 'pob-file', says: /the decoded importCode's sha1 is [0-9a-f]{40}, but the record's PoB file "titan-blood-hunt-2026-10-08-1\.xml" has sha1 "a9993e36/ },
  { name: "(s) the import code doesn't decode", fixture: 'run-ok', edit: (d) => editJson(d, 'compile-record.json', (r) => (r.importCode = 'eNrtWV1v2zYUfc-vIPS-FixtureImportCode-0001')), rule: 'pob-file', says: /importCode doesn't decode as a PoB code/ },
  { name: '(s) the loadout count differs from the plan stages: one tree set missing (D-215)', fixture: 'run-ok', edit: (d) => recode(d, specs(['Act 1 (L8) {1}', 'Act 2 (L30) {2}', 'Endgame budget (L90) {b}'])), rule: 'pob-file', says: /holds 3 tree set\(s\), but the plan has 4 stage\(s\); the file holds one loadout per stage \(D-215\)/ },
  { name: "(s) a tree set isn't titled by its stage's loadout name (a Default left behind)", fixture: 'run-ok', edit: (d) => recode(d, specs(['Default', 'Act 2 (L30) {2}', 'Endgame budget (L90) {b}', 'Endgame non-budget (L95) {n}'])), rule: 'pob-file', says: /tree sets are titled \["Default",.*the record's loadout names, in plan order, are \["Act 1 \(L8\) \{1\}"/ },
  // (t)
  { name: "(t) a ledger entry doesn't re-evaluate to the record's value", fixture: 'run-ok', edit: (d) => editJson(d, 'compile-record.json', (r) => (r.ledger.ttk_arbiter.value = 161)), rule: 'ledger', says: /ledger entry ttk_arbiter re-evaluates to 160, but the final record has 161 \(compared to 2 decimals\)/ },
  { name: "(t) a doubled ledger formula (FI-4's edit) doesn't re-evaluate to the record's value", fixture: 'run-ok', edit: (d) => editPlan(d, (p) => (p.ledger[0].formula = `(${p.ledger[0].formula}) * 2`)), rule: 'ledger', says: /ledger entry ttk_arbiter re-evaluates to 320, but the final record has 160/ },
  // (u)
  { name: "(u) the rolled figure's stat set isn't skills.main.statSet (S7)", fixture: 'run-ok', edit: (d) => editPlan(d, (p) => (stageB(p).skills.main.statSet = 2)), rule: 'rolled-skill', says: /says rolledSkill: "pass", but the records give "fail": stage b's rolled figure g1s1p1\.TotalDPS is stat set 1, but skills\.main\.statSet is 2/ },
  { name: '(u) an endgame stage sets no skills.main.statSet (S7)', fixture: 'run-ok', edit: (d) => editPlan(d, (p) => delete stageB(p).skills.main.statSet), rule: 'rolled-skill', says: /stage b's rolled figure g1s1p1\.TotalDPS is stat set 1, but skills\.main\.statSet is undefined/ },
];

describe('AC-W2: each broken copy exits non-zero, naming the broken rule', () => {
  it.each(broken.map((c) => [c.name, c] as const))('%s', (_name, c) => {
    const dir = copyOf(c.fixture);
    c.edit(dir);
    const r = runChecker(dir);
    expect(r.code).toBe(1);
    expect({ stderr: r.stderr, matched: lines(r.stderr, c.rule).some((l) => c.says.test(l)) }).toEqual({ stderr: r.stderr, matched: true });
  });

  it('refuses a call without a run folder, and the --partial flag amendment 1 removed (usage)', () => {
    for (const args of [['--partial'], [path.join(FIXTURES, 'run-escalated'), '--partial']]) {
      const r = spawnSync(process.execPath, [CHECKER, ...args], { env: { PATH: '/usr/bin:/bin' }, encoding: 'utf8' });
      expect(r.status).toBe(2);
      expect(r.stderr).toMatch(/usage: node check-run\.mjs <runFolder>/);
    }
  });
});

// ---------------------------------------------------------------------------------------------------
// Known issues (S2, Q1): what is open after the re-check
// ---------------------------------------------------------------------------------------------------

describe('S2, Q1: every finding open after the re-check is listed under Known issues', () => {
  const dropListing = (dir: string) => editText(dir, 'guide.md', (t) => t.replace(/- `v4-prose-1`[^\n]*\n/, 'None.\n'));

  it('needs no listing for a finding the re-check reports fixed', () => {
    const dir = copyOf('run-ok');
    editJson(dir, 'reports/v4-prose-recheck.json', (r) => {
      r.findings[0].status = 'fixed';
      r.verdict = 'pass';
    });
    dropListing(dir);
    passes(dir);
  });

  it('keeps a full-pass finding the re-check left out open, and a new finding the re-check raised', () => {
    const dir = copyOf('run-ok');
    editJson(dir, 'reports/v4-prose-recheck.json', (r) => {
      r.findings = [{ ...r.findings[0], id: 'v4-prose-2', location: 'Summary, line 13' }];
    });
    const stderr = failing(dir);
    expect(stderr).toMatch(/\[known-issues\] V4 prose finding "v4-prose-2" .*is open after the re-check/);
    expect(stderr).not.toMatch(/"v4-prose-1"/);
    dropListing(dir);
    expect(failing(dir)).toMatch(/\[known-issues\] V4 prose finding "v4-prose-1"/);
  });

  it("ignores a re-check report the log doesn't run after the last full pass (an earlier cycle's)", () => {
    const dir = copyOf('run-ok-online');
    fs.copyFileSync(path.join(FIXTURES, 'run-ok', 'reports', 'v4-prose-recheck.json'), path.join(dir, 'reports', 'v4-prose-recheck.json'));
    editJson(dir, 'reports/v4-prose-recheck.json', (r) => (r.mode = 'online'));
    passes(dir);
  });

  it('fails when the guide has no Known issues H3 at all', () => {
    const dir = copyOf('run-ok');
    editText(dir, 'guide.md', (t) => t.replace(/### Known issues\n\n- `v4-prose-1`[^\n]*\n/, ''));
    expect(failing(dir)).toMatch(/\[known-issues\] 0 accepted gate finding\(s\) and 1 open V4 finding\(s\), but guide\.md has no "Known issues" H3 under "Confidence and what PoB can't model"/);
  });
});

describe('C-30, §7.4: accepted-offline is only the sources lens\'s word on a claim tagged external-unavailable', () => {
  it('fails another lens marking a finding accepted-offline', () => {
    const dir = copyOf('run-ok');
    editJson(dir, 'reports/v4-ledger.json', (r) => r.findings.push({ id: 'v4-ledger-1', artifact: 'guide.md', location: 'guide.md [^g9]', claim: 'c', issue: 'tagged external-unavailable', evidence: 'offline', owner: 'W1', status: 'accepted-offline' }));
    expect(failing(dir)).toMatch(/\[report-shape\] .*v4-ledger\.json: findings\[0\] is accepted-offline in a ledger lens report; only the V4 sources lens/);
  });

  it('fails a sources finding accepted-offline whose location names no external-unavailable claim', () => {
    for (const [location, why] of [
      ['guide.md [^g1]', /names a [a-z-]+ claim/],
      ['Summary, line 3', /names no claim/],
    ] as const) {
      const dir = copyOf('run-ok');
      editJson(dir, 'reports/v4-sources.json', (r) => (r.findings[1].location = location));
      const stderr = failing(dir);
      expect(stderr).toMatch(/\[report-shape\] reports\/v4-sources\.json: findings\[1\] is accepted-offline/);
      expect(stderr).toMatch(why);
    }
  });
});

// ---------------------------------------------------------------------------------------------------
// The gates: recomputed (Q3), passed once a guide exists, and accepted findings (§5.4, D-236)
// ---------------------------------------------------------------------------------------------------

const lastD1 = 'reports/gates/D1-gate-c1-a2.json';

/**
 * run-ok whose D1 gate escalated on `finding` instead of passing at attempt 2: attempt 1 failed free (FI-2,
 * attempt 1 only), attempts 2 and 3 failed counted, attempt 4 escalated, and the user accepted it. With
 * `listing`, the guide's Known issues lists it.
 */
function acceptedRun(finding: Json, listing: string | null, choice = 'accept'): string {
  const dir = copyOf('run-ok');
  const passing = readJson(dir, lastD1);
  for (const a of [2, 3, 4]) writeJson(dir, `reports/gates/D1-gate-c1-a${a}.json`, { ...passing, attempt: a, verdict: { ...passing.verdict, [finding.part]: 'fail' }, findings: [...passing.findings, finding] });
  editLog(dir, (l) => {
    const i = l.stages.findIndex((s: Json) => s.stage === 'D1-gate' && s.attempt === 2);
    l.stages.splice(i, 1, step('D1-gate', 'c1', 2, 'fail'), step('D1', 'c1', 3, 'done'), step('D1-gate', 'c1', 3, 'fail'), step('D1', 'c1', 4, 'done'), step('D1-gate', 'c1', 4, 'escalated'));
    l.escalations.push({ stage: 'D1-gate', concept: 'c1', verdict: 'reports/gates/D1-gate-c1-a4.json', choice });
    l.checkpoints.splice(1, 0, { checkpoint: 'escalation', visit: 1, answer: choice, answeredBy: 'pre-supplied', rule: choice });
  });
  if (listing !== null) editText(dir, 'guide.md', replace('### Known issues\n\n', `### Known issues\n\n- ${listing}\n`));
  return dir;
}
const levelPoints = { part: 'v1', code: 'level-points', stage: 'b', message: 'stage b spends too many points' };
const v1Fail = (code: string) => ({ pass: false, findings: [{ code, message: `${code} (FI-2)` }], notes: [] });

describe('§5.3: once a guide exists, a failing gate part no accepted finding covers fails the run', () => {
  it('fails when the last D1 gate honestly says floor: fail (chaos uncapped, no exception)', () => {
    const dir = copyOf('run-ok');
    editPlan(dir, (p) => delete stageB(p).chaosResistException);
    editJson(dir, lastD1, (r) => {
      r.verdict.floor = 'fail';
      r.findings = [{ part: 'floor', code: 'missing-chaos-resist', stage: 'b', message: 'MissingChaosResist 47, no exception' }];
    });
    const stderr = failing(dir);
    expect(stderr).not.toMatch(/says floor: "fail", but the records/);
    expect(stderr).toMatch(/\[floor\] the guide's concept fails the D1 gate's floor \(missing-chaos-resist, stage b\)/);
    expect(stderr).toMatch(/\[floor\] reports\/gates\/D1-gate-c1-a2\.json says floor: "fail" \(missing-chaos-resist\), and no accepted finding covers it/);
  });

  it('fails when the last D1 gate honestly says budget: fail (over 22 divines)', () => {
    const dir = copyOf('run-ok-online');
    editPlan(dir, (p) => (p.prices.find((x: Json) => x.id === 'b-weapon').amount = 30));
    editJson(dir, 'reports/gates/D1-gate-c1-a1.json', (r) => {
      r.verdict.budget = 'fail';
      r.findings = [{ part: 'budget', code: 'over-budget', stage: 'b', message: 'stage b totals 43.5 divines' }];
    });
    const stderr = failing(dir);
    expect(stderr).not.toMatch(/says budget: "fail", but/);
    expect(stderr).toMatch(/\[budget\] the guide's concept fails the D1 gate's budget \(over-budget, stage b\): stage b totals 43\.5 divines, above 22/);
  });

  it('fails a run with a guide whose last D2 gate failed V1 with no accepted finding', () => {
    const dir = copyOf('run-ok');
    editJson(dir, 'reports/gates/D2-gate-c1-a1.json', (r) => {
      r.verdict.v1 = 'fail';
      r.findings = [{ part: 'v1', code: 'tree-continuity', stage: '2', message: 'stage 2 drops a node without a respec' }];
    });
    expect(failing(dir)).toMatch(/\[gates\] reports\/gates\/D2-gate-c1-a1\.json says v1: "fail" \(tree-continuity\), and no accepted finding covers it/);
  });

  it("doesn't compare a D1 gate's other parts when its compile failed (they are unverified)", () => {
    const dir = copyOf('run-escalated');
    editJson(dir, 'reports/gates/D1-gate-c1-a3.json', (r) => {
      r.verdict = { compiled: 'fail', v1: 'unverified', v2: 'unverified', floor: 'unverified', budget: 'unverified', rolledSkill: 'unverified' };
      r.findings = [{ part: 'compiled', code: 'compile-error', stage: 'b', message: 'stage b: unknown gem' }];
    });
    passes(dir);
  });
});

describe('§5.4: an accepted gate finding covers equal ones (same plan stage, part and code), and is a known issue', () => {
  it('a V1 finding accepted at the D1 gate covers the final record\'s equal V1 finding', () => {
    const dir = acceptedRun(levelPoints, '`level-points` (D1-gate, stage b): accepted at the escalation.');
    editJson(dir, 'compile-record.json', (r) => (r.stages.b.v1 = v1Fail('level-points')));
    passes(dir);
  });

  it('does not cover the same code on another plan stage', () => {
    const dir = acceptedRun(levelPoints, '`level-points` (D1-gate, stage b): accepted.');
    editJson(dir, 'compile-record.json', (r) => {
      r.stages.b.v1 = v1Fail('level-points');
      r.stages.n.v1 = v1Fail('level-points');
    });
    const stderr = failing(dir);
    expect(stderr).toMatch(/\[record-verdicts\] the final record's stage n fails V1: level-points/);
    expect(stderr).not.toMatch(/stage b fails V1/);
  });

  it('requires the guide to list the accepted finding with its gate on one line under Known issues', () => {
    expect(failing(acceptedRun(levelPoints, '`level-points`: accepted.'))).toMatch(/\[known-issues\] guide\.md's Known issues has no line naming accepted finding level-points with its gate D1-gate \(stage b\)/);
  });

  it('finds the accepted findings in the verdict file the escalation names, not in the log', () => {
    const dir = acceptedRun(levelPoints, '`level-points` (D1-gate, stage b): accepted.');
    editJson(dir, 'compile-record.json', (r) => (r.stages.b.v1 = v1Fail('level-points')));
    editLog(dir, (l) => (l.escalations[0].verdict = 'reports/gates/D1-gate-c1-a9.json'));
    const stderr = failing(dir);
    expect(stderr).toMatch(/\[escalation\] escalations\[0\]\.verdict is "reports\/gates\/D1-gate-c1-a9\.json"; it names the escalated attempt's verdict file/);
    expect(stderr).toMatch(/\[record-verdicts\] the final record's stage b fails V1: level-points/);
  });

  it("refuses an accepted compile failure (D-236) and a gate finding marked accepted that no escalation accepted", () => {
    const compile = { part: 'compiled', code: 'compile-error', stage: 'b', message: 'stage b: unknown gem' };
    expect(failing(acceptedRun(compile, null))).toMatch(/\[escalation\] escalations\[0\] accepts reports\/gates\/D1-gate-c1-a4\.json's compile failure/);
    const dir = copyOf('run-ok');
    editJson(dir, 'reports/gates/D2-gate-c1-a1.json', (r) => r.findings.push({ ...levelPoints, accepted: true }));
    expect(failing(dir)).toMatch(/\[gates\] reports\/gates\/D2-gate-c1-a1\.json marks finding level-points \(stage b\) accepted, but no escalation accepted it/);
  });
});

describe('D-219 and D-249: budget totals and tree jewels', () => {
  it('rounds the total to 2 decimals before comparing it with 22', () => {
    const dir = copyOf('run-ok-online');
    editPlan(dir, (p) => (p.prices.find((x: Json) => x.id === 'b-jewel').amount = 100.4));
    passes(dir);
  });
});

describe('D-256: a reference hit is the ledger value rounded to 2 decimals, then up to a whole number', () => {
  const setHit = (dir: string, type: string, value: number) => editPlan(dir, (p) => (stageB(p).config.scenario.find((o: Json) => o.option === `enemy${type}Damage`).value = value));

  it('passes the fixture, whose fire hit is 97 against its ledger value 96.4789…', () => {
    const plan = readJson(path.join(FIXTURES, 'run-ok'), 'plan.json');
    const record = readJson(path.join(FIXTURES, 'run-ok'), 'compile-record.json');
    expect(stageB(plan).config.scenario.find((o: Json) => o.option === 'enemyFireDamage').value).toBe(97);
    expect(record.ledger.hit_b_fire.value).toBeCloseTo(96.4789, 4);
    expect(runChecker(path.join(FIXTURES, 'run-ok')).code).toBe(0);
  });

  it("fails the 2-decimal value D-254 asked for (96.48): PoB's enemy<Type>Damage options take whole numbers", () => {
    const dir = copyOf('run-ok');
    setHit(dir, 'Fire', 96.48);
    expect(failing(dir)).toMatch(/check-run: \[floor\] .*says floor: "pass", but the records give "fail": .*stage b's enemyFireDamage 96\.48 isn't 97, the ceiling of its ledger entry hit_b_fire's value 96\.4789\d* rounded to 2 decimals \(D-256\)/);
  });

  it('fails a hit rounded down (96): the scenario value is the ceiling, the conservative side of the floor', () => {
    const dir = copyOf('run-ok');
    setHit(dir, 'Fire', 96);
    expect(failing(dir)).toMatch(/\[floor\] .*enemyFireDamage 96 isn't 97, the ceiling/);
  });

  it('passes a ledger value with float noise (402.000003) at 402, and fails 403 for it', () => {
    const dir = copyOf('run-ok');
    editJson(dir, 'compile-record.json', (r) => (r.ledger.hit_b_physical.value = 402.000003));
    passes(dir);
    setHit(dir, 'Physical', 403);
    expect(failing(dir)).toMatch(/\[floor\] .*enemyPhysicalDamage 403 isn't 402, the ceiling of its ledger entry hit_b_physical's value 402\.000003/);
  });
});

describe("S5: the D1 gate's file supplies only the budget map with its rates and the figures, no copied numbers (F7)", () => {
  it('reads every figure from the record, so a value copied into the gate file is neither needed nor compared', () => {
    const dir = copyOf('run-ok');
    editJson(dir, lastD1, (r) => (r.basis.rolledSkill[0].figures[0].value = 12345.678));
    passes(dir);
  });

  it('fails a D1 gate file without its basis', () => {
    const dir = copyOf('run-ok');
    editJson(dir, lastD1, (r) => delete r.basis);
    expect(failing(dir)).toMatch(/\[gate-report\] reports\/gates\/D1-gate-c1-a2\.json: has no basis \{budget: \{rates, slots\}, rolledSkill: \[\.\.\.\]\}/);
  });
});

describe("D-260: the run log's outputs carry no import code; compile-record.json is its one home", () => {
  it('the fixtures name the record and the PoB file, without an import code', () => {
    for (const fixture of RUNS) {
      expect(Object.keys(readJson(path.join(FIXTURES, fixture), 'run-log.json').outputs)).toEqual(['plan', 'record', 'dossier', 'guide', 'pobFile']);
    }
  });

  it('fails a run log whose outputs copy the import code', () => {
    const dir = copyOf('run-ok');
    editLog(dir, (l) => (l.outputs.importCode = 'eNrtWV1v2zYUfc-vIPS-FixtureImportCode-0001'));
    expect(failing(dir)).toMatch(/check-run: \[run-log\] run-log\.json outputs: has importCode; the import code's one home is compile-record\.json, which outputs\.record names \(D-260\)/);
  });
});

// ---------------------------------------------------------------------------------------------------
// The run log (S4, Q5)
// ---------------------------------------------------------------------------------------------------

describe('S4, Q5: the slim run log and its per-step price outcomes', () => {
  it('fails a priceOutcomes key that is no outcome, and one on a step that doesn\'t price', () => {
    const dir = copyOf('run-ok-online');
    editLog(dir, (l) => {
      l.stages.find((s: Json) => s.stage === 'D1').priceOutcomes = { ok: 2, maybe: 1 };
      l.stages.find((s: Json) => s.stage === 'W1').priceOutcomes = { ok: 1 };
    });
    const stderr = failing(dir);
    expect(stderr).toMatch(/\[run-log\] run-log\.json stages\[5\]\.priceOutcomes: is \{<outcome>: <count>\}/);
    expect(stderr).toMatch(/\[run-log\] run-log\.json stages\[9\]: has priceOutcomes, but W1 doesn't price/);
  });

  it('fails NFR-22 on a rate_limited or locked_out call', () => {
    const dir = copyOf('run-ok-online');
    editLog(dir, (l) => (l.stages.find((s: Json) => s.stage === 'D1').priceOutcomes = { ok: 11, rate_limited: 1 }));
    expect(failing(dir)).toMatch(/\[nfr-22\] run-log\.json stages\[5\]: pricing hit 1 rate_limited and 0 locked_out outcome\(s\); NFR-22 wants zero of each/);
  });

  it('fails a test config accepted in an online run, and fault directives without one', () => {
    const dir = copyOf('run-ok-online');
    editLog(dir, (l) => (l.testConfig = 'accepted'));
    expect(failing(dir)).toMatch(/\[run-log\] run-log\.json testConfig: is "accepted" in an online run/);
    const dir2 = copyOf('run-ok-online');
    editLog(dir2, (l) => (l.faults = [{ id: 'FI-2', target: { concepts: 'all' }, applied: 1, observed: 'x' }]));
    expect(failing(dir2)).toMatch(/\[run-log\] run-log\.json faults: fault directives apply only in offline test mode/);
  });
});

describe("checkpoints[]: a pre-supplied or default answer records its rule, which the guide's pick reason quotes", () => {
  const withCheckpoint = (fixture: 'run-ok' | 'run-ok-online', edit: (c: Json) => void) => {
    const dir = copyOf(fixture);
    editLog(dir, (l) => edit(l.checkpoints[0]));
    return dir;
  };

  it("run-ok's pre-supplied pick records first-viable, the test config's answer as written", () => {
    expect(readJson(path.join(FIXTURES, 'run-ok'), 'run-log.json').checkpoints[0]).toEqual({ checkpoint: 1, visit: 1, answer: 'pick:c1', answeredBy: 'pre-supplied', rule: 'first-viable' });
  });

  it.each(['pre-supplied', 'default'])('fails a %s answer with no rule', (by) => {
    const dir = withCheckpoint('run-ok', (c) => {
      c.answeredBy = by;
      delete c.rule;
    });
    expect(failing(dir)).toMatch(new RegExp(`check-run: \\[run-log\\] run-log\\.json checkpoints\\[0\\]: is answered "${by}" with no rule`));
  });

  it("fails a user's answer that carries a rule", () => {
    const dir = withCheckpoint('run-ok-online', (c) => (c.rule = 'first-viable'));
    expect(failing(dir)).toMatch(/\[run-log\] run-log\.json checkpoints\[0\]: has a rule, but the user answered/);
  });
});

// ---------------------------------------------------------------------------------------------------
// The control flow (the accepted cost of S1): each invariant passes the fixtures and fails a violating copy
// ---------------------------------------------------------------------------------------------------

/** Replaces the run log's stages[] entries from `from` on (by index) with `entries`. */
const restage = (dir: string, from: number, entries: Json[], edit: (l: Json) => void = () => undefined) =>
  editLog(dir, (l) => {
    l.stages.splice(from, l.stages.length - from, ...entries);
    edit(l);
  });

describe('flow invariant 1: steps run in a legal order (SKILL.md step list)', () => {
  it('fails D2 before its D1 gate passed', () => {
    const dir = copyOf('run-ok');
    editLog(dir, (l) => {
      const at = l.stages.findIndex((s: Json) => s.stage === 'D2');
      [l.stages[at - 1], l.stages[at]] = [l.stages[at], l.stages[at - 1]];
    });
    expect(failing(dir)).toMatch(/\[order\] run-log\.json stages\[8\] \(D2 c1 attempt 1\): can't follow D1 c1 attempt 2 \(outcome "done"\); SKILL\.md's step list allows D1-gate next/);
  });

  it('fails an attempt number that skips, since every call counts', () => {
    const dir = copyOf('run-ok');
    editLog(dir, (l) => (l.stages.find((s: Json) => s.stage === 'W1' && s.attempt === 2).attempt = 3));
    expect(failing(dir)).toMatch(/\[order\] run-log\.json stages\[15\] \(W1 c1 attempt 3\): is call 2 of W1 for c1, so its attempt is 2/);
  });

  it('fails a design of a concept checkpoint 1 didn\'t pick, and a design switching concepts mid-way', () => {
    const dir = copyOf('run-ok');
    editLog(dir, (l) => (l.checkpoints[0].answer = 'pick:c2'));
    expect(failing(dir)).toMatch(/\[order\] run-log\.json stages\[5\] \(D1 c1 attempt 1\): designs c1, but checkpoint 1's pick was c2/);
    const dir2 = copyOf('run-ok');
    editLog(dir2, (l) => (l.stages.find((s: Json) => s.stage === 'D2').concept = 'c2'));
    expect(failing(dir2)).toMatch(/\[order\] .*\(D2 c2 attempt 1\): is about c2, but the design before it is c1's/);
  });

  it('fails a second research round no checkpoint 1 "more" started (D-235)', () => {
    const dir = copyOf('run-escalated');
    editLog(dir, (l) => l.stages.splice(5, 0, step('R1a', null, 1, 'done'), step('R1b-assemble', null, 2, 'done')));
    expect(failing(dir)).toMatch(/\[order\] .*starts research round 2, but checkpoint 1 was answered "more" only 0 time\(s\)/);
  });

  it('re-runs a missing return once, uncounted; a second miss ends the run stopped', () => {
    const dir = copyOf('run-ok');
    editLog(dir, (l) => {
      const at = l.stages.findIndex((s: Json) => s.stage === 'D2-gate');
      l.stages.splice(at, 1, step('D2-gate', 'c1', 1, 'missing'), step('D2-gate', 'c1', 2, 'pass'));
    });
    editJson(dir, 'reports/gates/D2-gate-c1-a1.json', (r) => (r.attempt = 2));
    fs.renameSync(path.join(dir, 'reports/gates/D2-gate-c1-a1.json'), path.join(dir, 'reports/gates/D2-gate-c1-a2.json'));
    passes(dir);

    const never = copyOf('run-ok');
    editLog(never, (l) => (l.stages.find((s: Json) => s.stage === 'W1' && s.attempt === 2).outcome = 'missing'));
    expect(failing(never)).toMatch(/\[order\] .*\(W1 c1 attempt 2\): returned without its file and never re-ran/);

    const twice = copyOf('run-escalated');
    restage(twice, 5, [step('D1', 'c1', 1, 'missing'), step('D1', 'c1', 2, 'missing')], (l) => {
      l.status = 'stopped';
      l.escalations = [];
      l.checkpoints = l.checkpoints.slice(0, 1);
    });
    passes(twice);
    editLog(twice, (l) => (l.status = 'completed'));
    expect(failing(twice)).toMatch(/\[order\] .*\(D1 c1 attempt 2\): is a second missing return of the step; the run then ends stopped/);
  });

  it('fails a step after an escalation answered stop', () => {
    const dir = copyOf('run-escalated');
    editLog(dir, (l) => l.stages.push(step('D1', 'c1', 4, 'done')));
    expect(failing(dir)).toMatch(/\[order\] .*\(D1 c1 attempt 4\): follows D1-gate c1's escalation answered "stop", which ends the run escalated/);
  });
});

describe('flow invariant 2: the caps, R1b at most 3 counted attempts and each gate at most 2 counted retries (S6 honoured)', () => {
  const r1b = (outcomes: string[]) => outcomes.map((o, i) => step('R1b', 'c1', i + 1, o));
  const research = (r1bEntries: Json[]) => [step('R1a', null, 1, 'done'), step('R1a', null, 1, 'done'), ...r1bEntries, step('R1b', 'c2', 1, 'pass'), step('R1b-assemble', null, 1, 'done')];

  it("R1b: a persistent FI-1 fails c1 after 3 counted attempts (run A's clause); a 4th attempt breaks the cap", () => {
    const dir = copyOf('run-escalated');
    const rest = readJson(dir, 'run-log.json').stages.slice(5);
    const withR1b = (outcomes: string[], persistent: boolean) =>
      restage(dir, 0, [...research(r1b(outcomes)), ...rest], (l) => (l.faults = [l.faults[0], { id: 'FI-1', target: { concepts: ['c1'], persistent }, applied: outcomes.length, observed: 'FI-1 Unknown Gem' }]));
    withR1b(['fail', 'fail', 'fail'], true);
    passes(dir);
    withR1b(['fail', 'fail', 'fail', 'fail'], true);
    expect(failing(dir)).toMatch(/\[caps\] .*\(R1b c1 attempt 4\): is a counted R1b attempt for c1 after 3; R1b allows 2 counted retries, then the concept is failed \(Q2\)/);
    // S6: with FI-1 on attempt 1 only, that attempt re-runs free, so four attempts stay within the cap.
    withR1b(['fail', 'fail', 'fail', 'fail'], false);
    passes(dir);
  });

  it('R1b: a failed compile with retries left re-runs before the next concept', () => {
    const dir = copyOf('run-escalated');
    const rest = readJson(dir, 'run-log.json').stages.slice(5);
    restage(dir, 0, [...research(r1b(['fail'])), ...rest]);
    expect(failing(dir)).toMatch(/\[order\] .*\(R1b c2 attempt 1\): R1b c1 failed with retries left, but the next R1b is c2's/);
  });

  it("gates: a persistent FI-2 counts every failure, so the third escalates (run B's clause); FI-2 on attempt 1 only makes that failure free (S6)", () => {
    // run-escalated: a persistent FI-2, failures at attempts 1 and 2 (counted), the third escalates.
    passes(copyOf('run-escalated'));
    const free = copyOf('run-escalated');
    editLog(free, (l) => (l.faults[0].target.persistent = false));
    expect(failing(free)).toMatch(/\[caps\] .*\(D1-gate c1 attempt 3\): escalates after 1 counted retry; a gate escalates only after its 2 counted retries/);
  });

  it('gates: a third counted failure that re-runs the producer breaks the cap', () => {
    const dir = copyOf('run-escalated');
    restage(dir, 9, [step('D1', 'c1', 3, 'done'), step('D1-gate', 'c1', 3, 'fail'), step('D1', 'c1', 4, 'done'), step('D1-gate', 'c1', 4, 'escalated')], (l) => (l.escalations[0].verdict = 'reports/gates/D1-gate-c1-a4.json'));
    fs.copyFileSync(path.join(dir, 'reports/gates/D1-gate-c1-a3.json'), path.join(dir, 'reports/gates/D1-gate-c1-a4.json'));
    editJson(dir, 'reports/gates/D1-gate-c1-a4.json', (r) => (r.attempt = 4));
    expect(failing(dir)).toMatch(/\[caps\] .*\(D1-gate c1 attempt 3\): is counted failure 3 of D1-gate for c1 in one chain, and the producer re-runs again; a gate allows 2 counted retries/);
  });

  it('gates: a guided retry that fails escalates again, it never re-runs the producer (D-236)', () => {
    const dir = copyOf('run-escalated');
    editLog(dir, (l) => {
      l.escalations[0].choice = 'retry';
      l.escalations[0].guidance = 'drop the level-1 stage';
      l.stages.push(step('D1', 'c1', 4, 'done'), step('D1-gate', 'c1', 4, 'fail'), step('D1', 'c1', 5, 'done'), step('D1-gate', 'c1', 5, 'pass'));
      l.status = 'stopped';
    });
    expect(failing(dir)).toMatch(/\[caps\] .*\(D1-gate c1 attempt 4\): fails after a guided retry or an accepted re-run, and the producer re-runs; such a failure escalates again/);
  });

  it('research rounds: at most 3 R1a researchers (NFR-23)', () => {
    const dir = copyOf('run-escalated');
    editLog(dir, (l) => l.stages.splice(0, 0, step('R1a', null, 1, 'done'), step('R1a', null, 1, 'done')));
    expect(failing(dir)).toMatch(/\[caps\] .*research round 1 runs 4 R1a researchers; at most 3/);
  });
});

describe('flow invariant 3: one full V4 pass and at most one re-check per cycle (S2, Q4)', () => {
  const tail = 12; // run-ok's stages[] index of the first V4 entry

  it('fails a second full pass in one cycle (the old loop) where the lenses should re-check', () => {
    const dir = copyOf('run-ok');
    restage(dir, tail + 4, [step('V4-ledger', 'c1', 2, 'pass'), step('V4-sources', 'c1', 2, 'pass'), step('V4-prose', 'c1', 2, 'fail')]);
    expect(failing(dir)).toMatch(/\[verification\] .*\(V4-ledger c1 attempt 2\): starts a second full V4 pass in one cycle; after the fix round each lens that raised a finding re-checks it/);
  });

  it('fails a full pass that skips a lens (no sampling)', () => {
    const dir = copyOf('run-ok-online');
    editLog(dir, (l) => (l.stages = l.stages.filter((s: Json) => s.stage !== 'V4-sources')));
    expect(failing(dir)).toMatch(/\[verification\] .*the full V4 pass before it ran without sources; it runs all three lenses/);
  });

  it("fails a re-check of a lens that raised nothing, and a re-check with no fix round before it", () => {
    const dir = copyOf('run-ok');
    editLog(dir, (l) => l.stages.push(step('V4-ledger-recheck', 'c1', 1, 'pass')));
    expect(failing(dir)).toMatch(/\[verification\] .*\(V4-ledger-recheck c1 attempt 1\): re-checks the ledger lens, which raised no finding in the full pass/);
    const nofix = copyOf('run-ok');
    editLog(nofix, (l) => l.stages.splice(tail + 3, 1));
    expect(failing(nofix)).toMatch(/\[order\] .*\(V4-prose-recheck c1 attempt 1\): can't follow V4-prose c1 attempt 1/);
  });

  it('fails a second re-check in one cycle, and a revision no checkpoint 2 answer asked for', () => {
    const dir = copyOf('run-ok');
    editLog(dir, (l) => l.stages.push(step('W1', 'c1', 3, 'done'), step('V4-prose-recheck', 'c1', 2, 'fail')));
    const stderr = failing(dir);
    expect(stderr).toMatch(/\[verification\] .*\(V4-prose-recheck c1 attempt 2\): re-checks with no full pass and fix round before it in this cycle/);
    expect(stderr).toMatch(/\[verification\] run-log\.json stages\[\] runs 1 revision\(s\) after the V4 checks, but checkpoint 2 was answered revise:<text> 0 time\(s\)/);
  });

  it('passes a checkpoint-2 revision: the owner, then one more full pass (Q4)', () => {
    const dir = copyOf('run-ok');
    editLog(dir, (l) => {
      l.stages.push(step('W1', 'c1', 3, 'done'), step('V4-ledger', 'c1', 2, 'pass'), step('V4-sources', 'c1', 2, 'pass'), step('V4-prose', 'c1', 2, 'pass'));
      l.checkpoints.splice(1, 0, { checkpoint: 2, visit: 1, answer: 'revise:say Blood Hunt clears', answeredBy: 'pre-supplied', rule: 'revise:say Blood Hunt clears' });
      l.checkpoints[2].visit = 2;
    });
    editJson(dir, 'reports/v4-prose.json', (r) => {
      r.findings = [];
      r.verdict = 'pass';
    });
    passes(dir);
  });

  it("fails a completed run that never re-checked what its full pass found", () => {
    const dir = copyOf('run-ok');
    editLog(dir, (l) => (l.stages = l.stages.slice(0, tail + 3)));
    expect(failing(dir)).toMatch(/\[verification\] run-log\.json: status is "completed", but the run doesn't end with a full V4 pass and, when it found anything, its re-check/);
  });
});

describe('flow invariant 4: only the D1 and D2 gates escalate; verification never does (S2)', () => {
  it('fails a V4 lens logged escalated', () => {
    const dir = copyOf('run-ok');
    editLog(dir, (l) => (l.stages.find((s: Json) => s.stage === 'V4-prose-recheck').outcome = 'escalated'));
    expect(failing(dir)).toMatch(/\[escalation\] run-log\.json stages\[16\]: V4-prose-recheck is logged escalated; only the D1 and D2 gates escalate, and verification never does/);
  });

  it('fails an escalation whose stage is not a gate', () => {
    const dir = copyOf('run-escalated');
    editLog(dir, (l) => (l.escalations[0].stage = 'W1'));
    expect(failing(dir)).toMatch(/\[escalation\] run-log\.json escalations\[0\]: stage is "W1"; only the D1 and D2 gates escalate/);
  });

  it('fails an escalated gate attempt with no escalations[] entry, and an entry with no escalated attempt', () => {
    const dir = copyOf('run-escalated');
    editLog(dir, (l) => (l.escalations = []));
    expect(failing(dir)).toMatch(/\[escalation\] .*\(D1-gate c1 attempt 3\): escalated, but escalations\[\] has no entry 0 for it/);
    const dir2 = copyOf('run-ok');
    editLog(dir2, (l) => l.escalations.push({ stage: 'D1-gate', concept: 'c1', verdict: 'reports/gates/D1-gate-c1-a1.json', choice: 'stop' }));
    expect(failing(dir2)).toMatch(/\[escalation\] run-log\.json escalations\[\] has 1 entry, but stages\[\] logs 0 escalated gate attempt\(s\)/);
  });

  it('fails an escalation entry that copies findings instead of naming its verdict file (S4)', () => {
    const dir = copyOf('run-escalated');
    editLog(dir, (l) => (l.escalations[0].findings = [{ gate: 'D1-gate', part: 'v1', code: 'level-points', stage: 'b' }]));
    expect(failing(dir)).toMatch(/\[run-log\] run-log\.json escalations\[0\]: copies findings; the verdict file holds them/);
  });

  it('fails a run that ends with an escalation answered stop under another status, and the reverse', () => {
    const dir = copyOf('run-escalated');
    editLog(dir, (l) => (l.status = 'stopped'));
    expect(failing(dir)).toMatch(/\[escalation\] run-log\.json: the last step is D1-gate c1 attempt 3's escalation, answered stop, but the status is "stopped"/);
    const dir2 = copyOf('run-ok');
    editLog(dir2, (l) => (l.status = 'escalated'));
    expect(failing(dir2)).toMatch(/\[escalation\] run-log\.json: status is "escalated", but the run doesn't end with a gate escalation answered stop/);
  });
});
