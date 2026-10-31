/**
 * WU-127 (amendment 13 §4 and §8, D-463 and D-467; C-55): node power's pace judge, its attribute guard and Split
 * Personality's start, in process and engine-required; and the new arguments' checks. AC-K76's remaining bullets.
 *
 * The fixtures are the repository's own, written from the pinned game data:
 * - the golden build (`grenadator.xml`), whose Strength (119) sits 3 over its gear and gems' 116, so freeing one Strength
 *   attribute node (+5) leaves it under;
 * - two Sorceress trees built with `lua_new_build` and `set_tree` (§19: not through the compiler, which WU-128 teaches the
 *   start), with Split Personality (`Data/Uniques/jewel.lua`:66-82, its Warrior line) socketed: (A) the class-side path to
 *   the Jewel Socket 61419 (44871 … 46819), three dead ends off it (15618, 53975, 21560) and a tree from the Warrior's
 *   start 47175 (Melee Damage 3936 and 46325); (B) only the path from the Warrior's start to the Jewel Socket 26725
 *   (38646 … 57703), the jewel in it, so the socket is reached only through the start it opens.
 * Every expected value comes from PoB itself (its output's Str and ReqStr for a tree imported with the move, PoB's own
 * allocation), never from the tool's own figures.
 *
 * - AC-K76 (4), the pace judge (NodePower.lua's `pace_judge`): a 20% gain for a 2.55% uses loss passes at 3; a 4% gain for a
 *   2.5% loss fails; a gain of exactly 3 × the loss passes; a move that passes on uses but loses 2% radius for a 4% gain
 *   fails (each figure on its own); `pace_exchange` with stats lacking MainDamage is refused.
 * - AC-K76 (5): the golden build's best unguarded swap leaves Strength under ReqStr; the swap returned keeps Str ≥ ReqStr.
 * - AC-K76 (8), D-463: on (A) node power counts the Warrior's start (one tree) and its tree as reached, and a swap it returns
 *   keeps one tree per start, the Warrior side reached; on (B) it counts no such start, and the Warrior side is unreached.
 */
import fs from 'fs';
import path from 'path';
import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import { engineDescribe } from '../helpers/engine';
import { startSessionFixture, type SessionFixture } from '../helpers/engineSession';
import { nodePowerParams } from '../../src/handlers/treeHandlers';
import type { NodePowerParams, NodePowerResult, PowerSwap } from '../../src/engine/schemas';

const FIXTURES = path.resolve(__dirname, '..', 'fixtures');
const ENGINE_TIMEOUT = 600_000;

/** Split Personality's Warrior variant (`Data/Uniques/jewel.lua`:79), as an item's text. */
const SPLIT_PERSONALITY = "Rarity: Unique\nSplit Personality\nRuby\nCan Allocate Passive Skills from the Warrior's starting point\nCorrupted";
/** The Warrior's (and the Marauder's) start (`tree.classStartNodeNameMap.Warrior`). */
const WARRIOR_START = 47175;
/** (A) the Sorceress's path to the Jewel Socket 61419, three dead ends off it, and the tree from the Warrior's start. */
const A_SOCKET = 61419;
const A_CLASS_PATH = [44871, 56216, 9485, 60685, 1826, 39037, 57710, 8616, 46819, A_SOCKET];
const A_DEAD_ENDS = [15618, 53975, 21560];
const A_WARRIOR_TREE = [3936, 46325];
/** (B) the path from the Warrior's start to the Jewel Socket 26725, which holds the jewel; nothing from the class start. */
const B_SOCKET = 26725;
const B_WARRIOR_PATH = [38646, 23570, 41031, 54232, 44659, 36629, 16725, 54811, 57703, B_SOCKET];

type Shape = { startCounts: Record<string, number> | []; unreached: number[] | Record<string, never>; jewelStarts: Array<{ socket: number; start: number }> | [] };
const sorted = (xs: number[]) => [...xs].sort((a, b) => a - b);
const list = (x: number[] | Record<string, never>) => (Array.isArray(x) ? x : []);
const counts = (x: Shape['startCounts']) => (Array.isArray(x) ? {} : x);

