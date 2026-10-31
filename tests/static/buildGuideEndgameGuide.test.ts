/**
 * Amendment 9 (M-21), WU-97's bullets of AC-W77: the endgame guide and the two stage references that write and
 * verify it.
 *
 * - `templates/guide-endgame-template.md` (D-414): its twelve H2s, in amendment 9 §8's order, with the H3 Checks
 *   under each Endgame H2 and Known issues ending What PoB can't show; Switching over (about 250 words: the level
 *   the build works from and what sets it, the ascendancy order from its claim, the reward picks by their first
 *   line, the respec with no gold cost); the 2,300-word cap with budgets of about 2,100; the rungs' sections the
 *   same as the full template's, so the run checker's verdict-line and Checks rules hold for both.
 * - `references/stages/W1.md`: the template from the plan (no campaign stage, the endgame guide), the guide in the
 *   build's folder (`buildFolder`, D-412), Switching over's sources, and the campaign mode (D-415), the one case
 *   where W1 writes the guide anew outside a first pass.
 * - `references/stages/V4.md`: the build's folder, the guide held to the template its plan decides, the ascendancy
 *   order's claim checked against `ascendancyNodes` (D-413), and the campaign pass (D-415): stage `V4-campaign`,
 *   `check: "campaign"`, its H1, numbering and `## Checked`.
 *
 * The H2 list, the word figures and the campaign pass's names are read from the amendment itself where it states
 * them, so the files are held to the spec rather than to their own text.
 */
import { describe, it, expect } from '@jest/globals';
import fs from 'fs';
import path from 'path';

const REPO = path.resolve(__dirname, '..', '..');
const SKILL_DIR = path.join(REPO, '.claude', 'skills', 'build-guide');
const ENDGAME_TEMPLATE = path.join(SKILL_DIR, 'templates', 'guide-endgame-template.md');
const FULL_TEMPLATE = path.join(SKILL_DIR, 'templates', 'guide-template.md');
const STAGES_DIR = path.join(SKILL_DIR, 'references', 'stages');
const SPEC = path.join(REPO, 'docs', 'build-guide', 'spec', 'amendment-9-endgame-first.md');
const CHECKER = path.join(SKILL_DIR, 'scripts', 'check-run.mjs');

const read = (file: string) => (fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '');
/** One paragraph or list item per entry, with its line breaks folded, so a rule split over lines reads whole. */
const folded = (text: string) => text.replace(/\s*\n\s*/g, ' ');
const readStage = (stage: string) => read(path.join(STAGES_DIR, `${stage}.md`));

