/**
 * WU-39 (C-35): the C1/E1 data files under `data/` and their loader, `src/plan/referenceData.ts`.
 *
 * - AC-P13: the loader loads the committed `data/` with no error; every fact-id group of slice 2 §3.4's
 *   table exists; the spot values hold; `order` is `start`, one key per row of the pinned
 *   `Data/QuestRewards.lua` (derived here from the row as A-P13 says), then `endgame`, all distinct.
 * - AC-P16: with a temp data dir, a fact without `patch`, an unknown source id and invalid JSON each give
 *   an error naming the file (and the fact or source id).
 * - AC-P17 (D-214, D-232): `validatePlan` with the reference data rejects an unknown `progress` at
 *   `stages[0].progress` and an unresolved `data:` claim at `stages[0].claims[0].source`; the committed
 *   fixture and the reference's worked example pass with the data loaded.
 */
import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, describe, expect, it } from '@jest/globals';
import {
  defaultDataDir,
  loadReferenceData,
  ReferenceDataError,
  type DataFile,
  type Fact,
  type ReferenceData,
} from '../../src/plan/referenceData';
import { validatePlan } from '../../src/plan/schema';

const REPO = path.resolve(__dirname, '..', '..');
const DATA = path.join(REPO, 'data');
const QUEST_REWARDS = path.join(REPO, 'vendor', 'PathOfBuilding-PoE2', 'src', 'Data', 'QuestRewards.lua');
const FIXTURE_PATH = path.join(REPO, 'tests', 'fixtures', 'plans', 'two-stage', 'plan.json');
const REFERENCE_PATH = path.join(REPO, 'docs', 'build-guide', 'plan-reference.md');

type Json = any;

interface QuestRow {
  Act: number;
  Description: string;
  Area: string;
  Info: string;
  Stat?: string;
  questPoints?: number;
  AreaLevel: number;
  useConfig: boolean;
  options: string[];
}

