/**
 * `check_model_coverage` (C-38): per line, whether the pinned PoB applies an item's, a passive node's or a
 * gem's lines, through the engine's `check_coverage` action (`pob-api/API/Coverage.lua`). A `read` tool:
 * it never changes the build (D-176).
 *
 * Inputs: one or more of `item_text`, `nodes` (ids or exact names) and `gems` (names), or `build: true`
 * alone (the active item set's equipped items, the active spec's nodes, the active skill set's gems).
 * Every line gets one status: fully parsed, partly parsed (with the remainder), unparsed, parsed to
 * nothing, possibly unread (a mod PoB's calculation code names nowhere, even as a concatenated name, by
 * the server's scan, D-226 and D-243; advisory), or, for a gem line, possibly unmodelled; check config
 * (PoB's red-tooltip rule, D-123). A partly parsed line applies nothing: PoB drops a line with a
 * remainder. Build mode also checks the jewels in allocated tree sockets (D-242) and lists only lines
 * that aren't fully parsed; its counts cover every line.
 *
 * Flags (WU-54; D-300, D-336) name what PoB doesn't model, beside the statuses and never as one: they
 * change no status or count. Every mode lists every flag, build mode included, as `- [<flag>] <source>`,
 * then `  line: <line>` for a line's flag, then the note indented.
 */
import type { LuaHandlerContext } from "./luaHandlers.js";
import {
  COVERAGE_STATUSES,
  type CheckCoverageResult,
  type CoverageEntry,
  type CoverageFlag,
  type CoverageStatus,
} from "../engine/schemas.js";
import type { PobSourceScan } from "../engine/pobSourceNames.js";
import { wrapHandler } from "../utils/errorHandling.js";

export interface CoverageContext extends Pick<LuaHandlerContext, "getLuaClient" | "ensureLuaClient"> {
  /** The server's scan of PoB's source (D-226, D-243): memoized once per server process. */
  sourceScan: () => Promise<PobSourceScan>;
}

export interface CheckModelCoverageArgs {
  itemText?: unknown;
  nodes?: unknown;
  gems?: unknown;
  build?: unknown;
}

/** What each status means, for the statuses a listing shows. */
const STATUS_NOTES: Record<CoverageStatus, string> = {
  "fully parsed": "PoB applies the whole line.",
  "partly parsed":
    "PoB applies none of the line: it understood only part of it, and the remainder shows what it didn't understand (PoB drops any line with a remainder).",
  unparsed: "PoB ignores the line.",
  "parsed to nothing": "PoB reads the line, but it changes no stat.",
  "possibly unread":
    "PoB parses the line, but a mod it makes is named nowhere in PoB's calculation code (Modules/ and Classes/, except the parser), not even as a name it builds by concatenation, so PoB may never read it. This is advisory: PoB may still read the name through a name it computes another way, so confirm it by measurement (calc_with or lua_get_stats with and without the line) before working the effect out by hand.",
  "possibly unmodelled; check config":
    "PoB's own gem tooltip marks this skill line unsupported (its stat has no stat map); the effect may be modelled only through a config option or skill-specific code, so check the config.",
};

/** A non-blank string argument, or undefined. */
function textArg(value: unknown, name: string): string | undefined {
  if (value == null) return undefined;
  if (typeof value !== "string") throw new Error(`${name} must be a string`);
  return value.trim().length > 0 ? value : undefined;
}

/** A list argument's entries (strings, or whole numbers when `numbers`), or undefined when empty. */
function listArg(value: unknown, name: string, numbers: boolean): Array<string | number> | undefined {
  if (value == null) return undefined;
  if (!Array.isArray(value)) throw new Error(`${name} must be a list`);
  const out: Array<string | number> = [];
  for (const v of value) {
    if (typeof v === "string" && v.trim().length > 0) out.push(v.trim());
    else if (numbers && typeof v === "number" && Number.isInteger(v) && v >= 0) out.push(v);
    else throw new Error(`${name} entries must be ${numbers ? "node ids or names" : "gem names"} (received: ${JSON.stringify(v)})`);
  }
  return out.length > 0 ? out : undefined;
}

interface Request {
  itemText?: string;
  nodes?: Array<string | number>;
  gems?: string[];
  build: boolean;
}

