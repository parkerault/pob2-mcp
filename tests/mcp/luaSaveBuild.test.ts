/**
 * AC-E47 (WU-22): `lua_save_build`'s listing, in process (real Client and server; nothing spawned:
 * `tools/list` never touches the engine).
 */
import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { startTestServer, type TestServer } from '../helpers/server';

describe('AC-E47 (WU-22): lua_save_build is described as saving the engine build, with overwrite', () => {
  let server: TestServer;
  beforeAll(async () => {
    server = await startTestServer();
  });
  afterAll(async () => server?.close());

  it('AC-E47: save_tree is not listed; lua_save_build says it saves the engine\'s current build, including tree changes, and documents overwrite', async () => {
    const { tools } = await server.client.listTools();
    const names = tools.map((t) => t.name);
    expect(names).not.toContain('save_tree');
    const save = tools.find((t) => t.name === 'lua_save_build');
    expect(save).toBeDefined();
    const description = save?.description ?? '';
    expect(description).toMatch(/engine's current build/);
    expect(description).toMatch(/tree/);
    expect(description).toMatch(/overwrite: true/);
    const props = (save?.inputSchema as { properties?: Record<string, { type?: string; description?: string }>; required?: string[] }).properties ?? {};
    expect(props.overwrite?.type).toBe('boolean');
    expect(props.overwrite?.description).toMatch(/already exists/);
    expect(props.overwrite?.description).toMatch(/backed up/);
    expect((save?.inputSchema as { required?: string[] }).required).toEqual(['build_name']);
  });
});
