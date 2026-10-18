/**
 * The one judgment function of the advice tools (FR-A1, D-30, D-3).
 *
 * `validate_build`, `analyze_defenses`, `get_build_issues` and the "Top Issues" of `lua_load_build`'s
 * summary judge a build only by what PoB2 itself computes:
 * - (a) PoB's own warning lines (`get_warnings`: unmet attribute requirements, negative unreserved
 *   Life/Mana/Spirit, too many points or gem groups, …), each one issue whose text is the line;
 * - (b) a resistance below its maximum: `Missing<Elem>Resist > 0`;
 * - (c) per damage type, `<Type>MaximumHitTaken < <Type>EnemyDamage`, the configured enemy's hit of
 *   that type (never `totalEnemyDamage`, which sums all five types);
 * - (d) what PoB's own data says the game won't allow, though PoB itself allows it (`get_rule_breaks`): an
 *   allocated node whose unlock constraint is unmet (D-383), a gem PoB marks legacy and an equipped unique PoB
 *   marks no longer obtainable (D-384).
 *
 * Beside the judgments it states engine facts without judging them: an empty gear slot that PoB shows.
 * There are no thresholds or advice of our own here. Pure: no engine, no I/O.
 */

/** The resistances PoB reports a gap for (`Missing<Elem>Resist`, CalcDefence). */
export const RESIST_ELEMENTS = ['Fire', 'Cold', 'Lightning', 'Chaos'] as const;
/** The damage types PoB computes a max hit and an enemy hit for. */
export const DAMAGE_TYPES = ['Physical', 'Fire', 'Cold', 'Lightning', 'Chaos'] as const;

/** The engine outputs `judge` reads; all are in `get_stats`' default list (AC-E26). */
export const JUDGE_STAT_FIELDS: readonly string[] = [
  ...RESIST_ELEMENTS.map((e) => `Missing${e}Resist`),
  ...DAMAGE_TYPES.map((t) => `${t}MaximumHitTaken`),
  ...DAMAGE_TYPES.map((t) => `${t}EnemyDamage`),
];

export type IssueKind =
  | 'pob_warning'
  | 'locked_node'
  | 'legacy_gem'
  | 'unobtainable_unique'
  | 'missing_resist'
  | 'max_hit'
  | 'empty_slot';

/** A node an unlock constraint names that isn't allocated (D-383). */
export interface UnlockNeed {
  id: number;
  name: string;
  /** The needed node's ascendancy, when it is an ascendancy node (The Unseen Path: Oracle). */
  ascendancy?: string;
}

/** What the game won't allow in a build (`get_rule_breaks`, D-383, D-384). */
export interface RuleBreaks {
  /** Each allocated node whose unlock constraint is unmet, with the nodes it still needs. */
  lockedNodes?: readonly { id: number; name: string; needs: readonly UnlockNeed[] }[];
  /** Each gem PoB marks legacy in the active skill set, with its group and the group's label. */
  legacyGems?: readonly { name: string; group: number; label?: string }[];
  /** Each equipped unique PoB marks no longer obtainable, with its slot. */
  unobtainableUniques?: readonly { name: string; slot: string }[];
}

/** D-384: the editing tools' warning for a gem PoB marks legacy (they add it, as PoB does). */
export function legacyGemWarning(name: string): string {
  return `⚠ ${name} is a legacy gem: PoB marks it legacy, and it is no longer in the game.`;
}

/** D-384: the editing tools' warning for a unique PoB marks no longer obtainable (they add it, as PoB does). */
export function unobtainableUniqueWarning(name: string): string {
  return `⚠ ${name} is no longer obtainable: PoB's unique data marks it so.`;
}

export interface Issue {
  kind: IssueKind;
  /** `judgment`: a PoB warning or an engine comparison; `fact`: an engine fact, stated, not judged. */
  category: 'judgment' | 'fact';
  text: string;
}

/** The `get_items` fields `judge` reads. */
export interface JudgedSlot {
  slot: string;
  id: number;
  shown: boolean;
  inactive: boolean;
}

