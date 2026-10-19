/**
 * WU-87 (amendment 8 §4, D-402): the beast library, through `compile_plan`, in process and engine-required.
 *
 * A tamed rare beast is a companion: the Tame Beast gem, once it captures a beast, summons it, and the beast keeps up to
 * four of its rare monster modifiers. A plan (schema version 5) names the beast on a stage, `companion {species, mods}`,
 * and holds the Tame Beast gem in a group. The compile sets PoB's beast library from the species, so PoB summons that
 * monster and measures its damage and its Spirit cost, a percentage of the player's Spirit (`companionReservation`), and
 * writes each kept modifier as its row of `data/monsters/monster-mods.md` says: `stats` lines as custom modifiers
 * (estimates), a `condition` as its config option, `none` as nothing.
 *
 * The plans are written here from the committed `minion-wolf` fixture (its level-80 Warrior tree and Wooden Club) and
 * the game data's names: "Earthquake" and "Tame Beast" (`Data/Gems.lua`), the Diretusk Boar
 * (`Metadata/Monsters/GoreCharger/GoreCharger`, a `monsterCategory = "Beast"` monster of `Data/Spectres.lua`, whose
 * `companionReservation` the test reads from the pin), and the table's rows. The server runs in process over private
 * folders (`startSessionFixture`).
 *
 * - AC-P72 (D-402): a plan naming a companion species compiles, and the record holds the companion's DPS and its
 *   reserved Spirit, the species' percentage of the player's Spirit: two Spirit totals give two reservations in that
 *   ratio; a kept `stats` modifier (Hasted, Haste Aura) reaches the stage's custom modifiers marked as an estimate; a
 *   `condition` modifier (Trail of Ice) sets its config option; a plan without a companion compiles as before.
 * - D-402's other rules: a `none` modifier adds nothing and the record says so, as for a `stats` line PoB can't parse;
 *   the saved build carries PoB's beast library; an unknown species, a name several beasts share and a stage without
 *   the Tame Beast gem are refused before any engine change, by `compile_plan` and by `guide_run`'s validate mode.
 */
import fs from 'fs';
import path from 'path';
import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import { engineDescribe } from '../helpers/engine';
import { startSessionFixture, type SessionFixture } from '../helpers/engineSession';
import { resolvePobSrc } from '../../src/engine/pobPath';
import type { CompileRecord } from '../../src/plan/record';

const REPO = path.resolve(__dirname, '..', '..');
const ENGINE_TIMEOUT = 300_000;
const BOAR = 'Metadata/Monsters/GoreCharger/GoreCharger';

type Json = Record<string, any>;

const gem = (name: string) => ({ name, level: 20, quality: 0, enabled: true });

/** The Diretusk Boar's name and Spirit percentage in the pin's `Data/Spectres.lua`. */
function boarData(): { name: string; percent: number; beast: boolean } {
  const text = fs.readFileSync(path.join(resolvePobSrc(process.env), 'Data', 'Spectres.lua'), 'utf8');
  const at = text.indexOf(`minions["${BOAR}"] = {`);
  expect(at).toBeGreaterThan(0);
  const block = text.slice(at, text.indexOf('\n}\n', at));
  return {
    name: /\n\tname = "([^"]+)",/.exec(block)![1],
    percent: Number(/\n\tcompanionReservation = ([\d.]+),/.exec(block)![1]),
    beast: block.includes('monsterCategory = "Beast"'),
  };
}

/**
 * One endgame stage from the `minion-wolf` fixture: Earthquake as its clear, main and rolled group, a Tame Beast gem in
 * a second group, and `spirit` added Spirit as a custom modifier (two totals for the reservation's ratio). With
 * `companion`, the stage names its beast.
 */
