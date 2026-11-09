/**
 * Amendment 16 (M-29, WU-158; D-525): AC-W143, M-29's documents. The decisions, units and criteria are read from the
 * amendment itself (Part I's headings, §24's M-29 table, §25's M-29 criteria), so the text is held to the spec.
 *
 * - Slice 04 (`docs/build-guide/spec/04-game-knowledge.md`) states the running-league rule (D-507, C-59) and the Bash
 *   line (D-515), and no longer says the piece needs no Bash or reads "the newest digest".
 * - Slices 01, 02 and 03 carry §21's notes for M-29: the patches (01 and 02), the granted-quality rule (02) and the
 *   league rule (03), each a `> **Note (amendment 16, …; M-29)**` block whose links resolve.
 * - The spine names C-59 and C-60 as built, marks M-29's decisions and units built (WU-157 not run), M-29 built in
 *   §9.3, keeps no M-29 decision in an "(amendment 16, approved)" note, names each M-29 criterion's test in §14.3 (AC-W140
 *   not run while WU-157 isn't), marks no M-30 row built before M-30's docs unit (WU-167) does, and its status line reads
 *   exactly "Folded through amendment 16 (approved; as built through 15 and amendment 16's M-29)" until WU-167's row is
 *   built; then the parenthesis goes, and a later amendment's approval adds its own.
 * `tests/static/specSpine.test.ts` is the criterion's other half; the rows' status and the status line are also the
 * gate verifier's record (a16 §21).
 *
 * Amendment 16 (M-30, WU-167; D-525): AC-W161, M-30's documents, read the same way (Part II's headings, §24's M-30
 * table, §25's M-30 criteria, §21's slice list and notes):
 * - slices 05, 06 and 07 exist with slice 04's headings (its H2s, and its contract's three H3s), each naming its
 *   piece's decision and contract, criteria and units, its "Real cases" holding the piece's expected results for
 *   WU-168 (a16 §20), its links resolving;
 * - slice 03 carries §21's notes for M-30: §5.2's design and writer rows pointing to 05 and 07, its file-run entry, §8
 *   pointing to 07 and §9 to 06; slices 01 and 02 carry notes for the new tool and plan schema 11; slice 04 names the
 *   three new commands;
 * - the spine names C-61 to C-66, each built; lists slices 05 to 07 in §4.1; marks every M-30 decision and build or
 *   docs unit built (WU-168 open, AC-W160 and AC-W140 open), M-30 "built, WU-168 open" in §9.3, each M-30 criterion
 *   in §14.3's as-built line, keeps no "(amendment 16, approved)" note; and its status line drops the parenthesis.
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

const AMENDMENT = read(path.join(SPEC_DIR, 'amendment-16-pieces-and-launch.md'));
const SPINE = read(path.join(REPO, 'docs', 'spec', 'README.md'));
const slice = (name: string) => read(path.join(SPEC_DIR, name));

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

/** A file's amendment 16 notes for a milestone: each `> **Note (amendment 16, …; M-nn).**` block, its lines joined. */
function a16Notes(text: string, milestone: 'M-29' | 'M-30'): string[] {
  const notes: string[] = [];
  let current: string[] | null = null;
  const lead = new RegExp(`^\\*\\*Note \\(amendment 16, [^)]*; ${milestone}\\)\\.\\*\\*`);
  for (const line of text.split('\n')) {
    if (line.startsWith('>')) {
      const body = line.replace(/^> ?/, '');
      if (lead.test(body)) {
        current = [body];
        notes.push('');
      } else if (/^\*\*Note \(/.test(body)) current = null;
      else if (current) current.push(body);
      if (current) notes[notes.length - 1] = folded(current.join(' '));
    } else current = null;
  }
  return notes;
}
const m29Notes = (text: string) => a16Notes(text, 'M-29');

const last = (cells: string[]) => cells[cells.length - 1];

/** A spine table row by its id: its cells, the id's cell first. */
function row(id: string): string[] {
  const line = SPINE.split('\n').find((l) => l.startsWith(`| ${id} | `));
  if (!line) throw new Error(`the spine has no row ${id}`);
  return line.split(' | ').map((c) => c.replace(/^\| ?| ?\|$/g, '').trim());
}

/** Part I's decisions (§3 to §11's headings): M-29's. */
const PART_ONE = AMENDMENT.slice(AMENDMENT.indexOf('## 3. '), AMENDMENT.indexOf('# Part II'));
const DECISIONS = [...new Set((PART_ONE.match(/^## \d+\. D-\d+/gm) ?? []).map((h) => /D-\d+/.exec(h)![0]))];
/** §24's M-29 units with their kind. */
const UNITS = [
  ...sectionOf(sectionOf(AMENDMENT, '## 24. '), '### M-29').matchAll(/^\| (WU-\d+) \| ([^|]+?) \|/gm),
].map((m) => ({ id: m[1], kind: m[2].trim() }));
/** Part II's decisions (§12 to §20's headings) and §24's M-30 units: M-30's, which WU-167 marks built. */
const PART_TWO = AMENDMENT.slice(AMENDMENT.indexOf('# Part II'), AMENDMENT.indexOf('## 21. '));
const M30_DECISIONS = [...new Set((PART_TWO.match(/^## \d+\. D-\d+/gm) ?? []).map((h) => /D-\d+/.exec(h)![0]))];
const M30_UNITS = [...sectionOf(sectionOf(AMENDMENT, '## 24. '), '### M-30').matchAll(/^\| (WU-\d+) \| ([^|]+?) \|/gm)].map(
  (m) => ({ id: m[1], kind: m[2].trim() }),
);
/** M-30's docs unit, whose row the fold rule marks built last (a16 §21). */
const M30_DOCS = M30_UNITS.find((u) => u.kind === 'docs')!.id;
/** §25's M-29 criteria. */
const CRITERIA = [...sectionOf(sectionOf(AMENDMENT, '## 25. '), '### M-29').matchAll(/^- \*\*(AC-W\d+) /gm)].map(
  (m) => m[1],
);

describe('AC-W143 (WU-158, D-525): the amendment\'s M-29 rows, read from its text', () => {
  it('reads D-507…D-515, WU-151…WU-158 and AC-W130…AC-W144', () => {
    expect(DECISIONS).toEqual(['D-507', 'D-508', 'D-509', 'D-510', 'D-511', 'D-512', 'D-513', 'D-514', 'D-515']);
    expect(UNITS.map((u) => u.id)).toEqual(['WU-151', 'WU-152', 'WU-153', 'WU-154', 'WU-155', 'WU-156', 'WU-157', 'WU-158']);
    expect(UNITS.find((u) => u.id === 'WU-157')!.kind).toMatch(/^human/);
    expect(CRITERIA).toEqual(Array.from({ length: 15 }, (_, i) => `AC-W${130 + i}`));
    expect(M30_DECISIONS).toEqual(Array.from({ length: 9 }, (_, i) => `D-${516 + i}`));
    expect(M30_UNITS.map((u) => u.id)).toEqual(Array.from({ length: 10 }, (_, i) => `WU-${159 + i}`));
    expect(M30_DOCS).toBe('WU-167');
  });
});

describe('AC-W143 (WU-158, D-507, D-515): slice 04 states the running-league rule and the Bash line', () => {
  const text = folded(slice('04-game-knowledge.md'));

  it('states the running-league rule: the instants on line 3, the clock in UTC, the command, an ended league only when asked', () => {
    for (const s of ['D-507', 'C-59', 'leagues.mjs', 'League: from', 'UTC', 'only when the user asks', 'never a digest']) {
      expect(text).toContain(s);
    }
    expect(text).toMatch(/a league is running from its start instant until its end instant/i);
    expect(text).not.toContain('the newest digest for the league');
  });

  it('states the Bash line: the runner searches with grep through Bash, and no longer needs no Bash', () => {
    expect(text).toContain('D-515');
    expect(text).toMatch(/searches with `grep` through Bash/);
    expect(text).not.toContain('It needs no Bash');
    expect(text).toMatch(/no agent definition names Bash/);
  });

  it('lists M-29\'s units and criteria for the piece, WU-157 not run', () => {
    for (const id of ['WU-151', 'WU-156', 'WU-157', 'WU-158', 'AC-W132', 'AC-W140', 'AC-W142', 'AC-W143']) {
      expect(text).toContain(id);
    }
    expect(text).toMatch(/### WU-157: [^#]*- status: not run/);
    expect(brokenLinks(slice('04-game-knowledge.md'), SPEC_DIR)).toEqual([]);
  });
});

describe('AC-W143 (WU-158, D-525): slices 01, 02 and 03 carry §21\'s notes for M-29', () => {
  /** What each slice's notes must name: the patches (01, 02), the granted-quality rule (02), the league rule (03). */
  const expected: Record<string, string[]> = {
    '01-server-tools.md': ['D-509', '`pob-api/API/Patches.lua`', 'D-510', 'D-511', 'D-512'],
    '02-plan-compiler.md': ['D-509', 'D-512', 'schema 11', 'quality 0', '`compile_check`'],
    '03-pipeline.md': ['D-507', '`digest`', '`digests`', 'revision 15', 'D-512'],
  };

  it.each(Object.keys(expected))('%s carries an amendment 16 note for M-29, naming what §21 gives it', (name) => {
    const notes = m29Notes(slice(name));
    expect(notes.length).toBeGreaterThan(0);
    const all = notes.join(' ');
    for (const s of expected[name]) expect(all).toContain(s);
    expect(brokenLinks(all, SPEC_DIR)).toEqual([]);
  });

  it('slice 03\'s league notes link to slice 04, where the rule is stated', () => {
    const league = m29Notes(slice('03-pipeline.md')).filter((n) => n.includes('D-507'));
    expect(league.length).toBeGreaterThan(0);
    for (const n of league) expect(n).toContain('](04-game-knowledge.md)');
  });
});

describe('AC-W143 (WU-158, D-525): the spine holds amendment 16\'s M-29 as built', () => {
  const flat = folded(SPINE);

  /** Whether M-30's docs unit has marked M-30 built: its row's title starts "**Built**" (the fold rule's last step). */
  const m30Folded = /^\*\*Built\*\*/.test(row(M30_DOCS)[1]);

  it('its status line reads exactly "(approved; as built through 15 and amendment 16\'s M-29)" until M-30 is folded', () => {
    const status = folded(SPINE.slice(SPINE.indexOf('**Status:**'), SPINE.indexOf('**Status:**') + 400));
    const n = Number(/Folded through amendment (\d+)/.exec(status)?.[1]);
    if (n === 16 && !m30Folded) {
      expect(status).toContain("Folded through amendment 16 (approved; as built through 15 and amendment 16's M-29),");
    } else if (n === 16) {
      expect(status).toMatch(/Folded through amendment 16(?! \()/);
    } else {
      expect(n).toBeGreaterThan(16);
      expect(m30Folded).toBe(true);
      const built = /Folded through amendment \d+ \(approved; as built through (\d+)\)/.exec(status);
      if (built) expect(Number(built[1])).toBeGreaterThanOrEqual(16);
      else expect(status).toMatch(/Folded through amendment \d+(?! \()/);
    }
  });

  it('marks no M-30 row built before M-30\'s docs unit folds it', () => {
    if (m30Folded) return;
    const built = [
      ...M30_UNITS.filter((u) => /^\*\*(Built|Recorded)\*\*/.test(row(u.id)[1])).map((u) => u.id),
      ...M30_DECISIONS.filter((d) => /\bbuilt WU-\d+/.test(last(row(d))) || !/\*\*target\*\*/.test(last(row(d)))),
    ];
    expect(built).toEqual([]);
  });

  it('names C-59 and C-60, each built', () => {
    for (const c of ['C-59', 'C-60']) {
      const head = new RegExp(`\\*\\*${c} [^*]+\\*\\* \\(new;[^)]*\\)`).exec(flat);
      expect(head).not.toBeNull();
      expect(head![0]).toMatch(/\bbuilt WU-\d+/);
      expect(head![0]).not.toMatch(/approved 2026-11-08, not built: WU-15/);
    }
  });

  it('marks each M-29 decision built, none a target of an M-29 unit or "not built"', () => {
    const wrong = DECISIONS.filter((d) => {
      const status = last(row(d));
      return !/\bbuilt WU-\d+/.test(status) || /not built/.test(status) || /\*\*target\*\*: WU-15[1-8]\b/.test(status);
    });
    expect(wrong).toEqual([]);
  });

  it('keeps no M-29 decision in an "(amendment 16, approved)" note', () => {
    const notes = [...SPINE.matchAll(/\*\*amended by ([^*]*)\(amendment 16, approved\)\*\*/g)].map((m) => m[1]);
    const m29 = notes.filter((n) => (n.match(/D-\d+/g) ?? []).some((d) => DECISIONS.includes(d)));
    expect(m29).toEqual([]);
  });

  it('marks the build and docs units built, and WU-157 not run, recorded by WU-168 at the latest', () => {
    for (const { id, kind } of UNITS) {
      const title = row(id)[1];
      if (/^human/.test(kind)) {
        expect(title).toMatch(/not run/);
        expect(title).toContain('WU-168');
      } else expect(title).toMatch(/^\*\*Built\*\*/);
    }
  });

  it('marks M-29 built in §9.3, M-30 approved until its docs unit folds it (then built, AC-W161)', () => {
    const s93 = folded(sectionOf(SPINE, '### 9.3 '));
    const m29 = s93.slice(s93.indexOf('- **M-29, '), s93.indexOf('- **M-30, '));
    expect(m29).toContain('**Status: built**');
    expect(m29).toMatch(/WU-157 not run/);
    // D-525 (WU-167): M-30's docs unit marks M-30 built, so the line stays "approved" only until then.
    const m30 = s93.slice(s93.indexOf('- **M-30, '));
    if (m30Folded) expect(m30).toMatch(/\*\*Status: built(, WU-168 open)?\*\*/);
    else expect(m30).toContain('**Status: approved**');
  });

  it('names each M-29 criterion in §14.3\'s as-built line', () => {
    const s143 = folded(sectionOf(SPINE, '### 14.3 '));
    const asBuilt = s143.slice(s143.indexOf('As built at M-29'));
    expect(s143).toContain('As built at M-29');
    expect(CRITERIA.filter((c) => !asBuilt.includes(c))).toEqual([]);
    // AC-W140 stays not run while WU-157's row says so (WU-168 records it at the latest).
    if (/not run/.test(row('WU-157')[1])) expect(asBuilt).toContain('AC-W140 not run');
  });
});

/** §25's M-30 criteria, and §21's slice list and notes: M-30's documents (AC-W161). */
const M30_CRITERIA = [...sectionOf(sectionOf(AMENDMENT, '## 25. '), '### M-30').matchAll(/^- \*\*(AC-W\d+) /gm)].map(
  (m) => m[1],
);
const S21 = folded(sectionOf(AMENDMENT, '## 21. '));
const S20 = folded(sectionOf(AMENDMENT, '## 20. '));
const S22 = sectionOf(AMENDMENT, '## 22. ');
/** The three slices §21 names, in its order: `05-compile.md`, `06-pricing.md`, `07-writer.md`. */
const PIECE_SLICES = [...new Set([...S21.matchAll(/`(?:docs\/build-guide\/spec\/)?(0[5-9]-[a-z-]+\.md)`/g)].map((m) => m[1]))];
/** Each piece's contract from §22's table (compile, pricing, the writer) and the section that defines it. */
const pieceContract = (word: string) => {
  const line = S22.split('\n').find((l) => new RegExp(`^\\| C-\\d+ \\| \\*\\*${word}\\b`).test(l));
  if (!line) throw new Error(`§22 has no contract for ${word}`);
  const id = /^\| (C-\d+) /.exec(line)![1];
  const section = /\| (§\d+)[^|]*\|\s*$/.exec(line)![1];
  const decision = new RegExp(`^## ${section.slice(1)}\\. (D-\\d+)`, 'm').exec(AMENDMENT)![1];
  return { id, decision };
};
/** The two real characters of §20, by their bold names, and the main-skill answers §20 expects for each. */
const REAL_CASES = [...S20.matchAll(/- \*\*([A-Za-z]+)\*\* \(`[^`]+\.xml`\)/g)].map((m) => m[1]);
const MAIN_GROUPS = [...S20.matchAll(/the file's group (\d+) \(([A-Za-z ]+)\) as plan group (\d+)/g)].map(
  (m) => `group ${m[1]} (${m[2]}) as plan group ${m[3]}`,
);
/** Per slice: its contract's word in §22, the M-30 criteria it holds (each one of §25's), and its built units. */
const PIECES: Record<string, { word: string; criteria: string[]; units: string[] }> = {
  '05-compile.md': { word: 'Compile', criteria: ['AC-W148', 'AC-W149', 'AC-W150', 'AC-W151', 'AC-W152', 'AC-W153', 'AC-W154', 'AC-W160'], units: ['WU-160', 'WU-161', 'WU-162', 'WU-168'] },
  '06-pricing.md': { word: 'Pricing', criteria: ['AC-W155', 'AC-W160'], units: ['WU-163', 'WU-168'] },
  '07-writer.md': { word: 'The writer', criteria: ['AC-W157', 'AC-W158', 'AC-W160'], units: ['WU-165', 'WU-164', 'WU-168'] },
};
/** A Markdown file's headings at one level, without their numbers ("## 2. The contract" → "The contract"). */
const headings = (text: string, level: number) =>
  [...text.matchAll(new RegExp(`^${'#'.repeat(level)} (?:[\\d.]+ )?(.+)$`, 'gm'))].map((m) => m[1].trim());
const SLICE_04 = slice('04-game-knowledge.md');
const H2_04 = headings(SLICE_04, 2);
const CONTRACT_04 = headings(sectionOf(SLICE_04, '## 2. '), 3);

describe("AC-W161 (WU-167, D-525): the amendment's M-30 rows and §21's slices, read from its text", () => {
  it('reads AC-W145…AC-W162, the three slices, the two real characters and their main-skill answers', () => {
    expect(M30_CRITERIA).toEqual(Array.from({ length: 18 }, (_, i) => `AC-W${145 + i}`));
    expect(PIECE_SLICES).toEqual(['05-compile.md', '06-pricing.md', '07-writer.md']);
    expect(Object.keys(PIECES)).toEqual(PIECE_SLICES);
    for (const p of Object.values(PIECES)) for (const c of p.criteria) expect(M30_CRITERIA).toContain(c);
    expect(REAL_CASES).toEqual(['ResurrectForbidden', 'CullTheConquerer']);
    expect(MAIN_GROUPS).toHaveLength(2);
    expect(H2_04).toEqual(['Scope', 'The contract', 'Requirements', 'Acceptance criteria', 'Work units', 'Real cases']);
    expect(CONTRACT_04).toHaveLength(3);
  });
});

describe('AC-W161 (WU-167, D-525): slices 05, 06 and 07 exist with slice 04\'s headings', () => {
  it.each(PIECE_SLICES)('%s has slice 04\'s H2s in order and its contract\'s three H3s', (name) => {
    const text = slice(name);
    expect(headings(text, 2)).toEqual(H2_04);
    expect(headings(sectionOf(text, '## 2. '), 3)).toEqual(CONTRACT_04);
    expect(brokenLinks(text, SPEC_DIR)).toEqual([]);
  });

  it.each(PIECE_SLICES)('%s names its piece\'s decision and contract, its criteria and its units', (name) => {
    const text = slice(name);
    const { id, decision } = pieceContract(PIECES[name].word);
    expect(text).toContain(id);
    expect(text).toContain(decision);
    const criteria = folded(sectionOf(text, '## 4. '));
    for (const c of PIECES[name].criteria) expect(criteria).toContain(`**${c} (`);
    const units = sectionOf(text, '## 5. ');
    for (const u of PIECES[name].units) expect(units).toMatch(new RegExp(`^### ${u}: `, 'm'));
    expect(units).toMatch(/- status: built/);
    expect(units).toMatch(/### WU-168: [^#]*- status: open/);
  });

  it("each slice's Real cases give its piece's expected results for WU-168 (a16 §20)", () => {
    const cases = (name: string) => folded(sectionOf(slice(name), '## 6. '));
    for (const name of PIECE_SLICES) expect(cases(name)).toMatch(/[Ee]xpected/);
    // Compile holds the two characters' read and measured points, the main-skill answers §20 expects among them.
    for (const c of REAL_CASES) expect(cases('05-compile.md')).toContain(c);
    for (const g of MAIN_GROUPS) expect(cases('05-compile.md')).toContain(g);
    expect(cases('05-compile.md')).toMatch(/254 reserved against 215/);
    // Pricing runs offline, the user naming the rung; the writer runs on an accepted better round.
    for (const c of REAL_CASES) expect(cases('06-pricing.md')).toContain(c);
    expect(cases('06-pricing.md')).toMatch(/offline/i);
    expect(cases('06-pricing.md')).toContain("the user's word");
    expect(cases('07-writer.md')).toMatch(/accepted better round/);
  });
});

describe("AC-W161 (WU-167, D-525): §21's notes in slices 01 to 04", () => {
  const s03 = slice('03-pipeline.md');
  const notesIn = (text: string, heading: string) => a16Notes(sectionOf(text, heading), 'M-30');

  it("slice 03's §5.2 points its design and writer rows to slices 05 and 07, and holds the file-run entry", () => {
    const notes = notesIn(s03, '### 5.2 ');
    const all = notes.join(' ');
    expect(all).toContain('](05-compile.md)');
    expect(all).toContain('](07-writer.md)');
    const fileRun = notes.find((n) => /A run from a player's PoB file/.test(n));
    expect(fileRun).toBeDefined();
    for (const s of ['`from`', '`better`', 'slug is `file`', '`place`', '`ladder`', 'checkFlow4', 'WU-168']) {
      expect(fileRun).toContain(s);
    }
    expect(brokenLinks(all, SPEC_DIR)).toEqual([]);
  });

  it("slice 03's §8 points to slice 07 and §9 to slice 06, the procedure's new path named", () => {
    const s8 = notesIn(s03, '## 8. ').join(' ');
    const s9 = notesIn(s03, '## 9. ').join(' ');
    expect(s8).toContain('](07-writer.md)');
    expect(s9).toContain('](06-pricing.md)');
    expect(s9).toContain('`skills/pricing/references/pricing.md`');
    expect(fs.existsSync(path.join(REPO, 'skills', 'pricing', 'references', 'pricing.md'))).toBe(true);
  });

  it('slices 01 and 02 carry notes for the new tool and plan schema 11, pointing to slice 05', () => {
    const n01 = a16Notes(slice('01-server-tools.md'), 'M-30').join(' ');
    const n02 = a16Notes(slice('02-plan-compiler.md'), 'M-30').join(' ');
    for (const s of ['`plan_from_build`', 'C-62', '86', '](05-compile.md)']) expect(n01).toContain(s);
    for (const s of ['schema 11', '`switch', '`config.file`', '`measure_as', '](05-compile.md)']) expect(n02).toContain(s);
    expect(brokenLinks(n01 + n02, SPEC_DIR)).toEqual([]);
  });

  it('slice 04 names the three new commands, its M-30 unit and criterion', () => {
    const text = folded(SLICE_04);
    for (const s of ['`/pob2:compile`', '`/pob2:pricing`', '`/pob2:writer`', 'pob2-league-digest', 'WU-167', 'AC-W161']) {
      expect(text).toContain(s);
    }
    expect(text).not.toContain('checking or improving a PoB file the player has: no pob2 skill yet');
  });
});

describe('AC-W161 (WU-167, D-525): the spine holds amendment 16 as built', () => {
  const flat = folded(SPINE);

  it('its status line reads "Folded through amendment 16" with no parenthesis, or a later amendment built through 16', () => {
    const status = SPINE.split('\n').find((l) => l.startsWith('**Status:**'))!;
    const m = /Folded through amendment (\d+)(?: \(approved; as built through (\d+)\))?/.exec(status);
    expect(m).not.toBeNull();
    if (Number(m![1]) === 16) expect(status).not.toContain('(approved;');
    else expect(Number(m![2] ?? m![1])).toBeGreaterThanOrEqual(16);
  });

  it('names C-61 to C-66, each built', () => {
    expect(row('C-62')[2]).toMatch(/\bbuilt WU-\d+/);
    expect(row('C-62')[2]).not.toMatch(/not built/);
    for (const c of ['C-61', 'C-63', 'C-64', 'C-65', 'C-66']) {
      const head = new RegExp(`\\*\\*${c} [^*]+\\*\\* \\(new;[^)]*\\)`).exec(flat);
      expect(head).not.toBeNull();
      expect(head![0]).toMatch(/\bbuilt WU-\d+/);
      expect(head![0]).not.toMatch(/not built/);
    }
  });

  it('lists slices 05, 06 and 07 in §4.1, with links that resolve', () => {
    const table = sectionOf(SPINE, '### 4.1 ');
    for (const name of PIECE_SLICES) {
      const line = table.split('\n').find((l) => l.includes(`](../build-guide/spec/${name})`));
      expect(line).toBeDefined();
      expect(brokenLinks(line!, path.join(REPO, 'docs', 'spec'))).toEqual([]);
    }
  });

  it('marks every M-30 decision built, a target only for WU-168, and keeps no "(amendment 16, approved)" note', () => {
    const wrong = [...M30_DECISIONS, 'D-525'].filter((d) => {
      const status = last(row(d));
      const targets = [...status.matchAll(/\*\*target\*\*/g)].length;
      return !/\bbuilt WU-\d+/.test(status) || /not built/.test(status) || (targets > 0 && !/WU-168/.test(status));
    });
    expect(wrong).toEqual([]);
    expect(SPINE).not.toContain('(amendment 16, approved)**:');
  });

  it('marks the build and docs units built and WU-168 open; M-30 "built, WU-168 open" in §9.3', () => {
    for (const { id, kind } of M30_UNITS) {
      const title = row(id)[1];
      if (/^human/.test(kind)) expect(title).toMatch(/^\*\*Human, then the coordinator; open\*\*/);
      else expect(title).toMatch(/^\*\*Built\*\*/);
    }
    const s93 = folded(sectionOf(SPINE, '### 9.3 '));
    expect(s93.slice(s93.indexOf('- **M-30, '))).toMatch(/\*\*Status: built(, WU-168 open)?\*\*/);
  });

  it("names each M-30 criterion in §14.3's as-built line, AC-W160 and AC-W140 open while WU-168 is", () => {
    const s143 = folded(sectionOf(SPINE, '### 14.3 '));
    const asBuilt = s143.slice(s143.indexOf('As built at M-30'));
    expect(s143).toContain('As built at M-30');
    expect(M30_CRITERIA.filter((c) => !asBuilt.includes(c))).toEqual([]);
    if (/open/.test(row('WU-168')[1])) {
      expect(asBuilt).toContain('AC-W160 open');
      expect(asBuilt).toMatch(/AC-W140 not run/);
    }
  });

  it('keeps no M-30 risk at "M-30 not built"', () => {
    const risks = [...sectionOf(AMENDMENT, '## 27. ').matchAll(/^\| (R-\d+) \|/gm)].map((m) => m[1]);
    expect(risks.filter((r) => /M-30 not built/.test(last(row(r))))).toEqual([]);
  });
});
