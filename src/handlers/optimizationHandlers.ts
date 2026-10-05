import { wrapHandler } from "../utils/errorHandling.js";
import { readAdviceSubject, renderDefenceAnalysis, type AdviceContext } from "../advice/report.js";

export type OptimizationHandlerContext = AdviceContext;

/**
 * `analyze_defenses` (FR-A1, D-51a): PoB2's defence values (EHP, physical damage reduction, evade,
 * deflect and block chance, resistances with their gaps, each type's max hit vs the configured enemy's
 * hit) and the issues `judge()` finds. `build_name` is optional: the default is the loaded build; another
 * file is loaded with `withTemporaryBuild`, so the engine's build is never replaced (D-9).
 */
export async function handleAnalyzeDefenses(
  context: OptimizationHandlerContext,
  buildName?: string
) {
  return wrapHandler('analyze defenses', async () => {
    const subject = await readAdviceSubject(context, buildName);
    return {
      content: [{ type: "text" as const, text: renderDefenceAnalysis(subject) }],
    };
  });
}
