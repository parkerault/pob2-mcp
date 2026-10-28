/**
 * WU-119 (amendment 12 §6, §7, §10, §15's B3, §22; AC-P82's engine rows and AC-P83): plan schema 8 and V1 through
 * `compile_plan`, in process and engine-required. The V1 rows over hand-made inputs are `tests/unit/v1Schema8.test.ts`,
 * the schema rows `tests/unit/planSchema8.test.ts`.
 *
 * - **A schema-7 plan compiles as before** (§22). `tests/fixtures/plans/schema7-ladder/plan.json` is the schema-6 ladder
 *   (`schema6-ladder`) at schema 7, its `b` respecing `m`'s Armour branch (6529, 32416) for a path of six attribute nodes
 *   to the jewel socket 26725, which holds a magic Ruby (`Data/Bases/jewel.lua`; `Data/ModJewel.lua`'s Clashing line), with
 *   Elemental Weakness at gem level 16; its `n` keeps `b`'s tree less the Area Damage branch (53443, 59767) with no respec,
 *   with Despair at 14 and the custom line "+1000 to maximum Energy Shield" whose reason has no coverage result. Each
 *   fixture's `record-before-schema8.json` is its compile record from the build before WU-119 (M-25's integration head,
 *   2ac662c), less the fields that change on every compile (`compiledAt`, `timing`, each stage's `elapsedMs`, the import
 *   code, the saved file's sha1 and path). A compile now keeps every one of those fields equal but `measures.arbiter` (the
 *   Pinnacle pass changes it, §22), and `two-stage-count` (schema 2) keeps its findings.
 * - **One tree per loadout** (§7): the ladder at schema 8 without the respec, a `tmpb1` copying `b` listed after it, and
 *   three custom lines on `n`; and the same trees at schema 7.
 * - **The curse cap** (§10): Elemental Weakness, Despair and Frost Bomb (`Data/Skills/act_int.lua`: the curse cap 72 at gem
 *   level 14, 76 at 16, 78 at 17, 0 from 18; Despair 47 at 9, 52 at 10; Frost Bomb's exposure 78 at 17) on campaign stages
 *   at `q.act-4-isle-of-kin-blind-beast` (C1's area level 51), on `m` (69) and on `b` (79), with an amulet carrying "+N to
 *   Level of all Spell Skills" (`Data/ModItem.lua`'s GlobalSpellGemsLevel lines), and on a card skeleton.
 * - **Radius jewels** (B3): From Nothing (`Data/Uniques/Special/Generated.lua`, Radius: Small, "Passives in radius of
 *   Resolute Technique can be Allocated without being connected to your tree") and Controlled Metamorphosis
 *   (`Data/Uniques/jewel.lua`, Medium Ring) in the socket 26725 above, and the node 17138 (Melee Damage), which lies in
 *   both radii and isn't linked to the stage's tree.
 */
import fs from 'fs';
import path from 'path';
import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import { engineDescribe } from '../helpers/engine';
import { startSessionFixture, type SessionFixture } from '../helpers/engineSession';
import type { CompileRecord, Finding } from '../../src/plan/record';

const REPO = path.resolve(__dirname, '..', '..');
const PLANS = path.join(REPO, 'tests', 'fixtures', 'plans');
const LADDER7 = path.join(PLANS, 'schema7-ladder');
const COUNT = path.join(PLANS, 'two-stage-count');
const TWO_STAGE = path.join(PLANS, 'two-stage', 'plan.json');
const ENGINE_TIMEOUT = 600_000;

type Json = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
const judgment = (ref: string) => ({ kind: 'judgment', ref, confidence: 'L' });
const gem = (name: string, level: number) => ({ name, level, quality: 0, enabled: true });
const read = (file: string): Json => JSON.parse(fs.readFileSync(file, 'utf8')) as Json;

/** The path from the two-stage tree's Brutal (5710) to the jewel socket 26725: six attribute nodes. */
const SOCKET_PATH = [38323, 22928, 27373, 16725, 54811, 57703];
const SOCKET = 26725;
/** Melee Damage: in Resolute Technique's small radius and in 26725's Medium Ring, linked to neither tree. */
const RADIUS_NODE = 17138;
const FROM_NOTHING =
  'Rarity: Unique\nFrom Nothing\nDiamond\nRadius: Small\nPassives in radius of Resolute Technique can be Allocated without being connected to your tree\nCorrupted';
