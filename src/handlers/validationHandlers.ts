import { wrapHandler } from "../utils/errorHandling.js";
import { readAdviceSubject, renderValidation, type AdviceContext } from "../advice/report.js";

export type ValidationHandlerContext = AdviceContext;

/**
 * `validate_build` (FR-A1): one engine-backed path. The build is judged only by `judge()`: PoB's
 * warning lines, `Missing<Elem>Resist > 0`, and per damage type the max hit taken below the configured
 * enemy's hit. No `build_name` (or the loaded build's file) judges the engine's build; another file is
 * loaded with `withTemporaryBuild`, so the engine's build is never replaced (D-9).
 */
export async function handleValidateBuild(
  context: ValidationHandlerContext,
  args?: { build_name?: string }
) {
  return wrapHandler('validate build', async () => {
    const subject = await readAdviceSubject(context, args?.build_name);
    return {
      content: [{ type: "text" as const, text: renderValidation(subject) }],
    };
  });
}
