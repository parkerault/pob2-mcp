/**
 * AC-W132 (WU-151, amendment 16 §3, D-507; C-59): the readers of the league digests.
 *
 * - Both committed digests' line 3 carries Appendix A.1's `League:` sentence with §3's instants, read from the spec:
 *   Runes of Aldur from 2026-05-29 20:00 UTC and Forbidden Rites from 2026-09-04 20:00 UTC, both until 2026-12-11 20:00
 *   UTC; Forbidden Rites' line is A.1's example line, verbatim.
 * - `skills/build-guide/SKILL.md`, `references/start.md`, `references/run-log.md`, `stages/R1a.md`, the researcher's
 *   definition, `skills/game-knowledge/references/lookups.md` and `skills/game-knowledge/SKILL.md` name running leagues
 *   and no longer choose "the newest" digest "by its fetch date"; `patterns.md`'s supply search names the running
 *   digests instead of the whole `data/league/` folder.
 * - Game knowledge keeps its poe2db fallback, takes the running digests from `leagues.mjs` and reads an ended league's
 *   digest only when the user asks.
 * - The task header documents `digests` (Appendix A.2), and the runner rules' Bash list holds the `leagues.mjs` command.
 */
import { describe, it, expect } from '@jest/globals';
import fs from 'fs';
import path from 'path';

const REPO = path.resolve(__dirname, '..', '..');
const read = (...p: string[]) => fs.readFileSync(path.join(REPO, ...p), 'utf8');
/** The text with every whitespace run collapsed to one space, so a phrase split by a hard wrap is still seen. */
const folded = (text: string) => text.replace(/\s+/g, ' ');
const SPEC = read('docs', 'build-guide', 'spec', 'amendment-16-pieces-and-launch.md');
const section = (from: string, to: string) => {
  const at = SPEC.indexOf(from);
  expect(at).toBeGreaterThan(0);
  return SPEC.slice(at, SPEC.indexOf(to, at));
};

describe("AC-W132 (WU-151, D-507): the committed digests' line 3", () => {
  // §3: "Runes of Aldur from 2026-05-29 20:00 UTC and Forbidden Rites from 2026-09-04 20:00 UTC, both until 2026-12-11 20:00 UTC".
  const three = folded(section('**The two committed digests**', '**The readers, one rule.**'));
  const instants = /Runes of Aldur from (\d{4}-\d{2}-\d{2} \d{2}:\d{2}) UTC and Forbidden Rites from (\d{4}-\d{2}-\d{2} \d{2}:\d{2}) UTC, both until (\d{4}-\d{2}-\d{2} \d{2}:\d{2}) UTC/.exec(three);

  it("carries Appendix A.1's sentence after the fetch date, with §3's instants", () => {
    expect(instants).not.toBeNull();
    const [, aldur, rites, end] = instants!;
    expect([aldur, rites, end]).toEqual(['2026-05-29 20:00', '2026-09-04 20:00', '2026-12-11 20:00']);
    const line = (file: string) => read('data', 'league', file).split('\n')[2];
    expect(line('runes-of-aldur.md')).toMatch(new RegExp(`^Runes of Aldur \\(Return of the Ancients 0\\.5\\) on poe2db\\.tw, fetched 2026-10-18\\. League: from ${aldur} UTC until ${end} UTC\\. In-pin flags: `));
    expect(line('forbidden-rites.md')).toMatch(new RegExp(`^Forbidden Rites \\(0\\.5\\.5\\) on poe2db\\.tw, fetched 2026-11-07\\. League: from ${rites} UTC until ${end} UTC\\. In-pin flags: `));
    // A.1's example line is Forbidden Rites' own, verbatim.
    const example = /The line 3 it writes[^\n]*\n\n```\n([^\n]+)\n```/.exec(section('### A.1', '### A.2'));
    expect(example).not.toBeNull();
    expect(line('forbidden-rites.md')).toBe(example![1]);
    // Nothing else in either digest moved: the sentence sits between the fetch date and the in-pin flags.
    for (const file of ['runes-of-aldur.md', 'forbidden-rites.md']) {
      expect(line(file).replace(/ League: from [^.]*\.(?= In-pin flags: )/, '')).toMatch(/^.+ on poe2db\.tw, fetched \d{4}-\d{2}-\d{2}\. In-pin flags: checked against the PoB2 pin v[\d.]+ on \d{4}-\d{2}-\d{2}\.$/);
    }
  });
});

