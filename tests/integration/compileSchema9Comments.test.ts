/**
 * WU-128 (amendment 13 §10, D-469; AC-P88, R-68): a schema-9 custom modifier's reason, written as the comment line
 * `# <reason>` before its line in PoB's custom modifier box, through `compile_plan`, in process and engine-required. The
 * schema rows (a missing reason, a reason with a line break) are `tests/unit/planSchema9.test.ts`.
 *
 * PoB adds a custom line only when it parses whole (`Modules/ConfigOptions.lua`:2279-2297), so `# <reason>` reads as a
 * comment, unless PoB's parser takes the whole of it: a jewel function's pattern is found anywhere in a line
 * (`Modules/ModParser.lua`:6521-6529), so a reason holding "Increases and Reductions to Life in Radius are Transformed to
 * apply to Mana at 30% of their value" (`jewelOtherFuncs`, :6967-6969) parses whole even after `# ` (R-68).
 *
 * The stage is the two-stage fixture's stage 2 on `b`, with three custom lines: a damage line, a pool line whose reason
 * gives no coverage result (`custom-defence`), and one whose reason gives one. The same stage at schema 8 is the box as
 * before (the lines alone, joined by line breaks, `custom_mods_text` before the change).
 */
import fs from 'fs';
import path from 'path';
import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import { engineDescribe } from '../helpers/engine';
import { startSessionFixture, type SessionFixture } from '../helpers/engineSession';
import type { CompileRecord, Finding } from '../../src/plan/record';

const REPO = path.resolve(__dirname, '..', '..');
const TWO_STAGE = path.join(REPO, 'tests', 'fixtures', 'plans', 'two-stage', 'plan.json');
const ENGINE_TIMEOUT = 600_000;

type Json = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
const judgment = (ref: string) => ({ kind: 'judgment', ref, confidence: 'L' });
const read = (file: string): Json => JSON.parse(fs.readFileSync(file, 'utf8')) as Json;

const LINES = [
  { text: '10% more Damage', reason: "PoB doesn't apply the aggravation; 10% more damage stands in for it" },
  { text: '+1000 to maximum Energy Shield', reason: 'test fixture: a hand-calculated pool line with no coverage result' },
  { text: '+100 to maximum Life', reason: 'test fixture: a pool line for an unmodelled mechanic, coverage: unparsed' },
];
/** A reason PoB parses whole even as `# <reason>`: a jewel function's line, found anywhere in a line. */
const PARSED_REASON = 'Increases and Reductions to Life in Radius are Transformed to apply to Mana at 30% of their value';

function stage(id: string, mods: Json[]): Json {
  const s = read(TWO_STAGE).stages[1];
  Object.assign(s, {
    id,
    loadoutName: `Budget (L80) {${id}}`,
    level: 80,
    progress: 'endgame',
    variant: 'budget',
    ascendancyPoints: 0,
    variantBasis: { level: judgment('t'), gemLevels: judgment('t'), ascendancyPoints: judgment('t') },
    claims: [],
  });
  s.config.customMods = mods;
  return s;
}

function planOf(version: number, stages: Json[]): Json {
  const p = read(TWO_STAGE);
  Object.assign(p, { schemaVersion: version, stages, ledger: [] });
  return p;
}

/** XML attribute text, decoded as PoB's `runtime/lua/xml.lua` encodes it. */
const decode = (s: string) => s.replace(/&(lt|gt|amp|apos|quot);/g, (_, e: string) => ({ lt: '<', gt: '>', amp: '&', apos: "'", quot: '"' })[e]!);

/** The saved `customMods` text of the config set the stage uses (the record's sets give its id). */
function savedCustomMods(xml: string, record: CompileRecord, id: string): string | undefined {
  const setId = record.sets.find((s) => s.kind === 'config' && s.stages.includes(id))!.id;
  for (const m of xml.matchAll(/<ConfigSet\b([^>]*?)>([\s\S]*?)<\/ConfigSet>/g)) {
    if (Number(/\bid="(\d+)"/.exec(m[1])![1]) !== setId) continue;
    for (const input of m[2].matchAll(/<Input\b([^>]*?)\/>/g)) {
      if (/\bname="customMods"/.test(input[1])) return decode(/\bstring="([^"]*)"/.exec(input[1])![1]);
    }
  }
  return undefined;
}

const codesOf = (record: CompileRecord, id: string, code: string): Finding[] => record.stages[id].v1!.findings.filter((f) => f.code === code);

