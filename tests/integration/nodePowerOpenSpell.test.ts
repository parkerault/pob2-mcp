/**
 * WU-136 (amendment 14 §16, D-490; C-55): node power's `exclude`, the attribute repair and its illegal form, the
 * attribute choice, the 0.5 tolerance on targets and rounded reasons, on the open-spell run's r1-s-4 plan, in process and
 * engine-required. AC-K81's bullets (but the Titan Rake gains, which `nodePowerTitanRake.test.ts` and
 * `nodePowerTitanRakeS1.test.ts` assert without `exclude`) and AC-K82's fixture and sample rows.
 *
 * The fixtures are `tests/fixtures/plans/open-spell/r1-s-4/plan.json` and `.../r1-s-2/plan.json`, the open-spell live
 * run's plans (the user's grant, HG-33 at approval: copied unchanged from the run folder's `builds/<id>/plan.json`).
 * r1-s-4 ("Threaded Hex Coiling Bolts Lich", a Witch) is the attribute-tight one: its `n` stands at Dexterity 92 against
 * 91 and Intelligence 148 against 147, and every rebuild of it in the live test came back illegal on attributes. It is
 * compiled measure-only (its rung `n`) in a run folder `guide_run {new_run}` made, and `n` loaded. Every expected value
 * comes from PoB itself (the compile record of the plan with a move applied, compiled again; PoB's own import of a tree
 * for the paths), never from the tool's own figures; each tool call's reply is the bridge's own (a spy on
 * `PoBLuaApiClient.prototype.nodePower`).
 *
 * - AC-K81 (1) `exclude`: the rebuild, the swap search and a `free` refill each return no tree holding an excluded node;
 *   the rebuild's own result's cut node (a small node on the only path to another node it added, found by PoB's import)
 *   excluded, the rebuild takes another path to that node, or none; `exclude` naming an allocated node refuses the call,
 *   naming it.
 * - AC-K81 (2) the attribute repair: the rebuild D1-tree runs on `n` (reach 12, the needs kept, `targets` its
 *   `tree.start`, `pace_exchange: 3`) returns a result with Str ≥ ReqStr, Dex ≥ ReqDex and Int ≥ ReqInt (the reply's and,
 *   compiled, PoB's own with no V1 `attributes` finding), timed within the 120 s long action; with only the build's two
 *   core needs kept, the repair's steps run and the line names them in Appendix A's form, and PoB agrees on compile. A
 *   shortfall the repair can't close (`free: [62677]`, a Dexterity node, with every node that gives Dexterity excluded) reads
 *   `Dexterity would be <x>, under the <y> its gear and gems need, after repair`, the figures PoB's own.
 * - AC-K81 (3) the attribute choice: `free: [62677]` leaves the tree short of Dexterity; the repair's added attribute node
 *   takes Dexterity, and an added attribute node with no shortfall takes the class's main attribute (Intelligence).
 * - AC-K81 (4) the tolerance: a figure 0.4 under its target meets it (no repair runs); 0.6 under doesn't (the repair runs).
 * - AC-K81 (5) every figure in the replies' reasons has at most 2 decimals.
 * - AC-K82: the two open-spell plans' sha1s equal the run folder's (recorded at the copy, 2026-11-02); no machine path is
 *   in either; `tool-calls.json` holds a `get_node_power` sample with `exclude`, and a refused one naming an allocated node.
 *
 * The spike's figures (the rebuild's time, its attributes and the repair's steps) are printed (`[WU-136 …]`) for the
 * work-log.
 */
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { performance } from 'perf_hooks';
import { afterAll, beforeAll, describe, expect, it, jest } from '@jest/globals';
import { engineDescribe } from '../helpers/engine';
import { startSessionFixture, type SessionFixture } from '../helpers/engineSession';
import { PoBLuaApiClient } from '../../src/pobLuaBridge';
import { nodePowerParams } from '../../src/handlers/treeHandlers';
import { getBuildGoalsToolSchemas } from '../../src/server/toolSchemas';
import type { NodePowerParams, NodePowerResult, PowerSwap } from '../../src/engine/schemas';

const REPO = path.resolve(__dirname, '..', '..');
const FIXTURES = path.join(REPO, 'tests', 'fixtures');
const OPEN_SPELL = path.join(FIXTURES, 'plans', 'open-spell');
const PLAN = path.join(OPEN_SPELL, 'r1-s-4', 'plan.json');
const ENGINE_TIMEOUT = 900_000;
/** The long action's limit (D-47, D-417): node power's request times out past it. */
const LONG_ACTION_SECONDS = 120;

