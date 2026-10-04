/**
 * AC-F13: the MCP error surface (C-1, D-27), in process (startTestServer, C-18).
 * Every handler error is an `isError: true` result; an unknown tool is JSON-RPC -32602.
 * The cases that need the engine or the pinned tree data run inside engineDescribe.
 */
import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { McpError } from '@modelcontextprotocol/sdk/types.js';
import { startTestServer, type TestServer } from '../helpers/server';
import { engineDescribe } from '../helpers/engine';

type Result = { content: Array<{ type: string; text: string }>; isError?: boolean };
const text = (r: Result) => r.content.map((c) => c.text).join('\n');

/**
 * A PoE2 build whose passive tree allocates only node ids that exist in no tree version (ids below
 * 65536, which the tree analysis would otherwise skip as cluster-jewel nodes).
 */
const INVALID_TREE_XML = `<?xml version="1.0" encoding="UTF-8"?>
<PathOfBuilding2>
  <Build level="10" className="Witch" ascendClassName="None" mainSocketGroup="1" targetVersion="0_1"/>
  <Tree activeSpec="1">
    <Spec title="Broken" treeVersion="0_3" classId="1" ascendClassId="0" nodes="2,3"/>
  </Tree>
  <Skills activeSkillSet="1"><SkillSet id="1"/></Skills>
  <Items activeItemSet="1"><ItemSet id="1"/></Items>
</PathOfBuilding2>
`;

describe('AC-F13: unknown tool is a protocol error', () => {
  let server: TestServer;
  beforeAll(async () => {
    server = await startTestServer();
  });
  afterAll(async () => {
    await server.close();
  });

  it('AC-F13: callTool("no_such_tool") rejects with McpError -32602 "Unknown tool: no_such_tool"', async () => {
    const err = await server.client.callTool({ name: 'no_such_tool', arguments: {} }).then(
      () => null,
      (e: unknown) => e,
    );
    expect(err).toBeInstanceOf(McpError);
    expect((err as McpError).code).toBe(-32602);
    expect((err as McpError).message).toContain('Unknown tool: no_such_tool');
  });
});

engineDescribe('AC-F13: tool failures are isError results', () => {
  let server: TestServer;
  let tmp: string;

  beforeAll(async () => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'pob2-mcp-ac-f13-'));
    const builds = path.join(tmp, 'builds');
    fs.mkdirSync(builds);
    fs.copyFileSync(path.join(process.env.POB_DIRECTORY!, 'grenadator.xml'), path.join(builds, 'grenadator.xml'));
    fs.writeFileSync(path.join(builds, 'invalid-tree.xml'), INVALID_TREE_XML);
    server = await startTestServer({ env: { POB_DIRECTORY: builds }, pobDirectory: builds });
  });

  afterAll(async () => {
    await server.close();
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  const call = (name: string, args: Record<string, unknown>) =>
    server.client.callTool({ name, arguments: args }, undefined, { timeout: 110_000 }) as Promise<Result>;

  it('AC-F13: lua_load_build on a nonexistent build is isError and names the build', async () => {
    const r = await call('lua_load_build', { build_name: 'no-such-build.xml' });
    expect(r.isError).toBe(true);
    expect(text(r)).toContain('no-such-build');
  }, 120_000);

  it('AC-F13: get_nearby_nodes on a tree with only invalid nodes is isError', async () => {
    const r = await call('get_nearby_nodes', { build_name: 'invalid-tree.xml' });
    expect(r.isError).toBe(true);
    expect(text(r)).toContain('invalid node(s) 2, 3');
  });

  it('AC-F13: find_path_to_node to an invalid node is isError', async () => {
    const r = await call('find_path_to_node', { build_name: 'grenadator.xml', target_node_id: '999999999' });
    expect(r.isError).toBe(true);
    expect(text(r)).toContain('999999999');
  });

  it('AC-F13: analyze_build on a build whose tree is invalid is isError', async () => {
    const r = await call('analyze_build', { build_name: 'invalid-tree.xml' });
    expect(r.isError).toBe(true);
    expect(text(r)).toContain('Invalid passive tree data');
  }, 120_000);

  it('AC-F13: delete_spec {index: 99} is isError', async () => {
    const r = await call('delete_spec', { index: 99 });
    expect(r.isError).toBe(true);
  }, 120_000);
});
