import type { BuildService } from "../services/buildService.js";
import type { TreeService } from "../services/treeService.js";
import type { TreeAnalysisResult, TreeComparison, PassiveTreeNode, AllocationChange, PassiveTreeData } from "../types.js";
import { EngineActionError, type PoBLuaApiClient } from "../pobLuaBridge.js";
import type { NodePowerParams, NodePowerResult, PowerPool, PowerSwap } from "../engine/schemas.js";
import { wrapHandler } from "../utils/errorHandling.js";
import type { LoadedBuild } from "../engine/session.js";
import type { PobSourceScan } from "../engine/pobSourceNames.js";
import { summonsMinion } from "../plan/record.js";
import { formatLoadedBuild } from "./luaHandlers.js";
import { activeSpecTreeState } from "./treeStateHandlers.js";

export interface TreeHandlerContext {
  buildService: BuildService;
  treeService: TreeService;
  getLuaClient?: () => PoBLuaApiClient | null;
  /** The build the engine holds (C-3 `loaded`): named when the tree came from the engine. */
  loadedBuild?: () => LoadedBuild | null;
}

/** The `Build:` line: the file read, or the engine's build when the tree came from the engine. */
function buildLine(context: TreeHandlerContext, fileBuildName: string | null): string {
  if (fileBuildName) return `Build: ${fileBuildName}`;
  return formatLoadedBuild(context.loadedBuild?.() ?? null);
}

export interface PassiveUpgradesContext {
  getLuaClient: () => PoBLuaApiClient | null;
  ensureLuaClient: () => Promise<void>;
  /** The server's scan of PoB's source (D-226, D-243), for C-38's line statuses (C-47). */
  sourceScan: () => Promise<PobSourceScan>;
}

