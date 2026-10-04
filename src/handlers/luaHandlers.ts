import type { PoBLuaApiClient } from "../pobLuaBridge.js";
import type { EngineCallContext, LoadedBuild } from "../engine/session.js";
import type { BuildFileWriter } from "../services/buildFileWriter.js";
import type { SpecSummary } from "../engine/schemas.js";
import { handleGetBuildIssues } from "./buildGoalsHandlers.js";
import fs from "fs/promises";
import path from "path";
import { wrapHandler } from "../utils/errorHandling.js";
import { sanitizeBuildName } from "../utils/pathSanitizer.js";

export interface LuaHandlerContext {
  pobDirectory: string;
  /** deps.fetch (C-7): import_build's share-site fetch goes through it. */
  fetch: typeof globalThis.fetch;
  getLuaClient: () => PoBLuaApiClient | null;
  ensureLuaClient: () => Promise<void>;
  /** The running engine call's context (C-3): every load and lua_stop go through it. */
  engine: () => EngineCallContext;
  /** The build the engine holds (C-3 `loaded`). */
  loadedBuild: () => LoadedBuild | null;
  /** C-17: every write into the builds folder goes through it. */
  buildFileWriter: Pick<BuildFileWriter, 'writeBuildFile'>;
}

/** `Build: <displayName>`, plus the relative path when the build came from a file (AC-E22). */
export function formatLoadedBuild(loaded: LoadedBuild | null): string {
  if (!loaded) return 'Build: (no engine running)';
  return `Build: ${loaded.displayName}${loaded.path ? ` (${loaded.path})` : ''}`;
}

export async function handleLuaStart(context: LuaHandlerContext) {
  return wrapHandler('start Lua bridge', async () => {
    await context.ensureLuaClient();

    return {
      content: [
        {
          type: "text" as const,
          text: `PoB Lua Bridge started successfully.\n\nThe PoB calculation engine is now ready to load builds and compute stats.`,
        },
      ],
    };
  });
}

export async function handleLuaStop(context: LuaHandlerContext) {
  return wrapHandler('stop Lua bridge', async () => {
    // Rule L (C-3): the session stops the engine and clears the loaded build; dirty work is named.
    const { discardedFrom } = await context.engine().stopEngine();
    let text = "PoB Lua Bridge stopped successfully.";
    if (discardedFrom) text += `\nDiscarded unsaved changes from \`${discardedFrom}\`.`;

    return {
      content: [
        {
          type: "text" as const,
          text,
        },
      ],
    };
  });
}

export async function handleLuaNewBuild(context: LuaHandlerContext, className?: string, ascendancy?: string) {
  return wrapHandler('create new build', async () => {
    await context.engine().newBuild({
      ...(className ? { className } : {}),
      ...(ascendancy ? { ascendancy } : {}),
    });

    const classDesc = className ? ` (${className}${ascendancy ? `/${ascendancy}` : ''})` : '';
    return {
      content: [
        {
          type: "text" as const,
          text: `✅ New empty build created${classDesc}.\n${formatLoadedBuild(context.loadedBuild())}`,
        },
      ],
    };
  });
}

/**
 * `lua_save_build` (C-17, D-60): the engine's current build (`export_build_xml`, root
 * `<PathOfBuilding2>`) written through the build-file writer as `kind: 'engine'`: `overwrite` to replace
 * a file (a backup is kept), the changed-on-disk guard, and `noteSaved`, which re-points the loaded build
 * on a save under a new name (Save As, D-51d).
 */
export async function handleLuaSaveBuild(context: LuaHandlerContext, buildName: string, overwrite?: boolean) {
  return wrapHandler('save build', async () => {
    if (!buildName || !buildName.trim()) {
      throw new Error('build_name is required');
    }

    const engine = context.engine();
    const xml = await engine.client.exportBuildXml();
    if (typeof xml !== 'string' || !/^\s*(<\?xml[^>]*\?>\s*)?<PathOfBuilding2[\s>/]/.test(xml)) {
      throw new Error('the engine did not export a PathOfBuilding2 build, so nothing was written');
    }
    const result = await context.buildFileWriter.writeBuildFile({
      name: buildName,
      bytes: xml,
      overwrite: overwrite === true,
      kind: 'engine',
      ctx: engine,
    });

    return {
      content: [
        {
          type: "text" as const,
          text: [
            ...result.notices,
            `✅ ${result.message}`,
            'File-based tools can now use this build.',
            formatLoadedBuild(context.loadedBuild()),
          ].join('\n'),
        },
      ],
    };
  });
}

