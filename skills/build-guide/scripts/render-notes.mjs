#!/usr/bin/env node
// The build-guide PoB notes render (amendment 14, D-487; Appendix A's `notes.txt`).
//
//   pob2-render-notes <runFolder> --build <card id>
//   pob2-render-notes <runFolder>
//
// A piece run (amendment 16's M-30, D-516: its log's `piece`) keeps its one build at the folder's root, so the render
// takes it with no `--build`, as for schema 3; a file run's one build is `--build file`, beside the card ids.
//
// It writes a guide build's `notes.txt` in its folder (`builds/<id>/`, or "." for a migrated run's build): the build's
// `guide.md` as plain text for PoB's Notes tab, which shows the `<Notes>` element's text with PoB's colour codes
// (`Classes/NotesTab.lua`), so the runner writes it into the final PoB file with `compile_plan {plan_path, notes_path}`
// (C-41's notes mode). The runner runs it after step 14 writes the guide's known issues, on every cycle, a revision's
// included, and again for the campaign's full guide (D-487). A file-only build's notes are W1's (`scope: "notes"`), not
// this script's.
//
// The form (Appendix A):
//  - each heading (H1 to H6) one line in PoB's heading colour, `^xE0C080<heading>`, after a blank line;
//  - a table as "<first cell>: <the other cells>" lines, its header row and rule dropped;
//  - no markup: `**`, `__`, `*` emphasis, backticks, `>` quotes and `#` headings go; a link `[text](url)` reads
//    `text (url)`; an escaped pipe `\|` reads `/`, so no `|` is left;
//  - no import-code block: the first fenced block of "Your PoB file" is dropped (the code is the record's, with no
//    notes, D-487: a code holding the guide would be circular), and so is every fenced block of trade links (a line
//    holding a `/trade2/search/` URL): the links come from `trade-links.json` (D-488), under a last heading "Trade
//    links", each rung's slot on one line and its link alone on the next; another fenced block keeps its lines;
//  - blank lines collapsed to one.
//
// Node built-ins only. No network. Exit 0: notes.txt written (one line on stdout). Exit 1: an input is missing or
// unreadable (stderr). Exit 2: usage error.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/** Appendix A: PoB's colour code for a heading line in the notes (`^x` and six hex digits, `Classes/NotesTab.lua`). */
export const HEADING_COLOUR = '^xE0C080';
/** D-516: the pieces a piece run's log names (run-log.mjs's PIECES). */
const PIECES = ['compile', 'pricing', 'writer'];
/** The H2 whose first fenced block is the guide's import code (§8). */
const PRIMER_H2 = 'Your PoB file';
/** A weighted trade link's URL (`src/trade/links.ts`'s `tradeQueryUrl`). */
const TRADE_URL = /https?:\/\/\S*\/trade2\/search\/\S+/;
/** Each endgame rung's label, by the plan's `variant`. */
const RUNG_LABEL = { 'entering-maps': 'Entering maps', budget: 'Budget', 'non-budget': 'Non-budget' };

const isObj = (v) => typeof v === 'object' && v !== null && !Array.isArray(v);
const list = (v) => (Array.isArray(v) ? v.filter(isObj) : []);

/** A line of guide text with its inline markup gone: emphasis, code spans, links as "text (url)", escaped pipes. */
export function plainInline(text) {
  return String(text)
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, '$1 ($2)')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/__([^_]+)__/g, '$1')
    .replace(/(^|[^\w*])\*([^*\s][^*]*?)\*(?!\w)/g, '$1$2')
    .replace(/`+([^`]*)`+/g, '$1')
    .replace(/\\\|/g, '/')
    .replace(/\*\*/g, '')
    .replace(/\|/g, '/');
}

/** A table row's cells, its outer pipes dropped and its escaped pipes kept inside their cell. */
const cellsOf = (row) => row.trim().replace(/^\|/, '').replace(/\|$/, '').split(/(?<!\\)\|/).map((c) => plainInline(c.trim()));
const isRule = (row) => cellsOf(row).every((c) => /^:?-+:?$/.test(c.trim()));

/**
 * D-487 (Appendix A): `guide.md` as PoB notes text, with `links` (trade-links.json's `[{stage, slot, url, ids}]`) under a
 * last "Trade links" heading and `plan` naming each link's rung. Returns the text, ending in one newline.
 */
export function renderNotes(guideText, links = [], plan = null) {
  const lines = String(guideText ?? '').replace(/<!--[\s\S]*?-->/g, '').split(/\r?\n/);
  const out = [];
  const blank = () => {
    if (out.length > 0 && out[out.length - 1] !== '') out.push('');
  };
  let h2 = null;
  let primerFenceSeen = false;
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    const fence = /^\s*(```|~~~)/.exec(line);
    if (fence) {
      // A fenced block: the import code (the first under "Your PoB file") and the trade links go; another keeps its lines.
      const body = [];
      let j = i + 1;
      while (j < lines.length && !lines[j].trim().startsWith(fence[1])) {
        body.push(lines[j]);
        j += 1;
      }
      const importCode = h2 === PRIMER_H2 && !primerFenceSeen;
      if (h2 === PRIMER_H2) primerFenceSeen = true;
      if (!importCode && !body.some((l) => TRADE_URL.test(l))) for (const l of body) if (l.trim() !== '') out.push(plainInline(l.trim()));
      i = j;
      continue;
    }
    const h = /^(#{1,6})\s+(.*?)\s*#*\s*$/.exec(line);
    if (h) {
      if (h[1].length === 2) h2 = h[2].trim();
      blank();
      out.push(`${HEADING_COLOUR}${plainInline(h[2].trim())}`);
      continue;
    }
    if (line.trim().startsWith('|')) {
      // A table: its header row (the row before the rule) and its rule go; each body row "first: the rest".
      if (isRule(line)) continue;
      if (i + 1 < lines.length && lines[i + 1].trim().startsWith('|') && isRule(lines[i + 1])) continue;
      const cells = cellsOf(line).filter((c) => c !== '');
      if (cells.length > 0) out.push(cells.length === 1 ? cells[0] : `${cells[0]}: ${cells.slice(1).join(', ')}`);
      continue;
    }
    if (line.trim() === '') {
      blank();
      continue;
    }
    out.push(plainInline(line.replace(/^\s*>\s?/, '').replace(/\s+$/, '')));
  }
  const rungOf = (id) => {
    const st = list(plan?.stages).find((s) => s.id === id);
    return RUNG_LABEL[st?.variant] ?? `Stage ${id}`;
  };
  const rows = list(links).filter((l) => typeof l.url === 'string' && l.url.trim() !== '');
  if (rows.length > 0) {
    blank();
    out.push(`${HEADING_COLOUR}Trade links`, 'Copy the whole line into your browser.');
    for (const l of rows) out.push(`${rungOf(l.stage)}, ${plainInline(String(l.slot ?? 'slot'))}${l.ids === 'unchecked' ? ' (stat ids unchecked)' : ''}:`, l.url.trim());
  }
  while (out.length > 0 && out[out.length - 1] === '') out.pop();
  return `${out.join('\n')}\n`;
}

