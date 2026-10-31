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
