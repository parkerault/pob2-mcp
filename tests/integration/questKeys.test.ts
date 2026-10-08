/**
 * AC-P15 (WU-39, D-214): C1's quest config keys are PoB's own.
 *
 * Engine-required and in process (`startSessionFixture`: the real server, router, handlers, session,
 * bridge and luajit over temp builds, state and guides folders). On a new build (`lua_new_build`), the
 * option keys `get_config` lists that start with `quest` equal, as a set, the `q.*.pob-config-key`
 * values of `data/campaign/progress.json`.
 */
import path from 'path';
import { afterAll, beforeAll, expect, it } from '@jest/globals';
import { loadReferenceData } from '../../src/plan/referenceData';
import { engineDescribe } from '../helpers/engine';
import { startSessionFixture, type SessionFixture } from '../helpers/engineSession';

const ENGINE_TIMEOUT = 240_000;
const REPO = path.resolve(__dirname, '..', '..');

/** The option keys of get_config's output: the `key: value` lines under its section headers. */
function optionKeys(text: string): string[] {
  const lines = text.split('\n');
  const first = lines.findIndex((l) => /^=== .+ ===$/.test(l) && !l.startsWith('=== Configuration'));
  if (first < 0) throw new Error(`no option sections in get_config's output:\n${text.slice(0, 400)}`);
  return lines
    .slice(first)
    .filter((l) => l !== '' && !/^=== .+ ===$/.test(l))
    .map((l) => {
      const at = l.indexOf(': ');
      if (at <= 0) throw new Error(`not a key: value line: ${l}`);
      return l.slice(0, at);
    });
}

engineDescribe('AC-P15 (WU-39): the quest config keys in C1 are the ones PoB lists', () => {
  let f: SessionFixture;

  beforeAll(async () => {
    f = await startSessionFixture();
  }, ENGINE_TIMEOUT);

  afterAll(async () => {
    await f?.close();
  });

  it(
    'AC-P15: the set of q.*.pob-config-key values equals the get_config option keys starting with quest, on a new build',
    async () => {
      const progress = loadReferenceData(path.join(REPO, 'data')).files.get('campaign/progress.json')!;
      const dataKeys = Object.entries(progress.facts)
        .filter(([id]) => id.startsWith('q.') && id.endsWith('.pob-config-key'))
        .map(([, fact]) => fact.value as string);

      const created = await f.call('lua_new_build');
      expect(created.isError).toBe(false);
      const config = await f.call('get_config');
      expect(config.isError).toBe(false);
      const keys = optionKeys(config.text);
      expect(keys.length).toBeGreaterThan(100);
      const questKeys = keys.filter((k) => k.startsWith('quest'));

      expect(questKeys.length).toBeGreaterThan(0);
      expect(new Set(dataKeys).size).toBe(dataKeys.length);
      expect(new Set(questKeys)).toEqual(new Set(dataKeys));
    },
    ENGINE_TIMEOUT,
  );
});
