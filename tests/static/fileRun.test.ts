/**
 * Amendment 16's M-30, WU-164 (D-522, D-518, D-512; §18, §14, §8): a guide from a PoB file, in the skill's text.
 *
 * - AC-W144: `skills/build-guide/SKILL.md` has fewer than 325 lines.
 * - AC-W156 (static half): `/pob2:build-guide`'s description quotes a request for a guide to a player's own build (§12)
 *   and names the command on a build name or import code; the file entry (SKILL.md §1, `references/file-run.md`, the
 *   brief's `from`, `better` and `campaign` in `start.md`); the four D1 stage references' `ladder` sections; the
 *   designers' quality-20 line for a wand, staff or sceptre that grants a skill (D1-build, D1-finish; a quarterstaff is no
 *   staff; never a granted skill's gem quality; no caveat on skill level and quality modifiers, PG-115 not holding), and
 *   W1's and the templates' Arcanist's Etcher line.
 * - AC-W157 (static half): the designers' switched-buff lines (D1-build, D1-finish, §14) and W1's and the templates' line
 *   per switched buff, the "short on spirit" line pointing to them.
 */
import { describe, it, expect } from '@jest/globals';
import fs from 'fs';
import path from 'path';

const REPO = path.resolve(__dirname, '..', '..');
const BG = path.join(REPO, 'skills', 'build-guide');
const read = (...p: string[]) => fs.readFileSync(path.join(REPO, ...p), 'utf8');
const folded = (text: string) => text.replace(/\s+/g, ' ');
const SKILL_RAW = read('skills', 'build-guide', 'SKILL.md');
const SKILL = folded(SKILL_RAW);
const stage = (name: string) => folded(read('skills', 'build-guide', 'references', 'stages', `${name}.md`));
/** A Markdown file's H2 section by its heading, to the next H2. */
function section(text: string, heading: string): string {
  const at = text.indexOf(`\n## ${heading}`);
  if (at < 0) return '';
  const next = text.indexOf('\n## ', at + 1);
  return folded(next < 0 ? text.slice(at) : text.slice(at, next));
}
const description = /^description: (.*)$/m.exec(SKILL_RAW)?.[1] ?? '';

describe("AC-W144 (WU-164): /pob2:build-guide's SKILL.md size", () => {
  it('skills/build-guide/SKILL.md has fewer than 325 lines', () => {
    expect(SKILL_RAW.endsWith('\n')).toBe(true);
    expect(SKILL_RAW.split('\n').length - 1).toBeLessThan(325);
  });
});

