/**
 * AC-W73 (WU-89, amendment 8: D-400…D-408): the skill's three scripts on fixture runs, each spawned as a real `node`
 * process with an explicit env.
 *
 * The fixture is `tests/fixtures/pipeline/run-rival`, a run in amendment 8's formats stopped at its first verification
 * gate: nine dealt cards, each deck line with its `engine: <family> from <family>`, the obvious card's `Obvious
 * build:`, a card that waits on the pin, three picked cards (one ends `not-in-pin`, no compile) plus the rival
 * `r1-x-1` with its RV step and the second R1b-assemble pass, the structure checks, WU-88's pace measures on the
 * skeletons and the dossier's Clear speed column.
 *
 * Its research files cite Markdown data files, `data | league/fixture-league.md#crimson-test-spear` and
 * `data | rules/nodes.md#39595`. Those live in `tests/fixtures/pipeline/data/` (made-up entries, never a real digest),
 * so the run checker runs from a copy of the repository's layout in a temp dir: the three scripts copied, `build/`
 * and `data/`'s JSON folders linked, `data/rules/vocabulary.md` copied, and the fixture's Markdown data under its
 * `data/`. The checker reads `data/` beside its own scripts, so this is its real code path. run-log.mjs and
 * render-audit.mjs need no data file and run from the repository.
 *
 * The formats: docs/build-guide/studies/2026-10-18-wu89-formats.md.
 */
import { describe, it, expect, afterAll } from '@jest/globals';
import { spawnSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { writeGuideRun, editJson as editRunJson } from '../helpers/guideRunFolder';

type Json = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

const REPO = path.resolve(__dirname, '..', '..');
const SCRIPTS = path.join(REPO, '.claude', 'skills', 'build-guide', 'scripts');
const FIXTURES = path.join(REPO, 'tests', 'fixtures', 'pipeline');
const RUN_LOG = path.join(SCRIPTS, 'run-log.mjs');
const RENDER = path.join(SCRIPTS, 'render-audit.mjs');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'engine-lens-'));
afterAll(() => fs.rmSync(TMP, { recursive: true, force: true }));

/** The repository's layout in a temp dir, with the fixture's Markdown data files under its data/. */
const ROOT = path.join(TMP, 'repo');
const CHECKER = path.join(ROOT, '.claude', 'skills', 'build-guide', 'scripts', 'check-run.mjs');
(() => {
  const scripts = path.dirname(CHECKER);
  fs.mkdirSync(scripts, { recursive: true });
  for (const f of fs.readdirSync(SCRIPTS).filter((x) => x.endsWith('.mjs'))) fs.copyFileSync(path.join(SCRIPTS, f), path.join(scripts, f));
  fs.symlinkSync(path.join(REPO, 'build'), path.join(ROOT, 'build'));
  fs.mkdirSync(path.join(ROOT, 'data', 'rules'), { recursive: true });
  for (const d of ['campaign', 'economy', 'enemies']) fs.symlinkSync(path.join(REPO, 'data', d), path.join(ROOT, 'data', d));
  fs.copyFileSync(path.join(REPO, 'data', 'rules', 'vocabulary.md'), path.join(ROOT, 'data', 'rules', 'vocabulary.md'));
  fs.cpSync(path.join(FIXTURES, 'data'), path.join(ROOT, 'data'), { recursive: true });
})();

const ENV = { PATH: '/usr/bin:/bin', LANG: 'C' };
function node(script: string, ...args: string[]) {
  const r = spawnSync(process.execPath, [script, ...args], { cwd: TMP, env: ENV, encoding: 'utf8', timeout: 30000 });
  return { code: r.status, stdout: r.stdout, stderr: r.stderr };
}
const check = (dir: string) => node(CHECKER, dir);
function passes(dir: string): void {
  const r = check(dir);
  expect({ stderr: r.stderr, code: r.code }).toEqual({ stderr: '', code: 0 });
}
function failing(dir: string): string {
  const r = check(dir);
  expect(r.code).toBe(1);
  return r.stderr;
}
/** The broken rule's lines on stderr. */
const lines = (stderr: string, rule: string) => stderr.split('\n').filter((l) => l.startsWith(`check-run: [${rule}] `));

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
function editText(dir: string, rel: string, edit: (t: string) => string): void {
  const p = path.join(dir, rel);
  const before = fs.readFileSync(p, 'utf8');
  const after = edit(before);
  if (after === before) throw new Error(`the edit to ${rel} changed nothing`);
  fs.writeFileSync(p, after);
}
const replace = (from: string | RegExp, to: string) => (t: string) => {
  if (typeof from === 'string' ? !t.includes(from) : !from.test(t)) throw new Error(`"${from}" not found`);
  return t.replace(from, to);
};
const remove = (dir: string, ...rels: string[]) => rels.forEach((rel) => fs.rmSync(path.join(dir, rel), { recursive: true, force: true }));
/** Edits run-log.json, keeping displays[] in step with checkpoints[], as run-log.mjs writes them (D-367). */
const editLog = (dir: string, edit: (l: Json) => void) => editJson(dir, 'run-log.json', (l) => {
  edit(l);
  l.displays = (l.checkpoints as Json[]).filter((c) => c.checkpoint !== 'unsaved-build').map((c) => ({ checkpoint: c.checkpoint, visit: c.visit }));
});
const step = (stage: string, concept: string | null, outcome: string, extra: Json = {}): Json => ({ stage, ...(concept ? { concept } : {}), attempt: 1, outcome, ...extra });
/** A run-rival stage's index by its stage and card. */
const at = (l: Json, stage: string, concept?: string) => (l.stages as Json[]).findIndex((s) => s.stage === stage && (concept === undefined || s.concept === concept));
/** A dossier row of amendment 8's eleven columns, for a card that failed or can't be finalized yet. */
const emptyRow = (id: string, status: string, risk: string) => `| ${id} | 1 | ${status} | a card | — | — | — | — | — | — | ${risk} |`;

