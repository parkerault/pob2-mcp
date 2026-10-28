/**
 * Amendment 12 (M-25), WU-125: AC-W97 and AC-W98, the design side of D-449…D-462 in the skill text, one assertion each.
 *
 * - AC-W97, the D1 stages: `D1-build.md` (the defence step, schema 8, seeded trees, needs on every rung, no respec, `tmp`
 *   stages, the wall rule, questions 19 and 23, Wither, the levers, ailment uptime, the curse cap), `D1-tree.md` (keep =
 *   needs, no `protect_for`, no ladder, jewel sockets and their lines and prices, the boss guard), `D1-finish.md` (the
 *   one-shot defence trade, the keep, the damage trade's max hit, the avoidance trade, the measured boss cut, the
 *   re-split shares, weapons by compile) and `D1-gate.md`'s design field.
 * - AC-W98, the gates, the guide and the skill: `checkpoints.md`, `gates.md`, `D2.md`, `W1.md`, both guide templates and
 *   the audit template, `V4.md`, `pricing.md` and `SKILL.md`.
 *
 * Numbers and forms are read from the amendment (`docs/build-guide/spec/amendment-12-defence-and-design.md`), the
 * reference files and the run scripts, so the text is held to the spec and to the code that reads it; the D1 gate's
 * example and the design gate's example are put through the real display (`run-log.mjs`) and checker (`check-run.mjs`),
 * and the audit template's Arbiter line through the real render (`render-audit.mjs`).
 */
import { describe, it, expect, afterAll } from '@jest/globals';
import { spawnSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';

type Json = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

const REPO = path.resolve(__dirname, '..', '..');
const SKILL_DIR = path.join(REPO, '.claude', 'skills', 'build-guide');
const STAGES_DIR = path.join(SKILL_DIR, 'references', 'stages');
const SCRIPTS = path.join(SKILL_DIR, 'scripts');
const CHECKER = path.join(SCRIPTS, 'check-run.mjs');
const RUN_LOG = path.join(SCRIPTS, 'run-log.mjs');
const RENDER = path.join(SCRIPTS, 'render-audit.mjs');
const FIXTURES = path.join(REPO, 'tests', 'fixtures', 'pipeline');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'a12-design-'));
afterAll(() => fs.rmSync(TMP, { recursive: true, force: true }));

const read = (file: string) => (fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '');
/** One paragraph or list item per entry, with its line breaks folded, so a rule split over lines reads whole. */
const folded = (text: string) => text.replace(/\s*\n\s*/g, ' ');
const rawStage = (name: string) => read(path.join(STAGES_DIR, `${name}.md`));
const stage = (name: string) => folded(rawStage(name));
const rawRef = (name: string) => read(path.join(SKILL_DIR, 'references', name));
const ref = (name: string) => folded(rawRef(name));
const template = (name: string) => read(path.join(SKILL_DIR, 'templates', name));
const SKILL_RAW = read(path.join(SKILL_DIR, 'SKILL.md'));
const SKILL = folded(SKILL_RAW);
const SPEC_RAW = read(path.join(REPO, 'docs', 'build-guide', 'spec', 'amendment-12-defence-and-design.md'));
const SPEC = folded(SPEC_RAW);
const CHECKER_TEXT = read(CHECKER);
const TARGETS = JSON.parse(rawRef('toughness-targets.json')) as { targets: { close: number; distance: number }; under: number; over: number; arbiter: { hitsSurvivedFloor: number } };
const FLOOR = TARGETS.arbiter.hitsSurvivedFloor;

/** A number the amendment states, by a pattern with one capture group. */
function specNumber(re: RegExp): number {
  const m = re.exec(SPEC);
  if (!m) throw new Error(`the amendment doesn't state ${re}`);
  return Number(m[1]);
}
/** The text from `start` to `end` (exclusive), both required. */
function between(text: string, start: string, end: string): string {
  const at = text.indexOf(start);
  if (at < 0) throw new Error(`no "${start}"`);
  const to = text.indexOf(end, at + start.length);
  if (to < 0) throw new Error(`no "${end}" after "${start}"`);
  return text.slice(at, to);
}
/** The first fenced block after `marker`, its body. */
function blockAfter(text: string, marker: string): string {
  const at = text.indexOf(marker);
  if (at < 0) throw new Error(`no "${marker}"`);
  const m = /```(?:json)?\n([\s\S]*?)\n *```/.exec(text.slice(at));
  if (!m) throw new Error(`no block after "${marker}"`);
  return m[1];
}
/** A display line as a pattern: its numbers any number, `<nodes>` and a boss cut's entry any text. */
function form(line: string): RegExp {
  const esc = line.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`^${esc.replace(/\d[\d,]*(?:\\\.\d+)?/g, '[\\d,]+(?:\\.\\d+)?').replace(/<nodes>/g, '.+').replace(/cuts [^;]+? against a boss/g, 'cuts .+ against a boss')}$`);
}

const ENV = { PATH: '/usr/bin:/bin', LANG: 'C' };
function node(script: string, args: string[]) {
  const r = spawnSync(process.execPath, [script, ...args], { cwd: TMP, env: ENV, encoding: 'utf8', timeout: 30000 });
  return { code: r.status, stdout: r.stdout, stderr: r.stderr };
}
let copies = 0;
function copyFixture(name: string): string {
  const dir = path.join(TMP, `${name}-${++copies}`);
  fs.cpSync(path.join(FIXTURES, name), dir, { recursive: true });
  return dir;
}
const BUILD = 'r1-a-2';
const GATE = `reports/gates/D1-gate-${BUILD}-a1.json`;
function editJson(dir: string, rel: string, edit: (j: Json) => void): void {
  const file = path.join(dir, rel);
  const j = JSON.parse(fs.readFileSync(file, 'utf8')) as Json;
  edit(j);
  fs.writeFileSync(file, `${JSON.stringify(j, null, 2)}\n`);
}

