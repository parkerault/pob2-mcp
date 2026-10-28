/**
 * WU-119 fix round (amendment 12 §6, D-451; AC-P82: "a custom damage line never is"): the stats behind V1's
 * `custom-defence`, `DEFENCE_MODS`, held against PoB's modifier parser at the pin (`vendor/…/Modules/ModParser.lua`).
 *
 * - ModParser's whole name list: every name a `mod("<Name>", …)` or `flag("<Name>", …)` call writes, every name of its
 *   `modNameList`, and the two names it builds from a damage type (`"ArmourAppliesTo"..<Type>.."DamageTaken"`,
 *   `"Totem"..<Type>.."Resist"`) for the five types.
 * - Each `DEFENCE_MODS` name is one of ModParser's, once. Each ModParser name holding a pool or defence word (life, mana,
 *   energy shield, ward, armour, evasion, evade, deflect, block, resist, damage taken or reduction, defences, before you,
 *   bypass) is in `DEFENCE_MODS` or in `LEFT_OUT` below, with why: so a pin upgrade's new names are sorted one way or the
 *   other, and the list is an explicit one rather than a word match.
 * - The verifier's lines: "Your hits can't be evaded" (`CannotBeEvaded`), "Hits ignore enemy Fire Resistance"
 *   (`IgnoreFireResistance`) and "Critical Hits ignore Enemy Monster Elemental Resistances" (`IgnoreElementalResistances`) are
 *   damage, never a defence; "10% reduced Physical Damage from Hits taken" (`PhysicalDamageFromHitsTaken`) and every
 *   `<Type>DamageFromHitsTaken` are damage taken. The engine rows are `tests/integration/compileSchema8.test.ts`.
 */
import fs from 'fs';
import path from 'path';
import { describe, expect, it } from '@jest/globals';
import { DEFENCE_MODS, isDefenceMod } from '../../src/plan/checks/v1';

const MOD_PARSER = path.resolve(__dirname, '..', '..', 'vendor', 'PathOfBuilding-PoE2', 'src', 'Modules', 'ModParser.lua');
const DAMAGE_TYPES = ['Physical', 'Fire', 'Cold', 'Lightning', 'Chaos'];

/** Every modifier name ModParser writes (see the header). */
function modParserNames(): Set<string> {
  const text = fs.readFileSync(MOD_PARSER, 'utf8');
  const names = new Set<string>();
  for (const m of text.matchAll(/\b(?:mod|flag)\(\s*"([A-Za-z0-9_:]+)"\s*[,)]/g)) names.add(m[1]);
  const start = text.indexOf('local modNameList = {');
  if (start < 0) throw new Error('ModParser has no modNameList');
  const block = text.slice(start, text.indexOf('\n}\n', start));
  for (const m of block.matchAll(/\]\s*=\s*"([A-Za-z0-9_:]+)"/g)) names.add(m[1]);
  for (const m of block.matchAll(/\]\s*=\s*\{([^}]*)\}/g)) for (const n of m[1].matchAll(/"([A-Za-z0-9_:]+)"/g)) names.add(n[1]);
  for (const [prefix, suffix] of [
    ['ArmourAppliesTo', 'DamageTaken'],
    ['Totem', 'Resist'],
  ]) {
    if (!text.includes(`mod("${prefix}"..firstToUpper(`) || !text.includes(`).."${suffix}"`)) throw new Error(`ModParser no longer builds ${prefix}<Type>${suffix}`);
    for (const t of DAMAGE_TYPES) names.add(`${prefix}${t}${suffix}`);
  }
  return names;
}

/** A ModParser name holding a pool or defence word. */
const DEFENCE_WORD = /Life|Mana|EnergyShield|Ward|Armour|Evasion|Evade|Deflect|Block|Resist|Taken|DamageReduction|Defences|BeforeYou|Bypass/;

