/**
 * Lua Client Manager
 *
 * Holds the one bridge client (C-4) and starts it lazily on the first engine call (D-14). The pin
 * check, the banner checks and the `ping` readiness probe all live in the client's single-flight
 * `start()`. WU-08 folds this manager into the engine session (C-3), which becomes the only caller of
 * `start()` (D-59).
 */

import { PoBLuaApiClient } from '../pobLuaBridge.js';
import { resolvePobApiDir, resolvePobSrc, type PobPathEnv } from '../engine/pobPath.js';
import { readPin } from '../engine/pinCheck.js';

export interface LuaClientManagerOptions {
  /** deps.env (C-7): engine location, command, timeouts and the child's base env. */
  env: PobPathEnv;
  /** deps.spawn (C-7): the engine process factory. */
  spawn: typeof import('child_process').spawn;
}

export class LuaClientManager {
  /** The client handed to handlers: set after a successful start, cleared when a (re)start fails. */
  private client: PoBLuaApiClient | null = null;
  /** The one bridge client, created on first use. */
  private bridge: PoBLuaApiClient | null = null;
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
    if (this.bridge?.isAlive()) return;
    if (this.client) console.error('[Lua Bridge] Client process died, restarting...');

    try {
      this.bridge ??= new PoBLuaApiClient({
        env: this.env,
        spawn: this.spawn,
        pobSrc: resolvePobSrc(this.env),
        pobApiDir: resolvePobApiDir(),
        pin: readPin(),
      });
      // Pin check, banner checks and the `ping` readiness probe (D-29); single-flight.
      await this.bridge.start();
      this.client = this.bridge;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error('[Lua Bridge] Failed to initialize:', errorMsg);
      this.client = null;
      throw new Error(`Failed to start PoB Lua Bridge: ${errorMsg}`);
    }
  }

  /**
   * Stop the Lua client
   */
  async stopClient(): Promise<void> {
    const bridge = this.bridge;
    this.client = null;
    if (!bridge) return;
    console.error('[Lua Bridge] Stopping client...');
    try {
      await bridge.stop();
    } catch (error) {
      console.error('[Lua Bridge] Error stopping client:', error);
    }
  }

  /** The running engine's process id, if any (test hook, C-3). */
  enginePid(): number | null {
    return this.bridge?.pid() ?? null;
  }
}