/** The pinned QuestRewards.lua rows, read from the Lua text (a plain field parser, independent of the data). */
function questRows(): QuestRow[] {
  const text = fs.readFileSync(QUEST_REWARDS, 'utf8');
  const blocks = text.split(/^\t\{$/m).slice(1);
  return blocks.map((block) => {
    const str = (k: string) => /\["(\w+)"\] = "(.*)"/.exec(block.split('\n').find((l) => l.includes(`["${k}"] = "`)) ?? '')?.[2];
    const num = (k: string) => {
      const m = new RegExp(`\\["${k}"\\] = (\\d+)`).exec(block);
      return m ? Number(m[1]) : undefined;
    };
    const opts = /\["Options"\] = \{([\s\S]*?)\n\t\t\}/.exec(block);
    return {
      Act: num('Act')!,
      Description: str('Description')!,
      Area: str('Area')!,
      Info: str('Info')!,
      Stat: str('Stat'),
      questPoints: num('questPoints'),
      AreaLevel: num('AreaLevel')!,
      useConfig: /\["useConfig"\] = true/.test(block),
      options: opts ? [...opts[1].matchAll(/"(.*)"/g)].map((m) => m[1].replace(/\\n/g, '\n').replace(/\\t/g, '\t')) : [],
    };
  });
}

/** A-P13: Description, Area and Info joined with spaces, lowercased, runs outside [a-z0-9] to one `-`. */
const questKey = (r: QuestRow) =>
  `q.${[r.Description, r.Area, r.Info].join(' ').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')}`;

const ref = loadReferenceData(DATA);
const file = (name: string): DataFile => {
  const f = ref.files.get(name);
  if (!f) throw new Error(`${name} not loaded`);
  return f;
};
const fact = (name: string, id: string): Fact => {
  const f = file(name).facts[id];
  if (!f) throw new Error(`${name} has no fact ${id}`);
  return f;
};
const ids = (name: string) => Object.keys(file(name).facts);
const ROWS = questRows();
const KEYS = ROWS.map(questKey);

describe('AC-P13 (WU-39): the committed C1/E1 data', () => {
  it('AC-P13: the loader loads <packageRoot>/data with no error, all eight files of the §3.4 table', () => {
    expect(defaultDataDir()).toBe(DATA);
    const loaded = loadReferenceData();
    expect(loaded.dataDir).toBe(DATA);
    expect([...loaded.files.keys()].sort()).toEqual([
      'campaign/areas.json',
      'campaign/ascendancy.json',
      'campaign/gems.json',
      'campaign/limits.json',
      'campaign/progress.json',
      'enemies/arbiter-of-divinity.json',
      'enemies/map-monsters.json',
      'enemies/waystones.json',
    ]);
  });

  it('AC-P13: the quest-row parser reads the pin (self-check: 29 rows, Beira first, Siege of Oriath last)', () => {
    expect(ROWS).toHaveLength(29);
    expect(questKey(ROWS[0])).toBe('q.act-1-clearfell-beira');
    expect(ROWS[0]).toMatchObject({ Stat: '+10% to Cold Resistance', AreaLevel: 2, useConfig: true });
    expect(ROWS[28]).toMatchObject({ Description: 'Epilog', Info: 'Siege Of Oriath', questPoints: 2 });
    expect(ROWS.filter((r) => r.options.length > 0).map((r) => r.options.length)).toEqual([2, 3, 2, 2, 2, 2, 2, 7]);
  });

  it('AC-P13, D-214: order is start, one key per QuestRewards.lua row in file order (A-P13), then endgame, all distinct', () => {
    const order = fact('campaign/progress.json', 'order').value as string[];
    expect(order[0]).toBe('start');
    expect(order[order.length - 1]).toBe('endgame');
    expect(order).toEqual(['start', ...KEYS, 'endgame']);
    expect(new Set(order).size).toBe(order.length);
    expect(ref.progressKeys).toEqual(order);
    expect(KEYS).toContain('q.act-1-ogham-manor-candlemass');
  });

  it('AC-P13: progress.json has every per-quest group, each value taken from its row', () => {
    const P = 'campaign/progress.json';
    for (const [i, row] of ROWS.entries()) {
      const k = KEYS[i];
      const region = row.Act <= 4 ? `act${row.Act}` : 'interlude';
      expect({ k, region: fact(P, `${k}.region`).value }).toEqual({ k, region });
      expect({ k, level: fact(P, `${k}.area-level`).value }).toEqual({ k, level: row.AreaLevel });
      expect(typeof fact(P, `${k}.reward`).value).toBe('string');
      if (row.Stat !== undefined) expect(fact(P, `${k}.reward`).value).toBe(row.Stat);
      if (row.options.length > 0) expect({ k, options: fact(P, `${k}.options`).value }).toEqual({ k, options: row.options });
      const book = row.questPoints !== undefined;
      expect({ k, ws: ids(P).includes(`${k}.weapon-set-points`), pp: ids(P).includes(`${k}.passive-points`) }).toEqual({ k, ws: book, pp: book });
      const key = ids(P).includes(`${k}.pob-config-key`) ? fact(P, `${k}.pob-config-key`).value : null;
      expect({ k, key }).toEqual({ k, key: row.useConfig ? `quest${row.Description}${row.Area}${row.Info}` : null });
    }
    // Spirit, resistance, life and mana where the row grants them.
    const granted = (suffix: string) => ids(P).filter((id) => id.endsWith(suffix)).map((id) => id.slice(0, -suffix.length));
    const statRows = (re: RegExp) => ROWS.filter((r) => r.Stat !== undefined && re.test(r.Stat)).map(questKey);
    expect(granted('.spirit')).toEqual(statRows(/to Spirit$/));
    expect(granted('.resistance')).toEqual(statRows(/% to (Cold|Fire|Lightning) Resistance$/));
    expect(granted('.life')).toEqual(statRows(/maximum Life$/));
    expect(granted('.mana')).toEqual(statRows(/Maximum Mana$/i));
    expect(fact(P, 'q.act-1-clearfell-beira.resistance').value).toEqual({ cold: 10 });
    expect(fact(P, 'q.act-1-ogham-manor-candlemass.life').value).toEqual({ flat: 20 });
  });

  it('AC-P13: the 12 books total 24 passive points and 24 weapon-set points; Spirit totals 100', () => {
    const P = 'campaign/progress.json';
    const sum = (suffix: string) =>
      ids(P).filter((id) => id.startsWith('q.') && id.endsWith(suffix)).reduce((t, id) => t + (fact(P, id).value as number), 0);
    expect(ids(P).filter((id) => id.endsWith('.passive-points'))).toHaveLength(12);
    expect(sum('.passive-points')).toBe(24);
    expect(sum('.weapon-set-points')).toBe(24);
    expect(sum('.spirit')).toBe(100);
  });

  it('AC-P13: areas, ascendancy and gems have their §3.4 groups', () => {
    const A = 'campaign/areas.json';
    for (const act of [1, 2, 3, 4]) {
      const v = fact(A, `act${act}.area-levels`).value as { min: number; max: number };
      expect(v.min).toBeLessThanOrEqual(v.max);
    }
    expect(fact(A, 'interlude.base-levels').value).toEqual({ min: 54, max: 56 });
    expect(fact(A, 'interlude.dynamic-increase')).toMatchObject({ value: 8, confidence: 'M' });

    const T = 'campaign/ascendancy.json';
    const order = ref.progressKeys;
    for (const n of [1, 2, 3, 4]) {
      expect(fact(T, `trial.${n}.points`).value).toBe(2);
      expect(order).toContain(fact(T, `trial.${n}.available-from`).value);
      expect(typeof fact(T, `trial.${n}.requirement`).value).toBe('string');
    }
    // Trial 3's earliest route, a level 60+ Barya, opens in the interludes: the key before them, at L.
    const firstInterlude = order.findIndex((k) => k.startsWith('q.interlude-'));
    expect(fact(T, 'trial.3.available-from')).toMatchObject({ value: order[firstInterlude - 1], confidence: 'L' });
    expect(fact(T, 'trial.3.available-from').note).toEqual(expect.stringContaining('60+'));
    expect(fact(T, 'trial.3.available-from').note).toEqual(expect.stringContaining('75+'));
    expect(fact(T, 'trial.4.available-from').value).toBe('endgame');
    // The third and fourth trials' 65+/75+ dispute is recorded as M.
    for (const n of [3, 4]) {
      expect(fact(T, `trial.${n}.requirement`).value).toEqual(expect.stringContaining('65+'));
      expect(fact(T, `trial.${n}.requirement`).value).toEqual(expect.stringContaining('75+'));
      expect(fact(T, `trial.${n}.requirement`).confidence).toBe('M');
    }

    const G = 'campaign/gems.json';
    const at = (id: string) => order.indexOf(fact(G, id).value as string);
    for (const [group, top] of [['uncut-skill', 20], ['uncut-support', 5]] as const) {
      let prev = 0;
      for (let n = 1; n <= top; n++) {
        const i = at(`${group}.${n}.available-from`);
        expect({ id: `${group}.${n}`, known: i >= 0 }).toEqual({ id: `${group}.${n}`, known: true });
        expect({ id: `${group}.${n}`, notEarlierThanLevelBelow: i >= prev }).toEqual({ id: `${group}.${n}`, notEarlierThanLevelBelow: true });
        prev = i;
      }
    }
    expect(fact(G, 'tier-rule').confidence).toBe('H');
    for (const id of ['skill-tiers', 'spirit-tiers', 'support-tiers']) expect(ids(G)).toContain(id);
  });

  it('AC-P13: limits spot values: 123 passive points (H), the Martyr point (1, M), 8 ascendancy points, endgame penalty -60', () => {
    const L = 'campaign/limits.json';
    expect(fact(L, 'passive-points.from-levels').value).toBe(99);
    expect(fact(L, 'passive-points.max')).toMatchObject({ value: 123, confidence: 'H' });
    expect(fact(L, 'passive-points.martyr')).toMatchObject({ value: 1, confidence: 'M' });
    expect(fact(L, 'ascendancy.max').value).toBe(8);
    expect(fact(L, 'resistance-penalty.act1').value).toBe(0);
    expect(fact(L, 'resistance-penalty.act2').value).toBe(-10);
    expect(fact(L, 'resistance-penalty.act3').value).toBe(-20);
    expect(fact(L, 'resistance-penalty.act4').value).toBe(-30);
    expect(fact(L, 'resistance-penalty.interlude').value).toEqual({ '54-59': -40, '60-64': -50 });
    expect(fact(L, 'resistance-penalty.endgame').value).toBe(-60);
  });

  it("AC-P13: the Arbiter's profile: area level 79, base stats, 0.5.5 resistances, hits with types, three L fight-life inputs", () => {
    const E = 'enemies/arbiter-of-divinity.json';
    expect(fact(E, 'area-level').value).toBe(79);
    for (const s of ['life', 'energy-shield', 'armour', 'evasion', 'accuracy', 'crit-chance', 'crit-bonus']) {
      expect(typeof fact(E, `base.${s}`).value).toBe('number');
    }
    expect(fact(E, 'res.lightning')).toMatchObject({ value: 45, patch: '0.5.5' });
    for (const r of ['fire', 'cold', 'chaos']) expect(fact(E, `res.${r}`).patch).toBe('0.5.5');
    const fightLife = ids(E).filter((id) => id.startsWith('fight-life.'));
    expect(fightLife.sort()).toEqual(['fight-life.community-report', 'fight-life.datamined-base', 'fight-life.extrapolated']);
    for (const id of fightLife) expect({ id, confidence: fact(E, id).confidence }).toEqual({ id, confidence: 'L' });
    expect(fact(E, 'fight-life.extrapolated').note).toEqual(expect.stringContaining('34x'));
    expect(fact(E, 'hits.volatile-explode').value).toEqual({ min: 1323, max: 3969 });
    expect(fact(E, 'hits.volatile-explode.type').value).toBe('lightning');
    const hits = ids(E).filter((id) => /^hits\.[a-z0-9-]+$/.test(id));
    expect(hits.length).toBeGreaterThanOrEqual(8);
    for (const id of hits) expect(ids(E)).toContain(`${id}.type`);
    expect(fact(E, 'pob-enemy-is-boss')).toMatchObject({ value: 'Pinnacle', confidence: 'M' });
  });

  it('AC-P13: map monsters (100-level tables, not a boss) and waystones (offset 64, max 82 M, mods M)', () => {
    const M = 'enemies/map-monsters.json';
    for (const t of ['life.by-level', 'damage.by-level']) expect(Object.keys(fact(M, t).value)).toHaveLength(100);
    expect(fact(M, 'pob-enemy-is-boss').value).toBe('None');
    const W = 'enemies/waystones.json';
    expect(fact(W, 'area-level.offset').value).toBe(64);
    expect(fact(W, 'area-level.max')).toMatchObject({ value: 82, confidence: 'M' });
    const mods = ids(W).filter((id) => id.startsWith('mods.'));
    expect(mods.length).toBeGreaterThan(0);
    for (const id of mods) expect({ id, confidence: fact(W, id).confidence }).toEqual({ id, confidence: 'M' });
  });

  it("AC-P13 (origin, D-204): pin facts have patch 0.5.4; an external fact has its page's patch (the grounding's 0.5.x for its section 2 pages, 0.5.5 for poe2db); every external source was accessed 2026-10-07", () => {
    for (const [name, f] of ref.files) {
      const sources = new Map(f.sources.map((s) => [s.id, s]));
      for (const [id, x] of Object.entries(f.facts)) {
        const s = sources.get(x.source)!;
        if (s.kind === 'pob-data') expect({ name, id, patch: x.patch }).toEqual({ name, id, patch: '0.5.4' });
        if (s.kind === 'external') expect({ name, id, patch: x.patch }).toEqual({ name, id, patch: s.patch });
      }
      for (const s of f.sources.filter((s) => s.kind === 'external')) {
        expect({ name, id: s.id, accessed: s.accessed }).toEqual({ name, id: s.id, accessed: '2026-10-07' });
        const n = Number(/^ext-s(\d+)/.exec(s.id)![1]);
        if ([14, 16, 17, 18].includes(n)) expect({ name, id: s.id, patch: s.patch }).toEqual({ name, id: s.id, patch: '0.5.x' });
        if (s.ref.startsWith('https://poe2db.tw/')) expect({ name, id: s.id, patch: s.patch }).toEqual({ name, id: s.id, patch: '0.5.5' });
      }
    }
  });

  it("AC-P13: the books' passive points are the pin's questPoints (H, 0.5.4); choice notes claim only what their source says", () => {
    const P = 'campaign/progress.json';
    const sources = new Map(file(P).sources.map((s) => [s.id, s]));
    for (const id of ids(P).filter((x) => x.endsWith('.passive-points'))) {
      const f = fact(P, id);
      expect({ id, kind: sources.get(f.source)!.kind, patch: f.patch, confidence: f.confidence }).toEqual({ id, kind: 'pob-data', patch: '0.5.4', confidence: 'H' });
      expect(f.note).toEqual(expect.stringContaining('Modules/Build.lua'));
    }
    expect(fact(P, 'q.interlude-2-qimah-seven-pillars.reward').note).toEqual(expect.stringContaining('swappable'));
    for (const k of ['q.interlude-2-qimah-seven-pillars', 'q.act-4-eye-of-hinekora-tribal-medicine']) {
      for (const id of [`${k}.reward`, `${k}.options`]) expect({ id, note: /permanent/i.test(fact(P, id).note ?? '') }).toEqual({ id, note: false });
    }
  });
});

describe('AC-P16 (WU-39): an invalid data file is an error naming the file and the key', () => {
  let tmp: string | undefined;
  afterEach(() => {
    if (tmp) fs.rmSync(tmp, { recursive: true, force: true });
    tmp = undefined;
  });

  /** A copy of the committed data/ in a temp dir, with one file changed. */
  function tempData(rel: string, change: (text: string) => string): string {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'pob2-refdata-'));
    fs.cpSync(DATA, tmp, { recursive: true });
    const p = path.join(tmp, rel);
    fs.writeFileSync(p, change(fs.readFileSync(p, 'utf8')));
    return tmp;
  }

  function loadErrors(dir: string): readonly string[] {
    try {
      loadReferenceData(dir);
    } catch (e) {
      expect(e).toBeInstanceOf(ReferenceDataError);
      expect((e as ReferenceDataError).message).toEqual(expect.stringContaining((e as ReferenceDataError).errors[0]));
      return (e as ReferenceDataError).errors;
    }
    throw new Error('loadReferenceData accepted the changed data');
  }

  const edit = (mutate: (data: Json) => void) => (text: string) => {
    const data = JSON.parse(text);
    mutate(data);
    return JSON.stringify(data, null, 2);
  };

  it('AC-P16: the unchanged copy loads (control)', () => {
    expect(loadReferenceData(tempData('campaign/limits.json', (t) => t)).progressKeys.length).toBe(31);
  });

  it('AC-P16: a fact without patch gives an error naming campaign/limits.json and the fact id', () => {
    const dir = tempData('campaign/limits.json', edit((d) => delete d.facts['passive-points.max'].patch));
    const errors = loadErrors(dir);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toEqual(expect.stringContaining('campaign/limits.json'));
    expect(errors[0]).toEqual(expect.stringContaining('passive-points.max'));
    expect(errors[0]).toEqual(expect.stringContaining('patch'));
  });

  it('AC-P16: an unknown source id gives an error naming the file and the id', () => {
    const dir = tempData('enemies/waystones.json', edit((d) => (d.facts['area-level.max'].source = 'no-such-source')));
    const errors = loadErrors(dir);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toEqual(expect.stringContaining('enemies/waystones.json'));
    expect(errors[0]).toEqual(expect.stringContaining('no-such-source'));
    expect(errors[0]).toEqual(expect.stringContaining('area-level.max'));
  });

  it('AC-P16: invalid JSON gives an error naming the file', () => {
    const errors = loadErrors(tempData('campaign/gems.json', (t) => t.slice(0, -10)));
    expect(errors).toHaveLength(1);
    expect(errors[0]).toEqual(expect.stringContaining('campaign/gems.json'));
    expect(errors[0]).toEqual(expect.stringContaining('JSON'));
  });

  it('AC-P16: a bad sources[] entry, a bad fact id and a reversed range name the file and sources[n] or the id', () => {
    const dir = tempData('campaign/areas.json', edit((d) => {
      delete d.sources[1].accessed;
      d.facts['Bad_Id'] = d.facts['interlude.dynamic-increase'];
      d.facts['act1.area-levels'].value = { min: 15, max: 1 };
    }));
    const errors = loadErrors(dir);
    expect(errors.some((e) => e.startsWith('campaign/areas.json: sources[1].accessed'))).toBe(true);
    expect(errors.some((e) => e.startsWith('campaign/areas.json: facts["Bad_Id"]'))).toBe(true);
    expect(errors.some((e) => e.startsWith('campaign/areas.json: facts["act1.area-levels"].value: a {min, max} range'))).toBe(true);
  });

  it('AC-P16: every problem across files is reported, each naming its file', () => {
    tempData('campaign/limits.json', edit((d) => delete d.facts['ascendancy.max'].confidence));
    fs.writeFileSync(path.join(tmp!, 'enemies', 'broken.json'), '{');
    const errors = loadErrors(tmp!);
    expect(errors.map((e) => e.split(':')[0]).sort()).toEqual(['campaign/limits.json', 'enemies/broken.json']);
  });

  it('AC-P16: an order that breaks D-214 names campaign/progress.json and order', () => {
    const dir = tempData('campaign/progress.json', edit((d) => d.facts.order.value.splice(1, 0, 'Act 1')));
    const errors = loadErrors(dir);
    expect(errors).toEqual([expect.stringContaining('campaign/progress.json: facts["order"].value[1]')]);
  });
});

