/**
 * The file reader (D-517, C-62; amendment 16 §13): a player's PoB file read into a plan, engine-free.
 *
 * `plan_from_build` (the handler, `src/handlers/planFromBuildHandlers.ts`) decodes or reads the file, keeps it as
 * `source.xml` in the run folder and calls `readBuildIntoPlan`, which reads one loadout of the file into a schema-11
 * plan with one read stage (`f`, `progress: "endgame"`, no variant) and the `read.json` beside it (Appendix A.5, A.7).
 * Nothing here touches the engine: the file is parsed with read-back's parser (`parsePobXml`), node data comes from the
 * tree service's passive tree, and bases, gems and skills from the pin's own data files read as text
 * (`loadReaderGameData`), matched as PoB matches them.
 *
 * What it reads, and how each PoB gap is handled (§13):
 * - the tree: nodes split into `nodes` and `ascendancyNodes` by the tree data, the class and ascendancy starts left out
 *   (PoB allocates them itself); weapon-set tags; attribute choices; socketed jewels as owned tree jewels;
 * - items, as owned: each slot's text whole, its rolls from the text, or for an item with no `{range:` tag from its
 *   `<ModRange>` numbered as PoB's load numbers them (`Classes/ItemsTab.lua`:1108–1125); a slot the plan's slot list
 *   lacks, and an item on a base the pin lacks (PG-110), go to `left`, the latter with a `stand_in` question;
 * - PG-111: a text on a base the pin defines more than once, with differing implicits, and no `Implicits:` line is named;
 * - legacy gems and uniques PoB says are no longer obtainable are read, owned and named (D-384);
 * - PG-108: PoB's own granted groups aren't written; per granted skill the copy with the most enabled supports is kept,
 *   an unsupported one only when its level differs from PoB's group's, a granted group with supports added in desktop PoB
 *   when no plain copy has more; the kept copy takes its granting items' weapon set;
 * - PG-114: a granted skill's gem is written at quality 0, a file's other value named;
 * - PG-113: the main skill is a question; the file's value stands, unconfirmed, until it's answered;
 * - PG-107: `buffs_on` and `buffs_swap` answer the measure's Spirit question; the other Spirit buffs become switched,
 *   each with the `off` list `switch_off` gives it (the user's confirmed list from the measure's proposal, §14, §15);
 * - the configuration as set, in `config.file`, `enemyIsBoss` the scenario's one entry.
 */
import fs from 'fs';
import path from 'path';
import { ITEM_SLOTS, ACTIVATABLE_SLOTS } from '../server/toolSchemas.js';
import type { PassiveTreeData } from '../types.js';
import { assertPoe2BuildXml } from '../utils/buildCode.js';
import { loadoutsOf, parsePobXml, type PobFile, type PobGem, type PobGroup, type PobItemSet, type PobLoadout, type PobModRange } from './readBack.js';

// ---------------------------------------------------------------------------------------------------
// The pin's game data, read as text

export interface BaseInfo {
  name: string;
  type: string;
  subType?: string;
  /** The lines of the base's flask or charm `buff`, which PoB numbers first among an item's mod lines. */
  buffLines: number;
}

export interface GemInfo {
  id: string;
  name: string;
  gameId: string;
  variantId: string;
  skillId: string;
  support: boolean;
}

export interface SkillInfo {
  id: string;
  name: string;
  support: boolean;
  legacy: boolean;
  /** Whether it reserves Spirit: a level's `spiritReservationFlat` or `spiritReservationPercent`, or `HasReservation` not made free. */
  reservesSpirit: boolean;
}

export interface ReaderGameData {
  /** Base name → its last definition (PoB keeps the last, PG-111). */
  bases: Map<string, BaseInfo>;
  /** PG-111: the base names the data defines more than once with differing implicits. */
  doubleDefined: Set<string>;
  gemsByGameId: Map<string, GemInfo[]>;
  gemsBySkillId: Map<string, GemInfo>;
  /** Lowercased gem name → gem. */
  gemsByName: Map<string, GemInfo>;
  skills: Map<string, SkillInfo>;
  /** Lowercased unique name → whether PoB says it is no longer obtainable (its `Source:` or a Race Events league). */
  unobtainableUniques: Set<string>;
  /** The pin's passive tree versions, oldest first (`GameVersions.lua`'s `treeVersionList`). */
  treeVersions: string[];
  /** PoB's default for `enemyIsBoss` (`Modules/ConfigOptions.lua`). */
  enemyIsBossDefault: string;
}

const dataCache = new Map<string, ReaderGameData>();

const luaString = (body: string, key: string, indent: string): string | undefined => {
  const m = new RegExp(`^${indent}${key} = "((?:[^"\\\\]|\\\\.)*)"`, 'm').exec(body);
  return m === null ? undefined : m[1].replace(/\\(.)/g, '$1');
};

function readBases(src: string): { bases: Map<string, BaseInfo>; doubleDefined: Set<string> } {
  const dir = path.join(src, 'Data', 'Bases');
  const bases = new Map<string, BaseInfo>();
  const implicits = new Map<string, Set<string>>();
  const counts = new Map<string, number>();
  for (const file of fs.readdirSync(dir).filter((f) => f.endsWith('.lua')).sort()) {
    const text = fs.readFileSync(path.join(dir, file), 'utf8');
    for (const m of text.matchAll(/^itemBases\["((?:[^"\\]|\\.)*)"\] = \{\n([\s\S]*?)^\}/gm)) {
      const name = m[1].replace(/\\(.)/g, '$1');
      const body = m[2];
      const buff = /^\t(?:flask|charm) = \{.*\bbuff = \{([^}]*)\}/m.exec(body);
      bases.set(name, {
        name,
        type: luaString(body, 'type', '\\t') ?? '',
        ...(luaString(body, 'subType', '\\t') !== undefined ? { subType: luaString(body, 'subType', '\\t') } : {}),
        buffLines: buff === null ? 0 : (buff[1].match(/"(?:[^"\\]|\\.)*"/g) ?? []).length,
      });
      counts.set(name, (counts.get(name) ?? 0) + 1);
      if (!implicits.has(name)) implicits.set(name, new Set());
      implicits.get(name)!.add(luaString(body, 'implicit', '\\t') ?? '');
    }
  }
  const doubleDefined = new Set([...counts].filter(([name, n]) => n > 1 && (implicits.get(name)?.size ?? 0) > 1).map(([name]) => name));
  return { bases, doubleDefined };
}

