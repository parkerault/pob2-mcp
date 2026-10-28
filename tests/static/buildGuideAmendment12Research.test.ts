/**
 * Amendment 12 (M-25), WU-124: AC-W96, the research docs, one assertion each, and the rules of the sections behind it
 * (D-451, D-452, D-456, D-457, D-458; §19's row) in the skill text.
 *
 * - `templates/card-template.md`: the Pitch's `Defence:` line (the base family, the layers by role, what holds the
 *   Arbiter's physical hit, names only), the Chain's `Means:` line, and a Needs line with no respec clause.
 * - `references/stages/R1a.md`: questions 20–24, and the `Defence:` line written from the class's attributes.
 * - `references/stages/R1a-synthesize.md`: question 22 for a brief that leaves the ascendancy open, with the split or
 *   successor rule (step 5); question 19's gloss as §13 rewrites it.
 * - `references/stages/R1b.md`: checklist item 2 cites PoB's per-hit chance or buildup, and the 5-hit rule.
 * - `references/stages/R1a-assemble.md`, the researcher's definition: the card fields the deal checks, the questions.
 *
 * The values are read from the amendment itself (§6, §7, §11, §12, §13), so the docs are held to the spec, not to their
 * own wording.
 */
import { describe, expect, it } from '@jest/globals';
import fs from 'fs';
import path from 'path';

const REPO = path.resolve(__dirname, '..', '..');
const SKILL_DIR = path.join(REPO, '.claude', 'skills', 'build-guide');
const STAGES = path.join(SKILL_DIR, 'references', 'stages');

const read = (file: string) => (fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '');
/** Line breaks and their indentation folded to one space, so a rule wrapped over lines reads whole. */
const folded = (text: string) => text.replace(/\s*\n\s*/g, ' ');
const rawStage = (name: string) => read(path.join(STAGES, `${name}.md`));
const stage = (name: string) => folded(rawStage(name));

/** The text from `start` to the next `end` after it ('' when `start` is missing). */
function between(text: string, start: string, end: string): string {
  const at = text.indexOf(start);
  if (at < 0) return '';
  const to = text.indexOf(end, at + start.length);
  return to < 0 ? text.slice(at) : text.slice(at, to);
}

const SPEC = read(path.join(REPO, 'docs', 'build-guide', 'spec', 'amendment-12-defence-and-design.md'));
const rawSection = (n: number) => between(SPEC, `\n## ${n}. `, '\n## ');
const section = (n: number) => folded(rawSection(n));

// ---------------------------------------------------------------------------------------------------
// What the spec fixes, read from the amendment
// ---------------------------------------------------------------------------------------------------