/** Headings outside fenced blocks, with their line numbers. */
function headings(text: string): { level: number; title: string; line: number }[] {
  const out: { level: number; title: string; line: number }[] = [];
  let fenced = false;
  text.split(/\r?\n/).forEach((line, i) => {
    if (/^\s*(```|~~~)/.test(line)) fenced = !fenced;
    else if (!fenced) {
      const h = /^(#{1,6})\s+(.*?)\s*$/.exec(line);
      if (h) out.push({ level: h[1].length, title: h[2], line: i });
    }
  });
  return out;
}

/** The lines of a heading's section, the heading included, up to the next heading of its level or above. */
function sectionOf(text: string, title: string, level = 2): string[] {
  const hs = headings(text);
  const lines = text.split(/\r?\n/);
  const h = hs.find((x) => x.level === level && x.title === title);
  if (!h) return [];
  const next = hs.find((x) => x.line > h.line && x.level <= h.level);
  return lines.slice(h.line, next?.line ?? lines.length);
}

/** The H3 titles under an H2. */
function h3sUnder(text: string, title: string): string[] {
  const hs = headings(text);
  const h2 = hs.find((h) => h.level === 2 && h.title === title);
  if (!h2) return [];
  const next = hs.find((h) => h.line > h2.line && h.level <= 2);
  return hs.filter((h) => h.level === 3 && h.line > h2.line && h.line < (next?.line ?? Infinity)).map((h) => h.title);
}

const commentOf = (text: string) => folded(/<!--([\s\S]*?)-->/.exec(text)?.[1] ?? '');

/** Every repository path a stage reference mentions in backticks, as the pipeline test reads them. */
function repoPaths(text: string): string[] {
  const found = new Set<string>();
  for (const m of text.matchAll(/`((?:\.claude|docs|data)\/[^`\s]*|pob-pin\.json)`/g)) found.add(m[1]);
  return [...found];
}

// ---------------------------------------------------------------------------------------------------
// Amendment 9 §8 and §9, as the spec states them
// ---------------------------------------------------------------------------------------------------

const spec = folded(read(SPEC));
const s8 = spec.slice(spec.indexOf('## 8. D-414: the endgame guide'), spec.indexOf('## 9. D-415'));
/** §8: "**Its H2s,** in order: At a glance; …; What PoB can't show (ending with Known issues); FAQ; Changelog." */
const SPEC_H2 = (/\*\*Its H2s,\*\* in order: (.*?)\. Leveling, Campaign route/.exec(s8)?.[1] ?? '')
  .split('; ')
  .map((t) => t.replace(/ \(ending with Known issues\)$/, '').trim())
  .filter((t) => t !== '');
const SPEC_CAP = Number((/\*\*at most ([\d,]+)\*\*/.exec(s8)?.[1] ?? 'NaN').replace(/,/g, ''));
const SPEC_BUDGET = Number((/about ([\d,]+) words of budget/.exec(s8)?.[1] ?? 'NaN').replace(/,/g, ''));
const SPEC_SWITCHING = Number(/\*\*Switching over\*\* \(about (\d+) words\)/.exec(s8)?.[1] ?? 'NaN');
const RUNG_H2 = ['Endgame: entering maps', 'Endgame: budget', 'Endgame: non-budget'];

describe('amendment 9 §8, as the test reads it', () => {
  it('names twelve H2s, the cap, the budget and Switching over\'s length', () => {
    expect(SPEC_H2).toHaveLength(12);
    expect(SPEC_H2).toContain('Switching over');
    expect(SPEC_H2).not.toContain('Leveling');
    expect(SPEC_CAP).toBe(2300);
    expect(SPEC_BUDGET).toBe(2100);
    expect(SPEC_SWITCHING).toBe(250);
  });
});

// ---------------------------------------------------------------------------------------------------
// AC-W77: templates/guide-endgame-template.md
// ---------------------------------------------------------------------------------------------------

describe('AC-W77 (WU-97, D-414): the endgame guide template', () => {
  const text = read(ENDGAME_TEMPLATE);
  const full = read(FULL_TEMPLATE);
  const hs = headings(text);
  const comment = commentOf(text);

  it('exists, with one H1 naming the roll and the twelve H2s of §8, in its order', () => {
    expect(fs.existsSync(ENDGAME_TEMPLATE)).toBe(true);
    expect(hs.filter((h) => h.level === 1).map((h) => h.title)).toEqual(['<Ascendancy> / <Skill>: <concept title>']);
    expect(hs.filter((h) => h.level === 2).map((h) => h.title)).toEqual(SPEC_H2);
    for (const gone of ['Leveling', 'Campaign route and rewards', 'Gem and ascendancy timing']) {
      expect({ gone, h2: hs.some((h) => h.title === gone) }).toEqual({ gone, h2: false });
    }
  });

  it("holds the run checker's endgame H2 list, once the checker has one (WU-94)", () => {
    const listed = /export const ENDGAME_GUIDE_H2 = (\[[\s\S]*?\]);/.exec(read(CHECKER));
    if (listed === null) return; // the checker of this lane predates WU-94's merge
    const items = [...listed[1].matchAll(/'([^']*)'|"([^"]*)"/g)].map((m) => m[1] ?? m[2]);
    expect(items).toEqual(SPEC_H2);
  });

  it('has the H3 Checks under each Endgame H2, and only there; What PoB can\'t show ends with the H3 Known issues; no other H3', () => {
    for (const title of RUNG_H2) expect({ title, h3: h3sUnder(text, title) }).toEqual({ title, h3: ['Checks'] });
    expect(h3sUnder(text, "What PoB can't show")).toEqual(['Known issues']);
    expect(hs.filter((h) => h.level === 3).map((h) => h.title).sort()).toEqual(['Checks', 'Checks', 'Checks', 'Known issues']);
    expect(comment).toMatch(/Under each Endgame H2, the H3 Checks, and no other H3\. What PoB can't show ends with the H3 Known issues/);
  });

  it('states the 2,300-word cap, counted as the full guide\'s is, and budgets of about 2,100 that every section states', () => {
    expect(comment).toContain(`At most ${SPEC_CAP.toLocaleString('en-US')} words, the H1, the import code and the Known issues list not counted (the full guide's cap stays 3,000).`);
    expect(comment).toContain(`The word counts below are each section's budget, about ${SPEC_BUDGET.toLocaleString('en-US')} in all.`);
    const stated = (title: string) => {
      const m = /About ([\d,]+) words/.exec(sectionOf(text, title).join('\n'));
      return m ? Number(m[1].replace(/,/g, '')) : null;
    };
    const budgets = SPEC_H2.map((title) => ({ title, words: stated(title) }));
    for (const b of budgets) expect({ title: b.title, stated: b.words !== null }).toEqual({ title: b.title, stated: true });
    const total = budgets.reduce((sum, b) => sum + (b.words ?? 0), 0);
    expect(total).toBe(SPEC_BUDGET);
    expect(total).toBeLessThanOrEqual(SPEC_CAP);
    expect(stated('Switching over')).toBe(SPEC_SWITCHING);
  });

  it('gives Switching over its four parts, in order, from the record, the claim and the campaign data (D-413, D-414)', () => {
    // The comment's rules.
    expect(comment).toMatch(/Switching over, about 250 words, says four things, in this order:/);
    expect(comment).toMatch(/level with any build of the class \(the card's Class\); the build works from level <m's requirements\.level in compile-record\.json>, because of <what sets it: m's requirements\.by\[\] in the record, an item \{kind: "item", name, slot\} by its name and slot, a gem \{kind: "gem", name, group, gemLevel\} by its name and gem level>/);
    expect(comment).toMatch(/the ascendancy, and the order to take its nodes: the order the plan's reason claim on m names them in \(D1-finish writes it, D-413\), with the reason it gives\. W1 reads no node ids/);
    expect(comment).toMatch(/each campaign reward pick the plan makes .* its quest, then the option by its first line exactly as data\/campaign\/progress\.json lists it \(the run checker looks for it in this section\), then the reason its claim gives\. Never list a choice's options without its pick/);
    expect(comment).toMatch(/for a respec, or a player switching from a levelling build: the PoB file holds the whole tree for each rung, so refund what the rung doesn't use; the gold cost isn't computed/);
    // The section's body, in the same order.
    const body = sectionOf(text, 'Switching over').join('\n');
    const at = (s: string) => body.indexOf(s);
    const parts = [
      'Level with any <the card\'s Class> build you like: this one works from level <m\'s requirements.level in compile-record.json>, because <what sets it',
      '**Ascendancy:** <the ascendancy>. I take its nodes in this order: <the nodes, in the order the plan\'s reason claim names them>',
      'take <the first line of the option the plan picks, exactly as data/campaign/progress.json lists it>; <the reason its claim gives>.',
      'the PoB file holds the whole tree for each rung, so refund every point the rung you move to doesn\'t use',
    ];
    for (const p of parts) expect({ part: p, present: at(p) >= 0 }).toEqual({ part: p, present: true });
    expect(parts.map(at)).toEqual([...parts.map(at)].sort((a, b) => a - b));
    expect(body).toMatch(/<That the gold cost isn't computed, since it depends on the tree you bring\.>/);
    expect(body).not.toMatch(/about <gold cost> gold/);
  });

  it('lists the three rung loadouts only in Your PoB file, with the full template\'s import code, versions, pricing and PoB notes', () => {
    expect(comment).toContain('Your PoB file lists the three rung loadouts only');
    const section = sectionOf(text, 'Your PoB file').join('\n');
    expect(section).toMatch(/```\n<importCode, copied exactly from compile-record\.json>\n```/);
    expect(section).toContain('Its loadouts, in order: <the entering-maps loadout name> when <its trigger> → <the budget loadout name> when <its trigger> → <the non-budget loadout name> when <its trigger>.');
    expect(section).not.toMatch(/first loadout name|<next loadout name>/);
    // Everything else in the section is the full template's.
    const rest = (t: string) => sectionOf(t, 'Your PoB file').filter((l) => !l.startsWith('The file is') && !/^\[About \d+ words\.\]$/.test(l));
    expect(rest(text)).toEqual(rest(full));
    const after = (t: string) => sectionOf(t, 'Your PoB file').find((l) => l.startsWith('The file is'))!.replace(/Its loadouts, in order: .*? The items are/, '');
    expect(after(text)).toBe(after(full));
  });

  it("keeps the full template's rung sections, so the checker's verdict lines and Checks blocks hold for both guides", () => {
    for (const title of ['Survival by stage', 'Priorities', 'Endgame: budget', 'Endgame: non-budget', 'How to play it', "What PoB can't show", 'FAQ']) {
      expect({ title, same: sectionOf(text, title).join('\n') === sectionOf(full, title).join('\n') }).toEqual({ title, same: true });
    }
    // Entering maps: no Epilogue to change from, the same buy order, anoint line and Checks block.
    const m = sectionOf(text, 'Endgame: entering maps').join('\n');
    expect(m).not.toMatch(/Epilogue/);
    expect(m).toMatch(/What the loadout holds when you switch to it, then the buy order toward a 5-divine target:>\s+1\. <the first buy>/);
    const tail = (t: string) => sectionOf(t, 'Endgame: entering maps').slice(sectionOf(t, 'Endgame: entering maps').findIndex((l) => l.startsWith('1. ')));
    expect(tail(text)).toEqual(tail(full));
    expect(m.split('\n').filter((l) => l.startsWith('Move here when')).length).toBe(1);
  });

  it('states the rules every section keeps: a game guide that renders the plan, first-person advice, each caveat once, not a tutorial, no campaign and no crafting', () => {
    expect(comment).toContain('It is a game guide, not a design document');
    expect(comment).toMatch(/The plan decides the template: no campaign stage \(every stage has a variant\), this one; else templates\/guide-template\.md, the full guide/);
    expect(comment).toMatch(/The guide renders the plan and the record: every fact and number is one they hold, rounded as a guide rounds it/);
    expect(comment).toMatch(/Advice is in the first person \("I", "my"\)/);
    expect(comment).toMatch(/Each caveat appears once, where the reader acts on it/);
    expect(comment).toMatch(/No markers, confidence labels, finding ids or pipeline words, and no stage ids outside loadout names/);
    expect(comment).toMatch(/Not a tutorial: .* If it would read as true word for word in a guide for another skill on another class, cut it/);
    expect(comment).toMatch(/no act route, no quest list beyond the reward picks, no levelling gems, gear or tree, and no crafting: the reader buys gear on trade/);
    expect(comment).toMatch(/No kill time and no hits to kill anywhere \(D-353\)/);
    expect(text).not.toMatch(/\[\^/);
    expect(text.replace(/<!--[\s\S]*?-->/, '')).not.toMatch(/[Cc]rafting|[Aa]tlas|regex/);
  });
});

// ---------------------------------------------------------------------------------------------------
// AC-W77: W1.md picks the template by the plan, and has its campaign mode
// ---------------------------------------------------------------------------------------------------

describe('AC-W77 (WU-97): W1 picks the template by the plan and has its campaign mode (D-412, D-414, D-415)', () => {
  const raw = readStage('W1');
  const w1 = folded(raw);

  it('picks the template from the plan, as the run checker does: no campaign stage, the endgame guide; else the full guide', () => {
    expect(w1).toMatch(/\*\*The template, from the plan\*\* \(D-414\), as the run checker decides it: a plan with no campaign stage \(every stage has a `variant`\) gets the endgame guide, `\.claude\/skills\/build-guide\/templates\/guide-endgame-template\.md`; any other plan the full guide, `\.claude\/skills\/build-guide\/templates\/guide-template\.md`/);
    expect(w1).toMatch(/Grep `plan\.json` for `"loadoutName"` \(one hit per stage\) and for `"variant":` \(one per endgame stage\); equal counts mean no campaign stage/);
    expect(w1).toMatch(/The run log's `builds\[\]` entry records the choice in its `guide` field \(`endgame` or `full`\)/);
    expect(w1).toMatch(/exactly the template's H2s, the full guide's fourteen or the endgame guide's twelve, in its order, and no other H2/);
    expect(w1).toMatch(/The endgame guide's cap is \*\*at most 2,300 words\*\*, counted the same way, and its budgets are about 2,100 in all \(D-414\)/);
  });

  it("writes the guide in the build's folder, the header's buildFolder (D-412)", () => {
    expect(w1).toContain('`buildFolder` (D-412)');
    expect(w1).toContain('`writes: ["<buildFolder>/guide.md", "<buildFolder>/audit.md"]`');
    expect(w1).toMatch(/the `guide\.md` you write, at `<buildFolder>\/guide\.md`/);
    expect(w1).toMatch(/`builds\/<id>`, or `\.` for a run migrated from schema 3/);
  });

  it("fills Switching over from m's requirements, the ascendancy order's claim and the reward picks, with no gold cost for the switch (D-413)", () => {
    expect(w1).toMatch(/\*\*Switching over\*\* \(the endgame guide only, D-413, D-414; about 250 words\)/);
    expect(w1).toMatch(/level with any build of the class \(the card's `Class`\); the build works from level `m`'s `requirements\.level` in the record, because of what sets it, its `requirements\.by\[\]`/);
    expect(w1).toMatch(/`m`'s `requirements` \(`\{level, by\[\]\}`: the level the build works from, and the items `\{kind: "item", name, slot\}` and gems `\{kind: "gem", name, group, gemLevel\}` that set it, D-413\)/);
    expect(w1).toMatch(/the nodes as the plan's `reason` claim on `m` names them, in its order, with the reason it gives\. You read no node ids/);
    expect(w1).toMatch(/the picked option by its first line exactly as `data\/campaign\/progress\.json` lists it \(the run checker looks for it in this section\)/);
    expect(w1).toMatch(/the PoB file holds the whole tree for each rung; refund what the rung doesn't use\. Say once, here, that the gold cost isn't computed/);
  });

  it('has the campaign mode: for a completed endgame build, the guide rewritten with the full template, the endgame text kept where the plan did not change it', () => {
    const titles = headings(raw).filter((h) => h.level === 2).map((h) => h.title);
    expect(titles).toContain('The campaign mode (D-415)');
    const mode = folded(sectionOf(raw, 'The campaign mode (D-415)').join('\n'));
    expect(mode).toMatch(/The user asked for the campaign of a `completed` build, which has the endgame guide/);
    expect(mode).toMatch(/You are in this mode when the plan has a campaign stage and the build's `guide\.md` is still the endgame guide \(it has the H2 `Switching over`\)/);
    expect(mode).toMatch(/\*\*This is the one case where you write the guide anew outside a first pass:\*\* it amends "You never write the guide anew" above for this mode only/);
    expect(mode).toMatch(/\*\*Write `guide\.md` whole, with Write,\*\* from the full template, `\.claude\/skills\/build-guide\/templates\/guide-template\.md`/);
    expect(mode).toMatch(/\*\*Keep the endgame sections' text where the plan didn't change them\.\*\*/);
    expect(mode).toMatch(/\*\*Write the campaign's sections\*\* as a first pass does/);
    expect(mode).toMatch(/A `file-only` build's campaign isn't this mode: it has no guide yet, so you write the full guide in a first pass/);
    // The fix round's rule names the exception, and the Writes section allows the one Write.
    expect(w1).toMatch(/You never write the guide anew: fix it in place with Edit \(the campaign mode, below, is the one exception, D-415\)/);
    expect(w1).toMatch(/except in the campaign mode, which writes it again with Write once \(D-415\)/);
  });

  it('mentions only repository paths that exist', () => {
    for (const p of repoPaths(raw)) {
      const cut = p.search(/[<*]/);
      const fixed = cut < 0 ? p : p.slice(0, p.lastIndexOf('/', cut) + 1);
      expect({ path: p, exists: fs.existsSync(path.join(REPO, fixed)) }).toEqual({ path: p, exists: true });
    }
  });
});

// ---------------------------------------------------------------------------------------------------
// AC-W77: V4.md has its campaign mode
// ---------------------------------------------------------------------------------------------------

describe('AC-W77 (WU-97): V4 reads the build\'s folder, holds the guide to its template, and has its campaign mode (D-412…D-415)', () => {
  const raw = readStage('V4');
  const v4 = folded(raw);

  it('§9 names the campaign pass as V4.md does: stage V4-campaign, check campaign, the campaign pass H1, the build\'s next report', () => {
    // The spec's own words (§9, step 4).
    expect(spec).toMatch(/stage `V4-campaign`, header `check: "campaign"`, report H1 `campaign pass of rounds\/<n>`, numbered as the build's next `reports\/V4-<n>\.md`/);
    // Amendment 13 (WU-133, D-477): the claims pass joins, stage V4-claims and check claims.
    expect(v4).toMatch(/`stage: "V4"` \(`"V4-campaign"` for the campaign pass, `"V4-claims"` for the claims pass\), `check` \(`full` or `recheck`, `campaign` for the campaign pass, or `claims` for the claims pass\)/);
    expect(v4).toMatch(/Then you run once in the \*\*campaign mode\*\*: header `stage: "V4-campaign"`, `check: "campaign"`, `writes` the build's next report, `reports\/V4-<n>\.md`/);
  });

  it('gives the campaign pass its H1 exactly, # V4-<n>: campaign pass of rounds/<n-1>, in the form the run checker reads', () => {
    expect(v4).toContain("The campaign pass's H1 is exactly `# V4-<n>: campaign pass of rounds/<n-1>`, `<n>` its number among the build's reports and `<n-1>` the round copy made before the campaign.");
    expect(v4).toMatch(/`check` is the header's \(`full`, `recheck`, `campaign` or `claims`\)/);
    expect(v4).toMatch(/Only a re-check or the campaign pass reports `fixed`/);
    // The run checker's H1 rule, once it reads the campaign pass (WU-94): an instance of the form passes it.
    const rule = /const h1 = (\/\^V4-[^\n]*?\$\/)\.exec\(rep\.h1/.exec(read(CHECKER));
    if (rule !== null && rule[1].includes('campaign pass')) {
      // The literal has no flags: its body between the slashes is the pattern.
      const re = new RegExp(rule[1].slice(1, -1));
      expect(re.test('V4-3: campaign pass of rounds/2')).toBe(true);
    }
  });

  it("checks, in one pass, the open findings again, the campaign stages' hinge claims and every item --changed lists, and lists every section line in ## Checked", () => {
    const titles = headings(raw).filter((h) => h.level === 2).map((h) => h.title);
    expect(titles).toContain('The campaign pass (D-415)');
    const pass = folded(sectionOf(raw, 'The campaign pass (D-415)').join('\n'));
    expect(pass).toMatch(/`changed` the lines `check-run\.mjs --changed <n-1>` printed/);
    expect(pass).toMatch(/\*\*`check: "campaign"`\*\*: one pass, which checks only 1\. each finding in the header's `findings`, as a re-check does/);
    expect(pass).toMatch(/2\. every hinge claim of the campaign stages \(the stages without a `variant`\), as the full pass checks a claim of its kind, whether or not `changed` lists it/);
    expect(pass).toMatch(/3\. each item of `changed`: a claim as the full pass checks a claim of its kind .* an H2 as the editor read checks it/);
    expect(pass).toMatch(/`## Checked` lists every item of `changed`, as the header gives it, every `section` line among them \(the run checker fails a campaign pass that misses one\), then each campaign hinge claim `changed` doesn't list/);
    expect(pass).toMatch(/The fix round and its re-check follow, as after the full pass; then the build's final gate/);
    expect(v4).toMatch(/`changed`: a re-check or the campaign pass: the lines `check-run\.mjs --changed <n-1>` printed/);
    expect(v4).not.toMatch(/`changed: "all"`/);
  });

  it("reads the build's folder and writes its report there, numbered per build (D-412)", () => {
    expect(v4).toMatch(/`buildFolder` \(the build's folder under `runFolder`, `builds\/<id>`, or `\.` for a run migrated from schema 3; D-412\)/);
    expect(v4).toMatch(/`writes`: `\["<buildFolder>\/reports\/V4-<n>\.md"\]`/);
    expect(v4).toMatch(/The build's files are in its folder, `<runFolder>\/<buildFolder>`: `plan\.json`, `compile-record\.json`, `guide\.md`, its reports `reports\/V4-<n>\.md` and its round copies `rounds\/<n>\/`/);
  });

  it('holds the guide to the template its plan decides, and checks the ascendancy order\'s claim against ascendancyNodes (D-413, D-414)', () => {
    expect(v4).toMatch(/\*\*The guide's H2s are its template's\*\* \(D-414\), the template the plan decides, as the run checker does: the endgame guide's twelve for a plan with no campaign stage, the full guide's fourteen for any other, exactly and in its order/);
    expect(v4).toContain('`.claude/skills/build-guide/templates/guide-endgame-template.md`');
    expect(v4).toContain('`.claude/skills/build-guide/templates/guide-template.md`');
    expect(v4).toMatch(/\*\*the ascendancy order's\*\* \(D-413\), D1-finish's claim on `m` that names the ascendancy's nodes in the order to take them\. It names every node of `m`'s `ascendancyNodes`, in that array's order, and no other/);
    expect(v4).toMatch(/`mcp__pob2__search_tree_nodes` `\{ascendancy: "<the roll's ascendancy>"\}`/);
    expect(v4).toMatch(/\*\*Switching over\*\* \(the endgame guide, D-413, D-414\): .* `m`'s `requirements\.level` in the record/);
  });

  it('mentions only repository paths that exist, and never audit.md (D-355)', () => {
    for (const p of repoPaths(raw)) {
      const cut = p.search(/[<*]/);
      const fixed = cut < 0 ? p : p.slice(0, p.lastIndexOf('/', cut) + 1);
      expect({ path: p, exists: fs.existsSync(path.join(REPO, fixed)) }).toEqual({ path: p, exists: true });
    }
    expect(raw).not.toMatch(/audit\.md/);
  });
});