function readGems(src: string): Pick<ReaderGameData, 'gemsByGameId' | 'gemsBySkillId' | 'gemsByName'> {
  const text = fs.readFileSync(path.join(src, 'Data', 'Gems.lua'), 'utf8');
  const gemsByGameId = new Map<string, GemInfo[]>();
  const gemsBySkillId = new Map<string, GemInfo>();
  const gemsByName = new Map<string, GemInfo>();
  for (const m of text.matchAll(/^\t\["((?:[^"\\]|\\.)*)"\] = \{\n([\s\S]*?)^\t\},?$/gm)) {
    const body = m[2];
    const gem: GemInfo = {
      id: m[1],
      name: luaString(body, 'name', '\\t\\t') ?? m[1],
      gameId: luaString(body, 'gameId', '\\t\\t') ?? '',
      variantId: luaString(body, 'variantId', '\\t\\t') ?? '',
      skillId: luaString(body, 'grantedEffectId', '\\t\\t') ?? '',
      support: /^\t\t\tsupport = true,/m.test(body) || luaString(body, 'gemType', '\\t\\t') === 'Support',
    };
    if (!gemsByGameId.has(gem.gameId)) gemsByGameId.set(gem.gameId, []);
    gemsByGameId.get(gem.gameId)!.push(gem);
    if (gem.skillId !== '' && !gemsBySkillId.has(gem.skillId)) gemsBySkillId.set(gem.skillId, gem);
    if (!gemsByName.has(gem.name.toLowerCase())) gemsByName.set(gem.name.toLowerCase(), gem);
  }
  return { gemsByGameId, gemsBySkillId, gemsByName };
}

function readSkills(src: string): Map<string, SkillInfo> {
  const dir = path.join(src, 'Data', 'Skills');
  const skills = new Map<string, SkillInfo>();
  for (const file of fs.readdirSync(dir).filter((f) => f.endsWith('.lua')).sort()) {
    const text = fs.readFileSync(path.join(dir, file), 'utf8');
    const starts = [...text.matchAll(/^skills\["((?:[^"\\]|\\.)*)"\] = \{$/gm)];
    starts.forEach((m, i) => {
      const body = text.slice(m.index ?? 0, i + 1 < starts.length ? starts[i + 1].index : text.length);
      skills.set(m[1], {
        id: m[1],
        name: luaString(body, 'name', '\\t') ?? m[1],
        support: /^\tsupport = true,/m.test(body),
        legacy: /^\tlegacy = true,/m.test(body),
        // A level's own Spirit cost, or a reserving skill (`HasReservation`) PoB doesn't make free (`reservationMultiplier =
        // -100`, a sceptre's Purity): Blasphemy reserves per socketed curse.
        reservesSpirit:
          /spiritReservation(?:Flat|Percent) = /.test(body) ||
          (/\[SkillType\.HasReservation\] = true/.test(body) && !/reservationMultiplier = -100,/.test(body)),
      });
    });
  }
  return skills;
}

function readUnobtainable(src: string): Set<string> {
  const dir = path.join(src, 'Data', 'Uniques');
  const out = new Set<string>();
  for (const file of fs.readdirSync(dir).filter((f) => f.endsWith('.lua'))) {
    const text = fs.readFileSync(path.join(dir, file), 'utf8');
    for (const m of text.matchAll(/\[\[\n([\s\S]*?)\]\]/g)) {
      const lines = m[1].split('\n');
      if (lines.some((l) => l === 'Source: No longer obtainable' || l === 'League: Race Events')) out.add(lines[0].trim().toLowerCase());
    }
  }
  return out;
}

/** The pin's game data the reader needs, read once per PoB source folder. */
export function loadReaderGameData(src: string): ReaderGameData {
  const cached = dataCache.get(src);
  if (cached !== undefined) return cached;
  const versions = /treeVersionList = \{([^}]*)\}/.exec(fs.readFileSync(path.join(src, 'GameVersions.lua'), 'utf8'));
  const treeVersions = versions === null ? [] : [...versions[1].matchAll(/"([^"]+)"/g)].map((m) => m[1]);
  let enemyIsBossDefault = 'Pinnacle';
  try {
    const options = fs.readFileSync(path.join(src, 'Modules', 'ConfigOptions.lua'), 'utf8');
    const line = /\{ var = "enemyIsBoss",[^\n]*/.exec(options)?.[0] ?? '';
    const index = Number(/defaultIndex = (\d+)/.exec(line)?.[1]);
    const vals = [...line.matchAll(/\{val="([^"]*)"/g)].map((m) => m[1]);
    if (Number.isInteger(index) && vals[index - 1] !== undefined) enemyIsBossDefault = vals[index - 1];
  } catch {
    // keep PoB's default as of the pin
  }
  const data: ReaderGameData = {
    ...readBases(src),
    ...readGems(src),
    skills: readSkills(src),
    unobtainableUniques: readUnobtainable(src),
    treeVersions,
    enemyIsBossDefault,
  };
  dataCache.set(src, data);
  return data;
}

// ---------------------------------------------------------------------------------------------------
// Items

/** An item's text read engine-free: its rarity, name, base and what it grants. */
export interface ItemRead {
  rarity: string;
  name: string;
  /** The base line as written (a rare's or unique's second line; a normal or magic item's name). */
  baseLine: string;
  /** The base PoB matches, or null when the pin lacks it (PG-110). */
  base: BaseInfo | null;
  hasImplicitsLine: boolean;
  quality: number;
  /** Each "Grants Skill:" line: the skill's name and its level (null when the line names none). */
  grants: Array<{ name: string; level: number | null }>;
}

const stripTags = (line: string): string => line.replace(/^(?:\{[^}]*\})+/, '');

/** A base name as PoB's `ParseRaw` matches it (`Classes/Item.lua`:781–818). */
function matchBase(rarity: string, name: string, baseLine: string, data: ReaderGameData): BaseInfo | null {
  const twoToned = (b: string) => (b === 'Two-Toned Boots' ? 'Two-Toned Boots (Armour/Energy Shield)' : b);
  if (rarity === 'NORMAL' || rarity === 'MAGIC') {
    if (data.bases.has(name)) return data.bases.get(name) ?? null;
    let best: string | null = null;
    for (const base of data.bases.keys()) if (name.includes(base) && (best === null || base.length > best.length)) best = base;
    if (best !== null) return data.bases.get(best) ?? null;
    if (name.includes('Two-Toned Boots')) return data.bases.get(twoToned('Two-Toned Boots')) ?? null;
    return data.bases.get(twoToned(name.replace(/^Superior /, ''))) ?? null;
  }
  return data.bases.get(twoToned(baseLine.replace(/^Superior /, ''))) ?? null;
}

export function readItem(lines: readonly string[], data: ReaderGameData): ItemRead {
  const rarityLine = /^Rarity: (.+)$/i.exec(lines[0] ?? '');
  const rarity = (rarityLine?.[1] ?? '').trim().toUpperCase();
  const body = rarityLine ? lines.slice(1) : [...lines];
  const name = body[0] ?? '';
  const twoLine = rarity === 'RARE' || rarity === 'UNIQUE' || rarity === 'RELIC';
  const baseLine = twoLine ? (body[1] ?? '') : name;
  const quality = Number(/^Quality: \+?(\d+)/.exec(lines.find((l) => /^Quality: /.test(l)) ?? '')?.[1] ?? 0);
  const grants = lines
    .map((l) => /^Grants Skill: (?:Level (\d+) )?(.+)$/.exec(stripTags(l)))
    .filter((m): m is RegExpExecArray => m !== null)
    .map((m) => ({ name: m[2].trim(), level: m[1] === undefined ? null : Number(m[1]) }));
  return {
    rarity,
    name,
    baseLine,
    base: matchBase(rarity, name, baseLine, data),
    hasImplicitsLine: lines.some((l) => /^Implicits: \d+$/.test(l)),
    quality,
    grants,
  };
}

