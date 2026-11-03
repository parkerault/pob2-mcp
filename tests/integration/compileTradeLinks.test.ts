/**
 * AC-K85 (WU-138, D-488): `compile_plan {trade_links: true}`, the weighted trade links of a build's rares.
 *
 * - The engine rows run the real server in process over the committed Titan Rake fixture `titan-rake/r2-s-2` (rares on
 *   `b` and `n`: gear slots and tree jewels, beside uniques), final-compiled first. Its HTTP is a `fixtureFetch` serving
 *   only the trade2 `/data/*` fixtures and recording every call: the links mode itself must make none (and Jest's
 *   global `fetch` throws). Each link's query is decoded and checked: a weight group, no weighted corrupted mod (PoB's
 *   `Corrupted` mods are its `enchant.` trade ids, `Data/QueryMods.lua`), the `corrupted: false` filter, at most 3
 *   required filters, the stage's level as the maximum, the socket table's count as the rune-socket minimum when the table
 *   is loaded, and a complexity within the prefit's budget with the corrupted filter counted.
 * - The spec rows check which weights and must-haves a link takes from a rare's price entry: with no engine, and on the
 *   fixture moved to schema 10 with a spec on `b`'s Body Armour price (validated against `validatePlan`), whose link
 *   requires the spec's 3 most important must-haves, and a spec PoB refuses, which names its stage and slot.
 */
import fs from 'fs';
import path from 'path';
import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import { engineDescribe } from '../helpers/engine';
import { startSessionFixture, type SessionFixture } from '../helpers/engineSession';
import { fixtureFetch, type RecordedCall } from '../helpers/fixtureFetch';
import { DATA_ROUTES, fixtureStatIds } from '../helpers/tradeFixtures';
import { linkSpecOf, type TradeLinkEntry } from '../../src/plan/compiler';
import { loadReferenceData } from '../../src/plan/referenceData';
import { OFFLINE_PRICE_NOTE, validatePlan } from '../../src/plan/schema';
import { COMPLEXITY_BUDGET, COMPLEXITY_HEADROOM, estimateComplexity, type TradeQueryBody } from '../../src/trade/prefit';

const REPO = path.resolve(__dirname, '..', '..');
const TITAN = path.join(REPO, 'tests', 'fixtures', 'plans', 'titan-rake', 'r2-s-2', 'plan.json');
const PLAN = JSON.parse(fs.readFileSync(TITAN, 'utf8')) as {
  league: string;
  stages: Array<{
    id: string;
    variant?: string;
    level: number;
    items: { slots: Array<{ slot: string; text?: string; sameAs?: string }>; treeJewels: Array<{ node: number; text: string }> };
  }>;
  prices: unknown[];
};
const ENGINE_TIMEOUT = 300_000;
const LINK_PREFIX = 'https://www.pathofexile.com/trade2/search/poe2/Forbidden%20Rites?q=';

const isRare = (text: string | undefined) => /^Rarity: rare$/i.test((text ?? '').split('\n')[0].trim());

/** The links the fixture must get: each rare gear slot and rare tree jewel of b and n, in plan order. */
const EXPECTED = PLAN.stages
  .filter((s) => s.variant === 'budget' || s.variant === 'non-budget')
  .flatMap((s) => [
    ...s.items.slots.filter((x) => x.sameAs === undefined && isRare(x.text)).map((x) => ({ stage: s.id, slot: x.slot })),
    ...s.items.treeJewels.filter((j) => isRare(j.text)).map((j) => ({ stage: s.id, slot: `Jewel ${j.node}` })),
  ]);
/** The slots that hold a unique on b or n: never linked. */
const UNIQUE_SLOTS = PLAN.stages
  .filter((s) => s.variant === 'budget' || s.variant === 'non-budget')
  .flatMap((s) => [
    ...s.items.slots.filter((x) => /^Rarity: unique$/i.test((x.text ?? '').split('\n')[0].trim())).map((x) => `${s.id}/${x.slot}`),
    ...s.items.treeJewels.filter((j) => /^Rarity: unique$/i.test(j.text.split('\n')[0].trim())).map((j) => `${s.id}/Jewel ${j.node}`),
  ]);

const REF = loadReferenceData();

/**
 * The rune-socket minimum the socket table (`data/items/sockets.json`, C-35) gives a slot of the fixture: its body armour
 * (Conqueror Plate), boots, spear (one-handed) and the jewellery (0: no filter); jewels have none.
 */
function tableSockets(slot: string): number | null {
  const key = { 'Body Armour': 'body-armour', Boots: 'boots', 'Weapon 1': 'one-hand-weapon', Belt: 'belt', 'Ring 1': 'ring', 'Ring 2': 'ring' }[slot];
  if (key === undefined) return null;
  const found = REF.resolveFact('items/sockets.json', `sockets.${key}`);
  if (!found.ok || typeof found.fact.value !== 'number') throw new Error(`the socket table has no sockets.${key}`);
  return found.fact.value;
}