describe('AC-W156 (WU-164, D-522, §12, §18): a guide from a file, in the skill text', () => {
  it("the description quotes a player's request for a guide to their own build, and names the command on a build name or import code", () => {
    expect(description).toContain('"a build guide for my build MyCharacter123"');
    expect(description).toContain("Also a guide from the player's own PoB file or import code (/pob2:build-guide <build name or import code>)");
    expect(description).toContain("made better first on request, the other rungs designed around it. Measuring or improving a character alone is /pob2:compile's.");
    expect(description.length).toBeLessThanOrEqual(1536);
  });

  it("the file entry: SKILL.md's §1 sends a run from a PoB file to file-run.md, whose steps replace 2a to 5", () => {
    expect(SKILL).toContain('**A run from a PoB file** (D-522): a request for a guide to the player\'s own build or file starts it ("a build guide for my build MyCharacter123"), its brief\'s `from`, `better` and `campaign`, its slug `file`. Read `${CLAUDE_PLUGIN_ROOT}/skills/build-guide/references/file-run.md` and do it: its own steps replace 2a to 5.');
    const start = folded(read('skills', 'build-guide', 'references', 'start.md'));
    expect(start).toContain("whose brief adds `from` (the build's name in the builds folder, or `\"import code\"`), `better` (`true`: the character made better first) and `campaign` (`false`: the campaign declined at the start). `skills/build-guide/references/file-run.md` gives its steps in place of the ones below.");
  });

  it("file-run.md gives the order: start (the brief, guide_run new_run file, init), read, measure, place, the better round, the ladder, a resume", () => {
    const text = read('skills', 'build-guide', 'references', 'file-run.md');
    expect(text.split('\n').filter((l) => l.startsWith('## '))).toEqual(['## 1. Start', '## 2. Read and measure (steps 2 and 3 of `skills/compile/SKILL.md`)', '## 3. Place (step `place`)', '## 4. The better round (with the brief\'s `better`; §17)', '## 5. The ladder (step 6a onward)', '## 6. A resume']);
    const f = folded(text);
    expect(f).toContain('`mcp__pob2__guide_run {new_run: "file"}`');
    expect(f).toContain('`pob2-run-log <runFolder> init` with `{"slug": "file", "brief", "mode", "testConfig", "noNinja"}`');
    expect(f).toContain('`mcp__pob2__plan_from_build {run_folder: <runFolderRel>, build_name}`');
    expect(f).toContain('its reference `skills/compile/references/stages/measure.md`');
    expect(f).toContain('its reference `skills/pricing/references/stages/price.md` (its placement scope)');
    expect(f).toContain('ask the user for the rung, never assumed');
    expect(f).toContain('**accept** places the result again, **revise** (`revise:<text>`) runs D1 again, **stop** ends the run `stopped`. After the accept: `place` once more');
    expect(f).toContain('D1\'s four steps with `scope: "ladder"`, `concept: "file"`, `buildFolder: "builds/file"`');
    expect(f).toContain('**The D1 gate** never fails the placed rung (the stage that keeps the reader\'s `source`) for its floor, tree or budget');
    expect(f).toContain('F1, then the campaign unless the brief declined it: D2 and the D2 gate');
    expect(f).toContain('R1a, R1b and the verification gate don\'t run');
  });

  it('each D1 stage reference has a ladder section: the placed rung kept, its rares specs, the other rungs designed, its findings never failing it', () => {
    const build = section(read('skills', 'build-guide', 'references', 'stages', 'D1-build.md'), 'The `ladder` scope (D-522)');
    expect(build).toContain('**The placed rung** keeps the file\'s design (or the round\'s), its stage `source`, id, `variant` and tree, changed only on the user\'s request');
    expect(build).toContain('its rares are turned into specs by pricing\'s rule for an owned rare');
    expect(build).toContain('each a trade in `trades.json`');
    expect(build).toContain('a rung below takes the placed rung\'s skill and supports with cheaper gear meeting its own target');
    expect(build).toContain('a rung above takes the placed rung as its seed and upgrades within its target');
    expect(build).toContain('Below the endgame (the read stage unplaced, choice A) design all three, seeded from the character, and keep no stage with `source`.');
    expect(section(read('skills', 'build-guide', 'references', 'stages', 'D1-tree.md'), 'The `ladder` scope (D-522)')).toContain('search the designed rungs only, as for any rung: the placed rung, the stage that keeps the reader\'s `source`, keeps its tree as it is');
    expect(section(read('skills', 'build-guide', 'references', 'stages', 'D1-finish.md'), 'The `ladder` scope (D-522)')).toContain('price its rares as the specs D1-build turned them into, by the spec loop');
    const gate = section(read('skills', 'build-guide', 'references', 'stages', 'D1-gate.md'), 'The `ladder` scope (D-522)');
    expect(gate).toContain('report its floor, tree and budget parts as findings, never failing it for them. Each of its floor findings');
    expect(gate).toContain('carries `cost`');
  });

  it("the designers raise a granting wand, staff or sceptre to quality 20, unpriced; never a granted skill's gem quality; no caveat on level and quality modifiers", () => {
    const build = stage('D1-build');
    expect(build).toContain('**A granted skill\'s quality** (D-512). Only a wand, a staff or a sceptre gives the skill it grants quality, its own `Quality:` line (a quarterstaff is no staff); you may raise one that grants a skill the build uses to quality 20, unpriced, which the guide tells the player to do with Arcanist\'s Etchers. Never give a granted skill\'s gem a quality: the plan\'s copy is at 0, and the compile writes the item\'s on it.');
    expect(build).toContain('Skill level and quality modifiers reach a granted skill as any other.');
    const finish = stage('D1-finish');
    expect(finish).toContain('a wand, staff or sceptre raised to quality 20 for the skill it grants (a quarterstaff is no staff) is priced at its base quality; the quality is the player\'s Arcanist\'s Etchers, unpriced');
    // PG-115 doesn't hold (M-29): nothing tells the player that an item's granted skill misses level or quality modifiers.
    for (const name of ['D1-build', 'D1-finish', 'W1']) expect({ name, caveat: /count the level by hand|misses (?:skill )?level/i.test(stage(name)) }).toEqual({ name, caveat: false });
  });

  it("W1 and the templates write the Arcanist's Etcher line for a granting wand, staff or sceptre", () => {
    expect(stage('W1')).toContain("**A granted skill's quality** (D-512). Where a rung's wand, staff or sceptre grants a skill the build uses, one line where the gear names it: raise its quality to 20 with Arcanist's Etchers, which gives <the skill> that quality. A quarterstaff gives none, and nothing else does");
    for (const t of ['guide-template.md', 'guide-endgame-template.md']) {
      expect({ t, line: read('skills', 'build-guide', 'templates', t).includes("Raise <the item> to quality 20 with Arcanist's Etchers: <the skill> takes its quality.") }).toEqual({ t, line: true });
    }
  });
});

