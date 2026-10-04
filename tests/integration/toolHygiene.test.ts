/**
 * AC-F26 (I-4b–d): tool output hygiene, engine-required and in process.
 *
 * For every sample in `tests/fixtures/tool-calls.json` (`{tool, args, expect: "ok" | "error", setup?,
 * reason?}`), the test re-copies the golden build into a private temp builds folder, reloads it with
 * `lua_load_build`, runs the sample's `setup` steps, then calls the sample, with trade and poe.ninja
 * HTTP served by `fixtureFetch`. Checks:
 * - (i)   the text contains none of `undefined`, `NaN`, `[object Object]`;
 * - (ii)  `expect: "ok"` ⇒ `isError` is not true (a failing setup step fails this check too, because
 *         the sample then does not exercise what it claims);
 * - (iii) `expect: "error"` ⇒ `isError: true`.
 *
 * Every listed tool has at least one `expect: "ok"` sample; `expect: "error"` samples are additional
 * and carry a `reason`. A failing check is tolerated only when `tests/fixtures/tool-hygiene-allowlist.json`
 * has a matching `{tool, check, owner}` entry, and an allowlisted check that passes fails the test with
 * "remove <tool>/<check> from the allowlist" (D-45).
 *
 * Sample args may use these placeholders, resolved from committed fixtures:
 * - `"$RUBY_RING_TEXT"`: `tests/fixtures/items/ruby-ring.txt`;
 * - `"$GOLDEN_BUILD_CODE"`: the golden build as a PoB export code (base64url of zlib-deflated XML);
 * - `"$ALLOCATED_NODES"`: the golden build's allocated node ids (its `<Spec nodes>`), as numbers.
 */
import fs from 'fs';
import os from 'os';
import path from 'path';
import zlib from 'zlib';
import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { startTestServer, type TestServer } from '../helpers/server';
import { fixtureFetch } from '../helpers/fixtureFetch';
import { engineDescribe } from '../helpers/engine';

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
  text: string;
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
  $GOLDEN_BUILD_CODE: zlib.deflateSync(Buffer.from(goldenXml, 'utf8')).toString('base64').replace(/\+/g, '-').replace(/\//g, '_'),
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

const allowed = (tool: string, check: Check) => ALLOWLIST.some((e) => e.tool === tool && e.check === check);
const excerpt = (text: string) => (text.length > 600 ? `${text.slice(0, 600)}…` : text);

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

engineDescribe('AC-F26: tool output hygiene on the golden build', () => {
  let tmp: string;
  let builds: string;
  let server: TestServer;
  /** `<tool>/<check>` → one entry per sample run: did the check fail? */
  const results = new Map<string, boolean[]>();
  let samplesRun = 0;

  const call = async (tool: string, args: Record<string, unknown>): Promise<Outcome> => {
    try {
      const result = (await server.client.callTool({ name: tool, arguments: resolve(args) as Record<string, unknown> }, undefined, {
        timeout: CALL_TIMEOUT_MS,
      })) as { isError?: boolean; content?: Array<{ type: string; text?: string }> };
      const text = (result.content ?? []).map((c) => (c.type === 'text' ? (c.text ?? '') : `[${c.type} content]`)).join('\n');
      return { isError: result.isError === true, text };
    } catch (error) {
      // A protocol error (e.g. -32602 for an unlisted tool) is not a tool result at all.
      return { isError: false, text: `<protocol error> ${error instanceof Error ? error.message : String(error)}` };
    }
  };

  beforeAll(async () => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'pob2-hygiene-'));
    builds = path.join(tmp, 'builds');
    fs.mkdirSync(builds);
    const http = fixtureFetch([
      { match: /\/api\/trade2\/data\/leagues/, respond: { fixture: 'trade2/data-leagues' } },
      { match: /\/api\/trade2\/data\/stats/, respond: { fixture: 'trade2/data-stats' } },
      { match: /\/api\/trade2\/search\//, respond: { fixture: 'trade2/search-ring-divine' } },
      { match: /\/api\/trade2\/fetch\//, respond: { fixture: 'trade2/fetch-ring-divine' } },
      { match: /^https:\/\/poe\.ninja\//, respond: { fixture: 'poeninja/currency-overview' } },
    ]);
    server = await startTestServer({
      fetch: http.fetch,
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
      const load = await call('lua_load_build', { build_name: 'grenadator.xml' });
      if (load.isError) throw new Error(`reloading the golden build failed: ${load.text}`);

      // 3. Setup steps.
      const setupFailures: string[] = [];
      for (const step of sample.setup ?? []) {
        const out = await call(step.tool, step.args);
        if (out.isError || out.text.startsWith('<protocol error>')) setupFailures.push(`${step.tool}: ${excerpt(out.text)}`);
      }

      // 4. The sample.
      const out = await call(sample.tool, sample.args);
      samplesRun++;

      const failed: Partial<Record<Check, string>> = {};
      const junk = JUNK.filter((j) => out.text.includes(j));
      if (junk.length > 0) failed.i = `text contains ${junk.map((j) => JSON.stringify(j)).join(', ')}`;
      if (sample.expect === 'ok' && (out.isError || setupFailures.length > 0 || out.text.startsWith('<protocol error>'))) {
        failed.ii = setupFailures.length > 0 ? `setup failed: ${setupFailures.join('; ')}` : 'isError is true';
      }
      if (sample.expect === 'error' && !out.isError) failed.iii = 'isError is not true';

      const checks: Check[] = sample.expect === 'ok' ? ['i', 'ii'] : ['i', 'iii'];
      for (const check of checks) {
        const key = `${sample.tool}/${check}`;
        results.set(key, [...(results.get(key) ?? []), failed[check] !== undefined]);
      }

      const unexpected = (Object.keys(failed) as Check[]).filter((c) => !allowed(sample.tool, c));
      if (unexpected.length > 0) {
        throw new Error(
          unexpected.map((c) => `check (${c}) failed for ${sample.tool}: ${failed[c]}`).join('\n') +
            `\n--- output ---\n${excerpt(out.text)}`,
        );
      }
    }, CALL_TIMEOUT_MS + 60000);
  });

  it('AC-F26: no allowlisted check passes (stale entries fail, D-45)', () => {
    expect(samplesRun).toBe(SAMPLES.length);
    const stale = ALLOWLIST.filter((e) => {
      const runs = results.get(`${e.tool}/${e.check}`) ?? [];
      return !runs.some((didFail) => didFail);
    }).map((e) => `remove ${e.tool}/${e.check} from the allowlist`);
    expect(stale).toEqual([]);
  });
});
