/**
 * WU-137 (amendment 14 §18, §17; D-492, D-491): a jewel in Crystalline Phylactery's socket, and a clear skill with no area,
 * through `compile_plan`, in process and engine-required. The schema rows are `tests/unit/planSchema10.test.ts`, V1's over
 * hand-made inputs `tests/unit/v1Schema10.test.ts`.
 *
 * The fixture is `tests/fixtures/plans/m27-wu137/lich/plan.json`: a schema-10 Witch (Lich) on the budget rung at level 90,
 * its ascendancy the Lich start's path 58751 → 17788 (Crystalline Phylactery, `TreeData/0_5/tree.lua`:52946, a
 * `containJewelSocket` notable), with a rare Ruby ("+1% to Maximum Fire Resistance", "15% increased Armour",
 * `Data/ModJewel.lua`) in 17788, and Arc as its one clear group.
 *
 * - AC-P90 (the spike, §23): `items.treeJewels` naming 17788 compiles with the jewel in `Jewel 17788`: the saved file's
 *   socket holds the jewel, and its stat reaches the record: max fire resistance two points higher than the same plan's
 *   with the socket empty (PoB's `MissingFireResist`, the max less the resistance). PoB's own parse of the node's "100%
 *   increased Effect of bonuses gained from Socketed Jewel" leaves no SocketedJewelEffect; WU-139's parse fix
 *   (`pob-api/API/ParseFixes.lua`, D-492, PG-103) reads it as 100% more effect, so the jewel's +1% counts twice.
 * - AC-P93 (V1 `ascendancy-jewel`, D-492): the rare Ruby is no finding; a rare Diamond (a base other than a basic jewel,
 *   which PoB takes there) is one. A unique jewel (Grand Spectrum, an Emerald, `Data/Uniques/jewel.lua`) PoB refuses in
 *   the socket outright (`Classes/ItemsTab.lua`:2289-2294, "Lich socket can only accept basic non-unique jewels"), so the
 *   compile can't build the stage: `compile_check` reports it as a defect naming the rule, and nothing is compiled (the
 *   closest faithful form of AC-P93's unique row, a deviation the report names).
 * - AC-P94 (D-491): Arc, a clear skill with no radius that chains, records `clearSpeed` with `noArea`, `chains` and
 *   `projectiles` equal to PoB's `ChainMax` and `ProjectileCount` for it; Earthquake (with a club), with a radius, has neither.
 */
import fs from 'fs';
import path from 'path';
import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import { engineDescribe } from '../helpers/engine';
import { startSessionFixture, type SessionFixture } from '../helpers/engineSession';
import type { CompileRecord, Finding } from '../../src/plan/record';

const REPO = path.resolve(__dirname, '..', '..');
const LICH = path.join(REPO, 'tests', 'fixtures', 'plans', 'm27-wu137', 'lich', 'plan.json');
const ENGINE_TIMEOUT = 600_000;
type Json = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
const read = (file: string): Json => JSON.parse(fs.readFileSync(file, 'utf8')) as Json;
const codesOf = (record: CompileRecord, id: string, code: string): Finding[] => record.stages[id].v1!.findings.filter((f) => f.code === code);

/** Grand Spectrum on its Emerald, as `Data/Uniques/jewel.lua` writes it: a unique on a basic jewel's base. */
const GRAND_SPECTRUM = ['Rarity: Unique', 'Grand Spectrum', 'Emerald', 'Limited to: 3', '2% increased Spirit per socketed Grand Spectrum'].join('\n');
/** A rare Diamond (`Data/Bases/jewel.lua`: no subtype, so PoB takes it in 17788), "15% increased Armour" from ModJewel. */
const RARE_DIAMOND = ['Rarity: Rare', 'Prism Glint', 'Diamond', '15% increased Armour'].join('\n');

