/**
 * Amendment 16's M-30, WU-165 (D-522, C-65; §12's piece rules, §18): `/pob2:writer`, the static parts.
 *
 * - AC-W158: `skills/writer/SKILL.md` exists with fewer than 150 lines, frontmatter `name` and `description` only, the
 *   description at most 1,536 characters, a plain YAML scalar, quoting at least two requests in a player's words (§12,
 *   choice F) and naming when to use it (a guide for a finished build, a rewrite) and the other pob2 commands for the rest
 *   (a guide from a file is `/pob2:build-guide`'s); its runner reads `runner-rules.md` whole first and after a compaction
 *   (D-501), names its source as a run folder and never guesses it, writes nothing in the source, starts W1 with the
 *   header's `source`, and runs the checker against the source.
 * - W1's stage reference holds the writer run's section (§18: `source`, the reads from the source, the writes in its own
 *   folder, a better round's one rung, owned rares as specs); the task header documents `source` (C-36); the run log's
 *   reference says `init` refuses a source that isn't a build that passed F1.
 */
import { describe, it, expect } from '@jest/globals';
import fs from 'fs';
import path from 'path';

const REPO = path.resolve(__dirname, '..', '..');
const read = (...rel: string[]) => fs.readFileSync(path.join(REPO, ...rel), 'utf8');
/** The text with every whitespace run collapsed to one space, so a phrase split by a hard wrap is still seen. */
const folded = (text: string) => text.replace(/\s+/g, ' ');