const METAMORPHOSIS =
  'Rarity: Unique\nControlled Metamorphosis\nDiamond\nRadius: Variable\nOnly affects Passives in Medium Ring\nPassives in Radius can be Allocated without being connected to your tree\n-10% to all Elemental Resistances';
const CAMPAIGN_KEY = 'q.act-4-isle-of-kin-blind-beast';
const ES = '+1000 to maximum Energy Shield';

/** Every leaf path of `want` whose value `got` doesn't hold equally (a missing key included). */
function differences(want: unknown, got: unknown, at = '$', out: string[] = []): string[] {
  if (Array.isArray(want)) {
    if (!Array.isArray(got) || got.length !== want.length) out.push(`${at}: an array of ${want.length}, got ${JSON.stringify(got)?.slice(0, 80)}`);
    else want.forEach((w, i) => differences(w, got[i], `${at}[${i}]`, out));
  } else if (want !== null && typeof want === 'object') {
    if (got === null || typeof got !== 'object' || Array.isArray(got)) out.push(`${at}: an object, got ${JSON.stringify(got)?.slice(0, 80)}`);
    else for (const [k, v] of Object.entries(want)) differences(v, (got as Json)[k], `${at}.${k}`, out);
  } else if (want !== got) {
    out.push(`${at}: ${JSON.stringify(want)}, got ${JSON.stringify(got)}`);
  }
  return out;
}

/** A stage of the two-stage fixture's stage-2 content: a rung, a campaign stage at `CAMPAIGN_KEY` or a card skeleton. */
function stageFrom(id: string, kind: 'entering-maps' | 'budget' | 'campaign' | 'skeleton', edit: (s: Json) => void = () => undefined): Json {
  const s = read(TWO_STAGE).stages[1];
  const level = kind === 'campaign' ? 45 : kind === 'entering-maps' ? 70 : 80;
  Object.assign(s, { id, loadoutName: `Stage ${id} (L${level}) {${id}}`, level, claims: [] });
  if (kind === 'campaign') s.progress = CAMPAIGN_KEY;
  else {
    s.progress = 'endgame';
    if (kind !== 'skeleton') Object.assign(s, { variant: kind, ascendancyPoints: 0, variantBasis: { level: judgment('t'), gemLevels: judgment('t'), ascendancyPoints: judgment('t') } });
  }
  edit(s);
  return s;
}

/** A group per gem, after the stage's two. */
const withGems = (...gems: [string, number][]) => (s: Json) => {
  for (const [name, level] of gems) s.skills.groups.push({ label: name, enabled: true, role: 'utility', gems: [gem(name, level)] });
};
const amulet = (levels: number) => (s: Json) =>
  s.items.slots.push({ slot: 'Amulet', text: `Rarity: Rare\nGlyph Pendant\nCrimson Amulet\n+${levels} to Level of all Spell Skills` });

/** A plan of `stages` on the two-stage fixture's roll and versions, at `version`. */
function planOf(version: number, stages: Json[]): Json {
  const p = read(TWO_STAGE);
  Object.assign(p, { schemaVersion: version, stages, ledger: [] });
  return p;
}

/** The ladder at `version` without `b`'s respec, `tmpb1` (a copy of `b`) after `b`, and three custom lines on `n`. */
function treesPlan(version: number): Json {
  const p = read(path.join(LADDER7, 'plan.json'));
  p.schemaVersion = version;
  const at = p.stages.findIndex((s: Json) => s.id === 'b');
  delete p.stages[at].respec;
  const tmp = JSON.parse(JSON.stringify(p.stages[at]));
  Object.assign(tmp, { id: 'tmpb1', loadoutName: 'Budget (L80) {tmpb1}' });
  p.stages.splice(at + 1, 0, tmp);
  p.stages.find((s: Json) => s.id === 'n').config.customMods = [
    { text: ES, reason: 'test fixture: a hand-calculated pool line with no coverage result' },
    { text: ES, reason: 'test fixture: Sorcery Ward, coverage: unparsed' },
    { text: '10% more Damage', reason: 'test fixture: a hand-calculated damage line' },
  ];
  return p;
}