/** The saved file's `<Socket>` for a node: the item id it holds, and that item's text. */
function socketOf(xml: string, node: number): { itemId: number; text: string } {
  const tag = [...xml.matchAll(/<Socket\b([^>]*)\/>/g)].map((m) => m[1]).find((a) => new RegExp(`\\bnodeId="${node}"`).test(a));
  if (tag === undefined) throw new Error(`no <Socket nodeId="${node}">`);
  const itemId = Number(/\bitemId="(\d+)"/.exec(tag)![1]);
  const text = new RegExp(`<Item\\b[^>]*\\bid="${itemId}"[^>]*>([\\s\\S]*?)</Item>`).exec(xml)?.[1] ?? '';
  return { itemId, text };
}

engineDescribe('WU-137: a jewel in Crystalline Phylactery and a no-area clear skill through compile_plan (amendment 14 §17, §18)', () => {
  let f: SessionFixture;
  let withJewel: { record: CompileRecord; xml: string };
  let empty: CompileRecord;
  let diamond: CompileRecord;
  let quake: CompileRecord;

  async function compiled(slug: string, plan: Json): Promise<{ record: CompileRecord; xml: string }> {
    const made = await f.call('guide_run', { new_run: slug });
    if (made.isError) throw new Error(`guide_run failed: ${made.text}`);
    const abs = /^Created run folder (.+)$/m.exec(made.text)![1];
    const planPath = /^plan_path for this run: (\S+)$/m.exec(made.text)![1];
    fs.writeFileSync(path.join(f.guides, planPath), `${JSON.stringify(plan, null, 2)}\n`);
    const out = await f.call('compile_plan', { plan_path: planPath, measure_only: true });
    expect({ slug, isError: out.isError, text: out.isError ? out.text : '' }).toEqual({ slug, isError: false, text: '' });
    return {
      record: read(path.join(abs, 'compile-record.json')) as unknown as CompileRecord,
      xml: fs.readFileSync(path.join(abs, 'compiled-build.xml'), 'utf8'),
    };
  }

  beforeAll(async () => {
    f = await startSessionFixture({ testActions: true });
    withJewel = await compiled('phylactery', read(LICH));
    const bare = read(LICH);
    bare.stages[0].items.treeJewels = [];
    empty = (await compiled('phylactery-empty', bare)).record;
    const rareDiamond = read(LICH);
    rareDiamond.stages[0].items.treeJewels = [{ node: 17788, text: RARE_DIAMOND }];
    diamond = (await compiled('phylactery-diamond', rareDiamond)).record;
    const earthquake = read(LICH);
    earthquake.stages[0].skills.groups[0] = { label: 'Earthquake', enabled: true, role: 'clear', gems: [{ name: 'Earthquake', level: 20, quality: 0, enabled: true }] };
    earthquake.roll.skill = 'Earthquake';
    // Earthquake is a mace attack: with a club in hand, PoB gives it its area (compileSkeletonPace's measure).
    earthquake.stages[0].items.slots.push({ slot: 'Weapon 1', text: 'Rarity: Normal\nWooden Club' });
    quake = (await compiled('phylactery-quake', earthquake)).record;
  }, ENGINE_TIMEOUT);

  afterAll(async () => f?.close(), 60_000);

  describe('§18 (D-492): Crystalline Phylactery holding a jewel', () => {
    it('AC-P90 (spike): the schema-10 plan naming 17788 in items.treeJewels compiles with the jewel in Jewel 17788 of the saved file', () => {
      expect(withJewel.record.planSchemaVersion).toBe(10);
      const socket = socketOf(withJewel.xml, 17788);
      expect(socket.itemId).toBeGreaterThan(0);
      expect(socket.text).toContain('Phylactery Glimmer');
      expect(socket.text).toContain('+1% to Maximum Fire Resistance');
      // The empty socket holds nothing.
      expect(withJewel.record.stages.b.v1!.findings.filter((x) => x.code === 'ascendancy-jewel')).toEqual([]);
    });

    it("AC-P90 (spike): the jewel's stat reaches the record: max fire resistance two points over the empty socket's, the jewel's +1% doubled by the node (WU-139's parse fix)", () => {
      const o = withJewel.record.stages.b.outputs;
      const e = empty.stages.b.outputs;
      expect(o.FireResist).toBe(e.FireResist);
      // MissingFireResist is the max less the resistance: the jewel's +1% raises the max by 2, the node's 100% increased
      // effect of its jewel (PoB parses the line partly; WU-139's parse fix, D-492, reads it).
      expect(o.MissingFireResist - e.MissingFireResist).toBe(2);
      console.error(`[WU-137 spike] Jewel 17788: MissingFireResist ${e.MissingFireResist} → ${o.MissingFireResist} (the Ruby's +1% to Maximum Fire Resistance)`);
    });

    it('AC-P93 (V1 ascendancy-jewel): the rare Ruby in 17788 is no finding; a rare Diamond, a base other than a basic jewel, is one naming the node', () => {
      expect(codesOf(withJewel.record, 'b', 'ascendancy-jewel')).toEqual([]);
      const found = codesOf(diamond, 'b', 'ascendancy-jewel');
      expect(found.map((x) => x.data)).toEqual([
        { slot: 'Jewel 17788', node: 17788, item: 'Prism Glint, Diamond', base: 'Diamond', unique: false, path: 'items.treeJewels[0].text' },
      ]);
      expect(found[0].message).toMatch(/takes only a non-Unique Basic Jewel \(Ruby, Emerald, Sapphire\); Prism Glint, Diamond is a Diamond/);
    });

    it('AC-P93 (D-492, the pin): a unique jewel in 17788, which PoB refuses there, is a compile_check defect naming the rule; nothing is compiled', async () => {
      const spectrum = read(LICH);
      spectrum.stages[0].items.treeJewels = [{ node: 17788, text: GRAND_SPECTRUM }];
      const made = await f.call('guide_run', { new_run: 'phylactery-unique' });
      const abs = /^Created run folder (.+)$/m.exec(made.text)![1];
      const planPath = /^plan_path for this run: (\S+)$/m.exec(made.text)![1];
      fs.writeFileSync(path.join(f.guides, planPath), `${JSON.stringify(spectrum, null, 2)}\n`);
      const out = await f.call('compile_plan', { plan_path: planPath, measure_only: true });
      expect(out.isError).toBe(true);
      expect(out.text).toContain(
        'stage b: tree jewel on node 17788: Crystalline Phylactery takes only a non-Unique Basic Jewel (D-492), and PoB refuses Grand Spectrum there (a unique)',
      );
      expect(fs.readdirSync(abs).sort()).toEqual(['plan.json']);
    }, ENGINE_TIMEOUT);
  });

  describe('§17 (D-491): a clear skill with no area', () => {
    it("AC-P94: Arc records clearSpeed with noArea, chains and projectiles equal to PoB's ChainMax and ProjectileCount for it", () => {
      const s = withJewel.record.stages.b;
      const c = s.measures!.clearSpeed;
      expect(c).toMatchObject({ skill: 'Arc', noArea: true, radiusMetres: 0, band: 'slow' });
      const fields = s.skillOutputs[c.key!].fields;
      expect(fields.AreaOfEffectRadiusMetres ?? 0).toBe(0);
      expect(fields.ChainMax).toBeGreaterThan(0);
      expect(c.chains).toBe(fields.ChainMax);
      expect(c.projectiles).toBe(fields.ProjectileCount ?? 0);
      console.error(`[WU-137 AC-P94] Arc: chains ${c.chains}, projectiles ${c.projectiles}`);
    });

    it('AC-P94: Earthquake, with a radius, has neither', () => {
      const c = quake.stages.b.measures!.clearSpeed;
      expect(c).toMatchObject({ skill: 'Earthquake', noArea: false });
      expect(c.radiusMetres).toBeGreaterThan(0);
      expect('chains' in c || 'projectiles' in c).toBe(false);
    });
  });
});
