#!/usr/bin/env node
// The words each build-guide step loads (amendment 15, D-505; AC-W126). A repository script, not a plugin component.
//
//   node scripts/words-loaded.mjs [--root <dir>] [--baseline <file>]   compare each stage with the baseline
//   node scripts/words-loaded.mjs [--root <dir>] [--at <commit>] --json print the counts in the baseline's format
//
// A stage is a stage reference under skills/build-guide/references/stages/, not its README.md. Its words loaded are the
// words of the agent definition that runs it, the stage reference, and each file under skills/ or agents/ the two name,
// resolved by amendment 15 §5's path rules. The agent type is the one the stage reference's title names in backticks;
// a stage whose title names two (Q: researcher or coordinator) is counted once per type, keyed `<stage>:<type>` with
// the `build-guide-` prefix dropped (`Q:researcher`, `Q:coordinator`). Files under data/ and run-folder files are left
// out. A name is a path token in a code span, a fenced block or the prose: root-relative (after a leading
// `${CLAUDE_PLUGIN_ROOT}/` or `<root>/`), skill-relative (`references/…`, `templates/…`, `stages/…`, `scripts/<x>.mjs`),
// relative to the file's own folder (`../gates.md`), or a bare name of a plugin file (`patterns.md`). A path is cut at
// an anchor or a line number (`#…`, `:178`); a pattern (`…/stages/<stage>.md`) names its folder, which holds no words.
// A command line (a span or a fenced line that starts with `node`, or with a script followed by arguments) names a
// command, which §5 makes a `bin/` command, not a file. A word is a run of non-whitespace characters, as `wc -w` counts.
// A name that points into skills/ or agents/ (or at the skill-relative or `../`/`./` forms) and resolves to nothing
// fails the run.
//
// The tree is --root's working files (default: this repository), or, with --at, that commit's tree in --root's git
// repository. A tree in the layout before amendment 15 (the skill in .claude/skills/build-guide/, the agents in
// .claude/agents/build-guide/) is resolved in its own layout, and its file lists are written in the new root-relative
// paths, mapped as the spine's old-to-new path line maps them (game knowledge's six files to skills/game-knowledge/).
// The committed baseline, scripts/words-loaded.baseline.json, is `--at a8d735c --json`'s output:
// {"<stage>": {"words": n, "files": ["<root-relative path>", …]}, …}.
//
// Output (stdout), one line per stage, then the largest growth:
//   <stage> <words> <baseline> <+n.n%>
//     files: +<path> … -<path> …      only when the stage's file list differs from its baseline's (not a failure)
//   max <+n.n%>
// The reasons for a failure go to stderr. Exit code 1 when a stage is more than 5% above its baseline, a name doesn't
// resolve, a stage has no baseline entry or a baseline stage is gone; 2 on a usage error; else 0.

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const posix = path.posix;
const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_ROOT = path.resolve(SCRIPT_DIR, '..');
const DEFAULT_BASELINE = path.join(SCRIPT_DIR, 'words-loaded.baseline.json');
/** A stage may grow at most this many percent over its baseline (D-505). */
const BOUND_PERCENT = 5;

class UsageError extends Error {}

/** Whitespace-separated words, as `wc -w` counts them. */
export const wordsOf = (text) => text.split(/\s+/).filter(Boolean).length;

// ---------------------------------------------------------------------------------------------------------------------
// Trees: the working files under a folder, or a commit's tree.

/** A reader that reads each file once: a file is named by many stages. */
function cached(read) {
  const texts = new Map();
  return (p) => {
    if (!texts.has(p)) texts.set(p, read(p));
    return texts.get(p);
  };
}

