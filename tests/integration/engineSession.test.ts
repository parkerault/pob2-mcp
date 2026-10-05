/**
 * Engine session (C-3, WU-08): engine-required, in process (real Client, router, handlers, session,
 * luajit and the vendor pin). Each block gets its own server over a private builds folder.
 */
import fs from 'fs';
import zlib from 'zlib';
import path from 'path';
import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { engineDescribe } from '../helpers/engine';
import {
  GOLDEN_XML,
  canonicalExport,
  engineLevel,
  goldenWithLevel,
  killEngine,
  startSessionFixture,
  writeBuild,
  type SessionFixture,
} from '../helpers/engineSession';
import { canonicalExportAcrossReload } from '../helpers/reloadCanonical';
import type { EngineEvent } from '../../src/engine/session';

const T = 180000;

engineDescribe('AC-E15: concurrent engine tool calls are serialized end to end (I-2b)', () => {
  let f: SessionFixture;
  beforeAll(async () => {
    f = await startSessionFixture();
  }, T);
  afterAll(async () => f?.close(), 30000);

  it('AC-E15: four parallel calls all succeed, never overlap, and get_build_info sees 91 only after set_character_level', async () => {
    expect((await f.call('lua_load_build', { build_name: 'grenadator.xml' })).isError).toBe(false);
    const events: EngineEvent[] = [];
    const off = f.session.onEvent((e) => {
      if (e.phase === 'start' || e.phase === 'end') events.push(e);
    });
    const [level, info, skills, stats] = await Promise.all([
      f.call('set_character_level', { level: 91 }),
      f.call('lua_get_build_info'),
      f.call('get_skill_setup'),
      f.call('lua_get_stats'),
    ]);
    off();
    for (const r of [level, info, skills, stats]) expect(r.isError).toBe(false);

    // The start/end sequence alternates start(X), end(X): no call starts before the previous one ends.
    expect(events).toHaveLength(8);
    for (let k = 0; k < events.length; k += 2) {
      expect(events[k].phase).toBe('start');
      expect(events[k + 1]).toMatchObject({ phase: 'end', tool: events[k].tool, ok: true });
      if (k > 0) expect(events[k].t).toBeGreaterThanOrEqual(events[k - 1].t);
    }
    const startOf = (tool: string) => events.findIndex((e) => e.tool === tool && e.phase === 'start');
    const endOf = (tool: string) => events.findIndex((e) => e.tool === tool && e.phase === 'end');
    const expected = startOf('lua_get_build_info') > endOf('set_character_level') ? 91 : 90;
    expect(info.text).toContain(`Level: ${expected}`);
  }, T);
});

engineDescribe('AC-E17: a killed engine is restored from the snapshot (I-2c)', () => {
  let f: SessionFixture;
  beforeAll(async () => {
    f = await startSessionFixture({ testActions: true });
  }, T);
  afterAll(async () => f?.close(), 30000);

  it('AC-E17: after process.kill, lua_get_build_info starts with the restore notice and reports level 50', async () => {
    expect((await f.call('lua_load_build', { build_name: 'grenadator.xml' })).isError).toBe(false);
    expect((await f.call('set_character_level', { level: 50 })).isError).toBe(false);
    const pid = await killEngine(f.session);
    const out = await f.call('lua_get_build_info');
    expect(out.isError).toBe(false);
    expect(out.text.startsWith('Engine restarted; restored the build to its state after `set_character_level`.')).toBe(true);
    expect(out.text).toContain('Level: 50');
    expect(f.session.enginePid()).not.toBe(pid);
  }, T);

  it('FR-E3 (C-3 step 3): an auto-mode level is restored as it was after the last change, not re-estimated by PoB', async () => {
    // The golden build with PoB's level estimate on; removing tree leaves leaves the recorded level
    // stale against the estimate (a plain reload of the export would move it, AC-A3).
    const auto = GOLDEN_XML.replace('characterLevelAutoMode="false"', 'characterLevelAutoMode="true"');
    expect(auto).not.toBe(GOLDEN_XML);
    writeBuild(path.join(f.builds, 'auto-level.xml'), auto);
    expect((await f.call('lua_load_build', { build_name: 'auto-level.xml' })).isError).toBe(false);
    const levelState = async () =>
      (
        await f.session.run({ tool: 'test:level-state', kind: 'read' }, async (ctx) =>
          (await ctx.client.request('__test_eval', { code: 'return { level = build.characterLevel, auto = build.characterLevelAutoMode }' })).result,
        )
      ).value as { level: number; auto: boolean };
    const removed = await f.session.run({ tool: 'test:remove-leaves', kind: 'mutate' }, async (ctx) => {
      const leaves = (await ctx.client.request('__test_eval', { code: PICK_LEAVES(5) })).result as number[];
      await ctx.client.request('update_tree_delta', { removeNodes: leaves });
      return leaves;
    });
    expect(removed.value).toHaveLength(5);
    const before = await levelState();
    expect(before.auto).toBe(true);

    await killEngine(f.session);
    const after = await f.session.run({ tool: 'test:after-kill', kind: 'read' }, async (ctx) =>
      (await ctx.client.request('__test_eval', { code: 'return { level = build.characterLevel, auto = build.characterLevelAutoMode }' })).result,
    );
    expect(after.notices.join('\n')).toContain('restored the build to its state after `test:remove-leaves`');
    expect(after.value).toEqual(before);

    // The case is real: PoB's own refresh would move the level.
    const raw = await f.session.run({ tool: 'test:refresh', kind: 'read' }, async (ctx) =>
      (await ctx.client.request('__test_eval', { code: 'build:RefreshStatList() return build.characterLevel' })).result,
    );
    expect(raw.value).not.toBe(before.level);
  }, T);
});

