/**
 * The server's clock for deadlines and elapsed time: epoch-aligned milliseconds that never step.
 *
 * `Date.now()` follows the wall clock, which can step (backwards too: WSL2 resyncs its clock with the
 * host). A deadline or a timeout measured with it can then stretch or collapse mid-call. This clock is
 * `performance.timeOrigin + performance.now()`: monotonic, and still comparable in size with an epoch
 * time, so it can stand in wherever the code took a `now: () => number` defaulting to `Date.now`.
 * Wall-clock uses (timestamps shown to the user, file mtimes, file names, cache ages) keep `Date.now()`.
 */
export function monotonicNow(): number {
  return performance.timeOrigin + performance.now();
}
