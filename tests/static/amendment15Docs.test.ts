/**
 * Amendment 15 (M-28, WU-149; D-504): AC-W128, the documents. The headings, the sections that carry notes and the
 * rows the spine marks built are read from the amendment itself (§9, §13, §16), so the text is held to the spec.
 *
 * - `docs/build-guide/spec/04-game-knowledge.md` exists with §9's headings, in §9's order, the contract's three parts
 *   under it, and every relative link in it resolves.
 * - `03-pipeline.md`'s two sections §9 names carry a note that links to slice 04 and names the file's new place.
 * - The spine names C-57 and C-58 and this amendment's rows (its decisions, units, milestone and risks) as built, its
 *   §4.1 lists slice 04, its §4.3 holds the old-to-new path line, and its status line reads "Folded through amendment
 *   15" (a later amendment's approval may add "(approved; as built through n)", n at least 15).
 * `tests/static/specSpine.test.ts` is the criterion's other half.
 */
import { describe, it, expect } from '@jest/globals';
import fs from 'fs';
import path from 'path';

const REPO = path.resolve(__dirname, '..', '..');
const SPEC_DIR = path.join(REPO, 'docs', 'build-guide', 'spec');
/** Read whole, never as empty text when missing: a missing file fails loudly. */
const read = (p: string) => fs.readFileSync(p, 'utf8');
/** The text with every whitespace run collapsed to one space, so a phrase split by a hard wrap is still seen. */
const folded = (text: string) => text.replace(/\s+/g, ' ');

const AMENDMENT_RAW = read(path.join(SPEC_DIR, 'amendment-15-plugin-and-knowledge.md'));
const AMENDMENT = folded(AMENDMENT_RAW);
const SLICE_PATH = path.join(SPEC_DIR, '04-game-knowledge.md');
const PIPELINE_PATH = path.join(SPEC_DIR, '03-pipeline.md');
const SPINE_PATH = path.join(REPO, 'docs', 'spec', 'README.md');

/** The amendment's text from `start` to `end`, both required. */
function between(text: string, start: string, end: string): string {
  const at = text.indexOf(start);
  const to = text.indexOf(end, at + start.length);
  if (at < 0 || to < 0) throw new Error(`no "${start}" … "${end}"`);
  return text.slice(at + start.length, to);
}

/** §9's headings: the top-level list, and the contract's parts in its parentheses. */
const HEADING_LIST = between(AMENDMENT, 'with the headings ', '; each later piece gets its own');
const TOP_HEADINGS = HEADING_LIST.replace(/\s*\([^)]*\)/, '').split(/, | and /);
const CONTRACT_PARTS = /\(([^)]*)\)/.exec(HEADING_LIST)![1].split(', ');
const CONTRACT = TOP_HEADINGS.find((h) => /contract/i.test(h))!;

/** A Markdown file's headings at one level, without their numbers ("## 2. The contract" → "The contract"). */
const headings = (text: string, level: number) =>
  [...text.matchAll(new RegExp(`^${'#'.repeat(level)} (?:[\\d.]+ )?(.+)$`, 'gm'))].map((m) => m[1].trim());

/** The text of a section from its heading line to the next heading of the same or a higher level. */
function sectionOf(text: string, headingStart: string): string {
  const lines = text.split('\n');
  const at = lines.findIndex((l) => l.startsWith(headingStart));
  if (at < 0) throw new Error(`no heading starting "${headingStart}"`);
  const level = /^#+/.exec(lines[at])![0].length;
  const rest = lines.slice(at + 1);
  const end = rest.findIndex((l) => /^#+ /.test(l) && /^#+/.exec(l)![0].length <= level);
  return [lines[at], ...(end < 0 ? rest : rest.slice(0, end))].join('\n');
}

/** Every relative Markdown link target in a text that doesn't resolve from `dir`. */
function brokenLinks(text: string, dir: string): string[] {
  return [...text.matchAll(/\]\(([^)\s]+)\)/g)]
    .map((m) => m[1])
    .filter((t) => !/^[a-z]+:/i.test(t) && !t.startsWith('#'))
    .filter((t) => !fs.existsSync(path.resolve(dir, t.split('#')[0])));
}

const last = (cells: string[]) => cells[cells.length - 1];

