/**
 * AC-W155 (WU-163, D-520, C-64; amendment 16 §16, Appendix A.10): the fixture pricing runs, online through `fixtureFetch`
 * and offline, pass the run checker.
 *
 * In process and engine-required: the real SDK `Client`, router, handlers, engine session and PoB (real luajit and the
 * pinned checkout), over private builds, state and guides folders (`startSessionFixture`). Every trade2 and poe.ninja
 * request is served by `fixtureFetch` from the committed fixtures (D-34; `tests/fixtures/trade2/`,
 * `tests/fixtures/poeninja/`), the session cookie a sentinel; nothing reaches pathofexile.com or poe.ninja.
 *
 * The test is `/pob2:pricing`'s runner (`skills/pricing/SKILL.md`) and its price step
 * (`skills/pricing/references/stages/price.md`) on the hand-written `tests/fixtures/builds/pricing-character.xml`, its
 * three items owned: `pob2-run-log init`, `plan_from_build`'s two calls, the measure-only compile with `measure_as`, the
 * loadout select, the league (`get_leagues` lists the file's), the rates (`get_currency_rates`), each owned rare's ranking
 * (`find_upgrades {link_only}`, no request) and depth check (`search_trade_items`, the 5th cheapest of at least 10), the
 * unique by name and the rune from poe.ninja's exchange (`get_item_price`), and one capped `find_upgrades` a gear slot;
 * then plan.json's prices and place, prices.md and upgrades.json from those replies, the steps logged, the checker run.
 * Without a cookie, the same calls give each slot its link alone. Offline, no price tool runs and the rung is the
 * player's word.
 */
import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import { afterAll, beforeAll, expect, it } from '@jest/globals';
import { engineDescribe } from '../helpers/engine';
import { startSessionFixture, type SessionFixture, type ToolOutcome } from '../helpers/engineSession';
import { fixtureFetch, type RecordedCall } from '../helpers/fixtureFetch';
import { DATA_ROUTES, FETCH_HEADERS, SEARCH_HEADERS, deriveListing, fetchRoute, readTrade2, searchBody, syntheticIds, type FetchListing } from '../helpers/tradeFixtures';
import { TEST_NOW } from '../helpers/runningDigests';
import type { Credentials } from '../../src/trade/credentials';
import { TRADE_SEARCH_PACE } from '../../src/trade/rateLimiter';

type Json = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

const REPO = path.resolve(__dirname, '..', '..');
const SCRIPTS = path.join(REPO, 'skills', 'build-guide', 'scripts');
const SOURCE = path.join(REPO, 'tests', 'fixtures', 'builds', 'pricing-character.xml');
const NAME = 'Pricing Character';
const ENGINE_TIMEOUT = 600_000;
const SENTINEL = 'SENTINEL5e2c';
const LEAGUE = 'Forbidden Rites';
const BUDGET = 50;

const LIFE = 'explicit.stat_3299347043';
const COLD = 'explicit.stat_4220027924';
const FIRE = 'explicit.stat_3372524247';
const LIGHTNING = 'explicit.stat_1671376347';
const SPEED = 'explicit.stat_2250533757';
/**
 * The owned rares' lines with their trade ids, and their tiers as the pin's data gives them (`Data/ModItem.lua`, T1 the
 * best the base can roll at item level 82): each must-have required at the lowest roll of the tier its value falls in.
 */
const RARES = {
  Helmet: {
    base: 'Soldier Greathelm',
    lines: [
      { affix: '# to maximum Life', tradeId: LIFE, tier: 6, min: 60 },
      { affix: '#% to Cold Resistance', tradeId: COLD, tier: 3, min: 31 },
      { affix: '#% to Fire Resistance', tradeId: FIRE, tier: 4, min: 26 },
    ],
  },
  Boots: {
    base: 'Lizardscale Boots',
    lines: [
      { affix: '#% increased Movement Speed', tradeId: SPEED, tier: 2, min: 30 },
      { affix: '# to maximum Life', tradeId: LIFE, tier: 4, min: 70 },
      { affix: '#% to Lightning Resistance', tradeId: LIGHTNING, tier: 4, min: 26 },
    ],
  },
} as const;
const GEAR = ['Helmet', 'Boots', 'Amulet'];

const RING_TEMPLATE = readTrade2<{ result: FetchListing[] }>('fetch-ring-divine.response.json').result[0];
/** A fetched listing that is exactly `text`'s helmet, priced at `amount` exalted, its PoB item text beside it. */
function helmetListing(id: string, text: string, amount: number): FetchListing {
  const e = JSON.parse(JSON.stringify(RING_TEMPLATE)) as FetchListing;
  e.id = id;
  Object.assign(e.item, { id, name: text.split('\n')[1], typeLine: 'Soldier Greathelm', baseType: 'Soldier Greathelm' });
  e.listing.price = { type: '~price', amount, currency: 'exalted' };
  delete e.listing.whisper;
  return { ...e, itemText: text } as FetchListing;
}
/** The upgrade the helmet's weighted search finds: more life and both resistances. */
const BETTER_HELMET = 'Rarity: Rare\nStorm Visor\nSoldier Greathelm\nImplicits: 0\n+95 to maximum Life\n+42% to Cold Resistance\n+36% to Fire Resistance';

