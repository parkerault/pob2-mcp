import type { BuildService } from "../services/buildService.js";
import type { TreeService } from "../services/treeService.js";
import type { TreeAnalysisResult, TreeComparison, PassiveTreeNode, AllocationChange, PassiveTreeData } from "../types.js";
import { EngineActionError, type PoBLuaApiClient } from "../pobLuaBridge.js";
import type { LoadedBuild } from "../engine/session.js";
import type { PobSourceScan } from "../engine/pobSourceNames.js";
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
const DPS_FIELDS = ['CombinedDPS', 'TotalDPS'];
const EHP_FIELDS = ['TotalEHP', 'Life'];
/** Candidates measured per search keyword: the nearest unallocated notables by PoB's path cost. */
const CANDIDATES_PER_KEYWORD = 8;
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

/** A candidate notable: PoB's own path to it (`node.path`) and its point cost (`node.pathDist`). */
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

const dpsOf = (out: Record<string, unknown>): number =>
  Number(out.CombinedDPS ?? 0) || Number(out.TotalDPS ?? 0);
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
  // real paths, but they cost ascendancy points (capped separately), not passive points. Only
  // include_ascendancy measures them, in their own section (C-47, D-197).
  const seen = new Set<number>();
  const candidates: UpgradeCandidate[] = [];

  for (const keyword of keywords.slice(0, 4)) {
    const results = await luaClient.searchNodes({
      keyword,
      nodeType: 'notable',
      maxResults: 1000,
      includeAllocated: false,
    });
    const nearest = results.nodes
      .filter((n) => !n.ascendancyName && reachable(n))
      .sort((a, b) => a.pathDist! - b.pathDist! || a.name.localeCompare(b.name) || a.id - b.id);
    let taken = 0;
    for (const n of nearest) {
      if (taken >= CANDIDATES_PER_KEYWORD) break;
      if (seen.has(n.id)) continue;
      seen.add(n.id);
      candidates.push({ id: n.id, name: n.name, stats: n.stats, path: n.path!, pathCost: n.pathDist!, ascendancy: false });
      taken++;
    }
  }

  const asc = includeAscendancy ? await ascendancyPool(luaClient) : null;
  const ascCandidates = asc?.candidates ?? [];

  if (candidates.length === 0 && !includeAscendancy) {
    return {
      content: [{
        type: 'text' as const,
        text: `=== Passive Upgrades (focus: ${focus}) ===\n\nNo reachable unallocated notable candidates found. Make sure a build is loaded.\n`,
      }],
    };
  }

  // Step 4: measure each candidate with PoB's calculator (calc_with), allocating the whole path to
  // it, as PoB's tree tooltip does ("Allocating this node and all nodes leading to it"). The base is
  // the same calculator with nothing added. A candidate whose measurement returns no value for the
  // requested stat(s), or fails in the engine, isn't ranked: it goes to the can't-measure section (C-47).
  const base = await luaClient.calcWith({ fields: UPGRADE_FIELDS });
  const baseDPS = dpsOf(base);
  const baseEHP = ehpOf(base);
  const rel = (delta: number, of: number) => (of > 0 ? delta / of : 0);
  const unmeasured = new Map<number, string>();

  const measure = async (c: UpgradeCandidate): Promise<PassiveUpgrade | null> => {
    let out: Record<string, unknown>;
    try {
      out = await luaClient.calcWith({ addNodes: c.path, fields: UPGRADE_FIELDS });
    } catch (error) {
      // The engine refused this one calculation; a stopped or stuck engine still fails the call.
      if (!(error instanceof EngineActionError)) throw error;
      unmeasured.set(c.id, `PoB's calculator failed: ${error.message}`);
      return null;
    }
    const missing: string[] = [];
    if (focus !== 'defence' && !hasValue(out, DPS_FIELDS)) missing.push('DPS');
    if (focus !== 'dps' && !hasValue(out, EHP_FIELDS)) missing.push('EHP');
    if (missing.length > 0) {
      unmeasured.set(c.id, `PoB's calculator returned no ${missing.join(' or ')} value`);
      return null;
    }
    const dpsDelta = dpsOf(out) - baseDPS;
    const ehpDelta = ehpOf(out) - baseEHP;
    const gain =
      focus === 'dps' ? rel(dpsDelta, baseDPS)
        : focus === 'defence' ? rel(ehpDelta, baseEHP)
          : rel(dpsDelta, baseDPS) + rel(ehpDelta, baseEHP);
    return { id: c.id, name: c.name, stats: c.stats, pathCost: c.pathCost, dpsDelta, ehpDelta, score: gain / c.pathCost };
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
  const KINDS = {
    'not applied': 'PoB applies nothing from the line (unparsed, partly parsed, parsed to nothing)',
    advisory: 'PoB parses a possibly unread line but may never read a mod it makes; the measured change may already include it',
    choice: 'a multiple-choice notable, measured with no option chosen',
    'no value': "PoB's calculator returned nothing for it",
  } as const;
  const kindsShown = new Set<keyof typeof KINDS>();
  const cantMeasure: string[] = [];
  for (const c of pool) {
    const reasons: string[] = [];
    const reason = (kind: keyof typeof KINDS, text: string) => {
      kindsShown.add(kind);
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
    cantMeasure.push(`- **${c.name}** [${c.id}]${cost}: ${reasons.join(' | ')}${overBudgetMark(c, asc)}`);
  }

  const measured = focus === 'dps' ? 'DPS' : focus === 'defence' ? 'EHP' : 'DPS + EHP';
  const ascImproving = ascScored.filter((u) => u.score > 0).sort(byScore);
  const ascTop = ascImproving.slice(0, maxResults);
  const ascById = new Map(ascCandidates.map((c) => [c.id, c]));

  /** The whole text, with `mainShown` and `ascShown` ranked entries, their stat lines or not, and a note. */
  const render = (plan: { stats: boolean; mainShown: number; ascShown: number; tip: boolean }, note: string | null): string => {
    const textLines: string[] = [`=== Passive Upgrades (focus: ${focus}) ===`, ''];
    if (note) textLines.push(note, '');
    if (candidates.length === 0) {
      textLines.push('No reachable unallocated notable candidates found. Make sure a build is loaded.', '');
    } else {
      textLines.push(
        `Base DPS: ${Math.round(baseDPS).toLocaleString()}  |  Base EHP: ${Math.round(baseEHP).toLocaleString()}`,
        `Measured ${candidates.length} nearby notables with PoB's calculator, allocating each one's full path; ${improving.length} improve ${measured}. Ranked by relative ${measured} gain per passive point:`,
        '',
      );
      for (let i = 0; i < plan.mainShown; i++) renderUpgrade(textLines, top[i], i + 1, 'point', '', plan.stats);
      if (top.length === 0) {
        textLines.push(`None of the measured notables improves ${measured}. Try a different focus.`);
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

    // C-47: what PoB can't fully measure, over the whole measured pool, not only the ranked candidates.
    if (pool.length > 0) {
      textLines.push('', "## What PoB can't fully measure", '');
      if (cantMeasure.length === 0) {
        textLines.push("Nothing: every measured notable's lines are fully parsed, and every measurement returned a value.");
      } else {
        const kinds = (Object.keys(KINDS) as Array<keyof typeof KINDS>).filter((k) => kindsShown.has(k));
        textLines.push(
          "PoB may not apply some of these notables' lines, or measure them at all, so their gain may be missing or wrong " +
            `(check_model_coverage gives each line's status). ${kinds.map((k) => `${k}: ${KINDS[k]}`).join('. ')}.`,
          ...cantMeasure,
        );
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
