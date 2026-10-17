/**
 * `lookup_game_data` (C-37): the pinned PoB2's loaded game data, read through the engine's
 * `lookup_game_data` action (`pob-api/API/Lookup.lua`). A `read` tool: it never changes the build (D-176).
 *
 * - gem: gems whose name contains `query`, with PoB's tier (D-258), description, weapon, per stat set its
 *   base attack damage and crit chance (D-241) and tooltip lines at a gem level and quality, the "At +20%
 *   Quality" lines, support rules and per-level requirements (D-228);
 * - unique: uniques by name, mod line (any non-legacy variant's) or item type (`slot`): name, base, type
 *   and the matched lines; the `BuildRaw()` text for `add_item` only when one unique is returned (D-239);
 * - mechanic: one hit per matching gem, unique, passive, mod, essence or base line, optionally of one `kind`,
 *   with every kind's hit total in the header (D-240). A mod hit is followed by the base types that can roll
 *   it, and an essence hit names the item types the essence grants its mod on (WU-60, D-277).
 *
 * WU-53 (D-299), amendment 3's additions: gem blocks show the Gemling quality lines (labelled), an active
 * gem's skill types and the meta gems that can use it ("usable by"), and every gem's hit-making children.
 * With exactly one gem returned, or several that are all named as the query (gems that share a name), a support
 * shows the active gems it can support (the complement when it can support most of them) and an active gem the
 * supports another support unlocks. A name that several gems in a list share is printed once, with `×n`.
 * Mechanic mode searches quality, Gemling and item-base implicit lines (kind `base`), names a gem hit's stat
 * set by number, and takes gaps (`…` or `...`) in the query.
 *
 * WU-77 (D-379), amendment 6: after the gems, gem mode lists the minion skills named exactly as the query, each
 * as `## <name>`, `Kind: minion skill`, a `Cast by: <minion> (summoned by <gem>)` line per summon, `Commanded:
 * yes` for a command, a `Granted by: <passive> (<ascendancy>, node <id>)` line per passive whose line grants it,
 * then its cooldown, skill types, description and stat sets.
 *
 * Lua sorts every match, then cuts it to `max_results` (default 20, max 30; D-225). When nothing matches,
 * the reply lists Lua's closest names of the kind searched, closest first (D-258): in gem mode up to 5
 * active gems, then up to 3 supports under their own header (D-258a); otherwise up to 5. A query too long
 * to rank names against gets a note instead.
 */
import type { LuaHandlerContext } from "./luaHandlers.js";
import type {
  LookupBaseType,
  LookupGameDataResult,
  LookupGem,
  LookupHit,
  LookupMinionSkill,
  LookupSuggestion,
  LookupUnique,
} from "../engine/schemas.js";
import { wrapHandler } from "../utils/errorHandling.js";

export type LookupContext = Pick<LuaHandlerContext, "getLuaClient" | "ensureLuaClient">;

export interface LookupGameDataArgs {
  mode?: unknown;
  query?: unknown;
  gemLevel?: unknown;
  gemQuality?: unknown;
  slot?: unknown;
  kind?: unknown;
  maxResults?: unknown;
}

const MODES = ["gem", "unique", "mechanic"] as const;
type Mode = (typeof MODES)[number];
/** Mechanic mode's `kind` filter (D-240; `essence`, WU-60; `base`, WU-53). */
const HIT_KINDS = ["gem", "unique", "passive", "mod", "essence", "base"] as const;
type HitKind = (typeof HIT_KINDS)[number];

export const LOOKUP_DEFAULT_RESULTS = 20;
export const LOOKUP_MAX_RESULTS = 30;

function text(value: unknown): string | undefined {
  if (value == null) return undefined;
  const s = String(value).trim();
  return s.length > 0 ? s : undefined;
}

function wholeNumber(value: unknown, name: string, min: number, max?: number): number | undefined {
  if (value == null || value === "") return undefined;
  const n = Number(value);
  if (!Number.isInteger(n) || n < min || (max !== undefined && n > max)) {
    const range = max === undefined ? `a whole number of at least ${min}` : `a whole number from ${min} to ${max}`;
    throw new Error(`${name} must be ${range} (received: ${JSON.stringify(value)})`);
  }
  return n;
}

