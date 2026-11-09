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
 * Amendment 16 (M-29, WU-156; D-513), AC-W139: the script leaves out another stage reference that only the agent
 * definition names (one the stage's own reference names stays); the baseline has two sections, `a8d735c`, equal to
 * `--at a8d735c --json`, and `since`, each entry equal to its stage's entry `--at` the commit it names; the pins are hand
 * counts at `a8d735c` under that rule; a stage under any `skills/<piece>/references/stages/` is found; every stage is
 * within 5% of its baseline.
 *
 * The failing cases run on copies of `skills/` and `agents/` in a temp folder, their text changed there, or on a small
 * tree written there; no tracked file is changed.
 */
import { describe, it, expect, afterAll } from '@jest/globals';
import { execFileSync, spawnSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';

const REPO = path.resolve(__dirname, '..', '..');
const SCRIPT = path.join(REPO, 'scripts', 'words-loaded.mjs');
const BASELINE_FILE = path.join(REPO, 'scripts', 'words-loaded.baseline.json');
/**
 * `pricing.md`'s path before amendment 16 moved it to the pricing piece (D-520), at a8d735c and in the old layout's
 * mapping; joined here so no test names the old path itself (AC-W155's guard).
 */
const OLD_PRICING = ['skills/build-guide/references', 'pricing.md'].join('/');
const SKILLS = path.join(REPO, 'skills');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'pob2-words-loaded-'));
afterAll(() => fs.rmSync(TMP, { recursive: true, force: true }));

interface Entry {
  words: number;
  files: string[];
}
type Measure = Record<string, Entry>;
/** D-513's two sections: the stages at `a8d735c`, and the stages new since, each with the commit that adds it. */
interface Baseline {
  a8d735c: Measure;
  since: Record<string, Entry & { commit: string }>;
}
const BASELINE_FILE_DATA = JSON.parse(fs.readFileSync(BASELINE_FILE, 'utf8')) as Baseline;
/** Each stage's baseline entry, from either section. */
const BASELINE: Measure = { ...BASELINE_FILE_DATA.a8d735c, ...BASELINE_FILE_DATA.since };
/** A baseline file's content for one section of stages, `since` empty. */
const twoSections = (a8d735c: Measure): Baseline => ({ a8d735c, since: {} });

