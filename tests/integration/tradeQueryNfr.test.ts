/**
 * AC-T22 (WU-16, NFR-5): weighted trade-query generation is fast enough, engine-required.
 *
 * Bridge-level, like `trade.lua.test.ts`: a real `PoBLuaApiClient` against real luajit, the pinned PoB
 * checkout and the golden build. Generation for five slots each completes in at most 8 s.
 *
 * This file runs alone: `jest.config.cjs` leaves it out of the parallel run, and `mise run test` runs it in
 * its own `--runInBand` step after `pnpm test` (C-19), beside the compile-time NFR test. Under the parallel
 * run's load its slowest slot took 9.4–10.1 s against 8 s, while it passed every time alone, so there the
 * threshold measured the machine's load, not the generator. The static checks of that wiring are in
 * `compilePlan.test.ts`.
 */
import fs from 'fs';
import os from 'os';
import path from 'path';
import { spawn } from 'child_process';
import { afterAll, beforeAll, expect, it } from '@jest/globals';
import { engineDescribe } from '../helpers/engine';
import { PoBLuaApiClient } from '../../src/pobLuaBridge';
import { resolvePobApiDir, resolvePobSrc } from '../../src/engine/pobPath';
import { readPin } from '../../src/engine/pinCheck';

const REPO = path.resolve(__dirname, '..', '..');
const GOLDEN = fs.readFileSync(path.join(REPO, 'tests', 'fixtures', 'builds', 'grenadator.xml'), 'utf8');
const ENGINE_TIMEOUT = 240_000;
const SLOT_MS = 8_000;

engineDescribe('AC-T22 (NFR-5): trade-query generation time', () => {
  /** This file's own temp builds dir (a copy of the golden build). */
  let buildsDir = '';
  let engine: PoBLuaApiClient;

  beforeAll(async () => {
    buildsDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pob2-mcp-trade-nfr-builds-'));
    fs.writeFileSync(path.join(buildsDir, 'grenadator.xml'), GOLDEN);
    engine = new PoBLuaApiClient({
      env: { ...process.env, POB_DIRECTORY: buildsDir, POB_API_TEST_ACTIONS: '1' },
      spawn,
      pobSrc: resolvePobSrc(process.env),
      pobApiDir: resolvePobApiDir(),
      pin: readPin(),
    });
    await engine.start();
    await engine.loadBuildXml(GOLDEN, 'grenadator');
  }, ENGINE_TIMEOUT);

  afterAll(async () => {
    await engine?.stop().catch(() => undefined);
    if (buildsDir) fs.rmSync(buildsDir, { recursive: true, force: true });
  });

  it(
    'AC-T22: generation for Body Armour, Weapon 1, Ring 1, Amulet and Boots each completes in ≤ 8 s with meta.calcCount ≥ 1',
    async () => {
      const elapsedMs: Record<string, number> = {};
      for (const slot of ['Body Armour', 'Weapon 1', 'Ring 1', 'Amulet', 'Boots']) {
        const t0 = performance.now();
        const result = await engine.tradeGenerateQuery({ slot });
        elapsedMs[slot] = performance.now() - t0;
        expect(result.meta.calcCount).toBeGreaterThanOrEqual(1);
      }
      // Reported as a whole, so a failure shows every slot's time.
      expect(Object.entries(elapsedMs).filter(([, ms]) => ms > SLOT_MS)).toEqual([]);
    },
    ENGINE_TIMEOUT,
  );
});