/** Trade stat ids (`/data/stats` fixture) of the spec rows. */
const LIFE = 'explicit.stat_3299347043';
const FIRE = 'explicit.stat_3372524247';
const COLD = 'explicit.stat_4220027924';
const SPIRIT = 'explicit.stat_3981240776';

/** The fixture at schema 10, its `b` Body Armour price carrying a spec (D-483), validated against the plan schema. */
function specPlan(weights: Array<{ stat: string; weight: number; why?: string }>, stage = 'b'): Record<string, any> {
  const plan = JSON.parse(fs.readFileSync(TITAN, 'utf8'));
  plan.schemaVersion = 10;
  const entry = plan.prices.find((p: { id: string }) => p.id === `${stage}-bodyarmour`);
  if (entry === undefined || entry.query?.slot !== 'Body Armour') throw new Error('the fixture has no Body Armour price to give a spec');
  entry.spec = {
    base: 'Conqueror Plate',
    weights,
    ranking: null,
    mustHaves: [
      { affix: '+# to maximum Life', tradeId: LIFE, tier: 2, min: 150 },
      { affix: '+#% to Fire Resistance', tradeId: FIRE, tier: 3, min: 35 },
      { affix: '+# to Spirit', tradeId: SPIRIT, tier: 1, min: 40, zeroScored: true, why: 'PoB values no Spirit' },
      { affix: '+#% to Cold Resistance', tradeId: COLD, tier: 3, min: 35 },
    ],
    leftOut: [],
    searches: 3,
  };
  const checked = validatePlan(JSON.stringify(plan), REF);
  if (!checked.ok) throw new Error(`the spec plan is invalid: ${JSON.stringify(checked.errors.slice(0, 5))}`);
  return plan;
}

const decode = (url: string): TradeQueryBody => JSON.parse(decodeURIComponent(url.slice(LINK_PREFIX.length))) as TradeQueryBody;

describe('AC-K85: a link takes its spec from the rare\'s price entry (D-488)', () => {
  const prices = [
    { id: 'b-body', query: { slot: 'Body Armour' }, spec: {
      weights: [{ stat: 'FullDPS', weight: 1 }, { stat: 'TotalEHP', weight: 0.5 }, { stat: 'Spirit', weight: 0.3, why: 'reservations' }],
      mustHaves: [
        { affix: '+# to maximum Life', tradeId: 'explicit.stat_3299347043', tier: 2, min: 150 },
        { affix: '#% to Fire Resistance', tradeId: 'explicit.stat_3372524247', tier: 3, min: 30 },
        { affix: '+# to Spirit', tradeId: 'explicit.stat_3981240776', tier: 1, min: 40, zeroScored: true, why: 'PoB values no Spirit' },
        { affix: '#% to Cold Resistance', tradeId: 'explicit.stat_4220027924', tier: 3, min: 30 },
      ],
    } },
    { id: 'n-body', query: { slot: 'Body Armour' }, spec: { weights: [], mustHaves: [] } },
  ];

  it('the 3 most important must-haves are required, one PoB scores at zero first, with the spec\'s weights', () => {
    expect(linkSpecOf(prices, 'b', 'Body Armour')).toEqual({
      weights: [{ stat: 'FullDPS', weight: 1 }, { stat: 'TotalEHP', weight: 0.5 }, { stat: 'Spirit', weight: 0.3 }],
      required: [
        { tradeId: 'explicit.stat_3981240776', min: 40 },
        { tradeId: 'explicit.stat_3299347043', min: 150 },
        { tradeId: 'explicit.stat_3372524247', min: 30 },
      ],
    });
  });

  it("a slot with no spec, or another stage's or slot's, takes PoB's defaults: no weights or required given", () => {
    expect(linkSpecOf(prices, 'n', 'Body Armour')).toEqual({});
    expect(linkSpecOf(prices, 'b', 'Helmet')).toEqual({});
    expect(linkSpecOf(prices, 'm', 'Body Armour')).toEqual({});
    expect(linkSpecOf([{ id: 'b-body', query: { slot: 'Body Armour' } }], 'b', 'Body Armour')).toEqual({});
  });
});

