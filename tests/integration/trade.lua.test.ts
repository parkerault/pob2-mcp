/**
 * Lua trade actions (C-13, `pob-api/API/Trade.lua`): AC-T21…AC-T27 and AC-T42, engine-required.
 *
 * Bridge-level: a real `PoBLuaApiClient` against real luajit, the pinned PoB checkout and the golden
 * build, with the test actions on. Independent checks are Lua queries through `__test_eval`. Trade
 * listings come from the committed `tests/fixtures/trade2/fetch-*.response.json` fixtures; no network.
 */
import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import { afterAll, beforeAll, expect, it } from '@jest/globals';
import { engineDescribe } from '../helpers/engine';
import { EngineActionError, PoBLuaApiClient } from '../../src/pobLuaBridge';
import type { TradeGenerateQueryResult } from '../../src/engine/schemas';
import { resolvePobApiDir, resolvePobSrc } from '../../src/engine/pobPath';
import { readPin } from '../../src/engine/pinCheck';

const REPO = path.resolve(__dirname, '..', '..');
const FIXTURES = path.join(REPO, 'tests', 'fixtures');
const GOLDEN = fs.readFileSync(path.join(FIXTURES, 'builds', 'grenadator.xml'), 'utf8');
/** The golden build with its body armour unequipped. */
const GOLDEN_NO_BODY = GOLDEN.replace('itemId="4" name="Body Armour"', 'itemId="0" name="Body Armour"');

type FetchEntry = { id: string; item: Record<string, unknown>; listing: Record<string, unknown> };
const fetchFixture = (name: string): FetchEntry[] =>
  (JSON.parse(fs.readFileSync(path.join(FIXTURES, 'trade2', `${name}.response.json`), 'utf8')) as { result: FetchEntry[] })
    .result;

/** Every stat id trade2's `/data/stats` fixture knows. */
const STAT_IDS: Set<string> = (() => {
  const data = JSON.parse(fs.readFileSync(path.join(FIXTURES, 'trade2', 'data-stats.response.json'), 'utf8')) as {
    result: Array<{ entries: Array<{ id: string }> }>;
  };
  return new Set(data.result.flatMap((group) => group.entries.map((e) => e.id)));
})();
/** Ids PoB's shipped QueryMods.lua has that trade2 no longer does (spike S-1). */
const KNOWN_STALE_STAT_IDS = new Set(['rune.stat_3170380905']);

const ENGINE_TIMEOUT = 240_000;

function makeClient(): PoBLuaApiClient {
  return new PoBLuaApiClient({
    env: { ...process.env, POB_API_TEST_ACTIONS: '1' },
    spawn,
    pobSrc: resolvePobSrc(process.env),
    pobApiDir: resolvePobApiDir(),
    pin: readPin(),
  });
}

/** Run Lua in the live engine (`__test_eval`) and return its value. */
async function luaEval<T>(client: PoBLuaApiClient, code: string): Promise<T> {
  const reply = await client.request('__test_eval', { code });
  return reply.result as T;
}

/** A JSON value as a Lua expression (decoded by dkjson inside the engine). */
function luaJson(value: unknown): string {
  const json = JSON.stringify(value);
  if (json.includes(']==]')) throw new Error('value cannot be embedded in a Lua long string');
  return `require('dkjson').decode([==[${json}]==])`;
}

/** The engine's error for a request that must fail. */
async function failure(promise: Promise<unknown>): Promise<EngineActionError> {
  const err = await promise.then(
    () => {
      throw new Error('expected the action to fail');
    },
    (e: unknown) => e,
  );
  expect(err).toBeInstanceOf(EngineActionError);
  return err as EngineActionError;
}

/** D-55: (meanStatDiff desc, |weight| desc, tradeId asc). */
function inCanonicalOrder(weights: TradeGenerateQueryResult['rankedWeights']): boolean {
  // dkjson encodes an infinite number as null.
  const num = (v: number | null) => (v === null ? Infinity : v);
  for (let i = 1; i < weights.length; i++) {
    const a = { ...weights[i - 1], meanStatDiff: num(weights[i - 1].meanStatDiff), weight: Math.abs(num(weights[i - 1].weight)) };
    const b = { ...weights[i], meanStatDiff: num(weights[i].meanStatDiff), weight: Math.abs(num(weights[i].weight)) };
    if (a.meanStatDiff !== b.meanStatDiff) {
      if (!(a.meanStatDiff > b.meanStatDiff)) return false;
    } else if (a.weight !== b.weight) {
      if (!(a.weight > b.weight)) return false;
    } else if (!(a.tradeId < b.tradeId)) {
      return false;
    }
  }
  return true;
}

