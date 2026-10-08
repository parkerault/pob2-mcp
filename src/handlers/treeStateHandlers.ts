/**
 * `set_tree_state` (C-40): the active passive tree spec's weapon-set tags and attribute choices, through
 * the engine's `set_tree` action with the spec's current nodes (`pob-api/API/BuildOps.lua`). A `mutate`
 * tool.
 *
 * - `weapon_set_nodes` (`{"1"?: ids, "2"?: ids}`) replaces the tags: the listed nodes get that weapon set
 *   and every other allocated node gets none.
 * - `attribute_choices` (`{id: "strength"|"dexterity"|"intelligence"}`) is applied over the kept choices.
 * - All-or-nothing: any bad entry fails the call, naming each node and the reason, and changes nothing.
 *   The argument shapes are checked here; the engine checks each node (allocated, taggable, an attribute
 *   node) and that the allocation stays the same, putting the spec back if it wouldn't.
 * - The output is what the build now holds: the tags per weapon set and the allocated nodes' attribute
 *   choices (from the engine's export of the active spec), and Str, Dex and Int.
 */
import type { LuaHandlerContext } from "./luaHandlers.js";
import { ATTRIBUTE_CHOICES, type AttributeChoice } from "../engine/schemas.js";
import { wrapHandler } from "../utils/errorHandling.js";

export type TreeStateContext = Pick<LuaHandlerContext, "getLuaClient" | "ensureLuaClient">;

export interface SetTreeStateArgs {
  weaponSetNodes?: unknown;
  attributeChoices?: unknown;
}

const WEAPON_SETS = ["1", "2"] as const;
/** PoB's attribute option names, in C-40's order (the export's `strNodes`, `dexNodes`, `intNodes`). */
const ATTRIBUTE_NAMES: Record<AttributeChoice, string> = { strength: "Strength", dexterity: "Dexterity", intelligence: "Intelligence" };
const OVERRIDE_ATTRS: Record<AttributeChoice, string> = { strength: "strNodes", dexterity: "dexNodes", intelligence: "intNodes" };

interface Request {
  weaponSets?: Record<string, 1 | 2>;
  attributeChoices?: Record<string, AttributeChoice>;
}

const isObject = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === "object" && !Array.isArray(v);

/** A node id as given (a string or a whole number), as its decimal string, or undefined. */
function nodeId(value: unknown): string | undefined {
  if (typeof value === "number" && Number.isInteger(value) && value >= 0) return String(value);
  if (typeof value === "string" && /^\s*\d+\s*$/.test(value)) return String(Number(value));
  return undefined;
}

/** Checks the argument shapes; every problem is reported, each naming the node (or the entry) and why. */
function parseArgs(args: SetTreeStateArgs): Request {
  const problems: string[] = [];
  const req: Request = {};

  if (args.weaponSetNodes != null) {
    if (!isObject(args.weaponSetNodes)) {
      throw new Error('weapon_set_nodes must be an object of node id lists by weapon set, such as {"1": ["12345"], "2": ["23456"]}');
    }
    const setOf = new Map<string, Set<string>>();
    for (const [key, list] of Object.entries(args.weaponSetNodes)) {
      if (!(WEAPON_SETS as readonly string[]).includes(key)) {
        problems.push(`weapon set "${key}": the weapon set must be 1 or 2`);
        continue;
      }
      if (!Array.isArray(list)) {
        problems.push(`weapon set ${key}: must be a list of node ids`);
        continue;
      }
      for (const entry of list) {
        const id = nodeId(entry);
        if (id === undefined) {
          problems.push(`node ${JSON.stringify(entry)} in weapon set ${key}: not a node id`);
          continue;
        }
        const sets = setOf.get(id) ?? new Set<string>();
        sets.add(key);
        setOf.set(id, sets);
      }
    }
    const weaponSets: Record<string, 1 | 2> = {};
    for (const [id, sets] of setOf) {
      if (sets.size > 1) problems.push(`node ${id}: listed in both weapon set 1 and weapon set 2`);
      else weaponSets[id] = Number([...sets][0]) as 1 | 2;
    }
    req.weaponSets = weaponSets;
  }

  if (args.attributeChoices != null) {
    if (!isObject(args.attributeChoices)) {
      throw new Error('attribute_choices must be an object of node id to attribute, such as {"12345": "intelligence"}');
    }
    const choices: Record<string, AttributeChoice> = {};
    for (const [key, value] of Object.entries(args.attributeChoices)) {
      const id = nodeId(key);
      if (id === undefined) {
        problems.push(`node ${JSON.stringify(key)} in attribute_choices: not a node id`);
      } else if (typeof value !== "string" || !(ATTRIBUTE_CHOICES as readonly string[]).includes(value)) {
        problems.push(`node ${id}: the attribute must be strength, dexterity or intelligence, not ${JSON.stringify(value)}`);
      } else {
        choices[id] = value as AttributeChoice;
      }
    }
    if (Object.keys(args.attributeChoices).length > 0) req.attributeChoices = choices;
  }

  if (problems.length > 0) throw new Error(problems.join("; "));
  if (!req.weaponSets && !req.attributeChoices) {
    throw new Error("nothing to set: give weapon_set_nodes, attribute_choices or both");
  }
  return req;
}