/** Up to `n` allocated non-ascendancy leaf nodes (one allocated neighbour), lowest ids first. */
const PICK_LEAVES = (n: number) => `
local spec = build.spec
local ids = {}
for id, node in pairs(spec.allocNodes) do
  if not node.ascendancyName and node.type ~= 'ClassStart' then
    local linked = 0
    for _, other in ipairs(node.linked or {}) do
      if spec.allocNodes[other.id] then linked = linked + 1 end
    end
    if linked == 1 then ids[#ids + 1] = id end
  end
end
table.sort(ids)
local out = {}
for i = 1, math.min(${n}, #ids) do out[i] = ids[i] end
return out`;

engineDescribe('AC-E18: an engine death during a call (through session.run)', () => {
  let f: SessionFixture;
  beforeAll(async () => {
    f = await startSessionFixture({ testActions: true });
  }, T);
  afterAll(async () => f?.close(), 30000);

  it('AC-E18: the run rejects naming the call, revision is unchanged, and the next run restores the post-mutation state', async () => {
    expect((await f.call('lua_load_build', { build_name: 'grenadator.xml' })).isError).toBe(false);
    expect((await f.call('set_character_level', { level: 70 })).isError).toBe(false);
    const revision = f.session.revision;

    const probe = f.session.run({ tool: 'probe', kind: 'mutate' }, (ctx) => ctx.client.request('__test_sleep', { ms: 5000 }));
    const settled = probe.then(
      () => null,
      (error: unknown) => error as Error,
    );
    await new Promise((resolve) => setTimeout(resolve, 700));
    process.kill(f.session.enginePid() as number);
    const error = await settled;
    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toContain('engine stopped while running `probe`');
    expect(f.session.revision).toBe(revision);

    const next = await f.session.run({ tool: 'probe-after', kind: 'read' }, async (ctx) => Number((await ctx.client.getBuildInfo()).level));
    expect(next.notices.join('\n')).toContain('The interrupted call `probe` was not applied.');
    expect(next.notices.join('\n')).toContain('restored the build to its state after `set_character_level`');
    expect(next.value).toBe(70);
    expect(f.session.revision).toBe(revision);
  }, T);
});

