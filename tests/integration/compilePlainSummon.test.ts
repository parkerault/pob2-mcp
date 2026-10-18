/**
 * WU-80 (amendment 7, D-397): a plain summon's figure is its minion's, through `compile_plan`, in process and
 * engine-required.
 *
 * A plain summon such as Skeletal Warrior names no minion skill, so the record holds no minion selection for its
 * group (`minionSkills`, D-377). Its breakdown entry still carries its minion's numbers as `Minion<Field>` fields
 * (D-376), the checker's test for a skill that summons a minion (D-385). From D-397 the group's figure is then its
 * minion's `MinionTotalDPS`, as when the group names a minion skill (D-378); a group whose skill is the player's keeps
 * `TotalDPS`.
 *
 * The plans are written here from the committed `minion-wolf` fixture (its level-80 Warrior tree and Wooden Club),
 * with the game data's names: the gem "Skeletal Warrior" (`Data/Gems.lua`, granted effect
 * `SummonSkeletalWarriorsPlayer`, whose minion is `RaisedSkeletonWarriors`, "Skeletal Warrior", `Data/Minions.lua`),
 * and the mace attack "Boneshatter". Neither is legacy. The server runs in process over private folders
 * (`startSessionFixture`).
 *
 * - AC-P70 (D-397): a plan whose main group is Skeletal Warrior, with no `minionSkill`, compiles; `measures.dps`
 *   equals the main entry's `MinionTotalDPS` × its Count and is above 0; the key-figure line marks the figure as the
 *   minion's, `(<summon>, minion)`; a group whose skill is the player's keeps `TotalDPS`, beside the summon and as
 *   the main group. The line names the summon as the record does, PoB's name of the skill, "Skeletal Warrior Minion":
 *   the record holds neither the gem's name nor the minion's ("Skeletal Warrior") for a plain summon.
 *
 * The rule's edges over hand-made records are `tests/unit/planMeasures.test.ts`.
 */
import fs from 'fs';
import path from 'path';
import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import { engineDescribe } from '../helpers/engine';
import { startSessionFixture, type SessionFixture } from '../helpers/engineSession';
import { figureField, type CompileRecord } from '../../src/plan/record';

const REPO = path.resolve(__dirname, '..', '..');
const ENGINE_TIMEOUT = 300_000;

type Json = Record<string, any>;

/** Whether a breakdown entry's fields carry its minion's numbers (`Minion<Field>`, D-376). */
const minionFields = (fields: Record<string, number>) => Object.keys(fields).filter((k) => /^Minion[A-Z]/.test(k));

/**
 * A one-stage endgame plan from the `minion-wolf` fixture: group 1 a level-20 Skeletal Warrior with Count 2 and no
 * `minionSkill`, group 2 a level-20 Boneshatter, the player's attack. `main` is the main and rolled group, and the
 * roll's skill is its gem.
 */
function plan(main: 1 | 2): Json {
  const p = JSON.parse(fs.readFileSync(path.join(REPO, 'tests', 'fixtures', 'plans', 'minion-wolf', 'plan.json'), 'utf8')) as Json;
  const gem = (name: string) => ({ name, level: 20, quality: 0, enabled: true });
  p.roll.skill = main === 1 ? 'Skeletal Warrior' : 'Boneshatter';
  const stage = p.stages[0];
  stage.variantBasis.gemLevels.ref = 'test: level-20 gems';
  stage.skills = {
    groups: [
      {
        label: 'Skeletal Warrior',
        enabled: true,
        role: 'single_target',
        gems: [gem('Skeletal Warrior')],
        count: 2,
        countReason: 'test: two warriors strike at once',
      },
      { label: 'Boneshatter', enabled: true, role: 'clear', gems: [gem('Boneshatter')] },
    ],
    main: { group: main, activeSkill: 1 },
    rolledGroup: main,
  };
  p.ledger = [];
  return p;
}

