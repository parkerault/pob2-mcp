/**
 * WU-85 (amendment 8, D-401, AC-W71's script part): `.claude/skills/build-guide/scripts/rules-index.mjs`, spawned as
 * a real `node` process on small fixture indexes in a temp dir, each beside a copy of the shared
 * `data/rules/vocabulary.md`:
 *
 * - `check <dir>` passes a well-formed index and fails, naming the line, a malformed node line, a word outside the
 *   vocabulary, a block with a field missing, a price, a unique without the head's penalty rule, and a pairs.md that
 *   isn't the join;
 * - `check` also fails a block whose Penalties is `none` beside a quoted line that states a penalty, and a price in
 *   chaos;
 * - `check <dir> --text <dump>` (a small fixture of `candidates --json`'s shape) passes verbatim lines and fails a line
 *   the item doesn't have, or a `none` beside a penalty line among the item's own lines;
 * - `join <dir>` pairs a fixture's "creates infusion" with its "pays off on infusion", across files, never pairs an
 *   entry with itself, notables of two ascendancies, or two uniques for one slot (two rings do pair).
 *
 * `candidates` runs against the pinned PoB in tests/integration/rulesIndexCandidates.test.ts.
 *
 * The committed index is checked in tests/static/rulesIndex.test.ts.
 */
