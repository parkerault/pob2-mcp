/**
 * AC-W137's compile rows (WU-154, amendment 16 §8 and §26, D-512, PG-114; engine, in process): plan schema 11's refusal
 * of a quality on a granted skill's gem, the granted quality through `compile_plan`, and the schema-10 plan fixtures
 * compiled as before.
 *
 * The game's facts (the user, 2026-11-08): a granted skill gains base quality only on a wand, a staff or a sceptre, from
 * the item's own quality; a skill another item or a passive grants has no quality of its own. So a plan's gem for a skill
 * the stage's items or allocated passives grant (the copy that carries its supports, PG-108) has quality 0, and from
 * schema 11 `compile_check` refuses more, naming the stage, the group and the skill and saying where its quality comes
 * from (`pob-api/API/Compile.lua`'s check_granted_quality; the compiler sends the gems' qualities from schema 11 only).
 *
 * The plans are written from the pinned game data on two committed fixtures:
 * - `tests/fixtures/plans/m27-wu137/lich/plan.json` (schema 10, a level-90 Witch, Lich): a stage holding a quality 20
 *   Shrine Sceptre, "Grants Skill: Level 20 Purity of Ice" (`Data/Bases/sceptre.lua`:65-73, written with its
 *   `Implicits:` line, PG-111), with a plain Purity of Ice copy; and one holding a quality 20 Hardwood Spear, whose base
 *   grants Spear Throw (`Data/Bases/spear.lua`:5-13), with a plain Spear Throw copy;
 * - `tests/fixtures/plans/varashta-navira/plan.json` (schema 4, a Disciple of Varashta): its ascendancy node Barya of
 *   Navira (32705, `TreeData/0_5/tree.json`: "Grants Skill: Navira, the Last Mirage") grants the group's skill.
 *
 * §26: every schema-10 plan fixture compiles to its old record. The two are the Lich plan and the pipeline fixture
 * `tests/fixtures/pipeline/run-a14/builds/r1-a-2/plan.json`; `tests/fixtures/plans/schema11/` holds what each gave at the
 * integration head before WU-154 (`b475db9`): the Lich plan's compile record, less the fields that change on every
 * compile (`compiledAt`, `importCode`, `timing`, `pobFile`, each stage's `elapsedMs`), and the pipeline plan's 26
 * defects (a mock plan that never compiled).
 */
import fs from 'fs';
import path from 'path';
import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import { engineDescribe } from '../helpers/engine';
import { startSessionFixture, type SessionFixture, type ToolOutcome } from '../helpers/engineSession';
import type { CompileRecord } from '../../src/plan/record';

const REPO = path.resolve(__dirname, '..', '..');
const PLANS = path.join(REPO, 'tests', 'fixtures', 'plans');
const LICH = path.join(PLANS, 'm27-wu137', 'lich', 'plan.json');
const VARASHTA = path.join(PLANS, 'varashta-navira', 'plan.json');
const RUN_A14 = path.join(REPO, 'tests', 'fixtures', 'pipeline', 'run-a14', 'builds', 'r1-a-2', 'plan.json');
const BEFORE = path.join(PLANS, 'schema11');
const ENGINE_TIMEOUT = 600_000;

type Json = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
const read = (file: string): Json => JSON.parse(fs.readFileSync(file, 'utf8')) as Json;
const gem = (name: string, level: number, quality: number) => ({ name, level, quality, enabled: true });

const SCEPTRE = (quality: number, corrupted = false) =>
  ['Rarity: Normal', 'Shrine Sceptre', `Quality: ${quality}`, 'Implicits: 1', 'Grants Skill: Level 20 Purity of Ice', ...(corrupted ? ['Corrupted'] : [])].join('\n');
const SPEAR = ['Rarity: Normal', 'Hardwood Spear', 'Quality: 20', 'Implicits: 1', 'Grants Skill: Spear Throw'].join('\n');
/** A Withered Wand, "Grants Skill: Level 20 Chaos Bolt" (`Data/Bases/wand.lua`); Chaos Bolt's quality gives +2% projectile speed per 1%. */
const WAND = (quality: number, corrupted = false) =>
  ['Rarity: Normal', 'Withered Wand', `Quality: ${quality}`, 'Implicits: 1', 'Grants Skill: Level 20 Chaos Bolt', ...(corrupted ? ['Corrupted'] : [])].join('\n');

