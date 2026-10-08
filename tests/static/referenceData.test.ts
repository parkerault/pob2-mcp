/**
 * WU-39 (C-35, D-168, D-204) static checks on the C1/E1 data files under `data/`:
 * - AC-P14: `life.by-level` and `damage.by-level` equal the tables parsed from the pinned `Data/Misc.lua:7`
 *   and `:9` at all 100 levels, and every `pob-data` source ref names a file (and lines) in the pinned
 *   `vendor/` tree.
 * - D-204: every `external` source ref is a URL the external-data grounding doc lists, under the source
 *   number its id names (`ext-s21` is the doc's S21).
 * - AC-P18 (D-168): no string fact value, note or source ref of 12 or more characters occurs inside a
 *   string literal of `src/**\/*.ts`, the literals extracted with the TypeScript compiler API as the
 *   PoE1-cruft scan does; and both waiver files stay empty (AC-B2).
 */
import fs from 'fs';
import os from 'os';
import path from 'path';
import ts from 'typescript';
import { describe, expect, it } from '@jest/globals';
import { loadReferenceData, type FactValue } from '../../src/plan/referenceData';

const REPO = path.resolve(__dirname, '..', '..');
const SRC = path.join(REPO, 'src');
const POB_SRC = path.join(REPO, 'vendor', 'PathOfBuilding-PoE2', 'src');
const GROUNDING = path.join(REPO, 'docs', 'design', 'grounding', '2026-10-07-external-game-data.md');
const ref = loadReferenceData(path.join(REPO, 'data'));

/** One table line of the pinned Misc.lua: `data.<name> = { v1, v2, ..., }`, as numbers. */
function miscTable(line: number, name: string): number[] {
  const text = fs.readFileSync(path.join(POB_SRC, 'Data', 'Misc.lua'), 'utf8').split('\n')[line - 1];
  const m = new RegExp(`^data\\.${name} = \\{ (.*?),? \\}\\s*$`).exec(text);
  if (!m) throw new Error(`Misc.lua:${line} isn't data.${name}`);
  return m[1].split(',').map((s) => Number(s.trim()));
}

