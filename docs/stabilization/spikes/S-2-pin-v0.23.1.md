# Spike S-2 — pin PathOfBuilding-PoE2 to `v0.23.1`

Date 2026-10-03. Tag `v0.23.1` = commit `7d6f530` (also `master` tip). Dev head `bb52d6b` is
**108 commits ahead, 0 behind** (GitHub compare API). **[V]** = run/read here, **[I]** = inference.
Vision decision D-2 (pin PoB2 to a release tag, upgrade deliberately) is the subject.

## Verdict: **PASS**

Criterion: golden smoke (load/stats/save) passes on the tag; diff of touched internals recorded.

- Raw bridge: 56 actions (every handler in `Handlers.lua`) run against the tag. All succeed
  except `calc_with`, which crashes exactly as on dev (E1 below). [V]
- MCP level (`client.mjs`, `POB_FORK_PATH`=tag): load → stats → save → reload gives identical
  stats. `add_item` and `create_spec` work on the tag but fail on dev head. [V]
- The same suite on a 47 MB sparse subset of the tag gives the same results, apart from
  order-only differences in `pairs()`-ordered lists. [V]
- Internals diff: table below. Of 116 probed symbols, 13 functions changed body and the
  constructor style changed. **One change is breaking** (`new()`).

## Stats: stored XML vs tag vs dev head (Grenadator)

