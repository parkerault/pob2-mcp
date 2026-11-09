import fs from 'fs';
import path from 'path';

/**
 * The test clock's instant for the tests that spawn `pob2-run-log` against the committed digests: each spawn sets
 * `BUILD_GUIDE_TEST_NOW` to it and the expected list reads the rule at it, so neither side reads the machine's clock.
 */
export const TEST_NOW = '2026-11-08T12:00Z';
export const TEST_NOW_MS = Date.parse(TEST_NOW);

/** A league digest as the rule reads it: its file name and path, its third line and its league's instants (ms). */
export type Digest = { name: string; path: string; line: string; start: number; end: number | null };

const SENTENCE = /League: from (\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}) UTC until (?:(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}) UTC|no end announced)\./;

/** Every `*.md` digest in the folders, in folder order, a name an earlier folder holds left out; `start` NaN for none. */
function digestsIn(folders: string[]): Digest[] {
  const seen = new Set<string>();
  const out: Digest[] = [];
  for (const folder of folders) {
    if (!fs.existsSync(folder)) continue;
    for (const name of fs.readdirSync(folder).filter((f) => f.endsWith('.md')).sort()) {
      if (seen.has(name)) continue;
      seen.add(name);
      const line = fs.readFileSync(path.join(folder, name), 'utf8').split(/\r?\n/)[2] ?? '';
      const m = SENTENCE.exec(line);
      out.push({ name, path: path.join(folder, name), line, start: m ? Date.parse(`${m[1]}T${m[2]}:00Z`) : NaN, end: m && m[3] ? Date.parse(`${m[3]}T${m[4]}:00Z`) : null });
    }
  }
  return out;
}

/**
 * D-507 (amendment 16 §3), the tests' own reading of the rule, apart from `skills/game-knowledge/scripts/leagues.mjs`: the
 * digests in the folders (the first folder's winning a name) whose league is running at `now` (at or after its start,
 * before its end if one is recorded), the latest start first, then by name. A digest with no `League:` sentence isn't
 * running.
 */
export function runningDigests(folders: string[], now: Date | number): Digest[] {
  const at = typeof now === 'number' ? now : now.getTime();
  return digestsIn(folders)
    .filter((d) => Number.isFinite(d.start) && at >= d.start && (d.end === null || at < d.end))
    .sort((a, b) => (a.start === b.start ? (a.name < b.name ? -1 : 1) : b.start - a.start));
}

/** The committed digests' file names running at `now`, as the run log records them from skill revision 15. */
export const runningNames = (root: string, now: Date | number = Date.now()) => runningDigests([path.join(root, 'data', 'league')], now).map((d) => d.name);

/**
 * What `pob2-run-log`'s `init` and `resume` print after their first line, and `leagues.mjs` prints: the `digests:` line
 * (the running digests' root-relative paths as JSON), each one's third line or the none line, each undated digest named.
 */
export function digestReport(root: string, now: Date | number = Date.now()): string {
  const folder = path.join(root, 'data', 'league');
  const running = runningDigests([folder], now);
  const rel = (p: string) => path.relative(root, p).split(path.sep).join('/');
  const undated = digestsIn([folder]).filter((d) => !Number.isFinite(d.start));
  return [
    `digests: ${JSON.stringify(running.map((d) => rel(d.path)))}`,
    ...(running.length > 0 ? running.map((d) => d.line) : ["No running league has a league digest: what is new in it isn't in the committed data."]),
    ...undated.map((d) => `${rel(d.path)} records no league dates: re-run its digest script`),
  ].map((l) => `${l}\n`).join('');
}
