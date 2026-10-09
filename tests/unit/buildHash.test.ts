/**
 * D-266: the compile record's `buildSha1`, the sha1 of the plan's build-affecting projection
 * (`src/plan/buildHash.ts`): the plan without `stages[].claims` and without any `source` or `tag` field. A
 * claims-only edit (D-264) leaves it equal; an item, a gem, a tree node, the config or a ledger formula changes
 * it. The run checker loads the same module's compiled form, so the two can't drift.
 */
import { describe, it, expect } from '@jest/globals';
import fs from 'fs';
import path from 'path';
import { buildProjection, buildSha1, canonicalJson } from '../../src/plan/buildHash';

type Json = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
const FIXTURE = path.resolve(__dirname, '..', 'fixtures', 'plans', 'two-stage', 'plan.json');
const fixture = (): Json => JSON.parse(fs.readFileSync(FIXTURE, 'utf8')) as Json;
const hashAfter = (edit: (p: Json) => void): string => {
  const p = fixture();
  edit(p);
  return buildSha1(p);
};
const base = buildSha1(fixture());

describe('D-266: buildSha1, the build-affecting projection of a plan', () => {
  it('is a sha1, and ignores key order and whitespace (canonical JSON)', () => {
    expect(base).toMatch(/^[0-9a-f]{40}$/);
    const reordered = JSON.parse(JSON.stringify(fixture(), Object.keys(fixture()).reverse()));
    expect(canonicalJson({ b: 1, a: [2, { d: 3, c: 4 }] })).toBe('{"a":[2,{"c":4,"d":3}],"b":1}');
    expect(buildSha1({ ...reordered, ...fixture() })).toBe(base);
  });

  it('is stable when only claims, sources or tags change', () => {
    expect(hashAfter((p) => (p.stages[0].claims[0].text += ' (fixed in place)'))).toBe(base);
    expect(hashAfter((p) => p.stages[1].claims.push({ text: 'A new caveat.', source: { kind: 'judgment', ref: 'x', confidence: 'L' } }))).toBe(base);
    expect(hashAfter((p) => (p.stages[0].claims = []))).toBe(base);
    expect(hashAfter((p) => (p.stages[0].claims[0].source = 'data:campaign/limits.json#passive-points.max'))).toBe(base);
    expect(hashAfter((p) => (p.stages[0].config.scenario[0].tag = { kind: 'judgment', ref: 'reworded', confidence: 'M' }))).toBe(base);
    expect(hashAfter((p) => (p.stages[0].config.scenario[0].source = { file: 'campaign/limits.json', key: 'other' }))).toBe(base);
    expect(hashAfter((p) => p.ledger[0].inputs.forEach((i: Json) => i.tag && (i.tag.ref += ' (recited)')))).toBe(base);
    const projected = buildProjection(fixture()) as Json;
    expect(projected.stages.every((s: Json) => !('claims' in s))).toBe(true);
    expect(JSON.stringify(projected)).not.toMatch(/"(source|tag)":/);
  });

  it('changes when an item, a gem, a tree node, the config or a ledger formula changes', () => {
    const changes: [string, (p: Json) => void][] = [
      ['an item', (p) => (p.stages[1].items.slots[0].text += '\n+10 to maximum Life')],
      ['a gem', (p) => p.stages[1].skills.groups[0].gems.push({ name: 'Martial Tempo', level: 1, quality: 0, enabled: true })],
      ['a gem level', (p) => (p.stages[1].skills.groups[0].gems[0].level += 1)],
      ['a tree node', (p) => p.stages[1].tree.nodes.pop()],
      ['the config', (p) => (p.stages[0].config.scenario[0].value = p.stages[0].config.scenario[0].value === 'None' ? 'Boss' : 'None')],
      ['a ledger formula', (p) => (p.ledger[0].formula = `(${p.ledger[0].formula}) * 2`)],
      ['a level', (p) => (p.stages[0].level += 1)],
    ];
    for (const [what, edit] of changes) expect({ what, changed: hashAfter(edit) !== base }).toEqual({ what, changed: true });
  });
});
