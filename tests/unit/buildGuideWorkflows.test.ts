/**
 * The build-guide workflows under the workflow harness, with scripted agent results (slice 03 §5, §14).
 * Each test loads the real script from `.claude/workflows/` (`loadSavedWorkflow`), runs it with the
 * harness's fakes for the platform globals, and checks the agent calls it made and what it returned.
 *
 * - Research workflow `build-guide-research` (WU-44): AC-W6, AC-W7.
 * - WU-45 appends the design cases (AC-W8…AC-W11, AC-W24) and WU-46 the verification cases (AC-W12,
 *   AC-W13, AC-W25), each in its own `describe` block below the research ones, reusing the shared helpers.
 */
import { describe, it, expect, afterAll } from '@jest/globals';
import { spawnSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import {
  byStage,
  loadSavedWorkflow,
  overlaps,
  REPO_ROOT,
  runWorkflow,
  type AgentCall,
  type RunOptions,
  type RunResult,
} from '../helpers/workflowHarness';

// ---------------------------------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------------------------------

/** Slice 03 §4: the five agent types; every `agent()` names one (R-6). */
const AGENT_TYPES = [
  'build-guide-researcher',
  'build-guide-coordinator',
  'build-guide-writer',
  'build-guide-provenance',
  'build-guide-verifier',
];

/** §5.1: the fields a task header may hold. */
const HEADER_FIELDS = [
  'stage',
  'attempt',
  'concept',
  'lens',
  'pass',
  'mode',
  'runFolder',
  'runFolderRel',
  'compile',
  'buildName',
  'findings',
  'accepted',
  'faults',
  'writes',
  'reference',
];

const RUN_FOLDER = '/guides/titan-blood-hunt/2026-10-08-1';
const RUN_FOLDER_REL = 'titan-blood-hunt/2026-10-08-1';
const ROLL = { className: 'Warrior', ascendancy: 'Titan', skill: 'Blood Hunt' };

const header = (call: AgentCall): Record<string, unknown> => {
  if (call.header === null) throw new Error(`call ${call.index} has no task header${call.headerError ? `: ${call.headerError}` : ''}`);
  return call.header;
};
const stageOf = (call: AgentCall) => header(call).stage as string;
const callsOf = (r: { calls: AgentCall[] }, stage: string) => r.calls.filter((c) => stageOf(c) === stage);
const conceptsOf = (calls: AgentCall[]) => calls.map((c) => header(c).concept);

async function run(name: string, options: RunOptions): Promise<RunResult> {
  return runWorkflow(loadSavedWorkflow(name), options);
}

// ---------------------------------------------------------------------------------------------------
// Research workflow `build-guide-research` (WU-44)
// ---------------------------------------------------------------------------------------------------

interface ResearchResult {
  status: 'ok' | 'no-viable';
  concepts: { id: string; title: string; status: string; attempts: number; evidence: string[] }[];
  gateVerdicts: {
    stage: string;
    concept: string;
    attempt: number;
    verdict: { compiled: string };
    findings: { part: string; code: string; stage?: string; message: string }[];
  }[];
  stats: {
    attempts: { stage: string; concept?: string; attempt: number; agents: number; outcome: string; findings: number }[];
    agents: { total: number; byType: Record<string, number>; maxConcurrent: number };
    retries: { stage: string; concept: string | null; round: number; researcher?: number; count: number }[];
    priceCalls: { at: string | null; stage: string; tool: string; item: string; outcome: string }[];
    faults: { id: string; target: { concepts: string[] | 'all'; persistent: boolean }; applied: number; observed: string }[];
    revision: unknown[];
  };
  round: { round: number; firstId: number; note: string | null; concepts: string[]; conceptsCompiled: number };
  dossier: string | null;
}

const researchArgs = (over: Record<string, unknown> = {}) => ({
  runFolder: RUN_FOLDER,
  runFolderRel: RUN_FOLDER_REL,
  roll: ROLL,
  mode: 'offline',
  pass: 1,
  firstId: 1,
  ...over,
});

/** R1a: researcher n (from its `writes`) proposes `titles[n - 1]`. */
const r1a = (titles: string[][]) => (call: AgentCall) => {
  const file = (header(call).writes as string[])[0];
  const n = Number(/-r1a-(\d+)\.md$/.exec(file)![1]);
  return { file, concepts: (titles[n - 1] ?? []).map((title) => ({ title })) };
};
/** Two researchers propose two concepts each: four in all. */
const FOUR = [[], ['Bleed burst', 'Rage slam'], ['Totem titan', 'Armour stacker']];
const THREE = [[], ['Bleed burst', 'Rage slam'], ['Totem titan']];

const r1bPass = (call: AgentCall) => {
  const id = header(call).concept as string;
  return {
    compiled: true,
    errors: [],
    compiles: 2,
    recordPath: `concepts/${id}/compile-record.json`,
    numbers: [{ stage: `${id}e`, field: 'Life', value: 4000 }],
    prices: [
      { id: `${id}-weapon`, item: 'weapon', status: 'unavailable', amount: null, currency: null, date: '2026-10-08', league: null, note: 'offline run' },
    ],
    priceCalls: [],
  };
};
const r1bFail = (errors: string[]) => () => ({ compiled: false, errors, compiles: 2, recordPath: null, numbers: [], prices: [], priceCalls: [] });
/** A failure whose error names the attempt, so each attempt's findings are told apart. */
const r1bFailNth = (call: AgentCall) => {
  const h = header(call);
  return r1bFail([`stage ${h.concept}e: unknown gem "Bad Gem ${h.attempt}"`])();
};
const assembleOk = () => ({ file: 'dossier.md', missingRecords: [] });
/** R1a, where researcher n returns nothing on its first `dies[n]` attempts, then proposes as `r1a(titles)`. */
const r1aDying = (titles: string[][], dies: Record<number, number>) => (call: AgentCall) => {
  const n = Number(/-r1a-(\d+)\.md$/.exec((header(call).writes as string[])[0])![1]);
  return (header(call).attempt as number) <= (dies[n] ?? 0) ? null : r1a(titles)(call);
};

type Retry = { stage: string; concept: string | null; round?: number; researcher?: number; count: number };
/** references/run-log.md: the skill merges retries by (stage, concept, round, researcher), adding counts. */
function mergeRetries(entries: Retry[]): Retry[] {
  const out: Retry[] = [];
  for (const e of entries) {
    const same = out.find((o) => o.stage === e.stage && o.concept === e.concept && o.round === e.round && o.researcher === e.researcher);
    if (same) same.count += e.count;
    else out.push({ ...e });
  }
  return out;
}

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'bg-workflows-'));
afterAll(() => fs.rmSync(TMP, { recursive: true, force: true }));
let copies = 0;
/** The run checker on a copy of the passing fixture run whose run log holds these retries. */
function checkRunWithRetries(retries: Retry[]): { code: number | null; stderr: string } {
  const dir = path.join(TMP, `run-ok-${++copies}`);
  fs.cpSync(path.join(REPO_ROOT, 'tests', 'fixtures', 'pipeline', 'run-ok'), dir, { recursive: true });
  const logPath = path.join(dir, 'run-log.json');
  const log = JSON.parse(fs.readFileSync(logPath, 'utf8'));
  log.retries = retries;
  fs.writeFileSync(logPath, JSON.stringify(log, null, 2));
  const checker = path.join(REPO_ROOT, '.claude', 'skills', 'build-guide', 'scripts', 'check-run.mjs');
  const r = spawnSync(process.execPath, [checker, dir], { env: { PATH: '/usr/bin:/bin', LANG: 'C' }, encoding: 'utf8', timeout: 30000 });
  return { code: r.status, stderr: r.stderr };
}

async function research(table: Parameters<typeof byStage>[0], args: Record<string, unknown> = {}, options: Partial<RunOptions> = {}) {
  const r = await run('build-guide-research', { args: researchArgs(args), respond: byStage(table), ...options });
  return { ...r, out: r.result as ResearchResult };
}

describe('build-guide-research: the saved script', () => {
  it('is .claude/workflows/build-guide-research.js, with a pure-literal meta naming it', () => {
    const wf = loadSavedWorkflow('build-guide-research');
    expect(wf.meta.name).toBe('build-guide-research');
    expect(wf.meta.description.length).toBeGreaterThan(40);
    expect(fs.readFileSync(path.join(REPO_ROOT, '.claude', 'skills', 'build-guide', 'SKILL.md'), 'utf8')).toContain('build-guide-research');
  });

  it('refuses args without the run folder, the roll, the mode, the round or the first id', async () => {
    for (const drop of ['runFolder', 'runFolderRel', 'roll', 'mode', 'pass', 'firstId']) {
      const args: Record<string, unknown> = researchArgs();
      delete args[drop];
      await expect(run('build-guide-research', { args, respond: () => null })).rejects.toThrow(new RegExp(`args\\.${drop}`));
    }
  });
});

describe('AC-W6: R1a fan-out, then one coordinator step at a time', () => {
  it('runs 3 researchers with at most 3 in flight, then coordinator steps that overlap no other agent', async () => {
    const r = await research(
      { R1a: r1a(THREE), R1b: (c) => r1bPass(c), 'R1b-assemble': [assembleOk()] },
      {},
      // Researchers take different times, so the barrier, not equal delays, keeps the coordinator waiting.
      { delay: (c) => (stageOf(c) === 'R1a' ? 1 + c.index * 2 : 1) },
    );
    const researchers = r.calls.filter((c) => c.opts.agentType === 'build-guide-researcher');
    const coordinators = r.calls.filter((c) => c.opts.agentType === 'build-guide-coordinator');
    expect(researchers.map(stageOf)).toEqual(['R1a', 'R1a', 'R1a']);
    expect(r.maxInFlight).toBe(3);
    // The three researchers run together...
    for (const a of researchers) for (const b of researchers) if (a !== b) expect(overlaps(a, b)).toBe(true);
    // ...and every coordinator step starts after they all end and overlaps no other agent.
    expect(coordinators.map(stageOf)).toEqual(['R1b', 'R1b', 'R1b', 'R1b-assemble']);
    for (const c of coordinators) {
      for (const other of r.calls) if (other !== c) expect({ call: c.index, other: other.index, overlap: overlaps(c, other) }).toEqual({ call: c.index, other: other.index, overlap: false });
      for (const res of researchers) expect(res.endTick!).toBeLessThan(c.startTick);
    }
    expect(r.out.stats.agents).toEqual({
      total: 7,
      byType: { 'build-guide-researcher': 3, 'build-guide-coordinator': 4 },
      maxConcurrent: 3,
    });
  });

  it('names an allowed agentType on every agent() (R-6): researchers for R1a, the coordinator otherwise', async () => {
    const r = await research({ R1a: r1a(FOUR), R1b: (c) => r1bPass(c), 'R1b-assemble': [assembleOk()] });
    expect(r.calls.length).toBeGreaterThan(0);
    for (const c of r.calls) {
      expect(AGENT_TYPES).toContain(c.opts.agentType);
      expect({ stage: stageOf(c), type: c.opts.agentType }).toEqual({
        stage: stageOf(c),
        type: stageOf(c) === 'R1a' ? 'build-guide-researcher' : 'build-guide-coordinator',
      });
    }
  });

  it("carries the args' mode and run folder in every header, measure-only in every R1b header", async () => {
    for (const mode of ['offline', 'online']) {
      const r = await research({ R1a: r1a(FOUR), R1b: (c) => r1bPass(c), 'R1b-assemble': [assembleOk()] }, { mode });
      for (const c of r.calls) {
        const h = header(c);
        expect({ mode: h.mode, runFolder: h.runFolder, runFolderRel: h.runFolderRel }).toEqual({ mode, runFolder: RUN_FOLDER, runFolderRel: RUN_FOLDER_REL });
        for (const k of Object.keys(h)) expect(HEADER_FIELDS).toContain(k);
        // Each header names an existing stage reference, and writes only run-folder-relative paths.
        expect(h.reference).toBe(`.claude/skills/build-guide/references/stages/${h.stage}.md`);
        expect(fs.existsSync(path.join(REPO_ROOT, h.reference as string))).toBe(true);
        for (const w of h.writes as string[]) expect(w).not.toMatch(/^\/|\.\./);
        expect(h.compile).toBe(h.stage === 'R1b' ? 'measure-only' : 'none');
      }
      expect(callsOf(r, 'R1b').map((c) => header(c).compile)).toEqual(['measure-only', 'measure-only', 'measure-only']);
      // Parallel researchers write disjoint files (C-36); R1b writes the concept's skeleton; assembly the dossier.
      expect(callsOf(r, 'R1a').map((c) => header(c).writes)).toEqual([['research/p1-r1a-1.md'], ['research/p1-r1a-2.md'], ['research/p1-r1a-3.md']]);
      expect(callsOf(r, 'R1b').map((c) => header(c).writes)).toEqual([['concepts/c1/plan.json'], ['concepts/c2/plan.json'], ['concepts/c3/plan.json']]);
      expect(callsOf(r, 'R1b-assemble').map((c) => header(c).writes)).toEqual([['dossier.md']]);
    }
  });

  it('with 4 proposals, runs R1b for c1…c3 only and returns c4 not-carried', async () => {
    const r = await research({ R1a: r1a(FOUR), R1b: (c) => r1bPass(c), 'R1b-assemble': [assembleOk()] });
    expect(conceptsOf(callsOf(r, 'R1b'))).toEqual(['c1', 'c2', 'c3']);
    // Ids follow return order: researcher 2's proposals, then researcher 3's.
    expect(r.out.concepts.map((c) => [c.id, c.title, c.status])).toEqual([
      ['c1', 'Bleed burst', 'viable'],
      ['c2', 'Rage slam', 'viable'],
      ['c3', 'Totem titan', 'viable'],
      ['c4', 'Armour stacker', 'not-carried'],
    ]);
    expect(r.out.concepts[3].evidence.join(' ')).toMatch(/not carried.*3 concepts.*research\/p1-r1a-3\.md/);
    expect(r.out.status).toBe('ok');
    expect(r.out.round).toEqual({ round: 1, firstId: 1, note: null, concepts: ['c1', 'c2', 'c3'], conceptsCompiled: 3 });
    // The assembly step is told about c4, so the dossier lists it under Not carried (§7.2).
    expect(callsOf(r, 'R1b-assemble')[0].prompt).toMatch(/"id": "c4",\s*"title": "Armour stacker",[\s\S]*"status": "not-carried"/);
  });

  it('with pass 2 and firstId 5, starts the ids at c5 and again carries at most 3', async () => {
    const r = await research({ R1a: r1a(FOUR), R1b: (c) => r1bPass(c), 'R1b-assemble': [assembleOk()] }, { pass: 2, firstId: 5, note: 'try a minion angle' });
    expect(conceptsOf(callsOf(r, 'R1b'))).toEqual(['c5', 'c6', 'c7']);
    expect(r.out.concepts.map((c) => [c.id, c.status])).toEqual([
      ['c5', 'viable'],
      ['c6', 'viable'],
      ['c7', 'viable'],
      ['c8', 'not-carried'],
    ]);
    expect(callsOf(r, 'R1a').map((c) => (header(c).writes as string[])[0])).toEqual(['research/p2-r1a-1.md', 'research/p2-r1a-2.md', 'research/p2-r1a-3.md']);
    // A later round's researchers get the user's note and are told to read the dossier first.
    for (const c of callsOf(r, 'R1a')) {
      expect(c.prompt).toContain('try a minion angle');
      expect(c.prompt).toContain('read dossier.md first');
    }
    expect(r.out.round).toEqual({ round: 2, firstId: 5, note: 'try a minion angle', concepts: ['c5', 'c6', 'c7'], conceptsCompiled: 3 });
  });

  it('returns the stats the run log folds in, with one R1b gate verdict per attempt that returned', async () => {
    const r = await research({ R1a: r1a(THREE), R1b: (c) => r1bPass(c), 'R1b-assemble': [assembleOk()] });
    expect(r.out.stats.attempts).toEqual([
      { stage: 'R1a', attempt: 1, agents: 1, outcome: 'done', findings: 0 },
      { stage: 'R1a', attempt: 1, agents: 1, outcome: 'done', findings: 0 },
      { stage: 'R1a', attempt: 1, agents: 1, outcome: 'done', findings: 0 },
      { stage: 'R1b', concept: 'c1', attempt: 1, agents: 1, outcome: 'pass', findings: 0 },
      { stage: 'R1b', concept: 'c2', attempt: 1, agents: 1, outcome: 'pass', findings: 0 },
      { stage: 'R1b', concept: 'c3', attempt: 1, agents: 1, outcome: 'pass', findings: 0 },
      { stage: 'R1b-assemble', attempt: 1, agents: 1, outcome: 'done', findings: 0 },
    ]);
    expect(r.out.stats.retries).toEqual([]);
    expect(r.out.stats.priceCalls).toEqual([]);
    expect(r.out.stats.faults).toEqual([]);
    expect(r.out.gateVerdicts.map((g) => [g.stage, g.concept, g.attempt, g.verdict])).toEqual([
      ['R1b', 'c1', 1, { compiled: 'pass' }],
      ['R1b', 'c2', 1, { compiled: 'pass' }],
      ['R1b', 'c3', 1, { compiled: 'pass' }],
    ]);
    expect(r.out.dossier).toBe('dossier.md');
  });
});

