/**
 * `compile_plan`'s read-back (D-479, C-41): what the user changed in a PoB file the server wrote, read from the two
 * files' XML with no engine (the mode runs as engine kind `none`).
 *
 * - **Loadouts** are matched by the titles the compiler wrote (R-77): each tree spec titled `<name> {<ids>}` is a
 *   loadout per id, `<name> {<id>}`, with the item, skill and config set whose own `{…}` tag names that id (the only set
 *   of a kind when there is one), as PoB's `SyncLoadouts` (`Modules/Build.lua`:617–722) pairs them; a spec with no tag is
 *   a loadout of its own title, its sets those of the same title. A loadout in only one file, or one whose sets one file
 *   lacks, is listed in `unmatched`, never compared.
 * - **Per matched loadout:** items by slot (each line removed or added, as a multiset of the item text's lines, so a
 *   changed line is one of each), gems by group (removed, added, level, quality, enabled; groups matched in order by
 *   their label, else their first gem, and their slot), tree nodes (added, removed, ascendancy nodes apart, the jewels
 *   by socket as item lines, the attribute choices), and config (each `<Input>` changed, added or removed, by the
 *   option's label; the custom modifiers line by line). Every node is named from the passive tree of the spec's version,
 *   every config input by PoB's label (`Modules/ConfigOptions.lua`). Notes, PoB's computed `PlayerStat`s and config
 *   placeholders are never compared.
 * - `readback.json`'s shape is Appendix A's (`ReadBackFile`); only loadouts with a change are listed.
 *
 * It parses the XML with `fast-xml-parser`, as the build service does, so it lives here, not in `src/plan/`, whose modules
 * import no package but zod (AC-P12, D-170); the compiler's read-back mode (`readBackFile`) calls it.
 *
 * D-517 (amendment 16 §13): `plan_from_build`'s file reader (`fileReader.ts`) extends the same parser with what a player's
 * file needs and read-back reads none of: the `<Build>`'s attributes, the active sets, `<Import>`'s `lastLeague` and
 * `exportParty` (never its character hash), whether the party tab is filled, each `<Spec>`'s weapon-set tags, an item
 * set's `useSecondWeaponSet` and activation flags, a group's `source`, `mainActiveSkill` and `groupCount`, a gem's ids,
 * `count` and `corruptLevel`, each item's `<ModRange>` and each config input's type. Read-back's own fields are unchanged.
 */
import { XMLParser } from 'fast-xml-parser';

// ---------------------------------------------------------------------------------------------------
// The parsed file

export type AttributeName = 'Strength' | 'Dexterity' | 'Intelligence';

export interface PobSpec {
  title: string;
  treeVersion: string;
  nodes: number[];
  /** Tree jewel socket node → item id. */
  sockets: Map<number, string>;
  /** Attribute node → its chosen attribute (`<AttributeOverride>`). */
  attributes: Map<number, AttributeName>;
  /** D-517: the nodes tagged to weapon set 1 and 2 (`<WeaponSet1 nodes>`, `<WeaponSet2 nodes>`). */
  weaponSets: { set1: number[]; set2: number[] };
}

export interface PobSet {
  id: string;
  title: string;
}

export interface PobItemSet extends PobSet {
  /** Slot name → item id, for the slots that hold an item. */
  slots: Map<string, string>;
  /** D-517: the set's `useSecondWeaponSet`, true only for "true", as PoB reads it (`Classes/ItemsTab.lua`:1153). */
  useSecondWeaponSet: boolean;
  /** D-517: slot name → its `active` flag (a flask's or charm's activation), for the slots that hold an item. */
  active: Map<string, boolean>;
}

export interface PobGem {
  name: string;
  level: string;
  quality: string;
  enabled: boolean;
  /** D-517: the gem's attributes as written (`""` when absent): its ids, its name, `count`, `corruptLevel`, `enabled`. */
  skillId: string;
  gemId: string;
  variantId: string;
  nameSpec: string;
  count: string;
  corruptLevel: string;
  enabledAttr: string;
}