function fsTree(root) {
  const abs = (p) => path.join(root, ...p.split('/').filter(Boolean));
  return {
    exists(p) {
      try {
        const st = fs.statSync(abs(p));
        return st.isFile() ? 'file' : st.isDirectory() ? 'dir' : null;
      } catch {
        return null;
      }
    },
    read: cached((p) => fs.readFileSync(abs(p), 'utf8')),
    /** Every file under a folder, root-relative. */
    list(dir) {
      const out = [];
      const walk = (rel) => {
        for (const e of fs.readdirSync(abs(rel), { withFileTypes: true })) {
          const child = rel ? `${rel}/${e.name}` : e.name;
          if (e.isDirectory()) walk(child);
          else if (e.isFile()) out.push(child);
        }
      };
      if (this.exists(dir) === 'dir') walk(dir.replace(/\/$/, ''));
      return out.sort();
    },
  };
}

function gitTree(root, commit) {
  const git = (args) => execFileSync('git', ['-C', root, ...args], { encoding: 'utf8', maxBuffer: 1 << 28, stdio: ['ignore', 'pipe', 'pipe'] });
  let listing;
  try {
    listing = git(['ls-tree', '-r', '-z', '--name-only', commit]);
  } catch (e) {
    throw new UsageError(`can't read commit ${commit} in ${root}: ${String(e.stderr || e.message).trim()}`);
  }
  const files = new Set(listing.split('\0').filter(Boolean));
  const dirs = new Set(['']);
  for (const f of files) for (let i = f.indexOf('/'); i >= 0; i = f.indexOf('/', i + 1)) dirs.add(f.slice(0, i));
  return {
    exists(p) {
      const q = p.replace(/\/$/, '');
      return files.has(q) ? 'file' : dirs.has(q) ? 'dir' : null;
    },
    read: cached((p) => git(['cat-file', 'blob', `${commit}:${p}`])),
    list: (dir) => [...files].filter((f) => f.startsWith(`${dir.replace(/\/$/, '')}/`)).sort(),
  };
}

// ---------------------------------------------------------------------------------------------------------------------
// Layouts: where a tree keeps its skills and agents, and how its paths read in the new layout.

/** Game knowledge's six files, which amendment 15 moved out of build-guide's folders (D-503). */
const MOVED_TO_GAME_KNOWLEDGE = new Set([
  'references/patterns.md',
  'references/lookups.md',
  'references/source-markers.md',
  'scripts/rules-index.mjs',
  'scripts/league-digest.mjs',
  'scripts/monster-mods.mjs',
]);
const OLD_SKILL = '.claude/skills/build-guide';
const OLD_AGENTS = '.claude/agents/build-guide';

function layoutOf(tree) {
  if (tree.exists('skills/build-guide/references/stages') === 'dir') {
    const pieces = [...new Set(tree.list('skills').map((f) => f.split('/')[1]))].sort((a, b) => (a === 'build-guide' ? -1 : b === 'build-guide' ? 1 : a.localeCompare(b)));
    return { stages: 'skills/build-guide/references/stages', skillRoots: pieces.map((p) => `skills/${p}`), agents: 'agents', toNew: (p) => p };
  }
  if (tree.exists(`${OLD_SKILL}/references/stages`) === 'dir') {
    const toNew = (p) => {
      if (p.startsWith(`${OLD_SKILL}/`)) {
        const rest = p.slice(OLD_SKILL.length + 1);
        return `skills/${MOVED_TO_GAME_KNOWLEDGE.has(rest) ? 'game-knowledge' : 'build-guide'}/${rest}`;
      }
      if (p.startsWith(`${OLD_AGENTS}/`)) return `agents/${p.slice(OLD_AGENTS.length + 1)}`;
      return p;
    };
    return { stages: `${OLD_SKILL}/references/stages`, skillRoots: [OLD_SKILL], agents: OLD_AGENTS, toNew };
  }
  throw new UsageError('no stage references in the tree (skills/build-guide/references/stages/)');
}

// ---------------------------------------------------------------------------------------------------------------------
// Names: the path tokens a file's text holds, and what each resolves to.