function stage(id: string, spirit: number, companion?: Json): Json {
  const p = JSON.parse(fs.readFileSync(path.join(REPO, 'tests', 'fixtures', 'plans', 'minion-wolf', 'plan.json'), 'utf8')) as Json;
  const s = p.stages[0];
  delete s.variant;
  delete s.ascendancyPoints;
  delete s.variantBasis;
  s.id = id;
  s.loadoutName = `Stage ${id} (L${s.level}) {${id}}`;
  s.skills = {
    groups: [
      { label: 'Earthquake', enabled: true, role: 'clear', gems: [gem('Earthquake')] },
      { label: 'Beast', enabled: true, role: 'utility', gems: [gem('Tame Beast')] },
    ],
    main: { group: 1, activeSkill: 1 },
    rolledGroup: 1,
  };
  s.config.customMods = [{ text: `+${spirit} to Spirit`, reason: 'test: a Spirit total for the reservation ratio' }];
  if (companion !== undefined) s.companion = companion;
  return s;
}

/** A plan of `stages` at `version`, from the fixture's roll and versions. */
function plan(stages: Json[], version = 5): Json {
  const p = JSON.parse(fs.readFileSync(path.join(REPO, 'tests', 'fixtures', 'plans', 'minion-wolf', 'plan.json'), 'utf8')) as Json;
  p.schemaVersion = version;
  p.roll.skill = 'Earthquake';
  p.stages = stages;
  p.ledger = [];
  return p;
}

