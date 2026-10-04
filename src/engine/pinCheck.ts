import crypto from "crypto";
import fs from "fs";
import path from "path";
import { packageRoot } from "../utils/packageRoot.js";

/** `pob-pin.json` (C-6): the single source of truth for the PoB2 engine version. */
export interface PobPin {
  repo: string;
  tag: string;
  commit: string;
  version: string;
  headlessWrapperSha1: string;
}

export type PinCheckResult =
  | { ok: true; warnings: string[] }
  | { ok: false; reason: string; hint: string };

export interface PinCheckOptions {
  /** The checkout's `src/` directory (`resolvePobSrc`). */
  pobSrc: string;
  pin: PobPin;
  /** `POB_ALLOW_UNPINNED=true`: failures become warnings. */
  allowUnpinned: boolean;
}

export const PIN_HINT = "run `mise run pob:fetch`";

/** How many mismatching file names a reason lists before summarising the rest. */
const MAX_NAMED_FILES = 10;
/** Parallel file reads while hashing the manifest. */
const READ_CONCURRENCY = 16;

/** Read and validate `<packageRoot>/pob-pin.json`. */
export function readPin(root: string = packageRoot()): PobPin {
  const file = path.join(root, "pob-pin.json");
  const raw = JSON.parse(fs.readFileSync(file, "utf8")) as Record<string, unknown>;
  for (const key of ["repo", "tag", "commit", "version", "headlessWrapperSha1"]) {
    if (typeof raw[key] !== "string" || (raw[key] as string).length === 0) {
      throw new Error(`${file}: missing or invalid "${key}"`);
    }
  }
  return raw as unknown as PobPin;
}

/**
 * sha1 using PoB's manifest scheme (`update_manifest.py:104-108`): line endings are normalized
 * to CRLF (`re.sub(rb"\r\n?|\n", b"\r\n")`), unless the content has a NUL byte, in which case
 * the raw bytes are hashed.
 */
export function manifestSha1(buf: Buffer): string {
  const hash = crypto.createHash("sha1");
  if (buf.indexOf(0) !== -1 || (buf.indexOf(10) === -1 && buf.indexOf(13) === -1)) {
    return hash.update(buf).digest("hex");
  }
  const n = buf.length;
  const out = Buffer.allocUnsafe(n * 2);
  let j = 0;
  for (let i = 0; i < n; i++) {
    const c = buf[i];
    if (c === 13) {
      out[j++] = 13;
      out[j++] = 10;
      if (i + 1 < n && buf[i + 1] === 10) i++;
    } else if (c === 10) {
      out[j++] = 13;
      out[j++] = 10;
    } else {
      out[j++] = c;
    }
  }
  return hash.update(out.subarray(0, j)).digest("hex");
}

interface ManifestFile {
  name: string;
  part: string;
  sha1: string;
}

function parseAttributes(tag: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  for (const m of tag.matchAll(/([A-Za-z_][\w-]*)\s*=\s*"([^"]*)"/g)) attrs[m[1]] = m[2];
  return attrs;
}

function parseManifest(xml: string): { version: string | null; files: ManifestFile[] } {
  const versionTag = xml.match(/<Version\b[^>]*>/);
  const version = versionTag ? parseAttributes(versionTag[0]).number ?? null : null;
  const files: ManifestFile[] = [];
  for (const m of xml.matchAll(/<File\b[^>]*>/g)) {
    const a = parseAttributes(m[0]);
    if (a.name && a.part && a.sha1) {
      files.push({ name: a.name.replace(/\{space\}/g, " "), part: a.part, sha1: a.sha1.toLowerCase() });
    }
  }
  return { version, files };
}

function isMissing(err: unknown): boolean {
  const code = (err as NodeJS.ErrnoException | undefined)?.code;
  return code === "ENOENT" || code === "ENOTDIR" || code === "EISDIR";
}

async function readIfPresent(file: string): Promise<Buffer | null> {
  try {
    return await fs.promises.readFile(file);
  } catch (err) {
    if (isMissing(err)) return null;
    throw err;
  }
}

/** Names of manifest files that are present under their part root but don't match their sha1. */
async function findMismatches(files: ManifestFile[], checkoutRoot: string, pobSrc: string): Promise<string[]> {
  const partRoots: Record<string, string> = {
    default: checkoutRoot,
    program: pobSrc,
    tree: pobSrc,
    runtime: path.join(checkoutRoot, "runtime"),
  };
  const mismatched: string[] = [];
  let next = 0;
  const worker = async () => {
    while (next < files.length) {
      const f = files[next++];
      const root = partRoots[f.part];
      if (!root) continue;
      const buf = await readIfPresent(path.join(root, f.name));
      if (buf === null) continue; // absent files are skipped (sparse checkout)
      if (manifestSha1(buf) !== f.sha1) mismatched.push(f.name);
    }
  };
  await Promise.all(Array.from({ length: READ_CONCURRENCY }, worker));
  return mismatched.sort();
}

