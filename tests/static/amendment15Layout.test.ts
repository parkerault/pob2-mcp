/**
 * Amendment 15 (M-28, WU-145; D-499, D-503's moves): the repository as the Claude Code plugin `pob2`.
 *
 * - AC-W114: the two manifests hold Appendix A's fields, the marketplace listing one plugin, `pob2`, with
 *   `"source": "./"`; `skills/build-guide/SKILL.md` exists; `agents/` holds exactly the four definitions; the old skill
 *   and agent folders are gone; `bin/` holds exactly the four commands, each executable, in Appendix A's form;
 *   `hooks/hooks.json` holds one `SessionStart` hook, matcher `compact`, that runs `scripts/compact-reminder.sh` under
 *   `${CLAUDE_PLUGIN_ROOT}`, quoted. The load check (`claude plugin validate`, `claude --plugin-dir <tree> plugin
 *   details pob2`) is the gate's verifier's, recorded in the work-log: the `claude` binary isn't a dependency.
 * - AC-W119 (static part): every agent type the runner reads to start an agent is a `pob2:` type (the step table,
 *   `checkpoints.md`'s gate-question routing, `SKILL.md`'s agent-type rule and its example); `stages/Q.md`'s `- Agent:`
 *   line keeps the bare types, the ones the checker's gate-question check takes.
 * - AC-W120 (static part): game knowledge's three references and three data builders are in
 *   `skills/game-knowledge/`; the references' text is `a8d735c`'s but for paths; the builders' committed headers name
 *   their new paths; `CLAUDE.md`'s pin-upgrade step 7 names them.
 * - AC-W127: `skills/build-guide/SKILL.md` has at most 349 lines.
 *
 * This file is AC-W114's own test, the one that names the removed folders: AC-W115's old-path guard
 * (`amendment15Paths.test.ts`) skips it.
 */
import { describe, it, expect } from '@jest/globals';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

const REPO = path.resolve(__dirname, '..', '..');
const read = (...rel: string[]) => fs.readFileSync(path.join(REPO, ...rel), 'utf8');
const readJson = (...rel: string[]) => JSON.parse(read(...rel)) as Record<string, unknown>;
/** The text with every whitespace run collapsed to one space, so a phrase split by a hard wrap is still seen. */
const folded = (text: string) => text.replace(/\s+/g, ' ');

const AGENT_FILES = ['build-guide-coordinator.md', 'build-guide-researcher.md', 'build-guide-verifier.md', 'build-guide-writer.md'];
const COMMANDS = ['pob2-check-run', 'pob2-render-audit', 'pob2-render-notes', 'pob2-run-log'];

