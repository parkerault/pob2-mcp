/**
 * WU-128 (amendment 13 §4, D-463; AC-P86, R-63): Split Personality's start through `compile_plan` and `compile_check`, in
 * process and engine-required. V1's `alternate-class-start` over hand-made trees is `tests/unit/v1Schema9.test.ts`.
 *
 * Split Personality (`Data/Uniques/jewel.lua`:66-82, a Ruby limited to 1, `Corrupted`) has one variant per start; its
 * text here is the pinned data's, verbatim, with the `Selected Variant` line PoB writes for a chosen variant (6, the
 * Warrior's start; 4, the Sorceress's). PoB parses its line to `AlternateClassStart` (`Modules/ModParser.lua`:2755-2756)
 * and maps the class to its start node (`Classes/PassiveTree.lua`:204-212). The trees come from the pinned tree data, read
 * here as plain JSON (`TreeData/0_5/tree.json`), never from the check's own output:
 * - a Mercenary (Witchhunter) whose path from its start (50986) reaches the jewel socket 54127 (`MERC_PATH`: Armour and
 *   Evasion 59779, eight attribute nodes, the socket), with the jewel in it and a tree from the Warrior start (47175) off
 *   its exit 3936: 3936 and 46325 (Melee Damage);
 * - the same with a second tree off the Warrior start's other exit, 38646 (Armour);
 * - the same tree without the jewel, and a Mercenary that reaches 54127 only through the Warrior start (`WAR_PATH`, off
 *   38646): refused, since the stricter socket rule (R-63) opens the start only for a socket reached without it;
 * - a Warrior (Titan, the two-stage fixture) with the jewel's Warrior variant in 26725, the socket its tree reaches
 *   (compileSchema8's path): `alternate-class-start`.
 * The spike (§4: "a fixture stage with the jewel socketed and a tree from the Warrior start compiles with no connection
 * defect") is this file's first compile.
 */
import fs from 'fs';
import path from 'path';
import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import { engineDescribe } from '../helpers/engine';
import { startSessionFixture, type SessionFixture } from '../helpers/engineSession';
import { checkStageOf } from '../../src/plan/compiler';
import type { CompileCheckResult } from '../../src/engine/schemas';
import type { CompileRecord, Finding } from '../../src/plan/record';
import type { Stage } from '../../src/plan/schema';

const REPO = path.resolve(__dirname, '..', '..');
const TWO_STAGE = path.join(REPO, 'tests', 'fixtures', 'plans', 'two-stage', 'plan.json');
const TREE_JSON = path.join(REPO, 'vendor', 'PathOfBuilding-PoE2', 'src', 'TreeData', '0_5', 'tree.json');
const ENGINE_TIMEOUT = 600_000;

type Json = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
const read = (file: string): Json => JSON.parse(fs.readFileSync(file, 'utf8')) as Json;
const sorted = (xs: Iterable<number>) => [...xs].sort((a, b) => a - b);

// ---------------------------------------------------------------------------------------------------
// The pinned tree data, read here as plain JSON

const TREE: Json = read(TREE_JSON);
const links = new Map<number, Set<number>>();
for (const [id, node] of Object.entries<Json>(TREE.nodes)) {
  for (const c of node.connections ?? []) {
    const [a, b] = [Number(id), Number(c.id)];
    if (!(String(b) in TREE.nodes)) continue;
    if (!links.has(a)) links.set(a, new Set());
    if (!links.has(b)) links.set(b, new Set());
    links.get(a)!.add(b);
    links.get(b)!.add(a);
  }
}
const nodeOf = (id: number): Json => TREE.nodes[String(id)];
const classStart = (name: string): number =>
  Number(Object.entries<Json>(TREE.nodes).find(([, n]) => (n.classesStart ?? []).includes(name))![0]);
const isStart = (id: number) => nodeOf(id).classesStart !== undefined || nodeOf(id).isAscendancyStart === true;
const mainLinks = (id: number) => sorted([...links.get(id)!].filter((o) => !isStart(o) && nodeOf(o).ascendancyName === undefined));

