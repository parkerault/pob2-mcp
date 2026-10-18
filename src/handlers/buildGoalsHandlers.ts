import type { PoBLuaApiClient } from "../pobLuaBridge.js";
import { wrapHandler } from "../utils/errorHandling.js";
import type { Issue } from "../advice/judge.js";
import { JUDGMENT_BASIS, judgeInputs, readAdviceInputs, renderIssueSection, showStat, showWhole } from "../advice/report.js";

export interface BuildGoalsHandlerContext {
  getLuaClient: () => PoBLuaApiClient | null;
  ensureLuaClient: () => Promise<void>;
}

/**
 * `get_build_issues` (FR-A1): the engine build's issues as `judge()` finds them, from PoB's warning
 * lines and the engine's outputs. `lua_load_build`'s "Top Issues" and `get_passive_upgrades` use the
 * same list.
 */
export async function handleGetBuildIssues(
  context: BuildGoalsHandlerContext,
): Promise<{ issues: Issue[]; stats: Record<string, unknown> }> {
  return wrapHandler('get build issues', async () => {
    await context.ensureLuaClient();
    const luaClient = context.getLuaClient();
    if (!luaClient) throw new Error('Lua bridge not active. Use lua_start and lua_load_build first.');
    const inputs = await readAdviceInputs(luaClient);
    return { issues: judgeInputs(inputs), stats: inputs.stats };
  });
}

export function formatIssuesResponse(issues: Issue[], stats: Record<string, unknown>) {
  const text = [
    '=== Build Issues ===',
    '',
    ...renderIssueSection(issues),
    '',
    '=== Current Stats (PoB2) ===',
    `Life: ${showStat(stats.Life)} | Energy Shield: ${showStat(stats.EnergyShield)} | Mana: ${showStat(stats.Mana)} | EHP: ${showWhole(stats.TotalEHP)}`,
    `Fire: ${showStat(stats.FireResist, '%')} | Cold: ${showStat(stats.ColdResist, '%')} | Lightning: ${showStat(stats.LightningResist, '%')} | Chaos: ${showStat(stats.ChaosResist, '%')}`,
    '',
    JUDGMENT_BASIS,
  ].join('\n');
  return {
    content: [{ type: 'text' as const, text }],
  };
}