describe('AC-W114 (WU-145, D-499): the repository is the plugin pob2', () => {
  it(".claude-plugin/plugin.json holds Appendix A's fields: the name pob2, a one-line description, the author, and no version", () => {
    expect(readJson('.claude-plugin', 'plugin.json')).toEqual({
      name: 'pob2',
      description: 'Path of Exile 2 build tools over a headless Path of Building 2: build guides and game knowledge',
      author: { name: 'Parker' },
    });
  });

  it('.claude-plugin/marketplace.json is the marketplace pob2-mcp, listing one plugin, pob2, with "source": "./"', () => {
    const market = readJson('.claude-plugin', 'marketplace.json');
    expect(market).toEqual({
      name: 'pob2-mcp',
      owner: { name: 'Parker' },
      description: 'The pob2 plugin: Path of Exile 2 build tools over a headless Path of Building 2',
      plugins: [{ name: 'pob2', source: './' }],
    });
    // The marketplace's one plugin is the plugin's own manifest's name, so the repository is both.
    expect((market.plugins as Array<{ name: string }>)[0].name).toBe(readJson('.claude-plugin', 'plugin.json').name);
  });

  it('skills/build-guide/SKILL.md exists, and .claude/skills/build-guide/ and .claude/agents/build-guide/ are gone', () => {
    expect(fs.existsSync(path.join(REPO, 'skills', 'build-guide', 'SKILL.md'))).toBe(true);
    expect(fs.existsSync(path.join(REPO, '.claude', 'skills', 'build-guide'))).toBe(false);
    expect(fs.existsSync(path.join(REPO, '.claude', 'agents', 'build-guide'))).toBe(false);
  });

  it('agents/ holds exactly the four definitions, flat, each named for its file', () => {
    expect(fs.readdirSync(path.join(REPO, 'agents')).sort()).toEqual(AGENT_FILES);
    for (const file of AGENT_FILES) {
      const name = /^---\n[\s\S]*?^name: (.+)$/m.exec(read('agents', file))?.[1];
      expect({ file, name }).toEqual({ file, name: file.replace(/\.md$/, '') });
    }
  });

  it("bin/ holds exactly the four commands, each executable, each Appendix A's form running its script from the plugin root", () => {
    expect(fs.readdirSync(path.join(REPO, 'bin')).sort()).toEqual(COMMANDS);
    for (const command of COMMANDS) {
      const file = path.join(REPO, 'bin', command);
      expect({ command, executable: (fs.statSync(file).mode & 0o111) === 0o111 }).toEqual({ command, executable: true });
      const script = `${command.replace(/^pob2-/, '')}.mjs`;
      expect({ command, text: fs.readFileSync(file, 'utf8') }).toEqual({
        command,
        text: `#!/bin/sh\nd=$(cd -P "$(dirname "$0")/.." && pwd -P)\nexec node "$d/skills/build-guide/scripts/${script}" "$@"\n`,
      });
      expect({ command, script: fs.existsSync(path.join(REPO, 'skills', 'build-guide', 'scripts', script)) }).toEqual({ command, script: true });
    }
  });

  it('hooks/hooks.json holds one SessionStart hook, matcher compact, that runs scripts/compact-reminder.sh under ${CLAUDE_PLUGIN_ROOT}, quoted', () => {
    expect(readJson('hooks', 'hooks.json')).toEqual({
      hooks: {
        SessionStart: [{ matcher: 'compact', hooks: [{ type: 'command', command: '"${CLAUDE_PLUGIN_ROOT}/scripts/compact-reminder.sh"' }] }],
      },
    });
    expect(fs.existsSync(path.join(REPO, 'scripts', 'compact-reminder.sh'))).toBe(true);
  });
});

