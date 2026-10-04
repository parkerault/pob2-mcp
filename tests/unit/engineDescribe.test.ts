/**
 * AC-F17 (Jest meta-test): engineDescribe's decision (C-18, D-17). Engine-required tests run when
 * the probe said "ok", are skipped only with POB_SKIP_ENGINE=1, and otherwise fail with the cause.
 */
import { describe, it, expect } from '@jest/globals';
import fs from 'fs';
import path from 'path';
import { makeEngineDescribe, type DescribeApi } from '../helpers/engine';

function recorder() {
  const events: string[] = [];
  const tests: Array<{ name: string; fn: () => void | Promise<void> }> = [];
  const api: DescribeApi = {
    describe: (name, fn) => {
      events.push(`describe:${name}`);
      fn();
    },
    describeSkip: (name) => {
      events.push(`skip:${name}`);
    },
    it: (name, fn) => {
      events.push(`it:${name}`);
      tests.push({ name, fn });
    },
  };
  return { api, events, tests };
}

describe('engineDescribe (C-18)', () => {
  it('AC-F17: POB_TEST_ENGINE=ok runs the block as a plain describe', () => {
    const r = recorder();
    let ran = false;
    makeEngineDescribe({ POB_TEST_ENGINE: 'ok' }, r.api)('engine', () => {
      ran = true;
    });
    expect(ran).toBe(true);
    expect(r.events).toEqual(['describe:engine']);
  });

  it('AC-F17: POB_SKIP_ENGINE=1 skips the block, whatever the probe said', () => {
    for (const verdict of [undefined, 'ok', 'vendor missing (run `mise run pob:fetch`)']) {
      const r = recorder();
      makeEngineDescribe({ POB_SKIP_ENGINE: '1', POB_TEST_ENGINE: verdict }, r.api)('engine', () => {
        throw new Error('must not run');
      });
      expect(r.events).toEqual(['skip:engine']);
    }
  });

  it.each([
    'vendor missing (run `mise run pob:fetch`)',
    'pin mismatch: manifest version 0.23.2 != pin 0.23.1',
    'luajit not found (run via `mise run test`)',
    'bridge start failed: module not found',
  ])('AC-F17: a failed probe (%s) registers one failing test carrying the cause', (cause) => {
    const r = recorder();
    makeEngineDescribe({ POB_TEST_ENGINE: cause }, r.api)('engine', () => {
      throw new Error('the real block must not run');
    });
    expect(r.tests).toHaveLength(1);
    expect(() => r.tests[0].fn()).toThrow(cause);
  });

  it('AC-F17: an unprobed run (no POB_TEST_ENGINE, no skip) fails rather than skips', () => {
    const r = recorder();
    makeEngineDescribe({}, r.api)('engine', () => undefined);
    expect(r.tests).toHaveLength(1);
    expect(() => r.tests[0].fn()).toThrow(/not probed/);
  });

  it('AC-F17: no integration test short-circuits with `if (!ready) return`', () => {
    const dir = path.resolve(__dirname, '..', 'integration');
    const offenders = fs
      .readdirSync(dir)
      .filter((f) => f.endsWith('.ts'))
      .filter((f) => /if\s*\(\s*!\s*ready\s*\)\s*return/.test(fs.readFileSync(path.join(dir, f), 'utf8')));
    expect(offenders).toEqual([]);
  });
});
