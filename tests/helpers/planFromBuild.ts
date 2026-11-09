/**
 * WU-160 (D-517): a temp layout for `plan_from_build`'s tests: a builds folder holding the reader's fixtures, a guides
 * folder, and `run(n)`, which makes a run folder `compile/2026-12-01-<n>` holding a `run-log.json` (as `guide_run
 * {new_run}` and `pob2-run-log init` leave one), and the in-process server over them, with no engine (kind `none`: a
 * spawn would be a bug).
 */
import crypto from 'crypto';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { startTestServer, type TestServer } from './server';

export const REPO = path.resolve(__dirname, '..', '..');
export const FIXTURES = path.join(REPO, 'tests', 'fixtures', 'builds');
export const IMPORTER = path.join(FIXTURES, 'imported-character.xml');
export const IMPORTER_CODE = path.join(FIXTURES, 'imported-character.code.txt');
export const NINJA = path.join(FIXTURES, 'imported-ninja.xml');

export interface Result {
  isError?: boolean;
  content?: Array<{ type: string; text?: string }>;
}
export const textOf = (r: Result): string => (r.content ?? []).map((c) => c.text ?? '').join('\n');
export const sha1 = (bytes: Buffer | string): string => crypto.createHash('sha1').update(bytes).digest('hex');

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Json = Record<string, any>;

export interface ReaderLayout {
  tmp: string;
  builds: string;
  guides: string;
  server: TestServer;
  spawns: () => number;
  /** A fresh run folder, relative to the guides root, with a run log (`stages` as given). */
  run(stages?: Json[]): string;
  call(args: Json): Promise<Result>;
  /** A run folder's files: name → content. */
  files(rel: string): Record<string, string>;
  json(rel: string, file: string): Json;
  close(): Promise<void>;
}

export async function readerLayout(): Promise<ReaderLayout> {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'pob2-reader-'));
  const builds = path.join(tmp, 'builds');
  const guides = path.join(tmp, 'guides');
  fs.mkdirSync(builds);
  fs.mkdirSync(guides);
  for (const f of [IMPORTER, NINJA]) fs.copyFileSync(f, path.join(builds, path.basename(f)));
  let spawns = 0;
  let n = 0;
  const server = await startTestServer({
    pobDirectory: builds,
    stateDir: path.join(tmp, 'state'),
    guidesDirectory: guides,
    env: { POB_DIRECTORY: builds, XDG_STATE_HOME: path.join(tmp, 'xdg'), POB_GUIDES_DIRECTORY: guides },
    spawn: (() => {
      spawns += 1;
      throw new Error('no engine in this test');
    }) as never,
  });
  return {
    tmp,
    builds,
    guides,
    server,
    spawns: () => spawns,
    run(stages: Json[] = []) {
      n += 1;
      const rel = `compile/2026-12-01-${n}`;
      fs.mkdirSync(path.join(guides, rel), { recursive: true });
      fs.writeFileSync(path.join(guides, rel, 'run-log.json'), `${JSON.stringify({ schemaVersion: 4, skillRevision: 16, piece: 'compile', stages })}\n`);
      return rel;
    },
    call: async (args: Json) => (await server.client.callTool({ name: 'plan_from_build', arguments: args })) as Result,
    files(rel: string) {
      const dir = path.join(guides, rel);
      return Object.fromEntries(fs.readdirSync(dir).sort().map((f) => [f, fs.readFileSync(path.join(dir, f), 'utf8')]));
    },
    json: (rel: string, file: string) => JSON.parse(fs.readFileSync(path.join(guides, rel, file), 'utf8')) as Json,
    async close() {
      await server.close();
      fs.rmSync(tmp, { recursive: true, force: true });
    },
  };
}