/** The sha1s of the run folder's `builds/<id>/plan.json`, taken at the copy (HG-33's grant; the work-log records them). */
const RUN_FOLDER_SHA1 = {
  'r1-s-2': '36c626c3b893738a69c7f59549ce59232b476a79',
  'r1-s-4': 'b299771029f529dc3a312e39bdabc34eb3077799',
};

/** r1-s-4's `n`: Mind Over Matter, which the build leaves out for mana (§16's example), and the core needs. */
const MIND_OVER_MATTER = 45918;
const CORE_NEEDS = [42245, 50485];
/** A Dexterity attribute node of `n` (its plan's attributeChoices) whose branch freed leaves Dexterity short. */
const DEX_NODE = 62677;
/** A Strength attribute node of `n` with no dependants (the live run's own swap freed it). */
const STR_LEAF = 61403;

type Json = Record<string, any>;
const ATTRS = ['Str', 'Dex', 'Int'] as const;

const readPlan = (): Json => JSON.parse(fs.readFileSync(PLAN, 'utf8')) as Json;
const stageOf = (plan: Json, id: string): Json => plan.stages.find((s: Json) => s.id === id);

/** A stage's tree with a main-tree move applied: its removed nodes out (of the tree and the needs), its added nodes in. */
function applyMove(stage: Json, s: PowerSwap): void {
  const gone = new Set((s.removed ?? []).map((n) => n.id));
  const added = (s.added ?? []).map((n) => n.id);
  const tree = stage.tree;
  tree.nodes = [...tree.nodes.filter((id: number) => !gone.has(id)), ...added.filter((id) => !tree.nodes.includes(id))];
  const choices = new Map<number, string>();
  for (const n of s.added ?? []) if (n.attributeChoice) choices.set(n.id, n.attributeChoice);
  tree.attributeChoices = [
    ...tree.attributeChoices.filter((c: Json) => !gone.has(c.node) && !choices.has(c.node)),
    ...[...choices].map(([node, attribute]) => ({ node, attribute })),
  ];
  tree.needs = tree.needs
    .map((n: Json) => ({ ...n, nodes: n.nodes.filter((id: number) => !gone.has(id)) }))
    .filter((n: Json) => n.nodes.length > 0);
}

/** The node ids a move's tree holds: the loadout's tree less what it removes, with what it adds. */
const treeAfter = (before: number[], s: PowerSwap): Set<number> => {
  const out = new Set(before);
  for (const n of s.removed ?? []) out.delete(n.id);
  for (const n of s.added ?? []) out.add(n.id);
  return out;
};

/** A line of the tool's text by its head. */
const lineOf = (text: string, head: RegExp): string => {
  const line = text.split('\n').find((l) => head.test(l));
  expect({ head: String(head), found: line !== undefined }).toEqual({ head: String(head), found: true });
  return line!;
};

/** Every number in a reason (a sign, digits, a decimal part): none may have more than 2 decimals (D-490). */
const longFigures = (reason: string): string[] => (reason.match(/\d+\.\d+/g) ?? []).filter((x) => x.split('.')[1].length > 2);

describe('AC-K82: the open-spell fixtures and the get_node_power samples (HG-33)', () => {
  it("tests/fixtures/plans/open-spell/ holds the two plans, each byte-equal to the run folder's (its sha1)", () => {
    expect(fs.readdirSync(OPEN_SPELL).sort()).toEqual(['r1-s-2', 'r1-s-4']);
    for (const [id, sha1] of Object.entries(RUN_FOLDER_SHA1)) {
      const file = path.join(OPEN_SPELL, id, 'plan.json');
      expect(fs.readdirSync(path.dirname(file))).toEqual(['plan.json']);
      expect({ id, sha1: crypto.createHash('sha1').update(fs.readFileSync(file)).digest('hex') }).toEqual({ id, sha1 });
    }
  });

  it('no machine path is in either plan, and both are schema 9 plans of the run', () => {
    for (const id of Object.keys(RUN_FOLDER_SHA1)) {
      const text = fs.readFileSync(path.join(OPEN_SPELL, id, 'plan.json'), 'utf8');
      expect({ id, paths: text.match(/\/mnt\/|\/home\/|[A-Za-z]:[\\/]|Users[\\/]/g) }).toEqual({ id, paths: null });
      expect((JSON.parse(text) as Json).schemaVersion).toBe(9);
    }
  });

  it('tool-calls.json holds a get_node_power sample with exclude, and a refused one naming an allocated node', () => {
    const samples = JSON.parse(fs.readFileSync(path.join(FIXTURES, 'tool-calls.json'), 'utf8')) as Array<{ tool: string; args: Json; expect: string; reason?: string }>;
    const ours = samples.filter((s) => s.tool === 'get_node_power' && Array.isArray(s.args.exclude));
    expect(ours.some((s) => s.expect === 'ok' && s.args.exclude.length > 0)).toBe(true);
    expect(ours.some((s) => s.expect === 'error' && /allocated/.test(s.reason ?? ''))).toBe(true);
  });
});