import { describe, it, expect, afterAll } from '@jest/globals';
import { spawnSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';

const REPO = path.resolve(__dirname, '..', '..');
const SCRIPT = path.join(REPO, '.claude', 'skills', 'build-guide', 'scripts', 'rules-index.mjs');
const VOCABULARY = path.join(REPO, 'data', 'rules', 'vocabulary.md');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rules-index-'));

afterAll(() => fs.rmSync(TMP, { recursive: true, force: true }));

function run(...args: string[]) {
  const r = spawnSync(process.execPath, [SCRIPT, ...args], { cwd: TMP, env: { PATH: '/usr/bin:/bin', LANG: 'C' }, encoding: 'utf8', timeout: 30000 });
  return { code: r.status, stdout: r.stdout, stderr: r.stderr };
}

const PENALTY_RULE = 'Most uniques give up the resistances, life and defences a rare provides; a block lists only the penalties its own lines state.';

const NODES = [
  '# Nodes',
  '',
  '## Martial Artist',
  '',
  '- Way of the Stonefist (39595, Martial Artist) [rule] — equipped gloves become Fists of Stone, with stronger related explicit modifiers. creates: item-modifiers | pays off on: glove-slot | PoB models it: no',
  '- Fixture Notable (11111, Martial Artist) — 20% more damage.',
  '',
  '## Keystones',
  '',
  '- Fixture Keystone (22222, keystone) [rule] — your infusions are kept when you use a skill. creates: none | pays off on: infusion | PoB models it: partly',
  '',
].join('\n');

const UNIQUES = [
  '# Uniques',
  '',
  PENALTY_RULE,
  '',
  '### Fixture Gloves (Gloves, level 40)',
  '- Id: fixture-gloves',
  '- Rule: Cold skills leave an infusion behind on every hit.',
  '- Lines: "Hits with Cold Skills create a Cold Infusion"',
  '- Creates: infusion | Pays off on: none',
  '- Penalties: "-20% to Fire Resistance"',
  '- PoB models it: no — a compile measures what it gives up, not what it adds',
  '',
].join('\n');

const GEMS = [
  '# Gems',
  '',
  '### Fixture Support (support gem, tier 1)',
  '- Id: fixture-support',
  '- Rule: supported spells consume an infusion in place of mana.',
  '- Lines: "Supported Spells consume an Infusion in place of Mana"',
  '- Creates: none | Pays off on: infusion, mana',
  '- Penalties: none',
  '- PoB models it: yes',
  '',
].join('\n');

let dirs = 0;
/** A fixture index in a fresh dir: the vocabulary, the three entry files, and (unless `pairs` is false) the join. */
function index(files: { nodes?: string; uniques?: string; gems?: string } = {}, pairs = true): string {
  const dir = path.join(TMP, `index-${++dirs}`);
  fs.mkdirSync(dir);
  fs.copyFileSync(VOCABULARY, path.join(dir, 'vocabulary.md'));
  fs.writeFileSync(path.join(dir, 'nodes.md'), files.nodes ?? NODES);
  fs.writeFileSync(path.join(dir, 'uniques.md'), files.uniques ?? UNIQUES);
  fs.writeFileSync(path.join(dir, 'gems.md'), files.gems ?? GEMS);
  if (pairs) expect(run('join', dir, '--write')).toMatchObject({ code: 0 });
  return dir;
}

describe('rules-index.mjs check (AC-W71)', () => {
  it('passes a well-formed index', () => {
    const r = run('check', index());
    expect(r).toEqual({ code: 0, stderr: '', stdout: 'rules-index check: ok (2 [rule] nodes, 1 uniques, 1 gems)\n' });
  });

  it.each([
    ['a node line without its id', NODES.replace('(11111, Martial Artist)', '(Martial Artist)'), 'nodes.md:6: not a node line'],
    ['a [rule] line without its tags', NODES.replace(' creates: item-modifiers | pays off on: glove-slot | PoB models it: no', ''), 'nodes.md:5: a [rule] line needs'],
    ['a family outside the vocabulary', NODES.replace('pays off on: glove-slot', 'pays off on: cold-infusion'), 'nodes.md:5: pays off on: not in the vocabulary: cold-infusion'],
    ['tags on a line without [rule]', NODES.replace('20% more damage.', '20% more damage. creates: none | pays off on: crit | PoB models it: yes'), 'nodes.md:6: tags on a line without [rule]'],
    ['a model value other than yes, partly or no', NODES.replace('PoB models it: no', 'PoB models it: maybe'), 'nodes.md:5: PoB models it: "maybe"'],
    ['keystones before an ascendancy', NODES.replace('## Martial Artist', '## Keystones').replace('## Keystones\n\n- Fixture Keystone', '## Martial Artist\n\n- Fixture Keystone'), '"## Keystones" must be the last section'],
  ])('fails nodes.md with %s', (_name, nodes, problem) => {
    const r = run('check', index({ nodes }, false));
    expect(r.code).toBe(1);
    expect(r.stdout).toContain(problem);
  });

  it.each([
    ['a block with a field missing', UNIQUES.replace('- Penalties: "-20% to Fire Resistance"\n', ''), 'uniques.md:5: the fields must be'],
    ['an id outside the id form', UNIQUES.replace('- Id: fixture-gloves', '- Id: Fixture Gloves'), 'uniques.md:5: id "Fixture Gloves"'],
    ['a heading without its slot and level', UNIQUES.replace('### Fixture Gloves (Gloves, level 40)', '### Fixture Gloves'), 'uniques.md:5: not a block heading'],
    ['a heading with a tier, which only a gem has', UNIQUES.replace('(Gloves, level 40)', '(Gloves, tier 4)'), 'uniques.md:5: not a block heading'],
    ['unquoted lines', UNIQUES.replace('"Hits with Cold Skills create a Cold Infusion"', 'Hits with Cold Skills create a Cold Infusion'), 'uniques.md:5: Lines must be quoted lines'],
    ['a price', UNIQUES.replace('Cold skills leave', 'Worth 3 divines; Cold skills leave'), 'uniques.md:7: a price'],
    ['no penalty rule in the head', UNIQUES.replace(PENALTY_RULE, 'Uniques.'), 'uniques.md: the head lacks the penalty rule'],
    ['an unmodelled unique that says nothing of the compile', UNIQUES.replace(' — a compile measures what it gives up, not what it adds', ''), 'uniques.md:5: a unique PoB models not at all says so'],
    ['a price in chaos', UNIQUES.replace('Cold skills leave', 'Trades for 40 chaos; Cold skills leave'), 'uniques.md:7: a price ("40 chaos")'],
    ['Penalties none beside a quoted penalty line', UNIQUES.replace('"Hits with Cold Skills create a Cold Infusion"', '"Hits with Cold Skills create a Cold Infusion", "-10% to Fire Resistance"').replace('- Penalties: "-20% to Fire Resistance"', '- Penalties: none'), 'uniques.md:5: Penalties says none, but "-10% to Fire Resistance" states a penalty'],
  ])('fails uniques.md with %s', (_name, uniques, problem) => {
    const r = run('check', index({ uniques }, false));
    expect(r.code).toBe(1);
    expect(r.stdout).toContain(problem);
  });

  it('fails gems.md with a family outside the vocabulary and an id used twice', () => {
    const r = run('check', index({ gems: GEMS.replace('infusion, mana', 'cold-infusion') + GEMS.replace('# Gems\n\n', '').replace('Fixture Support', 'Other') }, false));
    expect(r.code).toBe(1);
    expect(r.stdout).toContain('gems.md:3: Pays off on: not in the vocabulary: cold-infusion');
    expect(r.stdout).toContain('gems.md:10: id "fixture-support" used twice');
  });

  it('fails a gem whose Penalties is none beside "less" or "cannot", and passes one beside an immunity or a damage-taken line', () => {
    const less = GEMS.replace('"Supported Spells consume an Infusion in place of Mana"', '"Supported Spells consume an Infusion in place of Mana", "Supported Skills deal 50% less Damage"');
    expect(run('check', index({ gems: less }, false)).stdout).toContain('gems.md:3: Penalties says none, but "Supported Skills deal 50% less Damage" states a penalty');
    const cannot = GEMS.replace('"Supported Spells consume an Infusion in place of Mana"', '"Supported Spells consume an Infusion in place of Mana", "Supported Skills Cannot inflict Shock"');
    expect(run('check', index({ gems: cannot }, false)).stdout).toContain('Penalties says none, but "Supported Skills Cannot inflict Shock"');
    const fine = GEMS.replace('"Supported Spells consume an Infusion in place of Mana"', '"Supported Spells consume an Infusion in place of Mana", "Cannot be Frozen", "Take 40% less Damage from Hits", "Chaos Damage taken is 100 Chaos damage"');
    expect(run('check', index({ gems: fine })).code).toBe(0);
  });

  it('passes a rule changer no family fits, with none in both', () => {
    const r = run('check', index({ gems: GEMS.replace('infusion, mana', 'none') }));
    expect(r.code).toBe(0);
  });

  it('fails a pairs.md that is missing or is not the join', () => {
    const dir = index({}, false);
    expect(run('check', dir).stdout).toContain('pairs.md: missing');
    fs.writeFileSync(path.join(dir, 'pairs.md'), '# Pairs\n');
    const r = run('check', dir);
    expect(r.code).toBe(1);
    expect(r.stdout).toContain('pairs.md: not the join of the entries');
  });
});

describe('rules-index.mjs check --text (the verbatim lines and the penalty check against a candidates dump)', () => {
  /** A dump in `candidates --json`'s shape: the fixture's unique and gem with their lines. */
  const dump = (uniqueLines: string[], gemLines: { line: string; source: string }[]) => ({
    uniques: [{ name: 'Fixture Gloves', type: 'Gloves', base: 'Fixture Base', level: 40, lines: uniqueLines.map((line) => ({ line })) }],
    gems: [{ name: 'Fixture Support', support: true, tier: 1, lines: gemLines }],
  });
  const GEM_LINES = [{ line: 'Supports Spells.', source: 'description' }, { line: 'Supported Spells consume an Infusion in place of Mana', source: 'effect 1, stat set 1' }];
  function checkText(d: object, files: { uniques?: string; gems?: string } = {}) {
    const dir = index(files);
    const file = path.join(dir, 'dump.json');
    fs.writeFileSync(file, JSON.stringify(d));
    return run('check', dir, '--text', file);
  }

  it('passes when every quoted line is one of its item\'s lines', () => {
    const r = checkText(dump(['Hits with Cold Skills create a Cold Infusion', '-20% to Fire Resistance'], GEM_LINES));
    expect(r).toEqual({ code: 0, stderr: '', stdout: 'rules-index check: ok (2 [rule] nodes, 1 uniques, 1 gems)\n' });
  });

  it('fails a quoted line the item does not have, and a block that is no candidate', () => {
    const r = checkText({ uniques: dump(['Hits with Cold Skills create a Cold Infusion', '-25% to Fire Resistance'], []).uniques, gems: [] });
    expect(r.code).toBe(1);
    expect(r.stdout).toContain(`uniques.md:5: "-20% to Fire Resistance" isn't one of Fixture Gloves's lines`);
    expect(r.stdout).toContain(`gems.md:3: "Fixture Support" isn't a candidate`);
  });

  it("fails Penalties none when the item's own lines state a penalty, but not for a variant's line or a gem's description", () => {
    const uniques = UNIQUES.replace('- Penalties: "-20% to Fire Resistance"', '- Penalties: none');
    const stated = checkText(dump(['Hits with Cold Skills create a Cold Infusion', '-20% to Fire Resistance'], GEM_LINES), { uniques });
    expect(stated.code).toBe(1);
    expect(stated.stdout).toContain(`uniques.md:5: Penalties says none, but Fixture Gloves's line "-20% to Fire Resistance" states a penalty`);
    const d = dump(['Hits with Cold Skills create a Cold Infusion'], [...GEM_LINES, { line: 'Cannot Support Totems; supported Spells deal 50% less Damage.', source: 'description' }]);
    (d.uniques[0].lines as { line: string; variants?: string[] }[]).push({ line: '-20% to Fire Resistance', variants: ['Old'] });
    expect(checkText(d, { uniques }).code).toBe(0);
  });
});

describe('rules-index.mjs join (AC-W71)', () => {
  it('pairs "creates infusion" with "pays off on infusion", across files, never an entry with itself', () => {
    const dir = index({ nodes: NODES.replace('creates: none | pays off on: infusion', 'creates: infusion | pays off on: infusion') }, false);
    const r = run('join', dir);
    expect(r.code).toBe(0);
    const block = r.stdout.slice(r.stdout.indexOf('### infusion'));
    expect(block.trimEnd().split('\n\n')[0].split('\n')).toEqual([
      '### infusion',
      '- Id: infusion',
      '- infusion: Fixture Gloves (rules/uniques.md#fixture-gloves) → Fixture Keystone (rules/nodes.md#22222), Fixture Support (rules/gems.md#fixture-support)',
      '- infusion: Fixture Keystone (rules/nodes.md#22222) → Fixture Support (rules/gems.md#fixture-support)',
    ]);
    // A family only created (item-modifiers) or only paid off on (glove-slot, mana) makes no block.
    expect(r.stdout).not.toContain('### item-modifiers');
    expect(r.stdout).not.toContain('### mana');
    expect(run('join', dir, '--write')).toEqual({ code: 0, stderr: '', stdout: 'rules-index join: wrote pairs.md (2 lines)\n' });
    expect(fs.readFileSync(path.join(dir, 'pairs.md'), 'utf8')).toBe(r.stdout);
    expect(run('check', dir).code).toBe(0);
  });

  it('never pairs notables of two ascendancies or two uniques for one slot, but pairs two rings and a keystone with any', () => {
    const nodes = NODES.replace(
      '- Fixture Notable (11111, Martial Artist) — 20% more damage.',
      '- Fixture Payer (11112, Martial Artist) [rule] — modified gloves pay off. creates: none | pays off on: item-modifiers | PoB models it: yes\n\n## Invoker\n\n- Far Payer (11113, Invoker) [rule] — another ascendancy\'s notable. creates: none | pays off on: item-modifiers | PoB models it: yes',
    ).replace('pays off on: infusion | PoB models it: partly', 'pays off on: infusion, item-modifiers | PoB models it: partly');
    const block = (name: string, type: string, creates: string, pays: string) =>
      [`### ${name} (${type}, level 10)`, `- Id: ${name.toLowerCase().replace(/ /g, '-')}`, '- Rule: a fixture rule changer.', '- Lines: "A line"',
        `- Creates: ${creates} | Pays off on: ${pays}`, '- Penalties: none', '- PoB models it: yes'].join('\n');
    const uniques = [UNIQUES.trimEnd(), '', block('Other Gloves', 'Gloves', 'none', 'infusion'), '', block('First Ring', 'Ring', 'curse', 'none'), '',
      block('Second Ring', 'Ring', 'none', 'curse'), ''].join('\n');
    const dir = index({ nodes, uniques }, false);
    const r = run('join', dir);
    expect(r.code).toBe(0);
    const rows = r.stdout.split('\n').filter((l) => /^- (item-modifiers|infusion|curse): /.test(l));
    expect(rows).toEqual([
      '- curse: First Ring (rules/uniques.md#first-ring) → Second Ring (rules/uniques.md#second-ring)',
      '- infusion: Fixture Gloves (rules/uniques.md#fixture-gloves) → Fixture Keystone (rules/nodes.md#22222), Fixture Support (rules/gems.md#fixture-support)',
      '- item-modifiers: Way of the Stonefist (rules/nodes.md#39595) → Fixture Keystone (rules/nodes.md#22222), Fixture Payer (rules/nodes.md#11112)',
    ]);
  });

  it('refuses to join entries that fail the check', () => {
    const dir = index({ gems: GEMS.replace('- Penalties: none\n', '') }, false);
    const r = run('join', dir, '--write');
    expect(r.code).toBe(1);
    expect(r.stderr).toContain('nothing joined');
    expect(fs.existsSync(path.join(dir, 'pairs.md'))).toBe(false);
  });
});
