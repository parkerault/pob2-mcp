/**
 * WU-102 (amendment 9 §24.2; D-426, D-427, C-56): the text half of AC-W81 and the contracts' documentation.
 *
 * - `references/stages/R1a.md` searches travel skills by type through `list_gems`' `skill_type`, in a paragraph of its
 *   own, beside WU-100's and WU-101's paragraphs, which stay;
 * - `list_gems`' schema has `skill_type`, and its description says so; `compile_plan`'s description names a group's
 *   weapon set;
 * - `docs/build-guide/plan-reference.md` documents `weaponSet`, the record's `skillOutputsSet2` and the clear measure's
 *   `travel`, and V1's `empty-weapon-set`.
 */
import fs from 'fs';
import path from 'path';
import { describe, expect, it } from '@jest/globals';
import { getLuaToolSchemas } from '../../src/server/toolSchemas';

const REPO = path.resolve(__dirname, '..', '..');
const read = (...p: string[]) => fs.readFileSync(path.join(REPO, ...p), 'utf8');
/** Text with every run of whitespace one space, so a pinned phrase may wrap. */
const folded = (s: string) => s.replace(/\s+/g, ' ');

describe('AC-W81: R1a searches travel skills by type (D-427)', () => {
  const r1a = folded(read('.claude', 'skills', 'build-guide', 'references', 'stages', 'R1a.md'));

  it('names the list_gems call with skill_type "Travel", and says a gem tag is not a skill type', () => {
    expect(r1a).toContain('**Travel skills, by skill type** (D-427).');
    expect(r1a).toContain('`mcp__pob2__list_gems {skill_type: "Travel"}` lists every gem whose skill has the Travel type');
    expect(r1a).toMatch(/A gem tag \(`warcry`, `travel`\) isn't a skill type: tags go in `tag`\./);
    expect(r1a).toMatch(/an unknown name fails and lists them/);
    expect(r1a).toContain('(`measures.clearSpeed.travel`)');
  });

  it("keeps WU-100's and WU-101's paragraphs", () => {
    expect(r1a).toContain("**PoB's source, for how it computes only** (D-425).");
    expect(r1a).toContain('- **Weapon sets** (D-426): every card\'s identity has the line `Weapon sets:`');
    expect(r1a).toContain('`mcp__pob2__lookup_game_data {mode: "base", slot: <item type>, level?}`');
  });
});

describe("the tools' descriptions (C-56, §24.2)", () => {
  type Tool = { name: string; description: string; inputSchema: unknown };
  const tools: Record<string, Tool> = Object.fromEntries((getLuaToolSchemas() as Tool[]).map((t) => [t.name, t]));

  it('list_gems takes skill_type, a string, and its description says what it keeps', () => {
    const props = (tools.list_gems.inputSchema as { properties: Record<string, { type: string; description: string }> }).properties;
    expect(props.skill_type.type).toBe('string');
    expect(props.skill_type.description).toMatch(/PoB skill type, by name, case ignored/);
    expect(props.skill_type.description).toMatch(/an unknown name fails and lists PoB's skill types/);
    expect(tools.list_gems.description).toMatch(/skill_type lists the gems whose skill has one of PoB's skill types, such as 'Travel'/);
    expect(tools.list_gems.description.length).toBeLessThanOrEqual(2048);
  });

  it("compile_plan's description names a group's weapon set", () => {
    expect(tools.compile_plan.description).toContain("its skill groups each on weapon set 1, 2 or both (a group's weaponSet)");
    expect(tools.compile_plan.description.length).toBeLessThanOrEqual(2048);
  });
});

describe('plan-reference.md documents the weapon set, skillOutputsSet2, travel and empty-weapon-set (D-426, D-427)', () => {
  const ref = folded(read('docs', 'build-guide', 'plan-reference.md'));

  it('the field row, the version note, the slots and the record key', () => {
    expect(ref).toMatch(/\| `stages\[\]\.skills\.groups\[\]\.weaponSet` \| `1` or `2` \| no \| The weapon set the group is on/);
    expect(ref).toContain("(M-22, D-426) a group's weapon set, `weaponSet` (`stages[].skills.groups[]`)");
    expect(ref).toContain('sockets it in the set\'s main-hand slot (`Weapon 1` for set 1, `Weapon 1 Swap` for set 2');
    expect(ref).toContain('the record gains `stages.<id>.skillOutputsSet2` beside `skillOutputs`');
    expect(ref).toContain('keyed as `skillOutputs` is');
    expect(ref).toContain("V1 reports a group on a set whose weapon slots are both empty as `empty-weapon-set`");
    // WU-101's sentence that a plan's group names no slot is revised.
    expect(ref).not.toContain("A plan's group names no slot");
  });

  it("the clear measure's travel", () => {
    expect(ref).toContain('**`clearSpeed.travel`** (D-427) is the stage\'s travel skill, beside the movement speed: `{group, skill, usesPerSecond}`');
    expect(ref).toContain('It is `null` when the stage has no such skill.');
  });
});
