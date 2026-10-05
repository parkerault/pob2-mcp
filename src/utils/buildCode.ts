/**
 * Path of Building build-code helpers.
 *
 * A PoB export code is base64(zlib-deflate(buildXml)), using URL-safe base64
 * (`-`/`_`). Share sites (pobb.in, pastebin) host that code at a raw endpoint.
 */
import zlib from "node:zlib";
import { shareSiteUserAgent } from "./userAgent.js";

const MAX_CODE_BYTES = 4 * 1024 * 1024; // 4MB guard for fetched codes
/** The inflate cap (D-50): a code may decode to at most 16 MiB of XML. */
export const MAX_XML_BYTES = 16 * 1024 * 1024;

/** The one error a too-large code produces (zlib stops at `maxOutputLength`, `ERR_BUFFER_TOO_LARGE`). */
export const TOO_LARGE_MESSAGE = "build code too large (inflates beyond 16 MiB)";

/**
 * The name of the XML document's root element, skipping the declaration, comments, processing
 * instructions and a doctype; null when there is none.
 */
export function xmlRootName(xml: string): string | null {
  let i = 0;
  for (;;) {
    const lt = xml.indexOf("<", i);
    if (lt < 0) return null;
    if (xml.startsWith("<?", lt)) {
      const end = xml.indexOf("?>", lt + 2);
      if (end < 0) return null;
      i = end + 2;
    } else if (xml.startsWith("<!--", lt)) {
      const end = xml.indexOf("-->", lt + 4);
      if (end < 0) return null;
      i = end + 3;
    } else if (xml.startsWith("<!", lt)) {
      const end = xml.indexOf(">", lt + 2);
      if (end < 0) return null;
      i = end + 1;
    } else {
      const m = /^<([A-Za-z_][\w.:-]*)/.exec(xml.slice(lt, lt + 256));
      return m ? m[1] : null;
    }
  }
}

/**
 * Require a PoE2 build document: the root element must be `<PathOfBuilding2>`. A PoE1 code
 * (`<PathOfBuilding>`) or anything else is refused, naming the root it has.
 */
export function assertPoe2BuildXml(xml: string): void {
  const root = xmlRootName(xml);
  if (root === "PathOfBuilding2") return;
  if (root === null) throw new Error("the build code does not contain a build (no XML root element; expected <PathOfBuilding2>)");
  throw new Error(
    `the build's XML root is <${root}>, expected <PathOfBuilding2>` +
      (root === "PathOfBuilding" ? " (a Path of Building 1 / PoE1 build; this server reads PoE2 builds only)" : ""),
  );
}

function isTooLarge(error: unknown): boolean {
  const code = (error as NodeJS.ErrnoException | null)?.code;
  return code === "ERR_BUFFER_TOO_LARGE" || (error instanceof RangeError && /too large|maxOutputLength/i.test(error.message));
}

/**
 * Decode a PoB export code into build XML (base64url of zlib-deflated XML).
 *
 * Every inflate is capped at 16 MiB of output (`maxOutputLength`, D-50); a code that inflates past
 * it fails with "build code too large (inflates beyond 16 MiB)" rather than being decoded. The
 * decoded document must have a `<PathOfBuilding2>` root.
 */
export function decodePobCode(code: string): string {
  const cleaned = (code || "").trim().replace(/\s+/g, "");
  if (!cleaned) throw new Error("empty build code");
  // Normalize URL-safe base64 to standard base64.
  const b64 = cleaned.replace(/-/g, "+").replace(/_/g, "/");
  let buf: Buffer;
  try {
    buf = Buffer.from(b64, "base64");
  } catch (e) {
    throw new Error(`build code is not valid base64: ${(e as Error).message}`);
  }
  if (buf.length === 0) throw new Error("build code decoded to empty data");

  // PoB codes are zlib-deflated; fall back to raw-deflate / gzip just in case. Each one is capped.
  const options = { maxOutputLength: MAX_XML_BYTES };
  const attempts: Array<(b: Buffer) => Buffer> = [
    (b) => zlib.inflateSync(b, options),
    (b) => zlib.inflateRawSync(b, options),
    (b) => zlib.gunzipSync(b, options),
  ];
  for (const inflate of attempts) {
    let xml: Buffer;
    try {
      xml = inflate(buf);
    } catch (error) {
      if (isTooLarge(error)) throw new Error(TOO_LARGE_MESSAGE);
      continue; // not this format: try the next one
    }
    const text = xml.toString("utf8");
    if (xmlRootName(text) === null) continue;
    assertPoe2BuildXml(text);
    return text;
  }
  throw new Error("failed to decode build code (not a valid PoB export code)");
}

/**
 * If `source` is a share URL (pobb.in / pastebin), rewrite it to the raw code
 * endpoint. Otherwise return it unchanged.
 */
export function rawUrlFor(source: string): string {
  const u = source.trim();
  const pobb = u.match(/^https?:\/\/pobb\.in\/([A-Za-z0-9_-]+)\/?$/i);
  if (pobb) return `https://pobb.in/${pobb[1]}/raw`;
  const pastebin = u.match(/^https?:\/\/pastebin\.com\/(?!raw\/)([A-Za-z0-9]+)\/?$/i);
  if (pastebin) return `https://pastebin.com/raw/${pastebin[1]}`;
  return u;
}

/**
 * Fetch a build code from a share URL (browser-like UA; bot filters block plain UAs).
 * `fetchImpl` is the server's injected fetch (deps.fetch, C-7).
 */
export async function fetchBuildCode(url: string, fetchImpl: typeof globalThis.fetch): Promise<string> {
  if (!/^https?:\/\//i.test(url)) throw new Error("not an http(s) URL");
  const target = rawUrlFor(url);
  const res = await fetchImpl(target, {
    headers: { "User-Agent": shareSiteUserAgent(), Accept: "*/*" },
  });
  if (!res.ok) throw new Error(`failed to fetch build (${res.status}) from ${target}`);
  const text = await res.text();
  if (text.length > MAX_CODE_BYTES) throw new Error("fetched build code exceeds size limit");
  return text.trim();
}

/**
 * Resolve a source (raw PoB code OR a share URL) into build XML.
 */
export async function resolveBuildXml(source: string, fetchImpl: typeof globalThis.fetch): Promise<string> {
  const s = (source || "").trim();
  if (!s) throw new Error("missing build source");
  const code = /^https?:\/\//i.test(s) ? await fetchBuildCode(s, fetchImpl) : s;
  return decodePobCode(code);
}
