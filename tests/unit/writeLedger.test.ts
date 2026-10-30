/**
 * The write ledger, version 2 (D-466, D-211; AC-K78's ledger rows), unit class: the real module over a temp state dir.
 *
 * - A version-1 ledger reads as entries of `kind: final` with no `plan` (Appendix A, "The write ledger").
 * - Every write is version 2; an entry carries `kind` and `plan`; an invalid one fails naming the file.
 * - A name is free for a build when no file has it, or this build (`plan`) wrote it and it is unchanged.
 * - Updates in one process go one at a time, so two at once both land.
 */
import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';
import {
  WRITE_LEDGER_FILE,
  WriteLedgerError,
  freeForBuild,
  readWriteLedger,
  updateWriteLedger,
  withLedgerEntry,
  withoutLedgerEntry,
  writeWriteLedger,
  type WriteLedgerEntry,
} from '../../src/plan/writeLedger';

const SHA_A = 'a'.repeat(40);
const SHA_B = 'b'.repeat(40);

let state: string;
const ledgerFile = () => path.join(state, WRITE_LEDGER_FILE);
const writeRaw = (value: unknown) => fs.writeFileSync(ledgerFile(), JSON.stringify(value));
const readRaw = () => JSON.parse(fs.readFileSync(ledgerFile(), 'utf8'));

beforeEach(() => {
  state = fs.mkdtempSync(path.join(os.tmpdir(), 'pob2-ledger-'));
});
afterEach(() => {
  fs.rmSync(state, { recursive: true, force: true });
});

const entry = (over: Partial<WriteLedgerEntry> = {}): WriteLedgerEntry => ({
  path: 'Royal Fury Rake (draft).xml',
  sha1: SHA_A,
  runFolder: 'titan-rake/2026-10-28-1',
  writtenAt: '2026-10-30T10:00:00.000Z',
  kind: 'draft',
  plan: 'titan-rake/2026-10-28-1/builds/r2-s-1/plan.json',
  ...over,
});

describe('AC-K78: the write ledger at version 2 (D-466)', () => {
  it('a version-1 ledger reads as entries of kind final with no plan', async () => {
    writeRaw({
      ledgerVersion: 1,
      entries: [{ path: 'old.xml', sha1: SHA_A, runFolder: 'old/2026-10-01-1', writtenAt: '2026-10-01T00:00:00Z' }],
    });
    const ledger = await readWriteLedger(state);
    expect(ledger.ledgerVersion).toBe(2);
    expect(ledger.entries).toEqual([
      { path: 'old.xml', sha1: SHA_A, runFolder: 'old/2026-10-01-1', writtenAt: '2026-10-01T00:00:00Z', kind: 'final' },
    ]);
    expect(ledger.entries[0]).not.toHaveProperty('plan');
  });

  it('a version-1 entry is never a draft of any build, nor free for any build: a pre-M-26 file is never removed or reused', async () => {
    writeRaw({
      ledgerVersion: 1,
      entries: [{ path: 'old.xml', sha1: SHA_A, runFolder: 'old/2026-10-01-1', writtenAt: '2026-10-01T00:00:00Z' }],
    });
    const ledger = await readWriteLedger(state);
    expect(freeForBuild(ledger, 'old.xml', SHA_A, 'old/2026-10-01-1/plan.json')).toBe(false);
    expect(ledger.entries[0].kind).toBe('final');
  });

  it('a write after reading version 1 is version 2, each entry with its kind and plan', async () => {
    writeRaw({
      ledgerVersion: 1,
      entries: [{ path: 'old.xml', sha1: SHA_A, runFolder: 'old/2026-10-01-1', writtenAt: '2026-10-01T00:00:00Z' }],
    });
    await writeWriteLedger(state, withLedgerEntry(await readWriteLedger(state), entry()));
    const raw = readRaw();
    expect(raw.ledgerVersion).toBe(2);
    expect(raw.entries).toEqual([
      { path: 'old.xml', sha1: SHA_A, runFolder: 'old/2026-10-01-1', writtenAt: '2026-10-01T00:00:00Z', kind: 'final' },
      entry(),
    ]);
    expect(await readWriteLedger(state)).toEqual(raw);
  });

  it('a version-2 entry without its kind, with an unknown kind, or an unknown version fails naming the file', async () => {
    for (const bad of [
      { ledgerVersion: 2, entries: [{ path: 'x.xml', sha1: SHA_A, runFolder: 'a/2026-10-01-1', writtenAt: 'now' }] },
      { ledgerVersion: 2, entries: [{ ...entry(), kind: 'campaign' }] },
      { ledgerVersion: 3, entries: [] },
      { ledgerVersion: 1, entries: [{ ...entry() }] },
    ]) {
      writeRaw(bad);
      const error = await readWriteLedger(state).catch((e) => e);
      expect(error).toBeInstanceOf(WriteLedgerError);
      expect((error as Error).message).toContain(ledgerFile());
    }
  });

  it('a name is free for a build when no file has it, or this build wrote it and it is unchanged on disk', async () => {
    const ledger = withLedgerEntry(await readWriteLedger(state), entry());
    const mine = entry().plan!;
    expect(freeForBuild(ledger, 'nobody.xml', null, mine)).toBe(true);
    expect(freeForBuild(ledger, entry().path, SHA_A, mine)).toBe(true);
    // Changed on disk since this build wrote it.
    expect(freeForBuild(ledger, entry().path, SHA_B, mine)).toBe(false);
    // Another build of the same run, or another run.
    expect(freeForBuild(ledger, entry().path, SHA_A, 'titan-rake/2026-10-28-1/builds/r2-s-2/plan.json')).toBe(false);
    // A file no compile wrote.
    expect(freeForBuild(ledger, 'hand-made.xml', SHA_A, mine)).toBe(false);
  });

  it('withoutLedgerEntry drops the entry for one path only', async () => {
    const ledger = withLedgerEntry(withLedgerEntry(await readWriteLedger(state), entry()), entry({ path: 'Royal Fury Rake.xml', kind: 'final' }));
    const after = withoutLedgerEntry(ledger, entry().path);
    expect(after.ledgerVersion).toBe(2);
    expect(after.entries.map((e) => e.path)).toEqual(['Royal Fury Rake.xml']);
  });

  it('updates in one process go one at a time: two at once both land', async () => {
    const add = (e: WriteLedgerEntry) =>
      updateWriteLedger(state, async (ledger) => {
        await new Promise((resolve) => setTimeout(resolve, 20));
        return { ledger: withLedgerEntry(ledger, e), value: e.path };
      });
    const done = await Promise.all([add(entry({ path: 'one.xml' })), add(entry({ path: 'two.xml' }))]);
    expect(done).toEqual(['one.xml', 'two.xml']);
    expect((await readWriteLedger(state)).entries.map((e) => e.path).sort()).toEqual(['one.xml', 'two.xml']);
  });

  it('an update that returns no ledger writes nothing, and a failed update leaves the next one free to run', async () => {
    await updateWriteLedger(state, async () => ({ ledger: null, value: 1 }));
    expect(fs.existsSync(ledgerFile())).toBe(false);
    await expect(updateWriteLedger(state, async () => Promise.reject(new Error('refused')))).rejects.toThrow('refused');
    await updateWriteLedger(state, async (ledger) => ({ ledger: withLedgerEntry(ledger, entry()), value: 2 }));
    expect(readRaw().entries).toEqual([entry()]);
  });
});
