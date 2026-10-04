/**
 * The poe.ninja HTTP client (WU-15), on the committed fixture: it keeps only the HTTP for the
 * currency overview (C-12 does the conversion). HTTP via `fixtureFetch`.
 */
import { describe, it, expect } from '@jest/globals';
import { PoeNinjaClient } from '../../src/services/poeNinjaClient';
import { fixtureFetch } from '../helpers/fixtureFetch';

const NINJA = /^https:\/\/poe\.ninja\//;
const UA = 'pob2-mcp-server/test';

describe('PoeNinjaClient (WU-15): currency overview over HTTP', () => {
  it('GETs the PoE2 exchange overview for the league with the given User-Agent', async () => {
    const ff = fixtureFetch([{ match: NINJA, respond: { fixture: 'poeninja/currency-overview' } }]);
    const client = new PoeNinjaClient({ fetch: ff.fetch, userAgent: UA });
    const result = await client.currencyOverview('Runes of Aldur');
    expect(ff.calls).toHaveLength(1);
    expect(ff.calls[0]).toMatchObject({
      method: 'GET',
      url: 'https://poe.ninja/poe2/api/economy/exchange/current/overview?league=Runes%20of%20Aldur&type=Currency',
    });
    expect(ff.calls[0].headers['user-agent']).toBe(UA);
    expect(ff.calls[0].headers['if-none-match']).toBeUndefined();
    expect(result.status).toBe('ok');
    if (result.status !== 'ok') throw new Error('unreachable');
    expect(result.body.core?.primary).toBe('divine');
    expect(result.body.core?.rates).toEqual({ exalted: 440.6, chaos: 2.7 });
    expect(result.body.lines).toHaveLength(47);
    expect(result.etag).toBeNull();
  });

  it('sends If-None-Match when given an ETag and reports a 304 as not_modified', async () => {
    const ff = fixtureFetch([{ match: NINJA, respond: { status: 304 } }]);
    const client = new PoeNinjaClient({ fetch: ff.fetch, userAgent: UA });
    await expect(client.currencyOverview('Standard', '"abc"')).resolves.toEqual({ status: 'not_modified' });
    expect(ff.calls[0].headers['if-none-match']).toBe('"abc"');
  });

  it('returns the response ETag', async () => {
    const ff = fixtureFetch([{ match: NINJA, respond: { status: 200, headers: { etag: 'W/"x1"' }, body: { core: { primary: 'divine' } } } }]);
    const client = new PoeNinjaClient({ fetch: ff.fetch, userAgent: UA });
    const result = await client.currencyOverview('Standard');
    expect(result).toMatchObject({ status: 'ok', etag: 'W/"x1"' });
  });

  it('throws on a non-2xx and on a transport failure, without echoing the transport message', async () => {
    const bad = fixtureFetch([{ match: NINJA, respond: { status: 503, body: 'down' } }]);
    await expect(new PoeNinjaClient({ fetch: bad.fetch, userAgent: UA }).currencyOverview('Standard')).rejects.toThrow(
      'poe.ninja returned HTTP 503',
    );
    const broken = fixtureFetch([
      {
        match: NINJA,
        respond: () => {
          throw new TypeError('fetch failed: secret-header-value');
        },
      },
    ]);
    const err = await new PoeNinjaClient({ fetch: broken.fetch, userAgent: UA })
      .currencyOverview('Standard')
      .catch((e: Error) => e);
    expect((err as Error).message).toBe('network error contacting poe.ninja');
  });
});
