/**
 * Lua Client Manager
 *
 * Manages the lifecycle of the PoB Lua Bridge (stdio headless mode)
 */

import { PoBLuaApiClient } from '../pobLuaBridge.js';
import { resolvePobSrc, type PobPathEnv } from '../engine/pobPath.js';
import { checkPin, readPin } from '../engine/pinCheck.js';

export interface LuaClientManagerOptions {
  /** deps.env (C-7): engine location, command, timeouts and the child's base env. */
  env: PobPathEnv;
  /** deps.spawn (C-7): the engine process factory. */
  spawn: typeof import('child_process').spawn;
}

export class LuaClientManager {
  private client: PoBLuaApiClient | null = null;
  private env: PobPathEnv;
  private spawn: typeof import('child_process').spawn;

  /** Constructing the manager starts nothing: the engine starts lazily on the first engine call (D-14). */
  constructor(options: LuaClientManagerOptions) {
    this.env = options.env;
    this.spawn = options.spawn;
  }

  /**
   * Get the current client instance
   */
  getClient(): PoBLuaApiClient | null {
    return this.client;
  }

  /**
   * Ensure the Lua client is initialized and ready
   */
  async ensureClient(): Promise<void> {
    if (this.client) {
      if (this.client.isAlive()) {
        return; // Already initialized and healthy
      }
      // Process died — clean up the dead client so we restart below
      console.error('[Lua Bridge] Client process died, restarting...');
      try { await this.client.stop(); } catch {}
      this.client = null;
    }

    // Refuse an unpinned PoB checkout before spawning anything (C-6).
    const pobSrc = resolvePobSrc(this.env);
    const pin = await checkPin({
      pobSrc,
      pin: readPin(),
      allowUnpinned: this.env.POB_ALLOW_UNPINNED === 'true',
    });
    if (!pin.ok) {
      console.error(`[Lua Bridge] Pin check failed: ${pin.reason}`);
      throw new Error(`The PoB checkout at ${pobSrc} does not match the pin (pob-pin.json): ${pin.reason}. To fix, ${pin.hint}.`);
    }
    for (const warning of pin.warnings) {
      console.error(`[Lua Bridge] POB_ALLOW_UNPINNED=true, continuing despite: ${warning}`);
    }

    console.error('[Lua Bridge] Initializing client...');

    let stdioClient: PoBLuaApiClient | null = null;
    try {
      stdioClient = new PoBLuaApiClient({
        cwd: pobSrc,
        cmd: this.env.POB_CMD,
        args: this.env.POB_ARGS ? [this.env.POB_ARGS] : undefined,
        timeoutMs: this.env.POB_TIMEOUT_MS ? parseInt(this.env.POB_TIMEOUT_MS) : undefined,
        env: this.env,
        spawn: this.spawn,
      });
      // Readiness probe (D-29): the ready banner, which start() waits for, plus one `ping`. No XML
      // is loaded: a probe load would replace the engine's build.
      await stdioClient.start();
      if (!(await stdioClient.ping())) {
        throw new Error('the engine did not answer ping after its ready banner');
      }
      this.client = stdioClient;

      console.error('[Lua Bridge] Client initialized successfully');
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error('[Lua Bridge] Failed to initialize:', errorMsg);
      // Never leave a half-started engine behind.
      if (stdioClient) {
        try { await stdioClient.stop(); } catch { /* already gone */ }
      }
      this.client = null;
      throw new Error(`Failed to start PoB Lua Bridge: ${errorMsg}`);
    }
  }

  /**
   * Stop the Lua client
   */
  async stopClient(): Promise<void> {
    if (this.client) {
      console.error('[Lua Bridge] Stopping client...');
      try {
        await this.client.stop();
      } catch (error) {
        console.error('[Lua Bridge] Error stopping client:', error);
      }
      this.client = null;
    }
  }

  /** The running engine's process id, if any (test hook, C-3). */
  enginePid(): number | null {
    return this.client?.pid() ?? null;
  }
}
