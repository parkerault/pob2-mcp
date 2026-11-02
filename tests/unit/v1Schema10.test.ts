/**
 * WU-137 (amendment 14 §11, §18; D-485, D-492): V1's `affix-cap`, `sockets` and `ascendancy-jewel` over hand-made
 * `compile_stage` checks, the units behind the engine rows of `tests/integration/compileSchema10Checks.test.ts` (AC-P92,
 * AC-P93). The groups and tiers here are copied from the pinned `Data/ModItem.lua` (LocalEnergyShield 1–11, :199-209;
 * LocalIncreasedEnergyShieldAndBase 1–6, :402-407; BaseSpirit; IncreasedLife), the shape `compile_stage` gives them.
 */
import path from 'path';
import { describe, expect, it } from '@jest/globals';
import {
  BASIC_JEWELS,
  RUNG_ITEM_LEVEL,
  checkAffixCap,
  checkAscendancyJewel,
  checkSockets,
  socketFactOf,
  stageItemLevel,
} from '../../src/plan/checks/v1';
import { FactReader } from '../../src/plan/checks/facts';
import { loadReferenceData } from '../../src/plan/referenceData';
import type { StageChecks } from '../../src/engine/schemas';
import type { Finding } from '../../src/plan/record';
import type { Stage } from '../../src/plan/schema';

const REPO = path.resolve(__dirname, '..', '..');
const ref = loadReferenceData(path.join(REPO, 'data'));
type Item = StageChecks['items'][number];
type Line = NonNullable<Item['affixes']>['lines'][number];

/** LocalEnergyShield's tiers on an intelligence body armour (Data/ModItem.lua:199-209): item level and top roll. */
const BODY_ES = { key: 'Prefix:LocalEnergyShield', type: 'Prefix' as const, group: 'LocalEnergyShield', tiers: [[1, 17], [8, 24], [16, 30], [25, 35], [33, 41], [46, 47], [54, 60], [60, 73], [65, 80], [70, 90], [79, 96]].map(([level, max]) => ({ level, max: [max] })) };
/** LocalIncreasedEnergyShieldAndBase's flat part (Data/ModItem.lua:402-407), a hybrid prefix. */
const HYBRID_ES = { key: 'Prefix:LocalIncreasedEnergyShieldAndBase', type: 'Prefix' as const, group: 'LocalIncreasedEnergyShieldAndBase', tiers: [[8, 7], [16, 13], [33, 16], [46, 20], [60, 25], [78, 30]].map(([level, max]) => ({ level, max: [max] })) };
/** BaseSpirit's tiers on a body armour and IncreasedLife's (Data/ModItem.lua), as the probe of compile_stage read them. */
const SPIRIT = { key: 'Prefix:BaseSpirit', type: 'Prefix' as const, group: 'BaseSpirit', tiers: [[16, 33], [25, 37], [33, 42], [46, 46], [54, 50], [60, 53], [65, 56], [78, 61]].map(([level, max]) => ({ level, max: [max] })) };
const LIFE = { key: 'Prefix:IncreasedLife', type: 'Prefix' as const, group: 'IncreasedLife', tiers: [[1, 19], [6, 29], [16, 39], [24, 59], [33, 69], [38, 84], [46, 99], [54, 119], [60, 149], [65, 174], [70, 189], [75, 199], [80, 214]].map(([level, max]) => ({ level, max: [max] })) };
const SUFFIX = (group: string) => ({ key: `Suffix:${group}`, type: 'Suffix' as const, group, tiers: [{ level: 1, max: [40] }] });

const line = (text: string, value: number, groups: Line['groups']): Line => ({ text, values: [value], lows: [value], groups });

function rare(slot: string, baseName: string, baseType: string, lines: Line[], extra: Partial<Item> = {}): Item {
  return {
    slot, name: `Test ${slot}, ${baseName}`, title: `Test ${slot}`, baseName, baseType, levelRequirement: 1, rarity: 'RARE',
    sockets: 0, runes: 0, corrupted: false, affixes: { prefixLimit: 3, suffixLimit: 3, lines }, ...extra,
  } as Item;
}

const stage = (variant: Stage['variant'], progress = 'endgame', slots: string[] = ['Body Armour', 'Helmet', 'Belt']): Stage =>
  ({ variant, progress, items: { slots: slots.map((slot) => ({ slot, text: 'x' })), treeJewels: [{ node: 17788, text: 'x' }], toggles: [], useSecondWeaponSet: false } }) as unknown as Stage;