export interface PobGroup {
  label: string;
  slot: string;
  enabled: boolean;
  gems: PobGem[];
  /** D-517: the group's attributes as written (`""` when absent): PoB's `source` (a granted group), `mainActiveSkill`, `groupCount`, `enabled` and `active`. */
  source: string;
  mainActiveSkill: string;
  groupCount: string;
  enabledAttr: string;
  activeAttr: string;
}

export interface PobSkillSet extends PobSet {
  groups: PobGroup[];
}

export interface PobConfigSet extends PobSet {
  /** Input name → its value as written (`string`, `number` or `boolean`). */
  inputs: Map<string, string>;
  /** D-517: input name → its value typed as its attribute names it (a `number` input a number, a `boolean` one true or false). */
  typed: Map<string, string | number | boolean>;
}

/** D-517: one `<ModRange>` of an item, PoB's second copy of a roll: the mod line it numbers and the roll. */
export interface PobModRange {
  id: number;
  range: number;
}

export interface PobFile {
  specs: PobSpec[];
  /** Item id → the item text's lines, trimmed, without empty ones. */
  items: Map<string, string[]>;
  itemSets: PobItemSet[];
  skillSets: PobSkillSet[];
  configSets: PobConfigSet[];
  /** D-517: the `<Build>` element's attributes (class, ascendancy, level, `mainSocketGroup`, …). */
  build: Record<string, string>;
  /** D-517: the active spec (its 1-based place in `<Tree>`), item set, skill set and config set (their ids), as written. */
  active: { spec: string; itemSet: string; skillSet: string; configSet: string };
  /** D-517: `<Import>`'s `lastLeague` and `exportParty` when present; nothing else of it (never the character hash). */
  importInfo: { lastLeague?: string; exportParty?: string } | null;
  /** D-517: whether the party tab holds anything (a child of `<Party>`). */
  partyFilled: boolean;
  /** D-517: item id → its `<ModRange>` elements, in the file's order. */
  modRanges: Map<string, PobModRange[]>;
}

const ARRAYS = new Set([
  'Spec', 'Socket', 'AttributeOverride', 'Item', 'ItemSet', 'Slot', 'SkillSet', 'Skill', 'Gem', 'ConfigSet', 'Input', 'ModRange',
]);

type Node = Record<string, unknown>;

const asNodes = (v: unknown): Node[] => (Array.isArray(v) ? v.filter((x): x is Node => typeof x === 'object' && x !== null) : []);
const str = (v: unknown): string => (typeof v === 'string' ? v : typeof v === 'number' || typeof v === 'boolean' ? String(v) : '');
const child = (n: Node | undefined, key: string): Node | undefined => {
  const v = n?.[key];
  if (Array.isArray(v)) return asNodes(v)[0];
  return typeof v === 'object' && v !== null ? (v as Node) : undefined;
};

function idList(text: unknown): number[] {
  return str(text)
    .split(',')
    .map((s) => s.trim())
    .filter((s) => /^\d+$/.test(s))
    .map(Number);
}

/** An item's text lines: PoB writes them as the element's text, one per line, after leading tabs. */
function itemLines(item: Node): string[] {
  return str(item['#text'])
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l !== '');
}

