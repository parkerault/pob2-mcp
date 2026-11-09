#!/usr/bin/env node
// Running leagues (amendment 16 §3, D-507; C-59): the one rule every reader of the league digests takes.
//
//   node skills/game-knowledge/scripts/leagues.mjs [--at <instant>]
//
// **The rule.** A league is running from its start instant until its end instant, both UTC: it is running at `now` when
// `now` is at or after its start and, if an end is recorded, before its end. `now` is the machine's clock read as a UTC
// instant, not a local date. A digest records its league's instants in the `League:` sentence of its third line, which
// `league-digest.mjs` writes after the fetch date (Appendix A.1):
//
//   <Name> (<label>) on poe2db.tw, fetched <date>. League: from <YYYY-MM-DD HH:MM> UTC until <YYYY-MM-DD HH:MM> UTC. In-pin flags: …
//
// or `… until no end announced.` A digest with no `League:` sentence isn't running; its reader names it once.
//
// **`runningDigests(folders, now)`**: every digest (`<folder>/<name>.md`) in the folders whose league is running at
// `now`, the latest start first, then by name. The folders go in order, the committed one (`data/league/`) first: a
// digest whose file name an earlier folder holds is left out, so a committed digest replaces a user-side one of the same
// league (from amendment 16's M-30 the server's league folder joins `data/league/`).
//
// **The command** prints, for a runner that knows only the date, what `pob2-run-log`'s `init` and `resume` print after
// their first line: `digests: [<paths>]`, the running digests' paths as a JSON list, newest first (root-relative under
// the plugin root, absolute elsewhere), which the runner copies into a task header's `digests`; then each one's third
// line, newest first, or, with none, `No running league has a league digest: what is new in it isn't in the committed
// data.`; then `<path> records no league dates: re-run its digest script` for each undated digest. It reads
// `data/league/` under the plugin root. `--at <instant>` (`2026-12-11T19:59Z`, `2026-12-11 19:59`, read as UTC unless
// it names an offset) reads the rule at that instant instead of the clock.
//
// Exit 0: printed. Exit 2: usage error.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
/** The plugin root (scripts → game-knowledge → skills → root). */
export const ROOT = path.resolve(SCRIPT_DIR, '..', '..', '..');
/** The committed digests' folder. */
export const COMMITTED = path.join(ROOT, 'data', 'league');

const INSTANT = '(\\d{4}-\\d{2}-\\d{2} \\d{2}:\\d{2})';
/** The `League:` sentence (Appendix A.1): its start, and its end or none. */
export const LEAGUE_SENTENCE = new RegExp(`League: from ${INSTANT} UTC until (?:${INSTANT} UTC|no end announced)\\.`);
export const NONE_RUNNING = "No running league has a league digest: what is new in it isn't in the committed data.";
export const undatedLine = (p) => `${p} records no league dates: re-run its digest script`;

/** An instant, as milliseconds since the epoch, written `YYYY-MM-DD HH:MM` in UTC (Appendix A.1). */
export function formatInstant(ms) {
  return new Date(ms).toISOString().slice(0, 16).replace('T', ' ');
}

/** `YYYY-MM-DD HH:MM`, read as UTC, as milliseconds; NaN when it isn't one. */
const utc = (s) => Date.parse(`${s.replace(' ', 'T')}:00Z`);

/** The `League:` sentence for a start and an end (null: none announced), each in milliseconds. */
export function leagueSentence(start, end) {
  return `League: from ${formatInstant(start)} UTC until ${end === null ? 'no end announced' : `${formatInstant(end)} UTC`}.`;
}

/** A digest's league instants, from its third line: `{start, end}` in milliseconds (`end` null when none is announced), or null for no sentence. */
export function leagueDates(line) {
  const m = LEAGUE_SENTENCE.exec(line ?? '');
  if (!m) return null;
  const start = utc(m[1]);
  const end = m[2] === undefined ? null : utc(m[2]);
  if (!Number.isFinite(start) || (end !== null && !Number.isFinite(end))) return null;
  return { start, end };
}

/** Whether a league with these dates is running at `now` (milliseconds): from its start, until its end if one is recorded. */
export const isRunning = (dates, now) => dates !== null && now >= dates.start && (dates.end === null || now < dates.end);