engineDescribe('AC-K85: compile_plan trade_links on a final compile with rares on b and n (D-488)', () => {
  let f: SessionFixture;
  let calls: RecordedCall[];
  let plan: string;
  let dir: string;

  beforeAll(async () => {
    const ff = fixtureFetch(DATA_ROUTES);
    calls = ff.calls;
    f = await startSessionFixture({ files: {}, deps: { fetch: ff.fetch } });
    const out = await f.call('guide_run', { new_run: 'trade-links' });
    const run = path.posix.dirname(/^plan_path for this run: (\S+)$/m.exec(out.text)![1]);
    plan = `${run}/builds/r2-s-2/plan.json`;
    dir = path.join(f.guides, path.posix.dirname(plan));
    fs.mkdirSync(dir, { recursive: true });
    fs.copyFileSync(TITAN, path.join(dir, 'plan.json'));
    const compiled = await f.call('compile_plan', { plan_path: plan, build_name: 'Trade Links', first_free: true });
    if (compiled.isError) throw new Error(`the final compile failed: ${compiled.text}`);
  }, ENGINE_TIMEOUT);
  afterAll(async () => {
    await f?.close();
  });

  const linksFile = (): TradeLinkEntry[] => JSON.parse(fs.readFileSync(path.join(dir, 'trade-links.json'), 'utf8')) as TradeLinkEntry[];

  it('writes trade-links.json with an entry for each rare slot and rare jewel of b and n, each a weighted trade2 query link, and sends no request', async () => {
    expect(EXPECTED.length).toBeGreaterThan(10);
    expect(EXPECTED.some((e) => e.slot.startsWith('Jewel '))).toBe(true);
    const out = await f.call('compile_plan', { plan_path: plan, trade_links: true });
    expect(out.isError).toBe(false);
    expect(out.text).toBe(`Trade links: ${EXPECTED.length} written to trade-links.json`);
    expect(calls).toEqual([]);
    const links = linksFile();
    expect(links.map((l) => ({ stage: l.stage, slot: l.slot }))).toEqual(EXPECTED);
    // A slot holding a unique has none.
    expect(UNIQUE_SLOTS.length).toBeGreaterThan(0);
    for (const u of UNIQUE_SLOTS) expect(links.map((l) => `${l.stage}/${l.slot}`)).not.toContain(u);

    for (const link of links) {
      const stage = PLAN.stages.find((s) => s.id === link.stage)!;
      const tag = `${link.stage}/${link.slot}`;
      expect({ tag, prefix: link.url.startsWith(LINK_PREFIX) }).toEqual({ tag, prefix: true });
      // No cached stat list: the ids are unchecked.
      expect(link.ids).toBe('unchecked');
      const q = decode(link.url);
      const weight = q.query.stats!.find((g) => g.type === 'weight');
      expect({ tag, weighted: (weight?.filters.length ?? 0) > 0 }).toEqual({ tag, weighted: true });
      expect({ tag, corruptedWeighted: weight!.filters.filter((x) => x.id.startsWith('enchant.')).map((x) => x.id) }).toEqual({ tag, corruptedWeighted: [] });
      const misc = (q.query.filters as Record<string, { filters?: Record<string, unknown> }>).misc_filters;
      expect({ tag, corrupted: misc?.filters?.corrupted }).toEqual({ tag, corrupted: { option: 'false' } });
      const required = q.query.stats!.filter((g) => g.type === 'and').flatMap((g) => g.filters);
      expect(required.length).toBeLessThanOrEqual(3);
      const lvl = (q.query.filters as Record<string, { filters?: Record<string, { max?: number }> }>).req_filters?.filters?.lvl?.max;
      expect({ tag, lvl }).toEqual({ tag, lvl: stage.level });
      // The base's rune sockets from the socket table as the minimum (none for 0 or a jewel).
      const sockets = (q.query.filters as Record<string, { filters?: Record<string, { min?: number }> }>).equipment_filters?.filters?.rune_sockets?.min;
      const want = tableSockets(link.slot);
      expect({ tag, sockets: sockets ?? null }).toEqual({ tag, sockets: want !== null && want > 0 ? want : null });
      // The prefit's budget, with the corrupted filter counted as a flag filter (3).
      expect(COMPLEXITY_BUDGET - (estimateComplexity(q) + 3)).toBeGreaterThanOrEqual(COMPLEXITY_HEADROOM);
    }
  }, ENGINE_TIMEOUT);

  it('with the trade stat list cached, each entry says ids checked and holds only ids the list knows; the mode still sends no request', async () => {
    // A trade tool loads /data/stats once (one request); the links mode itself sends none.
    const stats = await f.call('search_stats', { query: 'maximum Life', limit: 1 });
    expect(stats.isError).toBe(false);
    const before = calls.length;
    expect(calls.some((c) => /\/data\/stats/.test(c.url))).toBe(true);
    const out = await f.call('compile_plan', { plan_path: plan, trade_links: true });
    expect(out.isError).toBe(false);
    expect(calls.length).toBe(before);
    const known = fixtureStatIds();
    for (const link of linksFile()) {
      expect(link.ids).toBe('checked');
      const q = decode(link.url);
      const ids = q.query.stats!.flatMap((g) => (g.type === 'weight' || g.type === 'and' ? g.filters.map((x) => x.id) : []));
      expect(ids.filter((id) => !known.has(id))).toEqual([]);
    }
  }, ENGINE_TIMEOUT);

  it('the socket table sets the minimum: 2 on the body armour, 1 on the boots and the one-handed spear, none on the jewellery', async () => {
    expect(['Body Armour', 'Boots', 'Weapon 1', 'Belt', 'Ring 1'].map(tableSockets)).toEqual([2, 1, 1, 0, 0]);
    const min = (l: TradeLinkEntry) =>
      (decode(l.url).query.filters as Record<string, { filters?: Record<string, { min?: number }> }>).equipment_filters?.filters?.rune_sockets?.min ?? null;
    const bySlot = Object.fromEntries(linksFile().filter((l) => l.stage === 'b').map((l) => [l.slot, min(l)]));
    expect(bySlot).toMatchObject({ 'Body Armour': 2, Boots: 1, 'Weapon 1': 1, Belt: null, 'Ring 1': null, 'Jewel 60735': null });
  });

  it("a schema-10 spec's weights and its 3 most important must-haves, one PoB scores at zero first, are the link's; a spec PoB refuses names its stage and slot, writing nothing", async () => {
    const specDir = path.join(path.dirname(dir), 'r2-s-2-spec');
    const specRel = `${path.posix.dirname(path.posix.dirname(plan))}/r2-s-2-spec/plan.json`;
    fs.mkdirSync(specDir, { recursive: true });
    const good = specPlan([{ stat: 'FullDPS', weight: 1 }, { stat: 'TotalEHP', weight: 0.5 }, { stat: 'Life', weight: 0.3, why: 'the life must-have' }]);
    fs.writeFileSync(path.join(specDir, 'plan.json'), JSON.stringify(good, null, 2));
    const compiled = await f.call('compile_plan', { plan_path: specRel, build_name: 'Trade Links Spec', first_free: true });
    expect(compiled.isError).toBe(false);
    const out = await f.call('compile_plan', { plan_path: specRel, trade_links: true });
    expect(out.isError).toBe(false);
    const links = JSON.parse(fs.readFileSync(path.join(specDir, 'trade-links.json'), 'utf8')) as TradeLinkEntry[];
    const required = (l: TradeLinkEntry) => decode(l.url).query.stats!.filter((g) => g.type === 'and').flatMap((g) => g.filters);
    const body = links.find((l) => l.stage === 'b' && l.slot === 'Body Armour')!;
    expect(required(body)).toEqual([
      { id: SPIRIT, value: { min: 40 } },
      { id: LIFE, value: { min: 150 } },
      { id: FIRE, value: { min: 35 } },
    ]);
    // n's Body Armour has no spec: PoB's defaults, nothing required.
    expect(required(links.find((l) => l.stage === 'n' && l.slot === 'Body Armour')!)).toEqual([]);

    // A spec with a stat PoB can't weigh by: refused, naming the stage and slot; the links file is left as it was.
    const before = fs.readFileSync(path.join(specDir, 'trade-links.json'));
    fs.writeFileSync(path.join(specDir, 'plan.json'), JSON.stringify(specPlan([{ stat: 'NotAStat', weight: 1, why: 'a typo' }]), null, 2));
    const refused = await f.call('compile_plan', { plan_path: specRel, trade_links: true });
    expect(refused.isError).toBe(true);
    expect(refused.text).toContain(`no trade links were written for ${specRel}: stage b's Body Armour: unknown stat NotAStat`);
    expect(refused.text).toContain('Nothing was written.');
    expect(fs.readFileSync(path.join(specDir, 'trade-links.json')).equals(before)).toBe(true);
  }, ENGINE_TIMEOUT);

  it('a plan with no league (an offline run) writes none', async () => {
    const offline = JSON.parse(fs.readFileSync(TITAN, 'utf8'));
    offline.league = null;
    offline.prices = offline.prices.map((p: Record<string, unknown>) => ({ ...p, amount: null, currency: null, league: null, status: 'unavailable', note: OFFLINE_PRICE_NOTE }));
    const offDir = path.join(path.dirname(dir), 'offline');
    fs.mkdirSync(offDir, { recursive: true });
    fs.writeFileSync(path.join(offDir, 'plan.json'), JSON.stringify(offline, null, 2));
    const offPlan = `${path.posix.dirname(path.posix.dirname(plan))}/offline/plan.json`;
    const out = await f.call('compile_plan', { plan_path: offPlan, trade_links: true });
    expect(out.isError).toBe(false);
    expect(out.text).toBe('Trade links: none written to trade-links.json: the plan names no league (an offline run).');
    expect(fs.existsSync(path.join(offDir, 'trade-links.json'))).toBe(false);
  }, ENGINE_TIMEOUT);
});