/** max_results: default 20, capped at 30 (D-225), as in `search_tree_nodes`. */
function resultLimit(value: unknown): number {
  const n = Number(value);
  if (value == null || !Number.isFinite(n) || n < 1) return LOOKUP_DEFAULT_RESULTS;
  return Math.min(Math.floor(n), LOOKUP_MAX_RESULTS);
}

/** WU-53 (AC-K58): the header of a gem's Gemling quality lines. */
export const GEMLING_HEADER = "At +20% Quality, with the Gemling Legionnaire's Advanced Thaumaturgy:";

/**
 * WU-53: the line a gem-mode reply with several gems gets when the long lists are left out: they come only for
 * one gem, or for gems that are all named as the query.
 */
export const SEVERAL_GEMS_NOTE =
  "Several gems are returned, so the active gems a support can support and the supports another support unlocks are left out; look a gem up by its exact name (or with max_results 1) for them.";

/** §2.2's span wording, `gem levels 1–<n>`, also for a single-level gem. */
const levelsLabel = (n: number) => `gem levels 1–${n}`;

/** WU-53: gem-name lists are separated by `; `, since some gem names contain a comma. */
const NAME_SEPARATOR = "; ";

/**
 * WU-53: a gem-name list, one entry per gem, in its order. A name that several of its gems share (Mace Strike
 * has three gems) is printed once, where it first appears, as `<name> ×<n>`; `suffix` follows each name.
 */
function nameList(entries: Array<{ name: string; suffix?: string }>): string {
  const counts = new Map<string, { name: string; suffix: string; n: number }>();
  for (const e of entries) {
    const suffix = e.suffix ?? "";
    const key = `${e.name}\0${suffix}`;
    const seen = counts.get(key);
    if (seen) seen.n += 1;
    else counts.set(key, { name: e.name, suffix, n: 1 });
  }
  return [...counts.values()].map((c) => `${c.name}${c.n > 1 ? ` ×${c.n}` : ""}${c.suffix}`).join(NAME_SEPARATOR);
}

const names = (list: string[]) => nameList(list.map((name) => ({ name })));

/** WU-53 (AC-K62): the active gems a support can support, or the ones it can't when it can support most. */
function canSupportLine(reach: NonNullable<LookupGem["canSupport"]>): string {
  const head = `Can support (${reach.count} of ${reach.total} active gems): `;
  if (reach.except) return head + (reach.names.length > 0 ? `all except ${names(reach.names)}` : "all");
  return head + (reach.names.length > 0 ? names(reach.names) : "(none)");
}

/** WU-53 (AC-K64): one hit-making child. */
function childLine(child: LookupGem["children"][number]): string {
  const label = child.kind === "minion" ? `minion ${child.minion ?? ""}` : child.kind;
  return `- ${child.name} (${label})`;
}

/** A granted effect's stat sets: each one's label, base attack damage and crit chance (D-241), and lines. */
function statSetLines(sets: LookupGem["statSets"]): string[] {
  const lines: string[] = [];
  for (const set of sets) {
    lines.push(`Stat set ${set.index}: ${set.label}`);
    // D-241: the stat set's base attack damage and crit chance, as PoB's gem tooltip words them.
    for (const base of set.baseLines) lines.push(`  ${base}`);
    if (set.lines.length === 0) lines.push("  (no described stats)");
    for (const line of set.lines) lines.push(`  - ${line}`);
  }
  return lines;
}