describe("D-490: get_node_power's exclude, checked before the engine", () => {
  it('passes exclude through, and refuses one that is not a list of node ids', () => {
    expect(nodePowerParams({ stats: ['MainDamage'], exclude: [45918, 1] })).toEqual({ stats: ['MainDamage'], exclude: [45918, 1] } satisfies NodePowerParams);
    expect(nodePowerParams({ stats: ['MainDamage'], exclude: [] })).toEqual({ stats: ['MainDamage'] });
    expect(() => nodePowerParams({ exclude: 45918 })).toThrow(/^exclude must list node ids/);
    expect(() => nodePowerParams({ exclude: ['45918'] })).toThrow(/^exclude must list node ids/);
  });

  it('the tool schema has exclude, describes the attribute repair, and its description stays within 2,048 characters', () => {
    type Tool = { name: string; description: string; inputSchema: { properties: Record<string, Json> } };
    const tool = (getBuildGoalsToolSchemas() as Tool[]).find((t) => t.name === 'get_node_power')!;
    expect(tool.inputSchema.properties.exclude).toEqual(expect.objectContaining({ type: 'array', items: { type: 'integer' } }));
    expect(tool.inputSchema.properties.exclude.description).toContain('"Excluded node <id> (<name>) is allocated"');
    expect(tool.description).toContain('; attributes repaired: re-pointed <n> to <attribute>, added <m> (<names>)');
    expect(tool.description).not.toContain("PoB's default choice");
    expect(tool.inputSchema.properties.targets.description).toContain('a figure within 0.5 of its target meets it');
    expect(tool.description.length).toBeLessThanOrEqual(2048);
  });
});