/** Code spans, fenced-block lines and the prose of a Markdown text, each a segment of whitespace-separated tokens. */
function segmentsOf(text) {
  const segments = [];
  const unfenced = text.replace(/^[ \t]*(`{3,})[^\n]*\n([\s\S]*?)^[ \t]*\1[ \t]*$/gm, (block, _fence, body) => {
    for (const line of body.split('\n')) segments.push({ text: line, command: true });
    return block.replace(/[^\n]/g, ' ');
  });
  const prose = unfenced.replace(/`([^`\n]+(?:\n[^`\n]+)*)`/g, (span, inner) => {
    segments.push({ text: inner.replace(/\s+/g, ' ').trim(), command: true });
    return span.replace(/[^\n]/g, ' ');
  });
  segments.push({ text: prose, command: false });
  return segments;
}

/** The punctuation around a token in prose: brackets, quotes, emphasis and a sentence's marks. */
const LEADING = /^[(\["'‘“*]+/;
const TRAILING = /[)\]"'’”*,.;:!?]+$/;

/**
 * A token with its wrapping punctuation, a possessive `'s` (`SKILL.md's step 3`), a link's text and a
 * `${CLAUDE_PLUGIN_ROOT}/` or `<root>/` prefix removed.
 */
function cleanToken(raw) {
  let t = raw;
  const link = t.indexOf('](');
  if (link >= 0) t = t.slice(link + 2);
  t = t.replace(LEADING, '').replace(TRAILING, '').replace(/['’]s$/, '').replace(TRAILING, '');
  return t.replace(/^(?:\$\{CLAUDE_PLUGIN_ROOT\}|<root>)\//, '');
}

const isScript = (t) => /\.(?:mjs|cjs|js|sh)$/.test(t);

/** The path tokens of a text: every token of every segment, but a command line's. */
function tokensOf(text) {
  const out = [];
  for (const seg of segmentsOf(text)) {
    const tokens = seg.text.split(/\s+/).filter(Boolean);
    if (!tokens.length) continue;
    if (seg.command && (tokens[0] === 'node' || (tokens.length > 1 && isScript(cleanToken(tokens[0]))))) continue;
    for (const tok of tokens) {
      const t = cleanToken(tok);
      if (t) out.push(t);
    }
  }
  return out;
}

/** A token's path: cut at an anchor or a line number, and at a placeholder or a glob to the folder before it. */
function pathOf(token) {
  const t = token.replace(/#.*$/, '').replace(/:[\d–-]+$/, '');
  const cut = t.search(/[<*{…|$]/);
  if (cut < 0) return t;
  const slash = t.lastIndexOf('/', cut);
  return slash < 0 ? null : t.slice(0, slash + 1);
}

/** The forms that point into the plugin's skills or agents: a name in one of them must resolve. */
const CLAIMS = /^(?:skills\/|agents\/|references\/|templates\/|stages\/|\.\.\/|\.\/|\.claude\/(?:skills|agents)\/)/;

function resolver(tree, layout) {
  const pluginFiles = [...layout.skillRoots.flatMap((r) => tree.list(r)), ...tree.list(layout.agents)];
  const byName = new Map();
  for (const f of pluginFiles) byName.set(posix.basename(f), [...(byName.get(posix.basename(f)) ?? []), f]);
  const under = (p, dir) => p === dir || p.startsWith(`${dir}/`);
  const isPlugin = (p) => layout.skillRoots.some((r) => under(p, r)) || under(p, layout.agents);
  /** A file's skill roots, its own first; an agent definition's, build-guide's first. */
  const rootsFor = (file) => {
    const own = layout.skillRoots.find((r) => under(file, r));
    return own ? [own, ...layout.skillRoots.filter((r) => r !== own)] : layout.skillRoots;
  };
  const norm = (p) => {
    const n = posix.normalize(p);
    return n === '.' || n.startsWith('../') || n.startsWith('/') ? null : n.replace(/\/$/, '');
  };

  /** What a token in `file` names: {file} for a plugin file, {} for a plugin folder or no plugin name, {error}. */
  return function resolve(file, token) {
    const p = pathOf(token);
    if (!p) return {};
    if (!p.includes('/')) {
      const found = byName.get(p);
      if (!found) return {};
      const roots = rootsFor(file);
      const pick =
        found.find((f) => posix.dirname(f) === posix.dirname(file)) ??
        roots.map((r) => found.find((f) => under(f, r))).find(Boolean) ??
        found[0];
      return { file: pick };
    }
    const candidates = [];
    if (!p.startsWith('./') && !p.startsWith('../')) candidates.push(p);
    candidates.push(posix.join(posix.dirname(file), p));
    for (const r of rootsFor(file)) candidates.push(posix.join(r, p), posix.join(r, 'references', p));
    for (const c of candidates.map(norm).filter(Boolean)) {
      const kind = tree.exists(c);
      if (!kind) continue;
      if (!isPlugin(c)) return {};
      return kind === 'file' ? { file: c } : {};
    }
    return CLAIMS.test(p) ? { error: token } : {};
  };
}

// ---------------------------------------------------------------------------------------------------------------------
// The measure.

/** Each stage's words loaded and file list, in the new root-relative paths, and the names that didn't resolve. */
export function measure(tree) {
  const layout = layoutOf(tree);
  const resolve = resolver(tree, layout);
  const errors = [];
  const stages = {};
  const stageFiles = tree
    .list(layout.stages)
    .filter((f) => posix.dirname(f) === layout.stages && f.endsWith('.md') && posix.basename(f) !== 'README.md');
  for (const ref of stageFiles) {
    const stage = posix.basename(ref, '.md');
    const text = tree.read(ref);
    const title = text.split('\n').find((l) => l.startsWith('# ')) ?? '';
    // The agent types are the title's backticked type names (`build-guide-coordinator`, with or without `pob2:`).
    const types = [...title.matchAll(/`(?:pob2:)?([a-z][\w-]*)`/g)].map((m) => m[1]);
    if (!types.length) errors.push(`${layout.toNew(ref)}: its title names no agent type`);
    for (const type of types) {
      const def = `${layout.agents}/${type}.md`;
      if (tree.exists(def) !== 'file') {
        errors.push(`${layout.toNew(ref)}: cannot resolve the agent type \`${type}\``);
        continue;
      }
      const files = new Set([def, ref]);
      for (const source of [def, ref]) {
        for (const token of tokensOf(tree.read(source))) {
          const r = resolve(source, token);
          if (r.error) errors.push(`${layout.toNew(source)}: cannot resolve \`${r.error}\``);
          else if (r.file) files.add(r.file);
        }
      }
      const key = types.length > 1 ? `${stage}:${type.replace(/^build-guide-/, '')}` : stage;
      const list = [...files].map((f) => ({ f, n: layout.toNew(f) })).sort((a, b) => (a.n < b.n ? -1 : a.n > b.n ? 1 : 0));
      stages[key] = { words: list.reduce((sum, { f }) => sum + wordsOf(tree.read(f)), 0), files: list.map(({ n }) => n) };
    }
  }
  const sorted = Object.fromEntries(Object.keys(stages).sort().map((k) => [k, stages[k]]));
  return { stages: sorted, errors: [...new Set(errors)] };
}

