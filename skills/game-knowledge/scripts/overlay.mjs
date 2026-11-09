// The overlay's sidecar (amendment 16 §19, D-523; C-66, Appendix A.11): the new league's socketables and uniques, as
// the server adds them to PoB's data before our pin knows them. `league-digest.mjs` writes `<slug>.overlay.json` beside
// every digest it writes, committed or not, from the parsed page lines (their implicit, bonded and corrupted flags), not
// from the Markdown, which loses them.
//
// **A socketable** the pin doesn't define: `{name, type, rank: [<level>], socketBound, slots: [{label, keys, lines,
// statOrder}]}`. `type` is PoB's augment type: poe2db tags every socketable `SoulCore` (its item class), so the name's
// kind word decides it: a "Soul Core" is a `SoulCore`, an "Idol" an `Idol`, any other a `Rune`. `rank` is its level
// requirement, as PoB's `rank = {n}`; `socketBound` its "Socket-bound" line. Each slot label poe2db prints before a
// line ("Helmets:", "Martial Weapon:") maps to PoB's slot keys through `data/league/rune-slots.json` (built from the
// pinned corpus: the in-pin socketables of `runes-of-aldur.md` against `Data/ModRunes.lua`, and checked against it by a
// test). A bonded line keeps PoB's `Bonded: ` prefix. A line poe2db joins with ", " is split where PoB keeps its stats
// apart: when every part is a line the pin's runes have, or else when every part starts with a number or a capital
// and holds a number. Each line's `statOrder` is the pin's number for a rune line of the same text (numbers and case
// aside), or else a fresh number above the pin's largest, fixed by the text (so the same text in two sidecars merges, as
// PoB merges a stat, and unrelated lines never do, `Classes/Item.lua`:1648–1649). PoB reads `rank[1]` and
// `statOrder[1]` of every rune of a slot type (`Classes/Item.lua`:1262–1265, `Classes/ItemsTab.lua`:1952), so no entry
// goes without them.
//
// **A unique** the pin doesn't define, on a base it does: `{name, base, level, implicits, explicits}`, the lines as
// PoB's unique texts write them, a range as `(a-b)`. A unique with several variants isn't written.
//
// **Skipped** (`skipped: [{name, reason}]`), listed by the script: a socketable with a label the table lacks, a unique on
// a base the pin lacks or with several variants, and every gem, ascendancy and passive the pin lacks: only a PoB
// release adds those.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(SCRIPT_DIR, '..', '..', '..');
/** The slot table: poe2db's slot label → PoB's slot keys (`Data/ModRunes.lua`'s second-level keys). */
export const SLOTS_FILE = path.join(ROOT, 'data', 'league', 'rune-slots.json');
export const SIDECAR_SCHEMA = 1;
export const sidecarName = (fileSlug) => `${fileSlug}.overlay.json`;

/** The slot table, label → keys. */
export function readSlots(file = SLOTS_FILE) {
  const json = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (!json || typeof json.labels !== 'object' || Array.isArray(json.labels)) throw new Error(`${file}: no "labels" object of label → PoB slot keys`);
  return new Map(Object.entries(json.labels));
}

/** PoB's augment type from a socketable's name (poe2db tags them all `SoulCore`). */
export function socketableType(name) {
  if (/\bSoul Core\b/i.test(name)) return 'SoulCore';
  if (/\bIdol\b/i.test(name)) return 'Idol';
  return 'Rune';
}

/** A line as the stat match compares it: no `Bonded: `, numbers as `#`, no case (as PoB's getRuneLineParts strips). */
export const strippedLine = (line) =>
  line
    .replace(/^Bonded: /, '')
    .replace(/\d+(?:\.\d+)?/g, '#')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

/**
 * The pin's rune lines, from `Data/ModRunes.lua`: `{orders: Map(stripped line → statOrder), max, names: Set}`, `max` the
 * largest statOrder any rune line has.
 */
