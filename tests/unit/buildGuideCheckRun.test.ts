/**
 * AC-W2 (WU-43, as amendments 1 to 4 change it): the run checker
 * `.claude/skills/build-guide/scripts/check-run.mjs`, spawned as a real process with an explicit env. It passes
 * the fixture runs in `tests/fixtures/pipeline/` (run-ok, run-ok-online and run-escalated, schema-3 runs of the
 * amended pipeline, and run-ok-v2, a schema-2 log kept so recorded runs still check, D-326, D-341), with no
 * `--partial`, and fails each broken copy, naming the broken rule on stderr.
 *
 * - The artifacts: the layout (the cards, the deck, the probes and the round copies among it, D-338, A-34), the
 *   markers, the guide, the D1 gate recomputed (Q3) with each figure × its Count (D-340), and §4.2's checks: (r)
 *   the record is of the plan, (s) the PoB file is the import code's, with one loadout per stage, (t) the ledger,
 *   the plan's current formulas evaluated with the server's compiled evaluator (D-365), (u) the named source's
 *   figure's stat set is `skills.main.statSet` (S7), and (l) every finding open in the last V4 report is a known
 *   issue (D-352).
 * - The control flow, from the run log (schema 3, D-289): the invariants that stand in for the deleted workflow
 *   harness tests (the accepted cost of S1), each with a violating copy: steps in a legal order and each gate's
 *   answer followed (D-287), the design gate between the D1 gate and D2 (D-362); the caps (per brainstorm and
 *   verification round, R1b at most 3 counted attempts and none after a terminal not-a-skill or wrong-ascendancy
 *   failure (D-334, D-342), each gate at most 2 counted retries, S6 honoured); one full V4 pass per guide and at
 *   most one re-check per fix round or revision (D-352); escalations only from the gates; the rule on pre-supplied
 *   and default answers.
 * - Amendment 2's guards (WU-62, D-276…D-283): the reader layer's 14 H2s (b), the 3,000-word cap (v), no
 *   marker, confidence label or finding id in guide.md (w), one fixed-form verdict line per endgame rung
 *   matched to the record (x), the entering-maps rung's floor and 5-divine budget (y), audit.md's H2s (z),
 *   Known issues by sentence with the ids in audit.md (l), and reward picks by name.
 * - Amendment 3's (WU-58, D-287, D-289, D-294, D-326, D-338): (aa) the schema version and the roll null until the
 *   verification pick; (bb) the caps per brainstorm and verification round; (cc) the escalation answer
 *   `verification`; (dd) the verdict line's Effective HP; (ee) the D1 gate's figure × Count; (ff) the cards, the
 *   deck and the probes in the layout, with each card's probe count in the log.
 * - Amendment 4's (WU-71, AC-W54, AC-W55, AC-W59, AC-W60): V4's numbered reports and the re-check of what
 *   `--changed` lists; claim kinds; audit.md and the Checks blocks as `render-audit.mjs` renders them; the survival
 *   label from `measures.arbiter`; the reference hits the compiler wrote; a ledger-only edit after the final
 *   compile; the design gate; the dossier's table.
 *
 * Checks (t), the render and `--changed` load the server's compiled `build/plan/`: `mise run test` builds first.
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
import { writeGuideRun, editJson as editRunJson } from '../helpers/guideRunFolder';

const REPO = path.resolve(__dirname, '..', '..');
const CHECKER = path.join(REPO, '.claude', 'skills', 'build-guide', 'scripts', 'check-run.mjs');
const RENDER = path.join(REPO, '.claude', 'skills', 'build-guide', 'scripts', 'render-audit.mjs');
const FIXTURES = path.join(REPO, 'tests', 'fixtures', 'pipeline');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'check-run-'));
/** The schema-3 runs of the amended pipeline. */
const RUNS = ['run-ok', 'run-ok-online', 'run-escalated'] as const;
/** D-326: a schema-2 run, kept only so recorded runs still check. */
const V2 = 'run-ok-v2';
type Fixture = (typeof RUNS)[number] | typeof V2;

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
function copyOf(fixture: Fixture): string {
  const dir = path.join(TMP, `${fixture}-${++copies}`);
  fs.cpSync(path.join(FIXTURES, fixture), dir, { recursive: true });
  return dir;
}
type Json = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
const readJson = (dir: string, rel: string): Json => JSON.parse(fs.readFileSync(path.join(dir, rel), 'utf8')) as Json;
const writeJson = (dir: string, rel: string, v: Json) => {
  fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
  fs.writeFileSync(path.join(dir, rel), `${JSON.stringify(v, null, 2)}\n`);
};
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
/** The gate visits that print a display first, which run-log.mjs records in displays[] (D-367). */
const DISPLAYED = ['brainstorm', 'verification', 'design', 'final', 'escalation'];
/**
 * Edits run-log.json, keeping a schema-3 log's displays[] in step with its checkpoints[], as run-log.mjs writes
 * them: each gate visit's display before its answer (D-367). The display rule's own test edits the log with editJson.
 */
const editLog = (dir: string, edit: (l: Json) => void) => editJson(dir, 'run-log.json', (l) => {
  edit(l);
  if (l.schemaVersion === 3 && Array.isArray(l.checkpoints)) {
    l.displays = (l.checkpoints as Json[]).filter((c) => DISPLAYED.includes(c?.checkpoint)).map((c) => ({ checkpoint: c.checkpoint, visit: c.visit }));
  }
});
/** The round copies a fixture holds (A-34): run-ok and run-ok-v2 have rounds/1/, the copy before their fix round. */
const roundsOf = (dir: string) => (fs.existsSync(path.join(dir, 'rounds')) ? fs.readdirSync(path.join(dir, 'rounds')).map((n) => `rounds/${n}`) : []);
/**
 * Edits guide.md as it stood all along: the round copies' guides too, so the edit is no change since a round copy
 * that a re-check missed (D-352). An edit that doesn't apply to a copy (a Known issues line, step 14's) leaves it.
 */
function editGuide(dir: string, edit: (t: string) => string): void {
  editText(dir, 'guide.md', edit);
  for (const r of roundsOf(dir)) {
    const p = path.join(dir, r, 'guide.md');
    try {
      fs.writeFileSync(p, edit(fs.readFileSync(p, 'utf8')));
    } catch {
      // the copy predates the edited text
    }
  }
}
/** Edits plan.json as it stood all along (`editPlan`), the round copies' plans too. */
function editPlanAll(dir: string, edit: (p: Json) => void): void {
  editPlan(dir, edit);
  for (const r of roundsOf(dir)) editJson(dir, `${r}/plan.json`, edit);
}
/**
 * Re-renders audit.md as the runner does (render-audit.mjs, D-355), keeping its Known issues, and copies each rung's
 * Checks block from the render into the guide, as W1 does: after a test changed what the render reads. With `all`,
 * the round copies' guides take the blocks too, as if the change had been there all along.
 */
