/**
 * WU-128 (amendment 13 §5, §12, §14, §8, §9; AC-P87, AC-P89, R-66): plan schema 9's pinned weapon, gem corruption, a
 * unique jewel's variant and D1-tree's plan fields through `compile_plan`, in process and engine-required. The schema
 * rows are `tests/unit/planSchema9.test.ts`, V1's over hand-made inputs `tests/unit/v1Schema9.test.ts`.
 *
 * - **The pinned weapon** (D-464; the spike, R-66): on the two-stage fixture's Warrior (Titan) stage, a club in `Weapon 1`,
 *   a magic Splintered Tower Shield with "+40 to maximum Life" (`Data/Bases/shield.lua`; `Data/ModItem.lua`'s life line)
 *   in `Weapon 2`, a Slim Mace in `Weapon 1 Swap` and `{slot: "Weapon 2 Swap", sameAs: "Weapon 2"}`: the saved file holds
 *   the shield once, its id in both slots, and set 2's figures equal a compile with two copies of the text. A stage with
 *   no shield on set 2 shows the shield counts there. `Weapon 1 Swap` sharing `Weapon 1` is the other pair.
 * - **Corruption** (D-471): Boneshatter at gem level 20 with `corrupt: "plus_one_level"` on `n` is calculated at 21: the
 *   record's `GemLevel` (PoB's sum of the gem's level and its `GemCorruptionLevel`, `Modules/CalcPerform.lua`:3574-3582,
 *   `Modules/CalcActiveSkill.lua`:770-772) is 21 against 20 for the same gem uncorrupted, and V1 has no `gem-availability`
 *   finding (it reads the written level, 20). On `m`, and on a support gem (Rage I), V1 reports `corruption`.
 * - **A unique jewel's variant** (§14, the spike): Prism of Belief (`Data/Uniques/Special/Generated.lua`:76-105, a
 *   Diamond, one variant per skill gem, "+(1-3) to Level of all <skill> Skills") written with two of its variants and its
 *   `Selected Variant` line, in the socket 26725 the Warrior's tree reaches (compileSchema8's path): the selected
 *   variant's line alone applies (Boneshatter's level +3 with variant 1, unchanged with variant 2).
 * - **D1-tree's fields** (§8, §9): `tree.start`, `tree.end` and `tree.search` compile and change no figure.
 */
import fs from 'fs';
import path from 'path';
import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import { engineDescribe } from '../helpers/engine';
import { startSessionFixture, type SessionFixture } from '../helpers/engineSession';
import type { CompileRecord, Finding } from '../../src/plan/record';

const REPO = path.resolve(__dirname, '..', '..');
const TWO_STAGE = path.join(REPO, 'tests', 'fixtures', 'plans', 'two-stage', 'plan.json');
const ENGINE_TIMEOUT = 600_000;

type Json = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
const judgment = (ref: string) => ({ kind: 'judgment', ref, confidence: 'L' });
const read = (file: string): Json => JSON.parse(fs.readFileSync(file, 'utf8')) as Json;

const CLUB = 'Rarity: Normal\nWooden Club';
const SHIELD = 'Rarity: Magic\nHale Splintered Tower Shield\n+40 to maximum Life';
const MACE = 'Rarity: Normal\nSlim Mace';
/** The two-stage fixture's path from Brutal (5710) to the jewel socket 26725 (compileSchema8). */
const SOCKET_PATH = [38323, 22928, 27373, 16725, 54811, 57703];
const SOCKET = 26725;

/** Prism of Belief as `Data/Uniques/Special/Generated.lua` writes it, with two of its variants and the selected one. */
const prism = (variant: number) =>
  [
    'Rarity: Unique',
    'Prism of Belief',
    'Diamond',
    'Variant: Boneshatter',
    'Variant: Rolling Slam',
    `Selected Variant: ${variant}`,
    'Limited to: 1',
    '{variant:1}+3 to Level of all Boneshatter Skills',
    '{variant:2}+3 to Level of all Rolling Slam Skills',
    'Corrupted',
  ].join('\n');