/** The spec lines PoB reads before an item's mods (`Classes/Item.lua`, `ParseRaw`): never a mod line. */
const SPEC_NAMES = new Set([
  'Unique ID', 'Item Level', 'Requires Class', 'Class:', 'Charm Slots', 'Spirit', 'Quality', 'Sockets', 'Rune', 'Radius', 'Limited to',
  'Variant', 'Talisman Tier', 'Armour', 'Evasion Rating', 'Evasion', 'Energy Shield', 'Ward', 'Level', 'Requires Level', 'LevelReq',
  'Has Alt Variant', 'Has Alt Variant Two', 'Has Alt Variant Three', 'Has Alt Variant Four', 'Has Alt Variant Five', 'Selected Variant',
  'Selected Alt Variant', 'Selected Alt Variant Two', 'Selected Alt Variant Three', 'Selected Alt Variant Four',
  'Selected Alt Variant Five', 'Allow Duplicate Variants', 'Has Variants', 'Selected Variants', 'League', 'Crafted', 'Implicit',
  'Prefix', 'Suffix', 'Implicits', 'Unreleased', 'Upgrade', 'Source', 'Catalyst',
  'CatalystQuality', 'Note', 'Critical Hit Range', 'Attacks per Second', 'Weapon Range', 'Critical Hit Chance', 'Physical Damage',
  'Elemental Damage', 'Chaos Damage', 'Fire Damage', 'Cold Damage', 'Lightning Damage', 'Reload Time', 'Chance to Block',
  'Block chance', 'Requires',
]);
const NOT_MOD_LINES = new Set(['--------', 'Sanctified', 'Mirrored', 'Corrupted', 'Twice Corrupted', 'Desecrated Prefix', 'Desecrated Suffix', 'Requirements:', 'Unidentified']);

/**
 * An item's text with its `<ModRange>` rolls written into it as `{range:<r>}` tags, numbered as PoB's load numbers them
 * (`Classes/ItemsTab.lua`:1108–1125): the base's flask or charm buff lines first, then the enchant lines, the implicit
 * lines and the explicit lines; rune lines are skipped (PG-109's misnumbering, the load side as it is). Only a line with a
 * `(min-max)` range takes a tag; an item whose text already carries a `{range:` tag keeps its text (the rolls are there).
 */
export function withModRanges(lines: readonly string[], ranges: readonly PobModRange[] | undefined, item: ItemRead): string[] {
  if (ranges === undefined || ranges.length === 0 || lines.some((l) => l.includes('{range:'))) return [...lines];
  const out = [...lines];
  const skip = item.rarity === 'RARE' || item.rarity === 'UNIQUE' || item.rarity === 'RELIC' ? 3 : 2;
  const implicitsAt = lines.findIndex((l) => /^Implicits: \d+$/.test(l));
  const implicitCount = implicitsAt >= 0 ? Number(/\d+/.exec(lines[implicitsAt])?.[0]) : 0;
  const enchant: number[] = [];
  const implicit: number[] = [];
  const explicit: number[] = [];
  let inImplicitBlock = 0;
  for (let i = /^Rarity: /i.test(lines[0] ?? '') ? skip : skip - 1; i < lines.length; i++) {
    const line = lines[i];
    if (NOT_MOD_LINES.has(line) || /^\(.*\)$/.test(line) || /^Requires:? Level \d+/.test(line) || /^Requires Class /.test(line)) continue;
    const spec = /^([A-Za-z ()]+:?): (.+)$/.exec(line);
    if (spec !== null && SPEC_NAMES.has(spec[1])) continue;
    const flags = (/^((?:\{[^}]*\})*)/.exec(line)?.[1] ?? '') + (/ \((enchant|implicit|rune)\)$/.exec(line)?.[0] ?? '');
    const isRune = /\{rune\}|\(rune\)/.test(flags);
    const isEnchant = isRune || /\{enchant\}|\(enchant\)/.test(flags);
    const inBlock = implicitsAt >= 0 && i > implicitsAt && inImplicitBlock < implicitCount;
    if (inBlock) inImplicitBlock += 1;
    if (isRune) continue;
    if (isEnchant) enchant.push(i);
    else if (inBlock || /\{implicit\}|\(implicit\)/.test(flags)) implicit.push(i);
    else explicit.push(i);
  }
  const numbered = [...new Array<number>(item.base?.buffLines ?? 0).fill(-1), ...enchant, ...implicit, ...explicit];
  for (const r of ranges) {
    const at = numbered[r.id - 1];
    if (at === undefined || at < 0) continue;
    if (!/\(-?\d+(?:\.\d+)?--?\d+(?:\.\d+)?\)/.test(out[at])) continue;
    const tags = /^((?:\{[^}]*\})*)/.exec(out[at])?.[1] ?? '';
    out[at] = `${tags}{range:${Math.round(r.range * 1000) / 1000}}${out[at].slice(tags.length)}`;
  }
  return out;
}

// ---------------------------------------------------------------------------------------------------
// The read

/** A refused read: the handler returns it as an `isError` result, nothing written. */
export class ReadRefused extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ReadRefused';
  }
}

export type SourceKind = 'builds-folder' | 'import-code';

/** The answers of the second call (Appendix A.7); group numbers are the plan's. */
export interface ReadAnswers {
  loadout?: string;
  tree?: 'newest' | 'stop';
  main_group?: number;
  buffs_on?: number[];
  buffs_swap?: number[];
  /**
   * The coordinator's ruling for M-30 (WU-160's fix round), departing from Appendix A.7, whose input has no field for it:
   * by switched group, the plan's groups switched off for it, as the user confirmed them from the measure's proposed list
   * (§14 "`off` as the user confirms it", §15). Keys are plan group numbers.
   */
  switch_off?: Record<string, number[]>;
  stand_in?: Record<string, string>;
}

export interface ReadInput {
  xml: string;
  source: { kind: SourceKind; name?: string; sha1: string };
  answers: ReadAnswers;
  data: ReaderGameData;
  /** The passive tree of a version the pin holds (the tree service's). */
  tree: (version: string) => Promise<PassiveTreeData>;
  versions: { pobTag: string; pobCommit: string; enginePatch: string; externalPatch: string };
}

export interface ReadQuestion {
  field: string;
  planValue: unknown;
  fileValue: unknown;
  note: string;
  groups?: string[];
}

