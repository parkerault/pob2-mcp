/**
 * WU-86 (D-402, AC-W72, static): the committed rare monster modifier table, `data/monsters/monster-mods.md`.
 * - Every block has its id (an entry id, unique in the file), URL, stat lines, keep flag, model (`stats`, `condition` or
 *   `none`), and Creates and Pays off on in the words of `data/rules/vocabulary.md`.
 * - "Hasted" carries its two speed lines and model `stats`; the ice trail ("Trail of Ice") carries model `condition` and
 *   creates chilled-ground.
 * - The four ally auras whose own poe2db pages were saved carry their figures as PoB lines, the page's sentence and
 *   their reach, allies within 5 metres.
 * - §4's models hold: every `stats` row has a line a plan can write, and every `condition` row's config option is one
 *   PoB has (`var = "<name>"` in the pin's `Modules/ConfigOptions.lua`).
 * - The head says every `yes` is an inference from a list that doesn't filter, and that `the beast` rows are written as
 *   `Companions have …` lines.
 * - The index has one line per block, agreeing with it, and the head's counts are the blocks'.
 * - `docs/build-guide/pob-gaps.md` holds PG-56: PoB has no rare monster modifiers.
 */
import { describe, it, expect } from '@jest/globals';
import fs from 'fs';
import path from 'path';
import { blockProblems, configVar, creates, parseMonsterTable, pobLines, readVocabulary } from '../helpers/monsterTable';

const REPO = path.resolve(__dirname, '..', '..');
const TABLE = path.join(REPO, 'data', 'monsters', 'monster-mods.md');
const text = fs.readFileSync(TABLE, 'utf8');
const table = parseMonsterTable(text);
const vocabulary = readVocabulary(path.join(REPO, 'data', 'rules', 'vocabulary.md'));
const block = (name: string) => {
  const b = table.blocks.find((x) => x.name === name);
  if (!b) throw new Error(`no block ${name}`);
  return b;
};