export async function handleCompareTrees(
  context: TreeHandlerContext,
  build1Name: string,
  build2Name: string
) {
  try {
    const build1 = await context.buildService.readBuild(build1Name);
    const build2 = await context.buildService.readBuild(build2Name);

    const analysis1 = await context.treeService.analyzePassiveTree(build1);
    const analysis2 = await context.treeService.analyzePassiveTree(build2);

    if (!analysis1 || !analysis2) {
      throw new Error('One or both builds lack passive tree data');
    }

    // Calculate differences
    const nodes1Ids = new Set(analysis1.allocatedNodes.map(n => String(n.skill)));
    const nodes2Ids = new Set(analysis2.allocatedNodes.map(n => String(n.skill)));

    const uniqueToBuild1 = analysis1.allocatedNodes.filter(n => !nodes2Ids.has(String(n.skill)));
    const uniqueToBuild2 = analysis2.allocatedNodes.filter(n => !nodes1Ids.has(String(n.skill)));
    const sharedNodes = analysis1.allocatedNodes.filter(n => nodes2Ids.has(String(n.skill)));

    const pointDifference = analysis1.totalPoints - analysis2.totalPoints;

    let archetypeDifference = '';
    if (analysis1.archetype !== analysis2.archetype) {
      archetypeDifference = `Build 1: ${analysis1.archetype} vs Build 2: ${analysis2.archetype}`;
    } else {
      archetypeDifference = `Both builds: ${analysis1.archetype}`;
    }

    const comparison: TreeComparison = {
      build1: { name: build1Name, analysis: analysis1 },
      build2: { name: build2Name, analysis: analysis2 },
      differences: {
        uniqueToBuild1,
        uniqueToBuild2,
        sharedNodes,
        pointDifference,
        archetypeDifference
      }
    };

    const output = formatTreeComparison(comparison);

    return {
      content: [
        {
          type: "text" as const,
          text: output,
        },
      ],
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to compare trees: ${errorMsg}`);
  }
}


export async function handleGetNearbyNodes(
  context: TreeHandlerContext,
  buildName: string | undefined,
  maxDistance?: number,
  filter?: string
) {
  try {
    let allocatedNodeIds: string[] = [];
    let treeVersion = 'Unknown';
    let fileBuildName: string | null = null;

    // Try file-based path first
    if (buildName) {
      try {
        const build = await context.buildService.readBuild(buildName);
        allocatedNodeIds = context.buildService.parseAllocatedNodes(build);
        treeVersion = context.buildService.extractBuildVersion(build);
        if (allocatedNodeIds.length > 0) fileBuildName = buildName;
      } catch {
        // Fall through to Lua fallback
      }
    }

    // Lua bridge fallback when no file or file read failed
    if (allocatedNodeIds.length === 0 && context.getLuaClient) {
      const luaClient = context.getLuaClient();
      if (luaClient) {
        const treeResult = await luaClient.getTree();
        allocatedNodeIds = (treeResult.nodes || []).map(String);
        treeVersion = treeResult.treeVersion || 'Unknown';
      }
    }

    if (allocatedNodeIds.length === 0) {
      return {
        content: [{
          type: "text" as const,
          text: "No allocated nodes found. Provide a build_name or load a build with lua_load_build first.",
        }],
      };
    }

    const allocatedNodes = new Set<string>(allocatedNodeIds);
    const treeData = await context.treeService.getTreeData(treeVersion);

    // A tree none of whose nodes exist in the tree data is invalid: searching from it would
    // silently report "nothing nearby".
    if (!allocatedNodeIds.some((id) => treeData.nodes.has(id))) {
      const shown = allocatedNodeIds.slice(0, 5).join(', ');
      const more = allocatedNodeIds.length > 5 ? `, ... (${allocatedNodeIds.length} in total)` : '';
      throw new Error(
        `none of the build's allocated nodes exist in the passive tree data (version ${treeData.version}): invalid node(s) ${shown}${more}`
      );
    }

    const distance = maxDistance || 3;

    // Find nearby nodes using TreeService
    const nearbyNodes = context.treeService.findNearbyNodes(
      allocatedNodes,
      treeData,
      distance,
      filter
    );

    if (nearbyNodes.length === 0) {
      return {
        content: [
          {
            type: "text" as const,
            text: `No notable or keystone nodes found within ${distance} nodes of your current tree.\n\nTry increasing max_distance or removing the filter.`,
          },
        ],
      };
    }

    const textLines: string[] = [
      `=== Nearby Nodes (within ${distance} nodes) ===`,
      '',
      buildLine(context, fileBuildName),
      `Found ${nearbyNodes.length} nodes`,
      '',
    ];

    // Group by distance
    const byDistance = new Map<number, typeof nearbyNodes>();
    for (const node of nearbyNodes) {
      const existing = byDistance.get(node.distance) || [];
      existing.push(node);
      byDistance.set(node.distance, existing);
    }

    for (const [dist, nodes] of Array.from(byDistance.entries()).sort((a, b) => a[0] - b[0])) {
      textLines.push(`**Distance ${dist}** (${nodes.length} nodes):`);
      for (const { node, nodeId } of nodes.slice(0, 10)) {
        let line = `- ${node.name || 'Unnamed'} [${nodeId}]`;
        if (node.isKeystone) line += ' (KEYSTONE)';
        textLines.push(line);
        if (node.stats && node.stats.length > 0) {
          textLines.push(`  ${node.stats.slice(0, 2).join('; ')}`);
        }
      }
      if (nodes.length > 10) {
        textLines.push(`  ... and ${nodes.length - 10} more`);
      }
      textLines.push('');
    }

    return {
      content: [
        {
          type: "text" as const,
          text: textLines.join('\n'),
        },
      ],
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to find nearby nodes: ${errorMsg}`);
  }
}

/** A parsed spec's weapon-set nodes (`<WeaponSet1 nodes>` and `<WeaponSet2 nodes>`, as PoB's `PassiveSpec:Save` writes them). */
function specWeaponSetNodes(spec: Record<string, unknown>): string[] {
  const out: string[] = [];
  for (const key of ["WeaponSet1", "WeaponSet2"]) {
    const raw = spec[key];
    for (const el of Array.isArray(raw) ? raw : raw ? [raw] : []) {
      const nodes = el && typeof el === "object" ? (el as Record<string, unknown>).nodes : undefined;
      if (typeof nodes === "string" || typeof nodes === "number") {
        for (const id of String(nodes).split(",")) if (id.trim().length > 0) out.push(id.trim());
      }
    }
  }
  return out;
}

export async function handleFindPath(
  context: TreeHandlerContext,
  buildName: string | undefined,
  targetNodeId: string,
  showAlternatives?: boolean
) {
  try {
    let allocatedNodeIds: string[] = [];
    // D-460 (B8): the allocated nodes tagged to a weapon set, which a path to an untagged node never runs through.
    let weaponSetNodeIds: string[] = [];
    let treeVersion = 'Unknown';
    let fileBuildName: string | null = null;

    // Try file-based path first
    if (buildName) {
      try {
        const build = await context.buildService.readBuild(buildName);
        const spec = context.buildService.getActiveSpec(build);
        if (!spec) {
          throw new Error("Build has no passive tree data");
        }
        allocatedNodeIds = context.buildService.parseAllocatedNodes(build);
        weaponSetNodeIds = specWeaponSetNodes(spec);
        treeVersion = context.buildService.extractBuildVersion(build);
        if (allocatedNodeIds.length > 0) fileBuildName = buildName;
      } catch (fileErr) {
        // Fall through to Lua fallback
        if (buildName) throw fileErr; // Re-throw if explicitly requested
      }
    }

    // Lua bridge fallback when no file or file read failed
    if (allocatedNodeIds.length === 0 && context.getLuaClient) {
      const luaClient = context.getLuaClient();
      if (luaClient) {
        const treeResult = await luaClient.getTree();
        allocatedNodeIds = (treeResult.nodes || []).map(String);
        treeVersion = treeResult.treeVersion || 'Unknown';
        if (allocatedNodeIds.length > 0) {
          const tags = activeSpecTreeState(await luaClient.exportBuildXml()).weaponSets;
          weaponSetNodeIds = [...tags["1"], ...tags["2"]].map(String);
        }
      }
    }

    if (allocatedNodeIds.length === 0) {
      return {
        content: [{
          type: "text" as const,
          text: "No allocated nodes found. Provide a build_name or load a build with lua_load_build first.",
        }],
      };
    }

    const allocatedNodes = new Set<string>(allocatedNodeIds);
    const treeData = await context.treeService.getTreeData(treeVersion);

    // Check if target node exists
    const targetNode = treeData.nodes.get(targetNodeId);
    if (!targetNode) {
      throw new Error(`Node ${targetNodeId} not found in tree data`);
    }

    // Check if target is already allocated
    if (allocatedNodes.has(targetNodeId)) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Node ${targetNodeId} (${targetNode.name || "Unknown"}) is already allocated in this build.`,
          },
        ],
      };
    }

    // Find shortest path(s) using TreeService
    const paths = context.treeService.findShortestPaths(
      allocatedNodes,
      targetNodeId,
      treeData,
      showAlternatives ? 3 : 1,
      new Set(weaponSetNodeIds),
    );

    if (paths.length === 0) {
      return {
        content: [
          {
            type: "text" as const,
            text: `No path found to node ${targetNodeId} (${targetNode.name || "Unknown"}).\n\nThis node may be unreachable from your current tree (e.g., different class starting area or ascendancy nodes).`,
          },
        ],
      };
    }

    // Format output
    const textLines: string[] = [
      `=== Path to ${targetNode.name || "Node " + targetNodeId} ===`,
      '',
      buildLine(context, fileBuildName),
      `Target: ${targetNode.name || "Unknown"} [${targetNodeId}]`,
    ];
    if (targetNode.isKeystone) textLines.push('Type: KEYSTONE');
    else if (targetNode.isNotable) textLines.push('Type: Notable');
    textLines.push('');

    for (let i = 0; i < paths.length; i++) {
      const path = paths[i];
      const pathLabel = paths.length > 1 ? `Path ${i + 1} (Alternative ${i === 0 ? "- Shortest" : i})` : "Shortest Path";

      textLines.push(`**${pathLabel}**`);
      textLines.push(`Total Cost: ${path.cost} passive points`);
      textLines.push(`Nodes to Allocate: ${path.nodes.length}`, '');

      textLines.push('Allocation Order:');
      for (let j = 0; j < path.nodes.length; j++) {
        const nodeId = path.nodes[j];
        const node = treeData.nodes.get(nodeId);
        if (!node) continue;

        const isTarget = nodeId === targetNodeId;
        const prefix = isTarget ? "→ TARGET: " : `  ${j + 1}. `;

        textLines.push(`${prefix}${node.name || "Travel Node"} [${nodeId}]`);

        if (node.stats && node.stats.length > 0) {
          for (const stat of node.stats) {
            textLines.push(`      ${stat}`);
          }
        } else if (!isTarget) {
          textLines.push('      (Travel node - no stats)');
        }

        if (j < path.nodes.length - 1) textLines.push('');
      }

      if (i < paths.length - 1) textLines.push('', '='.repeat(50), '');
    }

    textLines.push('', '**Next Steps:**');
    textLines.push('Use lua_set_tree to allocate these nodes and recalculate stats.');

    return {
      content: [
        {
          type: "text" as const,
          text: textLines.join('\n'),
        },
      ],
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to find path: ${errorMsg}`);
  }
}


/** The calculator outputs `get_passive_upgrades` measures (each path's fields, and `calc_with`'s for the ascendancy). */
const UPGRADE_FIELDS = ['CombinedDPS', 'TotalDPS', 'MinionTotalDPS', 'TotalEHP', 'Life'];
const DPS_FIELDS = ['CombinedDPS', 'TotalDPS'];
/** D-388: a summon main skill's DPS field, its minion's, as the compile record reads it (D-378, D-385). */
const MINION_DPS_FIELDS = ['MinionTotalDPS'];
const EHP_FIELDS = ['TotalEHP', 'Life'];
/**
 * D-417: the main-tree candidates are node power's pass at this distance (`node_power {upgrades}`): every
 * unallocated main-tree node within 6 points of the tree, small passives and keystones included.
 */
const UPGRADE_DISTANCE = 6;
/** The ascendancy points a character can spend (C-48's cap). */
const ASCENDANCY_POINTS = 8;

/** One measured candidate: PoB's path to the notable, and the stat changes of allocating all of it. */
export interface PassiveUpgrade {
  id: number;
  name: string;
  stats: string[];
  /** PoB's point cost (`node.pathDist`): the notable plus the travel nodes leading to it. */
  pathCost: number;
  dpsDelta: number;
  ehpDelta: number;
  /** Relative gain of the requested stat(s), per passive point. */
  score: number;
}

/** A candidate node: PoB's own path to it (`node.path`) and its point cost (`node.pathDist`). */
interface UpgradeCandidate {
  id: number;
  name: string;
  stats: string[];
  path: number[];
  pathCost: number;
  /** An ascendancy notable (`include_ascendancy`): its cost is in ascendancy points. */
  ascendancy: boolean;
}

/** The build's own ascendancy, for `include_ascendancy` (C-47, D-197, D-227). */
interface AscendancyPool {
  name: string;
  /** Allocated ascendancy nodes, the start node and multiple-choice options excluded (C-48's count, as PoB counts them). */
  used: number;
  /** The points left: 8 minus `used`. */
  remaining: number;
  candidates: UpgradeCandidate[];
  /** The ascendancy's unallocated multiple-choice options (`search_nodes` types them `mastery`), with PoB's path to each. */
  options: Array<{ id: number; name: string; path: number[] }>;
}

/** C-1: the server cuts this tool's text at 5000 characters, so the handler keeps within it (D-246). */
const OUTPUT_LIMIT = 5000;

/** The player's DPS, or with `minion` the main skill's minion's `MinionTotalDPS` (D-388). */
const dpsOf = (out: Record<string, unknown>, minion = false): number =>
  minion ? Number(out.MinionTotalDPS ?? 0) : Number(out.CombinedDPS ?? 0) || Number(out.TotalDPS ?? 0);
const ehpOf = (out: Record<string, unknown>): number => Number(out.TotalEHP ?? 0) || Number(out.Life ?? 0);
const hasValue = (out: Record<string, unknown>, fields: string[]): boolean =>
  fields.some((f) => typeof out[f] === 'number');

/** Gain per point first, then the cheaper path, then name. */
const byScore = (a: PassiveUpgrade, b: PassiveUpgrade): number =>
  b.score - a.score || a.pathCost - b.pathCost || a.name.localeCompare(b.name);

/** A reachable, unallocated node with PoB's own path to it. */
function reachable(n: { allocated: boolean; path?: number[]; pathDist?: number }): boolean {
  return !n.allocated && Array.isArray(n.path) && n.path.length > 0 && Number.isInteger(n.pathDist) && n.pathDist! >= 1;
}

/**
 * The build's own ascendancy notables for `include_ascendancy`: every unallocated notable of the active
 * spec's ascendancy that PoB can path to, and the ascendancy points left. Points used count the allocated
 * nodes of that ascendancy except its start node (which PoB allocates with the ascendancy; it bears the
 * ascendancy's own name and no stats) and the options of a multiple-choice notable (`search_nodes` types
 * them `mastery`), which PoB's own count skips too (`PassiveSpec:CountAllocNodes`). Null when the build
 * has no ascendancy.
 */
async function ascendancyPool(luaClient: PoBLuaApiClient): Promise<AscendancyPool | null> {
  const tree = await luaClient.getTree();
  const name = typeof tree.ascendClassName === 'string' ? tree.ascendClassName : '';
  if (!Number(tree.ascendClassId) || !name) return null;
  const { nodes } = await luaClient.searchNodes({ ascendancy: name, maxResults: 1000, includeAllocated: true });
  const own = nodes.filter((n) => n.ascendancyName === name);
  const isStart = (n: { name: string; stats: string[] }) => n.name === name && n.stats.length === 0;
  const used = own.filter((n) => n.allocated && !isStart(n) && n.type !== 'mastery').length;
  const candidates = own
    .filter((n) => n.type === 'notable' && reachable(n))
    .sort((a, b) => a.pathDist! - b.pathDist! || a.name.localeCompare(b.name) || a.id - b.id)
    .map((n) => ({ id: n.id, name: n.name, stats: n.stats, path: n.path!, pathCost: n.pathDist!, ascendancy: true }));
  const options = own
    .filter((n) => n.type === 'mastery' && !n.allocated && Array.isArray(n.path))
    .sort((a, b) => a.name.localeCompare(b.name) || a.id - b.id)
    .map((n) => ({ id: n.id, name: n.name, path: n.path! }));
  return { name, used, remaining: Math.max(0, ASCENDANCY_POINTS - used), candidates, options };
}

/**
 * D-227: an ascendancy notable whose `pathDist` exceeds the build's remaining ascendancy points is marked,
 * never hidden. The mark ends the entry's line that names the notable.
 */
function overBudgetMark(c: { ascendancy: boolean; pathCost: number }, asc: AscendancyPool | null): string {
  if (!c.ascendancy || !asc || c.pathCost <= asc.remaining) return '';
  return ` (over budget: needs ${c.pathCost}, ${asc.remaining} left)`;
}

/** One ranked entry: name and id, path cost and score, the stat changes, the first two stat lines (unless left out, D-246). */
function renderUpgrade(lines: string[], u: PassiveUpgrade, rank: number, unit: string, mark: string, stats = true): void {
  lines.push(`${rank}. **${u.name}** [${u.id}]${mark}`);
  lines.push(`   Path cost: ${u.pathCost} ${unit}${u.pathCost === 1 ? '' : 's'}  |  Score per point: ${u.score.toFixed(4)}`);
  const deltas: string[] = [];
  if (u.dpsDelta !== 0) deltas.push(`DPS Δ: ${u.dpsDelta > 0 ? '+' : ''}${Math.round(u.dpsDelta).toLocaleString()}`);
  if (u.ehpDelta !== 0) deltas.push(`EHP Δ: ${u.ehpDelta > 0 ? '+' : ''}${Math.round(u.ehpDelta).toLocaleString()}`);
  if (deltas.length) lines.push(`   ${deltas.join('  |  ')}`);
  if (stats) {
    for (const stat of u.stats.slice(0, 2)) {
      lines.push(`   - ${stat}`);
    }
  }
  lines.push('');
}

export async function handleGetPassiveUpgrades(
  context: PassiveUpgradesContext,
  focus: 'dps' | 'defence' | 'both' = 'both',
  maxResults: number = 10,
  includeAscendancy: boolean = false,
) {
  await context.ensureLuaClient();
  const luaClient = context.getLuaClient();
  if (!luaClient) throw new Error('Lua bridge not active. Use lua_start and lua_load_build first.');

  // Steps 1-3 (D-417): the main-tree candidates and their measurements come from node power's pass at depth 6, one
  // engine request: every unallocated main-tree node within 6 points of the tree that PoB measures (a Normal, Notable
  // or Keystone node with modifiers, not granted by an item), each with PoB's own path (`node.path`) and point cost
  // (`node.pathDist`), measured by PoB's misc calculator with its whole path allocated, as PoB's tree tooltip does
  // ("Allocating this node and all nodes leading to it"). Ascendancy nodes cost ascendancy points, so they are never
  // among them; only include_ascendancy measures them, in their own section (C-47, D-197).
  const pass = await luaClient.nodePowerUpgrades({ upgrades: { fields: UPGRADE_FIELDS }, maxDistance: UPGRADE_DISTANCE });
  // The base: PoB's calculator with nothing added. D-388: when the main skill summons a minion (PoB gives its
  // minion's output, so the base holds MinionTotalDPS, a number), its damage is the minion's: the player's
  // CombinedDPS and TotalDPS are 0, so DPS is MinionTotalDPS. The compile record decides a group's figure by the
  // same test (`summonsMinion`, D-397).
  const base: Record<string, unknown> = pass.base;
  const minion = summonsMinion(base);
  const passById = new Map(pass.candidates.map((c) => [c.id, c]));
  const candidates: UpgradeCandidate[] = pass.candidates
    .filter((n) => reachable({ allocated: false, path: n.path, pathDist: n.distance }))
    .sort((a, b) => a.distance - b.distance || a.name.localeCompare(b.name) || a.id - b.id)
    .map((n) => ({ id: n.id, name: n.name, stats: n.stats, path: n.path, pathCost: n.distance, ascendancy: false }));

  const asc = includeAscendancy ? await ascendancyPool(luaClient) : null;
  const ascCandidates = asc?.candidates ?? [];

  if (candidates.length === 0 && !includeAscendancy) {
    return {
      content: [{
        type: 'text' as const,
        text: `=== Passive Upgrades (focus: ${focus}) ===\n\nNo reachable unallocated passive within ${UPGRADE_DISTANCE} points of the tree. Make sure a build is loaded.\n`,
      }],
    };
  }

  // Step 4: each candidate's measurement. A main-tree candidate's is its path's output from the pass; an ascendancy
  // notable is measured with PoB's calculator (calc_with) along its whole path. A candidate whose measurement
  // returns no value for the requested stat(s), or fails in the engine, isn't ranked: it goes to the can't-measure
  // section (C-47).
  const baseDPS = dpsOf(base, minion);
  const baseEHP = ehpOf(base);
  const rel = (delta: number, of: number) => (of > 0 ? delta / of : 0);
  const unmeasured = new Map<number, string>();

  const score = (c: UpgradeCandidate, out: Record<string, unknown>): PassiveUpgrade | null => {
    const missing: string[] = [];
    if (focus !== 'defence' && !hasValue(out, minion ? MINION_DPS_FIELDS : DPS_FIELDS)) missing.push('DPS');
    if (focus !== 'dps' && !hasValue(out, EHP_FIELDS)) missing.push('EHP');
    if (missing.length > 0) {
      unmeasured.set(c.id, `PoB's calculator returned no ${missing.join(' or ')} value`);
      return null;
    }
    const dpsDelta = dpsOf(out, minion) - baseDPS;
    const ehpDelta = ehpOf(out) - baseEHP;
    const gain =
      focus === 'dps' ? rel(dpsDelta, baseDPS)
        : focus === 'defence' ? rel(ehpDelta, baseEHP)
          : rel(dpsDelta, baseDPS) + rel(ehpDelta, baseEHP);
    return { id: c.id, name: c.name, stats: c.stats, pathCost: c.pathCost, dpsDelta, ehpDelta, score: gain / c.pathCost };
  };

  const measure = async (c: UpgradeCandidate): Promise<PassiveUpgrade | null> => {
    if (!c.ascendancy) {
      const measured = passById.get(c.id);
      if (measured?.error !== undefined) {
        unmeasured.set(c.id, `PoB's calculator failed: ${measured.error}`);
        return null;
      }
      return score(c, measured?.fields ?? {});
    }
    let out: Record<string, unknown>;
    try {
      out = await luaClient.calcWith({ addNodes: c.path, fields: UPGRADE_FIELDS });
    } catch (error) {
      // The engine refused this one calculation; a stopped or stuck engine still fails the call.
      if (!(error instanceof EngineActionError)) throw error;
      unmeasured.set(c.id, `PoB's calculator failed: ${error.message}`);
      return null;
    }
    return score(c, out);
  };

  const scored: PassiveUpgrade[] = [];
  for (const c of candidates) {
    const u = await measure(c);
    if (u) scored.push(u);
  }
  const ascScored: PassiveUpgrade[] = [];
  for (const c of ascCandidates) {
    const u = await measure(c);
    if (u) ascScored.push(u);
  }

  // Step 5: the candidates that improve the requested stat(s), best gain per point first
  const improving = scored.filter((u) => u.score > 0).sort(byScore);
  const top = improving.slice(0, maxResults);

  // Step 6 (C-47): every measured candidate's lines, as check_model_coverage rates them (C-38). Lines PoB
  // applies nothing from (unparsed, partly parsed, parsed to nothing) and possibly unread lines, which are
  // advisory (D-243: PoB parses them, but may never read a mod they make), are kept apart.
  const pool = [...candidates, ...ascCandidates];
  const notApplied = new Map<number, string[]>();
  const advisory = new Map<number, string[]>();
  if (pool.length > 0) {
    const scan = await context.sourceScan();
    const coverage = await luaClient.checkCoverage({
      nodes: pool.map((c) => c.id),
      sourceNames: [...scan.names],
      sourceTemplates: scan.templates,
    });
    for (const entry of coverage.entries) {
      if (entry.kind !== 'node' || entry.nodeId === undefined || entry.status === 'fully parsed') continue;
      const into = entry.status === 'possibly unread' ? advisory : notApplied;
      const list = into.get(entry.nodeId) ?? [];
      list.push(`[${entry.status}] ${[entry.line, ...(entry.joinedWith ?? [])].join(' ')}`);
      into.set(entry.nodeId, list);
    }
  }

  // D-247: a multiple-choice ascendancy notable has no stat lines of its own; its effect is the option
  // chosen, so PoB measures it as nothing. Its options are the option nodes whose path runs through it.
  const choices = new Map<number, string[]>();
  for (const c of ascCandidates) {
    if (c.stats.length > 0) continue;
    choices.set(c.id, (asc?.options ?? []).filter((o) => o.path.includes(c.id)).map((o) => `${o.name} [${o.id}]`));
  }

  // The can't-measure entries, one line each, every reason labelled with its kind (explained once, below).
  // D-417 (the coordinator's clarification): the pool is every node within 6 points, so the section lists the
  // lines of the entries the output lists (the ranked main-tree entries shown, and the ascendancy section's
  // notables), then one line counting the rest of the measured pool PoB can't fully measure, as get_node_power
  // lists them among the nodes it lists (§11).
  const KINDS = {
    'not applied': 'PoB applies nothing from the line (unparsed, partly parsed, parsed to nothing)',
    advisory: 'PoB parses a possibly unread line but may never read a mod it makes; the measured change may already include it',
    choice: 'a multiple-choice notable, measured with no option chosen',
    'no value': "PoB's calculator returned nothing for it",
  } as const;
  const cantMeasure = new Map<number, { line: string; kinds: Array<keyof typeof KINDS> }>();
  for (const c of pool) {
    const reasons: string[] = [];
    const kinds: Array<keyof typeof KINDS> = [];
    const reason = (kind: keyof typeof KINDS, text: string) => {
      kinds.push(kind);
      reasons.push(`${kind}: ${text}`);
    };
    const lost = notApplied.get(c.id);
    if (lost) reason('not applied', lost.join('; '));
    const unsure = advisory.get(c.id);
    if (unsure) reason('advisory', unsure.join('; '));
    const options = choices.get(c.id);
    if (options) {
      reason('choice', `its effect is the option chosen; options: ${options.length > 0 ? options.join(', ') : 'none reachable'}`);
    }
    const failure = unmeasured.get(c.id);
    if (failure) reason('no value', failure);
    if (reasons.length === 0) continue;
    const cost = c.ascendancy ? `, ${c.pathCost} ascendancy point${c.pathCost === 1 ? '' : 's'}` : '';
    cantMeasure.set(c.id, { line: `- **${c.name}** [${c.id}]${cost}: ${reasons.join(' | ')}${overBudgetMark(c, asc)}`, kinds });
  }
  const mainIssues = candidates.filter((c) => cantMeasure.has(c.id));

  const measured = focus === 'dps' ? 'DPS' : focus === 'defence' ? 'EHP' : 'DPS + EHP';
  const ascImproving = ascScored.filter((u) => u.score > 0).sort(byScore);
  const ascTop = ascImproving.slice(0, maxResults);
  const ascById = new Map(ascCandidates.map((c) => [c.id, c]));

  /** The whole text, with `mainShown` and `ascShown` ranked entries, their stat lines or not, and a note. */
  const render = (plan: { stats: boolean; mainShown: number; ascShown: number; tip: boolean }, note: string | null): string => {
    const textLines: string[] = [`=== Passive Upgrades (focus: ${focus}) ===`, ''];
    if (note) textLines.push(note, '');
    if (candidates.length === 0) {
      textLines.push(`No reachable unallocated passive within ${UPGRADE_DISTANCE} points of the tree. Make sure a build is loaded.`, '');
    } else {
      textLines.push(
        `Base DPS: ${Math.round(baseDPS).toLocaleString()} (${minion ? "MinionTotalDPS: the main skill's minion deals its damage" : 'CombinedDPS, else TotalDPS'})  |  Base EHP: ${Math.round(baseEHP).toLocaleString()}`,
        `Measured ${candidates.length} nearby passives (every unallocated main-tree node within ${UPGRADE_DISTANCE} points of the tree) with PoB's calculator, allocating each one's full path; ${improving.length} improve ${measured}. Ranked by relative ${measured} gain per passive point:`,
        '',
      );
      for (let i = 0; i < plan.mainShown; i++) renderUpgrade(textLines, top[i], i + 1, 'point', '', plan.stats);
      if (top.length === 0) {
        textLines.push(`None of the measured passives improves ${measured}. Try a different focus.`);
      }
    }

    // The build's own ascendancy notables, priced in ascendancy points (include_ascendancy).
    if (includeAscendancy) {
      textLines.push('', '## Ascendancy notables (cost in ascendancy points)', '');
      if (!asc) {
        textLines.push('The build has no ascendancy, so it has no ascendancy notables to measure.');
      } else {
        const budget = `${asc.name}: ${asc.used} of ${ASCENDANCY_POINTS} ascendancy points used, ${asc.remaining} left.`;
        if (ascCandidates.length === 0) {
          textLines.push(`${budget} No unallocated ${asc.name} notable is reachable.`);
        } else {
          textLines.push(
            `${budget} Measured ${ascCandidates.length} unallocated ${asc.name} notables with PoB's calculator, allocating each one's full path; ${ascImproving.length} improve ${measured}. Ranked by relative ${measured} gain per ascendancy point; a notable that needs more points than are left is marked over budget:`,
            '',
          );
          for (let i = 0; i < plan.ascShown; i++) {
            renderUpgrade(textLines, ascTop[i], i + 1, 'ascendancy point', overBudgetMark(ascById.get(ascTop[i].id)!, asc), plan.stats);
          }
          if (ascTop.length === 0) textLines.push(`None of them improves ${measured}.`);
        }
      }
    }

    // C-47: what PoB can't fully measure among the entries listed (the main-tree entries shown, in rank order,
    // and the ascendancy section's notables), then a count of the rest of the measured pool (D-417).
    if (pool.length > 0) {
      textLines.push('', "## What PoB can't fully measure", '');
      const shown = new Set(top.slice(0, plan.mainShown).map((u) => u.id));
      const listed = [
        ...top.slice(0, plan.mainShown).filter((u) => cantMeasure.has(u.id)).map((u) => cantMeasure.get(u.id)!),
        ...ascCandidates.filter((c) => cantMeasure.has(c.id)).map((c) => cantMeasure.get(c.id)!),
      ];
      const rest = mainIssues.filter((c) => !shown.has(c.id));
      if (listed.length === 0 && rest.length === 0) {
        textLines.push("Nothing: every measured passive's lines are fully parsed, and every measurement returned a value.");
      } else {
        if (listed.length > 0) {
          const kindsShown = new Set(listed.flatMap((e) => e.kinds));
          const kinds = (Object.keys(KINDS) as Array<keyof typeof KINDS>).filter((k) => kindsShown.has(k));
          textLines.push(
            "PoB may not apply some of these passives' lines, or measure them at all, so their gain may be missing or wrong " +
              `(check_model_coverage gives each line's status). ${kinds.map((k) => `${k}: ${KINDS[k]}`).join('. ')}.`,
            ...listed.map((e) => e.line),
          );
        }
        if (rest.length > 0) {
          const failed = rest.filter((c) => unmeasured.has(c.id));
          const failures = failed.length > 0 ? `; ${failed.length} of them have no value (${unmeasured.get(failed[0].id)})` : '';
          textLines.push(
            `…and ${rest.length} more passive${rest.length === 1 ? '' : 's'} in reach that PoB can't fully measure ` +
              `(check_model_coverage gives their lines)${failures}.`,
          );
        }
      }
    }

    if (plan.tip && top.length > 0) {
      textLines.push('', '💡 Use update_tree_delta to allocate a node; find_path_to_node shows the travel nodes.');
    }
    return textLines.join('\n');
  };

  // D-246: keep within C-1's limit so no can't-measure line is ever cut. Leave out the ranked entries' stat
  // lines first (search_tree_nodes gives them back), then the closing tip, then ranked entries from the
  // bottom of the longer ranking, and say what was left out in one line. `limit` is the room left once the
  // session's notices are in front of the text (the router's `refit`, as find_upgrades uses it, D-53).
  const fit = (limit: number): string => {
    const plan = { stats: true, mainShown: top.length, ascShown: includeAscendancy && asc ? ascTop.length : 0, tip: true };
    const noteFor = (): string | null => {
      const parts: string[] = [];
      if (!plan.stats) parts.push("the ranked entries' stat lines (search_tree_nodes shows them)");
      if (!plan.tip && top.length > 0) parts.push('the closing tip');
      if (plan.mainShown < top.length) {
        parts.push(`passive-point ranks ${plan.mainShown + 1}-${top.length}`);
      }
      if (includeAscendancy && asc && plan.ascShown < ascTop.length) {
        parts.push(`ascendancy ranks ${plan.ascShown + 1}-${ascTop.length}`);
      }
      return parts.length > 0 ? `Shortened to stay within ${OUTPUT_LIMIT} characters; left out: ${parts.join('; ')}.` : null;
    };
    let text = render(plan, noteFor());
    while (text.length > limit) {
      if (plan.stats) plan.stats = false;
      else if (plan.tip && top.length > 0) plan.tip = false;
      else if (plan.mainShown > 0 || plan.ascShown > 0) {
        if (plan.mainShown >= plan.ascShown) plan.mainShown--;
        else plan.ascShown--;
      } else break;
      text = render(plan, noteFor());
    }
    return text;
  };

  return {
    content: [{ type: 'text' as const, text: fit(OUTPUT_LIMIT) }],
    refit: (reservedChars: number) => fit(OUTPUT_LIMIT - Math.max(0, reservedChars)),
  };
}