/** A finite number, or null for a missing, NaN (`null` on the wire) or non-numeric value. */
function num(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

/** A number as text: whole numbers with thousands separators, others to one decimal. */
export function formatNumber(value: number): string {
  return value.toLocaleString('en-US', { maximumFractionDigits: Number.isInteger(value) ? 0 : 1 });
}

/** A gear slot: an equipment slot, not a jewel socket (tree `Jewel <id>` or `<gear> Jewel Socket <n>`). */
function isGearSlot(slot: string): boolean {
  return !/\bJewel\b/.test(slot);
}

/** `node 5571 (The Unseen Path, an Oracle node) is`, or `nodes 41401 (A) and 46070 (B) are` (D-383). */
function needsText(needs: readonly UnlockNeed[]): string {
  const named = needs.map((n) => {
    const asc = n.ascendancy ? `, ${/^[AEIOU]/.test(n.ascendancy) ? 'an' : 'a'} ${n.ascendancy} node` : '';
    return `${n.id} (${n.name}${asc})`;
  });
  if (named.length === 1) return `node ${named[0]} is`;
  return `nodes ${named.slice(0, -1).join(', ')} and ${named[named.length - 1]} are`;
}

/**
 * Judge a build from PoB2's outputs (`stats`), PoB's warning lines, its item slots and its rule breaks.
 * Order: PoB's warnings (in PoB's order), then rule breaks (D-383), then resistances, then max hits (in the
 * order above), then facts.
 */
export function judge(
  stats: Readonly<Record<string, unknown>>,
  warnings: readonly string[],
  items: readonly JudgedSlot[],
  breaks: RuleBreaks = {},
): Issue[] {
  const issues: Issue[] = [];

  for (const line of warnings) {
    issues.push({ kind: 'pob_warning', category: 'judgment', text: line });
  }

  for (const node of breaks.lockedNodes ?? []) {
    issues.push({
      kind: 'locked_node',
      category: 'judgment',
      text: `Node ${node.id} (${node.name}) is locked: PoB unlocks it only while ${needsText(node.needs)} allocated.`,
    });
  }

  for (const gem of breaks.legacyGems ?? []) {
    const label = gem.label ? `, "${gem.label}"` : '';
    issues.push({
      kind: 'legacy_gem',
      category: 'judgment',
      text: `${gem.name} (socket group ${gem.group}${label}) is a legacy gem: PoB marks it legacy, and it is no longer in the game.`,
    });
  }

  for (const unique of breaks.unobtainableUniques ?? []) {
    issues.push({
      kind: 'unobtainable_unique',
      category: 'judgment',
      text: `${unique.name} (${unique.slot}) is no longer obtainable: PoB's unique data marks it so.`,
    });
  }

  for (const element of RESIST_ELEMENTS) {
    const missing = num(stats[`Missing${element}Resist`]);
    if (missing !== null && missing > 0) {
      issues.push({
        kind: 'missing_resist',
        category: 'judgment',
        text: `${element} resistance is ${formatNumber(missing)}% below its maximum (PoB's Missing${element}Resist).`,
      });
    }
  }

  for (const type of DAMAGE_TYPES) {
    const maxHit = num(stats[`${type}MaximumHitTaken`]);
    const enemyHit = num(stats[`${type}EnemyDamage`]);
    if (maxHit !== null && enemyHit !== null && maxHit < enemyHit) {
      issues.push({
        kind: 'max_hit',
        category: 'judgment',
        text:
          `${type} max hit taken (${formatNumber(maxHit)}) is below the configured enemy's ${type} hit ` +
          `(${formatNumber(enemyHit)}).`,
      });
    }
  }

  for (const item of items) {
    if (item.shown && !item.inactive && isGearSlot(item.slot) && !(item.id > 0)) {
      issues.push({ kind: 'empty_slot', category: 'fact', text: `${item.slot}: empty.` });
    }
  }

  return issues;
}
