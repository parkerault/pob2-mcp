/**
 * WU-137 (amendment 14 §11; D-485; AC-P92, AC-P93's engine rows): V1's `affix-cap` and `sockets` through `compile_plan`, in
 * process and engine-required. Each stage of one schema-10 Lich plan (`tests/fixtures/plans/m27-wu137/lich/plan.json`'s
 * stage, its items changed) holds the items a row names; the findings are the compile record's V1. The units are
 * `tests/unit/v1Schema10.test.ts`.
 *
 * Every cap is read from the pinned `Data/ModItem.lua` (a mod group's tiers that roll on the base, PoB's spawn weight: the
 * weight of the first of its weightKey tags the base has, `Classes/Item.lua`:1377), never written in: at item level 82 they
 * are the live test's four (an intelligence body armour's flat Energy Shield 96, a helmet's 73, gloves' 60, a belt's maximum
 * Mana 124).
 *
 * - AC-P92 (b, item level 82): an intelligence body armour with Spirit, a third prefix (maximum Life) and "+100 to maximum
 *   Energy Shield" is a finding naming 96; at +96 none. With the third prefix taken, only one group writes the flat Energy
 *   Shield; the unit shows the hybrid adding its 30 when a prefix is free. A helmet's +90 names 73; gloves' +70 names 60; a
 *   belt's "+150 to maximum Mana" names 124; a rare with 4 prefixes, and a rare jewel with 3, are findings; a line no mod
 *   matches is a note and no finding; a unique line over its data's range is a finding. On `m` the body's finding names
 *   the cap at item level 69, and a campaign stage's gloves the cap at its C1 area level, each read from the data.
 * - AC-P93 (V1 `sockets`): a rare helmet with `Sockets: S S`, and a rare body with three, are findings; a rare body with two
 *   isn't; Morior Invictus with four isn't, with five and `Corrupted` isn't, with five and no `Corrupted` is; Alpha's Howl
 *   (no `Sockets:` line in PoB's data) with one isn't, with two is, with two and `Corrupted` isn't; a `Rune:` line on an item
 *   with no `Sockets:` line, and three rune lines on two sockets, are findings. A claim citing
 *   `data:items/sockets.json#sockets.body-armour` compiles.
 */
import fs from 'fs';
import path from 'path';
import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import { engineDescribe } from '../helpers/engine';
import { startSessionFixture, type SessionFixture } from '../helpers/engineSession';
import type { CompileRecord, Finding } from '../../src/plan/record';

const REPO = path.resolve(__dirname, '..', '..');
const LICH = path.join(REPO, 'tests', 'fixtures', 'plans', 'm27-wu137', 'lich', 'plan.json');
const POB = path.join(REPO, 'vendor', 'PathOfBuilding-PoE2', 'src');
const ENGINE_TIMEOUT = 600_000;
type Json = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
const read = (file: string): Json => JSON.parse(fs.readFileSync(file, 'utf8')) as Json;
const judgment = (r: string) => ({ kind: 'judgment', ref: r, confidence: 'L' });

/** A base's tags from the pinned `Data/Bases/<file>.lua`. */
function baseTags(file: string, name: string): Set<string> {
  const text = fs.readFileSync(path.join(POB, 'Data', 'Bases', `${file}.lua`), 'utf8');
  const block = text.split(/^itemBases\[/m).find((b) => b.startsWith(`"${name}"]`));
  if (block === undefined) throw new Error(`no base ${name} in ${file}.lua`);
  return new Set([.../\ttags = \{([^}]*)\}/.exec(block)![1].matchAll(/(\w+) = true/g)].map((m) => m[1]));
}

/**
 * The best top roll of `group`'s single-stat tiers on a base (its tags) at `level`, read from the pinned Data/ModItem.lua:
 * a tier rolls when its level is at most `level` and PoB's spawn weight on the base is above 0 (the weight of the first
 * weightKey tag the base has).
 */
function bestRoll(group: string, tags: Set<string>, level: number): number {
  const text = fs.readFileSync(path.join(POB, 'Data', 'ModItem.lua'), 'utf8');
  let best = 0;
  for (const line of text.split('\n')) {
    if (!line.includes(`group = "${group}"`)) continue;
    const lvl = Number(/ level = (\d+),/.exec(line)![1]);
    const keys = [.../weightKey = \{([^}]*)\}/.exec(line)![1].matchAll(/"([^"]+)"/g)].map((m) => m[1]);
    const vals = /weightVal = \{([^}]*)\}/.exec(line)![1].split(',').map((v) => Number(v.trim())).filter((v) => !Number.isNaN(v));
    const k = keys.findIndex((key) => tags.has(key));
    if (lvl > level || k < 0 || vals[k] <= 0) continue;
    best = Math.max(best, Number(/"[+]?\((\d+)-(\d+)\)/.exec(line)![2]));
  }
  return best;
}

