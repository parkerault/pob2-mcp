/**
 * The config values a PoB save drops, put back (D-248, D-212).
 *
 * PoB's `ConfigTab:Save` writes a config set's input only when it differs from `GetDefaultState`, which
 * reads the *active* config set's placeholder (pin `Classes/ConfigTab.lua:712-715, 741-742`), not the
 * placeholder of the set being saved. So a stage whose explicit value equals the saved stage's placeholder
 * (or a default) loses it in the file, and on reload PoB applies that stage's own placeholder instead:
 * the loadout no longer reproduces its record. The compiler therefore puts every listed option the save
 * left out back into its stage's `<ConfigSet>` of the exported XML before writing, and then checks that
 * every listed option is in the file with its value.
 *
 * The XML is PoB's own (`runtime/lua/xml.lua`): one element per line, attributes in any order, values
 * escaped as `&lt; &gt; &amp; &apos; &quot;`, and a set with no child written as `<ConfigSet …/>`.
 */

export type ConfigValue = boolean | number | string;

/** A config set and the stored values of the options its stages list. */
export interface ConfigSetInputs {
  id: number;
  inputs: Readonly<Record<string, ConfigValue>>;
}

const DECODE: Record<string, string> = { lt: '<', gt: '>', amp: '&', apos: "'", quot: '"' };
const ENCODE: Record<string, string> = { '<': 'lt', '>': 'gt', '&': 'amp', "'": 'apos', '"': 'quot' };

const decode = (s: string) => s.replace(/&(\w+);/g, (m, e: string) => DECODE[e] ?? m);
const encode = (s: string) => s.replace(/[<>&'"]/g, (c) => `&${ENCODE[c]};`);

function attributes(text: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const m of text.matchAll(/(\w+)="([^"]*)"/g)) out[m[1]] = decode(m[2]);
  return out;
}

/** One `<ConfigSet>` of the `<Config>` section: its id, where it is, and its inputs as written. */
interface SavedSet {
  id: number;
  /** The offsets of its opening tag (`tagStart`…`tagEnd`), and of its closing tag (or -1 when self-closing). */
  tagStart: number;
  tagEnd: number;
  closeStart: number;
  attrText: string;
  inputs: Map<string, ConfigValue>;
}

function savedSets(xml: string): SavedSet[] {
  const config = /<Config(?:\s[^>]*)?>/.exec(xml);
  if (!config) return [];
  const end = xml.indexOf('</Config>', config.index);
  const limit = end < 0 ? xml.length : end;
  const sets: SavedSet[] = [];
  const re = /<ConfigSet\b([^>]*?)(\/?)>/g;
  re.lastIndex = config.index;
  for (let m = re.exec(xml); m !== null && m.index < limit; m = re.exec(xml)) {
    const tagStart = m.index;
    const tagEnd = m.index + m[0].length;
    const selfClosing = m[2] === '/';
    const closeStart = selfClosing ? -1 : xml.indexOf('</ConfigSet>', tagEnd);
    const body = selfClosing ? '' : xml.slice(tagEnd, closeStart);
    const inputs = new Map<string, ConfigValue>();
    for (const im of body.matchAll(/<Input\b([^>]*?)\/>/g)) {
      const a = attributes(im[1]);
      if (a.name === undefined) continue;
      if (a.number !== undefined) inputs.set(a.name, Number(a.number));
      else if (a.boolean !== undefined) inputs.set(a.name, a.boolean === 'true');
      else if (a.string !== undefined) inputs.set(a.name, a.string);
    }
    sets.push({ id: Number(attributes(m[1]).id), tagStart, tagEnd, closeStart, attrText: m[1], inputs });
  }
  return sets;
}

/** An `<Input>` line as PoB writes one: the value's kind is its JSON type. */
function inputLine(option: string, value: ConfigValue, indent: string): string {
  const kind = typeof value === 'number' ? 'number' : typeof value === 'boolean' ? 'boolean' : 'string';
  return `${indent}<Input name="${encode(option)}" ${kind}="${encode(String(value))}"/>\n`;
}

/** Equal as a saved value: numbers within PoB's `%.14g` round trip, the rest exactly. */
function sameValue(a: ConfigValue, b: ConfigValue): boolean {
  if (typeof a === 'number' && typeof b === 'number') {
    return a === b || Math.abs(a - b) <= 1e-12 * Math.max(Math.abs(a), Math.abs(b));
  }
  return a === b;
}

/**
 * Put every listed option the save left out of its set back into the XML (D-248), in option order at the
 * end of the set. Returns the XML and what was put back.
 */
export function restoreConfigInputs(
  xml: string,
  sets: readonly ConfigSetInputs[],
): { xml: string; restored: { set: number; option: string }[] } {
  const wanted = new Map(sets.map((s) => [s.id, s.inputs]));
  const restored: { set: number; option: string }[] = [];
  const edits: { at: number; until: number; text: string }[] = [];
  for (const saved of savedSets(xml)) {
    const inputs = wanted.get(saved.id);
    if (!inputs) continue;
    const missing = Object.keys(inputs)
      .filter((option) => !saved.inputs.has(option))
      .sort();
    if (missing.length === 0) continue;
    const lineStart = xml.lastIndexOf('\n', saved.tagStart) + 1;
    const indent = /^[\t ]*/.exec(xml.slice(lineStart, saved.tagStart))![0];
    const lines = missing.map((option) => inputLine(option, inputs[option], `${indent}\t`)).join('');
    for (const option of missing) restored.push({ set: saved.id, option });
    if (saved.closeStart < 0) {
      // <ConfigSet …/> becomes <ConfigSet …> with the inputs, then </ConfigSet>.
      edits.push({ at: saved.tagStart, until: saved.tagEnd, text: `<ConfigSet${saved.attrText}>\n${lines}${indent}</ConfigSet>` });
    } else {
      const at = xml.lastIndexOf('\n', saved.closeStart) + 1;
      edits.push({ at, until: at, text: lines });
    }
  }
  let out = xml;
  for (const e of edits.sort((a, b) => b.at - a.at)) out = out.slice(0, e.at) + e.text + out.slice(e.until);
  return { xml: out, restored };
}

/**
 * The post-export check (D-248): every listed option of every set is in the XML's `<ConfigSet>` of that id
 * with its value. Returns one line per problem.
 */
export function savedConfigProblems(xml: string, sets: readonly ConfigSetInputs[]): string[] {
  const byId = new Map(savedSets(xml).map((s) => [s.id, s]));
  const problems: string[] = [];
  for (const set of sets) {
    const saved = byId.get(set.id);
    if (!saved) {
      problems.push(`config set ${set.id} is missing from the saved build`);
      continue;
    }
    for (const [option, value] of Object.entries(set.inputs).sort(([a], [b]) => a.localeCompare(b))) {
      const got = saved.inputs.get(option);
      if (got === undefined) problems.push(`config set ${set.id}: option "${option}" is missing from the saved build`);
      else if (!sameValue(got, value)) {
        problems.push(`config set ${set.id}: option "${option}" is saved as ${JSON.stringify(got)}, not ${JSON.stringify(value)}`);
      }
    }
  }
  return problems;
}
