/**
 * L1 sets (WU-35, C-39, D-196): `manage_sets` and the auto-level bridge flag, in process and engine-required.
 *
 * The real server runs in process (`startSessionFixture`: real `Client`, router, handler, session, bridge
 * and luajit), on the golden build. Every expectation is read from PoB itself, never from the tool's
 * earlier output: the engine's export (`export_build_xml`, parsed with fast-xml-parser so PoB's per-process
 * attribute order doesn't matter), Lua queries (`__test_eval`, test actions on, through `session.run`)
 * and the existing tools (`get_skill_setup`).
 *
 * - AC-K23 (basics), AC-K24 (per-set authoring), AC-K25 (titles), AC-K26 (second weapon set), AC-K27
 *   (loadouts), AC-K28 (main-skill index), AC-K29 (persistence) and AC-K30 (auto-level) run here.
 * - D-244 (list is a read: no revision bump, no unsaved state) and D-245 (one {id} tag at the end of a
 *   title; an untitled copy drops the source's tag) run here too; AC-K24 includes the per-set stat-set
 *   choice (`set_main_skill`'s `skill_part`) that PoB's shallow skill-set copy would share.
 * - AC-K30's contract case is in `contract.test.ts`; the engine kinds (AC-B3: list samples are reads, the
 *   rest mutates) are the generic engine-kind check over the `manage_sets` samples in `engineKinds.test.ts`.
 */
import fs from 'fs';
import path from 'path';
import { XMLParser } from 'fast-xml-parser';
import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import { engineDescribe } from '../helpers/engine';
import { canonicalize, killEngine, startSessionFixture, type SessionFixture } from '../helpers/engineSession';
import { TOOL_META } from '../../src/server/toolMeta';
import { engineKindFor } from '../../src/server/toolRouter';

const ENGINE_TIMEOUT = 240_000;
const REPO = path.resolve(__dirname, '..', '..');
const FIXTURES = path.join(REPO, 'tests', 'fixtures');

type SetType = 'item' | 'skill' | 'config';
const SET_TYPES: SetType[] = ['item', 'skill', 'config'];

// ---------------------------------------------------------------------------------------------------
// The export, parsed

type Attrs = Record<string, string>;
interface XmlSet extends Attrs {
  [key: string]: any;
}

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '',
  parseAttributeValue: false,
  isArray: (name) =>
    ['ItemSet', 'Slot', 'SocketIdURL', 'SkillSet', 'Skill', 'Gem', 'ConfigSet', 'Input', 'Placeholder', 'Spec', 'Item', 'StatSetIndex'].includes(name),
});

interface Doc {
  build: Attrs;
  activeSpec: number;
  specs: XmlSet[];
  active: Record<SetType, number>;
  sets: Record<SetType, XmlSet[]>;
}

function parseDoc(xml: string): Doc {
  const root = parser.parse(xml).PathOfBuilding2;
  return {
    build: root.Build,
    activeSpec: Number(root.Tree.activeSpec),
    specs: root.Tree.Spec ?? [],
    active: {
      item: Number(root.Items.activeItemSet),
      skill: Number(root.Skills.activeSkillSet),
      config: Number(root.Config.activeConfigSet),
    },
    sets: {
      item: root.Items.ItemSet ?? [],
      skill: root.Skills.SkillSet ?? [],
      config: root.Config.ConfigSet ?? [],
    },
  };
}

function setById(doc: Doc, type: SetType, id: number): XmlSet {
  const set = doc.sets[type].find((s) => Number(s.id) === id);
  if (!set) throw new Error(`no ${type} set ${id} in the export`);
  return set;
}

const sortBy = <T>(list: T[], key: (x: T) => string): T[] => [...list].sort((a, b) => key(a).localeCompare(key(b)));

/** A set's content, independent of its id and title: slots, socket groups and gems, or inputs. */
function content(type: SetType, set: XmlSet): unknown {
  if (type === 'item') {
    return sortBy((set.Slot ?? []) as Attrs[], (s) => s.name).map((s) => ({ name: s.name, itemId: s.itemId, active: s.active ?? null }));
  }
  if (type === 'skill') return set.Skill ?? [];
  return sortBy((set.Input ?? []) as Attrs[], (s) => s.name);
}

function slot(set: XmlSet, name: string): Attrs {
  const s = ((set.Slot ?? []) as Attrs[]).find((x) => x.name === name);
  if (!s) throw new Error(`no slot ${name}`);
  return s;
}

