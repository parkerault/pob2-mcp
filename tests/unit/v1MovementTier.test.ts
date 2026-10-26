/**
 * WU-111 (amendment 11 §8, D-440; AC-P81's boots bullets): V1's `movement-tier` and `boots-exception` over hand-made
 * stage inputs. The engine bullets (PoB's parse of the boots, the record's travel skill) are
 * `tests/integration/compileMovementTier.test.ts`.
 *
 * - The tiers are the game data's (`vendor/…/Data/ModItem.lua`:450–455, boots only): 10% (item level 1), 15% (16), 20%
 *   (33), 25% (46), 30% (65), 35% (82), read here from the pinned file, as `compile_check` reads them from PoB.
 * - Entering maps needs 30%, budget and non-budget 35%; a campaign stage the highest tier its area level allows.
 * - `movement-tier` fires on `b` and `n` boots with 30% and not with 35%; on `m` boots with 25% and not with 30%; on a
 *   campaign stage of area level 50 with 20% and not with 25%; never on a stage without boots or on a schema-6 plan.
 * - With `bootsException {kind: "travel"}` and a travel skill the finding is `boots-exception` (information, a V1 note,
 *   so V1 passes); with `kind: "travel"` and no travel skill it stays `movement-tier`; with `kind: "unique"` and unique
 *   boots it is `boots-exception`.
 */
import fs from 'fs';
import path from 'path';
import { describe, expect, it } from '@jest/globals';
import { checkV1, RUNG_MOVEMENT_TIER } from '../../src/plan/checks/v1';
import { loadReferenceData, type PlanReferenceData } from '../../src/plan/referenceData';
import { validatePlan, type Stage } from '../../src/plan/schema';
import type { MovementTier, StageChecks } from '../../src/engine/schemas';
import type { TravelMeasure } from '../../src/plan/record';

type Json = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
const REPO = path.resolve(__dirname, '..', '..');
const ref = loadReferenceData(path.join(REPO, 'data'));
const TWO_STAGE = path.join(REPO, 'tests', 'fixtures', 'plans', 'two-stage', 'plan.json');
const MOD_ITEM = path.join(REPO, 'vendor', 'PathOfBuilding-PoE2', 'src', 'Data', 'ModItem.lua');
const judgment = (r: string) => ({ kind: 'judgment', ref: r, confidence: 'L' });

