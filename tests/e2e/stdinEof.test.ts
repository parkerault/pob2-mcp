/**
 * AC-F12 (NFR-8, D-28): over real stdio (spawnServer, C-18), closing the server's stdin makes it
 * exit 0 and reap luajit, and every line it wrote to stdout is a JSON-RPC 2.0 message.
 */
import { afterAll, it, expect } from '@jest/globals';
import fs from 'fs';
import { engineDescribe } from '../helpers/engine';
import { spawnServer, type SpawnedServer } from '../helpers/spawnServer';

/** Direct children of a process, from /proc/<pid>/task/<tid>/children. */
function childPids(pid: number): number[] {
  const tasks = fs.readdirSync(`/proc/${pid}/task`);
  return tasks.flatMap((tid) => {
    try {
      return fs
        .readFileSync(`/proc/${pid}/task/${tid}/children`, 'utf8')
        .trim()
        .split(/\s+/)
        .filter(Boolean)
        .map(Number);
    } catch {
      return [];
    }
  });
}

function comm(pid: number): string {
  try {
    return fs.readFileSync(`/proc/${pid}/comm`, 'utf8').trim();
  } catch {
    return '';
  }
}

/** Process state letter from /proc/<pid>/stat, or null when the process is gone. */
function procState(pid: number): string | null {
  try {
    const stat = fs.readFileSync(`/proc/${pid}/stat`, 'utf8');
    return stat.slice(stat.lastIndexOf(')') + 2).split(' ')[0];
  } catch {
    return null;
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

engineDescribe('stdio e2e: stdin EOF shuts the server down (C-7, D-28)', () => {
  let server: SpawnedServer | null = null;

  afterAll(async () => {
    if (server) await server.close();
  });

  it('AC-F12: after lua_load_build, closing stdin exits 0 within 5 s, luajit is gone 1 s later, stdout is pure JSON-RPC', async () => {
    server = await spawnServer();
    const result = await server.client.callTool(
      { name: 'lua_load_build', arguments: { build_name: 'grenadator.xml' } },
      undefined,
      { timeout: 110_000 },
    );
    const resultText = (result.content as Array<{ text: string }>).map((c) => c.text).join('\n');
    if (result.isError) throw new Error(`lua_load_build failed: ${resultText}\n${server.stderr().slice(-3000)}`);

    const serverPid = server.child.pid!;
    const luajit = childPids(serverPid).filter((p) => /luajit/.test(comm(p)));
    expect(luajit).toHaveLength(1);
    const luajitPid = luajit[0];

    const t0 = performance.now();
    server.closeStdin();
    const exit = await Promise.race([
      server.exited,
      sleep(5000).then(() => null),
    ]);
    expect(exit).not.toBeNull();
    expect(exit!.code).toBe(0);
    expect(performance.now() - t0).toBeLessThanOrEqual(5000);

    await sleep(1000);
    const state = procState(luajitPid);
    expect(state === null || state === 'Z').toBe(true);

    expect(server.stdoutLines.length).toBeGreaterThan(0);
    for (const line of server.stdoutLines) {
      let msg: { jsonrpc?: unknown } | null = null;
      expect(() => {
        msg = JSON.parse(line);
      }).not.toThrow();
      expect(msg!.jsonrpc).toBe('2.0');
    }
  }, 150_000);
});
