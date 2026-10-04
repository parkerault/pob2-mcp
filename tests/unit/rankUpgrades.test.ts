/**
 * Unit checks of `find_upgrades`' pure steps (C-14 steps 11–13, D-53, D-54): pricing, ranking,
 * `is_upgrade`, selection and the output budget. The ACs themselves (AC-T31, AC-T39, AC-T40) are proven
 * through the MCP tool in `tests/mcp/findUpgrades.test.ts`.
 */
import { describe, expect, it } from '@jest/globals';
import { isUpgrade, priceRows, rankRows, selectRows, NO_RATES_NOTE, type ListingRow } from '../../src/trade/rankUpgrades';
import { OUTPUT_BUDGET, renderFallback, renderUpgradeReport, type UpgradeReport } from '../../src/trade/renderUpgrades';
import type { Rates } from '../../src/trade/currency';
import type { FetchEntry } from '../../src/trade/tradeClient';

/** 1 divine = 400 exalted; 1 chaos = 160 exalted. */
const RATES: Rates = {
  league: 'L',
  primary: 'divine',
  fetchedAt: 0,
  valueInPrimary: (c) => ({ divine: 1, exalted: 1 / 400, chaos: 160 / 400 })[c] ?? null,
  nameOf: (c) => c,
  currencies: () => [],
};

function row(id: string, tradeIndex: number, score: number, price: { amount: number; currency: string } | null, extra: Partial<ListingRow> = {}): ListingRow {
  return {
    id,
    tradeIndex,
    entry: { id } as unknown as FetchEntry,
    name: `Item ${id}`,
    baseType: 'Dastard Armour',
    account: `seller-${id}`,
    whisper: null,
    price,
    weightedSum: 100,
    score,
    stats: {},
    itemText: 'Rarity: RARE\nItem\nDastard Armour',
    isUpgrade: isUpgrade(score, 1),
    normalized: null,
    divine: null,
    priceNotConverted: false,
    ...extra,
  };
}

describe('C-14 steps 11–13', () => {
  it('is_upgrade compares scores rounded to 4 decimals', () => {
    expect(isUpgrade(1.50004, 1.5)).toBe(false);
    expect(isUpgrade(1.50005, 1.5)).toBe(true);
    expect(isUpgrade(1.5, 1.5)).toBe(false);
  });

  it('prices: converts into the display currency, drops over-budget listings, keeps and flags unconvertible ones (D-11, D-54)', () => {
    const rows = [row('a', 0, 2, { amount: 1, currency: 'chaos' }), row('b', 1, 2, { amount: 200, currency: 'exalted' }), row('c', 2, 2, { amount: 1, currency: 'odd' })];
    const p = priceRows(rows, { display: 'exalted', maxPrice: 180, rates: RATES });
    expect(p.overBudget).toBe(1);
    expect(p.kept.map((r) => r.id)).toEqual(['a', 'c']);
    expect(p.kept[0].normalized).toBeCloseTo(160, 6);
    expect(p.partial).toBe(true);
    expect(p.kept[1].priceNotConverted).toBe(true);
  });

  it('prices: an amount exactly at the budget is within it', () => {
    const p = priceRows([row('a', 0, 2, { amount: 200, currency: 'exalted' })], { display: 'exalted', maxPrice: 200, rates: RATES });
    expect(p.overBudget).toBe(0);
  });

  it('prices: without rates nothing is post-filtered, and the note says so', () => {
    const p = priceRows([row('a', 0, 2, { amount: 999, currency: 'divine' })], { display: 'exalted', maxPrice: 1, rates: null });
    expect(p.kept).toHaveLength(1);
    expect(p.overBudget).toBe(0);
    expect(p.notes).toEqual([NO_RATES_NOTE]);
  });

  it('rank: every mode, with ties broken by listing id; price modes fall back when the conversion is partial', () => {
    const rows = [row('b', 0, 2, { amount: 1, currency: 'divine' }), row('a', 1, 2, { amount: 10, currency: 'exalted' }), row('c', 2, 3, { amount: 1, currency: 'chaos' })];
    const p = priceRows(rows, { display: 'exalted', rates: RATES });
    expect(rankRows(p.kept, 'stat_value', p).ordered.map((r) => r.id)).toEqual(['c', 'a', 'b']);
    expect(rankRows(p.kept, 'price', p).ordered.map((r) => r.id)).toEqual(['a', 'c', 'b']);
    expect(rankRows(p.kept, 'trade_weight', p).ordered.map((r) => r.id)).toEqual(['b', 'a', 'c']);
    // score − 0.1·log10(divine): b 2 − 0 = 2; a 2 − 0.1·log10(0.025) ≈ 2.16; c 3 − 0.1·log10(0.4) ≈ 3.04
    expect(rankRows(p.kept, 'stat_value_per_price', p).ordered.map((r) => r.id)).toEqual(['c', 'a', 'b']);

    const partial = priceRows([...rows.map((r) => ({ ...r })), row('d', 3, 9, { amount: 1, currency: 'odd' })], { display: 'exalted', rates: RATES });
    const r = rankRows(partial.kept, 'price', partial);
    expect(r.rankedBy).toBe('stat_value');
    expect(r.note).toBe('rank_by "price" fell back to "stat_value": some prices could not be converted.');
    expect(r.ordered[0].id).toBe('d');
  });

  it('select: upgrades only by default; with include_non_upgrades the top `limit` regardless', () => {
    const rows = [row('a', 0, 3, null), row('b', 1, 0.5, null), row('c', 2, 2, null)];
    expect(selectRows(rows, 10, false).map((r) => r.id)).toEqual(['a', 'c']);
    expect(selectRows(rows, 2, true).map((r) => r.id)).toEqual(['a', 'b']);
  });
});