engineDescribe("WU-80: a plain summon's figure is its minion's (D-397)", () => {
  let f: SessionFixture;

  /** A measure-only compile of `p` in a new run: its record and compile_plan's text, and guide_run's stage view. */
  async function compile(slug: string, p: Json) {
    const out0 = await f.call('guide_run', { new_run: slug });
    if (out0.isError) throw new Error(`guide_run failed: ${out0.text}`);
    const abs = /^Created run folder (.+)$/m.exec(out0.text)![1];
    const planPath = /^plan_path for this run: (\S+)$/m.exec(out0.text)![1];
    fs.writeFileSync(path.join(f.guides, planPath), `${JSON.stringify(p, null, 2)}\n`);
    const out = await f.call('compile_plan', { plan_path: planPath, measure_only: true });
    expect({ isError: out.isError, text: out.isError ? out.text : '' }).toEqual({ isError: false, text: '' });
    const record = JSON.parse(fs.readFileSync(path.join(abs, 'compile-record.json'), 'utf8')) as CompileRecord;
    const view = await f.call('guide_run', { view: { plan: planPath, stage: 'b' } });
    expect(view.isError).toBe(false);
    return { record, text: out.text, view: view.text };
  }

  beforeAll(async () => {
    f = await startSessionFixture();
  }, ENGINE_TIMEOUT);

  afterAll(async () => f?.close(), 60_000);

  describe('AC-P70 (D-397)', () => {
    it(
      "AC-P70: a main group of Skeletal Warrior with no minionSkill compiles; measures.dps is the main entry's MinionTotalDPS × its Count, above 0; the key-figure line reads (Skeletal Warrior Minion, minion); the player's Boneshatter beside it keeps TotalDPS",
      async () => {
        const { record, text, view } = await compile('p70-summon', plan(1));
        const s = record.stages.b;
        // A plain summon: no minion selection in the record, and its entry carries its minion's numbers.
        expect(s.minionSkills).toEqual([]);
        const entry = s.skillOutputs.g1s1p1;
        expect(minionFields(entry.fields)).toContain('MinionTotalDPS');
        expect(entry.fields.TotalDPS ?? 0).toBe(0);
        // The headline: the minion's figure × the group's Count of 2, above 0.
        expect(s.countedSkillOutputs.g1s1p1.count).toBe(2);
        expect(s.measures!.dps).toBe(entry.fields.MinionTotalDPS * 2);
        expect(s.measures!.dps).toBeGreaterThan(0);
        // The key-figure line marks the figure as the minion's and names the summon as the record does: PoB's name of
        // the gem's skill, "Skeletal Warrior Minion" (`Data/Skills/act_int.lua`, `SummonSkeletalWarriorsPlayer`), in
        // compile_plan's reply and in guide_run's stage view.
        expect(entry.skill).toBe('Skeletal Warrior Minion');
        const line = `Key figures: DPS ${Math.round(s.measures!.dps!)} (Skeletal Warrior Minion, minion);`;
        expect(text).toContain(line);
        expect(view).toContain(line);
        // The player's group beside it: no minion numbers, so its figure stays TotalDPS.
        expect(minionFields(s.skillOutputs.g2s1p1.fields)).toEqual([]);
        expect(s.skillOutputs.g2s1p1.fields.TotalDPS).toBeGreaterThan(0);
        expect(figureField(s, { group: 2, activeSkill: 1 })).toBe('TotalDPS');
        expect(figureField(s, { group: 1, activeSkill: 1 })).toBe('MinionTotalDPS');
      },
      ENGINE_TIMEOUT,
    );

    it(
      "AC-P70: a main group whose skill is the player's (Boneshatter) keeps TotalDPS beside the plain summon: measures.dps is its TotalDPS × its Count, and the key-figure line names no minion",
      async () => {
        const { record, text, view } = await compile('p70-player', plan(2));
        const s = record.stages.b;
        // The summon beside it still carries its minion's numbers.
        expect(minionFields(s.skillOutputs.g1s1p1.fields)).toContain('MinionTotalDPS');
        const entry = s.skillOutputs.g2s1p1;
        expect(minionFields(entry.fields)).toEqual([]);
        expect(s.countedSkillOutputs.g2s1p1.count).toBe(1);
        expect(s.measures!.dps).toBe(entry.fields.TotalDPS);
        expect(s.measures!.dps).toBeGreaterThan(0);
        const line = `Key figures: DPS ${Math.round(s.measures!.dps!)}; life `;
        expect(text).toContain(line);
        expect(view).toContain(line);
        expect(text).not.toContain(', minion)');
      },
      ENGINE_TIMEOUT,
    );
  });
});
