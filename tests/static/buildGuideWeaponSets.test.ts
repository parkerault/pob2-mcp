/**
 * Amendment 9 (M-22), WU-101: AC-W80, the skill text for weapon sets (D-426) and PG-71.
 *
 * - `templates/card-template.md`: the identity's `Weapon sets:` line, with the four uses D-426 names (none, a second
 *   tree, a second weapon, a set-2 buff).
 * - `references/stages/R1a.md`: checks each card for its weapon-set use (`RV.md` did too, until amendment 11
 *   removed the rival, D-443).
 * - `references/stages/D1-build.md`: every set a card's skills use measured (the record's `outputsSet2`), Spirit
 *   on each set, and a set-2 buff measured on set 2 and carried to set 1 as a custom modifier with its reason.
 * - `references/stages/D1-tree.md` and `D1-gate.md`: the pool moves, by the line the tool gives them
 *   (`Best swap (weapon set <n>): …`, C-55a), applied like a main swap within the pool's points.
 * - `references/stages/W1.md` and both guide templates: what a swap costs in Life when set 2's tree holds less.
 * - `docs/build-guide/pob-gaps.md`: PG-71, PoB's support count across both sets (`Modules/CalcSetup.lua:2101`).
 *
 * The four uses are read from the amendment and the pool line's form from the M-22 handoff's fixed formats, so the
 * text is held to the spec, and the handler is checked to print that line, so the skill text names what the tool
 * prints.
 */
import { describe, it, expect } from '@jest/globals';
import fs from 'fs';
import path from 'path';

const REPO = path.resolve(__dirname, '..', '..');
const SKILL_DIR = path.join(REPO, '.claude', 'skills', 'build-guide');
const STAGES_DIR = path.join(SKILL_DIR, 'references', 'stages');
const SPEC = path.join(REPO, 'docs', 'build-guide', 'spec', 'amendment-9-endgame-first.md');
/** The M-22 build handoff, whose "Formats fixed before the build" give the pool move's line (§24.2's C-55a). */
const HANDOFF = path.join(REPO, 'docs', 'build-guide', 'build-handoff-amendments.md');

const read = (file: string) => (fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '');
/** One paragraph or list item per entry, with its line breaks folded, so a rule split over lines reads whole. */
const folded = (text: string) => text.replace(/\s*\n\s*/g, ' ');
const stage = (name: string) => folded(read(path.join(STAGES_DIR, `${name}.md`)));
const template = (name: string) => read(path.join(SKILL_DIR, 'templates', name));
const spec = folded(read(SPEC));
const handoff = folded(read(HANDOFF));

/** D-426's four weapon-set uses, as the amendment lists them: "(none, a second tree, a second weapon, a set-2 buff)". */
const USES = (() => {
  const m = /The card names its weapon-set use \(([^)]+)\)/.exec(spec);
  if (!m) throw new Error("the amendment doesn't name the card's weapon-set uses (D-426)");
  return m[1].split(/,\s*/);
})();

/** C-55a's pool line, as the M-22 handoff's formats fix it: `Best swap (weapon set <1|2>): …`. */
const POOL_LINE = (() => {
  if (!/C-55a, `get_node_power`'s swap\*\* may move weapon-set nodes within their own pool/.test(spec)) {
    throw new Error("the amendment doesn't state C-55a");
  }
  const m = /its best-swap line names the pool, `(Best swap \(weapon set <1\|2>\)): …`, in the main swap's form/.exec(handoff);
  if (!m) throw new Error("the M-22 handoff doesn't give the pool move's line (C-55a)");
  return m[1];
})();

