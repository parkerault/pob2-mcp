/**
 * Tool Schemas
 *
 * Defines all MCP tool schemas for the PoB server.
 * These schemas describe the available tools, their parameters, and documentation.
 */

export interface ToolSchema {
  name: string;
  description: string;
  inputSchema: {
    type: "object";
    properties: Record<string, { type: string; description?: string; enum?: string[]; items?: { type: string }; default?: unknown }>;
    required?: string[];
  };
}

/**
 * PoE2 equipment slots (WU-11): PoB2's `baseSlots` (`Classes/ItemsTab.lua`) minus the `Arm 1/2` and
 * `Leg 1/2` slots, plus each weapon's swap slot, in PoB's slot order.
 */
export const ITEM_SLOTS = [
  "Weapon 1", "Weapon 1 Swap", "Weapon 2", "Weapon 2 Swap",
  "Helmet", "Body Armour", "Gloves", "Boots", "Amulet", "Ring 1", "Ring 2", "Ring 3", "Belt",
  "Charm 1", "Charm 2", "Charm 3", "Flask 1", "Flask 2",
] as const;

/**
 * The pinned passive tree's jewel sockets (C-46): every node with `type == "Socket"` or `containJewelSocket`
 * in `build.latestTree.nodes`, ascending, as PoB's ItemsTab orders their `Jewel <id>` slots (19 at the pin).
 */
export const TREE_JEWEL_SOCKETS = [
  2491, 3367, 7960, 11184, 17788, 21984, 23960, 26178, 26196, 26725,
  32763, 39087, 46882, 54127, 55190, 60735, 61419, 61834, 62152,
] as const;

/**
 * `add_item`'s slots (C-46, D-223): `ITEM_SLOTS`, then a `Jewel <id>` slot per tree jewel socket. Only
 * `add_item` takes them; the shared `ITEM_SLOTS` is unchanged.
 */
export const ADD_ITEM_SLOTS = [...ITEM_SLOTS, ...TREE_JEWEL_SOCKETS.map((id) => `Jewel ${id}`)];

/** The slots with an activation toggle in PoB2: flasks and charms (`toggle_flask`). */
export const ACTIVATABLE_SLOTS = ["Flask 1", "Flask 2", "Charm 1", "Charm 2", "Charm 3"] as const;

/**
 * Get all tool schemas for registration with the MCP server
 */
export function getToolSchemas(): ToolSchema[] {
  return [
    {
      name: "analyze_build",
      description: "Analyze a Path of Building 2 build file: the file's stats, skills, gear, configuration, passive tree (keystones, notables, jewel sockets, archetype) and validation, plus live stats the PoB2 engine computes for that file. The file is loaded into the engine temporarily and the engine's working build is put back afterwards, so the loaded build and its unsaved changes are never replaced.",
      inputSchema: {
        type: "object",
        properties: {
          build_name: {
            type: "string",
            description: "Build file, relative to the builds folder (e.g. 'MyBuild.xml' or 'league/MyBuild'; .xml is optional)",
          },
        },
        required: ["build_name"],
      },
    },
    {
      name: "compare_builds",
      description: "Compare two Path of Building 2 build files side by side on stats the PoB2 engine computes (level, life, energy shield, EHP, DPS, resistances). Each file is loaded into the engine temporarily and the engine's working build is put back afterwards, so the loaded build and its unsaved changes are never replaced.",
      inputSchema: {
        type: "object",
        properties: {
          build1: {
            type: "string",
            description: "First build file name",
          },
          build2: {
            type: "string",
            description: "Second build file name",
          },
        },
        required: ["build1", "build2"],
      },
    },
    {
      name: "list_builds",
      description: "List every Path of Building 2 build (.xml) in the builds folder, including subfolders, as paths relative to it (e.g. 'league/Starter.xml'). Use these names with the other build tools.",
      inputSchema: {
        type: "object",
        properties: {},
      },
    },
    {
      name: "get_build_stats",
      description: "Extract specific stats from a build (Life, DPS, resistances, etc.)",
      inputSchema: {
        type: "object",
        properties: {
          build_name: {
            type: "string",
            description: "Name of the build file",
          },
        },
        required: ["build_name"],
      },
    },
    {
      name: "start_watching",
      description: "Start tracking changes to build files in the builds folder (including subfolders; polling on /mnt/ drives). Watching only records recent changes (see get_recent_changes) and refreshes cached file reads. It does not reload the engine: reloading the engine's build happens on the next engine call, which checks the loaded file on disk whether or not watching is on.",
      inputSchema: {
        type: "object",
        properties: {},
      },
    },
    {
      name: "stop_watching",
      description: "Stop tracking changes to build files. The engine's own check of the loaded file on each engine call is unaffected.",
      inputSchema: {
        type: "object",
        properties: {},
      },
    },
    {
      name: "get_recent_changes",
      description: "List build files that changed while watching was on (paths relative to the builds folder), newest first.",
      inputSchema: {
        type: "object",
        properties: {
          limit: {
            type: "number",
            description: "Maximum number of recent changes to return (default: 10)",
          },
        },
      },
    },
    {
      name: "watch_status",
      description: "Show whether change tracking (start_watching) is on, the watched folder and how many changes were recorded.",
      inputSchema: {
        type: "object",
        properties: {},
      },
    },
    {
      name: "compare_trees",
      description: "Compare passive skill trees between two builds, showing differences in allocated nodes",
      inputSchema: {
        type: "object",
        properties: {
          build1: {
            type: "string",
            description: "First build file name",
          },
          build2: {
            type: "string",
            description: "Second build file name",
          },
        },
        required: ["build1", "build2"],
      },
    },
    {
      name: "get_nearby_nodes",
      description: "Find notable and keystone passives near your current tree allocation. Uses loaded Lua bridge build when no build_name is provided.",
      inputSchema: {
        type: "object",
        properties: {
          build_name: {
            type: "string",
            description: "Build file to analyze (optional if a build is loaded via lua_load_build)",
          },
          max_distance: {
            type: "number",
            description: "Maximum path distance to search (default: 5)",
          },
          filter: {
            type: "string",
            description: "Optional text filter for node names/stats",
          },
        },
      },
    },
    {
      name: "find_path_to_node",
      description: "Find the shortest path from your current tree to a specific passive node. Uses loaded Lua bridge build when no build_name is provided.",
      inputSchema: {
        type: "object",
        properties: {
          build_name: {
            type: "string",
            description: "Build to analyze (optional if a build is loaded via lua_load_build)",
          },
          target_node_id: {
            type: "string",
            description: "ID of the target passive node",
          },
          show_alternatives: {
            type: "boolean",
            description: "Return up to 3 alternative paths instead of just the shortest (default: false)",
          },
        },
        required: ["target_node_id"],
      },
    },
    {
      name: "get_build_notes",
      description: "Read the notes/documentation from a PoB build file",
      inputSchema: {
        type: "object",
        properties: {
          build_name: { type: "string", description: "Name of the build file (e.g., 'MyBuild.xml')" },
        },
        required: ["build_name"],
      },
    },
    {
      name: "set_build_notes",
      description: "Replace the notes in a build file in the builds folder. The previous file is backed up to the server's state folder first. Refused if the file changed on disk since the engine loaded or saved it (reload it first). If the engine has that file loaded with no unsaved changes, its next engine call reloads it.",
      inputSchema: {
        type: "object",
        properties: {
          build_name: { type: "string", description: "Name of the build file" },
          notes: { type: "string", description: "Notes content to write (plain text or markdown)" },
        },
        required: ["build_name", "notes"],
      },
    },
    {
      name: "encode_build_code",
      description: "Encode a build file from the builds folder as a Path of Building 2 import code, in the form PoB2's Build Sharing section generates and import_build accepts. Returns the file's path relative to the builds folder, its size in bytes and the code, on one line. The code is made from the file's exact bytes, so decoding it gives the file back unchanged, with its skill, item, tree and config sets, loadouts, level and level mode. Only PoE2 builds (a <PathOfBuilding2> document) are accepted. It reads the file only, and never starts or changes the engine.",
      inputSchema: {
        type: "object",
        properties: {
          build_name: {
            type: "string",
            description: "Build file, relative to the builds folder (e.g. 'MyBuild.xml' or 'league/MyBuild'; .xml is optional)",
          },
        },
        required: ["build_name"],
      },
    },
  ];
}