/** The curse-cap plan (schema 8). */
function cursesPlan(): Json {
  return planOf(8, [
    stageFrom('c9', 'campaign', withGems(['Despair', 9])),
    stageFrom('c10', 'campaign', withGems(['Despair', 10])),
    stageFrom('m', 'entering-maps', withGems(['Elemental Weakness', 16], ['Despair', 14])),
    stageFrom('b', 'budget', withGems(['Elemental Weakness', 16], ['Despair', 14], ['Frost Bomb', 17])),
    stageFrom('b18', 'budget', withGems(['Elemental Weakness', 18])),
    stageFrom('bGear', 'budget', (s) => {
      withGems(['Elemental Weakness', 16])(s);
      amulet(2)(s);
    }),
    stageFrom('bGearOne', 'budget', (s) => {
      withGems(['Elemental Weakness', 15])(s);
      amulet(1)(s);
    }),
    stageFrom('k', 'skeleton', withGems(['Despair', 1])),
  ]);
}

/** A campaign stage with the path to 26725, `jewel` in it (or none) and the radius node. */
function radiusStage(id: string, jewel: string | null): Json {
  return stageFrom(id, 'campaign', (s) => {
    s.tree.nodes.push(...SOCKET_PATH, SOCKET, RADIUS_NODE);
    for (const n of SOCKET_PATH) s.tree.attributeChoices.push({ node: n, attribute: 'strength' });
    s.items.treeJewels = jewel === null ? [] : [{ node: SOCKET, text: jewel }];
  });
}

