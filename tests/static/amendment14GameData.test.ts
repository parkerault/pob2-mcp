/**
 * AC-W107 (WU-139, amendment 14 §18, §20, §21, D-492, D-494, D-495; static): the game-data unit's documents.
 * - `docs/build-guide/pob-gaps.md` has §21's section, "Found in amendment 14 (2026-11-02)", holding PG-103 to PG-105 in
 *   order, each titled as §21 names it, with a kind and status of the file's own lists and a Where; every PoB
 *   `file:line` the section cites is in the pin, and the cited lines say what the entries say they do.
 * - `CLAUDE.md`'s pin-upgrade steps name `pob-api/API/ParseFixes.lua`, the bridge's parse fixes (§18).
 * - `data/items/item-only-skills.json` is a C-35 fact file (the loader's schema), its one source the user's ruling (a
 *   `judgment`), and each fact a skill PoB's data has that only a unique grants (§20, Appendix A).
 */
import { describe, it, expect } from '@jest/globals';
import fs from 'fs';
import path from 'path';
import { parseDataFile } from '../../src/plan/referenceData';

const REPO = path.resolve(__dirname, '..', '..');
const PIN_SRC = path.join(REPO, 'vendor', 'PathOfBuilding-PoE2', 'src');
const read = (f: string) => fs.readFileSync(f, 'utf8');
const folded = (s: string) => s.replace(/\s*\n\s*/g, ' ').trim();

const A14 = read(path.join(REPO, 'docs', 'build-guide', 'spec', 'amendment-14-files-specs-and-repairs.md'));
const GAPS = read(path.join(REPO, 'docs', 'build-guide', 'pob-gaps.md'));
const CLAUDE = read(path.join(REPO, 'CLAUDE.md'));

/** The pin's lines `from`–`to` (1-based), joined. */
const pin = (rel: string) => read(path.join(PIN_SRC, rel)).split(/\r?\n/);
const lines = (rel: string, from: number, to = from) => pin(rel).slice(from - 1, to).join('\n');

const SECTION_TITLE = 'Found in amendment 14 (2026-11-02)';
const KINDS = ['bug', 'half', 'gap', 'data', 'ours'];
const STATUSES = ['confirmed', 'reported', 'closed'];

