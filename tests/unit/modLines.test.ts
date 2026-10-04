/**
 * AC-T14 (WU-15): trade2 mod lines parse, string or object, over the 40 items of the 4 committed
 * fetch fixtures; `stripMarkup` equals PoB2's own `escapeGGGString` output, recorded in
 * `tests/fixtures/trade2/expected-mod-text.json` by `scripts/gen-expected-mod-text.lua` (run with
 * luajit against the pinned Common.lua).
 */
import fs from 'fs';
import path from 'path';
import { describe, it, expect } from '@jest/globals';
import { itemModLines, parseModLine, stripMarkup } from '../../src/trade/modLines';

const TRADE2 = path.resolve(__dirname, '..', 'fixtures', 'trade2');
const FIXTURES = ['fetch-belt-unique-chaos', 'fetch-body-armour', 'fetch-ring-divine', 'fetch-weighted-session'] as const;

interface Expected {
  fixture: string;
  item: number;
  path: string;
  raw: string;
  text: string;
}

const EXPECTED = JSON.parse(fs.readFileSync(path.join(TRADE2, 'expected-mod-text.json'), 'utf8')) as Expected[];
const ITEMS = FIXTURES.flatMap((fixture) => {
  const doc = JSON.parse(fs.readFileSync(path.join(TRADE2, `${fixture}.response.json`), 'utf8')) as {
    result: Array<{ item: Record<string, unknown> }>;
  };
  return doc.result.map((entry, item) => ({ fixture, item, raw: entry.item }));
});

/** Every raw mod line (object or string) of an item and its socketed items, with its path. */
function rawLines(item: Record<string, unknown>): Array<{ path: string; line: unknown }> {
  const out: Array<{ path: string; line: unknown }> = [];
  const walk = (it: Record<string, unknown>, prefix: string) => {
    for (const field of Object.keys(it).filter((k) => k.endsWith('Mods') && Array.isArray(it[k])).sort()) {
      (it[field] as unknown[]).forEach((line, i) => out.push({ path: `${prefix}${field}[${i}]`, line }));
    }
  };
  walk(item, '');
  ((item.socketedItems as Array<Record<string, unknown>> | undefined) ?? []).forEach((s, i) =>
    walk(s, `socketedItems[${i}].`),
  );
  return out;
}

describe('AC-T14 (WU-15): mod-line parsing', () => {
  it('AC-T14: the fixtures hold 40 items, with both object and string lines (incl. socketedItems)', () => {
    expect(ITEMS).toHaveLength(40);
    const all = ITEMS.flatMap((i) => rawLines(i.raw));
    expect(all.some((l) => typeof l.line === 'string' && l.path.startsWith('socketedItems'))).toBe(true);
    expect(all.some((l) => typeof l.line === 'object' && l.path.startsWith('socketedItems'))).toBe(true);
    expect(all.some((l) => typeof l.line === 'object' && !l.path.startsWith('socketedItems'))).toBe(true);
  });

  it('AC-T14: every mod line parses, and stripMarkup equals PoB escapeGGGString (expected-mod-text.json)', () => {
    const actual = ITEMS.flatMap(({ fixture, item, raw }) =>
      itemModLines(raw).map(({ path: p, line }) => ({ fixture, item, path: p, raw: line.raw, text: line.text })),
    );
    expect(actual).toHaveLength(EXPECTED.length);
    expect(actual).toEqual(EXPECTED);
    for (const e of EXPECTED) expect(stripMarkup(e.raw)).toBe(e.text);
    // The fixture really exercises the markup.
    expect(EXPECTED.filter((e) => e.raw !== e.text).length).toBeGreaterThan(100);
  });

  it('AC-T14: flags.fractured/desecrated/crafted and domain are preserved', () => {
    let fractured = 0;
    let desecrated = 0;
    let crafted = 0;
    for (const { raw } of ITEMS) {
      for (const { line } of rawLines(raw)) {
        const parsed = parseModLine(line);
        if (typeof line === 'string') {
          expect(parsed.domain).toBeNull();
          expect(parsed.flags).toEqual({ fractured: false, desecrated: false, crafted: false });
          continue;
        }
        const obj = line as { domain?: string; hash?: string; flags?: Record<string, boolean> };
        expect(parsed.domain).toBe(obj.domain ?? null);
        expect(parsed.hash).toBe(obj.hash ?? null);
        expect(parsed.flags).toEqual({
          fractured: obj.flags?.fractured === true,
          desecrated: obj.flags?.desecrated === true,
          crafted: obj.flags?.crafted === true,
        });
        if (parsed.flags.fractured) {
          fractured++;
          expect(parsed.domain).toBe('fractured');
        }
        if (parsed.flags.desecrated) {
          desecrated++;
          expect(parsed.domain).toBe('desecrated');
        }
        if (parsed.flags.crafted) {
          crafted++;
          expect(parsed.domain).toBe('crafted');
        }
        if (obj.hash?.startsWith('stat.')) expect(parsed.statId).toBe(obj.hash.slice(5));
      }
    }
    expect(fractured).toBe(13);
    expect(desecrated).toBe(16);
    expect(crafted).toBe(1);
  });

  it('AC-T14: magnitudes min/max are parsed as numbers', () => {
    let checked = 0;
    for (const { raw } of ITEMS) {
      for (const { line } of rawLines(raw)) {
        const parsed = parseModLine(line);
        const rawMods = (typeof line === 'object' ? (line as { mods?: Array<{ magnitudes?: Array<{ min: string; max: string }> }> }).mods : undefined) ?? [];
        expect(parsed.mods).toHaveLength(rawMods.length);
        rawMods.forEach((m, mi) => {
          (m.magnitudes ?? []).forEach((g, gi) => {
            const pm = parsed.mods[mi].magnitudes[gi];
            expect(typeof pm.min).toBe('number');
            expect(typeof pm.max).toBe('number');
            expect(pm.min).toBe(Number(g.min));
            expect(pm.max).toBe(Number(g.max));
            checked++;
          });
        });
      }
    }
    expect(checked).toBe(281);
    // A fractional magnitude, e.g. fetch-body-armour [0] "of Immortality" 29.1–33.
    const immortality = ITEMS.flatMap((i) => itemModLines(i.raw)).find((l) =>
      l.line.mods.some((m) => m.name === 'of Immortality'),
    );
    expect(immortality?.line.mods[0].magnitudes[0]).toEqual({ min: 29.1, max: 33 });
  });

  it('AC-T14: a line that is neither a string nor an object with a description is rejected', () => {
    expect(() => parseModLine({ domain: 'explicit' })).toThrow(TypeError);
    expect(() => parseModLine(42)).toThrow(TypeError);
  });
});