describe('AC-W157 (WU-164, D-518, §14): the designers keep a buff switched as needed, and the guide writes its line', () => {
  it('D1-build and D1-finish may keep a buff the Spirit can\'t carry as switched, with when and off', () => {
    expect(stage('D1-build')).toContain("**A buff switched as needed** (D-518, schema 11). A buff the Spirit can't carry with the rest may stay, switched as needed, instead of being cut: its group `enabled: false` with `switch {when, off}`");
    expect(stage('D1-finish')).toContain("when a rung's Spirit can't carry a buff with the rest, you may switch it as D1-build does (`switch {when, off}`, the group `enabled: false`) instead of cutting it");
  });

  it("W1 writes §14's line per switched buff, the templates carry it, and the short-on-spirit line points to them", () => {
    expect(stage('W1')).toContain('one line in its skills, under the gems: `- <skill>: switch it on <when>; switch <skills> off for it.`');
    expect(stage('W1')).toContain("The run checker's `switched-buffs` looks for each.");
    for (const t of ['guide-template.md', 'guide-endgame-template.md']) {
      const text = read('skills', 'build-guide', 'templates', t);
      expect({ t, line: text.includes('<skill>: switch it on <when>; switch <its off groups\' skills> off for it.'), short: text.includes("On Spirit, see each rung's switch lines under its gems.") }).toEqual({ t, line: true, short: true });
    }
  });
});

describe('the file run in the run log reference and the task header', () => {
  it('run-log.md and task-header.md name the file run, its brief fields and the ladder scope', () => {
    const runLog = folded(read('skills', 'build-guide', 'references', 'run-log.md'));
    expect(runLog).toContain('| `from`, `better`, `campaign` | a run from a PoB file (D-522)');
    expect(runLog).toContain('**A file run** (D-522) is a pipeline log whose brief has `from`, slug `file`');
    expect(folded(read('skills', 'build-guide', 'references', 'task-header.md'))).toContain('and `ladder`, a file run\'s rungs around its placed one (D-522)');
    expect(fs.existsSync(path.join(BG, 'references', 'file-run.md'))).toBe(true);
  });
});