const affixKey = (t: string) => t.replace(/\{[^}]*\}/g, '').replace(/-?\d+(?:\.\d+)?/g, '#').replace(/\+#/g, '#').replace(/\s+/g, ' ').trim().toLowerCase();

engineDescribe('AC-W155 (WU-163, D-520): the fixture pricing runs, online through fixtureFetch and offline', () => {
  let fx: SessionFixture;
  /** The server's clock, which only its trade pace's waits move. */
  let clock = Date.now();
  const creds: { value: Credentials } = { value: { sessionId: SENTINEL, source: 'dotenv' } };
  /** Each search's listings by id, and its kind (depth check, unique, weighted). */
  const listings = new Map<string, FetchListing>();
  let searches = 0;
  const http = fixtureFetch([
    {
      match: (url, init) => /\/api\/trade2\/search\//.test(url) && (init?.method ?? 'GET').toUpperCase() === 'POST',
      respond: (_url, init) => {
        const body = String(init?.body ?? '');
        const id = `pricing${(searches += 1)}`;
        let ids: string[] = [];
        if (/"type":\s*"weight"/.test(body)) {
          // A weighted find_upgrades search: the helmet's finds its upgrade; the boots' and the amulet's find nothing.
          ids = /armour\.helmet/.test(body) ? syntheticIds(id, 1) : [];
          ids.forEach((x) => listings.set(x, helmetListing(x, BETTER_HELMET, 60)));
        } else if (body.includes('Choir of the Storm')) {
          ids = syntheticIds(id, 10);
          ids.forEach((x, i) => listings.set(x, deriveListing(x, i, { price: { amount: 1 + 0.1 * i, currency: 'divine' } })));
        } else {
          // A depth check: 12 found, each 5 exalts dearer than the last.
          ids = syntheticIds(id, 12);
          ids.forEach((x, i) => listings.set(x, deriveListing(x, i, { price: { amount: 20 + 5 * i, currency: 'exalted' } })));
        }
        return new Response(JSON.stringify(searchBody(id, ids.length, ids)), { status: 200, headers: { 'content-type': 'application/json', ...SEARCH_HEADERS } });
      },
    },
    fetchRoute({ headers: FETCH_HEADERS, entryFor: (id) => listings.get(id) ?? null }),
    ...DATA_ROUTES,
    {
      match: /^https:\/\/poe\.ninja\//,
      respond: (url) => {
        const type = /[?&]type=([A-Za-z]+)/.exec(url)?.[1] ?? 'Currency';
        const file = path.join(REPO, 'tests', 'fixtures', 'poeninja', 'exchange', `${type}.response.json`);
        const body = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '{}';
        return new Response(body, { status: 200, headers: { 'content-type': 'application/json' } });
      },
    },
  ]);

  const env = { PATH: '/usr/bin:/bin', LANG: 'C', BUILD_GUIDE_TEST_NOW: TEST_NOW };
  const script = (name: string, args: string[]) => {
    const r = spawnSync(process.execPath, [path.join(SCRIPTS, name), ...args], { cwd: fx.tmp, env, encoding: 'utf8', timeout: 60000 });
    return { code: r.status, stdout: r.stdout, stderr: r.stderr };
  };
  const log = (dir: string, kind: string, entry: Json) => {
    const r = script('run-log.mjs', [dir, kind, JSON.stringify(entry)]);
    if (r.code !== 0) throw new Error(`run-log ${kind}: ${r.stderr}`);
  };
  const check = (dir: string) => script('check-run.mjs', [dir]);
  const ok = (out: ToolOutcome, what: string): string => {
    if (out.isError) throw new Error(`${what} failed: ${out.text}`);
    return out.text;
  };
  const readJson = (dir: string, rel: string): Json => JSON.parse(fs.readFileSync(path.join(dir, rel), 'utf8')) as Json;
  const writeJson = (dir: string, rel: string, v: unknown) => fs.writeFileSync(path.join(dir, rel), `${JSON.stringify(v, null, 2)}\n`);

  /** Steps 1 and 2: the run folder, the log's first entry and the read, the main skill answered. */
  async function startRun(mode: 'online' | 'offline'): Promise<{ dir: string; rel: string }> {
    const made = ok(await fx.call('guide_run', { new_run: 'pricing' }), 'guide_run');
    const dir = /^Created run folder (.+)$/m.exec(made)![1];
    const rel = path.relative(fx.guides, dir).split(path.sep).join('/');
    log(dir, 'init', { piece: 'pricing', mode, testConfig: 'none', noNinja: false, source: { kind: 'builds-folder', name: NAME } });
    const first = ok(await fx.call('plan_from_build', { run_folder: rel, build_name: NAME }), 'plan_from_build');
    expect(first).toMatch(/^Read Pricing Character(?:\.xml)? \(Endgame\) into .*plan\.json: stage f, level 75, 3 items \(3 owned\)/);
    ok(await fx.call('plan_from_build', { run_folder: rel, main_group: 1 }), 'plan_from_build (answers)');
    log(dir, 'stage', { stage: 'read', attempt: 1, outcome: 'done' });
    return { dir, rel };
  }
  /**
   * price.md step 1: the measure-only compile, with measure_as while the read stage is unplaced (f) and without it once
   * placed (a placed stage refuses it, src/plan/compiler.ts), then the read stage's loadout selected.
   */
  async function load(rel: string, dir: string): Promise<void> {
    const stage = readJson(dir, 'plan.json').stages[0];
    const args = stage.variant === undefined ? { plan_path: `${rel}/plan.json`, measure_only: true, measure_as: 'non-budget' } : { plan_path: `${rel}/plan.json`, measure_only: true };
    const compiled = ok(await fx.call('compile_plan', args), 'compile_plan');
    expect(compiled).toMatch(/\(measure-only\)/);
    ok(await fx.call('manage_sets', { set_type: 'loadout', action: 'select', title: stage.loadoutName }), 'manage_sets');
  }
  /** Placing (price.md step 6, A.5): the stage renamed to its rung's id, with its variant fields; again on a resume. */
  function place(stage: Json, rung: 'm' | 'b' | 'n'): void {
    const variant = { m: 'entering-maps', b: 'budget', n: 'non-budget' }[rung];
    const tag = (what: string) => ({ kind: 'judgment', ref: `the character's own ${what}, from its file`, confidence: 'H' });
    const rest = Object.entries(stage).filter(([k]) => !['id', 'loadoutName', 'variant', 'ascendancyPoints', 'variantBasis'].includes(k));
    const name = String(stage.loadoutName ?? '').replace(/\{[A-Za-z0-9]+\}$/, `{${rung}}`);
    for (const k of Object.keys(stage)) delete stage[k];
    Object.assign(stage, { id: rung, loadoutName: name });
    for (const [k, v] of rest) {
      stage[k] = v;
      if (k === 'progress') Object.assign(stage, { variant, ascendancyPoints: 0, variantBasis: { level: tag('level'), gemLevels: tag('gem levels'), ascendancyPoints: tag('ascendancy points') } });
    }
  }
  const checkedDate = (text: string) => /^Checked: (\d{4}-\d{2}-\d{2})T/m.exec(text)![1];
  const checkedAt = (text: string) => /^Checked: (\S+)$/m.exec(text)![1];

  /**
   * SKILL.md step 3, the notice's bound from one view of the read stage: 2 a rare item or rare tree jewel, 1 a unique,
   * magic or normal item (flasks and charms aside), 1 a rune, soul core or idol in a socket, and with a budget 2 a gear slot.
   */
  async function noticeBound(rel: string, stageId: string, budget: boolean): Promise<number> {
    const view = ok(await fx.call('guide_run', { view: { plan: `${rel}/plan.json`, stage: stageId } }), 'guide_run view');
    const slots = [...view.matchAll(/"slot":\s*"([^"]+)",\s*"text":\s*"Rarity: (\w+)((?:[^"\\]|\\.)*)"/g)].filter((m) => !/^(?:Flask|Charm) \d+$/.test(m[1]));
    const rares = slots.filter((m) => m[2].toUpperCase() === 'RARE').length;
    const others = slots.length - rares;
    const runes = slots.reduce((n, m) => n + (m[3].match(/\\nRune: /g) ?? []).length, 0);
    return 2 * rares + others + runes + (budget ? 2 * slots.filter((m) => !/^Jewel /.test(m[1])).length : 0);
  }

  /** The price step's calls on one run, each counted by outcome and, a trade search, against the bound (price.md step 2). */
  function pricer(bound: number) {
    const outcomes: Record<string, number> = {};
    let made = 0;
    const count = (k: string, searched = 0) => {
      outcomes[k] = (outcomes[k] ?? 0) + 1;
      made += searched;
      expect(made).toBeLessThanOrEqual(bound);
    };
    const need = (n: number) => expect(bound - made).toBeGreaterThanOrEqual(n);
    return {
      outcomes,
      made: () => made,
      /** Each currency's rate as a rate- entry: what one unit is worth in divines (step 4). */
      async rates(): Promise<{ entries: Json[]; rateOf: (c: string) => number; date: string }> {
        const text = ok(await fx.call('get_currency_rates', { league: LEAGUE }), 'get_currency_rates');
        const rateOf = (id: string) => Number(new RegExp(`\\(${id}\\)\\s+([\\d.]+) divine`).exec(text)![1]);
        const date = /fetched (\d{4}-\d{2}-\d{2})T/.exec(text)![1];
        const entries = ['exalted', 'chaos'].map((c) => ({ id: `rate-${c}`, item: c === 'exalted' ? 'Exalted Orb' : 'Chaos Orb', query: { rates: c, league: LEAGUE }, amount: rateOf(c), currency: 'divine', date, league: LEAGUE, status: 'ok', note: `${Math.round(1 / rateOf(c))} ${c === 'exalted' ? 'exalts' : 'chaos'} a divine` }));
        return { entries, rateOf, date };
      },
      /** An item the exchange sells, by name: its exchange value (no search). */
      async exchange(id: string, item: string, name: string, query: Json): Promise<Json> {
        need(1);
        const text = ok(await fx.call('get_item_price', { item_name: name, league: LEAGUE }), `get_item_price ${name}`);
        const value = /^Exchange value: ([\d.e-]+) (\w+) /m.exec(text);
        expect({ name, exchange: value !== null }).toEqual({ name, exchange: true });
        count('exchange');
        return { id, item, query: { ...query, exchange: /^Uncut /.test(name) ? 'UncutGems' : 'Runes', name }, amount: Number(value![1]), currency: value![2], date: checkedDate(text), league: LEAGUE, status: 'ok', note: "poe.ninja's exchange value" };
      },
      /** An owned rare: PoB's ranking (link_only, no request), its spec, one depth check (step 5). */
      async rare(slot: keyof typeof RARES): Promise<{ entry: Json; ranked: string }> {
        const rare = RARES[slot];
        const ranked = ok(await fx.call('find_upgrades', { slot, link_only: true, sort_stats: [{ stat: 'FullDPS', weight: 1 }, { stat: 'TotalEHP', weight: 0.5 }], weight_corrupted_mods: false, league: LEAGUE }), `find_upgrades link_only ${slot}`);
        const line = /^Ranking \(PoB's order: gain at the middle roll, weight per point\): (.+)$/m.exec(ranked)![1];
        const top = line.startsWith('none') ? [] : line.split('; ').map((x) => /^(.*) (-?[\d.]+) (-?[\d.]+)$/.exec(x)!).map((m) => ({ affix: m[1], gain: Number(m[2]), weight: Number(m[3]) }));
        const order = (affix: string) => {
          const k = top.findIndex((r) => affixKey(r.affix) === affixKey(affix));
          return k < 0 ? Infinity : k;
        };
        const mustHaves = [...rare.lines].sort((a, b) => order(a.affix) - order(b.affix)).map((l) => ({ ...l, ...(order(l.affix) === Infinity ? { why: 'the build needs it, and PoB scores it at zero' } : {}) }));
        const query = { league: LEAGUE, item_type: rare.base, mods: mustHaves.map((m) => ({ stat_id: m.tradeId, min: m.min })), corrupted: false, min_rune_sockets: 1, limit: 10 };
        need(2);
        const found = ok(await fx.call('search_trade_items', query), `search_trade_items ${slot}`);
        count('ok', 1);
        const total = Number(/^Found: (\d+) \| Showing: \d+$/m.exec(found)![1]);
        const shown = [...found.matchAll(/^ {3}Price: ([\d.]+) (\w+)/gm)].map((m) => ({ amount: Number(m[1]), currency: m[2] }));
        expect({ slot, total, shown: shown.length }).toEqual({ slot, total: 12, shown: 10 });
        const top4 = top.slice(0, 4);
        const entry = {
          id: `f-${slot.toLowerCase()}`,
          item: `${rare.base}: ${mustHaves.map((m) => m.affix.replace(/^#%? (?:to |increased )?/, '').replace(/^maximum /, '').toLowerCase()).join(', ')}`,
          query: { slot, ...query },
          amount: shown[4].amount, currency: shown[4].currency, date: checkedDate(found), league: LEAGUE, status: 'ok',
          note: `${total} found, the 5th cheapest`,
          listing: { corrupted: false, sockets: 1, count: total, position: 5 },
          spec: {
            base: rare.base,
            weights: [{ stat: 'FullDPS', weight: 1 }, { stat: 'TotalEHP', weight: 0.5 }],
            ranking: top4,
            mustHaves,
            leftOut: top4.filter((r) => !mustHaves.some((m) => affixKey(m.affix) === affixKey(r.affix)) && rare.lines.some((l) => affixKey(l.affix) === affixKey(r.affix))).map((r) => ({ affix: r.affix, why: 'not required' })),
            searches: 1,
          },
        };
        return { entry, ranked };
      },
      /** The unique by name, its summary's Median (step 5). */
      async unique(): Promise<Json> {
        need(1);
        const text = ok(await fx.call('get_item_price', { item_name: 'Choir of the Storm', league: LEAGUE }), 'get_item_price unique');
        count('ok', 1);
        const median = /^ {2}Median: ([\d.]+) divine$/m.exec(text)!;
        return { id: 'f-amulet', item: 'Choir of the Storm', query: { slot: 'Amulet', item_name: 'Choir of the Storm', league: LEAGUE }, amount: Number(median[1]), currency: 'divine', date: checkedDate(text), league: LEAGUE, status: 'ok', note: 'the median of 10 listings' };
      },
      /** The upgrades within the budget (step 7): one capped find_upgrades a gear slot, its searches counted. */
      async upgrades(slot: string): Promise<{ text: string; listings: Json[]; checked: string }> {
        need(2);
        const out = ok(await fx.call('find_upgrades', { slot, max_price: BUDGET, currency: 'divine', sort_stats: [{ stat: 'FullDPS', weight: 1 }, { stat: 'TotalEHP', weight: 0.5 }], report_stats: ['ColdMaximumHitTaken'], rune_behaviour: 'keep', fetch_pages: 1, limit: 3, league: LEAGUE }), `find_upgrades ${slot}`);
        count('ok', Number(/^Searches (\d+) ·/m.exec(out)?.[1] ?? 0));
        const rows = out.split('\n');
        const listings: Json[] = [];
        rows.forEach((row, i) => {
          const head = /^\d+\. .+: ([\d.]+) (\w+)(?: \(.*\))? · UPGRADE$/.exec(row);
          if (!head) return;
          const stats = (rows[i + 2] ?? '').trim().split(' · ');
          const delta = (re: RegExp, pct: boolean) => {
            const st = stats.find((x) => re.test(x));
            const m = st ? /([+-][\d.]+)(?: \(([+-][\d.]+)%\))?$/.exec(st) : null;
            return m ? Number(pct ? (m[2] ?? '0') : m[1]) / (pct ? 100 : 1) : 0;
          };
          const buy = rows.slice(i).find((r) => /^ {3}Buy: /.test(r))!.replace(/^ {3}Buy: /, '');
          const link = /^https:\/\//.test(buy) ? buy : /^Search on the trade site: (\S+)$/m.exec(out)![1];
          listings.push({ price: { amount: Number(head[1]), currency: head[2] }, gain: { fullDps: delta(/DPS/, true), ehp: delta(/Hit Pool|EHP/, true), maxHit: { type: 'Cold', change: delta(/MaximumHitTaken/, false) } }, link });
        });
        return { text: out, listings, checked: checkedAt(out) };
      },
    };
  }
  /** Step 5's gems: Essence Drain at 18 as its uncut skill gem, Magnified Area II as the uncut support gem of its tier. */
  async function gemQueries(): Promise<Array<{ id: string; item: string; name: string; query: Json }>> {
    const support = ok(await fx.call('lookup_game_data', { mode: 'gem', query: 'Magnified Area II' }), 'lookup_game_data');
    const tier = Number(/^Tier: (\d+)$/m.exec(support)![1]);
    return [
      { id: 'f-gem-1-1', item: 'Essence Drain: Uncut Skill Gem (Level 18)', name: 'Uncut Skill Gem (Level 18)', query: { group: 1, gem: 1 } },
      { id: 'f-gem-1-2', item: `Magnified Area II: Uncut Support Gem (Level ${tier})`, name: `Uncut Support Gem (Level ${tier})`, query: { group: 1, gem: 2 } },
    ];
  }
  function writePrices(dir: string, rates: { rateOf: (c: string) => number; date: string } | null, searches: string, place: string, why: string): void {
    fs.writeFileSync(path.join(dir, 'prices.md'), [
      `# Prices: ${NAME} (Endgame, level 75)`,
      '',
      rates === null ? 'Offline: nothing was priced.' : `League: ${LEAGUE}. Rates: ${Math.round(1 / rates.rateOf('exalted'))} exalts and ${Math.round(1 / rates.rateOf('chaos'))} chaos a divine, seen ${rates.date}.`,
      searches,
      '',
      '## Place',
      '',
      `Place: ${place}.`,
      why,
      '',
    ].join('\n'));
  }

  // The online run's replies, kept for the assertions.
  let online: { dir: string; bound: number; made: number; leagues: string; ranking: Record<string, string>; links: Record<string, string>; calls: RecordedCall[] };
  let offline: { dir: string };
  let resumed: { dir: string; stopped: { code: number | null; stderr: string }; refused: ToolOutcome; stage: Json };

  beforeAll(async () => {
    fx = await startSessionFixture({
      files: { [`${NAME}.xml`]: fs.readFileSync(SOURCE, 'utf8') },
      deps: {
        fetch: ((input: Parameters<typeof fetch>[0], init?: RequestInit) => http.fetch(input, init)) as typeof fetch,
        credentials: () => creds.value,
        // The server's own pace (D-461), its waits a jump of the server's clock: a find_upgrades call makes at most two
        // searches in its 90 s, as price.md's cap counts it, and costs no real time.
        now: () => clock,
        tradePace: TRADE_SEARCH_PACE,
        tradeSleep: async (ms: number) => {
          clock += ms;
        },
        env: { POE_TRADE_DISABLED: undefined, POE_NINJA_DISABLED: undefined, POE_LEAGUE: undefined },
      },
    });

    // ---- The online run --------------------------------------------------------------------------------------------
    const { dir, rel } = await startRun('online');
    // The notice's bound (SKILL.md step 3), the step's cap (price.md step 2).
    const bound = await noticeBound(rel, 'f', true);
    await load(rel, dir);
    const read = readJson(dir, 'read.json');
    // The league: the file's importLeague, which trade lists (price.md step 3).
    const leagues = ok(await fx.call('get_leagues', {}), 'get_leagues');
    expect(read.importLeague).toBe(LEAGUE);
    const price = pricer(bound);
    const rates = await price.rates();
    const prices: Json[] = [...rates.entries];
    // What the exchange sells first (price.md step 2): the boots' rune, then the gems.
    prices.push(await price.exchange('f-boots-socket-1', 'Greater Iron Rune', 'Greater Iron Rune', { slot: 'Boots', socket: 1 }));
    for (const g of await gemQueries()) prices.push(await price.exchange(g.id, g.item, g.name, g.query));
    const ranking: Record<string, string> = {};
    for (const slot of ['Helmet', 'Boots'] as const) {
      const { entry, ranked } = await price.rare(slot);
      ranking[slot] = ranked;
      prices.push(entry);
    }
    prices.push(await price.unique());
    const slots: Json[] = [];
    let checked = '';
    for (const slot of GEAR) {
      const u = await price.upgrades(slot);
      slots.push({ slot, listings: u.listings });
      checked = u.checked;
    }
    const placedPlan = readJson(dir, 'plan.json');
    placedPlan.league = LEAGUE;
    placedPlan.prices = prices;
    place(placedPlan.stages[0], 'm');
    writeJson(dir, 'plan.json', placedPlan);
    writePrices(dir, rates, `Searches: ${price.made()} of at most ${bound}.`, 'entering maps (m), by the replace cost', "The whole cost is about a divine, within entering maps' 5.");
    const first = slots[0].listings[0];
    writeJson(dir, 'upgrades.json', { budget: { divines: BUDGET }, league: LEAGUE, checked, slots, chosen: first ? [{ slot: 'Helmet', listing: 0 }] : [], spent: first ? first.price.amount * (first.price.currency === 'divine' ? 1 : rates.rateOf(first.price.currency)) : 0 });
    log(dir, 'stage', { stage: 'price', attempt: 1, outcome: 'done', priceOutcomes: price.outcomes });
    log(dir, 'set', { status: 'completed' });

    // Without a cookie: the same calls give each slot its link alone (the fallback, then link_only for the rest).
    creds.value = { sessionId: null, source: null } as unknown as Credentials;
    const links: Record<string, string> = {};
    for (const slot of GEAR) {
      links[slot] = ok(await fx.call('find_upgrades', slot === GEAR[0] ? { slot, max_price: BUDGET, currency: 'divine', league: LEAGUE } : { slot, link_only: true, league: LEAGUE }), `find_upgrades without a cookie ${slot}`);
    }
    creds.value = { sessionId: SENTINEL, source: 'dotenv' };
    online = { dir, bound, made: price.made(), leagues, ranking, links, calls: [...http.calls] };

    // ---- A stopped run, resumed (price.md step 1: a placed stage compiles as its own rung) ----------------------------
    const stop = await startRun('online');
    const stopBound = await noticeBound(stop.rel, 'f', false);
    await load(stop.rel, stop.dir);
    const p1 = pricer(stopBound);
    const r1 = await p1.rates();
    const before: Json[] = [...r1.entries];
    before.push(await p1.exchange('f-boots-socket-1', 'Greater Iron Rune', 'Greater Iron Rune', { slot: 'Boots', socket: 1 }));
    for (const g of await gemQueries()) before.push(await p1.exchange(g.id, g.item, g.name, g.query));
    before.push((await p1.rare('Helmet')).entry);
    // The boots' depth check came back 429: pricing stops (the runner rules), every item still to price rate-limited.
    const limited = (id: string, item: string, query: Json) => ({ id, item, query, amount: null, currency: null, date: r1.date, league: LEAGUE, status: 'unavailable', note: 'rate-limited' });
    before.push(limited('f-boots', 'Lizardscale Boots: movement speed, life, lightning resistance', { slot: 'Boots' }), limited('f-amulet', 'Choir of the Storm', { slot: 'Amulet' }));
    let plan = readJson(stop.dir, 'plan.json');
    plan.league = LEAGUE;
    plan.prices = before;
    writeJson(stop.dir, 'plan.json', plan);
    writePrices(stop.dir, r1, `Searches: ${p1.made() + 1} of at most ${stopBound}.`, 'in the campaign, the user\'s word', 'Pricing stopped before the rung was known.');
    log(stop.dir, 'stage', { stage: 'price', attempt: 1, outcome: 'done', priceOutcomes: { ...p1.outcomes, ok: (p1.outcomes.ok ?? 0), rate_limited: 1 } });
    // The runner asks for the rung, and the step runs once more with it, the stop open: no trade request, the place written.
    plan = readJson(stop.dir, 'plan.json');
    place(plan.stages[0], 'b');
    writeJson(stop.dir, 'plan.json', plan);
    writePrices(stop.dir, r1, `Searches: 0 of at most 0.`, "budget (b), the user's word", 'Pricing stopped; the player named the rung.');
    log(stop.dir, 'stage', { stage: 'price', attempt: 2, outcome: 'done', priceOutcomes: {} });
    log(stop.dir, 'set', { status: 'stopped' });
    const stopped = check(stop.dir);
    // The resume, after the lockout: the stop cleared, the placed stage measured as its own rung.
    log(stop.dir, 'resume', { noNinja: false });
    const refused = await fx.call('compile_plan', { plan_path: `${stop.rel}/plan.json`, measure_only: true, measure_as: 'non-budget' });
    await load(stop.rel, stop.dir);
    const p2 = pricer(2 + 1);
    const again = readJson(stop.dir, 'plan.json');
    const kept = again.prices.filter((x: Json) => !['f-boots', 'f-amulet'].includes(x.id));
    again.prices = [...kept, (await p2.rare('Boots')).entry, await p2.unique()];
    // Every price known now: the cost places it again, on m, the stage renamed from b.
    place(again.stages[0], 'm');
    writeJson(stop.dir, 'plan.json', again);
    writePrices(stop.dir, r1, `Searches: ${p2.made()} of at most 3.`, 'entering maps (m), by the replace cost', "The whole cost is about a divine, within entering maps' 5.");
    log(stop.dir, 'stage', { stage: 'price', attempt: 3, outcome: 'done', priceOutcomes: p2.outcomes });
    log(stop.dir, 'set', { status: 'completed' });
    resumed = { dir: stop.dir, stopped: { code: stopped.code, stderr: stopped.stderr }, refused, stage: readJson(stop.dir, 'plan.json').stages[0] };

    // ---- The offline run -------------------------------------------------------------------------------------------
    const off = await startRun('offline');
    await load(off.rel, off.dir);
    const date = /(\d{4}-\d{2}-\d{2})-\d+$/.exec(off.dir)![1];
    const offPlan = readJson(off.dir, 'plan.json');
    const unavailable = (id: string, item: string, query: Json) => ({ id, item, query, amount: null, currency: null, date, league: null, status: 'unavailable', note: 'offline run' });
    offPlan.prices = [
      unavailable('f-helmet', 'Soldier Greathelm: life, cold and fire resistance', { slot: 'Helmet' }),
      unavailable('f-boots', 'Lizardscale Boots: movement speed, life, lightning resistance', { slot: 'Boots' }),
      unavailable('f-boots-socket-1', 'Greater Iron Rune', { slot: 'Boots', socket: 1 }),
      unavailable('f-amulet', 'Choir of the Storm', { slot: 'Amulet' }),
      unavailable('f-gem-1-1', 'Essence Drain: Uncut Skill Gem (Level 18)', { group: 1, gem: 1 }),
      unavailable('f-gem-1-2', 'Magnified Area II: an Uncut Support Gem at its tier', { group: 1, gem: 2 }),
    ];
    place(offPlan.stages[0], 'b');
    writeJson(off.dir, 'plan.json', offPlan);
    writePrices(off.dir, null, '', "budget (b), the user's word", 'Offline nothing is priced, so the player named the rung.');
    log(off.dir, 'stage', { stage: 'price', attempt: 1, outcome: 'done', priceOutcomes: {} });
    log(off.dir, 'set', { status: 'completed' });
    offline = { dir: off.dir };
  }, ENGINE_TIMEOUT);

  afterAll(async () => fx?.close(), 60_000);

  it('the online run passes the run checker: its replace cost from the tools\' replies, gems among it, placed on m, its upgrades within the budget', () => {
    const r = check(online.dir);
    expect({ code: r.code, stderr: r.stderr }).toEqual({ code: 0, stderr: '' });
    const plan = readJson(online.dir, 'plan.json');
    expect(plan.stages[0]).toMatchObject({ id: 'm', variant: 'entering-maps' });
    // Every filled slot, the rune in the boots' socket and the two gems have an entry, the rates beside them.
    expect(plan.prices.map((p: Json) => p.id).sort()).toEqual(['f-amulet', 'f-boots', 'f-boots-socket-1', 'f-gem-1-1', 'f-gem-1-2', 'f-helmet', 'rate-chaos', 'rate-exalted']);
    expect(plan.prices.every((p: Json) => p.status === 'ok' && p.league === LEAGUE)).toBe(true);
    // The rune and the uncut gems from poe.ninja's exchange; the support at its tier; the depth check's 5th cheapest of 12.
    expect(plan.prices.find((p: Json) => p.id === 'f-boots-socket-1').currency).toBe('divine');
    expect(plan.prices.find((p: Json) => p.id === 'f-gem-1-1')).toMatchObject({ query: { group: 1, gem: 1, exchange: 'UncutGems', name: 'Uncut Skill Gem (Level 18)' } });
    expect(plan.prices.find((p: Json) => p.id === 'f-gem-1-2')).toMatchObject({ query: { group: 1, gem: 2, exchange: 'UncutGems', name: 'Uncut Support Gem (Level 3)' } });
    expect(plan.prices.find((p: Json) => p.id === 'f-helmet')).toMatchObject({ amount: 40, currency: 'exalted', listing: { count: 12, position: 5 } });
    const u = readJson(online.dir, 'upgrades.json');
    expect(u.slots.map((s: Json) => s.slot)).toEqual(GEAR);
    expect(u.slots[0].listings.length).toBeGreaterThan(0);
    expect(u.slots[0].listings[0].gain.ehp).toBeGreaterThan(0);
  });

  it("the notice's bound, counted from the read stage's view, holds the step: 12 announced (two rares at 2, the unique and the rune at 1, three gear slots at 2), no more made", () => {
    expect(online.bound).toBe(12);
    expect(online.made).toBeGreaterThan(0);
    expect(online.made).toBeLessThanOrEqual(online.bound);
    expect(fs.readFileSync(path.join(online.dir, 'prices.md'), 'utf8')).toMatch(new RegExp(`^Searches: ${online.made} of at most 12\\.$`, 'm'));
  });

  it('the league is the file\'s, which trade lists; the rares were ranked with no request; no request left fixtureFetch\'s routes', () => {
    expect(online.leagues).toContain(LEAGUE);
    for (const slot of Object.keys(RARES)) expect(online.ranking[slot]).toMatch(/^Link only: /m);
    for (const call of online.calls) expect(call.url).toMatch(/^https:\/\/(?:www\.pathofexile\.com\/api\/trade2\/|poe\.ninja\/)/);
    expect(online.calls.some((c) => /poe\.ninja\/.*type=Runes/.test(c.url))).toBe(true);
    expect(online.calls.some((c) => /poe\.ninja\/.*type=UncutGems/.test(c.url))).toBe(true);
  });

  it('without a cookie each slot gets its link alone, which upgrades.json holds as a slot with no listing', () => {
    expect(online.links.Helmet).toMatch(/^\[trade:no_session\] Trade search not run: /);
    for (const slot of GEAR) expect(online.links[slot].trim().split('\n').pop()).toMatch(/^https:\/\/www\.pathofexile\.com\/trade2\/search\/poe2\//);
    // A second run folder beside it, the same files but upgrades.json's slots.
    const dir = online.dir.replace(/-(\d+)$/, '-9$1');
    fs.cpSync(online.dir, dir, { recursive: true });
    const l = readJson(dir, 'run-log.json');
    l.runFolder = dir;
    writeJson(dir, 'run-log.json', l);
    const u = readJson(dir, 'upgrades.json');
    u.slots = GEAR.map((slot) => ({ slot, listings: [], link: online.links[slot].trim().split('\n').pop() }));
    u.chosen = [];
    u.spent = 0;
    writeJson(dir, 'upgrades.json', u);
    const r = check(dir);
    expect({ code: r.code, stderr: r.stderr }).toEqual({ code: 0, stderr: '' });
  });

  it('a stopped run resumes: the placed stage refuses measure_as and compiles as its own rung, the rest priced, the place taken again', () => {
    // Stopped, placed on b by the player's word: the checker holds the stopped run to nothing but NFR-22, which every
    // rate_limited outcome trips (D-516: it stands).
    const nfr22 = /^check-run: \[nfr-22\] run-log\.json stages\[1\]: pricing hit 1 rate_limited and 0 locked_out outcome\(s\); NFR-22 wants zero of each$/;
    const only = (stderr: string) => stderr.split('\n').filter((l) => /^check-run: \[/.test(l));
    expect(only(resumed.stopped.stderr)).toEqual([expect.stringMatching(nfr22)]);
    // The compile with measure_as on the placed stage is refused, which is why price.md drops it once placed.
    expect(resumed.refused.isError).toBe(true);
    expect(resumed.refused.text).toMatch(/measure_as measures a read stage .* Nothing was compiled/);
    // Resumed: the compile without it ran (load), the boots and the amulet priced, the cost places it on m.
    expect(resumed.stage).toMatchObject({ id: 'm', variant: 'entering-maps', loadoutName: expect.stringMatching(/\{m\}$/) });
    const log = readJson(resumed.dir, 'run-log.json');
    expect(log).toMatchObject({ status: 'completed', pricing: { stops: [{ step: 'price', outcome: 'rate_limited' }] } });
    expect(log.resumes).toHaveLength(1);
    // Completed, its one finding the stop's own NFR-22.
    expect(only(check(resumed.dir).stderr)).toEqual([expect.stringMatching(nfr22)]);
  });

  it("the offline run passes the run checker: nothing priced, the rung the player's word, no upgrades", () => {
    const r = check(offline.dir);
    expect({ code: r.code, stderr: r.stderr }).toEqual({ code: 0, stderr: '' });
    expect(fs.existsSync(path.join(offline.dir, 'upgrades.json'))).toBe(false);
    expect(readJson(offline.dir, 'plan.json')).toMatchObject({ league: null, stages: [{ id: 'b', variant: 'budget' }] });
  });
});
