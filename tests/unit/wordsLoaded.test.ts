/**
 * Amendment 15 (M-28, WU-148; D-505): the words each step loads, `scripts/words-loaded.mjs`, spawned as a real process.
 *
 * AC-W126: the script resolves every name, compares each stage's file list and count with the committed baseline,
 * `scripts/words-loaded.baseline.json`, and reports each stage at most 5% above it; fed a stage with an unresolvable
 * name and one over the bound, it fails on both.
 *
 * - D-505's stages: one per stage reference under `skills/build-guide/references/stages/`, not its README.md, Q counted
 *   as `Q:researcher` and `Q:coordinator`. A stage's words are those of the agent definition that runs it, its stage
 *   reference and each file under `skills/` or `agents/` the two name, resolved by §5's path rules.
 * - Appendix A's output: `<stage> <words> <baseline> <+n.n%>` per stage, a stage whose file list differs from its
 *   baseline's followed by the difference (printed, not failed), then `max <+n.n%>`; exit code 1 when a stage is more
 *   than 5% above its baseline or a name doesn't resolve.
 * - The baseline is the same count at `a8d735c`, its file lists written in the new root-relative paths.
 *
 * The failing cases run on copies of `skills/` and `agents/` in a temp folder, their text changed there, or on a small
 * tree written there; no tracked file is changed.
 */
import { describe, it, expect, afterAll } from '@jest/globals';
import { spawnSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';

const REPO = path.resolve(__dirname, '..', '..');
const SCRIPT = path.join(REPO, 'scripts', 'words-loaded.mjs');
const BASELINE_FILE = path.join(REPO, 'scripts', 'words-loaded.baseline.json');
const STAGES = path.join(REPO, 'skills', 'build-guide', 'references', 'stages');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'pob2-words-loaded-'));
afterAll(() => fs.rmSync(TMP, { recursive: true, force: true }));

interface Entry {
  words: number;
  files: string[];
}
type Measure = Record<string, Entry>;
const BASELINE = JSON.parse(fs.readFileSync(BASELINE_FILE, 'utf8')) as Measure;

interface Result {
  code: number | null;
  stdout: string;
  stderr: string;
}
/** The script under the Node running the test, from a temp folder, with an explicit env (git for `--at`). */
function run(args: string[]): Result {
  const r = spawnSync(process.execPath, [SCRIPT, ...args], { cwd: TMP, env: { PATH: '/usr/bin:/bin', HOME: TMP, LANG: 'C' }, encoding: 'utf8', timeout: 60000 });
  if (r.error) throw r.error;
  return { code: r.status, stdout: r.stdout, stderr: r.stderr };
}

/** Appendix A's lines. */
const STAGE_LINE = /^(\S+) (\d+) (\d+) ([+-]\d+\.\d%)$/;
const FILES_LINE = /^ {2}files: ([+-]\S+(?: [+-]\S+)*)$/;
const MAX_LINE = /^max ([+-]\d+\.\d%)$/;
interface Line {
  stage: string;
  words: number;
  baseline: number;
  percent: string;
}
interface Report {
  stages: Line[];
  files: Record<string, string[]>;
  max: string;
}
/** A report read line by line; any line outside Appendix A's format fails. */
function parse(stdout: string): Report {
  const lines = stdout.split('\n');
  expect(lines.pop()).toBe('');
  const report: Report = { stages: [], files: {}, max: '' };
  lines.forEach((line, i) => {
    const stage = STAGE_LINE.exec(line);
    const files = FILES_LINE.exec(line);
    const max = MAX_LINE.exec(line);
    if (stage) report.stages.push({ stage: stage[1], words: Number(stage[2]), baseline: Number(stage[3]), percent: stage[4] });
    else if (files && report.stages.length) report.files[report.stages[report.stages.length - 1].stage] = files[1].split(' ');
    else if (max && i === lines.length - 1) report.max = max[1];
    else throw new Error(`line ${i + 1} is outside Appendix A's format: ${JSON.stringify(line)}`);
  });
  expect(report.max).not.toBe('');
  return report;
}
/** A printed `+n.n%` is the growth over the baseline, to one decimal. */
function expectGrowth(printed: string, words: number, baseline: number): void {
  const exact = ((words - baseline) / baseline) * 100;
  expect({ printed, close: Math.abs(Number(printed.replace('%', '')) - exact) <= 0.05 + 1e-9 }).toEqual({ printed, close: true });
}
const wordsOf = (text: string) => text.split(/\s+/).filter(Boolean).length;