engineDescribe('AC-E21: the disk-change policy (D-19)', () => {
  let f: SessionFixture;
  let file: string;
  beforeAll(async () => {
    f = await startSessionFixture();
    file = path.join(f.builds, 'grenadator.xml');
  }, T);
  afterAll(async () => f?.close(), 30000);

  it('AC-E21: clean engine, file changed → the next call auto-reloads it, says so, and bumps revision by 1', async () => {
    expect((await f.call('lua_load_build', { build_name: 'grenadator.xml' })).isError).toBe(false);
    const revision = f.session.revision;
    writeBuild(file, goldenWithLevel(85));
    const out = await f.call('lua_get_build_info');
    expect(out.isError).toBe(false);
    expect(out.text.startsWith('Reloaded grenadator.xml: it changed on disk since the engine loaded it.')).toBe(true);
    expect(out.text).toContain('Level: 85');
    expect(f.session.revision).toBe(revision + 1);
  }, T);

  it('AC-E21: dirty engine, file changed → no reload; a warning naming set_character_level; the engine keeps its level', async () => {
    expect((await f.call('set_character_level', { level: 77 })).isError).toBe(false);
    writeBuild(file, goldenWithLevel(60));
    const revision = f.session.revision;
    const out = await f.call('lua_get_build_info');
    expect(out.isError).toBe(false);
    expect(
      out.text.startsWith(
        'Warning: grenadator.xml changed on disk (probably saved in PoB2), but the engine has unsaved changes from `set_character_level`.',
      ),
    ).toBe(true);
    expect(out.text).toContain('Level: 77');
    expect(f.session.revision).toBe(revision);
  }, T);

  it('AC-E21: an unloadable change (truncated XML) is isError "could not be loaded"; once restored, the next call reloads it', async () => {
    writeBuild(file, GOLDEN_XML);
    expect((await f.call('lua_reload_build')).isError).toBe(false);
    expect(f.session.isDirty()).toBe(false);

    writeBuild(file, GOLDEN_XML.slice(0, Math.floor(GOLDEN_XML.length / 2)));
    const bad = await f.call('lua_get_build_info');
    expect(bad.isError).toBe(true);
    expect(bad.text).toContain('grenadator.xml changed on disk but could not be loaded (it may be mid-save in PoB2)');
    expect(f.session.loaded?.path).toBe('grenadator.xml');

    writeBuild(file, goldenWithLevel(66));
    const ok = await f.call('lua_get_build_info');
    expect(ok.isError).toBe(false);
    expect(ok.text).toContain('Reloaded grenadator.xml: it changed on disk since the engine loaded it.');
    expect(ok.text).toContain('Level: 66');
  }, T);

  it('AC-E21: a deleted file → the warning "no longer exists on disk"', async () => {
    fs.unlinkSync(file);
    const out = await f.call('lua_get_build_info');
    expect(out.isError).toBe(false);
    expect(out.text.startsWith('Warning: grenadator.xml no longer exists on disk.')).toBe(true);
  }, T);
});

engineDescribe('AC-E22: loaded-build lines and the snapshot cost (NFR-6)', () => {
  let f: SessionFixture;
  beforeAll(async () => {
    f = await startSessionFixture();
  }, T);
  afterAll(async () => f?.close(), 30000);

  it('AC-E22: lua_get_build_info, lua_load_build and lua_save_build show "Build: <displayName> (<path>)"', async () => {
    const load = await f.call('lua_load_build', { build_name: 'grenadator.xml' });
    expect(load.isError).toBe(false);
    expect(f.session.loaded).toMatchObject({ displayName: 'grenadator', path: 'grenadator.xml' });
    expect(load.text).toContain('Build: grenadator (grenadator.xml)');
    expect((await f.call('lua_get_build_info')).text).toContain('Build: grenadator (grenadator.xml)');
    const save = await f.call('lua_save_build', { build_name: 'e22-saved' });
    expect(save.isError).toBe(false);
    // A save under a new name re-points the loaded build to it (Save As, C-17 step 6, D-51d).
    expect(f.session.loaded).toMatchObject({ displayName: 'e22-saved', path: 'e22-saved.xml' });
    expect(save.text).toContain('Build: e22-saved (e22-saved.xml)');
  }, T);

  it('AC-E22: the snapshot after set_character_level takes ≤ 100 ms (median of 5)', async () => {
    const spans: number[] = [];
    let begin = 0;
    const off = f.session.onEvent((e) => {
      if (e.tool !== 'set_character_level') return;
      if (e.phase === 'snapshot-start') begin = e.t;
      if (e.phase === 'snapshot-end') spans.push(e.t - begin);
    });
    for (const level of [80, 81, 82, 83, 84]) {
      expect((await f.call('set_character_level', { level })).isError).toBe(false);
    }
    off();
    expect(spans).toHaveLength(5);
    const median = [...spans].sort((a, b) => a - b)[2];
    expect(median).toBeLessThanOrEqual(100);
  }, T);
});

