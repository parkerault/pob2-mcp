/**
 * WU-93 (amendment 9; AC-P74's engine part): plan schema 6's tree needs through `compile_plan` and `guide_run
 * {validate}`, the compile record's `requirements`, and a card skeleton measured against the rungs' reference hits, in
 * process and engine-required.
 *
 * - D-418: a schema-6 plan with `tree.needs` validates and compiles, with or without a need's `claim`; V1 reports
 *   `missing-reason` for a need with no `claim` or one naming no claim of its stage; a need naming a node its stage
 *   lacks is refused before anything is compiled; the record's `buildSha1` stays when a need's claim changes and moves
 *   when its nodes do (D-266).
 * - D-413 (C-33): each stage's record holds `requirements {level, by[]}`, the highest level requirement among its
 *   equipped items and socketed gems as PoB computes them, and what sets it: a gem whose level requirement is above the
 *   items', checked against the gem's own table in `lookup_game_data`, and an item whose text sets a higher one.
 * - D-423: a card skeleton (an endgame stage with no `variant`) is written the rungs' reference hits, the T15 map hit
 *   (`configWritten`), so its Effective HP equals the same build's as a budget rung, and differs from a campaign stage's
 *   measured against PoB's default enemy.
 *
 * The plans are written here from the committed `minion-wolf` fixture (a level-80 Warrior tree, a Wooden Club, Wolf
 * Pack's wolves casting Leap Slam), with Wolf Pack at gem level 15: its level requirement is 64 in PoB's data
 * (`Data/Skills/act_str.lua`, Wolf Pack's `levels[15]`), above the fixture's normal and magic items'. The pure rules are
 * `tests/unit/planNeeds.test.ts`.
 */
import fs from 'fs';
import path from 'path';
import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import { engineDescribe } from '../helpers/engine';
import { startSessionFixture, type SessionFixture } from '../helpers/engineSession';
import { buildSha1 } from '../../src/plan/buildHash';
import { REFERENCE_HITS } from '../../src/plan/compiler';
import type { CompileRecord } from '../../src/plan/record';

const REPO = path.resolve(__dirname, '..', '..');
const ENGINE_TIMEOUT = 300_000;
type Json = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

/** Wolf Pack's gem level in these plans, and the last campaign progress key (C1's order, before `endgame`). */
const GEM_LEVEL = 15;
const LAST_QUEST = 'q.epilog-kingsmarch-siege-of-oriath';
/** Boots whose text sets a level requirement of 70 (PoB reads `LevelReq:`, `Classes/Item.lua`), above Wolf Pack's 64. */
const LEVEL_70_BOOTS = 'Rarity: Magic\nHale Rough Greaves\nLevelReq: 70\n+12 to maximum Life';

const reason = (id: string, text: string) => ({ id, text, kind: 'reason', source: { kind: 'judgment', ref: 'test: why the tree keeps it', confidence: 'M' } });

/**
 * A schema-6 plan of three stages with the fixture's tree and gear: `c1`, a campaign stage at the last quest whose boots
 * require level 70; `r1a1e`, a card skeleton (R1b's stage: `progress` `endgame`, no `variant`); and `b`, the same build
 * as a budget rung. The skeleton keeps three needs: one naming its own reason claim, one with no claim, and one naming
 * `b`'s claim; `b` keeps one, naming its own.
 */
function plan(): Json {
  const p = JSON.parse(fs.readFileSync(path.join(REPO, 'tests', 'fixtures', 'plans', 'minion-wolf', 'plan.json'), 'utf8')) as Json;
  p.schemaVersion = 6;
  const b = p.stages[0];
  b.skills.groups[0].gems[0].level = GEM_LEVEL;
  b.variantBasis.gemLevels.ref = `test: a level-${GEM_LEVEL} Wolf Pack`;
  const nodes: number[] = b.tree.nodes;
  const skeleton = JSON.parse(JSON.stringify(b)) as Json;
  delete skeleton.variant;
  delete skeleton.ascendancyPoints;
  delete skeleton.variantBasis;
  skeleton.id = 'r1a1e';
  skeleton.loadoutName = 'Card r1-a-1 (L80) {r1a1e}';
  skeleton.claims = [reason('r1a1e-life', 'The tree keeps its life nodes for the floor.')];
  skeleton.tree.needs = [{ nodes: [nodes[4], nodes[5]], stat: 'Life', claim: 'r1a1e-life' }, { nodes: [nodes[6]] }, { nodes: [nodes[7]], claim: 'b-ehp' }];
  const campaign = JSON.parse(JSON.stringify(skeleton)) as Json;
  campaign.id = 'c1';
  campaign.loadoutName = 'Epilogue (L80) {c1}';
  campaign.progress = LAST_QUEST;
  campaign.claims = [];
  delete campaign.tree.needs;
  campaign.items.slots = campaign.items.slots.map((s: Json) => (s.slot === 'Boots' ? { slot: 'Boots', text: LEVEL_70_BOOTS } : s));
  b.claims = [reason('b-ehp', 'The tree keeps this node for the floor.')];
  b.tree.needs = [{ nodes: [nodes[7]], stat: 'TotalEHP', claim: 'b-ehp' }];
  p.stages = [campaign, skeleton, b];
  return p;
}

