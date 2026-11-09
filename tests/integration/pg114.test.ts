/**
 * AC-W137's engine rows (WU-154, amendment 16 §8, D-512, PG-114; engine, Lua-direct): a granted skill's quality from its
 * wand, staff or sceptre, and PG-115's check.
 *
 * PoB makes a granted skill's group with quality 0 and never gives it one (`Modules/CalcSetup.lua`:1525-1530); a group a
 * file saved keeps its saved value. The game's rule (the user, 2026-11-08): a granted skill gains base quality only on a
 * wand, a staff or a sceptre, and it is the item's own quality; a quarterstaff (PoB's Staff base with subType "Warstaff",
 * `Data/Bases/staff.lua`:162-164) passes none, and a skill another item grants has no quality of its own.
 * `pob-api/API/Patches.lua`'s PG-114 entry wraps `SkillsTabClass:ProcessSocketGroup`, which the calculation setup calls on
 * every granted group (`CalcSetup.lua`:1542), to give such a group its item's quality.
 *
 * The fixtures (`tests/fixtures/builds/pg114-*.xml`) are written from the pinned game data: a level-90 Witch holding one
 * quality 20 weapon in Weapon 1, each with its base's `Grants Skill:` implicit written out (`Data/Bases/*.lua`):
 * - `pg114-sceptre.xml`: a Shrine Sceptre, "Grants Skill: Level 20 Purity of Ice" (`Data/Bases/sceptre.lua`:65-73; the
 *   `Implicits:` line written, PG-111). Purity of Ice gives +41% Cold Resistance at level 20 and +0.4% per 1% quality
 *   (`Data/Skills/act_int.lua`:16246, :16334), so quality 20 gives 8 points more; the Witch's cold resistance stays under
 *   its cap (PoB's -50% penalty by default);
 * - `pg114-sceptre-saved.xml`: the same, with the granted group saved at quality 0, as a file saved after an import holds
 *   it (the importer starts every gem at 0, `Classes/ImportTab.lua`:990, :1053-1054; PoB then saves its own group);
 * - `pg114-wand.xml`: a rare Withered Wand, "Grants Skill: Level 20 Chaos Bolt" (`Data/Bases/wand.lua`), with the wand
 *   suffix "+2 to Level of all Spell Skills" (`Data/ModItem.lua`'s GlobalSpellGemsLevelWeapon2);
 * - `pg114-staff.xml`: an Ashen Staff, "Grants Skill: Level 20 Firebolt" (`Data/Bases/staff.lua`:5-12);
 * - `pg114-quarterstaff.xml`: a rare Long Quarterstaff with "Grants Skill: Level 20 Firebolt" written by hand: no
 *   quarterstaff base or unique in the pinned data grants a skill, so the line is the test's, to show the subtype's rule;
 * - `pg114-spear.xml`: a Hardwood Spear, whose base grants Spear Throw (`Data/Bases/spear.lua`:5-13): another base.
 *
 * PG-115 (§8): PoB applies skill level and quality modifiers (`GemProperty`) to an active skill only when it has a gem
 * (`applyGemMods`, `CalcSetup.lua`:1892-1895), so an item-only granted skill would miss them. The check runs on the
 * fixture wand: PoB gives its Chaos Bolt the wand's +2 levels and a quality modifier, because the granted gem has PoB's
 * gem data. Every `Grants Skill:` line resolves through ModParser's name lookup, built from the gems
 * (`Modules/ModParser.lua`:2170-2186), so at the pin every skill a `Grants Skill:` line grants has a gem; PG-115
 * doesn't hold for those, and `docs/build-guide/pob-gaps.md` doesn't record it. A skill PoB grants through another line
 * may have none: Bloodbarrier (`Data/Skills/other.lua`:21065, granted at `ModParser.lua`:3642 without the lookup) has
 * no gem, but it has one level and no quality stats, so no figure changes.
 */
import fs from 'fs';
import path from 'path';
import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { engineDescribe } from '../helpers/engine';
import { startLuaLineClient, type LuaLineClient } from '../helpers/luaLineClient';

const REPO = path.resolve(__dirname, '..', '..');
const FIXTURES = path.join(REPO, 'tests', 'fixtures', 'builds');
const POB = path.join(REPO, 'vendor', 'PathOfBuilding-PoE2', 'src');
const ENGINE_TIMEOUT = 180_000;

const fixture = (name: string) => fs.readFileSync(path.join(FIXTURES, name), 'utf8');

/** One copy of `from` in `xml` replaced by `to`; it fails when `from` isn't there. */
function swap(xml: string, from: string, to: string): string {
  expect(xml).toContain(from);
  return xml.replace(from, to);
}

