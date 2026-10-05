import type { BuildService } from "../services/buildService.js";
import type { TreeService } from "../services/treeService.js";
import type { TreeAnalysisResult } from "../types.js";
import type { HandlerContext } from "../utils/contextBuilder.js";
import type { EngineCallContext } from "../engine/session.js";
import type { SpecSummary } from "../engine/schemas.js";
import { EngineActionError, type PoBLuaApiClient } from "../pobLuaBridge.js";
import { escapeNotes, replaceNotesXml } from "../services/buildExportService.js";
import { wrapHandler } from "../utils/errorHandling.js";
import { judge, type Issue } from "../advice/judge.js";
import { ADVICE_STAT_FIELDS, JUDGMENT_BASIS, renderIssueSection } from "../advice/report.js";
export type { HandlerContext } from "../utils/contextBuilder.js";

export async function handleListBuilds(context: HandlerContext) {
  return wrapHandler('list builds', async () => {
    const builds = await context.buildService.listBuilds();
    return {
      content: [
        {
          type: "text" as const,
          text: builds.length > 0
            ? `Available builds:\n${builds.map((b, i) => `${i + 1}. ${b}`).join("\n")}`
            : "No builds found in the Path of Building directory.",
        },
      ],
    };
  });
}

/**
 * The stats `analyze_build` and `compare_builds` read from the engine, named explicitly (E7, AC-A6):
 * the comparison rows plus the advice tools' stats (`judge()`, FR-A1).
 */
const LIVE_STAT_FIELDS: readonly string[] = [
  ...new Set([
    'TotalDPS', 'CombinedDPS', 'MinionTotalDPS', 'CritChance', 'CritMultiplier',
    'Life', 'EnergyShield', 'Mana', 'TotalEHP',
    'FireResist', 'ColdResist', 'LightningResist', 'ChaosResist',
    ...ADVICE_STAT_FIELDS,
  ]),
];

/** What the engine computes for one build file, loaded temporarily (D-9). */
interface LiveBuildData {
  info: Awaited<ReturnType<PoBLuaApiClient['getBuildInfo']>> | null;
  stats: Record<string, any>;
  specs: SpecSummary[];
  itemSets: Array<{ id: number | string; title?: string; active?: boolean }>;
  /** `judge()`'s issues for the file (FR-A1), when asked for. */
  issues?: Issue[];
}

/**
 * Load a build file into the engine temporarily (`withTemporaryBuild`, D-9) and read what PoB2
 * computes for it. The engine's working build, `revision` and `loaded` are put back unchanged, also on
 * failure. An engine refusal (`EngineActionError`: the file doesn't load, a stat read fails) returns the
 * reason instead, so the caller can still report the file; anything else (the engine died, the
 * working build could not be put back) propagates.
 */
async function readLive(
  engine: EngineCallContext,
  xml: string,
  opts: { judge?: boolean } = {},
): Promise<LiveBuildData | { unavailable: string }> {
  try {
    return await engine.withTemporaryBuild(xml, async () => {
      const client = engine.client;
      const info = await client.getBuildInfo();
      // PoB's warnings first: get_warnings refreshes PoB's stat list (and puts the level back).
      const warnings = opts.judge ? await client.getWarnings() : [];
      const { _meta: _ignored, ...stats } = (await client.getStats([...LIVE_STAT_FIELDS])) ?? {};
      const specs = (await client.listSpecs())?.specs ?? [];
      const itemSets = ((await client.listItemSets())?.itemSets ?? []) as LiveBuildData['itemSets'];
      const issues = opts.judge ? judge(stats, warnings, await client.getItems()) : undefined;
      return { info, stats: stats as Record<string, any>, specs, itemSets, issues };
    });
  } catch (error) {
    if (error instanceof EngineActionError) return { unavailable: error.message };
    throw error;
  }
}

function isLive(data: LiveBuildData | { unavailable: string } | null): data is LiveBuildData {
  return data !== null && !('unavailable' in data);
}

/**
 * `analyze_build` (D-9): the file's own analysis (summary, configuration, flasks, jewels, tree,
 * validation) plus the stats PoB2 computes for that file, read with `withTemporaryBuild`, so the
 * engine's working build is never replaced.
 */
