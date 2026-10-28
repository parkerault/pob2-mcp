/**
 * AC-W74 (WU-90, amendment 8: D-403, D-409, static): the pattern library's new entries,
 * `.claude/skills/build-guide/references/patterns.md`.
 * - Brainstorm questions 11–14 as D-409 words them, after the first ten (which AC-W28 still counts), and question 9
 *   points to Standard kits. Question 15 and its entry, Scale the scaler (in Stat bridges), are the user's lens,
 *   approved 2026-10-23.
 * - "Standard kits" (D-403): one entry per archetype (minions, spells, attacks with each weapon family the studies
 *   cover, damage over time, totems), each with its kit and its levers; every line cites a study by key and section,
 *   the pinned data (`pin:`, a file the pin holds; "lookup" is the lookup tool's word), or the user; the minion
 *   kit carries the user's point on a tamed beast's percentage Spirit cost; about 1,200 words.
 *   Amended by D-410 (the Mobalytics review, approved by the user 2026-10-19): five more archetypes (companions,
 *   shapeshifting, plants, shields, automated loops), the tamed beast's line in the Companions kit, about 3,000 words.
 *   Amended by D-428 (amendment 9 §24, WU-103): a warcry kit after Totems.
 * - "A count as a multiplier" beside an unchanged "Filler to satisfy a count", the two pointing to each other.
 * - The four new shapes (supply by family, bank the resource, a tamed rare beast, a rule changer), each in a family
 *   with its search step, how PoB follows it (one of the six labels), examples and cautions.
 * - The library stays under 16,000 words (D-381, raised by D-410 and by amendment 9 §24.1, the user, 2026-10-23;
 *   16,000 and the kits' 4,000 are provisional since 2026-10-26: the user set the caps aside while the defence entries landed, to review the new size).
 * AC-W95 (WU-123, amendment 12 §13, D-458), the last describe block: questions 20–24, question 2's means, the enemy's
 * side, the section-4 and section-5 entries, the Attacks kit's Levers, the stale deflection lines with §4's floor, and
 * the trim's kept headings; question 19's text is in `buildGuideDesignPieces.test.ts`, the family list of 12 in
 * `buildGuidePipeline.test.ts` (AC-W28), the word caps in every word-count test.
 */
import { describe, it, expect } from '@jest/globals';
import fs from 'fs';
import path from 'path';

const REPO = path.resolve(__dirname, '..', '..');
const FILE = path.join(REPO, '.claude', 'skills', 'build-guide', 'references', 'patterns.md');
const PIN_SRC = path.join(REPO, 'vendor', 'PathOfBuilding-PoE2', 'src');
const text = fs.readFileSync(FILE, 'utf8');
const lines = text.split(/\r?\n/);

const folded = (s: string) => s.replace(/\s*\n\s*/g, ' ');
const POB_LABELS = ['modelled', 'Count', 'custom modifier', 'config stand-in', 'hand calculation', 'not modelled'];
const FIELDS = ['Shape', 'Search', 'PoB', 'Examples', 'Cautions'];

