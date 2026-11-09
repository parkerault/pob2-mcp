#!/usr/bin/env node
// scripts/pin-upgrade.mjs: the scripted part of CLAUDE.md's "Upgrading the PoB2 pin" (amendment 16 §4, D-508,
// Appendix A.4). It does the mechanical steps on this repository's working tree, commits nothing, and stops with a
// list of what needs judgment. Upgrading the pin stays the user's decision each time (HG-11): run it on a branch, after
// the user decides, never as a plugin user.
//
//   node scripts/pin-upgrade.mjs <tag>
//
// <tag> is a tag of pob-pin.json's repository named v<n>.<n>.<n>: a branch, a commit or any other ref is refused
// (a dev commit carries regressions; POB_ALLOW_UNPINNED stays the development escape). The staging folder,
// vendor/.pin-upgrade/<tag> (gitignored with vendor/), holds the new tree, every step's outputs and the report,
// pin-upgrade-report.json.
//
// It starts only from a tree whose upgrade files are as HEAD has them (GUARDED: pob-pin.json, the pin's literal test
// files, the patch modules and their retirement tests, data/league/), so a half-written upgrade is never read as the
// current pin; when a step fails, it prints the files it changed and how to restore them (`git checkout HEAD --
// <paths>`, then `mise run pob:fetch`).
//
// The steps, in order (each recorded in the report's `steps` with its result and elapsed time):
//   stage            pob:fetch makes sure vendor/ is the current pin; `pnpm build`; the tag's commit from
//                    `git ls-remote --tags`; scripts/fetch-pob.sh's tag-and-destination mode clones it into
//                    <stage>/pob; its manifest version (pinCheck's parseManifest) and HeadlessWrapper sha1
//                    (manifestSha1), from the compiled build/; the newest tree of each tree.
//   probe            scripts/pob-internals.lua on both trees (scripts/pob-internals.symbols.json): every symbol that
//                    is missing, changed type or changed body; and the current pin's rule-index candidates.
//   fingerprints     every bridge patch's fingerprints on the new tree (scripts/patch-fingerprints.mjs); the PoB files
//                    pob-api/API/Trade.lua and construct()'s check mirror, compared between the trees.
//   pin              pob-pin.json and the pin's literal values in the tests (PIN_LITERAL_FILES).
//   fetch            `mise run pob:fetch`: vendor/ becomes the new tree.
//   skillSlotMethod  SkillsTabClass:UpdateGlobalGemCountAssignments and PoB's skill-slot warning, still in the tree.
//   gate             mise.toml's test task (GATE_TASK), with Jest's JSON results, at nice 19. A patch retires only when
//                    its retirement test fails on its "bug still present" case: its entry and that case are removed
//                    and the failed suites re-run once. Any other failure of a retirement test is judgment; a golden
//                    test's failure lists each figure, old and new; any other failure is listed as it is.
//   rulesIndex       the new pin's candidates (written for the agents who rewrite changed entries, amendment 8 §3),
//                    the entries that differ from the old pin's, and `rules-index.mjs check --text` on them.
//   reflag           league-digest.mjs --reflag on each digest in data/league/, offline; a digest is written only
//                    when a flag or the pin's label changes.
// The probe and the candidates boot PoB: each runs with POB_DIRECTORY, XDG_STATE_HOME, TMPDIR and POB_GUIDES_DIRECTORY
// at temporary folders, the candidates from a temporary cwd, the probe from the tree's src/ (PoB loads its modules
// relative to it, as the engine's cwd is), never the repository root.
//
// Exit 0 when every step ran (the gate's failures listed as judgment); 1 when a step failed, the report naming it
// (`failed`) and the restore (`restore`); 2 a usage error, a ref that isn't a release tag or upgrade files that differ
// from HEAD (no report).

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { performance } from 'node:perf_hooks';
import { MODULES, readEntries, checkPatches } from './patch-fingerprints.mjs';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const VENDOR = path.join('vendor', 'PathOfBuilding-PoE2');

/** The steps, in the order they run. */
export const STEPS = ['stage', 'probe', 'fingerprints', 'pin', 'fetch', 'skillSlotMethod', 'gate', 'rulesIndex', 'reflag'];

/** A release tag: the only ref the upgrade takes (a proceed-on on the pattern, amendment 16 §4). */
export const RELEASE_TAG = /^v\d+\.\d+\.\d+$/;

/** mise.toml's `[tasks.test]` run list, which the gate step runs with Jest's JSON results (a static test keeps it equal). */
export const GATE_TASK = [
  'pnpm build',
  'pnpm test',
  'pnpm exec jest --runInBand --testPathIgnorePatterns /node_modules/ -- tests/integration/compilePlanNfr.test.ts tests/integration/tradeQueryNfr.test.ts',
];

/** The tests that state the pin's values as literals (amendment 16 §4, step 4). */
export const PIN_LITERAL_FILES = ['tests/unit/pobPin.test.ts', 'tests/integration/protocol.lua.test.ts'];

/** The bridge files that mirror PoB code, each listed for a re-read only when a file it mirrors changed. */
export const MIRRORS = [
  // `lines`: the mirrored range of Appendix A.4, always listed; the lines citing a changed file are added as `cited`.
  { file: 'pob-api/API/Trade.lua', lines: '640-669', mirrors: ['Classes/TradeQuery.lua', 'Classes/TradeQueryGenerator.lua', 'Classes/TradeQueryRequests.lua'] },
  { file: 'scripts/check-construct.lua', check: "pob-api/API/Util.lua's construct()", mirrors: ['Modules/Common.lua'] },
];

/** The skill-slot refresh's method (D-428) and PoB's warning, which the skill-slot tests find by its text. */
export const SKILL_SLOT_METHOD = { file: 'Classes/SkillsTab.lua', line: 'function SkillsTabClass:UpdateGlobalGemCountAssignments(' };
export const SKILL_SLOT_WARNING = { file: 'Modules/Build.lua', text: 'You have too many gem groups allocated' };

const COOKIE_VARS = ['POESESSID', 'POE_SESSION_ID'];
/** Never passed on: the cookie, and the switch that would skip the gate's engine tests. */
const DROPPED_VARS = [...COOKIE_VARS, 'POB_SKIP_ENGINE'];

class Usage extends Error {}

const rel = (p) => path.relative(REPO, p).split(path.sep).join('/');
const log = (msg) => process.stderr.write(`[pin-upgrade] ${msg}\n`);

