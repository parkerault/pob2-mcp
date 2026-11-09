/**
 * Amendment 16's M-30, WU-159 (D-516, C-61): piece runs, the static parts.
 *
 * - AC-W147: every rule name `skills/build-guide/scripts/check-run.mjs` can emit has a piece tag. The scan reads the
 *   checker's source: each `fail('<rule>'` call, each `bad('<rule>'` in the functions whose `bad` passes its rule on
 *   (`const bad = (rule, why) => fail(rule, …)`), the rules `ruleOf` gives a gate part, and the rule a `readJson` names;
 *   it matches them against `RULE_PIECES`, read from the module itself, both ways. Each tag is one of §12's pieces, and
 *   the shared rules carry both their pieces (runes, corruption and flasks: compile and pricing; known issues: the writer
 *   and review; the advice to test in game and the campaign rewards: the writer and compile).
 * - AC-W146: the shared rules every runner reads (`skills/build-guide/references/runner-rules.md`) say a pricing stop ends
 *   a piece run: the rung asked for first when none is placed, the status stopped, the lockout's end told, and the resume
 *   the retry, with no `pricing` answer.
 * - AC-W147: the compaction reminder (`scripts/compact-reminder.sh`, D-420) names any pob2 run with a `run-log.json`
 *   in progress, and a piece's runner re-reads its own command's `SKILL.md`; build-guide's `SKILL.md` keeps the same
 *   numbered lines (`tests/static/amendment15Rules.test.ts` checks them verbatim).
 */
