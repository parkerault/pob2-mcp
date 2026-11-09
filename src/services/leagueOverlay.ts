/**
 * The overlay (amendment 16 §19, D-523; C-66): the new league's socketables and uniques the server adds to PoB's data
 * before our pin knows them, from the sidecars `league-digest.mjs` writes beside each digest (`<slug>.overlay.json`,
 * Appendix A.11).
 *
 * - **The league folder**, `<stateDir>/league/` (C-16), where `pob2-league-digest` makes a running league's digest and
 *   sidecar on the user's side; `guide_run {new_run}` names it (C-50), so the runner never resolves it in Bash.
 * - **The sidecar list**, read in Node because headless PoB can't list a folder (`NewFileSearch` is a stub,
 *   `HeadlessWrapper.lua`:83): every `*.overlay.json` in the committed `data/league/` and the league folder, a committed
 *   one replacing a user-side one of the same file name ("a committed digest wins", C-59). The engine child gets their
 *   absolute paths in `POB2_OVERLAY_SIDECARS` (a JSON list), which bootstrap step 5e reads (`pob-api/API/Overlay.lua`).
 *   The session compares the list (paths and modification times) before a load or a compile with the one the running
 *   engine started with, and restarts the engine on a change, so step 5e reads the new entries.
 * - **The marks**: the names a plan stage's items take from the overlay the running engine loaded (a socketed `Rune:` or a unique's name), less
 *   those the pin now defines (retired: the engine skips them), go in the record's `stages.<id>.overlay` (Appendix A.8).
 */
import fs from 'fs';
import path from 'path';
import { packageRoot } from '../utils/packageRoot.js';

/**
 * D-523 (amendment 16 §19): the overlay's limits, stated wherever an overlay item is shown (the lookups once per reply;
 * `render-audit.mjs`'s `OVERLAY_LIMITS` for the audit and the displays, in the same words).
 */
export const OVERLAY_LIMITS =
  "The overlay's limits: a line PoB doesn't parse stays unmeasured (check_model_coverage reports it); an item on a base the pin lacks can't load; " +
  "the rule-changer index's marks wait for our pin; trade weights stay the pin's; and a new release's tree and skills come only with a PoB release and our pin upgrade.";

/** The reply line of `guide_run {new_run}` naming the league folder (C-50). */
export const LEAGUE_FOLDER_LINE = 'leagueFolder';
/** The engine child's variable: the sidecars' absolute paths, a JSON list (bootstrap step 5e). */
export const OVERLAY_ENV = 'POB2_OVERLAY_SIDECARS';
export const SIDECAR_SUFFIX = '.overlay.json';

/** The server's league folder, `<stateDir>/league` (C-16). */
export function leagueFolderOf(stateDir: string): string {
  return path.join(path.resolve(stateDir), 'league');
}

/** The committed digests' folder, `data/league/` at the package root. */
export function committedLeagueFolder(root: string = packageRoot()): string {
  return path.join(root, 'data', 'league');
}

/** The folders the overlay reads, in order: the committed one first, then the league folder. */
export function overlayFolders(stateDir: string, root: string = packageRoot()): string[] {
  return [committedLeagueFolder(root), leagueFolderOf(stateDir)];
}

export interface Sidecar {
  file: string;
  path: string;
  mtimeMs: number;
}

/** Every sidecar in the folders, in folder order; a file name an earlier folder holds is left out (a committed one wins). */
export function listSidecars(folders: readonly string[]): Sidecar[] {
  const out: Sidecar[] = [];
  const seen = new Set<string>();
  for (const folder of folders) {
    let names: string[];
    try {
      names = fs.readdirSync(folder).filter((f) => f.endsWith(SIDECAR_SUFFIX)).sort();
    } catch {
      continue;
    }
    for (const file of names) {
      if (seen.has(file)) continue;
      const p = path.join(folder, file);
      let mtimeMs: number;
      try {
        mtimeMs = fs.statSync(p).mtimeMs;
      } catch {
        continue;
      }
      seen.add(file);
      out.push({ file, path: path.resolve(p), mtimeMs });
    }
  }
  return out;
}

/** A list's identity: its paths and modification times. */
export function sidecarKey(list: readonly Sidecar[]): string {
  return list.map((s) => `${s.path}\u0000${s.mtimeMs}`).join('\n');
}

/** The child variable's value for a list. */
export function overlayEnvValue(list: readonly Sidecar[]): string {
  return JSON.stringify(list.map((s) => s.path));
}

type Json = Record<string, unknown>;
const isText = (v: unknown): v is string => typeof v === 'string' && v !== '';
const isNumber = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

/**
 * A socketable `pob-api/API/Overlay.lua` adds: a name and a type that are text, a rank that is a number, and slots, each
 * with keys and lines, each line text with a number for its statOrder (Overlay.lua's `socketableData` refuses any other).
 */
export function socketableLoads(e: unknown): boolean {
  if (typeof e !== 'object' || e === null) return false;
  const x = e as Json;
  const rank = Array.isArray(x.rank) ? x.rank[0] : x.rank;
  if (!isText(x.name) || !isText(x.type) || !isNumber(rank) || !Array.isArray(x.slots) || x.slots.length === 0) return false;
  return (x.slots as unknown[]).every((sl) => {
    if (typeof sl !== 'object' || sl === null) return false;
    const s = sl as Json;
    const keys = s.keys;
    const lines = s.lines;
    const orders = s.statOrder;
    return (
      Array.isArray(keys) && keys.length > 0 && keys.every(isText) &&
      Array.isArray(lines) && lines.length > 0 && Array.isArray(orders) && orders.length === lines.length &&
      lines.every((l) => typeof l === 'string') && orders.every(isNumber)
    );
  });
}