/** A display's lines; it records its visit in the copy's log. */
function display(dir: string, gate: string): string[] {
  const r = node(RUN_LOG, dir, 'display', gate);
  expect({ code: r.code, stderr: r.stderr }).toEqual({ code: 0, stderr: '' });
  return r.stdout.split('\n');
}
/** A card's block of a display: its numbered name line to the next blank line. */
function block(out: string[], head: string): string[] {
  const start = out.findIndex((l) => l.startsWith(head));
  expect(start).toBeGreaterThan(0);
  const end = out.findIndex((l, i) => i > start && l === '');
  return out.slice(start, end);
}
/** The cards.md line of a card. */
const deckLine = (dir: string, id: string) => fs.readFileSync(path.join(dir, 'cards.md'), 'utf8').split('\n').find((l) => l.startsWith(`- ${id} `))!;

describe('AC-W73 (WU-89): run-rival, a run in amendment 8\'s formats, passes the checker', () => {
  it('passes: the rival step after the first verification round\'s assembly, three picked cards plus the rival, a not-in-pin card, engines, the data citations', () => {
    passes(copy('run-rival'));
    const log = readJson(path.join(FIXTURES, 'run-rival'), 'run-log.json');
    expect((log.stages as Json[]).map((s) => `${s.stage}${s.concept ? ` ${s.concept}` : ''} ${s.outcome}`)).toEqual([
      'R1a done', 'R1a done', 'R1a done', 'R1a-assemble done',
      'R1b r1-a-1 pass', 'R1b r1-b-3 pass', 'R1b r1-b-2 fail', 'R1b-assemble done',
      'RV done', 'R1b r1-x-1 pass', 'R1b-assemble done',
    ]);
    expect(log.checkpoints[0].answer).toBe('pick:r1-a-1,r1-b-3,r1-b-2');
  });
});