describe('AC-P17 (WU-39, D-214, D-232): validatePlan checks progress keys and data: claims against the loaded data', () => {
  const fixtureText = fs.readFileSync(FIXTURE_PATH, 'utf8');
  const fixture = (): Json => JSON.parse(fixtureText);

  /** validatePlan's errors, with the loaded data, or with none (`null`). */
  const errorsOf = (plan: Json, data: ReferenceData | null = ref) => {
    const r = validatePlan(plan, data ?? undefined);
    return r.ok ? [] : r.errors;
  };

  it('AC-P17: an unknown progress key gives an error at stages[0].progress, only with the data loaded', () => {
    const p = fixture();
    p.stages[0].progress = 'q.act-1-the-nowhere-quest';
    expect(errorsOf(p, null)).toEqual([]);
    const errors = errorsOf(p);
    expect(errors.map((e) => e.path)).toEqual(['stages[0].progress']);
    expect(errors[0].message).toEqual(expect.stringContaining('q.act-1-the-nowhere-quest'));
  });

  it('AC-P17: start and endgame are progress keys', () => {
    for (const key of ['start', 'endgame']) {
      const p = fixture();
      p.stages[0].progress = key;
      expect(errorsOf(p)).toEqual([]);
    }
  });

  it.each([
    ['data:campaign/limits.json#nope', 'campaign/limits.json has no fact "nope"'],
    ['data:nope.json#order', 'no data file "nope.json"'],
    ['data:enemies/map-monsters.json#life.by-level[101]', 'no member [101]'],
  ])('AC-P17: a claim citing %s gives an error at stages[0].claims[0].source', (cite, reason) => {
    const p = fixture();
    p.stages[0].claims[0].source = cite;
    expect(errorsOf(p, null)).toEqual([]);
    const errors = errorsOf(p);
    expect(errors.map((e) => e.path)).toEqual(['stages[0].claims[0].source']);
    expect(errors[0].message).toEqual(expect.stringContaining(reason));
  });

  it('AC-P17: a member of an object fact and of a list fact resolves', () => {
    const p = fixture();
    p.stages[0].claims[0].source = 'data:enemies/map-monsters.json#life.by-level[79]';
    p.stages[0].claims[1].source = 'data:campaign/progress.json#order[0]';
    expect(errorsOf(p)).toEqual([]);
    const life = ref.resolveFact('enemies/map-monsters.json', 'life.by-level[79]');
    expect(life.ok && life.fact.value).toBe(24852);
  });

  it('AC-P17: the reference errors join the schema errors in one report', () => {
    const p = fixture();
    p.stages[0].progress = 'q.act-1-the-nowhere-quest';
    p.stages[1].level = 0;
    expect(errorsOf(p).map((e) => e.path)).toEqual(expect.arrayContaining(['stages[0].progress', 'stages[1].level']));
  });

  it('AC-P17: the committed fixture passes with the reference data loaded', () => {
    expect(validatePlan(fixtureText, ref)).toEqual({ ok: true, plan: fixture() });
  });

  it("AC-P17: the reference's worked example passes with the reference data loaded", () => {
    const md = fs.readFileSync(REFERENCE_PATH, 'utf8');
    const at = md.search(/^## Worked example$/m);
    expect(at).toBeGreaterThanOrEqual(0);
    const block = /```json\n([\s\S]*?)```/.exec(md.slice(at));
    expect(block).not.toBeNull();
    const r = validatePlan(block![1], ref);
    expect(r.ok ? [] : r.errors).toEqual([]);
  });

  it("AC-P17, D-168: a resolved fact's tag is its own: the source's kind, ref and accessed with the fact's patch and confidence", () => {
    const tagOf = (f: string, key: string) => {
      const r = ref.resolveFact(f, key);
      if (!r.ok) throw new Error(r.reason);
      return r.fact.tag;
    };
    // An L fact from an H page stays L.
    expect(tagOf('enemies/arbiter-of-divinity.json', 'fight-life.datamined-base')).toEqual({
      kind: 'external', ref: 'https://poe2db.tw/us/The_Arbiter_of_Divinity', accessed: '2026-10-07', patch: '0.5.5', confidence: 'L',
    });
    for (const n of [3, 6, 8, 10, 12, 14]) {
      expect({ n, confidence: tagOf('campaign/gems.json', `uncut-skill.${n}.available-from`).confidence }).toEqual({ n, confidence: 'L' });
    }
    // A judgment-sourced fact gets the fact's patch; a member keeps its fact's tag.
    expect(tagOf('campaign/progress.json', 'start.region')).toMatchObject({ kind: 'judgment', patch: '0.5.4', confidence: 'H' });
    expect(tagOf('enemies/map-monsters.json', 'life.by-level[79]')).toEqual({ kind: 'pob-data', ref: 'Data/Misc.lua:7', patch: '0.5.4', confidence: 'H' });
    for (const [name, f] of ref.files) {
      for (const [id, x] of Object.entries(f.facts)) {
        expect({ name, id, tag: tagOf(name, id) }).toMatchObject({ name, id, tag: { patch: x.patch, confidence: x.confidence } });
      }
    }
  });

  it("AC-P17: the fixture's scenario entries carry their cited fact's value and the fact's own tag (D-168)", () => {
    for (const stage of fixture().stages) {
      for (const entry of stage.config.scenario) {
        const found = ref.resolveFact(entry.source.file, entry.source.key);
        expect(found.ok).toBe(true);
        if (found.ok) expect({ option: entry.option, value: entry.value, tag: entry.tag }).toEqual({ option: entry.option, value: found.fact.value, tag: found.fact.tag });
        expect(entry.tag.confidence).toBe(found.ok ? found.fact.fact.confidence : undefined);
      }
    }
  });
});