interface Measure {
  /** Each socket group: its source (PoB's own granted group has one), its source item's base, its first gem. */
  groups: Array<{ source: string | false; base: string | false; gem: string | false; quality: number | false }>;
  /** Each active skill as PoB calculated it: its name, level and quality, and whether an item grants it. */
  skills: Array<{ name: string; level: number; quality: number; fromItem: boolean }>;
  cold: number;
  coldTotal: number;
  /** PoB's cold resistance over its cap, 0 when under it. */
  coldOverCap: number;
}

/** PoB's groups and active skills after a calculation, with its cold resistance. */
const MEASURE = `
  local out = require('API.BuildOps').get_main_output()
  local groups = {}
  for _, g in ipairs(build.skillsTab.socketGroupList) do
    local gem = g.gemList[1]
    local base = g.sourceItem and g.sourceItem.base
    groups[#groups + 1] = { source = g.source or false,
      base = base and (base.type .. (base.subType and ('/' .. base.subType) or '')) or false,
      gem = gem and gem.nameSpec or false, quality = gem and gem.quality or false }
  end
  local skills = {}
  for _, s in ipairs(build.calcsTab.mainEnv.player.activeSkillList) do
    local e = s.activeEffect
    skills[#skills + 1] = { name = e.grantedEffect.name, level = e.level, quality = e.quality,
      fromItem = e.srcInstance ~= nil and e.srcInstance.fromItem == true }
  end
  return { groups = groups, skills = skills, cold = out.ColdResist, coldTotal = out.ColdResistTotal,
    coldOverCap = out.ColdResistOverCap }`;