/** The environment every child gets: this one, without the trade cookie and without POB_SKIP_ENGINE. */
function baseEnv(extra = {}) {
  const env = { ...process.env, ...extra };
  for (const k of DROPPED_VARS) delete env[k];
  return env;
}

/** Run a command; returns {status, stdout, stderr}. Throws when it can't start. */
function run(cmd, args, { cwd = REPO, env = baseEnv(), input = '', timeout = 0 } = {}) {
  log(`$ ${[cmd, ...args].join(' ')}${cwd !== REPO ? `   (cwd ${cwd})` : ''}`);
  const r = spawnSync(cmd, args, { cwd, env, input, encoding: 'utf8', maxBuffer: 512 * 1024 * 1024, timeout: timeout || undefined });
  if (r.error) throw new Error(`${cmd} could not run: ${r.error.message}`);
  return { status: r.status, stdout: r.stdout ?? '', stderr: r.stderr ?? '' };
}

function runOk(cmd, args, opts) {
  const r = run(cmd, args, opts);
  if (r.status !== 0) throw new Error(`${[cmd, ...args].join(' ')} exited ${r.status}: ${tail(r.stderr || r.stdout)}`);
  return r;
}

function tail(text, n = 8) {
  return stripAnsi(text).trim().split('\n').slice(-n).join('\n');
}

function stripAnsi(text) {
  // eslint-disable-next-line no-control-regex
  return String(text ?? '').replace(/\u001b\[[0-9;]*[A-Za-z]/g, '');
}

/** A short message: the first lines of a failure, colours removed. */
function brief(text, max = 400) {
  const t = stripAnsi(text).trim().split('\n').map((l) => l.trimEnd()).filter((l) => l.trim() !== '').slice(0, 6).join('\n');
  return t.length > max ? `${t.slice(0, max - 1)}…` : t;
}

/** An executable on PATH, or null. */
function onPath(name, env = process.env) {
  for (const dir of String(env.PATH ?? '').split(path.delimiter)) {
    if (!dir) continue;
    const p = path.join(dir, name);
    try {
      fs.accessSync(p, fs.constants.X_OK);
      if (fs.statSync(p).isFile()) return p;
    } catch {
      // not here
    }
  }
  return null;
}

/** luajit, from PATH or from mise (resolved with the normal environment: a temporary XDG_STATE_HOME hides mise's trust). */
let luajitPath = null;
function luajit() {
  if (luajitPath) return luajitPath;
  luajitPath = onPath('luajit');
  if (!luajitPath) {
    const r = runOk('mise', ['which', 'luajit']);
    luajitPath = r.stdout.trim();
  }
  if (!luajitPath) throw new Error('luajit not found (on PATH or through `mise which luajit`)');
  return luajitPath;
}

/** A temporary folder set for a step that boots PoB: its builds, state, guides and temp folders, none in the repository. */
function tempFolders(label) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), `pin-upgrade-${label}-`));
  const sub = (n) => {
    const p = path.join(dir, n);
    fs.mkdirSync(p);
    return p;
  };
  const env = { POB_DIRECTORY: sub('builds'), XDG_STATE_HOME: sub('state'), POB_GUIDES_DIRECTORY: sub('guides'), TMPDIR: sub('tmp') };
  return { dir, cwd: sub('cwd'), env, remove: () => fs.rmSync(dir, { recursive: true, force: true }) };
}

/** LUA_PATH and LUA_CPATH for a PoB tree's runtime, the bridge's list (src/pobLuaBridge.ts, childEnv). */
function luaEnv(tree) {
  const api = path.join(REPO, 'pob-api');
  const runtime = path.join(tree, 'runtime');
  const runtimeLua = path.join(runtime, 'lua');
  const rocks = path.join(os.homedir(), '.luarocks', 'lib', 'lua', '5.1');
  const ext = process.platform === 'win32' ? 'dll' : 'so';
  // Lua's search paths are ';'-separated on every OS; a trailing ';;' appends Lua's defaults.
  return {
    LUA_PATH: [path.join(api, '?.lua'), path.join(api, '?', 'init.lua'), path.join(runtimeLua, '?.lua'), path.join(runtimeLua, '?', 'init.lua'), ''].join(';') + ';',
    LUA_CPATH: [path.join(runtime, `?.${ext}`), path.join(rocks, `?.${ext}`), ''].join(';') + ';',
  };
}

// ------------------------------------------------------------------------------------------------------------
// The tag

/** The tags of a repository: name -> commit (an annotated tag's peeled commit). */
export function parseLsRemote(text) {
  const tags = new Map();
  const peeled = new Map();
  for (const line of text.split('\n')) {
    const m = /^([0-9a-f]{40})\trefs\/tags\/(.+?)(\^\{\})?$/.exec(line.trim());
    if (!m) continue;
    if (m[3]) peeled.set(m[2], m[1]);
    else tags.set(m[2], m[1]);
  }
  for (const [name, commit] of peeled) tags.set(name, commit);
  return tags;
}

// ------------------------------------------------------------------------------------------------------------
// The probe and the candidates: what differs

/** Each symbol whose probe result differs between the trees: [{symbol, change, old, new}]. */
export function diffProbe(oldOut, newOut, symbols) {
  const changes = [];
  const where = (r) => (r && r.file ? `${r.file}:${r.line}` : null);
  for (const symbol of symbols) {
    const o = oldOut.symbols?.[symbol] ?? { type: 'nil' };
    const n = newOut.symbols?.[symbol] ?? { type: 'nil' };
    const absent = (r) => r.type === 'nil' || r.type === 'error';
    if (absent(o)) continue; // not on the current pin either: nothing the bridge can rely on
    if (absent(n)) changes.push({ symbol, change: 'missing', old: where(o) ?? o.type });
    else if (o.type !== n.type) changes.push({ symbol, change: 'type', old: o.type, new: n.type });
    else if (o.type === 'function' && o.sha1 !== n.sha1) changes.push({ symbol, change: 'body', old: where(o), new: where(n) });
  }
  return changes;
}

/** The list's symbols, in order. */
export function symbolList(list) {
  return Object.values(list.groups ?? {}).flat();
}

