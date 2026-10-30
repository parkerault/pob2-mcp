/**
 * WU-128 (amendment 13; AC-P87, AC-P88 and AC-P89's schema rows): plan schema 9 through `validatePlan`, the compile's own
 * validation (FR-P1, D-163). The engine rows are `tests/integration/compileSchema9*.test.ts`.
 *
 * Appendix A's plan (schema 9):
 * - `items.slots[]`: `{slot, text}` as before, or `{slot: "Weapon 1 Swap", sameAs: "Weapon 1"}` /
 *   `{slot: "Weapon 2 Swap", sameAs: "Weapon 2"}`; `sameAs` names a slot the stage fills with `text` (D-464);
 * - a skill gem: `{name, level, quality, enabled, corrupt?: "plus_one_level"}` (D-471);
 * - `stages[].tree.start?` and `stages[].tree.end?`: `{ehp, lowestMaxHit: {type, value}, life, boss: <number> | null,
 *   bossEntries: [{group, label, figure}]}`; `stages[].tree.search?`: `{swaps, lastGain: <percent> | null, capHit,
 *   rebuild: "taken" | "none" | "undone: <why>", removed: [{names, skill}], bossFall: <reason> | null}` (D-467, D-468);
 * - a schema-9 custom modifier's `reason` is required and holds no line break (D-469).
 * Each errs at its own path on a schema-8 plan (D-320, D-332), and a schema-8 plan's custom modifiers keep their optional,
 * free reason.
 */
import fs from 'fs';
import path from 'path';
import { describe, expect, it } from '@jest/globals';
import { loadReferenceData } from '../../src/plan/referenceData';
import { GEM_CORRUPTIONS, MAX_HIT_TYPES, PINNED_SLOTS, PLAN_SCHEMA_VERSIONS, validatePlan, type PlanError } from '../../src/plan/schema';

type Json = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
const REPO = path.resolve(__dirname, '..', '..');
const ref = loadReferenceData(path.join(REPO, 'data'));
const TWO_STAGE = path.join(REPO, 'tests', 'fixtures', 'plans', 'two-stage', 'plan.json');
const judgment = (r: string) => ({ kind: 'judgment', ref: r, confidence: 'L' });

const CLUB = 'Rarity: Normal\nWooden Club';
const SHIELD = 'Rarity: Normal\nSplintered Tower Shield';
const MACE = 'Rarity: Normal\nSlim Mace';

/** The two-stage fixture at `version`, with the endgame ladder's `m`, `b` and `n` after it (stage 2's content). */
function plan(version: number): Json {
  const p = JSON.parse(fs.readFileSync(TWO_STAGE, 'utf8')) as Json;
  p.schemaVersion = version;
  for (const [id, variant, level] of [
    ['m', 'entering-maps', 70],
    ['b', 'budget', 80],
    ['n', 'non-budget', 90],
  ] as const) {
    const s = JSON.parse(JSON.stringify(p.stages[1]));
    Object.assign(s, {
      id,
      loadoutName: `${variant} (L${level}) {${id}}`,
      level,
      progress: 'endgame',
      variant,
      ascendancyPoints: 0,
      variantBasis: { level: judgment('t'), gemLevels: judgment('t'), ascendancyPoints: judgment('t') },
      claims: [],
    });
    p.stages.push(s);
  }
  return p;
}

/** `n` (stages[4]) with weapons on both sets: a club and a shield on set 1, a mace on set 2, and `extra` entries. */
function weapons(p: Json, ...extra: Json[]): Json {
  const n = p.stages[4];
  n.items.slots = [
    { slot: 'Weapon 1', text: CLUB },
    { slot: 'Weapon 2', text: SHIELD },
    { slot: 'Weapon 1 Swap', text: MACE },
    ...extra,
    ...n.items.slots.filter((e: Json) => !e.slot.startsWith('Weapon')),
  ];
  return p;
}