/** Read whole, never as empty text when missing: a missing file fails every test here loudly. */
const RAW = read('skills', 'writer', 'SKILL.md');
const FRONT = /^---\n([\s\S]*?)\n---\n/.exec(RAW);
const BODY_RAW = FRONT ? RAW.slice(FRONT[0].length) : RAW;
const BODY = folded(BODY_RAW);
const FIELDS = new Map((FRONT?.[1] ?? '').split('\n').map((l) => [l.slice(0, l.indexOf(': ')), l.slice(l.indexOf(': ') + 2)] as [string, string]));
const DESCRIPTION = FIELDS.get('description') ?? '';
/** A Markdown file's H2 section by its heading, folded; throws when it is missing. */
function section(text: string, heading: string): string {
  const parts = text.split(/^(## .+)$/m);
  const i = parts.indexOf(heading);
  if (i < 0) throw new Error(`no "${heading}"`);
  return folded(parts[i + 1]);
}

describe('AC-W158 (WU-165, D-522): skills/writer/SKILL.md', () => {
  it('exists with fewer than 150 lines and frontmatter name and description only, the description at most 1,536 characters', () => {
    const lines = RAW.split('\n');
    if (lines[lines.length - 1] === '') lines.pop();
    expect(lines.length).toBeGreaterThan(40);
    expect(lines.length).toBeLessThan(150);
    expect(FRONT).not.toBeNull();
    expect([...FIELDS.keys()]).toEqual(['name', 'description']);
    expect(FIELDS.get('name')).toBe('writer');
    expect(DESCRIPTION.length).toBeGreaterThan(200);
    expect(DESCRIPTION.length).toBeLessThanOrEqual(1536);
    // A plain YAML scalar: no indicator first, no ': ' or ' #' inside, so the value reads as written.
    expect(DESCRIPTION).toMatch(/^[A-Za-z]/);
    expect(DESCRIPTION).not.toMatch(/: | #/);
  });

  it("quotes the requests players make in their own words (§12, choice F), names when to use it, and the other commands for the rest", () => {
    const quoted = [...DESCRIPTION.matchAll(/"([^"]+)"/g)].map((m) => m[1]);
    for (const q of ['write the guide for the build I just made', 'write a guide for my improved character', 'rewrite the guide for that run']) expect(quoted).toContain(q);
    expect(quoted.length).toBeGreaterThanOrEqual(2);
    expect(DESCRIPTION).toContain('/pob2:writer <run folder> [<build id>]');
    expect(DESCRIPTION).toContain('/pob2:writer --resume <run folder>');
    // §18's when: a build that passed F1 in a /pob2:build-guide run, a file run, or an accepted better round.
    expect(DESCRIPTION).toContain('Use for a build that passed its final compile in a /pob2:build-guide run or a run from a player\'s file, or a /pob2:compile run whose better round was accepted');
    // §18's when not: a guide from a file is /pob2:build-guide's, a player's request routed there in their words.
    expect(DESCRIPTION).toContain('Not for a guide from the player\'s own PoB file or character, which designs it first ("a build guide for my build MyCharacter123", use /pob2:build-guide).');
    expect(DESCRIPTION).toContain('Not for measuring or improving a character (use /pob2:compile), what its gear costs (use /pob2:pricing) or a game question (use /pob2:game-knowledge).');
    expect(DESCRIPTION).toContain('changing nothing in that run');
  });

  it('tells its runner to read runner-rules.md whole before anything else, and again after a compaction (D-501)', () => {
    expect(BODY).toContain('**Before anything else, read `${CLAUDE_PLUGIN_ROOT}/skills/build-guide/references/runner-rules.md` whole**, and again after a compaction');
    expect(BODY_RAW.indexOf('**Before anything else')).toBeGreaterThan(0);
    expect(BODY_RAW.indexOf('**Before anything else')).toBeLessThan(BODY_RAW.indexOf('\n## '));
    expect(BODY).toContain('**After a compaction** during a writer run, before your next step: re-read this file and the runner rules whole, and the run\'s `run-log.json`.');
  });

  it('names its source as a run folder, never guessing it, and sends a PoB file or a character to /pob2:build-guide', () => {
    const src = section(BODY_RAW, '## The source');
    expect(src).toContain('a run folder, `<slug>/<YYYY-MM-DD>-<n>` under the guides root');
    expect(src).toContain('and ask; never guess');
    expect(src).toContain("A request naming a PoB file or a character (\"my build MyCharacter123\") is `/pob2:build-guide`'s guide from a file: say so and stop.");
  });

  it("starts its run folder and its log with the source, and init's refusal ends the run with its reason", () => {
    const start = section(BODY_RAW, '## 1. Start');
    expect(start).toContain('`mcp__pob2__guide_run {new_run: "writer"}`');
    expect(start).toContain('`pob2-run-log <runFolder> init` with `{"piece": "writer", "mode", "testConfig": "none", "noNinja", "source": {"kind": "run-folder", "name": "<slug>/<YYYY-MM-DD>-<n>", "build": "<id>"}}`');
    expect(start).toContain("`init` refuses a source that isn't a build that passed F1 (a compile run with its measure only among them) or that keeps what a guide can't carry");
  });

  it("renders the source's audit, starts W1 with the header's source and its own writes, and checks against the source", () => {
    expect(section(BODY_RAW, '## 2. The audit')).toContain('`pob2-render-audit <runFolder>`: in a writer run it reads the source build its log names');
    const w1 = section(BODY_RAW, '## 3. W1');
    expect(w1).toContain('`Agent({subagent_type: "pob2:build-guide-writer"');
    expect(w1).toContain('`buildFolder: "."`, `compile: "none"`, `writes: ["guide.md", "audit.md"]`, `source: {runFolder: <the source\'s absolute path>, buildFolder: <builds/<id>, or "." for a compile run>}`');
    expect(w1).toContain("`concept` the source's build (`source.build`, else `file`)");
    expect(section(BODY_RAW, '## 4. Known issues and the notes')).toContain('`pob2-render-notes <runFolder>`');
    expect(section(BODY_RAW, '## 5. End')).toContain("it checks your guide and audit against the source's files");
    expect(section(BODY_RAW, '## What you never do')).toContain('**Write in the source run folder**');
  });
});

describe("AC-W158 (WU-165, D-522): W1's writer section, the task header's source and the run log's refusal", () => {
  const W1 = read('skills', 'build-guide', 'references', 'stages', 'W1.md');

  it('W1 reads a writer run\'s inputs from its source and writes in its own folder (§18)', () => {
    const s = section(W1, '## A writer run (`source`, D-522)');
    expect(s).toContain('`source.runFolder`, its absolute path, and `source.buildFolder`, the build\'s folder in it (`.` for a better round)');
    expect(s).toContain('Read every input below from there as from your own run');
    expect(s).toContain('Your `runFolder` holds what you write, `buildFolder` `.`: `guide.md`, and `audit.md`, the runner\'s render from the source. Write nothing in the source.');
  });

  it("W1 gives a better round's build the endgame template of its one rung and its owned rares as specs (§16, §18)", () => {
    const s = section(W1, '## A writer run (`source`, D-522)');
    expect(s).toContain("the endgame template with that rung's `Endgame` H2 alone");
    expect(s).toContain("the verdict line's hits are the rung's, from `audit.md`'s Stage detail");
    expect(s).toContain("**An owned rare** (`owned: true`) is a spec, never the character's own rolls");
    expect(s).toContain("The run checker fails a guide that prints an owned rare's rolled line.");
  });

  it('the task header documents source (C-36), and the run log\'s reference the source init refuses', () => {
    expect(read('skills', 'build-guide', 'references', 'task-header.md')).toContain("| `source` | W1 in a `/pob2:writer` run only (D-522): `{runFolder, buildFolder}`, the source run folder's absolute path and its build's folder in it, which W1 reads; its own `buildFolder` is `.` |");
    expect(folded(read('skills', 'build-guide', 'references', 'run-log.md'))).toContain("`init` refuses a writer's source that isn't a build that passed F1 (its card, a D1-gate verdict, a final record) or that keeps what a guide can't carry (D-522).");
  });
});
