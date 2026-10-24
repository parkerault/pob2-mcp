/**
 * AC-K67 (amendment 5, WU-74, D-372): `find_upgrades` prices a rung of a compiled plan. After a measure-only
 * `compile_plan` of a three-rung plan (`m`, `b`, `n`) and a `manage_sets` loadout select of `b`, `find_upgrades` on
 * a rare slot with two `required_mods` and a `max_price` sends a trade query with an `and` stat group holding those
 * two, a `weight` group and `query.filters.trade_filters.filters.price.max`, and scores the listings against `b`'s
 * item in that slot, not `n`'s.
 *
 * In process and engine-required: the real SDK `Client`, router, handlers, engine session and PoB (real luajit and
 * the pinned checkout), over private builds, state and guides folders (`startSessionFixture`). Every trade2 and
 * poe.ninja request is served by `fixtureFetch` (D-34); the session cookie is a sentinel.
 *
 * The plan is the committed two-stage fixture (two campaign stages) with the three rungs added, each with its own
 * rare Ring 1: `b`'s and `n`'s differ, `n`'s is the stronger. The search answers with two listings that are exactly
 * `b`'s ring and `n`'s ring: each carries its PoB item text (the bridge's additive `itemText` form,
 * `pob-api/API/Trade.lua` `parseFetchEntry`), so the listing that is the slot's own item is scored by PoB with no
 * difference from it. The oracle is PoB's: the listing identical to the active loadout's ring scores the baseline
 * exactly, and the other one does not.
 */
import fs from 'fs';
import path from 'path';
import { afterAll, beforeAll, expect, it } from '@jest/globals';
import { engineDescribe } from '../helpers/engine';
import { startSessionFixture, type SessionFixture } from '../helpers/engineSession';
import { fixtureFetch, type RecordedCall } from '../helpers/fixtureFetch';
import {
  DATA_ROUTES,
  FETCH_HEADERS,
  SEARCH_HEADERS,
  fetchRoute,
  readTrade2,
  searchBody,
  searchSequence,
  syntheticId,
  type FetchListing,
} from '../helpers/tradeFixtures';
import type { Credentials } from '../../src/trade/credentials';

const REPO = path.resolve(__dirname, '..', '..');
const FIXTURE = path.join(REPO, 'tests', 'fixtures', 'plans', 'two-stage', 'plan.json');
const ENGINE_TIMEOUT = 300_000;
const SENTINEL = 'SENTINEL7f3a';
const LEAGUE = 'Forbidden Rites';

/** Trade stat ids (`/data/stats` fixture): `# to maximum Life` and `#% to Fire Resistance`. */
const LIFE = 'explicit.stat_3299347043';
const FIRE = 'explicit.stat_3372524247';
const REQUIRED = [
  { trade_id: LIFE, min: 30 },
  { trade_id: FIRE, min: 15 },
];
const MAX_PRICE = 50;

/**
 * Each ring with its base's implicit written out (Iron Ring's "Adds 1 to 4 Physical Damage to Attacks",
 * `Data/Bases/ring.lua`), as a listing carries it: a bare base's text would get it from the compile (D-435) but not
 * from the listing's own text, and the two would no longer be the same item.
 */
const IRON_RING_IMPLICIT = 'Implicits: 1\nAdds 1 to 4 Physical Damage to Attacks';
const RING = {
  m: `Rarity: Rare\nDull Hoop\nIron Ring\n${IRON_RING_IMPLICIT}\n+10 to maximum Life`,
  b: `Rarity: Rare\nBlood Loop\nIron Ring\n${IRON_RING_IMPLICIT}\n+40 to maximum Life\n+20% to Fire Resistance`,
  n: `Rarity: Rare\nStorm Loop\nIron Ring\n${IRON_RING_IMPLICIT}\n+90 to maximum Life\n+40% to Fire Resistance`,
} as const;
const ID_B = syntheticId('ac-k67:b-ring');
const ID_N = syntheticId('ac-k67:n-ring');

type Json = Record<string, any>;
const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;
const judgment = (ref: string) => ({ kind: 'judgment', ref, confidence: 'L' });

const NINJA = readTrade2<unknown>('../poeninja/currency-overview.response.json');
const RING_TEMPLATE = readTrade2<{ result: FetchListing[] }>('fetch-ring-divine.response.json').result[0];

