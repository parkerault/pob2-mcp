/**
 * WU-111 (amendment 11 §8, §19; D-440): V1's `movement-tier` and `boots-exception` through `compile_plan`, and a schema-6
 * plan compiling as before, in process and engine-required. AC-P81's boots and schema-6 bullets.
 *
 * - **The schema-6 record.** `tests/fixtures/plans/schema6-ladder/plan.json` is the two-stage fixture at schema 6 with
 *   the endgame ladder `m`, `b`, `n` after it (`n` with Rolling Slam on weapon set 2 and a Wooden Club in set 2's main
 *   hand) and a ledger entry reading `n`'s breakdown. `record-before-schema7.json` beside it is that plan's compile record
 *   from the build before WU-111 (M-24's integration head, 635c30b), less the fields that change on every compile
 *   (`compiledAt`, `timing`, each stage's `elapsedMs`, the import code and the saved file's sha1 and path: PoB's save
 *   orders attributes differently from one process to the next); `config-before-schema7.json` is that compile's saved
 *   config sets, each set's lines sorted. A compile now keeps every one of those fields equal (new fields may be added),
 *   and the saved config sets are the same lines: the boss measure puts `enemyIsBoss` back.
 * - **The boots.** A schema-7 plan of the same Warrior / Titan, its boots written from the pinned data (Rough Greaves with
 *   one movement-speed line, Data/ModItem.lua's tiers 20% to 35%; the unique Birth of Fury, Stone Greaves at 20%,
 *   Data/Uniques/boots.lua; Leap Slam, PoB's Travel type, Data/Skills/act_str.lua): campaign stages at
 *   `q.act-4-isle-of-kin-blind-beast` (C1's area level 51: C1 has no key at area level 50, so this is the nearest, the
 *   same 25% tier, item levels 46 to 64), and rungs `m`, `b` and `n` at and under their tiers, a rung without boots, and
 *   the three exceptions.
 */
import fs from 'fs';
import path from 'path';
import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import { engineDescribe } from '../helpers/engine';
import { startSessionFixture, type SessionFixture } from '../helpers/engineSession';
import type { CompileRecord } from '../../src/plan/record';

const REPO = path.resolve(__dirname, '..', '..');
const LADDER = path.join(REPO, 'tests', 'fixtures', 'plans', 'schema6-ladder');
const FIXTURE = path.join(REPO, 'tests', 'fixtures', 'plans', 'two-stage', 'plan.json');
const ENGINE_TIMEOUT = 600_000;

type Json = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
const judgment = (ref: string) => ({ kind: 'judgment', ref, confidence: 'L' });
const gem = (name: string, level = 10) => ({ name, level, quality: 0, enabled: true });
const rareBoots = (speed: number) => ({ slot: 'Boots', text: `Rarity: Rare\nTest Stride\nRough Greaves\n${speed}% increased Movement Speed` });
const BIRTH_OF_FURY = {
  slot: 'Boots',
  text: 'Rarity: Unique\nBirth of Fury\nStone Greaves\n20% increased Movement Speed\n+50 to maximum Life\n+25% to Fire Resistance\nDrop Ignited Ground while moving, which lasts 8 seconds and Ignites as though dealing Fire Damage equal to 10% of your maximum Life',
};
const CAMPAIGN_KEY = 'q.act-4-isle-of-kin-blind-beast';

/** Every leaf path of `want` whose value `got` doesn't hold equally (a missing key included). */
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

/**
 * One line of a saved config set with its attributes in name order: PoB's save orders an element's attributes
 * differently from one process to the next (the build's known friction), so lines compare in this form.
 */
function canonicalLine(line: string): string {
  const m = /^<(\w+)((?:\s+[\w-]+="[^"]*")*)\s*\/>$/.exec(line.trim());
  if (m === null) return line.trim();
  const attrs = [...m[2].matchAll(/([\w-]+)="([^"]*)"/g)].map((a) => `${a[1]}="${a[2]}"`).sort();
  return `<${m[1]} ${attrs.join(' ')}/>`;
}

/** A saved file's config sets: each set's lines, attributes in name order, sorted, by the set's title. */
function configSets(xml: string): Record<string, string[]> {
  const sets: Record<string, string[]> = {};
  for (const m of xml.matchAll(/<ConfigSet\b([^>]*)>([\s\S]*?)<\/ConfigSet>/g)) {
    const title = /\btitle="([^"]*)"/.exec(m[1])![1];
    sets[title] = m[2].split('\n').map((l) => l.trim()).filter((l) => l !== '').map(canonicalLine).sort();
  }
  return sets;
}

