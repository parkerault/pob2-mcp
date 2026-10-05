/**
 * WU-13: the canonical export (AC-E16's definition, `canonicalize` in `engineSession.ts`) compared
 * **across a reload** of the same build.
 *
 * `withTemporaryBuild` (D-9) restores the working build by loading it again from its snapshot. PoB2
 * then serializes several things in Lua hash-table (`pairs()`) order, and that order changes whenever
 * the same build is loaded again, so an export taken after the reload differs textually from one taken
 * before it even though the build is identical. Observed at the pin (WU-13 fixer run, strict
 * `canonicalize`): the `<Spec nodes>` list and the tree `<URL>` that encodes it, the
 * `<AttributeOverride>` node lists, the config set's `<Input>`/`<Placeholder>` element order, and the
 * attribute order of `<Spec>`/`<AttributeOverride>`/`<Placeholder>`/`<Input>`.
 *
 * AC-E48 (with notes), AC-E51 and AC-E56's `compare_builds` bullet say "canonical export identical"
 * across exactly such a reload, which the literal definition cannot satisfy; this comparison is the
 * closest faithful check and is reported to the coordinator as a spec gap (AC-E16's definition does not
 * name pairs()-order normalization). The strict `canonicalize` stays the AC-E16 helper for every check
 * that involves no reload.
 *
 * On top of `canonicalize`, this puts in a fixed order everything the pinned PoB2 writes from `pairs()`:
 * - every tag's attributes are sorted by name (PoB's `xml.attrib` tables are hash tables);
 * - the node-id sets (`nodes` on `<Spec>` and `<WeaponSetN>`, `strNodes`/`dexNodes`/`intNodes` on
 *   `<AttributeOverride>`) are sorted numerically (`PassiveSpec:Save` iterates `pairs(self.allocNodes)` /
 *   `pairs(self.hashOverrides)`);
 * - `masteryEffects` entries (`{mastery,effect}`, from `pairs(self.masterySelections)`) are sorted;
 * - the `<URL>` body (the same node set, encoded in that order) is dropped;
 * - each run of consecutive `<Socket …/>` elements (`pairs(self.jewels)`), `<WeaponSetN …/>` elements
 *   (`pairs(weaponSets)`) and `<Input …/>`/`<Placeholder …/>` elements (the config set's input tables)
 *   is sorted.
 * Everything else (other element order, values, text) is compared as exported.
 */
import type { EngineSession } from '../../src/engine/session';
import { canonicalize } from './engineSession';

/** Attributes whose value is a set of node ids that PoB writes in `pairs()` order. */
const NODE_SET_ATTRS = new Set(['nodes', 'strNodes', 'dexNodes', 'intNodes']);

function normalizeAttr(name: string, value: string): string {
  if (NODE_SET_ATTRS.has(name) && /^\d+(,\d+)*$/.test(value)) {
    return value.split(',').map(Number).sort((a, b) => a - b).join(',');
  }
  if (name === 'masteryEffects' && value) {
    return (value.match(/\{[^}]*\}/g) ?? [value]).sort().join(',');
  }
  return value;
}

/** One start or self-closing tag with its attributes sorted by name and their sets normalized. */
function normalizeTag(tag: string): string {
  const m = /^<([A-Za-z_][\w.:-]*)([^>]*?)(\/?)>$/.exec(tag);
  if (!m) return tag;
  const attrs = [...m[2].matchAll(/([\w.:-]+)="([^"]*)"/g)].map(([, name, value]) => [name, normalizeAttr(name, value)]);
  attrs.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return `<${m[1]}${attrs.map(([n, v]) => ` ${n}="${v}"`).join('')}${m[3] ? '/' : ''}>`;
}

/** Sort each run of consecutive self-closing elements whose name matches `names`. */
function sortRuns(xml: string, names: string): string {
  const element = `<(?:${names})\\b[^>]*\\/>`;
  return xml.replace(new RegExp(`(?:\\s*${element})+`, 'g'), (run) =>
    '\n' + (run.match(new RegExp(element, 'g')) ?? []).sort().join('\n'),
  );
}

/** The canonical export with PoB's `pairs()`-ordered output put in a fixed order (see the file comment). */
export function canonicalizeAcrossReload(xml: string): string {
  let out = canonicalize(xml)
    .replace(/<URL>[\s\S]*?<\/URL>/g, '<URL/>')
    .replace(/<[A-Za-z_][\w.:-]*(?:\s+[\w.:-]+="[^"]*")*\s*\/?>/g, normalizeTag);
  out = sortRuns(out, 'Input|Placeholder');
  out = sortRuns(out, 'Socket');
  out = sortRuns(out, 'WeaponSet\\d+');
  return out;
}

/** The engine's build as `canonicalizeAcrossReload`, read through the session (a `read` run). */
export async function canonicalExportAcrossReload(session: EngineSession): Promise<string> {
  const { value } = await session.run({ tool: 'test:canonical-export', kind: 'read' }, async (ctx) => {
    return ctx.client.exportBuildXml();
  });
  return canonicalizeAcrossReload(value);
}