export async function handleLuaLoadBuild(
  context: LuaHandlerContext,
  buildName?: string,
  buildXml?: string,
  name?: string
) {
  return wrapHandler('load build', async () => {
    const luaClient = context.getLuaClient();
    if (!luaClient) {
      throw new Error('Lua client not initialized');
    }

    // Loads go through the session (C-3), which records the canonical path (D-52) and fingerprint.
    let loaded: LoadedBuild;
    if (buildName) {
      loaded = await context.engine().loadFile(buildName);
    } else if (buildXml) {
      loaded = await context.engine().loadXml(buildXml, { displayName: name?.trim() || 'Imported build' });
    } else {
      throw new Error('Either build_name or build_xml must be provided');
    }
    name = loaded.displayName;

    // Check for multiple specs / item sets and inform the user (sequential — bridge is single-request)
    const extraLines: string[] = [];
    try {
      const specsResult = await luaClient.listSpecs();
      const itemSetsResult = await luaClient.listItemSets();
      if (specsResult?.specs?.length > 1) {
        extraLines.push('');
        extraLines.push(`📋 This build has ${specsResult.specs.length} passive tree specs:`);
        const maxPoints = Math.max(...specsResult.specs.map((s) => s.pointsUsed));
        for (const s of specsResult.specs) {
          const isEndgame = s.pointsUsed === maxPoints && !s.active ? ' ← likely endgame' : '';
          extraLines.push(`  ${s.active ? '▶' : ' '} ${formatSpecSummary(s)}${isEndgame}`);
        }
        // Warn if active spec is not the one with the most points spent
        const activeSpec = specsResult.specs.find((s) => s.active);
        if (activeSpec && activeSpec.pointsUsed < maxPoints) {
          const endgameSpec = specsResult.specs.find((s) => s.pointsUsed === maxPoints);
          extraLines.push(`⚠️  Active spec is a leveling tree (${activeSpec.pointsUsed} points). For endgame analysis, run: select_spec(${endgameSpec?.index})`);
        }
        extraLines.push('Use select_spec to switch specs.');
      }
      if (itemSetsResult?.itemSets?.length > 1) {
        extraLines.push('');
        extraLines.push(`🎒 This build has ${itemSetsResult.itemSets.length} item sets:`);
        for (const s of itemSetsResult.itemSets) {
          extraLines.push(`  ${s.active ? '▶' : ' '} [${s.id}] ${s.title}`);
        }
        extraLines.push('Use select_item_set to switch item sets.');
      }
    } catch {
      // Non-fatal: spec/item set info is advisory only
    }
    const extra = extraLines.length > 0 ? '\n' + extraLines.join('\n') : '';

    // Auto-context: fetch stats + top issues after successful load (sequential — bridge is single-request)
    const summaryLines: string[] = [];
    try {
      const info = await luaClient.getBuildInfo().catch(() => null);
      if (info) {
        summaryLines.push(`**${info.name || name}** | Level ${info.level} ${info.className ?? ''}${info.ascendClassName ? ` (${info.ascendClassName})` : ''}`);
      }

      const s = await luaClient.getStats(['Life', 'TotalDPS', 'CombinedDPS', 'MinionTotalDPS',
        'FireResist', 'ColdResist', 'LightningResist', 'ChaosResist', 'TotalEHP']).catch(() => null);
      if (s) {
        const dps = Number(s.CombinedDPS || s.TotalDPS || s.MinionTotalDPS || 0);
        const dpsLabel = (s.MinionTotalDPS && !s.TotalDPS) ? 'Minion DPS' : 'DPS';
        summaryLines.push(`Life: ${Number(s.Life ?? 0).toLocaleString()} | ${dpsLabel}: ${Math.round(dps).toLocaleString()} | EHP: ${Number(s.TotalEHP ?? 0).toLocaleString()}`);
        summaryLines.push(`Resists: F${s.FireResist}% C${s.ColdResist}% L${s.LightningResist}% Ch${s.ChaosResist}%`);
      }

      const issuesResult = await handleGetBuildIssues({ getLuaClient: context.getLuaClient, ensureLuaClient: async () => {} }).catch(() => null);
      if (issuesResult) {
        const { issues } = issuesResult;
        const topIssues = issues.filter((i: any) => i.severity === 'error' || i.severity === 'warning').slice(0, 3);
        if (topIssues.length > 0) {
          summaryLines.push('');
          summaryLines.push('**Top Issues:**');
          for (const issue of topIssues) {
            const icon = issue.severity === 'error' ? '🔴' : '🟡';
            summaryLines.push(`  ${icon} ${issue.message}`);
          }
        } else {
          summaryLines.push('');
          summaryLines.push('✅ No critical issues detected.');
        }
      }
    } catch { /* auto-context is best-effort */ }
    const summary = summaryLines.join('\n');

    const loadText = `✅ Build "${loaded.displayName}" loaded.\n${formatLoadedBuild(context.loadedBuild() ?? loaded)}${extra}` + (summary ? '\n---\n' + summary : '');

    return {
      content: [
        {
          type: "text" as const,
          text: loadText,
        },
      ],
    };
  });
}

