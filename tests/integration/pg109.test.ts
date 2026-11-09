/**
 * AC-W135 (WU-153, amendment 16 §7, D-511, PG-109; engine): rune rolls on both sides.
 *
 * PoB's save writes each line's roll twice, as the `{range:<r>}` tag on the item text's line
 * (`Classes/Item.lua`:1461-1463) and as a `<ModRange>` numbered across the enchant, rune, implicit and explicit lines
 * (`Classes/ItemsTab.lua`:1221-1245); its load walks the lines without the rune lines (:1118) and sets each
 * `<ModRange>` roll over the text's, so on an item with rune lines every roll lands that many lines further down
 * (PG-109). The PG-109 entry of `pob-api/API/Patches.lua` wraps both sides: the save drops the `<ModRange>` copies
 * from every item, and the load drops them from every item whose text carries a `{range:` tag, so the rolls come
 * from the text. `import_build {save_as}` writes the decoded code by the load side's rule (`dropModRangeCopies`).
 *
 * The fixtures (`tests/fixtures/builds/pg109-*.xml`) are written from the pinned game data and the open-spell plan's
 * items (`tests/fixtures/plans/open-spell/r1-s-4/plan.json`), PG-109's probe case: a Witch holding the corrupted
 * Liminal Coil (`Data/Uniques/wand.lua`:57-67) with Hedgewitch Assandra's Rune of Wisdom, whose two wand lines are the
 * item's two rune lines (`Data/ModRunes.lua`:2743-2751), and the Veilpiercer ring, with no rune.
 * `pg109-rune-wand.xml` writes both items' rolls as `{range:}` tags, as a plan does; `pg109-pob-copies.xml` holds the
 * wand as PoB's own save writes it (the text with its tags and the eight misnumbered `<ModRange>` copies) and the ring
 * as an older PoB writes one, its rolls only in `<ModRange>` and none at the 0.5 a bare range defaults to. Every roll
 * is read from PoB's own item state (`__test_eval`): each line as PoB rolls it from its range
 * (`itemLib.applyRange`), and the range.
 */
import fs from 'fs';
import path from 'path';
import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { engineDescribe } from '../helpers/engine';
import { startLuaLineClient, type LuaLineClient } from '../helpers/luaLineClient';
import { startSessionFixture, type SessionFixture } from '../helpers/engineSession';
import { encodePobCode } from '../../src/utils/buildCode';

const FIXTURES = path.resolve(__dirname, '..', 'fixtures', 'builds');
const ENGINE_TIMEOUT = 180_000;

const RUNE_WAND = fs.readFileSync(path.join(FIXTURES, 'pg109-rune-wand.xml'), 'utf8');
const POB_COPIES = fs.readFileSync(path.join(FIXTURES, 'pg109-pob-copies.xml'), 'utf8');

interface Roll {
  kind: string;
  range?: number;
  line: string;
}

interface Rolls {
  wand: Roll[];
  ring: Roll[];
}

/** Each line of the wand (Weapon 1) and the ring (Ring 1) as PoB holds it: its list, its range, its rolled text. */
const ROLLS = `
  local function rolls(slot)
    local item = build.itemsTab.items[build.itemsTab.slots[slot].selItemId]
    local out = {}
    for _, kind in ipairs({ 'enchantModLines', 'runeModLines', 'implicitModLines', 'explicitModLines' }) do
      for _, ml in ipairs(item[kind]) do
        out[#out + 1] = {
          kind = kind, range = ml.range,
          line = itemLib.applyRange(ml.line, ml.range or main.defaultItemAffixQuality, ml.valueScalar, ml.corruptedRange),
        }
      end
    end
    return out
  end
  return { wand = rolls('Weapon 1'), ring = rolls('Ring 1') }`;

/** The wand's ranged lines as its text writes them (0.95, 0.25, 0.25, 0.75, 0.75). */
const WAND_AS_WRITTEN = [
  'Grants Skill: Level 19 Coiling Bolts',
  '82% increased Spell Damage',
  '9% increased Cast Speed',
  'Spell Hits Gain 29% of Damage as Extra Chaos Damage per Curse on target',
  'Spell Hits Gain 29% of Damage as Extra Physical Damage per Curse on target',
];

/** The ring's ranged lines at its rolls (1, 0.25, 0.9, 0.75), in either fixture. */
const RING_ROLLED = ['+13% to Chaos Resistance', '+70 to maximum Mana', '+24 to Intelligence', '35% increased Damage with Hits against targets in your Presence'];

/** The rolled lines of a list that have the shape of one of `lines` (the same text but for its numbers), in order. */
const shaped = (rolls: Roll[], lines: string[]) => {
  const shape = (l: string) => l.replace(/\d+/g, '#');
  return rolls.map((r) => r.line).filter((l) => lines.some((x) => shape(x) === shape(l)));
};

/** The `<Item>` blocks of a PoB file, in order. */
const itemBlocks = (xml: string) => [...xml.matchAll(/<Item\b[^>]*>[\s\S]*?<\/Item>/g)].map((m) => m[0]);

