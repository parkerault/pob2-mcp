/**
 * AC-W149 (WU-160, D-517, D-518's schema part; amendment 16 §13, §14, §20 and Appendix A.5, A.7): the file reader on the
 * committed fixtures, through `plan_from_build` in process (no engine).
 *
 * `tests/fixtures/builds/imported-character.xml` (and its code, `imported-character.code.txt`) is in PoB's own
 * importer's shape, built by hand from the game data; `imported-ninja.xml` in poe.ninja's export's. Each rule of §13 is
 * met on its case: rolls from the item text, base matching, `left` and `stand_in`, PG-111's line, the granted copies
 * by support, level and weapon set, each kept copy's gem at quality 0 (a planted 5 named), plan-numbered questions,
 * `mainActiveSkill`, `"nil"` as false, `role`, `config.file` and `enemyIsBoss`, `importLeague`, `buffs_on` and
 * `buffs_swap` (and `switch_off`, the coordinator's ruling departing from Appendix A.7), `corrupt`, `treeJewels` (a jewel on
 * a base the pin lacks asked about and stood in; one whose socket the newest tree lacks named), `attributeChoices`, the
 * party tab counted only by its `<ImportedBuffs>`; the plan passes schema 11. By name and by code the importer
 * fixture gives the same plan but `source`. Neither fixture holds a character hash or an account name.
 */
import fs from 'fs';
import path from 'path';
import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { IMPORTER, IMPORTER_CODE, NINJA, readerLayout, sha1, textOf, type Json, type ReaderLayout } from '../helpers/planFromBuild';
import { loadReferenceData } from '../../src/plan/referenceData';
import { validatePlan } from '../../src/plan/schema';
import { decodePobCode, encodePobCode } from '../../src/utils/buildCode';
import { loadReaderGameData, readItem, withModRanges } from '../../src/services/fileReader';

const REPO = path.resolve(__dirname, '..', '..');
const POB_SRC = path.join(REPO, 'vendor', 'PathOfBuilding-PoE2', 'src');
const xml = fs.readFileSync(IMPORTER, 'utf8');
const code = fs.readFileSync(IMPORTER_CODE, 'utf8').trim();
const ref = loadReferenceData(path.join(REPO, 'data'));