/** A candidates dump's entries by kind and key, with PoB's raw item text left out (its variant lines' order varies). */
function candidateEntries(c) {
  const out = new Map();
  const put = (kind, key, entry) => {
    const { raw, ...rest } = entry ?? {};
    out.set(`${kind}\u0000${key}`, { kind, key, text: canonical(rest) });
  };
  for (const n of c.nodes ?? []) put('node', String(n.id), n);
  for (const n of c.keystones ?? []) put('keystone', String(n.id), n);
  for (const u of c.uniques ?? []) put('unique', `${u.name} (${u.base})`, u);
  for (const g of c.gems ?? []) put('gem', String(g.id ?? g.name), g);
  for (const name of c.legacyGems ?? []) put('legacyGem', name, {});
  for (const name of c.unobtainableUniques ?? []) put('unobtainableUnique', name, {});
  return out;
}

function canonical(v) {
  if (Array.isArray(v)) return `[${v.map(canonical).join(',')}]`;
  if (v && typeof v === 'object') return `{${Object.keys(v).sort().map((k) => `${JSON.stringify(k)}:${canonical(v[k])}`).join(',')}}`;
  return JSON.stringify(v);
}

/** The candidates that differ between two dumps: [{kind, key, change: added|removed|changed}]. */
export function diffCandidates(oldC, newC) {
  const a = candidateEntries(oldC);
  const b = candidateEntries(newC);
  const out = [];
  for (const [id, e] of b) {
    if (!a.has(id)) out.push({ kind: e.kind, key: e.key, change: 'added' });
    else if (a.get(id).text !== e.text) out.push({ kind: e.kind, key: e.key, change: 'changed' });
  }
  for (const [id, e] of a) if (!b.has(id)) out.push({ kind: e.kind, key: e.key, change: 'removed' });
  return out;
}

// ------------------------------------------------------------------------------------------------------------
// Retiring a patch: its entry and its retirement case

/** Lua text with string contents and comments blanked (newlines kept), so braces and fields are read from code only. */
function luaMask(src) {
  let out = '';
  let i = 0;
  const n = src.length;
  const blank = (s) => s.replace(/[^\n]/g, ' ');
  const longBracket = (at) => {
    const m = /^\[(=*)\[/.exec(src.slice(at, at + 64));
    return m ? m[1].length : -1;
  };
  while (i < n) {
    const c = src[i];
    if (c === '-' && src[i + 1] === '-') {
      const level = src[i + 2] === '[' ? longBracket(i + 2) : -1;
      let end;
      if (level >= 0) {
        const close = `]${'='.repeat(level)}]`;
        const at = src.indexOf(close, i + 2);
        end = at < 0 ? n : at + close.length;
      } else {
        const at = src.indexOf('\n', i);
        end = at < 0 ? n : at;
      }
      out += blank(src.slice(i, end));
      i = end;
    } else if (c === "'" || c === '"') {
      let j = i + 1;
      while (j < n && src[j] !== c && src[j] !== '\n') j += src[j] === '\\' ? 2 : 1;
      out += c + blank(src.slice(i + 1, j)) + (j < n ? src[j] : '');
      i = j + 1;
    } else if (c === '[' && longBracket(i) >= 0) {
      const level = longBracket(i);
      const close = `]${'='.repeat(level)}]`;
      const at = src.indexOf(close, i);
      const end = at < 0 ? n : at + close.length;
      out += blank(src.slice(i, end));
      i = end;
    } else {
      out += c;
      i += 1;
    }
  }
  return out;
}

function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const lineStart = (text, at) => text.lastIndexOf('\n', at - 1) + 1;
const lineEnd = (text, at) => {
  const e = text.indexOf('\n', at);
  return e < 0 ? text.length : e + 1;
};

/**
 * A patch module's text without the entry of `pg`: a `local <NAME> = { pg = … }` table (Patches.lua), with the comment
 * block and `local restore<NAME>` right above it and its name in the list (`M.PATCHES = { … }`); or an element of the
 * list (`M.FIXES = { { pg = … }, … }`, ParseFixes.lua). Throws when it can't find exactly one.
 */
export function removeLuaEntry(text, pg) {
  const mask = luaMask(text);
  const field = new RegExp(String.raw`(?<![.\w])pg\s*=\s*(['"])${escapeRe(pg)}\1`, 'g');
  // The pg literal's contents are blanked in the mask: find the field in the text at a position the mask keeps as code.
  const hits = [...text.matchAll(field)].filter((m) => mask.slice(m.index, m.index + 2) === 'pg');
  if (hits.length !== 1) throw new Error(`${hits.length} entries with pg = '${pg}'`);
  const at = hits[0].index;
  let depth = 0;
  let open = -1;
  for (let i = at; i >= 0; i--) {
    if (mask[i] === '}') depth += 1;
    else if (mask[i] === '{') {
      if (depth === 0) {
        open = i;
        break;
      }
      depth -= 1;
    }
  }
  if (open < 0) throw new Error(`no table encloses pg = '${pg}'`);
  depth = 0;
  let close = -1;
  for (let i = open; i < mask.length; i++) {
    if (mask[i] === '{') depth += 1;
    else if (mask[i] === '}') {
      depth -= 1;
      if (depth === 0) {
        close = i;
        break;
      }
    }
  }
  if (close < 0) throw new Error(`the entry of ${pg} has no closing brace`);
  const before = mask.slice(lineStart(mask, open), open);
  const named = /^\s*local\s+([A-Za-z_]\w*)\s*=\s*$/.exec(before);
  let from = lineStart(text, open);
  let to = lineEnd(text, close);
  if (to < text.length && text.slice(to, lineEnd(text, to)).trim() === ',') to = lineEnd(text, to);
  // The comment lines (and, for a named entry, its `local restore<NAME>`) right above it go with it.
  for (;;) {
    if (from === 0) break;
    const prevStart = lineStart(text, from - 1);
    const prev = text.slice(prevStart, from).trim();
    if (prev.startsWith('--') || (named && new RegExp(`^local\\s+restore${escapeRe(named[1])}\\s*$`).test(prev))) from = prevStart;
    else break;
  }
  let out = cut(text, from, to);
  if (named) {
    // Its name leaves the list of applied patches.
    const name = named[1];
    const list = /(M\.PATCHES\s*=\s*\{)([^}]*)(\})/.exec(luaMask(out));
    if (list) {
      const items = out.slice(list.index + list[1].length, list.index + list[0].length - 1).split(',').map((s) => s.trim()).filter((s) => s !== '' && s !== name);
      const replaced = items.length > 0 ? `${list[1]} ${items.join(', ')} }` : `${list[1]}}`;
      out = out.slice(0, list.index) + replaced + out.slice(list.index + list[0].length);
    }
  }
  if (readEntries(out, 'module').some((e) => e.pg === pg)) throw new Error(`${pg}'s entry is still read after its removal`);
  return out;
}

/** `text` without [from, to), one blank line left where two would meet (none before a closing line or the end). */
function cut(text, from, to) {
  let before = text.slice(0, from);
  const after = text.slice(to);
  while (before.endsWith('\n\n') && (after === '' || after.startsWith('\n') || /^[ \t]*[)}\]]/.test(after))) before = before.slice(0, -1);
  return before + after;
}