/**
 * Get Lua-specific tool schemas (only included if Lua is enabled)
 */
export function getLuaToolSchemas(): any[] {
  return [
    {
      name: "lua_start",
      description: "Start the PoB headless API process. This will spawn the LuaJIT process that can load builds and compute stats using the actual PoB calculation engine.",
      inputSchema: {
        type: "object",
        properties: {},
      },
    },
    {
      name: "lua_stop",
      description: "Stop the PoB headless API process and clean up resources.",
      inputSchema: {
        type: "object",
        properties: {},
      },
    },
    {
      name: "lua_new_build",
      description: "Create a new blank build with specified class and ascendancy. Auto-starts the Lua bridge if needed (no need to call lua_start first). Use get_classes for the PoE2 class and ascendancy names the engine knows.",
      inputSchema: {
        type: "object",
        properties: {
          class_name: { type: "string", description: "Class name (e.g., 'Witch', 'Mercenary'; see get_classes)" },
          ascendancy: { type: "string", description: "Ascendancy class name (optional)" },
        },
        required: ["class_name"],
      },
    },
    {
      name: "lua_save_build",
      description: "Save the engine's current build (everything loaded or changed in the PoB engine, including tree, item, gem and config changes) to a build file in your builds folder, as PoB2 XML. Saving under a new name makes that file the loaded build (like PoB's Save As). An existing file is only replaced with overwrite: true, and a backup of it is kept in the server's state directory. The save is refused if the file changed on disk since the engine loaded or saved it (for example, saved in PoB2); reload it first (lua_reload_build) or save under a new name. Required before using file-based tools (validate_build, analyze_build, etc.) on an in-memory build.",
      inputSchema: {
        type: "object",
        properties: {
          build_name: {
            type: "string",
            description: "Output file name relative to the builds folder (e.g., 'MyBuild' or 'sub/MyBuild.xml'). .xml is added if missing; a missing subfolder is created.",
          },
          overwrite: {
            type: "boolean",
            description: "Replace the file if it already exists (default false). The previous file is backed up first. Never overrides the changed-on-disk refusal.",
          },
        },
        required: ["build_name"],
      },
    },
    {
      name: "lua_load_build",
      description: "Load a build file into the PoB calculation engine. Required before using other lua_* tools. AUTO-RETURNS a brief summary (life, DPS, EHP, resistances, top issues) — do NOT immediately follow with lua_get_stats or get_build_issues just to get basic numbers. Call additional tools only when you need details beyond the summary.",
      inputSchema: {
        type: "object",
        properties: {
          build_name: {
            type: "string",
            description: "Name of the build file to load",
          },
        },
        required: ["build_name"],
      },
    },
    {
      name: "list_specs",
      description: "List all passive tree specs in the currently loaded build. Each spec can have a different tree allocation, class, and ascendancy.",
      inputSchema: { type: "object", properties: {} },
    },
    {
      name: "select_spec",
      description: "Switch the active passive tree spec in the currently loaded build. Recalculates all stats with the selected spec.",
      inputSchema: {
        type: "object",
        properties: {
          index: { type: "number", description: "Spec index (1-based, use list_specs to see available specs)" },
        },
        required: ["index"],
      },
    },
    {
      name: "create_spec",
      description: "Create a new passive tree spec in the current build. Use for leveling guides: create specs titled 'Level 10', 'Level 20', etc. with different tree allocations. Use copyFrom to start from an existing spec and modify.",
      inputSchema: {
        type: "object",
        properties: {
          title: { type: "string", description: "Title for the new spec (e.g. 'Level 40 Tree')" },
          copyFrom: { type: "number", description: "Spec index (1-based) to copy class/ascendancy/nodes from" },
          activate: { type: "boolean", description: "Whether to switch to the new spec (default: true)" },
        },
      },
    },
    {
      name: "delete_spec",
      description: "Delete a passive tree spec from the current build. Cannot delete the last remaining spec or the currently active spec (switch first with select_spec).",
      inputSchema: {
        type: "object",
        properties: {
          index: { type: "number", description: "Spec index to delete (1-based, use list_specs to see available specs)" },
        },
        required: ["index"],
      },
    },
    {
      name: "rename_spec",
      description: "Rename a passive tree spec in the current build.",
      inputSchema: {
        type: "object",
        properties: {
          index: { type: "number", description: "Spec index to rename (1-based)" },
          title: { type: "string", description: "New title for the spec" },
        },
        required: ["index", "title"],
      },
    },
    {
      name: "list_item_sets",
      description: "List all item sets in the currently loaded build. Each item set can have different gear equipped.",
      inputSchema: { type: "object", properties: {} },
    },
    {
      name: "select_item_set",
      description: "Switch the active item set in the currently loaded build. Recalculates all stats with the selected item set.",
      inputSchema: {
        type: "object",
        properties: {
          id: { type: "number", description: "Item set ID (use list_item_sets to see available item sets)" },
        },
        required: ["id"],
      },
    },
    {
      name: "manage_sets",
      description: "Manage the loaded build's item, skill and config sets, and its loadouts. set_type is item, skill, config or loadout; action is list, create, copy, rename or select. create adds a set with the next id and the given title; copy duplicates set id (its gear, its socket groups and gems, or its config inputs) as a new set titled title, or else the source's title without its {id} tag plus ' (Copy)'; neither activates the new set. rename gives set id a new title. select makes set id active, so the item, gem and config tools edit that set from then on. A loadout takes only list and select: PoB pairs a tree spec with one item, skill and config set whose titles share a {id} tag, such as 'Act 2 (L25) {2}', or the same plain title, and a type with only one set joins every loadout; a loadout select takes the loadout's name as title and activates all four. A title may end with one {...} tag of comma-separated ids of letters and digits, no spaces ('Early {1,2}' joins loadouts 1 and 2); any other use of braces is refused, since PoB links a set by its first tag only. use_second_weapon_set (item sets only) sets weapon set II on the set the action targets: the new set, or set id. There is no delete. Every call returns the type's sets with ids, titles and the active one; item sets show their weapon set, and skill sets show their group at the build's main socket group index (one index shared by every skill set), or none. Every action except list recalculates the stats.",
      inputSchema: {
        type: "object",
        properties: {
          set_type: {
            type: "string",
            enum: ["item", "skill", "config", "loadout"],
            description: "Which sets: item, skill or config sets, or loadouts",
          },
          action: {
            type: "string",
            enum: ["list", "create", "copy", "rename", "select"],
            description: "list, create, copy, rename or select; a loadout takes only list and select",
          },
          id: {
            type: "integer",
            minimum: 1,
            description: "The set to copy (copy), rename (rename) or activate (select), as list shows it",
          },
          title: {
            type: "string",
            description: "The new set's title (create; optional for copy), the new title (rename), or the loadout's name (loadout select)",
          },
          use_second_weapon_set: {
            type: "boolean",
            description: "Item sets only: true uses weapon set II, false weapon set I, on the set the action targets",
          },
        },
        required: ["set_type", "action"],
      },
    },
    {
      name: "set_character_level",
      description: "Set the character level for the currently loaded build. Recalculates all stats.",
      inputSchema: {
        type: "object",
        properties: {
          level: {
            type: "number",
            description: "Character level (1-100)",
          },
        },
        required: ["level"],
      },
    },
    {
      name: "lua_get_stats",
      description: "Get comprehensive calculated stats from the currently loaded build (requires lua_load_build first). Use category='offense' for DPS details, category='defense' for survivability, category='all' only when you need everything at once. Avoid calling multiple times with different categories — pick the right one. The offense view measures only the main skill and its selected stat set; breakdown=true measures the offense fields for every active skill of one socket group and every stat set of each (PoB2's skill parts, e.g. a grenade's impact and its explosion), one block per skill and stat set, then leaves the build exactly as it was.",
      inputSchema: {
        type: "object",
        properties: {
          category: {
            type: "string",
            description: "Stat category: 'offense', 'defense', 'all' (default: all). With breakdown, only 'offense' (or leave it out).",
          },
          breakdown: {
            type: "boolean",
            description: "Measure the offense fields per active skill and per stat set of one socket group, each as the main selection; the build is restored afterwards (default: false).",
          },
          group_index: {
            type: "number",
            description: "With breakdown: the socket group to measure (1-based; default: the main socket group).",
          },
        },
      },
    },
    {
      name: "lua_get_tree",
      description: "Get passive tree allocation from currently loaded build",
      inputSchema: {
        type: "object",
        properties: {
          include_node_ids: {
            type: "boolean",
            description: "Include the full list of allocated node IDs in the response (default: false). Omit unless you need to pass node IDs to another tool.",
          },
        },
      },
    },
    {
      name: "lua_set_tree",
      description: "Set passive tree allocation (modifies currently loaded build). IMPORTANT: (1) All nodes must form a connected path from the class start node — any node not reachable through other allocated nodes back to the start will be silently dropped. Use find_path_to_node first to discover the intermediate travel nodes needed to reach your target. (2) Maximum 8 ascendancy points — do not allocate more than 8 ascendancy nodes (excluding the ascendancy start node).",
      inputSchema: {
        type: "object",
        properties: {
          nodes: {
            type: "array",
            items: { type: "string" },
            description: "Array of node IDs to allocate",
          },
          classId: {
            type: "number",
            description: "Engine class ID (see get_classes). If omitted, preserves current class.",
          },
          ascendClassId: {
            type: "number",
            description: "Engine ascendancy ID within the class (0 = none; see get_classes). If omitted, preserves current ascendancy.",
          },
        },
        required: ["nodes"],
      },
    },
    {
      name: "update_tree_delta",
      description: "Incrementally add or remove specific passive nodes from the current tree allocation. Automatically finds and includes intermediate path nodes when adding nodes that aren't directly adjacent to the current tree. Safer than lua_set_tree because you only specify the nodes to change, not the entire tree. Note: max 8 ascendancy points allowed.",
      inputSchema: {
        type: "object",
        properties: {
          add_nodes: {
            type: "array",
            items: { type: "string" },
            description: "Node IDs to add to the current allocation",
          },
          remove_nodes: {
            type: "array",
            items: { type: "string" },
            description: "Node IDs to remove from the current allocation",
          },
        },
      },
    },
    {
      name: "set_tree_state",
      description: "Set the active passive tree spec's weapon-set passives and attribute choices, without changing which nodes are allocated. weapon_set_nodes replaces the weapon-set tags: the allocated nodes listed under \"1\" or \"2\" are tagged with that weapon set (PoB applies their stats only while that weapon set is in use), and every other allocated node is untagged. attribute_choices sets attribute nodes (\"+5 to any Attribute\") to strength, dexterity or intelligence; every other node keeps its choice. Give at least one of the two. All or nothing: a node that isn't allocated, a weapon-set node PoB never tags (a keystone, an ascendancy node, a jewel socket, a class start node), a node in both weapon sets, a choice on a node that isn't an attribute node, a value other than those listed, or tags that would disconnect a node (PoB connects an untagged node only through untagged nodes, and a tagged node through untagged nodes and nodes of its own set) fails the call, naming each node and the reason, and nothing changes. Returns the tagged nodes per weapon set, the allocated nodes' attribute choices, and the resulting Str, Dex and Int.",
      inputSchema: {
        type: "object",
        properties: {
          weapon_set_nodes: {
            type: "object",
            description: "Allocated node IDs to tag, by weapon set: {\"1\": [ids], \"2\": [ids]}. Replaces every tag; {} untags every node.",
            properties: {
              "1": { type: "array", items: { type: "string" }, description: "Node IDs tagged with weapon set 1" },
              "2": { type: "array", items: { type: "string" }, description: "Node IDs tagged with weapon set 2" },
            },
            additionalProperties: false,
          },
          attribute_choices: {
            type: "object",
            description: "Allocated attribute node ID → \"strength\", \"dexterity\" or \"intelligence\", applied over the current choices",
            additionalProperties: { type: "string", enum: ["strength", "dexterity", "intelligence"] },
          },
        },
      },
    },
    {
      name: "lua_get_build_info",
      description: "Get metadata about the currently loaded build: name, character level, class, ascendancy, and tree version. Useful to confirm which build is active after lua_load_build or lua_new_build. Class and ascendancy are the engine's PoE2 names for the active passive tree spec.",
      inputSchema: {
        type: "object",
        properties: {},
      },
    },
    {
      name: "lua_reload_build",
      description: "Reload the current build from disk, picking up any changes made in PoB GUI or via direct XML editing. If build_name is omitted, reloads the build that is currently loaded (determined via lua_get_build_info).",
      inputSchema: {
        type: "object",
        properties: {
          build_name: {
            type: "string",
            description: "Name of the build file to reload (e.g., 'MyBuild.xml'). If omitted, reloads the currently loaded build.",
          },
        },
      },
    },
    {
      name: "search_tree_nodes",
      description: "Search the passive tree for nodes whose name or stats contain `query`, or list an ascendancy's nodes with `ascendancy`. `query` is required unless `ascendancy` is given. Matches are sorted by type (keystone, notable, jewel, mastery, ascendancy, normal), then name, then node id, and then cut to `limit` (default 20, max 30). Ascendancy notables are typed notable.",
      inputSchema: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "Search query for node names or stats (optional when ascendancy is given)",
          },
          ascendancy: {
            type: "string",
            description: "Keep only this ascendancy's nodes, notables included (a name such as 'Titan', case-insensitive); an unknown name fails and lists the valid ones",
          },
          node_type: {
            type: "string",
            description: "Filter by type: 'keystone', 'notable', 'jewel', 'mastery', 'ascendancy', 'normal', or 'any' (default: no filter)",
          },
          limit: {
            type: "number",
            description: "Maximum results to return (default: 20, max 30)",
          },
        },
      },
    },
    {
      name: "list_gems",
      description: "List skill/support gems from Path of Building's authoritative PoE2 gem database (names, tags, gem family, requirements, max level). Use this for accurate PoE2 gem info instead of guessing — PoE2's uncut skill gems and support gems differ entirely from PoE1.",
      inputSchema: {
        type: "object",
        properties: {
          type: {
            type: "string",
            description: "Filter by gem kind: 'active' (skill gems) or 'support'. Omit for both.",
            enum: ["active", "support"],
          },
          search: {
            type: "string",
            description: "Case-insensitive substring match on the gem name (e.g. 'infusion', 'ice').",
          },
          tag: {
            type: "string",
            description: "Filter by a tag, matched against the gem's tag string or tag set (e.g. 'cold', 'attack', 'minion', 'aoe').",
          },
          max_results: {
            type: "number",
            description: "Maximum gems to return (default 60, max 200).",
          },
          dedupe_by_name: {
            type: "boolean",
            description: "Collapse tier/variant duplicates that share a display name (default false).",
          },
        },
      },
    },
    {
      name: "lookup_game_data",
      description: "Look up the pinned Path of Building's own game data: gems, uniques, passives and item mods. Reads only; the build is never changed. mode 'gem': gems whose name contains `query`, each with its kind, description, weapon requirement, every stat set (\"skill part\") with its base attack damage and critical hit chance and PoB's tooltip lines at `gem_level` (default: the gem's natural max level; a gem without that level is shown at its default, with a note) and `gem_quality` (default 0), the \"At +20% Quality\" lines, the requirements at every gem level (character level, and each attribute the gem needs), and for a support the skill types it supports and can't support (PoB's type expressions, in which AND, OR and NOT combine the types before them). mode 'unique': uniques whose name or any variant's mod line contains `query` (legacy \"Pre x.y\" variants are skipped), optionally only of item type `slot` (such as Gloves, Spear or Jewel; at least one of the two is needed). Each shows its base, type and matched lines, naming the variant of a line the selected variant lacks; the full item text, ready for add_item, comes only when exactly one unique is returned. mode 'mechanic': every gem description and stat-set line, unique mod line (any variant), passive node line (ascendancy nodes included) and item mod line containing `query`, one hit per line as `[kind] source: line`; `kind` lists only gem, unique, passive or mod hits, and the header counts each kind's hits. Results are sorted, then cut to max_results (default 20, max 30): exact name matches first, then by name; mechanic hits by kind (gem, unique, passive, mod), then by name.",
      inputSchema: {
        type: "object",
        properties: {
          mode: {
            type: "string",
            enum: ["gem", "unique", "mechanic"],
            description: "What to look up: 'gem', 'unique' or 'mechanic'",
          },
          query: {
            type: "string",
            description: "Case-insensitive text to find (required for gem and mechanic modes)",
          },
          gem_level: {
            type: "integer",
            minimum: 1,
            description: "Gem mode: the gem level whose stat lines are shown (default: each gem's natural max level); a returned gem without that level is shown at its default with a note, and it fails only when no returned gem has it",
          },
          gem_quality: {
            type: "integer",
            minimum: 0,
            maximum: 20,
            description: "Gem mode: the quality the stat lines include (0-20, default 0)",
          },
          slot: {
            type: "string",
            description: "Unique mode: PoB's item type, such as 'Gloves', 'Spear' or 'Jewel'; an unknown type fails and lists the valid ones",
          },
          kind: {
            type: "string",
            enum: ["gem", "unique", "passive", "mod"],
            description: "Mechanic mode: list only this kind of hit (the header still counts every kind)",
          },
          max_results: {
            type: "integer",
            minimum: 1,
            description: "Maximum results to return (default 20, max 30)",
          },
        },
        required: ["mode"],
      },
    },
    {
      name: "check_model_coverage",
      description: "Check, line by line, whether the pinned Path of Building applies an item's, a passive node's or a gem's lines, so you know which parts of a build its numbers leave out. Reads only; the build is never changed. Give one or more of `item_text` (one item, as add_item takes it), `nodes` (node ids or exact names; a name selects every node bearing it) and `gems` (gem names), or `build: true` alone for the loaded build (the active item set's equipped items, the jewels in allocated tree sockets, the active tree's allocated nodes and the active skill set's gems). Each item line (implicit, explicit, rune, enchant) and node line gets one status: 'fully parsed'; 'partly parsed' (PoB understood only part of it and applies none of the line; the remainder shows what it didn't understand); 'unparsed' (ignored); 'parsed to nothing' (read, but changes no stat); or 'possibly unread' (parsed, but a mod it makes is named nowhere in PoB's calculation code, even as a concatenated name; advisory, so confirm it by measurement before working the effect out by hand). A line PoB can't parse alone is first re-joined as PoB joins it (an item line with the next line, a node line with the lines after it); a clean join is one entry naming its lines. Each gem is checked at its level and quality in the build, else at its natural max level and quality 0: every described line of every stat set is 'fully parsed', or 'possibly unmodelled; check config' when PoB's own gem tooltip marks it unsupported (the effect may be modelled only through a config option). The output starts with the counts per status, then the entries grouped by source; build mode lists only the lines that aren't fully parsed, but its counts cover every line.",
      inputSchema: {
        type: "object",
        properties: {
          item_text: {
            type: "string",
            description: "One item's text, as add_item takes it (PoB's item format)",
          },
          nodes: {
            type: "array",
            items: { type: "string" },
            description: "Passive node ids (such as '38570') or exact node names (case-insensitive; a name selects every node bearing it)",
          },
          gems: {
            type: "array",
            items: { type: "string" },
            description: "Gem names (exact, case-insensitive), such as 'Blood Hunt' or 'Heft'",
          },
          build: {
            type: "boolean",
            description: "true checks the loaded build (equipped items, jewels in allocated tree sockets, allocated nodes, socketed gems) and can't be combined with the other inputs",
          },
        },
      },
    },
    {
      name: "get_classes",
      description: "List PoE2 classes and their ascendancies with the engine's classId / ascendancy ids (use with lua_set_tree). Authoritative — replaces the PoE1 class-ID table.",
      inputSchema: { type: "object", properties: {} },
    },
    {
      name: "import_build",
      description: "Import a PoE2 build from a Path of Building 2 export code OR a share link (pobb.in / pastebin), decode it, and load it into the engine (replacing the engine's build). Only PoE2 builds (a <PathOfBuilding2> document) are accepted, and a code may decode to at most 16 MiB. With save_as it is also saved into the builds folder and becomes the engine's loaded file. After importing, use analyze_skills / suggest_supports / analyze_defenses / validate_build / lua_get_stats.",
      inputSchema: {
        type: "object",
        properties: {
          source: {
            type: "string",
            description: "A PoB2 export code (base64) or a pobb.in/pastebin URL to the build.",
          },
          save_as: {
            type: "string",
            description: "Optional build name to also save the decoded build into your builds folder (so file-based tools like analyze_build can use it). Subfolders are allowed; .xml is optional.",
          },
          overwrite: {
            type: "boolean",
            description: "With save_as: replace an existing file of that name (default false: an existing file is an error). The previous file is backed up first.",
          },
        },
        required: ["source"],
      },
    },
    {
      name: "analyze_skills",
      description: "Analyze the loaded build's skill setup with the PoB2 engine. For each socket group: its active skills, its support gems, and whether PoB2 says each support can support the group's skills (PoB's own compatibility check), plus disabled or unknown gems. For the main socket group it also lists every support gem PoB2 says could support it that isn't in the group; other groups show the count (use suggest_supports for those).",
      inputSchema: { type: "object", properties: {} },
    },
    {
      name: "suggest_supports",
      description: "Rank the support gems that could go in a socket group by their measured effect. The candidates are every non-legacy support gem PoB2 says can support the group's active skills (PoB's own compatibility check) that isn't already in the group. Each one is measured on the requested group (made the main skill for the measurement) the way PoB2's gem selector sorts gems: added at the default gem level and quality, recalculated, and removed again. Results are ordered by the change in the build's gem-sort stat (CombinedDPS unless the build sorts gems by another stat), largest first. After the ranking, it lists what PoB can't fully measure among the whole pool: a candidate whose measurement failed (with the error), or one with a skill line PoB's own gem tooltip marks unsupported (check_model_coverage's 'possibly unmodelled'). The loaded build is left as it was.",
      inputSchema: {
        type: "object",
        properties: {
          group_index: {
            type: "number",
            description: "Socket group number to suggest supports for (see analyze_skills or get_skill_setup).",
          },
          count: {
            type: "number",
            description: "How many suggestions to return (default 8, max 20).",
          },
        },
        required: ["group_index"],
      },
    },
    {
      name: "add_item",
      description: "Add an item to the build from item text (paste from game)",
      inputSchema: {
        type: "object",
        properties: {
          item_text: {
            type: "string",
            description: "Full item text from clipboard",
          },
          slot_name: {
            type: "string",
            description: "PoE2 slot to equip the item in (it replaces what is there). Ring 3 exists only with an extra ring slot; the Swap slots are the second weapon set. 'Jewel <node id>' sockets a jewel into that passive tree jewel socket of the active tree spec (only a jewel fits; the socket applies it once allocated).",
            enum: [...ADD_ITEM_SLOTS],
          },
        },
        required: ["item_text", "slot_name"],
      },
    },
    {
      name: "get_equipped_items",
      description: "Get all currently equipped items (empty slots are omitted). Returns name, base, rarity, and all mod lines (implicit, explicit, crafted, enchant) for each equipped item. Use when you need to evaluate gear choices or read specific affixes.",
      inputSchema: {
        type: "object",
        properties: {},
      },
    },
    {
      name: "toggle_flask",
      description: "Turn a flask or charm on or off in the loaded build, as PoB2's slot checkbox does: an active flask or charm applies its effect to the calculated stats. The slot must hold an item. Returns the updated key defensive stats.",
      inputSchema: {
        type: "object",
        properties: {
          slot: {
            type: "string",
            description: "Flask or charm slot",
            enum: [...ACTIVATABLE_SLOTS],
          },
          active: {
            type: "boolean",
            description: "true to activate, false to deactivate",
          },
        },
        required: ["slot", "active"],
      },
    },
    {
      name: "get_skill_setup",
      description: "Get current skill gem setup. Default main_only=true shows only the main DPS socket group — use this first. Set main_only=false only if you need to see all utility/aura/movement groups too.",
      inputSchema: {
        type: "object",
        properties: {
          main_only: {
            type: "boolean",
            description: "Only show the main socket group (default: true). Set to false to see all socket groups.",
          },
        },
      },
    },
    {
      name: "set_main_skill",
      description: "Set which skill group is the main skill for DPS calculations, and optionally which stat set of its active skill is measured (skill_part).",
      inputSchema: {
        type: "object",
        properties: {
          group_index: {
            type: "number",
            description: "Socket group index (1-based)",
          },
          active_skill_index: {
            type: "number",
            description: "Active skill index within group (1-based, optional). Selects which active skill in the group to use for DPS calculation — relevant when a group has multiple active skills.",
          },
          skill_part: {
            type: "number",
            description: "The stat set of the main active skill to measure (1-based, optional): PoB2's stat-set choice, such as a grenade's impact or its explosion. It is saved with the build. A number outside the skill's stat sets is an error that lists them. lua_get_stats with breakdown=true shows every stat set's numbers without changing the build.",
          },
        },
        required: ["group_index"],
      },
    },
    {
      name: "create_socket_group",
      description: "Create a new socket group for skill gems",
      inputSchema: {
        type: "object",
        properties: {
          label: {
            type: "string",
            description: "Label for the socket group (e.g., 'Main Skill', 'Auras')",
          },
          slot: {
            type: "string",
            description: "Item slot for sockets (e.g., 'Weapon 1', 'Body Armour')",
            enum: [...ITEM_SLOTS],
          },
          enabled: {
            type: "boolean",
            description: "Whether group is enabled (default: true)",
          },
        },
        required: ["label"],
      },
    },
    {
      name: "add_gem",
      description: "Add a gem to a socket group by its PoE2 gem name, as PoB2's gem data spells it (case is ignored). Many PoE2 support gems come in tiers, e.g. 'Brutality I', 'Brutality II'. A support can also be named '<name> Support' (PoB's base-type name), which tells it apart from an active gem of the same name (e.g. 'Unleash' is the spell, 'Unleash Support' the support). An unknown name is rejected with up to 5 suggested names; a name several gems share is rejected with their PoB gem ids, any of which can be passed instead; list_gems searches the gem data.",
      inputSchema: {
        type: "object",
        properties: {
          group_index: {
            type: "number",
            description: "Socket group index (1-based)",
          },
          gem_name: {
            type: "string",
            description: "PoE2 gem name (e.g. 'Fireball', 'Brutality I', 'Concentrated Area')",
          },
          level: {
            type: "number",
            description: "Gem level (default: 20)",
          },
          quality: {
            type: "number",
            description: "Gem quality % (default: 0)",
          },
          enabled: {
            type: "boolean",
            description: "Whether gem is enabled (default: true)",
          },
        },
        required: ["group_index", "gem_name"],
      },
    },
    {
      name: "set_gem_level",
      description: "Set the level of a gem",
      inputSchema: {
        type: "object",
        properties: {
          group_index: {
            type: "number",
            description: "Socket group index (1-based)",
          },
          gem_index: {
            type: "number",
            description: "Gem index within group (1-based)",
          },
          level: {
            type: "number",
            description: "New gem level",
          },
        },
        required: ["group_index", "gem_index", "level"],
      },
    },
    {
      name: "set_gem_quality",
      description: "Set the quality of a gem",
      inputSchema: {
        type: "object",
        properties: {
          group_index: {
            type: "number",
            description: "Socket group index (1-based)",
          },
          gem_index: {
            type: "number",
            description: "Gem index within group (1-based)",
          },
          quality: {
            type: "number",
            description: "Quality percentage (0-23 for normal, up to 30+ for corrupted)",
          },
          quality_type: {
            type: "string",
            description: "Type: 'Default', 'Anomalous', 'Divergent', 'Phantasmal' (optional)",
          },
        },
        required: ["group_index", "gem_index", "quality"],
      },
    },
    {
      name: "set_gem_corruption",
      description: "Set the corruption state of active skill gems, like PoB2's Corrupt dropdown: not_corrupted, corrupted, plus_one_level (+1 to gem level) or minus_one_level (-1 to gem level). With group_index and gem_index: that gem. With group_index only: every active skill gem in that socket group. With neither: every active skill gem in the build's socket groups (item- and passive-granted groups excluded). Support gems can't be corrupted in PoE2: they are never changed, and naming one is an error.",
      inputSchema: {
        type: "object",
        properties: {
          state: {
            type: "string",
            enum: ["not_corrupted", "corrupted", "plus_one_level", "minus_one_level"],
            description: "Corruption state to set",
          },
          group_index: {
            type: "number",
            description: "Socket group index (1-based); omit for every socket group",
          },
          gem_index: {
            type: "number",
            description: "Gem index within group (1-based); needs group_index; omit for every active skill gem in the group",
          },
        },
        required: ["state"],
      },
    },
    {
      name: "remove_skill",
      description: "Remove an entire socket group",
      inputSchema: {
        type: "object",
        properties: {
          group_index: {
            type: "number",
            description: "Socket group index to remove (1-based)",
          },
        },
        required: ["group_index"],
      },
    },
    {
      name: "remove_gem",
      description: "Remove a specific gem from a socket group",
      inputSchema: {
        type: "object",
        properties: {
          group_index: {
            type: "number",
            description: "Socket group index (1-based)",
          },
          gem_index: {
            type: "number",
            description: "Gem index to remove (1-based)",
          },
        },
        required: ["group_index", "gem_index"],
      },
    },
    {
      name: "toggle_socket_group",
      description: "Enable or disable an entire socket group (e.g. turn off a mana reservation aura to test its effect on stats)",
      inputSchema: {
        type: "object",
        properties: {
          group_index: {
            type: "number",
            description: "Socket group index (1-based)",
          },
          enabled: {
            type: "boolean",
            description: "true to enable the group, false to disable it",
          },
        },
        required: ["group_index", "enabled"],
      },
    },
    {
      name: "toggle_gem",
      description: "Enable or disable a specific gem within a socket group",
      inputSchema: {
        type: "object",
        properties: {
          group_index: {
            type: "number",
            description: "Socket group index (1-based)",
          },
          gem_index: {
            type: "number",
            description: "Gem index within group (1-based)",
          },
          enabled: {
            type: "boolean",
            description: "true to enable the gem, false to disable it",
          },
        },
        required: ["group_index", "gem_index", "enabled"],
      },
    },
    {
      name: "setup_skill_with_gems",
      description: "Setup a complete skill with multiple support gems in one operation. Every gem name is checked first (as add_gem does), so a rejected name creates nothing. Does NOT auto-set as main skill for DPS. Call set_main_skill with the returned group_index afterward if this should be the primary DPS skill.",
      inputSchema: {
        type: "object",
        properties: {
          label: {
            type: "string",
            description: "Label for skill group",
          },
          active_gem: {
            type: "string",
            description: "Active skill gem name",
          },
          support_gems: {
            type: "array",
            items: { type: "string" },
            description: "Array of support gem names",
          },
          slot: {
            type: "string",
            description: "Item slot (optional)",
            enum: [...ITEM_SLOTS],
          },
        },
        required: ["label", "active_gem", "support_gems"],
      },
    },
    {
      name: "add_multiple_items",
      description: "Add multiple items at once (efficient bulk operation). Every item is parsed and its slot checked first, so a bad item or slot adds nothing.",
      inputSchema: {
        type: "object",
        properties: {
          items: {
            type: "array",
            items: {
              type: "object",
              properties: {
                item_text: { type: "string" },
                slot_name: { type: "string" },
              },
              required: ["item_text", "slot_name"],
            },
            description: "Array of items to add",
          },
        },
        required: ["items"],
      },
    },
    {
      name: "plan_leveling",
      description: "Generate a PoE2 0.5 leveling guide for a build: act/interlude progression with bosses and level targets, Trials of Ascendancy timing, skill-tag-aware support direction, support-socket guidance, and passive tree priority order",
      inputSchema: {
        type: "object",
        properties: {
          build_name: { type: "string", description: "Build file to read class/skill from (optional if build loaded in Lua bridge)" },
          class_name: { type: "string", description: "Override class name (e.g. 'Witch', 'Ranger')" },
          main_skill: { type: "string", description: "Override main skill name" },
          ascendancy: { type: "string", description: "Override ascendancy name" },
        },
      },
    },
  ];
}

