/**
 * M-19 (D-399): the session's snapshot leaves the engine's build as it was. In process and engine-required.
 *
 * The probe: on a guide author's heavy minion build, the snapshot after each change (`export_build_xml`) took
 * longer than the last, until it timed out. The cause was one item, not the minions: PoB's save
 * (`ItemsTab:Save`) calls `item:BuildAndParseRaw()` on every item, re-parsing the text it just built, and a
 * rare Runeforged item whose text holds a "Runic Ward:" line (PoB v0.23.1 reads only "Ward:") before a
 * socketed rune doesn't read back the same: every save gave it one more socket and one more rune, and its
 * parse grew slower each time. So each snapshot also changed the build's figures. The export now writes the
 * same text without the re-parse.
 *
 * The fixture `runic-ward-gloves.xml` is written from the game data: a Mercenary wearing rare Runeforged Gold
 * Gloves (the base's Energy Shield 33 and Ward 52, as the game names it "Runic Ward") with a Greater Storm
 * Rune in their one socket. The independent checks are PoB's own state (`__test_eval`): the gloves' sockets
 * and runes, and the main output's Life and lightning resistance, after three changes, each snapshotted.
 */
import fs from 'fs';
import path from 'path';
import { afterAll, beforeAll, expect, it } from '@jest/globals';
import { engineDescribe } from '../helpers/engine';
import { canonicalExport, startSessionFixture, type SessionFixture } from '../helpers/engineSession';

const ENGINE_TIMEOUT = 240_000;
const FIXTURE = fs.readFileSync(path.resolve(__dirname, '..', 'fixtures', 'builds', 'runic-ward-gloves.xml'), 'utf8');

interface GlovesState {
  sockets: number;
  runes: number;
  socketsLine: string;
  life: number;
  lightningResist: number;
}

/** The gloves' sockets and runes, their text's Sockets line, and the figures they feed. */
const GLOVES_QUERY = `
  local item = build.itemsTab.items[build.itemsTab.slots['Gloves'].selItemId]
  local out = build.calcsTab.mainOutput
  return {
    sockets = #item.sockets,
    runes = #item.runes,
    socketsLine = item.raw:match('Sockets:[^\\n]*') or '',
    life = out.Life,
    lightningResist = out.LightningResist,
  }`;

engineDescribe("D-399: the snapshot after a change leaves the engine's build as it was", () => {
  let f: SessionFixture;

  beforeAll(async () => {
    f = await startSessionFixture({ testActions: true, files: { 'runic-ward-gloves.xml': FIXTURE } });
  }, ENGINE_TIMEOUT);

  afterAll(async () => {
    await f?.close();
  });

  async function glovesState(): Promise<GlovesState> {
    const { value } = await f.session.run({ tool: 'test:gloves', kind: 'read' }, async (ctx) => {
      return (await ctx.client.request('__test_eval', { code: GLOVES_QUERY })).result as GlovesState;
    });
    return value;
  }

  it(
    'D-399: three changes, each snapshotted, leave the gloves with one socket and one rune, and the figures where they were',
    async () => {
      const load = await f.call('lua_load_build', { build_name: 'runic-ward-gloves.xml' });
      expect(load.isError).toBe(false);
      const loaded = await glovesState();
      expect(loaded).toMatchObject({ sockets: 1, runes: 1, socketsLine: 'Sockets: S' });

      for (const enabled of [false, true, false]) {
        const change = await f.call('toggle_gem', { group_index: 1, gem_index: 2, enabled });
        expect(change.isError).toBe(false);
        expect(change.text).not.toMatch(/could not snapshot/);
      }
      expect(await glovesState()).toEqual(loaded);
    },
    ENGINE_TIMEOUT,
  );

  it(
    'D-399: two exports in a row are the same document, and neither gives the gloves a second socket',
    async () => {
      await f.call('lua_load_build', { build_name: 'runic-ward-gloves.xml' });
      const first = await canonicalExport(f.session);
      const second = await canonicalExport(f.session);
      expect(second).toBe(first);
      expect(first).not.toMatch(/Sockets: S S/);
    },
    ENGINE_TIMEOUT,
  );
});
