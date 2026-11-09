/**
 * Amendment 16's M-30, WU-164 (D-522, D-518, D-512; §18, §14, §15, §16, §17): a guide from a PoB file, `/pob2:build-guide`
 * from the player's own build, each script spawned as a real `node` process with an explicit env and the test clock
 * (`BUILD_GUIDE_TEST_NOW`, `tests/helpers/runningDigests.ts`'s `TEST_NOW`), on two committed fixture file runs (offline)
 * built on the real path: the importer fixture (`tests/fixtures/builds/imported-character.xml`) read by
 * `plan_from_build` (its main skill and Spirit answered as WU-162's better round answered them), measured by the engine
 * (`measure_as`), placed on the budget rung by the user's word; then the ladder in `builds/file/`, m, the placed b and n,
 * compiled by the engine (V1 and V2 passing on every rung), the placed rung keeping the file's design with no owned mark
 * and no `config.file`, its rares as specs, Bloodlust (legacy), the Legacy soul core's vest and the charm shown as trades.
 * `tests/fixtures/file-run` waits at the ladder's design gate (the draft written); the completed variant goes on (its own
 * files alone, `tests/fixtures/file-run-completed`, laid over the first at test time): the design gate's accept, F1's final compile, the audit, W1's guide, V4's full pass, the notes and the final
 * gate's accept, to `completed`. The gate verdicts, the guide and the V4 report are written to the checker's rules from
 * the records, as a run's steps write them.
 *
 * - AC-W156: the brief accepts `from` and `better` and gives the slug `file` (at `init` and in the checker; an import
 *   code never as `from`); a build name that matches no file, or several, is asked about with the closest names (the
 *   runner's step, on `list_builds`' real reply); both fixtures pass the checker in the file-run order (`read`, `measure`,
 *   `place`, then `D1-build`; no R1a, R1b or verification gate); the placed rung's items, tree and rung kept (a change the user
 *   asked for a trade), its rares as specs, no owned mark and no `config.file`; a planted owned legacy gem shown as a
 *   trade; the other rungs designed; the placed rung's floor and tree findings never fail it (a planted run that fails it
 *   for them fails), also once a guide rests on the gate; with `better` the result is placed again; a declined campaign
 *   runs no D2; the completed run holds the measure's dossier row; a resume shows no verification gate.
 * - AC-W157: the completed run's guide has §14's line per switched buff, and `switched-buffs` fails a guide without one.
 * - Carried from WU-162's verifier: the checker's own `draftFile` rule on a compile run's escalation.
 *
 * check-run and run-log load the server's compiled `build/plan/`: `mise run test` builds first.
 */
