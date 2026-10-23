/**
 * WU-103 (amendment 9 §17 D-428, §24.1's ring-slot ruling): V1 reports PoB's warning past its skill slots as
 * `skill-slots`, naming the Unset Ring. AC-W82's V1 bullet, engine-required, in process.
 *
 * PoB counts the enabled groups that no item or passive grants (`Classes/SkillsTab.lua:1570-1608`) against
 * `SkillSlots`, 9 (`Modules/CalcSetup.lua:728`) plus one per "Grants 1 additional Skill Slot" (the Unset Ring's
 * implicit, `Data/Bases/ring.lua:85`), and warns past it (`Modules/CalcPerform.lua:3604-3609`, the line at
 * `Modules/Build.lua:2222`). The fixture is the committed two-stage plan with stage 2 given ten groups, each a gem of
 * the pinned data at its tier (`Data/Gems.lua`). Every expected value comes from PoB itself (Lua queries of the
 * compiled build) or the pinned source's text, never from the check's own output.
 *
 * - Ten groups: the stage's V1 holds one `skill-slots` finding with PoB's line, its counts and the Unset Ring as the
 *   remedy; no `pob-warning` carries the line; it stays in `pobWarnings.kept`.
 * - Ten groups and an Unset Ring: PoB allows ten, warns nothing, and V1 finds no `skill-slots`.
 */
import fs from 'fs';
import path from 'path';
import { afterAll, beforeAll, expect, it } from '@jest/globals';
import { engineDescribe } from '../helpers/engine';
import { startSessionFixture, type SessionFixture } from '../helpers/engineSession';
import type { CompileRecord, Finding } from '../../src/plan/record';

const REPO = path.resolve(__dirname, '..', '..');
const FIXTURE = path.join(REPO, 'tests', 'fixtures', 'plans', 'two-stage', 'plan.json');
const POB_SRC = path.join(REPO, 'vendor', 'PathOfBuilding-PoE2', 'src');
const ENGINE_TIMEOUT = 300_000;

type Json = Record<string, any>;

/** Eight more skill gems, each at its tier's gem level (`Data/Gems.lua`), beside stage 2's Boneshatter and Rolling Slam. */
const EXTRA: [string, number][] = [
  ['Earthquake', 1],
  ['Spark', 1],
  ['Ice Nova', 1],
  ['Frost Bomb', 1],
  ['Shield Charge', 3],
  ['Infernal Cry', 3],
  ['Armour Breaker', 3],
  ['Shockwave Totem', 3],
];

/** The fixture with stage 2 at ten groups; with `ring`, an Unset Ring in its Ring 1 slot. */
function tenGroups(ring: boolean): Json {
  const plan: Json = JSON.parse(fs.readFileSync(FIXTURE, 'utf8'));
  const two = plan.stages[1];
  for (const [name, level] of EXTRA) {
    two.skills.groups.push({ label: name, enabled: true, role: 'utility', gems: [{ name, level, quality: 0, enabled: true }] });
  }
  if (ring) two.items.slots.push({ slot: 'Ring 1', text: 'Rarity: Normal\nUnset Ring\nImplicits: 1\nGrants 1 additional Skill Slot' });
  return plan;
}

engineDescribe('WU-103: V1 reports PoB\'s skill-slot warning as `skill-slots`, naming the Unset Ring (D-428; AC-W82)', () => {
  let f: SessionFixture;
  let runs = 0;

  beforeAll(async () => {
    f = await startSessionFixture({ testActions: true });
  }, ENGINE_TIMEOUT);

  afterAll(async () => {
    await f?.close();
  }, 60_000);

  async function measure(plan: Json): Promise<CompileRecord> {
    runs += 1;
    const out = await f.call('guide_run', { new_run: `skill-slots-${runs}` });
    if (out.isError) throw new Error(`guide_run failed: ${out.text}`);
    const abs = /^Created run folder (.+)$/m.exec(out.text)![1];
    const planPath = /^plan_path for this run: (\S+)$/m.exec(out.text)![1];
    fs.writeFileSync(path.join(f.guides, planPath), `${JSON.stringify(plan, null, 2)}\n`);
    const compiled = await f.call('compile_plan', { plan_path: planPath, measure_only: true, stages: ['2'] });
    if (compiled.isError) throw new Error(`compile_plan failed: ${compiled.text}`);
    return JSON.parse(fs.readFileSync(path.join(abs, 'compile-record.json'), 'utf8')) as CompileRecord;
  }

  /** PoB's own skill slots and its count of the groups no item or passive grants, for the build as compiled. */
  async function pobCount(): Promise<{ allowed: number; groups: number }> {
    const { value } = await f.session.run({ tool: 'test:skill-slots-query', kind: 'read' }, async (ctx) => {
      const reply = await ctx.client.request('__test_eval', {
        code: `return { allowed = build.calcsTab.mainEnv.modDB:Sum("BASE", nil, "SkillSlots"), groups = GlobalGemAssignments.GemGroupCount }`,
      });
      return reply.result as { allowed: number; groups: number };
    });
    return value;
  }

  const v1Of = (record: CompileRecord, code: string): Finding[] =>
    (record.stages['2'].v1?.findings ?? []).filter((x) => x.code === code);

  /** PoB's line (`Modules/Build.lua:2222`), read from the pinned source and filled with PoB's counts. */
  function pobLine(allowed: number, groups: number): string {
    const build = fs.readFileSync(path.join(POB_SRC, 'Modules', 'Build.lua'), 'utf8').split(/\r?\n/);
    expect(build[2219]).toContain('itemWarnings.gemGroupCountWarning then');
    const src = build[2221];
    const m = /"(You have too many gem groups allocated\. Max allowed is )"\.\.warning\[1\]\.\."(\. You have )"\.\.warning\[2\]\.\."( non-item\/non-granted gem groups allocated\.)"/.exec(src);
    expect(m).not.toBeNull();
    return `${m![1]}${allowed}${m![2]}${groups}${m![3]}`;
  }

  it('ten groups: one `skill-slots` finding with PoB\'s line and counts, naming the Unset Ring; no `pob-warning` for it', async () => {
    const record = await measure(tenGroups(false));
    const pob = await pobCount();
    expect(pob).toEqual({ allowed: 9, groups: 10 });
    const line = pobLine(pob.allowed, pob.groups);
    const found = v1Of(record, 'skill-slots');
    expect(found.map((x) => x.data)).toEqual([{ line, allowed: 9, groups: 10 }]);
    expect(found[0].message).toContain('Unset Ring ("Grants 1 additional Skill Slot")');
    expect(record.stages['2'].v1!.pass).toBe(false);
    expect(v1Of(record, 'pob-warning').filter((x) => x.data?.line === line)).toEqual([]);
    expect(record.stages['2'].pobWarnings.kept).toContain(line);
  }, ENGINE_TIMEOUT);

  it('ten groups and an Unset Ring: PoB allows ten and V1 finds no `skill-slots`', async () => {
    const record = await measure(tenGroups(true));
    expect(await pobCount()).toEqual({ allowed: 10, groups: 10 });
    expect(v1Of(record, 'skill-slots')).toEqual([]);
    expect(record.stages['2'].pobWarnings.kept.filter((l) => l.startsWith('You have too many gem groups'))).toEqual([]);
  }, ENGINE_TIMEOUT);
});
