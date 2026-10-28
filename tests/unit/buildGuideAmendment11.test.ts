/**
 * AC-W89 (WU-113, amendment 11: D-436…D-448, Appendix A): the run scripts on fixture runs, each spawned as a real `node`
 * process with an explicit env.
 *
 * - `tests/fixtures/pipeline/run-a11`: a schema-4 run held to amendment 11 from its init (`skillRevision: 11`), one
 *   endgame-only build r1-a-2 (its plan schema 7 with the non-budget rung's engagement, its record with each rung's two
 *   figures and boss rotation, its D1 gate's design field with the toughness, boss and floor, and a damage trade in
 *   `trades.json`), its dossier in amendment 11's columns, its guide's verdict lines with two figures. Each test breaks
 *   a copy and reads the rule it breaks.
 * - a composite run held to amendment 11, made from `run-composite`: its dossier's Damage and Pieces, its card's
 *   `| Key | Left out by | Does something |` table.
 * - older runs: `run-builds` (amendment 9, no rival), `run-rival` (amendment 8) and `run-composite` (amendment 10);
 *   `run-builds` stamped by a resume, its old dossier and design fields read by their own format, the entries after the
 *   stamp by amendment 11's (§19).
 *
 * The tests that evaluate a `<stage>.boss.…` ledger reference need the server's ledger evaluator with the boss context
 * (WU-111, `build/plan/ledger.js`); `mise run test` builds first.
 */
import { describe, it, expect, afterAll } from '@jest/globals';
import { spawnSync } from 'child_process';
import crypto from 'crypto';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { validatePlan } from '../../src/plan/schema';
import { loadReferenceData } from '../../src/plan/referenceData';

type Json = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

const REPO = path.resolve(__dirname, '..', '..');
const SKILL = path.join(REPO, '.claude', 'skills', 'build-guide');
const SCRIPTS = path.join(SKILL, 'scripts');
const CHECKER = path.join(SCRIPTS, 'check-run.mjs');
const RUN_LOG = path.join(SCRIPTS, 'run-log.mjs');
const RENDER = path.join(SCRIPTS, 'render-audit.mjs');
const FIXTURES = path.join(REPO, 'tests', 'fixtures', 'pipeline');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'a11-'));
afterAll(() => fs.rmSync(TMP, { recursive: true, force: true }));

/**
 * run-rival's research cites made-up Markdown data (`tests/fixtures/pipeline/data/`), so its checks run in the
 * repository's layout in a temp dir, as the amendment-8 tests do: the scripts and references copied, the server's build
 * and data/'s JSON folders linked, the vocabulary copied, the fixture's Markdown data under its data/.
 */
const ROOT = path.join(TMP, 'repo');
const ROOT_CHECKER = path.join(ROOT, '.claude', 'skills', 'build-guide', 'scripts', 'check-run.mjs');
(() => {
  fs.mkdirSync(path.dirname(ROOT_CHECKER), { recursive: true });
  for (const f of fs.readdirSync(SCRIPTS).filter((x) => x.endsWith('.mjs'))) fs.copyFileSync(path.join(SCRIPTS, f), path.join(path.dirname(ROOT_CHECKER), f));
  fs.cpSync(path.join(SKILL, 'references'), path.join(ROOT, '.claude', 'skills', 'build-guide', 'references'), { recursive: true });
  fs.symlinkSync(path.join(REPO, 'build'), path.join(ROOT, 'build'));
  fs.mkdirSync(path.join(ROOT, 'data', 'rules'), { recursive: true });
  for (const d of ['campaign', 'economy', 'enemies']) fs.symlinkSync(path.join(REPO, 'data', d), path.join(ROOT, 'data', d));
  fs.copyFileSync(path.join(REPO, 'data', 'rules', 'vocabulary.md'), path.join(ROOT, 'data', 'rules', 'vocabulary.md'));
  fs.cpSync(path.join(FIXTURES, 'data'), path.join(ROOT, 'data'), { recursive: true });
})();

const ENV = { PATH: '/usr/bin:/bin', LANG: 'C' };
function node(script: string, args: string[], input?: string) {
  const r = spawnSync(process.execPath, [script, ...args], { cwd: TMP, env: ENV, encoding: 'utf8', timeout: 30000, input });
  return { code: r.status, stdout: r.stdout, stderr: r.stderr };
}
const check = (dir: string) => node(CHECKER, [dir]);
/** The checker in the temp layout, for run-rival's Markdown data. */
const checkRival = (dir: string) => node(ROOT_CHECKER, [dir]);
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
/** The display's lines before "For reference:", and the lines after it. */
function splitReference(out: string): { plain: string[]; reference: string[] } {
  const all = out.split('\n');
  const at = all.indexOf('For reference:');
  return { plain: at < 0 ? all : all.slice(0, at), reference: at < 0 ? [] : all.slice(at) };
}
const CARD_ID = /\br[1-9]\d*-[a-cgsx]-[1-9]\d*\b/;

// ---------------------------------------------------------------------------------------------------
// run-a11 and its parts
// ---------------------------------------------------------------------------------------------------

const ID = 'r1-a-2';
const BUILD = `builds/${ID}`;
const PLAN = `${BUILD}/plan.json`;
const RECORD = `${BUILD}/compile-record.json`;
const TRADES = `${BUILD}/trades.json`;
const GUIDE = `${BUILD}/guide.md`;
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
/**
 * The non-budget rung n of a copy of run-a11, kept consistent across the record, the D1 gate's design field and
 * trades.json: its TotalEHP, its measured boss figure, the design field's band and `under`, and its trades.
 */
function setN(dir: string, o: { ehp?: number; boss?: number; band?: string; under?: boolean; trades?: Json[] }): void {
  editJson(dir, RECORD, (r) => {
    const n = r.stages.n;
    if (o.ehp !== undefined) {
      n.outputs.TotalEHP = o.ehp;
      n.measures.ehp = o.ehp;
    }
    if (o.boss !== undefined) {
      n.measures.damage.boss = o.boss;
      n.measures.bossGroups[0].figure = o.boss;
    }
  });
  editJson(dir, GATE, (g) => {
    const n = rung(g, 'n');
    if (o.ehp !== undefined) n.ehp = o.ehp;
    if (o.boss !== undefined) {
      n.damage.boss = o.boss;
      n.boss.measured = o.boss;
    }
    if (o.band !== undefined) n.toughness.band = o.band;
    if (o.under !== undefined) n.boss.under = o.under;
    if (o.trades !== undefined) n.trades = o.trades;
  });
  if (o.trades !== undefined) writeJson(dir, TRADES, { trades: o.trades });
}
const damageTrade = (bossAfter: number | null, what = 'moving 6 points from Bone Breaker to Vicious Bite'): Json =>
  bossAfter === null
    ? { stage: 'n', kind: 'damage', what, ehpChange: null, damageChange: null, bossAfter: null, reason: 'over the toughness band and under the boss floor' }
    : { stage: 'n', kind: 'damage', what, ehpChange: -12, damageChange: 18, bossAfter, reason: 'over the toughness band and under the boss floor' };
const defenceTrade = (what: string, ehp: number | null = null, damage: number | null = null): Json => ({ stage: 'n', kind: 'defence', what, ehpChange: ehp, damageChange: damage, bossAfter: null, reason: 'under the toughness band' });

/** run-a11's log rewritten from its own stages, with `edit` applied to them (each entry keeps its attempt). */
function editStages(dir: string, edit: (stages: Json[]) => Json[]): void {
  editJson(dir, 'run-log.json', (l) => {
    l.stages = edit(l.stages);
  });
}
const st = (stage: string, attempt: number, outcome: string, x: Json = {}): Json => ({ stage, concept: ID, attempt, outcome, ...x });
/** run-a11's stages before its D1 attempt (the research and verification round): D1-build is stages[7]. */
const RESEARCH = 7;

// ---------------------------------------------------------------------------------------------------
// A composite run held to amendment 11, from run-composite
// ---------------------------------------------------------------------------------------------------