describe('AC-W119 (WU-145, D-499): the pob2: prefix wherever the runner reads an agent type to start an agent', () => {
  const skill = read('skills', 'build-guide', 'SKILL.md');
  const types = (text: string) => [...text.matchAll(/`((?:[a-z0-9]+:)?build-guide-(?:coordinator|researcher|verifier|writer))`/g)].map((m) => m[1]);

  it("the step table's agent-type column names only pob2: types", () => {
    const section = skill.slice(skill.indexOf('## The steps'), skill.indexOf('## 1. Start'));
    const cells = section.split('\n').filter((l) => /^\| \d+[a-c]? \|/.test(l)).map((l) => l.split(' | ')[2]);
    const named = cells.flatMap(types);
    // R1a, R1a-synthesize, R1b, R1b-assemble, D1-build, D1-tree, D1-finish, D1-gate, F1, D2, D2-gate, W1, V4 twice.
    expect(named).toHaveLength(14);
    expect(named.filter((t) => !t.startsWith('pob2:'))).toEqual([]);
    expect(new Set(named)).toEqual(new Set(['pob2:build-guide-researcher', 'pob2:build-guide-coordinator', 'pob2:build-guide-writer', 'pob2:build-guide-verifier']));
  });

  // WU-146 (D-501): the agent-type rule moved with the shared rules to runner-rules.md; the example stays in SKILL.md.
  it("the agent-type rule (runner-rules.md) and SKILL.md's Agent example name the prefixed types", () => {
    expect(folded(read('skills', 'build-guide', 'references', 'runner-rules.md'))).toContain(
      "**Agents run only through the Agent tool, as one of the four build-guide types**, named in `subagent_type` with the plugin's prefix: `pob2:build-guide-coordinator`, `pob2:build-guide-researcher`, `pob2:build-guide-verifier` or `pob2:build-guide-writer`.",
    );
    const calls = [...skill.matchAll(/Agent\(\{subagent_type: "([^"]+)"/g)].map((m) => m[1]);
    expect(calls).toEqual(['pob2:build-guide-coordinator']);
  });

  it("checkpoints.md's gate-question routing names the prefixed types", () => {
    const routing = folded(read('skills', 'build-guide', 'references', 'checkpoints.md'));
    expect(routing).toContain(
      'a research question goes to a `pob2:build-guide-researcher`; one about a compiled build, or that needs a measurement, to a `pob2:build-guide-coordinator`.',
    );
  });

  it("stages/Q.md's - Agent: line keeps the bare types, which the checker's gate-question check takes, unchanged", () => {
    expect(read('skills', 'build-guide', 'references', 'stages', 'Q.md')).toContain('- Agent: <build-guide-researcher | build-guide-coordinator>');
    const checker = read('skills', 'build-guide', 'scripts', 'check-run.mjs');
    expect(checker).toContain("!['build-guide-researcher', 'build-guide-coordinator'].includes(agent)");
    expect(checker).toContain('"- Agent: build-guide-researcher | build-guide-coordinator"');
  });
});

/**
 * The path forms amendment 15 rewrites (§5), removed so a text compares with its `a8d735c` text: the plugin-root
 * prefix, `../` chains, the old and new skill and agent folders, the skill-relative folders before a file name, and a
 * run script's `node …/<x>.mjs` and `pob2-<x>` command forms, both read as `<x>.mjs`.
 */
const withoutPaths = (text: string) =>
  text
    .replace(/\$\{CLAUDE_PLUGIN_ROOT\}\//g, '')
    .replace(/(?:\.\.\/)+/g, '')
    .replace(/\.claude\/skills\/build-guide\//g, '')
    .replace(/\.claude\/agents\/build-guide\//g, '')
    .replace(/skills\/(?:build-guide|game-knowledge)\//g, '')
    .replace(/\bnode (?=(?:scripts\/)?(?:check-run|run-log|render-audit|render-notes)\.mjs)/g, '')
    .replace(/\bpob2-(check-run|run-log|render-audit|render-notes)\b/g, '$1.mjs')
    .replace(/(?<![\w-])(?:references\/(?:stages\/)?|stages\/|templates\/|scripts\/)(?=[\w.-]+\.(?:md|json|mjs)\b)/g, '');

/**
 * The sha256 of each reference's `a8d735c` text (`.claude/skills/build-guide/references/<name>`) after `withoutPaths`,
 * computed from `git show a8d735c:<path>` when WU-145 moved them.
 */
const A8D735C_WITHOUT_PATHS: Record<string, string> = {
  'patterns.md': 'e97b5a4a6c06d98e7a15a2bd74abf005466e3e45dda914f101d5232229c26772',
  'lookups.md': '8ec7d45341c9d8ab67f543faca1aef2a842a77bb2cbfae12c1fc92dd83ab6b01',
  'source-markers.md': 'f1b4a2373634b3175fb3aafe1a27167b433a302d5d92da0d381f5ecb3d7dd0f3',
};

/**
 * Amendment 16 (WU-151, D-507): the lines the running-league rule changed after the move, each `[its text now, its text
 * before]`. The hash is taken with them put back, so any other change to the moved references still shows.
 */
const D507_EDITS: Record<string, [string, string][]> = {
  'lookups.md': [
    [
      "- `data/league/<slug>.md`, the league digests from poe2db: only the running leagues' (D-507: a task header's `digests`,\n  or `skills/game-knowledge/scripts/leagues.mjs`'s list), each head whole, newest first, the bodies by Grep. `[not in\n  pin]` marks an entry the PoB pin doesn't know: no plan can compile it.",
      "- `data/league/<slug>.md`, the league digest from poe2db: its head whole, its body by Grep. `[not in pin]` marks an\n  entry the PoB pin doesn't know: no plan can compile it.",
    ],
  ],
  'patterns.md': [
    [
      "and the family's word in the running league digests' bodies (a\n  task header's `digests`, D-507); cover gems,",
      "and the family's word in the league digest's body\n  (`data/league/`); cover gems,",
    ],
  ],
};

describe("AC-W120 (WU-145, D-503): game knowledge's six files", () => {
  const GK = path.join(REPO, 'skills', 'game-knowledge');
  const BG = path.join(REPO, 'skills', 'build-guide');

  it('its three references and its three data builders are in skills/game-knowledge/, and no longer in build-guide\'s folders', () => {
    for (const name of Object.keys(A8D735C_WITHOUT_PATHS)) {
      expect({ name, there: fs.existsSync(path.join(GK, 'references', name)), left: fs.existsSync(path.join(BG, 'references', name)) }).toEqual({ name, there: true, left: false });
    }
    for (const name of ['rules-index.mjs', 'league-digest.mjs', 'monster-mods.mjs']) {
      expect({ name, there: fs.existsSync(path.join(GK, 'scripts', name)), left: fs.existsSync(path.join(BG, 'scripts', name)) }).toEqual({ name, there: true, left: false });
    }
  });

  it("the references differ from their a8d735c text only in paths (and in amendment 16's league lines, D-507)", () => {
    for (const [name, sha] of Object.entries(A8D735C_WITHOUT_PATHS)) {
      let text = fs.readFileSync(path.join(GK, 'references', name), 'utf8');
      for (const [now, before] of D507_EDITS[name] ?? []) {
        expect({ name, edited: text.includes(now) }).toEqual({ name, edited: true });
        text = text.replace(now, before);
      }
      expect({ name, sha: crypto.createHash('sha256').update(withoutPaths(text)).digest('hex') }).toEqual({ name, sha });
    }
  });

  it('the normalization removes only path forms: a changed word still changes the hash', () => {
    const text = fs.readFileSync(path.join(GK, 'references', 'lookups.md'), 'utf8');
    expect(withoutPaths('`skills/game-knowledge/references/patterns.md`, `pob2-run-log <runFolder>`')).toBe(withoutPaths('`.claude/skills/build-guide/references/patterns.md`, `node .claude/skills/build-guide/scripts/run-log.mjs <runFolder>`'));
    const changed = text.replace('No scratch builds', 'No scratch build');
    expect(changed).not.toBe(text);
    expect(crypto.createHash('sha256').update(withoutPaths(changed)).digest('hex')).not.toBe(A8D735C_WITHOUT_PATHS['lookups.md']);
  });

  it("the data builders' committed headers name their new paths, and src/plan/monsterMods.ts's comment follows", () => {
    expect(read('data', 'rules', 'pairs.md').split('\n')[2]).toBe(
      'Written by `skills/game-knowledge/scripts/rules-index.mjs join --write` from `nodes.md` (its `[rule]` lines),',
    );
    expect(read('data', 'league', 'runes-of-aldur.md').split('\n')[4]).toContain('Written by `skills/game-knowledge/scripts/league-digest.mjs Runes_of_Aldur`;');
    expect(read('data', 'monsters', 'monster-mods.md').split('\n')[2]).toBe(
      "Written by `skills/game-knowledge/scripts/monster-mods.mjs` from poe2db's pages saved 2026-10-18 (amendment 8, D-402).",
    );
    expect(read('src', 'plan', 'monsterMods.ts').split('\n')[4]).toContain('(written by `skills/game-knowledge/scripts/monster-mods.mjs`)');
  });

  it("CLAUDE.md's pin-upgrade step 7 names the data builders' new paths", () => {
    const claude = read('CLAUDE.md');
    const section = claude.slice(claude.indexOf('## Upgrading the PoB2 pin'), claude.indexOf('\n## ', claude.indexOf('## Upgrading the PoB2 pin') + 1));
    const step7 = folded(section.slice(section.indexOf('\n7. ')));
    expect(step7).toContain('`mise exec -- node skills/game-knowledge/scripts/rules-index.mjs candidates --json`');
    expect(step7).toContain('`node skills/game-knowledge/scripts/rules-index.mjs check`');
    expect(step7).toContain('`node skills/game-knowledge/scripts/league-digest.mjs --reflag <slug>`');
  });
});

describe("AC-W127 (WU-145, D-505): /pob2:build-guide's SKILL.md size", () => {
  it('skills/build-guide/SKILL.md has at most 349 lines', () => {
    const text = read('skills', 'build-guide', 'SKILL.md');
    expect(text.endsWith('\n')).toBe(true);
    expect(text.split('\n').length - 1).toBeLessThanOrEqual(349);
  });
});
