/**
 * AC-F26 (I-4b–d): tool output hygiene, engine-required and in process.
 *
 * For every sample in `tests/fixtures/tool-calls.json` (`{tool, args, expect: "ok" | "error", setup?,
 * reason?}`), the test re-copies the golden build into a private temp builds folder, reloads it with
 * `lua_load_build`, runs the sample's `setup` steps, then calls the sample, with trade and poe.ninja
 * HTTP served by `fixtureFetch`. Checks:
 * - (i)   the text contains none of `undefined`, `NaN`, `[object Object]`;
 * - (ii)  `expect: "ok"` ⇒ `isError` is not true (a protocol error, which is not a tool result at all,
 *         fails it too);
 * - (iii) `expect: "error"` ⇒ `isError: true`.
 *
 * A setup step must succeed: a failing step is a check (ii) failure of the setup step's own tool (so it
 * needs that tool's allowlist entry), never of the sample's tool. A failed reload of the golden build
 * (an `isError` result or a protocol error) aborts the sample, because it would otherwise run against
 * whatever the previous sample left in the engine.
 *
 * Fidelity (spine §12): the trade and poe.ninja requests that `fixtureFetch` recorded are asserted per
 * sample: each HTTP-sending sample hits its expected endpoints with the expected methods, no sample
 * hits an endpoint outside its tool's set, `/api/trade2/data/stats` is requested exactly once (lazily,
 * by the first trade tool that needs stats), no fetch goes unmatched, and no request carries a
 * `Cookie` or a `POESESSID`.
 *
 * Every listed tool has at least one `expect: "ok"` sample; `expect: "error"` samples are additional
 * and carry a `reason`. A failing check is tolerated only when `tests/fixtures/tool-hygiene-allowlist.json`
 * has a matching `{tool, check, owner}` entry, and an allowlisted check that passes fails the test with
 * "remove <tool>/<check> from the allowlist" (D-45).
 *
 * Sample args may use these placeholders, resolved from committed fixtures:
 * - `"$RUBY_RING_TEXT"`: `tests/fixtures/items/ruby-ring.txt`;
 * - `"$JEWEL_TEXT"`: `tests/fixtures/items/jewel.txt`, a rare Ruby jewel (C-46's tree sockets);
 * - `"$GOLDEN_BUILD_CODE"`: the golden build as a PoB export code (`encodePobCode`, C-42);
 * - `"$ALLOCATED_NODES"`: the golden build's allocated node ids (its `<Spec nodes>`), as numbers.
 */
import fs from 'fs';
import os from 'os';
import path from 'path';
import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { startTestServer, type TestServer } from '../helpers/server';
import { fixtureFetch, type RecordedCall } from '../helpers/fixtureFetch';
import { engineDescribe } from '../helpers/engine';
import { encodePobCode } from '../../src/utils/buildCode';

type Check = 'i' | 'ii' | 'iii';

interface Step {
  tool: string;
  args: Record<string, unknown>;
}
interface Sample extends Step {
  expect: 'ok' | 'error';
  setup?: Step[];
  reason?: string;
}
interface AllowEntry {
  tool: string;
  check: Check;
  owner: string;
  reason: string;
}
interface Outcome {
  isError: boolean;
  /** The call threw (an SDK timeout, a closed transport, -32602): not a tool result at all. */
  protocolError: boolean;
  text: string;
}
/** One check that ran, against the tool it belongs to; `failed` is the reason when it failed. */
interface CheckRun {
  tool: string;
  check: Check;
  failed?: string;
}

const REPO = path.resolve(__dirname, '..', '..');
const FIXTURES = path.join(REPO, 'tests', 'fixtures');
const GOLDEN = path.join(FIXTURES, 'builds', 'grenadator.xml');
const SAMPLES = JSON.parse(fs.readFileSync(path.join(FIXTURES, 'tool-calls.json'), 'utf8')) as Sample[];
const ALLOWLIST = JSON.parse(fs.readFileSync(path.join(FIXTURES, 'tool-hygiene-allowlist.json'), 'utf8')) as AllowEntry[];
const DISPOSITION = JSON.parse(fs.readFileSync(path.join(FIXTURES, 'tool-disposition.json'), 'utf8')) as Array<{
  name: string;
  bucket: string;
  pending?: string;
}>;