/** The test file's text without the case titled `title` (`it(` or `test(`, either quote style). Throws when not found. */
export function removeTestCase(text, title) {
  const literals = [
    `"${title.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`,
    `'${title.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`,
    `\`${title.replace(/\\/g, '\\\\').replace(/`/g, '\\`')}\``,
  ];
  const found = literals.flatMap((lit) => {
    const hits = [];
    for (let i = text.indexOf(lit); i >= 0; i = text.indexOf(lit, i + 1)) hits.push(i);
    return hits;
  });
  if (found.length !== 1) throw new Error(`${found.length} cases titled "${title}"`);
  const call = /\b(?:it|test)\s*\(\s*$/.exec(text.slice(0, found[0]));
  if (!call) throw new Error(`the title "${title}" isn't an it( or test( call's first argument`);
  const from = lineStart(text, call.index);
  const indent = /^[ \t]*/.exec(text.slice(from))[0];
  // The call ends at the first later line at the same indent that closes it (`);`, `});`, `}, TIMEOUT);`).
  const lines = text.slice(from).split('\n');
  let end = -1;
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    const sameIndent = l.startsWith(indent) && !/^[ \t]/.test(l.slice(indent.length));
    if (i === 0) {
      if (/\);\s*$/.test(l) && balanced(l)) {
        end = 0;
        break;
      }
      continue;
    }
    if (sameIndent && /^[)}]/.test(l.slice(indent.length)) && /\);\s*$/.test(l)) {
      end = i;
      break;
    }
  }
  if (end < 0) throw new Error(`the case "${title}" has no closing line at its indent`);
  const chunk = lines.slice(0, end + 1).join('\n');
  if (!balanced(chunk)) throw new Error(`the case "${title}" doesn't close where its indent says`);
  return cut(text, from, Math.min(from + chunk.length + 1, text.length));
}

/** Whether the parentheses and braces of a piece of TypeScript balance, strings, templates and comments skipped. */
function balanced(src) {
  let depth = 0;
  let i = 0;
  const n = src.length;
  while (i < n) {
    const c = src[i];
    if (c === '/' && src[i + 1] === '/') {
      const e = src.indexOf('\n', i);
      i = e < 0 ? n : e;
    } else if (c === '/' && src[i + 1] === '*') {
      const e = src.indexOf('*/', i + 2);
      i = e < 0 ? n : e + 2;
    } else if (c === "'" || c === '"' || c === '`') {
      let j = i + 1;
      while (j < n && src[j] !== c) j += src[j] === '\\' ? 2 : 1;
      i = j + 1;
    } else {
      if (c === '(' || c === '{' || c === '[') depth += 1;
      else if (c === ')' || c === '}' || c === ']') depth -= 1;
      if (depth < 0) return false;
      i += 1;
    }
  }
  return depth === 0;
}

// ------------------------------------------------------------------------------------------------------------
// The gate's results

/** Jest's JSON results as [{file (root-relative), status, message, tests: [{title, fullName, status, message}]}]. */
export function readJestResults(json) {
  return (json.testResults ?? []).map((s) => ({
    file: rel(path.resolve(REPO, s.name)),
    status: s.status,
    message: s.message ?? '',
    tests: (s.assertionResults ?? []).map((t) => ({
      title: t.title,
      fullName: t.fullName ?? [...(t.ancestorTitles ?? []), t.title].join(' '),
      status: t.status,
      message: (t.failureMessages ?? []).join('\n'),
      // An expect() failure carries its matcher's result; a thrown error or a failed hook doesn't (Jest 29).
      assertion: (t.failureDetails ?? []).some((d) => d !== null && typeof d === 'object' && 'matcherResult' in d),
    })),
  }));
}

/** The failures of a suite: its failed tests, or the suite itself when it failed to run. */
function failuresOf(suite) {
  const failed = suite.tests.filter((t) => t.status === 'failed');
  if (failed.length > 0) return failed;
  if (suite.status === 'failed') return [{ title: null, fullName: '(the suite)', status: 'failed', message: suite.message }];
  return [];
}

/** A golden test's figures from a toEqual diff of `stat=value` lines: [{stat, old, new}] (old is the recorded value). */
export function goldenFigures(message) {
  const old = new Map();
  const now = new Map();
  for (const line of stripAnsi(message).split('\n')) {
    const m = /^\s*([-+])\s+"([^"=]+)=([^"]*)",?\s*$/.exec(line);
    if (!m) continue;
    (m[1] === '-' ? old : now).set(m[2], m[3]);
  }
  const num = (v) => (v === undefined ? null : Number.isFinite(Number(v)) ? Number(v) : v);
  const stats = [...new Set([...old.keys(), ...now.keys()])];
  return stats.filter((s) => old.get(s) !== now.get(s)).map((stat) => ({ stat, old: num(old.get(stat)), new: num(now.get(stat)) }));
}

/**
 * The gate's failures sorted (amendment 16 §4, step 7): `retire`, the entries whose retirement case failed on its
 * assertion, the only failure in its test file; and the judgment items: a retirement test's other failures (an error, a hook that threw, a fixture that
 * won't load), its case when it neither passed nor failed (skipped, not run), a golden test's figures, any other
 * failure as it is.
 */
