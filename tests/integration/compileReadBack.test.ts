/**
 * AC-K83 (WU-138, D-479): `compile_plan`'s read-back and adopt modes, the write ledger's `baseSha1` and `adopted`, the
 * writer's adoption, and `final-build.xml`, through MCP in process, over a private builds, state and guides folder.
 *
 * - The read-back and adopt rows (no engine): each run folder is made by `guide_run {new_run}`; its plan, compile record
 *   and `compiled-build.xml` are written by the test, as a measure-only compile leaves them, and the draft mode writes the
 *   builds-folder file, so the same server (and build-file writer) that wrote the draft reads it back and adopts it. The
 *   XML is `tests/fixtures/plans/m27-wu138/readback-base.xml`: the committed two-stage plan's measure-only compile at the
 *   pin, with PoB's computed `PlayerStat` lines removed. Node names are checked against the pinned tree's `tree.json`,
 *   and the config label against PoB's `ConfigOptions.lua`.
 * - The final-file rows (engine-required): an endgame plan and the two-stage (campaign) plan, compiled for real.
 */
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import { engineDescribe } from '../helpers/engine';
import { startSessionFixture, writeBuild, type SessionFixture } from '../helpers/engineSession';
import { engineKindFor } from '../../src/server/toolRouter';
import { WRITE_LEDGER_FILE } from '../../src/plan/writeLedger';
import type { EngineEvent } from '../../src/engine/session';
import type { ReadBackFile } from '../../src/services/readBack';

const REPO = path.resolve(__dirname, '..', '..');
const FIXTURES = path.join(REPO, 'tests', 'fixtures', 'plans');
const BASE_XML = fs.readFileSync(path.join(FIXTURES, 'm27-wu138', 'readback-base.xml'), 'utf8');
const TWO_STAGE = path.join(FIXTURES, 'two-stage', 'plan.json');
const ENDGAME = path.join(FIXTURES, 'clear-group-granted', 'plan.json');
const TREE = JSON.parse(fs.readFileSync(path.join(REPO, 'vendor', 'PathOfBuilding-PoE2', 'src', 'TreeData', '0_5', 'tree.json'), 'utf8')) as {
  nodes: Record<string, { name?: string; ascendancyName?: string }>;
};
const ENGINE_TIMEOUT = 240_000;
const LOADOUT_1 = 'Act 1 Clearfell (L5) {1}';
const LOADOUT_2 = 'Act 1 Ogham Manor (L14) {2}';

type Json = Record<string, any>;
const sha1 = (data: Buffer | string) => crypto.createHash('sha1').update(data).digest('hex');

/** Every file under `dir`, relative path → sha1. */
function treeOf(dir: string): Record<string, string> {
  const out: Record<string, string> = {};
  const walk = (d: string) => {
    if (!fs.existsSync(d)) return;
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.isFile()) out[path.relative(dir, p).split(path.sep).join('/')] = sha1(fs.readFileSync(p));
    }
  };
  walk(dir);
  return out;
}

interface Run {
  abs: string;
  rel: string;
}

function helpers(get: () => SessionFixture) {
  const ledgerPath = () => path.join(get().server.deps.stateDir, WRITE_LEDGER_FILE);
  const ledger = (): { ledgerVersion: number; entries: Json[] } =>
    fs.existsSync(ledgerPath()) ? JSON.parse(fs.readFileSync(ledgerPath(), 'utf8')) : { ledgerVersion: 0, entries: [] };
  const entryOf = (rel: string) => ledger().entries.find((e) => e.path === rel);
  async function newRun(slug: string): Promise<Run> {
    const out = await get().call('guide_run', { new_run: slug });
    if (out.isError) throw new Error(`guide_run failed: ${out.text}`);
    const abs = /^Created run folder (.+)$/m.exec(out.text)![1];
    const rel = path.posix.dirname(/^plan_path for this run: (\S+)$/m.exec(out.text)![1]);
    return { abs, rel };
  }
  const builds = (name: string) => path.join(get().builds, name);
  return { ledgerPath, ledger, entryOf, newRun, builds };
}

