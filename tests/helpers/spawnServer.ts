/**
 * `spawnServer(extraEnv?, opts?)` (C-18): spawn `node <repo>/build/index.js` over stdio with an
 * explicit, safe env, and connect an SDK `Client` to it.
 *
 * The child's env is the (globalSetup-scrubbed) `process.env` minus the cookie variables, plus:
 * the temp POB_DIRECTORY and XDG_STATE_HOME, `POE_TRADE_DISABLED=true`, `POE_NINJA_DISABLED=true`,
 * `POE_TRADE_BASE=http://127.0.0.1:9/api/trade2`, then `extraEnv` (an `undefined` value removes a
 * variable). With trade disabled the server never reads `.env` or opens a trade connection.
 * The cwd is a fresh temp dir unless `opts.cwd` is given: probes never run from the repo root.
 *
 * Every line the server writes to stdout is kept in `stdoutLines` (NFR-8 checks them).
 */
import { spawn, type ChildProcessWithoutNullStreams } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';
import type { JSONRPCMessage } from '@modelcontextprotocol/sdk/types.js';

export const REPO = path.resolve(__dirname, '..', '..');
export const SERVER_ENTRY = path.join(REPO, 'build', 'index.js');

/** Variables a spawned server must never see. */
const SCRUBBED = ['POESESSID', 'POE_SESSION_ID', 'JEST_WORKER_ID'];

export interface SpawnedServer {
  child: ChildProcessWithoutNullStreams;
  client: Client;
  /** Every complete line written to the server's stdout. */
  stdoutLines: string[];
  /** The server's stderr so far. */
  stderr(): string;
  /** Resolves with the exit code and signal when the server exits. */
  exited: Promise<{ code: number | null; signal: NodeJS.Signals | null }>;
  /** Close the server's stdin (EOF), as a host does when it goes away. */
  closeStdin(): void;
  /** Tear down: close the client, end stdin, SIGKILL if still running after 5 s. */
  close(): Promise<void>;
}

/** The explicit env the server gets (exported for tests that assert it). */
export function spawnServerEnv(extraEnv: Record<string, string | undefined> = {}): Record<string, string> {
  const merged: Record<string, string | undefined> = { ...process.env };
  for (const k of SCRUBBED) delete merged[k];
  Object.assign(merged, {
    POB_DIRECTORY: process.env.POB_DIRECTORY,
    XDG_STATE_HOME: process.env.XDG_STATE_HOME,
    POE_TRADE_DISABLED: 'true',
    POE_NINJA_DISABLED: 'true',
    POE_TRADE_BASE: 'http://127.0.0.1:9/api/trade2',
  });
  Object.assign(merged, extraEnv);
  const env: Record<string, string> = {};
  for (const [k, v] of Object.entries(merged)) if (v !== undefined) env[k] = v;
  return env;
}

class ChildStdioTransport implements Transport {
  onclose?: () => void;
  onerror?: (error: Error) => void;
  onmessage?: (message: JSONRPCMessage) => void;
  private buffer = '';

  constructor(
    private child: ChildProcessWithoutNullStreams,
    private lines: string[],
  ) {}

  async start(): Promise<void> {
    this.child.stdout.setEncoding('utf8');
    this.child.stdout.on('data', (chunk: string) => {
      this.buffer += chunk;
      let idx: number;
      while ((idx = this.buffer.indexOf('\n')) >= 0) {
        const line = this.buffer.slice(0, idx).replace(/\r$/, '');
        this.buffer = this.buffer.slice(idx + 1);
        this.lines.push(line);
        try {
          this.onmessage?.(JSON.parse(line) as JSONRPCMessage);
        } catch (error) {
          this.onerror?.(error as Error);
        }
      }
    });
    this.child.on('close', () => this.onclose?.());
    this.child.stdin.on('error', (error) => this.onerror?.(error));
  }

  async send(message: JSONRPCMessage): Promise<void> {
    if (!this.child.stdin.writable) throw new Error('server stdin is closed');
    this.child.stdin.write(JSON.stringify(message) + '\n');
  }

  async close(): Promise<void> {
    if (!this.child.stdin.destroyed) this.child.stdin.end();
  }
}

export async function spawnServer(
  extraEnv: Record<string, string | undefined> = {},
  opts: { cwd?: string } = {},
): Promise<SpawnedServer> {
  if (!fs.existsSync(SERVER_ENTRY)) {
    throw new Error(`${SERVER_ENTRY} is missing: run \`pnpm build\` first (mise run test does)`);
  }
  const ownCwd = opts.cwd === undefined;
  const cwd = opts.cwd ?? fs.mkdtempSync(path.join(os.tmpdir(), 'pob2-mcp-spawn-cwd-'));
  const child = spawn(process.execPath, [SERVER_ENTRY], {
    cwd,
    env: spawnServerEnv(extraEnv),
    stdio: ['pipe', 'pipe', 'pipe'],
  });

  let stderr = '';
  child.stderr.setEncoding('utf8');
  child.stderr.on('data', (chunk: string) => {
    stderr += chunk;
  });
  const exited = new Promise<{ code: number | null; signal: NodeJS.Signals | null }>((resolve) => {
    child.once('exit', (code, signal) => resolve({ code, signal }));
  });

  const stdoutLines: string[] = [];
  const transport = new ChildStdioTransport(child, stdoutLines);
  const client = new Client({ name: 'pob2-mcp-e2e', version: '0.0.0' });
  await client.connect(transport);

  let running = true;
  void exited.then(() => {
    running = false;
  });

  return {
    child,
    client,
    stdoutLines,
    stderr: () => stderr,
    exited,
    closeStdin: () => child.stdin.end(),
    async close() {
      await client.close().catch(() => undefined);
      if (!child.stdin.destroyed) child.stdin.end();
      if (running) {
        const timer = setTimeout(() => child.kill('SIGKILL'), 5000);
        await exited;
        clearTimeout(timer);
      }
      if (ownCwd) fs.rmSync(cwd, { recursive: true, force: true });
    },
  };
}