export async function handleLuaGetStats(context: LuaHandlerContext, category?: string) {
  return wrapHandler('get stats', async () => {
    await context.ensureLuaClient();

    const luaClient = context.getLuaClient();
    if (!luaClient) {
      throw new Error('Lua client not initialized');
    }

    // Map category to specific fields
    let fields: string[] | undefined;
    if (category === 'offense') {
      fields = [
        'TotalDPS', 'CombinedDPS', 'TotalDot', 'TotalDotDPS', 'WithBleedDPS', 'WithIgniteDPS',
        'WithPoisonDPS', 'IgniteDPS', 'BleedDPS', 'PoisonDPS', 'AverageDamage', 'AverageBurstDamage',
        'Speed', 'HitChance', 'CritChance', 'CritMultiplier', 'PreEffectiveCritChance',
        'EffectiveCritChance', 'MainHandAccuracy', 'OffHandAccuracy', 'ManaCost', 'ManaPerSecondCost',
        'LifeCost', 'LifePerSecondCost', 'ESCost', 'ESPerSecondCost', 'RageCost',
        // Minion stats (populated for summoner builds)
        'MinionTotalDPS', 'MinionCombinedDPS', 'MinionAverageDamage', 'MinionSpeed',
        'MinionLife', 'MinionArmour', 'MinionEnergyShield',
        'MinionFireResist', 'MinionColdResist', 'MinionLightningResist', 'MinionChaosResist',
      ];
    } else if (category === 'defense') {
      fields = [
        'Life', 'LifeRegen', 'LifeRegenRecovery', 'LifeLeechGainRate', 'LifeUnreserved',
        'Mana', 'ManaRegen', 'ManaRegenRecovery', 'ManaLeechGainRate', 'ManaUnreserved',
        'EnergyShield', 'EnergyShieldRegen', 'EnergyShieldRegenRecovery', 'EnergyShieldLeechGainRate',
        'Ward', 'Armour', 'Evasion', 'EvasionChance', 'PhysicalDamageReduction',
        'BlockChance', 'SpellBlockChance', 'AttackDodgeChance', 'SpellDodgeChance',
        'FireResist', 'ColdResist', 'LightningResist', 'ChaosResist',
        'FireResistOverCap', 'ColdResistOverCap', 'LightningResistOverCap', 'ChaosResistOverCap',
        'TotalEHP', 'PhysicalMaximumHitTaken', 'FireMaximumHitTaken', 'ColdMaximumHitTaken',
        'LightningMaximumHitTaken', 'ChaosMaximumHitTaken', 'EffectiveSpellSuppressionChance'
      ];
    }
    // If category is 'all' or undefined, get all stats (fields = undefined)

    const { _meta: meta, ...stats } = await luaClient.getStats(fields);

    const textLines: string[] = ['=== PoB Calculated Stats ===', ''];
    // The active passive spec's tree version (C-5 `_meta`), not the build file's game version.
    if (meta?.treeVersion) textLines.push(`Tree Version: ${meta.treeVersion}`, '');

    if (stats && typeof stats === 'object') {
      // Filter out zero/null/undefined values to reduce noise
      const nonZero = (v: unknown) => v != null && v !== 0 && v !== '0';
      const entries = Object.entries(stats).filter(([, v]) => nonZero(v));

      // Group by offense/defense if showing all
      if (!category || category === 'all') {
        const offenseKeys = ['DPS', 'Damage', 'Speed', 'Crit', 'Hit', 'Accuracy', 'Cost'];
        const defenseKeys = ['Life', 'Mana', 'Energy', 'Shield', 'Resist', 'Block', 'Dodge', 'Evasion', 'Armour', 'Ward', 'EHP', 'Maximum', 'Regen', 'Leech', 'Recovery'];

        // Sort offense so DPS metrics appear first, then apply cap
        const offenseAll = entries.filter(([key]) => offenseKeys.some(ok => key.includes(ok)));
        offenseAll.sort(([keyA], [keyB]) => {
          const isDpsA = keyA.includes('TotalDPS') || keyA.includes('CombinedDPS') || keyA.includes('MinionTotalDPS') ? -1 : 0;
          const isDpsB = keyB.includes('TotalDPS') || keyB.includes('CombinedDPS') || keyB.includes('MinionTotalDPS') ? -1 : 0;
          return isDpsA - isDpsB;
        });
        const offense = offenseAll.slice(0, 15);
        const defenseAll = entries.filter(([key]) => defenseKeys.some(dk => key.includes(dk)));
        const defense = defenseAll.slice(0, 15);
        const other = entries.filter(([key]) => !offenseAll.some(([ok]) => ok === key) && !defenseAll.some(([dk]) => dk === key));

        if (offense.length > 0) {
          textLines.push('**Offense:**');
          for (const [key, value] of offense) {
            textLines.push(`${key}: ${value}`);
          }
          if (offenseAll.length > 15) {
            textLines.push(`  ... use category='offense' for full list (+${offenseAll.length - 15} more)`);
          }
          textLines.push('');
        }

        if (defense.length > 0) {
          textLines.push('**Defense:**');
          for (const [key, value] of defense) {
            textLines.push(`${key}: ${value}`);
          }
          if (defenseAll.length > 15) {
            textLines.push(`  ... use category='defense' for full list (+${defenseAll.length - 15} more)`);
          }
          textLines.push('');
        }

        if (other.length > 0 && other.length < 10) {
          textLines.push('**Other:**');
          for (const [key, value] of other) {
            textLines.push(`${key}: ${value}`);
          }
        }
      } else {
        // Just show the requested category, skip zeros
        const maxStats = 50;
        let shown = 0;
        for (const [key, value] of entries) {
          if (shown >= maxStats) break;
          textLines.push(`${key}: ${value}`);
          shown++;
        }

        if (entries.length > maxStats) {
          textLines.push('');
          textLines.push(`... and ${entries.length - maxStats} more stats`);
        }
      }
    } else {
      textLines.push('No stats available.');
    }
    const text = textLines.join('\n');

    return {
      content: [
        {
          type: "text" as const,
          text,
        },
      ],
    };
  });
}