// ---------------------------------------------------------------------------------------------------
// get_node_power (C-55, D-417, D-418)

/** `get_node_power`'s arguments, as the router passes them. */
export interface NodePowerArgs {
  stats?: unknown;
  max_loss?: unknown;
  clear_group?: unknown;
  protect_for?: unknown;
  max_distance?: unknown;
  loadout?: unknown;
  level?: unknown;
  keep?: unknown;
  limit?: unknown;
  cull?: unknown;
  rebuild?: unknown;
  free?: unknown;
}

/** The default stats (D-417): Full DPS ranks, Effective Hit Pool beside it. */
export const NODE_POWER_DEFAULT_STATS = ['FullDPS', 'TotalEHP'];
/** The distance limit: points from the tree (D-417). */
const NODE_POWER_MAX_DISTANCE = 12;
/** The guards' keys in a `max_loss` map (the bridge's names). */
const GUARD_LABELS: Record<string, string> = {
  movement: 'movement speed',
  clearRadius: "the clear skill's radius",
  clearUses: "the clear skill's uses per second",
  maxHit: 'the lowest maximum hit taken',
};

function wholeNumber(value: unknown, name: string, lo: number, hi?: number): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < lo || (hi !== undefined && value > hi)) {
    throw new Error(`${name} must be a whole number from ${lo}${hi !== undefined ? ` to ${hi}` : ''}`);
  }
  return value;
}

