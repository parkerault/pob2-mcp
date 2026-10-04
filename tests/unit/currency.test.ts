/**
 * C-12 currency service (WU-15).
 *
 * - AC-T15: rates parsed from the committed poe.ninja fixture, with the primary read from the
 *   response (D-33), and a synthesized Exalted-primary response.
 * - AC-T16: 60-minute cache with `If-None-Match` revalidation, failures → null (logged), and
 *   `POE_NINJA_DISABLED=true` → null without a request. Fake clock (`now`); HTTP via `fixtureFetch`.
 */
import fs from 'fs';
import path from 'path';
import { describe, it, expect, jest, afterEach } from '@jest/globals';
import { CurrencyService, RATES_TTL_MS, convert, parseRates, type Rates } from '../../src/trade/currency';
import { fixtureFetch } from '../helpers/fixtureFetch';

const OVERVIEW = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, '..', 'fixtures', 'poeninja', 'currency-overview.response.json'), 'utf8'),
) as { core: { primary: string; rates: Record<string, number> }; lines: Array<{ id: string; primaryValue: number }> };

const UA = 'pob2-mcp-server/test';
const NINJA = /^https:\/\/poe\.ninja\/poe2\/api\/economy\/exchange\/current\/overview\?/;

afterEach(() => {
  jest.restoreAllMocks();
});

async function fixtureRates(): Promise<Rates> {
  const ff = fixtureFetch([{ match: NINJA, respond: { fixture: 'poeninja/currency-overview' } }]);
  const svc = new CurrencyService({ fetch: ff.fetch, userAgent: UA, env: {}, now: () => 1_000 });
  const rates = await svc.getRates('Runes of Aldur');
  expect(rates).not.toBeNull();
  expect(ff.calls).toHaveLength(1);
  expect(ff.calls[0].url).toBe(
    'https://poe.ninja/poe2/api/economy/exchange/current/overview?league=Runes%20of%20Aldur&type=Currency',
  );
  expect(ff.calls[0].headers['user-agent']).toBe(UA);
  return rates as Rates;
}

describe('AC-T15 (WU-15, C-12): rates and conversion on the poe.ninja fixture', () => {
  it('AC-T15: primary is read from core.primary ("divine") and valueInPrimary(primary) is 1', async () => {
    const rates = await fixtureRates();
    expect(rates.primary).toBe('divine');
    expect(rates.valueInPrimary('divine')).toBe(1);
    expect(rates.league).toBe('Runes of Aldur');
    expect(rates.nameOf('divine')).toBe('Divine Orb');
  });

  it('AC-T15: conversions through core.rates', async () => {
    const rates = await fixtureRates();
    expect(convert(1, 'divine', 'exalted', rates)).toBeCloseTo(440.6, 9);
    expect(convert(2, 'chaos', 'exalted', rates)).toBeCloseTo(326.37, 2);
    expect(convert(1, 'exalted', 'chaos', rates)).toBeCloseTo(0.006128, 5);
  });

  it('AC-T15: an id present only in lines[] converts via primaryValue', async () => {
    const rates = await fixtureRates();
    expect(Object.keys(OVERVIEW.core.rates)).not.toContain('mirror');
    const mirror = OVERVIEW.lines.find((l) => l.id === 'mirror')!;
    expect(rates.valueInPrimary('mirror')).toBe(mirror.primaryValue);
    expect(convert(2, 'mirror', 'divine', rates)).toBeCloseTo(2 * mirror.primaryValue, 9);
    expect(convert(1, 'mirror', 'exalted', rates)).toBeCloseTo(mirror.primaryValue * 440.6, 6);
  });

  it('AC-T15: an unknown id gives null', async () => {
    const rates = await fixtureRates();
    expect(rates.valueInPrimary('no-such-currency')).toBeNull();
    expect(convert(1, 'no-such-currency', 'divine', rates)).toBeNull();
    expect(convert(1, 'divine', 'no-such-currency', rates)).toBeNull();
  });

  it('AC-T15: a synthesized Exalted-primary response converts correctly (no hard-coded divine)', async () => {
    const body = {
      core: {
        items: [
          { id: 'exalted', name: 'Exalted Orb' },
          { id: 'divine', name: 'Divine Orb' },
        ],
        rates: { divine: 0.00227 },
        primary: 'exalted',
        secondary: 'divine',
      },
      lines: [{ id: 'chaos', primaryValue: 163.2 }],
      items: [],
    };
    const ff = fixtureFetch([{ match: NINJA, respond: { status: 200, body } }]);
    const svc = new CurrencyService({ fetch: ff.fetch, userAgent: UA, env: {}, now: () => 0 });
    const rates = (await svc.getRates('Standard')) as Rates;
    expect(rates.primary).toBe('exalted');
    expect(rates.valueInPrimary('exalted')).toBe(1);
    expect(rates.valueInPrimary('divine')).toBeCloseTo(1 / 0.00227, 9);
    expect(convert(1, 'divine', 'exalted', rates)).toBeCloseTo(440.528634, 5);
    expect(convert(440.528634, 'exalted', 'divine', rates)).toBeCloseTo(1, 6);
    expect(convert(1, 'chaos', 'divine', rates)).toBeCloseTo(163.2 * 0.00227, 9);
  });

  it('AC-T15: parseRates rejects a response without core.primary', () => {
    expect(parseRates('Standard', { lines: [] }, 0)).toBeNull();
  });
});