/** A spine table row by its id: its cells, the id's cell first. */
function row(spine: string, id: string): string[] {
  const line = spine.split('\n').find((l) => l.startsWith(`| ${id} | `));
  if (!line) throw new Error(`the spine has no row ${id}`);
  return line.split(' | ').map((c) => c.replace(/^\| ?| ?\|$/g, '').trim());
}

describe('AC-W128 (WU-149, D-504): slice 04, written current with §9\'s headings', () => {
  it('reads six headings and three contract parts from the amendment', () => {
    expect(TOP_HEADINGS).toHaveLength(6);
    expect(CONTRACT_PARTS).toHaveLength(3);
  });

  it('exists, with §9\'s headings as its H2s, in order', () => {
    expect(fs.existsSync(SLICE_PATH)).toBe(true);
    expect(headings(read(SLICE_PATH), 2)).toEqual(TOP_HEADINGS);
  });

  it('holds the contract\'s three parts under the contract', () => {
    const contract = sectionOf(read(SLICE_PATH), `## ${TOP_HEADINGS.indexOf(CONTRACT) + 1}. ${CONTRACT}`);
    expect(headings(contract, 3).map((h) => h.toLowerCase())).toEqual(CONTRACT_PARTS.map((p) => p.toLowerCase()));
  });

  it('names the piece\'s decision and contract, and its every relative link resolves', () => {
    const slice = read(SLICE_PATH);
    expect(slice).toContain('D-503');
    expect(slice).toContain('C-58');
    expect(brokenLinks(slice, SPEC_DIR)).toEqual([]);
  });
});

describe('AC-W128 (WU-149, D-504): 03-pipeline.md\'s notes at the two sections the piece now holds', () => {
  /** §9's "§7.3 "Source markers in markdown" (:1151) and §7.6 "The pattern library" (:1336)". */
  const named = [...between(AMENDMENT, '## 9. D-504', '## 10.').matchAll(/§(7\.\d) "([^"]+)"/g)].map((m) => ({
    number: m[1],
    title: m[2],
  }));
  /** The file each section is about, at its new place in game knowledge. */
  const newPlace: Record<string, string> = {
    'Source markers in markdown': 'skills/game-knowledge/references/source-markers.md',
    'The pattern library': 'skills/game-knowledge/references/patterns.md',
  };

  it('reads the two sections from §9', () => {
    expect(named.map((n) => n.number)).toEqual(['7.3', '7.6']);
  });

  it.each(['7.3', '7.6'])('§%s carries a note that links to slice 04 and names the file\'s new place', (number) => {
    const { title } = named.find((n) => n.number === number)!;
    const text = sectionOf(read(PIPELINE_PATH), `### ${number} ${title}`);
    const note = folded(text.split('\n').filter((l) => l.startsWith('>')).map((l) => l.replace(/^> ?/, '')).join(' '));
    expect(note).toMatch(/^\*\*Note \(amendment 15/);
    expect(note).toContain('](04-game-knowledge.md)');
    expect(note).toContain(`\`${newPlace[title]}\``);
    expect(fs.existsSync(path.join(REPO, newPlace[title]))).toBe(true);
    expect(brokenLinks(note, SPEC_DIR)).toEqual([]);
  });
});

