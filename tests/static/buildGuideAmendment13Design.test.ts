/**
 * Amendment 13 (M-26), WU-133: AC-W103 and AC-W104, the design, gate and guide side of D-463…D-477 in the skill text,
 * one assertion each.
 *
 * - AC-W103, the D1 stages: `D1-build.md` (the complete needs and no attribute need, `boss_<stage>` with the rotation,
 *   the skill-level audit, unique jewels, corruption, flasks and charms, the rotation's conditions, the comment reason,
 *   whole numbers, no "Legacy of" example, the over-budget gear rule), `D1-tree.md` (`tree.start`, `tree.end`,
 *   `tree.search`, rebuild first at reach 12 with targets, the pace exchange, pool groups, the 1% loop to 30 swaps, the
 *   removed passives, the boss target, the fall's reason and the boss trade, the stale-server check, unique jewels in
 *   the socket test, and none of the superseded guards), `D1-finish.md` and `D1-gate.md`.
 * - AC-W104, the gates, pricing, the guide and the runner: `checkpoints.md`, `F1.md`, `D2-gate.md`, `gates.md`,
 *   `pricing.md`, W1 and the templates, `V4.md`, the coordinator's standing rules, `task-header.md`, `fix-round.md`,
 *   the verifier's definition and `SKILL.md`, D-477's claims pass among them.
 *
 * The numbers are read from the amendment (`docs/build-guide/spec/amendment-13-tree-and-finishing-touches.md`) and the
 * skill's reference files, and the display lines from its Appendix A, so the text is held to the spec. The D1 gate's
 * design-field example goes through the real display (`run-log.mjs`) and checker (`check-run.mjs`) on the revision-13
 * fixture, and the design gate's example lines are the display's forms. SKILL.md's line cap is pinned where the earlier
 * amendments pinned it (`buildGuideAmendment12Design.test.ts`, `buildGuideAmendment11Design.test.ts`,
 * `buildGuidePipeline.test.ts`).
 *
 * Amendment 14 (M-27), WU-142: AC-W110 and AC-W111, the design and pricing docs (D1-build, D1-tree, D1-finish, D1-gate,
 * D2, `pricing.md`, `gates.md`, `lookups.md`), in their own blocks at the end, read against amendment 14
 * (`amendment-14-files-specs-and-repairs.md`) and the revision-14 fixture `run-a14`.
 */
import { describe, it, expect, afterAll } from '@jest/globals';
import { spawnSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { loadReferenceData } from '../../src/plan/referenceData';
import { validatePlan } from '../../src/plan/schema';
import { renderTiers, socketLine } from '../../src/handlers/lookupHandlers';
import { renderFallback } from '../../src/trade/renderUpgrades';
import { getTradeToolSchemas } from '../../src/server/toolSchemas';

type Json = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

const REPO = path.resolve(__dirname, '..', '..');
const SKILL_DIR = path.join(REPO, '.claude', 'skills', 'build-guide');
const STAGES_DIR = path.join(SKILL_DIR, 'references', 'stages');
const AGENTS_DIR = path.join(REPO, '.claude', 'agents', 'build-guide');
const SCRIPTS = path.join(SKILL_DIR, 'scripts');
const CHECKER = path.join(SCRIPTS, 'check-run.mjs');
const RUN_LOG = path.join(SCRIPTS, 'run-log.mjs');
const FIXTURES = path.join(REPO, 'tests', 'fixtures', 'pipeline');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'a13-design-'));
afterAll(() => fs.rmSync(TMP, { recursive: true, force: true }));

const read = (file: string) => (fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '');
/** One paragraph or list item per entry, with its line breaks folded, so a rule split over lines reads whole. */
const folded = (text: string) => text.replace(/\s*\n\s*/g, ' ');
const rawStage = (name: string) => read(path.join(STAGES_DIR, `${name}.md`));
const stage = (name: string) => folded(rawStage(name));
const rawRef = (name: string) => read(path.join(SKILL_DIR, 'references', name));
const ref = (name: string) => folded(rawRef(name));
const template = (name: string) => read(path.join(SKILL_DIR, 'templates', name));
const agent = (name: string) => folded(read(path.join(AGENTS_DIR, `${name}.md`)));
const SKILL_RAW = read(path.join(SKILL_DIR, 'SKILL.md'));
const SKILL = folded(SKILL_RAW);
const SPEC_RAW = read(path.join(REPO, 'docs', 'build-guide', 'spec', 'amendment-13-tree-and-finishing-touches.md'));
const SPEC = folded(SPEC_RAW);
const CHECKER_TEXT = read(CHECKER);
const BOSS_FLOOR = (JSON.parse(rawRef('boss-floor.json')) as { floor: number }).floor;
const CORRUPTION = JSON.parse(rawRef('corruption.json')) as { cheapUnique: { under: number; currency: string }; rungs: string[] };

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
const thousands = (n: number) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',');

