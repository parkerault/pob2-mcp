/**
 * AC-F25 (I-4a): the tool-disposition registry, in process.
 *
 * `tests/fixtures/tool-disposition.json` encodes the vision §4 table: all 100 routed names before the
 * epic (98 registered + 2 routed-only) plus the 2 new tools, and `set_gem_corruption` (D-91, lane B),
 * then the build-guide epic's new tools (lane "build-guide"; spine C-37…C-50, each tool-adding unit
 * appends its own to `BUILD_GUIDE_NEW`), one entry each, as
 * `{name, bucket: keep|fix|rewrite|new|delete, lane, pending?}`. `lane` is the table's lane column
 * ("none" for Keep, whose lane is "—").
 * - The in-process `listTools` set (every group enabled) equals the non-delete, non-pending names.
 * - `pending` is allowed only on `trade_query_options` ("WU-17") and `find_upgrades` ("WU-23"); each
 *   of those units removes its tool's flag.
 */
import fs from 'fs';
import path from 'path';
import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { startTestServer, type TestServer } from '../helpers/server';
import { TOOL_META } from '../../src/server/toolMeta';

interface DispositionEntry {
  name: string;
  bucket: string;
  lane: string;
  pending?: string;
}

const FILE = path.resolve(__dirname, '..', 'fixtures', 'tool-disposition.json');
const ENTRIES = JSON.parse(fs.readFileSync(FILE, 'utf8')) as DispositionEntry[];

const BUCKETS = ['keep', 'fix', 'rewrite', 'new', 'delete'];
/**
 * The build-guide epic's new tools so far (lane "build-guide"): WU-31's `lookup_game_data` (C-37) and
 * WU-40's `encode_build_code` (C-42).
 */
const BUILD_GUIDE_NEW = ['lookup_game_data', 'encode_build_code'];
/** The stabilization epic's new tools: vision §4's 2 and `set_gem_corruption` (D-91). */
const STABILIZATION_NEW = ['find_upgrades', 'set_gem_corruption', 'trade_query_options'];
/** Vision §4 row sizes: Keep 25, Fix 46 (engine ops 36 + shapes 6 + trade 4), Rewrite 3, New 2 + set_gem_corruption (D-91) + the build-guide tools, Delete 25 + find_item_upgrades. */
const BUCKET_SIZES: Record<string, number> = { keep: 25, fix: 46, rewrite: 3, new: 3 + BUILD_GUIDE_NEW.length, delete: 26 };
/** Vision §4 lane column per bucket; the build-guide epic's tools are lane "build-guide". */
const LANES: Record<string, string[]> = {
  keep: ['none'],
  fix: ['B', 'A3', 'T1'],
  rewrite: ['C'],
  new: ['T2', 'B', 'build-guide'],
  delete: ['D4'],
};
/** The only tools that may carry `pending`, and the unit that clears it. */
const ALLOWED_PENDING: Record<string, string> = { trade_query_options: 'WU-17', find_upgrades: 'WU-23' };

/** The names the server must list: neither deleted nor pending. */
const expectedListed = () => ENTRIES.filter((e) => e.bucket !== 'delete' && !e.pending).map((e) => e.name);

describe('AC-F25: tool-disposition.json (vision §4)', () => {
  let server: TestServer;
  beforeAll(async () => {
    server = await startTestServer({ env: { POE_TRADE_DISABLED: undefined, POE_NINJA_DISABLED: undefined } });
  });
  afterAll(async () => {
    await server.close();
  });

  it('AC-F25: lists the 100 routed names plus the 3 new ones (2 + set_gem_corruption, D-91) and the build-guide new tools, each exactly once, with a valid shape', () => {
    expect(ENTRIES).toHaveLength(103 + BUILD_GUIDE_NEW.length);
    expect(new Set(ENTRIES.map((e) => e.name)).size).toBe(103 + BUILD_GUIDE_NEW.length);
    for (const e of ENTRIES) {
      expect(Object.keys(e).filter((k) => !['name', 'bucket', 'lane', 'pending'].includes(k))).toEqual([]);
      expect(typeof e.name).toBe('string');
      expect(BUCKETS).toContain(e.bucket);
      expect(LANES[e.bucket]).toContain(e.lane);
    }
    const sizes = Object.fromEntries(BUCKETS.map((b) => [b, ENTRIES.filter((e) => e.bucket === b).length]));
    expect(sizes).toEqual(BUCKET_SIZES);
    // The 100 names routed before the epic are everything except the new tools.
    expect(ENTRIES.filter((e) => e.bucket !== 'new')).toHaveLength(100);
    expect(ENTRIES.filter((e) => e.bucket === 'new').map((e) => e.name).sort()).toEqual([...STABILIZATION_NEW, ...BUILD_GUIDE_NEW].sort());
    for (const name of BUILD_GUIDE_NEW) expect(ENTRIES.find((e) => e.name === name)?.lane).toBe('build-guide');
    expect(ENTRIES.find((e) => e.name === 'set_gem_corruption')?.lane).toBe('B');
    expect(ENTRIES.find((e) => e.name === 'find_item_upgrades')?.bucket).toBe('delete');
  });

  it('AC-F25: pending appears only on trade_query_options (WU-17) and find_upgrades (WU-23)', () => {
    for (const e of ENTRIES.filter((x) => x.pending !== undefined)) {
      expect(Object.keys(ALLOWED_PENDING)).toContain(e.name);
      expect(e.pending).toBe(ALLOWED_PENDING[e.name]);
    }
  });

  it('AC-F25: the in-process listTools set equals the non-delete, non-pending names', async () => {
    const listed = (await server.client.listTools()).tools.map((t) => t.name);
    expect(new Set(listed).size).toBe(listed.length);
    expect([...listed].sort()).toEqual(expectedListed().sort());
  });

  it('AC-F25: TOOL_META has exactly the non-delete, non-pending names (registered = disposition)', () => {
    expect(Object.keys(TOOL_META).sort()).toEqual(expectedListed().sort());
  });
});