/** The ModParser names holding a pool or defence word that aren't the player's pools or defences, by why. */
const LEFT_OUT: Readonly<Record<string, readonly string[]>> = {
  // the enemy's side and offence: ignoring, breaking or lowering the enemy's defences
  enemy: ['ArmourBreakColdDamageTaken', 'ArmourBreakFireDamageTaken', 'ArmourBreakLightningDamageTaken',
    'ArmourBreakPerHit', 'CannotBeEvaded', 'ChanceToIgnoreEnemyArmour', 'ChanceToIgnoreEnemyPhysicalDamageReduction',
    'ChillEffectIncDamageTaken', 'Condition:CanArmourBreak', 'Condition:CanArmourBreakBelowZero',
    'Condition:ShieldThrowCrushNoArmourEvasion', 'ElementalDamageUsesLowestResistance',
    'EnemyImpalePhysicalDamageReduction', 'EnemyPhysicalDamageReduction', 'FullyBrokenArmourEffect',
    'FullyBrokenArmourIncreasesAllDamageFromHits', 'IgnoreColdResistance', 'IgnoreElementalResistances',
    'IgnoreEnemyArmour', 'IgnoreEnemyImpalePhysicalDamageReduction', 'IgnoreEnemyPhysicalDamageReduction',
    'IgnoreFireResistance', 'IgnoreLightningResistance', 'PartialIgnoreEnemyPhysicalDamageReduction',
    'reduceEnemyBlock'],
  // a totem's, a corpse's or an ice crystal's
  others: ['CorpseLife', 'IceCrystalLife', 'TotemChaosResist', 'TotemColdResist', 'TotemElementalResist',
    'TotemElementalResistMax', 'TotemFireResist', 'TotemLife', 'TotemLightningResist', 'TotemPhysicalResist'],
  // costs and reservation
  cost: ['BaseManaCostAsLifeCost', 'CostLifeInsteadOfMana', 'ExtraLifeReserved', 'GrantReservedLifeAsAura',
    'GrantReservedManaAsAura', 'HybridManaAndLifeCost_Life', 'LifeCost', 'LifeCostBase', 'LifeCostEfficiency',
    'LifeReservationEfficiency', 'LifeReservationPercent', 'ManaCost', 'ManaCostAsEnergyShieldCost', 'ManaCostBase',
    'ManaCostEfficiency', 'ManaReservationEfficiency', 'ManaReserved'],
  // stun
  stun: ['BlockRecovery', 'StunThresholdBasedOnEnergyShieldInsteadOfLife', 'StunThresholdBasedOnManaInsteadOfLife',
    'StunThresholdEnergyShieldPercent', 'StunThresholdManaPercent'],
  // an item's data, a state, mana's effect on shock
  internals: ['AlternateQualityArmour', 'ArmourData', 'Condition:FullLife', 'Condition:HaveManaStorm',
    'Condition:LowLife', 'ImprovedManaAppliesToShockEffect', 'ManaAppliesToShockEffect'],
  // sustain: regeneration, leech, recoup, recharge, recovery, gain on an event, flasks
  sustain: ['4SecondLifeRecoup', 'ArcaneSurgeLifeRegen', 'ArmourAppliesToEnergyShieldRecharge', 'ArmourESRecoveryCap',
    'CanLeechEnergyShieldOnFullEnergyShield', 'CanLeechLifeOnFullLife', 'CannotGainEnergyShield', 'CannotGainLife',
    'CannotGainMana', 'CannotLeechLife', 'CannotLeechMana', 'CannotRecoverLifeOutsideLeech', 'ChaosLifeRecoup',
    'ColdEnergyShieldRecoup', 'ColdLifeRecoup', 'Condition:NoEnergyShieldLeechFromPhysicalDamage',
    'Condition:NoInherentManaRegen', 'Condition:NoLifeLeechFromPhysicalDamage',
    'Condition:NoManaLeechFromPhysicalDamage', 'DamageLifeLeech', 'DamageLifeLeechToPlayer', 'EnergyShieldLeechRate',
    'EnergyShieldOnBlock', 'EnergyShieldOnHit', 'EnergyShieldOnKill', 'EnergyShieldOnSpellBlock',
    'EnergyShieldOnSuppress', 'EnergyShieldRecharge', 'EnergyShieldRechargeAppliesToLife', 'EnergyShieldRechargeBase',
    'EnergyShieldRechargeFaster', 'EnergyShieldRecoup', 'EnergyShieldRecoveryRate', 'EnergyShieldRegen',
    'EnergyShieldRegenPercent', 'EvasionESRecoveryCap', 'FireEnergyShieldRecoup', 'FireLifeRecoup',
    'FlaskAdditionalLifeRecovery', 'FlaskLifeRecovery', 'FlaskLifeRecoveryLowLife', 'FlaskLifeRecoveryRate',
    'FlaskManaRecovery', 'FlaskManaRecoveryRate', 'ImprovedArmourAppliesToEnergyShieldRecharge',
    'InstantEnergyShieldLeech', 'InstantLifeLeech', 'InstantManaLeech', 'LifeDegen', 'LifeFlaskAppliesToEnergyShield',
    'LifeFlaskChargesGained', 'LifeFlaskChargesGenerated', 'LifeFlaskChargesUsed', 'LifeFlaskDoesNotApply',
    'LifeFlaskEffectNotRemoved', 'LifeFlaskInstantRecovery', 'LifeLeechBasedOnChaosDamage', 'LifeLeechRate',
    'LifeOnBlock', 'LifeOnHit', 'LifeOnKill', 'LifeOnSuppress', 'LifeRecoup', 'LifeRecovery', 'LifeRecoveryRate',
    'LifeRegen', 'LifeRegenPercent', 'LifeRegenerationRecoversEnergyShield', 'LightningEnergyShieldRecoup',
    'LightningLifeRecoup', 'ManaDegenPercent', 'ManaFlaskAppliesToLife', 'ManaFlaskChargesGained',
    'ManaFlaskChargesGenerated', 'ManaFlaskChargesUsed', 'ManaFlaskEffectNotRemoved', 'ManaFlaskInstantRecovery',
    'ManaLeechBasedOnChaosDamage', 'ManaLeechBasedOnElementalDamage', 'ManaLeechRate', 'ManaLeechRecoversEnergyShield',
    'ManaOnBlock', 'ManaOnHit', 'ManaOnKill', 'ManaRecoup', 'ManaRecoveryRate', 'ManaRegen',
    'ManaRegenAppliesToEnergyShieldRecharge', 'ManaRegenAppliesToRageRegen', 'ManaRegenToRageRegen',
    'MaxEnergyShieldLeechInstance', 'MaxEnergyShieldLeechRate', 'MaxLifeLeechInstance', 'MaxLifeLeechRate',
    'MaxManaLeechInstance', 'MaxManaLeechRate', 'NoEnergyShieldRecharge', 'NoEnergyShieldRegen', 'NoLifeRegen',
    'NoManaRegen', 'PhysicalDamageMitigatedEnergyShieldPseudoRecoup', 'PhysicalDamageMitigatedLifePseudoRecoup',
    'PhysicalDamageMitigatedLifePseudoRecoupDuration', 'PhysicalLifeRecoup', 'WardRechargeFaster'],
};