describe("D-467: get_node_power's new arguments, checked before the engine", () => {
  it('passes targets, pace_exchange and pool_groups through, and refuses a malformed one naming it', () => {
    const p = nodePowerParams({ stats: ['MainDamage', 'TotalEHP'], targets: { ehp: 17585.4, maxHit: 3627 }, pace_exchange: 3, pool_groups: { '2': 4 } });
    expect(p).toEqual({ stats: ['MainDamage', 'TotalEHP'], targets: { ehp: 17585.4, maxHit: 3627 }, paceExchange: 3, poolGroups: { '2': 4 } } satisfies NodePowerParams);
    expect(() => nodePowerParams({ targets: { ehp: 1 } })).toThrow(/^targets must be \{ehp, maxHit\}/);
    expect(() => nodePowerParams({ targets: { ehp: 1, maxHit: 2, life: 3 } })).toThrow(/^targets must be \{ehp, maxHit\}/);
    expect(() => nodePowerParams({ stats: ['MainDamage'], pace_exchange: 0 })).toThrow(/^pace_exchange must be a number above 0/);
    expect(() => nodePowerParams({ stats: ['Life'], pace_exchange: 3 })).toThrow('pace_exchange buys damage with pace, nothing else; name MainDamage in stats');
    // The default stats (FullDPS, TotalEHP) lack MainDamage too.
    expect(() => nodePowerParams({ pace_exchange: 3 })).toThrow('pace_exchange buys damage with pace, nothing else; name MainDamage in stats');
    expect(() => nodePowerParams({ pool_groups: { '3': 1 } })).toThrow(/^pool_groups must map a weapon set/);
    expect(() => nodePowerParams({ pool_groups: { '2': 0 } })).toThrow(/^pool_groups must map a weapon set/);
  });
});