export interface ReadResult {
  /** The plan, or null when the tree question stops the read (an older tree, `tree` unanswered or `"stop"`). */
  plan: Record<string, unknown> | null;
  read: Record<string, unknown>;
  reply: { name: string; loadout: string; level: number; items: number; owned: number; groups: number; left: string[]; questions: string[] };
}

/** The read stage's id (Appendix A.5). */
export const READ_STAGE_ID = 'f';
/** What a switched buff's `when` says when the reader writes it (§14). */
export const SWITCH_AS_NEEDED = 'as needed';

const PLAIN_BASE = 'plain base';
const WEAPON_SET_OF: Record<string, 1 | 2> = { 'Weapon 1': 1, 'Weapon 2': 1, 'Weapon 1 Swap': 2, 'Weapon 2 Swap': 2 };
const isPlanSlot = (slot: string): boolean => (ITEM_SLOTS as readonly string[]).includes(slot);
const isActivatable = (slot: string): boolean => (ACTIVATABLE_SLOTS as readonly string[]).includes(slot);

const int = (v: string, fallback: number): number => (/^-?\d+$/.test(v.trim()) ? Number(v) : fallback);

/** The loadout's title without the server's ` (L<n>) {…}` suffix and with no brace left (`schema.ts`:614–622). */
export function cleanLoadoutTitle(title: string): string {
  const t = title.replace(/\s*(?:\(L\d+\)\s*)?\{[^{}]*\}\s*$/, '').replace(/[{}]/g, '').trim();
  return t === '' ? 'Default' : t;
}

/** A gem as PoB's `SkillsTab:LoadSkill` resolves it: by its game id and variant, else its skill id, else its name. */
interface GemRead {
  file: PobGem;
  name: string;
  skillId: string;
  support: boolean;
  known: boolean;
  enabled: boolean;
  level: number;
  quality: number;
  corruptLevel: number;
  legacy: boolean;
  reservesSpirit: boolean;
}

function readGem(g: PobGem, data: ReaderGameData): GemRead {
  let gem: GemInfo | undefined;
  if (g.gemId !== '') {
    const variants = data.gemsByGameId.get(g.gemId);
    gem = variants?.find((v) => v.variantId === g.variantId) ?? variants?.[0];
  }
  const skill = data.skills.get(gem?.skillId || g.skillId);
  if (gem === undefined && skill !== undefined) gem = data.gemsBySkillId.get(skill.id);
  if (gem === undefined && skill === undefined && g.nameSpec !== '') gem = data.gemsByName.get(g.nameSpec.toLowerCase());
  const effect = skill ?? data.skills.get(gem?.skillId ?? '');
  const name = gem?.name ?? effect?.name ?? (g.nameSpec || g.skillId || g.gemId || 'unnamed gem');
  return {
    file: g,
    name,
    skillId: gem?.skillId ?? effect?.id ?? g.skillId,
    support: gem?.support ?? effect?.support ?? /^Support/.test(g.skillId),
    known: gem !== undefined || effect !== undefined,
    // PoB: a gem with no `enabled` is on; otherwise only "true" is (`Classes/SkillsTab.lua`:342).
    enabled: g.enabledAttr === '' ? true : g.enabledAttr === 'true',
    level: Math.max(1, int(g.level, 1)),
    quality: Math.max(0, int(g.quality, 0)),
    corruptLevel: int(g.corruptLevel, 0),
    legacy: effect?.legacy === true,
    reservesSpirit: effect?.reservesSpirit === true && !(gem?.support ?? effect?.support ?? false),
  };
}

interface GroupRead {
  /** The group's place in the file's skill set, from 1 (as `mainSocketGroup` counts). */
  file: number;
  group: PobGroup;
  gems: GemRead[];
  enabled: boolean;
  /** The first non-support gem, which names a copy's skill (PG-108). */
  first: GemRead | undefined;
  supports: number;
}

/** A skill the stage's items or passives grant: its PoB groups' levels and the weapon sets of what grants it. */
interface Grant {
  name: string;
  levels: number[];
  /** 0 for a slot of both sets (or a passive), 1 or 2 for a weapon slot. */
  sets: Set<0 | 1 | 2>;
  sourceGroups: GroupRead[];
}

function groupReadOf(group: PobGroup, file: number, data: ReaderGameData): GroupRead {
  const gems = group.gems.map((g) => readGem(g, data));
  const enabled = group.enabledAttr === 'true' || group.activeAttr === 'true';
  return { file, group, gems, enabled, first: gems.find((g) => !g.support), supports: gems.filter((g) => g.support && g.enabled).length };
}

/** The loadout read: by its title, else the file's active one (PoB's active spec and sets). */
function chooseLoadout(file: PobFile, wanted: string | undefined): { loadout: PobLoadout; titles: string[] } {
  const loadouts = loadoutsOf(file);
  const titles = [...loadouts.keys()];
  if (wanted !== undefined) {
    const found = loadouts.get(wanted);
    if (found === undefined) throw new ReadRefused(`loadout "${wanted}" isn't a loadout of the file; its loadouts: ${titles.map((t) => `"${t}"`).join(', ') || 'none'}`);
    if (found.itemSet === null || found.skillSet === null) {
      throw new ReadRefused(`loadout "${wanted}" doesn't pair an item set and a skill set by PoB's rule; the file's loadouts: ${titles.map((t) => `"${t}"`).join(', ')}`);
    }
    return { loadout: found, titles };
  }
  const specIndex = int(file.active.spec, 1) - 1;
  const spec = file.specs[specIndex] ?? file.specs[0];
  if (spec === undefined) throw new ReadRefused('the file holds no passive tree (<Spec>)');
  const byId = <T extends { id: string }>(sets: readonly T[], id: string): T | null => sets.find((s) => s.id === id) ?? sets[0] ?? null;
  const itemSet = byId(file.itemSets, file.active.itemSet);
  const skillSet = byId(file.skillSets, file.active.skillSet);
  const configSet = byId(file.configSets, file.active.configSet);
  const paired = [...loadouts.values()].find(
    (l) => l.spec === spec && l.itemSet === itemSet && l.skillSet === skillSet && (l.configSet === configSet || configSet === null),
  );
  if (paired !== undefined) return { loadout: paired, titles };
  return { loadout: { title: spec.title, spec, itemSet, skillSet, configSet }, titles };
}