/** The stages D-505 names: one per stage reference, not its README.md, Q once per agent type that runs it. */
const EXPECTED_STAGES = fs
  .readdirSync(STAGES)
  .filter((f) => f.endsWith('.md') && f !== 'README.md')
  .map((f) => f.replace(/\.md$/, ''))
  .flatMap((s) => (s === 'Q' ? ['Q:coordinator', 'Q:researcher'] : [s]))
  .sort();
/** The agent type that runs each stage, as `skills/build-guide/SKILL.md`'s step table routes it. */
const AGENT: Record<string, string> = { R1a: 'researcher', V4: 'verifier', W1: 'writer', 'Q:researcher': 'researcher', 'Q:coordinator': 'coordinator' };
const agentOf = (stage: string) => `agents/build-guide-${AGENT[stage] ?? 'coordinator'}.md`;
const referenceOf = (stage: string) => `skills/build-guide/references/stages/${stage.split(':')[0]}.md`;

/** A copy of the plugin's skills and agents in a temp folder, for a case that changes their text. */
function copyTree(name: string): string {
  const root = path.join(TMP, name);
  for (const dir of ['skills', 'agents']) fs.cpSync(path.join(REPO, dir), path.join(root, dir), { recursive: true });
  return root;
}
function edit(root: string, file: string, change: (text: string) => string): void {
  const p = path.join(root, file);
  const before = fs.readFileSync(p, 'utf8');
  const after = change(before);
  expect(after).not.toBe(before);
  fs.writeFileSync(p, after);
}
function write(root: string, file: string, text: string): void {
  fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
  fs.writeFileSync(path.join(root, file), text);
}

const REPO_RUN = run([]);
const REPO_MEASURE = run(['--json']);