describe('AC-W149 (WU-160): the committed fixtures', () => {
  it("the importer fixture's code decodes to the fixture, byte for byte", () => {
    expect(decodePobCode(code)).toBe(xml);
  });

  it('neither fixture holds a character hash or an account name: <Import> carries only the realm, the league and exportParty', () => {
    for (const file of [IMPORTER, NINJA]) {
      const text = fs.readFileSync(file, 'utf8');
      expect(text).not.toMatch(/lastCharacterHash|lastAccountHash|accountName|lastCharacter=/i);
      const imp = /<Import ([^>]*)\/>/.exec(text)?.[1] ?? '';
      const keys = [...imp.matchAll(/(\w+)="/g)].map((m) => m[1]);
      expect(keys.every((k) => ['lastRealm', 'lastLeague', 'exportParty'].includes(k))).toBe(true);
    }
  });
});

describe('AC-W149 (WU-160): the reader on the importer fixture', () => {
  let L: ReaderLayout;
  let byName: string;
  let plan: Json;
  let stage: Json;
  let read: Json;
  let reply: string;
  const slot = (name: string): Json | undefined => stage.items.slots.find((s: Json) => s.slot === name);
  const groupNames = (g: Json) => g.gems.map((x: Json) => x.name);

  beforeAll(async () => {
    L = await readerLayout();
    byName = L.run();
    const r = await L.call({ run_folder: byName, build_name: 'imported-character' });
    if (r.isError) throw new Error(textOf(r));
    reply = textOf(r);
    plan = L.json(byName, 'plan.json');
    stage = plan.stages[0];
    read = L.json(byName, 'read.json');
  });
  afterAll(async () => {
    await L?.close();
  });

  it('by name and by code it gives the same plan but source', async () => {
    const byCode = L.run();
    const r = await L.call({ run_folder: byCode, import_code: code });
    expect(r.isError).toBeFalsy();
    const other = L.json(byCode, 'plan.json');
    expect(other.stages[0].source).toEqual({ kind: 'import-code', sha1: sha1(xml), loadout: 'Endgame' });
    const strip = (p: Json) => ({ ...p, stages: p.stages.map(({ source, ...rest }: Json) => rest) });
    expect(strip(other)).toEqual(strip(plan));
    expect(L.files(byCode)['source.xml']).toBe(xml);
  });

  it('the plan passes schema 11: one read stage f, endgame, no variant, at the file\'s level, its loadout name from the title', () => {
    const v = validatePlan(plan, ref);
    expect(v.ok ? true : v.errors).toBe(true);
    expect(plan.schemaVersion).toBe(11);
    expect(plan.league).toBeNull();
    expect(plan.roll).toEqual({ className: 'Mercenary', ascendancy: 'Gemling Legionnaire', skill: 'Whirling Slash' });
    expect(plan.stages).toHaveLength(1);
    expect(stage).toMatchObject({ id: 'f', progress: 'endgame', level: 90, loadoutName: 'Endgame (L90) {f}' });
    expect(stage.variant).toBeUndefined();
    expect(reply.split('\n')[0]).toBe('Read imported-character.xml (Endgame) into compile/2026-12-01-1/plan.json: stage f, level 90, 13 items (13 owned), 11 groups.');
  });

  it('the tree: starts left out, ascendancy nodes apart, weapon-set tags, attribute choices; the socketed jewel owned', () => {
    expect(stage.tree.nodes).toEqual([59915, 7741, 42500, 59881, 54417, 49657, 63526, 48635, 21755, 54127, 43578, 19223]);
    expect(stage.tree.ascendancyNodes).toEqual([34882, 11641]);
    expect(stage.tree.weaponSetNodes).toEqual({ set1: [43578], set2: [19223] });
    expect(stage.tree.attributeChoices).toEqual([
      { node: 7741, attribute: 'strength' },
      { node: 21755, attribute: 'intelligence' },
      { node: 42500, attribute: 'strength' },
      { node: 48635, attribute: 'intelligence' },
      { node: 49657, attribute: 'dexterity' },
      { node: 54417, attribute: 'dexterity' },
      { node: 59881, attribute: 'strength' },
      { node: 63526, attribute: 'dexterity' },
    ]);
    expect(stage.items.treeJewels).toEqual([{ node: 54127, text: 'Rarity: RARE\nPhoenix Wound\nRuby\nItem Level: 81\nImplicits: 0\n+12% to Fire Resistance\n10% increased Attack Damage', owned: true }]);
  });

  it("rolls: a {range:} text is kept (PG-109: never PoB's misnumbered <ModRange>); an item with no tag reads its <ModRange> as PoB's load does; plain lines stay plain", () => {
    expect(slot('Boots')?.text).toContain('{range:0.8}+(20-30)% to Fire Resistance\n{range:0.25}+(40-60) to maximum Life\n30% increased Movement Speed');
    expect(slot('Ring 2')?.text).toContain('Grants 1 additional Skill Slot\n{range:0.75}+(40-60) to maximum Life\n+28% to Lightning Resistance');
    const spear = String(slot('Weapon 1')?.text);
    expect(spear).not.toContain('{range:');
    expect(spear).toBe(xml.split('<Item id="1">\n')[1].split('\t\t\t<ModRange')[0].trim());
  });

  it('items as owned: every slot the plan holds, the swap slots, the magic flask and charm by the longest base their names hold, the crafted, fractured, desecrated and corrupted body', () => {
    expect(stage.items.slots.map((s: Json) => s.slot)).toEqual([
      'Weapon 1', 'Weapon 2', 'Weapon 1 Swap', 'Weapon 2 Swap', 'Body Armour', 'Amulet', 'Boots', 'Ring 1', 'Ring 2', 'Belt', 'Flask 1', 'Charm 1',
    ]);
    expect(stage.items.slots.every((s: Json) => s.owned === true && s.standIn === undefined)).toBe(true);
    const body = String(slot('Body Armour')?.text);
    for (const line of ['Sockets: S S S', 'Rune: Legacy of Blackbraid', '{fractured}+92 to maximum Life', '{crafted}+30% to Fire Resistance', '{desecrated}+25% to Chaos Resistance', 'Corrupted']) {
      expect(body).toContain(line);
    }
    const data = loadReaderGameData(POB_SRC);
    expect(readItem(String(slot('Flask 1')?.text).split('\n'), data).base?.name).toBe('Ultimate Life Flask');
    expect(readItem(String(slot('Charm 1')?.text).split('\n'), data).base?.name).toBe('Thawing Charm');
    expect(stage.items.toggles).toEqual([
      { slot: 'Flask 1', active: true, uptime: 'as the file has it' },
      { slot: 'Charm 1', active: true, uptime: 'as the file has it' },
    ]);
  });

  it('`"nil"` reads as false: useSecondWeaponSet is false, as PoB reads it', () => {
    expect(xml).toContain('<ItemSet useSecondWeaponSet="nil" title="Endgame" id="1">');
    expect(stage.items.useSecondWeaponSet).toBe(false);
  });

  it('left: the base the pin lacks (PG-110, with a stand_in question), the Arm slot, the gem the pin lacks (with a question)', () => {
    expect(read.left.map((l: Json) => ({ ...l, text: undefined }))).toEqual([
      { slot: 'Gloves', reason: "base Runemastered Plated Mitts isn't in the pin (PG-110)" },
      { slot: 'Arm 1', reason: 'the plan has no Arm 1 slot' },
      { fileGroup: 8, gem: 'Glacial Bloom', reason: 'the pin has no gem Glacial Bloom (PG-110)' },
    ]);
    expect(read.left[0].text).toContain('Runemastered Plated Mitts');
    expect(slot('Gloves')).toBeUndefined();
    expect(read.questions.map((q: Json) => q.field)).toEqual(['loadout', 'main_group', 'stand_in.Gloves', 'gem']);
    expect(reply).toContain('- stand_in.Gloves: plan none, file "Runemastered Plated Mitts"; what Gloves holds: an item text on a base the pin has, or "plain base" (Plated Mitts');
    expect(stage.skills.groups[4].gems.map((g: Json) => g.name)).toEqual(['Herald of Ice', 'Elemental Armament II']);
  });

  it("PG-111: a text on a base the pin defines twice with no Implicits: line is named; one with its line isn't", () => {
    expect(read.doubleDefined).toEqual([
      { slot: 'Ring 1', base: 'Two-Stone Ring', reason: 'the pin defines this base more than once and keeps the last; the text has no Implicits: line (PG-111)' },
    ]);
    expect(slot('Weapon 2 Swap')?.text).toContain('Implicits: 1\nGrants Skill: Level 20 Purity of Ice');
  });

  it('PG-108: the granted copies by support, level and weapon set; PoB\'s own granted groups not written', () => {
    expect(stage.skills.groups.map(groupNames)).toEqual([
      ['Spear Throw', 'Frost Nexus'],
      ['Virtuous Barrier'],
      ['Purity of Ice', 'Clarity II'],
      ['Twister', 'Salvo', 'Projectile Acceleration III'],
      ['Herald of Ice', 'Elemental Armament II'],
      ['Trinity', 'Fire Mastery'],
      ['Blasphemy', 'Despair', 'Heightened Curse'],
      ['Whirling Slash', 'Bloodlust', 'Rage III', 'Rapid Attacks III', 'Blazing Critical', "Rigwald's Ferocity", 'Magnified Area II'],
      ['Wind Dancer', 'Magnified Area II'],
      ['Combat Frenzy', 'Charge Profusion II'],
      ['Parry', 'Heft'],
    ]);
    expect(read.groups).toEqual([1, 3, 4, 7, 8, 9, 10, 11, 12, 13, 16].map((file, i) => ({ plan: i + 1, file })));
    // The supported copy over the unsupported one; a granted group with supports added in desktop PoB when no copy has
    // more; an unsupported copy at PoB's level dropped.
    expect(read.dropped).toEqual([
      { fileGroup: 2, skill: 'Spear Throw', reason: "a copy of a granted skill with 0 enabled supports; the kept copy is the file's group 1 (PG-108)" },
      { fileGroup: 5, skill: 'Parry', reason: "a copy of a granted skill with 0 enabled supports; the kept copy is the file's group 16 (PG-108)" },
      { fileGroup: 6, skill: 'Lightning Bolt', reason: "a copy of a granted skill with no support, at its group's level 20 (PG-108)" },
    ]);
    // An unsupported copy at another level than PoB's group's kept, both levels in read.json.
    expect(read.levels).toEqual([{ skill: 'Virtuous Barrier', copy: 20, granted: 1 }]);
    // Weapon sets: both spears grant Spear Throw (both sets), the sceptre in Weapon 2 Swap (set 2), the buckler (set 1),
    // the tree (both).
    expect(stage.skills.groups.map((g: Json) => g.weaponSet ?? 'both')).toEqual([
      'both', 'both', 2, 'both', 'both', 'both', 'both', 'both', 'both', 'both', 1,
    ]);
    expect(stage.skills.groups.every((g: Json) => g.owned === true)).toBe(true);
  });

  it('PG-114: each kept copy\'s gem at quality 0, the planted 5 named', () => {
    expect(stage.skills.groups[2].gems[0]).toEqual({ name: 'Purity of Ice', level: 20, quality: 0, enabled: true });
    expect(read.grantedQuality).toEqual([
      { plan: 3, file: 4, skill: 'Purity of Ice', fileQuality: 5, reason: 'a granted skill has no quality of its own (PG-114, §8): written at 0' },
    ]);
    for (const n of [0, 1, 10]) expect(stage.skills.groups[n].gems[0].quality).toBe(0);
  });

  it("PG-113: the main skill a plan-numbered question, the file's guess standing, unconfirmed; mainActiveSkill names a two-skill group's", () => {
    expect(stage.skills.main).toEqual({ group: 8, activeSkill: 1 });
    expect(stage.skills.rolledGroup).toBe(8);
    const q = read.questions.find((x: Json) => x.field === 'main_group');
    expect(q).toMatchObject({ planValue: 8, fileValue: 11, note: "PoB's choice, possibly its guess" });
    expect(q.groups).toContain('7 Blasphemy, Despair (mainActiveSkill 2: Despair)');
    expect(q.groups).toContain('4 Twister');
    expect(read.unconfirmed).toEqual(['main_group']);
    expect(stage.skills.groups.map((g: Json) => g.role)).toEqual(['utility', 'utility', 'utility', 'utility', 'utility', 'utility', 'utility', 'single_target', 'utility', 'utility', 'utility']);
  });

  it('a gem corrupted +1 as corrupt; another corruptLevel kept as the level and named; a group count from the file; the legacy gem kept and named', () => {
    expect(stage.skills.groups[3].gems[0]).toEqual({ name: 'Twister', level: 20, quality: 20, enabled: true, corrupt: 'plus_one_level' });
    expect(stage.skills.groups[9].gems[0]).toEqual({ name: 'Combat Frenzy', level: 17, quality: 20, enabled: true });
    expect(read.corruptLevels).toEqual([{ plan: 10, gem: 'Combat Frenzy', corruptLevel: -1, level: 17 }]);
    expect(stage.skills.groups[8]).toMatchObject({ count: 2, countReason: 'from the file' });
    expect(read.legacy).toEqual([{ kind: 'gem', name: 'Bloodlust', where: 'plan group 8', reason: 'PoB marks it legacy (D-384): kept owned, as the character has it' }]);
  });

  it('the configuration as set in config.file; earned empty; the scenario only enemyIsBoss, from the file', () => {
    expect(stage.config.earned).toEqual([]);
    expect(stage.config.file).toEqual({
      enemyIsBoss: 'Boss',
      enemyLevel: 84,
      customMods: '+10% to all Elemental Resistances\n5% increased Attack Speed',
      conditionEnemyChilled: true,
      usePowerCharges: true,
      windDancerStacks: 3,
      "questAct 4Halls Of The DeadTasalio's Test": '+5% to Cold Resistance',
    });
    expect(stage.config.scenario).toEqual([
      {
        option: 'enemyIsBoss',
        value: 'Boss',
        source: { file: 'source.xml', key: 'enemyIsBoss' },
        tag: { kind: 'judgment', ref: "the file's enemyIsBoss input, as its owner set it", confidence: 'M' },
      },
    ]);
  });

  it("importLeague from <Import lastLeague>; what isn't read is named, the party tab's filling recorded", () => {
    expect(read.importLeague).toBe('Forbidden Rites');
    expect(read.notRead).toEqual(expect.arrayContaining(['notes', 'party', 'tradeWeights', 'timelessData']));
    expect(read.partyFilled).toBe(true);
    expect(read.loadouts).toEqual(['Endgame', 'Leveling']);
  });

  it('answers: main_group moves the main skill and its role; buffs_on and buffs_swap leave the other Spirit buffs switched as needed', async () => {
    const r = await L.call({ run_folder: byName, main_group: 4, buffs_on: [5, 6], buffs_swap: [9] });
    expect(r.isError).toBeFalsy();
    const p = L.json(byName, 'plan.json');
    const s = p.stages[0];
    expect(validatePlan(p, ref).ok).toBe(true);
    expect(p.roll.skill).toBe('Twister');
    expect(s.skills.main).toEqual({ group: 4, activeSkill: 1 });
    expect(s.skills.groups[3].role).toBe('single_target');
    expect(s.skills.groups[7].role).toBe('utility');
    // Virtuous Barrier, the Blasphemy group and Combat Frenzy reserve Spirit and are in neither list: switched.
    const switched = s.skills.groups.flatMap((g: Json, i: number) => (g.switch ? [{ group: i + 1, enabled: g.enabled, switch: g.switch }] : []));
    expect(switched).toEqual([2, 7, 10].map((group) => ({ group, enabled: false, switch: { when: 'as needed', off: [] } })));
    // Wind Dancer moves to the set the file doesn't measure (set 1 is measured: useSecondWeaponSet false).
    expect(s.skills.groups[8].weaponSet).toBe(2);
    for (const n of [4, 5]) expect(s.skills.groups[n].enabled).toBe(true);
    const read2 = L.json(byName, 'read.json');
    expect(read2.answers).toEqual({ main_group: 4, buffs_on: [5, 6], buffs_swap: [9] });
    expect(read2.unconfirmed).toEqual([]);
    expect(read2.questions.map((q: Json) => q.field)).toEqual(['loadout', 'stand_in.Gloves', 'gem']);
  });

  it("switch_off: a switched buff's off list as the user confirmed it; a buff list given again without one clears it", async () => {
    const rel = L.run();
    expect((await L.call({ run_folder: rel, build_name: 'imported-character' })).isError).toBeFalsy();
    const r = await L.call({ run_folder: rel, buffs_on: [5, 6], buffs_swap: [9], switch_off: { 7: [5], 10: [5, 6] } });
    expect(r.isError).toBeFalsy();
    const p = L.json(rel, 'plan.json');
    expect(validatePlan(p, ref).ok).toBe(true);
    const switched = (plan: Json) =>
      plan.stages[0].skills.groups.flatMap((g: Json, i: number) => (g.switch ? [{ group: i + 1, enabled: g.enabled, switch: g.switch }] : []));
    expect(switched(p)).toEqual([
      { group: 2, enabled: false, switch: { when: 'as needed', off: [] } },
      { group: 7, enabled: false, switch: { when: 'as needed', off: [5] } },
      { group: 10, enabled: false, switch: { when: 'as needed', off: [5, 6] } },
    ]);
    // A later answer that leaves the buff list alone keeps the off lists.
    expect((await L.call({ run_folder: rel, main_group: 4 })).isError).toBeFalsy();
    expect(switched(L.json(rel, 'plan.json'))[1].switch.off).toEqual([5]);
    // A new buff list asks the measure's question again: the earlier off lists go.
    expect((await L.call({ run_folder: rel, buffs_on: [5, 6, 7], buffs_swap: [9] })).isError).toBeFalsy();
    expect(switched(L.json(rel, 'plan.json'))).toEqual([2, 10].map((group) => ({ group, enabled: false, switch: { when: 'as needed', off: [] } })));
    expect(L.json(rel, 'read.json').answers.switch_off).toBeUndefined();
  });

  it('a tree jewel on a base the pin lacks: left with a stand_in question, and stood in by its "Jewel <node>" key', async () => {
    const rel = L.run();
    const unknownJewel = xml.replace('Phoenix Wound\nRuby\n', 'Phoenix Wound\nRunemastered Ruby\n');
    expect((await L.call({ run_folder: rel, import_code: encodePobCode(unknownJewel) })).isError).toBeFalsy();
    const read1 = L.json(rel, 'read.json');
    expect(read1.left.find((l: Json) => l.slot === 'Jewel 54127')).toMatchObject({ reason: "base Runemastered Ruby isn't in the pin (PG-110)" });
    expect(read1.questions.find((q: Json) => q.field === 'stand_in.Jewel 54127')).toMatchObject({ fileValue: 'Runemastered Ruby' });
    expect(L.json(rel, 'plan.json').stages[0].items.treeJewels).toEqual([]);
    expect((await L.call({ run_folder: rel, stand_in: { 'Jewel 54127': 'plain base' } })).isError).toBeFalsy();
    const p = L.json(rel, 'plan.json');
    expect(validatePlan(p, ref).ok).toBe(true);
    expect(p.stages[0].items.treeJewels).toEqual([
      { node: 54127, text: 'Rarity: RARE\nPhoenix Wound\nRuby\nItem Level: 81\nImplicits: 0\n+12% to Fire Resistance\n10% increased Attack Damage', owned: true, standIn: true },
    ]);
  });

  it("an older tree's jewel socket the newest tree lacks: the jewel named in left, with its text, never dropped silently", async () => {
    const rel = L.run();
    const older = xml
      .replace(/treeVersion="0_5"/g, 'treeVersion="0_4"')
      .replace('<Socket nodeId="54127" itemId="15"/>', '<Socket nodeId="5101" itemId="15"/>')
      .replace('nodes="50986,59915,7741', 'nodes="5101,50986,59915,7741');
    expect((await L.call({ run_folder: rel, import_code: encodePobCode(older) })).isError).toBeFalsy();
    expect((await L.call({ run_folder: rel, tree: 'newest' })).isError).toBeFalsy();
    const read1 = L.json(rel, 'read.json');
    expect(read1.left.filter((l: Json) => l.node === 5101 || l.slot === 'Jewel 5101')).toEqual([
      { node: 5101, name: 'Minion Revive Speed and Energy Shield Recharge', reason: "the pin's tree 0_5 has no node 5101" },
      {
        slot: 'Jewel 5101',
        text: 'Rarity: RARE\nPhoenix Wound\nRuby\nItem Level: 81\nImplicits: 0\n+12% to Fire Resistance\n10% increased Attack Damage',
        reason: "its socket, node 5101, isn't in the pin's tree 0_5",
      },
    ]);
    expect(L.json(rel, 'plan.json').stages[0].items.treeJewels).toEqual([]);
  });

  it("the party tab counts as filled only by an <ImportedBuffs>: the build's own <ExportedBuffs> doesn't", async () => {
    const rel = L.run();
    const exportedOnly = xml.replace(
      '<ImportedBuffs name="Aura">Purity of Fire</ImportedBuffs>',
      '<ExportedBuffs name="PartyMemberStats">Life: 2400</ExportedBuffs>',
    );
    expect(exportedOnly).not.toContain('ImportedBuffs');
    expect((await L.call({ run_folder: rel, import_code: encodePobCode(exportedOnly) })).isError).toBeFalsy();
    expect(L.json(rel, 'read.json').partyFilled).toBe(false);
  });

  it('stand_in: "plain base" types the item on its plain base, marked standIn; a text the pin can read stands in too', async () => {
    const r = await L.call({ run_folder: byName, stand_in: { Gloves: 'plain base' } });
    expect(r.isError).toBeFalsy();
    const gloves = L.json(byName, 'plan.json').stages[0].items.slots.find((s: Json) => s.slot === 'Gloves');
    expect(gloves).toEqual({ slot: 'Gloves', text: 'Rarity: RARE\nDoom Grip\nPlated Mitts\nItem Level: 81\nQuality: 20\nImplicits: 0\n+70 to maximum Life\n+35% to Lightning Resistance', owned: true, standIn: true });
    const text = 'Rarity: RARE\nDoom Grip\nRiveted Mitts\n+70 to maximum Life';
    expect((await L.call({ run_folder: byName, stand_in: { Gloves: text } })).isError).toBeFalsy();
    expect(L.json(byName, 'plan.json').stages[0].items.slots.find((s: Json) => s.slot === 'Gloves')?.text).toBe(text);
    // The earlier answers stand.
    expect(L.json(byName, 'read.json').answers).toMatchObject({ main_group: 4, stand_in: { Gloves: text } });
  });

  it('loadout: the second loadout read by its title, its plan numbered afresh', async () => {
    const rel = L.run();
    expect((await L.call({ run_folder: rel, build_name: 'imported-character' })).isError).toBeFalsy();
    const r = await L.call({ run_folder: rel, loadout: 'Leveling' });
    expect(r.isError).toBeFalsy();
    const s = L.json(rel, 'plan.json').stages[0];
    expect(s.loadoutName).toBe('Leveling (L90) {f}');
    expect(s.source.loadout).toBe('Leveling');
    expect(s.tree.nodes).toEqual([59915]);
    expect(s.skills.groups.map(groupNames)).toEqual([['Twister']]);
    expect(s.items.slots.map((x: Json) => x.slot)).toEqual(['Weapon 1']);
    expect(L.json(rel, 'read.json').questions.map((q: Json) => q.field)).toEqual(['main_group']);
  });

  it("the campaign case (choice A): the importer fixture read at level 50 gives a level-50 read stage", async () => {
    const rel = L.run();
    const at50 = xml.replace('level="90" className="Mercenary"', 'level="50" className="Mercenary"');
    expect((await L.call({ run_folder: rel, import_code: encodePobCode(at50) })).isError).toBeFalsy();
    expect(L.json(rel, 'plan.json').stages[0]).toMatchObject({ level: 50, loadoutName: 'Endgame (L50) {f}', progress: 'endgame' });
  });
});

describe('AC-W149 (WU-160): the reader on the poe.ninja fixture', () => {
  let L: ReaderLayout;
  let rel: string;
  beforeAll(async () => {
    L = await readerLayout();
    rel = L.run();
    const r = await L.call({ run_folder: rel, build_name: 'imported-ninja' });
    if (r.isError) throw new Error(textOf(r));
  });
  afterAll(async () => {
    await L?.close();
  });

  it('its main group as set, no importLeague, saved on weapon set 2, its untitled spec read as Default', () => {
    const plan = L.json(rel, 'plan.json');
    const read = L.json(rel, 'read.json');
    const s = plan.stages[0];
    expect(validatePlan(plan, ref).ok).toBe(true);
    expect(s.skills.main).toEqual({ group: 1, activeSkill: 1 });
    expect(plan.roll).toEqual({ className: 'Witch', ascendancy: 'Lich', skill: 'Essence Drain' });
    expect(read.importLeague).toBeUndefined();
    expect(s.items.useSecondWeaponSet).toBe(true);
    expect(read.loadout).toBe('Default');
    expect(s.loadoutName).toBe('Default (L75) {f}');
    expect(s.tree).toMatchObject({ nodes: [4739, 18845], ascendancyNodes: [] });
    // No enemyIsBoss in the file: PoB's default.
    expect(s.config.scenario[0]).toMatchObject({ option: 'enemyIsBoss', value: 'Pinnacle' });
    expect(s.config.file).toEqual({ conditionEnemyPoisoned: true });
    // The swap wand's text reads its <ModRange> (no {range:} tag).
    expect(s.items.slots.find((x: Json) => x.slot === 'Weapon 1 Swap')?.text).toContain('{range:0.6}(70-90)% increased Spell Damage');
    // Mana Drain, granted by both wands, kept on both sets at quality 0, its copy's level beside PoB's.
    expect(s.skills.groups[2]).toMatchObject({ gems: [{ name: 'Mana Drain', level: 20, quality: 0, enabled: true }] });
    expect(s.skills.groups[2].weaponSet).toBeUndefined();
    expect(read.levels).toEqual([{ skill: 'Mana Drain', copy: 20, granted: 18 }]);
  });
});

describe('AC-W149 (WU-160): rolls from <ModRange> are numbered as PoB\'s load numbers them', () => {
  const data = loadReaderGameData(POB_SRC);
  it('the base\'s buff lines first, then enchant, implicit and explicit lines; rune lines skipped; only a ranged line takes the tag', () => {
    const lines = ['Rarity: MAGIC', 'Thawing Charm of the Medic', 'Implicits: 2', '{enchant}{rune}+(5-10) to Strength', 'Used when you become Frozen', '+(10-20) to maximum Life', 'Recover (40-60) Life when Used'];
    const item = readItem(lines, data);
    expect(item.base?.buffLines).toBe(1);
    // id 1 is the charm's buff line; 2 the implicit "Used when"; 3 Life; 4 Recover. The rune line takes no id.
    expect(withModRanges(lines, [{ id: 1, range: 0.9 }, { id: 3, range: 0.2 }, { id: 4, range: 1 }], item)).toEqual([
      ...lines.slice(0, 5),
      '{range:0.2}+(10-20) to maximum Life',
      '{range:1}Recover (40-60) Life when Used',
    ]);
  });
});
