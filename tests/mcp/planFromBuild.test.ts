/**
 * AC-W148 (WU-160, D-517, C-62; amendment 16 §13 and Appendix A.7): `plan_from_build`'s contract, in process with no
 * engine (kind `none`).
 *
 * - The server lists 86 tools (85 with poe.ninja off, 79 with trade and poe.ninja off), `plan_from_build` among them
 *   with engine kind `none`, group `core` and a description under 2,048 characters.
 * - Each refusal of §13 is an `isError` that writes nothing: a document that isn't `<PathOfBuilding2>`, a tree version
 *   the pin lacks (and none), a `build_name` that isn't a builds-folder file, a code that doesn't decode or inflates past
 *   16 MiB, a run folder outside the guides root or without `run-log.json`, both or neither of `build_name` and
 *   `import_code` on the first call, an answer on the first call, a first call on a run folder that already holds a read
 *   (WU-160's fix round), a changed builds-folder file on the second, a plan a design step wrote, an answer naming a group,
 *   loadout or slot the file lacks, and a `switch_off` entry for a group that isn't switched or an `off` number that isn't
 *   a plan group or is the group itself (`switch_off`: the coordinator's ruling, departing from Appendix A.7).
 * - A copy of the importer fixture on the `0_4` tree asks the tree question: no plan.json until `tree` is answered;
 *   "newest" reads it onto the pin's newest tree, "stop" reads nothing.
 * - The first call keeps `source.xml` (the file's bytes) and its sha1 in `read.json`; neither the builds folder nor the
 *   source changes, and the engine never starts.
 */
import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { startTestServer } from '../helpers/server';
import { IMPORTER, readerLayout, sha1, textOf, type ReaderLayout } from '../helpers/planFromBuild';
import { TOOL_META } from '../../src/server/toolMeta';
import { encodePobCode } from '../../src/utils/buildCode';

const xml = fs.readFileSync(IMPORTER, 'utf8');
const withTree = (version: string) => xml.replace(/treeVersion="0_5"/g, `treeVersion="${version}"`);

describe('AC-W148 (WU-160, D-517): plan_from_build is listed as the 86th tool', () => {
  it('AC-W148: 86 tools, 85 with poe.ninja off, 79 with trade and poe.ninja off; plan_from_build is engine none, group core, described in under 2,048 characters', async () => {
    expect(TOOL_META.plan_from_build).toEqual({ engine: 'none', group: 'core' });
    const counts: number[] = [];
    for (const env of [
      { POE_TRADE_DISABLED: undefined, POE_NINJA_DISABLED: undefined },
      { POE_TRADE_DISABLED: undefined, POE_NINJA_DISABLED: 'true' },
      { POE_TRADE_DISABLED: 'true', POE_NINJA_DISABLED: 'true' },
    ]) {
      const server = await startTestServer({ env });
      try {
        const tools = (await server.client.listTools()).tools;
        counts.push(tools.length);
        const tool = tools.find((t) => t.name === 'plan_from_build');
        expect(tool).toBeDefined();
        expect((tool?.description ?? '').length).toBeLessThan(2048);
        expect(tool?.inputSchema.required).toEqual(['run_folder']);
      } finally {
        await server.close();
      }
    }
    expect(counts).toEqual([86, 85, 79]);
  });
});