const CLASS_NAMES: Record<number, string> = { 0:'Scion', 1:'Marauder', 2:'Ranger', 3:'Witch', 4:'Duelist', 5:'Templar', 6:'Shadow' };
const ASCENDANCY_NAMES: Record<number, Record<number, string>> = {
  0: {1:'Ascendant'},
  1: {1:'Juggernaut', 2:'Berserker', 3:'Chieftain'},
  2: {1:'Raider', 2:'Deadeye', 3:'Pathfinder'},
  3: {1:'Occultist', 2:'Elementalist', 3:'Necromancer'},
  4: {1:'Slayer', 2:'Gladiator', 3:'Champion'},
  5: {1:'Inquisitor', 2:'Hierophant', 3:'Guardian'},
  6: {1:'Assassin', 2:'Trickster', 3:'Saboteur'},
};

export async function handleLuaGetTree(context: LuaHandlerContext, includeNodeIds?: boolean) {
  return wrapHandler('get passive tree', async () => {
    await context.ensureLuaClient();

    const luaClient = context.getLuaClient();
    if (!luaClient) {
      throw new Error('Lua client not initialized');
    }

    const tree = await luaClient.getTree();

    const textLines: string[] = ['=== PoB Passive Tree ===', ''];

    if (tree && typeof tree === 'object') {
      textLines.push(`Tree Version: ${tree.treeVersion ?? 'Unknown'}`);
      const classId = tree.classId != null ? tree.classId : undefined;
      const className = classId != null ? CLASS_NAMES[classId] : undefined;
      textLines.push(`Class: ${className ?? 'Unknown'} (ID: ${classId ?? 'Unknown'})`);
      const ascId = tree.ascendClassId != null ? tree.ascendClassId : undefined;
      const ascName = classId != null && ascId != null && ascId > 0 ? ASCENDANCY_NAMES[classId]?.[ascId] : (ascId === 0 ? 'None' : undefined);
      textLines.push(`Ascendancy: ${ascName ?? 'Unknown'} (ID: ${ascId ?? 'Unknown'})`);

      if (tree.secondaryAscendClassId) {
        textLines.push(`Secondary Ascendancy ID: ${tree.secondaryAscendClassId}`);
      }

      if (tree.nodes && Array.isArray(tree.nodes)) {
        textLines.push(`\nAllocated Nodes: ${tree.nodes.length} nodes`);
        if (includeNodeIds) {
          textLines.push(`Node IDs: ${tree.nodes.join(', ')}`);
        } else {
          textLines.push(`Node IDs: [omitted — use include_node_ids=true to see full list]`);
        }
      }

      if (tree.masteryEffects && typeof tree.masteryEffects === 'object') {
        const effectCount = Object.keys(tree.masteryEffects).length;
        textLines.push(`\nMastery Effects: ${effectCount} selected`);
      }
    } else {
      textLines.push('No tree data available.');
    }
    const text = textLines.join('\n');

    return {
      content: [
        {
          type: "text" as const,
          text,
        },
      ],
    };
  });
}