const A11_TABLE = [
  '### Pieces measured',
  '',
  '| Key | Left out by | Does something |',
  '|---|---|---|',
  '| i1a-2 | Fist of War removed from group 1 | yes |',
  '| i1b-1 | the slot\'s plain Ruby Ring | no |',
  '| i1c-1 | — | PoB can\'t see it |',
  '| i1a-1 | — | not measured (the probe\'s compile failed: its group lost its mace) |',
].join('\n');
const A11_ROW = "| r1-s-1 | 1 | viable, except Blistering Bond does nothing in PoB | the aftershock hits twice and Blistering Bond's fire ignites each slam | Rolling Slam: hit, ignite | 1 of 4: Blistering Bond does nothing in PoB; Titan's slam notables: PoB can't see it | Aftershock Slammer weapon: about 0.0–0.0 divines around day 7 (seen 1 exalted on 2026-10-24, day 3 of Dawn of the Hunt); Blistering Bond: 40 exalted, seen 2026-10-24, not converted | none (offline) | the ignite rests on Blistering Bond's fire |";
/** run-composite, held to amendment 11 from its init: its dossier's columns, its card's Pieces measured, its R1b verdict's drops. */
function composite11(): string {
  const dir = copy('run-composite');
  editJson(dir, 'run-log.json', (l) => {
    l.skillRevision = 11;
    l.pricing = { stops: [], retries: [] };
  });
  const dossier = fs.readFileSync(path.join(dir, 'dossier.md'), 'utf8').split('\n');
  const head = dossier.findIndex((x) => x.startsWith('| Card |'));
  dossier.splice(head, 3, '| Card | Round | Status | Synergy | Damage | Pieces | Key prices | League | Main risk |', '|---|---|---|---|---|---|---|---|---|', A11_ROW);
  fs.writeFileSync(path.join(dir, 'dossier.md'), dossier.join('\n'));
  const card = fs.readFileSync(path.join(dir, 'cards/r1-s-1.md'), 'utf8');
  fs.writeFileSync(path.join(dir, 'cards/r1-s-1.md'), card.replace(/### Pieces measured\n[\s\S]*$/, `${A11_TABLE}\n`));
  editJson(dir, 'reports/gates/R1b-r1-s-1-a1.json', (v) => {
    v.pieces = [
      { key: 'i1a-2', figure: 'Rolling Slam (clear)', dropPercent: -18 },
      { key: 'i1b-1', figure: 'Seismic Cry (boss)', dropPercent: -0.4 },
    ];
  });
  return dir;
}

// ---------------------------------------------------------------------------------------------------
// AC-W89
// ---------------------------------------------------------------------------------------------------

describe('AC-W89 (D-436): the verification display shows no figure', () => {
  it('prints no damage, life, EHP, clear-speed or movement-speed figure; prints "works", "works, except …", the damage kinds and the pieces line; a card id appears only under "For reference"', () => {
    const dir = composite11();
    const out = display(dir, 'verification');
    expect(out).toMatchObject({ code: 0, stderr: '' });
    const { plain, reference } = splitReference(out.stdout);
    expect(plain).toContain('1. Aftershock Slammer: works, except Blistering Bond does nothing in PoB.');
    expect(plain).toContain('   Damage: Rolling Slam: hit, ignite.');
    expect(plain).toContain("   Pieces: 1 of 4: Blistering Bond does nothing in PoB; Titan's slam notables: PoB can't see it.");
    expect(plain).toContain('Numbers come at the design gate, measured on the full build.');
    for (const l of plain) {
      expect({ l, figure: /\d[\d,.]* (per second|damage per second|life|effective HP)\b|Clear speed:|Movement speed:|Toughness:|over your base speed/i.test(l) }).toEqual({ l, figure: false });
      expect({ l, id: CARD_ID.test(l) }).toEqual({ l, id: false });
    }
    expect(reference.join('\n')).toMatch(/1\. Aftershock Slammer: r1-s-1/);
    // run-a11's plain cards: "works", each with its damage kinds.
    const a11 = display(copy('run-a11'), 'verification').stdout;
    expect(a11).toMatch(/^1\. Blood Hunt bleed burst: works\.$/m);
    expect(a11).toMatch(/^ {3}Damage: Blood Hunt: hit, bleed\.$/m);
    expect(a11).not.toMatch(/Toughness:|Clear speed:|per second/);
  });

  it("an older run's verification display keeps its skeleton's figures (§19)", () => {
    expect(display(copy('run-builds'), 'verification').stdout).toMatch(/Toughness: [\d,]+ life and [\d,]+ effective HP/);
  });
});

describe("AC-W89 (D-436, §19): the dossier's columns", () => {
  it('a skillRevision: 11 run with the new dossier columns passes, and with the old ones fails', () => {
    passes(copy('run-a11'));
    const old = copy('run-a11');
    fs.copyFileSync(path.join(FIXTURES, 'run-builds', 'dossier.md'), path.join(old, 'dossier.md'));
    expect(lines(check(old).stderr, 'dossier-sections')).toEqual([expect.stringMatching(/dossier\.md:\d+: the table's columns are .*"Named source DPS".*; a dossier written under amendment 11's rules \(skillRevision 11\) has \["Card","Round","Status","Synergy","Damage","Pieces","Key prices","League","Main risk"\]/)]);
  });

  it("an old composite run's twelve columns and an old assemble run's eleven still pass", () => {
    passes(copy('run-composite'));
    expect(fs.readFileSync(path.join(FIXTURES, 'run-rival', 'dossier.md'), 'utf8')).toContain('| Card | Round | Status | Synergy | Named source DPS | Life | EHP | Clear speed | Key prices | League | Main risk |');
    expect(checkRival(copy('run-rival'))).toMatchObject({ code: 0, stderr: '' });
  });

  it("a viable row names its damage kinds, a triggered source's rated at its hand-cast speed; a failed row's cells are —; viable, except goes with a piece that does nothing", () => {
    const dir = copy('run-a11');
    editText(dir, 'dossier.md', '| Blood Hunt: hit, bleed | — | weapon: unavailable (offline run) | none (offline) | chaos resistance stays low |', '| — | — | weapon: unavailable (offline run) | none (offline) | chaos resistance stays low |');
    expect(lines(check(dir).stderr, 'dossier-sections')).toEqual([expect.stringMatching(/r1-a-1 is viable, but its Damage cell is "—"/)]);
    // D-436: a skeleton whose named source a meta gem triggers says so in its Damage cell.
    const triggered = copy('run-a11');
    editJson(triggered, 'concepts/r1-a-1/compile-record.json', (r) => {
      for (const st of Object.values(r.stages as Record<string, Json>)) st.measures = { ...(st.measures ?? {}), trigger: { by: 'Cast on Critical', usesPerSecond: 1.2 } };
    });
    expect(lines(check(triggered).stderr, 'dossier-sections')).toEqual([expect.stringMatching(/r1-a-1's named source is triggered by a meta gem .* doesn't say PoB rates it at its hand-cast speed/)]);
    editText(triggered, 'dossier.md', '| Blood Hunt: hit, bleed | — | weapon: unavailable (offline run) | none (offline) | chaos resistance stays low |', '| Blood Hunt: hit, bleed (rated at its hand-cast speed) | — | weapon: unavailable (offline run) | none (offline) | chaos resistance stays low |');
    expect(lines(check(triggered).stderr, 'dossier-sections')).toEqual([]);
    const except = composite11();
    editText(except, 'dossier.md', 'viable, except Blistering Bond does nothing in PoB', 'viable');
    expect(lines(check(except).stderr, 'dossier-sections')).toEqual([expect.stringMatching(/r1-s-1 is "viable", but its Pieces measured answers no for i1b-1/)]);
  });
});

describe('AC-W89 (D-436, D-433, §14): the Pieces measured table', () => {
  it("the new table passes with yes, no, PoB can't see it and not measured (…)", () => {
    passes(composite11());
  });

  it('a probe on a scheduled row fails', () => {
    const dir = composite11();
    editText(dir, 'cards/r1-s-1.md', "| i1a-1 | — | not measured (the probe's compile failed: its group lost its mace) |", '| cr1-a-3-2 | Seismic Cry\'s group disabled | yes |');
    expect(lines(check(dir).stderr, 'pieces')).toEqual([expect.stringMatching(/the Pieces measured row "cr1-a-3-2" probes a scheduled piece; R1b leaves out only the Pieces table's in rows/)]);
  });

  it("an answer outside the four, an old table in a run held to amendment 11, and a yes the verdict's drops don't bear out fail", () => {
    const bad = composite11();
    editText(bad, 'cards/r1-s-1.md', '| i1a-2 | Fist of War removed from group 1 | yes |', '| i1a-2 | Fist of War removed from group 1 | −18% |');
    expect(lines(check(bad).stderr, 'pieces')).toEqual([expect.stringMatching(/"i1a-2"'s answer is "−18%"; it is yes/)]);
    const old = composite11();
    const card = fs.readFileSync(path.join(FIXTURES, 'run-composite', 'cards/r1-s-1.md'), 'utf8');
    fs.writeFileSync(path.join(old, 'cards/r1-s-1.md'), card);
    expect(lines(check(old).stderr, 'pieces')).toEqual([expect.stringMatching(/a card verified under amendment 11's rules \(skillRevision 11\) has \["Key","Left out by","Does something"\]/)]);
    const drops = composite11();
    editText(drops, 'cards/r1-s-1.md', "| i1b-1 | the slot's plain Ruby Ring | no |", "| i1b-1 | the slot's plain Ruby Ring | yes |");
    editText(drops, 'dossier.md', 'viable, except Blistering Bond does nothing in PoB', 'viable');
    expect(lines(check(drops).stderr, 'pieces')).toEqual([expect.stringMatching(/"i1b-1" answers yes, but R1b's verdict file gives its drops as Seismic Cry \(boss\) -0\.4%/)]);
  });

  it('old Key | Drops | How tables pass in old runs', () => {
    // run-composite's table probes its scheduled piece too, as amendment 10's example did (§14).
    expect(fs.readFileSync(path.join(FIXTURES, 'run-composite', 'cards/r1-s-1.md'), 'utf8')).toMatch(/\| Key \| Drops \| How \|[\s\S]*\| cr1-a-3-2 \|/);
    passes(copy('run-composite'));
  });
});

describe('AC-W89 (D-436): damage-missing', () => {
  /** run-a11 whose r1-a-1 failed R1b's damage check `fails` times, then (with `then`) passed. */
  function damageMissing(fails: number, then: boolean): string {
    const dir = copy('run-a11');
    const verdict = (attempt: number) => ({
      stage: 'R1b', concept: 'r1-a-1', attempt, verdict: { compiled: 'pass', damage: 'fail' },
      findings: [{ part: 'damage', code: 'damage-missing', stage: 'r1a1e', message: 'bleed shows nothing on Blood Hunt' }],
      errors: [], compiles: 1, recordPath: 'concepts/r1-a-1/compile-record.json', faultsApplied: [],
    });
    const passed = readJson(dir, 'reports/gates/R1b-r1-a-1-a1.json');
    for (let a = 1; a <= fails; a += 1) writeJson(dir, `reports/gates/R1b-r1-a-1-a${a}.json`, verdict(a));
    if (then) writeJson(dir, `reports/gates/R1b-r1-a-1-a${fails + 1}.json`, { ...passed, attempt: fails + 1 });
    else remove(dir, 'probes/r1-a-1');
    editStages(dir, (s) => {
      const at = s.findIndex((x) => x.stage === 'R1b' && x.concept === 'r1-a-1');
      const tries = Array.from({ length: fails }, (_, k) => ({ stage: 'R1b', concept: 'r1-a-1', attempt: k + 1, outcome: 'fail', probes: 0 }));
      return [...s.slice(0, at), ...tries, ...(then ? [{ stage: 'R1b', concept: 'r1-a-1', attempt: fails + 1, outcome: 'pass', probes: 2 }] : []), ...s.slice(at + 1)];
    });
    return dir;
  }
  const remove = (dir: string, rel: string) => fs.rmSync(path.join(dir, rel), { recursive: true, force: true });

  it("a damage-missing card's retry passes", () => {
    passes(damageMissing(1, true));
  });

  it('its failed row passes', () => {
    const dir = damageMissing(3, false);
    editText(dir, 'dossier.md', /\| r1-a-1 \| 1 \| viable \| ([^|]*) \| Blood Hunt: hit, bleed \| — \| weapon: unavailable \(offline run\) \| none \(offline\) \|/, '| r1-a-1 | 1 | failed after 3 attempts: damage-missing: bleed shows nothing on Blood Hunt | $1 | — | — | — | — |');
    passes(dir);
  });

  it('a damage-missing attempt routed pass fails, as its verdict fails it', () => {
    const dir = damageMissing(1, true);
    editStages(dir, (s) => s.map((x) => (x.stage === 'R1b' && x.concept === 'r1-a-1' && x.attempt === 1 ? { ...x, outcome: 'pass' } : x)));
    expect(lines(check(dir).stderr, 'routing')).toEqual([expect.stringMatching(/R1b r1-a-1 attempt 1\): is routed pass, but its verdict names a damage kind the named source shows nothing for \(damage-missing, D-436\)/)]);
  });
});

describe('AC-W89 (D-442, D-445): the brainstorm display and the design pieces line', () => {
  it('the brainstorm display has no out: line, and shows "drawn from …" for a card with an external source', () => {
    const dir = composite11();
    editText(dir, 'cards/r1-a-1.md', '### Evidence\n', '### Evidence\n\n- Reference build: a slam Titan guide, external | https://www.mobalytics.gg/poe-2/builds/slam-titan | accessed: 2026-10-24 | confidence: M\n');
    const out = display(dir, 'brainstorm').stdout;
    expect(out).toMatch(/^ {2}in: /m);
    expect(out).toMatch(/^ {2}scheduled: /m);
    expect(out).not.toMatch(/^ {2}out: /m);
    expect(out).toMatch(/^\d+\. Rolling Slam aftershock clear: .*\n {3}drawn from mobalytics\.gg$/m);
    // An older composite run keeps its out: line.
    expect(display(copy('run-composite'), 'brainstorm').stdout).toMatch(/^ {2}out: /m);
  });

  it('the design pieces line counts out pieces without names', () => {
    const dir = copy('run-a11');
    editJson(dir, GATE, (g) => {
      g.design.pieces = { in: 5, scheduled: 1, out: 2, scheduledNames: ['Seismic Cry'], outNames: ['Elemental Focus', 'Ruthless'] };
    });
    const out = display(dir, 'design', ID).stdout;
    expect(out).toContain('- Pieces: 5 in, 1 scheduled (Seismic Cry), 2 out\n');
    expect(out).not.toMatch(/Elemental Focus|Ruthless/);
  });
});

describe('AC-W89 (D-437, D-439…D-441, D-447): the design and final displays', () => {
  /** run-a11 with every kind of line on the design display: a cull on b, a trigger on n, an estimate, each trade. */
  function full(): string {
    const dir = copy('run-a11');
    editJson(dir, GATE, (g) => {
      rung(g, 'b').cull = { map: 91, boss: 13 };
      rung(g, 'n').trigger = { by: 'Cast on Critical', usesPerSecond: 1.46 };
      Object.assign(rung(g, 'n').boss, { estimate: 320000, corrections: ["Cast on Critical's rate of 2.1 a second from the crit rate"], under: false });
      rung(g, 'b').trades = [{ stage: 'b', kind: 'unmodelled', what: 'the same 6 points elsewhere', ehpChange: null, damageChange: 17, bossAfter: null, reason: "Cast on Critical's Energy" }];
      rung(g, 'm').trades = [{ stage: 'm', kind: 'boots', what: 'Trampletoe, 25% movement speed, 5% under the tier', ehpChange: null, damageChange: null, bossAfter: null, reason: 'overkill damage hitting nearby enemies' }];
      rung(g, 'n').trades = [defenceTrade('a rare body with life and resistances and Crimson Assault', 17, -9), damageTrade(247800)];
    });
    return dir;
  }

  it('the design display prints both figures, the cull line only with skills.cull, the trigger line and each trade; the swap line says "damage"', () => {
    const out = display(full(), 'design', ID).stdout;
    expect(out).toContain('- Damage: 50,000 per second against map monsters.\n- Boss damage: 60,000 per second against a Pinnacle boss.\n- Culls normal monsters at 91%, bosses at 13%.\n');
    expect(out.match(/^- Culls /gm)).toHaveLength(1);
    expect(out).toContain("- Blood Hunt is triggered by Cast on Critical: PoB rates it at its hand-cast speed (1.46 a second) and doesn't model Energy.\n");
    expect(out).toContain("- Kept for Cast on Critical's Energy, which PoB can't measure: the same 6 points elsewhere would add 17% damage.\n");
    expect(out).toContain('- Boots: Trampletoe, 25% movement speed, 5% under the tier, for overkill damage hitting nearby enemies.\n');
    expect(out).toContain('- Defence: a rare body with life and resistances and Crimson Assault: +17% EHP, −9% damage.\n');
    expect(out).toContain('- Damage: moving 6 points from Bone Breaker to Vicious Bite: +18% damage (boss about 247,800), −12% EHP.\n');
    expect(out).toContain('- Passive tree: 9 of 98 points on travel; best swap left: +3.2% damage by moving 2 points from Strength, Strength to Cold Nature\n');
    expect(out).toContain('- Toughness: 52,300 against the 20,000 target for a close build (Blood Hunt lunges into the pack and the boss), over its band (30,000).\n');
  });

  it("the design field carries a cull only with the plan's skills.cull, its figures and its trigger the record's", () => {
    const dir = copy('run-a11');
    editJson(dir, RECORD, (r) => {
      r.stages.b.measures.cull = { map: 91, boss: 13 };
    });
    editJson(dir, GATE, (g) => {
      rung(g, 'b').cull = { map: 91, boss: 13 };
    });
    expect(lines(check(dir).stderr, 'design-field')).toEqual([expect.stringMatching(/design\.rungs's "b"'s cull is \{"map":91,"boss":13\}, but the plan's b has no skills\.cull/)]);
    replan(dir, (p) => {
      p.stages.find((x: Json) => x.id === 'b').skills.cull = "Legacy of Deathblow's Culling Strike on Blood Hunt";
    });
    expect(lines(check(dir).stderr, 'design-field')).toEqual([]);
    const trigger = copy('run-a11');
    editJson(trigger, GATE, (g) => {
      rung(g, 'n').trigger = { by: 'Cast on Critical', usesPerSecond: 1.46 };
      rung(g, 'n').damage.map = 150000;
    });
    expect(lines(check(trigger).stderr, 'design-field')).toEqual([
      expect.stringMatching(/design\.rungs's "n"'s damage is \{"map":150000,"boss":210000\}, but the record's n\.measures\.damage is \{"map":140000,"boss":210000\}/),
      expect.stringMatching(/design\.rungs's "n"'s trigger is \{"by":"Cast on Critical","usesPerSecond":1\.46\}, but the record's n\.measures\.trigger is null/),
    ]);
  });

  it("the boss line prints \"about <estimate>\" with its corrections when the design estimates it, else the measured figure", () => {
    const out = display(full(), 'design', ID).stdout;
    expect(out).toContain("- Boss damage: about 320,000 per second against a Pinnacle boss (PoB alone: 210,000 at Blood Hunt's hand-cast 1.46 a second; estimated: Cast on Critical's rate of 2.1 a second from the crit rate).\n");
    expect(out).toContain('- Boss damage: 10,500 per second against a Pinnacle boss.\n');
    expect(out).not.toMatch(/about 10,500/);
  });

  it('the design display prints the floor line, "about" only with an estimate, and a damage trade\'s bossAfter as the boss figure × (1 + damageChange / 100)', () => {
    const out = display(copy('run-a11'), 'design', ID).stdout;
    expect(out).toContain('- Boss floor: 210,000, under the 250,000 floor.\n');
    // 210,000 × (1 + 18 / 100) = 247,800.
    expect(out).toContain('(boss about 247,800)');
    expect(display(full(), 'design', ID).stdout).toContain('- Boss floor: about 320,000 against the 250,000 floor.\n');
  });

  it('the final display prints both figures', () => {
    const out = display(copy('run-a11'), 'final', ID).stdout;
    expect(out).toContain('- Non-budget endgame (level 95): 140,000 damage per second against map monsters, 210,000 against a Pinnacle boss; Effective HP 52,300,');
    expect(out).toContain('- Entering maps (level 65): 9,000 damage per second against map monsters, 10,500 against a Pinnacle boss; Effective HP 18,400,');
  });

  it('an older run\'s design display keeps "Full DPS" and its one figure (§19)', () => {
    const out = display(copy('run-builds'), 'design', ID).stdout;
    expect(out).toContain('best swap left: +3.2% Full DPS by moving');
    expect(out).toMatch(/^- Damage: [\d,]+ per second\.$/m);
  });
});

describe("AC-W89 (D-437, D-447): the guide's verdict line", () => {
  it("a verdict line with two figures passes against measures.damage.map and measures.damage.boss; one that differs fails", () => {
    passes(copy('run-a11'));
    const dir = copy('run-a11');
    editText(dir, GUIDE, 'about 210,000 against a Pinnacle boss', 'about 999,000 against a Pinnacle boss');
    expect(lines(check(dir).stderr, 'verdict-line')).toEqual([expect.stringMatching(/the Non-budget verdict line says damage against a Pinnacle boss 999,000, but n\.measures\.damage\.boss is 210000/)]);
    const one = copy('run-a11');
    editText(one, GUIDE, 'Blood Hunt about 140,000 DPS against map monsters, about 210,000 against a Pinnacle boss.', 'Blood Hunt about 140,000 DPS.');
    expect(lines(check(one).stderr, 'verdict-line')).toEqual([expect.stringMatching(/the Non-budget verdict line gives one damage figure, but stage n's record measures it against map monsters and against a Pinnacle boss/)]);
  });

  it("an old guide's verdict line passes against measures.dps", () => {
    expect(fs.readFileSync(path.join(FIXTURES, 'run-builds', GUIDE), 'utf8')).toMatch(/Blood Hunt about 140,000 DPS\. Effective HP/);
    passes(copy('run-builds'));
  });
});

describe('AC-W89 (D-441): the toughness band', () => {
  it('a band or engagement that disagrees with the record, the plan and the targets file fails', () => {
    const band = copy('run-a11');
    editJson(band, GATE, (g) => {
      rung(g, 'n').toughness.band = 'within';
    });
    expect(lines(check(band).stderr, 'toughness')).toEqual([expect.stringMatching(/toughness\.band is "within", but the record's TotalEHP 52300 against the 20000 target is over/)]);
    const engagement = copy('run-a11');
    editJson(engagement, GATE, (g) => {
      Object.assign(rung(g, 'n').toughness, { engagement: 'distance', target: 15000 });
    });
    expect(lines(check(engagement).stderr, 'toughness')).toEqual([
      expect.stringMatching(/toughness\.engagement is "distance", but the plan's n\.skills\.engagement is "close"/),
      expect.stringMatching(/toughness\.target is 15000, but references\/toughness-targets\.json gives a close build 20000/),
    ]);
    const target = copy('run-a11');
    editJson(target, GATE, (g) => {
      rung(g, 'n').toughness.target = 18000;
    });
    expect(lines(check(target).stderr, 'toughness')).toEqual([expect.stringMatching(/toughness\.target is 18000, but references\/toughness-targets\.json gives a close build 20000/)]);
  });

  it('a non-budget rung without engagement fails', () => {
    const dir = copy('run-a11');
    replan(dir, (p) => {
      delete p.stages.find((s: Json) => s.id === 'n').skills.engagement;
    });
    expect(lines(check(dir).stderr, 'toughness')).toEqual([expect.stringMatching(/plan\.json's non-budget rung n has no skills\.engagement/)]);
  });

  it('a close rung at 31,000 is over and needs a damage trade, at 29,000 within, at 17,000 under', () => {
    // Above the floor, so only the band asks for a trade.
    const over = copy('run-a11');
    setN(over, { ehp: 31000, boss: 260000, under: false, band: 'over', trades: [] });
    expect([...lines(check(over).stderr, 'toughness'), ...lines(check(over).stderr, 'trades')]).toEqual([expect.stringMatching(/the non-budget rung n is over its toughness band, but no damage trade is shown for it/)]);
    setN(over, { trades: [damageTrade(306800)] });
    expect([...lines(check(over).stderr, 'toughness'), ...lines(check(over).stderr, 'trades')]).toEqual([]);
    const within = copy('run-a11');
    setN(within, { ehp: 29000, boss: 260000, under: false, band: 'within', trades: [] });
    expect([...lines(check(within).stderr, 'toughness'), ...lines(check(within).stderr, 'trades')]).toEqual([]);
    setN(within, { band: 'over' });
    expect(lines(check(within).stderr, 'toughness')).toEqual([expect.stringMatching(/toughness\.band is "over", but the record's TotalEHP 29000 against the 20000 target is within/)]);
    const under = copy('run-a11');
    setN(under, { ehp: 17000, boss: 260000, under: false, band: 'under', trades: [] });
    expect([...lines(check(under).stderr, 'toughness'), ...lines(check(under).stderr, 'trades')]).toEqual([expect.stringMatching(/the non-budget rung n is under its toughness band, but no defence trade is shown for it/)]);
  });

  it('an out-of-band rung without a trade entry fails; with "none found: …" it passes', () => {
    const dir = copy('run-a11');
    setN(dir, { ehp: 17000, boss: 260000, under: false, band: 'under', trades: [defenceTrade('none found: no rare body beats the unique for its aggravation')] });
    expect([...lines(check(dir).stderr, 'toughness'), ...lines(check(dir).stderr, 'trades')]).toEqual([]);
  });

  it("the design field's trades are trades.json's", () => {
    const dir = copy('run-a11');
    writeJson(dir, TRADES, { trades: [] });
    expect(lines(check(dir).stderr, 'trades')).toEqual([expect.stringMatching(/design\.rungs's "n"'s trades aren't trades\.json's for n/)]);
  });
});

describe('AC-W89 (D-447): the boss estimate', () => {
  it('a boss_<stage> formula with no boss.g reference fails', () => {
    const dir = copy('run-a11');
    replan(dir, (p) => {
      p.ledger.push({ id: 'boss_n', claim: 'Blood Hunt against a Pinnacle boss', formula: 'n.g1s1p1.TotalDPS * 1.5', inputs: [] });
    });
    expect(lines(check(dir).stderr, 'boss-estimate')).toContainEqual(expect.stringMatching(/boss_n has the formula "n\.g1s1p1\.TotalDPS \* 1\.5", which reads no boss rotation entry n\.boss\.g<group>s<skill>p<statSet>/));
  });

  it("a D1 gate's rotation with a triggered entry, or an entry with turns, and no boss_<stage> entry fails", () => {
    const triggered = copy('run-a11');
    editJson(triggered, RECORD, (r) => {
      Object.assign(r.stages.n.measures.bossGroups[0], { triggered: true, triggeredBy: 'Cast on Critical' });
    });
    expect(lines(check(triggered).stderr, 'boss-estimate')).toEqual([expect.stringMatching(/stage n's boss rotation has an entry PoB rates at its hand-cast speed \(triggered: g1s1p1\), but plan\.json's ledger has no boss_n/)]);
    const turns = copy('run-a11');
    replan(turns, (p) => {
      p.stages.find((s: Json) => s.id === 'n').skills.boss = { entries: [{ group: 1, activeSkill: 1, statSet: 1 }, { group: 2, activeSkill: 1, statSet: 1, turns: true }], note: 'Rolling Slam between lunges' };
    });
    expect(lines(check(turns).stderr, 'boss-estimate')).toEqual([expect.stringMatching(/stage n's boss rotation has entries that take turns \(g2s1p1\), but plan\.json's ledger has no boss_n/)]);
  });

  it("a campaign stage of an old run without one passes: a campaign added to an older run isn't held (§9b, §19)", () => {
    // run-builds stamped at its resume, before r1-a-1's campaign: r1-a-1's D1 gate came before the stamp.
    const dir = copy('run-builds');
    editJson(dir, 'run-log.json', (l) => {
      Object.assign(l, { skillRevision: 11, skillRevisionFrom: { ...l.resumes[0].lengths }, pricing: { stops: [], retries: [] } });
    });
    editJson(dir, 'builds/r1-a-1/compile-record.json', (r) => {
      for (const s of Object.values(r.stages as Record<string, Json>)) {
        if (s.measures) s.measures.bossGroups = [{ group: 1, activeSkill: 1, statSet: 1, figure: 1000, usesPerSecond: 1, triggered: true, triggeredBy: 'Cast on Critical', turns: false, ignite: 0, bleed: 0, poison: 0 }];
      }
    });
    const stderr = check(dir).stderr;
    expect([...lines(stderr, 'boss-estimate'), ...lines(stderr, 'toughness'), ...lines(stderr, 'boss-floor')]).toEqual([]);
  });
});

describe('AC-W89 (D-448): the boss floor', () => {
  it('at non-budget, a boss figure of 240,000 is under the floor and needs a damage trade; 260,000 is not', () => {
    const under = copy('run-a11');
    setN(under, { ehp: 25000, boss: 240000, under: true, band: 'within', trades: [] });
    expect([...lines(check(under).stderr, 'boss-floor'), ...lines(check(under).stderr, 'trades')]).toEqual([expect.stringMatching(/the non-budget rung n is under the boss floor, but no damage trade is shown for it/)]);
    setN(under, { trades: [{ ...damageTrade(283200), reason: 'under the boss floor' }] });
    expect([...lines(check(under).stderr, 'boss-floor'), ...lines(check(under).stderr, 'trades')]).toEqual([]);
    const above = copy('run-a11');
    setN(above, { ehp: 25000, boss: 260000, under: false, band: 'within', trades: [] });
    expect([...lines(check(above).stderr, 'boss-floor'), ...lines(check(above).stderr, 'trades')]).toEqual([]);
  });

  it("a boss.under that disagrees with the record and references/boss-floor.json fails, and so does a boss.floor other than the file's", () => {
    const dir = copy('run-a11');
    setN(dir, { under: false });
    expect(lines(check(dir).stderr, 'boss-floor')).toEqual([expect.stringMatching(/boss\.under is false, but the boss figure 210000 is under the 250000 floor/)]);
    const floor = copy('run-a11');
    editJson(floor, GATE, (g) => {
      rung(g, 'n').boss.floor = 200000;
    });
    expect(lines(check(floor).stderr, 'boss-floor')).toEqual([expect.stringMatching(/boss\.floor is 200000, but references\/boss-floor\.json's floor is 250000/)]);
  });

  it('an under-floor rung with "none found: …" passes; a damage trade whose bossAfter isn\'t the boss figure × (1 + damageChange / 100) fails', () => {
    const none = copy('run-a11');
    setN(none, { trades: [damageTrade(null, 'none found: every swap drops the EHP below the target')] });
    passes(none);
    const wrong = copy('run-a11');
    setN(wrong, { trades: [damageTrade(300000)] });
    expect(lines(check(wrong).stderr, 'trades')).toEqual([expect.stringMatching(/damage trade .* has bossAfter 300000; it is the boss figure 210000 × \(1 \+ 18 \/ 100\) = 247800/)]);
  });

  it('the reference files are Appendix A\'s', () => {
    // Amendment 12 (§22): the targets file gains `arbiter`, so this pin reads amendment 11's part (toMatchObject).
    expect(readJson(SKILL, 'references/toughness-targets.json')).toMatchObject({ rung: 'non-budget', targets: { close: 20000, distance: 15000 }, under: 0.9, over: 1.5, source: 'studies/2026-10-25-toughness-floors.md' });
    expect(readJson(SKILL, 'references/boss-floor.json')).toEqual({ rung: 'non-budget', floor: 250000, source: 'studies/2026-10-25-boss-estimate.md' });
  });
});

describe("AC-W89 (D-442): prices in players' words", () => {
  it('a price that rounds to 0.0 prints as seen in exalts; no user-facing line says "exalted"', () => {
    const dir = composite11();
    const out = display(dir, 'verification').stdout;
    expect(out).toContain('   Key prices: Aftershock Slammer weapon: 1 exalt (seen 2026-10-24); Blistering Bond: 40 exalts, seen 2026-10-24, not converted.');
    expect(out).not.toMatch(/exalted/);
  });

  it('a rung total that rounds to 0.0 divines renders as seen, and a currency with no rate in players\' words', () => {
    const dir = copy('run-a11');
    editJson(dir, PLAN, (p) => {
      p.league = 'Dawn of the Hunt';
      for (const pr of p.prices) {
        if (pr.id.startsWith('m-') || pr.id.startsWith('b-')) Object.assign(pr, { amount: pr.id.startsWith('m-') ? 1 : 3, currency: 'exalted', status: 'ok', date: '2026-10-24', league: 'Dawn of the Hunt', note: undefined });
      }
    });
    // No rate for exalts: m's total, 0 by the gate's hand, is shown as seen; b's is unknown for want of a rate.
    editJson(dir, GATE, (g) => {
      g.basis.budget.rates = [];
      g.basis.budget.totals.find((t: Json) => t.stage === 'm').low = 0;
      g.basis.budget.totals.find((t: Json) => t.stage === 'm').high = 0;
    });
    const r = node(RENDER, [dir, '--build', ID]);
    expect(r).toMatchObject({ code: 0, stderr: '' });
    const audit = fs.readFileSync(path.join(dir, BUILD, 'audit.md'), 'utf8');
    const slots = readJson(dir, GATE).basis.budget.slots.filter((x: Json) => x.stage === 'm').length;
    expect(audit).toContain(`- Budget: ${slots} ${slots === 1 ? 'exalt' : 'exalts'} (seen 2026-10-24), against a 5-divine target.`);
    expect(audit).toMatch(/no rate for exalts/);
    expect(audit).not.toMatch(/exalted/);
  });
});

describe('AC-W89 (D-444): the pricing stop and D1-build\'s price calls', () => {
  it('priceOutcomes on D1-build is accepted, by run-log.mjs and the checker', () => {
    const dir = path.join(TMP, `log-${++copies}`);
    fs.mkdirSync(dir);
    expect(write(dir, 'init', { slug: 'titan-blood-hunt', brief: { ascendancy: 'Titan', skill: 'Blood Hunt' }, mode: 'online', testConfig: 'none', noNinja: false }).code).toBe(0);
    expect(write(dir, 'stage', { stage: 'D1-build', concept: ID, attempt: 1, outcome: 'done', priceOutcomes: { ok: 3, exchange: 2 } })).toEqual({ code: 0, stdout: 'run-log: wrote stages[0]\n', stderr: '' });
    const run = copy('run-a11');
    editStages(run, (s) => s.map((x) => (x.stage === 'D1-build' ? { ...x, priceOutcomes: { ok: 3 } } : x)));
    editJson(run, 'run-log.json', (l) => {
      l.mode = 'online';
    });
    expect([...lines(check(run).stderr, 'run-log'), ...lines(check(run).stderr, 'pricing')]).toEqual([]);
  });

  it('run-log.mjs records the stop with the step that hit it, and takes a gate\'s answer only while a stop is open and after the gate\'s display', () => {
    const dir = copy('run-a11');
    editJson(dir, 'run-log.json', (l) => {
      l.status = 'running';
      l.mode = 'online';
      l.stages = l.stages.slice(0, RESEARCH);
      l.checkpoints = l.checkpoints.slice(0, 2);
      l.displays = l.displays.slice(0, 2);
      l.builds = [];
    });
    expect(write(dir, 'pricing', { checkpoint: 'verification', answer: 'retry-pricing' })).toMatchObject({ code: 1, stderr: expect.stringMatching(/^run-log: pricing entry refused: no stop is open/) });
    expect(write(dir, 'stage', { stage: 'R1b-assemble', attempt: 1, outcome: 'done' }).code).toBe(0);
    expect(write(dir, 'stage', { stage: 'R1b', concept: 'r1-a-3', attempt: 1, outcome: 'pass', probes: 0, priceOutcomes: { ok: 1, rate_limited: 1 } })).toEqual({
      code: 0, stdout: `run-log: wrote stages[${RESEARCH + 1}], and pricing.stops[0]: trade-site pricing stopped after rate_limited until a gate's retry-pricing (D-444)\n`, stderr: '',
    });
    expect(readJson(dir, 'run-log.json').pricing.stops).toEqual([{ at: RESEARCH + 1, step: 'R1b', outcome: 'rate_limited' }]);
    expect(write(dir, 'pricing', { checkpoint: 'verification', answer: 'retry-pricing' })).toMatchObject({ code: 1, stderr: expect.stringMatching(/the verification gate's visit 2 printed no display/) });
    expect(display(dir, 'verification').code).toBe(0);
    expect(write(dir, 'pricing', { checkpoint: 'verification', answer: 'maybe' })).toMatchObject({ code: 1, stderr: expect.stringMatching(/answer "maybe" isn't retry-pricing or no-retry/) });
    expect(write(dir, 'pricing', { checkpoint: 'verification', answer: 'retry-pricing' })).toEqual({ code: 0, stdout: 'run-log: wrote pricing.retries[0] (retry-pricing at the verification gate)\n', stderr: '' });
    expect(readJson(dir, 'run-log.json').pricing.retries).toEqual([{ checkpoint: 'verification', answer: 'retry-pricing', at: RESEARCH + 2 }]);
    expect(write(dir, 'pricing', { checkpoint: 'verification', answer: 'no-retry' })).toMatchObject({ code: 1, stderr: expect.stringMatching(/no stop is open/) });
  });

  /** run-a11 online, its D1-build hitting a rate limit (the stop recorded), then `after`'s steps in place of D1-tree on. */
  function stopped(d1finish: Json): string {
    const dir = copy('run-a11');
    editJson(dir, 'run-log.json', (l) => {
      l.mode = 'online';
      const at = l.stages.findIndex((x: Json) => x.stage === 'D1-build');
      l.stages[at].priceOutcomes = { ok: 1, rate_limited: 1 };
      l.stages[at + 2].priceOutcomes = d1finish;
      l.pricing.stops = [{ at, step: 'D1-build', outcome: 'rate_limited' }];
    });
    return dir;
  }

  it('a pricing step after a stop without an approval fails; poe.ninja\'s exchange stays allowed', () => {
    const dir = stopped({ ok: 4 });
    expect(lines(check(dir).stderr, 'pricing')).toEqual([expect.stringMatching(/D1-finish r1-a-2 attempt 1\) makes 4 trade-site price call\(s\) \(ok 4\), but pricing stopped at stages\[\d+\] \(D1-build, rate_limited\) and no gate's retry-pricing, nor a resume, came after it/)]);
    expect(lines(check(stopped({ exchange: 4 })).stderr, 'pricing')).toEqual([]);
    // The stop itself is recorded with its step: a log missing it fails.
    const unrecorded = stopped({ exchange: 4 });
    editJson(unrecorded, 'run-log.json', (l) => {
      l.pricing.stops = [];
    });
    expect(lines(check(unrecorded).stderr, 'pricing')).toEqual([expect.stringMatching(/counts a rate_limited call, but pricing\.stops records no stop at stages\[\d+\]/)]);
  });

  it('after retry-pricing it passes: the design gate\'s answer, then the D1 gate\'s re-price pass before F1', () => {
    const dir = stopped({ exchange: 4 });
    // The design gate asked after the stop, the user approved a retry, accepted; the D1 gate's re-price pass priced, then F1.
    fs.copyFileSync(path.join(dir, GATE), path.join(dir, `reports/gates/D1-gate-${ID}-a2.json`));
    editJson(dir, `reports/gates/D1-gate-${ID}-a2.json`, (g) => {
      g.attempt = 2;
    });
    editJson(dir, 'run-log.json', (l) => {
      const gate = l.stages.findIndex((x: Json) => x.stage === 'D1-gate');
      l.stages.splice(gate + 1, 0, st('D1-gate', 2, 'pass', { priceOutcomes: { ok: 2 } }));
      l.pricing.retries = [{ checkpoint: 'design', answer: 'retry-pricing', at: gate + 1 }];
    });
    const stderr = check(dir).stderr;
    expect([...lines(stderr, 'pricing'), ...lines(stderr, 'order'), ...lines(stderr, 'design-gate')]).toEqual([]);
    // Without the approval, the re-price pass is a trade-site step under the stop, and no route.
    editJson(dir, 'run-log.json', (l) => {
      l.pricing.retries = [];
    });
    const without = check(dir).stderr;
    expect(lines(without, 'pricing')).toEqual([expect.stringMatching(/D1-gate r1-a-2 attempt 2\) makes 2 trade-site price call\(s\)/)]);
    expect(lines(without, 'order')).toContainEqual(expect.stringMatching(/D1-gate r1-a-2 attempt 2\): follows the design gate answered "accept", which goes on to r1-a-2's final compile, F1, not D1-gate/));
  });
});

describe('AC-W89 (D-438, §14): the order table\'s new routes', () => {
  it('D1-build after a D1-tree with outcome respec passes', () => {
    const dir = copy('run-a11');
    editStages(dir, (s) => [...s.slice(0, RESEARCH), st('D1-build', 1, 'done'), st('D1-tree', 1, 'respec'), st('D1-build', 2, 'done'), st('D1-tree', 2, 'done'), st('D1-finish', 1, 'done'), ...s.slice(RESEARCH + 3)]);
    expect(lines(check(dir).stderr, 'order')).toEqual([]);
    // run-log.mjs takes the outcome in a log at revision 11 (amendment 12, D-452: a log at 12 refuses it).
    const log = path.join(TMP, `log-${++copies}`);
    fs.mkdirSync(log);
    write(log, 'init', { slug: 'titan-blood-hunt', brief: { ascendancy: 'Titan', skill: 'Blood Hunt' }, mode: 'offline', testConfig: 'none', noNinja: false });
    editJson(log, 'run-log.json', (l) => {
      l.skillRevision = 11;
    });
    expect(write(log, 'stage', { stage: 'D1-tree', concept: ID, attempt: 1, outcome: 'respec' }).code).toBe(0);
    expect(write(log, 'stage', { stage: 'D1-finish', concept: ID, attempt: 1, outcome: 'build' }).code).toBe(0);
  });

  it('D1-build after a D1-finish with outcome build passes, in an attempt that already ran D1-build', () => {
    const dir = copy('run-a11');
    editStages(dir, (s) => [...s.slice(0, RESEARCH), st('D1-build', 1, 'done'), st('D1-tree', 1, 'done'), st('D1-finish', 1, 'build'), st('D1-build', 2, 'done'), st('D1-tree', 2, 'done'), st('D1-finish', 2, 'done'), ...s.slice(RESEARCH + 3)]);
    expect(lines(check(dir).stderr, 'order')).toEqual([]);
  });

  it('a respec routes only D1-build: D1-finish after it fails', () => {
    const dir = copy('run-a11');
    editStages(dir, (s) => [...s.slice(0, RESEARCH + 1), st('D1-tree', 1, 'respec'), ...s.slice(RESEARCH + 2)]);
    expect(lines(check(dir).stderr, 'order')).toEqual([expect.stringMatching(/D1-finish r1-a-2 attempt 1\): can't follow D1-tree r1-a-2 attempt 1 \(outcome "respec"\); SKILL\.md's step list allows D1-build next/)]);
  });
});

describe("AC-W89 (C-55a, D-440): the best swap's weapon set, and the boots exception", () => {
  it('bestSwap.weaponSet: 3 fails', () => {
    const dir = copy('run-a11');
    editJson(dir, GATE, (g) => {
      rung(g, 'b').tree.bestSwap.weaponSet = 3;
    });
    expect(lines(check(dir).stderr, 'gate-report')).toEqual([expect.stringMatching(/design\.rungs's "b" tree's bestSwap\.weaponSet is 3; a pool move is within weapon set 1 or 2/)]);
    const two = copy('run-a11');
    editJson(two, GATE, (g) => {
      Object.assign(rung(g, 'b').tree.bestSwap, { weaponSet: 2, branches: [{ nodes: ['Strength', 'Strength'], points: 2 }] });
    });
    passes(two);
  });

  it("a boots-exception finding doesn't fail the gate's v1 part, nor the final record's V1, whose note it is", () => {
    const dir = copy('run-a11');
    const finding = { part: 'v1', code: 'boots-exception', stage: 'b', message: 'b: Trampletoe, 25% movement speed under the 35% tier; kind unique: overkill damage hits nearby enemies' };
    editJson(dir, GATE, (g) => {
      g.findings.push(finding);
    });
    // V1 writes it as a note (WU-111); only movement-tier is a finding.
    editJson(dir, RECORD, (r) => {
      r.stages.b.v1.notes.push({ code: 'boots-exception', message: finding.message });
    });
    passes(dir);
    // Read as information wherever it stands: the record's findings too.
    editJson(dir, RECORD, (r) => {
      r.stages.b.v1.findings.push({ code: 'boots-exception', message: finding.message });
    });
    passes(dir);
  });
});

describe('AC-W89 (D-443, §11, §19): the rival only in older runs, and the run dated by its skill revision', () => {
  it('an old run with an RV entry still passes; a skillRevision: 11 run with an x card fails', () => {
    expect(checkRival(copy('run-rival'))).toMatchObject({ code: 0, stderr: '' });
    // run-rival's log in schema 4, as if init had written it under amendment 11's rules.
    const dir = copy('run-rival');
    expect(node(RUN_LOG, [dir, 'migrate']).code).toBe(0);
    editJson(dir, 'run-log.json', (l) => {
      Object.assign(l, { skillRevision: 11, noNinja: false, pinCommit: 'x', digest: null, pricing: { stops: [], retries: [] } });
    });
    const rival = lines(checkRival(dir).stderr, 'rival');
    expect(rival).toContainEqual(expect.stringMatching(/run-log\.json stages\[\d+\] runs the rival \(RV\), which amendment 11 removes/));
    expect(rival).toContainEqual(expect.stringMatching(/cards\/r1-x-1\.md is the rival's card, written in the entries held to amendment 11, which never deals an x card/));
  });

  it('a skillRevision run without a rival is dated amendment-8-or-later: its deck names each dealt card\'s engine', () => {
    const dir = copy('run-a11');
    editText(dir, 'cards.md', ' | engine: rage from on-hit', '');
    expect(lines(check(dir).stderr, 'deck')).toEqual([expect.stringMatching(/round 1 deals r1-c-3 with no "engine: <family> from <family>"; a run held to amendment 11 \(skillRevision 11\), dated amendment-8-or-later by its skill revision/)]);
    // run-builds, an older run with no rival and no engine, isn't.
    passes(copy('run-builds'));
  });

  it('resume on an old log stamps skillRevision, and the entries after the stamp are held to the new rules', () => {
    const dir = copy('run-builds');
    const before = readJson(dir, 'run-log.json');
    // Amendment 12 (Appendix A): a log from before amendment 11 resumed now is stamped 12, with both boundaries.
    expect(write(dir, 'resume', { noNinja: false })).toMatchObject({ code: 0, stdout: `run-log: wrote resumes[${before.resumes.length}], status running, skillRevision 12 from stages[${before.stages.length}] (the rules of amendments 11 and 12)\n` });
    const log = readJson(dir, 'run-log.json');
    const lengths = { stages: before.stages.length, checkpoints: before.checkpoints.length, escalations: 0, displays: before.displays.length };
    expect(log).toMatchObject({ skillRevision: 12, skillRevisionFrom: { 11: lengths, 12: lengths }, pricing: { stops: [], retries: [] } });
    expect(log.resumes[log.resumes.length - 1].lengths).toEqual(log.skillRevisionFrom['11']);
    // The entries before the stamp keep their rules (its D1 gates hold no amendment-11 design field); run-log.mjs
    // refuses the rival after it, and so does the checker.
    const stamped = check(dir).stderr;
    expect([...lines(stamped, 'rival'), ...lines(stamped, 'toughness'), ...lines(stamped, 'dossier-sections'), ...lines(stamped, 'deck')]).toEqual([]);
    expect(write(dir, 'stage', { stage: 'RV', attempt: 1, outcome: 'none-found', tried: 'a slam opener' })).toMatchObject({ code: 1, stderr: expect.stringMatching(/the rival \(RV\) is removed/) });
    editJson(dir, 'run-log.json', (l) => {
      l.stages.push({ stage: 'RV', attempt: 1, outcome: 'none-found', tried: 'a slam opener' });
    });
    expect(lines(check(dir).stderr, 'rival')).toEqual([expect.stringMatching(new RegExp(`stages\\[${before.stages.length}\\] runs the rival \\(RV\\), which amendment 11 removes`))]);
  });
});

describe("AC-W89 (§19, D-436, D-437, D-442): a resume-stamped old run's displays read each artifact by its own format", () => {
  /** Amendment 10's design pieces (D-434), the out pieces named; an amendment-11 design field drops `outNames`. */
  const OLD_PIECES = { in: 4, scheduled: 1, out: 2, scheduledNames: ['Seismic Cry'], outNames: ['Elemental Focus', 'Ruthless'] };
  /** run-builds, its D1 gates' design fields given OLD_PIECES, and stamped by a real resume when `stamp`. */
  function oldRun(stamp: boolean): string {
    const dir = copy('run-builds');
    for (const id of ['r1-a-1', 'r1-a-2']) {
      editJson(dir, `reports/gates/D1-gate-${id}-a1.json`, (g) => {
        g.design.pieces = OLD_PIECES;
      });
    }
    if (stamp) {
      expect(write(dir, 'resume', { noNinja: false })).toMatchObject({ code: 0, stdout: expect.stringMatching(/skillRevision 12 from stages\[25\]/) });
    }
    return dir;
  }
  /** The verification display's cards, its lines before "Builds in this run:". */
  const cardsPart = (out: string): string[] => {
    const all = out.split('\n');
    return all.slice(0, all.indexOf('Builds in this run:'));
  };
  const NUMBERS_LATER = 'Numbers come at the design gate, measured on the full build.';

  it('after the stamp, the old dossier keeps its figures, and the old design fields their one figure, "Full DPS" and named out pieces', () => {
    const before = oldRun(false);
    const after = oldRun(true);
    const v = display(after, 'verification');
    expect(v).toMatchObject({ code: 0, stderr: '' });
    expect(cardsPart(v.stdout)).toEqual(cardsPart(display(before, 'verification').stdout));
    expect(v.stdout).toContain('   Damage: 50,000 per second from Blood Hunt, against map monsters (modelled in PoB).\n');
    expect(v.stdout).toContain("   Toughness: 4,200 life and 31,500 effective HP (PoB's estimate of the damage it takes to kill you).\n");
    expect(v.stdout).not.toContain(NUMBERS_LATER);
    for (const id of ['r1-a-1', 'r1-a-2']) {
      const d = display(after, 'design', id);
      expect(d).toMatchObject({ code: 0, stderr: '' });
      expect(d.stdout).toEqual(display(before, 'design', id).stdout);
      expect(d.stdout).toContain("damage is PoB's damage per second for the main skill;");
      expect(d.stdout).toContain('- Pieces: 4 in, 1 scheduled (Seismic Cry), 2 out (Elemental Focus, Ruthless)\n');
      expect(d.stdout).toContain('- Damage: 50,000 per second.\n');
      expect(d.stdout).toContain('best swap left: +3.2% Full DPS by moving 2 points from Strength, Strength to Cold Nature\n');
      expect(d.stdout).not.toMatch(/against map monsters|Pinnacle boss|% damage by moving/);
    }
    // The checker holds the stamped log's entries before the stamp to their own rules.
    const stamped = check(after).stderr;
    expect([...lines(stamped, 'dossier-sections'), ...lines(stamped, 'design-field'), ...lines(stamped, 'gate-report')]).toEqual([]);
  });

  it('an entry written after the stamp displays in the new form, beside the old entries in the same log', () => {
    const dir = oldRun(true);
    // R1b-assemble after the stamp writes the dossier in amendment 11's columns (run-a11's, for the same two cards).
    fs.copyFileSync(path.join(FIXTURES, 'run-a11', 'dossier.md'), path.join(dir, 'dossier.md'));
    expect(write(dir, 'stage', { stage: 'R1b-assemble', attempt: 2, outcome: 'done' }).code).toBe(0);
    const v = display(dir, 'verification').stdout;
    expect(v).toMatch(/^1\. Blood Hunt bleed burst: works\.$/m);
    expect(v).toMatch(/^ {3}Damage: Blood Hunt: hit, bleed\.$/m);
    expect(v).toContain(NUMBERS_LATER);
    expect(v).not.toMatch(/Toughness:|Clear speed:|per second/);
    // The checker reads it the same way: written after the stamp, in amendment 11's columns; the old one there fails.
    expect(lines(check(dir).stderr, 'dossier-sections')).toEqual([]);
    const oldDossier = path.join(TMP, `stamped-${++copies}`);
    fs.cpSync(dir, oldDossier, { recursive: true });
    fs.copyFileSync(path.join(FIXTURES, 'run-builds', 'dossier.md'), path.join(oldDossier, 'dossier.md'));
    expect(lines(check(oldDossier).stderr, 'dossier-sections')).toEqual([expect.stringMatching(/a dossier written under amendment 11's rules \(skillRevision 11\) has \["Card","Round","Status","Synergy","Damage","Pieces","Key prices","League","Main risk"\]/)]);
    // A D1 gate after the stamp writes amendment 11's design field (run-a11's rungs, its pieces with no outNames).
    const a11 = readJson(path.join(FIXTURES, 'run-a11'), GATE).design;
    const first = readJson(dir, 'reports/gates/D1-gate-r1-a-1-a1.json');
    writeJson(dir, 'reports/gates/D1-gate-r1-a-1-a2.json', { ...first, attempt: 2, design: { ...a11, pieces: { in: 4, scheduled: 1, out: 2, scheduledNames: ['Seismic Cry'] } } });
    expect(write(dir, 'stage', { stage: 'D1-gate', concept: 'r1-a-1', attempt: 2, outcome: 'pass' }).code).toBe(0);
    const d = display(dir, 'design', 'r1-a-1').stdout;
    expect(d).toContain('damage is the main skill\'s damage per second against map monsters and against a Pinnacle boss');
    expect(d).toContain('- Pieces: 4 in, 1 scheduled (Seismic Cry), 2 out\n');
    expect(d).toContain('- Damage: 50,000 per second against map monsters.\n- Boss damage: 60,000 per second against a Pinnacle boss.\n');
    expect(d).toContain('best swap left: +3.2% damage by moving 2 points from Strength, Strength to Cold Nature\n');
    expect(d).not.toMatch(/Full DPS/);
    // r1-a-2's D1 gate, logged before the stamp, keeps its form in the same log.
    const old = display(dir, 'design', 'r1-a-2').stdout;
    expect(old).toContain('- Pieces: 4 in, 1 scheduled (Seismic Cry), 2 out (Elemental Focus, Ruthless)\n');
    expect(old).toContain('best swap left: +3.2% Full DPS by moving');
    expect(old).toMatch(/^- Damage: [\d,]+ per second\.$/m);
  });
});

describe("AC-W89 (D-437, §19): the checker's tree-swap messages", () => {
  /** A D1 gate whose rung b's best swap gains 6% with no tree-swap finding, and with a tree-swap finding on rung m, under 5%. */
  function swaps(dir: string, file: string, weaponSet?: number): void {
    editJson(dir, file, (g) => {
      Object.assign(rung(g, 'b').tree.bestSwap, { gainPercent: 6 }, weaponSet === undefined ? {} : { weaponSet });
      g.verdict.tree = 'fail';
      g.findings.push({ part: 'tree', code: 'tree-swap', stage: 'm', message: 'm: moving 2 points gains 1% damage' });
    });
  }
  const said = (file: string, label: string, rules: string): RegExp[] => [
    new RegExp(`${file.replace(/[.]/g, '\\.')}: rung b's best swap left gains 6% ${label}, at least 5%, but no tree-swap finding names it: the tree part fails that rung \\(${rules}\\)$`),
    new RegExp(`${file.replace(/[.]/g, '\\.')}: has a tree-swap finding on rung m, whose best swap left gains under 5% ${label} \\(design\\.rungs's tree\\): a rung fails only at 5% or more \\(${rules}\\)$`),
  ];

  it('a run held to amendment 11 says "damage"; a pool move off the main group\'s weapon set keeps "Full DPS"', () => {
    const dir = copy('run-a11');
    swaps(dir, GATE);
    expect(lines(check(dir).stderr, 'gate-report')).toEqual(said(GATE, 'damage', 'D-419, D-437').map((r) => expect.stringMatching(r)));
    const pool = copy('run-a11');
    swaps(pool, GATE, 2);
    expect(lines(check(pool).stderr, 'gate-report')).toEqual([expect.stringMatching(said(GATE, 'Full DPS', 'D-419')[0]), expect.stringMatching(said(GATE, 'damage', 'D-419, D-437')[1])]);
  });

  it('an old run keeps "Full DPS", and so does a verdict logged before a resume\'s stamp; one logged after it says "damage"', () => {
    const old = 'reports/gates/D1-gate-r1-a-2-a1.json';
    const dir = copy('run-builds');
    swaps(dir, old);
    expect(lines(check(dir).stderr, 'gate-report')).toEqual(said(old, 'Full DPS', 'D-419').map((r) => expect.stringMatching(r)));
    expect(write(dir, 'resume', { noNinja: false }).code).toBe(0);
    const fresh = 'reports/gates/D1-gate-r1-a-1-a2.json';
    writeJson(dir, fresh, { ...readJson(dir, 'reports/gates/D1-gate-r1-a-1-a1.json'), attempt: 2 });
    swaps(dir, fresh);
    expect(write(dir, 'stage', { stage: 'D1-gate', concept: 'r1-a-1', attempt: 2, outcome: 'fail' }).code).toBe(0);
    expect(lines(check(dir).stderr, 'gate-report')).toEqual([...said(fresh, 'damage', 'D-419, D-437'), ...said(old, 'Full DPS', 'D-419')].map((r) => expect.stringMatching(r)));
  });
});

// ---------------------------------------------------------------------------------------------------
// The boss references, through the server's evaluator with the boss context (WU-111)
// ---------------------------------------------------------------------------------------------------

describe('AC-W89: run-a11 is a run the amended pipeline could write', () => {
  it("its plan is a valid schema-7 plan with the C1/E1 data (the non-budget rung's engagement, each rung's scaling, boots at their tier)", () => {
    const result = validatePlan(fs.readFileSync(path.join(FIXTURES, 'run-a11', PLAN), 'utf8'), loadReferenceData());
    expect(result.ok ? [] : result.errors).toEqual([]);
  });
});

describe('AC-W89 (C-33, D-447): the checker and the audit evaluate a boss.g<g>s<s>p<p> reference from the record\'s bossGroups', () => {
  /** run-a11 with a hand estimate on n: `boss_n` its formula, the design field, the record's ledger and the guide agreeing. */
  function estimated(formula: string, value: number, o: { measured?: number; under?: boolean; bossAfter?: number } = {}): string {
    const dir = copy('run-a11');
    if (o.measured !== undefined) setN(dir, { boss: o.measured });
    replan(dir, (p) => {
      p.ledger.push({ id: 'boss_n', claim: "Blood Hunt against a Pinnacle boss, its bleed's strikes counted", formula, inputs: [{ name: 'strikes', value: 1.2, tag: { kind: 'judgment', ref: 'the lunge strikes about 1.2 times a use', confidence: 'M' } }] });
    });
    editJson(dir, RECORD, (r) => {
      r.ledger.boss_n = { value, error: null, computedWithCustomMods: false };
    });
    editJson(dir, GATE, (g) => {
      const n = rung(g, 'n');
      Object.assign(n.boss, { estimate: value, corrections: ['hits per use: 1.2 strikes'], under: o.under ?? value < 250000 });
      n.trades = [{ ...damageTrade(o.bossAfter ?? Math.round(value * 1.18)) }];
    });
    writeJson(dir, TRADES, { trades: rung(readJson(dir, GATE), 'n').trades });
    editText(dir, GUIDE, /about [\d,]+ against a Pinnacle boss\. Effective HP about 52,300/, `about ${value.toLocaleString('en-US')} against a Pinnacle boss. Effective HP about 52,300`);
    expect(node(RENDER, [dir, '--build', ID])).toMatchObject({ code: 0, stderr: '' });
    return dir;
  }

  it('a boss_n entry reading n.boss.g1s1p1 evaluates from bossGroups: the checker passes, and the audit shows the estimate', () => {
    const dir = estimated('n.boss.g1s1p1 * strikes', 252000);
    passes(dir);
    expect(fs.readFileSync(path.join(dir, BUILD, 'audit.md'), 'utf8')).toMatch(/\| Endgame non-budget \(L95\) \{n\} \| 95 \| \d+ \| 140000 \/ 252000 \|/);
  });

  it('a reference outside the stage\'s rotation fails', () => {
    const dir = estimated('n.boss.g1s1p1 * strikes', 252000);
    replan(dir, (p) => {
      p.ledger.find((e: Json) => e.id === 'boss_n').formula = 'n.boss.g1s1p1 * strikes + n.boss.g2s1p1 * 0';
    });
    expect(lines(check(dir).stderr, 'boss-estimate')).toContainEqual(expect.stringMatching(/boss_n reads n\.boss\.g2s1p1, which is outside stage n's boss rotation \(g1s1p1\)/));
  });

  it("a design field whose boss.estimate differs from the ledger's value fails", () => {
    const dir = estimated('n.boss.g1s1p1 * strikes', 252000);
    editJson(dir, GATE, (g) => {
      rung(g, 'n').boss.estimate = 300000;
    });
    expect(lines(check(dir).stderr, 'boss-estimate')).toEqual([expect.stringMatching(/boss\.estimate is 300000, but the ledger's boss_n evaluates to 252000 over the record/)]);
  });

  it("the guide's verdict line is held to the boss_<stage> ledger value when it exists", () => {
    const dir = estimated('n.boss.g1s1p1 * strikes', 252000);
    editText(dir, GUIDE, 'about 252,000 against a Pinnacle boss', 'about 210,000 against a Pinnacle boss');
    expect(lines(check(dir).stderr, 'verdict-line')).toEqual([expect.stringMatching(/says damage against a Pinnacle boss 210,000, but the ledger's boss_n, its current formula over the record \(D-447\) is 252000/)]);
  });

  it("the final display shows the ledger's estimate", () => {
    const out = display(estimated('n.boss.g1s1p1 * strikes', 252000), 'final', ID).stdout;
    expect(out).toContain('- Non-budget endgame (level 95): 140,000 damage per second against map monsters, about 252,000 against a Pinnacle boss; Effective HP 52,300,');
  });

  it('an estimate under the floor over a measured figure above it is under', () => {
    // PoB alone 260,000, above the floor; the estimate 0.9 of it, 234,000, under it.
    const dir = estimated('n.boss.g1s1p1 * 0.9', 234000, { measured: 260000, under: true });
    passes(dir);
    editJson(dir, GATE, (g) => {
      rung(g, 'n').boss.under = false;
    });
    expect(lines(check(dir).stderr, 'boss-floor')).toEqual([expect.stringMatching(/boss\.under is false, but the boss figure 234000 \(the ledger's boss_n\) is under the 250000 floor/)]);
  });
});
