import type { BuildService } from "../services/buildService.js";
import { appendNotesXml, type BuildExportService } from "../services/buildExportService.js";
import type { PoBLuaApiClient } from "../pobLuaBridge.js";
import type { EngineCallContext } from "../engine/session.js";
import type { ExportContext } from "../utils/contextBuilder.js";
import { xmlRootName } from "../utils/buildCode.js";
import { wrapHandler } from "../utils/errorHandling.js";

export interface ExportHandlerContext {
  buildService: BuildService;
  exportService: BuildExportService;
  luaClient?: PoBLuaApiClient;
  /** The running engine call's context (C-3): `export_build` with notes uses `withTemporaryBuild`. */
  engine?: () => EngineCallContext;
}

/**
 * `export_build` (D-9, D-42, C-17): a copy of a build file.
 *
 * - Without notes it is a **byte copy** of the source file: the engine is not touched.
 * - With notes, the notes are appended to the source's, the result is loaded with
 *   `withTemporaryBuild` (D-9), and the engine's `export_build_xml` (a `<PathOfBuilding2>` document) is
 *   written; the engine's working build, `revision` and `loaded` are put back unchanged.
 * - The output goes to `<stateDir>/exports/` by default; `output_directory` must resolve inside the
 *   builds folder (written through the build-file writer, C-17) or the state dir (D-42).
 */
export async function handleExportBuild(
  context: ExportHandlerContext,
  args: {
    build_name: string;
    output_name: string;
    output_directory?: string;
    overwrite?: boolean;
    notes?: string;
  }
) {
  return wrapHandler('export build', async () => {
  const { exportService, buildService } = context;
  if (!args.build_name) throw new Error('build_name is required');

  // Refuse a bad target before any work (D-42).
  await exportService.resolveExportTarget(args.output_directory);
  const source = await buildService.readBuildFile(args.build_name);

  // Every export is a PoE2 document (D-9): a byte copy of anything else would not be one.
  const root = xmlRootName(source.bytes.toString('utf8'));
  if (root !== 'PathOfBuilding2') {
    throw new Error(`${source.rel} is not a PoE2 build (its XML root is <${root ?? 'none'}>, expected <PathOfBuilding2>), so it was not exported`);
  }

  let bytes: Buffer;
  let how: string;
  if (args.notes !== undefined && args.notes !== '') {
    if (!context.engine) throw new Error('export_build with notes needs the engine');
    const engine = context.engine();
    const withNotes = appendNotesXml(source.bytes.toString('utf8'), args.notes);
    const xml = await engine.withTemporaryBuild(withNotes, () => engine.client.exportBuildXml());
    if (typeof xml !== 'string' || xmlRootName(xml) !== 'PathOfBuilding2') {
      throw new Error('the engine did not export a PathOfBuilding2 build, so nothing was written');
    }
    bytes = Buffer.from(xml, 'utf8');
    how = 'written by the PoB2 engine with the notes appended (the engine\'s working build is unchanged)';
  } else {
    bytes = source.bytes;
    how = 'an exact byte copy';
  }

  const result = await exportService.writeExport({
    outputName: args.output_name,
    outputDirectory: args.output_directory,
    overwrite: args.overwrite,
    bytes,
  });

  // A brief summary (not the full build, to keep the response small).
  const buildData = await buildService.readBuild(source.rel);
  const className = buildData.Build?.className || "Unknown";
  const ascendancy = buildData.Build?.ascendClassName || "None";
  const level = buildData.Build?.level || "Unknown";

  return {
    content: [
      {
        type: "text" as const,
        text:
          `${result.message}\n\n` +
          `Exported: ${className} (${ascendancy}) - Level ${level}\n` +
          `Source: ${source.rel}\n` +
          `Output: ${result.filePath} (${how})`,
      },
    ],
  };
  });
}

export async function handleSnapshotBuild(
  context: ExportHandlerContext,
  args: {
    build_name: string;
    description?: string;
    tag?: string;
  }
) {
  return wrapHandler('snapshot build', async () => {
  const { exportService, buildService } = context;

  const result = await exportService.snapshotBuild(buildService, {
    buildName: args.build_name,
    description: args.description,
    tag: args.tag,
  });

  return {
    content: [
      {
        type: "text" as const,
        text:
          `Snapshot created successfully!\n\n` +
          `Build: ${result.buildPath}\n` +
          `Snapshot ID: ${result.snapshotId}\n` +
          `Tag: ${args.tag || 'snapshot'}\n` +
          `Location: ${result.snapshotPath}\n\n` +
          `You can restore this snapshot later using:\n` +
          `  restore_snapshot(build_name="${result.buildPath}", snapshot_id="${result.snapshotId}")`,
      },
    ],
  };
  });
}

export async function handleListSnapshots(
  context: ExportHandlerContext,
  args: {
    build_name: string;
    limit?: number;
    tag_filter?: string;
  }
) {
  return wrapHandler('list snapshots', async () => {
  const { exportService } = context;

  const result = await exportService.listSnapshots(args.build_name, {
    limit: args.limit,
    tagFilter: args.tag_filter,
  });

  const formatted = exportService.formatSnapshotList(result);

  return {
    content: [
      {
        type: "text" as const,
        text: `=== Snapshots for ${result.build} ===\n\n${formatted}`,
      },
    ],
  };
  });
}