function parseArgs(args: CheckModelCoverageArgs): Request {
  const itemText = textArg(args.itemText, "item_text");
  const nodes = listArg(args.nodes, "nodes", true);
  const gems = listArg(args.gems, "gems", false) as string[] | undefined;
  if (args.build != null && typeof args.build !== "boolean") throw new Error("build must be true or false");
  const build = args.build === true;
  if (build && (itemText || nodes || gems)) {
    throw new Error("build: true checks the loaded build on its own; leave out item_text, nodes and gems");
  }
  if (!build && !itemText && !nodes && !gems) {
    throw new Error("nothing to check: give item_text, nodes or gems, or build: true for the loaded build");
  }
  return { itemText, nodes, gems, build };
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

function subject(req: Request, result: CheckCoverageResult): string {
  if (req.build) {
    const c = result.checked;
    return `the loaded build: ${plural(c.items, "item", "items")}, ${plural(c.nodes, "node", "nodes")}, ${plural(c.gems, "gem", "gems")}`;
  }
  const bits: string[] = [];
  if (req.itemText) bits.push("item text");
  if (req.nodes) bits.push(`nodes ${req.nodes.join(", ")}`);
  if (req.gems) bits.push(`gems ${req.gems.join(", ")}`);
  return bits.join("; ");
}

/** The parser's remainder, its padding and doubled spaces dropped. */
export function remainderText(remainder: string): string {
  return remainder.replace(/\s+/g, " ").trim();
}

/** One entry: `[<status>] <line>`, then indented detail lines. */
export function renderEntry(entry: CoverageEntry): string[] {
  const lines = [`[${entry.status}] ${entry.line}`];
  for (const joined of entry.joinedWith ?? []) lines.push(`  joined with: ${joined}`);
  if (entry.remainder !== undefined) lines.push(`  remainder: ${remainderText(entry.remainder)}`);
  if (entry.unread && entry.unread.length > 0) lines.push(`  unread mods: ${entry.unread.join(", ")}`);
  if (entry.status === "possibly unmodelled; check config" && entry.stat) lines.push(`  stat: ${entry.stat}`);
  return lines;
}

/** One flag: `- [<flag>] <source>`, then its line if it has one, then the note. */
export function renderFlag(flag: CoverageFlag): string[] {
  const lines = [`- [${flag.flag}] ${flag.source}`];
  if (flag.line !== undefined) lines.push(`  line: ${flag.line}`);
  lines.push(`  ${flag.note}`);
  return lines;
}

function render(req: Request, result: CheckCoverageResult): string {
  const total = COVERAGE_STATUSES.reduce((n, s) => n + result.counts[s], 0);
  const counted = COVERAGE_STATUSES.filter((s) => result.counts[s] > 0).map((s) => `${result.counts[s]} ${s}`);
  const lines: string[] = [`=== Model Coverage (${subject(req, result)}) ===`, ""];
  lines.push(`Counts over ${plural(total, "line", "lines")} (a joined line counts once): ${counted.length > 0 ? counted.join(", ") : "none"}.`);
  if (req.build && result.gems.length > 0) {
    lines.push("Gems are checked at their level and quality in the build.");
  } else if (result.gems.length > 0) {
    const gems = result.gems.map(
      (g) => `${g.name} at gem level ${g.level}, quality ${g.quality}% (${g.fromBuild ? "as in the build" : "the default; not in the build"})`,
    );
    lines.push(`Gems checked: ${gems.join("; ")}.`);
  }
  const listed = req.build ? result.entries.filter((e) => e.status !== "fully parsed") : result.entries;
  if (req.build) lines.push("Build mode lists only the lines that aren't fully parsed; the counts cover every line.");
  const flags = result.flags;
  const flagged = flags.length > 0 ? " The flags below name what PoB doesn't model." : "";
  if (total === 0) lines.push(`No lines to check: the input has no mod lines.${flagged}`);
  else if (listed.length === 0) lines.push(`Every checked line is fully parsed.${flagged}`);

  const shown = COVERAGE_STATUSES.filter((s) => s !== "fully parsed" && listed.some((e) => e.status === s));
  if (shown.length > 0) {
    lines.push("", "Statuses:");
    for (const s of shown) lines.push(`- ${s}: ${STATUS_NOTES[s]}`);
  }

  if (flags.length > 0) {
    lines.push("", `Flags (${flags.length}): what PoB doesn't model. A flag changes no status or count.`);
    for (const flag of flags) lines.push(...renderFlag(flag));
  }

  let source: string | undefined;
  for (const entry of listed) {
    if (entry.source !== source) {
      source = entry.source;
      lines.push("", `## ${source}`);
    }
    lines.push(...renderEntry(entry));
  }
  return lines.join("\n");
}

export async function handleCheckModelCoverage(context: CoverageContext, args: CheckModelCoverageArgs) {
  return wrapHandler("check model coverage", async () => {
    const req = parseArgs(args);
    const scan = await context.sourceScan();

    await context.ensureLuaClient();
    const luaClient = context.getLuaClient();
    if (!luaClient) throw new Error("Lua client not initialized. Use lua_start first.");

    const result = await luaClient.checkCoverage({
      ...(req.itemText ? { itemText: req.itemText } : {}),
      ...(req.nodes ? { nodes: req.nodes } : {}),
      ...(req.gems ? { gems: req.gems } : {}),
      ...(req.build ? { build: true } : {}),
      sourceNames: [...scan.names],
      sourceTemplates: scan.templates,
    });
    return { content: [{ type: "text" as const, text: render(req, result) }] };
  });
}