/** A stage of the boots plan from the fixture's stage 2: a rung or a campaign stage, with `boots` and `edit`. */
function bootsStage(base: Json, id: string, variant: string | null, boots: Json | null, edit: (s: Json) => void = () => undefined): Json {
  const s = JSON.parse(JSON.stringify(base));
  const level = variant === null ? 45 : 90;
  Object.assign(s, { id, loadoutName: `Stage ${id} (L${level}) {${id}}`, level, claims: [] });
  if (variant === null) s.progress = CAMPAIGN_KEY;
  else {
    Object.assign(s, { progress: 'endgame', variant, ascendancyPoints: 0, variantBasis: { level: judgment('t'), gemLevels: judgment('t'), ascendancyPoints: judgment('t') } });
  }
  s.items.slots = s.items.slots.filter((i: Json) => i.slot !== 'Boots');
  if (boots !== null) s.items.slots.push(boots);
  s.skills.groups = [
    { label: 'Boneshatter', enabled: true, role: 'single_target', gems: [gem('Boneshatter')] },
    { label: 'Rolling Slam', enabled: true, role: 'clear', gems: [gem('Rolling Slam')] },
  ];
  s.config.earned = s.config.earned.filter((e: Json) => e.option !== 'multiplierRage');
  edit(s);
  return s;
}

const exception = (kind: 'travel' | 'unique') => (s: Json) =>
  (s.items.bootsException = { kind, reason: kind === 'travel' ? 'Leap Slam moves the build; the slot takes life' : "Birth of Fury's ignited ground" });
const withLeap = (s: Json) => s.skills.groups.push({ label: 'Leap Slam', enabled: true, role: 'utility', gems: [gem('Leap Slam')] });

/** The boots plan, schema 7. */
function bootsPlan(): Json {
  const plan = JSON.parse(fs.readFileSync(FIXTURE, 'utf8')) as Json;
  const base = plan.stages[1];
  plan.schemaVersion = 7;
  plan.stages = [
    bootsStage(base, 'c20', null, rareBoots(20)),
    bootsStage(base, 'c25', null, rareBoots(25)),
    bootsStage(base, 'm25', 'entering-maps', rareBoots(25)),
    bootsStage(base, 'm30', 'entering-maps', rareBoots(30)),
    bootsStage(base, 'b30', 'budget', rareBoots(30)),
    bootsStage(base, 'b35', 'budget', rareBoots(35)),
    bootsStage(base, 'n30', 'non-budget', rareBoots(30)),
    bootsStage(base, 'n35', 'non-budget', rareBoots(35)),
    bootsStage(base, 'bNo', 'budget', null),
    bootsStage(base, 'bT', 'budget', rareBoots(20), (s) => {
      exception('travel')(s);
      withLeap(s);
    }),
    bootsStage(base, 'bTx', 'budget', rareBoots(20), exception('travel')),
    bootsStage(base, 'bU', 'budget', BIRTH_OF_FURY, exception('unique')),
  ];
  plan.ledger = [];
  return plan;
}