describe('AC-W126 (WU-148, D-505): words loaded per stage, on the repository against the committed baseline', () => {
  it("prints one line per stage D-505 names (Q as Q:researcher and Q:coordinator), then max, in Appendix A's format, and exits 0 within the bound", () => {
    expect({ code: REPO_RUN.code, stderr: REPO_RUN.stderr }).toEqual({ code: 0, stderr: '' });
    const report = parse(REPO_RUN.stdout);
    expect(report.stages.map((s) => s.stage)).toEqual(EXPECTED_STAGES);
    expect(EXPECTED_STAGES).toEqual(expect.arrayContaining(['Q:researcher', 'Q:coordinator', 'R1a', 'R1a-synthesize', 'R1b', 'D1-build', 'D1-tree', 'D1-finish', 'D1-gate', 'F1', 'D2', 'D2-gate', 'W1', 'V4']));
    expect(EXPECTED_STAGES.filter((s) => s === 'Q' || s === 'README')).toEqual([]);
    for (const s of report.stages) {
      expect({ stage: s.stage, baseline: s.baseline }).toEqual({ stage: s.stage, baseline: BASELINE[s.stage].words });
      expectGrowth(s.percent, s.words, s.baseline);
      expect({ stage: s.stage, within: s.words * 100 <= s.baseline * 105 }).toEqual({ stage: s.stage, within: true });
    }
    const largest = Math.max(...report.stages.map((s) => (s.words - s.baseline) / s.baseline));
    expectGrowth(report.max, 1 + largest, 1);
  });

  it('counts, for each stage, the words of its agent definition, its stage reference and each file under skills/ or agents/ the two name', () => {
    expect({ code: REPO_MEASURE.code, stderr: REPO_MEASURE.stderr }).toEqual({ code: 0, stderr: '' });
    const measure = JSON.parse(REPO_MEASURE.stdout) as Measure;
    expect(Object.keys(measure)).toEqual(EXPECTED_STAGES);
    /** The plugin files a text names: root-relative, after an optional prefix, but in a command line's span (§5). */
    const named = (text: string) =>
      [...text.replace(/`(?:node\s[^`]*|[^`\s]+\.(?:mjs|sh)\s[^`]*)`/g, '').matchAll(/(?<![\w./-])(?:\$\{CLAUDE_PLUGIN_ROOT\}\/|<root>\/)?((?:skills|agents)\/[\w./-]*[\w-])/g)]
        .map((m) => m[1])
        .filter((p) => fs.statSync(path.join(REPO, p), { throwIfNoEntry: false })?.isFile());
    const read = (p: string) => fs.readFileSync(path.join(REPO, p), 'utf8');
    for (const stage of EXPECTED_STAGES) {
      const def = agentOf(stage);
      const ref = referenceOf(stage);
      const files = [...new Set([def, ref, ...named(read(def)), ...named(read(ref))])].sort();
      expect({ stage, files: measure[stage].files }).toEqual({ stage, files });
      expect({ stage, words: measure[stage].words }).toEqual({ stage, words: files.reduce((n, f) => n + wordsOf(read(f)), 0) });
    }
    // Two agent types run Q, so its two counts differ by their definitions and what each names.
    expect(measure['Q:researcher'].files).toContain('agents/build-guide-researcher.md');
    expect(measure['Q:coordinator'].files).toContain('agents/build-guide-coordinator.md');
    expect(measure['Q:researcher'].files).not.toContain('agents/build-guide-coordinator.md');
  });

  it('the committed baseline is the same count at a8d735c, one entry per stage, its file lists in the new root-relative paths', () => {
    const r = run(['--at', 'a8d735c', '--json']);
    expect({ code: r.code, stderr: r.stderr }).toEqual({ code: 0, stderr: '' });
    expect(JSON.parse(r.stdout)).toEqual(BASELINE);
    expect(Object.keys(BASELINE)).toEqual(EXPECTED_STAGES);
    for (const [stage, entry] of Object.entries(BASELINE)) {
      expect({ stage, root: entry.files.every((f) => /^(?:skills|agents)\/[\w./-]+$/.test(f)), sorted: [...entry.files].sort() }).toEqual({ stage, root: true, sorted: entry.files });
      expect(entry.files).toEqual(expect.arrayContaining([agentOf(stage), referenceOf(stage)]));
    }
    // Game knowledge's moved files appear at their new paths (the spine's old-to-new path line).
    expect(BASELINE.R1a.files).toEqual(expect.arrayContaining(['skills/game-knowledge/references/patterns.md', 'skills/game-knowledge/references/lookups.md', 'skills/game-knowledge/references/source-markers.md']));
  });
});

describe('AC-W126 (WU-148, D-505): the bound and the names, on temp copies of the plugin text', () => {
  it('a copy of the plugin text reports as the repository does', () => {
    const r = run(['--root', copyTree('same')]);
    expect(r).toEqual(REPO_RUN);
  });

  it('exits 0 with a stage at exactly 5% above its baseline, and 1 with one word more', () => {
    const measure = JSON.parse(REPO_MEASURE.stdout) as Measure;
    const base = BASELINE.W1.words;
    const atBound = Math.floor((base * 105) / 100);
    const add = atBound - measure.W1.words;
    expect(add).toBeGreaterThan(0);
    const root = copyTree('bound');
    const W1 = 'skills/build-guide/references/stages/W1.md';
    const others = (report: Report) => report.stages.filter((s) => s.stage !== 'W1');

    edit(root, W1, (text) => `${text}\n${Array(add).fill('word').join(' ')}\n`);
    const at = run(['--root', root]);
    expect({ code: at.code, stderr: at.stderr }).toEqual({ code: 0, stderr: '' });
    const atReport = parse(at.stdout);
    const w1 = atReport.stages.find((s) => s.stage === 'W1')!;
    expect({ words: w1.words, baseline: w1.baseline }).toEqual({ words: atBound, baseline: base });
    expectGrowth(w1.percent, atBound, base);
    expect(others(atReport)).toEqual(others(parse(REPO_RUN.stdout)));

    edit(root, W1, (text) => `${text}word\n`);
    const over = run(['--root', root]);
    expect(over.code).toBe(1);
    const overReport = parse(over.stdout);
    expect(overReport.stages.find((s) => s.stage === 'W1')!.words).toBe(atBound + 1);
    expect(others(overReport)).toEqual(others(parse(REPO_RUN.stdout)));
    expect(over.stderr).toMatch(/^\[words-loaded\] W1: \+\d+\.\d% over its baseline .*above the 5% bound$/m);
  });

  it('a stage reference far over its baseline fails, and so does every stage that names it', () => {
    const root = copyTree('inflated');
    edit(root, 'skills/build-guide/references/stages/D2-gate.md', (text) => `${text}\n${'inflated '.repeat(Math.ceil(BASELINE['D2-gate'].words * 0.06))}\n`);
    const r = run(['--root', root]);
    expect(r.code).toBe(1);
    const failed = [...r.stderr.matchAll(/^\[words-loaded\] (\S+): \+\S+ over its baseline/gm)].map((m) => m[1]);
    // The coordinator's definition names every coordinator stage's reference, so each of those stages loads it.
    const naming = EXPECTED_STAGES.filter((s) => (JSON.parse(REPO_MEASURE.stdout) as Measure)[s].files.includes('skills/build-guide/references/stages/D2-gate.md'));
    expect(failed).toEqual(expect.arrayContaining(['D2-gate']));
    expect(failed.every((s) => naming.includes(s))).toBe(true);
  });

  it("fails with exit 1 on a name that doesn't resolve, in each form that points into skills/ or agents/", () => {
    const cases: { file: string; change: (text: string) => string; message: string }[] = [
      {
        file: 'skills/build-guide/references/stages/R1b.md',
        change: (t) => `${t}\nSee \`skills/build-guide/references/no-such-file.md\`.\n`,
        message: 'skills/build-guide/references/stages/R1b.md: cannot resolve `skills/build-guide/references/no-such-file.md`',
      },
      {
        file: 'agents/build-guide-verifier.md',
        change: (t) => `${t}\nRead \`\${CLAUDE_PLUGIN_ROOT}/agents/build-guide-reviewer.md\`.\n`,
        message: 'agents/build-guide-verifier.md: cannot resolve `agents/build-guide-reviewer.md`',
      },
      {
        file: 'skills/build-guide/references/stages/W1.md',
        change: (t) => `${t}\nThe old forms: \`references/gone.md\`.\n`,
        message: 'skills/build-guide/references/stages/W1.md: cannot resolve `references/gone.md`',
      },
      {
        file: 'skills/build-guide/references/stages/R1a.md',
        change: (t) => `${t}\nNext to it, \`../gone.md\`.\n`,
        message: 'skills/build-guide/references/stages/R1a.md: cannot resolve `../gone.md`',
      },
      {
        file: 'skills/build-guide/references/stages/Q.md',
        change: (t) => t.replace(/\)\n/, ' or `build-guide-reviewer`)\n'),
        message: 'skills/build-guide/references/stages/Q.md: cannot resolve the agent type `build-guide-reviewer`',
      },
    ];
    cases.forEach(({ file, change, message }, i) => {
      const root = copyTree(`unresolved-${i}`);
      edit(root, file, change);
      const r = run(['--root', root]);
      expect({ file, code: r.code, said: r.stderr.includes(`[words-loaded] ${message}\n`) }).toEqual({ file, code: 1, said: true });
    });
  });
});

