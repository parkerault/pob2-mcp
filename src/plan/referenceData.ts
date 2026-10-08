/**
 * C-35: the C1 (campaign) and E1 (enemy) data files and their loader (slice 2 §3.4).
 *
 * The files are repo-root `data/campaign/*.json` and `data/enemies/*.json`, outside `src/` (D-168): cited
 * game facts tied to a patch, read here and by the plan checks, never written as literals in `src/`. Each
 * file is `{schemaVersion: 1, sources[], facts}`; every `sources[]` entry is a C-30 tag with an `id`, and
 * every fact carries its value, the id of its source, its patch and its confidence (gap 18). An invalid
 * file is an error naming the file and the fact id (or `sources[n]`).
 *
 * A fact key is a fact id, optionally followed by `[<member>]` to pick one member of an object value (by
 * name, `life.by-level[79]`) or of an array value (by 0-based index).
 */
import fs from 'fs';
import path from 'path';
import { z } from 'zod';
import { packageRoot } from '../utils/packageRoot.js';
import { sourceTagWith, type SourceTag } from './sourceTag.js';

/** The data-file schema versions this server accepts. */
export const DATA_SCHEMA_VERSIONS: readonly number[] = [1];

/** The two folders under `data/` the loader reads (C1, then E1). */
export const DATA_FOLDERS = ['campaign', 'enemies'] as const;

/** A fact id: lowercase letters and digits in runs joined by `.` or `-`. */
export const FACT_ID_RE = /^[a-z0-9]+([.-][a-z0-9]+)*$/;

/** A progress key (C-31, D-214): `start`, `endgame` or `q.<QuestRewards key>` (A-P13). */
export const PROGRESS_KEY_RE = /^(start|endgame|q\.[a-z0-9]+(-[a-z0-9]+)*)$/;

/** The file holding the progress keys, and the fact id of their list (A-P10). */
const PROGRESS_FILE = 'campaign/progress.json';
const ORDER_FACT = 'order';
const FIRST_KEY = 'start';
const LAST_KEY = 'endgame';

const FACT_KEY_RE = /^([a-z0-9]+(?:[.-][a-z0-9]+)*)(?:\[([^\][]+)\])?$/;

/** A fact's value: a number, string, boolean, `{min,max}` range, flat record, or string list. */
const factValueSchema = z.union([
  z.number().finite(),
  z.string(),
  z.boolean(),
  z.object({ min: z.number().finite(), max: z.number().finite() }).strict(),
  z.record(z.string(), z.union([z.number().finite(), z.string()])),
  z.array(z.string()),
]);

/** Whether a value is a `{min, max}` range (an object with exactly those two numeric keys). */
function isRange(v: unknown): v is { min: number; max: number } {
  if (typeof v !== 'object' || v === null || Array.isArray(v)) return false;
  const keys = Object.keys(v).sort();
  const r = v as Record<string, unknown>;
  return keys.length === 2 && keys[0] === 'max' && keys[1] === 'min' && typeof r.min === 'number' && typeof r.max === 'number';
}

const nonEmpty = (field: string) => z.string().min(1, { message: `${field} must not be empty` });

const factSchema = z
  .object({
    value: factValueSchema,
    source: nonEmpty('source'),
    patch: nonEmpty('patch'),
    confidence: z.enum(['H', 'M', 'L']),
    note: nonEmpty('note').optional(),
  })
  .strict()
  .superRefine((fact, ctx) => {
    if (isRange(fact.value) && fact.value.min > fact.value.max) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['value'], message: 'a {min, max} range has min <= max' });
    }
  });

const dataSourceSchema = sourceTagWith({ id: nonEmpty('id') });

/** One data file: its sources (C-30 tags with ids) and its facts, each citing one source id. */
export const dataFileSchema = z
  .object({
    schemaVersion: z.literal(1, {
      errorMap: () => ({ message: `schemaVersion must be one of [${DATA_SCHEMA_VERSIONS.join(', ')}]` }),
    }),
    sources: z.array(dataSourceSchema),
    facts: z.record(z.string(), factSchema),
  })
  .strict()
  .superRefine((file, ctx) => {
    const ids = new Map<string, number>();
    file.sources.forEach((s, i) => {
      const at = ids.get(s.id);
      if (at !== undefined) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['sources', i, 'id'], message: `source id "${s.id}" is already used by sources[${at}]` });
      } else {
        ids.set(s.id, i);
      }
    });
    for (const [id, fact] of Object.entries(file.facts)) {
      if (!FACT_ID_RE.test(id)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['facts', id], message: 'a fact id matches ^[a-z0-9]+([.-][a-z0-9]+)*$' });
      }
      if (!ids.has(fact.source)) {
        const known = [...ids.keys()].join(', ') || 'none';
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['facts', id, 'source'],
          message: `unknown source id "${fact.source}"; this file's source ids: ${known}`,
        });
      }
    }
  });