type Heading = { level: number; title: string; line: number };
const headings: Heading[] = [];
{
  let fenced = false;
  lines.forEach((line, i) => {
    if (/^\s*(```|~~~)/.test(line)) fenced = !fenced;
    else if (!fenced) {
      const h = /^(#{1,6})\s+(.*?)\s*$/.exec(line);
      if (h) headings.push({ level: h[1].length, title: h[2], line: i });
    }
  });
}

/** The body of the heading at `h`: its lines up to the next heading of its level or above. */
const bodyOf = (h: Heading) => {
  const end = headings.find((x) => x.line > h.line && x.level <= h.level)?.line ?? lines.length;
  return lines.slice(h.line + 1, end).join('\n');
};
/** The H3 headings under an H2, with their bodies (up to the next heading). */
const h3sUnder = (h2: Heading) => {
  const end = headings.find((x) => x.line > h2.line && x.level <= 2)?.line ?? lines.length;
  const h3 = headings.filter((x) => x.level === 3 && x.line > h2.line && x.line < end);
  return h3.map((h, i) => ({ ...h, body: lines.slice(h.line + 1, h3[i + 1]?.line ?? end).join('\n') }));
};
const h2 = (title: string) => headings.find((h) => h.level === 2 && h.title === title);
const families = headings.filter((h) => h.level === 2 && /^\d+\. /.test(h.title));
/** Every entry of the ten families, with the family it sits in. */
const entries = families.flatMap((f) => h3sUnder(f).map((e) => ({ family: f.title, ...e })));
const entry = (title: string) => entries.find((e) => e.title === title);
/** The `[key]: <path>` source definitions. */
const sources = new Map([...text.matchAll(/^\[([a-z0-9-]+)\]: (\S+)/gm)].map((m) => [m[1], m[2]]));
/** A bullet list's items, each folded onto one line. */
const bullets = (body: string) =>
  body
    .split(/\n(?=- )/)
    .map((b) => folded(b.trim()))
    .filter((b) => b.startsWith('- '));
const field = (body: string, name: string) => {
  const m = new RegExp(`^- \\*\\*${name}:\\*\\* ([\\s\\S]*?)(?=^- \\*\\*|(?![\\s\\S]))`, 'm').exec(body);
  return m ? folded(m[1]).trim() : '';
};

describe('AC-W74 (WU-90, D-403, D-409): the pattern library\'s new entries', () => {
  it('asks brainstorm questions 11–19 in their own section after the first ten, and question 9 points to Standard kits', () => {
    const first = h2('Brainstorm questions');
    expect(first).toBeDefined();
    const h2s = headings.filter((h) => h.level === 2);
    const engine = h2s[h2s.indexOf(first!) + 1];
    // Amendment 10 (WU-107, D-431): questions 16–19 follow 15 in the same section.
    expect(engine.title).toBe('Brainstorm questions 11–19: the engine and the synthesis');
    const body = bodyOf(engine);
    const numbered = [...body.matchAll(/^(\d+)\. ([\s\S]*?)(?=^\d+\. |(?![\s\S]))/gm)].map((m) => ({ n: Number(m[1]), q: folded(m[2]) }));
    expect(numbered.map((x) => x.n)).toEqual([11, 12, 13, 14, 15, 16, 17, 18, 19]);
    const want: [number, string[]][] = [
      [11, ['What does the obvious build do, and how is this card faster?', 'Standard kits']],
      [12, ['What grows with a count, and what pays for a bigger count?', 'A count as a multiplier']],
      [13, ['What does each premium slot serve?', 'search for a supply that frees it', 'Supply by family']],
      [14, ['Which rule changer touches this engine?', '`data/rules/pairs.md`', 'A rule changer']],
      [15, ['What scales the damage, what scales that, and what scales that?', 'as the target of another line', 'Scale the scaler']],
    ];
    for (const [n, parts] of want) {
      const q = numbered.find((x) => x.n === n)!.q;
      for (const part of parts) expect({ n, part, present: q.includes(part) }).toEqual({ n, part, present: true });
    }
    const nine = folded(bodyOf(first!)).match(/9\. (.*?) 10\. /)![1];
    expect(nine).toContain('Give it the standard kit before calling it weak.');
    expect(nine).toContain('Standard kits');
  });

  it('files Scale the scaler under Stat bridges, climbing by each link\'s name as a target, and records the user\'s approval', () => {
    const e = entry('Scale the scaler');
    expect(e?.family).toBe('4. Stat bridges');
    expect(field(e!.body, 'Search')).toContain("Search the last link's name as the target of a line");
    expect(field(e!.body, 'Cautions')).toContain('a ranking of single upgrades by DPS never climbs');
    const review = bullets(bodyOf(h2('How to read an entry')!)).find((b) => b.startsWith('- **Reviewed.**')) ?? '';
    expect(review).toContain('Question 15 and Scale the scaler are the user\'s lens (2026-10-23');
  });

  describe('Standard kits (D-403)', () => {
    const kits = h2('Standard kits');
    const archetypes = kits ? h3sUnder(kits) : [];
    const ARCHETYPES = [
      'Minions',
      'Companions (tamed beasts)',
      'Spells',
      'Attacks, any weapon',
      'Bows',
      'Crossbows',
      'Maces',
      'Quarterstaves',
      'Spears',
      'Damage over time',
      'Totems',
      'Warcries',
      'Shapeshifting (talismans)',
      'Plants',
      'Shields',
      'Automated loops',
    ];

    it('sits before the ten families, with one entry per archetype, each with its kit and its levers', () => {
      expect(kits).toBeDefined();
      expect(kits!.line).toBeLessThan(families[0].line);
      expect(archetypes.map((a) => a.title)).toEqual(ARCHETYPES);
      for (const a of archetypes) {
        const items = bullets(a.body);
        expect({ archetype: a.title, kit: items.some((b) => b.startsWith('- **Kit:** ')), levers: items.some((b) => b.startsWith('- **Levers:** ')) }).toEqual({ archetype: a.title, kit: true, levers: true });
      }
    });

    it('cites a source on every line: a study by its key and section, the pinned data (`pin:`), or the user', () => {
      const studyCite = /\[([a-z0-9-]+)\] (?:§\d|[a-z]+\b)/g;
      for (const a of archetypes) {
        for (const item of bullets(a.body)) {
          const studies = [...item.matchAll(studyCite)].map((m) => m[1]);
          const pin = /\(pin: |; pin: |, pin: /.test(item);
          const user = /\(the user, \[amendment-8\] §\d/.test(item);
          expect({ archetype: a.title, item, cited: studies.length > 0 || pin || user }).toEqual({ archetype: a.title, item, cited: true });
          for (const key of studies) expect({ item, key, defined: sources.has(key) }).toEqual({ item, key, defined: true });
        }
      }
    });

    it("names only `pin:` files the pin holds", () => {
      const body = bodyOf(kits!);
      const files = [...folded(body).matchAll(/pin: ((?:`[^`]+`(?:, |; )?)+)/g)].flatMap((m) => [...m[1].matchAll(/`([^`]+)`/g)].map((x) => x[1]));
      expect(files.length).toBeGreaterThan(10);
      expect(folded(body)).not.toMatch(/lookup: `/);
      for (const f of files) {
        const rel = f.replace(/:\d+(-\d+)?$/, '');
        expect({ f, exists: fs.existsSync(path.join(PIN_SRC, rel)) }).toEqual({ f, exists: true });
      }
    });

    it("carries the user's point on a tamed beast in the Companions kit: a percentage of Spirit, not a flat amount (D-410)", () => {
      const minions = folded(archetypes.find((a) => a.title === 'Minions')!.body);
      expect(minions).toMatch(/sceptre/);
      const companions = folded(archetypes.find((a) => a.title === 'Companions (tamed beasts)')!.body);
      expect(companions).toMatch(/\*\*Spirit:\*\* a tame reserves 13\.8–56\.1% of maximum Spirit \(32\.7% at the median\), not a flat amount \(the user, \[amendment-8\] §4/);
    });

    it('is about 3,000 words, under 4,000 (D-410; provisional)', () => {
      const words = bodyOf(kits!).split(/\s+/).filter(Boolean).length;
      expect(words).toBeGreaterThan(2500);
      expect(words).toBeLessThan(4000);
    });
  });

  it('puts "A count as a multiplier" right after an unchanged "Filler to satisfy a count", the two pointing to each other', () => {
    const filler = entry('Filler to satisfy a count');
    const count = entry('A count as a multiplier');
    expect(filler).toBeDefined();
    expect(count).toBeDefined();
    expect(count!.family).toBe(filler!.family);
    const inFamily = entries.filter((e) => e.family === filler!.family).map((e) => e.title);
    expect(inFamily.indexOf('A count as a multiplier')).toBe(inFamily.indexOf('Filler to satisfy a count') + 1);
    // Filler keeps its support-colour and socket counters: every field as it was; Cautions only gains the pointer, and
    // Examples the Mobalytics review's Gemlings (D-410).
    expect(field(filler!.body, 'Shape')).toBe('cheap gems or minions raise a counter (support colours, socketed gems, minion types).');
    expect(field(filler!.body, 'Search')).toBe('`mechanic "different type" (gem)`, "for each"; count what the plan holds.');
    expect(field(filler!.body, 'PoB')).toBe('modelled, but Gem Studded ties wrongly (PG-1) and Muster counts by granted effect (PG-3).');
    expect(field(filler!.body, 'Examples')).toBe("Stormcaller: unused supports for 17/17/17 [stormcaller]. Supporting Fire: a Muster zoo [supporting-fire]. Three Gemlings: supports picked to tie Gem Studded's colours [mob-arc-totems]; [mob-ballista]; [mob-grenades].");
    expect(field(filler!.body, 'Cautions').startsWith('in PoB a 17/17/17 balance gets Red only.')).toBe(true);
    expect(folded(filler!.body)).toContain('A count as a multiplier');
    const body = folded(count!.body);
    expect(body).toContain('Filler to satisfy a count');
    expect(body).toMatch(/Spirit/);
    expect(body).toMatch(/Muster at eight types is 7% × 8, about ×1\.56/);
    expect(body).toMatch(/×1\.63 \[comparison\]/);
  });

  describe('the four new shapes (D-404, D-402, D-409)', () => {
    const SHAPES: [string, (string | RegExp)[]][] = [
      ['Supply by family', ['Powered by Verisium', 'Frozen Ground Trail', /`mechanic "Infusion" \(gem\)`, not "Cold Infusion"/, /unfamiliar term/, '`## Supply search`']],
      ['Bank the resource', [/stored between packs/, /clears faster than one made on the spot/]],
      ['A tamed rare beast', ['`data/monsters/monster-mods.md`', /condition/, /stats/, /percentage of Spirit/, 'PG-56']],
      ['A rule changer', ['Way of the Stonefist', '`data/rules/nodes.md`', '`pairs.md`', 'PG-36']],
    ];

    it.each(SHAPES.map(([title]) => title))('%s is an entry with its search step, PoB label, examples and cautions, in order', (title) => {
      const e = entry(title);
      expect(e).toBeDefined();
      const at = FIELDS.map((f) => e!.body.search(new RegExp(`^- \\*\\*${f}:\\*\\* \\S`, 'm')));
      expect({ title, fields: at.every((i) => i >= 0), inOrder: [...at].sort((x, y) => x - y).join() === at.join() }).toEqual({ title, fields: true, inOrder: true });
      expect(field(e!.body, 'Search').length).toBeGreaterThan(60);
      const pob = field(e!.body, 'PoB');
      expect({ title, pob, labelled: new RegExp(`^(?:${POB_LABELS.join('|')})\\b`).test(pob) }).toEqual({ title, pob, labelled: true });
      const examples = [...field(e!.body, 'Examples').matchAll(/\[([a-z0-9-]+)\](?!:)/g)].map((m) => m[1]);
      expect(new Set(examples).size).toBeGreaterThanOrEqual(1);
      expect(new Set(examples).size).toBeLessThanOrEqual(3);
      for (const key of examples) expect({ title, key, defined: sources.has(key) }).toEqual({ title, key, defined: true });
    });

    it.each(SHAPES)('%s says what amendment 8 asks of it', (title, wants) => {
      const body = folded(entry(title)!.body);
      for (const want of wants) {
        const present = typeof want === 'string' ? body.includes(want) : want.test(body);
        expect({ title, want: String(want), present }).toEqual({ title, want: String(want), present: true });
      }
    });

    it('records the user\'s review of every new entry (D-409)', () => {
      const review = bullets(bodyOf(h2('How to read an entry')!)).find((b) => b.startsWith('- **Reviewed.**')) ?? '';
      expect(review).toContain('D-409');
      for (const name of ['Questions 11–14', 'Standard kits', 'A count as a multiplier', ...SHAPES.map(([t]) => t)]) {
        expect({ name, listed: review.includes(name) }).toEqual({ name, listed: true });
      }
    });
  });

  it('stays under 16,000 words (D-381, D-410, amendment 9 §24.1; provisional)', () => {
    expect(text.split(/\s+/).filter(Boolean).length).toBeLessThan(16_000);
  });
});

