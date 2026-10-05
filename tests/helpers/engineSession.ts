/**
 * Helpers for the engine-session tests (C-3, WU-08): a private builds folder holding the golden build,
 * tool calls that return `{isError, text}`, the canonical export (AC-E16) and engine kills.
 */
import fs from 'fs';
import os from 'os';
import path from 'path';
import type { EngineSession } from '../../src/engine/session';
import { startTestServer, type TestServer } from './server';
import type { ServerDeps } from '../../src/server/createServer';

export const GOLDEN = path.resolve(__dirname, '..', 'fixtures', 'builds', 'grenadator.xml');
export const GOLDEN_XML = fs.readFileSync(GOLDEN, 'utf8');
export const CALL_TIMEOUT_MS = 120000;

export interface ToolOutcome {
  isError: boolean;
  text: string;
}

export interface SessionFixture {
  server: TestServer;
  session: EngineSession;
  builds: string;
  tmp: string;
  call(tool: string, args?: Record<string, unknown>): Promise<ToolOutcome>;
  close(): Promise<void>;
}

/** The golden XML with its character level replaced (a stand-in for a PoB2 save). */
export function goldenWithLevel(level: number): string {
  const out = GOLDEN_XML.replace(/<Build level="\d+"/, `<Build level="${level}"`);
  if (out === GOLDEN_XML && level !== 90) throw new Error('golden <Build level> not found');
  return out;
}

let mtimeBump = 0;
/** Write a build file and move its mtime to a fresh, distinct value, like a real save would. */
export function writeBuild(file: string, xml: string): void {
  fs.writeFileSync(file, xml, 'utf8');
  mtimeBump += 1;
  const t = new Date(Date.now() + mtimeBump * 2000);
  fs.utimesSync(file, t, t);
}

/** A server over a private builds folder that holds `grenadator.xml` (or the files given). */
export async function startSessionFixture(
  opts: { testActions?: boolean; files?: Record<string, string>; deps?: Partial<ServerDeps> } = {},
): Promise<SessionFixture> {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'pob2-session-'));
  const builds = path.join(tmp, 'builds');
  fs.mkdirSync(builds);
  for (const [name, xml] of Object.entries(opts.files ?? { 'grenadator.xml': GOLDEN_XML })) {
    fs.mkdirSync(path.dirname(path.join(builds, name)), { recursive: true });
    fs.writeFileSync(path.join(builds, name), xml, 'utf8');
  }
  const server = await startTestServer({
    pobDirectory: builds,
    stateDir: path.join(tmp, 'state'),
    ...(opts.deps ?? {}),
    env: {
      POB_DIRECTORY: builds,
      XDG_STATE_HOME: path.join(tmp, 'xdg'),
      POB_API_TEST_ACTIONS: opts.testActions ? '1' : undefined,
      ...(opts.deps?.env ?? {}),
    },
  });
  const call = async (tool: string, args: Record<string, unknown> = {}): Promise<ToolOutcome> => {
    const result = (await server.client.callTool({ name: tool, arguments: args }, undefined, { timeout: CALL_TIMEOUT_MS })) as {
      isError?: boolean;
      content?: Array<{ type: string; text?: string }>;
    };
    return { isError: result.isError === true, text: (result.content ?? []).map((c) => c.text ?? '').join('\n') };
  };
  return {
    server,
    session: server.session,
    builds,
    tmp,
    call,
    async close() {
      await server.close();
      fs.rmSync(tmp, { recursive: true, force: true });
    },
  };
}

/** Attributes whose value is a set of node ids that PoB writes in Lua `pairs()` order. */
const NODE_SET_ATTRS = new Set(['nodes', 'strNodes', 'dexNodes', 'intNodes']);

/** One start or self-closing tag with its attributes sorted by name and its node-id sets sorted. */
function normalizeTag(tag: string): string {
  const m = /^<([A-Za-z_][\w.:-]*)([^>]*?)(\/?)>$/.exec(tag);
  if (!m) return tag;
  const attrs = [...m[2].matchAll(/([\w.:-]+)="([^"]*)"/g)].map(([, name, value]) =>
    NODE_SET_ATTRS.has(name) && /^\d+(,\d+)*$/.test(value)
      ? [name, value.split(',').map(Number).sort((a, b) => a - b).join(',')]
      : [name, value],
  );
  attrs.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return `<${m[1]}${attrs.map(([n, v]) => ` ${n}="${v}"`).join('')}${m[3] ? '/' : ''}>`;
}

/**
 * The canonical export (AC-E16): `export_build_xml` with every `<PlayerStat>`, `<MinionStat>` and
 * `<FullDPSSkill>` removed, and with what PoB serializes in Lua hash-table (`pairs()`) order put in a
 * fixed order, because that order changes whenever the same build is loaded again (WU-13: a reload of
 * an identical export reorders `<Spec nodes>`, the `<AttributeOverride>` node lists, the tree `<URL>`
 * that encodes them, and the config set's `<Input>`/`<Placeholder>` elements):
 * - attributes are sorted by name, and the node-id sets (`nodes`, `strNodes`, `dexNodes`, `intNodes`) are
 *   sorted numerically;
 * - the `<URL>` body (the same node set, encoded in that order) is dropped;
 * - each run of consecutive `<Input …/>`/`<Placeholder …/>` elements is sorted.
 * Everything else (element order, values, text) is compared as exported.
 */
export function canonicalize(xml: string): string {
  const stripped = xml
    .replace(/<(PlayerStat|MinionStat|FullDPSSkill)\b[^>]*\/>/g, '')
    .replace(/<(PlayerStat|MinionStat|FullDPSSkill)\b[^>]*>[\s\S]*?<\/\1>/g, '')
    .replace(/<URL>[\s\S]*?<\/URL>/g, '<URL/>')
    .replace(/<[A-Za-z_][\w.:-]*(?:\s+[\w.:-]+="[^"]*")*\s*\/?>/g, normalizeTag)
    .replace(/\n\s*\n/g, '\n');
  // Runs of consecutive hash-ordered elements (an attribute value may span lines, so match elements).
  return stripped.replace(/(?:\s*<(?:Input|Placeholder)\b[^>]*\/>)+/g, (run) =>
    '\n' + (run.match(/<(?:Input|Placeholder)\b[^>]*\/>/g) ?? []).sort().join('\n'),
  );
}

/** The canonical export of the engine's build, read through the session (a `read` run). */
export async function canonicalExport(session: EngineSession): Promise<string> {
  const { value } = await session.run({ tool: 'test:canonical-export', kind: 'read' }, async (ctx) => {
    return ctx.client.exportBuildXml();
  });
  return canonicalize(value);
}

/** The engine's character level, read through the session. */
export async function engineLevel(session: EngineSession): Promise<number> {
  const { value } = await session.run({ tool: 'test:level', kind: 'read' }, async (ctx) => {
    const info = await ctx.client.getBuildInfo();
    return Number(info?.level);
  });
  return value;
}

export async function waitFor(cond: () => boolean, timeoutMs = 10000, what = 'condition'): Promise<void> {
  const start = Date.now();
  while (!cond()) {
    if (Date.now() - start > timeoutMs) throw new Error(`timed out waiting for ${what}`);
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
}

/** `process.kill(session.enginePid())`, then wait until the session's client has seen the exit. */
export async function killEngine(session: EngineSession): Promise<number> {
  const pid = session.enginePid();
  if (pid === null) throw new Error('no engine is running');
  process.kill(pid);
  await waitFor(() => session.enginePid() === null, 10000, `engine ${pid} to exit`);
  return pid;
}
