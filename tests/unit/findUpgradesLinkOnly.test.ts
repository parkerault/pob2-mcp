/**
 * AC-K86 (WU-138, D-494): `find_upgrades`' `link_only`, its listing tiers and its fallback's causes, unit class.
 *
 * Seams: the real `runUpgradeSearch`, `TradeApiClient`, `RateLimiter`, `listingTiers` and renderers, with HTTP served by
 * `fixtureFetch` (which records every request) and the engine faked as the generator: it returns PoB's generated Body
 * Armour query from the logged-in capture (`search-weighted-session.request.json`) with 15 ranked weights in PoB's order.
 * The listing tiers are read from the committed logged-in fetch capture (`fetch-weighted-session.response.json`).
 */
import { describe, expect, it, jest } from '@jest/globals';
import { RateLimiter } from '../../src/trade/rateLimiter';
import { TradeApiClient } from '../../src/trade/tradeClient';
import type { Credentials } from '../../src/trade/credentials';
import {
  LINK_ONLY_RANKING,
  parseFindUpgradesInput,
  runUpgradeSearch,
  type UpgradeSearchContext,
  type UpgradeSearchResult,
} from '../../src/trade/findUpgrades';
import { listingTiers, tierLabel, type ListingRow } from '../../src/trade/rankUpgrades';
import { compactListing, fullListing, LINK_INTRO, renderFallback, type UpgradeReport } from '../../src/trade/renderUpgrades';
import { tradeQueryUrl } from '../../src/trade/links';
import type { EngineCallContext } from '../../src/engine/session';
import { fixtureFetch, type FixtureRoute } from '../helpers/fixtureFetch';
import { DATA_ROUTES, FETCH_TEMPLATE, GENERATED_BODY_ARMOUR_QUERY, codeTwoRejection, searchSequence } from '../helpers/tradeFixtures';

const LEAGUE = 'Forbidden Rites';
const LIFE = 'explicit.stat_3299347043';
const ARMOUR_EVASION = 'explicit.stat_2451402625';
const SESSION = (): Credentials => ({ sessionId: 'SENTINEL7f3a', source: 'dotenv' });
const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

/** 15 ranked weights in PoB's order (meanStatDiff descending), each with its trade text. */
const RANKED = Array.from({ length: 15 }, (_, i) => ({
  tradeId: `explicit.stat_${1000 + i}`,
  text: `+# to Test Stat ${i + 1}`,
  meanStatDiff: 150 - i * 10 + 0.123,
  weight: (150 - i * 10) / 40,
}));

const GENERATED = {
  query: GENERATED_BODY_ARMOUR_QUERY,
  rankedWeights: RANKED,
  minWeight: 82.122948670824,
  itemCategory: 'armour.chest',
  statWeights: [
    { stat: 'FullDPS', label: 'Full DPS', weight: 1 },
    { stat: 'TotalEHP', label: 'Effective Hit Pool', weight: 0.5 },
  ],
  baselineScore: 1.5,
  meta: { calcCount: 80, ms: 2500 },
};

function setup(routes: FixtureRoute[], opts: { credentials?: () => Credentials; env?: Record<string, string> } = {}) {
  const ff = fixtureFetch([...routes, ...DATA_ROUTES]);
  const credentials = opts.credentials ?? SESSION;
  const trade = new TradeApiClient({ fetch: ff.fetch, credentials, limiter: new RateLimiter(), userAgent: 'pob2-mcp-server/test' });
  const generate = jest.fn(async (_params: unknown, _opts?: unknown) => clone(GENERATED));
  const ctx: UpgradeSearchContext = {
    engine: { client: { tradeGenerateQuery: generate } } as unknown as EngineCallContext,
    trade,
    credentials,
    env: opts.env ?? {},
    signal: new AbortController().signal,
    deadline: Date.now() + 90_000,
    progress: async () => undefined,
    session: { revision: 0 },
  };
  return { ctx, calls: ff.calls, generate };
}

function fallbackOf(result: UpgradeSearchResult) {
  if (result.kind !== 'fallback') throw new Error(`expected a fallback, got ${result.kind}`);
  return result;
}

