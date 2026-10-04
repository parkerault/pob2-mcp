/**
 * AC-T1 (WU-14, C-9): the credential getter. Unit; the dotenv file is a real temp file (the
 * getter's `readFile` default), never the repo's `.env`.
 */
import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { createCredentialGetter } from '../../src/trade/credentials';

let dir: string;
let dotenvPath: string;
let envBefore: Record<string, string | undefined>;

function writeDotenv(content: string): void {
  fs.writeFileSync(dotenvPath, content, 'utf8');
}

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pob2-mcp-creds-'));
  dotenvPath = path.join(dir, '.env');
  envBefore = { ...process.env };
});

afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true });
});

describe('AC-T1 (WU-14, C-9): createCredentialGetter', () => {
  it('AC-T1 (a): env POESESSID wins over the file', () => {
    writeDotenv('POESESSID=b\n');
    const get = createCredentialGetter({ env: { POESESSID: 'a' }, dotenvPath });
    expect(get()).toEqual({ sessionId: 'a', source: 'process-env' });
  });

  it('AC-T1 (a): env POE_SESSION_ID is used when POESESSID is absent, before the file', () => {
    writeDotenv('POESESSID=b\n');
    const get = createCredentialGetter({ env: { POE_SESSION_ID: 'z' }, dotenvPath });
    expect(get()).toEqual({ sessionId: 'z', source: 'process-env' });
  });

  it('AC-T1 (b): env empty, file POE_SESSION_ID=c', () => {
    writeDotenv('POE_SESSION_ID=c\n');
    const get = createCredentialGetter({ env: {}, dotenvPath });
    expect(get()).toEqual({ sessionId: 'c', source: 'dotenv' });
  });

  it('AC-T1 (b): the file POESESSID wins over the file POE_SESSION_ID', () => {
    writeDotenv('POE_SESSION_ID=c\nPOESESSID=cc\n');
    const get = createCredentialGetter({ env: {}, dotenvPath });
    expect(get()).toEqual({ sessionId: 'cc', source: 'dotenv' });
  });

  it('AC-T1 (c): a BOM-prefixed file is read', () => {
    writeDotenv('﻿POESESSID=d\n');
    expect(createCredentialGetter({ env: {}, dotenvPath })()).toEqual({ sessionId: 'd', source: 'dotenv' });
  });

  it('AC-T1 (d): a CRLF file is parsed', () => {
    writeDotenv('OTHER=1\r\nPOESESSID=crlf\r\nMORE=2\r\n');
    expect(createCredentialGetter({ env: {}, dotenvPath })()).toEqual({ sessionId: 'crlf', source: 'dotenv' });
  });

  it('AC-T1 (e): an `export ` prefix is accepted', () => {
    writeDotenv('export POESESSID=e\n');
    expect(createCredentialGetter({ env: {}, dotenvPath })()).toEqual({ sessionId: 'e', source: 'dotenv' });
  });

  it('AC-T1 (f): a quoted value is unquoted', () => {
    writeDotenv('POESESSID="fg"\n');
    expect(createCredentialGetter({ env: {}, dotenvPath })()).toEqual({ sessionId: 'fg', source: 'dotenv' });
  });

  it('AC-T1 (g): a missing file means no session', () => {
    expect(fs.existsSync(dotenvPath)).toBe(false);
    expect(createCredentialGetter({ env: {}, dotenvPath })()).toEqual({ sessionId: null, source: null });
  });

  it('AC-T1 (h): an op:// reference is a problem, not a cookie (file and env)', () => {
    writeDotenv('POESESSID=op://V/I/f\n');
    expect(createCredentialGetter({ env: {}, dotenvPath })()).toEqual({
      sessionId: null,
      source: 'dotenv',
      problem: 'op-reference',
    });
    expect(createCredentialGetter({ env: { POESESSID: 'op://V/I/f' }, dotenvPath })()).toEqual({
      sessionId: null,
      source: 'process-env',
      problem: 'op-reference',
    });
  });

  it('AC-T1 (i): the file is re-read on every call', () => {
    writeDotenv('POESESSID=first\n');
    const get = createCredentialGetter({ env: {}, dotenvPath });
    expect(get().sessionId).toBe('first');
    writeDotenv('POESESSID=second\n');
    expect(get().sessionId).toBe('second');
    fs.rmSync(dotenvPath);
    expect(get()).toEqual({ sessionId: null, source: null });
  });

  it('AC-T1 (j): process.env is unchanged after every case', () => {
    const env = { POESESSID: '  ' };
    for (const content of ['POESESSID=a', '﻿POESESSID=d', 'export POESESSID=e', 'POESESSID=op://V/I/f', 'POESESSID="a b"']) {
      writeDotenv(content);
      createCredentialGetter({ env, dotenvPath })();
      createCredentialGetter({ env: process.env, dotenvPath })();
    }
    expect(env).toEqual({ POESESSID: '  ' });
    expect(process.env).toEqual(envBefore);
    expect(process.env.POESESSID).toBeUndefined();
    expect(process.env.POE_SESSION_ID).toBeUndefined();
  });

  it.each([
    ['a space inside', 'POESESSID="a b"\n'],
    ['a semicolon', 'POESESSID=ab;cd\n'],
    ['a control character', 'POESESSID="ab\u0001cd"\n'],
    ['a double quote', "POESESSID='ab\"cd'\n"],
    ['a backslash', 'POESESSID=ab\\cd\n'],
    ['a comma', 'POESESSID=ab,cd\n'],
  ])('AC-T1 (k): a value with %s is malformed', (_label, content) => {
    writeDotenv(content);
    expect(createCredentialGetter({ env: {}, dotenvPath })()).toEqual({
      sessionId: null,
      source: 'dotenv',
      problem: 'malformed',
    });
  });

  it('AC-T1 (k): a malformed env value is reported without the value', () => {
    const creds = createCredentialGetter({ env: { POESESSID: 'secret value' }, dotenvPath })();
    expect(creds).toEqual({ sessionId: null, source: 'process-env', problem: 'malformed' });
    expect(JSON.stringify(creds)).not.toContain('secret');
  });

  it('AC-T1 (l): a whitespace-only value counts as absent', () => {
    writeDotenv('POESESSID="   "\n');
    expect(createCredentialGetter({ env: {}, dotenvPath })()).toEqual({ sessionId: null, source: null });
    // ... and falls through to the next source.
    writeDotenv('POESESSID="   "\nPOE_SESSION_ID=next\n');
    expect(createCredentialGetter({ env: { POESESSID: ' \t ' }, dotenvPath })()).toEqual({
      sessionId: 'next',
      source: 'dotenv',
    });
  });
});