/** The bridge's params from the tool's arguments; a bad argument throws, naming it. */
export function nodePowerParams(args: NodePowerArgs): NodePowerParams {
  let stats = NODE_POWER_DEFAULT_STATS;
  if (args.stats !== undefined) {
    if (!Array.isArray(args.stats) || args.stats.length < 1 || args.stats.length > 3 || !args.stats.every((s) => typeof s === 'string' && s.trim() !== '')) {
      throw new Error("stats must list 1 to 3 of PoB's power stats, by id or label (default FullDPS and TotalEHP)");
    }
    stats = args.stats as string[];
  }
  const params: NodePowerParams = { stats };
  if (args.max_loss !== undefined) {
    const loss = args.max_loss;
    const pctOk = (v: unknown) => typeof v === 'number' && Number.isFinite(v) && v >= 0;
    if (pctOk(loss)) params.maxLoss = loss as number;
    else if (loss !== null && typeof loss === 'object' && !Array.isArray(loss) && Object.values(loss).every(pctOk)) {
      params.maxLoss = loss as Record<string, number>;
    } else {
      throw new Error(`max_loss must be a percentage, 0 or more, or a map of percentages by stat id or guard (${Object.keys(GUARD_LABELS).join(', ')})`);
    }
  }
  if (args.clear_group !== undefined) params.clearGroup = wholeNumber(args.clear_group, 'clear_group', 1);
  if (args.protect_for !== undefined) {
    if (!Array.isArray(args.protect_for) || !args.protect_for.every((n) => typeof n === 'string' && n !== '')) {
      throw new Error("protect_for must list loadout names, as manage_sets' loadout list shows them");
    }
    params.protectFor = args.protect_for as string[];
  }
  if (args.max_distance !== undefined) params.maxDistance = wholeNumber(args.max_distance, 'max_distance', 1, NODE_POWER_MAX_DISTANCE);
  if (args.loadout !== undefined) {
    if (typeof args.loadout !== 'string' || args.loadout === '') throw new Error("loadout must be a loadout's name, as manage_sets' loadout list shows it");
    params.loadout = args.loadout;
  }
  if (args.level !== undefined) params.level = wholeNumber(args.level, 'level', 1, 100);
  if (args.keep !== undefined) {
    if (!Array.isArray(args.keep) || !args.keep.every((n) => typeof n === 'number' && Number.isInteger(n))) {
      throw new Error('keep must list allocated node ids');
    }
    params.keep = args.keep as number[];
  }
  if (args.limit !== undefined) params.limit = wholeNumber(args.limit, 'limit', 0);
  // D-437: cull multiplies MainDamage; D-439: rebuild and free each replace the swap search.
  for (const key of ['cull', 'rebuild'] as const) {
    if (args[key] !== undefined) {
      if (typeof args[key] !== 'boolean') throw new Error(`${key} must be true or false`);
      params[key] = args[key] as boolean;
    }
  }
  if (params.cull && !stats.some((s) => s.trim().toLowerCase() === 'maindamage' || s.trim().toLowerCase() === 'main damage')) {
    throw new Error('cull multiplies MainDamage by its CullMultiplier; name MainDamage in stats');
  }
  if (args.free !== undefined) {
    if (!Array.isArray(args.free) || args.free.length === 0 || !args.free.every((n) => typeof n === 'number' && Number.isInteger(n))) {
      throw new Error('free must list allocated node ids');
    }
    if (params.rebuild) throw new Error('rebuild and free each replace the swap search: pass one of them');
    params.free = args.free as number[];
  }
  return params;
}