/**
 * `restore_snapshot` (C-17, D-51b): the snapshot's bytes are written through the build-file writer,
 * which always backs up the current file (`<id>_before-restore.xml`) and refuses when the file changed
 * on disk since the engine loaded or saved it. `backup_current` is accepted and ignored.
 */
export async function handleRestoreSnapshot(
  context: ExportHandlerContext,
  args: {
    build_name: string;
    snapshot_id: string;
  }
) {
  return wrapHandler('restore snapshot', async () => {
  const { exportService } = context;
  if (!args.snapshot_id) throw new Error('snapshot_id is required');

  const result = await exportService.restoreSnapshot({
    buildName: args.build_name,
    snapshotId: args.snapshot_id,
  });

  const lines = [
    `Build ${result.build} restored from snapshot: ${result.tag} (${result.snapshotId})`,
    result.message,
  ];
  if (result.backupPath) lines.push(`The replaced file is backed up at: ${result.backupPath}`);

  return {
    content: [
      {
        type: "text" as const,
        text: lines.join('\n'),
      },
    ],
  };
  });
}

export async function handleExportBuildSummary(context: ExportContext) {
  return wrapHandler('export build summary', async () => {
  const luaClient = context.luaClient;
  if (!luaClient) throw new Error('Lua bridge not active. Use lua_load_build first.');

  // Lua bridge only supports one request at a time — must be sequential
  let info: any = null;
  let stats: Record<string, any> = {};
  let skills: any = null;
  let tree: any = null;

  try { info = await luaClient.getBuildInfo(); } catch { /* best effort */ }
  try {
    stats = await luaClient.getStats([
      'Life', 'EnergyShield', 'Mana', 'ManaUnreserved',
      'TotalDPS', 'CombinedDPS', 'MinionTotalDPS',
      'FireResist', 'ColdResist', 'LightningResist', 'ChaosResist',
      'Armour', 'Evasion', 'PhysicalDamageReduction', 'TotalEHP',
      'LifeRegen', 'BlockChance', 'EvadeChance', 'DeflectChance',
    ]) ?? {};
  } catch { /* best effort */ }
  try { skills = await luaClient.getSkills(); } catch { /* best effort */ }
  try { tree = await luaClient.getTree(); } catch { /* best effort */ }

  // The engine's own class and ascendancy names (the active spec's), never a PoE1 id table.
  const className = info?.className || tree?.className || 'Unknown';
  const buildName = info?.name || 'Unnamed Build';
  const level = info?.level || '?';
  const ascendName = info?.ascendClassName || tree?.ascendClassName || '';
  const ascendancy = ascendName && ascendName !== 'None' ? ascendName : '';

  const dps = Number(stats.CombinedDPS || stats.TotalDPS || stats.MinionTotalDPS || 0);
  const dpsLabel = (stats.MinionTotalDPS && !stats.TotalDPS) ? 'Minion DPS' : 'DPS';

  let output = `# ${buildName}\n\n`;
  output += `**Class:** ${className}${ascendancy ? ` (${ascendancy})` : ''}  \n`;
  output += `**Level:** ${level}\n\n`;

  output += `## Key Stats\n\n`;
  output += `| Stat | Value |\n|------|-------|\n`;
  output += `| Life | ${Number(stats.Life ?? 0).toLocaleString()} |\n`;
  if (Number(stats.EnergyShield ?? 0) > 100) {
    output += `| Energy Shield | ${Number(stats.EnergyShield).toLocaleString()} |\n`;
  }
  output += `| ${dpsLabel} | ${Math.round(dps).toLocaleString()} |\n`;
  output += `| Total EHP | ${Number(stats.TotalEHP ?? 0).toLocaleString()} |\n`;
  output += `| Fire/Cold/Light Resist | ${stats.FireResist ?? '?'}% / ${stats.ColdResist ?? '?'}% / ${stats.LightningResist ?? '?'}% |\n`;
  output += `| Chaos Resist | ${stats.ChaosResist ?? '?'}% |\n`;
  if (Number(stats.Armour ?? 0) > 0) output += `| Armour | ${Number(stats.Armour).toLocaleString()} |\n`;
  if (Number(stats.Evasion ?? 0) > 0) output += `| Evasion | ${Number(stats.Evasion).toLocaleString()} |\n`;
  if (Number(stats.BlockChance ?? 0) > 0) output += `| Block | ${stats.BlockChance}% |\n`;
  if (Number(stats.EvadeChance ?? 0) > 0) output += `| Evade Chance | ${stats.EvadeChance}% |\n`;
  if (Number(stats.DeflectChance ?? 0) > 0) output += `| Deflect Chance | ${stats.DeflectChance}% |\n`;
  output += '\n';

  // Main skill setup
  const mainGroup = skills?.groups?.find((g: any) => g.index === skills.mainSocketGroup) || skills?.groups?.[0];
  if (mainGroup) {
    const gemNames = (mainGroup.gems || []).map((g: any) => g.name || g).filter(Boolean);
    output += `## Main Skill\n\n`;
    output += `**${mainGroup.label || 'Main'}:** ${gemNames.join(' + ')}\n\n`;
  }

  // Keystone passives
  if (Array.isArray(tree?.keystones) && tree.keystones.length > 0) {
    output += `## Keystones\n\n`;
    output += tree.keystones.map((k: string) => `- ${k}`).join('\n') + '\n\n';
  }

  output += `---\n_Generated with pob-mcp-server_\n`;

  return { content: [{ type: 'text' as const, text: output }] };
  });
}