function describeFiles(names: string[]): string {
  const shown = names.slice(0, MAX_NAMED_FILES).join(", ");
  const more = names.length > MAX_NAMED_FILES ? ` and ${names.length - MAX_NAMED_FILES} more` : "";
  return `${shown}${more}`;
}

async function runChecks(opts: PinCheckOptions, fail: (reason: string) => boolean): Promise<void> {
  const pobSrc = path.resolve(opts.pobSrc);
  const { pin } = opts;
  const checkoutRoot = path.dirname(pobSrc);

  // 1. manifest.xml version
  const manifestPath = path.join(checkoutRoot, "manifest.xml");
  const manifestBuf = await readIfPresent(manifestPath);
  let files: ManifestFile[] | null = null;
  if (manifestBuf === null) {
    if (fail(`PoB checkout not found: ${manifestPath} is missing`)) return;
  } else {
    const manifest = parseManifest(manifestBuf.toString("utf8"));
    files = manifest.files;
    if (manifest.version !== pin.version) {
      if (fail(`PoB version ${manifest.version ?? "(none)"} in ${manifestPath} does not match the pinned ${pin.version}`)) return;
    }
  }

  // 2. .git/HEAD (only when the checkout has one)
  const headPath = path.join(checkoutRoot, ".git", "HEAD");
  const headBuf = await readIfPresent(headPath);
  if (headBuf !== null) {
    const head = headBuf.toString("utf8").trim();
    if (head.startsWith("ref:")) {
      if (fail(`${headPath} is "${head}": not a pinned detached checkout (expected commit ${pin.commit})`)) return;
    } else if (head !== pin.commit) {
      if (fail(`checkout is at commit ${head}, not the pinned ${pin.tag} commit ${pin.commit}`)) return;
    }
  }

  // 3. every present manifest file matches its sha1
  if (files !== null) {
    const mismatched = await findMismatches(files, checkoutRoot, pobSrc);
    if (mismatched.length > 0) {
      if (fail(`${mismatched.length} file(s) differ from the pinned ${pin.tag} manifest: ${describeFiles(mismatched)}`)) return;
    }
  }

  // 4. HeadlessWrapper.lua (not in the manifest; pinned in pob-pin.json)
  const wrapperPath = path.join(pobSrc, "HeadlessWrapper.lua");
  const wrapper = await readIfPresent(wrapperPath);
  if (wrapper === null) {
    fail(`HeadlessWrapper.lua not found at ${wrapperPath}`);
  } else {
    const sha1 = manifestSha1(wrapper);
    if (sha1 !== pin.headlessWrapperSha1.toLowerCase()) {
      fail(`HeadlessWrapper.lua sha1 ${sha1} does not match the pinned ${pin.headlessWrapperSha1}`);
    }
  }
}

/** Successful results only, so a fixed checkout passes without a server restart. */
const okMemo = new Map<string, PinCheckResult>();

/**
 * Refuse an unpinned PoB checkout (C-6). Checks, in order: manifest version, `.git/HEAD`,
 * every present manifest file's sha1, and `HeadlessWrapper.lua`'s sha1. With `allowUnpinned`
 * every failure becomes a warning and the result is `ok`. Only `ok` results are memoized.
 */
export async function checkPin(opts: PinCheckOptions): Promise<PinCheckResult> {
  const key = [path.resolve(opts.pobSrc), opts.pin.commit, opts.pin.version, opts.pin.headlessWrapperSha1, String(opts.allowUnpinned)].join("\n");
  const memo = okMemo.get(key);
  if (memo) return memo;

  const warnings: string[] = [];
  const state: { refusal: string | null } = { refusal: null };
  await runChecks(opts, (reason) => {
    if (opts.allowUnpinned) {
      warnings.push(reason);
      return false; // keep checking
    }
    state.refusal = reason;
    return true; // stop at the first failure
  });

  if (state.refusal !== null) return { ok: false, reason: state.refusal, hint: PIN_HINT };
  const result: PinCheckResult = { ok: true, warnings };
  okMemo.set(key, result);
  return result;
}