export async function handleLuaSetTree(context: LuaHandlerContext, args: any) {
  return wrapHandler('set passive tree', async () => {
    await context.ensureLuaClient();

    const luaClient = context.getLuaClient();
    if (!luaClient) {
      throw new Error('Lua client not initialized');
    }

    if (!Array.isArray(args.nodes)) {
      throw new Error('nodes must be an array');
    }

    // If classId/ascendClassId not provided, read them from current build to preserve class
    let classId = args.classId;
    let ascendClassId = args.ascendClassId;
    let secondaryAscendClassId = args.secondaryAscendClassId;
    let treeVersion = args.treeVersion;

    if (classId === undefined || ascendClassId === undefined) {
      const currentTree = await luaClient.getTree();
      classId = classId ?? (currentTree?.classId || 0);
      ascendClassId = ascendClassId ?? (currentTree?.ascendClassId || 0);
      secondaryAscendClassId = secondaryAscendClassId ?? (currentTree?.secondaryAscendClassId || 0);
      treeVersion = treeVersion ?? currentTree?.treeVersion;
    }

    const tree = await luaClient.setTree({
      classId,
      ascendClassId,
      secondaryAscendClassId,
      nodes: (args.nodes as string[]).map(Number),
      masteryEffects: args.masteryEffects,
      treeVersion,
    });

    const actualCount = (tree && Array.isArray(tree.nodes)) ? tree.nodes.length : args.nodes.length;
    const requested = args.nodes.length;
    const dropped = requested - actualCount;
    let text = `✅ Passive tree updated. Allocated ${actualCount} nodes.`;
    if (dropped > 0) {
      text += `\n⚠️  ${dropped} of ${requested} requested nodes were dropped (not connected to start or invalid IDs).`;
      text += `\nTip: Ensure the class is set correctly and nodes form a valid connected path from the starting node.`;
    }

    const ascUsed = tree?.ascendancyPointsUsed ?? 0;
    if (ascUsed > 8) {
      text += `\n🔴 ERROR: ${ascUsed} ascendancy points used (max 8). Remove ${ascUsed - 8} ascendancy node(s).`;
    }

    return {
      content: [
        {
          type: "text" as const,
          text,
        },
      ],
    };
  });
}

export async function handleLuaGetBuildInfo(context: LuaHandlerContext) {
  return wrapHandler('get build info', async () => {
    await context.ensureLuaClient();
    const luaClient = context.getLuaClient();
    if (!luaClient) throw new Error('Lua client not initialized');

    const info = await luaClient.getBuildInfo();

    if (!info) {
      return {
        content: [{ type: "text" as const, text: "No build currently loaded. Use lua_load_build or lua_new_build first." }],
      };
    }

    const text = [
      '=== Build Info ===',
      '',
      formatLoadedBuild(context.loadedBuild()),
      `Name: ${info.name || 'Unnamed'}`,
      `Level: ${info.level ?? 'Unknown'}`,
      `Class: ${info.className || 'Unknown'}`,
      `Ascendancy: ${info.ascendClassName || 'None'}`,
      `Tree Version: ${info.treeVersion || 'Unknown'}`,
    ].join('\n');

    return {
      content: [{ type: "text" as const, text }],
    };
  });
}

export async function handleLuaReloadBuild(context: LuaHandlerContext, buildName?: string) {
  return wrapHandler('reload build', async () => {
    // Without a name, reload the file the engine's build came from (C-3 `loaded.path`).
    const current = context.loadedBuild();
    const target = buildName?.trim() || current?.path;
    if (!target) {
      throw new Error(
        `The engine's build ("${current?.displayName ?? 'none'}") did not come from a file and no build_name was provided. Use lua_load_build first.`,
      );
    }
    const loaded = await context.engine().loadFile(target);

    return {
      content: [{ type: "text" as const, text: `✅ Build "${loaded.path}" reloaded from disk.\n${formatLoadedBuild(loaded)}` }],
    };
  });
}

export async function handleUpdateTreeDelta(context: LuaHandlerContext, addNodes?: string[], removeNodes?: string[]) {
  return wrapHandler('update tree delta', async () => {
    await context.ensureLuaClient();
    const luaClient = context.getLuaClient();
    if (!luaClient) throw new Error('Lua client not initialized');

    if (!addNodes?.length && !removeNodes?.length) {
      throw new Error('At least one of add_nodes or remove_nodes must be provided.');
    }

    const params: { addNodes?: number[]; removeNodes?: number[] } = {};
    if (addNodes?.length)    params.addNodes    = addNodes.map(Number);
    if (removeNodes?.length) params.removeNodes = removeNodes.map(Number);

    const result = await luaClient.updateTreeDelta(params);
    const tree = result?.tree;
    const autoPathedNodes = result?.autoPathedNodes;
    const skippedAsc = result?.skippedAscendancyNodes;

    const actualCount = Array.isArray(tree?.nodes) ? tree.nodes.length : '?';
    const addedCount  = addNodes?.length ?? 0;
    const removedCount = removeNodes?.length ?? 0;

    let text = `✅ Tree delta applied.\n`;
    if (addedCount)    text += `  Added: ${addedCount} node(s)\n`;
    if (removedCount)  text += `  Removed: ${removedCount} node(s)\n`;
    text += `  Total allocated: ${actualCount} nodes\n`;

    if (autoPathedNodes && autoPathedNodes.length > 0) {
      text += `\n🔗 Auto-pathed ${autoPathedNodes.length} intermediate node(s) to maintain connectivity.`;
    }

    if (skippedAsc && skippedAsc.length > 0) {
      text += `\n🔴 BLOCKED: ${skippedAsc.length} ascendancy node(s) skipped — would exceed 8-point ascendancy cap (IDs: ${skippedAsc.join(', ')}).`;
    }

    if (addedCount > 0 && !autoPathedNodes?.length && !skippedAsc?.length) {
      text += `\n⚠️  If total count is lower than expected, some nodes may have been dropped (not connected or invalid IDs).`;
    }

    const ascUsed = tree?.ascendancyPointsUsed ?? 0;
    if (ascUsed > 8) {
      text += `\n🔴 ERROR: ${ascUsed} ascendancy points used (max 8). Remove ${ascUsed - 8} ascendancy node(s).`;
    }

    return {
      content: [{ type: "text" as const, text }],
    };
  });
}

