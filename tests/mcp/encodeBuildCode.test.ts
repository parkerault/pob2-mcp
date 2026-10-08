/**
 * AC-P20 (WU-40, C-42): `encode_build_code`, in process with no engine (kind `none`).
 *
 * The real Client, router and handler, over a private temp builds folder. Spawning luajit throws, so a
 * tool that tried to start the engine would fail here, and `session.enginePid()` stays `null`.
 * - `{build_name:"grenadator"}` returns the canonical path, the byte count and a code that decodes to
 *   the file's bytes, on one line.
 * - `../x`, `nosuch` and a file with a `<PathOfBuilding>` root are `isError`; the last names the root.
 * - `TOOL_META.encode_build_code` is `{engine:'none', group:'core'}`.
 */
import fs from 'fs';
import os from 'os';
import path from 'path';
import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { startTestServer, type TestServer } from '../helpers/server';
import { GOLDEN_XML } from '../helpers/engineSession';
import { TOOL_META } from '../../src/server/toolMeta';
import { decodePobCode } from '../../src/utils/buildCode';

interface Result {
  isError?: boolean;
  content?: Array<{ type: string; text?: string }>;
}
const textOf = (r: Result) => (r.content ?? []).map((c) => c.text ?? '').join('\n');

/** The tool's one line: `Import code for <path> (<n> bytes): <code>`. */
const LINE = /^Import code for (.+) \((\d+) bytes\): ([A-Za-z0-9_=-]+)$/;

/** A PoE1 document: PoB1's `<PathOfBuilding>` root. */
const POE1_XML = '<?xml version="1.0" encoding="UTF-8"?>\n<PathOfBuilding>\n\t<Build level="90" className="Witch"/>\n</PathOfBuilding>\n';

describe('AC-P20: encode_build_code (C-42), in process, no engine', () => {
  let tmp: string;
  let builds: string;
  let server: TestServer;
  let spawns = 0;

  beforeAll(async () => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'pob2-encode-'));
    builds = path.join(tmp, 'builds');
    fs.mkdirSync(path.join(builds, 'league'), { recursive: true });
    fs.writeFileSync(path.join(builds, 'grenadator.xml'), GOLDEN_XML, 'utf8');
    fs.writeFileSync(path.join(builds, 'league', 'Starter.xml'), GOLDEN_XML, 'utf8');
    fs.writeFileSync(path.join(builds, 'poe1.xml'), POE1_XML, 'utf8');
    // A file outside the builds folder that `../x` would reach.
    fs.writeFileSync(path.join(tmp, 'x.xml'), GOLDEN_XML, 'utf8');
    server = await startTestServer({
      pobDirectory: builds,
      stateDir: path.join(tmp, 'state'),
      env: { POB_DIRECTORY: builds, XDG_STATE_HOME: path.join(tmp, 'xdg') },
      // Kind `none`: a spawn would be a bug.
      spawn: (() => {
        spawns += 1;
        throw new Error('no engine in this test');
      }) as never,
    });
  });

  afterAll(async () => {
    await server?.close();
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  const call = (args: Record<string, unknown>) =>
    server.client.callTool({ name: 'encode_build_code', arguments: args }) as Promise<Result>;

  it('AC-P20: TOOL_META.encode_build_code is {engine:"none", group:"core"}, and the tool is listed', async () => {
    expect(TOOL_META.encode_build_code).toEqual({ engine: 'none', group: 'core' });
    const listed = (await server.client.listTools()).tools.find((t) => t.name === 'encode_build_code');
    expect(listed).toBeDefined();
    expect((listed!.inputSchema as { required?: string[] }).required).toEqual(['build_name']);
  });

  it('AC-P20: {build_name:"grenadator"} returns the canonical path, the byte count and a code that decodes to the file\'s bytes, on one line, and never starts the engine', async () => {
    const bytes = fs.readFileSync(path.join(builds, 'grenadator.xml'));
    const r = await call({ build_name: 'grenadator' });
    expect(r.isError).not.toBe(true);
    const text = textOf(r);
    expect(text.split('\n')).toHaveLength(1);
    const m = LINE.exec(text);
    expect(m).not.toBeNull();
    const [, rel, size, code] = m as RegExpExecArray;
    expect(rel).toBe('grenadator.xml');
    expect(Number(size)).toBe(bytes.length);
    expect(Buffer.from(decodePobCode(code), 'utf8').equals(bytes)).toBe(true);
    expect(server.session.enginePid()).toBeNull();
    expect(spawns).toBe(0);
  });

  it('C-42 (D-52): the name resolves to its on-disk casing, in a subfolder too', async () => {
    const r = await call({ build_name: 'LEAGUE/starter' });
    expect(r.isError).not.toBe(true);
    const m = LINE.exec(textOf(r)) as RegExpExecArray;
    expect(m).not.toBeNull();
    expect(m[1]).toBe('league/Starter.xml');
    expect(Buffer.from(decodePobCode(m[3]), 'utf8').equals(fs.readFileSync(path.join(builds, 'league', 'Starter.xml')))).toBe(true);
    expect(server.session.enginePid()).toBeNull();
  });

  it('AC-P20: "../x" (outside the builds folder) is isError', async () => {
    const r = await call({ build_name: '../x' });
    expect(r.isError).toBe(true);
    expect(textOf(r)).toMatch(/traversal/i);
    expect(textOf(r)).not.toMatch(/Import code for/);
  });

  it('AC-P20: "nosuch" (no such file) is isError and names the file', async () => {
    const r = await call({ build_name: 'nosuch' });
    expect(r.isError).toBe(true);
    expect(textOf(r)).toContain('build file not found: nosuch.xml');
  });

  it('AC-P20: a file with a <PathOfBuilding> root is isError, and the text names the root', async () => {
    const r = await call({ build_name: 'poe1.xml' });
    expect(r.isError).toBe(true);
    const text = textOf(r);
    expect(text).toContain('poe1.xml');
    expect(text).toContain('<PathOfBuilding>');
    expect(text).toContain('expected <PathOfBuilding2>');
    expect(server.session.enginePid()).toBeNull();
    expect(spawns).toBe(0);
  });

  it('C-42: a missing build_name, a file that is not UTF-8, and a file over the 16 MiB decode cap are isError', async () => {
    expect((await call({})).isError).toBe(true);
    expect(textOf(await call({}))).toContain('Missing build_name');

    fs.writeFileSync(path.join(builds, 'latin1.xml'), Buffer.concat([Buffer.from('<PathOfBuilding2><Notes>'), Buffer.from([0xe9]), Buffer.from('</Notes></PathOfBuilding2>')]));
    const latin1 = await call({ build_name: 'latin1' });
    expect(latin1.isError).toBe(true);
    expect(textOf(latin1)).toContain('latin1.xml is not UTF-8 text');

    const big = path.join(builds, 'huge.xml');
    const head = '<PathOfBuilding2><Notes>';
    const tail = '</Notes></PathOfBuilding2>';
    fs.writeFileSync(big, head + 'a'.repeat(16 * 1024 * 1024 - head.length - tail.length + 1) + tail, 'utf8');
    const huge = await call({ build_name: 'huge' });
    expect(huge.isError).toBe(true);
    expect(textOf(huge)).toContain(`huge.xml is ${16 * 1024 * 1024 + 1} bytes; an import code may decode to at most 16 MiB`);
    expect(spawns).toBe(0);
  });
});
