/**
 * AC-E16 (C-8 kinds, verified through the engine session): in process, engine-required.
 *
 * For every `expect:"ok"` sample in `tests/fixtures/tool-calls.json` whose call's engine kind is `read`,
 * `mutate` or `load` and that has no allowlist entry for check (ii) (the kind is the router's
 * `engineKindFor`: the tool's `TOOL_META.engine`, unless a per-call rule decides it from the arguments, as
 * D-244 does for `manage_sets {action:"list"}`, a read):
 *  1. a fresh golden file is loaded, the sample's setup steps run, then the canonical export
 *     (`export_build_xml` minus `<PlayerStat>`, `<MinionStat>`, `<FullDPSSkill>`) is taken before and
 *     after the sample, in the same engine process;
 *  2. `read` ⇒ the exports are identical; `mutate`/`load` ⇒ they differ, unless the sample declares
 *     `stateChange: false` with a reason;
 *  3. `revision` grows by exactly 1 for `mutate`/`load` and by 0 for `read` (no file changes on disk).
 * A failing mutate sample (`set_gem_level` with a bad gem index) leaves `revision` unchanged.
 *
 * WU-13: a `read` sample whose tool runs `withTemporaryBuild` (D-9: `analyze_build`, `compare_builds`,
 * `export_build` with notes) reloads the working build, and PoB2 then serializes it in a different
 * `pairs()` order; for those samples only, the exports are compared modulo that order
 * (`tests/helpers/reloadCanonical.ts`). Every other sample keeps the strict comparison, so a read tool
 * that reloaded the build behind the session's back would still be caught.
 */
import fs from 'fs';
import path from 'path';
import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { engineDescribe } from '../helpers/engine';
import { GOLDEN_XML, canonicalExport, startSessionFixture, type SessionFixture } from '../helpers/engineSession';
import { canonicalExportAcrossReload } from '../helpers/reloadCanonical';
import { TOOL_META } from '../../src/server/toolMeta';
import { engineKindFor } from '../../src/server/toolRouter';
import { encodePobCode } from '../../src/utils/buildCode';

interface Step {
  tool: string;
  args: Record<string, unknown>;
}
interface Sample extends Step {
  expect: 'ok' | 'error';
  setup?: Step[];
  reason?: string;
  stateChange?: boolean;
  stateChangeReason?: string;
}

const FIXTURES = path.resolve(__dirname, '..', 'fixtures');
const SAMPLES = JSON.parse(fs.readFileSync(path.join(FIXTURES, 'tool-calls.json'), 'utf8')) as Sample[];
const ALLOWLIST = JSON.parse(fs.readFileSync(path.join(FIXTURES, 'tool-hygiene-allowlist.json'), 'utf8')) as Array<{
  tool: string;
  check: string;
}>;
/** `$TWO_STAGE_PLAN` (WU-41): the two-stage fixture plan, copied into the fixture's guides folder at this path. */
const TWO_STAGE_PLAN = 'two-stage/fixture-1/plan.json';
/** `$COUNT_PLAN` (WU-55): the two-stage plan with a Count and a custom modifier, copied in the same way. */
const COUNT_PLAN = 'two-stage-count/fixture-1/plan.json';
const PLACEHOLDERS: Record<string, unknown> = {
  $TWO_STAGE_PLAN: TWO_STAGE_PLAN,
  $COUNT_PLAN: COUNT_PLAN,
  $RUBY_RING_TEXT: fs.readFileSync(path.join(FIXTURES, 'items', 'ruby-ring.txt'), 'utf8'),
  $JEWEL_TEXT: fs.readFileSync(path.join(FIXTURES, 'items', 'jewel.txt'), 'utf8'),
  $GOLDEN_BUILD_CODE: encodePobCode(GOLDEN_XML),
  $ALLOCATED_NODES: (/<Spec\b[^>]*\snodes="([^"]*)"/.exec(GOLDEN_XML) as RegExpExecArray)[1].split(',').map(Number),
};
function resolve(value: unknown): unknown {
  if (typeof value === 'string' && value.startsWith('$')) {
    if (!(value in PLACEHOLDERS)) throw new Error(`unknown placeholder ${value} in tool-calls.json`);
    return PLACEHOLDERS[value];
  }
  if (Array.isArray(value)) return value.map(resolve);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, resolve(v)]));
  return value;
}

const ENGINE_KINDS = new Set(['read', 'mutate', 'load']);
const allowedII = (tool: string) => ALLOWLIST.some((e) => e.tool === tool && e.check === 'ii');
const CHECKED = SAMPLES.map((s, n) => ({ sample: s, n })).filter(
  ({ sample }) =>
    sample.expect === 'ok' &&
    TOOL_META[sample.tool] !== undefined &&
    ENGINE_KINDS.has(engineKindFor(sample.tool, sample.args)) &&
    !ALLOWLIST.some((e) => e.tool === sample.tool && e.check === 'ii'),
);

describe('AC-E16: tool-calls.json declares state changes well-formed', () => {
  it('AC-E16: every stateChange:false sample is a mutate/load sample with a stateChangeReason', () => {
    for (const s of SAMPLES.filter((x) => x.stateChange === false)) {
      expect(['mutate', 'load']).toContain(engineKindFor(s.tool, s.args));
      expect(typeof s.stateChangeReason === 'string' && s.stateChangeReason.trim().length > 0).toBe(true);
    }
  });

  it('AC-E16: the checked set covers every read, mutate and load tool that has an ok sample', () => {
    const tools = new Set(CHECKED.map((c) => c.sample.tool));
    const missing = Object.entries(TOOL_META)
      .filter(([name, meta]) => ENGINE_KINDS.has(meta.engine) && SAMPLES.some((s) => s.tool === name && s.expect === 'ok'))
      .filter(([name]) => !ALLOWLIST.some((e) => e.tool === name && e.check === 'ii'))
      .map(([name]) => name)
      .filter((name) => !tools.has(name));
    expect(missing).toEqual([]);
  });
});

