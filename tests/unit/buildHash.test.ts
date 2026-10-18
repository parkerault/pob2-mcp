/**
 * D-266: the compile record's `buildSha1`, the sha1 of the plan's build-affecting projection
 * (`src/plan/buildHash.ts`): the plan without `stages[].claims` and without any `source` or `tag` field. A
 * claims-only edit (D-264) leaves it equal; an item, a gem, a tree node or the config changes it. The run
 * checker loads the same module's compiled form, so the two can't drift.
 *
 * D-352 (WU-65): the projection also leaves out the plan's `ledger`, `ledger[].claim` included, so a
 * ledger-only edit after the final compile leaves `buildSha1` equal (the checker re-evaluates the plan's
 * current ledger itself), while a build edit still changes it.
 *
 * D-386: the projection also leaves out each price's `note`, its wording: in the Varashta run a note-only fix
 * forced a recompile, both gates and a rewrite of the PoB file. A price's amount, currency, status, query, item,
 * date or league still changes it.
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

  it('D-352: a ledger-only edit keeps the hash; the projection has no ledger', () => {
    expect(fixture().ledger.length).toBeGreaterThan(0);
    const edits: [string, (p: Json) => void][] = [
      ['a ledger formula', (p) => (p.ledger[0].formula = `(${p.ledger[0].formula}) * 2`)],
      ["a ledger entry's claim", (p) => (p.ledger[0].claim += ' (narrowed)')],
      ['a ledger input value', (p) => p.ledger[0].inputs.push({ name: 'k', value: 3, tag: { kind: 'judgment', ref: 'x', confidence: 'L' } })],
      ['a ledger entry added', (p) => p.ledger.push({ id: 'extra', claim: 'An estimate.', formula: '1.Life * 2', inputs: [] })],
      ['the ledger emptied', (p) => (p.ledger = [])],
    ];
    for (const [what, edit] of edits) expect({ what, same: hashAfter(edit) === base }).toEqual({ what, same: true });
    expect('ledger' in (buildProjection(fixture()) as Json)).toBe(false);
  });

  it('changes when an item, a gem, a tree node, the config, a level or a price changes (a build edit), even beside a ledger edit', () => {
    const changes: [string, (p: Json) => void][] = [
      ['an item', (p) => (p.stages[1].items.slots[0].text += '\n+10 to maximum Life')],
      ['a gem', (p) => p.stages[1].skills.groups[0].gems.push({ name: 'Martial Tempo', level: 1, quality: 0, enabled: true })],
      ['a gem level', (p) => (p.stages[1].skills.groups[0].gems[0].level += 1)],
      ['a tree node', (p) => p.stages[1].tree.nodes.pop()],
      ['the config', (p) => (p.stages[0].config.scenario[0].value = p.stages[0].config.scenario[0].value === 'None' ? 'Boss' : 'None')],
      ['a level', (p) => (p.stages[0].level += 1)],
      ['an anoint', (p) => (p.stages[1].items.anoint = { notable: 'Unbending', reason: 'more life' })],
      ['a price', (p) => (p.prices[0].amount = (p.prices[0].amount ?? 0) + 1)],
    ];
    for (const [what, edit] of changes) expect({ what, changed: hashAfter(edit) !== base }).toEqual({ what, changed: true });
    for (const [what, edit] of changes) {
      const both = hashAfter((p) => {
        p.ledger[0].formula = `(${p.ledger[0].formula}) * 2`;
        edit(p);
      });
      expect({ what, changed: both !== base }).toEqual({ what, changed: true });
    }
  });

  it("D-386: a price's note is no build content: rewording, adding or removing it keeps the hash", () => {
    expect(fixture().prices.length).toBeGreaterThan(0);
    const withNote = hashAfter((p) => (p.prices[0].note = 'priced from the cheapest listing'));
    expect(withNote).toBe(base);
    expect(hashAfter((p) => (p.prices[0].note = 'reworded'))).toBe(base);
    expect(hashAfter((p) => delete p.prices[0].note)).toBe(base);
    const projected = buildProjection(fixture()) as Json;
    expect(projected.prices.every((x: Json) => !('note' in x))).toBe(true);
    // The rest of a price still counts.
    for (const [what, edit] of [
      ['the status', (p: Json) => (p.prices[0].status = p.prices[0].status === 'ok' ? 'unavailable' : 'ok')],
      ['the query', (p: Json) => (p.prices[0].query = { changed: true })],
      ['the date', (p: Json) => (p.prices[0].date = '2001-01-01')],
    ] as [string, (p: Json) => void][]) {
      expect({ what, changed: hashAfter(edit) !== base }).toEqual({ what, changed: true });
    }
  });
});
