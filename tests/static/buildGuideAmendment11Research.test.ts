/**
 * Amendment 11 (M-24), WU-114: AC-W90, the research and verification docs, one assertion each, and the rules of the
 * sections behind it (D-436, D-442 to D-445, §19, Appendix A) in the skill text.
 *
 * - `references/stages/R1b.md`: verification's three checks (it compiles, the named source deals the card's damage,
 *   each piece in does something), `damage-missing` failing the attempt and retried, the four answers of Pieces
 *   measured, and the verdict file's `pieces[]` (D-436).
 * - `templates/dossier-template.md`: Appendix A's nine columns, and the Status values `viable` and `viable, except`.
 * - `references/checkpoints.md`: the verification gate with no figure and Appendix A's line under the cards; the
 *   pricing retry question (D-444); the interview's name rule (D-442).
 * - the card template, `R1a-synthesize.md`, `R1a.md`, `R1a-assemble.md`: the name rule, main skill then ascendancy.
 * - `stages/RV.md` deleted, and no reference or agent definition runs a rival; describing an older run's rival is
 *   allowed (D-443, §19).
 * - `R1a.md`: published guides allowed and cited with the `external` marker (D-445).
 * - `references/pricing.md`: the stop until a gate's retry, its trade-site scope, and players' currency words (D-442,
 *   D-444).
 *
 * The values are read from the amendment itself (its sections and Appendix A) and from the run scripts' own
 * constants, so the docs are held to the spec and to what the scripts accept, not to their own wording.
 */
import { describe, expect, it } from '@jest/globals';
import fs from 'fs';
import path from 'path';

const REPO = path.resolve(__dirname, '..', '..');
const SKILL_DIR = path.join(REPO, '.claude', 'skills', 'build-guide');
const REFS = path.join(SKILL_DIR, 'references');
const STAGES = path.join(REFS, 'stages');
const AGENTS = path.join(REPO, '.claude', 'agents');

const read = (file: string) => (fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '');
/** Line breaks and their indentation folded to one space, so a rule wrapped over lines reads whole. */
const folded = (text: string) => text.replace(/\s*\n\s*/g, ' ');
const stage = (name: string) => folded(read(path.join(STAGES, `${name}.md`)));
const ref = (name: string) => folded(read(path.join(REFS, name)));
const rawRef = (name: string) => read(path.join(REFS, name));

/** The text from `start` to the next `end` after it ('' when `start` is missing). */
function between(text: string, start: string, end: string): string {
  const at = text.indexOf(start);
  if (at < 0) return '';
  const to = text.indexOf(end, at + start.length);
  return to < 0 ? text.slice(at) : text.slice(at, to);
}