const rare = (name: string, base: string, ...lines: string[]) => ['Rarity: Rare', name, base, ...lines].join('\n');
const MORIOR = (sockets: number, corrupted: boolean) =>
  ['Rarity: Unique', 'Morior Invictus', 'Grand Regalia', `Sockets: ${Array(sockets).fill('S').join(' ')}`, '350% increased Armour, Evasion and Energy Shield', '+50 to maximum Life per Socket filled', ...(corrupted ? ['Corrupted'] : [])].join('\n');
const ALPHA = (sockets: number, corrupted: boolean, evasion = 90) =>
  ['Rarity: Unique', "Alpha's Howl", 'Armoured Cap', ...(sockets > 0 ? [`Sockets: ${Array(sockets).fill('S').join(' ')}`] : []), `${evasion}% increased Evasion Rating`, '+100 to Spirit', '+60% to Cold Resistance', 'Presence Radius is doubled', ...(corrupted ? ['Corrupted'] : [])].join('\n');

/** The fixture's stage as stage `id` of `kind`, holding `slots` (and `jewel` in 17788, the Ruby by default). */
function stageOf(id: string, kind: 'budget' | 'entering-maps' | 'campaign', slots: Json[], jewel?: string): Json {
  const s = read(LICH).stages[0];
  const level = kind === 'campaign' ? 30 : kind === 'entering-maps' ? 70 : 90;
  Object.assign(s, { id, loadoutName: `Stage ${id} (L${level}) {${id}}`, level });
  if (kind === 'campaign') {
    s.progress = 'q.act-2-keth-kabala';
    for (const k of ['variant', 'ascendancyPoints', 'variantBasis']) delete s[k];
    s.tree.ascendancyNodes = [];
    s.items.treeJewels = [];
  } else {
    Object.assign(s, { variant: kind, ascendancyPoints: 2, variantBasis: { level: judgment('t'), gemLevels: judgment('t'), ascendancyPoints: judgment('t') } });
    if (jewel !== undefined) s.items.treeJewels = [{ node: 17788, text: jewel }];
  }
  s.items.slots = slots;
  return s;
}

const INT_BODY = baseTags('body', 'Vile Robe');
/** The body with Spirit and a third prefix (maximum Life), so one group writes its flat Energy Shield. */
const BODY = (es: number) => ({ slot: 'Body Armour', text: rare('Doom Shell', 'Vile Robe', `+${es} to maximum Energy Shield`, '+55 to Spirit', '+100 to maximum Life') });