/** A growth as `+n.n%`, one decimal, the sign always shown. */
function signed(growth) {
  const r = Math.round(growth * 1000) / 10;
  return `${r < 0 ? '-' : '+'}${Math.abs(r).toFixed(1)}%`;
}
/** A count's growth over its baseline, as `+n.n%`. */
export const percent = (words, baseline) => signed((words - baseline) / baseline);

/** The report's lines and the failures, each stage against its baseline entry. */
export function compare(current, baseline) {
  const lines = [];
  const failures = [];
  let max = null;
  for (const key of [...new Set([...Object.keys(current), ...Object.keys(baseline)])].sort()) {
    const cur = current[key];
    const base = baseline[key];
    if (!base) {
      failures.push(`${key}: no baseline entry`);
      continue;
    }
    if (!cur) {
      failures.push(`${key}: in the baseline, not in the tree`);
      continue;
    }
    const growth = (cur.words - base.words) / base.words;
    max = max === null ? growth : Math.max(max, growth);
    lines.push(`${key} ${cur.words} ${base.words} ${percent(cur.words, base.words)}`);
    const added = cur.files.filter((f) => !base.files.includes(f)).map((f) => `+${f}`);
    const removed = base.files.filter((f) => !cur.files.includes(f)).map((f) => `-${f}`);
    if (added.length || removed.length) lines.push(`  files: ${[...added, ...removed].join(' ')}`);
    // The bound is exact; the line's one decimal can read +5.0% for a count just over it, so the failure names the
    // largest count the bound allows.
    const allowed = Math.floor((base.words * (100 + BOUND_PERCENT)) / 100);
    if (cur.words > allowed) {
      const exact = `+${((100 * (cur.words - base.words)) / base.words).toFixed(2)}%`;
      failures.push(`${key}: ${cur.words} words, more than the ${allowed} the ${BOUND_PERCENT}% bound allows over its baseline's ${base.words} (${exact})`);
    }
  }
  if (max !== null) lines.push(`max ${signed(max)}`);
  return { lines, failures };
}