/** `--at`'s instant, or a Date, or milliseconds, as milliseconds; NaN when it isn't one. A text with no offset is UTC. */
export function instantOf(value) {
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'number') return value;
  if (typeof value !== 'string') return NaN;
  const s = value.trim();
  const m = /^(\d{4}-\d{2}-\d{2})(?:[T ](\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?))?(Z|[+-]\d{2}:?\d{2})?$/i.exec(s);
  if (!m) return NaN;
  return Date.parse(`${m[1]}T${m[2] ?? '00:00'}${m[2] && m[2].length > 5 ? '' : ':00'}${m[3] ? m[3].toUpperCase() : 'Z'}`);
}

/** A file's third line, read from its first bytes only. */
function thirdLine(file) {
  let fd;
  try {
    fd = fs.openSync(file, 'r');
    const buf = Buffer.alloc(16384);
    const n = fs.readSync(fd, buf, 0, buf.length, 0);
    return buf.subarray(0, n).toString('utf8').split(/\r?\n/)[2] ?? '';
  } catch {
    return '';
  } finally {
    if (fd !== undefined) fs.closeSync(fd);
  }
}

/**
 * Every digest in the folders, in folder order, each `{name, path, folder, line, dates}` (`dates` null when its third
 * line has no `League:` sentence); a name an earlier folder holds is left out. A folder that can't be read holds none.
 */
export function leagueDigests(folders) {
  const out = [];
  const seen = new Set();
  for (const folder of folders) {
    let names;
    try {
      names = fs.readdirSync(folder).filter((f) => f.endsWith('.md')).sort();
    } catch {
      continue;
    }
    for (const name of names) {
      if (seen.has(name)) continue;
      seen.add(name);
      const p = path.join(folder, name);
      const line = thirdLine(p);
      out.push({ name, path: p, folder, line, dates: leagueDates(line) });
    }
  }
  return out;
}

/** D-507: the digests whose league is running at `now`, the latest start first, then by name (C-59). */
export function runningDigests(folders, now) {
  const at = instantOf(now);
  return leagueDigests(folders)
    .filter((d) => isRunning(d.dates, at))
    .sort((a, b) => (a.dates.start === b.dates.start ? (a.name < b.name ? -1 : a.name > b.name ? 1 : 0) : b.dates.start - a.dates.start));
}

/** A digest's path as a task header carries it: root-relative under the plugin root, absolute elsewhere. */
export function headerPath(p, root = ROOT) {
  const rel = path.relative(root, p);
  return rel && !rel.startsWith('..') && !path.isAbsolute(rel) ? rel.split(path.sep).join('/') : path.resolve(p);
}

/**
 * What a runner prints and copies (the command's output, and `pob2-run-log`'s after `init` and `resume`): the
 * `digests:` line, each running digest's third line or the none line, and each undated digest named once.
 */
export function report(folders, now, root = ROOT) {
  const running = runningDigests(folders, now);
  const undated = leagueDigests(folders).filter((d) => d.dates === null);
  return [
    `digests: ${JSON.stringify(running.map((d) => headerPath(d.path, root)))}`,
    ...(running.length > 0 ? running.map((d) => d.line) : [NONE_RUNNING]),
    ...undated.map((d) => undatedLine(headerPath(d.path, root))),
  ];
}

const USAGE = 'usage: node leagues.mjs [--at <instant>]';

export function main(argv, out = process.stdout, err = process.stderr) {
  const args = argv.slice(2);
  let now = Date.now();
  if (args.length > 0) {
    const at = args[0] === '--at' && args.length === 2 ? instantOf(args[1]) : NaN;
    if (!Number.isFinite(at)) {
      err.write(`leagues: ${args[0] === '--at' && args.length === 2 ? `"${args[1]}" isn't an instant (2026-12-11T19:59Z, or 2026-12-11 19:59 in UTC)` : 'the one option is --at <instant>'}\n${USAGE}\n`);
      return 2;
    }
    now = at;
  }
  out.write(`${report([COMMITTED], now).join('\n')}\n`);
  return 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = main(process.argv);
}