/** The boots' movement-speed tiers in the pinned game data: `MovementVelocity<n>` lines that boots roll. */
function pinnedTiers(): MovementTier[] {
  const out: MovementTier[] = [];
  for (const line of fs.readFileSync(MOD_ITEM, 'utf8').split('\n')) {
    const m = /^\s*\["MovementVelocity\d+"\] = \{.*?"(\d+)% increased Movement Speed".*?level = (\d+), group = "MovementVelocity", weightKey = \{ "boots"/.exec(line);
    if (m) out.push({ value: Number(m[1]), itemLevel: Number(m[2]) });
  }
  return out.sort((a, b) => a.itemLevel - b.itemLevel);
}
const TIERS = pinnedTiers();

/** A stage of the two-stage fixture's content at schema `version`: a rung, a card skeleton, or a campaign stage. */
function stageOf(kind: 'entering-maps' | 'budget' | 'non-budget' | 'skeleton' | 'campaign', version = 7, progress?: string): Stage {
  const p = JSON.parse(fs.readFileSync(TWO_STAGE, 'utf8')) as Json;
  p.schemaVersion = version;
  const s = p.stages[1];
  if (kind === 'campaign') {
    s.progress = progress ?? 'q.act-4-isle-of-kin-blind-beast';
  } else {
    Object.assign(s, { progress: 'endgame', loadoutName: 'Endgame (L14) {2}' });
    if (kind !== 'skeleton') Object.assign(s, { variant: kind, ascendancyPoints: 0, variantBasis: { level: judgment('t'), gemLevels: judgment('t'), ascendancyPoints: judgment('t') } });
  }
  s.claims = [];
  p.stages = [s];
  p.ledger = [];
  const r = validatePlan(p, ref);
  if (!r.ok) throw new Error(JSON.stringify(r.errors));
  return r.plan.stages[0];
}

/** V1's inputs with boots of `speed`% movement speed (PoB's parse) and `rarity`, or no boots. */
function checksWith(boots: { speed: number; rarity?: string } | null): StageChecks {
  return {
    counts: { used: 0, ascendancy: 0, secondaryAscendancy: 0, sockets: 0, weaponSet1: 0, weaponSet2: 0 },
    extraPoints: 0,
    passivePointsToWeaponSetPoints: 0,
    attributes: { Str: 50, Dex: 50, Int: 50, ReqStr: 0, ReqDex: 0, ReqInt: 0 },
    requirementSources: {},
    gems: [],
    items:
      boots === null
        ? []
        : [{ slot: 'Boots', name: 'Test Stride', baseName: 'Rough Greaves', levelRequirement: 0, rarity: boots.rarity ?? 'RARE', movementSpeed: boots.speed }],
    warnings: [],
    nodeNames: [],
    activeSkills: [],
    config: { input: {}, placeholder: {} },
    shownOptions: [],
    grantedSkills: [],
  } as StageChecks;
}

const LEAP: TravelMeasure = { group: 3, skill: 'Leap Slam', usesPerSecond: 1.3 };

/** V1's boots codes for a stage: findings and notes with their codes. */
function bootsCodes(stage: Stage, checks: StageChecks, opts: { version?: number; travel?: TravelMeasure | null; refData?: PlanReferenceData } = {}) {
  const v1 = checkV1({ stage, predecessor: null, checks, ref: opts.refData ?? ref, schemaVersion: opts.version ?? 7, movementTiers: TIERS, travel: opts.travel ?? null });
  const codes = ['movement-tier', 'boots-exception'];
  return {
    findings: v1.verdict.findings.filter((f) => codes.includes(f.code)),
    notes: v1.verdict.notes.filter((f) => codes.includes(f.code)),
    pass: v1.verdict.pass,
    all: v1.verdict.findings.map((f) => f.code),
  };
}
const findingCodes = (r: ReturnType<typeof bootsCodes>) => r.findings.map((f) => f.code);

describe('WU-111 (D-440): the tiers', () => {
  it("are the pinned game data's six boots tiers, and the rungs' tiers are the user's 30% and 35%", () => {
    expect(TIERS).toEqual([
      { value: 10, itemLevel: 1 },
      { value: 15, itemLevel: 16 },
      { value: 20, itemLevel: 33 },
      { value: 25, itemLevel: 46 },
      { value: 30, itemLevel: 65 },
      { value: 35, itemLevel: 82 },
    ]);
    expect(RUNG_MOVEMENT_TIER).toEqual({ 'entering-maps': 30, budget: 35, 'non-budget': 35 });
  });
});

describe('WU-111 (D-440): movement-tier', () => {
  it('AC-P81: fires on budget and non-budget boots with 30% and not with 35%', () => {
    for (const rung of ['budget', 'non-budget'] as const) {
      const at30 = bootsCodes(stageOf(rung), checksWith({ speed: 30 }));
      expect({ rung, codes: findingCodes(at30) }).toEqual({ rung, codes: ['movement-tier'] });
      expect(at30.findings[0].message).toBe(
        `the boots (Test Stride) carry 30% increased movement speed, under the 35% tier for the ${rung} rung (D-440: the highest tier for the level, a corruption's extra never required)`,
      );
      expect(at30.findings[0].data).toEqual({ slot: 'Boots', name: 'Test Stride', movementSpeed: 30, tier: 35, path: 'items.slots[2].text' });
      expect({ rung, codes: findingCodes(bootsCodes(stageOf(rung), checksWith({ speed: 35 }))) }).toEqual({ rung, codes: [] });
    }
  });

  it('AC-P81: fires on entering-maps boots with 25% and not with 30%', () => {
    expect(findingCodes(bootsCodes(stageOf('entering-maps'), checksWith({ speed: 25 })))).toEqual(['movement-tier']);
    expect(findingCodes(bootsCodes(stageOf('entering-maps'), checksWith({ speed: 30 })))).toEqual([]);
  });

  it('AC-P81: fires on a campaign stage of area level 50 with 20% and not with 25%', () => {
    // C1 has no progress key at area level 50 (its nearest are 44 and 51), so a key's area level is set to 50 here; the
    // engine test compiles the real key at area level 51, the same tier (25% needs item level 46, 30% needs 65).
    const key = 'q.act-4-isle-of-kin-blind-beast';
    const at50: PlanReferenceData = Object.assign(Object.create(Object.getPrototypeOf(ref)), ref, {
      resolveFact: (file: string, fact: string) => {
        const found = ref.resolveFact(file, fact);
        return file === 'campaign/progress.json' && fact === `${key}.area-level` && found.ok ? { ok: true, fact: { ...found.fact, value: 50 } } : found;
      },
    });
    const stage = stageOf('campaign', 7, key);
    const r20 = bootsCodes(stage, checksWith({ speed: 20 }), { refData: at50 });
    expect(findingCodes(r20)).toEqual(['movement-tier']);
    expect(r20.findings[0].message).toContain(`under the 25% tier for area level 50 (${key})`);
    expect(findingCodes(bootsCodes(stage, checksWith({ speed: 25 }), { refData: at50 }))).toEqual([]);
    // The real data: area level 51, the same tier.
    expect(findingCodes(bootsCodes(stage, checksWith({ speed: 20 })))).toEqual(['movement-tier']);
    expect(findingCodes(bootsCodes(stage, checksWith({ speed: 25 })))).toEqual([]);
  });

  it('AC-P81: never on a stage without boots, nor on a schema-6 plan; a card skeleton has no rung to hold it to', () => {
    expect(findingCodes(bootsCodes(stageOf('budget'), checksWith(null)))).toEqual([]);
    const six = bootsCodes(stageOf('budget', 6), checksWith({ speed: 0 }), { version: 6 });
    expect([findingCodes(six), six.notes]).toEqual([[], []]);
    expect(findingCodes(bootsCodes(stageOf('skeleton'), checksWith({ speed: 0 })))).toEqual([]);
  });
});

describe('WU-111 (D-440): boots-exception', () => {
  const withException = (kind: 'travel' | 'unique'): Stage => {
    const stage = stageOf('budget');
    return { ...stage, items: { ...stage.items, bootsException: { kind, reason: kind === 'travel' ? 'Leap Slam moves the build; the slot takes life' : 'the unique ignites the ground the build stands on' } } };
  };

  it('AC-P81: with kind "travel" and a travel skill, it is boots-exception, information only (a note, V1 passes)', () => {
    const r = bootsCodes(withException('travel'), checksWith({ speed: 20 }), { travel: LEAP });
    expect(findingCodes(r)).toEqual([]);
    expect(r.notes.map((n) => n.code)).toEqual(['boots-exception']);
    expect(r.notes[0].message).toContain('the stage moves with its travel skill, Leap Slam');
    expect(r.notes[0].data).toMatchObject({ tier: 35, movementSpeed: 20, exception: 'travel' });
    // A note never fails V1 (A-29): the verdict passes or fails on the stage's other findings alone.
    expect(r.all).not.toContain('boots-exception');
    expect(r.pass).toBe(r.all.length === 0);
  });

  it('AC-P81: with kind "travel" and no travel skill, it stays movement-tier', () => {
    const r = bootsCodes(withException('travel'), checksWith({ speed: 20 }), { travel: null });
    expect(findingCodes(r)).toEqual(['movement-tier']);
    expect(r.findings[0].message).toMatch(/its bootsException \(travel\) needs a travel skill in the stage, and the stage has none$/);
    expect(r.notes).toEqual([]);
  });

  it('AC-P81: with kind "unique" and unique boots, it is boots-exception; with rare boots it stays movement-tier', () => {
    const unique = bootsCodes(withException('unique'), checksWith({ speed: 20, rarity: 'UNIQUE' }));
    expect([findingCodes(unique), unique.notes.map((n) => n.code)]).toEqual([[], ['boots-exception']]);
    const rare = bootsCodes(withException('unique'), checksWith({ speed: 20, rarity: 'RARE' }));
    expect(findingCodes(rare)).toEqual(['movement-tier']);
    expect(rare.findings[0].message).toMatch(/its bootsException \(unique\) needs unique boots, and Test Stride aren't unique$/);
  });

  it('boots at their tier need no exception: nothing is reported with one stated', () => {
    const r = bootsCodes(withException('unique'), checksWith({ speed: 35, rarity: 'RARE' }));
    expect([r.findings, r.notes]).toEqual([[], []]);
  });
});
