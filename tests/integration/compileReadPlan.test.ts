/**
 * Amendment 16's M-30, WU-161 (§13 to §15, D-518, D-519's compile part, C-41; engine, in process): `compile_plan` on a read
 * plan, the importer fixture's (`tests/fixtures/builds/imported-character.xml`) as `plan_from_build` reads it from the
 * builds folder.
 *
 * - AC-W151: the read plan compiles measure-only with `measure_as: "non-budget"`. compile_check measures the owned legacy
 *   gem (Bloodlust) rather than refusing it, and refuses it once the mark is off; no V1 finding of the four rules owned
 *   content passes (`sockets`, `affix-cap`, `corruption`, `movement-tier`), each of which the same items fail without the
 *   mark; an owned item keeps the quality its text gives (a quality 10 Shrine Sceptre with no `Unique ID:` line, whose
 *   Purity of Ice is then measured at 10), where an unowned one is raised to 20; `config.file`'s inputs are in the
 *   compiled file's config set as read, with no reference hit written; V2's findings are callouts (`from-file`) and its
 *   verdict passes; the record holds the boss, resisting, Arbiter and toughness reads (the toughness read at the
 *   non-budget rung's reference hits, its conditioned read too), with no variant in the plan, `measuredAs`, `owned` and
 *   the Spirit question's figures. compile_check measures an owned unique PoB marks no longer obtainable, in an item slot
 *   (Thunderstep in Boots) and in a tree socket, and refuses each once its mark is off (D-384). V2's `unproduced-state`
 *   callout names a file input nothing in the build produces (Arcane Cloak's option, with no Arcane Cloak; the Parry
 *   debuff once the shield that grants Parry is gone) and not one the build produces (the Parry debuff with its shield).
 * - AC-W152: on the read plan with the Spirit question answered (Virtuous Barrier, Blasphemy, Wind Dancer and Combat
 *   Frenzy switched, Herald of Ice off for Wind Dancer) and measured on weapon set 2, the switched groups are written
 *   disabled, the measured numbers leave their reservation out, and the record's `switches` holds each one measured on
 *   set 2 with its `off` groups off; V1 reports `switched-spirit` for Blasphemy (below 0) and not for the others. On a
 *   stage measured on set 1, a switched group on set 2 is measured with set 2 active, the others on set 1. On a
 *   plan of ten ungranted groups, the tenth disabled, PoB's skill-slot warning comes only when that group is switched
 *   (marked for PG-106's recount). A stage without `switch` or owned content gets none of the record's new fields.
 */
import fs from 'fs';
import path from 'path';
import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import { engineDescribe } from '../helpers/engine';
import { startSessionFixture, type SessionFixture, type ToolOutcome } from '../helpers/engineSession';
import { IMPORTER } from '../helpers/planFromBuild';
import { referenceHits } from '../../src/plan/compiler';
import { loadReferenceData } from '../../src/plan/referenceData';
import type { CompileRecord, StageRecord } from '../../src/plan/record';

const REPO = path.resolve(__dirname, '..', '..');
const LICH = path.join(REPO, 'tests', 'fixtures', 'plans', 'm27-wu137', 'lich', 'plan.json');
const ENGINE_TIMEOUT = 900_000;
const ref = loadReferenceData(path.join(REPO, 'data'));

type Json = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;
const FOUR = ['sockets', 'affix-cap', 'corruption', 'movement-tier'];