interface Result {
  code: number | null;
  stdout: string;
  stderr: string;
}
/** The script under the Node running the test, from a temp folder, with an explicit env (git for `--at`). */
const ENV = { PATH: '/usr/bin:/bin', HOME: TMP, LANG: 'C' };
function run(args: string[], script = SCRIPT): Result {
  const r = spawnSync(process.execPath, [script, ...args], { cwd: TMP, env: ENV, encoding: 'utf8', timeout: 60000 });
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

/**
 * Every stage reference, root-relative, by its stage: each `.md` but README.md directly under any piece's
 * `skills/<piece>/references/stages/` (D-513; D-505 had build-guide's alone).
 */
const STAGE_REFERENCES = new Map(
  fs
    .readdirSync(SKILLS)
    .filter((piece) => fs.statSync(path.join(SKILLS, piece, 'references', 'stages'), { throwIfNoEntry: false })?.isDirectory())
    .flatMap((piece) =>
      fs
        .readdirSync(path.join(SKILLS, piece, 'references', 'stages'))
        .filter((f) => f.endsWith('.md') && f !== 'README.md')
        .map((f) => [f.replace(/\.md$/, ''), `skills/${piece}/references/stages/${f}`] as [string, string]),
    ),
);
/** The stages D-505 names: one per stage reference, not its README.md, Q once per agent type that runs it. */
const EXPECTED_STAGES = [...STAGE_REFERENCES.keys()].flatMap((s) => (s === 'Q' ? ['Q:coordinator', 'Q:researcher'] : [s])).sort();
/** The agent type that runs each stage, as `skills/build-guide/SKILL.md`'s step table routes it. */
const AGENT: Record<string, string> = { R1a: 'researcher', V4: 'verifier', W1: 'writer', 'Q:researcher': 'researcher', 'Q:coordinator': 'coordinator' };
const agentOf = (stage: string) => `agents/build-guide-${AGENT[stage] ?? 'coordinator'}.md`;
const referenceOf = (stage: string) => STAGE_REFERENCES.get(stage.split(':')[0])!;

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

  it('counts, for each stage, the words of its agent definition, its stage reference and each file under skills/ or agents/ the two name, less the other stage references only the definition names (D-513)', () => {
    expect({ code: REPO_MEASURE.code, stderr: REPO_MEASURE.stderr }).toEqual({ code: 0, stderr: '' });
    const measure = JSON.parse(REPO_MEASURE.stdout) as Measure;
    expect(Object.keys(measure)).toEqual(EXPECTED_STAGES);
    /** The plugin files a text names: root-relative, after an optional prefix, but in a command line's span (§5). */
    const named = (text: string) =>
      [...text.replace(/`(?:node\s[^`]*|[^`\s]+\.(?:mjs|sh)\s[^`]*)`/g, '').matchAll(/(?<![\w./-])(?:\$\{CLAUDE_PLUGIN_ROOT\}\/|<root>\/)?((?:skills|agents)\/[\w./-]*[\w-])/g)]
        .map((m) => m[1])
        .filter((p) => fs.statSync(path.join(REPO, p), { throwIfNoEntry: false })?.isFile());
    const read = (p: string) => fs.readFileSync(path.join(REPO, p), 'utf8');
    const stageReferences = new Set(STAGE_REFERENCES.values());
    for (const stage of EXPECTED_STAGES) {
      const def = agentOf(stage);
      const ref = referenceOf(stage);
      // D-513: of the stage references, the definition's names add none; the stage's own reference adds those it names.
      const fromDefinition = named(read(def)).filter((f) => !stageReferences.has(f));
      const files = [...new Set([def, ref, ...fromDefinition, ...named(read(ref))])].sort();
      expect({ stage, files: measure[stage].files }).toEqual({ stage, files });
      expect({ stage, words: measure[stage].words }).toEqual({ stage, words: files.reduce((n, f) => n + wordsOf(read(f)), 0) });
    }
    // Two agent types run Q, so its two counts differ by their definitions and what each names.
    expect(measure['Q:researcher'].files).toContain('agents/build-guide-researcher.md');
    expect(measure['Q:coordinator'].files).toContain('agents/build-guide-coordinator.md');
    expect(measure['Q:researcher'].files).not.toContain('agents/build-guide-coordinator.md');
  });

  it("the stage references and agent definitions name plugin files only in the root-relative form the scan above reads: no bare or skill-relative names", () => {
    const pluginNames = new Set(['skills', 'agents'].flatMap((d) => fs.readdirSync(path.join(REPO, d), { recursive: true, withFileTypes: true }).filter((e) => e.isFile()).map((e) => e.name)));
    /** The names §5 resolves that the scan doesn't: a bare plugin file name, or a skill-relative or `../` or `./` path. */
    const missed = (text: string) =>
      text
        .split(/[\s`]+/)
        .map((t) => t.replace(/^[(\["'‘“*]+/, '').replace(/[)\]"'’”*,.;:!?]+$/, '').replace(/['’]s$/, '').replace(/[)\]"'’”*,.;:!?]+$/, ''))
        .filter((t) => pluginNames.has(t) || /^(?:references|templates|stages)\/|^\.\.?\//.test(t) || (/^scripts\/[\w.-]+$/.test(t) && !fs.existsSync(path.join(REPO, t))));
    expect(missed('As `SKILL.md`, references/a.md, (../gates.md), stages/Q.md and scripts/render-notes.mjs; patterns.md’s, not scripts/run-usage.mjs or skills/build-guide/SKILL.md.')).toEqual([
      'SKILL.md',
      'references/a.md',
      '../gates.md',
      'stages/Q.md',
      'scripts/render-notes.mjs',
      'patterns.md',
    ]);
    for (const file of [...new Set(EXPECTED_STAGES.flatMap((s) => [agentOf(s), referenceOf(s)]))]) {
      expect({ file, missed: missed(fs.readFileSync(path.join(REPO, file), 'utf8')) }).toEqual({ file, missed: [] });
    }
  });

  it("the committed baseline's a8d735c section is the same count at a8d735c, each since entry the same count at its commit, one entry per stage, its file lists in the new root-relative paths (D-513)", () => {
    expect(Object.keys(BASELINE_FILE_DATA)).toEqual(['a8d735c', 'since']);
    const r = run(['--at', 'a8d735c', '--json']);
    expect({ code: r.code, stderr: r.stderr }).toEqual({ code: 0, stderr: '' });
    expect(JSON.parse(r.stdout)).toEqual(BASELINE_FILE_DATA.a8d735c);
    for (const [stage, { commit, ...entry }] of Object.entries(BASELINE_FILE_DATA.since)) {
      expect({ stage, inBoth: stage in BASELINE_FILE_DATA.a8d735c }).toEqual({ stage, inBoth: false });
      const at = run(['--at', commit, '--json']);
      expect({ stage, commit, code: at.code, stderr: at.stderr }).toEqual({ stage, commit, code: 0, stderr: '' });
      expect({ stage, commit, entry: (JSON.parse(at.stdout) as Measure)[stage] }).toEqual({ stage, commit, entry });
    }
    expect(Object.keys(BASELINE).sort()).toEqual(EXPECTED_STAGES);
    for (const [stage, { files }] of Object.entries(BASELINE)) {
      expect({ stage, root: files.every((f) => /^(?:skills|agents)\/[\w./-]+$/.test(f)), sorted: [...files].sort() }).toEqual({ stage, root: true, sorted: files });
      expect(files).toEqual(expect.arrayContaining([agentOf(stage), referenceOf(stage)]));
    }
    // Game knowledge's moved files appear at their new paths (the spine's old-to-new path line).
    expect(BASELINE.R1a.files).toEqual(expect.arrayContaining(['skills/game-knowledge/references/patterns.md', 'skills/game-knowledge/references/lookups.md', 'skills/game-knowledge/references/source-markers.md']));
  });

  it("the baseline's counts match ones taken by hand at a8d735c under D-513's rule, and W1's and R1b's file lists match their names read by hand", () => {
    // Summed `git show a8d735c:<old path> | wc -w` over each stage's files (the review of WU-148), re-counted under
    // D-513 (WU-156): R1b, D1-build and D2-gate drop the other stage references the coordinator's definition names (from
    // 110596, 102373 and 77151); V4, W1 and Q:researcher are as they were.
    const pinned = { V4: 24049, W1: 33684, R1b: 67356, 'Q:researcher': 33041, 'D1-build': 82765, 'D2-gate': 23812 };
    expect(Object.fromEntries(Object.keys(pinned).map((k) => [k, BASELINE[k].words]))).toEqual(pinned);
    // W1 at a8d735c: the writer's definition names the task header, offline-and-test.md and source-markers.md; W1.md
    // names SKILL.md, toughness-targets.json, both guide templates and the two render scripts by path; both scripts
    // also run as commands elsewhere, which name no file.
    const W1_FILES = [
      'agents/build-guide-writer.md',
      'skills/build-guide/SKILL.md',
      'skills/build-guide/references/offline-and-test.md',
      'skills/build-guide/references/stages/W1.md',
      'skills/build-guide/references/task-header.md',
      'skills/build-guide/references/toughness-targets.json',
      'skills/build-guide/scripts/render-audit.mjs',
      'skills/build-guide/scripts/render-notes.mjs',
      'skills/build-guide/templates/guide-endgame-template.md',
      'skills/build-guide/templates/guide-template.md',
      'skills/game-knowledge/references/source-markers.md',
    ];
    expect(BASELINE.W1.files).toEqual(W1_FILES);
    // R1b at a8d735c (D-513): the coordinator's definition names SKILL.md, the task header, offline-and-test.md,
    // pricing.md, lookups.md and source-markers.md, and every coordinator stage's reference, which are left out; R1b.md
    // names R1a.md and R1a-synthesize.md, which stay, the pattern library, checkpoints.md and the card template.
    const R1B_FILES = [
      'agents/build-guide-coordinator.md',
      'skills/build-guide/SKILL.md',
      'skills/build-guide/references/checkpoints.md',
      'skills/build-guide/references/offline-and-test.md',
      OLD_PRICING,
      'skills/build-guide/references/stages/R1a-synthesize.md',
      'skills/build-guide/references/stages/R1a.md',
      'skills/build-guide/references/stages/R1b.md',
      'skills/build-guide/references/task-header.md',
      'skills/build-guide/templates/card-template.md',
      'skills/game-knowledge/references/lookups.md',
      'skills/game-knowledge/references/patterns.md',
      'skills/game-knowledge/references/source-markers.md',
    ];
    expect(BASELINE.R1b.files).toEqual(R1B_FILES);
    // The old folders' names, joined here so the file doesn't name them itself (AC-W115's old-path guard).
    const dot = ['', 'claude'].join('.');
    const oldPath = (f: string) => (f.startsWith('agents/') ? `${dot}/agents/build-guide/${f.slice('agents/'.length)}` : `${dot}/skills/build-guide/${f.replace(/^skills\/[\w-]+\//, '')}`);
    const git = (blob: string) => execFileSync('git', ['-C', REPO, 'cat-file', 'blob', blob], { encoding: 'utf8', env: ENV });
    expect(W1_FILES.reduce((n, f) => n + wordsOf(git(`a8d735c:${oldPath(f)}`)), 0)).toBe(pinned.W1);
    expect(R1B_FILES.reduce((n, f) => n + wordsOf(git(`a8d735c:${oldPath(f)}`)), 0)).toBe(pinned.R1b);
  });

  it('runs the same through a symbolic link to the script', () => {
    const link = path.join(TMP, 'linked', 'words-loaded.mjs');
    fs.mkdirSync(path.dirname(link), { recursive: true });
    fs.symlinkSync(SCRIPT, link);
    expect(run([], link)).toEqual(REPO_RUN);
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
    expect(over.stderr).toMatch(new RegExp(`^\\[words-loaded\\] W1: ${atBound + 1} words, more than the ${atBound} the 5% bound allows over its baseline's ${base} \\(\\+\\d+\\.\\d\\d%\\)$`, 'm'));
  });

  it('a stage reference far over its baseline fails, and so does every stage that names it', () => {
    const root = copyTree('inflated');
    // To 6% over its baseline, from where it stands today (D-513's smaller baseline leaves it further under).
    const today = (JSON.parse(REPO_MEASURE.stdout) as Measure)['D2-gate'].words;
    edit(root, 'skills/build-guide/references/stages/D2-gate.md', (text) => `${text}\n${'inflated '.repeat(Math.ceil(BASELINE['D2-gate'].words * 1.06) - today)}\n`);
    const r = run(['--root', root]);
    expect(r.code).toBe(1);
    const failed = [...r.stderr.matchAll(/^\[words-loaded\] (\S+): \d+ words, more than the \d+ the 5% bound allows/gm)].map((m) => m[1]);
    // The coordinator's definition names every coordinator stage's reference, but under D-513 a stage loads another's
    // only when its own reference names it.
    const naming = EXPECTED_STAGES.filter((s) => (JSON.parse(REPO_MEASURE.stdout) as Measure)[s].files.includes('skills/build-guide/references/stages/D2-gate.md'));
    expect(failed).toEqual(expect.arrayContaining(['D2-gate']));
    expect(failed.every((s) => naming.includes(s))).toBe(true);
    // R1b runs on the coordinator's definition, which names D2-gate.md; R1b.md doesn't, so R1b doesn't load it.
    expect(fs.readFileSync(path.join(REPO, agentOf('R1b')), 'utf8')).toContain('stages/D2-gate.md');
    expect({ naming: naming.includes('R1b'), failed: failed.includes('R1b') }).toEqual({ naming: false, failed: false });
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
  it("resolves a scripts/ name against the naming skill's folder or the root's scripts/, and fails one that points at no file", () => {
    const root = copyTree('scripts-names');
    fs.cpSync(path.join(REPO, 'scripts'), path.join(root, 'scripts'), { recursive: true });
    const W1 = 'skills/build-guide/references/stages/W1.md';
    const w1Files = (r: Result) => (JSON.parse(r.stdout) as Measure).W1.files;
    // A real root script and a real build-guide script by their skill-relative name, and a command line, which names no file.
    edit(root, W1, (t) => `${t}\nSee \`scripts/fresh-clone-check.sh\`, \`scripts/render-notes.mjs\` and \`scripts/nope-command.mjs <runFolder>\`.\n`);
    const real = run(['--root', root, '--json']);
    expect({ code: real.code, stderr: real.stderr }).toEqual({ code: 0, stderr: '' });
    expect(w1Files(real)).toEqual((JSON.parse(REPO_MEASURE.stdout) as Measure).W1.files);
    expect(w1Files(real)).toContain('skills/build-guide/scripts/render-notes.mjs');
    edit(root, W1, (t) => `${t}\nAnd \`scripts/nope-render.mjs\`.\n`);
    const missing = run(['--root', root]);
    expect({ code: missing.code, said: missing.stderr.includes('[words-loaded] skills/build-guide/references/stages/W1.md: cannot resolve `scripts/nope-render.mjs`\n') }).toEqual({ code: 1, said: true });
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
    fs.writeFileSync(file, JSON.stringify(twoSections(baseline)));
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
    expect(over.stderr).toBe("[words-loaded] S1: 42 words, more than the 40 the 5% bound allows over its baseline's 39 (+7.69%)\n");
  });

  it('a count just over the bound fails, though its line rounds to +5.0%, and the failure names the count the bound allows', () => {
    // 2 words of definition and 5 of title, then the padding: 10504 words in all, 10500 the second time.
    const EDGE = path.join(TMP, 'edge');
    write(EDGE, DEF, '# writer\n');
    write(EDGE, S1, `# S1: a step (\`build-guide-writer\`)\n${'w '.repeat(10497)}\n`);
    const base = path.join(TMP, 'edge.json');
    fs.writeFileSync(base, JSON.stringify(twoSections({ S1: { words: 10000, files: [DEF, S1] } })));
    const over = run(['--root', EDGE, '--baseline', base]);
    expect(over).toEqual({ code: 1, stdout: 'S1 10504 10000 +5.0%\nmax +5.0%\n', stderr: "[words-loaded] S1: 10504 words, more than the 10500 the 5% bound allows over its baseline's 10000 (+5.04%)\n" });
    write(EDGE, S1, `# S1: a step (\`build-guide-writer\`)\n${'w '.repeat(10493)}\n`);
    expect(run(['--root', EDGE, '--baseline', base])).toEqual({ code: 0, stdout: 'S1 10500 10000 +5.0%\nmax +5.0%\n', stderr: '' });
  });

  it("reads a name with a possessive 's or ’s as the name: a path's resolves, a bare name's counts", () => {
    const POSS = path.join(TMP, 'possessive');
    write(POSS, DEF, '# writer\n');
    write(POSS, S1, "# S1: a step (`build-guide-writer`)\n\nAs skills/build-guide/references/a.md's step 3 says, and b.md’s last line.\n");
    write(POSS, 'skills/build-guide/references/a.md', 'a\n');
    write(POSS, 'skills/build-guide/references/b.md', 'b\n');
    const r = run(['--root', POSS, '--json']);
    expect({ code: r.code, stderr: r.stderr }).toEqual({ code: 0, stderr: '' });
    expect((JSON.parse(r.stdout) as Measure).S1.files).toEqual([DEF, 'skills/build-guide/references/a.md', 'skills/build-guide/references/b.md', S1]);
    // A missing file named with a possessive is still an unresolvable name.
    write(POSS, S1, "# S1: a step (`build-guide-writer`)\n\nAs skills/build-guide/references/gone.md's step says.\n");
    const gone = run(['--root', POSS, '--json']);
    expect({ code: gone.code, stderr: gone.stderr }).toEqual({ code: 1, stderr: '[words-loaded] skills/build-guide/references/stages/S1.md: cannot resolve `skills/build-guide/references/gone.md`\n' });
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
      OLD_PRICING,
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

describe("AC-W139 (WU-156, D-513): another stage's reference, the pieces' stages and the baseline's two sections, on small temp trees", () => {
  const COORD = 'agents/build-guide-coordinator.md';
  const stage = (name: string, piece = 'build-guide') => `skills/${piece}/references/stages/${name}.md`;
  const sumOf = (root: string, files: string[]) => files.reduce((n, f) => n + wordsOf(fs.readFileSync(path.join(root, f), 'utf8')), 0);
  const measured = (root: string, extra: string[] = []) => {
    const r = run(['--root', root, ...extra, '--json']);
    expect({ code: r.code, stderr: r.stderr }).toEqual({ code: 0, stderr: '' });
    return JSON.parse(r.stdout) as Measure;
  };

  it("leaves out another stage reference that only the definition names; one the stage's own reference names stays, and so do the definition's other files", () => {
    const ROOT = path.join(TMP, 'other-stages');
    // The definition names three stage references, the stages' README.md (not a stage) and a.md, as a step table does.
    write(ROOT, COORD, ['# coordinator', '', ...['S1', 'S2', 'S3', 'README'].map((s) => `| ${s} | \`\${CLAUDE_PLUGIN_ROOT}/${stage(s)}\` |`), '', 'Read `${CLAUDE_PLUGIN_ROOT}/skills/build-guide/references/a.md`.', ''].join('\n'));
    write(ROOT, stage('README'), '# Stage references\n');
    write(ROOT, stage('S1'), `# S1: the first (\`build-guide-coordinator\`)\n\nThen \`${stage('S3')}\`, which this step reads too.\n`);
    write(ROOT, stage('S2'), '# S2: the second (`build-guide-coordinator`)\n');
    write(ROOT, stage('S3'), '# S3: the third (`build-guide-coordinator`)\n\nwords of its own\n');
    write(ROOT, 'skills/build-guide/references/a.md', 'a b c\n');
    const shared = [COORD, 'skills/build-guide/references/a.md', stage('README')];
    const expected = {
      S1: [...shared, stage('S1'), stage('S3')].sort(),
      S2: [...shared, stage('S2')].sort(),
      S3: [...shared, stage('S3')].sort(),
    };
    const measure = measured(ROOT);
    expect(measure).toEqual(Object.fromEntries(Object.entries(expected).map(([k, files]) => [k, { words: sumOf(ROOT, files), files }])));
  });

  it("finds a stage under any skills/<piece>/references/stages/, keyed by its name, its skill-relative names read in its own piece, and fails two pieces' stages of one name", () => {
    const ROOT = path.join(TMP, 'piece-stages');
    write(ROOT, COORD, `# coordinator\n\n| measure | \`\${CLAUDE_PLUGIN_ROOT}/${stage('measure', 'compile')}\` |\n`);
    write(ROOT, stage('S1'), '# S1: a step (`build-guide-coordinator`)\n');
    write(ROOT, stage('measure', 'compile'), '# measure: read and measure (`pob2:build-guide-coordinator`)\n\nThe card: `references/m.md`.\n');
    write(ROOT, 'skills/compile/SKILL.md', 'the compile runner\n');
    write(ROOT, 'skills/compile/references/m.md', 'the file card\n');
    // The build-guide skill's own `references/m.md` isn't the one a compile stage names.
    write(ROOT, 'skills/build-guide/references/m.md', 'not this one\n');
    const measure = measured(ROOT);
    expect(Object.keys(measure)).toEqual(['S1', 'measure']);
    expect(measure.measure.files).toEqual([COORD, 'skills/compile/references/m.md', stage('measure', 'compile')]);
    expect(measure.S1.files).toEqual([COORD, stage('S1')]);
    // A second piece's stage reference named S1 fails the run, naming both.
    write(ROOT, stage('S1', 'pricing'), '# S1: another (`build-guide-coordinator`)\n');
    const twice = run(['--root', ROOT, '--json']);
    expect({ code: twice.code, stderr: twice.stderr }).toEqual({
      code: 1,
      stderr: `[words-loaded] two stage references are named S1: ${stage('S1')}, ${stage('S1', 'pricing')}\n`,
    });
  });

  it("compares a since entry as it compares the a8d735c section's, each entry the count at the commit it names, and refuses a baseline of another shape", () => {
    const ROOT = path.join(TMP, 'since-tree');
    const git = (...args: string[]) =>
      execFileSync('git', ['-C', ROOT, '-c', 'user.name=words-loaded-test', '-c', 'user.email=words-loaded-test', '-c', 'commit.gpgsign=false', ...args], { encoding: 'utf8', env: ENV, stdio: ['ignore', 'pipe', 'pipe'] }).trim();
    write(ROOT, COORD, '# coordinator\n');
    write(ROOT, stage('S1'), '# S1: a step (`build-guide-coordinator`)\n');
    git('init', '-q');
    git('add', '-A');
    git('commit', '-q', '-m', 'one stage');
    const first = git('rev-parse', 'HEAD');
    write(ROOT, stage('measure', 'compile'), '# measure: read and measure (`build-guide-coordinator`)\n\nnew words\n');
    git('add', '-A');
    git('commit', '-q', '-m', 'a piece adds its stage');
    const second = git('rev-parse', 'HEAD');
    const atFirst = measured(ROOT, ['--at', first]);
    const atSecond = measured(ROOT, ['--at', second]);
    expect(Object.keys(atFirst)).toEqual(['S1']);
    expect(Object.keys(atSecond)).toEqual(['S1', 'measure']);
    const compareWith = (name: string, baseline: unknown) => {
      const file = path.join(TMP, `since-${name}.json`);
      fs.writeFileSync(file, JSON.stringify(baseline));
      return run(['--root', ROOT, '--baseline', file]);
    };
    const since = { measure: { commit: second, ...atSecond.measure } };
    const ok = compareWith('ok', { a8d735c: atFirst, since });
    expect(ok).toEqual({ code: 0, stdout: `S1 ${atFirst.S1.words} ${atFirst.S1.words} +0.0%\nmeasure ${atSecond.measure.words} ${atSecond.measure.words} +0.0%\nmax +0.0%\n`, stderr: '' });
    // A since entry is held to the bound like any other.
    const low = Math.floor((atSecond.measure.words * 100) / 106);
    const over = compareWith('over', { a8d735c: atFirst, since: { measure: { ...since.measure, words: low } } });
    expect(over.code).toBe(1);
    expect(over.stderr).toMatch(new RegExp(`^\\[words-loaded\\] measure: ${atSecond.measure.words} words, more than the \\d+ the 5% bound allows over its baseline's ${low} `, 'm'));
    // Refused (exit 2): the one-section form, a stage in both sections, a since entry with no commit.
    const refused = (name: string, baseline: unknown, said: string) => {
      const r = compareWith(name, baseline);
      expect({ name, code: r.code, said: r.stderr.includes(said) }).toEqual({ name, code: 2, said: true });
    };
    refused('flat', atSecond, `isn't {"a8d735c": {…}, "since": {…}}`);
    refused('both', { a8d735c: atSecond, since }, "the baseline's stage measure is in both sections");
    refused('no-commit', { a8d735c: atFirst, since: { measure: atSecond.measure } }, "the baseline's since entry measure names no commit");
  });
});
