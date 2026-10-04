/**
 * Jest setupFiles entry (C-18), run before each test file: live network is disabled (D-34).
 * Any code that reaches the global fetch gets an error naming the URL; tests route HTTP through
 * `fixtureFetch` instead.
 */
function liveNetworkDisabled(input: unknown): never {
  const url =
    typeof input === 'string'
      ? input
      : input instanceof URL
        ? input.href
        : (input as { url?: string } | undefined)?.url ?? String(input);
  throw new Error(`live network disabled in tests (D-34): ${url}`);
}

globalThis.fetch = liveNetworkDisabled as unknown as typeof globalThis.fetch;