/** The plan with every owned mark taken off (a design's content). */
function unmarked(plan: Json): Json {
  const p = clone(plan);
  for (const s of p.stages) for (const x of [...s.items.slots, ...s.items.treeJewels, ...s.skills.groups]) delete x.owned;
  return p;
}
/** The read stage placed on the non-budget rung (§16): its rung's id and variant fields. */
function placed(plan: Json): Json {
  const p = clone(plan);
  const j = { kind: 'judgment', ref: 'placed', confidence: 'M' };
  Object.assign(p.stages[0], { id: 'n', loadoutName: p.stages[0].loadoutName.replace('{f}', '{n}'), variant: 'non-budget', ascendancyPoints: 8, variantBasis: { level: j, gemLevels: j, ascendancyPoints: j } });
  return p;
}
/** The plan with its Shrine Sceptre (Weapon 2 Swap) at quality 10, the text giving no `Unique ID:` line. */
function sceptreAt10(plan: Json): Json {
  const p = clone(plan);
  const slot = p.stages[0].items.slots.find((s: Json) => s.slot === 'Weapon 2 Swap');
  expect(slot.text).toContain('Shrine Sceptre');
  expect(slot.text).not.toContain('Unique ID:');
  slot.text = slot.text.replace('Quality: 20', 'Quality: 10');
  return p;
}
/**
 * D-384: Thunderstep, a unique PoB's data marks no longer obtainable (`vendor/…/Data/Uniques/boots.lua`, as
 * `tests/integration/ruleBreaks.test.ts` uses it), in Boots; and in the tree socket a unique jewel no longer obtainable.
 * PoB2's unique data marks no jewel so, so the jewel's own text says it: PoB reads an item's `Source:` line
 * (`Classes/Item.lua`:689-690), and `BuildOps.is_unobtainable_unique` reads it for a unique its data doesn't list.
 * `ownedBoots` and `ownedJewel` keep or take off each one's mark.
 */
const THUNDERSTEP = 'Rarity: UNIQUE\nThunderstep\nSteeltoe Boots';
const LOST_JEWEL = 'Rarity: UNIQUE\nRelic of the Lost Pact\nRuby\nSource: No longer obtainable\n+12% to Fire Resistance';
function unobtainable(plan: Json, ownedBoots: boolean, ownedJewel: boolean): Json {
  const p = clone(plan);
  const s = p.stages[0];
  const boots = s.items.slots.find((x: Json) => x.slot === 'Boots');
  Object.assign(boots, { text: THUNDERSTEP });
  if (!ownedBoots) delete boots.owned;
  expect(s.items.treeJewels).toHaveLength(1);
  Object.assign(s.items.treeJewels[0], { text: LOST_JEWEL });
  if (!ownedJewel) delete s.items.treeJewels[0].owned;
  return p;
}
/** Without the owned legacy gem, Bloodlust (plan group 8), which compile_check refuses unowned (D-384). */
function withoutBloodlust(plan: Json): Json {
  const p = clone(plan);
  for (const g of p.stages[0].skills.groups) g.gems = g.gems.filter((x: Json) => x.name !== 'Bloodlust');
  return p;
}