/** Every leaf path of `want` whose value `got` doesn't hold equally (a missing key included), as compileSchema8's. */
function differences(want: unknown, got: unknown, at = '$', out: string[] = []): string[] {
  if (Array.isArray(want)) {
    if (!Array.isArray(got) || got.length !== want.length) out.push(`${at}: an array of ${want.length}, got ${JSON.stringify(got)?.slice(0, 80)}`);
    else want.forEach((w, i) => differences(w, got[i], `${at}[${i}]`, out));
  } else if (want !== null && typeof want === 'object') {
    if (got === null || typeof got !== 'object' || Array.isArray(got)) out.push(`${at}: an object, got ${JSON.stringify(got)?.slice(0, 80)}`);
    else for (const [k, v] of Object.entries(want)) differences(v, (got as Json)[k], `${at}.${k}`, out);
  } else if (want !== got) {
    out.push(`${at}: ${JSON.stringify(want)}, got ${JSON.stringify(got)}`);
  }
  return out;
}

/** The Lich plan's stage as stage `id`, holding `slots` beside its body armour and `groups` after its Arc group. */
function lichStage(id: string, slots: Json[], groups: Json[], arcQuality = 0): Json {
  const s = read(LICH).stages[0];
  Object.assign(s, { id, loadoutName: `Lich ${id} (L90) {${id}}` });
  s.items.slots.push(...slots);
  s.skills.groups[0].gems[0].quality = arcQuality;
  s.skills.groups.push(...groups);
  return s;
}

const purityCopy = (quality: number) => ({ label: 'Purity of Ice', enabled: true, role: 'utility', gems: [gem('Purity of Ice', 20, quality)] });
const spearCopy = (quality: number) => ({ label: 'Spear Throw', enabled: true, role: 'utility', gems: [gem('Spear Throw', 1, quality)] });
/** The plan's copy of the wand's Chaos Bolt with a support, the stage's main skill (group 2, after the Lich's Arc). */
const chaosBoltCopy = { label: 'Chaos Bolt', enabled: true, role: 'clear', gems: [gem('Chaos Bolt', 20, 0), gem('Pierce I', 1, 0)] };
function wandStage(id: string, text: string): Json {
  const s = lichStage(id, [{ slot: 'Weapon 1', text }], [chaosBoltCopy]);
  s.skills.main = { group: 2, activeSkill: 1, statSet: 1 };
  return s;
}

/** The quality of each Chaos Bolt gem in a plan group (no `source`) of each skill set in a compiled file, by set title. */
function copyQualities(xml: string): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const set of xml.matchAll(/<SkillSet [^>]*title="([^"]*)"[^>]*>([\s\S]*?)<\/SkillSet>/g)) {
    out[set[1]] = [...set[2].matchAll(/<Skill (?![^>]*source=)[^>]*>([\s\S]*?)<\/Skill>/g)].flatMap((g) =>
      [...g[1].matchAll(/<Gem [^>]*nameSpec="Chaos Bolt"[^>]*>/g)].map((m) => /quality="(\d+)"/.exec(m[0])![1]),
    );
  }
  return out;
}

/** The Lich plan at `version` with `stages`. */
function lichPlan(version: number, stages: Json[]): Json {
  return { ...read(LICH), schemaVersion: version, stages };
}

/** The Varashta plan at `version`, its Navira gem at `quality`. */
function varashtaPlan(version: number, quality: number): Json {
  const p = read(VARASHTA);
  p.schemaVersion = version;
  p.stages[0].skills.groups[0].gems[0].quality = quality;
  return p;
}

