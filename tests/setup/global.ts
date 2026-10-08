/**
 * Jest globalSetup (C-18). Runs once, before any worker starts, and edits the real `process.env`
 * that workers and every process they spawn inherit:
 *  - the trade cookie variables are deleted (FR-F5);
 *  - POB_DIRECTORY and XDG_STATE_HOME point at fresh temp dirs; the builds dir holds a copy of the
 *    golden build;
 *  - POB_GUIDES_DIRECTORY points at a fresh, empty temp dir (C-34, AC-B6), so no test resolves the
 *    default guides folder beside the user's builds folder;
 *  - the engine is probed once (unless POB_SKIP_ENGINE=1) and the verdict goes to POB_TEST_ENGINE:
 *    "ok", or the cause engine-required tests fail with (engineDescribe).
 */
import fs from 'fs';
import os from 'os';
import path from 'path';
import Module from 'module';

const REPO = path.resolve(__dirname, '..', '..');
const GOLDEN = path.join(REPO, 'tests', 'fixtures', 'builds', 'grenadator.xml');
const STDERR_LINES_SHOWN = 20;

/**
 * globalSetup modules are transpiled by Jest but resolved by Node, without `moduleNameMapper`.
 * `src/` uses ESM-style `./x.js` specifiers for `.ts` files, so map a missing `.js` to its `.ts`.
 */
function allowTsSpecifiers(): () => void {
  const mod = Module as unknown as {
    _resolveFilename: (request: string, ...rest: unknown[]) => string;
  };
  const original = mod._resolveFilename;
  mod._resolveFilename = function (request: string, ...rest: unknown[]) {
    try {
      return original.call(this, request, ...rest);
    } catch (error) {
      if (request.startsWith('.') && request.endsWith('.js')) {
        return original.call(this, request.slice(0, -3) + '.ts', ...rest);
      }
      throw error;
    }
  };
  return () => {
    mod._resolveFilename = original;
  };
}

/** Is `cmd` an executable on PATH (or an existing path)? */
function onPath(cmd: string, envPath: string | undefined): boolean {
  if (cmd.includes('/')) return fs.existsSync(cmd);
  for (const dir of (envPath ?? '').split(path.delimiter)) {
    if (!dir) continue;
    try {
      fs.accessSync(path.join(dir, cmd), fs.constants.X_OK);
      return true;
    } catch {
      // keep looking
    }
  }
  return false;
}

/** Start the bridge once, ping it, quit. Returns "ok" or the failure cause (C-18). */
async function probeEngine(): Promise<string> {
  const restore = allowTsSpecifiers();
  try {
    const { resolvePobSrc } = require('../../src/engine/pobPath') as typeof import('../../src/engine/pobPath');
    const { checkPin, readPin } = require('../../src/engine/pinCheck') as typeof import('../../src/engine/pinCheck');
    const { PoBLuaApiClient } = require('../../src/pobLuaBridge') as typeof import('../../src/pobLuaBridge');

    const env = process.env;
    const pobSrc = resolvePobSrc(env);
    if (!fs.existsSync(path.join(pobSrc, 'HeadlessWrapper.lua'))) {
      return 'vendor missing (run `mise run pob:fetch`)';
    }

    const pin = await checkPin({ pobSrc, pin: readPin(REPO), allowUnpinned: env.POB_ALLOW_UNPINNED === 'true' });
    if (!pin.ok) return `pin mismatch: ${pin.reason}`;

    const cmd = env.POB_CMD || 'luajit';
    if (!onPath(cmd, env.PATH)) return 'luajit not found (run via `mise run test`)';

    // The bridge logs the engine's stderr through console.error; keep the tail for the cause.
    const stderrTail: string[] = [];
    const originalError = console.error;
    console.error = (...args: unknown[]) => {
      const line = args.map(String).join(' ');
      if (line.startsWith('[PoB API stderr]')) {
        stderrTail.push(line.slice('[PoB API stderr]'.length).trim());
        if (stderrTail.length > STDERR_LINES_SHOWN) stderrTail.shift();
      }
    };
    const { spawn } = require('child_process') as typeof import('child_process');
    const { resolvePobApiDir } = require('../../src/engine/pobPath') as typeof import('../../src/engine/pobPath');
    const client = new PoBLuaApiClient({
      env: { ...env, POB_TIMEOUT_MS: '60000' },
      spawn,
      pobSrc,
      pobApiDir: resolvePobApiDir(),
      pin: readPin(REPO),
    });
    try {
      await client.start();
      if (!(await client.ping())) throw new Error('ping was not ok');
      return 'ok';
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      if (/ENOENT|luajit not found/i.test(msg)) return 'luajit not found (run via `mise run test`)';
      const tail = stderrTail.length ? stderrTail.join('\n') : msg;
      return `bridge start failed: ${tail}`;
    } finally {
      await client.stop().catch(() => undefined);
      console.error = originalError;
    }
  } finally {
    restore();
  }
}

export default async function globalSetup(): Promise<void> {
  delete process.env.POESESSID;
  delete process.env.POE_SESSION_ID;

  const builds = fs.mkdtempSync(path.join(os.tmpdir(), 'pob2-mcp-test-builds-'));
  fs.copyFileSync(GOLDEN, path.join(builds, 'grenadator.xml'));
  const state = fs.mkdtempSync(path.join(os.tmpdir(), 'pob2-mcp-test-state-'));
  const guides = fs.mkdtempSync(path.join(os.tmpdir(), 'pob2-mcp-test-guides-'));
  process.env.POB_DIRECTORY = builds;
  process.env.XDG_STATE_HOME = state;
  process.env.POB_GUIDES_DIRECTORY = guides;

  delete process.env.POB_TEST_ENGINE;
  if (process.env.POB_SKIP_ENGINE === '1') return;
  process.env.POB_TEST_ENGINE = await probeEngine();
}
