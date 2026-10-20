/**
 * WU-71: the build-guide runner's two scripts, each spawned as a real `node` process on a temp run folder
 * (tests/helpers/guideRunFolder.ts):
 *
 * - `scripts/render-audit.mjs <runFolder>` (D-355) renders `audit.md` in the form of `templates/audit-template.md`
 *   from the plan, the final compile record and the D1 gate's last verdict file, and a re-render keeps the rows W1
 *   added under `Known issues`; a campaign stage's DPS is the record's headline rule, a minion's figure for a group
 *   that names a minion skill (AC-W66, D-378);
 * - `scripts/run-log.mjs <runFolder> <kind> '<json>'` (D-356), or `-` for the JSON on stdin, writes the run log in
 *   `references/run-log.md`'s entry form, appending one entry per call, and refuses an entry outside that form;
 *   `run-log.mjs <runFolder> display <gate>` (D-367) prints a gate visit's display from the run folder's files and
 *   records it, the final gate's with each endgame rung's final figures (D-369), and a gate's answer is refused
 *   until its visit's display is recorded.
 *
 *
 * Amendment 7 (WU-81): every display speaks plainly, card names in place of ids, codes, ids and paths last under
 * "For reference" (AC-W67, D-392); a gate's checkpoint carries `questions`, `changes`, `newCards` and `note`, and
 * `run-log.mjs <runFolder> test-config <path>` checks a test config whose answers may script an interview (AC-W68,
 * D-389, D-391, D-394); a plain summon's skeleton figure and the render's headline read its minion (D-397).
 *
 * `--snapshot` and `--changed` (A-34, D-352) are `check-run.mjs`'s, tested in buildGuideCheckRun.test.ts.
 * The render loads the server's compiled `build/plan/ledger.js`: `mise run test` builds before Jest runs.
 */