/** Parse a PoB2 build file's XML (`<PathOfBuilding2>` or `<PathOfBuilding>`). Throws when it isn't one. */
export function parsePobXml(xml: string): PobFile {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '',
    parseAttributeValue: false,
    parseTagValue: false,
    trimValues: false,
    isArray: (name) => ARRAYS.has(name),
  });
  const doc = parser.parse(xml) as Node;
  const root = child(doc, 'PathOfBuilding2') ?? child(doc, 'PathOfBuilding');
  if (root === undefined) throw new Error('it is not a Path of Building build file (no <PathOfBuilding2> root)');

  const specs: PobSpec[] = asNodes(child(root, 'Tree')?.Spec).map((spec) => {
    const sockets = new Map<number, string>();
    for (const s of asNodes(child(spec, 'Sockets')?.Socket)) {
      const node = Number(str(s.nodeId));
      const item = str(s.itemId);
      if (Number.isInteger(node) && item !== '' && item !== '0') sockets.set(node, item);
    }
    const attributes = new Map<number, AttributeName>();
    for (const o of asNodes(child(spec, 'Overrides')?.AttributeOverride)) {
      for (const id of idList(o.strNodes)) attributes.set(id, 'Strength');
      for (const id of idList(o.dexNodes)) attributes.set(id, 'Dexterity');
      for (const id of idList(o.intNodes)) attributes.set(id, 'Intelligence');
    }
    const weaponSets = { set1: idList(child(spec, 'WeaponSet1')?.nodes), set2: idList(child(spec, 'WeaponSet2')?.nodes) };
    return { title: str(spec.title) || 'Default', treeVersion: str(spec.treeVersion), nodes: idList(spec.nodes), sockets, attributes, weaponSets };
  });

  const itemsNode = child(root, 'Items');
  const items = new Map<string, string[]>();
  const modRanges = new Map<string, PobModRange[]>();
  for (const item of asNodes(itemsNode?.Item)) {
    items.set(str(item.id), itemLines(item));
    const ranges = asNodes(item.ModRange)
      .map((r) => ({ id: Number(str(r.id)), range: Number(str(r.range)) }))
      .filter((r) => Number.isInteger(r.id) && Number.isFinite(r.range));
    if (ranges.length > 0) modRanges.set(str(item.id), ranges);
  }
  const itemSets: PobItemSet[] = asNodes(itemsNode?.ItemSet).map((set) => {
    const slots = new Map<string, string>();
    const active = new Map<string, boolean>();
    for (const slot of asNodes(set.Slot)) {
      const id = str(slot.itemId);
      if (id !== '' && id !== '0') {
        slots.set(str(slot.name), id);
        active.set(str(slot.name), str(slot.active) === 'true');
      }
    }
    return { id: str(set.id), title: str(set.title) || 'Default', slots, useSecondWeaponSet: str(set.useSecondWeaponSet) === 'true', active };
  });

  const skillsNode = child(root, 'Skills');
  const groupOf = (skill: Node): PobGroup => ({
    label: str(skill.label),
    slot: str(skill.slot),
    enabled: str(skill.enabled) !== 'false',
    gems: asNodes(skill.Gem).map((g) => ({
      name: str(g.nameSpec) || str(g.skillId) || str(g.gemId) || 'unnamed gem',
      level: str(g.level),
      quality: str(g.quality),
      enabled: str(g.enabled) !== 'false',
      skillId: str(g.skillId),
      gemId: str(g.gemId),
      variantId: str(g.variantId),
      nameSpec: str(g.nameSpec),
      count: str(g.count),
      corruptLevel: str(g.corruptLevel),
      enabledAttr: str(g.enabled),
    })),
    source: str(skill.source),
    mainActiveSkill: str(skill.mainActiveSkill),
    groupCount: str(skill.groupCount),
    enabledAttr: str(skill.enabled),
    activeAttr: str(skill.active),
  });
  let skillSets: PobSkillSet[] = asNodes(skillsNode?.SkillSet).map((set) => ({
    id: str(set.id),
    title: str(set.title) || 'Default',
    groups: asNodes(set.Skill).map(groupOf),
  }));
  // A file with no skill sets keeps its groups directly under <Skills>: one set.
  if (skillSets.length === 0 && skillsNode !== undefined) skillSets = [{ id: '1', title: 'Default', groups: asNodes(skillsNode.Skill).map(groupOf) }];

  const configNode = child(root, 'Config');
  const inputsOf = (n: Node): Map<string, string> => {
    const inputs = new Map<string, string>();
    for (const input of asNodes(n.Input)) {
      const value = input.string ?? input.number ?? input.boolean;
      inputs.set(str(input.name), str(value));
    }
    return inputs;
  };
  // D-517: each input typed as its attribute names it, as PoB's ConfigTab:Load reads it.
  const typedOf = (n: Node): Map<string, string | number | boolean> => {
    const typed = new Map<string, string | number | boolean>();
    for (const input of asNodes(n.Input)) {
      const name = str(input.name);
      if (name === '') continue;
      if (input.number !== undefined) {
        const v = Number(str(input.number));
        if (Number.isFinite(v)) typed.set(name, v);
      } else if (input.boolean !== undefined) typed.set(name, str(input.boolean) === 'true');
      else if (input.string !== undefined) typed.set(name, str(input.string));
    }
    return typed;
  };
  let configSets: PobConfigSet[] = asNodes(configNode?.ConfigSet).map((set) => ({
    id: str(set.id),
    title: str(set.title) || 'Default',
    inputs: inputsOf(set),
    typed: typedOf(set),
  }));
  if (configSets.length === 0 && configNode !== undefined) {
    configSets = [{ id: '1', title: 'Default', inputs: inputsOf(configNode), typed: typedOf(configNode) }];
  }

  // D-517: what the file reader needs of the rest of the file.
  const buildNode = child(root, 'Build');
  const build: Record<string, string> = {};
  for (const [k, v] of Object.entries(buildNode ?? {})) if (typeof v !== 'object') build[k] = str(v);
  const importNode = child(root, 'Import');
  const importInfo =
    importNode === undefined
      ? null
      : {
          ...(importNode.lastLeague !== undefined ? { lastLeague: str(importNode.lastLeague) } : {}),
          ...(importNode.exportParty !== undefined ? { exportParty: str(importNode.exportParty) } : {}),
        };
  const partyNode = child(root, 'Party');
  const partyFilled = partyNode !== undefined && Object.entries(partyNode).some(([k, v]) => typeof v === 'object' && v !== null && k !== '#text');
  const active = {
    spec: str(child(root, 'Tree')?.activeSpec),
    itemSet: str(itemsNode?.activeItemSet),
    skillSet: str(skillsNode?.activeSkillSet),
    configSet: str(configNode?.activeConfigSet),
  };

  return { specs, items, itemSets, skillSets, configSets, build, active, importInfo, partyFilled, modRanges };
}