function affixFindings(s: Stage, items: Item[]): { findings: Finding[]; notes: Finding[] } {
  const findings: Finding[] = [];
  const notes: Finding[] = [];
  checkAffixCap(s, { items }, new FactReader(ref), findings, notes);
  return { findings, notes };
}

describe('WU-137: V1 affix-cap (D-485)', () => {
  const body = (es: number, third: Line | null) =>
    rare('Body Armour', 'Vile Robe', 'Body Armour', [
      line(`+${es} to maximum Energy Shield`, es, [BODY_ES, HYBRID_ES]),
      line('+55 to Spirit', 55, [SPIRIT]),
      ...(third ? [third] : []),
    ]);

  it('the rung item levels are this amendment\'s: 69 on m, 82 on b and n; a card skeleton has none', () => {
    expect(RUNG_ITEM_LEVEL).toEqual({ 'entering-maps': 69, budget: 82, 'non-budget': 82 });
    expect(stageItemLevel(stage(undefined, 'endgame'), new FactReader(ref))).toBeNull();
  });

  it('with Spirit and a third prefix taking the slot, "+100 to maximum Energy Shield" is over the 96 of one group at item level 82; +96 passes', () => {
    const { findings } = affixFindings(stage('budget'), [body(100, line('+100 to maximum Life', 100, [LIFE]))]);
    expect(findings.map((f) => f.data!.cap)).toEqual([[96]]);
    expect(findings[0].message).toContain('the best is "+96 to maximum Energy Shield"');
    expect(findings[0].data).toMatchObject({ slot: 'Body Armour', path: 'items.slots[0].text', itemLevel: 82, values: [100] });
    expect(affixFindings(stage('budget'), [body(96, line('+100 to maximum Life', 100, [LIFE]))]).findings).toEqual([]);
  });

  it('with a free prefix the hybrid group adds its flat part: the cap is 96 + 30 = 126', () => {
    expect(affixFindings(stage('budget'), [body(126, null)]).findings).toEqual([]);
    expect(affixFindings(stage('budget'), [body(127, null)]).findings.map((f) => f.data!.cap)).toEqual([[126]]);
  });

  it('on m the cap is the tier at item level 69 (80, LocalEnergyShield9 at level 65); a campaign stage uses its C1 area level', () => {
    expect(affixFindings(stage('entering-maps'), [body(90, line('+100 to maximum Life', 100, [LIFE]))]).findings.map((f) => f.data!.cap)).toEqual([[80]]);
    const area = ref.resolveFact('campaign/progress.json', 'q.act-1-ogham-manor-candlemass.area-level');
    expect(area.ok).toBe(true);
    const level = (area as { ok: true; fact: { value: number } }).fact.value;
    const best = Math.max(...BODY_ES.tiers.filter((t) => t.level <= level).map((t) => t.max[0]));
    // The campaign body carries no Spirit line a low area level can't roll: its ES line alone, beside two life prefixes' worth.
    const camp = affixFindings(stage(undefined, 'q.act-1-ogham-manor-candlemass'), [
      rare('Body Armour', 'Vile Robe', 'Body Armour', [line(`+${best + 1} to maximum Energy Shield`, best + 1, [BODY_ES]), line('+10 to maximum Life', 10, [LIFE])]),
    ]);
    expect(camp.findings.map((f) => [f.data!.cap, f.data!.itemLevel])).toEqual([[[best], level]]);
    // A line with no tier at the item level still takes its affix: the Spirit line on a level-1 campaign body is a finding
    // of its own ("none of its tiers rolls"), and the ES line's room is still two prefixes.
    const low = affixFindings(stage(undefined, 'q.act-1-clearfell-beira'), [body(17, line('+10 to maximum Life', 10, [LIFE]))]);
    expect(low.findings.map((f) => [f.data!.line, f.data!.cap])).toEqual([['+55 to Spirit', null]]);
  });

  it('a rare with 4 prefixes, and a rare jewel with 3, are findings naming the count; a line no mod writes is a note', () => {
    const four = rare('Helmet', 'Sorcerous Tiara', 'Helmet', ['a', 'b', 'c', 'd'].map((g) => line(`+1 to ${g}`, 1, [{ key: `Prefix:${g}`, type: 'Prefix', group: g, tiers: [{ level: 1, max: [1] }] }])));
    const jewel = { ...rare('Jewel 17788', 'Ruby', 'Jewel', ['a', 'b', 'c'].map((g) => line(`+1 to ${g}`, 1, [{ key: `Prefix:${g}`, type: 'Prefix', group: g, tiers: [{ level: 1, max: [1] }] }]))), affixes: undefined } as Item;
    jewel.affixes = { prefixLimit: 2, suffixLimit: 2, lines: four.affixes!.lines.slice(0, 3) };
    const { findings, notes } = affixFindings(stage('budget'), [four, jewel, rare('Belt', 'Utility Belt', 'Belt', [line('+1 to Level of all Spell Skills', 1, [])])]);
    expect(findings.map((f) => [f.data!.slot, f.data!.prefixes, f.data!.prefixLimit])).toEqual([
      ['Helmet', 4, 3],
      ['Jewel 17788', 3, 2],
    ]);
    expect(findings[1].data!.path).toBe('items.treeJewels[0].text');
    expect(notes.map((n) => [n.code, n.data!.line])).toEqual([['affix-cap', '+1 to Level of all Spell Skills']]);
    // Three prefixes and three suffixes fit.
    const six = rare('Helmet', 'Sorcerous Tiara', 'Helmet', [...['a', 'b', 'c'].map((g) => line(`+1 to ${g}`, 1, [{ key: `Prefix:${g}`, type: 'Prefix', group: g, tiers: [{ level: 1, max: [1] }] }])), ...['d', 'e', 'f'].map((g) => line(`+1 to ${g}`, 1, [SUFFIX(g)]))]);
    expect(affixFindings(stage('budget'), [six]).findings).toEqual([]);
  });

  it("a unique's line outside its data's range is a finding; within it, none; a line its data lacks is a note", () => {
    const unique = (value: number): Item =>
      ({ slot: 'Helmet', name: "Alpha's Howl, Armoured Cap", title: "Alpha's Howl", baseName: 'Armoured Cap', baseType: 'Helmet', levelRequirement: 1, rarity: 'UNIQUE', sockets: 0, runes: 0, corrupted: false,
        affixes: { unique: true, lines: [{ text: `${value}% increased Evasion Rating`, values: [value], lows: [value], range: { min: [80], max: [100] } }, { text: 'Hits sing', values: [], lows: [] }] } }) as Item;
    const over = affixFindings(stage('budget'), [unique(120)]);
    expect(over.findings.map((f) => f.data!.line)).toEqual(['120% increased Evasion Rating']);
    expect(over.findings[0].message).toContain('(80 to 100)');
    expect(over.notes.map((n) => n.data!.line)).toEqual(['Hits sing']);
    expect(affixFindings(stage('budget'), [unique(90)]).findings).toEqual([]);
    expect(affixFindings(stage('budget'), [unique(70)]).findings).toHaveLength(1);
  });
});

