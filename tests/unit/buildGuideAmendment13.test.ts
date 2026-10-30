/**
 * AC-W100 (WU-130, amendment 13: D-464…D-468, D-471, D-472, D-474, D-475, D-477, §15, §22, Appendix A): the run scripts
 * on fixture runs, each spawned as a real `node` process with an explicit env.
 *
 * - `tests/fixtures/pipeline/run-a13`: run-a12 held to amendment 13 from its init (`skillRevision: 13`): its plan at
 *   schema 9 (Appendix A) with each rung's `tree.start`, `tree.end` and `tree.search`, the life and mana flasks, a cheap
 *   unique corrupted on `n` (Blistering Bond, its price the offline note) and Blood Hunt's gem `corrupt`, and the claim
 *   `boss-fall-n`; its PoB file named by the build's session name; its D1 gate's design field with Appendix A's additions
 *   (the boss rotation with its fall on `n`, Life, the swap cap on `b`, the rebuild undone on `m`, the removed passives
 *   and the skill levels on `n`); its trades in 11 fields with `n`'s boss trade; its guide's corruption and flask lines;
 *   the brainstorm display's numbers. Each test breaks a copy and reads the rule it breaks.
 * - a composite run held to amendment 13 from its init, made from `run-composite` (with amendment 11's dossier and
 *   Pieces measured, as the amendment-11 tests make it), for the brainstorm display and the cards' runes.
 * - older runs: `run-a12` (revision 12), `run-composite` (amendment 10), and run-a12 stamped by a resume.
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

type Json = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

const REPO = path.resolve(__dirname, '..', '..');
const SKILL = path.join(REPO, '.claude', 'skills', 'build-guide');
const SCRIPTS = path.join(SKILL, 'scripts');
const CHECKER = path.join(SCRIPTS, 'check-run.mjs');
const RUN_LOG = path.join(SCRIPTS, 'run-log.mjs');
const RENDER = path.join(SCRIPTS, 'render-audit.mjs');
const FIXTURES = path.join(REPO, 'tests', 'fixtures', 'pipeline');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'a13-'));
afterAll(() => fs.rmSync(TMP, { recursive: true, force: true }));

const ENV = { PATH: '/usr/bin:/bin', LANG: 'C' };
function node(script: string, args: string[], input?: string) {
  const r = spawnSync(process.execPath, [script, ...args], { cwd: TMP, env: ENV, encoding: 'utf8', timeout: 30000, input });
  return { code: r.status, stdout: r.stdout, stderr: r.stderr };
}
/** A module script run with node, for the render's exports. */
function nodeModule(source: string) {
  const r = spawnSync(process.execPath, ['--input-type=module', '-e', source], { cwd: TMP, env: ENV, encoding: 'utf8', timeout: 30000 });
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
/** A copy of a run folder (a display records its visit, so each display reads its own copy). */
function copyOf(dir: string): string {
  const to = path.join(TMP, `display-${++copies}`);
  fs.cpSync(dir, to, { recursive: true });
  return to;
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
/** A display's lines. */
const out = (stdout: string) => stdout.split('\n');

const ID = 'r1-a-2';
const BUILD = `builds/${ID}`;
const PLAN = `${BUILD}/plan.json`;
const RECORD = `${BUILD}/compile-record.json`;
const TRADES = `${BUILD}/trades.json`;
const GUIDE = `${BUILD}/guide.md`;
const GATE = `reports/gates/D1-gate-${ID}-a1.json`;
const F1 = `reports/gates/F1-${ID}-a1.json`;
const NAME = 'Blood Hunt with Rolling Slam clear';
const rung = (gate: Json, stage: string): Json => gate.design.rungs.find((r: Json) => r.stage === stage);
const stage = (plan: Json, id: string): Json => plan.stages.find((s: Json) => s.id === id);
const sha1 = (dir: string, rel: string) => crypto.createHash('sha1').update(fs.readFileSync(path.join(dir, rel))).digest('hex');
/** After a plan edit, the record's planSha1 (and its buildSha1) are the plan's again, so `record-plan` stays quiet. */
function replan(dir: string, edit: (p: Json) => void): void {
  editJson(dir, PLAN, edit);
  const s = sha1(dir, PLAN);
  const plan = readJson(dir, PLAN);
  editJson(dir, RECORD, (r) => {
    r.planSha1 = s;
    r.buildSha1 = buildSha1(plan);
  });
}
/** The build's final file, named in the record, the run log and F1's verdict alike. */
function setFile(dir: string, file: string): void {
  editJson(dir, RECORD, (r) => {
    r.pobFile.path = file;
  });
  editJson(dir, 'run-log.json', (l) => {
    l.builds[0].pobFile = file;
  });
  editJson(dir, F1, (v) => {
    v.finalCompile.pobFile = file;
  });
}

/** Blistering Bond, a ring of the pinned data (`Data/Uniques/ring.lua`), corrupted to a ring's corruption line. */
const BOND = [
  'Rarity: Unique', 'Blistering Bond', 'Ruby Ring', 'Implicits: 1', '+25% to Fire Resistance', '+50 to maximum Life',
  '+25% to Fire Resistance', '-12% to Cold Resistance', 'You take Fire Damage instead of Physical Damage from Bleeding',
  'Fire Damage also Contributes to Bleeding Magnitude', 'Bleeding you inflict deals Fire Damage instead of Physical Damage',
  '{enchant}25% increased Damage', 'Corrupted',
].join('\n');
/** Split Personality (`Data/Uniques/jewel.lua`), which drops corrupted: the item as it drops. */
const SPLIT = ['Rarity: Unique', 'Split Personality', 'Ruby', 'Variant: Warrior', 'Selected Variant: 6', 'Limited to: 1', "Can Allocate Passive Skills from the Warrior's starting point", 'Corrupted'].join('\n');
/** Grand Spectrum (a Ruby unique jewel), corrupted to a jewel's corruption line (`Data/ModCorrupted.lua`). */
const SPECTRUM = ['Rarity: Unique', 'Grand Spectrum', 'Ruby', 'Limited to: 3', '2% increased Maximum Life per socketed Grand Spectrum', '{enchant}+5 to Strength', 'Corrupted'].join('\n');
/** A price entry's state, by its id. */
function setPrice(dir: string, id: string, o: Json): void {
  replan(dir, (p) => {
    Object.assign(p.prices.find((x: Json) => x.id === id), o);
  });
}

// ---------------------------------------------------------------------------------------------------
// A composite run held to amendment 13, from run-composite
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
/** run-composite held to amendment 13 from its init (`revision`), with amendment 11's dossier and Pieces measured. */
function composite(revision = 13): string {
  const dir = copy('run-composite');
  editJson(dir, 'run-log.json', (l) => {
    l.skillRevision = revision;
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
/** A row added to a card's Pieces table, after its last row. */
function addPiece(dir: string, card: string, row: string): void {
  const p = path.join(dir, 'cards', `${card}.md`);
  const t = fs.readFileSync(p, 'utf8').split('\n');
  const at = t.findIndex((l) => l.startsWith('### Pieces') && !l.startsWith('### Pieces measured'));
  let end = at + 1;
  while (end < t.length && !t[end].startsWith('|')) end += 1;
  while (end < t.length && t[end].startsWith('|')) end += 1;
  t.splice(end, 0, row);
  fs.writeFileSync(p, t.join('\n'));
}

// ---------------------------------------------------------------------------------------------------
// AC-W100, bullet 1: the brainstorm display (D-475)
// ---------------------------------------------------------------------------------------------------

describe('AC-W100 (D-475): the brainstorm display of a revision-13 visit', () => {
  it("a composite's first line, at most 8 key pieces, scheduled names, the header's two sentences, the plain cards on one line, no For reference", () => {
    const dir = composite();
    editText(dir, 'cards.md', /## What the composites share\n\n[^\n]+\n/, "## What the composites share\n\nBoth composites are Titan Warriors with a two-handed mace. Each borrows the round's strongest pieces. The third sentence stays in cards.md.\n");
    // r1-s-2, not verified yet, takes ten pieces: eight show, chosen by kind, then "+ 2 more in cards.md".
    for (const row of [
      '| i1b-7 | Bonesplitter | unique | in | Weapon 1 | the mace | i1b-7 |',
      '| i1c-7 | Resolute Technique | keystone | in | the tree | no misses | i1c-7 |',
      '| i1c-8 | Stun the slam | support, under-played | in | group 1 | heavy stun | i1c-8 |',
      '| i1a-7 | Fist of War | support | in | group 1 | the aftershock | i1a-7 |',
      '| i1a-8 | Leap Slam travel | config | in | group 3 | the travel | i1a-8 |',
      '| i1b-8 | Seismic Cry rally | skill | in | group 4 | the cry | i1b-8 |',
    ]) addPiece(dir, 'r1-s-2', row);
    const shown = display(copyOf(dir), 'brainstorm').stdout;
    expect(shown).not.toMatch(/For reference/);
    expect(shown).not.toMatch(/How they differ/);
    expect(shown).not.toMatch(/\br1-[a-cs]-\d\b/);
    expect(out(shown)).toContain("What the composites share: Both composites are Titan Warriors with a two-handed mace. Each borrows the round's strongest pieces.");
    expect(out(shown)).toContain('1. Jagged Earth Bastion: Warrior, Titan, Earthquake; under-played: yes');
    expect(out(shown)).toContain('  in: Bonesplitter, Stun the slam, Fist of War, Resolute Technique, the armour wheel, Earthquake, increased Physical Damage on a two-handed mace, increased Armour on the body armour, + 2 more in cards.md');
    expect(out(shown)).toContain('  scheduled: Leap Slam');
    expect(out(shown)).toContain("Plain cards: Rolling Slam aftershock clear, Earthquake jagged ground, Rolling Slam with Seismic Cry, Earthquake on a two-handed mace, Rolling Slam with a fire ring, Earthquake armour tank, Rolling Slam with Titan's slam notables, Earthquake block wall, Rolling Slam stun lock.");
    // Its visit's displays[] entry holds the number-to-id map.
    const d = copyOf(dir);
    display(d, 'brainstorm');
    expect(readJson(d, 'run-log.json').displays.pop()).toEqual({ checkpoint: 'brainstorm', visit: 2, numbers: { 1: 'r1-s-2' } });
  });

  it("the dealt-card path's display gets the same cuts, and records its numbers", () => {
    const shown = display(copy('run-a13'), 'brainstorm').stdout;
    expect(shown).not.toMatch(/For reference|How they differ|Why pick it/);
    expect(out(shown)).toContain('What the cards share: Every card is a Titan Warrior with a spear, and Blood Hunt is its damage: it lunges at a bleeding enemy and consumes its Blood Loss for a burst of physical damage. Bloodlust and Brutality I support it, and Herald of Blood pops the bleeding dead.');
    expect(out(shown)).toContain('2. Blood Hunt armour stacker: stacked armour shrugs off the hits that kill most melee builds, and Blood Hunt still bursts; under-played: yes');
    expect(out(shown)).toContain('Not dealt: Blood Hunt crit lunge, Blood Hunt with a bleed unique.');
    const dir = copy('run-a13');
    display(dir, 'brainstorm');
    expect(readJson(dir, 'run-log.json').displays.pop()).toEqual({ checkpoint: 'brainstorm', visit: 2, numbers: { 1: 'r1-b-1', 2: 'r1-b-3', 3: 'r1-c-1', 4: 'r1-c-2', 5: 'r1-c-3' } });
  });

  it("a pick: naming a number's card passes; numbers naming no card of the run, or on another gate's display, fail", () => {
    // run-a13's brainstorm visit recorded its numbers, and its pick names two of their cards.
    passes(copy('run-a13'));
    // Through the scripts: a composite run at its first brainstorm visit records the numbers, and the pick is written.
    const dir = composite();
    editJson(dir, 'run-log.json', (l) => {
      l.stages = l.stages.slice(0, 4);
      l.checkpoints = [];
      l.displays = [];
      l.status = 'running';
      l.dossier = null;
    });
    for (const f of ['dossier.md', 'concepts', 'probes', 'reports']) fs.rmSync(path.join(dir, f), { recursive: true, force: true });
    editText(dir, 'cards/r1-s-1.md', /### Structure check\n\n[^\n]+\n/, '### Structure check\n\nNot checked yet.\n');
    editText(dir, 'cards/r1-s-1.md', /### Pieces measured\n[\s\S]*$/, '### Pieces measured\n\nNot checked yet.\n');
    expect(display(dir, 'brainstorm').code).toBe(0);
    const numbers = readJson(dir, 'run-log.json').displays[0].numbers;
    expect(numbers).toEqual({ 1: 'r1-s-1', 2: 'r1-s-2' });
    expect(write(dir, 'checkpoint', { checkpoint: 'brainstorm', visit: 1, answer: `pick:${numbers['1']}`, answeredBy: 'user', questions: 0 })).toMatchObject({ code: 0 });
    expect(lines(check(dir).stderr, 'display')).toEqual([]);
    expect(lines(check(dir).stderr, 'run-log')).toEqual([]);
    const bad = copy('run-a13');
    editJson(bad, 'run-log.json', (l) => {
      l.displays[0].numbers['8'] = 'r9-a-1';
      l.displays[1].numbers = { 1: 'r1-a-2' };
    });
    const stderr = check(bad).stderr;
    expect(lines(stderr, 'display')).toEqual([expect.stringMatching(/displays\[0\] maps number 8 to "r9-a-1", which is no card of the run/)]);
    expect(lines(stderr, 'run-log')).toEqual([expect.stringMatching(/run-log\.json displays\[1\]: has numbers \{"1":"r1-a-2"\}; only a brainstorm display records them/)]);
  });

  it("a revision-12 visit's display is unchanged: the header's two paragraphs, the round line, the plain cards numbered, the ids for reference", () => {
    const dir = composite(12);
    const shown = display(copyOf(dir), 'brainstorm').stdout;
    expect(out(shown)).toContain("How they differ: \"Aftershock Slammer\" is the Rolling Slam structure: it moves while it clears and takes an ignite from Blistering Bond, its Seismic Cry kept for bosses; \"Jagged Earth Bastion\" is the Earthquake structure: it stands still behind stacked armour and lets the aftershock clear, slower but far tougher.");
    expect(out(shown)).toContain("1. Jagged Earth Bastion | Warrior, Titan, Earthquake | the quake's hit and its aftershock | the aftershock's delay covered by Leap Slam between packs | under-played (judgment: armour stacking on a quake build, rarely paired with Earthquake)");
    expect(out(shown)).toContain('  scheduled: Leap Slam (group 2)');
    expect(out(shown)).toContain('2. Rolling Slam aftershock clear: Warrior, Titan, Rolling Slam');
    expect(out(shown)).toContain('For reference:');
    display(dir, 'brainstorm');
    expect(readJson(dir, 'run-log.json').displays.pop()).toEqual({ checkpoint: 'brainstorm', visit: 2 });
  });
});

// ---------------------------------------------------------------------------------------------------
// AC-W100, bullet 2: the names, the draft and one file per build (D-466)
// ---------------------------------------------------------------------------------------------------

describe('AC-W100 (D-466): the files named by the session name, the draft, one file per build', () => {
  it('a build held to 13 writes <name>.xml, <name> <date>.xml or <name> <date> 2.xml, and never <runName>-<id>.xml', () => {
    passes(copy('run-a13'));
    for (const file of [`${NAME} 2026-10-08.xml`, `${NAME} 2026-10-08 2.xml`, `${NAME.toLowerCase()}.xml`]) {
      const dir = copy('run-a13');
      setFile(dir, file);
      passes(dir);
    }
    for (const file of ['titan-blood-hunt-2026-10-08-1-r1-a-2.xml', `${NAME} 2026-10-09.xml`, `${NAME} 2026-10-08 1.xml`, `${NAME} (draft).xml`]) {
      const dir = copy('run-a13');
      setFile(dir, file);
      expect({ file, lines: lines(check(dir).stderr, 'layout') }).toEqual({ file, lines: [expect.stringMatching(new RegExp(`the final compile wrote "${file.replace(/[.()]/g, '\\$&')}"; a build held to amendment 13 names its file by its session name "${NAME}"`))] });
    }
  });

  it("a name with ':' is matched as the server cleans it; builds[].name, when a revision gave one, is the session name", () => {
    const dir = copy('run-a13');
    editJson(dir, 'run-log.json', (l) => {
      l.builds[0] = { id: l.builds[0].id, roll: l.builds[0].roll, name: 'Blood Hunt: Slam? Clear.', ...Object.fromEntries(Object.entries(l.builds[0]).filter(([k]) => !['id', 'roll'].includes(k))) };
    });
    expect(node(RENDER, [dir, '--build', ID]).code).toBe(0);
    setFile(dir, 'Blood Hunt Slam Clear.xml');
    passes(dir);
    setFile(dir, 'Blood Hunt: Slam? Clear..xml');
    expect(lines(check(dir).stderr, 'layout')).toEqual([expect.stringMatching(/session name "Blood Hunt: Slam\? Clear\.", cleaned "Blood Hunt Slam Clear"/)]);
  });

  it('two builds recording one file fail', () => {
    const dir = copy('run-builds');
    editJson(dir, 'run-log.json', (l) => {
      l.builds[1].pobFile = l.builds[0].pobFile.toUpperCase();
    });
    expect(lines(check(dir).stderr, 'run-log')).toContainEqual(expect.stringMatching(/builds\[\] r1-a-2 records the PoB file "TITAN-.*", which build r1-a-1 records too; each build writes its own file/));
  });

  it("a build before the boundary keeps its rule: run-a12's <runName>-<id>.xml passes, its session name fails, and so after a resume's stamp", () => {
    passes(copy('run-a12'));
    const dir = copy('run-a12');
    setFile(dir, `${NAME}.xml`);
    expect(lines(check(dir).stderr, 'layout')).toEqual([expect.stringMatching(/its build_name is "titan-blood-hunt-2026-10-08-1-r1-a-2"/)]);
    const stamped = copy('run-a12');
    expect(write(stamped, 'resume', { noNinja: false })).toMatchObject({ code: 0, stdout: expect.stringMatching(/skillRevision 13 from stages\[14\]\n$/) });
    expect(readJson(stamped, 'run-log.json').skillRevisionFrom).toEqual({ 13: { stages: 14, checkpoints: 4, escalations: 0, displays: 4 } });
    expect(check(stamped).stderr).toBe('');
  });

  it('builds[].draftFile is recorded and printed by the design display; a log with or without it passes; its name is a draft form', () => {
    const dir = copy('run-a13');
    expect(write(dir, 'build', { id: ID, draftFile: `${NAME} (draft).xml` })).toMatchObject({ code: 0 });
    expect(Object.keys(readJson(dir, 'run-log.json').builds[0])).toEqual(['id', 'roll', 'status', 'folder', 'guide', 'pobFile', 'draftFile']);
    passes(dir);
    expect(out(display(copyOf(dir), 'design', ID).stdout)).toContain(`- Draft PoB file: ${NAME} (draft).xml, in your builds list.`);
    expect(write(dir, 'build', { id: ID, draftFile: `${NAME} (draft 2).xml` }).code).toBe(0);
    passes(dir);
    expect(write(dir, 'build', { id: ID, draftFile: 'Blood Hunt draft.xml' }).code).toBe(0);
    expect(lines(check(dir).stderr, 'layout')).toEqual([expect.stringMatching(/draftFile is "Blood Hunt draft\.xml"; a draft is named by the build's session name "Blood Hunt with Rolling Slam clear", "<name> \(draft\)\.xml" or "<name> \(draft <k>\)\.xml"/)]);
    const without = copy('run-a13');
    editJson(without, 'run-log.json', (l) => {
      delete l.builds[0].draftFile;
    });
    passes(without);
    // A log below 13 takes no draftFile: it is resumed first.
    expect(write(copy('run-a12'), 'build', { id: ID, draftFile: `${NAME} (draft).xml` })).toMatchObject({ code: 1, stderr: expect.stringMatching(/draftFile is amendment 13's \(skillRevision 13\); this log is at 12: resume it first/) });
  });
});

// ---------------------------------------------------------------------------------------------------
// AC-W100, bullet 3: the runes over the budget (D-465)
// ---------------------------------------------------------------------------------------------------

describe('AC-W100 (D-465): a "Legacy of …" soul core or the Raven-Touched Shard only on the user\'s word', () => {
  const ROW = (status: string, piece = 'Legacy of Ashrend') => `| i1c-9 | ${piece} | rune | ${status} | ${status === 'out' ? '—' : 'Helmet'} | the culling strike | i1c-9 |`;
  it('a card row in or scheduled with "Legacy of Ashrend" fails without the brief\'s say, and passes with it or a gate answer naming it', () => {
    for (const status of ['in', 'scheduled']) {
      const dir = composite();
      addPiece(dir, 'r1-s-2', ROW(status));
      expect(lines(check(dir).stderr, 'runes')).toEqual([expect.stringMatching(new RegExp(`cards/r1-s-2\\.md:\\d+: the Pieces row "i1c-9" takes "Legacy of Ashrend" \\(${status}\\), a "Legacy of …" soul core, a rune over the budget, but neither the brief's around, like or notes nor a gate answer names it`))]);
    }
    const says: [string, (l: Json) => void][] = [
      ['around: "Legacy cores"', (l) => (l.brief.around = 'Legacy cores')],
      ['like', (l) => (l.brief.like = 'a slam build with Legacy of Ashrend')],
      ['notes', (l) => (l.brief.notes = 'Legacy soul cores are fine')],
      ["a gate answer's changes", (l) => (l.checkpoints[0].changes = { 'r1-s-1': 'put Legacy of Ashrend in the helmet' })],
    ];
    for (const [what, edit] of says) {
      const dir = composite();
      addPiece(dir, 'r1-s-2', ROW('in'));
      editJson(dir, 'run-log.json', edit);
      expect({ what, lines: lines(check(dir).stderr, 'runes') }).toEqual({ what, lines: [] });
    }
  });

  it('an out row passes; "Coward\'s Legacy" passes; a card dealt before the boundary isn\'t held', () => {
    const out1 = composite();
    addPiece(out1, 'r1-s-2', ROW('out'));
    expect(lines(check(out1).stderr, 'runes')).toEqual([]);
    const coward = composite();
    addPiece(coward, 'r1-s-2', ROW('in', "Coward's Legacy"));
    expect(lines(check(coward).stderr, 'runes')).toEqual([]);
    // A revision-12 log resumed now: its composites were dealt before 13's boundary.
    const old = composite(12);
    addPiece(old, 'r1-s-2', ROW('in'));
    expect(write(old, 'resume', { noNinja: false }).code).toBe(0);
    expect(readJson(old, 'run-log.json').skillRevision).toBe(13);
    expect(lines(check(old).stderr, 'runes')).toEqual([]);
  });

  it('a plan rune line "Raven-Touched Shard" fails likewise, and passes with the brief naming it', () => {
    const dir = copy('run-a13');
    replan(dir, (p) => {
      const h = stage(p, 'n').items.slots.find((x: Json) => x.slot === 'Helmet');
      h.text += '\nRune: Raven-Touched Shard';
    });
    expect(lines(check(dir).stderr, 'runes')).toEqual([expect.stringMatching(/plan\.json's stage n slot "Helmet" holds the rune line "Rune: Raven-Touched Shard", the Raven-Touched Shard, a rune over the budget/)]);
    editJson(dir, 'run-log.json', (l) => {
      l.brief.notes = 'take the Raven-Touched Shard for a second anoint';
    });
    expect(lines(check(dir).stderr, 'runes')).toEqual([]);
  });
});

// ---------------------------------------------------------------------------------------------------
// AC-W100, bullet 4: corruption (D-471)
// ---------------------------------------------------------------------------------------------------

describe('AC-W100 (D-471): corruption on cheap uniques and skill gems', () => {
  it('a rare item text with Corrupted fails; a unique with a corruption enchant on m fails', () => {
    const rare = copy('run-a13');
    replan(rare, (p) => {
      stage(p, 'n').items.slots.find((x: Json) => x.slot === 'Helmet').text += '\nCorrupted';
    });
    expect(lines(check(rare).stderr, 'corruption')).toEqual([expect.stringMatching(/plan\.json's stage n slot "Helmet" holds a corrupted rare item; corruption is only on cheap uniques and skill gems, never on a rare/)]);
    const m = copy('run-a13');
    replan(m, (p) => {
      stage(p, 'm').items.slots.find((x: Json) => x.slot === 'Ring 1').text = BOND;
    });
    expect(lines(check(m).stderr, 'corruption')).toEqual([expect.stringMatching(/stage m slot "Ring 1" holds Blistering Bond with a designed corruption \(25% increased Damage\) on a entering-maps rung; a designed corruption is on budget and non-budget only/)]);
  });

  it('on b priced at 0.9 divine passes, at 1 divine fails', () => {
    const at = (amount: number) => {
      const dir = copy('run-a13');
      replan(dir, (p) => {
        stage(p, 'b').items.slots.find((x: Json) => x.slot === 'Ring 2').text = BOND;
      });
      setPrice(dir, 'b-ring2', { status: 'ok', amount, currency: 'divine', note: 'priced uncorrupted: buy copies and corrupt until one rolls 25% increased Damage' });
      editText(dir, GUIDE, 'Move here once you own both rings.', 'Move here once you own both rings. Buy several Blistering Bond and corrupt them until one rolls 25% increased Damage.');
      return lines(check(dir).stderr, 'corruption');
    };
    expect(at(0.9)).toEqual([]);
    expect(at(1)).toEqual([expect.stringMatching(/stage b slot "Ring 2" holds Blistering Bond with a designed corruption, priced 1 divine\(s\) uncorrupted \(b-ring2\), at or over the cheap line of 1 divine/)]);
  });

  it("an unavailable price passes with the note 'cheapness unchecked: <why>' and fails without it (the offline note says it offline)", () => {
    // run-a13 is offline: its n Ring 2 price is "offline run", which says why the cheapness is unchecked.
    expect(lines(check(copy('run-a13')).stderr, 'corruption')).toEqual([]);
    const online = (note: string) => {
      const dir = copy('run-a13');
      editJson(dir, 'run-log.json', (l) => {
        l.mode = 'online';
      });
      setPrice(dir, 'n-ring2', { note });
      return lines(check(dir).stderr, 'corruption');
    };
    expect(online('cheapness unchecked: no listing of Blistering Bond on 2026-10-08')).toEqual([]);
    expect(online('offline run')).toEqual([expect.stringMatching(/its price entry n-ring2 is "unavailable" with the note "offline run"; with no price to judge by, the note says "cheapness unchecked: <why>"/)]);
  });

  it('a cheap unique jewel with a corruption passes; an always-corrupted unique (Split Personality) passes with no line', () => {
    const jewel = copy('run-a13');
    replan(jewel, (p) => {
      stage(p, 'b').items.treeJewels[0].text = SPECTRUM;
    });
    editText(jewel, GUIDE, 'Move here once you own both rings.', 'Move here once you own both rings. Buy several Grand Spectrum and corrupt them until one rolls +5 to Strength.');
    expect(lines(check(jewel).stderr, 'corruption')).toEqual([]);
    const split = copy('run-a13');
    replan(split, (p) => {
      stage(p, 'b').items.treeJewels[0].text = SPLIT;
    });
    expect(lines(check(split).stderr, 'corruption')).toEqual([]);
  });

  it("a plan with a corrupted unique or a corrupt gem whose guide lacks its line fails", () => {
    const unique = copy('run-a13');
    editText(unique, GUIDE, '- Buy several Blistering Bond and corrupt them until one rolls 25% increased Damage.\n', '');
    expect(lines(check(unique).stderr, 'corruption')).toEqual([expect.stringMatching(/guide\.md has no line for Blistering Bond's corruption on n: "Buy several Blistering Bond and corrupt them until one rolls <line>"/)]);
    const gem = copy('run-a13');
    editText(gem, GUIDE, '- Corrupt cheap low-level Blood Hunt gems until one gets +1 level, then level it to 20.', '');
    expect(lines(check(gem).stderr, 'corruption')).toEqual([expect.stringMatching(/guide\.md has no line for Blood Hunt's corruption on n: "Corrupt cheap low-level Blood Hunt gems until one gets \+1 level, then level it to 20"/)]);
  });

  it("a build before the boundary isn't held", () => {
    const dir = copy('run-a12');
    replan(dir, (p) => {
      stage(p, 'n').items.slots.find((x: Json) => x.slot === 'Helmet').text += '\nCorrupted';
      stage(p, 'm').items.slots.find((x: Json) => x.slot === 'Ring 1').text = BOND;
    });
    expect(lines(check(dir).stderr, 'corruption')).toEqual([]);
  });
});

// ---------------------------------------------------------------------------------------------------
// AC-W100, bullets 5 and 6: flasks and charms (D-472), the pinned weapon (D-464)
// ---------------------------------------------------------------------------------------------------

describe('AC-W100 (D-472, D-464): flasks unpriced, charm slots empty, the pinned weapon priced once', () => {
  it('an unpriced Flask slot passes; a filled Charm slot fails; an endgame rung without a life flask fails', () => {
    const dir = copy('run-a13');
    expect(readJson(dir, GATE).basis.budget.slots.some((x: Json) => /^Flask/.test(x.slot ?? ''))).toBe(false);
    expect(lines(check(dir).stderr, 'budget')).toEqual([]);
    replan(dir, (p) => {
      stage(p, 'n').items.slots.push({ slot: 'Charm 1', text: 'Rarity: Normal\nGolden Charm' });
      stage(p, 'b').items.slots = stage(p, 'b').items.slots.filter((x: Json) => x.slot !== 'Flask 1');
    });
    expect(lines(check(dir).stderr, 'flasks')).toEqual([
      expect.stringMatching(/plan\.json's endgame rung b has no Flask 1; every endgame rung carries a life flask in Flask 1/),
      expect.stringMatching(/plan\.json's stage n fills "Charm 1"; the charm slots stay empty for now/),
    ]);
    // A mana flask in Flask 1 is no life flask.
    const mana = copy('run-a13');
    replan(mana, (p) => {
      stage(p, 'm').items.slots.find((x: Json) => x.slot === 'Flask 1').text = 'Rarity: Normal\nUltimate Mana Flask';
    });
    expect(lines(check(mana).stderr, 'flasks')).toEqual([expect.stringMatching(/endgame rung m has "Ultimate Mana Flask" in Flask 1/)]);
  });

  it("a build before the boundary isn't held: an unpriced flask fails as before, a charm passes the flask rules", () => {
    const dir = copy('run-a12');
    replan(dir, (p) => {
      stage(p, 'n').items.slots.push({ slot: 'Charm 1', text: 'Rarity: Normal\nGolden Charm' }, { slot: 'Flask 1', text: 'Rarity: Normal\nUltimate Life Flask' });
    });
    const stderr = check(dir).stderr;
    expect(lines(stderr, 'flasks')).toEqual([]);
    expect(lines(stderr, 'budget')).toEqual(expect.arrayContaining([expect.stringMatching(/stage n's filled slot "Flask 1" maps to no prices\[\] entry/)]));
  });

  it("a sameAs slot maps to its set-1 slot's entry, and rungBudget counts it once", () => {
    const dir = copy('run-a13');
    replan(dir, (p) => {
      stage(p, 'b').items.slots.push({ slot: 'Weapon 1 Swap', sameAs: 'Weapon 1' });
    });
    expect(lines(check(dir).stderr, 'budget')).toEqual([]);
    // The gate may map it to the set-1 slot's entry; another entry fails.
    editJson(dir, GATE, (g) => {
      g.basis.budget.slots.push({ stage: 'b', slot: 'Weapon 1 Swap', priceId: 'b-body' });
    });
    expect(lines(check(dir).stderr, 'budget')).toEqual([expect.stringMatching(/stage b's slot "Weapon 1 Swap" holds the item of "Weapon 1" \(sameAs\), but the gate maps it to "b-body", not "Weapon 1"'s "b-weapon"/)]);
    const r = nodeModule(`
      import { rungBudget, priceTable } from ${JSON.stringify(path.join(SCRIPTS, 'render-audit.mjs'))};
      const plan = { league: null, prices: [{ id: 'w', status: 'ok', amount: 2, currency: 'divine', date: '2026-10-08' }, { id: 'f', status: 'ok', amount: 1, currency: 'divine', date: '2026-10-08' }] };
      const stage = { id: 'b', variant: 'budget', items: { slots: [{ slot: 'Weapon 1', text: 'x' }, { slot: 'Weapon 1 Swap', sameAs: 'Weapon 1' }, { slot: 'Flask 1', text: 'y' }] } };
      const market = { league: null, day: null, late: false };
      const once = { rates: [], slots: [{ stage: 'b', slot: 'Weapon 1', priceId: 'w' }] };
      const both = { rates: [], slots: [{ stage: 'b', slot: 'Weapon 1', priceId: 'w' }, { stage: 'b', slot: 'Weapon 1 Swap', priceId: 'w' }, { stage: 'b', slot: 'Flask 1', priceId: 'f' }] };
      const t = priceTable();
      console.log(JSON.stringify([rungBudget(stage, plan, once, market, t).total, rungBudget(stage, plan, both, market, t, { flasksUnpriced: true }).total, rungBudget(stage, plan, both, market, t).total.low > rungBudget(stage, plan, once, market, t).total.low]));
    `);
    const [once, both, flaskCounts] = JSON.parse(r.stdout) as [Json, Json, boolean];
    expect(both).toEqual(once);
    expect(flaskCounts).toBe(true);
  });
});

// ---------------------------------------------------------------------------------------------------
// AC-W100, bullet 7: the design display and the design field (D-467, D-468, D-473)
// ---------------------------------------------------------------------------------------------------

describe("AC-W100 (D-467, D-468, D-473): the design field's tree search and boss target, and the design display", () => {
  it("prints, from the design field alone, each boss entry's figures, the boss figure, the fall's reason, the boss trade, the swap cap, the rebuild undone, Life, the removed and skill-level lines and the draft", () => {
    const dir = copy('run-a13');
    expect(write(dir, 'build', { id: ID, draftFile: `${NAME} (draft).xml` }).code).toBe(0);
    editJson(dir, GATE, (g) => {
      rung(g, 'n').boss.entries.push({ label: 'Herald of Blood', start: 300, end: 290, final: 290, valuedBy: { figure: 6, reason: 'the buff' } });
    });
    const shown = out(display(dir, 'design', ID).stdout);
    for (const line of [
      `- Draft PoB file: ${NAME} (draft).xml, in your builds list.`,
      '- Boss rotation on n: 220,000 → 210,000 on the tree, 210,000 at the gate (floor 250,000). Blood Hunt 220,000 → 210,000 (−5%) → 210,000, Herald of Blood 300 → 290 → 290 (valued by the buff: +6% to the rotation, the designer): Blood Hunt gives up 5% against a boss for 9% more against map monsters, which the build is judged on (the designer).',
      '- Boss rotation on b: 58,000 → 60,000 on the tree, 60,000 at the gate. Blood Hunt 58,000 → 60,000 → 60,000.',
      "- Boss trade on n: keep the start's two bleed notables (remove 2, add 2): boss 210,000 → 221,000, damage −4%, EHP +0%.",
      '- Life on n: 5,750 → 5,600 (EHP and the lowest max hit held their start).',
      '- Swap cap on b: 30 swaps, the last +1.4%.',
      '- Rebuild undone on m: the compile refused it (attributes).',
      '- Removed on n: Herald Damage (2 notables): lines for Herald of Blood.',
      '- Skill levels on n: Blood Hunt +0.',
    ]) expect(shown).toContain(line);
    expect(shown.filter((l) => /^- Swap cap on /.test(l))).toEqual(['- Swap cap on b: 30 swaps, the last +1.4%.']);
  });

  it("a design field whose figures disagree with the plan's tree.start and tree.end, or the record, fails", () => {
    const plan = copy('run-a13');
    replan(plan, (p) => {
      stage(p, 'n').tree.start.boss = 225000;
      stage(p, 'b').tree.end.life = 4100;
    });
    expect(lines(check(plan).stderr, 'design-field')).toEqual([
      expect.stringMatching(/design\.rungs's "b" disagrees with plan\.json's b tree\.start, tree\.end and tree\.search, or the record: life \{"start":4300,"end":4200\} against Life 4300 → 4100/),
      expect.stringMatching(/design\.rungs's "n" disagrees .*: boss 220000 → 210000 against 225000 → 210000/),
    ]);
    const record = copy('run-a13');
    editJson(record, GATE, (g) => {
      rung(g, 'b').boss.entries[0].final = 61000;
      rung(g, 'm').swapCap = { swaps: 2, lastGain: 0.6 };
    });
    expect(lines(check(record).stderr, 'design-field')).toEqual([
      expect.stringMatching(/design\.rungs's "m" disagrees .*: swapCap \{"swaps":2,"lastGain":0\.6\} against tree\.search's null \(capHit false\)/),
      expect.stringMatching(/design\.rungs's "b" disagrees .*: Blood Hunt's final 61000 against the record's b\.measures\.bossGroups figure 60000/),
    ]);
  });

  it('a fall from start to end with bossFall null fails; a boss fall with no boss trade fails; a boss trade with bossAfter passes', () => {
    passes(copy('run-a13'));
    const reason = copy('run-a13');
    replan(reason, (p) => {
      stage(p, 'n').tree.search.bossFall = null;
      // b's boss figure rose, but its one entry fell.
      stage(p, 'b').tree.end.bossEntries[0].figure = 57000;
    });
    editJson(reason, GATE, (g) => {
      rung(g, 'n').boss.bossFall = null;
      rung(g, 'b').boss.entries[0].end = 57000;
    });
    expect(lines(check(reason).stderr, 'boss-fall')).toEqual([
      expect.stringMatching(/on b Blood Hunt fell, but bossFall is null; the designer says why a fall is fine/),
      expect.stringMatching(/on n the boss figure fell from 220,000 to 210,000 on the tree, and Blood Hunt fell, but bossFall is null/),
    ]);
    const trade = copy('run-a13');
    editJson(trade, TRADES, (t) => {
      t.trades = t.trades.filter((x: Json) => x.kind !== 'boss');
    });
    editJson(trade, GATE, (g) => {
      rung(g, 'n').trades = rung(g, 'n').trades.filter((x: Json) => x.kind !== 'boss');
    });
    expect(lines(check(trade).stderr, 'trades')).toEqual([expect.stringMatching(/on n the boss figure fell from 220,000 to 210,000 on the tree, but no boss trade is shown for it/)]);
    // A bossFall naming a claim the plan doesn't hold fails.
    const claim = copy('run-a13');
    replan(claim, (p) => {
      stage(p, 'n').claims = stage(p, 'n').claims.filter((c: Json) => c.id !== 'boss-fall-n');
    });
    expect(lines(check(claim).stderr, 'boss-fall')).toEqual([expect.stringMatching(/boss\.bossFall names the claim boss-fall-n, but plan\.json's n holds no claim of that id/)]);
  });

  it("an n whose tree.end boss figure is under the floor while its start's was at or above it fails", () => {
    const dir = copy('run-a13');
    replan(dir, (p) => {
      stage(p, 'n').tree.start.boss = 260000;
      stage(p, 'n').tree.start.bossEntries[0].figure = 260000;
    });
    editJson(dir, GATE, (g) => {
      Object.assign(rung(g, 'n').boss, { start: 260000 });
      rung(g, 'n').boss.entries[0].start = 260000;
    });
    expect(lines(check(dir).stderr, 'boss-floor')).toEqual([expect.stringMatching(/on n D1-tree's tree takes the boss figure from 260,000 to 210,000, under the 250,000 floor; a change of D1-tree's own that takes n's boss figure under the floor is undone/)]);
  });

  it('an n under the floor at the gate with no damage or boss trade fails (D-448, kept); a boss trade alone answers the floor', () => {
    // n within its band, so only the floor asks for a trade.
    const within = (trades: (t: Json) => boolean) => {
      const dir = copy('run-a13');
      editJson(dir, RECORD, (r) => {
        r.stages.n.outputs.TotalEHP = 25000;
        r.stages.n.measures.ehp = 25000;
      });
      editJson(dir, TRADES, (t) => {
        t.trades = t.trades.filter(trades);
      });
      editJson(dir, GATE, (g) => {
        Object.assign(rung(g, 'n'), { ehp: 25000 });
        rung(g, 'n').toughness.band = 'within';
        rung(g, 'n').trades = rung(g, 'n').trades.filter(trades);
      });
      return lines(check(dir).stderr, 'trades').filter((l) => /under the boss floor/.test(l));
    };
    expect(within(() => false)).toEqual([expect.stringMatching(/the non-budget rung n is under the boss floor at the gate, but no damage or boss trade is shown for it/)]);
    expect(within((t) => t.kind === 'boss')).toEqual([]);
    expect(within((t) => t.kind === 'damage')).toEqual([]);
  });

  it('an n under its toughness band shows the best damage move beside its defence trade', () => {
    const under = (kinds: string[]) => {
      const dir = copy('run-a13');
      const defence = { stage: 'n', kind: 'defence', what: 'none found: no slot can roll more life', ehpChange: null, damageChange: null, bossAfter: null, reason: 'under the toughness band', maxHit: null, hitsSurvived: null, bossEntries: null, nodes: null };
      editJson(dir, RECORD, (r) => {
        r.stages.n.outputs.TotalEHP = 15000;
        r.stages.n.measures.ehp = 15000;
      });
      const keep = (t: Json) => kinds.includes(t.kind);
      editJson(dir, TRADES, (t) => {
        t.trades = [...t.trades.filter(keep), defence];
      });
      editJson(dir, GATE, (g) => {
        Object.assign(rung(g, 'n'), { ehp: 15000 });
        rung(g, 'n').toughness.band = 'under';
        rung(g, 'n').trades = [...rung(g, 'n').trades.filter(keep), defence];
      });
      return lines(check(dir).stderr, 'trades').filter((l) => /toughness band/.test(l));
    };
    expect(under(['boss'])).toEqual([expect.stringMatching(/the non-budget rung n is under its toughness band, but no damage trade is shown for it: beside the defence trades the gate shows the best damage move/)]);
    expect(under(['boss', 'damage'])).toEqual([]);
  });
});

// ---------------------------------------------------------------------------------------------------
// AC-W100, bullets 8 to 10: F1's draftLeft, stale-server, the pace stop, trades.json
// ---------------------------------------------------------------------------------------------------

describe("AC-W100 (D-466, D-467, D-474, Appendix A): F1's draftLeft, D1-tree's stale-server, the pace stop, trades.json's kinds", () => {
  it("the final display prints F1's draftLeft when set, and nothing when null", () => {
    const dir = copy('run-a13');
    expect(out(display(copyOf(dir), 'final', ID).stdout).filter((l) => /draft/i.test(l))).toEqual([]);
    editJson(dir, F1, (v) => {
      v.draftLeft = `${NAME} (draft).xml`;
    });
    passes(dir);
    expect(out(display(copyOf(dir), 'final', ID).stdout)).toContain(`Your draft PoB file stays: ${NAME} (draft).xml, which F1 didn't remove: it changed on disk, or this build didn't write it.`);
    editJson(dir, F1, (v) => {
      v.draftLeft = '';
    });
    expect(lines(check(dir).stderr, 'gate-report')).toEqual([expect.stringMatching(/F1-r1-a-2-a1\.json: draftLeft is ""; the draft F1 couldn't remove/)]);
  });

  it("the run log accepts D1-tree's stale-server, then D1-tree again; D1-finish after it fails", () => {
    const dir = copy('run-a13');
    const stale = { stage: 'D1-tree', concept: ID, attempt: 1, outcome: 'stale-server' };
    editJson(dir, 'run-log.json', (l) => {
      l.stages.splice(8, 1, stale, { ...l.stages[8], attempt: 2 });
    });
    passes(dir);
    const fresh = path.join(TMP, `log-${++copies}`);
    fs.mkdirSync(fresh);
    expect(write(fresh, 'init', { slug: 'titan-blood-hunt', brief: { ascendancy: 'Titan', skill: 'Blood Hunt' }, mode: 'offline', testConfig: 'none', noNinja: false }).code).toBe(0);
    expect(write(fresh, 'stage', stale)).toMatchObject({ code: 0 });
    const skipped = copy('run-a13');
    editJson(skipped, 'run-log.json', (l) => {
      l.stages.splice(8, 1, stale);
    });
    expect(lines(check(skipped).stderr, 'order')).toContainEqual(expect.stringMatching(/stages\[9\] \(D1-finish r1-a-2 attempt 1\): can't follow D1-tree r1-a-2 attempt 1 \(outcome "stale-server"\); SKILL\.md's step list allows D1-tree next/));
  });

  it('a pricing stop pace is recorded like rate_limited, and the run log\'s stop list accepts it', () => {
    const fresh = path.join(TMP, `log-${++copies}`);
    fs.mkdirSync(fresh);
    expect(write(fresh, 'init', { slug: 'titan-blood-hunt', brief: { ascendancy: 'Titan', skill: 'Blood Hunt' }, mode: 'online', testConfig: 'none', noNinja: false }).code).toBe(0);
    expect(write(fresh, 'stage', { stage: 'D1-finish', concept: ID, attempt: 1, outcome: 'done', priceOutcomes: { pace: 1 } })).toEqual({ code: 0, stdout: 'run-log: wrote stages[0], and pricing.stops[0]: trade-site pricing stopped after pace until a gate\'s retry-pricing (D-444)\n', stderr: '' });
    expect(readJson(fresh, 'run-log.json').pricing.stops).toEqual([{ at: 0, step: 'D1-finish', outcome: 'pace' }]);
    // The checker: an online run's D1-finish that stopped on the pace line, with its stop; then a step under the open stop.
    const dir = copy('run-a13');
    editJson(dir, 'run-log.json', (l) => {
      l.mode = 'online';
      l.stages[9].priceOutcomes = { ok: 2, pace: 1 };
      l.pricing.stops = [{ at: 9, step: 'D1-finish', outcome: 'pace' }];
    });
    const ok = check(dir).stderr;
    expect([...lines(ok, 'pricing'), ...lines(ok, 'run-log')]).toEqual([]);
    editJson(dir, 'run-log.json', (l) => {
      l.stages[10].priceOutcomes = { ok: 1 };
    });
    expect(lines(check(dir).stderr, 'pricing')).toEqual([expect.stringMatching(/stages\[10\] \(D1-gate r1-a-2 attempt 1\) makes 1 trade-site price call\(s\) \(ok 1\), but pricing stopped at stages\[9\] \(D1-finish, pace\)/)]);
    editJson(dir, 'run-log.json', (l) => {
      l.pricing.stops = [];
      delete l.stages[10].priceOutcomes;
    });
    expect(lines(check(dir).stderr, 'pricing')).toEqual([expect.stringMatching(/stages\[9\] \(D1-finish r1-a-2 attempt 1\) counts a pace call, but pricing\.stops records no stop at stages\[9\]/)]);
  });

  it("trades.json's kind boss with its fields passes; one without them fails; a revision-12 build's trades keep their 9 fields", () => {
    passes(copy('run-a13'));
    const broken: [string, (t: Json) => void, RegExp][] = [
      ['no bossAfter', (t) => (t.bossAfter = null), /is a boss trade with bossAfter null; it carries the alternative tree's boss figure/],
      ['no entries', (t) => (t.bossEntries = []), /is a boss trade with bossEntries \[\]; it lists each boss-rotation entry's figure/],
      ['no nodes', (t) => (t.nodes = { remove: [1009] }), /is a boss trade with nodes \{"remove":\[1009\]\}; it names the nodes to remove and add/],
    ];
    for (const [what, edit, want] of broken) {
      const dir = copy('run-a13');
      editJson(dir, TRADES, (f) => edit(f.trades.find((x: Json) => x.kind === 'boss')));
      expect({ what, lines: lines(check(dir).stderr, 'trades').filter((l) => /^check-run: \[trades\] builds\/r1-a-2: trades\.json/.test(l)) }).toEqual({ what, lines: [expect.stringMatching(want)] });
    }
    const nine = copy('run-a13');
    editJson(nine, TRADES, (f) => {
      delete f.trades[0].bossEntries;
      delete f.trades[0].nodes;
      f.trades[1].kind = 'damage';
    });
    expect(lines(check(nine).stderr, 'trades')).toEqual(expect.arrayContaining([
      expect.stringMatching(/trades\.json's trades\[0\] is .*; a trade is \{stage, kind, what, ehpChange, damageChange, bossAfter, reason, maxHit, hitsSurvived, bossEntries, nodes\} in a build held to revision 13/),
      expect.stringMatching(/trades\.json's trades\[1\] is a damage trade with bossEntries .* and nodes .*; only a boss trade carries them/),
    ]));
    passes(copy('run-a12'));
  });
});

// ---------------------------------------------------------------------------------------------------
// AC-W100, bullets 11 to 13: the checker's fixes, M-25's leftovers, the revision
// ---------------------------------------------------------------------------------------------------

describe("AC-W100 (D-474, §15, §22): the checker's fixes, M-25's leftovers, skillRevision 13", () => {
  it("[markers] ignores `[^|]` in a code span; a definition with two data refs joined by '; ' passes [source-tags]; a Pieces row of kind anoint passes", () => {
    const dir = copy('run-a13');
    editText(dir, 'research/p1-r1a-1.md', 'Players pair it with bleed supports.[^m2]', 'Players pair it with bleed supports.[^m2] A regex like `[^|]` stays text, and the area level is cited.[^m3]');
    fs.appendFileSync(path.join(dir, 'research/p1-r1a-1.md'), '[^m3]: data | enemies/waystones.json#area-level.max; data | enemies/waystones.json#area-level.offset\n');
    passes(dir);
    editText(dir, 'research/p1-r1a-1.md', 'data | enemies/waystones.json#area-level.offset', 'data | enemies/waystones.json#no-such-fact');
    expect(lines(check(dir).stderr, 'markers')).toEqual([expect.stringMatching(/research\/p1-r1a-1\.md:\d+ \[\^m3\]: data enemies\/waystones\.json#no-such-fact names no C1\/E1 fact/)]);
    expect(lines(check(dir).stderr, 'source-tags')).toEqual([]);
    const anoint = composite();
    addPiece(anoint, 'r1-s-2', '| i1c-9 | Unbending | anoint | in | the amulet | armour where the tree has none | i1c-9 |');
    expect(lines(check(anoint).stderr, 'pieces')).toEqual([]);
  });

  it("a rung with an Arbiter row that has no verdict fails a design field reading 'survives'", () => {
    const dir = copy('run-a13');
    editJson(dir, RECORD, (r) => {
      const a = r.stages.n.measures.arbiter;
      a.verdict = null;
      Object.assign(a.rows[1], { ratio: null, maxHit: null, verdict: null, hitsSurvived: null });
    });
    expect(lines(check(dir).stderr, 'arbiter')).toEqual([expect.stringMatching(/design\.rungs's "n"'s maxHit\.arbiter is the "physical" row, so the design field reads as surviving the Arbiter's hits, but the record's "lightning" row has no verdict \(PoB gave no max hit for that type\): the rung isn't measured against the Arbiter, and its maxHit\.arbiter is null/)]);
    editJson(dir, GATE, (g) => {
      rung(g, 'n').maxHit.arbiter = null;
    });
    expect(lines(check(dir).stderr, 'arbiter')).toEqual([]);
    expect(out(display(copyOf(dir), 'design', ID).stdout)).toContain('- The Arbiter of Divinity: not measured.');
  });

  it("a failure message prints a percentage to one decimal place: 60.0%, not 59.980000000000004%", () => {
    const dir = copy('run-a13');
    editJson(dir, RECORD, (r) => {
      const a = r.stages.n.measures.arbiter;
      Object.assign(a, { verdict: 'one-shot', avoid: { accuracy: 3786, evade: 54, deflect: 13, deflectEffect: 40, method: 'pass' } });
      Object.assign(a.rows[0], { ratio: 1.098, maxHit: 3175, verdict: 'one-shot', deflectedRatio: 0.659, deflectedVerdict: 'survives', hitsSurvived: 59.980000000000004 });
    });
    editJson(dir, GATE, (g) => {
      rung(g, 'n').maxHit.arbiter = { type: 'physical', evade: 54, deflect: 13, hitsSurvived: 59.980000000000004, deflectedRatio: 0.659, method: 'pass' };
      rung(g, 'n').maxHit.oneShot = false;
    });
    const arbiter = lines(check(dir).stderr, 'arbiter');
    expect(arbiter).toContainEqual(expect.stringMatching(/maxHit\.oneShot is false, but the record's deciding row \(physical\) is one-shot by its full hit and survives 60\.0% of its hits, under the 80% floor/));
    expect(arbiter.join('\n')).not.toMatch(/59\.98/);
  });

  it('init writes skillRevision 13; a resume of a revision-12 log stamps 13 with its boundary', () => {
    const dir = path.join(TMP, `log-${++copies}`);
    fs.mkdirSync(dir);
    expect(write(dir, 'init', { slug: 'titan-blood-hunt', brief: { ascendancy: 'Titan', skill: 'Blood Hunt' }, mode: 'offline', testConfig: 'none', noNinja: false }).code).toBe(0);
    expect(readJson(dir, 'run-log.json')).toMatchObject({ skillRevision: 13, builds: [] });
    expect(readJson(dir, 'run-log.json')).not.toHaveProperty('skillRevisionFrom');
    const old = copy('run-a12');
    const before = readJson(old, 'run-log.json');
    expect(write(old, 'resume', { noNinja: false })).toEqual({ code: 0, stdout: `run-log: wrote resumes[0], status running, skillRevision 13 from stages[${before.stages.length}]\n`, stderr: '' });
    const log = readJson(old, 'run-log.json');
    expect(log.skillRevision).toBe(13);
    expect(log.skillRevisionFrom).toEqual({ 13: log.resumes[0].lengths });
    expect(check(old).stderr).toBe('');
  });
});

// ---------------------------------------------------------------------------------------------------
// AC-W100, bullet 14: a file-only build's claims pass (D-477)
// ---------------------------------------------------------------------------------------------------

/** A claims pass's report, `# V4-<n>: claims pass`, with its findings (none, or the given ones). */
function claimsReport(n: number, findings: string[] = []): string {
  return [
    `# V4-${n}: claims pass`, '', '- check: claims', `- concept: ${ID}`, '- mode: offline', `- verdict: ${findings.length > 0 ? 'fail' : 'pass'}`, '',
    '## Checked', '', '- claim stages[2].claims[2] (boss-fall-n)', '', '## Findings', '', ...(findings.length > 0 ? findings : ['None.']), '',
  ].join('\n');
}
const FINDING = (status: string) => [
  '### v4-1-1', '', `- status: ${status}`, '- hinge: yes', '- owner: D1', '- artifact: plan.json', '- location: stages[2].claims[2]', '- claim: boss-fall-n',
  '- issue: the claim gives the start as about 220,000, but tree.start holds 220,000 and the claim omits the end', '- evidence: plan.json stages[2].tree.start.boss',
  ...(status === 'unresolved' ? ['- reader: The boss figure falls on the finished tree; the guide has none to say so.'] : []),
].join('\n');
/**
 * run-a13 as a file-only build: the design gate's accept:file, F1's pass, then `after` (each step's attempt its own); no
 * guide, audit or full pass; the build ended file-only and the run completed.
 */
function fileOnly(after: Json[], reports: Record<number, string> = {}): string {
  const dir = copy('run-a13');
  editJson(dir, 'run-log.json', (l) => {
    l.stages = [...l.stages.slice(0, 12), ...after.map((s) => ({ concept: ID, attempt: 1, ...s }))];
    l.checkpoints = l.checkpoints.slice(0, 3);
    l.checkpoints[2].answer = 'accept:file';
    l.displays = l.displays.slice(0, 3);
    Object.assign(l.builds[0], { status: 'file-only', guide: null });
  });
  for (const f of ['guide.md', 'audit.md', 'reports/V4-1.md']) fs.rmSync(path.join(dir, BUILD, f));
  for (const [n, text] of Object.entries(reports)) fs.writeFileSync(path.join(dir, BUILD, 'reports', `V4-${n}.md`), text);
  return dir;
}
const SNAPSHOT = (dir: string, n: number) => node(CHECKER, [dir, '--snapshot', String(n), '--build', ID]);

describe('AC-W100 (D-477): a file-only build held to revision 13 has its claims pass', () => {
  it('passes with F1 → V4-claims (pass) → its end', () => {
    passes(fileOnly([{ stage: 'V4-claims', outcome: 'pass' }], { 1: claimsReport(1) }));
  });

  it('passes with F1 → V4-claims (fail) → the round copy → D1-finish (claims-edited) → V4-recheck → its end', () => {
    const dir = fileOnly([{ stage: 'V4-claims', outcome: 'fail' }, { stage: 'D1-finish', attempt: 2, outcome: 'claims-edited' }, { stage: 'V4-recheck', outcome: 'pass' }], { 1: claimsReport(1, [FINDING('unresolved')]) });
    // The round copy of a build with no guide: the plan and the record.
    const snap = SNAPSHOT(dir, 1);
    expect(snap).toEqual({ code: 0, stdout: `check-run: copied ${BUILD}/plan.json, ${BUILD}/compile-record.json to ${BUILD}/rounds/1/\n`, stderr: '' });
    expect(fs.readdirSync(path.join(dir, BUILD, 'rounds', '1')).sort()).toEqual(['compile-record.json', 'plan.json']);
    // D1 edits the claim in place, compiling nothing.
    editJson(dir, PLAN, (p) => {
      stage(p, 'n').claims.find((c: Json) => c.id === 'boss-fall-n').text = 'Blood Hunt falls from about 220,000 to 210,000 against a boss on the finished tree.';
    });
    // --changed prints claim lines only.
    expect(node(CHECKER, [dir, '--changed', '1', '--build', ID])).toEqual({ code: 0, stdout: 'claim stages[2].claims[2] (boss-fall-n)\n', stderr: '' });
    const recheck = claimsReport(2, [FINDING('fixed')]).replace('# V4-2: claims pass', '# V4-2: re-check of rounds/1').replace('- check: claims', '- check: recheck').replace('- verdict: fail', '- verdict: pass');
    fs.writeFileSync(path.join(dir, BUILD, 'reports', 'V4-2.md'), recheck);
    passes(dir);
  });

  it('passes with a recompile in its round: V4-claims (fail) → D1-finish → the D1 gate → F1, no design gate → V4-recheck → its end', () => {
    const st = (stage: string, attempt: number, outcome: string): Json => ({ stage, attempt, outcome });
    const dir = fileOnly([st('V4-claims', 1, 'fail'), st('D1-finish', 2, 'done'), st('D1-gate', 2, 'pass'), st('F1', 2, 'pass'), st('V4-recheck', 1, 'pass')], { 1: claimsReport(1, [FINDING('unresolved')]) });
    for (const g of ['D1-gate', 'F1']) {
      fs.copyFileSync(path.join(dir, `reports/gates/${g}-${ID}-a1.json`), path.join(dir, `reports/gates/${g}-${ID}-a2.json`));
      editJson(dir, `reports/gates/${g}-${ID}-a2.json`, (v) => {
        v.attempt = 2;
      });
    }
    expect(SNAPSHOT(dir, 1).code).toBe(0);
    const recheck = claimsReport(2, [FINDING('fixed')]).replace('# V4-2: claims pass', '# V4-2: re-check of rounds/1').replace('- check: claims', '- check: recheck').replace('- verdict: fail', '- verdict: pass');
    fs.writeFileSync(path.join(dir, BUILD, 'reports', 'V4-2.md'), recheck);
    passes(dir);
    // The claims pass's findings are the plan's, owned by D1.
    editText(dir, `${BUILD}/reports/V4-1.md`, '- owner: D1', '- owner: W1');
    expect(lines(check(dir).stderr, 'report-shape')).toEqual([expect.stringMatching(/V4-1\.md: finding v4-1-1 \(line \d+\) is owned by "W1" in "plan\.json"; a claims pass's findings are the plan's \(plan\.json\), owned by D1/)]);
  });

  it('fails with no V4-claims entry, with a V4-claims entry and no report, and with a full V4 pass in its place', () => {
    const none = check(fileOnly([])).stderr;
    expect(lines(none, 'verification')).toEqual([expect.stringMatching(/builds\[\] r1-a-2 ended file-only, but run-log\.json logs no V4-claims entry for it: a file-only build held to amendment 13 has its claims pass after F1's pass/)]);
    expect(lines(none, 'run-log')).toContainEqual(expect.stringMatching(/builds\[\] r1-a-2's status is "file-only", but the run log's steps and answers leave it in progress/));
    const noReport = check(fileOnly([{ stage: 'V4-claims', outcome: 'pass' }])).stderr;
    expect(lines(noReport, 'reports')).toEqual([expect.stringMatching(/run-log\.json logs 1 V4 pass\(es\) \(V4, V4-recheck, V4-campaign and V4-claims\), but reports\/ holds 0 V4 report\(s\)/)]);
    const full = fileOnly([{ stage: 'V4', outcome: 'pass' }], { 1: claimsReport(1).replace('claims pass', 'full pass').replace('- check: claims', '- check: full') });
    const fullErr = check(full).stderr;
    expect(lines(fullErr, 'order')).toContainEqual(expect.stringMatching(/stages\[12\] \(V4 r1-a-2 attempt 1\): can't follow F1 r1-a-2 attempt 1 \(outcome "pass"\); SKILL\.md's step list allows V4-claims next/));
    expect(lines(fullErr, 'verification')).toContainEqual(expect.stringMatching(/logs no V4-claims entry for it/));
  });

  it('a V4-claims entry for a build accepted with its guide fails, as one after W1 does', () => {
    const dir = copy('run-a13');
    editJson(dir, 'run-log.json', (l) => {
      l.stages.splice(12, 0, { stage: 'V4-claims', concept: ID, attempt: 1, outcome: 'pass' });
    });
    fs.renameSync(path.join(dir, BUILD, 'reports', 'V4-1.md'), path.join(dir, BUILD, 'reports', 'V4-2.md'));
    editText(dir, `${BUILD}/reports/V4-2.md`, '# V4-1: full pass', '# V4-2: full pass');
    fs.writeFileSync(path.join(dir, BUILD, 'reports', 'V4-1.md'), claimsReport(1));
    expect(lines(check(dir).stderr, 'verification')).toEqual([expect.stringMatching(/stages\[12\] \(V4-claims r1-a-2 attempt 1\): runs a claims pass \(V4-claims\), which a file-only build held to amendment 13 runs once, after F1's pass following the design gate's accept:file/)]);
  });

  it("a later guide:<id> runs W1 and a full pass numbered after the claims pass's reports, and passes", () => {
    const dir = fileOnly([{ stage: 'V4-claims', outcome: 'pass' }], { 1: claimsReport(1) });
    expect(write(dir, 'resume', { noNinja: false }).code).toBe(0);
    expect(display(dir, 'verification').code).toBe(0);
    expect(write(dir, 'checkpoint', { checkpoint: 'verification', visit: 2, answer: `guide:${ID}`, answeredBy: 'user', questions: 0 }).code).toBe(0);
    expect(write(dir, 'stage', { stage: 'W1', concept: ID, attempt: 1, outcome: 'done' }).code).toBe(0);
    expect(write(dir, 'build', { id: ID, status: 'writing', guide: 'endgame' }).code).toBe(0);
    for (const f of ['guide.md', 'audit.md']) fs.copyFileSync(path.join(FIXTURES, 'run-a13', BUILD, f), path.join(dir, BUILD, f));
    expect(write(dir, 'stage', { stage: 'V4', concept: ID, attempt: 1, outcome: 'pass' }).code).toBe(0);
    const fullPass = fs.readFileSync(path.join(FIXTURES, 'run-a13', BUILD, 'reports', 'V4-1.md'), 'utf8').replace('# V4-1: full pass', '# V4-2: full pass');
    fs.writeFileSync(path.join(dir, BUILD, 'reports', 'V4-2.md'), fullPass);
    expect(display(dir, 'final', ID).code).toBe(0);
    expect(write(dir, 'checkpoint', { checkpoint: 'final', concept: ID, visit: 1, answer: 'accept', answeredBy: 'user', questions: 0 }).code).toBe(0);
    expect(write(dir, 'build', { id: ID, status: 'completed' }).code).toBe(0);
    expect(write(dir, 'set', { status: 'completed' }).code).toBe(0);
    passes(dir);
  });

  it('a file-only build before the boundary passes with no V4-claims entry', () => {
    const dir = copy('run-a12');
    editJson(dir, 'run-log.json', (l) => {
      l.stages = l.stages.slice(0, 12);
      l.checkpoints = l.checkpoints.slice(0, 3);
      l.checkpoints[2].answer = 'accept:file';
      l.displays = l.displays.slice(0, 3);
      Object.assign(l.builds[0], { status: 'file-only', guide: null });
    });
    for (const f of ['guide.md', 'audit.md', 'reports/V4-1.md']) fs.rmSync(path.join(dir, BUILD, f));
    passes(dir);
    // Stamped 13 by a resume after it ended, its build is still held to its own revision.
    expect(write(dir, 'resume', { noNinja: false }).code).toBe(0);
    passes(dir);
  });
});
