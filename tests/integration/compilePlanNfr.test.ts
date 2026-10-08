/**
 * AC-P37 (WU-41, NFR-20, NFR-21, D-229, review S17): the compile-time NFRs, engine-required.
 *
 * A final compile of the fifteen-stage fixture (`tests/fixtures/plans/fifteen-stage/plan.json`, WU-30's
 * synthetic worst case in P1 form: 15 stages at levels 2 to 90 with no set sharing, trees growing to 123
 * regular points with 24 weapon-set tags and 8 ascendancy nodes, all 18 item slots and up to 4 tree jewels,
 * 6 socket groups of 6 gems per stage) takes at most 100 s of wall time (NFR-20), and every stage's
 * `compile_stage` request under 20 s (NFR-21). The compiled file has 15 loadouts and no socket group in
 * Full DPS (WU-30: with every group in Full DPS a contended stage took 25.5 s).
 *
 * This file runs alone: `jest.config.cjs` leaves it out of the parallel run, and `mise run test` runs it in
 * its own `--runInBand` step after `pnpm test` (C-19), so other suites don't compete with its 100 s threshold.
 * The static checks of that wiring are in `compilePlan.test.ts`.
 */
import fs from 'fs';
import path from 'path';
import { afterAll, beforeAll, expect, it } from '@jest/globals';
import { engineDescribe } from '../helpers/engine';
import { startSessionFixture, type SessionFixture } from '../helpers/engineSession';
import type { CompileRecord } from '../../src/plan/record';

const FIXTURE = path.resolve(__dirname, '..', 'fixtures', 'plans', 'fifteen-stage', 'plan.json');
const WHOLE_CALL_MS = 100_000;
const STAGE_MS = 20_000;

engineDescribe('AC-P37 (NFR-20, NFR-21): a fifteen-stage final compile', () => {
  let f: SessionFixture;

  beforeAll(async () => {
    f = await startSessionFixture();
    // The engine is already running, as on a server that has served calls (WU-30's method).
    const info = await f.call('lua_get_build_info');
    if (info.isError) throw new Error(info.text);
  }, 120_000);

  afterAll(async () => f?.close(), 60_000);

  it('AC-P37: compiles in at most 100 s, every stage request under 20 s, 15 loadouts and nothing in Full DPS', async () => {
    const run = await f.call('guide_run', { new_run: 'nfr-fifteen-stage' });
    expect(run.isError).toBe(false);
    const planPath = /^plan_path for this run: (\S+)$/m.exec(run.text)![1];
    fs.copyFileSync(FIXTURE, path.join(f.guides, planPath));

    const t0 = performance.now();
    const out = await f.server.client.callTool(
      { name: 'compile_plan', arguments: { plan_path: planPath, build_name: 'nfr-fifteen-stage' } },
      undefined,
      { timeout: 140_000 },
    );
    const wallMs = performance.now() - t0;
    const text = (out.content as Array<{ text: string }>).map((c) => c.text).join('\n');
    expect({ isError: out.isError === true, text: out.isError ? text : '' }).toEqual({ isError: false, text: '' });

    const record = JSON.parse(
      fs.readFileSync(path.join(f.guides, path.posix.dirname(planPath), 'compile-record.json'), 'utf8'),
    ) as CompileRecord;
    const stageMs = Object.fromEntries(Object.entries(record.stages).map(([id, s]) => [id, Math.round(s.elapsedMs)]));
    console.error(
      `[NFR] fifteen-stage compile: wall ${(wallMs / 1000).toFixed(2)} s, record ${(record.timing.totalMs / 1000).toFixed(2)} s, ` +
        `slowest stage ${(Math.max(...Object.values(stageMs)) / 1000).toFixed(2)} s; per stage (ms) ${JSON.stringify(stageMs)}`,
    );
    expect(record.stagesCompiled).toHaveLength(15);
    expect(wallMs).toBeLessThanOrEqual(WHOLE_CALL_MS);
    expect(record.timing.totalMs).toBeLessThanOrEqual(WHOLE_CALL_MS);
    for (const [id, ms] of Object.entries(record.stages).map(([id, s]) => [id, s.elapsedMs] as const)) {
      expect({ stage: id, under20s: ms < STAGE_MS }).toEqual({ stage: id, under20s: true });
    }

    const xml = fs.readFileSync(path.join(f.builds, 'nfr-fifteen-stage.xml'), 'utf8');
    expect((xml.match(/<Spec\b/g) ?? []).length).toBe(15);
    expect(xml).not.toContain('includeInFullDPS="true"');
  }, 150_000);
});