/**
 * Get optimization tool schemas
 */
export function getOptimizationToolSchemas(): any[] {
  return [
    {
      name: "analyze_defenses",
      description: "The defence values PoB2 computes for a build: effective hit pool (TotalEHP), Life/Energy Shield/Mana/Spirit with their unreserved amounts, armour, evasion, physical damage reduction, evade, deflect and effective block chance, each resistance with the amount missing to its maximum, and each damage type's max hit taken against the configured enemy's hit of that type. The judgments are PoB's, not ours: PoB's own warning lines, a resistance below its maximum (Missing<Elem>Resist > 0), and a max hit taken below the configured enemy's hit of its type (engine comparisons); there are no thresholds of our own. Empty gear slots PoB shows are stated as facts. build_name is optional (default: the loaded build); another build file is loaded temporarily and the engine's build is left unchanged.",
      inputSchema: {
        type: "object",
        properties: {
          build_name: {
            type: "string",
            description: "Build file to analyze (default: the loaded build). Another file is loaded temporarily; the engine's build is unchanged.",
          },
        },
      },
    },
  ];
}

/**
 * Get configuration tool schemas (Phase 9)
 */
export function getConfigToolSchemas(): any[] {
  return [
    {
      name: "get_config",
      description: "List the loaded build's configuration: every PoB2 config option key (PoB's Configuration tab, by section) with its value, plus the enemy level in effect. Options the build doesn't set show the value PoB uses for them, marked (default). Use the keys with set_config.",
      inputSchema: {
        type: "object",
        properties: {},
      },
    },
    {
      name: "set_config",
      description: "Set one PoB2 config option on the loaded build and recalculate; reports the option's previous and new value. Keys are PoB2's config option keys as get_config lists them, e.g. usePowerCharges, useFrenzyCharges, conditionLowLife, conditionFullLife, buffOnslaught, enemyIsBoss (None/Boss/Pinnacle/Uber), enemyLevel. An unknown key or a value of the wrong type is an error and changes nothing.",
      inputSchema: {
        type: "object",
        properties: {
          config_name: {
            type: "string",
            description: "PoB2 config option key (from get_config), e.g. 'usePowerCharges', 'enemyIsBoss', 'conditionLowLife'",
          },
          value: {
            description: "New value: true/false for a checkbox, a number for a number field, one of the option's values for a list, text for a text field. \"\" clears a non-checkbox option back to PoB's default: a list option goes back to the entry a new PoB config has (enemyIsBoss: Pinnacle), any other field is emptied.",
          },
        },
        required: ["config_name", "value"],
      },
    },
    {
      name: "set_enemy_stats",
      description: "Set the enemy's level, resistances, armour and evasion (PoB2's Enemy Stats config options) on the loaded build, recalculate, and report each previous and new value with the DPS change. Fields you leave out keep their current values.",
      inputSchema: {
        type: "object",
        properties: {
          level: {
            type: "number",
            description: "Enemy level (enemyLevel). Unset, PoB derives it from the boss type and your level; PoB caps it at the maximum enemy level.",
          },
          fire_resist: {
            type: "number",
            description: "Enemy fire resistance % (enemyFireResist)",
          },
          cold_resist: {
            type: "number",
            description: "Enemy cold resistance % (enemyColdResist)",
          },
          lightning_resist: {
            type: "number",
            description: "Enemy lightning resistance % (enemyLightningResist)",
          },
          chaos_resist: {
            type: "number",
            description: "Enemy chaos resistance % (enemyChaosResist)",
          },
          armor: {
            type: "number",
            description: "Enemy base armour (enemyArmour)",
          },
          evasion: {
            type: "number",
            description: "Enemy base evasion (enemyEvasion)",
          },
        },
      },
    },
    {
      name: "save_config_preset",
      description: "Save the loaded build's config options (every option it sets: charges, conditions, enemy stats, ...) as a named preset in the server's state directory, for reuse on any build",
      inputSchema: {
        type: "object",
        properties: {
          name: {
            type: "string",
            description: "Preset name (e.g. 'bossing', 'mapping', 'full-charges')",
          },
        },
        required: ["name"],
      },
    },
    {
      name: "load_config_preset",
      description: "Apply a saved config preset to the loaded build: every option in the preset is set to its saved value, and options the build sets that the preset doesn't hold are cleared to PoB's default; then the build is recalculated",
      inputSchema: {
        type: "object",
        properties: {
          name: {
            type: "string",
            description: "Preset name to load",
          },
        },
        required: ["name"],
      },
    },
    {
      name: "list_config_presets",
      description: "List the saved config presets (names to use with load_config_preset)",
      inputSchema: {
        type: "object",
        properties: {},
      },
    },
  ];
}