describe('AC-K86: find_upgrades {link_only: true} (D-494), with a faked generator', () => {
  it('makes no request and replies with at most 12 affixes in PoB\'s order, each with its gain at the middle roll and its weight per point, and the link last', async () => {
    const { ctx, calls, generate } = setup([]);
    const input = parseFindUpgradesInput({ slot: 'Body Armour', league: LEAGUE, link_only: true });
    const result = fallbackOf(await runUpgradeSearch(input, ctx));
    expect(calls).toEqual([]);
    expect(generate).toHaveBeenCalledTimes(1);
    expect(result.cause).toBe('link_only');
    expect(LINK_ONLY_RANKING).toBe(12);
    expect(result.ranking).toEqual(
      RANKED.slice(0, 12).map((r) => ({ affix: r.text, tradeId: r.tradeId, gain: r.meanStatDiff, weight: r.weight })),
    );
    expect(result.link).toBe(tradeQueryUrl(LEAGUE, GENERATED_BODY_ARMOUR_QUERY));

    const text = renderFallback(result, 'Pace: off (test setting).');
    const lines = text.split('\n');
    expect(lines[0]).toBe("Link only: PoB ranked the slot's affixes; no trade request was sent.");
    const ranking = /^Ranking \(PoB's order: gain at the middle roll, weight per point\): (.+)$/.exec(lines[1]);
    expect(ranking).not.toBeNull();
    const items = ranking![1].split('; ');
    expect(items).toHaveLength(12);
    items.forEach((item, i) => {
      const r = RANKED[i];
      expect(item).toBe(`${r.text} ${Number(r.meanStatDiff.toFixed(2))} ${Number(r.weight.toFixed(4))}`);
    });
    // The link, last; the pace line and the link's intro before it.
    expect(lines.slice(-3)).toEqual(['Pace: off (test setting).', LINK_INTRO, tradeQueryUrl(LEAGUE, GENERATED_BODY_ARMOUR_QUERY)]);
  });

  it('sends no request without a session either, takes the league from POE_LEAGUE, and with no league at all gives the ranking and says the link needs one', async () => {
    const noSession = setup([], { credentials: () => ({ sessionId: null, source: null }), env: { POE_LEAGUE: LEAGUE } });
    const a = fallbackOf(await runUpgradeSearch(parseFindUpgradesInput({ slot: 'Body Armour', link_only: true }), noSession.ctx));
    expect(noSession.calls).toEqual([]);
    expect(a.cause).toBe('link_only');
    expect(a.link).toBe(tradeQueryUrl(LEAGUE, GENERATED_BODY_ARMOUR_QUERY));

    const noLeague = setup([]);
    const b = fallbackOf(await runUpgradeSearch(parseFindUpgradesInput({ slot: 'Body Armour', link_only: true }), noLeague.ctx));
    expect(noLeague.calls).toEqual([]);
    expect(b.ranking).toHaveLength(12);
    const text = renderFallback(b);
    expect(text.split('\n').pop()).toMatch(/^No link: give league \(or set POE_LEAGUE\)/);
    expect(text).not.toContain('https://');
  });

  it('a ranking of fewer than 12 lists them all; a ranked weight without text shows its trade id', async () => {
    const { ctx } = setup([]);
    const generated = { ...clone(GENERATED), rankedWeights: [{ tradeId: LIFE, meanStatDiff: 12.5, weight: 0.25 }] };
    (ctx.engine.client as unknown as { tradeGenerateQuery: () => Promise<unknown> }).tradeGenerateQuery = async () => generated;
    const result = fallbackOf(await runUpgradeSearch(parseFindUpgradesInput({ slot: 'Body Armour', league: LEAGUE, link_only: true }), ctx));
    expect(renderFallback(result).split('\n')[1]).toBe(`Ranking (PoB's order: gain at the middle roll, weight per point): ${LIFE} 12.5 0.25`);
  });
});

describe("AC-K86: the fallback's three causes carry C-49's prefix (D-494)", () => {
  it('[trade:no_session]: no session cookie, no request sent', async () => {
    const { ctx, calls } = setup([], { credentials: () => ({ sessionId: null, source: null }) });
    const result = fallbackOf(await runUpgradeSearch(parseFindUpgradesInput({ slot: 'Body Armour', league: LEAGUE }), ctx));
    expect(calls).toEqual([]);
    expect(result.cause).toBe('no_session');
    expect(renderFallback(result)).toMatch(/^\[trade:no_session\] Trade search not run: no POESESSID set\.\n/);
  });

  it('[trade:session_rejected]: the first search answers that the session is not accepted', async () => {
    const { ctx } = setup([searchSequence([codeTwoRejection('Ip')])]);
    const result = fallbackOf(await runUpgradeSearch(parseFindUpgradesInput({ slot: 'Body Armour', league: LEAGUE }), ctx));
    expect(result.cause).toBe('session_rejected');
    expect(renderFallback(result)).toMatch(/^\[trade:session_rejected\] Trade search not run: the trade site did not accept the session cookie/);
  });

  it('[trade:too_complex] Trade search not run: <reason>. after the one retry is refused too', async () => {
    const { ctx, calls } = setup([searchSequence([codeTwoRejection('Account,Ip'), codeTwoRejection('Account,Ip')])]);
    const result = fallbackOf(await runUpgradeSearch(parseFindUpgradesInput({ slot: 'Body Armour', league: LEAGUE }), ctx));
    expect(calls.filter((c) => c.method === 'POST')).toHaveLength(2);
    expect(result.cause).toBe('too_complex');
    expect(renderFallback(result)).toMatch(/^\[trade:too_complex\] Trade search not run: the trade site still found the query too complex .*\.\n/);
  });
});

describe("AC-K86: each listing names its required affixes' tiers, from the lines' mods[].tier (D-494)", () => {
  const entry = (name: string) => FETCH_TEMPLATE.find((e) => e.item.name === name)!;

  it('reads each required line\'s tier from the committed fetch capture, a merged line naming each of its mods', () => {
    expect(tierLabel('P2')).toBe('T2');
    expect(tierLabel('S1')).toBe('T1');
    expect(tierLabel(undefined)).toBe('T?');
    // "+190 to maximum Life" is one mod (P2); "140% increased Armour and Evasion" merges two (P1, P2).
    expect(listingTiers(entry('Morbid Wrap') as never, [LIFE, ARMOUR_EVASION])).toEqual([
      '+190 to maximum Life T2',
      '140% increased Armour and Evasion T1+T2',
    ]);
    expect(listingTiers(entry('Hypnotic Curtain') as never, [LIFE])).toEqual(['+253 to maximum Life T2+T1']);
    // A required id the item has no line for says so.
    expect(listingTiers(entry('Plague Mantle') as never, [ARMOUR_EVASION])).toEqual([`${ARMOUR_EVASION} (no line)`]);
    expect(listingTiers(entry('Plague Mantle') as never, [])).toEqual([]);
  });

  it('the full listing prints them on a line of its own; the compact line before its Buy, which stays last', () => {
    const e = entry('Morbid Wrap');
    const row = {
      id: e.id,
      tradeIndex: 0,
      entry: e,
      name: 'Morbid Wrap',
      baseType: String(e.item.baseType),
      account: 'seller-1#0001',
      whisper: '@character-1 Hi',
      price: { amount: 3, currency: 'exalted' },
      weightedSum: 142.2,
      score: 1.6,
      stats: {},
      itemText: 'Rarity: Rare\nMorbid Wrap',
      isUpgrade: true,
      normalized: 3,
      divine: null,
      priceNotConverted: false,
      tiers: listingTiers(e as never, [LIFE, ARMOUR_EVASION]),
    } as unknown as ListingRow;
    const report = { league: LEAGUE, status: 'securable', baselineScore: 1.5, sort: [], reportStats: [], display: 'exalted', searchUrl: 'x' } as unknown as UpgradeReport;
    expect(fullListing(row, 1, report).split('\n')).toContain('   tiers: +190 to maximum Life T2, 140% increased Armour and Evasion T1+T2');
    expect(compactListing(row, 1, report)).toMatch(/ · tiers: \+190 to maximum Life T2, 140% increased Armour and Evasion T1\+T2 · Buy: @character-1 Hi$/);
    // Without required affixes, neither shows a tiers part.
    const plain = { ...row, tiers: [] } as ListingRow;
    expect(fullListing(plain, 1, report)).not.toContain('tiers:');
    expect(compactListing(plain, 1, report)).not.toContain('tiers:');
  });
});