export type DataFile = z.infer<typeof dataFileSchema>;
export type Fact = DataFile['facts'][string];
export type FactValue = Fact['value'];
export type DataSource = DataFile['sources'][number];

/** A fact key that resolved: the fact, the value it picks (one member, or the whole value) and its tag. */
export interface ResolvedFact {
  file: string;
  factId: string;
  member?: string;
  fact: Fact;
  value: FactValue | number | string;
  /** The fact's own C-30 tag (its source entry without `id`), the tag a plan copies with the value (D-168). */
  tag: SourceTag;
}

export type FactLookup = { ok: true; fact: ResolvedFact } | { ok: false; reason: string };

/** What `validatePlan` checks a plan against (D-214, D-232). */
export interface PlanReferenceData {
  /** C1's progress keys in order: `start`, one key per quest-reward row, `endgame` (A-P10). */
  readonly progressKeys: readonly string[];
  /** Resolve `<key>` in `<file>` (relative to `data/`), or say why it doesn't resolve. */
  resolveFact(file: string, key: string): FactLookup;
}

/** The loaded C1 and E1 data. */
export interface ReferenceData extends PlanReferenceData {
  /** The `data/` directory the files came from. */
  readonly dataDir: string;
  /** Every loaded file by its path relative to `data/` (`campaign/limits.json`), in load order. */
  readonly files: ReadonlyMap<string, DataFile>;
  /** Whether `<key>` resolves in `<file>`. */
  hasFact(file: string, key: string): boolean;
}

/** One or more invalid data files; `errors` holds one line per problem, each naming its file. */
export class ReferenceDataError extends Error {
  constructor(readonly errors: readonly string[]) {
    super(`invalid C1/E1 data (C-35):\n${errors.map((e) => `- ${e}`).join('\n')}`);
    this.name = 'ReferenceDataError';
  }
}

/** `<packageRoot>/data`. */
export function defaultDataDir(): string {
  return path.join(packageRoot(), 'data');
}

/** Render a data-file issue path: `facts["<id>"].x`, `sources[n].x`. */
function renderDataPath(p: readonly (string | number)[]): string {
  let out = '';
  p.forEach((seg, i) => {
    if (typeof seg === 'number') out += `[${seg}]`;
    else if (i === 1 && p[0] === 'facts') out += `[${JSON.stringify(seg)}]`;
    else out += out === '' ? seg : `.${seg}`;
  });
  return out === '' ? '$' : out;
}

/**
 * Parse and validate one data file's text. `file` is its path relative to `data/`, used in every error.
 * Returns the file, or its errors.
 */
export function parseDataFile(file: string, text: string): { ok: true; data: DataFile } | { ok: false; errors: string[] } {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch (e) {
    return { ok: false, errors: [`${file}: not valid JSON: ${(e as Error).message}`] };
  }
  const parsed = dataFileSchema.safeParse(value);
  if (parsed.success) return { ok: true, data: parsed.data };
  const errors = parsed.error.issues.map((iss) => `${file}: ${renderDataPath(iss.path)}: ${iss.message}`);
  return { ok: false, errors: [...new Set(errors)] };
}

/** Check C1's `order` fact: the progress keys (A-P10, D-214). Returns the keys, or errors. */
function progressKeysOf(files: ReadonlyMap<string, DataFile>): { keys: string[]; errors: string[] } {
  const where = `${PROGRESS_FILE}: facts[${JSON.stringify(ORDER_FACT)}]`;
  const progress = files.get(PROGRESS_FILE);
  if (progress === undefined) return { keys: [], errors: [`${PROGRESS_FILE}: missing; it holds the progress keys (D-214)`] };
  const order = progress.facts[ORDER_FACT];
  if (order === undefined) return { keys: [], errors: [`${where}: missing; it lists the progress keys (A-P10)`] };
  if (!Array.isArray(order.value)) return { keys: [], errors: [`${where}.value: a list of progress keys`] };
  const keys = order.value;
  const errors: string[] = [];
  if (keys[0] !== FIRST_KEY || keys[keys.length - 1] !== LAST_KEY) {
    errors.push(`${where}.value: starts with "${FIRST_KEY}" and ends with "${LAST_KEY}" (A-P10)`);
  }
  const seen = new Set<string>();
  keys.forEach((k, i) => {
    if (!PROGRESS_KEY_RE.test(k)) errors.push(`${where}.value[${i}]: "${k}" isn't start, endgame or q.<key> (D-214)`);
    if (seen.has(k)) errors.push(`${where}.value[${i}]: "${k}" is listed twice`);
    seen.add(k);
  });
  return { keys, errors };
}