/** A unique Overlay.lua adds: a name, and a base the pin has (its `data.itemBases`). */
export function uniqueLoads(e: unknown, bases: ReadonlySet<string>): boolean {
  if (typeof e !== 'object' || e === null) return false;
  const x = e as Json;
  return isText(x.name) && isText(x.base) && bases.has(x.base);
}

/** The names a sidecar holds that the engine loads (as Overlay.lua checks them); none when it can't be read. */
function namesIn(file: string, bases: ReadonlySet<string>): string[] {
  try {
    const json = JSON.parse(fs.readFileSync(file, 'utf8')) as { socketables?: unknown[]; uniques?: unknown[] };
    const socketables = (Array.isArray(json.socketables) ? json.socketables : []).filter(socketableLoads);
    const uniques = (Array.isArray(json.uniques) ? json.uniques : []).filter((u) => uniqueLoads(u, bases));
    return [...socketables, ...uniques].map((x) => (x as Json).name as string);
  } catch {
    return [];
  }
}

const pinNamesMemo = new Map<string, Set<string>>();
const pinBasesMemo = new Map<string, Set<string>>();

/** The base names the pin defines, `Data/Bases/*.lua`'s `itemBases["<name>"]`. Memoized by the PoB source folder. */
export function pinBaseNames(pobSrc: string): Set<string> {
  const memo = pinBasesMemo.get(pobSrc);
  if (memo) return memo;
  const bases = new Set<string>();
  let files: string[] = [];
  try {
    files = fs.readdirSync(path.join(pobSrc, 'Data', 'Bases')).filter((f) => f.endsWith('.lua'));
  } catch {
    files = [];
  }
  for (const f of files) {
    let text = '';
    try {
      text = fs.readFileSync(path.join(pobSrc, 'Data', 'Bases', f), 'utf8');
    } catch {
      text = '';
    }
    for (const m of text.matchAll(/^itemBases\["((?:[^"\\]|\\.)*)"\]/gm)) bases.add(m[1].replace(/\\(.)/g, '$1'));
  }
  pinBasesMemo.set(pobSrc, bases);
  return bases;
}

/**
 * The socketable and unique names the pin defines: `Data/ModRunes.lua`'s entries and the unique texts' first lines in
 * `Data/Uniques/` (as `league-digest.mjs`'s pin check reads them). Memoized by the PoB source folder.
 */
export function pinItemNames(pobSrc: string): Set<string> {
  const memo = pinNamesMemo.get(pobSrc);
  if (memo) return memo;
  const names = new Set<string>();
  const read = (...p: string[]) => {
    try {
      return fs.readFileSync(path.join(pobSrc, ...p), 'utf8');
    } catch {
      return '';
    }
  };
  for (const m of read('Data', 'ModRunes.lua').matchAll(/^\t\["((?:[^"\\]|\\.)*)"\] = \{/gm)) names.add(m[1].replace(/\\(.)/g, '$1'));
  for (const dir of [path.join('Data', 'Uniques'), path.join('Data', 'Uniques', 'Special')]) {
    let files: string[] = [];
    try {
      files = fs.readdirSync(path.join(pobSrc, dir)).filter((f) => f.endsWith('.lua'));
    } catch {
      files = [];
    }
    for (const f of files) for (const m of read(dir, f).matchAll(/\[\[[ \t]*\r?\n[ \t]*([^\r\n]+?)[ \t]*\r?\n/g)) names.add(m[1]);
  }
  pinNamesMemo.set(pobSrc, names);
  return names;
}

/** The pinned checkout's `src/` the server runs by default (C-6). */
export function pinnedPobSrc(root: string = packageRoot()): string {
  return path.join(root, 'vendor', 'PathOfBuilding-PoE2', 'src');
}

/**
 * The overlay's names now: every sidecar's entries the engine loads (Overlay.lua refuses a malformed socketable and a
 * unique on a base the pin lacks), less those the pin defines (retired).
 */
export function overlayItemNames(list: readonly Sidecar[], pobSrc: string = pinnedPobSrc()): Set<string> {
  const pin = pinItemNames(pobSrc);
  const bases = pinBaseNames(pobSrc);
  const out = new Set<string>();
  for (const s of list) for (const n of namesIn(s.path, bases)) if (!pin.has(n)) out.add(n);
  return out;
}

/** The names an item text takes from the overlay: its `Rune:` lines and, for a unique, its name. */
export function overlayNamesInItem(text: string, names: ReadonlySet<string>): string[] {
  const lines = text.split(/\r?\n/).map((l) => l.trim());
  const out: string[] = [];
  const rarity = lines.findIndex((l) => /^Rarity:/i.test(l));
  if (rarity >= 0 && /^Rarity:\s*unique$/i.test(lines[rarity]) && names.has(lines[rarity + 1] ?? '')) out.push(lines[rarity + 1]);
  for (const l of lines) {
    const m = /^Rune:\s*(.+)$/.exec(l);
    if (m && names.has(m[1].trim())) out.push(m[1].trim());
  }
  return out;
}

/** D-523 (Appendix A.8): the overlay names a stage's items and tree jewels hold, in order, each once. */
export function stageOverlayNames(
  stage: { items?: { slots?: { text?: string }[]; treeJewels?: { text?: string }[] } },
  names: ReadonlySet<string>,
): string[] {
  if (names.size === 0) return [];
  const texts = [...(stage.items?.slots ?? []), ...(stage.items?.treeJewels ?? [])].map((x) => x.text).filter((t): t is string => typeof t === 'string');
  return [...new Set(texts.flatMap((t) => overlayNamesInItem(t, names)))];
}