describe('AC-W7: the R1b gate, its retries, no-viable and FI-1', () => {
  it('fails a concept after 3 failed attempts, each later header carrying the earlier findings, and runs the others', async () => {
    const r = await research({ R1a: r1a(THREE), 'R1b@c2': r1bFailNth, R1b: (c) => r1bPass(c), 'R1b-assemble': [assembleOk()] });
    const c2 = callsOf(r, 'R1b').filter((c) => header(c).concept === 'c2');
    expect(c2.map((c) => header(c).attempt)).toEqual([1, 2, 3]);
    const findings = c2.map((c) => header(c).findings as { attempt: number; message: string }[]);
    expect(findings[0]).toEqual([]);
    expect(findings[1].map((f) => [f.attempt, f.message])).toEqual([[1, 'stage c2e: unknown gem "Bad Gem 1"']]);
    expect(findings[2].map((f) => [f.attempt, f.message])).toEqual([
      [1, 'stage c2e: unknown gem "Bad Gem 1"'],
      [2, 'stage c2e: unknown gem "Bad Gem 2"'],
    ]);
    const out = r.out.concepts.find((c) => c.id === 'c2')!;
    expect(out).toEqual({ id: 'c2', title: 'Rage slam', status: 'failed', attempts: 3, evidence: ['stage c2e: unknown gem "Bad Gem 3"'] });
    // The other concepts still run, after c2's attempts, and are viable.
    expect(conceptsOf(callsOf(r, 'R1b'))).toEqual(['c1', 'c2', 'c2', 'c2', 'c3']);
    expect(r.out.concepts.filter((c) => c.id !== 'c2').map((c) => c.status)).toEqual(['viable', 'viable']);
    expect(r.out.status).toBe('ok');
    // The gate verdicts carry each failure as a compile-error finding on the plan stage it names.
    expect(r.out.gateVerdicts.filter((g) => g.concept === 'c2')).toEqual(
      [1, 2, 3].map((n) =>
        expect.objectContaining({
          stage: 'R1b',
          concept: 'c2',
          attempt: n,
          verdict: { compiled: 'fail' },
          findings: [{ part: 'compiled', code: 'compile-error', stage: 'c2e', message: `stage c2e: unknown gem "Bad Gem ${n}"` }],
        }),
      ),
    );
    expect(r.out.stats.retries).toEqual([{ stage: 'R1b', concept: 'c2', round: 1, count: 2 }]);
  });

  it('returns no-viable, with every concept\'s evidence, when every concept fails', async () => {
    const r = await research({ R1a: r1a(THREE), R1b: r1bFailNth, 'R1b-assemble': [assembleOk()] });
    expect(r.out.status).toBe('no-viable');
    expect(r.out.concepts).toEqual(
      ['c1', 'c2', 'c3'].map((id) => expect.objectContaining({ id, status: 'failed', attempts: 3, evidence: [`stage ${id}e: unknown gem "Bad Gem 3"`] })),
    );
    expect(callsOf(r, 'R1b')).toHaveLength(9);
    // The dossier is still assembled, so checkpoint 1 can show why each failed (D-141).
    expect(callsOf(r, 'R1b-assemble')).toHaveLength(1);
    expect(r.out.stats.retries).toEqual(['c1', 'c2', 'c3'].map((concept) => ({ stage: 'R1b', concept, round: 1, count: 2 })));
  });

  it('counts a null R1b result as a failed attempt, which re-runs with a finding saying so', async () => {
    const r = await research({
      R1a: r1a(THREE),
      'R1b@c1': (c, nth) => (nth === 0 ? null : r1bPass(c)),
      R1b: (c) => r1bPass(c),
      'R1b-assemble': [assembleOk()],
    });
    expect(r.out.concepts[0]).toEqual(expect.objectContaining({ id: 'c1', status: 'viable', attempts: 2 }));
    const c1 = callsOf(r, 'R1b').filter((c) => header(c).concept === 'c1');
    expect((header(c1[1]).findings as { code: string; attempt: number }[]).map((f) => [f.attempt, f.code])).toEqual([[1, 'null-result']]);
    expect(r.out.stats.attempts.filter((a) => a.concept === 'c1').map((a) => a.outcome)).toEqual(['null-result', 'pass']);
    // A null attempt has no verdict, so no gate file; the log's entry says null-result (FR-W6).
    expect(r.out.gateVerdicts.filter((g) => g.concept === 'c1').map((g) => g.attempt)).toEqual([2]);
    expect(r.out.stats.retries).toEqual([{ stage: 'R1b', concept: 'c1', round: 1, count: 1 }]);
  });

  it('fails a concept whose three R1b attempts all return null, and keeps the last errors as evidence', async () => {
    const r = await research({
      R1a: r1a(THREE),
      'R1b@c1': (c, nth) => (nth === 0 ? r1bFailNth(c) : null),
      R1b: (c) => r1bPass(c),
      'R1b-assemble': [assembleOk()],
    });
    expect(r.out.concepts[0].status).toBe('failed');
    expect(r.out.concepts[0].attempts).toBe(3);
    expect(r.out.concepts[0].evidence).toEqual([expect.stringMatching(/R1b attempt 3 for c1 returned no result/), 'stage c1e: unknown gem "Bad Gem 1"']);
    expect(r.out.stats.attempts.filter((a) => a.concept === 'c1').map((a) => a.outcome)).toEqual(['fail', 'null-result', 'null-result']);
  });

  it('puts FI-1 only in the targeted concept\'s R1b headers, on attempt 1 unless it is persistent', async () => {
    const fi1 = (concepts: string[] | 'all', persistent: boolean) => ({ id: 'FI-1', concepts, persistent });
    const failing = (c: AgentCall) =>
      (header(c).faults as unknown[]).length > 0 ? r1bFail([`stage ${header(c).concept}e: unknown gem "FI-1 Unknown Gem"`])() : r1bPass(c);
    const faultsByCall = (r: RunResult) => r.calls.map((c) => [stageOf(c), header(c).concept ?? null, header(c).attempt, (header(c).faults as unknown[]).length]);

    // Attempt 1 only: c1's first attempt fails on the gem, its retry has no directive and passes.
    const once = await research({ R1a: r1a(THREE), R1b: failing, 'R1b-assemble': [assembleOk()] }, { faults: [fi1(['c1'], false)] });
    expect(faultsByCall(once).filter(([, , , n]) => n !== 0)).toEqual([['R1b', 'c1', 1, 1]]);
    expect(header(callsOf(once, 'R1b')[0]).faults).toEqual([fi1(['c1'], false)]);
    expect(once.out.concepts.map((c) => [c.id, c.status, c.attempts])).toEqual([
      ['c1', 'viable', 2],
      ['c2', 'viable', 1],
      ['c3', 'viable', 1],
    ]);
    expect(once.out.stats.faults).toEqual([
      { id: 'FI-1', target: { concepts: ['c1'], persistent: false }, applied: 1, observed: 'stage c1e: unknown gem "FI-1 Unknown Gem"' },
    ]);

    // Persistent and "all": every R1b attempt of every concept carries it; R1a and the assembly never do.
    const always = await research({ R1a: r1a(THREE), R1b: failing, 'R1b-assemble': [assembleOk()] }, { faults: [fi1('all', true)] });
    for (const c of always.calls) expect((header(c).faults as unknown[]).length).toBe(stageOf(c) === 'R1b' ? 1 : 0);
    expect(callsOf(always, 'R1b')).toHaveLength(9);
    expect(always.out.status).toBe('no-viable');
    for (const c of always.out.concepts) expect(c.evidence).toEqual([`stage ${c.id}e: unknown gem "FI-1 Unknown Gem"`]);
    expect(always.out.stats.faults).toEqual([
      { id: 'FI-1', target: { concepts: 'all', persistent: true }, applied: 9, observed: 'stage c3e: unknown gem "FI-1 Unknown Gem"' },
    ]);
  });

  it('puts a persistent FI-1 on c2 in all three of c2\'s headers and in none of c1\'s or c3\'s', async () => {
    const failing = (c: AgentCall) =>
      (header(c).faults as unknown[]).length > 0 ? r1bFail([`stage ${header(c).concept}e: unknown gem "FI-1 Unknown Gem"`])() : r1bPass(c);
    const r = await research({ R1a: r1a(THREE), R1b: failing, 'R1b-assemble': [assembleOk()] }, { faults: [{ id: 'FI-1', concepts: ['c2'], persistent: true }] });
    const r1b = callsOf(r, 'R1b').map((c) => [header(c).concept, header(c).attempt, (header(c).faults as { id: string }[]).map((f) => f.id)]);
    expect(r1b).toEqual([
      ['c1', 1, []],
      ['c2', 1, ['FI-1']],
      ['c2', 2, ['FI-1']],
      ['c2', 3, ['FI-1']],
      ['c3', 1, []],
    ]);
    for (const c of r.calls.filter((c) => stageOf(c) !== 'R1b')) expect(header(c).faults).toEqual([]);
    expect(r.out.concepts.map((c) => [c.id, c.status, c.attempts])).toEqual([
      ['c1', 'viable', 1],
      ['c2', 'failed', 3],
      ['c3', 'viable', 1],
    ]);
    expect(r.out.concepts[1].evidence).toEqual(['stage c2e: unknown gem "FI-1 Unknown Gem"']);
    expect(r.out.stats.faults).toEqual([
      { id: 'FI-1', target: { concepts: ['c2'], persistent: true }, applied: 3, observed: 'stage c2e: unknown gem "FI-1 Unknown Gem"' },
    ]);
  });

  it('never sends a fault directive in online mode, nor one meant for another step', async () => {
    const faults = [
      { id: 'FI-1', concepts: 'all', persistent: true },
      { id: 'FI-2', concepts: 'all', persistent: false },
    ];
    const online = await research({ R1a: r1a(THREE), R1b: (c) => r1bPass(c), 'R1b-assemble': [assembleOk()] }, { mode: 'online', faults });
    for (const c of online.calls) expect(header(c).faults).toEqual([]);
    expect(online.out.stats.faults).toEqual([]);
    // Offline, only FI-1 reaches R1b: FI-2 is the D1 gate's (§11.3).
    const offline = await research({ R1a: r1a(THREE), R1b: (c) => r1bPass(c), 'R1b-assemble': [assembleOk()] }, { faults });
    for (const c of callsOf(offline, 'R1b')) expect((header(c).faults as { id: string }[]).map((f) => f.id)).toEqual(['FI-1']);
  });
});

