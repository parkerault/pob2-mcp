/**
 * Lua Client Manager
 *
 * Manages the lifecycle of the PoB Lua Bridge (stdio headless mode)
 */

import { PoBLuaApiClient } from '../pobLuaBridge.js';
import { resolvePobSrc, type PobPathEnv } from '../engine/pobPath.js';
import { checkPin, readPin } from '../engine/pinCheck.js';

export class LuaClientManager {
  private client: PoBLuaApiClient | null = null;
  private enabled: boolean;
  private env: PobPathEnv;

  constructor(enabled: boolean, env: PobPathEnv = process.env) {
    this.enabled = enabled;
    this.env = env;
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
    if (!this.enabled) {
      throw new Error('PoB Lua Bridge is not enabled. Set POB_LUA_ENABLED=true to use lua_* tools.');
    }

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

    try {
      const stdioClient = new PoBLuaApiClient({
        cwd: pobSrc,
        cmd: this.env.POB_CMD,
        args: this.env.POB_ARGS ? [this.env.POB_ARGS] : undefined,
        timeoutMs: this.env.POB_TIMEOUT_MS ? parseInt(this.env.POB_TIMEOUT_MS) : undefined,
      });
      await stdioClient.start();
      this.client = stdioClient;

      console.error('[Lua Bridge] Client initialized successfully');

      // Wait for HeadlessWrapper to be fully ready (loadBuildFromXML available)
      console.error('[Lua Bridge] Waiting for HeadlessWrapper to finish loading...');
      const testXml = '<?xml version="1.0" encoding="UTF-8"?><PathOfBuilding><Build level="1" className="Witch"/></PathOfBuilding>';
      let attempts = 0;
      const maxAttempts = 5;

      while (attempts < maxAttempts) {
        try {
          await this.client.loadBuildXml(testXml, 'Init Test');
          console.error('[Lua Bridge] HeadlessWrapper fully initialized');
          break;
        } catch (loadError) {
          attempts++;
          if (attempts >= maxAttempts) {
            throw new Error(`HeadlessWrapper did not initialize after ${maxAttempts} attempts. Error: ${loadError instanceof Error ? loadError.message : String(loadError)}`);
          }
          console.error(`[Lua Bridge] HeadlessWrapper not ready (attempt ${attempts}/${maxAttempts}), waiting 2s...`);
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error('[Lua Bridge] Failed to initialize:', errorMsg);
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

  /**
   * Check if Lua bridge is enabled
   */
  isEnabled(): boolean {
    return this.enabled;
  }
}