const listed = (xs: readonly string[]): string =>
  xs.length <= 2 ? xs.join(' and ') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`;

/**
 * Read one loadout of a PoB file into a schema-11 plan (D-517). Throws `ReadRefused` for a refusal of §13 (nothing is
 * written then); returns the plan (null when the tree question stops it), `read.json`'s content and the reply's parts.
 */
export async function readBuildIntoPlan(input: ReadInput): Promise<ReadResult> {
  const { data, answers } = input;
  let file: PobFile;
  try {
    assertPoe2BuildXml(input.xml);
    file = parsePobXml(input.xml);
  } catch (error) {
    throw new ReadRefused((error as Error).message);
  }

  const { loadout, titles } = chooseLoadout(file, answers.loadout);
  const fileVersion = loadout.spec.treeVersion;
  const newest = data.treeVersions[data.treeVersions.length - 1];
  if (fileVersion === '' || !data.treeVersions.includes(fileVersion)) {
    throw new ReadRefused(
      `the loadout's passive tree is version "${fileVersion || 'none'}", which the pin (trees ${data.treeVersions.join(', ')}) doesn't hold: ` +
        'nothing can measure it until the pin is upgraded',
    );
  }
  const older = fileVersion !== newest;
  const questions: ReadQuestion[] = [];
  const left: Array<Record<string, unknown>> = [];
  const level = Math.min(100, Math.max(1, int(file.build.level ?? '', 1)));
  const sourceName = input.source.kind === 'builds-folder' ? (input.source.name ?? 'the file') : 'the import code';
  const read: Record<string, unknown> = {
    source: { kind: input.source.kind, ...(input.source.name !== undefined ? { name: input.source.name } : {}), sha1: input.source.sha1, copy: 'source.xml' },
    treeVersion: fileVersion,
    loadouts: titles,
    loadout: loadout.title,
  };
  if (titles.length > 1 && answers.loadout === undefined) {
    questions.push({
      field: 'loadout',
      planValue: loadout.title,
      fileValue: loadout.title,
      note: `the file holds ${titles.length} loadouts; the active one is read`,
      groups: titles,
    });
  }
  if (older && answers.tree !== 'newest') {
    questions.push({
      field: 'tree',
      planValue: answers.tree === 'stop' ? 'stop' : null,
      fileValue: fileVersion,
      note: `the file's tree is version ${fileVersion}, older than the pin's newest ${newest}: "newest" reads it onto ${newest}, the nodes ${newest} lacks left out; "stop" stops`,
    });
    read.questions = questions;
    read.left = left;
    read.answers = answers;
    return {
      plan: null,
      read,
      reply: { name: sourceName, loadout: loadout.title, level, items: 0, owned: 0, groups: 0, left: [], questions: questions.map(questionLine) },
    };
  }

  const tree = await input.tree(newest);
  const oldTree = older ? await input.tree(fileVersion) : tree;
  const nodeOf = (id: number) => tree.nodes.get(String(id));

  // The tree (§13): the starts left out, ascendancy nodes apart, nodes the newest tree lacks to `left`.
  const nodes: number[] = [];
  const ascendancyNodes: number[] = [];
  for (const id of loadout.spec.nodes) {
    const node = nodeOf(id);
    if (node === undefined) {
      left.push({ node: id, name: oldTree.nodes.get(String(id))?.name ?? `node ${id}`, reason: `the pin's tree ${newest} has no node ${id}` });
      continue;
    }
    if (node.isClassStart || node.isAscendancyStart) continue;
    if (node.ascendancyName !== undefined) ascendancyNodes.push(id);
    else nodes.push(id);
  }
  const allocated = new Set(nodes);
  const set1 = loadout.spec.weaponSets.set1.filter((id) => allocated.has(id));
  const set2 = loadout.spec.weaponSets.set2.filter((id) => allocated.has(id) && !set1.includes(id));
  const attributeChoices = [...loadout.spec.attributes]
    .filter(([id]) => allocated.has(id))
    .sort(([a], [b]) => a - b)
    .map(([node, attribute]) => ({ node, attribute: attribute.toLowerCase() }));

  // Items, as owned (§13).
  const itemSet: PobItemSet = loadout.itemSet ?? { id: '', title: '', slots: new Map(), useSecondWeaponSet: false, active: new Map() };
  const legacy: Array<Record<string, unknown>> = [];
  const doubleDefined: Array<Record<string, unknown>> = [];
  const slots: Array<Record<string, unknown>> = [];
  const grantsBySlot: Array<{ slot: string; item: ItemRead }> = [];
  const standIns = answers.stand_in ?? {};
  const pendingStandIns = new Set<string>();
  const itemText = (id: string): { lines: string[]; item: ItemRead } | null => {
    const raw = file.items.get(id);
    if (raw === undefined) return null;
    const item = readItem(raw, data);
    return { lines: withModRanges(raw, file.modRanges.get(id), item), item };
  };
  const standIn = (slot: string, item: ItemRead, lines: string[]): string | null => {
    const given = standIns[slot];
    if (given === undefined) return null;
    if (given === PLAIN_BASE) {
      const plain = item.baseLine.replace(/^(?:Superior )?(?:Runeforged|Runemastered) /, '');
      if (plain === item.baseLine || !data.bases.has(plain)) {
        throw new ReadRefused(`stand_in "${slot}": "${item.baseLine}" has no plain base the pin holds; give the item's text instead`);
      }
      const at = lines.findIndex((l, i) => i > 0 && l === item.baseLine);
      return lines.map((l, i) => (i === at ? plain : l)).join('\n');
    }
    const typed = given.split(/\r?\n/).map((l) => l.trim()).filter((l) => l !== '');
    if (readItem(typed, data).base === null) throw new ReadRefused(`stand_in "${slot}": the text's base isn't in the pin either; give an item on a base the pin holds, or "${PLAIN_BASE}"`);
    return typed.join('\n');
  };
  const checkLegacyUnique = (item: ItemRead, where: string) => {
    if ((item.rarity === 'UNIQUE' || item.rarity === 'RELIC') && data.unobtainableUniques.has(item.name.toLowerCase())) {
      legacy.push({ kind: 'unique', name: item.name, where, reason: 'PoB says it is no longer obtainable (D-384): kept owned, as the character has it' });
    }
  };
  for (const [slot, id] of itemSet.slots) {
    const found = itemText(id);
    if (found === null) {
      left.push({ slot, reason: `the item set names item ${id}, which the file doesn't hold` });
      continue;
    }
    const text = found.lines.join('\n');
    if (!isPlanSlot(slot)) {
      left.push({ slot, text, reason: `the plan has no ${slot} slot` });
      continue;
    }
    if (found.item.base === null) {
      const replaced = standIn(slot, found.item, found.lines);
      if (replaced === null) {
        left.push({ slot, text, reason: `base ${found.item.baseLine || found.item.name} isn't in the pin (PG-110)` });
        pendingStandIns.add(slot);
        continue;
      }
      slots.push({ slot, text: replaced, owned: true, standIn: true });
      grantsBySlot.push({ slot, item: readItem(replaced.split('\n'), data) });
      continue;
    }
    if (data.doubleDefined.has(found.item.base.name) && !found.item.hasImplicitsLine) {
      doubleDefined.push({ slot, base: found.item.base.name, reason: 'the pin defines this base more than once and keeps the last; the text has no Implicits: line (PG-111)' });
    }
    checkLegacyUnique(found.item, slot);
    slots.push({ slot, text, owned: true });
    grantsBySlot.push({ slot, item: found.item });
  }
  const treeJewels: Array<Record<string, unknown>> = [];
  const allocatedAny = new Set([...nodes, ...ascendancyNodes]);
  const lackedNodes = new Set(loadout.spec.nodes.filter((id) => nodeOf(id) === undefined));
  for (const [node, id] of loadout.spec.sockets) {
    const found = itemText(id);
    if (found === null) continue;
    const where = `Jewel ${node}`;
    if (lackedNodes.has(node)) {
      // An older tree's socket the newest tree lacks: the jewel can't sit there, so it is named, never dropped silently.
      left.push({ slot: where, text: found.lines.join('\n'), reason: `its socket, node ${node}, isn't in the pin's tree ${newest}` });
      continue;
    }
    // A jewel in a socket the tree doesn't allocate does nothing in PoB.
    if (!allocatedAny.has(node)) continue;
    if (found.item.base === null) {
      const replaced = standIn(where, found.item, found.lines);
      if (replaced === null) {
        left.push({ slot: where, text: found.lines.join('\n'), reason: `base ${found.item.baseLine || found.item.name} isn't in the pin (PG-110)` });
        pendingStandIns.add(where);
        continue;
      }
      treeJewels.push({ node, text: replaced, owned: true, standIn: true });
      continue;
    }
    checkLegacyUnique(found.item, where);
    treeJewels.push({ node, text: found.lines.join('\n'), owned: true });
  }
  for (const slot of Object.keys(standIns)) {
    const stood = slots.some((s) => s.slot === slot && s.standIn === true) || treeJewels.some((j) => `Jewel ${j.node}` === slot && j.standIn === true);
    if (!pendingStandIns.has(slot) && !stood) {
      throw new ReadRefused(`stand_in names "${slot}", which holds no item on a base the pin lacks; the slots that do: ${[...pendingStandIns].join(', ') || 'none'}`);
    }
  }
  const toggles = slots
    .filter((s) => isActivatable(String(s.slot)))
    .map((s) => (itemSet.active.get(String(s.slot)) ? { slot: s.slot, active: true, uptime: 'as the file has it' } : { slot: s.slot, active: false }));

  // The skill groups (§13): PoB's granted groups not written, the copies by PG-108's rules.
  const groupsRead = (loadout.skillSet?.groups ?? []).map((g, i) => groupReadOf(g, i + 1, data));
  const grants = new Map<string, Grant>();
  const grant = (name: string): Grant => {
    const key = name.toLowerCase();
    if (!grants.has(key)) grants.set(key, { name, levels: [], sets: new Set(), sourceGroups: [] });
    return grants.get(key)!;
  };
  const slotOfItem = new Map<string, string[]>();
  for (const [slot, id] of itemSet.slots) slotOfItem.set(id, [...(slotOfItem.get(id) ?? []), slot]);
  for (const { slot, item } of grantsBySlot) {
    for (const g of item.grants) {
      const entry = grant(g.name);
      entry.sets.add(WEAPON_SET_OF[slot] ?? 0);
      if (g.level !== null) entry.levels.push(g.level);
    }
  }
  for (const id of allocatedAny) {
    for (const stat of nodeOf(id)?.stats ?? []) {
      const m = /^Grants Skill: (?:Level (\d+) )?(.+)$/.exec(stat);
      if (m === null) continue;
      const entry = grant(m[2].trim());
      entry.sets.add(0);
      if (m[1] !== undefined) entry.levels.push(Number(m[1]));
    }
  }
  for (const g of groupsRead) {
    if (g.group.source === '' || g.first === undefined) continue;
    const item = /^Item:(\d+):/.exec(g.group.source);
    const node = /^Tree:(\d+)$/.exec(g.group.source);
    const live = item !== null ? slotOfItem.has(item[1]) && grantsBySlot.some((s) => itemSet.slots.get(s.slot) === item[1]) : node !== null && allocatedAny.has(Number(node[1]));
    if (!live) continue;
    const entry = grant(g.first.name);
    if (item !== null) for (const slot of slotOfItem.get(item[1]) ?? []) entry.sets.add(WEAPON_SET_OF[slot] ?? 0);
    else entry.sets.add(0);
    entry.levels.unshift(g.first.level);
    entry.sourceGroups.push(g);
  }
  const grantOf = (gem: GemRead | undefined): Grant | undefined => (gem === undefined ? undefined : grants.get(gem.name.toLowerCase()));

  const dropped: Array<Record<string, unknown>> = [];
  const levels: Array<Record<string, unknown>> = [];
  const kept = new Map<GroupRead, Grant>();
  const plainGroups = groupsRead.filter((g) => g.group.source === '');
  for (const entry of grants.values()) {
    const copies = plainGroups.filter((g) => grantOf(g.first) === entry);
    const supported = entry.sourceGroups.filter((g) => g.supports > 0);
    let best: GroupRead | undefined = copies.reduce<GroupRead | undefined>((b, g) => (b === undefined || g.supports > b.supports ? g : b), undefined);
    const desktop = supported.reduce<GroupRead | undefined>((b, g) => (b === undefined || g.supports > b.supports ? g : b), undefined);
    if (desktop !== undefined && (best === undefined || desktop.supports >= best.supports)) best = desktop;
    const pobLevel = entry.levels[0] ?? null;
    for (const g of copies) {
      if (g === best) continue;
      dropped.push({ fileGroup: g.file, skill: entry.name, reason: `a copy of a granted skill with ${g.supports} enabled support${g.supports === 1 ? '' : 's'}; the kept copy is the file's group ${best?.file} (PG-108)` });
    }
    if (best === undefined) continue;
    if (best.group.source === '' && best.supports === 0) {
      // Dropped when its level is PoB's group's; kept, both levels named, when it differs or PoB's is unknown (no group).
      if (pobLevel !== null && entry.levels.includes(best.first!.level)) {
        dropped.push({ fileGroup: best.file, skill: entry.name, reason: `a copy of a granted skill with no support, at its group's level ${best.first!.level} (PG-108)` });
        continue;
      }
      levels.push({ skill: entry.name, copy: best.first!.level, granted: pobLevel });
    }
    kept.set(best, entry);
  }
  dropped.sort((a, b) => Number(a.fileGroup) - Number(b.fileGroup));

  // The plan's groups, in the file's order.
  const planGroups: Array<Record<string, unknown>> = [];
  const groupMap: Array<{ plan: number; file: number }> = [];
  const planOf = new Map<GroupRead, number>();
  const grantedQuality: Array<Record<string, unknown>> = [];
  const corruptLevels: Array<Record<string, unknown>> = [];
  const pendingGems: string[] = [];
  for (const g of groupsRead) {
    const keptGrant = kept.get(g);
    if (g.group.source !== '' && keptGrant === undefined) continue;
    if (g.group.source === '' && grantOf(g.first) !== undefined && keptGrant === undefined) continue;
    const planNumber = planGroups.length + 1;
    const gems: Array<Record<string, unknown>> = [];
    const notes = { quality: [] as Array<Record<string, unknown>>, corrupt: [] as Array<Record<string, unknown>>, legacy: [] as Array<Record<string, unknown>> };
    const unknown: GemRead[] = [];
    for (const gem of g.gems) {
      if (!gem.known) {
        unknown.push(gem);
        continue;
      }
      let quality = gem.quality;
      if (!gem.support && grants.has(gem.name.toLowerCase())) {
        if (quality !== 0) notes.quality.push({ plan: planNumber, file: g.file, skill: gem.name, fileQuality: quality, reason: 'a granted skill has no quality of its own (PG-114, §8): written at 0' });
        quality = 0;
      }
      const out: Record<string, unknown> = { name: gem.name, level: gem.level, quality, enabled: gem.enabled };
      if (gem.corruptLevel === 1) out.corrupt = 'plus_one_level';
      else if (gem.corruptLevel !== 0) {
        out.level = Math.max(1, gem.level + gem.corruptLevel);
        notes.corrupt.push({ plan: planNumber, gem: gem.name, corruptLevel: gem.corruptLevel, level: out.level });
      }
      if (gem.legacy) notes.legacy.push({ kind: 'gem', name: gem.name, where: `plan group ${planNumber}`, reason: 'PoB marks it legacy (D-384): kept owned, as the character has it' });
      gems.push(out);
    }
    if (!g.gems.some((x) => x.known && !x.support)) {
      left.push({ fileGroup: g.file, reason: `the group holds no active gem the pin has (PG-110): ${g.gems.map((x) => x.name).join(', ')}` });
      continue;
    }
    for (const gem of unknown) {
      left.push({ fileGroup: g.file, gem: gem.name, reason: `the pin has no gem ${gem.name} (PG-110)` });
      pendingGems.push(`${gem.name} (the file's group ${g.file})`);
    }
    grantedQuality.push(...notes.quality);
    corruptLevels.push(...notes.corrupt);
    legacy.push(...notes.legacy);
    const group: Record<string, unknown> = {};
    if (g.group.label.trim() !== '') group.label = g.group.label.trim();
    group.enabled = g.enabled;
    group.role = 'utility';
    group.gems = gems;
    const count = int(g.group.groupCount, 0);
    if (count >= 1) {
      group.count = count;
      group.countReason = 'from the file';
    }
    let sets: Set<0 | 1 | 2>;
    if (keptGrant !== undefined) sets = keptGrant.sets;
    else sets = new Set([WEAPON_SET_OF[g.group.slot] ?? 0]);
    if (sets.size === 1 && !sets.has(0)) group.weaponSet = [...sets][0];
    group.owned = true;
    planGroups.push(group);
    planOf.set(g, planNumber);
    groupMap.push({ plan: planNumber, file: g.file });
  }
  if (planGroups.length === 0) throw new ReadRefused(`loadout "${loadout.title}" holds no skill group the plan can hold`);

  // PG-113: the main skill, the file's value until it's answered.
  const fileMain = int(file.build.mainSocketGroup ?? '', 0);
  const mainRead = groupsRead[fileMain - 1];
  let planMain: number;
  let mainNote = "PoB's choice, possibly its guess";
  if (mainRead !== undefined && planOf.has(mainRead)) planMain = planOf.get(mainRead)!;
  else {
    const same = mainRead?.first === undefined ? undefined : [...planOf].find(([g]) => g.first?.name === mainRead.first?.name);
    planMain = same?.[1] ?? 1;
    mainNote =
      mainRead === undefined
        ? 'the file names no main group; the plan takes its first group'
        : `${mainNote}; the file's group ${fileMain} is ${mainRead.group.source !== '' ? "one of PoB's granted groups" : 'a dropped copy'}${same !== undefined ? `, so the plan takes the kept copy of ${same[0].first?.name}` : ''}`;
  }
  const checkGroup = (n: unknown, field: string) => {
    if (!Number.isInteger(n) || (n as number) < 1 || (n as number) > planGroups.length) {
      throw new ReadRefused(`${field} names group ${String(n)}, which the plan lacks: its groups are 1 to ${planGroups.length}`);
    }
  };
  if (answers.main_group !== undefined) {
    checkGroup(answers.main_group, 'main_group');
    planMain = answers.main_group;
  }
  const mainGroupRead = [...planOf].find(([, n]) => n === planMain)![0];
  const actives = (mainGroupRead.gems.filter((x) => !x.support && x.known));
  const activeSkill = Math.min(Math.max(1, int(mainGroupRead.group.mainActiveSkill, 1)), Math.max(1, actives.length));
  const rolled = actives[activeSkill - 1]?.name ?? actives[0]?.name ?? String((planGroups[planMain - 1].gems as Array<{ name: string }>)[0].name);
  planGroups[planMain - 1].role = 'single_target';
  const groupLabel = (n: number) => {
    const g = [...planOf].find(([, k]) => k === n)![0];
    const names = g.gems.filter((x) => !x.support && x.known).map((x) => x.name);
    const which = names.length > 1 ? ` (mainActiveSkill ${int(g.group.mainActiveSkill, 1)}: ${names[Math.min(names.length, Math.max(1, int(g.group.mainActiveSkill, 1))) - 1]})` : '';
    return `${n} ${names.join(', ')}${which}${g.enabled ? '' : ' (off)'}`;
  };
  if (answers.main_group === undefined) {
    questions.push({
      field: 'main_group',
      planValue: planMain,
      fileValue: fileMain || null,
      note: mainNote,
      groups: planGroups.map((_, i) => i + 1).filter((n) => planGroups[n - 1].enabled === true).map(groupLabel),
    });
  }

  // PG-107: the Spirit question's answer, the other Spirit buffs switched as needed (§14).
  if (answers.buffs_on !== undefined || answers.buffs_swap !== undefined) {
    const on = answers.buffs_on ?? [];
    const swap = answers.buffs_swap ?? [];
    for (const n of on) checkGroup(n, 'buffs_on');
    for (const n of swap) checkGroup(n, 'buffs_swap');
    const both = on.filter((n) => swap.includes(n));
    if (both.length > 0) throw new ReadRefused(`group ${both.join(', ')} is in both buffs_on and buffs_swap: a buff stays on or moves to the other weapon set`);
    const otherSet = itemSet.useSecondWeaponSet ? 1 : 2;
    const switched: number[] = [];
    for (const [g, n] of planOf) {
      const group = planGroups[n - 1];
      if (swap.includes(n)) {
        group.weaponSet = otherSet;
        continue;
      }
      if (on.includes(n) || n === planMain || group.enabled !== true) continue;
      if (!g.gems.some((x) => x.reservesSpirit && x.enabled)) continue;
      switched.push(n);
    }
    const offs = answers.switch_off ?? {};
    for (const [key, off] of Object.entries(offs)) {
      const n = Number(key);
      if (!switched.includes(n)) {
        throw new ReadRefused(
          `switch_off names group ${key}, which isn't switched: the switched Spirit buffs, neither kept on nor swapped, are ${switched.join(', ') || 'none'}`,
        );
      }
      for (const k of off) {
        if (k === n) throw new ReadRefused(`switch_off's group ${n} lists itself; off lists the groups switched off for it (D-518)`);
        checkGroup(k, `switch_off's group ${n}`);
      }
    }
    for (const n of switched) {
      planGroups[n - 1].enabled = false;
      planGroups[n - 1].switch = { when: SWITCH_AS_NEEDED, off: [...(offs[String(n)] ?? [])] };
    }
  } else if (answers.switch_off !== undefined && Object.keys(answers.switch_off).length > 0) {
    throw new ReadRefused('switch_off names groups, but no group is switched: buffs_on or buffs_swap answers the Spirit question first');
  }

  // The configuration as set (the user's answer 4).
  const configFile: Record<string, string | number | boolean> = {};
  for (const [k, v] of loadout.configSet?.typed ?? []) configFile[k] = v;
  const bossValue = typeof configFile.enemyIsBoss === 'string' ? configFile.enemyIsBoss : data.enemyIsBossDefault;

  const className = file.build.className ?? '';
  const ascendancy = file.build.ascendClassName ?? '';
  if (className === '') throw new ReadRefused('the file\'s <Build> names no class');
  const stage = {
    id: READ_STAGE_ID,
    loadoutName: `${cleanLoadoutTitle(loadout.title)} (L${level}) {${READ_STAGE_ID}}`,
    level,
    progress: 'endgame',
    source: {
      kind: input.source.kind,
      ...(input.source.name !== undefined ? { name: input.source.name } : {}),
      sha1: input.source.sha1,
      loadout: loadout.title,
    },
    tree: { nodes, ascendancyNodes, weaponSetNodes: { set1, set2 }, attributeChoices },
    items: { slots, treeJewels, toggles, useSecondWeaponSet: itemSet.useSecondWeaponSet },
    skills: { groups: planGroups, main: { group: planMain, activeSkill }, rolledGroup: planMain },
    config: {
      earned: [],
      scenario: [
        {
          option: 'enemyIsBoss',
          value: bossValue,
          source: { file: 'source.xml', key: 'enemyIsBoss' },
          tag: {
            kind: 'judgment',
            ref: typeof configFile.enemyIsBoss === 'string' ? "the file's enemyIsBoss input, as its owner set it" : "PoB's default: the file doesn't set enemyIsBoss",
            confidence: 'M',
          },
        },
      ],
      file: configFile,
    },
    claims: [],
  };
  const plan = {
    schemaVersion: 11,
    roll: { className, ascendancy: ascendancy || 'None', skill: rolled },
    versions: { pobTag: input.versions.pobTag, pobCommit: input.versions.pobCommit, treeVersion: newest, enginePatch: input.versions.enginePatch, externalPatch: input.versions.externalPatch },
    league: null,
    stages: [stage],
    ledger: [],
    prices: [],
  };

  for (const slot of pendingStandIns) {
    const entry = left.find((l) => l.slot === slot);
    const item = readItem(String(entry?.text ?? '').split('\n'), data);
    const plain = item.baseLine.replace(/^(?:Superior )?(?:Runeforged|Runemastered) /, '');
    questions.push({
      field: `stand_in.${slot}`,
      planValue: null,
      fileValue: item.baseLine,
      note: `what ${slot} holds: an item text on a base the pin has${plain !== item.baseLine && data.bases.has(plain) ? `, or "${PLAIN_BASE}" (${plain}, losing what its base adds)` : ''}`,
    });
  }
  for (const gem of pendingGems) {
    questions.push({ field: 'gem', planValue: null, fileValue: gem, note: 'the pin has no such gem, so the plan leaves it out; no answer field: say what replaces it, or nothing' });
  }

  Object.assign(read, {
    groups: groupMap,
    left,
    dropped,
    levels,
    questions,
    notRead: ['notes', 'playerStats', 'characterHash', 'tradeWeights', 'timelessData', 'party'],
    partyFilled: file.partyFilled,
    ...(file.importInfo?.lastLeague !== undefined && file.importInfo.lastLeague !== '' ? { importLeague: file.importInfo.lastLeague } : {}),
    grantedQuality,
    legacy,
    doubleDefined,
    corruptLevels,
    unconfirmed: answers.main_group === undefined ? ['main_group'] : [],
    answers,
  });
  const leftLines = left.map((l) => {
    const what = l.slot ?? (l.node !== undefined ? `node ${l.node} (${l.name})` : l.gem !== undefined ? `${l.gem} in the file's group ${l.fileGroup}` : `the file's group ${l.fileGroup}`);
    return `- ${what}: ${l.reason}`;
  });
  const owned = slots.filter((s) => s.owned === true).length + treeJewels.length;
  return {
    plan,
    read,
    reply: {
      name: sourceName,
      loadout: loadout.title,
      level,
      items: slots.length + treeJewels.length,
      owned,
      groups: planGroups.length,
      left: leftLines,
      questions: questions.map(questionLine),
    },
  };
}