// ---------------------------------------------------------------------------------------------------------------------

function readBaseline(file) {
  let data;
  try {
    data = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (e) {
    throw new UsageError(`can't read the baseline ${file}: ${e.message}`);
  }
  for (const [key, v] of Object.entries(data)) {
    if (!v || !Number.isInteger(v.words) || v.words <= 0 || !Array.isArray(v.files)) {
      throw new UsageError(`the baseline's entry ${key} isn't {"words": n, "files": [...]}`);
    }
  }
  return data;
}

function parseArgs(argv) {
  const opts = { root: DEFAULT_ROOT, baseline: DEFAULT_BASELINE, at: null, json: false };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    const value = () => {
      if (i + 1 >= argv.length) throw new UsageError(`${a} needs a value`);
      return argv[++i];
    };
    if (a === '--root') opts.root = path.resolve(value());
    else if (a === '--baseline') opts.baseline = path.resolve(value());
    else if (a === '--at') opts.at = value();
    else if (a === '--json') opts.json = true;
    else throw new UsageError(`unknown argument ${a}`);
  }
  if (opts.at && !opts.json) throw new UsageError('--at measures a commit for a baseline: use it with --json');
  return opts;
}

function main(argv) {
  let opts;
  let result;
  try {
    opts = parseArgs(argv);
    result = measure(opts.at ? gitTree(opts.root, opts.at) : fsTree(opts.root));
  } catch (e) {
    if (!(e instanceof UsageError)) throw e;
    console.error(`[words-loaded] ${e.message}`);
    console.error('usage: node scripts/words-loaded.mjs [--root <dir>] [--baseline <file>] | [--root <dir>] [--at <commit>] --json');
    return 2;
  }
  for (const err of result.errors) console.error(`[words-loaded] ${err}`);
  if (opts.json) {
    if (result.errors.length) return 1;
    process.stdout.write(`${JSON.stringify(result.stages, null, 2)}\n`);
    return 0;
  }
  let baseline;
  try {
    baseline = readBaseline(opts.baseline);
  } catch (e) {
    console.error(`[words-loaded] ${e.message}`);
    return 2;
  }
  const { lines, failures } = compare(result.stages, baseline);
  process.stdout.write(lines.map((l) => `${l}\n`).join(''));
  for (const f of failures) console.error(`[words-loaded] ${f}`);
  return result.errors.length || failures.length ? 1 : 0;
}

/** Whether Node started this file, by its real path: through a symbolic link `argv[1]` is the link's path. */
function isMain() {
  if (!process.argv[1]) return false;
  try {
    return fs.realpathSync(process.argv[1]) === fs.realpathSync(fileURLToPath(import.meta.url));
  } catch {
    return false;
  }
}

if (isMain()) {
  process.exitCode = main(process.argv.slice(2));
}