export async function handleSearchTreeNodes(
  context: LuaHandlerContext,
  keyword: string,
  nodeType?: string,
  maxResults?: number,
  includeAllocated?: boolean
) {
  return wrapHandler('search tree nodes', async () => {
    await context.ensureLuaClient();

    const luaClient = context.getLuaClient();
    if (!luaClient) {
      throw new Error('Lua client not initialized. Use lua_start first.');
    }

    if (!keyword || String(keyword).trim().length === 0) {
      throw new Error(`keyword/query cannot be empty (received: ${JSON.stringify(keyword)})`);
    }

    // Limit results to prevent large responses
    const effectiveMaxResults = Math.min(maxResults || 20, 30); // Default 20, max 30

    const results = await luaClient.searchNodes({
      keyword: keyword.trim(),
      nodeType,
      maxResults: effectiveMaxResults,
      includeAllocated,
    });

    const textLines: string[] = ['=== Passive Tree Node Search ===', ''];
    textLines.push(`Searching for: "${keyword}"`);
    if (nodeType) {
      textLines.push(`Node type filter: ${nodeType}`);
    }
    textLines.push('');

    if (!results.nodes || results.nodes.length === 0) {
      textLines.push('No matching nodes found.', '');
      textLines.push('Tips:');
      textLines.push('- Try a shorter or more general keyword');
      textLines.push('- Check spelling');
      textLines.push('- Remove the node type filter to see more results');
    } else {
      let countLine = `Found ${results.count} matching node${results.count === 1 ? '' : 's'}`;
      if (results.count >= effectiveMaxResults) {
        countLine += ` (showing top ${effectiveMaxResults})`;
      }
      countLine += ':';
      textLines.push(countLine, '');

      for (const node of results.nodes) {
        const allocatedTag = node.allocated ? " [ALLOCATED]" : "";
        const typeTag = node.type !== 'normal' ? ` [${node.type.toUpperCase()}]` : "";

        textLines.push(`**${node.name}**${typeTag}${allocatedTag}`);
        textLines.push(`  Node ID: ${node.id}`);

        if (node.ascendancyName) {
          textLines.push(`  Ascendancy: ${node.ascendancyName}`);
        }

        if (node.stats && node.stats.length > 0) {
          // Limit to first 3 stats to reduce response size
          const statsToShow = node.stats.slice(0, 3);
          textLines.push('  Stats:');
          for (const stat of statsToShow) {
            textLines.push(`    - ${stat}`);
          }
          if (node.stats.length > 3) {
            textLines.push(`    - ... and ${node.stats.length - 3} more`);
          }
        }

        textLines.push('');
      }
    }
    const text = textLines.join('\n');

    return {
      content: [
        {
          type: "text" as const,
          text,
        },
      ],
    };
  });
}

export async function handleListGems(
  context: LuaHandlerContext,
  opts: { type?: "active" | "support"; search?: string; tag?: string; maxResults?: number; dedupeByName?: boolean } = {}
) {
  return wrapHandler('list gems', async () => {
    await context.ensureLuaClient();
    const luaClient = context.getLuaClient();
    if (!luaClient) {
      throw new Error('Lua client not initialized. Use lua_start first.');
    }

    const effectiveMax = Math.min(opts.maxResults || 60, 200);
    const result = await luaClient.listGems({
      type: opts.type,
      search: opts.search,
      tag: opts.tag,
      maxResults: effectiveMax,
      dedupeByName: opts.dedupeByName,
    });

    const lines: string[] = ['=== PoE2 Gem Database (from PoB engine) ==='];
    const filters: string[] = [];
    if (opts.type) filters.push(`type=${opts.type}`);
    if (opts.search) filters.push(`search="${opts.search}"`);
    if (opts.tag) filters.push(`tag=${opts.tag}`);
    lines.push(filters.length ? `Filters: ${filters.join(', ')}` : 'Filters: none');

    if (!result.gems || result.gems.length === 0) {
      lines.push('', 'No matching gems found. Try a broader search or remove filters.');
      return { content: [{ type: "text" as const, text: lines.join('\n') }] };
    }

    let countLine = `Showing ${result.count} of ${result.total} matching gem${result.total === 1 ? '' : 's'}`;
    if (result.total > result.count) countLine += ` (raise maxResults to see more)`;
    lines.push(countLine, '');

    for (const g of result.gems) {
      const reqs = [
        g.reqStr ? `Str ${g.reqStr}` : null,
        g.reqDex ? `Dex ${g.reqDex}` : null,
        g.reqInt ? `Int ${g.reqInt}` : null,
      ].filter(Boolean).join(', ');
      lines.push(`**${g.name}** [${g.kind}${g.gemType ? `/${g.gemType}` : ''}]`);
      if (g.tags) lines.push(`  Tags: ${g.tags}`);
      if (g.gemFamily) lines.push(`  Family: ${g.gemFamily}`);
      const meta: string[] = [];
      if (g.maxLevel) meta.push(`max level ${g.maxLevel}`);
      if (reqs) meta.push(`reqs: ${reqs}`);
      if (meta.length) lines.push(`  ${meta.join(' | ')}`);
      lines.push('');
    }

    return { content: [{ type: "text" as const, text: lines.join('\n') }] };
  });
}

