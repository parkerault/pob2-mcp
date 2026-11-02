/**
 * WU-137 (amendment 14 §11, C-35; AC-P93's static rows): the socket table, `data/items/sockets.json`.
 *
 * - It loads through `referenceData.ts` as a C-35 fact file: one `judgment` source citing the user's ruling on rune
 *   sockets (2026-11-02), every fact with its source, patch and confidence (Appendix A), and a plan claim citing
 *   `data:items/sockets.json#sockets.body-armour` validates against the loaded data.
 * - PoB's `socketLimit` − 2 (its ceiling counts the Exceptional and the corruption sockets) equals the table's count on
 *   every armour and weapon base of the pinned `Data/Bases/*.lua`, each base read through V1's own mapping (`socketFactOf`);
 *   Corona Amulet, Grasping Ring and Stalking Belt, bases PoB gives no ceiling, are at 1, and other jewellery, belts and
 *   quivers at 0.
 * - The loader's `items` folder may be missing (a data directory from before amendment 14 loads as before).
 */
import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, describe, expect, it } from '@jest/globals';
import { DATA_FOLDERS, loadReferenceData } from '../../src/plan/referenceData';
import { validatePlan } from '../../src/plan/schema';
import { SOCKET_TABLE, socketFactOf } from '../../src/plan/checks/v1';

const REPO = path.resolve(__dirname, '..', '..');
const DATA = path.join(REPO, 'data');
const BASES = path.join(REPO, 'vendor', 'PathOfBuilding-PoE2', 'src', 'Data', 'Bases');
const ref = loadReferenceData(DATA);

interface Base {
  name: string;
  file: string;
  type: string;
  subType?: string;
  socketLimit?: number;
  hands?: number;
}

/** Every base of the pinned `Data/Bases/*.lua`: its name, type, subType, socketLimit and hands (its onehand or twohand tag). */
function pinnedBases(): Base[] {
  const out: Base[] = [];
  for (const file of fs.readdirSync(BASES).filter((n) => n.endsWith('.lua')).sort()) {
    const text = fs.readFileSync(path.join(BASES, file), 'utf8');
    for (const block of text.split(/^itemBases\[/m).slice(1)) {
      const name = /^"([^"]+)"\]/.exec(block)![1];
      const type = /^\ttype = "([^"]+)",$/m.exec(block)?.[1];
      if (type === undefined) continue;
      const subType = /^\tsubType = "([^"]+)",$/m.exec(block)?.[1];
      const limit = /^\tsocketLimit = (\d+),$/m.exec(block)?.[1];
      const tags = /^\ttags = \{([^}]*)\},$/m.exec(block)?.[1] ?? '';
      const hands = /\btwohand = true\b/.test(tags) ? 2 : /\bonehand = true\b/.test(tags) ? 1 : undefined;
      out.push({ name, file, type, ...(subType ? { subType } : {}), ...(limit ? { socketLimit: Number(limit) } : {}), ...(hands ? { hands } : {}) });
    }
  }
  return out;
}

const tableValue = (fact: string): number => {
  const found = ref.resolveFact(SOCKET_TABLE, fact);
  if (!found.ok) throw new Error(found.reason);
  return found.fact.value as number;
};