/** Every string/template literal in a TypeScript file (the PoE1-cruft scan's extraction). */
function literals(fileName: string, text: string): string[] {
  const sf = ts.createSourceFile(fileName, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const out: string[] = [];
  const visit = (node: ts.Node): void => {
    if (
      ts.isStringLiteral(node) ||
      ts.isNoSubstitutionTemplateLiteral(node) ||
      ts.isTemplateHead(node) ||
      ts.isTemplateMiddle(node) ||
      ts.isTemplateTail(node)
    ) {
      out.push(node.text);
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return out;
}

function walkTs(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return walkTs(p);
    return e.name.endsWith('.ts') && !e.name.endsWith('.d.ts') ? [p] : [];
  });
}

/** The strings of a fact value: itself, a list's members or a record's string members. */
function valueStrings(v: FactValue): string[] {
  if (typeof v === 'string') return [v];
  if (Array.isArray(v)) return v;
  if (typeof v === 'object' && v !== null) return Object.values(v).filter((x): x is string => typeof x === 'string');
  return [];
}

/** Every string fact value, note and source ref in the loaded data, with where it is. */
function dataStrings(): Array<{ where: string; text: string }> {
  const out: Array<{ where: string; text: string }> = [];
  for (const [file, data] of ref.files) {
    data.sources.forEach((s, i) => out.push({ where: `${file} sources[${i}].ref`, text: s.ref }));
    for (const [id, f] of Object.entries(data.facts)) {
      for (const text of valueStrings(f.value)) out.push({ where: `${file}#${id} value`, text });
      if (f.note !== undefined) out.push({ where: `${file}#${id} note`, text: f.note });
    }
  }
  return out;
}

/** The grounding doc's source list: S-number -> the URLs it lists (prefixes and ranges expanded). */
function groundingUrls(): Map<number, Set<string>> {
  const md = fs.readFileSync(GROUNDING, 'utf8');
  const section = md.slice(md.search(/^## Sources/m));
  const prefixes: Record<string, string> = {
    'md/': 'https://maxroll.gg/poe2/',
    'g8/': 'https://game8.co/games/Path-of-Exile-2/archives/',
    'db/': 'https://poe2db.tw/us/',
  };
  const out = new Map<number, Set<string>>();
  for (const line of section.split('\n').filter((l) => l.startsWith('- **'))) {
    let origin = '';
    for (const segment of line.split(' · ')) {
      const m = /\bS(\d+)\b([\s\S]*)$/.exec(segment);
      if (!m) continue;
      const urls = out.get(Number(m[1])) ?? new Set<string>();
      for (const [, token] of m[2].matchAll(/`([^`]+)`/g)) {
        const prefix = Object.keys(prefixes).find((p) => token.startsWith(p));
        if (prefix) urls.add(prefixes[prefix] + token.slice(prefix.length));
        else if (token.startsWith('https://')) {
          urls.add(token);
          origin = new URL(token).origin;
        } else if (token.startsWith('…/') && origin) urls.add(origin + token.slice(1));
      }
      // "`db/Act_1` … `db/Act_4`" names the four act pages.
      const range = /`db\/Act_(\d)` … `db\/Act_(\d)`/.exec(m[2]);
      if (range) for (let n = Number(range[1]); n <= Number(range[2]); n++) urls.add(`${prefixes['db/']}Act_${n}`);
      out.set(Number(m[1]), urls);
    }
  }
  return out;
}

describe('AC-P14 (WU-39): the E1 monster tables are the pin\'s, and pob-data refs name pinned files', () => {
  const monsters = ref.files.get('enemies/map-monsters.json')!;

  const tables: Array<[string, number, string]> = [
    ['life.by-level', 7, 'monsterLifeTable'],
    ['damage.by-level', 9, 'monsterDamageTable'],
  ];
  it.each(tables)('AC-P14: %s equals Data/Misc.lua:%i (data.%s) at all 100 levels', (id, line, name) => {
    const table = miscTable(line, name);
    expect(table).toHaveLength(100);
    expect(table.every(Number.isFinite)).toBe(true);
    const fact = monsters.facts[id];
    expect(fact.value).toEqual(Object.fromEntries(table.map((v, i) => [String(i + 1), v])));
    expect(monsters.sources.find((s) => s.id === fact.source)).toMatchObject({ kind: 'pob-data', ref: `Data/Misc.lua:${line}` });
  });

  it('AC-P14: every pob-data source ref names a file that exists in the pinned vendor/ tree, and lines inside it', () => {
    const refs = [...ref.files.values()].flatMap((f) => f.sources).filter((s) => s.kind === 'pob-data').map((s) => s.ref);
    expect(refs.length).toBeGreaterThan(5);
    for (const r of refs) {
      const m = /^([\w/]+\.lua)(?::(\d+)(?:-(\d+))?)?$/.exec(r);
      expect({ ref: r, form: m !== null }).toEqual({ ref: r, form: true });
      const file = path.join(POB_SRC, m![1]);
      expect({ ref: r, exists: fs.existsSync(file) }).toEqual({ ref: r, exists: true });
      const count = fs.readFileSync(file, 'utf8').replace(/\n$/, '').split('\n').length;
      const last = Number(m![3] ?? m![2] ?? 1);
      expect({ ref: r, inside: Number(m![2] ?? 1) <= last && last <= count }).toEqual({ ref: r, inside: true });
    }
  });
});

describe('D-204 (WU-39): external sources are the grounding doc\'s', () => {
  const urls = groundingUrls();

  it('D-204: the grounding source list parses (self-check)', () => {
    expect(urls.get(21)).toEqual(new Set(['https://poe2db.tw/us/Waystones']));
    expect(urls.get(9)!.has('https://poe2db.tw/us/Act_3')).toBe(true);
    expect(urls.get(43)).toEqual(new Set(['https://www.poe-vault.com/poe2/warrior/titan/stampede-leveling-build']));
  });

  it('D-204: each data source is pob-data, external or judgment; each external ref is listed under the S-number its id names', () => {
    for (const [file, data] of ref.files) {
      for (const s of data.sources) {
        expect({ file, id: s.id, kind: ['pob-data', 'external', 'judgment'].includes(s.kind) }).toEqual({ file, id: s.id, kind: true });
        if (s.kind !== 'external') continue;
        const n = /^ext-s(\d+)(-|$)/.exec(s.id);
        expect({ file, id: s.id, named: n !== null }).toEqual({ file, id: s.id, named: true });
        expect({ file, id: s.id, listed: urls.get(Number(n![1]))?.has(s.ref) ?? false }).toEqual({ file, id: s.id, listed: true });
      }
    }
  });
});

describe('AC-P18 (WU-39, D-168): no C1/E1 string is a literal in src/', () => {
  function hits(srcRoot: string): string[] {
    const long = dataStrings().filter((s) => s.text.length >= 12);
    const found: string[] = [];
    for (const abs of walkTs(srcRoot)) {
      const lits = literals(abs, fs.readFileSync(abs, 'utf8'));
      for (const s of long) {
        if (lits.some((l) => l.includes(s.text))) found.push(`${path.relative(REPO, abs)}: ${s.where}: ${JSON.stringify(s.text)}`);
      }
    }
    return found;
  }

  it('AC-P18: the scan finds a planted fact value, note and source ref (self-check)', () => {
    const order = ref.files.get('campaign/progress.json')!.facts.order.value as string[];
    const note = ref.files.get('campaign/limits.json')!.facts['passive-points.max'].note!;
    const srcRef = ref.files.get('enemies/waystones.json')!.sources[0].ref;
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pob2-refscan-'));
    try {
      fs.writeFileSync(
        path.join(dir, 'planted.ts'),
        [
          `// ${order[1]} in a comment is not a literal`,
          `export const a = "next: ${order[1]}";`,
          `export const b = \`${note}\`;`,
          `export const c = '${srcRef}';`,
          `export const d = '${order[0]}';`, // under 12 characters: not checked
        ].join('\n'),
      );
      const found = new Set(hits(dir).map((h) => JSON.parse(h.slice(h.lastIndexOf(': ') + 2)) as string));
      expect(found).toEqual(new Set([order[1], note, srcRef]));
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('AC-P18: no string fact value, note or source ref of 12+ characters occurs inside a string literal of src/**/*.ts', () => {
    expect(dataStrings().filter((s) => s.text.length >= 12).length).toBeGreaterThan(100);
    expect(hits(SRC)).toEqual([]);
  });

  it('AC-P18, AC-B2: the tool-hygiene allowlist and the PoE1-cruft waivers are empty', () => {
    for (const rel of ['tests/fixtures/tool-hygiene-allowlist.json', 'tests/static/poe1-cruft-waivers.json']) {
      expect({ rel, entries: JSON.parse(fs.readFileSync(path.join(REPO, rel), 'utf8')) }).toEqual({ rel, entries: [] });
    }
  });
});
