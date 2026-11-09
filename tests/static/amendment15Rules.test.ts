/**
 * Amendment 15 (M-28, WU-146; D-501, D-502): the shared rules, the stray-file check, the compaction reminder's text
 * and the agent types' wording. The forms are read from the amendment where it states them.
 *
 * - AC-W121: `skills/build-guide/references/runner-rules.md` holds Appendix A's six headings, and under them the
 *   sentences the criterion lists, which `skills/build-guide/SKILL.md` no longer holds (the `.env`, network, trade
 *   stop, pricing notice, where-you-write and agent rules, and the Bash list's opening sentence); it names D-497's
 *   poe2db line and points to `skills/game-knowledge/references/lookups.md` for the legacy rule. `SKILL.md` tells the
 *   runner to read the file before anything else and after a compaction, keeps the compaction rule and its pipeline
 *   rules, and the stray-file check reads as §6 says.
 * - AC-W122 (static part): `scripts/compact-reminder.sh`'s numbered source lines appear verbatim in `SKILL.md`'s first
 *   40 lines, `${CLAUDE_PLUGIN_ROOT}` kept in the source; its text names `/pob2:build-guide`, `runner-rules.md` and
 *   `pob2-run-log`. The printing is `tests/unit/amendment15Reminder.test.ts`'s.
 * - AC-W123: each agent definition's description ends with §7's sentence (the coordinator's keeps "one step at a
 *   time"), and each type's tools equal `a8d735c`'s.
 */
import { describe, it, expect } from '@jest/globals';
import fs from 'fs';
import path from 'path';

const REPO = path.resolve(__dirname, '..', '..');
const read = (...rel: string[]) => fs.readFileSync(path.join(REPO, ...rel), 'utf8');
/** The text with every whitespace run collapsed to one space, so a phrase split by a hard wrap is still seen. */
const folded = (text: string) => text.replace(/\s+/g, ' ');

const SPEC = folded(read('docs', 'build-guide', 'spec', 'amendment-15-plugin-and-knowledge.md'));
const RULES_RAW = read('skills', 'build-guide', 'references', 'runner-rules.md');
const RULES = folded(RULES_RAW);
const SKILL_RAW = read('skills', 'build-guide', 'SKILL.md');
const SKILL = folded(SKILL_RAW);
const FIRST40_RAW = SKILL_RAW.split('\n').slice(0, 40);
const FIRST40 = folded(FIRST40_RAW.join('\n'));
const REMINDER = read('scripts', 'compact-reminder.sh');

/** The amendment's text from `start` to `end`, both required. */
function specBetween(start: string, end: string): string {
  const at = SPEC.indexOf(start);
  const to = SPEC.indexOf(end, at + start.length);
  if (at < 0 || to < 0) throw new Error(`amendment 15 has no "${start}" … "${end}"`);
  return SPEC.slice(at + start.length, to);
}