export function pinRunesFromVendor(src) {
  const file = path.join(src, 'Data', 'ModRunes.lua');
  const orders = new Map();
  const names = new Set();
  let max = 0;
  let lines = [];
  for (const raw of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    let m;
    if ((m = /^\t\["((?:[^"\\]|\\.)*)"\] = \{$/.exec(raw))) names.add(m[1].replace(/\\(.)/g, '$1'));
    else if (/^\t\t\["[^"]+"\] = \{$/.test(raw)) lines = [];
    else if ((m = /^\t\t\t\t"((?:[^"\\]|\\.)*)",$/.exec(raw))) lines.push(m[1].replace(/\\(.)/g, '$1'));
    else if ((m = /^\t\t\t\tstatOrder = \{ ([^}]*) \},$/.exec(raw))) {
      const numbers = m[1].split(',').map((s) => Number(s.trim())).filter((n) => Number.isFinite(n));
      numbers.forEach((n, i) => {
        if (n > max) max = n;
        const key = lines[i] === undefined ? null : strippedLine(lines[i]);
        if (key !== null && !orders.has(key)) orders.set(key, n);
      });
    }
  }
  return { orders, max, names };
}

/** The pin's rune lines for tests: `--pin-names`' optional `"statOrders": {"<line>": n}` and `"maxStatOrder": n`. */
export function pinRunesFromNames(json) {
  const orders = new Map();
  for (const [line, n] of Object.entries(json?.statOrders ?? {})) if (Number.isFinite(n)) orders.set(strippedLine(line), n);
  const max = Number.isFinite(json?.maxStatOrder) ? json.maxStatOrder : Math.max(0, ...orders.values());
  return { orders, max, names: new Set(json?.socketable ?? []) };
}

