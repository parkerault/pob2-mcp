/**
 * D-402 (WU-87): the rare monster modifier table, `data/monsters/monster-mods.md`, as the plan validator and the
 * compiler read it.
 *
 * The table is WU-86's (written by `.claude/skills/build-guide/scripts/monster-mods.mjs`): after `## Modifiers`, one
 * block per modifier, an H3 `### <Name>` whose next line is `- Id: <id>`, then `- Key: value` fields (a value may wrap
 * onto lines indented by two spaces) and the `- Lines:` items. A plan's `companion.mods` names rows by id, and each row
 * says how a plan models the modifier on a tamed beast that keeps it (amendment 8, §4):
 * - `stats`: its lines go in as custom modifiers (D-293), each an estimate the record marks. Who it reaches decides the
 *   line's form (the row's `Reach`): `the beast` gives `Companions have <line>`, which PoB gives companion skills only
 *   (`Modules/ModParser.lua:1272-1273`), or PoB's wording for a companion where it can't parse that (`companionLine`);
 *   the beast's allies, "the player and minions", give the line as written for the
 *   player and `Minions have <line>` for the minions.
 * - `condition`: what it supplies is the config option its `Config` field names.
 * - `none`: PoB can't take it, and the plan adds nothing for it.
 *
 * A line a plan can write is the game's text (`"<text>"`) or PoB's wording of a page text or an internal stat id
 * (`from the page text: "<text>"`, `from the internal stat id: "<text>"`); `internal stat id: …` lines are the stat's
 * id, which no plan writes. The reader checks what the compile relies on: an id, a model, a known reach and a writable
 * line on every `stats` row, a config option on every `condition` row. A table that breaks one fails loudly, naming the
 * row.
 */
import fs from 'fs';
import path from 'path';

/** The table's path under `data/`. */
export const MONSTER_MODS_FILE = 'monsters/monster-mods.md';

export const MONSTER_MOD_MODELS = ['stats', 'condition', 'none'] as const;
export type MonsterModModel = (typeof MONSTER_MOD_MODELS)[number];

/** Who a `stats` row's lines reach, as the plan writes them: the companion alone, or its allies (the player and minions). */
export type MonsterModReach = 'companion' | 'allies';

export interface MonsterMod {
  id: string;
  name: string;
  model: MonsterModModel;
  /** The row's `Reach` field, as written. */
  reachText: string;
  /** On a `stats` row: who its lines reach. */
  reach?: MonsterModReach;
  /** The lines a plan can write (the game's text, or PoB's wording), without their quotes. */
  lines: string[];
  /** On a `condition` row: the PoB config option its `Config` field names. */
  option?: string;
  /** The row's `Tamed beast keeps it` flag. */
  keeps: boolean;
}

export interface MonsterModTable {
  /** The table's path relative to `data/`. */
  file: string;
  /** Every row, in table order. */
  mods: readonly MonsterMod[];
  /** A row by its id. */
  byId: ReadonlyMap<string, MonsterMod>;
}

/** An invalid table: one line per problem, each naming the row. */
export class MonsterModTableError extends Error {
  constructor(readonly errors: readonly string[]) {
    super(`invalid monster-modifier table (D-402):\n${errors.map((e) => `- ${e}`).join('\n')}`);
    this.name = 'MonsterModTableError';
  }
}

const ID_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const WRITABLE_LINE = /^(?:from the (?:page text|internal stat id): )?"([^"]+)"$/;

/** The reach of a `stats` row from its `Reach` field, or null for one the compile can't write. */
export function reachOf(reachText: string): MonsterModReach | null {
  if (/^the beast\b/.test(reachText)) return 'companion';
  if (/\bthe player and minions\b/.test(reachText)) return 'allies';
  return null;
}

interface RawBlock {
  name: string;
  fields: Map<string, string>;
  lines: string[];
}

function blocksOf(text: string, file: string): { blocks: RawBlock[]; errors: string[] } {
  const lines = text.split('\n');
  const start = lines.indexOf('## Modifiers');
  if (start < 0) return { blocks: [], errors: [`${file}: no "## Modifiers" section`] };
  const blocks: RawBlock[] = [];
  const errors: string[] = [];
  let block: RawBlock | null = null;
  let last: string | null = null;
  for (const line of lines.slice(start + 1)) {
    if (line.startsWith('## ')) break;
    if (line.startsWith('### ')) {
      block = { name: line.slice(4).trim(), fields: new Map(), lines: [] };
      blocks.push(block);
      last = null;
      continue;
    }
    if (block === null || line.trim() === '') continue;
    const field = /^- ([A-Z][\w ]*?): ?(.*)$/.exec(line);
    if (field) {
      block.fields.set(field[1], field[2]);
      last = field[1];
    } else if (line.startsWith('  - ') && last === 'Lines') {
      block.lines.push(line.slice(4));
    } else if (line.startsWith('  ') && last !== null) {
      block.fields.set(last, `${block.fields.get(last)} ${line.trim()}`);
    } else {
      errors.push(`${file}: ${block.name}: a line outside the block form: ${line}`);
    }
  }
  return { blocks, errors };
}

