/**
 * Amendment 9 (M-21), WU-96's bullets of AC-W77: the design steps' skill text for endgame builds first and trees
 * that minimize travel.
 *
 * - `references/stages/D1-build.md`: plan schema 6; `tree.needs` written without `claim`, every producer of the
 *   stage's earned config state and a node the user asked for among them (D-418); the campaign reward picks on all
 *   three rungs when there is no campaign stage (D-413); `m`'s `ascendancyNodes` in the order to take them; no
 *   pathing to targets beyond the skeleton's (D1-tree's job); its return's line for D1-tree; no trade call once
 *   pricing has stopped (D-422).
 * - `references/stages/D1-tree.md` (new): the ladder order; every call with the rung's loadout, `keep`,
 *   `clear_group`, `protect_for` and `max_loss`; every rung a swap touches compiled together; a swap applied up
 *   the ladder; undone when a floor fails or V1 gains a finding; the undone swap written as a floor need; spare
 *   points; the 3% stop and 8 swaps per rung; the floor first; counts only in its return; no respec.
 * - `references/stages/F1.md` (new): the sha1 check against the passing D1 gate, `accepted`, `buildName`, its
 *   verdict file in the D2 gate's shape, its routes and its four escalation options (D-413).
 * - `references/stages/D1-finish.md`: the needs' `reason` claims, and the ascendancy order's claim (D-413).
 * - `references/stages/D1-gate.md` and `references/gates.md`: the `tree` part with `tree-swap` and `tool-error`,
 *   their routes; the design field's per-rung `tree` and the hit its Effective HP was measured against (D-419,
 *   D-423); D1 as three steps; F1's routes; the refused route (`tool-refused`, D-421); no trade call after a stop.
 * - `references/stages/R1b.md`'s league rule (D-422); `R1b-assemble.md` and `templates/dossier-template.md`, the
 *   dossier's EHP naming its hit (D-423).
 * - `references/patterns.md`: "minimize travel distance", cited to the user (2026-10-19).
 *
 * The thresholds and counts are read from the amendment where it states them, and the codes and the tree's shape
 * from the run checker (`check-run.mjs`, WU-94) and its schema-4 fixture, so the text is held to the spec and to the
 * contract the checker enforces, not to itself.
 */
import { describe, it, expect } from '@jest/globals';
import fs from 'fs';
import path from 'path';

const REPO = path.resolve(__dirname, '..', '..');
const SKILL_DIR = path.join(REPO, '.claude', 'skills', 'build-guide');
const STAGES_DIR = path.join(SKILL_DIR, 'references', 'stages');
const SPEC = path.join(REPO, 'docs', 'build-guide', 'spec', 'amendment-9-endgame-first.md');
const CHECKER = path.join(SKILL_DIR, 'scripts', 'check-run.mjs');
const FIXTURE_GATES = path.join(REPO, 'tests', 'fixtures', 'pipeline', 'run-builds', 'reports', 'gates');

const read = (file: string) => (fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '');
/** One paragraph or list item per entry, with its line breaks folded, so a rule split over lines reads whole. */
const folded = (text: string) => text.replace(/\s*\n\s*/g, ' ');
const readStage = (stage: string) => read(path.join(STAGES_DIR, `${stage}.md`));
const ref = (name: string) => read(path.join(SKILL_DIR, 'references', name));
const spec = folded(read(SPEC));
const checker = read(CHECKER);

/** The first fenced `json` block of a text, parsed. */
function firstJson(text: string): Record<string, any> { // eslint-disable-line @typescript-eslint/no-explicit-any
  const m = /```json\n([\s\S]*?)\n```/.exec(text);
  if (!m) throw new Error('no json block');
  return JSON.parse(m[1]) as Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
}
/** A number the amendment states with a regex around it (one capture group), as a number. */
function specNumber(re: RegExp): number {
  const m = re.exec(spec);
  if (!m) throw new Error(`the amendment doesn't state ${re}`);
  return Number(m[1]);
}
/** A constant of the run checker: `const NAME = <value>;`, its source text. */
function checkerConst(name: string): string {
  const m = new RegExp(`^const ${name} = (.+);$`, 'm').exec(checker);
  if (!m) throw new Error(`check-run.mjs has no const ${name}`);
  return m[1];
}