const ENV = { PATH: '/usr/bin:/bin', LANG: 'C' };
function node(script: string, args: string[], input?: string) {
  const r = spawnSync(process.execPath, [script, ...args], { cwd: TMP, env: ENV, encoding: 'utf8', timeout: 30000, input });
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
const LOOP_FLOOR = specNumber(/while the best swap \(main or pool\) gains at least \*\*(\d+)%\*\* Main damage/);
const SWAP_CAP = specNumber(/or after \*\*(\d+) swaps\*\* on the rung/);
const REACH = specNumber(/\*\*Rebuild first:\*\* `rebuild: true` at `max_distance: (\d+)`/);
const EXCHANGE = specNumber(/\*\*`pace_exchange: <r>`\*\* \(D1-tree passes (\d+)\)/);
const GATE_LINE = specNumber(/either result beating the rung's tree by \*\*(\d+)%\*\* Main damage fails the part/);
const PITCH_WORDS = (() => {
  const m = /with a target of (\d+)–(\d+) words for the whole visit/.exec(SPEC)!;
  return [Number(m[1]), Number(m[2])];
})();
const OLD_FLOOR = 3;
const OLD_CAP = 8;
const OLD_GUARD = 2;

describe("amendment 13's numbers, as the test reads them", () => {
  it('reads §8, §9, §12 and §16 as approved, and the reference files the skill reads them from', () => {
    expect([LOOP_FLOOR, SWAP_CAP, REACH, EXCHANGE, GATE_LINE]).toEqual([1, 30, 12, 3, 5]);
    expect(PITCH_WORDS).toEqual([700, 900]);
    expect(BOSS_FLOOR).toBe(250000);
    expect(CORRUPTION.cheapUnique).toEqual({ under: 1, currency: 'divine' });
    expect(CORRUPTION.rungs).toEqual(['budget', 'non-budget']);
    // D-418's floor and cap and D-456's guard, which §8 and §9 supersede.
    expect(SPEC).toMatch(/This \*\*supersedes\*\* D-418's swap floor \(3%\) and cap \(8\), D-456's boss guard \(§9\), and D1-tree's per-move EHP and max-hit caps/);
  });
});

// ---------------------------------------------------------------------------------------------------
// AC-W103: the D1 stages
// ---------------------------------------------------------------------------------------------------

describe('AC-W103 (WU-133): D1-build', () => {
  const build = stage('D1-build');
  const needs = folded(between(rawStage('D1-build'), '**The needs** (D-418', "**The tree's shape**"));
  const items = folded(between(rawStage('D1-build'), '6. **Items.**', '7. **Config**'));

  it('keeps a need for a node that serves only another damage group or a mechanic PoB doesn\'t measure, the list complete for a rebuild', () => {
    expect(needs).toMatch(/\*\*The list is complete\*\* \(D-467\): D1-tree rebuilds each rung's tree first, keeping only its needs, .* - a node that feeds only a damage group other than the named source's \(question 23\), its `stat` none, as measured on that group's figure, or a mechanic PoB doesn't measure \(the Herald Damage passives that feed a second clear skill/);
  });

  it('writes no attribute need, and drops one a plan it edits carries', () => {
    expect({ rule: /\*\*No attribute need\*\* \(D-467\): node power's attribute guard keeps PoB's own `ReqStr`, `ReqDex` and `ReqInt` on every move, .* drop any attribute need a plan you edit carries/.test(needs), old: needs.includes('an attribute a gem or item of the stage requires') }).toEqual({ rule: true, old: false });
  });

  it('writes boss_<stage> with skills.boss when an entry is triggered or takes turns', () => {
    expect(build).toMatch(/\*\*The boss figure\*\* \(D-468\) is the rotation's: when an entry is `triggered` or has `turns`, write the ledger entry `boss_<stage>` with `skills\.boss`, .* so D1-tree judges the tree on it; otherwise `measures\.damage\.boss` is right and no entry is needed/);
  });

  it('audits skill levels on b and n, writing pieces.md\'s ## Skill levels and returning each +0 skill as a levels: line', () => {
    expect(build).toMatch(/\*\*Skill levels\*\* \(D-473\), on `b` and `n`: .* Audit every damage skill of the boss rotation and the clear skill for \+levels on its own weapon set .* write the audit in `pieces\.md`'s `## Skill levels` .* Shared slots \(amulet, gloves, helmet\) serve the clear skill first, then the boss entry with the largest share of the fight\. .* Return each damage skill left at \+0 as `levels: <rung>: <skill> \+0`/);
  });

  it('proposes unique jewel candidates by lookup for the socket test, no timeless jewel', () => {
    expect(items).toMatch(/\*\*Unique jewels\*\* \(D-473\), on `b` and `n`: propose candidates by lookup .* Heart of the Well rolling the build's extra-damage element, a Time-Lost jewel with radius lines, Prism of Belief for a skill the build uses, From Nothing for a keystone's radius, Megalomaniac by what it allocates\. No timeless jewel/);
  });

  it(`allows corruption only on a cheap unique (under ${CORRUPTION.cheapUnique.under} divine) and a gem corrupted +1 level, on b and n, never on a rare`, () => {
    expect(items).toMatch(/\*\*Corruption\*\* \(D-471\), on `b` and `n` only, .* a corrupted line only on a \*\*cheap unique\*\*, one under `references\/corruption\.json`'s line uncorrupted \(1 divine\), written as the outcome's `\{enchant\}` line with a `Corrupted` line; and a skill gem corrupted to \+1 level, written at its level with `"corrupt": "plus_one_level"` .* \*\*Never on a rare\*\* .* nor on a magic or normal item, jewels among them; a cheap unique jewel follows the unique rule/);
  });

  it('writes a life flask and a mana flask on every endgame rung, toggles off but for a flask effect, unpriced, and leaves the charm slots empty', () => {
    expect(items).toMatch(/\*\*Flasks and charms\*\* \(D-472\), on `m`, `b` and `n`: `Flask 1` a life flask and `Flask 2` a mana flask, plain normal items of the best base the rung's level allows .* no mana flask on a build that spends no mana \(Blood Magic\), with a `reason` claim .* `\{"slot": "Flask 1", "active": false\}`, unless the build uses a flask-effect line .* The charm slots stay empty .* Flasks are unpriced: no price entry for a Flask slot/);
  });

  it("sweeps the rotation's own conditions and turns each on as earned state", () => {
    expect(build).toMatch(/\*\*The rotation's conditions\*\* \(D-473\), on `b` and `n`: sweep the conditions the rotation's own skills produce, shown or hidden in PoB \(fully broken armour when the build breaks armour\), and turn each on as earned state/);
  });

  it("writes a custom modifier's reason as the one plain sentence a PoB reader sees as its comment line", () => {
    expect(build).toMatch(/\*\*The reason is the comment a PoB reader sees\*\* \(D-469\): on schema 9 the compile writes `# <reason>` before the line .* so write it as one plain sentence on one line, what PoB misses and the source \("PoB doesn't apply Crimson Assault's aggravation; 20% more Rake damage stands in for it"\)/);
  });

  it('keeps a custom modifier line to whole numbers', () => {
    expect(build).toMatch(/\*\*Whole numbers only\*\* in the line: PoB doesn't parse "33\.33%"/);
  });

  it('gives no "Legacy of" example: the cull example is a node confirmed by lookup', () => {
    expect({ cull: build.includes('("Heavy Contact (56997): Detonate Dead\'s hits that Heavy Stun cull")'), legacy: /Legacy of [A-Z]/.test(build) }).toEqual({ cull: true, legacy: false });
  });

  it('leaves every over-budget rune out of the gear unless the brief or a gate answer names it', () => {
    expect(items).toMatch(/\*\*Over-budget runes\*\* \(D-465\): no "Legacy of …" soul core .* and no Raven-Touched Shard .* in any item unless the brief asks for it: `run-log\.json`'s `brief` names it in `around`, `like` or `notes` \(or "Legacy" cores generally\), or a gate answer's words name it .* An over-budget rune is one whose name starts with "Legacy of ", or the one named "Raven-Touched Shard"; never one whose name merely contains "Legacy" \(Coward's Legacy\)/);
  });
});

describe('AC-W103 (WU-133): D1-tree', () => {
  const tree = stage('D1-tree');
  const steps = folded(between(rawStage('D1-tree'), '3. Then the rungs', '## Writes'));

  it('writes tree.start when D1-build ran or after a tree request, and keeps it on a tree-swap retry', () => {
    expect(steps).toMatch(/1\. \*\*The start\*\* \(D-467\): write the rung's `tree\.start`, .* Write it when D1-build ran before you in this attempt .*, after a user's tree request \(step 2\), or when the plan has none; a gate `tree-swap` retry or a guided retry keeps the plan's, so a later attempt can't hide an earlier attempt's fall/);
  });

  it('writes tree.end and tree.search at the end of each rung', () => {
    expect(steps).toMatch(/10\. \*\*The end\*\* \(D-467, D-468\): write the rung's `tree\.end`, the start's figures on the finished tree, before D1-finish, and `tree\.search \{swaps, lastGain, capHit, rebuild, removed, bossFall\}`/);
  });

  it(`rebuilds first at max_distance: ${REACH} with the start's targets`, () => {
    expect(steps).toMatch(new RegExp(`2\\. \\*\\*Rebuild first\\*\\* \\(D-467\\): the call with \`rebuild: true\` at \`max_distance: ${REACH}\`, \`keep\` the rung's needs, \`targets\`,`));
  });

  it(`passes pace_exchange: ${EXCHANGE} in place of the pace guards`, () => {
    expect(tree).toMatch(new RegExp(`- \\*\\*\`pace_exchange: ${EXCHANGE}\`\\*\\* \\(D-467, the user's ${EXCHANGE}× rule\\), in place of \`max_loss\`'s pace guards: each pace figure \\(the clear skill's uses per second and radius, movement speed\\) may fall L% when the move gains at least ${EXCHANGE} × L% Main damage, each figure on its own`));
  });

  it('passes pool_groups only for a weapon set without the clear group', () => {
    expect(tree).toMatch(/- \*\*`pool_groups`\*\* \(D-467\), only for a weapon set that doesn't hold the clear group: `\{"<set>": <group>\}`, the boss rotation's largest entry on that set, .* the clear group's set keeps `MainDamage` on the map config/);
  });

  it('writes no need for an undone rebuild', () => {
    expect(tree).toMatch(/\*\*An undone rebuild writes no need\*\* \(it would freeze the whole tree\): write `tree\.search\.rebuild` `"undone: <why>"`/);
  });

  it(`loops while a swap gains at least ${LOOP_FLOOR}%`, () => {
    expect(steps).toMatch(new RegExp(`6\\. \\*\\*The swap loop\\*\\* \\(D-467\\): the same arguments, compact\\. While its best swap gains at least \\*\\*${LOOP_FLOOR}%\\*\\* Main damage, make it a change, and call again; stop at "none", under ${LOOP_FLOOR}%`));
  });

  it(`stops after ${SWAP_CAP} swaps, an undone one counted, a runaway guard the design gate shows`, () => {
    expect(steps).toMatch(new RegExp(`or after \\*\\*${SWAP_CAP} swaps\\*\\* on the rung, an undone one counted\\. .* The cap of ${SWAP_CAP} is a runaway guard, never a target: the design gate shows it when it is hit`));
  });

  it('lists the passives the rebuild removed whose lines serve another skill', () => {
    expect(steps).toMatch(/9\. \*\*What the rebuild removed for other skills\*\* \(D-467\): each passive a taken rebuild removed whose lines name a skill or skill type the build uses other than the named source \(a Herald, a warcry, a minion\), grouped by that skill: `\{"names": \["Herald Damage"\], "skill": "Herald of Blood"\}`/);
  });

  it(`holds n's boss figure at the ${thousands(BOSS_FLOOR)} floor as a target, undoing only its own move that takes it under`, () => {
    expect(tree).toMatch(/\*\*The boss target on `n`\*\* \(D-468\), for your own moves only .*: `n`'s boss figure stays at or above `boss-floor\.json`'s floor, an agreed target for the finished tree, so a move that takes it from at or above the floor to under it fails the check\. An `n` whose start is already under the floor has no target here, and `m` and `b` have none/);
  });

  it("writes the designer's reason for a fall, and a boss trade when the boss figure fell", () => {
    expect(steps).toMatch(/\*\*A boss fall says why\*\* \(D-468\): when the boss figure or any entry is lower at the end than at the start, write `bossFall`, one reason that may cover several entries.* - \*\*The alternative tree\*\* \(D-468\): when `tree\.end`'s boss figure is below `tree\.start`'s, write a `boss` trade \(Writes\): the best tree you measured during the search, by Main damage, whose boss figure is at least the start's \(the start's own tree when none is better\)/);
  });

  it('checks the server on its first rebuild line and returns stale-server when the targets are missing', () => {
    expect(tree).toMatch(/\*\*The server check\*\* \(D-467\): a session server built before M-26 ignores `targets`, `pace_exchange` and `pool_groups` without a word\. Your first call is `m`'s rebuild \(step 3\): its `Rebuild:` line names its targets, as `EHP <a> \(target <t>\), lowest max hit <b> <type> \(target <u>\)` or `misses its targets after repair: EHP <a> of <t>, lowest max hit <b> of <u>` .* When it doesn't, change nothing more, remove your `tmp` stages, and return `stale-server`: the runner asks the user to reconnect the server with `\/mcp`, then runs you again/);
    // The forms are Appendix A's, which the server writes (src/handlers/treeHandlers.ts).
    expect(SPEC).toMatch(/`Rebuild: \+<x>% Main damage; EHP <a> \(target <t>\), lowest max hit <b> <type> \(target <u>\); repaired: .* or `Rebuild: misses its targets after repair: EHP <a> of <t>, lowest max hit <b> of <u>`/);
    expect(read(path.join(REPO, 'src', 'handlers', 'treeHandlers.ts'))).toContain('`EHP ${figure(s.ehp)} (target ${figure(targets.ehp)}), lowest max hit');
  });

  it('measures unique jewels in the socket test beside the rare jewel, holding "Limited to" itself', () => {
    expect(steps).toMatch(/- \*\*Unique jewels\*\* \(D-473\): measure each candidate of `pieces\.md`'s `## Unique jewels` in the socket beside the rare jewel, .* its `Selected Variant` line\. \*\*"Limited to" is yours to hold\*\*: a unique jewel "Limited to 1" sits in one socket of a rung at most \(nothing in V1 or the compile checks it\)/);
  });

  it(`has no ${OLD_GUARD}% boss guard (D-456, superseded)`, () => {
    expect({ guard: /\*\*The boss guard\*\*|cuts any entry by more than/.test(tree), none: /No per-move boss guard/.test(tree) }).toEqual({ guard: false, none: true });
  });

  it(`has no ${OLD_FLOOR}% floor (D-418, superseded)`, () => {
    expect(tree).not.toMatch(new RegExp(`\\*\\*${OLD_FLOOR}%\\*\\*|under ${OLD_FLOOR}%`));
  });

  it(`has no ${OLD_CAP}-swap cap (D-418, superseded)`, () => {
    expect(tree).not.toMatch(new RegExp(`\\*\\*${OLD_CAP} swaps\\*\\*|counted among the ${OLD_CAP}\\b`));
  });

  it("judges the socket test on the rung's targets, not a swap's 2%", () => {
    expect({ targets: /its `TotalEHP` and lowest max hit stay at or above the rung's targets/.test(steps), old: /fall no more than a swap's/.test(steps) }).toEqual({ targets: true, old: false });
  });
});

describe('AC-W103 (WU-133): D1-finish', () => {
  const finish = stage('D1-finish');
  const trades = folded(between(rawStage('D1-finish'), '5. **The trades**', '6. **Validate**'));

  it('re-checks D1-build\'s boss_<stage> after the anoint and the gear', () => {
    expect(finish).toMatch(/\*\*D1-build writes it\*\* in those cases \(D-468\), so D1-tree judges the tree on it; \*\*re-check it after the anoint and the gear\*\*, by the rules below/);
  });

  it("turns D1-tree's reason for a fall into the boss-fall-<rung> claim", () => {
    expect(finish).toMatch(/- \*\*the boss fall\*\* \(D-468\): on a rung whose `tree\.search\.bossFall` holds D1-tree's reason, one `reason` claim, id `boss-fall-<rung>`, saying why the fall of the boss figure or its entries is fine/);
  });

  it("keeps D1-tree's boss trades when it writes trades.json whole", () => {
    expect(trades).toMatch(/write `<buildFolder>\/trades\.json` whole \(Writes\), D1-tree's `unmodelled` and `boss` entries as they are/);
  });

  it(`calls node power in a trade without targets, the damage trade with pace_exchange: ${EXCHANGE}`, () => {
    expect(trades).toMatch(new RegExp(`pass D1-tree's other arguments \\*\\*without \`targets\`\\*\\*, so their \`max_loss\` allowances judge EHP as before \\(D-448's three, below\\)\\. The damage trade passes \`pace_exchange: ${EXCHANGE}\` in place of \`clearUses: 2\` \\(the user's one rule\\); the defence trade, which buys toughness, passes no \`pace_exchange\` and keeps \`clearUses: 2\``));
  });

  it('shows the best damage move on an n under its toughness band', () => {
    expect(trades).toMatch(/\*\*The best damage move beside them\*\* \(D-467\): an `n` under its band also gets the damage trade below/);
  });

  it('always counts the anoint-only notables among the anoint candidates', () => {
    expect(finish).toMatch(/\*\*The anoint-only notables\*\* \(D-473: a notable with a recipe, no connections and the anoint frame, such as Thaumaturgic Generator; 16 at the pin\) are always among the candidates/);
  });

  it('prices a unique jewel by name, with no target in its query and its share in its note', () => {
    expect(finish).toMatch(/- \*\*A unique jewel\*\* \(D-473\) is priced by name \(Megalomaniac by `mcp__pob2__search_trade_items` on the line it allocates\), with \*\*no `target`\*\* in its query, which would send it to the weighted search; its budget share .* stays in its `note`/);
  });

  it('writes no price entry for a Flask slot or a pinned weapon\'s Swap slot', () => {
    expect(finish).toMatch(/- \*\*No entry for a Flask slot\*\* \(D-472\): a plain flask costs nothing worth counting\. \*\*No entry for a pinned weapon's Swap slot\*\* \(`sameAs`, D-464\): it is its set-1 slot's item, priced once by that slot's entry/);
  });
});

describe('AC-W103 (WU-133): D1-gate', () => {
  const gate = stage('D1-gate');
  const example = JSON.parse(blockAfter(rawStage('D1-gate'), '## Writes')) as Json;

  it('writes the draft in step 6, only on a pass that leads to the design gate, and returns its path', () => {
    expect(gate).toMatch(/\*\*The draft\*\* \(D-466\), the step's last act, only on a pass that leads to the design gate: .* and not the re-price pass .* call `mcp__pob2__compile_plan \{plan_path: "<plan>", draft_name: "<the build's session name>"\}`.* Its reply's first line is `Draft written: <relpath>`: return it as `draft: <relpath>`, which the runner records in `builds\[\]\.draftFile`/);
    // The reply's first line is the server's (src/handlers/planHandlers.ts).
    expect(read(path.join(REPO, 'src', 'handlers', 'planHandlers.ts'))).toContain('const lines = [`Draft written: ${result.path}`];');
  });

  it("writes step 6's design-field additions in Appendix A's keys, from the plan's tree.start, tree.end and tree.search", () => {
    const appendix = folded(between(SPEC_RAW, "### The D1 gate's design field (additions)", "### F1's verdict (addition)"));
    for (const key of ['`start`', '`end`', '`entries: [{label, start, end, final, valuedBy: {figure, reason} | null}]`', '`bossFall: {claim, reason} | null`', '`life {start, end}`', '`swapCap: {swaps, lastGain} | null`', '`rebuild: "taken" | "none" | "undone: <why>"`', '`removedForOthers: [{names, skill}]`', '`levels: [{skill, plus}]`']) {
      expect({ key, inAppendix: appendix.includes(key) }).toEqual({ key, inAppendix: true });
    }
    expect(gate).toMatch(/- \*\*amendment 13's tree search and boss target\*\* \(D-467, D-468, D-473\), per rung, from the plan's `tree\.start`, `tree\.end` and `tree\.search` \(D1-tree's\), copied, and this compile/);
    for (const r of example.design.rungs as Json[]) {
      expect(Object.keys(r.boss).slice(-4)).toEqual(['start', 'end', 'entries', 'bossFall']);
      for (const k of ['life', 'swapCap', 'rebuild', 'removedForOthers', 'levels']) expect({ k, there: k in r }).toEqual({ k, there: true });
    }
  });

  it(`judges the tree at reach ${REACH} with the swap search and the rebuild with repair on tree.start's targets, the swaps alone where the rebuild was undone`, () => {
    expect(gate).toMatch(new RegExp(`the same judge as D1-tree's, at reach ${REACH}\\. .* \\*\\*\`targets\`\\*\\* the plan's \`tree\\.start\` .* The first call is \\*\\*the swap search\\*\\*, the second \\*\\*the rebuild with repair\\*\\* \\(\`rebuild: true\`\\); on a rung whose \`tree\\.search\\.rebuild\` is \`undone: <why>\`, the swap search alone\\. .* A rung whose swap left or rebuild left gains \\*\\*${GATE_LINE}%\\*\\* damage`));
  });

  it("skips Flask slots in the budget part and maps a pinned weapon's Swap slot to its set-1 slot's entry", () => {
    expect(gate).toMatch(/In a build held to amendment 13: \*\*no Flask slot\*\* \(D-472: flasks are unpriced, so leave them out of `basis\.budget\.slots`\), and \*\*a pinned weapon's Swap slot\*\* \(`sameAs`, D-464\) maps to its set-1 slot's entry, or is left out, and that entry counts once in the rung's total/);
  });
});

/** Appendix A's design-gate display lines, by their head, each as a pattern (numbers, names and reasons any). */
const DISPLAY: Record<string, RegExp> = {
  draft: /^- Draft PoB file: .+ \(draft(?: \d+)?\)\.xml, in your builds list\.$/,
  rotation: /^- Boss rotation on [mbn]: [\d,]+ → [\d,]+ on the tree, (?:about )?[\d,]+ at the gate(?: \(floor [\d,]+\))?\. .+$/,
  bossTrade: /^- Boss trade on [mbn]: .+ \(remove \d+, add \d+\): boss [\d,]+ → [\d,]+, damage [−+]\d+%, EHP [−+]\d+%\.$/,
  life: /^- Life on [mbn]: [\d,]+ → [\d,]+ \(EHP and the lowest max hit held their start\)\.$/,
  swapCap: /^- Swap cap on [mbn]: \d+ swaps, the last \+[\d.]+%\.$/,
  undone: /^- Rebuild undone on [mbn]: .+\.$/,
  removed: /^- Removed on [mbn]: .+: lines for .+\.$/,
  levels: /^- Skill levels on [mbn]: .+ \+\d+\.$/,
};
/** Appendix A's display block, its lines joined back where it wraps one. */
const APPENDIX_LINES = (() => {
  const block = blockAfter(between(SPEC_RAW, "### The design gate's display (the lines that change)", '### The brainstorm display'), '');
  return block.split('\n').reduce<string[]>((out, l) => (l.startsWith('- ') ? [...out, l] : [...out.slice(0, -1), `${out[out.length - 1]} ${l.trim()}`]), []);
})();

describe('AC-W104 (WU-133): checkpoints.md, gates.md, F1 and the D2 gate', () => {
  const brainstorm = folded(between(rawRef('checkpoints.md'), '## The brainstorm gate: pick cards to verify', '## The verification gate'));
  const designRaw = between(rawRef('checkpoints.md'), '## The design gate: judge the endgame build', "## The final gate: the build's guide");
  const design = folded(designRaw);

  it(`checkpoints.md's brainstorm section gives the pitch rule and the ${PITCH_WORDS[0]}–${PITCH_WORDS[1]}-word target`, () => {
    expect(brainstorm).toMatch(new RegExp(`- \\*\\*The pitch\\*\\* \\(D-475\\), your reply's main body under the display: each composite or card in plain words, \\*\\*its rotation\\*\\* .*, \\*\\*its synergy's source\\*\\* .* and \\*\\*its catch\\*\\*.* Aim at ${PITCH_WORDS[0]}–${PITCH_WORDS[1]} words for the whole visit`));
  });

  it("checkpoints.md's design gate prints the draft's name, the boss entries, the swap cap, Life and the Removed on and Skill levels on lines, in Appendix A's forms, as the display prints them", () => {
    // Appendix A's own lines are of these forms.
    for (const [kind, re] of Object.entries(DISPLAY)) expect({ kind, appendix: APPENDIX_LINES.some((l) => re.test(l)) }).toEqual({ kind, appendix: true });
    // The doc's example and its prose give each the gate prints.
    const exampleLines = blockAfter(designRaw, '- **Show**').split('\n').map((l) => l.trim());
    const draftInProse = /`(- Draft PoB file: [^`]+)`/.exec(design)?.[1] ?? '';
    const shown = { draft: DISPLAY.draft.test(draftInProse), ...Object.fromEntries((['rotation', 'swapCap', 'life', 'removed', 'levels', 'bossTrade'] as const).map((k) => [k, exampleLines.some((l) => DISPLAY[k].test(l))])) };
    expect(shown).toEqual({ draft: true, rotation: true, swapCap: true, life: true, removed: true, levels: true, bossTrade: true });
    // The real display of the D1 gate's example, with a draft recorded, prints each form.
    const dir = copyFixture('run-a13');
    // D1-tree's boss trade example joins the n rung's trades, as D1-finish's whole-file write keeps it.
    const bossTrade = (JSON.parse(blockAfter(rawStage('D1-tree'), '`<buildFolder>/trades.json` (D-439')) as Json).trades.find((x: Json) => x.kind === 'boss');
    editJson(dir, GATE, (g) => {
      g.design = (JSON.parse(blockAfter(rawStage('D1-gate'), '## Writes')) as Json).design;
      g.design.rungs.find((r: Json) => r.stage === 'n').trades.push(bossTrade);
    });
    editJson(dir, 'run-log.json', (log) => {
      log.builds[0].draftFile = 'Blood Hunt with Rolling Slam clear (draft).xml';
    });
    const r = node(RUN_LOG, [dir, 'display', 'design', '--build', BUILD]);
    expect({ code: r.code, stderr: r.stderr }).toEqual({ code: 0, stderr: '' });
    const out = r.stdout.split('\n');
    for (const [kind, re] of Object.entries(DISPLAY)) expect({ kind, printed: out.some((l) => re.test(l)) }).toEqual({ kind, printed: true });
  });

  it("the D1 gate's design-field example passes the run checker's amendment-13 shape rules", () => {
    const dir = copyFixture('run-a13');
    editJson(dir, GATE, (g) => {
      g.design = (JSON.parse(blockAfter(rawStage('D1-gate'), '## Writes')) as Json).design;
    });
    const r = node(CHECKER, [dir]);
    const shape = r.stderr.split('\n').filter((l) => /\[design-field\]/.test(l) && /has life|has swapCap|has rebuild|has removedForOthers|has levels|'s boss has start|boss\.bossFall is/.test(l));
    expect(shape).toEqual([]);
  });

  it('F1 and the D2 gate name the file by the session name, first_free on a first write only, the recorded name on a re-compile', () => {
    const f1 = stage('F1');
    const d2 = stage('D2-gate');
    expect(f1).toMatch(/\*\*`buildName`\*\* \(D-466\), as the runner gives it, in a build held to amendment 13: \*\*the build's session name\*\*, its `name` in `run-log\.json`'s `builds\[\]` when a revision renamed it, else its card's name .* with \*\*`firstFree: true`\*\* on the build's first final write; on a re-compile .* the name the run log recorded \(`builds\[\]\.pobFile`\) and `firstFree: false`/);
    expect(d2).toMatch(/\*\*`buildName`\*\* \(D-466\), as the runner gives it, in a build held to amendment 13: \*\*the build's session name\*\* .* and ` \(campaign\)`, `Royal Fury Rake Titan \(campaign\)`, with \*\*`firstFree: true`\*\* on the campaign's first write; on a later D2 gate .* the campaign file's recorded name \(`builds\[\]\.pobFile`\) and `firstFree: false`/);
  });

  it('F1 removes the draft with remove_draft after the final file, leaving one it may not delete as draftLeft', () => {
    expect(stage('F1')).toMatch(/6\. \*\*The draft's removal\*\* \(D-466\), only after the final file is written, when the header's `draftFile` isn't `null`: call `mcp__pob2__compile_plan \{plan_path: "<plan>", remove_draft: "<draftFile>"\}`\. .* write `draftLeft: <draftFile>`, which the final display prints/);
    expect((JSON.parse(blockAfter(rawStage('F1'), '## Writes')) as Json).draftLeft).toBeNull();
  });

  it("gates.md's tree part has no max_loss judge and no 3% loop, and ranks a set's pool by its group", () => {
    const tree = folded(between(rawRef('gates.md'), '- **tree**, the passive tree\'s travel', '### The design field'));
    expect({ maxLoss: tree.includes('within `max_loss`'), loop3: /under 3%|\b3% loop/.test(tree), pools: /`pool_groups`, so a weapon set's pool without the clear group ranks by its own group against a Pinnacle boss/.test(tree), loop1: /D1-tree stops its loop under 1%/.test(tree) }).toEqual({ maxLoss: false, loop3: false, pools: true, loop1: true });
  });

  it("gates.md's budget part skips Flask slots and maps a pinned weapon's Swap slot", () => {
    expect(ref('gates.md')).toMatch(/In a build held to amendment 13: \*\*Flask slots are skipped\*\* \(D-472: a plain flask is unpriced, so it has no entry and maps to none\), and \*\*a pinned weapon's Swap slot\*\* \(`sameAs`, D-464\) maps to its set-1 slot's entry, or to none, and that entry counts once for both/);
  });
});

describe('AC-W104 (WU-133): pricing.md', () => {
  const pricing = ref('pricing.md');

  it('checks the pace line on its first trade call and returns the pace stop', () => {
    expect(pricing).toMatch(/- \*\*The pace line first\*\* \(D-474\)\. .* `Pace: 45 s between searches, at most 7 in 5 minutes\.`\. A pricing step's \*\*first trade call reads it\*\*: with no pace line .* or `Pace: off \(test setting\)\.`, the step makes no more trade calls, .* counts that call as `pace`, and returns the stop `pace: missing` or `pace: off`/);
    // The line is the server's, and the run log's stop list takes `pace` (run-log.mjs's STOP_OUTCOMES).
    expect(read(path.join(REPO, 'src', 'server', 'toolSchemas.ts'))).toContain("'Pace: 45 s between searches, at most 7 in 5 minutes.', or 'Pace: off (test setting).'");
    expect(read(RUN_LOG)).toMatch(/export const PACE = 'pace';[\s\S]*STOP_OUTCOMES = \['rate_limited', 'locked_out', PACE\]/);
  });

  it('sends no over-budget rune to the trade site without the brief\'s say', () => {
    expect(pricing).toMatch(/- \*\*No rune over the budget\*\* \(D-465\): a "Legacy of …" soul core or the Raven-Touched Shard is never priced, on the trade site or the exchange, unless the brief asks for it/);
  });

  it('prices no flask', () => {
    expect(pricing).toMatch(/\*\*No Flask slot is priced\*\* \(D-472: a plain flask costs nothing worth counting\)/);
  });

  it('prices a corrupted unique uncorrupted, under the cheap line, with cheapness unchecked where no price judges it', () => {
    expect(pricing).toMatch(/- \*\*A corrupted unique is priced uncorrupted\*\* \(D-471\): by name, without the corrupted line as a required affix, its `note` `priced uncorrupted: buy copies and corrupt until one rolls <line>`.* A unique priced at or over `references\/corruption\.json`'s line \(1 divine, at the run's rates\) can't carry a corrupted line .* the `note` adds `cheapness unchecked: <why>`/);
    expect(CHECKER_TEXT).toContain('cheapness unchecked: ');
  });

  it('prices a unique jewel by name, by the line it allocates for one that allocates a notable, with no target', () => {
    expect(pricing).toMatch(/- \*\*A unique jewel\*\* \(D-473\): by name \(`mcp__pob2__get_item_price`\), or, for one that allocates a notable \(Megalomaniac's "Allocates <notable>"\), by `mcp__pob2__search_trade_items` on the line it allocates, with \*\*no `target` in its query\*\*/);
  });

  it('notes fractured lines, unique jewels and the price drivers', () => {
    expect(pricing).toMatch(/\*\*Price notes\*\* \(D-473, from the finishing-touches study\): \*\*fractured lines\*\* are priced as plain explicit mods \(never the fractured filter\), the roll loosened one tier; \*\*unique jewels\*\* by what they allocate; and the usual \*\*price drivers\*\* are \+3 or more skill levels with only the top matching damage lines, and amulets with Spirit, crit and defences/);
  });

  it('passes sort_stats for a slot that serves a set-2 skill', () => {
    expect(pricing).toMatch(/\*\*But for a slot that serves a set-2 skill\*\* \(D-473; `pieces\.md`'s `## Skill levels`\), pass `sort_stats` weighting that skill, from the stats `trade_query_options` lists: the default weights read the main skill/);
  });
});

describe('AC-W104 (WU-133): W1, the guide templates and V4', () => {
  const w1 = stage('W1');
  const TEMPLATES = ['guide-template.md', 'guide-endgame-template.md'];

  it('W1 and both templates carry the corruption lines in the words the run checker looks for', () => {
    expect(w1).toMatch(/- \*\*Corruption\*\* \(D-471\), the user's one exception to D-348: for each corrupted unique on `b` or `n` .* one line holding the unique's name, "buy several" and "corrupt", "Buy several <unique> and corrupt them until one rolls <line>".* for each skill gem with `"corrupt": "plus_one_level"`, one line holding the gem's name, "corrupt" and "\+1 level", "Corrupt cheap low-level <gem> gems until one gets \+1 level, then level it to 20"/);
    for (const name of TEMPLATES) {
      const t = template(name);
      expect({ name, unique: t.includes('Buy several <the unique> and corrupt them until one rolls <the line>'), gem: t.includes('Corrupt cheap low-level <the gem> gems until one gets +1 level, then level it to 20.') }).toEqual({ name, unique: true, gem: true });
    }
    // The checker reads a unique's line by "buy several" and "corrupt", a gem's by "corrupt" and "+1 level".
    expect(CHECKER_TEXT).toContain("says(item.name, /\\bbuy several\\b/, /\\bcorrupt/)");
    expect(CHECKER_TEXT).toContain("says(String(gem.name ?? ''), /\\bcorrupt/, /\\+1 level\\b/)");
  });

  it('W1 and both templates carry the flask line', () => {
    expect(w1).toMatch(/- \*\*The flasks\*\* \(D-472\), one line, once, in the first endgame rung: the two flasks' bases/);
    for (const name of TEMPLATES) expect({ name, flasks: /^\[one line, once, in the first endgame rung \(D-472\)\] Flasks: <Flask 1's base> and <Flask 2's base>/m.test(template(name)) }).toEqual({ name, flasks: true });
  });

  it('W1 and both templates carry the pinned weapon line', () => {
    expect(w1).toMatch(/- \*\*The pinned weapon\*\* \(D-464\)\. Where a rung's Swap slot holds its set-1 weapon \(`items\.slots\[\]` with `sameAs`\), one line where the gear names it: pin the weapon to both weapon sets/);
    for (const name of TEMPLATES) expect({ name, pin: (template(name).match(/\(sameAs, D-464\)\] (?:\*\*Pinned weapon:\*\* p|P)in <the weapon> to both weapon sets/g) ?? []).length }).toEqual({ name, pin: 3 });
  });

  it("W1 and both templates carry the note that the comment lines show in red in PoB's config tab, on purpose", () => {
    expect(w1).toMatch(/\*\*The comment lines\*\* \(D-469\), on a schema-9 plan with custom modifiers: one line saying that the lines starting with `#` in PoB's Configuration tab show in red, PoB's colour for a line it doesn't apply, and that they are the custom modifiers' notes, there on purpose/);
    for (const name of TEMPLATES) expect({ name, red: template(name).includes("In PoB's Configuration tab, the lines starting with # show in red, PoB's colour for a line it doesn't apply: they are my notes on the custom modifiers, there on purpose.") }).toEqual({ name, red: true });
  });

  it('V4 checks the boss-fall claim against its figures', () => {
    expect(stage('V4')).toMatch(/- \*\*The boss fall\*\* \(D-468\) is checked too, like a hinge claim: D1-finish's `boss-fall-<rung>` claim, .* a fall it doesn't explain, a figure it misstates, or a reason with no fall behind it .* is a finding for `D1`, `hinge: yes`/);
  });

  it('V4 checks the guide\'s corruption lines', () => {
    expect(stage('V4')).toMatch(/- \*\*the corruption lines\*\* \(D-471\): for each unique on `b` or `n` whose item text holds a designed corruption .* one line names the unique and tells the reader to buy several and corrupt them until one rolls its line; for each skill gem with `"corrupt": "plus_one_level"`, one line names the gem .* A missing or wrong line is a finding for `W1`, `hinge: yes`/);
  });
});

describe("AC-W104 (WU-133): the coordinator's standing rules, the task header and the fix round", () => {
  it("the coordinator's standing rules allow the draft calls and name files by the session name", () => {
    const def = agent('build-guide-coordinator');
    expect(def).toMatch(/A PoB file reaches the builds folder only through the server: a final compile, or the design gate's draft \(D-466\), which the D1 gate writes with `mcp__pob2__compile_plan \{plan_path, draft_name\}` on a pass and F1 removes with `\{plan_path, remove_draft\}` after the final file/);
    expect(def).toMatch(/In a build held to amendment 13 \(D-466\) the name is \*\*the build's session name\*\* \(its `name` in `builds\[\]`, else its card's\), a campaign's D2 gate adding ` \(campaign\)`/);
  });

  it('task-header.md allows the draft calls and names files by the session name', () => {
    const header = ref('task-header.md');
    expect(header).toMatch(/- \*\*The draft calls\*\* \(D-466\), which run no engine: the D1 gate's step 6, on a pass that leads to the design gate, calls `mcp__pob2__compile_plan \{plan_path, draft_name: <the build's session name>\}`.* F1, after its final compile, calls `\{plan_path, remove_draft: <draftFile>\}`/);
    expect(header).toMatch(/\| `buildName` \| F1 and the D2 gate only, for the final compile\. In a build held to amendment 13 \(D-466\), \*\*the build's session name\*\*/);
  });

  it('fix-round.md names the campaign file by the session name and runs a re-compile with the recorded name', () => {
    expect(ref('fix-round.md')).toMatch(/in a build held to amendment 13, the build's session name and ` \(campaign\)`.* with `firstFree: true` on the campaign's first write.* A later fix round or revision of the full build rewrites the campaign file, passing its recorded name \(`builds\[\]\.pobFile`\) with `firstFree: false`/);
  });
});

describe('AC-W104 (WU-133): D-477, a file-only build\'s claims pass', () => {
  it('SKILL.md runs the claims pass after F1, only for a build held to amendment 13 by its last D1 gate', () => {
    expect(SKILL).toMatch(/- \*\*The claims pass\*\* \(D-477; `references\/fix-round\.md`\), only for a build taken `accept:file` and held to amendment 13 by its last D1 gate \(none for one designed before the boundary\): it stays `designing` after F1's pass for one verifier, stage `V4-claims`, `check: "claims"`, `findings: \[\]`/);
  });

  it('SKILL.md gives the claims pass a fix round with D1 alone and one re-check', () => {
    expect(SKILL).toMatch(/an `unresolved` finding gets a fix round with D1 alone \(no design gate\) and one re-check; then it ends `file-only`/);
  });

  it("SKILL.md tells a file-only build's open findings at the run's end", () => {
    expect(SKILL).toMatch(/its status and its known issues \(a file-only build's: its claims pass's open findings, each one's `reader` sentence, D-477\)/);
  });

  it("V4.md's claims mode checks the plan's hinge claims, reads no guide, and gives the report the checker's H1 and owner", () => {
    const v4 = stage('V4');
    expect(v4).toMatch(/- \*\*`check: "claims"`\*\*: every hinge claim of `plan\.json` against its source, as the full pass checks it.* and \*\*no guide\*\*.* `## Checked` lists each claim, `claim stages\[<i>\]\.claims\[<k>\] \(<id>\)`, and no `section` line\. Every finding is the plan's: `owner: D1`, `artifact: plan\.json`/);
    expect(v4).toContain("The claims pass's H1 is exactly `# V4-<n>: claims pass` (D-477).");
    // The run checker's H1 rule reads an instance of the form as the claims pass.
    const rule = /const h1 = (\/\^V4-[^\n]*?\$\/)\.exec\(rep\.h1/.exec(CHECKER_TEXT)![1];
    const h1 = new RegExp(rule.slice(1, -1)).exec('V4-3: claims pass');
    expect(h1?.[6]).toBe('claims pass');
  });

  it('fix-round.md gives the claims pass its round: the round copy with no guide, D1 alone, no design gate, one re-check', () => {
    expect(ref('fix-round.md')).toMatch(/## A file-only build's claims pass \(D-477\) .* 2\. \*\*Its fix round\*\*, once, only with an `unresolved` finding: the round copy \(`--snapshot <n>`, the plan and the record only\), then \*\*D1 alone\*\* .* a recompile runs the D1 gate, then F1, passing the recorded name with `firstFree: false` and no draft to remove; \*\*no design gate\*\*\. 3\. \*\*Its re-check\*\*: `check-run\.mjs <runFolder> --changed <n> --build <id>` \(claims only\), then one `V4-recheck` verifier/);
  });

  it("task-header.md names the claims pass's stage and check", () => {
    expect(ref('task-header.md')).toMatch(/`claims` \(stage `V4-claims`: a file-only build held to amendment 13, every hinge claim of the plan and no guide, after F1's pass, D-477\)/);
  });

  it("checkpoints.md's accept:file runs the claims pass for a build held to amendment 13", () => {
    expect(ref('checkpoints.md')).toMatch(/- \*\*file only\*\* \(`accept:file`, D-411\): F1, its PoB file and no guide\. In a build held to amendment 13 by its last D1 gate \(D-477\), F1's pass is followed by \*\*the claims pass\*\*: one verifier \(`V4-claims`\) checks every hinge claim of the plan against its source, reading no guide/);
  });

  it("gates.md's F1 outcome sends a file-only build held to amendment 13 to its claims pass", () => {
    expect(rawRef('gates.md')).toContain('after `accept:file`, a build held to amendment 13 by its last D1 gate goes to its claims pass (`V4-claims`, D-477');
  });

  it("the verifier's definition names the claims pass", () => {
    expect(agent('build-guide-verifier')).toMatch(/you run once as its \*\*claims pass\*\* \(stage `V4-claims`, `check: "claims"`, D-477\): every hinge claim of its plan against its source, and no guide/);
  });
});

describe('AC-W104 (WU-133): SKILL.md', () => {
  it('names the final file by the session name', () => {
    expect(SKILL).toMatch(/`buildName` is the build's session name \(D-466: `builds\[\]\.name`, else its card's\), `firstFree: true` on its first final write, the recorded `pobFile` on a re-compile/);
  });

  it("records builds[].draftFile from the draft mode's reply, and null after F1's removal", () => {
    expect({ record: /Its `draft: <relpath>` line, the draft mode's reply on a pass, is the build's `draftFile`: log it with `build` \(D-466\)/.test(SKILL), cleared: /and, on `draft removed`, `draftFile` null/.test(SKILL) }).toEqual({ record: true, cleared: true });
  });

  it("writes the draft on an escalation's accept", () => {
    expect(SKILL).toMatch(/going on as if the gate passed \(after the D1 gate, first the draft: `mcp__pob2__compile_plan \{plan_path, draft_name\}`, its path into `builds\[\]\.draftFile`, D-466/);
  });

  it("routes D1-tree's stale-server to the user's /mcp and a re-run", () => {
    expect(SKILL).toMatch(/\*\*`stale-server`\*\* \(D-467\): its first node power reply ignored the targets, a session server built before M-26: log it `stale-server`, ask the user to reconnect the server with `\/mcp`, then run D1-tree again, next/);
  });

  it('sends a tree-only change on a schema-8 plan through D1-build first', () => {
    expect(SKILL).toMatch(/a change to the tree alone .* runs D1-tree, then D1-finish \(on a plan at schema 8 or earlier, D1-build first, to move it to 9, amendment 13 §22\)/);
  });

  it("lists the untracked files after each step against the run's first listing", () => {
    expect(SKILL).toMatch(/- `git status --porcelain` from the repository root, \*\*the stray-file check\*\* \(D-474\): keep the untracked paths at the run's start or resume in your context; after each step, tell the user each new one, and delete nothing/);
  });

  it('cites references/corruption.json', () => {
    expect(SKILL).toContain("corruption's cheap line `references/corruption.json` (D-471)");
  });
});

// ---------------------------------------------------------------------------------------------------
// Amendment 14 (M-27), WU-142: AC-W110 and AC-W111, the design and pricing docs, one assertion each. The forms are read
// from amendment 14 (`docs/build-guide/spec/amendment-14-files-specs-and-repairs.md`); the docs' examples go through the
// real scripts (`run-log.mjs`, `check-run.mjs`) on the revision-14 fixture `run-a14`, the plan schema's own validation
// (`validatePlan`) and the server's own renderers, so the text is held to the spec and its examples to the code.
// ---------------------------------------------------------------------------------------------------

const A14_RAW = read(path.join(REPO, 'docs', 'build-guide', 'spec', 'amendment-14-files-specs-and-repairs.md'));
const A14 = folded(A14_RAW);
/** A form amendment 14 states, by a pattern; it throws when the spec doesn't state it. */
function a14(re: RegExp, what: string): RegExpExecArray {
  const m = re.exec(A14);
  if (!m) throw new Error(`amendment 14 doesn't state ${what}`);
  return m;
}
const REF14 = loadReferenceData(path.join(REPO, 'data'));
const RUN14 = 'run-a14';
const PLAN14 = `builds/${BUILD}/plan.json`;
const TRADES14 = `builds/${BUILD}/trades.json`;
/** The run checker's lines of one rule, on a run folder. */
function ruleLines(dir: string, rule: string): string[] {
  return node(CHECKER, [dir]).stderr.split('\n').filter((l) => l.includes(`[${rule}] `));
}
/** Every fenced block of a text, its body. */
const blocks = (text: string) => [...text.matchAll(/```(?:json)?\n([\s\S]*?)\n *```/g)].map((m) => m[1]);
/** A stage of a plan. */
const stageOf = (plan: Json, id: string): Json => (plan.stages as Json[]).find((s) => s.id === id)!;

// The spec's numbers and forms.
const [, DEPTH_POSITION, DEPTH_MIN] = a14(/the \*\*depth price\*\* is the (\d+)th-cheapest of at least (\d+) listings sorted by price/, 'the depth price').map(Number);
const [, SEARCH_CAP] = a14(/\*\*At most (\d+) trade searches a slot\*\*, the budget search counting as 2/, 'the search cap').map(Number);
const [, LEVEL_M, LEVEL_BN] = a14(/A rung's \*\*item level\*\* for affix tiers is (\d+) on `m` and (\d+) on `b` and `n`/, 'the rung item levels').map(Number);
const [, CAP_HOW, CAP_GEAR, CAP_CATCH] = a14(/`how` at most (\d+) characters, each `gear` text at most (\d+), `catch` at most (\d+)/, "the summary's caps").map(Number);
const [, REQUEST_MADE, REQUEST_DEPARTS] = a14(/one line per request\*\*, outside its 8-line return .*?: `(request: <id> made)` or `(request: <id> departs: <how>)`/, 'the request lines');
const [, VOLUME_LOW, VOLUME_HIGH, MINUTES_LOW, MINUTES_HIGH] = a14(/about (\d+) to (\d+) a build, (\d+) to (\d+) minutes at the 45 s pace \(D-461\)\. The pricing notice counts them/, 'the search volume').map(Number);
const [, SCALING_CAP] = a14(/\(announced, paced, at most (\d+) trade searches a build\)/, "the scaling pass's cap").map(Number);
const [, FINDS_MEASURED] = a14(/D1-finish measures the finds on temporary stages, as today, at most (\d+) a build, the largest gains first/, 'the finds measured').map(Number);
const [, BOSS_FALL_PERCENT] = a14(/D1-finish writes `boss-fall-<rung>` when the final boss figure is more than (\d+)% under `tree\.end`'s/, 'the boss fall after gear moved').map(Number);
const [, ILLEGAL_FORM] = a14(/an unclosed shortfall reads `([^`]+)`/, "the attribute repair's illegal form");
const [, CAUSE_A, CAUSE_B, CAUSE_C] = a14(/The fallback reads `(\[trade:no_session\]) …`, `(\[trade:session_rejected\]) …` or `(\[trade:too_complex\]) Trade search not run: <reason>\.`/, "the fallback's causes");
const [, TIER_FORM] = a14(/A mechanic-mode mod hit lists its tiers: `([^`]+)`/, "the lookup's tier line");
const [, SOCKET_FORM] = a14(/The base mode's socket line: `([^`]+)`/, "the base mode's socket line");
const CAMPAIGN_QUOTE = a14(/"(a T8 item at item level 20 will be nearly as expensive as a T1 or T2 item at item level 82)"; "(Usually the solution to this is to only use two or three affixes in campaign guide gear)"/, "the user's campaign note");
const CORRUPTION_QUOTE = a14(/\*\*Corruption:\*\* "(extra sockets allowed within budget, corruption implicits out)/, "the user's corruption ruling")[1];

describe("amendment 14's forms, as AC-W110 and AC-W111 read them", () => {
  it('reads the depth price, the caps, the rung item levels, the request lines and the volume as approved', () => {
    expect({ DEPTH_POSITION, DEPTH_MIN, SEARCH_CAP, LEVEL_M, LEVEL_BN, CAP_HOW, CAP_GEAR, CAP_CATCH, SCALING_CAP, FINDS_MEASURED, BOSS_FALL_PERCENT })
      .toEqual({ DEPTH_POSITION: 5, DEPTH_MIN: 10, SEARCH_CAP: 5, LEVEL_M: 69, LEVEL_BN: 82, CAP_HOW: 400, CAP_GEAR: 120, CAP_CATCH: 300, SCALING_CAP: 15, FINDS_MEASURED: 5, BOSS_FALL_PERCENT: 2 });
    expect([REQUEST_MADE, REQUEST_DEPARTS]).toEqual(['request: <id> made', 'request: <id> departs: <how>']);
    expect([VOLUME_LOW, VOLUME_HIGH, MINUTES_LOW, MINUTES_HIGH]).toEqual([20, 35, 15, 26]);
    expect([CAUSE_A, CAUSE_B, CAUSE_C]).toEqual(['[trade:no_session]', '[trade:session_rejected]', '[trade:too_complex]']);
    // The server's own forms are the spec's (WU-136, WU-139).
    expect(ILLEGAL_FORM).toBe('<Attribute> would be <x>, under the <y> its gear and gems need, after repair');
    expect(TIER_FORM).toBe('T<n> (item level <l>): <range>');
    expect(SOCKET_FORM).toBe("Sockets: <count> (PoB's ceiling <socketLimit> counts Exceptional and corruption)");
  });
});

// D1-build's Returns examples and pieces.md example, its request lines and its unmeasured rows.
const D1_BUILD_RAW = rawStage('D1-build');
const BUILD_RETURNS = between(D1_BUILD_RAW, '## Returns', '## Fault directives');
const RETURN_EXAMPLES = blocks(BUILD_RETURNS).map((b) => b.split('\n'));
const PIECES_ROWS = blocks(between(D1_BUILD_RAW, "**`pieces.md`**, the build's", '- **Title:**'))[0]
  .split('\n').filter((l) => l.startsWith('| ') && !l.startsWith('| Key')).map((l) => l.slice(1, -1).split('|').map((c) => c.trim()));
const UNMEASURED = PIECES_ROWS.filter((r) => r[3] === 'out' && /^unmeasured \(estimate: /.test(r[5]));
/** The user's words of D1-build's example requests (`request: u1 made`, `request: u2 departs: …`), as a gate logs them. */
const EXAMPLE_WORDS: Record<string, string> = { u1: 'use the 5 divine staff', u2: "if it's not a crit build, it doesn't need the crit damage suffix" };

describe('AC-W110 (WU-142): D1-build', () => {
  const build = stage('D1-build');

  it("returns one request: line per request (:32–34), outside its 8 lines, each in §8's form, and its example's requests log and check through the scripts", () => {
    const inputs = folded(between(D1_BUILD_RAW, "  - the user's requests (`code: \"user-request\"`)", "  - D1-finish's `build: corruption"));
    expect(inputs).toMatch(/\*\*The user's words stay literal\*\* \(D-482\): in a revision-14 run each request carries its `id` and `words`, the user's text verbatim .* a condition stays a condition .* Return one line per request, `request: <id> made` or `request: <id> departs: <how>`, outside your 8 lines \(Returns\)/);
    expect(folded(BUILD_RETURNS)).toContain(`Then, outside the 8 lines, one line per user request your header carried (D-482): \`${REQUEST_MADE}\`, or \`${REQUEST_DEPARTS}\``);
    // Each example: at most 8 lines but its request lines, each request line in §8's form.
    for (const ex of RETURN_EXAMPLES) {
      const requests = ex.filter((l) => l.startsWith('request: '));
      expect({ ex, eight: ex.length - requests.length <= 8, forms: requests.every((l) => /^request: \S+ (?:made|departs: \S.*)$/.test(l)) }).toEqual({ ex, eight: true, forms: true });
    }
    const lines = RETURN_EXAMPLES.flat().filter((l) => l.startsWith('request: '));
    expect(lines.length).toBeGreaterThanOrEqual(2);
    const requests = lines.map((l) => {
      const [, id, rest] = /^request: (\S+) (.*)$/.exec(l)!;
      return { id, words: EXAMPLE_WORDS[id], result: rest };
    });
    // run-log.mjs takes the entry; the checker finds the words in the design checkpoint's note, and not without it.
    const dir = copyFixture(RUN14);
    const r = node(RUN_LOG, [dir, 'stage', '-'], JSON.stringify({ stage: 'D1-build', concept: BUILD, attempt: 2, outcome: 'done', requests }));
    expect({ code: r.code, stderr: r.stderr }).toEqual({ code: 0, stderr: '' });
    const unsaid = ruleLines(dir, 'requests');
    editJson(dir, 'run-log.json', (log) => {
      (log.checkpoints as Json[]).find((c) => c.checkpoint === 'design')!.note = Object.values(EXAMPLE_WORDS).join('; ');
    });
    expect({ unsaid: unsaid.length, said: ruleLines(dir, 'requests') }).toEqual({ unsaid: requests.length, said: [] });
  });

  it('marks a piece left out unmeasured in pieces.md with its estimate, which D1-tree writes as its unmodelled line', () => {
    expect(build).toMatch(/\*\*A piece left out unmeasured\*\* \(D-489\): an ascendancy notable you don't measure, or a piece PoB can't measure, that the design leaves out is never left out untold .* its `pieces\.md` row is `out`, its Why `unmeasured \(estimate: <your estimate of what it would give>\): <why it's out>` \(Writes\), and D1-tree writes its `unmodelled` trade line from that row/);
    expect(UNMEASURED.length).toBeGreaterThan(0);
  });

  it("ranks with link_only, the build's weights and weight_corrupted_mods: false, the weights PoB's own stat ids", () => {
    expect(build).toContain("`mcp__pob2__find_upgrades {slot, link_only: true, sort_stats: <the build's weights>, weight_corrupted_mods: false, league}` sends no request and returns PoB's ranking of the slot's affixes");
    const weights = /\*\*The build's weights\*\*: `FullDPS` 1 and `TotalEHP` 0\.5, plus what the build needs from PoB's stat list \(`Spirit` for its reservations, `ManaRegen` for its sustain, `Str`, `Dex` or `Int` for a requirement, `EffectiveMovementSpeedMod` on boots\), each with a one-line `why`/.test(build);
    // Each stat id is one of PoB's power stats (`Modules/Data.lua`'s `data.powerStatList`), as find_upgrades' sort_stats takes them.
    const pob = read(path.join(REPO, 'vendor', 'PathOfBuilding-PoE2', 'src', 'Modules', 'Data.lua'));
    const ids = ['FullDPS', 'TotalEHP', 'Spirit', 'ManaRegen', 'Str', 'Dex', 'Int', 'EffectiveMovementSpeedMod'];
    const schema = (getTradeToolSchemas() as Json[]).find((t) => t.name === 'find_upgrades')!.inputSchema.properties as Json;
    expect({ weights, pob: ids.filter((id) => !pob.includes(`stat="${id}"`)), linkOnly: 'link_only' in schema, corrupted: 'weight_corrupted_mods' in schema }).toEqual({ weights: true, pob: [], linkOnly: true, corrupted: true });
  });

  it("drops an affix the base can't roll by lookup, and reads its tiers in the lookup's own line form", () => {
    expect(build).toContain("2. **The base's tiers by lookup**: `mcp__pob2__lookup_game_data {mode: \"mechanic\", query: <the affix text>, kind: \"mod\"}` for each ranked affix: drop an affix the base can't roll (its `Base types:`)");
    expect(build).toContain(`(\`    ${TIER_FORM}\`)`);
  });

  it("takes 3 or 4 must-haves, a `why` outside PoB's top 4 and each of the top 4 left out in `leftOut`", () => {
    expect(build).toMatch(/3\. \*\*The must-haves\*\*: 3 or 4 from the top of the ranking, plus what PoB scores at zero but the build needs .* One outside PoB's top 4 carries its `why`; each of the top 4 you leave out goes in `leftOut` with its `why`/);
  });

  it('keeps a must-have PoB scores at zero required, never lowered or dropped', () => {
    expect(build).toMatch(/\*\*A must-have PoB scores at zero is always required\*\*, never lowered or dropped for its importance/);
  });

  it('starts n at T1 with a depth check of at least 10 listings', () => {
    expect(build).toMatch(new RegExp(`4\\. \\*\\*\`n\` first, at T1\\*\\*: \`n\`'s must-haves at their best tier allowed, and a \\*\\*depth check\\*\\*, \`mcp__pob2__search_trade_items\` .* \`limit: ${DEPTH_MIN}\`: with at least ${DEPTH_MIN} found and the ${DEPTH_POSITION}th cheapest within \`n\`'s target, that is its price`));
  });

  it('runs the budget search with include_non_upgrades: true, then the depth check at the mix', () => {
    expect(build).toMatch(/5\. \*\*The budget search\*\* \(`b`, and `n` when its check fails\): `mcp__pob2__find_upgrades` with the 3 most important must-haves at their floor tiers' lowest rolls as `required_mods`, the weights, `include_non_upgrades: true`, `max_price` the target, `rune_behaviour: "remove"`: .* Then \*\*the depth check\*\* at that mix prices the slot/);
  });

  it(`holds a slot to ${SEARCH_CAP} trade searches`, () => {
    expect(build).toContain(`**At most ${SEARCH_CAP} trade searches a slot**, the budget search counting as 2`);
  });

  it("compiles each must-have at its tier's lowest roll", () => {
    expect(build).toMatch(/7\. \*\*The compiled rare\*\* holds each must-have at its tier's lowest roll, the tier the loop ended at, so every listing found meets the PoB file's figures/);
  });

  it('titles rares by their key affixes, never a generated name', () => {
    expect(build).toMatch(/\*\*A rare is titled by its key affixes\*\* \(D-489\): its name line, the line after `Rarity: Rare`, is its key affixes, `\+2 spell levels, Spirit, chaos resistance` .* each comma-separated part naming one of its explicit lines; never a generated name/);
  });

  it('writes tree.exclude with reasons, which D1-tree and the gate pass as exclude', () => {
    expect(build).toMatch(/\*\*The exclude list\*\* \(D-490, schema 10\): `tree\.exclude \[\{nodes, reason\}\]` on each rung, from your "out" decisions .* each entry with its reason\. D1-tree and the D1 gate pass the rung's list to node power as `exclude`/);
  });

  it("socket-tests Crystalline Phylactery's jewel socket (17788) against the notable it displaces", () => {
    expect(build).toMatch(/\*\*An ascendancy jewel socket\*\* \(D-492\): .* \(Crystalline Phylactery, 17788, the Lich's and the Abyssal Lich's\) is valued by a \*\*socket test\*\*: a temporary stage that copies the rung with the node in `tree\.ascendancyNodes` in place of the notable it displaces, and a basic jewel .* `items\.treeJewels \{node: 17788, text\}`/);
  });

  it('writes scaling finds, its example a find the checker takes and the design display prints under Over budget', () => {
    expect(build).toMatch(/\*\*Finds over the budget\*\* \(D-486\)\. When the loop leaves a dearer spec out .* write it to `<buildFolder>\/trades\.json` as a `scaling` find: .* by: "D1-build"\}`/);
    const find = JSON.parse(blocks(between(D1_BUILD_RAW, '**Finds over the budget** (D-486)', '- **Boots carry'))[0]) as Json;
    const dir = copyFixture(RUN14);
    editJson(dir, TRADES14, (t) => (t.trades as Json[]).push(find));
    editJson(dir, GATE, (g) => (g.design.rungs as Json[]).find((r) => r.stage === find.stage)!.trades.push(find));
    const shown = node(RUN_LOG, [dir, 'display', 'design', '--build', BUILD]).stdout.split('\n');
    expect({ trades: ruleLines(dir, 'trades'), by: find.by, printed: shown.some((l) => l.startsWith(`- ${find.from} was swapped for ${find.to}; adding it back: +${find.damage}% damage`) && l.includes('(estimate)')) })
      .toEqual({ trades: [], by: 'D1-build', printed: true });
  });

  it('carries the Count note: every counted group gets PoB\'s count, so a Spirit warning may fire', () => {
    expect(build).toMatch(/\*\*The compile writes PoB's count on every counted group\*\* \(D-493\), not only the named source's .* so V1's Spirit warning may fire on a plan that passed before/);
  });

  it("picks the must-haves the rung's toughness needs (R-74)", () => {
    expect(build).toMatch(/\*\*Pick the must-haves the rung's toughness needs\*\* \(R-74\): a rare holding only its must-haves at their lowest rolls loses every other line/);
  });
});

// D1-tree's examples: its tree fragment, its search after gear moved, its trades.
const D1_TREE_RAW = rawStage('D1-tree');
const TREE_WRITES = between(D1_TREE_RAW, '## Writes', '## Returns');
const TREE_JSON = blocks(TREE_WRITES);
/** D1-tree's `"tree": {…}` example and its `"search": {…}` example, as JSON objects (their `…` placeholder dropped). */
const TREE_EXAMPLE = JSON.parse(`{${TREE_JSON[0].replace('  …,\n', '')}}`).tree as Json;
const SEARCH_EXAMPLE = JSON.parse(`{${TREE_JSON[1]}}`).search as Json;
const TREE_TRADES = JSON.parse(TREE_JSON[3]) as Json;

describe('AC-W110 (WU-142): D1-tree', () => {
  const tree = stage('D1-tree');

  it("writes a rare jewel's lines as must-haves at their best tier allowed", () => {
    expect(tree).toMatch(/`b`'s jewel carries the best 3 lines, `n`'s the best 4 \(2 prefixes and 2 suffixes at most\), each a must-have at its best tier allowed at the rung's item level \(82\), at that tier's lowest roll \(D-483/);
  });

  it("writes an unmodelled line for each piece pieces.md marks out unmeasured, the example's naming D1-build's, and the checker takes them", () => {
    expect(tree).toMatch(/\*\*A piece left out unmeasured\*\* \(D-489\) reaches the user the same way: for each `out` row of `pieces\.md` whose Why starts `unmeasured \(estimate: …\)` .* write one `unmodelled` trade on `n`/);
    const piece = UNMEASURED[0][1];
    const line = (TREE_TRADES.trades as Json[]).find((t) => t.kind === 'unmodelled' && String(t.what).startsWith(piece));
    const estimate = Number(/about \+(\d+)% EHP/.exec(UNMEASURED[0][5])?.[1]);
    const dir = copyFixture(RUN14);
    editJson(dir, TRADES14, (t) => {
      t.trades = TREE_TRADES.trades;
    });
    editJson(dir, GATE, (g) => {
      for (const r of g.design.rungs as Json[]) r.trades = (TREE_TRADES.trades as Json[]).filter((t) => t.stage === r.stage);
    });
    expect({ named: line !== undefined, ehp: line?.ehpChange, trades: ruleLines(dir, 'trades').filter((l) => /trades\.json's trades\[/.test(l)) }).toEqual({ named: true, ehp: estimate, trades: [] });
  });

  it('passes exclude, and its tree example with an exclude entry validates as schema 10', () => {
    expect(tree).toMatch(/- \*\*`exclude`\*\* \(D-490, schema 10\): every node of the rung's `tree\.exclude` entries .* no rebuild, swap, repair or `free` refill adds an excluded node or paths through one/);
    const plan = JSON.parse(read(path.join(FIXTURES, RUN14, PLAN14))) as Json;
    stageOf(plan, 'n').tree.exclude = TREE_EXAMPLE.exclude;
    const ok = validatePlan(plan, REF14);
    stageOf(plan, 'n').tree.exclude = [{ nodes: TREE_EXAMPLE.exclude[0].nodes }];
    const noReason = validatePlan(plan, REF14);
    expect({ ok: ok.ok, noReason: noReason.ok ? [] : noReason.errors.map((e) => e.path) }).toEqual({ ok: true, noReason: ['stages[2].tree.exclude[0].reason'] });
  });

  it('uses the targets after gear moved and writes tree.search.targets, a figure within 0.5 meeting its target', () => {
    expect(tree).toMatch(/\*\*Targets after gear moved\*\* \(D-490\): when the rung's gear changed after D1-tree last ran .* the targets are, per figure, the lower of `tree\.start` and the rung's current compile .* you record the targets you used in `tree\.search\.targets \{ehp, maxHit, why\}`/);
    expect(tree).toContain('A figure within 0.5 of its target meets it (D-490), so write `tree.start` unrounded.');
    expect(Object.keys(SEARCH_EXAMPLE.targets)).toEqual(['ehp', 'maxHit', 'why']);
  });

  it("counts the user's own moves in userMoves, and the search example validates as schema 10", () => {
    expect(tree).toMatch(/\*\*The user's own moves\*\* \(D-490\) count in the rung's `tree\.search\.userMoves` \(schema 10\), one per change a request made, never in `tree\.search\.swaps`/);
    const plan = JSON.parse(read(path.join(FIXTURES, RUN14, PLAN14))) as Json;
    stageOf(plan, 'n').tree.search = SEARCH_EXAMPLE;
    const r = validatePlan(plan, REF14);
    expect({ ok: r.ok, userMoves: SEARCH_EXAMPLE.userMoves }).toEqual({ ok: true, userMoves: 2 });
  });

  it("records an illegal rebuild as `none: <the tool's reason>`, the tool's own form, which the checker and the display take", () => {
    expect(tree).toMatch(/\*\*A rebuild the tool calls illegal\*\* \(D-490\) is recorded with the tool's own reason, `rebuild: "none: <the tool's reason>"`/);
    const reason = /^none: (.+)$/.exec(SEARCH_EXAMPLE.rebuild)![1];
    const form = new RegExp(`^${ILLEGAL_FORM.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace('<Attribute>', '(?:Strength|Dexterity|Intelligence)').replace(/<[xy]>/g, '\\d+')}$`);
    const dir = copyFixture(RUN14);
    editJson(dir, GATE, (g) => {
      (g.design.rungs as Json[]).find((r) => r.stage === 'n')!.rebuild = SEARCH_EXAMPLE.rebuild;
    });
    const detail = node(RUN_LOG, [dir, 'display', 'design', '--build', BUILD, '--detail']).stdout.split('\n');
    expect({ form: form.test(reason), shape: ruleLines(dir, 'design-field').filter((l) => /has rebuild/.test(l)), printed: detail.includes(`- Rebuild not taken on n: ${reason}.`) }).toEqual({ form: true, shape: [], printed: true });
  });

  it('hand-edits no rebuild or swap the tool calls illegal', () => {
    expect(tree).toContain("**No hand edits**: never change a rebuild or a swap the tool calls illegal to make it legal; record it as the tool said it (step 3.2).");
  });

  it('makes no trade call, and a non-zero count on its entry fails the checker', () => {
    expect(tree).toMatch(/- \*\*No trade call\*\* \(D-490\): you price nothing and call no tool that searches the trade site or prices an item .* `link_only` included/);
    const dir = copyFixture(RUN14);
    const at = (JSON.parse(read(path.join(dir, 'run-log.json'))) as Json).stages.findIndex((s: Json) => s.stage === 'D1-tree');
    editJson(dir, 'run-log.json', (log) => {
      log.stages[at].priceOutcomes = { ok: 0 };
    });
    const zero = ruleLines(dir, 'pricing').filter((l) => l.includes('D1-tree makes no trade call'));
    editJson(dir, 'run-log.json', (log) => {
      log.stages[at].priceOutcomes = { ok: 1 };
    });
    expect({ zero, one: ruleLines(dir, 'pricing').filter((l) => l.includes('D1-tree makes no trade call')).length }).toEqual({ zero: [], one: 1 });
  });
});

// D1-finish's examples: its trades and its swap record.
const D1_FINISH_RAW = rawStage('D1-finish');
const FINISH_TRADES = JSON.parse(blocks(between(D1_FINISH_RAW, '## Writes', '## Returns'))[0]) as Json;
const SWAP_EXAMPLE = JSON.parse(`{${blocks(between(D1_FINISH_RAW, '## The `swap` scope (D-481)', '## The `scaling` scope (D-486)'))[0]}}`).itemSwaps as Json[];

describe('AC-W110 (WU-142): D1-finish', () => {
  const finish = stage('D1-finish');

  it("accepts a ledger value × 100 as its percentage (:276–278)", () => {
    expect(finish).toContain("A `ledger:<id>` claim's numbers are the entry's value or its inputs, an input as written or × 100 as a percentage. **The value too** (D-494): the entry's value × 100 is its percentage, so a claim of 86% against an entry evaluating to 0.86 holds");
  });

  it('has the swap scope and its steps, its record validating and holding the checker', () => {
    const swap = folded(between(D1_FINISH_RAW, '## The `swap` scope (D-481)', '## The `scaling` scope (D-486)'));
    const steps = ['1. **Write the item as the user gave it**', '2. **Compile** the swapped rungs measure-only, and rewrite each one\'s `tree.end` from that compile with `endAfter: "swap"`', '3. **Re-measure your own trades** on the swapped rungs', "4. **Drop D1-tree's `boss` trades** on the swapped rungs", '5. **Re-check the claims** that cite the slot or a figure that moved, **re-price the slot**'];
    expect(steps.map((x) => swap.indexOf(x))).toEqual([...steps.map((x) => swap.indexOf(x))].sort((x, y) => x - y));
    expect({ missing: steps.filter((x) => !swap.includes(x)), record: swap.includes('**record the swap** in the plan\'s `itemSwaps[]` (schema 10): `{stages, slot, from, to, bossBefore: {<stage>: <n>}, bossAfter: {<stage>: <n>}, reason}`') }).toEqual({ missing: [], record: true });
    // The example validates, and the checker holds a logged swap to it.
    const dir = copyFixture(RUN14);
    const r = node(RUN_LOG, [dir, 'stage', '-'], JSON.stringify({ stage: 'D1-finish', concept: BUILD, attempt: 2, outcome: 'done', scope: 'swap' }));
    const unrecorded = ruleLines(dir, 'swap');
    editJson(dir, PLAN14, (p) => {
      p.itemSwaps = SWAP_EXAMPLE;
    });
    const valid = validatePlan(JSON.parse(read(path.join(dir, PLAN14))), REF14);
    expect({ code: r.code, unrecorded: unrecorded.length, recorded: ruleLines(dir, 'swap'), valid: valid.ok }).toEqual({ code: 0, unrecorded: 1, recorded: [], valid: true });
  });

  it(`has the scaling scope and its steps: at most ${SCALING_CAP} searches, the top ${FINDS_MEASURED} measured, only trades.json`, () => {
    const scaling = folded(between(D1_FINISH_RAW, '## The `scaling` scope (D-486)', '## The fix round and revisions'));
    expect(scaling).toMatch(new RegExp(`Re-price the finds over the budget in \`trades\\.json\` \\(kind \`scaling\`\\) by the depth rule .* \\*\\*at most ${SCALING_CAP} trade searches a build\\*\\*, and measure any of the top ${FINDS_MEASURED} \\(by gain\\) not yet measured.* \\*\\*Write only \`trades\\.json\`\\*\\*: each find's \`price\` and \`repriced: true\``));
  });

  it("runs the loop on D1-tree's rare jewels, lowering or dropping a line, never adding one", () => {
    expect(finish).toMatch(/- \*\*D1-tree's rare jewels: the loop\*\* \(D-483\)\. .* then run the loop's steps 5 to 10 on it.* you may lower that jewel's tiers or drop a line as the loop says, never add one/);
  });

  it('never edits an item to a listing', () => {
    expect({ prices: finish.includes('**never edit an item for its price, and never rewrite an item to a listing**: a listing\'s lines never enter the plan'), brief: finish.includes('**Never rewrite an item to match a listing** (D-483), whatever a brief says') }).toEqual({ prices: true, brief: true });
  });

  it('measures on temporary stages and restores the plan', () => {
    expect({ finds: /\*\*Measure the finds\*\*, at most 5 a build, the largest gains first .* each on a temporary stage that copies the rung with the dear item in the slot.* the plan is restored after/.test(finish), scaling: /\*\*Restore the plan byte for byte\*\*: Read its text before your first temporary stage and Write that text back when you're done/.test(finish), swap: /3\. \*\*Re-measure your own trades\*\* on the swapped rungs, each on its temporary stage as step 5 does, the plan restored after/.test(finish) })
      .toEqual({ finds: true, scaling: true, swap: true });
  });

  it("writes its own loops' scaling finds, by D1-finish, replacing only its own", () => {
    expect(finish).toMatch(/- \*\*Finds over the budget\*\* \(D-486, D-483\): your own loops' dearer specs .* are `scaling` finds, `\{stage, kind: "scaling", slot, from, to, price, damage, ehp, measured, repriced, by: "D1-finish"\}`/);
    expect((FINISH_TRADES.trades as Json[]).filter((t) => t.kind === 'scaling').map((t) => t.by)).toEqual(['D1-finish']);
  });

  it(`writes the boss fall after gear moved, more than ${BOSS_FALL_PERCENT}% under tree.end's`, () => {
    expect(finish).toMatch(new RegExp(`\\*\\*a boss fall after gear moved\\*\\* \\(D-490\\): when gear changed after D1-tree .* more than ${BOSS_FALL_PERCENT}% under \`tree\\.end\`'s, the same claim \`boss-fall-<rung>\` .* names the item that moved it`));
  });

  it("prices b's and n's rare boots with their movement speed as a must-have of the spec, required only before revision 14", () => {
    expect(finish).toContain("and `b`'s and `n`'s rare boots name theirs in `required` (35%, D1-build wrote it) in a build before revision 14. In a revision-14 run it is a must-have of the boots' spec (35%, D1-build's), held at the tier and never lowered or dropped (D-483), so your depth check carries it among `mods`.");
  });

  it("writes the trades' price, from and to, its example the checker's 14 fields at revision 14", () => {
    expect(finish).toMatch(/- \*\*Revision 14's fields\*\* \(D-486\): every entry also carries `price \{amount, currency, count, date\} \| null`, `from` and `to`/);
    const dir = copyFixture(RUN14);
    editJson(dir, TRADES14, (t) => {
      t.trades = FINISH_TRADES.trades;
    });
    editJson(dir, GATE, (g) => {
      for (const r of g.design.rungs as Json[]) r.trades = (FINISH_TRADES.trades as Json[]).filter((t) => t.stage === r.stage);
    });
    const plain = (FINISH_TRADES.trades as Json[]).filter((t) => t.kind !== 'scaling');
    expect({ fields: plain.every((t) => ['price', 'from', 'to'].every((k) => k in t) && Object.keys(t).length === 14), trades: ruleLines(dir, 'trades').filter((l) => /trades\.json's trades\[/.test(l)) }).toEqual({ fields: true, trades: [] });
  });
});

// D1-gate's verdict example.
const GATE_EXAMPLE = JSON.parse(blockAfter(rawStage('D1-gate'), '## Writes')) as Json;

describe('AC-W110 (WU-142): D1-gate', () => {
  const gate = stage('D1-gate');

  it(`writes summary (gear per rung of b and n) within ${CAP_HOW}, ${CAP_GEAR} and ${CAP_CATCH} characters, and the checker and the display take its example`, () => {
    expect(gate).toMatch(new RegExp(`\\*\\*\`summary\`\\*\\* \\(D-478\\), once for the build, after the rungs: \`summary \\{how, gear: \\[\\{stage, slot, text\\}\\], catch\\}\`.* - \`how\`, at most ${CAP_HOW} characters: .* - \`gear\`, one entry per filled gear slot of \`b\` and \`n\`, the flasks aside .* each \`text\` at most ${CAP_GEAR} characters: .* - \`catch\`, at most ${CAP_CATCH} characters`));
    const sm = GATE_EXAMPLE.design.summary as Json;
    // One entry per filled gear slot of b and n, the flasks aside: the example's gear names each slot once a rung.
    expect(gate).toContain('- `gear`, one entry per filled gear slot of `b` and `n`, the flasks aside');
    for (const st of ['b', 'n']) {
      const slots = (sm.gear as Json[]).filter((x) => x.stage === st).map((x) => x.slot);
      expect({ st, once: new Set(slots).size === slots.length, flasks: slots.filter((x: string) => /^Flask/.test(x)), enough: slots.length >= 8 }).toEqual({ st, once: true, flasks: [], enough: true });
    }
    const dir = copyFixture(RUN14);
    editJson(dir, GATE, (g) => {
      g.design.summary = sm;
    });
    const shown = node(RUN_LOG, [dir, 'display', 'design', '--build', BUILD]).stdout.split('\n');
    expect({
      caps: sm.how.length <= CAP_HOW && sm.catch.length <= CAP_CATCH && (sm.gear as Json[]).every((x) => x.text.length <= CAP_GEAR),
      stages: [...new Set((sm.gear as Json[]).map((x) => x.stage))].sort(),
      checker: ruleLines(dir, 'design-field').filter((l) => /summary/.test(l)),
      how: shown.includes(`**How it works.** ${sm.how}`),
      gear: (sm.gear as Json[]).filter((x) => ['b', 'n'].includes(x.stage)).every((x) => shown.includes(`- ${x.slot}: ${x.text}`)),
    }).toEqual({ caps: true, stages: ['b', 'n'], checker: [], how: true, gear: true });
  });

  it('has the under wording (:241–243): under when the plain EHP is under its band, conditioned only within or over it', () => {
    expect(gate).toMatch(/\*\*In a build held to amendment 14\*\* \(D-494\), between the two: \*\*`under`\*\* when the plain EHP is under its band, so under it in every condition, .* `conditioned` then fires only when the plain EHP is within or over its band and the conditioned EHP under it/);
  });

  it("keeps the draft in its verdict, which the checker takes and the display prints first", () => {
    expect(gate).toMatch(/In a revision-14 run, then write its path into the verdict file as `draft: <relpath>` \(`null` when the write was refused, D-479\)/);
    const dir = copyFixture(RUN14);
    editJson(dir, GATE, (g) => {
      g.draft = GATE_EXAMPLE.draft;
    });
    editJson(dir, 'run-log.json', (log) => {
      Object.assign(log.builds[0], { draftFile: null, pobFile: null });
    });
    const first = node(RUN_LOG, [dir, 'display', 'design', '--build', BUILD]).stdout.split('\n').find((l) => l.startsWith('PoB file:'));
    expect({ draft: typeof GATE_EXAMPLE.draft, checker: ruleLines(dir, 'gate-report').filter((l) => /draft is/.test(l)), first }).toEqual({ draft: 'string', checker: [], first: `PoB file: ${GATE_EXAMPLE.draft} in your Builds folder` });
  });

  it('passes the judge exclude and the targets after gear moved', () => {
    expect(gate).toMatch(/in a revision-14 build \(D-490\) \*\*`exclude`\*\*, every node of the rung's `tree\.exclude` entries, and, when gear moved after D1-tree .* \*\*the targets after gear moved\*\*: per figure the lower of `tree\.start` and this compile's figure for the rung .* a figure within 0\.5 of its target meeting it/);
  });
});

describe('AC-W110 (WU-142): D2', () => {
  it("has the campaign note, in the user's words: two or three affixes on a campaign rare late in a league", () => {
    const d2 = stage('D2');
    expect({ quote: d2.includes(`"${CAMPAIGN_QUOTE[1]}"`), affixes: d2.includes(`**a campaign rare carries two or three affixes**`), solution: d2.includes(`("${CAMPAIGN_QUOTE[2]}")`) }).toEqual({ quote: true, affixes: true, solution: true });
  });
});

// pricing.md's example price entry: the spec loop's record.
const PRICING_RAW = rawRef('pricing.md');
const PRICE_EXAMPLE = JSON.parse(blockAfter(PRICING_RAW, '## Recording a price')) as Json;
/** The compiled rare the example prices: its title its key affixes, its must-haves at their tiers' lowest rolls, a rune in its socket. */
const PRICED_RARE = ['Rarity: Rare', PRICE_EXAMPLE.item.split(': ')[1], PRICE_EXAMPLE.spec.base, 'Sockets: S', 'Rune: Greater Desert Rune', 'Implicits: 1', '{rune}+18% to Fire Resistance', '35% increased Movement Speed', '+100 to maximum Life', '+31% to Fire Resistance'].join('\n');

describe('AC-W111 (WU-142): pricing.md', () => {
  const pricing = ref('pricing.md');
  const loop = folded(between(PRICING_RAW, '## A rare of `b` or `n`: the spec loop (D-483)', '## Recording a price'));

  it(`prices a rare at the ${DEPTH_POSITION}th-cheapest of at least ${DEPTH_MIN} listings, the example's listing so`, () => {
    expect(loop).toContain(`Its price is the **depth price**: the ${DEPTH_POSITION}th-cheapest of at least ${DEPTH_MIN} listings of a search for its must-haves, sorted by price. No slot is priced from fewer than ${DEPTH_MIN} listings.`);
    expect({ position: PRICE_EXAMPLE.listing.position, enough: PRICE_EXAMPLE.listing.count >= DEPTH_MIN }).toEqual({ position: DEPTH_POSITION, enough: true });
  });

  it('starts n at T1, its first search a depth check', () => {
    expect(loop).toMatch(/5\. \*\*`n` first, at T1\.\*\* `n`'s must-haves start at their best tier allowed, and its first search is a \*\*depth check\*\* there/);
  });

  it("runs the budget search with tiers: the floor tiers required, each listing's tiers in find_upgrades' own form", () => {
    expect(loop).toMatch(/6\. \*\*The budget search\*\* .* `mcp__pob2__find_upgrades \{slot, required_mods: <the 3 most important must-haves at their floor tiers' lowest rolls, a zero-scored one always among them>, .* Each listing names its required affixes' tiers, `tiers: <affix> T<n>, …` .* Set each must-have to the best tier at which at least 5 of the listings under the budget meet all of them together/);
    const schema = (getTradeToolSchemas() as Json[]).find((t) => t.name === 'find_upgrades')!.inputSchema.properties as Json;
    expect(schema.required_mods.description).toContain("'tiers: <affix> T<n>, …'");
  });

  it('passes rune_behaviour: "remove" on every find_upgrades pricing call', () => {
    expect(loop).toContain('**`rune_behaviour: "remove"`** on every pricing call of `mcp__pob2__find_upgrades`');
  });

  it('records listing, and its example entry validates, matches its compiled copy and holds the spec rules', () => {
    expect(pricing).toMatch(/\*\*`listing`\*\* \(D-484, schema 10; outside `buildSha1`, like `note`\): `\{corrupted, sockets, count, position\}`.* \*\*The priced copy matches the compiled copy\*\*/);
    const dir = copyFixture(RUN14);
    editJson(dir, PLAN14, (p) => {
      stageOf(p, 'b').items.slots.find((x: Json) => x.slot === PRICE_EXAMPLE.query.slot).text = PRICED_RARE;
      p.prices = (p.prices as Json[]).map((x) => (x.id === PRICE_EXAMPLE.id ? PRICE_EXAMPLE : x));
    });
    // run-a14 is an offline run: online, the plan and every price carry the example's league (D-233).
    const online = JSON.parse(read(path.join(dir, PLAN14))) as Json;
    online.league = PRICE_EXAMPLE.league;
    for (const x of online.prices as Json[]) x.league = PRICE_EXAMPLE.league;
    const valid = validatePlan(online, REF14);
    const rules = ['listing', 'spec', 'rare-title', 'budget'].flatMap((rule) => ruleLines(dir, rule));
    // The same entry priced from a corrupted listing with no socket fails the match.
    editJson(dir, PLAN14, (p) => {
      p.prices.find((x: Json) => x.id === PRICE_EXAMPLE.id).listing = { ...PRICE_EXAMPLE.listing, corrupted: true, sockets: 0 };
    });
    expect({ valid: valid.ok, rules, mismatch: ruleLines(dir, 'listing').length }).toEqual({ valid: true, rules: [], mismatch: 2 });
  });

  it('prices a unique whose corruption or sockets matter by search_trade_items, with item_name, corrupted and min_rune_sockets', () => {
    expect(pricing).toMatch(/- \*\*A unique by name, unless its corruption or sockets matter\*\* \(D-484\): `mcp__pob2__get_item_price` can't filter or show either, so a unique .* goes to `mcp__pob2__search_trade_items` with `item_name`, `corrupted` \(as the plan's copy\) and `min_rune_sockets`/);
    const schema = (getTradeToolSchemas() as Json[]).find((t) => t.name === 'search_trade_items')!.inputSchema.properties as Json;
    expect(['item_name', 'corrupted', 'min_rune_sockets', 'limit'].filter((k) => !(k in schema))).toEqual([]);
  });

  it("states the corrupted-unique rule in the user's words: cheap, the extra socket, implicits out", () => {
    expect({
      cheap: /This is the cheap unique's rule: one under 1 divine uncorrupted may carry a corruption outcome, an implicit or an extra socket/.test(pricing),
      socket: pricing.includes(`- **A unique that isn't cheap, bought corrupted with an extra socket** (D-484, the user's ruling of 2026-11-02: "${CORRUPTION_QUOTE}")`),
      implicits: pricing.includes('Its corruption implicits never enter `m`, `b` or `n`'),
    }).toEqual({ cheap: true, socket: true, implicits: true });
  });

  // The --no-ninja rule outlives D-372 (AC-W63 pinned its older form): no rate, no budget search, depth checks alone.
  it('says what the loop does offline, during a pricing stop, without a session cookie and with --no-ninja', () => {
    expect({
      noNinja: loop.includes("**`--no-ninja`**: no rate turns a target into a `max_price`, so no budget search: one depth check a spec, at its floor tiers on `b` and its best tiers allowed on `n`, recorded as seen, and the totals are `unverified` (D-333)."),
      offline: /\*\*offline\*\*, or without the trade tools: no ranking \(`ranking: null`, `searches: 0`\); .* the rares compile at their floor tiers' lowest rolls/.test(loop),
      stop: /\*\*a pricing stop open\*\* .* `link_only` sends no request, so the ranking stays allowed; no search runs; the rares compile at the tiers the loop reached, else their floors/.test(loop),
      session: /\*\*no session cookie\*\* .* the loop runs as depth checks alone, which search anonymously, from the best tier allowed down one step at a time, within the cap/.test(loop),
    }).toEqual({ noNinja: true, offline: true, stop: true, session: true });
  });

  it("reads the fallback's three causes, each the server's own prefix", () => {
    const outcomes = folded(between(PRICING_RAW, '## Classifying outcomes (D-218)', '## Pace'));
    const replies = (['no_session', 'session_rejected', 'too_complex'] as const).map((cause) => renderFallback({ cause, reason: 'x', hint: 'h', link: 'https://example.invalid/', notes: [] }));
    expect({
      named: [CAUSE_A, CAUSE_B, CAUSE_C].every((c) => outcomes.includes(`\`${c} \``)),
      server: replies.map((r) => r.split(' ')[0]),
      session: outcomes.includes('Read the first two as a session problem for this step'),
      complex: outcomes.includes('Read `too_complex` as a cue to drop the least important must-have'),
      own: outcomes.includes('**An item is `unavailable` only after its own failed call**'),
    }).toEqual({ named: true, server: [CAUSE_A, CAUSE_B, CAUSE_C], session: true, complex: true, own: true });
  });

  it(`counts trade searches in its notice: about ${VOLUME_LOW} to ${VOLUME_HIGH} a build`, () => {
    expect(pricing).toMatch(new RegExp(`\\*\\*It counts trade searches, not calls\\*\\* \\(D-483\\): .* usually makes 3 a \`b\` rare .* and 1 an \`n\` rare, at most ${SEARCH_CAP} a slot, about ${VOLUME_LOW} to ${VOLUME_HIGH} a build \\(${MINUTES_LOW} to ${MINUTES_HIGH} minutes at the 45 s pace\\)`));
  });

  it('prices an edited item on its four heaviest lines', () => {
    expect(loop).toContain("its price is the depth price of a search for its lines at their values (the four heaviest by the slot's weights when it has more)");
  });

  it('re-prices a spec as compiled, by one depth check, never re-running the loop', () => {
    expect({ loop: loop.includes('**Re-pricing a spec**: D1-finish\'s re-price and the D1 gate\'s final re-price pass price a spec as compiled, by one depth check at its must-haves\' tiers (its `query`\'s call); the loop never runs again.'), pass: /\*\*A spec is re-priced as compiled\*\* \(D-483\)/.test(pricing) }).toEqual({ loop: true, pass: true });
  });

  it("has the campaign note in the user's words", () => {
    expect({ quote: loop.includes(`"${CAMPAIGN_QUOTE[1]}"`), affixes: loop.includes('so campaign rares use two or three affixes') }).toEqual({ quote: true, affixes: true });
  });

  it('has no "first listing", and no -fallback but for a build before revision 14', () => {
    const sentences = pricing.split(/(?<=\.)\s+/).filter((x) => x.includes('-fallback'));
    expect({ first: /first listing/i.test(pricing), fallback: sentences.filter((x) => !/before revision 14|writes no `<id>-fallback`|^`<id>-fallback` with fewer/.test(x)) }).toEqual({ first: false, fallback: [] });
  });

  it(`thins a slot past the cap to unavailable with its count, shown at the gate (R-75), and the notice's volume (R-76)`, () => {
    expect({ thin: loop.includes("with none, the slot's entry is `unavailable`, `note` `thin: <count>`, and the gate shows it"), volume: loop.includes(`about ${VOLUME_LOW} to ${VOLUME_HIGH} a build, ${MINUTES_LOW} to ${MINUTES_HIGH} minutes at the 45 s pace (D-461). The pricing notice counts them before the step starts`) }).toEqual({ thin: true, volume: true });
  });
});

describe("AC-W111 (WU-142): gates.md and lookups.md", () => {
  const gates = ref('gates.md');
  const lookups = ref('lookups.md');

  it("gates.md's budget part: the depth price, listing and spec, no -fallback, thin unavailable", () => {
    expect(gates).toMatch(/- \*\*In a build held to amendment 14\*\* \(D-483, D-484\): a rare's price is its spec's \*\*depth price\*\*, the 5th-cheapest of at least 10 listings .* \*\*No `<id>-fallback` entry\*\*: the dearer spec is a find over the budget .* `thin: <count>`/);
  });

  it("gates.md's tree part: exclude and the targets after gear moved", () => {
    expect(gates).toMatch(/\*\*In a build held to amendment 14\*\* \(D-490\) the judge also passes `exclude`, the rung's `tree\.exclude` nodes, .* its `targets` are \*\*the targets after gear moved\*\*: per figure the lower of `tree\.start` and the gate's compile of the rung/);
  });

  it("gates.md's swap fall rule: on a rung whose tree.end reads endAfter: \"swap\", the swap's reason stands in for the boss trade, as the checker holds", () => {
    expect(gates).toMatch(/\*\*On a rung whose `tree\.end` reads `endAfter: "swap"`, the swap's `reason` stands in\*\* for the `boss` trade a boss fall on the tree needs .* and for the `damage` or `boss` trade an `n` under the floor at the gate needs/);
    // run-a14's n fell on its tree: with no boss trade it fails, and a swap's reason on a rung that ends after it stands in.
    const dir = copyFixture(RUN14);
    editJson(dir, TRADES14, (t) => {
      t.trades = (t.trades as Json[]).filter((x) => x.kind !== 'boss');
    });
    editJson(dir, GATE, (g) => {
      for (const r of g.design.rungs as Json[]) r.trades = (r.trades as Json[]).filter((x) => x.kind !== 'boss');
    });
    const fall = () => ruleLines(dir, 'trades').filter((l) => /the boss figure fell .* no boss trade is shown/.test(l));
    const without = fall().length;
    editJson(dir, PLAN14, (p) => {
      stageOf(p, 'n').tree.end.endAfter = 'swap';
      p.itemSwaps = [{ ...SWAP_EXAMPLE[0], stages: ['n'], bossBefore: { n: 220000 }, bossAfter: { n: 210000 } }];
    });
    expect({ without, with: fall() }).toEqual({ without: 1, with: [] });
  });

  it("lookups.md's socket counts: the socket table's, in the base mode's own line", () => {
    const count = (key: string) => {
      const r = REF14.resolveFact('items/sockets.json', `sockets.${key}`);
      return r.ok ? r.fact.value : null;
    };
    expect([count('body-armour'), count('two-hand-weapon'), count('helmet'), count('shield'), count('focus'), count('one-hand-weapon'), count('amulet'), count('ring'), count('belt'), count('quiver'), count('corona-amulet')]).toEqual([2, 2, 1, 1, 1, 1, 0, 0, 0, 0, 1]);
    expect({
      table: lookups.includes('body armours and two-handers 2; other armour, shields, foci and one-handers 1; amulets, rings, belts and quivers 0; Corona Amulet, Grasping Ring and Stalking Belt 1'),
      form: lookups.includes(`\`${SOCKET_FORM}\``),
      server: socketLine(2, 4),
      none: lookups.includes(`\`${socketLine(1, undefined)}\``),
    }).toEqual({ table: true, form: true, server: "Sockets: 2 (PoB's ceiling 4 counts Exceptional and corruption)", none: true });
  });

  it("lookups.md's tier levels: the lookup's own lines, and its example the game data's", () => {
    // The server's renderer writes the form the doc shows.
    const lines = renderTiers([{ on: [{ name: 'Boots', itemType: true, count: 1, total: 1 }], tiers: [{ tier: 1, level: 60, line: '+(120-149) to maximum Life' }], tier: 1 }], new Set());
    expect({ head: lines[0], tier: lines[1], doc: lookups.includes('`  Tiers on <bases> (this mod: T<n>):`, then one line a tier, `    T<n> (item level <l>): <range>`') }).toEqual({ head: '  Tiers on Boots (all) (this mod: T1):', tier: '    T1 (item level 60): 120–149', doc: true });
    // PoB's maximum Life tiers on boots (Data/ModItem.lua), the best first: T1 and T3, as the example names them.
    const mods = read(path.join(REPO, 'vendor', 'PathOfBuilding-PoE2', 'src', 'Data', 'ModItem.lua'));
    const boots = [...mods.matchAll(/\["IncreasedLife\d+"\] = \{ type = "Prefix", affix = "[^"]+", "\+\((\d+)-(\d+)\) to maximum Life", statOrder = \{ \d+ \}, level = (\d+), group = "IncreasedLife", weightKey = \{ ([^}]*) \}, weightVal = \{ ([^}]*) \}/g)]
      .filter((m) => {
        const keys = m[4].split(',').map((x) => x.trim().replace(/"/g, '')).filter(Boolean);
        const vals = m[5].split(',').map((x) => Number(x.trim())).filter((x) => !Number.isNaN(x));
        return vals[keys.indexOf('boots')] > 0;
      })
      .map((m) => ({ low: Number(m[1]), high: Number(m[2]), level: Number(m[3]) }))
      .sort((x, y) => y.level - x.level);
    const allowed = boots.filter((t) => t.level <= LEVEL_BN);
    expect(lookups).toContain(`maximum Life lists \`    T1 (item level ${allowed[0].level}): ${allowed[0].low}–${allowed[0].high}\` and \`    T3 (item level ${allowed[2].level}): ${allowed[2].low}–${allowed[2].high}\`, so at item level ${LEVEL_BN} its best tier allowed is T1 and its floor T3, lowest roll ${allowed[2].low}`);
  });
});