// The spec's numbers.
const SOCKET_POINTS = specNumber(/each empty jewel socket within (\d+) points of the rung's tree/);
const SOCKETS = specNumber(/nearest first, at most (\d+) measured per rung/);
const LINE_CANDIDATES = specNumber(/at most (\d+) candidates \(proceed-on, §25\)/);
const B_LINES = specNumber(/`b`'s jewel carries the best (\d+) lines at a middle roll/);
const N_LINES = specNumber(/`n`'s (\d+) at the top roll/);
const SWAP_GUARD = specNumber(/fall no more than a swap's (\d+)%/);
const BOSS_CUT = specNumber(/a move that cuts any entry by more than (\d+)% is undone/);
const DEFENCE_ALLOWANCE = specNumber(/\(damage may fall at most (\d+)%\)/);
const AVOIDANCE_POINTS = specNumber(/is up to (\d+) tree points \(the sizing study's comparison\)/);
const HITS_TO_APPLY = specNumber(/more than (\d+) on the Pinnacle boss is a risk/);
const WITHER_MAX = specNumber(/steady stacks are the duration ÷ the application interval, at most (\d+)/);
const WEAPON_LISTINGS = specNumber(/re-check the top (\d+) weapon listings/);
const PACE_S = specNumber(/is sent no sooner than (\d+) s after the previous search's send/);
const WAIT_CAP_S = specNumber(/The wait cap\*\* rises from 30 s to (\d+) s/);
/** §4's fix families (proceed-on, §25): physical, any other type, the physical-lightning mix. */
const FIX = (() => {
  const m = /The fix family is "([^"]+)" for a physical type, "([^"]+)" for any other, and "([^"]+)" for the physical-lightning mix/.exec(SPEC)!;
  return { physical: m[1], other: m[2], mixed: m[3] };
})();

describe("amendment 12's numbers, as the test reads them", () => {
  it('reads §4, §5, §8, §11 and §16 as approved', () => {
    expect([SOCKET_POINTS, SOCKETS, LINE_CANDIDATES, B_LINES, N_LINES, SWAP_GUARD, BOSS_CUT]).toEqual([4, 3, 8, 3, 4, 2, 2]);
    expect([DEFENCE_ALLOWANCE, AVOIDANCE_POINTS, HITS_TO_APPLY, WITHER_MAX, WEAPON_LISTINGS, PACE_S, WAIT_CAP_S]).toEqual([15, 20, 5, 10, 3, 45, 60]);
    expect(FLOOR).toBe(0.8);
    expect(FIX.physical).toBe('the pool, armour or a physical shift');
  });
});

// ---------------------------------------------------------------------------------------------------
// AC-W97: the D1 stages
// ---------------------------------------------------------------------------------------------------

describe('AC-W97 (WU-125): D1-build', () => {
  const build = stage('D1-build');
  const defence = folded(between(rawStage('D1-build'), '8. **The defence step** (D-451)', '9. **Measure.**'));

  it('has the defence step: the family from the class attributes and its cost', () => {
    expect(defence).toMatch(/\*\*The family follows the class's attributes\*\* .* strength for armour, dexterity for evasion, intelligence for energy shield, two attributes for a hybrid base\. A family off the class's attributes is allowed; count its cost, the attribute lines on gear and the tree points its bases' requirements take/);
  });

  it("writes stages[].defence on n, with Appendix A's base families", () => {
    const bases = /`\{base: "armour" \| "evasion" \| "energy shield" \| "armour\/evasion" \|\s+"armour\/energy shield" \| "evasion\/energy shield"/.test(SPEC_RAW);
    expect({ bases, field: /\*\*`stages\[\]\.defence` on `n`\*\* \(schema 8\), beside `skills\.engagement`: `\{base, chance, mitigation, pool, physicalHit\}`, `base` one of `armour`, `evasion`, `energy shield`, `armour\/evasion`, `armour\/energy shield` and `evasion\/energy shield`/.test(defence) }).toEqual({ bases: true, field: true });
  });

  it('values deflection on evasion builds by hits survived, no cap required, Glancing Blows no source', () => {
    expect(defence).toMatch(/\*\*Deflection on evasion builds, pure or hybrid\*\*: take avoidance sources .* valued by EHP and by \*\*hits survived\*\* .* not by EHP alone\. No cap is required\. .* Glancing Blows is no deflection source/);
  });

  it('treats conditions under hits as earned state with an uptime under hits (step 7)', () => {
    expect(build).toMatch(/\*\*Conditions under hits\*\* \(D-451\): a line that holds only while you aren't hit \(Hyrri's Ire, "if you haven't been hit recently"\), stacks lost when you are hit \(Wind Dancer, Virtuous Barrier's motes, Ghost Shroud\) and "Is the enemy Blinded\?" are earned state with an uptime under hits, never a full one; blind needs a producer that hits the attackers/);
  });

  it("states the custom-defence rule: a coverage result in the reason, V1's custom-defence, V4's re-check", () => {
    expect(defence).toMatch(/\*\*No custom line for a layer PoB models\*\* \(D-451\)\. A `config\.customMods` line that adds a pool or a defence first shows, through `mcp__pob2__check_model_coverage`, .* its `reason` names that result as `coverage: <status>` .* V1's `custom-defence` names a schema-8 line .* V4 re-runs the coverage check on it/);
  });

  it('writes schemaVersion 8, and moves a plan it edits to 8 (dropping respec, adding defence)', () => {
    expect(build).toMatch(/at `schemaVersion: 8` .* \*\*A plan at an earlier version goes to 8 whenever you edit it\*\* \(D-452, §22\): write `schemaVersion: 8`, drop every stage's `respec` \(a schema-8 plan refuses it\), and add `defence` on `n`/);
  });

  it("seeds each rung's tree from the stage before it, then designs it free", () => {
    expect(build).toMatch(/\*\*Seed each rung's tree from the stage before it\*\*, then design it free: `m` from the campaign's last stage, or from the skeleton's tree when the plan has none; `b` from `m`; `n` from `b`/);
  });

  it('writes a need on every rung that holds its nodes, deflection taken for hits survived among the cases', () => {
    expect(build).toMatch(/\*\*Write a need on every rung that holds its nodes\*\* \(D-452\).* - \*\*deflection or evasion taken for hits survived\*\* \(step 8, D-451\): node power ranks by EHP and can't see hits survived, so each avoidance source the design keeps is a need on each rung that holds it/);
  });

  it('marks no respec', () => {
    expect({ none: /\*\*Mark no respec:\*\* a schema-8 plan has no `respec`/.test(build), old: /respec rung|respec \{dropped, goldCost, note\}/.test(build) }).toEqual({ none: true, old: false });
  });

  it("names temporary stages tmp, letters and digits, and removes a crashed step's", () => {
    expect(build).toMatch(/\*\*Temporary stages\*\* \(D-453\): every measuring copy you add, here or in any D1 step, has an id that starts `tmp`, then letters and digits like every stage id \(`tmpb1`, `tmpn2`\); .* when you start, remove any `tmp` stage a crashed step left in the plan/);
  });

  it("states the wall rule, and writes stronger structure: under pieces.md's ## Searched", () => {
    expect(build).toMatch(/\*\*The wall rule\*\* \(D-457\)\. Name each payoff apart from the means that supply it \(question 2\), and give each load-bearing supply a second means: .* \*\*When a rung fails because a means doesn't deliver\*\* .*, search other means to the same payoff before you tune the one that failed, and write a `## Searched` line in `pieces\.md` for each search\. When the best means changes the skill, the weapon or the ascendancy, return `stronger structure: <the means>: <why>` and write the same line under `pieces\.md`'s `## Searched`/);
  });

  it('asks question 19 on every build', () => {
    expect(build).toMatch(/\*\*Answer question 19 on every build\*\* \(D-458\)/);
  });

  it('asks question 23: the shared stats in tree.scales, and a node feeding only another group a need on its figure', () => {
    expect(build).toMatch(/\*\*with two or more damage skills\*\* \(question 23, D-458\), the stats every damage group shares, and a node that feeds only another group is a need \(step 5\), measured on that group's figure/);
  });

  it(`states the Wither rule: duration over the interval, at most ${WITHER_MAX}`, () => {
    expect(build).toContain(`**Wither stacks** (D-456): steady stacks are the duration ÷ the application interval, at most ${WITHER_MAX}, unless another Wither source is named.`);
  });

  it("measures b's enemy-side levers beside crit, never inversion on b, and names the two left out", () => {
    expect(build).toMatch(/\*\*On `b`, measure the enemy-side levers beside crit, not before it:\*\* Rage with Berserk on attacks, a reliable shock, exposure and curses\. .* \*\*Never inversion on `b`\*\* .* On `n`, a build that inverts resistance skips the resistance levers .* Two are not budget levers here: an ailment-type payoff and penetration with a lowered floor/);
  });

  it(`reads an ailment's uptime from PoB's figures, the boss's from a temporary stage, more than ${HITS_TO_APPLY} hits a risk`, () => {
    expect(build).toMatch(new RegExp(`\\*\\*An ailment's uptime from PoB's figures\\*\\* \\(D-456\\): .* \`<Ailment>ChancePerHit\` or \`<Ailment>BuildupAvg\` in a record's \`outputs\` \\(else \`mcp__pob2__lua_get_stats\` on that loaded stage\\), .* \\*\\*the Pinnacle boss from a temporary stage\\*\\* that copies the rung with the boss's scenario .* A \`judgment\` from the gem text only where PoB shows neither\\. Say how many hits apply it; more than ${HITS_TO_APPLY} on the Pinnacle boss is a risk, and starts the wall rule`));
  });

  it("states the curse cap line with V1's curse-level-cap and the rungs' area levels", () => {
    expect(build).toMatch(/\*\*A curse's level cap\*\* \(D-455\)\. .* as do Frost Bomb's exposure and Thunderstorm's Wet, and PoB never reads the cap \(PG-86\)\. Give such a gem a level whose cap isn't below the stage's area level \(69 on `m`, 79 on `b`, 82 on `n`\), its \+levels from gear counted; V1's `curse-level-cap` names a gem whose cap is/);
  });
});

describe('AC-W97 (WU-125): D1-tree', () => {
  const tree = stage('D1-tree');
  const sockets = folded(between(rawStage('D1-tree'), '3. **Jewel sockets** (D-453)', '4. **The swap loop, then the rebuild**'));

  it("keeps the rung's needs only and passes no protect_for", () => {
    expect(tree).toMatch(/- `keep`: the nodes of the rung's `tree\.needs`, and nothing else \(D-452\): .* - \*\*no `protect_for`\*\* \(D-452\)/);
  });

  it('has no ladder propagation and no respec: return', () => {
    expect({ onRung: /\*\*On that rung only\*\* \(D-452\): a change goes up no ladder/.test(tree), ladder: /Up the ladder|grow links|`respec: <stage>/.test(tree) }).toEqual({ onRung: true, ladder: false });
  });

  it(`tests jewel sockets within ${SOCKET_POINTS} points, at most ${SOCKETS} a rung, against the weakest list on MainDamage and TotalEHP with the ${SWAP_GUARD}% guard`, () => {
    expect(sockets).toMatch(new RegExp(`each empty jewel socket within ${SOCKET_POINTS} points of the rung's tree, nearest first, at most ${SOCKETS} measured per rung .* free as many points as the socket's path costs from node power's weakest list, ranked on \`\\["MainDamage", "TotalEHP"\\]\` .* its \`TotalEHP\` and lowest max hit fall no more than a swap's ${SWAP_GUARD}%`));
  });

  it(`measures at most ${LINE_CANDIDATES} line candidates, b ${B_LINES} middle-roll lines, n ${N_LINES} top-roll, no crafted line`, () => {
    expect(sockets).toMatch(new RegExp(`at most ${LINE_CANDIDATES} candidates, each measured alone on a temporary stage .* \`b\`'s jewel carries the best ${B_LINES} lines at a middle roll, \`n\`'s the best ${N_LINES} at the top roll\\. No crafted "Effect of Prefixes" or "Effect of Suffixes" line: PoB doesn't read it \\(PG-99\\)`));
  });

  it("writes each jewel's prices[] entry and the lines in pieces.md's ## Jewel lines", () => {
    expect(sockets).toMatch(/Write the chosen lines and the `tree\.scales` they serve in `pieces\.md`'s `## Jewel lines` .* \*\*Its price entry\*\* \(D-372\): write each taken jewel's `prices\[\]` entry as D1-build writes a rare's, `\{"id": "<rung>-jewel-<node>", .* "query": \{"slot": "Jewel <node>"/);
  });

  it(`undoes its own move that cuts a boss-rotation entry by more than ${BOSS_CUT}% (never a user's request or a taken trade), with the boss need's own claim`, () => {
    expect(tree).toMatch(new RegExp(`\\*\\*The boss guard\\*\\* \\(D-456\\), for your own moves only \\(the loop's swaps, the rebuild, spare points and sockets\\), never a user's request or a trade the user takes: each boss-rotation entry of the rung's \`measures\\.bossGroups\` .* a move that cuts any entry by more than ${BOSS_CUT}% fails the check\\. .* after the boss guard, a need with no \`stat\` instead, whose claim \\(D1-finish's\\) names the boss-rotation entry it keeps`));
  });
});

describe('AC-W97 (WU-125): D1-finish', () => {
  const finish = stage('D1-finish');
  const trades = folded(between(rawStage('D1-finish'), '5. **The trades**', '6. **Validate**'));

  it('writes the one-shot defence trade: pool lines, avoidance sources, tree moves; clearing entries first, pool lines first among them', () => {
    expect(trades).toMatch(new RegExp(`\\*\\*The defence trade on a one-shot rung\\*\\* \\(D-450\\), \`b\` or \`n\`, whatever its band: within the defence trade's allowance \\(damage may fall at most ${DEFENCE_ALLOWANCE}%\\), .* 1\\. \\*\\*pool lines\\*\\*: .* 2\\. on a build that evades or deflects, \\*\\*avoidance sources\\*\\*: .* 3\\. \\*\\*tree moves\\*\\*: .* Write up to three \`defence\` entries, in this order: \\*\\*first every entry that clears the rung\\*\\* .*, pool lines first among them; .* a clearing entry is never cut for one that doesn't`));
  });

  it("keeps the rung's needs only in a trade's node power calls", () => {
    expect(trades).toMatch(/Node power's calls in a trade keep the rung's needs only \(`D1-tree\.md`, "The arguments"; D-450\)/);
  });

  it("applies the damage trade's max-hit rule on the Pinnacle pass", () => {
    expect(trades).toMatch(/\*\*Which max hit\.\*\* Every one-shot figure here .* is the deciding row's max hit from the Pinnacle pass, measured on the temporary stage\. .* \*\*On a one-shot rung\*\* a damage trade may not lower the deciding row's max hit: measure its move on the temporary stage, pass `maxHit: 0` in `max_loss` as a pre-filter when that type is the lowest max hit, and write its `maxHit` before and after/);
  });

  it(`writes the avoidance trade on b and n of an evasion build: the next spend (up to ${AVOIDANCE_POINTS} points) and a gear line`, () => {
    expect(trades).toMatch(new RegExp(`\\*\\*The avoidance trade\\*\\* \\(D-450; .* on \`b\` and \`n\` of every evasion build, pure or hybrid .* \\*\\*the next avoidance spend\\*\\*: up to ${AVOIDANCE_POINTS} tree points on deflection and evasion nodes .* taken by hits survived per point.* "the same 20 points on the best EHP nodes: \\+14% EHP, hits survived 45%"; - \\*\\*a gear line\\*\\*, at its price and 0 points: the best deflection or evasion line a rare slot can roll`));
  });

  it(`measures each trade's boss-rotation entries for its bossAfter and names a cut over ${BOSS_CUT}% at its reason's end, in the checker's form`, () => {
    expect(trades).toMatch(new RegExp(`\\*\\*Each trade is measured on a temporary stage\\*\\* .* \\*\\*each boss-rotation entry\\*\\* of \`measures\\.bossGroups\`, triggered entries included\\. \`bossAfter\` comes from that measure: .* A trade that cuts any entry by more than ${BOSS_CUT}% says so at the end of its \`reason\`, \`; cuts <entry> against a boss by <x>%\``));
    // The checker's defence reason accepts exactly that suffix (check-run.mjs's DEFENCE_REASON).
    expect(CHECKER_TEXT).toContain("(?:; cuts .+ against a boss by [\\d.]+%)?$/;");
  });

  it("re-splits n's shares over its rares and tree jewels before pricing", () => {
    expect(finish).toMatch(/\*\*`n`'s shares, re-split\*\* \(D-453\), before you price: .* share `n`'s default 150 divines evenly again over its rares and rare tree jewels, keeping any share an entry's `query\.target\.reason` gives/);
  });

  it(`re-checks the top ${WEAPON_LISTINGS} weapon listings on the build's own figure, never a listing's DPS`, () => {
    expect(finish).toMatch(new RegExp(`\\*\\*Weapons by compile\\*\\* \\(D-456\\): never compare weapons by a listing's DPS\\. .* re-check its top ${WEAPON_LISTINGS} weapon listings on the build's own damage figure`));
  });

  it("D1-finish's trades.json example passes the checker at revision 12, and the D1 gate's n trades are its own", () => {
    const fromFinish = JSON.parse(blockAfter(rawStage('D1-finish'), '## Writes')) as Json;
    const dir = copyFixture('run-a12');
    fs.writeFileSync(path.join(dir, 'builds', BUILD, 'trades.json'), `${JSON.stringify(fromFinish, null, 2)}\n`);
    const r = node(CHECKER, [dir]);
    expect(r.stderr.split('\n').filter((l) => l.startsWith('check-run: [trades] trades.json'))).toEqual([]);
    const gateExample = JSON.parse(blockAfter(rawStage('D1-gate'), '## Writes')) as Json;
    expect(gateExample.design.rungs.find((x: Json) => x.stage === 'n').trades).toEqual(fromFinish.trades);
  });
});

describe('AC-W97 (WU-125): D1-gate\'s design field', () => {
  const example = JSON.parse(blockAfter(rawStage('D1-gate'), '## Writes')) as Json;
  const rungs = example.design.rungs as Json[];
  const n = rungs.find((r) => r.stage === 'n')!;

  it("holds maxHit, the toughness additions and damage.resisting in Appendix A's keys, its values by the spec's rules", () => {
    // Appendix A's keys.
    const appendix = folded(between(SPEC_RAW, '### The D1 gate\'s design field (additions)', '### The design gate\'s display'));
    expect(appendix).toContain('`maxHit {lowest: {type, value} | null, immune: [<type>], arbiter: {type, evade, deflect, hitsSurvived, deflectedRatio, method} | null, oneShot: true | false}`');
    for (const r of rungs.filter((x) => x.stage === 'b' || x.stage === 'n')) {
      expect(Object.keys(r.maxHit)).toEqual(['lowest', 'immune', 'arbiter', 'oneShot']);
      expect(Object.keys(r.maxHit.arbiter)).toEqual(['type', 'evade', 'deflect', 'hitsSurvived', 'deflectedRatio', 'method']);
      const a = r.maxHit.arbiter;
      // Names: hits survived on a one-shot row whose deflected hit survives; the floor sets oneShot.
      expect(a.hitsSurvived).toBeCloseTo(a.evade + ((100 - a.evade) * a.deflect) / 100, 6);
      expect(r.maxHit.oneShot).toBe(a.hitsSurvived / 100 < FLOOR);
    }
    for (const r of rungs) expect(Object.keys(r.damage)).toEqual(['map', 'resisting', 'boss']);
    expect(Object.keys(n.toughness)).toEqual(['engagement', 'reason', 'target', 'band', 'chanceShare', 'conditioned', 'ailmentCut', 'warning']);
    // The warning: within or over the band on a one-shot rung gives the one-shot warning, its fix the family.
    expect(['within', 'over'].includes(n.toughness.band) && n.maxHit.oneShot).toBe(true);
    expect(n.toughness.warning).toEqual({ kind: 'one-shot', type: n.maxHit.arbiter.type, fix: FIX.physical });
  });

  it("passes the run checker's shape rules for a design field written under amendment 12", () => {
    const dir = copyFixture('run-a12');
    editJson(dir, GATE, (g) => {
      g.design = example.design;
    });
    const r = node(CHECKER, [dir]);
    const shape = r.stderr.split('\n').filter((l) => /\[design-field\]/.test(l) && /has maxHit|has damage|under amendment 12 it gains/.test(l));
    expect(shape).toEqual([]);
  });
});

// ---------------------------------------------------------------------------------------------------
// AC-W98: the gates, the guide and the skill
// ---------------------------------------------------------------------------------------------------

/** Appendix A's design-gate display lines, each as a pattern (numbers any number). */
const DISPLAY = (() => {
  const block = between(SPEC_RAW, '### The design gate\'s display (the lines that change)', '### `<buildFolder>/trades.json` (additions)');
  const lines = [...block.matchAll(/```\n([\s\S]*?)\n```/g)].flatMap((m) => m[1].split('\n'));
  const resisting = /`(- Resisting rares: [^`]+)`/.exec(block)![1];
  return [...lines, resisting].filter((l) => l.startsWith('- '));
})();
const DISPLAY_FORMS = {
  survivesShare: form(DISPLAY.find((l) => /^- The Arbiter of Divinity: survives \d+% of/.test(l))!),
  oneShot: form(DISPLAY.find((l) => /^- The Arbiter of Divinity: one-shot by/.test(l))!),
  lowest: form(DISPLAY.find((l) => l.startsWith('- Lowest max hit:'))!),
  ehp: form(DISPLAY.find((l) => l.startsWith('- Effective HP:'))!),
  conditioned: form(DISPLAY.find((l) => l.startsWith('- With every condition against it'))!),
  ailment: form(DISPLAY.find((l) => l.startsWith('- Deflection cuts ailment damage'))!),
  warning: form(DISPLAY.find((l) => l.startsWith('- Warning: the EHP reads within its band'))!),
  resisting: form(DISPLAY.find((l) => l.startsWith('- Resisting rares:'))!),
};

describe('AC-W98 (WU-125): checkpoints.md, gates.md and D2.md', () => {
  const designRaw = between(rawRef('checkpoints.md'), '## The design gate: judge the endgame build', "## The final gate: the build's guide");
  const design = folded(designRaw);
  const exampleLines = blockAfter(designRaw, '- **Show**').split('\n').map((l) => l.trim());

  it("the design gate's example shows §4's lines, the resisting figure and the trades in the display's forms, as run-log.mjs prints them", () => {
    // Appendix A's forms, in the doc's example.
    for (const [kind, re] of Object.entries(DISPLAY_FORMS).filter(([k]) => k !== 'survivesShare')) {
      expect({ kind, shown: exampleLines.some((l) => re.test(l)) }).toEqual({ kind, shown: true });
    }
    // The real display of the D1 gate's example prints each form, and each new line of the doc's example.
    const dir = copyFixture('run-a12');
    editJson(dir, GATE, (g) => {
      g.design = (JSON.parse(blockAfter(rawStage('D1-gate'), '## Writes')) as Json).design;
    });
    const r = node(RUN_LOG, [dir, 'display', 'design', '--build', BUILD]);
    expect({ code: r.code, stderr: r.stderr }).toEqual({ code: 0, stderr: '' });
    const out = r.stdout.split('\n');
    for (const [kind, re] of Object.entries(DISPLAY_FORMS)) expect({ kind, printed: out.some((l) => re.test(l)) }).toEqual({ kind, printed: true });
    const fresh = exampleLines.filter((l) => /^- (The Arbiter of Divinity:|Lowest max hit:|Resisting rares:|With every condition|Deflection cuts|Warning:|Defence \(one-shot\):|Avoidance:)/.test(l));
    expect(fresh.length).toBeGreaterThanOrEqual(10);
    for (const l of fresh) expect({ l, printed: out.some((o) => form(l).test(o)) }).toEqual({ l, printed: true });
  });

  it('the design gate gives the runner D1-build\'s stronger structure: lines (a choice) and D1-tree\'s jewel: lines, and a respec request is a tree request', () => {
    expect(design).toMatch(/Under the display, in your reply, give each `not made:` line D1-tree returned in this design .*, each `jewel:` line it returned \(a jewel socket taken on `b` or `n`, its lines and what it adds, D-453\), and each `stronger structure: <the means>: <why>` line D1-build returned \(D-457\) as a choice: the user takes it as a `revise:` when the roll \(class, ascendancy, skill\) stays; one that changes the roll is a successor card, made at the verification gate/);
    expect(design).toMatch(/\*\*a respec the user asks for is a tree request\*\* \(D-452: each loadout's tree is its own\), D1-tree then D1-finish/);
  });

  it("gates.md's tree part passes the rung's needs only, and no protect_for", () => {
    expect(ref('gates.md')).toMatch(/`keep`, the nodes of its needs \(`tree\.needs`\) and nothing else, and no `protect_for` \(D-452/);
  });

  it("gates.md names V1's two new codes, curse-level-cap and custom-defence, on schema-8 plans", () => {
    const rows = rawRef('gates.md').split('\n').filter((l) => /^\| v1 \| `(curse-level-cap|custom-defence)` \| a schema-8 plan's /.test(l));
    expect(rows).toHaveLength(2);
  });

  it('D2.md has no respec rule for a schema-8 plan', () => {
    const d2 = folded(between(rawStage('D2'), '4. **The tree path**', '5. **Gear:'));
    const s8 = /\*\*One tree per loadout, on a schema-8 plan\*\* \(D-452\)\. (.*?) - \*\*A plan at schema 7\*\*/.exec(d2)?.[1] ?? '';
    expect({ seeded: /\*\*seeded from the stage before it\*\*/.test(s8), noRespec: /Write no `respec` \(the plan refuses it\) and weigh no gold/.test(s8), respecRule: /respec stage|goldCost|is a respec rung/.test(s8) }).toEqual({ seeded: true, noRespec: true, respecRule: false });
  });
});

describe('AC-W98 (WU-125): W1, the guide templates and the audit template', () => {
  const w1 = stage('W1');
  const TEMPLATES = ['guide-template.md', 'guide-endgame-template.md'];
  /** Appendix A's tree-change line, `Respec: refund <n> points and allocate <m>; respeccing costs gold.` */
  const TREE_LINE = /The tree-change line, on a schema-8 stage whose `treeChange\.refunded` is above 0: `([^`]+)`/.exec(SPEC)![1];
  const LABELS = (() => {
    const m = /The verdict label on `b` and `n`, from the deciding row: `([^`]+)`; `([^`]+)`; `([^`]+)` with `([^`]+)` when x is above 0/.exec(SPEC)!;
    return `<${m[1]}|${m[2].replace('<x>%', '<x>%')}|${m[3]}${m[4]}>`;
  })();

  it("W1 and both templates carry the tree-change line in Appendix A's form, which the run checker reads", () => {
    expect(TREE_LINE).toBe('Respec: refund <n> points and allocate <m>; respeccing costs gold.');
    expect(w1).toContain('exactly `Respec: refund <refunded> points and allocate <added>; respeccing costs gold.`');
    const want = TREE_LINE.replace('<n>', '<treeChange.refunded>').replace('<m>', '<treeChange.added>');
    for (const name of TEMPLATES) {
      const lines = template(name).split('\n').filter((l) => l.includes(want));
      expect({ name, rungs: lines.length >= 3 }).toEqual({ name, rungs: true });
    }
    // The checker's pattern reads the line with its counts filled in.
    const re = new RegExp(/const TREE_CHANGE = \/(.+)\/;/.exec(CHECKER_TEXT)![1]);
    expect(re.exec(TREE_LINE.replace('<n>', '3').replace('<m>', '5'))?.slice(1, 3)).toEqual(['3', '5']);
  });

  it("W1 and both templates give the verdict label's three forms, the checker's ARBITER_LABEL_A12", () => {
    expect(/const ARBITER_LABEL_A12 = "([^"]*)";/.exec(CHECKER_TEXT)![1]).toBe(LABELS);
    expect(w1).toMatch(/\*\*"survives the Arbiter's hits"\*\*, when the deciding row survives the full hit; - \*\*"survives <x>% of the Arbiter's <type> hits, by evading or deflecting them"\*\*, when it is one-shot by the full hit but survives at least 80% of those hits; - \*\*"one-shot by the Arbiter's <type> hit"\*\*, under the floor, with \*\*" \(it survives <x>% of them\)"\*\*/);
    for (const name of TEMPLATES) {
      const got = template(name).split('\n').filter((l) => l.startsWith(`- **Budget (L<level>): ${LABELS}.**`) || l.startsWith(`- **Non-budget (L<level>): ${LABELS}.**`));
      expect({ name, lines: got.length }).toEqual({ name, lines: 2 });
    }
  });

  it("the copied Checks block's Arbiter line is the render's, in its three forms", () => {
    const line = template('audit-template.md').split('\n').find((l) => l.startsWith('- The Arbiter of Divinity: <'))!;
    const alternatives = /^- The Arbiter of Divinity: <(.*)>\.$/.exec(line)![1].split(' | ');
    expect(alternatives).toHaveLength(3);
    // The render of a revision-12 record: b survives 82% of its physical hits, n is one-shot under the floor.
    const dir = copyFixture('run-a12');
    editJson(dir, `builds/${BUILD}/compile-record.json`, (r) => {
      const set = (id: string, row: Json, avoid: Json) => {
        Object.assign(r.stages[id].measures.arbiter.rows[0], row);
        r.stages[id].measures.arbiter.verdict = 'one-shot';
        r.stages[id].measures.arbiter.avoid = avoid;
      };
      set('b', { ratio: 1.05, verdict: 'one-shot', deflectedRatio: 0.63, deflectedVerdict: 'survives', hitsSurvived: 82 }, { accuracy: 3786, evade: 40, deflect: 70, deflectEffect: 40, method: 'pass' });
      set('n', { ratio: 1.01, verdict: 'one-shot', deflectedRatio: 0.61, deflectedVerdict: 'survives', hitsSurvived: 79.6 }, { accuracy: 3786, evade: 32, deflect: 70, deflectEffect: 40, method: 'pass' });
    });
    const r = node(RENDER, [dir, '--build', BUILD]);
    expect(r.code).toBe(0);
    const rendered = read(path.join(dir, 'builds', BUILD, 'audit.md')).split('\n').filter((l) => l.startsWith('- The Arbiter of Divinity:'));
    const asForm = (alt: string) => new RegExp(`^- The Arbiter of Divinity: ${alt.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/<type>/g, '[a-z ]+').replace(/<ratio>/g, '[\\d.]+').replace(/<x>/g, '\\d+')}\\.$`);
    expect(rendered).toHaveLength(2);
    expect(asForm(alternatives[1]).test(rendered[0])).toBe(true);
    expect(asForm(alternatives[2]).test(rendered[1])).toBe(true);
    for (const name of TEMPLATES) {
      for (const title of ['Endgame: budget', 'Endgame: non-budget']) {
        expect({ name, title, three: between(template(name), `## ${title}`, '\n## ').includes("the Arbiter of Divinity's verdict in its three forms") }).toEqual({ name, title, three: true });
      }
    }
  });

  it('W1 and both templates give three damage figures, the resisting one between, and the audit its stage-table column', () => {
    const form3 = /const VERDICT_FORM_A12 = '([^']*)';/.exec(CHECKER_TEXT)![1];
    expect(w1).toContain('"<Skill> about <map> DPS against map monsters, about <resisting> against resisting rares, about <boss> against a Pinnacle boss" (D-437, D-447, D-454)');
    for (const name of TEMPLATES) expect({ name, form: template(name).includes(form3.replace('<Entering maps|Budget|Non-budget>', 'Entering maps')) }).toEqual({ name, form: true });
    expect(SPEC).toContain('The audit\'s stage table: `Damage, map / boss` becomes `Damage, map / resisting / boss` on endgame rungs.');
    expect(template('audit-template.md')).toContain('| Loadout | Level | Life | Damage, map / resisting / boss |');
  });

  it("W1 and both templates carry §14's defence lines in What PoB can't show", () => {
    expect(w1).toMatch(/\*\*The defence lines\*\* \(D-459\), each once and only when it applies: the design gate's warning, in plain words .*; for a deflecting build, what deflection does .* and its average cut to ailment damage from hits .*; and when the defence leans on recoup, regeneration, leech or recharge, that Effective HP leaves them out by PoB's design/);
    for (const name of TEMPLATES) {
      const show = between(template(name), "## What PoB can't show", '### Known issues');
      const lines = ['[only when the D1 gate\'s design field gives n a toughness warning', '[only when the build deflects (D-459, PG-97)] Deflection:', '[only when the defence leans on recoup, regeneration, leech or recharge (D-459)] Effective HP leaves out'];
      for (const l of lines) expect({ name, l, there: show.includes(l) }).toEqual({ name, l, there: true });
    }
  });

  it('W1 and both templates carry the play lines, the stall line required and the defence line optional', () => {
    expect(w1).toMatch(/\*\*One line naming the first thing to change if the build stalls\*\* \(D-459\), always: .* One optional line on defence the gate can't see, where the build has it: dodge timing, flasks, a recharge delay, stun risk, blind upkeep/);
    for (const name of TEMPLATES) {
      const play = between(template(name), '## How to play it', "## What PoB can't show");
      expect({ name, stall: /^- \*\*If it stalls:\*\* </m.test(play), defence: /^- \[optional\] \*\*Defence the numbers don't show:\*\*/m.test(play) }).toEqual({ name, stall: true, defence: true });
    }
  });
});

describe('AC-W98 (WU-125): V4, pricing.md and SKILL.md', () => {
  const v4 = stage('V4');

  it("V4 checks the verdict label against the record's deciding row and the floor", () => {
    expect(v4).toMatch(/\*\*the survival label\*\* \(D-353, D-459\): on `b` and `n` the verdict line's label is the record's, never a judgment: read the rung's deciding row .* against the floor, 0\.8, unrounded/);
  });

  it("V4 checks the tree-change line's counts against treeChange", () => {
    expect(v4).toMatch(/\*\*the tree-change line\*\* \(D-452\): on a schema-8 plan, each stage whose record has `treeChange` with `refunded` above 0 has one line in its section .* its counts the record's and no gold figure/);
  });

  it("V4 re-runs check_model_coverage on a custom defence line and fails a status that differs", () => {
    expect(v4).toMatch(/\*\*A custom defence line's model status\*\* \(D-451\): .* `coverage: <status>` .* Re-run `mcp__pob2__check_model_coverage` on the line's text: when the status it reports differs from the one the reason names, it is a finding for `D1`, `hinge: yes`/);
  });

  it(`pricing.md states the weapon rule: never by a listing's DPS, the top ${WEAPON_LISTINGS} re-checked by compile`, () => {
    expect(ref('pricing.md')).toMatch(new RegExp(`\\*\\*Weapons by compile\\*\\* \\(D-456\\)\\. Never compare weapons by a listing's DPS: .* re-check its top ${WEAPON_LISTINGS} weapon listings on the build's own damage figure`));
  });

  it(`pricing.md states the ${WAIT_CAP_S} s wait (would_wait over it) and the ${PACE_S} s gap`, () => {
    expect(ref('pricing.md')).toMatch(new RegExp(`no sooner than ${PACE_S} s after the previous search's send, .* the limiter waits up to ${WAIT_CAP_S} s and refuses a longer wait with \`would_wait\``));
  });

  it('pricing.md states one trade call at a time', () => {
    expect(ref('pricing.md')).toMatch(/\*\*One trade call at a time\.\*\* The pricing steps run alone, each making one trade call at a time: calls in parallel queue past the 60 s cap and come back `would_wait`/);
  });

  it('pricing.md states the pricing notice, as §16 words it', () => {
    expect(SPEC).toMatch(/Before a pricing step, the runner tells the user that pricing starts, about how many searches, at least 45 s apart, and that their browser shares the limit/);
    expect(ref('pricing.md')).toMatch(/\*\*The pricing notice\*\* \(D-461\)\. Before a step that prices on the trade site starts .*, the runner tells the user that pricing starts, about how many searches it makes .*, that they go at least 45 s apart .*, and that the user's browser shares the trade site's limit/);
  });

  it('SKILL.md tells the user before pricing starts', () => {
    expect(SKILL).toMatch(/\*\*Tell the user before pricing starts\*\* \(D-461\): that it starts, about how many searches, at least 45 s apart, and that their browser shares the limit; one trade call at a time/);
  });

  it('SKILL.md has no respec: route for new runs', () => {
    expect({ build: /\*\*D1-finish's `build: <ids>` sends an attempt back to D1-build\*\*/.test(SKILL), never: /D1-tree never returns `respec:` \(D-452\)/.test(SKILL), route: /logged `respec`|`done` or `respec:`/.test(SKILL) }).toEqual({ build: true, never: true, route: false });
  });

  it('SKILL.md stays within 325 lines', () => {
    expect(SKILL_RAW.split('\n').length - 1).toBeLessThanOrEqual(325);
  });
});
