/**
 * AC-W84 (WU-105, amendment 10: D-429…D-435, Appendix A's formats): the skill's scripts on fixture runs, each spawned as
 * a real `node` process with an explicit env.
 *
 * - `tests/fixtures/pipeline/run-composite`: an open brief (ascendancy Titan), one brainstorm round that R1a-synthesize
 *   composed into the composites r1-s-1 (Rolling Slam) and r1-s-2 (Earthquake) from nine researcher cards and the
 *   research files' Ideas; r1-s-1 verified (its Pieces measured, a `not measured (<why>)` row, six probes, one a failed
 *   compile), the dossier's twelve columns, stopped at the verification gate.
 * - `tests/fixtures/pipeline/run-fixed-roll`: the fixed roll Titan Blood Hunt, every card one identity, so the synthesis
 *   keyed its structures by engine: two engine composites, the obvious card shown as the baseline, stopped at the
 *   brainstorm gate.
 * - `tests/fixtures/pipeline/run-builds`, a schema-4 run with `R1a-assemble` (amendment 9's), for the old runs' rule,
 *   `pieces.md`, the design display, the V4 report, `build`'s `name` and the stale build.
 *
 * check-run and render-audit load the server's compiled `build/plan/`: `mise run test` builds first.
 */
import { describe, it, expect, afterAll } from '@jest/globals';
import { spawnSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';

type Json = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

const REPO = path.resolve(__dirname, '..', '..');
const SCRIPTS = path.join(REPO, '.claude', 'skills', 'build-guide', 'scripts');
const CHECKER = path.join(SCRIPTS, 'check-run.mjs');
const RUN_LOG = path.join(SCRIPTS, 'run-log.mjs');
const RENDER = path.join(SCRIPTS, 'render-audit.mjs');
const USAGE = path.join(REPO, 'scripts', 'run-usage.mjs');
const FIXTURES = path.join(REPO, 'tests', 'fixtures', 'pipeline');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'composites-'));
afterAll(() => fs.rmSync(TMP, { recursive: true, force: true }));