/** The tools the server lists (AC-F25 proves this equals `listTools`). */
const LISTED = DISPOSITION.filter((e) => e.bucket !== 'delete' && !e.pending).map((e) => e.name);
const JUNK = ['undefined', 'NaN', '[object Object]'];
const CHECKS: Check[] = ['i', 'ii', 'iii'];
/** The units that own a §4 fix (vision §4 lane column → WU-09…13, 15, 18). */
const OWNERS = ['WU-09', 'WU-10', 'WU-11', 'WU-12', 'WU-13', 'WU-15', 'WU-18'];
const CALL_TIMEOUT_MS = 150000;

const goldenXml = fs.readFileSync(GOLDEN, 'utf8');
const PLACEHOLDERS: Record<string, unknown> = {
  $RUBY_RING_TEXT: fs.readFileSync(path.join(FIXTURES, 'items', 'ruby-ring.txt'), 'utf8'),
  $JEWEL_TEXT: fs.readFileSync(path.join(FIXTURES, 'items', 'jewel.txt'), 'utf8'),
  $GOLDEN_BUILD_CODE: encodePobCode(goldenXml),
  $ALLOCATED_NODES: (/<Spec\b[^>]*\snodes="([^"]*)"/.exec(goldenXml) as RegExpExecArray)[1].split(',').map(Number),
};

function resolve(value: unknown): unknown {
  if (typeof value === 'string' && value.startsWith('$')) {
    if (!(value in PLACEHOLDERS)) throw new Error(`unknown placeholder ${value} in tool-calls.json`);
    return PLACEHOLDERS[value];
  }
  if (Array.isArray(value)) return value.map(resolve);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, resolve(v)]));
  }
  return value;
}

const excerptOf = (text: string) => (text.length > 600 ? `${text.slice(0, 600)}…` : text);
const failedCall = (o: Outcome) => o.isError || o.protocolError;

/** Steps 1–2 guard: a reload that did not produce a successful tool result aborts the sample. */
function requireReloaded(load: Outcome): void {
  if (failedCall(load)) throw new Error(`reloading the golden build failed: ${excerptOf(load.text)}`);
}

/**
 * The checks one sample ran. A failing setup step is a check (ii) failure of the setup step's tool;
 * the sample's own checks (i) and (ii)/(iii) judge only the sample's result.
 */
function assessSample(sample: Sample, setup: Outcome[], out: Outcome): CheckRun[] {
  const runs: CheckRun[] = (sample.setup ?? []).map((step, k) => ({
    tool: step.tool,
    check: 'ii' as Check,
    failed: failedCall(setup[k]) ? `setup step for ${sample.tool} failed: ${excerptOf(setup[k].text)}` : undefined,
  }));
  const junk = JUNK.filter((j) => out.text.includes(j));
  runs.push({ tool: sample.tool, check: 'i', failed: junk.length > 0 ? `text contains ${junk.map((j) => JSON.stringify(j)).join(', ')}` : undefined });
  if (sample.expect === 'ok') {
    runs.push({
      tool: sample.tool,
      check: 'ii',
      failed: out.protocolError ? 'the call was a protocol error, not a tool result' : out.isError ? 'isError is true' : undefined,
    });
  } else {
    runs.push({ tool: sample.tool, check: 'iii', failed: out.isError ? undefined : 'isError is not true' });
  }
  return runs;
}

const allowed = (tool: string, check: Check) => ALLOWLIST.some((e) => e.tool === tool && e.check === check);

describe('AC-F26: tool-calls.json and the allowlist are well-formed (D-45)', () => {
  it('AC-F26: every listed tool has at least one expect:"ok" sample', () => {
    const withOk = new Set(SAMPLES.filter((s) => s.expect === 'ok').map((s) => s.tool));
    expect(LISTED.filter((t) => !withOk.has(t))).toEqual([]);
  });

  it('AC-F26: every sample names a listed tool, and every expect:"error" sample carries a reason', () => {
    for (const s of SAMPLES) {
      expect(LISTED).toContain(s.tool);
      expect(['ok', 'error']).toContain(s.expect);
      for (const step of s.setup ?? []) expect(LISTED).toContain(step.tool);
      if (s.expect === 'error') expect(typeof s.reason === 'string' && s.reason.trim().length > 0).toBe(true);
    }
  });

  it('AC-F26: every allowlist entry is {tool, check, owner, reason} for a listed tool, owned by a fix unit, once', () => {
    const keys = ALLOWLIST.map((e) => `${e.tool}/${e.check}`);
    expect(new Set(keys).size).toBe(keys.length);
    for (const e of ALLOWLIST) {
      expect(LISTED).toContain(e.tool);
      expect(CHECKS).toContain(e.check);
      expect(OWNERS).toContain(e.owner);
      expect(typeof e.reason === 'string' && e.reason.trim().length > 0).toBe(true);
    }
  });
});