export function sortFailures(suites, entries) {
  const byFile = new Map();
  for (const e of entries) if (e.test?.file) byFile.set(e.test.file, [...(byFile.get(e.test.file) ?? []), e]);
  const retire = [];
  const judgment = [];
  for (const e of entries) {
    if (!e.test?.file || !e.test?.case) continue;
    const suite = suites.find((s) => s.file === e.test.file);
    const result = suite?.tests.find((t) => t.title === e.test.case);
    // A fix upstream fails this case alone, on its assertion; a hook's failed expect() fails every case of the file.
    if (result && result.status === 'failed' && result.assertion && failuresOf(suite).length === 1) retire.push(e);
    else if (!result || (result.status !== 'passed' && result.status !== 'failed')) {
      // A suite that failed to run is listed below, as itself.
      if (suite && suite.status === 'failed' && suite.tests.length === 0) continue;
      const status = result ? result.status : suite ? 'not in its suite' : 'not run';
      judgment.push({ kind: 'retirementTest', pg: e.pg, test: e.test.file, name: e.test.case, message: `the retirement case was ${status}, so it shows nothing: re-run it` });
    }
  }
  for (const suite of suites) {
    const owners = byFile.get(suite.file) ?? [];
    for (const f of failuresOf(suite)) {
      if (owners.some((e) => e.test.case === f.title && retire.includes(e))) continue;
      if (owners.length > 0) {
        judgment.push({ kind: 'retirementTest', pg: owners.map((e) => e.pg).join(', '), test: suite.file, name: f.fullName, message: brief(f.message) });
      } else if (/golden/i.test(path.basename(suite.file))) {
        const figures = goldenFigures(f.message);
        if (figures.length === 0) judgment.push({ kind: 'golden', test: suite.file, name: f.fullName, message: brief(f.message) });
        for (const g of figures) judgment.push({ kind: 'golden', test: suite.file, stat: g.stat, old: g.old, new: g.new });
      } else {
        judgment.push({ kind: 'test', test: suite.file, name: f.fullName, message: brief(f.message) });
      }
    }
  }
  return { retire, judgment };
}

// ------------------------------------------------------------------------------------------------------------
// The steps

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

/** A tree's newest passive tree (`TreeData/<n>_<n>/tree.json`), as the tree service takes it. */
function newestTree(src) {
  try {
    const versions = fs
      .readdirSync(path.join(src, 'TreeData'))
      .filter((v) => /^\d+_\d+$/.test(v) && fs.existsSync(path.join(src, 'TreeData', v, 'tree.json')))
      .sort((a, b) => {
        const [am, an] = a.split('_').map(Number);
        const [bm, bn] = b.split('_').map(Number);
        return am - bm || an - bn;
      });
    return versions.length > 0 ? versions[versions.length - 1] : null;
  } catch {
    return null;
  }
}

/** The tree version scripts/check-construct.lua names, its one code literal. */
function constructTreeLiteral() {
  const text = fs.readFileSync(path.join(REPO, 'scripts', 'check-construct.lua'), 'utf8');
  return /construct,\s*'PassiveSpec',\s*build,\s*'([^']+)'/.exec(text)?.[1] ?? null;
}

function fileBytes(p) {
  try {
    return fs.readFileSync(p);
  } catch {
    return null;
  }
}

/** One gate command (a GATE_TASK line) with Jest's JSON results written to `outputFile`. */
export function gateCommand(line, outputFile) {
  const words = line.split(' ');
  const jest = words[0] === 'pnpm' && (words[1] === 'test' || (words[1] === 'exec' && words[2] === 'jest'));
  if (!jest) return { args: words, outputFile: null };
  const args = words[1] === 'test' ? ['pnpm', 'exec', 'jest', ...words.slice(2)] : [...words];
  const sep = args.indexOf('--');
  const json = ['--json', `--outputFile=${outputFile}`];
  if (sep < 0) args.push(...json);
  else args.splice(sep, 0, ...json);
  return { args, outputFile };
}

function gitStatus(paths = []) {
  const r = spawnSync('git', ['status', '--porcelain', '--untracked-files=all', '--', ...paths], { cwd: REPO, env: baseEnv(), encoding: 'utf8' });
  return r.status === 0 ? r.stdout.split('\n').filter(Boolean) : null;
}

/** The files an upgrade writes, root-relative: they must be as HEAD has them before it starts. */
export function guardedPaths() {
  const tests = MODULES.flatMap((m) => {
    try {
      return readEntries(fs.readFileSync(path.join(REPO, m), 'utf8'), m).map((e) => e.test?.file).filter(Boolean);
    } catch {
      return [];
    }
  });
  return [...new Set(['pob-pin.json', ...PIN_LITERAL_FILES, ...MODULES, ...tests, 'data/league/'])];
}

/** The guarded files that differ from HEAD (`git status --porcelain` lines), or null outside a git checkout. */
function changedGuarded(paths) {
  return gitStatus(paths);
}

/** How to put the guarded files and vendor/ back as HEAD has them. */
function restoreOf(lines) {
  const paths = lines.map((l) => l.slice(3));
  const tracked = lines.filter((l) => !l.startsWith('??')).map((l) => l.slice(3));
  const untracked = lines.filter((l) => l.startsWith('??')).map((l) => l.slice(3));
  const commands = [];
  if (tracked.length > 0) commands.push(`git checkout HEAD -- ${tracked.join(' ')}`);
  if (untracked.length > 0) commands.push(`rm -r -- ${untracked.join(' ')}`);
  commands.push('mise run pob:fetch');
  return { paths, commands };
}

