/**
 * AC-W108 (WU-140, amendment 14: D-478…D-494, §25, Appendix A) and risk R-82: the run scripts on fixture runs, each
 * spawned as a real `node` process with an explicit env.
 *
 * - `tests/fixtures/pipeline/run-a14`: run-a13 held to amendment 14 from its init (`skillRevision: 14`): R1b's skeleton
 *   files (r1-a-2's removed at its design, r1-a-1's left, an unpicked card's), the design accept's `scaling: false`; its
 *   plan at schema 10 with every rare titled by its key affixes, `n`'s exclude list and a `b` rare's spec (offline:
 *   `ranking: null`); `final-build.xml` beside its record; its trades in 14 fields with a `scaling` find on `b`; the D1
 *   gate's design field with its `summary` and its `draft`, F1's `draftRemoved`; audit.md re-rendered (the exclude list in
 *   Stage detail) and notes.txt rendered by render-notes.mjs. Each test breaks or extends a copy and reads the rule.
 * - the revision-13 fixtures (`run-a13`, `run-a12`, `run-composite`) beside it, which keep their displays and rules.
 *
 * Every figure here is the fixture's own or the pinned game data's; none comes from a user's run or a published guide.
 */
import { describe, it, expect, afterAll } from '@jest/globals';
import { spawnSync } from 'child_process';
import crypto from 'crypto';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { buildSha1 } from '../../src/plan/buildHash';
import { validatePlan } from '../../src/plan/schema';
import { loadReferenceData } from '../../src/plan/referenceData';
import { digestReport } from '../helpers/runningDigests';

type Json = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

const REPO = path.resolve(__dirname, '..', '..');
const SCRIPTS = path.join(REPO, 'skills', 'build-guide', 'scripts');
const CHECKER = path.join(SCRIPTS, 'check-run.mjs');
const RUN_LOG = path.join(SCRIPTS, 'run-log.mjs');
const RENDER = path.join(SCRIPTS, 'render-audit.mjs');
const NOTES = path.join(SCRIPTS, 'render-notes.mjs');
const FIXTURES = path.join(REPO, 'tests', 'fixtures', 'pipeline');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'a14-'));
afterAll(() => fs.rmSync(TMP, { recursive: true, force: true }));