const FIGURES = {
  ehp: 21000,
  lowestMaxHit: { type: 'physical', value: 4100 },
  life: 3138,
  boss: 380000,
  bossEntries: [
    { group: 1, label: 'Boneshatter', figure: 300000 },
    { group: 2, label: 'Rolling Slam', figure: 80000 },
  ],
};
const SEARCH = {
  swaps: 30,
  lastGain: 1.4,
  capHit: true,
  rebuild: 'undone: the compile refused it (attributes)',
  removed: [{ names: ['Herald Damage', 'Heraldry'], skill: 'Herald of Blood' }],
  bossFall: 'Rolling Slam gives up 5% for 8% more Boneshatter on the clear',
};

function errorsOf(input: unknown): PlanError[] {
  const r = validatePlan(input, ref);
  return r.ok ? [] : r.errors;
}

describe('WU-128: plan schema 9 (Appendix A)', () => {
  it('schema 9 is the current version; 1 to 8 stay accepted', () => {
    expect([...PLAN_SCHEMA_VERSIONS]).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect(errorsOf(plan(9))).toEqual([]);
    expect(errorsOf({ ...plan(9), schemaVersion: 10 })).toEqual([
      { path: 'schemaVersion', message: 'schemaVersion is 10; the accepted versions are [1, 2, 3, 4, 5, 6, 7, 8, 9]' },
    ]);
  });

  describe('§5 (D-464): the pinned weapon, sameAs', () => {
    it('Appendix A: the two pairs are Weapon 1 Swap → Weapon 1 and Weapon 2 Swap → Weapon 2', () => {
      expect(PINNED_SLOTS).toEqual({ 'Weapon 1 Swap': 'Weapon 1', 'Weapon 2 Swap': 'Weapon 2' });
    });

    it('AC-P87: {slot: "Weapon 2 Swap", sameAs: "Weapon 2"} and {slot: "Weapon 1 Swap", sameAs: "Weapon 1"} are accepted on schema 9, kept as written', () => {
      const p = weapons(plan(9), { slot: 'Weapon 2 Swap', sameAs: 'Weapon 2' });
      const r = validatePlan(p, ref);
      expect(r.ok ? r.plan.stages[4].items.slots.find((s) => s.slot === 'Weapon 2 Swap') : r.errors).toEqual({ slot: 'Weapon 2 Swap', sameAs: 'Weapon 2' });
      const one = plan(9);
      one.stages[4].items.slots = [{ slot: 'Weapon 1', text: CLUB }, { slot: 'Weapon 1 Swap', sameAs: 'Weapon 1' }];
      expect(errorsOf(one)).toEqual([]);
    });

    it('AC-P87: sameAs on Helmet errs at its path', () => {
      const p = weapons(plan(9));
      p.stages[4].items.slots.push({ slot: 'Helmet', sameAs: 'Weapon 1' });
      const errors = errorsOf(p);
      const at = p.stages[4].items.slots.length - 1;
      expect(errors.map((e) => e.path)).toEqual([`stages[4].items.slots[${at}].sameAs`]);
      expect(errors[0].message).toMatch(/sameAs is allowed only on Weapon 1 Swap \(naming Weapon 1\) and Weapon 2 Swap \(naming Weapon 2\); this is Helmet/);
    });

    it('AC-P87: naming Weapon 1 from Weapon 2 Swap errs at its path', () => {
      const p = weapons(plan(9), { slot: 'Weapon 2 Swap', sameAs: 'Weapon 1' });
      const errors = errorsOf(p);
      expect(errors.map((e) => e.path)).toEqual(['stages[4].items.slots[3].sameAs']);
      expect(errors[0].message).toMatch(/Weapon 2 Swap shares only Weapon 2's item, its own set-1 slot; it names Weapon 1/);
    });

    it('AC-P87: naming an empty slot errs at its path', () => {
      const p = plan(9);
      p.stages[4].items.slots = [{ slot: 'Weapon 1', text: CLUB }, { slot: 'Weapon 2 Swap', sameAs: 'Weapon 2' }];
      const errors = errorsOf(p);
      expect(errors.map((e) => e.path)).toEqual(['stages[4].items.slots[1].sameAs']);
      expect(errors[0].message).toMatch(/sameAs names Weapon 2, which the stage leaves empty/);
    });

    it('AC-P87: sameAs on a schema-8 plan errs at its path, naming schema 9', () => {
      const p = weapons(plan(8), { slot: 'Weapon 2 Swap', sameAs: 'Weapon 2' });
      const errors = errorsOf(p);
      expect(errors.map((e) => e.path)).toEqual(['stages[4].items.slots[3].sameAs']);
      expect(errors[0].message).toMatch(/needs schemaVersion 9 or later; this plan declares schemaVersion 8/);
    });

    it('§5: an entry holds text or sameAs: both, or neither, errs at its path', () => {
      const both = weapons(plan(9), { slot: 'Weapon 2 Swap', text: SHIELD, sameAs: 'Weapon 2' });
      expect(errorsOf(both).map((e) => e.path)).toEqual(['stages[4].items.slots[3].sameAs']);
      const neither = weapons(plan(9), { slot: 'Weapon 2 Swap' });
      expect(errorsOf(neither).map((e) => e.path)).toEqual(['stages[4].items.slots[3].text']);
      // A schema-8 slot without text errs at its text, as before.
      const old = plan(8);
      delete old.stages[1].items.slots[0].text;
      expect(errorsOf(old).map((e) => e.path)).toEqual(['stages[1].items.slots[0].text']);
    });
  });

  describe('§12 (D-471): a gem\'s corrupt', () => {
    it('Appendix A: plus_one_level is the one corruption', () => {
      expect([...GEM_CORRUPTIONS]).toEqual(['plus_one_level']);
    });

    it('AC-P89: corrupt is accepted on schema 9 and kept; another value errs at its path', () => {
      const p = plan(9);
      p.stages[4].skills.groups[0].gems[0].corrupt = 'plus_one_level';
      const r = validatePlan(p, ref);
      expect(r.ok ? r.plan.stages[4].skills.groups[0].gems[0].corrupt : r.errors).toBe('plus_one_level');
      p.stages[4].skills.groups[0].gems[0].corrupt = 'minus_one_level';
      expect(errorsOf(p).map((e) => e.path)).toEqual(['stages[4].skills.groups[0].gems[0].corrupt']);
    });

    it('AC-P89: corrupt on a schema-8 plan errs at its path', () => {
      const p = plan(8);
      p.stages[4].skills.groups[1].gems[0].corrupt = 'plus_one_level';
      const errors = errorsOf(p);
      expect(errors.map((e) => e.path)).toEqual(['stages[4].skills.groups[1].gems[0].corrupt']);
      expect(errors[0].message).toMatch(/a gem's corruption, corrupt \(D-471\) needs schemaVersion 9 or later/);
    });
  });

  describe('§8, §9 (D-467, D-468): tree.start, tree.end and tree.search', () => {
    it('AC-P89: they are accepted on schema 9, kept as written', () => {
      const p = plan(9);
      Object.assign(p.stages[4].tree, { start: FIGURES, end: { ...FIGURES, boss: null, bossEntries: [] }, search: SEARCH });
      const r = validatePlan(p, ref);
      expect(r.ok ? [r.plan.stages[4].tree.start, r.plan.stages[4].tree.end, r.plan.stages[4].tree.search] : r.errors).toEqual([
        FIGURES,
        { ...FIGURES, boss: null, bossEntries: [] },
        SEARCH,
      ]);
    });

    it('AC-P89: each errs at its path on a schema-8 plan', () => {
      const p = plan(8);
      Object.assign(p.stages[3].tree, { start: FIGURES, end: FIGURES, search: SEARCH });
      const errors = errorsOf(p);
      expect(errors.map((e) => e.path)).toEqual(['stages[3].tree.start', 'stages[3].tree.end', 'stages[3].tree.search']);
      for (const e of errors) expect(e.message).toMatch(/needs schemaVersion 9 or later; this plan declares schemaVersion 8/);
    });

    it('Appendix A: the figures and the search are strict; the rebuild is taken, none or "undone: <why>"; a max hit names one of the five types', () => {
      expect([...MAX_HIT_TYPES]).toEqual(['physical', 'fire', 'cold', 'lightning', 'chaos']);
      for (const rebuild of ['taken', 'none', 'undone: a V1 finding (attributes)']) {
        const p = plan(9);
        p.stages[4].tree.search = { ...SEARCH, rebuild };
        expect({ rebuild, errors: errorsOf(p) }).toEqual({ rebuild, errors: [] });
      }
      const cases: [string, (t: Json) => void, string][] = [
        ['a rebuild outside the three forms', (t) => (t.search = { ...SEARCH, rebuild: 'undone' }), 'stages[4].tree.search.rebuild'],
        ['a lowest max hit of an unknown type', (t) => (t.start = { ...FIGURES, lowestMaxHit: { type: 'elemental', value: 1 } }), 'stages[4].tree.start.lowestMaxHit.type'],
        ['no life', (t) => (t.end = { ...FIGURES, life: undefined }), 'stages[4].tree.end.life'],
        ['an unknown key', (t) => (t.start = { ...FIGURES, mana: 100 }), 'stages[4].tree.start'],
        ['a boss entry without a label', (t) => (t.start = { ...FIGURES, bossEntries: [{ group: 1, figure: 1 }] }), 'stages[4].tree.start.bossEntries[0].label'],
        ['negative swaps', (t) => (t.search = { ...SEARCH, swaps: -1 }), 'stages[4].tree.search.swaps'],
        ['a removed entry naming no passive', (t) => (t.search = { ...SEARCH, removed: [{ names: [], skill: 'x' }] }), 'stages[4].tree.search.removed[0].names'],
        ['an empty bossFall', (t) => (t.search = { ...SEARCH, bossFall: '' }), 'stages[4].tree.search.bossFall'],
      ];
      for (const [what, edit, at] of cases) {
        const p = plan(9);
        edit(p.stages[4].tree);
        expect({ what, paths: errorsOf(JSON.parse(JSON.stringify(p))).map((e) => e.path) }).toEqual({ what, paths: [at] });
      }
    });
  });

  describe('§10 (D-469): the custom modifier reason', () => {
    const LINE = { text: '10% more Damage', reason: "PoB doesn't apply the aggravation; 10% more damage stands in for it" };

    it('AC-P88: on schema 9 a customMods entry with no reason errs at its path', () => {
      const p = plan(9);
      p.stages[3].config.customMods = [LINE, { text: '+10 to maximum Life' }];
      const errors = errorsOf(p);
      expect(errors.map((e) => e.path)).toEqual(['stages[3].config.customMods[1].reason']);
      expect(errors[0].message).toMatch(/a schema-9 custom modifier gives its reason: the compiler writes it as the comment line "# <reason>" before the line \(D-469\)/);
    });

    it('AC-P88: on schema 9 a reason holding a line break errs at its path', () => {
      for (const reason of ['first line\nsecond line', 'a reason\r\n']) {
        const p = plan(9);
        p.stages[3].config.customMods = [{ text: '10% more Damage', reason }];
        expect(errorsOf(p).map((e) => e.path)).toEqual(['stages[3].config.customMods[0].reason']);
      }
    });

    it('§22: a schema-8 plan keeps the optional reason (V1\'s missing-reason), line breaks and all', () => {
      const p = plan(8);
      p.stages[3].config.customMods = [{ text: '10% more Damage' }, { text: '+10 to maximum Life', reason: 'two\nlines' }];
      expect(errorsOf(p)).toEqual([]);
      const nine = plan(9);
      nine.stages[3].config.customMods = [LINE];
      expect(errorsOf(nine)).toEqual([]);
    });
  });
});
