/**
 * WU-108 (amendment 10 §10, D-435): the text half of the live test's fixes. AC-W87, every bullet, and the description
 * half of AC-P77.
 *
 * - `references/stages/V4.md` has the verifier check its report's list syntax (no empty `- ` item) before its one
 *   Write, since it keeps no Edit (R-5); the checker's side (an empty item ignored) is WU-105's;
 * - `docs/build-guide/plan-reference.md` states the base-implicit rule: a text with no `Implicits:` line gets its
 *   base's implicits, at PoB's default roll; `Implicits: 0` and a unique are kept as written; a variant base isn't
 *   filled, and V1 reports `implicit-variant` with `{slot, base, variants, path}`;
 * - the background-summary finding is the work-log's (2026-10-23): the user chose not to pursue Claude Code's default
 *   behaviour, so `run-settings.example.json` gains nothing;
 * - `get_node_power`'s `clear_group` says it is the plan's group number, as compile_plan's record numbers it, PoB's
 *   granted groups numbered after the build's own; the tool's description stays within AC-F15's 2,048 characters.
 */
import fs from 'fs';
import path from 'path';
import { describe, expect, it } from '@jest/globals';
import { getBuildGoalsToolSchemas } from '../../src/server/toolSchemas';

const REPO = path.resolve(__dirname, '..', '..');
const read = (...p: string[]) => fs.readFileSync(path.join(REPO, ...p), 'utf8');
/** Text with every run of whitespace one space, so a pinned phrase may wrap. */
const folded = (s: string) => s.replace(/\s+/g, ' ');

describe("AC-W87: V4 checks its report's list syntax before its one Write (D-435, R-5)", () => {
  const v4 = read('.claude', 'skills', 'build-guide', 'references', 'stages', 'V4.md');
  const writes = folded(v4.slice(v4.indexOf('## Writes'), v4.indexOf('## Returns'))).trim();

  it('the Writes section has the check, and it comes before the Write it guards', () => {
    expect(writes).toContain("**Check the report's list syntax before the Write** (D-435).");
    expect(writes).toContain('You have no Edit (R-5): what you write stays as written.');
    expect(writes).toContain('So read your report through once before the one Write:');
    expect(writes).toMatch(/no item is empty \(a line that is only `-` or `- `, as a list cut short leaves one\)/);
    expect(writes).toMatch(/every list item is a `- ` and its text on the same line, a field `- <key>: <value>` with its value/);
    expect(writes).toMatch(/Mend what breaks it in the text you hold, then Write\.$/);
  });

  it('still writes one report with one Write and never overwrites one', () => {
    expect(writes).toContain("`reports/V4-<n>.md`, the one file your header's `writes` names, with one Write, and nothing else (D-352).");
    expect(writes).toContain('**Never overwrite a report:**');
  });
});

describe("AC-W87: plan-reference.md states the base-implicit rule (D-435)", () => {
  const ref = folded(read('docs', 'build-guide', 'plan-reference.md'));

  it('a text with no Implicits: line gets its base implicits, as PoB fills a base, at its default roll', () => {
    expect(ref).toContain("### A base's implicits (D-435)");
    expect(ref).toContain("**An item whose text has no `Implicits:` line gets its base's implicits:**");
    expect(ref).toContain("as PoB's own rare list and crafting window fill a base's (`Modules/Main.lua:170-176`)");
    expect(ref).toContain("a range at PoB's default roll, its middle (0.5, `Modules/Main.lua:105`)");
  });

  it('Implicits: 0 and a unique are kept as written; a variant base is not filled and V1 reports implicit-variant', () => {
    expect(ref).toContain('**A text with an `Implicits:` line,** `Implicits: 0` included');
    expect(ref).toContain("**A unique** (or a relic): PoB's unique data carries its own implicits");
    expect(ref).toContain('**A base whose implicit has variants** isn\'t filled');
    expect(ref).toContain("V1 reports `implicit-variant`, naming the base and its variants, its `data` `{slot, base, variants, path}`");
    expect(ref).toContain('write the variant\'s implicit line after an `Implicits:` line');
    // The fields table points at the rule.
    expect(ref).toMatch(/Parsed at compile; a text with no `Implicits:` line, not a unique, gets its base's implicits \(see a base's implicits above\) \| C-31, D-435 \|/);
  });
});

describe('AC-W87: the background-summary finding is the work-log\'s (D-435)', () => {
  it('records it in the work-log, and run-settings.example.json sets no env', () => {
    expect(read('docs', 'build-guide', 'worklog.md')).toContain('**Background summaries (AC-W87):**');
    const settings = JSON.parse(read('docs', 'build-guide', 'run-settings.example.json')) as { env?: Record<string, string> };
    expect(settings.env).toBeUndefined();
  });
});

describe("AC-P77: get_node_power's clear_group is the plan's group number (D-435, C-55)", () => {
  type Tool = { name: string; description: string; inputSchema: { properties: Record<string, { description: string }> } };
  const tool = (getBuildGoalsToolSchemas() as Tool[]).find((t) => t.name === 'get_node_power')!;

  it("says so in clear_group's description, and the tool's description stays within AC-F15's cap", () => {
    const text = tool.inputSchema.properties.clear_group.description;
    expect(text).toContain("the plan's group number, as compile_plan's record numbers it");
    expect(text).toContain('For a build not compiled from a plan, its own groups in order; the groups PoB adds for a skill an item or passive grants are numbered after them');
    expect(text).toContain('(default: the main group)');
    expect(tool.description.length).toBeLessThanOrEqual(2048);
  });
});
