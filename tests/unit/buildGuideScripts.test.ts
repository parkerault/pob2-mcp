/**
 * WU-71: the build-guide runner's two scripts, each spawned as a real `node` process on a temp run folder
 * (tests/helpers/guideRunFolder.ts):
 *
 * - `scripts/render-audit.mjs <runFolder>` (D-355) renders `audit.md` in the form of `templates/audit-template.md`
 *   from the plan, the final compile record and the D1 gate's last verdict file, and a re-render keeps the rows W1
 *   added under `Known issues`;
 * - `scripts/run-log.mjs <runFolder> <kind> '<json>'` (D-356), or `-` for the JSON on stdin, writes the run log in
 *   `references/run-log.md`'s entry form, appending one entry per call, and refuses an entry outside that form;
 *   `run-log.mjs <runFolder> display <gate>` (D-367) prints a gate visit's display from the run folder's files and
 *   records it, the final gate's with each endgame rung's final figures (D-369), and a gate's answer is refused
 *   until its visit's display is recorded.
 *
 * `--snapshot` and `--changed` (A-34, D-352) are `check-run.mjs`'s, tested in buildGuideCheckRun.test.ts.
 * The render loads the server's compiled `build/plan/ledger.js`: `mise run test` builds before Jest runs.
 */
import { describe, it, expect, afterAll } from '@jest/globals';
import { spawnSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { CARD, GATE_FILE, editJson, readJson, writeGuideRun, type Json } from '../helpers/guideRunFolder';

const REPO = path.resolve(__dirname, '..', '..');
const SKILL_DIR = path.join(REPO, '.claude', 'skills', 'build-guide');
const RENDER = path.join(SKILL_DIR, 'scripts', 'render-audit.mjs');
const RUN_LOG = path.join(SKILL_DIR, 'scripts', 'run-log.mjs');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'guide-scripts-'));

afterAll(() => fs.rmSync(TMP, { recursive: true, force: true }));