engineDescribe('AC-E16: C-8 engine kinds match what each tool does to the engine', () => {
  let f: SessionFixture;
  let golden: string;

  beforeAll(async () => {
    f = await startSessionFixture();
    golden = path.join(f.builds, 'grenadator.xml');
    // $TWO_STAGE_PLAN: the compile_plan and guide_run samples read the fixture from the guides folder.
    fs.mkdirSync(path.dirname(path.join(f.guides, TWO_STAGE_PLAN)), { recursive: true });
    fs.copyFileSync(path.join(FIXTURES, 'plans', 'two-stage', 'plan.json'), path.join(f.guides, TWO_STAGE_PLAN));
    fs.mkdirSync(path.dirname(path.join(f.guides, COUNT_PLAN)), { recursive: true });
    fs.copyFileSync(path.join(FIXTURES, 'plans', 'two-stage-count', 'plan.json'), path.join(f.guides, COUNT_PLAN));
  }, 180000);
  afterAll(async () => f?.close(), 30000);

  const freshGolden = async () => {
    fs.writeFileSync(golden, GOLDEN_XML, 'utf8');
    const load = await f.call('lua_load_build', { build_name: 'grenadator.xml' });
    if (load.isError) throw new Error(`loading the golden build failed: ${load.text}`);
  };

  /** The sample's tool runs `withTemporaryBuild` (D-9), which reloads the working build. */
  const reloadsWorkingBuild = (s: Sample) =>
    s.tool === 'analyze_build' || s.tool === 'compare_builds' || (s.tool === 'export_build' && s.args.notes !== undefined);

  CHECKED.forEach(({ sample, n }) => {
    const kind = engineKindFor(sample.tool, sample.args);
    const exportOf = reloadsWorkingBuild(sample) ? canonicalExportAcrossReload : canonicalExport;
    it(`AC-E16: ${sample.tool} #${n} (${kind})`, async () => {
      await freshGolden();
      for (const step of sample.setup ?? []) {
        const out = await f.call(step.tool, resolve(step.args) as Record<string, unknown>);
        // A setup tool with a known (allowlisted) check (ii) failure may still have done its engine
        // work (e.g. create_spec creates the spec, then mis-renders the reply); anything else aborts.
        if (out.isError && !allowedII(step.tool)) throw new Error(`setup ${step.tool} failed: ${out.text}`);
      }
      const before = await exportOf(f.session);
      const revision = f.session.revision;
      const pid = f.session.enginePid();

      const out = await f.call(sample.tool, resolve(sample.args) as Record<string, unknown>);
      expect({ tool: sample.tool, isError: out.isError, text: out.isError ? out.text : '' }).toEqual({
        tool: sample.tool,
        isError: false,
        text: '',
      });
      const delta = f.session.revision - revision;
      const after = await exportOf(f.session);
      // Same engine process: a restart would make the comparison meaningless.
      expect(f.session.enginePid()).toBe(pid);

      if (kind === 'read') {
        expect({ tool: sample.tool, identical: after === before }).toEqual({ tool: sample.tool, identical: true });
        expect(delta).toBe(0);
      } else {
        if (sample.stateChange !== false) {
          expect({ tool: sample.tool, changed: after !== before }).toEqual({ tool: sample.tool, changed: true });
        }
        expect(delta).toBe(1);
      }
    }, 180000);
  });

  // AC-P38, AC-B3 (D-216, D-356): a guide_run call carrying new_run or view is routed as kind none, so the
  // checked set above leaves it out; it must still leave the export and revision unchanged and take no
  // session lock.
  it('AC-P38/AC-B3: guide_run new_run and view samples (kind none) leave the export and revision unchanged and emit no session event', async () => {
    const samples = SAMPLES.filter((s) => s.tool === 'guide_run' && s.expect === 'ok' && engineKindFor(s.tool, s.args) === 'none');
    expect(samples.some((s) => s.args.new_run !== undefined)).toBe(true);
    expect(samples.filter((s) => s.args.view !== undefined).length).toBe(2);
    for (const sample of samples) {
      expect(engineKindFor(sample.tool, sample.args)).toBe('none');
      await freshGolden();
      const before = await canonicalExport(f.session);
      const revision = f.session.revision;
      const events: string[] = [];
      const off = f.session.onEvent((e) => events.push(`${e.tool}:${e.phase}`));
      const out = await f.call(sample.tool, resolve(sample.args) as Record<string, unknown>);
      off();
      expect({ isError: out.isError, text: out.isError ? out.text : '' }).toEqual({ isError: false, text: '' });
      expect(events).toEqual([]);
      expect(f.session.revision).toBe(revision);
      expect(await canonicalExport(f.session)).toBe(before);
    }
  }, 180000);

  it('AC-E16: a failing mutate sample (set_gem_level with a bad gem index) leaves revision unchanged', async () => {
    const bad = SAMPLES.find((s) => s.tool === 'set_gem_level' && s.expect === 'error');
    expect(bad).toBeDefined();
    await freshGolden();
    const revision = f.session.revision;
    const out = await f.call(bad!.tool, bad!.args);
    expect(out.isError).toBe(true);
    expect(f.session.revision).toBe(revision);
  }, 180000);
});