/** §6 (D-451): the card's `Defence:` line, its roles; the bases' attribute families; the family rule. */
const DEFENCE_LINE = /\*\*The card's `Defence:` line\*\* \([^)]*\): (the base family), the layers by role \(([^)]+)\) and (what holds the Arbiter's physical hit)\. (Names only)/.exec(section(6));
const ROLES = (DEFENCE_LINE?.[2] ?? '').split(', ');
const BASES = [...(/`base` one of ((?:`[^`]+`(?:, )?)+)/.exec(section(6))?.[1] ?? '').matchAll(/`([^`]+)`/g)].map((m) => m[1]);
const FAMILY_RULE = /\*\*The family follows the class's attributes\*\* \([^)]*\): (strength for armour, [^.]*?a hybrid base)\./.exec(section(6))?.[1] ?? '';
/** §12 (D-457): the card's `Means:` line. */
const MEANS_FORM = /a `Means:` line in the Chain, `([^`]+)`/.exec(section(12))?.[1] ?? '';
/** §13 (D-458): the new section's title, questions 20–24 by number and name, question 22's rule, question 19's text. */
const SECTION_TITLE = /a new section "([^"]+)"/.exec(section(13))?.[1] ?? '';
const QUESTIONS = [...rawSection(13).matchAll(/^- \*\*(2[0-4]), ([^*]+)\*\* \(/gm)].map((m) => [Number(m[1]), m[2]] as [number, string]);
const Q22 = folded(between(rawSection(13), '- **22, ', '\n- **23, '));
const Q22_OPEN = /for (briefs that leave the ascendancy open)/.exec(Q22)?.[1] ?? '';
const Q22_PARTS = /: for each candidate ascendancy, (which notables feed the build's layers), (which only defend), (which are dead); when another feeds clearly more, compose a (split) or (successor) card\. (R1a-synthesize asks it in step 5)\./.exec(Q22);
const Q19 = /Its text: "19\. (.*?)"\./.exec(section(13))?.[1] ?? '';
/** §11 (D-456, D8): what R1b's checklist item 2 cites, and the 5-hit rule. */
const D8 = /\*\*Ailment uptime from PoB's figures\*\* \(D8, R1b's checklist item 2[^)]*\): an earned ailment condition's uptime cites (PoB's per-hit chance or buildup) against the rung's enemy, read from the record's `outputs` where PoB computes it for the main skill \(`([^`]+)`, `(CalcOffence\.lua`:[\d–]+)\), else from `([a-z_]+)`; a `judgment` from the gem text only where neither shows it .*?more than (\d+) on the (Pinnacle boss) is a risk and starts the wall rule/.exec(section(11));

describe('amendment 12 fixes the values these checks read', () => {
  it('reads the Defence line, the bases, the family rule, the Means form, the questions, question 19 and D8', () => {
    expect({
      defence: DEFENCE_LINE?.slice(1),
      ROLES,
      BASES,
      FAMILY_RULE,
      MEANS_FORM,
      SECTION_TITLE,
      QUESTIONS,
      Q22_OPEN,
      q22: Q22_PARTS?.slice(1),
      Q19,
      d8: D8?.slice(1),
    }).toEqual({
      defence: ['the base family', 'chance, mitigation, pool', "what holds the Arbiter's physical hit", 'Names only'],
      ROLES: ['chance', 'mitigation', 'pool'],
      BASES: ['armour', 'evasion', 'energy shield', 'armour/evasion', 'armour/energy shield', 'evasion/energy shield'],
      FAMILY_RULE: 'strength for armour, dexterity for evasion, intelligence for energy shield, two attributes for a hybrid base',
      MEANS_FORM: '<payoff>: <means>; second means <means | none found>',
      SECTION_TITLE: 'Brainstorm questions 20–24: defence, pools and buttons',
      QUESTIONS: [
        [20, 'defence layers'],
        [21, 'empty pools'],
        [22, 'ascendancy fit'],
        [23, 'shared scaling'],
        [24, 'buttons, upkeep and proxies'],
      ],
      Q22_OPEN: 'briefs that leave the ascendancy open',
      q22: ["which notables feed the build's layers", 'which only defend', 'which are dead', 'split', 'successor', 'R1a-synthesize asks it in step 5'],
      Q19: "Bosses. What does the build press on a boss? When the clear skill is capped by a limit or shaped for packs, name the boss button. (Spud's Warcryer: Hammer of the Gods on its own weapon set)",
      d8: ["PoB's per-hit chance or buildup", '<Ailment>ChancePerHit', 'CalcOffence.lua`:4949–5061', 'lua_get_stats', '5', 'Pinnacle boss'],
    });
  });
});

// ---------------------------------------------------------------------------------------------------
// What the docs hold
// ---------------------------------------------------------------------------------------------------

const TEMPLATE = read(path.join(SKILL_DIR, 'templates', 'card-template.md'));

/** A card section's top-level items `- <Field>: <text>`, each with its indented lines joined (the comment stripped). */
function items(text: string, h3: string): Map<string, string> {
  const lines = text.replace(/<!--[\s\S]*?-->/g, '').split('\n');
  const at = lines.findIndex((l) => l.trim() === `### ${h3}`);
  const out = new Map<string, string>();
  let key: string | null = null;
  for (const l of lines.slice(at + 1)) {
    if (/^#{1,3}\s/.test(l)) break;
    const top = /^- (?:\[[^\]]*\] )?([A-Z][^:]*?): (.*)$/.exec(l);
    if (top) {
      key = top[1];
      out.set(key, top[2]);
    } else if (key && /^\s+\S/.test(l)) out.set(key, `${out.get(key)} ${l.trim()}`);
    else key = null;
  }
  return out;
}

/** R1b's checklist item `n`, its first paragraph, folded. */
function checklistItem(n: number): string {
  const raw = rawStage('R1b');
  const checklist = between(raw, '## Verification checklist', '\n## ');
  const item = between(checklist, `\n${n}. **`, `\n${n + 1}. **`);
  return folded(item.split(/\n\s*\n/)[0] ?? '');
}

/** R1a-synthesize's step 5, folded. */
const SYNTH_STEP_5 = folded(between(rawStage('R1a-synthesize'), '5. **Compose each structure.**', '6. **Under-played labels**'));

describe('AC-W96 (WU-124): the research docs, one assertion each', () => {
  it("the card template has Defence: (base family, layers by role, what holds the Arbiter's physical hit, names only) and Means:, and its Needs line no respec clause", () => {
    const pitch = items(TEMPLATE, 'Pitch');
    const chain = items(TEMPLATE, 'Chain');
    const defence = pitch.get('Defence') ?? '';
    const fields = [...pitch.keys()];
    expect({
      // §6's parts in the Defence line: the base family from the class's attributes, each base, each role, the hit.
      defenceMissing: [
        'base family',
        "class's attributes",
        ...BASES,
        ...ROLES.map((r) => `${r}: <`),
        DEFENCE_LINE![3].replace(/^what holds /, ''),
        DEFENCE_LINE![4],
      ].filter((part) => !defence.toLowerCase().includes(part.toLowerCase())),
      // After The catch, so the display's five pitch lines keep their order.
      defenceAfterCatch: fields.indexOf('Defence') === fields.indexOf('The catch') + 1,
      means: (chain.get('Means') ?? '').startsWith(MEANS_FORM),
      needsRespec: /respec/i.test(pitch.get('Needs') ?? 'respec'),
    }).toEqual({ defenceMissing: [], defenceAfterCatch: true, means: true, needsRespec: false });
  });

  it("R1a asks questions 20–24 and writes the defence line from the class's attributes", () => {
    const r1a = stage('R1a');
    const asks = between(r1a, '**Questions 20–24** (D-458)', '**Then the committed game data**');
    const defence = between(r1a, '- **Defence** (D-451)', '- **Chain, Enabler and Links:**');
    expect({
      section: asks.includes(`the library's section "${SECTION_TITLE}"`) && /asked of every card after 1–19/.test(asks),
      unasked: QUESTIONS.filter(([n, name]) => !asks.includes(`**${n}, ${name}`)).map(([n]) => n),
      defenceLine: /the Pitch's `Defence:` line answers question 20 from the class's attributes/.test(defence) && defence.includes(FAMILY_RULE),
    }).toEqual({ section: true, unasked: [], defenceLine: true });
  });

  it('R1a-synthesize asks question 22 for an open ascendancy, with the split or successor rule', () => {
    const q22 = between(SYNTH_STEP_5, '- **22, ascendancy fit,**', '**A conflict that can');
    const [, feed, defend, dead, split, successor] = Q22_PARTS!;
    expect({
      inTheQuestions: /the pattern library's brainstorm questions 15 to 19 \(D-431\), and question 22 for a brief that leaves the ascendancy open \(D-458\)/.test(SYNTH_STEP_5),
      openOnly: /^- \*\*22, ascendancy fit,\*\* only when the prompt's `brief` leaves the ascendancy open: for each candidate ascendancy/.test(q22),
      parts: [feed.replace("the build's", "the composite's"), defend, dead].every((p) => q22.includes(p)),
      rule: q22.includes(`When another feeds clearly more, compose a **${split}** or a **${successor}** card on it`),
    }).toEqual({ inTheQuestions: true, openOnly: true, parts: true, rule: true });
  });

  it("R1b's checklist item 2 cites PoB's per-hit chance or buildup and the 5-hit rule", () => {
    const item2 = checklistItem(2);
    const [, cites, field, lines, tool, hits, boss] = D8!;
    expect({
      cites: item2.includes(`**An earned ailment condition**`) && item2.includes(`cites ${cites} against the skeleton's enemy`),
      source: item2.includes(`\`${field}\``) && item2.includes(lines) && item2.includes(`\`mcp__pob2__${tool}\``) && item2.includes('a `judgment` from the gem text only where neither shows it'),
      fiveHits: item2.includes(`**The ${hits}-hit rule:** more than ${hits} on the ${boss} is a \`risk\``),
    }).toEqual({ cites: true, source: true, fiveHits: true });
  });
});

// ---------------------------------------------------------------------------------------------------
// The sections behind AC-W96, as the docs carry them (WU-124's §19 row)
// ---------------------------------------------------------------------------------------------------

describe("amendment 12's research rules in the docs (WU-124)", () => {
  it("§13 (P6): R1a-synthesize's gloss of question 19 is the question's own text, for every build", () => {
    // The text without its "Bosses." label and its example, as the gloss gives it.
    const gloss = Q19.replace(/^Bosses\. /, '').replace(/\s*\([^)]*\)$/, '');
    expect(gloss).toBe('What does the build press on a boss? When the clear skill is capped by a limit or shaped for packs, name the boss button.');
    expect(SYNTH_STEP_5).toContain(`- **19, bosses:** ${gloss.charAt(0).toLowerCase()}${gloss.slice(1)}`);
  });

  it('§13: the library holds the section R1a cites, with questions 20–24 by those names (needs WU-123)', () => {
    const library = read(path.join(SKILL_DIR, 'references', 'patterns.md'));
    const body = between(library, `\n## ${SECTION_TITLE}\n`, '\n## ');
    expect({
      section: body.length > 0,
      missing: QUESTIONS.filter(([n, name]) => !new RegExp(`^${n}\\. ${name}\\b`, 'im').test(body)).map(([n]) => n),
    }).toEqual({ section: true, missing: [] });
  });

  it('§12 (D-457): R1a writes the Means lines; a composite carries them and its Defence line', () => {
    expect(stage('R1a')).toContain(`**Means** (D-457, question 2): the Chain's \`Means:\` lines, one per load-bearing payoff, \`${MEANS_FORM}\`, each payoff named apart from the means that supply it`);
    const writes = folded(between(rawStage('R1a-synthesize'), '## Writes', '**`### Pieces`**'));
    expect(writes).toMatch(/Its `Defence:` line as `R1a\.md` writes it, from the class's attributes, names only \(D-451\); its Needs names no respec \(D-452\)/);
    expect(writes).toMatch(/its `Means:` lines, each payoff apart from its means, with a second means from the pool or `none found` \(D-457\)/);
    // A split's or a successor's ascendancy passes the identity check a card's does.
    expect(writes).toMatch(/A split's or a successor's ascendancy is question 22's, checked as step 3 checks a card's/);
  });

  it("§6, §12: the deal's sniff test isn't held back by a card's Defence line or a second means (R1a-assemble step 3)", () => {
    const sniff = folded(between(rawStage('R1a-assemble'), '3. **The sniff test**', '\n4. **'));
    expect(sniff).toMatch(/Neither does the card's `Defence:` line \(D-451\) or a `Means:` line's second means \(D-457\): they are leads for the design, not links the payoff rests on, and a card written before amendment 12 has neither/);
  });

  it('§7 (D-452): no research doc asks a card for a respec', () => {
    const texts: Record<string, string> = {
      'card-template.md': folded(TEMPLATE),
      'R1a.md': stage('R1a'),
      'R1a-synthesize.md': stage('R1a-synthesize'),
      'R1a-assemble.md': stage('R1a-assemble'),
      'R1b.md': stage('R1b'),
    };
    // Each mention of a respec says the card names none.
    const asking = Object.entries(texts).flatMap(([file, text]) =>
      [...text.matchAll(/[^.]*\brespec[^.]*\./gi)].map((m) => m[0].trim()).filter((s) => !/names no\s+respec/.test(s)).map((s) => `${file}: ${s}`),
    );
    expect(asking).toEqual([]);
    expect(stage('R1a')).toMatch(/\*\*Needs\*\* names no respec: players respec freely, so each loadout gets its own tree \(D-452\)/);
  });

  it("§13: the researcher's definition asks the questions, 20–24 among them", () => {
    const researcher = folded(read(path.join(REPO, '.claude', 'agents', 'build-guide', 'build-guide-researcher.md')));
    expect(researcher).toMatch(/ask its brainstorm questions of every card, 20–24 among them \(defence, pools and buttons, D-458\), so each card's `Defence:` line follows its class's attributes/);
    expect(SECTION_TITLE.endsWith(': defence, pools and buttons')).toBe(true);
  });
});