engineDescribe('AC-E56: the load guard', () => {
  let f: SessionFixture;
  beforeAll(async () => {
    f = await startSessionFixture({ files: { 'grenadator.xml': GOLDEN_XML, 'second.xml': goldenWithLevel(42) } });
  }, T);
  afterAll(async () => f?.close(), 30000);

  it('AC-E56: ctx.client.request("load_build_xml") rejects with "engine load outside the session"', async () => {
    await expect(
      f.session.run({ tool: 'probe', kind: 'read' }, (ctx) => ctx.client.request('load_build_xml', { xml: GOLDEN_XML, name: 'x' })),
    ).rejects.toThrow('engine load outside the session');
  }, T);

  // AC-E56's interim bullet said compare_builds is isError "until WU-13"; WU-13 moved it to
  // withTemporaryBuild (D-9), so it now succeeds, and the guard's point still holds: nothing changes.
  // withTemporaryBuild reloads the working build, so the canonical export is compared modulo PoB's
  // pairs() serialization order (tests/helpers/reloadCanonical.ts).
  it('AC-E56: compare_builds (withTemporaryBuild since WU-13) leaves the canonical export, loaded and revision unchanged', async () => {
    expect((await f.call('lua_load_build', { build_name: 'grenadator.xml' })).isError).toBe(false);
    const before = { xml: await canonicalExportAcrossReload(f.session), loaded: f.session.loaded, revision: f.session.revision };
    const out = await f.call('compare_builds', { build1: 'grenadator.xml', build2: 'second.xml' });
    expect(out.isError).toBe(false);
    expect(out.text).toContain('Level: 90 vs 42');
    expect(await canonicalExportAcrossReload(f.session)).toBe(before.xml);
    expect(f.session.loaded).toEqual(before.loaded);
    expect(f.session.revision).toBe(before.revision);
  }, T);
});

engineDescribe('AC-E57: auto-reload bookkeeping', () => {
  let f: SessionFixture;
  let file: string;
  beforeAll(async () => {
    f = await startSessionFixture({ testActions: true });
    file = path.join(f.builds, 'grenadator.xml');
  }, T);
  afterAll(async () => f?.close(), 30000);

  it('AC-E57 (a): an auto-reload on a read call bumps revision, and a crash restores the reloaded file', async () => {
    expect((await f.call('lua_load_build', { build_name: 'grenadator.xml' })).isError).toBe(false);
    const revision = f.session.revision;
    writeBuild(file, goldenWithLevel(81));
    const stats = await f.call('lua_get_stats');
    expect(stats.isError).toBe(false);
    expect(stats.text).toContain('Reloaded grenadator.xml');
    expect(f.session.revision).toBe(revision + 1);

    await killEngine(f.session);
    const info = await f.call('lua_get_build_info');
    expect(info.isError).toBe(false);
    expect(info.text).toContain('restored the build to its state after `auto-reload`');
    expect(info.text).toContain('Level: 81');
  }, T);

  it('AC-E57 (b): a mutate call reloads first, then mutates, and leaves the engine dirty', async () => {
    writeBuild(file, GOLDEN_XML);
    expect((await f.call('lua_load_build', { build_name: 'grenadator.xml' })).isError).toBe(false);
    const revision = f.session.revision;
    writeBuild(file, goldenWithLevel(82));
    const out = await f.call('set_character_level', { level: 70 });
    expect(out.isError).toBe(false);
    expect(out.text.startsWith('Reloaded grenadator.xml: it changed on disk since the engine loaded it.')).toBe(true);
    expect(f.session.isDirty()).toBe(true);
    expect(f.session.revision).toBe(revision + 2);
    expect(f.session.loaded?.savedRevision).toBe(revision + 1);
    expect(await engineLevel(f.session)).toBe(70);
  }, T);
});

engineDescribe('AC-E58: no restorable snapshot (D-8)', () => {
  let f: SessionFixture;
  beforeAll(async () => {
    f = await startSessionFixture({ testActions: true });
  }, T);
  afterAll(async () => f?.close(), 30000);

  it('AC-E58: a failed snapshot, then a crash → read calls are isError; a following lua_load_build succeeds', async () => {
    expect((await f.call('lua_load_build', { build_name: 'grenadator.xml' })).isError).toBe(false);
    // Break build:SaveDB for exactly one call (the next snapshot export).
    const code = [
      "local own = rawget(build, 'SaveDB')",
      "build.SaveDB = function() build.SaveDB = own; error('SaveDB broken for one call (AC-E58)') end",
      'return true',
    ].join('\n');
    await f.session.run({ tool: 'test:break-savedb', kind: 'read' }, (ctx) => ctx.client.request('__test_eval', { code }));

    const mutated = await f.call('set_character_level', { level: 55 });
    expect(mutated.isError).toBe(false);
    expect(mutated.text).toContain('Warning: could not snapshot the engine state; a crash now would lose the last change.');

    await killEngine(f.session);
    const info = await f.call('lua_get_build_info');
    expect(info.isError).toBe(true);
    expect(info.text).toContain('Engine restarted; the loaded build could not be restored. Load it again.');

    const reload = await f.call('lua_load_build', { build_name: 'grenadator.xml' });
    expect(reload.isError).toBe(false);
    expect(reload.text).toContain('Level 90');
    expect(await engineLevel(f.session)).toBe(90);
  }, T);
});