/** The user's edits in PoB, as text edits of the base XML: one item line, one gem level, two tree nodes, one config input. */
function edited(xml: string): string {
  const out = xml
    .replace('+12 to maximum Life', '+15 to maximum Life')
    .replace(/<Gem level="3"([^>]*nameSpec="Boneshatter")/, '<Gem level="4"$1')
    .replace('nodes="6839,47175,', 'nodes="54990,21885,6839,47175,')
    .replace('<Input number="20" name="multiplierRage"/>', '<Input number="10" name="multiplierRage"/>');
  if (out === xml || out.split('\n').length !== xml.split('\n').length) throw new Error('the base XML no longer holds the edited lines');
  return out;
}

describe('AC-K83: compile_plan read_back and adopt (D-479) on a draft the server wrote, with a hand-written measure-only compile', () => {
  let f: SessionFixture;
  const h = helpers(() => f);
  const events: EngineEvent[] = [];

  beforeAll(async () => {
    f = await startSessionFixture({ files: {} });
    f.session.onEvent((e) => events.push(e));
  });
  afterAll(async () => {
    await f?.close();
  });

  /** A build folder holding a plan and the record and XML a whole-plan measure-only compile would leave beside it. */
  function measuredBuild(run: Run, id: string, xml: string = BASE_XML, folder = 'builds') {
    const dir = path.join(run.abs, folder, id);
    fs.mkdirSync(dir, { recursive: true });
    const plan = `${JSON.stringify({ schemaVersion: 9, stages: [{ id: '1' }, { id: '2' }] }, null, 2)}\n`;
    fs.writeFileSync(path.join(dir, 'plan.json'), plan);
    fs.writeFileSync(path.join(dir, 'compiled-build.xml'), xml);
    const record = {
      recordVersion: 2,
      planSha1: sha1(plan),
      mode: 'measure-only',
      stagesCompiled: ['1', '2'],
      pobFile: { location: 'run', path: `${run.rel}/${folder}/${id}/compiled-build.xml`, sha1: sha1(xml), bytes: Buffer.byteLength(xml) },
    };
    fs.writeFileSync(path.join(dir, 'compile-record.json'), JSON.stringify(record));
    return { planPath: `${run.rel}/${folder}/${id}/plan.json`, dir };
  }
  const readBackJson = (dir: string): ReadBackFile => JSON.parse(fs.readFileSync(path.join(dir, 'readback.json'), 'utf8')) as ReadBackFile;

  it('read_back, adopt and notes_path run as engine kind none; trade_links as load', () => {
    expect(engineKindFor('compile_plan', { plan_path: 'p', read_back: 'x.xml' })).toBe('none');
    expect(engineKindFor('compile_plan', { plan_path: 'p', adopt: 'x.xml' })).toBe('none');
    expect(engineKindFor('compile_plan', { plan_path: 'p', notes_path: 'n.txt' })).toBe('none');
    expect(engineKindFor('compile_plan', { plan_path: 'p', trade_links: true })).toBe('load');
  });

  it('read_back of an unchanged draft replies "no changes", writes readback.json with no loadouts, and starts no engine', async () => {
    const run = await h.newRun('unchanged');
    const b = measuredBuild(run, 'r1');
    expect((await f.call('compile_plan', { plan_path: b.planPath, draft_name: 'Unchanged' })).text).toBe('Draft written: Unchanged (draft).xml');
    // The ledger entry's baseSha1 is the sha1 the draft wrote.
    expect(h.entryOf('Unchanged (draft).xml')).toMatchObject({ kind: 'draft', sha1: sha1(BASE_XML), baseSha1: sha1(BASE_XML) });
    const before = { events: events.length, revision: f.session.revision };
    const out = await f.call('compile_plan', { plan_path: b.planPath, read_back: 'Unchanged (draft).xml' });
    expect(out.isError).toBe(false);
    expect(out.text).toBe('Read back: Unchanged (draft).xml: no changes');
    expect(readBackJson(b.dir)).toEqual({ file: 'Unchanged (draft).xml', base: 'compiled-build.xml', baseSha1: sha1(BASE_XML), loadouts: [], unmatched: [] });
    expect(events.length).toBe(before.events);
    expect(f.session.enginePid()).toBeNull();
    expect(f.session.revision).toBe(before.revision);
  });

  it('with one item line, one gem level, two tree nodes and one config input changed, readback.json lists each under its loadout by name, and the reply summarizes them', async () => {
    const run = await h.newRun('edited');
    const b = measuredBuild(run, 'r1');
    await f.call('compile_plan', { plan_path: b.planPath, draft_name: 'Edited' });
    writeBuild(h.builds('Edited (draft).xml'), edited(BASE_XML));
    const out = await f.call('compile_plan', { plan_path: b.planPath, read_back: 'Edited (draft).xml' });
    expect(out.isError).toBe(false);
    // The shared item set {1,2} holds the boots, so its line is listed under both loadouts.
    expect(out.text).toBe(
      `Read back: Edited (draft).xml against compiled-build.xml: 6 changes (${LOADOUT_1}: 1 item line; ` +
        `${LOADOUT_2}: 1 item line, 1 gem change, 2 tree changes, 1 config input)`,
    );
    const rb = readBackJson(b.dir);
    expect(rb).toMatchObject({ file: 'Edited (draft).xml', base: 'compiled-build.xml', baseSha1: sha1(BASE_XML), unmatched: [] });
    expect(rb.loadouts.map((l) => l.title)).toEqual([LOADOUT_1, LOADOUT_2]);
    const two = rb.loadouts[1];
    expect(two.items).toEqual([{ slot: 'Boots', removed: ['+12 to maximum Life'], added: ['+15 to maximum Life'] }]);
    expect(rb.loadouts[0].items).toEqual(two.items);
    expect(two.gems).toEqual([{ group: 1, skill: 'Boneshatter', changes: ['Boneshatter: level 3 → 4'] }]);
    expect(two.tree).toEqual({
      added: [
        { id: 54990, name: TREE.nodes['54990'].name },
        { id: 21885, name: TREE.nodes['21885'].name },
      ],
      removed: [],
      ascendancy: [],
      jewels: [],
      attributes: [],
    });
    expect(two.tree.added.map((n) => n.name)).toEqual(['Bloodletting', 'Stun Threshold and Strength']);
    // The config input by PoB's label (ConfigOptions.lua: "^xFF9922Rage:").
    expect(two.config).toEqual([{ input: 'multiplierRage', label: 'Rage', from: '20', to: '10' }]);
    expect(events.length).toBe(0);
  });

  it('an ascendancy node, a jewel, an attribute choice and a custom modifier are each listed apart, by name', async () => {
    const run = await h.newRun('apart');
    const b = measuredBuild(run, 'r1');
    await f.call('compile_plan', { plan_path: b.planPath, draft_name: 'Apart' });
    const ascendancy = Object.entries(TREE.nodes).find(([, n]) => n.ascendancyName === 'Titan' && n.name === 'Strength')![0];
    const xml = BASE_XML.replace('nodes="6839,47175,', `nodes="${ascendancy},6839,47175,`)
      .replace(
        '<AttributeOverride dexNodes="" strNodes="13397" intNodes=""/>\n\t\t\t</Overrides>\n\t\t</Spec>\n\t</Tree>',
        '<AttributeOverride dexNodes="13397" strNodes="" intNodes=""/>\n\t\t\t</Overrides>\n\t\t</Spec>\n\t</Tree>',
      )
      .replace('<Input number="20" name="multiplierRage"/>', '<Input number="20" name="multiplierRage"/>\n\t\t\t<Input string="+10 to Strength" name="customMods"/>');
    expect(xml).not.toBe(BASE_XML);
    writeBuild(h.builds('Apart (draft).xml'), xml);
    const out = await f.call('compile_plan', { plan_path: b.planPath, read_back: 'Apart (draft).xml' });
    expect(out.isError).toBe(false);
    const two = readBackJson(b.dir).loadouts.find((l) => l.title === LOADOUT_2)!;
    expect(two.tree.ascendancy).toEqual([{ id: Number(ascendancy), name: 'Strength', change: 'added' }]);
    expect(two.tree.added).toEqual([]);
    expect(two.tree.attributes).toEqual([{ id: 13397, name: TREE.nodes['13397'].name, from: 'Strength', to: 'Dexterity' }]);
    expect(two.config).toEqual([{ input: 'customMods', label: 'Custom modifier', from: null, to: '+10 to Strength' }]);
  });

  it('R-77: a loadout whose set the user renamed is listed as unmatched, never compared; one only the edited file has is listed too', async () => {
    const run = await h.newRun('unmatched');
    const b = measuredBuild(run, 'r1');
    await f.call('compile_plan', { plan_path: b.planPath, draft_name: 'Unmatched' });
    const xml = BASE_XML.replace('<SkillSet id="2" title="Act 1 Ogham Manor (L14) {2}">', '<SkillSet id="2" title="My skills">')
      .replace('title="Act 1 Clearfell (L5) {1}" classInternalId', 'title="Act 1 Clearfell (L5) {1,3}" classInternalId');
    expect(xml).not.toBe(BASE_XML);
    writeBuild(h.builds('Unmatched (draft).xml'), xml);
    const out = await f.call('compile_plan', { plan_path: b.planPath, read_back: 'Unmatched (draft).xml' });
    expect(out.isError).toBe(false);
    const rb = readBackJson(b.dir);
    expect(rb.unmatched).toEqual([
      `${LOADOUT_2}: its skill set isn't in the edited file under the compiler's titles`,
      'Act 1 Clearfell (L5) {3}: in the edited file, not in the base',
    ]);
    expect(rb.loadouts.map((l) => l.title)).not.toContain(LOADOUT_2);
    expect(out.text).toMatch(/: 2 changes \(2 unmatched loadouts\)$/);
  });

  it("a gem removed, added, its quality and enabled changed, and a group added or removed, are each named in its group's changes", async () => {
    const run = await h.newRun('gems');
    const b = measuredBuild(run, 'r1');
    await f.call('compile_plan', { plan_path: b.planPath, draft_name: 'Gems' });
    const set2 = BASE_XML.indexOf('<SkillSet id="2"');
    const head = BASE_XML.slice(0, set2);
    let tail = BASE_XML.slice(set2);
    tail = tail
      .replace(/<Gem ([^>]*)quality="0"([^>]*)nameSpec="Rage I"\/>/, '<Gem $1quality="20"$2nameSpec="Rage I"/>')
      .replace(/<Gem ([^>]*)enabled="true"([^>]*)nameSpec="Brutality I"\/>/, '<Gem $1enabled="false"$2nameSpec="Brutality I"/>')
      .replace(/\t\t\t<Skill mainActiveSkillCalcs="1" mainActiveSkill="1" label="Rolling Slam"[\s\S]*?<\/Skill>\n/, '')
      .replace('</SkillSet>', '\t\t\t<Skill mainActiveSkillCalcs="1" mainActiveSkill="1" label="Leap Slam" enabled="true" includeInFullDPS="false">\n\t\t\t\t<Gem level="2" quality="0" enabled="true" nameSpec="Leap Slam"/>\n\t\t\t</Skill>\n\t\t</SkillSet>');
    writeBuild(h.builds('Gems (draft).xml'), head + tail);
    const out = await f.call('compile_plan', { plan_path: b.planPath, read_back: 'Gems (draft).xml' });
    expect(out.isError).toBe(false);
    const two = readBackJson(b.dir).loadouts.find((l) => l.title === LOADOUT_2)!;
    expect(two.gems).toEqual([
      { group: 1, skill: 'Boneshatter', changes: ['Rage I: quality 0 → 20', 'Brutality I: disabled'] },
      { group: 2, skill: 'Rolling Slam', changes: ['group removed'] },
      { group: 2, skill: 'Leap Slam', changes: ['group added: Leap Slam (level 2)'] },
    ]);
  });

  it('after a new compile and draft write over the base, a read-back of the older draft is refused, writing nothing; so is a copy of the older file at the draft path', async () => {
    const run = await h.newRun('stale');
    let b = measuredBuild(run, 'r1');
    await f.call('compile_plan', { plan_path: b.planPath, draft_name: 'Stale' });
    // The user edits the draft; a revision's compile changes the base, and its draft goes to (draft 2).
    writeBuild(h.builds('Stale (draft).xml'), edited(BASE_XML));
    const revised = BASE_XML.replace('+12 to maximum Life', '+13 to maximum Life');
    b = measuredBuild(run, 'r1', revised);
    expect((await f.call('compile_plan', { plan_path: b.planPath, draft_name: 'Stale' })).text.split('\n')[0]).toBe('Draft written: Stale (draft 2).xml');
    let before = treeOf(f.tmp);
    const old = await f.call('compile_plan', { plan_path: b.planPath, read_back: 'Stale (draft).xml' });
    expect(old.isError).toBe(true);
    expect(old.text).toContain('Stale (draft).xml was not read back: the file was written again since');
    expect(old.text).toContain('Nothing was written');
    expect(treeOf(f.tmp)).toEqual(before);

    // The same at one path: an unchanged draft is replaced by the revision's draft, then a PoB still holding the older
    // file saves it back.
    const run2 = await h.newRun('stale-same');
    let c = measuredBuild(run2, 'r1');
    await f.call('compile_plan', { plan_path: c.planPath, draft_name: 'Same Path' });
    const older = fs.readFileSync(h.builds('Same Path (draft).xml'));
    c = measuredBuild(run2, 'r1', revised);
    expect((await f.call('compile_plan', { plan_path: c.planPath, draft_name: 'Same Path' })).text).toContain("It replaced this build's earlier draft");
    writeBuild(h.builds('Same Path (draft).xml'), older.toString('utf8'));
    before = treeOf(f.tmp);
    const copy = await f.call('compile_plan', { plan_path: c.planPath, read_back: 'Same Path (draft).xml' });
    expect(copy.isError).toBe(true);
    expect(copy.text).toContain('the file was written again since');
    expect(treeOf(f.tmp)).toEqual(before);
  });

  it('two read-backs of the same edited file both succeed, the second after its adoption too', async () => {
    const run = await h.newRun('twice');
    const b = measuredBuild(run, 'r1');
    await f.call('compile_plan', { plan_path: b.planPath, draft_name: 'Twice' });
    writeBuild(h.builds('Twice (draft).xml'), edited(BASE_XML));
    const first = await f.call('compile_plan', { plan_path: b.planPath, read_back: 'Twice (draft).xml' });
    const second = await f.call('compile_plan', { plan_path: b.planPath, read_back: 'Twice (draft).xml' });
    expect(first.isError).toBe(false);
    expect(second.text).toBe(first.text);
    expect((await f.call('compile_plan', { plan_path: b.planPath, adopt: 'Twice (draft).xml' })).text).toBe('Adopted: Twice (draft).xml');
    const third = await f.call('compile_plan', { plan_path: b.planPath, read_back: 'Twice (draft).xml' });
    expect(third.text).toBe(first.text);
  });

  it('after adopt, the next draft write replaces the edited file, leaving a backup, with no (draft 2); without adopt it forks to (draft 2)', async () => {
    const run = await h.newRun('adopt');
    let b = measuredBuild(run, 'r1');
    await f.call('compile_plan', { plan_path: b.planPath, draft_name: 'Adopted' });
    const edit = edited(BASE_XML);
    writeBuild(h.builds('Adopted (draft).xml'), edit);
    await f.call('compile_plan', { plan_path: b.planPath, read_back: 'Adopted (draft).xml' });
    const out = await f.call('compile_plan', { plan_path: b.planPath, adopt: 'Adopted (draft).xml' });
    expect(out.isError).toBe(false);
    expect(out.text).toBe('Adopted: Adopted (draft).xml');
    // The ledger takes the edited file's sha1, marks it adopted and keeps the base; the file is untouched.
    expect(h.entryOf('Adopted (draft).xml')).toMatchObject({ sha1: sha1(edit), baseSha1: sha1(BASE_XML), adopted: true, kind: 'draft', plan: b.planPath });
    expect(fs.readFileSync(h.builds('Adopted (draft).xml'), 'utf8')).toBe(edit);

    // The revision's compile and draft: the adopted file is replaced, backed up first.
    const revised = edit.replace('+15 to maximum Life', '+16 to maximum Life');
    b = measuredBuild(run, 'r1', revised);
    const next = await f.call('compile_plan', { plan_path: b.planPath, draft_name: 'Adopted' });
    expect(next.isError).toBe(false);
    expect(next.text).toBe("Draft written: Adopted (draft).xml\nIt replaced this build's earlier draft of that name.");
    expect(fs.readFileSync(h.builds('Adopted (draft).xml'), 'utf8')).toBe(revised);
    expect(fs.existsSync(h.builds('Adopted (draft 2).xml'))).toBe(false);
    const backups = path.join(f.server.deps.stateDir, 'backups', 'Adopted (draft).xml');
    const kept = fs.readdirSync(backups).map((n) => fs.readFileSync(path.join(backups, n), 'utf8'));
    expect(kept).toContain(edit);
    // A new write's entry is no longer adopted, and its base is the new write.
    const entry = h.entryOf('Adopted (draft).xml')!;
    expect(entry).toMatchObject({ sha1: sha1(revised), baseSha1: sha1(revised) });
    expect(entry).not.toHaveProperty('adopted');

    // Without adopt (today's behaviour): the next draft forks to (draft 2), leaving the edited file.
    const run2 = await h.newRun('no-adopt');
    let c = measuredBuild(run2, 'r1');
    await f.call('compile_plan', { plan_path: c.planPath, draft_name: 'Not Adopted' });
    writeBuild(h.builds('Not Adopted (draft).xml'), edit);
    await f.call('compile_plan', { plan_path: c.planPath, read_back: 'Not Adopted (draft).xml' });
    c = measuredBuild(run2, 'r1', revised);
    const fork = await f.call('compile_plan', { plan_path: c.planPath, draft_name: 'Not Adopted' });
    expect(fork.text.split('\n')[0]).toBe('Draft written: Not Adopted (draft 2).xml');
    expect(fs.readFileSync(h.builds('Not Adopted (draft).xml'), 'utf8')).toBe(edit);
  });

  it('an adopted skeleton is removed by remove_draft; a changed one not adopted is refused', async () => {
    const run = await h.newRun('skeleton');
    const concept = measuredBuild(run, 'r1-s-1', BASE_XML, 'concepts');
    expect((await f.call('compile_plan', { plan_path: concept.planPath, draft_name: 'Rake Titan skeleton' })).text).toBe(
      'Draft written: Rake Titan skeleton (draft).xml',
    );
    const edit = edited(BASE_XML);
    writeBuild(h.builds('Rake Titan skeleton (draft).xml'), edit);
    const refused = await f.call('compile_plan', { plan_path: concept.planPath, remove_draft: 'Rake Titan skeleton (draft).xml' });
    expect(refused.isError).toBe(true);
    expect(refused.text).toContain('it changed on disk since this build wrote it');
    expect((await f.call('compile_plan', { plan_path: concept.planPath, read_back: 'Rake Titan skeleton (draft).xml' })).isError).toBe(false);
    expect((await f.call('compile_plan', { plan_path: concept.planPath, adopt: 'Rake Titan skeleton (draft).xml' })).isError).toBe(false);
    const removed = await f.call('compile_plan', { plan_path: concept.planPath, remove_draft: 'Rake Titan skeleton (draft).xml' });
    expect(removed.isError).toBe(false);
    expect(removed.text).toMatch(/^Draft removed: Rake Titan skeleton \(draft\)\.xml \(backup .+_before-delete\.xml\)$/);
    expect(fs.existsSync(h.builds('Rake Titan skeleton (draft).xml'))).toBe(false);
    expect(h.entryOf('Rake Titan skeleton (draft).xml')).toBeUndefined();
  });

  it("read_back and adopt refuse, changing nothing, a file no compile wrote, another build's file and a missing file", async () => {
    const run = await h.newRun('refusals');
    const mine = measuredBuild(run, 'r1');
    const other = measuredBuild(run, 'r2');
    await f.call('compile_plan', { plan_path: other.planPath, draft_name: 'Other' });
    fs.writeFileSync(h.builds('Nobody.xml'), BASE_XML);
    await f.call('compile_plan', { plan_path: mine.planPath, draft_name: 'Gone' });
    fs.rmSync(h.builds('Gone (draft).xml'));
    const before = treeOf(f.tmp);
    const cases: Array<[string, string]> = [
      ['Nobody.xml', 'no compile_plan wrote it'],
      ['Other (draft).xml', `another build's file (${other.planPath})`],
      ['Gone (draft).xml', "it doesn't exist in the builds folder"],
    ];
    for (const [file, why] of cases) {
      for (const mode of ['read_back', 'adopt']) {
        const out = await f.call('compile_plan', { plan_path: mine.planPath, [mode]: file });
        expect({ file, mode, isError: out.isError }).toEqual({ file, mode, isError: true });
        expect(out.text).toContain(why);
      }
    }
    expect(treeOf(f.tmp)).toEqual(before);
  });

  it('read_back, adopt, notes_path and trade_links take plan_path only; trade_links must be true', async () => {
    for (const [mode, value] of [['read_back', 'x.xml'], ['adopt', 'x.xml'], ['notes_path', 'n.txt'], ['trade_links', true]] as const) {
      for (const extra of [{ build_name: 'x' }, { measure_only: true }, { draft_name: 'X' }]) {
        const out = await f.call('compile_plan', { plan_path: 'a/2026-11-02-1/plan.json', [mode]: value, ...extra });
        expect(out.isError).toBe(true);
        expect(out.text).toContain('as do read_back, adopt, notes_path and trade_links');
      }
    }
    const no = await f.call('compile_plan', { plan_path: 'a/2026-11-02-1/plan.json', trade_links: false });
    expect(no.isError).toBe(true);
    expect(no.text).toContain('trade_links must be true');
    expect(f.session.enginePid()).toBeNull();
  });
});