/** A figure for the text: thousands separators from 100, two decimals from 1, three significant digits below. */
function figure(v: number | null | undefined): string {
  if (typeof v !== 'number' || !Number.isFinite(v)) return '?';
  if (Math.abs(v) >= 100) return Math.round(v).toLocaleString('en-US');
  if (Math.abs(v) >= 1 || v === 0) return String(Math.round(v * 100) / 100);
  return String(Number(v.toPrecision(3)));
}
const signed = (v: number | null | undefined): string => (typeof v === 'number' && v >= 0 ? '+' : '') + figure(v);
const percent = (v: number | null | undefined): string =>
  typeof v === 'number' && Number.isFinite(v) ? `${v >= 0 ? '+' : ''}${v.toFixed(2)}%` : 'n/a';

/** The change of `delta` against `base`, in percent; null when the base is 0. */
function relative(delta: number | null | undefined, base: number | null | undefined): number | null {
  return typeof delta === 'number' && typeof base === 'number' && base !== 0 ? (delta / Math.abs(base)) * 100 : null;
}

const nodeRef = (n: { id: number; name: string }) => `${n.name} [${n.id}]`;
const typeText = (n: { type: string; attribute?: boolean }) => `${n.type}${n.attribute ? ' (attribute)' : ''}`;
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** `a`, `a and b`, `a, b and c`. */
const joinAnd = (items: string[]): string => (items.length <= 1 ? items.join('') : `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`);