/** runner-rules.md's H2 sections, folded, by heading. */
function sections(raw: string): Map<string, string> {
  const out = new Map<string, string>();
  const parts = raw.split(/^(## .+)$/m);
  for (let i = 1; i < parts.length; i += 2) out.set(parts[i], folded(parts[i + 1]));
  return out;
}

/** Appendix A's headings for runner-rules.md, as the amendment lists them. */
const HEADINGS = [...specBetween("### `runner-rules.md`'s headings", '### The task header').matchAll(/`(## [^`]+)`/g)].map((m) => m[1]);
/** AC-W121's sentences, as the criterion quotes them. */
const SENTENCES = [...specBetween('and under them these sentences', "the Bash list's opening sentence").matchAll(/"([^"]+)"/g)].map((m) => m[1]);
/** The Bash list's opening sentence, as SKILL.md's hard rules held it before the move (D-265, D-352, D-355, D-356). */
const BASH_OPENING = 'Your Bash reads, and runs the run checker and the three scripts; nothing else';
/** Where each sentence sits: the heading Appendix A gives its rule (§6 names each rule's place). */
const PLACE: Record<string, string> = {
  'Never read, print or copy any `.env` file': '## Never .env',
  'Never contact pathofexile.com or poe.ninja yourself': '## The network',
  'No trade request after pricing stops, until the user approves a retry': '## Trade and pricing',
  'Tell the user before pricing starts': '## Trade and pricing',
  'Write only inside the run folder': '## Where you write',
  'Agents run only through the Agent tool': '## Agents',
  [BASH_OPENING]: '## Your Bash',
};

describe('AC-W121 (WU-146, D-501): the shared rules, in runner-rules.md', () => {
  const byHeading = sections(RULES_RAW);

  it("holds Appendix A's six headings, in its order, and no other H2", () => {
    expect(HEADINGS).toEqual(['## Never .env', '## The network', '## Trade and pricing', '## Where you write', '## Agents', '## Your Bash']);
    expect([...byHeading.keys()]).toEqual(HEADINGS);
  });

  it("holds each of the criterion's sentences under its heading, and SKILL.md holds none of them", () => {
    expect(SENTENCES).toHaveLength(6);
    for (const sentence of [...SENTENCES, BASH_OPENING]) {
      const heading = PLACE[sentence];
      expect({ sentence, placed: heading !== undefined }).toEqual({ sentence, placed: true });
      expect({ sentence, heading, under: (byHeading.get(heading) ?? '').includes(sentence) }).toEqual({ sentence, heading, under: true });
      expect({ sentence, inSkill: SKILL.includes(sentence) }).toEqual({ sentence, inSkill: false });
    }
    // The Bash list opens its section, as it opened SKILL.md's bullet.
    expect(byHeading.get('## Your Bash')).toMatch(new RegExp(`^ - \\*\\*${BASH_OPENING.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\*\\* \\(D-265\\)\\. The whole list:`));
  });

  it("names D-497's poe2db line under the network: poe2db.tw without asking, at the league digest's pace", () => {
    const network = byHeading.get('## The network') ?? '';
    expect(network).toContain('**poe2db.tw needs no approval** (D-497): request its pages without asking, at the league digest\'s pace');
    // D-400's pace, as D-497 and CLAUDE.md state it.
    expect(network).toContain('one at a time, at least 3 s apart, no cookie, one retry after 60 s on a 429 or 5xx, and nothing fetched twice');
  });

  it("points to game knowledge's lookups.md for the legacy rule, which that file states", () => {
    expect(RULES).toContain('The legacy rule (D-395) is game knowledge\'s: `skills/game-knowledge/references/lookups.md` states it.');
    expect(folded(read('skills', 'game-knowledge', 'references', 'lookups.md'))).toContain('**Legacy means not in the game** (D-395).');
  });

  it('the stray-file check runs git status --porcelain in the session\'s working directory when that is a git work tree, else is skipped, said once', () => {
    const bash = byHeading.get('## Your Bash') ?? '';
    expect(bash).toContain(
      "- `git status --porcelain` in the session's working directory, **the stray-file check** (D-474, D-501): when that folder, the one the session started in, is a git work tree, keep the untracked paths at the run's start or resume in your context; after each step, tell the user each new one, and delete nothing.",
    );
    expect(bash).toContain('When it isn\'t one (git says `not a git repository`), the check is skipped: say so once, at the start.');
    // No longer from the repository root, and no git call left in SKILL.md.
    expect(RULES).not.toContain('from the repository root');
    expect(SKILL).not.toMatch(/git status|stray-file/);
  });

  it("the Bash list names the four bin/ commands, and SKILL.md's hard rules no longer list them", () => {
    const bash = byHeading.get('## Your Bash') ?? '';
    for (const command of ['pob2-check-run <runFolder>', 'pob2-render-audit <runFolder> --build <id>', 'pob2-render-notes <runFolder> --build <id>', "pob2-run-log <runFolder> <kind> - <<'JSON'"]) {
      expect({ command, named: bash.includes(`\`${command}`) }).toEqual({ command, named: true });
    }
    const hard = folded(SKILL_RAW.slice(SKILL_RAW.indexOf('## Hard rules'), SKILL_RAW.indexOf('## Calling an agent')));
    expect(hard).not.toMatch(/Your Bash|`ls`, `cat`|`pob2-check-run/);
  });
});

describe('AC-W121 (WU-146, D-501): SKILL.md reads the shared rules first, and keeps its own', () => {
  const POINTER = '**Before anything else, read `${CLAUDE_PLUGIN_ROOT}/skills/build-guide/references/runner-rules.md` whole**, and again after a compaction';

  it('tells the runner to read runner-rules.md whole before anything else and again after a compaction, in its first 40 lines', () => {
    expect(FIRST40).toContain(POINTER);
    // Before anything else: ahead of the compaction rule and every step.
    expect(SKILL.indexOf(POINTER)).toBeLessThan(SKILL.indexOf('## After a compaction (D-420): read this first'));
    // The compaction rule's first step re-reads it with SKILL.md.
    const one = FIRST40_RAW.find((l) => l.startsWith('1. '));
    expect(one).toContain('Re-read `${CLAUDE_PLUGIN_ROOT}/skills/build-guide/SKILL.md` and `${CLAUDE_PLUGIN_ROOT}/skills/build-guide/references/runner-rules.md` whole');
  });

  it('keeps the compaction rule in its first 40 lines (D-420)', () => {
    expect(FIRST40).toContain('## After a compaction (D-420): read this first');
    expect(FIRST40_RAW.filter((l) => /^\d\. /.test(l)).map((l) => l.slice(0, 2))).toEqual(['1.', '2.', '3.']);
  });

  it("keeps its pipeline rules: the gate display first, the interview, read only what routes the run, its own pob2 tools", () => {
    const hard = folded(SKILL_RAW.slice(SKILL_RAW.indexOf('## Hard rules'), SKILL_RAW.indexOf('## Calling an agent')));
    for (const rule of [
      '**Every gate visit prints its display first, in your reply, whoever answers it**',
      '**Every gate visit and escalation is an interview**',
      '**Read only what routes the run:**',
      '**Your pob2 tools**',
    ]) {
      expect({ rule, kept: hard.includes(rule) }).toEqual({ rule, kept: true });
    }
  });
});

describe('AC-W122 (WU-146, D-501): the reminder\'s source text', () => {
  const numbered = REMINDER.split('\n').filter((l) => /^\d\. /.test(l));

  it("its numbered source lines appear verbatim in SKILL.md's first 40 lines, ${CLAUDE_PLUGIN_ROOT} kept in the source", () => {
    expect(numbered.map((l) => l.slice(0, 2))).toEqual(['1.', '2.', '3.']);
    for (const line of numbered) expect({ line, verbatim: FIRST40_RAW.includes(line) }).toEqual({ line, verbatim: true });
    expect(numbered[0]).toContain('`${CLAUDE_PLUGIN_ROOT}/skills/build-guide/SKILL.md`');
    expect(numbered[0]).toContain('`${CLAUDE_PLUGIN_ROOT}/skills/build-guide/references/runner-rules.md`');
  });

  it('its text names /pob2:build-guide, runner-rules.md and pob2-run-log, and no bare /build-guide', () => {
    const text = REMINDER.slice(REMINDER.indexOf("<<'EOF'"));
    // Amendment 16's M-30 (WU-159, D-516): worded for any pob2 run with a run-log.json in progress, /pob2:build-guide's
    // or a piece's.
    expect(text).toContain('If a pob2 run with a `run-log.json` is in progress (/pob2:build-guide, /pob2:compile, /pob2:pricing or /pob2:writer)');
    expect(text).toContain('If no pob2 run is in progress, ignore this.');
    expect(text).toContain('runner-rules.md');
    expect(text).toContain('pob2-run-log <runFolder> display <gate>');
    expect(text).not.toMatch(/(?<!pob2:)\/build-guide /);
  });
});

/** Each type's `tools:` line at `a8d735c`, before amendment 15 (D-502 leaves them unchanged). */
const A8D735C_TOOLS: Record<string, string> = {
  'build-guide-coordinator':
    'Read, Glob, Grep, Write, Edit, WebSearch, WebFetch, mcp__pob2__lookup_game_data, mcp__pob2__check_model_coverage, mcp__pob2__search_tree_nodes, mcp__pob2__list_gems, mcp__pob2__get_classes, mcp__pob2__lua_get_stats, mcp__pob2__lua_get_build_info, mcp__pob2__lua_get_tree, mcp__pob2__get_equipped_items, mcp__pob2__get_skill_setup, mcp__pob2__analyze_skills, mcp__pob2__get_config, mcp__pob2__analyze_defenses, mcp__pob2__validate_build, mcp__pob2__get_build_issues, mcp__pob2__suggest_supports, mcp__pob2__get_passive_upgrades, mcp__pob2__get_node_power, mcp__pob2__get_nearby_nodes, mcp__pob2__find_path_to_node, mcp__pob2__list_specs, mcp__pob2__list_item_sets, mcp__pob2__compile_plan, mcp__pob2__guide_run, mcp__pob2__encode_build_code, mcp__pob2__get_item_price, mcp__pob2__search_trade_items, mcp__pob2__search_stats, mcp__pob2__get_leagues, mcp__pob2__trade_query_options, mcp__pob2__get_currency_rates, mcp__pob2__find_upgrades, mcp__pob2__manage_sets',
  'build-guide-researcher': 'Read, Glob, Grep, Write, WebSearch, WebFetch, mcp__pob2__lookup_game_data, mcp__pob2__check_model_coverage, mcp__pob2__search_tree_nodes, mcp__pob2__list_gems, mcp__pob2__get_classes',
  'build-guide-verifier': 'Read, Glob, Grep, Write, WebFetch, mcp__pob2__lookup_game_data, mcp__pob2__check_model_coverage, mcp__pob2__search_tree_nodes, mcp__pob2__list_gems, mcp__pob2__get_classes',
  'build-guide-writer': 'Read, Glob, Grep, Write, Edit',
};

describe("AC-W123 (WU-146, D-502): the agent types' wording", () => {
  /** §7's sentence, as the amendment quotes it, and the coordinator's form with "one step at a time" kept. */
  const SENTENCE = /Each description's last sentence becomes "([^"]+)"/.exec(SPEC)?.[1] ?? '';
  const COORDINATOR_SENTENCE = SENTENCE.replace(' with the Agent tool;', ' with the Agent tool, one step at a time;');
  const frontmatter = (type: string) => {
    const fm = /^---\n([\s\S]*?)\n---\n/.exec(read('agents', `${type}.md`))?.[1] ?? '';
    const field = (name: string) => new RegExp(`^${name}: (.*)$`, 'm').exec(fm)?.[1] ?? '';
    return { description: field('description'), tools: field('tools') };
  };

  it("reads §7's sentence from the amendment", () => {
    expect(SENTENCE).toBe("Started only by a pob2 skill's runner with the Agent tool; never for other tasks.");
    expect(COORDINATOR_SENTENCE).toBe("Started only by a pob2 skill's runner with the Agent tool, one step at a time; never for other tasks.");
  });

  it.each(Object.keys(A8D735C_TOOLS))("%s's description ends with §7's sentence, and names no single skill's runner", (type) => {
    const { description } = frontmatter(type);
    expect(description.endsWith(type === 'build-guide-coordinator' ? ` ${COORDINATOR_SENTENCE}` : ` ${SENTENCE}`)).toBe(true);
    expect(description).not.toContain("the build-guide skill's runner");
  });

  it.each(Object.keys(A8D735C_TOOLS))("%s's tools equal a8d735c's", (type) => {
    expect(frontmatter(type).tools).toBe(A8D735C_TOOLS[type]);
  });

  it('agents/ holds exactly the four types', () => {
    expect(fs.readdirSync(path.join(REPO, 'agents')).sort()).toEqual(Object.keys(A8D735C_TOOLS).map((t) => `${t}.md`));
  });
});