engineDescribe("AC-W135 (WU-153): PG-109, a saved item's rolls stay on their lines, saved and loaded (D-511)", () => {
  let engine: LuaLineClient;
  /** The rolls as the fixture's text writes them, read on its first load (it holds no `<ModRange>`). */
  let written: Rolls | undefined;

  const evalLua = async <T>(code: string): Promise<T> => {
    const reply = await engine.request('__test_eval', { code }, { timeoutMs: 120_000 });
    expect({ ok: reply.ok, error: reply.error }).toEqual({ ok: true, error: undefined });
    return reply.result as T;
  };

  const load = async (name: string, xml: string): Promise<void> => {
    const reply = await engine.request('load_build_xml', { xml, name }, { timeoutMs: 120_000 });
    expect({ name, ok: reply.ok, error: reply.error }).toEqual({ name, ok: true, error: undefined });
  };

  /** The engine's export (`export_build_xml`, every composed file's source). */
  const exportXml = async (): Promise<string> => {
    const reply = await engine.request('export_build_xml', {}, { timeoutMs: 120_000 });
    expect({ ok: reply.ok, error: reply.error }).toEqual({ ok: true, error: undefined });
    return reply.xml as string;
  };

  /** Runs `fn` with PG-109 reverted (both wraps), then applies it again. */
  const reverted = async <T>(fn: () => Promise<T>): Promise<T> => {
    expect(await evalLua<boolean>(`return require('API.Patches').revert('PG-109')`)).toBe(true);
    try {
      return await fn();
    } finally {
      await evalLua(`require('API.Patches').apply('PG-109') return true`);
    }
  };

  beforeAll(async () => {
    engine = await startLuaLineClient({ testActions: true });
  }, ENGINE_TIMEOUT);

  afterAll(async () => {
    await engine?.close();
  });

  it(
    'bootstrap applies PG-109, and the rune wand reads its rolls from its text: two rune lines, then 9% Cast Speed and 29% per curse',
    async () => {
      expect(await evalLua<string[]>(`return require('API.Patches').applied()`)).toContain('PG-109');
      expect(RUNE_WAND).not.toContain('<ModRange');
      await load('pg109-rune-wand.xml', RUNE_WAND);
      const rolls = await evalLua<Rolls>(ROLLS);
      expect(rolls.wand.filter((r) => r.kind === 'runeModLines').map((r) => r.line)).toEqual([
        '+1 to Level of all Spell Skills',
        'Bonded: Archon recovery period expires 30% faster',
      ]);
      expect(shaped(rolls.wand, WAND_AS_WRITTEN)).toEqual(WAND_AS_WRITTEN);
      expect(shaped(rolls.ring, RING_ROLLED)).toEqual(RING_ROLLED);
      written = rolls;
    },
    ENGINE_TIMEOUT,
  );

  it(
    'saved through the export, the file has no <ModRange, its text carries every roll, and the reload reads every roll as before',
    async () => {
      expect(written).toBeDefined();
      await load('pg109-rune-wand.xml', RUNE_WAND);
      const xml = await exportXml();
      expect(xml).not.toContain('<ModRange');
      const [wand, ring] = itemBlocks(xml);
      for (const line of ['{range:0.95}Grants Skill', '{range:0.25}(71-113)%', '{range:0.25}(7-13)%', '{range:0.75}Spell Hits Gain (23-31)% of Damage as Extra Chaos']) {
        expect({ line, inWand: wand.includes(line) }).toEqual({ line, inWand: true });
      }
      expect(ring).toContain('{range:0.9}+(15-25) to Intelligence');
      await load('pg109-exported.xml', xml);
      expect(await evalLua<Rolls>(ROLLS)).toEqual(written);
    },
    ENGINE_TIMEOUT,
  );

  it(
    "the export, read by PoB's own load (both wraps reverted), gives every roll as written: an unpatched PoB reads our files right on their first open",
    async () => {
      expect(written).toBeDefined();
      await load('pg109-rune-wand.xml', RUNE_WAND);
      const xml = await exportXml();
      const own = await reverted(async () => {
        await load('pg109-exported.xml', xml);
        return evalLua<Rolls>(ROLLS);
      });
      expect(own).toEqual(written);
    },
    ENGINE_TIMEOUT,
  );

  it(
    "a file holding PoB's copies and {range:} text loads the wand's rolls from the text; the ring, with no {range:} tag, loads its <ModRange> rolls",
    async () => {
      expect(written).toBeDefined();
      const [wandBlock, ringBlock] = itemBlocks(POB_COPIES);
      expect([wandBlock.match(/<ModRange/g)?.length, wandBlock.includes('{range:')]).toEqual([8, true]);
      expect([ringBlock.match(/<ModRange/g)?.length, ringBlock.includes('{range:')]).toEqual([6, false]);
      await load('pg109-pob-copies.xml', POB_COPIES);
      const rolls = await evalLua<Rolls>(ROLLS);
      expect(rolls.wand).toEqual(written!.wand);
      // The ring's rolls are its <ModRange> values (1, 0.25, 0.9, 0.75), not a bare range's 0.5 (+10%, +80, +20, 30%).
      expect(shaped(rolls.ring, RING_ROLLED)).toEqual(RING_ROLLED);
      expect(rolls.ring).toEqual(written!.ring);
    },
    ENGINE_TIMEOUT,
  );

  describe('with both wraps reverted', () => {
    /** The wand's rolls after PoB's own save and load of the rune wand. */
    let pobOwn: Roll[] | undefined;

    it(
      "reverts PG-109, saves the rune wand with PoB's own Save, loads that file with PoB's own Load, and applies the patch again",
      async () => {
        expect(written).toBeDefined();
        const { xml, rolls } = await reverted(async () => {
          await load('pg109-rune-wand.xml', RUNE_WAND);
          const own = await exportXml();
          await load('pg109-pob-saved.xml', own);
          return { xml: own, rolls: await evalLua<Rolls>(ROLLS) };
        });
        // PoB's own save writes its copies, numbered across the wand's rune lines.
        expect(itemBlocks(xml)[0]).toContain('<ModRange');
        expect(await evalLua<string[]>(`return require('API.Patches').applied()`)).toContain('PG-109');
        pobOwn = rolls.wand;
      },
      ENGINE_TIMEOUT,
    );

    it(
      "with both wraps reverted, PoB's own save and load move the wand's rolls onto other lines (if this fails, PoB no longer moves a saved item's rolls: remove PG-109's entry from pob-api/API/Patches.lua)",
      () => {
        // Unset only when the case before failed, which carries the setup error (D-509): this case asserts the bug
        // alone. On the pin the Coiling Bolts roll (0.95) lands on Cast Speed, 13%, and the per-curse lines read 27%.
        if (pobOwn === undefined || written === undefined) return;
        expect(pobOwn).not.toEqual(written.wand);
      },
    );
  });
});

