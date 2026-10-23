/**
 * AC-W82 (WU-103, amendment 9 §17 D-426…D-428, §24.1; static): the pattern library's M-22 additions and the PoB gaps.
 * `.claude/skills/build-guide/references/patterns.md` and `docs/build-guide/pob-gaps.md`.
 * - The user's three weapon-set shapes (two trees for two skills; two weapons sharing an off-hand; both items in both
 *   sets, so the swap changes only the tree), an entry cited to the user and the wiki (D-426).
 * - "Travel by action" gains the user's mechanism, cited to the user, and the search through `list_gems`' `skill_type`
 *   as C-56 names it (D-427).
 * - A warcry Standard kit, every line cited, from the Warcryer study (`[spud]`) and the work-log's candidate (D-428).
 * - The damage-order rule, "Convert into the ailment's type" (right after "Type conversion so another mechanic
 *   applies") and the corpse-explosion line (the last of the Standard kits preamble), each in §24.1's wording, read
 *   from the spec; `[spud]` defined as the 2026-10-23 comparison study.
 * - The library under the 13,000-word cap (§24.1), which both word-count tests pin.
 * - `pob-gaps.md`: PG-72 closed, PoB matching the game; PG-73 new, a unique tame's tablet modifier with no line in the
 *   pin, each cited line checked against the pin; PG-71 intact.
 * V1's `skill-slots` is AC-W82's last bullet: `tests/unit/v1SkillSlots.test.ts` and `tests/integration/skillSlots.test.ts`.
 */
import { describe, it, expect } from '@jest/globals';
import fs from 'fs';
import path from 'path';

const REPO = path.resolve(__dirname, '..', '..');
const LIBRARY = path.join(REPO, '.claude', 'skills', 'build-guide', 'references', 'patterns.md');
const GAPS = path.join(REPO, 'docs', 'build-guide', 'pob-gaps.md');
const SPEC = path.join(REPO, 'docs', 'build-guide', 'spec', 'amendment-9-endgame-first.md');
const PIN_SRC = path.join(REPO, 'vendor', 'PathOfBuilding-PoE2', 'src');
const CAP = 13_000;

const read = (f: string) => fs.readFileSync(f, 'utf8');
const folded = (s: string) => s.replace(/\s*\n\s*/g, ' ').trim();
const words = (s: string) => s.split(/\s+/).filter(Boolean).length;