describe('WU-137: the socket table (data/items/sockets.json, C-35; AC-P93)', () => {
  const bases = pinnedBases();

  it('AC-P93: it loads through referenceData.ts as a C-35 fact file: one judgment source citing the user\'s ruling, every fact sourced', () => {
    expect(DATA_FOLDERS).toContain('items');
    const file = ref.files.get('items/sockets.json');
    expect(file).toBeDefined();
    expect(file!.sources).toEqual([
      expect.objectContaining({ id: 'user-sockets-2026-11-02', kind: 'judgment', confidence: 'H', ref: expect.stringMatching(/the user's ruling on rune sockets \(2026-11-02/) }),
    ]);
    const facts = Object.entries(file!.facts);
    expect(facts.map(([id]) => id).sort()).toEqual(
      [
        'sockets.body-armour', 'sockets.two-hand-weapon', 'sockets.one-hand-weapon', 'sockets.helmet', 'sockets.gloves',
        'sockets.boots', 'sockets.shield', 'sockets.focus', 'sockets.amulet', 'sockets.ring', 'sockets.belt',
        'sockets.quiver', 'sockets.corona-amulet', 'sockets.grasping-ring', 'sockets.stalking-belt',
        'sockets.exceptional-extra', 'sockets.corruption-extra',
      ].sort(),
    );
    for (const [id, fact] of facts) {
      expect({ id, source: fact.source, patch: fact.patch, confidence: fact.confidence }).toEqual({ id, source: 'user-sockets-2026-11-02', patch: '0.5.x', confidence: 'H' });
    }
    // Appendix A's counts: body armours and two-handers 2; other armour, shields, foci and one-handers 1; other jewellery,
    // belts and quivers 0; the Exceptional and the corruption sockets 1 each.
    expect(Object.fromEntries(facts.map(([id, f]) => [id, f.value]))).toEqual({
      'sockets.body-armour': 2, 'sockets.two-hand-weapon': 2, 'sockets.one-hand-weapon': 1, 'sockets.helmet': 1,
      'sockets.gloves': 1, 'sockets.boots': 1, 'sockets.shield': 1, 'sockets.focus': 1, 'sockets.amulet': 0,
      'sockets.ring': 0, 'sockets.belt': 0, 'sockets.quiver': 0, 'sockets.corona-amulet': 1, 'sockets.grasping-ring': 1,
      'sockets.stalking-belt': 1, 'sockets.exceptional-extra': 1, 'sockets.corruption-extra': 1,
    });
    expect(file!.facts['sockets.quiver'].note).toMatch(/the user's default/);
  });

  it('AC-P93: a plan claim citing data:items/sockets.json#sockets.body-armour validates against the loaded data', () => {
    const plan = JSON.parse(fs.readFileSync(path.join(REPO, 'tests', 'fixtures', 'plans', 'm27-wu137', 'lich', 'plan.json'), 'utf8'));
    plan.stages[0].claims = [{ id: 'body-sockets', text: 'A body armour has two rune sockets.', kind: 'hinge', source: 'data:items/sockets.json#sockets.body-armour' }];
    expect(validatePlan(plan, ref)).toMatchObject({ ok: true });
    plan.stages[0].claims[0].source = 'data:items/sockets.json#sockets.cloak';
    const bad = validatePlan(plan, ref);
    expect(bad.ok ? [] : bad.errors.map((e) => e.path)).toEqual(['stages[0].claims[0].source']);
  });

  it('the base parser reads the pin (self-check)', () => {
    expect(bases.length).toBeGreaterThan(1000);
    expect(bases.find((b) => b.name === 'Vile Robe')).toEqual({ name: 'Vile Robe', file: 'body.lua', type: 'Body Armour', subType: 'Energy Shield', socketLimit: 4 });
    expect(bases.find((b) => b.name === 'Wooden Club')).toMatchObject({ type: 'One Hand Mace', socketLimit: 3, hands: 1 });
    expect(bases.find((b) => b.name === 'Slim Mace')).toMatchObject({ socketLimit: 3, hands: 1 });
  });

  it("AC-P93: PoB's socketLimit − 2 equals the table's count on every armour and weapon base, each base read through V1's own mapping", () => {
    const limited = bases.filter((b) => b.socketLimit !== undefined);
    expect(limited.length).toBeGreaterThan(1000);
    const wrong = limited.flatMap((b) => {
      const fact = socketFactOf({ baseName: b.name, baseType: b.type, hands: b.hands });
      if (fact === null) return [`${b.file} ${b.name} (${b.type}): no table fact`];
      const want = b.socketLimit! - 2;
      const have = tableValue(fact);
      return have === want ? [] : [`${b.file} ${b.name} (${b.type}): socketLimit ${b.socketLimit} − 2 = ${want}, the table's ${fact} ${have}`];
    });
    expect(wrong).toEqual([]);
    // Every armour and weapon file has a ceiling on each base: none falls to "no table fact" by lacking one.
    for (const file of ['body.lua', 'helmet.lua', 'gloves.lua', 'boots.lua', 'shield.lua', 'focus.lua', 'mace.lua', 'staff.lua', 'bow.lua', 'wand.lua']) {
      expect({ file, without: bases.filter((b) => b.file === file && b.socketLimit === undefined).map((b) => b.name) }).toEqual({ file, without: [] });
    }
  });

  it('AC-P93: Corona Amulet, Grasping Ring and Stalking Belt (PoB gives no ceiling) are at 1; other amulets, rings, belts and quivers at 0', () => {
    for (const [name, type, fact] of [
      ['Corona Amulet', 'Amulet', 'sockets.corona-amulet'],
      ['Grasping Ring', 'Ring', 'sockets.grasping-ring'],
      ['Stalking Belt', 'Belt', 'sockets.stalking-belt'],
    ] as const) {
      const base = bases.find((b) => b.name === name);
      expect({ name, type: base?.type, socketLimit: base?.socketLimit }).toEqual({ name, type, socketLimit: undefined });
      expect(socketFactOf({ baseName: name, baseType: type })).toBe(fact);
      expect(tableValue(fact)).toBe(1);
    }
    for (const type of ['Amulet', 'Ring', 'Belt', 'Quiver']) {
      const others = bases.filter((b) => b.type === type && !['Corona Amulet', 'Grasping Ring', 'Stalking Belt'].includes(b.name));
      expect(others.length).toBeGreaterThan(0);
      for (const b of others) {
        expect({ name: b.name, socketLimit: b.socketLimit }).toEqual({ name: b.name, socketLimit: undefined });
        expect({ name: b.name, value: tableValue(socketFactOf({ baseName: b.name, baseType: b.type })!) }).toEqual({ name: b.name, value: 0 });
      }
    }
    // Jewels, flasks and charms aren't the table's.
    for (const type of ['Jewel', 'Flask', 'Charm']) {
      const one = bases.find((b) => b.type === type)!;
      expect({ type, fact: socketFactOf({ baseName: one.name, baseType: one.type }) }).toEqual({ type, fact: null });
    }
  });

  describe('the loader\'s items folder', () => {
    let tmp: string | undefined;
    afterEach(() => {
      if (tmp) fs.rmSync(tmp, { recursive: true, force: true });
      tmp = undefined;
    });

    it('a data directory without items/ loads the C1 and E1 files as before; one with an invalid items file errs naming it', () => {
      tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'pob2-items-'));
      for (const d of ['campaign', 'enemies', 'monsters']) fs.cpSync(path.join(DATA, d), path.join(tmp, d), { recursive: true });
      const loaded = loadReferenceData(tmp);
      expect([...loaded.files.keys()].some((k) => k.startsWith('items/'))).toBe(false);
      expect(loaded.files.has('campaign/progress.json')).toBe(true);
      fs.mkdirSync(path.join(tmp, 'items'));
      fs.writeFileSync(path.join(tmp, 'items', 'broken.json'), '{"schemaVersion": 1, "sources": [], "facts": {"x": {"value": 1}}}');
      expect(() => loadReferenceData(tmp)).toThrow(/items\/broken\.json/);
    });
  });
});