/** Parse the table's text; `file` names it in every error. Throws `MonsterModTableError` listing every problem. */
export function parseMonsterMods(text: string, file: string = MONSTER_MODS_FILE): MonsterModTable {
  const { blocks, errors } = blocksOf(text, file);
  const mods: MonsterMod[] = [];
  const byId = new Map<string, MonsterMod>();
  for (const b of blocks) {
    const where = `${file}: ${b.name}`;
    const id = b.fields.get('Id') ?? '';
    if (!ID_RE.test(id)) errors.push(`${where}: Id "${id}" isn't an entry id`);
    else if (byId.has(id)) errors.push(`${where}: Id "${id}" is already used by ${byId.get(id)!.name}`);
    const model = b.fields.get('Model') ?? '';
    if (!(MONSTER_MOD_MODELS as readonly string[]).includes(model)) errors.push(`${where}: Model "${model}" isn't stats, condition or none`);
    const reachText = b.fields.get('Reach') ?? '';
    const lines = b.lines.flatMap((l) => {
      const m = WRITABLE_LINE.exec(l);
      return m ? [m[1]] : [];
    });
    const mod: MonsterMod = {
      id,
      name: b.name,
      model: model as MonsterModModel,
      reachText,
      lines,
      keeps: b.fields.get('Tamed beast keeps it') === 'yes',
    };
    if (model === 'stats') {
      const reach = reachOf(reachText);
      if (reach === null) errors.push(`${where}: a stats row whose Reach "${reachText}" is neither the beast nor its allies (the player and minions)`);
      else mod.reach = reach;
      if (lines.length === 0) errors.push(`${where}: a stats row with no line a plan can write`);
    }
    if (model === 'condition') {
      const option = /^(\w+) \(".*"\)$/.exec(b.fields.get('Config') ?? '')?.[1];
      if (option === undefined) errors.push(`${where}: a condition row without its Config option`);
      else mod.option = option;
    }
    mods.push(mod);
    if (ID_RE.test(id) && !byId.has(id)) byId.set(id, mod);
  }
  if (blocks.length === 0 && errors.length === 0) errors.push(`${file}: no modifier blocks`);
  if (errors.length > 0) throw new MonsterModTableError(errors);
  return { file, mods, byId };
}

/** Load the table from `<dataDir>/monsters/monster-mods.md`. Throws `MonsterModTableError` when it is missing or invalid. */
export function loadMonsterMods(dataDir: string): MonsterModTable {
  const file = path.join(dataDir, ...MONSTER_MODS_FILE.split('/'));
  let text: string;
  try {
    text = fs.readFileSync(file, 'utf8');
  } catch (e) {
    throw new MonsterModTableError([`${MONSTER_MODS_FILE}: can't read ${file}: ${(e as Error).message}`]);
  }
  return parseMonsterMods(text);
}

/**
 * The beast's own lines PoB can't parse after `Companions have `, each with PoB's wording of it for a companion (WU-87):
 * "Skills fire 4 additional Projectiles" is PoB's projectile count, which it parses for a companion as
 * `Companions have 4 additional Projectiles`.
 */
const COMPANION_WORDING: readonly [RegExp, (m: RegExpExecArray) => string][] = [
  [/^Skills fire (\d+) additional Projectiles$/i, (m) => `Companions have ${m[1]} additional Projectiles`],
];

/** A line of the beast's own as the compile writes it: PoB's wording for a companion, else `Companions have <line>`. */
export function companionLine(line: string): string {
  for (const [re, word] of COMPANION_WORDING) {
    const m = re.exec(line);
    if (m) return word(m);
  }
  return `Companions have ${line}`;
}

/**
 * The custom-modifier lines a `stats` row writes (D-402): `Companions have <line>` for a modifier on the beast itself
 * (or PoB's wording for a companion, `companionLine`); for one that reaches its allies, the line as written (the player)
 * and `Minions have <line>` (the minions). None for any other row.
 */
export function companionLines(mod: MonsterMod): { text: string; reaches: 'companion' | 'player' | 'minions' }[] {
  if (mod.model !== 'stats') return [];
  if (mod.reach === 'companion') return mod.lines.map((l) => ({ text: companionLine(l), reaches: 'companion' as const }));
  return mod.lines.flatMap((l) => [
    { text: l, reaches: 'player' as const },
    { text: `Minions have ${l}`, reaches: 'minions' as const },
  ]);
}
