/**
 * AC-T13 (WU-14, D-20): the default-league resolver. Unit; the league list comes from the
 * committed `trade2/data-leagues` fixture through the real trade client over `fixtureFetch`.
 */
import { describe, it, expect } from '@jest/globals';
import { resolveDefaultLeague } from '../../src/trade/league';
import { TradeApiClient } from '../../src/trade/tradeClient';
import { RateLimiter } from '../../src/trade/rateLimiter';
import { fixtureFetch, type FixtureRoute } from '../helpers/fixtureFetch';

function clientFor(routes: FixtureRoute[]) {
  const ff = fixtureFetch(routes);
  const client = new TradeApiClient({
    fetch: ff.fetch,
    credentials: () => ({ sessionId: null, source: null }),
    limiter: new RateLimiter(),
    userAgent: 'pob2-mcp-server/test',
  });
  return { client, calls: ff.calls };
}

const leaguesBody = (ids: string[]) => ({ result: ids.map((id) => ({ id, realm: 'poe2', text: id })) });

describe('AC-T13 (WU-14, D-20): default league', () => {
  it('AC-T13: on the data-leagues fixture with POE_LEAGUE unset, it returns Forbidden Rites', async () => {
    const { client, calls } = clientFor([{ match: /\/data\/leagues$/, respond: { fixture: 'trade2/data-leagues' } }]);
    await expect(resolveDefaultLeague({}, client)).resolves.toBe('Forbidden Rites');
    expect(calls.map((c) => c.url)).toEqual(['https://www.pathofexile.com/api/trade2/data/leagues']);
  });

  it('AC-T13: with POE_LEAGUE=Runes of Aldur it returns that, with no request', async () => {
    const { client, calls } = clientFor([{ match: /./, respond: { fixture: 'trade2/data-leagues' } }]);
    await expect(resolveDefaultLeague({ POE_LEAGUE: 'Runes of Aldur' }, client)).resolves.toBe('Runes of Aldur');
    expect(calls).toHaveLength(0);
  });

  it('AC-T13: a blank POE_LEAGUE counts as unset', async () => {
    const { client } = clientFor([{ match: /\/data\/leagues$/, respond: { fixture: 'trade2/data-leagues' } }]);
    await expect(resolveDefaultLeague({ POE_LEAGUE: '  ' }, client)).resolves.toBe('Forbidden Rites');
  });

  it('AC-T13: on a list starting HC Forbidden Rites, Standard, Runes of Aldur it returns Runes of Aldur', async () => {
    const { client } = clientFor([
      {
        match: /\/data\/leagues$/,
        respond: { status: 200, body: leaguesBody(['HC Forbidden Rites', 'Standard', 'Runes of Aldur', 'Forbidden Rites']) },
      },
    ]);
    await expect(resolveDefaultLeague({}, client)).resolves.toBe('Runes of Aldur');
  });

  it('AC-T13: on a list of only Standard, Hardcore it throws "no current league; set POE_LEAGUE"', async () => {
    const { client } = clientFor([{ match: /\/data\/leagues$/, respond: { status: 200, body: leaguesBody(['Standard', 'Hardcore']) } }]);
    await expect(resolveDefaultLeague({}, client)).rejects.toThrow('no current league; set POE_LEAGUE');
  });
});
