/**
 * The write ledger (D-211): `<stateDir>/guide-writes.json`, in the server's state dir (C-16), outside the
 * guides root, so no agent can write it (D-177).
 *
 * Per builds-folder path, it records the last `compile_plan` write of the file: its sha1, the run folder of
 * the compiled plan, when, and (version 2, D-466) its `kind` (`final`, a final compile's file, or `draft`, the
 * draft mode's copy) and its `plan` (the plan path, relative to the guides root, that wrote it: "this build").
 * A final compile may overwrite an existing builds-folder file only when the entry for that path names the
 * plan's run folder and the file's current sha1 equals the entry's, so nobody changed it since; a `first_free`
 * name or a draft is free only when no file has it or this build (`plan`) wrote it and it is unchanged. The
 * draft mode's delete takes only a `draft` this build wrote, unchanged, and drops its entry. The compile
 * record beside the plan grants nothing.
 *
 * - A missing file is an empty ledger. An unreadable or invalid one fails every final compile and draft
 *   write with an error naming the file, and is never silently replaced.
 * - A version-1 ledger reads as version 2: each entry `kind: "final"` with no `plan` (so a pre-M-26 file is
 *   never a draft the delete may remove, nor this build's for a free name). Every write is version 2.
 * - It is written as a temp file then a rename. Its read-modify-writes in this process go one at a time
 *   (`updateWriteLedger`), since the draft mode runs outside the engine lock.
 * - Measure-only compiles never read or write it.
 */
import fs from 'fs/promises';
import path from 'path';
import { z } from 'zod';

/** The ledger's file name in the state dir. */
export const WRITE_LEDGER_FILE = 'guide-writes.json';

/** The ledger versions this server reads; it writes the last. */
export const WRITE_LEDGER_VERSIONS: readonly number[] = [1, 2];
/** The version every write has (D-466). */
export const WRITE_LEDGER_VERSION = 2;

/** What a ledger entry's file is (D-466): a final compile's file, or the draft mode's copy. */
export type WriteKind = 'final' | 'draft';

const v1EntryShape = {
  /** Canonical, builds-relative (D-52); unique. */
  path: z.string().min(1),
  /** Of the bytes written. */
  sha1: z.string().regex(/^[0-9a-f]{40}$/, { message: 'a sha1 is 40 lowercase hex digits' }),
  /** `runFolderOf(plan_path)`: `<slug>/<YYYY-MM-DD>-<n>`. */
  runFolder: z.string().min(1),
  /** ISO 8601. */
  writtenAt: z.string().min(1),
};

const v1EntrySchema = z.object(v1EntryShape).strict();

const v2EntrySchema = z
  .object({
    ...v1EntryShape,
    kind: z.enum(['final', 'draft']),
    /** The plan path (relative to the guides root) that wrote it; absent only on an entry a version-1 ledger held. */
    plan: z.string().min(1).optional(),
  })
  .strict();

function uniquePaths(entries: readonly { path: string }[], ctx: z.RefinementCtx): void {
  const seen = new Set<string>();
  entries.forEach((e, i) => {
    if (seen.has(e.path)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['entries', i, 'path'], message: `path "${e.path}" has two entries` });
    }
    seen.add(e.path);
  });
}

const v1LedgerSchema = z
  .object({ ledgerVersion: z.literal(1), entries: z.array(v1EntrySchema) })
  .strict()
  .superRefine((ledger, ctx) => uniquePaths(ledger.entries, ctx));

const ledgerSchema = z
  .object({ ledgerVersion: z.literal(2), entries: z.array(v2EntrySchema) })
  .strict()
  .superRefine((ledger, ctx) => uniquePaths(ledger.entries, ctx));

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
  return { ledgerVersion: WRITE_LEDGER_VERSION, entries: [] };
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
  const version = (value as { ledgerVersion?: unknown } | null)?.ledgerVersion;
  if (version === 1) {
    // D-466: a version-1 ledger's entries are final files with no plan.
    const v1 = v1LedgerSchema.safeParse(value);
    if (!v1.success) throw invalid(file, v1.error);
    return { ledgerVersion: WRITE_LEDGER_VERSION, entries: v1.data.entries.map((e) => ({ ...e, kind: 'final' as const })) };
  }
  const parsed = ledgerSchema.safeParse(value);
  if (!parsed.success) throw invalid(file, parsed.error);
  return parsed.data;
}

function invalid(file: string, error: z.ZodError): WriteLedgerError {
  const issues = error.issues.map((i) => `${i.path.join('.') || '$'}: ${i.message}`).join('; ');
  return new WriteLedgerError(`the write ledger ${file} is invalid (${issues}); fix or remove it by hand`);
}

/** The ledger's entry for a canonical builds-relative path, if any. */
export function ledgerEntryFor(ledger: WriteLedger, relPath: string): WriteLedgerEntry | undefined {
  return ledger.entries.find((e) => e.path === relPath);
}

/** The ledger with `entry` replacing any entry for its path (a write replaces its target's entry). */
export function withLedgerEntry(ledger: WriteLedger, entry: WriteLedgerEntry): WriteLedger {
  return { ledgerVersion: WRITE_LEDGER_VERSION, entries: [...ledger.entries.filter((e) => e.path !== entry.path), entry] };
}

/** The ledger without the entry for `relPath` (the draft mode's delete drops its entry, D-466). */
export function withoutLedgerEntry(ledger: WriteLedger, relPath: string): WriteLedger {
  return { ledgerVersion: WRITE_LEDGER_VERSION, entries: ledger.entries.filter((e) => e.path !== relPath) };
}

/**
 * Whether `relPath`'s file, whose bytes hash to `sha1` (null: no file), is free for a write by the build whose plan
 * is `plan` (D-466): no file has it, or this build wrote it (the entry's `plan`) and nobody changed it since.
 */
export function freeForBuild(ledger: WriteLedger, relPath: string, sha1: string | null, plan: string): boolean {
  if (sha1 === null) return true;
  const entry = ledgerEntryFor(ledger, relPath);
  return entry !== undefined && entry.plan === plan && entry.sha1 === sha1;
}

/** The tail of each state dir's queue of ledger updates in this process. */
const queues = new Map<string, Promise<unknown>>();

/**
 * Read the ledger, give it to `fn`, and write what `fn` returns (nothing when it returns null), one update at a time
 * per state dir in this process. `fn`'s own result is passed through with the ledger written.
 */
export async function updateWriteLedger<T>(
  stateDir: string,
  fn: (ledger: WriteLedger) => Promise<{ ledger: WriteLedger | null; value: T }>,
): Promise<T> {
  const key = path.resolve(stateDir);
  const previous = queues.get(key) ?? Promise.resolve();
  const run = previous.catch(() => undefined).then(async () => {
    const { ledger, value } = await fn(await readWriteLedger(stateDir));
    if (ledger !== null) await writeWriteLedger(stateDir, ledger);
    return value;
  });
  queues.set(key, run);
  try {
    return await run;
  } finally {
    if (queues.get(key) === run) queues.delete(key);
  }
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
