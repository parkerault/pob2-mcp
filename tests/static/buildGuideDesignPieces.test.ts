/**
 * Amendment 10 (M-23), WU-107: AC-W86, the design keeps synthesizing (D-431, D-434), in the skill text.
 *
 * - `references/stages/D1-build.md`: questions 15–19 asked again after a conversion, a keystone or a limit named as a
 *   con; out pieces revisited; a set measured together on the total and each group, by D-433's three kinds of figure;
 *   scheduling before rejecting; question 19 answered; `pieces.md` written in Appendix A's form with `## Searched`;
 *   the return's `pieces:` line; a custom modifier's node a need (D-418).
 * - `references/stages/D1-finish.md`: a `reason` claim for each scheduled piece and each composite piece left out.
 * - `references/stages/D1-gate.md`: the design field's `pieces {in, scheduled, out, scheduledNames, outNames}`, read
 *   from `pieces.md`, which `run-log.mjs display design` prints: the field is put through the real display. Amendment
 *   11 (WU-115, D-442, Appendix A) drops `outNames`: the design gate counts the out pieces without naming them.
 * - `references/stages/RV.md` (removed by amendment 11, D-443): its block went with it.
 * - `references/patterns.md`: questions 16–19 and the two amended entries, read from the amendment's §6, under the
 *   library's cap; R1a-synthesize's one-line glosses agree with them. Amendment 12 §13 (WU-123, D-458) rewrote
 *   question 19 for every build: its text is read from that amendment.
 *
 * The questions, the entries' changes, `pieces.md`'s form and the design field's names are read from the amendment
 * (§6, §9, Appendix A), so the skill text is held to the spec.
 */
import { describe, it, expect, afterAll } from '@jest/globals';
import { spawnSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';

const REPO = path.resolve(__dirname, '..', '..');
const SKILL_DIR = path.join(REPO, '.claude', 'skills', 'build-guide');
const STAGES_DIR = path.join(SKILL_DIR, 'references', 'stages');
const SPEC = path.join(REPO, 'docs', 'build-guide', 'spec', 'amendment-10-synthesis.md');
const RUN_LOG = path.join(SKILL_DIR, 'scripts', 'run-log.mjs');
const FIXTURE = path.join(REPO, 'tests', 'fixtures', 'pipeline', 'run-builds');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'design-pieces-'));
afterAll(() => fs.rmSync(TMP, { recursive: true, force: true }));

/** D-410 and amendment 9 §24.1: the library's word cap; D-410: the Standard kits section's own limit. Both are
 * provisional since 2026-10-26: the user set the caps aside while the defence entries landed, to review the new size. */
const LIBRARY_WORD_CAP = 16_000;
const KITS_WORD_LIMIT = 4_000;

const read = (file: string) => (fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '');
/** One paragraph or list item per entry, with its line breaks folded, so a rule split over lines reads whole. */
const folded = (text: string) => text.replace(/\s*\n\s*/g, ' ');
const rawStage = (name: string) => read(path.join(STAGES_DIR, `${name}.md`));
const stage = (name: string) => folded(rawStage(name));
const words = (text: string) => text.split(/\s+/).filter(Boolean).length;
const spec = read(SPEC);
const appendix = spec.slice(spec.indexOf('## Appendix A. Formats'));

/** The text between `start` and the next `end` after it ('' when either is missing). */
function between(text: string, start: string, end: string): string {
  const at = text.indexOf(start);
  if (at < 0) return '';
  const to = text.indexOf(end, at + start.length);
  return to < 0 ? text.slice(at) : text.slice(at, to);
}

/** The first fenced block after `marker` in `text`, without its fences. */
function blockAfter(text: string, marker: string): string {
  const at = text.indexOf(marker);
  if (at < 0) throw new Error(`no ${JSON.stringify(marker)}`);
  const m = /```(?:json)?\n([\s\S]*?)\n```/.exec(text.slice(at));
  if (!m) throw new Error(`no fenced block after ${JSON.stringify(marker)}`);
  return m[1];
}

