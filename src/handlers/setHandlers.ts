/**
 * `manage_sets` (C-39): the loaded build's item, skill and config sets, and its loadouts, through the
 * engine's `manage_sets` action (`pob-api/API/Sets.lua`).
 *
 * - item, skill and config sets: `list`, `create` (the next id, `title`), `copy` (set `id` as a new set,
 *   titled `title`, or the source's title without its {id} tag plus " (Copy)", D-245), `rename` (set `id`
 *   to `title`) and `select` (set `id`); create and copy don't activate the new set;
 * - loadouts: `list` (PoB's synced loadout menu) and `select` (the loadout named `title`), nothing else;
 * - `use_second_weapon_set` (item sets only) is written on the set the action targets: the new set, or `id`.
 *
 * `list` runs as a `read` (D-244: the router's per-call kind rule); every other action as a `mutate`.
 * There is no delete (R-29). Every call shows the type's list: ids, titles and the active one; item sets
 * also their weapon set, skill sets also their group at the build-wide main socket group index, or none.
 * Argument shapes and combinations are checked here; the set ids, the loadout names and PoB's {id} title
 * rule (at most one tag, at the end, of non-empty ids; D-245) are checked by Lua, which changes nothing when a
 * check fails.
 */
import type { LuaHandlerContext } from "./luaHandlers.js";
import {
  SET_ACTIONS,
  SET_TYPES,
  type LoadoutEntry,
  type ManageSetsResult,
  type SetAction,
  type SetEntry,
  type SetType,
} from "../engine/schemas.js";
import { wrapHandler } from "../utils/errorHandling.js";

export type SetsContext = Pick<LuaHandlerContext, "getLuaClient" | "ensureLuaClient">;

export interface ManageSetsArgs {
  setType?: unknown;
  action?: unknown;
  id?: unknown;
  title?: unknown;
  useSecondWeaponSet?: unknown;
}

interface Request {
  setType: SetType;
  action: SetAction;
  id?: number;
  title?: string;
  useSecondWeaponSet?: boolean;
}

/** A loadout's actions: the rest act on one set type at a time (C-39). */
const LOADOUT_ACTIONS: readonly SetAction[] = ["list", "select"];

const TYPE_LABEL: Record<Exclude<SetType, "loadout">, string> = {
  item: "item set",
  skill: "skill set",
  config: "config set",
};

function oneOf<T extends string>(value: unknown, allowed: readonly T[], name: string): T {
  if (typeof value !== "string" || !(allowed as readonly string[]).includes(value)) {
    throw new Error(`${name} must be one of ${allowed.join(", ")} (received: ${JSON.stringify(value ?? null)})`);
  }
  return value as T;
}

export function parseManageSetsArgs(args: ManageSetsArgs): Request {
  const setType = oneOf(args.setType, SET_TYPES, "set_type");
  const action = oneOf(args.action, SET_ACTIONS, "action");
  if (setType === "loadout" && !LOADOUT_ACTIONS.includes(action)) {
    throw new Error(
      `a loadout takes only list and select, not ${action}: create, copy or rename its item, skill and config sets (and its tree spec) one at a time`,
    );
  }
  let id: number | undefined;
  if (args.id != null) {
    if (typeof args.id !== "number" || !Number.isInteger(args.id) || args.id < 1) {
      throw new Error(`id must be a whole number of 1 or more (received: ${JSON.stringify(args.id)})`);
    }
    id = args.id;
  }
  let title: string | undefined;
  if (args.title != null) {
    if (typeof args.title !== "string") throw new Error("title must be a string");
    title = args.title;
  }
  let useSecondWeaponSet: boolean | undefined;
  if (args.useSecondWeaponSet != null) {
    if (setType !== "item") throw new Error("use_second_weapon_set applies only to item sets (set_type item)");
    if (typeof args.useSecondWeaponSet !== "boolean") throw new Error("use_second_weapon_set must be true or false");
    useSecondWeaponSet = args.useSecondWeaponSet;
  }

  const given = [id !== undefined && "id", title !== undefined && "title", useSecondWeaponSet !== undefined && "use_second_weapon_set"].filter(
    (x): x is string => typeof x === "string",
  );
  if (action === "list") {
    if (given.length > 0) throw new Error(`list takes no ${given.join(", ")}`);
  } else if (setType === "loadout") {
    // A loadout select: by name.
    if (id !== undefined) throw new Error("a loadout select takes no id: give the loadout's name as title, as list shows it");
    if (title === undefined || title.trim() === "") throw new Error("a loadout select needs title: the loadout's name, as list shows it");
  } else if (action === "create") {
    if (id !== undefined) throw new Error("create takes no id: the new set gets the next id");
    if (title === undefined || title.trim() === "") throw new Error("create needs a title");
  } else {
    if (id === undefined) throw new Error(`${action} needs id: the ${TYPE_LABEL[setType]} to ${action}`);
    if (action === "rename" && (title === undefined || title.trim() === "")) throw new Error("rename needs the new title");
    if (action === "select" && title !== undefined) throw new Error("select takes no title (rename changes a title)");
    if (action === "copy" && title !== undefined && title.trim() === "") throw new Error("title must not be blank");
  }
  return {
    setType,
    action,
    ...(id !== undefined ? { id } : {}),
    ...(title !== undefined ? { title } : {}),
    ...(useSecondWeaponSet !== undefined ? { useSecondWeaponSet } : {}),
  };
}

