/**
 * WU-154 (amendment 16 §8 and Appendix A.5, D-512; AC-W137's schema rows): plan schema 11 in M-29, through
 * `validatePlan` and the compiler's `compile_check` input (`checkStageOf`). The refusal itself runs in the engine
 * (`pob-api/API/Compile.lua`'s check_granted_quality) and is tested through `compile_plan` in
 * `tests/integration/compileGrantedQuality.test.ts`.
 *
 * M-29's schema 11 adds no field (M-30 adds the read fields and `switch`): a schema-10 plan validates at 11 as written.
 * What changes is `compile_check`'s input: from schema 11 each gem carries its quality, which `compile_check` refuses
 * above 0 on a skill the stage's items or allocated passives grant; an older plan's gems go without it, so it is never
 * refused for it (§26).
 */
import fs from 'fs';
import path from 'path';
import { describe, expect, it } from '@jest/globals';
import { checkStageOf } from '../../src/plan/compiler';
import { loadReferenceData } from '../../src/plan/referenceData';
import { GRANTED_QUALITY_SINCE, PLAN_SCHEMA_VERSIONS, validatePlan, type Stage } from '../../src/plan/schema';

type Json = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
const REPO = path.resolve(__dirname, '..', '..');
const ref = loadReferenceData(path.join(REPO, 'data'));
const LICH = path.join(REPO, 'tests', 'fixtures', 'plans', 'm27-wu137', 'lich', 'plan.json');
const read = (file: string): Json => JSON.parse(fs.readFileSync(file, 'utf8')) as Json;

/** The Lich plan at `version`, its stage holding a quality 20 Shrine Sceptre and a Purity of Ice copy at `quality`. */
function plan(version: number, quality: number): Json {
  const p = read(LICH);
  p.schemaVersion = version;
  const s = p.stages[0];
  s.items.slots.push({ slot: 'Weapon 1', text: 'Rarity: Normal\nShrine Sceptre\nQuality: 20\nImplicits: 1\nGrants Skill: Level 20 Purity of Ice' });
  s.skills.groups.push({ label: 'Purity of Ice', enabled: true, role: 'utility', gems: [{ name: 'Purity of Ice', level: 20, quality, enabled: true }] });
  return p;
}

const stageOf = (version: number, quality: number): Stage => {
  const r = validatePlan(plan(version, quality), ref);
  if (!r.ok) throw new Error(`the fixture plan doesn't validate: ${JSON.stringify(r.errors)}`);
  return r.plan.stages[0];
};

describe('WU-154: plan schema 11 (D-512, amendment 16 §8)', () => {
  it('schema 11 is the current version; 1 to 10 stay accepted', () => {
    expect([...PLAN_SCHEMA_VERSIONS]).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
    expect(GRANTED_QUALITY_SINCE).toBe(11);
  });

  it('M-29 adds no field: the schema-10 Lich plan validates at 11 as written, and a quality on any gem is no schema error', () => {
    const lich = read(LICH);
    const r = validatePlan({ ...lich, schemaVersion: 11 }, ref);
    expect(r.ok ? r.plan.stages : r.errors).toEqual(lich.stages);
    for (const version of [10, 11]) {
      const v = validatePlan(plan(version, 5), ref);
      expect({ version, ok: v.ok ? true : v.errors }).toEqual({ version, ok: true });
    }
  });

  it("from schema 11 compile_check gets each gem's quality; a schema-10 plan's gems go without it (§26)", () => {
    const gems = (version: number) => checkStageOf(stageOf(version, 5), undefined, 0, version).groups.map((g) => g.gems);
    expect(gems(11)).toEqual([[{ name: 'Arc', enabled: true, quality: 0 }], [{ name: 'Purity of Ice', enabled: true, quality: 5 }]]);
    expect(gems(10)).toEqual([[{ name: 'Arc', enabled: true }], [{ name: 'Purity of Ice', enabled: true }]]);
    // Without a version (a caller that names none), as before.
    expect(checkStageOf(stageOf(11, 5)).groups[1].gems).toEqual([{ name: 'Purity of Ice', enabled: true }]);
  });
});
