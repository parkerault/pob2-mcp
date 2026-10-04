/**
 * Tool registry metadata (C-8).
 *
 * Every registered tool has exactly one entry. `group` drives listing and routing (C-1):
 * a tool whose group is disabled is neither listed nor routable. `engine` tells the engine
 * session (C-3, WU-08) how the tool touches the engine:
 *  - none:      never touches the engine;
 *  - read:      the engine's build is unchanged after the call;
 *  - mutate:    changes the engine's build;
 *  - load:      replaces the engine's build;
 *  - lifecycle: starts or stops the engine.
 */

export type EngineKindMeta = 'none' | 'read' | 'mutate' | 'load' | 'lifecycle';
export type ToolGroup = 'core' | 'trade' | 'ninja';

export interface ToolMeta {
  engine: EngineKindMeta;
  group: ToolGroup;
}

const core = (engine: EngineKindMeta): ToolMeta => ({ engine, group: 'core' });
const trade: ToolMeta = { engine: 'none', group: 'trade' };
const ninja: ToolMeta = { engine: 'none', group: 'ninja' };

export const TOOL_META: Record<string, ToolMeta> = {
  // Build files and the watcher (file-based; never touch the engine)
  list_builds: core('none'),
  get_build_stats: core('none'),
  get_build_notes: core('none'),
  set_build_notes: core('none'),
  compare_trees: core('none'),
  start_watching: core('none'),
  stop_watching: core('none'),
  get_recent_changes: core('none'),
  watch_status: core('none'),
  refresh_tree_data: core('none'),

  // File analysis that may consult the engine without changing its build
  analyze_build: core('read'),
  compare_builds: core('read'),
  get_nearby_nodes: core('read'),
  find_path_to_node: core('read'),

  // Engine lifecycle and loads
  lua_start: core('lifecycle'),
  lua_stop: core('lifecycle'),
  lua_load_build: core('load'),
  lua_reload_build: core('load'),
  lua_new_build: core('load'),
  import_build: core('load'),

  // Engine reads
  lua_save_build: core('read'),
  lua_get_stats: core('read'),
  lua_get_tree: core('read'),
  lua_get_build_info: core('read'),
  list_specs: core('read'),
  list_item_sets: core('read'),
  search_tree_nodes: core('read'),
  list_gems: core('read'),
  get_classes: core('read'),
  analyze_skills: core('read'),
  suggest_supports: core('read'),
  get_equipped_items: core('read'),
  get_skill_setup: core('read'),
  plan_leveling: core('read'),
  suggest_masteries: core('read'),
  find_item_upgrades: core('read'),
  get_config: core('read'),
  save_config_preset: core('read'),
  analyze_defenses: core('read'),
  validate_build: core('read'),
  export_build: core('read'),
  export_build_summary: core('read'),
  get_build_issues: core('read'),
  get_passive_upgrades: core('read'),
  analyze_build_cluster_jewels: core('read'),
  suggest_watchers_eye: core('read'),
  check_boss_readiness: core('read'),
  suggest_crafting: core('read'),
  gem_upgrade_path: core('read'),
  save_tree: core('read'),

  // Engine mutations
  select_spec: core('mutate'),
  create_spec: core('mutate'),
  delete_spec: core('mutate'),
  rename_spec: core('mutate'),
  select_item_set: core('mutate'),
  set_character_level: core('mutate'),
  lua_set_tree: core('mutate'),
  update_tree_delta: core('mutate'),
  add_item: core('mutate'),
  add_multiple_items: core('mutate'),
  toggle_flask: core('mutate'),
  set_main_skill: core('mutate'),
  create_socket_group: core('mutate'),
  add_gem: core('mutate'),
  set_gem_level: core('mutate'),
  set_gem_quality: core('mutate'),
  remove_skill: core('mutate'),
  remove_gem: core('mutate'),
  toggle_socket_group: core('mutate'),
  toggle_gem: core('mutate'),
  setup_skill_with_gems: core('mutate'),
  set_config: core('mutate'),
  set_enemy_stats: core('mutate'),
  load_config_preset: core('mutate'),
  // These load the named build into the engine (they are deleted in WU-04)
  suggest_optimal_nodes: core('mutate'),
  optimize_tree: core('mutate'),
  analyze_items: core('mutate'),
  optimize_skill_links: core('mutate'),

  // Snapshots and presets on disk (no engine)
  snapshot_build: core('none'),
  list_snapshots: core('none'),
  restore_snapshot: core('none'),
  list_config_presets: core('none'),
  create_budget_build: core('none'),

  // Legacy file-based gem tools (deleted in WU-04)
  analyze_skill_links: core('none'),
  suggest_support_gems: core('none'),
  compare_gem_setups: core('none'),
  validate_gem_quality: core('none'),
  find_optimal_links: core('none'),

  // Trade (hidden with POE_TRADE_DISABLED=true)
  search_trade_items: trade,
  get_item_price: trade,
  get_leagues: trade,
  search_stats: trade,
  compare_trade_items: trade,
  search_cluster_jewels: trade,
  generate_shopping_list: trade,

  // poe.ninja (hidden with POE_NINJA_DISABLED=true)
  get_currency_rates: ninja,
  find_arbitrage: ninja,
  calculate_trading_profit: ninja,
};

type Env = Readonly<Record<string, string | undefined>>;

/** Whether a tool group is switched off by its env flag (C-1). */
export function isGroupDisabled(group: ToolGroup, env: Env): boolean {
  if (group === 'trade') return env.POE_TRADE_DISABLED === 'true';
  if (group === 'ninja') return env.POE_NINJA_DISABLED === 'true';
  return false;
}

/** A tool is listed and routable when it has metadata and its group is enabled. */
export function isToolAvailable(name: string, env: Env): boolean {
  const meta = Object.prototype.hasOwnProperty.call(TOOL_META, name) ? TOOL_META[name] : undefined;
  return meta !== undefined && !isGroupDisabled(meta.group, env);
}