describe('AC-F26: the per-sample precondition and check attribution', () => {
  const ok: Outcome = { isError: false, protocolError: false, text: 'fine' };
  const toolError: Outcome = { isError: true, protocolError: false, text: 'Error: the engine returned no spec list' };
  const protocol: Outcome = { isError: false, protocolError: true, text: '<protocol error> Request timed out' };
  const withSetup: Sample = {
    tool: 'select_spec',
    args: { index: 2 },
    expect: 'ok',
    setup: [{ tool: 'create_spec', args: { title: 'x' } }],
  };

  it('AC-F26: a reload of the golden build that is a protocol error or an isError result aborts the sample', () => {
    expect(() => requireReloaded(protocol)).toThrow(/reloading the golden build failed: <protocol error>/);
    expect(() => requireReloaded(toolError)).toThrow(/reloading the golden build failed/);
    expect(() => requireReloaded(ok)).not.toThrow();
  });

  it('AC-F26: a failing setup step is a check (ii) failure of the setup tool, not of the sample', () => {
    const runs = assessSample(withSetup, [toolError], ok);
    expect(runs.filter((r) => r.failed).map((r) => `${r.tool}/${r.check}`)).toEqual(['create_spec/ii']);
    expect(runs.find((r) => r.tool === 'select_spec' && r.check === 'ii')?.failed).toBeUndefined();
    expect(assessSample(withSetup, [protocol], ok).filter((r) => r.failed).map((r) => `${r.tool}/${r.check}`)).toEqual(['create_spec/ii']);
  });

  it('AC-F26: checks (ii) and (iii) treat a protocol error as no tool result; (i) finds the junk strings', () => {
    const okSample: Sample = { tool: 'list_specs', args: {}, expect: 'ok' };
    const errSample: Sample = { tool: 'delete_spec', args: { index: 99 }, expect: 'error', reason: 'r' };
    expect(assessSample(okSample, [], protocol).find((r) => r.check === 'ii')?.failed).toMatch(/protocol error/);
    expect(assessSample(okSample, [], toolError).find((r) => r.check === 'ii')?.failed).toBe('isError is true');
    expect(assessSample(errSample, [], protocol).find((r) => r.check === 'iii')?.failed).toBe('isError is not true');
    expect(assessSample(errSample, [], toolError).find((r) => r.check === 'iii')?.failed).toBeUndefined();
    expect(assessSample(okSample, [], { ...ok, text: 'Nodes: undefined, [object Object]' }).find((r) => r.check === 'i')?.failed).toBe(
      'text contains "undefined", "[object Object]"',
    );
  });
});