/** One attribute of an XML start tag, wherever it sits among the others. */
function attr(tag: string, name: string): string | undefined {
  const m = new RegExp(`\\s${name}="([^"]*)"`).exec(tag);
  return m ? m[1] : undefined;
}

/** A comma-separated id list as sorted numbers. */
function idList(list: string | undefined): number[] {
  return [...new Set((list ?? "").split(",").map((s) => s.trim()).filter((s) => /^\d+$/.test(s)).map(Number))].sort((a, b) => a - b);
}

export interface SpecTreeState {
  /** Weapon set → its tagged node ids (`<WeaponSet1/2 nodes>`). */
  weaponSets: Record<"1" | "2", number[]>;
  /** Attribute → the node ids set to it (`<AttributeOverride strNodes dexNodes intNodes>`). */
  choices: Record<AttributeChoice, number[]>;
}

/** The active spec's weapon-set tags and attribute choices, as PoB's export (`PassiveSpec:Save`) writes them. */
export function activeSpecTreeState(xml: string): SpecTreeState {
  const treeTag = /<Tree\b[^>]*>/.exec(xml)?.[0] ?? "";
  const active = Number(attr(treeTag, "activeSpec") ?? "1");
  const specs = [...xml.matchAll(/<Spec\b[^>]*?(?:\/>|>([\s\S]*?)<\/Spec>)/g)];
  const body = (specs[active - 1] ?? specs[specs.length - 1])?.[1] ?? "";
  const state: SpecTreeState = { weaponSets: { "1": [], "2": [] }, choices: { strength: [], dexterity: [], intelligence: [] } };
  for (const m of body.matchAll(/<WeaponSet([12])\b[^>]*>/g)) state.weaponSets[m[1] as "1" | "2"] = idList(attr(m[0], "nodes"));
  const override = /<AttributeOverride\b[^>]*>/.exec(body)?.[0];
  if (override) {
    for (const choice of ATTRIBUTE_CHOICES) state.choices[choice] = idList(attr(override, OVERRIDE_ATTRS[choice]));
  }
  return state;
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
const listOf = (ids: number[]) => (ids.length > 0 ? ids.join(", ") : "none");
const statValue = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? String(Math.round(v * 100) / 100) : "unknown");

function render(req: Request, state: SpecTreeState, allocated: Set<number>, stats: Record<string, unknown>): string {
  const changed: string[] = [];
  if (req.weaponSets) changed.push("weapon-set tags replaced");
  if (req.attributeChoices) changed.push(`${plural(Object.keys(req.attributeChoices).length, "attribute choice", "attribute choices")} applied`);
  const lines = ["=== Tree State (active passive tree spec) ===", "", `✅ ${changed.join("; ")}.`, ""];
  for (const set of WEAPON_SETS) {
    const ids = state.weaponSets[set];
    lines.push(`Weapon set ${set} (${plural(ids.length, "node", "nodes")}): ${listOf(ids)}`);
  }
  lines.push("", "Attribute choices of allocated nodes:");
  for (const choice of ATTRIBUTE_CHOICES) {
    const ids = state.choices[choice].filter((id) => allocated.has(id));
    lines.push(`  ${ATTRIBUTE_NAMES[choice]} (${ids.length}): ${listOf(ids)}`);
  }
  lines.push("", `Attributes: Str ${statValue(stats.Str)}, Dex ${statValue(stats.Dex)}, Int ${statValue(stats.Int)}`);
  return lines.join("\n");
}

export async function handleSetTreeState(context: TreeStateContext, args: SetTreeStateArgs) {
  return wrapHandler("set tree state", async () => {
    const req = parseArgs(args);

    await context.ensureLuaClient();
    const luaClient = context.getLuaClient();
    if (!luaClient) throw new Error("Lua client not initialized. Use lua_start first.");

    // The spec's own nodes, class and tree version: only the tags and choices change (C-40).
    const current = await luaClient.getTree();
    const tree = await luaClient.setTree({
      classId: current.classId,
      ascendClassId: current.ascendClassId,
      secondaryAscendClassId: current.secondaryAscendClassId,
      nodes: current.nodes,
      treeVersion: current.treeVersion,
      ...(req.weaponSets ? { weaponSets: req.weaponSets } : {}),
      ...(req.attributeChoices ? { attributeChoices: req.attributeChoices } : {}),
    });
    const state = activeSpecTreeState(await luaClient.exportBuildXml());
    const stats = await luaClient.getStats(["Str", "Dex", "Int"]);
    const text = render(req, state, new Set(tree.nodes), stats);
    return { content: [{ type: "text" as const, text }] };
  });
}
