/**
 * The golden-build regression gate (I-1a, I-1b), engine-required.
 *
 * - AC-F23 (I-1a): load `grenadator.xml` from a temp builds dir, save it with `lua_save_build` under a
 *   new name, and compare the `<PlayerStat stat value>` pairs of both files (attribute order does not
 *   matter): all 109 pairs are identical as strings.
 * - AC-F24 (I-1b): save, then reload the saved file. `get_stats` with an explicit field list (every
 *   numeric key of `mainOutput`) and the `PlayerStat` pairs are identical before and after. There is
 *   no XML byte or structure comparison: `SaveDB` reorders sections, attributes and children.
 *
 * The field list is `golden-stat-fields.json`, generated once from the golden build by
 * `gen-golden-stat-fields.lua` (the AC's pre-WU-06 path; WU-06 adds `__test_eval`, after which the
 * list can be enumerated live). Loads and saves go through the in-process server (real router,
 * handlers, engine); the explicit-field `get_stats` calls go through a real bridge client, because no
 * tool takes a field list.
 */
import fs from 'fs';
import os from 'os';
import path from 'path';
import { spawn } from 'child_process';
import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { startTestServer, type TestServer } from '../helpers/server';
import { engineDescribe } from '../helpers/engine';
import { PoBLuaApiClient } from '../../src/pobLuaBridge';
import { resolvePobApiDir, resolvePobSrc } from '../../src/engine/pobPath';
import { readPin } from '../../src/engine/pinCheck';

const REPO = path.resolve(__dirname, '..', '..');
const GOLDEN = path.join(REPO, 'tests', 'fixtures', 'builds', 'grenadator.xml');
const STAT_FIELDS = JSON.parse(fs.readFileSync(path.join(__dirname, 'golden-stat-fields.json'), 'utf8')) as string[];
const GOLDEN_PAIR_COUNT = 109;

/** One attribute of an XML start tag, wherever it sits among the others. */
function attr(tag: string, name: string): string | undefined {
  const m = new RegExp(`\\s${name}="([^"]*)"`).exec(tag);
  return m ? m[1] : undefined;
}

/** The `(stat, value)` pairs of every `<PlayerStat>` element, as sorted `stat=value` strings. */
function playerStatPairs(xml: string): string[] {
  const pairs: string[] = [];
  for (const m of xml.matchAll(/<PlayerStat\b[^>]*>/g)) {
    const stat = attr(m[0], 'stat');
    const value = attr(m[0], 'value');
    if (stat === undefined || value === undefined) throw new Error(`PlayerStat without stat/value: ${m[0]}`);
    pairs.push(`${stat}=${value}`);
  }
  return pairs.sort();
}

function textOf(result: unknown): string {
  const content = (result as { content?: Array<{ text?: string }> }).content ?? [];
  return content.map((c) => c.text ?? '').join('\n');
}

describe('golden helpers', () => {
  it('parses PlayerStat pairs independently of attribute order', () => {
    const a = '<PlayerStat value="1.5" stat="Life"/><PlayerStat stat="Mana" value="2"/>';
    const b = '<PlayerStat stat="Life" value="1.5"/>\n<PlayerStat value="2" stat="Mana" />';
    expect(playerStatPairs(a)).toEqual(['Life=1.5', 'Mana=2']);
    expect(playerStatPairs(b)).toEqual(playerStatPairs(a));
  });
});

engineDescribe('golden build save/reload (I-1a, I-1b)', () => {
  let tmp: string;
  let builds: string;
  let server: TestServer;

  const call = async (name: string, args: Record<string, unknown>): Promise<string> => {
    const result = await server.client.callTool({ name, arguments: args }, undefined, { timeout: 120000 });
    const text = textOf(result);
    if ((result as { isError?: boolean }).isError) throw new Error(`${name} failed: ${text}`);
    return text;
  };
  const read = (file: string) => fs.readFileSync(path.join(builds, file), 'utf8');

  beforeAll(async () => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'pob2-golden-'));
    builds = path.join(tmp, 'builds');
    fs.mkdirSync(builds);
    fs.copyFileSync(GOLDEN, path.join(builds, 'grenadator.xml'));
    server = await startTestServer({
      pobDirectory: builds,
      stateDir: path.join(tmp, 'state'),
      env: { POB_DIRECTORY: builds, XDG_STATE_HOME: tmp },
    });
  }, 120000);

  afterAll(async () => {
    if (server) await server.close();
    if (tmp) fs.rmSync(tmp, { recursive: true, force: true });
  }, 30000);

  it('AC-F23: load the golden build, save it via lua_save_build; all 109 PlayerStat pairs are identical', async () => {
    const goldenPairs = playerStatPairs(read('grenadator.xml'));
    expect(goldenPairs).toHaveLength(GOLDEN_PAIR_COUNT);
    expect(new Set(goldenPairs.map((p) => p.split('=')[0])).size).toBe(GOLDEN_PAIR_COUNT);

    await call('lua_load_build', { build_name: 'grenadator.xml' });
    await call('lua_save_build', { build_name: 'golden-saved' });

    const savedPairs = playerStatPairs(read('golden-saved.xml'));
    expect(savedPairs).toEqual(goldenPairs);
  }, 180000);

  it('AC-F24: save then reload the saved file; PlayerStat pairs are identical before and after', async () => {
    await call('lua_load_build', { build_name: 'grenadator.xml' });
    await call('lua_save_build', { build_name: 'golden-before' });
    await call('lua_load_build', { build_name: 'golden-before.xml' });
    await call('lua_save_build', { build_name: 'golden-after' });

    const before = playerStatPairs(read('golden-before.xml'));
    const after = playerStatPairs(read('golden-after.xml'));
    expect(before).toHaveLength(GOLDEN_PAIR_COUNT);
    expect(after).toEqual(before);
    expect(after).toEqual(playerStatPairs(read('grenadator.xml')));
  }, 180000);

  it('AC-F24: get_stats with every numeric mainOutput key is identical for the golden build and its saved-then-reloaded copy', async () => {
    expect(STAT_FIELDS.length).toBeGreaterThan(GOLDEN_PAIR_COUNT);
    expect(new Set(STAT_FIELDS).size).toBe(STAT_FIELDS.length);

    await call('lua_load_build', { build_name: 'grenadator.xml' });
    await call('lua_save_build', { build_name: 'golden-stats' });

    const bridge = new PoBLuaApiClient({
      env: { ...process.env, POB_TIMEOUT_MS: '90000' },
      spawn,
      pobSrc: resolvePobSrc(process.env),
      pobApiDir: resolvePobApiDir(),
      pin: readPin(),
    });
    try {
      await bridge.start();
      const statsOf = async (xml: string): Promise<Record<string, unknown>> => {
        await bridge.loadBuildXml(xml, 'golden');
        const stats = { ...(await bridge.getStats(STAT_FIELDS)) };
        delete stats._meta;
        return stats;
      };

      const before = await statsOf(read('grenadator.xml'));
      const after = await statsOf(read('golden-stats.xml'));

      // Every listed key comes back as a number, so the comparison covers the whole list.
      expect(Object.keys(before).sort()).toEqual([...STAT_FIELDS].sort());
      const nonNumeric = Object.entries(before).filter(([, v]) => typeof v !== 'number').map(([k]) => k);
      expect(nonNumeric).toEqual([]);
      expect(after).toEqual(before);
    } finally {
      await bridge.stop();
    }
  }, 240000);
});
