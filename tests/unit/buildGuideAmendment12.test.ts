/**
 * AC-W93 (WU-121, amendment 12: D-449…D-454, D-459, §22, Appendix A): the run scripts on fixture runs, each spawned as a
 * real `node` process with an explicit env.
 *
 * - `tests/fixtures/pipeline/run-a12`: run-a11 held to amendment 12 from its init (`skillRevision: 12`): its plan schema 8
 *   with the non-budget rung's defence plan and a tree two nodes apart from the budget rung's, its record with amendment
 *   12's measures (each rung's toughness, the Arbiter rows' hits survived, the resisting figure, `treeChange`), its D1
 *   gate's design field with `maxHit`, `damage.resisting` and the non-budget rung's toughness reading, its trades in the
 *   9 fields, its guide's verdict lines with three figures and its tree-change line. Each test breaks a copy, or sets a
 *   rung's Arbiter to the case it reads, and reads the rule it breaks.
 * - older runs: `run-a11` (revision 11 from its init) and `run-builds` (before amendment 11), resumed at 12.
 *
 * Every figure here is the fixture's own; none comes from a user's run or a published guide.
 */
import { describe, it, expect, afterAll } from '@jest/globals';
import { spawnSync } from 'child_process';
import crypto from 'crypto';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { validatePlan } from '../../src/plan/schema';
import { loadReferenceData } from '../../src/plan/referenceData';
import { treeChangeOf } from '../../src/plan/compiler';
import { decidingRow, type ArbiterMeasure } from '../../src/plan/record';

type Json = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

const REPO = path.resolve(__dirname, '..', '..');
const SKILL = path.join(REPO, '.claude', 'skills', 'build-guide');
const SCRIPTS = path.join(SKILL, 'scripts');
const CHECKER = path.join(SCRIPTS, 'check-run.mjs');
const RUN_LOG = path.join(SCRIPTS, 'run-log.mjs');
const RENDER = path.join(SCRIPTS, 'render-audit.mjs');
const FIXTURES = path.join(REPO, 'tests', 'fixtures', 'pipeline');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'a12-'));
afterAll(() => fs.rmSync(TMP, { recursive: true, force: true }));

const ENV = { PATH: '/usr/bin:/bin', LANG: 'C' };
function node(script: string, args: string[], input?: string) {
  const r = spawnSync(process.execPath, [script, ...args], { cwd: TMP, env: ENV, encoding: 'utf8', timeout: 30000, input });
  return { code: r.status, stdout: r.stdout, stderr: r.stderr };
}
const check = (dir: string) => node(CHECKER, [dir]);
/** The broken rule's lines on stderr. */
const lines = (stderr: string, rule: string) => stderr.split('\n').filter((l) => l.startsWith(`check-run: [${rule}] `));
const rules = (stderr: string, ...names: string[]) => names.flatMap((n) => lines(stderr, n));
function passes(dir: string): void {
  const r = check(dir);
  expect({ stderr: r.stderr, code: r.code }).toEqual({ stderr: '', code: 0 });
}
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
function editText(dir: string, rel: string, from: string | RegExp, to: string): void {
  const p = path.join(dir, rel);
  const t = fs.readFileSync(p, 'utf8');
  if (typeof from === 'string' ? !t.includes(from) : !from.test(t)) throw new Error(`"${String(from)}" not found in ${rel}`);
  fs.writeFileSync(p, t.replace(from, to));
}
const display = (dir: string, gate: string, build?: string) => node(RUN_LOG, [dir, 'display', gate, ...(build ? ['--build', build] : [])]);
const write = (dir: string, kind: string, entry: Json) => node(RUN_LOG, [dir, kind, JSON.stringify(entry)]);
/** A rung's block of the design display: from its label line to the blank line after it. */
function rungBlock(out: string, label: string): string[] {
  const all = out.split('\n');
  const at = all.findIndex((l) => l.startsWith(label));
  return all.slice(at, all.indexOf('', at));
}

const ID = 'r1-a-2';
const BUILD = `builds/${ID}`;
const PLAN = `${BUILD}/plan.json`;
const RECORD = `${BUILD}/compile-record.json`;
const TRADES = `${BUILD}/trades.json`;
const GUIDE = `${BUILD}/guide.md`;
const AUDIT = `${BUILD}/audit.md`;
const GATE = `reports/gates/D1-gate-${ID}-a1.json`;
const rung = (gate: Json, stage: string): Json => gate.design.rungs.find((r: Json) => r.stage === stage);
const sha1 = (dir: string, rel: string) => crypto.createHash('sha1').update(fs.readFileSync(path.join(dir, rel))).digest('hex');
/** After a plan edit, the record's planSha1 is the plan's again, so `record-plan` stays quiet. */
function replan(dir: string, edit: (p: Json) => void): void {
  editJson(dir, PLAN, edit);
  const s = sha1(dir, PLAN);
  editJson(dir, RECORD, (r) => {
    r.planSha1 = s;
  });
}

/** One Arbiter row's case: its full hit's ratio, its hits survived and its deflected hit's ratio. */
interface Row { type: string; ratio: number; hitsSurvived: number; deflectedRatio?: number | null }
/**
 * Sets a rung's Arbiter on a copy of run-a12: the record's rows of the types given (their max hit from the ratio, their
 * verdicts, hits survived and deflected ratio), its `avoid` (the chances at the Arbiter, or none), its verdict and worst;
 * and the design field's `maxHit` naming `field.type` as its deciding row, with `field.oneShot`.
 */
function arbiter(dir: string, stage: string, o: { avoid?: Json | null; rows: Row[]; field: { type: string; oneShot: boolean } }): void {
  let row: Json = {};
  editJson(dir, RECORD, (r) => {
    const a = r.stages[stage].measures.arbiter;
    for (const x of o.rows) {
      const y = a.rows.find((z: Json) => z.type === x.type);
      const dr = x.deflectedRatio ?? null;
      Object.assign(y, { maxHit: y.hit / x.ratio, ratio: x.ratio, verdict: x.ratio < 1 ? 'survives' : 'one-shot', deflectedRatio: dr, deflectedVerdict: dr === null ? null : dr < 1 ? 'survives' : 'one-shot', hitsSurvived: x.hitsSurvived });
    }
    a.verdict = a.rows.some((z: Json) => z.verdict === 'one-shot') ? 'one-shot' : 'survives';
    const worst = [...a.rows].sort((p: Json, q: Json) => q.ratio - p.ratio)[0];
    a.worst = { type: worst.type, hitId: worst.hitId, ratio: worst.ratio };
    if (o.avoid) a.avoid = { accuracy: 3786, evade: 0, deflect: 0, deflectEffect: 40, method: 'pass', ...o.avoid };
    else delete a.avoid;
    row = a.rows.find((z: Json) => z.type === o.field.type);
  });
  editJson(dir, GATE, (g) => {
    const av = o.avoid ? { evade: 0, deflect: 0, method: 'pass', ...o.avoid } : null;
    rung(g, stage).maxHit.arbiter = { type: o.field.type, evade: av ? av.evade : 0, deflect: av ? av.deflect : 0, hitsSurvived: row.hitsSurvived, deflectedRatio: row.deflectedRatio, method: av ? av.method : null };
    rung(g, stage).maxHit.oneShot = o.field.oneShot;
  });
}
/** A trade in amendment 12's 9 fields. */
const trade = (o: Json): Json => ({ stage: 'n', kind: 'defence', what: 'none found: no slot can roll more life', ehpChange: null, damageChange: null, bossAfter: null, reason: "one-shot by the Arbiter's physical hit", maxHit: null, hitsSurvived: null, ...o });
/** run-a12's damage trade on n, with `o` over it. */
const damageN = (o: Json = {}): Json => ({ ...readJson(path.join(FIXTURES, 'run-a12'), TRADES).trades[0], ...o });
/** Writes trades.json and each rung's design-field trades, so the two agree. */
function setTrades(dir: string, trades: Json[]): void {
  writeJson(dir, TRADES, { trades });
  editJson(dir, GATE, (g) => {
    for (const r of g.design.rungs) r.trades = trades.filter((t) => t.stage === r.stage);
  });
}
/** n's toughness reading in the record and the design field: its EHP, its conditioned EHP and its warning. */
function toughN(dir: string, o: { ehp?: number; band?: string; conditioned?: number; conditionedBand?: string; warning?: Json | null }): void {
  editJson(dir, RECORD, (r) => {
    const n = r.stages.n;
    if (o.ehp !== undefined) {
      n.outputs.TotalEHP = o.ehp;
      n.measures.ehp = o.ehp;
    }
    if (o.conditioned !== undefined) n.measures.toughness.conditioned.ehp = o.conditioned;
  });
  editJson(dir, GATE, (g) => {
    const n = rung(g, 'n');
    if (o.ehp !== undefined) n.ehp = o.ehp;
    if (o.band !== undefined) n.toughness.band = o.band;
    if (o.conditioned !== undefined) n.toughness.conditioned.ehp = o.conditioned;
    if (o.conditionedBand !== undefined) n.toughness.conditioned.band = o.conditionedBand;
    if (o.warning !== undefined) n.toughness.warning = o.warning;
  });
}
const ONE_SHOT_WARNING = { kind: 'one-shot', type: 'physical', fix: 'the pool, armour or a physical shift' };
/** §4's first case: a row one-shot at 1.01 that survives 79.6% of its hits, evading 32% and deflecting 70%. */
const CASE_796 = { avoid: { evade: 32, deflect: 70 }, rows: [{ type: 'physical', ratio: 1.01, hitsSurvived: 79.6, deflectedRatio: 0.61 }] };
/** The same row at 80%: evading 33.4% and deflecting 70% gives 80.02, so its record reads 80. */
const CASE_80 = { avoid: { evade: 33.4, deflect: 70 }, rows: [{ type: 'physical', ratio: 1.01, hitsSurvived: 80, deflectedRatio: 0.61 }] };
/** Its labels, as the guide, the final display and the comparison print them (D-459). */
const LABEL_796 = "one-shot by the Arbiter's physical hit (it survives 79% of them)";
const LABEL_80 = "survives 80% of the Arbiter's physical hits, by evading or deflecting them";