describe('AC-W72 (WU-86, D-402): the committed monster-modifier table', () => {
  it('holds the modifiers poe2db lists, every block whole: id, kind, lines, URL, keep flag, model, reach, families in the vocabulary', () => {
    expect(table.blocks.length).toBeGreaterThan(90);
    for (const b of table.blocks) expect({ name: b.name, problems: blockProblems(b, vocabulary) }).toEqual({ name: b.name, problems: [] });
  });

  it('each id is unique in the file', () => {
    const ids = table.blocks.map((b) => b.fields.get('Id'));
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('"Hasted" carries its two speed lines and model stats', () => {
    const b = block('Hasted');
    expect(b.fields.get('Id')).toBe('hasted');
    expect(b.lines).toEqual(expect.arrayContaining(['"30% increased Movement Speed"', '"30% increased Attack and Cast Speed"']));
    expect(b.fields.get('Model')).toBe('stats');
  });

  it('the ice trail carries model condition and creates chilled-ground', () => {
    const b = block('Trail of Ice');
    expect(b.fields.get('Id')).toBe('trail-of-ice');
    expect(b.fields.get('Model')).toBe('condition');
    expect(b.fields.get('Config')).toMatch(/^conditionEnemyOnChilledGround /);
    expect(creates(b).creates).toContain('chilled-ground');
  });

  it.each([
    ['Haste Aura', ['20% increased Attack Speed', '20% increased Cast Speed', '10% increased Movement Speed'], '20% increased Attack and Cast speed and 10% increased Movement speed'],
    ['Extra Physical Damage Aura', ['40% increased Physical Damage'], '40% increased Physical Damage'],
    ['Energy Shield Aura', ['Gain 20% of maximum Life as Extra maximum Energy Shield'], '20% of Maximum life as added Energy Shield'],
    ['Elemental Resistance Aura', ['+35% to all Elemental Resistances'], '+35% to all Elemental Resistances'],
  ])("%s, an ally aura with its own page saved, carries its figures, the page's sentence and its allies within 5 metres", (name, lines, grants) => {
    const b = block(name);
    expect(b.lines).toEqual(lines.map((l) => `from the page text: "${l}"`));
    expect(b.fields.get('Page text')).toBe(`"Monster creates an Aura that grants ${grants} to Allies within 5 metres."`);
    expect(b.fields.get('Reach')).toBe('its allies within 5 metres: the player and minions');
    expect(b.fields.get('URL')).toBe(`https://poe2db.tw/us/${name.replace(/ /g, '_')}`);
    expect(b.fields.get('Model')).toBe('stats');
  });

  it('every stats row has a line a plan can write as a custom modifier (§4)', () => {
    const bare = table.blocks.filter((b) => b.fields.get('Model') === 'stats' && pobLines(b).length === 0).map((b) => b.name);
    expect(bare).toEqual([]);
  });

  it("every condition row's config option is one the pin's ConfigOptions.lua defines (§4)", () => {
    const options = fs.readFileSync(path.join(REPO, 'vendor', 'PathOfBuilding-PoE2', 'src', 'Modules', 'ConfigOptions.lua'), 'utf8');
    const conditions = table.blocks.filter((b) => b.fields.get('Model') === 'condition');
    expect(conditions.length).toBeGreaterThan(10);
    for (const b of conditions) {
      const v = configVar(b);
      expect({ name: b.name, defined: v !== null && options.includes(`var = "${v}"`) }).toEqual({ name: b.name, defined: true });
    }
  });

  it("the beast's own stats are written as Companions have lines, and Extra Energy Shield's internal id is worded as Energy Shield Aura's stat is", () => {
    const head = table.head.replace(/\s+/g, ' ');
    expect(head).toContain('`the beast`, lines for the companion alone, written as `Companions have …` lines');
    expect(head).toContain('`Modules/ModParser.lua:1272-1273`');
    expect(block('Hasted').fields.get('Note')).toMatch(/^A plan writes its lines as `Companions have …` lines, which PoB gives the companion alone\./);
    const es = block('Extra Energy Shield');
    expect(es.fields.get('Model')).toBe('stats');
    expect(pobLines(es)).toEqual(['from the internal stat id: "Gain 25% of maximum Life as Extra maximum Energy Shield"']);
    expect(pobLines(block('Energy Shield Aura'))).toEqual(['from the page text: "Gain 20% of maximum Life as Extra maximum Energy Shield"']);
  });

  it("Slow Resistant's line is marked as one PoB likely doesn't parse, so it isn't modelled", () => {
    const b = block('Slow Resistant');
    expect(b.fields.get('Model')).toBe('none');
    expect(b.fields.get('Note')).toMatch(/^PoB likely doesn't parse its line/);
  });

  it("the head says every keep flag is an inference from a list that doesn't filter", () => {
    expect(table.head.replace(/\s+/g, ' ')).toContain(
      "That list is poe2db's whole table with duplicate rows dropped, so it singles out none: every `yes` is an inference from a list that doesn't filter, not a confirmation.",
    );
  });

  it('the index has one line per block, agreeing with its model, families and keep flag', () => {
    expect(table.index).toEqual(
      table.blocks.map((b) => {
        const c = /^(.*) \| Pays off on: (.*)$/.exec(b.fields.get('Creates')!)!;
        return `- ${b.name} (${b.fields.get('Id')}): ${b.fields.get('Model')}; creates ${c[1]}; pays off on ${c[2]}; keeps: ${b.fields.get('Tamed beast keeps it')}`;
      }),
    );
  });

  it("the head's counts are the blocks'", () => {
    const by = (model: string) => table.blocks.filter((b) => b.fields.get('Model') === model).length;
    const kept = table.blocks.filter((b) => b.fields.get('Tamed beast keeps it') === 'yes').length;
    const head = table.head.replace(/\s+/g, ' ');
    expect(head).toContain(`One block per name: ${table.blocks.length} modifiers, ${kept} on Tame_Beast's list;`);
    expect(head).toContain(`${by('stats')} modelled as stats, ${by('condition')} as a condition, ${by('none')} not at all.`);
  });

  it('pob-gaps.md holds PG-56: PoB has no rare monster modifiers, and no way to give a companion one', () => {
    const gaps = fs.readFileSync(path.join(REPO, 'docs', 'build-guide', 'pob-gaps.md'), 'utf8');
    expect(gaps).toContain('- **PG-56, PoB has no rare monster modifiers, and no way to give a companion one.** gap, confirmed in code');
    const entry = gaps.slice(gaps.indexOf('- **PG-56,'), gaps.indexOf('\n## ', gaps.indexOf('- **PG-56,')));
    expect(entry).toContain('`Data/Spectres.lua`');
    expect(entry).toContain('`Modules/CalcActiveSkill.lua:904-905`');
    expect(entry).toContain('`data/monsters/monster-mods.md`');
  });
});
