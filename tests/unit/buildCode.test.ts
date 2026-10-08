/**
 * `buildCode.ts`: the PoB import-code encoder and decoder.
 * - AC-P19 (WU-40, C-42): `decodePobCode(encodePobCode(golden))` is byte-equal to the golden XML; the
 *   code matches `^[A-Za-z0-9_=-]+$` and equals the former test encoder's output.
 */
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { describe, it, expect } from '@jest/globals';
import { decodePobCode, encodePobCode, rawUrlFor } from '../../src/utils/buildCode';

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
