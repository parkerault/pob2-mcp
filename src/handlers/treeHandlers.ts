import type { BuildService } from "../services/buildService.js";
import type { TreeService } from "../services/treeService.js";
import type { TreeAnalysisResult, TreeComparison, PassiveTreeNode, AllocationChange, PassiveTreeData } from "../types.js";
import type { PoBLuaApiClient } from "../pobLuaBridge.js";
import type { LoadedBuild } from "../engine/session.js";
import { handleGetBuildIssues } from "./buildGoalsHandlers.js";
import { formatLoadedBuild } from "./luaHandlers.js";

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

export async function handleFindPath(
  context: TreeHandlerContext,
  buildName: string | undefined,
  targetNodeId: string,
  showAlternatives?: boolean
) {
  try {
    let allocatedNodeIds: string[] = [];
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
      showAlternatives ? 3 : 1
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


/** The calculator outputs `get_passive_upgrades` measures (`calc_with` fields). */
const UPGRADE_FIELDS = ['CombinedDPS', 'TotalDPS', 'TotalEHP', 'Life'];
/** Candidates measured per search keyword: the nearest unallocated notables by PoB's path cost. */
const CANDIDATES_PER_KEYWORD = 8;

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

const dpsOf = (out: Record<string, unknown>): number =>
  Number(out.CombinedDPS ?? 0) || Number(out.TotalDPS ?? 0);
const ehpOf = (out: Record<string, unknown>): number => Number(out.TotalEHP ?? 0) || Number(out.Life ?? 0);

export async function handleGetPassiveUpgrades(
  context: PassiveUpgradesContext,
  focus: 'dps' | 'defence' | 'both' = 'both',
  maxResults: number = 10
) {
  await context.ensureLuaClient();
  const luaClient = context.getLuaClient();
  if (!luaClient) throw new Error('Lua bridge not active. Use lua_start and lua_load_build first.');

  // Step 1: the build's issues, to pick search keywords
  const { issues } = await handleGetBuildIssues(context);

  // Step 2: map focus + issues to search keywords
  const keywords: string[] = [];

  if (focus === 'dps' || focus === 'both') {
    keywords.push('damage', 'critical');
  }

  if (focus === 'defence' || focus === 'both') {
    keywords.push('life', 'energy shield');
    // If a resistance is below its maximum (judge(), FR-A1), add resistance keywords
    const hasResistIssue = issues.some(i => i.kind === 'missing_resist');
    if (hasResistIssue) {
      keywords.push('resistance');
    }
  }

  // Step 3: the nearest unallocated main-tree notables per keyword, by PoB's own path cost.
  // Unreachable nodes (another ascendancy, a blocked path) carry no path and are skipped. Ascendancy
  // notables are skipped too: search_nodes types them 'notable', and the build's own ascendancy has
  // real paths, but they cost ascendancy points (capped separately), not passive points.
  const seen = new Set<number>();
  const candidates: Array<{ id: number; name: string; stats: string[]; path: number[]; pathCost: number }> = [];

  for (const keyword of keywords.slice(0, 4)) {
    const results = await luaClient.searchNodes({
      keyword,
      nodeType: 'notable',
      maxResults: 1000,
      includeAllocated: false,
    });
    const reachable = results.nodes
      .filter((n) => !n.allocated && !n.ascendancyName && n.path && n.path.length > 0 && Number.isInteger(n.pathDist) && n.pathDist! >= 1)
      .sort((a, b) => a.pathDist! - b.pathDist! || a.name.localeCompare(b.name) || a.id - b.id);
    let taken = 0;
    for (const n of reachable) {
      if (taken >= CANDIDATES_PER_KEYWORD) break;
      if (seen.has(n.id)) continue;
      seen.add(n.id);
      candidates.push({ id: n.id, name: n.name, stats: n.stats, path: n.path!, pathCost: n.pathDist! });
      taken++;
    }
  }

  if (candidates.length === 0) {
    return {
      content: [{
        type: 'text' as const,
        text: `=== Passive Upgrades (focus: ${focus}) ===\n\nNo reachable unallocated notable candidates found. Make sure a build is loaded.\n`,
      }],
    };
  }

  // Step 4: measure each candidate with PoB's calculator (calc_with), allocating the whole path to
  // it, as PoB's tree tooltip does ("Allocating this node and all nodes leading to it"). The base is
  // the same calculator with nothing added.
  const base = await luaClient.calcWith({ fields: UPGRADE_FIELDS });
  const baseDPS = dpsOf(base);
  const baseEHP = ehpOf(base);
  const rel = (delta: number, of: number) => (of > 0 ? delta / of : 0);

  const scored: PassiveUpgrade[] = [];
  for (const c of candidates) {
    const out = await luaClient.calcWith({ addNodes: c.path, fields: UPGRADE_FIELDS });
    const dpsDelta = dpsOf(out) - baseDPS;
    const ehpDelta = ehpOf(out) - baseEHP;
    const gain =
      focus === 'dps' ? rel(dpsDelta, baseDPS)
        : focus === 'defence' ? rel(ehpDelta, baseEHP)
          : rel(dpsDelta, baseDPS) + rel(ehpDelta, baseEHP);
    scored.push({ id: c.id, name: c.name, stats: c.stats, pathCost: c.pathCost, dpsDelta, ehpDelta, score: gain / c.pathCost });
  }

  // Step 5: the candidates that improve the requested stat(s), best gain per point first
  const improving = scored
    .filter((u) => u.score > 0)
    .sort((a, b) => b.score - a.score || a.pathCost - b.pathCost || a.name.localeCompare(b.name));
  const top = improving.slice(0, maxResults);

  const measured = focus === 'dps' ? 'DPS' : focus === 'defence' ? 'EHP' : 'DPS + EHP';
  const textLines: string[] = [
    `=== Passive Upgrades (focus: ${focus}) ===`,
    '',
    `Base DPS: ${Math.round(baseDPS).toLocaleString()}  |  Base EHP: ${Math.round(baseEHP).toLocaleString()}`,
    `Measured ${candidates.length} nearby notables with PoB's calculator, allocating each one's full path; ${improving.length} improve ${measured}. Ranked by relative ${measured} gain per passive point:`,
    '',
  ];

  for (let i = 0; i < top.length; i++) {
    const u = top[i];
    textLines.push(`${i + 1}. **${u.name}** [${u.id}]`);
    textLines.push(`   Path cost: ${u.pathCost} point${u.pathCost === 1 ? '' : 's'}  |  Score per point: ${u.score.toFixed(4)}`);
    const deltas: string[] = [];
    if (u.dpsDelta !== 0) deltas.push(`DPS Δ: ${u.dpsDelta > 0 ? '+' : ''}${Math.round(u.dpsDelta).toLocaleString()}`);
    if (u.ehpDelta !== 0) deltas.push(`EHP Δ: ${u.ehpDelta > 0 ? '+' : ''}${Math.round(u.ehpDelta).toLocaleString()}`);
    if (deltas.length) textLines.push(`   ${deltas.join('  |  ')}`);
    for (const stat of u.stats.slice(0, 2)) {
      textLines.push(`   - ${stat}`);
    }
    textLines.push('');
  }

  if (top.length === 0) {
    textLines.push(`None of the measured notables improves ${measured}. Try a different focus.`);
  } else {
    textLines.push('', '💡 Use update_tree_delta to allocate a node; find_path_to_node shows the travel nodes.');
  }

  return {
    content: [{ type: 'text' as const, text: textLines.join('\n') }],
  };
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