import { describe, it, expect } from '@jest/globals';
import { execFileSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const REPO = path.resolve(__dirname, '..', '..');
const CHECKER = path.join(REPO, 'skills', 'build-guide', 'scripts', 'check-run.mjs');
const RUNNER_RULES = path.join(REPO, 'skills', 'build-guide', 'references', 'runner-rules.md');
const REMINDER = path.join(REPO, 'scripts', 'compact-reminder.sh');
const SKILL_MD = path.join(REPO, 'skills', 'build-guide', 'SKILL.md');
/** Whitespace folded to single spaces, so a wrapped sentence reads as one line. */
const folded = (t: string) => t.replace(/\s+/g, ' ');

/** The checker's exported table and tags, read from the module itself. */
function table(): { pieces: Record<string, string[]>; tags: string[] } {
  const out = execFileSync(process.execPath, ['-e', `import(${JSON.stringify(`file://${CHECKER}`)}).then((m) => process.stdout.write(JSON.stringify({ pieces: m.RULE_PIECES, tags: m.RULE_TAGS })))`], {
    cwd: REPO,
    env: { PATH: process.env.PATH ?? '/usr/bin:/bin' },
    encoding: 'utf8',
  });
  return JSON.parse(out) as { pieces: Record<string, string[]>; tags: string[] };
}

/** Every rule name the checker's source can emit. */
function emitted(source: string): Set<string> {
  const rules = new Set<string>();
  for (const m of source.matchAll(/\bfail\('([a-z0-9-]+)'/g)) rules.add(m[1]);
  // The functions whose `bad` passes its first argument on as the rule.
  const lines = source.split('\n');
  lines.forEach((l, i) => {
    if (!/const bad = \(rule, why\) => fail\(rule,/.test(l)) return;
    for (let j = i + 1; j < lines.length && lines[j] !== '}'; j += 1) for (const m of lines[j].matchAll(/\bbad\('([a-z0-9-]+)'/g)) rules.add(m[1]);
  });
  // The rule a gate part's failure takes.
  const ruleOf = /const ruleOf = \(part\) => (.*);$/m.exec(source)?.[1] ?? '';
  for (const m of ruleOf.matchAll(/'([a-z0-9-]+)'/g)) if (!['rolledSkill'].includes(m[1])) rules.add(m[1]);
  // A readJson that names the rule its parse failure takes.
  for (const m of source.matchAll(/readJson\([^)]*, '([a-z0-9-]+)'\)/g)) rules.add(m[1]);
  return rules;
}

describe('AC-W147 (WU-159, D-516): every rule the checker can emit has a piece tag', () => {
  const source = fs.readFileSync(CHECKER, 'utf8');

  it('the scan finds the rules, and RULE_PIECES tags each of them and nothing else', () => {
    const rules = emitted(source);
    // The scan's three other forms are found: the design fields' (rule, why) form, ruleOf's parts, readJson's rule.
    for (const r of ['design-field', 'toughness', 'arbiter', 'gates', 'rolled-skill', 'floor', 'budget', 'gate-report', 'run-log']) expect({ r, found: rules.has(r) }).toEqual({ r, found: true });
    const { pieces } = table();
    const untagged = [...rules].filter((r) => !(r in pieces)).sort();
    const stale = Object.keys(pieces).filter((r) => !rules.has(r)).sort();
    expect({ untagged, stale }).toEqual({ untagged: [], stale: [] });
  });

  it("each tag is one of §12's pieces, and the shared rules carry both of theirs", () => {
    const { pieces, tags } = table();
    expect(tags).toEqual(['run', 'game-knowledge', 'discovery', 'research', 'review', 'compile', 'writer', 'pricing']);
    for (const [rule, ts] of Object.entries(pieces)) {
      expect({ rule, ok: Array.isArray(ts) && ts.length > 0 && ts.every((t) => tags.includes(t)) && new Set(ts).size === ts.length }).toEqual({ rule, ok: true });
    }
    for (const r of ['runes', 'corruption', 'flasks']) expect({ r, tags: [...pieces[r]].sort() }).toEqual({ r, tags: ['compile', 'pricing'] });
    expect([...pieces['known-issues']].sort()).toEqual(['review', 'writer']);
    for (const r of ['test-advice', 'campaign-rewards']) expect({ r, tags: [...pieces[r]].sort() }).toEqual({ r, tags: ['compile', 'writer'] });
    // §12's sorting, a rule of each: the run's, game knowledge's, discovery's, research's, review's, the pieces'.
    const want: Record<string, string> = {
      layout: 'run', 'run-log': 'run', display: 'run', order: 'run', caps: 'run', routing: 'run', 'design-gate': 'run', escalation: 'run', requests: 'run',
      'source-tags': 'game-knowledge', 'offline-tag': 'game-knowledge', markers: 'game-knowledge', 'claim-kind': 'game-knowledge',
      deck: 'discovery', probes: 'discovery', reports: 'review', recheck: 'review',
      'record-plan': 'compile', 'pob-file': 'compile', 'guide-sections': 'writer', 'audit-render': 'writer', 'nfr-22': 'pricing', spec: 'pricing', listing: 'pricing', budget: 'pricing',
    };
    for (const [rule, tag] of Object.entries(want)) expect({ rule, tags: pieces[rule] }).toEqual({ rule, tags: [tag] });
    // WU-162 (D-521): the gates' interview notes are research's, and compile's too, its better round's design gate.
    expect([...pieces.interview].sort()).toEqual(['compile', 'research']);
    expect(pieces.better).toEqual(['compile']);
  });
});

describe('AC-W146 (WU-159, D-516): the runner text, a pricing stop ends a piece run', () => {
  const rules = folded(fs.readFileSync(RUNNER_RULES, 'utf8'));

  it('asks for the rung first when none is placed, sets the status stopped, tells the user when the lockout ends, and stops; the resume is the retry', () => {
    const bullet = /- \*\*In a piece run, a pricing stop ends the run\*\* \(D-516\): (.*?)(?= - \*\*)/.exec(rules)?.[1] ?? '';
    expect(bullet).toMatch(/a `\/pob2:compile` or `\/pob2:pricing` run has no gate that asks to retry/);
    expect(bullet).toMatch(/then ask the user for the rung first when none is placed .*, set the status `stopped` \(`pob2-run-log <runFolder> set`\), tell the user when the lockout ends, and stop/);
    expect(bullet).toMatch(/The retry is `\/pob2:<piece> --resume <run folder>` after the lockout: the resume clears the stop, and the step runs again, reusing every price the plan holds/);
    expect(bullet).toMatch(/A piece run logs no `pricing` answer, and no trade request comes before the lockout ends/);
  });
});

describe('AC-W147 (WU-159, D-516, D-420): the compaction reminder names any pob2 run', () => {
  const text = fs.readFileSync(REMINDER, 'utf8');
  const rule = text.slice(text.indexOf("<<'EOF'"));

  it('is worded for any pob2 run with a run-log.json in progress, each runner re-reading its own command\'s SKILL.md', () => {
    expect(rule).toContain('If a pob2 run with a `run-log.json` is in progress (/pob2:build-guide, /pob2:compile, /pob2:pricing or /pob2:writer), this session was just compacted');
    expect(rule).toContain("in a /pob2:compile, /pob2:pricing or /pob2:writer run, that command's `${CLAUDE_PLUGIN_ROOT}/skills/<piece>/SKILL.md` in place of build-guide's.");
    expect(rule).toContain('If no pob2 run is in progress, ignore this.');
    expect(rule).not.toContain('If no /pob2:build-guide run is in progress');
    // build-guide's SKILL.md keeps the same numbered lines, in its first 40.
    const first40 = fs.readFileSync(SKILL_MD, 'utf8').split('\n').slice(0, 40);
    for (const line of rule.split('\n').filter((l) => /^\d\. /.test(l))) expect({ line, kept: first40.includes(line) }).toEqual({ line, kept: true });
  });
});