const TREE_START = {
  ehp: 1000,
  lowestMaxHit: { type: 'fire', value: 400 },
  life: 300,
  boss: 5000,
  bossEntries: [{ group: 1, label: 'Boneshatter', figure: 5000 }],
};
const TREE_SEARCH = { swaps: 3, lastGain: 1.4, capHit: false, rebuild: 'taken', removed: [{ names: ['Brutal'], skill: 'Rolling Slam' }], bossFall: null };

/** A stage of the two-stage fixture's stage-2 content: a rung, a campaign stage or a card skeleton. */
function stageFrom(id: string, kind: 'entering-maps' | 'budget' | 'non-budget' | 'campaign', edit: (s: Json) => void = () => undefined): Json {
  const s = read(TWO_STAGE).stages[1];
  const level = kind === 'campaign' ? 45 : kind === 'entering-maps' ? 70 : kind === 'budget' ? 80 : 90;
  Object.assign(s, { id, loadoutName: `Stage ${id} (L${level}) {${id}}`, level, claims: [] });
  if (kind === 'campaign') s.progress = 'q.act-4-isle-of-kin-blind-beast';
  else {
    s.progress = 'endgame';
    Object.assign(s, { variant: kind, ascendancyPoints: 0, variantBasis: { level: judgment('t'), gemLevels: judgment('t'), ascendancyPoints: judgment('t') } });
  }
  edit(s);
  return s;
}

/** The weapons: set 1 club and shield, set 2 a mace and `swap2` (a text, a sameAs entry, or none). */
const weapons = (swap2: Json | null, swap1: Json = { slot: 'Weapon 1 Swap', text: MACE }) => (s: Json) => {
  s.items.slots = [
    { slot: 'Weapon 1', text: CLUB },
    { slot: 'Weapon 2', text: SHIELD },
    swap1,
    ...(swap2 === null ? [] : [swap2]),
    ...s.items.slots.filter((e: Json) => !e.slot.startsWith('Weapon')),
  ];
};

/** Boneshatter (group 1, gem 1) at level 20, corrupted when `corrupt`; Rage I (gem 2) corrupted when `support`. */
const corrupted = (corrupt: boolean, support = false) => (s: Json) => {
  const gems = s.skills.groups[0].gems;
  gems[0].level = 20;
  if (corrupt) gems[0].corrupt = 'plus_one_level';
  if (support) gems[1].corrupt = 'plus_one_level';
};

/** The socket path from Brutal to 26725, `jewel` in it. */
const socketed = (jewel: string) => (s: Json) => {
  s.tree.nodes.push(...SOCKET_PATH, SOCKET);
  for (const n of SOCKET_PATH) s.tree.attributeChoices.push({ node: n, attribute: 'strength' });
  s.items.treeJewels = [{ node: SOCKET, text: jewel }];
};

function planOf(version: number, stages: Json[]): Json {
  const p = read(TWO_STAGE);
  Object.assign(p, { schemaVersion: version, stages, ledger: [] });
  return p;
}

const codesOf = (record: CompileRecord, id: string, code: string): Finding[] => record.stages[id].v1!.findings.filter((f) => f.code === code);

/** The saved file's item sets: per set id, its title and its slots' item ids; and each item's text by id. */
function savedItems(xml: string): { sets: Map<number, { title: string; slots: Record<string, number> }>; items: Map<number, string> } {
  const items = new Map<number, string>();
  for (const m of xml.matchAll(/<Item\b[^>]*\bid="(\d+)"[^>]*>([\s\S]*?)<\/Item>/g)) items.set(Number(m[1]), m[2]);
  const sets = new Map<number, { title: string; slots: Record<string, number> }>();
  for (const m of xml.matchAll(/<ItemSet\b([^>]*)>([\s\S]*?)<\/ItemSet>/g)) {
    const id = Number(/\bid="(\d+)"/.exec(m[1])![1]);
    const title = /\btitle="([^"]*)"/.exec(m[1])?.[1] ?? '';
    const slots: Record<string, number> = {};
    for (const s of m[2].matchAll(/<Slot\b([^>]*)\/>/g)) {
      const name = /\bname="([^"]*)"/.exec(s[1])![1];
      slots[name] = Number(/\bitemId="(\d+)"/.exec(s[1])![1]);
    }
    sets.set(id, { title, slots });
  }
  return { sets, items };
}

