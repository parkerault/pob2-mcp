/**
 * The server's deadline clock (`monotonicNow`): epoch-aligned, never decreasing, and independent of
 * the wall clock, which can step (backwards too, on WSL2). `createServer` uses it unless a test injects
 * `now`; `tests/mcp/monotonicClock.test.ts` drives it through `find_upgrades`.
 */
import { describe, it, expect, jest, afterEach } from '@jest/globals';
import { monotonicNow } from '../../src/utils/clock';

afterEach(() => {
  jest.restoreAllMocks();
});

describe('monotonicNow', () => {
  it('is epoch-aligned: within a minute of the wall clock (which may have stepped since the process started)', () => {
    expect(Math.abs(monotonicNow() - Date.now())).toBeLessThan(60_000);
  });

  it('does not follow a wall-clock step, forwards or backwards, and never decreases', () => {
    const before = monotonicNow();
    const real = Date.now.bind(Date);
    jest.spyOn(Date, 'now').mockImplementation(() => real() - 3_600_000);
    const during = monotonicNow();
    jest.spyOn(Date, 'now').mockImplementation(() => real() + 3_600_000);
    const after = monotonicNow();
    expect(during).toBeGreaterThanOrEqual(before);
    expect(after).toBeGreaterThanOrEqual(during);
    expect(after - before).toBeLessThan(1_000);
  });
});