const arr = <T>(v: T[] | Record<string, never> | undefined): T[] => (Array.isArray(v) ? v : []);

function setLine(setType: Exclude<SetType, "loadout">, set: SetEntry, mainSocketGroup: number | undefined): string {
  let line = `${set.id}. "${set.title}"${set.active ? " [active]" : ""}`;
  if (setType === "item") line += ` | second weapon set: ${set.useSecondWeaponSet ? "yes" : "no"}`;
  if (setType === "skill") {
    const group = set.mainGroup;
    if (group) {
      const skills = arr(group.skills);
      const label = group.label && group.label.trim() !== "" ? `"${group.label}"` : "(none)";
      line += ` | main group ${group.index}: label ${label}; active skills: ${skills.length > 0 ? skills.join(", ") : "none"}`;
    } else {
      line += ` | main group ${mainSocketGroup ?? "-"}: none`;
    }
  }
  return line;
}

function loadoutLine(l: LoadoutEntry): string {
  const ids =
    l.specId !== undefined
      ? `tree spec ${l.specId}, item set ${l.itemSetId ?? "-"}, skill set ${l.skillSetId ?? "-"}, config set ${l.configSetId ?? "-"}`
      : "its sets could not be resolved";
  return `- "${l.name}"${l.active ? " [active]" : ""} | ${ids}`;
}

function headline(req: Request, result: ManageSetsResult): string | undefined {
  if (req.setType === "loadout") {
    if (req.action !== "select") return undefined;
    const l = arr(result.loadouts).find((x) => x.name === req.title);
    const sets = l && l.specId !== undefined
      ? `: tree spec ${l.specId}, item set ${l.itemSetId}, skill set ${l.skillSetId} and config set ${l.configSetId} are active`
      : "";
    return `Selected loadout "${req.title}"${sets}. Stats were recalculated.`;
  }
  const label = TYPE_LABEL[req.setType];
  const target = arr(result.sets).find((s) => s.id === result.targetId);
  const title = target ? `"${target.title}"` : "";
  switch (req.action) {
    case "create":
      return `Created ${label} ${result.targetId} ${title}; it is not active (select it with action select, id ${result.targetId}).`;
    case "copy":
      return `Copied ${label} ${req.id} to ${label} ${result.targetId} ${title}; it is not active (select it with action select, id ${result.targetId}).`;
    case "rename":
      return `Renamed ${label} ${result.targetId} to ${title}.`;
    case "select":
      return `Selected ${label} ${result.targetId} ${title}. Stats were recalculated; item, gem and config tools now edit this set.`;
    default:
      return undefined;
  }
}

export function renderManageSets(req: Request, result: ManageSetsResult): string {
  const lines: string[] = [];
  const head = headline(req, result);
  if (head) lines.push(head, "");
  if (req.setType === "loadout") {
    const loadouts = arr(result.loadouts);
    if (loadouts.length === 0) {
      lines.push(
        "No loadouts. A loadout is a tree spec plus an item, skill and config set whose titles share a {id} tag (or the same plain title); a type with only one set joins every loadout.",
      );
    } else {
      lines.push(`Loadouts (${loadouts.length}), as PoB's loadout menu lists them:`);
      for (const l of loadouts) lines.push(loadoutLine(l));
    }
    return lines.join("\n");
  }
  const sets = arr(result.sets);
  const plural = TYPE_LABEL[req.setType].replace(/^./, (c) => c.toUpperCase()) + "s";
  const active = result.activeId !== undefined ? `; active: ${result.activeId}` : "";
  if (req.setType === "skill") {
    lines.push(
      `${plural} (${sets.length}${active}). The main socket group index, ${result.mainSocketGroup ?? "-"}, is shared by every skill set:`,
    );
  } else {
    lines.push(`${plural} (${sets.length}${active}):`);
  }
  for (const set of sets) lines.push(setLine(req.setType, set, result.mainSocketGroup));
  return lines.join("\n");
}

export async function handleManageSets(context: SetsContext, args: ManageSetsArgs) {
  return wrapHandler("manage sets", async () => {
    const req = parseManageSetsArgs(args);
    await context.ensureLuaClient();
    const luaClient = context.getLuaClient();
    if (!luaClient) throw new Error("Lua client not initialized. Use lua_start first.");
    const result = await luaClient.manageSets(req);
    return { content: [{ type: "text" as const, text: renderManageSets(req, result) }] };
  });
}
