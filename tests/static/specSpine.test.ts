/**
 * The project spine (`docs/spec/README.md`) is the one current record of what crosses slices (2026-11-04). It merged
 * the server spine and the build-guide spine and folded amendments 8–14. These checks fail when it falls behind:
 *
 * - every approved amendment's decisions (the D-n its section headings name) have a row in the spine's decision log;
 * - the spine's status names the newest approved amendment ("Folded through amendment <n>");
 * - every row of the two old spines (decisions, contracts, assumptions, gates, risks, work units) is in the merged one;
 * - the old spines say at the top that they are superseded, and point here.
 */
import { describe, it, expect } from '@jest/globals';
import fs from 'fs';
import path from 'path';

const REPO = path.resolve(__dirname, '..', '..');
const SPINE = path.join(REPO, 'docs', 'spec', 'README.md');
const AMENDMENTS = path.join(REPO, 'docs', 'build-guide', 'spec');
const OLD_SPINES = ['docs/stabilization/spec/README.md', 'docs/build-guide/spec/README.md'];

const read = (p: string): string => fs.readFileSync(p, 'utf8');
const rowIds = (text: string, prefix: string): Set<string> =>
  new Set([...text.matchAll(new RegExp(`^\\| (${prefix}-\\d+) `, 'gm'))].map((m) => m[1]));

interface Amendment {
  n: number;
  file: string;
  approved: boolean;
  decisions: string[];
}

function amendments(): Amendment[] {
  return fs
    .readdirSync(AMENDMENTS)
    .filter((f) => /^amendment-\d+-.*\.md$/.test(f))
    .map((file) => {
      const text = read(path.join(AMENDMENTS, file));
      const status = /\*\*Status:?\*{0,2}:?\s*([^\n]*)/.exec(text)?.[1] ?? '';
      const ids = new Set<string>();
      for (const heading of text.match(/^#{2,3} .*$/gm) ?? []) {
        for (const m of heading.matchAll(/D-(\d+)(?:\s*(?:to|…|–)\s*D-(\d+))?/g)) {
          const from = Number(m[1]);
          const to = m[2] ? Number(m[2]) : from;
          for (let i = from; i <= to; i++) ids.add(`D-${i}`);
        }
      }
      return {
        n: Number(/^amendment-(\d+)-/.exec(file)![1]),
        file,
        approved: /APPROVED|ACCEPTED|FOLDED/.test(status) && !/^DRAFT/.test(status),
        decisions: [...ids],
      };
    })
    .sort((a, b) => a.n - b.n);
}

describe('the project spine stays current', () => {
  const spine = read(SPINE);
  const decisions = rowIds(spine, 'D');

  it('has a decision-log row for every decision an approved amendment names in its headings', () => {
    const missing = amendments()
      .filter((a) => a.approved)
      .flatMap((a) => a.decisions.filter((d) => !decisions.has(d)).map((d) => `${a.file}: ${d}`));
    expect(missing).toEqual([]);
  });

  it('names the newest approved amendment as folded', () => {
    const newest = Math.max(...amendments().filter((a) => a.approved).map((a) => a.n));
    const folded = /Folded through amendment (\d+)/.exec(spine)?.[1];
    expect(Number(folded)).toBe(newest);
  });

  it('holds every row of the two old spines', () => {
    const missing: string[] = [];
    for (const old of OLD_SPINES) {
      const text = read(path.join(REPO, old));
      for (const prefix of ['D', 'C', 'A', 'HG', 'R', 'WU']) {
        const merged = rowIds(spine, prefix);
        for (const id of rowIds(text, prefix)) if (!merged.has(id)) missing.push(`${old}: ${id}`);
      }
    }
    expect(missing).toEqual([]);
  });

  it('the old spines say they are superseded and point here', () => {
    const unmarked = OLD_SPINES.filter((old) => {
      const head = read(path.join(REPO, old)).split('\n').slice(0, 12).join('\n');
      return !/SUPERSEDED/.test(head) || !head.includes('docs/spec/README.md');
    });
    expect(unmarked).toEqual([]);
  });
});
