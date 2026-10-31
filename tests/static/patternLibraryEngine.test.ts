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
 * - The library is at most 17,000 words (D-381, raised by D-410, by amendment 9 §24.1, the user, 2026-10-23, and by
 *   amendment 13 §11, D-470, the user, 2026-10-30; the cap and the kits' 4,000 are provisional since 2026-10-26: the
 *   user set the caps aside while the defence entries landed, to review the new size).
 * AC-W95 (WU-123, amendment 12 §13, D-458), the next describe block: questions 20–24, question 2's means, the enemy's
 * side, the section-4 and section-5 entries, the Attacks kit's Levers, the stale deflection lines with §4's floor, and
 * the trim's kept headings; question 19's text is in `buildGuideDesignPieces.test.ts`, the family list of 12 in
 * `buildGuidePipeline.test.ts` (AC-W28), the word caps in every word-count test.
 * AC-W101 (WU-131, amendment 13 §11, D-470), the last describe block: "A second ailment type" in section 5 with its five
 * fields, each pin line it cites holding what it names; the pointer from "Convert into the ailment's type"; the Damage
 * over time kit's lever beside Contagion; the pivots; Split Personality's line; the 17,000 cap the five cap tests pin.
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

  it('is at most 17,000 words (D-381, D-410, amendment 9 §24.1, D-470; provisional)', () => {
    expect(text.split(/\s+/).filter(Boolean).length).toBeLessThanOrEqual(17_000);
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

// ---------------------------------------------------------------------------------------------------
// AC-W101 (WU-131, amendment 13 §11, D-470; static): "A second ailment type" in section 5 with its five fields, naming
// Bloodhound's Mark (PG-101) and the three chaos debuffs in its Cautions; the pointer from "Convert into the ailment's
// type"; the Damage over time kit's lever beside Contagion; the pivots; no line saying the compiler refuses Split
// Personality's start; the library at most 17,000 words, which the five cap tests pin. Every title, name and number
// below is read from the amendment, and every pin line the entries cite is read from the pin.
// ---------------------------------------------------------------------------------------------------
describe('AC-W101 (WU-131, D-470): the library carries amendment 13', () => {
  const SPEC_DIR = path.join(REPO, 'docs', 'build-guide', 'spec');
  const A13 = fs.readFileSync(path.join(SPEC_DIR, 'amendment-13-tree-and-finishing-touches.md'), 'utf8');
  const S11 = folded(A13.slice(A13.indexOf('## 11. D-470'), A13.indexOf('## 12. ')));
  const S2 = folded(A13.slice(A13.indexOf('## 2. '), A13.indexOf('## 3. ')));
  const S4 = folded(A13.slice(A13.indexOf('## 4. D-463'), A13.indexOf('## 5. ')));
  const spec = (text: string, re: RegExp, what: string) => {
    const m = re.exec(text);
    if (!m) throw new Error(`amendment 13 doesn't state ${what}`);
    return m;
  };
  /** A sentence's text without its parentheticals, bold marks and quotes, lower-cased, for comparing wordings. */
  const plain = (s: string) => s.replace(/\*\*/g, '').replace(/\s*\([^)]*\)/g, '').replace(/["`]/g, '').replace(/\s+/g, ' ').trim().toLowerCase();
  const pinLines = (rel: string) => fs.readFileSync(path.join(PIN_SRC, rel), 'utf8').split(/\r?\n/);
  /** The name of the unique a line of a `Data/Uniques/` file belongs to: the line after the block's opening `[[`. */
  const uniqueAt = (rel: string, line: number) => {
    const ls = pinLines(rel);
    let i = line - 1;
    while (i > 0 && !/\[\[\s*$/.test(ls[i - 1])) i--;
    return ls[i].trim();
  };
  /** The `name` of the tree node or skill a pin line sits in: the nearest `name="…"` or `name = "…"` above it. */
  const nameAbove = (rel: string, line: number) => {
    const ls = pinLines(rel);
    for (let i = line - 1; i >= 0; i--) {
      const m = /\bname ?= ?"([^"]+)"/.exec(ls[i]);
      if (m) return m[1];
    }
    return '';
  };
  const [, TITLE, FAMILY_N, FAMILY_NAME] = spec(S11, /\*\*"([^"]+)"\*\*, a new entry in section (\d+) \(([^)]+)\)/, 'the entry and its section');
  const specField = (name: string, next: string) => spec(S11, new RegExp(`- \\*\\*${name}:\\*\\* (.*?) - \\*\\*${next}`), `the entry's ${name}`)[1];

  it('files "A second ailment type" in section 5 with its five fields in order, its Shape as §11 words it', () => {
    expect([TITLE, FAMILY_N, FAMILY_NAME]).toEqual(['A second ailment type', '5', 'Copies and rate']);
    const e = entry(TITLE);
    expect(e?.family).toBe(`${FAMILY_N}. ${FAMILY_NAME}`);
    const at = FIELDS.map((f) => e!.body.search(new RegExp(`^- \\*\\*${f}:\\*\\* \\S`, 'm')));
    expect({ fields: at.every((i) => i >= 0), inOrder: [...at].sort((x, y) => x - y).join() === at.join() }).toEqual({ fields: true, inOrder: true });
    expect(plain(field(e!.body, 'Shape'))).toBe(plain(specField('Shape', 'Search')));
  });

  it("searches what §11's Search names, in skills as well as modifiers, in the game's words", () => {
    const ours = field(entry(TITLE)!.body, 'Search');
    const theirs = specField('Search', 'PoB');
    for (const part of ["the skill's other damage types", '`tree "ailments"`', 'Blistering Bond', 'Blood Barbs', 'Plaguefinger', 'Vestige of Darkness', 'fire to shock and the like', 'Rupture', "Bloodhound's Mark", '"Blood Loss"', 'as well as modifier']) {
      expect({ part, inSpec: theirs.includes(part) || theirs.includes(part.replace('modifier', 'modifier lines')), inLibrary: ours.includes(part) }).toEqual({ part, inSpec: true, inLibrary: true });
    }
  });

  it('cites pin lines that hold what the entry says of them', () => {
    const body = folded(entry(TITLE)!.body);
    // Every `path:line` the entry cites, a bare `:line` read against the path before it.
    const cites: string[] = [];
    let last = '';
    for (const m of body.matchAll(/`(?:((?:Data|Modules|TreeData)\/[^`:]+))?:(\d+(?:-\d+)?)`/g)) {
      if (m[1]) last = m[1];
      cites.push(`${last}:${m[2]}`);
    }
    const lines = (cite: string) => {
      const [rel, range] = cite.split(':');
      const [from, to] = range.split('-').map(Number);
      return pinLines(rel).slice(from - 1, (to ?? from)).join('\n');
    };
    const checks: Record<string, (text: string) => unknown> = {
      'Data/Uniques/ring.lua:86': (t) => [t.includes('Fire Damage also Contributes to Bleeding Magnitude'), uniqueAt('Data/Uniques/ring.lua', 86)],
      'TreeData/0_5/tree.lua:66284': (t) => [t.includes('Elemental Damage also Contributes to Bleeding Magnitude'), nameAbove('TreeData/0_5/tree.lua', 66284)],
      'Data/Uniques/gloves.lua:377': (t) => [t.includes('All Damage from Hits Contributes to Poison Magnitude'), uniqueAt('Data/Uniques/gloves.lua', 377)],
      'Data/Uniques/helmet.lua:462': (t) => [t.includes('Physical damage from Hits Contributes to Chill Magnitude and Freeze Buildup'), uniqueAt('Data/Uniques/helmet.lua', 462)],
      'Modules/ModParser.lua:3027-3036': (t) => [/fire damage from hits contributes to shock chance/.test(t), /cold damage from hits contributes to flammability/.test(t)],
      'Data/Skills/sup_str.lua:6424': (t) => [/Aggravate Bleeding on Hitting Heavily Stunned Enemies/.test(t), nameAbove('Data/Skills/sup_str.lua', 6424)],
      'Data/Skills/act_dex.lua:496-620': (t) => [t.split('\n')[0].includes('skills["BloodhoundsMarkPlayer"]'), /^skills\[/.test(pinLines('Data/Skills/act_dex.lua')[620])],
      'Data/Skills/act_dex.lua:570': (t) => /\{ "hunters_mark_%_of_phys_damage_over_time_as_build_up", \d+ \}/.test(t),
      'Data/StatDescriptions/Specific_Skill_Stat_Descriptions/bloodhounds_mark.lua:52': (t) => /Heavy Stun buildup equal to\\n\{0\}% of Blood Loss/.test(t),
      'Modules/CalcOffence.lua:5063-5069': (t) => t.includes('ailment .. "CanStack"'),
      'Modules/CalcOffence.lua:5874-5882': (t) => [t.includes('local dotCfg = {'), /Ailment/.test(t)],
      'Modules/CalcOffence.lua:5040-5048': (t) => [/ModFlag\.Ailment/.test(t), /KeywordFlag\.Ailment/.test(t)],
    };
    expect(cites.sort()).toEqual(Object.keys(checks).sort());
    const got = Object.fromEntries(cites.map((c) => [c, checks[c](lines(c))]));
    expect(got).toEqual({
      'Data/Uniques/ring.lua:86': [true, 'Blistering Bond'],
      'TreeData/0_5/tree.lua:66284': [true, 'Blood Barbs'],
      'Data/Uniques/gloves.lua:377': [true, 'Plaguefinger'],
      'Data/Uniques/helmet.lua:462': [true, 'Vestige of Darkness'],
      'Modules/ModParser.lua:3027-3036': [true, true],
      'Data/Skills/sup_str.lua:6424': [true, 'Rupture'],
      'Data/Skills/act_dex.lua:496-620': [true, true],
      'Data/Skills/act_dex.lua:570': true,
      'Data/StatDescriptions/Specific_Skill_Stat_Descriptions/bloodhounds_mark.lua:52': true,
      'Modules/CalcOffence.lua:5063-5069': true,
      // The skill's own damage over time carries no ailment flag; an ailment's carries both.
      'Modules/CalcOffence.lua:5874-5882': [true, false],
      'Modules/CalcOffence.lua:5040-5048': [true, true],
    });
    // The quoted build-up line is the stat description with the skill's base value.
    const value = /"hunters_mark_%_of_phys_damage_over_time_as_build_up", (\d+)/.exec(pinLines('Data/Skills/act_dex.lua')[569])![1];
    expect(body).toContain(`"Marked target receives Heavy Stun buildup equal to ${value}% of Blood Loss"`);
  });

  it("models the types in PoB and names Bloodhound's Mark's build-up as PG-101, which pob-gaps.md lists", () => {
    const pob = field(entry(TITLE)!.body, 'PoB');
    expect(pob).toMatch(/^modelled for the types, one instance each unless `<Ailment>CanStack`/);
    expect(specField('PoB', 'Examples')).toMatch(/Bloodhound's Mark's stun build-up isn't \(PG-101\)/);
    expect(pob).toMatch(/Bloodhound's Mark's stun build-up is not modelled \(PG-101\)/);
    const gaps = fs.readFileSync(path.join(REPO, 'docs', 'build-guide', 'pob-gaps.md'), 'utf8');
    expect(gaps).toMatch(/- \*\*PG-101, Bloodhound's Mark's Heavy Stun build-up from Blood Loss isn't modelled\.\*\*/);
  });

  it("gives §11's example, Spud's Warbringer's ignite beside bleeding through Blistering Bond, as the study measured it", () => {
    expect(specField('Examples', 'Cautions')).toMatch(/`\[spud\]` \(Warbringer's ignite beside bleed through Blistering Bond/);
    const examples = field(entry(TITLE)!.body, 'Examples');
    expect(examples).toMatch(/^Spud's Warbringer: Shield Wall's ignite and bleeding nearly match its hit, the bleeding fed by fire through Blistering Bond \((\d+)% of Shield Wall\) \[spud\] §4\.1, §9\.$/);
    const study = folded(fs.readFileSync(path.join(REPO, 'docs', 'build-guide', 'studies', '2026-10-23-spud-warcryer-comparison.md'), 'utf8'));
    const [, hit, ignite, bleed] = /\| Shield Wall \| ([\d,]+) DPS \| ([\d,]+) \| ([\d,]+) \|/.exec(study)!.map((x) => Number(x.replace(/,/g, '')));
    expect(ignite + bleed).toBeGreaterThan(0.9 * hit);
    expect(ignite + bleed).toBeLessThan(hit);
    const share = /\((\d+)% of Shield Wall\)/.exec(examples)![1];
    expect(study).toContain(`Blistering Bond is worth ${share}% of Shield Wall`);
  });

  it("names the three chaos debuffs in its Cautions, then §11's three other cautions, the figure read from §2", () => {
    const cautions = field(entry(TITLE)!.body, 'Cautions');
    const theirs = spec(S11, /- \*\*Cautions:\*\* (.*?) - A pointer from/, "the entry's Cautions")[1];
    const debuffs = spec(theirs, /^(.*?) aren't ailments/, 'the chaos debuffs')[1];
    expect(debuffs).toBe("Contagion, Essence Drain and Decaying Hex's debuff");
    expect(cautions.startsWith(`${debuffs} aren't ailments: in PoB they take damage over time and chaos damage over time lines but not the ailment lines`)).toBe(true);
    expect(cautions).toContain('PoB\'s model, needs in-game testing');
    const clauses = theirs.split('; ').slice(-3).map(plain);
    expect(clauses).toEqual([
      'each type needs its own chance and damage type',
      'duration raises damage only where stacks or uptime are short',
      'a second ailment pays only with its chance sources.',
    ]);
    for (const clause of clauses) expect({ clause, held: plain(cautions).includes(clause.replace(/\.$/, '')) }).toEqual({ clause, held: true });
    const cut = spec(S2, /Poison III and Supercritical in r2-s-2's Shield Wall cut it (\d+)% \(no poison chance beyond the gem/, "§2's figure")[1];
    expect(cautions).toMatch(new RegExp(`Lexd's Poison III and Supercritical, moved alone into the Titan Rake run's Shield Wall, with no poison chance beyond the gem, cut it ${cut}% \\[amendment-13\\] §2\\.$`));
    expect(sources.get('amendment-13')).toBe('../../../../docs/build-guide/spec/amendment-13-tree-and-finishing-touches.md');
  });

  it('points to it from "Convert into the ailment\'s type"', () => {
    const from = spec(S11, /A pointer from "([^"]+)"/, 'the pointer')[1];
    expect(from).toBe("Convert into the ailment's type");
    expect(field(entry(from)!.body, 'Search')).toMatch(new RegExp(`see ${TITLE}\\.$`));
  });

  it("rewords the Damage over time kit's lever beside Contagion, which no longer calls it an ailment lever", () => {
    const lever = spec(S11, /the Damage over time kit's "([^"]+)" lever beside Contagion/, "the kit's lever")[1];
    expect(lever).toBe('ailment magnitude');
    const kit = h3sUnder(h2('Standard kits')!).find((a) => a.title === 'Damage over time')!;
    const levers = bullets(kit.body).find((b) => b.startsWith('- **Levers:** '))!;
    expect(levers).not.toContain(lever);
    expect(levers).toMatch(/for a spread ailment, its magnitude and enough duration to spread/);
    expect(levers).toContain(`while Contagion itself isn't an ailment: it takes damage over time lines, not ailment lines (${TITLE})`);
  });

  describe('the pivots', () => {
    const pivots = spec(S11, /\*\*The pivots\*\* \(\[finishing\], item 11i\), each a short entry or a kit line: (.*?) \*\*Split Personality/, 'the pivots')[1];

    it("crit guaranteed, then crit damage bonus: a short entry naming Nebuloch's line, Supercritical and the crit clusters", () => {
      expect(pivots).toMatch(/with crit guaranteed \(Nebuloch's line\), stack crit damage bonus \(Supercritical, crit clusters\)/);
      const e = entry('Guaranteed crit, then crit damage');
      expect(e?.family).toBe('7. Conditions');
      const at = FIELDS.map((f) => e!.body.search(new RegExp(`^- \\*\\*${f}:\\*\\* \\S`, 'm')));
      expect({ fields: at.every((i) => i >= 0), inOrder: [...at].sort((x, y) => x - y).join() === at.join() }).toEqual({ fields: true, inOrder: true });
      const body = folded(e!.body);
      // Nebuloch's line as the pin writes it, and PoB's cache leaving it unparsed.
      const mace = pinLines('Data/Uniques/mace.lua');
      const nebuloch = mace.indexOf('Nebuloch');
      const line = mace.slice(nebuloch, nebuloch + 10).find((l) => /to Critically Hit$/.test(l))!;
      expect(body).toContain(`(Nebuloch: "${line}")`);
      const cache = pinLines('Data/ModCache.lua');
      const cached = cache.findIndex((l) => l.startsWith(`c["${line}"]={nil,`));
      expect(cached).toBeGreaterThanOrEqual(0);
      expect(field(e!.body, 'PoB')).toMatch(new RegExp(`^not modelled for Nebuloch's guarantee, which PoB doesn't parse \\(\`Data/ModCache\\.lua:${cached + 1}\`\\)`));
      // Supercritical's crit chance penalty as the pin has it.
      const sup = pinLines('Data/Skills/sup_int.lua').join('\n');
      const block = sup.slice(sup.indexOf('name = "Supercritical"'));
      const less = -Number(/"support_critical_damage_critical_strike_chance_\+%_final", (-\d+)/.exec(block)![1]);
      expect(body).toContain(`Supercritical (more damage with crits, ${less}% less crit chance, pin)`);
      expect(body).toContain('the crit clusters (`tree "Critical Damage Bonus"`)');
      // The reference build's figures, read from §2.
      const [, superFig] = spec(S2, /Supercritical (\d+)%;/, "Supercritical's figure");
      const [, setTwo] = spec(S2, /four set-2 crit damage passives (\d+)%/, 'the set-2 passives figure');
      expect(field(e!.body, 'Examples')).toBe(`Lexd's Shield Wall + Rake Bleed Titan, on Nebuloch: Supercritical is worth ${superFig}% of its Shield Wall's damage, and four crit damage passives on weapon set 2 ${setTwo}% [amendment-13] §2.`);
      expect(A13).toContain("Lexd's Shield Wall + Rake Bleed Titan");
    });

    it("a keystone that multiplies the build's ailment: Crimson Assault for bleeding, a Damage over time kit line", () => {
      expect(pivots).toMatch(/a keystone that multiplies the build's ailment \(Crimson Assault for bleed\)/);
      const kit = h3sUnder(h2('Standard kits')!).find((a) => a.title === 'Damage over time')!;
      const line = bullets(kit.body).find((b) => b.startsWith('- **Keystones:** '))!;
      const tree = pinLines('TreeData/0_5/tree.lua');
      const at = tree.findIndex((l) => l.includes('name="Crimson Assault"'));
      const node = tree.slice(at - 5, at + 12).join('\n');
      expect(node).toContain('isKeystone=true');
      const more = /"(\d+)% more Magnitude of Bleeding you inflict"/.exec(node)![1];
      expect(node).toContain('"Bleeding you inflict is Aggravated"');
      expect(node).toContain('"Base Bleeding Duration is 1 second"');
      const [, fig] = spec(S2, /Crimson Assault (\d+)%;/, "Crimson Assault's figure");
      expect(line).toBe(`- **Keystones:** one that multiplies the build's ailment: Crimson Assault for bleeding (${more}% more bleeding magnitude, aggravated, a 1-second base duration; pin: \`TreeData/0_5/tree.lua\`); Lexd's Titan's Shield Wall loses ${fig}% without it [amendment-13] §2.`);
    });

    it("the second ailment's chance sources, in the ailment entry", () => {
      expect(pivots).toMatch(/the second ailment's chance sources \(above\)/);
      expect(field(entry(TITLE)!.body, 'Cautions')).toContain('A second ailment pays only with its chance sources');
    });

    it('records the user\'s approval beside the others (D-470)', () => {
      const review = bullets(bodyOf(h2('How to read an entry')!)).find((b) => b.startsWith('- **Reviewed.**')) ?? '';
      expect(review).toMatch(/A second ailment type and the pivots \(D-470, 2026-10-30\)\.$/);
    });
  });

  it("no line says the compiler doesn't accept Split Personality's start, and the radius-jewel entry says it does", () => {
    const gone = spec(S4, /The library\*\* then drops "([^"]+)"/, "§4's dropped line")[1];
    expect(gone).toBe("but our compiler doesn't yet accept that start");
    expect(folded(text)).not.toContain(gone.replace(/^but /, ''));
    expect(folded(text)).not.toMatch(/compiler (?:doesn't|does not|can't|cannot) (?:yet )?accept/);
    const search = field(entry('Radius jewel instead of an anoint')!.body, 'Search');
    expect(search).toContain('Split Personality, a Ruby, lets the tree also grow from the start its variant names');
    expect(search).toContain('PoB models it, and our compiler accepts that start while the tree reaches the jewel\'s socket without it');
  });

  it('is at most 17,000 words, the cap the five cap tests pin', () => {
    const cap = Number(spec(S11, /The user raised it to \*\*([\d,]+)\*\*/, 'the cap')[1].replace(/,/g, ''));
    expect(cap).toBe(17_000);
    expect(text.split(/\s+/).filter(Boolean).length).toBeLessThanOrEqual(cap);
    const pinned = `${String(cap).slice(0, -3)}_${String(cap).slice(-3)}`;
    const test = (name: string) => fs.readFileSync(path.join(REPO, 'tests', 'static', name), 'utf8');
    const holds = {
      'buildGuideDesignPieces.test.ts': new RegExp(`^const LIBRARY_WORD_CAP = ${pinned};$`, 'm').test(test('buildGuideDesignPieces.test.ts')),
      'patternLibraryM22.test.ts': new RegExp(`^const CAP = ${pinned};$`, 'm').test(test('patternLibraryM22.test.ts')),
      'buildGuideAmendment11Design.test.ts': test('buildGuideAmendment11Design.test.ts').includes(`expect(words(rawRef('patterns.md'))).toBeLessThanOrEqual(${pinned});`),
      'buildGuidePipeline.test.ts': new RegExp(`^const LIBRARY_WORD_CAP = ${pinned};$`, 'm').test(test('buildGuidePipeline.test.ts')),
      'patternLibraryEngine.test.ts': test('patternLibraryEngine.test.ts').includes(`expect(text.split(/\\s+/).filter(Boolean).length).toBeLessThanOrEqual(${pinned});`),
    };
    expect(holds).toEqual(Object.fromEntries(Object.keys(holds).map((k) => [k, true])));
    // The old cap, built so this file doesn't hold it either.
    const old = ['16', '000'].join('_');
    for (const name of Object.keys(holds)) expect({ name, old: test(name).includes(old) }).toEqual({ name, old: false });
  });
});