/** The item set a stage uses, from the record's sets. */
const itemSetOf = (record: CompileRecord, id: string): number => record.sets.find((s) => s.kind === 'item' && s.stages.includes(id))!.id;

engineDescribe('WU-128: schema 9 items, gems and tree fields through compile_plan (amendment 13 §5, §8, §9, §12, §14)', () => {
  let f: SessionFixture;
  let pinned: { record: CompileRecord; xml: string };
  let copies: { record: CompileRecord; xml: string };
  let corruption: CompileRecord;
  let variants: CompileRecord;
  let fields: { with: CompileRecord; without: CompileRecord };
  /** PoB's main skill on each corruption loadout: its name, the level it's calculated at and its GemCorruptionLevel. */
  let corruptionMods: Record<string, { name: string; level: number; corruption: number }>;
  /** The pinned plan's saved file loaded back into PoB (R-66's round trip): each item set's weapon slots, by set title. */
  let reloaded: Record<string, Record<string, number>>;

  async function compiled(slug: string, plan: Json): Promise<{ record: CompileRecord; xml: string }> {
    const made = await f.call('guide_run', { new_run: slug });
    if (made.isError) throw new Error(`guide_run failed: ${made.text}`);
    const abs = /^Created run folder (.+)$/m.exec(made.text)![1];
    const planPath = /^plan_path for this run: (\S+)$/m.exec(made.text)![1];
    fs.writeFileSync(path.join(f.guides, planPath), `${JSON.stringify(plan, null, 2)}\n`);
    const out = await f.call('compile_plan', { plan_path: planPath, measure_only: true });
    expect({ slug, isError: out.isError, text: out.isError ? out.text : '' }).toEqual({ slug, isError: false, text: '' });
    return {
      record: read(path.join(abs, 'compile-record.json')) as unknown as CompileRecord,
      xml: fs.readFileSync(path.join(abs, 'compiled-build.xml'), 'utf8'),
    };
  }

  beforeAll(async () => {
    f = await startSessionFixture({ testActions: true });
    pinned = await compiled(
      'pinned',
      planOf(9, [
        stageFrom('pin', 'budget', weapons({ slot: 'Weapon 2 Swap', sameAs: 'Weapon 2' })),
        stageFrom('pin1', 'campaign', weapons(null, { slot: 'Weapon 1 Swap', sameAs: 'Weapon 1' })),
      ]),
    );
    copies = await compiled(
      'copies',
      planOf(9, [stageFrom('copies', 'budget', weapons({ slot: 'Weapon 2 Swap', text: SHIELD })), stageFrom('bare', 'budget', weapons(null))]),
    );
    corruption = (
      await compiled(
        'corruption',
        planOf(9, [
          stageFrom('n', 'non-budget', corrupted(true)),
          stageFrom('n0', 'non-budget', corrupted(false)),
          stageFrom('m', 'entering-maps', corrupted(true)),
          stageFrom('nSupport', 'non-budget', corrupted(false, true)),
        ]),
      )
    ).record;
    // The engine holds the corruption plan's build: each loadout's main skill, as PoB calculates it.
    corruptionMods = (
      await f.session.run({ tool: 'test:corruption-mods', kind: 'read' }, async (ctx) => {
        const reply = await ctx.client.request('__test_eval', {
          code: `
            local out = {}
            for _, id in ipairs({ 'n', 'n0', 'nSupport' }) do
              build:SetActiveLoadout(build:GetLoadoutByName('Stage ' .. id .. ' (L90) {' .. id .. '}'))
              wipeGlobalCache()
              build.buildFlag = true
              build.calcsTab:BuildOutput()
              local skill = build.calcsTab.mainEnv.player.mainSkill
              out[id] = { name = skill.activeEffect.grantedEffect.name, level = skill.activeEffect.level,
                corruption = skill.skillModList:Sum('BASE', skill.skillCfg, 'GemCorruptionLevel') }
            end
            return out`,
        });
        return reply.result as Record<string, { name: string; level: number; corruption: number }>;
      })
    ).value;
    variants = (await compiled('prism', planOf(9, [stageFrom('v1', 'campaign', socketed(prism(1))), stageFrom('v2', 'campaign', socketed(prism(2)))])))
      .record;
    const withFields = stageFrom('t', 'budget', (s) => Object.assign(s.tree, { start: TREE_START, end: { ...TREE_START, ehp: 1100 }, search: TREE_SEARCH }));
    fields = {
      with: (await compiled('tree-fields', planOf(9, [withFields]))).record,
      without: (await compiled('tree-fields-none', planOf(9, [stageFrom('t', 'budget')]))).record,
    };
    // R-66: the pinned plan's saved file, loaded back, still holds one item in both slots.
    const { value } = await f.session.run({ tool: 'test:pinned-reload', kind: 'load' }, async (ctx) => {
      await ctx.loadXml(pinned.xml, { displayName: 'pinned' });
      const reply = await ctx.client.request('__test_eval', {
        code: `
          local out = {}
          for _, id in ipairs(build.itemsTab.itemSetOrderList) do
            local set = build.itemsTab.itemSets[id]
            local slots = {}
            for _, name in ipairs({ 'Weapon 1', 'Weapon 2', 'Weapon 1 Swap', 'Weapon 2 Swap' }) do slots[name] = set[name].selItemId end
            out[set.title] = slots
          end
          return out`,
      });
      return reply.result as Record<string, Record<string, number>>;
    });
    reloaded = value;
  }, ENGINE_TIMEOUT);

  afterAll(async () => f?.close(), 60_000);

  describe('§5 (D-464): the pinned weapon', () => {
    it("AC-P87 (spike, R-66): a schema-9 stage with {slot: 'Weapon 2 Swap', sameAs: 'Weapon 2'} saves one item, whose id fills both slots in the saved file", () => {
      const { sets, items } = savedItems(pinned.xml);
      const set = sets.get(itemSetOf(pinned.record, 'pin'))!;
      expect(set.slots['Weapon 2']).toBeGreaterThan(0);
      expect(set.slots['Weapon 2 Swap']).toBe(set.slots['Weapon 2']);
      expect(items.get(set.slots['Weapon 2'])).toContain('Splintered Tower Shield');
      // One shield item for the stage, in both weapon sets: the file holds one per stage that equips it (pin and pin1).
      const shields = (slots: Record<string, number>) => new Set(Object.values(slots).filter((id) => items.get(id)?.includes('Splintered Tower Shield')));
      expect([...shields(set.slots)]).toEqual([set.slots['Weapon 2']]);
      expect([...items.values()].filter((t) => t.includes('Splintered Tower Shield'))).toHaveLength(2);
      // The two copies are two items.
      const two = savedItems(copies.xml);
      const copySet = two.sets.get(itemSetOf(copies.record, 'copies'))!;
      expect(copySet.slots['Weapon 2 Swap']).not.toBe(copySet.slots['Weapon 2']);
    });

    it('R-66: the saved file round-trips: loaded back into PoB, the item set still holds the one shield in both slots', () => {
      const { sets } = savedItems(pinned.xml);
      const set = sets.get(itemSetOf(pinned.record, 'pin'))!;
      expect(reloaded[set.title]).toMatchObject({ 'Weapon 2': set.slots['Weapon 2'], 'Weapon 2 Swap': set.slots['Weapon 2'] });
      const one = sets.get(itemSetOf(pinned.record, 'pin1'))!;
      expect(reloaded[one.title]).toMatchObject({ 'Weapon 1': one.slots['Weapon 1'], 'Weapon 1 Swap': one.slots['Weapon 1'] });
    });

    it("AC-P87: its set-2 figures equal a compile with two copies of the text, and the shield counts on set 2", () => {
      expect(pinned.record.stages.pin.outputsSet2).toEqual(copies.record.stages.copies.outputsSet2);
      expect(pinned.record.stages.pin.skillOutputsSet2).toEqual(copies.record.stages.copies.skillOutputsSet2);
      expect(pinned.record.stages.pin.outputs).toEqual(copies.record.stages.copies.outputs);
      expect(pinned.record.stages.pin.outputsSet2!.Life).toBe(copies.record.stages.bare.outputsSet2!.Life + 40);
    });

    it("§5: Weapon 1 Swap sharing Weapon 1 holds the club's id in both slots; a shared Swap slot still uses set 2", () => {
      const { sets } = savedItems(pinned.xml);
      const set = sets.get(itemSetOf(pinned.record, 'pin1'))!;
      expect(set.slots['Weapon 1 Swap']).toBe(set.slots['Weapon 1']);
      expect(pinned.record.stages.pin1.outputsSet2).toBeDefined();
      expect(pinned.record.stages.pin.outputsSet2).toBeDefined();
    });

    it('§5: no V1 finding comes of the shared slot (empty-weapon-set, item checks)', () => {
      expect(pinned.record.stages.pin.v1!.findings.map((x) => x.code)).toEqual(copies.record.stages.copies.v1!.findings.map((x) => x.code));
    });
  });

  describe('§12 (D-471): gem corruption', () => {
    it('AC-P89: a level-20 skill gem with corrupt: plus_one_level on n is calculated at level 21 (PoB\'s GemCorruptionLevel), with no gem-availability finding', () => {
      expect(corruptionMods.n).toEqual({ name: 'Boneshatter', level: 21, corruption: 1 });
      expect(corruptionMods.n0).toEqual({ name: 'Boneshatter', level: 20, corruption: 0 });
      expect(corruption.stages.n0.outputs.GemLevel).toBe(20);
      expect(corruption.stages.n.outputs.GemLevel).toBe(21);
      expect(corruption.stages.n.outputs.TotalDPS).toBeGreaterThan(corruption.stages.n0.outputs.TotalDPS);
      expect(codesOf(corruption, 'n', 'gem-availability')).toEqual([]);
      expect(codesOf(corruption, 'n', 'corruption')).toEqual([]);
    });

    it('AC-P89: the same on m gives corruption; a corrupted support gem on n gives corruption', () => {
      expect(codesOf(corruption, 'm', 'corruption').map((x) => x.data)).toEqual([
        { gem: 'Boneshatter', group: 1, index: 1, rule: 'rung', variant: 'entering-maps', path: 'skills.groups[0].gems[0].corrupt' },
      ]);
      expect(codesOf(corruption, 'nSupport', 'corruption').map((x) => x.data)).toEqual([
        { gem: 'Rage I', group: 1, index: 2, rule: 'support', path: 'skills.groups[0].gems[1].corrupt' },
      ]);
      // PoB doesn't corrupt a support gem: the stage measures as the uncorrupted one.
      expect(corruption.stages.nSupport.outputs.GemLevel).toBe(20);
      expect(corruptionMods.nSupport).toEqual({ name: 'Boneshatter', level: 20, corruption: 0 });
    });
  });

  describe('§14: a unique jewel written with its Selected Variant', () => {
    it("AC-P89 (spike): Prism of Belief compiles with the selected variant's line alone", () => {
      const base = read(TWO_STAGE).stages[1].skills.groups[0].gems[0].level;
      expect(variants.stages.v1.outputs.GemLevel).toBe(base + 3);
      expect(variants.stages.v2.outputs.GemLevel).toBe(base);
    });
  });

  describe('§8, §9: tree.start, tree.end and tree.search', () => {
    it('AC-P89: accepted on schema 9, they change no figure', () => {
      expect(fields.with.stages.t.outputs).toEqual(fields.without.stages.t.outputs);
      expect(fields.with.stages.t.measures).toEqual(fields.without.stages.t.measures);
      expect(fields.with.stages.t.v1).toEqual(fields.without.stages.t.v1);
    });
  });
});
