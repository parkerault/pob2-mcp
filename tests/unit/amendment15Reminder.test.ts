/**
 * Amendment 15 (M-28, WU-146; D-501): AC-W122's unit part. `scripts/compact-reminder.sh`, spawned as the plugin's
 * `SessionStart` hook would run it, from a temporary folder outside the repository, with an explicit env:
 *
 * - with `CLAUDE_PLUGIN_ROOT=/x` it prints `/x/skills/build-guide/SKILL.md` and
 *   `/x/skills/build-guide/references/runner-rules.md`, names `/pob2:build-guide` and `pob2-run-log`, and prints no
 *   literal `${CLAUDE_PLUGIN_ROOT}`;
 * - with it unset, it prints the repository's absolute root in its place, symbolic links resolved;
 * - the root goes in as text: each numbered source line comes out with the placeholder replaced and nothing else.
 *
 * The source lines' match with `SKILL.md`'s first 40 lines is `tests/static/amendment15Rules.test.ts`'s.
 */
import { describe, it, expect, afterAll } from '@jest/globals';
import { spawnSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';

const REPO = path.resolve(__dirname, '..', '..');
const SCRIPT = path.join(REPO, 'scripts', 'compact-reminder.sh');
const TOKEN = '${CLAUDE_PLUGIN_ROOT}';
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'pob2-reminder-'));
const OUTSIDE = path.join(TMP, 'elsewhere');
fs.mkdirSync(OUTSIDE);
afterAll(() => fs.rmSync(TMP, { recursive: true, force: true }));

/** The script's numbered source lines, the placeholder in them. */
const SOURCE_LINES = fs.readFileSync(SCRIPT, 'utf8').split('\n').filter((l) => /^\d\. /.test(l));

/** Runs the script (or `script`) as a hook would, from outside the repository, with only PATH and `extra` set. */
function remind(extra: Record<string, string>, script = SCRIPT): string {
  const r = spawnSync(script, [], {
    cwd: OUTSIDE,
    env: { PATH: process.env.PATH ?? '/usr/bin:/bin', ...extra },
    input: JSON.stringify({ hook_event_name: 'SessionStart', source: 'compact' }),
    encoding: 'utf8',
  });
  expect({ status: r.status, stderr: r.stderr }).toEqual({ status: 0, stderr: '' });
  return r.stdout;
}

describe('AC-W122 (WU-146, D-501): the reminder prints the plugin root', () => {
  it('with CLAUDE_PLUGIN_ROOT=/x: the two files under /x, /pob2:build-guide and pob2-run-log, no literal placeholder', () => {
    const out = remind({ CLAUDE_PLUGIN_ROOT: '/x' });
    expect(out).toContain('`/x/skills/build-guide/SKILL.md`');
    expect(out).toContain('`/x/skills/build-guide/references/runner-rules.md`');
    expect(out).toContain('/pob2:build-guide');
    expect(out).toContain('pob2-run-log <runFolder> display <gate>');
    expect(out).not.toContain(TOKEN);
    // Each numbered line is its source line with the placeholder replaced, and nothing else changed.
    expect(SOURCE_LINES).toHaveLength(3);
    expect(SOURCE_LINES[0]).toContain(TOKEN);
    for (const line of SOURCE_LINES) expect(out.split('\n')).toContain(line.split(TOKEN).join('/x'));
  });

  it("with CLAUDE_PLUGIN_ROOT unset: the repository's absolute root in its place", () => {
    const root = fs.realpathSync(REPO);
    const out = remind({});
    expect(out).toContain(`\`${root}/skills/build-guide/SKILL.md\``);
    expect(out).toContain(`\`${root}/skills/build-guide/references/runner-rules.md\``);
    expect(out).not.toContain(TOKEN);
    // An empty value counts as unset.
    expect(remind({ CLAUDE_PLUGIN_ROOT: '' })).toBe(out);
  });

  it('unset, started through a symbolic link to the repository, it still names the real root', () => {
    const link = path.join(TMP, 'plugin-link');
    fs.symlinkSync(REPO, link);
    const out = remind({}, path.join(link, 'scripts', 'compact-reminder.sh'));
    expect(out).toContain(`\`${fs.realpathSync(REPO)}/skills/build-guide/SKILL.md\``);
    expect(out).not.toContain(link);
  });

  it("takes the root as text: a trailing slash dropped, and &, \\ and the placeholder itself kept as they are", () => {
    const odd = '/a&b\\c/${CLAUDE_PLUGIN_ROOT}';
    const out = remind({ CLAUDE_PLUGIN_ROOT: `${odd}/` });
    for (const line of SOURCE_LINES) expect(out.split('\n')).toContain(line.split(TOKEN).join(odd));
  });
});