describe('D-53: the output budget', () => {
  function report(n: number, itemLines: number): UpgradeReport {
    const listings = Array.from({ length: n }, (_, i) =>
      row(`id${i}`, i, 2, { amount: 1, currency: 'exalted' }, { itemText: Array.from({ length: itemLines }, (_, k) => `line ${k} ${'x'.repeat(60)}`).join('\n') }),
    );
    return {
      slot: 'Body Armour',
      build: { displayName: 'b', path: 'b.xml' },
      league: 'Forbidden Rites',
      status: 'securable',
      budget: null,
      sort: [{ stat: 'FullDPS', label: 'Full DPS', weight: 1 }],
      reportStats: [],
      notices: [],
      currentItem: 'empty',
      baselineScore: 1,
      counts: { searches: 1, total: n, fetched: n, unavailable: 0, evaluated: n, rejected: 0, overBudget: 0, upgrades: n },
      listings,
      display: 'exalted',
      query: { query: { stats: [{ type: 'weight', filters: [] }] } },
      closing: null,
      searchUrl: 'https://www.pathofexile.com/trade2/search/poe2/Forbidden%20Rites/abc',
    };
  }

  it('renders everything in full when it fits', () => {
    const text = renderUpgradeReport(report(3, 5));
    expect(text).not.toMatch(/shown compactly/);
    expect((text.match(/^ {3}Item text:$/gm) ?? []).length).toBe(3);
    expect(text.split('\n').pop()).toBe('Search on the trade site: https://www.pathofexile.com/trade2/search/poe2/Forbidden%20Rites/abc');
  });

  it('compacts the listings past the budget, keeping the output within it', () => {
    const text = renderUpgradeReport(report(20, 60));
    expect(text.length).toBeLessThanOrEqual(OUTPUT_BUDGET);
    const full = (text.match(/^ {3}Item text:$/gm) ?? []).length;
    expect(full).toBeGreaterThan(0);
    expect(full).toBeLessThan(20);
    expect((text.match(/· seller seller-id\d+$/gm) ?? []).length).toBe(20 - full);
    expect(text).toContain(`${20 - full} listings are shown compactly`);
  });

  it('a fallback starts with "Trade search not run:" and ends with the link', () => {
    const text = renderFallback({ reason: 'no POESESSID set', hint: 'Set it.', link: 'https://x/y?q=1', notes: [] });
    expect(text).toBe(
      'Trade search not run: no POESESSID set.\nSet it.\nOpen this search in a browser where you are logged in to pathofexile.com:\nhttps://x/y?q=1',
    );
  });
});
