/**
 * `engineDescribe(name, fn)` (C-18): a synchronous `describe` for engine-required tests.
 *
 * It reads `POB_TEST_ENGINE`, which the Jest globalSetup wrote after probing the engine:
 * - `ok` → a plain `describe`;
 * - `POB_SKIP_ENGINE=1` → `describe.skip`;
 * - otherwise → one failing test whose message is the cause (the engine can't run).
 * It never falls back to a sibling checkout.
 */
import { describe, it } from '@jest/globals';

type Env = Readonly<Record<string, string | undefined>>;

export interface DescribeApi {
  describe: (name: string, fn: () => void) => void;
  describeSkip: (name: string, fn: () => void) => void;
  it: (name: string, fn: () => void | Promise<void>) => void;
}

/** The decision, separated from Jest's globals so it can be unit-tested (AC-F17 meta-test). */
export function makeEngineDescribe(env: Env, api: DescribeApi) {
  return (name: string, fn: () => void): void => {
    if (env.POB_SKIP_ENGINE === '1') {
      api.describeSkip(name, fn);
      return;
    }
    const verdict = env.POB_TEST_ENGINE;
    if (verdict === 'ok') {
      api.describe(name, fn);
      return;
    }
    const cause = verdict ?? 'the engine was not probed (is the Jest globalSetup configured?)';
    api.describe(name, () => {
      api.it('engine is available', () => {
        throw new Error(`engine-required tests cannot run: ${cause}`);
      });
    });
  };
}

export function engineDescribe(name: string, fn: () => void): void {
  makeEngineDescribe(process.env, {
    describe: (n, f) => describe(n, f),
    describeSkip: (n, f) => describe.skip(n, f),
    it: (n, f) => it(n, f),
  })(name, fn);
}