export async function pinUpgrade(tag) {
  const started = performance.now();
  const stage = path.join(REPO, 'vendor', '.pin-upgrade', tag);
  const guarded = guardedPaths();
  const pinFile = path.join(REPO, 'pob-pin.json');
  const pin = readJson(pinFile);
  const report = {
    from: { tag: pin.tag, commit: pin.commit },
    to: { tag, commit: null, version: null },
    done: [],
    judgment: [],
    retired: [],
    failed: null,
    steps: {},
    elapsedMs: null,
    stage,
    treeBefore: gitStatus(),
    treeAfter: null,
  };
  const ctx = { tag, stage, pin, report, pob: path.join(stage, 'pob'), vendor: path.join(REPO, VENDOR) };

  const steps = {
    // 1. The new tree, staged; its version and wrapper sha1.
    async stage() {
      runOk('mise', ['run', 'pob:fetch']);
      runOk('mise', ['exec', '--', 'pnpm', 'build']);
      const { parseManifest, manifestSha1 } = await import(pathToFileURL(path.join(REPO, 'build', 'engine', 'pinCheck.js')).href);
      if (typeof parseManifest !== 'function' || typeof manifestSha1 !== 'function') throw new Error('build/engine/pinCheck.js exports no parseManifest or manifestSha1');
      const tags = parseLsRemote(runOk('git', ['ls-remote', '--tags', pin.repo], { env: baseEnv({ GIT_TERMINAL_PROMPT: '0' }) }).stdout);
      const commit = tags.get(tag);
      if (!commit) throw new Error(`${tag} isn't a tag of ${pin.repo} (a branch or another ref isn't taken: tagged releases only)`);
      fs.rmSync(stage, { recursive: true, force: true });
      fs.mkdirSync(stage, { recursive: true });
      runOk('bash', [path.join(REPO, 'scripts', 'fetch-pob.sh'), tag, commit, ctx.pob], { env: baseEnv({ GIT_TERMINAL_PROMPT: '0' }) });
      const manifest = parseManifest(fs.readFileSync(path.join(ctx.pob, 'manifest.xml'), 'utf8'));
      if (!manifest.version) throw new Error(`${tag}'s manifest.xml has no <Version number>`);
      const wrapperSha1 = manifestSha1(fs.readFileSync(path.join(ctx.pob, 'src', 'HeadlessWrapper.lua')));
      Object.assign(report.to, { commit, version: manifest.version });
      ctx.newPin = { ...pin, tag, commit, version: manifest.version, headlessWrapperSha1: wrapperSha1 };
      const trees = { old: newestTree(path.join(ctx.vendor, 'src')), new: newestTree(path.join(ctx.pob, 'src')), literal: constructTreeLiteral() };
      if (trees.new !== trees.literal || trees.new !== trees.old) report.judgment.push({ kind: 'treeVersion', old: trees.old, new: trees.new, literal: 'scripts/check-construct.lua' });
      return { tree: rel(ctx.pob), commit, version: manifest.version, headlessWrapperSha1: wrapperSha1, treeVersion: trees };
    },

    // 2. The internals probe on both trees; the current pin's candidates, before the fetch replaces its tree.
    async probe() {
      const list = readJson(path.join(REPO, 'scripts', 'pob-internals.symbols.json'));
      const symbols = symbolList(list);
      const build = path.join(REPO, list.build);
      const probeTree = (tree, out) => {
        const t = tempFolders('probe');
        try {
          runOk(luajit(), [path.join(REPO, 'scripts', 'pob-internals.lua'), path.join(REPO, 'scripts', 'pob-internals.symbols.json'), out, build], {
            cwd: path.join(tree, 'src'),
            env: baseEnv({ ...t.env, ...luaEnv(tree) }),
            timeout: 600000,
          });
          return readJson(out);
        } finally {
          t.remove();
        }
      };
      const oldOut = probeTree(ctx.vendor, path.join(stage, 'probe-old.json'));
      const newOut = probeTree(ctx.pob, path.join(stage, 'probe-new.json'));
      const changes = diffProbe(oldOut, newOut, symbols);
      for (const c of changes) report.judgment.push({ kind: 'symbol', ...c });
      ctx.oldCandidates = candidates(path.join(stage, 'candidates-old.json'));
      return { symbols: symbols.length, changed: changes.length, old: rel(path.join(stage, 'probe-old.json')), new: rel(path.join(stage, 'probe-new.json')), oldCandidates: rel(path.join(stage, 'candidates-old.json')) };
    },

    // 3. Every bridge patch's fingerprints on the new tree; the mirrored PoB files.
    async fingerprints() {
      const result = checkPatches({ repo: REPO, src: path.join(ctx.pob, 'src') });
      let changed = 0;
      for (const entry of result.entries) {
        for (const fp of entry.fingerprints) {
          if (fp.ok) continue;
          changed += 1;
          const anchor = fp.func ? { func: fp.func } : fp.line ? { line: fp.line } : { from: fp.from, to: fp.to };
          report.judgment.push({ kind: 'fingerprint', pg: entry.pg, file: fp.file, ...anchor, problem: fp.problem });
        }
      }
      const mirrored = [];
      for (const m of MIRRORS) {
        const differ = m.mirrors.filter((f) => {
          const a = fileBytes(path.join(ctx.vendor, 'src', f));
          const b = fileBytes(path.join(ctx.pob, 'src', f));
          return a === null || b === null || !a.equals(b);
        });
        if (differ.length === 0) continue;
        mirrored.push(m.file);
        const item = { kind: 'reread', file: m.file };
        if (m.check) {
          item.check = m.check;
          item.run = 'cd vendor/PathOfBuilding-PoE2/src && luajit ../../../scripts/check-construct.lua';
        } else {
          const text = fs.readFileSync(path.join(REPO, m.file), 'utf8').split('\n');
          const cited = text.flatMap((l, i) => (differ.some((f) => l.includes(`${path.basename(f)}:`)) ? [i + 1] : []));
          item.lines = m.lines;
          item.cited = cited.join(', ');
        }
        item.mirrors = differ;
        report.judgment.push(item);
      }
      return { patches: result.entries.length, fingerprints: result.entries.reduce((n, e) => n + e.fingerprints.length, 0), changed, reread: mirrored };
    },

    // 4. pob-pin.json and the tests' literal values.
    async pin() {
      const next = ctx.newPin;
      const text = `${JSON.stringify(next, null, 2)}\n`;
      const wrote = [];
      if (fs.readFileSync(pinFile, 'utf8') !== text) {
        fs.writeFileSync(pinFile, text);
        wrote.push('pob-pin.json');
      }
      const literals = {};
      for (const f of PIN_LITERAL_FILES) {
        const p = path.join(REPO, f);
        if (!fs.existsSync(p)) continue;
        const before = fs.readFileSync(p, 'utf8');
        const { text: after, count } = rewriteLiterals(before, pin, next);
        literals[f] = count;
        if (after !== before) {
          fs.writeFileSync(p, after);
          wrote.push(f);
        }
      }
      return { wrote, literals };
    },

    // 5. vendor/ becomes the new tree.
    async fetch() {
      runOk('mise', ['run', 'pob:fetch']);
      const head = runOk('git', ['-C', ctx.vendor, 'rev-parse', 'HEAD']).stdout.trim();
      if (head !== ctx.newPin.commit) throw new Error(`vendor/ is at ${head} after the fetch, not ${ctx.newPin.commit}`);
      return { head };
    },

    // 6. The skill-slot refresh's method and PoB's warning text.
    async skillSlotMethod() {
      const read = (f) => fileBytes(path.join(ctx.vendor, 'src', f))?.toString('utf8') ?? '';
      const method = read(SKILL_SLOT_METHOD.file).split(/\r?\n/).some((l) => l.startsWith(SKILL_SLOT_METHOD.line));
      const warning = read(SKILL_SLOT_WARNING.file).includes(SKILL_SLOT_WARNING.text);
      if (!method) report.judgment.push({ kind: 'skillSlotMethod', file: SKILL_SLOT_METHOD.file, method: 'SkillsTabClass:UpdateGlobalGemCountAssignments', used: 'pob-api/API/BuildOps.lua get_main_output (D-428)' });
      if (!warning) report.judgment.push({ kind: 'skillSlotWarning', file: SKILL_SLOT_WARNING.file, text: SKILL_SLOT_WARNING.text, used: 'tests/integration/skillSlots.test.ts, tests/unit/v1SkillSlots.test.ts' });
      return { method, warning };
    },

    // 7. The gate, its failures sorted; retirement; the failed suites re-run once.
    async gate() {
      const entries = MODULES.flatMap((m) => readEntries(fs.readFileSync(path.join(REPO, m), 'utf8'), m));
      const gateRun = (lines, label) => {
        const suites = [];
        let n = 0;
        for (const line of lines) {
          n += 1;
          const out = path.join(stage, `gate-${label}-${n}.json`);
          fs.rmSync(out, { force: true });
          const cmd = gateCommand(line, out);
          const r = run('nice', ['-n', '19', 'mise', 'exec', '--', ...cmd.args]);
          if (!cmd.outputFile) {
            if (r.status !== 0) return { suites, build: brief(`${r.stdout}\n${r.stderr}`, 1200) };
            continue;
          }
          if (!fs.existsSync(out)) throw new Error(`${line} wrote no results (exit ${r.status}): ${tail(r.stderr)}`);
          suites.push(...readJestResults(readJson(out)));
        }
        return { suites, build: null };
      };
      const first = gateRun(GATE_TASK, 'run');
      const counts = (suites) => ({
        suites: suites.length,
        tests: suites.reduce((k, s) => k + s.tests.length, 0),
        failed: suites.reduce((k, s) => k + failuresOf(s).length, 0),
      });
      if (first.build) {
        report.judgment.push({ kind: 'build', message: first.build });
        return { first: counts(first.suites), build: 'failed' };
      }
      let { retire, judgment } = sortFailures(first.suites, entries);
      const result = { first: counts(first.suites), retired: [], rerun: null };
      // Each retirement is all or nothing: both texts are made before either file is written, and one the script can't
      // cut is left to judgment, its files untouched.
      const byHand = [];
      for (const e of retire) {
        const modulePath = path.join(REPO, e.module);
        const testPath = path.join(REPO, e.test.file);
        let moduleText;
        let testText;
        try {
          moduleText = removeLuaEntry(fs.readFileSync(modulePath, 'utf8'), e.pg);
          testText = removeTestCase(fs.readFileSync(testPath, 'utf8'), e.test.case);
        } catch (err) {
          byHand.push(e);
          report.judgment.push({ kind: 'retireByHand', pg: e.pg, test: e.test.file, error: err instanceof Error ? err.message : String(err) });
          continue;
        }
        fs.writeFileSync(modulePath, moduleText);
        fs.writeFileSync(testPath, testText);
        const removed = [`${e.module} entry`, `${e.test.file}: its retirement test`];
        report.retired.push({ pg: e.pg, removed });
        report.judgment.push({ kind: 'retired', pg: e.pg, removed, left: 'its pob-gaps.md entry, the test file\'s other cases and the helpers the entry used' });
        result.retired.push(e.pg);
      }
      retire = retire.filter((e) => !byHand.includes(e));
      if (retire.length > 0) {
        const failedFiles = first.suites.filter((s) => failuresOf(s).length > 0).map((s) => s.file);
        const again = gateRun([`pnpm exec jest --testPathIgnorePatterns /node_modules/ -- ${failedFiles.join(' ')}`], 'rerun');
        const rerunFiles = new Set(again.suites.map((s) => s.file));
        // The re-run's results replace the first run's for the suites it ran; a suite it didn't run keeps its own.
        const merged = [...first.suites.filter((s) => !rerunFiles.has(s.file)), ...again.suites];
        ({ judgment } = sortFailures(merged, entries.filter((e) => !retire.includes(e)).concat(retire.map((e) => ({ ...e, test: { file: e.test.file, case: null } })))));
        result.rerun = { files: failedFiles, ...counts(again.suites) };
      }
      report.judgment.push(...judgment);
      result.judgment = judgment.length;
      return result;
    },

    // 8. The rule-changer index: the new pin's candidates, what differs from the old pin's, the check on them.
    async rulesIndex() {
      const file = path.join(stage, 'candidates.json');
      const now = candidates(file);
      const changed = diffCandidates(ctx.oldCandidates, now);
      const changedFile = path.join(stage, 'candidates-changed.json');
      fs.writeFileSync(changedFile, `${JSON.stringify(changed, null, 1)}\n`);
      const t = tempFolders('check');
      let problems;
      try {
        const r = run(process.execPath, [path.join(REPO, 'skills', 'game-knowledge', 'scripts', 'rules-index.mjs'), 'check', '--text', file], { cwd: t.cwd, env: baseEnv(t.env) });
        if (r.status !== 0 && r.status !== 1) throw new Error(`rules-index check exited ${r.status}: ${tail(r.stderr)}`);
        problems = r.stdout.split('\n').filter((l) => l.trim() !== '' && !l.startsWith('rules-index check:'));
      } finally {
        t.remove();
      }
      if (changed.length > 0 || problems.length > 0) {
        report.judgment.push({ kind: 'rulesIndex', candidates: rel(file), changed: changed.length, changedList: rel(changedFile), checkProblems: problems.length, firstProblems: problems.slice(0, 5) });
      }
      return { candidates: rel(file), changed: changed.length, checkProblems: problems.length };
    },

    // 9. The digests' in-pin flags, offline.
    async reflag() {
      const dir = path.join(REPO, 'data', 'league');
      const digests = fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => f.endsWith('.md')).sort() : [];
      const t = tempFolders('reflag');
      const out = {};
      try {
        for (const d of digests) {
          const file = path.join(dir, d);
          const before = fs.readFileSync(file, 'utf8');
          runOk(process.execPath, [path.join(REPO, 'skills', 'game-knowledge', 'scripts', 'league-digest.mjs'), '--reflag', d.replace(/\.md$/, '')], { cwd: t.cwd, env: baseEnv(t.env) });
          const after = fs.readFileSync(file, 'utf8');
          const flags = (text) => text.split('\n').filter((l) => l.startsWith('- In pin: '));
          const a = flags(before);
          const b = flags(after);
          const changed = b.filter((l, i) => l !== a[i]).length;
          out[d] = { written: after !== before, changed };
          if (changed > 0) report.judgment.push({ kind: 'digestFlags', digest: d, changed });
        }
      } finally {
        t.remove();
      }
      return { digests: out };
    },
  };

  /** The current pin's (or, after the fetch, the new pin's) rule-index candidates, written to `file`. */
  function candidates(file) {
    const t = tempFolders('candidates');
    try {
      const lj = luajit();
      const env = baseEnv({ ...t.env, PATH: `${path.dirname(lj)}${path.delimiter}${process.env.PATH ?? ''}` });
      const r = runOk(process.execPath, [path.join(REPO, 'skills', 'game-knowledge', 'scripts', 'rules-index.mjs'), 'candidates', '--json'], { cwd: t.cwd, env, timeout: 600000 });
      fs.writeFileSync(file, r.stdout);
      return JSON.parse(r.stdout);
    } finally {
      t.remove();
    }
  }

  for (const name of STEPS) {
    const t0 = performance.now();
    log(`step ${name}`);
    try {
      const result = await steps[name]();
      report.steps[name] = { ok: true, elapsedMs: Math.round(performance.now() - t0), ...result };
      report.done.push(name);
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      report.steps[name] = { ok: false, elapsedMs: Math.round(performance.now() - t0), error };
      report.failed = { step: name, error };
      break;
    }
  }
  report.elapsedMs = Math.round(performance.now() - started);
  report.treeAfter = gitStatus();
  // A failed run leaves what it wrote: name it and how to restore it, so a re-run never starts from it.
  if (report.failed) {
    report.restore = restoreOf(changedGuarded(guarded) ?? []);
    // vendor/ changes only from the fetch step on; before it, with no file changed, there is nothing to restore.
    if (report.restore.paths.length === 0 && STEPS.indexOf(report.failed.step) < STEPS.indexOf('fetch')) report.restore.commands = [];
  }
  fs.mkdirSync(stage, { recursive: true });
  const reportFile = path.join(stage, 'pin-upgrade-report.json');
  fs.writeFileSync(reportFile, `${JSON.stringify(report, null, 2)}\n`);
  return { report, reportFile };
}