describe("AC-W107 (WU-139): PG-103 to PG-105 in pob-gaps.md (amendment 14 §21, D-495)", () => {
  const S21 = folded(A14.slice(A14.indexOf('## 21. D-495'), A14.indexOf('## 22. ')));
  const sectionText = (() => {
    const at = GAPS.indexOf(`\n## ${SECTION_TITLE}\n`);
    const next = GAPS.indexOf('\n## ', at + 1);
    return at < 0 ? '' : GAPS.slice(at, next > 0 ? next : undefined);
  })();
  /** The entry `- **PG-<n>, …` up to the next entry or section, folded. */
  const entryOf = (n: number) => {
    const at = sectionText.indexOf(`- **PG-${n}, `);
    expect({ n, listed: at >= 0 }).toEqual({ n, listed: true });
    const next = sectionText.indexOf('\n- **PG-', at + 1);
    return folded(sectionText.slice(at, next > 0 ? next : undefined));
  };
  const field = (entry: string, name: string) => {
    const m = new RegExp(`- \\*\\*${name}:\\*\\* (.*?)(?= - \\*\\*[A-Z][a-z ]+:\\*\\*|$)`).exec(entry);
    return m ? m[1] : null;
  };
  const CITE = /`((?:Modules|Data|Classes|TreeData)\/[^`:]+\.lua)?:(\d+)(?:-(\d+))?`/g;
  /** Every `file:line` or `file:from-to` in a text, a bare `:line` taking the last file named. */
  const citesIn = (text: string) => {
    const out: { cite: string; file: string; from: number; to: number }[] = [];
    let last = '';
    for (const m of text.matchAll(CITE)) {
      last = m[1] ?? last;
      out.push({ cite: m[0], file: last, from: Number(m[2]), to: Number(m[3] ?? m[2]) });
    }
    return out;
  };

  it(`has §21's section, "${SECTION_TITLE}", holding PG-103, PG-104 and PG-105 in order, each once in the file`, () => {
    expect(S21).toContain(`"${SECTION_TITLE}"`);
    expect(sectionText).not.toBe('');
    expect([...sectionText.matchAll(/^- \*\*PG-(\d+), /gm)].map((m) => Number(m[1]))).toEqual([103, 104, 105]);
    for (const n of [103, 104, 105]) expect({ n, count: GAPS.split(`**PG-${n},`).length - 1 }).toEqual({ n, count: 1 });
  });

  it("titles each entry as §21 names it, with a kind and status from the file's lists and a Where", () => {
    const titles: Record<number, string> = {};
    for (const m of S21.matchAll(/PG-(\d+), ([^(;]+?) \(/g)) titles[Number(m[1])] = m[2];
    expect(Object.keys(titles).map(Number)).toEqual([103, 104, 105]);
    for (const n of [103, 104, 105]) {
      const entry = entryOf(n);
      const heading = /^- \*\*PG-\d+, (.+?)\.\*\* ([a-z]+), ([a-z]+)[ .,]/.exec(entry);
      expect({ n, heading: heading !== null }).toEqual({ n, heading: true });
      // §21's wording; the line §21 quotes in PG-104's title is in its Where instead.
      const title = titles[n].replace(/ "[^"]+"/g, '');
      expect({ n, title: heading![1] }).toEqual({ n, title });
      expect({ n, kind: KINDS.includes(heading![2]), status: STATUSES.includes(heading![3]) }).toEqual({ n, kind: true, status: true });
      expect({ n, where: field(entry, 'Where') !== null, effect: field(entry, 'Effect') !== null }).toEqual({ n, where: true, effect: true });
    }
  });

  it('cites PoB only at files and lines the pin holds', () => {
    let count = 0;
    for (const n of [103, 104, 105]) {
      for (const c of citesIn(entryOf(n))) {
        expect({ n, cite: c.cite, file: c.file !== '' }).toEqual({ n, cite: c.cite, file: true });
        const total = pin(c.file).length;
        expect({ n, cite: c.cite, inFile: c.from >= 1 && c.from <= c.to && c.to <= total }).toEqual({ n, cite: c.cite, inFile: true });
        count++;
      }
    }
    expect(count).toBeGreaterThanOrEqual(15);
  });

  it("PG-103: the tree's Phylactery line, PoB's older wording only, the cached parse with a remainder, and the bridge's fix", () => {
    const entry = entryOf(103);
    const line = '100% increased Effect of bonuses gained from Socketed Jewel';
    expect(entry).toContain('`TreeData/0_5/tree.lua:52976`');
    expect(lines('TreeData/0_5/tree.lua', 52976)).toContain(`"${line}"`);
    expect(lines('Modules/ModParser.lua', 895, 897)).toContain('["effect of the socketed jewel"] = "SocketedJewelEffect"');
    expect(lines('Modules/ModParser.lua', 895, 897)).not.toContain('bonuses gained from');
    const cached = lines('Data/ModCache.lua', 1356);
    expect(cached.startsWith(`c["${line}"]=`)).toBe(true);
    expect(cached).toMatch(/name="LocalEffect".*\},"\s+of bonuses gained from Socketed Jewel\s*"\}$/);
    expect(lines('Modules/CalcSetup.lua', 1133, 1136)).toContain('node.modList:Sum("INC", nil, "SocketedJewelEffect")');
    expect(field(entry, 'Fixed')).toContain('`pob-api/API/ParseFixes.lua`');
    expect(field(entry, 'Fixed')).toContain('`tests/integration/parseFixes.test.ts`');
  });

  it("PG-104: Event Horizon's cost line, cached with a remainder, beside its chaos damage", () => {
    const entry = entryOf(104);
    const node = lines('TreeData/0_5/tree.lua', 110204, 110227);
    expect(node).toContain('name="Event Horizon"');
    expect(lines('TreeData/0_5/tree.lua', 110225)).toContain('"Lose 3% of maximum Life and Energy Shield when you use a Chaos Skill"');
    expect(node).toContain('increased Chaos Damage');
    expect(lines('Data/ModCache.lua', 6137)).toMatch(/^c\["Lose 3% of maximum Life and Energy Shield when you use a Chaos Skill"\]=.*,"\s+and Energy Shield when you use a Chaos Skill\s*"\}$/);
    expect(entry).toContain('`Data/ModCache.lua:6137`');
    expect(entry).toContain('exclude list');
  });

  it("PG-105: Prism of Belief's generated list, the item-only test it applies, Coiling Bolts' grant and the lookup's filter", () => {
    const entry = entryOf(105);
    const generated = lines('Data/Uniques/Special/Generated.lua', 78, 104);
    expect(generated).toContain('"Prism of Belief"');
    expect(lines('Data/Uniques/Special/Generated.lua', 85)).toContain('not gemData.grantedEffect.fromItem');
    expect(lines('Data/Uniques/wand.lua', 57, 61)).toMatch(/^Liminal Coil\n[\s\S]*Grants Skill: Level \(1-20\) Coiling Bolts$/);
    expect(lines('Data/Skills/act_int.lua', 3507, 3508)).toContain('name = "Coiling Bolts"');
    expect(lines('Data/Skills/act_int.lua', 3507, 3515)).not.toContain('fromItem');
    expect(lines('Data/Skills/act_int.lua', 22333, 22337)).toMatch(/name = "Volatile Dead"[\s\S]*fromItem = true/);
    expect(entry).toContain('`data/items/item-only-skills.json`');
  });
});

