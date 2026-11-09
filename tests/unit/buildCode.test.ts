/**
 * `buildCode.ts`: the PoB import-code encoder and decoder.
 * - AC-P19 (WU-40, C-42): `decodePobCode(encodePobCode(golden))` is byte-equal to the golden XML; the
 *   code matches `^[A-Za-z0-9_=-]+$` and equals the former test encoder's output.
 * - AC-W135 (WU-153, D-511): `dropModRangeCopies`, `import_build {save_as}`'s drop of PoB's `<ModRange>` copies by the
 *   engine's load-side rule (its engine half is `tests/integration/pg109.test.ts`).
 */
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { describe, it, expect } from '@jest/globals';
import { decodePobCode, dropModRangeCopies, encodePobCode, rawUrlFor } from '../../src/utils/buildCode';

const GOLDEN = path.resolve(__dirname, '..', 'fixtures', 'builds', 'grenadator.xml');

/**
 * The encoder `toolHygiene.test.ts` and `engineKinds.test.ts` used before C-42 (their
 * `$GOLDEN_BUILD_CODE`), kept here as AC-P19's reference.
 */
function formerTestEncoder(xml: string): string {
  return zlib.deflateSync(Buffer.from(xml, 'utf8')).toString('base64').replace(/\+/g, '-').replace(/\//g, '_');
}

/** A PoB code in URL-safe form (`encodePobCode`), or in standard base64 (`+`, `/`). */
function encode(xml: string, urlSafe = true): string {
  const code = encodePobCode(xml);
  return urlSafe ? code : code.replace(/-/g, '+').replace(/_/g, '/');
}

const SAMPLE_XML = '<?xml version="1.0"?><PathOfBuilding2><Build level="90" className="Monk"/></PathOfBuilding2>';

describe('AC-P19: encodePobCode (C-42)', () => {
  const goldenBytes = fs.readFileSync(GOLDEN);
  const golden = goldenBytes.toString('utf8');

  it('AC-P19: decodePobCode(encodePobCode(golden)) is byte-equal to the golden XML', () => {
    expect(Buffer.from(golden, 'utf8').equals(goldenBytes)).toBe(true); // the fixture is UTF-8 text
    const decoded = decodePobCode(encodePobCode(golden));
    expect(decoded).toBe(golden);
    expect(Buffer.from(decoded, 'utf8').equals(goldenBytes)).toBe(true);
  });

  it('AC-P19: the golden code matches ^[A-Za-z0-9_=-]+$ and equals the former test encoder\'s output', () => {
    const code = encodePobCode(golden);
    expect(code).toMatch(/^[A-Za-z0-9_=-]+$/);
    expect(code).toBe(formerTestEncoder(golden));
    // PoB's form (ImportTab.lua:133): standard base64 of zlib-deflate with `+`→`-` and `/`→`_`.
    expect(zlib.inflateSync(Buffer.from(code.replace(/-/g, '+').replace(/_/g, '/'), 'base64')).equals(goldenBytes)).toBe(true);
  });

  it('C-42: the code keeps the base64 `=` padding, and round-trips any PoE2 XML (non-ASCII text, a BOM, CRLF)', () => {
    const xmls = [
      SAMPLE_XML,
      `${SAMPLE_XML} `,
      `${SAMPLE_XML}  `,
      '<?xml version="1.0" encoding="UTF-8"?>\r\n<PathOfBuilding2>\r\n<Notes>Ünïcødé — 50% «notes» 中文</Notes>\r\n</PathOfBuilding2>\r\n',
      '\uFEFF<?xml version="1.0"?><PathOfBuilding2><Build level="1"/></PathOfBuilding2>',
    ];
    const codes = xmls.map((x) => encodePobCode(x));
    for (const [k, code] of codes.entries()) {
      expect(code).toMatch(/^[A-Za-z0-9_=-]+$/);
      expect(code.length % 4).toBe(0);
      expect(code).toBe(formerTestEncoder(xmls[k]));
      expect(decodePobCode(code)).toBe(xmls[k]);
    }
    // At least one of the three lengths needs padding, and it is kept.
    expect(codes.some((c) => c.endsWith('='))).toBe(true);
  });
});

describe('decodePobCode', () => {
  it('round-trips a URL-safe PoB code back to XML', () => {
    expect(decodePobCode(encode(SAMPLE_XML, true))).toBe(SAMPLE_XML);
  });

  it('also accepts standard base64 and surrounding whitespace', () => {
    expect(decodePobCode('  ' + encode(SAMPLE_XML, false) + '\n')).toBe(SAMPLE_XML);
  });

  it('rejects non-PoB / garbage codes', () => {
    expect(() => decodePobCode('not-a-real-code!!!')).toThrow();
    expect(() => decodePobCode('')).toThrow();
  });
});

describe('rawUrlFor', () => {
  it('rewrites pobb.in links to /raw', () => {
    expect(rawUrlFor('https://pobb.in/Pasi1Qwn0wtj')).toBe('https://pobb.in/Pasi1Qwn0wtj/raw');
  });

  it('rewrites pastebin links to /raw/', () => {
    expect(rawUrlFor('https://pastebin.com/abcd1234')).toBe('https://pastebin.com/raw/abcd1234');
  });

  it('leaves already-raw or unknown URLs unchanged', () => {
    expect(rawUrlFor('https://pobb.in/Pasi1Qwn0wtj/raw')).toBe('https://pobb.in/Pasi1Qwn0wtj/raw');
    expect(rawUrlFor('https://example.com/code.txt')).toBe('https://example.com/code.txt');
  });
});

describe('AC-W135 (WU-153): dropModRangeCopies drops PoB\'s <ModRange> copies on items whose text carries {range: (D-511)', () => {
  const item = (id: number, text: string[], ranges: string[]) =>
    [`\t\t<Item id="${id}">`, ...text, ...ranges.map((r) => `\t\t\t${r}`), '\t\t</Item>'].join('\n');
  const doc = (...items: string[]) =>
    ['<?xml version="1.0" encoding="UTF-8"?>', '<PathOfBuilding2>', '\t<Items activeItemSet="1">', ...items,
      '\t\t<ItemSet id="1" title="Default">', '\t\t\t<Slot itemId="1" name="Weapon 1"/>', '\t\t</ItemSet>', '\t</Items>',
      '</PathOfBuilding2>', ''].join('\n');
  const tagged = ['Rarity: UNIQUE', 'Liminal Coil', 'Twisted Wand', '{range:0.25}(7-13)% increased Cast Speed'];
  const bare = ['Rarity: UNIQUE', 'Veilpiercer', 'Amethyst Ring', '+(60-100) to maximum Mana'];
  const copies = ['<ModRange id="1" range="0.5"/>', '<ModRange id="4" range="0.25"/>'];

  it('drops them from a {range:} item, line and all, and keeps an item with no {range:} tag as it came', () => {
    const xml = doc(item(1, tagged, copies), item(2, bare, ['<ModRange id="1" range="0.25"/>']));
    expect(dropModRangeCopies(xml)).toBe(doc(item(1, tagged, []), item(2, bare, ['<ModRange id="1" range="0.25"/>'])));
  });

  it('leaves a document with no {range:} item byte for byte, the golden build among them', () => {
    const golden = fs.readFileSync(GOLDEN, 'utf8');
    expect(golden).toContain('<ModRange');
    expect(dropModRangeCopies(golden)).toBe(golden);
    const xml = doc(item(1, bare, copies));
    expect(dropModRangeCopies(xml)).toBe(xml);
  });

  it('handles CRLF line breaks, an open-and-close <ModRange>, a self-closing <Item/>, and never touches <ItemSet> or <Items>', () => {
    const crlf = doc(item(1, tagged, copies)).replace(/\n/g, '\r\n');
    expect(dropModRangeCopies(crlf)).toBe(doc(item(1, tagged, [])).replace(/\n/g, '\r\n'));
    const open = doc(item(1, tagged, ['<ModRange id="1" range="0.5"></ModRange>']));
    expect(dropModRangeCopies(open)).toBe(doc(item(1, tagged, [])));
    const empty = doc('\t\t<Item id="3"/>', item(1, tagged, copies));
    expect(dropModRangeCopies(empty)).toBe(doc('\t\t<Item id="3"/>', item(1, tagged, [])));
  });
});