/** An XML attribute's value, unescaped as PoB writes it. */
const unescape = (v: string): string => v.replace(/&apos;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#10;/g, '\n').replace(/&amp;/g, '&');

/**
 * Each config set's inputs in a compiled file, by its title: name → the value attribute's text. PoB's save orders an
 * element's attributes differently from process to process, so they are read by name.
 */
function configSets(xml: string): Record<string, Record<string, string>> {
  const out: Record<string, Record<string, string>> = {};
  for (const set of xml.matchAll(/<ConfigSet ([^>]*)>([\s\S]*?)<\/ConfigSet>/g)) {
    const title = unescape(/\btitle="([^"]*)"/.exec(set[1])?.[1] ?? '');
    out[title] = {};
    for (const input of set[2].matchAll(/<Input ([^>]*)\/>/g)) {
      const attrs = Object.fromEntries([...input[1].matchAll(/(\w+)="([^"]*)"/g)].map((m) => [m[1], unescape(m[2])]));
      out[title][attrs.name] = attrs.string ?? attrs.number ?? attrs.boolean;
    }
  }
  return out;
}
/** The quality of each Purity of Ice gem in a plan group (no `source`) of a compiled file. */
const purityQualities = (xml: string): string[] =>
  [...xml.matchAll(/<Skill (?![^>]*source=)[^>]*>([\s\S]*?)<\/Skill>/g)].flatMap((g) =>
    [...g[1].matchAll(/<Gem [^>]*nameSpec="Purity of Ice"[^>]*>/g)].map((m) => /quality="(\d+)"/.exec(m[0])![1]),
  );
/** Each plan group's enabled flag in a compiled file's skill sets, in order. */
const groupsEnabled = (xml: string): boolean[] => [...xml.matchAll(/<Skill (?![^>]*source=)([^>]*)>/g)].map((m) => /enabled="true"/.test(m[1]));

engineDescribe('AC-W151, AC-W152 (WU-161): compile_plan on a read plan (D-518, D-519)', () => {
  let f: SessionFixture;
  let n = 0;
  let read: Json;
  let answered: Json;
  const outcomes: Record<string, ToolOutcome> = {};
  const records: Record<string, CompileRecord> = {};
  const files: Record<string, string> = {};
  const stage = (name: string): StageRecord => Object.values(records[name].stages)[0];

  /** A read plan from the builds folder, with the second call's `answers` if any: the plan.json `plan_from_build` wrote. */
  async function readPlan(answers?: Json): Promise<Json> {
    n += 1;
    const made = await f.call('guide_run', { new_run: 'compile' });
    if (made.isError) throw new Error(made.text);
    const abs = /^Created run folder (.+)$/m.exec(made.text)![1];
    const rel = path.relative(f.guides, abs);
    fs.writeFileSync(path.join(abs, 'run-log.json'), `${JSON.stringify({ schemaVersion: 4, skillRevision: 16, piece: 'compile', stages: [] })}\n`);
    const first = await f.call('plan_from_build', { run_folder: rel, build_name: 'imported-character' });
    if (first.isError) throw new Error(first.text);
    if (answers !== undefined) {
      const second = await f.call('plan_from_build', { run_folder: rel, ...answers });
      if (second.isError) throw new Error(second.text);
    }
    return JSON.parse(fs.readFileSync(path.join(abs, 'plan.json'), 'utf8')) as Json;
  }

  /** Compiles `plan` measure-only in a new run folder with `args`; its outcome, record and compiled file. */
  async function compile(name: string, plan: Json, args: Json = {}): Promise<void> {
    n += 1;
    const made = await f.call('guide_run', { new_run: `read-plan-${n}` });
    if (made.isError) throw new Error(made.text);
    const abs = /^Created run folder (.+)$/m.exec(made.text)![1];
    const planPath = /^plan_path for this run: (\S+)$/m.exec(made.text)![1];
    fs.writeFileSync(path.join(f.guides, planPath), `${JSON.stringify(plan, null, 2)}\n`);
    outcomes[name] = await f.call('compile_plan', { plan_path: planPath, measure_only: true, ...args });
    const rec = path.join(abs, 'compile-record.json');
    if (!outcomes[name].isError && fs.existsSync(rec)) records[name] = JSON.parse(fs.readFileSync(rec, 'utf8')) as CompileRecord;
    const xml = path.join(abs, 'compiled-build.xml');
    if (!outcomes[name].isError && fs.existsSync(xml)) files[name] = fs.readFileSync(xml, 'utf8');
  }

  const codes = (name: string): string[] => (stage(name).v1?.findings ?? []).map((x) => x.code);

  beforeAll(async () => {
    f = await startSessionFixture({ files: { 'imported-character.xml': fs.readFileSync(IMPORTER, 'utf8') } });
    read = await readPlan();
    answered = await readPlan({ main_group: 4, buffs_on: [3, 5, 6], switch_off: { 9: [5] } });
    const asRead = sceptreAt10(read);
    await compile('owned', asRead, { measure_as: 'non-budget' });
    await compile('unmarkedLegacy', unmarked(asRead), { measure_as: 'non-budget' });
    await compile('unmarked', withoutBloodlust(unmarked(asRead)), { measure_as: 'non-budget' });
    await compile('placedOwned', placed(read));
    await compile('placedUnmarked', withoutBloodlust(unmarked(placed(read))));
    const two = clone(answered);
    two.stages[0].items.useSecondWeaponSet = true;
    await compile('switched', two, { measure_as: 'non-budget' });
    // A stage measured on set 1 whose switched Wind Dancer (group 9) sits on set 2: its switch is measured with set 2 active.
    const one = clone(answered);
    one.stages[0].skills.groups[8].weaponSet = 2;
    await compile('switchedSet1', one, { measure_as: 'non-budget' });
    // Two states the file sets: Arcane Cloak's mana spent (`ifSkill`), with no Arcane Cloak in the build, and the Parry
    // debuff (`ifFlag` CanParry), which the Parry its shield grants produces; then the same without the shield and its
    // Parry group (plan group 11, the last).
    const states = clone(read);
    Object.assign(states.stages[0].config.file, { arcaneCloakUsedRecentlyCheck: true, parryActive: true });
    await compile('states', states);
    const noParry = clone(states);
    noParry.stages[0].items.slots = noParry.stages[0].items.slots.filter((x: Json) => x.slot !== 'Weapon 2');
    expect(noParry.stages[0].skills.groups[10].gems[0].name).toBe('Parry');
    noParry.stages[0].skills.groups.pop();
    await compile('statesNoParry', noParry);
    await compile('unobtainableOwned', unobtainable(read, true, true));
    await compile('unobtainableUnmarked', unobtainable(read, false, false));
    // Ten ungranted groups on PoB's nine skill slots, the tenth disabled: switched (marked) or plainly disabled.
    const lich = JSON.parse(fs.readFileSync(LICH, 'utf8')) as Json;
    lich.schemaVersion = 11;
    const plain = (name: string, enabled = true) => ({ label: name, enabled, role: 'utility', gems: [{ name, level: 1, quality: 0, enabled: true }] });
    lich.stages[0].skills.groups.push(...['Spark', 'Ice Nova', 'Frost Bomb', 'Fireball', 'Flame Wall', 'Earthquake', 'Boneshatter', 'Rolling Slam'].map((g) => plain(g)));
    const markedLich = clone(lich);
    markedLich.stages[0].skills.groups.push({ ...plain('Shield Charge', false), switch: { when: 'for bosses', off: [] } });
    lich.stages[0].skills.groups.push(plain('Shield Charge', false));
    await compile('slotsSwitched', markedLich);
    await compile('slotsDisabled', lich);
    // measure_as on a plan with no read stage: refused before the engine is asked anything.
    await compile('measureAsNoRead', lich, { measure_as: 'non-budget' });
  }, ENGINE_TIMEOUT);

  afterAll(async () => f?.close(), 60_000);

  describe('AC-W151: the read plan compiles measure-only with measure_as', () => {
    it('it compiles: compile_check measures the owned legacy gem, Bloodlust, rather than refusing it', () => {
      expect(read.stages[0].skills.groups[7].gems.map((x: Json) => x.name)).toContain('Bloodlust');
      expect(outcomes.owned.isError).toBe(false);
      expect(outcomes.owned.text).toMatch(/^Compiled .*: 1 stage \(measure-only\)/);
    });

    it('an owned unique PoB marks no longer obtainable is measured, in an item slot and in a tree socket; unmarked, each is refused (D-384)', () => {
      expect(outcomes.unobtainableOwned.isError).toBe(false);
      expect(stage('unobtainableOwned').owned).toEqual(expect.arrayContaining(['Boots', `Jewel ${read.stages[0].items.treeJewels[0].node}`]));
      expect(files.unobtainableOwned).toContain('Thunderstep');
      expect(files.unobtainableOwned).toContain('Relic of the Lost Pact');
      expect(outcomes.unobtainableUnmarked.isError).toBe(true);
      const at = outcomes.unobtainableUnmarked.text.indexOf('nothing was compiled:\n');
      expect(outcomes.unobtainableUnmarked.text.slice(at).trim().split('\n').slice(1).sort()).toEqual([
        "stage f: item in Boots: Thunderstep is no longer obtainable: PoB's unique data marks it so",
        `stage f: tree jewel on node ${read.stages[0].items.treeJewels[0].node}: Relic of the Lost Pact is no longer obtainable: PoB's unique data marks it so`,
      ]);
    });

    it('the same plan without the owned marks is refused for Bloodlust, as a design holding it is (D-384)', () => {
      expect(outcomes.unmarkedLegacy.isError).toBe(true);
      expect(outcomes.unmarkedLegacy.text).toContain('stage f: skills.groups[7].gems[1]: Bloodlust is a legacy gem: PoB marks it legacy, and it is no longer in the game');
    });

    it('no V1 finding of the four rules owned content passes; the same items without the mark fail sockets and corruption on the read stage', () => {
      expect(codes('owned').filter((c) => FOUR.includes(c))).toEqual([]);
      expect([...new Set(codes('unmarked').filter((c) => FOUR.includes(c)))].sort()).toEqual(['corruption', 'sockets']);
    });

    it('placed on the non-budget rung, owned content still passes; unmarked, its boots are under the rung\'s tier and its rares over their caps', () => {
      expect(outcomes.placedOwned.isError).toBe(false);
      expect(codes('placedOwned').filter((c) => FOUR.includes(c))).toEqual([]);
      expect([...new Set(codes('placedUnmarked').filter((c) => FOUR.includes(c)))].sort()).toEqual(['affix-cap', 'movement-tier', 'sockets']);
    });

    it('an owned item keeps the quality its text gives: the quality 10 sceptre measures its Purity of Ice at 10; unowned it is raised to 20', () => {
      expect(files.owned).toMatch(/Shrine Sceptre\n(?:Spirit: \d+\n)?Item Level: 80\nQuality: 10\n/);
      expect(purityQualities(files.owned)).toEqual(['10']);
      expect(files.unmarked).toMatch(/Shrine Sceptre\n(?:Spirit: \d+\n)?Item Level: 80\nQuality: 20\n/);
      expect(purityQualities(files.unmarked)).toEqual(['20']);
    });

    it("config.file's inputs are in the compiled file's config set as read, and no reference hit is written", () => {
      const sets = configSets(files.owned);
      const written = sets['Endgame (L90) {f}'];
      expect(written).toBeDefined();
      const want = Object.fromEntries(Object.entries(read.stages[0].config.file as Json).map(([k, v]) => [k, String(v)]));
      expect(written).toEqual(want);
      for (const h of referenceHits('non-budget', ref)) expect(written).not.toHaveProperty(h.option);
      expect(stage('owned').configWritten).toEqual(read.stages[0].config.file);
      expect(stage('owned').computedWithCustomMods).toBe(true);
    });

    it("V2's findings are callouts (from-file), and its verdict passes", () => {
      const v2 = stage('owned').v2!;
      expect(v2.findings.length).toBeGreaterThan(0);
      expect(v2.findings.every((x) => x.kind === 'from-file')).toBe(true);
      expect(v2.pass).toBe(true);
      expect(outcomes.owned.text).toMatch(/V2 pass/);
      expect(outcomes.owned.text).toMatch(/ {2}- default-unlisted \(from the file\): /);
      expect(Object.values(stage('owned').configEffective).filter((e) => e.class === 'file').length).toBe(Object.keys(read.stages[0].config.file).length);
    });

    it('measure_as on a plan with no read stage is refused, naming what it measures; nothing is written', () => {
      expect(outcomes.measureAsNoRead.isError).toBe(true);
      expect(outcomes.measureAsNoRead.text).toContain(
        'measure_as measures a read stage (one plan_from_build wrote: it names its source and has no variant), but none of the stages compiled (b) is one. Nothing was compiled.',
      );
      expect(records.measureAsNoRead).toBeUndefined();
    });

    it('the record holds the boss, resisting, Arbiter and toughness reads with no variant given: measuredAs non-budget', () => {
      expect(read.stages[0].variant).toBeUndefined();
      const s = stage('owned');
      expect(records.owned.stagesCompiled).toEqual(['f']);
      expect(s.measuredAs).toBe('non-budget');
      const m = s.measures!;
      expect(m.damage).toMatchObject({ map: expect.any(Number), boss: expect.any(Number), resisting: expect.any(Number) });
      expect(m.bossGroups?.length).toBeGreaterThan(0);
      expect(m.arbiter?.verdict).toMatch(/^(survives|one-shot)$/);
      expect(m.arbiter?.rows.length).toBeGreaterThan(0);
      expect(m.toughness?.lowestMaxHit).toMatchObject({ type: expect.any(String), value: expect.any(Number) });
      expect(m.toughness?.conditioned?.ehp).toEqual(expect.any(Number));
      expect(m.ehp).toEqual(expect.any(Number));
      expect(m.clearSpeed).toBeDefined();
      // The toughness read is at the rung's reference hits, not the file's enemy damage: its EHP is its own figure.
      expect(m.ehp).not.toBe(s.outputs.TotalEHP);
      expect(outcomes.owned.text).toMatch(/Key figures: damage \d+ against map monsters, \d+ against resisting rares, \d+ against a Pinnacle boss; .*lowest max hit \d+ \w+; .*Arbiter (survives|one-shot)/);
    });

    it("the record's owned lists every owned slot and the tree jewel; the Spirit question's figures are each buff's reservation", () => {
      const s = stage('owned');
      expect(s.owned).toEqual([...read.stages[0].items.slots.map((x: Json) => x.slot), ...read.stages[0].items.treeJewels.map((j: Json) => `Jewel ${j.node}`)]);
      expect(stage('unmarked').owned).toBeUndefined();
      expect(s.spirit).toMatchObject({ weaponSet: 1, spirit: s.outputs.Spirit, unreserved: s.outputs.SpiritUnreserved });
      expect(s.spirit!.reserved).toBe(s.outputs.Spirit - s.outputs.SpiritUnreserved);
      expect(s.spirit!.buffs.map((b) => b.skill)).toEqual(expect.arrayContaining(['Herald of Ice', 'Trinity', 'Wind Dancer', 'Combat Frenzy']));
      expect(s.spirit!.buffs.every((b) => b.reserved > 0 && Number.isInteger(b.group))).toBe(true);
    });
  });

  describe("AC-W151: V2's unproduced-state, callout (a): a state nothing in the build produces", () => {
    it("Arcane Cloak's option, with no Arcane Cloak, is a from-file callout; the Parry debuff, which the shield's Parry produces, none until the shield goes", () => {
      const callouts = (name: string) => (stage(name).v2?.findings ?? []).filter((x) => x.code === 'unproduced-state');
      expect(outcomes.states.isError).toBe(false);
      expect(outcomes.statesNoParry.isError).toBe(false);
      expect(callouts('states').map((x) => [x.data, x.kind])).toEqual([[{ option: 'arcaneCloakUsedRecentlyCheck', value: true }, 'from-file']]);
      expect(callouts('statesNoParry').map((x) => x.data)).toEqual([
        { option: 'arcaneCloakUsedRecentlyCheck', value: true },
        { option: 'parryActive', value: true },
      ]);
      expect(stage('states').v2?.pass).toBe(true);
      expect(stage('statesNoParry').v2?.pass).toBe(true);
      // The file as read sets no state PoB hides for the build.
      expect(callouts('owned')).toEqual([]);
      // A plan without a read stage gets none.
      expect((stage('slotsDisabled').v2?.findings ?? []).some((x) => x.code === 'unproduced-state')).toBe(false);
    });
  });

  describe('AC-W152: switched buffs', () => {
    it('the switched groups are written disabled and their reservation is out of the measured numbers', () => {
      const switched = answered.stages[0].skills.groups.flatMap((g: Json, k: number) => (g.switch ? [k + 1] : []));
      expect(switched).toEqual([2, 7, 9, 10]);
      const enabled = groupsEnabled(files.switched);
      for (const g of switched) expect(enabled[g - 1]).toBe(false);
      const s = stage('switched');
      expect(s.spirit!.buffs.map((b) => b.group)).toEqual([5, 6]);
      expect(s.spirit!.reserved).toBe(130);
    });

    it("the record's switches holds each one measured on weapon set 2 with its off groups off", () => {
      const s = stage('switched');
      expect(s.outputs.Spirit).toBe(200);
      expect(s.switches!.map((x) => [x.group, x.off, x.weaponSet, x.keyFigures.Spirit])).toEqual([
        [2, [], 2, 200],
        [7, [], 2, 200],
        [9, [5], 2, 200],
        [10, [], 2, 200],
      ]);
      const unreserved = Object.fromEntries(s.switches!.map((x) => [x.group, x.spiritUnreserved]));
      // Blasphemy's 76 over the 70 left; Wind Dancer's 30 with Herald of Ice's 30 off; Combat Frenzy's 30.
      expect(unreserved).toEqual({ 2: 70, 7: -6, 9: 70, 10: 40 });
      for (const x of s.switches!) expect(x.keyFigures.SpiritUnreserved).toBe(x.spiritUnreserved);
    });

    it('on a stage measured on set 1, a switched group on set 2 is measured with set 2 active, the others on set 1', () => {
      const s = stage('switchedSet1');
      expect(s.outputs.Spirit).toBe(100);
      expect(s.switches!.map((x) => [x.group, x.weaponSet, x.keyFigures.Spirit])).toEqual([
        [2, 1, 100],
        [7, 1, 100],
        [9, 2, 200],
        [10, 1, 100],
      ]);
      // Wind Dancer on set 2, Herald of Ice off for it: 200 less Trinity's 100 and Wind Dancer's 30.
      expect(s.switches!.find((x) => x.group === 9)!.spiritUnreserved).toBe(70);
      // Each pass puts the set back: the stage's own measure stays set 1's.
      expect(s.outputsSet2?.Spirit).toBe(200);
    });

    it('V1 reports switched-spirit for the switch that leaves Spirit below 0, and nothing for those that fit', () => {
      const found = (stage('switched').v1?.findings ?? []).filter((x) => x.code === 'switched-spirit');
      expect(found.map((x) => x.data)).toEqual([{ group: 7, off: [], set: 2, spiritUnreserved: -6, path: 'skills.groups[6].switch' }]);
    });

    it('a switched group is marked for the recount: ten ungranted groups give the skill-slot warning only when the tenth is switched', () => {
      expect(outcomes.slotsSwitched.isError).toBe(false);
      expect(outcomes.slotsDisabled.isError).toBe(false);
      expect(codes('slotsSwitched')).toContain('skill-slots');
      expect((stage('slotsSwitched').v1?.findings ?? []).find((x) => x.code === 'skill-slots')?.data).toMatchObject({ allowed: 9, groups: 10 });
      expect(codes('slotsDisabled')).not.toContain('skill-slots');
      expect(stage('slotsSwitched').switches?.map((x) => x.group)).toEqual([10]);
    });

    it('a stage without switch or owned content gets none of the record\'s new fields', () => {
      const s = stage('slotsDisabled') as unknown as Json;
      for (const k of ['switches', 'owned', 'measuredAs', 'spirit']) expect(s).not.toHaveProperty(k);
      expect((s.v2.findings as Json[]).every((x) => x.kind === undefined)).toBe(true);
    });
  });
});