const text = read(LIBRARY);
const lines = text.split(/\r?\n/);
type Heading = { level: number; title: string; line: number };
const headings: Heading[] = [];
lines.forEach((line, i) => {
  const h = /^(#{1,6})\s+(.*?)\s*$/.exec(line);
  if (h) headings.push({ level: h[1].length, title: h[2], line: i });
});
const h2 = (title: string) => headings.find((h) => h.level === 2 && h.title === title)!;
/** The text under heading `h`, up to the next heading of its level or above. */
const bodyOf = (h: Heading) => lines.slice(h.line + 1, headings.find((x) => x.line > h.line && x.level <= h.level)?.line ?? lines.length).join('\n');
/** The text under heading `h`, up to the next heading of any level. */
const ownText = (h: Heading) => lines.slice(h.line + 1, headings.find((x) => x.line > h.line)?.line ?? lines.length).join('\n');
const h3 = (title: string) => headings.find((h) => h.level === 3 && h.title === title)!;
/** The H2 a heading sits under. */
const parentOf = (h: Heading) => [...headings].reverse().find((x) => x.level === 2 && x.line < h.line)!;
const field = (body: string, name: string) => {
  const m = new RegExp(`^- \\*\\*${name}:\\*\\* ([\\s\\S]*?)(?=^- \\*\\*|(?![\\s\\S]))`, 'm').exec(body);
  return m ? folded(m[1]) : '';
};
const sources = new Map([...text.matchAll(/^\[([a-z0-9-]+)\]: (\S+)/gm)].map((m) => [m[1], m[2]]));

/** §24.1's blockquote that follows `lead` in the spec, unquoted: the wording the library must hold. */
function quoted(lead: string): string {
  const spec = read(SPEC);
  const at = spec.indexOf('### 24.1 Rulings');
  const from = spec.indexOf(lead, at);
  expect({ lead, found: at >= 0 && from > at }).toEqual({ lead, found: true });
  const after = spec.slice(from).split(/\r?\n/);
  const start = after.findIndex((l) => /^\s*>/.test(l));
  const block: string[] = [];
  for (const l of after.slice(start)) {
    if (!/^\s*>/.test(l)) break;
    block.push(l.replace(/^\s*> ?/, ''));
  }
  expect(block.length).toBeGreaterThan(0);
  return folded(block.join('\n'));
}

describe('AC-W82 (WU-103): the pattern library\'s M-22 additions (D-426, D-427, D-428, §24.1)', () => {
  it("holds the user's three weapon-set shapes in an entry of their own, cited to the user and the wiki (D-426)", () => {
    const e = h3('A weapon set per skill');
    expect(e).toBeDefined();
    expect(parentOf(e).title).toBe('8. Item and slot tricks');
    const body = ownText(e);
    const shape = field(body, 'Shape');
    for (const part of [
      'each weapon set holds up to 24 passive points of its own',
      'Three shapes: two trees for two skills;',
      'two weapons sharing an off-hand (a mace in set 1, a wand in set 2, one shield);',
      'both items in both sets, so the swap changes only the tree',
      '(the user, and poe2wiki\'s "Weapon set" as the user pasted it, 2026-10-19 [worklog])',
    ]) {
      expect({ part, present: shape.includes(part) }).toEqual({ part, present: true });
    }
    expect(field(body, 'Search')).toContain('`skills.groups[].weaponSet`');
    expect(field(body, 'PoB')).toMatch(/^modelled: /);
    expect(field(body, 'PoB')).toContain('PG-71');
    expect(field(body, 'Cautions')).toContain('(the wiki, [worklog])');
    // The work-log section the citation rests on holds the user's note and the wiki's entry.
    const log = read(path.join(REPO, 'docs', 'build-guide', 'worklog.md'));
    const section = log.slice(log.indexOf('## 2026-10-19: weapon sets, under-used by the researchers'));
    expect(section.length).toBeLessThan(log.length);
    expect(folded(section)).toMatch(/both items in both sets so the swap only changes the tree/);
    expect(folded(section)).toMatch(/The wiki's entry\*\* \(poe2wiki "Weapon set", pasted by the user on 2026-10-19/);
  });

  it("gives Travel by action the user's mechanism, cited to the user, and the search by `list_gems`' `skill_type` as C-56 names it (D-427)", () => {
    const body = ownText(h3('Travel by action'));
    const shape = field(body, 'Shape');
    expect(shape).toContain('A travel skill covers a fixed distance, so it covers ground faster as attack, cast or skill speed rises');
    expect(shape).toContain("Leap Slam's travel adds up to 0.5 s to its attack time (the user, 2026-10-19 [worklog])");
    const search = field(body, 'Search');
    expect(search).toContain('`mcp__pob2__list_gems {skill_type: "Travel"}` (C-56)');
    // The parameter and its value as the contract has them (§24.2, C-56).
    const c56 = folded(read(SPEC)).match(/\*\*C-56, `list_gems`\*\* gains `([a-z_]+)`, a PoB skill type by name \(`(Travel)`/);
    expect(c56?.slice(1)).toEqual(['skill_type', 'Travel']);
  });

  it('adds a warcry Standard kit in the other kits\' shape, every line citing the Warcryer study, with the work-log\'s candidate (D-428)', () => {
    const kit = h3('Warcries');
    expect(parentOf(kit).title).toBe('Standard kits');
    const items = ownText(kit).split(/\n(?=- )/).map((b) => folded(b)).filter((b) => b.startsWith('- '));
    expect(items[0]).toMatch(/^- \*\*Kit:\*\* /);
    expect(items[1]).toMatch(/^- \*\*Levers:\*\* /);
    for (const item of items) expect({ item, cited: /\[spud\] §\d/.test(item) }).toEqual({ item, cited: true });
    const all = items.join(' ');
    for (const part of ["Warcaller's Bellow", 'Seismic Cry', 'Avatar of Fire', 'corpse explosions', 'Escalation', 'Blood Magic', "borrowed the Maces kit's line for want of this one [worklog]"]) {
      expect({ part, present: all.includes(part) }).toEqual({ part, present: true });
    }
  });

  it("states the damage-order rule in §24.1's wording", () => {
    const rule = quoted('The library gains the user\'s damage-order rule (WU-103), in this wording:');
    expect(rule.startsWith('**Damage order.** Flat damage is converted first.')).toBe(true);
    expect(folded(bodyOf(h2('How to read an entry')))).toContain(`- ${rule}`);
  });

  it("puts \"Convert into the ailment's type\" right after \"Type conversion so another mechanic applies\", in §24.1's wording", () => {
    const entry = quoted('The ailment-conversion lens (the user, 2026-10-23),');
    expect(entry.startsWith("### Convert into the ailment's type - **Shape:**")).toBe(true);
    const e = h3("Convert into the ailment's type");
    const before = headings[headings.indexOf(e) - 1];
    expect(before.title).toBe('Type conversion so another mechanic applies');
    expect(parentOf(e)).toBe(parentOf(before));
    expect(folded(`### ${e.title}\n${ownText(e)}`)).toBe(entry);
  });

  it("ends the Standard kits preamble with the corpse-explosion line, in §24.1's wording", () => {
    const line = quoted('Corpse explosions for clear (the user, 2026-10-23),');
    expect(line.startsWith('- **Every archetype, for clear:**')).toBe(true);
    const preamble = folded(ownText(h2('Standard kits')));
    expect(preamble.endsWith(line)).toBe(true);
  });

  it('defines `[spud]` as the 2026-10-23 comparison study, beside the other source keys', () => {
    expect(sources.get('spud')).toBe('../../../../docs/build-guide/studies/2026-10-23-spud-warcryer-comparison.md');
    expect(fs.existsSync(path.resolve(path.dirname(LIBRARY), sources.get('spud')!))).toBe(true);
    const keys = [...sources.keys()];
    expect(keys.indexOf('spud')).toBe(keys.indexOf('amendment-9') + 1);
  });

  it('stays under the 13,000-word cap (§24.1), and both word-count tests pin it', () => {
    expect(words(text)).toBeLessThan(CAP);
    const pipeline = read(path.join(REPO, 'tests', 'static', 'buildGuidePipeline.test.ts'));
    expect(pipeline).toMatch(/^const LIBRARY_WORD_CAP = 13_000;$/m);
    expect(pipeline).toContain("it('is at most 13,000 words, so a researcher reads it whole");
    const engine = read(path.join(REPO, 'tests', 'static', 'patternLibraryEngine.test.ts'));
    expect(engine).toContain('toBeLessThan(13_000)');
    expect(engine).toContain("it('stays under 13,000 words");
  });
});

describe('AC-W82 (WU-103): pob-gaps.md closes PG-72 and adds PG-73 (§24.1, D-428)', () => {
  const gaps = read(GAPS);
  /** The entry `- **PG-<n>, …` up to the next entry or section. */
  const entryOf = (n: number) => {
    const at = gaps.indexOf(`- **PG-${n}, `);
    expect({ n, listed: at >= 0 }).toEqual({ n, listed: true });
    const next = [gaps.indexOf('\n- **PG-', at + 1), gaps.indexOf('\n## ', at)].filter((x) => x > 0);
    return folded(gaps.slice(at, Math.min(...next)));
  };
  const pin = (rel: string) => read(path.join(PIN_SRC, rel)).split(/\r?\n/);

  it('defines the closed status', () => {
    expect(gaps).toContain('- **closed:** suspected, then found to match the game; kept so the question isn\'t asked again.');
  });

  it("records PG-72 as closed: PoB matches the game, by the user's ruling of 2026-10-23, its lines read at the pin", () => {
    const e = entryOf(72);
    expect(e).toMatch(/^- \*\*PG-72, Avatar of Fire drops gained cold and lightning\.\*\* closed: PoB matches the game \(the user's ruling, 2026-10-23/);
    expect(e).toContain('"after doing more research that turns out not to be the case"');
    expect(e).toContain('`Modules/ModParser.lua:2399`');
    expect(pin('Modules/ModParser.lua')[2398]).toContain('["deal no non%-fire damage"] = { flag("DealNoPhysical"), flag("DealNoLightning"), flag("DealNoCold"), flag("DealNoChaos") }');
    expect(e).toContain('`Modules/CalcOffence.lua:2238-2241`');
    const offence = pin('Modules/CalcOffence.lua');
    expect(offence.slice(2237, 2241).join('\n')).toContain('canDeal[damageType] = not skillModList:Flag(skillCfg, "DealNo"..damageType, "DealNoDamage")');
    expect(e).toContain('(`:4023`)');
    expect(offence[4022]).toContain('if skillFlags.hit and canDeal[damageType] then');
  });

  it("adds PG-73: a unique tame's tablet modifier with no line in the pin, each cited line checked", () => {
    const e = entryOf(73);
    expect(e).toMatch(/^- \*\*PG-73, a unique tame's tablet modifier has no line in the pin\.\*\* gap, confirmed in code \(amendment 9, D-428\)/);
    expect(e).toContain('Mighty Silverfist');
    expect(e).toContain('Extra Crits');
    expect(e).toContain('`Data/StatDescriptions/stat_descriptions.lua:193127-193140`');
    const desc = pin('Data/StatDescriptions/stat_descriptions.lua').slice(193126, 193140).join('\n');
    expect(desc).toContain('text="Unique Monsters have {0} additional Rare Modifier"');
    expect(desc).toContain('[1]="map_unique_monster_num_additional_modifiers"');
    expect(e).toContain('`Data/TradeSiteStats.lua:15283`, `:33042`');
    const trade = pin('Data/TradeSiteStats.lua');
    for (const n of [15283, 33042]) expect(trade[n - 1]).toContain('"Unique Monsters have # additional Rare Modifier"');
    expect(e).toContain('`Data/ModScalability.lua:14160-14161`');
    expect(pin('Data/ModScalability.lua')[14159]).toContain('["Unique Monsters have # additional Rare Modifier"]');
    expect(e).toContain('`Data/Spectres.lua` (Mighty Silverfist at `:23949`');
    expect(pin('Data/Spectres.lua')[23948]).toContain('name = "Mighty Silverfist"');
    // Nothing that computes reads the stat or grants the line: only the three text files above name it.
    const named: string[] = [];
    const walk = (dir: string) => {
      for (const d of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, d.name);
        if (d.isDirectory()) walk(p);
        else if (d.name.endsWith('.lua') && /map_unique_monster_num_additional_modifiers|additional Rare Modifier/.test(read(p))) named.push(path.relative(PIN_SRC, p));
      }
    };
    walk(PIN_SRC);
    expect(named.sort()).toEqual(['Data/ModScalability.lua', 'Data/StatDescriptions/stat_descriptions.lua', 'Data/TradeSiteStats.lua']);
  });

  it('keeps PG-71 as WU-101 wrote it', () => {
    expect(entryOf(71)).toMatch(/^- \*\*PG-71, socketed supports are counted across both weapon sets\.\*\* bug, confirmed in code and in game/);
  });
});
