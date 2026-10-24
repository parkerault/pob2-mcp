/**
 * WU-108 (amendment 10 §10, D-435; AC-P78): the compiler fills a base's implicits on an item written without an
 * `Implicits:` line, as PoB's own rare list and crafting window do; a text with an `Implicits:` line and a unique are
 * kept as written; a base whose implicit has variants isn't filled, and V1 reports `implicit-variant`. In process and
 * engine-required.
 *
 * The fixture is `tests/fixtures/plans/base-implicits/plan.json`, written from the pinned game data: a Warrior / Titan at
 * level 80 (the tree of `tests/fixtures/plans/weapon-set-slots`), one group of Rapid Assault, four endgame stages:
 * - `bare`: a Hardwood Spear (`Data/Bases/spear.lua`, implicit "Grants Skill: Spear Throw") and a Ruby Ring
 *   (`Data/Bases/ring.lua`, implicit "+(20-30)% to Fire Resistance"), each written as a bare base;
 * - `zero`: the same two written with `Implicits: 0`;
 * - `unique`: Cracklecreep, a unique Ruby Ring (`Data/Uniques/ring.lua`), written without an `Implicits:` line;
 * - `variant`: beside `zero`'s items, a bare Portent Amulet, whose implicit has variants (`Data/Bases/amulet.lua`'s
 *   `variantList`).
 * Every expected value comes from PoB itself: the item its own crafting window makes from the base (ItemsTab:CraftItem,
 * driven through its popup's controls), its parse of the plan's text, its default roll (main.defaultItemAffixQuality),
 * and the compile record.
 */
import fs from 'fs';
import path from 'path';
import { afterAll, beforeAll, expect, it } from '@jest/globals';
import { engineDescribe } from '../helpers/engine';
import { startSessionFixture, type SessionFixture } from '../helpers/engineSession';
import type { CompileRecord } from '../../src/plan/record';

const FIXTURE = path.resolve(__dirname, '..', 'fixtures', 'plans', 'base-implicits', 'plan.json');
const ENGINE_TIMEOUT = 600_000;
const LOADOUT: Record<string, string> = {
  bare: 'Bare bases (L80) {bare}',
  zero: 'Implicits written as none (L80) {zero}',
  unique: 'A unique ring (L80) {unique}',
  variant: 'A bare variant amulet (L80) {variant}',
};

type Json = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

/** Lua: an item's implicit lines, its granted skills and its mods, comparable across items. */
const ITEM_FACTS = `
  local function facts(item)
    local out = { implicits = {}, explicits = {}, granted = {}, mods = {}, rarity = item.rarity, base = item.baseName }
    for _, l in ipairs(item.implicitModLines or {}) do out.implicits[#out.implicits + 1] = { line = l.line, range = l.range } end
    for _, l in ipairs(item.explicitModLines or {}) do out.explicits[#out.explicits + 1] = { line = l.line, range = l.range } end
    for _, g in ipairs(item.grantedSkills or {}) do out.granted[#out.granted + 1] = { skillId = g.skillId, level = g.level } end
    for _, m in ipairs(item.modList or (item.slotModList and item.slotModList[1]) or {}) do
      if type(m.value) == 'number' then out.mods[#out.mods + 1] = { name = m.name, type = m.type, value = m.value } end
    end
    table.sort(out.mods, function(a, b) return a.name .. a.type < b.name .. b.type end)
    return out
  end`;