// ---------------------------------------------------------------------------------------------------
// Loadouts (PoB's SyncLoadouts)

export interface PobLoadout {
  title: string;
  spec: PobSpec;
  itemSet: PobItemSet | null;
  skillSet: PobSkillSet | null;
  configSet: PobConfigSet | null;
}

/** A title's `{…}` tag: its ids (letters and digits, comma-separated, as PoB's `%{([%w,]+)%}`), and the title without it. */
function linkOf(title: string): { ids: string[]; name: string } | null {
  const m = /\{([A-Za-z0-9,]+)\}/.exec(title);
  if (!m) return null;
  const name = title.replace(m[0], '').trim() || 'Default';
  return { ids: m[1].split(',').filter((s) => s !== ''), name };
}

function setFor<T extends PobSet>(sets: readonly T[], id: string | null, title: string): T | null {
  if (sets.length === 1) return sets[0];
  if (id === null) return sets.find((s) => linkOf(s.title) === null && s.title === title) ?? null;
  return sets.find((s) => linkOf(s.title)?.ids.includes(id)) ?? null;
}

/** The file's loadouts, by title, as PoB lists them. */
export function loadoutsOf(file: PobFile): Map<string, PobLoadout> {
  const out = new Map<string, PobLoadout>();
  const add = (title: string, spec: PobSpec, id: string | null) => {
    if (out.has(title)) return;
    out.set(title, {
      title,
      spec,
      itemSet: setFor(file.itemSets, id, title),
      skillSet: setFor(file.skillSets, id, title),
      configSet: setFor(file.configSets, id, title),
    });
  };
  for (const spec of file.specs) {
    const link = linkOf(spec.title);
    if (link === null) add(spec.title, spec, null);
    else for (const id of link.ids) add(`${link.name} {${id}}`, spec, id);
  }
  return out;
}

// ---------------------------------------------------------------------------------------------------
// The comparison (Appendix A's readback.json)

export interface ReadBackItemChange {
  slot: string;
  removed: string[];
  added: string[];
}
export interface ReadBackGemChange {
  group: number;
  skill: string;
  changes: string[];
}
export interface ReadBackNode {
  id: number;
  name: string;
}
export interface ReadBackTree {
  added: ReadBackNode[];
  removed: ReadBackNode[];
  ascendancy: Array<ReadBackNode & { change: 'added' | 'removed' }>;
  jewels: Array<{ socket: number; name: string; removed: string[]; added: string[] }>;
  attributes: Array<ReadBackNode & { from: AttributeName | null; to: AttributeName | null }>;
}
export interface ReadBackConfigChange {
  input: string;
  label: string;
  from: string | null;
  to: string | null;
}
export interface ReadBackLoadout {
  title: string;
  items: ReadBackItemChange[];
  gems: ReadBackGemChange[];
  tree: ReadBackTree;
  config: ReadBackConfigChange[];
}
export interface ReadBackFile {
  file: string;
  base: string;
  baseSha1: string;
  loadouts: ReadBackLoadout[];
  unmatched: string[];
}

