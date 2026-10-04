/**
 * D-25 (WU-14): the User-Agent module reads `<name>/<version>` from package.json.
 */
import { describe, it, expect } from '@jest/globals';
import fs from 'fs';
import path from 'path';
import { userAgent, shareSiteUserAgent, formatUserAgent, formatShareSiteUserAgent } from '../../src/utils/userAgent';

const PKG = JSON.parse(fs.readFileSync(path.resolve(__dirname, '..', '..', 'package.json'), 'utf8')) as {
  name: string;
  version: string;
};

describe('D-25 (WU-14): userAgent', () => {
  it('D-25: userAgent() = <package.json name>/<package.json version>, with no contact', () => {
    expect(userAgent()).toBe(`${PKG.name}/${PKG.version}`);
    expect(userAgent()).not.toMatch(/[@(+]|http/);
  });

  it('D-25: the share-site form wraps it in Mozilla/5.0 (compatible; …)', () => {
    expect(shareSiteUserAgent()).toBe(`Mozilla/5.0 (compatible; ${PKG.name}/${PKG.version})`);
    expect(formatShareSiteUserAgent(formatUserAgent('a', '1.2.3'))).toBe('Mozilla/5.0 (compatible; a/1.2.3)');
  });
});