export async function handleImportBuild(
  context: LuaHandlerContext,
  source: string,
  saveAs?: string
) {
  return wrapHandler('import build', async () => {
    if (!source || !source.trim()) {
      throw new Error("Provide a PoB2 export code or a pobb.in/pastebin link as 'source'.");
    }
    const luaClient = context.getLuaClient();
    if (!luaClient) throw new Error('Lua client not initialized. Use lua_start first.');

    // Validate save_as before the load: once the engine holds the import, a bad name can no longer
    // fail the call without the previous build already being gone.
    const fileName = saveAs ? (/\.xml$/i.test(saveAs) ? saveAs : `${saveAs}.xml`) : null;
    const savePath = fileName ? sanitizeBuildName(fileName, context.pobDirectory) : null;

    const { resolveBuildXml } = await import('../utils/buildCode.js');
    const xml = await resolveBuildXml(source, context.fetch);

    const name = saveAs ? (saveAs.replace(/\.xml$/i, '').split(/[/\\]/).pop() || 'Imported build') : 'Imported build';
    await context.engine().loadXml(xml, { displayName: name });
    const info = await luaClient.getBuildInfo();
    let skillGroups = 0;
    try { skillGroups = ((await luaClient.getSkills())?.groups || []).length; } catch { /* non-fatal */ }

    const lines: string[] = ['=== Build Imported ===', ''];
    lines.push(`Class: ${info?.className ?? 'Unknown'}${info?.ascendClassName && info.ascendClassName !== 'None' ? ` (${info.ascendClassName})` : ''}`);
    lines.push(`Level: ${info?.level ?? '?'}`);
    if (info?.treeVersion) lines.push(`Tree version: ${info.treeVersion}`);
    lines.push(`Socket groups: ${skillGroups}`);

    // Optionally persist to POB_DIRECTORY so file-based tools (analyze_build, etc.) can use it.
    if (fileName && savePath) {
      await fs.mkdir(path.dirname(savePath), { recursive: true });
      await fs.writeFile(savePath, xml, 'utf8');
      lines.push('', `Saved to: ${fileName} (in your builds directory)`);
    }

    lines.push('', 'The build is loaded in the engine. Try: analyze_skills, suggest_supports, analyze_defenses, validate_build, lua_get_stats.');
    return { content: [{ type: "text" as const, text: lines.join('\n') }] };
  });
}

export async function handleGetClasses(context: LuaHandlerContext) {
  return wrapHandler('get classes', async () => {
    await context.ensureLuaClient();
    const luaClient = context.getLuaClient();
    if (!luaClient) throw new Error('Lua client not initialized. Use lua_start first.');

    const { classes } = await luaClient.getClasses();
    const lines: string[] = ['=== PoE2 Classes & Ascendancies (from PoB engine) ===', ''];
    lines.push('Use classId / ascendancy id with lua_set_tree.', '');
    for (const c of classes) {
      lines.push(`classId ${c.classId}: **${c.name}**`);
      if (c.ascendancies.length === 0) {
        lines.push('    (no ascendancies)');
      } else {
        for (const a of c.ascendancies) {
          lines.push(`    ascendancy ${a.id}: ${a.name}`);
        }
      }
    }
    return { content: [{ type: "text" as const, text: lines.join('\n') }] };
  });
}

/** `[index] title — Class/Ascendancy, N points` for one `list_specs` entry. */
export function formatSpecSummary(s: SpecSummary): string {
  return `[${s.index}] ${s.title} — ${s.className || 'Unknown'}/${s.ascendClassName || 'None'}, ${s.pointsUsed} points`;
}