engineDescribe("WU-108: a bare base gets its base's implicits, as PoB's own crafted item has them (D-435; AC-P78)", () => {
  let f: SessionFixture;
  let record: CompileRecord;

  async function lua<T>(code: string): Promise<T> {
    const { value } = await f.session.run({ tool: 'test:base-implicits-query', kind: 'read' }, async (ctx) => {
      const reply = await ctx.client.request('__test_eval', { code });
      return reply.result as T;
    });
    return value;
  }

  /** The item a stage's loadout holds in `slot`, as PoB holds it. */
  async function equipped(stage: string, slot: string): Promise<Json> {
    return lua(`${ITEM_FACTS}
      build:SetActiveLoadout(build:GetLoadoutByName(${JSON.stringify(LOADOUT[stage])}))
      local sel = build.itemsTab.activeItemSet[${JSON.stringify(slot)}].selItemId
      local item = sel ~= 0 and build.itemsTab.items[sel] or nil
      return item and facts(item) or { missing = true }`);
  }

  /**
   * PoB's own item crafted from `base` as a Normal item: its crafting window (ItemsTab:CraftItem) opened, its rarity,
   * type and base picked with the popup's own controls, and its Create button pressed, which makes the item from the
   * base (filling the base's implicits) and shows it as the display item.
   */
  async function crafted(base: string): Promise<Json> {
    return lua(`${ITEM_FACTS}
      local itemsTab = build.itemsTab
      local d = build.data
      local wanted = d.itemBases[${JSON.stringify(base)}]
      local typeName = wanted.type .. (wanted.subType and (': ' .. wanted.subType) or '')
      itemsTab:CraftItem()
      local c = main.popups[1].controls
      c.rarity.selIndex = 1
      for i, t in ipairs(d.itemBaseTypeList) do
        if t == typeName then c.type.selIndex = i; c.type.selFunc(i, t) end
      end
      for i, b in ipairs(c.base.list) do
        if b.name == ${JSON.stringify(base)} then c.base.selIndex = i end
      end
      c.save.onClick()
      local item = itemsTab.displayItem
      itemsTab:SetDisplayItem(nil)
      return facts(item)`);
  }

  /** PoB's parse of an item text, its quality normalised as PoB's paste path does (ItemsTab:CreateDisplayItemFromRaw). */
  async function parsed(text: string): Promise<Json> {
    return lua(`${ITEM_FACTS}
      local item = new('Item', ${JSON.stringify(text)})
      item:NormaliseQuality()
      item:BuildModList()
      return facts(item)`);
  }

  const planItem = (stage: string, slot: string): string => {
    const plan = JSON.parse(fs.readFileSync(FIXTURE, 'utf8')) as Json;
    return plan.stages.find((s: Json) => s.id === stage).items.slots.find((s: Json) => s.slot === slot).text;
  };
  const spearThrow = (id: string) => Object.values(record.stages[id].skillOutputs).filter((e) => e.skill === 'Spear Throw');

  beforeAll(async () => {
    f = await startSessionFixture({ testActions: true });
    const made = await f.call('guide_run', { new_run: 'base-implicits' });
    if (made.isError) throw new Error(`guide_run failed: ${made.text}`);
    const abs = /^Created run folder (.+)$/m.exec(made.text)![1];
    const planPath = /^plan_path for this run: (\S+)$/m.exec(made.text)![1];
    fs.copyFileSync(FIXTURE, path.join(f.guides, planPath));
    const out = await f.call('compile_plan', { plan_path: planPath, measure_only: true });
    if (out.isError) throw new Error(`compile_plan failed: ${out.text}`);
    record = JSON.parse(fs.readFileSync(path.join(abs, 'compile-record.json'), 'utf8')) as CompileRecord;
  }, ENGINE_TIMEOUT);

  afterAll(async () => f?.close(), 60_000);

  it(
    "a bare Hardwood Spear compiles with its base's Spear Throw, the same implicit and granted skill as PoB's own spear crafted from the base, and the record holds Spear Throw's group",
    async () => {
      const own = await crafted('Hardwood Spear');
      expect(own.implicits.map((l: Json) => l.line)).toEqual(['Grants Skill: Spear Throw']);
      const spear = await equipped('bare', 'Weapon 1');
      expect(spear.base).toBe('Hardwood Spear');
      expect(spear.implicits).toEqual(own.implicits);
      expect(spear.granted).toEqual(own.granted);
      expect(spear.granted.length).toBe(1);
      // PoB's own group for the granted skill was measured.
      expect(spearThrow('bare').length).toBeGreaterThan(0);
      expect(spearThrow('bare').some((e) => (e.fields.TotalDPS ?? 0) > 0)).toBe(true);
    },
    ENGINE_TIMEOUT,
  );

  it(
    "a bare Ruby Ring compiles with its fire resistance at PoB's default roll, the same implicit and mods as PoB's own ring crafted from the base, and the record's fire resistance rises by the mod's value",
    async () => {
      expect(await lua<number>('return main.defaultItemAffixQuality')).toBe(0.5);
      const own = await crafted('Ruby Ring');
      expect(own.implicits).toEqual([{ line: '+(20-30)% to Fire Resistance', range: 0.5 }]);
      const ring = await equipped('bare', 'Ring 1');
      expect(ring.implicits).toEqual(own.implicits);
      expect(ring.mods).toEqual(own.mods);
      const fire = own.mods.find((m: Json) => m.name === 'FireResist');
      expect(fire).toBeDefined();
      // The ring is the stages' only fire resistance: bare holds it, zero (written Implicits: 0) doesn't.
      expect(record.stages.bare.outputs.FireResistTotal - record.stages.zero.outputs.FireResistTotal).toBe(fire.value);
    },
    ENGINE_TIMEOUT,
  );

  it(
    'items written with Implicits: 0 compile as written: no implicit, no Spear Throw, the same item as PoB parses the text',
    async () => {
      for (const slot of ['Weapon 1', 'Ring 1']) {
        const item = await equipped('zero', slot);
        expect({ slot, implicits: item.implicits, granted: item.granted }).toEqual({ slot, implicits: [], granted: [] });
        const own = await parsed(planItem('zero', slot));
        expect(item.explicits).toEqual(own.explicits);
        expect(item.mods).toEqual(own.mods);
      }
      expect(spearThrow('zero')).toEqual([]);
    },
    ENGINE_TIMEOUT,
  );

  it(
    "a unique written without an Implicits: line compiles as written: no base implicit is added, the same item as PoB parses the text",
    async () => {
      const ring = await equipped('unique', 'Ring 1');
      const own = await parsed(planItem('unique', 'Ring 1'));
      expect(ring.rarity).toBe('UNIQUE');
      expect(ring.implicits).toEqual([]);
      expect(ring.implicits).toEqual(own.implicits);
      expect(ring.explicits).toEqual(own.explicits);
      expect(ring.mods).toEqual(own.mods);
      expect(ring.mods.some((m: Json) => m.name === 'FireResist')).toBe(false);
    },
    ENGINE_TIMEOUT,
  );

  it(
    "a bare Portent Amulet, whose implicit has variants, isn't filled, and V1 reports implicit-variant naming the base and its variants",
    async () => {
      const amulet = await equipped('variant', 'Amulet');
      expect(amulet.implicits).toEqual([]);
      expect(amulet.granted).toEqual([]);
      const variants = await lua<string[]>("return build.data.itemBases['Portent Amulet'].variantList");
      expect(variants.length).toBeGreaterThan(1);
      const found = (id: string) => (record.stages[id].v1?.findings ?? []).filter((x) => x.code === 'implicit-variant');
      const amuletAt = (JSON.parse(fs.readFileSync(FIXTURE, 'utf8')) as Json).stages
        .find((s: Json) => s.id === 'variant')
        .items.slots.findIndex((s: Json) => s.slot === 'Amulet');
      expect(found('variant')).toEqual([
        expect.objectContaining({
          code: 'implicit-variant',
          data: { slot: 'Amulet', base: 'Portent Amulet', variants, path: `items.slots[${amuletAt}].text` },
        }),
      ]);
      const message = found('variant')[0].message;
      expect(message).toContain('Portent Amulet');
      for (const v of variants) expect(message).toContain(v);
      expect(message).toMatch(/Write the variant's implicit line in the item's text, after an "Implicits: <n>" line$/);
      expect(record.stages.variant.v1?.pass).toBe(false);
      for (const id of ['bare', 'zero', 'unique']) expect({ id, found: found(id) }).toEqual({ id, found: [] });
    },
    ENGINE_TIMEOUT,
  );
});