const MERC_START = classStart('Mercenary');
const WAR_START = classStart('Warrior');
const SORC_START = classStart('Sorceress');
const SOCKET = 54127;
/** From the Mercenary start to the socket 54127: Armour and Evasion, eight attribute nodes, the socket. */
const MERC_PATH = [59779, 42350, 61438, 28510, 10247, 28370, 63526, 48635, 21755, SOCKET];
/** From the Warrior start's exit 38646 to the socket 54127, joining MERC_PATH at 28510. */
const WAR_PATH = [38646, 23570, 41031, 54232, 16168, 25374, 45969, 28510, 10247, 28370, 63526, 48635, 21755, SOCKET];
/** A tree off the Warrior start's exit 3936: two Melee Damage nodes. */
const WAR_TREE = [3936, 46325];
/** The Warrior start's other exit, Armour: a second tree when listed alone. */
const SECOND_TREE = [38646];

/** The two-stage fixture's path from Brutal (5710) to the jewel socket 26725 (compileSchema8). */
const TITAN_SOCKET_PATH = [38323, 22928, 27373, 16725, 54811, 57703];
const TITAN_SOCKET = 26725;

/** Split Personality as the pinned data writes it (`Data/Uniques/jewel.lua`:66-82), with its selected variant. */
const splitPersonality = (variant: number) =>
  [
    'Rarity: Unique',
    'Split Personality',
    'Ruby',
    'Variant: Mercenary',
    'Variant: Ranger',
    'Variant: Shadow',
    'Variant: Sorceress',
    'Variant: Templar',
    'Variant: Warrior',
    `Selected Variant: ${variant}`,
    'League: Runes of Aldur',
    'Limited to: 1',
    "{variant:2}Can Allocate Passive Skills from the Ranger's starting point",
    "{variant:3}Can Allocate Passive Skills from the Shadow's starting point",
    "{variant:4}Can Allocate Passive Skills from the Sorceress's starting point",
    "{variant:6}Can Allocate Passive Skills from the Warrior's starting point",
    "{variant:1}Can Allocate Passive Skills from the Mercenary's starting point",
    "{variant:5}Can Allocate Passive Skills from the Templar's starting point",
    'Corrupted',
  ].join('\n');
const WARRIOR_VARIANT = 6;
const SORCERESS_VARIANT = 4;

const isAttribute = (id: number) => nodeOf(id).isAttribute === true;
const CAMPAIGN_KEY = 'q.act-4-isle-of-kin-blind-beast';

/** A campaign stage at level 45 on the two-stage fixture's stage-2 content, its tree replaced. */
function stageWith(id: string, nodes: number[], jewel: string | null, socket = SOCKET): Json {
  const s = read(TWO_STAGE).stages[1];
  Object.assign(s, { id, loadoutName: `Stage ${id} (L45) {${id}}`, level: 45, progress: CAMPAIGN_KEY, claims: [] });
  s.tree.nodes = [...nodes];
  s.tree.attributeChoices = nodes.filter(isAttribute).map((node) => ({ node, attribute: 'strength' }));
  s.items.treeJewels = jewel === null ? [] : [{ node: socket, text: jewel }];
  return s;
}

/** A Mercenary (Witchhunter) plan of `stages` at `version`. */
function mercPlan(version: number, stages: Json[]): Json {
  const p = read(TWO_STAGE);
  Object.assign(p, { schemaVersion: version, roll: { ...p.roll, className: 'Mercenary', ascendancy: 'Witchhunter' }, stages, ledger: [] });
  return p;
}

/** A Warrior (Titan) stage: the two-stage stage 2's tree, the path to 26725 and the jewel in it. */
function titanStage(id: string, jewel: string): Json {
  const base = read(TWO_STAGE).stages[1];
  return stageWith(id, [...base.tree.nodes, ...TITAN_SOCKET_PATH, TITAN_SOCKET], jewel, TITAN_SOCKET);
}

const codesOf = (record: CompileRecord, id: string, code: string): Finding[] => record.stages[id].v1!.findings.filter((f) => f.code === code);