engineDescribe("AC-W137 (WU-154): a granted skill's quality from its wand, staff or sceptre (D-512, PG-114)", () => {
  let engine: LuaLineClient;

  const evalLua = async <T>(code: string): Promise<T> => {
    const reply = await engine.request('__test_eval', { code }, { timeoutMs: 120_000 });
    expect({ ok: reply.ok, error: reply.error }).toEqual({ ok: true, error: undefined });
    return reply.result as T;
  };

  const measure = async (name: string, xml: string = fixture(name)): Promise<Measure> => {
    const reply = await engine.request('load_build_xml', { xml, name }, { timeoutMs: 120_000 });
    expect({ name, ok: reply.ok, error: reply.error }).toEqual({ name, ok: true, error: undefined });
    return evalLua<Measure>(MEASURE);
  };

  /** The one granted group and the one active skill of a fixture holding one granting weapon. */
  const granted = (m: Measure) => {
    expect(m.groups.filter((g) => g.source)).toHaveLength(1);
    expect(m.skills.filter((s) => s.fromItem)).toHaveLength(1);
    return { group: m.groups.find((g) => g.source)!, skill: m.skills.find((s) => s.fromItem)! };
  };

  beforeAll(async () => {
    engine = await startLuaLineClient({ testActions: true });
  }, ENGINE_TIMEOUT);

  afterAll(async () => {
    await engine?.close();
  });

  it('the data: Purity of Ice gives +0.4% to its cold resistance per 1% quality (self-check of the fixture\'s 8 points)', async () => {
    const skills = fs.readFileSync(path.join(POB, 'Data', 'Skills', 'act_int.lua'), 'utf8');
    const block = skills.slice(skills.indexOf('skills["PurityOfIcePlayer"] = {'));
    expect(/qualityStats = \{\s*\{ "base_skill_buff_cold_damage_resistance_%_to_apply", ([\d.]+),/.exec(block)![1]).toBe('0.4');
    expect(await evalLua<string[]>(`return require('API.Patches').applied()`)).toContain('PG-114');
  });

  it('a quality 20 Shrine Sceptre: its Purity of Ice measures at quality 20, its cold resistance (under its cap) 8 points over the same sceptre at quality 0', async () => {
    const q20 = await measure('pg114-sceptre.xml');
    const at20 = granted(q20);
    expect(at20.group).toEqual({ source: 'Item:1:Shrine Sceptre', base: 'Sceptre', gem: 'Purity of Ice', quality: 20 });
    expect(at20.skill).toEqual({ name: 'Purity of Ice', level: 20, quality: 20, fromItem: true });
    expect({ cold: q20.cold, overCap: q20.coldOverCap }).toEqual({ cold: q20.coldTotal, overCap: 0 });

    const q0 = await measure('pg114-sceptre-q0.xml', swap(fixture('pg114-sceptre.xml'), 'Quality: 20', 'Quality: 0'));
    expect(granted(q0).skill).toEqual({ name: 'Purity of Ice', level: 20, quality: 0, fromItem: true });
    expect(q20.cold - q0.cold).toBe(8);
  }, ENGINE_TIMEOUT);

  it("the granted group saved at quality 0 (an import's shape) and at 5: the item's 20 wins, and the resistance is the same", async () => {
    const plain = await measure('pg114-sceptre.xml');
    const saved0 = await measure('pg114-sceptre-saved.xml');
    const saved5 = await measure('pg114-sceptre-saved5.xml', swap(fixture('pg114-sceptre-saved.xml'), 'quality="0"', 'quality="5"'));
    for (const m of [saved0, saved5]) {
      expect(granted(m).group).toEqual({ source: 'Item:1:Shrine Sceptre', base: 'Sceptre', gem: 'Purity of Ice', quality: 20 });
      expect(granted(m).skill.quality).toBe(20);
      expect(m.cold).toBe(plain.cold);
    }
  }, ENGINE_TIMEOUT);

  it("a quality 20 wand's granted skill measures at quality 20, and a quality 20 staff's (not a quarterstaff) too", async () => {
    const wand = granted(await measure('pg114-wand.xml'));
    expect(wand.group).toEqual({ source: 'Item:1:Grim Twig, Withered Wand', base: 'Wand', gem: 'Chaos Bolt', quality: 20 });
    expect(wand.skill.quality).toBe(20);
    const staff = granted(await measure('pg114-staff.xml'));
    expect(staff.group).toEqual({ source: 'Item:1:Ashen Staff', base: 'Staff', gem: 'Firebolt', quality: 20 });
    expect(staff.skill.quality).toBe(20);
  }, ENGINE_TIMEOUT);

  it("a quality 20 quarterstaff passes none: its granted skill keeps PoB's 0; so does another base's (a quality 20 spear's Spear Throw)", async () => {
    const quarterstaff = granted(await measure('pg114-quarterstaff.xml'));
    expect(quarterstaff.group).toEqual({ source: 'Item:1:Storm Pole, Long Quarterstaff', base: 'Staff/Warstaff', gem: 'Firebolt', quality: 0 });
    expect(quarterstaff.skill.quality).toBe(0);
    const spear = granted(await measure('pg114-spear.xml'));
    expect(spear.group).toEqual({ source: 'Item:1:Hardwood Spear', base: 'Spear', gem: 'Spear Throw', quality: 0 });
    expect(spear.skill.quality).toBe(0);
  }, ENGINE_TIMEOUT);

  describe("PG-115's check on the fixture wand (§8)", () => {
    it("PoB gives the wand's granted Chaos Bolt the wand's +2 to Level of all Spell Skills and a quality modifier on top of the item's quality: PG-115 doesn't hold at the pin", async () => {
      const plain = granted(await measure('pg114-wand.xml'));
      expect(plain.skill).toEqual({ name: 'Chaos Bolt', level: 22, quality: 20, fromItem: true });
      // A quality modifier, "+5% to Quality of all Skills" (Data/ModCache.lua's GemProperty line), as a custom modifier.
      const withQuality = swap(
        fixture('pg114-wand.xml'),
        '<ConfigSet id="1" title="Default"/>',
        '<ConfigSet id="1" title="Default">\n\t\t\t<Input name="customMods" string="+5% to Quality of all Skills"/>\n\t\t</ConfigSet>',
      );
      expect(granted(await measure('pg114-wand-quality.xml', withQuality)).skill).toEqual({ name: 'Chaos Bolt', level: 22, quality: 25, fromItem: true });
      // Why: the granted gem has PoB's gem data, which applyGemMods needs (CalcSetup.lua:1892-1895).
      expect(
        await evalLua<boolean>(`
          for _, g in ipairs(build.skillsTab.socketGroupList) do
            if g.source then return g.gemList[1].gemData ~= nil end
          end
          return false`),
      ).toBe(true);
    }, ENGINE_TIMEOUT);
  });

  describe('with the wrap reverted', () => {
    let pobOwn: number | undefined;

    it("reverts PG-114, reads PoB's own quality of the quality 20 sceptre's Purity, and applies the patch again", async () => {
      expect(await evalLua<string[]>(`return require('API.Patches').applied()`)).toContain('PG-114');
      try {
        expect(await evalLua<boolean>(`return require('API.Patches').revert('PG-114')`)).toBe(true);
        pobOwn = granted(await measure('pg114-sceptre.xml')).skill.quality;
      } finally {
        await evalLua(`require('API.Patches').apply('PG-114') return true`);
      }
      expect(await evalLua<string[]>(`return require('API.Patches').applied()`)).toContain('PG-114');
      expect(granted(await measure('pg114-sceptre.xml')).skill.quality).toBe(20);
    }, ENGINE_TIMEOUT);

    it(
      "with the wrap reverted, PoB's own quality of the quality 20 Shrine Sceptre's Purity of Ice is 0 (if this fails, PoB gives a granted skill its item's quality: remove PG-114's entry from pob-api/API/Patches.lua)",
      () => {
        // Unset only when the case before failed, which carries the setup error (D-509): this case asserts the bug alone.
        if (pobOwn === undefined) return;
        expect(pobOwn).toBe(0);
      },
    );
  });
});
