/**
 * AC-W2 (WU-43): the run checker `.claude/skills/build-guide/scripts/check-run.mjs` (slice 03 FR-W7),
 * spawned as a real process with an explicit env. It passes the fixture runs in `tests/fixtures/pipeline/`
 * and fails each broken copy, naming the broken rule on stderr; `--partial` passes a run that ended early.
 */
import { describe, it, expect, afterAll } from '@jest/globals';
import { spawnSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { validatePlan } from '../../src/plan/schema';
import { loadReferenceData } from '../../src/plan/referenceData';

const REPO = path.resolve(__dirname, '..', '..');
const CHECKER = path.join(REPO, '.claude', 'skills', 'build-guide', 'scripts', 'check-run.mjs');
const FIXTURES = path.join(REPO, 'tests', 'fixtures', 'pipeline');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'check-run-'));

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
function copyOf(fixture: string): string {
  const dir = path.join(TMP, `${fixture}-${++copies}`);
  fs.cpSync(path.join(FIXTURES, fixture), dir, { recursive: true });
  return dir;
}
type Json = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
function editJson(dir: string, rel: string, edit: (v: Json) => void): void {
  const p = path.join(dir, rel);
  const v = JSON.parse(fs.readFileSync(p, 'utf8')) as Json;
  edit(v);
  fs.writeFileSync(p, JSON.stringify(v, null, 2));
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
const stageB = (plan: Json) => plan.stages.find((s: Json) => s.id === 'b');

describe('AC-W2: the passing fixtures', () => {
  it.each(['run-ok', 'run-ok-online'])('exits 0 on %s', (fixture) => {
    const r = runChecker(path.join(FIXTURES, fixture));
    expect(r.stderr).toBe('');
    expect(r.code).toBe(0);
    expect(r.stdout).toMatch(/^check-run: ok: /);
  });

  it('run-ok is an offline run with an endgame stage whose chaos resistance stays uncapped by its exception, stated in the guide (D-234)', () => {
    const log = JSON.parse(fs.readFileSync(path.join(FIXTURES, 'run-ok', 'run-log.json'), 'utf8'));
    const plan = JSON.parse(fs.readFileSync(path.join(FIXTURES, 'run-ok', 'plan.json'), 'utf8'));
    const record = JSON.parse(fs.readFileSync(path.join(FIXTURES, 'run-ok', 'compile-record.json'), 'utf8'));
    const guide = fs.readFileSync(path.join(FIXTURES, 'run-ok', 'guide.md'), 'utf8');
    expect(log.mode).toBe('offline');
    const b = stageB(plan);
    expect(b.variant).toBe('budget');
    expect(record.stages.b.outputs.MissingChaosResist).toBeGreaterThan(0);
    expect(guide).toContain(b.chaosResistException.reason);
  });

  it('run-ok-online is an online run with ok prices totalling over 20 and at most 22 divines, and the near-the-ceiling note (D-219)', () => {
    const plan = JSON.parse(fs.readFileSync(path.join(FIXTURES, 'run-ok-online', 'plan.json'), 'utf8'));
    const gate = JSON.parse(fs.readFileSync(path.join(FIXTURES, 'run-ok-online', 'reports', 'gates', 'D1-gate-c1-a1.json'), 'utf8'));
    const guide = fs.readFileSync(path.join(FIXTURES, 'run-ok-online', 'guide.md'), 'utf8');
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
  });

  it('every fixture plan is a valid plan under the real schema and C1/E1 data (C-31)', () => {
    const ref = loadReferenceData();
    const plans: string[] = [];
    for (const run of ['run-ok', 'run-ok-online', 'run-escalated']) {
      plans.push(path.join(FIXTURES, run, 'plan.json'));
      for (const c of fs.readdirSync(path.join(FIXTURES, run, 'concepts'))) plans.push(path.join(FIXTURES, run, 'concepts', c, 'plan.json'));
    }
    for (const p of plans) {
      const result = validatePlan(fs.readFileSync(p, 'utf8'), ref);
      expect({ plan: path.relative(FIXTURES, p), errors: result.ok ? [] : result.errors }).toEqual({ plan: path.relative(FIXTURES, p), errors: [] });
    }
  });
});

interface BrokenCase {
  name: string;
  fixture: 'run-ok' | 'run-ok-online';
  edit: (dir: string) => void;
  rule: string;
  says: RegExp;
}

const broken: BrokenCase[] = [
  // (a)
  { name: '(a) guide.md is missing', fixture: 'run-ok', edit: (d) => fs.rmSync(path.join(d, 'guide.md')), rule: 'layout', says: /guide\.md is missing/ },
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
  { name: "(h) the guide's import code differs from the record's", fixture: 'run-ok', edit: (d) => editText(d, 'guide.md', replace('FixtureImportCode-0001\n```', 'FixtureImportCode-0002\n```')), rule: 'import-code', says: /import code differs from compile-record\.json's importCode/ },
  // (i)
  { name: '(i) a required run-log field is missing', fixture: 'run-ok', edit: (d) => editJson(d, 'run-log.json', (l) => delete l.pricing), rule: 'run-log', says: /run-log\.json has no pricing/ },
  // (j)
  {
    name: '(j) 4 concepts compiled in one research round',
    fixture: 'run-ok',
    edit: (d) => editJson(d, 'run-log.json', (l) => {
      l.rounds[0].conceptsCompiled = 4;
      l.conceptsCompiled = 4;
    }),
    rule: 'caps',
    says: /compiled 4 concepts; at most 3 per research round/,
  },
  { name: '(j) a V4 pass with 4 lenses', fixture: 'run-ok', edit: (d) => editJson(d, 'run-log.json', (l) => (l.v4Passes[0].lenses = 4)), rule: 'caps', says: /ran 4 lenses; at most 3 per pass/ },
  { name: '(j) a (stage, concept) with 3 retries', fixture: 'run-ok', edit: (d) => editJson(d, 'run-log.json', (l) => (l.retries = [{ stage: 'D1', concept: 'c1', count: 3 }])), rule: 'caps', says: /has 3 retries; at most 2 per stage/ },
  { name: '(j) maxConcurrent 4', fixture: 'run-ok', edit: (d) => editJson(d, 'run-log.json', (l) => (l.agents.maxConcurrent = 4)), rule: 'caps', says: /maxConcurrent is 4; fan-out is at most 3/ },
  // (k)
  {
    name: '(k) an offline run has a prices[] status ok',
    fixture: 'run-ok',
    edit: (d) => editJson(d, 'plan.json', (p) => {
      Object.assign(p.prices[0], { status: 'ok', amount: 1, currency: 'divine' });
      delete p.prices[0].note;
    }),
    rule: 'offline-prices',
    says: /price "b-weapon" is "ok"/,
  },
  {
    name: '(k) an offline run has a price call',
    fixture: 'run-ok',
    edit: (d) => editJson(d, 'run-log.json', (l) => {
      l.pricing.calls = [{ at: '2026-10-08T10:20:00Z', stage: 'D1', tool: 'get_item_price', item: 'budget Helmet', outcome: 'ok' }];
      l.pricing.totals.calls = 1;
      l.pricing.totals.ok = 1;
    }),
    rule: 'offline-prices',
    says: /an offline run made 1 price call/,
  },
  // (l)
  {
    name: '(l) a final-pass V3 report has an unresolved finding',
    fixture: 'run-ok',
    edit: (d) => editJson(d, 'reports/v3-c1-p1.json', (r) => {
      r.findings.push({ id: 'f-x', artifact: 'guide.md', location: 'Summary', claim: 'Blood Hunt bursts rares', issue: 'untagged claim', evidence: 'no marker', owner: 'W1', status: 'unresolved' });
      r.verdict = 'fail';
    }),
    rule: 'unresolved',
    says: /finding "f-x" .*is unresolved in the final pass/,
  },
  // (m)
  { name: "(m) a V3 report's coverage differs from the checker's count", fixture: 'run-ok', edit: (d) => editJson(d, 'reports/v3-c1-p1.json', (r) => (r.coverage.guide += 1)), rule: 'claim-counts', says: /coverage\.guide is 11, but the checker counts 10/ },
  { name: '(m) an endgame pob-data claim is not re-checked (D-179)', fixture: 'run-ok', edit: (d) => editJson(d, 'reports/v4-sources-c1-p1.json', (r) => (r.coverage.recheckedEndgame -= 1)), rule: 'claim-counts', says: /re-checked 2 of 3 endgame pob-data claims; D-179 wants all/ },
  { name: '(m) fewer than 1 in 5 pob-data claims elsewhere are re-checked (D-179)', fixture: 'run-ok', edit: (d) => editJson(d, 'reports/v4-sources-c1-p1.json', (r) => (r.coverage.recheckedOther = 0)), rule: 'claim-counts', says: /re-checked 0 of 6 pob-data claims elsewhere; D-179 wants at least 1 in 5 \(2\)/ },
  // (n)
  { name: '(n) a V4 report misses a §7.4 field', fixture: 'run-ok', edit: (d) => editJson(d, 'reports/v4-prose-c1-p1.json', (r) => delete r.coverage), rule: 'report-shape', says: /v4-prose-c1-p1\.json: has no coverage object/ },
  { name: '(n) a finding misses a §7.4 field', fixture: 'run-ok', edit: (d) => editJson(d, 'reports/v4-sources-c1-p1.json', (r) => delete r.findings[0].evidence), rule: 'report-shape', says: /findings\[0\] has no evidence/ },
  { name: '(n) verdict pass alongside an unresolved finding', fixture: 'run-ok', edit: (d) => editJson(d, 'reports/v4-sources-c1-p1.json', (r) => (r.findings[0].status = 'unresolved')), rule: 'report-shape', says: /says verdict "pass" alongside 1 unresolved finding/ },
  // (o)
  { name: '(o) floor: pass, but the record has MissingColdResist above 0', fixture: 'run-ok', edit: (d) => editJson(d, 'compile-record.json', (r) => (r.stages.b.outputs.MissingColdResist = 5)), rule: 'floor', says: /says floor: "pass", but the records give "fail": .*MissingColdResist is 5/ },
  { name: '(o) MissingChaosResist above 0 and the chaosResistException removed (D-234)', fixture: 'run-ok', edit: (d) => editJson(d, 'plan.json', (p) => delete stageB(p).chaosResistException), rule: 'floor', says: /MissingChaosResist is 47 and it has no chaosResistException/ },
  { name: "(o) the exception's reason is missing from the guide's Checks (D-234)", fixture: 'run-ok', edit: (d) => editText(d, 'guide.md', replace('because no slot can carry chaos resistance', 'because of the')), rule: 'floor', says: /Checks don't state the reason/ },
  // (p)
  { name: '(p) budget: pass, but the prices and rates give over 22 divines', fixture: 'run-ok-online', edit: (d) => editJson(d, 'plan.json', (p) => (p.prices.find((x: Json) => x.id === 'b-weapon').amount = 10)), rule: 'budget', says: /says budget: "pass", but the records give "fail": stage b totals 23 divines, above 22/ },
  { name: '(p) a filled budget slot maps to no prices[] entry', fixture: 'run-ok-online', edit: (d) => editJson(d, 'reports/gates/D1-gate-c1-a1.json', (r) => (r.basis.budget.slots = r.basis.budget.slots.filter((s: Json) => s.slot !== 'Helmet'))), rule: 'budget', says: /filled slot "Helmet" maps to no prices\[\] entry/ },
  { name: '(p) over 20 divines and the guide lacks "near the ceiling"', fixture: 'run-ok-online', edit: (d) => editText(d, 'guide.md', replace('against 20, near the ceiling:', 'against 20:')), rule: 'budget', says: /lack "near the ceiling"/ },
  // (q)
  { name: '(q) rolledSkill: pass, but a same-role group has a larger figure', fixture: 'run-ok', edit: (d) => editJson(d, 'compile-record.json', (r) => (r.stages.b.skillOutputs.g2s1p1.fields.TotalDPS = 60000)), rule: 'rolled-skill', says: /says rolledSkill: "pass", but the records give "fail": stage b's group 2 \(clear\) has 60000, more than the rolled group 1's 50000/ },
  { name: "(q) the rolled group's role is utility", fixture: 'run-ok', edit: (d) => editJson(d, 'plan.json', (p) => (stageB(p).skills.groups[0].role = 'utility')), rule: 'rolled-skill', says: /rolled group 1 has role "utility"/ },
];

describe('AC-W2: each broken copy exits non-zero, naming the broken rule', () => {
  it.each(broken.map((c) => [c.name, c] as const))('%s', (_name, c) => {
    const dir = copyOf(c.fixture);
    c.edit(dir);
    const r = runChecker(dir);
    expect(r.code).toBe(1);
    const lines = r.stderr.split('\n').filter((l) => l.startsWith(`check-run: [${c.rule}] `));
    expect({ stderr: r.stderr, matched: lines.some((l) => c.says.test(l)) }).toEqual({ stderr: r.stderr, matched: true });
  });
});

describe("AC-W2 (l): a finding the user accepted at an escalation, listed under the guide's Accepted failures", () => {
  const acceptFx = (dir: string, listInGuide: boolean) => {
    editJson(dir, 'reports/v3-c1-p1.json', (r) => {
      r.findings.push({ id: 'f-x', artifact: 'guide.md', location: 'Summary', claim: 'Blood Hunt bursts rares', issue: 'untagged claim', evidence: 'no marker', owner: 'W1', status: 'unresolved' });
      r.verdict = 'fail';
    });
    editJson(dir, 'run-log.json', (l) => {
      l.escalations.push({ stage: 'V3', concept: 'c1', attempts: 3, findings: [{ id: 'f-x', stage: 'V3', message: 'untagged claim' }], choice: 'accept' });
    });
    if (listInGuide) {
      editText(dir, 'guide.md', replace('Blood Loss uptime is a hand calculation.[^g10]\n', 'Blood Loss uptime is a hand calculation.[^g10]\n\n### Accepted failures\n\n- f-x (V3): an untagged claim in the Summary, accepted at an escalation.\n'));
    }
  };

  it('passes when the escalation accepted it and the guide lists it', () => {
    const dir = copyOf('run-ok');
    acceptFx(dir, true);
    const r = runChecker(dir);
    expect(r.stderr).toBe('');
    expect(r.code).toBe(0);
  });

  it('fails when the guide has no Accepted failures H3 listing it', () => {
    const dir = copyOf('run-ok');
    acceptFx(dir, false);
    const r = runChecker(dir);
    expect(r.code).toBe(1);
    expect(r.stderr).toMatch(/check-run: \[unresolved\] the user accepted 1 finding\(s\) at an escalation, but guide\.md has no "Accepted failures" H3/);
  });
});

describe('AC-W2: --partial', () => {
  it('passes run-escalated with --partial', () => {
    const r = runChecker(path.join(FIXTURES, 'run-escalated'), '--partial');
    expect(r.stderr).toBe('');
    expect(r.code).toBe(0);
    expect(r.stdout).toMatch(/\(partial\)/);
  });

  it('fails run-escalated without --partial, naming its status', () => {
    const r = runChecker(path.join(FIXTURES, 'run-escalated'));
    expect(r.code).toBe(1);
    expect(r.stderr).toMatch(/check-run: \[status\] status is "escalated"; without --partial only a completed run passes/);
  });

  it('still checks what a partial run produced', () => {
    const dir = copyOf('run-ok');
    editJson(dir, 'run-log.json', (l) => (l.status = 'stopped'));
    expect(runChecker(dir, '--partial').code).toBe(0);
    editText(dir, 'guide.md', replace('## Rotation\n', ''));
    const r = runChecker(dir, '--partial');
    expect(r.code).toBe(1);
    expect(r.stderr).toMatch(/\[guide-sections\]/);
  });

  it('refuses a call without a run folder (usage)', () => {
    const r = runChecker('--partial');
    expect(r.code).toBe(2);
    expect(r.stderr).toMatch(/usage: node check-run\.mjs <runFolder> \[--partial\]/);
  });
});