/** One question's reply line: its answer field, the plan's and the file's values, and its note. */
function questionLine(q: ReadQuestion): string {
  const show = (v: unknown) => (v === null || v === undefined ? 'none' : typeof v === 'string' ? `"${v}"` : String(v));
  const values =
    q.field === 'main_group'
      ? `plan group ${show(q.planValue)}, the file's group ${show(q.fileValue)}`
      : `plan ${show(q.planValue)}, file ${show(q.fileValue)}`;
  return `- ${q.field}: ${values}; ${q.note}${q.groups !== undefined && q.groups.length > 0 ? ` (${listed(q.groups)})` : ''}`;
}

/** The reply's text (Appendix A.7): the summary line, then `Left out:` and `Questions:` lines. */
export function readReplyText(result: ReadResult, runFolder: string): string {
  const r = result.reply;
  const lines: string[] = [];
  if (result.plan === null) {
    lines.push(`Read ${r.name} (${r.loadout}) into ${runFolder}: no plan.json yet; the tree question comes first.`);
  } else {
    lines.push(
      `Read ${r.name} (${r.loadout}) into ${runFolder}/plan.json: stage ${READ_STAGE_ID}, level ${r.level}, ${r.items} item${r.items === 1 ? '' : 's'} (${r.owned} owned), ${r.groups} group${r.groups === 1 ? '' : 's'}.`,
    );
  }
  if (r.left.length > 0) lines.push('Left out:', ...r.left);
  if (r.questions.length > 0) lines.push('Questions:', ...r.questions);
  return lines.join('\n');
}