engineDescribe('WU-111: movement-tier and a schema-6 plan through compile_plan (D-440, §19)', () => {
  let f: SessionFixture;
  let ladder: CompileRecord;
  let ladderXml: string;
  let boots: CompileRecord;

  async function compiled(slug: string, plan: Json): Promise<{ record: CompileRecord; xml: string }> {
    const made = await f.call('guide_run', { new_run: slug });
    if (made.isError) throw new Error(`guide_run failed: ${made.text}`);
    const abs = /^Created run folder (.+)$/m.exec(made.text)![1];
    const planPath = /^plan_path for this run: (\S+)$/m.exec(made.text)![1];
    fs.writeFileSync(path.join(f.guides, planPath), `${JSON.stringify(plan, null, 2)}\n`);
    const out = await f.call('compile_plan', { plan_path: planPath, measure_only: true });
    expect({ slug, isError: out.isError, text: out.isError ? out.text : '' }).toEqual({ slug, isError: false, text: '' });
    return {
      record: JSON.parse(fs.readFileSync(path.join(abs, 'compile-record.json'), 'utf8')) as CompileRecord,
      xml: fs.readFileSync(path.join(abs, 'compiled-build.xml'), 'utf8'),
    };
  }

  beforeAll(async () => {
    f = await startSessionFixture({ testActions: true });
    const l = await compiled('schema6-ladder', JSON.parse(fs.readFileSync(path.join(LADDER, 'plan.json'), 'utf8')));
    ladder = l.record;
    ladderXml = l.xml;
    boots = (await compiled('boots', bootsPlan())).record;
  }, ENGINE_TIMEOUT);

  afterAll(async () => f?.close(), 60_000);

  describe('a schema-6 plan compiles as before (§19)', () => {
    it("AC-P81: a schema-6 plan's record keeps every existing field equal to the pre-change record's", () => {
      const before = JSON.parse(fs.readFileSync(path.join(LADDER, 'record-before-schema7.json'), 'utf8')) as Json;
      expect(differences(before, ladder)).toEqual([]);
      // The ladder's variant stages gained the new measures beside them.
      expect(ladder.stages.n.measures!.damage).toEqual({ map: expect.any(Number), boss: expect.any(Number) });
    });

    it("the saved file's config sets are the same lines as before: the boss measure puts enemyIsBoss back", () => {
      const before = JSON.parse(fs.readFileSync(path.join(LADDER, 'config-before-schema7.json'), 'utf8')) as Record<string, string[]>;
      const want = Object.fromEntries(Object.entries(before).map(([title, lines]) => [title, lines.map(canonicalLine).sort()]));
      expect(Object.keys(want)).toHaveLength(5);
      expect(configSets(ladderXml)).toEqual(want);
    });

    it('AC-P81: movement-tier never runs on a schema-6 plan (its boots carry no movement speed)', () => {
      for (const id of ['m', 'b', 'n']) {
        const codes = [...ladder.stages[id].v1!.findings, ...ladder.stages[id].v1!.notes].map((x) => x.code);
        expect({ id, codes: codes.filter((c) => c === 'movement-tier' || c === 'boots-exception') }).toEqual({ id, codes: [] });
      }
    });
  });

  describe('movement-tier and boots-exception on a schema-7 plan (§8)', () => {
    const codes = (id: string) => {
      const v1 = boots.stages[id].v1!;
      const pick = (list: { code: string }[]) => list.map((x) => x.code).filter((c) => c === 'movement-tier' || c === 'boots-exception');
      return { id, findings: pick(v1.findings), notes: pick(v1.notes) };
    };

    it("PoB's parse of the boots is the movement speed V1 reads", () => {
      const finding = boots.stages.b30.v1!.findings.find((x) => x.code === 'movement-tier')!;
      expect(finding.data).toEqual({ slot: 'Boots', name: 'Test Stride', movementSpeed: 30, tier: 35, path: expect.stringMatching(/^items\.slots\[\d+\]\.text$/) });
    });

    it('AC-P81: fires on budget and non-budget boots with 30% and not with 35%', () => {
      expect(['b30', 'n30', 'b35', 'n35'].map(codes)).toEqual([
        { id: 'b30', findings: ['movement-tier'], notes: [] },
        { id: 'n30', findings: ['movement-tier'], notes: [] },
        { id: 'b35', findings: [], notes: [] },
        { id: 'n35', findings: [], notes: [] },
      ]);
    });

    it('AC-P81: fires on entering-maps boots with 25% and not with 30%', () => {
      expect(['m25', 'm30'].map(codes)).toEqual([
        { id: 'm25', findings: ['movement-tier'], notes: [] },
        { id: 'm30', findings: [], notes: [] },
      ]);
    });

    it('AC-P81: fires on a campaign stage of area level 50 (C1\'s nearest, 51: the same tier) with 20% and not with 25%', () => {
      expect(['c20', 'c25'].map(codes)).toEqual([
        { id: 'c20', findings: ['movement-tier'], notes: [] },
        { id: 'c25', findings: [], notes: [] },
      ]);
      expect(boots.stages.c20.v1!.findings.find((x) => x.code === 'movement-tier')!.message).toContain(`under the 25% tier for area level 51 (${CAMPAIGN_KEY})`);
    });

    it('AC-P81: never on a stage without boots', () => {
      expect(codes('bNo')).toEqual({ id: 'bNo', findings: [], notes: [] });
    });

    it('AC-P81: with bootsException travel and a travel skill in the record the finding is boots-exception; with travel and no travel skill it stays movement-tier; with unique and unique boots it is boots-exception', () => {
      expect(boots.stages.bT.measures!.clearSpeed.travel).toMatchObject({ group: 3, skill: 'Leap Slam' });
      expect(boots.stages.bTx.measures!.clearSpeed.travel).toBeNull();
      expect(['bT', 'bTx', 'bU'].map(codes)).toEqual([
        { id: 'bT', findings: [], notes: ['boots-exception'] },
        { id: 'bTx', findings: ['movement-tier'], notes: [] },
        { id: 'bU', findings: [], notes: ['boots-exception'] },
      ]);
      expect(boots.stages.bU.v1!.notes.find((x) => x.code === 'boots-exception')!.data).toMatchObject({ name: 'Birth of Fury', movementSpeed: 20, tier: 35, exception: 'unique' });
    });
  });
});