function rerender(dir: string, all = false): void {
  const r = spawnSync(process.execPath, [RENDER, dir], { env: { PATH: '/usr/bin:/bin', LANG: 'C' }, encoding: 'utf8', timeout: 30000 });
  if (r.status !== 0) throw new Error(`render-audit.mjs failed: ${r.stderr}`);
  const audit = fs.readFileSync(path.join(dir, 'audit.md'), 'utf8').split('\n');
  const checksAt = audit.indexOf('## Checks');
  const checksEnd = audit.findIndex((l, i) => i > checksAt && l.startsWith('## '));
  const blocks: string[][] = [];
  for (let i = checksAt + 1; i < checksEnd; i += 1) {
    if (audit[i].startsWith('### ')) blocks.push([]);
    else if (blocks.length > 0 && audit[i].trim() !== '') blocks[blocks.length - 1].push(audit[i]);
  }
  const plan = readJson(dir, 'plan.json');
  const rungs = ['entering-maps', 'budget', 'non-budget'].filter((v) => (plan.stages as Json[]).some((s) => s.variant === v));
  const h2 = { 'entering-maps': '## Endgame: entering maps', budget: '## Endgame: budget', 'non-budget': '## Endgame: non-budget' } as Record<string, string>;
  for (const rel of ['guide.md', ...(all ? roundsOf(dir).map((r) => `${r}/guide.md`) : [])]) {
    let guide = fs.readFileSync(path.join(dir, rel), 'utf8').split('\n');
    rungs.forEach((v, k) => {
      const at = guide.indexOf(h2[v]);
      const h3 = guide.findIndex((l, i) => i > at && l === '### Checks');
      let end = guide.findIndex((l, i) => i > h3 && /^#{1,3} /.test(l));
      if (end < 0) end = guide.length;
      guide = [...guide.slice(0, h3 + 1), '', ...blocks[k], '', ...guide.slice(end)];
    });
    fs.writeFileSync(path.join(dir, rel), guide.join('\n'));
  }
}
const stageB = (plan: Json) => plan.stages.find((s: Json) => s.id === 'b');
const stageM = (plan: Json) => plan.stages.find((s: Json) => s.id === 'm');
/** run-ok's open prose finding's reader sentence: the guide's one Known issues line, and its audit.md row's sentence. */
const PROSE_READER = 'The How to play it section is wrong to call Rolling Slam your clear skill: Blood Hunt does the clearing damage, so lead packs with Blood Hunt.';
/** The head of audit.md's Known issues table (§7.8). */
const AUDIT_KI_HEAD = '| Id | Lens or gate | Stage | Sentence in the guide |\n|---|---|---|---|\n';
/** Replaces run-ok's one open finding in both Known issues lists with `None.`, as step 14 does when nothing is open. */
function noneOpen(dir: string): void {
  editText(dir, 'guide.md', replace(`- ${PROSE_READER}\n`, 'None.\n'));
  editText(dir, 'audit.md', (t) => t.replace(/\| Id \|[^\n]*\n\|---[^\n]*\n\| v4-1-1 \|[^\n]*\n/, 'None.\n'));
}
/** run-ok's re-check V4-2 with v4-1-1 reported fixed (no reader), its verdict and log entry passing. */
function fixedInRecheck(dir: string): void {
  editText(dir, 'reports/V4-2.md', (t) => t.replace('- verdict: fail', '- verdict: pass').replace('### v4-1-1\n\n- status: unresolved', '### v4-1-1\n\n- status: fixed').replace(/\n- reader: [^\n]*\n/, '\n'));
  editLog(dir, (l) => (l.stages.find((s: Json) => s.stage === 'V4-recheck').outcome = 'pass'));
}
const step = (stage: string, concept: string | null, attempt: number, outcome: string, extra: Json = {}) => ({ stage, ...(concept ? { concept } : {}), attempt, outcome, ...extra });

/** The card every schema-3 fixture finalizes (D-319's id form), and its skeleton's one stage (R1b.md step 4). */
const CARD = 'r1-a-1';
const skeletonStage = (id: string) => `${id.replace(/-/g, '')}e`;
/** Where a fixture log's steps sit: computed, so a test names a step by what it is. */
const fixtureLog = (f: Fixture) => readJson(path.join(FIXTURES, f), 'run-log.json');
const indexOf = (f: Fixture, pred: (s: Json) => boolean) => (fixtureLog(f).stages as Json[]).findIndex(pred);
const RUN_OK = {
  d1: indexOf('run-ok', (s) => s.stage === 'D1-build'),
  d2: indexOf('run-ok', (s) => s.stage === 'D2'),
  v4: indexOf('run-ok', (s) => s.stage === 'V4'),
  w1Fix: indexOf('run-ok', (s) => s.stage === 'W1' && s.attempt === 2),
  length: fixtureLog('run-ok').stages.length as number,
};
const ESCALATED = {
  r1bA: indexOf('run-escalated', (s) => s.stage === 'R1b' && s.concept === CARD),
  assemble: indexOf('run-escalated', (s) => s.stage === 'R1a-assemble'),
  d1: indexOf('run-escalated', (s) => s.stage === 'D1-build'),
  d1a3: indexOf('run-escalated', (s) => s.stage === 'D1-build' && s.attempt === 3),
};
const ONLINE = {
  d1: indexOf('run-ok-online', (s) => s.stage === 'D1-build'),
  d1finish: indexOf('run-ok-online', (s) => s.stage === 'D1-finish'),
  w1: indexOf('run-ok-online', (s) => s.stage === 'W1'),
};
/** A checkpoint's index in a log. */
const cpAt = (l: Json, checkpoint: string | number) => (l.checkpoints as Json[]).findIndex((c) => c.checkpoint === checkpoint);

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

/** A dossier row for a verified card (D-355): the verification gate's comparison table. */
const dossierRow = (id: string, round = 1) => `| ${id} | ${round} | viable | a verified card | Blood Hunt 50000 (g1s1p1.TotalDPS) | 4200 | 31500 | weapon: unavailable (offline run) | none (offline) | none found |`;
/** Writes a passing R1b verdict for each card and gives it its dossier row, so a verification round of them checks. */
function verified(dir: string, ids: string[]): void {
  for (const id of ids) {
    writeJson(dir, `reports/gates/R1b-${id}-a1.json`, { stage: 'R1b', concept: id, attempt: 1, verdict: { compiled: 'pass' }, findings: [], errors: [], compiles: 2, recordPath: `concepts/${id}/compile-record.json`, faultsApplied: [], leagueUnverified: false });
  }
  editText(dir, 'dossier.md', (t) => `${t.replace(/\n+$/, '')}\n${ids.map((id) => dossierRow(id)).join('\n')}\n`);
}

// ---------------------------------------------------------------------------------------------------
// The passing fixtures
// ---------------------------------------------------------------------------------------------------

describe('AC-W2: the passing fixtures, runs of the amended pipeline (schema 3), and a schema-2 run (D-326)', () => {
  it.each([...RUNS, V2])('exits 0 on %s, with no --partial', (fixture) => {
    const r = runChecker(path.join(FIXTURES, fixture));
    expect(r.stderr).toBe('');
    expect(r.code).toBe(0);
    expect(r.stdout).toMatch(/^check-run: ok: /);
  });

  it.each(RUNS)('%s holds a schema-3 run log with its brief, the design gate among its checkpoints, and V4 reports named V4-<n>.md, one per logged pass (D-352, D-362)', (fixture) => {
    const dir = path.join(FIXTURES, fixture);
    const log = readJson(dir, 'run-log.json');
    expect(log.schemaVersion).toBe(3);
    expect(Object.keys(log).sort()).toEqual(['brief', 'checkpoints', 'displays', 'escalations', 'faults', 'mode', 'outputs', 'roll', 'runFolder', 'schemaVersion', 'slug', 'stages', 'status', 'testConfig']);
    expect(Object.keys(log.roll).sort()).toEqual(['ascendancy', 'className', 'skill']);
    for (const s of log.stages as Json[]) expect(Object.keys(s).filter((k) => !['stage', 'concept', 'attempt', 'outcome', 'priceOutcomes', 'probes', 'shortReason'].includes(k))).toEqual([]);
    for (const c of log.checkpoints as Json[]) {
      expect(Object.keys(c).filter((k) => !['checkpoint', 'visit', 'answer', 'answeredBy', 'rule'].includes(k))).toEqual([]);
      expect(['brainstorm', 'verification', 'design', 'final', 'unsaved-build', 'escalation']).toContain(c.checkpoint);
    }
    for (const s of log.stages as Json[]) expect(['D1', 'V4-ledger', 'V4-sources', 'V4-prose']).not.toContain(s.stage);
    const reports = fs.existsSync(path.join(dir, 'reports')) ? fs.readdirSync(path.join(dir, 'reports')).filter((f) => f !== 'gates') : [];
    for (const f of reports) expect(f).toMatch(/^V4-[1-9]\d*\.md$/);
    expect(reports.length).toBe((log.stages as Json[]).filter((s) => ['V4', 'V4-recheck'].includes(s.stage)).length);
  });

  it("run-ok is an offline fixed roll whose brainstorm deals 7 cards, first-n:2 verifies two, first-viable finalizes one, the design gate accepts it, and whose free FI-2 failure, W1 fix round and re-check leave one known issue in the guide", () => {
    const dir = path.join(FIXTURES, 'run-ok');
    const log = readJson(dir, 'run-log.json');
    expect(log.brief).toEqual({ ascendancy: 'Titan', skill: 'Blood Hunt' });
    expect(log.slug).toBe('titan-blood-hunt');
    expect(log.faults).toEqual([expect.objectContaining({ id: 'FI-2', target: { concepts: 'all', persistent: false } })]);
    expect(log.stages.map((s: Json) => `${s.stage}:${s.outcome}`)).toEqual([
      'R1a:done', 'R1a:done', 'R1a:done', 'R1a-assemble:done', 'R1b:pass', 'R1b:pass', 'R1b-assemble:done',
      'D1-build:done', 'D1-finish:done', 'D1-gate:fail', 'D1-build:done', 'D1-finish:done', 'D1-gate:pass', 'D2:done', 'D2-gate:pass', 'W1:done',
      'V4:fail', 'W1:done', 'V4-recheck:fail',
    ]);
    expect(log.checkpoints.map((c: Json) => [c.checkpoint, c.answer, c.rule])).toEqual([
      ['brainstorm', 'pick:r1-a-1,r1-a-2', 'first-n:2'], ['verification', `pick:${CARD}`, 'first-viable'], ['design', 'accept', 'accept'], ['final', 'accept', 'accept'],
    ]);
    // D-352: the full pass V4-1, the round copy rounds/1/, and the re-check V4-2 of what --changed 1 lists.
    const recheck = fs.readFileSync(path.join(dir, 'reports', 'V4-2.md'), 'utf8');
    expect(recheck).toMatch(/^# V4-2: re-check of rounds\/1\n/);
    expect(recheck).toContain('## Checked\n\n- section How to play it\n');
    expect(recheck).toContain('### v4-1-1\n\n- status: unresolved\n');
    expect(fs.readdirSync(path.join(dir, 'rounds', '1')).sort()).toEqual(['compile-record.json', 'guide.md', 'plan.json']);
    const guide = fs.readFileSync(path.join(dir, 'guide.md'), 'utf8');
    // D-276: the runner writes it at step 14 as the finding's reader sentence alone; its id goes to audit.md.
    const reader = /- reader: (.*)\n/.exec(recheck)![1];
    expect(guide).toContain(`### Known issues\n\n- ${reader}\n`);
    expect(fs.readFileSync(path.join(dir, 'audit.md'), 'utf8')).toContain(`| v4-1-1 | V4 | — | ${reader} |`);
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
    const gate = readJson(dir, `reports/gates/D1-gate-${CARD}-a1.json`);
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
    // D-358: the anoint is priced like a slot of b.
    expect(gate.basis.budget.slots).toContainEqual({ stage: 'b', slot: 'Anoint', priceId: 'b-anoint' });
    const log = readJson(dir, 'run-log.json');
    expect(log.stages.find((s: Json) => s.stage === 'D1-finish').priceOutcomes).toEqual({ ok: 14, would_wait: 1 });
    expect(log.stages.find((s: Json) => s.stage === 'D1-build').priceOutcomes).toBeUndefined();
  });

  it("run-ok-online is an open brief answered by the user: its slug is the brief's, and \"verify other cards\" opens a second verification round without a brainstorm (D-285, D-287)", () => {
    const log = readJson(path.join(FIXTURES, 'run-ok-online'), 'run-log.json');
    expect(log.brief).toEqual({ ascendancy: 'Titan', playstyle: ['melee', 'tanky', 'slow and heavy'], budget: 'budget', popularity: 'Blood Hunt Titans are rare this league' });
    expect([log.slug, log.runFolder]).toEqual(['titan-open', '/tmp/pob2-guides/titan-open/2026-10-08-1']);
    expect(log.checkpoints.map((c: Json) => `${c.checkpoint}:${c.answer}:${c.answeredBy}`)).toEqual([
      'brainstorm:pick:r1-a-1,r1-c-2:user', 'verification:verify:r1-b-3:user', `verification:pick:${CARD}:user`, 'design:accept:user', 'final:accept:user',
    ]);
    expect(log.stages.slice(0, ONLINE.d1).map((s: Json) => `${s.stage}${s.concept ? ` ${s.concept}` : ''}`)).toEqual([
      'R1a', 'R1a', 'R1a', 'R1a-assemble', `R1b ${CARD}`, 'R1b r1-c-2', 'R1b-assemble', 'R1b r1-b-3', 'R1b-assemble',
    ]);
  });

  it('run-escalated ends escalated at a D1 gate escalation answered by the default stop, its verdict file named, no findings copied (S4); its short round says why, and its not-a-skill card never re-runs (D-334, D-339)', () => {
    const log = readJson(path.join(FIXTURES, 'run-escalated'), 'run-log.json');
    expect(log.status).toBe('escalated');
    expect([log.brief, log.slug]).toEqual([{ playstyle: ['melee', 'tanky'], budget: 'budget' }, 'open-melee']);
    expect(log.escalations).toEqual([{ stage: 'D1-gate', concept: CARD, verdict: `reports/gates/D1-gate-${CARD}-a3.json`, choice: 'stop' }]);
    expect(log.checkpoints[cpAt(log, 'escalation')]).toEqual(expect.objectContaining({ checkpoint: 'escalation', answeredBy: 'default' }));
    expect(log.stages[ESCALATED.assemble].shortReason).toBe('5 of 9 cards passed the sniff test');
    expect(log.stages.filter((s: Json) => s.concept === 'r1-c-1')).toEqual([step('R1b', 'r1-c-1', 1, 'fail', { probes: 0 })]);
    expect(readJson(path.join(FIXTURES, 'run-escalated'), 'reports/gates/R1b-r1-c-1-a1.json')).toEqual(expect.objectContaining({ compiles: 0, findings: [expect.objectContaining({ code: 'not-a-skill' })] }));
    expect(fs.existsSync(path.join(FIXTURES, 'run-escalated', 'guide.md'))).toBe(false);
  });

  // validatePlan only: V1 and V2 need a compile's engine-side stage checks, so they run in the engine tests.
  it('every fixture plan, skeletons and probes included, passes validatePlan with the C1/E1 data (C-31), and every enemy<Type>Damage a plan or a final record holds is a whole number (D-256, D-353)', () => {
    const ref = loadReferenceData();
    const plans: string[] = [];
    const under = (dir: string): string[] => (fs.existsSync(dir) ? fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? under(path.join(dir, e.name)) : e.name === 'plan.json' ? [path.join(dir, e.name)] : [])) : []);
    for (const run of [...RUNS, V2]) plans.push(path.join(FIXTURES, run, 'plan.json'), ...under(path.join(FIXTURES, run, 'concepts')), ...under(path.join(FIXTURES, run, 'probes')));
    expect(plans.filter((p) => p.includes(`${path.sep}probes${path.sep}`)).length).toBe(4);
    for (const p of plans) {
      const text = fs.readFileSync(p, 'utf8');
      const result = validatePlan(text, ref);
      expect({ plan: path.relative(FIXTURES, p), errors: result.ok ? [] : result.errors }).toEqual({ plan: path.relative(FIXTURES, p), errors: [] });
      // PoB types these options countAllowZero, and the bridge refuses a fraction.
      const hits = (JSON.parse(text).stages as Json[]).flatMap((s) => (s.config.scenario as Json[]).filter((o) => /^enemy\w+Damage$/.test(o.option)));
      for (const o of hits) expect({ plan: path.relative(FIXTURES, p), option: o.option, whole: Number.isInteger(o.value) }).toEqual({ plan: path.relative(FIXTURES, p), option: o.option, whole: true });
    }
    for (const run of [...RUNS, V2]) {
      const record = readJson(path.join(FIXTURES, run), 'compile-record.json');
      for (const [id, st] of Object.entries(record.stages as Record<string, Json>)) {
        for (const [option, value] of Object.entries(st.configWritten as Json).filter(([k]) => /^enemy\w+Damage$/.test(k))) expect({ run, id, option, whole: Number.isInteger(value) }).toEqual({ run, id, option, whole: true });
      }
    }
  });

  it('run-ok and run-ok-online are schema-3 plans with a kind on every claim and an anoint on b, whose ladder starts at the entering-maps rung m, with audit.md beside the guide (D-278, D-281, D-351, D-358)', () => {
    for (const run of ['run-ok', 'run-ok-online']) {
      const dir = path.join(FIXTURES, run);
      const plan = readJson(dir, 'plan.json');
      expect({ run, version: plan.schemaVersion }).toEqual({ run, version: 3 });
      expect((plan.stages as Json[]).flatMap((s) => (s.claims as Json[]).map((c) => c.kind)).every((k) => ['hinge', 'reason'].includes(k))).toBe(true);
      expect((plan.stages as Json[]).filter((s) => s.items.anoint !== undefined).map((s) => s.id)).toEqual(['b']);
      expect((plan.stages as Json[]).filter((s) => s.variant !== undefined).map((s) => `${s.id}:${s.variant}`)).toEqual(['m:entering-maps', 'b:budget', 'n:non-budget']);
      // D-353: the compiler fills the reference hits the plan omits, m's at area level 69 (T5); no hit_ ledger entry.
      const m = (plan.stages as Json[]).find((s) => s.id === 'm')!;
      expect((m.config.scenario as Json[]).filter((x) => /^enemy\w+Damage$/.test(x.option))).toEqual([]);
      expect((plan.ledger as Json[]).filter((e) => /^hit_/.test(e.id))).toEqual([]);
      expect(readJson(dir, 'compile-record.json').stages.m.configWritten).toEqual(expect.objectContaining({ enemyPhysicalDamage: 299, enemyFireDamage: 72 }));
      expect((plan.prices as Json[]).filter((x) => x.id.startsWith('m-')).length).toBe(m.items.slots.length);
      expect(fs.existsSync(path.join(dir, 'audit.md'))).toBe(true);
    }
  });

  it('every fixture plan sets skills.main.statSet on its endgame stages, the stat set its D1 gate compares (S7)', () => {
    for (const run of [...RUNS, V2]) {
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

  it("the final records' import codes decode to their PoB files, one tree set per plan stage (D-215); the schema-3 records are version 2, with the counted figures and TotalEHP (C-33, D-294)", () => {
    for (const run of ['run-ok', 'run-ok-online']) {
      const record = readJson(path.join(FIXTURES, run), 'compile-record.json');
      const xml = zlib.inflateSync(Buffer.from(record.importCode.replace(/-/g, '+').replace(/_/g, '/'), 'base64'));
      expect(sha1(xml)).toBe(record.pobFile.sha1);
      expect((xml.toString('utf8').match(/<Spec\b/g) ?? []).length).toBe(readJson(path.join(FIXTURES, run), 'plan.json').stages.length);
      expect(record.recordVersion).toBe(2);
      for (const st of Object.values(record.stages) as Json[]) expect([typeof st.outputs.TotalEHP, typeof st.countedSkillOutputs]).toEqual(['number', 'object']);
      // D-353, D-358: each endgame stage's measures, the Arbiter's verdict on b and n, and b's anoint recipe.
      expect(Object.keys(record.stages.m.measures).sort()).toEqual(['clearSpeed', 'dps', 'ehp']);
      for (const id of ['b', 'n']) expect(record.stages[id].measures.arbiter.verdict).toBe('survives');
      expect(record.stages.b.anoint).toEqual(expect.objectContaining({ notable: 'Unbending', recipe: ['Ire', 'Guilt', 'Greed'] }));
    }
  });
});

// ---------------------------------------------------------------------------------------------------
// The artifacts: broken copies
// ---------------------------------------------------------------------------------------------------

interface BrokenCase {
  name: string;
  fixture: Fixture;
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
/** Sets a stage's breakdown figure in the record as PoB measured it and as the counted copy carries it (count 1). */
const setFigure = (r: Json, stage: string, key: string, value: number) => {
  r.stages[stage].skillOutputs[key].fields.TotalDPS = value;
  r.stages[stage].countedSkillOutputs[key].fields.TotalDPS = value * r.stages[stage].countedSkillOutputs[key].count;
};

const broken: BrokenCase[] = [
  // (a)
  { name: '(a) guide.md is missing from a completed run', fixture: 'run-ok', edit: (d) => fs.rmSync(path.join(d, 'guide.md')), rule: 'layout', says: /guide\.md is missing/ },
  { name: '(a) a stray file in the run folder', fixture: 'run-ok', edit: (d) => fs.writeFileSync(path.join(d, 'gen.py'), ''), rule: 'layout', says: /gen\.py isn't part of the run-folder layout/ },
  { name: "(a) a report named the old way (V3, or a V4 report with a pass number)", fixture: 'run-ok', edit: (d) => fs.writeFileSync(path.join(d, 'reports', 'v3-c1-p1.json'), '{}'), rule: 'layout', says: /reports\/v3-c1-p1\.json isn't a V4 report reports\/V4-<n>\.md/ },
  { name: '(a) a V4 report named by its lens, from before amendment 4 (D-352)', fixture: 'run-ok', edit: (d) => fs.writeFileSync(path.join(d, 'reports', 'v4-prose.json'), '{}'), rule: 'layout', says: /reports\/v4-prose\.json isn't a V4 report reports\/V4-<n>\.md, n from 1 \(§2, D-352\)/ },
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
  // D-276: guide.md carries no markers, nor, since D-355, the dossier; the research files keep theirs, and the plan's claims carry the guide's sources.
  { name: '(d) a research marker has no definition', fixture: 'run-ok', edit: (d) => editText(d, 'research/p1-r1a-2.md', replace('no config option.[^s2]', 'no config option.[^s2][^nope]')), rule: 'markers', says: /research\/p1-r1a-2\.md:\d+: marker \[\^nope\] has no definition/ },
  { name: '(d) a price definition names no prices[] entry', fixture: 'run-ok', edit: (d) => editText(d, 'research/p1-r1a-2.md', replace('[^s2]: pob-data | check_model_coverage gem "Blood Hunt" | patch: 0.5.4', '[^s2]: price | no-such-price')), rule: 'markers', says: /price "no-such-price" names no prices\[\] entry/ },
  { name: '(d) a ledger definition names no ledger entry', fixture: 'run-ok', edit: (d) => editText(d, 'research/p1-r1a-2.md', replace('[^s2]: pob-data | check_model_coverage gem "Blood Hunt" | patch: 0.5.4', '[^s2]: ledger | no_such_entry')), rule: 'markers', says: /ledger "no_such_entry" names no ledger entry/ },
  { name: '(d) a data definition names no C1/E1 fact', fixture: 'run-ok', edit: (d) => editText(d, 'research/p1-r1a-2.md', replace('[^s2]: pob-data | check_model_coverage gem "Blood Hunt" | patch: 0.5.4', '[^s2]: data | campaign/limits.json#resistance-penalty.act9')), rule: 'markers', says: /names no C1\/E1 fact/ },
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
  { name: '(i) a schema-1 run log', fixture: 'run-ok', edit: (d) => editLog(d, (l) => (l.schemaVersion = 1)), rule: 'run-log', says: /schemaVersion: is 1; it is 3, or 2 for a run recorded before amendment 3/ },
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
  { name: '(k) an offline run has a price call (priceOutcomes, Q5)', fixture: 'run-ok', edit: (d) => editLog(d, (l) => (l.stages.find((s: Json) => s.stage === 'D1-finish').priceOutcomes = { ok: 1 })), rule: 'offline-prices', says: /an offline run made 1 price call/ },
  { name: "(k) an offline probe plan has a prices[] status ok", fixture: 'run-ok', edit: (d) => editJson(d, `probes/${CARD}/1/plan.json`, (p) => Object.assign(p.prices[0], { status: 'ok', amount: 1, currency: 'divine' })), rule: 'offline-prices', says: /probes\/r1-a-1\/1\/plan\.json: price "r1-a-1-weapon" is "ok"/ },
  // (l)
  { name: "(l) a finding open in the last report is missing from the guide's Known issues (by sentence)", fixture: 'run-ok', edit: (d) => editText(d, 'guide.md', replace(`- ${PROSE_READER}\n`, 'None.\n')), rule: 'known-issues', says: /V4 finding "v4-1-1" .* is open in reports\/V4-2\.md, the last report, but guide\.md's Known issues doesn't list its reader sentence, word for word/ },
  { name: "(l) an open finding's id is missing from audit.md's Known issues", fixture: 'run-ok', edit: (d) => editText(d, 'audit.md', replace(`| v4-1-1 | V4 | — | ${PROSE_READER} |\n`, '')), rule: 'known-issues', says: /V4 finding "v4-1-1" .* is open in reports\/V4-2\.md, the last report, but audit\.md's Known issues has no row "\| v4-1-1 \| V4 \| — \| <its reader sentence> \|"/ },
  // (n) The V4 report's form (stages/V4.md, D-352).
  { name: '(n) a V4 finding misses a field', fixture: 'run-ok', edit: (d) => editText(d, 'reports/V4-1.md', replace('- evidence: offline run (run-log.json mode offline)\n\n### v4-1-3', '\n### v4-1-3')), rule: 'report-shape', says: /V4-1\.md: finding v4-1-2 \(line \d+\) has the fields status, hinge, owner, artifact, location, claim, issue; a fixed or accepted-offline finding has status, hinge, owner, artifact, location, claim, issue, evidence, in that order/ },
  { name: '(n) verdict pass alongside an unresolved finding', fixture: 'run-ok', edit: (d) => editText(d, 'reports/V4-1.md', replace('- verdict: fail', '- verdict: pass')), rule: 'report-shape', says: /V4-1\.md: says verdict "pass" alongside 1 unresolved finding/ },
  { name: "(n) a report's check differs from its H1", fixture: 'run-ok', edit: (d) => editText(d, 'reports/V4-2.md', replace('- check: recheck', '- check: full')), rule: 'report-shape', says: /V4-2\.md: check is "full"; it is "full" or "recheck", as its H1 says/ },
  { name: "(n) a finding on the dossier, which V4 doesn't check (S3), or owned by dossier-fix", fixture: 'run-ok', edit: (d) => editText(d, 'reports/V4-1.md', replace('- owner: W1\n- artifact: guide.md', '- owner: dossier-fix\n- artifact: dossier.md')), rule: 'report-shape', says: /artifact is "dossier\.md"/ },
  { name: "(n) a V4 report about another card than the pass that wrote it", fixture: 'run-ok', edit: (d) => editText(d, 'reports/V4-1.md', replace(`- concept: ${CARD}`, '- concept: c1')), rule: 'report-shape', says: /V4-1\.md: concept is "c1", but the pass that wrote it, V4 r1-a-1 attempt 1, is about r1-a-1/ },
  { name: '(n) a finding id of the old lens form, or of another pass in a full pass', fixture: 'run-ok', edit: (d) => editText(d, 'reports/V4-1.md', replace('### v4-1-3', '### v4-prose-3')), rule: 'report-shape', says: /V4-1\.md: finding v4-prose-3 \(line \d+\): its id isn't v4-<n>-<k>/ },
  { name: '(n) a V4 entry logged pass over a report that fails', fixture: 'run-ok', edit: (d) => editLog(d, (l) => (l.stages.find((s: Json) => s.stage === 'V4').outcome = 'pass')), rule: 'reports', says: /logs V4 r1-a-1 attempt 1 "pass", but its report reports\/V4-1\.md says verdict "fail"/ },
  // (o)
  { name: '(o) floor: pass, but the record has MissingColdResist above 0', fixture: 'run-ok', edit: (d) => editJson(d, 'compile-record.json', (r) => (r.stages.b.outputs.MissingColdResist = 5)), rule: 'floor', says: /says floor: "pass", but the records give "fail": .*MissingColdResist is 5/ },
  { name: '(o) MissingChaosResist above 0 and the chaosResistException removed (D-234)', fixture: 'run-ok', edit: (d) => editPlan(d, (p) => delete stageB(p).chaosResistException), rule: 'floor', says: /MissingChaosResist is 47 and it has no chaosResistException/ },
  { name: "(o) the exception's reason is missing from the guide's Checks (D-234)", fixture: 'run-ok', edit: (d) => editText(d, 'guide.md', replace('because no slot can carry chaos resistance', 'because of the')), rule: 'floor', says: /no line of the guide's "Endgame: budget" Checks states its full reason .* with the uncapped value 28% \(D-234\)/ },
  { name: "(o) the uncapped chaos value isn't stated with % on the reason's line (D-234)", fixture: 'run-ok', edit: (d) => editText(d, 'guide.md', replace('Chaos resistance stays at 28% because', 'Chaos resistance stays uncapped because')), rule: 'floor', says: /states its full reason .* with the uncapped value 28%/ },
  { name: "(o) an endgame stage's record lacks its waystone-scaled chaos reference hit (D-254, D-353)", fixture: 'run-ok', edit: (d) => editJson(d, 'compile-record.json', (r) => delete r.stages.b.configWritten.enemyChaosDamage), rule: 'floor', says: /says floor: "pass", but the records give "fail": stage b's record has no waystone-scaled Chaos reference hit \(configWritten\.enemyChaosDamage\)/ },
  { name: "(o) a recorded reference hit isn't D-254's formula at its area level, rounded by D-256 (D-353)", fixture: 'run-ok', edit: (d) => editJson(d, 'compile-record.json', (r) => (r.stages.b.configWritten.enemyPhysicalDamage = 325)), rule: 'floor', says: /stage b's recorded enemyPhysicalDamage 325 isn't 402: the damage at its area level 79 .* is 402, rounded to 2 decimals and then up \(D-254, D-256, D-353\)/ },
  // (p)
  { name: '(p) budget: pass, but the prices and rates give over 22 divines', fixture: 'run-ok-online', edit: (d) => editPlan(d, (p) => (p.prices.find((x: Json) => x.id === 'b-weapon').amount = 10)), rule: 'budget', says: /says budget: "pass", but the records give "fail": stage b totals 23\.9 divines, above 22/ },
  { name: '(p) the anoint maps to no prices[] entry (D-358)', fixture: 'run-ok-online', edit: (d) => editJson(d, `reports/gates/D1-gate-${CARD}-a1.json`, (r) => (r.basis.budget.slots = r.basis.budget.slots.filter((s: Json) => s.slot !== 'Anoint'))), rule: 'budget', says: /budget stage b's filled anoint \(Unbending\) maps to no prices\[\] entry/ },
  { name: '(p) a filled budget slot maps to no prices[] entry', fixture: 'run-ok-online', edit: (d) => editJson(d, `reports/gates/D1-gate-${CARD}-a1.json`, (r) => (r.basis.budget.slots = r.basis.budget.slots.filter((s: Json) => s.slot !== 'Helmet'))), rule: 'budget', says: /filled slot "Helmet" maps to no prices\[\] entry/ },
  { name: '(p) a filled tree jewel maps to no prices[] entry (D-249)', fixture: 'run-ok-online', edit: (d) => editJson(d, `reports/gates/D1-gate-${CARD}-a1.json`, (r) => (r.basis.budget.slots = r.basis.budget.slots.filter((s: Json) => s.jewel === undefined))), rule: 'budget', says: /filled tree jewel in node 1001 maps to no prices\[\] entry/ },
  { name: '(p) an expensive tree jewel tips the budget over 22 divines (D-249)', fixture: 'run-ok-online', edit: (d) => editPlan(d, (p) => (p.prices.find((x: Json) => x.id === 'b-jewel').amount = 200)), rule: 'budget', says: /says budget: "pass", but the records give "fail": stage b totals 23\.4 divines, above 22/ },
  { name: '(p) two slots holding different items share a price entry', fixture: 'run-ok-online', edit: (d) => editJson(d, `reports/gates/D1-gate-${CARD}-a1.json`, (r) => (r.basis.budget.slots.find((s: Json) => s.slot === 'Ring 2').priceId = 'b-ring1')), rule: 'budget', says: /share price entry "b-ring1" but hold different items/ },
  { name: '(p) over 20 divines and the guide lacks "near the ceiling"', fixture: 'run-ok-online', edit: (d) => editText(d, 'guide.md', replace('21.9 divines is near the ceiling:', '21.9 divines is close to the line:')), rule: 'budget', says: /lack "near the ceiling"/ },
  // (q)
  { name: '(q) rolledSkill: pass, but a same-role group has a larger figure in the record', fixture: 'run-ok', edit: (d) => editJson(d, 'compile-record.json', (r) => setFigure(r, 'b', 'g2s1p1', 60000)), rule: 'rolled-skill', says: /says rolledSkill: "pass", but the records give "fail": stage b's group 2 \(clear\) has 60000 \(× its Count\), more than the named damage source's group 1's 50000 \(× its Count\) \(D-340\)/ },
  { name: "(q) the named damage source's group's role is utility", fixture: 'run-ok', edit: (d) => editPlan(d, (p) => (stageB(p).skills.groups[0].role = 'utility')), rule: 'rolled-skill', says: /stage b's named damage source's group 1 \(rolledGroup\) has role "utility"; the named damage source is clear or single_target, never a token role/ },
  // (r), amendment 1 §4.2
  { name: "(r) plan.json's sha1 differs from the final record's planSha1", fixture: 'run-ok', edit: (d) => editJson(d, 'plan.json', (p) => (stageB(p).claims[0].text += ' Edited after the final compile.')), rule: 'record-plan', says: /sha1\(plan\.json\) is [0-9a-f]{40}, but the final record's planSha1 is "[0-9a-f]{40}": plan\.json changed after the final compile, and no claims-only owner \(claims-edited\) ran after it/ },
  // (s)
  { name: "(s) the import code isn't the PoB file's (its sha1 differs from the record's pobFile)", fixture: 'run-ok', edit: (d) => editJson(d, 'compile-record.json', (r) => (r.pobFile.sha1 = 'a9993e364706816aba3e25717850c26c9cd0d89d')), rule: 'pob-file', says: /the decoded importCode's sha1 is [0-9a-f]{40}, but the record's PoB file "titan-blood-hunt-2026-10-08-1\.xml" has sha1 "a9993e36/ },
  { name: "(s) the import code doesn't decode", fixture: 'run-ok', edit: (d) => editJson(d, 'compile-record.json', (r) => (r.importCode = 'eNrtWV1v2zYUfc-vIPS-FixtureImportCode-0001')), rule: 'pob-file', says: /importCode doesn't decode as a PoB code/ },
  { name: '(s) the loadout count differs from the plan stages: one tree set missing (D-215)', fixture: 'run-ok', edit: (d) => recode(d, specs(['Act 1 (L8) {1}', 'Act 2 (L30) {2}', 'Entering maps (L65) {m}', 'Endgame budget (L90) {b}'])), rule: 'pob-file', says: /holds 4 tree set\(s\), but the record compiled 5 stage\(s\); the file holds one loadout per stage \(D-215\)/ },
  { name: "(s) a tree set isn't titled by its stage's loadout name (a Default left behind)", fixture: 'run-ok', edit: (d) => recode(d, specs(['Default', 'Act 2 (L30) {2}', 'Entering maps (L65) {m}', 'Endgame budget (L90) {b}', 'Endgame non-budget (L95) {n}'])), rule: 'pob-file', says: /tree sets are titled \["Default",.*the record's loadout names, in plan order, are \["Act 1 \(L8\) \{1\}"/ },
  // (t)
  { name: "(t) a ledger entry that doesn't evaluate over the final record (D-365)", fixture: 'run-ok', edit: (d) => editPlan(d, (p) => (p.ledger[0].formula = 'b.NoSuchOutput * share / 100')), rule: 'ledger', says: /ledger entry bleed_bonus doesn't evaluate over the final record: / },
  { name: "(t) a doubled ledger formula (FI-4's edit) under the claim citing it (D-365)", fixture: 'run-ok', edit: (d) => editPlan(d, (p) => (p.ledger[0].formula = `(${p.ledger[0].formula}) * 2`)), rule: 'ledger', says: /plan\.json stages\[3\]\.claims\[4\] \(b-bleed\) cites ledger:bleed_bonus, whose current formula gives 15000 over the final record and its inputs are share 15, but the claim states 7,500; a claim citing a ledger entry states its value or its inputs \(D-365\)/ },
  // (u)
  { name: "(u) the named source's figure's stat set isn't skills.main.statSet (S7)", fixture: 'run-ok', edit: (d) => editPlan(d, (p) => (stageB(p).skills.main.statSet = 2)), rule: 'rolled-skill', says: /says rolledSkill: "pass", but the records give "fail": stage b's named damage source's figure g1s1p1\.TotalDPS isn't the main skill's stat set g1s1p2 \(skills\.main\)/ },
  { name: '(u) an endgame stage sets no skills.main.statSet (S7)', fixture: 'run-ok', edit: (d) => editPlan(d, (p) => delete stageB(p).skills.main.statSet), rule: 'rolled-skill', says: /says rolledSkill: "pass", but the records give "fail": stage b sets no skills\.main\.statSet/ },
  // (v), amendment 2 (D-283)
  { name: '(v) guide.md over 3,000 words', fixture: 'run-ok', edit: (d) => editText(d, 'guide.md', replace('## Changelog\n', `${'word '.repeat(3000)}\n\n## Changelog\n`)), rule: 'word-cap', says: /guide\.md has \d+ words, over the 3000-word cap \(the H1, the import code and the Known issues list not counted/ },
  // (w)
  { name: '(w) a footnote marker in guide.md', fixture: 'run-ok', edit: (d) => editText(d, 'guide.md', replace('one button for rares;', 'one button for rares;[^g1]')), rule: 'guide-markers', says: /guide\.md:\d+ carries a footnote marker "\[\^"/ },
  { name: '(w) a confidence label in guide.md', fixture: 'run-ok', edit: (d) => editText(d, 'guide.md', replace('I read it as a ceiling.', 'I read it as a ceiling (confidence L).')), rule: 'guide-markers', says: /carries the confidence label "confidence L"/ },
  { name: '(w) a finding id in guide.md (the old Known issues form)', fixture: 'run-ok', edit: (d) => editText(d, 'guide.md', replace(`- ${PROSE_READER}\n`, `- ${PROSE_READER} (v4-1-1)\n`)), rule: 'guide-markers', says: /carries the finding id "v4-1-1"/ },
  { name: '(w) pipeline text in a second fenced block under Priorities: only the import code is exempt', fixture: 'run-ok', edit: (d) => editText(d, 'guide.md', replace('## Leveling\n', '```\n[^g1] (confidence L) v4-1-1\n```\n\n## Leveling\n')), rule: 'guide-markers', says: /guide\.md:\d+ carries a footnote marker "\[\^"/ },
  // (x)
  { name: "(x) a rung's verdict line is missing", fixture: 'run-ok', edit: (d) => editText(d, 'guide.md', (t) => t.replace(/- \*\*Budget \(L90\)[^\n]*\n/, '')), rule: 'verdict-line', says: /"Survival by stage" has no verdict line for the Budget rung, stage b/ },
  { name: '(x) a verdict line not in the fixed form', fixture: 'run-ok', edit: (d) => editText(d, 'guide.md', replace('75/75/75/28% at −60%.', '75/75/75/28% at the endgame penalty.')), rule: 'verdict-line', says: /the Budget verdict line isn't in the fixed form ".*Effective HP about <n>\." \(D-283, D-294\)/ },
  { name: "(x) a verdict line's level differs from the stage's", fixture: 'run-ok', edit: (d) => editText(d, 'guide.md', replace('**Budget (L90): ', '**Budget (L91): ')), rule: 'verdict-line', says: /the Budget verdict line says level 91, but stage b's level is 90/ },
  { name: "(x) a verdict line's resistance is wrong", fixture: 'run-ok', edit: (d) => editText(d, 'guide.md', replace('75/75/75/28%', '75/75/75/29%')), rule: 'verdict-line', says: /the Budget verdict line says chaos resistance 29, but b\.ChaosResist is 28/ },
  { name: "(x) a verdict line's max hit is wrong", fixture: 'run-ok', edit: (d) => editText(d, 'guide.md', replace('Max hit 5,100 physical', 'Max hit 6,100 physical')), rule: 'verdict-line', says: /the Budget verdict line says physical max hit 6,100, but b\.PhysicalMaximumHitTaken is 5100/ },
  { name: "(x) a verdict line's other max hit is the largest, not the least", fixture: 'run-ok', edit: (d) => editText(d, 'guide.md', replace('at least 3,000 elemental', 'at least 9,800 elemental')), rule: 'verdict-line', says: /says elemental or chaos max hit 9,800, but the least of b's FireMaximumHitTaken, ColdMaximumHitTaken, LightningMaximumHitTaken, ChaosMaximumHitTaken is 3000/ },
  { name: "(x) a verdict line's hit is mis-rounded against the hit the compiler wrote (D-353)", fixture: 'run-ok', edit: (d) => editText(d, 'guide.md', replace('physical against about 400,', 'physical against about 410,')), rule: 'verdict-line', says: /the Budget verdict line says physical hit 410, but the hit the compiler wrote, b\.configWritten\.enemyPhysicalDamage is 402/ },
  { name: "(x) a verdict line's other hit isn't the largest the compiler wrote (D-353)", fixture: 'run-ok', edit: (d) => editText(d, 'guide.md', replace('elemental or chaos against about 97.', 'elemental or chaos against about 72.')), rule: 'verdict-line', says: /the Budget verdict line says elemental or chaos hit 72, but the largest of the hits the compiler wrote, b\.configWritten's enemyFireDamage, enemyColdDamage, enemyLightningDamage, enemyChaosDamage is 97/ },
  { name: "(x) a verdict line's DPS isn't the record's measures.dps", fixture: 'run-ok', edit: (d) => editText(d, 'guide.md', replace('Blood Hunt about 50,000 DPS', 'Blood Hunt about 60,000 DPS')), rule: 'verdict-line', says: /the Budget verdict line says DPS 60,000, but b\.measures\.dps \(the main group's TotalDPS × its Count\) is 50000/ },
  // (y)
  { name: "(y) the entering-maps rung's budget above 5.5 divines", fixture: 'run-ok-online', edit: (d) => editPlan(d, (p) => (p.prices.find((x: Json) => x.id === 'm-weapon').amount = 3.2)), rule: 'budget', says: /says budget: "pass", but the records give "fail": stage m totals 5\.6 divines, above 5\.5 \(D-281\)/ },
  { name: '(y) the entering-maps rung above 5 divines without "near the ceiling"', fixture: 'run-ok-online', edit: (d) => editPlan(d, (p) => (p.prices.find((x: Json) => x.id === 'm-weapon').amount = 2.8)), rule: 'budget', says: /entering-maps stage m totals 5\.2 divines, over 5, but the guide's "Endgame: entering maps" Checks lack "near the ceiling" \(D-281\)/ },
  { name: "(y) the entering-maps rung's floor: a resistance below its cap", fixture: 'run-ok', edit: (d) => editJson(d, 'compile-record.json', (r) => (r.stages.m.outputs.MissingColdResist = 5)), rule: 'floor', says: /says floor: "pass", but the records give "fail": .*stage m MissingColdResist is 5/ },
  { name: "(y) the entering-maps rung's floor: a recorded hit of another area level than 69 (D-327, D-353)", fixture: 'run-ok', edit: (d) => editJson(d, 'compile-record.json', (r) => (r.stages.m.configWritten.enemyFireDamage = 97)), rule: 'floor', says: /stage m's recorded enemyFireDamage 97 isn't 72: the damage at its area level 69/ },
  // (z)
  { name: '(z) audit.md is missing one of its H2s', fixture: 'run-ok', edit: (d) => editText(d, 'audit.md', replace("## What PoB doesn't model\n", '')), rule: 'audit-sections', says: /audit\.md's H2s are missing \["What PoB doesn't model"\]/ },
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
// Amendment 3 (WU-58): AC-W2 (aa) to (ff), D-339's deck and D-334's terminal R1b
// ---------------------------------------------------------------------------------------------------

/**
 * run-escalated stopped at its first verification gate: the gate answered stop by default, no design ran. The
 * D1 gate's files, the plan and its record are gone with the design.
 */
function stoppedAtVerification(): string {
  const dir = copyOf('run-escalated');
  for (const f of ['plan.json', 'compile-record.json', 'compiled-build.xml', ...[1, 2, 3].map((a) => `reports/gates/D1-gate-${CARD}-a${a}.json`)]) fs.rmSync(path.join(dir, f));
  editLog(dir, (l) => {
    l.stages = l.stages.slice(0, ESCALATED.d1);
    l.status = 'stopped';
    l.escalations = [];
    l.roll = null;
    l.checkpoints = [l.checkpoints[0], { checkpoint: 'verification', visit: 1, answer: 'stop', answeredBy: 'default', rule: 'no verification answer left: stop' }];
    l.faults[0].applied = 0;
  });
  return dir;
}

describe('AC-W2 (aa): the run log is schema 3, or schema 2 for a recorded run; its roll stays null until the verification gate finalizes a card (D-286, D-289, D-326)', () => {
  it('fails a run log whose schemaVersion is neither 2 nor 3', () => {
    for (const v of [4, 1, '3']) {
      const dir = copyOf('run-ok');
      editLog(dir, (l) => (l.schemaVersion = v));
      expect(lines(failing(dir), 'run-log')).toContainEqual(expect.stringMatching(new RegExp(`schemaVersion: is ${JSON.stringify(v)}; it is 3, or 2 for a run recorded before amendment 3 \\(D-289, D-326\\)`)));
    }
  });

  it("passes a run stopped before the verification gate finalized anything, with roll null; fails the same log with its roll set", () => {
    const dir = stoppedAtVerification();
    passes(dir);
    editLog(dir, (l) => (l.roll = { className: 'Warrior', ascendancy: 'Titan', skill: 'Blood Hunt' }));
    expect(failing(dir)).toMatch(/\[run-log\] run-log\.json roll: is \{"className":"Warrior","ascendancy":"Titan","skill":"Blood Hunt"\}, set before the verification gate finalized any card \(no verification answer pick:<id>\); the roll stays null until that pick \(D-286, D-289\)/);
  });

  it("fails a roll left null after the verification gate's pick, a roll that isn't the finalized card's identity, and a schema-2 roll in a schema-3 log", () => {
    const nul = copyOf('run-ok');
    editLog(nul, (l) => (l.roll = null));
    expect(failing(nul)).toMatch(/\[run-log\] run-log\.json roll: is null, but the verification gate finalized r1-a-1; that card's identity becomes the run's roll \(D-286\)/);
    const other = copyOf('run-ok');
    editLog(other, (l) => (l.roll.className = 'Mercenary'));
    expect(failing(other)).toMatch(/\[run-log\] run-log\.json roll is .*"Mercenary".*, but the verification gate finalized r1-a-1, whose identity \(concepts\/r1-a-1\/plan\.json's roll\) is .*"Warrior".*; the finalized card's identity becomes the run's roll \(D-286\)/);
    const v2roll = copyOf('run-ok');
    editLog(v2roll, (l) => delete l.roll.className);
    expect(failing(v2roll)).toMatch(/\[run-log\] run-log\.json roll: is \{"ascendancy":"Titan","skill":"Blood Hunt"\}; it is null until the verification gate's pick, then the finalized card's identity \{className, ascendancy, skill\}/);
  });

  it("fails a schema-3 log without its brief, a brief field that isn't one, and a roll contradicting the brief's fixed pieces (C-51)", () => {
    const none = copyOf('run-ok');
    editLog(none, (l) => delete l.brief);
    expect(failing(none)).toMatch(/\[run-log\] run-log\.json has no brief/);
    const bad = copyOf('run-ok-online');
    editLog(bad, (l) => Object.assign(l.brief, { mood: 'calm', playstyle: 'melee', budget: 'cheap' }));
    const stderr = failing(bad);
    expect(stderr).toMatch(/\[run-log\] run-log\.json brief\.mood: isn't a brief field/);
    expect(stderr).toMatch(/\[run-log\] run-log\.json brief\.playstyle: is "melee"; it lists the playstyle tags/);
    expect(stderr).toMatch(/\[run-log\] run-log\.json brief\.budget: is "cheap"; "budget", "non-budget" or a figure in divines/);
    const contradicts = copyOf('run-ok');
    editLog(contradicts, (l) => (l.brief.ascendancy = 'Smith of Kitava'));
    expect(failing(contradicts)).toMatch(/\[run-log\] run-log\.json roll: names ascendancy "Titan", but the brief fixes "Smith of Kitava"/);
  });

  it("takes the slug from the brief: an open brief's slug is <ascendancy>-open or open-<first playstyle tag>, never the finalized card's (D-285)", () => {
    // run-ok-online's brief names Titan and no skill; run-escalated's names neither, its first tag melee.
    passes(copyOf('run-ok-online'));
    passes(copyOf('run-escalated'));
    const fromRoll = copyOf('run-ok-online');
    editLog(fromRoll, (l) => {
      l.slug = 'titan-blood-hunt';
      l.runFolder = '/tmp/pob2-guides/titan-blood-hunt/2026-10-08-1';
    });
    expect(failing(fromRoll)).toMatch(/\[run-log\] run-log\.json slug: is "titan-blood-hunt"; the brief's slug is "titan-open": the slug comes from the brief/);
    // Free text after the tags doesn't make the slug; with no tag at all it is "open".
    const noTag = copyOf('run-escalated');
    editLog(noTag, (l) => (l.brief = { playstyle: ['slow and heavy'] }));
    expect(failing(noTag)).toMatch(/slug: is "open-melee"; the brief's slug is "open"/);
  });
});

describe('D-344: a run stopped at its first agent step, with no Agent tool, before any agent ran (SKILL.md §1)', () => {
  /**
   * A P1 folder that holds the run log alone, `status: "stopped"` with no `stages[]` entry. By default it is the
   * free-text Fork brief's (AC-W47, D-343): steps 1 to 4 ran, Fork is in `around`, and the run stopped at its first
   * agent step. `over` gives another P1 command's shape.
   */
  function stoppedBeforeAgents(over: Json = {}): string {
    const dir = path.join(TMP, `stopped-${++copies}`);
    writeJson(dir, 'run-log.json', {
      schemaVersion: 3,
      runFolder: '/tmp/pob2-guides/open/2026-10-11-1',
      slug: 'open',
      brief: { around: 'Fork', notes: 'any ascendancy' },
      roll: null,
      status: 'stopped',
      mode: 'offline',
      testConfig: 'none',
      stages: [],
      checkpoints: [],
      escalations: [],
      faults: [],
      outputs: { plan: null, record: null, dossier: null, guide: null, pobFile: null },
      ...over,
    });
    return dir;
  }
  /** The Explosive Concoction brief of AC-W48's two refused test configs: its slug `open-<skill>`. */
  const EC = {
    runFolder: '/tmp/pob2-guides/open-explosive-concoction/2026-10-11-1',
    slug: 'open-explosive-concoction',
    brief: { skill: 'Explosive Concoction', notes: 'any ascendancy' },
    testConfig: 'refused',
  };

  it('passes the run log alone, stopped with no stage, its brief holding the support gem in around', () => {
    passes(stoppedBeforeAgents());
  });

  it('passes AC-W48\'s first command: a test config refused without --offline, the run online, stopped at its first agent step with no stage', () => {
    passes(stoppedBeforeAgents({ ...EC, mode: 'online' }));
  });

  it('passes AC-W48\'s second command: a malformed test config refused with --offline, the run stopped in step 3 with no stage', () => {
    passes(stoppedBeforeAgents({ ...EC, mode: 'offline' }));
  });

  it('fails the refused-config log with a wrong slug, or accepted while online', () => {
    const slug = stoppedBeforeAgents({ ...EC, mode: 'online', slug: 'open' });
    expect(failing(slug)).toMatch(/\[run-log\] run-log\.json slug: is "open"; the brief's slug is "open-explosive-concoction"/);
    const accepted = stoppedBeforeAgents({ ...EC, mode: 'online', testConfig: 'accepted' });
    expect(failing(accepted)).toMatch(/\[run-log\] run-log\.json testConfig: is "accepted" in an online run/);
  });

  it('fails the same log ending completed, which needs the design, the guide and its checks', () => {
    const dir = stoppedBeforeAgents();
    editLog(dir, (l) => (l.status = 'completed'));
    expect(failing(dir)).toMatch(/\[verification\] run-log\.json: status is "completed", but the run doesn't end with its guide's check \(the full pass, or a revision's re-check\)/);
  });
});

describe('AC-W2 (bb): the caps, per brainstorm round and per verification round (D-287, NFR-23)', () => {
  it('fails a brainstorm round with more than 3 R1a entries', () => {
    const dir = copyOf('run-ok');
    editLog(dir, (l) => l.stages.splice(0, 0, step('R1a', null, 1, 'done')));
    expect(failing(dir)).toMatch(/\[caps\] run-log\.json stages\[3\] \(R1a attempt 1\): brainstorm round 1 runs 4 R1a researchers; at most 3 \(NFR-23\)/);
  });

  it('fails a brainstorm round with more than one R1a-assemble', () => {
    const dir = copyOf('run-ok');
    editLog(dir, (l) => l.stages.splice(4, 0, step('R1a-assemble', null, 2, 'done')));
    expect(failing(dir)).toMatch(/\[caps\] run-log\.json stages\[4\] \(R1a-assemble attempt 2\): brainstorm round 1 runs 2 R1a-assemble steps; one deals the round's deck \(D-287, NFR-23\)/);
  });

  it('fails a verification round that compiles more than 3 cards', () => {
    const dir = copyOf('run-ok');
    verified(dir, ['r1-b-1', 'r1-c-1']);
    editLog(dir, (l) => {
      l.checkpoints[0] = { checkpoint: 'brainstorm', visit: 1, answer: 'pick:r1-a-1,r1-a-2,r1-b-1', answeredBy: 'pre-supplied', rule: 'pick:r1-a-1,r1-a-2,r1-b-1' };
      l.stages.splice(6, 0, step('R1b', 'r1-b-1', 1, 'pass', { probes: 0 }), step('R1b', 'r1-c-1', 1, 'pass', { probes: 0 }));
    });
    const stderr = failing(dir);
    expect(stderr).toMatch(/\[caps\] run-log\.json stages\[7\] \(R1b r1-c-1 attempt 1\): verification round 1 compiles 4 cards; at most 3 per verification round \(D-287, NFR-23\)/);
    expect(stderr).toMatch(/\[order\] .*\(R1b r1-c-1 attempt 1\): runs R1b for r1-c-1, which the brainstorm gate's "pick:r1-a-1,r1-a-2,r1-b-1" didn't pick for verification round 1/);
  });

  it('passes a second verification round from one deck, "verify other cards" with no brainstorm, five cards verified in all', () => {
    const dir = copyOf('run-ok');
    verified(dir, ['r1-b-1', 'r1-c-1', 'r1-c-2']);
    editLog(dir, (l) => {
      const at = l.stages.findIndex((s: Json) => s.stage === 'R1b-assemble') + 1;
      l.stages.splice(at, 0, ...['r1-b-1', 'r1-c-1', 'r1-c-2'].map((c) => step('R1b', c, 1, 'pass', { probes: 0 })), step('R1b-assemble', null, 2, 'done'));
      l.checkpoints.splice(1, 0, { checkpoint: 'verification', visit: 1, answer: 'verify:r1-b-1,r1-c-1,r1-c-2', answeredBy: 'pre-supplied', rule: 'verify:r1-b-1,r1-c-1,r1-c-2' });
      l.checkpoints[2].visit = 2;
    });
    passes(dir);
    // A card verified once isn't verified again.
    editLog(dir, (l) => {
      l.checkpoints[1].answer = l.checkpoints[1].rule = 'verify:r1-b-1,r1-c-1,r1-a-2';
      l.stages.find((s: Json) => s.concept === 'r1-c-2' && s.stage === 'R1b').concept = 'r1-a-2';
      l.stages.find((s: Json) => s.concept === 'r1-a-2' && s.stage === 'R1b' && l.stages.indexOf(s) > 8).attempt = 2;
    });
    expect(failing(dir)).toMatch(/\[order\] .*\(R1b r1-a-2 attempt 2\): verifies r1-a-2 again in verification round 2; a card is verified once/);
  });
});

describe("AC-W2 (cc): an escalation's way back is the choice verification; schema 3 retires checkpoint-1 (D-289)", () => {
  /** run-escalated whose escalation the test config answered `answer`, then the verification gate stopped by default. */
  const back = (answer: string) => {
    const dir = copyOf('run-escalated');
    editLog(dir, (l) => {
      l.escalations[0].choice = answer;
      l.checkpoints[cpAt(l, 'escalation')] = { checkpoint: 'escalation', visit: 1, answer, answeredBy: 'pre-supplied', rule: answer };
      l.checkpoints.push({ checkpoint: 'verification', visit: 2, answer: 'stop', answeredBy: 'default', rule: 'no verification answer left: stop' });
      l.status = 'stopped';
    });
    return dir;
  };

  it('passes an escalation answered verification: the run returns to the verification gate, which stops it', () => {
    passes(back('verification'));
  });

  it('fails the retired answer checkpoint-1, in escalations[] and at the escalation question', () => {
    const stderr = failing(back('checkpoint-1'));
    expect(stderr).toMatch(/\[escalation\] run-log\.json escalations\[0\]: choice is "checkpoint-1", which schema 3 retires: going back to the verification gate is the choice "verification" \(D-289\)/);
    expect(stderr).toMatch(/\[run-log\] run-log\.json checkpoints\[2\]: answers "checkpoint-1", which schema 3 retires: going back to the verification gate is "verification" \(D-289\)/);
  });

  it("fails the retired gates and test-config keys: checkpoint 1 in a schema-3 log, and a default rule naming answers.checkpoint1 (D-323)", () => {
    const one = copyOf('run-ok');
    editLog(one, (l) => (l.checkpoints[1].checkpoint = 1));
    expect(failing(one)).toMatch(/\[run-log\] run-log\.json checkpoints\[1\]: checkpoint 1 isn't "brainstorm", "verification", "design", "final", "unsaved-build" or "escalation" \(D-289/);
    const rule = stoppedAtVerification();
    editLog(rule, (l) => (l.checkpoints[1].rule = 'no checkpoint1 answer left: stop'));
    expect(failing(rule)).toMatch(/\[run-log\] run-log\.json checkpoints\[1\]: has rule "no checkpoint1 answer left: stop", which names a retired test-config key or answer/);
  });
});

describe("AC-W2 (dd): each verdict line ends \"Effective HP about <n>.\", the stage's TotalEHP by the rounding rule (D-294)", () => {
  it('fails a verdict line without Effective HP', () => {
    const dir = copyOf('run-ok');
    editText(dir, 'guide.md', replace(' DPS. Effective HP about 31,500.', ' DPS.'));
    expect(failing(dir)).toMatch(/\[verdict-line\] guide\.md:\d+: the Budget verdict line doesn't end with "Effective HP about <n>\.", the stage's TotalEHP beside its max hit: ".*" \(D-294\)/);
  });

  it("fails a wrong Effective HP, and one mis-rounded against TotalEHP at its own last significant digit", () => {
    const wrong = copyOf('run-ok');
    editText(wrong, 'guide.md', replace('Effective HP about 31,500.', 'Effective HP about 41,500.'));
    expect(failing(wrong)).toMatch(/\[verdict-line\] guide\.md:\d+: the Budget verdict line says Effective HP 41,500, but b\.TotalEHP is 31500, which doesn't round to it at that number's last significant digit \(D-283\)/);
    const off = copyOf('run-ok');
    editJson(off, 'compile-record.json', (r) => (r.stages.b.outputs.TotalEHP = 31560));
    expect(failing(off)).toMatch(/the Budget verdict line says Effective HP 31,500, but b\.TotalEHP is 31560/);
    const near = copyOf('run-ok');
    editJson(near, 'compile-record.json', (r) => (r.stages.b.outputs.TotalEHP = 31540));
    passes(near);
  });

  it("fails a record without TotalEHP for a rung's line", () => {
    const dir = copyOf('run-ok-online');
    editJson(dir, 'compile-record.json', (r) => delete r.stages.n.outputs.TotalEHP);
    expect(failing(dir)).toMatch(/\[verdict-line\] guide\.md:\d+: the Non-budget verdict line's Effective HP can't be compared: the record has no value for n\.TotalEHP/);
  });

  it("accepts a schema-2 run's verdict line ending at the DPS, from before D-294 (run-ok-v2)", () => {
    expect(fs.readFileSync(path.join(FIXTURES, V2, 'guide.md'), 'utf8')).not.toContain('Effective HP');
    passes(copyOf(V2));
  });
});

describe("AC-W2 (ee): the D1 gate's recompute and the verdict line read the named damage source's figure × its Count (D-294, D-340)", () => {
  it("passes run-ok-online, whose n rung's named source is below Rolling Slam per copy and above it × its Count of 2", () => {
    const dir = path.join(FIXTURES, 'run-ok-online');
    const n = readJson(dir, 'compile-record.json').stages.n;
    expect([n.skillOutputs.g1s1p1.fields.TotalDPS, n.skillOutputs.g2s1p1.fields.TotalDPS]).toEqual([50000, 60000]);
    expect([n.countedSkillOutputs.g1s1p1.count, n.countedSkillOutputs.g1s1p1.fields.TotalDPS]).toEqual([2, 100000]);
    expect(readJson(dir, 'plan.json').stages.find((s: Json) => s.id === 'n').skills.groups[0]).toEqual(expect.objectContaining({ count: 2, countReason: expect.any(String) }));
    passes(copyOf('run-ok-online'));
  });

  it("fails a gate that says rolledSkill pass when another group × its Count beats the named source, its per-copy figure still below", () => {
    const dir = copyOf('run-ok');
    editPlan(dir, (p) => Object.assign(stageB(p).skills.groups[1], { count: 3, countReason: 'three slams land at once' }));
    editJson(dir, 'compile-record.json', (r) => {
      r.stages.b.countedSkillOutputs.g2s1p1.count = 3;
      r.stages.b.countedSkillOutputs.g2s1p1.fields.TotalDPS = 63000;
    });
    expect(readJson(dir, 'compile-record.json').stages.b.skillOutputs.g2s1p1.fields.TotalDPS).toBe(21000);
    expect(failing(dir)).toMatch(/\[rolled-skill\] reports\/gates\/D1-gate-r1-a-1-a2\.json says rolledSkill: "pass", but the records give "fail": stage b's group 2 \(clear\) has 63000 \(× its Count\), more than the named damage source's group 1's 50000 \(× its Count\) \(D-340\)/);
  });

  it("fails a verdict line quoting the per-copy figure where the record has the figure × Count", () => {
    const dir = copyOf('run-ok-online');
    editText(dir, 'guide.md', replace('Blood Hunt about 100,000 DPS.', 'Blood Hunt about 50,000 DPS.'));
    expect(failing(dir)).toMatch(/\[verdict-line\] guide\.md:\d+: the Non-budget verdict line says DPS 50,000, but n\.measures\.dps \(the main group's TotalDPS × its Count\) is 100000/);
  });

  it("reads the verdict line's DPS from measures.dps, not the gate's figure: a gate naming CombinedDPS passes, a DPS matching neither fails", () => {
    const dir = copyOf('run-ok');
    for (const f of fs.readdirSync(path.join(dir, 'reports/gates')).filter((f) => f.startsWith('D1-gate'))) {
      editJson(dir, `reports/gates/${f}`, (r) => {
        for (const b of r.basis.rolledSkill) for (const x of b.figures) x.figure = x.figure.replace('.TotalDPS', '.CombinedDPS');
      });
    }
    editJson(dir, 'compile-record.json', (r) => {
      for (const st of Object.values(r.stages as Json)) {
        for (const k of ['skillOutputs', 'countedSkillOutputs']) {
          for (const g of Object.values((st[k] ?? {}) as Json)) if (typeof g.fields?.TotalDPS === 'number') g.fields.CombinedDPS = g.fields.TotalDPS * 1.1;
        }
      }
    });
    expect(readJson(dir, lastD1).basis.rolledSkill.find((b: Json) => b.stage === 'b').figures[0].figure).toBe('g1s1p1.CombinedDPS');
    passes(dir);
    // 70,000 is neither measures.dps (50,000) nor the gate's CombinedDPS (55,000).
    editText(dir, 'guide.md', replace('Blood Hunt about 50,000 DPS', 'Blood Hunt about 70,000 DPS'));
    const stderr = failing(dir);
    expect(lines(stderr, 'verdict-line')).toEqual([expect.stringMatching(/the Budget verdict line says DPS 70,000, but b\.measures\.dps \(the main group's TotalDPS × its Count\) is 50000/)]);
  });

  it('reads a figure with no counted copy raw, per copy: a record from before WU-55 (run-ok-v2), and the same field read raw when the counted copy is gone', () => {
    passes(copyOf(V2));
    // Without the counted copies, n's named source is read per copy: 50,000 against Rolling Slam's 60,000.
    const raw = copyOf('run-ok-online');
    editJson(raw, 'compile-record.json', (r) => delete r.stages.n.countedSkillOutputs);
    const stderr = failing(raw);
    expect(stderr).toMatch(/\[rolled-skill\] .*says rolledSkill: "pass", but the records give "fail": stage n's group 2 \(clear\) has 60000, more than the named damage source's group 1's 50000 \(D-340\)/);
  });
});

describe('AC-W2 (ff): the layout holds the cards, the deck and the probe variants, and nothing else there; the log counts each card\'s probes (D-292, D-331, D-338)', () => {
  it("passes the fixtures' cards, cards.md and probes, each probe a one-stage plan with its measure-only record and XML", () => {
    const dir = path.join(FIXTURES, 'run-ok');
    expect(fs.readdirSync(path.join(dir, 'probes', CARD)).sort()).toEqual(['1', '2']);
    expect(fs.readdirSync(path.join(dir, 'probes', CARD, '1')).sort()).toEqual(['compile-record.json', 'compiled-build.xml', 'plan.json']);
    expect(readJson(dir, 'run-log.json').stages.filter((s: Json) => s.stage === 'R1b').map((s: Json) => [s.concept, s.probes])).toEqual([[CARD, 2], ['r1-a-2', 0]]);
    expect(fs.readdirSync(path.join(dir, 'cards')).length).toBe(9);
    passes(copyOf('run-ok'));
  });

  const layoutCases: [string, (d: string) => void, RegExp][] = [
    ['a stray file beside a probe', (d: string) => fs.writeFileSync(path.join(d, 'probes', CARD, '1', 'notes.txt'), ''), /probes\/r1-a-1\/1\/notes\.txt isn't part of the layout/],
    ['a stray file among the cards', (d: string) => fs.writeFileSync(path.join(d, 'cards', 'scratch.txt'), ''), /cards\/scratch\.txt isn't a card file cards\/<id>\.md/],
    ['a card named by a concept id', (d: string) => fs.writeFileSync(path.join(d, 'cards', 'c1.md'), ''), /cards\/c1\.md isn't a card file/],
    ['a probe folder that isn\'t numbered', (d: string) => fs.mkdirSync(path.join(d, 'probes', CARD, 'extra')), /probes\/r1-a-1\/extra isn't a probe variant folder/],
    ['a probe folder for no card id', (d: string) => fs.mkdirSync(path.join(d, 'probes', 'c1')), /probes\/c1 isn't a card's probe folder probes\/<card-id>\//],
    ['a file in probes/', (d: string) => fs.writeFileSync(path.join(d, 'probes', 'list.json'), '[]'), /probes\/list\.json isn't a card's probe folder/],
    ['a probe numbered with a gap', (d: string) => fs.renameSync(path.join(d, 'probes', CARD, '2'), path.join(d, 'probes', CARD, '3')), /probes\/r1-a-1\/ holds variants 1, 3; they are numbered from 1 in run order, with no gap/],
    ['a probe whose record isn\'t measure-only', (d: string) => editJson(d, `probes/${CARD}/1/compile-record.json`, (r) => (r.mode = 'final')), /probes\/r1-a-1\/1\/compile-record\.json is a "final" compile; probe variants compile measure-only \(D-208\)/],
    ['cards.md as a folder', (d: string) => {
      fs.rmSync(path.join(d, 'cards.md'));
      fs.mkdirSync(path.join(d, 'cards.md'));
    }, /cards\.md is a folder; §2 names the file cards\.md/],
  ];
  it.each(layoutCases)('fails %s (layout)', (_name, edit, says) => {
    const dir = copyOf('run-ok');
    edit(dir);
    expect(lines(failing(dir), 'layout')).toContainEqual(expect.stringMatching(says));
  });

  it('fails a card with more than 4 probes, in its folders and in the log (D-292)', () => {
    const dir = copyOf('run-ok');
    for (const n of [3, 4, 5]) fs.cpSync(path.join(dir, 'probes', CARD, '1'), path.join(dir, 'probes', CARD, String(n)), { recursive: true });
    editLog(dir, (l) => (l.stages.find((s: Json) => s.stage === 'R1b' && s.concept === CARD).probes = 5));
    const stderr = failing(dir);
    expect(stderr).toMatch(/\[probes\] probes\/r1-a-1\/ holds 5 probe variants; a card has at most 4 \(D-292\)/);
    expect(stderr).toMatch(/\[probes\] run-log\.json stages\[4\]: R1b r1-a-1 logs 5 probes; a card has at most 4 \(D-292\)/);
  });

  it("fails a log whose probe count isn't the card's probe folders, an R1b entry without its count, and a failed attempt that logs probes (D-338)", () => {
    const fewer = copyOf('run-ok');
    editLog(fewer, (l) => (l.stages.find((s: Json) => s.stage === 'R1b' && s.concept === CARD).probes = 1));
    expect(failing(fewer)).toMatch(/\[probes\] run-log\.json's R1b entries for r1-a-1 log 1 probe\(s\), but probes\/r1-a-1\/ holds 2; the runner logs each R1b return's "probes <n>", every probe run, a probe whose compile failed included \(D-338\)/);
    const unlogged = copyOf('run-ok');
    editLog(unlogged, (l) => delete l.stages.find((s: Json) => s.stage === 'R1b' && s.concept === 'r1-a-2').probes);
    expect(failing(unlogged)).toMatch(/\[run-log\] run-log\.json stages\[5\]: probes is undefined; an R1b entry logs the probe variants its attempt wrote, its return's "probes <n>" \(D-338\)/);
    const failed = copyOf('run-escalated');
    editLog(failed, (l) => (l.stages.find((s: Json) => s.concept === 'r1-c-1').probes = 1));
    expect(failing(failed)).toMatch(/\[probes\] run-log\.json stages\[5\]: R1b r1-c-1 failed, but logs 1 probe\(s\); probes run only after the skeleton's last compile succeeded/);
    const stray = copyOf('run-ok');
    fs.cpSync(path.join(stray, 'probes', CARD), path.join(stray, 'probes', 'r1-b-1'), { recursive: true });
    expect(failing(stray)).toMatch(/\[probes\] probes\/r1-b-1\/ holds 2 probe variant\(s\), but run-log\.json logs no R1b for r1-b-1; only its R1b step writes them \(D-338\)/);
  });

  it("counts a probe whose compile failed: its folder holds only its plan, and the log's count includes it (D-338)", () => {
    const dir = copyOf('run-ok');
    fs.mkdirSync(path.join(dir, 'probes', CARD, '3'));
    fs.copyFileSync(path.join(dir, 'probes', CARD, '1', 'plan.json'), path.join(dir, 'probes', CARD, '3', 'plan.json'));
    expect(failing(dir)).toMatch(/\[probes\] run-log\.json's R1b entries for r1-a-1 log 2 probe\(s\), but probes\/r1-a-1\/ holds 3; the runner logs each R1b return's "probes <n>", every probe run, a probe whose compile failed included \(D-338\)/);
    editLog(dir, (l) => (l.stages.find((s: Json) => s.stage === 'R1b' && s.concept === CARD).probes = 3));
    passes(dir);
  });

  it('fails a card of a brainstorm round the log never ran, and passes it once the log runs that round (D-319)', () => {
    const never = copyOf('run-ok');
    fs.copyFileSync(path.join(never, 'cards', 'r1-c-3.md'), path.join(never, 'cards', 'r2-a-1.md'));
    expect(lines(failing(never), 'layout')).toContainEqual(expect.stringMatching(/cards\/r2-a-1\.md is a card of brainstorm round 2, but run-log\.json runs 1 brainstorm round\(s\); R1a writes a card only in its own round \(§2, D-319\)/));
    // The verification gate answered "more", and round 2's researcher has written its card.
    const ran = stoppedAtVerification();
    fs.copyFileSync(path.join(ran, 'cards', 'r1-c-3.md'), path.join(ran, 'cards', 'r2-a-1.md'));
    editLog(ran, (l) => {
      l.checkpoints[1] = { checkpoint: 'verification', visit: 1, answer: 'more', answeredBy: 'pre-supplied', rule: 'more' };
      l.stages.push(step('R1a', null, 1, 'done'));
      l.status = 'running';
    });
    passes(ran);
  });
});

describe("D-339: a brainstorm round deals 6 to 9 cards and the deck keeps two under-played ones, or the round's R1a-assemble entry says why it is short", () => {
  it("passes run-escalated's short round (5 dealt) with its reason, and fails it without", () => {
    passes(copyOf('run-escalated'));
    const dir = copyOf('run-escalated');
    editLog(dir, (l) => delete l.stages[ESCALATED.assemble].shortReason);
    expect(failing(dir)).toMatch(/\[deck\] cards\.md's round 1 deals 5 card\(s\), and the deck holds 2 under-played card\(s\), short of 6 to 9 dealt and two under-played \(D-339\), but its R1a-assemble entry, run-log\.json stages\[3\], has no shortReason; a short round is accepted only with its reason/);
  });

  it('fails a deck with fewer than two under-played cards and no reason, and passes it with one', () => {
    const dir = copyOf('run-ok');
    editText(dir, 'cards.md', replace(' | under-played (judgment: a block shape few spear builds take)', ''));
    expect(failing(dir)).toMatch(/\[deck\] cards\.md's round 1 deals 7 card\(s\), and the deck holds 1 under-played card\(s\)/);
    editLog(dir, (l) => (l.stages[3].shortReason = "the deck holds one under-played card: the other's link wasn't confirmed"));
    passes(dir);
  });

  it('fails a round that deals more than 9 cards', () => {
    const dir = copyOf('run-ok');
    const extra = ['r1-a-4', 'r1-b-4', 'r1-c-4'];
    for (const id of extra) fs.copyFileSync(path.join(dir, 'cards', 'r1-c-3.md'), path.join(dir, 'cards', `${id}.md`));
    editText(dir, 'cards.md', (t) => t.replace(/- r1-a-3[^\n]*\n/, '').replace(/- r1-b-2[^\n]*\n/, '').replace('## Not dealt\n\n', '## Not dealt\n\nNone.\n').replace(/(- r1-c-3[^\n]*\n)/, `$1${['r1-a-3', 'r1-b-2', ...extra].map((id) => `- ${id} "Another card" | Warrior Titan, Blood Hunt | melee | links confirmed 1 of 1 | evidence: no player evidence\n`).join('')}`));
    expect(failing(dir)).toMatch(/\[deck\] cards\.md's round 1 deals 12 cards; a round deals 6 to 9 \(D-287\)/);
  });

  it("fails a deck without the round's H2, a dealt line that isn't a card of its round, and a card of a dealt round left out of the deck", () => {
    const noRound = copyOf('run-ok');
    editText(noRound, 'cards.md', replace('## Round 1\n', ''));
    expect(failing(noRound)).toMatch(/\[deck\] cards\.md's H2s are \["Not dealt"\]; R1a-assemble writes one "Round <k>" per brainstorm round it dealt, then "Not dealt": \["Round 1","Not dealt"\]/);
    const wrong = copyOf('run-ok');
    fs.copyFileSync(path.join(wrong, 'cards', 'r1-c-3.md'), path.join(wrong, 'cards', 'r2-a-1.md'));
    editText(wrong, 'cards.md', replace('- r1-c-3 ', '- r2-a-1 "Round two" | x\n- r1-c-3 '));
    expect(failing(wrong)).toMatch(/\[deck\] cards\.md:\d+: round 1 deals "r2-a-1", which isn't a card of round 1, r1-<letter>-<n> \(D-319\)/);
    const left = copyOf('run-ok');
    editText(left, 'cards.md', (t) => t.replace(/- r1-b-2[^\n]*\n/, ''));
    expect(failing(left)).toMatch(/\[deck\] cards\/r1-b-2\.md is a card of round 1, which R1a-assemble dealt, but cards\.md neither deals it nor lists it under "Not dealt"/);
  });

  it('fails a missing cards.md once a round was dealt (layout)', () => {
    const dir = copyOf('run-ok');
    fs.rmSync(path.join(dir, 'cards.md'));
    expect(failing(dir)).toMatch(/\[layout\] cards\.md is missing, but R1a-assemble dealt 1 brainstorm round\(s\); it writes the deck there/);
  });
});

describe("D-287: each gate visit's answer, in order, leads to the next step", () => {
  it('fails a gate answer naming no card of the run, and cards verified out of the order picked', () => {
    const none = copyOf('run-ok');
    editLog(none, (l) => (l.checkpoints[0] = { checkpoint: 'brainstorm', visit: 1, answer: 'pick:r1-a-1,r1-a-9', answeredBy: 'pre-supplied', rule: 'pick:r1-a-1,r1-a-9' }));
    expect(failing(none)).toMatch(/\[deck\] run-log\.json checkpoints: the brainstorm gate answered "pick:r1-a-1,r1-a-9", but r1-a-9 is no card of the run/);
    const order = copyOf('run-ok');
    editLog(order, (l) => (l.checkpoints[0] = { checkpoint: 'brainstorm', visit: 1, answer: 'pick:r1-a-2,r1-a-1', answeredBy: 'pre-supplied', rule: 'pick:r1-a-2,r1-a-1' }));
    expect(failing(order)).toMatch(/\[order\] .*\(R1b r1-a-1 attempt 1\): verifies r1-a-1 before r1-a-2; R1b runs the picked cards in the order picked/);
  });

  it("fails a gate visit with no answer, an answer the next step doesn't follow, a step after a stop, and answers left over", () => {
    const unanswered = copyOf('run-ok');
    editLog(unanswered, (l) => (l.checkpoints = l.checkpoints.slice(1)));
    expect(failing(unanswered)).toMatch(/\[order\] .*\(R1b r1-a-1 attempt 1\): follows a visit of the brainstorm gate, but checkpoints\[\] records no brainstorm answer for it/);
    const more = copyOf('run-ok');
    editLog(more, (l) => (l.checkpoints[0] = { checkpoint: 'brainstorm', visit: 1, answer: 'more', answeredBy: 'pre-supplied', rule: 'more' }));
    expect(failing(more)).toMatch(/\[order\] .*: follows the brainstorm gate answered "more", which starts a brainstorm round \(R1a\), not R1b/);
    const stop = copyOf('run-ok');
    editLog(stop, (l) => (l.checkpoints[1] = { checkpoint: 'verification', visit: 1, answer: 'stop', answeredBy: 'default', rule: 'no verification answer left: stop' }));
    expect(failing(stop)).toMatch(/\[order\] .*\(D1-build r1-a-1 attempt 1\): follows the verification gate answered "stop", which ends the run stopped/);
    const extra = copyOf('run-ok');
    editLog(extra, (l) => l.checkpoints.splice(2, 0, { checkpoint: 'verification', visit: 2, answer: 'more', answeredBy: 'pre-supplied', rule: 'more' }));
    expect(failing(extra)).toMatch(/\[order\] run-log\.json: checkpoints\[\] records 1 verification answer\(s\) more than the run visits the verification gate/);
  });

  it("fails a run that ends at a gate whose answer doesn't end it as its status says", () => {
    const dir = stoppedAtVerification();
    editLog(dir, (l) => (l.status = 'completed'));
    expect(failing(dir)).toMatch(/\[order\] run-log\.json: the verification gate answered "stop", which ends the run stopped, but its status is "completed"/);
    const running = stoppedAtVerification();
    editLog(running, (l) => {
      l.checkpoints.pop();
      l.status = 'running';
    });
    passes(running);
  });

  it("fails a pre-supplied rule that isn't a test-config answer of its gate, or doesn't resolve to the recorded answer (D-323)", () => {
    const firstN = copyOf('run-ok');
    editLog(firstN, (l) => (l.checkpoints[0].rule = 'first-n:1'));
    expect(failing(firstN)).toMatch(/\[run-log\] run-log\.json checkpoints\[0\]: answers "pick:r1-a-1,r1-a-2", but its rule "first-n:1" resolves to pick: with at most 1 card\(s\), or stop/);
    const viable = copyOf('run-ok');
    editLog(viable, (l) => (l.checkpoints[0].rule = 'first-viable'));
    expect(failing(viable)).toMatch(/\[run-log\] run-log\.json checkpoints\[0\]: has rule "first-viable", which isn't an answers\.brainstorm value of the test config/);
    const visit = copyOf('run-ok');
    editLog(visit, (l) => (l.checkpoints[1].visit = 2));
    expect(failing(visit)).toMatch(/\[run-log\] run-log\.json checkpoints\[1\]: is visit 2 of "verification", but it is that checkpoint's entry 1/);
  });
});

describe("checkpoints.md: the final gate's last answer gives the run's end status: accept completed, the default stop stopped, any other answer but revise:<text> not-accepted", () => {
  /** A fixture run whose last final-gate visit was answered `final`, and which ends `status`. */
  const ended = (final: Json, status: string, fixture: Fixture = 'run-ok') => {
    const dir = copyOf(fixture);
    editLog(dir, (l) => {
      l.checkpoints[cpAt(l, 'final')] = { checkpoint: 'final', visit: 1, ...final };
      l.status = status;
    });
    return dir;
  };
  const ACCEPT = { answer: 'accept', answeredBy: 'pre-supplied', rule: 'accept' };
  const NOT_ACCEPT = { answer: 'not-accept', answeredBy: 'pre-supplied', rule: 'not-accept' };
  const DEFAULT_STOP = { answer: 'stop', answeredBy: 'default', rule: 'no final answer left: stop' };
  const REVISE = { answer: 'revise:cheaper boots', answeredBy: 'pre-supplied', rule: 'revise:cheaper boots' };
  /** The user's note, in run-ok-online (no test config): anything but accept or changes. */
  const NOTE = { answer: 'too many buttons for me', answeredBy: 'user' };

  it('passes each answer with the status it ends the run with', () => {
    passes(ended(ACCEPT, 'completed'));
    passes(ended(NOT_ACCEPT, 'not-accepted'));
    passes(ended(DEFAULT_STOP, 'stopped'));
    passes(ended(NOTE, 'not-accepted', 'run-ok-online'));
  });

  const mismatches: [string, Json, string, Fixture, RegExp][] = [
    ['accept, ending not-accepted', ACCEPT, 'not-accepted', 'run-ok', /the final gate's last answer is "accept", which ends the run completed, but its status is "not-accepted" \(checkpoints\.md\)/],
    ['accept, ending stopped', ACCEPT, 'stopped', 'run-ok', /the final gate's last answer is "accept", which ends the run completed, but its status is "stopped"/],
    ['not-accept, ending stopped', NOT_ACCEPT, 'stopped', 'run-ok', /the final gate's last answer is "not-accept", which ends the run not-accepted, but its status is "stopped"/],
    ['not-accept, ending completed', NOT_ACCEPT, 'completed', 'run-ok', /status is "completed", but the final gate's last answer is "not-accept"; only an accept at the final gate completes a run/],
    ['the default stop, ending not-accepted', DEFAULT_STOP, 'not-accepted', 'run-ok', /the final gate's last answer is "stop" by default, which ends the run stopped, but its status is "not-accepted"/],
    ['the default stop, ending completed', DEFAULT_STOP, 'completed', 'run-ok', /status is "completed", but the final gate's last answer is "stop"; only an accept at the final gate completes a run/],
    ["the user's note, ending stopped", NOTE, 'stopped', 'run-ok-online', /the final gate's last answer is "too many buttons for me", which ends the run not-accepted, but its status is "stopped"/],
    ["the user's note, ending completed", NOTE, 'completed', 'run-ok-online', /status is "completed", but the final gate's last answer is "too many buttons for me"; only an accept/],
    ['a revision asked for, ending not-accepted', REVISE, 'not-accepted', 'run-ok', /status is "not-accepted", but the final gate's last answer is "revise:cheaper boots"; only an answer at the final gate other than accept, revise:<text> and the default stop ends a run not-accepted/],
  ];
  it.each(mismatches)('fails %s (order)', (_name, final, status, fixture, says) => {
    expect(lines(failing(ended(final, status, fixture)), 'order')).toContainEqual(expect.stringMatching(says));
  });

  it('fails a run ended not-accepted with no final-gate answer', () => {
    const dir = copyOf('run-ok');
    editLog(dir, (l) => {
      l.checkpoints = l.checkpoints.filter((c: Json) => c.checkpoint !== 'final');
      l.status = 'not-accepted';
    });
    expect(failing(dir)).toMatch(/\[order\] run-log\.json: status is "not-accepted", but the final gate's last answer is undefined/);
  });
});

describe("checkpoints.md: each escalation's choice is its escalation question's answer, in order (retry:<guidance> is retry with that guidance)", () => {
  /** run-escalated (its escalation's choice stop) whose escalation question was answered `answer` by the test config. */
  const answered = (answer: string) => {
    const dir = copyOf('run-escalated');
    editLog(dir, (l) => (l.checkpoints[cpAt(l, 'escalation')] = { checkpoint: 'escalation', visit: 1, answer, answeredBy: 'pre-supplied', rule: answer }));
    return dir;
  };
  /** run-escalated whose escalation the test config answered retry:<answered>, logged retry with `guidance`; D1 has re-run once. */
  const retried = (answeredWith: string, guidance: string | undefined) => {
    const dir = copyOf('run-escalated');
    editLog(dir, (l) => {
      l.escalations[0].choice = 'retry';
      if (guidance !== undefined) l.escalations[0].guidance = guidance;
      l.checkpoints[cpAt(l, 'escalation')] = { checkpoint: 'escalation', visit: 1, answer: `retry:${answeredWith}`, answeredBy: 'pre-supplied', rule: `retry:${answeredWith}` };
      l.stages.push(step('D1-build', CARD, 4, 'done'));
      l.status = 'running';
    });
    return dir;
  };

  it('passes the default stop logged as the choice stop (run-escalated), and retry:<guidance> logged as retry with that guidance', () => {
    passes(copyOf('run-escalated'));
    passes(retried('drop the level-1 stage', 'drop the level-1 stage'));
  });

  it.each(['accept', 'verification', 'retry:drop the level-1 stage'])('fails the answer %s logged as the choice stop', (answer) => {
    expect(failing(answered(answer))).toMatch(new RegExp(`\\[escalation\\] run-log\\.json escalations\\[0\\] logs the choice "stop", but checkpoints\\[2\\], escalation answer 1, is "${answer}"; the choice is the answer, and retry:<guidance> is retry with that guidance \\(checkpoints\\.md\\)`));
  });

  it('fails retry logged with other guidance than the answer gave, or with none', () => {
    expect(failing(retried('drop the level-1 stage', 'raise life'))).toMatch(/\[escalation\] run-log\.json escalations\[0\] logs the choice "retry" with guidance "raise life", but checkpoints\[2\], escalation answer 1, is "retry:drop the level-1 stage"/);
    expect(failing(retried('drop the level-1 stage', undefined))).toMatch(/\[escalation\] run-log\.json escalations\[0\] logs the choice "retry" with guidance undefined, but checkpoints\[2\], escalation answer 1, is "retry:drop the level-1 stage"/);
  });

  it('fails an escalation with no escalation answer, and an escalation answer with no escalation', () => {
    const unasked = copyOf('run-escalated');
    editLog(unasked, (l) => (l.checkpoints = l.checkpoints.filter((c: Json) => c.checkpoint !== 'escalation')));
    expect(failing(unasked)).toMatch(/\[escalation\] run-log\.json escalations\[0\] \(D1-gate r1-a-1\) has no escalation answer: checkpoints\[\] records 0 escalation question\(s\); each escalation records its question's answer as checkpoint "escalation", in order/);
    const unlogged = copyOf('run-ok');
    editLog(unlogged, (l) => l.checkpoints.push({ checkpoint: 'escalation', visit: 1, answer: 'stop', answeredBy: 'default', rule: 'no escalation answer left: stop' }));
    expect(failing(unlogged)).toMatch(/\[escalation\] run-log\.json checkpoints\[\] records 1 escalation answer\(s\), but escalations\[\] has 0 entries; each answer is an escalation's/);
  });
});

describe("D-334: an R1b failure whose card's damage source isn't a skill is terminal: no retry, and the card can't be finalized", () => {
  it('passes run-escalated, whose not-a-skill card fails once and the round assembles', () => {
    passes(copyOf('run-escalated'));
  });

  it('fails a retry of the not-a-skill card, and the verification gate finalizing it', () => {
    const retry = copyOf('run-escalated');
    writeJson(retry, 'reports/gates/R1b-r1-c-1-a2.json', { ...readJson(retry, 'reports/gates/R1b-r1-c-1-a1.json'), attempt: 2 });
    editLog(retry, (l) => l.stages.splice(6, 0, step('R1b', 'r1-c-1', 2, 'fail', { probes: 0 })));
    expect(failing(retry)).toMatch(/\[order\] .*\(R1b r1-c-1 attempt 2\): runs R1b for r1-c-1 again, but its last attempt ended not-a-skill with no compile: its damage source isn't a skill, so no retry can compile it \(D-334\)/);
    const finalize = copyOf('run-escalated');
    editLog(finalize, (l) => (l.checkpoints[1].answer = l.checkpoints[1].rule = 'pick:r1-c-1'));
    expect(failing(finalize)).toMatch(/\[order\] .*: follows the verification gate answered "pick:r1-c-1", but r1-c-1's damage source isn't a skill \(its R1b ended not-a-skill\), so it can't be finalized yet \(D-303, D-334\)/);
  });

  it('still re-runs an ordinary compile failure before the round assembles', () => {
    const dir = copyOf('run-escalated');
    editJson(dir, 'reports/gates/R1b-r1-c-1-a1.json', (r) => (r.compiles = 2));
    expect(failing(dir)).toMatch(/\[order\] .*\(R1b-assemble attempt 1\): R1b r1-c-1 failed with retries left, but the round assembles; a failed compile re-runs first/);
  });
});

describe("D-342: an R1b failure whose card's ascendancy doesn't own the node that grants its skill is terminal, and the card can't be finalized", () => {
  /** Explosive Concoction's one source at the pin: the Pathfinder node 38004 (`TreeData/0_5/tree.lua:86216`); no unique grants it. */
  const LOCK = 'Explosive Concoction is granted only by Pathfinder\'s node "Explosive Concoction" (38004)';
  /** r1-c-1 as a Warrior Titan card for Explosive Concoction, which only the Pathfinder can use; R1b left it as R1a wrote it. */
  const CONCOCTION_CARD = [
    '# Card r1-c-1: Concoction slam', '', '## Brainstorm half', '', '### Identity', '',
    '- Class: Warrior', '- Ascendancy: Titan', '- Named damage source: Explosive Concoction', '',
    '### Pitch', '', '- Title: Concoction slam', '- Playstyle: melee, one-button, tanky',
    '- Under-played (judgment): a thrown concoction on a slam warrior, which few builds pair',
    '- Explosive Concoction carries the damage, thrown between slams.', '- It kills rares first and clears packs between them.', '',
    '### Chain', '', '- Damage source: Explosive Concoction, reading its own hit, carried by the skill.', '- Multipliers: none found.',
    '- Enablers: none.', '- Consumes or requires: nothing.', '',
    '### Enabler', '', '- Explosive Concoction: arrives at level 1, by an uncut skill gem.', '- Dormant until then: nothing.', '',
    '### Links', '', '| Link | Game text | Lookup | How PoB follows it | Hidden clauses (theory) | Status |', '|---|---|---|---|---|---|',
    '| Explosive Concoction → hit | "the concoction\'s explosion" | lookup_game_data gem "Explosive Concoction" | modelled | none | confirmed in game text |', '',
    '### Evidence', '', '- Player evidence: no player evidence', '- Reference build: none', '',
    '### Risks so far', '', '- Payoff thieves: none found', '- Placement limits: none found', '- Exposed phase: the throw commits to its target',
    '- Resistant bosses: none found', '', '## Verification half', '',
    ...['Verified', 'Estimates', 'Checklist results', 'Fallback ladder', 'Key item prices'].flatMap((h) => [`### ${h}`, '', 'Not checked yet.', '']),
  ].join('\n');
  /**
   * run-escalated with r1-c-1 an Explosive Concoction card on a Warrior Titan: R1a-assemble held it back under "Not
   * dealt" (wrong-ascendancy), the brainstorm gate picked it anyway, and R1b's ascendancy lock (stages/R1b.md) failed
   * it with no compile. The deck, the card, the dossier and the verdict agree.
   */
  function wrongAscendancy(): string {
    const dir = copyOf('run-escalated');
    fs.writeFileSync(path.join(dir, 'cards', 'r1-c-1.md'), CONCOCTION_CARD);
    editText(dir, 'cards.md', (t) => t.replace(/^- r1-c-1 .*\n/m, '').replace('## Not dealt\n\n', `## Not dealt\n\n- r1-c-1 "Concoction slam" | Warrior Titan, Explosive Concoction | wrong-ascendancy: ${LOCK}\n`));
    editLog(dir, (l) => (l.stages[ESCALATED.assemble].shortReason = '4 of 9 cards passed the identity check and the sniff test'));
    editText(dir, 'dossier.md', (t) => t.replace(/^\| r1-c-1 \|.*$/m, `| r1-c-1 | 1 | failed: ${LOCK}; the card's ascendancy is Titan (D-342) | a thrown concoction on a slam warrior | — | — | — | — | — | not compiled: wrong-ascendancy |`));
    editJson(dir, 'reports/gates/R1b-r1-c-1-a1.json', (r) => {
      r.findings = [{ part: 'compiled', code: 'wrong-ascendancy', message: `${LOCK}; the card's ascendancy is Titan (D-342)` }];
    });
    return dir;
  }
  /** wrongAscendancy() stopped at the verification gate, whose pre-supplied `pick:<id>` resolved to stop: no design ran. */
  function stoppedAtPick(id: string): string {
    const dir = wrongAscendancy();
    editLog(dir, (l) => {
      l.stages = l.stages.slice(0, ESCALATED.d1);
      l.checkpoints = [l.checkpoints[0], { checkpoint: 'verification', visit: 1, answer: 'stop', answeredBy: 'pre-supplied', rule: `pick:${id}` }];
      Object.assign(l, { escalations: [], status: 'stopped', roll: null, outputs: { ...l.outputs, plan: null, record: null } });
    });
    for (const f of ['plan.json', 'compile-record.json', 'compiled-build.xml', ...fs.readdirSync(path.join(dir, 'reports', 'gates')).filter((g) => g.startsWith('D1-gate-')).map((g) => `reports/gates/${g}`)]) {
      fs.rmSync(path.join(dir, f));
    }
    return dir;
  }

  it('the passing copy is consistent: the card, the deck, the dossier and the verdict name Explosive Concoction on a Titan', () => {
    const dir = wrongAscendancy();
    expect(fs.readFileSync(path.join(dir, 'cards.md'), 'utf8')).toMatch(/## Not dealt\n\n- r1-c-1 "Concoction slam" \| Warrior Titan, Explosive Concoction \| wrong-ascendancy: /);
    expect(fs.readFileSync(path.join(dir, 'dossier.md'), 'utf8')).toMatch(/\n\| r1-c-1 \| 1 \| failed: Explosive Concoction is granted only by Pathfinder's node .* \| — \| — \| — \| — \| — \| not compiled: wrong-ascendancy \|\n/);
    expect(readJson(dir, 'reports/gates/R1b-r1-c-1-a1.json')).toEqual(expect.objectContaining({ compiles: 0, recordPath: null, findings: [expect.objectContaining({ code: 'wrong-ascendancy' })] }));
    expect(fs.readFileSync(path.join(dir, 'cards', 'r1-c-1.md'), 'utf8')).not.toMatch(/Melting Maelstrom|not-a-skill|isn't a skill/);
  });

  it('passes a pre-supplied pick of the wrong-ascendancy card that ends the run stopped, an illegal answer (checkpoints.md)', () => {
    passes(stoppedAtPick('r1-c-1'));
  });

  it('fails a pre-supplied pick of a card the gate can finalize turned into a stop', () => {
    expect(failing(stoppedAtPick(CARD))).toMatch(/\[order\] run-log\.json: the verification gate's pre-supplied "pick:r1-a-1" ended the run with "stop", but r1-a-1 can be finalized; a pre-supplied pick stops the run only when its card can't be \(its R1b ended wrong-ascendancy or not-a-skill; D-303, D-342\)/);
  });

  it('passes a run whose wrong-ascendancy card fails once, with no compile, and the round assembles', () => {
    passes(wrongAscendancy());
  });

  it('fails a retry of the wrong-ascendancy card', () => {
    const retry = wrongAscendancy();
    writeJson(retry, 'reports/gates/R1b-r1-c-1-a2.json', { ...readJson(retry, 'reports/gates/R1b-r1-c-1-a1.json'), attempt: 2 });
    editLog(retry, (l) => l.stages.splice(6, 0, step('R1b', 'r1-c-1', 2, 'fail', { probes: 0 })));
    expect(failing(retry)).toMatch(/\[order\] .*\(R1b r1-c-1 attempt 2\): runs R1b for r1-c-1 again, but its last attempt ended wrong-ascendancy with no compile: its ascendancy doesn't own the passive-tree node that grants its skill, so no retry can change it \(D-342\)/);
  });

  it('fails the verification gate finalizing the wrong-ascendancy card, even as a failed card picked anyway', () => {
    const finalize = wrongAscendancy();
    editLog(finalize, (l) => (l.checkpoints[1].answer = l.checkpoints[1].rule = 'pick:r1-c-1'));
    expect(failing(finalize)).toMatch(/\[order\] .*: follows the verification gate answered "pick:r1-c-1", but r1-c-1's ascendancy doesn't own the passive-tree node that grants its skill \(its R1b ended wrong-ascendancy\), so the build it describes can't exist and it can't be finalized \(D-342\)/);
  });

  it('is terminal only with compiles 0: a wrong-ascendancy finding after a compile still re-runs first', () => {
    const dir = wrongAscendancy();
    editJson(dir, 'reports/gates/R1b-r1-c-1-a1.json', (r) => (r.compiles = 1));
    expect(failing(dir)).toMatch(/\[order\] .*\(R1b-assemble attempt 1\): R1b r1-c-1 failed with retries left, but the round assembles; a failed compile re-runs first/);
  });
});

describe('D-326: a schema-2 run, recorded before amendment 3, still checks by its own rules (run-ok-v2)', () => {
  it('holds a schema-2 log: concept ids, checkpoints 1 and 2, a roll set from the start and the slug from the roll', () => {
    const log = fixtureLog(V2);
    expect([log.schemaVersion, log.slug, log.roll, 'brief' in log]).toEqual([2, 'titan-blood-hunt', { ascendancy: 'Titan', skill: 'Blood Hunt' }, false]);
    expect(log.checkpoints.map((c: Json) => c.checkpoint)).toEqual([1, 2]);
    passes(copyOf(V2));
  });

  it("goes back to checkpoint 1 on the escalation choice checkpoint-1, and holds a design to checkpoint 1's pick", () => {
    const dir = copyOf(V2);
    const passing = readJson(dir, 'reports/gates/D1-gate-c1-a2.json');
    const failingV1 = { part: 'v1', code: 'level-points', stage: 'b', message: 'stage b spends too many points' };
    for (const a of [3, 4, 5]) writeJson(dir, `reports/gates/D1-gate-c1-a${a}.json`, { ...passing, attempt: a, verdict: { ...passing.verdict, v1: 'fail' }, findings: [...passing.findings, failingV1] });
    writeJson(dir, 'reports/gates/D1-gate-c2-a1.json', { ...passing, concept: 'c2', attempt: 1, forced: 'infeasible', evidence: 'FI-3 (injected)' });
    editLog(dir, (l) => {
      l.stages.push(step('D1', 'c1', 3, 'done'), step('D1-gate', 'c1', 3, 'fail'), step('D1', 'c1', 4, 'done'), step('D1-gate', 'c1', 4, 'fail'), step('D1', 'c1', 5, 'done'), step('D1-gate', 'c1', 5, 'escalated'), step('D1', 'c2', 1, 'done'), step('D1-gate', 'c2', 1, 'infeasible'));
      l.checkpoints[1] = { checkpoint: 2, visit: 1, answer: 'revise:cheaper boots', answeredBy: 'pre-supplied', rule: 'revise:cheaper boots' };
      l.checkpoints.push({ checkpoint: 'escalation', visit: 1, answer: 'checkpoint-1', answeredBy: 'pre-supplied', rule: 'checkpoint-1' }, { checkpoint: 1, visit: 2, answer: 'pick:c2', answeredBy: 'pre-supplied', rule: 'pick:c2' }, { checkpoint: 1, visit: 3, answer: 'stop', answeredBy: 'default', rule: 'no checkpoint1 answer left: stop' });
      l.escalations.push({ stage: 'D1-gate', concept: 'c1', verdict: 'reports/gates/D1-gate-c1-a5.json', choice: 'checkpoint-1' });
      l.faults.push({ id: 'FI-3', target: { concepts: ['c2'] }, applied: 1, observed: 'forced' });
      l.status = 'stopped';
    });
    passes(dir);
    editLog(dir, (l) => (l.checkpoints[3].answer = 'pick:c1'));
    expect(failing(dir)).toMatch(/\[order\] .*\(D1 c2 attempt 1\): designs c2, but checkpoint 1's pick was c1/);
  });

  it("fails a schema-2 log that uses schema 3's card ids, gates or brief, its R1a-assemble, probe counts or short round's reason, or its cards, deck and probes", () => {
    const dir = copyOf('run-ok');
    editLog(dir, (l) => {
      l.schemaVersion = 2;
      l.stages[3].shortReason = 'only five cards passed';
    });
    const stderr = failing(dir);
    expect(stderr).toMatch(/\[run-log\] run-log\.json brief: is schema 3's parsed brief \(C-51, D-289\); a schema-2 log has none/);
    expect(stderr).toMatch(/\[run-log\] run-log\.json stages\[3\]: stage "R1a-assemble" isn't one of [^\n]*; R1a-assemble is schema 3's \(D-287\), and a schema-2 log has none \(D-326\)/);
    expect(stderr).toMatch(/\[run-log\] run-log\.json stages\[3\]: has shortReason, which schema 3 added \(D-339\); a schema-2 log has none \(D-326\)/);
    expect(stderr).toMatch(/\[run-log\] run-log\.json stages\[4\]: has probes, which schema 3 added \(D-338\); a schema-2 log has none \(D-326\)/);
    expect(stderr).toMatch(/\[run-log\] run-log\.json stages\[4\]: a R1b entry names its concept, the concept id c<n>/);
    for (const [i, gate] of ['brainstorm', 'verification', 'design', 'final'].entries()) {
      expect(stderr).toMatch(new RegExp(`\\[run-log\\] run-log\\.json checkpoints\\[${i}\\]: checkpoint "${gate}" isn't 1, 2, "unsaved-build" or "escalation"`));
    }
    expect(lines(stderr, 'layout').map((l) => /\] (\S+) is part of schema 3's layout \(the cards, the deck and the probes, D-338\); a schema-2 run, recorded before amendment 3, has none \(D-326\)$/.exec(l)?.[1]).filter(Boolean)).toEqual(['cards/', 'cards.md', 'probes/']);
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
    editGuide(dir, replace('## Changelog\n', `${'filler '.repeat(pad)}\n\n## Changelog\n`));
    return dir;
  };

  it('passes a guide of exactly 3,000 counted words, and fails one word more', () => {
    passes(padTo(3000));
    expect(failing(padTo(3001))).toMatch(/\[word-cap\] guide\.md has 3001 words, over the 3000-word cap/);
  });
});

describe('D-276: only the import code is exempt from the no-pipeline-text guard (w)', () => {
  it('names a marker, a confidence label and a finding id, each on its own line of a second fenced block', () => {
    const dir = copyOf('run-ok');
    editText(dir, 'guide.md', replace('## Leveling\n', '```\nsee [^g1]\nI read it as a ceiling (confidence L)\nas v4-1-1 says\n```\n\n## Leveling\n'));
    const at = fs.readFileSync(path.join(dir, 'guide.md'), 'utf8').split('\n').indexOf('see [^g1]') + 1;
    expect(lines(failing(dir), 'guide-markers').map((l) => /guide\.md:(\d+) carries (a footnote marker|the confidence label|the finding id)/.exec(l)?.slice(1))).toEqual([
      [String(at), 'a footnote marker'],
      [String(at + 1), 'the confidence label'],
      [String(at + 2), 'the finding id'],
    ]);
  });
});

describe("D-283: the verdict line's numbers match the record by the rounding rule (x)", () => {
  it('matches a number at its own last significant digit: "5,100" matches 5,136 but not 5,150; "about 400" matches 401.996', () => {
    const near = copyOf('run-ok');
    editJson(near, 'compile-record.json', (r) => (r.stages.b.outputs.PhysicalMaximumHitTaken = 5136));
    rerender(near);
    passes(near);
    const off = copyOf('run-ok');
    editJson(off, 'compile-record.json', (r) => (r.stages.b.outputs.PhysicalMaximumHitTaken = 5150));
    expect(failing(off)).toMatch(/\[verdict-line\] guide\.md:\d+: the Budget verdict line says physical max hit 5,100, but b\.PhysicalMaximumHitTaken is 5150/);
    // The fixture's budget hit: the compiler wrote 402 (D-353), written "about 400".
    expect(readJson(path.join(FIXTURES, 'run-ok'), 'compile-record.json').stages.b.configWritten.enemyPhysicalDamage).toBe(402);
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

/** A copy of run-ok's passing D1 gate verdict, as attempt `attempt`, failing V1 with `finding` (or as is). */
const lastD1 = `reports/gates/D1-gate-${CARD}-a2.json`;
const levelPoints = { part: 'v1', code: 'level-points', stage: 'b', message: 'stage b spends too many points' };
const d1Verdict = (dir: string, attempt: number, finding: Json | null = levelPoints, concept = CARD) => {
  const passing = readJson(path.join(FIXTURES, 'run-ok'), lastD1);
  writeJson(dir, `reports/gates/D1-gate-${concept}-a${attempt}.json`, {
    ...passing, concept, attempt,
    ...(finding ? { verdict: { ...passing.verdict, [finding.part]: 'fail' }, findings: [...passing.findings, finding] } : {}),
  });
};

describe("D-281: the entering-maps rung m is gated like b: its floor at area 69, its budget 5 divines (5.5 with \"near the ceiling\")", () => {
  /** run-ok-online with m's weapon at `amount` divines, the D1 gate's basis giving the rung's new total (the other slots 2.4). */
  const withWeapon = (amount: number) => {
    const dir = copyOf('run-ok-online');
    editPlan(dir, (p) => (p.prices.find((x: Json) => x.id === 'm-weapon').amount = amount));
    editJson(dir, `reports/gates/D1-gate-${CARD}-a1.json`, (g) => (g.basis.budget.totals.find((t: Json) => t.stage === 'm').divines = Math.round((amount + 2.4) * 100) / 100));
    return dir;
  };

  it('passes up to 5, and up to 5.5 with "near the ceiling" in its Checks; above 5.5 fails', () => {
    const at5 = withWeapon(2.6); // 5.0 divines
    rerender(at5);
    passes(at5);
    const near = withWeapon(3.1); // 5.5 divines: the render adds the near-the-ceiling line, which the guide lacks until W1 copies it
    editText(near, 'guide.md', replace('- Budget: 4.4 divines against the 5-divine ceiling.', '- Budget: 5.5 divines against the 5-divine ceiling.'));
    expect(failing(near)).toMatch(/\[budget\] entering-maps stage m totals 5\.5 divines, over 5, but the guide's "Endgame: entering maps" Checks lack "near the ceiling" \(D-281\)/);
    rerender(near);
    expect(fs.readFileSync(path.join(near, 'guide.md'), 'utf8')).toContain('  5.5 divines is near the ceiling: over 5, within the 5.5-divine tolerance.');
    passes(near);
    const over = withWeapon(3.11); // 5.51 divines
    rerender(over);
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
    // The plan lists b before m, all along; the ladder still starts at m (D-282), and FI-2's finding is on m.
    editPlanAll(dir, (p) => {
      const m = p.stages.splice(p.stages.findIndex((s: Json) => s.id === 'm'), 1)[0];
      p.stages.splice(p.stages.findIndex((s: Json) => s.id === 'b') + 1, 0, m);
    });
    // The full pass's accepted-offline locations follow the claims to their stage indices.
    editText(dir, 'reports/V4-1.md', (t) => t.split('stages[2].claims[1] (m-budget)').join('stages[3].claims[1] (m-budget)').split('stages[3].claims[5] (b-meta)').join('stages[2].claims[5] (b-meta)'));
    const tree = { part: 'v1', code: 'tree-disconnected', stage: 'n', message: 'stage n: node 123 not connected' };
    for (const a of [2, 3]) d1Verdict(dir, a, tree);
    d1Verdict(dir, 4, null);
    editLog(dir, (l) => {
      const i = l.stages.findIndex((s: Json) => s.stage === 'D1-gate' && s.attempt === 2);
      l.stages.splice(i, 1, step('D1-gate', CARD, 2, 'fail'), step('D1-build', CARD, 3, 'done'), step('D1-finish', CARD, 3, 'done'), step('D1-gate', CARD, 3, 'fail'), step('D1-build', CARD, 4, 'done'), step('D1-finish', CARD, 4, 'done'), step('D1-gate', CARD, 4, 'pass'));
    });
    rerender(dir);
    // Attempt 1 is free, so attempts 2 and 3 are the chain's 2 counted retries.
    passes(dir);
  });
});

// ---------------------------------------------------------------------------------------------------
// Known issues (S2, Q1): what is open after the re-check
// ---------------------------------------------------------------------------------------------------

describe('D-352, D-276: every finding open in the last report is listed under Known issues, by sentence, with its id in audit.md', () => {
  const dropListing = noneOpen;

  it('needs no listing for a finding the re-check reports fixed: the last report holds what is open', () => {
    const dir = copyOf('run-ok');
    fixedInRecheck(dir);
    dropListing(dir);
    passes(dir);
  });

  it('holds open a new finding the re-check raised, and fails a re-check that drops a finding still open', () => {
    const raised = copyOf('run-ok');
    editText(raised, 'reports/V4-2.md', (t) => `${t}\n### v4-2-1\n\n- status: unresolved\n- hinge: no\n- owner: W1\n- artifact: guide.md\n- location: How to play it, line 97\n- claim: lunge at each one twice\n- issue: no plan claim says two lunges; narrow it\n- evidence: the plan's claims hold no lunge count\n- reader: The advice to lunge twice at each rare isn't from the build: one lunge consumes the Blood Loss.\n`);
    const stderr = failing(raised);
    expect(stderr).toMatch(/\[known-issues\] V4 finding "v4-2-1" .*is open in reports\/V4-2\.md, the last report, but audit\.md's Known issues has no row/);
    expect(stderr).not.toMatch(/"v4-1-1"/);
    const dropped = copyOf('run-ok');
    editText(dropped, 'reports/V4-2.md', (t) => t.replace(/### v4-1-1\n[\s\S]*$/, 'None.\n').replace('- verdict: fail', '- verdict: pass'));
    editLog(dropped, (l) => (l.stages.find((s: Json) => s.stage === 'V4-recheck').outcome = 'pass'));
    expect(lines(failing(dropped), 'recheck')).toContainEqual(expect.stringMatching(/reports\/V4-2\.md doesn't report reports\/V4-1\.md's unresolved finding v4-1-1 again; a re-check reports every finding still open under its id, fixed or unresolved/));
  });

  it('fails when the guide has no Known issues H3 at all', () => {
    const dir = copyOf('run-ok');
    editText(dir, 'guide.md', replace(`### Known issues\n\n- ${PROSE_READER}\n`, ''));
    expect(failing(dir)).toMatch(/\[known-issues\] 0 accepted gate finding\(s\) and 1 open V4 finding\(s\), but guide\.md has no "Known issues" H3 under "What PoB can't show"/);
  });

  it("fails an audit.md row whose sentence isn't the finding's reader sentence, or that names something other than V4", () => {
    const dir = copyOf('run-ok');
    editText(dir, 'audit.md', replace(`| v4-1-1 | V4 | — | ${PROSE_READER} |`, '| v4-1-1 | sources | — | Rotation is wrong. |'));
    const stderr = failing(dir);
    expect(stderr).toMatch(/\[known-issues\] audit\.md:\d+: the Known issues row for "v4-1-1" names "sources"; an open V4 finding's row names V4 \(§7\.8, D-352\)/);
    expect(stderr).toMatch(/\[known-issues\] audit\.md:\d+: the Known issues row for "v4-1-1" gives "Rotation is wrong\.", not the finding's reader sentence/);
  });
});

describe('C-30, stages/V4.md: accepted-offline is only for a claim tagged external-unavailable, in an offline run', () => {
  it('fails a finding accepted-offline in an online run', () => {
    const dir = copyOf('run-ok-online');
    editText(dir, 'reports/V4-1.md', replace('## Findings\n\nNone.\n', '## Findings\n\n### v4-1-1\n\n- status: accepted-offline\n- hinge: no\n- owner: D1\n- artifact: plan.json\n- location: stages[3].claims[5] (b-meta)\n- claim: Spear builds clear T15 maps on a budget this league.\n- issue: tagged external-unavailable\n- evidence: none\n'));
    expect(failing(dir)).toMatch(/\[report-shape\] reports\/V4-1\.md: finding v4-1-1 \(line \d+\) is accepted-offline in an online run; only offline mode accepts external-unavailable \(C-30\)/);
  });

  it('fails a finding accepted-offline whose location names no external-unavailable claim', () => {
    for (const [artifact, location, why] of [
      ['plan.json', 'stages[3].claims[0] (b-life)', /names a pob-computed claim/],
      ['plan.json', 'Summary, line 3', /names no claim/],
      ['plan.json', 'stages[3].claims[5] (b-life)', /names no claim/],
      // D-276: the guide carries no markers, so no guide location is a claim.
      ['guide.md', 'How to play it, line 3', /names no claim/],
    ] as const) {
      const dir = copyOf('run-ok');
      editText(dir, 'reports/V4-1.md', (t) => t.replace('- artifact: plan.json\n- location: stages[3].claims[5] (b-meta)', `- artifact: ${artifact}\n- location: ${location}`));
      const stderr = failing(dir);
      expect(stderr).toMatch(/\[report-shape\] reports\/V4-1\.md: v4-1-3 is accepted-offline/);
      expect(stderr).toMatch(why);
    }
  });
});

// ---------------------------------------------------------------------------------------------------
// The gates: recomputed (Q3), passed once a guide exists, and accepted findings (§5.4, D-236)
// ---------------------------------------------------------------------------------------------------

/**
 * run-ok whose D1 gate escalated on `finding` instead of passing at attempt 2: attempt 1 failed free (FI-2,
 * attempt 1 only), attempts 2 and 3 failed counted, attempt 4 escalated, and the user accepted it. With
 * `listing`, the guide's Known issues prints that sentence, and audit.md's table holds the finding's row (D-276):
 * `row` overrides the row's id, gate and stage cells.
 */
function acceptedRun(finding: Json, listing: string | null, choice = 'accept', row: string | null = null): string {
  const dir = copyOf('run-ok');
  const passing = readJson(dir, lastD1);
  for (const a of [2, 3, 4]) writeJson(dir, `reports/gates/D1-gate-${CARD}-a${a}.json`, { ...passing, attempt: a, verdict: { ...passing.verdict, [finding.part]: 'fail' }, findings: [...passing.findings, finding] });
  editLog(dir, (l) => {
    const i = l.stages.findIndex((s: Json) => s.stage === 'D1-gate' && s.attempt === 2);
    l.stages.splice(i, 1, step('D1-gate', CARD, 2, 'fail'), step('D1-build', CARD, 3, 'done'), step('D1-finish', CARD, 3, 'done'), step('D1-gate', CARD, 3, 'fail'), step('D1-build', CARD, 4, 'done'), step('D1-finish', CARD, 4, 'done'), step('D1-gate', CARD, 4, 'escalated'));
    l.escalations.push({ stage: 'D1-gate', concept: CARD, verdict: `reports/gates/D1-gate-${CARD}-a4.json`, choice });
    l.checkpoints.splice(cpAt(l, 'final'), 0, { checkpoint: 'escalation', visit: 1, answer: choice, answeredBy: 'pre-supplied', rule: choice });
  });
  if (listing !== null) {
    editText(dir, 'guide.md', replace('### Known issues\n\n', `### Known issues\n\n- ${listing}\n`));
    editText(dir, 'audit.md', replace(AUDIT_KI_HEAD, `${AUDIT_KI_HEAD}| ${row ?? `${finding.code} | D1-gate | ${finding.stage}`} | ${listing} |\n`));
  }
  return dir;
}
const LEVEL_POINTS_SENTENCE = 'The budget variant spends more passive points than level 90 allows, so PoB2 shows it over the limit.';
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
    expect(stderr).toMatch(/\[floor\] reports\/gates\/D1-gate-r1-a-1-a2\.json says floor: "fail" \(missing-chaos-resist\), and no accepted finding covers it/);
  });

  it('fails when the last D1 gate honestly says budget: fail (over 22 divines)', () => {
    const dir = copyOf('run-ok-online');
    editPlan(dir, (p) => (p.prices.find((x: Json) => x.id === 'b-weapon').amount = 30));
    editJson(dir, `reports/gates/D1-gate-${CARD}-a1.json`, (r) => {
      r.verdict.budget = 'fail';
      r.findings = [{ part: 'budget', code: 'over-budget', stage: 'b', message: 'stage b totals 43.5 divines' }];
    });
    const stderr = failing(dir);
    expect(stderr).not.toMatch(/says budget: "fail", but/);
    expect(stderr).toMatch(/\[budget\] the guide's concept fails the D1 gate's budget \(over-budget, stage b\): stage b totals 43\.9 divines, above 22/);
  });

  it('fails a run with a guide whose last D2 gate failed V1 with no accepted finding', () => {
    const dir = copyOf('run-ok');
    editJson(dir, `reports/gates/D2-gate-${CARD}-a1.json`, (r) => {
      r.verdict.v1 = 'fail';
      r.findings = [{ part: 'v1', code: 'tree-continuity', stage: '2', message: 'stage 2 drops a node without a respec' }];
    });
    expect(failing(dir)).toMatch(/\[gates\] reports\/gates\/D2-gate-r1-a-1-a1\.json says v1: "fail" \(tree-continuity\), and no accepted finding covers it/);
  });

  it("doesn't compare a D1 gate's other parts when its compile failed (they are unverified)", () => {
    const dir = copyOf('run-escalated');
    editJson(dir, `reports/gates/D1-gate-${CARD}-a3.json`, (r) => {
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
    editLog(dir, (l) => (l.escalations[0].verdict = `reports/gates/D1-gate-${CARD}-a9.json`));
    const stderr = failing(dir);
    expect(stderr).toMatch(/\[escalation\] escalations\[0\]\.verdict is "reports\/gates\/D1-gate-r1-a-1-a9\.json"; it names the escalated attempt's verdict file/);
    expect(stderr).toMatch(/\[record-verdicts\] the final record's stage b fails V1: level-points/);
  });

  it("refuses an accepted compile failure (D-236) and a gate finding marked accepted that no escalation accepted", () => {
    const compile = { part: 'compiled', code: 'compile-error', stage: 'b', message: 'stage b: unknown gem' };
    expect(failing(acceptedRun(compile, null))).toMatch(/\[escalation\] escalations\[0\] accepts reports\/gates\/D1-gate-r1-a-1-a4\.json's compile failure/);
    const dir = copyOf('run-ok');
    editJson(dir, `reports/gates/D2-gate-${CARD}-a1.json`, (r) => r.findings.push({ ...levelPoints, accepted: true }));
    expect(failing(dir)).toMatch(/\[gates\] reports\/gates\/D2-gate-r1-a-1-a1\.json marks finding level-points \(stage b\) accepted, but no escalation accepted it/);
  });
});

describe('D-219 and D-249: budget totals and tree jewels', () => {
  it('rounds the total to 2 decimals before comparing it with 22', () => {
    const dir = copyOf('run-ok-online');
    // 21.4 divines without the jewel, and the jewel 60.4 exalted at 0.01: 22.004, which rounds to 22.
    editPlan(dir, (p) => (p.prices.find((x: Json) => x.id === 'b-jewel').amount = 60.4));
    passes(dir);
  });
});

describe("D-256, D-353: a reference hit the compiler wrote is D-254's formula rounded to 2 decimals, then up to a whole number", () => {
  const setHit = (dir: string, type: string, value: number) => editJson(dir, 'compile-record.json', (r) => (r.stages.b.configWritten[`enemy${type}Damage`] = value));

  it("passes the fixture, whose fire hit is 97 against its formula's 96.4789… at area 79, with no hit_ ledger entry", () => {
    const plan = readJson(path.join(FIXTURES, 'run-ok'), 'plan.json');
    const record = readJson(path.join(FIXTURES, 'run-ok'), 'compile-record.json');
    expect(record.stages.b.configWritten.enemyFireDamage).toBe(97);
    expect(324.19000244141 * (1 + 24 / 100) * (24 / 100)).toBeCloseTo(96.4789, 4);
    expect([stageB(plan).config.scenario.some((o: Json) => o.option === 'enemyFireDamage'), Object.keys(record.ledger).some((k) => k.startsWith('hit_'))]).toEqual([false, false]);
    expect(runChecker(path.join(FIXTURES, 'run-ok')).code).toBe(0);
  });

  it("fails the 2-decimal value D-254 asked for (96.48): PoB's enemy<Type>Damage options take whole numbers", () => {
    const dir = copyOf('run-ok');
    setHit(dir, 'Fire', 96.48);
    expect(failing(dir)).toMatch(/check-run: \[floor\] .*says floor: "pass", but the records give "fail": .*stage b's recorded enemyFireDamage 96\.48 isn't 97: the damage at its area level 79 .* is 96\.48, rounded to 2 decimals and then up \(D-254, D-256, D-353\)/);
  });

  it('fails a hit rounded down (96): the hit is the ceiling, the conservative side of the floor', () => {
    const dir = copyOf('run-ok');
    setHit(dir, 'Fire', 96);
    expect(failing(dir)).toMatch(/\[floor\] .*recorded enemyFireDamage 96 isn't 97/);
  });

  it("passes the physical hit 402, its formula's 401.9956… rounded to 2 decimals and up, and fails 403", () => {
    const dir = copyOf('run-ok');
    expect(readJson(dir, 'compile-record.json').stages.b.configWritten.enemyPhysicalDamage).toBe(402);
    passes(dir);
    setHit(dir, 'Physical', 403);
    expect(failing(dir)).toMatch(/\[floor\] .*recorded enemyPhysicalDamage 403 isn't 402/);
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
    expect(failing(dir)).toMatch(/\[gate-report\] reports\/gates\/D1-gate-r1-a-1-a2\.json: has no basis \{budget: \{rates, slots\}, rolledSkill: \[\.\.\.\]\}/);
  });
});

describe("D-260: the run log's outputs carry no import code; compile-record.json is its one home", () => {
  it('the fixtures name the record and the PoB file, without an import code', () => {
    for (const fixture of [...RUNS, V2]) {
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
      l.stages.find((s: Json) => s.stage === 'D1-finish').priceOutcomes = { ok: 2, maybe: 1 };
      l.stages.find((s: Json) => s.stage === 'W1').priceOutcomes = { ok: 1 };
      l.stages.find((s: Json) => s.stage === 'D1-build').priceOutcomes = { ok: 1 };
    });
    const stderr = failing(dir);
    expect(stderr).toMatch(new RegExp(`\\[run-log\\] run-log\\.json stages\\[${ONLINE.d1finish}\\]\\.priceOutcomes: is \\{<outcome>: <count>\\}`));
    expect(stderr).toMatch(new RegExp(`\\[run-log\\] run-log\\.json stages\\[${ONLINE.w1}\\]: has priceOutcomes, but W1 doesn't price`));
    // D-356: D1-build prices nothing; D1-finish does.
    expect(stderr).toMatch(new RegExp(`\\[run-log\\] run-log\\.json stages\\[${ONLINE.d1}\\]: has priceOutcomes, but D1-build doesn't price`));
  });

  it('fails NFR-22 on a rate_limited or locked_out call', () => {
    const dir = copyOf('run-ok-online');
    editLog(dir, (l) => (l.stages.find((s: Json) => s.stage === 'D1-finish').priceOutcomes = { ok: 11, rate_limited: 1 }));
    expect(failing(dir)).toMatch(new RegExp(`\\[nfr-22\\] run-log\\.json stages\\[${ONLINE.d1finish}\\]: pricing hit 1 rate_limited and 0 locked_out outcome\\(s\\); NFR-22 wants zero of each`));
  });

  it('fails a test config accepted in an online run, and fault directives without one', () => {
    const dir = copyOf('run-ok-online');
    editLog(dir, (l) => (l.testConfig = 'accepted'));
    expect(failing(dir)).toMatch(/\[run-log\] run-log\.json testConfig: is "accepted" in an online run/);
    const dir2 = copyOf('run-ok-online');
    editLog(dir2, (l) => (l.faults = [{ id: 'FI-2', target: { concepts: 'all' }, applied: 1, observed: 'x' }]));
    expect(failing(dir2)).toMatch(/\[run-log\] run-log\.json faults: fault directives apply only in offline test mode/);
  });

  it('fails a fault target naming a concept id in a schema-3 run', () => {
    const dir = copyOf('run-escalated');
    editLog(dir, (l) => (l.faults[0].target.concepts = ['c1']));
    expect(failing(dir)).toMatch(/\[run-log\] run-log\.json faults\[0\]: is \{id: FI-1 \| FI-2 \| FI-3, target: \{concepts: "all" \| \[<card id>, …\], persistent\?\}, applied, observed\}, each id the card id r<round>-<letter>-<n>/);
  });
});

describe("checkpoints[]: a pre-supplied or default answer records its rule, which audit.md's Run notes quote as why this card (D-278)", () => {
  const withCheckpoint = (fixture: 'run-ok' | 'run-ok-online', edit: (c: Json) => void) => {
    const dir = copyOf(fixture);
    editLog(dir, (l) => edit(l.checkpoints[cpAt(l, 'verification')]));
    return dir;
  };

  it("run-ok's pre-supplied finalize records first-viable, the test config's answer as written", () => {
    const log = fixtureLog('run-ok');
    expect(log.checkpoints[cpAt(log, 'verification')]).toEqual({ checkpoint: 'verification', visit: 1, answer: `pick:${CARD}`, answeredBy: 'pre-supplied', rule: 'first-viable' });
  });

  it.each(['pre-supplied', 'default'])('fails a %s answer with no rule', (by) => {
    const dir = withCheckpoint('run-ok', (c) => {
      c.answeredBy = by;
      delete c.rule;
    });
    expect(failing(dir)).toMatch(new RegExp(`check-run: \\[run-log\\] run-log\\.json checkpoints\\[1\\]: is answered "${by}" with no rule`));
  });

  it("fails a user's answer that carries a rule", () => {
    const dir = withCheckpoint('run-ok-online', (c) => (c.rule = 'first-viable'));
    expect(failing(dir)).toMatch(/\[run-log\] run-log\.json checkpoints\[1\]: has a rule, but the user answered/);
  });
});

// ---------------------------------------------------------------------------------------------------
// The control flow (the accepted cost of S1): each invariant passes the fixtures and fails a violating copy
// ---------------------------------------------------------------------------------------------------

/** Writes R1b's verdict file for an attempt: a compile failure on the card's skeleton stage names FI-1's gem. */
function r1bVerdict(dir: string, concept: string, attempt: number, compiled: 'pass' | 'fail', fault: boolean): void {
  const error = { part: 'compiled', code: 'compile-error', stage: skeletonStage(concept), message: `stage ${skeletonStage(concept)}: unknown gem "FI-1 Unknown Gem"` };
  writeJson(dir, `reports/gates/R1b-${concept}-a${attempt}.json`, {
    stage: 'R1b', concept, attempt, verdict: { compiled }, findings: compiled === 'fail' ? [error] : [], errors: compiled === 'fail' ? [error.message] : [], compiles: 1,
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
    expect(failing(dir)).toMatch(new RegExp(`\\[order\\] run-log\\.json stages\\[${RUN_OK.d2 - 1}\\] \\(D2 r1-a-1 attempt 1\\): can't follow D1-finish r1-a-1 attempt 2 \\(outcome "done"\\); SKILL\\.md's step list allows D1-gate next`));
  });

  it('fails an attempt number that skips, since every call counts', () => {
    const dir = copyOf('run-ok');
    editLog(dir, (l) => (l.stages.find((s: Json) => s.stage === 'W1' && s.attempt === 2).attempt = 3));
    expect(failing(dir)).toMatch(new RegExp(`\\[order\\] run-log\\.json stages\\[${RUN_OK.w1Fix}\\] \\(W1 r1-a-1 attempt 3\\): is call 2 of W1 for r1-a-1, so its attempt is 2`));
  });

  it("fails a design of a card the verification gate didn't finalize, and a design switching cards mid-way", () => {
    const dir = copyOf('run-ok');
    editLog(dir, (l) => (l.checkpoints[cpAt(l, 'verification')].answer = 'pick:r1-a-2'));
    expect(failing(dir)).toMatch(new RegExp(`\\[order\\] run-log\\.json stages\\[${RUN_OK.d1}\\] \\(D1-build r1-a-1 attempt 1\\): designs r1-a-1, but the verification gate finalized r1-a-2`));
    const dir2 = copyOf('run-ok');
    editLog(dir2, (l) => (l.stages.find((s: Json) => s.stage === 'D2').concept = 'r1-a-2'));
    expect(failing(dir2)).toMatch(/\[order\] .*\(D2 r1-a-2 attempt 1\): follows the design gate answered "accept", which goes on to r1-a-1's D2, not D2 r1-a-2 \(D-362\)/);
    const dir3 = copyOf('run-ok');
    editLog(dir3, (l) => (l.stages.find((s: Json) => s.stage === 'D2-gate').concept = 'r1-a-2'));
    expect(failing(dir3)).toMatch(/\[order\] .*\(D2-gate r1-a-2 attempt 1\): is about r1-a-2, but the design before it is r1-a-1's/);
  });

  it('fails a brainstorm round no gate answered "more" for (D-287)', () => {
    const dir = copyOf('run-escalated');
    editLog(dir, (l) => l.stages.splice(ESCALATED.assemble + 1, 0, step('R1a', null, 1, 'done'), step('R1a-assemble', null, 2, 'done')));
    expect(failing(dir)).toMatch(/\[order\] .*\(R1a attempt 1\): follows the brainstorm gate answered "pick:r1-a-1,r1-c-1", which starts a verification round \(R1b\), not R1a/);
  });

  it('re-runs a missing return once, uncounted; a second miss ends the run stopped', () => {
    const dir = copyOf('run-ok');
    editLog(dir, (l) => {
      const at = l.stages.findIndex((s: Json) => s.stage === 'D2-gate');
      l.stages.splice(at, 1, step('D2-gate', CARD, 1, 'missing'), step('D2-gate', CARD, 2, 'pass'));
    });
    editJson(dir, `reports/gates/D2-gate-${CARD}-a1.json`, (r) => (r.attempt = 2));
    fs.renameSync(path.join(dir, `reports/gates/D2-gate-${CARD}-a1.json`), path.join(dir, `reports/gates/D2-gate-${CARD}-a2.json`));
    passes(dir);

    const never = copyOf('run-ok');
    editLog(never, (l) => (l.stages.find((s: Json) => s.stage === 'W1' && s.attempt === 2).outcome = 'missing'));
    expect(failing(never)).toMatch(/\[order\] .*\(W1 r1-a-1 attempt 2\): returned without its file and never re-ran/);

    const twice = copyOf('run-escalated');
    restage(twice, ESCALATED.d1, [step('D1-build', CARD, 1, 'missing'), step('D1-build', CARD, 2, 'missing')], (l) => {
      l.status = 'stopped';
      l.escalations = [];
      l.checkpoints = l.checkpoints.slice(0, 2);
    });
    passes(twice);
    editLog(twice, (l) => (l.status = 'completed'));
    expect(failing(twice)).toMatch(/\[order\] .*\(D1-build r1-a-1 attempt 2\): is a second missing return of the step; the run then ends stopped/);
  });

  it('fails a step after an escalation answered stop', () => {
    const dir = copyOf('run-escalated');
    editLog(dir, (l) => l.stages.push(step('D1-build', CARD, 4, 'done')));
    expect(failing(dir)).toMatch(/\[order\] .*\(D1-build r1-a-1 attempt 4\): follows D1-gate r1-a-1's escalation answered "stop", which ends the run escalated/);
  });
});

describe('flow invariant 2: the caps, R1b at most 3 counted attempts and each gate at most 2 counted retries (S6 honoured)', () => {
  it("R1b: a persistent FI-1 fails a card after 3 counted attempts (run A's clause); a 4th attempt breaks the cap", () => {
    const dir = copyOf('run-escalated');
    fs.rmSync(path.join(dir, 'probes'), { recursive: true });
    const base = fixtureLog('run-escalated').stages as Json[];
    const withR1b = (outcomes: string[], persistent: boolean) => {
      outcomes.forEach((o, i) => r1bVerdict(dir, CARD, i + 1, o === 'pass' ? 'pass' : 'fail', true));
      restage(dir, 0, [...base.slice(0, ESCALATED.r1bA), ...outcomes.map((o, i) => step('R1b', CARD, i + 1, o, { probes: 0 })), ...base.slice(ESCALATED.r1bA + 1)], (l) => (l.faults = [l.faults[0], { id: 'FI-1', target: { concepts: [CARD], persistent }, applied: outcomes.length, observed: 'FI-1 Unknown Gem' }]));
    };
    withR1b(['fail', 'fail', 'fail'], true);
    passes(dir);
    withR1b(['fail', 'fail', 'fail', 'fail'], true);
    expect(failing(dir)).toMatch(/\[caps\] .*\(R1b r1-a-1 attempt 4\): is a counted R1b attempt for r1-a-1 after 3; R1b allows 2 counted retries, then the card is failed \(Q2\)/);
    // S6: with FI-1 on attempt 1 only, that attempt re-runs free, so four attempts stay within the cap.
    withR1b(['fail', 'fail', 'fail', 'fail'], false);
    passes(dir);
  });

  it('R1b: a failed compile with retries left re-runs before the next card', () => {
    const dir = copyOf('run-escalated');
    r1bVerdict(dir, CARD, 1, 'fail', false);
    editLog(dir, (l) => Object.assign(l.stages[ESCALATED.r1bA], { outcome: 'fail', probes: 0 }));
    expect(failing(dir)).toMatch(/\[order\] .*\(R1b r1-c-1 attempt 1\): R1b r1-a-1 failed with retries left, but the next R1b is r1-c-1's; a failed compile re-runs first/);
  });

  it("gates: a persistent FI-2 counts every failure, so the third escalates (run B's clause); FI-2 on attempt 1 only makes that failure free (S6)", () => {
    // run-escalated: a persistent FI-2, failures at attempts 1 and 2 (counted), the third escalates.
    passes(copyOf('run-escalated'));
    const free = copyOf('run-escalated');
    editLog(free, (l) => (l.faults[0].target.persistent = false));
    expect(failing(free)).toMatch(/\[caps\] .*\(D1-gate r1-a-1 attempt 3\): escalates after 1 counted retry; a gate escalates only after its 2 counted retries/);
  });

  it('gates: a third counted failure that re-runs the producer breaks the cap', () => {
    const dir = copyOf('run-escalated');
    restage(dir, ESCALATED.d1a3, [step('D1-build', CARD, 3, 'done'), step('D1-finish', CARD, 3, 'done'), step('D1-gate', CARD, 3, 'fail'), step('D1-build', CARD, 4, 'done'), step('D1-finish', CARD, 4, 'done'), step('D1-gate', CARD, 4, 'escalated')], (l) => (l.escalations[0].verdict = `reports/gates/D1-gate-${CARD}-a4.json`));
    fs.copyFileSync(path.join(dir, `reports/gates/D1-gate-${CARD}-a3.json`), path.join(dir, `reports/gates/D1-gate-${CARD}-a4.json`));
    editJson(dir, `reports/gates/D1-gate-${CARD}-a4.json`, (r) => (r.attempt = 4));
    expect(failing(dir)).toMatch(/\[caps\] .*\(D1-gate r1-a-1 attempt 3\): is counted failure 3 of D1-gate for r1-a-1 in one chain, and the producer re-runs again; a gate allows 2 counted retries/);
  });

  it('gates: a guided retry that fails escalates again, it never re-runs the producer (D-236)', () => {
    const dir = copyOf('run-escalated');
    editLog(dir, (l) => {
      l.escalations[0].choice = 'retry';
      l.escalations[0].guidance = 'drop the level-1 stage';
      l.checkpoints[cpAt(l, 'escalation')] = { checkpoint: 'escalation', visit: 1, answer: 'retry:drop the level-1 stage', answeredBy: 'pre-supplied', rule: 'retry:drop the level-1 stage' };
      l.stages.push(step('D1-build', CARD, 4, 'done'), step('D1-finish', CARD, 4, 'done'), step('D1-gate', CARD, 4, 'fail'), step('D1-build', CARD, 5, 'done'), step('D1-finish', CARD, 5, 'done'), step('D1-gate', CARD, 5, 'pass'));
      l.status = 'stopped';
    });
    expect(failing(dir)).toMatch(/\[caps\] .*\(D1-gate r1-a-1 attempt 4\): fails after a guided retry or an accepted re-run, and the producer re-runs; such a failure escalates again/);
  });
});

describe('flow invariant 3 (D-352): one full V4 pass per guide; a fix round or a revision gets one re-check, a revision no full pass', () => {
  const tail = RUN_OK.v4; // run-ok's stages[] index of its full pass, V4

  it('fails a second full pass for one guide where the fix round re-checks', () => {
    const dir = copyOf('run-ok');
    restage(dir, tail + 1, [step('W1', CARD, 2, 'done'), step('V4', CARD, 2, 'fail')]);
    expect(failing(dir)).toMatch(/\[verification\] .*\(V4 r1-a-1 attempt 2\): starts a second full V4 pass for one guide; after the fix round a re-check \(V4-recheck\) covers what changed/);
  });

  it('fails a revision checked with a full pass: a revision runs no full pass (D-352)', () => {
    const dir = copyOf('run-ok-online');
    editLog(dir, (l) => {
      l.stages.push(step('W1', CARD, 2, 'done'), step('V4', CARD, 2, 'pass'));
      const at = cpAt(l, 'final');
      l.checkpoints.splice(at, 0, { checkpoint: 'final', visit: 1, answer: 'revise:name the boots', answeredBy: 'user' });
      l.checkpoints[at + 1].visit = 2;
    });
    expect(failing(dir)).toMatch(/\[verification\] .*\(V4 r1-a-1 attempt 2\): runs a full V4 pass after a revision; a revision runs no full pass/);
  });

  it('fails a re-check with no fix round or revision before it, and a second re-check after one fix round', () => {
    const nofix = copyOf('run-ok-online');
    editLog(nofix, (l) => l.stages.push(step('V4-recheck', CARD, 1, 'pass')));
    expect(failing(nofix)).toMatch(/\[verification\] .*\(V4-recheck r1-a-1 attempt 1\): re-checks with no fix round or revision before it/);
    const twice = copyOf('run-ok');
    editLog(twice, (l) => l.stages.push(step('V4-recheck', CARD, 2, 'fail')));
    expect(failing(twice)).toMatch(/\[verification\] .*\(V4-recheck r1-a-1 attempt 2\): starts a second re-check after one fix round; there is no further round/);
  });

  it('fails a revision no final-gate answer asked for', () => {
    const dir = copyOf('run-ok');
    editLog(dir, (l) => l.stages.push(step('W1', CARD, 3, 'done'), step('V4-recheck', CARD, 2, 'fail')));
    expect(failing(dir)).toMatch(/\[verification\] run-log\.json stages\[\] runs 1 revision\(s\) after the V4 checks, but the final gate was answered revise:<text> 0 time\(s\)/);
  });

  it('passes a revision the final gate asked for: the round copy, the owner, then its re-check of what --changed lists (D-352, A-34)', () => {
    const dir = copyOf('run-ok');
    fs.mkdirSync(path.join(dir, 'rounds', '2'));
    for (const f of ['plan.json', 'compile-record.json', 'guide.md']) fs.copyFileSync(path.join(dir, f), path.join(dir, 'rounds', '2', f));
    editText(dir, 'guide.md', replace('Rolling Slam clears packs, and Blood Hunt takes the rares: lunge at each one twice.', 'Blood Hunt clears packs and takes the rares.'));
    editLog(dir, (l) => {
      l.stages.push(step('W1', CARD, 3, 'done'), step('V4-recheck', CARD, 2, 'pass'));
      const at = cpAt(l, 'final');
      l.checkpoints.splice(at, 0, { checkpoint: 'final', visit: 1, answer: 'revise:say Blood Hunt clears', answeredBy: 'pre-supplied', rule: 'revise:say Blood Hunt clears' });
      l.checkpoints[at + 1].visit = 2;
    });
    fs.writeFileSync(path.join(dir, 'reports', 'V4-3.md'), [
      '# V4-3: re-check of rounds/2', '', `- check: recheck`, `- concept: ${CARD}`, '- mode: offline', '- verdict: pass', '', '## Checked', '', '- section How to play it', '',
      '## Findings', '', '### v4-1-1', '', '- status: fixed', '- hinge: yes', '- owner: W1', '- artifact: guide.md', '- location: How to play it, line 97',
      '- claim: Blood Hunt clears packs and takes the rares.', '- issue: the clear skill is now Blood Hunt', '- evidence: b.g1s1p1.TotalDPS 50000, the clear group\'s largest', '',
    ].join('\n'));
    // Step 14 replaces the lists: with nothing open after the revision's re-check, both say None.
    noneOpen(dir);
    passes(dir);
    // The revision's re-check missed the H2 the revision changed.
    editText(dir, 'reports/V4-3.md', replace('- section How to play it\n', 'None.\n'));
    expect(lines(failing(dir), 'recheck')).toContainEqual(expect.stringMatching(/reports\/V4-3\.md's "## Checked" misses "section How to play it", which check-run\.mjs --changed 2 lists/));
  });

  it("fails a completed run that never re-checked what its full pass found", () => {
    const dir = copyOf('run-ok');
    editLog(dir, (l) => (l.stages = l.stages.slice(0, tail + 1)));
    fs.rmSync(path.join(dir, 'reports', 'V4-2.md'));
    expect(failing(dir)).toMatch(/\[verification\] run-log\.json: status is "completed", but the run doesn't end with its guide's check \(the full pass, or a revision's re-check\) and, when that found anything, the fix round's re-check/);
  });
});

describe('flow invariant 4: only the D1 and D2 gates escalate; verification never does (S2)', () => {
  it('fails a V4 pass logged escalated', () => {
    const dir = copyOf('run-ok');
    editLog(dir, (l) => (l.stages.find((s: Json) => s.stage === 'V4-recheck').outcome = 'escalated'));
    expect(failing(dir)).toMatch(new RegExp(`\\[escalation\\] run-log\\.json stages\\[${RUN_OK.length - 1}\\]: V4-recheck is logged escalated; only the D1 and D2 gates escalate, and verification never does`));
  });

  it('fails an escalation whose stage is not a gate', () => {
    const dir = copyOf('run-escalated');
    editLog(dir, (l) => (l.escalations[0].stage = 'W1'));
    expect(failing(dir)).toMatch(/\[escalation\] run-log\.json escalations\[0\]: stage is "W1"; only the D1 and D2 gates escalate/);
  });

  it('fails an escalated gate attempt with no escalations[] entry, and an entry with no escalated attempt', () => {
    const dir = copyOf('run-escalated');
    editLog(dir, (l) => (l.escalations = []));
    expect(failing(dir)).toMatch(/\[escalation\] .*\(D1-gate r1-a-1 attempt 3\): escalated, but escalations\[\] has no entry 0 for it/);
    const dir2 = copyOf('run-ok');
    editLog(dir2, (l) => l.escalations.push({ stage: 'D1-gate', concept: CARD, verdict: `reports/gates/D1-gate-${CARD}-a1.json`, choice: 'stop' }));
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
    expect(failing(dir)).toMatch(/\[escalation\] run-log\.json: the last step is D1-gate r1-a-1 attempt 3's escalation, answered stop, but the status is "stopped"/);
    const dir2 = copyOf('run-ok');
    editLog(dir2, (l) => (l.status = 'escalated'));
    expect(failing(dir2)).toMatch(/\[escalation\] run-log\.json: status is "escalated", but the run doesn't end with a gate escalation answered stop/);
  });
});

// ---------------------------------------------------------------------------------------------------
// Review of bg/amend-1 (items 1-8, 10): each fix fails the reviewer's probe case and passes the legal routes
// ---------------------------------------------------------------------------------------------------

describe('review 1 (HIGH): the D1 gate is recomputed whenever the record holds its values; only the budget may be unverified', () => {
  it("fails a gate that says every part unverified, routed pass, over failing records (probe p1-unverified)", () => {
    const dir = copyOf('run-ok');
    editJson(dir, lastD1, (r) => (r.verdict = { compiled: 'unverified', v1: 'unverified', v2: 'unverified', floor: 'unverified', budget: 'unverified', rolledSkill: 'unverified' }));
    editJson(dir, 'compile-record.json', (r) => {
      r.stages.b.outputs.MissingFireResist = 25;
      setFigure(r, 'b', 'g2s1p1', 99999);
    });
    const stderr = failing(dir);
    expect(stderr).toMatch(/\[routing\] .*\(D1-gate r1-a-1 attempt 2\): is routed pass, but its verdict fails its compile, V1 or V2 \(or leaves one unverified\)/);
    expect(stderr).toMatch(/\[floor\] reports\/gates\/D1-gate-r1-a-1-a2\.json says floor: "unverified"; only the budget may be unverified/);
    expect(stderr).toMatch(/\[floor\] the guide's concept fails the D1 gate's floor \(missing-fire-resist, stage b\): stage b MissingFireResist is 25/);
    expect(stderr).toMatch(/\[rolled-skill\] the guide's concept fails the D1 gate's rolledSkill \(rolled-not-largest, stage b\)/);
  });

  it("fails a gate that didn't fail its compile but left no record of it", () => {
    const dir = copyOf('run-escalated');
    fs.rmSync(path.join(dir, 'compile-record.json'));
    fs.rmSync(path.join(dir, 'compiled-build.xml'));
    expect(failing(dir)).toMatch(/\[gates\] reports\/gates\/D1-gate-r1-a-1-a3\.json doesn't fail its compile, but compile-record\.json holds no values for the endgame stages/);
  });
});

describe('review 2 (MED): the stat-set check (S7) holds the named damage source to the main skill, directly and in a ledger figure', () => {
  it('(a) fails an endgame or campaign stage whose main group is not its rolledGroup (probe p2-main-not-rolled)', () => {
    const dir = copyOf('run-ok');
    editPlan(dir, (p) => {
      stageB(p).skills.rolledGroup = 2;
      p.stages.find((s: Json) => s.id === '2').skills.main.group = 2;
    });
    const stderr = failing(dir);
    expect(stderr).toMatch(/\[rolled-skill\] the guide's concept fails the D1 gate's rolledSkill \(rolled-not-main, stage b\): stage b's main group is 1, but its named damage source's group \(rolledGroup\) is 2/);
    expect(stderr).toMatch(/\[rolled-skill\] campaign stage 2's main group is 2, but its rolledGroup is 1; a stage with the named damage source makes it the main skill \(S7\)/);
  });

  it("(b) fails a ledger figure whose formula reads another stat set than skills.main's (probe p3-ledger-statset), and passes it on the main set", () => {
    const withLedgerFigure = (statSet: number) => {
      const dir = copyOf('run-ok');
      editPlan(dir, (p) => {
        stageB(p).skills.main.statSet = statSet;
        p.ledger.push({ id: 'bh_b', claim: 'Blood Hunt DPS on b', formula: 'b.g1s1p1.TotalDPS', inputs: [] });
      });
      editJson(dir, 'compile-record.json', (r) => (r.ledger.bh_b = { value: 50000, error: null, computedWithCustomMods: false }));
      editJson(dir, lastD1, (r) => (r.basis.rolledSkill.find((x: Json) => x.stage === 'b').figures[0].figure = 'ledger:bh_b'));
      rerender(dir);
      return dir;
    };
    expect(failing(withLedgerFigure(2))).toMatch(/\[rolled-skill\] .*\(rolled-stat-set, stage b\): stage b's named damage source's figure ledger:bh_b reads b\.g1s1p1, not the main skill's stat set b\.g1s1p2 \(skills\.main\)/);
    passes(withLedgerFigure(1));
  });
});

describe('review 3 (MED): each gate attempt is routed as its verdict file says', () => {
  /** run-escalated stopped at the verification gate after the card's D1 gate attempt 1, logged `outcome` after D1-build claimed `claim`. */
  const routedOnce = (outcome: string, claim = 'done') => {
    const dir = copyOf('run-escalated');
    restage(dir, ESCALATED.d1, [step('D1-build', CARD, 1, claim), step('D1-finish', CARD, 1, 'done'), step('D1-gate', CARD, 1, outcome)], (l) => {
      l.status = 'stopped';
      l.escalations = [];
      l.checkpoints = [...l.checkpoints.slice(0, 2), { checkpoint: 'verification', visit: 2, answer: 'stop', answeredBy: 'default', rule: 'no verification answer left: stop' }];
    });
    return dir;
  };
  const softFailure = (dir: string) => {
    editJson(dir, `reports/gates/D1-gate-${CARD}-a1.json`, (r) => {
      r.verdict = { ...r.verdict, v1: 'pass', floor: 'fail' };
      r.findings = [{ part: 'floor', code: 'missing-cold-resist', stage: 'n', message: 'n.MissingColdResist 12' }];
    });
    editJson(dir, 'compile-record.json', (r) => (r.stages.n.outputs.MissingColdResist = 12));
  };

  it('fails an infeasible route over a V1 failure (probe p4-infeasible-misroute)', () => {
    expect(failing(routedOnce('infeasible'))).toMatch(/\[routing\] .*\(D1-gate r1-a-1 attempt 1\): is routed infeasible, but its verdict fails its compile, V1 or V2 .*; infeasible is FI-3's forced verdict, or a floor, budget or named-damage-source \(rolledSkill\) failure/);
  });

  it('routes a floor failure infeasible only when D1 claimed it, or after 2 counted retries', () => {
    const done = routedOnce('infeasible');
    softFailure(done);
    expect(failing(done)).toMatch(/\[routing\] .*: is routed infeasible, but D1-build claimed done and the gate has 0 counted retries/);
    const claimed = routedOnce('infeasible', 'infeasible');
    softFailure(claimed);
    passes(claimed);
  });

  it("routes a forced verdict infeasible only under FI-3, and never anything else", () => {
    const forced = routedOnce('infeasible');
    editJson(forced, `reports/gates/D1-gate-${CARD}-a1.json`, (r) => Object.assign(r, { forced: 'infeasible', evidence: 'FI-3 (injected)' }));
    expect(failing(forced)).toMatch(/\[routing\] .*: is routed infeasible, but its verdict is forced infeasible, but no FI-3 directive targets this attempt/);
    editLog(forced, (l) => l.faults.push({ id: 'FI-3', target: { concepts: [CARD] }, applied: 1, observed: 'forced' }));
    passes(forced);
    editLog(forced, (l) => (l.stages[l.stages.length - 1].outcome = 'fail'));
    expect(failing(forced)).toMatch(/\[routing\] .*: is routed fail, but reports\/gates\/D1-gate-r1-a-1-a1\.json is forced infeasible \(FI-3\)/);
  });

  it('fails a pass route over a failing verdict, and a gate attempt with no verdict file', () => {
    const dir = copyOf('run-ok');
    editJson(dir, `reports/gates/D2-gate-${CARD}-a1.json`, (r) => {
      r.verdict.v1 = 'fail';
      r.findings = [{ part: 'v1', code: 'tree-continuity', stage: '2', message: 'stage 2 drops a node' }];
    });
    expect(failing(dir)).toMatch(/\[routing\] .*\(D2-gate r1-a-1 attempt 1\): is routed pass, but its verdict fails its compile, V1 or V2/);
    const gone = copyOf('run-ok');
    fs.rmSync(path.join(gone, 'reports/gates/R1b-r1-a-2-a1.json'));
    expect(failing(gone)).toMatch(/\[routing\] .*\(R1b r1-a-2 attempt 1\): has no verdict file reports\/gates\/R1b-r1-a-2-a1\.json; a gate step writes its own/);
  });
});

describe("review 4 (MED): S6's free retry needs the verdict's faultsApplied and a failure on the faulted stage", () => {
  /** run-escalated with FI-2 on attempt 1 only: a free attempt 1 leaves the escalation at attempt 3 after 1 counted retry. */
  const freeFirst = (edit: (r: Json) => void) => {
    const dir = copyOf('run-escalated');
    editLog(dir, (l) => (l.faults[0].target.persistent = false));
    editJson(dir, `reports/gates/D1-gate-${CARD}-a1.json`, edit);
    return dir;
  };

  it('grants it when the verdict names FI-2 and fails only on its stage: the escalation then comes too early', () => {
    expect(failing(freeFirst(() => undefined))).toMatch(/\[caps\] .*\(D1-gate r1-a-1 attempt 3\): escalates after 1 counted retry/);
  });

  it("doesn't grant it without FI-2 in faultsApplied, or for a failure on another stage: attempt 1 counts", () => {
    passes(freeFirst((r) => (r.faultsApplied = [])));
    passes(freeFirst((r) => r.findings.push({ part: 'v1', code: 'tree-disconnected', stage: 'n', message: 'stage n: node 123 not connected' })));
  });

  it('counts a real failure the faults list alone would have freed (probe p5-s6-free-real-failure)', () => {
    const dir = copyOf('run-ok');
    const tree = { part: 'v1', code: 'tree-disconnected', stage: 'n', message: 'stage n: node 123 not connected' };
    editJson(dir, `reports/gates/D1-gate-${CARD}-a1.json`, (r) => {
      r.findings = [tree];
      r.faultsApplied = [];
    });
    for (const a of [2, 3]) d1Verdict(dir, a, tree);
    d1Verdict(dir, 4, null);
    editLog(dir, (l) => {
      const i = l.stages.findIndex((s: Json) => s.stage === 'D1-gate' && s.attempt === 2);
      l.stages.splice(i, 1, step('D1-gate', CARD, 2, 'fail'), step('D1-build', CARD, 3, 'done'), step('D1-finish', CARD, 3, 'done'), step('D1-gate', CARD, 3, 'fail'), step('D1-build', CARD, 4, 'done'), step('D1-finish', CARD, 4, 'done'), step('D1-gate', CARD, 4, 'pass'));
    });
    expect(failing(dir)).toMatch(/\[caps\] .*\(D1-gate r1-a-1 attempt 3\): is counted failure 3 of D1-gate for r1-a-1 in one chain/);
  });
});

describe('review 5 (MED): the log says which artifacts are current; legal routes pass once a guide exists', () => {
  /**
   * run-ok after its first cycle: a revision the final gate asked for, of D1 (D1-finish first, which recompiled), whose
   * gate fails twice, D1 re-running with both steps, then escalates.
   */
  const revisionEscalates = (choice: string) => {
    const dir = copyOf('run-ok');
    for (const a of [3, 4, 5]) d1Verdict(dir, a);
    editLog(dir, (l) => {
      l.stages.push(step('D1-finish', CARD, 3, 'done'), step('D1-gate', CARD, 3, 'fail'), step('D1-build', CARD, 3, 'done'), step('D1-finish', CARD, 4, 'done'), step('D1-gate', CARD, 4, 'fail'), step('D1-build', CARD, 4, 'done'), step('D1-finish', CARD, 5, 'done'), step('D1-gate', CARD, 5, 'escalated'));
      l.checkpoints[cpAt(l, 'final')] = { checkpoint: 'final', visit: 1, answer: 'revise:cheaper boots', answeredBy: 'pre-supplied', rule: 'revise:cheaper boots' };
      l.checkpoints.push({ checkpoint: 'escalation', visit: 1, answer: choice, answeredBy: choice === 'stop' ? 'default' : 'pre-supplied', rule: choice === 'stop' ? 'no escalation answer left: stop' : choice });
      l.escalations.push({ stage: 'D1-gate', concept: CARD, verdict: `reports/gates/D1-gate-${CARD}-a5.json`, choice });
      l.status = 'escalated';
    });
    return dir;
  };

  it('passes a revision whose D1 gate escalates to a stop: the guide is from before it (probe p8-fixround-escalation-stop)', () => {
    passes(revisionEscalates('stop'));
  });

  it("passes the run going back to the verification gate and another card's design: the guide is the first card's (probe p7-stale-guide-false-reject)", () => {
    const dir = revisionEscalates('verification');
    d1Verdict(dir, 1, null, 'r1-a-2');
    editJson(dir, 'reports/gates/D1-gate-r1-a-2-a1.json', (r) => Object.assign(r, { forced: 'infeasible', evidence: 'FI-3 (injected)' }));
    editLog(dir, (l) => {
      l.stages.push(step('D1-build', 'r1-a-2', 1, 'done'), step('D1-finish', 'r1-a-2', 1, 'done'), step('D1-gate', 'r1-a-2', 1, 'infeasible'));
      l.checkpoints.push({ checkpoint: 'verification', visit: 2, answer: 'pick:r1-a-2', answeredBy: 'pre-supplied', rule: 'pick:r1-a-2' }, { checkpoint: 'verification', visit: 3, answer: 'stop', answeredBy: 'default', rule: 'no verification answer left: stop' });
      l.faults.push({ id: 'FI-3', target: { concepts: ['r1-a-2'] }, applied: 1, observed: 'forced' });
      l.status = 'stopped';
    });
    passes(dir);
  });

  it('fails a completed run whose guide is older than the design steps after it', () => {
    const dir = revisionEscalates('stop');
    editLog(dir, (l) => (l.status = 'completed'));
    expect(failing(dir)).toMatch(/\[layout\] status is "completed", but guide\.md is from W1 r1-a-1 attempt 2, and design steps ran after it/);
  });
});

describe('review 6, as D-352 amends it: a fix round whose owner recompiled re-checks only what --changed lists, its moved record values included', () => {
  /** run-ok whose fix round runs D1 (D1-finish, recompiling) → D1 gate → D2 gate → W1 instead of W1 alone, then re-checks. */
  const designFix = () => {
    const dir = copyOf('run-ok');
    d1Verdict(dir, 3, null);
    fs.copyFileSync(path.join(dir, `reports/gates/D2-gate-${CARD}-a1.json`), path.join(dir, `reports/gates/D2-gate-${CARD}-a2.json`));
    editJson(dir, `reports/gates/D2-gate-${CARD}-a2.json`, (r) => (r.attempt = 2));
    restage(dir, RUN_OK.w1Fix, [step('D1-finish', CARD, 3, 'done'), step('D1-gate', CARD, 3, 'pass'), step('D2-gate', CARD, 2, 'pass'), step('W1', CARD, 2, 'done'), step('V4-recheck', CARD, 1, 'fail')]);
    return dir;
  };

  it('passes the re-check of what changed: a gate re-ran, and no re-check covers every claim (D-352)', () => {
    passes(designFix());
  });

  it("fails a re-check that misses a claim whose cited record value the recompile moved", () => {
    const dir = designFix();
    editJson(dir, 'compile-record.json', (r) => (r.stages.b.outputs.Life = 4300));
    rerender(dir);
    expect(lines(failing(dir), 'recheck')).toContainEqual(expect.stringMatching(/reports\/V4-2\.md's "## Checked" misses "claim stages\[3\]\.claims\[0\] \(b-life\)", which check-run\.mjs --changed 1 lists \(it changed since rounds\/1\/\)/));
    editText(dir, 'reports/V4-2.md', replace('- section How to play it\n', '- claim stages[3].claims[0] (b-life)\n- section How to play it\n'));
    passes(dir);
  });
});

describe("review 7 (LOW), as D-353 amends it: each recorded reference hit is the damage at its variant's area level (D-254, D-256)", () => {
  it("fails a hit derived from another level's damage (probe p6-d256-tiny-hits), the [ledger] rule untouched", () => {
    const dir = copyOf('run-ok');
    editJson(dir, 'compile-record.json', (r) => (r.stages.b.configWritten.enemyPhysicalDamage = Math.ceil(9.1599998474121 * 1.24)));
    const stderr = failing(dir);
    expect(stderr).toMatch(/\[floor\] .*\(reference-hit-ledger-physical, stage b\): stage b's recorded enemyPhysicalDamage 12 isn't 402: the damage at its area level 79 \(enemies\/map-monsters\.json#damage\.by-level\[79\], 324\.19\d*\) × \(1 \+ 24 \/ 100\) is 402/);
    expect(stderr).not.toMatch(/\[ledger\]/);
  });
});

describe('review 8 (LOW): a completed run ends with the final gate answered accept', () => {
  it('fails a completed run with no final-gate accept (probe p9-completed-without-accept)', () => {
    const dir = copyOf('run-ok');
    editLog(dir, (l) => (l.checkpoints = l.checkpoints.filter((c: Json) => c.checkpoint !== 'final')));
    expect(failing(dir)).toMatch(/\[order\] run-log\.json: status is "completed", but the final gate's last answer is undefined; only an accept at the final gate completes a run/);
  });
});

describe('review 10 (LOW): a guided retry gives the producer one more attempt, then its gate; any failure escalates again', () => {
  it('fails a guided retry whose gate failure is routed infeasible instead of escalating', () => {
    const dir = copyOf('run-escalated');
    d1Verdict(dir, 4, { part: 'floor', code: 'missing-cold-resist', stage: 'n', message: 'n.MissingColdResist 12' });
    editLog(dir, (l) => {
      l.escalations[0].choice = 'retry';
      l.escalations[0].guidance = 'drop the level-1 stage';
      l.checkpoints[cpAt(l, 'escalation')] = { checkpoint: 'escalation', visit: 1, answer: 'retry:drop the level-1 stage', answeredBy: 'pre-supplied', rule: 'retry:drop the level-1 stage' };
      l.stages.push(step('D1-build', CARD, 4, 'done'), step('D1-finish', CARD, 4, 'done'), step('D1-gate', CARD, 4, 'infeasible'));
      l.status = 'stopped';
    });
    expect(failing(dir)).toMatch(/\[routing\] .*\(D1-gate r1-a-1 attempt 4\): is routed infeasible, but a guided retry that fails escalates again/);
  });
});

describe("W19: run B's failure routes pass the checker with no --partial (no viable card, FI-3, a D1 gate escalation stopped by default)", () => {
  it('passes R1b failing every picked card under a persistent FI-1, the first finalized card forced infeasible, the second escalating on a persistent FI-2', () => {
    const dir = copyOf('run-escalated');
    const picked = [CARD, 'r1-a-2', 'r1-c-2'];
    fs.rmSync(path.join(dir, 'probes'), { recursive: true });
    fs.rmSync(path.join(dir, 'reports/gates/R1b-r1-c-1-a1.json'));
    for (const c of picked) for (const a of [1, 2, 3]) r1bVerdict(dir, c, a, 'fail', true);
    for (const a of [2, 3]) fs.rmSync(path.join(dir, `reports/gates/D1-gate-${CARD}-a${a}.json`));
    for (const a of [1, 2, 3]) {
      writeJson(dir, `reports/gates/D1-gate-r1-a-2-a${a}.json`, { ...readJson(path.join(FIXTURES, 'run-escalated'), `reports/gates/D1-gate-${CARD}-a${a}.json`), concept: 'r1-a-2' });
    }
    editJson(dir, `reports/gates/D1-gate-${CARD}-a1.json`, (r) => Object.assign(r, { forced: 'infeasible', evidence: 'FI-3 (injected)', faultsApplied: [{ id: 'FI-3', observed: 'gate run as usual; outcome forced to infeasible' }] }));
    editText(dir, 'dossier.md', (t) => t.replace(/^\| r1-c-1 \|.*$/m, ['r1-a-2', 'r1-c-2'].map((c) => `| ${c} | 1 | failed after 3 attempts: unknown gem "FI-1 Unknown Gem"; reports/gates/R1b-${c}-a3.json | Rolling Slam aftershocks | — | — | — | — | — | the compile |`).join('\n')));
    const r1bs = picked.flatMap((c) => [1, 2, 3].map((a) => step('R1b', c, a, 'fail', { probes: 0 })));
    const base = fixtureLog('run-escalated').stages as Json[];
    restage(dir, 0, [
      ...base.slice(0, ESCALATED.assemble + 1), ...r1bs, step('R1b-assemble', null, 1, 'done'),
      step('D1-build', CARD, 1, 'done'), step('D1-finish', CARD, 1, 'done'), step('D1-gate', CARD, 1, 'infeasible'),
      ...[1, 2, 3].flatMap((a) => [step('D1-build', 'r1-a-2', a, 'done'), step('D1-finish', 'r1-a-2', a, 'done'), step('D1-gate', 'r1-a-2', a, a === 3 ? 'escalated' : 'fail')]),
    ], (l) => {
      l.checkpoints = [
        { checkpoint: 'brainstorm', visit: 1, answer: `pick:${picked.join(',')}`, answeredBy: 'pre-supplied', rule: `pick:${picked.join(',')}` },
        { checkpoint: 'verification', visit: 1, answer: `pick:${CARD}`, answeredBy: 'pre-supplied', rule: `pick:${CARD}` },
        { checkpoint: 'verification', visit: 2, answer: 'pick:r1-a-2', answeredBy: 'pre-supplied', rule: 'pick:r1-a-2' },
        { checkpoint: 'escalation', visit: 1, answer: 'stop', answeredBy: 'default', rule: 'no escalation answer left: stop' },
      ];
      l.escalations = [{ stage: 'D1-gate', concept: 'r1-a-2', verdict: 'reports/gates/D1-gate-r1-a-2-a3.json', choice: 'stop' }];
      l.faults = [
        { id: 'FI-1', target: { concepts: 'all', persistent: true }, applied: 9, observed: 'each R1b compile failed on FI-1 Unknown Gem' },
        { id: 'FI-3', target: { concepts: [CARD] }, applied: 1, observed: `${CARD}'s D1 gate forced infeasible` },
        { id: 'FI-2', target: { concepts: ['r1-a-2'], persistent: true }, applied: 3, observed: "each of r1-a-2's D1 gates found V1 level-points on stage b" },
      ];
    });
    passes(dir);
  });
});

// ---------------------------------------------------------------------------------------------------
// D-264: the fix round fixes claims in place; only a recompile re-runs the gates and the full re-check
// ---------------------------------------------------------------------------------------------------

describe('D-264, D-352: a claims-only fix round edits claims in place, runs no gate, and re-checks what --changed lists', () => {
  /**
   * run-ok whose fix round is a claims-only D1-finish (its claims edited in place, nothing compiled, so the record
   * keeps the final compile's planSha1 and buildSha1), then the audit render and W1 patching the guide, then the
   * re-check, whose Checked lists the edited claims beside the changed H2 (`checked`).
   */
  const claimsOnly = (planEdit: (p: Json) => void = (p) => (stageB(p).claims[0].text += ' (fixed in place)'), checked = ['claim stages[3].claims[0] (b-life)']) => {
    const dir = copyOf('run-ok');
    editJson(dir, 'plan.json', planEdit);
    restage(dir, RUN_OK.w1Fix, [step('D1-finish', CARD, 3, 'claims-edited'), step('W1', CARD, 2, 'done'), step('V4-recheck', CARD, 1, 'fail')]);
    if (checked.length > 0) editText(dir, 'reports/V4-2.md', replace('## Checked\n\n', `## Checked\n\n${checked.map((c) => `- ${c}\n`).join('')}`));
    rerender(dir);
    return dir;
  };

  it('passes D1-finish → W1 → the re-check: the plan differs from the record only in its claims, sources and tags', () => {
    const dir = claimsOnly((p) => {
      stageB(p).claims[0].text += ' (fixed in place)';
      stageB(p).claims[1].source = { kind: 'judgment', ref: 'recited', confidence: 'M' };
      stageB(p).config.scenario[0].tag = { ...stageB(p).config.scenario[0].tag, ref: 'recited' };
    }, ['claim stages[3].claims[0] (b-life)', 'claim stages[3].claims[1] (b-bloodloss)']);
    expect(sha1(fs.readFileSync(path.join(dir, 'plan.json')))).not.toBe(readJson(dir, 'compile-record.json').planSha1);
    passes(dir);
  });

  it("fails a claims-only round's re-check that misses an edited claim --changed lists (AC-W54)", () => {
    const dir = claimsOnly(undefined, []);
    expect(lines(failing(dir), 'recheck')).toContainEqual(expect.stringMatching(/reports\/V4-2\.md's "## Checked" misses "claim stages\[3\]\.claims\[0\] \(b-life\)", which check-run\.mjs --changed 1 lists/));
  });

  it("item 1 (D-266): fails a claims-only round that swapped gear, added a gem, dropped a tree node or changed the config (the review's run-gearswap)", () => {
    const swaps: [string, (p: Json) => void][] = [
      ['item', (p) => (stageB(p).items.slots.find((x: Json) => x.slot === 'Body Armour').text = "Rarity: Unique\nKaom's Heart\nClaimed Body\n+500 to maximum Life")],
      ['gem', (p) => stageB(p).skills.groups[0].gems.push({ name: 'Martial Tempo', level: 20, quality: 0, enabled: true })],
      ['tree', (p) => (stageB(p).tree.nodes = stageB(p).tree.nodes.slice(1))],
      ['config', (p) => (stageB(p).config.scenario.find((o: Json) => o.option === 'enemyIsBoss').value = 'Boss')],
      ['anoint', (p) => (stageB(p).items.anoint.notable = 'Heavy Buffer')],
    ];
    for (const [what, swap] of swaps) {
      const stderr = failing(claimsOnly((p) => {
        stageB(p).claims[0].text += ' (fixed in place)';
        swap(p);
      }));
      expect({ what, line: lines(stderr, 'record-plan').some((l) => /D1-finish r1-a-1 attempt 3 edited claims without a compile \(claims-edited\), but plan\.json's build changed: the sha1 of its build-affecting part \(everything but stages\[\]\.claims, the ledger and the source and tag fields\) is [0-9a-f]{40}, and the final record's buildSha1 is "[0-9a-f]{40}"; only a recompile changes the build: gear, tree, gems or config \(D-264, D-266, D-352\)/.test(l)) }).toEqual({ what, line: true });
    }
  });

  it("item 1: a record without buildSha1 (from before D-266) is a violation only when a claims-only owner ran", () => {
    const old = copyOf('run-ok');
    editJson(old, 'compile-record.json', (r) => delete r.buildSha1);
    passes(old);
    const claims = claimsOnly();
    editJson(claims, 'compile-record.json', (r) => delete r.buildSha1);
    expect(failing(claims)).toMatch(/\[record-plan\] D1-finish r1-a-1 attempt 3 edited claims without a compile \(claims-edited\), but the final record has no buildSha1 to hold the plan's build to \(D-266\)/);
  });

  it("fails a claims-only owner that compiled: the record is no longer the last D2 gate's final compile", () => {
    const measured = claimsOnly();
    editJson(measured, 'compile-record.json', (r) => (r.mode = 'measure-only'));
    expect(failing(measured)).toMatch(/\[record-plan\] D1-finish r1-a-1 attempt 3 edited claims without a compile \(claims-edited\), but compile-record\.json is a "measure-only" record, not the final compile of D2-gate r1-a-1 attempt 1/);
    const other = claimsOnly();
    editJson(other, 'compile-record.json', (r) => (r.pobFile.path = 'titan-blood-hunt-2026-10-08-9.xml'));
    expect(failing(other)).toMatch(/\[record-plan\] .*but the final record's PoB file "titan-blood-hunt-2026-10-08-9\.xml" isn't "titan-blood-hunt-2026-10-08-1\.xml", the one D2-gate r1-a-1 attempt 1 wrote/);
  });

  it('a claims-only owner runs no gate, and only before any gate of its round', () => {
    // A D1 gate after a claims-only D1-finish.
    const gated = copyOf('run-ok');
    d1Verdict(gated, 3, null);
    restage(gated, RUN_OK.w1Fix, [step('D1-finish', CARD, 3, 'claims-edited'), step('D1-gate', CARD, 3, 'pass'), step('W1', CARD, 2, 'done'), step('V4-recheck', CARD, 1, 'fail')]);
    expect(failing(gated)).toMatch(/\[order\] .*\(D1-gate r1-a-1 attempt 3\): can't follow D1-finish r1-a-1 attempt 3 \(outcome "claims-edited"\); SKILL\.md's step list allows D2, W1 next/);
    // A claims-only D2 after the D1 gate re-ran: the D1 gate's compile replaced the final record, so D2 runs its gate.
    const late = copyOf('run-ok');
    d1Verdict(late, 3, null);
    restage(late, RUN_OK.w1Fix, [step('D1-finish', CARD, 3, 'done'), step('D1-gate', CARD, 3, 'pass'), step('D2', CARD, 2, 'claims-edited'), step('W1', CARD, 2, 'done')]);
    expect(failing(late)).toMatch(/\[order\] .*\(D2 r1-a-1 attempt 2\): edits claims without a compile \(claims-edited\), which an owner does only in the fix round or a revision, before any gate of it re-runs \(D-264\)/);
    // The first D1-finish of a design is never claims-only.
    const first = copyOf('run-ok');
    editLog(first, (l) => (l.stages[RUN_OK.d1 + 1].outcome = 'claims-edited'));
    expect(failing(first)).toMatch(/\[order\] .*\(D1-finish r1-a-1 attempt 1\): edits claims without a compile/);
  });

  it('passes D1-finish claims-only, then D2 recompiling: its gate runs the final compile again, and the re-check covers what changed', () => {
    const dir = copyOf('run-ok');
    fs.copyFileSync(path.join(dir, `reports/gates/D2-gate-${CARD}-a1.json`), path.join(dir, `reports/gates/D2-gate-${CARD}-a2.json`));
    editJson(dir, `reports/gates/D2-gate-${CARD}-a2.json`, (r) => (r.attempt = 2));
    restage(dir, RUN_OK.w1Fix, [step('D1-finish', CARD, 3, 'claims-edited'), step('D2', CARD, 2, 'done'), step('D2-gate', CARD, 2, 'pass'), step('W1', CARD, 2, 'done'), step('V4-recheck', CARD, 1, 'fail')]);
    passes(dir);
  });
});

describe("AC-W59 (D-352): a ledger-only edit after the final compile passes [record-plan] and [ledger]; a gear edit still fails", () => {
  /** run-ok whose fix round's claims-only D1-finish edited `edit` in the plan, then the render, W1 and the re-check of `checked`. */
  const ledgerFix = (edit: (p: Json) => void, checked: string[]) => {
    const dir = copyOf('run-ok');
    editJson(dir, 'plan.json', edit);
    restage(dir, RUN_OK.w1Fix, [step('D1-finish', CARD, 3, 'claims-edited'), step('W1', CARD, 2, 'done'), step('V4-recheck', CARD, 1, 'fail')]);
    if (checked.length > 0) editText(dir, 'reports/V4-2.md', replace('## Checked\n\n', `## Checked\n\n${checked.map((c) => `- ${c}\n`).join('')}`));
    rerender(dir);
    return dir;
  };
  const LEDGER_EDIT = (p: Json) => {
    // The share falls from 15% to 12%, and the claim citing the entry follows it.
    p.ledger[0].inputs[0].value = 12;
    stageB(p).claims[4].text = 'Consuming Blood Loss adds about 6,000 damage per second to Blood Hunt on the budget variant.';
  };

  it("passes a ledger entry's inputs and its claim edited after the final compile, with no recompile: the record's stored ledger value is stale", () => {
    const dir = ledgerFix(LEDGER_EDIT, ['claim stages[3].claims[4] (b-bleed)']);
    expect(readJson(dir, 'compile-record.json').ledger.bleed_bonus.value).toBe(7500);
    expect(fs.readFileSync(path.join(dir, 'audit.md'), 'utf8')).toContain('| `bleed_bonus` | The damage per second consuming Blood Loss adds to Blood Hunt on the budget variant, as a share of its DPS | 6000.00 |');
    passes(dir);
  });

  it("fails the same round when it also swaps gear: the build changed, so only a recompile may follow (D-266)", () => {
    const dir = ledgerFix((p) => {
      LEDGER_EDIT(p);
      stageB(p).items.slots.find((x: Json) => x.slot === 'Helmet').text += '\n+20 to Strength';
    }, ['claim stages[3].claims[4] (b-bleed)']);
    expect(failing(dir)).toMatch(/\[record-plan\] D1-finish r1-a-1 attempt 3 edited claims without a compile \(claims-edited\), but plan\.json's build changed/);
  });

  it('fails a ledger edit that leaves its claim behind (FI-4 falls to [ledger], D-365), and passes [ledger] once the claim states the new value', () => {
    const dir = ledgerFix((p) => (p.ledger[0].inputs[0].value = 12), []);
    expect(failing(dir)).toMatch(/\[ledger\] plan\.json stages\[3\]\.claims\[4\] \(b-bleed\) cites ledger:bleed_bonus, whose current formula gives 6000 over the final record and its inputs are share 12, but the claim states 7,500/);
    // Within 5% is an estimate's tolerance (D-352): 6,200 against 6,000 passes.
    const near = ledgerFix((p) => {
      p.ledger[0].inputs[0].value = 12;
      stageB(p).claims[4].text = 'Consuming Blood Loss adds about 6,200 damage per second to Blood Hunt on the budget variant.';
    }, ['claim stages[3].claims[4] (b-bleed)']);
    passes(near);
  });

  it("passes a ledger claim stating the entry's input, or the input × 100 as a percentage, and FI-4's doubled formula still fails", () => {
    const checked = ['claim stages[3].claims[4] (b-bleed)'];
    passes(ledgerFix((p) => (stageB(p).claims[4].text = "Consuming Blood Loss adds 15% of Blood Hunt's DPS on the budget variant."), checked));
    passes(ledgerFix((p) => {
      p.ledger[0].formula = 'b.TotalDPS * share';
      p.ledger[0].inputs[0].value = 0.15;
      stageB(p).claims[4].text = "Consuming Blood Loss adds 15% of Blood Hunt's DPS on the budget variant.";
    }, checked));
    // A number that is neither the value nor an input still fails.
    const off = ledgerFix((p) => (stageB(p).claims[4].text = "Consuming Blood Loss adds 25% of Blood Hunt's DPS on the budget variant."), checked);
    expect(lines(failing(off), 'ledger')).toEqual([expect.stringMatching(/\(b-bleed\) cites ledger:bleed_bonus, whose current formula gives 7500 over the final record and its inputs are share 15, but the claim states 25;/)]);
    const fi4 = copyOf('run-ok');
    editPlan(fi4, (p) => (p.ledger[0].formula = `(${p.ledger[0].formula}) * 2`));
    expect(failing(fi4)).toMatch(/\[ledger\] plan\.json stages\[3\]\.claims\[4\] \(b-bleed\) cites ledger:bleed_bonus, whose current formula gives 15000 over the final record and its inputs are share 15, but the claim states 7,500/);
  });
});

// ---------------------------------------------------------------------------------------------------
// D-265: the small items the checker holds
// ---------------------------------------------------------------------------------------------------

describe("D-265 (a), A-34: each V4 report is held to the plan as it ran: the round copy made after it, else the current plan", () => {
  /**
   * Run A's shape (2026-10-08-2), as amendment 4 runs it: an offline full pass that accepted the external-unavailable
   * claims, the round copy rounds/1/, then a fix round whose D1-finish recompiled and added a claim at the head of b,
   * so b's claims moved; the re-check covers the new claim. The full pass's locations hold for rounds/1/ only.
   */
  const runAShape = () => {
    const dir = copyOf('run-ok');
    d1Verdict(dir, 3, null);
    fs.copyFileSync(path.join(dir, `reports/gates/D2-gate-${CARD}-a1.json`), path.join(dir, `reports/gates/D2-gate-${CARD}-a2.json`));
    editJson(dir, `reports/gates/D2-gate-${CARD}-a2.json`, (r) => (r.attempt = 2));
    editPlan(dir, (p) => stageB(p).claims.unshift({ id: 'b-armour', text: 'Armour carries the physical hits.', kind: 'hinge', source: { kind: 'judgment', ref: 'armour mitigates physical hits', confidence: 'M' } }));
    restage(dir, RUN_OK.w1Fix, [step('D1-finish', CARD, 3, 'done'), step('D1-gate', CARD, 3, 'pass'), step('D2-gate', CARD, 2, 'pass'), step('W1', CARD, 2, 'done'), step('V4-recheck', CARD, 1, 'fail')]);
    editText(dir, 'reports/V4-2.md', replace('## Checked\n\n', '## Checked\n\n- claim stages[3].claims[0] (b-armour)\n'));
    rerender(dir);
    return dir;
  };

  it("holds the full pass to rounds/1/, where its accepted-offline locations name the claims, and passes", () => {
    const dir = runAShape();
    expect(readJson(dir, 'plan.json').stages[3].claims[6].id).toBe('b-meta');
    expect(fs.readFileSync(path.join(dir, 'reports', 'V4-1.md'), 'utf8')).toContain('- location: stages[3].claims[5] (b-meta)');
    passes(dir);
    // Against rounds/1/, a location naming a pob-computed claim fails.
    editText(dir, 'reports/V4-1.md', (t) => t.split('- location: stages[3].claims[5] (b-meta)').join('- location: stages[3].claims[0] (b-life)'));
    expect(failing(dir)).toMatch(/\[report-shape\] reports\/V4-1\.md: v4-1-3 is accepted-offline, but "plan\.json" "stages\[3\]\.claims\[0\] \(b-life\)" names a pob-computed claim/);
  });

  it('holds the last report, with no round copy after it, to the current plan', () => {
    const dir = runAShape();
    editText(dir, 'reports/V4-2.md', (t) => `${t}\n### v4-1-3\n\n- status: accepted-offline\n- hinge: no\n- owner: D1\n- artifact: plan.json\n- location: stages[3].claims[5] (b-meta)\n- claim: Spear builds clear T15 maps on a budget this league.\n- issue: tagged external-unavailable\n- evidence: offline run\n`);
    expect(failing(dir)).toMatch(/\[report-shape\] reports\/V4-2\.md: v4-1-3 is accepted-offline, but "plan\.json" "stages\[3\]\.claims\[5\] \(b-meta\)" names no claim/);
    editText(dir, 'reports/V4-2.md', replace('- location: stages[3].claims[5] (b-meta)', '- location: stages[3].claims[6] (b-meta)'));
    passes(dir);
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
    editPlanAll(dir, (p) => {
      stage(p, '2').progress = 'q.act-2-deshar-the-final-letter';
      edit(p);
    });
    rerender(dir);
    return dir;
  };
  /** Every stage at or after the quest, the endgame stages included, lists pick `i`. */
  const pickEverywhere = (i: number) => (p: Json) => ['2', 'm', 'b', 'n'].forEach((id) => stage(p, id).config.scenario.push(pick(i)));
  /** D-283: W1 names the pick by its first line, with no marker. */
  const writePick = (dir: string, i: number) =>
    editGuide(dir, replace('## Campaign route and rewards\n', `## Campaign route and rewards\n\n- Act 2, the Medallion: take ${values[i].split('\n')[0]}; my charms carry the flask sustain.\n`));

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
    editText(dir, 'reports/V4-1.md', (t) => t.replace(/\n- reader: [^\n]*\n/, '\n'));
    editText(dir, 'reports/V4-2.md', (t) => t.replace(/\n- reader: [^\n]*\n/, '\n- reader: \n'));
    const stderr = failing(dir);
    expect(stderr).toMatch(/\[report-shape\] reports\/V4-1\.md: finding v4-1-1 \(line \d+\) is unresolved and has no reader: one plain sentence the guide's reader can act on \(D-265\)/);
    expect(stderr).toMatch(/\[report-shape\] reports\/V4-1\.md: finding v4-1-1 \(line \d+\) has the fields status, hinge, owner, artifact, location, claim, issue, evidence; an unresolved finding has .*, reader/);
    expect(stderr).toMatch(/\[report-shape\] reports\/V4-2\.md: finding v4-1-1 \(line \d+\) is unresolved and has no reader/);
  });

  it('passes a fixed finding, and an accepted-offline one, without a reader sentence: neither can become a known issue', () => {
    const dir = copyOf('run-ok');
    expect(fs.readFileSync(path.join(dir, 'reports', 'V4-1.md'), 'utf8').match(/- status: accepted-offline\n(- (?!reader)\w+: [^\n]*\n)+(?=\n|$)/g)?.length).toBe(2);
    fixedInRecheck(dir);
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
    expect(stderr).toMatch(/\[known-issues\] V4 finding "v4-1-1" .* is open in reports\/V4-2\.md, the last report, but guide\.md's Known issues doesn't list its reader sentence, word for word, as "- The How to play it section is wrong/);
    expect(stderr).toMatch(/\[known-issues\] guide\.md:\d+: Known issues lists "- The How to play it section is wrong .*", which is the sentence of no finding open/);
    // The old jargon form: an id and pipeline words, not the reader sentence.
    const jargon = copyOf('run-ok');
    editText(jargon, 'guide.md', replace(`- ${PROSE_READER}\n`, '- `v4-1-1` (V4, guide.md How to play it, line 97): names Rolling Slam as the clear skill\n'));
    const out = failing(jargon);
    expect(out).toMatch(/\[guide-markers\] guide\.md:\d+ carries the finding id "v4-1-1"/);
    expect(out).toMatch(/\[known-issues\] V4 finding "v4-1-1" .* doesn't list its reader sentence/);
  });

  it("item 5: both lists are this cycle's alone: a stale line or row from an earlier cycle fails, and None. only stands with nothing open (the review's run-stale)", () => {
    const kiLine = fs.readFileSync(path.join(FIXTURES, 'run-ok', 'guide.md'), 'utf8').split('\n').indexOf('### Known issues') + 3;
    const stale = copyOf('run-ok');
    editText(stale, 'guide.md', replace('### Known issues\n\n', '### Known issues\n\n- The budget fire hit is wrong: it is about 367, not 735.\n'));
    expect(failing(stale)).toMatch(new RegExp(`\\[known-issues\\] guide\\.md:${kiLine}: Known issues lists "- The budget fire hit is wrong: it is about 367, not 735\\.", which is the sentence of no finding open after this cycle's re-check and of no accepted gate finding; the runner replaces the whole list at step 14 \\(D-265\\)`));
    const staleRow = copyOf('run-ok');
    editText(staleRow, 'audit.md', replace(AUDIT_KI_HEAD, `${AUDIT_KI_HEAD}| v4-1-9 | V4 | — | The budget fire hit is wrong: it is about 367, not 735. |\n`));
    expect(failing(staleRow)).toMatch(/\[known-issues\] audit\.md:\d+: Known issues has a row for "v4-1-9" \(V4\), which is no finding open after this cycle's re-check and no accepted gate finding; the runner replaces the whole table at step 14 \(D-265\)/);
    const none = copyOf('run-ok');
    editText(none, 'guide.md', replace('### Known issues\n\n', '### Known issues\n\nNone.\n'));
    expect(failing(none)).toMatch(new RegExp(`\\[known-issues\\] guide\\.md:${kiLine}: Known issues says "None\\.", but 1 V4 finding\\(s\\) are open and 0 gate finding\\(s\\) accepted`));
    // With nothing open, None. is each list.
    const fixed = copyOf('run-ok');
    fixedInRecheck(fixed);
    noneOpen(fixed);
    passes(fixed);
  });

  it('logs no known-issues W1: the runner writes the lines, and W1 runs no extra step', () => {
    const dir = copyOf('run-ok');
    editLog(dir, (l) => l.stages.push(step('W1', CARD, 3, 'known-issues')));
    expect(failing(dir)).toMatch(new RegExp(`\\[run-log\\] run-log\\.json stages\\[${RUN_OK.length}\\]: outcome "known-issues" isn't one of`));
  });
});

// ---------------------------------------------------------------------------------------------------
// WU-71 (A-34, D-352): the round copy and what changed since it
// ---------------------------------------------------------------------------------------------------

describe('AC-W54 (D-352): each V4 pass writes its own report, never over an earlier one', () => {
  it('fails a re-check written over the full pass\'s report, and a logged pass with no report', () => {
    const dir = copyOf('run-ok');
    fs.writeFileSync(path.join(dir, 'reports', 'V4-1.md'), fs.readFileSync(path.join(dir, 'reports', 'V4-2.md'), 'utf8').replace('# V4-2: re-check of rounds/1', '# V4-1: re-check of rounds/0'));
    fs.rmSync(path.join(dir, 'reports', 'V4-2.md'));
    const stderr = failing(dir);
    expect(lines(stderr, 'reports')).toContainEqual('check-run: [reports] run-log.json logs 2 V4 pass(es) (V4 and V4-recheck), but reports/ holds 1 V4 report(s): each pass writes its own reports/V4-<n>.md and never overwrites one (D-352)');
    expect(stderr).toMatch(/\[report-shape\] reports\/V4-1\.md: its H1 is "V4-1: re-check of rounds\/0"; it is "# V4-1: full pass" or "# V4-1: re-check of rounds\/0"/);
  });

  it('fails a report whose kind isn\'t its pass\'s, a gap in the numbers, and a report no pass logged', () => {
    const swapped = copyOf('run-ok');
    editLog(swapped, (l) => (l.stages.find((s: Json) => s.stage === 'V4-recheck').stage = 'V4'));
    expect(lines(failing(swapped), 'reports')).toContainEqual(expect.stringMatching(/reports\/V4-2\.md is a re-check, but the V4 pass it is, run-log\.json's V4 entry 2 \(V4 r1-a-1 attempt 1\), is a full pass \(V4\)/));
    const gap = copyOf('run-ok');
    fs.renameSync(path.join(gap, 'reports', 'V4-2.md'), path.join(gap, 'reports', 'V4-3.md'));
    expect(lines(failing(gap), 'reports')).toContainEqual('check-run: [reports] reports/ holds the V4 reports V4-1.md, V4-3.md; they are numbered from 1 in run order, with no gap (D-352)');
    const extra = copyOf('run-ok-online');
    fs.copyFileSync(path.join(extra, 'reports', 'V4-1.md'), path.join(extra, 'reports', 'V4-2.md'));
    expect(lines(failing(extra), 'reports')).toContainEqual('check-run: [reports] reports/ holds 2 V4 report(s), but run-log.json logs 1 V4 pass(es) (V4 and V4-recheck); every report is a logged pass\'s (D-352)');
  });

  it('fails a re-check of a round no one copied (A-34)', () => {
    const dir = copyOf('run-ok');
    fs.rmSync(path.join(dir, 'rounds'), { recursive: true });
    expect(lines(failing(dir), 'recheck')).toContainEqual(expect.stringMatching(/reports\/V4-2\.md is a re-check of rounds\/1, but rounds\/1\/ doesn't exist; the runner makes the round copy \(--snapshot 1\) before the fix round or revision \(A-34\)/));
  });
});

describe('AC-W55 (D-351, D-353, D-355): claim kinds, the rendered audit and Checks blocks, and the survival label', () => {
  it('fails a claim without a kind, in the plan and in a skeleton (D-351)', () => {
    const dir = copyOf('run-ok');
    editPlan(dir, (p) => delete stageB(p).claims[1].kind);
    editJson(dir, `concepts/${CARD}/plan.json`, (p) => (p.stages[0].claims[0].kind = 'fact'));
    const out = lines(failing(dir), 'claim-kind');
    expect(out).toContainEqual(expect.stringMatching(/plan\.json stages\[3\]\.claims\[1\] \("b-bloodloss"\) has kind undefined; every claim is "hinge" .* or "reason" .*, plan schema 3 \(D-351\)/));
    expect(out).toContainEqual(expect.stringMatching(/concepts\/r1-a-1\/plan\.json stages\[0\]\.claims\[0\] .* has kind "fact"/));
  });

  it("fails an audit.md that differs from the render, and passes one that differs only in its Known issues (D-355)", () => {
    const dir = copyOf('run-ok');
    editText(dir, 'audit.md', replace('| Endgame budget (L90) {b} | 90 | 4200 |', '| Endgame budget (L90) {b} | 90 | 4250 |'));
    expect(lines(failing(dir), 'audit-render')).toEqual([expect.stringMatching(/^check-run: \[audit-render\] audit\.md:\d+ is "\| Endgame budget \(L90\) \{b\} \| 90 \| 4250 \|.*", but render-audit\.mjs renders "\| Endgame budget \(L90\) \{b\} \| 90 \| 4200 \|.*" from the current plan\.json, compile-record\.json and D1 gate verdict file/)]);
    // The render keeps the rows under Known issues, so a known-issues edit is the known-issues check's alone.
    const ki = copyOf('run-ok');
    editText(ki, 'audit.md', replace(`| v4-1-1 | V4 | — | ${PROSE_READER} |`, `| v4-1-1 | V4 | — | ${PROSE_READER} |\n| level-points | D1-gate | b | An extra row. |`));
    const out = failing(ki);
    expect(lines(out, 'audit-render')).toEqual([]);
    expect(lines(out, 'known-issues').length).toBeGreaterThan(0);
  });

  it("fails a guide Checks block that isn't its block in the render, copied verbatim (D-355)", () => {
    const dir = copyOf('run-ok');
    editGuide(dir, replace("- The Arbiter of Divinity: survives its hits; its worst, physical hit, is 0.47 of your max hit.", "- The Arbiter of Divinity: survives easily."));
    expect(lines(failing(dir), 'checks-block')).toEqual([`check-run: [checks-block] guide.md's "Endgame: non-budget" Checks, line 3 of the block, is "- The Arbiter of Divinity: survives easily.", but its block in render-audit.mjs's render (audit.md's "### Endgame non-budget (L95) {n}") has "- The Arbiter of Divinity: survives its hits; its worst, physical hit, is 0.47 of your max hit."; W1 copies the block verbatim (D-355)`]);
  });

  it("fails a budget or non-budget label that disagrees with measures.arbiter, and an Arbiter label on m (D-353)", () => {
    const wrong = copyOf('run-ok');
    editGuide(wrong, replace("**Budget (L90): survives the Arbiter's hits.**", "**Budget (L90): one-shot by the Arbiter's physical hit.**"));
    expect(lines(failing(wrong), 'survival-label')).toEqual([expect.stringMatching(/guide\.md:\d+: the Budget verdict line's label is "one-shot by the Arbiter's physical hit", but stage b's measures\.arbiter verdict is "survives", so its label is "survives the Arbiter's hits" \(D-353\)/)]);
    const judged = copyOf('run-ok');
    editGuide(judged, replace("**Non-budget (L95): survives the Arbiter's hits.**", '**Non-budget (L95): solid.**'));
    expect(lines(failing(judged), 'survival-label')).toEqual([expect.stringMatching(/the Non-budget verdict line's label is "solid", but stage n's measures\.arbiter verdict is "survives"/)]);
    const m = copyOf('run-ok');
    editGuide(m, replace('**Entering maps (L65): watch.**', "**Entering maps (L65): survives the Arbiter's hits.**"));
    expect(lines(failing(m), 'survival-label')).toEqual([expect.stringMatching(/the Entering maps verdict line's label is "survives the Arbiter's hits"; the entering-maps rung's label is solid, watch or risky/)]);
  });

  it("passes the label of a one-shot by a mixed hit, its types joined by \"and\", and of an unmeasured verdict (D-353)", () => {
    const dir = copyOf('run-ok');
    editJson(dir, 'compile-record.json', (r) => {
      r.stages.b.measures.arbiter.verdict = 'one-shot';
      r.stages.b.measures.arbiter.worst = { type: 'physical-lightning', hitId: 'phase-2-triangulate-split', ratio: 1.12 };
      r.stages.n.measures.arbiter.verdict = null;
    });
    rerender(dir, true);
    editGuide(dir, (t) => t.replace("**Budget (L90): survives the Arbiter's hits.**", "**Budget (L90): one-shot by the Arbiter's physical and lightning hit.**").replace("**Non-budget (L95): survives the Arbiter's hits.**", '**Non-budget (L95): not measured against the Arbiter.**'));
    const guide = fs.readFileSync(path.join(dir, 'guide.md'), 'utf8');
    expect(guide).toContain('- The Arbiter of Divinity: one-shot by its physical and lightning hit, at 1.12 of your max hit.');
    expect(guide).toContain('- The Arbiter of Divinity: not measured.');
    passes(dir);
  });
});

describe('AC-W60 (D-362): the design gate sits between the D1 gate and D2 in the design phase', () => {
  const dAt = indexOf('run-ok', (s) => s.stage === 'D1-gate' && s.attempt === 2);
  /** run-ok cut after its passing D1 gate, in the design phase: no D2, no guide, no V4; its design answers `design`, then `then`. */
  const designPhase = (design: Json[], then: Json[] = [], stages: Json[] = [], status = 'stopped') => {
    const dir = copyOf('run-ok');
    for (const f of ['guide.md', 'audit.md']) fs.rmSync(path.join(dir, f));
    for (const f of ['rounds', 'reports/V4-1.md', 'reports/V4-2.md', `reports/gates/D2-gate-${CARD}-a1.json`]) fs.rmSync(path.join(dir, f), { recursive: true });
    editLog(dir, (l) => {
      l.stages = [...l.stages.slice(0, dAt + 1), ...stages];
      l.checkpoints = [...l.checkpoints.filter((c: Json) => ['brainstorm', 'verification'].includes(c.checkpoint)), ...design.map((a, k) => ({ checkpoint: 'design', visit: k + 1, ...a })), ...then];
      l.status = status;
      l.outputs = { plan: 'plan.json', record: 'compile-record.json', dossier: 'dossier.md', guide: null, pobFile: null };
    });
    return dir;
  };
  const answer = (a: string): Json => ({ answer: a, answeredBy: 'pre-supplied', rule: a });
  const STOP_DEFAULT = { answer: 'stop', answeredBy: 'default', rule: 'no design answer left: stop' };

  it('fails D2 reached without a design visit, in the design phase', () => {
    const dir = copyOf('run-ok');
    editLog(dir, (l) => (l.checkpoints = l.checkpoints.filter((c: Json) => c.checkpoint !== 'design')));
    expect(lines(failing(dir), 'design-gate')).toEqual([expect.stringMatching(/\(D2 r1-a-1 attempt 1\): reaches D2 without a design gate visit: checkpoints\[\] records no design answer after r1-a-1's D1 gate; in the design phase the design gate runs between the D1 gate and D2, whoever answers, and D2 comes only after its accept \(D-362\)/)]);
  });

  it('passes the answers running out, then stopped; fails the default stop under another status', () => {
    passes(designPhase([STOP_DEFAULT]));
    const running = designPhase([STOP_DEFAULT], [], [], 'not-accepted');
    expect(failing(running)).toMatch(/\[order\] run-log\.json: the design gate answered "stop", which ends the run stopped, but its status is "not-accepted"/);
  });

  it('passes revise:, then D1 (D1-finish alone, or D1-build then D1-finish), the D1 gate and a second visit', () => {
    for (const d1 of [[step('D1-finish', CARD, 3, 'done')], [step('D1-build', CARD, 3, 'done'), step('D1-finish', CARD, 3, 'done')], [step('D1-finish', CARD, 3, 'done'), step('D1-build', CARD, 3, 'done'), step('D1-finish', CARD, 4, 'done')]]) {
      const dir = designPhase([answer('revise:cheaper boots'), STOP_DEFAULT], [], [...d1, step('D1-gate', CARD, 3, 'pass')]);
      d1Verdict(dir, 3, null);
      passes(dir);
    }
    // A revise: that skips D1 for D2 doesn't follow its answer.
    const skipped = designPhase([answer('revise:cheaper boots')], [], [step('D2', CARD, 1, 'done')], 'running');
    expect(failing(skipped)).toMatch(/\[order\] .*\(D2 r1-a-1 attempt 1\): follows the design gate answered "revise:cheaper boots", which runs r1-a-1's D1 again \(D1-build, or D1-finish\), not D2 \(D-362\)/);
  });

  it('passes verification, then the verification gate; fails a design step after it', () => {
    passes(designPhase([answer('verification')], [{ checkpoint: 'verification', visit: 2, answer: 'stop', answeredBy: 'default', rule: 'no verification answer left: stop' }]));
    const onward = designPhase([answer('verification')], [{ checkpoint: 'verification', visit: 2, answer: 'stop', answeredBy: 'default', rule: 'no verification answer left: stop' }], [step('D2', CARD, 1, 'done')], 'running');
    expect(failing(onward)).toMatch(/\[order\] .*\(D2 r1-a-1 attempt 1\): follows the verification gate answered "stop", which ends the run stopped/);
  });

  it("fails an answer that isn't the design gate's, and design answers left over", () => {
    const bad = designPhase([answer('pick:r1-a-2')]);
    expect(failing(bad)).toMatch(/\[run-log\] run-log\.json checkpoints\[2\]: answers "pick:r1-a-2"; the design gate's answer is accept, revise:<text>, verification or stop \(D-362\)/);
    const left = designPhase([STOP_DEFAULT, answer('accept')]);
    expect(failing(left)).toMatch(/\[order\] run-log\.json: checkpoints\[\] records 1 design answer\(s\) more than the run visits the design gate/);
  });

  it("passes a fix round's D1 gate going on to D2 and its gate with no design visit: the gate is the design phase's only", () => {
    const dir = copyOf('run-ok');
    d1Verdict(dir, 3, null);
    fs.copyFileSync(path.join(dir, `reports/gates/D2-gate-${CARD}-a1.json`), path.join(dir, `reports/gates/D2-gate-${CARD}-a2.json`));
    editJson(dir, `reports/gates/D2-gate-${CARD}-a2.json`, (r) => (r.attempt = 2));
    restage(dir, RUN_OK.w1Fix, [step('D1-finish', CARD, 3, 'done'), step('D1-build', CARD, 3, 'done'), step('D1-finish', CARD, 4, 'done'), step('D1-gate', CARD, 3, 'pass'), step('D2', CARD, 2, 'done'), step('D2-gate', CARD, 2, 'pass'), step('W1', CARD, 2, 'done'), step('V4-recheck', CARD, 1, 'fail')]);
    passes(dir);
    // D1-build hands back to D1-finish once: a second build: return is no step of the chain.
    restage(dir, RUN_OK.w1Fix, [step('D1-finish', CARD, 3, 'done'), step('D1-build', CARD, 3, 'done'), step('D1-finish', CARD, 4, 'done'), step('D1-build', CARD, 4, 'done')]);
    expect(failing(dir)).toMatch(/\[order\] .*\(D1-build r1-a-1 attempt 4\): can't follow D1-finish r1-a-1 attempt 4 \(outcome "done"\); SKILL\.md's step list allows D1-gate next/);
  });

  it("fails a schema-3 log's retired stage names: one D1 step, and V4 by its lens (D-352, D-356)", () => {
    const dir = copyOf('run-ok');
    editLog(dir, (l) => {
      l.stages[RUN_OK.d1].stage = 'D1';
      l.stages[RUN_OK.v4].stage = 'V4-prose';
    });
    const out = lines(failing(dir), 'run-log');
    expect(out).toContainEqual(expect.stringMatching(new RegExp(`stages\\[${RUN_OK.d1}\\]: stage "D1" isn't one of .*; D1 is two steps, D1-build then D1-finish \\(D-356\\)`)));
    expect(out).toContainEqual(expect.stringMatching(new RegExp(`stages\\[${RUN_OK.v4}\\]: stage "V4-prose" isn't one of .*; V4 is one pass with no lenses, V4 or V4-recheck, each entry one report reports\\/V4-<n>\\.md \\(D-352\\)`)));
  });
});

describe('D-355: the dossier is the verification gate\'s comparison table', () => {
  it('fails an H2, a marker, a missing Brief: line, other columns, and a verified card with no row', () => {
    const h2 = copyOf('run-ok');
    editText(h2, 'dossier.md', (t) => `${t}\n## Concepts\n`);
    expect(lines(failing(h2), 'dossier-sections')).toContainEqual(expect.stringMatching(/dossier\.md:\d+ has the heading "Concepts"; the dossier is one table, with no H2 or H3/));
    const marker = copyOf('run-ok');
    editText(marker, 'dossier.md', (t) => t.replace('| chaos resistance stays low |', '| chaos resistance stays low[^d1] |'));
    expect(lines(failing(marker), 'dossier-sections')).toContainEqual(expect.stringMatching(/dossier\.md carries source markers/));
    const brief = copyOf('run-ok');
    editText(brief, 'dossier.md', (t) => t.replace(/^Brief: [^\n]*\n/m, ''));
    expect(lines(failing(brief), 'dossier-sections')).toContainEqual(expect.stringMatching(/doesn't start with the "Brief:" line after its H1/));
    const columns = copyOf('run-ok');
    editText(columns, 'dossier.md', replace('| Key prices | League |', '| Prices | League |'));
    expect(lines(failing(columns), 'dossier-sections')).toContainEqual(expect.stringMatching(/the table's columns are .*"Prices".*; the comparison's are .*"Key prices"/));
    const row = copyOf('run-ok');
    editText(row, 'dossier.md', (t) => t.replace(/^\| r1-a-2 \|.*\n/m, ''));
    expect(lines(failing(row), 'dossier-sections')).toEqual([expect.stringMatching(/dossier\.md has no row "\| r1-a-2 \| …" for r1-a-2, which R1b verified before the last R1b-assemble/)]);
  });

  it("fails a failed or not-yet-finalizable card's row with numbers, prices or a league", () => {
    const dir = copyOf('run-escalated');
    editText(dir, 'dossier.md', (t) => t.replace(/^(\| r1-c-1 \|[^|]*\|[^|]*\|[^|]*\|) — \|/m, '$1 Maelstrom 9000 (g1s1p1.TotalDPS) |'));
    expect(lines(failing(dir), 'dossier-sections')).toEqual([expect.stringMatching(/r1-c-1 is "can't be finalized yet", but its Named source DPS cell\(s\) aren't "—"/)]);
  });

  it("reads a writer's typography as the template's: a curly apostrophe in a survival label, a hyphen or en dash for a dossier's —", () => {
    const guide = copyOf('run-ok');
    editGuide(guide, (t) => t.replace("**Budget (L90): survives the Arbiter's hits.**", '**Budget (L90): survives the Arbiter\u2019s hits.**'));
    expect(fs.readFileSync(path.join(guide, 'guide.md'), 'utf8')).toContain('survives the Arbiter\u2019s hits.');
    passes(guide);
    const dossier = copyOf('run-escalated');
    let k = 0;
    editText(dossier, 'dossier.md', (t) => t.replace(/^\| r1-c-1 \|.*$/m, (row) => row.replace(/ — \|/g, () => (k++ % 2 === 0 ? ' - |' : ' \u2013 |'))));
    expect(k).toBeGreaterThan(1);
    passes(dossier);
  });

  it("skips an HTML comment, the template's left in, between the H1 and the Brief: line", () => {
    const dir = copyOf('run-ok');
    editText(dir, 'dossier.md', (t) => t.replace(/^(# [^\n]*\n)/, '$1\n<!--\nTemplate for dossier.md. Replace every <placeholder>; delete this comment.\n-->\n'));
    expect(fs.readFileSync(path.join(dir, 'dossier.md'), 'utf8')).toMatch(/^# [^\n]*\n\n<!--\n/);
    passes(dir);
  });
});

describe('AC-W54 (WU-71, D-352, A-34): --snapshot makes the round copy, and --changed lists exactly what changed since it', () => {
  /** A fresh synthetic run (tests/helpers/guideRunFolder.ts): a plan, its final record and a guide. */
  const guideRun = () => {
    const dir = path.join(TMP, `guide-run-${++copies}`);
    fs.mkdirSync(dir);
    return writeGuideRun(dir);
  };
  const snapshot = (dir: string, n: number) => {
    const r = runChecker(dir, '--snapshot', String(n));
    expect({ stderr: r.stderr, code: r.code, stdout: r.stdout }).toEqual({ stderr: '', code: 0, stdout: `check-run: copied plan.json, compile-record.json, guide.md to rounds/${n}/\n` });
  };
  /** The lines --changed prints; it prints nothing else and exits 0. */
  const changed = (dir: string, n: number) => {
    const r = runChecker(dir, '--changed', String(n));
    expect({ stderr: r.stderr, code: r.code }).toEqual({ stderr: '', code: 0 });
    expect(r.stdout === '' || r.stdout.endsWith('\n')).toBe(true);
    return r.stdout.split('\n').filter((l) => l !== '');
  };
  const editGuide = (dir: string, from: string, to: string) => editText(dir, 'guide.md', replace(from, to));

  it('--snapshot copies plan.json, compile-record.json and guide.md into rounds/<n>/, unread, and never overwrites a round', () => {
    const dir = guideRun();
    snapshot(dir, 1);
    expect(fs.readdirSync(path.join(dir, 'rounds', '1')).sort()).toEqual(['compile-record.json', 'guide.md', 'plan.json']);
    for (const f of ['plan.json', 'compile-record.json', 'guide.md']) {
      expect(fs.readFileSync(path.join(dir, 'rounds', '1', f))).toEqual(fs.readFileSync(path.join(dir, f)));
    }
    const first = fs.readFileSync(path.join(dir, 'rounds', '1', 'plan.json'));
    editRunJson(dir, 'plan.json', (p) => {
      p.stages[0].claims[0].text = 'Life reaches about 320 by the end of act 1.';
    });
    // A second copy under the same number is refused, and the round keeps the first copy.
    const again = runChecker(dir, '--snapshot', '1');
    expect({ code: again.code, stdout: again.stdout }).toEqual({ code: 1, stdout: '' });
    expect(again.stderr).toBe('check-run: rounds/1/ exists; a round copy is never overwritten (A-34)\n');
    expect(fs.readFileSync(path.join(dir, 'rounds', '1', 'plan.json'))).toEqual(first);
    // The next round takes the current files.
    snapshot(dir, 2);
    expect(fs.readFileSync(path.join(dir, 'rounds', '2', 'plan.json'))).toEqual(fs.readFileSync(path.join(dir, 'plan.json')));
    // A run folder missing one of the three files gets no copy at all.
    const partial = guideRun();
    fs.rmSync(path.join(partial, 'guide.md'));
    const r = runChecker(partial, '--snapshot', '1');
    expect({ code: r.code, stderr: r.stderr }).toEqual({ code: 1, stderr: 'check-run: the run folder has no guide.md; the round copy holds plan.json, compile-record.json, guide.md (A-34)\n' });
    expect(fs.existsSync(path.join(partial, 'rounds', '1'))).toBe(false);
  });

  it('after a claims-only edit, --changed lists exactly the edited claims, the claims citing an edited ledger entry, and the changed H2s', () => {
    const dir = guideRun();
    snapshot(dir, 1);
    expect(changed(dir, 1)).toEqual([]);
    editRunJson(dir, 'plan.json', (p) => {
      p.stages[0].claims[0].text = 'Life reaches about 320 by the end of act 1.'; // its text
      p.stages[1].claims[1].source.ref = 'its area covers most of a pack'; // its source
      p.ledger.find((e: { id: string }) => e.id === 'clear_guess').formula = 'packs * 3'; // a ledger-only edit: n-packs cites it
    });
    editGuide(dir, 'Lead packs with Blood Hunt.', 'Lead packs with Blood Hunt, then slam the rare.');
    expect(changed(dir, 1)).toEqual([
      'claim stages[0].claims[0] (a1-life)',
      'claim stages[1].claims[1] (m-clear)',
      'claim stages[3].claims[1] (n-packs)',
      'section How to play it',
    ]);
  });

  it('after a recompile moving one stage, --changed lists exactly the claims citing its record values and the H2s that changed', () => {
    const dir = guideRun();
    snapshot(dir, 1);
    // The recompile moves stage b only: its max hit, EHP and the named source's figure.
    editRunJson(dir, 'compile-record.json', (r) => {
      const b = r.stages.b;
      b.outputs.PhysicalMaximumHitTaken = 29000;
      b.outputs.TotalEHP = 28000;
      b.skillOutputs.g1s1p1.fields.TotalDPS = 91000;
      b.countedSkillOutputs.g1s1p1.fields.TotalDPS = 91000;
      b.measures.ehp = 28000;
      b.measures.dps = 91000;
    });
    editGuide(dir, 'Effective HP about 30,101.', 'Effective HP about 28,000.');
    // b-margin cites a ledger entry reading b's max hit, b-ehp and b-dps cite b's fields; b-helmet (a price) and
    // b-why (a judgment) cite nothing that moved, and no other stage moved.
    expect(changed(dir, 1)).toEqual([
      'claim stages[2].claims[0] (b-margin)',
      'claim stages[2].claims[2] (b-ehp)',
      'claim stages[2].claims[3] (b-dps)',
      'section Endgame: budget',
    ]);
    // An edited price entry changes what its claim cites.
    editRunJson(dir, 'plan.json', (p) => {
      p.prices.find((x: { id: string }) => x.id === 'b-helmet').amount = 4;
    });
    expect(changed(dir, 1)).toContain('claim stages[2].claims[1] (b-helmet)');
  });

  it('matches claims by stage and id: a removed claim is not listed, a moved one unchanged is not, a new one is; likewise H2s', () => {
    const dir = guideRun();
    snapshot(dir, 1);
    editRunJson(dir, 'plan.json', (p) => {
      p.stages[3].claims.shift(); // n-ext goes, so n-packs moves to claims[0], unchanged
      p.stages[3].claims.push({ id: 'n-new', text: 'The non-budget variant adds a second curse.', kind: 'reason', source: { kind: 'judgment', ref: 'one more curse slot', confidence: 'M' } });
    });
    editGuide(dir, '## Overview\n\nBlood Hunt bleeds packs and bursts bosses.\n\n', '');
    editGuide(dir, '## Known issues', '## Gear checklist\n\n- A rare helmet.\n\n## Known issues');
    expect(changed(dir, 1)).toEqual(['claim stages[3].claims[1] (n-new)', 'section Gear checklist']);
  });

  it('usage: --changed needs its round, and a flag takes a round number from 1; --partial stays a usage error', () => {
    const dir = guideRun();
    const missing = runChecker(dir, '--changed', '1');
    expect({ code: missing.code, stdout: missing.stdout, stderr: missing.stderr }).toEqual({ code: 1, stdout: '', stderr: "check-run: rounds/1/ doesn't exist; make the round copy first (--snapshot 1, A-34)\n" });
    for (const flags of [['--changed', '0'], ['--changed', 'x'], ['--snapshot'], ['--snapshot', '1', '2'], ['--partial'], ['--partial', '1']]) {
      const r = runChecker(dir, ...flags);
      expect({ flags, code: r.code, stderr: r.stderr }).toEqual({ flags, code: 2, stderr: 'usage: node check-run.mjs <runFolder> [--snapshot <n> | --changed <n>]\n' });
    }
    expect(fs.existsSync(path.join(dir, 'rounds'))).toBe(false);
  });

  it("the run folder's layout takes rounds/<n>/ holding the three files, and nothing else there", () => {
    const dir = copyOf('run-ok');
    // run-ok holds rounds/1/, its fix round's copy; a revision would copy rounds/2/.
    const r = runChecker(dir, '--snapshot', '2');
    expect(r.code).toBe(0);
    passes(dir);
    fs.writeFileSync(path.join(dir, 'rounds', '2', 'audit.md'), '# Audit\n');
    fs.mkdirSync(path.join(dir, 'rounds', 'latest'));
    const out = failing(dir);
    expect(lines(out, 'layout')).toEqual([
      'check-run: [layout] rounds/2/ holds ["audit.md","compile-record.json","guide.md","plan.json"]; a round copy holds exactly plan.json, compile-record.json, guide.md (A-34)',
      "check-run: [layout] rounds/latest isn't a round copy rounds/<n>/ (A-34)",
    ]);
  });

  it('--snapshot fails cleanly (exit 1, one line, no stack): rounds a file, or a copy failing midway, which leaves no round and can be made again', () => {
    const file = copyOf('run-ok');
    fs.rmSync(path.join(file, 'rounds'), { recursive: true });
    fs.writeFileSync(path.join(file, 'rounds'), '');
    expect(runChecker(file, '--snapshot', '2')).toEqual({ code: 1, stdout: '', stderr: 'check-run: rounds is a file; the round copies go in the folder rounds/ (A-34)\n' });
    // guide.md a folder: the plan and the record copy, then the guide fails, midway.
    const dir = copyOf('run-ok');
    const guide = fs.readFileSync(path.join(dir, 'guide.md'));
    fs.rmSync(path.join(dir, 'guide.md'));
    fs.mkdirSync(path.join(dir, 'guide.md'));
    expect(runChecker(dir, '--snapshot', '2')).toEqual({ code: 1, stdout: '', stderr: "check-run: the round copy rounds/2/ wasn't made (EISDIR); nothing was copied, so it can be made again (A-34)\n" });
    expect(fs.readdirSync(path.join(dir, 'rounds'))).toEqual(['1']);
    fs.rmSync(path.join(dir, 'guide.md'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'guide.md'), guide);
    expect(runChecker(dir, '--snapshot', '2').code).toBe(0);
    // A working folder left by a copy cut short (a killed process) is no round copy, and the layout skips it.
    fs.mkdirSync(path.join(dir, 'rounds', '.3.tmp-a1B2c3'));
    fs.writeFileSync(path.join(dir, 'rounds', '.3.tmp-a1B2c3', 'plan.json'), '{}');
    passes(dir);
  });

  it("the layout skips a run-log.json.tmp left by a run-log.mjs write cut short", () => {
    const dir = copyOf('run-ok');
    fs.writeFileSync(path.join(dir, 'run-log.json.tmp'), '{"schemaVersion": 3');
    passes(dir);
  });
});

describe("D-367: each gate visit's display is recorded before its answer", () => {
  it('fails a gate answer whose visit has no display in displays[], and a log with none; the unsaved-build question needs none', () => {
    const dropped = copyOf('run-ok');
    // editJson, not editLog: editLog keeps displays[] in step with checkpoints[], as run-log.mjs writes them.
    editJson(dropped, 'run-log.json', (l) => (l.displays = (l.displays as Json[]).filter((d) => d.checkpoint !== 'design')));
    expect(lines(failing(dropped), 'display')).toEqual([
      'check-run: [display] run-log.json checkpoints[2]: design visit 1 has no display in displays[]; every gate visit prints its display first, run-log.mjs display design, and only then logs its answer (D-367)',
    ]);
    const none = copyOf('run-escalated');
    editJson(none, 'run-log.json', (l) => delete l.displays);
    expect(lines(failing(none), 'display').map((l) => /checkpoints\[\d\]: \w+ visit \d/.exec(l)![0])).toEqual(['checkpoints[0]: brainstorm visit 1', 'checkpoints[1]: verification visit 1', 'checkpoints[2]: escalation visit 1']);
    const unsaved = copyOf('run-ok');
    editLog(unsaved, (l) => l.checkpoints.unshift({ checkpoint: 'unsaved-build', visit: 1, answer: 'proceed', answeredBy: 'pre-supplied', rule: 'proceed' }));
    expect(readJson(unsaved, 'run-log.json').displays.map((d: Json) => d.checkpoint)).not.toContain('unsaved-build');
    expect(lines(runChecker(unsaved).stderr, 'display')).toEqual([]);
  });
});