engineDescribe('AC-E59: lifecycle rule L', () => {
  let f: SessionFixture;
  const violations: string[] = [];
  beforeAll(async () => {
    f = await startSessionFixture();
    f.session.onEvent((e) => {
      if (f.session.enginePid() !== null && f.session.loaded === null) violations.push(`${e.tool}:${e.phase}`);
    });
  }, T);
  afterAll(async () => f?.close(), 30000);

  it('AC-E59: lua_stop names the discarded change; the next lua_get_build_info is "Build: New build" with no restore notice', async () => {
    expect((await f.call('lua_load_build', { build_name: 'grenadator.xml' })).isError).toBe(false);
    expect((await f.call('set_character_level', { level: 64 })).isError).toBe(false);
    const revision = f.session.revision;
    const stop = await f.call('lua_stop');
    expect(stop.isError).toBe(false);
    expect(stop.text).toContain('Discarded unsaved changes from `set_character_level`');
    expect(f.session.revision).toBe(revision + 1);
    expect(f.session.loaded).toBeNull();
    expect(f.session.enginePid()).toBeNull();

    const info = await f.call('lua_get_build_info');
    expect(info.isError).toBe(false);
    expect(info.text).toContain('Build: New build');
    expect(info.text).not.toContain('Engine restarted');
  }, T);

  it('AC-E59: lua_new_build sets loaded.displayName "New build" and loaded.path null', async () => {
    expect((await f.call('lua_load_build', { build_name: 'grenadator.xml' })).isError).toBe(false);
    expect(f.session.loaded?.path).toBe('grenadator.xml');
    const out = await f.call('lua_new_build', { class_name: 'Witch' });
    expect(out.isError).toBe(false);
    expect(f.session.loaded).toMatchObject({ displayName: 'New build', path: null, fingerprint: null });
    expect(f.session.isDirty()).toBe(false);
    expect((await f.call('lua_stop')).text).not.toContain('Discarded');
    expect((await f.call('lua_start')).isError).toBe(false);
  }, T);

  it('AC-E59: while an engine runs, session.loaded is never null (checked at every session event)', () => {
    expect(violations).toEqual([]);
  });
});

engineDescribe('AC-E60: canonical build paths through the engine (D-52)', () => {
  let f: SessionFixture;
  beforeAll(async () => {
    // Only Grenadator.xml exists, and this filesystem is case-sensitive: "GRENADATOR" can load only
    // through canonicalBuildPath's readdir match, as on drvfs where any casing would open the file.
    f = await startSessionFixture({ files: { 'Grenadator.xml': GOLDEN_XML } });
  }, T);
  afterAll(async () => f?.close(), 30000);

  it('AC-E60: lua_load_build {build_name:"GRENADATOR"} records the canonical Grenadator.xml', async () => {
    const out = await f.call('lua_load_build', { build_name: 'GRENADATOR' });
    expect(out.isError).toBe(false);
    expect(f.session.loaded).toMatchObject({ path: 'Grenadator.xml', displayName: 'Grenadator' });
    expect(out.text).toContain('Build: Grenadator (Grenadator.xml)');
  }, T);
});

engineDescribe('C-3: import_build never fails after it has replaced the loaded build', () => {
  let f: SessionFixture;
  beforeAll(async () => {
    f = await startSessionFixture({ files: { 'grenadator.xml': GOLDEN_XML } });
  }, T);
  afterAll(async () => f?.close(), 30000);

  it('an invalid save_as is isError before the load: the dirty build, loaded and revision are untouched', async () => {
    expect((await f.call('lua_load_build', { build_name: 'grenadator.xml' })).isError).toBe(false);
    expect((await f.call('set_character_level', { level: 61 })).isError).toBe(false);
    const before = { xml: await canonicalExport(f.session), loaded: f.session.loaded, revision: f.session.revision };
    expect(f.session.isDirty()).toBe(true);

    const code = zlib.deflateSync(Buffer.from(goldenWithLevel(33), 'utf8')).toString('base64');
    const out = await f.call('import_build', { source: code, save_as: '../escape' });
    expect(out.isError).toBe(true);
    expect(out.text).toContain('path traversal');
    expect(await canonicalExport(f.session)).toBe(before.xml);
    expect(f.session.loaded).toEqual(before.loaded);
    expect(f.session.revision).toBe(before.revision);
    expect(f.session.isDirty()).toBe(true);
    expect(await engineLevel(f.session)).toBe(61);
    expect(fs.existsSync(path.join(f.tmp, 'escape.xml'))).toBe(false);
  }, T);
});
