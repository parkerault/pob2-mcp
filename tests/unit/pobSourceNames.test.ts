/**
 * The server's name scan helpers for `check_model_coverage`'s `mapped but unread` flag (D-336, WU-54):
 * `modListCallLiterals` (the string literals of mod-list reads in `Data/Skills/`) and
 * `skillNameTemplates` (the templates of mod-list reads built from `activeGrantedEffect.name`).
 * Pure functions over Lua text; no engine, no files.
 */
import { describe, expect, it } from '@jest/globals';
import { modListCallLiterals, skillNameTemplates } from '../../src/engine/pobSourceNames';

describe('D-336: modListCallLiterals', () => {
  it('collects the literals of :Sum("BASE", cfg, "Name")-style reads, nested parentheses included', () => {
    const lua = [
      // Data/Skills/act_int.lua:8673's shape.
      'local strikesPerCharge = activeSkill.skillModList:Sum("BASE", activeSkill.skillCfg, "AdditionalFlickersPerPowerCharge")',
      'local a = math.ceil(skillModList:Sum("BASE", cfg, "Multiplier:BonestormStage") / output.ProjectileCount)',
      "local b = modDB:Flag(nil, 'SingleQuoted')",
      'local c = skillModList:List(skillCfg, "ExplodeMod")',
      'local d = skillModList:Tabulate("LIST", cfg, "TabulatedMod")',
      'local e = skillModList:Sum("BASE", f(cfg, "Inner"), "AfterNested")',
    ].join('\n');
    expect(modListCallLiterals(lua).sort()).toEqual(
      ['AdditionalFlickersPerPowerCharge', 'AfterNested', 'BASE', 'ExplodeMod', 'Inner', 'LIST', 'Multiplier:BonestormStage', 'SingleQuoted', 'TabulatedMod'].sort(),
    );
  });

  it('ignores other strings: NewMod (it adds a mod), plain calls, assignments, and a ")" inside a literal', () => {
    const lua = [
      'skillModList:NewMod("CalcArmourAsThoughDealing", "MORE", 100)',
      'local label = "NotARead"',
      'print("AlsoNotARead")',
      'local s = sum("BASE", cfg, "LowercaseFunction")',
      'local v = skillModList:Sum("BASE", cfg, "Paren)Inside") .. "AfterTheCall"',
    ].join('\n');
    expect(modListCallLiterals(lua).sort()).toEqual(['BASE', 'Paren)Inside'].sort());
  });
});

describe('D-336: skillNameTemplates', () => {
  it('keeps the templates of mod-list reads built from activeGrantedEffect.name, and no others', () => {
    const lua = [
      // Modules/CalcActiveSkill.lua:866-869's shape.
      'if skillModList:Sum("BASE", activeSkill.skillCfg, "Multiplier:"..activeGrantedEffect.name:gsub("%s+", "").."MaxStages") > 0 then end',
      // A NewMod built from the name adds a mod; it isn't a read (CalcActiveSkill.lua:872).
      'skillModList:NewMod("Multiplier:"..activeGrantedEffect.name:gsub("%s+", "").."Stage", "BASE", 1, "Base")',
      // A read whose name isn't built from the skill's name (CalcOffence.lua:3452's output field is no read at all).
      'local x = modDB:Sum("BASE", nil, damageType.."Chance")',
      'globalOutput[skillNameVar.."Cooldown"] = 1',
    ].join('\n');
    expect(skillNameTemplates(lua)).toEqual(['Multiplier:*MaxStages']);
  });
});