/**
 * Reads a build's guide.md, plan.json and trade-links.json (optional) and writes its notes.txt. Returns what it did;
 * throws an Error naming what is missing.
 */
export function writeNotes(runFolder, id) {
  let log;
  try {
    log = JSON.parse(fs.readFileSync(path.join(runFolder, 'run-log.json'), 'utf8'));
  } catch (e) {
    throw new Error(`run-log.json can't be read (${e.code ?? e.message})`);
  }
  // D-516: a piece run's one build is at its folder's root, taken with no --build; every other run names its build.
  const piece = PIECES.includes(log.piece);
  if (piece && id !== undefined) throw new Error(`a ${log.piece} run keeps its one build at the folder's root: pob2-render-notes <runFolder>, with no --build (D-516)`);
  if (!piece && id === undefined) throw new Error('a schema-4 run holds one folder per build: pob2-render-notes <runFolder> --build <card id> (D-412)');
  const entry = piece ? { folder: '.' } : list(log.builds).find((b) => b.id === id);
  if (!entry) throw new Error(`run-log.json has no build ${id}; builds[] holds ${list(log.builds).map((b) => b.id).join(', ') || 'none'}`);
  const folder = entry.folder === '.' ? '' : `${entry.folder}/`;
  const at = (rel) => path.join(runFolder, ...`${folder}${rel}`.split('/'));
  let guide;
  try {
    guide = fs.readFileSync(at('guide.md'), 'utf8');
  } catch {
    throw new Error(`${folder}guide.md is missing; a guide build's notes are its guide (a file-only build's are W1's, scope notes)`);
  }
  const json = (rel) => {
    try {
      return JSON.parse(fs.readFileSync(at(rel), 'utf8'));
    } catch (e) {
      if (e.code === 'ENOENT') return null;
      throw new Error(`${folder}${rel} isn't valid JSON: ${e.message}`);
    }
  };
  const links = json('trade-links.json');
  const text = renderNotes(guide, Array.isArray(links) ? links : [], json('plan.json'));
  fs.writeFileSync(at('notes.txt'), text);
  return `wrote ${folder}notes.txt (${text.length} characters) from ${folder}guide.md${links !== null ? ` and ${folder}trade-links.json` : ''}`;
}

/** D-516: whether the folder holds a piece run's log (its `piece`), whose one build is the folder's root; false when unreadable. */
function pieceRunAt(runFolder) {
  try {
    return PIECES.includes(JSON.parse(fs.readFileSync(path.join(runFolder, 'run-log.json'), 'utf8')).piece);
  } catch {
    return false;
  }
}

function main(argv) {
  const args = argv.slice(2);
  // D-516: only a piece run's root build takes no --build (any other run's is the usage error, as before); a file run's
  // one build is `file`.
  const root = args.length === 1 && !args[0].startsWith('--') && pieceRunAt(path.resolve(args[0]));
  if (!root && (args.length !== 3 || args[1] !== '--build' || !/^(?:r[1-9]\d*-[a-cgsx]-[1-9]\d*|file)$/.test(args[2]))) {
    process.stderr.write("usage: node render-notes.mjs <runFolder> --build <card id>, or <runFolder> alone for a piece run's root build (D-516)\n");
    return 2;
  }
  try {
    process.stdout.write(`render-notes: ${writeNotes(path.resolve(args[0]), root ? undefined : args[2])}\n`);
    return 0;
  } catch (e) {
    process.stderr.write(`render-notes: ${e.message}\n`);
    return 1;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = main(process.argv);
}
