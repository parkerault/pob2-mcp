/**
 * Amendment 16's M-30, WU-164 (D-522, D-518, D-512; §18, §14, §15, §16, §17): a guide from a PoB file, `/pob2:build-guide`
 * from the player's own build, each script spawned as a real `node` process with an explicit env and the test clock
 * (`BUILD_GUIDE_TEST_NOW`, `tests/helpers/runningDigests.ts`'s `TEST_NOW`), on the committed fixture file run (offline),
 * `tests/fixtures/file-run`: its brief `from` (slug `file`), the read at the folder's root (the read plan placed on the
 * budget rung by the user's word, `read.json` naming the character's legacy Bloodlust), then the ladder around the placed
 * rung in `builds/file/` (D1-build to the D1 gate in the `ladder` scope), waiting at its design gate. The ladder is
 * run-a14's hand-made build (`tests/fixtures/pipeline/run-a14`), its budget rung the placed one, keeping the reader's
 * `source`, its rares specs, Bloodlust replaced by Heft as a trade; the read files at the root are hand-made from that
 * rung, as run-a14's own files are (the checker reads the read plan, its record's form and `read.json`).
 *
 * - AC-W156: the brief accepts `from` and `better` and gives the slug `file` (at `init` and in the checker); a build name
 *   that matches no file, or several, is asked about with the closest names (the runner's step, on `list_builds`' real
 *   reply); the fixture passes the checker in the file-run order (`read`, `measure`, `place`, then `D1-build`; no R1a, R1b
 *   or verification gate), its placed rung's items and tree kept, its rares as specs, a planted owned legacy gem shown as
 *   a trade, the other rungs designed, the placed rung's floor and tree parts findings (a planted run that fails it for
 *   them fails); with `better` the result is placed again; a declined campaign runs no D2.
 * - AC-W157: on a fixture build with a switched buff, the guide's line for it passes `switched-buffs`, and a guide without
 *   it fails.
 * - Carried from WU-162's verifier: the checker's own `draftFile` rule on a compile run's escalation.
 *
 * check-run and run-log load the server's compiled `build/plan/`: `mise run test` builds first.
 */
import { describe, it, expect, afterAll, beforeAll } from '@jest/globals';
import { spawnSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { TEST_NOW } from '../helpers/runningDigests';
import { startTestServer, type TestServer } from '../helpers/server';

type Json = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

const REPO = path.resolve(__dirname, '..', '..');
const SCRIPTS = path.join(REPO, 'skills', 'build-guide', 'scripts');
const CHECKER = path.join(SCRIPTS, 'check-run.mjs');
const RUN_LOG = path.join(SCRIPTS, 'run-log.mjs');
const FIXTURE = path.join(REPO, 'tests', 'fixtures', 'file-run');
const PIPELINE = path.join(REPO, 'tests', 'fixtures', 'pipeline');
const PIECES = path.join(REPO, 'tests', 'fixtures', 'pieces');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'file-run-'));
afterAll(() => fs.rmSync(TMP, { recursive: true, force: true }));

