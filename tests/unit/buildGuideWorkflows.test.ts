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