| Stat | Stored (user's app) | v0.23.1 | dev head |
|---|---|---|---|
| TotalDPS | 85,452.12 | **85,452.12** | 88,549.77 |
| CombinedDPS | 104,489.78 | **104,489.78** | 108,094.50 |
| FullDPS | 218,252.39 | **218,252.39** | 226,793.28 |
| Speed / Cooldown | 0.5 / 2 | **0.5 / 2** | 0.51 / 1.961 |
| Str / Dex / Int | 119 / 91 / 64 | 119 / 91 / 64 | 119 / 91 / 64 |
| Life | 2977 | 2977 | 2977 |
| ChaosResist | 55 | **55** | 57 |
| TotalEHP | 11,833.37 | **11,833.37** | 11,798.30 |
| SpiritUnreserved | 13 | **13** | 15 |

The tag reproduces 103/104 numeric stored stats exactly. The 104th, `MainHandAccuracy`, is not
in `mainOutput`, but the tag's saved XML writes 1178, which equals the stored value. All 109
`<PlayerStat>` elements in the tag's saved file are byte-equal to the stored ones. Dev head
matches 73/104. [V] **This confirms the "PoB version drift" inference in recon §3.** The user's
app computes as v0.23.x. Distinguishing 0.23.0 from 0.23.1 would need a 0.23.0 run, and the
0.23.1 changelog touches nothing in this build. [I]

## PoB internals the bridge touches (tag `file:line`; status vs dev head)

| Internal | Tag location | vs dev |
|---|---|---|
| `new(className, ...)` | Modules/Common.lua:115 | **CHANGED.** Tag forwards ctor args to `class._constructor`. Dev is `new(className, extraArg)`: it errors on any extra arg, and ctors become methods (`new("Item"):Item(raw)`). |
| `new('Item', raw)` (→ `Item:ParseRaw`), `new('PassiveSpec', build, ver)` | Classes/Item.lua:316 | ctor style as above; `ParseRaw` body changed |
| globals `build`, `newBuild`, `loadBuildFromXML`, `runCallback` | HeadlessWrapper.lua:204, :207, :214, :9 | Changed but compatible. Dev moves the stubs into `_SimpleGraphic.def.lua` (absent on tag) and renames `mainObject`→`__mainObject__`. |
| `mainObject` (bootstrap.lua fallback) | `local` at HeadlessWrapper.lua:8 | nil on **both**: the fallback is dead code, harmless because `build` is set |
| `ConPrintf` | HeadlessWrapper.lua:155 | same body (dev: `_SimpleGraphic.def.lua:521`) |
| `launch.versionNumber/Branch/Platform` | Launch.lua:51-53 | Same. **Both report `0.23.1`.** Branch/platform are nil → `devMode=true`. |
| `copyTable`, `wipeGlobalCache`, `latestTreeVersion`, `build:ResetModFlags` | Common.lua:421, :875; GameVersions.lua:12; Build.lua:1245 | same |
| `build:SaveDB` | Modules/Build.lua:2432 | Changed. Dev iterates savers with `pairsSortByKey`. The tag uses `pairs`, so **section/attribute order varies between processes** [V]. |
| `build.{buildFlag,characterLevel,…,mainSocketGroup,data}` | — | same. `buildClassName`/`buildAscendName` are nil on both. |
| `calcsTab:BuildOutput` | Classes/CalcsTab.lua:466 | Dev adds an optional `validateWeaponSets` arg; the bridge passes none. |
| `calcsTab:GetMiscCalculator`, `.mainOutput`, `.input.skill_number` | CalcsTab.lua:703 | cosmetic change (`unpack` → explicit returns) |
| `configTab:BuildModList`, `.input`, `.enemyLevel` | Classes/ConfigTab.lua:882 (`enemyLevel` from `input` at :873) | body changed. Both recompute `enemyLevel` from `input`. |
| `spec:ImportFromNodeList(className, classId, ascId, secAscId, hashList, weaponSets, hashOverrides, masteryEffects, treeVersion)` | PassiveSpec.lua:321 | **same** |
| `spec:CountAllocNodes`, `SelectClass`, `SelectAscendClass`, `SelectSecondaryAscendClass`, `BuildClusterJewelGraphs` | :992, :618, :655, :675, :2024 | same |
| `spec:CreateUndoState` / `RestoreUndoState` | :2511 / :2545 | dev adds `nodeNotes`; compatible |
| spec/tree/node fields (`allocNodes`, `masterySelections`, `nodes`, `tree.classes[].classes`, `curClassId`, `node.sd/modList/dn/orbit`, …) | — | same |
| `treeTab:SetActiveSpec`, `.specList`, `.activeSpec` | Classes/TreeTab.lua:536 | same |
| `skillsTab:ProcessSocketGroup` | Classes/SkillsTab.lua:1235 | body changed; smoke behaviour unchanged |
| `skillsTab.{socketGroupList,skillSets,activeSkillSetId}`, group/gem fields, `data.gems[]` fields | — | same |
| `itemsTab:AddItem`, `PopulateSlots`, `AddUndoState`, `slot:SetSelItemId` | ItemsTab.lua:1577, :1542; UndoHandler.lua:27; ItemSlotControl.lua:74 | same |
| `itemsTab:SetActiveItemSet` | ItemsTab.lua:1476 | body changed; smoke OK |
| `itemsTab.{slots,orderedSlots,items,itemSets,itemSetOrderList,activeItemSet(Id)}`, `slot.inactive` | — | same: 113 slots / 91 "Jewel" / 72 inactive on both |
| `Item:NormaliseQuality`, `GetPrimarySlot` | Item.lua:1367, :1803 | same |

Method: a probe script resolves each symbol inside a loaded build on both trees, then compares
function bodies after whitespace normalisation. The probe lives in the session scratchpad, so it
is ephemeral; worth committing as upgrade tooling. [V]

## Recon defects on the tag

| Defect (recon §2) | On v0.23.1 |
|---|---|
| E1: `calc_with` returns PoB's cyclic output; JSON encode kills luajit | **Reproduces** (`Server.lua:35: reference cycle`) [V] |
| E2: tree set/delta passes `{}` weaponSets/hashOverrides | **Reproduces**. A no-op delta gives Str/Dex/Int 119/91/64 → 89/46/49, Life 2977→2895, TotalDPS −5.5%. [V] |
| E3: `new()` with extra constructor args | **Does not reproduce.** The old syntax is *correct* on the tag. Dev-style `new("Item"):Item(raw)` **fails** on the tag ("attempt to call method 'Item'"). [V] |
| E4: one failed load wedges later loads | **Reproduces, same trigger on both trees.** After loading an empty string, every load is a 1 ms no-op stuck at `~~temp~~` level 1. A PoE1 root or malformed XML alone does *not* wedge (refines recon). [V] |
| E7: default stat export too narrow | Reproduces (bridge-side). The tag's `mainOutput` has TotalEHP etc. [V] |
| E8: hidden jewel slots exported | Reproduces ("89 jewel socket(s) empty") [V] |
| E5/E6/E9/E10 (TS protocol, error flag, robustness, tests) | PoB-independent [I] |
| §3: `enemyLevel` no-op, unknown gem accepted, treeVersion `0_1`, `create_spec` says "Failed" on success, `Nodes: undefined`, `(? bytes)` | All reproduce [V]. New: `lua_get_stats` prints `_meta: [object Object]`. |

## Pin mechanism

Measured on this box (git 2.43.0):

| Option | Download | On disk | Time |
|---|---|---|---|
| D-2 as proposed: submodule, `shallow = true` | **1.55 GiB pack** | 1.6 GB `.git/modules` + 435 MB tree | 1 m 49 s |
| Shallow full clone of tag | 309 MiB | 744 MB | — |
| GitHub source tarball | 371 MiB | ~435 MB | 24 s |
| Release `Portable.zip` | 365 MiB | Windows layout | not tested |
| **Sparse + blob-less + depth-1 clone of tag** | **4.9 MiB** | **47 MB + 5.4 MB .git** | **2–5 s** |

Why the submodule balloons [V]: `git submodule update --init` clones depth 1 of the remote
HEAD (`dev`). The pinned SHA is not in that clone, so git falls back to
`git fetch origin <sha>` **without `--depth`** (seen in `GIT_TRACE`), which downloads the full
history. Submodules also can't declare sparse checkout or blob filters. Every option except the
last ships 336 MB of tree images and Windows DLLs that headless runs never read.

The runtime subset needs `manifest.xml`, `runtime/lua/`, and `src/` minus `src/Export/` and
`*.png|*.zst|*.jpg`. The TS side only reads `src/TreeData/<ver>/tree.json`, which the subset
keeps. [V]

**Recommendation:** a committed pin file, a fetch script, and a gitignored `vendor/`. This is
reproducible from git (pin and script are committed) and nothing is hand-tweaked.

`pob-pin.json` (repo root, the single source of truth):
```json
{ "repo": "https://github.com/PathOfBuildingCommunity/PathOfBuilding-PoE2.git",
  "tag": "v0.23.1", "commit": "7d6f530cbdab20389ff8bc6ba97a37ac27f74e41", "version": "0.23.1" }
```
`scripts/fetch-pob.sh` (tested verbatim from a foreign cwd: 4.8 s fresh, 56 ms idempotent re-run) [V]:
```bash
#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
pin() { node -p "require('./pob-pin.json').$1"; }
URL=$(pin repo); TAG=$(pin tag); COMMIT=$(pin commit); DEST=vendor/PathOfBuilding-PoE2
if [ "$(git -C "$DEST" rev-parse HEAD 2>/dev/null)" = "$COMMIT" ]; then exit 0; fi
rm -rf "$DEST"
GIT_TERMINAL_PROMPT=0 git clone --quiet --filter=blob:none --no-checkout --depth 1 --branch "$TAG" "$URL" "$DEST"
git -C "$DEST" sparse-checkout set --no-cone /manifest.xml /runtime/lua/ /src/ '!/src/Export/' '!*.png' '!*.zst' '!*.jpg'
GIT_TERMINAL_PROMPT=0 git -C "$DEST" checkout --quiet "$COMMIT"   # fails loudly if the tag was moved
test "$(git -C "$DEST" rev-parse HEAD)" = "$COMMIT"
```
`mise.toml`: `[tasks."pob:fetch"]` with `run = "bash scripts/fetch-pob.sh"`. `.gitignore`: `/vendor/`.
Default `POB_FORK_PATH` = `<package root>/vendor/PathOfBuilding-PoE2/src`, resolved from
`import.meta.url`, not from cwd, because MCP hosts launch from arbitrary directories.

### Version check (the pin-enforcement invariant I-7: refuse an unpinned PoB)

The manifest number alone is **insufficient**. Dev head, 108 commits later, still says
`0.23.1`. [V] The check:
1. **Before spawning luajit (TS):** `manifest.xml` `<Version number>` must equal `pin.version`.
   Then an **integrity check:** for the ~11 bridge-touched files (Common, Build, Main, Launch,
   PassiveSpec, ItemsTab, SkillsTab, CalcsTab, ConfigTab, TreeTab, Item), the sha1 of the
   CRLF-normalised content must equal that file's `<File … sha1>` entry in `manifest.xml`. This
   is PoB's own hashing (`update_manifest.py:107`). Results: the tag matches 1083/1083 program
   entries; the sparse subset matches 981 with 102 absent (excluded images, so skip absent
   files); **dev head has 192 mismatches, including all 11 bridge files**. [V]
   `HeadlessWrapper.lua` is not in the manifest, so pin its sha1 in `pob-pin.json`
   (`784d675…` on the tag).
2. **Informational:** if `<pob>/.git/HEAD` exists and does not equal `pin.commit`, log a warning
   (on a detached checkout the file holds the bare SHA).
3. **After spawn:** the ready banner already carries `version.number` (`launch.versionNumber`).
   Assert it equals `pin.version`.
4. On mismatch, refuse to start with expected vs actual and the hint `mise run pob:fetch`.
   `POB_ALLOW_UNPINNED=true` downgrades the refusal to a stderr warning.

**Upgrade procedure:** bump `pob-pin.json` → `mise run pob:fetch` → re-run the internals probe
and the golden tests (I-1: the fixture's stats equal recorded values) → update the recorded
values.

## Risks

- **E3 fixes must target the tag, not dev.** The `new()` rewrite that recon calls the fix
  breaks v0.23.1. Use a version-portable helper instead. Both trees passed this check for Item and
  PassiveSpec [V]:
  `local NEW_STYLE = not debug.getinfo(new,'u').isvararg; local function construct(c, ...) if NEW_STYLE then local o = new(c); return o[c](o, ...) end; return new(c, ...) end`
- **Golden save tests:** compare stats or normalised XML, not bytes. The tag's `SaveDB` order is
  nondeterministic. [V]
- **The next upgrade crosses the class-system rewrite.** The `new()` style changes,
  `HeadlessWrapper` is restructured, and dev adds Ward stats, so the golden values will move. [V]
- **The sparse pattern could miss a future runtime file.** The integrity check and golden smoke
  will catch that. [I]
- **`devMode=true` on any git-based install,** because the manifest has no branch/platform. Its
  autosave paths stay active (E4). A release zip would flip `devMode` (untested). [I]
- The partial clone is a promisor repo (`remote.origin.promisor=true` [V]), so later history or
  diff commands inside it fetch lazily over the network. Runtime never needs that. [I]