/**
 * Get build validation tool schemas (Phase 7)
 */
export function getValidationToolSchemas(): any[] {
  return [
    {
      name: "validate_build",
      description: "Validate a build on PoB2's own judgments only: PoB's own warning lines (unmet attribute requirements, unreserved Life below 1, negative unreserved Mana or Spirit, too many passive points or gem groups, and so on), resistances below their maximum (Missing<Elem>Resist > 0), and each damage type's max hit taken below the configured enemy's hit of that type (engine comparisons). It applies no thresholds of its own. It also states engine facts: the values behind the judgments and the empty gear slots PoB shows. build_name is optional (default: the loaded build); another build file is loaded temporarily and the engine's build is left unchanged. get_build_issues lists the same issues for the loaded build without the values; analyze_defenses shows more defence values.",
      inputSchema: {
        type: "object",
        properties: {
          build_name: {
            type: "string",
            description: "Build file to validate (default: the loaded build). Another file is loaded temporarily; the engine's build is unchanged.",
          },
        },
      },
    },
  ];
}

/**
 * Get export and persistence tool schemas (Phase 8)
 */
export function getExportToolSchemas(): any[] {
  return [
    {
      name: "export_build",
      description: "Export a copy of a build file. Without notes it is an exact byte copy; with notes, the PoB2 engine writes the copy (a <PathOfBuilding2> document) with the notes appended, loading the source temporarily and putting the engine's working build back afterwards. Exports go to the server's state folder (<state dir>/exports) unless output_directory names a folder inside the builds folder or the state folder; anything else is refused. NOTE: this copies a file on disk, not the engine's build; use lua_save_build to write the engine's build.",
      inputSchema: {
        type: "object",
        properties: {
          build_name: {
            type: "string",
            description: "Source build filename (e.g., 'MyBuild.xml')",
          },
          output_name: {
            type: "string",
            description: "Output file name (a plain name; .xml is optional)",
          },
          output_directory: {
            type: "string",
            description: "Target folder (optional; default: the server's state folder, <state dir>/exports). Must be inside the builds folder or the state folder; a relative path is taken inside the builds folder. Writes into the builds folder keep a backup of a replaced file.",
          },
          overwrite: {
            type: "boolean",
            description: "Replace an existing file of that name (default: false)",
          },
          notes: {
            type: "string",
            description: "Additional notes to append to build notes",
          },
        },
        required: ["build_name", "output_name"],
      },
    },
    {
      name: "snapshot_build",
      description: "Create a versioned snapshot of a build file for easy rollback: a byte copy plus metadata (stats, tag, description), stored in the server's state folder, never in the builds folder.",
      inputSchema: {
        type: "object",
        properties: {
          build_name: {
            type: "string",
            description: "Build to snapshot",
          },
          description: {
            type: "string",
            description: "Description of this snapshot (optional)",
          },
          tag: {
            type: "string",
            description: "User-friendly tag (e.g., 'before-respec', 'league-start') (optional)",
          },
        },
        required: ["build_name"],
      },
    },
    {
      name: "list_snapshots",
      description: "List all snapshots for a build with metadata and stats",
      inputSchema: {
        type: "object",
        properties: {
          build_name: {
            type: "string",
            description: "Build to list snapshots for",
          },
          limit: {
            type: "number",
            description: "Maximum number of snapshots to return (optional)",
          },
          tag_filter: {
            type: "string",
            description: "Filter by tag (optional)",
          },
        },
        required: ["build_name"],
      },
    },
    {
      name: "restore_snapshot",
      description: "Restore a build file from one of its snapshots. The current file is always backed up to the server's state folder first. Refused if the file changed on disk since the engine loaded or saved it (reload it first). If the engine has that file loaded with no unsaved changes, its next engine call reloads it.",
      inputSchema: {
        type: "object",
        properties: {
          build_name: {
            type: "string",
            description: "Build to restore",
          },
          snapshot_id: {
            type: "string",
            description: "Snapshot ID (timestamp) or tag to restore from",
          },
          backup_current: {
            type: "boolean",
            description: "Ignored: the current file is always backed up before a restore (kept for compatibility).",
          },
        },
        required: ["build_name", "snapshot_id"],
      },
    },
    {
      name: "export_build_summary",
      description: "Generate a clean markdown summary of the loaded build suitable for sharing on Reddit, Discord, or as build documentation",
      inputSchema: {
        type: "object",
        properties: {},
      },
    },
  ];
}

