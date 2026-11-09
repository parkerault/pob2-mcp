/**
 * Amendment 16's M-30, WU-162 (D-519, D-521; §12, §15, §17, a15 §8): `/pob2:compile`, the static parts.
 *
 * - AC-W153: `skills/compile/SKILL.md` exists with fewer than 150 lines, frontmatter `name` and `description` only, the
 *   description at most 1,536 characters, naming when to use it, quoting at least two requests in a player's words (§12,
 *   choice F), and sending the rest to `/pob2:build-guide`, `/pob2:pricing` and `/pob2:game-knowledge`; its runner reads
 *   `runner-rules.md` first, and matches a named build against `list_builds`, never guessing; `measure.md` holds §15's
 *   parts (the engagement, the measure-only compile with `measure_as`, the Spirit question and its `switch_off` answer, the
 *   callouts (a) to (g), (a) judged for the inputs PoB doesn't gate, the summary against the non-budget rung's targets,
 *   choice A, the file card); the coordinator's step table names `measure`; game knowledge's description names the three
 *   new commands; every root-folder path in the piece's files resolves (and AC-W115's own test reads them).
 * - AC-W154's static part: D1-build, D1-tree, D1-finish and D1-gate each hold a `scope: "better"` section, with §17's
 *   rules (the start from the read stage and the keep list; the character's own tree; the replacements priced and each
 *   change a trade; a target the budget can't reach a finding with its cost); the task header documents the scope.
 */
import { describe, it, expect } from '@jest/globals';
import fs from 'fs';
import path from 'path';

const REPO = path.resolve(__dirname, '..', '..');
const read = (...rel: string[]) => fs.readFileSync(path.join(REPO, ...rel), 'utf8');
/** The text with every whitespace run collapsed to one space, so a phrase split by a hard wrap is still seen. */
const folded = (text: string) => text.replace(/\s+/g, ' ');