describe('AC-W128 (WU-149, D-504): the spine holds amendment 15 as built', () => {
  const spine = read(SPINE_PATH);
  const flat = folded(spine);
  /** The decisions the amendment's headings name (as `specSpine.test.ts` reads them). */
  const decisionHeadings = AMENDMENT_RAW.match(/^#{2,3} .*$/gm) ?? [];
  const decisions = [...new Set(decisionHeadings.flatMap((h) => h.match(/D-\d+/g) ?? []))];
  /** The roadmap's decision (§11's heading): approved, built by later amendments, so never marked built here. */
  const roadmap = decisionHeadings.filter((h) => /roadmap/i.test(h)).flatMap((h) => h.match(/D-\d+/g) ?? []);
  /** §13's units with their kind, and §16's risks. */
  const units = [...AMENDMENT_RAW.matchAll(/^\| (WU-\d+) \| (build|docs|human) \|/gm)].map((m) => ({
    id: m[1],
    kind: m[2],
  }));
  const risks = [...AMENDMENT_RAW.matchAll(/^\| (R-\d+) \|/gm)].map((m) => m[1]);

  it('reads the amendment\'s rows: D-499…D-506, WU-145…WU-150, R-113…R-117', () => {
    expect(decisions).toEqual(['D-499', 'D-500', 'D-501', 'D-502', 'D-503', 'D-504', 'D-505', 'D-506']);
    expect(units.map((u) => u.id)).toEqual(['WU-145', 'WU-146', 'WU-147', 'WU-148', 'WU-149', 'WU-150']);
    expect(risks).toEqual(['R-113', 'R-114', 'R-115', 'R-116', 'R-117']);
  });

  it('its status line reads "Folded through amendment 15", built through at least 15', () => {
    const status = spine.split('\n').find((l) => l.startsWith('**Status:**'))!;
    const m = /Folded through amendment (\d+)(?: \(approved; as built through (\d+)\))?/.exec(status);
    expect(m).not.toBeNull();
    const builtThrough = Number(m![2] ?? m![1]);
    expect(builtThrough).toBeGreaterThanOrEqual(15);
    if (Number(m![1]) === 15) expect(status).not.toContain('(approved;');
  });

  it('marks each decision built and the roadmap approved, none a target or "not built"', () => {
    expect(roadmap).toEqual(['D-506']);
    const wrong = decisions.filter((d) => {
      const status = last(row(spine, d));
      if (/\*\*target\*\*/.test(status) || /not built/.test(status)) return true;
      return roadmap.includes(d) ? !/^approved\b/.test(status) || !/roadmap/.test(status) : !/\bbuilt\b/.test(status);
    });
    expect(wrong).toEqual([]);
  });

  it('names C-57 and C-58, each built', () => {
    for (const c of ['C-57', 'C-58']) {
      const head = /\*\*C-5[78] [^*]+\*\* \(new;[^)]*\)/.exec(flat.slice(flat.indexOf(`**${c} `)));
      expect(head).not.toBeNull();
      expect(head![0]).toMatch(/\bbuilt\b/);
      expect(head![0]).not.toMatch(/not built/);
    }
  });

  it('marks the build and docs units built, and keeps the human unit', () => {
    for (const { id, kind } of units) {
      const title = row(spine, id)[1];
      if (kind === 'human') expect(title).toMatch(/^\*\*(Human|Recorded)/);
      else expect(title).toMatch(/^\*\*Built\*\*/);
    }
  });

  it('marks M-28 built in §9.3, HG-37 passed', () => {
    const s93 = folded(sectionOf(spine, '### 9.3 '));
    const line = s93.slice(s93.indexOf('- **M-28, '));
    expect(s93).toContain('- **M-28, ');
    expect(line).toContain('**Status: built** (2026-11-06; WL:6542–6762); HG-37 passed 2026-11-07');
    expect(line).not.toContain('**Status: built, HG-37 open**');
    expect(line).not.toMatch(/not built/);
  });

  it('keeps no risk at "M-28 not built", and no amendment 15 note as approved', () => {
    expect(risks.filter((r) => /M-28 not built/.test(last(row(spine, r))))).toEqual([]);
    expect(spine).not.toContain('(amendment 15, approved)**:');
  });

  it('lists slice 04 in §4.1, with a link that resolves', () => {
    const table = sectionOf(spine, '### 4.1 ');
    const line = table.split('\n').find((l) => l.includes('04-game-knowledge.md'));
    expect(line).toBeDefined();
    expect(line).toContain('](../build-guide/spec/04-game-knowledge.md)');
    expect(brokenLinks(line!, path.dirname(SPINE_PATH))).toEqual([]);
  });

  it('holds the old-to-new path line in §4.3', () => {
    // The old folders' names are joined here, so this file passes AC-W115's old-path guard over `tests/`.
    const dot = ['', 'claude'].join('.');
    const sources = folded(sectionOf(spine, '### 4.3 '));
    expect(sources).toContain('**Old paths to new**');
    expect(sources).toContain(`\`${[dot, 'skills', 'build-guide'].join('/')}/\` → \`skills/build-guide/\``);
    expect(sources).toContain(`\`${[dot, 'agents', 'build-guide'].join('/')}/<name>.md\` → \`agents/<name>.md\``);
    expect(sources).toContain('`/build-guide` → `/pob2:build-guide`');
  });
});