describe('build-guide-research: assembly, dead researchers and pricing', () => {
  it('marks a viable concept failed when the assembly finds no record beside its skeleton', async () => {
    const r = await research({ R1a: r1a(THREE), R1b: (c) => r1bPass(c), 'R1b-assemble': [{ file: 'dossier.md', missingRecords: ['c2'] }] });
    expect(r.out.concepts.map((c) => [c.id, c.status])).toEqual([
      ['c1', 'viable'],
      ['c2', 'failed'],
      ['c3', 'viable'],
    ]);
    expect(r.out.concepts[1].evidence.join(' ')).toMatch(/no compile record beside concepts\/c2\/plan\.json/);
  });

  it('re-runs a dead assembly step, up to 2 retries', async () => {
    const r = await research({ R1a: r1a(THREE), R1b: (c) => r1bPass(c), 'R1b-assemble': [null, assembleOk()] });
    expect(callsOf(r, 'R1b-assemble').map((c) => header(c).attempt)).toEqual([1, 2]);
    expect((header(callsOf(r, 'R1b-assemble')[1]).findings as { code: string }[]).map((f) => f.code)).toEqual(['null-result']);
    expect(r.out.dossier).toBe('dossier.md');
    expect(r.out.status).toBe('ok');
    expect(r.out.stats.retries).toEqual([{ stage: 'R1b-assemble', concept: null, round: 1, count: 1 }]);
    expect(r.out.stats.attempts.filter((a) => a.stage === 'R1b-assemble')).toEqual([
      { stage: 'R1b-assemble', attempt: 1, agents: 1, outcome: 'null-result', findings: 1 },
      { stage: 'R1b-assemble', attempt: 2, agents: 1, outcome: 'done', findings: 0 },
    ]);
  });

  it('fails every carried concept, with the reason, when the assembly never returns (§5.2 step 4)', async () => {
    const r = await research({ R1a: r1a(FOUR), R1b: (c) => r1bPass(c), 'R1b-assemble': [null, null, null] });
    expect(callsOf(r, 'R1b-assemble')).toHaveLength(3);
    expect(r.out.dossier).toBeNull();
    // No record was confirmed and no dossier written, so nothing is viable: the skill acts on no-viable.
    expect(r.out.status).toBe('no-viable');
    expect(r.out.concepts.map((c) => [c.id, c.status])).toEqual([
      ['c1', 'failed'],
      ['c2', 'failed'],
      ['c3', 'failed'],
      ['c4', 'not-carried'],
    ]);
    for (const c of r.out.concepts.slice(0, 3)) {
      expect(c.evidence).toEqual([expect.stringMatching(/R1b-assemble returned no result in 3 attempts, so c\d's record was never confirmed and no dossier was written/)]);
    }
    expect(r.out.stats.retries).toEqual([{ stage: 'R1b-assemble', concept: null, round: 1, count: 2 }]);
  });

  it("keys each round's retries by its round, so two rounds of dying assembly stay within the cap", async () => {
    const dying = { R1a: r1a(THREE), R1b: (c: AgentCall) => r1bPass(c), 'R1b-assemble': [null, null, assembleOk()] };
    const one = await research(dying, { pass: 1, firstId: 1 });
    const two = await research(dying, { pass: 2, firstId: 4 });
    expect(one.out.stats.retries).toEqual([{ stage: 'R1b-assemble', concept: null, round: 1, count: 2 }]);
    expect(two.out.stats.retries).toEqual([{ stage: 'R1b-assemble', concept: null, round: 2, count: 2 }]);
    // Folded as references/run-log.md says (equal keys add up), the rounds stay apart, and the run checker
    // passes them; keyed without the round they would merge into one count of 4.
    const merged = mergeRetries([...one.out.stats.retries, ...two.out.stats.retries]);
    expect(merged).toEqual([
      { stage: 'R1b-assemble', concept: null, round: 1, count: 2 },
      { stage: 'R1b-assemble', concept: null, round: 2, count: 2 },
    ]);
    expect(checkRunWithRetries(merged)).toEqual({ code: 0, stderr: '' });
    const unkeyed = mergeRetries([...one.out.stats.retries, ...two.out.stats.retries].map(({ round: _round, ...rest }) => rest));
    expect(unkeyed).toEqual([{ stage: 'R1b-assemble', concept: null, count: 4 }]);
    expect(checkRunWithRetries(unkeyed).stderr).toMatch(/check-run: \[caps\] .*has 4 retries; at most 2 per stage/);
  });

  it('stops pricing for the rest of the round once a price call comes back locked_out', async () => {
    const lockedOut = (c: AgentCall) => ({
      ...r1bPass(c),
      priceCalls: [{ at: null, tool: 'get_item_price', item: 'weapon', outcome: 'locked_out' }],
    });
    const r = await research({ R1a: r1a(THREE), 'R1b@c1': lockedOut, R1b: (c) => r1bPass(c), 'R1b-assemble': [assembleOk()] }, { mode: 'online' });
    const [c1, c2, c3] = callsOf(r, 'R1b');
    expect(r.out.stats.priceCalls).toEqual([{ at: null, stage: 'R1b', tool: 'get_item_price', item: 'weapon', outcome: 'locked_out' }]);
    expect(c1.prompt).not.toMatch(/Pricing has stopped/);
    expect(c2.prompt).toMatch(/Pricing has stopped for this run \(a price call came back locked_out\)/);
    expect(c3.prompt).toMatch(/Pricing has stopped/);
  });
});

describe('build-guide-research: a researcher that returns nothing re-runs (§5.4)', () => {
  it('re-runs it after the barrier, with a finding saying so, and keeps its proposals', async () => {
    const r = await research({ R1a: r1aDying(THREE, { 2: 1 }), R1b: (c) => r1bPass(c), 'R1b-assemble': [assembleOk()] });
    const r1aCalls = callsOf(r, 'R1a');
    expect(r1aCalls.map((c) => [(header(c).writes as string[])[0], header(c).attempt])).toEqual([
      ['research/p1-r1a-1.md', 1],
      ['research/p1-r1a-2.md', 1],
      ['research/p1-r1a-3.md', 1],
      ['research/p1-r1a-2.md', 2],
    ]);
    const retry = r1aCalls[3];
    expect((header(retry).findings as { attempt: number; code: string }[]).map((f) => [f.attempt, f.code])).toEqual([[1, 'null-result']]);
    expect(retry.prompt).toContain('Write the file whole');
    // The retry starts after the first barrier, so no more than 3 researchers are ever in flight.
    for (const first of r1aCalls.slice(0, 3)) expect(first.endTick!).toBeLessThan(retry.startTick);
    expect(r.maxInFlight).toBeLessThanOrEqual(3);
    // Researcher 2's proposals are back, in researcher order.
    expect(r.out.concepts.map((c) => [c.id, c.title])).toEqual([
      ['c1', 'Bleed burst'],
      ['c2', 'Rage slam'],
      ['c3', 'Totem titan'],
    ]);
    expect(r.out.stats.attempts.filter((a) => a.stage === 'R1a')).toEqual([
      { stage: 'R1a', attempt: 1, agents: 1, outcome: 'done', findings: 0 },
      { stage: 'R1a', attempt: 1, agents: 1, outcome: 'null-result', findings: 1 },
      { stage: 'R1a', attempt: 1, agents: 1, outcome: 'done', findings: 0 },
      { stage: 'R1a', attempt: 2, agents: 1, outcome: 'done', findings: 0 },
    ]);
    expect(r.out.stats.retries).toEqual([{ stage: 'R1a', concept: null, round: 1, researcher: 2, count: 1 }]);
    expect(callsOf(r, 'R1b-assemble')[0].prompt).toMatch(/"file": "research\/p1-r1a-2\.md",\s*"returned": true/);
  });

  it('re-runs dead researchers together, up to 2 retries each, and tells the assembly which never returned', async () => {
    const r = await research({ R1a: r1aDying(THREE, { 1: 3, 3: 1 }), R1b: (c) => r1bPass(c), 'R1b-assemble': [assembleOk()] });
    const r1aCalls = callsOf(r, 'R1a');
    expect(r1aCalls.map((c) => [(header(c).writes as string[])[0].slice(-8), header(c).attempt])).toEqual([
      ['r1a-1.md', 1],
      ['r1a-2.md', 1],
      ['r1a-3.md', 1],
      ['r1a-1.md', 2],
      ['r1a-3.md', 2],
      ['r1a-1.md', 3],
    ]);
    // Attempt 2's two re-runs run together; attempt 3 waits for them.
    expect(overlaps(r1aCalls[3], r1aCalls[4])).toBe(true);
    expect(r1aCalls[4].endTick!).toBeLessThan(r1aCalls[5].startTick);
    expect(r.maxInFlight).toBe(3);
    expect(r.out.stats.agents.byType['build-guide-researcher']).toBe(6);
    expect(r.out.stats.retries).toEqual([
      { stage: 'R1a', concept: null, round: 1, researcher: 1, count: 2 },
      { stage: 'R1a', concept: null, round: 1, researcher: 3, count: 1 },
    ]);
    // Researcher 1 never returned: the assembly is told; researchers 2 and 3 proposed.
    expect(callsOf(r, 'R1b-assemble')[0].prompt).toMatch(/"file": "research\/p1-r1a-1\.md",\s*"returned": false/);
    expect(r.out.concepts.map((c) => c.title)).toEqual(['Bleed burst', 'Rage slam', 'Totem titan']);
    // AC-W18 read with re-runs: the R1a attempts that returned (one per researcher, at most 3 a round) match
    // the research files; the extra invocations are the retries[] entries.
    expect(r.out.stats.attempts.filter((a) => a.stage === 'R1a' && a.outcome === 'done')).toHaveLength(2);
  });

  it('assigns researcher n the focus R1a.md gives it, so both orchestrations divide the work alike', async () => {
    const ref = fs.readFileSync(path.join(REPO_ROOT, '.claude', 'skills', 'build-guide', 'references', 'stages', 'R1a.md'), 'utf8');
    const table = [...ref.matchAll(/^\| (\d) \| `([a-z]+)` \|/gm)].map((m) => [Number(m[1]), m[2]]);
    expect(table).toEqual([
      [1, 'mechanics'],
      [2, 'items'],
      [3, 'tree'],
    ]);
    const r = await research({ R1a: r1a(THREE), R1b: (c) => r1bPass(c), 'R1b-assemble': [assembleOk()] });
    for (const [n, focus] of table) {
      const call = callsOf(r, 'R1a').find((c) => (header(c).writes as string[])[0] === `research/p1-r1a-${n}.md`)!;
      expect(call.prompt).toContain(`Your focus is "${focus}" (researcher ${n})`);
    }
  });
});

describe('build-guide-research: R1b compiles and prices (R1b.md)', () => {
  it('allows one bootstrap compile and the last, and records each attempt\'s compiles on its verdict', async () => {
    const r = await research({ R1a: r1a(THREE), R1b: (c) => r1bPass(c), 'R1b-assemble': [assembleOk()] });
    for (const c of callsOf(r, 'R1b')) {
      expect(c.prompt).toMatch(/At most 2 compiles in this attempt: one bootstrap compile of a tree-minimal skeleton, if you need it to path the tree, then the whole skeleton/);
      expect(c.prompt).toContain('measure_only: true');
      expect(c.opts.schema?.required).toEqual(expect.arrayContaining(['compiled', 'errors', 'compiles']));
    }
    expect(r.out.gateVerdicts.map((g) => (g as unknown as { compiles: number }).compiles)).toEqual([2, 2, 2]);
  });

  it('prices online only once the skeleton validates, and never offline', async () => {
    const online = await research({ R1a: r1a(THREE), R1b: (c) => r1bPass(c), 'R1b-assemble': [assembleOk()] }, { mode: 'online' });
    for (const c of callsOf(online, 'R1b')) expect(c.prompt).toContain('Once the skeleton validates, price');
    const offline = await research({ R1a: r1a(THREE), R1b: (c) => r1bPass(c), 'R1b-assemble': [assembleOk()] });
    for (const c of callsOf(offline, 'R1b')) expect(c.prompt).toContain('Offline run: make no price call');
  });

  it('passes an unverified league on to the assembly', async () => {
    const r = await research(
      { R1a: r1a(THREE), R1b: (c) => ({ ...r1bPass(c), leagueUnverified: header(c).concept === 'c2' }), 'R1b-assemble': [assembleOk()] },
      { mode: 'online' },
    );
    const input = JSON.parse(/```json\n[\s\S]*?```[\s\S]*?```json\n([\s\S]*?)\n```/.exec(callsOf(r, 'R1b-assemble')[0].prompt)![1]);
    expect(input.concepts.map((c: { id: string; leagueUnverified: boolean }) => [c.id, c.leagueUnverified])).toEqual([
      ['c1', false],
      ['c2', true],
      ['c3', false],
    ]);
  });
});

// ---------------------------------------------------------------------------------------------------
// Design-and-write workflow `build-guide-design` (WU-45): AC-W8, AC-W9, AC-W10, AC-W24
// ---------------------------------------------------------------------------------------------------

/** The final compile's file: the run folder's last two segments joined with "-" (§2). */
const BUILD_NAME = 'titan-blood-hunt-2026-10-08-1';

interface GateFinding {
  part: string;
  code: string;
  stage?: string;
  message: string;
}
interface DesignResult {
  status: 'ready' | 'infeasible' | 'escalated';
  stage?: string;
  evidence?: (Partial<GateFinding> & { gate: string; attempt?: number })[];
  accepted?: (Partial<GateFinding> & { gate: string })[];
  gateVerdicts: {
    stage: string;
    concept: string;
    attempt: number;
    verdict: Record<string, string>;
    findings: GateFinding[];
    basis?: unknown;
    forced?: string;
    finalCompile?: { compiled: boolean; errors: string[]; recordPath?: string | null; pobFile: string | null } | null;
  }[];
  v3Reports: { stage: string; pass: number }[];
  v4Reports: { stage: string; lens: string; pass: number }[];
  stats: ResearchResult['stats'];
}

const designArgs = (over: Record<string, unknown> = {}) => ({
  runFolder: RUN_FOLDER,
  runFolderRel: RUN_FOLDER_REL,
  conceptId: 'c1',
  mode: 'offline',
  buildName: BUILD_NAME,
  ...over,
});

const D1_PARTS = { compiled: 'pass', v1: 'pass', v2: 'pass', floor: 'pass', budget: 'pass', rolledSkill: 'pass' };
const BASIS = {
  floor: [{ stage: 'b', missing: { Fire: 0, Cold: 0, Lightning: 0 }, chaos: 0, hits: [] }],
  budget: { rates: [], slots: [], totals: [{ stage: 'b', divines: null }], nonBudget: [] },
  rolledSkill: [{ stage: 'b', group: 1, role: 'clear', figures: [] }],
};
/** A D1 step's return (D1.md). */
const d1 = (claim: 'done' | 'infeasible' = 'done', reason = '') => ({ claim, reason, compiles: 2, leagueUnverified: false, priceCalls: [] });
/** A D1 gate verdict (D1-gate.md): every part passing unless overridden. */
const d1Gate = (verdict: Record<string, string> = {}, findings: GateFinding[] = []) => ({
  verdict: { ...D1_PARTS, ...verdict },
  findings,
  basis: BASIS,
  recordPath: 'compile-record.json',
  priceCalls: [],
  faultsApplied: [],
});
const d2 = () => ({ claim: 'done', stages: ['1', '2'], compiles: 2, priceCalls: [] });
const d2Check = (verdict: Record<string, string> = {}, findings: GateFinding[] = []) => ({
  verdict: { compiled: 'pass', v1: 'pass', v2: 'pass', ...verdict },
  findings,
  recordPath: 'compile-record.json',
});
const finalOk = () => ({
  compiled: true,
  errors: [],
  recordPath: 'compile-record.json',
  pobFile: `${BUILD_NAME}.xml`,
  verdict: { v1: 'pass', v2: 'pass' },
  findings: [],
});
/** The D2 gate: the measure-only check, then, in the same attempt, the final compile (D2-gate.md). */
const d2Gate =
  (check: (call: AgentCall, nth: number) => unknown = () => d2Check(), final: (call: AgentCall) => unknown = finalOk) =>
  (call: AgentCall, nth: number) =>
    header(call).compile === 'final' ? final(call) : check(call, nth);
const w1 = () => ({ file: 'guide.md', importCode: 'eNrt-fixture-code', gaps: [] });
/** §7.4: the coverage counts each report carries (those of the passing fixture run `run-ok`). */
const COVERAGE_OK: Record<string, Record<string, number>> = {
  V3: { plan: 12, dossier: 4, guide: 12 },
  ledger: { entries: 11, rederived: 11 },
  sources: { external: 0, opened: 0, data: 4, dataChecked: 4, pobDataEndgame: 3, recheckedEndgame: 3, pobDataOther: 6, recheckedOther: 2, prices: 3, matched: 3 },
  prose: { sections: 13, mechanicsClaims: 4 },
};
/** A V3 or V4 report (§7.4) with no finding. */
const report = (call: AgentCall) => {
  const h = header(call);
  return {
    stage: h.stage,
    ...(h.lens !== undefined ? { lens: h.lens } : {}),
    concept: h.concept,
    pass: h.pass,
    mode: h.mode,
    coverage: { ...COVERAGE_OK[(h.lens as string | undefined) ?? (h.stage as string)] },
    findings: [],
    verdict: 'pass',
  };
};

type Table = Parameters<typeof byStage>[0];
/** Every step scripted to pass; `over` replaces some. */
const happy = (over: Table = {}): Table => ({
  D1: () => d1(),
  'D1-gate': () => d1Gate(),
  D2: () => d2(),
  'D2-gate': d2Gate(),
  W1: () => w1(),
  V3: report,
  V4: report,
  ...over,
});
const finding = (part: string, code: string, stage = 'b'): GateFinding => ({ part, code, stage, message: `${part} ${code} on stage ${stage}` });
/** The design stages WU-45 owns; V3 and V4 (and their references) are WU-46's. */
const DESIGN_STAGES = ['D1', 'D1-gate', 'D2', 'D2-gate', 'W1'];

async function design(table: Table, args: Record<string, unknown> = {}, options: Partial<RunOptions> = {}) {
  const r = await run('build-guide-design', { args: designArgs(args), respond: byStage(table), ...options });
  return { ...r, out: r.result as DesignResult };
}
const attemptsOf = (r: { calls: AgentCall[] }, stage: string) => callsOf(r, stage).map((c) => header(c).attempt);
const findingsOf = (call: AgentCall) => header(call).findings as (GateFinding & { attempt: number })[];

describe('build-guide-design: the saved script', () => {
  it('is .claude/workflows/build-guide-design.js, with a pure-literal meta naming it', () => {
    const wf = loadSavedWorkflow('build-guide-design');
    expect(wf.meta.name).toBe('build-guide-design');
    expect(wf.meta.description.length).toBeGreaterThan(40);
    expect(fs.readFileSync(path.join(REPO_ROOT, '.claude', 'skills', 'build-guide', 'SKILL.md'), 'utf8')).toContain('build-guide-design');
  });

  it('refuses args without the run folder, the concept, the mode or the build name', async () => {
    for (const drop of ['runFolder', 'runFolderRel', 'conceptId', 'mode', 'buildName']) {
      const args: Record<string, unknown> = designArgs();
      delete args[drop];
      await expect(run('build-guide-design', { args, respond: () => null })).rejects.toThrow(new RegExp(`args\\.${drop}`));
    }
  });

  it("refuses a build name that isn't the run folder's last two segments joined (§2)", async () => {
    await expect(run('build-guide-design', { args: designArgs({ buildName: 'my-build' }), respond: () => null })).rejects.toThrow(
      /args\.buildName is the run folder's last two segments joined with "-" \("titan-blood-hunt-2026-10-08-1"\)/,
    );
  });
});

describe('AC-W8: the design happy path', () => {
  it('runs D1, the D1 gate, D2, the D2 gate and its final compile, W1, then V3 and the three V4 lenses, and returns ready', async () => {
    const r = await design(happy());
    expect(r.calls.map((c) => [stageOf(c), header(c).compile, header(c).lens ?? null])).toEqual([
      ['D1', 'measure-only', null],
      ['D1-gate', 'measure-only', null],
      ['D2', 'measure-only', null],
      ['D2-gate', 'measure-only', null],
      ['D2-gate', 'final', null],
      ['W1', 'none', null],
      ['V3', 'none', null],
      ['V4', 'none', 'ledger'],
      ['V4', 'none', 'sources'],
      ['V4', 'none', 'prose'],
    ]);
    expect(r.out.status).toBe('ready');
    expect(r.out.stage).toBeUndefined();
  });

  it('says measure-only in every compile header before the D2 gate passes; one step carries final with buildName, the passing D2 gate', async () => {
    // Twice failing, the D2 gate passes on its third attempt: the rule holds across retries too.
    const v1Fail = d2Check({ v1: 'fail' }, [finding('v1', 'tree-continuity', '2')]);
    for (const table of [happy(), happy({ 'D2-gate': d2Gate((_c, nth) => (nth < 2 ? v1Fail : d2Check())) })]) {
      const r = await design(table);
      const finals = r.calls.filter((c) => header(c).compile === 'final');
      expect(finals).toHaveLength(1);
      const final = finals[0];
      // Before it, every compiling header is measure-only; only it names the build.
      for (const c of r.calls.slice(0, final.index)) expect([stageOf(c), header(c).compile]).toEqual([stageOf(c), stageOf(c) === 'W1' ? 'none' : 'measure-only']);
      for (const c of r.calls) expect({ i: c.index, buildName: header(c).buildName }).toEqual({ i: c.index, buildName: c === final ? BUILD_NAME : undefined });
      // It is the D2 gate attempt whose measure-only check passed, and that attempt's verdict passes.
      expect(stageOf(final)).toBe('D2-gate');
      const passing = r.out.gateVerdicts.filter((g) => g.stage === 'D2-gate' && Object.values(g.verdict).every((v) => v === 'pass'));
      expect(passing.map((g) => g.attempt)).toEqual([header(final).attempt]);
      expect(passing[0].finalCompile).toEqual({ compiled: true, errors: [], recordPath: 'compile-record.json', pobFile: `${BUILD_NAME}.xml` });
      const check = r.calls[final.index - 1];
      expect([stageOf(check), header(check).compile, header(check).attempt]).toEqual(['D2-gate', 'measure-only', header(final).attempt]);
      expect(r.out.status).toBe('ready');
    }
  });

  it('names an allowed agentType on every agent() (R-6): the coordinator, the writer, provenance and the verifier', async () => {
    const r = await design(happy());
    const want: Record<string, string> = {
      D1: 'build-guide-coordinator',
      'D1-gate': 'build-guide-coordinator',
      D2: 'build-guide-coordinator',
      'D2-gate': 'build-guide-coordinator',
      W1: 'build-guide-writer',
      V3: 'build-guide-provenance',
      V4: 'build-guide-verifier',
    };
    for (const c of r.calls) {
      expect(AGENT_TYPES).toContain(c.opts.agentType);
      expect({ stage: stageOf(c), type: c.opts.agentType }).toEqual({ stage: stageOf(c), type: want[stageOf(c)] });
    }
  });

  it("carries the args' mode and run folder and only §5.1's fields in every header, each writing only its own files", async () => {
    for (const mode of ['offline', 'online']) {
      const r = await design(happy(), { mode });
      for (const c of r.calls) {
        const h = header(c);
        expect({ mode: h.mode, runFolder: h.runFolder, runFolderRel: h.runFolderRel, concept: h.concept }).toEqual({
          mode,
          runFolder: RUN_FOLDER,
          runFolderRel: RUN_FOLDER_REL,
          concept: 'c1',
        });
        for (const k of Object.keys(h)) expect(HEADER_FIELDS).toContain(k);
        expect(h.reference).toBe(`.claude/skills/build-guide/references/stages/${h.stage}.md`);
        if (DESIGN_STAGES.includes(h.stage as string)) expect(fs.existsSync(path.join(REPO_ROOT, h.reference as string))).toBe(true);
        for (const w of h.writes as string[]) expect(w).not.toMatch(/^\/|\.\./);
      }
      const writes = Object.fromEntries(r.calls.map((c) => [`${stageOf(c)}:${header(c).compile}`, header(c).writes]));
      expect(writes).toEqual({
        'D1:measure-only': ['plan.json'],
        // The D1 gate edits the plan only for the online re-price pass (or FI-2, below).
        'D1-gate:measure-only': mode === 'online' ? ['plan.json'] : [],
        'D2:measure-only': ['plan.json'],
        'D2-gate:measure-only': [],
        'D2-gate:final': [],
        'W1:none': ['guide.md'],
        'V3:none': [],
        'V4:none': [],
      });
      // V3 and V4 read the pass; the gates count their attempts.
      for (const c of r.calls.filter((c) => ['V3', 'V4'].includes(stageOf(c)))) expect(header(c).pass).toBe(1);
    }
  });

  it('runs one coordinator step at a time, overlapping no other agent, and at most 3 verifiers in flight', async () => {
    const r = await design(happy(), {}, { delay: (c) => (['V3', 'V4'].includes(stageOf(c)) ? 1 + c.index : 1) });
    const coordinators = r.calls.filter((c) => c.opts.agentType === 'build-guide-coordinator');
    expect(coordinators).toHaveLength(5);
    for (const c of [...coordinators, ...callsOf(r, 'W1')]) {
      for (const other of r.calls) if (other !== c) expect({ call: c.index, other: other.index, overlap: overlaps(c, other) }).toEqual({ call: c.index, other: other.index, overlap: false });
    }
    const verifiers = r.calls.filter((c) => ['V3', 'V4'].includes(stageOf(c)));
    expect(verifiers).toHaveLength(4);
    expect(r.maxInFlight).toBe(3);
    expect(r.out.stats.agents).toEqual({
      total: 10,
      byType: { 'build-guide-coordinator': 5, 'build-guide-writer': 1, 'build-guide-provenance': 1, 'build-guide-verifier': 3 },
      maxConcurrent: 3,
    });
  });

  it('returns the gate verdicts, the reports and the stats the skill logs (references/run-log.md, gates.md)', async () => {
    const r = await design(happy());
    expect(r.out.gateVerdicts.map((g) => [g.stage, g.concept, g.attempt, g.verdict])).toEqual([
      ['D1-gate', 'c1', 1, D1_PARTS],
      ['D2-gate', 'c1', 1, { compiled: 'pass', v1: 'pass', v2: 'pass' }],
    ]);
    // The D1 gate's file carries the basis the run checker recomputes it from.
    expect(r.out.gateVerdicts[0].basis).toEqual(BASIS);
    expect(r.out.v3Reports.map((x) => [x.stage, x.pass])).toEqual([['V3', 1]]);
    expect(r.out.v4Reports.map((x) => [x.stage, x.lens, x.pass])).toEqual([
      ['V4', 'ledger', 1],
      ['V4', 'sources', 1],
      ['V4', 'prose', 1],
    ]);
    expect(r.out.stats.attempts).toEqual([
      { stage: 'D1', concept: 'c1', attempt: 1, agents: 1, outcome: 'done', findings: 0 },
      { stage: 'D1-gate', concept: 'c1', attempt: 1, agents: 1, outcome: 'pass', findings: 0 },
      { stage: 'D2', concept: 'c1', attempt: 1, agents: 1, outcome: 'done', findings: 0 },
      // The D2 gate's attempt holds its check and its final compile: two agents.
      { stage: 'D2-gate', concept: 'c1', attempt: 1, agents: 2, outcome: 'pass', findings: 0 },
      { stage: 'W1', concept: 'c1', attempt: 1, agents: 1, outcome: 'done', findings: 0 },
      { stage: 'V3', concept: 'c1', pass: 1, attempt: 1, agents: 1, outcome: 'pass', findings: 0 },
      { stage: 'V4', concept: 'c1', lens: 'ledger', pass: 1, attempt: 1, agents: 1, outcome: 'pass', findings: 0 },
      { stage: 'V4', concept: 'c1', lens: 'sources', pass: 1, attempt: 1, agents: 1, outcome: 'pass', findings: 0 },
      { stage: 'V4', concept: 'c1', lens: 'prose', pass: 1, attempt: 1, agents: 1, outcome: 'pass', findings: 0 },
    ]);
    expect(r.out.stats.retries).toEqual([]);
    expect(r.out.stats.priceCalls).toEqual([]);
    expect(r.out.stats.faults).toEqual([]);
    expect(r.out.accepted).toBeUndefined();
  });

  it("gives W1 the D1 gate's budget totals and findings, and V3 and V4 nothing a D1, D2 or W1 step returned", async () => {
    const SENTINEL = 'SENTINEL-d1-d2-w1-text';
    const nearCeiling = finding('budget', 'near-ceiling');
    const r = await design(
      happy({
        D1: () => ({ ...d1(), reason: SENTINEL }),
        'D1-gate': () => d1Gate({}, [nearCeiling]),
        D2: () => ({ ...d2(), stages: [SENTINEL] }),
        W1: () => ({ ...w1(), gaps: [SENTINEL] }),
      }),
    );
    const w1Prompt = callsOf(r, 'W1')[0].prompt;
    expect(w1Prompt).toContain('near-ceiling');
    expect(w1Prompt).toContain('"totals"');
    expect(w1Prompt).toContain('.claude/skills/build-guide/templates/guide-template.md');
    for (const c of r.calls.filter((c) => ['V3', 'V4'].includes(stageOf(c)))) {
      expect(c.prompt).not.toContain(SENTINEL);
      expect(header(c).findings).toEqual([]);
      expect(header(c).accepted).toEqual([]);
    }
  });

  it('prices online in D1 and D2 at the pace pricing.md sets, never offline, and stops once a call comes back rate_limited', async () => {
    const offline = await design(happy());
    for (const c of [...callsOf(offline, 'D1'), ...callsOf(offline, 'D2')]) expect(c.prompt).toContain('Offline run: make no price call');
    expect(callsOf(offline, 'D1-gate')[0].prompt).toContain('Offline run: no re-price pass and no price call');

    const limited = await design(
      happy({ D1: () => ({ ...d1(), priceCalls: [{ at: null, tool: 'search_trade_items', item: 'Ring 1', outcome: 'rate_limited' }] }) }),
      { mode: 'online' },
    );
    expect(callsOf(limited, 'D1')[0].prompt).toMatch(/Price every filled slot and tree jewel of both variants/);
    expect(callsOf(limited, 'D1-gate')[0].prompt).toMatch(/Pricing has stopped for this run \(a price call came back rate_limited\): no re-price pass/);
    expect(callsOf(limited, 'D2')[0].prompt).toMatch(/Pricing has stopped for this run/);
    expect(limited.out.stats.priceCalls).toEqual([{ at: null, stage: 'D1', tool: 'search_trade_items', item: 'Ring 1', outcome: 'rate_limited' }]);

    const online = await design(happy(), { mode: 'online' });
    expect(callsOf(online, 'D1-gate')[0].prompt).toContain('First the final re-price pass');
  });

  it('tells W1 when D1 found no league to verify, and D1 never to take an unverified league', async () => {
    const r = await design(happy({ D1: () => ({ ...d1(), leagueUnverified: true }) }), { mode: 'online' });
    expect(callsOf(r, 'D1')[0].prompt).toMatch(/never from a skeleton or dossier line that marks it unverified, and never a guess such as Standard/);
    expect(callsOf(r, 'W1')[0].prompt).toContain("The league couldn't be verified");
    const plain = await design(happy(), { mode: 'online' });
    expect(callsOf(plain, 'W1')[0].prompt).not.toContain("The league couldn't be verified");
    // Without D1's word (a resume past D1), W1 still reads plan.json's league.
    expect(callsOf(plain, 'W1')[0].prompt).toContain('Take the league from plan.json: "unverified" there means');
  });

  it('writes plan.json anew on D1 attempt 1, and edits it on a retry', async () => {
    const r = await design(happy({ 'D1-gate': [d1Gate({ v1: 'fail' }, [finding('v1', 'passive-points')]), d1Gate()] }));
    const [first, second] = callsOf(r, 'D1');
    expect(first.prompt).toContain('Write plan.json whole, from this concept\'s skeleton');
    expect(second.prompt).toContain('Edit plan.json');
  });
});

describe('AC-W9: the D1 gate table (§5.3)', () => {
  it('row 1: compiled, V1, V2, floor and rolled skill passing, budget pass or unverified, goes on to D2 whatever D1 claims', async () => {
    for (const budget of ['pass', 'unverified']) {
      for (const claim of ['done', 'infeasible'] as const) {
        const r = await design(happy({ D1: () => d1(claim, claim === 'infeasible' ? 'no shield slot' : ''), 'D1-gate': () => d1Gate({ budget }, budget === 'unverified' ? [finding('budget', 'unverified')] : []) }));
        expect({ budget, claim, d1: attemptsOf(r, 'D1'), d2: callsOf(r, 'D2').length, status: r.out.status }).toEqual({ budget, claim, d1: [1], d2: 1, status: 'ready' });
      }
    }
  });

  it('row 2: a compile, V1 or V2 failure re-runs D1 with the findings, and escalates after 2 retries, whatever D1 claims', async () => {
    for (const part of ['compiled', 'v1', 'v2']) {
      for (const claim of ['done', 'infeasible'] as const) {
        const r = await design(
          happy({
            D1: () => d1(claim, claim === 'infeasible' ? 'claimed' : ''),
            'D1-gate': (c) => d1Gate({ [part]: 'fail' }, [{ part, code: `${part}-code`, stage: 'b', message: `attempt ${header(c).attempt}` }]),
          }),
        );
        expect({ part, claim, d1: attemptsOf(r, 'D1'), gate: attemptsOf(r, 'D1-gate') }).toEqual({ part, claim, d1: [1, 2, 3], gate: [1, 2, 3] });
        // Each retry carries every earlier attempt's findings.
        const d1Calls = callsOf(r, 'D1');
        expect(findingsOf(d1Calls[0])).toEqual([]);
        expect(findingsOf(d1Calls[1]).map((f) => [f.attempt, f.part, f.code, f.message])).toEqual([[1, part, `${part}-code`, 'attempt 1']]);
        expect(findingsOf(d1Calls[2]).map((f) => [f.attempt, f.message])).toEqual([
          [1, 'attempt 1'],
          [2, 'attempt 2'],
        ]);
        expect(r.out.status).toBe('escalated');
        expect(r.out.stage).toBe('D1-gate');
        expect(r.out.evidence!.map((e) => [e.gate, e.attempt, e.part, e.code])).toEqual([1, 2, 3].map((n) => ['D1-gate', n, part, `${part}-code`]));
        // After escalated, no D2 step runs.
        expect(callsOf(r, 'D2')).toHaveLength(0);
        expect(r.out.stats.retries).toEqual([{ stage: 'D1', concept: 'c1', count: 2 }]);
        expect(r.out.stats.attempts.filter((a) => a.stage === 'D1-gate').map((a) => a.outcome)).toEqual(['fail', 'fail', 'escalated']);
      }
    }
  });

  it('row 3: only floor, budget or rolled skill failing, with D1 claiming infeasible, is infeasible at once, the verdict as evidence', async () => {
    for (const part of ['floor', 'budget', 'rolledSkill']) {
      const code = { floor: 'missing-chaos-resist', budget: 'over-budget', rolledSkill: 'rolled-not-largest' }[part]!;
      const r = await design(happy({ D1: () => d1('infeasible', 'no slot can carry chaos resistance'), 'D1-gate': () => d1Gate({ [part]: 'fail' }, [finding(part, code)]) }));
      expect({ part, d1: attemptsOf(r, 'D1'), status: r.out.status, stage: r.out.stage }).toEqual({ part, d1: [1], status: 'infeasible', stage: 'D1-gate' });
      expect(r.out.evidence).toEqual([
        expect.objectContaining({ gate: 'D1-gate', attempt: 1, part, code }),
        expect.objectContaining({ gate: 'D1', attempt: 1, code: 'claimed-infeasible', message: 'no slot can carry chaos resistance' }),
      ]);
      expect(callsOf(r, 'D2')).toHaveLength(0);
      expect(r.out.stats.attempts.find((a) => a.stage === 'D1-gate')!.outcome).toBe('infeasible');
      expect(r.out.stats.retries).toEqual([]);
    }
  });

  it('row 4: only floor, budget or rolled skill failing, with D1 claiming done, re-runs D1 with the findings, and is infeasible after 2 retries', async () => {
    for (const part of ['floor', 'budget', 'rolledSkill']) {
      const r = await design(happy({ 'D1-gate': (c) => d1Gate({ [part]: 'fail' }, [{ ...finding(part, 'some-code'), message: `attempt ${header(c).attempt}` }]) }));
      expect({ part, d1: attemptsOf(r, 'D1'), status: r.out.status, stage: r.out.stage }).toEqual({ part, d1: [1, 2, 3], status: 'infeasible', stage: 'D1-gate' });
      expect(findingsOf(callsOf(r, 'D1')[2]).map((f) => f.message)).toEqual(['attempt 1', 'attempt 2']);
      expect(r.out.evidence!.map((e) => [e.attempt, e.part])).toEqual([[3, part]]);
      expect(callsOf(r, 'D2')).toHaveLength(0);
      expect(r.out.stats.retries).toEqual([{ stage: 'D1', concept: 'c1', count: 2 }]);
    }
  });

  it('a hard failure beside a floor failure is row 2, even when D1 claims infeasible', async () => {
    const r = await design(happy({ D1: () => d1('infeasible', 'claimed'), 'D1-gate': () => d1Gate({ v1: 'fail', floor: 'fail' }, [finding('v1', 'passive-points'), finding('floor', 'missing-cold-resist')]) }));
    expect(attemptsOf(r, 'D1')).toEqual([1, 2, 3]);
    expect(r.out.status).toBe('escalated');
  });

  it('a failure cleared within the cap goes on to D2, the retry carrying its findings', async () => {
    const r = await design(happy({ 'D1-gate': [d1Gate({ floor: 'fail' }, [finding('floor', 'missing-cold-resist')]), d1Gate()] }));
    expect(attemptsOf(r, 'D1')).toEqual([1, 2]);
    expect(findingsOf(callsOf(r, 'D1')[1]).map((f) => [f.attempt, f.code])).toEqual([[1, 'missing-cold-resist']]);
    expect(r.out.status).toBe('ready');
    expect(r.out.stats.retries).toEqual([{ stage: 'D1', concept: 'c1', count: 1 }]);
    expect(r.out.gateVerdicts.filter((g) => g.stage === 'D1-gate').map((g) => [g.attempt, g.verdict.floor])).toEqual([
      [1, 'fail'],
      [2, 'pass'],
    ]);
  });

  it('never counts a chaos-exception or near-ceiling finding as a failure, so an accepted failure beside one proceeds', async () => {
    const accepted = { gate: 'D1-gate', part: 'floor', code: 'missing-cold-resist', stage: 'b', message: 'm' };
    const r = await design(
      happy({ 'D1-gate': () => d1Gate({ floor: 'fail' }, [finding('floor', 'missing-cold-resist'), finding('floor', 'chaos-exception'), finding('budget', 'near-ceiling')]) }),
      { resume: { reason: 'accepted', stage: 'D1-gate', findings: [accepted], attempts: { D1: 3, 'D1-gate': 3 }, retries: { D1: 2 } } },
    );
    expect(r.out.status).toBe('ready');
    expect(callsOf(r, 'D2')).toHaveLength(1);
  });

  it('a floor that is unverified, or failing with no finding, still fails; only the budget may be unverified', async () => {
    const r = await design(happy({ 'D1-gate': [d1Gate({ floor: 'unverified' }), d1Gate({ rolledSkill: 'fail' }), d1Gate()] }));
    expect(attemptsOf(r, 'D1')).toEqual([1, 2, 3]);
    expect(findingsOf(callsOf(r, 'D1')[2]).map((f) => [f.attempt, f.part, f.code])).toEqual([
      [1, 'floor', 'floor-unverified'],
      [2, 'rolledSkill', 'rolledSkill-fail'],
    ]);
    expect(r.out.status).toBe('ready');
  });

  it('a compile failure leaves the other parts unverified, and D1 gets the compile error alone', async () => {
    const unverified = { v1: 'unverified', v2: 'unverified', floor: 'unverified', budget: 'unverified', rolledSkill: 'unverified' };
    const r = await design(happy({ 'D1-gate': [d1Gate({ compiled: 'fail', ...unverified }, [finding('compiled', 'compile-error')]), d1Gate()] }));
    expect(findingsOf(callsOf(r, 'D1')[1]).map((f) => [f.part, f.code])).toEqual([['compiled', 'compile-error']]);
    expect(r.out.status).toBe('ready');
  });

  it('counts a null D1 result as a failed attempt, which re-runs; a null D1 gate re-runs the gate alone', async () => {
    const r = await design(happy({ D1: [null, d1()], 'D1-gate': [null, d1Gate()] }));
    expect(r.calls.slice(0, 4).map((c) => [stageOf(c), header(c).attempt])).toEqual([
      ['D1', 1],
      ['D1', 2],
      ['D1-gate', 1],
      ['D1-gate', 2],
    ]);
    expect(findingsOf(callsOf(r, 'D1')[1]).map((f) => [f.attempt, f.code])).toEqual([[1, 'null-result']]);
    // A dead attempt 1 may have left a partial plan: attempt 2 still writes it anew.
    expect(callsOf(r, 'D1')[1].prompt).toContain('Write plan.json whole');
    expect(r.out.stats.retries).toEqual([
      { stage: 'D1', concept: 'c1', count: 1 },
      { stage: 'D1-gate', concept: 'c1', count: 1 },
    ]);
    // A null gate attempt has no verdict, so no gate file (FR-W6).
    expect(r.out.gateVerdicts.filter((g) => g.stage === 'D1-gate').map((g) => g.attempt)).toEqual([2]);
    expect(r.out.status).toBe('ready');
  });

  it('escalates when D1 or its gate returns nothing three times', async () => {
    const deadD1 = await design(happy({ D1: () => null }));
    expect([attemptsOf(deadD1, 'D1'), deadD1.out.status, deadD1.out.stage]).toEqual([[1, 2, 3], 'escalated', 'D1']);
    const deadGate = await design(happy({ 'D1-gate': () => null }));
    expect([attemptsOf(deadGate, 'D1'), attemptsOf(deadGate, 'D1-gate'), deadGate.out.status, deadGate.out.stage]).toEqual([[1], [1, 2, 3], 'escalated', 'D1-gate']);
    for (const r of [deadD1, deadGate]) expect(callsOf(r, 'D2')).toHaveLength(0);
  });
});

describe('AC-W10: the D2 gate, W1, FI-2 and FI-3', () => {
  it('a D2 gate failing 3 times escalates with 3 attempts\' findings; no final compile and no W1 run', async () => {
    const r = await design(happy({ 'D2-gate': d2Gate((c) => d2Check({ v2: 'fail' }, [{ part: 'v2', code: 'default-unlisted', stage: '2', message: `attempt ${header(c).attempt}` }])) }));
    expect(attemptsOf(r, 'D2')).toEqual([1, 2, 3]);
    expect(attemptsOf(r, 'D2-gate')).toEqual([1, 2, 3]);
    expect(findingsOf(callsOf(r, 'D2')[2]).map((f) => [f.attempt, f.code, f.message])).toEqual([
      [1, 'default-unlisted', 'attempt 1'],
      [2, 'default-unlisted', 'attempt 2'],
    ]);
    expect(r.out.status).toBe('escalated');
    expect(r.out.stage).toBe('D2-gate');
    expect(r.out.evidence!.map((e) => [e.gate, e.attempt, e.code])).toEqual([1, 2, 3].map((n) => ['D2-gate', n, 'default-unlisted']));
    expect(r.calls.filter((c) => header(c).compile === 'final')).toHaveLength(0);
    expect(callsOf(r, 'W1')).toHaveLength(0);
    expect(r.out.stats.retries).toEqual([{ stage: 'D2', concept: 'c1', count: 2 }]);
  });

  it('a failed final compile fails its D2 gate attempt, and D2 re-runs with the error', async () => {
    const refused = () => ({ ...finalOk(), compiled: false, errors: ['titan-blood-hunt-2026-10-08-1.xml already exists'], pobFile: null });
    const r = await design(happy({ 'D2-gate': d2Gate(() => d2Check(), (c) => (header(c).attempt === 1 ? refused() : finalOk())) }));
    expect(r.calls.filter((c) => stageOf(c).startsWith('D2')).map((c) => [stageOf(c), header(c).attempt, header(c).compile])).toEqual([
      ['D2', 1, 'measure-only'],
      ['D2-gate', 1, 'measure-only'],
      ['D2-gate', 1, 'final'],
      ['D2', 2, 'measure-only'],
      ['D2-gate', 2, 'measure-only'],
      ['D2-gate', 2, 'final'],
    ]);
    expect(findingsOf(callsOf(r, 'D2')[1]).map((f) => [f.part, f.code, f.message])).toEqual([['compiled', 'final-compile', 'titan-blood-hunt-2026-10-08-1.xml already exists']]);
    const files = r.out.gateVerdicts.filter((g) => g.stage === 'D2-gate');
    expect(files.map((g) => [g.attempt, g.verdict.compiled, g.finalCompile?.compiled])).toEqual([
      [1, 'fail', false],
      [2, 'pass', true],
    ]);
    expect(r.out.status).toBe('ready');
  });

  it("D-260: the final compile's verdict carries no import code, even when the agent returns one; the record is its one home", async () => {
    const code = `eNrt${'A'.repeat(10000)}`;
    const r = await design(happy({ 'D2-gate': d2Gate(() => d2Check(), () => ({ ...finalOk(), importCode: code })) }));
    expect(r.out.status).toBe('ready');
    const final = r.calls.find((c) => header(c).compile === 'final')!;
    // The schema asks for no import code, and the prompt says to return none.
    expect(Object.keys((final.opts.schema as { properties: Record<string, unknown> }).properties)).not.toContain('importCode');
    expect(final.prompt).toMatch(/Don't return the import code: compile-record\.json is its one home \(D-260\)/);
    const d2 = r.out.gateVerdicts.find((g) => g.stage === 'D2-gate')!;
    expect(d2.finalCompile).toEqual({ compiled: true, errors: [], recordPath: 'compile-record.json', pobFile: `${BUILD_NAME}.xml` });
    // So the result the skill copies into reports/ holds no 10K-character code.
    expect(JSON.stringify(r.out)).not.toContain(code);
  });

  it('a null W1 result re-runs W1, with a finding saying so; three escalate', async () => {
    const r = await design(happy({ W1: [null, w1()] }));
    expect(attemptsOf(r, 'W1')).toEqual([1, 2]);
    expect(findingsOf(callsOf(r, 'W1')[1]).map((f) => [f.attempt, f.code])).toEqual([[1, 'null-result']]);
    expect(r.out.stats.attempts.filter((a) => a.stage === 'W1').map((a) => a.outcome)).toEqual(['null-result', 'done']);
    expect(r.out.stats.retries).toEqual([{ stage: 'W1', concept: 'c1', count: 1 }]);
    expect(r.out.status).toBe('ready');
    const dead = await design(happy({ W1: () => null }));
    expect([attemptsOf(dead, 'W1'), dead.out.status, dead.out.stage]).toEqual([[1, 2, 3], 'escalated', 'W1']);
    expect(callsOf(dead, 'V3')).toHaveLength(0);
  });

  it('puts FI-2 only in the D1 gate header for the targeted concept, on attempt 1 unless persistent', async () => {
    const fi2 = (concepts: string[] | 'all', persistent: boolean) => ({ id: 'FI-2', concepts, persistent });
    // FI-2 makes V1 fail for the stage it edited; the retry passes.
    const v1OnFault = (c: AgentCall) =>
      (header(c).faults as unknown[]).length > 0
        ? { ...d1Gate({ v1: 'fail' }, [finding('v1', 'passive-points')]), faultsApplied: [{ id: 'FI-2', observed: 'stage b: passive-points at level 1' }] }
        : d1Gate();
    const faultsByCall = (r: RunResult) => r.calls.map((c) => [stageOf(c), header(c).attempt, (header(c).faults as { id: string }[]).map((f) => f.id)]).filter(([, , ids]) => (ids as string[]).length > 0);

    const once = await design(happy({ 'D1-gate': v1OnFault }), { conceptId: 'c2', faults: [fi2(['c2'], false), { id: 'FI-1', concepts: 'all', persistent: true }] });
    expect(faultsByCall(once)).toEqual([['D1-gate', 1, ['FI-2']]]);
    expect(header(callsOf(once, 'D1-gate')[0]).faults).toEqual([fi2(['c2'], false)]);
    // FI-2 edits the plan, so the gate may write it.
    expect(header(callsOf(once, 'D1-gate')[0]).writes).toEqual(['plan.json']);
    expect(header(callsOf(once, 'D1-gate')[1]).writes).toEqual([]);
    expect(attemptsOf(once, 'D1')).toEqual([1, 2]);
    expect(once.out.status).toBe('ready');
    expect(once.out.stats.faults).toEqual([{ id: 'FI-2', target: { concepts: ['c2'], persistent: false }, applied: 1, observed: 'stage b: passive-points at level 1' }]);

    // Another concept's directive reaches no header; online, none at all.
    const other = await design(happy({ 'D1-gate': v1OnFault }), { conceptId: 'c1', faults: [fi2(['c2'], true)] });
    expect(faultsByCall(other)).toEqual([]);
    expect(other.out.stats.faults).toEqual([]);
    const online = await design(happy({ 'D1-gate': v1OnFault }), { mode: 'online', faults: [fi2('all', true)] });
    expect(faultsByCall(online)).toEqual([]);

    // Persistent: every D1 gate attempt carries it, so V1 fails three times and the design escalates.
    const always = await design(happy({ 'D1-gate': v1OnFault }), { faults: [fi2('all', true)] });
    expect(faultsByCall(always)).toEqual([1, 2, 3].map((n) => ['D1-gate', n, ['FI-2']]));
    expect(always.out.status).toBe('escalated');
    expect(always.out.stats.faults).toEqual([expect.objectContaining({ id: 'FI-2', applied: 3 })]);
  });

  it('FI-3 makes the D1 gate return infeasible, with evidence FI-3 (injected), and no D2 step runs', async () => {
    const r = await design(happy(), { faults: [{ id: 'FI-3', concepts: ['c1'], persistent: false }] });
    expect(r.calls.map((c) => stageOf(c))).toEqual(['D1', 'D1-gate']);
    expect((header(callsOf(r, 'D1-gate')[0]).faults as { id: string }[]).map((f) => f.id)).toEqual(['FI-3']);
    expect(r.out.status).toBe('infeasible');
    expect(r.out.stage).toBe('D1-gate');
    expect(r.out.evidence).toEqual([{ gate: 'D1-gate', attempt: 1, code: 'FI-3', message: 'FI-3 (injected)' }]);
    expect(r.out.gateVerdicts).toEqual([expect.objectContaining({ stage: 'D1-gate', attempt: 1, forced: 'FI-3' })]);
    expect(r.out.stats.attempts.find((a) => a.stage === 'D1-gate')!.outcome).toBe('infeasible');
    expect(r.out.stats.faults).toEqual([
      { id: 'FI-3', target: { concepts: ['c1'], persistent: false }, applied: 1, observed: "the D1 gate's outcome was forced to infeasible: FI-3 (injected)" },
    ]);
    // FI-3 for another concept changes nothing.
    const other = await design(happy(), { conceptId: 'c2', faults: [{ id: 'FI-3', concepts: ['c1'], persistent: false }] });
    expect(other.out.status).toBe('ready');
  });
});

describe('AC-W24: resuming after an escalation (§5.3, §5.4; D-236)', () => {
  const v1Finding = { gate: 'D1-gate', part: 'v1', code: 'passive-points', stage: 'b', message: 'stage b spends 130 points at level 90' };
  /** What the skill passes: each stage's attempts so far, from the run log (SKILL.md §6). */
  const D1_USED = { D1: 3, 'D1-gate': 3 };
  const D2_USED = { D1: 1, 'D1-gate': 1, D2: 3, 'D2-gate': 3 };
  /** The cap-counted retries the escalated stage used, from the run log's retries[] (SKILL.md §6). */
  const D1_RETRIES = { D1: 2 };
  const D2_RETRIES = { D2: 2 };

  it('guided-retry of D1 runs D1 once with the findings and the guidance, then the D1 gate, outside the cap', async () => {
    const r = await design(happy(), { resume: { reason: 'guided-retry', stage: 'D1', findings: [v1Finding], guidance: 'drop the second jewel', attempts: D1_USED, retries: D1_RETRIES } });
    expect(r.calls.slice(0, 2).map((c) => [stageOf(c), header(c).attempt])).toEqual([
      ['D1', 4],
      ['D1-gate', 4],
    ]);
    expect(callsOf(r, 'D1')).toHaveLength(1);
    expect(findingsOf(callsOf(r, 'D1')[0])).toEqual([v1Finding, { code: 'user-guidance', message: 'drop the second jewel' }]);
    expect(callsOf(r, 'D1')[0].prompt).toContain('A guided retry');
    expect(callsOf(r, 'D1')[0].prompt).toContain('Edit plan.json');
    // The flow then continues as after any attempt.
    expect(r.out.status).toBe('ready');
    expect(callsOf(r, 'D2')).toHaveLength(1);
    // The guided attempt is no cap-counted retry; D2's attempts start afresh.
    expect(r.out.stats.retries).toEqual([]);
    expect(attemptsOf(r, 'D2')).toEqual([1]);
    expect(r.out.stats.attempts.filter((a) => a.stage === 'D1')).toEqual([{ stage: 'D1', concept: 'c1', attempt: 4, agents: 1, outcome: 'done', findings: 0 }]);
  });

  it('continues the attempt numbers the resume gives', async () => {
    const r = await design(happy(), { resume: { reason: 'guided-retry', stage: 'D1-gate', findings: [v1Finding], guidance: 'g', attempts: { D1: 3, 'D1-gate': 5 }, retries: { D1: 2, 'D1-gate': 2 } } });
    expect(r.calls.slice(0, 2).map((c) => [stageOf(c), header(c).attempt])).toEqual([
      ['D1', 4],
      ['D1-gate', 6],
    ]);
  });

  it('a scripted gate failure on a guided retry returns escalated again, with no retry', async () => {
    const r = await design(happy({ 'D1-gate': () => d1Gate({ v1: 'fail' }, [finding('v1', 'passive-points')]) }), {
      resume: { reason: 'guided-retry', stage: 'D1', findings: [v1Finding], guidance: 'g', attempts: D1_USED, retries: D1_RETRIES },
    });
    expect(r.calls.map((c) => stageOf(c))).toEqual(['D1', 'D1-gate']);
    expect(r.out.status).toBe('escalated');
    expect(r.out.stage).toBe('D1-gate');
    expect(r.out.stats.retries).toEqual([]);
    // A floor failure after a guided retry escalates again too, rather than ending infeasible.
    const floor = await design(happy({ 'D1-gate': () => d1Gate({ floor: 'fail' }, [finding('floor', 'missing-cold-resist')]) }), {
      resume: { reason: 'guided-retry', stage: 'D1', findings: [v1Finding], guidance: 'g', attempts: D1_USED, retries: D1_RETRIES },
    });
    expect([floor.out.status, callsOf(floor, 'D1').length]).toEqual(['escalated', 1]);
  });

  it('guided-retry of D2 or W1 starts there, with the guidance', async () => {
    const d2r = await design(happy(), { resume: { reason: 'guided-retry', stage: 'D2-gate', findings: [], guidance: 'level the trees evenly', attempts: D2_USED, retries: D2_RETRIES } });
    expect(d2r.calls.map((c) => stageOf(c)).slice(0, 3)).toEqual(['D2', 'D2-gate', 'D2-gate']);
    expect(findingsOf(callsOf(d2r, 'D2')[0])).toEqual([{ code: 'user-guidance', message: 'level the trees evenly' }]);
    expect(d2r.out.status).toBe('ready');
    const w1r = await design(happy(), { resume: { reason: 'guided-retry', stage: 'W1', findings: [], guidance: 'shorter', attempts: { ...D2_USED, W1: 3 }, retries: { W1: 2 } } });
    expect(w1r.calls.map((c) => stageOf(c))[0]).toBe('W1');
    expect(header(callsOf(w1r, 'W1')[0]).attempt).toBe(4);
  });

  it('accepted at the D1 gate re-runs the gate with the finding in accepted; a verdict failing only on it proceeds to D2', async () => {
    const accepted = { ...v1Finding };
    const r = await design(happy({ 'D1-gate': () => d1Gate({ v1: 'fail' }, [finding('v1', 'passive-points', 'b')]) }), {
      resume: { reason: 'accepted', stage: 'D1-gate', findings: [accepted], attempts: D1_USED, retries: D1_RETRIES },
    });
    // No D1: the failed gate step runs again, its attempt continuing the escalated ones.
    expect(r.calls[0].header).toEqual(expect.objectContaining({ stage: 'D1-gate', attempt: 4, accepted: [accepted] }));
    expect(callsOf(r, 'D1')).toHaveLength(0);
    expect(callsOf(r, 'D2')).toHaveLength(1);
    expect(r.out.status).toBe('ready');
    // The D2 gate's and W1's headers carry the accepted finding; the result returns it.
    for (const c of [...callsOf(r, 'D2-gate'), ...callsOf(r, 'W1')]) expect(header(c).accepted).toEqual([accepted]);
    expect(callsOf(r, 'W1')[0].prompt).toContain('Accepted failures');
    expect(r.out.accepted).toEqual([accepted]);
    // The gate's file keeps the failure as reported: the run checker counts accepted findings itself.
    expect(r.out.gateVerdicts[0]).toEqual(expect.objectContaining({ stage: 'D1-gate', attempt: 4, verdict: expect.objectContaining({ v1: 'fail' }) }));
    expect(r.out.stats.attempts[0]).toEqual(expect.objectContaining({ stage: 'D1-gate', attempt: 4, outcome: 'pass' }));
  });

  it('a finding equal to the accepted one (same plan stage, part and code) fails no later gate; another one still fails', async () => {
    const same = await design(
      happy({
        'D1-gate': () => d1Gate({ v1: 'fail' }, [finding('v1', 'passive-points', 'b')]),
        'D2-gate': d2Gate(() => d2Check({ v1: 'fail' }, [finding('v1', 'passive-points', 'b')])),
      }),
      { resume: { reason: 'accepted', stage: 'D1-gate', findings: [v1Finding], attempts: D1_USED, retries: D1_RETRIES } },
    );
    expect(same.out.status).toBe('ready');
    expect(same.calls.filter((c) => header(c).compile === 'final')).toHaveLength(1);

    // The same code on another plan stage, or another code, is a new failure: no retries are left, so it
    // escalates again.
    for (const other of [finding('v1', 'passive-points', 'n'), finding('v1', 'attributes', 'b')]) {
      const r = await design(happy({ 'D1-gate': () => d1Gate({ v1: 'fail' }, [finding('v1', 'passive-points', 'b'), other]) }), {
        resume: { reason: 'accepted', stage: 'D1-gate', findings: [v1Finding], attempts: D1_USED, retries: D1_RETRIES },
      });
      expect([r.out.status, r.out.stage, callsOf(r, 'D2').length]).toEqual(['escalated', 'D1-gate', 0]);
      expect(r.out.evidence!.map((e) => [e.stage, e.code])).toEqual([[other.stage, other.code]]);
    }
  });

  it('never accepts a compile failure, and keeps earlier accepted findings from args.accepted', async () => {
    const compileFinding = { gate: 'D1-gate', part: 'compiled', code: 'compile-error', stage: 'b', message: 'unknown gem' };
    const r = await design(happy({ 'D1-gate': () => d1Gate({ compiled: 'fail' }, [finding('compiled', 'compile-error', 'b')]) }), {
      resume: { reason: 'accepted', stage: 'D1-gate', findings: [compileFinding], attempts: D1_USED, retries: D1_RETRIES },
    });
    expect(r.out.status).toBe('escalated');

    const earlier = { gate: 'D1-gate', part: 'v2', code: 'default-unlisted', stage: '2', message: 'accepted earlier' };
    const later = await design(happy({ 'D2-gate': d2Gate(() => d2Check({ v2: 'fail' }, [finding('v2', 'default-unlisted', '2')])) }), {
      accepted: [earlier],
      resume: { reason: 'accepted', stage: 'D2-gate', findings: [{ gate: 'D2-gate', part: 'v1', code: 'tree-continuity', stage: '2', message: 'm' }], attempts: D2_USED, retries: D2_RETRIES },
    });
    expect(later.calls.map((c) => [stageOf(c), header(c).compile])).toEqual([
      ['D2-gate', 'measure-only'],
      ['D2-gate', 'final'],
      ['W1', 'none'],
      ['V3', 'none'],
      ['V4', 'none'],
      ['V4', 'none'],
      ['V4', 'none'],
    ]);
    expect(later.out.status).toBe('ready');
    expect((header(callsOf(later, 'W1')[0]).accepted as { code: string }[]).map((a) => a.code)).toEqual(['default-unlisted', 'tree-continuity']);
  });

  it('accepted after a V3 or V4 escalation re-runs W1 to state the findings, then V3 and V4 with them covered by id (D-253)', async () => {
    const SENTINEL = 'SENTINEL-guide-text';
    const vf = { gate: 'V4', id: 'f-src-2', artifact: 'guide.md', location: 'Summary', claim: SENTINEL, issue: 'i', evidence: 'e', owner: 'W1', status: 'unresolved' };
    const used = { ...D2_USED, 'D2-gate': 1, D2: 1, W1: 1, V3: 1, V4: 1 };
    const sources = (id: string) => (call: AgentCall) => ({ ...report(call), findings: [{ ...vf, id }], verdict: 'fail' });
    const r = await design(happy({ 'V4@sources': sources('f-src-2') }), { resume: { reason: 'accepted', stage: 'V4', findings: [vf], attempts: used, retries: { W1: 2 } } });
    expect(r.calls.map((c) => [stageOf(c), header(c).attempt, header(c).pass ?? null])).toEqual([
      ['W1', 2, null],
      ['V3', 1, 2],
      ['V4', 1, 2],
      ['V4', 1, 2],
      ['V4', 1, 2],
    ]);
    // W1 carries the accepted finding, so the guide lists it under Accepted failures (check-run.mjs).
    expect(header(callsOf(r, 'W1')[0]).accepted).toEqual([vf]);
    expect(callsOf(r, 'W1')[0].prompt).toContain('Accepted failures');
    // V3 and V4 learn the accepted ids and places, never the finding's text (R-5, D-142).
    for (const c of r.calls.filter((c) => ['V3', 'V4'].includes(stageOf(c)))) {
      expect(header(c).accepted).toEqual([{ gate: 'V4', id: 'f-src-2', artifact: 'guide.md', location: 'Summary' }]);
      expect(c.prompt).not.toContain(SENTINEL);
    }
    // The same finding again is covered by its id: ready, with the findings accepted.
    expect(r.out.status).toBe('ready');
    expect(r.out.accepted).toEqual([vf]);

    // A new unresolved finding isn't covered.
    const other = await design(happy({ 'V4@sources': sources('f-src-9') }), { resume: { reason: 'accepted', stage: 'V4', findings: [vf], attempts: used, retries: { W1: 2 } } });
    expect(other.out.status).not.toBe('ready');
  });

  it('refuses the resumes this unit has no path for, naming why', async () => {
    await expect(run('build-guide-design', { args: designArgs({ resume: { reason: 'later', stage: 'D1', findings: [], attempts: {} } }), respond: () => null })).rejects.toThrow(/resume\.reason/);
    await expect(run('build-guide-design', { args: designArgs({ resume: { reason: 'guided-retry', stage: 'D1', findings: [], attempts: D1_USED, retries: D1_RETRIES } }), respond: () => null })).rejects.toThrow(/guidance/);
    await expect(run('build-guide-design', { args: designArgs({ resume: { reason: 'accepted', stage: 'W1', findings: [], attempts: { W1: 3 }, retries: { W1: 2 } } }), respond: () => null })).rejects.toThrow(/no guide to accept/);
  });

  it('refuses a resume without attempts, which a null gate re-run can push past 3', async () => {
    for (const attempts of [undefined, { 'D1-gate': -1 }, { D1: '3' }]) {
      await expect(
        run('build-guide-design', { args: designArgs({ resume: { reason: 'accepted', stage: 'D1-gate', findings: [v1Finding], attempts } }), respond: () => null }),
      ).rejects.toThrow(/args\.resume\.attempts is required/);
    }
    // With a gate that reached attempt 5 (two null re-runs), the resumed gate is attempt 6.
    const r = await design(happy(), { resume: { reason: 'accepted', stage: 'D1-gate', findings: [v1Finding], attempts: { D1: 3, 'D1-gate': 5 }, retries: { D1: 2, 'D1-gate': 2 } } });
    expect(header(r.calls[0])).toEqual(expect.objectContaining({ stage: 'D1-gate', attempt: 6 }));
  });
});

describe('build-guide-design: V3 and V4 after W1 (steps 6 and 7)', () => {
  it("doesn't return ready while a report holds an unresolved finding", async () => {
    const unresolved = (call: AgentCall) => ({
      ...report(call),
      findings: [{ id: 'f1', artifact: 'guide.md', location: 'Summary', claim: 'c', issue: 'i', evidence: 'e', owner: 'W1', status: 'unresolved' }],
      verdict: 'fail',
    });
    const r = await design(happy({ V3: unresolved }));
    expect(r.out.status).not.toBe('ready');
  });

  it('returns ready when the reports hold only accepted-offline findings', async () => {
    const offline = (call: AgentCall) => ({
      ...report(call),
      findings: [{ id: 'f1', artifact: 'guide.md', location: 'guide.md [^g9]', claim: 'c', issue: 'tagged external-unavailable', evidence: 'offline run', owner: 'W1', status: 'accepted-offline' }],
    });
    // C-30: only the sources lens marks a claim tagged external-unavailable accepted-offline.
    const r = await design(happy({ 'V4@sources': offline }));
    expect(r.out.status).toBe('ready');
  });

  it('re-runs a verifier that returns nothing, keeping its lens and pass', async () => {
    const r = await design(happy({ 'V4@sources': (c, nth) => (nth < 2 ? null : report(c)), V4: report }));
    const sources = r.calls.filter((c) => header(c).lens === 'sources');
    expect(sources.map((c) => [header(c).attempt, header(c).pass])).toEqual([
      [1, 1],
      [2, 1],
      [3, 1],
    ]);
    expect(r.out.status).toBe('ready');
    expect(r.out.stats.retries).toEqual([{ stage: 'V4', concept: 'c1', count: 2 }]);
  });
});

describe('build-guide-design: its gate verdicts hold up in the run checker (FR-W6, FR-W7)', () => {
  /** The run checker on a copy of the passing fixture run, after `edit` changes the copy. */
  function checkRunCopy(edit: (dir: string) => void): { code: number | null; stderr: string } {
    const dir = path.join(TMP, `run-ok-design-${++copies}`);
    fs.cpSync(path.join(REPO_ROOT, 'tests', 'fixtures', 'pipeline', 'run-ok'), dir, { recursive: true });
    edit(dir);
    const checker = path.join(REPO_ROOT, '.claude', 'skills', 'build-guide', 'scripts', 'check-run.mjs');
    const r = spawnSync(process.execPath, [checker, dir], { env: { PATH: '/usr/bin:/bin', LANG: 'C' }, encoding: 'utf8', timeout: 30000 });
    return { code: r.status, stderr: r.stderr };
  }
  const fixtureGate = (name: string) =>
    JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'tests', 'fixtures', 'pipeline', 'run-ok', 'reports', 'gates', name), 'utf8'));

  it('writes D1 and D2 gate files, as the skill stores them unchanged, that the checker recomputes and accepts', async () => {
    const d1File = fixtureGate('D1-gate-c1-a1.json');
    const r = await design(
      happy({
        'D1-gate': () => ({ verdict: d1File.verdict, findings: d1File.findings, basis: d1File.basis, recordPath: 'compile-record.json', priceCalls: [], faultsApplied: [] }),
        'D2-gate': d2Gate(() => d2Check(), () => finalOk()),
      }),
    );
    expect(r.out.status).toBe('ready');
    const write = (dir: string, files: DesignResult['gateVerdicts']) => {
      for (const g of files) fs.writeFileSync(path.join(dir, 'reports', 'gates', `${g.stage}-${g.concept}-a${g.attempt}.json`), JSON.stringify(g, null, 2));
    };
    expect(r.out.gateVerdicts.map((g) => `${g.stage}-${g.concept}-a${g.attempt}`)).toEqual(['D1-gate-c1-a1', 'D2-gate-c1-a1']);
    expect(checkRunCopy((dir) => write(dir, r.out.gateVerdicts))).toEqual({ code: 0, stderr: '' });

    // The workflow passes the gate's verdict and basis through unchanged, so what a gate leaves out is
    // caught: a basis with no floor entry for an endgame stage fails the checker.
    const lying = r.out.gateVerdicts.map((g) => (g.stage === 'D1-gate' ? { ...g, basis: { ...(g.basis as object), floor: [] } } : g));
    expect(checkRunCopy((dir) => write(dir, lying)).stderr).toMatch(/check-run: \[gate-report\] the D1 gate's basis\.floor has no entry for endgame stage b/);
  });
});

// ---------------------------------------------------------------------------------------------------
// V3 and V4, wired into the design workflow (WU-46): AC-W12, AC-W13, AC-W14 (the fallback's step order),
// AC-W25
// ---------------------------------------------------------------------------------------------------

/** A V3 or V4 finding (§7.4), owned by the step that wrote its claim (§5.5). */
interface VFinding {
  id: string;
  artifact: string;
  location: string;
  claim: string;
  issue: string;
  evidence: string;
  owner: string;
  status: string;
}
const ARTIFACT_OF: Record<string, string> = { W1: 'guide.md', D1: 'plan.json', D2: 'plan.json', 'dossier-fix': 'dossier.md' };
const vFinding = (id: string, owner: string, over: Partial<VFinding> = {}): VFinding => ({
  id,
  artifact: ARTIFACT_OF[owner],
  location: owner === 'W1' ? 'Summary, line 12' : owner === 'dossier-fix' ? 'dossier.md [^d3]' : 'stages[2].claims[0]',
  claim: `the claim of ${id}`,
  issue: 'its source says otherwise',
  evidence: 'lookup_game_data gem "Blood Hunt"',
  owner,
  status: 'unresolved',
  ...over,
});
/** A report holding these findings, its verdict following them (§7.4). */
const reportWith = (findings: VFinding[]) => (call: AgentCall) => ({
  ...report(call),
  findings,
  verdict: findings.some((f) => f.status === 'unresolved') ? 'fail' : 'pass',
});
/** A report holding `findings` on the listed passes only, clean on every other pass. */
const onPasses = (findings: VFinding[], passes: number[] = [1]) => (call: AgentCall) =>
  passes.includes(header(call).pass as number) ? reportWith(findings)(call) : report(call);
const dossierFixOk = (call: AgentCall) => ({ file: 'dossier.md', fixed: (header(call).findings as { id?: string }[]).map((f) => f.id ?? ''), notFixed: [] });
/** The steps a run made, in call order: the final compile as `D2-gate:final`, a lens as `V4:<lens>`. */
const stepsOf = (r: { calls: AgentCall[] }) =>
  r.calls.map((c) => {
    const h = header(c);
    if (h.compile === 'final') return 'D2-gate:final';
    return h.lens !== undefined ? `V4:${String(h.lens)}` : (h.stage as string);
  });
const PASS = (n: number) => ['V3', 'V4:ledger', 'V4:sources', 'V4:prose'].map((s) => `${s}@p${n}`);
const stepsWithPass = (r: { calls: AgentCall[] }) =>
  stepsOf(r).map((s, i) => (['V3', 'V4'].includes(stageOf(r.calls[i])) ? `${s}@p${String(header(r.calls[i]).pass)}` : s));
const HAPPY_STEPS = ['D1', 'D1-gate', 'D2', 'D2-gate', 'D2-gate:final', 'W1'];
const verifierCalls = (r: { calls: AgentCall[] }) => r.calls.filter((c) => ['V3', 'V4'].includes(stageOf(c)));

describe('AC-W12: one provenance agent and three verifier lenses after W1, blind to the writers (D-142, R-5)', () => {
  it('runs V3 as build-guide-provenance and V4 ledger, sources and prose as build-guide-verifier, after W1, at most 3 in flight', async () => {
    const r = await design(happy(), {}, { delay: (c) => (['V3', 'V4'].includes(stageOf(c)) ? 1 + c.index : 1) });
    const w1 = callsOf(r, 'W1')[0];
    const verifiers = verifierCalls(r);
    expect(verifiers.map((c) => [stageOf(c), c.opts.agentType, header(c).lens ?? null])).toEqual([
      ['V3', 'build-guide-provenance', null],
      ['V4', 'build-guide-verifier', 'ledger'],
      ['V4', 'build-guide-verifier', 'sources'],
      ['V4', 'build-guide-verifier', 'prose'],
    ]);
    // Every one starts after W1 has returned; three of them overlap, never four.
    for (const c of verifiers) expect(c.startTick).toBeGreaterThan(w1.endTick!);
    expect(r.maxInFlight).toBe(3);
    const overlapping = verifiers.filter((c) => verifiers.filter((o) => o !== c && overlaps(c, o)).length >= 2);
    expect(overlapping.length).toBeGreaterThanOrEqual(3);
    expect(r.out.stats.agents.maxConcurrent).toBe(3);
  });

  it('gives V3 and V4 no text a D1, D2 or W1 step returned, nor a routed finding, on any pass', async () => {
    const SENTINEL = 'SENTINEL-written-by-a-producer';
    const QUOTED = 'SENTINEL-quoted-from-the-guide';
    const r = await design(
      happy({
        D1: () => ({ ...d1(), reason: SENTINEL }),
        'D1-gate': () => d1Gate({}, [{ ...finding('budget', 'near-ceiling'), message: SENTINEL }]),
        D2: () => ({ ...d2(), stages: [SENTINEL] }),
        'D2-gate': d2Gate(() => d2Check(), () => ({ ...finalOk(), recordPath: SENTINEL, pobFile: `${SENTINEL}.xml` })),
        W1: () => ({ ...w1(), importCode: SENTINEL, gaps: [SENTINEL] }),
        // Pass 1 finds a guide claim, quoting it; W1 re-runs with it, and pass 2 is clean.
        'V4@sources': onPasses([vFinding('v4-sources-1', 'W1', { claim: QUOTED, evidence: QUOTED })]),
      }),
    );
    expect(r.out.status).toBe('ready');
    expect(verifierCalls(r).map((c) => header(c).pass)).toEqual([1, 1, 1, 1, 2, 2, 2, 2]);
    for (const c of verifierCalls(r)) {
      expect({ call: c.index, sentinel: c.prompt.includes(SENTINEL), quoted: c.prompt.includes(QUOTED) }).toEqual({ call: c.index, sentinel: false, quoted: false });
    }
    // The routed finding did reach its owner, so the check above isn't vacuous.
    expect(callsOf(r, 'W1')[1].prompt).toContain(QUOTED);
  });

  it('holds only the §5.1 fields in each V3 and V4 header: no findings, accepted or faults on a first attempt, no writes, no compile', async () => {
    for (const mode of ['offline', 'online']) {
      const r = await design(happy({ 'V4@sources': onPasses([vFinding('v4-sources-1', 'W1')]) }), { mode });
      for (const c of verifierCalls(r)) {
        const h = header(c);
        const want = ['stage', 'attempt', 'concept', ...(h.stage === 'V4' ? ['lens'] : []), 'pass', 'mode', 'runFolder', 'runFolderRel', 'compile', 'findings', 'accepted', 'faults', 'writes', 'reference'];
        expect(Object.keys(h)).toEqual(want);
        for (const k of Object.keys(h)) expect(HEADER_FIELDS).toContain(k);
        expect(h).toEqual(
          expect.objectContaining({ attempt: 1, concept: 'c1', mode, runFolder: RUN_FOLDER, runFolderRel: RUN_FOLDER_REL, compile: 'none', findings: [], accepted: [], faults: [], writes: [] }),
        );
        expect(h.reference).toBe(`.claude/skills/build-guide/references/stages/${String(h.stage)}.md`);
        expect(fs.existsSync(path.join(REPO_ROOT, h.reference as string))).toBe(true);
      }
    }
  });

  it("tells a re-run verifier only why its pass's earlier attempt couldn't be used, never the artifacts' text", async () => {
    const QUOTED = 'SENTINEL-quoted-claim';
    // The ledger lens first re-derives too few entries, quoting a claim in its findings; its re-run hears why.
    const short = (call: AgentCall) => ({ ...reportWith([vFinding('l1', 'D1', { claim: QUOTED })])(call), coverage: { entries: 11, rederived: 9 } });
    const r = await design(happy({ 'V4@ledger': (c, nth) => (nth === 0 ? short(c) : report(c)) }));
    const ledger = r.calls.filter((c) => header(c).lens === 'ledger');
    expect(ledger.map((c) => [header(c).attempt, header(c).pass])).toEqual([
      [1, 1],
      [2, 1],
    ]);
    expect(findingsOf(ledger[1])).toEqual([
      expect.objectContaining({ attempt: 1, code: 'unusable-report', message: 'coverage.rederived is 9 of 11 ledger entries; re-derive every one (D-179)' }),
    ]);
    expect(ledger[1].prompt).not.toContain(QUOTED);
    expect(r.out.status).toBe('ready');
  });
});

describe('AC-W13: routing V3 and V4 findings to their owners (§5.5)', () => {
  it('an unresolved W1-owned finding re-runs W1 with it, then V3 and V4, as one retry of W1', async () => {
    const f = vFinding('v4-prose-1', 'W1');
    const r = await design(happy({ 'V4@prose': onPasses([f]) }));
    expect(stepsWithPass(r)).toEqual([...HAPPY_STEPS, ...PASS(1), 'W1', ...PASS(2)]);
    const rerun = callsOf(r, 'W1')[1];
    expect(header(rerun).attempt).toBe(2);
    expect(findingsOf(rerun)).toEqual([{ gate: 'V4', lens: 'prose', pass: 1, ...f }]);
    expect(rerun.prompt).toContain('A routed re-run');
    expect(r.out.status).toBe('ready');
    expect(r.out.stats.retries).toEqual([{ stage: 'W1', concept: 'c1', count: 1 }]);
    // Both passes' reports are returned, for reports/v3-c1-p1.json … v4-prose-c1-p2.json (FR-W6).
    expect(r.out.v3Reports.map((x) => x.pass)).toEqual([1, 2]);
    expect(r.out.v4Reports.map((x) => [x.lens, x.pass])).toEqual([
      ['ledger', 1],
      ['sources', 1],
      ['prose', 1],
      ['ledger', 2],
      ['sources', 2],
      ['prose', 2],
    ]);
  });

  it('a D1-owned finding re-runs D1, then the D1 gate, the D2 gate, the final compile, W1, V3 and V4', async () => {
    const f = vFinding('v4-ledger-1', 'D1', { location: 'ledger[3] (hit_b_fire)' });
    const r = await design(happy({ 'V4@ledger': onPasses([f]) }));
    expect(stepsWithPass(r)).toEqual([...HAPPY_STEPS, ...PASS(1), 'D1', 'D1-gate', 'D2-gate', 'D2-gate:final', 'W1', ...PASS(2)]);
    const [, rerun] = callsOf(r, 'D1');
    expect(findingsOf(rerun)).toEqual([{ gate: 'V4', lens: 'ledger', pass: 1, ...f }]);
    // An edit of the plan, not a new design; D2 doesn't re-run, its gate re-checks the whole plan.
    expect(rerun.prompt).toContain('Edit plan.json');
    expect(rerun.prompt).toContain('A routed re-run');
    expect(callsOf(r, 'D2')).toHaveLength(1);
    // W1 writes the guide anew from the new record; it re-runs as a regeneration, with nothing to fix.
    expect(findingsOf(callsOf(r, 'W1')[1])).toEqual([]);
    expect(callsOf(r, 'W1')[1].prompt).toContain('D1 re-ran in this round, so plan.json and compile-record.json changed: write guide.md anew from them');
    // The second final compile rewrites the same PoB file, with the same build name.
    expect(r.calls.filter((c) => header(c).compile === 'final').map((c) => [header(c).attempt, header(c).buildName])).toEqual([
      [1, BUILD_NAME],
      [2, BUILD_NAME],
    ]);
    expect(r.out.status).toBe('ready');
    // The routed re-run is D1's retry; the regenerations after it are none.
    expect(r.out.stats.retries).toEqual([{ stage: 'D1', concept: 'c1', count: 1 }]);
  });

  it('a D2-owned finding re-runs D2, the D2 gate and the final compile, W1, V3 and V4', async () => {
    const r = await design(happy({ V3: onPasses([vFinding('v3-1', 'D2')]) }));
    expect(stepsWithPass(r)).toEqual([...HAPPY_STEPS, ...PASS(1), 'D2', 'D2-gate', 'D2-gate:final', 'W1', ...PASS(2)]);
    expect(findingsOf(callsOf(r, 'D2')[1]).map((f) => { const v = f as unknown as VFinding & { gate: string }; return [v.gate, v.id]; })).toEqual([['V3', 'v3-1']]);
    expect(r.out.status).toBe('ready');
    expect(r.out.stats.retries).toEqual([{ stage: 'D2', concept: 'c1', count: 1 }]);
  });

  it('a dossier finding runs the dossier fix step, a coordinator editing dossier.md only, then V3 and V4', async () => {
    const f = vFinding('v4-sources-1', 'dossier-fix');
    const r = await design(happy({ 'V4@sources': onPasses([f]), 'dossier-fix': dossierFixOk }));
    expect(stepsWithPass(r)).toEqual([...HAPPY_STEPS, ...PASS(1), 'dossier-fix', ...PASS(2)]);
    const fix = callsOf(r, 'dossier-fix')[0];
    expect(fix.opts.agentType).toBe('build-guide-coordinator');
    expect(header(fix)).toEqual(expect.objectContaining({ attempt: 1, compile: 'none', writes: ['dossier.md'], reference: '.claude/skills/build-guide/references/stages/dossier-fix.md' }));
    expect(findingsOf(fix)).toEqual([{ gate: 'V4', lens: 'sources', pass: 1, ...f }]);
    expect(r.out.status).toBe('ready');
    expect(r.out.stats.retries).toEqual([{ stage: 'dossier-fix', concept: 'c1', count: 1 }]);
  });

  it('one round re-runs each owner once with all its findings, earliest first, and the steps they share once', async () => {
    const fDossier = vFinding('v3-1', 'dossier-fix');
    const fD2 = vFinding('v4-ledger-1', 'D2');
    const fW1a = vFinding('v4-prose-1', 'W1');
    const fW1b = vFinding('v4-prose-2', 'W1', { location: 'Rotation, line 140' });
    const r = await design(
      happy({
        V3: onPasses([fDossier]),
        'V4@ledger': onPasses([fD2]),
        'V4@prose': onPasses([fW1a, fW1b]),
        'dossier-fix': dossierFixOk,
      }),
    );
    expect(stepsWithPass(r)).toEqual([...HAPPY_STEPS, ...PASS(1), 'dossier-fix', 'D2', 'D2-gate', 'D2-gate:final', 'W1', ...PASS(2)]);
    const ids = (c: AgentCall) => (header(c).findings as { id?: string }[]).map((f) => f.id);
    expect(ids(callsOf(r, 'dossier-fix')[0])).toEqual(['v3-1']);
    expect(ids(callsOf(r, 'D2')[1])).toEqual(['v4-ledger-1']);
    expect(ids(callsOf(r, 'W1')[1])).toEqual(['v4-prose-1', 'v4-prose-2']);
    expect(r.out.status).toBe('ready');
    expect(r.out.stats.retries).toEqual([
      { stage: 'dossier-fix', concept: 'c1', count: 1 },
      { stage: 'D2', concept: 'c1', count: 1 },
      { stage: 'W1', concept: 'c1', count: 1 },
    ]);
  });

  it('a third round for the same owner returns escalated, with that pass\'s findings as evidence', async () => {
    const f = vFinding('v4-sources-1', 'W1');
    const r = await design(happy({ 'V4@sources': reportWith([f]) }));
    expect(stepsWithPass(r)).toEqual([...HAPPY_STEPS, ...PASS(1), 'W1', ...PASS(2), 'W1', ...PASS(3)]);
    expect(r.out.status).toBe('escalated');
    expect(r.out.stage).toBe('V4');
    expect(r.out.evidence).toEqual([{ gate: 'V4', lens: 'sources', pass: 3, ...f }]);
    expect(r.out.stats.retries).toEqual([{ stage: 'W1', concept: 'c1', count: 2 }]);
    // Each W1 re-run carried the findings of the pass before it.
    expect(callsOf(r, 'W1').map((c) => findingsOf(c).map((x) => (x as unknown as { pass: number }).pass))).toEqual([[], [1], [2]]);
  });

  it('a routed re-run spends its owner\'s retries: a gate failure after it re-runs the owner from what is left', async () => {
    const f = vFinding('v4-ledger-1', 'D1');
    // After the routed D1, the D1 gate fails twice: one retry is left, so the second failure escalates.
    const v1 = finding('v1', 'passive-points');
    const r = await design(happy({ 'V4@ledger': onPasses([f]), 'D1-gate': (_c, nth) => (nth === 0 ? d1Gate() : d1Gate({ v1: 'fail' }, [v1])) }));
    expect(stepsOf(r).slice(HAPPY_STEPS.length + 4)).toEqual(['D1', 'D1-gate', 'D1', 'D1-gate']);
    expect(r.out.status).toBe('escalated');
    expect(r.out.stage).toBe('D1-gate');
    expect(r.out.stats.retries).toEqual([{ stage: 'D1', concept: 'c1', count: 2 }]);
    // The D1 retry carries the routed finding, then the gate's.
    expect(findingsOf(callsOf(r, 'D1')[2]).map((x) => (x as unknown as { id?: string; code?: string }).id ?? x.code)).toEqual(['v4-ledger-1', 'passive-points']);
  });

  it('runs every routed re-run as one coordinator or writer step at a time, overlapping no other agent (FR-W3)', async () => {
    const r = await design(
      happy({ V3: onPasses([vFinding('v3-1', 'dossier-fix')]), 'V4@ledger': onPasses([vFinding('v4-ledger-1', 'D1')]), 'dossier-fix': dossierFixOk }),
      {},
      { delay: (c) => (['V3', 'V4'].includes(stageOf(c)) ? 1 + c.index : 1) },
    );
    expect(r.out.status).toBe('ready');
    for (const c of r.calls.filter((x) => !['V3', 'V4'].includes(stageOf(x)))) {
      for (const other of r.calls) if (other !== c) expect({ call: c.index, other: other.index, overlap: overlaps(c, other) }).toEqual({ call: c.index, other: other.index, overlap: false });
    }
    expect(r.maxInFlight).toBe(3);
  });

  it('reports holding only accepted-offline findings return ready, with nothing routed', async () => {
    const eu = vFinding('v4-sources-1', 'W1', { location: 'guide.md [^g9]', issue: 'tagged external-unavailable', evidence: 'offline run', status: 'accepted-offline' });
    const r = await design(happy({ 'V4@sources': reportWith([eu]) }));
    expect(stepsOf(r)).toEqual([...HAPPY_STEPS, 'V3', 'V4:ledger', 'V4:sources', 'V4:prose']);
    expect(r.out.status).toBe('ready');
    expect(r.out.stats.retries).toEqual([]);
  });

  it('V4 accepts external-unavailable only offline (C-30): online, an accepted-offline finding sends the lens back, and the claim is routed', async () => {
    const eu = vFinding('v4-sources-1', 'W1', { issue: 'tagged external-unavailable', evidence: 'run log mode', status: 'accepted-offline' });
    const sources = (call: AgentCall, nth: number) =>
      nth === 0 ? reportWith([eu])(call) : header(call).pass === 1 ? reportWith([{ ...eu, status: 'unresolved' }])(call) : report(call);
    const r = await design(happy({ 'V4@sources': sources }), { mode: 'online' });
    const lens = r.calls.filter((c) => header(c).lens === 'sources');
    expect(lens.map((c) => [header(c).pass, header(c).attempt])).toEqual([
      [1, 1],
      [1, 2],
      [2, 1],
    ]);
    expect(findingsOf(lens[1])).toEqual([expect.objectContaining({ code: 'unusable-report', message: expect.stringMatching(/accepted-offline in an online run.*\(C-30\)/) })]);
    expect(callsOf(r, 'W1')).toHaveLength(2);
    expect(r.out.status).toBe('ready');
    expect(r.out.stats.retries).toEqual([
      { stage: 'V4', concept: 'c1', count: 1 },
      { stage: 'W1', concept: 'c1', count: 1 },
    ]);
  });

  it("never routes a finding the user accepted, and counts an owner's retries from earlier workflow calls", async () => {
    const accepted = { gate: 'V4', ...vFinding('v4-prose-1', 'W1') };
    const fresh = vFinding('v4-prose-2', 'W1');
    const used = { D1: 1, 'D1-gate': 1, D2: 1, 'D2-gate': 1, W1: 3, V3: 3, V4: 3 };
    // W1 has a retry left: the new finding is routed; the accepted one is not.
    const one = await design(happy({ 'V4@prose': onPasses([accepted, fresh], [4]) }), {
      resume: { reason: 'accepted', stage: 'V4', findings: [accepted], attempts: used, retries: { W1: 1 } },
    });
    expect(stepsWithPass(one)).toEqual(['W1', ...PASS(4), 'W1', ...PASS(5)]);
    expect(findingsOf(callsOf(one, 'W1')[1]).map((x) => (x as unknown as VFinding).id)).toEqual(['v4-prose-2']);
    expect(one.out.status).toBe('ready');
    // W1 spent both its retries in earlier calls: the new finding escalates at once.
    const two = await design(happy({ 'V4@prose': onPasses([accepted, fresh], [4]) }), {
      resume: { reason: 'accepted', stage: 'V4', findings: [accepted], attempts: used, retries: { W1: 2 } },
    });
    expect(stepsWithPass(two)).toEqual(['W1', ...PASS(4)]);
    expect([two.out.status, two.out.stage]).toEqual(['escalated', 'V4']);
    expect(two.out.evidence!.map((e) => (e as unknown as VFinding).id)).toEqual(['v4-prose-2']);
  });

  it('a guided retry of an escalated V4 re-runs the owners with their findings and the guidance, outside the cap, then one pass that escalates again on a failure', async () => {
    const f = { gate: 'V4', lens: 'sources', pass: 3, ...vFinding('v4-sources-1', 'D1') };
    const used = { D1: 1, 'D1-gate': 1, D2: 1, 'D2-gate': 1, W1: 3, V3: 3, V4: 3 };
    const resume = { reason: 'guided-retry', stage: 'V4', findings: [f], guidance: 'cite the ledger entry instead', attempts: used, retries: { D1: 2 } };
    const ok = await design(happy(), { resume });
    expect(stepsWithPass(ok)).toEqual(['D1', 'D1-gate', 'D2-gate', 'D2-gate:final', 'W1', ...PASS(4)]);
    expect(findingsOf(callsOf(ok, 'D1')[0])).toEqual([f, { code: 'user-guidance', message: 'cite the ledger entry instead' }]);
    expect(callsOf(ok, 'D1')[0].prompt).toContain('A guided retry');
    expect(ok.out.status).toBe('ready');
    expect(ok.out.stats.retries).toEqual([]);
    // V3 and V4 never see the guidance (R-5): it goes to the owners.
    for (const c of verifierCalls(ok)) expect(c.prompt).not.toContain('cite the ledger entry instead');
    // A finding on the guided pass escalates again, routing nothing.
    const again = await design(happy({ 'V4@sources': reportWith([vFinding('v4-sources-1', 'D1')]) }), { resume });
    expect(stepsWithPass(again)).toEqual(['D1', 'D1-gate', 'D2-gate', 'D2-gate:final', 'W1', ...PASS(4)]);
    expect([again.out.status, again.out.stage]).toEqual(['escalated', 'V4']);
  });

  it('a guided retry of an escalated dossier fix re-runs it once with its findings and the guidance, then V3 and V4', async () => {
    const f = { gate: 'V3', pass: 2, ...vFinding('v3-4', 'dossier-fix') };
    const r = await design(happy({ 'dossier-fix': dossierFixOk }), {
      resume: { reason: 'guided-retry', stage: 'dossier-fix', findings: [f], guidance: 'drop the claim', attempts: { 'dossier-fix': 3, V3: 2, V4: 2 }, retries: { 'dossier-fix': 2 } },
    });
    expect(stepsWithPass(r)).toEqual(['dossier-fix', ...PASS(3)]);
    expect(findingsOf(callsOf(r, 'dossier-fix')[0])).toEqual([f, { code: 'user-guidance', message: 'drop the claim' }]);
    expect(header(callsOf(r, 'dossier-fix')[0]).attempt).toBe(4);
    expect(r.out.status).toBe('ready');
  });

  it('escalates when a verifier never returns a usable report, with why as evidence', async () => {
    const r = await design(happy({ 'V4@prose': () => null }));
    expect(r.calls.filter((c) => header(c).lens === 'prose').map((c) => header(c).attempt)).toEqual([1, 2, 3]);
    expect([r.out.status, r.out.stage]).toEqual(['escalated', 'V4']);
    expect(r.out.evidence!.map((e) => [e.gate, (e as { lens?: string }).lens, e.attempt, e.code])).toEqual([1, 2, 3].map((n) => ['V4', 'prose', n, 'null-result']));
  });
});

/** A revision resume (§5.3): the requests, round 1, after a design that passed on its first attempts. */
const REVISED_FROM = { D1: 1, 'D1-gate': 1, D2: 1, 'D2-gate': 1, W1: 1, V3: 1, V4: 1 };
const revisionOf = (requests: string[], over: Record<string, unknown> = {}) => ({ resume: { reason: 'revision', round: 1, requests, attempts: REVISED_FROM, ...over } });
/** A revise-map result mapping request ids to owners. */
const mapTo = (owners: Record<string, string | string[]>) => () => ({
  mapping: Object.entries(owners).flatMap(([id, o]) => (Array.isArray(o) ? o : [o]).map((owner) => ({ id, owner, why: `${id} changes ${owner}'s artifact` }))),
});

describe('AC-W25: the checkpoint-2 revision (§5.3, D-236)', () => {
  const R1 = 'explain the rotation step by step';
  const R2 = 'level with Rolling Slam until level 12';

  it('runs one revise-map coordinator step first, with the requests in its header', async () => {
    const r = await design(happy({ 'revise-map': mapTo({ r1: 'W1' }) }), revisionOf([R1]));
    const first = r.calls[0];
    expect(stageOf(first)).toBe('revise-map');
    expect(first.opts.agentType).toBe('build-guide-coordinator');
    expect(header(first)).toEqual(
      expect.objectContaining({ attempt: 1, compile: 'none', writes: [], findings: [{ id: 'r1', code: 'user-request', message: R1 }], reference: '.claude/skills/build-guide/references/stages/revise-map.md' }),
    );
    expect(fs.existsSync(path.join(REPO_ROOT, header(first).reference as string))).toBe(true);
    expect(callsOf(r, 'revise-map')).toHaveLength(1);
  });

  it('mapped to W1, re-runs W1 with that request in its findings, then V3 and V4, outside the cap', async () => {
    const r = await design(happy({ 'revise-map': mapTo({ r1: 'W1' }) }), revisionOf([R1]));
    expect(stepsWithPass(r)).toEqual(['revise-map', 'W1', ...PASS(2)]);
    const w1Call = callsOf(r, 'W1')[0];
    expect(header(w1Call).attempt).toBe(2);
    expect(findingsOf(w1Call)).toEqual([{ id: 'r1', code: 'user-request', message: R1 }]);
    expect(w1Call.prompt).toContain('A checkpoint-2 revision');
    expect(r.out.status).toBe('ready');
    expect(r.out.stats.revision).toEqual([{ request: R1, owner: 'W1' }]);
    expect(r.out.stats.retries).toEqual([]);
  });

  it('mapped to D2 and W1, re-runs D2, the D2 gate and the final compile, W1, V3 and V4, each owner with only its own requests', async () => {
    const r = await design(happy({ 'revise-map': mapTo({ r1: 'W1', r2: 'D2' }) }), revisionOf([R1, R2]));
    expect(stepsWithPass(r)).toEqual(['revise-map', 'D2', 'D2-gate', 'D2-gate:final', 'W1', ...PASS(2)]);
    expect(findingsOf(callsOf(r, 'D2')[0])).toEqual([{ id: 'r2', code: 'user-request', message: R2 }]);
    expect(findingsOf(callsOf(r, 'W1')[0])).toEqual([{ id: 'r1', code: 'user-request', message: R1 }]);
    expect(r.out.status).toBe('ready');
    expect(r.out.stats.revision).toEqual([
      { request: R1, owner: 'W1' },
      { request: R2, owner: 'D2' },
    ]);
  });

  it('a D2 gate failure after the revision still gets 2 retries before escalated, its retries keyed by the revision round', async () => {
    const v1 = finding('v1', 'tree-continuity', '2');
    const r = await design(happy({ 'revise-map': mapTo({ r1: 'D2' }), 'D2-gate': d2Gate(() => d2Check({ v1: 'fail' }, [v1])) }), revisionOf([R2]));
    expect(stepsOf(r)).toEqual(['revise-map', 'D2', 'D2-gate', 'D2', 'D2-gate', 'D2', 'D2-gate']);
    expect(attemptsOf(r, 'D2')).toEqual([2, 3, 4]);
    expect([r.out.status, r.out.stage]).toEqual(['escalated', 'D2-gate']);
    // The revision's run is no retry; the two after it are, apart from the first design's (D-236).
    expect(r.out.stats.retries).toEqual([{ stage: 'D2', concept: 'c1', round: 1, count: 2 }]);
    expect(findingsOf(callsOf(r, 'D2')[2]).map((x) => (x as unknown as { id?: string; code?: string }).id ?? x.code)).toEqual(['r1', 'tree-continuity', 'tree-continuity']);
  });

  it('mapped to D1, re-runs D1, the D1 gate, the D2 gate and the final compile, W1, V3 and V4; mapped to the dossier, the dossier fix', async () => {
    const d = await design(happy({ 'revise-map': mapTo({ r1: 'D1' }) }), revisionOf([R2]));
    expect(stepsWithPass(d)).toEqual(['revise-map', 'D1', 'D1-gate', 'D2-gate', 'D2-gate:final', 'W1', ...PASS(2)]);
    expect(d.out.status).toBe('ready');
    const x = await design(happy({ 'revise-map': mapTo({ r1: ['dossier-fix', 'W1'] }), 'dossier-fix': dossierFixOk }), revisionOf([R1]));
    expect(stepsWithPass(x)).toEqual(['revise-map', 'dossier-fix', 'W1', ...PASS(2)]);
    expect(x.out.stats.revision).toEqual([
      { request: R1, owner: 'dossier-fix' },
      { request: R1, owner: 'W1' },
    ]);
  });

  it('routes V3 and V4 findings after a revision as usual, under the revision round', async () => {
    const r = await design(happy({ 'revise-map': mapTo({ r1: 'W1' }), 'V4@prose': onPasses([vFinding('v4-prose-1', 'W1')], [2]) }), revisionOf([R1]));
    expect(stepsWithPass(r)).toEqual(['revise-map', 'W1', ...PASS(2), 'W1', ...PASS(3)]);
    expect(r.out.status).toBe('ready');
    expect(r.out.stats.retries).toEqual([{ stage: 'W1', concept: 'c1', round: 1, count: 1 }]);
  });

  it('re-runs a revise-map whose mapping leaves a request out or names another owner, and escalates after 2 retries', async () => {
    const bad = () => ({ mapping: [{ id: 'r1', owner: 'W1', why: 'w' }, { id: 'r9', owner: 'D2', why: 'w' }] });
    const r = await design(happy({ 'revise-map': (_c, nth) => (nth === 0 ? bad() : mapTo({ r1: 'W1', r2: 'D2' })()) }), revisionOf([R1, R2]));
    expect(attemptsOf(r, 'revise-map')).toEqual([1, 2]);
    expect(findingsOf(callsOf(r, 'revise-map')[1]).filter((f) => f.code === 'unusable-mapping').map((f) => f.message)).toEqual([
      'mapping[1] names no request id (r1, r2)',
      'request r2 has no owner',
    ]);
    expect(r.out.status).toBe('ready');
    expect(r.out.stats.retries).toEqual([{ stage: 'revise-map', concept: 'c1', round: 1, count: 1 }]);

    const dead = await design(happy({ 'revise-map': () => null }), revisionOf([R1]));
    expect([attemptsOf(dead, 'revise-map'), dead.out.status, dead.out.stage]).toEqual([[1, 2, 3], 'escalated', 'revise-map']);
    // A guided retry maps once more, with the guidance, then the revision goes on.
    const guided = await design(happy({ 'revise-map': mapTo({ r1: 'W1' }) }), {
      resume: { reason: 'guided-retry', stage: 'revise-map', round: 1, requests: [R1], findings: dead.out.evidence, guidance: 'it is about the guide', attempts: { ...REVISED_FROM, 'revise-map': 3 }, retries: { 'revise-map': 2 } },
    });
    expect(stepsWithPass(guided)).toEqual(['revise-map', 'W1', ...PASS(2)]);
    expect(findingsOf(callsOf(guided, 'revise-map')[0]).at(-1)).toEqual({ code: 'user-guidance', message: 'it is about the guide' });
    expect(guided.out.status).toBe('ready');
  });

  it('refuses a revision without its round or its requests, and accepting an escalated revise-map', async () => {
    const respond = () => null;
    await expect(run('build-guide-design', { args: designArgs(revisionOf([R1], { round: undefined })), respond })).rejects.toThrow(/args\.resume\.round is the revision round/);
    await expect(run('build-guide-design', { args: designArgs(revisionOf([])), respond })).rejects.toThrow(/args\.resume\.requests is the user's checkpoint-2 requests/);
    await expect(run('build-guide-design', { args: designArgs(revisionOf([R1], { attempts: undefined })), respond })).rejects.toThrow(/args\.resume\.attempts is required/);
    await expect(
      run('build-guide-design', { args: designArgs({ resume: { reason: 'accepted', stage: 'revise-map', round: 1, requests: [R1], findings: [], attempts: {}, retries: {} } }), respond }),
    ).rejects.toThrow(/nothing to accept/);
    await expect(run('build-guide-design', { args: designArgs({ resume: { reason: 'guided-retry', stage: 'V4', findings: [], guidance: 'g', attempts: {} } }), respond })).rejects.toThrow(
      /args\.resume\.retries is required/,
    );
  });
});

describe('build-guide-design: a report the workflow takes is one the run checker takes (§7.4, FR-W7)', () => {
  const CHECKER = path.join(REPO_ROOT, '.claude', 'skills', 'build-guide', 'scripts', 'check-run.mjs');
  /** The run checker on a copy of a passing fixture run, one report of which is replaced. */
  function checkWith(fixture: string, file: string, body: unknown): { code: number | null; stderr: string } {
    const dir = path.join(TMP, `${fixture}-report-${++copies}`);
    fs.cpSync(path.join(REPO_ROOT, 'tests', 'fixtures', 'pipeline', fixture), dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'reports', file), JSON.stringify(body, null, 2));
    const r = spawnSync(process.execPath, [CHECKER, dir], { env: { PATH: '/usr/bin:/bin', LANG: 'C' }, encoding: 'utf8', timeout: 30000 });
    return { code: r.status, stderr: r.stderr };
  }
  const fixtureReport = (fixture: string, file: string) => JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'tests', 'fixtures', 'pipeline', fixture, 'reports', file), 'utf8'));
  const fileOf = (lens: string | undefined) => (lens ? `v4-${lens}-c1-p1.json` : 'v3-c1-p1.json');

  it("passes the fixture runs' own reports through, and the checker accepts them", async () => {
    for (const [fixture, mode] of [
      ['run-ok', 'offline'],
      ['run-ok-online', 'online'],
    ]) {
      const r = await design(happy({ V3: () => fixtureReport(fixture, fileOf(undefined)), V4: (c) => fixtureReport(fixture, fileOf(header(c).lens as string)) }), { mode });
      expect({ fixture, status: r.out.status, attempts: r.out.stats.attempts.filter((a) => ['V3', 'V4'].includes(a.stage)).map((a) => a.outcome) }).toEqual({
        fixture,
        status: 'ready',
        attempts: ['pass', 'pass', 'pass', 'pass'],
      });
      for (const rep of [...r.out.v3Reports, ...r.out.v4Reports] as { lens?: string }[]) expect(checkWith(fixture, fileOf(rep.lens), rep)).toEqual({ code: 0, stderr: '' });
    }
  });

  it.each([
    ['run-ok', undefined, 'says pass beside an unresolved finding', (x: Record<string, unknown>) => ({ ...x, findings: [vFinding('v3-1', 'W1')], verdict: 'pass' }), /verdict/],
    ['run-ok', 'sources', 'has a finding without its owner', (x: Record<string, unknown>) => {
      const { owner: _owner, ...f } = vFinding('v4-sources-1', 'W1', { status: 'accepted-offline' });
      return { ...x, findings: [f] };
    }, /owner/],
    ['run-ok-online', 'sources', 'accepts external-unavailable in an online run', (x: Record<string, unknown>) => ({ ...x, findings: [vFinding('v4-sources-1', 'W1', { status: 'accepted-offline' })] }), /accepted-offline/],
    ['run-ok', 'sources', 're-checks fewer than 1 in 5 pob-data claims elsewhere', (x: Record<string, unknown>) => ({ ...x, coverage: { ...(x.coverage as object), recheckedOther: 1 } }), /1 in 5/],
    ['run-ok', 'sources', 're-checks fewer endgame pob-data claims than there are', (x: Record<string, unknown>) => ({ ...x, coverage: { ...(x.coverage as object), recheckedEndgame: 2 } }), /endgame pob-data/],
    ['run-ok', 'ledger', 're-derives fewer ledger entries than there are', (x: Record<string, unknown>) => ({ ...x, coverage: { entries: 11, rederived: 10 } }), /re-derive/],
  ])('%s: a %s report that %s is refused by both', async (fixture, lens, _what, broken, why) => {
    const mode = fixture === 'run-ok' ? 'offline' : 'online';
    const bad = broken(fixtureReport(fixture, fileOf(lens)));
    const job = lens ?? 'V3';
    const r = await design(
      happy({ V3: (c, nth) => (lens === undefined && nth === 0 ? bad : fixtureReport(fixture, fileOf(undefined))), V4: (c) => fixtureReport(fixture, fileOf(header(c).lens as string)), ...(lens ? { [`V4@${lens}`]: (_c: AgentCall, nth: number) => (nth === 0 ? bad : fixtureReport(fixture, fileOf(lens))) } : {}) }),
      { mode },
    );
    const calls = r.calls.filter((c) => (lens ? header(c).lens === lens : stageOf(c) === 'V3'));
    expect({ job, attempts: calls.map((c) => [header(c).pass, header(c).attempt]) }).toEqual({ job, attempts: [[1, 1], [1, 2]] });
    expect(findingsOf(calls[1])).toEqual(expect.arrayContaining([expect.objectContaining({ code: 'unusable-report', message: expect.stringMatching(why) })]));
    expect(r.out.status).toBe('ready');
    const checked = checkWith(fixture, fileOf(lens), bad);
    expect(checked.code).not.toBe(0);
    expect(checked.stderr).toMatch(/check-run: \[(report-shape|claim-counts)\]/);
  });
});