/** The saved file's tree spec titled `<...> {<id>}`: its node ids. */
function specNodes(xml: string, id: string): number[] {
  for (const m of xml.matchAll(/<Spec\b([^>]*)>/g)) {
    const attrs = Object.fromEntries([...m[1].matchAll(/([\w-]+)="([^"]*)"/g)].map((a) => [a[1], a[2]]));
    if ((attrs.title ?? '').endsWith(`{${id}}`)) return attrs.nodes.split(',').map(Number);
  }
  throw new Error(`no tree spec titled {${id}}`);
}

engineDescribe("WU-128: Split Personality's start (amendment 13 §4, D-463; AC-P86)", () => {
  let f: SessionFixture;
  let spike: { record: CompileRecord; xml: string };
  let schema8: { record: CompileRecord; xml: string };
  let refused: string;
  let titan: CompileRecord;
  let starts: CompileCheckResult;

  async function runFolder(slug: string, plan: Json): Promise<{ abs: string; planPath: string }> {
    const made = await f.call('guide_run', { new_run: slug });
    if (made.isError) throw new Error(`guide_run failed: ${made.text}`);
    const abs = /^Created run folder (.+)$/m.exec(made.text)![1];
    const planPath = /^plan_path for this run: (\S+)$/m.exec(made.text)![1];
    fs.writeFileSync(path.join(f.guides, planPath), `${JSON.stringify(plan, null, 2)}\n`);
    return { abs, planPath };
  }

  async function compiled(slug: string, plan: Json): Promise<{ record: CompileRecord; xml: string }> {
    const { abs, planPath } = await runFolder(slug, plan);
    const out = await f.call('compile_plan', { plan_path: planPath, measure_only: true });
    expect({ slug, isError: out.isError, text: out.isError ? out.text : '' }).toEqual({ slug, isError: false, text: '' });
    return {
      record: read(path.join(abs, 'compile-record.json')) as unknown as CompileRecord,
      xml: fs.readFileSync(path.join(abs, 'compiled-build.xml'), 'utf8'),
    };
  }

  beforeAll(async () => {
    f = await startSessionFixture({ testActions: true });
    const sp = stageWith('sp', [...MERC_PATH, ...WAR_TREE], splitPersonality(WARRIOR_VARIANT));
    const sp2 = stageWith('sp2', [...MERC_PATH, ...WAR_TREE, ...SECOND_TREE], splitPersonality(WARRIOR_VARIANT));
    spike = await compiled('split-personality', mercPlan(9, [sp, sp2]));
    schema8 = await compiled('split-personality-8', mercPlan(8, [stageWith('sp', [...MERC_PATH, ...WAR_TREE], splitPersonality(WARRIOR_VARIANT))]));
    const without = await runFolder(
      'split-personality-refused',
      mercPlan(9, [
        stageWith('nojewel', [...MERC_PATH, ...WAR_TREE], null),
        stageWith('warside', WAR_PATH, splitPersonality(WARRIOR_VARIANT)),
      ]),
    );
    const out = await f.call('compile_plan', { plan_path: without.planPath, measure_only: true });
    refused = out.isError ? out.text : `compiled: ${out.text}`;
    const titanPlan = read(TWO_STAGE);
    Object.assign(titanPlan, { schemaVersion: 9, stages: [titanStage('own', splitPersonality(WARRIOR_VARIANT))], ledger: [] });
    titan = (await compiled('split-personality-titan', titanPlan)).record;
    // compile_check's trees for the stage with each variant, read through the engine session (it changes nothing).
    const plan = mercPlan(9, [sp]);
    const sorc = stageWith('sorc', [...MERC_PATH], splitPersonality(SORCERESS_VARIANT));
    const { value } = await f.session.run({ tool: 'test:split-personality', kind: 'read' }, (ctx) =>
      ctx.client.compileCheck({
        className: plan.roll.className,
        ascendancy: plan.roll.ascendancy,
        stages: [checkStageOf(sp as Stage), checkStageOf(sorc as Stage)],
      }),
    );
    starts = value;
  }, ENGINE_TIMEOUT);

  afterAll(async () => f?.close(), 60_000);

  it('the fixture: MERC_PATH reaches 54127 from the Mercenary start, WAR_PATH from the Warrior start\'s exit 38646, and the Warrior start\'s exits are 3936 and 38646', () => {
    expect(mainLinks(MERC_START)).toContain(MERC_PATH[0]);
    expect(mainLinks(WAR_START)).toEqual([3936, 38646]);
    for (const p of [MERC_PATH, WAR_PATH, WAR_TREE]) for (let i = 1; i < p.length; i++) expect(links.get(p[i - 1])!.has(p[i])).toBe(true);
    expect(nodeOf(SOCKET).isJewelSocket).toBe(true);
    expect(links.get(3936)!.has(38646)).toBe(false);
  });

  describe('the spike and the compile', () => {
    it('AC-P86 (spike): the jewel (Warrior) in a socket the Mercenary\'s tree reaches, and a tree from the Warrior start, compiles with no connection defect and no tree-shape finding; PoB keeps the Warrior-side nodes', () => {
      expect(codesOf(spike.record, 'sp', 'tree-shape')).toEqual([]);
      expect(sorted(specNodes(spike.xml, 'sp'))).toEqual(expect.arrayContaining(sorted([...MERC_PATH, ...WAR_TREE])));
      expect(specNodes(spike.xml, 'sp')).not.toContain(WAR_START);
    });

    it('§4: the start applies on any schema: the same stage compiles at schema 8', () => {
      expect(codesOf(schema8.record, 'sp', 'tree-shape')).toEqual([]);
      expect(sorted(specNodes(schema8.xml, 'sp'))).toEqual(expect.arrayContaining(sorted(WAR_TREE)));
    });

    it("AC-P86: the stage's starts hold the jewel's start, grantedBy the socket and grantedByName \"Split Personality\", and it opens", () => {
      expect(starts.defects).toEqual([]);
      const sp = starts.trees.find((t) => t.stage === 'sp')!;
      expect(sp.starts.find((s) => s.jewel === true)).toEqual({
        node: WAR_START,
        name: 'Warrior',
        exits: mainLinks(WAR_START),
        grantedBy: SOCKET,
        grantedByName: 'Split Personality',
        granted: true,
        jewel: true,
      });
      expect(sp.starts[0]).toMatchObject({ node: MERC_START, name: 'Mercenary' });
    });

    it('§14 (the variant): PoB reads the selected variant: Selected Variant 4 names the Sorceress start, not the Warrior\'s', () => {
      const sorc = starts.trees.find((t) => t.stage === 'sorc')!;
      expect(sorc.starts.filter((s) => s.jewel === true).map((s) => [s.node, s.name])).toEqual([[SORC_START, 'Sorceress']]);
    });
  });

  describe('refused trees (R-63)', () => {
    it('AC-P86: the same tree with the jewel removed is refused: the Warrior-side nodes reach no start', () => {
      expect(refused).toMatch(/Plan \S+ has \d+ defects; nothing was compiled:/);
      for (const n of WAR_TREE) expect(refused).toContain(`stage nojewel: node ${n} (Melee Damage) is not connected to its start through untagged nodes`);
    });

    it('AC-P86: a socket reached only through the Warrior start opens nothing: the stage is refused', () => {
      for (const n of WAR_PATH) expect(refused).toMatch(new RegExp(`stage warside: node ${n} \\([^)]+\\) is not connected to its start`));
    });
  });

  describe("V1's tree-shape", () => {
    it("AC-P86: two trees from the jewel's start give tree-shape (one-tree-per-start), naming the Warrior start and each tree", () => {
      const found = codesOf(spike.record, 'sp2', 'tree-shape');
      expect(found.map((x) => x.data)).toEqual([
        {
          stage: 'sp2',
          rule: 'one-tree-per-start',
          start: WAR_START,
          startName: 'Warrior',
          trees: expect.arrayContaining([
            { exits: [3936], nodes: sorted(WAR_TREE) },
            { exits: [38646], nodes: SECOND_TREE },
          ]),
        },
      ]);
      expect((found[0].data as Json).trees).toHaveLength(2);
    });

    it("AC-P86: a Warrior's own variant on a Warrior gives tree-shape (alternate-class-start), and the compile stands", () => {
      expect(codesOf(titan, 'own', 'tree-shape').map((x) => x.data)).toEqual([
        {
          stage: 'own',
          rule: 'alternate-class-start',
          start: WAR_START,
          startName: 'Warrior',
          grantedBy: TITAN_SOCKET,
          grantedByName: 'Split Personality',
          openedBy: null,
        },
      ]);
      expect(codesOf(titan, 'own', 'tree-shape')[0].message).toContain(
        `stage own: Split Personality in socket ${TITAN_SOCKET} names the Warrior start (${WAR_START}), which the class start already opens`,
      );
    });
  });
});
