/**
 * trade2 mod lines (S-3 §1–2).
 *
 * - On an item, every mod line is an object `{description, flags?, domain, hash, mods?}` whose
 *   `description` carries `[Tag|Text]` markup. Fractured, desecrated and crafted lines sit inside
 *   `explicitMods`, marked by `flags` and `domain`.
 * - Inside `socketedItems` (runes, gems) lines can be plain strings (`bondedMods`, a soul rune's
 *   `runeMods`) or objects with only a `description`.
 * - Magnitudes arrive as strings; they are parsed to numbers here.
 *
 * `stripMarkup` is PoB2's `escapeGGGString` (`Modules/Common.lua`, pinned tag), ported gsub for gsub.
 */
import type { RawModLine } from '../types/tradeTypes.js';

export interface ModLineFlags {
  fractured: boolean;
  desecrated: boolean;
  crafted: boolean;
}

export interface ParsedMagnitude {
  /** The magnitude's stat hash, when trade2 sends one. */
  hash?: string;
  min: number | null;
  max: number | null;
}

export interface ParsedMod {
  name?: string;
  tier?: string;
  level?: number;
  magnitudes: ParsedMagnitude[];
}

export interface ParsedModLine {
  /** The line as trade2 sent it (markup included). */
  raw: string;
  /** The line with markup stripped (`stripMarkup(raw)`). */
  text: string;
  /** `explicit | implicit | fractured | desecrated | crafted | enchant | rune | pseudo | …`, or null for string lines. */
  domain: string | null;
  /** trade2's `hash`, e.g. `stat.explicit.stat_3299347043` or `statgroup.0`, or null. */
  hash: string | null;
  /** The `/data/stats` id (`hash` without its `stat.` prefix), or null. */
  statId: string | null;
  flags: ModLineFlags;
  mods: ParsedMod[];
}

/**
 * Strip trade2 display markup, exactly as PoB2's `escapeGGGString` does:
 * `<tag>{text}` → `text`, then `[Text]` → `Text`, then `[Tag|Text]` → `Text`.
 */
export function stripMarkup(text: string): string {
  return text
    .replace(/<[^>]+>\{([^}]+)\}/g, '$1')
    .replace(/\[([^|\]]+)\]/g, '$1')
    .replace(/\[[^|]+\|([^|]+)\]/g, '$1');
}

function toNumber(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string' && value.trim() !== '') {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function parseMod(raw: unknown): ParsedMod {
  const m = (raw ?? {}) as { name?: unknown; tier?: unknown; level?: unknown; magnitudes?: unknown };
  const magnitudes = Array.isArray(m.magnitudes)
    ? m.magnitudes.map((g) => {
        const mag = (g ?? {}) as { hash?: unknown; min?: unknown; max?: unknown };
        return {
          ...(typeof mag.hash === 'string' ? { hash: mag.hash } : {}),
          min: toNumber(mag.min),
          max: toNumber(mag.max),
        };
      })
    : [];
  return {
    ...(typeof m.name === 'string' ? { name: m.name } : {}),
    ...(typeof m.tier === 'string' ? { tier: m.tier } : {}),
    ...(typeof m.level === 'number' ? { level: m.level } : {}),
    magnitudes,
  };
}

/**
 * Parse one mod line, string or object. Throws a `TypeError` for anything else (an object without a
 * string `description`).
 */
export function parseModLine(line: RawModLine | unknown): ParsedModLine {
  if (typeof line === 'string') {
    return {
      raw: line,
      text: stripMarkup(line),
      domain: null,
      hash: null,
      statId: null,
      flags: { fractured: false, desecrated: false, crafted: false },
      mods: [],
    };
  }
  const obj = line as { description?: unknown; flags?: unknown; domain?: unknown; hash?: unknown; mods?: unknown } | null;
  if (!obj || typeof obj !== 'object' || typeof obj.description !== 'string') {
    throw new TypeError('unrecognized trade mod line');
  }
  const flags = (obj.flags && typeof obj.flags === 'object' ? obj.flags : {}) as Record<string, unknown>;
  const hash = typeof obj.hash === 'string' ? obj.hash : null;
  return {
    raw: obj.description,
    text: stripMarkup(obj.description),
    domain: typeof obj.domain === 'string' ? obj.domain : null,
    hash,
    statId: hash !== null && hash.startsWith('stat.') ? hash.slice('stat.'.length) : null,
    flags: {
      fractured: flags.fractured === true,
      desecrated: flags.desecrated === true,
      crafted: flags.crafted === true,
    },
    mods: Array.isArray(obj.mods) ? obj.mods.map(parseMod) : [],
  };
}

/** One mod line of an item, with where it sits (`explicitMods[2]`, `socketedItems[0].bondedMods[1]`). */
export interface LocatedModLine {
  path: string;
  line: ParsedModLine;
}

/** The mod-line array fields of an item (every key ending in `Mods`), in sorted order. */
function modFields(item: Record<string, unknown>): string[] {
  return Object.keys(item)
    .filter((k) => k.endsWith('Mods') && Array.isArray(item[k]))
    .sort();
}

/**
 * Every mod line of a fetched item, then of each of its `socketedItems`, in a fixed order: fields
 * sorted by name, lines in array order. Throws on a line `parseModLine` can't read.
 */
export function itemModLines(item: unknown): LocatedModLine[] {
  const out: LocatedModLine[] = [];
  const walk = (it: Record<string, unknown>, prefix: string): void => {
    for (const field of modFields(it)) {
      (it[field] as unknown[]).forEach((line, i) => {
        out.push({ path: `${prefix}${field}[${i}]`, line: parseModLine(line) });
      });
    }
  };
  if (!item || typeof item !== 'object') return out;
  const it = item as Record<string, unknown>;
  walk(it, '');
  if (Array.isArray(it.socketedItems)) {
    it.socketedItems.forEach((s, i) => {
      if (s && typeof s === 'object') walk(s as Record<string, unknown>, `socketedItems[${i}].`);
    });
  }
  return out;
}

/** The stripped text of an item's lines in the given fields, skipping lines that can't be read. */
export function modTexts(item: unknown, fields: readonly string[]): string[] {
  if (!item || typeof item !== 'object') return [];
  const it = item as Record<string, unknown>;
  const out: string[] = [];
  for (const field of fields) {
    const lines = it[field];
    if (!Array.isArray(lines)) continue;
    for (const line of lines) {
      try {
        out.push(parseModLine(line).text);
      } catch {
        // An unreadable line is left out of the summary.
      }
    }
  }
  return out;
}