const SPEC = read(path.join(REPO, 'docs', 'build-guide', 'spec', 'amendment-11-live-test-fixes.md'));
const section = (title: string) => folded(between(SPEC, `\n## ${title}`, '\n## '));
const APPENDIX = SPEC.slice(SPEC.indexOf('## Appendix A. Formats'));
const appendixPart = (title: string) => between(APPENDIX, `### ${title}`, '\n### ');
const RUN_LOG = read(path.join(SKILL_DIR, 'scripts', 'run-log.mjs'));
const CHECK_RUN = read(path.join(SKILL_DIR, 'scripts', 'check-run.mjs'));
/** A script's `export const <name> = '<text>';` or a quoted array's items. */
const scriptString = (text: string, name: string) => new RegExp(`(?:export )?const ${name} = '([^']+)';`).exec(text)?.[1] ?? '';
const scriptList = (text: string, name: string): string[] => JSON.parse((new RegExp(`(?:export )?const ${name} = (\\[[^\\]]*\\]);`).exec(text)?.[1] ?? '[]').replace(/'/g, '"'));

// ---------------------------------------------------------------------------------------------------
// What the spec fixes, read from the amendment
// ---------------------------------------------------------------------------------------------------

/** Appendix A's dossier header and the Status values its first bullet lists. */
const DOSSIER_HEADER = /`(\| Card \|[^`]*\|)`/.exec(appendixPart('The dossier'))?.[1] ?? '';
const DOSSIER_STATUS = folded(appendixPart('The dossier'));
/** Appendix A's four answers of a Pieces measured row, and the verdict file's drops. */
const MEASURED = folded(appendixPart('Pieces measured (the card)'));
const ANSWERS = [...(/the last cell (.*?); `in` rows only/.exec(MEASURED)?.[1] ?? '').matchAll(/`([^`]+)`/g)].map((m) => m[1]);
const PIECES_VERDICT = /`(pieces: \[\{[^`]+\}\])`/.exec(MEASURED)?.[1] ?? '';
/** Appendix A's line under the verification display's cards. */
const NUMBERS_LINE = /Under the cards: `([^`]+)`/.exec(appendixPart('The verification display, one card'))?.[1] ?? '';
/** §12's retry question and its two answers (Appendix A's run log). */
const RETRY_QUESTION = /\("(Pricing stopped at [^"]+)"\)/.exec(section('12. D-444: pricing stops until the user approves a retry, and prices more items'))?.[1] ?? '';
const RETRY_ANSWERS = [...(/answer: "([^"]+)" \| "([^"]+)"/.exec(folded(appendixPart('The run log (additions)'))) ?? []).slice(1)];
/** §10's example name (a few words of the build's own, then the main skill, then the ascendancy). */
const NAME_EXAMPLE = /like the user's "([^"]+)"/.exec(section("10. D-442: the gates' words"))?.[1] ?? '';

describe('amendment 11 fixes the values these checks read', () => {
  it('reads the dossier header, the four answers, the verdict drops, the numbers line, the retry question and the name example', () => {
    expect({ DOSSIER_HEADER, ANSWERS, PIECES_VERDICT, NUMBERS_LINE, RETRY_QUESTION, RETRY_ANSWERS, NAME_EXAMPLE }).toEqual({
      DOSSIER_HEADER: '| Card | Round | Status | Synergy | Damage | Pieces | Key prices | League | Main risk |',
      ANSWERS: ['yes', 'no', "PoB can't see it", 'not measured (<why>)'],
      PIECES_VERDICT: 'pieces: [{key, figure, dropPercent}]',
      NUMBERS_LINE: 'Numbers come at the design gate, measured on the full build.',
      RETRY_QUESTION: 'Pricing stopped at <step> after <outcome>: retry?',
      RETRY_ANSWERS: ['retry-pricing', 'no-retry'],
      NAME_EXAMPLE: 'Reaping Bonfire Detonate Dead Blood Mage',
    });
    // The scripts agree with the spec on what the docs teach.
    expect(scriptString(RUN_LOG, 'NUMBERS_LATER')).toBe(NUMBERS_LINE);
    expect(scriptList(RUN_LOG, 'RETRY_ANSWERS')).toEqual(RETRY_ANSWERS);
    expect(scriptList(CHECK_RUN, 'DOSSIER_COLUMNS_A11')).toEqual(DOSSIER_HEADER.slice(1, -1).split('|').map((c) => c.trim()));
  });
});

// ---------------------------------------------------------------------------------------------------
// AC-W90, one assertion each
// ---------------------------------------------------------------------------------------------------

/** A doc split into units: each paragraph, list item and table row, its wrapped lines joined; fences kept whole. */
function units(text: string): string[] {
  const out: string[] = [];
  let cur: string[] = [];
  const flush = () => {
    if (cur.length > 0) out.push(cur.join(' ').replace(/\s+/g, ' ').trim());
    cur = [];
  };
  for (const line of text.split(/\r?\n/)) {
    if (line.trim() === '') flush();
    else if (/^\s*(?:[-*]|\d+\.)\s|^\s*\||^#/.test(line)) {
      flush();
      cur.push(line);
    } else cur.push(line);
  }
  flush();
  return out;
}
/** Every Markdown file under a folder, recursively. */
const markdownUnder = (dir: string): string[] =>
  fs.existsSync(dir) ? fs.readdirSync(dir, { recursive: true, withFileTypes: true }).filter((e) => e.isFile() && e.name.endsWith('.md')).map((e) => path.join(e.parentPath, e.name)) : [];
/** A mention of the rival, its stage or its card id. */
const RIVAL = /\brival\b|\bRV\b|r<[jk]>-x-<n>/;
/** A unit that describes an older run's rival, or its removal, runs none (§19, D-443). */
const OLD_RUNS = /before amendment 11|older run|older log|D-443|removed/i;
/**
 * WU-115's `patterns.md` line 34 (§16, AC-W91: "patterns.md, its line 34 included"), not this unit's file: exempt by
 * its words only, so the exemption ends when WU-115 rewrites the line.
 */
const WU115_PATTERNS_LINE = 'D1-build again after a conversion, a keystone or a limit named as a con, and the rival';

describe('AC-W90 (WU-114): the research and verification docs, one assertion each', () => {
  it("R1b.md states the three checks, damage-missing with its retry, the four answers and the verdict file's pieces[]", () => {
    const r1b = stage('R1b');
    expect({
      threeChecks: /R1b makes \*\*three checks\*\*: 1\. \*\*It compiles:\*\* .* 2\. \*\*The named source deals the card's damage:\*\* .* 3\. \*\*Each piece in does something:\*\*/.test(r1b),
      damageMissingRetried: /`damage-missing` finding fails the attempt though the skeleton compiled, and the runner re-runs it within the counted retries; after them the card is `failed` with that finding/.test(r1b),
      fourAnswers: ANSWERS.length === 4 && ANSWERS.every((a) => r1b.includes(`- \`${a.replace(/ \(<why>\)$/, '')}`) || r1b.includes(`\`${a}\``)) && r1b.includes('| Key | Left out by | Does something |'),
      piecesInVerdict: r1b.includes(`\`pieces\` (D-436), on a composite whose leave-one-outs ran: \`${PIECES_VERDICT.replace(/^pieces: /, '')}\``),
    }).toEqual({ threeChecks: true, damageMissingRetried: true, fourAnswers: true, piecesInVerdict: true });
  });

  it('the dossier template has the new columns and the Status values `viable` and `viable, except`', () => {
    const template = read(path.join(SKILL_DIR, 'templates', 'dossier-template.md'));
    const header = template.split('\n').find((l) => l.startsWith('| Card |'));
    const statuses = template.split('\n').filter((l) => /^\| r\d/.test(l)).map((l) => l.slice(1, -1).split('|')[2].trim());
    expect({ header, viable: DOSSIER_STATUS.includes('`viable`, `viable, except <what>`') && statuses.some((st) => /^<viable, or viable, except <piece> does nothing in PoB/.test(st)) }).toEqual({ header: DOSSIER_HEADER, viable: true });
  });

  it('checkpoints.md\'s verification gate shows no figures and says "Numbers come at the design gate"; it asks the pricing retry question', () => {
    const raw = rawRef('checkpoints.md');
    const gate = folded(between(raw, '## The verification gate', '\n## '));
    const question = folded(between(raw, '## The pricing question', '\n## '));
    expect({
      noFigure: /\*\*with no figure\*\*: no damage, life, EHP, clear-speed or movement-speed number/.test(gate) && !/`TotalEHP`|`Life`|Count-scaled|`MinionTotalDPS`|measured clear speed/.test(gate),
      numbersLine: gate.includes(`Under the cards, one line: \`${NUMBERS_LINE}\``),
      retryQuestion: question.includes(`ask \`${RETRY_QUESTION}\``) && RETRY_ANSWERS.every((a) => question.includes(`**\`${a}\`**`)),
    }).toEqual({ noFigure: true, numbersLine: true, retryQuestion: true });
  });

  it("the card template, R1a-synthesize.md, R1a.md, R1a-assemble.md and checkpoints.md's interview state the name rule (main skill, then ascendancy)", () => {
    const texts: Record<string, string> = {
      'card-template.md': folded(read(path.join(SKILL_DIR, 'templates', 'card-template.md'))),
      'R1a-synthesize.md': stage('R1a-synthesize'),
      'R1a.md': stage('R1a'),
      'R1a-assemble.md': stage('R1a-assemble'),
      "checkpoints.md's interview": folded(between(rawRef('checkpoints.md'), '## The interview', '\n## The unsaved-build question')),
    };
    const rule = (t: string) => /a few words of the build's own, then (?:the|its) main skill.{0,80}, then the ascendancy/.test(t) && t.includes(NAME_EXAMPLE);
    expect(Object.entries(texts).filter(([, t]) => !rule(t)).map(([f]) => f)).toEqual([]);
  });

  it('RV.md is gone; no doc under .claude/skills/build-guide/references/ or .claude/agents/ runs a rival', () => {
    const running = [...markdownUnder(REFS), ...markdownUnder(AGENTS)].flatMap((file) =>
      units(read(file))
        .filter((u) => RIVAL.test(u) && !OLD_RUNS.test(u) && !(path.basename(file) === 'patterns.md' && u.includes(WU115_PATTERNS_LINE)))
        .map((u) => `${path.relative(REPO, file)}: ${u.slice(0, 120)}`),
    );
    expect({ rvGone: !fs.existsSync(path.join(STAGES, 'RV.md')), running }).toEqual({ rvGone: true, running: [] });
  });

  it('R1a.md allows published guides with the `external` marker', () => {
    expect(stage('R1a')).toMatch(/\*\*Published guides are allowed, and cited\*\* \(D-445\)\. Online, you may read published build guides on the hosts your agent definition allows, for facts and ideas\. A card that draws on one names it in its Evidence, `Reference build: <the guide's title>, external \| <url> \| accessed: YYYY-MM-DD \| confidence: <H\|M\|L>`, the `external` marker/);
  });

  it("pricing.md states the stop until a gate's retry, its trade-site scope and players' currency words", () => {
    const pricing = ref('pricing.md');
    expect({
      stopUntilRetry: /\*\*The stop holds until the user approves a retry at a gate\.\*\*/.test(pricing) && pricing.includes(RETRY_QUESTION) && RETRY_ANSWERS.every((a) => pricing.includes(`\`${a}\``)),
      tradeSiteScope: /\*\*While a stop is open, no step makes a trade-site request:\*\* .* \*\*poe\.ninja's exchange stays allowed\*\* .*, so every item the currency exchange sells keeps its price/.test(pricing),
      playersWords: /\*\*In players' words\*\* \(D-442\)\. .* "exalt" and "exalts", never the trade id `exalted`; "divine" and "divines"; "chaos"\. .* \*\*A price whose range rounds to 0\.0 divines\*\* is shown as seen, with no conversion: `1 exalt \(seen 2026-10-24\)`/.test(pricing),
    }).toEqual({ stopUntilRetry: true, tradeSiteScope: true, playersWords: true });
  });
});

// ---------------------------------------------------------------------------------------------------
// The sections behind AC-W90, as the docs carry them (WU-114's §16 row)
// ---------------------------------------------------------------------------------------------------

describe("amendment 11's research and verification rules in the docs (WU-114)", () => {
  it("D-436: R1b's verdict carries its damage part, and the dossier's Damage and Pieces cells follow Appendix A's examples", () => {
    const r1b = stage('R1b');
    // The verdict part the run checker reads (check-run.mjs: `verdict.damage`, the code `damage-missing`).
    expect(CHECK_RUN).toContain("const DAMAGE_MISSING = 'damage-missing';");
    expect(r1b).toMatch(/`verdict\.damage` \(D-436\), once the last compile succeeded: `pass` when the named source shows every kind of damage the card names, `fail` when one shows nothing, with one finding per such kind, `\{part: "damage", code: "damage-missing"/);
    // Appendix A's Damage cell and Pieces cell, in R1b-assemble's words.
    const damage = /`Damage`: the named source and the kinds PoB shows for it, `([^`]+)`/.exec(DOSSIER_STATUS)?.[1] ?? '';
    const pieces = [...(/`Pieces`: of the `in` pieces probed, `([^`]+)`, or `([^`]+)`/.exec(DOSSIER_STATUS) ?? [])].slice(1);
    expect(damage).toBe('Detonate Dead: hit, bleed, ignite (rated at its hand-cast speed)');
    const assemble = stage('R1b-assemble');
    expect(assemble).toContain(damage);
    for (const p of pieces) expect({ p, written: assemble.includes(`\`${p}\``) }).toEqual({ p, written: true });
    // The card's Verified line carries the kinds, no figure (§4).
    expect(folded(read(path.join(SKILL_DIR, 'templates', 'card-template.md')))).toMatch(/### Verified - Compiled: .* - Damage: <the named source>: <the kinds PoB shows for it, .*\(modelled in PoB; no figure: numbers come at the design gate, D-436\)/);
  });

  it("D-436: the verification gate's block names what Appendix A's display shows, with no id", () => {
    const display = appendixPart('The verification display, one card');
    const gate = folded(between(rawRef('checkpoints.md'), '## The verification gate', '\n## '));
    // The display's lines, by their labels: Synergy, the pitch lines, Damage, Pieces, Key prices, Risks, PoB can't verify.
    for (const label of ['Synergy:', 'Damage:', 'Pieces:', 'Key prices:', 'Risks:', "PoB can't verify:"]) expect({ label, shown: display.includes(label) }).toEqual({ label, shown: true });
    for (const part of ['its synergy', 'pitch lines as written (Why pick it, How it clears, Bosses, Needs, The catch)', '`Damage:` the named source', '`Pieces:` on a composite', 'its key prices', 'its risks, what PoB can\'t verify', 'by its name (no id, D-392)']) expect({ part, shown: gate.includes(part) }).toEqual({ part, shown: true });
  });

  it("D-442: the brainstorm gate shows no out: line; D-445: a card drawn from a published guide says so", () => {
    const gate = folded(between(rawRef('checkpoints.md'), '## The brainstorm gate', '\n## '));
    expect(gate).toMatch(/with no `out:` line \(D-442: the card's `### Pieces` and the build's `pieces\.md` keep the out pieces and their reasons\)/);
    expect(gate).toMatch(/`drawn from <host>`, so the user can tell a known build from the pipeline's own \(D-445\)/);
    expect(RUN_LOG).toContain('drawn from ${');
    expect(ref('source-markers.md')).toMatch(/\*\*A published build guide\*\* \(D-445\) is an `external` source/);
  });

  it("D-444: pricing.md teaches the `exchange` outcome and names every pricing step; the stop's log entries are the script's", () => {
    const pricing = ref('pricing.md');
    const reporting = folded(between(rawRef('pricing.md'), '## Reporting the calls', '\n## '));
    expect(reporting).toContain(`**\`${scriptString(RUN_LOG, 'EXCHANGE')}\`** for a call \`mcp__pob2__get_item_price\` answered from poe.ninja's currency exchange`);
    expect(reporting).toMatch(/Count an exchange call as `exchange`, never as `ok`/);
    const steps = scriptList(RUN_LOG, 'PRICING');
    expect(steps).toEqual(['R1b', 'D1-build', 'D1-finish', 'D1-gate', 'D2']);
    expect(reporting).toContain('The pricing steps are R1b, D1-build (its `find_upgrades` calls), D1-finish, the D1 gate and D2.');
    // The stop's records, as run-log.mjs writes them (Appendix A's run log).
    expect(pricing).toMatch(/`pricing\.stops\[\] \{at, step, outcome\}`/);
    expect(pricing).toMatch(/`pricing\.retries\[\] \{checkpoint, answer, at\}`, `retry-pricing` or `no-retry`/);
    // The emotion-only exchange read is gone from the stop section.
    expect(between(rawRef('pricing.md'), '## After pricing stops', '\n## ')).not.toMatch(/for a Distilled Emotion, which reads/);
  });

  it("D-443, Appendix A: the task header, the stages README and the run folder carry no rival; run-folder.md lists trades.json", () => {
    expect(ref('task-header.md')).not.toMatch(/`RV`|rival/);
    expect(ref('stages/README.md')).not.toMatch(/RV\.md|rival/);
    expect(ref('run-folder.md')).toMatch(/\| `builds\/<id>\/trades\.json` \| D1-tree \(its `unmodelled` trades\) and D1-finish \(its `boots`, `defence` and `damage` trades\)/);
    expect(ref('task-header.md')).toMatch(/D1-tree's and D1-finish's `<buildFolder>\/trades\.json`/);
    // The build folder's files the run checker accepts include trades.json.
    expect(CHECK_RUN).toMatch(/const BUILD_TOP = \[[^\]]*'trades\.json'/);
  });

  it('§19: a dossier written before amendment 11 is rewritten in the nine columns, and its display keeps its older form', () => {
    expect(stage('R1b-assemble')).toMatch(/A dossier an earlier session wrote in an older form \(with figure columns, before amendment 11: the run was resumed since\) is rewritten in the nine columns/);
    expect(folded(between(rawRef('checkpoints.md'), '## The verification gate', '\n## '))).toMatch(/\*\*A dossier written before amendment 11\*\* \(a resumed older run's, read by its header, §19\) keeps its older display/);
  });
});