describe('AC-W14: references/fallback.md lists the steps the workflows run, in order, with their agent types', () => {
  const FALLBACK = fs.readFileSync(path.join(REPO_ROOT, '.claude', 'skills', 'build-guide', 'references', 'fallback.md'), 'utf8');
  /** The `(stage, agent type)` rows of the first table after `marker` in fallback.md. */
  function tableAfter(marker: string): [string, string][] {
    const at = FALLBACK.indexOf(marker);
    expect(at).toBeGreaterThanOrEqual(0);
    const lines = FALLBACK.slice(at).split('\n');
    const start = lines.findIndex((l) => l.startsWith('|'));
    const rows: [string, string][] = [];
    for (const line of lines.slice(start + 2)) {
      if (!line.startsWith('|')) break;
      const cells = line.split('|').slice(1, -1).map((c) => c.trim());
      const stageCell = /^\d+$/.test(cells[0]) ? cells[1] : cells[0];
      const typeCell = /^\d+$/.test(cells[0]) ? cells[2] : cells[1];
      rows.push([/`([^`]+)`/.exec(stageCell)![1], /`([^`]+)`/.exec(typeCell)![1]]);
    }
    return rows;
  }
  /** The harness's record of a run as (stage, agent type), each run of equal neighbours folded into one step. */
  const stepTypes = (r: { calls: AgentCall[] }): [string, string][] => {
    const out: [string, string][] = [];
    for (const c of r.calls) {
      const step: [string, string] = [stageOf(c), c.opts.agentType as string];
      const last = out[out.length - 1];
      if (!last || last[0] !== step[0] || last[1] !== step[1]) out.push(step);
    }
    return out;
  };

  it('the research table is the research workflow\'s happy path (AC-W6)', async () => {
    const r = await research({ R1a: r1a(THREE), R1b: r1bPass, 'R1b-assemble': [assembleOk()] });
    expect(r.out.status).toBe('ok');
    expect(tableAfter('The research workflow `build-guide-research`')).toEqual(stepTypes(r));
  });

  it("the design table is the design workflow's happy path (AC-W8)", async () => {
    const r = await design(happy());
    expect(r.out.status).toBe('ready');
    expect(tableAfter('The design-and-write workflow `build-guide-design`')).toEqual(stepTypes(r));
  });

  it('the steps off the happy path run as the types the table gives them', async () => {
    const off = Object.fromEntries(tableAfter('Steps off the happy path'));
    expect(Object.keys(off).sort()).toEqual(['dossier-fix', 'revise-map']);
    const fixed = await design(happy({ 'V4@sources': onPasses([vFinding('v4-sources-1', 'dossier-fix')]), 'dossier-fix': dossierFixOk }));
    const revised = await design(happy({ 'revise-map': mapTo({ r1: 'W1' }) }), revisionOf(['shorter']));
    for (const c of [...callsOf(fixed, 'dossier-fix'), ...callsOf(revised, 'revise-map')]) expect(c.opts.agentType).toBe(off[stageOf(c)]);
  });
});

