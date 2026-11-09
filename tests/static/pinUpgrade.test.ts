/**
 * AC-W138's static half (WU-155, amendment 16 §4, D-508): what the upgrade script relies on, and what it changed
 * around it, no engine and no network.
 *
 * - S-2's probe is committed, `scripts/pob-internals.lua`, with its symbol list `scripts/pob-internals.symbols.json`
 *   (its engine half, every symbol resolving on the pin, is `tests/integration/pobInternals.test.ts`).
 * - The gate step runs mise.toml's test task: the script's `GATE_TASK` is that task's run list.
 * - The skill-slot tests find PoB's warning line by its text, and compilePlan.test.ts reads the pin from pob-pin.json,
 *   so a pin upgrade moves no line number or literal in them (§4, steps 4 and 6).
 * - CLAUDE.md's "Upgrading the PoB2 pin" names the script first, has step 8 (the patches' fingerprints) and the league
 *   launch note.
 */
import { spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { describe, it, expect } from '@jest/globals';

const REPO = path.resolve(__dirname, '..', '..');
const read = (...p: string[]) => fs.readFileSync(path.join(REPO, ...p), 'utf8');
const folded = (s: string) => s.replace(/\s+/g, ' ');

/** One of the script's exports, read by a child node (Jest compiles TypeScript as CommonJS and can't import it). */
function exported(name: string): unknown {
  const script = path.join(REPO, 'scripts', 'pin-upgrade.mjs');
  const r = spawnSync(process.execPath, ['--input-type=module', '-e', `const m = await import(${JSON.stringify(`file://${script}`)}); process.stdout.write(JSON.stringify(m[${JSON.stringify(name)}]));`], {
    cwd: REPO,
    env: { PATH: '/usr/bin:/bin', LANG: 'C' },
    encoding: 'utf8',
    timeout: 30_000,
  });
  if (r.status !== 0) throw new Error(r.stderr);
  return JSON.parse(r.stdout);
}

describe('AC-W138 (WU-155): the upgrade script\'s committed parts (D-508)', () => {
  it("S-2's probe and its symbol list are committed: groups of unique symbols, over S-2's 116, and the build it loads", () => {
    const probe = read('scripts', 'pob-internals.lua');
    expect(probe).toContain("dofile, 'HeadlessWrapper.lua'");
    expect(probe).toContain('whitespace normalization');
    const list = JSON.parse(read('scripts', 'pob-internals.symbols.json')) as { build: string; groups: Record<string, string[]> };
    const symbols = Object.values(list.groups).flat();
    expect(symbols.length).toBeGreaterThan(116);
    expect(new Set(symbols).size).toBe(symbols.length);
    for (const s of symbols) expect(s).toMatch(/^[A-Za-z_]\w*(\.[A-Za-z_]\w*)*(:[A-Za-z_]\w*)?$/);
    expect(fs.existsSync(path.join(REPO, list.build))).toBe(true);
    // The patched methods are probed too: a pin that changes them shows in the report.
    for (const s of ['build.skillsTab:ProcessSocketGroup', 'build.skillsTab:UpdateGlobalGemCountAssignments', 'build.itemsTab:Save', 'build.itemsTab:Load', 'modLib.parseModCache']) {
      expect(symbols).toContain(s);
    }
  });

  it("the gate step runs mise.toml's test task, line for line", () => {
    const toml = read('mise.toml');
    const task = toml.slice(toml.indexOf('[tasks.test]'));
    const run = /\nrun = \[\n([\s\S]*?)\n\]/.exec(task);
    expect(run).not.toBeNull();
    const lines = [...run![1].matchAll(/^\s*"((?:[^"\\]|\\.)*)",?\s*$/gm)].map((m) => m[1]);
    expect(exported('GATE_TASK')).toEqual(lines);
    expect(task).toContain('depends = ["pob:fetch"]');
  });

  it("the steps are §4's, in order", () => {
    expect(exported('STEPS')).toEqual(['stage', 'probe', 'fingerprints', 'pin', 'fetch', 'skillSlotMethod', 'gate', 'rulesIndex', 'reflag']);
    expect(exported('PIN_LITERAL_FILES')).toEqual(['tests/unit/pobPin.test.ts', 'tests/integration/protocol.lua.test.ts']);
  });

  it("the skill-slot tests find PoB's warning by its text, not a line number of Modules/Build.lua", () => {
    for (const file of ['tests/integration/skillSlots.test.ts', 'tests/unit/v1SkillSlots.test.ts']) {
      const text = read(file);
      expect({ file, byText: text.includes("includes('You have too many gem groups allocated')") }).toEqual({ file, byText: true });
      expect({ file, lineNumbers: text.match(/\[22\d\d\]|Build\.lua:222[02]/g) }).toEqual({ file, lineNumbers: null });
    }
  });

  it("compilePlan.test.ts reads the pin's tag and commit from pob-pin.json", () => {
    const text = read('tests', 'integration', 'compilePlan.test.ts');
    expect(text).toContain("fs.readFileSync(path.join(REPO, 'pob-pin.json'), 'utf8')");
    expect(text).toContain('pobTag: PIN.tag, pobCommit: PIN.commit');
    const pin = JSON.parse(read('pob-pin.json')) as { tag: string; commit: string };
    expect(text).not.toContain(pin.commit);
    expect(text).not.toContain(`'${pin.tag}'`);
  });

  it('CLAUDE.md names the script first, has step 8 for the fingerprints and the league launch note', () => {
    const claude = read('CLAUDE.md');
    const at = claude.indexOf('## Upgrading the PoB2 pin');
    const section = claude.slice(at, claude.indexOf('\n## ', at + 1));
    const intro = folded(section.slice(0, section.indexOf('\n1. ')));
    expect(intro).toContain('`node scripts/pin-upgrade.mjs <tag>`');
    expect(intro).toContain('a tagged release `v<n>.<n>.<n>` only, never a branch or a commit');
    expect(intro).toContain('commits nothing');
    expect(intro).toContain('`vendor/.pin-upgrade/<tag>/pin-upgrade-report.json`');
    const steps = section.split(/\n(?=\d+\. )/).filter((s) => /^\d+\. /.test(s)).map(folded);
    expect(steps.map((s) => Number(/^(\d+)\./.exec(s)![1]))).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(steps[7]).toContain('fingerprints (D-509)');
    expect(steps[7]).toContain('`scripts/patch-fingerprints.mjs`');
    expect(steps[7]).toContain('never retire it on that alone');
    // Step 5 no longer tells to move the skill-slot tests' line numbers.
    expect(steps[4]).not.toContain('line number');
    const launch = folded(section.slice(section.indexOf('**League launch.**')));
    expect(section).toContain('**League launch.**');
    expect(launch).toContain("Commit the new league's digest before or at its launch");
    expect(launch).toContain("Re-run the digest script when poe2db's dates move");
    expect(launch).toContain("`data/economy/prices.json`'s league name and dates");
  });
});