engineDescribe('AC-W135 (WU-153): the tools write and read PG-109\'s files by the same rules (D-511)', () => {
  let f: SessionFixture;

  const rolls = async (): Promise<Rolls> => {
    const { value } = await f.session.run({ tool: 'test:pg109-rolls', kind: 'read' }, async (ctx) => {
      const reply = await ctx.client.request('__test_eval', { code: ROLLS });
      return reply.result as Rolls;
    });
    return value;
  };

  beforeAll(async () => {
    f = await startSessionFixture({ testActions: true, files: { 'pg109-rune-wand.xml': RUNE_WAND } });
  }, ENGINE_TIMEOUT);

  afterAll(async () => {
    await f?.close();
  });

  it(
    'lua_save_build writes a file with no <ModRange, and lua_load_build of it reads every roll as the text wrote it',
    async () => {
      expect((await f.call('lua_load_build', { build_name: 'pg109-rune-wand.xml' })).isError).toBe(false);
      const before = await rolls();
      expect(shaped(before.wand, WAND_AS_WRITTEN)).toEqual(WAND_AS_WRITTEN);
      const saved = await f.call('lua_save_build', { build_name: 'pg109-saved' });
      expect(saved.isError).toBe(false);
      const file = fs.readFileSync(path.join(f.builds, 'pg109-saved.xml'), 'utf8');
      expect(file).not.toContain('<ModRange');
      expect((await f.call('lua_load_build', { build_name: 'pg109-saved.xml' })).isError).toBe(false);
      expect(await rolls()).toEqual(before);
    },
    ENGINE_TIMEOUT,
  );

  it(
    "import_build {save_as} of a code holding PoB's copies writes none on its {range:} item, keeps the older ring's, and changes no other byte",
    async () => {
      const out = await f.call('import_build', { source: encodePobCode(POB_COPIES), save_as: 'imported/pg109' });
      expect(out.isError).toBe(false);
      const file = fs.readFileSync(path.join(f.builds, 'imported', 'pg109.xml'), 'utf8');
      const [wand, ring] = itemBlocks(file);
      expect(wand).not.toContain('<ModRange');
      expect(ring.match(/<ModRange/g)?.length).toBe(6);
      // The decoded code, less the wand's eight <ModRange> lines (the lines before the ring's <Item>).
      const lines = POB_COPIES.split('\n');
      const ringAt = lines.findIndex((l) => l.includes('<Item id="2">'));
      const expected = lines.filter((l, i) => !(i < ringAt && l.trim().startsWith('<ModRange'))).join('\n');
      expect(lines.length - expected.split('\n').length).toBe(8);
      expect(file).toBe(expected);
      // The import loaded the rolls the file now holds: the wand's from its text, the ring's from its <ModRange>.
      const loaded = await rolls();
      expect(shaped(loaded.wand, WAND_AS_WRITTEN)).toEqual(WAND_AS_WRITTEN);
      expect(shaped(loaded.ring, RING_ROLLED)).toEqual(RING_ROLLED);
    },
    ENGINE_TIMEOUT,
  );
});
