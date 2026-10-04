/**
 * The User-Agent (D-25), defined once.
 *
 * - Trade and poe.ninja requests send `<package.json name>/<package.json version>` (today
 *   `pob2-mcp-server/0.2.2`), with no contact, so no request identifies the user.
 * - Share-site fetches (pobb.in, pastebin) send `Mozilla/5.0 (compatible; <that constant>)`,
 *   because their bot filters block plain UAs (A-15).
 */
import fs from 'fs';
import path from 'path';
import { packageRoot } from './packageRoot.js';

/** `<name>/<version>`. */
export function formatUserAgent(name: string, version: string): string {
  return `${name}/${version}`;
}

/** The browser-compatible form of a User-Agent, for share sites. */
export function formatShareSiteUserAgent(userAgent: string): string {
  return `Mozilla/5.0 (compatible; ${userAgent})`;
}

let memo: string | null = null;

/** The trade and poe.ninja User-Agent, read once from this package's `package.json`. */
export function userAgent(): string {
  if (memo === null) {
    const pkg = JSON.parse(fs.readFileSync(path.join(packageRoot(), 'package.json'), 'utf8')) as {
      name?: unknown;
      version?: unknown;
    };
    if (typeof pkg.name !== 'string' || typeof pkg.version !== 'string') {
      throw new Error('package.json has no name or version');
    }
    memo = formatUserAgent(pkg.name, pkg.version);
  }
  return memo;
}

/** The share-site (pobb.in, pastebin) User-Agent. */
export function shareSiteUserAgent(): string {
  return formatShareSiteUserAgent(userAgent());
}
