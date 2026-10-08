/**
 * The baseline list (D-230, slice 2 §3.7): `data/config-baseline.json` names the config options that may
 * keep PoB's default or placeholder, each with a one-line rationale (full life or mana as a neutral state,
 * PoB's own enemy model for the stage's `enemyIsBoss`, an option only one skill reads). V2's default audit
 * accepts a listed option: it never gets `default-unlisted`, and its `configEffective` class is `baseline`.
 *
 * The file is read through its own zod schema; the data directory is injectable for tests. An invalid file
 * is an error naming the file and the option.
 */
import fs from 'fs';
import path from 'path';
import { z } from 'zod';
import { defaultDataDir } from '../referenceData.js';

/** The baseline list's file name, in the data directory. */
export const CONFIG_BASELINE_FILE = 'config-baseline.json';

/** The baseline list's schema versions this server accepts. */
export const CONFIG_BASELINE_VERSIONS: readonly number[] = [1];

const rationaleSchema = z
  .string()
  .refine((s) => s.trim() !== '', { message: 'the rationale must not be empty' })
  .refine((s) => !/[\r\n]/.test(s), { message: 'the rationale is one line' });

export const configBaselineSchema = z
  .object({
    schemaVersion: z.literal(1, {
      errorMap: () => ({ message: `schemaVersion must be one of [${CONFIG_BASELINE_VERSIONS.join(', ')}]` }),
    }),
    options: z.record(
      z.string().min(1, { message: 'an option name must not be empty' }),
      z.object({ rationale: rationaleSchema }).strict(),
    ),
  })
  .strict();

/** `{schemaVersion: 1, options: {<ConfigOptions var>: {rationale}}}`. */
export type ConfigBaseline = z.infer<typeof configBaselineSchema>;

/** An invalid baseline list; `errors` name the file and the option. */
export class ConfigBaselineError extends Error {
  constructor(readonly errors: readonly string[]) {
    super(`invalid config baseline list (D-230):\n${errors.map((e) => `- ${e}`).join('\n')}`);
    this.name = 'ConfigBaselineError';
  }
}

/** An issue path: `options["<option>"].rationale`, `schemaVersion`, or `$` for the root. */
function pathText(p: readonly (string | number)[]): string {
  let out = '';
  p.forEach((seg, i) => {
    if (typeof seg === 'number') out += `[${seg}]`;
    else if (i === 1 && p[0] === 'options') out += `[${JSON.stringify(seg)}]`;
    else out += out === '' ? seg : `.${seg}`;
  });
  return out === '' ? '$' : out;
}

/** Parse and check the list's text; `file` names it in every error. */
export function parseConfigBaseline(file: string, text: string): { ok: true; baseline: ConfigBaseline } | { ok: false; errors: string[] } {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch (e) {
    return { ok: false, errors: [`${file}: not valid JSON: ${(e as Error).message}`] };
  }
  const parsed = configBaselineSchema.safeParse(value);
  if (parsed.success) return { ok: true, baseline: parsed.data };
  return { ok: false, errors: [...new Set(parsed.error.issues.map((iss) => `${file}: ${pathText(iss.path)}: ${iss.message}`))] };
}

/** Load `<dataDir>/config-baseline.json` (default: the package's `data/`). Throws `ConfigBaselineError`. */
export function loadConfigBaseline(dataDir: string = defaultDataDir()): ConfigBaseline {
  const file = path.join(dataDir, CONFIG_BASELINE_FILE);
  let text: string;
  try {
    text = fs.readFileSync(file, 'utf8');
  } catch (e) {
    throw new ConfigBaselineError([`${file}: can't read: ${(e as Error).message}`]);
  }
  const parsed = parseConfigBaseline(file, text);
  if (!parsed.ok) throw new ConfigBaselineError(parsed.errors);
  return parsed.baseline;
}