describe('AC-W73 (D-405): no more than half a round on one engine', () => {
  /** run-rival with r1-c-3's engine moved onto bleed from on-hit: 5 of its 9 dealt cards, the header following. */
  const fiveOnHit = (): string => {
    const dir = copy('run-rival');
    editText(dir, 'cards.md', (t) => replace('engine: rage from on-hit', 'engine: bleed from on-hit')(t)
      .replace('Six engines: bleed from on-hit (4)', 'Five engines: bleed from on-hit (5)').replace(' and rage from on-hit (1)', ''));
    return dir;
  };

  it('fails a round that deals 5 of 9 cards on one engine', () => {
    expect(lines(failing(fiveOnHit()), 'deck')).toEqual([
      expect.stringMatching(/cards\.md's round 1 deals 5 of 9 cards on the engine "bleed from on-hit"; a round deals at most half its cards on one engine, rounded down \(4 of 9\), unless it is short for that reason \(its R1a-assemble entry's shortReason "short: 5 cards share one engine"\) or the user's note for the round asks for that engine \(D-405\)/),
    ]);
  });

  it('passes it when the round is short for that reason', () => {
    const dir = fiveOnHit();
    editLog(dir, (l) => { l.stages[at(l, 'R1a-assemble')].shortReason = 'short: 5 cards share one engine'; });
    passes(dir);
  });

  /**
   * run-rival cut back to two brainstorm rounds, the second opened by a `more` with `note` and dealing nine cards,
   * `onHit` of them on bleed from on-hit; the header names every engine of both rounds with its count.
   */
  function twoRounds(note: string | undefined, onHit: number): string {
    const dir = copy('run-rival');
    remove(dir, 'dossier.md', 'concepts', 'reports', 'cards/r1-x-1.md');
    const ids = ['a', 'b', 'c'].flatMap((l) => [1, 2, 3].map((n) => `r2-${l}-${n}`));
    const others = ['bleed from on-crit', 'rage from on-hit', 'bleed from on-block', 'bleed from armour-break'];
    const engines = ids.map((_, k) => (k < onHit ? 'bleed from on-hit' : others[(k - onHit) % others.length]));
    ids.forEach((id, k) => fs.writeFileSync(path.join(dir, 'cards', `${id}.md`), `# Card ${id}: Round two card ${k + 1}\n\n## Brainstorm half\n\n### Pitch\n\n- Name: Round two card ${k + 1}\n`));
    editText(dir, 'cards.md', replace('## Not dealt', `## Round 2\n\n${ids.map((id, k) => `- ${id} "Round two card ${k + 1}" | a second round's card | engine: ${engines[k]}`).join('\n')}\n\n## Not dealt`));
    const counts = new Map<string, number>();
    for (const m of fs.readFileSync(path.join(dir, 'cards.md'), 'utf8').matchAll(/\| engine: (\S+ from \S+)/g)) counts.set(m[1], (counts.get(m[1]) ?? 0) + 1);
    editText(dir, 'cards.md', replace(/^Six engines: .*$/m, `Engines: ${[...counts].map(([e, n]) => `${e} (${n})`).join(', ')}.`));
    editLog(dir, (l) => {
      const round = (l.stages as Json[]).slice(0, 4);
      l.stages = [...round, ...round];
      l.checkpoints = [
        { checkpoint: 'brainstorm', visit: 1, answer: 'more', answeredBy: 'user', questions: 0, ...(note !== undefined ? { note } : {}) },
        { checkpoint: 'brainstorm', visit: 2, answer: 'stop', answeredBy: 'user', questions: 0 },
      ];
      l.outputs.dossier = null;
    });
    return dir;
  }

  it("passes it when the user's note for the round names that engine, and fails it when the note asks for another", () => {
    passes(twoRounds('more bleed builds, all on hit if you can', 5));
    passes(twoRounds(undefined, 4));
    expect(lines(failing(twoRounds('more block builds', 5)), 'deck')).toEqual([expect.stringMatching(/cards\.md's round 2 deals 5 of 9 cards on the engine "bleed from on-hit"/)]);
    expect(lines(failing(twoRounds(undefined, 5)), 'deck')).toEqual([expect.stringMatching(/round 2 deals 5 of 9 cards on the engine "bleed from on-hit"/)]);
  });

  it("holds the engine to the vocabulary's words and its form, on every dealt line, and the header to each engine's count", () => {
    const word = copy('run-rival');
    editText(word, 'cards.md', replace('engine: bleed from on-crit', 'engine: bleed from crit-strikes'));
    expect(failing(word)).toMatch(/\[deck\] cards\.md:\d+: r1-a-3's engine names "crit-strikes", which isn't a family of data\/rules\/vocabulary\.md \(or none\)/);
    const form = copy('run-rival');
    editText(form, 'cards.md', replace('engine: bleed from on-crit', 'engine: bleed via crits'));
    expect(failing(form)).toMatch(/\[deck\] cards\.md:\d+: r1-a-3's "engine: bleed via crits" isn't "engine: <family> from <family>"/);
    const missing = copy('run-rival');
    editText(missing, 'cards.md', replace(' | engine: rage from on-hit', ''));
    expect(failing(missing)).toMatch(/\[deck\] cards\.md:\d+: round 1 deals r1-c-3 with no "engine: <family> from <family>"; a run that ran the rival \(amendment 8, D-408\) names one on every dealt card's line \(D-405\)/);
    const header = copy('run-rival');
    editText(header, 'cards.md', replace('bleed from on-hit (4)', 'bleed from on-hit (3)'));
    expect(lines(failing(header), 'deck')).toEqual([expect.stringMatching(/"How they differ" doesn't name the engine "bleed from on-hit" with its count, "bleed from on-hit \(4\)"/)]);
  });
});

describe('AC-W73 (D-403, D-406): the obvious card\'s field and the structure check, displayed and checked', () => {
  it("the brainstorm display shows the obvious card's kit, and a card that waits on the pin says on what", () => {
    const dir = copy('run-rival');
    editLog(dir, (l) => {
      l.stages = (l.stages as Json[]).slice(0, 4);
      l.checkpoints = [];
      l.status = 'running';
    });
    const out = display(dir, 'brainstorm');
    expect(block(out, '1. Blood Hunt bleed burst').slice(-1)).toEqual([
      "   Obvious build: the melee kit for a spear lunge: a two-hand-damage spear, bleed supports on the lunge, life and armour on the gear, and the Titan's slam notables",
    ]);
    expect(block(out, '5. Blood Hunt with a bleed unique').slice(-2)).toEqual([
      "   Can't be finalized yet: its spear isn't in the PoB pin.",
      "   Waits on PoB: Crimson Test Spear isn't in the PoB version this run uses, so the build can't be measured yet.",
    ]);
    expect(out.filter((l) => l.startsWith('   Obvious build:'))).toHaveLength(1);
  });

  it("the verification display shows the structure check's stronger structure under its card", () => {
    const out = display(copy('run-rival'), 'verification');
    expect(block(out, '1. Blood Hunt bleed burst').slice(-1)).toEqual(['   A stronger structure? Open each pack with Rolling Slam so every lunge lands on broken armour, about ×1.2 on packs.']);
    expect(out.filter((l) => l.includes('A stronger structure?'))).toHaveLength(1);
  });

  it('fails "Obvious build:" on any card but r1-a-1, and a stronger-structure line that isn\'t the structure check\'s last', () => {
    const obvious = copy('run-rival');
    editText(obvious, 'cards/r1-b-1.md', replace('- Playstyle:', '- Obvious build: a two-hander kit\n- Playstyle:'));
    expect(lines(failing(obvious), 'card')).toEqual([expect.stringMatching(/cards\/r1-b-1\.md:\d+: carries "- Obvious build:", but only the obvious card, r1-a-1 \(researcher a's first card in round 1\), does \(D-403\)/)]);
    const last = copy('run-rival');
    editText(last, 'cards/r1-a-1.md', replace('about ×1.2 on packs.\n', 'about ×1.2 on packs.\n- Counts, again: nothing grows with a count.\n'));
    expect(lines(failing(last), 'card')).toEqual([expect.stringMatching(/cards\/r1-a-1\.md:\d+: "- A stronger structure\? …" isn't the structure check's last line; it ends the section \(D-406\)/)]);
  });
});

describe('AC-W73 (D-408): the run log takes stage RV, the card id r1-x-1 and the failure code not-dealt', () => {
  it('run-log.mjs writes RV entries, done or none-found with what it tried, and R1b for r1-x-1; it refuses an RV with a card or a none-found without tried', () => {
    const dir = path.join(TMP, `log-${++copies}`);
    fs.mkdirSync(dir);
    const write = (kind: string, entry: Json) => node(RUN_LOG, dir, kind, JSON.stringify(entry));
    expect(write('init', { slug: 'titan-blood-hunt', brief: { ascendancy: 'Titan', skill: 'Blood Hunt' }, mode: 'offline', testConfig: 'none' }).code).toBe(0);
    expect(write('stage', { stage: 'RV', attempt: 1, outcome: 'done' })).toEqual({ code: 0, stdout: 'run-log: wrote stages[0]\n', stderr: '' });
    expect(write('stage', { stage: 'R1b', concept: 'r1-x-1', attempt: 1, outcome: 'fail', probes: 0 })).toEqual({ code: 0, stdout: 'run-log: wrote stages[1]\n', stderr: '' });
    expect(write('stage', { stage: 'RV', attempt: 1, outcome: 'none-found', tried: 'a slam opener and a second weapon set' }).code).toBe(0);
    expect(readJson(dir, 'run-log.json').stages).toEqual([
      { stage: 'RV', attempt: 1, outcome: 'done' },
      { stage: 'R1b', concept: 'r1-x-1', attempt: 1, outcome: 'fail', probes: 0 },
      { stage: 'RV', attempt: 1, outcome: 'none-found', tried: 'a slam opener and a second weapon set' },
    ]);
    expect(write('stage', { stage: 'RV', concept: 'r1-x-1', attempt: 1, outcome: 'done' }).stderr).toBe('run-log: stage entry refused: a RV entry has no concept\n');
    expect(write('stage', { stage: 'RV', attempt: 1, outcome: 'none-found' }).stderr).toBe('run-log: stage entry refused: tried is on an RV entry whose outcome is none-found, and only there: what the rival tried, a non-empty text (D-408)\n');
    expect(write('stage', { stage: 'RV', attempt: 1, outcome: 'pass' }).stderr).toBe('run-log: stage entry refused: a RV entry\'s outcome is done, none-found, missing, not "pass"\n');
    expect(readJson(dir, 'run-log.json').stages).toHaveLength(3);
  });

  /** run-rival whose rival failed R1a-assemble's identity and sniff checks in its R1b: not-dealt, with no compile. */
  const notDealt = (): string => {
    const dir = copy('run-rival');
    remove(dir, 'concepts/r1-x-1');
    writeJson(dir, 'reports/gates/R1b-r1-x-1-a1.json', {
      stage: 'R1b', concept: 'r1-x-1', attempt: 1, verdict: { compiled: 'fail' },
      findings: [{ part: 'compiled', code: 'not-dealt', message: "not dealt: its load-bearing link isn't confirmed in game text" }],
      errors: [], compiles: 0, recordPath: null, faultsApplied: [], leagueUnverified: false,
    });
    editLog(dir, (l) => { l.stages[at(l, 'R1b', 'r1-x-1')].outcome = 'fail'; });
    editText(dir, 'dossier.md', replace(/^\| r1-x-1 \|.*$/m, emptyRow('r1-x-1', "failed after 1 attempt: not dealt: its load-bearing link isn't confirmed in game text; reports/gates/R1b-r1-x-1-a1.json", 'not dealt')));
    return dir;
  };

  it("the checker passes the rival's R1b ending not-dealt with no compile, the round assembling after it", () => {
    passes(notDealt());
  });

  it('fails a retry after not-dealt, finalizing the not-dealt rival, its row read as anything but failed, and not-dealt on a picked card', () => {
    const retry = notDealt();
    editLog(retry, (l) => { l.stages.splice(at(l, 'R1b', 'r1-x-1') + 1, 0, { ...l.stages[at(l, 'R1b', 'r1-x-1')], attempt: 2 }); });
    expect(failing(retry)).toMatch(/\[order\] .*\(R1b r1-x-1 attempt 2\): runs R1b for r1-x-1 again, but its last attempt ended not-dealt with no compile: the rival's card failed R1a-assemble's identity and sniff checks, so no retry can deal it \(D-408\)/);
    const pick = notDealt();
    editLog(pick, (l) => { l.checkpoints[1] = { checkpoint: 'verification', visit: 1, answer: 'pick:r1-x-1', answeredBy: 'user', questions: 0 }; l.stages.push(step('D1-build', 'r1-x-1', 'done')); l.status = 'running'; });
    expect(failing(pick)).toMatch(/\[order\] .*: follows the verification gate answered "pick:r1-x-1", but r1-x-1, the rival's card, failed R1a-assemble's identity and sniff checks \(its R1b ended not-dealt\), so it can't be finalized \(D-408\)/);
    const row = notDealt();
    editText(row, 'dossier.md', replace('failed after 1 attempt: not dealt: its load-bearing link', 'failed after 1 attempt: its load-bearing link'));
    expect(lines(failing(row), 'dossier-sections')).toEqual([expect.stringMatching(/r1-x-1's R1b ended not-dealt, so its status reads "failed …: not dealt: <the check it failed>"/)]);
    const picked = copy('run-rival');
    editJson(picked, 'reports/gates/R1b-r1-b-2-a1.json', (r) => { r.findings[0].code = 'not-dealt'; });
    expect(failing(picked)).toMatch(/\[gate-report\] reports\/gates\/R1b-r1-b-2-a1\.json: has the finding not-dealt, but r1-b-2 isn't the rival's card r<k>-x-<n>/);
  });
});

describe('AC-W73 (D-287, D-408): the verification round\'s cap is 3 picked cards, the rival\'s aside', () => {
  it('passes 3 picked cards plus the rival (run-rival) and fails a round of 4 picked cards', () => {
    passes(copy('run-rival'));
    const dir = copy('run-rival');
    // A fourth card, made at the brainstorm gate (D-391) and picked with the three: four cards in one round.
    fs.writeFileSync(path.join(dir, 'cards', 'r1-g-1.md'), fs.readFileSync(path.join(dir, 'cards', 'r1-c-2.md'), 'utf8')
      .replace('# Card r1-c-2: Blood Hunt block tank', '# Card r1-g-1: Shielded bleed burst')
      .replace('- Name: Blood Hunt block tank', '- Name: Shielded bleed burst\n- Made at the gate (visit 1): from Blood Hunt bleed burst and Blood Hunt block tank: the lunge behind a shield'));
    editText(dir, 'cards.md', replace('\n\n## Not dealt', '\n- r1-g-1 "Shielded bleed burst" | the lunge behind a shield | made at the gate (visit 1): from "Blood Hunt bleed burst" and "Blood Hunt block tank"\n\n## Not dealt'));
    writeJson(dir, 'reports/gates/R1b-r1-g-1-a1.json', { ...readJson(dir, 'reports/gates/R1b-r1-a-1-a1.json'), concept: 'r1-g-1', recordPath: null });
    editText(dir, 'dossier.md', (t) => `${t.replace(/\n+$/, '')}\n| r1-g-1 | 1 | viable | the lunge behind a shield | Blood Hunt 50000 (g1s1p1.TotalDPS) | 4200 | 31500 | medium (rough) | weapon: unavailable (offline run) | none (offline) | none found |\n`);
    editLog(dir, (l) => {
      l.checkpoints[0].newCards = [{ id: 'r1-g-1', name: 'Shielded bleed burst', from: ['r1-a-1', 'r1-c-2'], words: 'the lunge behind a shield' }];
      l.stages.splice(at(l, 'R1b', 'r1-b-2') + 1, 0, step('R1b', 'r1-g-1', 'pass', { probes: 0 }));
    });
    const stderr = failing(dir);
    expect(lines(stderr, 'caps')).toEqual([expect.stringMatching(/run-log\.json stages\[7\] \(R1b r1-g-1 attempt 1\): verification round 1 compiles 4 cards; at most 3 per verification round \(D-287, NFR-23\), the rival's aside \(D-408\)/)]);
    // The answer itself is over the cap too.
    expect(stderr).toMatch(/\[run-log\] run-log\.json checkpoints\[0\]: answers "pick:r1-a-1,r1-b-3,r1-b-2" with 1 new card\(s\): 4 cards, over 3/);
  });

  it("the rival's R1b runs only after its step: without RV it is outside any verification round", () => {
    const dir = copy('run-rival');
    editLog(dir, (l) => { l.stages.splice(at(l, 'RV'), 1); });
    expect(failing(dir)).toMatch(/\[order\] .*\(R1b r1-x-1 attempt 1\): .*outside a verification round|\[rival\] cards\/r1-x-1\.md is a rival's card, but run-log\.json logs no RV step that wrote it/);
  });

  it('a rival that finds no faster structure leads straight to the gate, with what it tried; the display says so', () => {
    const dir = copy('run-rival');
    remove(dir, 'cards/r1-x-1.md', 'concepts/r1-x-1', 'reports/gates/R1b-r1-x-1-a1.json');
    editText(dir, 'dossier.md', replace(/^\| r1-x-1 \|.*\n/m, ''));
    const tried = 'a slam opener, a second weapon set and a block shield; none clears faster on paper';
    editLog(dir, (l) => { l.stages = [...(l.stages as Json[]).slice(0, at(l, 'RV')), step('RV', null, 'none-found', { tried })]; });
    passes(dir);
    expect(display(dir, 'verification')).toContain(`The rival, a researcher with fresh context, found no structure that clears faster. What it tried: ${tried}`);
    editLog(dir, (l) => { delete l.stages[at(l, 'RV')].tried; });
    expect(failing(dir)).toMatch(/\[run-log\] run-log\.json stages\[8\]: has no tried; an RV entry whose outcome is none-found carries tried/);
  });

  it("fails a rival step that wrote no card; passes a rival the user asked for at the gate, read past like a gate question", () => {
    const lost = copy('run-rival');
    remove(lost, 'cards/r1-x-1.md');
    expect(lines(failing(lost), 'rival')).toEqual([expect.stringMatching(/stages\[8\] \(RV attempt 1\) wrote the rival's card, but cards\/r1-x-1\.md doesn't exist/)]);
    const asked = copy('run-rival');
    fs.copyFileSync(path.join(asked, 'cards', 'r1-x-1.md'), path.join(asked, 'cards', 'r1-x-2.md'));
    editText(asked, 'cards/r1-x-2.md', replace('# Card r1-x-1: Slam-opened lunge', '# Card r1-x-2: Slam-opened lunge, again'));
    editLog(asked, (l) => { l.stages.push(step('RV', null, 'done')); });
    passes(asked);
  });
});

describe('AC-W73 (D-407): the verification and design displays print clear speed and movement speed before the boss floor', () => {
  it('verification: the skeleton\'s clear speed and movement speed, then the card\'s Bosses line, then damage and toughness; the rival marked', () => {
    const out = display(copy('run-rival'), 'verification');
    expect(block(out, '1. Blood Hunt bleed burst').slice(0, 8)).toEqual([
      '1. Blood Hunt bleed burst: works.',
      '   Why pick it: One lunge spends the bleed you built for a big hit, so rares melt in two presses. The simplest Blood Hunt loop in the deck.',
      "   Clear speed: medium (a rough estimate from Herald of Blood's area).",
      '   Movement speed: +10% over your base speed.',
      '   How it clears: Lunge into the pack with Blood Hunt; Herald of Blood pops the bleeding dead. One button for packs, and the lunge carries you to the next one.',
      '   Bosses: Re-apply bleed, then lunge to consume it; the burst is its boss answer.',
      '   Damage: 50,000 per second from Blood Hunt, against map monsters (modelled in PoB).',
      "   Toughness: 4,200 life and 31,500 effective HP (PoB's estimate of the damage it takes to kill you).",
    ]);
    expect(block(out, '4. Slam-opened lunge').slice(0, 5)).toEqual([
      '4. Slam-opened lunge, the rival: works.',
      '   The rival: a researcher with fresh context wrote it to clear faster than the other cards.',
      "   Why pick it: Rolling Slam breaks a whole pack's armour, so the lunge that follows hits every target harder.",
      "   Clear speed: fast (a rough estimate from Rolling Slam's area).",
      '   Movement speed: +15% over your base speed.',
    ]);
    expect(block(out, "3. Blood Hunt with a bleed unique")[0]).toBe("3. Blood Hunt with a bleed unique: can't be built yet: waits on the pin.");
  });

  it("verification: PoB gives the clear skill no area, so the record's speed reads \"(PoB gives no area)\" and the card's estimate leads; with no clear skill measured, no such words", () => {
    const dir = copy('run-rival');
    let out = display(dir, 'verification');
    expect(block(out, '2. Blood Hunt armour stacker').slice(2, 6)).toEqual([
      "   How it clears: Lunge into the pack and stand in it; Herald of Blood clears the bleeding dead. (the card's estimate)",
      '   Clear speed: slow (PoB gives no area).',
      '   Movement speed: -3% over your base speed.',
      '   Bosses: Face-tank the hits and lunge between them.',
    ]);
    // An on-death step can lift a no-area band: the record's speed is printed, never its band.
    editJson(dir, 'concepts/r1-b-3/compile-record.json', (r) => { Object.assign(r.stages.r1b3e.measures.clearSpeed, { speed: 'medium', onDeath: true }); });
    out = display(dir, 'verification');
    expect(block(out, '2. Blood Hunt armour stacker')).toContain('   Clear speed: medium (PoB gives no area).');
    editJson(dir, 'concepts/r1-a-1/compile-record.json', (r) => {
      Object.assign(r.stages.r1a1e.measures.clearSpeed, { speed: 'slow', group: null, key: null, skill: null, radiusMetres: 0, band: 'slow', noArea: true });
    });
    out = display(dir, 'verification');
    const first = block(out, '1. Blood Hunt bleed burst');
    expect(first[2]).toBe('   Clear speed: slow (a rough estimate; PoB measured no clear skill).');
    expect(first.join('\n')).not.toMatch(/gives no area|card's estimate/);
  });

  it("design: each rung's clear speed and movement speed (the D1 gate's record), then the Arbiter check, then damage and effective HP; a no-area rung says so", () => {
    const dir = copy('run-ok');
    editJson(dir, 'compile-record.json', (r) => {
      for (const id of ['m', 'b', 'n']) r.stages[id].measures.movementSpeed = 1.251;
      Object.assign(r.stages.b.measures.clearSpeed, { noArea: true });
    });
    const out = display(dir, 'design');
    expect(out[2]).toMatch(/^The endgame build for Blood Hunt bleed burst, rung by rung, as its last design check measured it\. Clear speed is a rough estimate from the main skill's area; movement speed is PoB's, over your base speed; damage/);
    expect(block(out, 'Entering maps (level 65):').slice(1, 5)).toEqual(['- Clear speed: medium (rough).', '- Movement speed: +25% over your base speed.', '- Damage: 9,000 per second.', '- Effective HP: 18,400.']);
    expect(block(out, 'Budget endgame (level 90):').slice(1, 6)).toEqual([
      '- Clear speed: slow (PoB gives no area).',
      '- Movement speed: +25% over your base speed.',
      '- The Arbiter of Divinity: survives its hits (its worst, a physical hit, is 0.68 of your max hit).',
      '- Damage: 50,000 per second.',
      '- Effective HP: 31,500.',
    ]);
  });

  it("render-audit.mjs reads the movement speed from the record's measures, where the record has it", () => {
    const dir = path.join(TMP, `audit-${++copies}`);
    fs.mkdirSync(dir);
    writeGuideRun(dir);
    editRunJson(dir, 'compile-record.json', (r) => { r.stages.m.measures.movementSpeed = 1.4; });
    const r = node(RENDER, dir);
    expect(r.code).toBe(0);
    const audit = fs.readFileSync(path.join(dir, 'audit.md'), 'utf8');
    expect(audit).toContain("- Clear speed: medium, a rough estimate from Blood Hunt's area. Movement speed: +40%.");
    // A rung whose record has no measures.movementSpeed keeps PoB's output, +25%.
    expect(audit).toContain("- Clear speed: fast, a rough estimate from Blood Hunt's area. Movement speed: +25%.");
  });
});

describe('AC-W73 (D-303, D-400): waits on the pin, and an R1b verdict not-in-pin with no compile', () => {
  it('passes the deck line on a card marked "can\'t be finalized yet" and its not-in-pin verdict (run-rival); fails the line without the mark', () => {
    expect(deckLine(path.join(FIXTURES, 'run-rival'), 'r1-b-2')).toMatch(/\| can't be finalized yet: its spear isn't in the PoB pin \| waits on the pin: Crimson Test Spear$/);
    expect(readJson(path.join(FIXTURES, 'run-rival'), 'reports/gates/R1b-r1-b-2-a1.json')).toEqual(expect.objectContaining({ compiles: 0, recordPath: null, findings: [expect.objectContaining({ code: 'not-in-pin' })] }));
    const dir = copy('run-rival');
    editText(dir, 'cards.md', replace(" | can't be finalized yet: its spear isn't in the PoB pin", ''));
    expect(lines(failing(dir), 'deck')).toEqual([expect.stringMatching(/r1-b-2 waits on the pin, but its line isn't marked "can't be finalized yet: <why>"/)]);
  });

  it('fails a retry after not-in-pin, finalizing the card, and its dossier row read as anything but "can\'t be finalized yet: waits on the pin"', () => {
    const retry = copy('run-rival');
    editLog(retry, (l) => { l.stages.splice(at(l, 'R1b', 'r1-b-2') + 1, 0, step('R1b', 'r1-b-2', 'fail', { attempt: 2, probes: 0 })); });
    expect(failing(retry)).toMatch(/\[order\] .*\(R1b r1-b-2 attempt 2\): runs R1b for r1-b-2 again, but its last attempt ended not-in-pin with no compile: it rests on an entry the PoB pin doesn't know, so no retry can compile it \(D-400\)/);
    const pick = copy('run-rival');
    editLog(pick, (l) => { l.checkpoints[1] = { checkpoint: 'verification', visit: 1, answer: 'pick:r1-b-2', answeredBy: 'user', questions: 0 }; l.stages.push(step('D1-build', 'r1-b-2', 'done')); l.status = 'running'; });
    expect(failing(pick)).toMatch(/\[order\] .*: follows the verification gate answered "pick:r1-b-2", but r1-b-2 rests on an entry the PoB pin doesn't know \(its R1b ended not-in-pin\), so it can't be finalized yet \(D-303, D-400\)/);
    const row = copy('run-rival');
    editText(row, 'dossier.md', replace("can't be finalized yet: waits on the pin", "can't be finalized yet: its spear isn't in PoB"));
    expect(lines(failing(row), 'dossier-sections')).toEqual([expect.stringMatching(/r1-b-2's R1b ended not-in-pin, so its status reads "can't be finalized yet: waits on the pin"/)]);
  });
});

describe('AC-W73 (D-400, D-401): a data citation to a Markdown data file resolves by its entry id', () => {
  it('passes data | league/<slug>.md#<entry-id> when the fixture digest holds that id, and fails it when it doesn\'t', () => {
    const dir = copy('run-rival');
    expect(fs.readFileSync(path.join(dir, 'research', 'p1-r1a-1.md'), 'utf8')).toContain('[^m2]: data | league/fixture-league.md#crimson-test-spear');
    passes(dir);
    editText(dir, 'research/p1-r1a-1.md', replace('fixture-league.md#crimson-test-spear', 'fixture-league.md#no-such-entry'));
    expect(lines(failing(dir), 'markers')).toEqual([
      'check-run: [markers] research/p1-r1a-1.md:14 [^m2]: data league/fixture-league.md#no-such-entry names no entry of a Markdown data file (D-400, M-20\'s entry id): league/fixture-league.md has no entry "no-such-entry": an H3 "### <Name>" whose next line is "- Id: no-such-entry"',
    ]);
  });

  it("resolves rules/nodes.md's node lines by node id (the line whose parenthesis starts with it), and still the JSON facts", () => {
    const dir = copy('run-rival');
    expect(fs.readFileSync(path.join(dir, 'research', 'p1-r1a-3.md'), 'utf8')).toContain('[^t2]: data | rules/nodes.md#39595');
    editText(dir, 'research/p1-r1a-3.md', (t) => `${t.replace(/\n+$/, '')}\n[^t3]: data | enemies/waystones.json#area-level.offset\n`);
    editText(dir, 'research/p1-r1a-3.md', replace('read whole.[^t2]', 'read whole.[^t2] Maps start at a fixed offset.[^t3]'));
    passes(dir);
    editText(dir, 'research/p1-r1a-3.md', replace('rules/nodes.md#39595', 'rules/nodes.md#11111'));
    expect(lines(failing(dir), 'markers')).toEqual([expect.stringMatching(/\[\^t2\]: data rules\/nodes\.md#11111 names no entry of a Markdown data file .*: rules\/nodes\.md has no node line "- <Name> \(11111, …\)"/)]);
    const missing = copy('run-rival');
    editText(missing, 'research/p1-r1a-3.md', replace('rules/nodes.md#39595', 'rules/uniques.md#way-of-the-stonefist'));
    expect(lines(failing(missing), 'markers')).toEqual([expect.stringMatching(/data rules\/uniques\.md#way-of-the-stonefist names no entry of a Markdown data file .*: no data file "rules\/uniques\.md" under data\//)]);
  });
});

describe('D-407, D-408: the dossier\'s clear-speed column', () => {
  it("a run that ran the rival has amendment 8's columns; a dossier with D-355's ten fails it", () => {
    const dir = copy('run-rival');
    editText(dir, 'dossier.md', (t) => t.split('\n').map((l) => (l.startsWith('|') ? l.split('|').filter((_, k) => k !== 8).join('|') : l)).join('\n'));
    expect(lines(failing(dir), 'dossier-sections')).toEqual([expect.stringMatching(/the table's columns are .*; the comparison's are \["Card","Round","Status","Synergy","Named source DPS","Life","EHP","Clear speed","Key prices","League","Main risk"\], in that order \(D-355, D-407\), in a run that ran the rival \(D-408\)/)]);
  });

  it("a failed or not-yet-finalizable card's Clear speed cell is —", () => {
    const dir = copy('run-rival');
    // The eighth cell, after Card, Round, Status, Synergy, Named source DPS, Life and EHP.
    editText(dir, 'dossier.md', replace(/^(\| r1-b-2 \|(?:[^|]*\|){6}) — \|/m, '$1 slow (rough) |'));
    expect(lines(failing(dir), 'dossier-sections')).toEqual([expect.stringMatching(/r1-b-2 is "can't be finalized yet", but its Clear speed cell\(s\) aren't "—"/)]);
  });
});