engineDescribe('WU-127: node power\'s pace judge, attribute guard and Split Personality\'s start (D-463, D-467; AC-K76)', () => {
  let f: SessionFixture;

  async function lua<T>(code: string): Promise<T> {
    const { value } = await f.session.run({ tool: 'test:node-power-guards-query', kind: 'read' }, async (ctx) => {
      const reply = await ctx.client.request('__test_eval', { code });
      return reply.result as T;
    });
    return value;
  }

  async function power(params: NodePowerParams): Promise<NodePowerResult> {
    const { value } = await f.session.run({ tool: 'test:node-power-guards', kind: 'read' }, (ctx) => ctx.client.nodePower(params));
    return value;
  }

  beforeAll(async () => {
    f = await startSessionFixture({ testActions: true, files: { 'grenadator.xml': fs.readFileSync(path.join(FIXTURES, 'builds', 'grenadator.xml'), 'utf8') } });
  }, ENGINE_TIMEOUT);

  afterAll(async () => f?.close(), 60_000);

  describe('AC-K76 (4): the pace judge, in NodePower.lua', () => {
    /** The judge's verdict: null when every figure is within its exchange, else the reason. */
    const judge = async (r: number, gain: number | null, figures: Array<{ label: string; loss: number }>) => {
      const why = await lua<string | false>(`return require('API.NodePower').pace_judge(${r}, ${gain === null ? 'nil' : gain}, {
        ${figures.map((x) => `{ label = ${JSON.stringify(x.label)}, loss = ${x.loss} }`).join(', ')} }) or false`);
      return why === false ? null : why;
    };
    const USES = "the clear skill's uses per second";
    const RADIUS = "the clear skill's radius";

    it('a 20% gain for a 2.55% uses loss passes at 3; a 4% gain for a 2.5% loss fails, in Appendix A\'s form', async () => {
      expect(await judge(3, 20, [{ label: USES, loss: 2.55 }])).toBeNull();
      expect(await judge(3, 4, [{ label: USES, loss: 2.5 }])).toBe(`${USES} −2.50% needs +7.50% damage, the move gains +4.00%`);
    }, ENGINE_TIMEOUT);

    it('a gain of exactly 3 × the loss passes', async () => {
      expect(await judge(3, 7.5, [{ label: USES, loss: 2.5 }])).toBeNull();
      expect(await judge(3, 6, [{ label: 'movement speed', loss: 2 }])).toBeNull();
      expect(await judge(3, 5.99, [{ label: 'movement speed', loss: 2 }])).toBe('movement speed −2.00% needs +6.00% damage, the move gains +5.99%');
    }, ENGINE_TIMEOUT);

    it('each figure on its own: a move that passes on uses but loses 2% radius for a 4% gain fails, naming the radius', async () => {
      expect(await judge(3, 4, [{ label: USES, loss: 1 }])).toBeNull();
      expect(await judge(3, 4, [{ label: USES, loss: 1 }, { label: RADIUS, loss: 2 }])).toBe(`${RADIUS} −2.00% needs +6.00% damage, the move gains +4.00%`);
      // A figure that doesn't fall needs nothing; no measurable gain buys no loss.
      expect(await judge(3, 0, [{ label: USES, loss: 0 }, { label: RADIUS, loss: -1 }])).toBeNull();
      expect(await judge(3, null, [{ label: USES, loss: 1 }])).toBe(`${USES} −1.00% needs +3.00% damage, the move gains nothing measurable`);
    }, ENGINE_TIMEOUT);

    it('pace_exchange with stats lacking MainDamage is refused, by the tool and by the engine', async () => {
      expect((await f.call('lua_load_build', { build_name: 'grenadator.xml' })).isError).toBe(false);
      const tool = await f.call('get_node_power', { stats: ['FullDPS', 'TotalEHP'], pace_exchange: 3, limit: 0 });
      expect(tool.isError).toBe(true);
      expect(tool.text).toContain('pace_exchange buys damage with pace, nothing else; name MainDamage in stats');
      const engine = await power({ stats: ['FullDPS', 'TotalEHP'], paceExchange: 3, limit: 0 }).then(
        () => 'resolved',
        (e: Error) => e.message,
      );
      expect(engine).toContain('paceExchange buys damage with pace, nothing else; name MainDamage in stats');
    }, ENGINE_TIMEOUT);
  });

  describe('AC-K76 (5): the attribute guard, on the golden build', () => {
    /** PoB's own Str, Dex and Int and their requirements for the loaded tree with `s` applied (imported as node power's swap is). */
    async function attributesWith(s: PowerSwap): Promise<Record<string, number>> {
      const removed = (s.removed ?? []).map((n) => n.id);
      const added = (s.added ?? []).map((n) => n.id);
      const choices = (s.added ?? []).filter((n) => n.attributeChoice).map((n) => `[${n.id}] = ${JSON.stringify(n.attributeChoice)}`);
      return lua(`
        local spec = build.spec
        local gone = {}
        for _, id in ipairs({ ${removed.join(', ')} }) do gone[id] = true end
        local ids, tags = {}, {}
        for id, n in pairs(spec.allocNodes) do
          if not gone[id] then
            ids[#ids + 1] = id
            if (n.allocMode or 0) ~= 0 then tags[id] = n.allocMode end
          end
        end
        for _, id in ipairs({ ${added.join(', ')} }) do ids[#ids + 1] = id end
        table.sort(ids)
        local s = require('API.Util').construct('PassiveSpec', build, spec.treeVersion)
        s.jewels = copyTable(spec.jewels or {})
        s.hashOverrides = copyTable(spec.hashOverrides or {}, true)
        for id, want in pairs({ ${choices.join(', ')} }) do
          local tn = spec.tree.nodes[id]
          for i, o in ipairs(tn.options or {}) do
            if tostring(o.dn or o.name):lower() == want then s:SwitchAttributeNode(id, i) end
          end
        end
        s:ImportFromNodeList(nil, spec.curClassId, spec.curAscendClassId, spec.curSecondaryAscendClassId or 0, ids, tags,
          s.hashOverrides, copyTable(spec.masterySelections or {}, true))
        local calc = build.calcsTab:GetMiscCalculator()
        local out = calc({ spec = s }, false)
        return { Str = out.Str, ReqStr = out.ReqStr, Dex = out.Dex, ReqDex = out.ReqDex, Int = out.Int, ReqInt = out.ReqInt }`);
    }

    it(
      "the best unguarded swap leaves Strength under ReqStr, and the swap returned keeps Str ≥ ReqStr (PoB's own figures)",
      async () => {
        expect((await f.call('lua_load_build', { build_name: 'grenadator.xml' })).isError).toBe(false);
        // Every other guard loose, so the attribute guard alone decides.
        const r = await power({ stats: ['FullDPS'], limit: 0, maxLoss: { movement: 100, maxHit: 100, clearRadius: 100, clearUses: 100 } });
        const refused = r.swaps.filter((s) => s.verdict === 'illegal' && /^Strength would be \d+, under the \d+ its gear and gems need$/.test(s.reason ?? ''));
        expect(refused.length).toBeGreaterThan(0);
        const unguarded = [...refused].sort((a, b) => (b.gain![0] as number) - (a.gain![0] as number))[0];
        const best = r.bestSwap!;
        expect(best).toBeDefined();
        // Unguarded, the refused try would be the best swap; the guard returns the best legal one.
        expect(unguarded.gain![0]!).toBeGreaterThan(best.gain![0]!);
        const legalGains = r.swaps.filter((s) => s.verdict === 'legal').map((s) => s.gain![0] as number);
        expect(best.gain![0]).toBe(Math.max(...legalGains));

        const under = await attributesWith(unguarded);
        expect(under.Str).toBeLessThan(under.ReqStr);
        const m = /^Strength would be (\d+), under the (\d+)/.exec(unguarded.reason!)!;
        expect([Number(m[1]), Number(m[2])]).toEqual([Math.round(under.Str), Math.round(under.ReqStr)]);
        const kept = await attributesWith(best);
        for (const a of ['Str', 'Dex', 'Int']) expect({ a, met: kept[a] >= (kept[`Req${a}`] ?? 0) }).toEqual({ a, met: true });
      },
      ENGINE_TIMEOUT,
    );
  });

  describe("AC-K76 (8), D-463: Split Personality's start", () => {
    /** A Sorceress with Split Personality (Warrior) socketed in `socket` and the tree `nodes` (set_tree, PoB's import). */
    async function fixture(socket: number, nodes: number[]): Promise<{ alloc: number[]; shape: Shape }> {
      expect((await f.call('lua_new_build', { class_name: 'Sorceress' })).isError).toBe(false);
      // A socket group, so node power has a main skill to measure; Spark at level 1, whose Intelligence a new Sorceress
      // meets (the attribute guard keeps PoB's requirements).
      expect((await f.call('setup_skill_with_gems', { label: 'Spark', active_gem: 'Spark', support_gems: [] })).isError).toBe(false);
      expect((await f.call('set_gem_level', { group_index: 1, gem_index: 1, level: 1 })).isError).toBe(false);
      return lua(`
        local BuildOps = require('API.BuildOps')
        local item, err = BuildOps.add_item_text({ text = ${JSON.stringify(SPLIT_PERSONALITY)}, slotName = 'Jewel ${socket}' })
        if not item then error(err) end
        local spec = build.spec
        local ok, why = BuildOps.set_tree({ classId = spec.curClassId, ascendClassId = spec.curAscendClassId, secondaryAscendClassId = 0,
          nodes = { ${nodes.join(', ')} }, treeVersion = spec.treeVersion })
        if not ok then error(why) end
        local alloc = {}
        for id in pairs(build.spec.allocNodes) do alloc[#alloc + 1] = id end
        table.sort(alloc)
        return { alloc = alloc, shape = require('API.NodePower').tree_shape() }`);
    }

    /** Node power's reading of the loaded tree with `s` applied (PoB's import of it). */
    async function shapeWith(s: PowerSwap): Promise<{ alloc: number[]; shape: Shape }> {
      const removed = (s.removed ?? []).map((n) => n.id);
      const added = (s.added ?? []).map((n) => n.id);
      return lua(`
        local spec = build.spec
        local gone = {}
        for _, id in ipairs({ ${removed.join(', ')} }) do gone[id] = true end
        local ids = {}
        for id in pairs(spec.allocNodes) do if not gone[id] then ids[#ids + 1] = id end end
        for _, id in ipairs({ ${added.join(', ')} }) do ids[#ids + 1] = id end
        table.sort(ids)
        local s = require('API.Util').construct('PassiveSpec', build, spec.treeVersion)
        s.jewels = copyTable(spec.jewels or {})
        s:ImportFromNodeList(nil, spec.curClassId, spec.curAscendClassId, spec.curSecondaryAscendClassId or 0, ids, {}, {}, {})
        local alloc = {}
        for id in pairs(s.allocNodes) do alloc[#alloc + 1] = id end
        table.sort(alloc)
        return { alloc = alloc, shape = require('API.NodePower').tree_shape(s) }`);
    }

    it(
      "(A) the socket reached from the class's start: node power counts the Warrior's start, one tree, and its tree as reached; a swap it returns keeps one tree per start",
      async () => {
        const all = [...A_CLASS_PATH, ...A_DEAD_ENDS, ...A_WARRIOR_TREE];
        const a = await fixture(A_SOCKET, all);
        // PoB allocates the Warrior-side tree through the start the jewel opens (Classes/PassiveSpec.lua:1403-1412).
        for (const id of all) expect({ id, allocated: a.alloc.includes(id) }).toEqual({ id, allocated: true });
        expect(a.shape.jewelStarts).toEqual([{ socket: A_SOCKET, start: WARRIOR_START }]);
        expect(counts(a.shape.startCounts)).toEqual({ class: 1, [`jewel:${WARRIOR_START}`]: 1 });
        expect(list(a.shape.unreached)).toEqual([]);

        for (const stats of [['EnergyShield'], ['Armour']]) {
          const r = await power({ stats, limit: 0 });
          if (stats[0] === 'EnergyShield') expect(r.bestSwap).toBeDefined();
          for (const s of r.swaps.filter((x) => x.verdict === 'legal')) {
            const after = await shapeWith(s);
            // Every node the move keeps or adds stays allocated, the Warrior side among them, each start holding one tree.
            const kept = sorted([...a.alloc.filter((id) => !(s.removed ?? []).some((n) => n.id === id)), ...(s.added ?? []).map((n) => n.id)]);
            expect({ stats, alloc: after.alloc }).toEqual({ stats, alloc: kept });
            expect({ stats, unreached: list(after.shape.unreached) }).toEqual({ stats, unreached: [] });
            for (const [key, n] of Object.entries(counts(after.shape.startCounts))) expect({ stats, key, n }).toEqual({ stats, key, n: 1 });
          }
        }
      },
      ENGINE_TIMEOUT,
    );

    it(
      'a move that would grow a second tree from the Warrior\'s start is never legal: Armour 38646 next to the start, alone, is refused',
      async () => {
        await fixture(A_SOCKET, [...A_CLASS_PATH, ...A_DEAD_ENDS, ...A_WARRIOR_TREE]);
        // Freeing a dead end for the Armour node by the start would leave the Warrior's start with two trees.
        const r = await power({ stats: ['Armour'], free: [A_DEAD_ENDS[0]], limit: 0 });
        const s = r.swaps[0];
        expect((s.added ?? []).map((n) => n.id)).not.toContain(38646);
        const two = await shapeWith({ ...s, removed: [{ id: A_DEAD_ENDS[0], name: '', type: 'Normal' }], added: [{ id: 38646, name: '', type: 'Normal' }] } as PowerSwap);
        expect(counts(two.shape.startCounts)[`jewel:${WARRIOR_START}`]).toBe(2);
      },
      ENGINE_TIMEOUT,
    );

    it(
      '(B) the socket reached only through the Warrior\'s start: node power counts no such start, and the Warrior side is unreached',
      async () => {
        const b = await fixture(B_SOCKET, B_WARRIOR_PATH);
        // PoB's own looser rule allocates the path through the start the socketed jewel opens.
        for (const id of B_WARRIOR_PATH) expect({ id, allocated: b.alloc.includes(id) }).toEqual({ id, allocated: true });
        expect(b.shape.jewelStarts).toEqual([{ socket: B_SOCKET, start: WARRIOR_START }]);
        expect(counts(b.shape.startCounts)[`jewel:${WARRIOR_START}`]).toBeUndefined();
        expect(sorted(list(b.shape.unreached))).toEqual(sorted(B_WARRIOR_PATH));
      },
      ENGINE_TIMEOUT,
    );
  });
});