export async function handleAnalyzeBuild(context: HandlerContext, buildName: string) {
  return wrapHandler('analyze build', async () => {
  const build = await context.buildService.readBuild(buildName);

  // Live stats for this file: loaded temporarily, the working build put back (D-9).
  let live: LiveBuildData | { unavailable: string } | null = null;
  if (context.engine) {
    const engine = context.engine();
    const file = await context.buildService.readBuildFile(buildName);
    live = await readLive(engine, file.bytes.toString('utf8'), { judge: true });
  }

  const specContextLines: string[] = [];
  if (isLive(live)) {
    const activeSpec = live.specs.find((s) => s.active);
    const activeItemSet = live.itemSets.find((s) => s.active);
    const numSpecs = live.specs.length;
    const numSets = live.itemSets.length;
    const parts: string[] = [];
    if (activeSpec && numSpecs > 1) {
      parts.push(`Spec ${activeSpec.index}/${numSpecs}: "${activeSpec.title}" (${activeSpec.pointsUsed} points)`);
    }
    if (activeItemSet && numSets > 1) {
      parts.push(`Item Set ${activeItemSet.id}/${numSets}: "${activeItemSet.title ?? ''}"`);
    }
    if (parts.length > 0) {
      specContextLines.push(`[Analyzing the file's saved active sets: ${parts.join(' | ')}]`);
    }
  }

  const summaryParts: string[] = [context.buildService.generateBuildSummary(build)];

  // Show active spec/item set context when multiple exist
  if (specContextLines.length > 0) {
    summaryParts.push('\n' + specContextLines.join('\n'));
  }

  const luaStats = isLive(live) ? live.stats : null;
  if (luaStats) {
    const show = (v: unknown) => (v === undefined || v === null || v === '' ? 'N/A' : String(v));
    summaryParts.push([
      '\n=== Live Calculated Stats (PoB2 engine, this file) ===',
      '',
      `Total DPS: ${show(luaStats.TotalDPS)}`,
      `Combined DPS: ${show(luaStats.CombinedDPS)}`,
      `Life: ${show(luaStats.Life)}`,
      `Energy Shield: ${show(luaStats.EnergyShield)}`,
      `Effective Health Pool: ${show(luaStats.TotalEHP)}`,
      '',
    ].join('\n'));
  } else if (live && 'unavailable' in live) {
    summaryParts.push(`\n=== Live Calculated Stats ===\n\nThe PoB2 engine could not compute this file: ${live.unavailable}`);
  }

  // Add configuration analysis
  try {
    const config = context.buildService.parseConfiguration(build);
    if (config) {
      summaryParts.push("\n" + context.buildService.formatConfiguration(config));
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    summaryParts.push(`\n=== Configuration ===\n\nConfiguration parsing error: ${errorMsg}`);
  }

  // Add flask analysis
  try {
    const flaskAnalysis = context.buildService.parseFlasks(build);
    if (flaskAnalysis) {
      summaryParts.push("\n" + context.buildService.formatFlaskAnalysis(flaskAnalysis));
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    summaryParts.push(`\n=== Flask Setup ===\n\nFlask parsing error: ${errorMsg}`);
  }

  // Add jewel analysis
  try {
    const jewelAnalysis = context.buildService.parseJewels(build);
    if (jewelAnalysis) {
      summaryParts.push("\n" + context.buildService.formatJewelAnalysis(jewelAnalysis));
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    summaryParts.push(`\n=== Jewel Setup ===\n\nJewel parsing error: ${errorMsg}`);
  }

  // Add tree analysis (the file's saved active spec)
  try {
    const treeAnalysis = await context.treeService.analyzePassiveTree(build);
    if (treeAnalysis) {
      summaryParts.push(formatTreeAnalysis(treeAnalysis));
    } else {
      summaryParts.push("\n=== Passive Tree ===\n\nNo passive tree data found in this build.");
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    if (errorMsg.includes("Invalid passive tree data detected")) {
      // An invalid tree fails the whole analysis (an MCP tool error, C-1)
      throw error;
    } else {
      // For other errors, show notice but continue with other sections
      summaryParts.push([
        '\n=== Passive Tree ===',
        '',
        `Passive tree analysis unavailable: ${errorMsg}`,
        'Other build sections are still available above.',
      ].join('\n'));
    }
  }

  // Build validation (at the end, after all data sections): judge() on what PoB2 computes for the
  // file (FR-A1), the same judgments as validate_build.
  if (isLive(live) && live.issues) {
    summaryParts.push(['\n=== Build Validation (PoB2) ===', '', ...renderIssueSection(live.issues), '', JUDGMENT_BASIS].join('\n'));
  } else {
    summaryParts.push('\n=== Build Validation (PoB2) ===\n\nNot available: validation judges what the PoB2 engine computes for the file.');
  }

  return {
    content: [
      {
        type: "text" as const,
        text: summaryParts.join('\n'),
      },
    ],
  };
  });
}

/**
 * `compare_builds` (D-9): both files are loaded into the engine temporarily, one after the other
 * (`withTemporaryBuild`), and compared on what PoB2 computes; the engine's working build is put back
 * after each. If the engine can't compute a file, the comparison falls back to the files' saved stats.
 */
export async function handleCompareBuilds(context: HandlerContext, build1Name: string, build2Name: string) {
  return wrapHandler('compare builds', async () => {

  let r1: (LiveBuildData & { name: string }) | null = null;
  let r2: (LiveBuildData & { name: string }) | null = null;
  let unavailable: string | null = null;
  if (context.engine) {
    const engine = context.engine();
    const f1 = await context.buildService.readBuildFile(build1Name);
    const f2 = await context.buildService.readBuildFile(build2Name);
    const l1 = await readLive(engine, f1.bytes.toString('utf8'));
    const l2 = isLive(l1) ? await readLive(engine, f2.bytes.toString('utf8')) : null;
    if (isLive(l1) && isLive(l2)) {
      r1 = { ...l1, name: f1.rel };
      r2 = { ...l2, name: f2.rel };
    } else {
      const failed = !isLive(l1) ? { rel: f1.rel, why: (l1 as { unavailable: string }).unavailable } : { rel: f2.rel, why: (l2 as { unavailable: string }).unavailable };
      unavailable = `the PoB2 engine could not compute ${failed.rel}: ${failed.why}`;
    }
  }

  if (r1 && r2) {
    const fmtNum = (n: any) =>
      n != null && !isNaN(Number(n)) && Number(n) !== 0
        ? Math.round(Number(n)).toLocaleString()
        : 'N/A';

    const row = (label: string, v1: any, v2: any, higherIsBetter = true) => {
      const n1 = Number(v1 || 0);
      const n2 = Number(v2 || 0);
      const winner = n1 === n2 ? '  ='
        : (n1 > n2) === higherIsBetter ? '  ▲1' : '  ▲2';
      return `  ${label.padEnd(22)}${fmtNum(v1).padStart(12)}  vs  ${fmtNum(v2).padStart(12)}${winner}`;
    };
    const describe = (r: LiveBuildData & { name: string }, n: number): string[] => {
      const spec = r.specs.find((s) => s.active) ?? r.specs[0];
      const itemSet = r.itemSets.find((s) => s.active) ?? r.itemSets[0];
      const ascend = r.info?.ascendClassName && r.info.ascendClassName !== 'None' ? ` / ${r.info.ascendClassName}` : '';
      return [
        `Build ${n}: ${r.name}`,
        `  Class:    ${r.info?.className ?? 'Unknown'}${ascend}, level ${r.info?.level ?? '?'}`,
        spec ? `  Spec:     "${spec.title}" (${spec.pointsUsed} points, saved active)` : '  Spec:     none',
        itemSet ? `  Item Set: "${itemSet.title ?? ''}" (saved active)` : '  Item Set: none',
      ];
    };

    const s1 = r1.stats;
    const s2 = r2.stats;

    const lines: string[] = [
      '=== Build Comparison (Live Stats) ===',
      '',
      ...describe(r1, 1),
      '',
      ...describe(r2, 2),
      '',
      `Level: ${r1.info?.level ?? '?'} vs ${r2.info?.level ?? '?'}`,
      '',
      `${'Stat'.padEnd(24)}${'Build 1'.padStart(12)}       ${'Build 2'.padStart(12)}`,
      '-'.repeat(60),
    ];

    // Defenses
    lines.push(row('Life', s1.Life, s2.Life));
    lines.push(row('Energy Shield', s1.EnergyShield, s2.EnergyShield));
    lines.push(row('Total EHP', s1.TotalEHP, s2.TotalEHP));
    lines.push(row('Mana', s1.Mana, s2.Mana));
    lines.push('');

    // Offense
    const dps1 = s1.CombinedDPS || s1.TotalDPS || s1.MinionTotalDPS;
    const dps2 = s2.CombinedDPS || s2.TotalDPS || s2.MinionTotalDPS;
    lines.push(row('DPS (combined)', dps1, dps2));
    lines.push(row('Crit Chance %', s1.CritChance, s2.CritChance));
    // PoB's CritMultiplier is a factor (2.24 = 224 %).
    const asPercent = (v: unknown) => (typeof v === 'number' ? v * 100 : v);
    lines.push(row('Crit Multi %', asPercent(s1.CritMultiplier), asPercent(s2.CritMultiplier)));
    lines.push('');

    // Resists
    lines.push(row('Fire Resist %', s1.FireResist, s2.FireResist));
    lines.push(row('Cold Resist %', s1.ColdResist, s2.ColdResist));
    lines.push(row('Lightning Res %', s1.LightningResist, s2.LightningResist));
    lines.push(row('Chaos Resist %', s1.ChaosResist, s2.ChaosResist));
    lines.push('');
    lines.push("The engine's working build is unchanged.");

    return { content: [{ type: 'text' as const, text: lines.join('\n') }] };
  }

  // The files' saved stats (the engine could not compute one of them).
  const build1 = await context.buildService.readBuild(build1Name);
  const build2 = await context.buildService.readBuild(build2Name);

  const compLines: string[] = [
    '=== Build Comparison (XML / saved stats) ===',
    '',
    ...(unavailable ? [`Live stats unavailable: ${unavailable}`, ''] : []),
    `Build 1: ${build1Name}`,
    `Build 2: ${build2Name}`,
    '',
    `Class: ${build1.Build?.className} vs ${build2.Build?.className}`,
    `Ascendancy: ${build1.Build?.ascendClassName} vs ${build2.Build?.ascendClassName}`,
    `Level: ${build1.Build?.level ?? '?'} vs ${build2.Build?.level ?? '?'}`,
    '',
    '=== Key Stats Comparison ===',
  ];

  const stats1 = build1.Build?.PlayerStat;
  const stats2 = build2.Build?.PlayerStat;
  if (stats1 && stats2) {
    const arr1 = Array.isArray(stats1) ? stats1 : [stats1];
    const arr2 = Array.isArray(stats2) ? stats2 : [stats2];
    const map2 = new Map(arr2.map(s => [s.stat, s.value]));
    for (const { stat, value } of arr1) {
      const v2 = map2.get(stat);
      if (v2) compLines.push(`${stat}: ${value} vs ${v2}`);
    }
  }

  return { content: [{ type: 'text' as const, text: compLines.join('\n') }] };
  });
}

export async function handleGetBuildStats(context: HandlerContext, buildName: string) {
  return wrapHandler('get build stats', async () => {
  const build = await context.buildService.readBuild(buildName);

  const statsLines: string[] = [`=== Stats for ${buildName} ===`, ''];

  if (build.Build?.PlayerStat) {
    const stats = Array.isArray(build.Build.PlayerStat)
      ? build.Build.PlayerStat
      : [build.Build.PlayerStat];

    for (const stat of stats) {
      statsLines.push(`${stat.stat}: ${stat.value}`);
    }
  } else {
    statsLines.push('No stats found in build.');
  }

  return {
    content: [
      {
        type: "text" as const,
        text: statsLines.join('\n'),
      },
    ],
  };
  });
}

export async function handleGetBuildNotes(context: HandlerContext, buildName: string) {
  return wrapHandler('get build notes', async () => {
    const build = await context.buildService.readBuild(buildName);
    const notes = build.Notes ?? '';
    return {
      content: [{
        type: 'text' as const,
        text: notes
          ? `=== Notes: ${buildName} ===\n\n${notes}`
          : `No notes found in ${buildName}.`,
      }],
    };
  });
}

/**
 * `set_build_notes` (C-17, D-51c): the notes are replaced in the file's XML and written through the
 * build-file writer (`kind: 'text'`): the previous file is backed up, and the write is refused when the
 * file changed on disk since the engine loaded or saved it. The engine's record of the file is left
 * alone, so the next engine call reloads it (clean engine) or warns (dirty engine), C-3 step 4.
 */
export async function handleSetBuildNotes(context: HandlerContext, buildName: string, notes: string) {
  return wrapHandler('set build notes', async () => {
    if (!context.buildFileWriter) throw new Error('internal error: no build-file writer');
    const file = await context.buildService.readBuildFile(buildName);
    const xml = replaceNotesXml(file.bytes.toString('utf8'), escapeNotes(notes));
    const result = await context.buildFileWriter.writeBuildFile({ name: file.rel, bytes: xml, kind: 'text' });
    return {
      content: [{
        type: 'text' as const,
        text: [
          ...result.notices,
          `✅ Notes updated in ${result.path} (${notes.length} characters).`,
          result.message,
        ].join('\n'),
      }],
    };
  });
}

function formatTreeAnalysis(analysis: TreeAnalysisResult): string {
  const lines: string[] = ['', '=== Passive Tree ==='];

  // Version warning
  if (analysis.versionMismatch) {
    lines.push(
      `\nWARNING: This build is from version ${analysis.buildVersion}.`,
      `Current passive tree data is from version ${analysis.treeVersion}.`,
      'The passive tree may have changed between these versions.'
    );
  }

  lines.push(`\nTree Version: ${analysis.treeVersion}`);
  lines.push(`Total Points: ${analysis.totalPoints} / ${analysis.availablePoints} available`);

  if (analysis.totalPoints > analysis.availablePoints) {
    lines.push(
      '\nWARNING: This build has more points allocated than available at this level.',
      'This is not possible in the actual game.'
    );
  }

  // Ascendancy nodes (separate from regular keystones/notables)
  const ascendancyNodes = analysis.allocatedNodes.filter(n => n.ascendancyName);
  if (ascendancyNodes.length > 0) {
    const ascendancyName = ascendancyNodes[0].ascendancyName;
    lines.push(`\n=== Ascendancy: ${ascendancyName} (${ascendancyNodes.length} points) ===`);
    for (const node of ascendancyNodes) {
      let line = `- ${node.name}`;
      if (node.stats && node.stats.length > 0) {
        line += `: ${node.stats.join('; ')}`;
      }
      lines.push(line);
    }
  }

  // Keystones (regular tree only)
  const regularKeystones = analysis.keystones.filter(k => !k.ascendancyName);
  if (regularKeystones.length > 0) {
    lines.push(`\nAllocated Keystones (${regularKeystones.length}):`);
    for (const keystone of regularKeystones) {
      let line = `- ${keystone.name}`;
      if (keystone.stats && keystone.stats.length > 0) {
        line += `: ${keystone.stats.join('; ')}`;
      }
      lines.push(line);
    }
  }

  // Notable passives (regular tree only)
  const regularNotables = analysis.notables.filter(n => !n.ascendancyName);
  if (regularNotables.length > 0) {
    lines.push(`\nKey Notable Passives (${regularNotables.length} total):`);
    // Show first 10 notables
    const displayNotables = regularNotables.slice(0, 10);
    for (const notable of displayNotables) {
      let line = `- ${notable.name || 'Unnamed'}`;
      if (notable.stats && notable.stats.length > 0) {
        const statSummary = notable.stats.join('; ').substring(0, 80);
        line += `: ${statSummary}`;
      }
      lines.push(line);
    }
    if (regularNotables.length > 10) {
      lines.push(`... and ${regularNotables.length - 10} more notables`);
    }
  }

  // Jewel sockets
  if (analysis.jewels.length > 0) {
    lines.push(`\nJewel Sockets: ${analysis.jewels.length} allocated`);
  }

  // Archetype
  lines.push(
    `\nDetected Archetype: ${analysis.archetype}`,
    `Confidence: ${analysis.archetypeConfidence}`,
    '[Pending user confirmation]'
  );

  // Pathing efficiency
  lines.push(
    `\nPathing Efficiency: ${analysis.pathingEfficiency}`,
    `- Total pathing nodes: ${analysis.normalNodes.length}`
  );

  // Phase 2: Optimization Suggestions
  if (analysis.optimizationSuggestions && analysis.optimizationSuggestions.length > 0) {
    lines.push('\n=== Optimization Suggestions ===');

    const highPriority = analysis.optimizationSuggestions.filter(s => s.priority === 'high');
    const mediumPriority = analysis.optimizationSuggestions.filter(s => s.priority === 'medium');
    const lowPriority = analysis.optimizationSuggestions.filter(s => s.priority === 'low');

    if (highPriority.length > 0) {
      lines.push('\nHigh Priority:');
      for (const suggestion of highPriority) {
        lines.push(`- ${suggestion.title}`);
        lines.push(`  ${suggestion.description}`);
        if (suggestion.pointsSaved) {
          lines.push(`  Potential savings: ${suggestion.pointsSaved} points`);
        }
        if (suggestion.potentialGain) {
          lines.push(`  Potential gain: ${suggestion.potentialGain}`);
        }
      }
    }

    if (mediumPriority.length > 0) {
      lines.push('\nMedium Priority:');
      for (const suggestion of mediumPriority) {
        lines.push(`- ${suggestion.title}`);
        lines.push(`  ${suggestion.description}`);
        if (suggestion.pointsSaved) {
          lines.push(`  Potential savings: ${suggestion.pointsSaved} points`);
        }
        if (suggestion.potentialGain) {
          lines.push(`  Potential gain: ${suggestion.potentialGain}`);
        }
      }
    }

    if (lowPriority.length > 0) {
      lines.push('\nAI Context for Advanced Suggestions:');
      for (const suggestion of lowPriority) {
        if (suggestion.type === 'ai-context') {
          lines.push(suggestion.description);
        }
      }
    }
  }

  return lines.join('\n');
}