describe('WU-137: V1 sockets (D-485)', () => {
  const run = (items: Item[]): Finding[] => {
    const findings: Finding[] = [];
    checkSockets(stage('budget', 'endgame', ['Body Armour', 'Helmet', 'Gloves']), { items }, new FactReader(ref), findings);
    return findings;
  };
  const item = (slot: string, baseName: string, baseType: string, extra: Partial<Item>): Item =>
    ({ slot, name: baseName, baseName, baseType, levelRequirement: 1, rarity: 'RARE', sockets: 0, runes: 0, corrupted: false, ...extra }) as Item;

  it('the table maps bases by name, then type, then hands', () => {
    expect(socketFactOf({ baseName: 'Vile Robe', baseType: 'Body Armour' })).toBe('sockets.body-armour');
    expect(socketFactOf({ baseName: 'Stalking Belt', baseType: 'Belt' })).toBe('sockets.stalking-belt');
    expect(socketFactOf({ baseName: 'Gothic Quarterstaff', baseType: 'Staff', hands: 2 })).toBe('sockets.two-hand-weapon');
    expect(socketFactOf({ baseName: 'Ruby', baseType: 'Jewel' })).toBeNull();
  });

  it('a rare helmet with two sockets and a rare body with three are findings; a body with two isn\'t', () => {
    const found = run([item('Helmet', 'Sorcerous Tiara', 'Helmet', { sockets: 2 }), item('Body Armour', 'Vile Robe', 'Body Armour', { sockets: 3 })]);
    expect(found.map((f) => [f.data!.slot, f.data!.sockets, f.data!.allowed, f.data!.fact])).toEqual([
      ['Helmet', 2, 1, 'sockets.helmet'],
      ['Body Armour', 3, 2, 'sockets.body-armour'],
    ]);
    expect(found[1].message).toContain('data:items/sockets.json#sockets.body-armour');
    expect(run([item('Body Armour', 'Vile Robe', 'Body Armour', { sockets: 2 })])).toEqual([]);
  });

  it("a unique's own count, +1 corrupted: Morior Invictus 4, 5 corrupted, not 5 plain; Alpha's Howl its base's 1, 2 only corrupted", () => {
    const morior = (sockets: number, corrupted: boolean) => item('Body Armour', 'Grand Regalia', 'Body Armour', { rarity: 'UNIQUE', title: 'Morior Invictus', uniqueSockets: 4, sockets, corrupted });
    const alpha = (sockets: number, corrupted: boolean) => item('Helmet', 'Armoured Cap', 'Helmet', { rarity: 'UNIQUE', title: "Alpha's Howl", sockets, corrupted });
    expect(run([morior(4, false), morior(5, true), alpha(1, false), alpha(2, true)])).toEqual([]);
    expect(run([morior(5, false), alpha(2, false)]).map((f) => [f.data!.item, f.data!.allowed])).toEqual([
      ['Morior Invictus, Grand Regalia', 4],
      ["Alpha's Howl, Armoured Cap", 1],
    ]);
  });

  it('D-464: a pinned weapon (a Swap slot with sameAs) is checked once, in the set-1 slot that writes it', () => {
    const s = { items: { slots: [{ slot: 'Weapon 2', text: 'x' }, { slot: 'Weapon 2 Swap', sameAs: 'Weapon 2' }], treeJewels: [], toggles: [], useSecondWeaponSet: true } } as unknown as Stage;
    const shield = (slot: string) => item(slot, 'Splintered Tower Shield', 'Shield', { sockets: 2 });
    const findings: Finding[] = [];
    checkSockets(s, { items: [shield('Weapon 2'), shield('Weapon 2 Swap')] }, new FactReader(ref), findings);
    expect(findings.map((f) => [f.data!.slot, f.data!.path])).toEqual([['Weapon 2', 'items.slots[0].text']]);
  });

  it('a Rune: line on an item with no Sockets: line, and three runes on two sockets, are findings', () => {
    const found = run([item('Gloves', 'Vaal Gloves', 'Gloves', { runes: 1 }), item('Body Armour', 'Vile Robe', 'Body Armour', { sockets: 2, runes: 3 })]);
    expect(found.map((f) => [f.data!.slot, f.data!.runes, f.data!.sockets])).toEqual([
      ['Gloves', 1, 0],
      ['Body Armour', 3, 2],
    ]);
    expect(found[0].message).toContain('no Sockets: line');
  });
});