/** A test file's text with the old pin's literal values replaced by the new pin's: {text, count}. */
export function rewriteLiterals(text, from, to) {
  let count = 0;
  let out = text;
  for (const key of ['tag', 'commit', 'headlessWrapperSha1', 'version']) {
    const a = from[key];
    const b = to[key];
    if (!a || !b || a === b) continue;
    out = out.replace(new RegExp(`(['"\`])${escapeRe(a)}\\1`, 'g'), (_, q) => {
      count += 1;
      return `${q}${b}${q}`;
    });
  }
  const a7 = from.headlessWrapperSha1?.slice(0, 7);
  const b7 = to.headlessWrapperSha1?.slice(0, 7);
  if (a7 && b7 && a7 !== b7) {
    out = out.replace(new RegExp(`${escapeRe(a7)}…`, 'g'), () => {
      count += 1;
      return `${b7}…`;
    });
  }
  return { text: out, count };
}

function describe(item) {
  const { kind, ...rest } = item;
  return `${kind}: ${Object.entries(rest).map(([k, v]) => `${k} ${typeof v === 'string' ? v.split('\n')[0] : JSON.stringify(v)}`).join('; ')}`;
}

function summary(report, reportFile) {
  const out = [];
  const short = (c) => (c ? c.slice(0, 7) : '?');
  out.push(`pin-upgrade: ${report.from.tag} (${short(report.from.commit)}) to ${report.to.tag} (${short(report.to.commit)}), version ${report.to.version ?? '?'}`);
  for (const name of STEPS) {
    const s = report.steps[name];
    if (!s) {
      out.push(`  ${name.padEnd(16)} not run`);
      continue;
    }
    const { ok, elapsedMs, error, ...rest } = s;
    const detail = ok ? JSON.stringify(rest) : `FAILED: ${error}`;
    out.push(`  ${name.padEnd(16)} ${ok ? 'ok    ' : 'failed'} ${(elapsedMs / 1000).toFixed(1).padStart(7)} s  ${detail.length > 300 ? `${detail.slice(0, 299)}…` : detail}`);
  }
  out.push(report.judgment.length === 0 ? 'Judgment: none.' : `Judgment (${report.judgment.length}):`);
  for (const j of report.judgment) out.push(`  - ${describe(j)}`);
  if (report.retired.length > 0) out.push(`Retired: ${report.retired.map((r) => r.pg).join(', ')}.`);
  out.push(`Elapsed: ${(report.elapsedMs / 1000).toFixed(1)} s${report.steps.gate ? ` (the gate ${(report.steps.gate.elapsedMs / 1000).toFixed(1)} s)` : ''}.`);
  out.push(`Report: ${reportFile}`);
  if (report.failed) {
    out.push(`Stopped at ${report.failed.step}: ${report.failed.error}`);
    const r = report.restore;
    out.push(r.paths.length > 0 ? `Changed since HEAD: ${r.paths.join(', ')}.` : 'No upgrade file changed.');
    out.push(r.commands.length > 0 ? `To restore: ${r.commands.join(', then ')}.` : 'Nothing to restore.');
  }
  return `${out.join('\n')}\n`;
}