engineDescribe('WU-93: tree needs, requirements and a skeleton\'s reference hits through compile_plan (AC-P74)', () => {
  let f: SessionFixture;
  let planPath: string;
  let runDir: string;
  let record: CompileRecord;
  let validated: { isError: boolean; text: string };
  /** Wolf Pack's level requirement at each gem level, from `lookup_game_data`'s table. */
  let wolfPackLevels: number[];

  /** A new run folder: its absolute path and its plan_path. */
  async function newRun(slug: string): Promise<{ dir: string; planPath: string }> {
    const made = await f.call('guide_run', { new_run: slug });
    if (made.isError) throw new Error(`guide_run failed: ${made.text}`);
    return { dir: /^Created run folder (.+)$/m.exec(made.text)![1], planPath: /^plan_path for this run: (\S+)$/m.exec(made.text)![1] };
  }

  beforeAll(async () => {
    f = await startSessionFixture();
    const run = await newRun('p74-needs');
    runDir = run.dir;
    planPath = run.planPath;
    fs.writeFileSync(path.join(f.guides, planPath), `${JSON.stringify(plan(), null, 2)}\n`);
    validated = await f.call('guide_run', { validate: planPath });
    const out = await f.call('compile_plan', { plan_path: planPath, measure_only: true });
    expect({ isError: out.isError, text: out.isError ? out.text : '' }).toEqual({ isError: false, text: '' });
    record = JSON.parse(fs.readFileSync(path.join(runDir, 'compile-record.json'), 'utf8')) as CompileRecord;
    const lookup = await f.call('lookup_game_data', { mode: 'gem', query: 'Wolf Pack' });
    expect(lookup.isError).toBe(false);
    const line = /^Requires level \(gem levels 1–\d+\): (.+)$/m.exec(lookup.text);
    expect(line).not.toBeNull();
    wolfPackLevels = line![1].split(', ').map(Number);
  }, ENGINE_TIMEOUT);

  afterAll(async () => f?.close(), 60_000);

  describe('D-418: a schema-6 plan with tree needs', () => {
    it('validates and compiles, with or without a need\'s claim', () => {
      expect(validated).toEqual({ isError: false, text: expect.stringMatching(/^Plan \S+ is valid: 3 stages \(c1, r1a1e, b\)\./) });
      expect(record.planSchemaVersion).toBe(6);
      expect(record.stagesCompiled).toEqual(['c1', 'r1a1e', 'b']);
    });

    it('V1 reports missing-reason for a need with no claim and for one naming no claim of its stage, and none for a need naming its own', () => {
      const reasons = (id: string) => record.stages[id].v1!.findings.filter((x) => x.code === 'missing-reason');
      const nodes = plan().stages[1].tree.nodes as number[];
      expect(reasons('r1a1e')).toEqual([
        { code: 'missing-reason', message: expect.stringContaining('tree need 2 (node '), data: { path: 'tree.needs[1].claim', need: 2, nodes: [nodes[6]] } },
        {
          code: 'missing-reason',
          message: expect.stringContaining(`tree need 3 (node ${nodes[7]}) names claim "b-ehp", which isn't a claim of this stage`),
          data: { path: 'tree.needs[2].claim', need: 3, nodes: [nodes[7]], claim: 'b-ehp' },
        },
      ]);
      expect(record.stages.r1a1e.v1!.pass).toBe(false);
      expect(reasons('b')).toEqual([]);
      expect(reasons('c1')).toEqual([]);
    });

    it("the record's buildSha1 stays when a need's claim is set or changed, and moves when its nodes or stat change (D-266)", () => {
      const p = plan();
      expect(record.buildSha1).toBe(buildSha1(p));
      p.stages[1].tree.needs[1].claim = 'r1a1e-life';
      p.stages[1].tree.needs[2].claim = 'r1a1e-life';
      p.stages[2].tree.needs[0].claim = 'b-other';
      expect(buildSha1(p)).toBe(record.buildSha1);
      const nodes = plan();
      nodes.stages[1].tree.needs[1].nodes.push(nodes.stages[1].tree.nodes[3]);
      expect(buildSha1(nodes)).not.toBe(record.buildSha1);
      const stat = plan();
      stat.stages[2].tree.needs[0].stat = 'Life';
      expect(buildSha1(stat)).not.toBe(record.buildSha1);
    });

    it('a need naming a node its stage lacks is refused by validate and by compile_plan, naming the path, and nothing is written', async () => {
      const run = await newRun('p74-bad-need');
      const p = plan();
      p.stages[2].tree.needs[0].nodes = [999999];
      fs.writeFileSync(path.join(f.guides, run.planPath), `${JSON.stringify(p, null, 2)}\n`);
      const before = fs.readdirSync(run.dir).sort();
      for (const [tool, args] of [
        ['guide_run', { validate: run.planPath }],
        ['compile_plan', { plan_path: run.planPath, measure_only: true }],
      ] as [string, Json][]) {
        const out = await f.call(tool, args);
        expect({ tool, isError: out.isError }).toEqual({ tool, isError: true });
        expect(out.text).toMatch(/stages\[2\]\.tree\.needs\[0\]\.nodes\[0\] \(stage b\): node 999999 isn't in tree\.nodes: a need keeps nodes the stage's tree allocates \(D-418\)/);
      }
      expect(fs.readdirSync(run.dir).sort()).toEqual(before);
    }, ENGINE_TIMEOUT);
  });

  describe("D-413: the record's requirements", () => {
    it("a stage's record holds requirements.level and what sets it: Wolf Pack's level requirement at its gem level, above the items'", () => {
      const fromLookup = wolfPackLevels[GEM_LEVEL - 1];
      expect(fromLookup).toBe(64);
      for (const id of ['r1a1e', 'b']) {
        expect({ id, requirements: record.stages[id].requirements }).toEqual({
          id,
          requirements: { level: fromLookup, by: [{ kind: 'gem', name: 'Wolf Pack', group: 1, gemLevel: GEM_LEVEL }] },
        });
      }
      // The same gem sits under the level-70 boots on c1, so the skeleton's 64 is above every item it equips.
      expect(record.stages.c1.requirements).toEqual({ level: 70, by: [{ kind: 'item', name: 'Hale Rough Greaves', slot: 'Boots' }] });
    });

    it('requirements is the figure V1 checks: each stage is at or above its requirements.level, and V1 has no level-requirement finding', () => {
      for (const id of ['c1', 'r1a1e', 'b']) {
        const findings = record.stages[id].v1!.findings.filter((x) => /level-requirement$/.test(x.code));
        expect({ id, findings }).toEqual({ id, findings: [] });
        expect(record.stages[id].requirements!.level).toBeLessThanOrEqual(record.stages[id].level);
      }
    });
  });

  describe("D-423: a skeleton's reference hits", () => {
    it("the skeleton is written the budget rung's reference hits, the T15 map hit, and a campaign stage none", () => {
      const hits = (id: string) => Object.fromEntries(REFERENCE_HITS.map((h) => [h.option, record.stages[id].configWritten[h.option]]));
      expect(hits('b')).toEqual({ enemyPhysicalDamage: 402, enemyFireDamage: 97, enemyColdDamage: 97, enemyLightningDamage: 97, enemyChaosDamage: 97 });
      expect(hits('r1a1e')).toEqual(hits('b'));
      expect(Object.values(hits('c1'))).toEqual([undefined, undefined, undefined, undefined, undefined]);
    });

    it("so the skeleton's EHP is the rung's for the same build, and not the campaign stage's, which PoB measures against its default enemy", () => {
      const ehp = (id: string) => record.stages[id].outputs.TotalEHP;
      expect(ehp('r1a1e')).toBeGreaterThan(0);
      expect(ehp('r1a1e')).toBe(ehp('b'));
      expect(record.stages.b.measures!.ehp).toBe(ehp('r1a1e'));
      expect(ehp('c1')).not.toBe(ehp('r1a1e'));
      // The skeleton and the rung share their config set, the hits included; the campaign stage has its own.
      const configSet = (id: string) => record.sets.find((s) => s.kind === 'config' && s.stages.includes(id))!.id;
      expect(configSet('r1a1e')).toBe(configSet('b'));
      expect(configSet('c1')).not.toBe(configSet('r1a1e'));
    });
  });
});
