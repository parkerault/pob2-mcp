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
  { name: "(m) a V3 report's coverage differs from the checker's count", fixture: 'run-ok', edit: (d) => editJson(d, 'reports/v3-c1-p1.json', (r) => (r.coverage.guide += 1)), rule: 'claim-counts', says: /coverage\.guide is 13, but the checker counts 12/ },
  { name: '(m) an endgame pob-data claim is not re-checked (D-179)', fixture: 'run-ok', edit: (d) => editJson(d, 'reports/v4-sources-c1-p1.json', (r) => (r.coverage.recheckedEndgame -= 1)), rule: 'claim-counts', says: /re-checked 2 of 3 endgame pob-data claims; D-179 wants all/ },
  { name: '(m) fewer than 1 in 5 pob-data claims elsewhere are re-checked (D-179)', fixture: 'run-ok', edit: (d) => editJson(d, 'reports/v4-sources-c1-p1.json', (r) => (r.coverage.recheckedOther = 0)), rule: 'claim-counts', says: /re-checked 0 of 6 pob-data claims elsewhere; D-179 wants at least 1 in 5 \(2\)/ },
  // (n)
  { name: '(n) a V4 report misses a §7.4 field', fixture: 'run-ok', edit: (d) => editJson(d, 'reports/v4-prose-c1-p1.json', (r) => delete r.coverage), rule: 'report-shape', says: /v4-prose-c1-p1\.json: has no coverage object/ },
  { name: '(n) a finding misses a §7.4 field', fixture: 'run-ok', edit: (d) => editJson(d, 'reports/v4-sources-c1-p1.json', (r) => delete r.findings[0].evidence), rule: 'report-shape', says: /findings\[0\] has no evidence/ },
  { name: '(n) verdict pass alongside an unresolved finding', fixture: 'run-ok', edit: (d) => editJson(d, 'reports/v4-sources-c1-p1.json', (r) => (r.findings[0].status = 'unresolved')), rule: 'report-shape', says: /says verdict "pass" alongside 1 unresolved finding/ },
  // (o)
  { name: '(o) floor: pass, but the record has MissingColdResist above 0', fixture: 'run-ok', edit: (d) => editJson(d, 'compile-record.json', (r) => (r.stages.b.outputs.MissingColdResist = 5)), rule: 'floor', says: /says floor: "pass", but the records give "fail": .*MissingColdResist is 5/ },
  { name: '(o) MissingChaosResist above 0 and the chaosResistException removed (D-234)', fixture: 'run-ok', edit: (d) => editJson(d, 'plan.json', (p) => delete stageB(p).chaosResistException), rule: 'floor', says: /MissingChaosResist is 47 and it has no chaosResistException/ },
  { name: "(o) the exception's reason is missing from the guide's Checks (D-234)", fixture: 'run-ok', edit: (d) => editText(d, 'guide.md', replace('because no slot can carry chaos resistance', 'because of the')), rule: 'floor', says: /no line of the guide's "Endgame: budget variant" Checks states its full reason .* with the uncapped value 28% \(D-234\)/ },
  { name: "(o) the uncapped chaos value isn't stated with % on the reason's line (D-234)", fixture: 'run-ok', edit: (d) => editText(d, 'guide.md', replace('Chaos resistance stays at 28% (47% under its cap) because', 'Chaos resistance stays uncapped because')), rule: 'floor', says: /states its full reason .* with the uncapped value 28%/ },
  // (o) with D-254's waystone-scaled reference hits (WU-45 review)
  { name: '(o) an endgame stage lacks its waystone-scaled chaos reference hit (D-254)', fixture: 'run-ok', edit: (d) => editJson(d, 'plan.json', (p) => (stageB(p).config.scenario = stageB(p).config.scenario.filter((o: Json) => o.option !== 'enemyChaosDamage'))), rule: 'floor', says: /says floor: "pass", but the records give "fail": stage b has no waystone-scaled Chaos reference hit \(enemyChaosDamage\)/ },
  { name: "(o) a reference hit isn't its ledger entry's value (D-254)", fixture: 'run-ok', edit: (d) => editJson(d, 'compile-record.json', (r) => (r.ledger.hit_b_physical.value = 324.19000244141)), rule: 'floor', says: /stage b's enemyPhysicalDamage 402 isn't its ledger entry hit_b_physical's value 324\.19000244141 \(D-254\)/ },
  // (p)
  { name: '(p) budget: pass, but the prices and rates give over 22 divines', fixture: 'run-ok-online', edit: (d) => editJson(d, 'plan.json', (p) => (p.prices.find((x: Json) => x.id === 'b-weapon').amount = 10)), rule: 'budget', says: /says budget: "pass", but the records give "fail": stage b totals 23\.5 divines, above 22/ },
  { name: '(p) a filled budget slot maps to no prices[] entry', fixture: 'run-ok-online', edit: (d) => editJson(d, 'reports/gates/D1-gate-c1-a1.json', (r) => (r.basis.budget.slots = r.basis.budget.slots.filter((s: Json) => s.slot !== 'Helmet'))), rule: 'budget', says: /filled slot "Helmet" maps to no prices\[\] entry/ },
  { name: '(p) a filled tree jewel maps to no prices[] entry (D-249)', fixture: 'run-ok-online', edit: (d) => editJson(d, 'reports/gates/D1-gate-c1-a1.json', (r) => (r.basis.budget.slots = r.basis.budget.slots.filter((s: Json) => s.jewel === undefined))), rule: 'budget', says: /filled tree jewel in node 1001 maps to no prices\[\] entry/ },
  { name: '(p) an expensive tree jewel tips the budget over 22 divines (D-249)', fixture: 'run-ok-online', edit: (d) => editJson(d, 'plan.json', (p) => (p.prices.find((x: Json) => x.id === 'b-jewel').amount = 200)), rule: 'budget', says: /says budget: "pass", but the records give "fail": stage b totals 23 divines, above 22/ },
  { name: '(p) two slots holding different items share a price entry', fixture: 'run-ok-online', edit: (d) => editJson(d, 'reports/gates/D1-gate-c1-a1.json', (r) => (r.basis.budget.slots.find((s: Json) => s.slot === 'Ring 2').priceId = 'b-ring1')), rule: 'budget', says: /share price entry "b-ring1" but hold different items/ },
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
      // Recorded verbatim, as the report has it, plus its gate (references/run-log.md).
      l.escalations.push({ stage: 'V3', concept: 'c1', attempts: 3, findings: [{ id: 'f-x', artifact: 'guide.md', location: 'Summary', issue: 'untagged claim', gate: 'V3' }], choice: 'accept' });
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

const failing = (dir: string) => {
  const r = runChecker(dir);
  expect(r.code).toBe(1);
  return r.stderr;
};
const gateFile = 'reports/gates/D1-gate-c1-a1.json';
const acceptAtEscalation = (dir: string, finding: Json, listing: string) => {
  editJson(dir, 'run-log.json', (l) => {
    l.escalations.push({ stage: finding.gate, concept: 'c1', attempts: 3, findings: [finding], choice: 'accept' });
  });
  editText(dir, 'guide.md', replace('Blood Loss uptime is a hand calculation.[^g10]\n', `Blood Loss uptime is a hand calculation.[^g10]\n\n### Accepted failures\n\n- ${listing}\n`));
};

describe('FR-W7: the checker trusts the report files, not the run log', () => {
  it("fails the reviewer's probe: an empty stages[], no chaos exception, a utility rolled group, an unresolved V3 finding", () => {
    const dir = copyOf('run-ok');
    editJson(dir, 'run-log.json', (l) => (l.stages = []));
    editJson(dir, 'plan.json', (p) => {
      delete stageB(p).chaosResistException;
      stageB(p).skills.groups[0].role = 'utility';
    });
    editJson(dir, 'reports/v3-c1-p1.json', (r) => {
      r.findings.push({ id: 'f-x', artifact: 'guide.md', location: 'Summary', claim: 'c', issue: 'untagged claim', evidence: 'e', owner: 'W1', status: 'unresolved' });
      r.verdict = 'fail';
    });
    const stderr = failing(dir);
    expect(stderr).toMatch(/\[reports\] reports\/gates\/D1-gate-c1-a1\.json has no run-log stages\[\] entry/);
    expect(stderr).toMatch(/\[floor\] .*MissingChaosResist is 47 and it has no chaosResistException/);
    expect(stderr).toMatch(/\[rolled-skill\] .*rolled group 1 has role "utility"/);
    expect(stderr).toMatch(/\[unresolved\] reports\/v3-c1-p1\.json: finding "f-x"/);
  });

  it('requires a completed run to have its D1 gate report, whatever stages[] says', () => {
    const dir = copyOf('run-ok');
    fs.rmSync(path.join(dir, gateFile));
    editJson(dir, 'run-log.json', (l) => (l.stages = l.stages.filter((s: Json) => s.stage !== 'D1-gate')));
    expect(failing(dir)).toMatch(/\[reports\] no reports\/gates\/D1-gate-<concept>-a<n>\.json; a completed run passed the D1 gate/);
  });

  it('requires the final V3 and V4 reports of a completed run, whatever stages[] says', () => {
    const dir = copyOf('run-ok');
    fs.rmSync(path.join(dir, 'reports/v4-ledger-c1-p1.json'));
    editJson(dir, 'run-log.json', (l) => (l.stages = l.stages.filter((s: Json) => !(s.stage === 'V4' && s.lens === 'ledger'))));
    expect(failing(dir)).toMatch(/\[reports\] no V4 ledger report for c1/);
  });

  it('cross-checks report files against stages[] both ways', () => {
    const dir = copyOf('run-ok');
    editJson(dir, 'run-log.json', (l) => l.stages.push({ stage: 'D1-gate', concept: 'c1', attempt: 2, startedAt: null, endedAt: null, agents: 1, outcome: 'pass', findings: 0 }));
    expect(failing(dir)).toMatch(/\[reports\] run-log stages\[\] has D1-gate c1 attempt 2, but reports\/gates\/D1-gate-c1-a2\.json is missing/);
    const dir2 = copyOf('run-ok');
    editJson(dir2, 'run-log.json', (l) => (l.stages = l.stages.filter((s: Json) => s.stage !== 'V3')));
    expect(failing(dir2)).toMatch(/\[reports\] reports\/v3-c1-p1\.json has no run-log stages\[\] entry V3 c1 pass 1/);
  });
});

describe('§5.3: a completed run fails on any failing gate part an accepted finding does not cover', () => {
  it('fails when the last D1 gate honestly says floor: fail (chaos uncapped, no exception)', () => {
    const dir = copyOf('run-ok');
    editJson(dir, 'plan.json', (p) => delete stageB(p).chaosResistException);
    editJson(dir, gateFile, (r) => {
      r.verdict.floor = 'fail';
      r.findings = [{ part: 'floor', code: 'missing-chaos-resist', stage: 'b', message: 'MissingChaosResist 47, no exception' }];
    });
    const stderr = failing(dir);
    expect(stderr).not.toMatch(/says floor: "fail", but the records/);
    expect(stderr).toMatch(/\[floor\] the guide's concept fails the D1 gate's floor \(missing-chaos-resist, stage b\)/);
    expect(stderr).toMatch(/\[floor\] reports\/gates\/D1-gate-c1-a1\.json says floor: "fail" \(missing-chaos-resist\), and no accepted finding covers it/);
  });

  it('fails when the last D1 gate honestly says budget: fail (over 22 divines)', () => {
    const dir = copyOf('run-ok-online');
    editJson(dir, 'plan.json', (p) => (p.prices.find((x: Json) => x.id === 'b-weapon').amount = 30));
    editJson(dir, gateFile, (r) => {
      r.verdict.budget = 'fail';
      r.basis.budget.totals[0].divines = 43.5;
      r.findings = [{ part: 'budget', code: 'over-budget', stage: 'b', message: 'stage b totals 43.5 divines' }];
    });
    const stderr = failing(dir);
    expect(stderr).not.toMatch(/says budget: "fail", but/);
    expect(stderr).toMatch(/\[budget\] the guide's concept fails the D1 gate's budget \(over-budget, stage b\): stage b totals 43\.5 divines, above 22/);
  });

  it('passes the same run when the user accepted that failure and the guide lists it', () => {
    const dir = copyOf('run-ok-online');
    editJson(dir, 'plan.json', (p) => (p.prices.find((x: Json) => x.id === 'b-weapon').amount = 30));
    const finding = { part: 'budget', code: 'over-budget', stage: 'b', message: 'stage b totals 43.5 divines' };
    editJson(dir, gateFile, (r) => {
      r.verdict.budget = 'fail';
      r.basis.budget.totals[0].divines = 43.5;
      r.findings = [finding];
    });
    acceptAtEscalation(dir, { ...finding, gate: 'D1-gate' }, 'over-budget (D1-gate, stage b): the budget variant costs 43.5 divines.');
    const r = runChecker(dir);
    expect(r.stderr).toBe('');
    expect(r.code).toBe(0);
  });

  it('fails a completed run whose last D2 gate failed V1 with no accepted finding', () => {
    const dir = copyOf('run-ok');
    editJson(dir, 'reports/gates/D2-gate-c1-a1.json', (r) => {
      r.verdict.v1 = 'fail';
      r.findings = [{ part: 'v1', code: 'tree-continuity', stage: '2', message: 'stage 2 drops a node without a respec' }];
    });
    expect(failing(dir)).toMatch(/\[gates\] reports\/gates\/D2-gate-c1-a1\.json says v1: "fail" \(tree-continuity\), and no accepted finding covers it/);
  });
});

describe('§5.4: an accepted finding equals another with the same plan stage, part and code, whichever gate reports it', () => {
  const v1Fail = (code: string) => ({ pass: false, findings: [{ code, message: `${code} (FI-2)` }], notes: [] });

  it('covers the final record V1 finding of the same plan stage, accepted at the D1 gate', () => {
    const dir = copyOf('run-ok');
    editJson(dir, 'compile-record.json', (r) => (r.stages.b.v1 = v1Fail('level-points')));
    acceptAtEscalation(dir, { gate: 'D1-gate', part: 'v1', code: 'level-points', stage: 'b', message: 'stage b spends too many points' }, 'level-points (D1-gate, stage b): accepted.');
    const r = runChecker(dir);
    expect(r.stderr).toBe('');
    expect(r.code).toBe(0);
  });

  it('does not cover the same code on another plan stage', () => {
    const dir = copyOf('run-ok');
    editJson(dir, 'compile-record.json', (r) => {
      r.stages.b.v1 = v1Fail('level-points');
      r.stages.n.v1 = v1Fail('level-points');
    });
    acceptAtEscalation(dir, { gate: 'D1-gate', part: 'v1', code: 'level-points', stage: 'b', message: 'stage b spends too many points' }, 'level-points (D1-gate, stage b): accepted.');
    const stderr = failing(dir);
    expect(stderr).toMatch(/\[record-verdicts\] the final record's stage n fails V1: level-points/);
    expect(stderr).not.toMatch(/stage b fails V1/);
  });

  it('requires the guide to list the accepted finding with its gate on one line', () => {
    const dir = copyOf('run-ok');
    editJson(dir, 'compile-record.json', (r) => (r.stages.b.v1 = v1Fail('level-points')));
    acceptAtEscalation(dir, { gate: 'D1-gate', part: 'v1', code: 'level-points', stage: 'b', message: 'm' }, 'level-points: accepted.');
    expect(failing(dir)).toMatch(/\[unresolved\] guide\.md's Accepted failures has no line naming accepted finding level-points with its gate D1-gate/);
  });
});

describe('D-219 and D-249: budget totals and tree jewels', () => {
  it('rounds the total to 2 decimals before comparing it with 22', () => {
    const dir = copyOf('run-ok-online');
    editJson(dir, 'plan.json', (p) => (p.prices.find((x: Json) => x.id === 'b-jewel').amount = 100.4));
    editJson(dir, gateFile, (r) => (r.basis.budget.totals[0].divines = 22));
    const r = runChecker(dir);
    expect(r.stderr).toBe('');
    expect(r.code).toBe(0);
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

describe('§6: retries are keyed by (stage, concept, round, researcher) (WU-44)', () => {
  const withRetries = (retries: Json[]) => {
    const dir = copyOf('run-ok');
    editJson(dir, 'run-log.json', (l) => (l.retries = retries));
    return runChecker(dir);
  };

  it("passes two rounds' assembly retries and two researchers' R1a retries, each within the cap", () => {
    const r = withRetries([
      { stage: 'R1a', concept: null, round: 1, researcher: 1, count: 2 },
      { stage: 'R1a', concept: null, round: 1, researcher: 3, count: 1 },
      { stage: 'R1b-assemble', concept: null, round: 1, count: 2 },
      { stage: 'R1b-assemble', concept: null, round: 2, count: 2 },
      { stage: 'D1', concept: 'c1', count: 2 },
    ]);
    expect(r.stderr).toBe('');
    expect(r.code).toBe(0);
  });

  it('fails an unmerged key: the same (stage, concept, round, researcher) twice', () => {
    const r = withRetries([
      { stage: 'R1b-assemble', concept: null, round: 1, count: 1 },
      { stage: 'R1b-assemble', concept: null, round: 1, count: 2 },
    ]);
    expect(r.code).toBe(1);
    expect(r.stderr).toMatch(/check-run: \[run-log\] run-log\.json retries\[1\]: repeats the key \(stage, concept, round, researcher\) \["R1b-assemble",null,1,null\] of retries\[0\]/);
  });

  it('fails a round or researcher that is not an integer from 1, and names the round in a cap breach', () => {
    const r = withRetries([{ stage: 'R1a', concept: null, round: 0, researcher: 'two', count: 3 }]);
    expect(r.code).toBe(1);
    expect(r.stderr).toMatch(/retries\[0\]: round is 0; an integer from 1/);
    expect(r.stderr).toMatch(/retries\[0\]: researcher is "two"; an integer from 1/);
    expect(r.stderr).toMatch(/check-run: \[caps\] retries\[0\]: R1a round 0 researcher two has 3 retries/);
  });
});

// ---------------------------------------------------------------------------------------------------
// WU-46 review fixes: V3/V4 finding equality (§5.4), accepted-offline (C-30, §7.4), opened offline and
// D-255 (rule (l) under --partial for a run that ended escalated or stopped)
// ---------------------------------------------------------------------------------------------------

describe('§5.4: an accepted V3/V4 finding covers only the same finding (same report, id, artifact and location)', () => {
  const accepted = { gate: 'V4', id: 'v4-ledger-1', artifact: 'plan.json', location: 'ledger[3] (hit_b_fire)', claim: 'x', issue: 'i', evidence: 'e', owner: 'D1', status: 'unresolved' };
  const withLedgerFinding = (dir: string, finding: Json) => {
    editJson(dir, 'reports/v4-ledger-c1-p1.json', (r) => {
      r.findings.push(finding);
      r.verdict = 'fail';
    });
    acceptAtEscalation(dir, accepted, 'v4-ledger-1 (V4): the fire hit, accepted at an escalation.');
  };

  it('covers the accepted finding itself', () => {
    const dir = copyOf('run-ok');
    withLedgerFinding(dir, { ...accepted, gate: undefined });
    const r = runChecker(dir);
    expect(r.stderr).toBe('');
    expect(r.code).toBe(0);
  });

  it("doesn't cover another issue reported under the accepted id (the reviewer's probe)", () => {
    const dir = copyOf('run-ok');
    withLedgerFinding(dir, { id: 'v4-ledger-1', artifact: 'guide.md', location: 'Summary, line 4', claim: 'the guide says 5,000 DPS', issue: 'differs from the record', evidence: 'e', owner: 'W1', status: 'unresolved' });
    expect(failing(dir)).toMatch(/\[unresolved\] reports\/v4-ledger-c1-p1\.json: finding "v4-ledger-1"/);
  });

  it('compares a line location by its section, so a regenerated guide keeps an accepted guide finding covered', () => {
    const dir = copyOf('run-ok');
    const guideFinding = { gate: 'V4', id: 'v4-ledger-2', artifact: 'guide.md', location: 'How it works, line 30', claim: 'x', issue: 'i', evidence: 'e', owner: 'W1', status: 'unresolved' };
    editJson(dir, 'reports/v4-ledger-c1-p1.json', (r) => {
      r.findings.push({ ...guideFinding, gate: undefined, location: 'How it works, line 34' });
      r.verdict = 'fail';
    });
    acceptAtEscalation(dir, guideFinding, 'v4-ledger-2 (V4): a guide number, accepted at an escalation.');
    expect(runChecker(dir).code).toBe(0);
    editJson(dir, 'reports/v4-ledger-c1-p1.json', (r) => (r.findings[0].location = 'Rotation, line 34'));
    expect(failing(dir)).toMatch(/\[unresolved\] .*"v4-ledger-2"/);
  });

  it('requires an escalation to record a V3/V4 finding with its artifact and location', () => {
    const dir = copyOf('run-ok');
    editJson(dir, 'run-log.json', (l) => l.escalations.push({ stage: 'V4', concept: 'c1', attempts: 3, findings: [{ id: 'v4-ledger-1', gate: 'V4' }], choice: 'accept' }));
    expect(failing(dir)).toMatch(/\[run-log\] .*escalations\[0\]\.findings\[0\]: is a V3\/V4 finding without its artifact and location/);
  });
});

describe('C-30, §7.4: accepted-offline is only the sources lens\'s word on a claim tagged external-unavailable', () => {
  it('fails a V3 report or another lens marking a finding accepted-offline', () => {
    for (const file of ['reports/v3-c1-p1.json', 'reports/v4-prose-c1-p1.json']) {
      const dir = copyOf('run-ok');
      editJson(dir, file, (r) => r.findings.push({ id: 'x-1', artifact: 'guide.md', location: 'guide.md [^g9]', claim: 'c', issue: 'tagged external-unavailable', evidence: 'offline', owner: 'W1', status: 'accepted-offline' }));
      expect(failing(dir)).toMatch(/\[report-shape\] .*accepted-offline in a (V3|prose lens) report; only the V4 sources lens/);
    }
  });

  it('fails a sources finding accepted-offline whose location names no external-unavailable claim', () => {
    for (const [location, why] of [
      ['guide.md [^g1]', /names a [a-z-]+ claim/],
      ['Summary, line 3', /names no claim/],
    ] as const) {
      const dir = copyOf('run-ok');
      editJson(dir, 'reports/v4-sources-c1-p1.json', (r) => (r.findings[1].location = location));
      const stderr = failing(dir);
      expect(stderr).toMatch(/\[report-shape\] reports\/v4-sources-c1-p1\.json: findings\[1\] is accepted-offline/);
      expect(stderr).toMatch(why);
    }
  });
});

describe('V4 opens no source offline, every one online (D-179, D-201)', () => {
  it('fails an offline sources report that says it opened a source', () => {
    const dir = copyOf('run-ok');
    editJson(dir, 'reports/v4-sources-c1-p1.json', (r) => (r.coverage.opened = 1));
    expect(failing(dir)).toMatch(/\[claim-counts\] .*opened 1 sources in an offline run; offline V4 opens none/);
  });

  it('fails an online sources report that opened fewer sources than there are external claims', () => {
    const dir = copyOf('run-ok-online');
    editJson(dir, 'reports/v4-sources-c1-p1.json', (r) => (r.coverage.opened = 1));
    expect(failing(dir)).toMatch(/\[claim-counts\] .*opened 1 of 2 external claims/);
  });
});

describe('D-255: rule (l) under --partial, for a run that ended escalated or stopped', () => {
  const unresolved = { id: 'v3-7', artifact: 'guide.md', location: 'Summary, line 9', claim: 'c', issue: 'untagged claim', evidence: 'no marker', owner: 'W1', status: 'unresolved' };
  const ended = (dir: string, status: string, record: boolean) => {
    editJson(dir, 'reports/v3-c1-p1.json', (r) => {
      r.findings.push(unresolved);
      r.verdict = 'fail';
    });
    editJson(dir, 'run-log.json', (l) => {
      l.status = status;
      if (record) l.escalations.push({ stage: 'V3', concept: 'c1', attempts: 3, findings: [{ ...unresolved, gate: 'V3' }], choice: status === 'stopped' ? 'checkpoint-1' : 'stop' });
    });
  };

  it.each(['escalated', 'stopped'])('passes a %s run whose escalation recorded the unresolved finding', (status) => {
    const dir = copyOf('run-ok');
    ended(dir, status, true);
    const r = runChecker(dir, '--partial');
    expect(r.stderr).toBe('');
    expect(r.code).toBe(0);
  });

  it('still fails it when no escalation recorded the finding, or when the run is completed', () => {
    const unrecorded = copyOf('run-ok');
    ended(unrecorded, 'escalated', false);
    expect(runChecker(unrecorded, '--partial').stderr).toMatch(/\[unresolved\] reports\/v3-c1-p1\.json: finding "v3-7"/);
    const done = copyOf('run-ok');
    ended(done, 'completed', true);
    expect(failing(done)).toMatch(/\[unresolved\] reports\/v3-c1-p1\.json: finding "v3-7"/);
  });
});