engineDescribe('WU-128: comment lines in the custom modifiers (amendment 13 §10, D-469; AC-P88, R-68)', () => {
  let f: SessionFixture;
  let nine: { record: CompileRecord; xml: string };
  let eight: { record: CompileRecord; xml: string };
  let parsed: string;

  async function runFolder(slug: string, plan: Json): Promise<{ abs: string; planPath: string }> {
    const made = await f.call('guide_run', { new_run: slug });
    if (made.isError) throw new Error(`guide_run failed: ${made.text}`);
    const abs = /^Created run folder (.+)$/m.exec(made.text)![1];
    const planPath = /^plan_path for this run: (\S+)$/m.exec(made.text)![1];
    fs.writeFileSync(path.join(f.guides, planPath), `${JSON.stringify(plan, null, 2)}\n`);
    return { abs, planPath };
  }

  async function compiled(slug: string, plan: Json): Promise<{ record: CompileRecord; xml: string }> {
    const { abs, planPath } = await runFolder(slug, plan);
    const out = await f.call('compile_plan', { plan_path: planPath, measure_only: true });
    expect({ slug, isError: out.isError, text: out.isError ? out.text : '' }).toEqual({ slug, isError: false, text: '' });
    return {
      record: read(path.join(abs, 'compile-record.json')) as unknown as CompileRecord,
      xml: fs.readFileSync(path.join(abs, 'compiled-build.xml'), 'utf8'),
    };
  }

  beforeAll(async () => {
    f = await startSessionFixture({ testActions: true });
    nine = await compiled('comments-9', planOf(9, [stage('b', LINES)]));
    eight = await compiled('comments-8', planOf(8, [stage('b', LINES)]));
    const bad = await runFolder('comments-parsed', planOf(9, [stage('b', [LINES[0], { text: '+10 to maximum Life', reason: PARSED_REASON }])]));
    const out = await f.call('compile_plan', { plan_path: bad.planPath, measure_only: true });
    parsed = out.isError ? out.text : `compiled: ${out.text}`;
  }, ENGINE_TIMEOUT);

  afterAll(async () => f?.close(), 60_000);

  describe('the written text', () => {
    it("AC-P88: a schema-9 stage's saved customMods text holds `# <reason>` before each line, in order", () => {
      expect(savedCustomMods(nine.xml, nine.record, 'b')).toBe(LINES.flatMap((m) => [`# ${m.reason}`, m.text]).join('\n'));
    });

    it("AC-P88: a schema-8 plan's saved text equals the text before the change: the lines alone", () => {
      expect(savedCustomMods(eight.xml, eight.record, 'b')).toBe(LINES.map((m) => m.text).join('\n'));
    });

    it('§10: the comments add no modifier: the stage measures the same at 8 and 9', () => {
      expect(nine.record.stages.b.outputs).toEqual(eight.record.stages.b.outputs);
      expect(nine.record.stages.b.skillOutputs).toEqual(eight.record.stages.b.skillOutputs);
    });
  });

  describe('what reads the custom lines', () => {
    it('AC-P88: the estimate mark and customModsWritten read the lines, not the comments', () => {
      expect(nine.record.stages.b.computedWithCustomMods).toBe(true);
      expect(nine.record.stages.b.computedWithCustomMods).toBe(eight.record.stages.b.computedWithCustomMods);
      expect(nine.record.stages.b.customModsWritten).toEqual(LINES.map((m) => m.text));
      expect(nine.record.stages.b.customModsWritten).toEqual(eight.record.stages.b.customModsWritten);
    });

    it('AC-P88: custom-defence finds the same lines with comments as without', () => {
      expect(codesOf(nine.record, 'b', 'custom-defence').map((x) => x.data)).toEqual([
        { path: 'config.customMods[1].reason', text: LINES[1].text, stats: ['EnergyShield'] },
      ]);
      expect(codesOf(nine.record, 'b', 'custom-defence')).toEqual(codesOf(eight.record, 'b', 'custom-defence'));
    });
  });

  describe('R-68: a comment never adds a modifier', () => {
    it('AC-P88: a reason that parses whole as a modifier is a compile defect naming the entry; nothing is compiled', () => {
      expect(parsed).toContain('nothing was compiled');
      expect(parsed).toContain(
        `stage b: config.customMods[1].reason: PoB parses its comment line "# ${PARSED_REASON}" whole as a modifier, so its ` +
          'customMods option would add it: reword the reason (D-469)',
      );
      expect(parsed).not.toContain('config.customMods[0]');
    });
  });
});
