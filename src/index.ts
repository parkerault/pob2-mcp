#!/usr/bin/env node
/**
 * The entry (C-7). This is the only module that reads `process.env`, computes the path defaults,
 * installs process listeners and connects stdio. Everything below it gets its dependencies from
 * `createServer(deps)`.
 */

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { spawn } from "child_process";
import fs from "fs";
import os from "os";
import path from "path";

import { createServer, type ServerDeps } from "./server/createServer.js";
import { createCredentialGetter } from "./trade/credentials.js";
import { packageRoot } from "./utils/packageRoot.js";

/**
 * The entry's path defaults (C-7, D-16, C-16):
 * - `pobDirectory` = `POB_DIRECTORY`, else `~/Documents/Path of Building (PoE2)/Builds`;
 * - `stateDir` = `$XDG_STATE_HOME/pob2-mcp`, else `~/.local/state/pob2-mcp`.
 * An empty value counts as unset.
 */
export function entryDefaults(
  env: Readonly<Record<string, string | undefined>>,
  homeDir: string = os.homedir(),
): { pobDirectory: string; stateDir: string } {
  const pobDirectory = env.POB_DIRECTORY
    ? env.POB_DIRECTORY
    : path.join(homeDir, "Documents", "Path of Building (PoE2)", "Builds");
  const stateHome = env.XDG_STATE_HOME ? env.XDG_STATE_HOME : path.join(homeDir, ".local", "state");
  return { pobDirectory, stateDir: path.join(stateHome, "pob2-mcp") };
}

/** The package.json version (reported as the MCP server version, C-1). */
export function packageVersion(root: string = packageRoot()): string {
  const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8")) as { version?: unknown };
  if (typeof pkg.version !== "string") throw new Error(`${root}/package.json has no version`);
  return pkg.version;
}

async function main(): Promise<void> {
  const env: Record<string, string | undefined> = { ...process.env };
  const { pobDirectory, stateDir } = entryDefaults(env);

  const deps: ServerDeps = {
    version: packageVersion(),
    env,
    pobDirectory,
    stateDir,
    fetch: (input, init) => globalThis.fetch(input, init),
    spawn,
    // C-9: the trade session cookie, re-read from the env and <packageRoot>/.env on every
    // authenticated trade request (never cached, never logged).
    credentials: createCredentialGetter({ env, dotenvPath: path.join(packageRoot(), ".env") }),
  };

  const { server, shutdown } = createServer(deps);

  // stdout/stderr EPIPE: the host went away.
  process.stdout.on("error", (err: NodeJS.ErrnoException) => {
    if (err.code === "EPIPE") process.exit(0);
    else console.error("[MCP Server] stdout error:", err);
  });
  process.stderr.on("error", (err: NodeJS.ErrnoException) => {
    if (err.code === "EPIPE") process.exit(0);
  });

  // stdin EOF, SIGINT and SIGTERM: shut down (stops the watcher and luajit), then exit 0 (D-28).
  let exiting = false;
  const exit = (why: string) => {
    if (exiting) return;
    exiting = true;
    console.error(`[MCP Server] ${why}; shutting down`);
    shutdown()
      .catch((error) => console.error("[MCP Server] Error during shutdown:", error))
      .finally(() => process.exit(0));
  };

  const transport = new StdioServerTransport();
  await server.connect(transport);

  process.stdin.on("end", () => exit("stdin closed"));
  process.stdin.on("close", () => exit("stdin closed"));
  process.on("SIGINT", () => exit("SIGINT"));
  process.on("SIGTERM", () => exit("SIGTERM"));

  console.error("Path of Building PoE2 MCP Server running on stdio");
}

// Jest imports this module to unit-test `entryDefaults`; only a real launch runs the server.
if (process.env.JEST_WORKER_ID === undefined) {
  main().catch((error) => {
    console.error("[MCP Server] Fatal:", error);
    process.exit(1);
  });
}