function memberOf(value: FactValue, member: string): FactValue | number | string | undefined {
  if (Array.isArray(value)) return /^(0|[1-9]\d*)$/.test(member) ? value[Number(member)] : undefined;
  if (typeof value === 'object' && value !== null && Object.prototype.hasOwnProperty.call(value, member)) {
    return (value as Record<string, number | string>)[member];
  }
  return undefined;
}

/** A source entry without its `id`: the C-30 tag itself. */
function tagOf(source: DataSource): SourceTag {
  const tag: SourceTag = { kind: source.kind, ref: source.ref };
  if (source.accessed !== undefined) tag.accessed = source.accessed;
  if (source.patch !== undefined) tag.patch = source.patch;
  if (source.confidence !== undefined) tag.confidence = source.confidence;
  return tag;
}

function makeReferenceData(dataDir: string, files: ReadonlyMap<string, DataFile>, progressKeys: string[]): ReferenceData {
  const resolveFact = (file: string, key: string): FactLookup => {
    const data = files.get(file);
    if (data === undefined) {
      return { ok: false, reason: `no data file "${file}"; the loaded files: ${[...files.keys()].join(', ') || 'none'}` };
    }
    const m = FACT_KEY_RE.exec(key);
    if (!m) return { ok: false, reason: `"${key}" isn't a fact id, optionally followed by [<member>]` };
    const [, factId, member] = m;
    const fact = Object.prototype.hasOwnProperty.call(data.facts, factId) ? data.facts[factId] : undefined;
    if (fact === undefined) return { ok: false, reason: `${file} has no fact "${factId}"` };
    const tag = tagOf(data.sources.find((s) => s.id === fact.source)!);
    if (member === undefined) return { ok: true, fact: { file, factId, fact, value: fact.value, tag } };
    const picked = memberOf(fact.value, member);
    if (picked === undefined) return { ok: false, reason: `${file}#${factId} has no member [${member}]` };
    return { ok: true, fact: { file, factId, member, fact, value: picked, tag } };
  };
  return {
    dataDir,
    files,
    progressKeys,
    resolveFact,
    hasFact: (file, key) => resolveFact(file, key).ok,
  };
}

/**
 * Load every `*.json` under `<dataDir>/campaign` and `<dataDir>/enemies` (default `<packageRoot>/data`),
 * each through the data-file schema, and check C1's progress keys. Throws `ReferenceDataError` listing
 * every problem, each naming its file.
 */
export function loadReferenceData(dataDir: string = defaultDataDir()): ReferenceData {
  const files = new Map<string, DataFile>();
  const errors: string[] = [];
  for (const folder of DATA_FOLDERS) {
    const dir = path.join(dataDir, folder);
    let names: string[];
    try {
      names = fs.readdirSync(dir).filter((n) => n.endsWith('.json')).sort();
    } catch (e) {
      errors.push(`${folder}/: can't read ${dir}: ${(e as Error).message}`);
      continue;
    }
    for (const name of names) {
      const rel = `${folder}/${name}`;
      let text: string;
      try {
        text = fs.readFileSync(path.join(dir, name), 'utf8');
      } catch (e) {
        errors.push(`${rel}: can't read: ${(e as Error).message}`);
        continue;
      }
      const parsed = parseDataFile(rel, text);
      if (parsed.ok) files.set(rel, parsed.data);
      else errors.push(...parsed.errors);
    }
  }
  const progress = progressKeysOf(files);
  // An invalid progress file already has its errors; don't add "missing" to them.
  if (!errors.some((e) => e.startsWith(`${PROGRESS_FILE}: `))) errors.push(...progress.errors);
  if (errors.length > 0) throw new ReferenceDataError(errors);
  return makeReferenceData(dataDir, files, progress.keys);
}
