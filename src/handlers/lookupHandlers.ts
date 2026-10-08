/**
 * `lookup_game_data` (C-37): the pinned PoB2's loaded game data, read through the engine's
 * `lookup_game_data` action (`pob-api/API/Lookup.lua`). A `read` tool: it never changes the build (D-176).
 *
 * - gem: gems whose name contains `query`, with description, weapon, stat-set tooltip lines at a gem
 *   level and quality, the "At +20% Quality" lines, support rules and per-level requirements (D-228);
 * - unique: uniques by name, mod line or item type (`slot`), each as `BuildRaw()` text for `add_item`;
 * - mechanic: one hit per matching gem, unique, passive or mod line.
 *
 * Lua sorts every match, then cuts it to `max_results` (default 20, max 30; D-225).
 */
import type { LuaHandlerContext } from "./luaHandlers.js";
import type { LookupGameDataResult, LookupGem, LookupHit, LookupUnique } from "../engine/schemas.js";
import { wrapHandler } from "../utils/errorHandling.js";

export type LookupContext = Pick<LuaHandlerContext, "getLuaClient" | "ensureLuaClient">;

export interface LookupGameDataArgs {
  mode?: unknown;
  query?: unknown;
  gemLevel?: unknown;
  gemQuality?: unknown;
  slot?: unknown;
  maxResults?: unknown;
}

const MODES = ["gem", "unique", "mechanic"] as const;
type Mode = (typeof MODES)[number];

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

const levelsLabel = (n: number) => (n === 1 ? "gem level 1" : `gem levels 1–${n}`);

function renderGem(gem: LookupGem): string[] {
  const lines: string[] = [`## ${gem.name}`];
  const showType = gem.gemType && gem.gemType.toLowerCase() !== gem.gemKind;
  const kindBits = [gem.gemKind, showType ? `(${gem.gemType})` : ""].filter(Boolean).join(" ");
  lines.push(`Kind: ${kindBits}${gem.tags ? `; tags: ${gem.tags}` : ""}`);
  if (gem.weapon) lines.push(`Weapon: ${gem.weapon}`);
  if (gem.description) lines.push(`Description: ${gem.description}`);
  lines.push(`Stat sets at gem level ${gem.level}, quality ${gem.quality}%:`);
  const renderSets = (sets: LookupGem["statSets"]) => {
    for (const set of sets) {
      lines.push(`Stat set ${set.index}: ${set.label}`);
      if (set.lines.length === 0) lines.push("  (no described stats)");
      for (const line of set.lines) lines.push(`  - ${line}`);
    }
  };
  renderSets(gem.statSets);
  for (const extra of gem.additional) {
    lines.push(`Also grants: ${extra.name}${extra.support ? " (support effect)" : ""}`);
    renderSets(extra.statSets);
  }
  lines.push("At +20% Quality:");
  if (gem.qualityLines.length === 0) lines.push("  (no quality effects)");
  for (const line of gem.qualityLines) lines.push(`  - ${line}`);
  if (gem.supports !== undefined) {
    lines.push(`Supports: ${gem.supports.length > 0 ? gem.supports.join(", ") : "(any skill type)"}`);
    lines.push(`Can't support: ${gem.cannotSupport && gem.cannotSupport.length > 0 ? gem.cannotSupport.join(", ") : "(none)"}`);
  }
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

function renderUnique(unique: LookupUnique): string[] {
  return [`## ${unique.name} (${unique.type})`, "```", unique.raw, "```"];
}

/** One mechanic hit: `[<kind>] <source>: <line>`. */
export function renderHit(hit: LookupHit): string {
  return `[${hit.kind}] ${hit.source}: ${hit.line}`;
}

function criteria(mode: Mode, query: string | undefined, slot: string | undefined): string {
  const bits: string[] = [];
  if (query) bits.push(`"${query}"`);
  if (mode === "unique" && slot) bits.push(`item type ${slot}`);
  return bits.join(", ");
}

function render(mode: Mode, query: string | undefined, slot: string | undefined, result: LookupGameDataResult): string {
  const lines: string[] = [`=== Game Data Lookup (${mode}: ${criteria(mode, query, slot)}) ===`, ""];
  const shown = result.results.length;
  if (shown === 0) {
    lines.push(`Nothing matched ${criteria(mode, query, slot)}.`);
    lines.push("Tips: try a shorter or more general query, or another mode.");
    return lines.join("\n");
  }
  const noun = mode === "mechanic" ? (result.total === 1 ? "hit" : "hits") : result.total === 1 ? "match" : "matches";
  const order =
    mode === "mechanic"
      ? "sorted by kind (gem, unique, passive, mod), then by name"
      : "exact name matches first, then by name";
  lines.push(
    shown < result.total
      ? `Showing the first ${shown} of ${result.total} ${noun} (${order}); raise max_results (up to ${LOOKUP_MAX_RESULTS}) or narrow the query for more.`
      : `Found ${result.total} ${noun} (${order}).`,
  );
  lines.push("");
  if (mode === "mechanic") {
    for (const r of result.results) lines.push(renderHit(r as LookupHit));
  } else {
    for (const r of result.results) {
      lines.push(...(mode === "gem" ? renderGem(r as LookupGem) : renderUnique(r as LookupUnique)), "");
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
      maxResults,
    });
    return { content: [{ type: "text" as const, text: render(m, query, slot, result) }] };
  });
}
