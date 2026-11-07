import fs from 'fs';
import path from 'path';

/**
 * D-412: the newest league digest in `<root>/data/league/`, by the fetch date on its third line ("… on poe2db.tw,
 * fetched <YYYY-MM-DD>. …"), then by name. Read here on its own, not through run-log.mjs, so a test of what `init`
 * and `resume` record doesn't hard-code which digests are committed.
 */
export function newestDigest(root: string): string {
  const dir = path.join(root, 'data', 'league');
  const dated = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.md'))
    .map((f) => {
      const third = fs.readFileSync(path.join(dir, f), 'utf8').split(/\r?\n/)[2] ?? '';
      const date = /\bfetched (\d{4}-\d{2}-\d{2})\b/.exec(third)?.[1];
      if (!date) throw new Error(`${path.join(dir, f)}: no fetch date on its third line`);
      return { f, date };
    })
    .sort((a, b) => (a.date === b.date ? a.f.localeCompare(b.f) : a.date.localeCompare(b.date)));
  if (dated.length === 0) throw new Error(`${dir}: no league digest`);
  return dated[dated.length - 1].f;
}
