/**
 * AC-P37 (WU-41, NFR-20, NFR-21, D-229, review S17): the compile-time NFRs, engine-required.
 *
 * A final compile of the fifteen-stage fixture (`tests/fixtures/plans/fifteen-stage/plan.json`, WU-30's
 * synthetic worst case in P1 form: 15 stages at levels 2 to 90 with no set sharing, trees growing to 123
 * regular points with 24 weapon-set tags and 8 ascendancy nodes, all 18 item slots and up to 4 tree jewels,
 * 6 socket groups of 6 gems per stage; unlike WU-30's 36 config writes per stage it writes 11, the options
 * with a C1/E1 source, which costs the same single config write per stage) takes at most 100 s of wall time
 * (NFR-20), and every stage's
 * `compile_stage` request under 20 s (NFR-21). The compiled file has 15 loadouts, and only the named source's
 * group (each stage's `rolledGroup`) is in Full DPS, with its Count; every other group stays out (D-293, D-337,
 * which narrow D-306: WU-51 measured Full DPS on the named groups at ×1.14 of the whole call).
 *
 * This file runs alone: `jest.config.cjs` leaves it out of the parallel run, and `mise run test` runs it in
 * its own `--runInBand` step after `pnpm test` (C-19), so other suites don't compete with its 100 s threshold.
 * The static checks of that wiring are in `compilePlan.test.ts`.
 *
 * WU-30's lever, on the same plan: the compile defers PoB's per-call output rebuilds while a stage's tree,
 * items, toggles, gems and config go in. The second test compiles the plan again with the deferral off
 * (`__noDeferForTest`, test actions only, rebuilding after every mutation as BuildOps does on its own) and
 * requires every stage's outputs and breakdown to be exactly equal. It runs after the timed test, so its
 * slower compile never counts against the threshold.
 */
import fs from 'fs';
import path from 'path';
import { afterAll, beforeAll, expect, it, jest } from '@jest/globals';
import { engineDescribe } from '../helpers/engine';
import { startSessionFixture, type SessionFixture } from '../helpers/engineSession';
import type { CompileRecord } from '../../src/plan/record';
import { PoBLuaApiClient } from '../../src/pobLuaBridge';

const FIXTURE = path.resolve(__dirname, '..', 'fixtures', 'plans', 'fifteen-stage', 'plan.json');
const WHOLE_CALL_MS = 100_000;
const STAGE_MS = 20_000;

engineDescribe('AC-P37 (NFR-20, NFR-21): a fifteen-stage final compile', () => {
  let f: SessionFixture;
  /** The timed compile's record, for the deferral check. */
  let timed: CompileRecord | null = null;

  beforeAll(async () => {
    f = await startSessionFixture({ testActions: true });
    // The engine is already running, as on a server that has served calls (WU-30's method).
    const info = await f.call('lua_get_build_info');
    if (info.isError) throw new Error(info.text);
  }, 120_000);

  afterAll(async () => f?.close(), 60_000);

  it('AC-P37: compiles in at most 100 s, every stage request under 20 s, 15 loadouts and only the named source\'s groups in Full DPS', async () => {
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
    timed = record;
    expect(record.stagesCompiled).toHaveLength(15);
    expect(wallMs).toBeLessThanOrEqual(WHOLE_CALL_MS);
    expect(record.timing.totalMs).toBeLessThanOrEqual(WHOLE_CALL_MS);
    for (const [id, ms] of Object.entries(record.stages).map(([id, s]) => [id, s.elapsedMs] as const)) {
      expect({ stage: id, under20s: ms < STAGE_MS }).toEqual({ stage: id, under20s: true });
    }

    const xml = fs.readFileSync(path.join(f.builds, 'nfr-fifteen-stage.xml'), 'utf8');
    expect((xml.match(/<Spec\b/g) ?? []).length).toBe(15);
    // D-293, D-337 (D-306 narrowed): per stage, its rolledGroup is in Full DPS with its groupCount; no other group is.
    const plan = JSON.parse(fs.readFileSync(FIXTURE, 'utf8')) as {
      stages: { id: string; skills: { rolledGroup?: number; groups: { count?: number }[] } }[];
    };
    const sets = new Map<string, string[]>();
    for (const m of xml.matchAll(/<SkillSet\b([^>]*)>([\s\S]*?)<\/SkillSet>/g)) {
      sets.set(/\btitle="([^"]*)"/.exec(m[1])![1], [...m[2].matchAll(/<Skill\b([^>]*?)\/?>/g)].map((s) => s[1]));
    }
    let named = 0;
    for (const stage of plan.stages) {
      const title = record.sets.find((s) => s.kind === 'skill' && s.stages.includes(stage.id))!.title;
      const groups = sets.get(title)!;
      expect({ stage: stage.id, groups: groups.length }).toEqual({ stage: stage.id, groups: stage.skills.groups.length });
      groups.forEach((attrs, k) => {
        const isNamed = k + 1 === stage.skills.rolledGroup;
        if (isNamed) named += 1;
        expect({ stage: stage.id, group: k + 1, full: /\bincludeInFullDPS="(\w+)"/.exec(attrs)?.[1], count: /\bgroupCount="(\d+)"/.exec(attrs)?.[1] }).toEqual({
          stage: stage.id,
          group: k + 1,
          full: isNamed ? 'true' : 'false',
          count: isNamed ? String(stage.skills.groups[k].count ?? 1) : undefined,
        });
      });
    }
    expect(named).toBe(15);
  }, 150_000);

  it('WU-30 lever: with the rebuilds not deferred, every stage measures exactly the same outputs and breakdown', async () => {
    expect(timed).not.toBeNull();
    const run = await f.call('guide_run', { new_run: 'nfr-eager' });
    const planPath = /^plan_path for this run: (\S+)$/m.exec(run.text)![1];
    fs.copyFileSync(FIXTURE, path.join(f.guides, planPath));
    const original = PoBLuaApiClient.prototype.request;
    let stageCalls = 0;
    jest.spyOn(PoBLuaApiClient.prototype, 'request').mockImplementation(async function (this: PoBLuaApiClient, ...args: any[]) {
      if (args[0] === 'compile_stage') {
        args[1] = { ...args[1], __noDeferForTest: true };
        stageCalls += 1;
      }
      return (original as any).apply(this, args);
    } as any);
    try {
      const out = await f.server.client.callTool(
        { name: 'compile_plan', arguments: { plan_path: planPath, measure_only: true } },
        undefined,
        { timeout: 280_000 },
      );
      expect(out.isError).toBeFalsy();
    } finally {
      jest.restoreAllMocks();
    }
    expect(stageCalls).toBe(15);
    const eager = JSON.parse(
      fs.readFileSync(path.join(f.guides, path.posix.dirname(planPath), 'compile-record.json'), 'utf8'),
    ) as CompileRecord;
    for (const id of timed!.stagesCompiled) {
      expect({ id, outputs: timed!.stages[id].outputs }).toEqual({ id, outputs: eager.stages[id].outputs });
      expect({ id, skillOutputs: timed!.stages[id].skillOutputs }).toEqual({ id, skillOutputs: eager.stages[id].skillOutputs });
    }
  }, 300_000);
});
