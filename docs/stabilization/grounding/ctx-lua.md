# ctx-lua — Lua bridge (`pob-api/`) + PoB2 `v0.23.1` internals (existing-system ingestion)

Citations: repo files as `pob-api/<file>:<line>` (working tree at `968a104`); PoB tag as
`tag:<path>:<line>` (clone `…/scratchpad/pob2-v0.23.1`, HEAD `7d6f530cbdab20389ff8bc6ba97a37ac27f74e41`).
**[V]** = read in source or observed in a probe run just now; **[I]** = inference.
Probes (read-only, cwd = tag `src/`, luajit from the repo's `mise.toml`) are in
`…/scratchpad/formalize/lua-probe/probe{,2,3,4,5}.lua`; the tag clone's `git status` was clean after every run.

---

## 0. Contradictions and corrections (read first)

| # | Against | What is true on the tag | Evidence |
|---|---|---|---|
| X1 | **vision D-2** (the `HeadlessWrapper.lua` sha1 is "hashed with the *same* CRLF normalization as the manifest") vs **S-2** (`pob-pin.json` value `784d675…`) | `784d675b7440c3b413e49b26691dffadd5b68a3f` is the **raw LF** sha1. With the manifest's CRLF normalization the sha1 is **`77a3e3a9b7387ebc57ef0a35bb17c382282e3c7c`**. The pin file must store whichever value matches the chosen scheme; the two documents currently disagree. | [V] python sha1 on `tag:src/HeadlessWrapper.lua` |
| X2 | **vision D-6** (the `find_upgrades` slot set includes "Charm 1–3" and "gear … jewel sockets") | **Charm slots can't be generated.** `getTradeCategory` returns only `"flask"` for Charm, with no item category, so `StartQuery` logs "…is not supported for weighted trade query generation" and returns without starting the coroutine. **Weapon jewel sockets** (e.g. `Weapon 1 Jewel Socket 1`) match `^Weapon %d` first and then fail as an unknown weapon type. Other gear jewel sockets and tree sockets map to the `jewel` category and **require `options.jewelType`** (`nil .. "Jewel"` raises an error). `Arm 1/2` and `Leg 1/2` return no category. | [V] `tag:src/Classes/TradeHelpers.lua:256-302` (Charm :298-299, Jewel :295); `tag:src/Classes/TradeQueryGenerator.lua:822-829` |
| X3 | **recon E4 as refined by S-2** ("the wedge trigger is loading an empty string; a PoE1 root or malformed XML alone does not wedge"), which vision D-8(e) and invariant I-2 ("an empty-string load followed by a good load works") rely on | **Any failed load (PoE1 root, malformed XML or empty string) wedges the engine if it follows a successful XML load.** The previously loaded build is "unsaved". Its dev-mode `Shutdown` autosave then calls `SaveDB` on a build whose `savers` were already set to nil, which raises `Build.lua:2443: bad argument #1 to 'pairs'` on *every* later frame. `main.newMode` is never consumed, so every later load is a no-op. **From a freshly started process, a PoE1-root or empty load recovers** (which is what S-2 saw). **With `main.disableDevAutoSave = true` nothing wedges** in any sequence tested. So turning off the autosave (D-8(e)) is the actual root fix. **I-2's test must run valid → bad → valid**, not start from a fresh process. | [V] probe2 scenarios (§4.1). Code path: `tag:src/Modules/Main.lua:351-357`, `tag:src/Modules/Build.lua:1087-1099`, `:2443` |
| X4 | **vision D-3** (judgments come from `build.controls.warnings`) | `warnings.lines` is rebuilt **only** by `build:RefreshStatList()`. That runs at build Init and in `build:OnFrame` when `buildFlag` is set. **`calcsTab:BuildOutput()`, which is all the bridge calls, does not rebuild it**, so after any bridge mutation the warnings are stale. In addition, `RefreshStatList → EstimatePlayerProgress` **changes `characterLevel`** when `characterLevelAutoMode` is true, so reading the warnings is not side-effect-free. | [V] probe3: the warning appeared only after `build:RefreshStatList()`; `tag:src/Modules/Build.lua:2228-2269`, `:1014-1018`, `:1320-1329`; `tag:src/Classes/CalcsTab.lua:466-497` |
| X5 | **vision D-3** example "`<Type>MaximumHitTaken < totalEnemyDamage`" | `totalEnemyDamage` is the sum of all five `<Type>EnemyDamage` values (after conversion and crit). Each `<Type>MaximumHitTaken` describes a hit of one type only. The engine also exports per-type `<Type>EnemyDamage`. Whether "single-type max hit vs all-type total" is the intended comparison is a spec decision. | [V] `tag:src/Modules/CalcDefence.lua:2162,2171,3773-3774`; comparison semantics [I] |
| X6 | **vision D-6** ("PoB's exact-item URL (weight ±1 + `trade_filters.account`)") | PoB's exact-item URL **omits the realm segment**: `https://www.pathofexile.com/trade2/search/<league>?q=<json>`. PoB's no-session link includes it via `buildUrl`: `…/trade2/search/poe2/<league>?q=…`. Whether the realm-less URL resolves on the PoE2 trade site is unverified. | [V] `tag:src/Classes/TradeQuery.lua:1265` vs `:1020-1021`, `tag:src/Classes/TradeQueryRequests.lua:545-558` |
| X7 | **vision D-6** ("mirrors PoB2's own trade dialog"; the default for `include_mirrored` isn't stated) vs the **S-1 shim** (default exclude) | PoB's dialog defaults **"Mirrored Items" to checked**, i.e. include mirrored items and add no filter. The S-1 shim defaults `includeMirrored=false`, so every S-1 query carries `misc_filters.mirrored=false`. | [V] `tag:src/Classes/TradeQueryGenerator.lua:1121-1122`; `docs/stabilization/spikes/S-1-prototype/TradeShim.lua:75` |
| X8 | **vision D-6** (default sort stats "FullDPS 1.0 + TotalEHP 0.5") | That default applies only when the build has no saved weights. PoB loads the build's `<TradeSearchWeights>` into `itemsTab.tradeQuery.statSortSelectionList`, and `PriceItem` keeps that list if it is non-empty. "Mirror PoB" therefore means "use the build's saved weights if present, else the default". | [V] `tag:src/Classes/ItemsTab.lua:1168-1185`, `:1264-1280`; `tag:src/Classes/TradeQuery.lua:335-338` |
| X9 | **vision D-6** (`rank_by`: "the price modes fall back to `stat_value` when no rates are available") | Correct as our own behaviour, but don't claim PoB parity. PoB computes the fallback `StatValue` sort and then `return`s without storing it (a bug), leaving a notice and the stale order. | [V] `tag:src/Classes/TradeQuery.lua:866-869` |
| X10 | **S-2** ("Raw bridge: 56 actions (every handler in `Handlers.lua`)") | `Handlers.lua` registers **39** handlers; `Server.lua` adds `quit`, for **40 actions** in total. | [V] `grep -c '^handlers\.' pob-api/API/Handlers.lua` = 39; `pob-api/API/Server.lua:57-59` |
| X11 | recon E8 / D-10 (A3 owns the hidden-slot export) | Tree-socket slot controls (`Jewel <nodeId>`) have `inactive == nil` headless until `itemsTab:UpdateSockets()` runs (normally from `ItemsTab:Draw`, or from `CalcSetup` when granted nodes change). Filtering on `inactive` alone misses unallocated tree sockets. | [V] probe4: 19 tree sockets with `inactive` nil, then 19 true after `UpdateSockets()`; `tag:src/Classes/ItemsTab.lua:1397,1549-1569`; `tag:src/Modules/CalcSetup.lua:876-879` |
| X12 | vision §4 row `toggle_flask` (the fix only changes the slot list) | `BuildOps.set_flask_active` writes only `itemsTab.activeItemSet[slot].active`. The calcs read **`slot.active` on the `ItemSlotControl`**. The UI checkbox sets both. So as written, toggling a flask probably has no effect on the calcs until the item set is re-selected. | [V code] `pob-api/API/BuildOps.lua:405`; `tag:src/Modules/CalcSetup.lua:1091-1111`; `tag:src/Classes/ItemSlotControl.lua:32-50`; `tag:src/Classes/ItemsTab.lua:1496`. Runtime effect [I], not run |
| X13 | D-8(e) (E1 = "`calc_with` returns raw output") | The same crash class applies to **`get_stats` with a non-scalar field**: `fields:["ReqStrItem"]` (also `ReqDexItem`/`ReqIntItem` [I]) returns an item object, and encoding it fails with `reference cycle` outside the `pcall`. | [V] probe5: `encode mainOutput.ReqStrItem: reference cycle`; the `MainHand` and `SkillDPS` tables encode fine |

---

## 1. Bridge boot (`pob-api/bootstrap.lua`, 90 lines)

- **Launcher contract** [V `pob-api/bootstrap.lua:7-12`]: `argv[0]` is the absolute path of `bootstrap.lua` and the **cwd is the vanilla PoB `src/`**. The TS spawns `luajit <bootstrap>` with no further args [V `src/pobLuaBridge.ts:82`]. **No extra argv is allowed**: `main:Init` treats `arg[1]` as a build URL to download and import (`tag:src/Modules/Main.lua:64-77`), and `--no-jit`/`--no-ssl` are also read from `arg` (`:37-45`) [V].
- **Sequence** [V]:
  1. `get_script_dir()` from `debug.getinfo(1,'S').source` sets `SCRIPT_DIR` and the global `_G.POB_SCRIPT_DIR` (`:19-29`).
  2. `package.path = SCRIPT_DIR/?.lua;SCRIPT_DIR/?/init.lua;` + the existing path (`:33`). `require('API.X')` then resolves to `pob-api/API/X.lua`.
  3. The global `print` is replaced by a writer to `io.stderr`, *before* PoB loads (`:39-47`). PoB's `ConPrintf` is `print(string.format(...))` (`tag:src/HeadlessWrapper.lua:155-158`), so all PoB logging goes to stderr. PoB itself never writes stdout. The only stdio use in tag `Modules/`, `Classes/`, `Launch.lua` and `HeadlessWrapper.lua` is `io.read` at `HeadlessWrapper.lua:199`.
  4. utf8 fallback (`:52-60`): `pcall(require,'utf8')` resolves to `pob-api/utf8.lua` (a 28-line byte-wise stub) because `SCRIPT_DIR` comes first in `package.path`. This is irrelevant to PoB, which uses `local utf8 = require('lua-utf8')` (`tag:src/Modules/Common.lua:29`, `Classes/EditControl.lua:10`) and therefore **hard-requires the native `lua-utf8`** [V code; the "irrelevant" part is I].
  5. `dofile('HeadlessWrapper.lua')`: PoB's **own vanilla wrapper**, unmodified (`:67`).
  6. "Safety net" fallbacks for `build`/`newBuild`/`loadBuildFromXML` (`:71-86`) reference a global `mainObject`, which is **nil** (it is `local` at `tag:src/HeadlessWrapper.lua:8`; probe: `global mainObject=nil`). This is dead code [V].
  7. `dofile(SCRIPT_DIR..'/API/Server.lua')` (`:90`).
- **What HeadlessWrapper stubs** [V `tag:src/HeadlessWrapper.lua`]:
  - Callbacks: `runCallback`/`SetCallback`/`SetMainObject` (7-24).
  - Image handles (27-44) and every render call as a no-op (47-80). `GetScreenSize` returns 1920×1080.
  - **`GetTime()` returns 0** (103-105). The generator's time-based yield therefore never fires.
  - **`GetScriptPath()`/`GetRuntimePath()`/`GetUserPath()`/`GetWorkDir()` return `""`** (106-120).
  - `MakeDir` and `RemoveDir` are no-ops (115-116).
  - `LoadModule` and `PLoadModule` use `loadfile`, cwd-relative (124-145).
  - `PCall` (146-154). `Deflate`/`Inflate` return `""` (95-102). `Copy`, `OpenURL` and `LaunchSubScript` are no-ops.
  - `require` is wrapped so that `"lcurl.safe"` returns nil (176-183). HTTP is impossible inside PoB.
- **Boot flow** [V]:
  - `dofile("Launch.lua")` (186). Then `mainObject.continuousIntegrationMode = os.getenv("CI")` (191); nothing reads it on the tag.
  - `runCallback("OnInit")` and one `OnFrame` (193-194).
  - If `mainObject.promptMsg` is set, the wrapper prints it, **blocks on `io.read("*l")`** and `return`s (196-201). The ready banner is then never written before the TS timeout, and that read would consume the first request line [I].
  - Otherwise: the global `build = mainObject.main.modes["BUILD"]` (204), `newBuild()` (207-213: `SetMode("BUILD", false, "Help, I'm stuck in Path of Building!")` plus one `OnFrame`), `loadBuildFromXML(xml, name)` (214-217: `SetMode("BUILD", false, name or "", xmlText)` plus one `OnFrame`), and `loadBuildFromJSON` (218-226).
- **`build` identity is stable across loads.** `modes["BUILD"]` is the single `buildMode` object (`tag:src/Modules/Build.lua:20,2505`) that is re-`Init`ed on each `SetMode` [V probe: `build identity stable: true`]. Its **tabs are recreated on every Init** (`configTab`/`itemsTab`/`treeTab`/`skillsTab` at `Build.lua:516-519`), so any cache keyed on `build.itemsTab` must rebind after a load [V].
- **Dev mode.**
  - `launch:OnInit` reads `manifest.xml` or `../manifest.xml` (`tag:src/Launch.lua:45-57`). The tag's manifest has `<Version number="0.23.1" />` and **no `branch`/`platform` attributes**, so `devMode = true` (`Launch.lua:58-62`: "Looks like a remote manifest… Enable dev mode") [V; probe: `devMode=true versionNumber=0.23.1 branch=nil platform=nil`].
  - Dev mode also places user data at `GetScriptPath().."/"`, which is `"/"` (`tag:src/Modules/Main.lua:82-84`). Probe: `userPath="/" buildPath="/Builds/"`, and settings are read from **`/Settings.xml`** (`Main.lua:520`) [V].
  - Dev mode also disables the update check (`Launch.lua:83-86`) [V].
- **Dev-mode `~~temp~~` autosave** [V `tag:src/Modules/Build.lua:1086-1100`]:
  - **Trigger:** `buildMode:Shutdown()` runs on every mode switch, inside `main:OnFrame` (`Main.lua:351-354`), so **on every `new_build`/`load_build_xml`**. It saves when `launch.devMode and not main.disableDevAutoSave and self.targetVersion and not self.abortSave`.
  - **Behaviour:** if `dbFileName` is set, it overwrites that file. Otherwise, if `self.unsaved`, it sets `dbFileName = main.buildPath.."~~temp~~.xml"` (that is, **`/Builds/~~temp~~.xml`**) and `buildName="~~temp~~"`, then calls `SaveDBFile`.
  - **Who is affected:** XML-loaded builds have `dbFileName=false` and `modFlag=true` (`Build.lua:55-60`). After their `OnFrame`, `unsaved` is true (`:1374`), so **every load after an XML load attempts the write**. As uid 1000 the `io.open("/Builds/~~temp~~.xml","w+")` fails, and `main:OpenMessagePopup("Error", "Couldn't save the build file…")` adds one popup per load (`Build.lua:2468-2471`). Probe: `write-opens: /Builds/~~temp~~.xml [w+]`, `popups=1{Error}` [V]. A process with write access to `/` would create the file [I].
  - **Off switch:** set `main.disableDevAutoSave = true` at runtime (read at `:1087`; also a `Settings.xml` attribute, `Main.lua:651-652`). Verified to suppress the writes, the popups and the wedge (X3) [V].
  - **Also note:** `Init` deletes `self.dbFileName` when `buildName == "~~temp~~"` (`Build.lua:300-307`) [V].

## 2. Wire protocol today (`pob-api/API/Server.lua`, 87 lines)

- **JSON library:** `pcall(require,'dkjson')`, which finds **dkjson 2.5** (`tag:runtime/lua/dkjson.lua:55`) through the TS-set `LUA_PATH`. dofile fallbacks are at `:11-25`. `j_encode` is `json.encode(tbl,{indent=false})` (`:27-29`) [V].
- **Ready banner:** this is the first stdout line, written after the wrapper returns and `API.Handlers` has loaded (`:62`): `{"ok":true,"ready":true,"version":{"number":"0.23.1","branch":"?","platform":"?","apiVersion":"1.0.0"}}`. `branch`/`platform` are nil on the tag, so they become `'?'` (`pob-api/API/Handlers.lua:57-66`). dkjson key order follows `pairs`, so it is unordered [V].
- **Read loop** (`:63-87`) [V]:
  - Read `io.read("*l")`. **On EOF (nil), `break`.** The script ends, so the process exits (the exit itself is [I]).
  - Empty lines are skipped (`:66`).
  - `json.decode` failure, or a decoded value that isn't a table, writes `{"ok":false,"error":"invalid json"}` (`:67-71`).
- **Request shape:** `{ "action": string, "params"?: object }`. `params` defaults to `{}` (`:72-73`). **No `id` field is read or echoed.** An unknown action writes `{"ok":false,"error":"unknown action: <action>"}` (`:74-77`) [V].
- **Dispatch:** `local ok2,res = pcall(handler, params)` (`:79`).
  - On an exception it writes `{"ok":false,"error":"exception: <msg>"}` (`:80-81`). There is no traceback.
  - On success it writes `write_line(res)` (`:83`), and `quit` then `break`s (`:84`).
  - **JSON encoding happens in `write_line` (`:34-37`), called outside the `pcall`.** An encode error (`reference cycle`, an unsupported type such as a function) raises at top level. The error comes from `tag:runtime/lua/dkjson.lua:387-388`, and luajit dies (E1; S-2 observed `Server.lua:35: reference cycle`) [V code + S-2].
- **Success reply shape:** whatever the handler returns, by convention `{ok:true, <key>: …}` (§3). **Error shape:** `{ok:false, error:string}` [V].
- **`quit`** is defined in `Server.lua` (`:57-59`) and returns `{ok:true, quit:true}`. It is not in `Handlers.lua`.
- **Logging:**
  - `POB_API_DEBUG=1` enables `[Server]` and `[Handlers]` lines on stderr (`Server.lua:5-8`, `Handlers.lua:5-8`).
  - PoB's output goes to stderr through the `print` override.
  - stdout carries only protocol lines [V].
- **dkjson encoding facts** that matter for the D-10 runtime schemas [V probe5 + `tag:runtime/lua/dkjson.lua`]:
  - An empty Lua table encodes as **`[]`**. For example `masteryEffects={}` becomes `[]`.
  - A table with integer keys is an array unless `max>10 and max>2n` (`:74-96`). So `{[2]=1,[3]=2}` becomes `[null,1,2]`, while `{[5]=1,[100]=2}` becomes `{"5":1,"100":2}`.
  - NaN and ±inf become **`null`** (`:293-295`).
  - Numbers are written with `tostring`, i.e. LuaJIT `%.14g` (`:201-203`). This is the same formatting as PoB's `<PlayerStat value=tostring(v)>`.

## 3. Action table (`pob-api/API/Handlers.lua` → `pob-api/API/BuildOps.lua`)

M = mutates engine build state · R = read-only · F = writes a file. Every handler returns `{ok:false,error:<string>}` on failure.
Every BuildOps mutator ends with `M.get_main_output()`, which runs `calcsTab:BuildOutput()`, except where noted.
Mutators set `build.buildFlag=true` and never run `OnFrame` (so warnings go stale, X4) [V].

| Action (Handlers line) | BuildOps fn (line) | Params | Success reply | Kind / notes |
|---|---|---|---|---|
| `ping` (70) | — | — | `{ok,pong:true}` | R |
| `version` (74) | — | — | `{ok,version:{number,branch,platform,apiVersion}}` | R |
| `new_build` (78) | — (`_G.newBuild`) | **ignored** | `{ok}` | M. Name "Help, I'm stuck in Path of Building!"; no class selection (recon §3); runs the Shutdown autosave |
| `load_build_xml` (86) | — (`_G.loadBuildFromXML`) | `xml` (string, required), `name` (default `'API Build'`) | `{ok, build_id:1}` **always**. The result is **not checked** (`:94-95`). | M. Runs the autosave; see the wedge (X3) |
| `get_stats` (98) | `export_stats(fields)` (33) | `fields?: string[]` | `{ok, stats:{<k>:v…, _meta:{treeVersion=build.targetVersion ("0_1"), level, buildName}}}` | R (calls `BuildOutput`). **Default list** (`:38-45`): `Life EnergyShield Mana Spirit Ward Armour Evasion FireResist ColdResist LightningResist ChaosResist BlockChance SpellBlockChance LifeRegen ManaRegen TotalDPS FullDPS CombinedDPS`. Only non-nil keys are exported; values may be tables, see X13 |
| `get_items` (107) | `get_items` (414) | — | `{ok, items:[{slot,id,name?,baseName?,type?,rarity?,raw?,active?}]}` | R. Emits **every** slot in `orderedSlots`, then any leftovers: 113 on a fresh build, of which 91 contain "Jewel" and 72 are inactive gear sockets, with **no `inactive`/`shown` flag** (E8, X11) |
| `get_skills` (113) | `get_skills` (275) | — | `{ok, skills:{mainSocketGroup, calcsSkillNumber, groups:[{index,label,slot,enabled,includeInFullDPS,mainActiveSkill,skills[],gems:[{index,name,nameSpec,level,quality,enabled,isSupport,gemType,tags,tagKeys,known}],activeCount,supportCount}]}}` | R |
| `get_tree` (119) | `get_tree` (67) | — | `{ok, tree:{treeVersion(spec),classId,ascendClassId,secondaryAscendClassId,nodes:int[],masteryEffects:{}}}` | R. `masteryEffects` is empty on PoE2 trees, so it encodes as `[]` |
| `set_main_selection` (127) | `set_main_selection` (338) | `mainSocketGroup?, mainActiveSkill?, skillPart?` | `{ok, skills:<get_skills>}` | M |
| `set_tree` (134) | `set_tree` (92) | `classId, ascendClassId, secondaryAscendClassId?, nodes:int[], masteryEffects?, treeVersion?` | `{ok, tree:<get_tree>}` | M. **E2:** calls `ImportFromNodeList(nil, …, nodes, {}, {}, mastery, tv)` (`:113`), passing `{}` for **weaponSets** and **hashOverrides** (§4.10) |
| `add_item_text` (143) | `add_item_text` (361) | `text` (≤10240 bytes), `slotName?`, `noAutoEquip?` | `{ok, item:{id,name,slot}}` | M. Uses `new('Item', text)`, which is correct on the tag (§4.5) |
| `export_build_xml` (149) | `export_build_xml` (120) | — | `{ok, xml:<string>}` | R. **Exists.** Calls `build:SaveDB('api-export')`; the root is `<PathOfBuilding2>` |
| `set_level` (155) | `set_level` (130) | `level` 1–100 | `{ok}` | M. Sets `characterLevelAutoMode=false`, then `configTab:BuildModList()` |
| `set_flask_active` (164) | `set_flask_active` (391) | `index:int, active:bool` | `{ok}` | M. Only handles `"Flask N"`, not Charm; writes `activeItemSet[...].active` only (X12) |
| `get_build_info` (170) | `get_build_info` (148) | — | `{ok, info:{name,level,className,ascendClassName,classId,ascendClassId,treeVersion(build.targetVersion)}}` | R |
| `update_tree_delta` (176) | `update_tree_delta` (178) | `addNodes?, removeNodes?, classId?, ascendClassId?, secondaryAscendClassId?, treeVersion?` | `{ok, tree}` | M. Same E2 `{}`/`{}` call (`:198`) |
| `calc_with` (183) | `calc_with` (206) | `addNodes?, removeNodes?, useFullDPS?` (**no `masteryEffects` param in Lua**) | `{ok, output:<raw PoB output>}` | R (what-if through `GetMiscCalculator`). **E1: always crashes luajit on encode** (probe5: `calcFunc({})` output has a reference cycle) |
| `get_config` (189) | `get_config` (231) | — | `{ok, config:{enemyLevel, input:{scalars}}}` | R |
| `set_config` (195) | `set_config` (250) | `enemyLevel?` plus any `input` key (scalar values only) | `{ok, config}` | M. Writing `enemyLevel` is a no-op because `BuildModList` recomputes it from `input` (recon §3) |
| `create_socket_group` (202) | `create_socket_group` (458) | `label?, slot?, enabled?, includeInFullDPS?` | `{ok, socketGroup:{index,label}}` | M |
| `add_gem` (208) | `add_gem` (494) | `groupIndex, gemName, level?=20, quality?=0, qualityId?, enabled?, count?` | `{ok, gem:{gemIndex,name}}` | M. Silently accepts unknown names |
| `set_gem_level` (214) | `set_gem_level` (550) | `groupIndex, gemIndex, level` 1–40 | `{ok}` | M |
| `set_gem_quality` (220) | `set_gem_quality` (587) | `groupIndex, gemIndex, quality` 0–23, `qualityId?` | `{ok}` | M |
| `remove_skill` (226) | `remove_skill` (627) | `groupIndex` | `{ok}` | M. Refuses groups with a `source` |
| `remove_gem` (232) | `remove_gem` (655) | `groupIndex, gemIndex` | `{ok}` | M |
| `search_nodes` (238) | `search_nodes` (690) | `keyword, nodeType?, maxResults?=50, includeAllocated?=true` | `{ok, results:{nodes:[{id,name,type,stats,allocated,x,y,orbit,orbitIndex,ascendancyName}],count}}` | R |
| `list_gems` (244) | `list_gems` (813) | `type?, search?, tag?, maxResults?=400, dedupeByName?` | `{ok, result:{gems:[…],count,total}}` | R |
| `get_classes` (250) | `get_classes` (880) | — | `{ok, result:{classes:[{classId,name,ascendancies:[{id,name}]}]}}` | R |
| `save_build` (256) | `save_build` (907) | `path` | `{ok, result:{path,bytes}}` | F. Writes with `io.open(path,'w+')`; `ResetModFlags()` does **not** prevent the autosave/wedge (probe2 `saved-then-poe1`) |
| `set_socket_group_enabled` (262) | (932) | `groupIndex, enabled` | `{ok, result:{groupIndex,label,enabled}}` | M |
| `set_gem_enabled` (268) | (959) | `groupIndex, gemIndex, enabled` | `{ok}` | M |
| `get_mastery_options` (274) | (992) | — | `{ok, result:{masteries:[…]}}` | R. Empty on PoE2 trees; D-4 deletes it |
| `create_spec` (280) | (1056) | `title?, copyFrom?, activate?` | `{ok, result:{index,title,activated}}` | M. Uses `new('PassiveSpec', build, ver)`; **no `BuildOutput`** |
| `list_specs` (286) | (1030) | — | `{ok, result:{specs:[{index,title,treeVersion,classId,className,ascendClassName,pointsUsed,active}],activeSpec}}` | R |
| `select_spec` (292) | (1095) | `index` | `{ok, result:{activeSpec,title}}` | M |
| `delete_spec` (298) | (1109) | `index` | `{ok, result:{deleted,activeSpec,remaining}}` | M. No `BuildOutput` |
| `rename_spec` (304) | (1133) | `index, title` | `{ok, result:{index,title}}` | M |
| `list_item_sets` (310) | (1149) | — | `{ok, result:{itemSets:[{id,title,active}],activeItemSet}}` | R |
| `select_item_set` (316) | (1168) | `id` | `{ok, result:{activeItemSet,title}}` | M |
| `quit` (`Server.lua:57`) | — | — | `{ok, quit:true}` then exit | — |

All of the above [V] from `pob-api/API/Handlers.lua` and `pob-api/API/BuildOps.lua` at the cited lines.

## 4. PoB internals the spec will touch (tag `v0.23.1`)

### 4.1 Load path, failure modes, how to detect failure
- **No `main:LoadBuild` exists** on the tag [V grep]. The path runs:
  1. `loadBuildFromXML` calls `main:SetMode("BUILD", false, name, xml)` (`Main.lua:504-507`, which only queues the switch).
  2. `runCallback("OnFrame")` reaches `main:OnFrame` mode-switch loop `while self.newMode do` (`Main.lua:351-362`).
  3. That loop runs `CallMode("Shutdown")` on the old build (autosave, §1), then `CallMode("Init", false, name, xml)`.
  4. `buildMode:Init` (`Build.lua:30`) calls **`self:LoadDB(buildXML, "Unnamed build")`** (`:56`). The literal file name "Unnamed build" is why the error text says `Error parsing 'Unnamed build'`.
- **`LoadDB` failure branches** (`Build.lua:2377-2389`). Each returns true, which makes `Init` call `CloseBuild()` (`SetMode("LIST")`) and return:
  - (a) parse error `"file returns nil"` → `main:OpenCloudErrorPopup`;
  - (b) other parse error → `launch:ShowErrMsg("^1"..errMsg)`;
  - (c) **root ≠ `PathOfBuilding2`** → `ShowErrMsg("^1Error parsing '%s': 'PathOfBuilding2' root element missing")` (`:2386-2388`);
  - (d) an empty string makes `ParseXML` return a root with no child, and `dbXML[1].elem` **throws** `Build.lua:2386: attempt to index a nil value`, caught by `launch:OnFrame`'s `PCall` (`Launch.lua:108-115`) and turned into `In 'OnFrame': …` [V probe2].
- Later sections can also abort the load: a saver's `Load` returning true (`Build.lua:556-558`) or `treeTab:Load` returning true (`:565-567`) [V].
- **`launch:ShowErrMsg` is sticky.** It sets `promptMsg` only if it is not already set (`Launch.lua:377-384`), and nothing clears it headless. Later errors are silently dropped [V].
- **Observed states** [V probe2, dev autosave ON unless noted]:

| Sequence | Result |
|---|---|
| fresh → PoE1 root → valid | PoE1 load leaves `main.mode="LIST"`, 1 error; the valid load recovers (`mode=BUILD`) |
| fresh → `""` → valid | `""` leaves `mode="BUILD"` (it threw mid-Init), error `Build.lua:2386`; the valid load **recovers** |
| valid → PoE1 / malformed / `""` → valid → valid | **wedged**: `mode=BUILD newMode=LIST/BUILD name=~~temp~~`, repeated `Build.lua:2443 … 'pairs' (table expected, got nil)`, 1 Error popup, 1 write attempt |
| valid → `ResetModFlags()` → PoE1 → valid | **wedged** (`unsaved` is only recomputed in `build:OnFrame`, which runs after `Shutdown`) |
| `main.disableDevAutoSave=true`; valid → PoE1 → valid → valid | recovers; 0 writes, 0 popups |

- **Detection signals** available to a bridge [I, from the above]:
  - pre-validate: `xml` non-empty, `common.xml.ParseXML(xml)` succeeds, and `dbXML[1].elem=="PathOfBuilding2"` (the same check as `Build.lua:2386`);
  - post-check: `main.mode=="BUILD" and main.newMode==nil` and `build.buildName==name`;
  - clear `launch.promptMsg=nil` before each load and check it afterwards, or wrap `launch.ShowErrMsg` as the probe did.
- After a failed load the `build` object's tabs may be stale or partial (the early return comes before the tab construction at `Build.lua:516`) [I]. Recovery means reloading a snapshot (D-8(d)).
- **Popups:** `main.popups` is a LIFO stack (`OpenPopup` inserts at 1, `ClosePopup` removes 1; `Main.lua:1650-1658`). Autosave failures add `"Error"` popups that are never closed headless [V].

### 4.2 Warnings (`build.controls.warnings`)
- **Storage:** `build.controls.warnings.lines`, a plain array of strings created in Init (`Build.lua:484-485`). It is **reset and rebuilt only in `buildMode:RefreshStatList()`** (`:2228-2269`). That calls `AddDisplayStatList` (warnFunc and cost warnings), then `InsertItemWarnings`, then `EstimatePlayerProgress` [V]. Read headless with `build:RefreshStatList(); build.controls.warnings.lines` [V probe3].
- **warnFunc sources** (`tag:src/Modules/BuildDisplayStats.lua`) [V]:
  - DoT DPS ≥ `data.misc.DotDpsCap`: Bleed/Corrupting Blood/Ignite/Burning Ground/Poison/Caustic Ground/Total DoT, "… exceeds in game limit" (45-60, 217; minion variants 229-237).
  - **Unmet attribute requirements:** "You do not meet the Strength/Dexterity/Intelligence requirement of <item|gem|your total … support gems.>" (96-100).
  - Precise Technique accuracy (114-115).
  - **"Your unreserved Life is below 1"** (122), **"Your unreserved Mana is negative"** (132), **"Your unreserved Spirit is negative"** (140).
- **Lines inserted by `Build.lua`** [V]:
  - Cost warnings: "You do not have enough <Life|Mana|Rage|Energy Shield> to use: …" and "…Unreserved life/Mana% to use: …" (2173-2192).
  - EternalLife and Vixen warnings (2193-2201).
  - Item warnings: jewel limit, too many gems in socket group, lineage support limit, gem-group count (2204-2225).
  - Points: "You have too many passive/ascendancy/secondary ascendancy points allocated" (1030-1032), "You have allocated N too many weapon set 1/2 passives" (1036-1049), "You have N Weapon set 2 passives available" (1051-1056).
- **Side effect:** `EstimatePlayerProgress` sets `characterLevel` and calls `configTab:BuildModList()` when `characterLevelAutoMode` is true (`:1014-1018`), and writes UI labels. `set_level` turns auto mode off (`pob-api/API/BuildOps.lua:139`) [V].

### 4.3 `Build:SaveDB` / `SaveDBFile` / `<PlayerStat>`
- **`SaveDB(fileName)`** (`Build.lua:2432-2456`):
  - Builds the root `{elem="PathOfBuilding2"}`, then the `Build` section (`buildMode:Save`), then **`pairs(self.savers)`**: Config, Notes, Party, Tree, TreeView, Items, Skills, Calcs, Import (`:524-534`). Section order is therefore **non-deterministic** (S-2 [V]).
  - Composes the XML with `common.xml.ComposeXML`. On failure it calls `launch:ShowErrMsg` and returns nil.
  - `fileName` is used only in that error message. It does **not** reset the mod flags [V].
- **`SaveDBFile()`** (`:2459-2488`): if there is no `dbFileName` it calls `OpenSaveAsPopup`. Otherwise it writes `io.open(dbFileName,"w+")` (on failure: an `OpenMessagePopup` "Couldn't save the build file…") and then calls `ResetModFlags()` [V].
- **`<PlayerStat>` writing** (`buildMode:Save`, `:1169-1207`) [V]:
  - For each `displayStats` entry whose `flag` matches, `statName = stat..(childStat or "")` (e.g. `MainHandAccuracy` from `MainHand.Accuracy`). It is de-duplicated by name. If the value is non-nil, it writes `<PlayerStat stat=… value=tostring(v)>`. The condition `(condFunc(...) or true)` at `:1194` is **always true**, so `condFunc` doesn't filter.
  - `SkillDPS` becomes `<FullDPSSkill stat value skillPart source>` (`:1174-1188`).
  - Then `extraSaveStats` (PowerCharges[Max], FrenzyCharges[Max], EnduranceCharges[Max], ActiveTotemLimit, ActiveMinionLimit; `BuildDisplayStats.lua:252-261`) are written without de-duplication.
  - Then `<MinionStat>` if a minion exists.
  - Probe: 100 `PlayerStat` for a fresh build; S-2 reports 109 for Grenadator.
- **`ResetModFlags`** (`:1245-1256`) clears `modFlag` on the build and every tab, but `unsaved` is only recomputed in `build:OnFrame` (`:1374`) [V].

### 4.4 Loader root check
`dbXML[1].elem ~= "PathOfBuilding2"` → error (`Build.lua:2386-2388`). `Settings.xml` has the same check (`Main.lua:532`) [V].

### 4.5 Class constructor (`new`)
- **`new(className, ...)`** (`tag:src/Modules/Common.lua:115-159`) forwards varargs to `class._constructor(object, ...)` (`:147-149`). Classes are declared with `newClass(name, [parents…], ctor)` (`:78-114`) [V].
- **Old style `new('Item', raw)` works** (probe: `ok=true base=Ruby Ring`). `Item` ctor is `(self, raw, rarity, highQuality)` → `ParseRaw(sanitiseText(raw))` (`tag:src/Classes/Item.lua:71-75`). `debug.getinfo(new,'u').isvararg == true` on the tag, so S-2's `construct()` selects the old style [V].
- **Ctor signatures** [V]:
  - `PassiveSpec(build, treeVersion, convert)` (`PassiveSpec.lua:25`);
  - `TradeQueryGenerator(queryTab)` (`TradeQueryGenerator.lua:114`);
  - `TradeQuery(itemsTab)` (`TradeQuery.lua:22`);
  - `TradeQueryRequests(rateLimiter)` (`TradeQueryRequests.lua:11`).

### 4.6 `manifest.xml` format and PoB's hashing
- **Format** (`tag:manifest.xml`) [V]:
  - `<PoBVersion>` → `<Version number="0.23.1" />` (line 3; no branch/platform) → 4 `<Source part=… url=…{branch}…>` → 1695 `<File name=… part=… sha1=…>`.
  - Parts: default 3, program 1083, tree 453, runtime 130 + 26 with `runtime="win32"`.
  - Path roots: `default` = repo root, `program`/`tree` = `src/`, `runtime` = `runtime/`.
  - Names may contain the `{space}` placeholder: 1 entry, `Path{space}of{space}Building-PoE2.exe`. It is stored literally in git; `UpdateCheck` matches both spellings (`tag:src/UpdateCheck.lua:117,180-181`).
  - `HeadlessWrapper.lua` is **excluded** from the manifest (`tag:manifest.cfg` `[program] exclude-files`).
- **Generator scheme** (`tag:update_manifest.py:104-108`): if the file has no NUL byte, `re.sub(rb"\r\n?|\n", b"\r\n", data)`, i.e. normalize **to CRLF**. Then sha1 [V].
- **Updater/verifier scheme** (`tag:src/UpdateCheck.lua:191,257,273`): accept if `sha1(content)` **or** `sha1(content:gsub("\n","\r\n"))` matches. This equals the generator scheme for LF-only files, which is what a `text=auto` Linux checkout has (`tag:.gitattributes`: `* text=auto`) [V].
- **Measured:** with the python scheme over the full tag clone, **all 1694 present entries match** (program 1083, tree 453, runtime 155, default 3; 1 absent = the `{space}` exe), in 1.09 s with python including images [V].

### 4.7 `calcLib.canGrantedEffectSupportActiveSkill(grantedEffect, activeSkill)`
- **Location:** `tag:src/Modules/CalcTools.lua:85-110` (recon's `:108` is dev head).
- **Logic:** checks `cannotBeSupported`, `supportGemsOnly`, item-granted exclusions, `excludeSkillTypes`, `isTrigger`, then `requireSkillTypes` against `activeSkill.skillTypes`, or `summonSkill.skillTypes`/minion types.
- **`activeSkill` is an active-skill object, not a gem.** PoB's own usage iterates `socketGroup.displaySkillList` (populated in MAIN mode at `CalcSetup.lua:2034`) together with `gemData.grantedEffect.support` (`tag:src/Classes/GemSelectControl.lua:266-275`) [V].

### 4.8 ItemsTab slot names (PoE2)
- **`baseSlots`:** `Weapon 1, Weapon 2, Helmet, Body Armour, Gloves, Boots, Amulet, Ring 1, Ring 2, Ring 3, Belt, Charm 1, Charm 2, Charm 3, Flask 1, Flask 2, Arm 1, Arm 2, Leg 1, Leg 2` (`tag:src/Classes/ItemsTab.lua:32`) [V].
- **Weapon swap:** each `Weapon N` gets a `"Weapon N Swap"` slot (`weaponSet=2`). The `shown()` of the main and swap slots follows `activeItemSet.useSecondWeaponSet` (`:226-237`) [V].
- **Ring 3** is `shown()` only if `modDB:Flag("AdditionalRingSlot")` (`:238-241`; the probe returned `nil` on a fresh build) [V].
- **Gear jewel sockets:** `"<parent> Jewel Socket 1..6"` for Weapon 1/2, both Swap slots, Helmet, Gloves, Body Armour, Boots, Belt and Ring 1–3: 12 × 6 = 72 (`:210-221,243-257`). They are inactive when the index is above the equipped item's `jewelSocketCount` (`ItemSlotControl.lua:107-115`) [V].
- **Tree sockets:** `"Jewel <nodeId>"`, one per `Socket` or `containJewelSocket` node of `build.latestTree`: 19 on the tag (`:276-290`). `inactive` is set only by `UpdateSockets` (X11) [V].
- **Probe totals:** 113 slots in total, 91 jewel-ish. Non-jewel order: `Weapon 1, Weapon 1 Swap, Weapon 2, Weapon 2 Swap, Helmet, Body Armour, Gloves, Boots, Amulet, Ring 1, Ring 2, Ring 3, Belt, Charm 1, Charm 2, Charm 3, Flask 1, Flask 2, Arm 1, Arm 2, Leg 1, Leg 2` [V].
- **Flask and Charm** slots both have an `activate` checkbox that sets `slot.active` *and* `activeItemSet[slot].active` (`ItemSlotControl.lua:32-50`). Calcs read **`slot.active`** (`CalcSetup.lua:1096,1108`) [V].

### 4.9 `build.calcsTab.mainOutput` keys (CalcDefence, tag) — present on a fresh build per probe3 [V]

| Key(s) | Source | Note |
|---|---|---|
| `Missing{Fire,Cold,Lightning,Chaos}Resist` | `CalcDefence.lua:941` (= max(0, max − final)); `resistTypeList` at `:29` | No `<Elem>ResistMax` output exists (probe: `FireResistMax=nil`). `MissingTotem<Elem>Resist` is at `:946`, `<Elem>ResistTotal` at `:920`, `<Elem>ResistOverCap` at `:939` |
| `{Physical,Lightning,Cold,Fire,Chaos}MaximumHitTaken` | `:3773-3774` (`dmgTypeList` `:27`) | `SecondMinimalMaximumHitTaken` is at `:3834` and is a `powerStatList` stat ("Eff. Maximum Hit Taken") |
| `totalEnemyDamage`, `totalEnemyDamageIn`, `<Type>EnemyDamage` | `:2065-2066`, `:2162`, `:2171` | See X5 |
| `TotalEHP` | `:3385` (= `TotalNumberOfHits × totalEnemyDamageIn`) | — |
| `EvadeChance` (+ Melee/Projectile/Spell/SpellProjectile variants, `splitEvade`/`noSplitEvade`) | `:1447-1478` | **`EvasionChance` exists nowhere** in tag `Modules/` or `Classes/` (grep count 0) |
| `DeflectChance`, `DeflectionRating`, `DeflectEffect` | `:1516-1522` | — |
| Also present (probe3) | — | `PhysicalDamageReduction`, `EffectiveBlockChance`, `ManaUnreserved`, `LifeUnreserved`, `SpiritUnreserved`, `EnergyShieldRecharge`, `Ward`, `FullDPS`, `CombinedDPS`, `TotalDPS`. `MainHandAccuracy` is **not** a key; it is `MainHand.Accuracy`. 624 numeric keys; non-scalar keys: `MainHand`, `OffHand`, `ReqStrItem` (**cyclic**), `SkillDPS` |

### 4.10 Tree import (E2) and the misc calculator
- **`spec:ImportFromNodeList(className, classId, ascendClassId, secondaryAscendClassId, hashList, weaponSets, hashOverrides, masteryEffects, treeVersion)`** (`tag:src/Classes/PassiveSpec.lua:321-375`) [V]:
  - `weaponSets[id]` sets `node.allocMode` (0/1/2) (`:357,368`).
  - `hashOverrides` sets `self.hashOverrides` plus `ReplaceNode` (attribute choices) (`:335,344-350`).
  - PoB's own `Load` passes `copyTable(self.hashOverrides, true)` and a `weaponSets` map from the `WeaponSet<N>` XML (`:104-144,219`).
  - So the faithful values to pass are `{[id]=node.allocMode}` for allocated nodes with `allocMode~=0`, plus `copyTable(spec.hashOverrides,true)` [I].
- **Misc calculator:** `calcsTab:GetMiscCalculator()` returns `unpack(self.miscCalculator)` (`CalcsTab.lua:703-705`). It is captured **at the last `BuildOutput`** (`:496`), so it is stale if the build changed without a `BuildOutput` [V].
  - The closure is `(override, useFullDPS, fastCalcOptions)` and returns `env.player.output` (`tag:src/Modules/Calcs.lua:123-177`). FullDPS is computed when `useFullDPS ~= false or build.viewMode=="TREE"` (`:167`); the default `viewMode` is "TREE" (`Build.lua:48`).
  - Override keys used in PoB: `addNodes`, `removeNodes`, `repSlotName`+`repItem`, `toggleFlask` [V].

## 5. PoB trade classes on the tag

### 5.1 Entry points the S-1 prototype drove
(`docs/stabilization/spikes/S-1-prototype/TradeShim.lua`, `run.lua`) [V]
- **Generation** (`TradeShim.lua:61-132`):
  1. `new("TradeQueryGenerator", {itemsTab=build.itemsTab})`, cached and rebound per load (`:41-50`). The ctor runs `InitMods()`, which loads `Data/QueryMods.lua` (707 KB, sections AgainstTheDarkness/AllocatesXEnchant/Corrupted/Enchant/Explicit/HeartOfTheWell/Implicit/Rune), and stores `queryTab`/`itemsTab` and `last*=nil` (`TradeQueryGenerator.lua:114-122,369-377`).
  2. Clear `lastMaxPrice`/`lastMaxPriceTypeIndex`/`lastMaxLevel`, which are sticky and override the options (`:770-778`).
  3. Set `tradeTypeIndex` and `requesterContext` plus `requesterCallback(ctx, queryJson, errMsg)` (`:1090`).
  4. Call `gen:StartQuery(build.itemsTab.slots[slot], options)` (`:769-873`). It opens a "Please Wait" popup (`:870-872`) and creates `calcContext.co`.
  5. Resume `calcContext.co` until dead. **Do not use `OnFrame`**: it re-raises a coroutine error only in devMode and then calls `FinishQuery` on partial weights anyway (`:740-753`). With `GetTime()=0` the yield at `:693-698` never fires.
  6. Copy `gen.modWeights` (each `{tradeModId, weight, meanStatDiff}`, `:689`) **before** `gen:FinishQuery()` (`:922-1094`, which trims and closes the popup).
- **Evaluation** (`TradeShim.lua:136-237`):
  1. `new("TradeQueryRequests")`, then `FetchResultBlock("headless://", cb)`. Pop `requestQueue.fetch[1]` and call `.callback(rawBody)` to reuse PoB's fetch-JSON → item-text parser (`TradeQueryRequests.lua:273-450`).
  2. `new("TradeQuery", build.itemsTab)` with `.tradeQueryGenerator = gen`. Note that `build.itemsTab.tradeQuery` already exists (`ItemsTab.lua:164`).
  3. `tq:FilterToSafeItems(entries, slot)`, then the rune/anoint rewrite.
  4. `calcFunc({repSlotName, repItem=new("Item", s)})` → `gen.WeightedRatioOutputs(base, tq:ReduceOutput(out), statWeights)`. This equals `TradeQuery:GetResultEvaluation` (`TradeQuery.lua:794-836`), and S-1 cross-checked the equality.
- **`run.lua`** boots exactly like `bootstrap.lua` (stderr `print`, `dofile('HeadlessWrapper.lua')`), then calls `loadBuildFromXML` and `dofile(TradeShim)`. Requests are run under `pcall`; `#main.popups` is checked afterwards (`run.lua:8-46`).

### 5.2 Generator `options` table (consumed by `StartQuery`/`ExecuteQuery`/`FinishQuery`) and PoB UI defaults (`RequestQuery`, `:1096-1433`) [V]

| Field | Effect | UI control / default |
|---|---|---|
| `statWeights` `[{stat,label,weightMult,transform?}]` | Weighting through `WeightedRatioOutputs` | "Stat to Sort By" labels (`:1227-1247`). Comes from `TradeQuery.statSortSelectionList`; default FullDPS 1.0 + TotalEHP 0.5 (`TradeQuery.lua:179-190`); per-build saved `<TradeSearchWeights>` takes precedence (X8). Slider 0.01–1.0, 0 = disabled (`TradeQuery.lua:651-660`) |
| `includeCorrupted` | also weights `modData.Corrupted` (`:914-916`) | Checkbox "Corrupted Mods"; default **true** unless the slot item is already corrupted (`:1113-1115`) |
| `includeMirrored` | false adds `misc_filters.mirrored=false` (`:1041-1048`) | "Mirrored Items"; default **true** (`:1121-1122`) |
| `includeRunes` | weights `modData.Rune` (`:917-919`) | "Rune Behaviour" `{Copy Current, Keep, Remove}`, default Copy Current; only on Weapon 1/2 (incl. Swap), Helmet, Body Armour, Gloves, Boots (`:1126-1142`); `includeRunes = (sel=="Keep")` (`:1272`) |
| (anoint) | applied after the fetch only | "Anoint Behaviour" `{Copy Current, Keep, Remove}` on Amulet, default Copy Current (`:1144-1160`) |
| `maxPrice`, `maxPriceType` | `trade_filters.filters.price={option=maxPriceType, max=maxPrice}` when `maxPrice>0` (`:1050-1059`) | Max Price box plus a currency dropdown from `currencyTable` (`:755-767`): **"Exalted Orb Equivalent"(id nil, default)**, "Exalted Orb"`exalted`, "Chaos Orb"`chaos`, "Divine Orb"`divine`, "Orb of Augmentation"`aug`, "Orb of Transmutation"`transmute`, "Regal Orb"`regal`, "Vaal Orb"`vaal`, "Orb of Annulment"`annul`, "Orb of Alchemy"`alch`, "Mirror of Kalandra"`mirror` |
| `maxLevel` | `req_filters.filters.lvl.max` (`:1061-1070`) | "Max Level"; default empty |
| `sockets` | `equipment_filters.filters.rune_sockets.min` (`:1072-1081`) | "# of Empty Sockets"; not shown for jewel/Flask/Belt/Ring/Amulet/Charm (`:1220`) |
| `requiredMods` `[{tradeId,value}]` | `and` group `{id, value={min=value}}` (`:1037-1040`) | "+ Add Required Stat" × **3** (`maxSelectors`, `:1365`); choices are the slot-category entries of `modData` Explicit/Implicit/Corrupted (`:1341-1362`) |
| `jewelType` | `itemCategory = jewelType.."Jewel"` (**required** for jewel slots, `:827-829`); "Radius" restricts to `RadiusJewel` mods (`:897-906`) | "Jewel Type" `{Base, Radius}`, default Base (`:1193-1198`) |
| `special` `{itemName}` | Megalomaniac / Heart of the Well / Against the Darkness paths (`:786-820,876-893`) | unique rows (deferred, vision §2) |
| `account` | **crashes**: indexes `queryTable.query.filters.trade_filters` before it exists (`:1001-1003`) | not set by the UI; apply the account filter in TS (as `TradeQuery.lua:1258-1261` does) |
| `gen.tradeTypeIndex` (not in options) | `status.option = {"securable","available","onlineleague","online","any"}[i]` (`:954-961,975`) | Trader pane dropdown `{"Instant buyout", "Instant buyout and in person", "In person (online in league)", "In person (online)", "Any (includes offline)"}`, default 1 (`TradeQuery.lua:298-311`) |

### 5.3 `powerStatList`
- **Location:** `tag:src/Modules/Data.lua:127-179`.
- **Entries `{stat,label,transform?,ignoreForItems?}`:**
  - `Offence/Defence` (ignoreForItems) and `Name` (itemField).
  - Damage: FullDPS "Full DPS", CombinedDPS, TotalDPS "Hit DPS", WithImpaleDPS, AverageDamage, Speed, TotalDot, BleedDPS, IgniteDPS, PoisonDPS.
  - Pools and recovery: Life, LifeRegen, LifeLeechRate, Armour, Evasion, EnergyShield, EnergyShieldRecoveryCap, EnergyShieldRegen, EnergyShieldLeechRate, Mana, ManaRegen, ManaLeechRate, Ward, Spirit.
  - Attributes: Str, Dex, Int, TotalAttr.
  - Avoidance: Melee/Spell/ProjectileAvoidChance.
  - Defence summary: TotalEHP "Effective Hit Pool", SecondMinimalMaximumHitTaken; `<Type>TakenHit` (transform −v).
  - Other: CritChance, CritMultiplier, Bleed/Freeze/Ignite/ShockChance, EffectiveMovementSpeedMod, BlockChance, SpellBlockChance, SpellSuppressionChance, EffectiveLootRarityMod.
- **Minion copies:** `Minion<stat>` entries are appended for non-DPS stats, minus AverageDamage/TotalDot/Str/Dex/Int/Spirit/EffectiveLootRarityMod (`:213-232`).
- **`GetFromOutput(output, statTable, skipTransform)`** (`:185-211`): FullDPS falls back to CombinedDPS plus minion CombinedDPS; `Minion…` reads `output.Minion`; DPS stats add the minion value.
- **Selectable sort stats** = entries with `not ignoreForItems and label ~= "Name"` (`TradeQuery.lua:636-648`). `data.misc.maxStatIncrease = 2` (`Data.lua:305`) [V].

### 5.4 How the query JSON is built (`FinishQuery`, `:922-1094`) [V]
- **Baseline:** `originalOutput` = the slot with the current item's explicit+implicit mod lines on the blank test base. `currentStatDiff = WeightedRatioOutputs(base, originalOutput)*1000 − baseStatValue`. **`minWeight = currentStatDiff*0.5`** (`:936-951`).
- **Sort:** `modWeights` sorted by `meanStatDiff` desc, ties broken by |weight| (`:940-945`). The tie order is unstable across runs; S-1 breaks ties by id.
- **Skeleton:** `{query:{filters:{type_filters:{filters:{category:{option=<itemCategoryQueryStr>}, rarity:{option="nonunique"}}}}, status:{option=<tradeType>}, stats:[{type="weight", value:{min=minWeight}, filters:[{id, value:{weight}}]}, {type="and", filters:[{id, value:{min}}]}]}, sort:{["statgroup.0"]="desc"}, engine="new"}` (`:965-990`).
  - The **`and` group is always emitted**, even when empty, because `requiredMods` defaults to `{}` (`:964,982`).
- **Filter cap:** `MAX_FILTERS = 35` (`:108`). The weighted filters kept number `35 − num_extra`, where `num_extra = 2 (+1 if !includeMirrored) (+1 if maxPrice>0) (+1 if maxLevel>0) (+1 if sockets>0) + #requiredMods` (`:994-1022`).
- **Errors:** "Could not generate search, found no mods to search for" when the weight group is empty (`:1084-1087`). `FinishQuery` passes `dkjson.encode(queryTable)` to the callback, then calls `main:ClosePopup()` (`:1089-1093`).
- **Per-mod test value:** `ceil((max−min)*main.defaultItemAffixQuality(0.5) + min)`. `weight = meanStatDiff / tradeModValue`, and a mod is kept only if `meanStatDiff > 0.01` (`:646,687-690`).
- **Category:** `tradeHelpers.getTradeCategory(slotName, item)` (`TradeHelpers.lua:256-302`). An empty slot uses test base "Diamond" (`TradeQueryGenerator.lua:781-782`), and an empty weapon slot maps to `weapon.one`/1HWeapon. Flask 1 maps to `flask.life`, Flask 2 to `flask.mana`. Charm, Arm and Leg are unsupported (X2).

### 5.5 Trader settings and sort modes (`TradeQuery:PriceItem`) [V]
- **"Fetch Pages":** edit box, default `maxFetchPerSearchDefault = 2`, clamped 1–10. `tradeQueryRequests.maxFetchPerSearch = 10 × pages`. Tooltip: "Each page fetches up to 10 items." (`TradeQuery.lua:313-331`).
- **"Sort By"** (`:351-379`), exact strings:
  - `StatValue="(Highest) Stat Value"` (default, index 1);
  - `StatValuePrice="Stat Value / Price"`;
  - `Price="(Lowest) Price"`;
  - `Weight="(Highest) Weighted Sum"`.
- **Semantics** (`SortFetchResults`, `:906-979`):
  - StatValue: sum of evaluation weight, descending.
  - StatValuePrice: `weight − 0.1·log10(divPrice)` descending (`:960-963`).
  - Price: divPrice ascending.
  - Weight: trade order, unchanged.
  - The price modes need `pbCurrencyConversion[league][currency]` (poe.ninja `primaryValue` in divines; `:105-110,155-177`). Without it they return `"MissingConversionRates"` (X9).

### 5.6 URLs [V]
- **No-session mode** (no OAuth token): `buildUrl("https://www.pathofexile.com/trade2/search", realm="poe2", league) .. "?q=" .. urlEncode(queryJson)` (`TradeQuery.lua:1019-1023`). `buildUrl` (`TradeQueryRequests.lua:545-558`) inserts `/realm` unless the realm is `pc`, percent-encodes the league except `[%w-._~]`, then `gsub(" ","+")`.
- **Search-id link:** `buildUrl(…, queryId)` (`TradeQuery.lua:1076`).
- **Exact item** (`:1251-1265`): decode `lastQueries[row]`; set `stats[1].value = {min=floor(weight,1)−1, max=round(weight,1)+1}` (`weight` is the string from `"Sum: X"`); set `filters.trade_filters.filters.account = {input=trader}` (creating the tables if absent); then `"https://www.pathofexile.com/trade2/search/%s?q=%s"` with `pbLeague`. **There is no realm segment** (X6).
- **Whisper:** used instead of the exact URL when `whisper` is present and `priceType ~= "~b/o"` (`:1240-1249`).

### 5.7 Result evaluation [V]
- **`WeightedRatioOutputs(base, new, statWeights)`** (`TradeQueryGenerator.lua:159-194`): Σ over stats of `min(newSum/(baseSum or 1), maxStatIncrease=2) × weightMult`, using `GetFromOutput(..., skipTransform=true)` and then `transform(ratio)`. FullDPS falls back to TotalDPS+TotalDotDPS+CombinedDPS when FullDPS is absent. A stat whose base is `math.huge` contributes 0.
  - "No change" scores Σ weightMult; with the default weights that is 1.5.
- **`TradeQuery:ReduceOutput`** (`:780-791`) keeps only the weighted stats. **`GetResultEvaluation`** (`:794-836`) calls `calcFunc({repSlotName=<slot or "Jewel <nodeId>">, repItem=new("Item", item_string)})` and returns `{{output,weight}}`, cached per row.
- **`FilterToSafeItems`** (`:985-994`) keeps an entry if `new("Item").base` is set and `itemsTab:IsItemValidForSlot(item, slotName)` holds.
- **Rune/anoint post-processing** (`:1040-1068`): if augment **or** anoint is "Copy Current", call `itemsTab:CopyAnointsAndAugments(item,true,true,slot)`. Otherwise "Remove" strips the non-socket-bound runes (`GetValidRunesForItem`/`IsSocketBoundRune`, `UpdateRunes`), or an anoint "Remove" clears `enchantModLines`. Each path ends with `BuildRaw()`.
  - These ItemsTab methods are at `:1723,1965,1997,2275`.

### 5.8 Fetch parsing and search behaviour [V]
- **Parsed entry fields** (`TradeQueryRequests.lua:436-445`): `{amount, currency, priceType=listing.price.type, item_string, whisper, trader=listing.account.name, weight=(pseudoMods[1] "Sum: (.+)") or "0" (a string), id}`.
  - A listing without a `price` would raise on `listing.price.amount` [I].
- **Min-weight adjust loop** (`SearchWithQueryWeightAdjusted`, `:105-199`; vision keeps it in TS):
  - If `total < maxFetchPerSearch`, halve `stats[1].value.min`.
  - If the search is clipped at 10,000, set `min = (highestWeight + min)/2` from the first 10 results.
  - Stop when `total > maxFetch and total < 10000` or at maxRecursion 5. Fill short results from the previous search.
- **Fetches** run in blocks of 10: `api/trade2/fetch/<ids>?query=<id>` (`:247-268`).
- **`PerformSearch` error mapping** (`:219-236`): "Logging in will increase this limit" → "Authorization is invalid. Please Re-Log and reset". Otherwise `"[ code: message ]"`, or "No Matching Results Found".
- **Auth:** PoB sends `Authorization: Bearer <main.api.authToken>` (`:64-67`).

### 5.9 Headless hazards in the trade classes
- **Network calls.** `TradeQuery` ctor creates `main.api = new("PoEAPI", …)`, which builds a `TradeQueryRateLimiter` and does no I/O (`TradeQuery.lua:58-61`; `PoEAPI.lua:14-23`). `PullPoENinjaCurrencyConversion` **writes `../<league>_currency_values.json`** (`TradeQuery.lua:144-146`). Never call it, `PriceItem`, `PullLeagueList` or the `FetchLeagues` paths headless [V code]. `require("lcurl.safe")` returns nil in the generator (`TradeQueryGenerator.lua:8`), so `InitMods`' download branch would fail if `QueryMods.lua` were missing [I].
- **Category errors.** `options.jewelType` must be set for jewel slots (`:828`), and `options.account` crashes (`:1001-1003`) [V].
- **Stale engine inputs.** `StartQuery` uses `calcsTab:GetMiscCalculator()`, so call `BuildOutput` first if the build changed (§4.10) [V/I].
- **itemsTab rebinding.** `TradeQuery`'s ctor writes `itemsTab.leagueDropList = {}`, and generator/TradeQuery caches must rebind after each load because `itemsTab` is recreated (§1) [V].

## 6. Lua conventions in `pob-api/` and how a new `API/Trade.lua` would register

- **Module style:** `local M = {} … return M` (`BuildOps.lua:9,1180`). `Handlers.lua` returns `{handlers=…, version_meta=…}` (`:322-325`). Both are loaded with `require('API.X')`, resolved through `bootstrap.lua:33` [V].
  - Handlers wraps `require('API.BuildOps')` in `pcall`, with four dofile fallbacks (`Handlers.lua:10-54`).
  - Two-space indentation in `pob-api/`; PoB core uses tabs.
- **Error style:** BuildOps functions return `value|true` on success or **`nil, '<lowercase message>'`** on failure, with guards first (`if not build or not build.X then return nil, 'X not initialized' end`).
  - Handlers translate the result into `{ ok = false, error = err or '<default message>' }` / `{ ok = true, <key> = res }`.
  - Older handlers use domain keys (`stats`, `items`, `skills`, `tree`, `item`, `xml`, `info`, `output`, `config`, `socketGroup`, `gem`, `results`). Newer ones (from `list_gems` on) use **`result`**, as does S-1's proposal [V].
- **Naming:** actions and BuildOps functions are `snake_case`; param fields are `camelCase` (`groupIndex`, `gemName`, `slotName`, `noAutoEquip`, `addNodes`, `useFullDPS`). Constants are `UPPER_SNAKE` (`BuildOps.lua:12-14`) [V].
- **Globals used:** `build`, `data`, `new`, `main`, `launch`, `copyTable`, `common`, `calcLib`. The bridge has no state of its own besides module upvalues [V].
- **Registration of `Trade.lua`** [I; one line, in the existing style]. Before `return { handlers = handlers, … }` in `Handlers.lua`:
  ```lua
  for name, fn in pairs(require('API.Trade').handlers) do handlers[name] = fn end
  ```
  `Trade.lua` would `return { handlers = { trade_generate_query = function(params) … end, trade_evaluate_items = …, trade_query_options = … } }`. Each handler returns `{ ok = true, result = … }` / `{ ok = false, error = … }` and keeps its replies to numbers and strings (never raw PoB tables: E1/X13). The S-1 shim's `ffi.cdef` struct names must stay unique per process (`TradeShim.lua:6`).

## 7. Open unknowns
- **Exact-item URL realm.** Whether PoB's realm-less exact-item URL (X6) resolves on the PoE2 trade site. It wasn't fetched, per the trade API rule.
- **Flask toggling.** The runtime effect of `set_flask_active` on calcs (X12) wasn't measured.
- **Wedge cause.** The wedge needs `unsaved=true`. Every XML load sets `modFlag=true`, so one successful load is enough. Whether any *other* state reaches the `savers=nil` + `SaveDB` path (e.g. a failed `treeTab:Load` after `abortSave=true`) wasn't exhaustively tested; `abortSave=true` blocks the autosave.
- **Process exit.** The luajit exit code and stderr text on an encode crash or on EOF weren't re-measured. S-2 reports the crash text, and EOF → exit is inferred from the end of the script.
