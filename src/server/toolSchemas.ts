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

/** The slots with an activation toggle in PoB2: flasks and charms (`toggle_flask`). */
export const ACTIVATABLE_SLOTS = ["Flask 1", "Flask 2", "Charm 1", "Charm 2", "Charm 3"] as const;

/**
 * Get all tool schemas for registration with the MCP server
 */
export function getToolSchemas(): ToolSchema[] {
  return [
    {
      name: "analyze_build",
      description: "Analyze a Path of Building build file and extract detailed information including stats, skills, gear, passive skill tree analysis with keystones, notables, jewel sockets, build archetype detection, and optimization suggestions",
      inputSchema: {
        type: "object",
        properties: {
          build_name: {
            type: "string",
            description: "Name of the build file (e.g., 'MyBuild.xml')",
          },
        },
        required: ["build_name"],
      },
    },
    {
      name: "compare_builds",
      description: "Compare two Path of Building builds side by side",
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
      description: "List all available Path of Building builds",
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
      description: "Start monitoring the builds directory for changes. Builds will be auto-reloaded when saved in PoB.",
      inputSchema: {
        type: "object",
        properties: {},
      },
    },
    {
      name: "stop_watching",
      description: "Stop monitoring the builds directory for changes.",
      inputSchema: {
        type: "object",
        properties: {},
      },
    },
    {
      name: "get_recent_changes",
      description: "Get a list of recently changed build files.",
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
      description: "Check if file watching is currently enabled.",
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
      description: "Write notes/documentation into a PoB build file (overwrites existing notes)",
      inputSchema: {
        type: "object",
        properties: {
          build_name: { type: "string", description: "Name of the build file" },
          notes: { type: "string", description: "Notes content to write (plain text or markdown)" },
        },
        required: ["build_name", "notes"],
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
      description: "Get comprehensive calculated stats from the currently loaded build (requires lua_load_build first). Use category='offense' for DPS details, category='defense' for survivability, category='all' only when you need everything at once. Avoid calling multiple times with different categories — pick the right one.",
      inputSchema: {
        type: "object",
        properties: {
          category: {
            type: "string",
            description: "Stat category: 'offense', 'defense', 'all' (default: all)",
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
      description: "Search passive tree for nodes matching specific criteria",
      inputSchema: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "Search query for node names or stats",
          },
          node_type: {
            type: "string",
            description: "Filter by type: 'keystone', 'notable', 'jewel', or 'any' (default)",
          },
          limit: {
            type: "number",
            description: "Maximum results to return (default: 20)",
          },
        },
        required: ["query"],
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
      name: "get_classes",
      description: "List PoE2 classes and their ascendancies with the engine's classId / ascendancy ids (use with lua_set_tree). Authoritative — replaces the PoE1 class-ID table.",
      inputSchema: { type: "object", properties: {} },
    },
    {
      name: "import_build",
      description: "Import a PoE2 build from a Path of Building export code OR a share link (pobb.in / pastebin), decode it, and load it into the engine. After importing, use analyze_skills / suggest_supports / analyze_defenses / validate_build / lua_get_stats.",
      inputSchema: {
        type: "object",
        properties: {
          source: {
            type: "string",
            description: "A PoB2 export code (base64) or a pobb.in/pastebin URL to the build.",
          },
          save_as: {
            type: "string",
            description: "Optional filename to also save the decoded build into your builds directory (so file-based tools like analyze_build can use it).",
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
      description: "Rank the support gems that could go in a socket group by their measured effect. The candidates are every non-legacy support gem PoB2 says can support the group's active skills (PoB's own compatibility check) that isn't already in the group. Each one is measured on the requested group (made the main skill for the measurement) the way PoB2's gem selector sorts gems: added at the default gem level and quality, recalculated, and removed again. Results are ordered by the change in the build's gem-sort stat (CombinedDPS unless the build sorts gems by another stat), largest first. The loaded build is left as it was.",
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
            description: "PoE2 slot to equip the item in (it replaces what is there). Ring 3 exists only with an extra ring slot; the Swap slots are the second weapon set.",
            enum: [...ITEM_SLOTS],
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
      description: "Set which skill group is the main skill for DPS calculations",
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
      description: "Deep-dive into defensive layers (avoidance/mitigation/recovery): EHP, spell suppression, evasion, block, armour/PDR, life regen, leech. Use this when you specifically want detailed defense breakdown. validate_build already covers this — only call analyze_defenses separately if you need more defensive detail than validate_build provides.",
      inputSchema: {
        type: "object",
        properties: {
          build_name: {
            type: "string",
            description: "Build to analyze",
          },
        },
        required: ["build_name"],
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
      description: "View current configuration state including charge usage, enemy settings, and active conditions. Requires Lua bridge with a loaded build.",
      inputSchema: {
        type: "object",
        properties: {},
      },
    },
    {
      name: "set_config",
      description: "Modify configuration inputs. Common keys — Charges: usePowerCharges, useFrenzyCharges, useEnduranceCharges | Conditions: conditionFortify, conditionLeeching, conditionOnFullLife, conditionOnFullEnergyShield | Buffs: buffOnslaught | Enemy: enemyIsBoss ('Shaper'/'Pinnacle'/false), enemyLevel | Build: bandit ('None'/'Oak'/'Alira'/'Kraityn'), pantheonMajorGod, pantheonMinorGod. Call get_config to see all current values.",
      inputSchema: {
        type: "object",
        properties: {
          config_name: {
            type: "string",
            description: "Name of configuration input to change (e.g., 'usePowerCharges', 'enemyIsBoss', 'conditionFortify')",
          },
          value: {
            description: "New value (boolean for most flags, number for counts)",
          },
        },
        required: ["config_name", "value"],
      },
    },
    {
      name: "set_enemy_stats",
      description: "Configure enemy parameters for DPS calculations. Test against different enemy types (map boss, Shaper, Maven). Requires Lua bridge.",
      inputSchema: {
        type: "object",
        properties: {
          level: {
            type: "number",
            description: "Enemy level (default: 84)",
          },
          fire_resist: {
            type: "number",
            description: "Fire resistance % (default: 40)",
          },
          cold_resist: {
            type: "number",
            description: "Cold resistance % (default: 40)",
          },
          lightning_resist: {
            type: "number",
            description: "Lightning resistance % (default: 40)",
          },
          chaos_resist: {
            type: "number",
            description: "Chaos resistance % (default: 20)",
          },
          armor: {
            type: "number",
            description: "Enemy armor value",
          },
          evasion: {
            type: "number",
            description: "Enemy evasion value",
          },
        },
      },
    },
    {
      name: "save_config_preset",
      description: "Save the current configuration (charges, conditions, enemy settings) as a named preset for quick reuse",
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
      description: "Load a previously saved configuration preset, restoring all charge, condition, and enemy settings at once",
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
      description: "List all saved configuration presets",
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
      description: "Comprehensive build validation: resistances, life pool, defensive layers (avoidance/mitigation/recovery), mana sustain, accuracy, flask immunities, damage scaling. Provides prioritized critical/warning/info recommendations. PREFER this over get_build_issues + analyze_defenses — it covers both in one call. Do not call all three.",
      inputSchema: {
        type: "object",
        properties: {
          build_name: {
            type: "string",
            description: "Build to validate. If omitted and Lua bridge is active, validates currently loaded build.",
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
      description: "Export a copy of a build to an XML file. Creates a variant/copy from an existing build file. NOTE: This does NOT export from Lua bridge - use lua_save_build to write the engine's build to a file.",
      inputSchema: {
        type: "object",
        properties: {
          build_name: {
            type: "string",
            description: "Source build filename (e.g., 'MyBuild.xml')",
          },
          output_name: {
            type: "string",
            description: "Output filename (without .xml extension)",
          },
          output_directory: {
            type: "string",
            description: "Target directory (optional, defaults to POB_DIRECTORY/.pob-mcp/exports)",
          },
          overwrite: {
            type: "boolean",
            description: "Allow overwriting existing file (default: false)",
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
      description: "Create a versioned snapshot of a build for easy rollback. Snapshots are stored separately with metadata tracking stats and changes.",
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
      description: "Restore a build from a snapshot. Optionally creates a backup of current state before restoring.",
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
            description: "Create snapshot of current state before restore (default: true)",
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
      description: "Find upgrades on the Path of Exile 2 trade site for one item slot of the loaded build, the way Path of Building's trade dialog does it: PoB generates a weighted trade query from the build (sort_stats, default the build's saved trade weights, else Full DPS 1 + Effective Hit Pool 0.5), the server searches and fetches listings (at most 5 searches, 90 s budget), PoB scores every candidate against the build, prices are normalized with poe.ninja rates and filtered by max_price, and the results are ranked by rank_by. Each listing shows its score versus the current item's baseline, whether it is an upgrade, per-stat deltas, its native and normalized price, a Buy line (the whisper, or a trade-site link to that exact listing) and PoB's item text. It always says when nothing within budget is an upgrade. Weighted search needs the pathofexile.com session cookie POESESSID; without it the result is the trade-site link for the generated search (open it while logged in), not an error. Use trade_query_options first to see a slot's sort stats, required-mod trade ids and options. Holds the engine for the whole call.",
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
      description: "Quick issue scan: uncapped resistances, low life, over-reserved mana, incomplete spell suppression. Lighter than validate_build. Use this for a fast check; use validate_build when you want full analysis including flask immunities and damage scaling. Do NOT call both.",
      inputSchema: {
        type: "object",
        properties: {},
      },
    },
    {
      name: "get_passive_upgrades",
      description: "Find the best unallocated notable passives to pick up next. Each nearby notable is measured with PoB's calculator with its whole path allocated (PoB's own pathing, as its tree tooltip does), and ranked by relative DPS/EHP gain per passive point; the output shows each path cost in points.",
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