/** What the comparison names things with: the passive tree of a version, and PoB's config labels. */
export interface ReadBackNames {
  /** The tree's node with this id: its name and whether it is an ascendancy node; null when the tree lacks it. */
  node(treeVersion: string, id: number): { name: string; ascendancy: boolean } | null;
  /** PoB's label of a config input; its name when PoB gives none. */
  configLabel(input: string): string;
}

/** The multiset difference of two line lists: the lines only `a` has, and those only `b` has, each in its own order. */
export function lineDiff(a: readonly string[], b: readonly string[]): { removed: string[]; added: string[] } {
  const left = new Map<string, number>();
  for (const l of b) left.set(l, (left.get(l) ?? 0) + 1);
  const removed: string[] = [];
  for (const l of a) {
    const n = left.get(l) ?? 0;
    if (n > 0) left.set(l, n - 1);
    else removed.push(l);
  }
  const spare = new Map<string, number>();
  for (const l of a) spare.set(l, (spare.get(l) ?? 0) + 1);
  const added: string[] = [];
  for (const l of b) {
    const n = spare.get(l) ?? 0;
    if (n > 0) spare.set(l, n - 1);
    else added.push(l);
  }
  return { removed, added };
}

function compareItems(base: PobFile, edited: PobFile, a: PobItemSet, b: PobItemSet): ReadBackItemChange[] {
  const slots = [...a.slots.keys(), ...[...b.slots.keys()].filter((s) => !a.slots.has(s))];
  const out: ReadBackItemChange[] = [];
  for (const slot of slots) {
    const before = base.items.get(a.slots.get(slot) ?? '') ?? [];
    const after = edited.items.get(b.slots.get(slot) ?? '') ?? [];
    const diff = lineDiff(before, after);
    if (diff.removed.length > 0 || diff.added.length > 0) out.push({ slot, ...diff });
  }
  return out;
}

const groupKey = (g: PobGroup): string => `${g.label || g.gems[0]?.name || ''}\u0000${g.slot}`;
const groupSkill = (g: PobGroup): string => g.label || g.gems[0]?.name || 'unnamed group';

function compareGroups(a: PobSkillSet, b: PobSkillSet): ReadBackGemChange[] {
  const out: ReadBackGemChange[] = [];
  const used = new Set<number>();
  a.groups.forEach((g, i) => {
    const j = b.groups.findIndex((h, k) => !used.has(k) && groupKey(h) === groupKey(g));
    if (j < 0) {
      out.push({ group: i + 1, skill: groupSkill(g), changes: ['group removed'] });
      return;
    }
    used.add(j);
    const h = b.groups[j];
    const changes: string[] = [];
    if (g.enabled !== h.enabled) changes.push(`group ${h.enabled ? 'enabled' : 'disabled'}`);
    const taken = new Set<number>();
    for (const gem of g.gems) {
      const k = h.gems.findIndex((x, n) => !taken.has(n) && x.name === gem.name);
      if (k < 0) {
        changes.push(`${gem.name}: removed`);
        continue;
      }
      taken.add(k);
      const now = h.gems[k];
      if (now.level !== gem.level) changes.push(`${gem.name}: level ${gem.level} → ${now.level}`);
      if (now.quality !== gem.quality) changes.push(`${gem.name}: quality ${gem.quality} → ${now.quality}`);
      if (now.enabled !== gem.enabled) changes.push(`${gem.name}: ${now.enabled ? 'enabled' : 'disabled'}`);
    }
    h.gems.forEach((gem, n) => {
      if (!taken.has(n)) changes.push(`${gem.name}: added (level ${gem.level}, quality ${gem.quality})`);
    });
    if (changes.length > 0) out.push({ group: i + 1, skill: groupSkill(g), changes });
  });
  b.groups.forEach((h, k) => {
    if (used.has(k)) return;
    out.push({ group: k + 1, skill: groupSkill(h), changes: [`group added: ${h.gems.map((g) => `${g.name} (level ${g.level})`).join(', ') || 'no gems'}`] });
  });
  return out;
}