function renderGem(gem: LookupGem): string[] {
  const lines: string[] = [`## ${gem.name}`];
  const showType = gem.gemType && gem.gemType.toLowerCase() !== gem.gemKind;
  const kindBits = [gem.gemKind, showType ? `(${gem.gemType})` : ""].filter(Boolean).join(" ");
  lines.push(`Kind: ${kindBits}${gem.tags ? `; tags: ${gem.tags}` : ""}`);
  if (gem.tier !== undefined) lines.push(`Tier: ${gem.tier}`);
  if (gem.weapon) lines.push(`Weapon: ${gem.weapon}`);
  // WU-53 (AC-K59): an active gem's skill types and the meta gems that can use it.
  if (gem.skillTypes) lines.push(`Skill types: ${gem.skillTypes.join(", ")}`);
  if (gem.usableBy) {
    const metas = gem.usableBy.map((m) => ({ name: m.name, suffix: m.trigger ? " (trigger)" : "" }));
    lines.push(`Usable by: ${metas.length > 0 ? nameList(metas) : "(no meta gem)"}`);
  }
  if (gem.description) lines.push(`Description: ${gem.description}`);
  lines.push(`Stat sets at gem level ${gem.level}, quality ${gem.quality}%:`);
  if (gem.levelNote) lines.push(`Note: ${gem.levelNote}.`);
  lines.push(...statSetLines(gem.statSets));
  for (const extra of gem.additional) {
    lines.push(`Also grants: ${extra.name}${extra.support ? " (support effect)" : ""}`);
    if (extra.skillTypes) lines.push(`Skill types: ${extra.skillTypes.join(", ")}`);
    lines.push(...statSetLines(extra.statSets));
  }
  lines.push("At +20% Quality:");
  if (gem.qualityLines.length === 0) lines.push("  (no quality effects)");
  for (const line of gem.qualityLines) lines.push(`  - ${line}`);
  // WU-53 (AC-K58, PG-46): the Gemling quality lines, which PoB applies only with Advanced Thaumaturgy.
  if (gem.hasGemling) {
    lines.push(GEMLING_HEADER);
    if (gem.gemlingLines.length === 0) lines.push("  (no described line)");
    for (const line of gem.gemlingLines) lines.push(`  - ${line}`);
  }
  if (gem.supports !== undefined) {
    lines.push(`Supports: ${gem.supports.length > 0 ? gem.supports.join(", ") : "(any skill type)"}`);
    lines.push(`Can't support: ${gem.cannotSupport && gem.cannotSupport.length > 0 ? gem.cannotSupport.join(", ") : "(none)"}`);
  }
  // WU-53 (AC-K62, AC-K61): the long lists, only when this gem is the one returned.
  if (gem.canSupport) lines.push(canSupportLine(gem.canSupport));
  if (gem.unlocks) {
    lines.push("Unlocked by another support:");
    if (gem.unlocks.length === 0) lines.push("  (none)");
    for (const u of gem.unlocks) lines.push(`- ${u.name}: after ${names(u.after)}`);
  }
  // WU-53 (AC-K64): the hit-making children, for the payoff-thief check.
  lines.push("Hit-making children:");
  if (gem.children.length === 0) lines.push("  (none)");
  for (const child of gem.children) lines.push(childLine(child));
  const req = gem.requirements;
  const span = levelsLabel(req.maxLevel);
  lines.push(`Requires level (${span}): ${req.levels.join(", ")}`);
  const attrs: Array<[string, number[] | undefined]> = [
    ["Str", req.str],
    ["Dex", req.dex],
    ["Int", req.int],
  ];
  for (const [label, values] of attrs) {
    if (values && values.length > 0) lines.push(`${label} (${span}): ${values.join(", ")}`);
  }
  return lines;
}

/**
 * WU-77 (D-379): a minion skill's block. The kind line is fixed, `Kind: minion skill`, for the build-guide
 * brief check; each summon that casts it, whether it is a command, and the passives whose line grants it (PoB
 * never checks that passive, spike A4) follow, then its cooldown, skill types, description and stat sets.
 */
