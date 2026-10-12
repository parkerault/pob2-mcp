/**
 * WU-38: the plan schema (C-30, C-31, C-32; slice 2 §3.2) through `validatePlan`.
 *
 * - AC-P8: the two-stage fixture validates, and the worked example in `docs/build-guide/plan-reference.md`
 *   is the fixture.
 * - AC-P10 (D-163): the fixture with one change gives `ok:false` with an error at exactly the change's
 *   JSON path. Where a change also breaks a rule that depends on the changed field, the extra paths are
 *   listed with the row (`also`), and no other path may appear.
 * - D-320, D-332 (WU-61): the schema accepts versions 1 and 2; a version-1 plan has the version-1 shape.
 * - AC-P60 (WU-65; D-351, D-358): version 3 adds `claims[].kind` and `items.anoint`, allowed on the `b` and `n`
 *   rungs only; versions 1 and 2 stay accepted, each use of a version-3 field in them an error at its path.
 */
import fs from 'fs';
import path from 'path';
import { describe, expect, it } from '@jest/globals';
import { z } from 'zod';
import { validatePlan, type PlanError } from '../../src/plan/schema';
import { refineSourceTag, sourceTagObject, sourceTagSchema, sourceTagWith } from '../../src/plan/sourceTag';

const REPO = path.resolve(__dirname, '..', '..');
const FIXTURE_PATH = path.join(REPO, 'tests', 'fixtures', 'plans', 'two-stage', 'plan.json');
const FIXTURE_TEXT = fs.readFileSync(FIXTURE_PATH, 'utf8');
const REFERENCE = fs.readFileSync(path.join(REPO, 'docs', 'build-guide', 'plan-reference.md'), 'utf8');

type Json = any;

/** A fresh, mutable copy of the fixture. */
const fixture = (): Json => JSON.parse(FIXTURE_TEXT);

const judgment = (ref: string) => ({ kind: 'judgment', ref, confidence: 'M' });
const variantFields = () => ({
  variant: 'budget',
  ascendancyPoints: 2,
  variantBasis: { level: judgment('a'), gemLevels: judgment('b'), ascendancyPoints: judgment('c') },
});

function errorsOf(input: unknown): PlanError[] {
  const r = validatePlan(input);
  if (r.ok) throw new Error('expected ok:false, got ok:true');
  return r.errors;
}