const ENV = { PATH: '/usr/bin:/bin', LANG: 'C' };
function node(script: string, args: string[], input?: string) {
  const r = spawnSync(process.execPath, [script, ...args], { cwd: TMP, env: ENV, encoding: 'utf8', timeout: 30000, input });
  return { code: r.status, stdout: r.stdout, stderr: r.stderr };
}
const check = (dir: string) => node(CHECKER, [dir]);
/** The broken rule's lines on stderr. */
const lines = (stderr: string, rule: string) => stderr.split('\n').filter((l) => l.startsWith(`check-run: [${rule}] `));
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
function writeJson(dir: string, rel: string, v: unknown): void {
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
const display = (dir: string, gate: string, build?: string, detail = false) => node(RUN_LOG, [dir, 'display', gate, ...(build ? ['--build', build] : []), ...(detail ? ['--detail'] : [])]);
const write = (dir: string, kind: string, entry: Json) => node(RUN_LOG, [dir, kind, JSON.stringify(entry)]);
/** A display's body: its lines after its `## The <gate> gate, visit <n>` title and the blank line. */
const body = (stdout: string) => stdout.split('\n').slice(2);

const ID = 'r1-a-2';
const BUILD = `builds/${ID}`;
const PLAN = `${BUILD}/plan.json`;
const RECORD = `${BUILD}/compile-record.json`;
const TRADES = `${BUILD}/trades.json`;
const GUIDE = `${BUILD}/guide.md`;
const GATE = `reports/gates/D1-gate-${ID}-a1.json`;
const NAME = 'Blood Hunt with Rolling Slam clear';
const rung = (gate: Json, stage: string): Json => gate.design.rungs.find((r: Json) => r.stage === stage);
const stage = (plan: Json, id: string): Json => plan.stages.find((s: Json) => s.id === id);
const sha1 = (dir: string, rel: string) => crypto.createHash('sha1').update(fs.readFileSync(path.join(dir, rel))).digest('hex');
/** After a plan edit, the record's planSha1 and buildSha1 are the plan's again, so `record-plan` stays quiet. */
function replan(dir: string, edit: (p: Json) => void): void {
  editJson(dir, PLAN, edit);
  const s = sha1(dir, PLAN);
  const plan = readJson(dir, PLAN);
  editJson(dir, RECORD, (r) => {
    r.planSha1 = s;
    r.buildSha1 = buildSha1(plan as never);
  });
}
/** A rung's trades, in trades.json and the design field alike (the gate copies them). */
function setTrades(dir: string, edit: (ts: Json[]) => Json[]): void {
  let trades: Json[] = [];
  editJson(dir, TRADES, (t) => {
    t.trades = edit(t.trades);
    trades = t.trades;
  });
  editJson(dir, GATE, (g) => {
    for (const r of g.design.rungs) r.trades = trades.filter((t) => t.stage === r.stage);
  });
}
const st = (stg: string, attempt: number, outcome: string, extra: Json = {}): Json => ({ stage: stg, concept: ID, attempt, outcome, ...extra });
/**
 * A `readback.json` as `compile_plan`'s read-back writes it (`src/services/readBack.ts`'s `ReadBackFile`): each loadout with
 * a change, titled by PoB's loadout title (the record's `loadoutName`), never a stage id; `items` the given changes.
 */
const readback = (file: string, base: string, items: Json[] = []): Json => ({
  file, base, baseSha1: '0'.repeat(40), unmatched: [],
  loadouts: items.length === 0 ? [] : [{ title: 'Endgame budget (L90) {b}', items, gems: [], tree: { added: [], removed: [], ascendancy: [], jewels: [], attributes: [] }, config: [] }],
});

// ---------------------------------------------------------------------------------------------------
// The fixture itself, and the revision boundary (§25)
// ---------------------------------------------------------------------------------------------------

describe('AC-W108: run-a14 is a run the amended pipeline could write', () => {
  it('passes the checker, its log at 14 with the skeleton files, its plan at schema 10 titled by affixes, its trades in 14 fields', () => {
    const dir = copy('run-a14');
    passes(dir);
    const log = readJson(dir, 'run-log.json');
    expect(log.skillRevision).toBe(14);
    expect(log.stages.filter((s: Json) => s.stage === 'R1b').map((s: Json) => [s.concept, s.skeletonFile, s.skeletonRemoved ?? false])).toEqual([
      ['r1-a-1', 'Blood Hunt bleed burst skeleton (draft).xml', false],
      [ID, `${NAME} skeleton (draft).xml`, true],
    ]);
    const plan = readJson(dir, PLAN);
    expect(plan.schemaVersion).toBe(10);
    expect(stage(plan, 'b').items.slots.find((x: Json) => x.slot === 'Body Armour').text.split('\n')[1]).toBe('life, fire resistance');
    expect(readJson(dir, TRADES).trades.find((t: Json) => t.kind === 'scaling')).toMatchObject({ stage: 'b', slot: 'Weapon 1', by: 'D1-build', measured: true });
  });

  // Amendment 16's M-29 (WU-151, §24, D-507): init writes 15, and a resume stamps 15 beside 14 and prints the digests.
  it('init writes skillRevision 15 (14 before amendment 16); a resume of a revision-13 log stamps 14 and 15 with their boundaries', () => {
    const dir = path.join(TMP, `log-${++copies}`);
    fs.mkdirSync(dir);
    expect(write(dir, 'init', { slug: 'titan-blood-hunt', brief: { ascendancy: 'Titan', skill: 'Blood Hunt' }, mode: 'offline', testConfig: 'none', noNinja: false }).code).toBe(0);
    expect(readJson(dir, 'run-log.json')).toMatchObject({ skillRevision: 15, builds: [] });
    expect(readJson(dir, 'run-log.json')).not.toHaveProperty('skillRevisionFrom');
    const old = copy('run-a13');
    const before = readJson(old, 'run-log.json');
    expect(write(old, 'resume', { noNinja: false })).toEqual({ code: 0, stdout: `run-log: wrote resumes[0], status running, skillRevision 15 from stages[${before.stages.length}] (the rules of revisions 14 and 15)\n${digestReport(REPO)}`, stderr: '' });
    const log = readJson(old, 'run-log.json');
    expect(log.skillRevision).toBe(15);
    expect(log.skillRevisionFrom).toEqual({ 14: log.resumes[0].lengths, 15: log.resumes[0].lengths });
    passes(old);
  });

  it("every new rule but the layout lists holds only a build whose last D1 gate ran at or after 14's boundary", () => {
    // run-a14's build broken under five of amendment 14's rules: a generated rare name, advice to test in game, a
    // -fallback entry, no summary, a D1-tree price call.
    const breakIt = (dir: string) => {
      replan(dir, (p) => {
        const s = stage(p, 'b').items.slots.find((x: Json) => x.slot === 'Body Armour');
        s.text = s.text.replace('life, fire resistance', 'Dread Shell');
        p.prices.push({ ...p.prices.find((x: Json) => x.id === 'b-body'), id: 'b-body-fallback', spec: undefined });
      });
      editText(dir, GUIDE, '## FAQ\n', '## FAQ\n\nTest the lunge in game before you commit.\n');
      editJson(dir, GATE, (g) => {
        delete g.design.summary;
      });
    };
    const held = copy('run-a14');
    breakIt(held);
    const err = check(held).stderr;
    for (const rule of ['rare-title', 'test-advice', 'budget', 'design-field']) expect({ rule, n: lines(err, rule).length > 0 }).toEqual({ rule, n: true });
    // The same build in a log at 13 is held to none of them.
    const at13 = copy('run-a14');
    breakIt(at13);
    editJson(at13, 'run-log.json', (l) => {
      l.skillRevision = 13;
      for (const s of l.stages) {
        delete s.skeletonFile;
        delete s.skeletonRemoved;
      }
      for (const c of l.checkpoints) delete c.scaling;
    });
    const err13 = check(at13).stderr;
    for (const rule of ['rare-title', 'test-advice', 'budget', 'design-field']) expect({ rule, lines: lines(err13, rule) }).toEqual({ rule, lines: [] });
    // And after a resume's stamp, its D1 gate before the boundary: still none.
    expect(write(at13, 'resume', { noNinja: false }).code).toBe(0);
    const stamped = check(at13).stderr;
    for (const rule of ['rare-title', 'test-advice', 'budget', 'design-field']) expect({ rule, lines: lines(stamped, rule) }).toEqual({ rule, lines: [] });
    // A log at 13 takes none of amendment 14's fields: the writer refuses them, and the checker fails one written by hand.
    const old = copy('run-a13');
    expect(write(old, 'stage', { stage: 'D1-finish', concept: ID, attempt: 2, outcome: 'done', scope: 'swap' })).toMatchObject({ code: 1, stderr: expect.stringMatching(/scope is amendment 14's \(skillRevision 14\): resume the run first/) });
    expect(write(old, 'skeleton', { concept: ID })).toMatchObject({ code: 1, stderr: expect.stringMatching(/skeleton is amendment 14's \(skillRevision 14\); this log is at 13: resume it first/) });
    editJson(old, 'run-log.json', (l) => {
      l.stages[5].skeletonFile = `${NAME} skeleton (draft).xml`;
    });
    expect(lines(check(old).stderr, 'run-log')).toEqual([expect.stringMatching(/stages\[5\]: has skeletonFile, which is amendment 14's \(skillRevision 14\); an entry before its boundary has none/)]);
  });
});

// ---------------------------------------------------------------------------------------------------
// AC-W108, bullet 1: the displays (D-478, D-479, D-491)
// ---------------------------------------------------------------------------------------------------

const A11_TABLE = [
  '### Pieces measured', '', '| Key | Left out by | Does something |', '|---|---|---|',
  '| i1a-2 | Fist of War removed from group 1 | yes |', "| i1b-1 | the slot's plain Ruby Ring | no |",
].join('\n');
const A11_ROW = "| r1-s-1 | 1 | viable, except Blistering Bond does nothing in PoB | the aftershock hits twice | Rolling Slam: hit, ignite | 1 of 2: Blistering Bond does nothing in PoB | Blistering Bond: 40 exalted, seen 2026-10-24, not converted | none (offline) | the ignite rests on Blistering Bond's fire |";
/** run-composite held to amendment 14 from its init, with amendment 11's dossier and Pieces measured. */
function composite(): string {
  const dir = copy('run-composite');
  editJson(dir, 'run-log.json', (l) => {
    l.skillRevision = 14;
    l.pricing = { stops: [], retries: [] };
  });
  const dossier = fs.readFileSync(path.join(dir, 'dossier.md'), 'utf8').split('\n');
  const head = dossier.findIndex((x) => x.startsWith('| Card |'));
  dossier.splice(head, 3, '| Card | Round | Status | Synergy | Damage | Pieces | Key prices | League | Main risk |', '|---|---|---|---|---|---|---|---|---|', A11_ROW);
  fs.writeFileSync(path.join(dir, 'dossier.md'), dossier.join('\n'));
  const card = fs.readFileSync(path.join(dir, 'cards/r1-s-1.md'), 'utf8');
  fs.writeFileSync(path.join(dir, 'cards/r1-s-1.md'), card.replace(/### Pieces measured\n[\s\S]*$/, `${A11_TABLE}\n`));
  editJson(dir, 'reports/gates/R1b-r1-s-1-a1.json', (v) => {
    v.pieces = [{ key: 'i1a-2', figure: 'Rolling Slam (clear)', dropPercent: -18 }, { key: 'i1b-1', figure: 'Seismic Cry (boss)', dropPercent: -0.4 }];
  });
  return dir;
}

describe('AC-W108 (D-478): the brainstorm display of a revision-14 visit', () => {
  it('holds only the headers, their drawn-from lines and the closing lines; a pick: naming a number\'s card passes', () => {
    const dir = composite();
    // The verified composite is gone from the deck's display; let it be pickable again for the count.
    editJson(dir, 'run-log.json', (l) => {
      l.stages = l.stages.filter((s: Json) => !(s.stage === 'R1b' && s.concept === 'r1-s-1'));
    });
    const r = display(dir, 'brainstorm');
    expect(r.code).toBe(0);
    const shown = body(r.stdout).filter((l) => l !== '');
    expect(shown[0]).toMatch(/^Brief: /);
    const headers = shown.filter((l) => l.startsWith('**'));
    expect(headers.slice(0, 2)).toEqual([
      '**1. Aftershock Slammer** (Warrior, Titan, Rolling Slam; under-played: yes)',
      '**2. Jagged Earth Bastion** (Warrior, Titan, Earthquake; under-played: yes)',
    ]);
    // Every other line is a closing line, a drawn-from line or the invitation: no key pieces, scheduled names, shared
    // header or not-confirmed sentence.
    for (const l of shown.slice(1).filter((x) => !x.startsWith('**'))) expect(l).toMatch(/^(?:drawn from |Obvious build: |Plain cards: |A short round: |Ask anything about these builds first\.)/);
    expect(r.stdout).not.toMatch(/^ {2}in: |scheduled:|What the composites share|Not confirmed in game/m);
    const numbers = readJson(dir, 'run-log.json').displays.pop().numbers;
    expect(numbers['1']).toBe('r1-s-1');
    // The runner maps "number 1" to its card through the visit's numbers.
    expect(write(dir, 'checkpoint', { checkpoint: 'brainstorm', visit: readJson(dir, 'run-log.json').checkpoints.filter((c: Json) => c.checkpoint === 'brainstorm').length + 1, answer: `pick:${numbers['1']}`, answeredBy: 'user', questions: 0 }).code).toBe(0);
    expect(lines(check(dir).stderr, 'display')).toEqual([]);
  });

  it('a revision-13 log keeps its display: the first lines, the key pieces and the not-confirmed sentence', () => {
    const dir = composite();
    editJson(dir, 'run-log.json', (l) => {
      l.skillRevision = 13;
    });
    const out = display(dir, 'brainstorm').stdout;
    expect(out).toMatch(/^Not confirmed in game:/m);
    expect(out).not.toMatch(/^\*\*1\./m);
  });
});

describe('AC-W108 (D-478, D-479): the verification display of a revision-14 visit', () => {
  it('a bold label on every field, the three tail bullets, and the skeleton file first', () => {
    const dir = copy('run-a14');
    // r1-a-1's structure check names a stronger structure, the third tail bullet.
    fs.appendFileSync(path.join(dir, 'cards', 'r1-a-1.md'), '\n### Structure check\n\n- A stronger structure? Rolling Slam as the main skill, for about 1.3x the clear.\n');
    const out = body(display(dir, 'verification').stdout);
    const at = out.indexOf('**1. Blood Hunt bleed burst**: works');
    expect(at).toBeGreaterThanOrEqual(0);
    const card = out.slice(at + 1, out.indexOf('', at + 1));
    expect(card[0]).toBe("- **PoB file:** Blood Hunt bleed burst skeleton (draft).xml (key pieces only; its numbers aren't the build's)");
    for (const l of card) expect(l).toMatch(/^- \*\*[^*]+:\*\* \S/);
    expect(card.slice(-3).map((l) => /^- \*\*([^*]+):\*\*/.exec(l)![1])).toEqual(['Risks', "PoB can't verify", 'Stronger structure']);
    // r1-a-2's skeleton was removed at its design: no file line.
    const two = out.slice(out.indexOf(`**2. ${NAME}**: works`) + 1);
    expect(two[0]).toMatch(/^- \*\*Synergy:\*\*/);
  });

  it('a changed skeleton left in place prints its line on the next verification display', () => {
    const dir = copy('run-a14');
    editJson(dir, 'run-log.json', (l) => {
      delete l.stages[5].skeletonRemoved;
    });
    const out = display(dir, 'verification').stdout;
    expect(out).toContain(`- **PoB file:** ${NAME} skeleton (draft).xml (key pieces only; its numbers aren't the build's; you changed it in PoB, so it stays)`);
  });
});

describe('AC-W108 (D-478, D-491): the design display of a build held to 14, and --detail', () => {
  /** run-a14 with b's clear skill given no area (chains 6, projectiles 1) and its scaling finds. */
  function designed(finds?: Json[]): string {
    const dir = copy('run-a14');
    editJson(dir, RECORD, (r) => {
      Object.assign(r.stages.b.measures.clearSpeed, { noArea: true, chains: 6, projectiles: 1 });
    });
    if (finds) {
      editJson(dir, TRADES, (t) => {
        t.trades = [...t.trades.filter((x: Json) => x.kind !== 'scaling'), ...finds];
      });
    }
    return dir;
  }
  const find = (to: string, damage: number, measured: boolean, price: Json | null = null): Json => ({ stage: 'b', kind: 'scaling', slot: 'Weapon 1', from: `rare War Spear, ${to}`, to: 'rare War Spear, physical damage', price, damage, ehp: -1, measured, repriced: price !== null, by: 'D1-build' });

  it('the PoB file first, How it works, the five-row table, Gear, Skills, Over budget, The catch and Options; m in two lines; no measurement line', () => {
    const dir = designed();
    // The design gate's visit, before F1: the draft the gate wrote (after F1, the final file stands in).
    expect(body(display(dir, 'design', ID).stdout)[0]).toBe(`PoB file: ${NAME}.xml in your Builds folder`);
    editJson(dir, 'run-log.json', (l) => {
      Object.assign(l.builds[0], { pobFile: null, draftFile: `${NAME} (draft).xml` });
    });
    const out = body(display(dir, 'design', ID).stdout);
    expect(out[0]).toBe(`PoB file: ${NAME} (draft).xml in your Builds folder`);
    expect(out[2]).toMatch(/^\*\*How it works\.\*\* Blood Hunt lunges/);
    // m in two lines: its name and level, then its damage and EHP.
    const m = out.indexOf(`**${NAME}: entering maps** (level 65)`);
    expect(out[m + 1]).toBe('9K damage per second on map packs; 18,400 effective HP; the draft holds the rest.');
    expect(out[m + 2]).toBe('');
    for (const [label, level] of [['budget endgame', 90], ['non-budget endgame', 95]] as const) {
      const at = out.indexOf(`**${NAME}: ${label}** (level ${level})`);
      expect(at).toBeGreaterThan(m);
      expect(out.slice(at + 2, at + 4)).toEqual(['| | |', '|---|---|']);
      expect(out.slice(at + 4, at + 9).map((l) => /^\| ([^|]+) \|/.exec(l)?.[1].trim())).toEqual(['Damage, map packs', 'Damage, pinnacle boss', 'Toughness', 'Arbiter of Divinity', 'Speed']);
    }
    expect(out).toContain('| Speed | no area: chains 6, projectiles 1; movement not measured |');
    expect(out).toContain('| Toughness | 31,500 effective HP; lowest max hit 3,000 (chaos) |');
    for (const h of ['**Gear**', '**Skills**', '**Over budget**']) expect(out.filter((l) => l === h).length).toBe(2);
    expect(out).toContain('- Weapon 1: rare War Spear, physical damage');
    expect(out).toContain('- Blood Hunt: Bloodlust, Brutality I');
    expect(out.filter((l) => l.startsWith('**The catch.** '))).toHaveLength(1);
    expect(out.filter((l) => l !== '').pop()).toBe('**Options**');
    // None of today's measurement lines.
    expect(out.join('\n')).not.toMatch(/^- (?:Boss rotation on|Life on|Swap cap on|Rebuild undone|Removed on|Skill levels on|Effective HP:|Passive tree:|Clear speed:)|Still estimates|PoB built it|For reference/m);
  });

  it("at most 3 Over budget lines a rung from trades.json's from, to and price, measured finds first by gain, an unmeasured one marked (estimate)", () => {
    const dir = designed([
      find('+3 melee levels', 9, true, { amount: 100, currency: 'divine', count: 14, date: '2026-10-24' }),
      find('attack speed', 21, true, { amount: 40, currency: 'exalted', count: 22, date: '2026-10-24' }),
      find('critical damage', 30, false),
      find('accuracy', 2, false),
    ]);
    const out = body(display(dir, 'design', ID).stdout);
    const at = out.indexOf('**Over budget**');
    const over = out.slice(at + 1, out.indexOf('', at));
    expect(over).toEqual([
      '- rare War Spear, attack speed was swapped for rare War Spear, physical damage; adding it back: +21% damage, −1% EHP, about 40 exalts more.',
      '- rare War Spear, +3 melee levels was swapped for rare War Spear, physical damage; adding it back: +9% damage, −1% EHP, about 100 divines more.',
      '- rare War Spear, critical damage was swapped for rare War Spear, physical damage; adding it back: +30% damage, −1% EHP (estimate), price not known.',
    ]);
  });

  it('--detail prints the revision-13 form; the final display\'s first line is the PoB file; revision-13 displays are unchanged', () => {
    const dir = designed();
    const detail = body(display(dir, 'design', ID, true).stdout);
    expect(detail[0]).toMatch(/^The endgame build for Blood Hunt with Rolling Slam clear, rung by rung, as its last design check measured it\./);
    expect(detail.join('\n')).toMatch(/^- Boss rotation on n: /m);
    expect(detail.join('\n')).toMatch(/^- Clear speed: no area: chains 6, projectiles 1\.$/m);
    expect(detail.join('\n')).not.toMatch(/\*\*How it works/);
    const fin = body(display(dir, 'final', ID).stdout);
    expect(fin[0]).toBe(`Your PoB file: ${NAME}.xml`);
    // run-a13: the design display today's, the final display's guide first, the verification display's plain lines.
    const old = copy('run-a13');
    expect(body(display(old, 'design', ID).stdout)[0]).toMatch(/^The endgame build for /);
    expect(body(display(old, 'final', ID).stdout)[0]).toMatch(/^The guide for /);
    expect(display(old, 'verification').stdout).toMatch(/^1\. Blood Hunt bleed burst: works\.$/m);
    expect(display(old, 'design', ID, true).code).toBe(0);
  });
});

// ---------------------------------------------------------------------------------------------------
// AC-W108, bullet 2: the layout lists, for every revision (§25)
// ---------------------------------------------------------------------------------------------------

describe('AC-W108 (§25): the layout lists admit the new files at revision 13 and 14 alike', () => {
  it('a build folder with final-build.xml, final-build-campaign.xml, readback.json, notes.txt and trade-links.json, and a concept folder with readback.json, pass', () => {
    for (const fixture of ['run-a13', 'run-a14']) {
      const dir = copy(fixture);
      for (const f of ['final-build.xml', 'final-build-campaign.xml']) fs.writeFileSync(path.join(dir, BUILD, f), '<PathOfBuilding2/>\n');
      writeJson(dir, `${BUILD}/readback.json`, readback(`${NAME}.xml`, 'final-build.xml'));
      fs.writeFileSync(path.join(dir, BUILD, 'notes.txt'), '^xE0C080At a glance\nBlood Hunt lunges.\n');
      writeJson(dir, `${BUILD}/trade-links.json`, []);
      writeJson(dir, `concepts/${ID}/readback.json`, readback(`${NAME} skeleton (draft).xml`, 'compiled-build.xml'));
      expect({ fixture, layout: lines(check(dir).stderr, 'layout') }).toEqual({ fixture, layout: [] });
      passes(dir);
    }
  });
});

// ---------------------------------------------------------------------------------------------------
// AC-W108, bullet 3: the design field's summary (D-478) and rares by their affixes (D-489)
// ---------------------------------------------------------------------------------------------------

describe('AC-W108 (D-478, D-489): the summary and the rares\' titles', () => {
  it('a revision-14 design field without summary, or over a cap, fails', () => {
    const none = copy('run-a14');
    editJson(none, GATE, (g) => {
      delete g.design.summary;
    });
    expect(lines(check(none).stderr, 'design-field')).toEqual([expect.stringMatching(/its design field has no summary \{how, gear: \[\{stage, slot, text\}\], catch\}/)]);
    for (const [k, len, cap] of [['how', 401, 400], ['catch', 301, 300]] as const) {
      const dir = copy('run-a14');
      editJson(dir, GATE, (g) => {
        g.design.summary[k] = 'x'.repeat(len);
      });
      expect(lines(check(dir).stderr, 'design-field')).toEqual([expect.stringMatching(new RegExp(`its summary\\.${k} is ${len} characters, over its cap of ${cap}`))]);
    }
    const gear = copy('run-a14');
    editJson(gear, GATE, (g) => {
      g.design.summary.gear[0].text = 'y'.repeat(121);
    });
    expect(lines(check(gear).stderr, 'design-field')).toEqual([expect.stringMatching(/summary\.gear\[0\] \(b Weapon 1\) is 121 characters, over its cap of 120/)]);
  });

  it("a rare whose title has a part matching none of its lines fails; one titled by its affixes passes", () => {
    const dir = copy('run-a14');
    replan(dir, (p) => {
      const s = stage(p, 'b').items.slots.find((x: Json) => x.slot === 'Body Armour');
      s.text = s.text.replace('life, fire resistance', 'life, Doom Shell');
    });
    expect(lines(check(dir).stderr, 'rare-title')).toEqual([expect.stringMatching(/stage b slot "Body Armour" is titled "life, Doom Shell", but "Doom Shell" names none of its lines \("\+80 to maximum Life", "\+30% to Fire Resistance"\)/)]);
    // A title in the spec's own words (+2 spell levels, Spirit, chaos resistance) passes.
    const ok = copy('run-a14');
    replan(ok, (p) => {
      const s = stage(p, 'n').items.slots.find((x: Json) => x.slot === 'Helmet');
      s.text = 'Rarity: Rare\n+2 spell levels, Spirit, chaos resistance\nIron Cap\n+2 to Level of all Spell Skills\n+45 to Spirit\n+23% to Chaos Resistance';
    });
    expect(lines(check(ok).stderr, 'rare-title')).toEqual([]);
  });
});

// ---------------------------------------------------------------------------------------------------
// AC-W108, bullet 4, and R-82: the answer change after F1, cancelled, the withdrawal (D-480)
// ---------------------------------------------------------------------------------------------------

/** A claims pass's report, `# V4-<n>: claims pass`, with its findings. */
function claimsReport(n: number, findings: string[] = []): string {
  return [
    `# V4-${n}: claims pass`, '', '- check: claims', `- concept: ${ID}`, '- mode: offline', `- verdict: ${findings.length > 0 ? 'fail' : 'pass'}`, '',
    '## Checked', '', '- claim stages[2].claims[2] (boss-fall-n)', '', '## Findings', '', ...(findings.length > 0 ? findings : ['None.']), '',
  ].join('\n');
}
const recheckOf = (report: string, n: number, verdict: string) => report.replace(/^# V4-\d+: claims pass/, `# V4-${n}: re-check of rounds/${n - 1}`).replace('- check: claims', '- check: recheck').replace(/- verdict: \w+/, `- verdict: ${verdict}`);
const FINDING = (status: string) => [
  '### v4-1-1', '', `- status: ${status}`, '- hinge: yes', '- owner: D1', '- artifact: plan.json', '- location: stages[2].claims[2]', '- claim: boss-fall-n',
  '- issue: the boss fall needs a gear change the claim can\'t give', '- evidence: plan.json stages[2].tree.end.boss',
  ...(status === 'unresolved' ? ['- reader: The boss figure falls on the finished tree; a better ring would hold it.'] : []),
].join('\n');
/**
 * run-a14 as a file-only build: the design gate's `accept:file` (or an `accept` the user changed after F1), F1's pass,
 * then `after`; no guide, audit or full pass; the build ended file-only and the run completed.
 */
function fileOnly(after: Json[], reports: Record<number, string> = {}, opts: { changed?: boolean } = {}): string {
  const dir = copy('run-a14');
  editJson(dir, 'run-log.json', (l) => {
    l.stages = [...l.stages.slice(0, 12), ...after];
    l.checkpoints = l.checkpoints.slice(0, 3);
    if (!opts.changed) l.checkpoints[2].answer = 'accept:file';
    l.displays = l.displays.slice(0, 3);
    Object.assign(l.builds[0], { status: 'file-only', guide: null });
  });
  for (const f of ['guide.md', 'audit.md', 'reports/V4-1.md']) fs.rmSync(path.join(dir, BUILD, f));
  for (const [n, text] of Object.entries(reports)) fs.writeFileSync(path.join(dir, BUILD, 'reports', `V4-${n}.md`), text);
  return dir;
}
const SNAPSHOT = (dir: string, n: number) => node(CHECKER, [dir, '--snapshot', String(n), '--build', ID]);
const NOTE = "Wait, I didn't say I wanted a guide";
const CHANGE = (at: number): Json => ({ checkpoint: 'design', concept: ID, visit: 1, from: 'accept', to: 'accept:file', note: NOTE, at });

describe('AC-W108 (D-480, D-487), R-82: accept → F1 → an answer change → W1 cancelled → V4-claims → W1 (notes)', () => {
  it('passes, and so does the change with no W1 running; the build ends file-only after its notes', () => {
    const dir = fileOnly([st('W1', 1, 'cancelled'), st('V4-claims', 1, 'pass'), st('W1', 2, 'done', { scope: 'notes' })], { 1: claimsReport(1) }, { changed: true });
    editJson(dir, 'run-log.json', (l) => {
      l.answerChanges = [CHANGE(12)];
      l.withdrawals = [{ build: ID, files: [`${BUILD}/audit.md`, `${BUILD}/guide.md`], at: 13 }];
    });
    passes(dir);
    const quiet = fileOnly([st('V4-claims', 1, 'pass'), st('W1', 1, 'done', { scope: 'notes' })], { 1: claimsReport(1) }, { changed: true });
    editJson(quiet, 'run-log.json', (l) => {
      l.answerChanges = [CHANGE(12)];
    });
    passes(quiet);
    // A file-only build held to 14 ends at its notes: without them it is still in progress.
    const noNotes = fileOnly([st('V4-claims', 1, 'pass')], { 1: claimsReport(1) });
    expect(lines(check(noNotes).stderr, 'run-log')).toContainEqual(expect.stringMatching(/builds\[\] r1-a-2's status is "file-only", but the run log's steps and answers leave it in progress/));
  });

  it("fails an answer change before F1's pass or after W1's entry, and cancelled on another stage or with no change", () => {
    const early = fileOnly([st('V4-claims', 1, 'pass'), st('W1', 1, 'done', { scope: 'notes' })], { 1: claimsReport(1) }, { changed: true });
    editJson(early, 'run-log.json', (l) => {
      l.answerChanges = [CHANGE(11)];
    });
    expect(lines(check(early).stderr, 'order')).toContainEqual(expect.stringMatching(/answerChanges\[0\] \(r1-a-2, at stages\[11\]\) comes before r1-a-2's F1 passed after the design gate's accept; the answer changes after F1's pass and before W1's entry/));
    const late = fileOnly([st('W1', 1, 'done'), st('V4-claims', 1, 'pass'), st('W1', 2, 'done', { scope: 'notes' })], { 1: claimsReport(1) }, { changed: true });
    editJson(late, 'run-log.json', (l) => {
      l.answerChanges = [CHANGE(13)];
    });
    expect(lines(check(late).stderr, 'order')).toContainEqual(expect.stringMatching(/answerChanges\[0\] \(r1-a-2, at stages\[13\]\) comes after r1-a-2's W1 entry; the answer changes before W1's entry is recorded/));
    const other = copy('run-a14');
    editJson(other, 'run-log.json', (l) => {
      l.stages[9].outcome = 'cancelled';
    });
    expect(lines(check(other).stderr, 'run-log')).toContainEqual(expect.stringMatching(/stages\[9\]: a D1-finish entry's outcome is one of done, claims-edited, build, missing, refused, not "cancelled"/));
    const noChange = fileOnly([st('W1', 1, 'cancelled'), st('V4-claims', 1, 'pass'), st('W1', 2, 'done', { scope: 'notes' })], { 1: claimsReport(1) });
    expect(lines(check(noChange).stderr, 'order')).toContainEqual(expect.stringMatching(/stages\[12\] \(W1 r1-a-2 attempt 1\): is cancelled, but no answer change for r1-a-2 comes before it/));
  });

  it('the writer takes the answer change only after F1 and before W1, and W1 cancelled only after it; --withdraw removes audit.md and a partial guide.md and logs withdrawn', () => {
    const dir = copy('run-a14');
    editJson(dir, 'run-log.json', (l) => {
      l.stages = l.stages.slice(0, 12);
      l.checkpoints = l.checkpoints.slice(0, 3);
      l.displays = l.displays.slice(0, 3);
      l.builds[0].status = 'writing';
      l.builds[0].guide = null;
      l.status = 'running';
    });
    expect(write(dir, 'stage', st('W1', 1, 'cancelled'))).toMatchObject({ code: 1, stderr: expect.stringMatching(/r1-a-2 has no answer change; W1 is cancelled only when the user changed the design gate's accept/) });
    expect(node(RENDER, [dir, '--withdraw', ID])).toMatchObject({ code: 1, stderr: expect.stringMatching(/withdraw refused: r1-a-2 has no answer change/) });
    expect(write(dir, 'answer-change', { checkpoint: 'design', visit: 1, from: 'accept', to: 'accept:file', note: NOTE })).toEqual({ code: 0, stdout: 'run-log: wrote answerChanges[0] (r1-a-2: accept to accept:file, at stages[12])\n', stderr: '' });
    expect(write(dir, 'answer-change', { checkpoint: 'design', visit: 1, from: 'accept', to: 'accept:file', note: NOTE })).toMatchObject({ code: 1, stderr: expect.stringMatching(/design visit 1's answer was already changed/) });
    // The W1 running when the answer changed is logged cancelled; it left a partial guide.
    expect(write(dir, 'stage', st('W1', 1, 'cancelled')).code).toBe(0);
    fs.writeFileSync(path.join(dir, GUIDE), '# Titan / Blood Hunt\n\n## At a glance\n\nBlood Hunt lun');
    expect(node(RENDER, [dir, '--withdraw', ID])).toEqual({ code: 0, stdout: `render-audit: withdrew ${BUILD}/audit.md and ${BUILD}/guide.md for ${ID}, and logged withdrawn\n`, stderr: '' });
    expect([fs.existsSync(path.join(dir, BUILD, 'audit.md')), fs.existsSync(path.join(dir, GUIDE))]).toEqual([false, false]);
    expect(readJson(dir, 'run-log.json').withdrawals).toEqual([{ build: ID, files: [`${BUILD}/audit.md`, `${BUILD}/guide.md`], at: 13 }]);
    // After W1's entry, the answer no longer changes.
    const after = copy('run-a14');
    expect(write(after, 'answer-change', { checkpoint: 'design', visit: 1, from: 'accept', to: 'accept:file', note: NOTE })).toMatchObject({ code: 1, stderr: expect.stringMatching(/r1-a-2's W1 entry is recorded after its F1 pass/) });
  });
});

// ---------------------------------------------------------------------------------------------------
// AC-W108, bullet 5: the one-item swap (D-481)
// ---------------------------------------------------------------------------------------------------

const SWAP = { stages: ['b'], slot: 'Weapon 1', from: 'rare War Spear, physical damage, attack speed', to: 'rare War Spear, physical damage', bossBefore: { b: 60000 }, bossAfter: { b: 60000 }, reason: 'the user asked for the 5-divine spear' };
const WORDS = 'use the 5 divine spear';
/** A gate's verdict file copied to the next attempt. */
function nextAttempt(dir: string, gate: string, attempt: number): void {
  fs.copyFileSync(path.join(dir, `reports/gates/${gate}-${ID}-a${attempt - 1}.json`), path.join(dir, `reports/gates/${gate}-${ID}-a${attempt}.json`));
  editJson(dir, `reports/gates/${gate}-${ID}-a${attempt}.json`, (v) => {
    v.attempt = attempt;
  });
}

describe('AC-W108 (D-481): the one-item swap', () => {
  it('design-gate revise → D1-finish (scope swap) → D1-gate passes only with an itemSwaps[] entry', () => {
    const swapRun = (swaps: Json[]) => {
      const dir = copy('run-a14');
      editJson(dir, 'run-log.json', (l) => {
        const [front, tail] = [l.stages.slice(0, 11), l.stages.slice(11)];
        l.stages = [...front, st('D1-finish', 2, 'done', { scope: 'swap', requests: [{ id: 'u1', words: WORDS, result: 'made' }] }), st('D1-gate', 2, 'pass'), ...tail];
        const [design, fin] = [l.checkpoints[2], l.checkpoints[3]];
        l.checkpoints = [l.checkpoints[0], l.checkpoints[1], { ...design, answer: `revise:${WORDS}` }, { ...design, visit: 2 }, fin];
        delete l.checkpoints[2].scaling;
        l.displays = [l.displays[0], l.displays[1], { checkpoint: 'design', visit: 1 }, { checkpoint: 'design', visit: 2 }, { checkpoint: 'final', visit: 1 }];
      });
      nextAttempt(dir, 'D1-gate', 2);
      replan(dir, (p) => {
        p.itemSwaps = swaps;
      });
      return dir;
    };
    passes(swapRun([SWAP]));
    expect(lines(check(swapRun([])).stderr, 'swap')).toEqual([expect.stringMatching(/run-log\.json logs 1 one-item swap\(s\) \(D1-finish, scope swap\) since the last D1-build, but plan\.json's itemSwaps\[\] records 0/)]);
    // A boss figure that fell after the swap needs its reason.
    const fell = swapRun([{ ...SWAP, bossAfter: { b: 55000 }, reason: '' }]);
    expect(lines(check(fell).stderr, 'boss-fall')).toEqual([expect.stringMatching(/itemSwaps\[0\] \(rare War Spear, physical damage, attack speed to rare War Spear, physical damage\) takes the boss figure down on b with no reason/)]);
  });

  it('final-gate revise → D1-finish (swap) → D1-gate → F1 → W1 → V4-recheck passes', () => {
    const dir = copy('run-a14');
    expect(SNAPSHOT(dir, 1).code).toBe(0);
    editJson(dir, 'run-log.json', (l) => {
      l.stages.push(st('D1-finish', 2, 'done', { scope: 'swap' }), st('D1-gate', 2, 'pass'), st('F1', 2, 'pass'), st('W1', 2, 'done'), st('V4-recheck', 1, 'pass'));
      const fin = l.checkpoints[3];
      l.checkpoints = [...l.checkpoints.slice(0, 3), { ...fin, answer: `revise:${WORDS}` }, { ...fin, visit: 2 }];
      l.displays.push({ checkpoint: 'final', visit: 2 });
    });
    nextAttempt(dir, 'D1-gate', 2);
    nextAttempt(dir, 'F1', 2);
    replan(dir, (p) => {
      p.itemSwaps = [SWAP];
    });
    const v1 = fs.readFileSync(path.join(dir, BUILD, 'reports', 'V4-1.md'), 'utf8');
    fs.writeFileSync(path.join(dir, BUILD, 'reports', 'V4-2.md'), v1.replace('# V4-1: full pass', '# V4-2: re-check of rounds/1').replace('- check: full', '- check: recheck'));
    passes(dir);
    // A swap that follows no revise: fails.
    const stray = copy('run-a14');
    editJson(stray, 'run-log.json', (l) => {
      l.stages[9].scope = 'swap';
    });
    expect(lines(check(stray).stderr, 'order')).toContainEqual(expect.stringMatching(/stages\[9\] \(D1-finish r1-a-2 attempt 1\): is a one-item swap \(D1-finish, scope swap\), but it doesn't follow the design or final gate's revise:/));
  });

  it("on a rung whose tree.end reads endAfter \"swap\", a fall with no boss trade and an n under the floor pass with the itemSwaps[] reason and fail without it", () => {
    /** run-a14 with n's boss and damage trades gone, its EHP within its band (so only the floor asks for a trade). */
    const bare = (reason: string | null) => {
      const dir = copy('run-a14');
      setTrades(dir, (ts) => ts.filter((t) => t.stage !== 'n'));
      editJson(dir, RECORD, (r) => {
        r.stages.n.outputs.TotalEHP = 25000;
      });
      editJson(dir, GATE, (g) => {
        rung(g, 'n').toughness.band = 'within';
      });
      replan(dir, (p) => {
        if (reason === null) return;
        stage(p, 'n').tree.end.endAfter = 'swap';
        p.itemSwaps = [{ ...SWAP, stages: ['n'], slot: 'Ring 1', bossBefore: { n: 220000 }, bossAfter: { n: 210000 }, reason }];
      });
      return dir;
    };
    const without = check(bare(null)).stderr;
    expect(lines(without, 'trades')).toEqual(expect.arrayContaining([
      expect.stringMatching(/on n the boss figure fell from 220,000 to 210,000 on the tree, but no boss trade is shown for it/),
      expect.stringMatching(/the non-budget rung n is under the boss floor at the gate, but no damage or boss trade is shown for it/),
    ]));
    expect(lines(check(bare('the new ring trades 5% of the boss figure for its life')).stderr, 'trades')).toEqual([]);
    const noReason = check(bare('')).stderr;
    expect(lines(noReason, 'trades').length).toBe(2);
  });
});

// ---------------------------------------------------------------------------------------------------
// AC-W108, bullet 6: late endgame scaling (D-486)
// ---------------------------------------------------------------------------------------------------

describe('AC-W108 (D-486): the scaling answer, its pass and its H2', () => {
  /** run-a14 with the design accept's scaling answer and `scaling` D1-finish steps placed at `at` (stages[] indices). */
  function scaled(answer: boolean, at: number[] = [11]): string {
    const dir = copy('run-a14');
    editJson(dir, 'run-log.json', (l) => {
      l.checkpoints[2].scaling = answer;
      for (const [k, i] of at.entries()) l.stages.splice(i, 0, st('D1-finish', 2 + k, 'done', { scope: 'scaling' }));
    });
    return dir;
  }
  it('accept with scaling: true → D1-finish (scope scaling) → F1 passes; a scaling D1-finish without scaling: true, or after F1, fails', () => {
    passes(scaled(true));
    expect(lines(check(scaled(false)).stderr, 'order')).toContainEqual(expect.stringMatching(/stages\[11\] \(D1-finish r1-a-2 attempt 2\): follows the design gate answered "accept", which goes on to r1-a-2's final compile, F1, not D1-finish \(scope scaling\)/));
    expect(lines(check(scaled(true, [])).stderr, 'order')).toContainEqual(expect.stringMatching(/follows the design gate answered "accept" with scaling: true, which goes on to r1-a-2's scaling pass, D1-finish with scope scaling, then F1/));
    const afterF1 = scaled(true, [11, 13]);
    expect(lines(check(afterF1).stderr, 'order')).toContainEqual(expect.stringMatching(/stages\[13\] \(D1-finish r1-a-2 attempt 3\): is a scaling pass \(D1-finish, scope scaling\), but the design gate's accept didn't answer scaling: true, or F1 already ran/));
  });

  it("the guide's Late endgame scaling H2 passes, in an endgame guide and a full guide, only with the checkpoint's scaling: true", () => {
    const H2 = '## Late endgame scaling\n\n- The +3 melee levels spear adds about 21% damage, about 100 divines.\n\n';
    const add = (dir: string, guide: string) => editText(dir, guide, '## How to play it', `${H2}## How to play it`);
    const yes = scaled(true);
    add(yes, GUIDE);
    expect(lines(check(yes).stderr, 'guide-sections')).toEqual([]);
    const no = copy('run-a14');
    add(no, GUIDE);
    expect(lines(check(no).stderr, 'guide-sections')).toEqual([expect.stringMatching(/guide\.md's H2s are unexpected \["Late endgame scaling"\]; the endgame guide's \(D-414\) H2s are .*; "Late endgame scaling" is allowed only when the design gate's accept answered scaling: true/)]);
    // A full guide (run-builds' r1-a-1, held to 14 from its init): the same.
    const full = (answer: boolean) => {
      const dir = copy('run-builds');
      editJson(dir, 'run-log.json', (l) => {
        l.skillRevision = 14;
        l.pricing = { stops: [], retries: [] };
        for (const c of l.checkpoints) if (c.checkpoint === 'design' && c.concept === 'r1-a-1' && ['accept', 'accept:file'].includes(c.answer)) c.scaling = answer;
      });
      add(dir, 'builds/r1-a-1/guide.md');
      return lines(check(dir).stderr, 'guide-sections').filter((x) => x.includes('builds/r1-a-1'));
    };
    expect(full(true)).toEqual([]);
    expect(full(false)).toEqual([expect.stringMatching(/"Late endgame scaling" is allowed only when the design gate's accept answered scaling: true/)]);
  });

  it('a scaling trade with its fields passes; one short of a field fails; a revision-14 -fallback entry fails and an older build\'s passes', () => {
    passes(copy('run-a14'));
    const bad = copy('run-a14');
    setTrades(bad, (ts) => ts.map((t) => (t.kind === 'scaling' ? { ...t, by: 'W1', price: { amount: 3 } } : t)));
    expect(lines(check(bad).stderr, 'trades')).toEqual([
      expect.stringMatching(/trades\.json's trades\[2\]'s price is \{"amount":3\}; \{amount, currency, count, date\}, or null when unpriced/),
      expect.stringMatching(/trades\.json's trades\[2\]'s by is "W1"; D1-build or D1-finish/),
    ]);
    const short = copy('run-a14');
    setTrades(short, (ts) => ts.map((t) => (t.kind === 'scaling' ? { ...t, measured: undefined } : t)));
    expect(lines(check(short).stderr, 'trades')).toEqual([expect.stringMatching(/a scaling find is \{stage, kind, slot, from, to, price, damage, ehp, measured, repriced, by\}/)]);
    const fallback = (fixture: string) => {
      const dir = copy(fixture);
      replan(dir, (p) => {
        const { spec, ...entry } = p.prices.find((x: Json) => x.id === 'b-body');
        void spec;
        p.prices.push({ ...entry, id: 'b-body-fallback' });
      });
      return lines(check(dir).stderr, 'budget');
    };
    expect(fallback('run-a14')).toEqual([expect.stringMatching(/plan\.json's price entry "b-body-fallback" is a fallback; in a build held to amendment 14 the dearer item is a find over the budget/)]);
    expect(fallback('run-a13')).toEqual([]);
  });
});

// ---------------------------------------------------------------------------------------------------
// AC-W108, bullet 7: one more round behind an open finding's ask (D-482)
// ---------------------------------------------------------------------------------------------------

describe('AC-W108 (D-482): one more fix round and re-check behind an ask answered round', () => {
  const ASK = (at: number, visit = 1): Json => ({ checkpoint: 'ask', kind: 'open-finding', build: ID, visit, answer: 'round', answeredBy: 'user', at });
  /** A file-only claims round: V4-claims fails, D1 edits claims, the re-check leaves the finding open, then `extra`. */
  function claimsRounds(extra: Json[], asks: Json[], rechecks = 2): string {
    const dir = fileOnly([st('V4-claims', 1, 'fail'), st('D1-finish', 2, 'claims-edited'), st('V4-recheck', 1, 'fail'), ...extra], { 1: claimsReport(1, [FINDING('unresolved')]) });
    expect(SNAPSHOT(dir, 1).code).toBe(0);
    fs.writeFileSync(path.join(dir, BUILD, 'reports', 'V4-2.md'), recheckOf(claimsReport(2, [FINDING('unresolved')]), 2, 'fail'));
    if (rechecks >= 2) {
      expect(SNAPSHOT(dir, 2).code).toBe(0);
      fs.writeFileSync(path.join(dir, BUILD, 'reports', 'V4-3.md'), recheckOf(claimsReport(3, [FINDING('fixed')]), 3, 'pass'));
    }
    editJson(dir, 'run-log.json', (l) => {
      l.checkpoints.push(...asks);
    });
    return dir;
  }
  it('after the re-check, an ask answered round allows one more fix round and V4-recheck; without it, or a third, fails', () => {
    const more = [st('D1-finish', 3, 'claims-edited'), st('V4-recheck', 2, 'pass'), st('W1', 1, 'done', { scope: 'notes' })];
    passes(claimsRounds(more, [ASK(15)]));
    const without = check(claimsRounds(more, [])).stderr;
    expect(lines(without, 'order')).toContainEqual(expect.stringMatching(/stages\[15\] \(D1-finish r1-a-2 attempt 3\): follows the V4 checks of another build/));
    expect(lines(without, 'verification')).toContainEqual(expect.stringMatching(/stages\[16\] \(V4-recheck r1-a-2 attempt 2\): re-checks a file-only build's claims pass a second time/));
    // A third round: two asks answered round.
    const third = check(claimsRounds(more, [ASK(15), ASK(15, 2)])).stderr;
    expect(lines(third, 'verification')).toContainEqual(expect.stringMatching(/r1-a-2's open findings were answered "round" 2 times; one more round is allowed at most once a build/));
    // An ask after anything but a re-check fails.
    const misplaced = check(claimsRounds(more, [ASK(14)])).stderr;
    expect(lines(misplaced, 'order')).toContainEqual(expect.stringMatching(/asks about an open finding, but the step before it \(D1-finish r1-a-2 attempt 2\) isn't r1-a-2's re-check/));
  });

  it("a guide build's fix round: V4 → W1 → V4-recheck → ask round → W1 → V4-recheck → the final gate passes", () => {
    const dir = copy('run-a14');
    const full = fs.readFileSync(path.join(dir, BUILD, 'reports', 'V4-1.md'), 'utf8');
    const guideFinding = (status: string) => [
      '### v4-1-1', '', `- status: ${status}`, '- hinge: yes', '- owner: W1', '- artifact: guide.md', '- location: How to play it, line 80', '- claim: Lunge at rares.',
      '- issue: the lunge needs a ring the guide doesn\'t name', '- evidence: plan.json stages[1].items',
      ...(status === 'unresolved' ? ['- reader: The guide doesn\'t name the ring the lunge needs.'] : []),
    ].join('\n');
    const withFinding = (text: string, status: string, verdict: string) => text.replace(/## Findings[\s\S]*$/, `## Findings\n\n${guideFinding(status)}\n`).replace('- verdict: pass', `- verdict: ${verdict}`);
    fs.writeFileSync(path.join(dir, BUILD, 'reports', 'V4-1.md'), withFinding(full, 'unresolved', 'fail'));
    expect(SNAPSHOT(dir, 1).code).toBe(0);
    const recheck = (n: number) => withFinding(full, n === 3 ? 'fixed' : 'unresolved', n === 3 ? 'pass' : 'fail').replace('# V4-1: full pass', `# V4-${n}: re-check of rounds/${n - 1}`).replace('- check: full', '- check: recheck');
    fs.writeFileSync(path.join(dir, BUILD, 'reports', 'V4-2.md'), recheck(2));
    expect(SNAPSHOT(dir, 2).code).toBe(0);
    fs.writeFileSync(path.join(dir, BUILD, 'reports', 'V4-3.md'), recheck(3));
    editJson(dir, 'run-log.json', (l) => {
      l.stages[13].outcome = 'fail';
      l.stages.push(st('W1', 2, 'done'), st('V4-recheck', 1, 'fail'), st('W1', 3, 'done'), st('V4-recheck', 2, 'pass'));
      l.checkpoints.splice(3, 0, ASK(16));
    });
    passes(dir);
    // Without the ask, the re-check goes to the final gate, whose accept ends the run before the third W1.
    editJson(dir, 'run-log.json', (l) => {
      l.checkpoints = l.checkpoints.filter((c: Json) => c.checkpoint !== 'ask');
    });
    expect(lines(check(dir).stderr, 'order')).toContainEqual(expect.stringMatching(/stages\[16\] \(W1 r1-a-2 attempt 3\): follows the final gate answered "accept", which ends the run/));
  });
});

// ---------------------------------------------------------------------------------------------------
// AC-W108, bullet 8: the user's words and the departures (D-482)
// ---------------------------------------------------------------------------------------------------

describe('AC-W108 (D-482): request words and the ask of a departure', () => {
  /** run-a14 whose verification pick carries a change for r1-a-2, and D1-build's requests. */
  function requested(requests: Json[], asks: Json[] = []): string {
    const dir = copy('run-a14');
    editJson(dir, 'run-log.json', (l) => {
      l.checkpoints[1].changes = { [ID]: 'use a cheaper helmet; keep Herald of Blood' };
      l.stages[7].requests = requests;
      l.checkpoints.push(...asks);
    });
    return dir;
  }
  it("a stage entry whose request words aren't in the checkpoint's answer, its note or readback.json fails", () => {
    expect(lines(check(requested([{ id: 'u1', words: 'use a cheaper helmet', result: 'made' }])).stderr, 'requests')).toEqual([]);
    expect(lines(check(requested([{ id: 'u1', words: 'make it tankier', result: 'made' }])).stderr, 'requests')).toEqual([expect.stringMatching(/stages\[7\] \(D1-build r1-a-2 attempt 1\) logs request "u1" with the words "make it tankier", which aren't in a checkpoint's answer, its note or the read-back's readback\.json/)]);
    // A read-back's changes, verbatim.
    const rb = requested([{ id: 'r1', words: 'Helmet: removed +60 to maximum Life', result: 'made' }]);
    writeJson(rb, `${BUILD}/readback.json`, readback(`${NAME} (draft).xml`, 'compiled-build.xml', [{ slot: 'Helmet', removed: ['+60 to maximum Life'], added: ['+45 to maximum Life'] }]));
    expect(lines(check(rb).stderr, 'requests')).toEqual([expect.stringMatching(/"Helmet: removed \+60 to maximum Life"/)]);
    // Two of its texts joined by a newline, as the runner may quote them.
    const rb3 = requested([{ id: 'r1', words: '+60 to maximum Life\n+45 to maximum Life', result: 'made' }]);
    writeJson(rb3, `${BUILD}/readback.json`, readback(`${NAME} (draft).xml`, 'compiled-build.xml', [{ slot: 'Helmet', removed: ['+60 to maximum Life'], added: ['+45 to maximum Life'] }]));
    expect(lines(check(rb3).stderr, 'requests')).toEqual([]);
    const rb2 = requested([{ id: 'r1', words: '+60 to maximum Life; +45 to maximum Life', result: 'made' }]);
    writeJson(rb2, `${BUILD}/readback.json`, readback(`${NAME} (draft).xml`, 'compiled-build.xml', [{ slot: 'Helmet', removed: ['+60 to maximum Life'], added: ['+45 to maximum Life'] }]));
    expect(lines(check(rb2).stderr, 'requests')).toEqual([]);
  });

  it('an ask {kind: "departs"} after a return with a departs line passes; one with none before it fails; a departure with no ask fails', () => {
    const departs = [{ id: 'u1', words: 'use a cheaper helmet', result: 'departs: kept the dearer helmet, the rung is under its band without it' }];
    const ask = (at: number): Json => ({ checkpoint: 'ask', kind: 'departs', build: ID, visit: 1, answer: 'keep the dearer helmet then', answeredBy: 'user', at });
    expect(lines(check(requested(departs, [ask(8)])).stderr, 'order')).toEqual([]);
    expect(lines(check(requested(departs)).stderr, 'order')).toEqual([expect.stringMatching(/stages\[7\] \(D1-build r1-a-2 attempt 1\): returned a departure from the user's request \(u1\), but no ask checkpoint \(kind departs\) comes before the next step/)]);
    const stray = requested([{ id: 'u1', words: 'use a cheaper helmet', result: 'made' }], [ask(8)]);
    expect(lines(check(stray).stderr, 'order')).toEqual([expect.stringMatching(/asks about a departure, but the step before it \(D1-build r1-a-2 attempt 1\) returned no "request: <id> departs: <how>" line for r1-a-2/)]);
    // The writer: an ask names a build of the run and its visit, and adds where it was asked.
    const dir = copy('run-a14');
    expect(write(dir, 'checkpoint', { checkpoint: 'ask', kind: 'open-finding', build: ID, visit: 1, answer: 'later', answeredBy: 'user' })).toMatchObject({ code: 1, stderr: expect.stringMatching(/an open finding's answer is round .* or ship/) });
    expect(write(dir, 'checkpoint', { checkpoint: 'ask', kind: 'departs', build: 'r1-a-1', visit: 1, answer: 'fine', answeredBy: 'user' })).toMatchObject({ code: 1, stderr: expect.stringMatching(/build r1-a-1 has no build in the run/) });
    expect(write(dir, 'checkpoint', { checkpoint: 'ask', kind: 'departs', build: ID, visit: 1, answer: 'fine', answeredBy: 'user' }).code).toBe(0);
    expect(readJson(dir, 'run-log.json').checkpoints.pop()).toEqual({ checkpoint: 'ask', kind: 'departs', build: ID, visit: 1, answer: 'fine', answeredBy: 'user', at: 14 });
  });
});

// ---------------------------------------------------------------------------------------------------
// AC-W108, bullets 9 and 16: the skeleton, the exclude list and the open findings in audit.md
// ---------------------------------------------------------------------------------------------------

describe('AC-W108 (D-479, D-482, D-490): skeletons, the exclude list and the known issues', () => {
  it("audit.md lists D1-tree's tree.exclude entries with their reasons", () => {
    const audit = fs.readFileSync(path.join(FIXTURES, 'run-a14', BUILD, 'audit.md'), 'utf8');
    expect(audit).toContain("- Left out of the tree search on stage n: 2001, Mind Over Matter: the build keeps its mana for Blood Hunt's lunges.\n");
    const dir = copy('run-a14');
    replan(dir, (p) => {
      stage(p, 'b').tree.exclude = [{ nodes: [3001, 3002], reason: 'Event Horizon: PoB drops its life cost (PG-104)' }];
    });
    expect(node(RENDER, [dir, '--build', ID]).code).toBe(0);
    expect(fs.readFileSync(path.join(dir, BUILD, 'audit.md'), 'utf8')).toContain('- Left out of the tree search on stage b: 3001, 3002, Event Horizon: PoB drops its life cost (PG-104).\n');
  });

  it("audit.md's known issues list a fixture's open findings, read from the last V4 report; a revision-13 build's render keeps its lines", () => {
    const open = (fixture: string) => {
      const dir = copy(fixture);
      const v1 = fs.readFileSync(path.join(dir, BUILD, 'reports', 'V4-1.md'), 'utf8');
      fs.writeFileSync(path.join(dir, BUILD, 'reports', 'V4-1.md'), v1.replace(/## Findings[\s\S]*$/, `## Findings\n\n${FINDING('unresolved')}\n`).replace('- verdict: pass', '- verdict: fail'));
      expect(node(RENDER, [dir, '--build', ID]).code).toBe(0);
      return fs.readFileSync(path.join(dir, BUILD, 'audit.md'), 'utf8').split('## Known issues\n')[1].trim();
    };
    expect(open('run-a14')).toBe(['| Id | Lens or gate | Stage | Sentence in the guide |', '|---|---|---|---|', '| v4-1-1 | V4 | — | The boss figure falls on the finished tree; a better ring would hold it. |'].join('\n'));
    expect(open('run-a13')).toBe('None.');
  });
});

// ---------------------------------------------------------------------------------------------------
// AC-W108, bullet 10: no advice to test in game (D-489)
// ---------------------------------------------------------------------------------------------------

describe('AC-W108 (D-489): "test it in game", "in-game test" and "needs in-game testing" fail', () => {
  it('in guide.md, notes.txt or a plan claim', () => {
    const guide = copy('run-a14');
    editText(guide, GUIDE, '## FAQ\n', '## FAQ\n\nTest it in game before you buy the ring.\n');
    expect(lines(check(guide).stderr, 'test-advice')).toEqual([expect.stringMatching(/guide\.md:\d+ says "Test it in game": advice to test in game/)]);
    const notes = copy('run-a14');
    fs.appendFileSync(path.join(notes, BUILD, 'notes.txt'), 'Do an in-game test of the lunge first.\n');
    expect(lines(check(notes).stderr, 'test-advice')).toEqual([expect.stringMatching(/notes\.txt:\d+ says "in-game test"/)]);
    const claim = copy('run-a14');
    replan(claim, (p) => {
      stage(p, 'n').claims[1].text = 'Herald of Blood reserves spirit; the explosion range needs in-game testing.';
    });
    expect(lines(check(claim).stderr, 'test-advice')).toEqual([expect.stringMatching(/plan\.json's stage n claim "n-herald" \(claims\[1\]\) says "in-game test"/)]);
  });
});

// ---------------------------------------------------------------------------------------------------
// AC-W108, bullets 11 and 12: a price's listing and spec (D-483, D-484), a bare Corrupted unique
// ---------------------------------------------------------------------------------------------------

describe('AC-W108 (D-483, D-484): the listing, the spec and corrupted uniques', () => {
  const LISTING = { corrupted: false, sockets: 0, count: 14, position: 5 };
  it("a listing whose corruption is unlike the item's, or with fewer sockets, fails; a cheap unique priced uncorrupted passes", () => {
    const priced = (id: string, listing: Json, note?: string) => {
      const dir = copy('run-a14');
      replan(dir, (p) => {
        Object.assign(p.prices.find((x: Json) => x.id === id), { listing }, note ? { note } : {});
      });
      return lines(check(dir).stderr, 'listing');
    };
    expect(priced('b-body', LISTING)).toEqual([]);
    expect(priced('b-body', { ...LISTING, corrupted: true })).toEqual([expect.stringMatching(/price entry "b-body" was priced from a corrupted listing, but the compiled copy in b Body Armour has no Corrupted line/)]);
    const socketed = copy('run-a14');
    replan(socketed, (p) => {
      const s = stage(p, 'b').items.slots.find((x: Json) => x.slot === 'Body Armour');
      s.text = s.text.replace('Rusted Cuirass\n', 'Rusted Cuirass\nSockets: S S\n');
      Object.assign(p.prices.find((x: Json) => x.id === 'b-body'), { listing: { ...LISTING, sockets: 1 } });
    });
    expect(lines(check(socketed).stderr, 'listing')).toEqual([expect.stringMatching(/price entry "b-body"'s listing has 1 rune socket\(s\), fewer than the 2 of the compiled copy in b Body Armour/)]);
    // Blistering Bond on n, corrupted to its line, priced uncorrupted as the corruption rule lets a cheap unique.
    expect(priced('n-ring2', LISTING, 'offline run; priced uncorrupted (a cheap unique)')).toEqual([]);
    expect(priced('n-ring2', LISTING)).toEqual([expect.stringMatching(/price entry "n-ring2" was priced from an uncorrupted listing, but the compiled copy in n Ring 2 has Corrupted line/)]);
  });

  it("a spec's must-have outside PoB's top 4 without why fails, a top-4 affix left out without why fails, and ranking: null is held to neither", () => {
    const RANKING = ['+# to maximum Life', '+#% to Fire Resistance', '+#% to Cold Resistance', '+# to Armour'].map((affix, k) => ({ affix, gain: 4 - k, weight: 0.5 }));
    const spec = (s: Json) => {
      const dir = copy('run-a14');
      replan(dir, (p) => {
        Object.assign(p.prices.find((x: Json) => x.id === 'b-body').spec, s);
      });
      return lines(check(dir).stderr, 'spec');
    };
    const must = (affix: string, why?: string): Json => ({ affix, tradeId: 'explicit.stat_1', tier: 2, min: 30, ...(why ? { why } : {}) });
    const ok = { ranking: RANKING, mustHaves: [must('+# to maximum Life'), must('+#% to Fire Resistance'), must('+#% to Lightning Resistance', 'the rung needs lightning resistance from this slot')], leftOut: [{ affix: '+#% to Cold Resistance', why: 'the helmet carries it' }, { affix: '+# to Armour', why: 'the build stacks evasion' }] };
    expect(spec(ok)).toEqual([]);
    expect(spec({ ...ok, mustHaves: [ok.mustHaves[0], ok.mustHaves[1], must('+#% to Lightning Resistance')] })).toEqual([expect.stringMatching(/must-have "\+#% to Lightning Resistance" is outside PoB's top 4 .* with no why/)]);
    expect(spec({ ...ok, leftOut: [ok.leftOut[0]] })).toEqual([expect.stringMatching(/leaves out "\+# to Armour", one of PoB's top 4, with no leftOut entry giving its why/)]);
    expect(spec({ ranking: null, mustHaves: [must('+#% to Lightning Resistance')], leftOut: [] })).toEqual([]);
    expect(spec({ searches: 6 })).toEqual([expect.stringMatching(/spec counts 6 trade searches; at most 5 a slot/)]);
  });

  it('a bare Corrupted unique over 1 divine without the extra socket fails; with it, passes; a cheap one passes', () => {
    /** Alpha's Howl (Data/Uniques/helmet.lua) on n's helmet, corrupted, with `sockets` and its price. */
    const howl = (sockets: string, amount: number) => {
      const dir = copy('run-a14');
      replan(dir, (p) => {
        stage(p, 'n').items.slots.find((x: Json) => x.slot === 'Helmet').text = ['Rarity: Unique', "Alpha's Howl", 'Armoured Cap', `Sockets: ${sockets}`, '(80-100)% increased Evasion Rating', '+100 to Spirit', 'Corrupted'].join('\n');
        Object.assign(p.prices.find((x: Json) => x.id === 'n-helmet'), { status: 'ok', amount, currency: 'divine', note: undefined });
      });
      return lines(check(dir).stderr, 'corruption');
    };
    expect(howl('S', 5)).toEqual([expect.stringMatching(/n slot "Helmet" holds Alpha's Howl with a bare Corrupted line, priced 5 divine\(s\); a bare Corrupted line is allowed on a unique PoB's data marks always corrupted, one bought corrupted with the extra socket, or a cheap unique/)]);
    expect(howl('S S', 5)).toEqual([]);
    expect(howl('S', 0.5)).toEqual([]);
  });
});

// ---------------------------------------------------------------------------------------------------
// AC-W108, bullets 13 and 14: the tree search's records, the percent, the toughness warning, the levels
// ---------------------------------------------------------------------------------------------------

describe('AC-W108 (D-490, D-494): rebuild "none: <why>", D1-tree\'s price calls, the percent, under, one level a rung', () => {
  it('rebuild "none: <why>" passes; a D1-tree entry with a non-zero priceOutcomes fails', () => {
    const none = copy('run-a14');
    const why = 'none: Strength would be 160, under the 177 its gear and gems need, after repair';
    replan(none, (p) => {
      stage(p, 'b').tree.search.rebuild = why;
    });
    editJson(none, GATE, (g) => {
      rung(g, 'b').rebuild = why;
    });
    passes(none);
    const zero = copy('run-a14');
    editJson(zero, 'run-log.json', (l) => {
      l.stages[8].priceOutcomes = {};
    });
    passes(zero);
    const calls = copy('run-a14');
    editJson(calls, 'run-log.json', (l) => {
      l.stages[8].priceOutcomes = { ok: 2 };
    });
    expect(lines(check(calls).stderr, 'pricing')).toEqual([expect.stringMatching(/stages\[8\] \(D1-tree r1-a-2 attempt 1\) counts price calls \(ok 2\); D1-tree makes no trade call/)]);
  });

  it('a ledger claim of 86 against an entry evaluating to 0.86 passes (and fails before 14); a guide naming two levels for one rung fails', () => {
    const share = (fixture: string) => {
      const dir = copy(fixture);
      replan(dir, (p) => {
        p.ledger.push({ id: 'bleed_share', claim: "Blood Loss's share of the lunge", formula: 'part / whole', inputs: [{ name: 'part', value: 43, tag: { kind: 'judgment', ref: 'the lunge consumes Blood Loss on most hits', confidence: 'L' } }, { name: 'whole', value: 50, tag: { kind: 'judgment', ref: 'the lunge consumes Blood Loss on most hits', confidence: 'L' } }] });
        stage(p, 'b').claims.push({ id: 'b-share', kind: 'reason', text: 'Blood Loss carries 86% of the lunge.', source: 'ledger:bleed_share' });
      });
      return lines(check(dir).stderr, 'ledger');
    };
    expect(share('run-a14')).toEqual([]);
    expect(share('run-a13')).toEqual([expect.stringMatching(/claims\[\d+\] \(b-share\) cites ledger:bleed_share, whose current formula gives 0\.86/)]);
    const levels = copy('run-a14');
    editText(levels, GUIDE, '## Survival by stage', 'Switch to the budget rung at level 84.\n\n## Survival by stage');
    expect(lines(check(levels).stderr, 'levels')).toEqual([expect.stringMatching(/guide\.md:\d+ \(Switching over\) names level 84, which is no rung's stage level \(65, 90, 95\)/)]);
  });

  it('an EHP under its band in every condition gives the under warning kind', () => {
    const under = (warning: Json | null) => {
      const dir = copy('run-a14');
      editJson(dir, RECORD, (r) => {
        r.stages.n.outputs.TotalEHP = 12100;
        r.stages.n.measures.toughness.conditioned.ehp = 9800;
      });
      editJson(dir, GATE, (g) => {
        Object.assign(rung(g, 'n').toughness, { band: 'under', conditioned: { ehp: 9800, band: 'under' }, warning });
      });
      return lines(check(dir).stderr, 'toughness');
    };
    expect(under({ kind: 'under', type: 'chaos', fix: 'the pool or chaos resistance' })).toEqual([]);
    expect(under({ kind: 'conditioned', type: 'chaos', fix: 'the pool or chaos resistance' })).toEqual([expect.stringMatching(/toughness\.warning is the conditioned warning, but the under warning applies/)]);
    expect(under(null)).toEqual([expect.stringMatching(/toughness\.warning is null, but the EHP is under its band in every condition: the warning is \{kind: "under", type "chaos", fix\}/)]);
  });
});

// ---------------------------------------------------------------------------------------------------
// AC-W108, bullet 17: render-notes.mjs (D-487)
// ---------------------------------------------------------------------------------------------------

describe('AC-W108 (D-487, D-488): render-notes.mjs', () => {
  it('renders a fixture guide with no #, | or ** markup, ^x headings, each link on its own line and no import code', () => {
    const dir = copy('run-a14');
    const url = 'https://www.pathofexile.com/trade2/search/poe2/Standard?q=%7B%22query%22%3A%7B%7D%7D';
    writeJson(dir, `${BUILD}/trade-links.json`, [{ stage: 'b', slot: 'Body Armour', url, ids: 'checked' }, { stage: 'n', slot: 'Helmet', url: `${url}2`, ids: 'unchecked' }]);
    // The guide's own link block, which the notes take from trade-links.json instead.
    editText(dir, GUIDE, '## Endgame: non-budget', `\`\`\`text\nBody Armour: ${url}\n\`\`\`\n\n## Endgame: non-budget`);
    const r = node(NOTES, [dir, '--build', ID]);
    expect(r).toMatchObject({ code: 0, stderr: '' });
    expect(r.stdout).toMatch(/^render-notes: wrote builds\/r1-a-2\/notes\.txt \(\d+ characters\) from builds\/r1-a-2\/guide\.md and builds\/r1-a-2\/trade-links\.json\n$/);
    const notes = fs.readFileSync(path.join(dir, BUILD, 'notes.txt'), 'utf8');
    expect(notes).not.toMatch(/#|\||\*\*/);
    const record = readJson(dir, RECORD);
    expect(notes).not.toContain(String(record.importCode).slice(0, 40));
    const guide = fs.readFileSync(path.join(dir, GUIDE), 'utf8');
    const headings = guide.split('\n').filter((l) => /^#{1,3} /.test(l)).map((l) => l.replace(/^#+ /, ''));
    for (const h of headings) expect(notes.split('\n')).toContain(`^xE0C080${h.replace(/\*\*/g, '')}`);
    const ls = notes.split('\n');
    expect(ls.filter((l) => l.includes('trade2/search'))).toEqual([url, `${url}2`]);
    expect(ls.slice(ls.indexOf('^xE0C080Trade links'))).toEqual(['^xE0C080Trade links', 'Copy the whole line into your browser.', 'Budget, Body Armour:', url, 'Non-budget, Helmet (stat ids unchecked):', `${url}2`, '']);
    // The checker reads the notes too: the fixture's pass.
    expect(lines(check(dir).stderr, 'test-advice')).toEqual([]);
  });
});

// ---------------------------------------------------------------------------------------------------
// Appendix A's run log: the writes of a log at 14, the test config's scaling, the verdicts' draft fields
// ---------------------------------------------------------------------------------------------------

describe("AC-W108 (Appendix A): run-log.mjs's writes for a log at 14", () => {
  /** run-a14 cut back to its first R1b entries, before r1-a-2's skeleton was removed. */
  function verifying(): string {
    const dir = copy('run-a14');
    editJson(dir, 'run-log.json', (l) => {
      delete l.stages[5].skeletonRemoved;
    });
    return dir;
  }
  it("skeleton removes a picked card's skeleton once; an unpicked card's stays; R1b's skeletonFile is a file or null", () => {
    const dir = verifying();
    expect(write(dir, 'skeleton', { concept: 'r1-a-1' })).toMatchObject({ code: 1, stderr: expect.stringMatching(/r1-a-1 has no build in the run; only a picked card's skeleton is removed/) });
    expect(write(dir, 'skeleton', { concept: ID })).toEqual({ code: 0, stdout: `run-log: wrote stages[5].skeletonRemoved (${ID}'s skeleton file ${NAME} skeleton (draft).xml)\n`, stderr: '' });
    expect(readJson(dir, 'run-log.json').stages[5]).toMatchObject({ skeletonFile: `${NAME} skeleton (draft).xml`, skeletonRemoved: true });
    expect(write(dir, 'skeleton', { concept: ID })).toMatchObject({ code: 1, stderr: expect.stringMatching(/skeleton file .* is already removed/) });
    passes(dir);
    // R1b's return `skeleton: none: <why>` (a refused write) is logged null; the return's text itself is refused.
    expect(write(dir, 'stage', { stage: 'R1b', concept: 'r1-b-1', attempt: 1, outcome: 'pass', probes: 0, skeletonFile: 'none: the draft write was refused' })).toMatchObject({ code: 1, stderr: expect.stringMatching(/skeletonFile is only on R1b: the skeleton PoB file its draft write returned/) });
    expect(write(dir, 'stage', { stage: 'D1-build', concept: ID, attempt: 2, outcome: 'done', skeletonFile: null })).toMatchObject({ code: 1, stderr: expect.stringMatching(/skeletonFile is only on R1b/) });
    // A checker reads a removal on a card with no build as wrong.
    const stray = verifying();
    editJson(stray, 'run-log.json', (l) => {
      l.stages[4].skeletonRemoved = true;
    });
    expect(lines(check(stray).stderr, 'run-log')).toContainEqual(expect.stringMatching(/stages\[4\] \(R1b r1-a-1 attempt 1\) marks its skeleton file removed, but r1-a-1 has no build/));
  });

  it("the scope, the requests, D1-tree's priceOutcomes and the fallback's prefixes in a log at 14", () => {
    const dir = copy('run-a14');
    expect(write(dir, 'stage', { stage: 'D1-tree', concept: ID, attempt: 2, outcome: 'done', scope: 'swap' })).toMatchObject({ code: 1, stderr: expect.stringMatching(/scope "swap" isn't one of D1-tree's; D1-finish takes swap or scaling, W1 takes notes/) });
    expect(write(dir, 'stage', { stage: 'D1-finish', concept: ID, attempt: 2, outcome: 'done', requests: [{ id: 'u1', words: 'the staff', result: 'departs' }] })).toMatchObject({ code: 1, stderr: expect.stringMatching(/requests is \[\{"id", "words", "result"\}\]/) });
    expect(write(dir, 'stage', { stage: 'D1-tree', concept: ID, attempt: 2, outcome: 'done', priceOutcomes: {} }).code).toBe(0);
    // find_upgrades' fallback carries its cause (C-14): a step counts it by its kind, which stops no pricing.
    expect(write(dir, 'stage', { stage: 'D1-build', concept: ID, attempt: 2, outcome: 'done', priceOutcomes: { no_session: 1, session_rejected: 1, too_complex: 1 } })).toEqual({ code: 0, stdout: 'run-log: wrote stages[15]\n', stderr: '' });
    expect(readJson(dir, 'run-log.json').pricing.stops).toEqual([]);
  });

  it("a test config's design answer may carry scaling; the D1 gate's draft and F1's draftRemoved are paths or null", () => {
    const cfg = path.join(TMP, `cfg-${++copies}.json`);
    writeJson(path.dirname(cfg), path.basename(cfg), { answers: { design: [{ answer: 'accept', scaling: true }, 'accept:file'] } });
    expect(node(RUN_LOG, [TMP, 'test-config', cfg])).toMatchObject({ code: 0 });
    writeJson(path.dirname(cfg), path.basename(cfg), { answers: { brainstorm: [{ answer: 'more', scaling: true }] } });
    expect(node(RUN_LOG, [TMP, 'test-config', cfg])).toMatchObject({ code: 1, stderr: expect.stringMatching(/scaling is true or false, only on a design answer of accept or accept:file/) });
    const dir = copy('run-a14');
    editJson(dir, `reports/gates/F1-${ID}-a1.json`, (v) => {
      v.draftRemoved = '';
    });
    editJson(dir, GATE, (v) => {
      v.draft = 3;
    });
    expect(lines(check(dir).stderr, 'gate-report')).toEqual([
      expect.stringMatching(/D1-gate-r1-a-2-a1\.json: draft is 3; the draft PoB file the gate wrote/),
      expect.stringMatching(/F1-r1-a-2-a1\.json: draftRemoved is ""; the draft F1 removed/),
    ]);
  });
});

// ---------------------------------------------------------------------------------------------------
// After WU-137 and WU-138: the fixtures at schema 10, the spec's rules the schema leaves to the checker, one socket table
// ---------------------------------------------------------------------------------------------------

describe('AC-W108 (C-31, §9, §10, §11): run-a14 against the merged plan schema 10, and the checker\'s spec rules', () => {
  it("run-a14's plan, and the schema-10 fields the tests write into it, pass validatePlan; its record's buildSha1 leaves out spec and listing", () => {
    const ref = loadReferenceData();
    const plan = readJson(path.join(FIXTURES, 'run-a14'), PLAN);
    const ok = (p: Json) => {
      const r = validatePlan(JSON.stringify(p), ref);
      return r.ok ? [] : r.errors;
    };
    expect(ok(plan)).toEqual([]);
    const full = JSON.parse(JSON.stringify(plan)) as Json;
    full.itemSwaps = [{ stages: ['n'], slot: 'Ring 1', from: 'rare Iron Ring, fire resistance', to: 'rare Iron Ring, fire resistance, life', bossBefore: { n: 220000 }, bossAfter: { n: 210000 }, reason: 'the new ring trades 5% of the boss figure for its life' }];
    stage(full, 'n').tree.end.endAfter = 'swap';
    stage(full, 'b').tree.search.rebuild = 'none: Strength would be 160, under the 177 its gear and gems need, after repair';
    Object.assign(full.prices.find((x: Json) => x.id === 'b-body'), { listing: { corrupted: false, sockets: 0, count: 14, position: 5 } });
    expect(ok(full)).toEqual([]);
    // spec and listing are outside the build's hash (D-386's rule, C-31), so the record's buildSha1 stands without them.
    const bare = JSON.parse(JSON.stringify(plan)) as Json;
    delete bare.prices.find((x: Json) => x.id === 'b-body').spec;
    expect(buildSha1(bare as never)).toBe(readJson(path.join(FIXTURES, 'run-a14'), RECORD).buildSha1);
    expect(buildSha1(plan as never)).toBe(readJson(path.join(FIXTURES, 'run-a14'), RECORD).buildSha1);
  });

  it('a spec only on a rare of b or n; a weight beside Full DPS and TotalEHP with its why; a must-have PoB scores at zero first', () => {
    const SPEC = readJson(path.join(FIXTURES, 'run-a14'), PLAN).prices.find((x: Json) => x.id === 'b-body').spec;
    const specOn = (id: string, spec: Json = SPEC) => {
      const dir = copy('run-a14');
      replan(dir, (p) => {
        p.prices.find((x: Json) => x.id === id).spec = spec;
      });
      return lines(check(dir).stderr, 'spec');
    };
    expect(specOn('n-body')).toEqual([]);
    expect(specOn('m-body')).toEqual([expect.stringMatching(/price entry "m-body" has a spec, but it prices m Body Armour, a rare of the entering-maps stage; a spec is a rare's of b or n/)]);
    expect(specOn('n-ring2')).toEqual([expect.stringMatching(/price entry "n-ring2" has a spec, but it prices n Ring 2, a unique item/)]);
    expect(specOn('b-body', { ...SPEC, weights: [...SPEC.weights, { stat: 'Spirit', weight: 0.4 }] })).toEqual([expect.stringMatching(/spec weights "Spirit" with no why; a weight beside Full DPS and TotalEHP gives its one-line reason/)]);
    expect(specOn('b-body', { ...SPEC, weights: [...SPEC.weights, { stat: 'Spirit', weight: 0.4, why: "Herald of Blood's reservation" }] })).toEqual([]);
    const zero = { affix: '+#% to Chaos Resistance', tradeId: 'explicit.stat_2923486259', tier: 2, min: 20, zeroScored: true, why: 'PoB scores chaos resistance at zero, and n needs it' };
    expect(specOn('b-body', { ...SPEC, mustHaves: [zero, ...SPEC.mustHaves] })).toEqual([]);
    expect(specOn('b-body', { ...SPEC, mustHaves: [...SPEC.mustHaves, zero] })).toEqual([expect.stringMatching(/must-have "\+#% to Chaos Resistance", which PoB scores at zero, comes after "\+# to maximum Life"; the must-haves go most important first, one PoB scores at zero ahead of the others/)]);
  });

  it("a corrupted rare fails: rares are never corrupted (§10, §11); the extra socket is counted by data/items/sockets.json", () => {
    const dir = copy('run-a14');
    replan(dir, (p) => {
      const s = stage(p, 'b').items.slots.find((x: Json) => x.slot === 'Helmet');
      s.text = `${s.text}\nCorrupted`;
    });
    expect(lines(check(dir).stderr, 'corruption')).toEqual([expect.stringMatching(/stage b slot "Helmet" holds a corrupted rare item; corruption is only on cheap uniques and skill gems, never on a rare/)]);
    // A unique's own count before the table's (V1's rule): Greymake's "Has 4 Augment Sockets" (Data/Uniques/helmet.lua), so
    // a corrupted copy with 5 has the extra socket and passes over 1 divine, one with 4 doesn't; a helmet's table count is 1.
    const greymake = (sockets: number, augment = 'Has 4 Augment Sockets') => {
      const copyDir = copy('run-a14');
      replan(copyDir, (p) => {
        stage(p, 'n').items.slots.find((x: Json) => x.slot === 'Helmet').text = ['Rarity: Unique', 'Greymake', 'Brimmed Helm', `Sockets: ${Array(sockets).fill('S').join(' ')}`, '+40 to Strength', '+40 to Dexterity', '+40 to Intelligence', '-1 to all Attributes per Level', augment, 'Corrupted'].join('\n');
        Object.assign(p.prices.find((x: Json) => x.id === 'n-helmet'), { status: 'ok', amount: 5, currency: 'divine', note: undefined });
      });
      return lines(check(copyDir).stderr, 'corruption');
    };
    expect(greymake(5)).toEqual([]);
    expect(greymake(4)).toEqual([expect.stringMatching(/holds Greymake with a bare Corrupted line, priced 5 divine\(s\)/)]);
    // The line as PoB's data writes it, behind its variant's tag, counts the same.
    expect(greymake(5, '{variant:2}Has 4 Augment Sockets')).toEqual([]);
    expect(greymake(4, '{variant:2}Has 4 Augment Sockets')).toEqual([expect.stringMatching(/holds Greymake with a bare Corrupted line, priced 5 divine\(s\)/)]);
    const table = JSON.parse(fs.readFileSync(path.join(REPO, 'data', 'items', 'sockets.json'), 'utf8')) as Json;
    expect(table.facts['sockets.helmet'].value).toBe(1);
  });
});

// ---------------------------------------------------------------------------------------------------
// WU-140b: the fixes WU-142's and WU-143's verifiers found
// ---------------------------------------------------------------------------------------------------

describe('WU-140b (D-478, D-480, D-488, D-489): the link blocks, the design invitation, a piece left out unmeasured, a dealt header', () => {
  it("the guide's word cap skips W1's trade link blocks (§14): prose under the cap with a link block over it passes", () => {
    const pad = (dir: string, extra: string) => editText(dir, GUIDE, '## Changelog\n', `${extra}\n\n## Changelog\n`);
    // The guide's own count, read from the cap's message with 3,000 words of padding.
    const probe = copy('run-a14');
    pad(probe, 'word '.repeat(3000));
    const base = Number(/guide\.md has (\d+) words/.exec(lines(check(probe).stderr, 'word-cap')[0])![1]) - 3000;
    const url = 'https://www.pathofexile.com/trade2/search/poe2/Standard?q=%7B%22query%22%3A%7B%7D%7D';
    const block = ['```text', ...Array.from({ length: 30 }, (_, k) => `${k % 2 === 0 ? 'Body Armour' : 'Jewel 1001'}: ${url}${k}`), '```'].join('\n');
    const prose = 'word '.repeat(2300 - base - 10);
    const fenced = copy('run-a14');
    pad(fenced, `${prose}\n\n${block}`);
    expect(lines(check(fenced).stderr, 'word-cap')).toEqual([]);
    // The same lines as prose count, and take the guide over its cap.
    const loose = copy('run-a14');
    pad(loose, `${prose}\n\n${block.split('\n').slice(1, -1).join('\n')}`);
    expect(lines(check(loose).stderr, 'word-cap')).toEqual([expect.stringMatching(/guide\.md has \d+ words, over the 2300-word cap of the endgame guide/)]);
  });

  it("the design invitation of a build held to 14 asks guide or file; revision 13's keeps its words", () => {
    const A14 = "Ask anything about this build first. Then accept it (I'll ask: its endgame guide or its PoB file only, and late endgame scaling), ask for changes, go back to the verification gate to finalize another card, or stop.";
    const A13 = 'Ask anything about this build first. Then accept it (its endgame guide follows), take its PoB file only, ask for changes, go back to the verification gate to finalize another card, or stop.';
    const dir = copy('run-a14');
    expect(body(display(dir, 'design', ID).stdout)).toContain(A14);
    expect(body(display(dir, 'design', ID, true).stdout)).toContain(A14);
    const old = body(display(copy('run-a13'), 'design', ID).stdout);
    expect(old).toContain(A13);
    expect(old).not.toContain(A14);
  });

  it("a piece left out unmeasured reads as left out, with its estimate (D1-tree.md's Jade Heritage example)", () => {
    const dir = copy('run-a14');
    const jade = { stage: 'n', kind: 'unmodelled', what: 'Jade Heritage, left out unmeasured', ehpChange: 6, damageChange: null, bossAfter: null, reason: "Encase in Jade's stacks, a button the rotation can't spare", maxHit: null, hitsSurvived: null, bossEntries: null, nodes: null, price: null, from: null, to: null };
    setTrades(dir, (ts) => [...ts, jade]);
    passes(dir);
    const want = "- Left out unmeasured: Jade Heritage (estimate: EHP +6%): Encase in Jade's stacks, a button the rotation can't spare.";
    expect(body(display(dir, 'design', ID).stdout)).toContain(want);
    expect(body(display(dir, 'design', ID, true).stdout)).toContain(want);
    // An unmodelled need that is kept reads as before.
    const kept = copy('run-a14');
    setTrades(kept, (ts) => [...ts, { ...jade, what: 'the same 6 points elsewhere', ehpChange: 0.4, damageChange: 17, reason: "Cast on Critical's Energy" }]);
    expect(body(display(kept, 'design', ID).stdout)).toContain("- Kept for Cast on Critical's Energy, which PoB can't measure: the same 6 points elsewhere would add 17% damage.");
  });

  it("a dealt card's brainstorm header names its class, ascendancy and skill from its card", () => {
    const dir = copy('run-a14');
    const headers = body(display(dir, 'brainstorm').stdout).filter((l) => l.startsWith('**'));
    expect(headers).toEqual([
      '**1. Blood Hunt on a two-hander** (Warrior, Titan, Blood Hunt; under-played: no)',
      '**2. Blood Hunt armour stacker** (Warrior, Titan, Blood Hunt; under-played: yes)',
      '**3. Blood Hunt with Titan slam notables** (Warrior, Titan, Blood Hunt; under-played: no)',
      '**4. Blood Hunt block tank** (Warrior, Titan, Blood Hunt; under-played: yes)',
      '**5. Blood Hunt rage cycling** (Warrior, Titan, Blood Hunt; under-played: no)',
    ]);
  });
});