/** The stats a line's figures are of: a pool's own when it names them (D-437: Full DPS for MainDamage), else the call's. */
const statsOf = (r: NodePowerResult, pool?: PowerPool) => pool?.stats ?? r.stats;

/** A measured move's gains: the first stat's percentage and change, then each other stat's. */
function gainsText(stats: NodePowerResult['stats'], s: PowerSwap): string {
  const gains = stats.map((x, i) =>
    i === 0 ? `${percent(s.gainPercent?.[i])} ${x.label} (${signed(s.gain?.[i])})` : `${x.label} ${percent(s.gainPercent?.[i])} (${signed(s.gain?.[i])})`,
  );
  return `${gains[0]}${gains.length > 1 ? `; ${gains.slice(1).join('; ')}` : ''}`;
}

/** A move's nodes, net: the points removed and the points added, each added attribute node with PoB's default choice. */
function nodesText(s: PowerSwap): string {
  const removed = s.removed ?? [];
  const added = s.added ?? [];
  const addedText = added.map((n) => `${nodeRef(n)}${n.attributeChoice ? ` (attribute: ${n.attributeChoice})` : ''}`);
  return `Remove ${plural(removed.length, 'point')}: ${removed.map(nodeRef).join(', ')}. Add ${plural(added.length, 'point')}: ${addedText.join(', ')}.`;
}

/** The branches a swap freed: one, or D-439's two or three freed together. */
function branchesText(s: PowerSwap): string {
  const used = s.used ?? (s.added ?? []).length;
  const b = s.branches;
  if (b.length === 1) {
    return `Searched from branch ${b[0].name} [${b[0].id}]: its new paths use ${used} of the ${plural(s.freed, 'freed point')}, counted after the branch is removed.`;
  }
  const list = b.map((x) => `${x.name} [${x.id}] (${plural(x.points, 'point')})`);
  return (
    `Searched from branches ${joinAnd(list)}, freed together: their new paths use ${used} of the ${plural(s.freed, 'freed point')}, ` +
    'counted after the branches are removed.'
  );
}

/** A swap tried, in the tried list: its branch, or its branches joined by `+`. */
const triedLabel = (s: PowerSwap): string => s.branches.map((b) => `${b.name} [${b.id}]`).join(' + ');

/**
 * The best swap, or why there is none, in one paragraph (the compact mode's line). For a pool move (C-55a, D-426),
 * `pool` holds its pool's swaps, and the line names the pool, `Best swap (weapon set <n>): …`, in the same form.
 */