/** The saved file's tree spec titled `<...> {<id>}`: its node ids. */
function specNodes(xml: string, id: string): number[] {
  for (const m of xml.matchAll(/<Spec\b([^>]*)>/g)) {
    const attrs = Object.fromEntries([...m[1].matchAll(/([\w-]+)="([^"]*)"/g)].map((a) => [a[1], a[2]]));
    if ((attrs.title ?? '').endsWith(`{${id}}`)) return attrs.nodes.split(',').map(Number);
  }
  throw new Error(`no tree spec titled {${id}}`);
}

const codesOf = (record: CompileRecord, id: string, code: string): Finding[] => record.stages[id].v1!.findings.filter((f) => f.code === code);

engineDescribe('WU-119: plan schema 8 and V1 through compile_plan (amendment 12 §6, §7, §10, §15 B3, §22)', () => {
  let f: SessionFixture;
  let ladder7: CompileRecord;
  let count: CompileRecord;
  let trees8: CompileRecord;
  let trees7: CompileRecord;
  let curses: CompileRecord;
  let radius: { record: CompileRecord; xml: string };
  let validated: string;
  let unlinked: string;

  /** A run folder holding `plan`: a plan object, or a fixture file's text as it is (its sha1 is in the record). */
  async function runFolder(slug: string, plan: Json | string): Promise<{ abs: string; planPath: string }> {
    const made = await f.call('guide_run', { new_run: slug });
    if (made.isError) throw new Error(`guide_run failed: ${made.text}`);
    const abs = /^Created run folder (.+)$/m.exec(made.text)![1];
    const planPath = /^plan_path for this run: (\S+)$/m.exec(made.text)![1];
    fs.writeFileSync(path.join(f.guides, planPath), typeof plan === 'string' ? plan : `${JSON.stringify(plan, null, 2)}\n`);
    return { abs, planPath };
  }

  async function compiled(slug: string, plan: Json | string): Promise<{ record: CompileRecord; xml: string }> {
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
    ladder7 = (await compiled('schema7-ladder', fs.readFileSync(path.join(LADDER7, 'plan.json'), 'utf8'))).record;
    count = (await compiled('two-stage-count', fs.readFileSync(path.join(COUNT, 'plan.json'), 'utf8'))).record;
    trees8 = (await compiled('trees-8', treesPlan(8))).record;
    trees7 = (await compiled('trees-7', treesPlan(7))).record;
    curses = (await compiled('curses', cursesPlan())).record;
    const radiusPlan = planOf(8, [radiusStage('fn', FROM_NOTHING), radiusStage('cm', METAMORPHOSIS)]);
    const check = await runFolder('radius-check', radiusPlan);
    validated = (await f.call('guide_run', { validate: check.planPath })).text;
    radius = await compiled('radius', radiusPlan);
    const without = await runFolder('radius-without', planOf(8, [radiusStage('fn', null)]));
    const refused = await f.call('compile_plan', { plan_path: without.planPath, measure_only: true });
    unlinked = refused.isError ? refused.text : `compiled: ${refused.text}`;
  }, ENGINE_TIMEOUT);

  afterAll(async () => f?.close(), 60_000);

  describe('§22: a schema-7 or older plan compiles as before', () => {
    it("AC-P82: a schema-7 plan's record keeps every field but measures.arbiter equal to record-before-schema8.json", () => {
      const before = read(path.join(LADDER7, 'record-before-schema8.json'));
      for (const s of Object.values(before.stages) as Json[]) delete s.measures?.arbiter;
      expect(differences(before, ladder7)).toEqual([]);
      // Its respec and tree-continuity are schema 7's: n drops b's Area Damage branch with no respec.
      expect(codesOf(ladder7, 'n', 'tree-continuity').map((x) => x.data)).toEqual([{ predecessor: 'b', dropped: [53443, 59767] }]);
      expect(codesOf(ladder7, 'b', 'tree-continuity')).toEqual([]);
    });

    it('AC-P82: neither new code runs on a schema-7 plan, and it has no treeChange', () => {
      for (const id of Object.keys(ladder7.stages)) {
        const found = ladder7.stages[id].v1!.findings.map((x) => x.code).filter((c) => c === 'curse-level-cap' || c === 'custom-defence');
        expect({ id, found, treeChange: ladder7.stages[id].treeChange }).toEqual({ id, found: [], treeChange: undefined });
      }
    });

    it("AC-P82: neither new code runs on an older plan: two-stage-count's findings are unchanged", () => {
      const before = read(path.join(COUNT, 'record-before-schema8.json'));
      for (const id of Object.keys(before.stages)) {
        expect({ id, v1: count.stages[id].v1, v2: count.stages[id].v2 }).toEqual({ id, v1: before.stages[id].v1, v2: before.stages[id].v2 });
      }
      expect(differences(before, count)).toEqual([]);
      // Its custom line adds life, with no coverage result: custom-defence would find it on a schema-8 plan.
      expect(count.stages['2'].customModsWritten).toEqual(['+100 to maximum Life']);
    });
  });

  describe('§7 (D-452): one tree per loadout', () => {
    it('AC-P82: a schema-8 plan whose b drops nodes of m has no tree-continuity finding; the same trees at schema 7 have one', () => {
      const continuity = (record: CompileRecord) =>
        Object.fromEntries(Object.keys(record.stages).map((id) => [id, codesOf(record, id, 'tree-continuity').map((x) => x.data)]));
      expect(continuity(trees8)).toEqual({ 1: [], 2: [], m: [], b: [], tmpb1: [], n: [] });
      expect(continuity(trees7)).toEqual({
        1: [],
        2: [],
        m: [],
        b: [{ predecessor: 'm', dropped: [6529, 32416] }],
        tmpb1: [],
        n: [{ predecessor: 'b', dropped: [53443, 59767] }],
      });
    });

    it("AC-P82: b.treeChange counts the nodes m holds that b doesn't, and the reverse; a tmp stage (tmpb1) copying b is not n's predecessor", () => {
      const plan = treesPlan(8);
      const nodes = (id: string) => new Set<number>(plan.stages.find((s: Json) => s.id === id).tree.nodes);
      const [m, b, n] = [nodes('m'), nodes('b'), nodes('n')];
      const refunded = [...m].filter((x) => !b.has(x)).length;
      const added = [...b].filter((x) => !m.has(x)).length;
      expect([refunded, added]).toEqual([2, 7]);
      expect(trees8.stages.b.treeChange).toEqual({ from: 'm', refunded, added });
      expect(trees8.stages.n.treeChange).toEqual({ from: 'b', refunded: [...b].filter((x) => !n.has(x)).length, added: 0 });
      expect(trees8.stages.tmpb1.treeChange).toEqual({ from: 'b', refunded: 0, added: 0 });
      expect(trees8.stages.m.treeChange).toEqual({ from: '2', refunded: 0, added: 0 });
      expect(trees8.stages['1'].treeChange).toBeUndefined();
      // The same trees at schema 7 carry no treeChange.
      expect(Object.values(trees7.stages).map((s) => s.treeChange)).toEqual(Object.keys(trees7.stages).map(() => undefined));
    });
  });

  describe('§6 (D-451): custom-defence', () => {
    it('AC-P82: "+1000 to maximum Energy Shield" whose reason has no coverage: result is custom-defence; with coverage: unparsed it isn\'t; a damage line never is', () => {
      expect(codesOf(trees8, 'n', 'custom-defence').map((x) => x.data)).toEqual([
        { path: 'config.customMods[0].reason', text: ES, stats: ['EnergyShield'] },
      ]);
      expect(trees8.stages.n.customModsWritten).toEqual([ES, ES, '10% more Damage']);
      // At schema 7 the same lines aren't checked.
      expect(codesOf(trees7, 'n', 'custom-defence')).toEqual([]);
    });
  });

  describe('§10 (D-455): curse-level-cap', () => {
    const caps = (id: string) => codesOf(curses, id, 'curse-level-cap').map((x) => x.data);

    it('AC-P82: Elemental Weakness at gem level 16 on b (area 79) is curse-level-cap naming cap 76; Despair at 14 on b is; Frost Bomb at 17 is, naming the exposure', () => {
      expect(caps('b')).toEqual([
        { gem: 'Elemental Weakness', group: 3, index: 1, level: 16, socketedLevel: 16, of: 'curse', cap: 76, areaLevel: 79, path: 'skills.groups[2].gems[0].level' },
        { gem: 'Despair', group: 4, index: 1, level: 14, socketedLevel: 14, of: 'curse', cap: 72, areaLevel: 79, path: 'skills.groups[3].gems[0].level' },
        { gem: 'Frost Bomb', group: 5, index: 1, level: 17, socketedLevel: 17, of: 'exposure', cap: 78, areaLevel: 79, path: 'skills.groups[4].gems[0].level' },
      ]);
      const messages = codesOf(curses, 'b', 'curse-level-cap').map((x) => x.message);
      expect(messages[0]).toMatch(/^Elemental Weakness \(skill group 3 gem 1\) at gem level 16 doesn't apply its curse to monsters above level 76, under the area level 79 of the budget rung/);
      expect(messages[2]).toContain("Frost Bomb (skill group 5 gem 1) at gem level 17 doesn't apply its exposure to monsters above level 78");
    });

    it('AC-P82: at level 18 it isn\'t, nor at 16 with +2 levels from gear; at 15 with +1 it is, read at 16', () => {
      expect([caps('b18'), caps('bGear')]).toEqual([[], []]);
      expect(caps('bGearOne')).toEqual([expect.objectContaining({ gem: 'Elemental Weakness', level: 16, socketedLevel: 15, cap: 76 })]);
    });

    it('AC-P82: at level 16 on m (area 69) Elemental Weakness isn\'t, nor Despair at 14', () => {
      expect(caps('m')).toEqual([]);
    });

    it('AC-P82: a campaign stage is checked against its area-level (C1: 51); a card skeleton is skipped', () => {
      expect([caps('c9'), caps('c10')]).toEqual([[expect.objectContaining({ gem: 'Despair', level: 9, cap: 47, areaLevel: 51 })], []]);
      expect(caps('k')).toEqual([]);
    });

    it('neither code runs on the schema-7 ladder, though its b holds Elemental Weakness at 16', () => {
      expect(codesOf(ladder7, 'b', 'curse-level-cap')).toEqual([]);
      expect(codesOf(trees8, 'b', 'curse-level-cap').map((x) => x.data)).toEqual([expect.objectContaining({ gem: 'Elemental Weakness', cap: 76, areaLevel: 79 })]);
    });
  });

  describe('§15 B3: radius jewels', () => {
    it('AC-P83: a stage with From Nothing socketed and a node inside its radius, unlinked to the tree, passes compile_check and compiles with no connection defect and no tree-shape finding', () => {
      expect(validated).toMatch(/^Plan \S+ is valid: 2 stages \(fn, cm\)\./);
      for (const id of ['fn', 'cm']) {
        expect({ id, nodes: specNodes(radius.xml, id).includes(RADIUS_NODE) }).toEqual({ id, nodes: true });
        expect({ id, shape: codesOf(radius.record, id, 'tree-shape') }).toEqual({ id, shape: [] });
      }
    });

    it('AC-P83: the same node without the jewel is refused as before', () => {
      expect(unlinked).toContain(`stage fn: node ${RADIUS_NODE} (Melee Damage) is not connected to its start through untagged nodes`);
    });
  });
});