/** FNV-1a, 32 bits, of a text: the fresh statOrder's offset, fixed by the line. */
function fnv1a(s) {
  let h = 0x811c9dc5;
  for (const c of Buffer.from(s, 'utf8')) {
    h ^= c;
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h;
}

/** A line's statOrder: the pin's for the same text, else a fresh one above the pin's largest, fixed by the text. */
export function statOrderOf(line, pinRunes) {
  const key = strippedLine(line);
  return pinRunes.orders.get(key) ?? pinRunes.max + 1 + (fnv1a(key) % 1000000);
}

/** A stat text poe2db may join with ", ", as PoB's lines (see the header). */
export function splitStats(text, pinRunes) {
  if (pinRunes.orders.has(strippedLine(text))) return [text];
  const parts = text.split(/, (?=[+-]?\d|[A-Z])/);
  if (parts.length === 1) return [text];
  if (parts.every((p) => pinRunes.orders.has(strippedLine(p)))) return parts;
  if (parts.every((p) => /^([+-]?\d|[A-Z])/.test(p) && /\d/.test(p))) return parts;
  return [text];
}

/** An entry's lines with each wrapped line joined onto the one before (a socketable's lines are one stat each). */
function joinedLines(lines) {
  const out = [];
  for (const l of lines) {
    if (l.wrapped && out.length > 0) out[out.length - 1] = { ...out[out.length - 1], text: `${out[out.length - 1].text} ${l.text}` };
    else out.push({ ...l });
  }
  return out;
}

/** A socketable entry of the digest as the sidecar holds it, or `{skip: reason}`. */
export function socketableEntry(e, slots, pinRunes) {
  if ((e.variants ?? []).length !== 1) return { skip: (e.variants ?? []).length === 0 ? 'poe2db gives it no text' : `it has ${e.variants.length} variants; the overlay writes a socketable with one` };
  let rank = 0;
  let socketBound = false;
  const bySlot = new Map();
  for (const l of joinedLines(e.variants[0])) {
    if (l.type === 'requires') {
      const m = /Level (\d+)/i.exec(l.text);
      if (m) rank = Number(m[1]);
      continue;
    }
    if (l.type === 'property') {
      if (/^Socket-bound$/i.test(l.text)) socketBound = true;
      continue;
    }
    if (l.corrupted || (l.bonded && /^Bonded:?$/i.test(l.text))) continue;
    const m = /^([^:]+): (.+)$/.exec(l.text);
    if (!m) return { skip: `the line "${l.text}" names no slot` };
    const label = m[1].trim();
    const keys = slots.get(label);
    if (!keys) return { skip: `label '${label}' has no PoB key` };
    if (!bySlot.has(label)) bySlot.set(label, { label, keys: [...keys], lines: [], statOrder: [] });
    const slot = bySlot.get(label);
    for (const stat of splitStats(m[2].trim(), pinRunes)) {
      slot.lines.push(l.bonded ? `Bonded: ${stat}` : stat);
      slot.statOrder.push(statOrderOf(stat, pinRunes));
    }
  }
  if (bySlot.size === 0) return { skip: 'it has no slot line' };
  return { entry: { name: e.name, type: socketableType(e.name), rank: [rank], socketBound, slots: [...bySlot.values()] } };
}

/** A range as PoB's unique texts write it: `+(8—12)%` → `+(8-12)%`. */
const pobRanges = (text) => text.replace(/\((-?\d+(?:\.\d+)?)\s*[—–-]\s*(-?\d+(?:\.\d+)?)\)/g, '($1-$2)');

/** A unique entry of the digest as the sidecar holds it, or `{skip: reason}`; `hasBase(name)` is the pin's base check. */
export function uniqueEntry(e, hasBase) {
  const base = e.tags?.[0] ?? '';
  if (!base) return { skip: 'poe2db names no base' };
  if (!hasBase(base)) return { skip: `its base ${base} isn't in the pin` };
  if ((e.variants ?? []).length !== 1) return { skip: (e.variants ?? []).length === 0 ? 'poe2db gives it no text' : `it has ${e.variants.length} variants; the overlay writes a unique with one` };
  let level = 0;
  const implicits = [];
  const explicits = [];
  for (const l of e.variants[0]) {
    if (l.type === 'requires') {
      const m = /Level (\d+)/i.exec(l.text);
      if (m) level = Number(m[1]);
      continue;
    }
    if (l.type !== 'mod' || l.corrupted) continue;
    (l.implicit ? implicits : explicits).push(pobRanges(l.text));
  }
  return { entry: { name: e.name, base, level, implicits, explicits } };
}

const SKIP_KIND = {
  gem: 'a gem: only a PoB release adds gems',
  ascendancy: 'an ascendancy: only a PoB release adds ascendancies',
  passive: 'a passive: only a PoB release adds passives',
};

/**
 * The sidecar of a digest's entries (each `{kind, name, tags, variants, inPin}`, socketables tagged `SoulCore`): the
 * entries the pin doesn't define, written or skipped.
 */
export function sidecarOf({ league, fetched, entries, slots, pinRunes, hasBase }) {
  const socketables = [];
  const uniques = [];
  const skipped = [];
  for (const e of entries) {
    if (e.inPin) continue;
    if (SKIP_KIND[e.kind]) {
      skipped.push({ name: e.name, reason: SKIP_KIND[e.kind] });
      continue;
    }
    let r = null;
    if (e.kind === 'unique') r = uniqueEntry(e, hasBase);
    else if (e.kind === 'item' && e.tags.includes('SoulCore')) r = socketableEntry(e, slots, pinRunes);
    if (r === null) continue;
    if (r.skip) skipped.push({ name: e.name, reason: r.skip });
    else (e.kind === 'unique' ? uniques : socketables).push(r.entry);
  }
  return { schemaVersion: SIDECAR_SCHEMA, league, fetched, socketables, uniques, skipped };
}

/** The names a sidecar holds, socketables and uniques; [] when the file can't be read. */
export function sidecarNames(file) {
  try {
    const json = JSON.parse(fs.readFileSync(file, 'utf8'));
    return [...(json.socketables ?? []), ...(json.uniques ?? [])].map((x) => x?.name).filter((n) => typeof n === 'string');
  } catch {
    return [];
  }
}
