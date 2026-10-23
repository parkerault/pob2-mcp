/**
 * AC-W82 (WU-103, amendment 9 D-428 and §24.1's ring-slot ruling), unit: V1 gives PoB's warning past its skill slots
 * its own code, `skill-slots`, its message naming the Unset Ring ("Grants 1 additional Skill Slot") as the remedy. No
 * new count: the counts are PoB's, read from its line. Every other PoB line stays a `pob-warning`.
 *
 * PoB's line is read from the pinned source (`Modules/Build.lua:2222`) and filled in, so the matcher is checked
 * against PoB's own format; the remedy's text against the Unset Ring's implicit (`Data/Bases/ring.lua`). The engine
 * test, `tests/integration/skillSlots.test.ts`, reaches the real warning through a compile.
 */
import fs from 'fs';
import path from 'path';
import { describe, expect, it } from '@jest/globals';
import { checkV1, SKILL_SLOT_REMEDY, SKILL_SLOTS_WARNING } from '../../src/plan/checks/v1';
import { loadReferenceData } from '../../src/plan/referenceData';
import { validatePlan, type Stage } from '../../src/plan/schema';
import type { StageChecks } from '../../src/engine/schemas';

const REPO = path.resolve(__dirname, '..', '..');
const POB_SRC = path.join(REPO, 'vendor', 'PathOfBuilding-PoE2', 'src');
const ref = loadReferenceData(path.join(REPO, 'data'));

function stageOne(): Stage {
  const plan = fs.readFileSync(path.join(REPO, 'tests', 'fixtures', 'plans', 'two-stage', 'plan.json'), 'utf8');
  const v = validatePlan(plan, ref);
  if (!v.ok) throw new Error(JSON.stringify(v.errors));
  return v.plan.stages[0];
}

/** Stage inputs that hold nothing beyond the plan, with PoB's warning lines. */
function checksFor(stage: Stage, warnings: string[]): StageChecks {
  return {
    counts: { used: stage.tree.nodes.length, ascendancy: stage.tree.ascendancyNodes.length, secondaryAscendancy: 0, sockets: 0, weaponSet1: 0, weaponSet2: 0 },
    extraPoints: 0,
    passivePointsToWeaponSetPoints: 0,
    attributes: { Str: 20, Dex: 7, Int: 7, ReqStr: 0, ReqDex: 0, ReqInt: 0 },
    requirementSources: {},
    gems: [],
    items: [],
    warnings,
    nodeNames: [],
    activeSkills: [],
    config: { input: {}, placeholder: {} },
    shownOptions: [],
    grantedSkills: [],
  } as unknown as StageChecks;
}

/** PoB's line (`Modules/Build.lua:2222`), filled with `allowed` and `groups`. */
function pobLine(allowed: number, groups: number): string {
  const src = fs.readFileSync(path.join(POB_SRC, 'Modules', 'Build.lua'), 'utf8').split(/\r?\n/)[2221];
  const m = /"(You have too many gem groups allocated\. Max allowed is )"\.\.warning\[1\]\.\."(\. You have )"\.\.warning\[2\]\.\."( non-item\/non-granted gem groups allocated\.)"/.exec(src);
  expect(m).not.toBeNull();
  return `${m![1]}${allowed}${m![2]}${groups}${m![3]}`;
}

describe('AC-W82 (WU-103): V1 reports PoB\'s skill-slot warning as `skill-slots`, naming the Unset Ring (D-428)', () => {
  it("matches PoB's own line and captures its counts", () => {
    const line = pobLine(9, 10);
    expect(SKILL_SLOTS_WARNING.exec(line)?.slice(1)).toEqual(['9', '10']);
    expect(SKILL_SLOTS_WARNING.test('You have too many passive points allocated')).toBe(false);
  });

  it("names the Unset Ring by its implicit, the pin's line", () => {
    const ring = fs.readFileSync(path.join(POB_SRC, 'Data', 'Bases', 'ring.lua'), 'utf8');
    const base = /itemBases\["Unset Ring"\] = \{[\s\S]*?implicit = "([^"]+)"/.exec(ring);
    expect(base?.[1]).toBe('Grants 1 additional Skill Slot');
    expect(SKILL_SLOT_REMEDY).toBe(`an Unset Ring ("${base![1]}")`);
  });

  it('gives the line the code `skill-slots`, with PoB\'s counts and the Unset Ring as the remedy; the line stays kept', () => {
    const one = stageOne();
    const line = pobLine(10, 12);
    const v1 = checkV1({ stage: one, predecessor: null, checks: checksFor(one, [line]), ref });
    expect(v1.verdict.pass).toBe(false);
    expect(v1.verdict.findings.map((f) => f.code)).toEqual(['skill-slots']);
    const [finding] = v1.verdict.findings;
    expect(finding.data).toEqual({ line, allowed: 10, groups: 12 });
    expect(finding.message).toContain('PoB allows 10 skill slots and the stage has 12 groups');
    expect(finding.message).toContain('an Unset Ring ("Grants 1 additional Skill Slot") in a ring slot adds one slot');
    expect(finding.message).toContain('drop 2 of the groups');
    expect(v1.pobWarnings).toEqual({ kept: [line], filtered: [] });
  });

  it('leaves every other PoB line a `pob-warning`', () => {
    const one = stageOne();
    // PoB's socket-group warning (`Modules/Build.lua:2212`), a different line that starts the same way.
    const other = 'You have too many gems in your Boneshatter socket group';
    const v1 = checkV1({ stage: one, predecessor: null, checks: checksFor(one, [other, pobLine(9, 10)]), ref });
    expect(v1.verdict.findings.map((f) => [f.code, f.data?.line])).toEqual([
      ['pob-warning', other],
      ['skill-slots', pobLine(9, 10)],
    ]);
  });
});
