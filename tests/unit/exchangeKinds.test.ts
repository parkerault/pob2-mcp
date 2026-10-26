/**
 * D-444 (amendment 11 §12, AC-K72's routing): `get_item_price` recognises every item the currency exchange sells by
 * its name, and gives it poe.ninja's exchange category; everything else goes to the trade site.
 *
 * Checked against two sources, neither a user's run nor a published guide:
 * - WU-112's spike, the saved poe.ninja exchange overviews (`tests/fixtures/poeninja/exchange/<category>`, and the
 *   D-387 `poeninja/delirium-overview` capture for `Delirium`): every item each category lists classifies to it;
 * - the pinned PoB data (`vendor/PathOfBuilding-PoE2/src/Data/`): every socketable of `ModRunes.lua` by its type,
 *   every emotion of `LiquidEmotions.lua`, every essence of `Essence.lua` and every lineage support gem of `Gems.lua`
 *   classifies to its category, and no unique of `Uniques/*.lua` and no other gem matches any kind.
 */
import fs from 'fs';
import path from 'path';
import { describe, expect, it } from '@jest/globals';
import { EXCHANGE_CATEGORIES, LINEAGE_SUPPORT_GEMS, UNIQUES_NAMED_LIKE_EXCHANGE_ITEMS, exchangeKindOf, foldName } from '../../src/trade/exchange';

const REPO = path.resolve(__dirname, '..', '..');
const FIXTURES = path.join(REPO, 'tests', 'fixtures', 'poeninja');
const POB_DATA = path.join(REPO, 'vendor', 'PathOfBuilding-PoE2', 'src', 'Data');

/** The item names a saved exchange overview lists (its `lines[]`, named through `items[]`). */
function listed(category: string): string[] {
  const file = category === 'Delirium' ? path.join(FIXTURES, 'delirium-overview.response.json') : path.join(FIXTURES, 'exchange', `${category}.response.json`);
  const body = JSON.parse(fs.readFileSync(file, 'utf8')) as { lines: Array<{ id: string }>; items: Array<{ id: string; name: string }> };
  const names = new Map(body.items.map((i) => [i.id, i.name]));
  return body.lines.map((l) => names.get(l.id) as string);
}

function pobData(file: string): string {
  return fs.readFileSync(path.join(POB_DATA, file), 'utf8');
}

