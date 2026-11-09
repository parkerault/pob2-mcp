/**
 * WU-98 (D-420, D-421; AC-W77's last bullet): the compaction hook's script and the run session's example settings.
 *
 * - `scripts/compact-reminder.sh` is an executable POSIX shell script that prints the compaction rule (worded for a
 *   run in progress) and exits 0, as a `SessionStart` hook with the `compact` matcher runs it.
 * - `docs/build-guide/run-settings.example.json` is valid JSON with no machine path; it allows exactly poe2db, the
 *   four run commands in the plugin's `bin/` and the pob2 engine and file tools the coordinator uses (none in group
 *   `trade` or `ninja`), denies WebSearch, the guide, video and build-share hosts, any `.env` and edits under `/mnt`,
 *   and holds no hook: amendment 15 (D-499) moves the `compact` hook into the plugin's `hooks/hooks.json`, which runs
 *   the script by `${CLAUDE_PLUGIN_ROOT}`.
 */
import { describe, it, expect } from '@jest/globals';
import { execFileSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';

import { TOOL_META } from '../../src/server/toolMeta';

const REPO = path.resolve(__dirname, '..', '..');
const SCRIPT = path.join(REPO, 'scripts', 'compact-reminder.sh');
const EXAMPLE = path.join(REPO, 'docs', 'build-guide', 'run-settings.example.json');
const COORDINATOR = path.join(REPO, 'agents', 'build-guide-coordinator.md');
const PLUGIN_HOOKS = path.join(REPO, 'hooks', 'hooks.json');

/**
 * The rule's key sentences (WU-95 copies the rule into SKILL.md's first 40 lines), as the script prints them for the
 * plugin root `root`: amendment 15 (WU-146, D-501) has it print the root itself, name `/pob2:build-guide` and re-read
 * the shared rules.
 */
const ruleSentences = (root: string) => [
  // Amendment 16's M-30 (WU-159, D-516): any pob2 run with a run-log.json in progress, whose runner re-reads its
  // command's SKILL.md.
  'If a pob2 run with a `run-log.json` is in progress (/pob2:build-guide, /pob2:compile, /pob2:pricing or /pob2:writer), this session was just compacted',
  `Re-read \`${root}/skills/build-guide/SKILL.md\` and \`${root}/skills/build-guide/references/runner-rules.md\` whole`,
  "the run's `run-log.json`",
  "the current step's reference",
  "the visit's notes (`interviews/<gate>-<visit>.md`, with its `## Pending decision`)",
  `in a /pob2:compile, /pob2:pricing or /pob2:writer run, that command's \`${root}/skills/<piece>/SKILL.md\` in place of build-guide's`,
  // WU-95's fix round: the design and final gates' displays take the build (D-411).
  'print its display again with `pob2-run-log <runFolder> display <gate> [--build <id>]` (the design and final gates take `--build <id>`, the build at the gate)',
  'which records no second visit',
  "Act on no yes the notes don't hold",
  'restate the pending decision and wait for it',
  'If no pob2 run is in progress, ignore this.',
];

interface HookCommand {
  type: string;
  command: string;
}
interface Hooks {
  SessionStart: Array<{ matcher: string; hooks: HookCommand[] }>;
}
interface Settings {
  permissions: { allow: string[]; deny: string[] };
  hooks?: Hooks;
}

const settingsText = (): string => fs.readFileSync(EXAMPLE, 'utf8');
const settings = (): Settings => JSON.parse(settingsText()) as Settings;

/** The coordinator definition's `tools:` list. */
function coordinatorTools(): string[] {
  const line = fs
    .readFileSync(COORDINATOR, 'utf8')
    .split('\n')
    .find((l) => l.startsWith('tools: '));
  if (!line) throw new Error('the coordinator definition has no tools: line');
  return line
    .slice('tools: '.length)
    .split(',')
    .map((t) => t.trim())
    .filter((t) => t !== '');
}

const POB2 = 'mcp__pob2__';
const isTradeOrNinja = (tool: string): boolean => {
  const group = TOOL_META[tool.slice(POB2.length)]?.group;
  return group === 'trade' || group === 'ninja';
};

describe('WU-98 (D-420): scripts/compact-reminder.sh', () => {
  it('is an executable POSIX shell script', () => {
    const mode = fs.statSync(SCRIPT).mode;
    expect(mode & 0o111).toBe(0o111);
    expect(fs.readFileSync(SCRIPT, 'utf8').split('\n')[0]).toBe('#!/bin/sh');
  });

  it('prints the compaction rule and exits 0, with the hook input on stdin, from any directory', () => {
    const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'compact-reminder-'));
    try {
      // execFileSync throws on a non-zero exit, so returning at all means exit 0.
      const out = execFileSync(SCRIPT, [], {
        cwd,
        env: { PATH: process.env.PATH ?? '/usr/bin:/bin' },
        input: JSON.stringify({ hook_event_name: 'SessionStart', source: 'compact' }),
        encoding: 'utf8',
      });
      // No CLAUDE_PLUGIN_ROOT: the script names the folder above its own, symbolic links resolved.
      for (const sentence of ruleSentences(fs.realpathSync(REPO))) expect(out).toContain(sentence);
      // Short: the rule fits in a handful of lines.
      expect(out.trim().split('\n').length).toBeLessThanOrEqual(8);
    } finally {
      fs.rmSync(cwd, { recursive: true, force: true });
    }
  });
});

