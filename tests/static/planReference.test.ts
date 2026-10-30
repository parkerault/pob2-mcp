/**
 * AC-P9 (WU-38): the committed plan reference documents exactly the schema's fields.
 *
 * The field paths of `zodToJsonSchema(planSchema)` (`.key` for object keys, `[]` for arrays, every union
 * branch walked) equal, as a set, the paths in the "Fields" table of `docs/build-guide/plan-reference.md`.
 * `$refStrategy: 'none'` inlines every reused sub-schema (the source tag appears at eight places), so
 * each place has its own rows. The table's "Required" column must also match the JSON Schema.
 */
import fs from 'fs';
import path from 'path';
import { describe, expect, it } from '@jest/globals';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { planSchema } from '../../src/plan/schema';

const REFERENCE = path.resolve(__dirname, '..', '..', 'docs', 'build-guide', 'plan-reference.md');

interface JsonSchemaNode {
  type?: string | string[];
  properties?: Record<string, JsonSchemaNode>;
  required?: string[];
  items?: JsonSchemaNode | JsonSchemaNode[];
  anyOf?: JsonSchemaNode[];
  oneOf?: JsonSchemaNode[];
  allOf?: JsonSchemaNode[];
  $ref?: string;
}

/** Every object-key path under `node`, with whether the key is required in its object. */
function schemaFieldPaths(node: JsonSchemaNode, prefix = '', out = new Map<string, boolean>()): Map<string, boolean> {
  if (node.$ref !== undefined) throw new Error(`unexpected $ref at ${prefix || '$'}: inline every sub-schema`);
  for (const branch of [...(node.anyOf ?? []), ...(node.oneOf ?? []), ...(node.allOf ?? [])]) schemaFieldPaths(branch, prefix, out);
  for (const [key, child] of Object.entries(node.properties ?? {})) {
    const p = prefix === '' ? key : `${prefix}.${key}`;
    out.set(p, (node.required ?? []).includes(key));
    schemaFieldPaths(child, p, out);
  }
  const items = node.items === undefined ? [] : Array.isArray(node.items) ? node.items : [node.items];
  for (const item of items) schemaFieldPaths(item, `${prefix}[]`, out);
  return out;
}

/** The rows of the reference's "Fields" table: path (first cell, in backticks) and the Required cell. */
function referenceRows(markdown: string): Array<{ path: string; required: string }> {
  const start = markdown.search(/^## Fields$/m);
  if (start < 0) throw new Error('no "## Fields" section');
  const rest = markdown.slice(start + 1);
  const end = rest.search(/^## /m);
  const section = end < 0 ? rest : rest.slice(0, end);
  return section
    .split('\n')
    .filter((line) => line.startsWith('| `'))
    .map((line) => {
      const cells = line.split(/(?<!\\)\|/).slice(1, -1).map((c) => c.trim());
      const m = /^`([^`]+)`$/.exec(cells[0]);
      if (!m) throw new Error(`the first cell isn't one backticked path: ${line}`);
      return { path: m[1], required: cells[2] };
    });
}

describe('AC-P9 (WU-38): plan-reference.md documents every schema field', () => {
  const schemaPaths = schemaFieldPaths(zodToJsonSchema(planSchema, { $refStrategy: 'none' }) as JsonSchemaNode);
  const rows = referenceRows(fs.readFileSync(REFERENCE, 'utf8'));

  it('AC-P9: the path extraction sees nested, array and union fields (self-check)', () => {
    for (const p of ['schemaVersion', 'stages[].tree.nodes', 'stages[].items.slots[].slot', 'stages[].claims[].source', 'stages[].claims[].source.kind', 'prices[].query']) {
      expect(schemaPaths.has(p)).toBe(true);
    }
    expect(schemaPaths.size).toBeGreaterThan(100);
  });

  it('AC-P9: the field table lists each path once', () => {
    const seen = rows.map((r) => r.path);
    expect(seen.filter((p, i) => seen.indexOf(p) !== i)).toEqual([]);
  });

  it('AC-P9: the field-table paths equal the zodToJsonSchema(planSchema) paths, as a set', () => {
    const documented = new Set(rows.map((r) => r.path));
    const missing = [...schemaPaths.keys()].filter((p) => !documented.has(p));
    const extra = [...documented].filter((p) => !schemaPaths.has(p));
    expect({ missing, extra }).toEqual({ missing: [], extra: [] });
  });

  it('AC-P89 (WU-128, amendment 13 §6): the reference holds no "Legacy of" example: an over-budget rune is no example', () => {
    const text = fs.readFileSync(REFERENCE, 'utf8');
    expect(text).not.toMatch(/Legacy of /);
    expect(text).not.toContain('Raven-Touched Shard');
    // The culling example is a notable of the pinned tree whose line gives Culling Strike.
    const tree = JSON.parse(fs.readFileSync(path.resolve(__dirname, '..', '..', 'vendor', 'PathOfBuilding-PoE2', 'src', 'TreeData', '0_5', 'tree.json'), 'utf8'));
    const node = tree.nodes['56997'];
    expect(node.stats).toEqual(['Hits that Heavy Stun Enemies have Culling Strike']);
    expect(text).toContain(`"cull": "${node.name} (56997): Detonate Dead's hits that Heavy Stun cull"`);
  });

  it('AC-P9: each row\'s Required cell matches the JSON Schema', () => {
    const wrong = rows
      .filter((r) => schemaPaths.has(r.path))
      .filter((r) => r.required !== (schemaPaths.get(r.path) ? 'yes' : 'no'))
      .map((r) => `${r.path}: ${r.required}`);
    expect(wrong).toEqual([]);
  });
});