const ENV = { PATH: '/usr/bin:/bin', LANG: 'C' };
function node(script: string, args: string[], opts: { input?: string; env?: Record<string, string> } = {}) {
  const r = spawnSync(process.execPath, [script, ...args], { cwd: TMP, env: { ...ENV, ...opts.env }, encoding: 'utf8', timeout: 30000, input: opts.input });
  return { code: r.status, stdout: r.stdout, stderr: r.stderr };
}
const check = (dir: string, env?: Record<string, string>) => node(CHECKER, [dir], { env });
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
const read = (dir: string, rel: string) => fs.readFileSync(path.join(dir, rel), 'utf8');
const readJson = (dir: string, rel: string): Json => JSON.parse(read(dir, rel)) as Json;
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
  const t = read(dir, rel);
  if (typeof from === 'string' ? !t.includes(from) : !from.test(t)) throw new Error(`"${from}" not found in ${rel}`);
  fs.writeFileSync(path.join(dir, rel), t.replace(from, to));
}
const remove = (dir: string, ...rels: string[]) => rels.forEach((rel) => fs.rmSync(path.join(dir, rel), { recursive: true, force: true }));
/** Edits run-log.json, keeping displays[] in step with checkpoints[], as run-log.mjs writes them (D-367). */
const editLog = (dir: string, edit: (l: Json) => void) => editJson(dir, 'run-log.json', (l) => {
  edit(l);
  l.displays = (l.checkpoints as Json[]).filter((c) => c.checkpoint !== 'unsaved-build').map((c) => ({ checkpoint: c.checkpoint, visit: c.visit }));
});
const step = (stage: string, extra: Json = {}): Json => ({ stage, attempt: 1, outcome: 'done', ...extra });
const answer = (checkpoint: string, visit: number, a: string, extra: Json = {}): Json => ({ checkpoint, visit, answer: a, answeredBy: 'user', questions: 0, ...extra });
/** A copy of a fixture's probe `from` as probes/<card>/<n>/, its record's PoB path the new folder's. */
function addProbe(dir: string, card: string, from: number, n: number): void {
  fs.cpSync(path.join(dir, 'probes', card, String(from)), path.join(dir, 'probes', card, String(n)), { recursive: true });
  editJson(dir, `probes/${card}/${n}/compile-record.json`, (r) => { r.pobFile.path = r.pobFile.path.replace(`/probes/${card}/${from}/`, `/probes/${card}/${n}/`); });
}
/** run-composite cut back to its brainstorm gate's first visit, before its answer: no verification yet. */
function atBrainstorm(fixture: string): string {
  const dir = copy(fixture);
  editJson(dir, 'run-log.json', (l) => {
    l.stages = (l.stages as Json[]).slice(0, (l.stages as Json[]).findIndex((s) => s.stage === 'R1a-synthesize') + 1);
    l.checkpoints = [];
    l.displays = [];
    l.status = 'running';
    l.dossier = null;
  });
  remove(dir, 'dossier.md', 'concepts', 'probes', 'reports');
  // The verification half R1b wrote is gone with its run.
  editText(dir, 'cards/r1-s-1.md', /\n## Verification half[\s\S]*$/, '\n');
  return dir;
}
/** A display's lines; it records its visit in the copy's log. */
function display(dir: string, ...args: string[]): string[] {
  const r = node(RUN_LOG, [dir, 'display', ...args]);
  expect({ code: r.code, stderr: r.stderr }).toEqual({ code: 0, stderr: '' });
  return r.stdout.split('\n');
}
/** The composite cards of run-composite's round 1, rewritten as another round's composite. */
function compositeFrom(dir: string, id: string, name: string): void {
  const text = read(dir, 'cards/r1-s-2.md').replace(/^# Card r1-s-2: .*$/m, `# Card ${id}: ${name}`).replace(/^- Name: .*$/m, `- Name: ${name}`);
  fs.writeFileSync(path.join(dir, 'cards', `${id}.md`), text);
}

// ---------------------------------------------------------------------------------------------------
// The synthesis round, its composites and its deck (D-429, D-432)
// ---------------------------------------------------------------------------------------------------

describe('AC-W84: a run with R1a-synthesize and composites r1-s-1 and r1-s-2 passes; a round of five composites fails', () => {
  it('passes run-composite: R1a-synthesize, the composites r1-s-1 and r1-s-2, r1-s-1 verified', () => {
    passes(copy('run-composite'));
    const log = readJson(path.join(FIXTURES, 'run-composite'), 'run-log.json');
    expect((log.stages as Json[]).map((s) => `${s.stage}${s.concept ? ` ${s.concept}` : ''} ${s.outcome}`)).toEqual([
      'R1a done', 'R1a done', 'R1a done', 'R1a-synthesize done', 'R1b r1-s-1 pass', 'R1b-assemble done',
    ]);
    const deck = read(path.join(FIXTURES, 'run-composite'), 'cards.md');
    expect([...deck.split('## Cards')[0].matchAll(/^- (r\d+-s-\d+) /gm)].map((m) => m[1])).toEqual(['r1-s-1', 'r1-s-2']);
  });

  /** run-composite carried on: round 2 composes two, round 3 composes `third` composites, then the brainstorm gate stops. */
  function threeRounds(third: number): string {
    const dir = copy('run-composite');
    editLog(dir, (l) => {
      l.stages.push(step('R1a'), step('R1a'), step('R1a'), step('R1a-synthesize'), step('R1a'), step('R1a'), step('R1a'), step('R1a-synthesize'));
      l.checkpoints = [
        answer('brainstorm', 1, 'pick:r1-s-1'), answer('verification', 1, 'more', { note: 'more slams' }),
        answer('brainstorm', 2, 'more', { note: 'a cold slam' }), answer('brainstorm', 3, 'stop'),
      ];
    });
    const ids = (k: number, n: number) => Array.from({ length: n }, (_, i) => `r${k}-s-${i + 1}`);
    const line = (id: string) => `- ${id} "Quake ${id}" | Warrior, Titan, Earthquake ${id} | the quake's hit | the aftershock's delay | under-played: armour stacking`;
    for (const id of [...ids(2, 2), ...ids(3, third)]) compositeFrom(dir, id, `Quake ${id}`);
    editText(dir, 'cards.md', '\n## Cards\n', ['', '## Round 2', '', ...ids(2, 2).map(line), '', '## Round 3', '', ...ids(3, third).map(line), '', '## Cards', ''].join('\n'));
    return dir;
  }

  it('a third round of four composites passes; of five, fails: a round composes 1 to 4', () => {
    passes(threeRounds(4));
    const stderr = failing(threeRounds(5));
    expect(lines(stderr, 'deck')).toEqual(["check-run: [deck] cards.md's round 3 composes 5 composites; a round composes 1 to 4 (D-429, NFR-23)"]);
  });
});

describe('AC-W84: the short round (D-339, D-429): fewer than 2 composites, or none taking an under-played piece, needs its shortReason', () => {
  /** run-composite with one composite: r1-s-2, its card and every line naming it gone. */
  function oneComposite(): string {
    const dir = copy('run-composite');
    remove(dir, 'cards/r1-s-2.md');
    let deck = read(dir, 'cards.md');
    deck = deck.replace(/^- r1-s-2 .*\n/m, '').replace(/fed: r1-s-2/g, 'fed: none');
    fs.writeFileSync(path.join(dir, 'cards.md'), deck);
    return dir;
  }
  const shortReason = (dir: string, why: string) => editLog(dir, (l) => { l.stages[3].shortReason = why; });

  it('a round of one composite without a shortReason fails, and passes with one', () => {
    const dir = oneComposite();
    expect(lines(failing(dir), 'deck')).toEqual([
      "check-run: [deck] cards.md's round 1 composes 1 composite(s), 1 of them taking a piece marked under-played; a round is short with fewer than 2, or with none taking one (D-339, D-429), but its R1a-synthesize entry, run-log.json stages[3], has no shortReason; a short round is accepted only with its reason",
    ]);
    shortReason(dir, 'every card shares the Rolling Slam structure but the Earthquake cards, whose links no lookup confirmed');
    passes(dir);
  });

  it('a round whose composites take no under-played piece fails without a shortReason, and passes with one', () => {
    const dir = copy('run-composite');
    for (const id of ['r1-s-1', 'r1-s-2']) editText(dir, `cards/${id}.md`, ', under-played |', ' |');
    expect(lines(failing(dir), 'deck')).toEqual([
      "check-run: [deck] cards.md's round 1 composes 2 composite(s), 0 of them taking a piece marked under-played; a round is short with fewer than 2, or with none taking one (D-339, D-429), but its R1a-synthesize entry, run-log.json stages[3], has no shortReason; a short round is accepted only with its reason",
    ]);
    shortReason(dir, 'no researcher marked a piece under-played');
    passes(dir);
  });

  it('an under-played piece left out takes nothing: only an in or scheduled one counts', () => {
    const dir = copy('run-composite');
    editText(dir, 'cards/r1-s-2.md', ', under-played |', ' |');
    editText(dir, 'cards/r1-s-1.md', '| i1b-1 | Blistering Bond | unique, under-played | in | Ring 2 | its fire adds an ignite to each slam |', '| i1b-1 | Blistering Bond | unique, under-played | out | — | its fire would add an ignite, but the ring slot holds the life ring |');
    expect(lines(failing(dir), 'deck')[0]).toMatch(/round 1 composes 2 composite\(s\), 0 of them taking a piece marked under-played/);
  });

  it('a fixed-roll fixture with two engine composites passes; an engine word outside the vocabulary fails', () => {
    const dir = copy('run-fixed-roll');
    passes(dir);
    const deck = read(dir, 'cards.md');
    // The structure is the engine key, <consumed> from <supply>, under the fixed identity (R1a-synthesize.md step 1).
    expect(deck).toMatch(/^- r1-s-1 "Bleed Burst Lancer" \| bleed from on-hit \|/m);
    expect(deck).toMatch(/^- r1-s-2 "Rage-Fed Lunger" \| rage from on-hit \|/m);
    expect(readJson(dir, 'run-log.json').brief).toEqual({ ascendancy: 'Titan', skill: 'Blood Hunt' });
    editText(dir, 'cards.md', '| rage from on-hit | the lunge', '| fury from on-hit | the lunge');
    expect(lines(failing(dir), 'deck')).toEqual([expect.stringMatching(/cards\.md:\d+: r1-s-2's line: its engine names "fury", which isn't a family of data\/rules\/vocabulary\.md/)]);
  });
});

describe('AC-W84: the Pieces tables (D-429, D-433): a composite is any card with ### Pieces', () => {
  it('a composite without its Pieces measured fails once R1b verified it, and passes before (r1-s-2, not verified)', () => {
    // r1-s-2, never verified, holds what R1a-synthesize wrote: "Not checked yet." under its Pieces measured.
    expect(read(path.join(FIXTURES, 'run-composite'), 'cards/r1-s-2.md')).toMatch(/### Pieces measured\n\nNot checked yet\.\n$/);
    const dir = copy('run-composite');
    editText(dir, 'cards/r1-s-1.md', /\n### Pieces measured[\s\S]*$/, '\n');
    expect(lines(failing(dir), 'pieces')).toEqual([
      'check-run: [pieces] cards/r1-s-1.md has no "### Pieces measured", but R1b verified r1-s-1 (its structure check is written); R1b measures each piece inside its composite, in the card\'s verification half after "### Key item prices" (D-433)',
    ]);
  });

  it('whatever its id letter: run-builds\' r1-a-1 given a Pieces table is a composite, so its verified card needs its Pieces measured', () => {
    const dir = copy('run-builds');
    editText(dir, 'cards/r1-a-1.md', '\n## Verification half', '\n### Pieces\n\n| Key | Piece | Kind | Status | Where | Why | From |\n|---|---|---|---|---|---|---|\n| cr1-a-1-1 | Bloodlust | support | in | group 1 | more damage against bleeding enemies | r1-a-1 |\n\n## Verification half');
    expect(lines(failing(dir), 'pieces')).toEqual([expect.stringMatching(/^check-run: \[pieces\] cards\/r1-a-1\.md has no "### Pieces measured", but R1b verified r1-a-1/)]);
    fs.appendFileSync(path.join(dir, 'cards/r1-a-1.md'), '\n### Pieces measured\n\n| Key | Drops | How |\n|---|---|---|\n| cr1-a-1-1 | Blood Hunt (clear) −10%; Blood Hunt (boss) −10% | Bloodlust removed from group 1 |\n');
    passes(dir);
  });

  it('a measured table with a "not measured (<why>)" row passes (run-composite); a Drops cell in no form fails', () => {
    const dir = copy('run-composite');
    expect(read(dir, 'cards/r1-s-1.md')).toContain("| cr1-a-3-2 | not measured (the probe's compile failed: its group's weapon set held no mace) | — |");
    passes(dir);
    editText(dir, 'cards/r1-s-1.md', '| i1c-1 | Rolling Slam (clear) −6% |', '| i1c-1 | a bit less |');
    expect(lines(failing(dir), 'pieces')).toEqual([expect.stringMatching(/the Pieces measured row "i1c-1"'s Drops is "a bit less"; each figure that moves, "<group> \(<clear \| per corpse \| boss>\) −<x>%"/)]);
  });

  it('a Pieces row out with no reason fails', () => {
    const dir = copy('run-composite');
    editText(dir, 'cards/r1-s-1.md', '| i1a-3 | Elemental Focus | support | out | — | forbids the ignite layer |', '| i1a-3 | Elemental Focus | support | out | — | — |');
    expect(lines(failing(dir), 'pieces')).toEqual([
      expect.stringMatching(/^check-run: \[pieces\] cards\/r1-s-1\.md:\d+: the Pieces row "i1a-3" \(Elemental Focus\) is out with no reason in Why; a scheduled or out piece says why \(D-429, Appendix A\)$/),
    ]);
  });

  it('a card r<k>-s-<n> without ### Pieces fails: a composite lists its pieces', () => {
    const dir = copy('run-composite');
    editText(dir, 'cards/r1-s-2.md', /\n### Pieces\n[\s\S]*$/, '\n');
    expect(lines(failing(dir), 'pieces')).toEqual([expect.stringMatching(/cards\/r1-s-2\.md is a composite's card \(r<k>-s-<n>\), but has no "### Pieces"/)]);
  });

  it('"## Cards" missing a researcher card fails, and a "fed:" naming no composite of the deck fails', () => {
    const dir = copy('run-composite');
    editText(dir, 'cards.md', /^- r1-c-3 .*\n/m, '');
    expect(lines(failing(dir), 'deck')).toEqual([
      'check-run: [deck] cards.md\'s "Cards" doesn\'t list r1-c-3, a researcher\'s card of round 1; the deck lists every card but the composites, the seed marked, with the composites each fed (D-429)',
    ]);
    const fed = copy('run-composite');
    editText(fed, 'cards.md', '| fed: none', '| fed: r1-s-9');
    expect(lines(failing(fed), 'deck')).toEqual([expect.stringMatching(/r1-c-3 fed "r1-s-9", which is no composite the deck holds \(D-429\)/)]);
  });

  it('the deck\'s H2s are Appendix A\'s: a composite deck with the old header fails', () => {
    const dir = copy('run-composite');
    editText(dir, 'cards.md', '## What the composites share', '## What the cards share');
    expect(lines(failing(dir), 'deck')[0]).toMatch(/cards\.md's H2s are .*; R1a-synthesize writes \["What the composites share","How they differ","The obvious build","Round 1","Cards","Pieces not used","Not composed"\], then "Superseded" only when a later round recomposed \(D-429, D-432\)/);
  });
});

describe("AC-W84: R1a-synthesize.md's fixed formats: a composite verified by its structure check, a round of None., Superseded, the structure, the pin's marks", () => {
  it('r1-s-2 holds "Not checked yet." under each H3, Pieces measured among them, and passes; once its structure check is written, its Pieces measured is required', () => {
    const dir = copy('run-composite');
    expect(read(dir, 'cards/r1-s-2.md')).toMatch(/### Structure check\n\nNot checked yet\.\n[\s\S]*### Pieces measured\n\nNot checked yet\.\n$/);
    passes(dir);
    editText(dir, 'cards/r1-s-2.md', '### Structure check\n\nNot checked yet.', '### Structure check\n\n- Earthquake stays the largest clear figure.');
    expect(lines(failing(dir), 'pieces')).toEqual([
      'check-run: [pieces] cards/r1-s-2.md holds only "Not checked yet." under "### Pieces measured", but R1b verified r1-s-2 (its structure check is written); R1b measures each piece inside its composite, in the card\'s verification half after "### Key item prices" (D-433)',
    ]);
  });

  /** run-composite carried on to a second brainstorm round, its synthesis entry given `extra`, stopped at its gate. */
  function secondRound(extra: Json = {}): string {
    const dir = copy('run-composite');
    editLog(dir, (l) => {
      l.stages.push(step('R1a'), step('R1a'), step('R1a'), step('R1a-synthesize', extra));
      l.checkpoints = [answer('brainstorm', 1, 'pick:r1-s-1'), answer('verification', 1, 'more', { note: 'more quakes' }), answer('brainstorm', 2, 'stop')];
    });
    return dir;
  }

  it('a later round that composes none writes "None." under its round, a short round with its reason', () => {
    const dir = secondRound();
    editText(dir, 'cards.md', '\n## Cards\n', '\n## Round 2\n\nNone.\n\n## Cards\n');
    expect(lines(failing(dir), 'deck')).toEqual([expect.stringMatching(/cards\.md's round 2 composes 0 composite\(s\), 0 of them taking a piece marked under-played; .* its R1a-synthesize entry, run-log\.json stages\[9\], has no shortReason/)]);
    const ok = secondRound({ shortReason: 'no structure gained a piece' });
    editText(ok, 'cards.md', '\n## Cards\n', '\n## Round 2\n\nNone.\n\n## Cards\n');
    passes(ok);
  });

  it('a recomposed structure: its successor a later round\'s, the old composite keeps its round line under Superseded; a verified one is never superseded', () => {
    const recompose = (old: string): string => {
      const dir = secondRound({ shortReason: 'one structure gained pieces' });
      compositeFrom(dir, 'r2-s-1', 'Bastion Reforged');
      const name = old === 'r1-s-1' ? 'Aftershock Slammer' : 'Jagged Earth Bastion';
      editText(dir, 'cards.md', '\n## Cards\n', `\n## Round 2\n\n- r2-s-1 "Bastion Reforged" | Warrior, Titan, Earthquake | the quake's hit and its aftershock | Leap Slam between packs | under-played (judgment: armour stacking, rarely paired with Earthquake)\n\n## Cards\n`);
      fs.appendFileSync(path.join(dir, 'cards.md'), `\n## Superseded\n\n- ${old} "${name}" → r2-s-1\n`);
      return dir;
    };
    passes(recompose('r1-s-2'));
    expect(lines(failing(recompose('r1-s-1')), 'deck')).toEqual([
      expect.stringMatching(/^check-run: \[deck\] cards\.md:\d+: supersedes r1-s-1, which R1b verified; a verified or built composite is never superseded, and a recomposition of its structure is a separate composite \(D-429\)$/),
    ]);
  });

  it("a round line's structure is the identity or the engine key; it keeps can't be finalized yet and waits on the pin", () => {
    const dir = copy('run-composite');
    editText(dir, 'cards.md', '| Warrior, Titan, Earthquake | the quake', '| Earthquake | the quake');
    expect(lines(failing(dir), 'deck')).toEqual([expect.stringMatching(/r1-s-2's line: its structure is "Earthquake"; it is "<className>, <ascendancy>, <named damage source>", or under one fixed identity the engine key "<consumed> from <supply>" or "none" \(D-429\)/)]);
    const pin = copy('run-composite');
    editText(pin, 'cards.md', 'rarely paired with Earthquake)\n', "rarely paired with Earthquake) | can't be finalized yet: its mace isn't in the PoB pin | waits on the pin: Crimson Test Mace\n");
    passes(pin);
    editText(pin, 'cards.md', " | can't be finalized yet: its mace isn't in the PoB pin", '');
    expect(lines(failing(pin), 'deck')).toEqual([expect.stringMatching(/r1-s-2 waits on the pin, but its line isn't marked "can't be finalized yet: <why>"/)]);
  });
});

describe('AC-W84: the probe cap, 8 for a composite and 4 for a plain card (D-433, D-292)', () => {
  it('a composite with 8 probes passes and 9 fails', () => {
    const dir = copy('run-composite');
    addProbe(dir, 'r1-s-1', 6, 7);
    addProbe(dir, 'r1-s-1', 6, 8);
    editLog(dir, (l) => { l.stages[4].probes = 8; });
    passes(dir);
    addProbe(dir, 'r1-s-1', 6, 9);
    editLog(dir, (l) => { l.stages[4].probes = 9; });
    expect(lines(failing(dir), 'probes')).toEqual([
      "check-run: [probes] run-log.json stages[4]: R1b r1-s-1 logs 9 probes; a composite has at most 8: the checklist's 4, then 4 leave-one-outs (D-433)",
      "check-run: [probes] probes/r1-s-1/ holds 9 probe variants; a composite has at most 8: the checklist's 4, then 4 leave-one-outs (D-433)",
      "check-run: [probes] run-log.json's R1b entries for r1-s-1 log 9 probes; a composite has at most 8: the checklist's 4, then 4 leave-one-outs (D-433)",
    ]);
  });

  it('a plain card with 5 probes fails', () => {
    const dir = copy('run-builds');
    for (const n of [3, 4, 5]) addProbe(dir, 'r1-a-1', 2, n);
    editLog(dir, (l) => { l.stages[4].probes = 5; });
    expect(lines(failing(dir), 'probes')).toEqual([
      'check-run: [probes] run-log.json stages[4]: R1b r1-a-1 logs 5 probes; a card has at most 4 (D-292)',
      'check-run: [probes] probes/r1-a-1/ holds 5 probe variants; a card has at most 4 (D-292)',
      "check-run: [probes] run-log.json's R1b entries for r1-a-1 log 5 probes; a card has at most 4 (D-292)",
    ]);
  });
});

describe('AC-W84: old runs keep R1a-assemble; a run mixing the two steps fails (D-429)', () => {
  it('a schema-4 run with R1a-assemble passes (run-builds)', () => {
    const dir = copy('run-builds');
    expect((readJson(dir, 'run-log.json').stages as Json[]).filter((s) => s.stage.startsWith('R1a-')).map((s) => s.stage)).toEqual(['R1a-assemble']);
    passes(dir);
  });

  it('a composite run whose second round runs R1a-assemble fails the order', () => {
    const dir = copy('run-composite');
    editLog(dir, (l) => {
      l.stages.push(step('R1a'), step('R1a'), step('R1a'), step('R1a-assemble'));
      l.checkpoints = [answer('brainstorm', 1, 'pick:r1-s-1'), answer('verification', 1, 'more', { note: 'more slams' }), answer('brainstorm', 2, 'stop')];
    });
    expect(lines(failing(dir), 'order')).toEqual([
      "check-run: [order] run-log.json stages[9] (R1a-assemble attempt 1): runs R1a-assemble, but this run's first brainstorm round ran R1a-synthesize; a run whose first round used R1a-assemble keeps it for every later round, and one that composed keeps R1a-synthesize: the two never mix in one run (D-429)",
    ]);
  });

  it('run-log.mjs refuses the other step once a run has used one, and takes R1a-synthesize only in schema 4', () => {
    const dir = path.join(TMP, `mixed-${++copies}`, 'titan-open', '2026-10-23-1');
    fs.mkdirSync(dir, { recursive: true });
    const write = (kind: string, entry: Json) => node(RUN_LOG, [dir, kind, '-'], { input: JSON.stringify(entry) });
    expect(write('init', { slug: 'titan-open', brief: { ascendancy: 'Titan' }, mode: 'offline', testConfig: 'none', noNinja: false }).code).toBe(0);
    expect(write('stage', step('R1a')).code).toBe(0);
    expect(write('stage', step('R1a-assemble')).code).toBe(0);
    const r = write('stage', step('R1a-synthesize', { shortReason: 'one structure' }));
    expect(r).toEqual({ code: 1, stdout: '', stderr: "run-log: stage entry refused: this run's brainstorm rounds use R1a-assemble, as its first round did; a run whose first round used R1a-assemble keeps it for every later round, and a run that composes keeps R1a-synthesize (D-429)\n" });
    // A schema-3 log has no R1a-synthesize: it is schema 4's.
    editJson(dir, 'run-log.json', (l) => { l.schemaVersion = 3; l.stages = []; });
    expect(write('stage', step('R1a-synthesize')).stderr).toMatch(/stage "R1a-synthesize" isn't one of .* \(R1a-synthesize is schema 4's: migrate the log first\)/);
  });
});

describe('AC-W84: the dossier\'s twelve columns on a composite run (D-433)', () => {
  it('twelve pass; eleven, without key pieces, fail', () => {
    passes(copy('run-composite'));
    const dir = copy('run-composite');
    const text = read(dir, 'dossier.md').split('\n').map((l) => (l.startsWith('|') ? l.replace(/ [^|]*\|$/, '').replace(/\|---\|$/, '|') : l)).join('\n');
    fs.writeFileSync(path.join(dir, 'dossier.md'), text);
    expect(read(dir, 'dossier.md')).toContain('| Card | Round | Status | Synergy | Named source DPS | Life | EHP | Clear speed | Key prices | League | Main risk |\n|---|---|---|---|---|---|---|---|---|---|---|\n');
    expect(lines(failing(dir), 'dossier-sections')).toEqual([
      expect.stringMatching(/the table's columns are \["Card",.*"Main risk"\]; a composite run's comparison has twelve, \["Card","Round","Status","Synergy","Named source DPS","Life","EHP","Clear speed","Key prices","League","Main risk","key pieces"\], in that order/),
    ]);
  });
});

// ---------------------------------------------------------------------------------------------------
// The build's folder, the design display, the V4 report, the build's name and the stale build (D-434, D-435)
// ---------------------------------------------------------------------------------------------------

describe('AC-W84: pieces.md in a build folder, and the design display\'s pieces line (D-434)', () => {
  it('pieces.md in a build folder passes; another file there fails', () => {
    const dir = copy('run-builds');
    fs.writeFileSync(path.join(dir, 'builds/r1-a-1/pieces.md'), [
      '# Pieces: Blood Hunt bleed burst', '',
      '| Key | Piece | Kind | Status | Where | Why | From |', '|---|---|---|---|---|---|---|',
      '| cr1-a-1-1 | Bloodlust | support | in | group 1 | more damage against bleeding enemies | r1-a-1 |', '',
      '## Searched', '', '- Q17 after the cost moved to life: searched a refund of life on hit; found none in the pin', '',
    ].join('\n'));
    passes(dir);
    fs.writeFileSync(path.join(dir, 'builds/r1-a-1/notes.md'), 'x\n');
    expect(lines(failing(dir), 'layout')).toEqual([expect.stringMatching(/builds\/r1-a-1: notes\.md isn't part of a build's folder \(plan\.json, compile-record\.json, compiled-build\.xml, guide\.md, audit\.md, pieces\.md, trades\.json, reports\/, rounds\/; D-412, D-434, D-439\)/)]);
  });

  it("the design display prints the pieces line from the D1 gate's pieces, once, before the rungs", () => {
    const dir = copy('run-builds');
    editJson(dir, 'reports/gates/D1-gate-r1-a-1-a1.json', (g) => {
      g.design.pieces = { in: 4, scheduled: 1, out: 2, scheduledNames: ['Seismic Cry'], outNames: ['Elemental Focus', 'Shield Wall'] };
    });
    const out = display(dir, 'design', '--build', 'r1-a-1');
    const at = out.indexOf('- Pieces: 4 in, 1 scheduled (Seismic Cry), 2 out (Elemental Focus, Shield Wall)');
    expect(at).toBe(4);
    expect(out.filter((l) => l.startsWith('- Pieces:'))).toHaveLength(1);
    expect(out[at + 2]).toBe('Entering maps (level 65):');
    // A design field with no pieces (a build from before amendment 10) prints none.
    expect(display(copy('run-builds'), 'design', '--build', 'r1-a-1').filter((l) => l.startsWith('- Pieces:'))).toEqual([]);
    // No scheduled piece: "none" in its parentheses.
    editJson(dir, 'reports/gates/D1-gate-r1-a-1-a1.json', (g) => { g.design.pieces = { in: 3, scheduled: 0, out: 0, scheduledNames: [], outNames: [] }; });
    expect(display(dir, 'design', '--build', 'r1-a-1')).toContain('- Pieces: 3 in, 0 scheduled (none), 0 out (none)');
  });
});

describe('AC-W84: a V4 report with an empty list item passes (D-435)', () => {
  it('a stray "- " in its head, its Checked list and its Findings is ignored', () => {
    const dir = copy('run-builds');
    editText(dir, 'builds/r1-a-2/reports/V4-1.md', '- verdict: pass\n', '- verdict: pass\n- \n');
    editText(dir, 'builds/r1-a-2/reports/V4-1.md', '- section Changelog\n', '- section Changelog\n-\n');
    editText(dir, 'builds/r1-a-2/reports/V4-1.md', 'None.', 'None.\n- ');
    passes(dir);
    // A list item with text that isn't the form's still fails.
    editText(dir, 'builds/r1-a-2/reports/V4-1.md', '- section Changelog\n', '- section Changelog\n- not a checked item\n');
    expect(lines(failing(dir), 'report-shape')).toEqual([expect.stringMatching(/## Checked lists "not a checked item"/)]);
  });
});

describe('AC-W84: build accepts name, and the re-rendered audit\'s title matches it (D-435)', () => {
  it('run-log.mjs build takes name for a queued build and on an update; builds[] carries it after roll', () => {
    const dir = path.join(TMP, `named-${++copies}`, 'titan-open', '2026-10-23-1');
    fs.mkdirSync(dir, { recursive: true });
    const write = (kind: string, entry: Json) => node(RUN_LOG, [dir, kind, '-'], { input: JSON.stringify(entry) });
    expect(write('init', { slug: 'titan-open', brief: { ascendancy: 'Titan' }, mode: 'offline', testConfig: 'none', noNinja: false }).code).toBe(0);
    const roll = { className: 'Warrior', ascendancy: 'Titan', skill: 'Rolling Slam' };
    expect(write('build', { id: 'r1-s-1', roll, name: 'Aftershock Slammer', status: 'queued' })).toEqual({ code: 0, stdout: 'run-log: wrote builds[0]\n', stderr: '' });
    expect(readJson(dir, 'run-log.json').builds).toEqual([{ id: 'r1-s-1', roll, name: 'Aftershock Slammer', status: 'queued', folder: 'builds/r1-s-1', guide: null, pobFile: null }]);
    expect(write('build', { id: 'r1-s-1', name: 'Aftershock Slammer, two-handed' }).code).toBe(0);
    expect(readJson(dir, 'run-log.json').builds[0].name).toBe('Aftershock Slammer, two-handed');
    expect(write('build', { id: 'r1-s-1', name: ' ' }).stderr).toMatch(/name is the build's name, the card's or the one its finalize revision gave it, a non-empty text \(D-435\)/);
    // A build with no name keeps the six fields.
    expect(write('build', { id: 'r1-a-1', roll, status: 'queued' }).code).toBe(0);
    expect(Object.keys(readJson(dir, 'run-log.json').builds[1])).toEqual(['id', 'roll', 'status', 'folder', 'guide', 'pobFile']);
  });

  it("the audit's title is builds[].name, else the card's H1; F1's render and the checker's re-render agree", () => {
    const dir = copy('run-builds');
    expect(read(dir, 'builds/r1-a-2/audit.md')).toMatch(/^# Audit: Titan \/ Blood Hunt, Blood Hunt with Rolling Slam clear\n/);
    const r = node(RUN_LOG, [dir, 'build', '-'], { input: JSON.stringify({ id: 'r1-a-2', name: 'Slam-Cleared Blood Hunt' }) });
    expect(r.code).toBe(0);
    expect(Object.keys(readJson(dir, 'run-log.json').builds[1])).toEqual(['id', 'roll', 'name', 'status', 'folder', 'guide', 'pobFile']);
    // The audit rendered before the name no longer equals the checker's re-render, which titles it by the name.
    expect(lines(failing(dir), 'audit-render')).toEqual([expect.stringMatching(/builds\/r1-a-2: audit\.md:1 is "# Audit: Titan \/ Blood Hunt, Blood Hunt with Rolling Slam clear", but render-audit\.mjs renders "# Audit: Titan \/ Blood Hunt, Slam-Cleared Blood Hunt"/)]);
    expect(node(RENDER, [dir, '--build', 'r1-a-2']).code).toBe(0);
    expect(read(dir, 'builds/r1-a-2/audit.md')).toMatch(/^# Audit: Titan \/ Blood Hunt, Slam-Cleared Blood Hunt\n/);
    passes(dir);
  });

  it('render-audit.mjs takes a composite\'s id, the letter s', () => {
    const r = node(RENDER, [copy('run-builds'), '--build', 'r1-s-1']);
    expect(r).toEqual({ code: 1, stdout: '', stderr: 'render-audit: run-log.json has no build r1-s-1; builds[] holds r1-a-1, r1-a-2\n' });
  });
});

describe('AC-W84: the checker against a stale build (D-435)', () => {
  /** A server folder: build/plan/ledger.js and buildHash.js copied from the repository's build, src/plan/ beside it. */
  function server(staleHash: boolean): string {
    const root = path.join(TMP, `server-${++copies}`);
    fs.mkdirSync(path.join(root, 'build', 'plan'), { recursive: true });
    fs.mkdirSync(path.join(root, 'src', 'plan'), { recursive: true });
    for (const m of ['ledger', 'buildHash']) {
      fs.copyFileSync(path.join(REPO, 'build', 'plan', `${m}.js`), path.join(root, 'build', 'plan', `${m}.js`));
      fs.copyFileSync(path.join(REPO, 'src', 'plan', `${m}.ts`), path.join(root, 'src', 'plan', `${m}.ts`));
      const built = new Date('2026-10-23T10:00:00Z');
      const source = m === 'buildHash' && staleHash ? new Date('2026-10-23T11:00:00Z') : new Date('2026-10-23T09:00:00Z');
      fs.utimesSync(path.join(root, 'build', 'plan', `${m}.js`), built, built);
      fs.utimesSync(path.join(root, 'src', 'plan', `${m}.ts`), source, source);
    }
    return path.join(root, 'build');
  }
  const WARNING = "check-run: warning: the server's build/plan/buildHash.js is older than its source src/plan/buildHash.ts, so a record-plan or ledger violation may come from the stale build, not the run: rebuild the server (pnpm build) and check again (D-435)";

  it('warns when build/plan/buildHash.js is older than its source, and still reports the violation', () => {
    const dir = copy('run-builds');
    editJson(dir, 'builds/r1-a-2/plan.json', (p) => { p.stages[0].level = 66; });
    const r = check(dir, { BUILD_GUIDE_SERVER_BUILD: server(true) });
    expect(r.code).toBe(1);
    const err = r.stderr.split('\n');
    expect(err[0]).toBe(WARNING);
    expect(err.filter((l) => l.startsWith('check-run: warning:'))).toHaveLength(1);
    expect(lines(r.stderr, 'record-plan')).toEqual([expect.stringMatching(/builds\/r1-a-2: sha1\(plan\.json\) is [0-9a-f]{40}, but the final record's planSha1 is/)]);
  });

  it('a fresh build warns nothing; a passing run with a stale build still passes, with its warning', () => {
    expect(check(copy('run-builds'), { BUILD_GUIDE_SERVER_BUILD: server(false) })).toEqual({ code: 0, stdout: expect.stringMatching(/^check-run: ok: /), stderr: '' });
    expect(check(copy('run-builds'), { BUILD_GUIDE_SERVER_BUILD: server(true) })).toEqual({ code: 0, stdout: expect.stringMatching(/^check-run: ok: /), stderr: `${WARNING}\n` });
  });

  it('display final prints the warning, under For reference', () => {
    const dir = copy('run-builds');
    const r = node(RUN_LOG, [dir, 'display', 'final', '--build', 'r1-a-2'], { env: { BUILD_GUIDE_SERVER_BUILD: server(true) } });
    expect(r.code).toBe(0);
    const out = r.stdout.split('\n');
    expect(out).toContain('- The run checker also warns: one warning, listed under For reference; a problem it found may come from the warning\'s cause.');
    expect(out.slice(out.indexOf('For reference:'))).toContain(`- Run checker warning: ${WARNING.replace('check-run: warning: ', '')}`);
  });
});

// ---------------------------------------------------------------------------------------------------
// The brainstorm gate (D-432): its display, and a gate-made card's `from`
// ---------------------------------------------------------------------------------------------------

describe('AC-W84: the brainstorm display lists each composite\'s pieces (D-432, Appendix A)', () => {
  it('each composite\'s round line, then its in, scheduled and out lines; the obvious build; every plain card, one line each; ids last', () => {
    const dir = atBrainstorm('run-composite');
    const out = display(dir, 'brainstorm');
    expect(out.slice(0, 3)).toEqual(['## The brainstorm gate, visit 1', '', 'Brief: ascendancy Titan']);
    const first = out.indexOf('1. Aftershock Slammer | Warrior, Titan, Rolling Slam | the slam\'s hit, its aftershock, an ignite from Blistering Bond | Seismic Cry\'s cooldown kept on a boss button, never the clear | under-played (judgment: a fire ring on a physical slam, which few slam builds take)');
    expect(first).toBeGreaterThan(0);
    expect(out.slice(first + 1, first + 5)).toEqual([
      "  in: Rolling Slam, Fist of War, Blistering Bond, Titan's slam notables",
      '  scheduled: Seismic Cry (group 2, single_target)',
      '  out: Elemental Focus (forbids the ignite layer)',
      '',
    ]);
    const second = out.indexOf('2. Jagged Earth Bastion | Warrior, Titan, Earthquake | the quake\'s hit and its aftershock | the aftershock\'s delay covered by Leap Slam between packs | under-played (judgment: armour stacking on a quake build, rarely paired with Earthquake)');
    expect(out.slice(second + 1, second + 4)).toEqual([
      '  in: Earthquake, increased Physical Damage on a two-handed mace, increased Armour on the body armour, the armour wheel',
      '  scheduled: Leap Slam (group 2)',
      '  out: Shield Wall (a shield fights the two-handed mace)',
    ]);
    const obvious = out.indexOf('The obvious build: none.');
    expect(obvious).toBeGreaterThan(second);
    const cards = out.indexOf('The plain cards (9), each can be verified on its own:');
    expect(cards).toBeGreaterThan(obvious);
    expect(out.slice(cards + 1, cards + 10)).toEqual([
      '3. Rolling Slam aftershock clear: Warrior, Titan, Rolling Slam',
      '4. Earthquake jagged ground: Warrior, Titan, Earthquake',
      '5. Rolling Slam with Seismic Cry: Warrior, Titan, Rolling Slam',
      '6. Earthquake on a two-handed mace: Warrior, Titan, Earthquake',
      '7. Rolling Slam with a fire ring: Warrior, Titan, Rolling Slam',
      '8. Earthquake armour tank: Warrior, Titan, Earthquake',
      "9. Rolling Slam with Titan's slam notables: Warrior, Titan, Rolling Slam",
      '10. Earthquake block wall: Warrior, Titan, Earthquake',
      '11. Rolling Slam stun lock: Warrior, Titan, Rolling Slam',
    ]);
    const ref = out.indexOf('For reference:');
    expect(out.slice(0, ref).join('\n')).not.toMatch(/\br\d+-[a-csgx]-\d+\b/);
    expect(out.slice(ref, ref + 3)).toEqual(['For reference:', '- 1. Aftershock Slammer: r1-s-1', '- 2. Jagged Earth Bastion: r1-s-2']);
    expect(readJson(dir, 'run-log.json').displays).toEqual([{ checkpoint: 'brainstorm', visit: 1 }]);
  });

  it('the fixed roll: the obvious build\'s line, the baseline as its card was written', () => {
    const dir = copy('run-fixed-roll');
    editJson(dir, 'run-log.json', (l) => { l.checkpoints = []; l.displays = []; l.status = 'running'; });
    const out = display(dir, 'brainstorm');
    expect(out).toContain('The obvious build, the baseline as its card was written: Blood Hunt bleed burst | the melee kit for a spear lunge: bleed supports on the lunge, life and armour on the gear');
    expect(out).toContain('1. Bleed Burst Lancer | bleed from on-hit | the lunge\'s hit, its Blood Loss burst, Herald of Blood\'s explosions | Blood Loss built by every hit, so the burst never waits | under-played (judgment: armour stacking on a spear lunge, which few lunge builds take)');
    expect(out).toContain('  scheduled: Herald of Blood (group 2)');
    expect(out).toContain('- Obvious build: Blood Hunt bleed burst: r1-a-1');
  });

  it('a verified composite leaves the list, and a short round says why', () => {
    const dir = copy('run-composite');
    editLog(dir, (l) => {
      l.stages[3].shortReason = 'two structures only';
      l.checkpoints = [answer('brainstorm', 1, 'pick:r1-s-1'), answer('verification', 1, 'more', { note: 'more slams' })];
      l.stages.push(step('R1a'), step('R1a'), step('R1a'), step('R1a-synthesize', { shortReason: 'no structure gained a piece' }));
      l.status = 'running';
    });
    editText(dir, 'cards.md', '\n## Cards\n', '\n## Round 2\n\nNone.\n\n## Cards\n');
    const out = display(dir, 'brainstorm');
    expect(out.filter((l) => /^\d+\. /.test(l))[0]).toBe('1. Jagged Earth Bastion | Warrior, Titan, Earthquake | the quake\'s hit and its aftershock | the aftershock\'s delay covered by Leap Slam between packs | under-played (judgment: armour stacking on a quake build, rarely paired with Earthquake)');
    expect(out).toContain('A short round: no structure gained a piece');
  });
});

describe('AC-W84: a gate-made card\'s from names cards, composites and piece keys (D-432)', () => {
  const NEW = { id: 'r1-g-1', name: 'Slam Bastion', words: 'the slam with the armour wheel' };
  function at(): string {
    const dir = atBrainstorm('run-composite');
    display(dir, 'brainstorm');
    return dir;
  }
  const pick = (dir: string, from: string[]) => node(RUN_LOG, [dir, 'checkpoint', '-'], { input: JSON.stringify(answer('brainstorm', 1, 'pick:r1-s-1', { newCards: [{ ...NEW, from }] })) });

  it('a from naming a Pieces row\'s key, an Ideas line\'s id, a composite and a card passes', () => {
    const dir = at();
    expect(pick(dir, ['r1-s-1', 'r1-b-3', 'cr1-a-3-2', 'i1c-2'])).toEqual({ code: 0, stdout: 'run-log: wrote checkpoints[0]\n', stderr: '' });
    expect(readJson(dir, 'run-log.json').checkpoints[0].newCards[0].from).toEqual(['r1-s-1', 'r1-b-3', 'cr1-a-3-2', 'i1c-2']);
    // The checker takes a piece key in from as the checkpoint's form.
    expect(lines(check(dir).stderr, 'run-log').filter((l) => /newCards/.test(l))).toEqual([]);
    // An Ideas id no card uses (Leap Slam's, on: none) is a piece too.
    expect(pick(at(), ['i1c-3']).code).toBe(0);
  });

  it('a from naming neither, nor a card, fails', () => {
    expect(pick(at(), ['r1-s-1', 'i1c-9']).stderr).toBe('run-log: checkpoint entry refused: newCards[0] draws on i1c-9, which is no Pieces row\'s key on a card of the run and no Ideas line\'s id in its research files (D-432)\n');
    expect(pick(at(), ['cr1-c-3-4']).stderr).toMatch(/draws on cr1-c-3-4, which is no Pieces row's key on a card of the run and no Ideas line's id/);
    expect(pick(at(), ['r1-a-9']).stderr).toMatch(/newCards\[0\] draws on r1-a-9, which the deck \(cards\.md\) doesn't hold \(D-391\)/);
    expect(pick(at(), ['Blistering Bond']).stderr).toMatch(/newCards\[0\] from lists the card ids it draws on, one or more, composites among them, or piece keys: a Pieces row's key or an Ideas line's id \(D-432\)/);
  });

  it('a test config\'s new card may name piece keys', () => {
    const cfg = path.join(TMP, `cfg-${++copies}.json`);
    fs.writeFileSync(cfg, JSON.stringify({ answers: { brainstorm: [{ answer: 'pick:r1-s-1', newCards: [{ name: 'Slam Bastion', from: ['r1-s-1', 'i1c-2'], words: 'x' }] }] } }));
    expect(node(RUN_LOG, [TMP, 'test-config', cfg]).code).toBe(0);
  });
});

// ---------------------------------------------------------------------------------------------------
// scripts/run-usage.mjs (D-435): cache read per query_source, and the composite's letter
// ---------------------------------------------------------------------------------------------------

describe('AC-W84: run-usage.mjs prints cache read per query_source', () => {
  it('each telemetry row carries its cache read; a composite\'s concept groups its build', () => {
    const dir = path.join(TMP, `usage-${++copies}`);
    fs.mkdirSync(path.join(dir, 'sess-1', 'subagents'), { recursive: true });
    const usage = (n: number) => ({ input_tokens: 10, output_tokens: n, cache_read_input_tokens: 100, cache_creation_input_tokens: 5, output_tokens_details: { thinking_tokens: 0 } });
    const entry = (req: string, n: number, prompt?: string) => [
      ...(prompt ? [{ type: 'user', sessionId: 'sess-1', message: { role: 'user', content: prompt } }] : []),
      { type: 'assistant', sessionId: 'sess-1', requestId: req, message: { id: `msg-${req}`, model: 'm', usage: usage(n), content: [{ type: 'text', text: 'x' }] } },
    ];
    const jsonl = (es: Json[]) => `${es.map((e) => JSON.stringify(e)).join('\n')}\n`;
    const main = path.join(dir, 'sess-1.jsonl');
    fs.writeFileSync(main, jsonl(entry('main', 50, 'go')));
    fs.writeFileSync(path.join(dir, 'sess-1', 'subagents', 'agent-a1.jsonl'), jsonl(entry('sub', 300, '```json\n{"stage": "D1-build", "concept": "r1-s-1", "attempt": 1}\n```')));
    const event = (req: string, source: string, out: number, cacheRead: number) => ({ kind: 'event', name: 'api_request', attributes: { 'session.id': 'sess-1', request_id: req, output_tokens: out, input_tokens: 1, cache_read_tokens: cacheRead, cache_creation_tokens: 0, query_source: source, model: 'm' } });
    const tel = path.join(dir, 'events.jsonl');
    fs.writeFileSync(tel, jsonl([event('main', 'repl_main_thread', 50, 2000), event('sub', 'agent:custom', 300, 5000), event('bg-1', 'agent_summary', 40, 230000), event('bg-2', 'agent_summary', 40, 230000)]));
    const out = path.join(dir, 'out.json');
    const r = node(USAGE, [main, '--telemetry', tel, '--json', out]);
    expect({ code: r.code, stderr: r.stderr }).toEqual({ code: 0, stderr: '' });
    const rows = r.stdout.split('\n').filter((l) => /^ {2}\S.* \| m +\d+ req {2}output /.test(l));
    expect(rows).toEqual([
      expect.stringMatching(/^ {2}agent:custom \| m +1 req {2}output +0\.3K {2}cache read +5\.0K$/),
      expect.stringMatching(/^ {2}agent_summary \| m +2 req {2}output +0\.1K {2}cache read +460\.0K$/),
      expect.stringMatching(/^ {2}repl_main_thread \| m +1 req {2}output +0\.1K {2}cache read +2\.0K$/),
    ]);
    const res = readJson(dir, 'out.json');
    expect(res.telemetry.bySource.find((s: Json) => s.key === 'agent_summary | m').cacheRead).toBe(460000);
    expect(res.builds.map((b: Json) => b.key)).toEqual(['r1-s-1']);
  });
});
