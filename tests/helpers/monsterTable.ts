/**
 * WU-86 (D-402, AC-W72): reads a rare monster modifier table in the form `data/monsters/monster-mods.md` holds, and
 * checks each block's fields against the amendment: its id, kind, lines, URL, keep flag, model, reach, and Creates and
 * Pays off on in the vocabulary of `data/rules/vocabulary.md`. The unit test reads the script's output on fixtures with
 * it, the static test the committed table.
 */
import fs from 'fs';

export interface MonsterBlock {
  name: string;
  /** Each `- Key: value` field, a wrapped value joined with single spaces. */
  fields: Map<string, string>;
  /**
   * The `- Lines:` items as written: `"<game text>"`, `internal stat id: <id> [<value>]`, or
   * `from the page text: "<PoB's wording>"`; empty when none.
   */
  lines: string[];
}

export interface MonsterTable {
  /** The text before `## Index`. */
  head: string;
  /** The `## Index` lines. */
  index: string[];
  blocks: MonsterBlock[];
}

const ID = /^[a-z0-9]+(-[a-z0-9]+)*$/;
export const MODELS = ['stats', 'condition', 'none'];
export const NO_LINES = 'none on the page (poe2db shows them only in a hover)';
export const NO_MAPPED_LINES = "none in PoB's wording (see Page text)";

export function parseMonsterTable(text: string): MonsterTable {
  const lines = text.split('\n');
  const indexAt = lines.indexOf('## Index');
  const modsAt = lines.indexOf('## Modifiers');
  if (indexAt < 0 || modsAt < indexAt) throw new Error('the table has no "## Index" then "## Modifiers"');
  const blocks: MonsterBlock[] = [];
  let block: MonsterBlock | null = null;
  let last: string | null = null;
  for (const line of lines.slice(modsAt + 1)) {
    if (line.startsWith('### ')) {
      block = { name: line.slice(4), fields: new Map(), lines: [] };
      blocks.push(block);
      last = null;
    } else if (!block || line === '') {
      continue;
    } else if (line.startsWith('- ')) {
      const m = /^- ([A-Z][\w ]*?): ?(.*)$/.exec(line);
      if (!m) throw new Error(`${block.name}: a field line isn't "- Key: value": ${line}`);
      block.fields.set(m[1], m[2]);
      last = m[1];
    } else if (line.startsWith('  - ') && last === 'Lines') {
      block.lines.push(line.slice(4));
    } else if (line.startsWith('  ') && last) {
      block.fields.set(last, `${block.fields.get(last)} ${line.trim()}`);
    } else {
      throw new Error(`${block.name}: a line outside the block form: ${line}`);
    }
  }
  return {
    head: lines.slice(0, indexAt).join('\n'),
    index: lines.slice(indexAt + 1, modsAt).filter((l) => l !== ''),
    blocks,
  };
}

/** The families `data/rules/vocabulary.md` defines: each backticked word on a `- ` line. */
export function readVocabulary(file: string): Set<string> {
  const words = new Set<string>();
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    if (!line.startsWith('- `')) continue;
    for (const m of line.matchAll(/`([a-z0-9-]+)`/g)) words.add(m[1]);
  }
  return words;
}

/** A Creates or Pays off on value: its families, or none. */
export function familiesOf(value: string): string[] {
  return value === 'none' ? [] : value.split(', ');
}

/** The block's Creates and Pays off on families. */
export function creates(block: MonsterBlock): { creates: string[]; pays: string[] } {
  const m = /^(.*) \| Pays off on: (.*)$/.exec(block.fields.get('Creates') ?? '');
  if (!m) return { creates: [], pays: [] };
  return { creates: familiesOf(m[1]), pays: familiesOf(m[2]) };
}

/** What is wrong with one block, in the amendment's terms (AC-W72); empty when it is whole. */
export function blockProblems(block: MonsterBlock, vocabulary: Set<string>): string[] {
  const p: string[] = [];
  const f = block.fields;
  const id = f.get('Id');
  if (!id || !ID.test(id)) p.push(`Id "${id}" isn't an entry id`);
  if (!f.get('Kind')) p.push('no Kind');
  const lines = f.get('Lines');
  if (lines === undefined) p.push('no Lines');
  else if (lines === '' && block.lines.length === 0) p.push('Lines has no items');
  else if (lines !== '' && lines !== NO_LINES && lines !== NO_MAPPED_LINES) p.push(`Lines "${lines}" is neither a list nor "${NO_LINES}"`);
  for (const l of block.lines) {
    if (!/^"[^"]+"$/.test(l) && !/^internal stat id: \S.*$/.test(l) && !/^from the page text: "[^"]+"$/.test(l)) {
      p.push(`a line isn't quoted game text, a marked internal stat id or a marked line from the page text: ${l}`);
    }
  }
  const pageText = f.get('Page text');
  if (pageText !== undefined && !/^".+"$/.test(pageText)) p.push(`Page text isn't quoted: ${pageText}`);
  if (lines === NO_MAPPED_LINES && pageText === undefined) p.push('Lines points to a Page text the block lacks');
  if (block.lines.some((l) => l.startsWith('from the page text:')) && pageText === undefined) p.push('lines from a page text the block lacks');
  if (!/^https:\/\/poe2db\.tw\/us\/\S+$/.test(f.get('URL') ?? '')) p.push(`URL "${f.get('URL')}" isn't a poe2db page`);
  if (!['yes', 'no'].includes(f.get('Tamed beast keeps it') ?? '')) p.push('no keep flag (yes or no)');
  const model = f.get('Model') ?? '';
  if (!MODELS.includes(model)) p.push(`Model "${model}" isn't stats, condition or none`);
  if (!f.get('Reach')) p.push('no Reach');
  if (model === 'condition' && !f.get('Config')) p.push('a condition without its Config option');
  const c = /^(.*) \| Pays off on: (.*)$/.exec(f.get('Creates') ?? '');
  if (!c) p.push('no "Creates: … | Pays off on: …" line');
  else {
    for (const [field, value] of [['Creates', c[1]], ['Pays off on', c[2]]]) {
      const words = familiesOf(value);
      if (value !== 'none' && words.length === 0) p.push(`${field} is empty`);
      for (const w of words) if (!vocabulary.has(w)) p.push(`${field} "${w}" isn't in the vocabulary`);
    }
  }
  return p;
}
