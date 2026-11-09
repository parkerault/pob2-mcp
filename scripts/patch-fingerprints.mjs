#!/usr/bin/env node
// scripts/patch-fingerprints.mjs: the bridge patches' fingerprints (C-60, D-509, amendment 16 §5 and Appendix A.3).
//
// Each entry of the two patch modules, pob-api/API/ParseFixes.lua (data fixes) and pob-api/API/Patches.lua (function
// patches), lists the PoB code it relies on as fingerprints, in one of three forms:
//   { file, func, sha1 }      a function: from the line that is exactly `func` (its definition, at the file's top level)
//                             to the first later line that is exactly `end`, unindented;
//   { file, line, sha1 }      a data line: the line that starts with `line`;
//   { file, from, to, sha1 }  a block inside a long function: from the line that starts with `from` to the first later
//                             line that starts with `to`.
// `file` is relative to PoB's `src/`. A `line`, `from` or `to` text is matched after the line's leading whitespace, and
// each anchor (`func`, `line`, `from`) must occur exactly once in its file. `sha1` is PoB's manifest scheme
// (src/engine/pinCheck.ts `manifestSha1`) over the cut lines, each ended by a line break: CRLF line endings, so a
// checkout's own line endings don't matter.
//
// The static test (tests/static/patchFingerprints.test.ts) runs this on the pin; the upgrade script runs it on a new
// tree. A changed fingerprint means the patch's PoB code changed: re-check the patch, never retire it on that alone
// (amendment 16 §4, step 7).
//
// Usage: node scripts/patch-fingerprints.mjs [--src <PoB src dir>] [--repo <repository root>] [--json]
//   --src   the PoB checkout's src/ (default: <repo>/vendor/PathOfBuilding-PoE2/src)
//   --json  print the full result as JSON instead of one line per fingerprint
// Exit codes: 0 every fingerprint matches; 1 one or more differ, each named with its patch and file; 2 a module can't
// be read or an entry is malformed.
//
// Exports, for the upgrade script: MODULES, readEntries(text, module), cutFingerprint(src, fp), checkPatches(opts).

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/** The two patch modules, root-relative. */
export const MODULES = ['pob-api/API/ParseFixes.lua', 'pob-api/API/Patches.lua'];

const SCRIPT_REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** Lua source with its comments blanked (strings kept), so a commented-out field is never read. */
function stripComments(src) {
  let out = '';
  let i = 0;
  const n = src.length;
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
      out += src.slice(i, end).replace(/[^\n]/g, ' ');
      i = end;
    } else if (c === "'" || c === '"') {
      let j = i + 1;
      while (j < n && src[j] !== c && src[j] !== '\n') j += src[j] === '\\' ? 2 : 1;
      out += src.slice(i, j + 1);
      i = j + 1;
    } else if (c === '[' && longBracket(i) >= 0) {
      const level = longBracket(i);
      const close = `]${'='.repeat(level)}]`;
      const at = src.indexOf(close, i);
      const end = at < 0 ? n : at + close.length;
      out += src.slice(i, end);
      i = end;
    } else {
      out += c;
      i += 1;
    }
  }
  return out;
}

const ESCAPES = { n: '\n', t: '\t', r: '\r', '\\': '\\', "'": "'", '"': '"' };

/** A quoted Lua string literal's value. */
function unquote(lit) {
  return lit.slice(1, -1).replace(/\\(.)/g, (_, ch) => ESCAPES[ch] ?? ch);
}

const STRING = String.raw`'(?:[^'\\\n]|\\.)*'|"(?:[^"\\\n]|\\.)*"`;

/** A table constructor of string fields (`{ k = 'v', { … }, … }`) starting at `at` (its `{`): [value, end index]. */
function readTable(text, at, where) {
  const token = new RegExp(String.raw`\s*(?:(\{)|(\})|([,;])|([A-Za-z_]\w*)\s*=\s*|(${STRING}))`, 'y');
  let i = at + 1;
  const fields = {};
  const items = [];
  let key = null;
  for (;;) {
    token.lastIndex = i;
    const m = token.exec(text);
    if (!m) throw new Error(`${where}: expected a string field at offset ${i}`);
    i = token.lastIndex;
    if (m[1]) {
      const [value, end] = readTable(text, i - 1, where);
      if (key) fields[key] = value; else items.push(value);
      key = null;
      i = end;
    } else if (m[2]) {
      return [{ fields, items }, i];
    } else if (m[3]) {
      key = null;
    } else if (m[4]) {
      key = m[4];
    } else {
      const value = unquote(m[5]);
      if (key) fields[key] = value; else items.push(value);
      key = null;
    }
  }
}

/**
 * The entries of one patch module's text: [{module, pg, stub, fingerprints, test}]. An entry starts at its `pg = '…'`
 * field; its `stub = true`, `fingerprints = { … }` and `test = { … }` fields follow it (Appendix A.3's order).
 */
export function readEntries(text, module) {
  const code = stripComments(text);
  const field = new RegExp(String.raw`(?<![.\w])(?:pg\s*=\s*(${STRING})|stub\s*=\s*true\b|(fingerprints|test)\s*=\s*\{)`, 'g');
  const entries = [];
  let m;
  while ((m = field.exec(code)) !== null) {
    if (m[1]) {
      entries.push({ module, pg: unquote(m[1]), stub: false, fingerprints: null, test: null });
      continue;
    }
    const entry = entries[entries.length - 1];
    if (!entry) throw new Error(`${module}: a field before any \`pg = '…'\` at offset ${m.index}`);
    if (!m[2]) {
      entry.stub = true;
      continue;
    }
    const open = m.index + m[0].length - 1;
    const [table, end] = readTable(code, open, `${module} ${entry.pg} ${m[2]}`);
    field.lastIndex = end;
    if (m[2] === 'test') entry.test = table.fields;
    else entry.fingerprints = table.items.map((item) => (typeof item === 'string' ? { text: item } : item.fields));
  }
  return entries;
}

