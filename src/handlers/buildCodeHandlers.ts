import type { HandlerContext } from "../utils/contextBuilder.js";
import { assertPoe2BuildXml, encodePobCode, MAX_XML_BYTES } from "../utils/buildCode.js";
import { wrapHandler } from "../utils/errorHandling.js";

/** Strict UTF-8 that keeps a byte-order mark, so the decoded text re-encodes to the file's exact bytes. */
const UTF8 = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true });

/**
 * `encode_build_code` (C-42): a builds-folder file as a PoB2 import code. The name resolves to its
 * canonical path (D-52), the file's bytes are read and must hold a `<PathOfBuilding2>` document, and the
 * code is `encodePobCode` of exactly those bytes, so decoding it gives the file back. It never starts or
 * touches the engine (kind `none`).
 *
 * Refused besides a bad name, a missing file or a non-PoE2 root: a file that isn't UTF-8 text (its code
 * could not decode to its bytes), and one over the 16 MiB a code may decode to (D-50), which
 * `import_build` would refuse.
 */
export async function handleEncodeBuildCode(context: Pick<HandlerContext, "buildService">, buildName: unknown) {
  return wrapHandler("encode build code", async () => {
    if (typeof buildName !== "string" || buildName.trim() === "") throw new Error("Missing build_name");
    const file = await context.buildService.readBuildFile(buildName);
    if (file.bytes.length > MAX_XML_BYTES) {
      throw new Error(`${file.rel} is ${file.bytes.length} bytes; an import code may decode to at most 16 MiB`);
    }
    let xml: string;
    try {
      xml = UTF8.decode(file.bytes);
    } catch {
      throw new Error(`${file.rel} is not UTF-8 text, so it is not a Path of Building 2 build file`);
    }
    try {
      assertPoe2BuildXml(xml);
    } catch (error) {
      throw new Error(`${file.rel}: ${(error as Error).message}`);
    }
    return {
      content: [{
        type: "text" as const,
        text: `Import code for ${file.rel} (${file.bytes.length} bytes): ${encodePobCode(xml)}`,
      }],
    };
  });
}