describe('AC-P8 (WU-38): the fixture and the worked example', () => {
  it('AC-P8: validatePlan accepts the two-stage fixture, as text and as a parsed value', () => {
    const fromText = validatePlan(FIXTURE_TEXT);
    expect(fromText.ok ? 'ok' : fromText.errors).toBe('ok');
    const fromValue = validatePlan(fixture());
    expect(fromValue.ok ? 'ok' : fromValue.errors).toBe('ok');
    if (fromValue.ok) expect(fromValue.plan).toEqual(fixture());
  });

  it('AC-P8: the json block under "Worked example" in plan-reference.md parses and deep-equals the fixture', () => {
    const at = REFERENCE.search(/^## Worked example$/m);
    expect(at).toBeGreaterThanOrEqual(0);
    const block = /```json\n([\s\S]*?)```/.exec(REFERENCE.slice(at));
    expect(block).not.toBeNull();
    expect(JSON.parse(block![1])).toEqual(fixture());
  });

  it('AC-P8: the fixture has what WU-38 requires of it', () => {
    const p = fixture();
    const [s1, s2] = p.stages;
    expect(p.stages).toHaveLength(2);
    expect([s1.id, s2.id]).toEqual(['1', '2']);
    expect(s1.progress).toMatch(/^q\.act-1-/);
    expect(s2.level).toBeGreaterThan(s1.level);
    expect(s2.tree.nodes).toEqual(expect.arrayContaining(s1.tree.nodes));
    expect(s2.items).toEqual(s1.items);
    expect(s2.skills).not.toEqual(s1.skills);
    expect(p.ledger).toHaveLength(1);
    expect(p.ledger[0].formula).toMatch(/\b1\./);
    expect(p.ledger[0].formula).toMatch(/\b2\./);
    expect(p.prices.map((x: Json) => x.status).sort()).toEqual(['ok', 'unavailable']);
    const sources = p.stages.flatMap((s: Json) => s.claims.map((c: Json) => c.source));
    const kinds = new Set(sources.filter((s: Json) => typeof s === 'object').map((s: Json) => s.kind));
    expect([...kinds].sort()).toEqual(['external', 'external-unavailable', 'judgment', 'pob-computed', 'pob-data']);
    const forms = new Set(sources.filter((s: Json) => typeof s === 'string').map((s: string) => s.split(':')[0]));
    expect([...forms].sort()).toEqual(['data', 'ledger', 'price']);
  });
});

interface Row {
  change: string;
  input: () => unknown;
  path: string;
  /** Paths the change also breaks through a dependent rule; nothing else may err. */
  also?: string[];
  message?: RegExp;
}

const ROWS: Row[] = [
  {
    change: 'schemaVersion: 4',
    input: () => ({ ...fixture(), schemaVersion: 4 }),
    path: 'schemaVersion',
    message: /\[1, 2, 3\]/,
  },
  {
    change: 'ledger removed',
    input: () => {
      const p = fixture();
      delete p.ledger;
      return p;
    },
    path: 'ledger',
  },
  { change: 'an unknown top-level key foo', input: () => ({ ...fixture(), foo: 1 }), path: '$', message: /foo/ },
  { change: "text that isn't JSON", input: () => FIXTURE_TEXT.slice(0, 40), path: '$', message: /JSON/ },
  {
    change: 'stages[1].level: 0',
    input: () => {
      const p = fixture();
      p.stages[1].level = 0;
      return p;
    },
    path: 'stages[1].level',
  },
  {
    change: 'stages[0].id: "a b"',
    input: () => {
      const p = fixture();
      p.stages[0].id = 'a b';
      return p;
    },
    path: 'stages[0].id',
    also: ['ledger[0].formula'], // the formula reads 1.Life, and the plan has no stage "1" any more
  },
  {
    change: "stage 1 given stage 0's id",
    input: () => {
      const p = fixture();
      p.stages[1].id = p.stages[0].id;
      return p;
    },
    path: 'stages[1].id',
    // its loadoutName still ends with " {2}", and the formula reads 2.Life of a stage that is gone
    also: ['stages[1].loadoutName', 'ledger[0].formula'],
  },
  {
    change: 'a loadoutName without (L<level>)',
    input: () => {
      const p = fixture();
      p.stages[0].loadoutName = 'Act 1 Clearfell {1}';
      return p;
    },
    path: 'stages[0].loadoutName',
  },
  {
    change: 'variant without ascendancyPoints',
    input: () => {
      const p = fixture();
      const { variant, variantBasis } = variantFields();
      Object.assign(p.stages[1], { variant, variantBasis });
      return p;
    },
    path: 'stages[1].ascendancyPoints',
  },
  {
    change: 'chaosResistException on a stage without variant',
    input: () => {
      const p = fixture();
      p.stages[0].chaosResistException = { reason: 'Chaos Inoculation', tag: judgment('CI sets life to 1') };
      return p;
    },
    path: 'stages[0].chaosResistException',
  },
  {
    change: 'an external tag without accessed',
    input: () => {
      const p = fixture();
      p.stages[0].claims[0].source = { kind: 'external', ref: 'https://example.org/guide', patch: '0.5.5', confidence: 'M' };
      return p;
    },
    path: 'stages[0].claims[0].source.accessed',
  },
  {
    change: 'external-unavailable with another ref',
    input: () => {
      const p = fixture();
      p.stages[0].claims[0].source = { kind: 'external-unavailable', ref: 'offline', confidence: 'L' };
      return p;
    },
    path: 'stages[0].claims[0].source.ref',
  },
  {
    change: 'a judgment tag without confidence',
    input: () => {
      const p = fixture();
      p.stages[0].claims[0].source = { kind: 'judgment', ref: 'a reason' };
      return p;
    },
    path: 'stages[0].claims[0].source.confidence',
  },
  {
    change: "stage 1's skills.main.group differs",
    input: () => {
      const p = fixture();
      p.stages[1].skills.main.group = 2;
      return p;
    },
    path: 'stages[1].skills.main.group',
  },
  {
    change: 'a set1 node not in nodes',
    input: () => {
      const p = fixture();
      p.stages[0].tree.weaponSetNodes.set1 = [5710];
      return p;
    },
    path: 'stages[0].tree.weaponSetNodes.set1[0]',
  },
  {
    change: 'an earned entry that is on, with no producer',
    input: () => {
      const p = fixture();
      delete p.stages[0].config.earned[0].producer;
      return p;
    },
    path: 'stages[0].config.earned[0].producer',
  },
  {
    change: 'an option in both earned and scenario',
    input: () => {
      const p = fixture();
      const option = p.stages[0].config.earned[0].option;
      p.stages[0].config.scenario.unshift({
        option,
        value: 0,
        source: { file: 'campaign/limits.json', key: 'ascendancy.max' },
        tag: { kind: 'pob-data', ref: 'Modules/ConfigOptions.lua:964' },
      });
      return p;
    },
    path: 'stages[0].config.scenario[0].option',
  },
  {
    change: 'no enemyIsBoss in scenario',
    input: () => {
      const p = fixture();
      p.stages[0].config.scenario = p.stages[0].config.scenario.filter((e: Json) => e.option !== 'enemyIsBoss');
      return p;
    },
    path: 'stages[0].config.scenario',
  },
  {
    change: 'an ok price with amount: null',
    input: () => {
      const p = fixture();
      expect(p.prices[0].status).toBe('ok');
      p.prices[0].amount = null;
      return p;
    },
    path: 'prices[0].amount',
  },
  {
    change: 'formula "1.CombinedDPS +"',
    input: () => {
      const p = fixture();
      p.ledger[0].formula = '1.CombinedDPS +';
      return p;
    },
    path: 'ledger[0].formula',
    message: /^syntax at column 15: /,
  },
  {
    change: 'formula "zz.Life"',
    input: () => {
      const p = fixture();
      p.ledger[0].formula = 'zz.Life';
      return p;
    },
    path: 'ledger[0].formula',
    message: /^unknown-stage at column 0: "zz.Life" names stage "zz"/,
  },
  {
    change: 'a claim citing ledger:nope (D-237)',
    input: () => {
      const p = fixture();
      p.stages[0].claims[0].source = 'ledger:nope';
      return p;
    },
    path: 'stages[0].claims[0].source',
  },
  {
    change: 'a claim citing price:nope (D-237)',
    input: () => {
      const p = fixture();
      p.stages[0].claims[0].source = 'price:nope';
      return p;
    },
    path: 'stages[0].claims[0].source',
  },
  {
    change: 'league: null while a price is ok (D-233)',
    input: () => {
      const p = fixture();
      p.league = null;
      for (const price of p.prices) price.league = null; // keep each price's league equal to the plan's
      return p;
    },
    path: 'league',
  },
  {
    change: 'progress: "act1" (D-214)',
    input: () => {
      const p = fixture();
      p.stages[0].progress = 'act1';
      return p;
    },
    path: 'stages[0].progress',
  },
  {
    change: 'a group without role (D-217)',
    input: () => {
      const p = fixture();
      delete p.stages[0].skills.groups[0].role;
      return p;
    },
    path: 'stages[0].skills.groups[0].role',
  },
  {
    change: 'rolledGroup naming a group without the rolled skill (D-217)',
    input: () => {
      const p = fixture();
      p.stages[1].skills.rolledGroup = 2;
      return p;
    },
    path: 'stages[1].skills.rolledGroup',
  },
  {
    change: 'a variant stage without rolledGroup (D-217)',
    input: () => {
      const p = fixture();
      Object.assign(p.stages[1], variantFields());
      delete p.stages[1].skills.rolledGroup;
      return p;
    },
    path: 'stages[1].skills.rolledGroup',
  },
  {
    change: 'two prices with the same id',
    input: () => {
      const p = fixture();
      p.prices[1].id = p.prices[0].id;
      return p;
    },
    path: 'prices[1].id',
  },
];

describe('AC-P10 (WU-38, D-163): one change, one error at its JSON path', () => {
  it.each(ROWS.map((r) => [r.change, r] as const))('AC-P10: %s', (_change, row) => {
    const errors = errorsOf(row.input());
    const paths = errors.map((e) => e.path);
    expect(paths).toContain(row.path);
    expect([...new Set(paths)].sort()).toEqual([...new Set([row.path, ...(row.also ?? [])])].sort());
    if (row.message) expect(errors.find((e) => e.path === row.path)!.message).toMatch(row.message);
  });

  it('AC-P10: schemaVersion 4 is the only error, even with other faults present', () => {
    const p = { ...fixture(), schemaVersion: 4, foo: 1, stages: [] };
    const errors = errorsOf(p);
    expect(errors).toEqual([{ path: 'schemaVersion', message: expect.stringContaining('[1, 2, 3]') }]);
  });
});

describe('D-320, D-332: schema versions 1 and 2', () => {
  /** The fixture with a third stage, the entering-maps rung m: stage 2's content, at the endgame. */
  const withEnteringMaps = (version: number): Json => {
    const p = fixture();
    p.schemaVersion = version;
    const m = JSON.parse(JSON.stringify(p.stages[1]));
    Object.assign(m, { id: 'm', loadoutName: 'Entering maps (L65) {m}', level: 65, progress: 'endgame' }, variantFields(), { variant: 'entering-maps' });
    m.claims = [];
    p.stages.push(m);
    return p;
  };

  it('the fixture declares the current version, 3; a version-1 plan without additions still validates (D-332)', () => {
    expect(fixture().schemaVersion).toBe(3);
    const v1 = validatePlan({ ...fixture(), schemaVersion: 1 });
    expect(v1.ok ? v1.plan.schemaVersion : v1.errors).toBe(1);
    for (const name of ['fifteen-stage', 'off-hand-fresh', 'off-hand-item', 'off-hand-shared']) {
      const text = fs.readFileSync(path.join(REPO, 'tests', 'fixtures', 'plans', name, 'plan.json'), 'utf8');
      const r = validatePlan(text);
      expect({ name, version: JSON.parse(text).schemaVersion, ok: r.ok ? true : r.errors }).toEqual({ name, version: 1, ok: true });
    }
  });

  it('version 2 accepts the entering-maps variant; in a version-1 plan it is the one error, at its variant (D-281, D-332)', () => {
    expect(validatePlan(withEnteringMaps(2)).ok).toBe(true);
    const errors = errorsOf(withEnteringMaps(1));
    expect(errors).toEqual([{ path: 'stages[2].variant', message: expect.stringMatching(/entering-maps.*schemaVersion 2.*declares schemaVersion 1/) }]);
    // A version-1 plan keeps its other variants.
    const b = withEnteringMaps(1);
    b.stages[2].variant = 'budget';
    expect(validatePlan(b).ok).toBe(true);
  });
});

describe('AC-P60 (WU-65; D-351, D-358): schema version 3, claim kinds and the anoint', () => {
  const ANOINT = { notable: 'Unbending', reason: 'more life on the rung' };
  /** The fixture at `version` with the endgame ladder m, b and n: stage 2's content at the endgame. */
  const withLadder = (version: number): Json => {
    const p = fixture();
    p.schemaVersion = version;
    for (const [id, variant, level] of [['m', 'entering-maps', 65], ['b', 'budget', 80], ['n', 'non-budget', 90]] as const) {
      const s = JSON.parse(JSON.stringify(p.stages[1]));
      Object.assign(s, { id, loadoutName: `Endgame ${id} (L${level}) {${id}}`, level, progress: 'endgame' }, variantFields(), { variant });
      s.claims = [];
      p.stages.push(s);
    }
    return p;
  };
  const stage = (p: Json, id: string): Json => p.stages.find((s: Json) => s.id === id);

  it('AC-P60: version 3 accepts claims[].kind (hinge or reason) and items.anoint on b and n', () => {
    const p = withLadder(3);
    stage(p, '1').claims[0].kind = 'reason';
    stage(p, '2').claims[0].kind = 'hinge';
    stage(p, 'b').items.anoint = { ...ANOINT };
    stage(p, 'n').items.anoint = { ...ANOINT, notable: 'Behemoth' };
    const r = validatePlan(p);
    expect(r.ok ? 'ok' : r.errors).toBe('ok');
    if (r.ok) {
      expect(r.plan.stages.find((s) => s.id === 'b')!.items.anoint).toEqual(ANOINT);
      expect(r.plan.stages[0].claims[0].kind).toBe('reason');
    }
  });

  it('AC-P60: an anoint on m or on a campaign stage is refused at its path; any other kind is refused', () => {
    const p = withLadder(3);
    stage(p, 'm').items.anoint = { ...ANOINT };
    stage(p, '2').items.anoint = { ...ANOINT };
    const errors = errorsOf(p);
    expect(errors.map((e) => e.path).sort()).toEqual(['stages[1].items.anoint', 'stages[2].items.anoint']);
    expect(errors.find((e) => e.path === 'stages[2].items.anoint')!.message).toMatch(/only on the budget and non-budget rungs.*D-358.*entering-maps rung/);
    expect(errors.find((e) => e.path === 'stages[1].items.anoint')!.message).toMatch(/campaign stage/);
    const k = withLadder(3);
    stage(k, '1').claims[0].kind = 'caveat';
    expect(errorsOf(k).map((e) => e.path)).toEqual(['stages[0].claims[0].kind']);
    const shape = withLadder(3);
    stage(shape, 'b').items.anoint = { notable: '', reason: 'r', extra: 1 };
    expect(errorsOf(shape).map((e) => e.path).sort()).toEqual(['stages[3].items.anoint', 'stages[3].items.anoint.notable']);
  });

  it('AC-P60: versions 1 and 2 stay accepted; there a kind or an anoint is the one error at its path, naming version 3', () => {
    for (const version of [1, 2]) {
      const plain = version === 1 ? fixture() : withLadder(2);
      plain.schemaVersion = version;
      const ok = validatePlan(plain);
      expect({ version, ok: ok.ok ? true : ok.errors }).toEqual({ version, ok: true });
      const p = withLadder(2);
      p.schemaVersion = version;
      if (version === 1) p.stages = p.stages.filter((s: Json) => s.variant !== 'entering-maps');
      stage(p, '1').claims[1].kind = 'hinge';
      stage(p, 'b').items.anoint = { ...ANOINT };
      const errors = errorsOf(p);
      const bAt = p.stages.findIndex((s: Json) => s.id === 'b');
      expect({ version, paths: errors.map((e) => e.path).sort() }).toEqual({ version, paths: ['stages[0].claims[1].kind', `stages[${bAt}].items.anoint`] });
      for (const e of errors) expect(e.message).toMatch(new RegExp(`needs schemaVersion 3 or later; this plan declares schemaVersion ${version}`));
    }
  });
});

describe('C-31 rules beyond the AC-P10 table', () => {
  const pathsOf = (input: unknown) => [...new Set(errorsOf(input).map((e) => e.path))].sort();

  it('an offline plan (null league, every price unavailable with note "offline run") is valid (D-233)', () => {
    const p = fixture();
    p.league = null;
    p.prices = p.prices.map((x: Json) => ({ ...x, league: null, status: 'unavailable', amount: null, currency: null, note: 'offline run' }));
    expect(validatePlan(p).ok).toBe(true);
  });

  it("a price's league must equal the plan's (D-233)", () => {
    const p = fixture();
    p.prices[1].league = 'Runes of Aldur';
    expect(pathsOf(p)).toEqual(['prices[1].league']);
  });

  it('an unavailable price has null amount and currency, and a note (D-164)', () => {
    const p = fixture();
    p.prices[1].amount = 3;
    delete p.prices[1].note;
    expect(pathsOf(p)).toEqual(['prices[1].amount', 'prices[1].note']);
  });

  it('a set2 node also in set1, an attribute choice off the tree, a repeated slot, a jewel off the tree', () => {
    const p = fixture();
    const s = p.stages[1];
    s.tree.weaponSetNodes = { set1: [7721], set2: [7721] };
    s.tree.attributeChoices.push({ node: 5, attribute: 'dexterity' });
    s.items.slots.push({ slot: 'Boots', text: 'Rarity: Normal\nRough Greaves' });
    s.items.treeJewels.push({ node: 6, text: 'Rarity: Normal\nRuby' });
    expect(pathsOf(p)).toEqual([
      'stages[1].items.slots[4].slot',
      'stages[1].items.treeJewels[0].node',
      'stages[1].tree.attributeChoices[1].node',
      'stages[1].tree.weaponSetNodes.set2[0]',
    ]);
  });

  it('an active toggle needs uptime; an earned entry that is on needs uptime; off entries need neither (A-P5)', () => {
    const p = fixture();
    delete p.stages[0].items.toggles[0].uptime;
    delete p.stages[1].config.earned[0].uptime;
    p.stages[0].config.earned.push({ option: 'conditionFullLife', value: false });
    p.stages[0].config.earned.push({ option: 'multiplierStationary', value: 0 });
    expect(pathsOf(p)).toEqual(['stages[0].items.toggles[0].uptime', 'stages[1].config.earned[0].uptime']);
  });

  it('a complete variant stage with a chaos-resistance exception is valid (D-193, D-217, D-234)', () => {
    const p = fixture();
    Object.assign(p.stages[1], variantFields(), {
      chaosResistException: { reason: 'no slot can carry chaos resistance within budget', tag: judgment('budget') },
    });
    expect(validatePlan(p).ok).toBe(true);
  });

  it('source-tag ref forms: pob-computed is a multi-segment REF, external an http(s) URL (C-30)', () => {
    const p = fixture();
    p.stages[0].claims[0].source = { kind: 'pob-computed', ref: 'Life' };
    p.stages[0].claims[2].source = { ...p.stages[0].claims[2].source, ref: 'maxroll guide' };
    expect(pathsOf(p)).toEqual(['stages[0].claims[0].source.ref', 'stages[0].claims[2].source.ref']);
  });

  it('a claim source of the wrong type names the types it accepts; a malformed citation is reported', () => {
    const p = fixture();
    p.stages[0].claims[0].source = 42;
    p.stages[0].claims[1].source = 'wiki:beira';
    const errors = errorsOf(p);
    expect(errors.map((e) => e.path)).toEqual(['stages[0].claims[0].source', 'stages[0].claims[1].source']);
    expect(errors[0].message).toBe('expected object or string, received number');
    expect(errors[1].message).toMatch(/ledger:<id>, price:<id> or data:<file>#<key>/);
  });

  it('nested unknown keys err at their object; a duplicate ledger input errs at the later one', () => {
    const p = fixture();
    p.stages[0].tree.extra = true;
    p.ledger[0].inputs.push({ ...p.ledger[0].inputs[0] });
    const errors = errorsOf(p);
    expect(errors.map((e) => e.path)).toEqual(['stages[0].tree', 'ledger[0].inputs[1].name']);
    expect(errors[0].message).toMatch(/extra/);
  });

  it('a non-object plan is one error at $', () => {
    expect(errorsOf('[1, 2]')).toEqual([{ path: '$', message: 'a plan is a JSON object' }]);
    expect(errorsOf(null)).toEqual([{ path: '$', message: 'a plan is a JSON object' }]);
  });
});

describe('C-30: a source tag with extra fields, for C-35 data files (WU-39)', () => {
  const withId = sourceTagWith({ id: z.string().min(1) });
  const byHand = sourceTagObject.extend({ id: z.string().min(1) }).strict().superRefine(refineSourceTag);
  const issuesOf = (schema: z.ZodTypeAny, value: unknown) => {
    const r = schema.safeParse(value);
    return r.success ? [] : r.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message }));
  };
  const good = { id: 'S40', kind: 'external', ref: 'https://maxroll.gg/poe2/', accessed: '2026-10-07', patch: '0.5.5', confidence: 'M' };

  it('a tag with id validates through sourceTagWith and through sourceTagObject + refineSourceTag', () => {
    expect(withId.safeParse(good)).toEqual({ success: true, data: good });
    expect(byHand.safeParse(good)).toEqual({ success: true, data: good });
  });

  it.each([
    ['external without accessed', { kind: 'external', ref: 'https://maxroll.gg/poe2/', confidence: 'M' }],
    ['external with a non-URL ref', { kind: 'external', ref: 'maxroll', accessed: '2026-10-07', confidence: 'M' }],
    ['judgment without confidence', { kind: 'judgment', ref: 'a reason' }],
    ['external-unavailable with another ref', { kind: 'external-unavailable', ref: 'offline', confidence: 'L' }],
    ['pob-computed with a one-segment ref', { kind: 'pob-computed', ref: 'Life' }],
  ])('%s: the same refinement errors as sourceTagSchema', (_label, tag) => {
    const expected = issuesOf(sourceTagSchema, tag);
    expect(expected.length).toBeGreaterThan(0);
    expect(issuesOf(withId, { id: 'S1', ...tag })).toEqual(expected);
    expect(issuesOf(byHand, { id: 'S1', ...tag })).toEqual(expected);
  });

  it('the extended tag stays strict and requires its extra field', () => {
    expect(issuesOf(withId, { ...good, extra: 1 }).map((i) => i.path)).toEqual(['']);
    const { id: _id, ...noId } = good;
    expect(issuesOf(withId, noId).map((i) => i.path)).toEqual(['id']);
    expect(sourceTagSchema.safeParse(good).success).toBe(false); // id is unknown to the plain tag
  });
});