/** The form a fingerprint takes, or null when its fields fit none. */
function formOf(fp) {
  if (typeof fp.func === 'string') return 'function';
  if (typeof fp.line === 'string') return 'line';
  if (typeof fp.from === 'string' && typeof fp.to === 'string') return 'range';
  return null;
}

/** What the fingerprint names, for messages. */
function anchorOf(fp) {
  const form = formOf(fp);
  if (form === 'function') return fp.func;
  if (form === 'line') return `the line ${fp.line}`;
  if (form === 'range') return `the lines from ${fp.from} to ${fp.to}`;
  return 'an unknown form';
}

/** sha1 under PoB's manifest scheme of lines, each ended by CRLF (`manifestSha1` of the cut). */
function linesSha1(lines) {
  return crypto.createHash('sha1').update(lines.map((l) => `${l}\r\n`).join('')).digest('hex');
}

/**
 * Cut one fingerprint's lines from `<src>/<file>`: {form, at: [first, last] (1-based), sha1} or {form, problem}.
 */
export function cutFingerprint(src, fp) {
  const form = formOf(fp);
  if (!form || typeof fp.file !== 'string') return { form, problem: 'the fingerprint has no file, func, line or from and to' };
  let text;
  try {
    text = fs.readFileSync(path.join(src, fp.file), 'utf8');
  } catch {
    return { form, problem: `${fp.file} is missing` };
  }
  const lines = text.split(/\r\n|\r|\n/);
  if (lines.length > 0 && lines[lines.length - 1] === '') lines.pop();
  const starts = (l, t) => l.replace(/^\s+/, '').startsWith(t);
  const anchor = form === 'function' ? (l) => l.replace(/\s+$/, '') === fp.func : form === 'line' ? (l) => starts(l, fp.line) : (l) => starts(l, fp.from);
  const found = [];
  lines.forEach((l, i) => { if (anchor(l)) found.push(i); });
  if (found.length === 0) return { form, problem: `${anchorOf(fp)} is missing` };
  if (found.length > 1) return { form, problem: `${anchorOf(fp)} occurs ${found.length} times` };
  const first = found[0];
  let last = first;
  if (form !== 'line') {
    const closes = form === 'function' ? (l) => l.replace(/\s+$/, '') === 'end' : (l) => starts(l, fp.to);
    last = lines.findIndex((l, i) => i > first && closes(l));
    if (last < 0) return { form, problem: form === 'function' ? `${fp.func} has no unindented \`end\` after it` : `no line starts with ${fp.to} after ${fp.from}` };
  }
  return { form, at: [first + 1, last + 1], sha1: linesSha1(lines.slice(first, last + 1)) };
}

/**
 * Every entry of both modules, with each fingerprint checked against `src`. Returns {src, entries, failures}; each
 * failure is a message naming the patch, its module, the file and what changed.
 */
export function checkPatches({ repo = SCRIPT_REPO, src } = {}) {
  const pobSrc = src ?? path.join(repo, 'vendor', 'PathOfBuilding-PoE2', 'src');
  const entries = [];
  const failures = [];
  for (const module of MODULES) {
    for (const entry of readEntries(fs.readFileSync(path.join(repo, module), 'utf8'), module)) {
      const fingerprints = (entry.fingerprints ?? []).map((fp) => {
        const cut = cutFingerprint(pobSrc, fp);
        const problem = cut.problem ?? (cut.sha1 === fp.sha1 ? null : `the code changed (sha1 ${fp.sha1 || '(none)'} recorded, ${cut.sha1} here, lines ${cut.at[0]}-${cut.at[1]})`);
        if (problem) failures.push(`${entry.pg} (${module}): ${fp.file ?? '(no file)'}, ${anchorOf(fp)}: ${problem}`);
        return { ...fp, form: cut.form, at: cut.at ?? null, actual: cut.sha1 ?? null, ok: !problem, problem };
      });
      entries.push({ ...entry, fingerprints });
    }
  }
  return { src: pobSrc, entries, failures };
}

function main(argv) {
  const opts = {};
  let json = false;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--json') json = true;
    else if ((a === '--src' || a === '--repo') && argv[i + 1]) opts[a.slice(2)] = path.resolve(argv[++i]);
    else {
      process.stderr.write(`[patch-fingerprints] unknown argument: ${a}\nusage: node scripts/patch-fingerprints.mjs [--src <dir>] [--repo <dir>] [--json]\n`);
      return 2;
    }
  }
  let result;
  try {
    result = checkPatches(opts);
  } catch (err) {
    process.stderr.write(`[patch-fingerprints] ${err instanceof Error ? err.message : String(err)}\n`);
    return 2;
  }
  if (json) {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } else {
    for (const entry of result.entries) {
      for (const fp of entry.fingerprints) {
        process.stdout.write(`${fp.ok ? 'ok     ' : 'CHANGED'} ${entry.pg} ${fp.file}: ${anchorOf(fp)}${fp.actual ? ` (${fp.actual})` : ''}\n`);
      }
    }
    for (const f of result.failures) process.stdout.write(`${f}\n`);
  }
  return result.failures.length === 0 ? 0 : 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = main(process.argv.slice(2));
}