/** A rung: stage 2's content at `level` on rung `variant`, with its own rare Ring 1 (compileMeasures' recipe). */
function rung(plan: Json, id: 'm' | 'b' | 'n', variant: string, level: number): Json {
  const s = clone(plan.stages[1]);
  const name = { 'entering-maps': 'Entering maps', budget: 'Budget', 'non-budget': 'Non-budget' }[variant];
  Object.assign(s, {
    id,
    loadoutName: `${name} ${id} (L${level}) {${id}}`,
    level,
    progress: 'endgame',
    variant,
    ascendancyPoints: 0,
    variantBasis: { level: judgment('test level'), gemLevels: judgment('test gem levels'), ascendancyPoints: judgment('test points') },
  });
  s.claims = [];
  s.items.setTitle = `${name} gear`;
  s.items.slots.push({ slot: 'Ring 1', text: RING[id] });
  return s;
}

/** The two-stage fixture plus the rungs `m`, `b` and `n`. */
function threeRungPlan(): Json {
  const plan = JSON.parse(fs.readFileSync(FIXTURE, 'utf8')) as Json;
  plan.stages.push(rung(plan, 'm', 'entering-maps', 70), rung(plan, 'b', 'budget', 80), rung(plan, 'n', 'non-budget', 90));
  return plan;
}

/** A fetched listing that is exactly `text`'s item, priced at `amount` exalted. */
function ringListing(id: string, text: string, amount: number): FetchListing {
  const e = clone(RING_TEMPLATE);
  const name = text.split('\n')[1];
  e.id = id;
  Object.assign(e.item, { id, name, typeLine: 'Iron Ring', baseType: 'Iron Ring' });
  e.listing.price = { type: '~price', amount, currency: 'exalted' };
  delete e.listing.whisper;
  return { ...e, itemText: text } as FetchListing;
}

interface Shown {
  title: string;
  score: number;
  baseline: number;
  upgrade: boolean;
}

/** The full listings an output shows, in order. */
function listings(text: string): Shown[] {
  const lines = text.split('\n');
  const out: Shown[] = [];
  lines.forEach((line, i) => {
    const head = /^\d+\. (.+?): .+ · (UPGRADE|not an upgrade)$/.exec(line);
    if (!head) return;
    const score = /^ {3}Score (-?[\d.]+) vs (-?[\d.]+)/.exec(lines[i + 1] ?? '');
    if (!score) throw new Error(`full listing without a Score line: ${line}`);
    out.push({ title: head[1], score: Number(score[1]), baseline: Number(score[2]), upgrade: head[2] === 'UPGRADE' });
  });
  return out;
}