/**
 * Get Trade API tool schemas (listed unless POE_TRADE_DISABLED=true)
 */
export function getTradeToolSchemas(): any[] {
  return [
    {
      name: "search_trade_items",
      description: "Search the Path of Exile 2 trade site (trade2) for items with filters. Listings come back in the trade site's order (cheapest first), each with its native price and, where poe.ninja has a rate for the currency, the equivalent in the league's primary currency (e.g. divine). Default limit is 5 items, max 10. Use search_stats to find stat ids for mods.",
      inputSchema: {
        type: "object",
        properties: {
          league: {
            type: "string",
            description: "EXACT trade league name (e.g. 'Standard', 'Hardcore', or the current league). Use get_leagues to see available leagues. Do not substitute or change the league name.",
          },
          item_name: {
            type: "string",
            description: "Specific item name to search for, usually a unique (e.g. 'Headhunter')",
          },
          item_type: {
            type: "string",
            description: "Item category (e.g. 'ring', 'body armour', 'boots', 'crossbow', 'spear', 'flail', 'focus', 'buckler', 'talisman', 'quarterstaff', 'charm', 'jewel') or an exact base type (e.g. 'Amethyst Ring')",
          },
          min_price: {
            type: "number",
            description: "Minimum price, in price_currency",
          },
          max_price: {
            type: "number",
            description: "Maximum price, in price_currency",
          },
          price_currency: {
            type: "string",
            description: "Trade currency id for min_price/max_price (e.g. 'exalted', 'divine', 'chaos'). Omit to price in Exalted Orb equivalent.",
          },
          item_rarity: {
            type: "string",
            description: "Item rarity filter: 'normal', 'magic', 'rare', 'unique', 'nonunique' or 'any'",
          },
          min_rune_sockets: {
            type: "number",
            description: "Minimum number of rune sockets",
          },
          corrupted: {
            type: "boolean",
            description: "true = only corrupted items, false = only uncorrupted; omit for any",
          },
          identified: {
            type: "boolean",
            description: "true = only identified items, false = only unidentified; omit for any",
          },
          mods: {
            type: "array",
            items: {
              type: "object",
              properties: {
                stat_id: { type: "string", description: "Trade stat id from search_stats (e.g. 'explicit.stat_3299347043')" },
                min: { type: "number" },
                max: { type: "number" },
              },
              required: ["stat_id"],
            },
            description: "Stat filters (all must match), each a trade stat id with optional min/max",
          },
          limit: {
            type: "number",
            description: "Maximum results (default: 5, max: 10)",
          },
        },
        required: ["league"],
      },
    },
    {
      name: "get_item_price",
      description: "Quick price check for a specific item by name on the PoE2 trade site. Lists the cheapest listings with native prices, and summarizes them in the league's primary currency using poe.ninja rates (native prices only if rates are unavailable). IMPORTANT: Use the EXACT league name the user specifies.",
      inputSchema: {
        type: "object",
        properties: {
          item_name: {
            type: "string",
            description: "Name of the item to price check",
          },
          league: {
            type: "string",
            description: "EXACT league name as specified by user. Default: POE_LEAGUE if set, else the current league (see get_leagues)",
          },
          item_type: {
            type: "string",
            description: "Item category or base type for more accurate results (optional)",
          },
          rarity: {
            type: "string",
            description: "Item rarity: 'unique', 'rare', 'magic', 'normal' (optional)",
            enum: ["unique", "rare", "magic", "normal"],
          },
        },
        required: ["item_name"],
      },
    },
    {
      name: "get_leagues",
      description: "List the PoE2 trade leagues, in the trade site's order, and mark the default league (POE_LEAGUE if set, else the first current league that is not Standard or Hardcore). Use this to find the correct league name before searching trade or prices.",
      inputSchema: {
        type: "object",
        properties: {},
      },
    },
    {
      name: "search_stats",
      description: "Search the trade site's live stat list for stat ids to use in trade searches (search_trade_items mods[].stat_id). Matches stat text such as 'maximum Life' or 'fire resistance'.",
      inputSchema: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "Search query for stat text (e.g. 'maximum Life', 'fire resistance')",
          },
          limit: {
            type: "number",
            description: "Maximum results to return (default: 10)",
          },
        },
        required: ["query"],
      },
    },
    {
      name: "find_upgrades",
      description: "Find upgrades on the Path of Exile 2 trade site for one item slot of the loaded build, the way Path of Building's trade dialog does it: PoB generates a weighted trade query from the build (sort_stats, default the build's saved trade weights, else Full DPS 1 + Effective Hit Pool 0.5), the server searches and fetches listings (at most 5 searches, 90 s budget), PoB scores every candidate against the build, prices are normalized with poe.ninja rates and filtered by max_price, and the results are ranked by rank_by. Each listing shows its score versus the current item's baseline, whether it is an upgrade, per-stat deltas, its native and normalized price, a Buy line (the whisper, or a trade-site link to that exact listing) and PoB's item text; listings compacted to fit the output budget still end with their Buy. When presenting results, show each listing's Buy line verbatim (the full whisper or URL, never shortened or dropped): it is how the user buys the item. It always says when nothing within budget is an upgrade. Weighted search needs the pathofexile.com session cookie POESESSID; without it the result is the trade-site link for the generated search (open it while logged in), not an error. Use trade_query_options first to see a slot's sort stats, required-mod trade ids and options. Holds the engine for the whole call.",
      inputSchema: {
        type: "object",
        properties: {
          slot: { type: "string", minLength: 1, description: "PoB slot name, e.g. 'Body Armour', 'Helmet', 'Gloves', 'Boots', 'Belt', 'Amulet', 'Ring 1', 'Weapon 1', 'Weapon 2 Swap', 'Flask 1', a gear jewel socket ('Helmet Jewel Socket 1') or a tree jewel socket ('Jewel <node id>'). Charm, Arm and Leg slots and weapon jewel sockets are not supported" },
          sort_stats: {
            type: "array",
            minItems: 1,
            maxItems: 10,
            description: "Stats to weight the search and score by (trade_query_options lists them); default: the build's saved trade weights, else FullDPS 1 + TotalEHP 0.5. *TakenHit stats are not supported",
            items: {
              type: "object",
              properties: {
                stat: { type: "string", minLength: 1, description: "PoB stat id, e.g. 'FullDPS', 'TotalEHP', 'Life'" },
                weight: { type: "number", minimum: 0.01, maximum: 1 },
              },
              required: ["stat", "weight"],
            },
          },
          required_mods: {
            type: "array",
            maxItems: 3,
            description: "Mods every listing must have (trade stat ids from trade_query_options), each with a minimum value",
            items: {
              type: "object",
              properties: {
                trade_id: { type: "string", minLength: 1, description: "Trade stat id, e.g. 'explicit.stat_3299347043'" },
                min: { type: "number" },
              },
              required: ["trade_id", "min"],
            },
          },
          max_price: { type: "number", exclusiveMinimum: 0, description: "Budget in the chosen currency; default: no budget" },
          currency: { type: "string", enum: ["exalted_equivalent", "exalted", "chaos", "divine", "aug", "transmute", "regal", "vaal", "annul", "alch", "mirror"], description: "Budget and display currency (default exalted_equivalent: any currency, priced in exalted)" },
          max_level: { type: "integer", minimum: 1, maximum: 100, description: "Maximum item level requirement" },
          min_empty_rune_sockets: { type: "integer", minimum: 1, maximum: 6, description: "Minimum empty rune sockets (slots that show sockets)" },
          weight_corrupted_mods: { type: "boolean", description: "Weight corrupted mods too (default true unless the current item is corrupted)" },
          include_mirrored: { type: "boolean", description: "Include mirrored items (default true)" },
          rune_behaviour: { type: "string", enum: ["copy", "keep", "remove"], description: "Runes of candidates: copy the current item's runes (default), keep the listing's, or remove them" },
          anoint_behaviour: { type: "string", enum: ["copy", "keep", "remove"], description: "Anoints of candidates (amulets): copy the current one (default), keep, or remove" },
          jewel_type: { type: "string", enum: ["base", "radius"], description: "Required for jewel slots" },
          status: { type: "string", enum: ["securable", "available", "onlineleague", "online", "any"], description: "Listing status (default securable: instant buyout)" },
          league: { type: "string", minLength: 1, description: "Trade league; default POE_LEAGUE, else the current challenge league" },
          fetch_pages: { type: "integer", minimum: 1, maximum: 10, description: "Pages of 10 listings to fetch and evaluate (default 2)" },
          rank_by: { type: "string", enum: ["stat_value", "stat_value_per_price", "price", "trade_weight"], description: "Ranking (default stat_value: PoB's score)" },
          report_stats: { type: "array", maxItems: 10, items: { type: "string", minLength: 1 }, description: "Extra PoB stats to show deltas for" },
          limit: { type: "integer", minimum: 1, maximum: 20, description: "Listings to return (default 10)" },
          include_non_upgrades: { type: "boolean", description: "Also list the best non-upgrades, flagged (default false)" },
        },
        required: ["slot"],
      },
    },
    {
      name: "trade_query_options",
      description: "What Path of Building's trade dialog offers for one item slot of the loaded build, for planning an upgrade search: whether PoB can generate a weighted trade search for the slot (and why not), the engine stats an upgrade search can sort by (sort_stats), the build's saved trade weights or PoB's defaults, the required-mod choices with their trade stat ids (required_mods), the currencies and trade statuses, and which slot-specific options (rune sockets, rune and anoint behaviour, jewel type) apply. Reads the engine's build; sends no trade-site request.",
      inputSchema: {
        type: "object",
        properties: {
          slot: {
            type: "string",
            minLength: 1,
            description: "A PoB slot name of the loaded build, e.g. 'Body Armour', 'Ring 1', 'Weapon 1', 'Amulet', 'Helmet Jewel Socket 1' or a tree jewel socket 'Jewel <node id>'",
          },
        },
        required: ["slot"],
      },
    },
  ];
}