/** §12: the loop's stop and its cap, and §13: the gate's line. */
const LOOP_STOP = specNumber(/Repeat on a rung while its best swap gains at least \*\*(\d+)%\*\*/);
const LOOP_CAP = specNumber(/at most (\d+) swaps per rung/);
const GATE_LINE = specNumber(/fails a rung whose best swap gains at least \*\*(\d+)%\*\* Full DPS/);
/** §15 D-422: the tools that send a trade request. */
const TRADE_TOOLS = ['get_leagues', 'get_item_price', 'search_trade_items', 'search_stats', 'find_upgrades'];

describe('the amendment and the checker agree on the numbers the skill text uses', () => {
  it('the loop stops under 3%, at most 8 swaps per rung, and the gate fails at 5%, the checker\'s TREE_FAIL_PERCENT', () => {
    expect([LOOP_STOP, LOOP_CAP, GATE_LINE]).toEqual([3, 8, 5]);
    expect(Number(checkerConst('TREE_FAIL_PERCENT'))).toBe(GATE_LINE);
    expect(checkerConst('TREE_CODES')).toBe("{ fail: ['tree-swap'], unverified: ['tool-error', 'tool-refused'] }");
    expect(checkerConst('LEDGER_REFUSED')).toBe("'ledger-refused'");
    for (const tool of TRADE_TOOLS) expect({ tool, inSpec: spec.includes(`\`${tool}\``) }).toEqual({ tool, inSpec: true });
  });
});