import { describe, it, expect, afterAll, beforeAll } from '@jest/globals';
import { spawnSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import zlib from 'zlib';
import { TEST_NOW } from '../helpers/runningDigests';
import { startTestServer, type TestServer } from '../helpers/server';

type Json = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

const REPO = path.resolve(__dirname, '..', '..');
const SCRIPTS = path.join(REPO, 'skills', 'build-guide', 'scripts');
const CHECKER = path.join(SCRIPTS, 'check-run.mjs');
const RUN_LOG = path.join(SCRIPTS, 'run-log.mjs');
const FIXTURE = path.join(REPO, 'tests', 'fixtures', 'file-run');
const COMPLETED = path.join(REPO, 'tests', 'fixtures', 'file-run-completed');
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
/** The completed run: the design-gate fixture with the completed variant's own files laid over it (they alone differ). */
function completedRun(): string {
  const dir = copy(FIXTURE);
  fs.cpSync(COMPLETED, dir, { recursive: true });
  editJson(dir, 'run-log.json', (l) => {
    l.runFolder = dir;
  });
  return dir;
}
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

  it("init refuses an import code as from (over 255 characters, or one that decodes as a PoB build), and never repeats it", () => {
    const code = fs.readFileSync(path.join(REPO, 'tests', 'fixtures', 'builds', 'imported-character.code.txt'), 'utf8').trim();
    const long = write(folder('file'), 'init', { slug: 'file', brief: { from: code }, mode: 'offline', testConfig: 'none', noNinja: false });
    expect(long).toMatchObject({ code: 1, stderr: expect.stringMatching(/brief\.from is \d+ characters long: an import code goes only to the reader, never in the log, so from is "import code"/) });
    expect(long.stderr).not.toContain(code.slice(0, 40));
    // A short code (a tiny build) decodes as a PoB document: refused too.
    const short = zlib.deflateSync('<?xml version="1.0"?><PathOfBuilding2/>').toString('base64url');
    expect(short.length).toBeLessThan(256);
    expect(write(folder('file'), 'init', { slug: 'file', brief: { from: short }, mode: 'offline', testConfig: 'none', noNinja: false })).toMatchObject({ code: 1, stderr: expect.stringMatching(/brief\.from is a code that decodes as a PoB build: an import code goes only to the reader/) });
    expect(write(folder('file'), 'init', { slug: 'file', brief: { from: 'league/MyCharacter123.xml' }, mode: 'offline', testConfig: 'none', noNinja: false }).code).toBe(0);
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


describe('AC-W156 (WU-164, D-522): both fixture file runs pass the checker in the file-run order', () => {
  it('reads, measures and places at the root, then designs the ladder in builds/file: no R1a, R1b or verification gate', () => {
    const dir = fileRun();
    const log = readJson(dir, 'run-log.json');
    expect({ slug: log.slug, brief: log.brief, mode: log.mode, dossier: log.dossier }).toEqual({ slug: 'file', brief: { from: 'imported-character.xml', campaign: false }, mode: 'offline', dossier: 'dossier.md' });
    expect(log.stages.map((s: Json) => `${s.stage}${s.scope ? ` ${s.scope}` : ''}`)).toEqual(['read', 'measure', 'place', 'D1-build ladder', 'D1-tree ladder', 'D1-finish ladder', 'D1-gate ladder']);
    expect(log.builds.map((b: Json) => `${b.id} ${b.folder} ${b.status} ${b.draftFile}`)).toEqual(["file builds/file designing imported-character's Twister (draft).xml"]);
    expect(log.checkpoints).toEqual([]);
    passes(dir);
  });

  it("the completed run goes on through the design gate's accept, F1, W1, V4 and the final gate's accept, and passes", () => {
    const dir = completedRun();
    const log = readJson(dir, 'run-log.json');
    expect(log.stages.map((s: Json) => s.stage)).toEqual(['read', 'measure', 'place', 'D1-build', 'D1-tree', 'D1-finish', 'D1-gate', 'F1', 'W1', 'V4']);
    expect(log.checkpoints.map((c: Json) => `${c.checkpoint} ${c.answer}`)).toEqual(['design accept', 'final accept']);
    expect({ status: log.status, build: log.builds[0].status, guide: log.builds[0].guide, pobFile: log.builds[0].pobFile }).toEqual({ status: 'completed', build: 'completed', guide: 'endgame', pobFile: "imported-character's Twister.xml" });
    passes(dir);
  });

  it("the read is the reader's and the compile's real output: config.file and enemyIsBoss alone in the scenario, the record's owned marks and no reference hits", () => {
    const read = readJson(FIXTURE, 'plan.json');
    const st = read.stages[0];
    expect({ schema: read.schemaVersion, id: st.id, variant: st.variant, source: st.source.name, claims: st.claims, ledger: read.ledger }).toEqual({ schema: 11, id: 'b', variant: 'budget', source: 'imported-character.xml', claims: [], ledger: [] });
    expect(st.config.scenario.map((x: Json) => x.option)).toEqual(['enemyIsBoss']);
    expect(Object.keys(st.config.file)).toEqual(expect.arrayContaining(['enemyIsBoss', 'customMods']));
    const rec = readJson(FIXTURE, 'compile-record.json');
    expect({ mode: rec.mode, measuredAs: rec.stages.f.measuredAs, owned: rec.stages.f.owned.length > 0, hit: rec.stages.f.configWritten.enemyPhysicalDamage }).toEqual({ mode: 'measure-only', measuredAs: 'non-budget', owned: true, hit: undefined });
    expect(readJson(FIXTURE, 'read.json').legacy.map((x: Json) => x.name)).toEqual(['Bloodlust']);
    // The ladder compiled by the engine: V1 and V2 pass on every rung.
    const ladder = readJson(FIXTURE, 'builds/file/compile-record.json');
    expect(['m', 'b', 'n'].map((id) => `${id} ${ladder.stages[id].v1.pass} ${ladder.stages[id].v2.pass}`)).toEqual(['m true true', 'b true true', 'n true true']);
  });

  it("the placed rung keeps the read stage's source, rung and tree, its non-rares as read, its rares as specs on their bases, the vest and the charm traded", () => {
    const read = readJson(FIXTURE, 'plan.json').stages[0];
    const ladder = readJson(FIXTURE, LADDER);
    const placed = ladder.stages.filter((s: Json) => s.source !== undefined);
    expect(placed.map((s: Json) => s.id)).toEqual(['b']);
    const b = placed[0];
    expect({ variant: b.variant, source: b.source, nodes: b.tree.nodes, config: Object.keys(b.config) }).toEqual({ variant: read.variant, source: read.source, nodes: read.tree.nodes, config: ['earned', 'scenario'] });
    const now = new Map(b.items.slots.map((x: Json) => [x.slot, x.text]));
    for (const it of read.items.slots) {
      const was = String(it.text).split('\n');
      if (/^Rarity: RARE/.test(was[0]) && it.slot !== 'Body Armour') expect({ slot: it.slot, base: String(now.get(it.slot)).split('\n')[2] }).toEqual({ slot: it.slot, base: was[2] });
      else if (!['Body Armour', 'Charm 1'].includes(it.slot)) expect({ slot: it.slot, text: now.get(it.slot) }).toEqual({ slot: it.slot, text: it.text });
    }
    const trades = readJson(FIXTURE, 'builds/file/trades.json').trades.filter((t: Json) => t.stage === 'b' && t.from);
    expect(trades.map((t: Json) => t.from)).toEqual(expect.arrayContaining(['Loath Ward, Slipstrike Vest with Legacy of Blackbraid', 'Blooming Thawing Charm of the Medic in Charm 1', "Bloodlust in Whirling Slash's group"]));
    expect(ladder.stages.map((s: Json) => s.variant)).toEqual(['entering-maps', 'budget', 'non-budget']);
  });

  it('a planted fault in the file-run order fails the order rule', () => {
    const variants: Array<[string, (l: Json) => void, RegExp]> = [
      ['R1a first', (l) => l.stages.unshift({ stage: 'R1a', attempt: 1, outcome: 'done' }), /can't follow the start .*allows read next/],
      ['no place', (l) => l.stages.splice(2, 1), /D1-build file attempt 1\): can't follow measure attempt 1 .*allows read, measure, place next/],
      ['no scope', (l) => delete l.stages[4].scope, /D1-tree file attempt 1\): is D1-tree with scope undefined, but a file run's ladder around the placed rung runs with scope ladder/],
      ['better unasked', (l) => l.stages.slice(3).forEach((s: Json) => (s.scope = 'better')), /D1-build file attempt 1\): is D1-build with scope "better", but a file run's ladder .* runs with scope ladder/],
    ];
    for (const [name, edit, want] of variants) {
      const dir = fileRun();
      editJson(dir, 'run-log.json', edit);
      expect({ name, order: lines(check(dir).stderr, 'order') }).toEqual({ name, order: expect.arrayContaining([expect.stringMatching(want)]) });
    }
  });

  it('it has no verification gate: a verification checkpoint or display, a design answer verification or an accept:verification fails at write and in the checker', () => {
    const dir = fileRun();
    expect(write(dir, 'checkpoint', { checkpoint: 'verification', visit: 1, answer: 'pick:r1-a-1', answeredBy: 'user', questions: 0 })).toMatchObject({ code: 1, stderr: expect.stringMatching(/a run from a PoB file has no verification gate: the file is its skeleton and cards\/file\.md its card \(D-522\)/) });
    expect(node(RUN_LOG, [dir, 'display', 'verification'])).toMatchObject({ code: 1, stderr: expect.stringMatching(/display: a run from a PoB file has no verification gate: the file is its skeleton and cards\/file\.md its card; a resume goes on from where it stopped \(D-522\)/) });
    expect(node(RUN_LOG, [dir, 'display', 'brainstorm']).code).toBe(1);
    expect(readJson(dir, 'run-log.json').displays).toEqual([]);
    expect(write(dir, 'checkpoint', { checkpoint: 'design', concept: 'file', visit: 1, answer: 'verification', answeredBy: 'user', questions: 0 })).toMatchObject({ code: 1, stderr: expect.stringMatching(/its design gate takes accept, accept:file, revise:<text> or stop \(D-522\)/) });
    expect(write(dir, 'escalation', { stage: 'D1-gate', concept: 'file', verdict: GATE, choice: 'verification' })).toMatchObject({ code: 1, stderr: expect.stringMatching(/its escalation takes accept, retry or stop \(D-522\)/) });
    editJson(dir, 'run-log.json', (l) => {
      l.checkpoints.push({ checkpoint: 'design', concept: 'file', visit: 1, answer: 'verification', answeredBy: 'user', questions: 0 });
      l.stages.push({ stage: 'D1-build', concept: 'file', attempt: 2, outcome: 'done', scope: 'ladder' });
    });
    expect(lines(check(dir).stderr, 'order')).toContainEqual(expect.stringMatching(/follows the design gate answered "verification", which isn't an answer of a file run's design gate: accept, accept:file, revise:<text> or stop; it has no verification gate \(D-522\)/));
    // A pipeline run's verification display is unchanged.
    expect(node(RUN_LOG, [copy(path.join(PIPELINE, 'run-a14'), 'titan-blood-hunt'), 'display', 'verification']).code).toBe(0);
  });

  it("a completed file run holds the measure's dossier row, which D2 and W1 read: without it, or with another row, it fails", () => {
    const missing = completedRun();
    fs.rmSync(path.join(missing, 'dossier.md'));
    expect(lines(check(missing).stderr, 'layout')).toContainEqual(expect.stringMatching(/dossier\.md is missing; a completed run has its dossier/));
    const other = completedRun();
    fs.writeFileSync(path.join(other, 'dossier.md'), fs.readFileSync(path.join(FIXTURE, 'dossier.md'), 'utf8').replace('| file |', '| r1-a-1 |'));
    expect(lines(check(other).stderr, 'dossier-sections')).toEqual([expect.stringMatching(/dossier\.md holds "r1-a-1"; a file run's dossier holds one row, its build file's/)]);
    expect(fs.readFileSync(path.join(FIXTURE, 'dossier.md'), 'utf8')).toMatch(/^\| file \| — \| viable \| .* \| Twister: hit \| — \| — \| none \(offline\) \| .* \|$/m);
  });
});

describe("AC-W156 (WU-164, §15, §16, §18): a guide's rules on owned content and the ladder around the placed rung", () => {
  it('no owned mark stays in the ladder: on a rare, a unique or a group it fails owned-guide', () => {
    for (const [where, edit] of [
      ['Ring 1', (b: Json) => (b.items.slots.find((x: Json) => x.slot === 'Ring 1').owned = true)],
      ['Amulet', (b: Json) => (b.items.slots.find((x: Json) => x.slot === 'Amulet').owned = true)],
      ['group 4', (b: Json) => (b.skills.groups[3].owned = true)],
    ] as Array<[string, (b: Json) => void]>) {
      const dir = fileRun();
      editJson(dir, LADDER, (p) => edit(stageOf(p, 'b')));
      expect({ where, lines: lines(check(dir).stderr, 'owned-guide') }).toEqual({ where, lines: [expect.stringMatching(new RegExp(`builds/file/plan\\.json's stage b keeps the owned mark on ${where}; in a guide owned content meets every rule \\(V1 skips owned content\\), so the ladder drops every owned mark`))] });
    }
  });

  it("each rare of the placed rung is priced by a spec the D1 gate maps to it; one without fails owned-guide", () => {
    const ladder = readJson(FIXTURE, LADDER);
    const b = stageOf(ladder, 'b');
    const rares = [...b.items.slots, ...b.items.treeJewels].filter((x: Json) => /^Rarity: RARE/.test(x.text)).length;
    expect({ rares, specs: ladder.prices.filter((p: Json) => /^f-/.test(p.id) && p.spec !== undefined).length }).toEqual({ rares: 8, specs: 8 });
    const dir = fileRun();
    editJson(dir, LADDER, (p) => {
      delete p.prices.find((x: Json) => x.id === 'f-ring-1').spec;
    });
    expect(lines(check(dir).stderr, 'owned-guide')).toEqual([expect.stringMatching(/builds\/file\/plan\.json's placed rung "b" prices its rare in Ring 1 by "f-ring-1", which has no spec; in a guide the placed rung's rares are specs/)]);
  });

  it('a planted owned legacy gem kept on a rung fails owned-guide; shown as a trade (the fixture), it passes; with no trade, it fails', () => {
    const kept = fileRun();
    editJson(kept, LADDER, (p) => {
      stageOf(p, 'b').skills.groups[7].gems.push({ name: 'Bloodlust', level: 1, quality: 0, enabled: true });
    });
    expect(lines(check(kept).stderr, 'owned-guide')).toEqual([expect.stringMatching(/builds\/file\/plan\.json's stage b keeps "Bloodlust", which the reader named legacy \(read\.json\); a guide never keeps legacy or no-longer-obtainable content, the character's own included/)]);
    const untraded = fileRun();
    editJson(untraded, 'builds/file/trades.json', (t) => {
      t.trades = t.trades.filter((x: Json) => !/Bloodlust/.test(String(x.from)));
    });
    expect(lines(check(untraded).stderr, 'owned-guide')).toEqual([expect.stringMatching(/builds\/file\/trades\.json has no trade from "Bloodlust", the character's gem the reader named legacy \(read\.json\); owned content a guide can't carry is shown at the design gate as a trade/)]);
  });

  it("the placed rung drops config.file: one keeping the owner's configuration fails ladder", () => {
    const dir = fileRun();
    editJson(dir, LADDER, (p) => {
      stageOf(p, 'b').config.file = readJson(FIXTURE, 'plan.json').stages[0].config.file;
    });
    expect(lines(check(dir).stderr, 'ladder')).toEqual([expect.stringMatching(/the placed rung "b" keeps config\.file, the owner's configuration; a guide's rung takes the guide's/)]);
  });

  it('the placed rung keeps the file\'s items: a changed unique or a rare on another base fails ladder, unless a trade shows it', () => {
    const unique = fileRun();
    editJson(unique, LADDER, (p) => {
      const amulet = stageOf(p, 'b').items.slots.find((x: Json) => x.slot === 'Amulet');
      amulet.text = amulet.text.replace('+12 to Dexterity', '+20 to Dexterity');
    });
    expect(lines(check(unique).stderr, 'ladder')).toEqual([expect.stringMatching(/the placed rung "b"'s Amulet isn't the file's "Choir of the Storm", and no trade in trades\.json shows the change/)]);
    const base = fileRun();
    editJson(base, LADDER, (p) => {
      const ring = stageOf(p, 'b').items.slots.find((x: Json) => x.slot === 'Ring 1');
      ring.text = ring.text.replace('Two-Stone Ring', 'Iron Ring');
    });
    expect(lines(check(base).stderr, 'ladder')).toEqual([expect.stringMatching(/the placed rung "b"'s Ring 1 isn't the file's "Gale Loop" as a spec on its base, and no trade in trades\.json shows the change/)]);
    editJson(base, 'builds/file/trades.json', (t) => {
      t.trades.push({ ...t.trades[0], what: 'Gale Loop for an Iron Ring', from: 'Gale Loop, Two-Stone Ring', to: 'an Iron Ring with life and fire resistance' });
    });
    expect(lines(check(base).stderr, 'ladder')).toEqual([]);
  });

  it("the other rungs are designed, and the placed rung keeps the file's tree, but for a change the user asked for, shown as a trade with its nodes", () => {
    const missing = fileRun();
    editJson(missing, LADDER, (p) => {
      p.stages = p.stages.filter((s: Json) => s.id !== 'n');
    });
    expect(lines(check(missing).stderr, 'ladder')).toContainEqual(expect.stringMatching(/builds\/file\/plan\.json: has no non-budget rung; the ladder designs the other rungs around the placed one, above and below/));
    // A change the user asks for on the placed rung is a trade the gate shows, carrying its nodes (§18).
    const RESPEC = { remove: [] as number[], add: [999999] };
    /** The fixture with b's tree changed by a respec, shown (or not) as a trade on b carrying `nodes`. */
    function respec(trade: boolean, nodes: Json = RESPEC): string {
      const dir = fileRun();
      editJson(dir, LADDER, (p) => {
        stageOf(p, 'b').tree.nodes.push(999999);
      });
      if (!trade) return dir;
      // The trade, in trades.json and in the D1 gate's design field, which carries the same trades (D-439).
      const t = { stage: 'b', kind: 'damage', what: 'the respec the user asked for', ehpChange: 0, damageChange: 2, bossAfter: null, reason: "the user's request at the design gate", maxHit: readJson(dir, 'builds/file/trades.json').trades[0].maxHit, hitsSurvived: null, bossEntries: null, nodes, price: null, from: "the file's tree", to: 'the tree with the node the user asked for' };
      editJson(dir, 'builds/file/trades.json', (f) => {
        f.trades.push(t);
      });
      editJson(dir, GATE, (g) => {
        g.design.rungs.find((r: Json) => r.stage === 'b').trades.push(t);
      });
      return dir;
    }
    const tree = /the placed rung "b"'s tree isn't the file's \(plan\.json's stage "b"\); the placed rung keeps its tree, D1-tree runs on the designed rungs only, and a change the user asks for there is a trade carrying its nodes/;
    expect(lines(check(respec(false)).stderr, 'ladder')).toEqual([expect.stringMatching(tree)]);
    const asked = check(respec(true)).stderr;
    expect({ ladder: lines(asked, 'ladder'), trades: lines(asked, 'trades') }).toEqual({ ladder: [], trades: [] });
    // A trade whose nodes don't give the plan's tree still fails; nodes on a designed rung's trade stay a boss trade's only.
    expect(lines(check(respec(true, { remove: [], add: [888888] })).stderr, 'ladder')).toEqual([expect.stringMatching(/the placed rung "b"'s tree isn't the file's \(plan\.json's stage "b"\) with the nodes its trades remove and add/)]);
    const designed = fileRun();
    for (const [rel, of] of [['builds/file/trades.json', (f: Json) => f.trades], [GATE, (g: Json) => g.design.rungs.find((r: Json) => r.stage === 'n').trades]] as Array<[string, (v: Json) => Json[]]>) {
      editJson(designed, rel, (v) => {
        of(v).find((x: Json) => x.stage === 'n' && x.kind === 'damage')!.nodes = RESPEC;
      });
    }
    expect(lines(check(designed).stderr, 'trades')).toEqual([expect.stringMatching(/is a damage trade with bossEntries null and nodes .*; only a boss trade carries them, null on every other trade/)]);
    const two = fileRun();
    editJson(two, LADDER, (p) => {
      stageOf(p, 'n').source = stageOf(p, 'b').source;
    });
    expect(lines(check(two).stderr, 'ladder')).toEqual([expect.stringMatching(/2 stages keep the reader's source; the placed rung is the one stage that keeps it/)]);
  });

  it("in a file run no owned exemption applies (ownedContent is a compile or pricing run's): the placed rung's entries are held to spec", () => {
    const dir = fileRun();
    editJson(dir, LADDER, (p) => {
      p.prices.find((x: Json) => x.id === 'f-weapon-1').spec = { base: 'x' };
    });
    expect(lines(check(dir).stderr, 'spec')).toContainEqual(expect.stringMatching(/plan\.json's price entry "f-weapon-1" has spec \{"base":"x"\}/));
  });
});

describe("AC-W156 (WU-164, §17, §18): the D1 gate never fails the placed rung for its floor and tree; the designed rungs as today", () => {
  const routing = (dir: string) => lines(check(dir).stderr, 'routing');
  it("the fixture's own gate: the placed rung's floor fails on three resistances, each with its cost, and routes as a pass", () => {
    const g = readJson(FIXTURE, GATE);
    expect({ floor: g.verdict.floor, b: g.findings.filter((f: Json) => f.part === 'floor' && f.cost).map((f: Json) => `${f.code} ${f.stage}`) }).toEqual({ floor: 'fail', b: ['missing-fire-resist b', 'missing-cold-resist b', 'missing-lightning-resist b'] });
    expect(routing(fileRun())).toEqual([]);
  });

  it("a placed rung's tree finding covers its part too; a planted run that fails the gate for the placed rung's findings fails routing", () => {
    const tree = fileRun();
    editJson(tree, GATE, (g) => {
      g.verdict.tree = 'fail';
      g.findings.push({ part: 'tree', code: 'tree-swap', stage: 'b', message: 'a swap left on b gains 6%' });
    });
    expect(routing(tree)).toEqual([]);
    editJson(tree, 'run-log.json', (l) => {
      l.stages[6].outcome = 'fail';
      l.stages.push({ stage: 'D1-build', concept: 'file', attempt: 2, outcome: 'done', scope: 'ladder' });
    });
    expect(routing(tree)).toEqual([expect.stringMatching(/stages\[6\] \(D1-gate file attempt 1\): is routed fail, but its verdict passes, which isn't a failure/)]);
  });

  it("a floor finding on the placed rung with no cost, or on a designed rung, isn't covered: a pass fails routing", () => {
    const uncosted = fileRun();
    editJson(uncosted, GATE, (g) => {
      for (const f of g.findings) delete f.cost;
    });
    expect(routing(uncosted)).toEqual([expect.stringMatching(/is routed pass, but its verdict fails only its floor or named damage source/)]);
    const designed = fileRun();
    editJson(designed, GATE, (g) => {
      g.findings.push({ part: 'floor', code: 'missing-cold-resist', stage: 'n', message: 'n.MissingColdResist 12', cost: 'a cold-resistance ring, its price unavailable offline' });
    });
    expect(routing(designed)).toEqual([expect.stringMatching(/is routed pass, but its verdict fails only its floor or named damage source/)]);
  });

  it("once the guide rests on the ladder's D1 gate, the placed rung's costed findings fail nothing; uncosted, they fail it", () => {
    expect(rulesIn(check(completedRun()).stderr)).toEqual([]);
    const uncosted = completedRun();
    editJson(uncosted, GATE, (g) => {
      for (const f of g.findings) delete f.cost;
    });
    const floor = lines(check(uncosted).stderr, 'floor');
    expect(floor).toEqual(expect.arrayContaining([
      expect.stringMatching(/the guide's concept fails the D1 gate's floor \(missing-cold-resist, stage b\)/),
      expect.stringMatching(/reports\/gates\/D1-gate-file-a1\.json says floor: "fail" \(missing-fire-resist, missing-cold-resist, missing-lightning-resist\), and no accepted finding covers it; the guide's concept passed this gate/),
    ]));
  });

  it("the design display shows the placed rung's costed findings and invites no way back to a verification gate", () => {
    const shown = node(RUN_LOG, [fileRun(), 'display', 'design', '--build', 'file']);
    expect({ code: shown.code, stderr: shown.stderr }).toEqual({ code: 0, stderr: '' });
    expect(shown.stdout).toMatch(/^PoB file: imported-character's Twister \(draft\)\.xml in your Builds folder$/m);
    expect(shown.stdout).toContain('**Not reached on this rung**\n- fire resistance 20% short: a fire-resistance ring, its price unavailable offline.\n- cold resistance 86% short: a cold-resistance ring, its price unavailable offline.');
    expect(shown.stdout).toContain("Ask anything about this build first. Then accept it (I'll ask: its guide or its PoB file only, and late endgame scaling), ask for changes, or stop.");
    expect(shown.stdout).not.toMatch(/verification gate/);
    // The final gate's display offers no way back to a verification gate either.
    const final = node(RUN_LOG, [completedRun(), 'display', 'final', '--build', 'file']);
    expect(final.stdout).toContain('Ask anything about the guide first. Then accept it, add the campaign, ask for changes, or say that you decline it.');
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
    const r = check(withBetter());
    expect({ order: lines(r.stderr, 'order'), routing: lines(r.stderr, 'routing') }).toEqual({ order: [], routing: [] });
  });

  it("with no place after the better round's accept, or the ladder before it, the order fails; its gate takes accept, revise or stop", () => {
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
    const early = withBetter();
    editJson(early, 'run-log.json', (l) => {
      l.stages[5].scope = 'ladder';
    });
    expect(lines(check(early).stderr, 'order')).toContainEqual(expect.stringMatching(/D1-finish file attempt 1\): is D1-finish with scope "ladder", but a file run's better round \(its brief's better\) runs first, with scope better/));
    const round = withBetter();
    editJson(round, 'run-log.json', (l) => {
      l.stages = l.stages.slice(0, 7);
      l.checkpoints = [];
      l.displays = [{ checkpoint: 'design', visit: 1 }];
    });
    expect(write(round, 'checkpoint', { checkpoint: 'design', concept: 'file', visit: 1, answer: 'accept:file', answeredBy: 'user', questions: 0 })).toMatchObject({ code: 1, stderr: expect.stringMatching(/the better round's design gate takes accept \(the result placed again, then the ladder around it\), revise:<text> or stop, and asks no scaling question \(D-521, D-522\)/) });
    expect(write(round, 'checkpoint', { checkpoint: 'design', concept: 'file', visit: 1, answer: 'accept', answeredBy: 'user', questions: 0 }).code).toBe(0);
    expect(node(RUN_LOG, [round, 'display', 'design', '--build', 'file']).stdout).toContain("Then accept it (I'll place it on the ladder again and design the other rungs around it), ask for changes, or stop.");
  });

  /** The fixture after its design gate's accept and F1's pass, then `next`; its brief's campaign as given (absent: built). */
  function afterF1(campaign: boolean | undefined, next: Json[]): string {
    const dir = fileRun();
    editJson(dir, 'run-log.json', (l) => {
      if (campaign === undefined) delete l.brief.campaign;
      else l.brief.campaign = campaign;
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
  const GUIDE = path.join('builds', 'file', 'guide.md');
  const rule = (dir: string) => lines(check(dir).stderr, 'switched-buffs');

  it("the completed run's guide has §14's line for each of its four switched buffs, and passes", () => {
    const groups = stageOf(readJson(FIXTURE, LADDER), 'b').skills.groups.filter((g: Json) => g.switch !== undefined).map((g: Json) => `${g.gems[0].name} ${g.switch.when} ${JSON.stringify(g.switch.off)}`);
    expect(groups).toEqual(['Virtuous Barrier as needed []', 'Trinity as needed [5,10]', 'Blasphemy as needed [5,10]', 'Wind Dancer as needed []']);
    const guide = fs.readFileSync(path.join(COMPLETED, GUIDE), 'utf8');
    expect(guide).toContain('- Trinity: switch it on as needed; switch Herald of Ice and Combat Frenzy off for it.');
    expect(guide).toContain('- Virtuous Barrier: switch it on as needed.');
    expect(rule(completedRun())).toEqual([]);
  });

  it('a guide without a line, or with another when or off list, fails switched-buffs', () => {
    const want = /guide\.md has no line for m's buff switched as needed, group 6 \(Trinity\): "- Trinity: switch it on as needed; switch Herald of Ice and Combat Frenzy off for it\.", one line per switched buff in its skills \(D-518, §14\)/;
    for (const to of ['', '- Trinity: switch it on for bosses; switch Herald of Ice and Combat Frenzy off for it.', '- Trinity: switch it on as needed.']) {
      const dir = completedRun();
      const file = path.join(dir, GUIDE);
      fs.writeFileSync(file, fs.readFileSync(file, 'utf8').replaceAll('- Trinity: switch it on as needed; switch Herald of Ice and Combat Frenzy off for it.', to));
      expect({ to, lines: rule(dir) }).toEqual({ to, lines: [expect.stringMatching(want)] });
    }
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
