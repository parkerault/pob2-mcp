#!/usr/bin/env node
/**
 * The MCP half of the fresh-clone check (AC-G4); `scripts/fresh-clone-check.sh` runs it inside the
 * fresh clone after `mise run setup`:
 *
 *   node scripts/fresh-clone-check.mjs <clone dir> <state dir>
 *
 * It starts `node <clone>/build/index.js` over stdio with an explicit env (never the caller's
 * cookie), from its own cwd (the caller's temp dir), and checks:
 *  1. `tools/list` returns the full tool set (82 tools, D-91, C-37, C-42, C-38, C-40, C-39) when every group is enabled;
 *  2. with the check env below, `lua_load_build {build_name: "grenadator.xml"}` reports Life 2,977;
 *  3. `find_upgrades {slot: "Ring 1"}` returns a result that starts with `Trade search not run:`
 *     (no session: D-49 decides that before any network request).
 *
 * The check env: POB_DIRECTORY=<clone>/tests/fixtures/builds, XDG_STATE_HOME=<state dir>,
 * POE_LEAGUE="Forbidden Rites", POE_TRADE_BASE=http://127.0.0.1:9/api/trade2 (a tripwire: any trade
 * request fails), POE_NINJA_DISABLED=true, and no POESESSID/POE_SESSION_ID. The listing of step 1
 * runs on a server without POE_NINJA_DISABLED, because that flag hides the ninja group's tool
 * (C-1); that server is only listed, never called. The check server lists the other 81.
 *
 * Exits 0 when every step passes, 1 otherwise. It makes no request itself.
 */
import path from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const EXPECTED_TOOLS = 82;
const NINJA_TOOLS = ['get_currency_rates'];
const CALL_TIMEOUT_MS = 180_000;

const [cloneArg, stateArg] = process.argv.slice(2);
if (!cloneArg || !stateArg) {
  console.error('usage: node scripts/fresh-clone-check.mjs <clone dir> <state dir>');
  process.exit(2);
}
const CLONE = path.resolve(cloneArg);
const STATE = path.resolve(stateArg);
const ENTRY = path.join(CLONE, 'build', 'index.js');

/** The explicit server env: only what a host would pass, plus the check settings. */
function serverEnv({ ninjaDisabled }) {
  const env = {};
  // The server finds luajit and node on PATH (set by `mise exec`); HOME and LANG are the usual basics.
  for (const k of ['PATH', 'HOME', 'LANG', 'LC_ALL', 'TMPDIR']) {
    if (process.env[k] !== undefined) env[k] = process.env[k];
  }
  Object.assign(env, {
    POB_DIRECTORY: path.join(CLONE, 'tests', 'fixtures', 'builds'),
    XDG_STATE_HOME: STATE,
    POE_LEAGUE: 'Forbidden Rites',
    POE_TRADE_BASE: 'http://127.0.0.1:9/api/trade2',
  });
  if (ninjaDisabled) env.POE_NINJA_DISABLED = 'true';
  return env;
}

let failures = 0;
function pass(msg) {
  console.log(`ok   ${msg}`);
}
function fail(msg) {
  failures += 1;
  console.log(`FAIL ${msg}`);
}

async function startServer(env) {
  for (const k of ['POESESSID', 'POE_SESSION_ID']) {
    if (k in env) throw new Error(`refusing to start the server with ${k} set`);
  }
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [ENTRY],
    env,
    cwd: process.cwd(),
    stderr: 'pipe',
  });
  let stderr = '';
  transport.stderr?.on('data', (chunk) => {
    stderr += chunk.toString();
  });
  const client = new Client({ name: 'pob2-mcp-fresh-clone-check', version: '0.0.0' });
  await client.connect(transport);
  return {
    client,
    stderr: () => stderr,
    close: () => client.close(),
  };
}

function textOf(result) {
  return (result.content ?? []).map((c) => (c.type === 'text' ? c.text : '')).join('\n');
}

async function checkFullListing() {
  const server = await startServer(serverEnv({ ninjaDisabled: false }));
  try {
    const { tools } = await server.client.listTools();
    if (tools.length === EXPECTED_TOOLS) pass(`tools/list returns ${tools.length} tools`);
    else fail(`tools/list returned ${tools.length} tools, expected ${EXPECTED_TOOLS}`);
  } finally {
    await server.close();
  }
}

async function checkEngineAndFallback() {
  const server = await startServer(serverEnv({ ninjaDisabled: true }));
  try {
    const { tools } = await server.client.listTools();
    const names = new Set(tools.map((t) => t.name));
    const expected = EXPECTED_TOOLS - NINJA_TOOLS.length;
    if (tools.length === expected && NINJA_TOOLS.every((n) => !names.has(n))) {
      pass(`with POE_NINJA_DISABLED=true, tools/list returns ${tools.length} tools (no ${NINJA_TOOLS.join(', ')})`);
    } else {
      fail(`with POE_NINJA_DISABLED=true, tools/list returned ${tools.length} tools, expected ${expected}`);
    }

    const load = await server.client.callTool(
      { name: 'lua_load_build', arguments: { build_name: 'grenadator.xml' } },
      undefined,
      { timeout: CALL_TIMEOUT_MS },
    );
    const loadText = textOf(load);
    if (!load.isError && /\bLife: 2,?977\b/.test(loadText)) {
      pass('lua_load_build {build_name:"grenadator.xml"} reports Life 2,977');
    } else {
      fail(`lua_load_build did not report Life 2,977 (isError=${load.isError === true}):\n${loadText}`);
    }

    const upgrades = await server.client.callTool(
      { name: 'find_upgrades', arguments: { slot: 'Ring 1' } },
      undefined,
      { timeout: CALL_TIMEOUT_MS },
    );
    const upgradesText = textOf(upgrades);
    if (!upgrades.isError && upgradesText.startsWith('Trade search not run:')) {
      pass(`find_upgrades {slot:"Ring 1"} -> ${upgradesText.split('\n')[0]}`);
    } else {
      fail(`find_upgrades {slot:"Ring 1"} did not fall back (isError=${upgrades.isError === true}):\n${upgradesText}`);
    }
  } catch (error) {
    fail(`server error: ${error instanceof Error ? error.message : String(error)}`);
    console.log(`--- server stderr (last 40 lines) ---\n${server.stderr().split('\n').slice(-40).join('\n')}`);
  } finally {
    await server.close();
  }
}

try {
  await checkFullListing();
  await checkEngineAndFallback();
} catch (error) {
  fail(error instanceof Error ? error.message : String(error));
}
console.log(failures === 0 ? 'fresh-clone MCP checks: all passed' : `fresh-clone MCP checks: ${failures} failed`);
process.exit(failures === 0 ? 0 : 1);
