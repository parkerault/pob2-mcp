import type { PoBLuaApiClient } from "../pobLuaBridge.js";
import type { BuildService } from "../services/buildService.js";
import type { TreeService } from "../services/treeService.js";
import fs from "fs/promises";
import { analyzeDefenses, formatDefensiveAnalysis } from "../defensiveAnalyzer.js";
import { wrapHandler } from "../utils/errorHandling.js";
import { sanitizeBuildName } from "../utils/pathSanitizer.js";

export interface OptimizationHandlerContext {
  buildService: BuildService;
  treeService: TreeService;
  pobDirectory: string;
  getLuaClient: () => PoBLuaApiClient | null;
  ensureLuaClient: () => Promise<void>;
}

export async function handleAnalyzeDefenses(
  context: OptimizationHandlerContext,
  buildName?: string
) {
  return wrapHandler('analyze defenses', async () => {
    if (!buildName) {
      throw new Error('build_name is required. Please specify which build to analyze.');
    }

    await context.ensureLuaClient();

    const luaClient = context.getLuaClient();
    if (!luaClient) {
      throw new Error('Lua client not initialized.');
    }

    // Only reload from disk if a different build (or no build) is currently loaded.
    // If the same build is already loaded, preserve the current spec/item set selection.
    const requested = buildName.replace(/\.xml$/i, '');
    const basename = (n: string) => n.split(/[/\\]/).pop() ?? n;
    let needsLoad = true;
    try {
      const info = await luaClient.getBuildInfo();
      const loaded = (info?.name ?? '').replace(/\.xml$/i, '');
      // Accept exact match OR basename match (handles path prefix differences)
      if (loaded && (loaded === requested || basename(loaded) === basename(requested))) {
        needsLoad = false; // same build — keep current Lua state
      }
    } catch { /* no build loaded yet */ }

    if (needsLoad) {
      const buildPath = sanitizeBuildName(buildName, context.pobDirectory);
      const buildXml = await fs.readFile(buildPath, 'utf-8');
      await luaClient.loadBuildXml(buildXml, buildName);
    }

    // Get stats from PoB
    const stats = await luaClient.getStats();

    // Validate that we have meaningful stats (not empty/default state)
    const life = stats.Life || 0;
    if (life <= 60) {
      throw new Error(
        `Build "${buildName}" appears to be in default/empty state. The build may not have loaded correctly.`
      );
    }

    // Collect active spec / item set context for the header
    let contextHeader = `Analyzing: ${buildName}`;
    try {
      const specsResult = await luaClient.listSpecs();
      const itemSetsResult = await luaClient.listItemSets();
      const activeSpec = specsResult?.specs?.find((s: any) => s.active);
      const activeItemSet = itemSetsResult?.itemSets?.find((s: any) => s.active);
      const parts: string[] = [];
      if (activeSpec && specsResult?.specs?.length > 1) {
        parts.push(`Spec ${activeSpec.index}/${specsResult.specs.length}: "${activeSpec.title}" (${activeSpec.nodeCount} nodes)`);
      }
      if (activeItemSet && itemSetsResult?.itemSets?.length > 1) {
        parts.push(`Item Set ${activeItemSet.id}/${itemSetsResult.itemSets.length}: "${activeItemSet.title}"`);
      }
      if (parts.length > 0) {
        contextHeader += `\n[${parts.join(' | ')}]`;
      }
    } catch { /* advisory only */ }

    // Analyze defenses
    const analysis = analyzeDefenses(stats);

    let text = `${contextHeader}\n\n`;
    text += formatDefensiveAnalysis(analysis);

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