import { describe, it, expect, afterAll } from '@jest/globals';
import { spawnSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { headlineDps } from '../../src/plan/record';
import { CARD, GATE_FILE, MINION, editJson, readJson, writeGuideRun, writeMinionGuideRun, type Json } from '../helpers/guideRunFolder';

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

const FIXTURES = path.join(REPO, 'tests', 'fixtures', 'pipeline');
/**
 * A copy of a fixture run rolled back to its first brainstorm gate (D-287): the log's steps up to the first
 * R1a-assemble, no answer, no display and no roll yet.
 */
function atBrainstorm(fixture: string): string {
  const dir = folder();
  fs.cpSync(path.join(FIXTURES, fixture), dir, { recursive: true });
  editJson(dir, 'run-log.json', (l) => {
    l.stages = l.stages.slice(0, (l.stages as Json[]).findIndex((s) => s.stage === 'R1a-assemble') + 1);
    Object.assign(l, { checkpoints: [], displays: [], escalations: [], faults: [], roll: null, status: 'running' });
  });
  return dir;
}
/** A display's plain part, the lines before its "For reference:" (D-392). */
const plainPart = (out: string[]) => (out.includes('For reference:') ? out.slice(0, out.indexOf('For reference:')) : out);
/** The five pitch lines a card's display prints, in order (D-392). */
const PITCH = ['Why pick it', 'How it clears', 'Bosses', 'Needs', 'The catch'];
/** A card file's Pitch fields, `- <Field>: <text>` under `### Pitch`. */
const pitchOf = (dir: string, id: string): Record<string, string> => Object.fromEntries(
  [...fs.readFileSync(path.join(dir, 'cards', `${id}.md`), 'utf8').split('### Pitch')[1].split('### Chain')[0].matchAll(/^- ([^:]+): (.*)$/gm)].map((m) => [m[1], m[2]]),
);

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

  it("AC-W66 (D-378), D-397: a campaign stage's named source DPS is the main group's figure × its Count as the record reads it, its minion's MinionTotalDPS when the group names a minion skill or its skill summons one", () => {
    const dir = writeMinionGuideRun(folder());
    const plan = readJson(dir, 'plan.json');
    const a1 = readJson(dir, 'compile-record.json').stages.a1;
    expect(plan.stages[0].skills.groups[0]).toEqual(expect.objectContaining({ minionSkill: MINION.skill, count: 2 }));
    expect([a1.skillOutputs.g1s1p1.fields, a1.countedSkillOutputs.g1s1p1.fields]).toEqual([{ TotalDPS: 0, MinionTotalDPS: 60.25 }, { TotalDPS: 0, MinionTotalDPS: 120.5 }]);
    // The render's campaign row is the record's headline rule (src/plan/record.ts): the minion's figure × the Count of 2.
    expect(headlineDps(plan.stages[0], a1)).toBe(120.5);
    const row = (text: string) => under(text, '## Stage detail').find((l) => l.startsWith('| Act 1 (L8) {a1} |'));
    expect(row(render(dir))).toBe('| Act 1 (L8) {a1} | 8 | 310 | 120.5 | 75/75/75/12% | 400 / 300 | — | 900 |');
    // D-397: without the record's resolved selection, a group whose skill summons a minion (its skillOutputs entry
    // carries Minion<Field> fields, a plain summon such as Skeletal Warrior) is still read by its minion's figure.
    editJson(dir, 'compile-record.json', (r) => delete r.stages.a1.minionSkills);
    expect(row(render(dir))).toBe('| Act 1 (L8) {a1} | 8 | 310 | 120.5 | 75/75/75/12% | 400 / 300 | — | 900 |');
    // A group with no minion selection and no minion fields is the player's: its TotalDPS, 0 here.
    editJson(dir, 'compile-record.json', (r) => {
      r.stages.a1.skillOutputs.g1s1p1.fields = { TotalDPS: 0 };
    });
    expect(row(render(dir))).toBe('| Act 1 (L8) {a1} | 8 | 310 | 0 | 75/75/75/12% | 400 / 300 | — | 900 |');
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
  /** Schema 4's design and final gates are a build's: their display names it (D-411). */
  const shownFor = (dir: string, gate: string) => expect(run(RUN_LOG, dir, 'display', gate, '--build', CARD)).toMatchObject({ code: 0, stderr: '' });
  const started = () => {
    const dir = folder();
    // Amendment 9 (WU-94): init writes schema 4, and the runner states noNinja (D-412).
    ok(dir, 'init', { slug: 'titan-blood-hunt', brief: { ascendancy: 'Titan', skill: 'Blood Hunt' }, mode: 'offline', testConfig: 'accepted', noNinja: false }, 'the first log');
    return dir;
  };
  /** Schema 4: a design or final checkpoint names a build of the run (D-412), so the card is finalized first. */
  const finalized = (dir: string) => ok(dir, 'build', { id: CARD, roll: { className: 'Warrior', ascendancy: 'Titan', skill: 'Blood Hunt' }, status: 'queued' }, 'builds[0]');

  it("init writes run-log.md's first write, the run folder given, and never overwrites a log", () => {
    const dir = started();
    // Amendment 9 (WU-94, D-412): schema 4, with noNinja, the pin's commit and the newest league digest.
    expect(fs.readFileSync(path.join(dir, 'run-log.json'), 'utf8')).toBe(`${JSON.stringify({
      schemaVersion: 4,
      runFolder: dir,
      slug: 'titan-blood-hunt',
      brief: { ascendancy: 'Titan', skill: 'Blood Hunt' },
      status: 'running',
      mode: 'offline',
      testConfig: 'accepted',
      noNinja: false,
      pinCommit: readJson(REPO, 'pob-pin.json').commit,
      digest: 'runes-of-aldur.md',
      dossier: null,
      builds: [],
      stages: [],
      checkpoints: [],
      displays: [],
      escalations: [],
      faults: [],
      resumes: [],
    }, null, 2)}\n`);
    const before = fs.readFileSync(path.join(dir, 'run-log.json'));
    expect(log(dir, 'init', { slug: 'x', brief: {}, mode: 'online', testConfig: 'none', noNinja: false })).toEqual({ code: 1, stdout: '', stderr: 'run-log: run-log.json exists; init writes the first log only\n' });
    expect(fs.readFileSync(path.join(dir, 'run-log.json'))).toEqual(before);
  });

  it('appends one entry per call, with the stage names D1-build, D1-finish, V4 and V4-recheck and the design checkpoint, in the entry form\'s field order', () => {
    const dir = started();
    ok(dir, 'stage', { stage: 'R1a', attempt: 1, outcome: 'done' }, 'stages[0]');
    ok(dir, 'stage', { stage: 'R1b', concept: CARD, attempt: 1, outcome: 'pass', probes: 2 }, 'stages[1]');
    ok(dir, 'stage', { stage: 'D1-build', concept: CARD, attempt: 1, outcome: 'done' }, 'stages[2]');
    ok(dir, 'stage', { outcome: 'done', priceOutcomes: { ok: 3, would_wait: 1 }, attempt: 1, concept: CARD, stage: 'D1-finish' }, 'stages[3]');
    ok(dir, 'stage', { stage: 'D1-gate', concept: CARD, attempt: 1, outcome: 'pass' }, 'stages[4]');
    finalized(dir);
    shownFor(dir, 'design');
    ok(dir, 'checkpoint', { checkpoint: 'design', concept: CARD, visit: 1, answer: 'revise:a cheaper helmet', answeredBy: 'pre-supplied', rule: 'revise:a cheaper helmet' }, 'checkpoints[0]');
    ok(dir, 'stage', { stage: 'D1-finish', concept: CARD, attempt: 2, outcome: 'claims-edited' }, 'stages[5]');
    shownFor(dir, 'design');
    ok(dir, 'checkpoint', { checkpoint: 'design', concept: CARD, visit: 2, answer: 'accept', answeredBy: 'user' }, 'checkpoints[1]');
    ok(dir, 'stage', { stage: 'V4', concept: CARD, attempt: 1, outcome: 'fail' }, 'stages[6]');
    ok(dir, 'stage', { stage: 'V4-recheck', concept: CARD, attempt: 1, outcome: 'pass' }, 'stages[7]');
    ok(dir, 'escalation', { stage: 'D2-gate', concept: CARD, verdict: `reports/gates/D2-gate-${CARD}-a3.json`, choice: 'retry', guidance: 'drop the second curse' }, 'escalations[0]');
    ok(dir, 'build', { id: CARD, status: 'completed', guide: 'full', pobFile: '/x/b.xml' }, 'builds[0]');
    ok(dir, 'set', { status: 'completed', dossier: 'dossier.md' }, 'status, dossier');
    const l = readJson(dir, 'run-log.json');
    expect(l.stages.map((s: Json) => s.stage)).toEqual(['R1a', 'R1b', 'D1-build', 'D1-finish', 'D1-gate', 'D1-finish', 'V4', 'V4-recheck']);
    expect(Object.keys(l.stages[3])).toEqual(['stage', 'concept', 'attempt', 'outcome', 'priceOutcomes']);
    expect(l.stages[3]).toEqual({ stage: 'D1-finish', concept: CARD, attempt: 1, outcome: 'done', priceOutcomes: { ok: 3, would_wait: 1 } });
    expect(l.checkpoints).toEqual([
      { checkpoint: 'design', concept: CARD, visit: 1, answer: 'revise:a cheaper helmet', answeredBy: 'pre-supplied', rule: 'revise:a cheaper helmet' },
      { checkpoint: 'design', concept: CARD, visit: 2, answer: 'accept', answeredBy: 'user' },
    ]);
    expect(l.escalations).toEqual([{ stage: 'D2-gate', concept: CARD, verdict: `reports/gates/D2-gate-${CARD}-a3.json`, choice: 'retry', guidance: 'drop the second curse' }]);
    expect({ status: l.status, dossier: l.dossier, roll: l.builds[0].roll, pobFile: l.builds[0].pobFile }).toEqual({ status: 'completed', dossier: 'dossier.md', roll: { className: 'Warrior', ascendancy: 'Titan', skill: 'Blood Hunt' }, pobFile: '/x/b.xml' });
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
    finalized(dir);
    shownFor(dir, 'design');
    ok(dir, 'checkpoint', { checkpoint: 'design', concept: CARD, visit: 1, answer: 'stop', answeredBy: 'default', rule: 'no design answer left: stop' }, 'checkpoints[0]');
  });

  it("accepts run-log.md's example calls, schema 4's (D-412, D-415), and init writes its first-write example", () => {
    const md = fs.readFileSync(path.join(SKILL_DIR, 'references', 'run-log.md'), 'utf8');
    const calls = [...md.matchAll(/^node \.claude\/skills\/build-guide\/scripts\/run-log\.mjs <runFolder> (?:(\w+) - <<'JSON'\n(.*)\nJSON|display (\w+(?: --build \S+)?)|(migrate))$/gm)].map((m) =>
      m[3] ? ['display', m[3]] : m[4] ? ['migrate', ''] : [m[1], `${m[2]}\n`],
    );
    expect(calls.map(([kind]) => kind)).toEqual(['init', 'build', 'stage', 'display', 'checkpoint', 'escalation', 'build', 'set', 'resume', 'migrate']);
    const dir = folder();
    for (const [kind, arg] of calls.filter(([kind]) => kind !== 'migrate')) {
      expect({ kind, ...(kind === 'display' ? run(RUN_LOG, dir, kind, ...arg.split(' ')) : runWith(arg, RUN_LOG, dir, kind, '-')) }).toMatchObject({ kind, code: 0, stderr: '' });
    }
    // The calls wrote a schema-4 log: the build escalated, the resume recorded, the run running again.
    expect(readJson(dir, 'run-log.json')).toMatchObject({
      schemaVersion: 4,
      dossier: 'dossier.md',
      status: 'running',
      builds: [{ id: 'r1-a-2', status: 'escalated', folder: 'builds/r1-a-2', guide: null, pobFile: null }],
      resumes: [{ noNinja: false, lengths: { stages: 1, checkpoints: 1, escalations: 1, displays: 1 } }],
    });
    // migrate, with no JSON, rewrites a schema-3 log (a recorded run's), and refuses one that is already schema 4.
    const old = folder();
    fs.cpSync(path.join(FIXTURES, 'run-ok'), old, { recursive: true });
    expect(readJson(old, 'run-log.json').schemaVersion).toBe(3);
    expect(run(RUN_LOG, old, 'migrate')).toMatchObject({ code: 0, stderr: '' });
    expect(readJson(old, 'run-log.json').schemaVersion).toBe(4);
    expect(run(RUN_LOG, dir, 'migrate')).toMatchObject({ code: 1, stderr: expect.stringMatching(/already a schema-4 log/) });
    // init writes run-log.md's first write, the pin's commit and the newest digest as the script reads them.
    const first = folder();
    expect(runWith(calls[0][1], RUN_LOG, first, 'init', '-').code).toBe(0);
    const example = JSON.parse(/## A first write[\s\S]*?```json\n([\s\S]*?)\n```/.exec(md)![1]) as Json;
    const written = readJson(first, 'run-log.json');
    expect(written).toEqual({ ...example, runFolder: first, pinCommit: written.pinCommit, digest: written.digest });
    expect(typeof written.pinCommit).toBe('string');
  });

  it("reads the entry from stdin for -, as a quoted heredoc gives it: a text with an apostrophe needs no shell quoting", () => {
    const dir = started();
    const answer = "revise:the build's helmet costs too much; keep Blood Hunt's leap";
    finalized(dir);
    shownFor(dir, 'design');
    expect(runWith(`${JSON.stringify({ checkpoint: 'design', concept: CARD, visit: 1, answer, answeredBy: 'user' })}\n`, RUN_LOG, dir, 'checkpoint', '-')).toEqual({ code: 0, stdout: 'run-log: wrote checkpoints[0]\n', stderr: '' });
    expect(readJson(dir, 'run-log.json').checkpoints).toEqual([{ checkpoint: 'design', concept: CARD, visit: 1, answer, answeredBy: 'user' }]);
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
    expect(log(old, 'stage', { stage: 'R1a', attempt: 1, outcome: 'done' }).stderr).toBe("run-log: run-log.json isn't a schema-3 or schema-4 log; this script writes schema 4, and appends to a schema-3 log until migrate rewrites it\n");
    expect(run(RUN_LOG, empty, 'stage', '{stage: R1a}').code).toBe(1);
    expect(run(RUN_LOG, empty, 'append', '{}').code).toBe(2);
    expect(run(RUN_LOG, empty, 'stage').code).toBe(2);
    expect(fs.readdirSync(empty)).toEqual([]);
  });
});

describe('run-log.mjs display (D-367, D-369, D-392): each gate visit prints its display from the run folder in plain words, codes last, and its answer waits for it', () => {
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
  /** A display's codes, ids and paths: its lines from "For reference:" on (D-392). */
  const referenceOf = (out: string[]) => out.slice(out.indexOf('For reference:'));
  /** The pass/fail codes the final gate's display spoke in before amendment 7 (feedback study §5.1). */
  const CODES = /compiled pass|v1 pass|v2 pass|floor pass/;

  it("AC-W67 (D-392) brainstorm: the brief, the deck's header once, every dealt card's name and its five pitch lines, numbered, then the not-dealt reasons, the found-not-used list and the invitation; no card id outside For reference, no confidence boilerplate, no tag list", () => {
    const dir = atBrainstorm('run-ok');
    const out = display(dir, 'brainstorm');
    expect(out.slice(0, 3)).toEqual(['## The brainstorm gate, visit 1', '', 'Brief: ascendancy Titan; skill Blood Hunt']);
    const plain = plainPart(out);
    // The deck's header, once: what the cards share, how they differ, and the default confidence, said once.
    const deck = fs.readFileSync(path.join(dir, 'cards.md'), 'utf8');
    const share = /## What the cards share\n\n(.*)\n/.exec(deck)![1];
    expect(plain.filter((l) => l.startsWith('What the cards share: '))).toEqual([`What the cards share: ${share}`]);
    expect(plain.filter((l) => l.startsWith('How they differ: '))).toEqual(['How they differ: Seven of seven are one Blood Hunt loop; they differ in the weapon, the defence and the add-on that clears packs.']);
    expect(plain.filter((l) => /not confirmed in game/i.test(l))).toHaveLength(1);
    // Every dealt card, numbered in the deck's order: its name, then its five pitch lines, then Unusual when under-played.
    const dealt = [...deck.split('## Not dealt')[0].matchAll(/^- (r1-[a-c]-\d) /gm)].map((m) => m[1]);
    expect(dealt).toHaveLength(7);
    const numbered: string[] = [];
    dealt.forEach((id, k) => {
      const p = pitchOf(dir, id);
      const at = plain.indexOf(`${k + 1}. ${p.Name}`);
      expect({ id, at: at > 0 }).toEqual({ id, at: true });
      expect(plain.slice(at + 1, at + 6)).toEqual(PITCH.map((f) => `   ${f}: ${p[f]}`));
      if (p['Under-played (judgment)']) expect(plain[at + 6]).toBe(`   Unusual: ${p['Under-played (judgment)']}`);
      numbered.push(`- ${k + 1}. ${p.Name}: ${id}`);
    });
    // Then the not-dealt reasons, then the found-not-used list, then the invitation.
    const notDealt = plain.indexOf('Not dealt:');
    const found = plain.indexOf('Found, not used:');
    expect(notDealt).toBeGreaterThan(plain.indexOf(`7. ${pitchOf(dir, dealt[6]).Name}`));
    expect(plain.slice(notDealt, found)).toEqual(['Not dealt:', '- Blood Hunt crit lunge: no lookup confirms "critical hits inflict Blood Loss"', '- Blood Hunt with a bleed unique: the same build as "Blood Hunt bleed burst"', '']);
    expect(plain.slice(found)).toEqual([
      'Found, not used:', '- Herald of Blood as the main clear: no card leads packs with it, since its explosions need a bleeding kill first.', '',
      'Ask anything about these cards first. Then say in your own words which 1 to 3 to verify (by name or number), with any changes you want, or a new card from their ideas; or brainstorm more, or stop.', '',
    ]);
    // No card id outside For reference; no "links confirmed", no "no player evidence", no playstyle tags.
    const text = plain.join('\n');
    expect(text).not.toMatch(/\br\d+-[a-cg]-\d+\b/);
    expect(text).not.toMatch(/links confirmed|no player evidence|Playstyle/i);
    for (const id of dealt) expect(text).not.toContain(pitchOf(dir, id).Playstyle);
    expect(referenceOf(out)).toEqual(['For reference:', ...numbered, '- Not dealt: Blood Hunt crit lunge: r1-a-3, Blood Hunt with a bleed unique: r1-b-2', `- Deck: ${path.join(dir, 'cards.md')}`, '']);
    expect(readJson(dir, 'run-log.json').displays).toEqual([{ checkpoint: 'brainstorm', visit: 1 }]);
  });

  it('brainstorm, a later visit: the cards verified since, a gate-made card among them, are left out, and the rest numbered from 1 (run-interview)', () => {
    const dir = copy('run-interview');
    const out = display(dir, 'brainstorm');
    expect(out[0]).toBe('## The brainstorm gate, visit 2');
    const names = plainPart(out).filter((l) => /^\d+\. /.test(l));
    expect(names).toEqual(['1. Blood Hunt with Rolling Slam clear', '2. Blood Hunt on a two-hander', '3. Blood Hunt with Titan slam notables', '4. Blood Hunt block tank', '5. Blood Hunt rage cycling']);
    expect(out.join('\n')).not.toMatch(/Bleeding Shield Wall|Blood Hunt armour stacker|^\d+\. Blood Hunt bleed burst$/m);
  });

  it("verification (D-392, D-407): each verified card by name, its status in words, its why, its clear (here the card's estimate: these skeleton records predate WU-88's measures), its Bosses line, then its figures with units and what they're measured against, its key prices, its catch and what verification found; a gate's change and a gate-made card say so; ids and the dossier last", () => {
    const dir = copy('run-interview');
    const out = display(dir, 'verification');
    expect(out).toEqual([
      '## The verification gate, visit 2', '',
      '1. Blood Hunt bleed burst: works.',
      '   Why pick it: One lunge spends the bleed you built for a big hit, so rares melt in two presses. The simplest Blood Hunt loop in the deck.',
      '   How it clears: Lunge into the pack with Blood Hunt; Herald of Blood pops the bleeding dead. One button for packs, and the lunge carries you to the next one. (an estimate; measured at the design)',
      '   Bosses: Re-apply bleed, then lunge to consume it; the burst is its boss answer.',
      '   Damage: 50,000 per second from Blood Hunt, against map monsters (modelled in PoB).',
      "   Toughness: 4,200 life and 31,500 effective HP (PoB's estimate of the damage it takes to kill you).",
      '   Key prices: weapon: unavailable (offline run).',
      '   The catch: The burst needs Blood Loss on the target first, and PoB has no setting for its uptime.',
      '   Found in verification: chaos resistance stays low',
      '',
      '2. Blood Hunt armour stacker: works.',
      '   Why pick it: Stacked armour shrugs off the hits that kill most melee builds, and Blood Hunt still bursts.',
      '   How it clears: Lunge into the pack and stand in it; Herald of Blood clears the bleeding dead. (an estimate; measured at the design)',
      '   Bosses: Face-tank the hits and lunge between them.',
      '   Damage: 50,000 per second from Blood Hunt, against map monsters (modelled in PoB).',
      "   Toughness: 4,200 life and 31,500 effective HP (PoB's estimate of the damage it takes to kill you).",
      '   Key prices: weapon: unavailable (offline run).',
      '   The catch: Armour takes the gear slots that would add damage, so the burst is smaller.',
      '   Found in verification: dropping Brutality I costs the burst a tenth',
      '   Changed at the gate (visit 1): keep Bloodlust, but drop Brutality I for a second armour layer',
      '',
      '3. Bleeding Shield Wall: works.',
      '   Why pick it: The bleed burst\'s one-lunge kill, with a shield that blocks the hits a lunge walks into.',
      '   How it clears: Lunge into the pack with Blood Hunt; Herald of Blood pops the bleeding dead, and the shield holds while you do. (an estimate; measured at the design)',
      '   Bosses: Block the big swings, then lunge to consume the bleed.',
      '   Damage: 50,000 per second from Blood Hunt, against map monsters (modelled in PoB).',
      "   Toughness: 4,200 life and 31,500 effective HP (PoB's estimate of the damage it takes to kill you).",
      '   Key prices: weapon: unavailable (offline run).',
      "   The catch: The shield costs the off-hand damage, so the burst is a little smaller than the bleed burst's.",
      '   Found in verification: the shield costs off-hand damage',
      "   Made at the gate (visit 1): from Blood Hunt bleed burst and Blood Hunt block tank: the bleed burst's lunge, but from behind the block tank's shield",
      '',
      'Ask anything about these builds first. Then say in your own words which one to finalize, with any changes; or verify other cards, make a new one, brainstorm more, or stop.',
      '',
      'For reference:',
      '- 1. Blood Hunt bleed burst: r1-a-1',
      '- 2. Blood Hunt armour stacker: r1-b-3',
      '- 3. Bleeding Shield Wall: r1-g-1',
      `- Dossier: ${path.join(dir, 'dossier.md')}`,
      '',
    ]);
  });

  it("verification, D-407's pace: a skeleton record from before WU-88, with no measures, shows the card's How it clears as the estimate it is; one with WU-88's measures leads with its clear speed and movement speed, How it clears marked an estimate (its time to first damage, which PoB doesn't measure), then the Bosses line and the figures", () => {
    const dir = copy('run-interview');
    const how = 'Lunge into the pack with Blood Hunt; Herald of Blood pops the bleeding dead. One button for packs, and the lunge carries you to the next one.';
    // WU-88 measures every card skeleton (D-407); this fixture's skeleton records were written before it, with no
    // measures, so no clear-speed line: the pitch's estimate stands in.
    expect(readJson(dir, 'concepts/r1-a-1/compile-record.json').stages.r1a1e.measures).toBeUndefined();
    let out = display(dir, 'verification');
    expect(out.filter((l) => /^ {3}(Clear speed|How it clears):/.test(l)).slice(0, 1)).toEqual([`   How it clears: ${how} (an estimate; measured at the design)`]);
    expect(out.join('\n')).not.toMatch(/Clear speed:|Movement speed:/);
    editJson(dir, 'concepts/r1-a-1/compile-record.json', (r) => {
      r.stages.r1a1e.measures = {
        clearSpeed: { speed: 'fast', rough: true, group: 1, key: 'g1s1p1', skill: 'Blood Hunt', radiusMetres: 4.2, band: 'fast', noArea: false, onDeath: false, usesPerSecond: 1.5, longUse: false },
        movementSpeed: 1.251,
      };
    });
    out = display(dir, 'verification');
    const at = out.indexOf('1. Blood Hunt bleed burst: works.');
    expect(out.slice(at + 2, at + 8)).toEqual([
      "   Clear speed: fast (a rough estimate from Blood Hunt's area).",
      '   Movement speed: +25% over your base speed.',
      `   How it clears: ${how} (an estimate)`,
      '   Bosses: Re-apply bleed, then lunge to consume it; the burst is its boss answer.',
      '   Damage: 50,000 per second from Blood Hunt, against map monsters (modelled in PoB).',
      "   Toughness: 4,200 life and 31,500 effective HP (PoB's estimate of the damage it takes to kill you).",
    ]);
    // The other cards' skeletons stay unmeasured.
    expect(out).toContain('   How it clears: Lunge into the pack and stand in it; Herald of Blood clears the bleeding dead. (an estimate; measured at the design)');
  });

  it("verification: a card that can't be built yet says why, a failed card's verdict and the last design's are kept for reference (run-escalated)", () => {
    const dir = copy('run-escalated');
    const out = display(dir, 'verification');
    expect(out).toContain("2. Melting Maelstrom nova: can't be built yet: its damage source isn't a skill.");
    expect(out).toContain('Back from the design of Blood Hunt bleed burst: its last check failed and was escalated to you.');
    expect(plainPart(out).join('\n')).not.toMatch(/\br\d+-[a-cg]-\d+\b|reports\/gates/);
    expect(referenceOf(out)).toEqual([
      'For reference:', '- 1. Blood Hunt bleed burst: r1-a-1', '- 2. Melting Maelstrom nova: r1-c-1',
      '- Melting Maelstrom nova (r1-c-1) failed: reports/gates/R1b-r1-c-1-a1.json',
      '- Last design verdict, r1-a-1 (escalated): reports/gates/D1-gate-r1-a-1-a3.json',
      `- Dossier: ${path.join(dir, 'dossier.md')}`, '',
    ]);
  });

  it("verification, D-397: a plain summon's skeleton figure is its minion's MinionTotalDPS × its Count, an estimate when the Count is above 1", () => {
    const dir = copy('run-interview');
    editJson(dir, 'concepts/r1-a-1/compile-record.json', (r) => {
      // A plain summon names no minion skill, so the record resolves no selection; PoB still measures its minion.
      const st = r.stages.r1a1e;
      delete st.minionSkills;
      st.skillOutputs.g1s1p1 = { skill: 'Skeletal Warrior', statSetLabel: 'Default', fields: { TotalDPS: 0, MinionTotalDPS: 12500 } };
      st.countedSkillOutputs.g1s1p1 = { skill: 'Skeletal Warrior', statSetLabel: 'Default', count: 4, dotCanStack: false, fields: { TotalDPS: 0, MinionTotalDPS: 50000 } };
    });
    expect(display(dir, 'verification').find((l) => l.startsWith('   Damage:'))).toBe("   Damage: 50,000 per second from Skeletal Warrior's minions, against map monsters (an estimate: a Count above 1 or a custom modifier carries it).");
  });

  it("AC-W67 (D-392) design, D-407's order: each endgame rung's block, the clear speed and movement speed first, then the Arbiter check, then damage and effective HP, each with its unit and what it means, the open estimates and the verdict in words; the codes and the verdict file only under For reference (A-35)", () => {
    const dir = copy('run-ok');
    const out = display(dir, 'design');
    // run-ok's record predates WU-88: no measures.movementSpeed, and no EffectiveMovementSpeedMod in its outputs.
    expect(out).toEqual([
      '## The design gate, visit 2', '',
      "The endgame build for Blood Hunt bleed burst, rung by rung, as its last design check measured it. Clear speed is a rough estimate from the main skill's area; movement speed is PoB's, over your base speed; damage is PoB's damage per second for the main skill; effective HP is PoB's estimate of the damage it takes to kill you.",
      '',
      'Entering maps (level 65):',
      '- Clear speed: medium (rough).',
      '- Movement speed: not measured.',
      '- Damage: 9,000 per second.',
      '- Effective HP: 18,400.',
      '- Gear: rare boots with lightning resistance; a life and cold-resistance helmet',
      '- Gems: Blood Hunt with Bloodlust and Brutality I',
      '- Passive tree: the life wheel by the Warrior start',
      '',
      'Budget endgame (level 90):',
      '- Clear speed: medium (rough).',
      '- Movement speed: not measured.',
      '- The Arbiter of Divinity: survives its hits (its worst, a physical hit, is 0.68 of your max hit).',
      '- Damage: 50,000 per second.',
      '- Effective HP: 31,500.',
      '- Anoint: Unbending: Ire, Guilt, Greed',
      '- Gear: a War Spear with increased physical damage; a life and fire-resistance body',
      '- Gems: Blood Hunt with Bloodlust and Brutality I; Herald of Blood',
      "- Passive tree: Titan's slam notables; the life and armour wheels",
      '',
      'Non-budget endgame (level 95):',
      '- Clear speed: medium (rough).',
      '- Movement speed: not measured.',
      '- The Arbiter of Divinity: survives its hits (its worst, a physical hit, is 0.47 of your max hit).',
      '- Damage: 140,000 per second.',
      '- Effective HP: 52,300.',
      '- Gear: a stronger War Spear and both rings',
      '- Gems: Blood Hunt with Bloodlust and Brutality I; Herald of Blood',
      "- Passive tree: Titan's slam notables; the life and armour wheels",
      '',
      'Still estimates:',
      '- Budget endgame (level 90): Blood Loss stacks are a hand calculation (bleed_bonus)',
      "- clear speed is a rough estimate from the skill's area",
      '',
      "The endgame design: PoB built it; it's legal at each stage's level (passive points, gem levels, item and attribute requirements); its PoB settings match what each stage has; every endgame rung meets the survival floor (capped resistances, and a max hit above each map hit); some prices aren't known, so not every rung's total is; the named skill is its main damage.",
      '',
      'Ask anything about this build first. Then accept it, ask for changes, go back to the verification gate to finalize another card, or stop.',
      '',
      'For reference:',
      '- Verdict: compiled pass, v1 pass, v2 pass, floor pass, budget unverified, rolledSkill pass',
      '- Verdict file: reports/gates/D1-gate-r1-a-1-a2.json',
      '- Rungs: Entering maps (level 65): m, Budget endgame (level 90): b, Non-budget endgame (level 95): n',
      '',
    ]);
    expect(plainPart(out).join('\n')).not.toMatch(CODES);
  });

  it("AC-W67 (D-392) final: plain sentences of what was checked, what passed and what's open; each endgame rung's final figures with the design gate's where they moved (D-369), the budget and the known issues; the codes, the verdict files and the run checker's result only under For reference", () => {
    const dir = copy('run-ok');
    const out = display(dir, 'final');
    const plain = plainPart(out);
    expect(plain.join('\n')).not.toMatch(CODES);
    expect(plain.slice(0, 12)).toEqual([
      '## The final gate, visit 2', '',
      `The guide for Blood Hunt bleed burst: ${path.join(dir, 'guide.md')}`,
      `Its audit, how each number was checked: ${path.join(dir, 'audit.md')}`,
      'Your PoB file: titan-blood-hunt-2026-10-08-1.xml',
      '',
      'What was checked:',
      "- The endgame design: PoB built it; it's legal at each stage's level (passive points, gem levels, item and attribute requirements); its PoB settings match what each stage has; every endgame rung meets the survival floor (capped resistances, and a max hit above each map hit); some prices aren't known, so not every rung's total is; the named skill is its main damage.",
      "- The whole plan, from level 1 to the endgame: PoB built it; it's legal at each stage's level (passive points, gem levels, item and attribute requirements); its PoB settings match what each stage has.",
      "- The guide's claims, against their sources: some are still open; they're the known issues below.",
      '- The run checker: it found no problem.',
      '',
    ]);
    // D-369: the final record's figures, and the design gate's where they moved (here the clear speed).
    const at = plain.findIndex((l) => l.startsWith('The endgame, from the final build.'));
    expect(plain.slice(at + 1, at + 7)).toEqual([
      '- Entering maps (level 65): 9,000 damage per second, 18,400 effective HP, clear speed slow (rough).',
      '  At the design gate: 9,000 damage per second, 18,400 effective HP, clear speed medium (rough).',
      "- Budget endgame (level 90): 50,000 damage per second, 31,500 effective HP, survives the Arbiter of Divinity's hits (its worst, a physical hit, is 0.68 of your max hit), clear speed slow (rough).",
      "  At the design gate: 50,000 damage per second, 31,500 effective HP, survives the Arbiter of Divinity's hits (its worst, a physical hit, is 0.68 of your max hit), clear speed medium (rough).",
      "- Non-budget endgame (level 95): 140,000 damage per second, 52,300 effective HP, survives the Arbiter of Divinity's hits (its worst, a physical hit, is 0.47 of your max hit), clear speed slow (rough).",
      "  At the design gate: 140,000 damage per second, 52,300 effective HP, survives the Arbiter of Divinity's hits (its worst, a physical hit, is 0.47 of your max hit), clear speed medium (rough).",
    ]);
    // D-371, D-374: each rung's budget line from the D1 gate's last verdict file, in the guide's Checks words.
    const budget = plain.indexOf('The budget, from the last design check:');
    expect(plain.slice(budget + 1, budget + 9)).toEqual([
      '- Entering maps (level 65): Budget: unknown, against a 5-divine target.',
      "  Prices are unavailable (offline run), so this rung's total isn't known.",
      '- Budget endgame (level 90): Budget: unknown, aiming at about 5 a slot.',
      "  Prices are unavailable (offline run), so this rung's total isn't known.",
      '- Non-budget endgame (level 95): Budget: unknown, against the 100–200 target.',
      "  Prices are unavailable (offline run), so this rung's total isn't known.",
      "Some prices are unavailable, so the total of each rung they price isn't known.",
      'The guide is from an offline run: no price was checked.',
    ]);
    expect(plain.join('\n')).not.toMatch(/within its budget|ceiling|D-164/);
    const open = plain.indexOf("What's still open, the guide's known issues:");
    expect(plain[open + 1]).toMatch(/^- The How to play it section is wrong to call Rolling Slam your clear skill/);
    expect(referenceOf(out)).toEqual([
      'For reference:',
      '- D1-gate: compiled pass, v1 pass, v2 pass, floor pass, budget unverified, rolledSkill pass (reports/gates/D1-gate-r1-a-1-a2.json)',
      '- D2-gate: compiled pass, v1 pass, v2 pass (reports/gates/D2-gate-r1-a-1-a1.json)',
      '- Rungs: Entering maps (level 65): m, Budget endgame (level 90): b, Non-budget endgame (level 95): n',
      '- Unknown totals: D-164',
      '- Run checker: ok',
      '',
    ]);
  });

  it('final, online: an unavailable fallback is no D-164 reason, so with every total known the display gives no D-164 line (D-371)', () => {
    const dir = copy('run-ok-online');
    const planPath = path.join(dir, 'plan.json');
    const plan = JSON.parse(fs.readFileSync(planPath, 'utf8')) as Json;
    Object.assign(plan.prices.find((x: Json) => x.id === 'b-weapon-fallback'), { status: 'unavailable', amount: null, currency: null, note: 'pricing stopped' });
    fs.writeFileSync(planPath, `${JSON.stringify(plan, null, 2)}\n`);
    const out = display(dir, 'final');
    const budget = out.indexOf('The budget, from the last design check:');
    expect(out.slice(budget + 1, budget + 4)).toEqual([
      '- Entering maps (level 65): Budget: about 1.8–4 divines around day 7, against a 5-divine target.',
      '- Budget endgame (level 90): Budget: about 8.8–20 divines around day 7, aiming at about 5 a slot. Over target: Weapon 1 (about 3.2–7.2; fallback price unknown).',
      '- Non-budget endgame (level 95): Budget: about 84–143 divines around day 21, against the 100–200 target. Over target: Body Armour (about 20–34).',
    ]);
    expect(out.join('\n')).not.toMatch(/Prices are unavailable|Some prices are unavailable|D-164/);
  });

  it("final, online: each rung's total range at its price day against its target and its over-target slots (D-371, D-374), with no D-164 line when every price is known, and no pass codes outside For reference", () => {
    const out = display(copy('run-ok-online'), 'final');
    const budget = out.indexOf('The budget, from the last design check:');
    expect(out.slice(budget + 1, budget + 4)).toEqual([
      '- Entering maps (level 65): Budget: about 1.8–4 divines around day 7, against a 5-divine target.',
      '- Budget endgame (level 90): Budget: about 8.8–20 divines around day 7, aiming at about 5 a slot. Over target: Weapon 1 (about 3.2–7.2; fallback about 1.2–2.7).',
      '- Non-budget endgame (level 95): Budget: about 84–143 divines around day 21, against the 100–200 target. Over target: Body Armour (about 20–34).',
    ]);
    expect(out.join('\n')).not.toContain('D-164');
    expect(plainPart(out).join('\n')).not.toMatch(CODES);
    expect(out.slice(-2)).toEqual(['- Run checker: ok', '']);
  });

  it('escalation (D-392): what failed and why in a sentence, then the attempts, the verdict, its findings and its file for reference', () => {
    const out = display(copy('run-escalated'), 'escalation');
    expect(out).toEqual([
      '## Escalation, visit 2', '',
      "The endgame design for Blood Hunt bleed burst failed 3 times, so the run stops to ask you. What failed: something isn't legal at its stage's level (passive points, gem levels, item or attribute requirements): stage b spends 108 passive points, but level 1 grants 0 (FI-2).",
      '',
      'Ask anything about this first. Then accept what failed, give guidance for one more try, go back to the verification gate, or stop.',
      '',
      'For reference:',
      '- D1-gate, r1-a-1: attempts 1 fail, 2 fail, 3 escalated',
      '- Verdict: compiled pass, v1 fail, v2 pass, floor pass, budget unverified, rolledSkill pass',
      '  v1 level-points: stage b spends 108 passive points, but level 1 grants 0 (FI-2)',
      '  floor chaos-exception: MissingChaosResist 47 on stage b, kept by its chaosResistException: no slot can carry chaos resistance without dropping a core item or breaking the budget',
      '- Verdict file: reports/gates/D1-gate-r1-a-1-a3.json',
      '',
    ]);
  });

  it("checkpoint refuses a gate's answer until that visit's display is recorded; printing it again records nothing new; the unsaved-build question has no display", () => {
    const dir = folder();
    // Amendment 9 (WU-94): init writes schema 4, whose design gate is a build's (D-411, D-412).
    expect(run(RUN_LOG, dir, 'init', JSON.stringify({ slug: 'titan-blood-hunt', brief: {}, mode: 'offline', testConfig: 'accepted', noNinja: false })).code).toBe(0);
    expect(run(RUN_LOG, dir, 'build', JSON.stringify({ id: CARD, roll: { className: 'Warrior', ascendancy: 'Titan', skill: 'Blood Hunt' }, status: 'queued' })).code).toBe(0);
    const answer = (visit: number) => run(RUN_LOG, dir, 'checkpoint', JSON.stringify({ checkpoint: 'design', concept: CARD, visit, answer: 'accept', answeredBy: 'user' }));
    const before = fs.readFileSync(path.join(dir, 'run-log.json'));
    expect(answer(1)).toEqual({ code: 1, stdout: '', stderr: "run-log: checkpoint entry refused: the design gate's visit 1 printed no display; run run-log.mjs <runFolder> display design first and print its output (D-367)\n" });
    expect(fs.readFileSync(path.join(dir, 'run-log.json'))).toEqual(before);
    const designShown = () => {
      const r = run(RUN_LOG, dir, 'display', 'design', '--build', CARD);
      expect({ code: r.code, stderr: r.stderr }).toEqual({ code: 0, stderr: '' });
      return r.stdout.split('\n');
    };
    expect(designShown()).toEqual(['## The design gate, visit 1', '', `No D1 gate for ${CARD} in the run log.`, '']);
    designShown();
    expect(readJson(dir, 'run-log.json').displays).toEqual([{ checkpoint: 'design', visit: 1 }]);
    expect(answer(1)).toEqual({ code: 0, stdout: 'run-log: wrote checkpoints[0]\n', stderr: '' });
    // The next visit needs its own display.
    expect(answer(2).stderr).toBe("run-log: checkpoint entry refused: the design gate's visit 2 printed no display; run run-log.mjs <runFolder> display design first and print its output (D-367)\n");
    expect(run(RUN_LOG, dir, 'checkpoint', JSON.stringify({ checkpoint: 'escalation', visit: 1, answer: 'stop', answeredBy: 'user' })).stderr).toMatch(/^run-log: checkpoint entry refused: the escalation question's visit 1 printed no display/);
    expect(run(RUN_LOG, dir, 'checkpoint', JSON.stringify({ checkpoint: 'unsaved-build', visit: 1, answer: 'proceed', answeredBy: 'user' })).code).toBe(0);
    expect(run(RUN_LOG, dir, 'display', 'unsaved-build')).toEqual({ code: 1, stdout: '', stderr: 'run-log: display: "unsaved-build" isn\'t one of brainstorm, verification, design, final, escalation\n' });
  });
});

describe('AC-W68 (WU-81; D-389, D-391): a gate\'s checkpoint carries its questions, the changes riding on its picks, the cards made at the gate and a brainstorm-more note', () => {
  /** run-ok rolled back to its brainstorm gate, the display printed: the deck holds r1-a-1 … r1-c-3. */
  const atGate = () => {
    const dir = atBrainstorm('run-ok');
    expect(run(RUN_LOG, dir, 'display', 'brainstorm').code).toBe(0);
    return dir;
  };
  const write = (dir: string, entry: Json) => run(RUN_LOG, dir, 'checkpoint', JSON.stringify(entry));
  const WORDS = "the bleed burst's lunge, but from behind the block tank's shield";
  const NEW = { id: 'r1-g-1', name: 'Bleeding Shield Wall', from: ['r1-a-1', 'r1-c-2'], words: WORDS };
  const PICK = { checkpoint: 'brainstorm', visit: 1, answer: 'pick:r1-a-1,r1-a-2', answeredBy: 'user' };

  it("accepts a checkpoint with questions, changes keyed by picked cards, a new card r<k>-g-<n> and, at a later visit, note with more; it writes them in the entry form's order", () => {
    const dir = atGate();
    const entry = { ...PICK, newCards: [NEW], changes: { 'r1-a-2': 'swap Rolling Slam for a second Blood Hunt link' }, questions: 2 };
    expect(write(dir, entry)).toEqual({ code: 0, stdout: 'run-log: wrote checkpoints[0]\n', stderr: '' });
    const logged = readJson(dir, 'run-log.json').checkpoints[0];
    expect(Object.keys(logged)).toEqual(['checkpoint', 'visit', 'answer', 'answeredBy', 'questions', 'changes', 'newCards']);
    expect(logged).toEqual(entry);
    // The verification gate: a new card alone with an empty verify:, its id the round's next, n counting on.
    expect(run(RUN_LOG, dir, 'display', 'verification').code).toBe(0);
    const second = { checkpoint: 'verification', visit: 1, answer: 'verify:', answeredBy: 'user', questions: 0, newCards: [{ id: 'r1-g-2', name: 'Rage Wall', from: ['r1-c-3', 'r1-c-2'], words: 'rage, behind the shield wall' }] };
    expect(write(dir, second)).toEqual({ code: 0, stdout: 'run-log: wrote checkpoints[1]\n', stderr: '' });
    // A brainstorm-more answer keeps its note (D-391).
    expect(run(RUN_LOG, dir, 'display', 'verification').code).toBe(0);
    expect(write(dir, { checkpoint: 'verification', visit: 2, answer: 'more', answeredBy: 'user', questions: 1, note: 'investigate whether Herald of Blood can spread the bleed' }).code).toBe(0);
    expect(readJson(dir, 'run-log.json').checkpoints[2].note).toBe('investigate whether Herald of Blood can spread the bleed');
    // A test config's answer records its object's answer as the rule, and the asks as its questions (D-394).
    expect(run(RUN_LOG, dir, 'display', 'design').code).toBe(0);
    expect(write(dir, { checkpoint: 'design', visit: 1, answer: 'accept', answeredBy: 'pre-supplied', rule: 'accept', questions: 1 }).code).toBe(0);
  });

  it('refuses changes naming an unpicked card, newCards drawing on a card the deck doesn\'t hold, picks and new cards over 3, and note on any other answer; nothing is written', () => {
    const dir = atGate();
    const before = fs.readFileSync(path.join(dir, 'run-log.json'));
    const refused: [Json, RegExp][] = [
      [{ ...PICK, changes: { 'r1-b-1': 'a bigger spear' } }, /changes names r1-b-1, which the answer "pick:r1-a-1,r1-a-2" doesn't pick; a revision rides on a picked card \(D-391\)/],
      [{ ...PICK, newCards: [{ ...NEW, from: ['r1-a-1', 'r1-c-9'] }] }, /newCards\[0\] draws on r1-c-9, which the deck \(cards\.md\) doesn't hold \(D-391\)/],
      [{ ...PICK, answer: 'pick:r1-a-1,r1-a-2,r1-b-1', newCards: [NEW] }, /the answer picks 3 card\(s\) and makes 1: 4 over 3; a pick verifies 1–3 cards, new cards included \(D-391\)/],
      [{ ...PICK, note: 'more Herald of Blood' }, /note goes with more, the brainstorm-more answer, not "pick:r1-a-1,r1-a-2" \(D-391\)/],
      [{ ...PICK, answer: 'stop', note: 'enough' }, /note goes with more/],
      // A new card's id is the latest round's next gate card, its name one no card has, and it goes with a pick.
      [{ ...PICK, newCards: [{ ...NEW, id: 'r1-g-2' }] }, /newCards\[0\] has id "r1-g-2"; the next card made at a gate is r1-g-1/],
      [{ ...PICK, newCards: [{ ...NEW, id: 'r1-a-9' }] }, /newCards\[0\] id "r1-a-9" isn't a gate-made card's id r<k>-g-<n>/],
      [{ ...PICK, newCards: [{ ...NEW, name: 'Blood Hunt block tank' }] }, /newCards\[0\] is named "Blood Hunt block tank", which card r1-c-2 already has; a name is never reused \(D-392\)/],
      [{ ...PICK, answer: 'more', newCards: [NEW] }, /newCards goes with the brainstorm gate's pick: or the verification gate's verify:, not "more"/],
      [{ ...PICK, answer: 'pick:' }, /"pick:" picks no card; a pick names 1–3 cards, or makes a new one with newCards/],
      [{ ...PICK, questions: -1 }, /questions -1 isn't a whole number from 0/],
      [{ ...PICK, newCards: [{ ...NEW, from: [] }] }, /newCards\[0\] from lists the card ids it draws on/],
      [{ ...PICK, extra: 1 }, /"extra" isn't a field of a checkpoint entry/],
    ];
    for (const [entry, why] of refused) {
      const r = write(dir, entry);
      expect({ entry, code: r.code, stdout: r.stdout }).toEqual({ entry, code: 1, stdout: '' });
      expect(r.stderr).toMatch(/^run-log: checkpoint entry refused: /);
      expect(r.stderr).toMatch(why);
    }
    // questions belong to a displayed gate; the unsaved-build question is fixed.
    expect(write(dir, { checkpoint: 'unsaved-build', visit: 1, answer: 'proceed', answeredBy: 'user', questions: 1 }).stderr).toMatch(/questions is only on a gate's or an escalation's answer/);
    expect(fs.readFileSync(path.join(dir, 'run-log.json'))).toEqual(before);
    // A verification pick:<id> (finalize) carries changes for D1-build, but makes no new card.
    expect(run(RUN_LOG, dir, 'stage', JSON.stringify({ stage: 'Q', attempt: 1, outcome: 'done' })).code).toBe(0);
    expect(run(RUN_LOG, dir, 'stage', JSON.stringify({ stage: 'Q', concept: 'r1-a-1', attempt: 1, outcome: 'done' })).stderr).toMatch(/a Q entry has no concept/);
    expect(run(RUN_LOG, dir, 'display', 'verification').code).toBe(0);
    expect(write(dir, { checkpoint: 'verification', visit: 1, answer: 'pick:r1-a-1', answeredBy: 'user', newCards: [NEW] }).stderr).toMatch(/newCards goes with the brainstorm gate's pick: or the verification gate's verify:, not "pick:r1-a-1"/);
    expect(write(dir, { checkpoint: 'verification', visit: 1, answer: 'pick:r1-a-1', answeredBy: 'user', changes: { 'r1-a-1': 'a cheaper helmet' } }).code).toBe(0);
  });
});

describe('D-394 (AC-W68): run-log.mjs test-config checks a test config, whose answer entries may be strings or objects scripting an interview', () => {
  const check = (cfg: unknown) => {
    const file = path.join(folder(), 'test-config.json');
    fs.writeFileSync(file, typeof cfg === 'string' ? cfg : JSON.stringify(cfg));
    return { file, ...run(RUN_LOG, path.dirname(file), 'test-config', file) };
  };

  it('accepts string entries and object entries: asks with an answer, changes, new cards, a note with more', () => {
    const cfg = {
      answers: {
        brainstorm: [
          // The amendment's example (§7), and its new card.
          { ask: ['Which card clears fastest?', 'Could skeleton deaths make the ground?'], answer: 'pick:r1-a-1,r1-b-1', changes: { 'r1-a-1': 'use a sceptre for minion levels' } },
          { answer: 'pick:r1-a-1', newCards: [{ name: 'Frozen Djinn Army', from: ['r1-a-1', 'r1-b-2'], words: 'the djinn with the frozen ground' }] },
          { ask: ['Is there a cold build?'], answer: 'more', note: 'a cold build' },
          'first-n:2',
        ],
        verification: ['first-viable', { ask: ['Which is tankiest?'], answer: 'verify:', newCards: [{ name: 'Shield Wall', from: ['r1-c-2'], words: 'block' }] }, { answer: 'pick:r1-a-1', changes: { 'r1-a-1': 'a cheaper helmet' } }],
        design: [{ ask: ['Did the designer measure Skeletal Cleric?'], answer: 'accept' }],
        final: ['accept'],
        escalation: [{ ask: ['What failed?'], answer: 'retry:keep the helmet' }],
        unsavedBuild: 'proceed',
      },
      faults: [{ id: 'FI-1', concepts: ['r1-a-1'], persistent: true }, { id: 'FI-2', concepts: 'all' }],
    };
    const r = check(cfg);
    expect({ code: r.code, stdout: r.stdout, stderr: r.stderr }).toEqual({ code: 0, stdout: `run-log: test config ${r.file} is well formed\n`, stderr: '' });
    // offline-and-test.md's example is well formed too.
    const md = fs.readFileSync(path.join(SKILL_DIR, 'references', 'offline-and-test.md'), 'utf8');
    expect(check(/## The test config[\s\S]*?```json\n([\s\S]*?)\n```/.exec(md)![1]).code).toBe(0);
  });

  it('refuses the malformed entries: changes naming a card the answer doesn\'t pick, newCards with another answer, picks and new cards over 3, note without more, an empty question', () => {
    const NEW = { name: 'Frozen Djinn Army', from: ['r1-a-1', 'r1-b-2'], words: 'the djinn with the frozen ground' };
    const refused: [Json, RegExp][] = [
      [{ brainstorm: [{ answer: 'pick:r1-a-1', changes: { 'r1-b-1': 'x' } }] }, /answers\.brainstorm\[0\]: changes names r1-b-1, which the answer "pick:r1-a-1" doesn't pick/],
      [{ brainstorm: [{ answer: 'first-n:2', changes: { 'r1-a-1': 'x' } }] }, /changes rides on picked cards: .*not "first-n:2"/],
      [{ brainstorm: [{ answer: 'more', newCards: [NEW] }] }, /answers\.brainstorm\[0\]: newCards goes with the brainstorm gate's pick: or the verification gate's verify:, not "more"/],
      [{ verification: [{ answer: 'pick:r1-a-1', newCards: [NEW] }] }, /answers\.verification\[0\]: newCards goes with/],
      [{ design: [{ answer: 'accept', newCards: [NEW] }] }, /answers\.design\[0\]: newCards is only on a brainstorm or verification answer/],
      [{ brainstorm: [{ answer: 'pick:r1-a-1,r1-a-2,r1-a-3', newCards: [NEW] }] }, /picks 3 card\(s\) and makes 1: 4 over 3/],
      [{ brainstorm: [{ answer: 'pick:r1-a-1', note: 'x' }] }, /answers\.brainstorm\[0\]: note goes with more/],
      [{ brainstorm: [{ ask: ['Which?', ' '], answer: 'stop' }] }, /answers\.brainstorm\[0\]: ask lists the questions to ask before the answer, none of them empty/],
      [{ brainstorm: [{ answer: 'pick:r1-a-1', newCards: [{ ...NEW, id: 'r1-g-1' }] }] }, /newCards\[0\] has an id, which the runner assigns/],
      [{ brainstorm: [{ answer: 'pick:r1-a-1', newCards: [{ ...NEW, from: ['Frozen Djinn'] }] }] }, /newCards\[0\] from lists the card ids it draws on/],
      [{ brainstorm: [{ answer: 'pick:', newCards: [] }] }, /newCards lists one or more new cards/],
      [{ brainstorm: ['pick:'] }, /"pick:" picks no card/],
      [{ brainstorm: [{ answer: 'pick:r1-a-1', why: 'x' }] }, /"why" isn't a field of an answer entry/],
      [{ verification: [{ ask: ['x'] }] }, /answer undefined isn't an answers\.verification value/],
      [{ checkpoint1: ['pick:r1-a-1'] }, /answers\.checkpoint1 is retired/],
      [{ escalation: ['checkpoint-1'] }, /"checkpoint-1" isn't an answers\.escalation value/],
    ];
    for (const [answers, why] of refused) {
      const r = check({ answers });
      expect({ answers, code: r.code, stdout: r.stdout }).toEqual({ answers, code: 1, stdout: '' });
      expect(r.stderr).toMatch(/^run-log: test config refused: /);
      expect(r.stderr).toMatch(why);
    }
    expect(check('{ not json').stderr).toMatch(/^run-log: test config refused: .* can't be read as JSON/);
    expect(check({ answers: {}, faults: [{ id: 'FI-9', concepts: 'all' }] }).stderr).toMatch(/faults\[0\] is \{id: FI-1 \| FI-2 \| FI-3/);
  });
});
