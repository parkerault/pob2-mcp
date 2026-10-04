/**
 * AC-F4 (I-7, in process): an unpinned PoB checkout disables only the engine tools.
 *
 * `env.POB_FORK_PATH` points at AC-F3 case (b)'s synthetic tree: the pin's manifest version and
 * commit, the pinned `HeadlessWrapper.lua`, and `src/Modules/CalcDefence.lua` with one byte changed
 * against its manifest sha1. With a `spawn` spy and HTTP only through `fixtureFetch`:
 * - `lua_get_build_info` is a tool error naming `mise run pob:fetch` and `CalcDefence.lua`;
 * - `get_leagues` (route `trade2/data-leagues`) and `get_currency_rates` (route
 *   `poeninja/currency-overview`) still succeed;
 * - the engine is never spawned.
 */
import fs from 'fs';
import os from 'os';
import path from 'path';
import { spawn } from 'child_process';
import { describe, it, expect, beforeAll, afterAll, jest } from '@jest/globals';
import { startTestServer, type TestServer } from '../helpers/server';
import { fixtureFetch } from '../helpers/fixtureFetch';
import { manifestSha1, readPin } from '../../src/engine/pinCheck';

const REPO = path.resolve(__dirname, '..', '..');
const VENDOR_SRC = path.join(REPO, 'vendor', 'PathOfBuilding-PoE2', 'src');
const CALC_DEFENCE = 'Modules/CalcDefence.lua';

/** AC-F3 case (b) against the real pin: same version and commit, one CalcDefence.lua byte changed. */
function makeCaseBTree(root: string): string {
  const pin = readPin(REPO);
  const src = path.join(root, 'src');
  fs.mkdirSync(path.join(src, 'Modules'), { recursive: true });

  // The pinned wrapper, so only CalcDefence.lua differs from the pin.
  fs.copyFileSync(path.join(VENDOR_SRC, 'HeadlessWrapper.lua'), path.join(src, 'HeadlessWrapper.lua'));
  expect(manifestSha1(fs.readFileSync(path.join(src, 'HeadlessWrapper.lua')))).toBe(pin.headlessWrapperSha1);

  const original = fs.readFileSync(path.join(VENDOR_SRC, CALC_DEFENCE));
  const changed = Buffer.from(original);
  changed[0] = changed[0] ^ 0x01;
  fs.writeFileSync(path.join(src, CALC_DEFENCE), changed);

  fs.writeFileSync(
    path.join(root, 'manifest.xml'),
    `<?xml version='1.0' encoding='UTF-8'?>\n<PoBVersion>\n\t<Version number="${pin.version}" />\n` +
      `\t<File name="${CALC_DEFENCE}" part="program" sha1="${manifestSha1(original)}" />\n</PoBVersion>\n`,
  );
  fs.mkdirSync(path.join(root, '.git'));
  fs.writeFileSync(path.join(root, '.git', 'HEAD'), `${pin.commit}\n`);
  return src;
}

function textOf(result: unknown): string {
  return ((result as { content?: Array<{ text?: string }> }).content ?? []).map((c) => c.text ?? '').join('\n');
}

describe('AC-F4: pin refusal in process', () => {
  let tmp: string;
  let server: TestServer;
  const spawnSpy = jest.fn(spawn);
  const http = fixtureFetch([
    { match: /\/api\/trade2\/data\/leagues/, respond: { fixture: 'trade2/data-leagues' } },
    { match: /^https:\/\/poe\.ninja\//, respond: { fixture: 'poeninja/currency-overview' } },
  ]);

  beforeAll(async () => {
    if (!fs.existsSync(path.join(VENDOR_SRC, 'HeadlessWrapper.lua'))) {
      throw new Error(`${VENDOR_SRC} is missing: run \`mise run pob:fetch\``);
    }
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'pob2-pin-refusal-'));
    const pobSrc = makeCaseBTree(tmp);
    server = await startTestServer({
      fetch: http.fetch,
      spawn: spawnSpy as unknown as typeof spawn,
      env: {
        POB_FORK_PATH: pobSrc,
        POB_ALLOW_UNPINNED: undefined,
        POE_TRADE_DISABLED: undefined,
        POE_NINJA_DISABLED: undefined,
      },
    });
  });

  afterAll(async () => {
    if (server) await server.close();
    if (tmp) fs.rmSync(tmp, { recursive: true, force: true });
  });

  it('AC-F4: lua_get_build_info is a tool error naming "mise run pob:fetch" and CalcDefence.lua', async () => {
    const result = await server.client.callTool({ name: 'lua_get_build_info', arguments: {} });
    expect(result.isError).toBe(true);
    const text = textOf(result);
    expect(text).toContain('mise run pob:fetch');
    expect(text).toContain('CalcDefence.lua');
  });

  it('AC-F4: get_leagues still works (fixture route trade2/data-leagues)', async () => {
    const before = http.calls.length;
    const result = await server.client.callTool({ name: 'get_leagues', arguments: {} });
    expect(result.isError).not.toBe(true);
    expect(textOf(result)).toContain('Runes of Aldur');
    const leagueCalls = http.calls.slice(before).filter((c) => /\/data\/leagues/.test(c.url));
    expect(leagueCalls.length).toBeGreaterThanOrEqual(1);
    expect(leagueCalls.every((c) => c.method === 'GET')).toBe(true);
  });

  it('AC-F4: get_currency_rates still works (fixture route poeninja/currency-overview)', async () => {
    const before = http.calls.length;
    const result = await server.client.callTool({ name: 'get_currency_rates', arguments: { league: 'Runes of Aldur' } });
    expect(result.isError).not.toBe(true);
    const ninjaCalls = http.calls.slice(before).filter((c) => /^https:\/\/poe\.ninja\//.test(c.url));
    expect(ninjaCalls.length).toBeGreaterThanOrEqual(1);
    expect(ninjaCalls.every((c) => c.method === 'GET')).toBe(true);
  });

  it('AC-F4: the spawn spy was never called', () => {
    expect(spawnSpy).toHaveBeenCalledTimes(0);
  });
});