describe('D1-build (AC-W77): the needs, the reward picks without D2, the ascendancy order', () => {
  const build = folded(readStage('D1-build'));

  it('writes plan schema 6, in the build\'s folder', () => {
    expect(build).toContain('at `schemaVersion: 6`');
    expect(build).not.toContain('`schemaVersion: 5`');
    expect(build).toContain('`writes: ["<buildFolder>/plan.json"]`');
    expect(build).toMatch(/`<plan>` is `<runFolderRel>\/<buildFolder>\/plan\.json` \(`<runFolderRel>\/plan\.json` when `buildFolder` is `\.`\)/);
  });

  it('writes tree.needs without claim, with every producer of the earned config state and a node the user asked for (D-418)', () => {
    expect(build).toMatch(/`tree\.needs\[\] \{nodes, stat\?\}`, written \*\*without `claim`\*\* \(D1-finish writes the `reason` claim and sets it\)/);
    expect(build).toMatch(/\*\*every producer of the stage's earned config state\*\* that is a passive node \(`config\.earned\[\]\.producer`, step 7\), which V2 checks is present/);
    expect(build).toMatch(/a node the user asked for, in a `revise:` or a gate's `changes`/);
    // §12's list, item by item.
    for (const need of [
      'mana or life sustain',
      'an attribute a gem or item of the stage requires',
      'area or movement for clear',
      'penetration and exposure count for nothing on a clear config with no enemy resistances',
      'a defence the floor needs',
      'a node the card\'s engine names',
    ]) {
      expect({ need, listed: build.includes(need) }).toEqual({ need, listed: true });
    }
    expect(build).toMatch(/`nodes` are nodes of that stage's `tree\.nodes` \(a schema error otherwise\)/);
  });

  it('makes the campaign reward picks on all three rungs when there is no campaign stage (D-413)', () => {
    expect(build).toMatch(/\*\*The reward picks without D2\*\* \(D-413\): a plan with no campaign stage \(an endgame-only build\) gets its picks from you\. For \*\*every\*\* reward choice the campaign offers, each quest with a `q\.<key>\.options` fact in `data\/campaign\/progress\.json`/);
    expect(build).toMatch(/list it on \*\*all three rungs\*\*, the same pick on each/);
    expect(build).toMatch(/"source": \{"file": "campaign\/progress\.json", "key": "q\.<key>\.options\[<i>\]"\}/);
    expect(build).toMatch(/D2 keeps your picks when the campaign is added later/);
  });

  it("lists m's ascendancyNodes in the order to take them, b and n keeping it (D-413)", () => {
    expect(build).toMatch(/\*\*The ascendancy order\*\* \(D-413\): list `m`'s `tree\.ascendancyNodes` in the order to take them/);
    expect(build).toMatch(/`b` and `n` keep that order for the nodes they share/);
  });

  it("no longer tunes the tree by pathing to targets beyond the skeleton's: that is D1-tree's (D-418)", () => {
    expect(build).toMatch(/Start from the skeleton's tree, a sketch of the card's targets \(D-418\): keep its targets with their paths, and path to what the needs below require; never path to a further target for damage or clear\. That tuning is D1-tree's/);
    expect(build).toMatch(/D1-tree \(`D1-tree\.md`\), a fresh step, then spends the trees' spare points and shortens their travel/);
  });

  it('returns what D1-tree needs: each rung\'s floor and its needs', () => {
    const text = readStage('D1-build');
    const returns = text.slice(text.indexOf('## Returns'), text.indexOf('## Fault directives'));
    expect(folded(returns)).toMatch(/one line `for D1-tree:` with each rung's floor/);
    expect(returns).toContain('for D1-tree: floor holds on m, b, n; needs m 3, b 2, n 1');
    expect(folded(readStage('D1-tree'))).toMatch(/\*\*Prompt:\*\* D1-build's `for D1-tree:` line/);
  });

  it('calls no trade tool, get_leagues included, once pricing has stopped in the session (D-415, D-422)', () => {
    expect(build).toMatch(/\*\*once pricing has stopped\*\* \(Read, above\), no trade call at all, `mcp__pob2__get_leagues` included/);
    expect(build).toMatch(/A `stages\[\]` entry after the last resume \(from index `resumes\[<last>\]\.lengths\.stages`/);
  });
});

describe('D1-tree (AC-W77): the swap loop, its own fresh step (D-418)', () => {
  const raw = readStage('D1-tree');
  const tree = folded(raw);

  it('is a coordinator stage reference in the others\' form: header, writes, returns at most 8 lines, no fault directive', () => {
    expect(raw.split('\n')[0]).toBe('# D1-tree: trees that minimize travel (`build-guide-coordinator`)');
    const h2 = raw.split('\n').filter((l) => l.startsWith('## '));
    expect(h2).toEqual(['## Inputs', '## Work', '## Writes', '## Returns', '## Fault directives']);
    expect(tree).toMatch(/\*\*Header:\*\* `stage: "D1-tree"`, `attempt`, `concept`, `mode`, `runFolder`, `runFolderRel`, `buildFolder`, `compile: "measure-only"`, `writes: \["<buildFolder>\/plan\.json"\]`/);
    expect(tree).toMatch(/a fresh coordinator step between D1-build \(`D1-build\.md`\) and D1-finish \(`D1-finish\.md`\)/);
    const returns = raw.slice(raw.indexOf('## Returns'), raw.indexOf('## Fault directives'));
    expect(returns).toMatch(/At most 8 lines, counts only/);
  });

  it('runs the ladder in order, m, then b, then n, after the floor holds on each rung', () => {
    expect(tree).toMatch(/the rungs in ladder order, \*\*`m`, then `b`, then `n`\*\*, each to the end before the next/);
    expect(tree).toMatch(/\*\*Start: the floor first\.\*\* Compile `m`, `b` and `n` together .* The loop runs only once every rung's floor holds: when any rung's floor fails, change nothing/);
  });

  it('gives every call the rung\'s loadout, keep, protect_for, clear_group and max_loss', () => {
    expect(tree).toMatch(/Every `mcp__pob2__get_node_power` call on a rung, here and at the D1 gate, comes after a compile that loaded every rung it names \(`mcp__pob2__compile_plan \{stages\}` loads only the named stages: the rung and every later rung\), and has: - `loadout`: the rung's loadout name, exactly as the compile record has it/);
    expect(tree).toMatch(/- `keep`: the nodes of the rung's `tree\.needs`; for `b` and `n`, also every node of the rung before's `tree\.nodes`, so a swap touches only the nodes the rung adds/);
    expect(tree).toMatch(/- `protect_for`: the later rungs' loadout names, exactly as the record has them, `m`'s `b` and `n`, `b`'s `n`, none for `n`/);
    // WU-92's verifier: the tool defaults to the main group, so the clear group is always passed.
    expect(tree).toMatch(/- `clear_group`, \*\*always\*\*: the record's group number of the rung's first enabled `role: "clear"` group .* else the main group's/);
    // The coordinator's guard ruling (amendment 9 §23): the clear skill's uses per second may drop up to 2%, as the
    // stats may; movement speed and the clear skill's radius stay at 0.
    expect(tree).toMatch(/- `max_loss: \{clearUses: 2\}`, the map form .*: the clear skill's uses per second may drop up to 2%, as each stat after the first \(TotalEHP\) may.* the other guards keep their default 0 \(`movement` and `clearRadius`/);
    expect(tree).not.toMatch(/`max_loss` left at its default/);
    expect(tree).toMatch(/`limit: 0`, the compact mode, for a swap/);
  });

  it('applies a swap up the ladder and compiles every rung it touches together before measuring again', () => {
    expect(tree).toMatch(/\*\*Up the ladder\*\* \(D-282\): a change on `m` goes to `b` and `n` too, which contain `m`'s tree, and one on `b` to `n`/);
    expect(tree).toMatch(/\*\*Compile every rung it touches together\*\*: `mcp__pob2__compile_plan \{plan_path: "<plan>", measure_only: true, stages: \[<the rung and every later rung>\]\}`, which also loads the later rungs' loadouts that `protect_for` names/);
  });

  it('undoes a swap when a touched rung\'s floor fails or V1 gains a finding, a need\'s missing-reason expected', () => {
    expect(tree).toMatch(/\*\*Undo\*\* a change on every rung it touched when a compile fails, any touched rung's floor fails, or V1 gains a finding/);
    expect(tree).toMatch(/its V1 findings against the last compile's: a code on a stage that it didn't have before is a new finding\. A need's `missing-reason` \(`tree\.needs\[<m>\]\.claim`\) doesn't count/);
  });

  it('writes an undone swap\'s removed nodes as a floor need', () => {
    expect(tree).toMatch(/An undone swap's removed nodes become a floor need on its rung, `\{"nodes": \[<the removed nodes>\], "stat": "TotalEHP"\}` \("a defence the floor needs"\), so neither the loop nor the gate proposes it again/);
  });

  it('spends spare points on the rung\'s best nodes per point, counted as V1 counts them (weapon sets included)', () => {
    expect(tree).toMatch(/\*\*Spare points\*\*, counted as V1 counts them \(its `passive-points` check, PoB's own count\)/);
    expect(tree).toMatch(/less the smaller weapon set, `min\(\|set1\|, \|set2\|\)` of `weaponSetNodes`: its untagged nodes plus the larger weapon set/);
    expect(tree).toMatch(/The tool's `points` count the untagged nodes only, so never take spare points from them on a rung with weapon-set nodes/);
    expect(tree).toMatch(/The \*\*allowance\*\* is V1's: `level` − 1, plus the quests' passive points at `endgame` .* plus PoB's `ExtraPoints`/);
    expect(tree).toMatch(/The Martyr point isn't spare/);
    expect(tree).toMatch(/a swap can free some: one applied up the ladder \(the rung already held some of the added nodes\), or one whose new paths use fewer points than it freed/);
    expect(tree).toMatch(/Spend them on the rung's best nodes per point: call the tool with `limit: 15` and take its best unallocated nodes in rank order/);
    // V1's own rule, which the count above restates: regular points are allocated less the smaller weapon set.
    const v1 = read(path.join(REPO, 'src', 'plan', 'checks', 'v1.ts'));
    expect(v1).toContain('const regular = used - Math.min(weaponSet1, weaponSet2);');
    expect(v1).toContain('let allowed = fromLevels + fromQuests + extra;');
  });

  it('ends each rung with no unspent regular point, or returns the points left with a reason D1-finish claims', () => {
    expect(tree).toMatch(/\*\*No unspent point\*\*: after the loop, spend the rung's spare points again as step 2 does, so the rung ends with every regular point the level allows spent\. A point left .* is returned with its reason, `unspent: <rung> <k>: <why>`, which D1-finish writes as a `reason` claim on the rung/);
    expect(tree).toMatch(/and its regular points left unspent \(0 unless step 4 couldn't spend them\)/);
    expect(readStage('D1-tree')).toContain('m: travel 21 → 8; swaps 4, 1 undone; spare points 0; unspent 0');
    expect(folded(readStage('D1-finish'))).toMatch(/D1-tree's `unspent: <rung> <k>: <why>` lines, each a `reason` claim on that rung/);
  });

  it(`stops at ${LOOP_STOP}% and ${LOOP_CAP} swaps per rung, under the gate's ${GATE_LINE}%`, () => {
    expect(tree).toContain(`While its best swap gains at least **${LOOP_STOP}%** Full DPS, make it a change`);
    expect(tree).toContain(`after **${LOOP_CAP} swaps** on the rung, an undone one counted`);
    expect(tree).toContain(`The D1 gate fails a rung at ${GATE_LINE}%`);
  });

  it('meets a need with a stat by node power on that stat', () => {
    expect(tree).toMatch(/\*\*A need with a stat\*\* is met by node power on it: for each of the rung's needs with a `stat`, call the tool with `stats: \["<the need's stat>", "FullDPS"\]`/);
  });

  it('makes no respec, and returns counts only: travel before and after, and the swaps', () => {
    expect(tree).toMatch(/a respec is never the loop's: only a stated `respec\.dropped` with its reason/);
    expect(tree).toMatch(/no respec\. Validate/);
    expect(tree).toMatch(/each rung's travel before and after, its swaps and how many were undone/);
    expect(raw).toContain('m: travel 21 → 8; swaps 4, 1 undone; spare points 0; unspent 0');
  });
});

describe('F1 (AC-W77): the endgame-only build\'s final compile (D-413)', () => {
  const raw = readStage('F1');
  const f1 = folded(raw);

  it('is a coordinator stage reference in the others\' form, with accepted and buildName in its header', () => {
    expect(raw.split('\n')[0]).toBe('# F1: the endgame-only build\'s final compile (`build-guide-coordinator`)');
    expect(raw.split('\n').filter((l) => l.startsWith('## '))).toEqual(['## Inputs', '## Work', '## Writes', '## Returns', '## Fault directives']);
    expect(f1).toMatch(/\*\*Header:\*\* `stage: "F1"`, `attempt` \(counts this concept's F1 attempts\), `concept`, `mode`, `runFolder`, `runFolderRel`, `buildFolder`, `compile: "final"`, `buildName`, `accepted` \(the findings the user accepted at a D1 gate escalation, option 1/);
    const returns = raw.slice(raw.indexOf('## Returns'), raw.indexOf('## Fault directives'));
    expect(returns).toMatch(/At most 8 lines/);
  });

  it('checks the plan\'s sha1 against the passing D1 gate\'s planSha1 before the final compile', () => {
    expect(f1).toMatch(/\*\*The sha1 check\.\*\* Grep the new `compile-record\.json` for `"planSha1"`: the plan's sha1 now\. When it isn't the gate's, the plan changed since the user accepted it: part `compiled` fails, code `plan-changed`/);
    expect(f1).toMatch(/no final compile runs/);
    // The D1 gate's verdict file carries the sha1 F1 checks.
    expect(firstJson(readStage('D1-gate')).planSha1).toMatch(/^[0-9a-f]{40}$/);
  });

  it('names the PoB file by the checker\'s rule: the card id, none for a build in "."', () => {
    expect(f1).toMatch(/`<slug>-<YYYY-MM-DD>-<n>-<card id>`, the run folder's last two segments and the card id joined with `-` \(D-412\)/);
    expect(f1).toMatch(/for a build in `\.` \(a migrated run's\), `<slug>-<YYYY-MM-DD>-<n>`, with no card id/);
    expect(checker).toMatch(/const want = v4 && folder !== '\.' \? `\$\{runName\}-\$\{build\.id\}` : runName;/);
  });

  it('writes reports/gates/F1-<id>-a<n>.json in the D2 gate\'s shape, as the checker\'s fixture holds it', () => {
    expect(raw).toContain('reports/gates/F1-<concept>-a<attempt>.json');
    const example = firstJson(raw);
    const fixture = JSON.parse(read(path.join(FIXTURE_GATES, 'F1-r1-a-2-a1.json'))) as Record<string, unknown>;
    expect(example.stage).toBe('F1');
    for (const key of Object.keys(fixture)) expect({ key, present: key in example }).toEqual({ key, present: true });
    expect(Object.keys(example.verdict)).toEqual(['compiled', 'v1', 'v2']);
    expect(Object.keys(example.finalCompile)).toEqual(Object.keys(fixture.finalCompile as object));
  });

  it('routes a fault to one uncounted re-run and a second to escalation; a ledger refusal escalates at once', () => {
    expect(f1).toMatch(/A plan changed since the gate, a V1 or V2 failure not in `accepted`, or a compile error on the plan the gate passed is a fault, not a design finding: F1 re-runs once, uncounted, and a second failure escalates\. A `ledger-refused` escalates at once, since no retry changes it/);
    expect(f1).toMatch(/\*\*A refusal by the write ledger\*\* \(D-211: C-17's "already exists" or changed-on-disk wording\) is part `compiled` failing with code `ledger-refused`/);
  });

  it('offers its four escalation options as §7 states them', () => {
    expect(f1).toMatch(/1\. \*\*accept\*\*, not after a compile failure or a ledger refusal: the failing findings join `accepted`, and F1 runs once more, uncounted; 2\. \*\*guidance and one more retry\*\*: D1 \(D1-build, D1-tree and D1-finish as the guidance needs\), the D1 gate, and the design gate again, since the build changed; then F1; 3\. \*\*back to the verification gate\*\*: the build ends `dropped`; 4\. \*\*stop\*\*: the build ends `escalated`/);
    expect(f1).toMatch(/For a ledger refusal, the user can also restore or remove the changed file and answer 1/);
  });
});

describe('D1-finish (AC-W77): the needs\' claims and the ascendancy order\'s claim', () => {
  const finish = folded(readStage('D1-finish'));

  it('is the last of D1\'s three steps, after D1-build and D1-tree', () => {
    expect(finish).toMatch(/The last of D1's three steps \(D-356, D-418\), a fresh coordinator step after D1-build \(`D1-build\.md`\) and D1-tree \(`D1-tree\.md`\)/);
  });

  it('writes each need\'s reason claim on its stage and sets the need\'s claim (D-418)', () => {
    expect(finish).toMatch(/\*\*the needs:\*\* every need of every rung's `tree\.needs` gets a `reason` claim on its own stage, and you set its `claim` to that claim's id/);
    expect(finish).toMatch(/A need with no `claim`, or one naming no claim of its stage, is the D1 gate's V1 finding `missing-reason`/);
    expect(finish).toMatch(/A claims-only edit changes only `stages\[\]\.claims`, `source` and `tag` fields, a need's `claim` \(D-266 leaves it out of `buildSha1`\)/);
  });

  it('writes the ascendancy order\'s reason claim on m, naming the nodes in that order (D-413)', () => {
    expect(finish).toMatch(/\*\*the ascendancy order:\*\* one claim on `m`, id `m-ascendancy-order`, naming every node of `m`'s `tree\.ascendancyNodes` by the name `mcp__pob2__search_tree_nodes \{ascendancy: "<the roll's ascendancy>"\}` gives it, in that array's order and no other, and why that order/);
    expect(finish).toMatch(/W1 renders it, since it reads no node ids, and V4 checks its order against `ascendancyNodes`/);
  });

  it('claims each reward pick D1-build made for a plan with no campaign stage', () => {
    expect(finish).toMatch(/\*\*the reward picks without D2\*\*, in a plan with no campaign stage: one claim on `m` per pick D1-build made, the quest, the option taken and a one-line reason, citing `data:campaign\/progress\.json#q\.<key>\.options\[<i>\]`/);
  });

  it('calls no trade tool once pricing has stopped in the session (D-415, D-422)', () => {
    expect(finish).toMatch(/Pricing stopped: no call; `unavailable`, note `pricing stopped`, and no tool that sends a trade request at all \(D-422/);
    for (const tool of TRADE_TOOLS) expect({ tool, named: finish.includes(`mcp__pob2__${tool}`) }).toEqual({ tool, named: true });
  });
});

describe('the D1 gate and gates.md (AC-W77): the tree part, its codes and routes; the display', () => {
  const gateRaw = readStage('D1-gate');
  const gate = folded(gateRaw);
  const gates = folded(ref('gates.md'));
  const example = firstJson(gateRaw);

  it('measures each rung with get_node_power in compact mode, with D1-tree\'s arguments, after the compile', () => {
    expect(gate).toMatch(/- \*\*tree\*\* \(D-419\), PoB's node power on each rung, after the compile loaded them: call `mcp__pob2__get_node_power` in compact mode on `m`, `b` and `n`, in that order, with D1-tree's arguments/);
    expect(gate).toMatch(/`keep` the nodes of its `tree\.needs`, for `b` and `n` also every node of the rung before's `tree\.nodes`/);
    expect(gate).toMatch(/`protect_for` the later rungs' loadout names, as the record has them; `clear_group`, always, the record's group number of the rung's first enabled `role: "clear"` group .*; `max_loss: \{clearUses: 2\}`, as D1-tree passes it \(2% on TotalEHP and on the clear skill's uses per second; movement speed and the clear skill's radius at 0\); `limit: 0`/);
  });

  it(`fails a rung at ${GATE_LINE}% with tree-swap; a tool failure is unverified with tool-error; a refusal tool-refused`, () => {
    expect(gate).toContain(`A rung whose best swap gains **${GATE_LINE}%** Full DPS or more fails the part, one \`tree-swap\` finding per such rung`);
    expect(gate).toMatch(/When a call fails or times out, the part is `unverified` with one `tool-error` finding/);
    expect(gate).toMatch(/A refused call \(D-421\) is `unverified` with `tool-refused`/);
    expect(gate).toMatch(/only the budget may stay `unverified` \(D-164\), and the tree when `mcp__pob2__get_node_power` fails \(`tool-error`\) or is refused \(`tool-refused`, D-421\)/);
    expect(gates).toContain(`A rung **fails** when its best swap left gains at least **${GATE_LINE}%** Full DPS within \`max_loss\`, with the swap as its finding (code \`tree-swap\`)`);
    for (const row of ['| tree | `tree-swap` |', '| tree | `tool-error` |', '| any part | `tool-refused` |']) {
      expect({ row, listed: ref('gates.md').includes(row) }).toEqual({ row, listed: true });
    }
  });

  it('writes the tree part and each rung\'s tree in the checker\'s shape, the hit its EHP was measured against, and planSha1', () => {
    expect(Object.keys(example.verdict)).toEqual(['compiled', 'v1', 'v2', 'floor', 'budget', 'rolledSkill', 'tree']);
    const rung = example.design.rungs[0];
    const fixtureRung = (JSON.parse(read(path.join(FIXTURE_GATES, 'D1-gate-r1-a-2-a1.json'))) as { design: { rungs: { tree: object }[] } }).design.rungs[0];
    expect(Object.keys(rung.tree)).toEqual(Object.keys(fixtureRung.tree));
    expect(Object.keys(rung.tree)).toEqual(['travel', 'points', 'bestSwap', 'needs']);
    expect(Object.keys(rung.tree.bestSwap)).toEqual(['gainPercent', 'removed', 'added']);
    expect(rung.tree.travel).toBeLessThanOrEqual(rung.tree.points);
    expect(rung.tree.bestSwap.gainPercent).toBeLessThan(GATE_LINE);
    expect(checker).toMatch(/each carry `tree: \{travel, points, bestSwap, needs\}`/);
    expect(typeof rung.ehpHit).toBe('string');
    expect(gate).toMatch(/`ehpHit` \(D-423\), the hit that `ehp` was measured against, which the display's Effective HP line names/);
    expect(gate).toMatch(/`planSha1`: the record's `planSha1` after step 3's compile, the plan this gate passed; F1 compiles only that plan \(D-413\)/);
  });

  it('shows the travel, the swap left and the needs on the design display', () => {
    expect(gate).toMatch(/The display prints the travel and the swap left, then each need, so the user sees why a long branch stays/);
    expect(gate).toMatch(/`needs`, one short line per need of the rung's `tree\.needs`, under 120 characters, what it keeps and why, from its claim/);
  });

  it('calls no trade tool once pricing has stopped; the market keeps its computation (D-422)', () => {
    expect(gate).toMatch(/\*\*No trade call once pricing has stopped\*\* \(D-422\), in any step: no `mcp__pob2__get_leagues`, `mcp__pob2__get_item_price` for an item, `mcp__pob2__search_trade_items`, `mcp__pob2__search_stats` or `mcp__pob2__find_upgrades`/);
    expect(gate).toMatch(/The market's league is the plan's, recorded before the stop, and the market day keeps its computation/);
  });

  it('gates.md: the part list, D1 as three steps, and the tree\'s routes', () => {
    expect(ref('gates.md')).toContain('| `D1-gate` | `compiled`, `v1`, `v2`, `floor`, `budget`, `rolledSkill`, `tree` | see below |');
    expect(gates).toMatch(/`keep`, the nodes of its needs \(`tree\.needs`\), for `b` and `n` every node of the rung before, and every node a later rung's `respec\.dropped` lists/);
    // A compile that didn't pass leaves the tree unverified with every part after it, no tree finding needed.
    expect(gates).toMatch(/a gate whose compile failed leaves its other parts `unverified`/);
    expect(gates).toMatch(/D1 is three steps, each a fresh coordinator step: D1-build, D1-tree and D1-finish \(D-356, D-418\), then the gate/);
    expect(ref('gates.md')).toContain('| only the tree fails (`tree-swap`) | any | D1-tree, then D1-finish, then the gate, with the verdict as `findings` (D-418, D-419); after 2 counted retries, `escalated` |');
    expect(ref('gates.md')).toContain('| only the tree `unverified`, with `tool-error` | any | logged `fail`; the gate alone re-runs, once, uncounted; a second `tool-error` escalates (D-419) |');
    expect(ref('gates.md')).toContain('| compiled, V1, V2, floor, rolledSkill and tree pass; budget pass or unverified | any | the design gate (D-362), then F1 after its `accept` or `accept:file` (D-413); D2 runs only for a build\'s campaign (D-415) |');
  });

  it('gates.md: F1\'s routes and escalation, and the refused route to no producer', () => {
    expect(ref('gates.md')).toContain("| `F1` | `compiled`, `v1`, `v2` |");
    expect(gates).toMatch(/\| `ledger-refused` \(part `compiled`\): the write ledger refused the final compile .* \| escalates at once, since no retry changes it \|/);
    expect(gates).toMatch(/F1 re-runs once, uncounted; a second failure escalates/);
    expect(gates).toMatch(/\*\*F1's escalation\*\* \(stage `F1`, the verdict file `reports\/gates\/F1-<id>-a<n>\.json`\)/);
    expect(gates).toMatch(/3\. \*\*back to the verification gate\*\*: the build ends `dropped`; 4\. \*\*stop\*\*: the build ends `escalated`/);
    expect(gates).toMatch(/## The refused route \(D-421\)/);
    expect(gates).toMatch(/A verdict with `tool-refused` routes to no producer: never back to D1 or D2, and no retry is spent/);
  });
});

describe('the rest of WU-96: R1b\'s league rule, the dossier\'s EHP, the library\'s travel rule', () => {
  it('R1b makes no trade call once pricing has stopped, get_leagues included (D-422)', () => {
    const r1b = folded(readStage('R1b'));
    expect(r1b).toMatch(/\*\*Once pricing has stopped\*\* .* make no trade call, `mcp__pob2__get_leagues` included \(D-422\): the league is one a plan of this run recorded before the stop/);
  });

  it('the dossier\'s EHP names the hit it was measured against (D-423)', () => {
    expect(folded(readStage('R1b-assemble'))).toMatch(/`TotalEHP` as `EHP` \(D-294\), naming the hit it was measured against \(D-423\)/);
    expect(read(path.join(SKILL_DIR, 'templates', 'dossier-template.md'))).toMatch(/\| <TotalEHP> vs <the hit it was measured against, from the record's configWritten: T15 map hits \(D-423\)/);
  });

  it('the pattern library\'s tree advice holds the user\'s rule, cited to the user', () => {
    const lib = ref('patterns.md');
    const treeFamily = lib.slice(lib.indexOf('## 10. Tree'), lib.indexOf('## Sources'));
    expect(treeFamily).toContain('### Minimize travel distance');
    expect(folded(treeFamily)).toMatch(/judge a cluster by its gain per point with its path, never by its gain alone: .* \(the user, 2026-10-19: "minimize travel distance"\)/);
    expect(lib).toMatch(/^\[amendment-9\]: \.\.\/\.\.\/\.\.\/\.\.\/docs\/build-guide\/spec\/amendment-9-endgame-first\.md /m);
  });
});