describe('AC-T16 (WU-15, C-12): caching, revalidation and failure', () => {
  it('AC-T16: a second getRates within 60 min sends no request', async () => {
    let t = 0;
    const ff = fixtureFetch([{ match: NINJA, respond: { fixture: 'poeninja/currency-overview' } }]);
    const svc = new CurrencyService({ fetch: ff.fetch, userAgent: UA, env: {}, now: () => t });
    const first = await svc.getRates('Runes of Aldur');
    t = RATES_TTL_MS - 1;
    const second = await svc.getRates('Runes of Aldur');
    expect(second).toBe(first);
    expect(ff.calls).toHaveLength(1);
    // The cache is per league.
    await svc.getRates('Standard');
    expect(ff.calls).toHaveLength(2);
  });

  it('AC-T16: after 60 min it sends If-None-Match with the stored ETag, and a 304 renews the cache', async () => {
    let t = 0;
    let served = 0;
    const ff = fixtureFetch([
      {
        match: NINJA,
        respond: (_url, init) => {
          served++;
          const inm = new Headers(init?.headers).get('if-none-match');
          if (inm === '"v1"') return new Response(null, { status: 304, headers: { etag: '"v1"' } });
          return new Response(JSON.stringify(OVERVIEW), {
            status: 200,
            headers: { 'content-type': 'application/json', etag: '"v1"' },
          });
        },
      },
    ]);
    const svc = new CurrencyService({ fetch: ff.fetch, userAgent: UA, env: {}, now: () => t });
    const first = (await svc.getRates('Runes of Aldur')) as Rates;
    expect(ff.calls[0].headers['if-none-match']).toBeUndefined();
    expect(first.fetchedAt).toBe(0);

    t = RATES_TTL_MS;
    const renewed = (await svc.getRates('Runes of Aldur')) as Rates;
    expect(ff.calls).toHaveLength(2);
    expect(ff.calls[1].headers['if-none-match']).toBe('"v1"');
    expect(served).toBe(2);
    expect(renewed.fetchedAt).toBe(RATES_TTL_MS);
    expect(renewed.primary).toBe('divine');
    expect(convert(1, 'divine', 'exalted', renewed)).toBeCloseTo(440.6, 9);

    // Renewed: no request until 60 min after the 304.
    t = 2 * RATES_TTL_MS - 1;
    await svc.getRates('Runes of Aldur');
    expect(ff.calls).toHaveLength(2);
    t = 2 * RATES_TTL_MS;
    await svc.getRates('Runes of Aldur');
    expect(ff.calls).toHaveLength(3);
    expect(ff.calls[2].headers['if-none-match']).toBe('"v1"');
  });

  it('AC-T16: a 500 gives null and is logged to stderr', async () => {
    const log = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const ff = fixtureFetch([{ match: NINJA, respond: { status: 500, body: 'oops' } }]);
    const svc = new CurrencyService({ fetch: ff.fetch, userAgent: UA, env: {}, now: () => 0 });
    await expect(svc.getRates('Runes of Aldur')).resolves.toBeNull();
    expect(ff.calls).toHaveLength(1);
    expect(log).toHaveBeenCalledWith(expect.stringMatching(/^\[CurrencyService\] .*HTTP 500/));
  });

  it('AC-T16: a network error gives null and is logged', async () => {
    const log = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const ff = fixtureFetch([
      {
        match: NINJA,
        respond: () => {
          throw new TypeError('fetch failed');
        },
      },
    ]);
    const svc = new CurrencyService({ fetch: ff.fetch, userAgent: UA, env: {}, now: () => 0 });
    await expect(svc.getRates('Runes of Aldur')).resolves.toBeNull();
    expect(log).toHaveBeenCalledWith(expect.stringMatching(/^\[CurrencyService\] /));
  });

  it('AC-T16: POE_NINJA_DISABLED=true gives null with no request', async () => {
    const ff = fixtureFetch([{ match: NINJA, respond: { fixture: 'poeninja/currency-overview' } }]);
    const svc = new CurrencyService({ fetch: ff.fetch, userAgent: UA, env: { POE_NINJA_DISABLED: 'true' }, now: () => 0 });
    await expect(svc.getRates('Runes of Aldur')).resolves.toBeNull();
    expect(ff.calls).toHaveLength(0);
  });
});