describe("AC-W126 (WU-148, D-505): the file-list difference, the bound's edges and §5's old forms, on small temp trees", () => {
  /** A tree in the new layout: one writer stage that names two references, one of them by a prefixed path. */
  const SMALL = path.join(TMP, 'small');
  const DEF = 'agents/build-guide-writer.md';
  const S1 = 'skills/build-guide/references/stages/S1.md';
  write(SMALL, DEF, '---\nname: build-guide-writer\n---\n\nYou write the guide. Read `${CLAUDE_PLUGIN_ROOT}/skills/build-guide/references/a.md` first.\n');
  write(SMALL, S1, '# S1: write it (`build-guide-writer`)\n\nThe template is `skills/build-guide/templates/t.md`; the run folder holds `plan.json`.\n');
  write(SMALL, 'skills/build-guide/references/stages/README.md', '# Stage references\n\nNot a stage.\n');
  write(SMALL, 'skills/build-guide/references/a.md', 'one two three four five six seven eight nine ten eleven twelve thirteen fourteen\n');
  write(SMALL, 'skills/build-guide/references/b.md', 'six seven\n');
  write(SMALL, 'skills/build-guide/templates/t.md', 'eight nine ten\n');
  const files = [DEF, 'skills/build-guide/references/a.md', S1, 'skills/build-guide/templates/t.md'];
  const words = files.reduce((n, f) => n + wordsOf(fs.readFileSync(path.join(SMALL, f), 'utf8')), 0);
  const withBaseline = (name: string, baseline: Measure) => {
    const file = path.join(TMP, `${name}.json`);
    fs.writeFileSync(file, JSON.stringify(baseline));
    return run(['--root', SMALL, '--baseline', file]);
  };

  it('measures the small tree: its one stage, its definition, its reference and the two files they name', () => {
    const r = run(['--root', SMALL, '--json']);
    expect({ code: r.code, stderr: r.stderr }).toEqual({ code: 0, stderr: '' });
    expect(JSON.parse(r.stdout)).toEqual({ S1: { words, files } });
  });

  it("prints a stage whose file list differs from its baseline's with the difference, and doesn't fail", () => {
    const listed = [DEF, S1, 'skills/build-guide/references/b.md', 'skills/build-guide/templates/t.md'];
    const r = withBaseline('differs', { S1: { words, files: listed } });
    expect({ code: r.code, stderr: r.stderr }).toEqual({ code: 0, stderr: '' });
    expect(r.stdout).toBe(`S1 ${words} ${words} +0.0%\n  files: +skills/build-guide/references/a.md -skills/build-guide/references/b.md\nmax +0.0%\n`);
    expect(parse(r.stdout).files).toEqual({ S1: ['+skills/build-guide/references/a.md', '-skills/build-guide/references/b.md'] });
  });

  it('exits 0 at 5% above the baseline and below it, and 1 above 5%', () => {
    // 42 words over a baseline of 40 is exactly 5% above it: within the bound.
    expect(words).toBe(42);
    const within = withBaseline('within', { S1: { words: 40, files } });
    expect({ code: within.code, stdout: within.stdout, stderr: within.stderr }).toEqual({ code: 0, stdout: 'S1 42 40 +5.0%\nmax +5.0%\n', stderr: '' });
    const below = withBaseline('below', { S1: { words: 56, files } });
    expect({ code: below.code, stdout: below.stdout, stderr: below.stderr }).toEqual({ code: 0, stdout: 'S1 42 56 -25.0%\nmax -25.0%\n', stderr: '' });
    const over = withBaseline('over', { S1: { words: 39, files } });
    expect({ code: over.code, stdout: over.stdout }).toEqual({ code: 1, stdout: 'S1 42 39 +7.7%\nmax +7.7%\n' });
    expect(over.stderr).toBe('[words-loaded] S1: +7.7% over its baseline (42 words, 39 at the baseline), above the 5% bound\n');
  });

  it('fails a stage with no baseline entry and a baseline stage the tree no longer has', () => {
    const r = withBaseline('stages', { S0: { words: 10, files: [DEF] } });
    expect(r.code).toBe(1);
    expect(r.stderr).toContain('[words-loaded] S0: in the baseline, not in the tree\n');
    expect(r.stderr).toContain('[words-loaded] S1: no baseline entry\n');
  });

  it("resolves a tree in the layout before amendment 15 by §5's path rules, and writes its file lists in the new paths", () => {
    // The old folders' names, joined here so the file doesn't name them itself (AC-W115's old-path guard).
    const dot = ['', 'claude'].join('.');
    const OLD = path.join(TMP, 'old-layout');
    const skill = `${dot}/skills/build-guide`;
    write(OLD, `${dot}/agents/build-guide/build-guide-writer.md`, '# writer\n\nRead `task-header.md` first.\n');
    write(OLD, `${skill}/SKILL.md`, 'the runner\n');
    write(OLD, `${skill}/references/stages/README.md`, '# Stage references\n');
    write(
      OLD,
      `${skill}/references/stages/S1.md`,
      [
        '# S1: a step (`build-guide-writer`)',
        '',
        'Prices: `references/pricing.md`; gates: `../gates.md`; the library: `patterns.md` (SKILL.md step 3).',
        `The template: \`${skill}/templates/t.md\`; the render: \`scripts/render-notes.mjs\`; the next step: \`stages/S2.md\`.`,
        'No file named: `check-run.mjs --changed <n>`, `data/rules/x.md`, `plan.json`, `references/stages/<stage>.md`.',
        '',
      ].join('\n'),
    );
    write(OLD, `${skill}/references/stages/S2.md`, '# S2: the next step (`build-guide-writer`)\n');
    for (const f of ['task-header.md', 'pricing.md', 'gates.md', 'patterns.md']) write(OLD, `${skill}/references/${f}`, `${f} text\n`);
    write(OLD, `${skill}/templates/t.md`, 'a template\n');
    write(OLD, `${skill}/scripts/render-notes.mjs`, 'export {};\n');
    write(OLD, `${skill}/scripts/check-run.mjs`, 'export {};\n');
    const r = run(['--root', OLD, '--json']);
    expect({ code: r.code, stderr: r.stderr }).toEqual({ code: 0, stderr: '' });
    const measure = JSON.parse(r.stdout) as Measure;
    expect(measure.S1.files).toEqual([
      'agents/build-guide-writer.md',
      'skills/build-guide/SKILL.md',
      'skills/build-guide/references/gates.md',
      'skills/build-guide/references/pricing.md',
      'skills/build-guide/references/stages/S1.md',
      'skills/build-guide/references/stages/S2.md',
      'skills/build-guide/references/task-header.md',
      'skills/build-guide/scripts/render-notes.mjs',
      'skills/build-guide/templates/t.md',
      'skills/game-knowledge/references/patterns.md',
    ]);
    expect(measure.S2.files).toEqual(['agents/build-guide-writer.md', 'skills/build-guide/references/stages/S2.md', 'skills/build-guide/references/task-header.md']);
    expect(Object.keys(measure)).toEqual(['S1', 'S2']);
  });
});