function renderMinionSkill(skill: LookupMinionSkill): string[] {
  const lines: string[] = [`## ${skill.name}`, "Kind: minion skill"];
  const castBy = skill.castBy.map((c) => `Cast by: ${c.minion} (summoned by ${c.gem})`);
  lines.push(...castBy.filter((line, i) => castBy.indexOf(line) === i));
  if (skill.commanded) lines.push("Commanded: yes");
  for (const node of skill.grantedBy) {
    lines.push(`Granted by: ${node.name} (${node.ascendancy ? `${node.ascendancy}, ` : ""}node ${node.id})`);
  }
  lines.push(`Cooldown: ${skill.cooldown !== undefined ? `${skill.cooldown} s` : "none"}`);
  lines.push(`Skill types: ${skill.skillTypes.length > 0 ? skill.skillTypes.join(", ") : "(none)"}`);
  if (skill.description) lines.push(`Description: ${skill.description}`);
  lines.push(`Stat sets at skill level ${skill.level} of ${skill.levelCount} (a minion uses the highest level its own level reaches):`);
  lines.push(...statSetLines(skill.statSets));
  return lines;
}

type Variants = NonNullable<LookupUnique["matchedLines"][number]["variants"]>;

/** "variant 22: Blood Hunt" / "variants 3: A, 7: B and 2 more" (unique mode). */
export function variantText(variants: Variants): string {
  const named = variants.slice(0, 3).map((v) => (v.name ? `${v.index}: ${v.name}` : `${v.index}`));
  const more = variants.length > 3 ? ` and ${variants.length - 3} more` : "";
  return `${variants.length === 1 ? "variant" : "variants"} ${named.join(", ")}${more}`;
}

/**
 * A unique (D-239): name, type, base and the matched lines (each line from a variant other than the
 * selected one names its variants); the full item text only when it is the one unique returned.
 */
function renderUnique(unique: LookupUnique): string[] {
  const lines: string[] = [`## ${unique.name} (${unique.type})`];
  if (unique.baseName) lines.push(`Base: ${unique.baseName}`);
  if (unique.byName && unique.matchedLines.length === 0) lines.push("Matched: its name");
  for (const m of unique.matchedLines) {
    lines.push(`Matched: ${m.line}${m.variants ? ` (${variantText(m.variants)})` : ""}`);
  }
  if (unique.matchedCount > unique.matchedLines.length) {
    lines.push(`(and ${unique.matchedCount - unique.matchedLines.length} more matching lines)`);
  }
  if (unique.raw !== undefined) {
    if (unique.selectedVariant) {
      const sel = unique.selectedVariant;
      const other = unique.matchedLines.some((m) => m.variants);
      lines.push(
        `Selected variant: ${sel.index}${sel.name ? ` (${sel.name})` : ""}` +
          (other ? "; for a matched line of another variant, change the text's `Selected Variant:` line to that variant's number before add_item." : ""),
      );
    }
    lines.push("```", unique.raw, "```");
  }
  return lines;
}

/** One mechanic hit: `[<kind>] <source>: <line>`. */
export function renderHit(hit: LookupHit): string {
  return `[${hit.kind}] ${hit.source}: ${hit.line}`;
}

/** The line under a mod hit that lists its base types (WU-60, D-277). */
export const BASE_TYPES_PREFIX = "  Base types: ";

/**
 * A mod hit's base types, the ones with a non-zero spawn weight for it (WU-60, D-277), separated by `; `:
 * `<item type> (all)` when every base of an item type with several base lists can roll it, else each of
 * PoB's base lists that has a base that can, as `<list>` or, when only some of its bases can,
 * `<list> (<n> of <m> bases: <names>)`. A mod PoB never rolls on a base says why (`notRolled`).
 */
export function renderBaseTypes(baseTypes: LookupBaseType[], notRolled?: string): string {
  if (notRolled) return `${BASE_TYPES_PREFIX}none (${notRolled})`;
  if (baseTypes.length === 0) return `${BASE_TYPES_PREFIX}none (no base has a spawn weight for it)`;
  const parts = baseTypes.map((b) => {
    if (b.itemType) return `${b.name} (all)`;
    if (b.count < b.total) return `${b.name} (${b.count} of ${b.total} bases: ${(b.names ?? []).join(", ")})`;
    return b.name;
  });
  return `${BASE_TYPES_PREFIX}${parts.join("; ")}`;
}