export async function handleCreateSpec(context: LuaHandlerContext, title?: string, copyFrom?: number, activate?: boolean) {
  return wrapHandler('create spec', async () => {
    await context.ensureLuaClient();
    const luaClient = context.getLuaClient();
    if (!luaClient) throw new Error('Lua client not initialized');
    const params: { title?: string; copyFrom?: number; activate?: boolean } = {};
    if (title != null) params.title = title;
    if (copyFrom != null) params.copyFrom = copyFrom;
    if (activate != null) params.activate = activate;
    const created = await luaClient.createSpec(params);
    const { specs } = await luaClient.listSpecs();
    const newSpec = specs.find((s) => s.index === created.index);
    let text = `✅ Created new spec ${newSpec ? formatSpecSummary(newSpec) : `[${created.index}] ${created.title}`}.`;
    if (created.activated) text += '\nThis spec is now active.';
    text += `\n\nTotal specs: ${specs.length}. Use list_specs to see all, select_spec to switch.`;
    return { content: [{ type: "text" as const, text }] };
  });
}

export async function handleListSpecs(context: LuaHandlerContext) {
  return wrapHandler('list specs', async () => {
  await context.ensureLuaClient();
  const luaClient = context.getLuaClient();
  if (!luaClient) throw new Error('Lua client not initialized');
  const result = await luaClient.listSpecs();
  if (!result.specs.length) {
    return { content: [{ type: "text" as const, text: `No specs found. Load a build first.` }] };
  }
  const textLines: string[] = [`=== Passive Tree Specs (${result.specs.length} total) ===`, ''];
  for (const s of result.specs) {
    textLines.push(`${s.active ? '▶' : ' '} [${s.index}] ${s.title}`);
    textLines.push(`      Class: ${s.className || 'Unknown'} / ${s.ascendClassName || 'None'}`);
    textLines.push(`      Points: ${s.pointsUsed}  |  Tree: ${s.treeVersion}`);
  }
  textLines.push(`\nActive: Spec ${result.activeSpec}. Use select_spec to switch.`);
  const text = textLines.join('\n');
  return { content: [{ type: "text" as const, text }] };
  });
}

export async function handleSelectSpec(context: LuaHandlerContext, index: number) {
  return wrapHandler('select spec', async () => {
  await context.ensureLuaClient();
  const luaClient = context.getLuaClient();
  if (!luaClient) throw new Error('Lua client not initialized');
  const selected = await luaClient.selectSpec(index);
  const { specs } = await luaClient.listSpecs();
  const active = specs.find((s) => s.index === selected.activeSpec);
  let text = `✅ Switched to Spec ${selected.activeSpec}`;
  text += active ? ` — ${formatSpecSummary(active)}` : ` — ${selected.title}`;
  text += `.\n\nStats have been recalculated for this spec.`;
  return { content: [{ type: "text" as const, text }] };
  });
}

export async function handleDeleteSpec(context: LuaHandlerContext, index: number) {
  return wrapHandler('delete spec', async () => {
    await context.ensureLuaClient();
    const luaClient = context.getLuaClient();
    if (!luaClient) throw new Error('Lua client not initialized');
    const result = await luaClient.deleteSpec(index);
    let text = `✅ Deleted spec ${result.deleted}. ${result.remaining} spec(s) remaining.`;
    text += `\n\nActive: Spec ${result.activeSpec}. Use list_specs to see all.`;
    return { content: [{ type: "text" as const, text }] };
  });
}

export async function handleRenameSpec(context: LuaHandlerContext, index: number, title: string) {
  return wrapHandler('rename spec', async () => {
    await context.ensureLuaClient();
    const luaClient = context.getLuaClient();
    if (!luaClient) throw new Error('Lua client not initialized');
    const result = await luaClient.renameSpec(index, title);
    const text = `✅ Spec ${result.index} renamed to "${result.title}".`;
    return { content: [{ type: "text" as const, text }] };
  });
}

export async function handleListItemSets(context: LuaHandlerContext) {
  return wrapHandler('list item sets', async () => {
  await context.ensureLuaClient();
  const luaClient = context.getLuaClient();
  if (!luaClient) throw new Error('Lua client not initialized');
  const result = await luaClient.listItemSets();
  if (!result.itemSets.length) {
    return { content: [{ type: "text" as const, text: "No item sets found. Load a build first." }] };
  }
  const textLines: string[] = [`=== Item Sets (${result.itemSets.length} total) ===`, ''];
  for (const s of result.itemSets) {
    textLines.push(`${s.active ? '▶' : ' '} [${s.id}] ${s.title}${s.active ? ' (active)' : ''}`);
  }
  textLines.push(`\nActive: Item Set ${result.activeItemSet}. Use select_item_set to switch.`);
  const text = textLines.join('\n');
  return { content: [{ type: "text" as const, text }] };
  });
}

export async function handleSelectItemSet(context: LuaHandlerContext, id: number) {
  return wrapHandler('select item set', async () => {
  await context.ensureLuaClient();
  const luaClient = context.getLuaClient();
  if (!luaClient) throw new Error('Lua client not initialized');
  const result = await luaClient.selectItemSet(id);
  const text = `✅ Switched to Item Set ${result.activeItemSet} — ${result.title}.\n\nStats have been recalculated for this item set.`;
  return { content: [{ type: "text" as const, text }] };
  });
}
