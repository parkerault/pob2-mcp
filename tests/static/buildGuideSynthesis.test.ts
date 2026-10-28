/**
 * Amendment 10 (M-23), WU-104: AC-W83, one build from the whole brainstorm in the skill text (D-429, D-430, D-432,
 * and D-433's two tables).
 *
 * - `references/stages/R1a.md`: the research file's `## Ideas` in Appendix A's line form, at most 25 lines, the cards'
 *   lines first, a later round's only new, the supply search's suppliers among them (D-430).
 * - `references/stages/R1a-synthesize.md` (new): structures keyed by identity, or by engine when every card shares
 *   one; 1 to 4 composites from every card and the Ideas; the tie-break; a split; the obvious card as a baseline
 *   judged as written; `## Cards`; a later round recomposing only gained structures under new ids and names, never a
 *   verified or built composite; R1a-assemble's identity, lock, sniff and name steps cited; Appendix A's deck, the
 *   composite's `### Pieces`, its interface and its return.
 * - `templates/card-template.md`: `### Pieces` and `### Pieces measured`, and the id letter `s`.
 * - The task header, the stages README, the run-folder layout and the researcher's and coordinator's definitions
 *   name `R1a-synthesize`.
 *
 * The formats are read from the amendment's Appendix A (the key, the Ideas line, the two tables, the deck's H2s, the
 * interface), so the skill text is held to the spec; R1a-assemble's step numbers are read from its own file, so the
 * citation can't drift from the steps it cites.
 */
import { describe, it, expect } from '@jest/globals';
import fs from 'fs';
import path from 'path';

const REPO = path.resolve(__dirname, '..', '..');
const SKILL_DIR = path.join(REPO, '.claude', 'skills', 'build-guide');
const STAGES_DIR = path.join(SKILL_DIR, 'references', 'stages');
const AGENTS_DIR = path.join(REPO, '.claude', 'agents', 'build-guide');
const SPEC = path.join(REPO, 'docs', 'build-guide', 'spec', 'amendment-10-synthesis.md');

const read = (file: string) => (fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '');
/** One paragraph or list item per entry, with its line breaks folded, so a rule split over lines reads whole. */
const folded = (text: string) => text.replace(/\s*\n\s*/g, ' ');
const rawStage = (name: string) => read(path.join(STAGES_DIR, `${name}.md`));
const stage = (name: string) => folded(rawStage(name));
const ref = (name: string) => folded(read(path.join(SKILL_DIR, 'references', name)));
const TEMPLATE = read(path.join(SKILL_DIR, 'templates', 'card-template.md'));
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
  const m = /```\n([\s\S]*?)\n```/.exec(text.slice(at));
  if (!m) throw new Error(`no fenced block after ${JSON.stringify(marker)}`);
  return m[1];
}

