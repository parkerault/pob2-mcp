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
 * - Amendment 2's guards (WU-62, D-276…D-283): the reader layer's 14 H2s (b), the 3,000-word cap (v), no
 *   marker, confidence label or finding id in guide.md (w), one fixed-form verdict line per endgame rung
 *   matched to the record (x), the entering-maps rung's floor and 5-divine budget (y), audit.md's H2s (z),
 *   Known issues by sentence with the ids in audit.md (l), and reward picks by name.
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
import { buildSha1 } from '../../src/plan/buildHash';

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
/** Edits plan.json as a final compile of the edited plan would leave it: the record's planSha1 (r) and buildSha1 (D-266) follow. */
function editPlan(dir: string, edit: (p: Json) => void): void {
  editJson(dir, 'plan.json', edit);
  editJson(dir, 'compile-record.json', (r) => {
    r.planSha1 = sha1(fs.readFileSync(path.join(dir, 'plan.json')));
    r.buildSha1 = buildSha1(readJson(dir, 'plan.json'));
  });
}
const editLog = (dir: string, edit: (l: Json) => void) => editJson(dir, 'run-log.json', edit);
const stageB = (plan: Json) => plan.stages.find((s: Json) => s.id === 'b');
const stageM = (plan: Json) => plan.stages.find((s: Json) => s.id === 'm');
/** run-ok's open prose finding's reader sentence: the guide's one Known issues line, and its audit.md row's sentence. */
const PROSE_READER = 'The How to play it section is wrong to call Rolling Slam your clear skill: Blood Hunt does the clearing damage, so lead packs with Blood Hunt.';
/** The head of audit.md's Known issues table (§7.8). */
const AUDIT_KI_HEAD = '| Id | Lens or gate | Stage | Sentence in the guide |\n|---|---|---|---|\n';
/** Replaces run-ok's one open finding in both Known issues lists with `None.`, as step 14 does when nothing is open. */
function noneOpen(dir: string): void {
  editText(dir, 'guide.md', replace(`- ${PROSE_READER}\n`, 'None.\n'));
  editText(dir, 'audit.md', (t) => t.replace(/\| Id \|[^\n]*\n\|---[^\n]*\n\| v4-prose-1 \|[^\n]*\n/, 'None.\n'));
}
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
      'V4-ledger:pass', 'V4-sources:pass', 'V4-prose:fail', 'W1:done', 'V4-sources-recheck:pass', 'V4-prose-recheck:fail',
    ]);
    expect(readJson(dir, 'reports/v4-prose-recheck.json').findings).toEqual([expect.objectContaining({ id: 'v4-prose-1', status: 'unresolved' })]);
    const guide = fs.readFileSync(path.join(dir, 'guide.md'), 'utf8');
    // D-276: the runner writes it at step 14 as the finding's reader sentence alone; its id goes to audit.md.
    const reader = readJson(dir, 'reports/v4-prose-recheck.json').findings[0].reader;
    expect(guide).toContain(`### Known issues\n\n- ${reader}\n`);
    expect(fs.readFileSync(path.join(dir, 'audit.md'), 'utf8')).toContain(`| v4-prose-1 | prose | — | ${reader} |`);
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

  it('run-ok-online is an online run with ok prices, the budget variant over 20 and at most 22 divines with the near-the-ceiling note, the entering-maps rung within 5, and its priced steps\' priceOutcomes (D-219, D-281, Q5)', () => {
    const dir = path.join(FIXTURES, 'run-ok-online');
    const plan = readJson(dir, 'plan.json');
    const gate = readJson(dir, 'reports/gates/D1-gate-c1-a1.json');
    const guide = fs.readFileSync(path.join(dir, 'guide.md'), 'utf8');
    const rates = new Map<string, number>(gate.basis.budget.rates.map((r: Json) => [r.currency, r.divines]));
    const prices = new Map<string, Json>(plan.prices.map((p: Json) => [p.id, p]));
    const total = (stage: string) => gate.basis.budget.slots.filter((s: Json) => s.stage === stage).reduce((sum: number, s: Json) => {
      const p = prices.get(s.priceId)!;
      expect(p.status).toBe('ok');
      return sum + p.amount * rates.get(p.currency)!;
    }, 0);
    expect(total('b')).toBeGreaterThan(20);
    expect(total('b')).toBeLessThanOrEqual(22);
    expect(guide).toContain('near the ceiling');
    expect(total('m')).toBeGreaterThan(0);
    expect(total('m')).toBeLessThanOrEqual(5);
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

  it('run-ok and run-ok-online are schema-2 plans whose ladder starts at the entering-maps rung m, with audit.md beside the guide (D-278, D-281)', () => {
    for (const run of ['run-ok', 'run-ok-online']) {
      const dir = path.join(FIXTURES, run);
      const plan = readJson(dir, 'plan.json');
      expect({ run, version: plan.schemaVersion }).toEqual({ run, version: 2 });
      expect((plan.stages as Json[]).filter((s) => s.variant !== undefined).map((s) => `${s.id}:${s.variant}`)).toEqual(['m:entering-maps', 'b:budget', 'n:non-budget']);
      // The rung is gated at area level 69 (T5): its hits cite the damage there, through the ledger entries hit_m_<type>.
      const m = (plan.stages as Json[]).find((s) => s.id === 'm')!;
      for (const o of (m.config.scenario as Json[]).filter((x) => /^enemy\w+Damage$/.test(x.option))) expect(o.source.key).toBe('damage.by-level[69]');
      expect((plan.prices as Json[]).filter((x) => x.id.startsWith('m-')).length).toBe(m.items.slots.length);
      expect(fs.existsSync(path.join(dir, 'audit.md'))).toBe(true);
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
  { name: '(b) one of the reader layer\'s 14 H2s is missing (D-276)', fixture: 'run-ok', edit: (d) => editText(d, 'guide.md', replace('## How to play it\n', '')), rule: 'guide-sections', says: /missing \["How to play it"\]/ },
  {
    name: '(b) the reader layer\'s H2s out of order',
    fixture: 'run-ok',
    edit: (d) => editText(d, 'guide.md', (t) => t.replace('## Priorities', '## @@').replace('## Gem and ascendancy timing', '## Priorities').replace('## @@', '## Gem and ascendancy timing')),
    rule: 'guide-sections',
    says: /out of order/,
  },
  { name: '(b) an old-style H2 the reader layer dropped (Sources)', fixture: 'run-ok', edit: (d) => editText(d, 'guide.md', replace('## Changelog\n', '## Sources\n\n## Changelog\n')), rule: 'guide-sections', says: /unexpected \["Sources"\]/ },
  { name: "(b) What PoB can't show doesn't end with the H3 Known issues", fixture: 'run-ok', edit: (d) => editText(d, 'guide.md', replace('### Known issues\n', '### Known issues\n\n### Later\n')), rule: 'guide-sections', says: /"What PoB can't show" doesn't end with the H3 "Known issues"/ },
  // (c)
  { name: "(c) a Leveling H3 differs from the record's loadout name", fixture: 'run-ok', edit: (d) => editText(d, 'guide.md', replace('### Act 2 (L30) {2}', '### Act 2 (L31) {2}')), rule: 'leveling', says: /Leveling H3s are .*"Act 2 \(L31\) \{2\}".*the record's campaign loadouts.*"Act 2 \(L30\) \{2\}"/ },
  // (d)
  // D-276: guide.md carries no markers; the dossier and the research files keep theirs, and the plan's claims carry the guide's sources.
  { name: '(d) a dossier marker has no definition', fixture: 'run-ok', edit: (d) => editText(d, 'dossier.md', replace('for extra damage.[^d1]', 'for extra damage.[^d1][^nope]')), rule: 'markers', says: /dossier\.md:\d+: marker \[\^nope\] has no definition/ },
  { name: '(d) a price definition names no prices[] entry', fixture: 'run-ok', edit: (d) => editText(d, 'dossier.md', replace('[^d4]: price | c1-weapon', '[^d4]: price | no-such-price')), rule: 'markers', says: /price "no-such-price" names no prices\[\] entry/ },
  { name: '(d) a ledger definition names no ledger entry', fixture: 'run-ok', edit: (d) => editText(d, 'dossier.md', replace('[^d3]: pob-data | check_model_coverage gem "Blood Hunt" | patch: 0.5.4', '[^d3]: ledger | no_such_entry')), rule: 'markers', says: /ledger "no_such_entry" names no ledger entry/ },
  { name: '(d) a data definition names no C1/E1 fact', fixture: 'run-ok', edit: (d) => editText(d, 'dossier.md', replace('[^d3]: pob-data | check_model_coverage gem "Blood Hunt" | patch: 0.5.4', '[^d3]: data | campaign/limits.json#resistance-penalty.act9')), rule: 'markers', says: /names no C1\/E1 fact/ },
  // (e)
  { name: "(e) an external tag has no accessed (a plan claim's)", fixture: 'run-ok-online', edit: (d) => editPlan(d, (p) => delete stageB(p).claims.find((c: Json) => c.id === 'b-meta').source.accessed), rule: 'source-tags', says: /an external tag has no accessed date/ },
  // (f)
  { name: "(f) a judgment tag has no confidence (a plan claim's)", fixture: 'run-ok', edit: (d) => editPlan(d, (p) => delete stageM(p).claims.find((c: Json) => c.id === 'm-boots').source.confidence), rule: 'source-tags', says: /a judgment tag has no confidence/ },
  // (g)
  {
    name: '(g) an external-unavailable tag in an online run',
    fixture: 'run-ok-online',
    edit: (d) => editPlan(d, (p) => (stageM(p).claims.find((c: Json) => c.id === 'm-budget').source = { kind: 'external-unavailable', ref: 'external source unavailable (offline run)', confidence: 'M' })),
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
  { name: "(l) a finding open after the re-check is missing from the guide's Known issues (by sentence)", fixture: 'run-ok', edit: (d) => editText(d, 'guide.md', replace(`- ${PROSE_READER}\n`, 'None.\n')), rule: 'known-issues', says: /V4 prose finding "v4-prose-1" .* is open after the re-check, but guide\.md's Known issues doesn't list its reader sentence, word for word/ },
  { name: "(l) an open finding's id is missing from audit.md's Known issues", fixture: 'run-ok', edit: (d) => editText(d, 'audit.md', replace(`| v4-prose-1 | prose | — | ${PROSE_READER} |\n`, '')), rule: 'known-issues', says: /V4 prose finding "v4-prose-1" .* is open after the re-check, but audit\.md's Known issues has no row "\| v4-prose-1 \| prose \| — \| <its reader sentence> \|"/ },
  // (n)
  { name: '(n) a V4 finding misses a field', fixture: 'run-ok', edit: (d) => editJson(d, 'reports/v4-sources.json', (r) => delete r.findings[0].evidence), rule: 'report-shape', says: /v4-sources\.json: findings\[0\] has no evidence/ },
  { name: '(n) verdict pass alongside an unresolved finding', fixture: 'run-ok', edit: (d) => editJson(d, 'reports/v4-sources.json', (r) => (r.findings[0].status = 'unresolved')), rule: 'report-shape', says: /says verdict "pass" alongside 1 unresolved finding/ },
  { name: "(n) a report's check differs from its name", fixture: 'run-ok', edit: (d) => editJson(d, 'reports/v4-prose-recheck.json', (r) => (r.check = 'full')), rule: 'report-shape', says: /v4-prose-recheck\.json: check is "full"; its name says "recheck"/ },
  { name: "(n) a finding on the dossier, which V4 doesn't check (S3), or owned by dossier-fix", fixture: 'run-ok', edit: (d) => editJson(d, 'reports/v4-prose.json', (r) => Object.assign(r.findings[0], { artifact: 'dossier.md', owner: 'dossier-fix' })), rule: 'report-shape', says: /artifact is "dossier\.md"/ },
  // (o)
  { name: '(o) floor: pass, but the record has MissingColdResist above 0', fixture: 'run-ok', edit: (d) => editJson(d, 'compile-record.json', (r) => (r.stages.b.outputs.MissingColdResist = 5)), rule: 'floor', says: /says floor: "pass", but the records give "fail": .*MissingColdResist is 5/ },
  { name: '(o) MissingChaosResist above 0 and the chaosResistException removed (D-234)', fixture: 'run-ok', edit: (d) => editPlan(d, (p) => delete stageB(p).chaosResistException), rule: 'floor', says: /MissingChaosResist is 47 and it has no chaosResistException/ },
  { name: "(o) the exception's reason is missing from the guide's Checks (D-234)", fixture: 'run-ok', edit: (d) => editText(d, 'guide.md', replace('because no slot can carry chaos resistance', 'because of the')), rule: 'floor', says: /no line of the guide's "Endgame: budget" Checks states its full reason .* with the uncapped value 28% \(D-234\)/ },
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
  { name: '(s) the loadout count differs from the plan stages: one tree set missing (D-215)', fixture: 'run-ok', edit: (d) => recode(d, specs(['Act 1 (L8) {1}', 'Act 2 (L30) {2}', 'Entering maps (L65) {m}', 'Endgame budget (L90) {b}'])), rule: 'pob-file', says: /holds 4 tree set\(s\), but the record compiled 5 stage\(s\); the file holds one loadout per stage \(D-215\)/ },
  { name: "(s) a tree set isn't titled by its stage's loadout name (a Default left behind)", fixture: 'run-ok', edit: (d) => recode(d, specs(['Default', 'Act 2 (L30) {2}', 'Entering maps (L65) {m}', 'Endgame budget (L90) {b}', 'Endgame non-budget (L95) {n}'])), rule: 'pob-file', says: /tree sets are titled \["Default",.*the record's loadout names, in plan order, are \["Act 1 \(L8\) \{1\}"/ },
  // (t)
  { name: "(t) a ledger entry doesn't re-evaluate to the record's value", fixture: 'run-ok', edit: (d) => editJson(d, 'compile-record.json', (r) => (r.ledger.ttk_arbiter.value = 161)), rule: 'ledger', says: /ledger entry ttk_arbiter re-evaluates to 160, but the final record has 161 \(compared to 2 decimals\)/ },
  { name: "(t) a doubled ledger formula (FI-4's edit) doesn't re-evaluate to the record's value", fixture: 'run-ok', edit: (d) => editPlan(d, (p) => (p.ledger[0].formula = `(${p.ledger[0].formula}) * 2`)), rule: 'ledger', says: /ledger entry ttk_arbiter re-evaluates to 320, but the final record has 160/ },
  // (u)
  { name: "(u) the rolled figure's stat set isn't skills.main.statSet (S7)", fixture: 'run-ok', edit: (d) => editPlan(d, (p) => (stageB(p).skills.main.statSet = 2)), rule: 'rolled-skill', says: /says rolledSkill: "pass", but the records give "fail": stage b's rolled figure g1s1p1\.TotalDPS isn't the main skill's stat set g1s1p2 \(skills\.main\)/ },
  { name: '(u) an endgame stage sets no skills.main.statSet (S7)', fixture: 'run-ok', edit: (d) => editPlan(d, (p) => delete stageB(p).skills.main.statSet), rule: 'rolled-skill', says: /says rolledSkill: "pass", but the records give "fail": stage b sets no skills\.main\.statSet/ },
  // (v), amendment 2 (D-283)
  { name: '(v) guide.md over 3,000 words', fixture: 'run-ok', edit: (d) => editText(d, 'guide.md', replace('## Changelog\n', `${'word '.repeat(3000)}\n\n## Changelog\n`)), rule: 'word-cap', says: /guide\.md has \d+ words, over the 3000-word cap \(the H1, the import code and the Known issues list not counted/ },
  // (w)
  { name: '(w) a footnote marker in guide.md', fixture: 'run-ok', edit: (d) => editText(d, 'guide.md', replace('one button for rares;', 'one button for rares;[^g1]')), rule: 'guide-markers', says: /guide\.md:\d+ carries a footnote marker "\[\^"/ },
  { name: '(w) a confidence label in guide.md', fixture: 'run-ok', edit: (d) => editText(d, 'guide.md', replace('I read it as a ceiling.', 'I read it as a ceiling (confidence L).')), rule: 'guide-markers', says: /carries the confidence label "confidence L"/ },
  { name: '(w) a finding id in guide.md (the old Known issues form)', fixture: 'run-ok', edit: (d) => editText(d, 'guide.md', replace(`- ${PROSE_READER}\n`, `- ${PROSE_READER} (v4-prose-1)\n`)), rule: 'guide-markers', says: /carries the finding id "v4-prose-1"/ },
  // (x)
  { name: "(x) a rung's verdict line is missing", fixture: 'run-ok', edit: (d) => editText(d, 'guide.md', (t) => t.replace(/- \*\*Budget \(L90\)[^\n]*\n/, '')), rule: 'verdict-line', says: /"Survival by stage" has no verdict line for the Budget rung, stage b/ },
  { name: '(x) a verdict line not in the fixed form', fixture: 'run-ok', edit: (d) => editText(d, 'guide.md', replace('75/75/75/28% at −60%.', '75/75/75/28% at the endgame penalty.')), rule: 'verdict-line', says: /the Budget verdict line isn't in the fixed form/ },
  { name: "(x) a verdict line's level differs from the stage's", fixture: 'run-ok', edit: (d) => editText(d, 'guide.md', replace('**Budget (L90): solid.**', '**Budget (L91): solid.**')), rule: 'verdict-line', says: /the Budget verdict line says level 91, but stage b's level is 90/ },
  { name: "(x) a verdict line's resistance is wrong", fixture: 'run-ok', edit: (d) => editText(d, 'guide.md', replace('75/75/75/28%', '75/75/75/29%')), rule: 'verdict-line', says: /the Budget verdict line says chaos resistance 29, but b\.ChaosResist is 28/ },
  { name: "(x) a verdict line's max hit is wrong", fixture: 'run-ok', edit: (d) => editText(d, 'guide.md', replace('Max hit 5,100 physical', 'Max hit 6,100 physical')), rule: 'verdict-line', says: /the Budget verdict line says physical max hit 6,100, but b\.PhysicalMaximumHitTaken is 5100/ },
  { name: "(x) a verdict line's other max hit is the largest, not the least", fixture: 'run-ok', edit: (d) => editText(d, 'guide.md', replace('at least 3,000 elemental', 'at least 9,800 elemental')), rule: 'verdict-line', says: /says elemental or chaos max hit 9,800, but the least of b's FireMaximumHitTaken, ColdMaximumHitTaken, LightningMaximumHitTaken, ChaosMaximumHitTaken is 3000/ },
  { name: "(x) a verdict line's hit is mis-rounded", fixture: 'run-ok', edit: (d) => editText(d, 'guide.md', replace('physical against about 400,', 'physical against about 410,')), rule: 'verdict-line', says: /the Budget verdict line says physical hit 410, but the ledger's hit_b_physical is 401\.99/ },
  { name: "(x) a verdict line quotes the scenario's whole number, not its ledger hit rounded", fixture: 'run-ok', edit: (d) => editText(d, 'guide.md', replace('physical against about 300,', 'physical against about 299,')), rule: 'verdict-line', says: /the Entering maps verdict line says physical hit 299, but the ledger's hit_m_physical is 298\.09/ },
  { name: "(x) a verdict line's DPS isn't the D1 gate's rolled figure", fixture: 'run-ok', edit: (d) => editText(d, 'guide.md', replace('Blood Hunt about 50,000 DPS', 'Blood Hunt about 60,000 DPS')), rule: 'verdict-line', says: /the Budget verdict line says DPS 60,000, but the rolled-skill figure b\.g1s1p1\.TotalDPS is 50000/ },
  // (y)
  { name: "(y) the entering-maps rung's budget above 5.5 divines", fixture: 'run-ok-online', edit: (d) => editPlan(d, (p) => (p.prices.find((x: Json) => x.id === 'm-weapon').amount = 3.2)), rule: 'budget', says: /says budget: "pass", but the records give "fail": stage m totals 5\.6 divines, above 5\.5 \(D-281\)/ },
  { name: '(y) the entering-maps rung above 5 divines without "near the ceiling"', fixture: 'run-ok-online', edit: (d) => editPlan(d, (p) => (p.prices.find((x: Json) => x.id === 'm-weapon').amount = 2.8)), rule: 'budget', says: /entering-maps stage m totals 5\.2 divines, over 5, but the guide's "Endgame: entering maps" Checks lack "near the ceiling" \(D-281\)/ },
  { name: "(y) the entering-maps rung's floor: a resistance below its cap", fixture: 'run-ok', edit: (d) => editJson(d, 'compile-record.json', (r) => (r.stages.m.outputs.MissingColdResist = 5)), rule: 'floor', says: /says floor: "pass", but the records give "fail": .*stage m MissingColdResist is 5/ },
  { name: "(y) the entering-maps rung's floor: a hit cited at another area level than 69 (D-327)", fixture: 'run-ok', edit: (d) => editPlan(d, (p) => (stageM(p).config.scenario.find((o: Json) => o.option === 'enemyFireDamage').source.key = 'damage.by-level[79]')), rule: 'floor', says: /stage m's enemyFireDamage cites "enemies\/map-monsters\.json#damage\.by-level\[79\]"; the entering-maps variant's area level is 69/ },
  // (z)
  { name: '(z) audit.md is missing one of its H2s', fixture: 'run-ok', edit: (d) => editText(d, 'audit.md', replace('## Run notes\n', '')), rule: 'audit-sections', says: /audit\.md's H2s are missing \["Run notes"\]/ },
  { name: '(z) audit.md is missing beside a current guide', fixture: 'run-ok', edit: (d) => fs.rmSync(path.join(d, 'audit.md')), rule: 'audit-sections', says: /guide\.md exists, but audit\.md doesn't/ },
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
// Amendment 2's guards (WU-62): the word cap, the verdict line's rounding rule, the entering-maps rung
// ---------------------------------------------------------------------------------------------------

/** D-283's word: a run of non-space characters that holds a letter or a digit. */
const wordsIn = (text: string) => text.split(/\s+/).filter((t) => /[\p{L}\p{N}]/u.test(t)).length;

describe('D-283: the guide has at most 3,000 words, the H1, the import code and the Known issues list not counted (v)', () => {
  /** run-ok's guide padded with filler words in its FAQ until the counted words reach `total`. */
  const padTo = (total: number) => {
    const dir = copyOf('run-ok');
    const text = fs.readFileSync(path.join(dir, 'guide.md'), 'utf8');
    const lines = text.split('\n');
    const code = text.indexOf('```\n') >= 0 ? /```\n([^\n]*)\n```/.exec(text)![1] : '';
    const counted = lines.filter((l) => !l.startsWith('# ') && l !== code && l !== `- ${PROSE_READER}`).join('\n');
    const pad = total - wordsIn(counted);
    expect(pad).toBeGreaterThan(0);
    editText(dir, 'guide.md', replace('## Changelog\n', `${'filler '.repeat(pad)}\n\n## Changelog\n`));
    return dir;
  };

  it('passes a guide of exactly 3,000 counted words, and fails one word more', () => {
    passes(padTo(3000));
    expect(failing(padTo(3001))).toMatch(/\[word-cap\] guide\.md has 3001 words, over the 3000-word cap/);
  });
});

describe("D-283: the verdict line's numbers match the record by the rounding rule (x)", () => {
  it('matches a number at its own last significant digit: "5,100" matches 5,136 but not 5,150; "about 400" matches 401.996', () => {
    const near = copyOf('run-ok');
    editJson(near, 'compile-record.json', (r) => (r.stages.b.outputs.PhysicalMaximumHitTaken = 5136));
    passes(near);
    const off = copyOf('run-ok');
    editJson(off, 'compile-record.json', (r) => (r.stages.b.outputs.PhysicalMaximumHitTaken = 5150));
    expect(failing(off)).toMatch(/\[verdict-line\] guide\.md:\d+: the Budget verdict line says physical max hit 5,100, but b\.PhysicalMaximumHitTaken is 5150/);
    // The fixture's budget hit: the ledger value 401.9956…, written "about 400".
    expect(readJson(path.join(FIXTURES, 'run-ok'), 'compile-record.json').ledger.hit_b_physical.value).toBeCloseTo(401.9956, 4);
    expect(fs.readFileSync(path.join(FIXTURES, 'run-ok', 'guide.md'), 'utf8')).toContain('Max hit 5,100 physical against about 400,');
  });

  it("fails a verdict line for a rung the plan doesn't have, and a rung with two lines", () => {
    const extra = copyOf('run-ok');
    editPlan(extra, (p) => (p.stages = p.stages.filter((s: Json) => s.id !== 'm')));
    expect(failing(extra)).toMatch(/\[verdict-line\] guide\.md's "Survival by stage" has a verdict line for the Entering maps rung, but the plan has no such rung/);
    const twice = copyOf('run-ok');
    editText(twice, 'guide.md', (t) => t.replace(/(- \*\*Budget \(L90\)[^\n]*\n)/, '$1$1'));
    expect(failing(twice)).toMatch(/\[verdict-line\] guide\.md's "Survival by stage" has 2 verdict lines for the Budget rung; one per rung/);
  });
});

describe("D-281: the entering-maps rung m is gated like b: its floor at area 69, its budget 5 divines (5.5 with \"near the ceiling\")", () => {
  const withWeapon = (amount: number) => {
    const dir = copyOf('run-ok-online');
    editPlan(dir, (p) => (p.prices.find((x: Json) => x.id === 'm-weapon').amount = amount));
    return dir;
  };
  const note = (dir: string) => editText(dir, 'guide.md', replace('- Budget: 4.4 divines against the 5-divine ceiling.', '- Budget: 5.5 divines against 5, near the ceiling: within the 5.5-divine tolerance.'));

  it('passes up to 5, and up to 5.5 with "near the ceiling" in its Checks; above 5.5 fails', () => {
    passes(withWeapon(2.6)); // 5.0 divines
    const near = withWeapon(3.1); // 5.5 divines
    expect(failing(near)).toMatch(/\[budget\] entering-maps stage m totals 5\.5 divines, over 5, but the guide's "Endgame: entering maps" Checks lack "near the ceiling" \(D-281\)/);
    note(near);
    passes(near);
    const over = withWeapon(3.11); // 5.51 divines
    note(over);
    expect(failing(over)).toMatch(/\[budget\] .*stage m totals 5\.51 divines, above 5\.5 \(D-281\)/);
  });

  it("is unverified offline, which doesn't fail the gate (run-ok)", () => {
    const plan = readJson(path.join(FIXTURES, 'run-ok'), 'plan.json');
    expect((plan.prices as Json[]).filter((p) => p.id.startsWith('m-')).every((p) => p.status === 'unavailable')).toBe(true);
    passes(copyOf('run-ok'));
  });

  it("holds m's chaos exception to one line of its own Checks (D-234)", () => {
    const dir = copyOf('run-ok');
    editText(dir, 'guide.md', replace('Chaos resistance stays at 10% because', 'Chaos resistance stays low because'));
    expect(failing(dir)).toMatch(/\[floor\] stage m keeps chaos resistance uncapped by its exception, but no line of the guide's "Endgame: entering maps" Checks states its full reason .* with the uncapped value 10% \(D-234\)/);
  });

  it('FI-2 breaks the first rung of the ladder, m, wherever the plan lists it: its attempt-1 failure there runs free', () => {
    const dir = copyOf('run-ok');
    // The plan lists b before m; the ladder still starts at m (D-282), and FI-2's finding is on m.
    editPlan(dir, (p) => {
      const m = p.stages.splice(p.stages.findIndex((s: Json) => s.id === 'm'), 1)[0];
      p.stages.splice(p.stages.findIndex((s: Json) => s.id === 'b') + 1, 0, m);
    });
    // The sources lens's accepted-offline locations follow the claims to their new stage indices.
    editJson(dir, 'reports/v4-sources.json', (r) => {
      r.findings[0].location = 'stages[2].claims[5]';
      r.findings[1].location = 'stages[3].claims[1]';
    });
    const tree = { part: 'v1', code: 'tree-disconnected', stage: 'n', message: 'stage n: node 123 not connected' };
    for (const a of [2, 3]) d1Verdict(dir, a, tree);
    d1Verdict(dir, 4, null);
    editLog(dir, (l) => {
      const i = l.stages.findIndex((s: Json) => s.stage === 'D1-gate' && s.attempt === 2);
      l.stages.splice(i, 1, step('D1-gate', 'c1', 2, 'fail'), step('D1', 'c1', 3, 'done'), step('D1-gate', 'c1', 3, 'fail'), step('D1', 'c1', 4, 'done'), step('D1-gate', 'c1', 4, 'pass'));
    });
    // Attempt 1 is free, so attempts 2 and 3 are the chain's 2 counted retries.
    passes(dir);
  });
});

// ---------------------------------------------------------------------------------------------------
// Known issues (S2, Q1): what is open after the re-check
// ---------------------------------------------------------------------------------------------------

describe('S2, Q1, D-276: every finding open after the re-check is listed under Known issues, by sentence, with its id in audit.md', () => {
  const dropListing = noneOpen;

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
    expect(stderr).toMatch(/\[known-issues\] V4 prose finding "v4-prose-2" .*is open after the re-check, but audit\.md's Known issues has no row/);
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
    editText(dir, 'guide.md', replace(`### Known issues\n\n- ${PROSE_READER}\n`, ''));
    expect(failing(dir)).toMatch(/\[known-issues\] 0 accepted gate finding\(s\) and 1 open V4 finding\(s\), but guide\.md has no "Known issues" H3 under "What PoB can't show"/);
  });

  it("fails an audit.md row whose sentence isn't the finding's reader sentence, or whose lens is another", () => {
    const dir = copyOf('run-ok');
    editText(dir, 'audit.md', replace(`| v4-prose-1 | prose | — | ${PROSE_READER} |`, '| v4-prose-1 | sources | — | Rotation is wrong. |'));
    const stderr = failing(dir);
    expect(stderr).toMatch(/\[known-issues\] audit\.md:\d+: the Known issues row for "v4-prose-1" names "sources", not its lens prose/);
    expect(stderr).toMatch(/\[known-issues\] audit\.md:\d+: the Known issues row for "v4-prose-1" gives "Rotation is wrong\.", not the finding's reader sentence/);
  });
});

describe('C-30, §7.4: accepted-offline is only the sources lens\'s word on a claim tagged external-unavailable', () => {
  it('fails another lens marking a finding accepted-offline', () => {
    const dir = copyOf('run-ok');
    editJson(dir, 'reports/v4-ledger.json', (r) => r.findings.push({ id: 'v4-ledger-1', artifact: 'guide.md', location: 'guide.md [^g9]', claim: 'c', issue: 'tagged external-unavailable', evidence: 'offline', owner: 'W1', status: 'accepted-offline' }));
    expect(failing(dir)).toMatch(/\[report-shape\] .*v4-ledger\.json: findings\[0\] is accepted-offline in a ledger lens report; only the V4 sources lens/);
  });

  it('fails a sources finding accepted-offline whose location names no external-unavailable claim', () => {
    for (const [artifact, location, why] of [
      ['plan.json', 'stages[3].claims[0]', /names a pob-computed claim/],
      ['plan.json', 'Summary, line 3', /names no claim/],
      // D-276: the guide carries no markers, so the sources lens has no guide side: no guide location is a claim.
      ['guide.md', 'guide.md [^g9]', /names no claim/],
    ] as const) {
      const dir = copyOf('run-ok');
      editJson(dir, 'reports/v4-sources.json', (r) => Object.assign(r.findings[1], { artifact, location }));
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
 * `listing`, the guide's Known issues prints that sentence, and audit.md's table holds the finding's row (D-276):
 * `row` overrides the row's id, gate and stage cells.
 */
function acceptedRun(finding: Json, listing: string | null, choice = 'accept', row: string | null = null): string {
  const dir = copyOf('run-ok');
  const passing = readJson(dir, lastD1);
  for (const a of [2, 3, 4]) writeJson(dir, `reports/gates/D1-gate-c1-a${a}.json`, { ...passing, attempt: a, verdict: { ...passing.verdict, [finding.part]: 'fail' }, findings: [...passing.findings, finding] });
  editLog(dir, (l) => {
    const i = l.stages.findIndex((s: Json) => s.stage === 'D1-gate' && s.attempt === 2);
    l.stages.splice(i, 1, step('D1-gate', 'c1', 2, 'fail'), step('D1', 'c1', 3, 'done'), step('D1-gate', 'c1', 3, 'fail'), step('D1', 'c1', 4, 'done'), step('D1-gate', 'c1', 4, 'escalated'));
    l.escalations.push({ stage: 'D1-gate', concept: 'c1', verdict: 'reports/gates/D1-gate-c1-a4.json', choice });
    l.checkpoints.splice(1, 0, { checkpoint: 'escalation', visit: 1, answer: choice, answeredBy: 'pre-supplied', rule: choice });
  });
  if (listing !== null) {
    editText(dir, 'guide.md', replace('### Known issues\n\n', `### Known issues\n\n- ${listing}\n`));
    editText(dir, 'audit.md', replace(AUDIT_KI_HEAD, `${AUDIT_KI_HEAD}| ${row ?? `${finding.code} | D1-gate | ${finding.stage}`} | ${listing} |\n`));
  }
  return dir;
}
const LEVEL_POINTS_SENTENCE = 'The budget variant spends more passive points than level 90 allows, so PoB2 shows it over the limit.';
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
    const dir = acceptedRun(levelPoints, LEVEL_POINTS_SENTENCE);
    editJson(dir, 'compile-record.json', (r) => (r.stages.b.v1 = v1Fail('level-points')));
    passes(dir);
  });

  it('does not cover the same code on another plan stage', () => {
    const dir = acceptedRun(levelPoints, LEVEL_POINTS_SENTENCE);
    editJson(dir, 'compile-record.json', (r) => {
      r.stages.b.v1 = v1Fail('level-points');
      r.stages.n.v1 = v1Fail('level-points');
    });
    const stderr = failing(dir);
    expect(stderr).toMatch(/\[record-verdicts\] the final record's stage n fails V1: level-points/);
    expect(stderr).not.toMatch(/stage b fails V1/);
  });

  it("requires audit.md's Known issues to hold the accepted finding's row with its gate and stage, and the guide to print its sentence (D-276)", () => {
    // The row names another plan stage: it isn't this finding's.
    expect(failing(acceptedRun(levelPoints, LEVEL_POINTS_SENTENCE, 'accept', 'level-points | D1-gate | n'))).toMatch(/\[known-issues\] audit\.md's Known issues has no row for accepted finding level-points with its gate D1-gate \(stage b\): "\| level-points \| D1-gate \| b \| <the sentence the guide prints> \|"/);
    // The guide prints another sentence than the row gives.
    const dir = acceptedRun(levelPoints, LEVEL_POINTS_SENTENCE);
    editJson(dir, 'compile-record.json', (r) => (r.stages.b.v1 = v1Fail('level-points')));
    editText(dir, 'guide.md', replace(`- ${LEVEL_POINTS_SENTENCE}\n`, '- The budget variant spends too many points.\n'));
    const stderr = failing(dir);
    expect(stderr).toMatch(/\[known-issues\] guide\.md's Known issues doesn't print "The budget variant spends more passive points than level 90 allows, so PoB2 shows it over the limit\.", the sentence audit\.md gives accepted finding level-points \(D1-gate, stage b\)/);
    expect(stderr).toMatch(/\[known-issues\] guide\.md:\d+: Known issues lists "- The budget variant spends too many points\.", which is the sentence of no finding/);
  });

  it('finds the accepted findings in the verdict file the escalation names, not in the log', () => {
    const dir = acceptedRun(levelPoints, LEVEL_POINTS_SENTENCE);
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

describe("checkpoints[]: a pre-supplied or default answer records its rule, which audit.md's Run notes quote as why this concept (D-278)", () => {
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

/** Writes R1b's verdict file for an attempt: a compile failure on the concept's skeleton stage names FI-1's gem. */
function r1bVerdict(dir: string, concept: string, attempt: number, compiled: 'pass' | 'fail', fault: boolean): void {
  const error = { part: 'compiled', code: 'compile-error', stage: `${concept}e`, message: `stage ${concept}e: unknown gem "FI-1 Unknown Gem"` };
  writeJson(dir, `reports/gates/R1b-${concept}-a${attempt}.json`, {
    stage: 'R1b', concept, attempt, verdict: { compiled }, findings: compiled === 'fail' ? [error] : [],
    faultsApplied: fault && compiled === 'fail' ? [{ id: 'FI-1', observed: error.message }] : [],
  });
}

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
    const withR1b = (outcomes: string[], persistent: boolean) => {
      outcomes.forEach((o, i) => r1bVerdict(dir, 'c1', i + 1, o === 'pass' ? 'pass' : 'fail', true));
      restage(dir, 0, [...research(r1b(outcomes)), ...rest], (l) => (l.faults = [l.faults[0], { id: 'FI-1', target: { concepts: ['c1'], persistent }, applied: outcomes.length, observed: 'FI-1 Unknown Gem' }]));
    };
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
    expect(failing(nofix)).toMatch(/\[order\] .*\(V4-sources-recheck c1 attempt 1\): can't follow V4-prose c1 attempt 1/);
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
    // Step 14 replaces the lists: with nothing open after the revision's pass, both say None.
    noneOpen(dir);
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
    expect(failing(dir)).toMatch(/\[escalation\] run-log\.json stages\[17\]: V4-prose-recheck is logged escalated; only the D1 and D2 gates escalate, and verification never does/);
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

// ---------------------------------------------------------------------------------------------------
// Review of bg/amend-1 (items 1-8, 10): each fix fails the reviewer's probe case and passes the legal routes
// ---------------------------------------------------------------------------------------------------

/** A copy of run-ok's passing D1 gate verdict, as attempt `attempt`, failing V1 with `finding` (or as is). */
const d1Verdict = (dir: string, attempt: number, finding: Json | null = levelPoints, concept = 'c1') => {
  const passing = readJson(path.join(FIXTURES, 'run-ok'), lastD1);
  writeJson(dir, `reports/gates/D1-gate-${concept}-a${attempt}.json`, {
    ...passing, concept, attempt,
    ...(finding ? { verdict: { ...passing.verdict, [finding.part]: 'fail' }, findings: [...passing.findings, finding] } : {}),
  });
};

describe('review 1 (HIGH): the D1 gate is recomputed whenever the record holds its values; only the budget may be unverified', () => {
  it("fails a gate that says every part unverified, routed pass, over failing records (probe p1-unverified)", () => {
    const dir = copyOf('run-ok');
    editJson(dir, lastD1, (r) => (r.verdict = { compiled: 'unverified', v1: 'unverified', v2: 'unverified', floor: 'unverified', budget: 'unverified', rolledSkill: 'unverified' }));
    editJson(dir, 'compile-record.json', (r) => {
      r.stages.b.outputs.MissingFireResist = 25;
      r.stages.b.skillOutputs.g2s1p1.fields.TotalDPS = 99999;
    });
    const stderr = failing(dir);
    expect(stderr).toMatch(/\[routing\] .*\(D1-gate c1 attempt 2\): is routed pass, but its verdict fails its compile, V1 or V2 \(or leaves one unverified\)/);
    expect(stderr).toMatch(/\[floor\] reports\/gates\/D1-gate-c1-a2\.json says floor: "unverified"; only the budget may be unverified/);
    expect(stderr).toMatch(/\[floor\] the guide's concept fails the D1 gate's floor \(missing-fire-resist, stage b\): stage b MissingFireResist is 25/);
    expect(stderr).toMatch(/\[rolled-skill\] the guide's concept fails the D1 gate's rolledSkill \(rolled-not-largest, stage b\)/);
  });

  it("fails a gate that didn't fail its compile but left no record of it", () => {
    const dir = copyOf('run-escalated');
    fs.rmSync(path.join(dir, 'compile-record.json'));
    fs.rmSync(path.join(dir, 'compiled-build.xml'));
    expect(failing(dir)).toMatch(/\[gates\] reports\/gates\/D1-gate-c1-a3\.json doesn't fail its compile, but compile-record\.json holds no values for the endgame stages/);
  });
});

describe('review 2 (MED): the stat-set check (S7) holds the rolled skill to the main skill, directly and in a ledger figure', () => {
  it('(a) fails an endgame or campaign stage whose main group is not its rolled group (probe p2-main-not-rolled)', () => {
    const dir = copyOf('run-ok');
    editPlan(dir, (p) => {
      stageB(p).skills.rolledGroup = 2;
      p.stages.find((s: Json) => s.id === '2').skills.main.group = 2;
    });
    const stderr = failing(dir);
    expect(stderr).toMatch(/\[rolled-skill\] the guide's concept fails the D1 gate's rolledSkill \(rolled-not-main, stage b\): stage b's main group is 1, but its rolled group is 2/);
    expect(stderr).toMatch(/\[rolled-skill\] campaign stage 2's main group is 2, but its rolledGroup is 1; a stage with the rolled skill makes it the main skill \(S7\)/);
  });

  it("(b) fails a ledger figure whose formula reads another stat set than skills.main's (probe p3-ledger-statset), and passes it on the main set", () => {
    const withLedgerFigure = (statSet: number) => {
      const dir = copyOf('run-ok');
      editPlan(dir, (p) => {
        stageB(p).skills.main.statSet = statSet;
        p.ledger.push({ id: 'bh_b', claim: 'Blood Hunt DPS on b', formula: 'b.g1s1p1.TotalDPS', inputs: [] });
      });
      editJson(dir, 'compile-record.json', (r) => (r.ledger.bh_b = { value: 50000, error: null }));
      editJson(dir, lastD1, (r) => (r.basis.rolledSkill.find((x: Json) => x.stage === 'b').figures[0].figure = 'ledger:bh_b'));
      return dir;
    };
    expect(failing(withLedgerFigure(2))).toMatch(/\[rolled-skill\] .*\(rolled-stat-set, stage b\): stage b's rolled figure ledger:bh_b reads b\.g1s1p1, not the main skill's stat set b\.g1s1p2 \(skills\.main\)/);
    passes(withLedgerFigure(1));
  });
});

describe('review 3 (MED): each gate attempt is routed as its verdict file says', () => {
  /** run-escalated stopped at checkpoint 1 after c1's D1 gate attempt 1, logged `outcome` after D1 claimed `claim`. */
  const routedOnce = (outcome: string, claim = 'done') => {
    const dir = copyOf('run-escalated');
    restage(dir, 5, [step('D1', 'c1', 1, claim), step('D1-gate', 'c1', 1, outcome)], (l) => {
      l.status = 'stopped';
      l.escalations = [];
      l.checkpoints = [l.checkpoints[0], { checkpoint: 1, visit: 2, answer: 'stop', answeredBy: 'default', rule: 'no checkpoint1 answer left: stop' }];
    });
    return dir;
  };
  const softFailure = (dir: string) => {
    editJson(dir, 'reports/gates/D1-gate-c1-a1.json', (r) => {
      r.verdict = { ...r.verdict, v1: 'pass', floor: 'fail' };
      r.findings = [{ part: 'floor', code: 'missing-cold-resist', stage: 'n', message: 'n.MissingColdResist 12' }];
    });
    editJson(dir, 'compile-record.json', (r) => (r.stages.n.outputs.MissingColdResist = 12));
  };

  it('fails an infeasible route over a V1 failure (probe p4-infeasible-misroute)', () => {
    expect(failing(routedOnce('infeasible'))).toMatch(/\[routing\] .*\(D1-gate c1 attempt 1\): is routed infeasible, but its verdict fails its compile, V1 or V2 .*; infeasible is FI-3's forced verdict, or a floor, budget or rolled-skill failure/);
  });

  it('routes a floor failure infeasible only when D1 claimed it, or after 2 counted retries', () => {
    const done = routedOnce('infeasible');
    softFailure(done);
    expect(failing(done)).toMatch(/\[routing\] .*: is routed infeasible, but D1 claimed done and the gate has 0 counted retries/);
    const claimed = routedOnce('infeasible', 'infeasible');
    softFailure(claimed);
    passes(claimed);
  });

  it("routes a forced verdict infeasible only under FI-3, and never anything else", () => {
    const forced = routedOnce('infeasible');
    editJson(forced, 'reports/gates/D1-gate-c1-a1.json', (r) => Object.assign(r, { forced: 'infeasible', evidence: 'FI-3 (injected)' }));
    expect(failing(forced)).toMatch(/\[routing\] .*: is routed infeasible, but its verdict is forced infeasible, but no FI-3 directive targets this attempt/);
    editLog(forced, (l) => l.faults.push({ id: 'FI-3', target: { concepts: ['c1'] }, applied: 1, observed: 'forced' }));
    passes(forced);
    editLog(forced, (l) => (l.stages[l.stages.length - 1].outcome = 'fail'));
    expect(failing(forced)).toMatch(/\[routing\] .*: is routed fail, but reports\/gates\/D1-gate-c1-a1\.json is forced infeasible \(FI-3\)/);
  });

  it('fails a pass route over a failing verdict, and a gate attempt with no verdict file', () => {
    const dir = copyOf('run-ok');
    editJson(dir, 'reports/gates/D2-gate-c1-a1.json', (r) => {
      r.verdict.v1 = 'fail';
      r.findings = [{ part: 'v1', code: 'tree-continuity', stage: '2', message: 'stage 2 drops a node' }];
    });
    expect(failing(dir)).toMatch(/\[routing\] .*\(D2-gate c1 attempt 1\): is routed pass, but its verdict fails its compile, V1 or V2/);
    const gone = copyOf('run-ok');
    fs.rmSync(path.join(gone, 'reports/gates/R1b-c2-a1.json'));
    expect(failing(gone)).toMatch(/\[routing\] .*\(R1b c2 attempt 1\): has no verdict file reports\/gates\/R1b-c2-a1\.json; a gate step writes its own/);
  });
});

describe("review 4 (MED): S6's free retry needs the verdict's faultsApplied and a failure on the faulted stage", () => {
  /** run-escalated with FI-2 on attempt 1 only: a free attempt 1 leaves the escalation at attempt 3 after 1 counted retry. */
  const freeFirst = (edit: (r: Json) => void) => {
    const dir = copyOf('run-escalated');
    editLog(dir, (l) => (l.faults[0].target.persistent = false));
    editJson(dir, 'reports/gates/D1-gate-c1-a1.json', edit);
    return dir;
  };

  it('grants it when the verdict names FI-2 and fails only on its stage: the escalation then comes too early', () => {
    expect(failing(freeFirst(() => undefined))).toMatch(/\[caps\] .*\(D1-gate c1 attempt 3\): escalates after 1 counted retry/);
  });

  it("doesn't grant it without FI-2 in faultsApplied, or for a failure on another stage: attempt 1 counts", () => {
    passes(freeFirst((r) => (r.faultsApplied = [])));
    passes(freeFirst((r) => r.findings.push({ part: 'v1', code: 'tree-disconnected', stage: 'n', message: 'stage n: node 123 not connected' })));
  });

  it('counts a real failure the faults list alone would have freed (probe p5-s6-free-real-failure)', () => {
    const dir = copyOf('run-ok');
    const tree = { part: 'v1', code: 'tree-disconnected', stage: 'n', message: 'stage n: node 123 not connected' };
    editJson(dir, 'reports/gates/D1-gate-c1-a1.json', (r) => {
      r.findings = [tree];
      r.faultsApplied = [];
    });
    for (const a of [2, 3]) d1Verdict(dir, a, tree);
    d1Verdict(dir, 4, null);
    editLog(dir, (l) => {
      const i = l.stages.findIndex((s: Json) => s.stage === 'D1-gate' && s.attempt === 2);
      l.stages.splice(i, 1, step('D1-gate', 'c1', 2, 'fail'), step('D1', 'c1', 3, 'done'), step('D1-gate', 'c1', 3, 'fail'), step('D1', 'c1', 4, 'done'), step('D1-gate', 'c1', 4, 'pass'));
    });
    expect(failing(dir)).toMatch(/\[caps\] .*\(D1-gate c1 attempt 3\): is counted failure 3 of D1-gate for c1 in one chain/);
  });
});

describe('review 5 (MED): the log says which artifacts are current; legal routes pass once a guide exists', () => {
  /** run-ok after its first cycle: a checkpoint-2 revision of D1 that fails its gate twice, then escalates. */
  const revisionEscalates = (choice: string) => {
    const dir = copyOf('run-ok');
    for (const a of [3, 4, 5]) d1Verdict(dir, a);
    editLog(dir, (l) => {
      l.stages.push(step('D1', 'c1', 3, 'done'), step('D1-gate', 'c1', 3, 'fail'), step('D1', 'c1', 4, 'done'), step('D1-gate', 'c1', 4, 'fail'), step('D1', 'c1', 5, 'done'), step('D1-gate', 'c1', 5, 'escalated'));
      l.checkpoints[1] = { checkpoint: 2, visit: 1, answer: 'revise:cheaper boots', answeredBy: 'pre-supplied', rule: 'revise:cheaper boots' };
      l.checkpoints.push({ checkpoint: 'escalation', visit: 1, answer: choice, answeredBy: choice === 'stop' ? 'default' : 'pre-supplied', rule: choice === 'stop' ? 'no escalation answer left: stop' : choice });
      l.escalations.push({ stage: 'D1-gate', concept: 'c1', verdict: 'reports/gates/D1-gate-c1-a5.json', choice });
      l.status = 'escalated';
    });
    return dir;
  };

  it('passes a revision whose D1 gate escalates to a stop: the guide is from before it (probe p8-fixround-escalation-stop)', () => {
    passes(revisionEscalates('stop'));
  });

  it("passes the run going back to checkpoint 1 and another concept's design: the guide is the first concept's (probe p7-stale-guide-false-reject)", () => {
    const dir = revisionEscalates('checkpoint-1');
    d1Verdict(dir, 1, null, 'c2');
    editJson(dir, 'reports/gates/D1-gate-c2-a1.json', (r) => Object.assign(r, { forced: 'infeasible', evidence: 'FI-3 (injected)' }));
    editLog(dir, (l) => {
      l.stages.push(step('D1', 'c2', 1, 'done'), step('D1-gate', 'c2', 1, 'infeasible'));
      l.checkpoints.push({ checkpoint: 1, visit: 2, answer: 'pick:c2', answeredBy: 'pre-supplied', rule: 'pick:c2' }, { checkpoint: 1, visit: 3, answer: 'stop', answeredBy: 'default', rule: 'no checkpoint1 answer left: stop' });
      l.faults.push({ id: 'FI-3', target: { concepts: ['c2'] }, applied: 1, observed: 'forced' });
      l.status = 'stopped';
    });
    passes(dir);
  });

  it('fails a completed run whose guide is older than the design steps after it', () => {
    const dir = revisionEscalates('stop');
    editLog(dir, (l) => (l.status = 'completed'));
    expect(failing(dir)).toMatch(/\[layout\] status is "completed", but guide\.md is from W1 c1 attempt 2, and design steps ran after it/);
  });
});

describe('review 6 (MED): a fix round that re-runs D1 or D2 re-checks all three lenses over the new plan and guide', () => {
  /** run-ok whose fix round runs D1 → D1 gate → D2 gate → W1 instead of W1 alone, then re-checks `lenses`. */
  const designFix = (lenses: string[]) => {
    const dir = copyOf('run-ok');
    d1Verdict(dir, 3, null);
    fs.copyFileSync(path.join(dir, 'reports/gates/D2-gate-c1-a1.json'), path.join(dir, 'reports/gates/D2-gate-c1-a2.json'));
    editJson(dir, 'reports/gates/D2-gate-c1-a2.json', (r) => (r.attempt = 2));
    for (const lens of lenses.filter((l) => l !== 'prose')) {
      editJson(dir, `reports/v4-${lens}.json`, () => undefined);
      fs.copyFileSync(path.join(dir, `reports/v4-${lens}.json`), path.join(dir, `reports/v4-${lens}-recheck.json`));
      editJson(dir, `reports/v4-${lens}-recheck.json`, (r) => (r.check = 'recheck'));
    }
    restage(dir, 15, [step('D1', 'c1', 3, 'done'), step('D1-gate', 'c1', 3, 'pass'), step('D2-gate', 'c1', 2, 'pass'), step('W1', 'c1', 2, 'done'), ...lenses.map((l) => step(`V4-${l}-recheck`, 'c1', 1, l === 'prose' ? 'fail' : 'pass'))]);
    return dir;
  };

  it('fails a targeted re-check of only the raising lens after D1 re-ran', () => {
    expect(failing(designFix(['prose']))).toMatch(/\[verification\] .*a gate re-ran in the fix round \(an owner recompiled\), so the re-check before it is a full pass of all three lenses over the new plan and guide, but it ran without ledger, sources \(D-264\)/);
  });

  it('passes the full re-check, a lens that raised nothing included; still no second fix round', () => {
    passes(designFix(['ledger', 'sources', 'prose']));
  });
});

describe('review 7 (LOW): each reference hit is derived from the damage at its variant\'s area level (D-254, D-256)', () => {
  it('fails a hit whose ledger base is another level\'s damage (probe p6-d256-tiny-hits), and a hit citing another level', () => {
    const dir = copyOf('run-ok');
    editPlan(dir, (p) => {
      p.ledger.find((e: Json) => e.id === 'hit_b_physical').inputs.find((x: Json) => x.name === 'base').value = 9.1599998474121;
      stageB(p).config.scenario.find((o: Json) => o.option === 'enemyPhysicalDamage').value = 12;
      stageB(p).config.scenario.find((o: Json) => o.option === 'enemyFireDamage').source.key = 'damage.by-level[78]';
    });
    editJson(dir, 'compile-record.json', (r) => (r.ledger.hit_b_physical.value = 9.1599998474121 * 1.24));
    const stderr = failing(dir);
    expect(stderr).toMatch(/\[floor\] .*\(reference-hit-ledger-physical, stage b\): stage b's ledger entry hit_b_physical is 11\.358\d*, but the damage at its area level 79 \(enemies\/map-monsters\.json#damage\.by-level\[79\], 324\.19\d*\) × \(1 \+ 24 \/ 100\) is 402 \(D-254\)/);
    expect(stderr).toMatch(/\[floor\] .*\(reference-hit-ledger-fire, stage b\): stage b's enemyFireDamage cites "enemies\/map-monsters\.json#damage\.by-level\[78\]"; the budget variant's area level is 79/);
    expect(stderr).not.toMatch(/\[ledger\]/);
  });
});

describe('review 8 (LOW): a completed run ends with checkpoint 2 answered accept', () => {
  it('fails a completed run with no checkpoint-2 accept (probe p9-completed-without-accept)', () => {
    const dir = copyOf('run-ok');
    editLog(dir, (l) => (l.checkpoints = l.checkpoints.filter((c: Json) => c.checkpoint !== 2)));
    expect(failing(dir)).toMatch(/\[order\] run-log\.json: status is "completed", but checkpoint 2's last answer is undefined; only an accept at checkpoint 2 completes a run/);
  });
});

describe('review 10 (LOW): a guided retry gives the producer one more attempt, then its gate; any failure escalates again', () => {
  it('fails a guided retry whose gate failure is routed infeasible instead of escalating', () => {
    const dir = copyOf('run-escalated');
    d1Verdict(dir, 4, { part: 'floor', code: 'missing-cold-resist', stage: 'n', message: 'n.MissingColdResist 12' });
    editLog(dir, (l) => {
      l.escalations[0].choice = 'retry';
      l.escalations[0].guidance = 'drop the level-1 stage';
      l.checkpoints[1] = { checkpoint: 'escalation', visit: 1, answer: 'retry:drop the level-1 stage', answeredBy: 'pre-supplied', rule: 'retry:drop the level-1 stage' };
      l.stages.push(step('D1', 'c1', 4, 'done'), step('D1-gate', 'c1', 4, 'infeasible'));
      l.status = 'stopped';
    });
    expect(failing(dir)).toMatch(/\[routing\] .*\(D1-gate c1 attempt 4\): is routed infeasible, but a guided retry that fails escalates again/);
  });
});

describe("W19: run B's failure routes pass the checker with no --partial (no viable concept, FI-3, a D1 gate escalation stopped by default)", () => {
  it('passes R1b failing every concept under a persistent FI-1, c1 forced infeasible, c2 escalating on a persistent FI-2', () => {
    const dir = copyOf('run-escalated');
    for (const c of ['c1', 'c2', 'c3']) for (const a of [1, 2, 3]) r1bVerdict(dir, c, a, 'fail', true);
    for (const a of [2, 3]) fs.rmSync(path.join(dir, `reports/gates/D1-gate-c1-a${a}.json`));
    for (const a of [1, 2, 3]) {
      writeJson(dir, `reports/gates/D1-gate-c2-a${a}.json`, { ...readJson(path.join(FIXTURES, 'run-escalated'), `reports/gates/D1-gate-c1-a${a}.json`), concept: 'c2' });
    }
    editJson(dir, 'reports/gates/D1-gate-c1-a1.json', (r) => Object.assign(r, { forced: 'infeasible', evidence: 'FI-3 (injected)', faultsApplied: [{ id: 'FI-3', observed: 'gate run as usual; outcome forced to infeasible' }] }));
    editText(dir, 'dossier.md', replace('## Not carried', '### c3: Blood Hunt on a two-hander\n\n- Status: failed after 3 attempts (reports/gates/R1b-c3-a3.json).\n\n## Not carried'));
    const r1bs = ['c1', 'c2', 'c3'].flatMap((c) => [1, 2, 3].map((a) => step('R1b', c, a, 'fail')));
    restage(dir, 0, [
      step('R1a', null, 1, 'done'), step('R1a', null, 1, 'done'), step('R1a', null, 1, 'done'), ...r1bs, step('R1b-assemble', null, 1, 'done'),
      step('D1', 'c1', 1, 'done'), step('D1-gate', 'c1', 1, 'infeasible'),
      step('D1', 'c2', 1, 'done'), step('D1-gate', 'c2', 1, 'fail'), step('D1', 'c2', 2, 'done'), step('D1-gate', 'c2', 2, 'fail'), step('D1', 'c2', 3, 'done'), step('D1-gate', 'c2', 3, 'escalated'),
    ], (l) => {
      l.checkpoints = [
        { checkpoint: 1, visit: 1, answer: 'pick:c1', answeredBy: 'pre-supplied', rule: 'pick:c1' },
        { checkpoint: 1, visit: 2, answer: 'pick:c2', answeredBy: 'pre-supplied', rule: 'pick:c2' },
        { checkpoint: 'escalation', visit: 1, answer: 'stop', answeredBy: 'default', rule: 'no escalation answer left: stop' },
      ];
      l.escalations = [{ stage: 'D1-gate', concept: 'c2', verdict: 'reports/gates/D1-gate-c2-a3.json', choice: 'stop' }];
      l.faults = [
        { id: 'FI-1', target: { concepts: 'all', persistent: true }, applied: 9, observed: 'each R1b compile failed on FI-1 Unknown Gem' },
        { id: 'FI-3', target: { concepts: ['c1'] }, applied: 1, observed: "c1's D1 gate forced infeasible" },
        { id: 'FI-2', target: { concepts: ['c2'], persistent: true }, applied: 3, observed: "each of c2's D1 gates found V1 level-points on stage b" },
      ];
    });
    passes(dir);
  });
});

// ---------------------------------------------------------------------------------------------------
// D-264: the fix round fixes claims in place; only a recompile re-runs the gates and the full re-check
// ---------------------------------------------------------------------------------------------------

describe('D-264: a claims-only fix round edits claims in place, runs no gate, and re-checks the raising lenses and the sources lens', () => {
  /**
   * run-ok whose fix round is a claims-only D1 (its claims edited in place, nothing compiled, so the record keeps
   * the final compile's planSha1 and buildSha1), then W1 patching the guide, then the targeted re-check: the
   * prose lens, which raised the finding, and the sources lens, which always re-checks the changed locations.
   */
  const claimsOnly = (planEdit: (p: Json) => void = (p) => (stageB(p).claims[0].text += ' (fixed in place)')) => {
    const dir = copyOf('run-ok');
    editJson(dir, 'plan.json', planEdit);
    restage(dir, 15, [step('D1', 'c1', 3, 'claims-edited'), step('W1', 'c1', 2, 'done'), step('V4-sources-recheck', 'c1', 1, 'pass'), step('V4-prose-recheck', 'c1', 1, 'fail')]);
    return dir;
  };

  it('passes D1 → W1 → the targeted re-check: the plan differs from the record only in its claims, sources and tags', () => {
    const dir = claimsOnly((p) => {
      stageB(p).claims[0].text += ' (fixed in place)';
      stageB(p).claims[1].source = { kind: 'judgment', ref: 'recited', confidence: 'M' };
      stageB(p).config.scenario[0].tag = { ...stageB(p).config.scenario[0].tag, ref: 'recited' };
    });
    expect(sha1(fs.readFileSync(path.join(dir, 'plan.json')))).not.toBe(readJson(dir, 'compile-record.json').planSha1);
    passes(dir);
  });

  it('item 1 (D-266): fails a claims-only round that swapped gear, added a gem, dropped a tree node or changed a ledger formula (the review\'s run-gearswap)', () => {
    const swaps: [string, (p: Json) => void][] = [
      ['item', (p) => (stageB(p).items.slots.find((x: Json) => x.slot === 'Body Armour').text = "Rarity: Unique\nKaom's Heart\nClaimed Body\n+500 to maximum Life")],
      ['gem', (p) => stageB(p).skills.groups[0].gems.push({ name: 'Martial Tempo', level: 20, quality: 0, enabled: true })],
      ['tree', (p) => (stageB(p).tree.nodes = stageB(p).tree.nodes.slice(1))],
      ['ledger', (p) => (p.ledger[0].formula = `(${p.ledger[0].formula}) * 2`)],
      ['config', (p) => (stageB(p).config.scenario.find((o: Json) => o.option === 'enemyFireDamage').value = 120)],
    ];
    for (const [what, swap] of swaps) {
      const stderr = failing(claimsOnly((p) => {
        stageB(p).claims[0].text += ' (fixed in place)';
        swap(p);
      }));
      expect({ what, line: lines(stderr, 'record-plan').some((l) => /D1 c1 attempt 3 edited claims without a compile \(claims-edited\), but plan\.json's build changed: the sha1 of its build-affecting part .* is [0-9a-f]{40}, and the final record's buildSha1 is "[0-9a-f]{40}"; only a recompile changes the build \(D-264, D-266\)/.test(l)) }).toEqual({ what, line: true });
    }
  });

  it("item 1: a record without buildSha1 (from before D-266) is a violation only when a claims-only owner ran", () => {
    const old = copyOf('run-ok');
    editJson(old, 'compile-record.json', (r) => delete r.buildSha1);
    passes(old);
    const claims = claimsOnly();
    editJson(claims, 'compile-record.json', (r) => delete r.buildSha1);
    expect(failing(claims)).toMatch(/\[record-plan\] D1 c1 attempt 3 edited claims without a compile \(claims-edited\), but the final record has no buildSha1 to hold the plan's build to \(D-266\)/);
  });

  it('fails a claims-only owner that compiled: the record is no longer the last D2 gate\'s final compile', () => {
    const measured = claimsOnly();
    editJson(measured, 'compile-record.json', (r) => (r.mode = 'measure-only'));
    expect(failing(measured)).toMatch(/\[record-plan\] D1 c1 attempt 3 edited claims without a compile \(claims-edited\), but compile-record\.json is a "measure-only" record, not the final compile of D2-gate c1 attempt 1/);
    const other = claimsOnly();
    editJson(other, 'compile-record.json', (r) => (r.pobFile.path = 'titan-blood-hunt-2026-10-08-9.xml'));
    expect(failing(other)).toMatch(/\[record-plan\] .*but the final record's PoB file "titan-blood-hunt-2026-10-08-9\.xml" isn't "titan-blood-hunt-2026-10-08-1\.xml", the one D2-gate c1 attempt 1 wrote/);
  });

  it('item 4: after a claims-only round the sources lens always re-checks, even with no finding of its own; another lens that raised nothing may not', () => {
    const dir = claimsOnly();
    editLog(dir, (l) => (l.stages = l.stages.filter((s: Json) => s.stage !== 'V4-sources-recheck')));
    expect(failing(dir)).toMatch(/\[verification\] run-log\.json stages\[\d+\]: the claims-only fix round's re-check before it ran without sources; each lens that raised a finding re-checks it, and the sources lens always re-checks the changed locations \(D-264\)/);
    const extra = claimsOnly();
    editLog(extra, (l) => l.stages.push(step('V4-ledger-recheck', 'c1', 1, 'pass')));
    expect(failing(extra)).toMatch(/\[verification\] .*\(V4-ledger-recheck c1 attempt 1\): re-checks the ledger lens, which raised no finding in the full pass; after a claims-only round only a lens that raised one re-checks, with the sources lens, unless a gate re-ran in the fix round \(D-264\)/);
    // A raising lens that skips its re-check fails too.
    const skipped = claimsOnly();
    editLog(skipped, (l) => (l.stages = l.stages.filter((s: Json) => s.stage !== 'V4-prose-recheck')));
    expect(failing(skipped)).toMatch(/\[verification\] .*the claims-only fix round's re-check before it ran without prose/);
  });

  it('a claims-only owner runs no gate, and only before any gate of its round', () => {
    // A D1 gate after a claims-only D1.
    const gated = copyOf('run-ok');
    d1Verdict(gated, 3, null);
    restage(gated, 15, [step('D1', 'c1', 3, 'claims-edited'), step('D1-gate', 'c1', 3, 'pass'), step('W1', 'c1', 2, 'done'), step('V4-prose-recheck', 'c1', 1, 'fail')]);
    expect(failing(gated)).toMatch(/\[order\] .*\(D1-gate c1 attempt 3\): can't follow D1 c1 attempt 3 \(outcome "claims-edited"\); SKILL\.md's step list allows D2, W1 next/);
    // A claims-only D2 after the D1 gate re-ran: the D1 gate's compile replaced the final record, so D2 runs its gate.
    const late = copyOf('run-ok');
    d1Verdict(late, 3, null);
    restage(late, 15, [step('D1', 'c1', 3, 'done'), step('D1-gate', 'c1', 3, 'pass'), step('D2', 'c1', 2, 'claims-edited'), step('W1', 'c1', 2, 'done')]);
    expect(failing(late)).toMatch(/\[order\] .*\(D2 c1 attempt 2\): edits claims without a compile \(claims-edited\), which an owner does only in the fix round or a revision, before any gate of it re-runs \(D-264\)/);
    // The first D1 of a design is never claims-only.
    const first = copyOf('run-ok');
    editLog(first, (l) => (l.stages[5].outcome = 'claims-edited'));
    expect(failing(first)).toMatch(/\[order\] .*\(D1 c1 attempt 1\): edits claims without a compile/);
  });

  it('passes D1 claims-only, then D2 recompiling: its gate runs the final compile again, and the re-check is full', () => {
    const dir = copyOf('run-ok');
    fs.copyFileSync(path.join(dir, 'reports/gates/D2-gate-c1-a1.json'), path.join(dir, 'reports/gates/D2-gate-c1-a2.json'));
    editJson(dir, 'reports/gates/D2-gate-c1-a2.json', (r) => (r.attempt = 2));
    for (const lens of ['ledger', 'sources']) {
      fs.copyFileSync(path.join(dir, `reports/v4-${lens}.json`), path.join(dir, `reports/v4-${lens}-recheck.json`));
      editJson(dir, `reports/v4-${lens}-recheck.json`, (r) => (r.check = 'recheck'));
    }
    const rechecks = ['ledger', 'sources', 'prose'].map((l) => step(`V4-${l}-recheck`, 'c1', 1, l === 'prose' ? 'fail' : 'pass'));
    restage(dir, 15, [step('D1', 'c1', 3, 'claims-edited'), step('D2', 'c1', 2, 'done'), step('D2-gate', 'c1', 2, 'pass'), step('W1', 'c1', 2, 'done'), ...rechecks]);
    passes(dir);
    // That re-check must be full: a gate re-ran.
    restage(dir, 15, [step('D1', 'c1', 3, 'claims-edited'), step('D2', 'c1', 2, 'done'), step('D2-gate', 'c1', 2, 'pass'), step('W1', 'c1', 2, 'done'), rechecks[1], rechecks[2]]);
    expect(failing(dir)).toMatch(/\[verification\] .*a gate re-ran in the fix round \(an owner recompiled\), so the re-check before it is a full pass of all three lenses/);
  });
});

// ---------------------------------------------------------------------------------------------------
// D-265: the small items the checker holds
// ---------------------------------------------------------------------------------------------------

describe("D-265 (a): a superseded full-pass report is held to the plan it was written against, not the post-fix plan", () => {
  /**
   * Run A's shape (2026-10-08-2): an offline full pass whose sources lens accepted external-unavailable claims,
   * a fix round that re-ran D1 (the plan's claims moved), and a full re-check whose sources report names them at
   * their new locations. The full pass's locations now name other claims.
   */
  const runAShape = () => {
    const dir = copyOf('run-ok');
    d1Verdict(dir, 3, null);
    fs.copyFileSync(path.join(dir, 'reports/gates/D2-gate-c1-a1.json'), path.join(dir, 'reports/gates/D2-gate-c1-a2.json'));
    editJson(dir, 'reports/gates/D2-gate-c1-a2.json', (r) => (r.attempt = 2));
    for (const lens of ['ledger', 'sources']) {
      fs.copyFileSync(path.join(dir, `reports/v4-${lens}.json`), path.join(dir, `reports/v4-${lens}-recheck.json`));
      editJson(dir, `reports/v4-${lens}-recheck.json`, (r) => (r.check = 'recheck'));
    }
    // Written before the fix round: stages[3].claims[5] was the external-unavailable claim; stages[2].claims[0] is a pob-computed one.
    editJson(dir, 'reports/v4-sources.json', (r) => (r.findings[0].location = 'stages[2].claims[0]'));
    restage(dir, 15, [
      step('D1', 'c1', 3, 'done'), step('D1-gate', 'c1', 3, 'pass'), step('D2-gate', 'c1', 2, 'pass'), step('W1', 'c1', 2, 'done'),
      step('V4-ledger-recheck', 'c1', 1, 'pass'), step('V4-sources-recheck', 'c1', 1, 'pass'), step('V4-prose-recheck', 'c1', 1, 'fail'),
    ]);
    return dir;
  };

  it('skips the superseded full pass\'s stale accepted-offline locations, and passes', () => {
    passes(runAShape());
  });

  it('still checks the re-check report, which was written against the current plan', () => {
    const dir = runAShape();
    editJson(dir, 'reports/v4-sources-recheck.json', (r) => (r.findings[0].location = 'stages[2].claims[0]'));
    expect(failing(dir)).toMatch(/\[report-shape\] reports\/v4-sources-recheck\.json: findings\[0\] is accepted-offline, but "plan\.json" "stages\[2\]\.claims\[0\]" names a pob-computed claim/);
  });

  it("item 2: a claims-only round moves no claim, so the full pass's locations still hold and are checked (the review's run-a-d1claims)", () => {
    // run-ok whose sources lens raised a finding too, fixed in a claims-only round (D1 edits in place, then W1);
    // the full pass's accepted-offline location now names a pob-computed claim.
    const make = (owners: Json[]) => {
      const dir = copyOf('run-ok');
      const raised = { id: 'v4-sources-3', artifact: 'guide.md', location: 'guide.md [^g1]', claim: 'Rolling Slam clears.', issue: 'no source', evidence: 'the marker cites nothing on the clear', reader: 'The Rotation line on Rolling Slam has no source.', owner: 'W1', status: 'unresolved' };
      editJson(dir, 'reports/v4-sources.json', (r) => {
        r.findings.push(raised);
        r.verdict = 'fail';
      });
      writeJson(dir, 'reports/v4-sources-recheck.json', { ...readJson(dir, 'reports/v4-sources.json'), check: 'recheck', findings: [{ ...raised, status: 'fixed' }], verdict: 'pass' });
      if (owners.length > 0) editJson(dir, 'plan.json', (p) => (stageB(p).claims[0].text += ' (fixed in place)'));
      editLog(dir, (l) => (l.stages[13].outcome = 'fail'));
      restage(dir, 15, [...owners, step('W1', 'c1', 2, 'done'), step('V4-sources-recheck', 'c1', 1, 'pass'), step('V4-prose-recheck', 'c1', 1, 'fail')]);
      return dir;
    };
    for (const owners of [[step('D1', 'c1', 3, 'claims-edited')], []]) {
      const dir = make(owners);
      passes(dir);
      editJson(dir, 'reports/v4-sources.json', (r) => (r.findings[0].location = 'stages[2].claims[0]'));
      expect({ owners: owners.length, out: failing(dir) }).toEqual({ owners: owners.length, out: expect.stringMatching(/\[report-shape\] reports\/v4-sources\.json: findings\[0\] is accepted-offline, but "plan\.json" "stages\[2\]\.claims\[0\]" names a pob-computed claim/) });
    }
  });
});

describe('D-265 (c): D2 picks every campaign reward choice the campaign passes, the endgame stages carry the picks, and the guide writes them', () => {
  const MEDALLION = 'q.act-2-valley-of-the-titans-medallion';
  const OPTION = 'questAct 2Valley of the TitansMedallion';
  const options = loadReferenceData().resolveFact('campaign/progress.json', `${MEDALLION}.options`);
  const values = (options.ok ? options.fact.value : []) as string[];
  // The plan copies the fact's own tag with the value (D-168).
  const pick = (i: number) => ({ option: OPTION, value: values[i], source: { file: 'campaign/progress.json', key: `${MEDALLION}.options[${i}]` }, tag: options.ok ? options.fact.tag : null });
  const stage = (p: Json, id: string) => p.stages.find((s: Json) => s.id === id);
  /** run-ok whose stage 2 has passed the Medallion, the first reward choice (run-ok's own campaign stops before it). */
  const pastMedallion = (edit: (p: Json) => void = () => undefined) => {
    const dir = copyOf('run-ok');
    editPlan(dir, (p) => {
      stage(p, '2').progress = 'q.act-2-deshar-the-final-letter';
      edit(p);
    });
    return dir;
  };
  /** Every stage at or after the quest, the endgame stages included, lists pick `i`. */
  const pickEverywhere = (i: number) => (p: Json) => ['2', 'm', 'b', 'n'].forEach((id) => stage(p, id).config.scenario.push(pick(i)));
  /** D-283: W1 names the pick by its first line, with no marker. */
  const writePick = (dir: string, i: number) =>
    editText(dir, 'guide.md', replace('## Campaign route and rewards\n', `## Campaign route and rewards\n\n- Act 2, the Medallion: take ${values[i].split('\n')[0]}; my charms carry the flask sustain.\n`));

  it('reads the choices from the C1 data, and run-ok, whose campaign ends before the first one, needs no pick', () => {
    expect(values.length).toBe(2);
    passes(copyOf('run-ok'));
  });

  it('fails a stage past a reward choice the campaign makes that lists no pick', () => {
    expect(failing(pastMedallion())).toMatch(/\[campaign-rewards\] stages 2, m, b, n pass q\.act-2-valley-of-the-titans-medallion, a reward choice the campaign makes, without picking it: list option "questAct 2Valley of the TitansMedallion" with one of the 2 values of data\/campaign\/progress\.json#q\.act-2-valley-of-the-titans-medallion\.options in config\.scenario, on every stage at or after the quest, the endgame stages included \(D-265\)/);
    // "None", PoB's default, is no pick.
    expect(failing(pastMedallion((p) => {
      pickEverywhere(0)(p);
      stage(p, '2').config.scenario.find((o: Json) => o.option === OPTION).value = 'None';
    }))).toMatch(/\[campaign-rewards\] stage 2 passes q\.act-2-valley-of-the-titans-medallion/);
  });

  it("item 3: fails an endgame stage that leaves the campaign's pick at Nothing, or picks it another way (the review's run-endgame-pick)", () => {
    const missing = pastMedallion((p) => {
      pickEverywhere(1)(p);
      stage(p, 'b').config.scenario = stage(p, 'b').config.scenario.filter((o: Json) => o.option !== OPTION);
    });
    writePick(missing, 1);
    expect(failing(missing)).toMatch(/\[campaign-rewards\] stage b passes q\.act-2-valley-of-the-titans-medallion, a reward choice the campaign makes, without picking it/);
    const other = pastMedallion((p) => {
      pickEverywhere(1)(p);
      stage(p, 'b').config.scenario.find((o: Json) => o.option === OPTION).value = values[0];
    });
    writePick(other, 1);
    expect(failing(other)).toMatch(/\[campaign-rewards\] stages 2, m, b, n pick q\.act-2-valley-of-the-titans-medallion's reward 2 different ways; the player picks once, so every stage at or after the quest, the endgame stages included, lists the same pick \(D-265\)/);
  });

  it("fails a pick the guide's Campaign route and rewards doesn't name, and passes once W1 names it by its first line (D-283)", () => {
    const dir = pastMedallion(pickEverywhere(1));
    expect(failing(dir)).toMatch(/\[campaign-rewards\] the plan picks .* for q\.act-2-valley-of-the-titans-medallion, but guide\.md's "Campaign route and rewards" doesn't name it by its first line "30% increased Charm Effect Duration"/);
    // The other option's name is no pick of this one.
    writePick(dir, 0);
    expect(failing(dir)).toMatch(/\[campaign-rewards\] .*doesn't name it by its first line "30% increased Charm Effect Duration"/);
    writePick(dir, 1);
    passes(dir);
  });

  it('fails two campaign stages picking the same choice two ways: the player picks once', () => {
    const dir = pastMedallion((p) => {
      pickEverywhere(1)(p);
      stage(p, '1').progress = MEDALLION;
      stage(p, '1').config.scenario.push(pick(0));
    });
    expect(failing(dir)).toMatch(/\[campaign-rewards\] stages 1, 2, m, b, n pick q\.act-2-valley-of-the-titans-medallion's reward 2 different ways/);
  });
});

describe("D-265 (d), D-276: every unresolved V4 finding carries a reader sentence, which the runner copies into the guide's Known issues as `- <reader>`, its id into audit.md", () => {
  it('fails an unresolved V4 finding without its reader sentence (the report shape)', () => {
    const dir = copyOf('run-ok');
    editJson(dir, 'reports/v4-prose.json', (r) => delete r.findings[0].reader);
    editJson(dir, 'reports/v4-prose-recheck.json', (r) => (r.findings[0].reader = ' '));
    const stderr = failing(dir);
    expect(stderr).toMatch(/\[report-shape\] reports\/v4-prose\.json: findings\[0\] is unresolved and has no reader: one plain sentence the guide's reader can act on \(D-265\)/);
    expect(stderr).toMatch(/\[report-shape\] reports\/v4-prose-recheck\.json: findings\[0\] is unresolved and has no reader/);
  });

  it('passes a fixed finding, and an accepted-offline one, without a reader sentence: neither can become a known issue', () => {
    const dir = copyOf('run-ok');
    expect(readJson(dir, 'reports/v4-sources.json').findings.map((f: Json) => [f.status, 'reader' in f])).toEqual([['accepted-offline', false], ['accepted-offline', false]]);
    editJson(dir, 'reports/v4-prose-recheck.json', (r) => {
      delete r.findings[0].reader;
      r.findings[0].status = 'fixed';
      r.verdict = 'pass';
    });
    noneOpen(dir);
    passes(dir);
  });

  it("matches an open finding's guide line by its reader sentence, word for word, with no id; its id is audit.md's", () => {
    const dir = copyOf('run-ok');
    passes(dir);
    // Without its closing period, it is the same line.
    editText(dir, 'guide.md', replace('so lead packs with Blood Hunt.\n', 'so lead packs with Blood Hunt\n'));
    passes(dir);
    // Paraphrased: not the reader sentence.
    editText(dir, 'guide.md', replace('so lead packs with Blood Hunt\n', 'so open with Blood Hunt\n'));
    const stderr = failing(dir);
    expect(stderr).toMatch(/\[known-issues\] V4 prose finding "v4-prose-1" .* is open after the re-check, but guide\.md's Known issues doesn't list its reader sentence, word for word, as "- The How to play it section is wrong/);
    expect(stderr).toMatch(/\[known-issues\] guide\.md:\d+: Known issues lists "- The How to play it section is wrong .*", which is the sentence of no finding open/);
    // The old jargon form: an id and pipeline words, not the reader sentence.
    const jargon = copyOf('run-ok');
    editText(jargon, 'guide.md', replace(`- ${PROSE_READER}\n`, '- `v4-prose-1` (V4 prose, guide.md How to play it, line 90): names Rolling Slam as the clear skill\n'));
    const out = failing(jargon);
    expect(out).toMatch(/\[guide-markers\] guide\.md:\d+ carries the finding id "v4-prose-1"/);
    expect(out).toMatch(/\[known-issues\] V4 prose finding "v4-prose-1" .* doesn't list its reader sentence/);
  });

  it("item 5: both lists are this cycle's alone: a stale line or row from an earlier cycle fails, and None. only stands with nothing open (the review's run-stale)", () => {
    const stale = copyOf('run-ok');
    editText(stale, 'guide.md', replace('### Known issues\n\n', '### Known issues\n\n- The budget fire hit is wrong: it is about 367, not 735.\n'));
    expect(failing(stale)).toMatch(/\[known-issues\] guide\.md:98: Known issues lists "- The budget fire hit is wrong: it is about 367, not 735\.", which is the sentence of no finding open after this cycle's re-check and of no accepted gate finding; the runner replaces the whole list at step 14 \(D-265\)/);
    const staleRow = copyOf('run-ok');
    editText(staleRow, 'audit.md', replace(AUDIT_KI_HEAD, `${AUDIT_KI_HEAD}| v4-ledger-1 | ledger | — | The budget fire hit is wrong: it is about 367, not 735. |\n`));
    expect(failing(staleRow)).toMatch(/\[known-issues\] audit\.md:\d+: Known issues has a row for "v4-ledger-1" \(ledger\), which is no finding open after this cycle's re-check and no accepted gate finding; the runner replaces the whole table at step 14 \(D-265\)/);
    const none = copyOf('run-ok');
    editText(none, 'guide.md', replace('### Known issues\n\n', '### Known issues\n\nNone.\n'));
    expect(failing(none)).toMatch(/\[known-issues\] guide\.md:98: Known issues says "None\.", but 1 V4 finding\(s\) are open and 0 gate finding\(s\) accepted/);
    // With nothing open, None. is each list.
    const fixed = copyOf('run-ok');
    editJson(fixed, 'reports/v4-prose-recheck.json', (r) => {
      r.findings[0].status = 'fixed';
      r.verdict = 'pass';
    });
    noneOpen(fixed);
    passes(fixed);
  });

  it('logs no known-issues W1: the runner writes the lines, and W1 runs no extra step', () => {
    const dir = copyOf('run-ok');
    editLog(dir, (l) => l.stages.push(step('W1', 'c1', 3, 'known-issues')));
    expect(failing(dir)).toMatch(/\[run-log\] run-log\.json stages\[18\]: outcome "known-issues" isn't one of/);
  });
});