engineDescribe('WU-87: the beast library (D-402)', () => {
  let f: SessionFixture;
  let beasts: { record: CompileRecord; xml: string };
  let plain4: { record: CompileRecord; xml: string };
  let plain5: { record: CompileRecord; xml: string };
  const boar = boarData();

  /** Write `p` into a new run and compile it measure-only; the outcome, and the record and XML when it compiled. */
  async function compile(slug: string, p: Json) {
    const made = await f.call('guide_run', { new_run: slug });
    if (made.isError) throw new Error(`guide_run failed: ${made.text}`);
    const abs = /^Created run folder (.+)$/m.exec(made.text)![1];
    const planPath = /^plan_path for this run: (\S+)$/m.exec(made.text)![1];
    fs.writeFileSync(path.join(f.guides, planPath), `${JSON.stringify(p, null, 2)}\n`);
    const out = await f.call('compile_plan', { plan_path: planPath, measure_only: true });
    if (out.isError) return { out, planPath, record: null, xml: null };
    return {
      out,
      planPath,
      record: JSON.parse(fs.readFileSync(path.join(abs, 'compile-record.json'), 'utf8')) as CompileRecord,
      xml: fs.readFileSync(path.join(abs, 'compiled-build.xml'), 'utf8'),
    };
  }

  async function compiled(slug: string, p: Json) {
    const r = await compile(slug, p);
    expect({ isError: r.out.isError, text: r.out.isError ? r.out.text : '' }).toEqual({ isError: false, text: '' });
    return { record: r.record!, xml: r.xml! };
  }

  beforeAll(async () => {
    f = await startSessionFixture();
    beasts = await compiled(
      'p72-beasts',
      plan([
        stage('a', 100, { species: 'Diretusk Boar', mods: ['hasted', 'haste-aura', 'trail-of-ice', 'temporal-bubble'] }),
        stage('b', 300, { species: BOAR, mods: ['additional-projectiles'] }),
      ]),
    );
    plain4 = await compiled('p72-plain4', plan([stage('a', 100)], 4));
    plain5 = await compiled('p72-plain5', plan([stage('a', 100)], 5));
  }, ENGINE_TIMEOUT);

  afterAll(async () => f?.close(), 60_000);

  describe('AC-P72 (D-402)', () => {
    it('a plan naming a companion species compiles, and the record holds the beast PoB summons with its DPS', () => {
      expect(boar).toMatchObject({ name: 'Diretusk Boar', beast: true });
      const c = beasts.record.stages.a.companion!;
      expect(c).toMatchObject({ species: 'Diretusk Boar', monster: boar.name, monsterId: BOAR, group: 2, activeSkill: 1, key: 'g2s1p1' });
      // The DPS is the companion skill's own breakdown entry, its minion's MinionTotalDPS (D-376).
      const entry = beasts.record.stages.a.skillOutputs.g2s1p1;
      expect(entry.fields.MinionTotalDPS).toBeGreaterThan(0);
      expect(c.dps).toBe(entry.fields.MinionTotalDPS);
      // The second stage names the same beast by its monster id.
      expect(beasts.record.stages.b.companion).toMatchObject({ species: BOAR, monster: boar.name, monsterId: BOAR });
    });

    it("the reserved Spirit is the species' percentage of the player's Spirit: two Spirit totals give two reservations in that ratio", () => {
      const a = beasts.record.stages.a.companion!;
      const b = beasts.record.stages.b.companion!;
      for (const c of [a, b]) {
        expect(c.speciesReservationPercent).toBe(boar.percent);
        // No reservation modifier in the build: PoB reserves the species' percentage as it is.
        expect(c.reservedSpiritPercent).toBe(boar.percent);
        expect(c.reservedSpirit).toBe(Math.ceil((c.spirit! * boar.percent) / 100));
      }
      expect(a.spirit).toBe(beasts.record.stages.a.outputs.Spirit);
      expect(b.spirit! - a.spirit!).toBe(200);
      // A flat-cost minion would reserve the same at both totals; the beast's reservation follows the Spirit total.
      expect(b.reservedSpirit / a.reservedSpirit).toBeCloseTo(b.spirit! / a.spirit!, 1);
      expect(b.reservedSpirit).toBeGreaterThan(a.reservedSpirit);
    });

    it("a kept stats modifier reaches the stage's custom modifiers, marked as an estimate: Hasted on the beast, Haste Aura on its allies", () => {
      const s = beasts.record.stages.a;
      const hasted = ['Companions have 30% increased Movement Speed', 'Companions have 30% increased Attack and Cast Speed'];
      const aura = ['20% increased Attack Speed', '20% increased Cast Speed', '10% increased Movement Speed'];
      const auraLines = aura.flatMap((l) => [l, `Minions have ${l}`]);
      expect(s.customModsWritten).toEqual(['+100 to Spirit', ...hasted, ...auraLines]);
      expect(s.computedWithCustomMods).toBe(true);
      const [h, ha] = s.companion!.mods;
      expect(h).toMatchObject({ id: 'hasted', model: 'stats', applied: 'custom-modifiers', estimate: true });
      expect(h.lines).toEqual(hasted.map((text) => ({ text, reaches: 'companion', written: true })));
      expect(ha).toMatchObject({ id: 'haste-aura', model: 'stats', applied: 'custom-modifiers', estimate: true });
      expect(ha.lines!.map((l) => l.reaches)).toEqual(['player', 'minions', 'player', 'minions', 'player', 'minions']);
      // V1 finds each line's reason: the compile writes one per line.
      expect(s.v1!.findings.filter((x) => x.code === 'missing-reason')).toEqual([]);
      // The lines reach the beast: stage a's boar has Hasted's 30% and Haste Aura's 20% increased attack speed (its
      // Minions line), stage b's the same boar at the same gem level without them, so it attacks 1.5 times as fast.
      const speed = (id: 'a' | 'b') => beasts.record.stages[id].skillOutputs.g2s1p1.fields.MinionSpeed;
      expect(speed('a') / speed('b')).toBeCloseTo(1.5, 2);
      expect(s.companion!.dps!).toBeGreaterThan(beasts.record.stages.b.companion!.dps!);
    });

    it('a condition modifier sets its config option: Trail of Ice puts the enemy on Chilled Ground, as earned state the Tame Beast produces', () => {
      const s = beasts.record.stages.a;
      expect(s.configWritten.conditionEnemyOnChilledGround).toBe(true);
      expect(s.configEffective.conditionEnemyOnChilledGround).toEqual({ value: true, origin: 'explicit', class: 'earned' });
      expect(s.companion!.mods[2]).toMatchObject({ id: 'trail-of-ice', model: 'condition', applied: 'config', option: 'conditionEnemyOnChilledGround' });
      // The producer is the captured Tame Beast, which PoB names "Companion: <beast>": present, so no V2 finding.
      expect(s.v2!.findings.filter((x) => String(x.data?.option) === 'conditionEnemyOnChilledGround')).toEqual([]);
      // Stage b keeps no condition modifier, so its config doesn't list the option.
      expect(beasts.record.stages.b.configWritten.conditionEnemyOnChilledGround).toBeUndefined();
    });

    it('a plan without a companion compiles as before: no companion in the record, the Tame Beast gem uncaptured, the same figures as a version-4 plan', () => {
      for (const r of [plain4, plain5]) {
        const s = r.record.stages.a;
        expect(s.companion).toBeUndefined();
        expect(s.customModsWritten).toEqual(['+100 to Spirit']);
        expect(s.skillOutputs.g2s1p1?.fields.MinionTotalDPS).toBeUndefined();
        expect(r.xml).not.toMatch(/<BeastCompanion\b/);
        expect(r.xml).toMatch(/nameSpec="Tame Beast"/);
      }
      expect(plain5.record.stages.a.outputs).toEqual(plain4.record.stages.a.outputs);
      expect(plain5.record.stages.a.outputs.SpiritReserved ?? 0).toBe(0);
    });
  });

  describe("D-402's other rules", () => {
    it('a none modifier adds nothing, and the record says so; so does a stats line PoB cannot parse whole', () => {
      const none = beasts.record.stages.a.companion!.mods[3];
      expect(none).toMatchObject({ id: 'temporal-bubble', model: 'none', applied: 'nothing' });
      expect(none.how).toMatch(/model is none/);
      const b = beasts.record.stages.b;
      const projectiles = b.companion!.mods[0];
      expect(projectiles).toMatchObject({ id: 'additional-projectiles', model: 'stats', applied: 'nothing' });
      expect(projectiles.lines).toEqual([{ text: 'Companions have Skills fire 4 additional Projectiles', reaches: 'companion', written: false }]);
      expect(b.customModsWritten).toEqual(['+300 to Spirit']);
    });

    it("the saved build carries PoB's beast library, and the stages share one skill set with the captured gem", () => {
      expect(beasts.xml.match(/<BeastCompanion id="([^"]+)"/g)).toEqual([`<BeastCompanion id="${BOAR}"`]);
      expect(beasts.xml).toMatch(new RegExp(`skillMinion="${BOAR.replace(/\//g, '\\/')}"`));
      const skillSets = beasts.record.sets.filter((x) => x.kind === 'skill');
      expect(skillSets).toEqual([expect.objectContaining({ stages: ['a', 'b'] })]);
    });

    it('an unknown species, a name several beasts share and a stage without the Tame Beast gem are refused, nothing compiled', async () => {
      const unknown = await compile('p72-unknown', plan([stage('a', 100, { species: 'Diretusk', mods: [] })]));
      expect(unknown.out.isError).toBe(true);
      expect(unknown.out.text).toMatch(/stage a: companion\.species "Diretusk": no beast of PoB's beast library is named "Diretusk"\. Did you mean: Diretusk Boar/);
      // guide_run's validate mode checks the companion as the compile does.
      const validated = await f.call('guide_run', { validate: unknown.planPath });
      expect(validated.isError).toBe(true);
      expect(validated.text).toMatch(/stage a: companion\.species "Diretusk": no beast of PoB's beast library is named "Diretusk"/);
      const shared = await compile('p72-shared', plan([stage('a', 100, { species: 'Quill Crab', mods: [] })]));
      expect(shared.out.isError).toBe(true);
      expect(shared.out.text).toMatch(/companion\.species "Quill Crab": PoB's beast library has 2 beasts named "Quill Crab"; name one by its monster id: Metadata\/Monsters\/QuillCrab\//);
      const s = stage('a', 100, { species: 'Diretusk Boar', mods: [] });
      s.skills.groups = s.skills.groups.slice(0, 1);
      const gemless = await compile('p72-gemless', plan([s]));
      expect(gemless.out.isError).toBe(true);
      expect(gemless.out.text).toMatch(/stage a: companion: no group holds the Tame Beast gem/);
    });
  });
});