describe('AC-W148 (WU-160, D-517): plan_from_build refuses, writing nothing; the first call keeps source.xml', () => {
  let L: ReaderLayout;
  let buildsBefore: Record<string, string>;
  const buildsListing = () =>
    Object.fromEntries(fs.readdirSync(L.builds).sort().map((f) => [f, sha1(fs.readFileSync(path.join(L.builds, f)))]));

  beforeAll(async () => {
    L = await readerLayout();
    fs.writeFileSync(path.join(L.builds, 'poe1.xml'), '<?xml version="1.0" encoding="UTF-8"?>\n<PathOfBuilding>\n\t<Build level="90" className="Witch"/>\n</PathOfBuilding>\n');
    fs.writeFileSync(path.join(L.builds, 'next-tree.xml'), withTree('0_6'));
    fs.writeFileSync(path.join(L.builds, 'no-tree.xml'), xml.replace(/ treeVersion="0_5"/g, ''));
    buildsBefore = buildsListing();
  });
  afterAll(async () => {
    await L?.close();
  });

  /** The call is an isError and the run folder is as it was: only its run log, or what an earlier call left. */
  async function refused(rel: string, args: Record<string, unknown>, why: RegExp) {
    const before = L.files(rel);
    const r = await L.call({ run_folder: rel, ...args });
    expect({ isError: r.isError, text: textOf(r) }).toEqual({ isError: true, text: expect.stringMatching(why) });
    expect(L.files(rel)).toEqual(before);
  }

  it('AC-W148: the first call keeps source.xml, the file\'s bytes, and its sha1 in read.json; the builds folder and the file are unchanged', async () => {
    const rel = L.run();
    const r = await L.call({ run_folder: rel, build_name: 'imported-character' });
    expect(r.isError).toBeFalsy();
    expect(textOf(r).split('\n')[0]).toMatch(/^Read imported-character\.xml \(Endgame\) into compile\/2026-12-01-\d+\/plan\.json: stage f, level 90, \d+ items \(\d+ owned\), \d+ groups\.$/);
    const files = L.files(rel);
    expect(Object.keys(files)).toEqual(['plan.json', 'read.json', 'run-log.json', 'source.xml']);
    expect(files['source.xml']).toBe(xml);
    const read = L.json(rel, 'read.json');
    expect(read.source).toEqual({ kind: 'builds-folder', name: 'imported-character.xml', sha1: sha1(xml), copy: 'source.xml' });
    expect(L.json(rel, 'plan.json').stages[0].source).toEqual({ kind: 'builds-folder', name: 'imported-character.xml', sha1: sha1(xml), loadout: 'Endgame' });
    expect(buildsListing()).toEqual(buildsBefore);
    expect(L.spawns()).toBe(0);
  });

  it('AC-W148: a document that is not <PathOfBuilding2>, by name or by code, is refused', async () => {
    const rel = L.run();
    await refused(rel, { build_name: 'poe1' }, /expected <PathOfBuilding2>/);
    await refused(rel, { import_code: encodePobCode(fs.readFileSync(path.join(L.builds, 'poe1.xml'), 'utf8')) }, /expected <PathOfBuilding2>/);
  });

  it("AC-W148: a tree version the pin lacks is refused, naming it; so is a spec with none", async () => {
    const rel = L.run();
    await refused(rel, { build_name: 'next-tree' }, /version "0_6", which the pin \(trees 0_1, 0_2, 0_3, 0_4, 0_5\) doesn't hold/);
    await refused(rel, { import_code: encodePobCode(withTree('0_6')) }, /version "0_6"/);
    await refused(rel, { build_name: 'no-tree' }, /version "none"/);
  });

  it("AC-W148: a build_name that isn't a builds-folder file is refused", async () => {
    const rel = L.run();
    await refused(rel, { build_name: 'nosuch' }, /build_name "nosuch" isn't a file of the builds folder/);
    await refused(rel, { build_name: '../x' }, /build_name "\.\.\/x" isn't a file of the builds folder/);
  });

  it("AC-W148: a code that doesn't decode, or inflates past 16 MiB, is refused", async () => {
    const rel = L.run();
    await refused(rel, { import_code: 'not a code!' }, /import_code doesn't decode/);
    const huge = zlib.deflateSync(Buffer.from(`<PathOfBuilding2>${' '.repeat(17 * 1024 * 1024)}</PathOfBuilding2>`)).toString('base64');
    await refused(rel, { import_code: huge }, /import_code doesn't decode: build code too large \(inflates beyond 16 MiB\)/);
  });

  it('AC-W148: a run folder outside the guides root, or without run-log.json, is refused', async () => {
    const r1 = await L.call({ run_folder: '../outside', build_name: 'imported-character' });
    expect(r1.isError).toBe(true);
    expect(textOf(r1)).toMatch(/run_folder "\.\.\/outside" has a "\.\." segment/);
    fs.mkdirSync(path.join(L.guides, 'compile', 'no-log'), { recursive: true });
    const r2 = await L.call({ run_folder: 'compile/no-log', build_name: 'imported-character' });
    expect(r2.isError).toBe(true);
    expect(textOf(r2)).toMatch(/holds no run-log\.json/);
    expect(fs.readdirSync(path.join(L.guides, 'compile', 'no-log'))).toEqual([]);
  });

  it('AC-W148: on the first call, both or neither of build_name and import_code, or an answer, is refused', async () => {
    const rel = L.run();
    await refused(rel, { build_name: 'imported-character', import_code: encodePobCode(xml) }, /build_name and import_code conflict/);
    await refused(rel, {}, /holds no read\.json and source\.xml of an earlier read: the first call gives build_name or import_code/);
    await refused(rel, { build_name: 'imported-character', main_group: 2 }, /main_group: the first call takes no answer/);
  });

  it('AC-W148: a first call on a run folder that already holds a read is refused: its source.xml, plan.json and read.json stay', async () => {
    const rel = L.run();
    expect((await L.call({ run_folder: rel, build_name: 'imported-character' })).isError).toBeFalsy();
    expect((await L.call({ run_folder: rel, main_group: 4 })).isError).toBeFalsy();
    const why = /this run folder already holds a read \(compile\/2026-12-01-\d+\/source\.xml\); the second call gives answers only/;
    await refused(rel, { build_name: 'imported-ninja' }, why);
    await refused(rel, { import_code: encodePobCode(xml) }, why);
    expect(L.json(rel, 'read.json').answers).toEqual({ main_group: 4 });
    // read.json alone, as an earlier read could leave it, also holds the folder.
    const other = L.run();
    fs.writeFileSync(path.join(L.guides, other, 'read.json'), '{}\n');
    await refused(other, { build_name: 'imported-ninja' }, /already holds a read \(compile\/2026-12-01-\d+\/read\.json\)/);
  });

  it('AC-W148: on the second call, a builds-folder file changed since the first read is refused', async () => {
    const rel = L.run();
    fs.copyFileSync(IMPORTER, path.join(L.builds, 'changing.xml'));
    expect((await L.call({ run_folder: rel, build_name: 'changing' })).isError).toBeFalsy();
    fs.appendFileSync(path.join(L.builds, 'changing.xml'), '\n');
    await refused(rel, { main_group: 4 }, /the builds-folder file changing\.xml changed on disk/);
    fs.rmSync(path.join(L.builds, 'changing.xml'));
  });

  it('AC-W148: a plan a design step wrote is never replaced, by either call', async () => {
    const rel = L.run([{ stage: 'D1-build', concept: 'file', attempt: 1, outcome: 'done' }]);
    await refused(rel, { build_name: 'imported-character' }, /the run log holds a D1-build entry/);
    fs.writeFileSync(path.join(L.guides, rel, 'read.json'), '{}');
    await refused(rel, { main_group: 1 }, /the run log holds a D1-build entry/);
  });

  it('AC-W148: an answer naming a group, loadout or slot the file lacks is refused', async () => {
    const rel = L.run();
    expect((await L.call({ run_folder: rel, build_name: 'imported-character' })).isError).toBeFalsy();
    await refused(rel, { main_group: 99 }, /main_group names group 99, which the plan lacks: its groups are 1 to 11/);
    await refused(rel, { buffs_on: [5, 42] }, /buffs_on names group 42/);
    await refused(rel, { buffs_on: [5], buffs_swap: [5] }, /group 5 is in both buffs_on and buffs_swap/);
    await refused(rel, { loadout: 'Atlas' }, /loadout "Atlas" isn't a loadout of the file; its loadouts: "Endgame", "Leveling"/);
    await refused(rel, { stand_in: { Helmet: 'plain base' } }, /stand_in names "Helmet", which holds no item on a base the pin lacks; the slots that do: Gloves/);
  });

  it('AC-W148: switch_off (departing from A.7) is refused for a group that is not switched, an off group the plan lacks or the group itself, and with no Spirit answer', async () => {
    const rel = L.run();
    expect((await L.call({ run_folder: rel, build_name: 'imported-character' })).isError).toBeFalsy();
    await refused(rel, { switch_off: { 7: [4] } }, /switch_off names groups, but no group is switched: buffs_on or buffs_swap answers the Spirit question first/);
    const buffs = { buffs_on: [5, 6], buffs_swap: [9] };
    // Groups 2, 7 and 10 are switched; 5 is kept on.
    await refused(rel, { ...buffs, switch_off: { 5: [6] } }, /switch_off names group 5, which isn't switched: the switched Spirit buffs, neither kept on nor swapped, are 2, 7, 10/);
    await refused(rel, { ...buffs, switch_off: { 7: [7] } }, /switch_off's group 7 lists itself/);
    await refused(rel, { ...buffs, switch_off: { 7: [12] } }, /switch_off's group 7 names group 12, which the plan lacks: its groups are 1 to 11/);
    await refused(rel, { ...buffs, switch_off: { x: [4] } }, /switch_off's key "x" isn't a plan group number/);
    await refused(rel, { ...buffs, switch_off: { 7: [4, 4] } }, /switch_off's group 7 names a group twice/);
  });

  it('AC-W148: a copy of the importer fixture on the 0_4 tree asks the tree question; "newest" reads it, "stop" reads nothing', async () => {
    const rel = L.run();
    const r = await L.call({ run_folder: rel, import_code: encodePobCode(withTree('0_4')) });
    expect(r.isError).toBeFalsy();
    expect(textOf(r)).toContain('no plan.json yet; the tree question comes first');
    expect(textOf(r)).toMatch(/- tree: plan none, file "0_4"; the file's tree is version 0_4, older than the pin's newest 0_5/);
    expect(Object.keys(L.files(rel))).toEqual(['read.json', 'run-log.json', 'source.xml']);
    expect(L.json(rel, 'read.json').questions.map((q: { field: string }) => q.field)).toEqual(['loadout', 'tree']);

    const newest = await L.call({ run_folder: rel, tree: 'newest' });
    expect(newest.isError).toBeFalsy();
    expect(textOf(newest)).not.toMatch(/- tree:/);
    const plan = L.json(rel, 'plan.json');
    expect(plan.versions.treeVersion).toBe('0_5');
    expect(L.json(rel, 'read.json')).toMatchObject({ treeVersion: '0_4', answers: { tree: 'newest' } });

    const stop = await L.call({ run_folder: rel, tree: 'stop' });
    expect(stop.isError).toBeFalsy();
    expect(textOf(stop)).toMatch(/answered "stop": nothing is read onto the pin's tree, and the run folder holds no plan\.json/);
    expect(Object.keys(L.files(rel))).toEqual(['read.json', 'run-log.json', 'source.xml']);
  });

  it('AC-W148: the builds folder is as it was, and the engine never started', () => {
    expect(buildsListing()).toEqual(buildsBefore);
    expect(L.spawns()).toBe(0);
  });
});
