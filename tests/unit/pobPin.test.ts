import { describe, it, expect } from '@jest/globals';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

const REPO = path.resolve(__dirname, '..', '..');

/** Independent of src/engine/pinCheck.ts: PoB's update_manifest.py scheme, re.sub(rb"\r\n?|\n", b"\r\n"). */
function crlfSha1(buf: Buffer): string {
  const normalized = Buffer.from(buf.toString('latin1').replace(/\r\n?|\n/g, '\r\n'), 'latin1');
  return crypto.createHash('sha1').update(normalized).digest('hex');
}

describe('PoB pin (C-6)', () => {
  it('AC-F1: pob-pin.json equals the C-6 literal', () => {
    const pin = JSON.parse(fs.readFileSync(path.join(REPO, 'pob-pin.json'), 'utf8'));
    expect(pin).toEqual({
      repo: 'https://github.com/PathOfBuildingCommunity/PathOfBuilding-PoE2.git',
      tag: 'v0.23.1',
      commit: '7d6f530cbdab20389ff8bc6ba97a37ac27f74e41',
      version: '0.23.1',
      headlessWrapperSha1: '77a3e3a9b7387ebc57ef0a35bb17c382282e3c7c',
    });
  });

  it('AC-F1: the CRLF-normalized sha1 of vendor HeadlessWrapper.lua is the pinned 77a3e3a…', () => {
    const wrapper = path.join(REPO, 'vendor', 'PathOfBuilding-PoE2', 'src', 'HeadlessWrapper.lua');
    if (!fs.existsSync(wrapper)) {
      throw new Error(`${wrapper} is missing: run \`mise run pob:fetch\``);
    }
    expect(crlfSha1(fs.readFileSync(wrapper))).toBe('77a3e3a9b7387ebc57ef0a35bb17c382282e3c7c');
  });
});