describe('WU-98 (D-420, D-421): docs/build-guide/run-settings.example.json', () => {
  it('is valid JSON holding no machine path or home folder (the repository is public)', () => {
    const text = settingsText();
    expect(() => JSON.parse(text)).not.toThrow();
    expect(text).not.toContain('/home/');
    expect(text).not.toContain('/Users/');
    expect(text).not.toContain('/mnt/c');
    expect(text).not.toContain(os.homedir());
  });

  it("allows exactly poe2db, the four run commands, and the coordinator's pob2 tools outside the trade and ninja groups", () => {
    const allow = settings().permissions.allow;
    const pob2 = new Set([
      `${POB2}compile_plan`,
      `${POB2}guide_run`,
      // D-517 (WU-160): the runner calls the file reader, as it calls guide_run.
      `${POB2}plan_from_build`,
      // D-519 (WU-162): compile's runner matches a build the user names against the builds folder's list (§12).
      `${POB2}list_builds`,
      `${POB2}get_node_power`,
      `${POB2}manage_sets`,
      ...coordinatorTools().filter((t) => t.startsWith(POB2) && !isTradeOrNinja(t)),
    ]);
    const expected = new Set([
      'WebFetch(domain:poe2db.tw)',
      'WebFetch(domain:www.poe2db.tw)',
      'Bash(pob2-check-run:*)',
      'Bash(pob2-run-log:*)',
      'Bash(pob2-render-audit:*)',
      'Bash(pob2-render-notes:*)',
      // Amendment 16 (WU-166, D-523): the fifth command, the runner's at a run's start.
      'Bash(pob2-league-digest:*)',
      ...pob2,
    ]);
    expect(new Set(allow)).toEqual(expected);
    expect(allow).toHaveLength(expected.size); // no duplicates
    // The engine and file tools D-421 names are among them.
    for (const tool of ['compile_plan', 'guide_run', 'get_node_power', 'manage_sets', 'lua_get_stats', 'get_passive_upgrades']) {
      expect(allow).toContain(`${POB2}${tool}`);
    }
  });

  it('allows no pob2 tool in group trade or ninja (they stay with review)', () => {
    const allowed = settings().permissions.allow.filter((t) => t.startsWith(POB2));
    for (const tool of allowed) {
      // Every allowed pob2 tool is a tool of the server (get_node_power among them since WU-92, C-55), in group core.
      const meta = TOOL_META[tool.slice(POB2.length)];
      expect({ tool, registered: meta !== undefined }).toEqual({ tool, registered: true });
      expect({ tool, group: meta?.group }).toEqual({ tool, group: 'core' });
    }
    // The coordinator's trade and poe.ninja tools are all left out.
    const tradeOrNinja = coordinatorTools().filter((t) => t.startsWith(POB2) && isTradeOrNinja(t));
    const named = ['get_item_price', 'search_trade_items', 'search_stats', 'get_leagues', 'trade_query_options', 'find_upgrades', 'get_currency_rates'];
    expect(tradeOrNinja).toEqual(expect.arrayContaining(named.map((t) => `${POB2}${t}`)));
    for (const tool of tradeOrNinja) expect(allowed).not.toContain(tool);
  });

  it('denies WebSearch, the listed hosts (with their www. and old. forms), any .env and edits under /mnt', () => {
    const deny = settings().permissions.deny;
    expect(deny).toContain('WebSearch');
    const hosts = ['mobalytics.gg', 'maxroll.gg', 'game8.co', 'poe-vault.com', 'pobb.in', 'poe.ninja', 'youtube.com', 'youtu.be', 'twitch.tv', 'reddit.com'];
    for (const host of hosts) expect(deny).toContain(`WebFetch(domain:${host})`);
    for (const host of ['www.youtube.com', 'www.reddit.com', 'old.reddit.com', 'www.poe-vault.com', 'www.twitch.tv']) {
      expect(deny).toContain(`WebFetch(domain:${host})`);
    }
    // `//` makes a permission path absolute (a single leading `/` is relative to the settings file).
    expect(deny).toContain('Read(//**/.env)');
    expect(deny).toContain('Edit(//mnt/**)');
    // Nothing denied is also allowed.
    const allow = new Set(settings().permissions.allow);
    for (const rule of deny) expect(allow.has(rule)).toBe(false);
  });

  it("holds no hook; the plugin's one SessionStart hook, matcher compact, runs the script by ${CLAUDE_PLUGIN_ROOT} and prints the rule", () => {
    // Amendment 15 (D-499): the plugin carries the hook, so a settings copy that kept it would run the reminder twice.
    expect(settings().hooks).toBeUndefined();
    const entries = (JSON.parse(fs.readFileSync(PLUGIN_HOOKS, 'utf8')) as { hooks: Hooks }).hooks.SessionStart;
    expect(entries).toHaveLength(1);
    expect(entries[0].matcher).toBe('compact');
    expect(entries[0].hooks).toHaveLength(1);
    const hook = entries[0].hooks[0];
    expect(hook.type).toBe('command');
    expect(hook.command).toBe('"${CLAUDE_PLUGIN_ROOT}/scripts/compact-reminder.sh"');

    // Run the command as the hook would, with CLAUDE_PLUGIN_ROOT set to this checkout, from another directory.
    const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'compact-hook-'));
    try {
      const out = execFileSync('/bin/sh', ['-c', hook.command], {
        cwd,
        env: { PATH: process.env.PATH ?? '/usr/bin:/bin', CLAUDE_PLUGIN_ROOT: REPO },
        encoding: 'utf8',
      });
      for (const sentence of ruleSentences(REPO)) expect(out).toContain(sentence);
    } finally {
      fs.rmSync(cwd, { recursive: true, force: true });
    }
  });
});