// ---------------------------------------------------------------------------------------------------
// AC-W95 (WU-123, amendment 12 §13, D-458, D-457; static): questions 20–24 and their section, question 19's text
// (`buildGuideDesignPieces.test.ts`), question 2's means, the enemy's side, the section-4 and section-5 entries, the
// Attacks kit's Levers, the stale deflection lines with §4's floor, and the trim. Every name, text and number below is
// read from the amendment, the committed game data or the pin.
// ---------------------------------------------------------------------------------------------------
describe('AC-W95 (WU-123, D-458): the library carries amendment 12', () => {
  const A12 = fs.readFileSync(path.join(REPO, 'docs', 'build-guide', 'spec', 'amendment-12-defence-and-design.md'), 'utf8');
  const A12_FOLDED = folded(A12);
  const section13 = A12.slice(A12.indexOf('## 13. D-458'), A12.indexOf('## 14. '));
  const S13 = folded(section13);
  /** A sentence's text without its parentheticals and bold marks, for comparing the spec's wording with the library's. */
  const plain = (s: string) => s.replace(/\*\*/g, '').replace(/\s*\([^)]*\)/g, '').replace(/\s+/g, ' ').trim();
  const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const spec = (re: RegExp, what: string) => {
    const m = re.exec(A12_FOLDED);
    if (!m) throw new Error(`amendment 12 doesn't state ${what}`);
    return m;
  };
  /** §13's question bullets: number, name and text (the parenthetical tags and the section-5 entry's clause cut). */
  const specQuestions = (() => {
    const out: { n: number; name: string; text: string; entry?: string }[] = [];
    const lines = section13.split(/\r?\n/);
    lines.forEach((line, i) => {
      const m = /^- \*\*(\d+), ([^*]+)\*\* (.*)$/.exec(line);
      if (!m) return;
      const rest = [m[3], ...lines.slice(i + 1).filter((_, k, a) => a.slice(0, k + 1).every((l) => /^ {2}\S/.test(l)))].join(' ');
      let text = folded(rest).replace(/^\([^)]*\)[,:] /, '');
      const cut = /; with a new section-(\d+) entry "([^"]+)"/.exec(text);
      if (cut) text = text.slice(0, cut.index);
      out.push({ n: Number(m[1]), name: m[2], text, entry: cut?.[2] });
    });
    return out;
  })();
  const SECTION_TITLE = spec(/a new section "(Brainstorm questions 20–24: [^"]+)"/, "the questions' section")[1];
  const numberedIn = (body: string) =>
    new Map([...body.matchAll(/^(\d+)\. ([\s\S]*?)(?=^\d+\. |(?![\s\S]))/gm)].map((m) => [Number(m[1]), folded(m[2]).trim()]));

  it('asks questions 20–24 in their own section after 1–19, each named and worded as §13 has it', () => {
    expect(specQuestions.map((q) => q.n)).toEqual([20, 21, 22, 23, 24]);
    const sec = h2(SECTION_TITLE);
    expect(sec).toBeDefined();
    const h2s = headings.filter((h) => h.level === 2);
    expect(h2s[h2s.indexOf(sec!) - 1].title).toBe('Brainstorm questions 11–19: the engine and the synthesis');
    const ours = numberedIn(bodyOf(sec!));
    expect([...ours.keys()]).toEqual([20, 21, 22, 23, 24]);
    for (const q of specQuestions) {
      const text = ours.get(q.n) ?? '';
      expect({ n: q.n, name: q.name, leads: text.toLowerCase().startsWith(q.name.toLowerCase()) }).toEqual({ n: q.n, name: q.name, leads: true });
      for (const sentence of plain(q.text).split(/(?<=[.?])\s+/)) {
        expect({ n: q.n, sentence, held: plain(text).toLowerCase().includes(sentence.toLowerCase()) }).toEqual({ n: q.n, sentence, held: true });
      }
    }
  });

  it("question 24 points to its section-5 entry, which holds Mortar Cannon's price as the pin has it", () => {
    const q24 = specQuestions.find((q) => q.n === 24)!;
    expect(q24.entry).toBe('A proxy presses the button');
    expect(numberedIn(bodyOf(h2(SECTION_TITLE)!)).get(24)).toContain(`See ${q24.entry}.`);
    const e = entry(q24.entry!);
    expect(e?.family).toBe('5. Copies and rate');
    expect(folded(e!.body)).toMatch(/Mortar Cannon ballistas fire a socketed Cluster Grenade at 50% less damage and attack\s+speed/);
    const skills = fs.readFileSync(path.join(PIN_SRC, 'Data', 'Skills', 'act_str.lua'), 'utf8');
    const support = skills.slice(skills.indexOf('skills["SupportMortarCannonPlayer"]'));
    expect(support).toContain('{ "support_grenade_ballista_damage_+%_final", -50 }');
    expect(support).toContain('{ "support_grenade_ballista_attack_speed_+%_final", -50 }');
  });

  it("question 2 names the means apart from the payoff (D-457)", () => {
    const means = spec(/\*\*Question 2\*\* of the library \([^)]*\) gains: (.*?)\./, "question 2's addition")[1];
    const q2 = numberedIn(bodyOf(h2('Brainstorm questions')!)).get(2) ?? '';
    expect(q2.startsWith('Fix the payoff first, then judge each piece by whether it feeds it.')).toBe(true);
    expect(q2.toLowerCase()).toContain(means.toLowerCase());
  });

  it("files the enemy's side as the twelfth family, its two entries with the five fields and §13's inversion branch", () => {
    const names = spec(/\*\*The enemy's side\*\* \(D1\), a new family section with: (.*?); and the changes/, "the enemy's side's entries")[1].split('; ');
    expect(names).toEqual(['Resistance below zero', 'The damage-taken pool']);
    const branch = spec(/a line in its Search or Cautions that starts "(On a build that inverts resistance:)"/, 'the inversion branch')[1];
    expect(families.map((f) => f.title)).toHaveLength(12);
    expect(families[11].title).toBe("12. The enemy's side");
    for (const name of names) {
      const e = entry(name);
      expect({ name, family: e?.family }).toEqual({ name, family: "12. The enemy's side" });
      const at = FIELDS.map((f) => e!.body.search(new RegExp(`^- \\*\\*${f}:\\*\\* \\S`, 'm')));
      expect({ name, fields: at.every((i) => i >= 0), inOrder: [...at].sort((x, y) => x - y).join() === at.join() }).toEqual({ name, fields: true, inOrder: true });
      expect({ name, labelled: new RegExp(`^(?:${POB_LABELS.join('|')})\\b`).test(field(e!.body, 'PoB')) }).toEqual({ name, labelled: true });
      const starts = new RegExp(`(?:^|[.;] )${escapeRe(branch)} \\S`);
      expect({ name, branch: starts.test(field(e!.body, 'Search')) || starts.test(field(e!.body, 'Cautions')) }).toEqual({ name, branch: true });
    }
  });

  it('files A gained slice keeps its type in section 4, and Saturated type count names Yoke of Suffering and a slice of each element', () => {
    const [, title, n] = spec(/"([^"]+)" filed in section (\d+)/, 'the section-4 entry');
    expect(title).toBe('A gained slice keeps its type');
    expect(entry(title)?.family.startsWith(`${n}. `)).toBe(true);
    const [, yoke, slices] = spec(/Saturated type count gains (Yoke of Suffering) and (slices of each element) from different slots/, "Saturated type count's change");
    const body = folded(entry('Saturated type count')!.body);
    expect(body).toContain(yoke);
    expect(body).toContain(slices.replace(/^slices/, 'slice'));
  });

  it("gives the Attacks kit's Levers the global weapon prefixes a listing's DPS hides, each range a weapon prefix in the pin", () => {
    expect(S13).toMatch(/the Attacks kit's Levers gain the global weapon prefixes a listing's DPS hides/);
    const kit = h3sUnder(h2('Standard kits')!).find((a) => a.title === 'Attacks, any weapon')!;
    const levers = bullets(kit.body).find((b) => b.startsWith('- **Levers:** '))!;
    const part = levers.slice(levers.indexOf('global prefixes'));
    expect(levers).toContain('global prefixes');
    expect(part).toMatch(/listing's DPS hides/);
    const ranges = [...part.matchAll(/\((\d+)–(\d+)\)%/g)].map((m) => `(${m[1]}-${m[2]})% increased Elemental Damage with Attacks`);
    expect(ranges.length).toBe(2);
    const mods = fs.readFileSync(path.join(PIN_SRC, 'Data', 'ModItem.lua'), 'utf8').split('\n');
    for (const r of ranges) expect({ r, prefix: mods.some((l) => l.includes('type = "Prefix"') && l.includes(`"${r}"`)) }).toEqual({ r, prefix: true });
  });

  it("corrects the stale deflection lines: both accuracies, the Arbiter's figures, the floor and the gate's deflected hit", () => {
    const [, map, arbiter] = spec(/P9's line gives both accuracies, ([\d,]+) for the map enemy and ([\d,]+) for the Arbiter/, "P9's accuracies");
    const data = JSON.parse(fs.readFileSync(path.join(REPO, 'data', 'enemies', 'arbiter-of-divinity.json'), 'utf8'));
    expect(Number(arbiter.replace(/,/g, ''))).toBe(data.facts['base.accuracy'].value);
    const p9 = bullets(bodyOf(h2('How to read an entry')!)).find((b) => b.startsWith('- **Defence figures:**')) ?? '';
    expect(p9).toContain(map);
    expect(p9).toContain(arbiter);
    expect(p9).toContain('data/enemies/arbiter-of-divinity.json#base.accuracy');
    for (const gone of ['84% deflect', 'never more evasion', 'never fixes a one-shot']) expect({ gone, present: folded(text).includes(gone) }).toEqual({ gone, present: false });
    const figures = spec(/the Arbiter's figures \(([\d.]+%, [\d.]+% and [\d.]+%) of slams survived\)/, "the Arbiter's figures")[1];
    const floor = Number(spec(/"hitsSurvivedFloor": ([\d.]+)/, 'the floor')[1]) * 100;
    for (const title of ['Deflection beside evasion', 'EHP over its target but one-shot (a diagnosis)']) {
      expect(S13).toContain(title.replace(/ \(a diagnosis\)$/, ''));
      const body = folded(entry(title)!.body);
      expect({ title, figures: body.includes(figures), floor: body.includes(`${floor}% floor`), deflectedHit: /deflected hit/.test(body) }).toEqual({ title, figures: true, floor: true, deflectedHit: true });
    }
  });

  it("names §4's one-shot floor in the one-shot diagnosis: the full hit survived, or 80% of those hits, evasion and deflection alike", () => {
    const floor = Number(spec(/"hitsSurvivedFloor": ([\d.]+)/, 'the floor')[1]) * 100;
    expect(A12_FOLDED).toMatch(/it survives the full hit \(the Arbiter verdict, top roll\), or 2\. its hits survived for that hit is at least 80%/);
    const shape = field(entry('EHP over its target but one-shot (a diagnosis)')!.body, 'Shape');
    expect(shape).toMatch(new RegExp(`survives the full hit, or at least ${floor}% of those hits, evasion and deflection counting alike`));
  });

  it('keeps, after the trim, every entry heading another skill file named before it, and the defence names §3 cites', () => {
    // Found by searching `.claude/skills/build-guide/` and `.claude/agents/` for the library's headings at e6dad76,
    // before the trim; §3 adds the Defence entries and the kit line the stages apply.
    const named = [
      'Brainstorm questions', 'Standard kits', 'Minions', 'Companions (tamed beasts)', 'Damage over time', 'Totems', 'Warcries',
      'Plants', 'Payoff thief (anti-pattern)', 'Cost redirection', 'Type conversion so another mechanic applies',
      "Convert into the ailment's type", 'Forced condition', 'Minimize travel distance', 'A rule changer',
      'Deflection beside evasion', 'Blind as defence', 'EHP over its target but one-shot (a diagnosis)',
    ];
    for (const title of named) expect({ title, kept: headings.some((h) => h.title === title) }).toEqual({ title, kept: true });
    expect(folded(bodyOf(h2('Standard kits')!))).toContain('- **Every archetype, for defence:** the class\'s attributes pick the defence family');
  });
});