function run(script: string, ...args: string[]) {
  return runWith(undefined, script, ...args);
}
/** `run` with `input` on the child's stdin, as a heredoc gives it. */
function runWith(input: string | undefined, script: string, ...args: string[]) {
  const r = spawnSync(process.execPath, [script, ...args], { cwd: TMP, env: { PATH: '/usr/bin:/bin', LANG: 'C' }, encoding: 'utf8', timeout: 30000, input });
  return { code: r.status, stdout: r.stdout, stderr: r.stderr };
}
let folders = 0;
const folder = () => {
  const dir = path.join(TMP, `run-${++folders}`);
  fs.mkdirSync(dir);
  return dir;
};
const guideRun = () => writeGuideRun(folder());
const audit = (dir: string) => fs.readFileSync(path.join(dir, 'audit.md'), 'utf8');
function render(dir: string): string {
  const r = run(RENDER, dir);
  expect({ code: r.code, stderr: r.stderr, stdout: r.stdout }).toEqual({ code: 0, stderr: '', stdout: `render-audit: wrote audit.md from plan.json, compile-record.json and ${GATE_FILE}\n` });
  return audit(dir);
}
/** A markdown text's headings of one level, outside HTML comments. */
const headings = (text: string, level: number) => text.replace(/<!--[\s\S]*?-->/g, '').split('\n').filter((l) => l.startsWith(`${'#'.repeat(level)} `)).map((l) => l.slice(level + 1));
/** The lines under a heading, to the next heading of that level or higher. */
function under(text: string, heading: string): string[] {
  const lines = text.split('\n');
  const at = lines.indexOf(heading);
  const level = /^#+/.exec(heading)![0].length;
  const end = lines.findIndex((l, i) => i > at && /^#+ /.test(l) && /^#+/.exec(l)![0].length <= level);
  return lines.slice(at + 1, end < 0 ? undefined : end).filter((l) => l !== '');
}

/** The synthetic run's audit.md, as the render writes it (the template's form, every number the record's). */
const RENDERED = `# Audit: Titan / Blood Hunt, Blood Hunt bleed burst

## Estimates

| Entry | Claim | Value | Formula |
|---|---|---|---|
| \`arbiter_margin\` | The Arbiter's slam over the budget variant's physical max hit | 0.19 | slam / b.PhysicalMaximumHitTaken |
| \`campaign_life\` | Life gained from act 1 to maps | 1500.00 | m.Life - a1.Life |
| \`clear_guess\` | Packs a minute | 24.00 | packs * 2 |

- **Count:** Herald of Blood on stage b counts 3 copies: three exploding corpses per pack, as the gem text says.
- **Custom modifier:** \`10% more Bleeding magnitude\` on stage b: Blood Loss stacks, which PoB has no option for. The figures of stage b are estimates (D-296).

## Stage detail

| Loadout | Level | Life | Named source DPS | Fire / cold / lightning / chaos | Max hit, physical / least of the others | Reference hit, physical / largest of the others | Effective HP |
|---|---|---|---|---|---|---|---|
| Act 1 (L8) {a1} | 8 | 310 | 120.5 | 75/75/75/12% | 400 / 300 | — | 900 |
| Entering maps (L65) {m} | 65 | 1810 | 21000 | 75/75/75/12% | 4200 / 3850 | 2500 / 3200 | 9100 |
| Endgame budget (L90) {b} | 90 | 3400 | 98412.75 | 75/75/75/12% | 31000 / 9750 | 5200 / 3200 | 30100.5 |
| Endgame non-budget (L95) {n} | 95 | 4100 | 250000 | 75/75/75/12% | 6000 / 8950 | 6100 / 3200 | 41000 |

## Checks

### Entering maps (L65) {m}

- Chaos resistance stays at 12% because no slot within 5 divines can carry chaos resistance without dropping a resistance the floor needs.
- Budget: about 2.1–4.7 divines around day 7, against a 5-divine target.
- Clear speed: medium, a rough estimate from Blood Hunt's area. Movement speed: +25%.

### Endgame budget (L90) {b}

- Budget: unknown, aiming at about 5 a slot.
  Prices are unavailable (offline run), so this rung's total isn't known.
- The Arbiter of Divinity: survives its hits; its worst, physical hit, is 0.82 of your max hit.
- Clear speed: fast, a rough estimate from Blood Hunt's area. Movement speed: +25%.

### Endgame non-budget (L95) {n}

- Budget: unknown, against the 100–200 target.
  Prices are unavailable (offline run), so this rung's total isn't known.
- The Arbiter of Divinity: one-shot by its physical and lightning hit, at 1.13 of your max hit.
- Clear speed: fast, a rough estimate from Blood Hunt's area. Movement speed: +25%.

## What PoB doesn't model

- Stage b: \`10% more Bleeding magnitude\`, hand-calculated as custom modifiers for effects PoB doesn't model, so its figures are estimates (D-296).
- Stage n: PoB warns "You have too many passive points allocated".

## Inputs by confidence

- **M:** stage m's chaos resistance exception: no slot within 5 divines can carry chaos resistance without dropping a resistance the floor needs; \`b-why\` on stage b: Armour carries the physical hits.
- **L:** \`m-clear\` on stage m: Blood Hunt clears a pack in one press; \`n-ext\` on stage n: The build is popular this league; input \`packs\` (12) of \`clear_guess\`: Packs a minute.
- **Needs an external source** (external source unavailable in this offline run): \`n-ext\` on stage n: The build is popular this league.

## Known issues

None.
`;

describe('render-audit.mjs (WU-71, D-355): audit.md in the exact form of templates/audit-template.md', () => {
  const template = fs.readFileSync(path.join(SKILL_DIR, 'templates', 'audit-template.md'), 'utf8');

  it("renders the template's six H2s in order, one Checks H3 per endgame rung titled with its loadout name, and no Run notes", () => {
    const text = render(guideRun());
    expect(headings(text, 2)).toEqual(headings(template, 2));
    expect(headings(text, 2)).toEqual(['Estimates', 'Stage detail', 'Checks', "What PoB doesn't model", 'Inputs by confidence', 'Known issues']);
    expect(headings(text, 3)).toEqual(['Entering maps (L65) {m}', 'Endgame budget (L90) {b}', 'Endgame non-budget (L95) {n}']);
    expect(headings(text, 1)).toEqual(['Audit: Titan / Blood Hunt, Blood Hunt bleed burst']);
    // The tables' heads are the template's, word for word.
    for (const head of ['| Entry | Claim | Value | Formula |', '| Loadout | Level | Life | Named source DPS |']) {
      expect(template).toContain(head);
      expect(text).toContain(head);
    }
  });

  it("writes the plan's and the record's values, the D1 gate's last basis (attempt 2, not 1) and the Checks block lines the template gives", () => {
    expect(render(guideRun())).toBe(RENDERED);
  });

  it("renders the Checks lines that apply (D-374): prices known, each rung's range at its price day against its target, the over-target slots with a fallback converted like any price, an unmeasured Arbiter, an online run", () => {
    const dir = guideRun();
    editJson(dir, GATE_FILE, (g) => {
      g.basis.budget.market = { league: 'Forbidden Rites', day: 41, late: false };
      g.basis.budget.totals = [{ stage: 'm', low: 2.1, high: 4.7, day: 7 }, { stage: 'b', low: 14, high: 32, day: 7 }, { stage: 'n', low: 88, high: 140, day: 21 }];
      g.findings = [
        { part: 'budget', code: 'over-target', stage: 'b', slot: 'Helmet', low: 3.2, high: 7.2, target: 5, message: 'b Helmet: about 3.2–7.2 divines around day 7, over its 5-divine target' },
        { part: 'budget', code: 'over-target', stage: 'b', jewel: 1001, low: 4, high: 9, target: 5, message: 'b Jewel 1001: about 4–9 divines around day 7, over its 5-divine target' },
        { part: 'budget', code: 'over-target', stage: 'n', slot: 'Weapon 1', low: 40, high: 68, target: 50, message: 'n Weapon 1: about 40–68 divines around day 21, over its 50-divine target' },
      ];
    });
    editJson(dir, 'plan.json', (p) => {
      for (const id of ['b-anoint', 'n-weapon']) Object.assign(p.prices.find((x: Json) => x.id === id), { status: 'ok', amount: 300, currency: 'exalted', note: undefined });
      // b's helmet fallback, 2 divines seen on day 41: under 10, ×0.4–0.9 to day 7, about 0.8–1.8.
      p.prices.push({ id: 'b-helmet-fallback', item: 'b-helmet-fallback', query: { slot: 'Helmet', required: [], target: { divines: 5, day: 7 } }, amount: 2, currency: 'divine', date: '2026-10-15', league: 'Forbidden Rites', status: 'ok', note: 'fit 70%' });
      delete p.stages[1].chaosResistException;
    });
    editJson(dir, 'compile-record.json', (r) => {
      r.stages.n.measures.arbiter = { verdict: null, worst: null, rows: [] };
      delete r.stages.b.outputs.EffectiveMovementSpeedMod;
    });
    editJson(dir, 'run-log.json', (l) => {
      l.mode = 'online';
    });
    const text = render(dir);
    expect(under(text, '### Entering maps (L65) {m}')).toEqual([
      '- Budget: about 2.1–4.7 divines around day 7, against a 5-divine target.',
      "- Clear speed: medium, a rough estimate from Blood Hunt's area. Movement speed: +25%.",
    ]);
    expect(under(text, '### Endgame budget (L90) {b}')).toEqual([
      '- Budget: about 14–32 divines around day 7, aiming at about 5 a slot. Over target: Helmet (about 3.2–7.2; fallback about 0.8–1.8), Jewel 1001 (about 4–9).',
      '- The Arbiter of Divinity: survives its hits; its worst, physical hit, is 0.82 of your max hit.',
      "- Clear speed: fast, a rough estimate from Blood Hunt's area. Movement speed: not measured.",
    ]);
    expect(under(text, '### Endgame non-budget (L95) {n}')).toEqual([
      '- Budget: about 88–140 divines around day 21, against the 100–200 target. Over target: Weapon 1 (about 40–68).',
      '- The Arbiter of Divinity: not measured.',
      "- Clear speed: fast, a rough estimate from Blood Hunt's area. Movement speed: +25%.",
    ]);
    expect(text).not.toContain('Needs an external source');
  });

  it("keeps a slot known to be over target when the rung's total is unknown, and a fallback counts in no total: an unavailable one reads unknown and adds no D-164 line (D-164, D-371)", () => {
    const dir = guideRun();
    editJson(dir, GATE_FILE, (g) => {
      g.findings = [{ part: 'budget', code: 'over-target', stage: 'b', slot: 'Helmet', low: 1.2, high: 2.7, target: 2, message: 'b Helmet: about 1.2–2.7 divines around day 7, over its 2-divine target' }];
    });
    editJson(dir, 'plan.json', (p) => {
      p.prices.push({ id: 'b-helmet-fallback', item: 'b-helmet-fallback', query: {}, amount: null, currency: null, date: '2026-10-12', league: null, status: 'unavailable', note: 'pricing stopped' });
      p.prices.push({ id: 'm-helmet-fallback', item: 'm-helmet-fallback', query: {}, amount: null, currency: null, date: '2026-10-12', league: null, status: 'unavailable', note: 'pricing stopped' });
    });
    const text = render(dir);
    // b's anoint is unavailable (offline run), so b's total is unknown; its helmet is still known to be over target.
    expect(under(text, '### Endgame budget (L90) {b}').slice(0, 2)).toEqual([
      '- Budget: unknown, aiming at about 5 a slot. Over target: Helmet (about 1.2–2.7; fallback price unknown).',
      "  Prices are unavailable (offline run), so this rung's total isn't known.",
    ]);
    // m's prices are known: its unavailable fallback is in no total and gives no reason.
    expect(under(text, '### Entering maps (L65) {m}')[1]).toBe('- Budget: about 2.1–4.7 divines around day 7, against a 5-divine target.');
    expect(under(text, '### Entering maps (L65) {m}').join('\n')).not.toContain('Prices are unavailable');
  });

  it('keeps the rows W1 added under Known issues on a re-render, and follows the recompiled record everywhere else', () => {
    const dir = guideRun();
    render(dir);
    const rows = ['| Id | Lens or gate | Stage | Sentence in the guide |', '|---|---|---|---|', '| chaos-exception | D1-gate | b | Chaos resistance stays low on the budget variant. |'];
    fs.writeFileSync(path.join(dir, 'audit.md'), audit(dir).replace('## Known issues\n\nNone.\n', `## Known issues\n\n${rows.join('\n')}\n`));
    // A fix round recompiles stage b; the D1 gate's next attempt writes a new basis.
    editJson(dir, 'compile-record.json', (r) => {
      r.stages.b.outputs.TotalEHP = 28000;
      r.stages.b.measures.ehp = 28000;
      r.stages.b.outputs.PhysicalMaximumHitTaken = 30000;
    });
    const text = render(dir);
    expect(under(text, '## Known issues')).toEqual(rows);
    expect(text).toContain('| Endgame budget (L90) {b} | 90 | 3400 | 98412.75 | 75/75/75/12% | 30000 / 9750 | 5200 / 3200 | 28000 |');
    expect(text).toContain('| `arbiter_margin` | The Arbiter\'s slam over the budget variant\'s physical max hit | 0.20 | slam / b.PhysicalMaximumHitTaken |');
    // Known issues aside, the re-render is the fresh render of the same inputs.
    const fresh = folder();
    fs.cpSync(dir, fresh, { recursive: true });
    fs.rmSync(path.join(fresh, 'audit.md'));
    expect(text.replace(/## Known issues[\s\S]*$/, '')).toBe(render(fresh).replace(/## Known issues[\s\S]*$/, ''));
    expect(under(audit(fresh), '## Known issues')).toEqual(['None.']);
  });

  it("shows a ledger-only edit's current formula and value without a recompile (D-365)", () => {
    const dir = guideRun();
    editJson(dir, 'plan.json', (p) => {
      p.ledger.find((e: Json) => e.id === 'clear_guess').formula = 'packs * 3';
    });
    expect(render(dir)).toContain('| `clear_guess` | Packs a minute | 36.00 | packs * 3 |');
  });

  it("refuses without its inputs, writing nothing: no D1 gate in the log, a missing record; usage", () => {
    const noGate = guideRun();
    editJson(noGate, 'run-log.json', (l) => {
      l.stages = l.stages.filter((s: Json) => s.stage !== 'D1-gate');
    });
    const r = run(RENDER, noGate);
    expect({ code: r.code, stderr: r.stderr }).toEqual({ code: 1, stderr: "render-audit: run-log.json has no D1-gate entry; the render reads the D1 gate's last verdict file\n" });
    const noRecord = guideRun();
    fs.rmSync(path.join(noRecord, 'compile-record.json'));
    expect(run(RENDER, noRecord)).toEqual({ code: 1, stdout: '', stderr: 'render-audit: compile-record.json is missing\n' });
    for (const dir of [noGate, noRecord]) expect(fs.existsSync(path.join(dir, 'audit.md'))).toBe(false);
    expect(run(RENDER).code).toBe(2);
    expect(run(RENDER, noGate, '--force').code).toBe(2);
  });
});

describe("run-log.mjs (WU-71, D-356): the runner writes the run log through it, in references/run-log.md's entry form", () => {
  const log = (dir: string, kind: string, entry: Json) => run(RUN_LOG, dir, kind, JSON.stringify(entry));
  const ok = (dir: string, kind: string, entry: Json, wrote: string) => expect(log(dir, kind, entry)).toEqual({ code: 0, stdout: `run-log: wrote ${wrote}\n`, stderr: '' });
  /** Prints a gate's display on a run folder, as the runner does before it logs that visit's answer (D-367). */
  const shown = (dir: string, gate: string) => expect(run(RUN_LOG, dir, 'display', gate)).toMatchObject({ code: 0, stderr: '' });
  const started = () => {
    const dir = folder();
    ok(dir, 'init', { slug: 'titan-blood-hunt', brief: { ascendancy: 'Titan', skill: 'Blood Hunt' }, mode: 'offline', testConfig: 'accepted' }, 'the first log');
    return dir;
  };

  it("init writes run-log.md's first write, the run folder given, and never overwrites a log", () => {
    const dir = started();
    expect(fs.readFileSync(path.join(dir, 'run-log.json'), 'utf8')).toBe(`${JSON.stringify({
      schemaVersion: 3,
      runFolder: dir,
      slug: 'titan-blood-hunt',
      brief: { ascendancy: 'Titan', skill: 'Blood Hunt' },
      roll: null,
      status: 'running',
      mode: 'offline',
      testConfig: 'accepted',
      stages: [],
      checkpoints: [],
      displays: [],
      escalations: [],
      faults: [],
      outputs: { plan: null, record: null, dossier: null, guide: null, pobFile: null },
    }, null, 2)}\n`);
    const before = fs.readFileSync(path.join(dir, 'run-log.json'));
    expect(log(dir, 'init', { slug: 'x', brief: {}, mode: 'online', testConfig: 'none' })).toEqual({ code: 1, stdout: '', stderr: 'run-log: run-log.json exists; init writes the first log only\n' });
    expect(fs.readFileSync(path.join(dir, 'run-log.json'))).toEqual(before);
  });

  it('appends one entry per call, with the stage names D1-build, D1-finish, V4 and V4-recheck and the design checkpoint, in the entry form\'s field order', () => {
    const dir = started();
    ok(dir, 'stage', { stage: 'R1a', attempt: 1, outcome: 'done' }, 'stages[0]');
    ok(dir, 'stage', { stage: 'R1b', concept: CARD, attempt: 1, outcome: 'pass', probes: 2 }, 'stages[1]');
    ok(dir, 'stage', { stage: 'D1-build', concept: CARD, attempt: 1, outcome: 'done' }, 'stages[2]');
    ok(dir, 'stage', { outcome: 'done', priceOutcomes: { ok: 3, would_wait: 1 }, attempt: 1, concept: CARD, stage: 'D1-finish' }, 'stages[3]');
    ok(dir, 'stage', { stage: 'D1-gate', concept: CARD, attempt: 1, outcome: 'pass' }, 'stages[4]');
    shown(dir, 'design');
    ok(dir, 'checkpoint', { checkpoint: 'design', visit: 1, answer: 'revise:a cheaper helmet', answeredBy: 'pre-supplied', rule: 'revise:a cheaper helmet' }, 'checkpoints[0]');
    ok(dir, 'stage', { stage: 'D1-finish', concept: CARD, attempt: 2, outcome: 'claims-edited' }, 'stages[5]');
    shown(dir, 'design');
    ok(dir, 'checkpoint', { checkpoint: 'design', visit: 2, answer: 'accept', answeredBy: 'user' }, 'checkpoints[1]');
    ok(dir, 'stage', { stage: 'V4', concept: CARD, attempt: 1, outcome: 'fail' }, 'stages[6]');
    ok(dir, 'stage', { stage: 'V4-recheck', concept: CARD, attempt: 1, outcome: 'pass' }, 'stages[7]');
    ok(dir, 'escalation', { stage: 'D2-gate', concept: CARD, verdict: `reports/gates/D2-gate-${CARD}-a3.json`, choice: 'retry', guidance: 'drop the second curse' }, 'escalations[0]');
    ok(dir, 'set', { status: 'completed', roll: { className: 'Warrior', ascendancy: 'Titan', skill: 'Blood Hunt' }, outputs: { plan: 'plan.json', record: 'compile-record.json', dossier: 'dossier.md', guide: 'guide.md', pobFile: '/x/b.xml' } }, 'status, roll, outputs');
    const l = readJson(dir, 'run-log.json');
    expect(l.stages.map((s: Json) => s.stage)).toEqual(['R1a', 'R1b', 'D1-build', 'D1-finish', 'D1-gate', 'D1-finish', 'V4', 'V4-recheck']);
    expect(Object.keys(l.stages[3])).toEqual(['stage', 'concept', 'attempt', 'outcome', 'priceOutcomes']);
    expect(l.stages[3]).toEqual({ stage: 'D1-finish', concept: CARD, attempt: 1, outcome: 'done', priceOutcomes: { ok: 3, would_wait: 1 } });
    expect(l.checkpoints).toEqual([
      { checkpoint: 'design', visit: 1, answer: 'revise:a cheaper helmet', answeredBy: 'pre-supplied', rule: 'revise:a cheaper helmet' },
      { checkpoint: 'design', visit: 2, answer: 'accept', answeredBy: 'user' },
    ]);
    expect(l.escalations).toEqual([{ stage: 'D2-gate', concept: CARD, verdict: `reports/gates/D2-gate-${CARD}-a3.json`, choice: 'retry', guidance: 'drop the second curse' }]);
    expect({ status: l.status, roll: l.roll, pobFile: l.outputs.pobFile }).toEqual({ status: 'completed', roll: { className: 'Warrior', ascendancy: 'Titan', skill: 'Blood Hunt' }, pobFile: '/x/b.xml' });
    expect(fs.existsSync(path.join(dir, 'run-log.json.tmp'))).toBe(false);
  });

  it('refuses an entry outside the form and writes nothing: the retired D1 and V4-<lens> names among them', () => {
    const dir = started();
    const before = fs.readFileSync(path.join(dir, 'run-log.json'));
    const refused: [string, Json, RegExp][] = [
      ['stage', { stage: 'D1', concept: CARD, attempt: 1, outcome: 'done' }, /stage "D1" isn't one of R1a, R1a-assemble, R1b, R1b-assemble, D1-build, D1-finish, D1-gate, D2, D2-gate, W1, V4, V4-recheck/],
      ['stage', { stage: 'V4-ledger', concept: CARD, attempt: 1, outcome: 'pass' }, /stage "V4-ledger" isn't one of/],
      ['stage', { stage: 'D1-build', concept: CARD, attempt: 1, outcome: 'claims-edited' }, /a D1-build entry's outcome is done, infeasible, missing, not "claims-edited"/],
      ['stage', { stage: 'D1-build', concept: 'c1', attempt: 0, outcome: 'done' }, /concept "c1" isn't a card id .*; attempt 0 isn't a whole number from 1/],
      ['stage', { stage: 'R1b', concept: CARD, attempt: 1, outcome: 'pass' }, /an R1b entry has probes/],
      ['stage', { stage: 'W1', concept: CARD, attempt: 1, outcome: 'done', priceOutcomes: { ok: 1 } }, /priceOutcomes is only on R1b, D1-finish, D1-gate, D2/],
      ['stage', { stage: 'W1', concept: CARD, attempt: 1, outcome: 'done', note: 'x' }, /"note" isn't a field of a stage entry/],
      ['checkpoint', { checkpoint: 'design', visit: 1, answer: 'pick:r1-a-1', answeredBy: 'user' }, /"pick:r1-a-1" isn't an answer of the design checkpoint/],
      ['checkpoint', { checkpoint: 'design', visit: 1, answer: 'accept', answeredBy: 'default', rule: 'no design answer left: stop' }, /a default answer is stop/],
      ['checkpoint', { checkpoint: 'final', visit: 1, answer: 'accept', answeredBy: 'user', rule: 'accept' }, /a user's answer has no rule/],
      ['checkpoint', { checkpoint: 2, visit: 1, answer: 'accept', answeredBy: 'user' }, /checkpoint 2 isn't one of brainstorm, verification, design, final, unsaved-build, escalation/],
      ['escalation', { stage: 'D1-gate', concept: CARD, verdict: 'reports/gates/D2-gate-r1-a-1-a3.json', choice: 'retry' }, /verdict is the escalated attempt's file.*; guidance goes with retry/],
      ['set', { status: 'done' }, /status is running, completed, not-accepted, stopped, escalated/],
    ];
    for (const [kind, entry, why] of refused) {
      const r = log(dir, kind, entry);
      expect({ kind, entry, code: r.code, stdout: r.stdout }).toEqual({ kind, entry, code: 1, stdout: '' });
      expect(r.stderr).toMatch(new RegExp(`^run-log: ${kind} entry refused: `));
      expect(r.stderr).toMatch(why);
    }
    expect(fs.readFileSync(path.join(dir, 'run-log.json'))).toEqual(before);
    // A default answer at the design gate is stop, with its rule (D-362), after the visit's display (D-367).
    shown(dir, 'design');
    ok(dir, 'checkpoint', { checkpoint: 'design', visit: 1, answer: 'stop', answeredBy: 'default', rule: 'no design answer left: stop' }, 'checkpoints[0]');
  });

  it("accepts run-log.md's example calls, and init writes its first-write example", () => {
    const md = fs.readFileSync(path.join(SKILL_DIR, 'references', 'run-log.md'), 'utf8');
    const calls = [...md.matchAll(/^node \.claude\/skills\/build-guide\/scripts\/run-log\.mjs <runFolder> (?:(\w+) - <<'JSON'\n(.*)\nJSON|display (\w+))$/gm)].map((m) => (m[3] ? ['display', m[3]] : [m[1], `${m[2]}\n`]));
    expect(calls.map(([kind]) => kind)).toEqual(['init', 'stage', 'display', 'checkpoint', 'escalation', 'set']);
    const dir = folder();
    for (const [kind, arg] of calls) expect({ kind, ...(kind === 'display' ? run(RUN_LOG, dir, kind, arg) : runWith(arg, RUN_LOG, dir, kind, '-')) }).toMatchObject({ kind, code: 0, stderr: '' });
    const first = folder();
    expect(runWith(calls[0][1], RUN_LOG, first, 'init', '-').code).toBe(0);
    const example = JSON.parse(/## A first write[\s\S]*?```json\n([\s\S]*?)\n```/.exec(md)![1]) as Json;
    expect(readJson(first, 'run-log.json')).toEqual({ ...example, runFolder: first });
  });

  it("reads the entry from stdin for -, as a quoted heredoc gives it: a text with an apostrophe needs no shell quoting", () => {
    const dir = started();
    const answer = "revise:the build's helmet costs too much; keep Blood Hunt's leap";
    shown(dir, 'design');
    expect(runWith(`${JSON.stringify({ checkpoint: 'design', visit: 1, answer, answeredBy: 'user' })}\n`, RUN_LOG, dir, 'checkpoint', '-')).toEqual({ code: 0, stdout: 'run-log: wrote checkpoints[0]\n', stderr: '' });
    expect(readJson(dir, 'run-log.json').checkpoints).toEqual([{ checkpoint: 'design', visit: 1, answer, answeredBy: 'user' }]);
    // Through a real shell heredoc too, the form references/run-log.md gives.
    const sh = spawnSync('/bin/sh', ['-c', `"${process.execPath}" "${RUN_LOG}" "${dir}" escalation - <<'JSON'\n{"stage": "D1-gate", "concept": "${CARD}", "verdict": "reports/gates/D1-gate-${CARD}-a1.json", "choice": "retry", "guidance": "don't drop the helmet's life"}\nJSON\n`], { cwd: TMP, env: { PATH: '/usr/bin:/bin', LANG: 'C' }, encoding: 'utf8', timeout: 30000 });
    expect({ code: sh.status, stdout: sh.stdout, stderr: sh.stderr }).toEqual({ code: 0, stdout: 'run-log: wrote escalations[0]\n', stderr: '' });
    expect(readJson(dir, 'run-log.json').escalations[0].guidance).toBe("don't drop the helmet's life");
    // An empty stdin is no JSON, and nothing is written.
    expect(runWith('', RUN_LOG, dir, 'stage', '-')).toMatchObject({ code: 1, stdout: '' });
    expect(readJson(dir, 'run-log.json').stages).toEqual([]);
  });

  it('refuses before the first write, a schema-2 log, a non-JSON entry and a bad command line', () => {
    const empty = folder();
    expect(log(empty, 'stage', { stage: 'R1a', attempt: 1, outcome: 'done' })).toEqual({ code: 1, stdout: '', stderr: "run-log: run-log.json can't be read (ENOENT); write the first log with init\n" });
    const old = folder();
    fs.writeFileSync(path.join(old, 'run-log.json'), JSON.stringify({ schemaVersion: 2, stages: [] }));
    expect(log(old, 'stage', { stage: 'R1a', attempt: 1, outcome: 'done' }).stderr).toBe("run-log: run-log.json isn't a schema-3 log; this script writes only schema 3\n");
    expect(run(RUN_LOG, empty, 'stage', '{stage: R1a}').code).toBe(1);
    expect(run(RUN_LOG, empty, 'append', '{}').code).toBe(2);
    expect(run(RUN_LOG, empty, 'stage').code).toBe(2);
    expect(fs.readdirSync(empty)).toEqual([]);
  });
});

describe('run-log.mjs display (D-367, D-369): each gate visit prints its display from the run folder, and its answer waits for it', () => {
  const FIXTURES = path.join(REPO, 'tests', 'fixtures', 'pipeline');
  /** A copy of a fixture run in a temp folder: the display records its visit in the copy's log. */
  const copy = (fixture: string) => {
    const dir = folder();
    fs.cpSync(path.join(FIXTURES, fixture), dir, { recursive: true });
    return dir;
  };
  /** The display's lines; the visit is one more than the copy's answers at that gate. */
  const display = (dir: string, gate: string) => {
    const r = run(RUN_LOG, dir, 'display', gate);
    expect({ code: r.code, stderr: r.stderr }).toEqual({ code: 0, stderr: '' });
    return r.stdout.split('\n');
  };

  it('brainstorm: the brief, then the deck from cards.md without the cards already verified, and the Not dealt list', () => {
    const dir = copy('run-ok');
    const out = display(dir, 'brainstorm');
    expect(out.slice(0, 3)).toEqual(['## The brainstorm gate, visit 2', '', 'Brief: ascendancy Titan; skill Blood Hunt']);
    expect(out).toContain('- r1-b-1 "Blood Hunt on a two-hander" | Warrior Titan, Blood Hunt | melee, one-button, boss | links confirmed 1 of 1 | evidence: no player evidence');
    expect(out.filter((l) => /^- r1-a-[12] /.test(l))).toEqual([]);
    expect(out).toContain('## Not dealt');
    expect(readJson(dir, 'run-log.json').displays).toContainEqual({ checkpoint: 'brainstorm', visit: 2 });
  });

  it("verification: the dossier's table and path, and a card's last design verdict once a design ran", () => {
    const dir = copy('run-ok');
    const out = display(dir, 'verification');
    expect(out.filter((l) => l.startsWith('|')).map((l) => l.split(' | ')[0])).toEqual(['| Card', '|---|---|---|---|---|---|---|---|---|---|', '| r1-a-1', '| r1-a-2']);
    expect(out).toContain(`Dossier: ${path.join(dir, 'dossier.md')}`);
    expect(out).toContain('Last design verdict, r1-a-1 (pass): reports/gates/D2-gate-r1-a-1-a1.json');
  });

  it("design: the last D1 gate verdict file's design field, one block per rung, the open estimates, the verdict and its file (A-35)", () => {
    const out = display(copy('run-ok'), 'design');
    expect(out.slice(0, 7)).toEqual([
      '## The design gate, visit 2', '',
      'm: DPS 9000, EHP 18400, clear medium (rough)',
      '   gear: rare boots with lightning resistance; a life and cold-resistance helmet',
      '   gems: Blood Hunt with Bloodlust and Brutality I',
      '   tree: the life wheel by the Warrior start',
      'b: DPS 50000, EHP 31500, Arbiter survives, worst physical 0.68, clear medium (rough)',
    ]);
    expect(out).toContain('   anoint: Unbending: Ire, Guilt, Greed');
    expect(out).toContain('Open estimates:');
    expect(out.slice(-3)).toEqual(['Verdict: compiled pass, v1 pass, v2 pass, floor pass, budget unverified, rolledSkill pass', 'Verdict file: reports/gates/D1-gate-r1-a-1-a2.json', '']);
  });

  it("final: the guide's and audit.md's paths, the PoB file, the gate verdicts, each endgame rung's final figures with the design gate's where they moved (D-369), the known issues and the run checker's result", () => {
    const dir = copy('run-ok');
    const out = display(dir, 'final');
    expect(out.slice(0, 7)).toEqual([
      '## The final gate, visit 2', '',
      `Guide: ${path.join(dir, 'guide.md')}`,
      `Audit: ${path.join(dir, 'audit.md')}`,
      'PoB file: titan-blood-hunt-2026-10-08-1.xml',
      'D1-gate: compiled pass, v1 pass, v2 pass, floor pass, budget unverified, rolledSkill pass (reports/gates/D1-gate-r1-a-1-a2.json)',
      'D2-gate: compiled pass, v1 pass, v2 pass (reports/gates/D2-gate-r1-a-1-a1.json)',
    ]);
    // The final record's figures; the clear speed moved since the design gate, so the design gate's line follows.
    const at = out.indexOf('Endgame, from the final compile record:');
    expect(out.slice(at + 1, at + 7)).toEqual([
      'm: DPS 9000, EHP 18400, clear slow (rough)',
      '   at the design gate: DPS 9000, EHP 18400, clear medium (rough)',
      'b: DPS 50000, EHP 31500, Arbiter survives, worst physical 0.68, clear slow (rough)',
      '   at the design gate: DPS 50000, EHP 31500, Arbiter survives, worst physical 0.68, clear medium (rough)',
      'n: DPS 140000, EHP 52300, Arbiter survives, worst physical 0.47, clear slow (rough)',
      '   at the design gate: DPS 140000, EHP 52300, Arbiter survives, worst physical 0.47, clear medium (rough)',
    ]);
    expect(out[out.indexOf('Known issues:') + 1]).toMatch(/^- The How to play it section is wrong to call Rolling Slam your clear skill/);
    // D-371, D-374: each rung's budget line from the D1 gate's last verdict file, in the guide's Checks words.
    const budget = out.indexOf('Budget, from the D1 gate:');
    expect(out.slice(budget + 1, budget + 7)).toEqual([
      'm: Budget: unknown, against a 5-divine target.',
      "   Prices are unavailable (offline run), so this rung's total isn't known.",
      'b: Budget: unknown, aiming at about 5 a slot.',
      "   Prices are unavailable (offline run), so this rung's total isn't known.",
      'n: Budget: unknown, against the 100–200 target.',
      "   Prices are unavailable (offline run), so this rung's total isn't known.",
    ]);
    expect(out).toContain("Some prices are unavailable, so the total of each rung they price isn't known (D-164).");
    expect(out.join('\n')).not.toMatch(/within its budget|ceiling/);
    expect(out).toContain('The guide is from an offline run: no price was checked.');
    expect(out.slice(-2)).toEqual(['Run checker: ok', '']);
  });

  it('final, online: an unavailable fallback is no D-164 reason, so with every total known the display gives no D-164 line (D-371)', () => {
    const dir = copy('run-ok-online');
    const planPath = path.join(dir, 'plan.json');
    const plan = JSON.parse(fs.readFileSync(planPath, 'utf8')) as Json;
    Object.assign(plan.prices.find((x: Json) => x.id === 'b-weapon-fallback'), { status: 'unavailable', amount: null, currency: null, note: 'pricing stopped' });
    fs.writeFileSync(planPath, `${JSON.stringify(plan, null, 2)}\n`);
    const out = display(dir, 'final');
    const budget = out.indexOf('Budget, from the D1 gate:');
    expect(out.slice(budget + 1, budget + 4)).toEqual([
      'm: Budget: about 1.8–4 divines around day 7, against a 5-divine target.',
      'b: Budget: about 8.8–20 divines around day 7, aiming at about 5 a slot. Over target: Weapon 1 (about 3.2–7.2; fallback price unknown).',
      'n: Budget: about 84–143 divines around day 21, against the 100–200 target. Over target: Body Armour (about 20–34).',
    ]);
    expect(out.join('\n')).not.toMatch(/Prices are unavailable|\(D-164\)/);
  });

  it("final, online: each rung's total range at its price day against its target and its over-target slots (D-371, D-374), with no D-164 line when every price is known", () => {
    const out = display(copy('run-ok-online'), 'final');
    const budget = out.indexOf('Budget, from the D1 gate:');
    expect(out.slice(budget + 1, budget + 4)).toEqual([
      'm: Budget: about 1.8–4 divines around day 7, against a 5-divine target.',
      'b: Budget: about 8.8–20 divines around day 7, aiming at about 5 a slot. Over target: Weapon 1 (about 3.2–7.2; fallback about 1.2–2.7).',
      'n: Budget: about 84–143 divines around day 21, against the 100–200 target. Over target: Body Armour (about 20–34).',
    ]);
    expect(out.join('\n')).not.toContain('(D-164)');
    expect(out.slice(-2)).toEqual(['Run checker: ok', '']);
  });

  it('escalation: the escalated gate, its attempts, its verdict with the findings, and the verdict file', () => {
    const out = display(copy('run-escalated'), 'escalation');
    expect(out).toEqual([
      '## Escalation, visit 2', '',
      'D1-gate, r1-a-1: attempts 1 fail, 2 fail, 3 escalated',
      'Verdict: compiled pass, v1 fail, v2 pass, floor pass, budget unverified, rolledSkill pass',
      '- v1 level-points: stage b spends 108 passive points, but level 1 grants 0 (FI-2)',
      '- floor chaos-exception: MissingChaosResist 47 on stage b, kept by its chaosResistException: no slot can carry chaos resistance without dropping a core item or breaking the budget',
      'Verdict file: reports/gates/D1-gate-r1-a-1-a3.json',
      '',
    ]);
  });

  it("checkpoint refuses a gate's answer until that visit's display is recorded; printing it again records nothing new; the unsaved-build question has no display", () => {
    const dir = folder();
    expect(run(RUN_LOG, dir, 'init', JSON.stringify({ slug: 'titan-blood-hunt', brief: {}, mode: 'offline', testConfig: 'accepted' })).code).toBe(0);
    const answer = (visit: number) => run(RUN_LOG, dir, 'checkpoint', JSON.stringify({ checkpoint: 'design', visit, answer: 'accept', answeredBy: 'user' }));
    const before = fs.readFileSync(path.join(dir, 'run-log.json'));
    expect(answer(1)).toEqual({ code: 1, stdout: '', stderr: "run-log: checkpoint entry refused: the design gate's visit 1 printed no display; run run-log.mjs <runFolder> display design first and print its output (D-367)\n" });
    expect(fs.readFileSync(path.join(dir, 'run-log.json'))).toEqual(before);
    expect(display(dir, 'design')).toEqual(['## The design gate, visit 1', '', 'No D1 gate in the run log.', '']);
    display(dir, 'design');
    expect(readJson(dir, 'run-log.json').displays).toEqual([{ checkpoint: 'design', visit: 1 }]);
    expect(answer(1)).toEqual({ code: 0, stdout: 'run-log: wrote checkpoints[0]\n', stderr: '' });
    // The next visit needs its own display.
    expect(answer(2).stderr).toBe("run-log: checkpoint entry refused: the design gate's visit 2 printed no display; run run-log.mjs <runFolder> display design first and print its output (D-367)\n");
    expect(run(RUN_LOG, dir, 'checkpoint', JSON.stringify({ checkpoint: 'escalation', visit: 1, answer: 'stop', answeredBy: 'user' })).stderr).toMatch(/^run-log: checkpoint entry refused: the escalation question's visit 1 printed no display/);
    expect(run(RUN_LOG, dir, 'checkpoint', JSON.stringify({ checkpoint: 'unsaved-build', visit: 1, answer: 'proceed', answeredBy: 'user' })).code).toBe(0);
    expect(run(RUN_LOG, dir, 'display', 'unsaved-build')).toEqual({ code: 1, stdout: '', stderr: 'run-log: display: "unsaved-build" isn\'t one of brainstorm, verification, design, final, escalation\n' });
  });
});
