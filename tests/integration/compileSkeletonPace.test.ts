/**
 * WU-88 (amendment 8 §9, D-407): clear speed and movement speed on a card skeleton's compile record, through
 * `compile_plan`, in process and engine-required.
 *
 * A card skeleton is R1b's measure-only plan for one card (`references/stages/R1b.md`, step 4): one stage, its id the
 * card id without hyphens then `e`, `progress` `endgame` and no `variant`. Until D-407 only the endgame variant stages
 * had `measures`. Now a skeleton's record holds the rough `clearSpeed` (D-353: a band from the clear skill's area) and
 * the player's movement speed beside it, PoB's `EffectiveMovementSpeedMod` (movement speed × action speed, the
 * sidebar's "Movement Speed Modifier"). PoB gives some attacks no radius, such as a Skeletal Warrior's strike: such a
 * clear skill reads `slow` with the no-area flag, so a display can say "slow (PoB gives no area)".
 *
 * The skeletons are written here from the committed `minion-wolf` fixture (its level-80 Warrior tree and Wooden Club)
 * with the variant fields removed, and the game data's names: "Earthquake" (its first stat set, Impact, has a base
 * radius of 18, `Data/Skills/act_str.lua`) and "Skeletal Warrior" (granted effect `SummonSkeletalWarriorsPlayer`,
 * `Data/Gems.lua`). The server runs in process over private folders (`startSessionFixture`).
 *
 * - AC-P71 (D-407): a card skeleton's compile record holds `clearSpeed` and the movement speed; a clear skill with no
 *   area reads `slow` with the no-area flag.
 * - D-407 within the HG-12 grant: the skeleton gets no `dps`, `ehp` or `arbiter`, the endgame variant of the same build
 *   keeps them and gains the same movement speed, and `compile_plan`'s key-figure line for the skeleton is unchanged.
 *
 * Campaign stages still have no measures: `tests/integration/compileMeasures.test.ts` (AC-P62) checks a campaign stage
 * of a compiled plan. The rules' edges over hand-made records are `tests/unit/planPace.test.ts`.
 */
import fs from 'fs';
import path from 'path';
import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import { engineDescribe } from '../helpers/engine';
import { startSessionFixture, type SessionFixture } from '../helpers/engineSession';
import { clearBand, type CompileRecord } from '../../src/plan/record';

const REPO = path.resolve(__dirname, '..', '..');
const ENGINE_TIMEOUT = 300_000;
/** The stage id of card `r1-a-1`'s skeleton (R1b step 4). */
const SKELETON = 'r1a1e';
/** Boots with 25% increased Movement Speed and nothing else, against the fixture's boots, which have none. */
const FAST_BOOTS = 'Rarity: Rare\nGale Stride\nRough Greaves\n25% increased Movement Speed';

type Json = Record<string, any>;

const gem = (name: string) => ({ name, level: 20, quality: 0, enabled: true });

/**
 * A card skeleton from the `minion-wolf` fixture: one endgame stage with no variant, the named damage source `skill`
 * alone in its group as the clear, main and rolled group; with `fastBoots`, boots of 25% increased Movement Speed. With
 * `variant`, the same build as an endgame budget rung instead (the fixture's own variant fields kept).
 */
function plan(skill: string, opts: { fastBoots?: boolean; variant?: boolean } = {}): Json {
  const p = JSON.parse(fs.readFileSync(path.join(REPO, 'tests', 'fixtures', 'plans', 'minion-wolf', 'plan.json'), 'utf8')) as Json;
  p.roll.skill = skill;
  const stage = p.stages[0];
  if (opts.variant) {
    stage.variantBasis.gemLevels.ref = 'test: level-20 gems';
  } else {
    delete stage.variant;
    delete stage.ascendancyPoints;
    delete stage.variantBasis;
    stage.id = SKELETON;
    stage.loadoutName = `Card r1-a-1 (L${stage.level}) {${SKELETON}}`;
  }
  expect(stage.progress).toBe('endgame');
  stage.skills = { groups: [{ label: skill, enabled: true, role: 'clear', gems: [gem(skill)] }], main: { group: 1, activeSkill: 1 }, rolledGroup: 1 };
  if (opts.fastBoots) stage.items.slots = stage.items.slots.map((s: Json) => (s.slot === 'Boots' ? { slot: 'Boots', text: FAST_BOOTS } : s));
  p.ledger = [];
  return p;
}