engineDescribe('WU-137: V1 affix-cap and sockets through compile_plan (amendment 14 §11, AC-P92, AC-P93)', () => {
  let f: SessionFixture;
  let rec: CompileRecord;
  const findingsOf = (id: string, code: string): Finding[] => rec.stages[id].v1!.findings.filter((x) => x.code === code);
  const notesOf = (id: string, code: string): Finding[] => rec.stages[id].v1!.notes.filter((x) => x.code === code);

  beforeAll(async () => {
    f = await startSessionFixture({ testActions: true });
    const plan = read(LICH);
    plan.stages = [
      stageOf(
        'caps',
        'budget',
        [
          BODY(100),
          { slot: 'Helmet', text: rare('Doom Crown', 'Sorcerous Tiara', '+90 to maximum Energy Shield') },
          { slot: 'Gloves', text: rare('Doom Grip', 'Vaal Gloves', '+70 to maximum Energy Shield', '+1 to Level of all Spell Skills') },
          { slot: 'Belt', text: rare('Doom Cord', 'Utility Belt', '+150 to maximum Mana') },
          { slot: 'Boots', text: rare('Doom Tread', 'Sekhema Sandals', '+50 to maximum Life', '+50 to maximum Mana', '+30 to maximum Energy Shield', '25% increased Movement Speed') },
        ],
        rare('Doom Glint', 'Ruby', '15% increased Armour', '5% increased Area of Effect', '+1 to Maximum Rage'),
      ),
      stageOf('fits', 'budget', [BODY(96), { slot: 'Helmet', text: ALPHA(1, false) }]),
      stageOf('maps', 'entering-maps', [BODY(100)]),
      stageOf('camp', 'campaign', [{ slot: 'Gloves', text: rare('Doom Grip', 'Vaal Gloves', '+50 to maximum Energy Shield') }]),
      stageOf('sock1', 'budget', [
        { slot: 'Body Armour', text: rare('Doom Shell', 'Vile Robe', 'Sockets: S S S', '+60 to maximum Energy Shield') },
        { slot: 'Helmet', text: rare('Doom Crown', 'Sorcerous Tiara', 'Sockets: S S', '+60 to maximum Energy Shield') },
        { slot: 'Gloves', text: rare('Doom Grip', 'Vaal Gloves', 'Rune: Iron Rune', '+40 to maximum Energy Shield') },
      ]),
      stageOf('sock2', 'budget', [
        { slot: 'Body Armour', text: rare('Doom Shell', 'Vile Robe', 'Sockets: S S', '+60 to maximum Energy Shield') },
        { slot: 'Helmet', text: ALPHA(2, false, 120) },
      ]),
      stageOf('sock3', 'budget', [{ slot: 'Body Armour', text: MORIOR(4, false) }, { slot: 'Helmet', text: ALPHA(2, true) }]),
      stageOf('sock4', 'budget', [{ slot: 'Body Armour', text: MORIOR(5, true) }]),
      stageOf('sock5', 'budget', [{ slot: 'Body Armour', text: MORIOR(5, false) }]),
      stageOf('sock6', 'budget', [
        { slot: 'Body Armour', text: rare('Doom Shell', 'Vile Robe', 'Sockets: S S', 'Rune: Iron Rune', 'Rune: Iron Rune', 'Rune: Iron Rune', '+60 to maximum Energy Shield') },
      ]),
    ];
    // AC-P93: a claim citing the socket table compiles.
    plan.stages[4].claims = [{ id: 'body-sockets', text: 'A body armour has two rune sockets.', kind: 'hinge', source: 'data:items/sockets.json#sockets.body-armour' }];
    const made = await f.call('guide_run', { new_run: 'item-checks' });
    if (made.isError) throw new Error(`guide_run failed: ${made.text}`);
    const abs = /^Created run folder (.+)$/m.exec(made.text)![1];
    const planPath = /^plan_path for this run: (\S+)$/m.exec(made.text)![1];
    fs.writeFileSync(path.join(f.guides, planPath), `${JSON.stringify(plan, null, 2)}\n`);
    const out = await f.call('compile_plan', { plan_path: planPath, measure_only: true });
    expect({ isError: out.isError, text: out.isError ? out.text : '' }).toEqual({ isError: false, text: '' });
    rec = read(path.join(abs, 'compile-record.json')) as unknown as CompileRecord;
  }, ENGINE_TIMEOUT);

  afterAll(async () => f?.close(), 60_000);

  describe('AC-P92: affix-cap', () => {
    it('the data gives the live test\'s four caps at item level 82 (self-check of the reader)', () => {
      expect(bestRoll('LocalEnergyShield', INT_BODY, 82)).toBe(96);
      expect(bestRoll('LocalEnergyShield', baseTags('helmet', 'Sorcerous Tiara'), 82)).toBe(73);
      expect(bestRoll('LocalEnergyShield', baseTags('gloves', 'Vaal Gloves'), 82)).toBe(60);
      expect(bestRoll('IncreasedMana', baseTags('belt', 'Utility Belt'), 82)).toBe(124);
    });

    it('on b (item level 82): the body\'s +100 names 96, the helmet\'s +90 73, the gloves\' +70 60, the belt\'s +150 Mana 124', () => {
      const caps = findingsOf('caps', 'affix-cap').filter((x) => x.data!.cap !== undefined);
      expect(caps.map((x) => [x.data!.slot, x.data!.line, x.data!.cap, x.data!.itemLevel]).sort()).toEqual(
        [
          ['Belt', '+150 to maximum Mana', [124], 82],
          ['Body Armour', '+100 to maximum Energy Shield', [96], 82],
          ['Gloves', '+70 to maximum Energy Shield', [60], 82],
          ['Helmet', '+90 to maximum Energy Shield', [73], 82],
        ].sort(),
      );
      const body = caps.find((x) => x.data!.slot === 'Body Armour')!;
      expect(body.message).toContain('the best is "+96 to maximum Energy Shield"');
      expect(body.data!.path).toBe('items.slots[0].text');
    });

    it('the same body at +96 is no finding', () => {
      expect(findingsOf('fits', 'affix-cap')).toEqual([]);
    });

    it('a rare with 4 prefixes and a rare jewel with 3 are findings naming the count; a line no mod matches is a note and no finding', () => {
      const counts = findingsOf('caps', 'affix-cap').filter((x) => x.data!.prefixes !== undefined);
      expect(counts.map((x) => [x.data!.slot, x.data!.prefixes, x.data!.prefixLimit, x.data!.path])).toEqual([
        ['Boots', 4, 3, 'items.slots[4].text'],
        ['Jewel 17788', 3, 2, 'items.treeJewels[0].text'],
      ]);
      expect(notesOf('caps', 'affix-cap').map((x) => [x.data!.slot, x.data!.line])).toEqual([['Gloves', '+1 to Level of all Spell Skills']]);
      expect(findingsOf('caps', 'affix-cap').some((x) => x.data!.line === '+1 to Level of all Spell Skills')).toBe(false);
    });

    it("a unique's line over its data's range is a finding; within it, none", () => {
      expect(findingsOf('sock2', 'affix-cap').map((x) => [x.data!.slot, x.data!.line, x.data!.max])).toEqual([['Helmet', '120% increased Evasion Rating', [100]]]);
      expect(findingsOf('sock3', 'affix-cap')).toEqual([]);
    });

    it('on m the body\'s finding names the cap the data gives at item level 69; a campaign stage uses its C1 area level', () => {
      const at69 = bestRoll('LocalEnergyShield', INT_BODY, 69);
      expect(at69).toBe(80);
      expect(findingsOf('maps', 'affix-cap').map((x) => [x.data!.cap, x.data!.itemLevel])).toEqual([[[at69], 69]]);
      const area = (read(path.join(REPO, 'data', 'campaign', 'progress.json')) as Json).facts['q.act-2-keth-kabala.area-level'].value as number;
      const cap = bestRoll('LocalEnergyShield', baseTags('gloves', 'Vaal Gloves'), area);
      expect(cap).toBeLessThan(50);
      expect(findingsOf('camp', 'affix-cap').map((x) => [x.data!.cap, x.data!.itemLevel])).toEqual([[[cap], area]]);
    });
  });

  describe('AC-P93: sockets', () => {
    it('a rare helmet with S S and a rare body with three are findings; a Rune: line with no Sockets: line is one', () => {
      expect(findingsOf('sock1', 'sockets').map((x) => [x.data!.slot, x.data!.sockets, x.data!.allowed ?? null, x.data!.runes ?? null])).toEqual([
        ['Helmet', 2, 1, null],
        ['Body Armour', 3, 2, null],
        ['Gloves', 0, null, 1],
      ]);
    });

    it('a rare body with two is no finding (and its claim citing the socket table compiled)', () => {
      expect(findingsOf('sock2', 'sockets').map((x) => x.data!.slot)).toEqual(['Helmet']);
      expect(rec.stages.sock2).toBeDefined();
    });

    it("Morior Invictus with four isn't, with five and Corrupted isn't, with five and no Corrupted is", () => {
      expect(findingsOf('sock3', 'sockets').filter((x) => x.data!.slot === 'Body Armour')).toEqual([]);
      expect(findingsOf('sock4', 'sockets')).toEqual([]);
      expect(findingsOf('sock5', 'sockets').map((x) => [x.data!.item, x.data!.sockets, x.data!.allowed])).toEqual([['Morior Invictus, Grand Regalia', 5, 4]]);
    });

    it("Alpha's Howl (no Sockets: line in PoB's data) with one isn't, with two is, with two and Corrupted isn't", () => {
      expect(findingsOf('fits', 'sockets')).toEqual([]);
      expect(findingsOf('sock2', 'sockets').map((x) => [x.data!.item, x.data!.sockets, x.data!.allowed, x.data!.fact])).toEqual([["Alpha's Howl, Armoured Cap", 2, 1, 'sockets.helmet']]);
      expect(findingsOf('sock3', 'sockets')).toEqual([]);
    });

    it('three rune lines on two sockets are a finding', () => {
      expect(findingsOf('sock6', 'sockets').map((x) => [x.data!.sockets, x.data!.runes])).toEqual([[2, 3]]);
    });
  });
});
