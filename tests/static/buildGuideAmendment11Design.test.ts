/**
 * Amendment 11 (M-24), WU-115: the design side of D-437…D-448 in the skill text, AC-W91 one assertion each, and the
 * rest of the unit's sections (§5 to §9b, §10's pieces line, §11's and §12's SKILL.md rows, §14, §19, Appendix A).
 *
 * - `references/stages/D1-build.md`: schema 7's five fields (`tree.scales` and the respec rungs, `skills.cull`,
 *   `skills.engagement` with its default rule, `skills.boss` with `turns`, `items.bootsException`), the boots tier per
 *   rung, the damage figure in place of the headline DPS, its gear searches' price outcomes.
 * - `references/stages/D1-tree.md`: respec rungs keep only serving prior nodes, grow links only, the rebuild pass, the
 *   unmodelled needs' `free` measure and trades, `trades.json`, the `respec:` return, node power on `MainDamage`.
 * - `references/stages/D1-finish.md`: the two reference files, the boss estimate (`boss_<stage>`, its nine corrections,
 *   sustained, when required), the trades (boots, defence, damage, the three EHP allowances, `bossAfter`).
 * - `references/stages/D1-gate.md`, `references/gates.md`, `references/checkpoints.md`: the design field's additions
 *   and the design gate's lines, put through `run-log.mjs display design`; the codes; the routes.
 * - `references/stages/D2.md`, `references/stages/W1.md`, the guide and audit templates, `SKILL.md`, `patterns.md`.
 *
 * Amendment 12 (WU-125) supersedes D-438's respec rungs (D-452), the trades' `bossAfter` rule (D-456), the verdict
 * line's figures and label (D-454, D-459) and the design field's shape (D-449): the assertions on those read the
 * current text, and `buildGuideAmendment12Design.test.ts` holds AC-W97 and AC-W98.
 *
 * Numbers and names are read from the amendment (`docs/build-guide/spec/amendment-11-live-test-fixes.md`), the two
 * reference files, the run scripts and the tool's own schema, so the text is held to the spec and to the code that
 * reads it; the examples are put through the real run checker and display.
 */
import { describe, it, expect, afterAll } from '@jest/globals';
import { spawnSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import * as toolSchemas from '../../src/server/toolSchemas';

type Json = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

const REPO = path.resolve(__dirname, '..', '..');
const SKILL_DIR = path.join(REPO, '.claude', 'skills', 'build-guide');
const STAGES_DIR = path.join(SKILL_DIR, 'references', 'stages');
const SCRIPTS = path.join(SKILL_DIR, 'scripts');
const CHECKER = path.join(SCRIPTS, 'check-run.mjs');
const RUN_LOG = path.join(SCRIPTS, 'run-log.mjs');
const RENDER = path.join(SCRIPTS, 'render-audit.mjs');
const FIXTURES = path.join(REPO, 'tests', 'fixtures', 'pipeline');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'a11-design-'));
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
const SPEC_RAW = read(path.join(REPO, 'docs', 'build-guide', 'spec', 'amendment-11-live-test-fixes.md'));
const SPEC = folded(SPEC_RAW);
const CHECKER_TEXT = read(CHECKER);
const RUN_LOG_TEXT = read(RUN_LOG);
const TARGETS = JSON.parse(rawRef('toughness-targets.json')) as { targets: { close: number; distance: number }; under: number; over: number };
const FLOOR = (JSON.parse(rawRef('boss-floor.json')) as { floor: number }).floor;
/** A number as the docs write it: 20,000. */
const whole = (n: number) => Math.round(n).toLocaleString('en-US');
const words = (text: string) => text.split(/\s+/).filter(Boolean).length;

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

/** §9b's corrections, by name, as the amendment lists them under the hand estimate. */
const CORRECTIONS = [...between(SPEC_RAW, '- **The hand estimate.**', '- **The boss figure**').matchAll(/^ {2}- \*\*([a-z ]+):\*\*/gm)].map((m) => m[1]);
/** §8's boots tiers, `<n>% (<item level>)`, as the amendment lists them. */
const TIERS = [...between(SPEC, '- **The tiers**', 'Entering maps needs').matchAll(/(\d+)% \((?:item level )?(\d+)\)/g)].map((m) => ({ speed: Number(m[1]), itemLevel: Number(m[2]) }));
/** Appendix A's trade fields, from its `trades.json` form. */
const TRADE_FIELDS = [...between(SPEC_RAW, '### `<buildFolder>/trades.json`', '### The record (additions)').matchAll(/"([a-zA-Z]+)":/g)].map((m) => m[1]).filter((k, i, all) => k !== 'trades' && all.indexOf(k) === i);
/** The get_node_power schema the server registers (its new inputs, §7, Appendix A). */
const NODE_POWER = Object.values(toolSchemas)
  .filter((f): f is () => Json[] => typeof f === 'function' && /^get\w*ToolSchemas$/.test(f.name))
  .flatMap((f) => f())
  .find((t) => t.name === 'get_node_power') as Json;

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
const A11_BUILD = 'r1-a-2';
const A11_GATE = `reports/gates/D1-gate-${A11_BUILD}-a1.json`;