engineDescribe('WU-136: node power on the open-spell r1-s-4 plan: exclude, the attribute repair and choice, the tolerance (D-490; AC-K81)', () => {
  let f: SessionFixture;
  let rec: Json;
  let n: Json;
  let targets: { ehp: number; maxHit: number };
  /** Every reason the suite's replies gave, for AC-K81 (5). */
  const reasons: string[] = [];

  /** A measure-only compile of `plan` (its `stages`) in a run of its own: the record. */
  async function compile(slug: string, plan: Json, stages: string[]): Promise<Json> {
    const made = await f.call('guide_run', { new_run: slug });
    if (made.isError) throw new Error(`guide_run failed: ${made.text}`);
    const abs = /^Created run folder (.+)$/m.exec(made.text)![1];
    const planPath = /^plan_path for this run: (\S+)$/m.exec(made.text)![1];
    fs.writeFileSync(path.join(f.guides, planPath), `${JSON.stringify(plan, null, 2)}\n`);
    const out = await f.call('compile_plan', { plan_path: planPath, measure_only: true, stages });
    expect({ isError: out.isError, text: out.isError ? out.text : '' }).toEqual({ isError: false, text: '' });
    return JSON.parse(fs.readFileSync(path.join(abs, 'compile-record.json'), 'utf8')) as Json;
  }

  /**
   * Whether the engine holds the fixture's own `n`: a compile of a plan with a move applied loads that plan instead, so the
   * next node power call or Lua query compiles the fixture again first.
   */
  let holdsFixture = false;
  let reloads = 0;
  async function ensureFixture(): Promise<void> {
    if (holdsFixture) return;
    reloads += 1;
    await compile(`os-s4-again-${reloads}`, readPlan(), ['n']);
    holdsFixture = true;
  }

  /** One get_node_power call on `n` through the tool: its text, the bridge's reply behind it and its wall time. */
  async function nodePower(args: Record<string, unknown>): Promise<{ text: string; reply: NodePowerResult; seconds: number }> {
    await ensureFixture();
    const spy = jest.spyOn(PoBLuaApiClient.prototype, 'nodePower');
    try {
      const t0 = performance.now();
      const out = await f.call('get_node_power', { loadout: n.loadoutName, clear_group: 1, ...args });
      const seconds = (performance.now() - t0) / 1000;
      expect({ isError: out.isError, text: out.isError ? out.text : '' }).toEqual({ isError: false, text: '' });
      expect(spy).toHaveBeenCalledTimes(1);
      const reply = await (spy.mock.results[0].value as Promise<NodePowerResult>);
      for (const s of [...reply.swaps, ...(reply.poolSwaps ?? []).flatMap((p) => p.swaps)]) if (s.reason) reasons.push(s.reason);
      return { text: out.text, reply, seconds };
    } finally {
      spy.mockRestore();
    }
  }

  async function lua<T>(code: string): Promise<T> {
    await ensureFixture();
    const { value } = await f.session.run({ tool: 'test:node-power-open-spell', kind: 'read' }, async (ctx) => {
      const reply = await ctx.client.request('__test_eval', { code });
      return reply.result as T;
    });
    return value;
  }

  /** PoB's own attributes and V1's `attributes` findings for `n` with `s` applied, compiled measure-only. */
  async function compiledWith(slug: string, s: PowerSwap): Promise<{ attrs: Record<string, number>; findings: string[] }> {
    const plan = readPlan();
    applyMove(stageOf(plan, 'n'), s);
    holdsFixture = false;
    const r = await compile(slug, plan, ['n']);
    const o = r.stages.n.outputs;
    const attrs: Record<string, number> = {};
    for (const a of ATTRS) {
      attrs[a] = o[a];
      attrs[`Req${a}`] = o[`Req${a}`] ?? 0;
    }
    const findings = (r.stages.n.v1?.findings ?? []).filter((x: Json) => x.code === 'attributes').map((x: Json) => x.message as string);
    return { attrs, findings };
  }

  const meetsAll = (a: Record<string, number | null | undefined>) =>
    Object.fromEntries(ATTRS.map((k) => [k, (a[k] ?? 0) >= (a[`Req${k}`] ?? 0)]));
  const ALL_MET = { Str: true, Dex: true, Int: true };

  /** The D1-tree arguments on `n` (D1-tree.md "The arguments", rebuild first: reach 12, compact). */
  const d1Tree = (extra: Record<string, unknown> = {}) => ({
    rebuild: true, max_distance: 12, targets, pace_exchange: 3, keep: (n.tree.needs as Json[]).flatMap((x) => x.nodes as number[]),
    stats: ['MainDamage', 'TotalEHP'], limit: 0, ...extra,
  });

  /** D1-tree's rebuild on `n`, called once and shared (its reply doesn't change between calls). */
  let d1Rebuild: Promise<{ text: string; reply: NodePowerResult; seconds: number }> | undefined;
  const d1RebuildOnce = () => (d1Rebuild ??= nodePower(d1Tree()));

  beforeAll(async () => {
    f = await startSessionFixture({ testActions: true });
    rec = await compile('os-s4', readPlan(), ['n']);
    holdsFixture = true;
    n = stageOf(readPlan(), 'n');
    // D1-tree's targets: the rung's tree.start (its ehp and lowestMaxHit.value).
    targets = { ehp: n.tree.start.ehp, maxHit: n.tree.start.lowestMaxHit.value };
  }, ENGINE_TIMEOUT);

  afterAll(async () => f?.close(), 60_000);

  it('the fixture: r1-s-4\'s n meets its requirements by a hair (PoB\'s compile: Dex and Int within 1 of their need)', () => {
    const o = rec.stages.n.outputs;
    expect(meetsAll(o)).toEqual(ALL_MET);
    expect(o.Dex - o.ReqDex).toBeLessThanOrEqual(1);
    expect(o.Int - o.ReqInt).toBeLessThanOrEqual(1);
  });

  describe('AC-K81 (2), (3): the attribute repair and the attribute choice', () => {
    let rebuild: { text: string; reply: NodePowerResult; seconds: number };

    it(
      "the spike: D1-tree's rebuild on n under targets returns a result meeting Str, Dex and Int, within 120 s; its added attribute nodes take Intelligence, the Witch's main attribute",
      async () => {
        rebuild = await d1RebuildOnce();
        const r = rebuild.reply;
        const s = r.swaps[0];
        expect(r.mode).toBe('rebuild');
        expect(r.mainAttribute).toBe('intelligence');
        expect(s.verdict).not.toBe('illegal');
        expect(s.reason ?? '').not.toMatch(/would be \d+, under the \d+ its gear and gems need/);
        expect(meetsAll(s.attributes!)).toEqual(ALL_MET);
        expect(rebuild.seconds).toBeLessThan(LONG_ACTION_SECONDS);
        // An attribute node the move adds, with no shortfall left, takes the class's main attribute.
        const attributeNodes = (s.added ?? []).filter((x) => x.attribute);
        expect(attributeNodes.length).toBeGreaterThan(0);
        if (!s.attributeRepair) for (const x of attributeNodes) expect({ id: x.id, choice: x.attributeChoice }).toEqual({ id: x.id, choice: 'intelligence' });
        console.error(
          `[WU-136 spike r1-s-4 n] rebuild under targets (EHP ${targets.ehp}, max hit ${targets.maxHit}): ${s.verdict}${s.reason ? ` (${s.reason})` : ''} in ` +
            `${rebuild.seconds.toFixed(1)} s (${r.cpuSeconds.toFixed(1)} s CPU, ${r.calculations} calculations); attributes ${JSON.stringify(s.attributes)}; ` +
            `Main damage ${(s.gainPercent?.[0] as number).toFixed(2)}%, EHP ${s.ehp}, max hit ${s.maxHit}; added attribute nodes ` +
            `${JSON.stringify(attributeNodes.map((x) => [x.id, x.attributeChoice]))}; attribute repair ${JSON.stringify(s.attributeRepair ?? null)}`,
        );
      },
      ENGINE_TIMEOUT,
    );

    it(
      "the rebuilt tree, compiled, meets PoB's own Str, Dex and Int requirements, with no V1 attributes finding",
      async () => {
        const s = rebuild.reply.swaps[0];
        const { attrs, findings } = await compiledWith('os-s4-rebuilt', s);
        expect(meetsAll(attrs)).toEqual(ALL_MET);
        expect(findings).toEqual([]);
        for (const a of ATTRS) expect({ a, value: attrs[a] }).toEqual({ a, value: s.attributes![a] });
      },
      ENGINE_TIMEOUT,
    );

    it(
      "with only the two core needs kept, the rebuild's repair steps run, its line names them in Appendix A's form, and the result meets every requirement, PoB agreeing",
      async () => {
        const out = await nodePower(d1Tree({ keep: CORE_NEEDS }));
        const s = out.reply.swaps[0];
        const rep = s.attributeRepair!;
        expect(rep).toBeDefined();
        const added = rep.steps.flatMap((st) => st.added);
        expect(rep.steps.length).toBeGreaterThan(0);
        expect(added.some((x) => x.attribute && x.attributeChoice)).toBe(true);
        expect(meetsAll(s.attributes!)).toEqual(ALL_MET);
        expect(s.verdict).not.toBe('illegal');
        const line = lineOf(out.text, /^Rebuild: /);
        const repointed = rep.repointed.length === 0 ? 're-pointed 0' : 're-pointed ';
        expect(line).toContain(`; attributes repaired: ${repointed}`);
        const names = added.map((x) => `${x.name} [${x.id}]${x.attributeChoice ? ` (attribute: ${x.attributeChoice})` : ''}`);
        expect(line).toContain(`, added ${added.length} (${names.join(', ')})`);
        // Each step freed a branch (its points) and added at least one attribute node.
        for (const st of rep.steps) {
          expect(st.freed.length).toBeGreaterThan(0);
          expect(st.added.some((x) => x.attribute)).toBe(true);
        }
        const { attrs, findings } = await compiledWith('os-s4-core', s);
        expect(meetsAll(attrs)).toEqual(ALL_MET);
        expect(findings).toEqual([]);
        console.error(`[WU-136 r1-s-4 n] rebuild, core needs kept: ${s.verdict} in ${out.seconds.toFixed(1)} s; attributes ${JSON.stringify(s.attributes)}; repair ${JSON.stringify(rep)}`);
      },
      ENGINE_TIMEOUT,
    );

    let dexFree: { text: string; reply: NodePowerResult; seconds: number };
    let dexUnclosed: { text: string; reply: NodePowerResult; seconds: number };

    it(
      `AC-K81 (2): free [${DEX_NODE}] with every node that gives Dexterity excluded can't close the shortfall: "Dexterity would be <x>, under the <y> its gear and gems need, after repair", PoB's own figures`,
      async () => {
        // Every node the loadout doesn't hold that can give Dexterity (an attribute node, or a line naming Dexterity or all
        // Attributes, as Spaghettification's "+13 to all Attributes"), so neither the refill nor a step can add one.
        const givers = await lua<number[]>(`
          local out = {}
          for id, node in pairs(build.spec.nodes) do
            local gives = node.isAttribute
            for _, line in ipairs(node.sd or {}) do
              if tostring(line):match('Dexterity') or tostring(line):match('all Attributes') then gives = true end
            end
            if gives and not node.alloc then out[#out + 1] = id end
          end
          table.sort(out)
          return out`);
        expect(givers.length).toBeGreaterThan(100);
        dexUnclosed = await nodePower({ free: [DEX_NODE], exclude: givers, stats: ['MainDamage', 'TotalEHP'], limit: 0 });
        const s = dexUnclosed.reply.swaps[0];
        expect(s.verdict).toBe('illegal');
        const m = /^Dexterity would be (\d+), under the (\d+) its gear and gems need, after repair$/.exec(s.reason ?? '');
        expect({ reason: s.reason, form: m !== null }).toEqual({ reason: s.reason, form: true });
        expect(Number(m![1])).toBeLessThan(Number(m![2]));
        expect(s.attributeRepair).toBeDefined();
        expect(lineOf(dexUnclosed.text, /^Free: /)).toContain(`Free: none: illegal: ${s.reason}.`);
        // PoB's own figures for the move as returned.
        const { attrs, findings } = await compiledWith('os-s4-dex-short', s);
        expect([attrs.Dex, attrs.ReqDex]).toEqual([Number(m![1]), Number(m![2])]);
        expect(findings.some((x) => /^Dexterity /.test(x))).toBe(true);
      },
      ENGINE_TIMEOUT,
    );

    it(
      `AC-K81 (3): free [${DEX_NODE}] leaves n short of Dexterity; the repair's added attribute node takes Dexterity, and the result meets it, PoB agreeing`,
      async () => {
        dexFree = await nodePower({ free: [DEX_NODE], stats: ['MainDamage', 'TotalEHP'], limit: 0 });
        const s = dexFree.reply.swaps[0];
        const rep = s.attributeRepair!;
        expect(rep).toBeDefined();
        const stepAttributes = rep.steps.flatMap((st) => st.added).filter((x) => x.attribute);
        // The largest shortfall is Dexterity's: an attribute node the repair adds takes it.
        expect(stepAttributes.length).toBeGreaterThan(0);
        expect(stepAttributes.map((x) => x.attributeChoice)).toContain('dexterity');
        expect(meetsAll(s.attributes!)).toEqual(ALL_MET);
        expect(s.verdict).not.toBe('illegal');
        expect(lineOf(dexFree.text, /^Free: /)).toMatch(/; attributes repaired: re-pointed (0|\d+ to \w+( and \d+ to \w+)*), added \d+ \(.*Attribute \[\d+\] \(attribute: dexterity\)/);
        // The free named the Dexterity node; no step adds it back.
        expect(treeAfter(n.tree.nodes, s).has(DEX_NODE)).toBe(false);
        const { attrs, findings } = await compiledWith('os-s4-dex', s);
        expect(meetsAll(attrs)).toEqual(ALL_MET);
        expect(findings).toEqual([]);
        expect(attrs.Dex).toBe(s.attributes!.Dex);
      },
      ENGINE_TIMEOUT,
    );
  });

  describe('AC-K81 (1): exclude', () => {
    it(
      `the rebuild adds Mind Over Matter [${MIND_OVER_MATTER}] without exclude; with exclude: [${MIND_OVER_MATTER}] no tree holds it`,
      async () => {
        const plain = await d1RebuildOnce();
        expect(treeAfter(n.tree.nodes, plain.reply.swaps[0]).has(MIND_OVER_MATTER)).toBe(true);
        const out = await nodePower(d1Tree({ exclude: [MIND_OVER_MATTER] }));
        expect(out.reply.exclude).toEqual([MIND_OVER_MATTER]);
        expect(lineOf(out.text, /^Excluded: /)).toBe('Excluded: 1 node, never added nor pathed through.');
        const s = out.reply.swaps[0];
        expect(s.gain).toBeDefined();
        expect(treeAfter(n.tree.nodes, s).has(MIND_OVER_MATTER)).toBe(false);
        for (const st of [...(s.repair ?? []), ...(s.attributeRepair?.steps ?? [])]) expect(st.added.map((x) => x.id)).not.toContain(MIND_OVER_MATTER);
      },
      ENGINE_TIMEOUT,
    );

    it(
      "a small node on the only path to another node the rebuild adds (PoB's import drops that node without it), excluded: the rebuild takes another path to it, or none",
      async () => {
        const plain = await d1RebuildOnce();
        const s = plain.reply.swaps[0];
        const after = [...treeAfter(n.tree.nodes, s)].sort((a, b) => a - b);
        const added = (s.added ?? []).filter((x) => x.type === 'Normal').map((x) => x.id);
        // For each small node the rebuild added, the nodes PoB's import of the tree without it drops.
        const cut = await lua<Array<{ id: number; dropped: number[] }> | Record<string, never>>(`
          local spec = build.spec
          local ids = { ${after.join(', ')} }
          local out = {}
          for _, s in ipairs({ ${added.join(', ')} }) do
            local list = {}
            for _, id in ipairs(ids) do if id ~= s then list[#list + 1] = id end end
            local scratch = require('API.Util').construct('PassiveSpec', build, spec.treeVersion)
            scratch.jewels = copyTable(spec.jewels or {})
            scratch:ImportFromNodeList(nil, spec.curClassId, spec.curAscendClassId, spec.curSecondaryAscendClassId or 0, list, {},
              copyTable(spec.hashOverrides or {}, true), copyTable(spec.masterySelections or {}, true))
            local dropped = {}
            for _, id in ipairs(list) do if not scratch.allocNodes[id] then dropped[#dropped + 1] = id end end
            if #dropped > 0 then out[#out + 1] = { id = s, dropped = dropped } end
          end
          return out`);
        const cuts = Array.isArray(cut) ? cut : [];
        expect(cuts.length).toBeGreaterThan(0);
        const { id: small, dropped } = cuts[0];
        const out = await nodePower(d1Tree({ exclude: [small] }));
        const t = out.reply.swaps[0];
        const tree = treeAfter(n.tree.nodes, t);
        expect(tree.has(small)).toBe(false);
        // Each node the small node held up is either left out or reached by another path: PoB's import keeps every node.
        const held = dropped.filter((id) => tree.has(id));
        const kept = await lua<number[] | Record<string, never>>(`
          local spec = build.spec
          local list = { ${[...tree].sort((a, b) => a - b).join(', ')} }
          local scratch = require('API.Util').construct('PassiveSpec', build, spec.treeVersion)
          scratch.jewels = copyTable(spec.jewels or {})
          scratch:ImportFromNodeList(nil, spec.curClassId, spec.curAscendClassId, spec.curSecondaryAscendClassId or 0, list, {},
            copyTable(spec.hashOverrides or {}, true), copyTable(spec.masterySelections or {}, true))
          local out = {}
          for _, id in ipairs({ ${held.join(', ')} }) do if scratch.allocNodes[id] then out[#out + 1] = id end end
          return out`);
        expect(Array.isArray(kept) ? kept : []).toEqual(held);
        console.error(`[WU-136 exclude] cut node ${small} held up ${JSON.stringify(dropped)}; with it excluded the rebuild keeps ${JSON.stringify(held)} by another path`);
      },
      ENGINE_TIMEOUT,
    );

    it(
      `free [${STR_LEAF}] adds a node; with that node excluded the refill adds another, and the swap search's tries hold none`,
      async () => {
        const plain = await nodePower({ free: [STR_LEAF], stats: ['MainDamage', 'TotalEHP'], limit: 0 });
        const first = (plain.reply.swaps[0].added ?? []).map((x) => x.id);
        expect(first.length).toBeGreaterThan(0);
        const banned = first[0];
        const out = await nodePower({ free: [STR_LEAF], exclude: [banned], stats: ['MainDamage', 'TotalEHP'], limit: 0 });
        expect(treeAfter(n.tree.nodes, out.reply.swaps[0]).has(banned)).toBe(false);
        const search = await nodePower({ exclude: [banned], stats: ['MainDamage', 'TotalEHP'], limit: 0 });
        expect(search.reply.mode).toBe('swap');
        expect(search.reply.swaps.length).toBeGreaterThan(0);
        expect(n.tree.nodes).not.toContain(banned);
        for (const s of search.reply.swaps) expect({ tried: s.branches.map((b) => b.id), holds: treeAfter(n.tree.nodes, s).has(banned) }).toEqual({ tried: s.branches.map((b) => b.id), holds: false });
        if (search.reply.bestSwap) expect((search.reply.bestSwap.added ?? []).map((x) => x.id)).not.toContain(banned);
      },
      ENGINE_TIMEOUT,
    );

    it('exclude naming an allocated node refuses the call, naming it', async () => {
      const name = await lua<string>(`return tostring(build.spec.nodes[${CORE_NEEDS[0]}].dn)`);
      await ensureFixture();
      const out = await f.call('get_node_power', { loadout: n.loadoutName, stats: ['MainDamage'], limit: 0, exclude: [MIND_OVER_MATTER, CORE_NEEDS[0]] });
      expect(out.isError).toBe(true);
      expect(out.text).toContain(`Excluded node ${CORE_NEEDS[0]} (${name}) is allocated`);
    }, ENGINE_TIMEOUT);
  });

  describe('AC-K81 (4): a figure within 0.5 of its target meets it', () => {
    it('NodePower.lua\'s judge: 0.4 under meets, 0.6 under does not', async () => {
      const t = targets.ehp;
      const got = await lua<boolean[]>(`local NP = require('API.NodePower') return { NP.meets(${t} - 0.4, ${t}), NP.meets(${t} - 0.6, ${t}), NP.meets(${t}, ${t}), NP.meets(${t} - 0.5, ${t}) }`);
      expect(got).toEqual([true, false, true, true]);
    }, ENGINE_TIMEOUT);

    it(
      `free [${STR_LEAF}] with its own result's EHP + 0.4 as the target needs no repair; + 0.6 runs the repair`,
      async () => {
        const plain = await nodePower({ free: [STR_LEAF], stats: ['MainDamage', 'TotalEHP'], limit: 0 });
        const s = plain.reply.swaps[0];
        expect(typeof s.ehp).toBe('number');
        const near = await nodePower({ free: [STR_LEAF], targets: { ehp: s.ehp! + 0.4, maxHit: s.maxHit! }, stats: ['MainDamage', 'TotalEHP'], limit: 0 });
        const a = near.reply.swaps[0];
        expect(a.repair).toBeUndefined();
        expect(a.verdict).not.toBe('misses-targets');
        expect(a.ehp).toBe(s.ehp);
        const far = await nodePower({ free: [STR_LEAF], targets: { ehp: s.ehp! + 0.6, maxHit: s.maxHit! }, stats: ['MainDamage', 'TotalEHP'], limit: 0 });
        expect(far.reply.swaps[0].repair).toBeDefined();
      },
      ENGINE_TIMEOUT,
    );
  });

  describe('AC-K81 (5): rounded reasons', () => {
    it(
      'a limit with many decimals reads at most 2 in its reason; every figure in the suite\'s reasons has at most 2 decimals',
      async () => {
        const out = await nodePower({ free: [DEX_NODE], stats: ['MainDamage', 'TotalEHP'], limit: 0, max_loss: 2.123456 });
        const s = out.reply.swaps[0];
        expect(s.verdict).toBe('over-loss');
        expect(s.reason).toMatch(/^TotalEHP would fall \d+\.\d{2}%, more than 2\.12%$/);
        // A no-gain reason (the rebuild's), whose figure had every decimal before D-490.
        expect(reasons.some((r) => /^it changes MainDamage by -?\d+(\.\d{1,2})?$/.test(r))).toBe(true);
        expect(reasons.length).toBeGreaterThan(5);
        for (const r of reasons) expect({ reason: r, long: longFigures(r) }).toEqual({ reason: r, long: [] });
      },
      ENGINE_TIMEOUT,
    );
  });
});