/** Headings outside fenced blocks, with their line numbers. */
function headings(text: string): { level: number; title: string; line: number }[] {
  const out: { level: number; title: string; line: number }[] = [];
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

/** Appendix A's Ideas line, its eight kinds, and the two tables' header rows. */
const IDEAS_LINE = blockAfter(appendix, '**An Ideas line**').trim();
const KINDS = (() => {
  const m = /`<kind>` is one of ((?:`[a-z]+`(?:, | or )?)+)/.exec(folded(appendix));
  if (!m) throw new Error("Appendix A doesn't list the Ideas line's kinds");
  return [...m[1].matchAll(/`([a-z]+)`/g)].map((k) => k[1]);
})();
const PIECES_BLOCK = blockAfter(appendix, '**The card\'s tables.**');
const PIECES_HEADER = PIECES_BLOCK.split('\n').slice(2, 4);
const MEASURED_HEADER = blockAfter(appendix, 'after `### Key item prices`').split('\n').slice(2, 4);
/** Amendment 11 (D-436, its Appendix A): the Pieces measured table's header, which replaces amendment 10's. */
const A11_APPENDIX = (() => {
  const a11 = read(path.join(REPO, 'docs', 'build-guide', 'spec', 'amendment-11-live-test-fixes.md'));
  return a11.slice(a11.indexOf('## Appendix A. Formats'));
})();
const MEASURED_HEADER_A11 = /`(\| Key \|[^`]*\|)`/.exec(between(A11_APPENDIX, '### Pieces measured (the card)', '\n### '))?.[1] ?? '';
/** Appendix A's deck: its H2s in order, `Round <k>` standing for every round. */
const DECK_H2 = blockAfter(appendix, '**`cards.md`**')
  .split('\n')
  .filter((l) => /^## /.test(l))
  .map((l) => l.replace(/^## /, '').replace(/\s{2,}.*$/, ''));
/** Appendix A's interface for R1a-synthesize, folded. */
const INTERFACE = folded(between(appendix, "**`R1a-synthesize`'s interface.**", '**`pieces.md`**'));

describe('AC-W83: the formats this unit writes, read from amendment 10 Appendix A', () => {
  it('reads the Ideas line, the eight kinds, both tables, the deck and the interface', () => {
    expect(IDEAS_LINE).toMatch(/^- i<k><letter>-<m> \| <piece> \| <kind> \| role: .* \| on: <card ids \| none>\[ \| under-played: <the shape>\]$/);
    expect(KINDS).toEqual(['skill', 'support', 'unique', 'mod', 'node', 'keystone', 'rune', 'config']);
    expect(PIECES_HEADER).toEqual(['| Key | Piece | Kind | Status | Where | Why | From |', '|---|---|---|---|---|---|---|']);
    expect(MEASURED_HEADER).toEqual(['| Key | Drops | How |', '|---|---|---|']);
    expect(DECK_H2).toEqual(['What the composites share', 'How they differ', 'The obvious build', 'Round <k>', 'Cards', 'Pieces not used', 'Not composed', 'Superseded']);
    expect(INTERFACE).toMatch(/Returns at most 7 lines/);
  });
});

describe('AC-W83: R1a.md asks for `## Ideas` (D-430)', () => {
  const raw = rawStage('R1a');
  const text = stage('R1a');

  it("puts `## Ideas` in the research file's form, after the Supply search and before `## Sources`, in Appendix A's line form", () => {
    const form = blockAfter(raw, '**The research file**');
    const h2 = form.split('\n').filter((l) => /^## /.test(l)).map((l) => l.replace(/\s{2,}.*$/, ''));
    const at = (h: string) => h2.indexOf(h);
    expect(at('## Ideas')).toBeGreaterThan(at('## Supply search: <family>'));
    expect(at('## Sources')).toBe(h2.length - 1);
    expect(form.split('\n')).toContain(IDEAS_LINE);
  });

  it('caps the lines at 25, the cards\' lines first, then the widest spread of roles; the suppliers are lines too', () => {
    expect(text).toMatch(/\*\*The Ideas\*\* \(D-430\), every focus: `## Ideas`, after your focus's sections .* before `## Sources`, one line per piece you confirmed in game text, used on your cards or not, \*\*at most 25 lines\*\*/);
    expect(text).toMatch(/The lines your cards use come first, then the widest spread of roles/);
    expect(text).toMatch(/The supply search's suppliers \(D-404\) are Ideas lines too/);
    expect(text).toMatch(/The synthesis takes a line's lookup as its confirmation \(D-430\)/);
    for (const kind of KINDS) expect({ kind, named: text.includes(`\`${kind}\``) }).toEqual({ kind, named: true });
  });

  it("has a later round write only pieces the earlier rounds' Ideas lack, by Grep", () => {
    expect(text).toMatch(/\*\*A later round's Ideas\*\* \(D-430\): write only pieces the earlier rounds' Ideas lack\. Grep their `## Ideas` lines/);
  });

  it("keeps a researcher's cards plain, with no Pieces tables, and names the synthesis as the next step", () => {
    expect(text).toMatch(/Your cards are plain cards: leave out the template's `### Pieces` and `### Pieces measured`/);
    expect(text).toMatch(/A coordinator step then composes the round's builds from every card and the research files' Ideas \(`R1a-synthesize\.md`, D-429/);
  });
});

describe('AC-W83: R1a-synthesize.md (D-429, D-432, Appendix A\'s interface)', () => {
  const raw = rawStage('R1a-synthesize');
  const text = stage('R1a-synthesize');
  const work = folded(between(raw, '## Work', '## Writes'));

  it('exists with the parts every stage reference has, as a coordinator step', () => {
    expect(raw).toMatch(/^# R1a-synthesize: .*\(`build-guide-coordinator`\)/);
    const h2 = headings(raw).filter((h) => h.level === 2).map((h) => h.title);
    for (const part of ['Inputs', 'Work', 'Writes', 'Returns', 'Fault directives']) {
      expect({ part, present: h2.some((t) => t.startsWith(part)) }).toEqual({ part, present: true });
    }
  });

  it("takes the interface's header: the stage, no compile, the deck and the composites' cards in its writes", () => {
    const writes = /`writes: \[[^\]]*\]`/.exec(INTERFACE)![0];
    expect(text).toContain('`stage: "R1a-synthesize"`');
    expect(text).toContain('`compile: "none"`');
    expect(text).toContain(writes);
    expect(text).toMatch(/`researchers`, each `\{letter, focus, researchFile, cards, returned\}`/);
  });

  it("reads only what the interface names: brainstorm halves, the Ideas and Supply search, cards.md, the template, the vocabulary, the library's entries by Grep", () => {
    const inputs = between(raw, '## Inputs', '## Work');
    const readList = folded(between(inputs, '- **Read**', '\n\n'));
    for (const item of ["every card's brainstorm half", '`## Ideas`', '`## Supply search`', '`cards.md`', '`.claude/skills/build-guide/templates/card-template.md`', '`data/rules/vocabulary.md`', '`.claude/skills/build-guide/references/patterns.md` and Read those entries only']) {
      expect({ item, read: readList.includes(item) }).toEqual({ item, read: true });
    }
    // The gate-made cards and the earlier rounds' are among the cards read; amendment 11 (WU-114, D-443) removes the
    // rival, whose card an older run's resume may still hold.
    expect(readList).toMatch(/this round's .*, the earlier rounds', the gate-made ones \(`r<j>-g-<n>`\) and the earlier composites \(`r<j>-s-<n>`\)/);
    // Nothing beyond the interface: no dossier, run log, interview notes or plan.
    const allowed = new Set(['cards/', 'research/', 'cards.md', '.claude/skills/build-guide/templates/card-template.md', 'data/rules/vocabulary.md', '.claude/skills/build-guide/references/patterns.md']);
    const paths = [...readList.matchAll(/`([^`]+)`/g)].map((m) => m[1]).filter((p) => /\/|\.md$|\.json$/.test(p) && !/^r<j>/.test(p));
    expect(paths.filter((p) => !allowed.has(p))).toEqual([]);
    expect(folded(inputs)).not.toMatch(/dossier\.md|run-log\.json|interviews\//);
    // Every repository path the step names exists.
    for (const m of raw.matchAll(/`((?:\.claude|docs|data)\/[^`\s]*)`/g)) {
      expect({ path: m[1], exists: fs.existsSync(path.join(REPO, m[1])) }).toEqual({ path: m[1], exists: true });
    }
  });

  it('keys structures by identity, or by engine when every card shares one identity, `none` one key', () => {
    expect(work).toMatch(/A structure is the card's identity `\{className, ascendancy, named damage source\}`/);
    expect(work).toMatch(/When every card shares one identity \(a fixed roll, .*\), key the structures by engine instead/);
    expect(work).toMatch(/`<consumed> from <supply>`, from each card's `Consumes or requires: <X>, supplied by <Y>` line, each one word of `data\/rules\/vocabulary\.md` \(D-405\)/);
    expect(work).toMatch(/Every card whose consumed word is `none` shares the one key `none`/);
    expect(work).toMatch(/D-405's cap of half a round on one engine doesn't apply/);
  });

  it('composes 1 to 4 composites a round, each from its strongest card and every piece of the pool: every card, the obvious card and the Ideas', () => {
    expect(work).toMatch(/\*\*At most 4 composites a round\*\* \(D-429; NFR-23 as amended\): one per structure, 1 to 4/);
    expect(work).toMatch(/Start from its \*\*strongest card\*\*, the one whose links table confirms most \(ties: the lower id\)/);
    expect(work).toMatch(/take every piece of the pool that fits it: the structure's other cards, the other structures' cards, the obvious card, and the research files' Ideas \(D-430\)/);
    expect(work).toMatch(/Each piece is in, scheduled or out, with its reason, by the \*\*synthesis questions\*\*, the pattern library's brainstorm questions 15 to 19 \(D-431\)/);
    for (const q of ['**15, climb the chain:**', '**16, breadth:**', '**17, the limit:**', '**18, conflicts:**', '**19, bosses:**']) {
      expect({ q, asked: work.includes(q) }).toEqual({ q, asked: true });
    }
    expect(work).toMatch(/Schedule the conflict before leaving a piece out/);
  });

  it('applies the tie-break when structures number more than 4, the rest under `## Not composed`', () => {
    expect(work).toMatch(/When the structures to compose, with splits, number more than 4, keep those whose cards confirm the most load-bearing links, summed over the structure's cards/);
    expect(work).toMatch(/ties: the lower first card id\)\. The rest go under `## Not composed`/);
  });

  it('splits a conflict that cannot be scheduled into two composites, one per side, within the 4', () => {
    expect(work).toMatch(/\*\*A conflict that can't be scheduled splits\*\* the structure into two composites, one per side .*, each taking a slot within the 4/);
  });

  it('keeps the obvious card as a baseline line, judged as written, never a composite', () => {
    expect(work).toMatch(/\*\*The obvious card\*\* \(D-403\), `r1-a-1` when it passes step 3, stays as the baseline: one line under `## The obvious build`, never a composite and never edited/);
    expect(work).toMatch(/It is \*\*judged as written\*\*, before any borrowing: its pieces join the pool, and the composite of its own structure says how it beats the card it grew from/);
  });

  it('trusts an Ideas line\'s lookup, looks up again only a load-bearing link with none, and runs the lock on every skill a composite takes', () => {
    expect(work).toMatch(/\*\*An Ideas line's lookup counts as its piece's confirmation\*\*/);
    expect(work).toMatch(/Run the sniff test's lookup \*\*only for a load-bearing link that has none\*\*/);
    expect(work).toMatch(/\*\*The ascendancy lock on every skill a composite takes\*\* \(D-342\)/);
  });

  it('moves a kept under-played label to the composite; a round short of 2 composites or of an under-played piece returns `short:`', () => {
    expect(work).toMatch(/\*\*A kept label moves to the composite that takes the piece\*\* \(in or scheduled\): the piece's row carries it in `Kind` \(`, under-played`\)/);
    expect(work).toMatch(/\*\*A short round\*\* \(D-339 as D-429 amends it\): the round composes fewer than 2, or none of its composites takes a piece marked under-played\. Give the reason in your return as one line, `short: <why>`/);
  });

  it('recomposes only structures that gained pieces, under new ids and names, the old under `## Superseded`', () => {
    expect(work).toMatch(/\*\*A later round\*\* adds its cards and Ideas to the pool, and recomposes only structures that gained pieces/);
    expect(work).toMatch(/is never edited in place by a later synthesis: its successor is a new composite of this round, under a new id and a new name, and the old one goes under `## Superseded`, `- <old id> "<name>" → <new id>`/);
  });

  it('never supersedes a verified or built composite', () => {
    expect(work).toMatch(/\*\*A verified or built composite is never superseded\*\*: .* a recomposition of its structure is a separate composite, with no `## Superseded` line/);
  });

  it("cites R1a-assemble.md's identity check with its lock (step 2), sniff test (step 3) and unique names (step 7), as that file numbers them", () => {
    const assemble = rawStage('R1a-assemble');
    expect(assemble).toMatch(/^2\. \*\*Check each card's identity\*\*/m);
    expect(folded(between(assemble, "2. **Check each card's identity**", '3. **The sniff test**'))).toMatch(/the ascendancy lock \(D-342\)/);
    expect(assemble).toMatch(/^3\. \*\*The sniff test\*\* \(D-287\)/m);
    // Amendment 11 (WU-114, D-442): the name rule joins step 7.
    expect(assemble).toMatch(/^7\. \*\*Unique names\*\* \(D-392, D-442\)/m);
    expect(text).toMatch(/The identity check with its ascendancy lock, the sniff test and unique names are `\.claude\/skills\/build-guide\/references\/stages\/R1a-assemble\.md`'s steps 2, 3 and 7/);
    expect(work).toMatch(/\*\*Check the cards\*\* of each structure you compose, by `R1a-assemble\.md`'s step 2: the identity check, the brief's fixed pieces and the ascendancy lock \(D-342\)/);
    expect(work).toMatch(/\*\*The sniff test\*\*, `R1a-assemble\.md`'s step 3/);
    expect(work).toMatch(/\*\*Names\*\* \(D-392, D-442\), by `R1a-assemble\.md`'s step 7/);
  });

  it("writes Appendix A's deck: its H2s in order, the round, card and obvious-build lines, the capped sections", () => {
    const deck = blockAfter(raw, '**`cards.md`** (D-432)');
    const h2 = deck.split('\n').filter((l) => /^## /.test(l)).map((l) => l.replace(/^## /, '').replace(/^Round \d+$/, 'Round <k>'));
    // The example is round 1, so it has no `## Superseded`, which only a later round's recomposition adds.
    expect(h2).toEqual(DECK_H2.filter((h) => h !== 'Superseded'));
    expect(text).toMatch(/\*\*`## Superseded`\*\*, only once a later round recomposed: `- <old id> "<name>" → <new id>`/);
    const share = deck.slice(deck.indexOf('## What the composites share') + 30, deck.indexOf('## How they differ'));
    expect(share.split(/\s+/).filter(Boolean).length).toBeLessThanOrEqual(80);
    // Each round line: id, name, structure, layers, the limit's answer[, the label], ` | `-separated.
    const rounds = deck.split('\n').filter((l) => /^- r\d+-s-\d+ /.test(l));
    expect(rounds.length).toBeGreaterThanOrEqual(2);
    for (const line of rounds) expect({ line, fields: line.split(' | ').length >= 4 }).toEqual({ line, fields: true });
    const cards = between(deck, '## Cards', '## Pieces not used').split('\n').filter((l) => l.startsWith('- '));
    for (const line of cards) expect({ line, form: /^- r\d+-[a-z]-\d+ "[^"]+" \| [^|]+ \| (seed \| )?fed: (none|r\d+-s-\d+(, r\d+-s-\d+)*)$/.test(line) }).toEqual({ line, form: true });
    expect(cards.filter((l) => / \| seed \| /.test(l)).length).toBe(1);
    expect(between(deck, '## The obvious build', '## Round')).toMatch(/^- r1-a-1 "[^"]+" \| \S/m);
    // The forms the stage states for each H2.
    expect(text).toMatch(/`## What the composites share`, the common core once, in player terms, in at most 80 words; `## How they differ`, one paragraph/);
    expect(text).toMatch(/- <id> "<name>" \| <structure> \| <layers> \| <the limit's answer> \| <under-played label>/);
    expect(text).toMatch(/every card of the run but this step's composites \(`r<j>-s-<n>`\), each `- <id> "<name>" \| <structure> \| seed \| fed: <composite ids \| none>`/);
    expect(text).toMatch(/\*\*`## Pieces not used`:\*\* at most 10 lines, the strongest first, each `- <key> <piece>: <why no composite takes it>`/);
  });

  it("writes each composite's card `cards/r<k>-s-<n>.md` with Appendix A's `### Pieces` and its key", () => {
    const writes = between(raw, '## Writes', '## Returns');
    expect(blockAfter(writes, '**`### Pieces`**')).toBe(PIECES_BLOCK);
    expect(text).toMatch(/\*\*A composite's card\*\*, `cards\/r<k>-s-<n>\.md` \(C-52, D-319's letter `s`\)/);
    expect(text).toMatch(/`### Pieces measured` among them, each with the one line `Not checked yet\.`, for R1b/);
    expect(text).toMatch(/\*\*Key:\*\* the piece's Ideas id, `i<k><letter>-<m>` .*, else `c<card id>-<m>`/);
    expect(text).toMatch(/\*\*Why:\*\* the job it does, required for `scheduled` and `out`/);
  });

  it('returns at most 7 lines in the interface\'s form', () => {
    const returns = between(raw, '## Returns', '## Fault directives');
    expect(folded(returns)).toMatch(/At most 7 lines: `composites: <n>`, then one line per composite of the round, `r<k>-s-<n>: <name>`/);
    const cardsLine = /`(cards: <n> listed \| not composed: <n> \| superseded: <n>)`/.exec(INTERFACE)![1];
    expect(folded(returns)).toContain(cardsLine);
    const examples = [...returns.matchAll(/```\n([\s\S]*?)\n```/g)].map((m) => m[1].split('\n'));
    expect(examples.length).toBeGreaterThanOrEqual(2);
    for (const lines of examples) {
      expect(lines.length).toBeLessThanOrEqual(7);
      const n = Number(/^composites: (\d+)$/.exec(lines[0])?.[1]);
      expect(lines.filter((l) => /^r\d+-s-\d+: \S/.test(l)).length).toBe(n);
      expect(lines.some((l) => /^cards: \d+ listed \| not composed: \d+ \| superseded: \d+$/.test(l))).toBe(true);
    }
    expect(examples.some((lines) => lines.some((l) => l.startsWith('short: ')))).toBe(true);
  });
});

describe('AC-W83: the card template has `### Pieces` and `### Pieces measured` (D-433), and the id letter `s`', () => {
  const hs = headings(TEMPLATE);
  const h3Under = (half: string) => {
    const at = hs.find((h) => h.level === 2 && h.title === half)!;
    const next = hs.find((h) => h.line > at.line && h.level <= 2);
    return hs.filter((h) => h.level === 3 && h.line > at.line && h.line < (next?.line ?? Infinity)).map((h) => h.title);
  };
  const lines = TEMPLATE.split(/\r?\n/);
  const tableUnder = (title: string) => {
    const at = hs.find((h) => h.level === 3 && h.title === title)!;
    return lines.slice(at.line + 1).filter((l) => l.startsWith('|')).slice(0, 2);
  };

  it('puts `### Pieces` right after `### Risks so far`, last in the brainstorm half, with Appendix A\'s columns', () => {
    const brainstorm = h3Under('Brainstorm half');
    expect(brainstorm.slice(-2)).toEqual(['Risks so far', 'Pieces']);
    expect(tableUnder('Pieces')).toEqual(PIECES_HEADER);
  });

  it('puts `### Pieces measured` right after `### Key item prices`, last in the verification half, with Appendix A\'s columns', () => {
    const verification = h3Under('Verification half');
    expect(verification.slice(-2)).toEqual(['Key item prices', 'Pieces measured']);
    // Amendment 11 (WU-114, D-436): the table's columns are amendment 11's Appendix A's, the answers in place of the drops.
    expect(tableUnder('Pieces measured')).toEqual([MEASURED_HEADER_A11, '|---|---|---|']);
  });

  it('marks both a composite\'s only, and gives a composite the id letter `s`', () => {
    const flat = folded(TEMPLATE);
    expect(flat).toMatch(/r<round>-s-<n> for a composite/);
    expect(flat).toMatch(/a card with "### Pieces" is a composite, whatever its id letter, and a plain card .* has neither/);
    expect(flat).toMatch(/\[only on a composite \(D-429, D-432\): this H3 and its table/);
    expect(flat).toMatch(/\[only on a composite \(D-433\): this H3 and its table/);
  });
});

describe('AC-W83: the task header, the stages README, the run folder and the definitions name R1a-synthesize', () => {
  const definition = (stem: string) => {
    const text = read(path.join(AGENTS_DIR, `${stem}.md`));
    const description = /^description: (.*)$/m.exec(text)?.[1] ?? '';
    return { text: folded(text), description };
  };

  it('task-header.md: the stage, the letter `s`, the synthesis\'s writes, piece keys in `changes.from`, `pieces.md` in D1-build\'s writes', () => {
    const header = ref('task-header.md');
    expect(header).toMatch(/\| `stage` \| `R1a`, `R1a-synthesize` \(the round's composites, D-429\), `R1a-assemble` \(in a run whose first brainstorm round used it\)/);
    expect(header).toMatch(/letter `s` for a composite, `r<k>-s-<n>`, D-429/);
    expect(header).toMatch(/R1a-synthesize's `cards\.md`, its composites' cards `cards\/r<k>-s-<n>\.md` and the round's cards, for a rename \(D-429, D-392\)/);
    expect(header).toMatch(/`\{visit, name, from, words\}` makes it, `from` the cards it draws on, composites included, and the piece keys \(a Pieces row's key or an Ideas line's id, D-432\)/);
    // Amendment 11 (WU-114): D1-tree's and D1-finish's trades.json follow it.
    expect(header).toMatch(/, D1-build's `<buildFolder>\/pieces\.md` too \(D-434\)/);
  });

  it('stages/README.md lists R1a-synthesize.md beside R1a-assemble.md', () => {
    expect(ref('stages/README.md')).toMatch(/`R1a\.md`, `R1a-synthesize\.md` \(the round's composites, D-429\), `R1a-assemble\.md` \(the deck, in a run whose first brainstorm round used it\)/);
  });

  it("run-folder.md: the composites' cards, cards.md's new writer, probes to 8 on a composite, and pieces.md in a build's folder", () => {
    const folder = ref('run-folder.md');
    expect(folder).toMatch(/or R1a-synthesize for a composite `r<k>-s-<n>` \(its brainstorm half, `### Pieces` included, D-429\)/);
    expect(folder).toMatch(/\| `cards\.md` \| the R1a-synthesize step \(the R1a-assemble step in a run whose first brainstorm round used it\)/);
    expect(folder).toMatch(/`n` from 1 to 4, or to 8 on a composite/);
    // Amendment 12 (WU-125, D-453): D1-tree writes its `## Jewel lines` there too.
    expect(folder).toMatch(/\| `builds\/<id>\/pieces\.md` \| D1-build \(D-434\); D1-tree its `## Jewel lines` only \(D-453\) \|/);
    // Amendment 11 (WU-114, D-443): an older run's rival card is named, in parentheses, between them.
    expect(folder).toMatch(/a composite R1a-synthesize writes `r<k>-s-<n>` \(D-429\)\. .* A card holding `### Pieces` is a composite, whatever its letter/);
  });

  it("the coordinator's description and research steps name R1a-synthesize, its stage reference, beside R1a-assemble's", () => {
    const coordinator = definition('build-guide-coordinator');
    expect(coordinator.description).toMatch(/the round's composites and the deck \(R1a-synthesize, or R1a-assemble in an older run\)/);
    expect(coordinator.text).toContain('| `R1a-synthesize` | `.claude/skills/build-guide/references/stages/R1a-synthesize.md` | the round\'s composites (D-429)');
    expect(coordinator.text).toContain('| `R1a-assemble` | `.claude/skills/build-guide/references/stages/R1a-assemble.md` | in a run whose first brainstorm round used it (D-429)');
    expect(fs.existsSync(path.join(STAGES_DIR, 'R1a-synthesize.md'))).toBe(true);
  });

  it("the researcher's description and body name its Ideas and the coordinator's R1a-synthesize", () => {
    const researcher = definition('build-guide-researcher');
    expect(researcher.description).toMatch(/writes one research file, its Ideas \(every piece it confirmed, the pool the coordinator's R1a-synthesize step composes builds from\) and 3 candidate cards/);
    expect(researcher.text).toMatch(/Your research file ends its findings with `## Ideas`, one line per piece you confirmed, before `## Sources` \(D-430\)/);
    // A plain YAML scalar may not hold ": " or " #": Claude Code would drop the definition.
    for (const d of [researcher.description, definition('build-guide-coordinator').description]) expect(d).not.toMatch(/: | #/);
  });
});