/** Appendix A's design gate lines (the display's forms, `run-log.mjs`), each a pattern a printed line must match. */
const DESIGN_LINES: Record<string, RegExp> = {
  damage: /^- Damage: [\d,]+ per second against map monsters\.$/,
  boss: /^- Boss damage: (about [\d,]+ per second against a Pinnacle boss \(PoB alone: [\d,]+( at .+'s hand-cast [\d.]+ a second)?; estimated: .+\)|[\d,]+ per second against a Pinnacle boss( \(PoB alone at .+\))?)\.$/,
  floor: /^- Boss floor: (about )?[\d,]+(, under the [\d,]+ floor| against the [\d,]+ floor)\.$/,
  cull: /^- Culls normal monsters at [\d.]+%, bosses at [\d.]+%\.$/,
  trigger: /^- .+ is triggered by .+: PoB rates it at its hand-cast speed \([\d.]+ a second\) and doesn't model Energy\.$/,
  toughness: /^- Toughness: [\d,]+ against the [\d,]+ target for a (close|distance) build( \(.+\))?, (under its band \([\d,]+\)|over its band \([\d,]+\)|within its band \([\d,]+–[\d,]+\))\.$/,
  unmodelled: /^- Kept for .+, which PoB can't measure: .+ would (add|cost) [\d.]+% damage\.$/,
  // Amendment 12 (D-450, run-log.mjs's tradeLines): a defence trade on a one-shot rung reads `Defence (one-shot)`, with
  // the deciding row's max hit and hits survived before its EHP, and a boss cut over 2% last.
  defence: /^- Defence( \(one-shot\))?: .+: (.+; )?[+−][\d.]+% EHP(, [+−][\d.]+% damage)?(; cuts .+ against a boss by [\d.]+%)?\.$/,
  damageTrade: /^- Damage: .+: [+−][\d.]+% damage( \(boss about [\d,]+\))?(, [+−][\d.]+% EHP)?(; .+)?\.$/,
  swap: /^- Passive tree: \d+ of \d+ points on travel; best swap left( \(weapon set [12]\))?: (none|\+[\d.]+% damage by moving \d+ points from .+ to .+)$/,
};

// ---------------------------------------------------------------------------------------------------
// AC-W91, one assertion each
// ---------------------------------------------------------------------------------------------------

describe('AC-W91 (WU-115): the design docs carry amendment 11', () => {
  const build = stage('D1-build');
  const tree = stage('D1-tree');
  const finish = stage('D1-finish');
  const gateRaw = rawStage('D1-gate');
  const gate = folded(gateRaw);

  it('D1-build writes tree.scales (and, under amendment 12, no respec), skills.cull, skills.engagement (its reason and the default rule), skills.boss and items.bootsException, and names the boots tier per rung', () => {
    expect(build).toMatch(/Write each rung's `tree\.scales`, one short line naming the stats that scale it/);
    // Amendment 12 (WU-125, D-452) retires D-438's respec rungs: a schema-8 plan has no respec.
    expect(build).toMatch(/\*\*Mark no respec:\*\* a schema-8 plan has no `respec`/);
    expect(build).not.toMatch(/respec rung\*\*: write its `respec/);
    expect(build).toMatch(/\*\*`skills\.cull`\*\*, on a rung whose rotation culls: the user \(2026-10-25\), "Map damage with cull if and only if the build explicitly utilizes culling in its skill rotation\. Otherwise, map damage, no cull\."/);
    // §9's default rule, as the amendment words it, in D1-build with its kinds as code.
    const rule = /\(proceed-on, §20\): (a minion, totem, trap or mine type, or a projectile skill that travels, is distance; a strike, slam or area around the character is close)\./.exec(SPEC)![1];
    expect(build.replace(/`/g, '')).toContain(rule);
    expect(build).toMatch(/\*\*The engagement\*\* \(D-441\), on `n`: `skills\.engagement \{kind, reason\}`, .* with the reason from how the build plays/);
    expect(build).toMatch(/\*\*The boss rotation\*\* \(D-447\), on each rung: `skills\.boss \{entries, note\}`/);
    expect(build).toMatch(/`items\.bootsException \{kind, reason\}` \(schema 7\), and only then: `kind: "travel"` .* `kind: "unique"`/);
    // §8's tiers: entering maps needs 30%, budget and non-budget 35%.
    expect(SPEC).toContain('Entering maps needs 30%, budget and non-budget 35%');
    expect(build).toContain('The tier per rung: **30% on `m`, 35% on `b` and `n`**');
  });

  it('D1-tree runs the rebuild pass, measures unmodelled needs with free, and writes trades.json; amendment 12 retires its respec rungs, grow links and respec: return', () => {
    // Amendment 12 (WU-125, D-452): one tree per loadout, so no serving test, no grow links and no `respec:` return.
    expect(tree).not.toMatch(/A respec rung: keep only|along grow links|`respec: <stage> needs one/);
    expect(tree).toMatch(/Then \*\*the rebuild pass\*\*, once: the same call with `rebuild: true`, .* When its `Rebuild:` line is legal and gains Main damage, it beats the loop's tree: make it a change/);
    expect(tree).toMatch(/Measure its cost on each rung that holds it with `free: \[<the need's nodes>\]` \(`free` overrides `keep`\)/);
    expect(tree).toMatch(/`<buildFolder>\/trades\.json` \(D-439, outside `buildSha1`\), the trades the design gate shows: write it whole/);
  });

  it('D1-finish reads references/toughness-targets.json and references/boss-floor.json, and states their values', () => {
    expect(finish).toContain('`.claude/skills/build-guide/references/toughness-targets.json`');
    expect(finish).toContain('`.claude/skills/build-guide/references/boss-floor.json`');
    expect(finish).toContain(`${whole(TARGETS.targets.close)} close and ${whole(TARGETS.targets.distance)} distance, \`under\` ${TARGETS.under} and \`over\` ${TARGETS.over} of the target`);
    expect(finish).toContain(`(${whole(TARGETS.under * TARGETS.targets.close)} close, ${whole(TARGETS.under * TARGETS.targets.distance)} distance)`);
    expect(finish).toContain(`(${whole(TARGETS.over * TARGETS.targets.close)} close, ${whole(TARGETS.over * TARGETS.targets.distance)} distance)`);
    expect(finish).toContain(`figure floor, ${whole(FLOOR)})`);
  });

  it('D1-finish measures a damage trade when the non-budget boss figure is under the floor, and states its three EHP allowances', () => {
    expect(finish).toMatch(/\*\*A damage trade\*\*, when the rung is over its band or under the floor: node power's best swap ranked by `MainDamage`/);
    expect(finish).toMatch(/\*\*the three allowances\*\*: over its band, no lower than the target; within it, no lower than the band's bottom \(90% of the target\); already under it, by at most 15%/);
    expect(SPEC).toMatch(/no lower than the toughness target when the rung is over its band, else no lower than the band's bottom \(90% of the target\), or by at most 15% when the rung is already under the band/);
  });

  it("D1-finish names §9b's nine corrections by their names", () => {
    expect(CORRECTIONS).toEqual(['trigger rate', 'procs', 'landing', 'hits per use', 'buff', 'rotation share', 'burst over its cycle', 'uptime', 'one ailment']);
    for (const name of CORRECTIONS) expect({ name, named: finish.includes(`- **${name}:**`) }).toEqual({ name, named: true });
  });

  it('D1-finish says the estimate is "sustained" over the rotation\'s cycle, and required with a triggered entry or an entry with turns', () => {
    expect(finish).toMatch(/The figure is \*\*sustained\*\* damage per second over one cycle of the rotation, not a burst/);
    expect(finish).toMatch(/\*\*always when the rotation has a `triggered` entry or an entry with `turns`\*\*/);
  });

  it('D1-build writes turns: true on an entry that takes turns, and states the rule for a skill\'s two stat sets', () => {
    expect(build).toContain('**Write `turns: true` on an entry that takes turns with another.**');
    expect(build).toMatch(/\*\*A skill's two stat sets\*\* are two entries when both happen in one use \(a hit and its explosion\); alternatives \(a plain or an infused cast\) are entries only when the rotation uses both, and then they take turns/);
  });

  it("D1-gate's design field holds damage, boss (its estimate from boss_<stage>; at non-budget its floor and under), cull, trigger, toughness and trades from trades.json", () => {
    expect(gate).toMatch(/`boss \{measured, estimate, corrections\}`: `measured` the record's `measures\.damage\.boss`, `estimate` the ledger's `boss_<stage>` value/);
    expect(gate).toMatch(/`trades\[\]` \(D-439\), the rung's entries of `<buildFolder>\/trades\.json`, copied as the file holds them/);
    // Its example: each rung's additions, and on n the toughness by the targets file and the floor by the floor file.
    const example = JSON.parse(blockAfter(gateRaw, '## Writes')) as Json;
    const n = example.design.rungs.find((r: Json) => r.stage === 'n');
    for (const r of example.design.rungs) for (const k of ['damage', 'cull', 'trigger', 'boss', 'trades']) expect({ stage: r.stage, k, has: k in r }).toEqual({ stage: r.stage, k, has: true });
    expect(n.toughness.target).toBe(TARGETS.targets[n.toughness.engagement as 'close' | 'distance']);
    const band = n.ehp < TARGETS.under * n.toughness.target ? 'under' : n.ehp > TARGETS.over * n.toughness.target ? 'over' : 'within';
    expect(n.toughness.band).toBe(band);
    expect(n.boss.floor).toBe(FLOOR);
    expect(n.boss.under).toBe((n.boss.estimate ?? n.boss.measured) < FLOOR);
  });

  it("checkpoints.md's design gate shows them, and (amendment 12) a respec request is a tree request", () => {
    const design = between(rawRef('checkpoints.md'), '## The design gate: judge the endgame build', "## The final gate: the build's guide");
    const lines = blockAfter(design, '- **Show**').split('\n').map((l) => l.trim());
    for (const [kind, form] of Object.entries(DESIGN_LINES).filter(([k]) => k !== 'damageTrade')) {
      expect({ kind, shown: lines.some((l) => form.test(l)) }).toEqual({ kind, shown: true });
    }
    // Amendment 12 (WU-125, D-452, AC-W98): a respec the user asks for is a tree request, D1-tree then D1-finish.
    expect(folded(design)).toMatch(/\*\*a respec the user asks for is a tree request\*\* \(D-452: each loadout's tree is its own\), D1-tree then D1-finish/);
  });

  it('D2.md names campaign scaling and writes campaign respecs, and its boots follow the tiers', () => {
    const d2 = stage('D2');
    expect(d2).toMatch(/name each campaign stage's scaling in `tree\.scales`/);
    expect(d2).toMatch(/is a \*\*respec stage\*\*: its tree drops the previous stage's nodes that no longer serve the new scaling, and you write its `respec`/);
    expect(d2).toMatch(/\*\*Boots follow the tiers\*\* \(D-440\)\. The user \(2026-10-25\): "Campaign boots should use the highest tier for that level\."/);
    // §8's six tiers, in D2's words: `10% from item level 1, 15% from 16, …`.
    expect(TIERS).toHaveLength(6);
    expect(d2).toContain(TIERS.map((t, i) => `${t.speed}% from ${i === 0 ? 'item level ' : ''}${t.itemLevel}`).join(', '));
  });

  it("the guide templates' verdict lines carry three figures and amendment 12's label forms, in the run checker's form", () => {
    // Amendment 12 (WU-125, D-454, D-459): the resisting figure between the two, and the label's three forms.
    const form = /const VERDICT_FORM_A12 = '([^']*)';/.exec(CHECKER_TEXT)![1];
    const label = /const ARBITER_LABEL_A12 = "([^"]*)";/.exec(CHECKER_TEXT)![1];
    const want = (name: string) => [
      form.replace('<Entering maps|Budget|Non-budget>', 'Entering maps'),
      form.replace('<Entering maps|Budget|Non-budget>', 'Budget').replace('<solid|watch|risky>', label),
      form.replace('<Entering maps|Budget|Non-budget>', 'Non-budget').replace('<solid|watch|risky>', label),
    ].map((l) => ({ name, l }));
    for (const name of ['guide-template.md', 'guide-endgame-template.md']) {
      const got = template(name).split('\n').filter((l) => /^- \*\*(Entering maps|Budget|Non-budget) \(L<level>\)/.test(l)).map((l) => ({ name, l }));
      expect(got).toEqual(want(name));
    }
    expect(form).toContain('<Skill> about <map> DPS against map monsters, about <resisting> against resisting rares, about <boss> against a Pinnacle boss.');
  });

  it("SKILL.md routes D1-finish's build (amendment 12: D1-tree's respec only in an older run), has no rival row, and stays within 325 lines; patterns.md stays within its word cap (provisional 16,000)", () => {
    expect(SKILL).toMatch(/\*\*D1-finish's `build: <ids>` sends an attempt back to D1-build\*\*, in the same attempt \(D-446\), logged `build`/);
    expect(SKILL).toMatch(/D1-tree never returns `respec:` \(D-452\)/);
    // The run checker's order table keeps an older run's routes (amendment 12 §7, "Routes").
    expect(CHECKER_TEXT).toContain("'D1-tree': p?.outcome === 'respec' ? ['D1-build'] : ['D1-finish'],");
    expect(CHECKER_TEXT).toMatch(/'D1-finish': .*p\?\.outcome === 'build' \? \['D1-build'\]/);
    const rows = SKILL_RAW.split('\n').filter((l) => /^\| \d+[a-c]? \|/.test(l));
    expect(rows.some((l) => /\bRV\b|\brival/.test(l))).toBe(false);
    expect(SKILL_RAW.split('\n').length - 1).toBeLessThanOrEqual(325);
    // 16,000 is provisional since 2026-10-26: the user set the caps aside while the defence entries landed, to review the new size.
    expect(words(rawRef('patterns.md'))).toBeLessThanOrEqual(16_000);
  });
});

// ---------------------------------------------------------------------------------------------------
// §5 to §9b, §10, §11, §12, §14, §19 and Appendix A in the unit's files
// ---------------------------------------------------------------------------------------------------

describe('D-437 (§5): one damage figure, against map monsters and a boss, ranked by MainDamage', () => {
  it('the design steps and the gate rank by MainDamage with cull on a culling rung; a need asks its stat then MainDamage; the 3% loop and the 5% line are on it', () => {
    const description = (NODE_POWER.inputSchema.properties.stats as Json).description as string;
    expect(description).toMatch(/Also MainDamage \("Main damage"\)/);
    expect(stage('D1-tree')).toMatch(/- `stats: \["MainDamage", "TotalEHP"\]` \(D-437\): `MainDamage` ranks, .* and `cull: true` when the rung has `skills\.cull`\. A need's own stat \(step 3\) asks `\["<the need's stat>", "MainDamage"\]`/);
    expect(stage('D1-gate')).toMatch(/`stats: \["MainDamage", "TotalEHP"\]`, with `cull: true` on a rung with `skills\.cull` \(D-437\)/);
    expect(stage('D1-tree')).toContain('While its best swap gains at least **3%** Main damage');
    expect(stage('D1-gate')).toContain('A rung whose best swap gains **5%** damage (`Main damage`) or more fails the part');
    // The display's swap label (run-log.mjs) is "damage" under amendment 11, as checkpoints.md's example prints it.
    expect(RUN_LOG_TEXT).toContain("if (ws !== 1 && ws !== 2) return 'damage';");
  });

  it('D1-build reads the key-figure line as plan-reference.md documents it, and says headline DPS nowhere', () => {
    // Amendment 12 (D-454): the key-figure line gives the resisting figure between the two.
    expect(folded(read(path.join(REPO, 'docs', 'build-guide', 'plan-reference.md')))).toContain('`damage <map> against map monsters, <resisting> against resisting rares, <boss> against a Pinnacle boss` (`measures.damage`)');
    expect(stage('D1-build')).toContain('`damage <map> against map monsters, <resisting> against resisting rares, <boss> against a Pinnacle boss`');
    for (const name of ['D1-build', 'D1-tree', 'D1-finish', 'D1-gate', 'W1']) expect({ name, headline: /headline DPS/.test(stage(name)) }).toEqual({ name, headline: false });
  });

  it('the guide, W1 and the audit template show the map figure and the boss figure, the estimate when the plan has one', () => {
    expect(stage('W1')).toMatch(/the rung's boss figure, the `boss_<stage>` ledger value when the plan has that entry \(audit\.md's Estimates row\), else `measures\.damage\.boss`/);
    // The audit's head is the render's (render-audit.mjs).
    expect(read(RENDER)).toContain("twoFigures ? 'Damage, map / boss' : 'Named source DPS'");
    expect(template('audit-template.md')).toContain('| Loadout | Level | Life | Damage, map / boss |');
    for (const name of ['guide-template.md', 'guide-endgame-template.md']) {
      expect({ name, trigger: template(name).includes("[only when the record's measures.trigger is set (D-437)] PoB rates <Skill> at its hand-cast speed and doesn't model <the meta gem>'s Energy") }).toEqual({ name, trigger: true });
    }
  });
});

describe('D-438 (§6): respec when the scaling changes, otherwise grow', () => {
  it('gold is a note (amendment 12: on every rung); a schema-7 plan\'s campaign weighs it, and the D2 gate checks each schema-7 respec', () => {
    expect(stage('D1-build')).toMatch(/Gold is a note, never a reason to keep a node\./);
    expect(stage('D2')).toMatch(/On a campaign stage the gold cost is weighed, as D-282 weighs it/);
    expect(ref('gates.md')).toMatch(/each respec, a stage whose scaling changes from the one before it, D-438, checked with its gold cost, D-282, on a plan at schema 7 or earlier/);
  });

  it("D1-tree writes no respec.dropped: amendment 12 retires the respec rungs (D-452)", () => {
    const tree = stage('D1-tree');
    expect(tree).not.toMatch(/respec\.dropped|respec\.note/);
    expect(tree).toMatch(/no respec \(a schema-8 plan has none\)/);
  });

  it('D2 makes m a respec rung when its scaling differs from the last campaign stage\'s', () => {
    expect(stage('D2')).toMatch(/\*\*`m` under a new campaign:\*\* `m` is a respec rung when its scaling \(its `tree\.scales`\) differs from the last campaign stage's/);
  });
});

describe('D-439 (§7): the tree search frees several branches, rebuilds, and shows what it can\'t measure', () => {
  it("D1-tree uses each new node-power input as the tool's schema defines it", () => {
    const props = NODE_POWER.inputSchema.properties as Json;
    for (const input of ['rebuild', 'free', 'cull']) expect({ input, inSchema: input in props, inDoc: stage('D1-tree').includes(`\`${input}`) }).toEqual({ input, inSchema: true, inDoc: true });
    expect(props.max_loss.description).toMatch(/maxHit, the lowest of PoB's five per-type maximum hits taken \(default 2\)/);
    expect(stage('D1-tree')).toMatch(/`maxHit`, the lowest of PoB's five per-type maximum hits taken, its default 2% \(D-439\)/);
    expect(stage('D1-tree')).toMatch(/node power frees its 5 weakest branches alone and in pairs and triples, so a path longer than any one branch fits, D-439/);
  });

  it("an unmodelled need's trade reads as §7 words it", () => {
    const sentence = /Each such need becomes a trade \(§7's file below\): "(Kept for <mechanic>, which PoB can't measure: the same <n> points elsewhere would add <x>% damage\.)"/.exec(SPEC)![1];
    expect(stage('D1-tree')).toContain(`"${sentence.replace('<mechanic>', '<the mechanic>')}"`);
    expect(stage('D1-tree')).toMatch(/Run `mcp__pob2__check_model_coverage \{nodes: \[<the need's nodes>\]\}` on each need of the rung/);
  });

  it("D1-tree's and D1-finish's trades.json examples are Appendix A's shape at revision 12, and the run checker accepts them", () => {
    const fromTree = JSON.parse(blockAfter(rawStage('D1-tree'), '`<buildFolder>/trades.json` (D-439')) as Json;
    const fromFinish = JSON.parse(blockAfter(rawStage('D1-finish'), '## Writes')) as Json;
    const trades = [...fromTree.trades, ...fromFinish.trades];
    expect(TRADE_FIELDS).toEqual(['stage', 'kind', 'what', 'ehpChange', 'damageChange', 'bossAfter', 'reason']);
    // Amendment 12 (D-450, §22, Appendix A): a build held to revision 12 carries maxHit and hitsSurvived on every
    // entry, so the examples go through a revision-12 fixture (the 9 fields fail at revision 11).
    const a12 = folded(read(path.join(REPO, 'docs', 'build-guide', 'spec', 'amendment-12-defence-and-design.md')));
    expect(a12).toMatch(/In a build held to revision 12 every entry carries `maxHit` and `hitsSurvived`, `null` where they don't apply/);
    for (const t of trades) expect(Object.keys(t)).toEqual([...TRADE_FIELDS, 'maxHit', 'hitsSurvived']);
    const dir = copyFixture('run-a12');
    fs.writeFileSync(path.join(dir, 'builds', A11_BUILD, 'trades.json'), `${JSON.stringify({ trades }, null, 2)}\n`);
    const r = node(CHECKER, [dir]);
    // The checker names the build's folder before the file: `check-run: [trades] builds/<id>: trades.json's …`.
    const tradeLines = r.stderr.split('\n').filter((l) => /\[trades\] [^:]+: trades\.json/.test(l));
    expect(r.code).not.toBeNull();
    expect(tradeLines).toEqual([]);
  });
});

describe('D-440 (§8): boots carry the best movement speed for the level', () => {
  it("b's and n's rare boots name the tier in required, m's in mods; V1's codes and the D1 gate's reading of the note", () => {
    expect(stage('D1-build')).toMatch(/`b`'s and `n`'s rare boots name the tier's movement speed in `query\.required` .*, and D1-finish prices `m`'s boots with it among `mods`/);
    expect(stage('D1-finish')).toMatch(/`m`'s boots search carries its tier's movement speed among `mods` \(30%\), and `b`'s and `n`'s rare boots name theirs in `required` \(35%/);
    for (const code of ['movement-tier', 'boots-exception']) expect({ code, row: rawRef('gates.md').includes(`| v1 | \`${code}\` |`) }).toEqual({ code, row: true });
    expect(stage('D1-gate')).toMatch(/read `stages\.<id>\.v1\.notes` for `boots-exception` .* report it as a `boots-exception` finding, part `v1`, .* which is information and fails nothing/);
    expect(CHECKER_TEXT).toContain("const INFO_CODES = ['chaos-exception', 'over-target', 'boots-exception'];");
  });

  it('the gate shows an exception as a trade; unique boots get that trade only, and a defence trade\'s rare boots carry the tier', () => {
    expect(stage('D1-finish')).toMatch(/Unique boots get this trade only, never the defence trade below; a defence trade's rare boots carry the tier's speed/);
  });
});

describe('D-441 (§9): toughness targets, with trades below and above', () => {
  it('the band is under 90% and over 150% of the target, as the targets file holds it; neither is a gate failure', () => {
    expect([TARGETS.under, TARGETS.over]).toEqual([0.9, 1.5]);
    const cp = folded(between(rawRef('checkpoints.md'), '## The design gate: judge the endgame build', "## The final gate: the build's guide"));
    expect(cp).toMatch(/and its band: under it \(below 90%\), within it, or over it \(above 150%\)/);
    expect(cp).toMatch(/No trade is a gate failure/);
  });

  it('the defence trade lets damage fall at most 15%; the damage trade over the band keeps EHP at the target; none found says so', () => {
    const finish = stage('D1-finish');
    expect(finish).toMatch(/node power's best swap ranked by `TotalEHP`, with \*\*`MainDamage` allowed to fall at most 15%\*\*/);
    expect(finish).toMatch(/When none is found, the trade says so: `what: "none found: <why>"`, its changes, `bossAfter`, `maxHit` and `hitsSurvived` null/);
    expect(CHECKER_TEXT).toContain('const NONE_FOUND = /^none found: \\S/;');
  });
});

describe('D-447, D-448 (§9b): the boss estimate and the boss floor', () => {
  it("D1-finish's estimate starts from C-33's boss references and carries its corrections in its claim", () => {
    const finish = stage('D1-finish');
    expect(finish).toMatch(/`<stage>\.boss\.g<group>s<skill>p<statSet>` \(an entry's figure; `\.ignite`, `\.bleed`, `\.poison` or `\.usesPerSecond` after it for that field\) and `<stage>\.boss\.measured` \(PoB alone\): at least one `boss\.g` reference, and none outside the stage's rotation/);
    expect(finish).toMatch(/Its `claim` says what each correction corrects, a few words each, joined by `; `/);
    // The D1 gate splits the claim into the design field's corrections, which the display joins again.
    expect(stage('D1-gate')).toMatch(/`corrections` its claim's phrases, split at `; `/);
    expect(RUN_LOG_TEXT).toContain(".map((c) => c.trim()).join('; ')");
  });

  it("the floor is the floor file's, the damage trade under it carries bossAfter, and gates.md states the checker's rules", () => {
    // Amendment 12 (D-456): D1-finish measures bossAfter on the trade's temporary stage, no longer boss × (1 + change).
    expect(stage('D1-finish')).toMatch(/`bossAfter` comes from that measure: the temporary stage's boss figure .*, never the boss figure × \(1 \+ `damageChange` \/ 100\)/);
    expect(ref('gates.md')).toMatch(/\*\*The boss floor\*\* from `references\/boss-floor\.json` \(`floor` 250,000\)/);
    expect(ref('gates.md')).toMatch(/a `boss_<stage>` formula with no `<stage>\.boss\.g<group>s<skill>p<statSet>` reference, or one outside the stage's rotation \(`skills\.boss`\), fails/);
    expect(whole(FLOOR)).toBe('250,000');
  });

  it("the D1 gate example's design field prints, through run-log.mjs, the design gate's lines in Appendix A's forms", () => {
    const example = JSON.parse(blockAfter(rawStage('D1-gate'), '## Writes')) as Json;
    // Amendment 12 (WU-125): the example is a revision-12 design field, displayed against the revision-12 fixture.
    const dir = copyFixture('run-a12');
    const file = path.join(dir, A11_GATE);
    const g = JSON.parse(fs.readFileSync(file, 'utf8')) as Json;
    g.design = { ...example.design, rungs: example.design.rungs };
    fs.writeFileSync(file, `${JSON.stringify(g, null, 2)}\n`);
    const r = node(RUN_LOG, [dir, 'display', 'design', '--build', A11_BUILD]);
    expect({ code: r.code, stderr: r.stderr }).toEqual({ code: 0, stderr: '' });
    const out = r.stdout.split('\n');
    const nAt = out.findIndex((l) => l.startsWith('Non-budget endgame'));
    const n = out.slice(nAt, out.indexOf('', nAt));
    for (const kind of ['damage', 'boss', 'floor', 'toughness', 'defence', 'damageTrade']) {
      expect({ kind, printed: n.filter((l) => DESIGN_LINES[kind].test(l)).length > 0 }).toEqual({ kind, printed: true });
    }
    expect(n).toContain(`- Boss floor: ${whole(180000)}, under the ${whole(FLOOR)} floor.`);
    expect(out.filter((l) => l.startsWith('- Pieces:'))).toEqual([`- Pieces: 5 in, 0 scheduled (none), 1 out`]);
  });
});

describe('D-442 (§10): the design gate\'s pieces line counts the out pieces', () => {
  it('checkpoints.md and D1-gate.md give the pieces line without the out names, as the display prints it', () => {
    const form = /`- Pieces: <n> in, <n> scheduled \(<names>\), <n> out`/;
    expect(SPEC).toMatch(form);
    expect(ref('checkpoints.md')).toMatch(form);
    expect(stage('D1-gate')).toMatch(form);
    expect(RUN_LOG_TEXT).toContain('if (a11) return `- Pieces: ${count(p.in)} in, ${count(p.scheduled)} scheduled (${named(p.scheduledNames)}), ${count(p.out)} out`;');
  });
});

describe("D-443 (§11) and D-444 (§12): SKILL.md's rows and its pricing stop", () => {
  it('SKILL.md has no rival step, card or rule, and patterns.md names no rival', () => {
    expect(SKILL_RAW).not.toMatch(/\bRV\b|\brival|r<k>-x-<n>|not-dealt/);
    expect(rawRef('patterns.md')).not.toMatch(/\brival/);
  });

  it("SKILL.md's stop lasts until a gate's retry-pricing, the gate asks first, and every exchange item keeps its price", () => {
    expect(SKILL).toMatch(/stops trade-site pricing until a gate's `retry-pricing` or a resume: the next gate asks first, after its display, and you log the answer with `run-log\.mjs <runFolder> pricing` \(`references\/run-log\.md`, "Pricing stops"\)/);
    expect(SKILL).toMatch(/`mcp__pob2__get_item_price` for an item the currency exchange sells reads poe\.ninja's exchange \(not with `--no-ninja`\), so both stay allowed/);
    // run-log.md gives the command SKILL.md names.
    expect(read(path.join(SKILL_DIR, 'references', 'run-log.md'))).toContain('node .claude/skills/build-guide/scripts/run-log.mjs <runFolder> pricing - <<\'JSON\'');
  });

  it("after retry-pricing at the design gate, the D1 gate's re-price pass runs before F1, re-pricing the stopped entries", () => {
    expect(SKILL).toMatch(/After `retry-pricing` here, an accept runs the D1 gate's re-price pass, then F1 \(D-444\)/);
    expect(stage('D1-gate')).toMatch(/or of a stop the user's `retry-pricing` has since lifted \(note `pricing stopped`, D-444\)/);
    expect(ref('gates.md')).toMatch(/\| the same, on the re-price pass \(after the design gate's `accept` or `accept:file` with a `retry-pricing` answer at that visit, D-444\) \| any \| F1, with no second design gate/);
    expect(CHECKER_TEXT).toContain("reprice ? ['D1-gate', 'F1'] : ['F1']");
  });

  it('D1-build logs its gear searches as price outcomes', () => {
    expect(SKILL).toMatch(/within its 8 lines\. Log its `priceOutcomes` \(D-444\)/);
    expect(stage('D1-build')).toMatch(/your price calls counted by outcome when you made any \(`prices: ok 2`, D-444\)/);
  });
});

describe('D-446 (§14): the order rule and the pool move\'s weapon set', () => {
  it("D1-finish's build: is logged build, and D1-build follows it in the same attempt; a pool move's weaponSet is 1 or 2", () => {
    expect(stage('D1-finish')).toMatch(/the gates, in the same attempt, your outcome logged `build` \(D-446\)/);
    expect(CHECKER_TEXT).toContain("'D1-finish': ['done', CLAIMS_EDITED, 'build']");
    expect(stage('D1-gate')).toMatch(/for a pool move `weaponSet`, its pool's set \(`1` or `2`\)/);
    expect(ref('gates.md')).toMatch(/and `weaponSet` 1 or 2 on a pool move/);
  });
});

describe('§19: an older record, plan or design keeps its own form', () => {
  it('W1, the templates, the audit template, D2 and the D1 gate keep the old forms for an older record or plan', () => {
    expect(stage('W1')).toMatch(/one with no `measures\.damage` \(compiled before amendment 11\) the one-figure form, "<Skill> about <n> DPS\.", its `measures\.dps`/);
    // Amendment 12 (§22): a record with no resisting figure keeps two.
    expect(stage('W1')).toMatch(/A record with no `damage\.resisting` \(compiled before amendment 12\) keeps the two figures/);
    // Amendment 12 (§22): a record from before it keeps the two-figure column, one from before amendment 11 the older one.
    expect(template('audit-template.md')).toContain('[A record from before amendment 12, with no measures.damage.resisting, keeps two figures: `| Loadout | Level | Life | Damage, map / boss | …`. A record from before amendment 11, with no measures.damage, keeps the older column: `| Loadout | Level | Life | Named source DPS | …`');
    expect(stage('D2')).toMatch(/a plan at an earlier version \(a build designed before amendment 11\) keeps its version and takes no schema-7 field/);
    expect(stage('D1-gate')).toMatch(/\(`dps` stays for old readers: the display shows `damage`\)/);
  });
});

describe('Appendix A: the formats in the design docs', () => {
  it("D1-build names schema 7's five fields, as Appendix A lists them", () => {
    const fields = [...between(SPEC_RAW, '### The plan (schema 7)', '### `get_node_power` (additions)').matchAll(/^- `stages\[\]\.([a-zA-Z.]+)`/gm)].map((m) => m[1]);
    expect(fields).toEqual(['skills.cull', 'tree.scales', 'items.bootsException', 'skills.engagement', 'skills.boss']);
    for (const f of fields) expect({ f, named: stage('D1-build').includes(f) }).toEqual({ f, named: true });
  });

  it("the D1 gate's design field additions are Appendix A's keys", () => {
    const example = JSON.parse(blockAfter(rawStage('D1-gate'), '## Writes')) as Json;
    const n = example.design.rungs.find((r: Json) => r.stage === 'n');
    // Amendment 12 (D-454, D-449): damage gains `resisting`, toughness its four additions.
    expect(Object.keys(n.damage)).toEqual(['map', 'resisting', 'boss']);
    expect(Object.keys(n.boss)).toEqual(['measured', 'estimate', 'corrections', 'floor', 'under']);
    expect(Object.keys(n.toughness)).toEqual(['engagement', 'reason', 'target', 'band', 'chanceShare', 'conditioned', 'ailmentCut', 'warning']);
    expect(Object.keys(example.design.pieces)).toEqual(['in', 'scheduled', 'out', 'scheduledNames']);
    expect(SPEC).toMatch(/`toughness \{engagement: "close" \| "distance", reason, target, band: "under" \| "within" \| "over"\}`, `boss \{measured, estimate \| null, corrections: \[<short phrase>\]\}` \(on the non-budget rung also `floor` and `under`/);
  });

  it("the run log's routes and outcomes are Appendix A's, in SKILL.md and gates.md", () => {
    expect(SPEC).toContain('Routes: D1-tree(`respec`) → D1-build; D1-finish(`build`) → D1-build, both in the same attempt.');
    // Amendment 12 (D-452): D1-tree has no respec outcome in a new run; an older run's log keeps its route.
    expect(ref('gates.md')).toMatch(/Inside an attempt, D1-finish's `build: <ids>` \(logged `build`\) sends D1 back to D1-build in the same attempt \(D-446\)/);
    expect(ref('gates.md')).toMatch(/An older run's log keeps its routes: there D1-tree's `respec: <stage> needs one: <why>` \(logged `respec`\) sent D1 back to D1-build too \(D-438\)/);
    expect(SKILL_RAW).toContain('| 6b | D1-tree, the travel | `build-guide-coordinator`, fresh | `plan.json` (the rungs\' trees, needs, tree jewels and their prices), `trades.json`, `pieces.md`\'s jewel lines | `done`, each rung\'s travel; `unspent:` and `jewel:` lines |');
  });
});