describe('AC-W132 (WU-151, D-507): the readers name running leagues, never the newest digest by its fetch date', () => {
  /** The phrases that chose one digest by its fetch date (D-400, D-412 before D-507). */
  const NEWEST = /\bthe newest (?:league )?digest\b|\bnewest league digest\b|\bthe newest league's\b|<newest>|\bby (?:its |the )?fetch date\b|\bnewest by fetch\b|\bfetched last\b/i;
  const READERS: Array<[string, string[]]> = [
    ['skills/build-guide/SKILL.md', ['skills', 'build-guide', 'SKILL.md']],
    ['skills/build-guide/references/start.md', ['skills', 'build-guide', 'references', 'start.md']],
    ['skills/build-guide/references/run-log.md', ['skills', 'build-guide', 'references', 'run-log.md']],
    ['skills/build-guide/references/stages/R1a.md', ['skills', 'build-guide', 'references', 'stages', 'R1a.md']],
    ['agents/build-guide-researcher.md', ['agents', 'build-guide-researcher.md']],
    ['skills/game-knowledge/references/lookups.md', ['skills', 'game-knowledge', 'references', 'lookups.md']],
    ['skills/game-knowledge/SKILL.md', ['skills', 'game-knowledge', 'SKILL.md']],
  ];

  it('each names running leagues, and none keeps a phrase that chose the newest digest by its fetch date', () => {
    for (const [file, parts] of READERS) {
      const text = folded(read(...parts));
      expect({ file, running: /\brunning leagues?\b/i.test(text), newest: text.match(NEWEST)?.[0] ?? null }).toEqual({ file, running: true, newest: null });
    }
  });

  it('the check finds the old phrases', () => {
    for (const old of ['the newest league digest, `data/league/<slug>.md` by its fetch date', "the newest league's", '`head -3 data/league/<newest>.md`', 'the newest by fetch date', 'the one fetched last']) {
      expect({ old, found: NEWEST.test(old) }).toEqual({ old, found: true });
    }
    expect(NEWEST.test("the running leagues' digests, newest first")).toBe(false);
  });

  it("R1a and the researcher read the header's digests, each head whole, newest first, the bodies by Grep", () => {
    const r1a = folded(read('skills', 'build-guide', 'references', 'stages', 'R1a.md'));
    expect(r1a).toContain("**The league digests**, your header's `digests` (D-507): the running leagues' digests, newest first. Read each one's head whole (up to its `## Body` line), newest first, then its body by Grep; never a digest the header doesn't name (an ended league's or one not yet started).");
    const researcher = folded(read('agents', 'build-guide-researcher.md'));
    expect(researcher).toContain("Of the league digests, read only those your header's `digests` names, the running leagues', each head whole, newest first, the bodies by Grep (D-507).");
    const lookups = folded(read('skills', 'game-knowledge', 'references', 'lookups.md'));
    expect(lookups).toContain("the league digests from poe2db: only the running leagues' (D-507: a task header's `digests`, or `skills/game-knowledge/scripts/leagues.mjs`'s list), each head whole, newest first, the bodies by Grep.");
    // The supply search Greps the running digests' bodies, not the whole data/league/ folder.
    const supply = folded(read('skills', 'game-knowledge', 'references', 'patterns.md'));
    const search = supply.slice(supply.indexOf('### Supply by family'), supply.indexOf('### ', supply.indexOf('### Supply by family') + 4));
    expect(search).toContain("the family's word in the running league digests' bodies (a task header's `digests`, or `skills/game-knowledge/scripts/leagues.mjs`'s list, D-507)");
    expect(search).not.toContain('(`data/league/`)');
  });

  it('the runner prints line 3 of each running digest, as pob2-run-log printed them, or the none line', () => {
    const skill = folded(read('skills', 'build-guide', 'SKILL.md'));
    const start = skill.slice(skill.indexOf('## 1. Start'), skill.indexOf('## 2. Brainstorm'));
    expect(start).toContain("its last step prints the staleness line: line 3 of each running league's digest, which `init` or `resume` printed");
    const ref = folded(read('skills', 'build-guide', 'references', 'start.md'));
    // §3's none line, verbatim, and a resume's step from resume's output.
    const none = /With none: "([^"]+)"/.exec(folded(section('**The runner\'s staleness line**', '**The task header**')))![1];
    expect(none).toBe("No running league has a league digest: what is new in it isn't in the committed data.");
    expect(ref).toContain(`or \`${none}\``);
    expect(ref).toContain("`pob2-run-log` applies that rule, never you. Keep its `digests:` line, the running digests' paths: every R1a and researcher Q header copies it as `digests`");
    expect(ref).toContain("5. **The league digests' staleness line**, as step 5 above, from the lines `resume` printed.");
    // The undated digest's line, §3's words.
    const undated = /its reader names it once \("([^"]+)"\)/.exec(folded(section('**The readers, one rule.**', '- **The run log**')))![1];
    expect(undated).toBe('<file> records no league dates: re-run its digest script');
    expect(ref).toContain(`\`${undated}\``);
  });

  it("game knowledge takes the running digests from leagues.mjs, reads an ended league's only when asked, and keeps its poe2db fallback", () => {
    const gk = read('skills', 'game-knowledge', 'SKILL.md');
    const at = gk.indexOf('- **What is new in the league:**');
    const line = folded(gk.slice(at, gk.indexOf('\n- **', at + 1)));
    expect(line).toContain("the running leagues' digests (D-507), which `node ${CLAUDE_PLUGIN_ROOT}/skills/game-knowledge/scripts/leagues.mjs` lists, newest first, with each one's line 3: each head whole, newest first, the body by `grep` through Bash.");
    expect(line).toContain("An ended league's digest (`${CLAUDE_PLUGIN_ROOT}/data/league/<slug>.md`) only when the user asks about that league");
    expect(line).toContain('a league not yet started from poe2db.tw as announced content, never a digest');
    expect(line).toContain("Past a digest's fetch date, or with no digest for the league asked about, poe2db.tw (above); say how old the digest is.");
    expect(line).toContain("`[not in pin]` marks an entry the PoB pin doesn't know");
  });

  it("the task header documents digests (Appendix A.2), and the runner rules' Bash list holds the leagues.mjs command (§3)", () => {
    const a2 = section('### A.2', '### A.3');
    expect(a2).toContain('| `digests` | new: the running digests\' paths, newest first (root-relative, or absolute for a user-side digest) |');
    const header = read('skills', 'build-guide', 'references', 'task-header.md');
    const row = header.split('\n').find((l) => l.startsWith('| `digests` |'));
    expect(row).toBeDefined();
    expect(folded(row!)).toMatch(/the running league digests' paths, newest first .* root-relative \(`data\/league\/<name>\.md`; a user-side digest's absolute\), copied verbatim from the `digests:` line `pob2-run-log`'s `init` or `resume` printed, `\[\]` when no running league has one/);
    // §3's command line, in the Bash list.
    const command = /As a command \(`([^`]+)`, in\s+`runner-rules\.md`'s Bash list\)/.exec(SPEC)![1];
    expect(command).toBe('node <root>/skills/game-knowledge/scripts/leagues.mjs [--at <instant>]');
    const rules = read('skills', 'build-guide', 'references', 'runner-rules.md');
    const bash = folded(rules.slice(rules.indexOf('## Your Bash')));
    expect(bash).toContain(`- the running league digests, \`${command}\` (D-507)`);
  });
});