// ---------------------------------------------------------------------------------------------------
// The final-file rows: the engine

engineDescribe('AC-K83: final-build.xml and a read-back of an edited final file (D-479), engine', () => {
  let f: SessionFixture;
  const h = helpers(() => f);

  beforeAll(async () => {
    f = await startSessionFixture({ files: {} });
  }, ENGINE_TIMEOUT);
  afterAll(async () => {
    await f?.close();
  });

  async function planIn(run: Run, source: string): Promise<string> {
    const rel = `${run.rel}/builds/r1/plan.json`;
    fs.mkdirSync(path.dirname(path.join(f.guides, rel)), { recursive: true });
    fs.copyFileSync(source, path.join(f.guides, rel));
    return rel;
  }
  const beside = (plan: string, name: string) => path.join(f.guides, path.posix.dirname(plan), name);

  it('a final compile writes final-build.xml byte-equal to the final file, and a read-back of the edited final file compares against it', async () => {
    const run = await h.newRun('final-copy');
    const plan = await planIn(run, ENDGAME);
    const out = await f.call('compile_plan', { plan_path: plan, build_name: 'Final Copy', first_free: true });
    expect(out.isError).toBe(false);
    expect(out.text).toContain(`Wrote ${run.rel}/builds/r1/final-build.xml in the guides root.`);
    const finalBytes = fs.readFileSync(h.builds('Final Copy.xml'));
    expect(fs.readFileSync(beside(plan, 'final-build.xml')).equals(finalBytes)).toBe(true);
    expect(fs.existsSync(beside(plan, 'final-build-campaign.xml'))).toBe(false);
    expect(h.entryOf('Final Copy.xml')).toMatchObject({ kind: 'final', sha1: sha1(finalBytes), baseSha1: sha1(finalBytes) });

    expect((await f.call('compile_plan', { plan_path: plan, read_back: 'Final Copy.xml' })).text).toBe('Read back: Final Copy.xml: no changes');
    // The user raises a gem's level in PoB and saves.
    const xml = finalBytes.toString('utf8');
    // PoB's attribute order varies between processes: the gem's level and name are read wherever they sit.
    const gemEl = /<Gem\b[^>]*>/.exec(xml)![0];
    const level = Number(/\blevel="(\d+)"/.exec(gemEl)![1]);
    const name = /\bnameSpec="([^"]+)"/.exec(gemEl)![1];
    writeBuild(h.builds('Final Copy.xml'), xml.replace(gemEl, gemEl.replace(/\blevel="\d+"/, `level="${level + 1}"`)));
    const back = await f.call('compile_plan', { plan_path: plan, read_back: 'Final Copy.xml' });
    expect(back.isError).toBe(false);
    expect(back.text).toMatch(/^Read back: Final Copy\.xml against final-build\.xml: 1 change \(.+: 1 gem change\)$/);
    const rb = JSON.parse(fs.readFileSync(beside(plan, 'readback.json'), 'utf8')) as ReadBackFile;
    expect(rb.base).toBe('final-build.xml');
    expect(rb.loadouts[0].gems[0].changes).toEqual([`${name}: level ${level} → ${level + 1}`]);
  }, ENGINE_TIMEOUT);

  it("a campaign's final compile writes final-build-campaign.xml, and the endgame copy beside it is left as it was", async () => {
    const run = await h.newRun('campaign-copy');
    const plan = await planIn(run, TWO_STAGE);
    // An endgame copy from an earlier final compile of this build.
    fs.writeFileSync(beside(plan, 'final-build.xml'), 'the endgame copy');
    const out = await f.call('compile_plan', { plan_path: plan, build_name: 'Copy (campaign)', first_free: true });
    expect(out.isError).toBe(false);
    const finalBytes = fs.readFileSync(h.builds('Copy (campaign).xml'));
    expect(fs.readFileSync(beside(plan, 'final-build-campaign.xml')).equals(finalBytes)).toBe(true);
    expect(fs.readFileSync(beside(plan, 'final-build.xml'), 'utf8')).toBe('the endgame copy');
    expect((await f.call('compile_plan', { plan_path: plan, read_back: 'Copy (campaign).xml' })).text).toBe('Read back: Copy (campaign).xml: no changes');
  }, ENGINE_TIMEOUT);
});