function compareTree(base: PobFile, edited: PobFile, a: PobSpec, b: PobSpec, names: ReadBackNames): ReadBackTree {
  const name = (id: number): string => names.node(b.treeVersion || a.treeVersion, id)?.name ?? names.node(a.treeVersion, id)?.name ?? `node ${id}`;
  const isAscendancy = (id: number): boolean =>
    (names.node(b.treeVersion || a.treeVersion, id) ?? names.node(a.treeVersion, id))?.ascendancy === true;
  const before = new Set(a.nodes);
  const after = new Set(b.nodes);
  const tree: ReadBackTree = { added: [], removed: [], ascendancy: [], jewels: [], attributes: [] };
  for (const id of b.nodes) {
    if (before.has(id)) continue;
    if (isAscendancy(id)) tree.ascendancy.push({ id, name: name(id), change: 'added' });
    else tree.added.push({ id, name: name(id) });
  }
  for (const id of a.nodes) {
    if (after.has(id)) continue;
    if (isAscendancy(id)) tree.ascendancy.push({ id, name: name(id), change: 'removed' });
    else tree.removed.push({ id, name: name(id) });
  }
  const sockets = [...new Set([...a.sockets.keys(), ...b.sockets.keys()])].sort((x, y) => x - y);
  for (const socket of sockets) {
    const diff = lineDiff(base.items.get(a.sockets.get(socket) ?? '') ?? [], edited.items.get(b.sockets.get(socket) ?? '') ?? []);
    if (diff.removed.length > 0 || diff.added.length > 0) tree.jewels.push({ socket, name: name(socket), ...diff });
  }
  // The attribute choices of the nodes both trees hold.
  for (const id of b.nodes) {
    if (!before.has(id)) continue;
    const from = a.attributes.get(id) ?? null;
    const to = b.attributes.get(id) ?? null;
    if (from !== to) tree.attributes.push({ id, name: name(id), from, to });
  }
  return tree;
}

/** The custom-modifiers input (PoB's `customMods`, one modifier per line), compared line by line. */
export const CUSTOM_MODS_INPUT = 'customMods';

function compareConfig(a: PobConfigSet, b: PobConfigSet, names: ReadBackNames): ReadBackConfigChange[] {
  const out: ReadBackConfigChange[] = [];
  const keys = [...a.inputs.keys(), ...[...b.inputs.keys()].filter((k) => !a.inputs.has(k))];
  for (const input of keys) {
    const from = a.inputs.get(input) ?? null;
    const to = b.inputs.get(input) ?? null;
    if (from === to) continue;
    if (input === CUSTOM_MODS_INPUT) {
      const lines = (v: string | null) => (v ?? '').split(/\r?\n/).map((l) => l.trim()).filter((l) => l !== '');
      const diff = lineDiff(lines(from), lines(to));
      for (const l of diff.removed) out.push({ input, label: 'Custom modifier', from: l, to: null });
      for (const l of diff.added) out.push({ input, label: 'Custom modifier', from: null, to: l });
      continue;
    }
    out.push({ input, label: names.configLabel(input), from, to });
  }
  return out;
}

/** How many changes a loadout holds: a changed item line counts once (its removed and added line pair), as the reply counts them. */
export function changeCounts(l: ReadBackLoadout): { items: number; gems: number; tree: number; config: number } {
  return {
    items: l.items.reduce((n, c) => n + Math.max(c.removed.length, c.added.length), 0),
    gems: l.gems.reduce((n, c) => n + c.changes.length, 0),
    tree:
      l.tree.added.length +
      l.tree.removed.length +
      l.tree.ascendancy.length +
      l.tree.jewels.reduce((n, j) => n + Math.max(j.removed.length, j.added.length), 0) +
      l.tree.attributes.length,
    config: l.config.length,
  };
}