const ENV = { PATH: '/usr/bin:/bin', LANG: 'C', BUILD_GUIDE_TEST_NOW: TEST_NOW };
function node(script: string, args: string[]) {
  const r = spawnSync(process.execPath, [script, ...args], { cwd: TMP, env: ENV, encoding: 'utf8', timeout: 60000 });
  return { code: r.status, stdout: r.stdout, stderr: r.stderr };
}
const check = (dir: string) => node(CHECKER, [dir]);
const write = (dir: string, kind: string, entry: Json) => node(RUN_LOG, [dir, kind, JSON.stringify(entry)]);
/** The broken rule's lines on stderr. */
const lines = (stderr: string, rule: string) => stderr.split('\n').filter((l) => l.startsWith(`check-run: [${rule}] `));
/** Every rule a checker's stderr names. */
const rulesIn = (stderr: string) => [...new Set(stderr.split('\n').map((l) => /^check-run: \[([^\]]+)\] /.exec(l)?.[1]).filter((x): x is string => x !== undefined))].sort();
function passes(dir: string): void {
  const r = check(dir);
  expect({ stderr: r.stderr, code: r.code }).toEqual({ stderr: '', code: 0 });
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

let copies = 0;
/** A copy of a run folder in its own guides root, `<root>/<slug>/2026-12-01-1/`, its log's runFolder that folder. */
function copy(from: string, slug = 'file'): string {
  const dir = path.join(TMP, `root-${++copies}`, slug, '2026-12-01-1');
  fs.mkdirSync(path.dirname(dir), { recursive: true });
  fs.cpSync(from, dir, { recursive: true });
  editJson(dir, 'run-log.json', (l) => {
    l.runFolder = dir;
  });
  return dir;
}
const fileRun = () => copy(FIXTURE);
/** A fresh run folder for init. */
function folder(slug: string): string {
  const dir = path.join(TMP, `root-${++copies}`, slug, '2026-12-01-1');
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}
const GATE = 'reports/gates/D1-gate-file-a1.json';
const LADDER = 'builds/file/plan.json';
const stageOf = (plan: Json, id: string) => plan.stages.find((s: Json) => s.id === id);

// ---------------------------------------------------------------------------------------------------
// The brief: from, better and the slug file
// ---------------------------------------------------------------------------------------------------

describe('AC-W156 (WU-164, D-522, C-51): the brief accepts from and better and gives the slug file', () => {
  it('init takes a brief with from (and better) on the slug file, and refuses from on another slug, or the slug without it', () => {
    expect(write(folder('file'), 'init', { slug: 'file', brief: { from: 'MyCharacter123.xml', better: true }, mode: 'offline', testConfig: 'none', noNinja: false })).toMatchObject({ code: 0, stdout: expect.stringMatching(/^run-log: wrote the first log\n/), stderr: '' });
    expect(write(folder('file'), 'init', { slug: 'file', brief: { from: 'import code', campaign: false }, mode: 'online', testConfig: 'none', noNinja: false }).code).toBe(0);
    expect(write(folder('open'), 'init', { slug: 'open', brief: { from: 'MyCharacter123.xml' }, mode: 'offline', testConfig: 'none', noNinja: false })).toMatchObject({ code: 1, stderr: expect.stringMatching(/slug is "open"; a run from a PoB file \(brief\.from\) has the slug file: guide_run \{new_run: "file"\} \(D-522\)/) });
    expect(write(folder('file'), 'init', { slug: 'file', brief: {}, mode: 'offline', testConfig: 'none', noNinja: false })).toMatchObject({ code: 1, stderr: expect.stringMatching(/slug file is a run from a PoB file's, whose brief names the file in from; this brief has none \(D-522\)/) });
    expect(write(folder('open'), 'init', { slug: 'open', brief: { better: true }, mode: 'offline', testConfig: 'none', noNinja: false })).toMatchObject({ code: 1, stderr: expect.stringMatching(/brief\.better is a run from a PoB file's \(brief\.from\); this brief names no file \(D-522\)/) });
    expect(write(folder('file'), 'init', { slug: 'file', brief: { from: 'X.xml', better: 'yes' }, mode: 'offline', testConfig: 'none', noNinja: false })).toMatchObject({ code: 1, stderr: expect.stringMatching(/brief\.better is "yes"; true or false \(D-522\)/) });
    expect(write(folder('file'), 'init', { slug: 'file', brief: { from: '  ' }, mode: 'offline', testConfig: 'none', noNinja: false })).toMatchObject({ code: 1, stderr: expect.stringMatching(/brief\.from is "  "; the PoB file the run starts from/) });
  });

  it('the checker gives a brief with from the slug file, and fails another slug, better outside a file run, or a non-boolean better', () => {
    passes(fileRun());
    const open = fileRun();
    editJson(open, 'run-log.json', (l) => {
      l.slug = 'open';
    });
    expect(lines(check(open).stderr, 'run-log')).toContainEqual(expect.stringMatching(/run-log\.json slug: is "open"; the brief's slug is "file": the slug comes from the brief/));
    const odd = fileRun();
    editJson(odd, 'run-log.json', (l) => {
      l.brief.better = 'yes';
      l.brief.campaign = 0;
    });
    expect(lines(check(odd).stderr, 'run-log')).toEqual(expect.arrayContaining([
      expect.stringMatching(/run-log\.json brief\.better: is "yes"; true or false \(D-522\)/),
      expect.stringMatching(/run-log\.json brief\.campaign: is 0; true or false \(D-522\)/),
    ]));
    // A pipeline run's brief takes neither better nor campaign.
    const pipeline = copy(path.join(PIPELINE, 'run-a14'), 'titan-blood-hunt');
    editJson(pipeline, 'run-log.json', (l) => {
      l.brief.better = true;
    });
    expect(lines(check(pipeline).stderr, 'run-log')).toEqual([expect.stringMatching(/run-log\.json brief\.better: is a run from a PoB file's \(brief\.from\); this brief names no file \(D-522\)/)]);
  });
});

// ---------------------------------------------------------------------------------------------------
// The runner's step: a build the user names, matched against list_builds
// ---------------------------------------------------------------------------------------------------

describe("AC-W156 (WU-164, §12): a build the user names is matched against list_builds, never guessed", () => {
  let server: TestServer;
  let builds: string;
  const RULE = fs.readFileSync(path.join(REPO, 'skills', 'build-guide', 'references', 'file-run.md'), 'utf8').replace(/\s+/g, ' ');
  beforeAll(async () => {
    builds = path.join(TMP, 'builds');
    for (const rel of ['MyCharacter123.xml', 'league/mycharacter123.xml', 'MyCharacter12.xml', 'Other Build.XML', 'old/Witch.xml']) {
      fs.mkdirSync(path.dirname(path.join(builds, rel)), { recursive: true });
      fs.writeFileSync(path.join(builds, rel), '<?xml version="1.0" encoding="UTF-8"?>\n<PathOfBuilding2/>\n');
    }
    server = await startTestServer({
      pobDirectory: builds,
      stateDir: path.join(TMP, 'state'),
      env: { POB_DIRECTORY: builds, XDG_STATE_HOME: path.join(TMP, 'xdg') },
      spawn: (() => {
        throw new Error('no engine in this test');
      }) as never,
    });
  });
  afterAll(async () => {
    await server?.close();
  });

  /**
   * The runner's step as file-run.md gives it: the files whose name, without its folder, equals the user's name, case and
   * `.xml` ignored; one is the build, none or several are asked about with the closest names, never guessed.
   */
  function step(name: string, listed: string[]): { build: string } | { ask: string[] } {
    const bare = (s: string) => s.replace(/\.xml$/i, '').toLowerCase();
    const equal = listed.filter((f) => bare(path.posix.basename(f)) === bare(name));
    if (equal.length === 1) return { build: equal[0] };
    const closest = equal.length > 1 ? equal : listed.filter((f) => bare(path.posix.basename(f)).includes(bare(name).slice(0, 4)));
    return { ask: closest };
  }

  it("states the rule: equal names, case and .xml ignored; none or several asked about with the closest names, each with its folder; never a guess", () => {
    expect(RULE).toContain('**A build the user names** is matched against `mcp__pob2__list_builds`: the file whose name, without its folder, equals the name the user gave, case and `.xml` ignored, is the build. When no file matches, or several do (one name in two folders), list the closest names, each with its folder, and ask which; never guess.');
  });

  it("on list_builds' real reply: one match is the build; a name in two folders, or none, is asked about with the closest names", async () => {
    const r = (await server.client.callTool({ name: 'list_builds', arguments: {} })) as Json;
    expect(r.isError).not.toBe(true);
    const listed = String(r.content[0].text).split('\n').map((l) => /^\d+\. (.+)$/.exec(l)?.[1]).filter((x): x is string => x !== undefined);
    expect(listed).toEqual(expect.arrayContaining(['MyCharacter123.xml', 'league/mycharacter123.xml', 'MyCharacter12.xml', 'Other Build.XML', 'old/Witch.xml']));
    expect(step('MyCharacter12', listed)).toEqual({ build: 'MyCharacter12.xml' });
    expect(step('other build.xml', listed)).toEqual({ build: 'Other Build.XML' });
    expect(step('witch', listed)).toEqual({ build: 'old/Witch.xml' });
    expect(step('MyCharacter123', listed)).toEqual({ ask: expect.arrayContaining(['MyCharacter123.xml', 'league/mycharacter123.xml']) });
    const none = step('MyCharacter', listed);
    expect(none).toEqual({ ask: expect.arrayContaining(['MyCharacter123.xml', 'league/mycharacter123.xml', 'MyCharacter12.xml']) });
    expect('ask' in none && none.ask).not.toContain('Other Build.XML');
  });
});

// ---------------------------------------------------------------------------------------------------
// The fixture file run: its order, its ladder and a guide's rules on owned content
// ---------------------------------------------------------------------------------------------------

describe('AC-W156 (WU-164, D-522): the fixture file run passes the checker in the file-run order', () => {
  it('reads, measures and places at the root, then designs the ladder in builds/file: no R1a, R1b or verification gate', () => {
    const dir = fileRun();
    const log = readJson(dir, 'run-log.json');
    expect({ slug: log.slug, brief: log.brief, mode: log.mode }).toEqual({ slug: 'file', brief: { from: 'Fixture Titan.xml' }, mode: 'offline' });
    expect(log.stages.map((s: Json) => `${s.stage}${s.scope ? ` ${s.scope}` : ''}`)).toEqual(['read', 'measure', 'place', 'D1-build ladder', 'D1-tree ladder', 'D1-finish ladder', 'D1-gate ladder']);
    expect(log.builds.map((b: Json) => `${b.id} ${b.folder} ${b.status}`)).toEqual(['file builds/file designing']);
    expect(log.checkpoints).toEqual([]);
    passes(dir);
  });

  it('its placed rung keeps the read stage: its source, rung, items and tree; the other two rungs are designed', () => {
    const read = readJson(FIXTURE, 'plan.json').stages[0];
    const ladder = readJson(FIXTURE, LADDER);
    const placed = ladder.stages.filter((s: Json) => s.source !== undefined);
    expect(placed.map((s: Json) => s.id)).toEqual(['b']);
    expect({ variant: placed[0].variant, source: placed[0].source }).toEqual({ variant: read.variant, source: read.source });
    expect(placed[0].tree.nodes).toEqual(read.tree.nodes);
    expect(placed[0].items.slots.map((x: Json) => x.text)).toEqual(read.items.slots.map((x: Json) => x.text));
    expect(ladder.stages.map((s: Json) => s.variant)).toEqual(['entering-maps', 'budget', 'non-budget']);
  });

  it('a planted fault in the file-run order fails the order rule', () => {
    const variants: Array<[string, (l: Json) => void, RegExp]> = [
      // A brainstorm round in a file run.
      ['R1a first', (l) => l.stages.unshift({ stage: 'R1a', attempt: 1, outcome: 'done' }), /can't follow the start .*allows read next/],
      // The ladder's D1-build before the place.
      ['no place', (l) => l.stages.splice(2, 1), /D1-build file attempt 1\): can't follow measure attempt 1 .*allows read, measure, place next/],
      // The ladder's steps with no scope, or the better round's with no better in the brief.
      ['no scope', (l) => delete l.stages[4].scope, /D1-tree file attempt 1\): is D1-tree with scope undefined, but a file run's ladder around the placed rung runs with scope ladder/],
      ['better unasked', (l) => l.stages.slice(3).forEach((s: Json) => (s.scope = 'better')), /D1-build file attempt 1\): is D1-build with scope "better", but a file run's ladder .* runs with scope ladder/],
    ];
    for (const [name, edit, want] of variants) {
      const dir = fileRun();
      editJson(dir, 'run-log.json', edit);
      expect({ name, order: lines(check(dir).stderr, 'order') }).toEqual({ name, order: expect.arrayContaining([expect.stringMatching(want)]) });
    }
  });

  it('it has no verification gate: a verification checkpoint, a design answer verification or an accept:verification fails at write and in the checker', () => {
    const dir = fileRun();
    expect(write(dir, 'checkpoint', { checkpoint: 'verification', visit: 1, answer: 'pick:r1-a-1', answeredBy: 'user', questions: 0 })).toMatchObject({ code: 1, stderr: expect.stringMatching(/a run from a PoB file has no verification gate: the file is its skeleton and cards\/file\.md its card \(D-522\)/) });
    expect(write(dir, 'checkpoint', { checkpoint: 'design', concept: 'file', visit: 1, answer: 'verification', answeredBy: 'user', questions: 0 })).toMatchObject({ code: 1, stderr: expect.stringMatching(/its design gate takes accept, accept:file, revise:<text> or stop \(D-522\)/) });
    expect(write(dir, 'escalation', { stage: 'D1-gate', concept: 'file', verdict: GATE, choice: 'verification' })).toMatchObject({ code: 1, stderr: expect.stringMatching(/its escalation takes accept, retry or stop \(D-522\)/) });
    // Written by hand, the checker fails the design gate's verification.
    editJson(dir, 'run-log.json', (l) => {
      l.checkpoints.push({ checkpoint: 'design', concept: 'file', visit: 1, answer: 'verification', answeredBy: 'user', questions: 0 });
      l.stages.push({ stage: 'D1-build', concept: 'file', attempt: 2, outcome: 'done', scope: 'ladder' });
    });
    expect(lines(check(dir).stderr, 'order')).toContainEqual(expect.stringMatching(/follows the design gate answered "verification", which isn't an answer of a file run's design gate: accept, accept:file, revise:<text> or stop; it has no verification gate \(D-522\)/));
  });
});

describe("AC-W156 (WU-164, §15, §16, §18): the placed rung's items kept, its rares specs, owned content a guide can't carry shown as a trade", () => {
  it("the placed rung's rares are specs: an owned mark on one fails owned-guide; its uniques stay as they are", () => {
    const dir = fileRun();
    editJson(dir, LADDER, (p) => {
      const ring = stageOf(p, 'b').items.slots.find((x: Json) => x.slot === 'Ring 1');
      ring.owned = true;
    });
    expect(lines(check(dir).stderr, 'owned-guide')).toEqual([expect.stringMatching(/builds\/file\/plan\.json's placed rung "b" keeps the owned rare in Ring 1; in a guide its rares are specs/)]);
    // Each rare of the placed b, gear and tree jewel, is priced by a spec (the D1 gate's basis maps it): seven in the fixture.
    const ladder = readJson(FIXTURE, LADDER);
    const b = stageOf(ladder, 'b');
    const rares = [...b.items.slots, ...b.items.treeJewels].filter((x: Json) => /^Rarity: Rare/i.test(x.text)).length;
    expect({ rares, specs: ladder.prices.filter((p: Json) => /^b-/.test(p.id) && p.spec !== undefined).length }).toEqual({ rares: 7, specs: 7 });
    const unspecced = fileRun();
    editJson(unspecced, LADDER, (p) => {
      delete p.prices.find((x: Json) => x.id === 'b-helmet').spec;
    });
    expect(lines(check(unspecced).stderr, 'owned-guide')).toEqual([expect.stringMatching(/builds\/file\/plan\.json's placed rung "b" prices its rare in Helmet by "b-helmet", which has no spec; in a guide the placed rung's rares are specs/)]);
  });

  it('a planted owned legacy gem kept on a rung fails owned-guide; shown as a trade (the fixture), it passes; with no trade, it fails', () => {
    const kept = fileRun();
    editJson(kept, LADDER, (p) => {
      stageOf(p, 'b').skills.groups[0].gems[1].name = 'Bloodlust';
    });
    expect(lines(check(kept).stderr, 'owned-guide')).toEqual([expect.stringMatching(/builds\/file\/plan\.json's stage b keeps "Bloodlust", which the reader named legacy \(read\.json\); a guide never keeps legacy or no-longer-obtainable content, the character's own included/)]);
    const untraded = fileRun();
    editJson(untraded, 'builds/file/trades.json', (t) => {
      t.trades = t.trades.filter((x: Json) => !/Bloodlust/.test(String(x.from)));
    });
    expect(lines(check(untraded).stderr, 'owned-guide')).toEqual([expect.stringMatching(/builds\/file\/trades\.json has no trade from "Bloodlust", the character's gem the reader named legacy \(read\.json\); owned content a guide can't carry is shown at the design gate as a trade/)]);
    expect(readJson(FIXTURE, 'read.json').legacy.map((x: Json) => x.name)).toEqual(['Bloodlust']);
  });

  it("the other rungs are designed, and the placed rung keeps the file's rung and tree", () => {
    const missing = fileRun();
    editJson(missing, LADDER, (p) => {
      p.stages = p.stages.filter((s: Json) => s.id !== 'n');
      p.prices = p.prices.filter((x: Json) => !/^n-/.test(x.id));
    });
    expect(lines(check(missing).stderr, 'ladder')).toEqual([expect.stringMatching(/builds\/file\/plan\.json: has no non-budget rung; the ladder designs the other rungs around the placed one, above and below/)]);
    const tree = fileRun();
    editJson(tree, LADDER, (p) => {
      stageOf(p, 'b').tree.nodes.push(999999);
    });
    expect(lines(check(tree).stderr, 'ladder')).toEqual([expect.stringMatching(/the placed rung "b"'s tree\.nodes isn't the file's \(plan\.json's stage "b"\); the placed rung keeps its tree, and D1-tree runs on the designed rungs only/)]);
    const two = fileRun();
    editJson(two, LADDER, (p) => {
      stageOf(p, 'n').source = stageOf(p, 'b').source;
    });
    expect(lines(check(two).stderr, 'ladder')).toEqual([expect.stringMatching(/2 stages keep the reader's source; the placed rung is the one stage that keeps it/)]);
  });

  it("a guide holds owned content to every rule: in a file run no owned exemption applies (ownedContent is a compile or pricing run's)", () => {
    // An owned rare's price entry on the placed rung, named by its slot as pricing names it, is held to spec as any other.
    const dir = fileRun();
    editJson(dir, LADDER, (p) => {
      const helmet = p.prices.find((x: Json) => x.id === 'b-helmet');
      helmet.query.slot = 'Helmet';
      helmet.spec = { base: 'x' };
    });
    expect(lines(check(dir).stderr, 'spec')).toContainEqual(expect.stringMatching(/plan\.json's price entry "b-helmet" has spec \{"base":"x"\}/));
  });
});

describe("AC-W156 (WU-164, §17, §18): the D1 gate never fails the placed rung for its floor and tree; the designed rungs as today", () => {
  /** The ladder gate's floor and tree failing on the given rung, the floor finding with or without its cost. */
  function failing(dir: string, stage: string, cost: boolean): void {
    editJson(dir, GATE, (g) => {
      g.verdict.floor = 'fail';
      g.verdict.tree = 'fail';
      g.findings.push(
        { part: 'floor', code: 'missing-cold-resist', stage, message: `MissingColdResist 12 on stage ${stage}`, ...(cost ? { cost: 'a cold-resistance ring, its price unavailable offline' } : {}) },
        { part: 'tree', code: 'tree-swap', stage, message: `a swap left on ${stage} gains 6%` },
      );
    });
  }
  const routing = (dir: string) => lines(check(dir).stderr, 'routing');

  it("the placed rung's floor (with its cost) and tree findings cover their parts: the gate passes to the design gate", () => {
    const dir = fileRun();
    failing(dir, 'b', true);
    expect(routing(dir)).toEqual([]);
  });

  it('a planted run that fails the gate for the placed rung\'s findings fails routing', () => {
    const dir = fileRun();
    failing(dir, 'b', true);
    editJson(dir, 'run-log.json', (l) => {
      l.stages[6].outcome = 'fail';
      l.stages.push({ stage: 'D1-build', concept: 'file', attempt: 2, outcome: 'done', scope: 'ladder' });
    });
    expect(routing(dir)).toEqual([expect.stringMatching(/stages\[6\] \(D1-gate file attempt 1\): is routed fail, but its verdict passes, which isn't a failure/)]);
  });

  it("a floor finding on the placed rung with no cost, or on a designed rung, isn't covered: a pass fails routing", () => {
    const uncosted = fileRun();
    failing(uncosted, 'b', false);
    expect(routing(uncosted)).toEqual([expect.stringMatching(/is routed pass, but its verdict fails only its floor or named damage source/)]);
    const designed = fileRun();
    failing(designed, 'n', true);
    expect(routing(designed)).toEqual([expect.stringMatching(/is routed pass, but its verdict fails only its floor or named damage source/)]);
  });
});

describe("AC-W156 (WU-164, §18): the ladder's design display and the guide it rests on", () => {
  it("the design display shows the placed rung's costed findings and invites no way back to a verification gate", () => {
    const dir = fileRun();
    editJson(dir, GATE, (g) => {
      g.verdict.floor = 'fail';
      g.findings.push({ part: 'floor', code: 'missing-cold-resist', stage: 'b', message: 'MissingColdResist 12 on stage b', cost: 'a cold-resistance ring, about 3 divines' });
    });
    editJson(dir, 'run-log.json', (l) => {
      l.displays = [];
    });
    const shown = node(RUN_LOG, [dir, 'display', 'design', '--build', 'file']);
    expect({ code: shown.code, stderr: shown.stderr }).toEqual({ code: 0, stderr: '' });
    expect(shown.stdout).toMatch(/^PoB file: Fixture Titan's Blood Hunt \(draft\)\.xml in your Builds folder$/m);
    // The shortfall is the record's (the planted finding's record reads 0% short).
    expect(shown.stdout).toContain('**Not reached on this rung**\n- cold resistance 0% short: a cold-resistance ring, about 3 divines.');
    expect(shown.stdout).toContain("Ask anything about this build first. Then accept it (I'll ask: its guide or its PoB file only, and late endgame scaling), ask for changes, or stop.");
    expect(shown.stdout).not.toMatch(/verification gate/);
  });

  it("once a guide rests on the ladder's D1 gate, the placed rung's covered findings fail nothing; a designed rung's do", () => {
    /** The fixture with a guide written after its D1 gate (W1), the gate's floor failing on `stage` with its cost. */
    function guided(stage: string): string {
      const dir = fileRun();
      editJson(dir, GATE, (g) => {
        g.verdict.floor = 'fail';
        g.findings.push({ part: 'floor', code: 'missing-cold-resist', stage, message: `MissingColdResist 12 on stage ${stage}`, cost: 'a cold-resistance ring, about 3 divines' });
      });
      fs.copyFileSync(path.join(PIPELINE, 'run-a14', 'builds', 'r1-a-2', 'guide.md'), path.join(dir, 'builds', 'file', 'guide.md'));
      editJson(dir, 'run-log.json', (l) => {
        l.stages.push({ stage: 'W1', concept: 'file', attempt: 1, outcome: 'done' });
      });
      return dir;
    }
    const passed = (dir: string) => check(dir).stderr.split('\n').filter((l) => /says floor: "fail".*the guide's concept passed this gate/.test(l));
    expect(passed(guided('b'))).toEqual([]);
    expect(passed(guided('n'))).toEqual([expect.stringMatching(/reports\/gates\/D1-gate-file-a1\.json says floor: "fail" \(missing-cold-resist\), and no accepted finding covers it; the guide's concept passed this gate/)]);
  });
});

describe('AC-W156 (WU-164, §18): with better, the result is placed again; a declined campaign runs no D2', () => {
  /** The fixture with a better round first: its D1 loop in the better scope, the design gate's accept, then place again. */
  function withBetter(): string {
    const dir = fileRun();
    fs.copyFileSync(path.join(dir, GATE), path.join(dir, 'reports/gates/D1-gate-file-a2.json'));
    editJson(dir, 'run-log.json', (l) => {
      l.brief.better = true;
      const head = l.stages.slice(0, 3);
      const round = ['D1-build', 'D1-tree', 'D1-finish', 'D1-gate'].map((stage) => ({ stage, concept: 'file', attempt: 1, outcome: stage === 'D1-gate' ? 'pass' : 'done', scope: 'better' }));
      const ladder = l.stages.slice(3).map((s: Json) => ({ ...s, attempt: 2 }));
      l.stages = [...head, ...round, { stage: 'place', attempt: 2, outcome: 'done' }, ...ladder];
      l.displays = [{ checkpoint: 'design', visit: 1 }, { checkpoint: 'design', visit: 2 }];
      l.checkpoints = [{ checkpoint: 'design', concept: 'file', visit: 1, answer: 'accept', answeredBy: 'user', questions: 0 }];
    });
    return dir;
  }

  it('the better round runs first in the better scope; its accept places the result again, then the ladder', () => {
    const dir = withBetter();
    const r = check(dir);
    expect({ order: lines(r.stderr, 'order'), routing: lines(r.stderr, 'routing') }).toEqual({ order: [], routing: [] });
  });

  it("with no place after the better round's accept, or the ladder before it, the order fails", () => {
    const noPlace = withBetter();
    editJson(noPlace, 'run-log.json', (l) => {
      l.stages.splice(7, 1);
    });
    expect(lines(check(noPlace).stderr, 'order')).toContainEqual(expect.stringMatching(/follows the better round's design gate answered "accept", which places the result again: place next, then the ladder's D1-build around its rung, not D1-build file \(D-522\)/));
    const accept = withBetter();
    editJson(accept, 'run-log.json', (l) => {
      l.checkpoints[0].answer = 'accept:file';
    });
    expect(lines(check(accept).stderr, 'order')).toContainEqual(expect.stringMatching(/follows the design gate answered "accept:file", which isn't an answer of a file run's better round: accept \(the result placed again, then the ladder\), revise:<text> or stop \(D-522\)/));
    // The ladder's steps before the better round's accept fail too.
    const early = withBetter();
    editJson(early, 'run-log.json', (l) => {
      l.stages[5].scope = 'ladder';
    });
    expect(lines(check(early).stderr, 'order')).toContainEqual(expect.stringMatching(/D1-finish file attempt 1\): is D1-finish with scope "ladder", but a file run's better round \(its brief's better\) runs first, with scope better/));
    // At write: the better round's design gate takes accept, revise:<text> or stop; the ladder's takes the pipeline's.
    const round = withBetter();
    editJson(round, 'run-log.json', (l) => {
      l.stages = l.stages.slice(0, 7);
      l.checkpoints = [];
      l.displays = [{ checkpoint: 'design', visit: 1 }];
    });
    expect(write(round, 'checkpoint', { checkpoint: 'design', concept: 'file', visit: 1, answer: 'accept:file', answeredBy: 'user', questions: 0 })).toMatchObject({ code: 1, stderr: expect.stringMatching(/the better round's design gate takes accept \(the result placed again, then the ladder around it\), revise:<text> or stop, and asks no scaling question \(D-521, D-522\)/) });
    expect(write(round, 'checkpoint', { checkpoint: 'design', concept: 'file', visit: 1, answer: 'accept', answeredBy: 'user', questions: 0 }).code).toBe(0);
    // Its display is the better round's: accept places the result again, with no way back to a verification gate.
    const shown = node(RUN_LOG, [round, 'display', 'design', '--build', 'file']);
    expect(shown.stdout).toContain("Then accept it (I'll place it on the ladder again and design the other rungs around it), ask for changes, or stop.");
    expect(write(withBetter(), 'checkpoint', { checkpoint: 'design', concept: 'file', visit: 2, answer: 'accept', answeredBy: 'user', questions: 0, scaling: true }).code).toBe(0);
  });

  /** The fixture after its design gate's accept and F1's pass, then `next` (each its own entry). */
  function afterF1(campaign: boolean | undefined, next: Json[]): string {
    const dir = fileRun();
    editJson(dir, 'run-log.json', (l) => {
      if (campaign !== undefined) l.brief.campaign = campaign;
      l.displays = [{ checkpoint: 'design', visit: 1 }];
      l.checkpoints = [{ checkpoint: 'design', concept: 'file', visit: 1, answer: 'accept', answeredBy: 'user', questions: 0, scaling: false }];
      l.stages.push({ stage: 'F1', concept: 'file', attempt: 1, outcome: 'pass' }, ...next);
    });
    return dir;
  }
  const d2 = { stage: 'D2', concept: 'file', attempt: 1, outcome: 'done' };
  const w1 = { stage: 'W1', concept: 'file', attempt: 1, outcome: 'done' };

  it('F1 goes on to the campaign (D2) unless the brief declined it; a declined campaign runs no D2', () => {
    expect(lines(check(afterF1(undefined, [d2])).stderr, 'order')).toEqual([]);
    expect(lines(check(afterF1(undefined, [w1])).stderr, 'order')).toContainEqual(expect.stringMatching(/W1 file attempt 1\): can't follow F1 file attempt 1 \(outcome "pass"\); SKILL\.md's step list allows D2 next/));
    expect(lines(check(afterF1(false, [w1])).stderr, 'order')).toEqual([]);
    expect(lines(check(afterF1(false, [d2])).stderr, 'order')).toContainEqual(expect.stringMatching(/D2 file attempt 1\): can't follow F1 file attempt 1 \(outcome "pass"\); SKILL\.md's step list allows W1 next/));
  });
});

// ---------------------------------------------------------------------------------------------------
// AC-W157: switched buffs in the guide
// ---------------------------------------------------------------------------------------------------

describe('AC-W157 (WU-164, D-518, §14): a guide writes one line per buff switched as needed', () => {
  /** run-a14's build, its budget rung's Herald of Blood switched as needed, Rolling Slam switched off for it. */
  function switched(line: string | null): string {
    const dir = copy(path.join(PIPELINE, 'run-a14'), 'titan-blood-hunt');
    editJson(dir, 'builds/r1-a-2/plan.json', (p) => {
      const herald = stageOf(p, 'b').skills.groups[2];
      herald.enabled = false;
      herald.switch = { when: 'for bosses', off: [2] };
    });
    if (line !== null) {
      const guide = path.join(dir, 'builds', 'r1-a-2', 'guide.md');
      const text = fs.readFileSync(guide, 'utf8');
      fs.writeFileSync(guide, text.replace(/^## Endgame: budget\n/m, `## Endgame: budget\n\n${line}\n`));
    }
    return dir;
  }
  const rule = (dir: string) => lines(check(dir).stderr, 'switched-buffs');

  it("the guide's line for it, §14's form, passes", () => {
    expect(fs.readFileSync(path.join(PIPELINE, 'run-a14', 'builds', 'r1-a-2', 'guide.md'), 'utf8')).toMatch(/^## Endgame: budget$/m);
    expect(rule(switched('- Herald of Blood: switch it on for bosses; switch Rolling Slam off for it.'))).toEqual([]);
  });

  it('a guide without it, or with another when or off list, fails switched-buffs', () => {
    const want = /guide\.md has no line for b's buff switched as needed, group 3 \(Herald of Blood\): "- Herald of Blood: switch it on for bosses; switch Rolling Slam off for it\.", one line per switched buff in its skills \(D-518, §14\)/;
    expect(rule(switched(null))).toEqual([expect.stringMatching(want)]);
    expect(rule(switched('- Herald of Blood: switch it on as needed; switch Rolling Slam off for it.'))).toEqual([expect.stringMatching(want)]);
    expect(rule(switched('- Herald of Blood: switch it on for bosses.'))).toEqual([expect.stringMatching(want)]);
  });

  it('a pipeline build with no switched buff needs no line', () => {
    expect(rule(copy(path.join(PIPELINE, 'run-a14'), 'titan-blood-hunt'))).toEqual([]);
  });
});

// ---------------------------------------------------------------------------------------------------
// Carried from WU-162's verifier: the checker's own draftFile rule on a compile run's escalation
// ---------------------------------------------------------------------------------------------------

describe("WU-162's escalation draftFile (D-521): only an accepted D1 gate escalation carries one, in the checker", () => {
  const ESC = { stage: 'D1-gate', concept: 'file', verdict: 'reports/gates/D1-gate-file-a1.json' };
  function compile(escalation: Json): string {
    const dir = copy(path.join(PIECES, 'compile-better-run'), 'compile');
    editJson(dir, 'run-log.json', (l) => {
      l.escalations = [escalation];
    });
    return dir;
  }
  const draftLines = (dir: string) => lines(check(dir).stderr, 'run-log').filter((l) => /escalations\[0\]: has draftFile/.test(l));

  it('an accepted D1 gate escalation with its draft passes the rule; on stop, on F1 or empty, it fails', () => {
    expect(draftLines(compile({ ...ESC, choice: 'accept', draftFile: 'imported-character better (draft).xml' }))).toEqual([]);
    const bad = /run-log\.json escalations\[0\]: has draftFile .*; only an accepted D1 gate escalation carries one, the draft the runner wrote after it, its path in the builds folder \(D-521\)/;
    expect(draftLines(compile({ ...ESC, choice: 'stop', draftFile: 'imported-character better (draft).xml' }))).toEqual([expect.stringMatching(bad)]);
    expect(draftLines(compile({ ...ESC, stage: 'F1', verdict: 'reports/gates/F1-file-a1.json', choice: 'accept', draftFile: 'x.xml' }))).toEqual([expect.stringMatching(bad)]);
    expect(draftLines(compile({ ...ESC, choice: 'accept', draftFile: ' ' }))).toEqual([expect.stringMatching(bad)]);
  });
});

describe('the whole fixture stays checked by every rule (a file run is a pipeline run)', () => {
  it('names no rule on the fixture, and the rules a planted fault names are its own', () => {
    expect(rulesIn(check(fileRun()).stderr)).toEqual([]);
  });
});
