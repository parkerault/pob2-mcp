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

/** A file's amendment 16 notes for M-29: each `> **Note (amendment 16, …; M-29).**` block, its lines joined. */
function m29Notes(text: string): string[] {
  const notes: string[] = [];
  let current: string[] | null = null;
  for (const line of text.split('\n')) {
    if (line.startsWith('>')) {
      const body = line.replace(/^> ?/, '');
      if (/^\*\*Note \(amendment 16, [^)]*; M-29\)\.\*\*/.test(body)) {
        current = [body];
        notes.push('');
      } else if (current) current.push(body);
      if (current) notes[notes.length - 1] = folded(current.join(' '));
    } else current = null;
  }
  return notes;
}

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

  it('marks M-29 built in §9.3, M-30 still approved', () => {
    const s93 = folded(sectionOf(SPINE, '### 9.3 '));
    const m29 = s93.slice(s93.indexOf('- **M-29, '), s93.indexOf('- **M-30, '));
    expect(m29).toContain('**Status: built**');
    expect(m29).toMatch(/WU-157 not run/);
    expect(s93.slice(s93.indexOf('- **M-30, '))).toContain('**Status: approved**');
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