function swapText(r: NodePowerResult, pool?: PowerPool): string {
  const s = pool ? pool.bestSwap : r.bestSwap;
  const swaps = pool ? pool.swaps : r.swaps;
  const head = pool ? `Best swap (weapon set ${pool.set})` : 'Best swap';
  const stats = statsOf(r, pool);
  if (!s) {
    // The limits in force (the call's max_loss over the defaults); a pool's Full DPS takes MainDamage's.
    const limit = (key: string, fallback: number) => {
      const v = r.limits?.[key];
      return typeof v === 'number' ? v : fallback;
    };
    const statLimit = (i: number) => limit(stats[i].id, limit(r.stats[i]?.id ?? '', 2));
    const pctText = (v: number) => `${figure(v)}%`;
    const limits = [
      ...stats.slice(1).map((x, k) => `${x.label} may lose at most ${pctText(statLimit(k + 1))}`),
      `movement speed ${pctText(limit('movement', 0))}`,
      `the clear skill's radius ${pctText(limit('clearRadius', 0))} and uses per second ${pctText(limit('clearUses', 0))}`,
      `the lowest maximum hit taken ${pctText(limit('maxHit', 2))}`,
    ];
    const legal = swaps.filter((s) => s.verdict !== 'illegal').length;
    return (
      `${head}: none: of the weakest unprotected branches${pool ? '' : ', alone and together'}, ${plural(swaps.length, 'was', 'were')} tried (${legal} legal), ` +
      `and none gains ${stats[0].label} within the limits (${limits.join('; ')}).`
    );
  }
  return `${head}: ${gainsText(stats, s)}. ${nodesText(s)} ${branchesText(s)}`;
}

/**
 * D-439: the rebuild's or the free's one move, judged as a swap, in one paragraph: `Rebuild: …` or `Free: …`, its gains
 * and nodes when it is legal; else why it isn't, with what it measured; then what was freed and how much the refill used.
 */
function moveText(r: NodePowerResult): string {
  const t = r.swaps[0];
  const head = r.mode === 'rebuild' ? 'Rebuild' : 'Free';
  if (!t) return `${head}: none.`;
  const what =
    r.mode === 'rebuild'
      ? `Freed every node outside keep, the protected nodes and their paths to the start: ${plural(t.freed, 'point')}`
      : `Freed ${joinAnd((r.freeNodes ?? []).map(nodeRef))} and what their removal disconnects: ${plural(t.freed, 'point')}`;
  const uses = t.used !== undefined ? `; the refill uses ${t.used} of them` : '';
  if (t.verdict === 'legal') return `${head}: ${gainsText(r.stats, t)}. ${nodesText(t)} ${what}${uses}.`;
  const measured = t.gain ? ` Measured: ${gainsText(r.stats, t)}. ${nodesText(t)}` : '';
  return `${head}: none: ${t.verdict}${t.reason ? `: ${t.reason}` : ''}.${measured} ${what}${uses}.`;
}

/**
 * `get_node_power` (C-55): PoB's node power on a loadout, with the best legal swap (D-417, D-418). One engine
 * request (`node_power`, a 120 s long action) measures every stat; then `check_coverage` rates the listed nodes'
 * lines for what PoB can't measure (C-47's section). C-55a (D-426): after the best swap's line, one line per
 * weapon-set pool with nodes, `Best swap (weapon set <n>): …` in the same form, the move within that pool measured
 * with its set active.
 */
export async function handleGetNodePower(context: PassiveUpgradesContext, args: NodePowerArgs) {
  return wrapHandler('get node power', async () => {
    const params = nodePowerParams(args ?? {});
    await context.ensureLuaClient();
    const luaClient = context.getLuaClient();
    if (!luaClient) throw new Error('Lua bridge not active. Use lua_start and lua_load_build first.');
    const r = await luaClient.nodePower(params);
    const compact = (params.limit ?? 15) === 0;
    const first = r.stats[0];
    const lines: string[] = [];
    const where = r.loadout ? `loadout "${r.loadout}"` : 'the active sets (no loadout matches them)';
    lines.push(`=== Node power: ${where}, level ${r.level}${compact ? ' (compact)' : ''} ===`);
    const statNames = r.stats.map((s) => `${s.label} (${s.id})`);
    const named = r.stats.map((s) => s.label).join(' or ');
    if (!compact) {
      lines.push(
        `Ranked by ${statNames[0]}${statNames.length > 1 ? `; also measured: ${statNames.slice(1).join(', ')}` : ''}. ` +
          `${r.measuredNodes} nodes within ${r.maxDistance} points of the tree measured with PoB's calculator ` +
          `(${r.calculations} calculations, ${r.cpuSeconds.toFixed(1)} s CPU` +
          `${(r.poolSwaps ?? []).length > 0 && typeof r.poolCpuSeconds === 'number' ? `, ${r.poolCpuSeconds.toFixed(1)} s of it on the weapon-set pools` : ''}).`,
      );
      const clear = r.clear;
      const clearText =
        clear.error !== undefined
          ? `clear group ${clear.group}: not measured (${clear.error})`
          : `clear group ${clear.group}${clear.label ? ` (${clear.label})` : ''}${clear.minion ? ", its minion's" : ''}: ` +
            `${typeof clear.radius === 'number' ? `radius ${figure(clear.radius)} m` : 'no radius'}, ` +
            `${typeof clear.usesPerSecond === 'number' ? `${figure(clear.usesPerSecond)} uses per second` : 'no use rate'}`;
      lines.push(
        `Base: ${r.stats.map((s, i) => `${s.label} ${figure(r.base[i])}`).join(' | ')} | movement speed ×${figure(r.movement)} | ` +
          `lowest maximum hit taken ${figure(r.maxHit)} | ${clearText}`,
      );
    }
    lines.push(`Travel: ${r.travel} of ${plural(r.points, 'point')} give nothing alone on ${named}.`);
    lines.push(r.mode === 'swap' ? swapText(r) : moveText(r));
    // C-55a (D-426): each weapon-set pool's move, measured with that set active.
    const pools = r.poolSwaps ?? [];
    for (const p of pools) lines.push(swapText(r, p));
    const keepUnallocated = r.keepNotAllocated;
    if (keepUnallocated.length > 0) {
      lines.push(`keep: ${keepUnallocated.join(', ')} ${keepUnallocated.length === 1 ? "isn't" : "aren't"} allocated in this loadout, so ${keepUnallocated.length === 1 ? 'it protects' : 'they protect'} nothing.`);
    }

    if (!compact) {
      const prot = Object.entries(r.protected ?? {}).map(([why, n]) => `${n} ${why}`);
      if (prot.length > 0) {
        lines.push(
          `Protected nodes (never removed, nor any branch holding one): ${prot.join(', ')}.` +
            (pools.length > 0 ? ' A weapon-set node moves only within its own pool, by that pool\'s move.' : ''),
        );
      }
      for (const p of pools) {
        lines.push(
          `Weapon set ${p.set}: ${plural(p.nodes, 'node')}; with it active, ${statsOf(r, p).map((s, i) => `${s.label} ${figure(p.base[i])}`).join(' | ')}.` +
            (p.stats ? ' It holds no main group, so Full DPS ranks its move in place of Main damage.' : ''),
        );
      }
      if ((r.heldBranches ?? 0) > 0) {
        lines.push(
          `Also left out: ${plural(r.heldBranches!, 'branch', 'branches')} whose removal would disconnect a node outside it ` +
            "(a weapon-set node PoB's depends leaves out, or a node a protect_for loadout builds on).",
        );
      }
      const tried = [
        ...r.swaps.map((s) => ({ s, pool: '', label: first.label })),
        ...pools.flatMap((p) => p.swaps.map((s) => ({ s, pool: `(weapon set ${p.set}) `, label: statsOf(r, p)[0].label }))),
      ];
      if (r.mode === 'swap' && tried.length > 0) {
        lines.push(
          '',
          'Swaps tried (the weakest unprotected branches, until 5 legal tries, then the pairs and triples of the 5 weakest freed ' +
            "together, fewest points first; each pool's within it, one branch at a time):",
        );
        for (const { s, pool, label } of tried) {
          const gain = s.gainPercent?.[0] !== undefined ? ` (${percent(s.gainPercent[0])} ${label})` : '';
          lines.push(`- ${pool}${triedLabel(s)}, ${plural(s.freed, 'point')}: ${s.verdict}${s.reason ? `: ${s.reason}` : ''}${gain}`);
        }
      }
      lines.push('', `## Best unallocated nodes, by path gain per point on ${first.label}`, '');
      if (r.best.length === 0) lines.push(`No unallocated node within ${r.maxDistance} points gains ${first.label}.`);
      r.best.forEach((n, i) => {
        lines.push(
          `${i + 1}. **${n.name}** [${n.id}] ${typeText(n)}, ${plural(n.distance, 'point')}: ${signed(n.perPoint)} ${first.label} per point (${percent(relative(n.perPoint, r.base[0]))})`,
        );
        const alone = r.stats.map((s, k) => `${s.label} ${signed(n.alone[k])}`).join(', ');
        const withPath = r.stats.map((s, k) => `${s.label} ${signed(n.withPath[k])}`).join(', ');
        lines.push(`   Alone: ${alone} | with its path: ${withPath}`);
        lines.push(`   Path: ${n.path.join(', ')}`);
      });
      lines.push('', `## Weakest allocated branches, by loss per point on ${first.label}`, '');
      if (r.weakest.length === 0) lines.push('No unprotected allocated branch.');
      r.weakest.forEach((n, i) => {
        lines.push(
          `${i + 1}. **${n.name}** [${n.id}] ${typeText(n)}, branch of ${plural(n.points, 'point')}: ${signed(n.lossPerPoint === null ? null : -n.lossPerPoint)} ${first.label} per point removed`,
        );
        const branch = r.stats.map((s, k) => `${s.label} ${signed(n.loss[k] === null ? null : -n.loss[k]!)}`).join(', ');
        const alone = r.stats.map((s, k) => `${s.label} ${signed(n.lossAlone[k] === null ? null : -n.lossAlone[k]!)}`).join(', ');
        lines.push(`   Removing the branch: ${branch} | the node alone: ${alone}`);
        lines.push(`   Branch: ${n.branch.join(', ')}`);
      });
    }

    // C-47's section over the nodes listed: the ranked nodes, the listed branches' nodes and the best swaps' nodes.
    const listed = new Map<number, string>();
    for (const n of r.best) listed.set(n.id, n.name);
    for (const n of r.weakest) listed.set(n.id, n.name);
    for (const s of [r.bestSwap, ...pools.map((p) => p.bestSwap)]) {
      for (const n of [...(s?.removed ?? []), ...(s?.added ?? [])]) listed.set(n.id, n.name);
    }
    const branchIds = new Set<number>();
    for (const n of r.weakest) for (const id of n.branch) if (!listed.has(id)) branchIds.add(id);
    const coverageIds = [...listed.keys(), ...branchIds];
    const reasons = new Map<number, string[]>();
    const names = new Map(listed);
    if (coverageIds.length > 0) {
      const scan = await context.sourceScan();
      const coverage = await luaClient.checkCoverage({ nodes: coverageIds, sourceNames: [...scan.names], sourceTemplates: scan.templates });
      for (const e of coverage.entries) {
        if (e.kind !== 'node' || e.nodeId === undefined || e.status === 'fully parsed') continue;
        const kind = e.status === 'possibly unread' ? 'advisory' : 'not applied';
        const list = reasons.get(e.nodeId) ?? [];
        list.push(`${kind}: [${e.status}] ${[e.line, ...(e.joinedWith ?? [])].join(' ')}`);
        reasons.set(e.nodeId, list);
        if (!names.has(e.nodeId)) names.set(e.nodeId, (/^Node \d+ (.*)$/.exec(e.source ?? '')?.[1]) ?? String(e.nodeId));
      }
    }
    for (const f of r.failures) {
      const list = reasons.get(f.id) ?? [];
      list.push(`no value: PoB's calculator failed: ${f.error}`);
      reasons.set(f.id, list);
      names.set(f.id, f.name);
    }
    if (reasons.size > 0 || !compact) {
      lines.push('', "## What PoB can't fully measure", '');
      if (reasons.size === 0) {
        lines.push("Nothing: every listed node's lines are fully parsed, and every measurement returned a value.");
      } else {
        lines.push(
          "PoB may not apply some of these nodes' lines, or measure them at all, so their figures may be missing or wrong " +
            "(check_model_coverage gives each line's status). not applied: PoB applies nothing from the line; advisory: PoB parses " +
            'a possibly unread line but may never read a mod it makes; no value: the calculation failed.',
        );
        for (const [id, list] of [...reasons].sort((a, b) => a[0] - b[0])) lines.push(`- **${names.get(id) ?? id}** [${id}]: ${list.join(' | ')}`);
      }
    }
    return { content: [{ type: 'text' as const, text: lines.join('\n') }] };
  });
}