/**
 * Compare the user's file with the base the server wrote, loadout by loadout. `file`, `base` and `baseSha1` are copied
 * into the result as `readback.json` records them.
 */
export function compareBuilds(
  baseFile: PobFile,
  editedFile: PobFile,
  names: ReadBackNames,
  head: { file: string; base: string; baseSha1: string },
): ReadBackFile {
  const before = loadoutsOf(baseFile);
  const after = loadoutsOf(editedFile);
  const loadouts: ReadBackLoadout[] = [];
  const unmatched: string[] = [];
  for (const [title, a] of before) {
    const b = after.get(title);
    if (b === undefined) {
      unmatched.push(`${title}: in the base, not in the edited file`);
      continue;
    }
    const missing = (['itemSet', 'skillSet', 'configSet'] as const).filter((k) => (a[k] === null) !== (b[k] === null));
    if (missing.length > 0) {
      const which = missing.map((k) => ({ itemSet: 'item set', skillSet: 'skill set', configSet: 'config set' })[k]).join(', ');
      unmatched.push(`${title}: its ${which} ${b[missing[0]] === null ? "isn't in the edited file" : "isn't in the base"} under the compiler's titles`);
      continue;
    }
    const loadout: ReadBackLoadout = {
      title,
      items: a.itemSet && b.itemSet ? compareItems(baseFile, editedFile, a.itemSet, b.itemSet) : [],
      gems: a.skillSet && b.skillSet ? compareGroups(a.skillSet, b.skillSet) : [],
      tree: compareTree(baseFile, editedFile, a.spec, b.spec, names),
      config: a.configSet && b.configSet ? compareConfig(a.configSet, b.configSet, names) : [],
    };
    const c = changeCounts(loadout);
    if (c.items + c.gems + c.tree + c.config > 0) loadouts.push(loadout);
  }
  for (const title of after.keys()) if (!before.has(title)) unmatched.push(`${title}: in the edited file, not in the base`);
  return { file: head.file, base: head.base, baseSha1: head.baseSha1, loadouts, unmatched };
}

/** The reply's summary of a read-back: its change count and, per loadout, what changed. */
export function readBackSummary(r: ReadBackFile): { changes: number; text: string } {
  const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
  let changes = r.unmatched.length;
  const parts: string[] = [];
  for (const l of r.loadouts) {
    const c = changeCounts(l);
    changes += c.items + c.gems + c.tree + c.config;
    const what = [
      c.items > 0 ? plural(c.items, 'item line', 'item lines') : '',
      c.gems > 0 ? plural(c.gems, 'gem change', 'gem changes') : '',
      c.tree > 0 ? plural(c.tree, 'tree change', 'tree changes') : '',
      c.config > 0 ? plural(c.config, 'config input', 'config inputs') : '',
    ].filter((s) => s !== '');
    parts.push(`${l.title}: ${what.join(', ')}`);
  }
  if (r.unmatched.length > 0) parts.push(`${plural(r.unmatched.length, 'unmatched loadout', 'unmatched loadouts')}`);
  return { changes, text: parts.join('; ') };
}

// ---------------------------------------------------------------------------------------------------
// Config labels (PoB's Modules/ConfigOptions.lua)

/** PoB's colour codes (`^x<rrggbb>`, `^<digit>`). */
const COLOUR = /\^x[0-9A-Fa-f]{6}|\^[0-9]/g;

/** Each config option's label from `ConfigOptions.lua`'s text: `{ var = "<name>", …, label = "<label>", … }`, colour codes and a trailing colon removed. */
export function configLabelsOf(luaText: string): Map<string, string> {
  const labels = new Map<string, string>();
  const entry = /\{\s*var\s*=\s*"([^"]+)"([^\n]*)/g;
  for (const m of luaText.matchAll(entry)) {
    const label = /\blabel\s*=\s*"((?:[^"\\]|\\.)*)"/.exec(m[2])?.[1];
    if (label === undefined) continue;
    const clean = label.replace(COLOUR, '').replace(/\\(.)/g, '$1').trim().replace(/:$/, '').trim();
    if (clean !== '' && !labels.has(m[1])) labels.set(m[1], clean);
  }
  return labels;
}