interface Request {
  mode: Mode;
  query?: string;
  slot?: string;
  kind?: HitKind;
  maxResults: number;
}

function criteria(req: Request): string {
  const bits: string[] = [];
  if (req.query) bits.push(`"${req.query}"`);
  if (req.mode === "unique" && req.slot) bits.push(`item type ${req.slot}`);
  if (req.mode === "mechanic" && req.kind) bits.push(`kind ${req.kind}`);
  return bits.join(", ");
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** What the closest names are names of (D-258): the kind the request searched. */
function suggestionNoun(req: Request): string {
  if (req.mode === "unique") return req.slot ? `unique names of item type ${req.slot}` : "unique names";
  return req.kind ? `${req.kind} names` : "gem, unique, passive, mod, essence and base names";
}

const SUGGESTION_ORDER = "(fewest edits from the query, then by name)";

/**
 * The closest-names block: one header and its names, or in gem mode one header per group, active gems
 * first, then supports (D-258a).
 */
function suggestionBlock(req: Request, suggestions: LookupSuggestion[]): string[] {
  if (req.mode !== "gem") {
    return [`Closest ${suggestionNoun(req)} ${SUGGESTION_ORDER}:`, ...suggestions.map((s) => renderSuggestion(req.mode, s))];
  }
  const lines: string[] = [];
  for (const kind of ["active", "support"]) {
    const group = suggestions.filter((s) => s.kind === kind);
    if (group.length > 0) lines.push(`Closest ${kind} gem names ${SUGGESTION_ORDER}:`, ...group.map((s) => renderSuggestion(req.mode, s)));
  }
  return lines;
}

/** One closest name: `- <name> (<kind>[, <detail>])`; gem mode's kind is `active` or `support`. */
function renderSuggestion(mode: Mode, s: LookupSuggestion): string {
  const bits = mode === "unique" ? [s.detail] : [s.kind, s.detail];
  const label = bits.filter(Boolean).join(", ");
  return `- ${s.name}${label ? ` (${label})` : ""}`;
}

function render(req: Request, result: LookupGameDataResult): string {
  const lines: string[] = [`=== Game Data Lookup (${req.mode}: ${criteria(req)}) ===`, ""];
  const shown = result.results.length;
  const kinds = result.kinds;
  if (req.mode === "mechanic" && kinds) {
    // D-240: every kind's hit total, whatever `kind` lists.
    const all = kinds.gem + kinds.unique + kinds.passive + kinds.mod + kinds.essence + kinds.base;
    if (all > 0) {
      lines.push(
        `${plural(all, "hit", "hits")}: ${kinds.gem} gem, ${kinds.unique} unique, ${kinds.passive} passive, ${kinds.mod} mod, ${kinds.essence} essence, ${kinds.base} base.`,
      );
    }
  }
  if (shown === 0) {
    lines.push(`Nothing matched ${criteria(req)}.`);
    const suggestions = result.suggestions ?? [];
    if (suggestions.length > 0) lines.push(...suggestionBlock(req, suggestions));
    const skipped = result.suggestionsSkipped;
    if (skipped) {
      lines.push(`The query is ${skipped.queryLength} characters long, over the ${skipped.maxQueryLength} that closest names are listed for.`);
    }
    lines.push("Tips: try a shorter or more general query, or another mode.");
    return lines.join("\n");
  }
  const noun = req.mode === "mechanic" ? ["hit", "hits"] : ["match", "matches"];
  const isMinionSkill = (r: (typeof result.results)[number]) => r.kind === "minion-skill";
  const order =
    req.mode === "mechanic"
      ? "sorted by kind (gem, unique, passive, mod, essence, base), then by name"
      : `exact name matches first, then by name${result.results.some(isMinionSkill) ? "; the minion skills after the gems" : ""}`;
  if (shown < result.total) {
    const more = [
      req.maxResults < LOOKUP_MAX_RESULTS ? `raise max_results (up to ${LOOKUP_MAX_RESULTS})` : "",
      req.mode === "mechanic" && !req.kind ? "pass kind to list one kind" : "",
      "narrow the query",
    ].filter(Boolean);
    const kindNote = req.mode === "mechanic" && req.kind ? ` ${req.kind}` : "";
    const advice = more.length > 1 ? `${more.slice(0, -1).join(", ")} or ${more[more.length - 1]}` : more[0];
    lines.push(`Showing the first ${shown} of ${result.total}${kindNote} ${result.total === 1 ? noun[0] : noun[1]} (${order}); ${advice} for more.`);
  } else {
    const kindNote = req.mode === "mechanic" && req.kind ? ` ${req.kind}` : "";
    lines.push(`Found ${result.total}${kindNote} ${result.total === 1 ? noun[0] : noun[1]} (${order}).`);
  }
  // WU-53: the note only when the long lists are left out (not every returned gem is named as the query).
  if (req.mode === "gem") {
    // The minion skills (D-379) have no long lists: the note is about the gems only.
    const gems = result.results.filter((r) => r.kind === "gem") as LookupGem[];
    if (gems.length > 1 && gems.some((g) => g.canSupport === undefined && g.unlocks === undefined)) lines.push(SEVERAL_GEMS_NOTE);
  }
  if (req.mode === "unique" && shown > 1) {
    lines.push("Several uniques are returned, so each is shown in brief; look one up by its exact name (or with max_results 1) for its full item text, ready for add_item.");
  }
  lines.push("");
  if (req.mode === "mechanic") {
    for (const r of result.results) {
      const hit = r as LookupHit;
      lines.push(renderHit(hit));
      // WU-60 (D-277): the base types that can roll a mod, on the line under it.
      if (hit.kind === "mod" && hit.baseTypes) lines.push(renderBaseTypes(hit.baseTypes, hit.notRolled));
    }
  } else {
    for (const r of result.results) {
      const block =
        r.kind === "minion-skill"
          ? renderMinionSkill(r as LookupMinionSkill)
          : req.mode === "gem"
            ? renderGem(r as LookupGem)
            : renderUnique(r as LookupUnique);
      lines.push(...block, "");
    }
  }
  return lines.join("\n").trimEnd();
}

export async function handleLookupGameData(context: LookupContext, args: LookupGameDataArgs) {
  return wrapHandler("look up game data", async () => {
    const mode = text(args.mode);
    if (!mode || !(MODES as readonly string[]).includes(mode)) {
      throw new Error(`unknown mode ${JSON.stringify(args.mode ?? null)}; use gem, unique or mechanic`);
    }
    const m = mode as Mode;
    const query = text(args.query);
    const slot = m === "unique" ? text(args.slot) : undefined;
    if ((m === "gem" || m === "mechanic") && !query) throw new Error(`${m} mode needs a query`);
    if (m === "unique" && !query && !slot) throw new Error("unique mode needs a query, a slot or both");
    const level = m === "gem" ? wholeNumber(args.gemLevel, "gem_level", 1) : undefined;
    const quality = m === "gem" ? wholeNumber(args.gemQuality, "gem_quality", 0, 20) : undefined;
    const kindText = m === "mechanic" ? text(args.kind)?.toLowerCase() : undefined;
    if (kindText !== undefined && !(HIT_KINDS as readonly string[]).includes(kindText)) {
      throw new Error(`unknown kind ${JSON.stringify(args.kind)}; use gem, unique, passive, mod, essence or base`);
    }
    const kind = kindText as HitKind | undefined;
    const maxResults = resultLimit(args.maxResults);

    await context.ensureLuaClient();
    const luaClient = context.getLuaClient();
    if (!luaClient) throw new Error("Lua client not initialized. Use lua_start first.");

    const result = await luaClient.lookupGameData({
      mode: m,
      ...(query ? { query } : {}),
      ...(level !== undefined ? { level } : {}),
      ...(quality !== undefined ? { quality } : {}),
      ...(slot ? { slot } : {}),
      ...(kind ? { kind } : {}),
      maxResults,
    });
    return { content: [{ type: "text" as const, text: render({ mode: m, query, slot, kind, maxResults }, result) }] };
  });
}