// Helper function
function formatTreeComparison(comparison: TreeComparison): string {
  const lines: string[] = [
    '=== Passive Tree Comparison ===',
    '',
    `Build 1: ${comparison.build1.name}`,
    `Build 2: ${comparison.build2.name}`,
    '',
    '=== Point Allocation ===',
    `Build 1: ${comparison.build1.analysis.totalPoints} points`,
    `Build 2: ${comparison.build2.analysis.totalPoints} points`,
    `Difference: ${Math.abs(comparison.differences.pointDifference)} points ` +
      (comparison.differences.pointDifference > 0 ? '(Build 1 has more)' : '(Build 2 has more)'),
    '',
    '=== Archetype Comparison ===',
    comparison.differences.archetypeDifference,
    '',
    '=== Keystones Comparison ===',
    `Build 1 Keystones: ${comparison.build1.analysis.keystones.map(k => k.name).join(', ') || 'None'}`,
    `Build 2 Keystones: ${comparison.build2.analysis.keystones.map(k => k.name).join(', ') || 'None'}`,
  ];

  // Unique keystones
  const uniqueKeystones1 = comparison.differences.uniqueToBuild1.filter(n => n.isKeystone);
  const uniqueKeystones2 = comparison.differences.uniqueToBuild2.filter(n => n.isKeystone);

  if (uniqueKeystones1.length > 0) {
    lines.push('\nUnique to Build 1:');
    for (const ks of uniqueKeystones1) {
      lines.push(`- ${ks.name}`);
    }
  }

  if (uniqueKeystones2.length > 0) {
    lines.push('\nUnique to Build 2:');
    for (const ks of uniqueKeystones2) {
      lines.push(`- ${ks.name}`);
    }
  }

  // Notables comparison
  lines.push(
    '',
    '=== Notable Passives Comparison ===',
    `Build 1: ${comparison.build1.analysis.notables.length} notables`,
    `Build 2: ${comparison.build2.analysis.notables.length} notables`
  );

  const uniqueNotables1 = comparison.differences.uniqueToBuild1.filter(n => n.isNotable);
  const uniqueNotables2 = comparison.differences.uniqueToBuild2.filter(n => n.isNotable);

  if (uniqueNotables1.length > 0) {
    lines.push('\nTop 5 Unique Notables to Build 1:');
    for (const notable of uniqueNotables1.slice(0, 5)) {
      lines.push(`- ${notable.name || 'Unnamed'}`);
    }
  }

  if (uniqueNotables2.length > 0) {
    lines.push('\nTop 5 Unique Notables to Build 2:');
    for (const notable of uniqueNotables2.slice(0, 5)) {
      lines.push(`- ${notable.name || 'Unnamed'}`);
    }
  }

  // Pathing efficiency
  lines.push(
    '',
    '=== Pathing Efficiency ===',
    `Build 1: ${comparison.build1.analysis.pathingEfficiency}`,
    `Build 2: ${comparison.build2.analysis.pathingEfficiency}`,
    '',
    '=== Shared Nodes ===',
    `${comparison.differences.sharedNodes.length} nodes are allocated in both builds`
  );

  return lines.join('\n');
}