/** Every file under `dir`, relative, sorted. */
function listFiles(dir: string): string[] {
  return (fs.readdirSync(dir, { recursive: true, withFileTypes: true }) as fs.Dirent[])
    .filter((d) => d.isFile())
    .map((d) => path.relative(dir, path.join(d.parentPath ?? (d as unknown as { path: string }).path, d.name)))
    .sort();
}

const EQUIPPED_BODY_TEXT = `
local slot = build.itemsTab.slots['Body Armour']
return build.itemsTab.items[slot.selItemId]:BuildRaw()`;

engineDescribe('Lua trade actions on the golden build (C-13)', () => {
  const clients: PoBLuaApiClient[] = [];
  /** The shared engine, with the golden build loaded. */
  let engine: PoBLuaApiClient;

  async function freshEngine(xml: string, name: string): Promise<PoBLuaApiClient> {
    const client = makeClient();
    clients.push(client);
    await client.start();
    await client.loadBuildXml(xml, name);
    return client;
  }

  beforeAll(async () => {
    engine = await freshEngine(GOLDEN, 'grenadator');
  }, ENGINE_TIMEOUT);

  afterAll(async () => {
    for (const c of clients) await c.stop().catch(() => undefined);
  });

  it(
    'AC-T21: Body Armour generates armour.chest with a ≤ 33-filter weight group and an and group; rankedWeights are in D-55 order; every id is a trade2 stat; two fresh processes agree',
    async () => {
      const first = await freshEngine(GOLDEN, 'grenadator');
      const second = await freshEngine(GOLDEN, 'grenadator');
      const a = await first.tradeGenerateQuery({ slot: 'Body Armour' });
      const b = await second.tradeGenerateQuery({ slot: 'Body Armour' });

      expect(a.itemCategory).toBe('armour.chest');
      const [weightGroup, andGroup] = a.query.query.stats;
      expect(weightGroup.type).toBe('weight');
      expect(weightGroup.filters.length).toBeGreaterThan(0);
      expect(weightGroup.filters.length).toBeLessThanOrEqual(33);
      expect(andGroup.type).toBe('and');
      expect(a.query.query.filters).toMatchObject({ type_filters: { filters: { category: { option: 'armour.chest' } } } });

      expect(a.rankedWeights.length).toBeGreaterThanOrEqual(weightGroup.filters.length);
      expect(inCanonicalOrder(a.rankedWeights)).toBe(true);

      const ids = [...weightGroup.filters.map((f) => f.id), ...a.rankedWeights.map((w) => w.tradeId)];
      const unknown = [...new Set(ids)].filter((id) => !STAT_IDS.has(id) && !KNOWN_STALE_STAT_IDS.has(id));
      expect(unknown).toEqual([]);

      // Two fresh engine processes: deep-equal (arrays in order, object keys unordered).
      expect(b.query).toEqual(a.query);
      expect(b.rankedWeights).toEqual(a.rankedWeights);
    },
    ENGINE_TIMEOUT,
  );

  it(
    'AC-T22: generation for Body Armour, Weapon 1, Ring 1, Amulet and Boots each completes in ≤ 8 s with meta.calcCount ≥ 1',
    async () => {
      const elapsedMs: Record<string, number> = {};
      for (const slot of ['Body Armour', 'Weapon 1', 'Ring 1', 'Amulet', 'Boots']) {
        const t0 = Date.now();
        const result = await engine.tradeGenerateQuery({ slot });
        elapsedMs[slot] = Date.now() - t0;
        expect(result.meta.calcCount).toBeGreaterThanOrEqual(1);
      }
      // Reported as a whole, so a failure shows every slot's time.
      expect(Object.entries(elapsedMs).filter(([, ms]) => ms > 8000)).toEqual([]);
    },
    ENGINE_TIMEOUT,
  );

  it(
    'AC-T23: Charm, Arm and weapon jewel slots fail with the supported list; a tree jewel slot needs jewel_type, and works with Base; *TakenHit weights fail',
    async () => {
      for (const slot of ['Charm 1', 'Arm 1', 'Weapon 1 Jewel Socket 1']) {
        const err = await failure(engine.tradeGenerateQuery({ slot }));
        expect(err.code).toBe('FAILED');
        expect(err.message).toContain(`slot ${slot} is not supported for weighted trade search; supported:`);
        for (const supported of ['Weapon 1', 'Body Armour', 'Ring 1', 'Amulet', 'Belt', 'Flask 1', 'Jewel <nodeId>']) {
          expect(err.message).toContain(supported);
        }
      }

      // An allocated tree jewel socket of the golden build.
      const treeSlot = await luaEval<string>(
        engine,
        `local names = {}
         for name in pairs(build.itemsTab.slots) do
           local id = name:match('^Jewel (%d+)$')
           if id and build.spec.allocNodes[tonumber(id)] then names[#names + 1] = name end
         end
         table.sort(names)
         return names[1]`,
      );
      expect(treeSlot).toMatch(/^Jewel \d+$/);

      const noType = await failure(engine.tradeGenerateQuery({ slot: treeSlot }));
      expect(noType.code).toBe('FAILED');
      expect(noType.message).toContain('jewel_type is required');

      const jewel = await engine.tradeGenerateQuery({ slot: treeSlot, jewelType: 'Base' });
      expect(jewel.itemCategory).toMatch(/jewel$/);

      const taken = await failure(
        engine.tradeGenerateQuery({ slot: 'Body Armour', statWeights: [{ stat: 'PhysicalTakenHit', weight: 1 }] }),
      );
      expect(taken.code).toBe('FAILED');
      expect(taken.message).toContain('not supported for upgrade search');
    },
    ENGINE_TIMEOUT,
  );

  it(
    'AC-T24: 10 fixture body armours score exactly as TradeQuery:GetResultEvaluation; stats carry base/new/delta/pct; itemText parses back; a malformed entry is rejected and the rest still score',
    async () => {
      const entries = fetchFixture('fetch-weighted-session');
      expect(entries).toHaveLength(10);
      const result = await engine.tradeEvaluateItems({ slot: 'Body Armour', items: entries });

      expect(result.items.length + result.rejected.length).toBe(10);
      for (const r of result.rejected) expect(r.reason).toEqual(expect.any(String));
      expect(result.items).toHaveLength(10);
      expect(result.items.map((i) => i.id)).toEqual(entries.map((e) => e.id));

      // PoB's own method, computed independently in the same engine, over the evaluated item text.
      const reference = await luaEval<number[]>(
        engine,
        `local construct = require('API.Util').construct
         local texts = ${luaJson(result.items.map((i) => i.itemText))}
         build.calcsTab:BuildOutput()
         local tq = construct('TradeQuery', build.itemsTab)
         tq.tradeQueryGenerator = construct('TradeQueryGenerator', { itemsTab = build.itemsTab })
         tq.statSortSelectionList = {
           { stat = 'FullDPS', label = 'Full DPS', weightMult = 1.0 },
           { stat = 'TotalEHP', label = 'Effective Hit Pool', weightMult = 0.5 },
         }
         tq.slotTables[1] = { slotName = 'Body Armour' }
         tq.resultTbl[1] = {}
         for i, text in ipairs(texts) do tq.resultTbl[1][i] = { item_string = text } end
         local calcFunc, baseOutput = build.calcsTab:GetMiscCalculator()
         local out = {}
         for i in ipairs(texts) do out[i] = tq:GetResultEvaluation(1, i, calcFunc, baseOutput)[1].weight end
         return out`,
      );
      expect(reference).toHaveLength(10);
      result.items.forEach((item, i) => {
        expect(item.score).toEqual(expect.any(Number));
        expect(Math.abs((item.score as number) - reference[i])).toBeLessThanOrEqual(1e-9);
        for (const stat of ['FullDPS', 'TotalEHP']) {
          const delta = item.stats[stat];
          expect(delta).toEqual({
            base: expect.any(Number),
            new: expect.any(Number),
            delta: expect.any(Number),
            pct: expect.any(Number),
          });
        }
      });

      const parsedBack = await luaEval<boolean[]>(
        engine,
        `local construct = require('API.Util').construct
         local out = {}
         for i, text in ipairs(${luaJson(result.items.map((i) => i.itemText))}) do
           out[i] = construct('Item', text).base ~= nil
         end
         return out`,
      );
      expect(parsedBack).toEqual(Array(10).fill(true));

      // A malformed entry (no listing, no item fields) in the middle: rejected with a reason; the other
      // 10 still score.
      const withBad = [...entries.slice(0, 3), { id: 'malformed-entry', item: {} }, ...entries.slice(3)];
      const mixed = await engine.tradeEvaluateItems({ slot: 'Body Armour', items: withBad });
      expect(mixed.rejected).toEqual([{ id: 'malformed-entry', reason: expect.stringMatching(/\S/) }]);
      expect(mixed.items.map((i) => i.id)).toEqual(entries.map((e) => e.id));
    },
    ENGINE_TIMEOUT,
  );

  it(
    'AC-T25: runeBehaviour copy puts the equipped body armour\'s rune lines on a socketed fixture armour, remove strips its non-socket-bound runes, and the scores differ',
    async () => {
      const socketed = fetchFixture('fetch-body-armour').find(
        (e) => Array.isArray(e.item.sockets) && Array.isArray(e.item.runeMods) && (e.item.runeMods as unknown[]).length > 0,
      );
      expect(socketed).toBeDefined();

      const equippedRuneLines = (await luaEval<string>(engine, EQUIPPED_BODY_TEXT))
        .split('\n')
        .filter((line) => line.includes('{rune}'));
      expect(equippedRuneLines.length).toBeGreaterThan(0);

      const copy = await engine.tradeEvaluateItems({ slot: 'Body Armour', items: [socketed!], runeBehaviour: 'copy' });
      const remove = await engine.tradeEvaluateItems({ slot: 'Body Armour', items: [socketed!], runeBehaviour: 'remove' });
      expect(copy.items).toHaveLength(1);
      expect(remove.items).toHaveLength(1);

      const copyLines = copy.items[0].itemText.split('\n');
      for (const line of equippedRuneLines) expect(copyLines).toContain(line);

      // Every rune left after "remove" is socket-bound (PoB's own check), and every {rune} line the
      // text still has comes from such a rune.
      const removeCheck = await luaEval<{ unbound: number; boundRuneLines: number; runeLines: number }>(
        engine,
        `local construct = require('API.Util').construct
         local item = construct('Item', ${luaJson(remove.items[0].itemText)})
         local valid = build.itemsTab:GetValidRunesForItem(item)
         local unbound, bound = 0, 0
         for _, rune in ipairs(item.runes or {}) do
           if rune ~= 'None' then
             if build.itemsTab:IsSocketBoundRune(item, rune, valid) then bound = bound + 1 else unbound = unbound + 1 end
           end
         end
         local runeLines = 0
         for _, line in ipairs(item.runeModLines or {}) do runeLines = runeLines + 1 end
         return { unbound = unbound, boundRuneLines = bound, runeLines = runeLines }`,
      );
      expect(removeCheck.unbound).toBe(0);
      if (removeCheck.boundRuneLines === 0) {
        expect(remove.items[0].itemText.split('\n').filter((l) => l.includes('{rune}'))).toEqual([]);
      }
      for (const line of equippedRuneLines) expect(remove.items[0].itemText.split('\n')).not.toContain(line);

      expect(copy.items[0].score).not.toBe(remove.items[0].score);
    },
    ENGINE_TIMEOUT,
  );

  it(
    'AC-T26: trade_query_options for Body Armour lists sort stats, 11 currencies, 5 statuses, the shown options and sorted required-mod choices; Amulet shows the anoint behaviour',
    async () => {
      const options = await engine.tradeQueryOptions('Body Armour');
      expect(options.supported).toBe(true);

      const stats = options.sortStats.map((s) => s.stat);
      expect(stats.length).toBeGreaterThanOrEqual(20);
      expect(stats).toEqual(expect.arrayContaining(['FullDPS', 'TotalEHP']));
      expect(stats.filter((s) => s.endsWith('TakenHit'))).toEqual([]);

      expect(options.currencies).toHaveLength(11);
      expect(options.currencies[0]).toEqual({ id: null, label: 'Exalted Orb Equivalent' });
      expect(options.statuses).toHaveLength(5);
      expect(options.shows.runeBehaviour).toBe(true);
      expect(options.shows.anointBehaviour).toBe(false);

      const choices = options.requiredModChoices;
      expect(choices.length).toBeGreaterThanOrEqual(1);
      const ids = choices.map((c) => c.tradeId);
      expect(ids).toEqual([...ids].sort((x, y) => (x < y ? -1 : x > y ? 1 : 0)));
      expect(ids.filter((id) => !STAT_IDS.has(id))).toEqual([]);

      const amulet = await engine.tradeQueryOptions('Amulet');
      expect(amulet.shows.anointBehaviour).toBe(true);
    },
    ENGINE_TIMEOUT,
  );

  it(
    'AC-T27: no popups and no files after generation and evaluation; after loading another build the generator is re-bound (same rankedWeights as a fresh process)',
    async () => {
      const vendorRoot = path.resolve(resolvePobSrc(process.env), '..');
      const buildsDir = process.env.POB_DIRECTORY!;
      expect(buildsDir).toBeTruthy();
      const vendorBefore = listFiles(vendorRoot);
      const buildsBefore = listFiles(buildsDir);

      await engine.loadBuildXml(GOLDEN, 'grenadator');
      const original = await engine.tradeGenerateQuery({ slot: 'Helmet' });
      await engine.tradeEvaluateItems({ slot: 'Body Armour', items: fetchFixture('fetch-weighted-session') });
      const state = await engine.request('__test_state');
      expect((state.result as { popups: number }).popups).toBe(0);
      expect(listFiles(vendorRoot)).toEqual(vendorBefore);
      expect(listFiles(buildsDir)).toEqual(buildsBefore);

      // Load a different build into the same engine (its tabs are recreated) and generate again.
      await engine.loadBuildXml(GOLDEN_NO_BODY, 'grenadator-no-body');
      const rebound = await engine.tradeGenerateQuery({ slot: 'Helmet' });
      const fresh = await (await freshEngine(GOLDEN_NO_BODY, 'grenadator-no-body')).tradeGenerateQuery({ slot: 'Helmet' });
      expect(rebound.rankedWeights).toEqual(fresh.rankedWeights);
      // The change matters, so equality shows the generator follows the loaded build.
      expect(rebound.rankedWeights).not.toEqual(original.rankedWeights);

      const after = await engine.request('__test_state');
      expect((after.result as { popups: number }).popups).toBe(0);
      expect(listFiles(vendorRoot)).toEqual(vendorBefore);
      expect(listFiles(buildsDir)).toEqual(buildsBefore);

      await engine.loadBuildXml(GOLDEN, 'grenadator');
    },
    ENGINE_TIMEOUT,
  );

  it(
    'AC-T42: baselineScore is 1.5 for FullDPS 1 + TotalEHP 0.5 and 1.0 for FullDPS 1 + BlockChance 0.5 (block is 0); the equipped body armour scores exactly the baseline',
    async () => {
      const dpsEhp = [
        { stat: 'FullDPS', weight: 1 },
        { stat: 'TotalEHP', weight: 0.5 },
      ];
      const generated = await engine.tradeGenerateQuery({ slot: 'Body Armour', statWeights: dpsEhp });
      expect(generated.baselineScore).toBe(1.5);

      const block = await luaEval<number>(
        engine,
        `local _, baseOutput = build.calcsTab:GetMiscCalculator()
         return baseOutput.BlockChance`,
      );
      expect(block).toBe(0);
      const dpsBlock = await engine.tradeEvaluateItems({
        slot: 'Body Armour',
        items: [],
        statWeights: [
          { stat: 'FullDPS', weight: 1 },
          { stat: 'BlockChance', weight: 0.5 },
        ],
      });
      expect(dpsBlock.baselineScore).toBe(1.0);

      const equippedText = await luaEval<string>(engine, EQUIPPED_BODY_TEXT);
      const own = await engine.tradeEvaluateItems({
        slot: 'Body Armour',
        items: [{ id: 'equipped', itemText: equippedText }],
        statWeights: dpsEhp,
      });
      expect(own.rejected).toEqual([]);
      expect(own.items).toHaveLength(1);
      expect(Math.abs((own.items[0].score as number) - (own.baselineScore as number))).toBeLessThanOrEqual(1e-9);
    },
    ENGINE_TIMEOUT,
  );
});
