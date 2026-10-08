/**
 * AC-W3 (WU-43): the workflow harness loads a saved-workflow script the way platform §5 describes, runs
 * it with scripted agent results, and reproduces the platform's concurrency primitives.
 */
import { describe, it, expect } from '@jest/globals';
import fs from 'fs';
import path from 'path';
import {
  byStage,
  loadWorkflowScript,
  overlaps,
  parseWorkflowScript,
  runWorkflow,
  WorkflowRunError,
  WorkflowScriptError,
  type AgentCall,
} from '../helpers/workflowHarness';

const FIXTURES = path.resolve(__dirname, '..', 'fixtures', 'pipeline', 'workflows');
const fixture = (name: string) => path.join(FIXTURES, name);

/** The concurrency the script saw: for each pair of calls, whether one ended before the other started. */
const endedBefore = (a: AgentCall, b: AgentCall) => a.endTick !== null && a.endTick < b.startTick;

describe('AC-W3: loading a saved workflow script', () => {
  it('reads the .js file as text and takes out the export const meta literal', () => {
    const wf = loadWorkflowScript(fixture('harness-demo.js'));
    expect(wf.meta).toEqual({
      name: 'harness-demo',
      description: 'AC-W3 fixture: exercises every global the workflow harness fakes',
      whenToUse: 'only in tests',
      phases: [
        { title: 'Fan out', detail: 'three agents behind a barrier' },
        { title: 'Pipeline', detail: 'two items, two stages, no barrier' },
      ],
    });
    // The meta statement is blanked, line for line, so errors keep the script's line numbers.
    expect(wf.body).not.toContain('export');
    expect(wf.body.split('\n')).toHaveLength(fs.readFileSync(fixture('harness-demo.js'), 'utf8').split('\n').length);
  });

  it('refuses a meta that holds a variable, naming the variable and its place', () => {
    expect(() => loadWorkflowScript(fixture('meta-variable.js'))).toThrow(WorkflowScriptError);
    expect(() => loadWorkflowScript(fixture('meta-variable.js'))).toThrow(
      /meta-variable\.js:2:\d+: meta must be a pure literal .*a variable reference "WORKFLOW_NAME"/,
    );
  });

  it('refuses calls, spreads, interpolation and shorthand in meta, and a script that does not begin with meta', () => {
    const cases: [string, RegExp][] = [
      ["export const meta = { name: String('x'), description: 'd' }\n", /a call "String\('x'\)"/],
      ["export const meta = { ...base, name: 'x', description: 'd' }\n", /a spread/],
      ["export const meta = { name: `x${1}`, description: 'd' }\n", /template interpolation/],
      ["export const meta = { name, description: 'd' }\n", /a shorthand property "name"/],
      ["const x = 1\nexport const meta = { name: 'x', description: 'd' }\n", /must begin with `export const meta/],
      ["export const meta = { name: 'x' }\n", /needs a non-empty string description/],
      ["export const meta = { name: 'x', description: 'd' }\nexport const other = 1\n", /no imports or exports besides meta/],
    ];
    for (const [source, cause] of cases) {
      expect(() => parseWorkflowScript(source, 'inline.js')).toThrow(cause);
    }
  });
});

describe('AC-W3: running a script with fakes for the globals', () => {
  const demo = () => loadWorkflowScript(fixture('harness-demo.js'));
  const args = { mode: 'offline', runFolder: '/tmp/guides/titan-blood-hunt/2026-10-08-1' };

  it('runs the body in an async function with agent, parallel, pipeline, phase, log, budget and args, and records each call', async () => {
    const run = await runWorkflow(demo(), {
      args,
      budget: { total: 500000 },
      respond: byStage({
        R1a: (call) => `notes ${String(call.header?.n)}`,
        R1b: [{ ok: true }],
        S1: (call) => `one:${String(call.header?.item)}`,
        S2: (call) => `two:${String(call.header?.prev)}`,
      }),
    });
    expect(run.result).toEqual({
      fanned: ['notes a', 'notes b', 'notes c'],
      after: { ok: true },
      afterWasNull: false,
      piped: ['two:one:x', 'two:one:y'],
      thrown: [null, 'kept'],
      stamped: '1970-01-01T00:00:00.000Z',
      budgetTotal: 500000,
    });
    expect(run.phases).toEqual(['Fan out', 'Pipeline']);
    expect(run.logs).toEqual([`demo for ${args.runFolder}`]);

    // Each agent() call's options and task header are recorded.
    expect(run.calls.map((c) => c.opts.agentType)).toEqual([
      'build-guide-researcher',
      'build-guide-researcher',
      'build-guide-researcher',
      'build-guide-coordinator',
      'build-guide-coordinator',
      'build-guide-coordinator',
      'build-guide-coordinator',
      'build-guide-coordinator',
    ]);
    expect(run.calls[0].opts.label).toBe('r1a-a');
    expect(run.calls[3].opts.schema).toEqual({ type: 'object', properties: { ok: { type: 'boolean' } }, required: ['ok'] });
    expect(run.calls[3].header).toEqual({
      stage: 'R1b',
      attempt: 1,
      mode: 'offline',
      runFolder: args.runFolder,
      concept: 'c1',
      compile: 'measure-only',
    });
    for (const c of run.calls) expect(c.header).toMatchObject({ mode: 'offline', runFolder: args.runFolder });
    expect(run.calls[0].phase).toBe('Fan out');
    expect(run.calls[4].phase).toBe('Pipeline');

    // The three fanned-out agents were in flight together, and nothing else was.
    expect(run.maxInFlight).toBe(3);
  });

  it('reproduces parallel as a barrier: every thunk ends before the next agent starts', async () => {
    const run = await runWorkflow(demo(), {
      args,
      // The first researcher is slow; the barrier still holds the coordinator back until it ends.
      delay: (call) => (call.header?.n === 'a' ? 8 : 1),
      respond: byStage({ R1a: () => 'r', R1b: [{ ok: true }], S1: () => 's1', S2: () => 's2' }),
    });
    const [a, b, c, coordinator] = run.calls;
    for (const r of [a, b, c]) expect(endedBefore(r, coordinator)).toBe(true);
    // b and c finished long before a, which was in flight all along: they ran concurrently.
    for (const r of [b, c]) {
      expect(r.endTick!).toBeLessThan(a.endTick!);
      expect(overlaps(a, r)).toBe(true);
    }
    for (const r of [a, b, c]) expect(overlaps(r, coordinator)).toBe(false);
  });

  it('reproduces pipeline as barrier-free: one item reaches stage 2 while another is still in stage 1', async () => {
    const run = await runWorkflow(demo(), {
      args,
      delay: (call) => (call.header?.stage === 'S1' && call.header?.item === 'y' ? 10 : 1),
      respond: byStage({ R1a: () => 'r', R1b: [{ ok: true }], S1: () => 's1', S2: () => 's2' }),
    });
    const s1y = run.calls.find((c) => c.header?.stage === 'S1' && c.header?.item === 'y')!;
    const s2x = run.calls.find((c) => c.header?.stage === 'S2' && c.header?.item === 'x')!;
    expect(s2x.startTick).toBeLessThan(s1y.endTick!);
    expect(endedBefore(s1y, s2x)).toBe(false);
  });

  it('lets a scripted null reach the script, as a dead or skipped agent does', async () => {
    const run = await runWorkflow(demo(), {
      args,
      respond: byStage({ R1a: [null, 'b', 'c'], R1b: [null], S1: () => null, S2: (call) => `two:${String(call.header?.prev)}` }),
    });
    const result = run.result as Record<string, unknown>;
    expect(result.fanned).toEqual([null, 'b', 'c']);
    expect(result.after).toBeNull();
    expect(result.afterWasNull).toBe(true);
    // A null stage result flows on to the next stage; only a throw drops the item.
    expect(result.piped).toEqual(['two:null', 'two:null']);
  });

  it('drops a pipeline item whose stage throws, and keeps the others', async () => {
    const run = await runWorkflow(demo(), {
      args,
      respond: byStage({
        R1a: () => 'r',
        R1b: [{ ok: true }],
        S1: (call) => {
          if (call.header?.item === 'x') throw new Error('stage one failed for x');
          return 's1';
        },
        S2: () => 's2',
      }),
    });
    expect((run.result as Record<string, unknown>).piped).toEqual([null, 's2']);
  });

  it('measures the most agents in flight, and queues beyond the concurrency cap', async () => {
    const source = [
      "export const meta = { name: 'fan', description: 'six at once' }",
      "return await parallel([1, 2, 3, 4, 5, 6].map((n) => () => agent('part ' + n)))",
    ].join('\n');
    const open = await runWorkflow(parseWorkflowScript(source, 'fan.js'), { respond: () => 'ok' });
    expect(open.maxInFlight).toBe(6);
    const capped = await runWorkflow(parseWorkflowScript(source, 'fan.js'), { respond: () => 'ok', concurrencyCap: 2 });
    expect(capped.maxInFlight).toBe(2);
    expect(capped.result).toEqual(['ok', 'ok', 'ok', 'ok', 'ok', 'ok']);
  });
});

describe('AC-W3: the clock and randomness throw in a script', () => {
  const run = (body: string) =>
    runWorkflow(parseWorkflowScript(`export const meta = { name: 'clock', description: 'reads the clock' }\n${body}\n`, 'clock.js'), {
      respond: () => 'ok',
    });

  it('fails the date-now fixture with an error naming Date.now()', async () => {
    const promise = runWorkflow(loadWorkflowScript(fixture('date-now.js')), { respond: () => 'ok' });
    await expect(promise).rejects.toThrow(WorkflowRunError);
    await expect(runWorkflow(loadWorkflowScript(fixture('date-now.js')), { respond: () => 'ok' })).rejects.toThrow(
      /date-now\.js \(date-now\) threw Error: Date\.now\(\) is not available in a workflow script/,
    );
  });

  it('records no agent call when the clock read comes first', async () => {
    const err = await runWorkflow(loadWorkflowScript(fixture('date-now.js')), { respond: () => 'ok' }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(WorkflowRunError);
    expect((err as WorkflowRunError).calls).toEqual([]);
  });

  it('throws on Math.random() and an argless new Date(), but not on new Date(value)', async () => {
    await expect(run('return Math.random()')).rejects.toThrow(/Math\.random\(\) is not available/);
    await expect(run('return new Date()')).rejects.toThrow(/new Date\(\) without arguments is not available/);
    await expect(run('return Date()')).rejects.toThrow(/Date\(\) is not available/);
    await expect(run("return new Date('2026-10-08T00:00:00Z').getTime()")).resolves.toMatchObject({ result: 1791417600000 });
  });

  it('gives the script no Node API', async () => {
    await expect(run('return typeof require + typeof process + typeof setTimeout')).resolves.toMatchObject({
      result: 'undefinedundefinedundefined',
    });
  });
});