function parseArgs(argv) {
  let tag = null;
  for (const a of argv) {
    if (a.startsWith('-')) throw new Usage(`unknown option ${a}`);
    else if (tag === null) tag = a;
    else throw new Usage(`one tag only, not "${a}"`);
  }
  if (!tag) throw new Usage('a tag is required');
  if (!RELEASE_TAG.test(tag)) throw new Usage(`"${tag}" isn't a release tag (v<n>.<n>.<n>): the upgrade takes tagged releases only, never a branch or a commit (D-508)`);
  // A half-written upgrade (a run that failed after the pin step) would be read as the current pin: start only from
  // the files HEAD has.
  const changed = changedGuarded(guardedPaths());
  if (changed === null) throw new Usage(`${REPO} isn't a git checkout: the upgrade starts only from files HEAD has`);
  if (changed.length > 0) {
    const r = restoreOf(changed);
    throw new Usage(`the upgrade files differ from HEAD (${r.paths.join(', ')}): commit or restore them first (${r.commands.join(', then ')})`);
  }
  return { tag };
}

export async function main(argv) {
  let opts;
  try {
    opts = parseArgs(argv);
  } catch (e) {
    if (!(e instanceof Usage)) throw e;
    process.stderr.write(`pin-upgrade: refused: ${e.message}\nusage: node scripts/pin-upgrade.mjs <v<n>.<n>.<n>>\n`);
    return 2;
  }
  const { report, reportFile } = await pinUpgrade(opts.tag);
  process.stdout.write(summary(report, reportFile));
  return report.failed ? 1 : 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = await main(process.argv.slice(2));
}
