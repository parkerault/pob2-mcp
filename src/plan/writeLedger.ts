/**
 * The write ledger (D-211): `<stateDir>/guide-writes.json`, in the server's state dir (C-16), outside the
 * guides root, so no agent can write it (D-177).
 *
 * Per builds-folder path, it records the last final `compile_plan` that wrote the file: its sha1, the run
 * folder of the compiled plan and when. A final compile may overwrite an existing builds-folder file only
 * when the entry for that path names the plan's run folder and the file's current sha1 equals the
 * entry's, so nobody changed it since. The compile record beside the plan grants nothing.
 *
 * - A missing file is an empty ledger. An unreadable or invalid one fails every final compile with an
 *   error naming the file, and is never silently replaced.
 * - It is written as a temp file then a rename, under the engine lock (the compile's `session.run`).
 * - Measure-only compiles never read or write it.
 */
import fs from 'fs/promises';
import path from 'path';
import { z } from 'zod';

/** The ledger's file name in the state dir. */
export const WRITE_LEDGER_FILE = 'guide-writes.json';

/** The ledger versions this server reads. */
export const WRITE_LEDGER_VERSIONS: readonly number[] = [1];

const entrySchema = z
  .object({
    /** Canonical, builds-relative (D-52); unique. */
    path: z.string().min(1),
    /** Of the bytes written. */
    sha1: z.string().regex(/^[0-9a-f]{40}$/, { message: 'a sha1 is 40 lowercase hex digits' }),
    /** `runFolderOf(plan_path)`: `<slug>/<YYYY-MM-DD>-<n>`. */
    runFolder: z.string().min(1),
    /** ISO 8601. */
    writtenAt: z.string().min(1),
  })
  .strict();

const ledgerSchema = z
  .object({
    ledgerVersion: z.literal(1),
    entries: z.array(entrySchema),
  })
  .strict()
  .superRefine((ledger, ctx) => {
    const seen = new Set<string>();
    ledger.entries.forEach((e, i) => {
      if (seen.has(e.path)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['entries', i, 'path'], message: `path "${e.path}" has two entries` });
      }
      seen.add(e.path);
    });
  });

export type WriteLedger = z.infer<typeof ledgerSchema>;
export type WriteLedgerEntry = WriteLedger['entries'][number];

/** An unreadable or invalid ledger; the message names the file. */
export class WriteLedgerError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'WriteLedgerError';
  }
}

/** `<stateDir>/guide-writes.json`. */
export function writeLedgerPath(stateDir: string): string {
  return path.join(stateDir, WRITE_LEDGER_FILE);
}

/** The empty ledger (what a missing file reads as). */
export function emptyWriteLedger(): WriteLedger {
  return { ledgerVersion: 1, entries: [] };
}

/** Read and validate the ledger: missing → empty; unreadable or invalid → `WriteLedgerError` naming the file. */
export async function readWriteLedger(stateDir: string): Promise<WriteLedger> {
  const file = writeLedgerPath(stateDir);
  let text: string;
  try {
    text = await fs.readFile(file, 'utf8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException)?.code === 'ENOENT') return emptyWriteLedger();
    throw new WriteLedgerError(`the write ledger ${file} can't be read: ${(error as Error).message}`);
  }
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch (error) {
    throw new WriteLedgerError(`the write ledger ${file} is not valid JSON (${(error as Error).message}); fix or remove it by hand`);
  }
  const parsed = ledgerSchema.safeParse(value);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join('.') || '$'}: ${i.message}`).join('; ');
    throw new WriteLedgerError(`the write ledger ${file} is invalid (${issues}); fix or remove it by hand`);
  }
  return parsed.data;
}

/** The ledger's entry for a canonical builds-relative path, if any. */
export function ledgerEntryFor(ledger: WriteLedger, relPath: string): WriteLedgerEntry | undefined {
  return ledger.entries.find((e) => e.path === relPath);
}

/** The ledger with `entry` replacing any entry for its path (a final compile replaces its target's entry). */
export function withLedgerEntry(ledger: WriteLedger, entry: WriteLedgerEntry): WriteLedger {
  return { ledgerVersion: 1, entries: [...ledger.entries.filter((e) => e.path !== entry.path), entry] };
}

/** Write the ledger as a temp file in the state dir, then rename it over the ledger. */
export async function writeWriteLedger(stateDir: string, ledger: WriteLedger): Promise<void> {
  const file = writeLedgerPath(stateDir);
  const temp = `${file}.tmp-${process.pid}`;
  await fs.mkdir(stateDir, { recursive: true });
  try {
    await fs.writeFile(temp, `${JSON.stringify(ledger, null, 2)}\n`, 'utf8');
    await fs.rename(temp, file);
  } catch (error) {
    await fs.unlink(temp).catch(() => undefined);
    throw new WriteLedgerError(`the write ledger ${file} could not be written: ${(error as Error).message}`);
  }
}