engineDescribe('AC-W137 (WU-154): a granted skill\'s quality through compile_plan, plan schema 11 (D-512, PG-114)', () => {
  let f: SessionFixture;
  let n = 0;
  const outcomes: Record<string, ToolOutcome> = {};
  const records: Record<string, CompileRecord> = {};
  const files: Record<string, string> = {};

  /** Compiles `plan` measure-only in a new run folder; its outcome, and its record when it compiled. */
  async function compile(name: string, plan: Json): Promise<void> {
    n += 1;
    const made = await f.call('guide_run', { new_run: `granted-quality-${n}` });
    if (made.isError) throw new Error(`guide_run failed: ${made.text}`);
    const abs = /^Created run folder (.+)$/m.exec(made.text)![1];
    const planPath = /^plan_path for this run: (\S+)$/m.exec(made.text)![1];
    fs.writeFileSync(path.join(f.guides, planPath), `${JSON.stringify(plan, null, 2)}\n`);
    outcomes[name] = await f.call('compile_plan', { plan_path: planPath, measure_only: true });
    const rec = path.join(abs, 'compile-record.json');
    if (!outcomes[name].isError && fs.existsSync(rec)) records[name] = read(rec) as unknown as CompileRecord;
    const xml = path.join(abs, 'compiled-build.xml');
    if (fs.existsSync(xml)) files[name] = fs.readFileSync(xml, 'utf8');
  }

  /** The refusal's defect lines (after "nothing was compiled:"), or the compile's text when it compiled. */
  const defectsOf = (name: string): string[] => {
    const out = outcomes[name];
    if (!out.isError) return [`compiled: ${out.text.split('\n')[0]}`];
    const at = out.text.indexOf('nothing was compiled:\n');
    return at < 0 ? [out.text] : out.text.slice(at + 'nothing was compiled:\n'.length).trim().split('\n');
  };

  beforeAll(async () => {
    f = await startSessionFixture({ testActions: true });
    const refused = [
      lichStage('sceptre', [{ slot: 'Weapon 1', text: SCEPTRE(20) }], [purityCopy(5)]),
      lichStage('spear', [{ slot: 'Weapon 1', text: SPEAR }], [spearCopy(5)]),
    ];
    await compile('refused11', lichPlan(11, refused));
    await compile('refused10', lichPlan(10, refused));
    await compile('passive11', varashtaPlan(11, 5));
    await compile('passive10', varashtaPlan(10, 5));
    await compile(
      'measured',
      lichPlan(11, [
        lichStage('q20', [{ slot: 'Weapon 1', text: SCEPTRE(20) }], [purityCopy(0)], 20),
        // The compile gives an item PoB's default quality, 20, when its text gives less and it isn't corrupted
        // (BuildOps.add_item_text's NormaliseQuality, as PoB adds an item), so the quality 0 sceptre is a corrupted one.
        lichStage('q0', [{ slot: 'Weapon 1', text: SCEPTRE(0, true) }], [purityCopy(0)], 20),
      ]),
    );
    const wands = [wandStage('w20', WAND(20)), wandStage('w0', WAND(0, true))];
    await compile('copy11', lichPlan(11, wands));
    await compile('copy10', lichPlan(10, wands));
    await compile('lich', read(LICH));
    await compile('runA14', read(RUN_A14));
  }, ENGINE_TIMEOUT);

  afterAll(async () => f?.close(), 60_000);

  describe('schema 11: compile_check refuses a quality on a granted skill\'s gem, naming the stage, the group and the skill', () => {
    it("a quality 5 Purity of Ice copy beside the stage's sceptre: the defect says the sceptre's own quality is the skill's", () => {
      expect(defectsOf('refused11')).toContain(
        'stage sceptre: skills.groups[1].gems[0]: Purity of Ice is a skill the Shrine Sceptre in Weapon 1 grants, so its gem ' +
          'has quality 0, not 5 (D-512): a granted skill has no quality of its own: on a wand, a staff or a sceptre it takes ' +
          'the item\'s, so raise the Shrine Sceptre\'s "Quality:" line instead',
      );
    });

    it("a quality 5 Spear Throw copy beside the stage's spear: the defect says only quality modifiers raise it", () => {
      expect(defectsOf('refused11')).toContain(
        'stage spear: skills.groups[1].gems[0]: Spear Throw is a skill the Hardwood Spear in Weapon 1 grants, so its gem has ' +
          'quality 0, not 5 (D-512): a granted skill has no quality of its own, and only a wand, a staff (not a quarterstaff) ' +
          "or a sceptre gives it the item's; only quality modifiers (Dialla's Desire, Loreweave) raise it",
      );
    });

    it('the two are the plan\'s only defects: the Arc gem and the items are no defect', () => {
      expect(defectsOf('refused11')).toHaveLength(2);
    });

    it('a quality 5 gem for the skill a passive grants (Barya of Navira, 32705): refused, naming the passive', () => {
      expect(defectsOf('passive11')).toEqual([
        "stage b: skills.groups[0].gems[0]: Navira, the Last Mirage is a skill the passive Barya of Navira (32705) grants, so its " +
          "gem has quality 0, not 5 (D-512): a skill a passive grants has no quality of its own; only quality modifiers " +
          "(Dialla's Desire, Loreweave) raise it",
      ]);
    });

    it('the same plans at schema 10 compile: an older plan is never refused for it (§26)', () => {
      expect(defectsOf('refused10')).toEqual([expect.stringMatching(/^compiled: Compiled .*: 2 stages \(measure-only\)/)]);
      expect(defectsOf('passive10')).toEqual([expect.stringMatching(/^compiled: Compiled .*: 1 stage \(measure-only\)/)]);
    });
  });

  describe("schema 11: a granted skill's quality from its sceptre, measured by the compile (PG-114's patch)", () => {
    it('a quality 0 copy beside a quality 20 Shrine Sceptre, and a quality 20 Arc gem (no granted skill), compile', () => {
      expect(defectsOf('measured')).toEqual([expect.stringMatching(/^compiled: Compiled .*: 2 stages \(measure-only\)/)]);
    });

    it("the quality 20 sceptre's Purity gives 8 points of cold resistance over a corrupted quality 0 one's (+0.4% per 1% quality)", () => {
      const cold = (id: string) => records.measured.stages[id].outputs.ColdResist as number;
      expect(cold('q20') - cold('q0')).toBe(8);
      expect(cold('q20')).toBeLessThan(75);
    });
  });

  describe("schema 11: the plan's measured copy of a wand's granted skill takes the wand's quality (D-512)", () => {
    const speed = (name: string, id: string) => records[name].stages[id].outputs.ProjectileSpeedMod as number;

    it('both plans compile', () => {
      for (const name of ['copy11', 'copy10']) {
        expect({ name, out: defectsOf(name) }).toEqual({ name, out: [expect.stringMatching(/^compiled: Compiled .*: 2 stages \(measure-only\)/)] });
      }
    });

    it("the main skill, the plan's Chaos Bolt copy with Pierce I, measures +40% projectile speed beside the quality 20 wand over a corrupted quality 0 one", () => {
      expect(speed('copy11', 'w0')).toBeGreaterThan(0);
      expect(speed('copy11', 'w20')).toBeCloseTo(speed('copy11', 'w0') * 1.4, 6);
      expect(records.copy11.stages.w20.skillOutputs.g2s1p1.skill).toBe('Chaos Bolt');
    });

    it("the file the compile composes holds the copy's gem at the wand's quality: 20 beside the quality 20 wand, 0 beside the corrupted one", () => {
      const q = copyQualities(files.copy11);
      expect(Object.values(q).sort()).toEqual([['0'], ['20']]);
      expect(Object.entries(q).find(([title]) => title.includes('{w20}'))?.[1]).toEqual(['20']);
    });

    it("at schema 10 the copy keeps the plan's quality 0: the two stages measure alike and share one skill set (§26)", () => {
      expect(speed('copy10', 'w20')).toBe(speed('copy10', 'w0'));
      expect(speed('copy10', 'w20')).toBe(speed('copy11', 'w0'));
      expect(Object.values(copyQualities(files.copy10))).toEqual([['0']]);
    });
  });

  describe('§26: every schema-10 plan fixture compiles to its old record', () => {
    it("the Lich plan's record equals lich-record-before-schema11.json in every field it holds", () => {
      expect(defectsOf('lich')).toEqual([expect.stringMatching(/^compiled: Compiled .*: 1 stage \(measure-only\)/)]);
      const before = read(path.join(BEFORE, 'lich-record-before-schema11.json'));
      expect(differences(before, records.lich)).toEqual([]);
    });

    it("the pipeline fixture run-a14's r1-a-2 plan (a mock) is refused with the same 26 defects as before", () => {
      const before = read(path.join(BEFORE, 'run-a14-r1-a-2-defects-before-schema11.json')).defects as string[];
      expect(before).toHaveLength(26);
      expect(defectsOf('runA14')).toEqual(before);
    });
  });
});