/**
 * Get build goals/diagnostics tool schemas (require Lua bridge, no Trade API dependency)
 */
export function getBuildGoalsToolSchemas(): any[] {
  return [
    {
      name: "get_build_issues",
      description: "The loaded build's issues as PoB2 judges them: PoB's own warning lines, resistances below their maximum (Missing<Elem>Resist > 0), and each damage type's max hit taken below the configured enemy's hit of that type (engine comparisons), plus the empty gear slots PoB shows, stated as facts. No thresholds of our own. The same list as the Top Issues in lua_load_build's summary; validate_build adds the values behind it.",
      inputSchema: {
        type: "object",
        properties: {},
      },
    },
    {
      name: "get_passive_upgrades",
      description: "Find the best unallocated notable passives to pick up next. Each nearby notable is measured with PoB's calculator with its whole path allocated (PoB's own pathing, as its tree tooltip does), and ranked by relative DPS/EHP gain per passive point; the output shows each path cost in points. After the ranking, it lists what PoB can't fully measure among every notable it measured: a notable with a line check_model_coverage doesn't rate fully parsed (with the line and its status), or one whose measurement returned no value.",
      inputSchema: {
        type: "object",
        properties: {
          focus: {
            type: "string",
            description: "What to optimize for (default: 'both')",
            enum: ["dps", "defence", "both"],
          },
          max_results: {
            type: "number",
            description: "Maximum number of upgrade suggestions to return (default: 10)",
          },
          include_ascendancy: {
            type: "boolean",
            description: "Also measure every unallocated, reachable notable of the build's own ascendancy, priced in ascendancy points, and rank them in their own section. A notable that needs more ascendancy points than the build has left is marked over budget, not hidden (default: false).",
          },
        },
      },
    },
  ];
}

/**
 * Get poe.ninja API tool schemas
 */
export function getPoeNinjaToolSchemas(): any[] {
  return [
    {
      name: "get_currency_rates",
      description: "Get current PoE2 currency exchange rates from poe.ninja. Values are given in the league's primary currency, which poe.ninja names in each response (e.g. Divine Orb). Rates are cached for up to 60 minutes. IMPORTANT: Use the EXACT league name the user specifies - do not substitute or guess.",
      inputSchema: {
        type: "object",
        properties: {
          league: {
            type: "string",
            description: "EXACT league name as specified by user (e.g. 'Standard', 'Hardcore', or the current league; see get_leagues). Do not substitute or change this value.",
          },
        },
        required: ["league"],
      },
    },
  ];
}