// ---------------------------------------------------------------------------------------------------
// The tool's text, parsed

interface ListedSet {
  id: number;
  title: string;
  active: boolean;
  detail?: string;
}
interface ListedLoadout {
  name: string;
  active: boolean;
  detail: string;
}

function listedSets(text: string): ListedSet[] {
  const out: ListedSet[] = [];
  for (const line of text.split('\n')) {
    const m = /^(\d+)\. "(.*)"( \[active\])?(?: \| (.*))?$/.exec(line);
    if (m) out.push({ id: Number(m[1]), title: m[2], active: m[3] !== undefined, ...(m[4] ? { detail: m[4] } : {}) });
  }
  return out;
}

function listedLoadouts(text: string): ListedLoadout[] {
  const out: ListedLoadout[] = [];
  for (const line of text.split('\n')) {
    const m = /^- "(.*)"( \[active\])? \| (.*)$/.exec(line);
    if (m) out.push({ name: m[1], active: m[2] !== undefined, detail: m[3] });
  }
  return out;
}

const JUNK = /undefined|NaN|\[object Object\]/;

engineDescribe('L1 sets: manage_sets and the auto-level flag on the golden build (WU-35)', () => {
  let f: SessionFixture;

  beforeAll(async () => {
    f = await startSessionFixture({ testActions: true });
  }, ENGINE_TIMEOUT);

  afterAll(async () => {
    await f?.close();
  });

  async function freshGolden(): Promise<void> {
    const load = await f.call('lua_load_build', { build_name: 'grenadator.xml' });
    if (load.isError) throw new Error(`loading the golden build failed: ${load.text}`);
  }

  async function exportXml(): Promise<string> {
    const { value } = await f.session.run({ tool: 'test:sets-export', kind: 'read' }, async (ctx) => ctx.client.exportBuildXml());
    return value;
  }

  async function doc(): Promise<Doc> {
    return parseDoc(await exportXml());
  }

  async function luaQuery<T>(code: string): Promise<T> {
    const { value } = await f.session.run({ tool: 'test:sets-query', kind: 'read' }, async (ctx) => {
      const reply = await ctx.client.request('__test_eval', { code });
      return reply.result as T;
    });
    return value;
  }

  async function sets(args: Record<string, unknown>): Promise<string> {
    const out = await f.call('manage_sets', args);
    if (out.isError) throw new Error(`manage_sets ${JSON.stringify(args)} failed: ${out.text}`);
    expect(out.text).not.toMatch(JUNK);
    return out.text;
  }

  // -------------------------------------------------------------------------------------------------
  // AC-K23

  describe('AC-K23 (C-39 basics)', () => {
    for (const type of SET_TYPES) {
      it(
        `AC-K23: ${type} sets: create, copy, rename and select, each checked in the export`,
        async () => {
          await freshGolden();
          const start = await doc();
          const count = start.sets[type].length;
          const listed = listedSets(await sets({ set_type: type, action: 'list' }));
          expect(listed.map((s) => s.id)).toEqual(start.sets[type].map((s) => Number(s.id)));

          // create: id = previous count + 1, with that title, held in the export; not activated.
          const created = listedSets(await sets({ set_type: type, action: 'create', title: 'Act 2 (L25) {2}' }));
          expect(created.find((s) => s.id === count + 1)).toMatchObject({ title: 'Act 2 (L25) {2}', active: false });
          let d = await doc();
          expect(d.sets[type]).toHaveLength(count + 1);
          expect(setById(d, type, count + 1).title).toBe('Act 2 (L25) {2}');
          expect(d.active[type]).toBe(start.active[type]);

          // copy {id:1}: the same slots' item ids, socket groups and gems, or inputs as set 1.
          const copied = listedSets(await sets({ set_type: type, action: 'copy', id: 1, title: 'Copy {3}' }));
          expect(copied.find((s) => s.id === count + 2)).toMatchObject({ title: 'Copy {3}', active: false });
          d = await doc();
          expect(setById(d, type, count + 2).title).toBe('Copy {3}');
          expect(content(type, setById(d, type, count + 2))).toEqual(content(type, setById(d, type, 1)));
          expect(content(type, setById(d, type, 1))).toEqual(content(type, setById(start, type, 1)));

          // rename: only the title changes (same engine process, so the canonical export is comparable).
          const beforeRename = canonicalize(await exportXml());
          expect(beforeRename.split('title="Act 2 (L25) {2}"')).toHaveLength(2);
          await sets({ set_type: type, action: 'rename', id: count + 1, title: 'Renamed {2}' });
          const afterRename = canonicalize(await exportXml());
          expect(afterRename).toBe(beforeRename.replace('title="Act 2 (L25) {2}"', 'title="Renamed {2}"'));

          // select {id}: the export's active set of that type.
          const selected = listedSets(await sets({ set_type: type, action: 'select', id: count + 1 }));
          expect(selected.filter((s) => s.active).map((s) => s.id)).toEqual([count + 1]);
          d = await doc();
          expect(d.active[type]).toBe(count + 1);
        },
        ENGINE_TIMEOUT,
      );
    }
  });

  // -------------------------------------------------------------------------------------------------
  // AC-K24

  it(
    'AC-K24: after copy {id:1} and select {id:2} of each type, set_config, toggle_flask and add_gem change only set 2',
    async () => {
      await freshGolden();
      const start = await doc();
      for (const type of SET_TYPES) expect(start.sets[type]).toHaveLength(1);
      // The golden item set 1 holds item 5 in Charm 1, not active.
      expect(slot(setById(start, 'item', 1), 'Charm 1')).toMatchObject({ itemId: '5' });
      expect(slot(setById(start, 'item', 1), 'Charm 1').active).toBeUndefined();

      for (const type of SET_TYPES) {
        const listed = listedSets(await sets({ set_type: type, action: 'copy', id: 1 }));
        expect(listed.map((s) => s.id)).toEqual([1, 2]);
        // Untitled, the copy is "<source title> (Copy)"; the golden sets have no {id} tag.
        expect(listed[1].title).toBe('Default (Copy)');
      }
      let d = await doc();
      // Set 2 is not empty: item set 2 holds item 5 in Charm 1, not active; skill set 2 the golden groups.
      expect(slot(setById(d, 'item', 2), 'Charm 1')).toMatchObject({ itemId: '5' });
      expect(slot(setById(d, 'item', 2), 'Charm 1').active).toBeUndefined();
      expect(content('skill', setById(d, 'skill', 2))).toEqual(content('skill', setById(start, 'skill', 1)));
      expect((setById(d, 'skill', 2).Skill as unknown[]).length).toBeGreaterThan(0);

      for (const type of SET_TYPES) await sets({ set_type: type, action: 'select', id: 2 });
      d = await doc();
      expect(d.active).toEqual({ item: 2, skill: 2, config: 2 });
      const set1 = { item: content('item', setById(d, 'item', 1)), skill: content('skill', setById(d, 'skill', 1)), config: content('config', setById(d, 'config', 1)) };

      // set_config changes only config set 2's <Input>.
      const cfg = await f.call('set_config', { config_name: 'enemyLevel', value: 70 });
      expect(cfg.isError).toBe(false);
      d = await doc();
      expect(content('config', setById(d, 'config', 1))).toEqual(set1.config);
      const level = ((setById(d, 'config', 2).Input ?? []) as Attrs[]).find((i) => i.name === 'enemyLevel');
      expect(level).toMatchObject({ number: '70' });

      // toggle_flask gives active="true" only to item set 2's Charm 1.
      const flask = await f.call('toggle_flask', { slot: 'Charm 1', active: true });
      expect(flask.isError).toBe(false);
      d = await doc();
      expect(slot(setById(d, 'item', 2), 'Charm 1')).toMatchObject({ itemId: '5', active: 'true' });
      expect(slot(setById(d, 'item', 1), 'Charm 1')).toMatchObject({ itemId: '5' });
      expect(slot(setById(d, 'item', 1), 'Charm 1').active).toBeUndefined();
      expect(content('item', setById(d, 'item', 1))).toEqual(set1.item);

      // add_gem changes only skill set 2.
      const groups = (setById(d, 'skill', 2).Skill as XmlSet[]).length;
      const gemsBefore = ((setById(d, 'skill', 2).Skill as XmlSet[])[0].Gem as unknown[]).length;
      const gem = await f.call('add_gem', { group_index: 1, gem_name: 'Fireball' });
      expect(gem.isError).toBe(false);
      d = await doc();
      expect(content('skill', setById(d, 'skill', 1))).toEqual(set1.skill);
      const set2Groups = setById(d, 'skill', 2).Skill as XmlSet[];
      expect(set2Groups).toHaveLength(groups);
      expect((set2Groups[0].Gem as Attrs[]).length).toBe(gemsBefore + 1);
      expect((set2Groups[0].Gem as Attrs[]).map((g) => g.nameSpec)).toContain('Fireball');

      // set_main_skill's skill_part (PoB2's per-gem stat set, saved as <StatSetIndex>) on set 2 leaves set 1's
      // StatSetIndex unchanged: the copy doesn't share the gem's stat-set table with set 1.
      const gasIndex = (setById(d, 'skill', 2).Skill as XmlSet[]).findIndex((g) =>
        ((g.Gem ?? []) as Attrs[]).some((gem) => gem.nameSpec === 'Gas Grenade'),
      ) + 1;
      expect(gasIndex).toBeGreaterThan(0);
      const statSets = (set: XmlSet) =>
        (((set.Skill as XmlSet[])[gasIndex - 1].Gem as XmlSet[]).find((gem) => gem.nameSpec === 'Gas Grenade')!.StatSetIndex ?? []) as Attrs[];
      const set1StatSets = statSets(setById(d, 'skill', 1));
      expect(set1StatSets.map((x) => x.index)).not.toContain('2');
      const part = await f.call('set_main_skill', { group_index: gasIndex, skill_part: 2 });
      expect(part.isError).toBe(false);
      d = await doc();
      expect(statSets(setById(d, 'skill', 2)).map((x) => x.index)).toEqual(['2']);
      expect(statSets(setById(d, 'skill', 1))).toEqual(set1StatSets);
      expect(content('skill', setById(d, 'skill', 1))).toEqual(set1.skill);
      // And PoB's own tables: set 2's gem has its own stat-set table.
      expect(
        await luaQuery<boolean>(
          `local function gem(set) for _, g in ipairs(build.skillsTab.skillSets[set].socketGroupList[${gasIndex}].gemList) do if g.nameSpec == 'Gas Grenade' then return g end end end; return gem(1).statSet ~= gem(2).statSet`,
        ),
      ).toBe(true);
    },
    ENGINE_TIMEOUT,
  );

  it(
    'D-245: an untitled copy of "S {1}" is "S (Copy)", so loadout 1 keeps the source set',
    async () => {
      await freshGolden();
      expect((await f.call('create_spec', { title: 'Act 1 {1}', activate: false })).isError).toBe(false);
      await sets({ set_type: 'item', action: 'create', title: 'S {1}' });
      const before = listedLoadouts(await sets({ set_type: 'loadout', action: 'list' })).find((l) => l.name === 'Act 1 {1}');
      expect(before?.detail).toBe('tree spec 2, item set 2, skill set 1, config set 1');

      const copied = listedSets(await sets({ set_type: 'item', action: 'copy', id: 2 }));
      expect(copied.find((s) => s.id === 3)?.title).toBe('S (Copy)');
      expect(setById(await doc(), 'item', 3).title).toBe('S (Copy)');
      const after = listedLoadouts(await sets({ set_type: 'loadout', action: 'list' })).find((l) => l.name === 'Act 1 {1}');
      expect(after?.detail).toBe('tree spec 2, item set 2, skill set 1, config set 1');
      // PoB's own lookup agrees.
      expect(await luaQuery<number>("build:SyncLoadouts(); return build:GetLoadoutByName('Act 1 {1}').itemSetId")).toBe(2);
    },
    ENGINE_TIMEOUT,
  );

  it(
    'D-244: list runs as a read: revision and the unsaved state are unchanged; a create is a mutate',
    async () => {
      await freshGolden();
      const revision = f.session.revision;
      expect(f.session.isDirty()).toBe(false);
      const before = canonicalize(await exportXml());
      for (const type of [...SET_TYPES, 'loadout']) {
        await sets({ set_type: type, action: 'list' });
        expect({ type, revision: f.session.revision, dirty: f.session.isDirty() }).toEqual({ type, revision, dirty: false });
      }
      expect(canonicalize(await exportXml())).toBe(before);
      await sets({ set_type: 'item', action: 'create', title: 'New' });
      expect(f.session.revision).toBe(revision + 1);
      expect(f.session.isDirty()).toBe(true);
    },
    ENGINE_TIMEOUT,
  );

  // -------------------------------------------------------------------------------------------------
  // AC-K25

  it(
    'AC-K25: a title whose {...} group breaks [A-Za-z0-9,] is refused, naming the rule, and changes nothing',
    async () => {
      await freshGolden();
      for (const type of SET_TYPES) {
        for (const title of ['Early {1, 2}', 'Early {}']) {
          const before = canonicalize(await exportXml());
          const revision = f.session.revision;
          const out = await f.call('manage_sets', { set_type: type, action: 'create', title });
          expect({ type, title, isError: out.isError }).toEqual({ type, title, isError: true });
          expect(out.text).toContain('[A-Za-z0-9,]');
          expect(f.session.revision).toBe(revision);
          expect(canonicalize(await exportXml())).toBe(before);
        }
        const ok = listedSets(await sets({ set_type: type, action: 'create', title: 'Early {1,2}' }));
        expect(ok.find((s) => s.title === 'Early {1,2}')).toBeDefined();
      }
      // D-245: at most one tag, at the end, of comma-separated non-empty ids.
      for (const title of ['Early {,}', 'Early {1,}', 'Early {,1}', 'Early {1,,2}', 'Early {1} Late {2}', 'Early {1} late', 'Early {1']) {
        const before = canonicalize(await exportXml());
        const revision = f.session.revision;
        const out = await f.call('manage_sets', { set_type: 'item', action: 'create', title });
        expect({ title, isError: out.isError }).toEqual({ title, isError: true });
        expect(out.text).toContain('[A-Za-z0-9,]');
        expect(f.session.revision).toBe(revision);
        expect(canonicalize(await exportXml())).toBe(before);
      }
      // rename and copy titles follow the same rule.
      const revision = f.session.revision;
      expect((await f.call('manage_sets', { set_type: 'item', action: 'rename', id: 1, title: 'Late {3 }' })).isError).toBe(true);
      expect((await f.call('manage_sets', { set_type: 'skill', action: 'copy', id: 1, title: 'Late {a-b}' })).isError).toBe(true);
      expect(f.session.revision).toBe(revision);
    },
    ENGINE_TIMEOUT,
  );

  // -------------------------------------------------------------------------------------------------
  // AC-K26

  it(
    'AC-K26: use_second_weapon_set writes useSecondWeaponSet="true" on the new item set; with set_type skill it is an error',
    async () => {
      await freshGolden();
      const text = await sets({ set_type: 'item', action: 'create', title: 'Swap', use_second_weapon_set: true });
      const listed = listedSets(text);
      expect(listed.find((s) => s.title === 'Swap')).toMatchObject({ id: 2, detail: 'second weapon set: yes' });
      expect(listed.find((s) => s.id === 1)).toMatchObject({ detail: 'second weapon set: no' });
      const d = await doc();
      expect(setById(d, 'item', 2)).toMatchObject({ title: 'Swap', useSecondWeaponSet: 'true' });
      expect(await luaQuery<boolean>('return build.itemsTab.itemSets[2].useSecondWeaponSet == true')).toBe(true);
      expect(await luaQuery<boolean>('return build.itemsTab.itemSets[1].useSecondWeaponSet == true')).toBe(false);

      const revision = f.session.revision;
      const bad = await f.call('manage_sets', { set_type: 'skill', action: 'create', title: 'Swap', use_second_weapon_set: true });
      expect(bad.isError).toBe(true);
      expect(bad.text).toContain('use_second_weapon_set');
      expect(f.session.revision).toBe(revision);
    },
    ENGINE_TIMEOUT,
  );

  // -------------------------------------------------------------------------------------------------
  // AC-K27

  describe('AC-K27 (C-39 loadouts)', () => {
    /** create_spec "Act 1 {1}" plus item set "Early {1}", skill set "Act 1 {1}" and config set "Campaign". */
    async function setUpLoadout(): Promise<void> {
      await freshGolden();
      const spec = await f.call('create_spec', { title: 'Act 1 {1}', activate: false });
      expect(spec.isError).toBe(false);
      await sets({ set_type: 'item', action: 'create', title: 'Early {1}' });
      await sets({ set_type: 'skill', action: 'create', title: 'Act 1 {1}' });
      await sets({ set_type: 'config', action: 'create', title: 'Campaign' });
    }

    it(
      'AC-K27: select "Act 1 {1}" straight after a rename (no list between) activates its four sets; list has no ^7 row',
      async () => {
        await setUpLoadout();
        const before = await doc();
        expect(before.activeSpec).toBe(1);
        expect(before.active).toEqual({ item: 1, skill: 1, config: 1 });

        // The config set joins loadout 1 only by this rename; no list runs before the select.
        await sets({ set_type: 'config', action: 'rename', id: 2, title: 'Campaign {1}' });
        const text = await sets({ set_type: 'loadout', action: 'select', title: 'Act 1 {1}' });
        const d = await doc();
        expect(d.activeSpec).toBe(2);
        expect(d.specs[1].title).toBe('Act 1 {1}');
        expect(d.active).toEqual({ item: 2, skill: 2, config: 2 });
        expect(setById(d, 'item', 2).title).toBe('Early {1}');
        expect(setById(d, 'skill', 2).title).toBe('Act 1 {1}');
        expect(setById(d, 'config', 2).title).toBe('Campaign {1}');
        expect(listedLoadouts(text).find((l) => l.name === 'Act 1 {1}')).toMatchObject({
          active: true,
          detail: 'tree spec 2, item set 2, skill set 2, config set 2',
        });

        const list = await sets({ set_type: 'loadout', action: 'list' });
        expect(list).not.toContain('^7');
        const loadouts = listedLoadouts(list);
        expect(loadouts.map((l) => l.name)).toContain('Act 1 {1}');
        // The list is PoB's own: the synced loadout menu without its ^7^7 rows.
        const menu = await luaQuery<string[]>(
          "build:SyncLoadouts(); local out = {}; for _, e in ipairs(build.controls.buildLoadouts.list) do if e:sub(1, 4) ~= '^7^7' then out[#out + 1] = e end end; return out",
        );
        expect(loadouts.map((l) => l.name)).toEqual(menu);
        expect(loadouts.filter((l) => l.active).map((l) => l.name)).toEqual(['Act 1 {1}']);
      },
      ENGINE_TIMEOUT,
    );

    it(
      'AC-K27: an unknown loadout name is an error and the engine still answers ping; a loadout create, copy or rename is an error',
      async () => {
        await setUpLoadout();
        await sets({ set_type: 'config', action: 'rename', id: 2, title: 'Campaign {1}' });
        const pid = f.session.enginePid();
        const revision = f.session.revision;
        const before = canonicalize(await exportXml());
        for (const title of ['Act 9 {9}', 'Nowhere']) {
          const out = await f.call('manage_sets', { set_type: 'loadout', action: 'select', title });
          expect({ title, isError: out.isError }).toEqual({ title, isError: true });
          expect(out.text).toContain(`no loadout named "${title}"`);
          expect(out.text).toContain('"Act 1 {1}"');
        }
        const { value: pong } = await f.session.run({ tool: 'test:ping', kind: 'read' }, async (ctx) => ctx.client.request('ping'));
        expect(pong).toMatchObject({ ok: true, pong: true });
        expect(f.session.enginePid()).toBe(pid);

        for (const action of ['create', 'copy', 'rename']) {
          const out = await f.call('manage_sets', { set_type: 'loadout', action, id: 1, title: 'Act 1 {1}' });
          expect({ action, isError: out.isError }).toEqual({ action, isError: true });
          expect(out.text).toContain('a loadout takes only list and select');
        }
        expect(f.session.revision).toBe(revision);
        expect(canonicalize(await exportXml())).toBe(before);
      },
      ENGINE_TIMEOUT,
    );

    it('AC-K27: the action enum is exactly list, create, copy, rename and select, and no code in pob-api or src names CopyLoadout', async () => {
      const tools = (await f.server.client.listTools()).tools;
      const tool = tools.find((t) => t.name === 'manage_sets');
      expect(tool).toBeDefined();
      const props = tool!.inputSchema.properties as Record<string, { enum?: string[] }>;
      expect(props.action.enum).toEqual(['list', 'create', 'copy', 'rename', 'select']);
      expect(props.set_type.enum).toEqual(['item', 'skill', 'config', 'loadout']);
      expect(TOOL_META.manage_sets).toEqual({ engine: 'mutate', group: 'core' });

      const hits: string[] = [];
      const walk = (dir: string): void => {
        for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
          const p = path.join(dir, e.name);
          if (e.isDirectory()) walk(p);
          else if (fs.readFileSync(p, 'utf8').includes('CopyLoadout')) hits.push(path.relative(REPO, p));
        }
      };
      walk(path.join(REPO, 'pob-api'));
      walk(path.join(REPO, 'src'));
      expect(hits).toEqual([]);
    });
  });

  // -------------------------------------------------------------------------------------------------
  // AC-K28

  it(
    "AC-K28: with an empty skill set 2, the skill list shows set 1's group at mainSocketGroup as get_skill_setup does, and none for set 2",
    async () => {
      await freshGolden();
      const text = await sets({ set_type: 'skill', action: 'create', title: 'Empty {2}' });
      const main = await luaQuery<number>('return build.mainSocketGroup');
      expect(main).toBe(11);
      expect(text).toContain(`The main socket group index, ${main}, is shared by every skill set`);
      const listed = listedSets(text);
      expect(listed.find((s) => s.id === 2)).toMatchObject({ title: 'Empty {2}', detail: `main group ${main}: none` });

      // get_skill_setup's main group: its label (shown only when set) and its active skills.
      const setup = await f.call('get_skill_setup', {});
      expect(setup.isError).toBe(false);
      const block = setup.text.split(`**Group ${main} (MAIN)**`)[1].split('\n\n')[0];
      const label = /^ {2}Label: (.*)$/m.exec(block)?.[1];
      const skills = /^ {2}Active Skills: (.*)$/m.exec(block)?.[1];
      expect(skills).toBeDefined();
      expect(listed.find((s) => s.id === 1)?.detail).toBe(
        `main group ${main}: label ${label ? `"${label}"` : '(none)'}; active skills: ${skills}`,
      );
      // And both agree with PoB: the group's calculated skill list.
      const pob = await luaQuery<string[]>(
        `local out = {}; for _, e in ipairs(build.skillsTab.skillSets[1].socketGroupList[${main}].displaySkillList) do out[#out + 1] = e.activeEffect.grantedEffect.name end; return out`,
      );
      expect(skills).toBe(pob.join(', '));
    },
    ENGINE_TIMEOUT,
  );

  // -------------------------------------------------------------------------------------------------
  // AC-K29

  it(
    'AC-K29: every set, title, use_second_weapon_set and loadout from AC-K23..K27 survives lua_save_build and lua_load_build',
    async () => {
      await freshGolden();
      // AC-K23's sets, AC-K26's weapon swap set, AC-K27's loadout (spec and three sets), AC-K24's copies.
      for (const type of SET_TYPES) {
        await sets({ set_type: type, action: 'create', title: 'Act 2 (L25) {2}' });
        await sets({ set_type: type, action: 'copy', id: 1, title: 'Copy {3}' });
        await sets({ set_type: type, action: 'rename', id: 2, title: 'Renamed {2}' });
      }
      await sets({ set_type: 'item', action: 'create', title: 'Swap', use_second_weapon_set: true });
      expect((await f.call('create_spec', { title: 'Act 1 {1}', activate: false })).isError).toBe(false);
      await sets({ set_type: 'item', action: 'create', title: 'Early {1}' });
      await sets({ set_type: 'skill', action: 'create', title: 'Act 1 {1}' });
      await sets({ set_type: 'config', action: 'create', title: 'Campaign {1}' });
      await sets({ set_type: 'loadout', action: 'select', title: 'Act 1 {1}' });

      const lists = async () => {
        const out: Record<string, string> = {};
        for (const type of [...SET_TYPES, 'loadout']) out[type] = await sets({ set_type: type, action: 'list' });
        return out;
      };
      const summary = (d: Doc) => ({
        activeSpec: d.activeSpec,
        specs: d.specs.map((s) => s.title ?? 'Default'),
        active: d.active,
        // PoB writes an unset flag as "nil" and, once reloaded, as "false": the value is whether it is "true".
        item: d.sets.item.map((s) => ({ id: s.id, title: s.title, secondWeaponSet: s.useSecondWeaponSet === 'true', content: content('item', s) })),
        skill: d.sets.skill.map((s) => ({ id: s.id, title: s.title, content: content('skill', s) })),
        config: d.sets.config.map((s) => ({ id: s.id, title: s.title, content: content('config', s) })),
      });
      const beforeLists = await lists();
      const before = summary(await doc());
      expect(listedLoadouts(beforeLists.loadout).find((l) => l.name === 'Act 1 {1}')?.active).toBe(true);
      expect(before.item.find((s) => s.title === 'Swap')?.secondWeaponSet).toBe(true);
      expect(before.item.filter((s) => s.secondWeaponSet).map((s) => s.title)).toEqual(['Swap']);

      const save = await f.call('lua_save_build', { build_name: 'sets-roundtrip' });
      expect(save.isError).toBe(false);
      const load = await f.call('lua_load_build', { build_name: 'sets-roundtrip.xml' });
      expect(load.isError).toBe(false);

      expect(summary(await doc())).toEqual(before);
      expect(await lists()).toEqual(beforeLists);
    },
    ENGINE_TIMEOUT,
  );

  // -------------------------------------------------------------------------------------------------
  // AC-K30

  describe('AC-K30 (D-196 auto-level)', () => {
    async function setLevel(level: number, autoMode?: boolean): Promise<void> {
      await f.session.run({ tool: 'test:set-level', kind: 'mutate' }, async (ctx) =>
        ctx.client.setLevel(level, autoMode === undefined ? {} : { autoMode }),
      );
    }

    it(
      'AC-K30: set_level {level:40, autoMode:true} writes characterLevelAutoMode="true"; {level:41} writes "false"',
      async () => {
        await freshGolden();
        await setLevel(40, true);
        expect((await doc()).build).toMatchObject({ level: '40', characterLevelAutoMode: 'true' });
        await setLevel(41);
        expect((await doc()).build).toMatchObject({ level: '41', characterLevelAutoMode: 'false' });
      },
      ENGINE_TIMEOUT,
    );

    it(
      'AC-K30: set_character_level {level:42} writes manual mode, and its schema has no auto argument',
      async () => {
        await freshGolden();
        await setLevel(40, true);
        const out = await f.call('set_character_level', { level: 42 });
        expect(out.isError).toBe(false);
        expect((await doc()).build).toMatchObject({ level: '42', characterLevelAutoMode: 'false' });
        const tool = (await f.server.client.listTools()).tools.find((t) => t.name === 'set_character_level');
        expect(Object.keys(tool!.inputSchema.properties ?? {})).toEqual(['level']);
      },
      ENGINE_TIMEOUT,
    );

    it(
      'AC-K30: after an auto-mode set_level run as mutate, a killed engine is restored with characterLevelAutoMode="true" (D-198)',
      async () => {
        await freshGolden();
        await setLevel(40, true);
        expect((await doc()).build).toMatchObject({ level: '40', characterLevelAutoMode: 'true' });
        const pid = await killEngine(f.session);
        const info = await f.call('lua_get_build_info', {});
        expect(info.isError).toBe(false);
        expect(f.session.enginePid()).not.toBe(pid);
        expect((await doc()).build).toMatchObject({ level: '40', characterLevelAutoMode: 'true' });
      },
      ENGINE_TIMEOUT,
    );
  });
});