describe("WU-119: custom-defence's stats are PoB's pool and defence names (D-451)", () => {
  const names = modParserNames();
  const defence = Object.values(DEFENCE_MODS).flat();
  const leftOut = Object.values(LEFT_OUT).flat();

  it('the name list is ModParser\'s whole list (self-check)', () => {
    for (const n of ['Life', 'EnergyShield', 'PhysicalDamageFromHitsTaken', 'ArmourAppliesToChaosDamageTaken', 'IgnoreFireResistance', 'CannotBeEvaded']) {
      expect({ n, found: names.has(n) }).toEqual({ n, found: true });
    }
    expect(names.size).toBeGreaterThan(1000);
  });

  it('each DEFENCE_MODS name is one of ModParser\'s, once', () => {
    expect(defence.filter((n) => !names.has(n))).toEqual([]);
    expect(defence.filter((n, i) => defence.indexOf(n) !== i)).toEqual([]);
  });

  it('each ModParser name holding a pool or defence word is in DEFENCE_MODS or left out, not both', () => {
    const worded = [...names].filter((n) => DEFENCE_WORD.test(n)).sort();
    expect(worded.filter((n) => !defence.includes(n) && !leftOut.includes(n))).toEqual([]);
    expect(leftOut.filter((n) => defence.includes(n) || !names.has(n))).toEqual([]);
    // The sorting covers the whole list: every DEFENCE_MODS name holds one of the words too.
    expect(defence.filter((n) => !DEFENCE_WORD.test(n))).toEqual([]);
  });

  it('AC-P82: the damage lines\' names are never a defence; every damage-from-hits-taken name is', () => {
    const damage = [
      'CannotBeEvaded', 'IgnoreFireResistance', 'IgnoreElementalResistances', 'IgnoreEnemyArmour', 'IgnoreEnemyPhysicalDamageReduction',
      'FullyBrokenArmourIncreasesAllDamageFromHits', 'ElementalDamageUsesLowestResistance', 'ChillEffectIncDamageTaken', 'Damage', 'PhysicalDamage',
    ];
    expect(damage.filter(isDefenceMod)).toEqual([]);
    const fromHits = [...names].filter((n) => /DamageFromHitsTaken/.test(n)).sort();
    expect(fromHits.length).toBeGreaterThanOrEqual(6);
    expect(fromHits.filter((n) => !isDefenceMod(n))).toEqual([]);
  });
});