/** The trade2 and poe.ninja endpoints the hygiene server routes, keyed by a short name. */
const ENDPOINTS = {
  stats: { method: 'GET', match: /^https:\/\/www\.pathofexile\.com\/api\/trade2\/data\/stats(\?|$)/ },
  leagues: { method: 'GET', match: /^https:\/\/www\.pathofexile\.com\/api\/trade2\/data\/leagues(\?|$)/ },
  search: { method: 'POST', match: /^https:\/\/www\.pathofexile\.com\/api\/trade2\/search\/[^?]+$/ },
  fetch: { method: 'GET', match: /^https:\/\/www\.pathofexile\.com\/api\/trade2\/fetch\/[^/?]+\?query=[^&]+/ },
  ninja: { method: 'GET', match: /^https:\/\/poe\.ninja\// },
} as const;
type Endpoint = keyof typeof ENDPOINTS;

/** The trade tools that wait on the lazy `/data/stats` preload (D-14). */
const NEEDS_STATS = new Set(['search_trade_items', 'get_item_price', 'search_stats']);
/** Per HTTP-sending tool: endpoints its sample must hit, and the full set it may hit. */
const HTTP_EXPECT: Record<string, { required: Endpoint[]; allowed: Endpoint[] }> = {
  search_trade_items: { required: ['search', 'fetch'], allowed: ['stats', 'leagues', 'search', 'fetch', 'ninja'] },
  get_item_price: { required: ['search', 'fetch'], allowed: ['stats', 'leagues', 'search', 'fetch', 'ninja'] },
  get_leagues: { required: ['leagues'], allowed: ['leagues'] },
  search_stats: { required: [], allowed: ['stats'] },
  // C-12 caches rates per league for 60 min, and the trade samples (same league) convert prices
  // first (D-61), so get_currency_rates is normally served from cache: the once-only ninja check
  // below asserts the fetch instead.
  get_currency_rates: { required: [], allowed: ['ninja'] },
};
/** The tools that read C-12 rates; the first of them to run fetches poe.ninja, the rest hit the cache. */
const NEEDS_RATES = new Set(['search_trade_items', 'get_item_price', 'get_currency_rates']);

function endpointOf(call: RecordedCall): Endpoint | undefined {
  return (Object.keys(ENDPOINTS) as Endpoint[]).find((k) => ENDPOINTS[k].match.test(call.url) && ENDPOINTS[k].method === call.method);
}

engineDescribe('AC-F26: tool output hygiene on the golden build', () => {
  let tmp: string;
  let builds: string;
  let server: TestServer;
  let http: ReturnType<typeof fixtureFetch>;
  /** URLs the server fetched that no fixture route matched. */
  const unmatched: string[] = [];
  /** `<tool>/<check>` → one entry per run: did the check fail? */
  const results = new Map<string, boolean[]>();
  /** Per sample, in order: the requests recorded while its setup steps and call ran. */
  const sampleCalls: Array<{ tool: string; calls: RecordedCall[] }> = [];

  const call = async (tool: string, args: Record<string, unknown>): Promise<Outcome> => {
    try {
      const result = (await server.client.callTool({ name: tool, arguments: resolve(args) as Record<string, unknown> }, undefined, {
        timeout: CALL_TIMEOUT_MS,
      })) as { isError?: boolean; content?: Array<{ type: string; text?: string }> };
      const text = (result.content ?? []).map((c) => (c.type === 'text' ? (c.text ?? '') : `[${c.type} content]`)).join('\n');
      return { isError: result.isError === true, protocolError: false, text };
    } catch (error) {
      // A protocol error (e.g. -32602 for an unlisted tool, an SDK timeout) is not a tool result at all.
      return { isError: false, protocolError: true, text: `<protocol error> ${error instanceof Error ? error.message : String(error)}` };
    }
  };

  beforeAll(async () => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'pob2-hygiene-'));
    builds = path.join(tmp, 'builds');
    fs.mkdirSync(builds);
    http = fixtureFetch([
      { match: /\/api\/trade2\/data\/leagues/, respond: { fixture: 'trade2/data-leagues' } },
      { match: /\/api\/trade2\/data\/stats/, respond: { fixture: 'trade2/data-stats' } },
      { match: /\/api\/trade2\/search\//, respond: { fixture: 'trade2/search-ring-divine' } },
      { match: /\/api\/trade2\/fetch\//, respond: { fixture: 'trade2/fetch-ring-divine' } },
      { match: /^https:\/\/poe\.ninja\//, respond: { fixture: 'poeninja/currency-overview' } },
    ]);
    const recordingFetch = (async (input: Parameters<typeof fetch>[0], init?: RequestInit) => {
      try {
        return await http.fetch(input, init);
      } catch (error) {
        if (error instanceof Error && error.message.startsWith('unmatched fetch:')) unmatched.push(error.message);
        throw error;
      }
    }) as typeof fetch;
    server = await startTestServer({
      fetch: recordingFetch,
      pobDirectory: builds,
      stateDir: path.join(tmp, 'state'),
      env: { POB_DIRECTORY: builds, XDG_STATE_HOME: tmp, POE_TRADE_DISABLED: undefined, POE_NINJA_DISABLED: undefined },
    });
  }, 120000);

  afterAll(async () => {
    if (server) await server.close();
    if (tmp) fs.rmSync(tmp, { recursive: true, force: true });
  }, 30000);

  SAMPLES.forEach((sample, n) => {
    it(`AC-F26: ${sample.tool} #${n} (expect ${sample.expect})`, async () => {
      // 1–2. A fresh golden file, reloaded into the engine.
      fs.copyFileSync(GOLDEN, path.join(builds, 'grenadator.xml'));
      requireReloaded(await call('lua_load_build', { build_name: 'grenadator.xml' }));

      // 3–4. Setup steps, then the sample; record the HTTP they send.
      const before = http.calls.length;
      const setup: Outcome[] = [];
      for (const step of sample.setup ?? []) setup.push(await call(step.tool, step.args));
      const out = await call(sample.tool, sample.args);
      sampleCalls.push({ tool: sample.tool, calls: http.calls.slice(before) });

      const runs = assessSample(sample, setup, out);
      for (const r of runs) {
        const key = `${r.tool}/${r.check}`;
        results.set(key, [...(results.get(key) ?? []), r.failed !== undefined]);
      }
      const unexpected = runs.filter((r) => r.failed !== undefined && !allowed(r.tool, r.check));
      if (unexpected.length > 0) {
        throw new Error(
          unexpected.map((r) => `check (${r.check}) failed for ${r.tool}: ${r.failed}`).join('\n') +
            `\n--- output of ${sample.tool} ---\n${excerptOf(out.text)}`,
        );
      }
    }, CALL_TIMEOUT_MS + 60000);
  });

  it('AC-F26: no allowlisted check passes (stale entries fail, D-45)', () => {
    expect(sampleCalls).toHaveLength(SAMPLES.length);
    const stale = ALLOWLIST.filter((e) => {
      const runs = results.get(`${e.tool}/${e.check}`) ?? [];
      return !runs.some((didFail) => didFail);
    }).map((e) => `remove ${e.tool}/${e.check} from the allowlist`);
    expect(stale).toEqual([]);
  });

  it('AC-F26: the trade and ninja samples send exactly their expected requests (fidelity rule, spine §12)', () => {
    expect(sampleCalls).toHaveLength(SAMPLES.length);
    expect(unmatched).toEqual([]);

    // Every request is a routed endpoint with its method, and carries no session or identity.
    const all = sampleCalls.flatMap((s) => s.calls);
    expect(all.filter((c) => endpointOf(c) === undefined).map((c) => `${c.method} ${c.url}`)).toEqual([]);
    for (const c of all) {
      expect(Object.keys(c.headers).map((h) => h.toLowerCase())).not.toContain('cookie');
      expect(`${c.url} ${JSON.stringify(c.headers)} ${c.body ?? ''}`).not.toMatch(/POESESSID/i);
    }

    // Per sample: the required endpoints are hit, and nothing outside the tool's set.
    for (const { tool, calls } of sampleCalls) {
      const hit = calls.map(endpointOf);
      const want = HTTP_EXPECT[tool] ?? { required: [], allowed: [] };
      for (const e of want.required) expect({ tool, hit }).toEqual({ tool, hit: expect.arrayContaining([e]) });
      expect({ tool, outside: hit.filter((e) => !want.allowed.includes(e as Endpoint)) }).toEqual({ tool, outside: [] });
    }

    // The lazy /data/stats preload (D-14) runs exactly once, as the first request of the first
    // sample whose trade tool needs stats, so every later stats-needing sample uses the fixture's stats.
    const statsAt = sampleCalls.flatMap((s, k) => s.calls.filter((c) => endpointOf(c) === 'stats').map(() => k));
    const firstNeedingStats = sampleCalls.findIndex((s) => NEEDS_STATS.has(s.tool));
    expect(firstNeedingStats).toBeGreaterThanOrEqual(0);
    expect(statsAt).toEqual([firstNeedingStats]);
    expect(endpointOf(sampleCalls[firstNeedingStats].calls[0])).toBe('stats');
    expect(sampleCalls.some((s) => s.tool === 'search_stats')).toBe(true);

    // C-12: every rates sample uses one league, so poe.ninja is fetched exactly once, by the first
    // sample that reads rates; later ones (get_currency_rates included) use the cached rates.
    const ninjaAt = sampleCalls.flatMap((s, k) => s.calls.filter((c) => endpointOf(c) === 'ninja').map(() => k));
    const firstNeedingRates = sampleCalls.findIndex((s) => NEEDS_RATES.has(s.tool));
    expect(firstNeedingRates).toBeGreaterThanOrEqual(0);
    expect(ninjaAt).toEqual([firstNeedingRates]);
    expect(sampleCalls.some((s) => s.tool === 'get_currency_rates')).toBe(true);
  });
});