/** `ModRunes.lua`: each top-level entry's name and the `type` of its first slot. */
function socketables(): Array<{ name: string; type: string }> {
  const out: Array<{ name: string; type: string }> = [];
  let name: string | null = null;
  for (const line of pobData('ModRunes.lua').split('\n')) {
    const top = /^\t\["(.+)"\] = \{$/.exec(line);
    if (top) name = top[1];
    const type = /^\t+type = "(\w+)",$/.exec(line);
    if (type && name) {
      out.push({ name, type: type[1] });
      name = null;
    }
  }
  return out;
}

/** `Gems.lua`: each gem's name and whether its tags have `lineage = true`. */
function gems(): Array<{ name: string; lineage: boolean }> {
  const out: Array<{ name: string; lineage: boolean }> = [];
  for (const entry of pobData('Gems.lua').split(/\n\t\["/).slice(1)) {
    const name = /\n\t\tname = "([^"]+)",/.exec(entry)?.[1];
    if (name) out.push({ name, lineage: /\n\t\t\tlineage = true,/.test(entry) });
  }
  return out;
}

/** The unique names of `Uniques/*.lua`: the first line of each `[[ … ]]` block. */
function uniques(): string[] {
  const dir = path.join(POB_DATA, 'Uniques');
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.lua'))
    .flatMap((f) => [...fs.readFileSync(path.join(dir, f), 'utf8').matchAll(/\[\[\r?\n([^\r\n]+)/g)].map((m) => m[1].trim()));
}

const categoryOf = (name: string) => exchangeKindOf(name)?.category ?? null;

describe("D-444: an exchange item's category, by its name", () => {
  it('every item each saved poe.ninja exchange category lists classifies to that category (the spike, 14 categories)', () => {
    expect([...EXCHANGE_CATEGORIES].sort()).toEqual(
      [...fs.readdirSync(path.join(FIXTURES, 'exchange')).map((f) => f.replace('.response.json', '')), 'Delirium'].sort(),
    );
    for (const category of EXCHANGE_CATEGORIES) {
      const names = listed(category);
      expect({ category, some: names.length > 0 }).toEqual({ category, some: true });
      const wrong = names.filter((n) => categoryOf(n) !== category).map((n) => `${n} → ${categoryOf(n)}`);
      expect({ category, wrong }).toEqual({ category, wrong: [] });
    }
  });

  it("the user's four named items take their category: three runes and an idol", () => {
    expect(categoryOf('Perfect Body Rune')).toBe('Runes');
    expect(categoryOf("Courtesan Mannan's Rune of Cruelty")).toBe('Runes');
    expect(categoryOf('Legacy of Deathblow')).toBe('Runes');
    expect(categoryOf('Wolf Idol')).toBe('Idols');
  });

  it("every socketable PoB knows takes its type's category (ModRunes.lua: runes, soul cores, idols, abyssal eyes, congealed mist)", () => {
    const byType: Record<string, string> = { Rune: 'Runes', SoulCore: 'SoulCores', CongealedMist: 'SoulCores', Idol: 'Idols', AbyssalEye: 'Abyss' };
    const all = socketables();
    expect(new Set(all.map((s) => s.type))).toEqual(new Set(Object.keys(byType)));
    expect(all.length).toBeGreaterThan(250);
    const wrong = all.filter((s) => categoryOf(s.name) !== byType[s.type]).map((s) => `${s.name} (${s.type}) → ${categoryOf(s.name)}`);
    expect(wrong).toEqual([]);
  });

  it('every Distilled Emotion (LiquidEmotions.lua) is Delirium and every essence (Essence.lua) is Essences', () => {
    const emotions = [...pobData('LiquidEmotions.lua').matchAll(/name = "([^"]+)"/g)].map((m) => m[1]);
    const essences = [...pobData('Essence.lua').matchAll(/name = "([^"]+)"/g)].map((m) => m[1]);
    expect(emotions).toHaveLength(26);
    expect(essences.length).toBeGreaterThan(60);
    expect(emotions.filter((n) => categoryOf(n) !== 'Delirium')).toEqual([]);
    expect(essences.filter((n) => categoryOf(n) !== 'Essences')).toEqual([]);
  });

  it("the lineage support gems are Gems.lua's lineage gems and the two poe.ninja lists that the pin leaves untagged, matched with poe.ninja's accents too", () => {
    const all = gems();
    const lineage = all.filter((g) => g.lineage).map((g) => g.name);
    expect(lineage.length).toBeGreaterThan(50);
    expect(lineage.filter((n) => categoryOf(n) !== 'LineageSupportGems')).toEqual([]);
    // The list is the pin's lineage gems and poe.ninja's, compared folded (poe.ninja's accents), and nothing else.
    const sources = new Set([...lineage, ...listed('LineageSupportGems')].map(foldName));
    expect([...new Set(LINEAGE_SUPPORT_GEMS.map(foldName))].sort()).toEqual([...sources].sort());
    expect(LINEAGE_SUPPORT_GEMS).toHaveLength(sources.size);
    // poe.ninja writes the accents PoB leaves out.
    expect(categoryOf('Mórrigan’s Insight')).toBe('LineageSupportGems');
    expect(foldName('Oisín’s Oath')).toBe(foldName("Oisin's Oath"));
  });

  it('no unique and no other gem PoB knows is an exchange item: they go to the trade site', () => {
    const names = uniques();
    expect(names.length).toBeGreaterThan(400);
    expect(names.filter((n) => categoryOf(n) !== null).map((n) => `${n} → ${categoryOf(n)}`)).toEqual([]);
    // The uniques left out by name (a unique amulet called `Idol of Uldurn`) are PoB's uniques, and only those.
    expect(UNIQUES_NAMED_LIKE_EXCHANGE_ITEMS.filter((n) => !names.includes(n))).toEqual([]);
    // The gems PoB doesn't tag `lineage`, less the two poe.ninja lists as lineage gems.
    const ninjaLineage = new Set(listed('LineageSupportGems').map(foldName));
    const others = gems().filter((g) => !g.lineage && !ninjaLineage.has(foldName(g.name))).map((g) => g.name);
    expect(others.length).toBeGreaterThan(500);
    expect(others.filter((n) => categoryOf(n) !== null).map((n) => `${n} → ${categoryOf(n)}`)).toEqual([]);
    for (const name of ['Darkness Enthroned', 'Deathblow', 'Ruby Ring', 'x', '', 'Liquid Envy Ring']) expect({ name, category: categoryOf(name) }).toEqual({ name, category: null });
  });

  it('no gear base PoB knows is an exchange item (Data/Bases/*.lua: Carved Greaves and Carved Targe included)', () => {
    const dir = path.join(POB_DATA, 'Bases');
    const bases = fs
      .readdirSync(dir)
      .filter((f) => f.endsWith('.lua'))
      .flatMap((f) => [...fs.readFileSync(path.join(dir, f), 'utf8').matchAll(/^itemBases\["([^"]+)"\] = \{/gm)].map((m) => m[1]));
    expect(bases.length).toBeGreaterThan(500);
    expect(bases).toEqual(expect.arrayContaining(['Carved Greaves', 'Carved Targe']));
    expect(bases.filter((n) => categoryOf(n) !== null).map((n) => `${n} → ${categoryOf(n)}`)).toEqual([]);
  });
});