type Heading = { level: number; title: string; line: number };
/** Headings outside fenced blocks, with their line numbers. */
function headings(text: string): Heading[] {
  const out: Heading[] = [];
  let fenced = false;
  text.split(/\r?\n/).forEach((line, i) => {
    if (/^\s*(```|~~~)/.test(line)) fenced = !fenced;
    else if (!fenced) {
      const h = /^(#{1,6})\s+(.*?)\s*$/.exec(line);
      if (h) out.push({ level: h[1].length, title: h[2], line: i });
    }
  });
  return out;
}

/** A Markdown table's rows under its header line, each a list of trimmed cells. */
function tableRows(block: string, header: string): string[][] {
  const lines = block.split('\n');
  const at = lines.findIndex((l) => l.trim() === header);
  if (at < 0) return [];
  const rows: string[][] = [];
  for (const l of lines.slice(at + 2)) {
    if (!l.startsWith('|')) break;
    rows.push(l.slice(1, -1).split('|').map((c) => c.trim()));
  }
  return rows;
}

/** The numbered items `from`..`to` of a section, folded, by number. */
function numbered(section: string, from: number, to: number): Map<number, string> {
  const out = new Map<number, string>();
  for (const m of section.matchAll(/^(\d+)\. ([\s\S]*?)(?=^\d+\. |^\S|(?![\s\S]))/gm)) {
    const n = Number(m[1]);
    if (n >= from && n <= to) out.set(n, folded(m[2]).trim());
  }
  return out;
}
/** A sentence's text without its parentheticals and bold marks, for comparing the spec's wording with the library's. */
const plain = (s: string) => s.replace(/\*\*/g, '').replace(/\s*\([^)]*\)/g, '').replace(/\s+/g, ' ').trim();

// The spec's own words: §6's questions and entries, §9's field, Appendix A's pieces.md and the Pieces columns.
const SECTION_6 = between(spec, '## 6. D-431', '## 7. ');
const SPEC_QUESTIONS = numbered(SECTION_6, 16, 19);
/** Amendment 12 §13 (D-458, P6): question 19's new text, as the amendment quotes it. */
const A12_QUESTION_19 = (() => {
  const a12 = folded(read(path.join(REPO, 'docs', 'build-guide', 'spec', 'amendment-12-defence-and-design.md')));
  const m = /\*\*Question 19 for every build\*\* \(P6\), .*? Its text: "19\. (.*?)"\./.exec(a12);
  if (!m) throw new Error("amendment 12 §13 doesn't quote question 19's text");
  return m[1];
})();
const SPEC_FIELDS = (() => {
  const m = /`pieces \{([a-zA-Z, ]+)\}`/.exec(between(spec, '## 9. D-434', '## 10. '));
  if (!m) throw new Error("§9 doesn't name the design field's pieces");
  return m[1].split(',').map((f) => f.trim());
})();
const PIECES_HEADER = blockAfter(appendix, "**The card's tables.**").split('\n')[2].trim();
/** Amendment 11's Appendix A (D-442): the design field's `pieces` loses `outNames`, and the display counts the out pieces. */
const A11_SPEC = read(path.join(REPO, 'docs', 'build-guide', 'spec', 'amendment-11-live-test-fixes.md'));
const A11_PIECES_FIELDS = SPEC_FIELDS.filter((f) => f !== 'outNames');
const PIECES_MD_FORM = folded(between(appendix, '**`pieces.md`**', '\n\n'));

const library = read(path.join(SKILL_DIR, 'references', 'patterns.md'));
const libraryLines = library.split(/\r?\n/);
const libraryHeadings = headings(library);
/** The text under heading `h`, up to the next heading of its level or above. */
const bodyOf = (h: Heading) =>
  libraryLines.slice(h.line + 1, libraryHeadings.find((x) => x.line > h.line && x.level <= h.level)?.line ?? libraryLines.length).join('\n');
const entry = (title: string) => {
  const h = libraryHeadings.find((x) => x.level === 3 && x.title === title);
  return h ? bodyOf(h) : '';
};
const field = (body: string, name: string) => {
  const m = new RegExp(`^- \\*\\*${name}:\\*\\* ([\\s\\S]*?)(?=^- \\*\\*|(?![\\s\\S]))`, 'm').exec(body);
  return m ? folded(m[1]).trim() : '';
};

/** run-log.mjs, spawned with an explicit env, on a copy of a fixture run. */
function display(dir: string, ...args: string[]): string[] {
  const r = spawnSync(process.execPath, [RUN_LOG, dir, 'display', ...args], { cwd: TMP, env: { PATH: '/usr/bin:/bin', LANG: 'C' }, encoding: 'utf8', timeout: 30000 });
  expect({ code: r.status, stderr: r.stderr }).toEqual({ code: 0, stderr: '' });
  return r.stdout.split('\n');
}
let copies = 0;
function copyFixture(): string {
  const dir = path.join(TMP, `run-builds-${++copies}`);
  fs.cpSync(FIXTURE, dir, { recursive: true });
  return dir;
}
function setPieces(dir: string, pieces: unknown, a11 = false): void {
  const file = path.join(dir, 'reports', 'gates', 'D1-gate-r1-a-1-a1.json');
  const gate = JSON.parse(fs.readFileSync(file, 'utf8'));
  gate.design.pieces = pieces;
  // Amendment 11: a design field written under its rules carries Appendix A's additions (here each rung's trades).
  if (a11) for (const r of gate.design.rungs) r.trades = [];
  fs.writeFileSync(file, `${JSON.stringify(gate, null, 2)}\n`);
}

// D1-build's pieces.md, as its Writes section shows it.
const D1_BUILD = rawStage('D1-build');
const PIECES_EXAMPLE = blockAfter(D1_BUILD, "**`pieces.md`**, the build's");
const EXAMPLE_ROWS = tableRows(PIECES_EXAMPLE, PIECES_HEADER);
/** The design field's pieces from a pieces.md table, by D1-gate's rule: rows counted by Status, names in order. */
function piecesOf(rows: string[][]) {
  const cols = PIECES_HEADER.slice(1, -1).split('|').map((c) => c.trim());
  const status = cols.indexOf('Status');
  const piece = cols.indexOf('Piece');
  const named = (s: string) => rows.filter((r) => r[status] === s).map((r) => r[piece]);
  return { in: named('in').length, scheduled: named('scheduled').length, out: named('out').length, scheduledNames: named('scheduled'), outNames: named('out') };
}

describe('AC-W86 (WU-107): the spec\'s formats this test reads', () => {
  it('reads §6\'s four questions, §9\'s pieces field and Appendix A\'s pieces.md and Pieces columns', () => {
    expect([...SPEC_QUESTIONS.keys()]).toEqual([16, 17, 18, 19]);
    expect(SPEC_FIELDS).toEqual(['in', 'scheduled', 'out', 'scheduledNames', 'outNames']);
    expect(PIECES_HEADER).toBe('| Key | Piece | Kind | Status | Where | Why | From |');
    expect(PIECES_MD_FORM).toContain('`# Pieces: <build name>`');
    expect(PIECES_MD_FORM).toContain('`- Q<n> after <the change>: searched <what>; found <result>`');
  });
});

describe('AC-W86: D1-build keeps synthesizing (D-434)', () => {
  const build = stage('D1-build');
  const pieces = folded(between(D1_BUILD, '**The pieces: the design keeps synthesizing** (D-434)', '**One tree track**'));

  it('reads the composite\'s Pieces tables, the deck\'s Pieces not used and its own pieces.md', () => {
    expect(build).toMatch(/a composite's `### Pieces` and `### Pieces measured` tables/);
    expect(build).toMatch(/the deck's `## Pieces not used` \(Grep `-A11 "\^## Pieces not used"` in `cards\.md`\), and `<buildFolder>\/pieces\.md` when an earlier attempt wrote it/);
    expect(pieces).toMatch(/start from its Pieces table \(each piece in, scheduled or out, with why\), its Pieces measured \(each piece's drops\) and the deck's `## Pieces not used`/);
    expect(pieces).toMatch(/A plain card's pieces are those its links table names, keyed `c<card id>-<m>`/);
  });

  it('asks questions 15–19 again after a conversion, a keystone or a limit named as a con, with the type-conversion entries', () => {
    expect(pieces).toMatch(/\*\*Ask the synthesis questions again\*\* whenever the design adds a conversion or a keystone, or would name a limit as a con: the library's questions 15–19/);
    for (const title of ['Type conversion so another mechanic applies', "Convert into the ailment's type"]) {
      expect({ title, named: pieces.includes(`"${title}"`), inLibrary: entry(title).length > 0 }).toEqual({ title, named: true, inLibrary: true });
    }
    expect(pieces).toMatch(/write a `## Searched` line for each/);
  });

  it('revisits an out piece whose reason the design changed', () => {
    expect(pieces).toMatch(/\*\*Revisit an out piece\*\* whose reason the design changed \(Zerphi's Infamy, out because the build spends mana, once Blood Magic moves the costs to life\)/);
  });

  it('judges a piece with the pieces it needs, measuring the set on the total and each group by D-433\'s three figures, never summed', () => {
    expect(pieces).toMatch(/\*\*Judge a piece with the pieces it needs,\*\* measuring the set together, before rejecting any of them/);
    expect(pieces).toMatch(/Compare on each of the three kinds of figure \(D-433\), the total and each group, never summed across groups/);
    expect(pieces).toMatch(/\*\*per second, for clear\*\*, each enabled `clear` group's figure, the named source's Count-scaled one first/);
    expect(pieces).toMatch(/\*\*per corpse\*\*, each on-kill group's \(a corpse explosion's\) hit and its ignite per corpse/);
    expect(pieces).toMatch(/\*\*for bosses\*\*, each enabled `single_target` group's figure/);
    // Amendment 11 (WU-115, D-437): the total is the named source's damage figure against map monsters, not "headline DPS".
    expect(pieces).toMatch(/the total is the named source's damage figure against map monsters, the key-figure line's `damage <map> against map monsters` \(`measures\.damage\.map`\)/);
    expect(pieces).not.toMatch(/headline DPS/);
    expect(pieces).toMatch(/a disabled group's counting as 0/);
    // Leaving a piece out by its kind, as D-433 lists the kinds.
    for (const kind of ['a support removed from its group', "a skill's group disabled", "a unique replaced by the slot's plain base of the same base type", "a rare's mod line or a rune removed from the item", 'a node with the nodes that depend on it', 'a keystone with the custom modifiers that stand for it', 'a config condition turned off']) {
      expect({ kind, listed: pieces.includes(kind) }).toEqual({ kind, listed: true });
    }
    expect(pieces).toMatch(/remove the stage before you finish/);
  });

  it('schedules before rejecting, a second weapon set included (question 18)', () => {
    expect(pieces).toMatch(/\*\*Schedule before rejecting\*\* \(question 18\): a piece that fights another goes on its own button \(a `single_target` group for bosses/);
    expect(pieces).toMatch(/its own weapon set \(`skills\.groups\[\]\.weaponSet`/);
    expect(pieces).toMatch(/It is out only when no schedule holds both sides and it is worth less than the piece it fights/);
  });

  it('answers question 19 on every build whose clear skill is limited or pack-shaped', () => {
    expect(pieces).toMatch(/\*\*Answer question 19\*\* on every build whose clear skill is limited \(a cost, a cooldown, a charge count\) or shaped for packs: a boss button, or why none is needed, in a `## Searched` line/);
  });

  it('writes pieces.md, Appendix A\'s form with `## Searched`, outside the round copy; the header\'s writes name it as the task header does', () => {
    expect(build).toContain('`writes: ["<buildFolder>/plan.json", "<buildFolder>/pieces.md"]`');
    expect(folded(read(path.join(SKILL_DIR, 'references', 'task-header.md')))).toMatch(/D1-build's `<buildFolder>\/pieces\.md` too \(D-434\)/);
    const writes = folded(between(D1_BUILD, '## Writes', '## Returns'));
    expect(writes).toMatch(/^## Writes `<buildFolder>\/plan\.json` and `<buildFolder>\/pieces\.md` \(D-434\), nothing else/);
    expect(writes).toMatch(/No round copy takes it, and the checker's `--changed` doesn't list it: only D1-build writes it/);
    expect(writes).toMatch(/\*\*Title:\*\* `# Pieces: <build name>`/);
    expect(writes).toMatch(/\*\*`## Searched`:\*\* one line per question asked again, `- Q<n> after <the change>: searched <what>; found <result>`/);
    // The example: Appendix A's title, the card's Pieces columns (run-log.mjs's too), and `## Searched` lines.
    const lines = PIECES_EXAMPLE.split('\n');
    expect(lines[0]).toMatch(/^# Pieces: \S/);
    expect(lines).toContain(PIECES_HEADER);
    const runLogColumns = /export const PIECES_COLUMNS = \[([^\]]*)\]/.exec(read(RUN_LOG))?.[1] ?? '';
    expect(`| ${[...runLogColumns.matchAll(/'([^']+)'/g)].map((m) => m[1]).join(' | ')} |`).toBe(PIECES_HEADER);
    const statuses = EXAMPLE_ROWS.map((r) => r[3]);
    for (const s of ['in', 'scheduled', 'out']) expect({ s, shown: statuses.includes(s) }).toEqual({ s, shown: true });
    expect(EXAMPLE_ROWS.every((r) => r.length === 7 && (r[3] === 'in' || r[5] !== ''))).toBe(true);
    const searched = lines.slice(lines.indexOf('## Searched') + 1).filter((l) => l.startsWith('- '));
    expect(searched.length).toBeGreaterThan(0);
    for (const l of searched) expect({ l, form: /^- Q(1[5-9]) after .+: searched .+; found .+$/.test(l) }).toEqual({ l, form: true });
    expect(searched.some((l) => l.startsWith('- Q19 '))).toBe(true);
  });

  it('edits pieces.md in the fix round when a piece moves or a question is asked again', () => {
    expect(folded(between(D1_BUILD, '## The fix round and revisions', '## Writes'))).toMatch(/\*\*`pieces\.md`:\*\* when a change moves a piece in, scheduled or out, edit its row; when it asks a question again .*, add its `## Searched` line/);
  });

  it('returns the `pieces:` line within its 8 lines', () => {
    const returns = between(D1_BUILD, '## Returns', '## Fault directives');
    expect(returns).toMatch(/At most 8 lines/);
    expect(folded(returns)).toMatch(/and one line `pieces: <n> in, <n> scheduled, <n> out`, `pieces\.md`'s rows counted by Status \(D-434\)/);
    const examples = [...returns.matchAll(/```\n([\s\S]*?)\n```/g)].map((m) => m[1].split('\n'));
    expect(examples.length).toBeGreaterThan(0);
    for (const ex of examples) {
      expect({ ex, eight: ex.length <= 8, pieces: ex.some((l) => /^pieces: \d+ in, \d+ scheduled, \d+ out$/.test(l)) }).toEqual({ ex, eight: true, pieces: true });
    }
  });

  it('lists a node a custom modifier depends on as a need (D-418, D-434)', () => {
    const needs = folded(between(D1_BUILD, '**The needs** (D-418', "**The tree's shape**"));
    expect(needs).toMatch(/- a node a custom modifier depends on \(the keystone whose conversion the modifier stands for\), so node power's swaps never drop it while the modifier stays \(D-434\)/);
  });
});

describe('AC-W86: D1-finish writes the pieces\' claims (D-434)', () => {
  const finish = stage('D1-finish');

  it('reads pieces.md and writes a reason claim for each scheduled piece and each composite piece left out; `left out:` stays for dead gems', () => {
    expect(finish).toMatch(/`<buildFolder>\/pieces\.md` \(D-434\), when D1-build wrote it: its `scheduled` and `out` rows, for step 4's pieces' claims/);
    expect(finish).toMatch(/`reason`, for the pieces \(D-434\), from `pieces\.md`: one claim for each `scheduled` row/);
    expect(finish).toMatch(/and one for each piece the card's `### Pieces` weighed that the build leaves out \(its row's Why\) on the first endgame stage, so W1 can explain the boss button and the swap/);
    expect(finish).toMatch(/The `left out:` lines \(D-396\) stay for dead gems/);
    // The claim cites the record's figure for the group, in the source form plan-reference.md documents.
    expect(finish).toContain('`<stageId>.g<group>s<skill>p<statSet>.<Field>`');
    expect(read(path.join(REPO, 'docs', 'build-guide', 'plan-reference.md'))).toContain('`<stageId>.g<group>s<skill>p<statSet>.<Field>`');
  });
});

describe('AC-W86: D1-gate writes the design field\'s pieces (D-434), in the shape run-log.mjs displays', () => {
  const gateRaw = rawStage('D1-gate');
  const gate = folded(gateRaw);
  const example = JSON.parse(blockAfter(gateRaw, '## Writes'));

  it('states the field once for the build, read from pieces.md, with §9\'s names less amendment 11\'s outNames', () => {
    expect(A11_SPEC).toContain('`pieces` loses `outNames`');
    expect(gate).toMatch(/First `pieces` \(D-434\), once for the build, since pieces belong to the build, not a rung: `\{in, scheduled, out, scheduledNames\}` from `pieces\.md`'s table, `in`, `scheduled` and `out` its rows counted by Status/);
    expect(gate).toContain(`\`{${A11_PIECES_FIELDS.join(', ')}}\``);
    expect(gate).toMatch(/`scheduledNames` the Piece of each `scheduled` row, in the table's order; the display prints it as `- Pieces: <n> in, <n> scheduled \(<names>\), <n> out`, counting the out pieces without naming them \(D-442\)/);
    expect(gate).not.toContain('outNames');
    expect(gate).toMatch(/Leave `pieces` out when the build's folder has no `pieces\.md`/);
    expect(gate).toMatch(/and `<buildFolder>\/pieces\.md`'s table \(D-434\), when the build has one, for step 6/);
    // run-log.mjs reads the same names.
    expect(read(RUN_LOG)).toContain(`\`pieces {${SPEC_FIELDS.join(', ')}}\``);
  });

  it('its verdict example carries pieces first, before the rungs, each count matching its names', () => {
    expect(Object.keys(example.design)[0]).toBe('pieces');
    const p = example.design.pieces;
    expect(Object.keys(p)).toEqual(A11_PIECES_FIELDS);
    for (const k of ['in', 'scheduled', 'out']) expect({ k, whole: Number.isInteger(p[k]) && p[k] >= 0 }).toEqual({ k, whole: true });
    expect(p.scheduledNames).toHaveLength(p.scheduled);
  });

  it('the design display prints the example\'s pieces, and the pieces of D1-build\'s pieces.md example, once, before the rungs', () => {
    const dir = copyFixture();
    setPieces(dir, example.design.pieces, true);
    const own = example.design.pieces;
    const named = (names: string[]) => (names.length ? names.join(', ') : 'none');
    // Amendment 11 (D-442): the out pieces are counted, not named.
    const line = `- Pieces: ${own.in} in, ${own.scheduled} scheduled (${named(own.scheduledNames)}), ${own.out} out`;
    const out = display(dir, 'design', '--build', 'r1-a-1');
    expect(out.filter((l) => l.startsWith('- Pieces:'))).toEqual([line]);
    expect(out.indexOf(line)).toBeLessThan(out.findIndex((l) => /^Entering maps/.test(l)));

    // D1-build's example, read into the field by D1-gate's rule, through the same display.
    fs.writeFileSync(path.join(dir, 'builds', 'r1-a-1', 'pieces.md'), `${PIECES_EXAMPLE}\n`);
    const { outNames: _outNames, ...fromExample } = piecesOf(EXAMPLE_ROWS);
    setPieces(dir, fromExample, true);
    expect(fromExample.scheduled).toBeGreaterThan(0);
    expect(display(dir, 'design', '--build', 'r1-a-1')).toContain(
      `- Pieces: ${fromExample.in} in, ${fromExample.scheduled} scheduled (${fromExample.scheduledNames.join(', ')}), ${fromExample.out} out`,
    );
  });
});

// Amendment 11 (WU-114, D-443) removes the rival and deletes `references/stages/RV.md`, so this file no longer holds
// its block ("the rival asks 11–19 and is placed under composites"); tests/static/buildGuideAmendment11Research.test.ts
// checks that RV.md is gone and that no reference runs a rival.

describe('AC-W86: the library holds questions 16–19 and the two amended entries, under its cap (D-431)', () => {
  const section = libraryHeadings.find((h) => h.level === 2 && h.title.startsWith('Brainstorm questions 11–'));
  const questions = section ? numbered(bodyOf(section), 11, 19) : new Map<number, string>();

  it('asks 16–19 after 15, in one section named for 11–19', () => {
    expect(section?.title).toBe('Brainstorm questions 11–19: the engine and the synthesis');
    expect([...questions.keys()]).toEqual([11, 12, 13, 14, 15, 16, 17, 18, 19]);
    // Amendment 11 (WU-115, D-443): the rival is removed, so the library's line 34 no longer names it.
    expect(folded(bodyOf(section!))).toMatch(/Questions 15–19 are the synthesis questions \(D-431\): the synthesis asks them of each composite, and D1-build again after a conversion, a keystone or a limit named as a con\./);
    expect(folded(bodyOf(section!))).not.toMatch(/\brival/);
    expect(library).not.toMatch(/11–15/);
  });

  it('words each of 16–18 as §6 does, every sentence, and 19 as amendment 12 §13 rewrites it (D-458)', () => {
    for (const [n, specText] of SPEC_QUESTIONS) {
      if (n === 19) continue;
      const ours = plain(questions.get(n) ?? '');
      for (const sentence of plain(specText).split(/(?<=[.?])\s+/)) {
        expect({ n, sentence, held: ours.includes(sentence) }).toEqual({ n, sentence, held: true });
      }
    }
    // Amendment 12 §13 (P6): question 19 for every build, in the text it quotes.
    expect(questions.get(19)).toBe(A12_QUESTION_19);
    // The pointers each question names are entries of the library.
    for (const title of ["Convert into the ailment's type", 'Cost redirection', 'Payoff thief (anti-pattern)']) {
      expect({ title, entry: entry(title).length > 0 }).toEqual({ title, entry: true });
    }
  });

  it("amends Cost redirection's Search and Payoff thief as §6 words them", () => {
    const changes = folded(between(SECTION_6, 'Two entries change:', '\n\n'));
    const cost = /\*\*Cost redirection:\*\* its Search also starts from (.*?), not only from (.*?)\./.exec(changes);
    expect(cost).not.toBeNull();
    const search = field(entry('Cost redirection'), 'Search');
    expect(search).toContain(cost![1]);
    expect(search).toContain(cost![2]);
    const thief = /\*\*Payoff thief \(anti-pattern\):\*\* (.*?)\./.exec(changes);
    expect(thief).not.toBeNull();
    const ours = folded(entry('Payoff thief (anti-pattern)')).toLowerCase();
    expect(ours).toContain(thief![1].toLowerCase());
    expect(field(entry('Payoff thief (anti-pattern)'), 'Cautions')).toMatch(/^re-run it whenever a consumer joins\./);
  });

  it('stays under its word cap, the Standard kits under their own limit (provisional)', () => {
    expect(words(library)).toBeLessThanOrEqual(LIBRARY_WORD_CAP);
    const kits = libraryHeadings.find((h) => h.level === 2 && h.title === 'Standard kits')!;
    expect(words(bodyOf(kits))).toBeLessThan(KITS_WORD_LIMIT);
  });

  it("agrees with R1a-synthesize's one-line glosses of 16–19", () => {
    const synth = stage('R1a-synthesize');
    const glosses: [number, string][] = [
      [16, "Search each layer's payoff by its damage type after conversion, and weigh it by the hit that starts it: an ailment pays on a big, slow hit more than on a fast one"],
      [17, 'what removes the cap rather than feeding it'],
      [18, 'Schedule the conflict before leaving a piece out'],
      // Amendment 12 §13 rewrote question 19 ("name the boss button" on every build); the synthesis gloss and the
      // library still share its condition.
      [19, 'when the clear skill is capped by a limit or shaped for packs'],
    ];
    for (const [n, gloss] of glosses) {
      expect({ n, gloss, synthesis: synth.toLowerCase().includes(gloss.toLowerCase()), library: (questions.get(n) ?? '').toLowerCase().includes(gloss.toLowerCase()) }).toEqual({ n, gloss, synthesis: true, library: true });
    }
  });
});