const RAW = read('skills', 'compile', 'SKILL.md');
const FRONT = /^---\n([\s\S]*?)\n---\n/.exec(RAW);
const BODY_RAW = FRONT ? RAW.slice(FRONT[0].length) : RAW;
const BODY = folded(BODY_RAW);
const FIELDS = new Map((FRONT?.[1] ?? '').split('\n').map((l) => [l.slice(0, l.indexOf(': ')), l.slice(l.indexOf(': ') + 2)] as [string, string]));
const DESCRIPTION = FIELDS.get('description') ?? '';
const MEASURE = folded(read('skills', 'compile', 'references', 'stages', 'measure.md'));
const STAGE = (name: string) => read('skills', 'build-guide', 'references', 'stages', `${name}.md`);
/** A Markdown file's H2 section by its heading, folded; throws when it is missing. */
function section(text: string, heading: string): string {
  const parts = text.split(/^(## .+)$/m);
  const i = parts.indexOf(heading);
  if (i < 0) throw new Error(`no "${heading}"`);
  return folded(parts[i + 1]);
}

describe('AC-W153 (WU-162, D-519): skills/compile/SKILL.md', () => {
  it('exists with fewer than 150 lines and frontmatter name and description only, the description at most 1,536 characters', () => {
    const lines = RAW.split('\n');
    if (lines[lines.length - 1] === '') lines.pop();
    expect(lines.length).toBeGreaterThan(40);
    expect(lines.length).toBeLessThan(150);
    expect(FRONT).not.toBeNull();
    expect([...FIELDS.keys()]).toEqual(['name', 'description']);
    expect(FIELDS.get('name')).toBe('compile');
    expect(DESCRIPTION.length).toBeGreaterThan(200);
    expect(DESCRIPTION.length).toBeLessThanOrEqual(1536);
    // A plain YAML scalar: no indicator first, no ': ' or ' #' inside, so the value reads as written.
    expect(DESCRIPTION).toMatch(/^[A-Za-z]/);
    expect(DESCRIPTION).not.toMatch(/: | #/);
  });

  it("names when to use it, quoting the requests players make in their own words (§12, choice F), and the other commands for the rest", () => {
    expect(DESCRIPTION).toContain('/pob2:compile <build name or import code> [--offline] [--no-ninja]');
    expect(DESCRIPTION).toContain('/pob2:compile --resume <run folder>');
    const quoted = [...DESCRIPTION.matchAll(/"([^"]+)"/g)].map((m) => m[1]);
    // §15's own: "what does my character do", "measure my build", "make my character better", and review's question
    // until amendment 17 gives it a skill.
    for (const q of ['what does my character do', 'measure my build MyCharacter123', 'make my character better', 'how can I make this build better']) expect(quoted).toContain(q);
    expect(quoted.length).toBeGreaterThanOrEqual(2);
    expect(DESCRIPTION).toMatch(/Not for a build guide, from a brief or from the player's file \("a build guide for my build MyCharacter123", use \/pob2:build-guide\)/);
    expect(DESCRIPTION).toMatch(/what the gear costs or which rung it sits on \("what is my gear worth", use \/pob2:pricing\)/);
    expect(DESCRIPTION).toContain('or a game question (use /pob2:game-knowledge)');
    expect(DESCRIPTION).toContain("A review of a PoB file isn't a pob2 skill yet.");
  });

  it('tells its runner to read runner-rules.md whole before anything else, and again after a compaction', () => {
    expect(BODY).toContain('**Before anything else, read `${CLAUDE_PLUGIN_ROOT}/skills/build-guide/references/runner-rules.md` whole**, and again after a compaction');
    expect(BODY_RAW.indexOf('**Before anything else')).toBeGreaterThan(0);
    expect(BODY_RAW.indexOf('**Before anything else')).toBeLessThan(BODY_RAW.indexOf('\n## '));
  });

  it("matches a build the user names against list_builds, case and .xml ignored, and asks with the closest names, never guessing (§12)", () => {
    expect(BODY).toContain('is matched against `mcp__pob2__list_builds`: a file name equal to it, case and `.xml` ignored, is the build; otherwise list the closest names and ask, never guessing');
  });

  it("runs §15's steps: start, read, measure, the display, the better round on request, the end; never writes the user's file, prices only in the round", () => {
    for (const step of ['## 1. Start', '## 2. Read (step 2)', '## 3. Measure (step 3)', '## 4. The display (step 4)', '## 5. Better, on request (D-521, §17)', '## 6. End']) expect(BODY_RAW).toContain(`\n${step}\n`);
    expect(BODY).toContain('`mcp__pob2__guide_run {new_run: "compile"}`');
    expect(BODY).toMatch(/`pob2-run-log <runFolder> init` with `\{"piece": "compile"/);
    expect(BODY).toContain("**Write the user's PoB file.**");
    expect(BODY).toContain("**Price** outside the round's place, D1-finish and the D1 gate");
    // The Spirit answer goes back to the reader with the off lists the user confirmed (the coordinator's call at M-30).
    expect(BODY).toContain('the Spirit answer goes to the second call as `buffs_on`, `buffs_swap` and `switch_off`');
    // The better round: the four design steps in the better scope, the design gate's three answers, F1 under its own name.
    expect(BODY).toContain('each with `scope: "better"` in its header');
    expect(BODY).toMatch(/\*\*accept\*\*, F1; \*\*revise\*\* \(`revise:<text>`.*\*\*stop\*\*, the run ends `stopped`/);
    expect(BODY).toContain('`buildName` the draft\'s name (`<name> better`), `firstFree: true` on its first write');
  });

  it("tells the runner what a compile run's design gate takes that the pipeline's doesn't (WU-162's fix round)", () => {
    // The targets the budget can't reach, at the gate; no gate question step; §4's exceptions; F1's accepted findings.
    expect(BODY).toContain('whose display lists each under "Not reached within your budget"');
    expect(BODY).toContain('A compile run has no gate question step (`Q`): answer from the display, the verdict file, `trades.json` and your lookups.');
    expect(BODY).toContain('but a compile run logs no `build` entry and no skeleton, and has no verification gate: an `infeasible` round ends the run `stopped`');
    expect(BODY).toContain('`accepted` the round\'s accepted findings');
    // An escalation's accept: the runner writes the draft and logs its path on the escalation; stop ends the run stopped.
    expect(BODY).toContain('and log the escalation with its path as `draftFile`), retry, or stop, which ends the run `stopped`');
    expect(BODY).toContain("`draftFile` the draft the display named (the D1 gate verdict's `draft`, or an escalation's `draftFile`)");
    // A callout the user wants fixed is theirs to change in PoB (§17 keeps the configuration as set).
    expect(BODY).toContain('A callout the user wants fixed is theirs to change in PoB: the round keeps the configuration as set (§17), so they change it there, save, and start again from the file; you never edit the plan.');
  });

  it("every root-relative path in the piece's files resolves, and the SKILL.md body names plugin files under ${CLAUDE_PLUGIN_ROOT}", () => {
    const roots = fs.readdirSync(REPO, { withFileTypes: true }).filter((e) => e.isDirectory() && !e.name.startsWith('.') && e.name !== 'node_modules').map((e) => e.name);
    let checked = 0;
    for (const text of [RAW, read('skills', 'compile', 'references', 'stages', 'measure.md')]) {
      for (const m of text.replace(/^[ \t]*(`{3,})[^\n]*\n[\s\S]*?^[ \t]*\1[ \t]*$/gm, '').matchAll(/`([^`]+)`/g)) {
        const p = m[1].replace(/^(?:\$\{CLAUDE_PLUGIN_ROOT\}\/|<root>\/)/, '').split(' ')[0];
        if (!roots.some((r) => p.startsWith(`${r}/`))) continue;
        const cut = p.search(/[<*{#…|]/);
        const target = cut < 0 ? p.replace(/[.,:;)]+$/, '') : p.slice(0, p.lastIndexOf('/', cut) + 1);
        checked += 1;
        expect({ path: p, exists: fs.existsSync(path.join(REPO, target)) }).toEqual({ path: p, exists: true });
      }
    }
    expect(checked).toBeGreaterThan(10);
    // In the body, a root-relative plugin path in a span carries the prefix (§5), as build-guide's SKILL.md does.
    const unprefixed = [...BODY_RAW.matchAll(/`([^`]+)`/g)].map((m) => m[1]).filter((s) => roots.some((r) => new RegExp(`(?:^|\\s)${r}/`).test(s)));
    expect(unprefixed).toEqual([]);
  });
});

describe("AC-W153 (WU-162, D-519): the measure step's reference holds §15's parts", () => {
  it('is a coordinator stage, its header and writes, the engagement, and the measure-only compile with measure_as', () => {
    expect(read('skills', 'compile', 'references', 'stages', 'measure.md').split('\n')[0]).toBe("# measure: the character's measure, its callouts and the file card (`build-guide-coordinator`)");
    expect(MEASURE).toContain('`stage: "measure"`');
    expect(MEASURE).toContain('`buildFolder: "."`');
    expect(MEASURE).toContain("write the read stage's `skills.engagement {kind, reason}` into `plan.json` with Edit, as D1-build takes it");
    expect(MEASURE).toContain('`mcp__pob2__compile_plan {plan_path: "<runFolderRel>/plan.json", measure_only: true, measure_as: "non-budget"}`');
    expect(MEASURE).toContain('the Pinnacle boss pass with the Arbiter read, the resisting and conditioned reads, the toughness read at that rung\'s reference hits');
  });

  it("asks the Spirit question with a proposed off list per buff, the answer going back as buffs_on, buffs_swap and switch_off", () => {
    expect(MEASURE).toContain('only when `spirit.unreserved` is below 0 on the measured set');
    expect(MEASURE).toContain('a proposed list of the groups switched off for it, the fewest buffs whose reservation makes room for it');
    expect(MEASURE).toContain('the option to move a buff to the other weapon set');
    expect(MEASURE).toContain('as `buffs_on` (kept on), `buffs_swap` (moved to the other weapon set) and `switch_off` (`{<switched buff\'s group>: [<its off groups>]}`');
  });

  it('calls out (a) to (g), none changed; (a) beyond the inputs PoB gates, judged by what the build produces', () => {
    for (const c of ['(a) **A state nothing in the build produces.**', '(b) **A custom modifier line**', '(c) **an enemy setting**', '(d) **A filled party tab**', '(e) **A condition or charge count held up**', '(f) **A granted skill\'s gem quality**', '(g) Anything else']) expect(MEASURE).toContain(c);
    expect(MEASURE).toContain("V2's `unproduced-state` callouts (`kind: \"from-file\"`) cover the inputs PoB itself gates");
    expect(MEASURE).toMatch(/PoB gates none of the rest, so judge them yourself by what the build produces .*a charge count \(power, frenzy, endurance\), an enemy condition \(Chilled, Shocked/);
    expect(MEASURE).toContain('(a), (d) and (f) are mechanical; the rest are your judgment.');
    expect(MEASURE).toContain('each with why, none changed');
  });

  it("summarizes against the non-budget rung's targets as where the character is headed; choice A below level 65; the file card's brainstorm half", () => {
    expect(MEASURE).toContain("**The summary against the non-budget rung's targets**");
    for (const part of ['the lowest max hit and its type beside it', 'the one-shot floor (80% of the Arbiter\'s hits survived', 'clear speed', 'never as a failure', 'Uncapped resistances are stated as facts.']) expect(MEASURE).toContain(part);
    expect(MEASURE).toContain('Below the endgame (choice A: level under 65, or the user\'s word that it is in the campaign)');
    expect(MEASURE).toContain("**The file card**, `cards/file.md`, only when `writes` names it");
    expect(MEASURE).toContain('with no verification half');
  });

  it("the coordinator's step table names measure with its reference, beside the design steps' better scope", () => {
    const coordinator = read('agents', 'build-guide-coordinator.md');
    expect(coordinator).toContain("| `measure` | `${CLAUDE_PLUGIN_ROOT}/skills/compile/references/stages/measure.md` |");
    expect(folded(coordinator)).toContain('A compile run\'s better round runs the design steps above with `scope: "better"` (D-521).');
    expect(/^description: .*a piece run's measure of a player's file \(measure\)/m.test(coordinator)).toBe(true);
  });

  it("game knowledge's description names the three new commands (a15 §8's rule)", () => {
    const gk = /^description: (.*)$/m.exec(read('skills', 'game-knowledge', 'SKILL.md'))![1];
    for (const c of ['/pob2:compile', '/pob2:pricing', '/pob2:writer']) expect({ c, named: gk.includes(c) }).toEqual({ c, named: true });
  });
});

describe('AC-W154 (WU-162, D-521): the better scope in the four D1 stage references', () => {
  const better = (name: string) => section(STAGE(name), '## The `better` scope (D-521)');

  it('D1-build, D1-tree, D1-finish and D1-gate each hold a scope: "better" section', () => {
    for (const name of ['D1-build', 'D1-tree', 'D1-finish', 'D1-gate']) expect({ name, scope: better(name).includes('scope: "better"') }).toEqual({ name, scope: true });
    expect(folded(read('skills', 'build-guide', 'references', 'task-header.md'))).toContain("from revision 16, D1-build's, D1-tree's, D1-finish's and D1-gate's `better`, the better round on a player's read character (D-521)");
  });

  it("D1-build starts from the read stage, keeps §17's list, changes the rest within the budget, and aims below the endgame at m (choice A)", () => {
    const b = better('D1-build');
    expect(b).toContain("Start from that stage where step 1 starts from a card's skeleton and change it toward the targets within the user's budget");
    expect(b).toContain('design no other rung');
    expect(b).toContain('below the endgame (level under 65, or the owner\'s word that it is in the campaign; choice A) `m`\'s, id `m`, `entering-maps`');
    expect(b).toContain('**Kept unless the user\'s words ask:** the class, the ascendancy and its allocated ascendancy nodes, the main skill and the weapon type it needs, the level, `config.file` as set');
    expect(b).toContain('**Yours to change:** the tree\'s points, supports and gem levels, any slot\'s gear within the budget, the anoint, and a buff switched as needed');
    expect(b).toContain('A replacement drops the `owned` mark and meets every rule');
  });

  it("D1-tree searches from the character's own tree; D1-finish prices the replacements and writes each change as a trade; D1-gate shows an unreachable target with its cost", () => {
    expect(better('D1-tree')).toContain('search from its own tree');
    expect(better('D1-tree')).toContain('one start node the only constraint (D-452)');
    const f = better('D1-finish');
    expect(f).toContain('price each replacement by the spec loop');
    expect(f).toContain('each change against the character as read is a trade of its kind');
    const g = better('D1-gate');
    expect(g).toContain("a target the user's budget can't reach is a finding shown at the design gate with what reaching it would cost, not a failed attempt");
    expect(g).toContain('carries `cost`');
    expect(g).toContain('the legality parts (compiled, V1, V2) fail as today');
    expect(g).toContain("the source's name and ` better`, never the user's file's");
    // Where a cost comes from, and the reference hits on the file's configuration.
    expect(g).toContain("from D1-finish's `scaling` finds over the budget in `trades.json` that would reach it and their prices");
    expect(g).toContain("On the file's configuration (`config.file`) the compiler writes no reference hit: the stage's hits are its rung's, D-254's formula at its area level");
  });

  it('a V2 callout on the file\'s configuration (kind from-file) fails no D1 gate and no F1 (D-519)', () => {
    expect(folded(STAGE('D1-gate'))).toContain('**A V2 callout** (D-519): a finding with `kind: "from-file"`, on a read stage\'s own configuration, is reported with its kind and fails nothing; `v2` stays `pass`.');
    expect(folded(STAGE('F1'))).toContain('A part with any finding is `fail`, but a V2 callout (`kind: "from-file"`, on a read stage\'s own configuration, D-519): report it with its kind; it fails nothing.');
  });

  it("D1-build writes the rung's ascendancyPoints and variantBasis with it, and hands a replaced rare to D1-finish's spec loop in a sentence", () => {
    const b = better('D1-build');
    expect(b).toContain('either way write its `ascendancyPoints` (the file\'s allocated ascendancy nodes, §16) and `variantBasis` (each a judgment tag), which the schema requires with `variant`');
    expect(b).toContain('a rare is written as a spec, and D1-finish prices it by the spec loop.');
  });
});