describe('AC-W80 (WU-101): the skill text for weapon sets (D-426) and PG-71', () => {
  it('reads the four uses from the amendment and the pool line from the M-22 formats', () => {
    expect(USES).toEqual(['none', 'a second tree', 'a second weapon', 'a set-2 buff']);
    expect(POOL_LINE).toBe('Best swap (weapon set <1|2>)');
    // The tool prints that line: its handler names the pool in the main swap's form.
    expect(read(path.join(REPO, 'src', 'handlers', 'treeHandlers.ts'))).toContain('`Best swap (weapon set ${pool.set})`');
  });

  it("the card template's identity has the Weapon sets line, with D-426's four uses", () => {
    const raw = template('card-template.md');
    const identity = raw.slice(raw.indexOf('### Identity'), raw.indexOf('### Pitch'));
    const line = folded(identity.split(/\n(?=- )/).find((l) => l.startsWith('- Weapon sets:')) ?? '');
    expect(line).not.toBe('');
    for (const use of USES) expect({ use, named: line.includes(use) }).toEqual({ use, named: true });
    expect(line).toMatch(/when the player swaps/);
  });

  // Amendment 11 (WU-114, D-443): RV.md is deleted with the rival, so only R1a's check remains.
  it("R1a checks each card for its weapon-set use, and names PG-71's overstated support count", () => {
    const r1a = stage('R1a');
    expect(r1a).toMatch(/\*\*Weapon sets\*\* \(D-426\): every card's identity has the line `Weapon sets:`/);
    for (const use of USES) expect({ use, named: r1a.includes(`\`${use}\``) }).toEqual({ use, named: true });
    expect(r1a).toMatch(/Check each card for it before you write `none`/);
    expect(r1a).toMatch(/PG-71/);
  });

  it('D1-build measures every set the skills use, Spirit on each set, and carries a set-2 buff to set 1 as a custom modifier with its reason', () => {
    const d1 = stage('D1-build');
    expect(d1).toMatch(/\*\*Measure every set the card's skills use:\*\*/);
    expect(d1).toMatch(/records the same key figures as `outputsSet2` beside `outputs`/);
    expect(d1).toMatch(/\*\*Spirit on each set:\*\* V1 reports PoB's Spirit warning on set 1 and `Your unreserved Spirit is negative on weapon set 2` on set 2/);
    expect(d1).toMatch(/\*\*A set-2 buff\*\* \(a buff cast from set 2, which keeps set 2's effect while set 1 is out\) is measured on set 2/);
    expect(d1).toMatch(/carry it to set 1 as a `config\.customMods` entry whose `reason` says it is the set-2 buff's effect, measured on set 2/);
    // The line V1 writes is the one the code writes.
    const v1 = read(path.join(REPO, 'src', 'plan', 'checks', 'v1.ts'));
    expect(v1).toContain("export const SPIRIT_WARNING = 'Your unreserved Spirit is negative';");
    expect(v1).toContain('`${SPIRIT_WARNING} on weapon set 2`');
  });

  it('D1-tree and D1-gate allow pool moves, by the tool\'s line, applied like a main swap within the pool\'s points', () => {
    const tree = stage('D1-tree');
    const pool = POOL_LINE.replace('<1|2>', '<n>');
    expect(tree).toContain(`\`${pool}: none: …\``);
    expect(tree).toMatch(/Apply it like a main swap \(a change, below\), with its nodes in the pool's list too/);
    expect(tree).toMatch(/A pool move goes up the ladder in its pool/);
    expect(tree).toMatch(/\*\*Pool moves\*\* run in the same loop/);
    expect(tree).toMatch(/a pool move stays within its pool's points, and V1's `weapon-set-points` checks it/);
    const gate = stage('D1-gate');
    expect(gate).toContain(`\`${pool}: …\``);
    expect(gate).toMatch(/A pool move is allowed, as D1-tree applies it; the rung's swap left is the line, main or pool, that gains most/);
    expect(gate).toMatch(/a pool move's naming its set \(`b: weapon set 2: /);
    expect(gate).toMatch(/`bestSwap`, the swap left \(the main swap or a pool move, whichever gains most\)/);
  });

  it("W1 and both guide templates say what a swap costs in Life when set 2's tree holds less", () => {
    const w1 = stage('W1');
    expect(w1).toMatch(/\*\*A weapon swap's Life cost\*\* \(D-426\)\. On a rung whose record stage has `outputsSet2`/);
    expect(w1).toMatch(/your Life falls from about <`outputs\.Life`> to about <`outputsSet2\.Life`> while set 2 is out/);
    for (const name of ['guide-endgame-template.md', 'guide-template.md']) {
      const t = template(name);
      const lines = t.split('\n').filter((l) => /Weapon swap:?\**:? swapping to weapon set 2 drops your Life from about <outputs\.Life> to about <outputsSet2\.Life>/.test(l));
      // One per endgame rung: entering maps, budget and non-budget.
      expect({ name, rungs: lines.length }).toEqual({ name, rungs: 3 });
      for (const l of lines) expect(l).toMatch(/^(- )?\[only when the stage's record has outputsSet2 with less Life than its outputs, D-426\]/);
    }
  });

  it("pob-gaps.md holds PG-71: PoB counts both sets' socketed supports, the game the active set's (the user's Gem Studded test)", () => {
    const gaps = read(path.join(REPO, 'docs', 'build-guide', 'pob-gaps.md'));
    const at = gaps.indexOf('- **PG-71, ');
    expect(at).toBeGreaterThan(0);
    const entry = folded(gaps.slice(at, gaps.indexOf('\n- **', at + 1)));
    expect(entry).toMatch(/PG-71, socketed supports are counted across both weapon sets\.\*\* bug/);
    expect(entry).toContain('`Modules/CalcSetup.lua:2101-2105`');
    expect(entry).toMatch(/Gem Studded/);
    expect(entry).toMatch(/2026-10-19/);
    expect(entry).toMatch(/only the active weapon set's socketed supports/);
    // The cited lines are PoB's own comment at the pin.
    const calcSetup = read(path.join(REPO, 'vendor', 'PathOfBuilding-PoE2', 'src', 'Modules', 'CalcSetup.lua')).split('\n');
    if (calcSetup.length > 1) {
      expect(calcSetup.slice(2100, 2105).join('\n')).toMatch(/it ends up counting all support gems when it should only take into account the active weapon set/);
    }
  });
});
