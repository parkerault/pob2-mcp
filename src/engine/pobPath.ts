import path from "path";
import { packageRoot } from "../utils/packageRoot.js";

/** Env shape the resolvers read from (the caller passes it; nothing here reads process.env). */
export type PobPathEnv = Readonly<Record<string, string | undefined>>;

/**
 * The PathOfBuilding-PoE2 checkout's `src/` directory (C-6).
 *
 * `POB_FORK_PATH` (from the passed env) overrides it; otherwise it is the pinned checkout that
 * `mise run pob:fetch` places at `<packageRoot>/vendor/PathOfBuilding-PoE2/src`.
 * This is the only reader of `POB_FORK_PATH` in `src/`.
 */
export function resolvePobSrc(env: PobPathEnv): string {
  const override = env.POB_FORK_PATH;
  if (override && override.trim().length > 0) return override;
  return path.join(packageRoot(), "vendor", "PathOfBuilding-PoE2", "src");
}

/** The vendored Lua bridge directory (`<packageRoot>/pob-api`). */
export function resolvePobApiDir(): string {
  return path.join(packageRoot(), "pob-api");
}