describe('WU-137: V1 ascendancy-jewel (D-492)', () => {
  const run = (items: Item[]): Finding[] => {
    const findings: Finding[] = [];
    checkAscendancyJewel(stage('budget'), { items }, findings);
    return findings;
  };
  const jewel = (baseName: string, rarity: string, socketRule?: string): Item =>
    ({ slot: 'Jewel 17788', name: `J, ${baseName}`, title: 'J', baseName, baseType: 'Jewel', levelRequirement: 0, rarity, ...(socketRule ? { socketRule } : {}) }) as Item;

  it('a unique or a non-basic base in a basic-jewel socket is a finding; a rare Ruby, Emerald or Sapphire isn\'t; a socket without the rule takes any', () => {
    expect(BASIC_JEWELS).toEqual(['Ruby', 'Emerald', 'Sapphire']);
    expect(run(BASIC_JEWELS.map((b) => jewel(b, 'RARE', 'basic')))).toEqual([]);
    const found = run([jewel('Diamond', 'UNIQUE', 'basic'), jewel('Time-Lost Ruby', 'RARE', 'basic'), jewel('Diamond', 'UNIQUE')]);
    expect(found.map((f) => [f.data!.base, f.data!.unique, f.data!.node, f.data!.path])).toEqual([
      ['Diamond', true, 17788, 'items.treeJewels[0].text'],
      ['Time-Lost Ruby', false, 17788, 'items.treeJewels[0].text'],
    ]);
  });
});