// ---------------------------------------------------------------------------------------------------
// AC-W93, bullet 1: the floor, the deciding row and the design field
// ---------------------------------------------------------------------------------------------------

describe('AC-W93 (D-449): a one-shot rung is a one-shot row under the 80% floor, read from its deciding row', () => {
  it('a row one-shot at 1.01 that survives 79.6% of its hits is a one-shot rung and displays 79%; at 80% it is not', () => {
    const under = copy('run-a12');
    arbiter(under, 'n', { ...CASE_796, field: { type: 'physical', oneShot: true } });
    expect(lines(check(under).stderr, 'arbiter')).toEqual([]);
    const shown = rungBlock(display(copy2(under), 'design', ID).stdout, 'Non-budget endgame');
    expect(shown).toContain('- The Arbiter of Divinity: one-shot by its physical hit (1.01 of your max hit); survives 79% of them by evading or deflecting (evades 32%, deflects 70% at its accuracy of 3,786; a deflected hit is 0.61 of your max hit), under the 80% floor.');
    // A field that calls it no one-shot rung fails: the checker reads the unrounded 79.6 against the floor.
    editJson(under, GATE, (g) => {
      rung(g, 'n').maxHit.oneShot = false;
    });
    expect(lines(check(under).stderr, 'arbiter')).toEqual([expect.stringMatching(/design\.rungs's "n"'s maxHit\.oneShot is false, but the record's deciding row \(physical\) is one-shot by its full hit and survives 79\.6% of its hits, under the 80% floor/)]);
    const at80 = copy('run-a12');
    arbiter(at80, 'n', { ...CASE_80, field: { type: 'physical', oneShot: false } });
    expect(lines(check(at80).stderr, 'arbiter')).toEqual([]);
    expect(rungBlock(display(copy2(at80), 'design', ID).stdout, 'Non-budget endgame')).toContain('- The Arbiter of Divinity: survives 80% of its physical hits by evading or deflecting them (evades 33%, deflects 70% at its accuracy of 3,786; a deflected hit is 0.61 of your max hit, a full one 1.01).');
    editJson(at80, GATE, (g) => {
      rung(g, 'n').maxHit.oneShot = true;
    });
    expect(lines(check(at80).stderr, 'arbiter')).toEqual([expect.stringMatching(/maxHit\.oneShot is true, but the record's deciding row \(physical\) is one-shot by its full hit and survives 80% of its hits, at or over the 80% floor/)]);
  });

  it('a row with no deflection and 80% evade is not a one-shot rung: evasion counts like deflection', () => {
    const dir = copy('run-a12');
    arbiter(dir, 'n', { avoid: { evade: 80 }, rows: [{ type: 'physical', ratio: 1.2, hitsSurvived: 80 }], field: { type: 'physical', oneShot: false } });
    expect(lines(check(dir).stderr, 'arbiter')).toEqual([]);
    expect(rungBlock(display(copy2(dir), 'design', ID).stdout, 'Non-budget endgame')).toContain('- The Arbiter of Divinity: survives 80% of its physical hits by evading or deflecting them (evades 80% at its accuracy of 3,786; a full one is 1.20 of your max hit).');
  });

  it('a row whose deflected hit kills counts only the evade chance: the record may not count deflection there, and the display says so', () => {
    const dir = copy('run-a12');
    // Evade 50%, deflect 60%: the deflected hit (1.1 of the max hit) kills too, so 50%, not 50 + 50 × 0.6 = 80.
    arbiter(dir, 'n', { avoid: { evade: 50, deflect: 60 }, rows: [{ type: 'physical', ratio: 1.3, hitsSurvived: 50, deflectedRatio: 1.1 }], field: { type: 'physical', oneShot: true } });
    expect(lines(check(dir).stderr, 'arbiter')).toEqual([]);
    expect(rungBlock(display(copy2(dir), 'design', ID).stdout, 'Non-budget endgame')).toContain('- The Arbiter of Divinity: one-shot by its physical hit (1.30 of your max hit); survives 50% of them by evading or deflecting (evades 50%, deflects 60% at its accuracy of 3,786; a deflected hit kills too, so only evading counts), under the 80% floor.');
    // A record that counts the deflect chance anyway reads past Names' rule; with its field agreeing, only the row fails.
    arbiter(dir, 'n', { avoid: { evade: 50, deflect: 60 }, rows: [{ type: 'physical', ratio: 1.3, hitsSurvived: 80, deflectedRatio: 1.1 }], field: { type: 'physical', oneShot: false } });
    expect(lines(check(dir).stderr, 'arbiter')).toEqual([expect.stringMatching(/compile-record\.json's n\.measures\.arbiter row "physical" is one-shot by its full hit \(ratio 1\.3\) and survives 80% of its hits, more than Names' rule gives: its deflected hit kills too \(1\.1 of the max hit\), so only the evade chance counts, at most 50%/)]);
  });

  it('beside a lightning row at 1.2 that clears on evasion, a physical row at 1.05 under the floor decides', () => {
    // Evade 82%: the lightning row survives 82% of its hits; the physical row's hit is unevadable (its data's
    // `evadable: false`), so it survives none. The physical row decides, though the lightning row's ratio is larger.
    const avoid = { evade: 82 };
    const rows = [{ type: 'lightning', ratio: 1.2, hitsSurvived: 82 }, { type: 'physical', ratio: 1.05, hitsSurvived: 0 }];
    const right = copy('run-a12');
    arbiter(right, 'n', { avoid, rows, field: { type: 'physical', oneShot: true } });
    expect(lines(check(right).stderr, 'arbiter')).toEqual([]);
    expect(rungBlock(display(copy2(right), 'design', ID).stdout, 'Non-budget endgame')).toContain('- The Arbiter of Divinity: one-shot by its physical hit (1.05 of your max hit); survives 0% of them by evading or deflecting (evades 82% at its accuracy of 3,786), under the 80% floor.');
    // The checker fails a design field whose deciding row is the one with the largest ratio.
    const wrong = copy('run-a12');
    arbiter(wrong, 'n', { avoid, rows, field: { type: 'lightning', oneShot: false } });
    expect(lines(check(wrong).stderr, 'arbiter')).toEqual([
      expect.stringMatching(/design\.rungs's "n"'s maxHit\.arbiter is the "lightning" row, but the record's deciding row is "physical": a rung's one-shot row with the lowest hits survived, else its row with the largest ratio/),
      expect.stringMatching(/maxHit\.oneShot is false, but the record's deciding row \(physical\) is one-shot by its full hit and survives 0% of its hits, under the 80% floor/),
    ]);
  });

  it("the design field's maxHit and resisting figure are the record's; a field without them fails", () => {
    const lowest = copy('run-a12');
    editJson(lowest, GATE, (g) => {
      rung(g, 'b').maxHit.lowest = { type: 'physical', value: 5100 };
    });
    expect(lines(check(lowest).stderr, 'arbiter')).toEqual([expect.stringMatching(/design\.rungs's "b"'s maxHit\.lowest is \{"type":"physical","value":5100\}, but the record's b\.measures\.toughness\.lowestMaxHit is \{"type":"chaos","value":3000\}/)]);
    const none = copy('run-a12');
    editJson(none, GATE, (g) => {
      delete rung(g, 'b').maxHit;
      delete rung(g, 'm').damage.resisting;
    });
    expect(lines(check(none).stderr, 'design-field')).toEqual([
      expect.stringMatching(/design\.rungs's "m" has damage \{"map":9000,"boss":10500\}; a design field written under amendment 12's rules gives \{map, resisting, boss\}/),
      expect.stringMatching(/design\.rungs's "b" has maxHit undefined; on b and n it is \{lowest, immune, arbiter, oneShot\}/),
    ]);
    const resisting = copy('run-a12');
    editJson(resisting, GATE, (g) => {
      rung(g, 'n').damage.resisting = 99000;
    });
    expect(lines(check(resisting).stderr, 'design-field')).toEqual([expect.stringMatching(/design\.rungs's "n"'s damage\.resisting is 99000, but the record's n\.measures\.damage\.resisting is 120000/)]);
  });
});

/** A second copy of a run folder, so a display (which records its visit) leaves the checked copy alone. */
function copy2(dir: string): string {
  const to = path.join(TMP, `display-${++copies}`);
  fs.cpSync(dir, to, { recursive: true });
  return to;
}

// ---------------------------------------------------------------------------------------------------
// AC-W93, bullet 2: the trades
// ---------------------------------------------------------------------------------------------------

describe('AC-W93 (D-450): the trades on a one-shot rung, the avoidance trade, and the trades by revision', () => {
  it('a one-shot rung (b or n) with no defence entry fails; with "none found: …" it passes', () => {
    const dir = copy('run-a12');
    arbiter(dir, 'b', { rows: [{ type: 'physical', ratio: 1.1, hitsSurvived: 0 }], field: { type: 'physical', oneShot: true } });
    expect(lines(check(dir).stderr, 'trades')).toEqual([expect.stringMatching(/the budget rung b is a one-shot rung \(the Arbiter's physical hit, under the 80% floor\), but no defence trade is shown for it/)]);
    setTrades(dir, [trade({ stage: 'b' }), damageN()]);
    expect(rules(check(dir).stderr, 'trades', 'arbiter', 'design-field')).toEqual([]);
    // The same on n, whose damage trade then carries the max hit it keeps.
    const n = copy('run-a12');
    arbiter(n, 'n', { ...CASE_796, field: { type: 'physical', oneShot: true } });
    toughN(n, { warning: ONE_SHOT_WARNING });
    setTrades(n, [damageN({ maxHit: { type: 'physical', before: 3451, after: 3451 } })]);
    expect(lines(check(n).stderr, 'trades')).toEqual([expect.stringMatching(/the non-budget rung n is a one-shot rung .*, but no defence trade is shown for it/)]);
    setTrades(n, [trade({}), damageN({ maxHit: { type: 'physical', before: 3451, after: 3451 } })]);
    expect(rules(check(n).stderr, 'trades', 'arbiter', 'toughness', 'design-field')).toEqual([]);
  });

  it("a damage trade on a one-shot rung whose maxHit.after is below its before fails; one with no maxHit fails", () => {
    const dir = copy('run-a12');
    arbiter(dir, 'n', { ...CASE_796, field: { type: 'physical', oneShot: true } });
    toughN(dir, { warning: ONE_SHOT_WARNING });
    setTrades(dir, [trade({}), damageN({ maxHit: { type: 'physical', before: 3451, after: 3300 } })]);
    expect(lines(check(dir).stderr, 'trades')).toEqual([expect.stringMatching(/the one-shot rung n's damage trade \("moving 6 points from Bone Breaker to Vicious Bite"\) lowers the deciding row's max hit, 3451 → 3300; a damage trade on a one-shot rung may not lower it/)]);
    setTrades(dir, [trade({}), damageN()]);
    expect(lines(check(dir).stderr, 'trades')).toEqual([expect.stringMatching(/the one-shot rung n's damage trade .* carries no maxHit \{type, before, after\}/)]);
    setTrades(dir, [trade({}), damageN({ maxHit: { type: 'physical', before: 3451, after: 3460 } })]);
    expect(lines(check(dir).stderr, 'trades')).toEqual([]);
  });

  it("an evasion build's b or n with no avoidance entry fails; with one each it passes", () => {
    const dir = copy('run-a12');
    replan(dir, (p) => {
      p.stages.find((s: Json) => s.id === 'n').defence.base = 'armour/evasion';
    });
    expect(lines(check(dir).stderr, 'trades')).toEqual([
      expect.stringMatching(/the budget rung b of an evasion build \(the non-budget rung's defence base "armour\/evasion"\) shows no avoidance trade/),
      expect.stringMatching(/the non-budget rung n of an evasion build .* shows no avoidance trade/),
    ]);
    const avoidance = (stage: string): Json => trade({ stage, kind: 'avoidance', what: 'none found: no deflection or evasion node within 20 points', reason: '' });
    setTrades(dir, [avoidance('b'), avoidance('n'), damageN()]);
    expect(rules(check(dir).stderr, 'trades', 'defence-plan')).toEqual([]);
    // A pure armour build (run-a12's) needs none.
    expect(lines(check(copy('run-a12')).stderr, 'trades')).toEqual([]);
  });

  it("a revision-12 build's trade without maxHit fails, and a revision-11 build's 7-field trade passes", () => {
    const dir = copy('run-a12');
    const seven = damageN();
    delete seven.maxHit;
    delete seven.hitsSurvived;
    setTrades(dir, [seven]);
    expect(lines(check(dir).stderr, 'trades')).toEqual([expect.stringMatching(/trades\.json's trades\[0\] is .*; a trade is \{stage, kind, what, ehpChange, damageChange, bossAfter, reason, maxHit, hitsSurvived\} in a build held to revision 12/)]);
    expect(Object.keys(readJson(path.join(FIXTURES, 'run-a11'), TRADES).trades[0])).toHaveLength(7);
    passes(copy('run-a11'));
    // And the other way: the 9 fields in a build held to 11 fail.
    const old = copy('run-a11');
    writeJson(old, TRADES, { trades: [damageN()] });
    editJson(old, GATE, (g) => {
      rung(g, 'n').trades = [damageN()];
    });
    expect(lines(check(old).stderr, 'trades')).toContainEqual(expect.stringMatching(/a trade is \{stage, kind, what, ehpChange, damageChange, bossAfter, reason\} \(Appendix A\)/));
  });

  it("trades.json's shape at revision 12: avoidance and defence on b or n, maxHit on defence and damage, hitsSurvived on defence and avoidance, a defence trade's reason", () => {
    const dir = copy('run-a12');
    setTrades(dir, [
      trade({ stage: 'm', kind: 'avoidance', reason: '' }),
      trade({ reason: 'more life' }),
      trade({ kind: 'avoidance', what: 'a rare helmet line', hitsSurvived: { before: 45, after: 52 }, maxHit: { type: 'physical', before: 1, after: 2 }, reason: '' }),
      damageN({ hitsSurvived: { before: 45, after: 120 } }),
    ]);
    expect(lines(check(dir).stderr, 'trades').filter((l) => l.includes('trades.json\'s trades['))).toEqual([
      expect.stringMatching(/trades\[0\] is a avoidance trade on m; defence and avoidance trades are on b or n/),
      expect.stringMatching(/trades\[1\]'s reason is "more life"; a defence trade's reason is "one-shot by the Arbiter's <type> hit" or "under the toughness band"/),
      expect.stringMatching(/trades\[2\] has maxHit on a avoidance trade; it is set on a one-shot rung's defence and damage entries only/),
      expect.stringMatching(/trades\[3\]'s hitsSurvived is \{"before":45,"after":120\}; null, or \{before, after\}, each 0–100/),
    ]);
  });
});

// ---------------------------------------------------------------------------------------------------
// AC-W93, bullet 3: the warning
// ---------------------------------------------------------------------------------------------------

describe('AC-W93 (D-449, G4 with G5 its first case): the warning', () => {
  it('within the band and one-shot gives the one-shot warning; a field without it, or with another, fails', () => {
    const dir = copy('run-a12');
    arbiter(dir, 'n', { ...CASE_796, field: { type: 'physical', oneShot: true } });
    setTrades(dir, [trade({}), damageN({ maxHit: { type: 'physical', before: 3451, after: 3451 } })]);
    toughN(dir, { ehp: 25000, band: 'within', warning: null });
    expect(lines(check(dir).stderr, 'toughness')).toEqual([expect.stringMatching(/design\.rungs's "n"'s toughness\.warning is null, but the EHP reads within its band while the Arbiter's physical hit one-shots the rung: the warning is \{kind: "one-shot", type "physical", fix\}/)]);
    toughN(dir, { warning: ONE_SHOT_WARNING });
    expect(lines(check(dir).stderr, 'toughness')).toEqual([]);
    expect(rungBlock(display(copy2(dir), 'design', ID).stdout, 'Non-budget endgame')).toContain("- Warning: the EHP reads within its band, but the Arbiter's physical hit one-shots this build, and 16% of the EHP is chance layers. The fix is the pool, armour or a physical shift.");
    toughN(dir, { warning: { kind: 'conditioned', type: 'chaos', fix: 'the pool or chaos resistance' } });
    expect(lines(check(dir).stderr, 'toughness')).toEqual([expect.stringMatching(/toughness\.warning is the conditioned warning, but the one-shot warning applies/)]);
    toughN(dir, { warning: { ...ONE_SHOT_WARNING, type: 'lightning', fix: 'the pool or lightning resistance' } });
    expect(lines(check(dir).stderr, 'toughness')).toEqual([expect.stringMatching(/one-shot warning names the "lightning" hit, but the deciding row's type is "physical"/)]);
    toughN(dir, { warning: { ...ONE_SHOT_WARNING, fix: 'more life' } });
    expect(lines(check(dir).stderr, 'toughness')).toEqual([expect.stringMatching(/one-shot warning's fix is "more life"; for a physical hit the fix family is "the pool, armour or a physical shift"/)]);
  });

  it('a conditioned EHP under the band gives the conditioned warning, naming its weakest hit', () => {
    const dir = copy('run-a12');
    toughN(dir, { conditioned: 15000, conditionedBand: 'under', warning: null });
    expect(lines(check(dir).stderr, 'toughness')).toEqual([expect.stringMatching(/toughness\.warning is null, but with every condition against it the EHP falls under its band: the warning is \{kind: "conditioned", type "chaos", fix\}/)]);
    toughN(dir, { warning: { kind: 'conditioned', type: 'chaos', fix: 'the pool or chaos resistance' } });
    expect(lines(check(dir).stderr, 'toughness')).toEqual([]);
    const block = rungBlock(display(copy2(dir), 'design', ID).stdout, 'Non-budget endgame');
    expect(block).toContain('- With every condition against it (unlucky rolls, hit recently, not blinded, Wind Dancer at 0): 15,000, under its band (18,000).');
    expect(block).toContain('- Warning: with every condition against it the EHP falls under its band; its weakest hit is chaos. The fix is the pool or chaos resistance.');
    // A conditioned band that disagrees with the record fails.
    toughN(dir, { conditionedBand: 'within' });
    expect(lines(check(dir).stderr, 'toughness')).toContainEqual(expect.stringMatching(/toughness\.conditioned\.band is "within", but the conditioned EHP 15000 against the 20000 target is under/));
  });

  it('neither gives none: a warning where none applies fails', () => {
    passes(copy('run-a12'));
    const dir = copy('run-a12');
    toughN(dir, { warning: ONE_SHOT_WARNING });
    expect(lines(check(dir).stderr, 'toughness')).toEqual([expect.stringMatching(/toughness\.warning is \{"kind":"one-shot".*\}, but no warning applies: the EHP is over its band and the rung is not one-shot, and the conditioned EHP is over its band/)]);
  });

  it("the chance-layer share and the ailment cut are the record's", () => {
    const dir = copy('run-a12');
    editJson(dir, GATE, (g) => {
      rung(g, 'n').toughness.chanceShare = 30;
    });
    expect(lines(check(dir).stderr, 'toughness')).toEqual([expect.stringMatching(/toughness\.chanceShare is 30, but the record's n\.measures\.toughness\.chance\.share is 0\.164, 16\.4%/)]);
    const cut = copy('run-a12');
    editJson(cut, RECORD, (r) => {
      Object.assign(r.stages.n.outputs, { DeflectChance: 85, DeflectEffect: 40 });
    });
    expect(lines(check(cut).stderr, 'toughness')).toEqual([expect.stringMatching(/toughness\.ailmentCut is null, but PoB's DeflectChance 85 × DeflectEffect 40 \/ 100 is 34/)]);
    editJson(cut, GATE, (g) => {
      rung(g, 'n').toughness.ailmentCut = 34;
    });
    expect(lines(check(cut).stderr, 'toughness')).toEqual([]);
  });
});

// ---------------------------------------------------------------------------------------------------
// AC-W93, bullet 4: the design display
// ---------------------------------------------------------------------------------------------------

describe("AC-W93 (D-449, D-450, Appendix A): the design display's lines", () => {
  it('prints the lowest max hit on b and n, and on n the chance-layer share and the conditioned line', () => {
    const out = display(copy('run-a12'), 'design', ID);
    expect(out).toMatchObject({ code: 0, stderr: '' });
    const b = rungBlock(out.stdout, 'Budget endgame');
    const n = rungBlock(out.stdout, 'Non-budget endgame');
    expect(b).toEqual(expect.arrayContaining(['- The Arbiter of Divinity: survives its hits (its worst, a physical hit, is 0.68 of your max hit).', '- Lowest max hit: 3,000 chaos.']));
    expect(b.indexOf('- Lowest max hit: 3,000 chaos.')).toBe(b.indexOf('- The Arbiter of Divinity: survives its hits (its worst, a physical hit, is 0.68 of your max hit).') + 1);
    expect(n).toEqual(expect.arrayContaining([
      '- Lowest max hit: 7,000 chaos.',
      '- Effective HP: 52,300; 16% of it from chance layers (evade, block, deflection).',
      '- With every condition against it (unlucky rolls, hit recently, not blinded, Wind Dancer at 0): 41,000, over its band (30,000).',
    ]));
    expect(n.join('\n')).not.toMatch(/Deflection cuts|Warning:|Note:/);
    expect(rungBlock(out.stdout, 'Entering maps').join('\n')).not.toMatch(/Lowest max hit|Arbiter/);
  });

  it('prints the ailment line on a deflecting build, and PG-100\'s note when the record says a companion takes part of each deflected hit', () => {
    const dir = copy('run-a12');
    editJson(dir, GATE, (g) => {
      rung(g, 'n').toughness.ailmentCut = 34;
    });
    // The record's avoid.companionDeflected, PoB's TakenFromCompanionBeforeYouFromDeflected (WU-120): 12% on n.
    arbiter(dir, 'n', { avoid: { ...CASE_796.avoid, companionDeflected: 12 }, rows: CASE_796.rows, field: { type: 'physical', oneShot: true } });
    const out = display(copy2(dir), 'design', ID).stdout;
    const n = rungBlock(out, 'Non-budget endgame');
    expect(n).toContain("- Deflection cuts ailment damage from hits by about 34% on average; PoB doesn't apply it.");
    expect(n).toContain('- Note: a companion takes part of each deflected hit, so hits survived reads high (PG-100).');
    expect(n.indexOf('- Note: a companion takes part of each deflected hit, so hits survived reads high (PG-100).')).toBe(n.indexOf('- Lowest max hit: 7,000 chaos.') + 1);
    expect(rungBlock(out, 'Budget endgame').join('\n')).not.toMatch(/Note:/);
    // The note reads the record's field, not the gear's text: Forgotten Warden's line alone (the pinned data's words,
    // Data/Uniques/body.lua) with no companionDeflected in the record prints none.
    const text = copy('run-a12');
    replan(text, (p) => {
      p.stages.find((s: Json) => s.id === 'n').items.slots.find((x: Json) => x.slot === 'Body Armour').text = "Rarity: Unique\nForgotten Warden\nPrimal Markings\nImplicits: 1\nGrants Skill: Level 20 Spirit Vessel\n+85 to Deflection Rating per 50 missing Energy Shield\n250% increased Evasion and Energy Shield\n+25 to Dexterity\nCompanions have 40% increased maximum Life\n12% of Damage from Deflected Hits is taken from Damageable Companion's Life before you";
    });
    expect(display(text, 'design', ID).stdout).not.toMatch(/Note: a companion/);
  });

  it("prints the defence (one-shot) and avoidance trades in Appendix A's forms, a max hit only when the trade moves it", () => {
    const dir = copy('run-a12');
    arbiter(dir, 'n', { ...CASE_796, field: { type: 'physical', oneShot: true } });
    setTrades(dir, [
      trade({ what: 'a rare body with +90 life', damageChange: -0.2, maxHit: { type: 'physical', before: 3451, after: 3520 } }),
      trade({ what: '12 points into deflection (Deflection, Deflection)', ehpChange: 4, damageChange: -3, maxHit: { type: 'physical', before: 3451, after: 3451 }, hitsSurvived: { before: 79.6, after: 84 }, reason: "one-shot by the Arbiter's physical hit; cuts Hammer of the Gods against a boss by 4%" }),
      trade({ kind: 'avoidance', what: '20 points into deflection (Deflection, Deflection)', ehpChange: 6, damageChange: -8, hitsSurvived: { before: 45, after: 71 }, reason: 'the same 20 points on the best EHP nodes: +14% EHP, hits survived 45%' }),
      trade({ kind: 'avoidance', what: "a rare helmet's deflection rating line (about 2 divines, 0 points)", ehpChange: 1, damageChange: -0.2, hitsSurvived: { before: 45, after: 52 }, reason: '' }),
      damageN({ maxHit: { type: 'physical', before: 3451, after: 3451 } }),
    ]);
    const n = rungBlock(display(dir, 'design', ID).stdout, 'Non-budget endgame');
    expect(n.slice(n.findIndex((l) => l.startsWith('- Defence')))).toEqual([
      "- Defence (one-shot): a rare body with +90 life: the Arbiter's physical max hit (Pinnacle pass) 3,451 → 3,520, survives the full hit; −0.2% damage.",
      '- Defence (one-shot): 12 points into deflection (Deflection, Deflection): hits survived 79% → 84%; +4% EHP, −3% damage; cuts Hammer of the Gods against a boss by 4%.',
      '- Avoidance: 20 points into deflection (Deflection, Deflection): hits survived 45% → 71%; +6% EHP, −8% damage (the same 20 points on the best EHP nodes: +14% EHP, hits survived 45%).',
      "- Avoidance: a rare helmet's deflection rating line (about 2 divines, 0 points): hits survived 45% → 52%; +1% EHP, −0.2% damage.",
      '- Damage: moving 6 points from Bone Breaker to Vicious Bite: +18% damage (boss about 247,800), −12% EHP.',
    ]);
  });

  it('marks a deflected hit read by formula on a build with armour as optimistic', () => {
    const dir = copy('run-a12');
    arbiter(dir, 'n', { avoid: { ...CASE_796.avoid, method: 'formula' }, rows: CASE_796.rows, field: { type: 'physical', oneShot: true } });
    const line = "- The Arbiter of Divinity: one-shot by its physical hit (1.01 of your max hit); survives 79% of them by evading or deflecting (evades 32%, deflects 70% at its accuracy of 3,786; a deflected hit is 0.61 of your max hit%s), under the 80% floor.";
    expect(rungBlock(display(copy2(dir), 'design', ID).stdout, 'Non-budget endgame')).toContain(line.replace('%s', ''));
    editJson(dir, RECORD, (r) => {
      r.stages.n.outputs.Armour = 12000;
    });
    expect(rungBlock(display(copy2(dir), 'design', ID).stdout, 'Non-budget endgame')).toContain(line.replace('%s', ' (by formula; optimistic with armour)'));
    expect(lines(check(dir).stderr, 'arbiter')).toEqual([]);
  });

  it('a design field written under amendment 11 keeps its display (run-a11)', () => {
    const out = display(copy('run-a11'), 'design', ID).stdout;
    expect(out).toContain('- The Arbiter of Divinity: survives its hits (its worst, a physical hit, is 0.47 of your max hit).');
    expect(out).not.toMatch(/Lowest max hit|Resisting rares|chance layers|With every condition/);
  });
});

// ---------------------------------------------------------------------------------------------------
// AC-W93, bullet 5: the resisting figure
// ---------------------------------------------------------------------------------------------------

describe('AC-W93 (D-454): the resisting figure', () => {
  it('prints on the design and final gates and in the audit\'s stage table', () => {
    const design = display(copy('run-a12'), 'design', ID).stdout;
    expect(rungBlock(design, 'Non-budget endgame')).toEqual(expect.arrayContaining(['- Boss floor: 210,000, under the 250,000 floor.', '- Resisting rares: 120,000 per second (40% fire, cold and lightning resistance).']));
    expect(rungBlock(design, 'Entering maps')).toContain('- Resisting rares: 8,100 per second (40% fire, cold and lightning resistance).');
    const final = display(copy('run-a12'), 'final', ID).stdout;
    expect(final).toContain("- Non-budget endgame (level 95): 140,000 damage per second against map monsters, 120,000 against resisting rares, 210,000 against a Pinnacle boss; Effective HP 52,300, survives the Arbiter's hits,");
    const audit = fs.readFileSync(path.join(FIXTURES, 'run-a12', AUDIT), 'utf8');
    expect(audit).toContain('| Loadout | Level | Life | Damage, map / resisting / boss |');
    expect(audit).toContain('| Endgame non-budget (L95) {n} | 95 | 5600 | 140000 / 120000 / 210000 |');
    // The committed audit is the render (the checker passes run-a12), and an old record keeps two figures.
    expect(fs.readFileSync(path.join(FIXTURES, 'run-a11', AUDIT), 'utf8')).toContain('| Loadout | Level | Life | Damage, map / boss |');
  });

  it('a guide verdict line with three figures passes against the record, and an old guide\'s two-figure line against an old record', () => {
    passes(copy('run-a12'));
    passes(copy('run-a11'));
    const differs = copy('run-a12');
    editText(differs, GUIDE, 'about 120,000 against resisting rares', 'about 99,000 against resisting rares');
    expect(lines(check(differs).stderr, 'verdict-line')).toEqual([expect.stringMatching(/the Non-budget verdict line says damage against resisting rares 99,000, but n\.measures\.damage\.resisting is 120000/)]);
    const two = copy('run-a12');
    editText(two, GUIDE, 'Blood Hunt about 140,000 DPS against map monsters, about 120,000 against resisting rares, about 210,000 against a Pinnacle boss.', 'Blood Hunt about 140,000 DPS against map monsters, about 210,000 against a Pinnacle boss.');
    expect(lines(check(two).stderr, 'verdict-line')).toEqual([expect.stringMatching(/the Non-budget verdict line gives two damage figures, but stage n's record measures it against resisting rares too \(measures\.damage\.resisting\)/)]);
    const old = copy('run-a11');
    editText(old, GUIDE, 'Blood Hunt about 140,000 DPS against map monsters, about 210,000 against a Pinnacle boss.', 'Blood Hunt about 140,000 DPS against map monsters, about 120,000 against resisting rares, about 210,000 against a Pinnacle boss.');
    expect(lines(check(old).stderr, 'verdict-line')).toEqual([expect.stringMatching(/gives a figure against resisting rares, but stage n's record has no measures\.damage\.resisting to compare it with/)]);
  });
});

// ---------------------------------------------------------------------------------------------------
// AC-W93, bullet 6: revisions by order, one boundary per revision
// ---------------------------------------------------------------------------------------------------

describe('AC-W93 (§22, Appendix A): revisions compare by order, each with its own boundary', () => {
  it('init writes skillRevision 13 (12 before amendment 13); a revision-11 log (run-a11) passes unchanged and keeps amendment 11\'s rules from its own boundary', () => {
    const dir = path.join(TMP, `log-${++copies}`);
    fs.mkdirSync(dir);
    expect(write(dir, 'init', { slug: 'titan-blood-hunt', brief: { ascendancy: 'Titan', skill: 'Blood Hunt' }, mode: 'offline', testConfig: 'none', noNinja: false }).code).toBe(0);
    expect(readJson(dir, 'run-log.json')).toMatchObject({ skillRevision: 13 });
    expect(readJson(dir, 'run-log.json')).not.toHaveProperty('skillRevisionFrom');
    const a11 = copy('run-a11');
    expect(readJson(a11, 'run-log.json').skillRevision).toBe(11);
    passes(a11);
    // Amendment 11's rules hold in it (no rival) and amendment 12's don't (its respec route stands).
    editJson(a11, 'run-log.json', (l) => {
      l.stages.push({ stage: 'RV', attempt: 1, outcome: 'none-found', tried: 'a slam opener' });
    });
    expect(lines(check(a11).stderr, 'rival')).toEqual([expect.stringMatching(/stages\[14\] runs the rival \(RV\), which amendment 11 removes/)]);
    expect(lines(check(a11).stderr, 'respec')).toEqual([]);
    // A skillRevision that isn't 11, 12 or 13 fails.
    const bad = copy('run-a11');
    editJson(bad, 'run-log.json', (l) => {
      l.skillRevision = 14;
    });
    expect(lines(check(bad).stderr, 'run-log')).toContainEqual(expect.stringMatching(/run-log\.json skillRevision: is 14; 11 or 12 or 13/));
  });

  it("a revision-11 log resumed now keeps 11's boundary and gains 12's (and 13's, amendment 13)", () => {
    // run-builds stamped at 11 by its first resume (amendment 11's flat boundary), then resumed now.
    const dir = copy('run-builds');
    editJson(dir, 'run-log.json', (l) => {
      Object.assign(l, { skillRevision: 11, skillRevisionFrom: { ...l.resumes[0].lengths }, pricing: { stops: [], retries: [] } });
    });
    const at11 = { ...readJson(dir, 'run-log.json').skillRevisionFrom };
    const before = readJson(dir, 'run-log.json');
    expect(write(dir, 'resume', { noNinja: false })).toMatchObject({ code: 0, stdout: `run-log: wrote resumes[${before.resumes.length}], status running, skillRevision 13 from stages[${before.stages.length}] (the rules of amendments 12 and 13)\n` });
    const log = readJson(dir, 'run-log.json');
    expect(log.skillRevision).toBe(13);
    expect(log.skillRevisionFrom).toEqual({ 11: at11, 12: log.resumes[log.resumes.length - 1].lengths, 13: log.resumes[log.resumes.length - 1].lengths });
    expect(lines(check(dir).stderr, 'run-log')).toEqual([]);
    // Resumed again, nothing more is stamped.
    expect(write(dir, 'resume', { noNinja: false }).stdout).toBe(`run-log: wrote resumes[${before.resumes.length + 1}], status running\n`);
    expect(readJson(dir, 'run-log.json').skillRevisionFrom).toEqual(log.skillRevisionFrom);
    // A boundary no resume recorded fails, and so does 12's before 11's.
    editJson(dir, 'run-log.json', (l) => {
      l.skillRevisionFrom['12'] = { ...l.skillRevisionFrom['12'], stages: 3 };
    });
    expect(lines(check(dir).stderr, 'run-log')).toEqual([expect.stringMatching(/skillRevisionFrom: "12" is .*, but no resumes\[\] entry recorded those lengths/)]);
    // A revision-11 log init wrote (no boundary) resumed at 12 gains 12's alone.
    const fresh = copy('run-a11');
    expect(write(fresh, 'resume', { noNinja: false }).code).toBe(0);
    expect(Object.keys(readJson(fresh, 'run-log.json').skillRevisionFrom)).toEqual(['12', '13']);
    passes(fresh);
  });

  it('a log from before amendment 11 resumed now gains every boundary at the same lengths, so its earlier entries are held to none', () => {
    const dir = copy('run-builds');
    const before = readJson(dir, 'run-log.json');
    expect(before).not.toHaveProperty('skillRevision');
    expect(write(dir, 'resume', { noNinja: false })).toMatchObject({ code: 0, stdout: `run-log: wrote resumes[${before.resumes.length}], status running, skillRevision 13 from stages[${before.stages.length}] (the rules of amendments 11, 12 and 13)\n` });
    const log = readJson(dir, 'run-log.json');
    const lengths = log.resumes[log.resumes.length - 1].lengths;
    expect(log.skillRevisionFrom).toEqual({ 11: lengths, 12: lengths, 13: lengths });
    // Its entries before the stamp keep their rules: no amendment-11 or amendment-12 rule fires on them.
    const stderr = check(dir).stderr;
    expect(rules(stderr, 'run-log', 'rival', 'toughness', 'dossier-sections', 'design-field', 'arbiter', 'trades', 'respec', 'defence-plan')).toEqual([]);
    // An entry after the stamp is held to both: amendment 11's rival and amendment 12's respec both fail there.
    editJson(dir, 'run-log.json', (l) => {
      l.stages.push({ stage: 'RV', attempt: 1, outcome: 'none-found', tried: 'a slam opener' });
      l.stages.push({ stage: 'D1-tree', concept: 'r1-a-1', attempt: 9, outcome: 'respec' });
    });
    const after = check(dir).stderr;
    expect(lines(after, 'rival')).toEqual([expect.stringMatching(new RegExp(`stages\\[${before.stages.length}\\] runs the rival`))]);
    expect(lines(after, 'respec')).toEqual([expect.stringMatching(new RegExp(`stages\\[${before.stages.length + 1}\\] \\(D1-tree r1-a-1 attempt 9\\) is a respec, which amendment 12 removes`))]);
  });
});

// ---------------------------------------------------------------------------------------------------
// AC-W93, bullet 7: the defence plan and the respec route
// ---------------------------------------------------------------------------------------------------

describe('AC-W93 (D-451, D-452): a skillRevision 12 run', () => {
  it("a schema-8 plan's n without defence fails, and a schema-7 plan's passes", () => {
    const dir = copy('run-a12');
    replan(dir, (p) => {
      delete p.stages.find((s: Json) => s.id === 'n').defence;
    });
    expect(lines(check(dir).stderr, 'defence-plan')).toEqual([expect.stringMatching(/plan\.json's non-budget rung n has no defence \{base, chance, mitigation, pool, physicalHit\}; in a run held to amendment 12 a schema-8 plan states its defence plan on n/)]);
    replan(dir, (p) => {
      p.schemaVersion = 7;
    });
    expect(lines(check(dir).stderr, 'defence-plan')).toEqual([]);
    const base = copy('run-a12');
    replan(base, (p) => {
      p.stages.find((s: Json) => s.id === 'n').defence.base = 'deflection';
    });
    expect(lines(check(base).stderr, 'defence-plan')).toEqual([expect.stringMatching(/base is one of armour, evasion, energy shield, armour\/evasion, armour\/energy shield, evasion\/energy shield/)]);
  });

  it('a D1-tree respec outcome fails, and run-log.mjs refuses it; an old run\'s respec route passes', () => {
    const dir = copy('run-a12');
    const st = (stage: string, attempt: number, outcome: string): Json => ({ stage, concept: ID, attempt, outcome });
    editJson(dir, 'run-log.json', (l) => {
      l.stages = [...l.stages.slice(0, 7), st('D1-build', 1, 'done'), st('D1-tree', 1, 'respec'), st('D1-build', 2, 'done'), st('D1-tree', 2, 'done'), st('D1-finish', 1, 'done'), ...l.stages.slice(10)];
    });
    expect(lines(check(dir).stderr, 'respec')).toEqual([expect.stringMatching(/run-log\.json stages\[8\] \(D1-tree r1-a-2 attempt 1\) is a respec, which amendment 12 removes: in a run held to its rules \(skillRevision 12\) each loadout's tree is its own/)]);
    expect(write(dir, 'stage', { stage: 'D1-tree', concept: ID, attempt: 3, outcome: 'respec' })).toMatchObject({ code: 1, stderr: expect.stringMatching(/stage entry refused: a run held to amendment 12 \(skillRevision 12\) has no respec/) });
    // run-a11, at revision 11, keeps the route.
    const old = copy('run-a11');
    editJson(old, 'run-log.json', (l) => {
      l.stages = [...l.stages.slice(0, 7), st('D1-build', 1, 'done'), st('D1-tree', 1, 'respec'), st('D1-build', 2, 'done'), st('D1-tree', 2, 'done'), st('D1-finish', 1, 'done'), ...l.stages.slice(10)];
    });
    expect(rules(check(old).stderr, 'respec', 'order')).toEqual([]);
  });
});

// ---------------------------------------------------------------------------------------------------
// AC-W93, bullet 8: the tree-change line
// ---------------------------------------------------------------------------------------------------

describe('AC-W93 (D-452): the guide\'s tree-change line', () => {
  it("passes with treeChange's counts; a line whose counts differ fails, and so does a missing one", () => {
    const fixture = readJson(path.join(FIXTURES, 'run-a12'), RECORD);
    expect([fixture.stages.b.treeChange, fixture.stages.n.treeChange]).toEqual([{ from: 'm', refunded: 0, added: 6 }, { from: 'b', refunded: 2, added: 2 }]);
    const differs = copy('run-a12');
    editText(differs, GUIDE, 'Respec: refund 2 points and allocate 2;', 'Respec: refund 3 points and allocate 2;');
    expect(lines(check(differs).stderr, 'tree-change')).toEqual([expect.stringMatching(/guide\.md's "Endgame: non-budget"'s tree-change line refunds 3 points and allocates 2, but stage n's treeChange from "b" is refunded 2, added 2: "Respec: refund 2 points and allocate 2; respeccing costs gold\."/)]);
    const missing = copy('run-a12');
    editText(missing, GUIDE, '\nRespec: refund 2 points and allocate 2; respeccing costs gold.\n', '');
    expect(lines(check(missing).stderr, 'tree-change')).toEqual([expect.stringMatching(/guide\.md's "Endgame: non-budget" has no tree-change line for stage n, whose treeChange from "b" refunds 2 points and allocates 2/)]);
    // b refunds nothing, so it has no line.
    const extra = copy('run-a12');
    editText(extra, GUIDE, 'Move here once you own both rings.\n', 'Move here once you own both rings.\n\nRespec: refund 0 points and allocate 6; respeccing costs gold.\n');
    expect(lines(check(extra).stderr, 'tree-change')).toEqual([expect.stringMatching(/guide\.md's "Endgame: budget" has a tree-change line, but stage b's treeChange refunds no point/)]);
  });
});

// ---------------------------------------------------------------------------------------------------
// AC-W93, bullet 9: the verdict label's three forms
// ---------------------------------------------------------------------------------------------------

describe("AC-W93 (D-459): the verdict label's three forms", () => {
  /** A copy of run-a12 whose n reads `c`, its field agreeing, its guide's n label `label`. */
  function labelled(c: { avoid: Json; rows: Row[] }, oneShot: boolean, label: string): string {
    const dir = copy('run-a12');
    arbiter(dir, 'n', { ...c, field: { type: 'physical', oneShot } });
    editText(dir, GUIDE, "**Non-budget (L95): survives the Arbiter's hits.**", `**Non-budget (L95): ${label}.**`);
    return dir;
  }

  it('each form passes against the record and the targets file, and a label that disagrees fails', () => {
    passes(copy('run-a12'));
    expect(lines(check(labelled(CASE_80, false, LABEL_80)).stderr, 'survival-label')).toEqual([]);
    expect(lines(check(labelled(CASE_796, true, LABEL_796)).stderr, 'survival-label')).toEqual([]);
    expect(lines(check(labelled(CASE_796, true, "one-shot by the Arbiter's physical hit")).stderr, 'survival-label')).toEqual([expect.stringMatching(/the Non-budget verdict line's label is "one-shot by the Arbiter's physical hit", but stage n's deciding Arbiter row is the physical row \(ratio 1\.01, hits survived 79\.6%\), under the 80% floor, so its label is "one-shot by the Arbiter's physical hit \(it survives 79% of them\)"/)]);
    expect(lines(check(labelled(CASE_80, false, "survives the Arbiter's hits")).stderr, 'survival-label')).toEqual([expect.stringMatching(/so its label is "survives 80% of the Arbiter's physical hits, by evading or deflecting them"/)]);
    // A one-shot rung that survives none of its hits has no parenthesis.
    expect(lines(check(labelled({ avoid: { evade: 0 }, rows: [{ type: 'physical', ratio: 1.2, hitsSurvived: 0 }] }, true, "one-shot by the Arbiter's physical hit")).stderr, 'survival-label')).toEqual([]);
    // An old record keeps amendment 11's label.
    passes(copy('run-a11'));
  });

  it("the audit's Arbiter line, the final gate's rung lines and the design-to-final comparison print the same forms", () => {
    const one = labelled(CASE_796, true, LABEL_796);
    expect(node(RENDER, [one, '--build', ID])).toMatchObject({ code: 0, stderr: '' });
    expect(fs.readFileSync(path.join(one, AUDIT), 'utf8')).toContain('- The Arbiter of Divinity: one-shot by its physical hit, at 1.01 of your max hit; it survives 79% of them.');
    expect(display(one, 'final', ID).stdout).toContain(`- Non-budget endgame (level 95): 140,000 damage per second against map monsters, 120,000 against resisting rares, 210,000 against a Pinnacle boss; Effective HP 52,300, ${LABEL_796}, clear speed slow (rough)`);
    const floor = labelled(CASE_80, false, LABEL_80);
    expect(node(RENDER, [floor, '--build', ID]).code).toBe(0);
    expect(fs.readFileSync(path.join(floor, AUDIT), 'utf8')).toContain('- The Arbiter of Divinity: survives 80% of its physical hits, by evading or deflecting them; a full one is 1.01 of your max hit.');
    expect(fs.readFileSync(path.join(FIXTURES, 'run-a12', AUDIT), 'utf8')).toContain('- The Arbiter of Divinity: survives its hits; its worst, physical hit, is 0.47 of your max hit.');
    // The design gate read 82%; the final build reads 79.6%: the comparison prints both in the label's forms.
    const moved = labelled(CASE_796, true, LABEL_796);
    editJson(moved, GATE, (g) => {
      Object.assign(rung(g, 'n').maxHit, { oneShot: false });
      rung(g, 'n').maxHit.arbiter.hitsSurvived = 82;
    });
    const final = display(moved, 'final', ID).stdout.split('\n');
    const at = final.findIndex((l) => l.startsWith('- Non-budget endgame (level 95):'));
    expect(final[at]).toContain(LABEL_796);
    expect(final[at + 1]).toMatch(/^ {2}At the design gate: .*; Effective HP 52,300, survives 82% of the Arbiter's physical hits, by evading or deflecting them, clear speed medium \(rough\)\.$/);
  });
});

// ---------------------------------------------------------------------------------------------------
// AC-W93, bullet 10: the floor in the targets file
// ---------------------------------------------------------------------------------------------------

describe('AC-W93 (Appendix A): references/toughness-targets.json holds the Arbiter floor, and the checker reads it', () => {
  it('holds hitsSurvivedFloor 0.8 beside amendment 11\'s targets', () => {
    expect(readJson(SKILL, 'references/toughness-targets.json')).toEqual({
      rung: 'non-budget', targets: { close: 20000, distance: 15000 }, under: 0.9, over: 1.5, source: 'studies/2026-10-25-toughness-floors.md',
      arbiter: { hitsSurvivedFloor: 0.8, accuracyFact: 'enemies/arbiter-of-divinity.json#base.accuracy', source: 'the user, 2026-10-27; studies/2026-10-26-sizing.md' },
    });
  });

  it('with the floor at 0.75 in the file, a row that survives 79.6% of its hits is no one-shot rung', () => {
    // The repository's layout in a temp dir, its targets file's floor changed: the scripts read the file beside them.
    const root = path.join(TMP, `repo-${++copies}`);
    const scripts = path.join(root, '.claude', 'skills', 'build-guide', 'scripts');
    fs.mkdirSync(scripts, { recursive: true });
    for (const f of fs.readdirSync(SCRIPTS).filter((x) => x.endsWith('.mjs'))) fs.copyFileSync(path.join(SCRIPTS, f), path.join(scripts, f));
    fs.cpSync(path.join(SKILL, 'references'), path.join(root, '.claude', 'skills', 'build-guide', 'references'), { recursive: true });
    fs.symlinkSync(path.join(REPO, 'build'), path.join(root, 'build'));
    fs.symlinkSync(path.join(REPO, 'data'), path.join(root, 'data'));
    fs.copyFileSync(path.join(REPO, 'pob-pin.json'), path.join(root, 'pob-pin.json'));
    editJson(root, '.claude/skills/build-guide/references/toughness-targets.json', (t) => {
      t.arbiter.hitsSurvivedFloor = 0.75;
    });
    const dir = copy('run-a12');
    arbiter(dir, 'n', { ...CASE_796, field: { type: 'physical', oneShot: true } });
    const there = node(path.join(scripts, 'check-run.mjs'), [dir]).stderr;
    expect(lines(there, 'arbiter')).toEqual([expect.stringMatching(/maxHit\.oneShot is true, but the record's deciding row \(physical\) is one-shot by its full hit and survives 79\.6% of its hits, at or over the 75% floor/)]);
    // Here, at 0.8, the same field passes.
    expect(lines(check(dir).stderr, 'arbiter')).toEqual([]);
  });
});

// ---------------------------------------------------------------------------------------------------
// The record as WU-119 and WU-120 built it: run-a12 against the server's own code, and the record's null cases
// ---------------------------------------------------------------------------------------------------

describe('AC-W93: run-a12 is a run the amended pipeline could write', () => {
  it("its plan is a valid schema-8 plan, and its record's treeChange is the compiler's treeChangeOf", () => {
    const text = fs.readFileSync(path.join(FIXTURES, 'run-a12', PLAN), 'utf8');
    const result = validatePlan(text, loadReferenceData());
    expect(result.ok ? [] : result.errors).toEqual([]);
    const plan = JSON.parse(text) as Json;
    expect(plan.schemaVersion).toBe(8);
    const rec = readJson(path.join(FIXTURES, 'run-a12'), RECORD);
    for (const st of plan.stages) expect({ id: st.id, treeChange: rec.stages[st.id].treeChange ?? null }).toEqual({ id: st.id, treeChange: treeChangeOf(plan as Parameters<typeof treeChangeOf>[0], st) });
  });

  it("the scripts' deciding row is the compiler's decidingRow, a one-shot row with no ratio (a max hit of 0) the largest", () => {
    const rows = (xs: Json[]): ArbiterMeasure => ({ verdict: 'one-shot', worst: null, rows: xs.map((x) => ({ mixed: false, hitId: x.type, hit: 3000, maxHit: null, deflectedRatio: null, deflectedVerdict: null, ...x })) }) as unknown as ArbiterMeasure;
    const zero = rows([{ type: 'physical', ratio: 1.4, verdict: 'one-shot', hitsSurvived: 30 }, { type: 'lightning', ratio: null, maxHit: 0, verdict: 'one-shot', hitsSurvived: 30 }]);
    expect(decidingRow(zero)?.type).toBe('lightning');
    const dir = copy('run-a12');
    editJson(dir, RECORD, (r) => {
      Object.assign(r.stages.n.measures.arbiter, { verdict: 'one-shot', avoid: { accuracy: 3786, evade: 30, deflect: 0, deflectEffect: 40, method: 'pass' } });
      Object.assign(r.stages.n.measures.arbiter.rows[0], { ratio: 1.4, maxHit: 2490, verdict: 'one-shot', hitsSurvived: 30 });
      Object.assign(r.stages.n.measures.arbiter.rows[1], { ratio: null, maxHit: 0, verdict: 'one-shot', hitsSurvived: 30 });
    });
    editJson(dir, GATE, (g) => {
      rung(g, 'n').maxHit.arbiter = { type: 'lightning', evade: 30, deflect: 0, hitsSurvived: 30, deflectedRatio: null, method: 'pass' };
      rung(g, 'n').maxHit.oneShot = true;
    });
    expect(lines(check(dir).stderr, 'arbiter')).toEqual([]);
    expect(rungBlock(display(copy2(dir), 'design', ID).stdout, 'Non-budget endgame')).toContain('- The Arbiter of Divinity: one-shot by its lightning hit (a max hit of 0); survives 30% of them by evading or deflecting (evades 30% at its accuracy of 3,786), under the 80% floor.');
    expect(node(RENDER, [dir, '--build', ID]).code).toBe(0);
    expect(fs.readFileSync(path.join(dir, AUDIT), 'utf8')).toContain('- The Arbiter of Divinity: one-shot by its lightning hit, over a max hit of 0; it survives 30% of them.');
    editText(dir, GUIDE, "**Non-budget (L95): survives the Arbiter's hits.**", "**Non-budget (L95): one-shot by the Arbiter's lightning hit (it survives 30% of them).**");
    expect(lines(check(dir).stderr, 'survival-label')).toEqual([]);
  });

  it('a row with no verdict has no hits survived and reads "not measured against the Arbiter"; an immune row survives in full', () => {
    const dir = copy('run-a12');
    editJson(dir, RECORD, (r) => {
      const a = r.stages.n.measures.arbiter;
      a.verdict = null;
      Object.assign(a.rows[1], { ratio: null, maxHit: null, verdict: null, hitsSurvived: null });
      Object.assign(a.rows[2], { ratio: 0, maxHit: null, verdict: 'survives', immune: true, hitsSurvived: 100 });
    });
    // Amendment 13 (§15, M-25's leftover): the design field no longer reads as surviving: its deciding row is null.
    editJson(dir, GATE, (g) => {
      rung(g, 'n').maxHit.arbiter = null;
    });
    expect(lines(check(dir).stderr, 'arbiter')).toEqual([]);
    expect(lines(check(dir).stderr, 'survival-label')).toEqual([expect.stringMatching(/so its label is "not measured against the Arbiter"/)]);
    expect(node(RENDER, [dir, '--build', ID]).code).toBe(0);
    expect(fs.readFileSync(path.join(dir, AUDIT), 'utf8')).toMatch(/### Endgame non-budget \(L95\) \{n\}[\s\S]*- The Arbiter of Divinity: not measured\./);
  });

  it("with nothing getting through (share 1, factor null) the chance-layer share is 100%; a null resisting figure stays null in the field", () => {
    const dir = copy('run-a12');
    editJson(dir, RECORD, (r) => {
      r.stages.n.measures.toughness.chance = { notHit: 100, damage: 100, factor: null, share: 1 };
      r.stages.m.measures.damage.resisting = null;
    });
    editJson(dir, GATE, (g) => {
      rung(g, 'n').toughness.chanceShare = 100;
      rung(g, 'm').damage.resisting = null;
    });
    expect(rules(check(dir).stderr, 'toughness', 'design-field')).toEqual([]);
    expect(rungBlock(display(copy2(dir), 'design', ID).stdout, 'Non-budget endgame')).toContain('- Effective HP: 52,300; 100% of it from chance layers (evade, block, deflection).');
    editJson(dir, GATE, (g) => {
      rung(g, 'm').damage.resisting = 8100;
    });
    expect(lines(check(dir).stderr, 'design-field')).toEqual([expect.stringMatching(/design\.rungs's "m"'s damage\.resisting is 8100, but the record's m\.measures\.damage\.resisting is null/)]);
  });
});