describe('L1 sets: manage_sets samples (static, AC-B2, AC-B3, D-244)', () => {
  it('AC-B2: tool-calls.json has ok samples for manage_sets (lists as reads, the rest state-changing mutates), the slice sample, and error samples', () => {
    const samples = JSON.parse(fs.readFileSync(path.join(FIXTURES, 'tool-calls.json'), 'utf8')) as Array<{
      tool: string;
      args: Record<string, unknown>;
      expect: string;
      stateChange?: boolean;
    }>;
    const mine = samples.filter((s) => s.tool === 'manage_sets');
    expect(mine.filter((s) => s.expect === 'ok').length).toBeGreaterThan(0);
    // D-244: a list is a read (the engine-kind check then wants the export and revision unchanged); every
    // other ok sample is a mutate that changes the build (AC-B3), so none declares stateChange:false.
    const lists = mine.filter((s) => s.expect === 'ok' && s.args.action === 'list');
    expect(lists.map((s) => s.args.set_type).sort()).toEqual(['config', 'item', 'loadout', 'skill']);
    for (const s of mine.filter((x) => x.expect === 'ok')) {
      expect({ args: s.args, kind: engineKindFor('manage_sets', s.args) }).toEqual({
        args: s.args,
        kind: s.args.action === 'list' ? 'read' : 'mutate',
      });
      expect(s.stateChange).toBeUndefined();
    }
    expect(mine).toContainEqual(
      expect.objectContaining({ args: { set_type: 'skill', action: 'create', title: 'Sample {2}' }, expect: 'ok' }),
    );
    expect(mine.filter((s) => s.expect === 'error').length).toBeGreaterThan(0);
  });
});
