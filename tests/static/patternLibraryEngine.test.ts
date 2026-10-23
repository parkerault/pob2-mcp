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
 * - "A count as a multiplier" beside an unchanged "Filler to satisfy a count", the two pointing to each other.
 * - The four new shapes (supply by family, bank the resource, a tamed rare beast, a rule changer), each in a family
 *   with its search step, how PoB follows it (one of the six labels), examples and cautions.
 * - The library stays under 12,000 words (D-381, raised by D-410).
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
  it('asks brainstorm questions 11–15 in their own section after the first ten, and question 9 points to Standard kits', () => {
    const first = h2('Brainstorm questions');
    expect(first).toBeDefined();
    const h2s = headings.filter((h) => h.level === 2);
    const engine = h2s[h2s.indexOf(first!) + 1];
    expect(engine.title).toBe('Brainstorm questions 11–15: the engine');
    const body = bodyOf(engine);
    const numbered = [...body.matchAll(/^(\d+)\. ([\s\S]*?)(?=^\d+\. |(?![\s\S]))/gm)].map((m) => ({ n: Number(m[1]), q: folded(m[2]) }));
    expect(numbered.map((x) => x.n)).toEqual([11, 12, 13, 14, 15]);
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

    it('is about 3,000 words (D-410)', () => {
      const words = bodyOf(kits!).split(/\s+/).filter(Boolean).length;
      expect(words).toBeGreaterThan(2500);
      expect(words).toBeLessThan(3500);
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

  it('stays under 12,000 words (D-381, D-410)', () => {
    expect(text.split(/\s+/).filter(Boolean).length).toBeLessThan(12_000);
  });
});
