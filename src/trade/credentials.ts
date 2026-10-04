/**
 * Trade session credentials (C-9).
 *
 * `createCredentialGetter({env, dotenvPath})` returns a getter that re-reads the session cookie on
 * every call, so a refreshed `POESESSID` works without a restart (FR-T1). Precedence:
 *   1. `env.POESESSID`, 2. `env.POE_SESSION_ID`, 3. the dotenv file's `POESESSID`,
 *   4. the dotenv file's `POE_SESSION_ID`.
 * Whitespace-only values count as absent. The getter never mutates the env, never logs the value
 * and never includes it in an error.
 */
import fs from 'fs';
import util from 'util';

export interface Credentials {
  sessionId: string | null;
  source: 'process-env' | 'dotenv' | null;
  problem?: 'op-reference' | 'malformed';
}

export interface CredentialGetterOptions {
  env: Readonly<Record<string, string | undefined>>;
  /** `<packageRoot>/.env`. */
  dotenvPath: string;
  /** Test seam; defaults to `fs.readFileSync(path, 'utf8')`. */
  readFile?: (p: string) => string;
}

const KEYS = ['POESESSID', 'POE_SESSION_ID'] as const;

/**
 * RFC 6265 `cookie-octet`: %x21 / %x23-2B / %x2D-3A / %x3C-5B / %x5D-7E, i.e. visible US-ASCII
 * except DQUOTE, comma, semicolon and backslash (and so no whitespace or control characters).
 */
const COOKIE_OCTETS = /^[\x21\x23-\x2B\x2D-\x3A\x3C-\x5B\x5D-\x7E]+$/;

/** The first non-blank value among `KEYS` in `vars`, trimmed. */
function pick(vars: Readonly<Record<string, string | undefined>>): string | null {
  for (const key of KEYS) {
    const value = vars[key];
    if (typeof value === 'string' && value.trim() !== '') return value.trim();
  }
  return null;
}

function classify(value: string, source: 'process-env' | 'dotenv'): Credentials {
  if (value.startsWith('op://')) return { sessionId: null, source, problem: 'op-reference' };
  if (!COOKIE_OCTETS.test(value)) return { sessionId: null, source, problem: 'malformed' };
  return { sessionId: value, source };
}

function readDotenv(dotenvPath: string, readFile: (p: string) => string): Record<string, string | undefined> {
  let content: string;
  try {
    content = readFile(dotenvPath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException)?.code === 'ENOENT') return {};
    // Any other read failure: report the path and the error code, never the content.
    const code = (error as NodeJS.ErrnoException)?.code ?? 'unknown error';
    console.error(`[Credentials] cannot read ${dotenvPath} (${code}); no trade session`);
    return {};
  }
  if (content.charCodeAt(0) === 0xfeff) content = content.slice(1);
  return util.parseEnv(content) as Record<string, string | undefined>;
}

export function createCredentialGetter(opts: CredentialGetterOptions): () => Credentials {
  const readFile = opts.readFile ?? ((p: string) => fs.readFileSync(p, 'utf8'));
  return (): Credentials => {
    const fromEnv = pick(opts.env);
    if (fromEnv !== null) return classify(fromEnv, 'process-env');
    const fromFile = pick(readDotenv(opts.dotenvPath, readFile));
    if (fromFile !== null) return classify(fromFile, 'dotenv');
    return { sessionId: null, source: null };
  };
}

/** The actionable reason a credential result carries no usable session (never the value). */
export function describeMissingSession(creds: Credentials): string {
  const where = creds.source === 'process-env' ? 'the environment' : '.env';
  if (creds.problem === 'op-reference') {
    return `POESESSID in ${where} is a 1Password op:// reference, which this server does not resolve; put the cookie value itself there`;
  }
  if (creds.problem === 'malformed') {
    return `POESESSID in ${where} is not a valid cookie value (it contains spaces, quotes, semicolons or control characters); copy it again from your browser`;
  }
  return 'no trade session: set POESESSID (your pathofexile.com session cookie) in the .env file next to package.json';
}