describe('WU-46 review fixes: finding equality, the regenerated guide, accepted-offline, revision text', () => {
  const used = { D1: 1, 'D1-gate': 1, D2: 1, 'D2-gate': 1, W1: 1, V3: 1, V4: 1 };

  it("§5.4: an accepted V3/V4 finding doesn't excuse another issue a verifier reports under its id (the reviewer's probe)", async () => {
    const accepted = { gate: 'V4', ...vFinding('v4-ledger-1', 'D1', { location: 'ledger[3] (hit_b_fire)' }) };
    const reused = vFinding('v4-ledger-1', 'W1', { location: 'Summary, line 4', claim: 'the guide says 5,000 DPS', issue: 'differs from the record' });
    const r = await design(happy({ 'V4@ledger': onPasses([reused], [2]) }), {
      accepted: [accepted],
      resume: { reason: 'accepted', stage: 'V4', findings: [], attempts: used, retries: {} },
    });
    // Not excused: it is routed to its owner, then the next pass is clean.
    expect(stepsWithPass(r)).toEqual(['W1', ...PASS(2), 'W1', ...PASS(3)]);
    expect(findingsOf(callsOf(r, 'W1')[1]).map((f) => (f as unknown as VFinding).location)).toEqual(['Summary, line 4']);
    expect(r.out.status).toBe('ready');
    // The accepted finding itself, at its place, stays covered; a guide line moved by the regeneration too.
    const same = await design(happy({ 'V4@ledger': onPasses([{ ...accepted }], [2]) }), {
      accepted: [accepted],
      resume: { reason: 'accepted', stage: 'V4', findings: [], attempts: used, retries: {} },
    });
    expect(stepsWithPass(same)).toEqual(['W1', ...PASS(2)]);
    const g = { gate: 'V4', ...vFinding('v4-prose-1', 'W1', { location: 'Rotation, line 140' }) };
    const moved = await design(happy({ 'V4@prose': onPasses([{ ...g, location: 'Rotation, line 152' }], [2]) }), {
      accepted: [g],
      resume: { reason: 'accepted', stage: 'V4', findings: [], attempts: used, retries: {} },
    });
    expect([moved.out.status, callsOf(moved, 'W1').length]).toEqual(['ready', 1]);
  });

  it('a W1 that owns findings in a round where D2 re-ran writes the guide anew first (revision r1 to W1, r2 to D2)', async () => {
    const r = await design(happy({ 'revise-map': mapTo({ r1: 'W1', r2: 'D2' }) }), revisionOf(['explain rotation', 'level with Rolling Slam to 12']));
    expect(stepsWithPass(r)).toEqual(['revise-map', 'D2', 'D2-gate', 'D2-gate:final', 'W1', ...PASS(2)]);
    const prompt = callsOf(r, 'W1')[0].prompt;
    expect(prompt).toContain('D2 re-ran in this round, so plan.json and compile-record.json changed: write guide.md anew from them');
    expect(prompt).toContain('then make the changes the header\'s findings ask for');
    expect(prompt).toContain('A checkpoint-2 revision');
    // D2 itself re-ran with nothing upstream of it in that round.
    expect(callsOf(r, 'D2')[0].prompt).not.toContain('re-ran in this round');
  });

  it('a routed W1 or D2 after D1 in the same round starts from the changed plan; a guided round too', async () => {
    const r = await design(happy({ 'V4@ledger': onPasses([vFinding('v4-ledger-1', 'D1'), vFinding('v4-ledger-2', 'D2'), vFinding('v4-ledger-3', 'W1')]) }));
    expect(stepsWithPass(r)).toEqual([...HAPPY_STEPS, ...PASS(1), 'D1', 'D1-gate', 'D2', 'D2-gate', 'D2-gate:final', 'W1', ...PASS(2)]);
    expect(callsOf(r, 'D2')[1].prompt).toContain('D1 re-ran in this round, so the endgame stages changed: re-plan the campaign stages backward from them');
    expect(callsOf(r, 'D2')[1].prompt).toContain('A routed re-run');
    const w1Prompt = callsOf(r, 'W1')[1].prompt;
    expect(w1Prompt).toContain('D1 and D2 re-ran in this round');
    expect(w1Prompt).toContain('A routed re-run');
    const f = { gate: 'V4', lens: 'ledger', pass: 3, ...vFinding('v4-ledger-1', 'D1') };
    const w = { gate: 'V4', lens: 'prose', pass: 3, ...vFinding('v4-prose-1', 'W1') };
    const guided = await design(happy(), {
      resume: { reason: 'guided-retry', stage: 'V4', findings: [f, w], guidance: 'keep it short', attempts: { ...used, V3: 3, V4: 3 }, retries: { D1: 2, W1: 2 } },
    });
    const gw = callsOf(guided, 'W1')[0];
    expect(gw.prompt).toContain('D1 re-ran in this round');
    expect(gw.prompt).toContain('A guided retry');
    expect(guided.out.status).toBe('ready');
  });

  it.each([
    ['V3', undefined],
    ['V4', 'ledger'],
    ['V4', 'prose'],
  ])('C-30: a %s %s report marking a finding accepted-offline is refused and re-run', async (stage, lens) => {
    const eu = vFinding('x-1', 'W1', { location: 'guide.md [^g9]', issue: 'tagged external-unavailable', status: 'accepted-offline' });
    const key = lens ? `V4@${lens}` : 'V3';
    const r = await design(happy({ [key]: (c: AgentCall, nth: number) => (nth === 0 ? reportWith([eu])(c) : report(c)) }));
    const calls = r.calls.filter((c) => stageOf(c) === stage && header(c).lens === lens);
    expect(calls.map((c) => header(c).attempt)).toEqual([1, 2]);
    expect(findingsOf(calls[1])).toEqual([expect.objectContaining({ code: 'unusable-report', message: expect.stringMatching(/only the sources lens marks a finding accepted-offline \(C-30\)/) })]);
    expect(r.out.status).toBe('ready');
  });

  it('C-30: the sources lens may mark accepted-offline only a claim tagged external-unavailable, at the claim', async () => {
    for (const over of [{ issue: 'its source says otherwise', location: 'guide.md [^g9]' }, { issue: 'tagged external-unavailable', location: 'Summary, line 3' }]) {
      const bad = vFinding('v4-sources-1', 'W1', { ...over, status: 'accepted-offline' });
      const r = await design(happy({ 'V4@sources': (c, nth) => (nth === 0 ? reportWith([bad])(c) : report(c)) }));
      const calls = r.calls.filter((c) => header(c).lens === 'sources');
      expect(calls.map((c) => header(c).attempt)).toEqual([1, 2]);
      expect(findingsOf(calls[1])).toEqual([expect.objectContaining({ code: 'unusable-report', message: expect.stringMatching(/only a claim tagged external-unavailable is \(C-30\)/) })]);
    }
  });

  it("never puts the user's revision requests in a V3 or V4 prompt (R-5)", async () => {
    const REQUEST = 'SENTINEL-the-users-request-text';
    for (const owner of ['W1', 'D1', 'D2', 'dossier-fix']) {
      const r = await design(
        happy({ 'revise-map': mapTo({ r1: owner }), 'dossier-fix': dossierFixOk, 'V4@prose': onPasses([vFinding('v4-prose-1', 'W1')], [2]) }),
        revisionOf([REQUEST]),
      );
      expect(r.out.status).toBe('ready');
      expect(verifierCalls(r).length).toBe(8);
      for (const c of verifierCalls(r)) expect({ owner, call: c.index, leaked: c.prompt.includes(REQUEST) }).toEqual({ owner, call: c.index, leaked: false });
      // The request did reach its owner.
      expect(r.calls.find((c) => stageOf(c) === owner)!.prompt).toContain(REQUEST);
    }
  });

  it('an escalated revise-map still returns the revision, its requests unmapped, for revisions[]', async () => {
    const r = await design(happy({ 'revise-map': () => null }), revisionOf(['explain rotation', 'shorter']));
    expect([r.out.status, r.out.stage]).toEqual(['escalated', 'revise-map']);
    expect(r.out.stats.revision).toEqual([
      { request: 'explain rotation', owner: null },
      { request: 'shorter', owner: null },
    ]);
  });
});