const searchCalls = (calls: RecordedCall[]) => calls.filter((c) => /\/api\/trade2\/search\//.test(c.url));

engineDescribe('AC-K67 (amendment 5, WU-74, D-372): find_upgrades on a compiled plan\'s rung prices against the selected loadout', () => {
  let fx: SessionFixture;
  let http = fixtureFetch([]);
  const creds: Credentials = { sessionId: SENTINEL, source: 'dotenv' };

  /** Serve one find_upgrades call: one search answering with b's and n's rings, their fetch, `/data/*` and poe.ninja. */
  function serve(searchId: string): void {
    http = fixtureFetch([
      searchSequence([{ status: 200, headers: SEARCH_HEADERS, body: searchBody(searchId, 50, [ID_B, ID_N]) }]),
      fetchRoute({
        headers: FETCH_HEADERS,
        entryFor: (id) => (id === ID_B ? ringListing(ID_B, RING.b, 10) : id === ID_N ? ringListing(ID_N, RING.n, 20) : null),
      }),
      ...DATA_ROUTES,
      {
        match: /^https:\/\/poe\.ninja\//,
        respond: () => new Response(JSON.stringify(NINJA), { status: 200, headers: { 'content-type': 'application/json' } }),
      },
    ]);
  }

  const findArgs = {
    slot: 'Ring 1',
    required_mods: REQUIRED,
    max_price: MAX_PRICE,
    rank_by: 'stat_value',
    include_non_upgrades: true,
    fetch_pages: 1,
  };

  async function selectLoadout(id: 'b' | 'n'): Promise<void> {
    const title = threeRungPlan().stages.find((s: Json) => s.id === id).loadoutName;
    const out = await fx.call('manage_sets', { set_type: 'loadout', action: 'select', title });
    expect({ isError: out.isError, text: out.isError ? out.text : '' }).toEqual({ isError: false, text: '' });
  }

  let compiled: { isError: boolean; text: string };
  let onB: { isError: boolean; text: string };
  let bSearch: Json;
  let onN: { isError: boolean; text: string };

  beforeAll(async () => {
    fx = await startSessionFixture({
      deps: {
        fetch: ((input: Parameters<typeof fetch>[0], init?: RequestInit) => http.fetch(input, init)) as typeof fetch,
        credentials: () => creds,
        env: { POE_TRADE_DISABLED: undefined, POE_NINJA_DISABLED: undefined, POE_LEAGUE: LEAGUE },
      },
    });
    const run = await fx.call('guide_run', { new_run: 'ac-k67' });
    if (run.isError) throw new Error(`guide_run failed: ${run.text}`);
    const planPath = /^plan_path for this run: (\S+)$/m.exec(run.text)![1];
    fs.writeFileSync(path.join(fx.guides, planPath), `${JSON.stringify(threeRungPlan(), null, 2)}\n`);
    compiled = await fx.call('compile_plan', { plan_path: planPath, measure_only: true });
    if (compiled.isError) return;

    await selectLoadout('b');
    serve('ack67b');
    onB = await fx.call('find_upgrades', findArgs);
    const sent = searchCalls(http.calls);
    bSearch = sent.length > 0 ? (JSON.parse(sent[0].body as string) as Json) : {};

    // The control: the same call with n's loadout selected.
    await selectLoadout('n');
    serve('ack67n');
    onN = await fx.call('find_upgrades', findArgs);
  }, ENGINE_TIMEOUT);

  afterAll(async () => fx?.close(), 60_000);

  it("AC-K67: the measure-only compile of the three-rung plan succeeds and leaves n's loadout active, so b's select is what changes the slot", () => {
    expect({ isError: compiled.isError, text: compiled.isError ? compiled.text : '' }).toEqual({ isError: false, text: '' });
    expect(compiled.text).toMatch(/\(measure-only\)/);
    for (const id of ['m', 'b', 'n']) expect(compiled.text).toMatch(new RegExp(`^Stage ${id} ".*\\{${id}\\}" level \\d+:`, 'm'));
    expect(compiled.text).toContain('with loadout "Non-budget n (L90) {n}" active');
  });

  it('AC-K67: with b selected, the trade query has an and group of the two required mods, a weight group and trade_filters.price.max', () => {
    expect(onB.isError).toBe(false);
    const stats = bSearch.query.stats as Array<{ type: string; filters: Array<{ id: string; value: Record<string, number> }> }>;
    const and = stats.filter((g) => g.type === 'and');
    expect(and).toHaveLength(1);
    expect(and[0].filters).toEqual(expect.arrayContaining(REQUIRED.map((r) => ({ id: r.trade_id, value: { min: r.min } }))));
    expect(and[0].filters).toHaveLength(2);
    const weight = stats.filter((g) => g.type === 'weight');
    expect(weight).toHaveLength(1);
    expect(weight[0].filters.length).toBeGreaterThan(0);
    for (const f of weight[0].filters) expect(typeof f.value.weight).toBe('number');
    expect(bSearch.query.filters.trade_filters.filters.price.max).toBe(MAX_PRICE);
  });

  it("AC-K67: with b selected, listings are scored against b's Ring 1: b's own ring scores the baseline exactly, n's stronger ring is an upgrade", () => {
    expect(onB.text).toMatch(/^Current item: Blood Loop\b.* · Baseline score -?\d+\.\d{4}$/m);
    const shown = listings(onB.text);
    expect(shown.map((s) => s.title).sort()).toEqual(['Blood Loop, Iron Ring', 'Storm Loop, Iron Ring']);
    const own = shown.find((s) => s.title.startsWith('Blood Loop'))!;
    const other = shown.find((s) => s.title.startsWith('Storm Loop'))!;
    expect(own.score).toBe(own.baseline);
    expect(own.upgrade).toBe(false);
    expect(other.score).toBeGreaterThan(other.baseline);
    expect(other.upgrade).toBe(true);
  });

  it("AC-K67 (control): with n selected instead, the same listings are scored against n's ring, so the scores b's select gave were not n's", () => {
    expect(onN.isError).toBe(false);
    expect(onN.text).toMatch(/^Current item: Storm Loop\b/m);
    const shown = listings(onN.text);
    const bRing = shown.find((s) => s.title.startsWith('Blood Loop'))!;
    const nRing = shown.find((s) => s.title.startsWith('Storm Loop'))!;
    expect(nRing.score).toBe(nRing.baseline);
    expect(bRing.score).toBeLessThan(bRing.baseline);
    expect(bRing.upgrade).toBe(false);
  });
});