describe("AC-W107 (WU-139): CLAUDE.md's pin-upgrade steps name the bridge's parse fixes (amendment 14 §18)", () => {
  it('a numbered step of "Upgrading the PoB2 pin" names pob-api/API/ParseFixes.lua and its test', () => {
    const at = CLAUDE.indexOf('## Upgrading the PoB2 pin');
    const section = CLAUDE.slice(at, CLAUDE.indexOf('\n## ', at + 1));
    const steps = section.split(/\n(?=\d+\. )/).filter((s) => /^\d+\. /.test(s)).map(folded);
    const step = steps.find((s) => s.includes('`pob-api/API/ParseFixes.lua`'));
    expect(step).toBeDefined();
    expect(step).toContain('`tests/integration/parseFixes.test.ts`');
    expect(step).toContain('PG-103');
  });
});

describe('AC-W107 (WU-139): data/items/item-only-skills.json is a C-35 fact file (amendment 14 §20, Appendix A)', () => {
  const FILE = 'items/item-only-skills.json';
  const text = read(path.join(REPO, 'data', FILE));

  it("passes the loader's data-file schema: schemaVersion 1, sources with ids, facts citing them with patch and confidence", () => {
    const parsed = parseDataFile(FILE, text);
    expect(parsed).toEqual(expect.objectContaining({ ok: true }));
    if (!parsed.ok) return;
    expect(parsed.data.sources.map((s) => [s.id, s.kind])).toEqual([['user-prism-2026-10-31', 'judgment']]);
    expect(parsed.data.sources[0].ref).toContain('Prism of Belief rolls only gem skills');
    expect(Object.keys(parsed.data.facts)).toEqual(['item-only-skills.coiling-bolts']);
    for (const [id, fact] of Object.entries(parsed.data.facts)) {
      expect({ id, source: fact.source, patch: fact.patch, confidence: fact.confidence }).toEqual({
        id, source: 'user-prism-2026-10-31', patch: '0.5.x', confidence: 'H',
      });
    }
  });

  it('names skills PoB has, each granted by a unique, keyed by its name', () => {
    const parsed = parseDataFile(FILE, text);
    if (!parsed.ok) throw new Error(parsed.errors.join('\n'));
    const skills = fs.readdirSync(path.join(PIN_SRC, 'Data', 'Skills')).map((f) => read(path.join(PIN_SRC, 'Data', 'Skills', f))).join('\n');
    const uniques = fs.readdirSync(path.join(PIN_SRC, 'Data', 'Uniques')).filter((f) => f.endsWith('.lua'))
      .map((f) => read(path.join(PIN_SRC, 'Data', 'Uniques', f))).join('\n');
    for (const [id, fact] of Object.entries(parsed.data.facts)) {
      const name = String(fact.value);
      expect({ id, key: id }).toEqual({ id, key: `item-only-skills.${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}` });
      expect({ name, skill: skills.includes(`name = "${name}",`) }).toEqual({ name, skill: true });
      expect({ name, granted: new RegExp(`^Grants Skill: Level \\(1-20\\) ${name}$`, 'm').test(uniques) }).toEqual({ name, granted: true });
    }
  });
});
