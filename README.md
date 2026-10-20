# pob2-mcp: Path of Building 2 for Claude

An MCP server that lets Claude read, change and analyse **Path of Exile 2** builds with Path of
Building 2's own calculation engine, and search the PoE2 trade site for upgrades the way Path of
Building's trade dialog does.

- **The engine is PoB2 itself.** A headless `luajit` process runs an unmodified
  [PathOfBuilding-PoE2](https://github.com/PathOfBuildingCommunity/PathOfBuilding-PoE2) checkout,
  pinned to release `v0.23.1` (`pob-pin.json`), through the small Lua bridge in `pob-api/`. Stats,
  warnings and trade scores are the numbers PoB2 computes.
- **Advice is PoB's.** `validate_build`, `analyze_defenses` and `get_build_issues` report PoB's own
  warning lines and comparisons of engine outputs (missing resistances, max hit taken against the
  configured enemy). There are no thresholds of our own.
- **Your builds folder is the system of record.** The server writes there through one writer only. It
  backs the old file up first, refuses to overwrite a file that changed on disk since the engine loaded
  or saved it, and needs `overwrite: true` to replace an existing file.
- **`find_upgrades`** has PoB generate a weighted trade search for one item slot, runs it on the trade
  site, scores every listing against your build in the engine, prices it with poe.ninja rates and ranks
  the upgrades within your budget.

85 tools are listed by default; the full table is [below](#tools).

## Setup

Requirements: Linux or WSL2, `git` and [mise](https://mise.jdx.dev). mise installs Node 24 (with pnpm
through corepack) and LuaJIT with `luautf8`, as pinned in `mise.toml`.

```bash
git clone <this repository's URL> ~/projects/pob2-mcp
cd ~/projects/pob2-mcp
mise trust
mise run setup
```

- `mise trust` comes first: mise refuses to read an untrusted `mise.toml`, so every `mise` command
  before it fails.
- `mise run setup` installs the dependencies with pnpm from the lockfile, builds the server
  (`pnpm build`) and fetches the pinned PoB2 checkout into `vendor/` (`mise run pob:fetch`, a sparse
  clone of about 5 MiB from GitHub).

The server refuses to start the engine on any other PoB2 version. If it reports a pin mismatch, run
`mise run pob:fetch` again.

## Register with Claude Code

```bash
claude mcp add pob2 -s user -e "POB_DIRECTORY=<your PoB2 Builds folder>" -- mise exec -C <path to this repo> -- node build/index.js
```

`POB_DIRECTORY` is your PoB2 builds folder, and `-C` is where you cloned this repository. On WSL2, with
PoB2 installed on Windows, the builds folder is `/mnt/c/Users/<you>/Documents/Path of Building (PoE2)/Builds`.

`mise exec -C` runs the server with the repository's pinned Node and LuaJIT, whatever directory Claude
Code starts it from. In a new Claude Code session, `/mcp` shows `pob2` connected, with 85 tools.

## Configuration

Settings are environment variables. Pass the non-secret ones with `-e NAME=value` on `claude mcp add`.
The trade cookie `POESESSID` is the exception: put it only in `.env` (see
[Trade session](#trade-session-poesessid)) and never pass it with `-e`. On the command line it would land
in your shell history and in Claude Code's MCP config in plain text, and a registered value always
wins over `.env`, so a refreshed cookie there would be ignored.

| Variable | Default | What it does |
|---|---|---|
| `POB_DIRECTORY` | `~/Documents/Path of Building (PoE2)/Builds` | Your PoB2 builds folder, subfolders included. On WSL2, point it at the Windows folder, e.g. `/mnt/c/Users/<you>/Documents/Path of Building (PoE2)/Builds`. |
| `POB_GUIDES_DIRECTORY` | `Guides` beside the builds folder, e.g. `~/Documents/Path of Building (PoE2)/Guides` | The guides folder, which holds guide runs, one dated folder per run. The default sits outside the folder PoB2 browses, so guide files don't show up in its build list. |
| `POESESSID` | unset | Your pathofexile.com session cookie, for weighted trade searches. Set it only in `.env`, never with `-e`: see [Trade session](#trade-session-poesessid). `POE_SESSION_ID` is accepted as an alias. |
| `POE_LEAGUE` | see [League](#league) | The trade league the trade tools use. |
| `POE_TRADE_DISABLED` | unset | `true` hides the trade tools (`search_trade_items`, `get_item_price`, `get_leagues`, `search_stats`, `find_upgrades`, `trade_query_options`). The server then never contacts the trade site or reads `.env`. |
| `POE_NINJA_DISABLED` | unset | `true` hides `get_currency_rates` and stops poe.ninja requests. Trade results then show native prices only. |
| `XDG_STATE_HOME` | `~/.local/state` | The server's state folder is `$XDG_STATE_HOME/pob2-mcp`. |
| `POB_TIMEOUT_MS` | `30000` | Timeout for one engine request, counted from when it is sent. Trade query generation gets 60 s. |
| `POB_FORK_PATH` | `<repo>/vendor/PathOfBuilding-PoE2/src` | Another PoB2 `src/` checkout. It must still match the pin. |
| `POB_ALLOW_UNPINNED` | unset | `true` turns the pin check's refusal into a warning. For PoB2 development only. |
| `POB_CMD`, `POB_ARGS` | `luajit`, the bridge's `bootstrap.lua` | The engine command and its argument. |
| `POB_DEBUG` | unset | `true` logs the engine's stdout to stderr. |
| `POE_TRADE_BASE`, `POE_TRADE_REALM` | `https://www.pathofexile.com/api/trade2`, `poe2` | The trade API base URL and realm. |

### League

`POE_LEAGUE` names the trade league, e.g. `POE_LEAGUE="Forbidden Rites"`. If it isn't set, the default
league is the first league the trade site lists that isn't `Standard` or `Hardcore` and doesn't start
with `HC `: the current softcore trade league. A tool's own `league` argument overrides both.
`get_leagues` shows the list and marks the default.

### Trade session (POESESSID)

Weighted trade searches (`find_upgrades`) need a logged-in pathofexile.com session. The server reads
the `POESESSID` cookie on every trade call, so a refreshed cookie in `.env` works without a restart. It
looks, in this order, at the server's environment `POESESSID`, then `POE_SESSION_ID`, then the same two
names in the `.env` file at the repository root, next to `package.json` (`.env` is gitignored). Keep
the cookie in `.env` only: a value in the server's environment (for example from `-e` on
`claude mcp add`) would override `.env` and is stored in plain text outside the repository.

```dotenv
POESESSID=<the POESESSID cookie value from your browser on pathofexile.com>
```

- The cookie is sent only on trade search and fetch requests. It is never logged or echoed.
- 1Password `op://` references are not resolved: the value must be the cookie itself.
- **Without a usable session** (no cookie, a malformed one, or one the trade site rejects),
  `find_upgrades` doesn't search. It returns `Trade search not run: <reason>` with a trade-site link
  that opens the same weighted search in your browser, where you are logged in. When the league is
  known, no request is made before that decision.

The trade tools use the trade site's own API. The server obeys every rate-limit rule the site sends,
with a safety margin, and only makes requests when you call a tool.

### State folder

Snapshots, backups, exports and config presets live in `~/.local/state/pob2-mcp` (that is,
`$XDG_STATE_HOME/pob2-mcp`), never in the builds folder, so PoB2's build list doesn't show them:

- `snapshots/`: `snapshot_build` copies;
- `backups/`: the copy of a build file taken before every server write to it;
- `exports/`: `export_build` copies, unless you name another folder inside the builds or state folder;
- `presets/`: config presets.

### Working alongside PoB2

- **The engine's build** is the one you loaded with `lua_load_build` (or `import_build`,
  `lua_new_build`). Engine tools read and change that build in memory; `lua_save_build` writes it to a
  file.
- **Changes on disk.** At the start of each engine call, the server checks whether the loaded file
  changed on disk, for example because you saved it in PoB2. If the engine has no unsaved changes, it
  reloads the file and says so. If it has, it warns and leaves the engine alone: reload, or save under
  a new name.
- **Saving.** A save over an existing file needs `overwrite: true`, backs the old file up to the state
  folder first, and is refused if the file changed on disk since the engine loaded or saved it. Re-open
  the build in PoB2 to see a saved change there.
- **Other builds.** Tools that analyse a build other than the loaded one (`analyze_build`,
  `compare_builds`, `validate_build`, `analyze_defenses`) load it temporarily and put the engine's build
  back afterwards, unsaved changes included.
- **Build names** resolve to the file's on-disk spelling, so `grenadator` and `Grenadator.xml` name the
  same file.

## Tools

The table is generated from the server's tool registry by `pnpm docs:tools` (after `pnpm build`), and a
test keeps it equal to the registry. Group `trade` is hidden by `POE_TRADE_DISABLED=true`, and group
`ninja` by `POE_NINJA_DISABLED=true`.

<!-- tools:start -->
| Tool | Group | Description |
|---|---|---|
| `analyze_build` | core | Analyze a Path of Building 2 build file: the file's stats, skills, gear, configuration, passive tree (keystones, notables, jewel sockets, archetype) and validation, plus live stats the PoB2 engine computes for that file. |
| `compare_builds` | core | Compare two Path of Building 2 build files side by side on stats the PoB2 engine computes (level, life, energy shield, EHP, DPS, resistances). |
| `list_builds` | core | List every Path of Building 2 build (.xml) in the builds folder, including subfolders, as paths relative to it (e.g. 'league/Starter.xml'). |
| `get_build_stats` | core | Extract specific stats from a build (Life, DPS, resistances, etc.) |
| `start_watching` | core | Start tracking changes to build files in the builds folder (including subfolders; polling on /mnt/ drives). |
| `stop_watching` | core | Stop tracking changes to build files. |
| `get_recent_changes` | core | List build files that changed while watching was on (paths relative to the builds folder), newest first. |
| `watch_status` | core | Show whether change tracking (start_watching) is on, the watched folder and how many changes were recorded. |
| `compare_trees` | core | Compare passive skill trees between two builds, showing differences in allocated nodes |
| `get_nearby_nodes` | core | Find notable and keystone passives near your current tree allocation. |
| `find_path_to_node` | core | Find the shortest path from your current tree to a specific passive node. |
| `get_build_notes` | core | Read the notes/documentation from a PoB build file |
| `set_build_notes` | core | Replace the notes in a build file in the builds folder. |
| `encode_build_code` | core | Encode a build file from the builds folder as a Path of Building 2 import code, in the form PoB2's Build Sharing section generates and import_build accepts. |
| `lua_start` | core | Start the PoB headless API process. |
| `lua_stop` | core | Stop the PoB headless API process and clean up resources. |
| `lua_new_build` | core | Create a new blank build with specified class and ascendancy. |
| `lua_save_build` | core | Save the engine's current build (everything loaded or changed in the PoB engine, including tree, item, gem and config changes) to a build file in your builds folder, as PoB2 XML. |
| `lua_load_build` | core | Load a build file into the PoB calculation engine. |
| `list_specs` | core | List all passive tree specs in the currently loaded build. |
| `select_spec` | core | Switch the active passive tree spec in the currently loaded build. |
| `create_spec` | core | Create a new passive tree spec in the current build. |
| `delete_spec` | core | Delete a passive tree spec from the current build. |
| `rename_spec` | core | Rename a passive tree spec in the current build. |
| `list_item_sets` | core | List all item sets in the currently loaded build. |
| `select_item_set` | core | Switch the active item set in the currently loaded build. |
| `manage_sets` | core | Manage the loaded build's item, skill and config sets, and its loadouts. |
| `set_character_level` | core | Set the character level for the currently loaded build. |
| `lua_get_stats` | core | Get comprehensive calculated stats from the currently loaded build (requires lua_load_build first). |
| `lua_get_tree` | core | Get passive tree allocation from currently loaded build |
| `lua_set_tree` | core | Set passive tree allocation (modifies currently loaded build). |
| `update_tree_delta` | core | Incrementally add or remove specific passive nodes from the current tree allocation. |
| `set_tree_state` | core | Set the active passive tree spec's weapon-set passives and attribute choices, without changing which nodes are allocated. |
| `lua_get_build_info` | core | Get metadata about the currently loaded build: name, character level, class, ascendancy, and tree version. |
| `lua_reload_build` | core | Reload the current build from disk, picking up any changes made in PoB GUI or via direct XML editing. |
| `search_tree_nodes` | core | Search the passive tree for nodes whose name or stats contain `query`, or list an ascendancy's nodes with `ascendancy`. |
| `list_gems` | core | List skill/support gems from Path of Building's authoritative PoE2 gem database (names, tags, gem family, requirements, max level). |
| `lookup_game_data` | core | Look up the pinned Path of Building's game data (gems, uniques, passives, item mods, essences), read-only. |
| `check_model_coverage` | core | Check, line by line, whether the pinned Path of Building applies an item's, a passive node's or a gem's lines, so you know which parts of a build its numbers leave out. |
| `get_classes` | core | List PoE2 classes and their ascendancies with the engine's classId / ascendancy ids (use with lua_set_tree). |
| `import_build` | core | Import a PoE2 build from a Path of Building 2 export code OR a share link (pobb.in / pastebin), decode it, and load it into the engine (replacing the engine's build). |
| `analyze_skills` | core | Analyze the loaded build's skill setup with the PoB2 engine. |
| `suggest_supports` | core | Rank the support gems that could go in a socket group by their measured effect. |
| `add_item` | core | Add an item to the build from item text (paste from game). |
| `get_equipped_items` | core | Get all currently equipped items (empty slots are omitted). |
| `toggle_flask` | core | Turn a flask or charm on or off in the loaded build, as PoB2's slot checkbox does: an active flask or charm applies its effect to the calculated stats. |
| `get_skill_setup` | core | Get current skill gem setup. |
| `set_main_skill` | core | Set which skill group is the main skill for DPS calculations, and optionally which stat set of its active skill is measured (skill_part) and which skill its summon's minion uses (minion_skill). |
| `create_socket_group` | core | Create a new socket group for skill gems |
| `add_gem` | core | Add a gem to a socket group by its PoE2 gem name, as PoB2's gem data spells it (case is ignored). |
| `set_gem_level` | core | Set the level of a gem |
| `set_gem_quality` | core | Set the quality of a gem |
| `set_gem_corruption` | core | Set the corruption state of active skill gems, like PoB2's Corrupt dropdown: not_corrupted, corrupted, plus_one_level (+1 to gem level) or minus_one_level (-1 to gem level). |
| `remove_skill` | core | Remove an entire socket group |
| `remove_gem` | core | Remove a specific gem from a socket group |
| `toggle_socket_group` | core | Enable or disable an entire socket group (e.g. turn off a mana reservation aura to test its effect on stats) |
| `toggle_gem` | core | Enable or disable a specific gem within a socket group |
| `setup_skill_with_gems` | core | Setup a complete skill with multiple support gems in one operation. |
| `add_multiple_items` | core | Add multiple items at once (efficient bulk operation). |
| `plan_leveling` | core | Generate a PoE2 0.5 leveling guide for a build: act/interlude progression with bosses and level targets, Trials of Ascendancy timing, skill-tag-aware support direction, support-socket guidance, and passive tree priority order |
| `compile_plan` | core | Compile a build-guide plan (a plan.json in the guides folder) into one Path of Building 2 build with one loadout per guide stage: each stage gets its own passive tree with weapon-set passives and attribute choices, and stages with identical gear, gems or configuration share one item, skill or config set. |
| `guide_run` | core | Start a build-guide run, check a plan without compiling it, or read one stage or every claim of a plan. |
| `get_config` | core | List the loaded build's configuration: every PoB2 config option key (PoB's Configuration tab, by section) with its value, plus the enemy level in effect. |
| `set_config` | core | Set one PoB2 config option on the loaded build and recalculate; reports the option's previous and new value. |
| `set_enemy_stats` | core | Set the enemy's level, resistances, armour and evasion (PoB2's Enemy Stats config options) on the loaded build, recalculate, and report each previous and new value with the DPS change. |
| `save_config_preset` | core | Save the loaded build's config options (every option it sets: charges, conditions, enemy stats, ...) as a named preset in the server's state directory, for reuse on any build |
| `load_config_preset` | core | Apply a saved config preset to the loaded build: every option in the preset is set to its saved value, and options the build sets that the preset doesn't hold are cleared to PoB's default; then the build is recalculated |
| `list_config_presets` | core | List the saved config presets (names to use with load_config_preset) |
| `get_build_issues` | core | The loaded build's issues as PoB2 judges them: PoB's own warning lines, what PoB's data says the game won't allow (a passive whose unlock constraint is unmet), resistances below their maximum (Missing&lt;Elem&gt;Resist &gt; 0), and each damage type's max hit taken below the configured enemy's hit of that type (engine comparisons), plus the empty gear slots PoB shows, stated as facts. |
| `get_passive_upgrades` | core | Find the best unallocated passives to pick up next. |
| `get_node_power` | core | Rank passive nodes by PoB's node power on one loadout of the loaded build, and find the best legal swap its tree has left. |
| `analyze_defenses` | core | The defence values PoB2 computes for a build: effective hit pool (TotalEHP), Life/Energy Shield/Mana/Spirit with their unreserved amounts, armour, evasion, physical damage reduction, evade, deflect and effective block chance, each resistance with the amount missing to its maximum, and each damage type's max hit taken against the configured enemy's hit of that type. |
| `validate_build` | core | Validate a build on PoB2's own judgments only: PoB's own warning lines (unmet attribute requirements, unreserved Life below 1, negative unreserved Mana or Spirit, too many passive points or gem groups, and so on), what PoB's own data says the game won't allow though PoB loads it (an allocated passive whose unlock constraint is unmet, such as an Oracle-only node in another class's tree), resistances below their maximum (Missing&lt;Elem&gt;Resist &gt; 0), and each damage type's max hit taken below the configured enemy's hit of that type (engine comparisons). |
| `export_build` | core | Export a copy of a build file. |
| `snapshot_build` | core | Create a versioned snapshot of a build file for easy rollback: a byte copy plus metadata (stats, tag, description), stored in the server's state folder, never in the builds folder. |
| `list_snapshots` | core | List all snapshots for a build with metadata and stats |
| `restore_snapshot` | core | Restore a build file from one of its snapshots. |
| `export_build_summary` | core | Generate a clean markdown summary of the loaded build suitable for sharing on Reddit, Discord, or as build documentation |
| `search_trade_items` | trade | Search the Path of Exile 2 trade site (trade2) for items with filters. |
| `get_item_price` | trade | Quick price check for a specific item by name on the PoE2 trade site. |
| `get_leagues` | trade | List the PoE2 trade leagues, in the trade site's order, and mark the default league (POE_LEAGUE if set, else the first current league that is not Standard or Hardcore). |
| `search_stats` | trade | Search the trade site's live stat list for stat ids to use in trade searches (search_trade_items mods[].stat_id). |
| `find_upgrades` | trade | Find upgrades on the Path of Exile 2 trade site for one item slot of the loaded build, the way Path of Building's trade dialog does it: PoB generates a weighted trade query from the build (sort_stats, default the build's saved trade weights, else Full DPS 1 + Effective Hit Pool 0.5), the server searches and fetches listings (at most 5 searches, 90 s budget), PoB scores every candidate against the build, prices are normalized with poe.ninja rates and filtered by max_price, and the results are ranked by rank_by. |
| `trade_query_options` | trade | What Path of Building's trade dialog offers for one item slot of the loaded build, for planning an upgrade search: whether PoB can generate a weighted trade search for the slot (and why not), the engine stats an upgrade search can sort by (sort_stats), the build's saved trade weights or PoB's defaults, the required-mod choices with their trade stat ids (required_mods), the currencies and trade statuses, and which slot-specific options (rune sockets, rune and anoint behaviour, jewel type) apply. |
| `get_currency_rates` | ninja | Get current PoE2 currency exchange rates from poe.ninja. |
<!-- tools:end -->

## Development

```bash
mise run test                  # the gate: fetches the pin if needed, builds, runs the full Jest suite
pnpm build                     # compile TypeScript into build/
pnpm docs:tools                # print the tool table; `pnpm docs:tools --write` updates this README
scripts/fresh-clone-check.sh   # clone HEAD into a temp dir, set it up, and check it as a server
```

- `mise run test` and `pnpm build` must both exit 0 before a change lands.
- The tests never touch the network or your builds folder. HTTP comes from the committed fixtures in
  `tests/fixtures/`, and the builds and state folders are temp dirs.
- Engine tests need `luajit` and the pinned checkout, and **fail** without them. Run them through
  `mise run test`, which provides both. `POB_SKIP_ENGINE=1` skips them instead.
- `scripts/fresh-clone-check.sh` sets up a clean clone with `mise run setup`, then starts the server
  with trade requests pointed at a dead address. It checks the tool list, a build load and the
  no-session `find_upgrades` result, and exits non-zero on any failure.
- Notes for agents and contributors are in `CLAUDE.md`. The design and spec are in
  `docs/stabilization/`.

## Migrating from earlier versions

<!-- migration:start -->
This section is for anyone who ran an earlier version of this server, or the PoE1 `pob-mcp` it was
ported from. Everything outside it describes the current server only.

**Removed tools.** These names now return an "Unknown tool" error.

- PoE1-only: `analyze_build_cluster_jewels`, `analyze_cluster_jewels`, `search_cluster_jewels`,
  `suggest_watchers_eye`, `suggest_masteries`, `check_boss_readiness`, `optimize_skill_links`,
  `create_budget_build`, `suggest_optimal_nodes`, `optimize_tree`, `analyze_items`.
- Legacy gem tools: `analyze_skill_links`, `suggest_support_gems`, `find_optimal_links`,
  `validate_gem_quality`, `compare_gem_setups`, `gem_upgrade_path`. Use `analyze_skills`,
  `suggest_supports` and `list_gems`.
- Trade and currency: `compare_trade_items`, `generate_shopping_list`, `find_resistance_gear`,
  `find_arbitrage`, `calculate_trading_profit`, `suggest_crafting`.
- `find_item_upgrades`: replaced by `find_upgrades` (and `trade_query_options` to plan a search).
- `save_tree`: use `lua_save_build`.
- `refresh_tree_data`: the tree data comes from the pinned PoB2 checkout.

**Environment variables.**

| Status | Variables |
|---|---|
| Removed | `POB_LUA_ENABLED`, `POE_TRADE_ENABLED`, `POB_LEGACY_GEM_TOOLS`, `POE_TRADE_USER_AGENT`, `POE_RATE_LIMIT_PER_SECOND`, `POE_CACHE_TTL` |
| Added | `POE_TRADE_DISABLED`, `POESESSID` (`POE_SESSION_ID` stays as an alias), `POE_LEAGUE`, `POB_ALLOW_UNPINNED`, `POB_SKIP_ENGINE` (tests), `POB_API_TEST_ACTIONS` (tests), `POB_TEST_ENGINE` (set by the test setup) |
| Changed meaning | `POB_TIMEOUT_MS` is now per request, measured from when the request is written. `POB_FORK_PATH` still names a checkout's `src/`, but its default is now the pinned `vendor/` checkout, and the pin check applies to it. The default `POB_DIRECTORY` changed from `~/Documents/Path of Building/Builds` (and a macOS variant) to `~/Documents/Path of Building (PoE2)/Builds` |
| Kept (unchanged) | `POB_DIRECTORY`, `POB_CMD`, `POB_ARGS`, `POB_DEBUG`, `POE_NINJA_DISABLED`, `POE_TRADE_BASE`, `POE_TRADE_REALM`, `XDG_STATE_HOME` |

The engine and the trade tools are now on by default: `POB_LUA_ENABLED=true` and
`POE_TRADE_ENABLED=true` are no longer needed, and no longer read.

**Install.** The old steps (`npm install`, `apt install luajit` or `brew install luajit`, and a
PathOfBuilding fork on an `api-stdio` branch) are replaced by `mise trust` and `mise run setup`, which
use pnpm, mise's pinned LuaJIT and the pinned upstream PoB2 release. Claude Desktop JSON configs are
replaced by the `claude mcp add` registration above.

**State folders.** Snapshots, backups, exports and presets used to live in `.pob-mcp/` and
`.pob-mcp-presets/` inside the builds folder. They now live in the state folder. The old locations are
ignored, and nothing is migrated.

**Prices.** Normalized prices are in the league's primary currency as poe.ninja reports it, no longer
labelled "Chaos equivalent".
<!-- migration:end -->

## License and notices

GPL-3.0 (see `LICENSE`). The Path of Building 2 engine is
[PathOfBuildingCommunity/PathOfBuilding-PoE2](https://github.com/PathOfBuildingCommunity/PathOfBuilding-PoE2),
fetched at setup and never modified. Thanks to the Path of Building community, and to
[zgrummons](https://github.com/zgrummons) for contributions to the original `pob-mcp`.

This product isn't affiliated with or endorsed by Grinding Gear Games in any way.