engineDescribe('WU-88: clear speed and movement speed on a card skeleton (D-407)', () => {
  let f: SessionFixture;
  /** Earthquake with fast boots: a skeleton, and the same build as a budget rung; Skeletal Warrior: a skeleton. */
  let quake: { record: CompileRecord; text: string };
  let quakeRung: { record: CompileRecord; text: string };
  let warrior: { record: CompileRecord; text: string };

  /** A measure-only compile of `p` in a new run, as R1b's step 8 makes it: its record and compile_plan's text. */
  async function compile(slug: string, p: Json) {
    const made = await f.call('guide_run', { new_run: slug });
    if (made.isError) throw new Error(`guide_run failed: ${made.text}`);
    const abs = /^Created run folder (.+)$/m.exec(made.text)![1];
    const planPath = /^plan_path for this run: (\S+)$/m.exec(made.text)![1];
    fs.writeFileSync(path.join(f.guides, planPath), `${JSON.stringify(p, null, 2)}\n`);
    const out = await f.call('compile_plan', { plan_path: planPath, measure_only: true });
    expect({ isError: out.isError, text: out.isError ? out.text : '' }).toEqual({ isError: false, text: '' });
    return { record: JSON.parse(fs.readFileSync(path.join(abs, 'compile-record.json'), 'utf8')) as CompileRecord, text: out.text };
  }

  beforeAll(async () => {
    f = await startSessionFixture();
    quake = await compile('p71-quake', plan('Earthquake', { fastBoots: true }));
    quakeRung = await compile('p71-quake-rung', plan('Earthquake', { fastBoots: true, variant: true }));
    warrior = await compile('p71-warrior', plan('Skeletal Warrior'));
  }, ENGINE_TIMEOUT);

  afterAll(async () => f?.close(), 60_000);

  describe('AC-P71 (D-407)', () => {
    it("a card skeleton's compile record holds clearSpeed, the band of its clear skill's area, and the player's movement speed, PoB's EffectiveMovementSpeedMod", () => {
      expect(quake.record.mode).toBe('measure-only');
      expect(quake.record.stagesCompiled).toEqual([SKELETON]);
      const s = quake.record.stages[SKELETON];
      const m = s.measures!;
      expect(m).toBeDefined();
      // The clear skill is the skeleton's one group, Earthquake, read at its first stat set (Impact, D-363): PoB gives it
      // an area, and the band is that radius's (below 2 m slow, below 4 m medium, else fast).
      const entry = s.skillOutputs.g1s1p1;
      expect(entry.statSetLabel).toBe('Impact');
      expect(entry.fields.AreaOfEffectRadiusMetres).toBeGreaterThan(0);
      expect(m.clearSpeed).toMatchObject({
        skill: 'Earthquake',
        key: 'g1s1p1',
        rough: true,
        radiusMetres: entry.fields.AreaOfEffectRadiusMetres,
        band: clearBand(entry.fields.AreaOfEffectRadiusMetres),
        noArea: false,
      });
      expect(['slow', 'medium', 'fast']).toContain(m.clearSpeed.speed);
      // The movement speed beside it is PoB's own figure for the player.
      expect(m.movementSpeed).toBe(s.outputs.EffectiveMovementSpeedMod);
      expect(m.movementSpeed).toBeGreaterThan(0);
    });

    it("the movement speed is the player's: 25% increased Movement Speed on the boots makes it 1.25 times the same build's without", () => {
      const fast = quake.record.stages[SKELETON];
      const plain = warrior.record.stages[SKELETON];
      // The same tree, level and armour, with no increased movement speed; only the boots and the skill differ, and
      // neither skill changes the player's action speed. Whatever else multiplies movement speed applies to both, so
      // the boots' 25% increased makes the figure 1.25 times as large.
      expect(fast.outputs.ActionSpeedMod).toBe(plain.outputs.ActionSpeedMod);
      expect(fast.measures!.movementSpeed! / plain.measures!.movementSpeed!).toBeCloseTo(1.25, 2);
    });

    it('a clear skill with no area reads slow with the no-area flag: PoB gives a Skeletal Warrior skeleton no radius', () => {
      const s = warrior.record.stages[SKELETON];
      const entry = s.skillOutputs.g1s1p1;
      // A plain summon (D-397): its entry carries its minion's numbers, and PoB gives neither the minion's strike nor the
      // summon a radius.
      expect(entry.skill).toBe('Skeletal Warrior Minion');
      expect(entry.fields.MinionTotalDPS).toBeGreaterThan(0);
      expect({ minion: entry.fields.MinionAreaOfEffectRadiusMetres, own: entry.fields.AreaOfEffectRadiusMetres }).toEqual({ minion: undefined, own: undefined });
      expect(s.measures!.clearSpeed).toMatchObject({ skill: 'Skeletal Warrior Minion', key: 'g1s1p1', radiusMetres: 0, band: 'slow', speed: 'slow', noArea: true, rough: true });
      expect(s.measures!.movementSpeed).toBe(s.outputs.EffectiveMovementSpeedMod);
    });
  });

  describe('D-407 within the HG-12 grant', () => {
    it("the skeleton's measures are the pace measures only; the same build as a budget rung keeps dps, ehp and arbiter, and gains the same movement speed", () => {
      expect(Object.keys(quake.record.stages[SKELETON].measures!).sort()).toEqual(['clearSpeed', 'movementSpeed']);
      expect(Object.keys(warrior.record.stages[SKELETON].measures!).sort()).toEqual(['clearSpeed', 'movementSpeed']);
      const rung = quakeRung.record.stages.b;
      expect(Object.keys(rung.measures!).sort()).toEqual(['arbiter', 'clearSpeed', 'dps', 'ehp', 'movementSpeed']);
      expect(rung.measures!.movementSpeed).toBe(rung.outputs.EffectiveMovementSpeedMod);
      expect(rung.measures!.movementSpeed).toBe(quake.record.stages[SKELETON].measures!.movementSpeed);
      expect(rung.measures!.clearSpeed).toEqual(quake.record.stages[SKELETON].measures!.clearSpeed);
    });

    it("compile_plan's key-figure line for a skeleton is unchanged: no clear speed and no movement speed; the rung's still ends with its clear speed", () => {
      for (const { text } of [quake, warrior]) {
        const lines = text.split('\n');
        const line = lines[lines.findIndex((l) => l.startsWith(`Stage ${SKELETON} "`)) + 1];
        expect(line).toMatch(/^ {2}Key figures: DPS \d+/);
        expect(line).not.toMatch(/clear|movement|Arbiter/i);
      }
      const lines = quakeRung.text.split('\n');
      const line = lines[lines.findIndex((l) => l.startsWith('Stage b "')) + 1];
      expect(line).toMatch(new RegExp(`; clear ${quakeRung.record.stages.b.measures!.clearSpeed.speed} \\(rough\\)$`));
      expect(line).not.toMatch(/movement/i);
    });
  });
});
