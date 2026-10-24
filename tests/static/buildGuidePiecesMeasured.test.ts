/**
 * Amendment 10 (M-23), WU-106: AC-W85, R1b measuring each piece inside its composite, the dossier's key pieces, the
 * brainstorm gate's composites and the runner's step 2b, in the skill text (D-429, D-432, D-433).
 *
 * - `references/stages/R1b.md`: a composite (any card with `### Pieces`) and its skeleton, every piece in, a scheduled
 *   piece in its own group (a boss button `single_target`, a skill on one weapon set with `weaponSet`), a second clear
 *   group kept `clear`; the three kinds of figure (per second for clear, per corpse, for bosses), never summed across
 *   groups; which pieces (up to 4 in, never the named source or its enabler, least certain first); leaving a piece out
 *   by its kind, a left-out skill as 0; the checklist's probes before the leave-one-outs within the cap of 8, a cut
 *   probe `not measured (<why>)`; a larger clear group as `A stronger structure?` in `### Structure check`; an
 *   unmodelled piece's `estimate (<reason>)`; `### Pieces measured` in Appendix A's form, even when R1b failed after
 *   its structure check; a plain card's 4 probes and no tables.
 * - `references/stages/R1b-assemble.md` and `templates/dossier-template.md`: the twelfth column `key pieces`, only on
 *   a composite run.
 * - `references/checkpoints.md`: the brainstorm gate shows the composites, the obvious build's line and every plain
 *   card; `verify` takes composites or cards by number or name; `changes` add or drop pieces; a gate-made card's
 *   `from` names cards, composites and piece keys; `first-n` picks composites; R1a-synthesize, R1a-assemble kept for
 *   older runs.
 * - `SKILL.md`: step 2b and §2 name `R1a-synthesize`, with its return and the run log's `shortReason`.
 *
 * The formats are read from the amendment's Appendix A and the run scripts' own constants, so the skill text is held
 * to the spec and to what the checker accepts; one script check runs the checker on R1b's own example table.
 */
import { describe, it, expect, afterAll } from '@jest/globals';
import { spawnSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';

const REPO = path.resolve(__dirname, '..', '..');
const SKILL_DIR = path.join(REPO, '.claude', 'skills', 'build-guide');
const STAGES_DIR = path.join(SKILL_DIR, 'references', 'stages');
const SCRIPTS = path.join(SKILL_DIR, 'scripts');
const SPEC = path.join(REPO, 'docs', 'build-guide', 'spec', 'amendment-10-synthesis.md');

const read = (file: string) => (fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '');
/** One paragraph or list item per entry, with its line breaks folded, so a rule split over lines reads whole. */
const folded = (text: string) => text.replace(/\s*\n\s*/g, ' ');
const rawStage = (name: string) => read(path.join(STAGES_DIR, `${name}.md`));
const stage = (name: string) => folded(rawStage(name));
const rawRef = (name: string) => read(path.join(SKILL_DIR, 'references', name));
const ref = (name: string) => folded(rawRef(name));
const SKILL_RAW = read(path.join(SKILL_DIR, 'SKILL.md'));
const SKILL = folded(SKILL_RAW);
const CHECK_RUN = read(path.join(SCRIPTS, 'check-run.mjs'));
const RUN_LOG = read(path.join(SCRIPTS, 'run-log.mjs'));
const spec = read(SPEC);
const appendix = spec.slice(spec.indexOf('## Appendix A. Formats'));

/** The text between `start` and the next `end` after it ('' when either is missing). */
function between(text: string, start: string, end: string): string {
  const at = text.indexOf(start);
  if (at < 0) return '';
  const to = text.indexOf(end, at + start.length);
  return to < 0 ? text.slice(at) : text.slice(at, to);
}

/** The first fenced block after `marker` in `text`, without its fences. */
function blockAfter(text: string, marker: string): string {
  const at = text.indexOf(marker);
  if (at < 0) throw new Error(`no ${JSON.stringify(marker)}`);
  const m = /```\n([\s\S]*?)\n```/.exec(text.slice(at));
  if (!m) throw new Error(`no fenced block after ${JSON.stringify(marker)}`);
  return m[1];
}

/** A script constant's value, `const <name> = <n>;` or `export const <name> = '<text>';`. */
function scriptConst(text: string, name: string): string {
  const m = new RegExp(`(?:export )?const ${name} = '?([^';]+)'?;`).exec(text);
  if (!m) throw new Error(`no const ${name}`);
  return m[1];
}

/** Appendix A's kinds of piece, and the Pieces measured table's header rows. */
const KINDS = (() => {
  const m = /`<kind>` is one of ((?:`[a-z]+`(?:, | or )?)+)/.exec(folded(appendix));
  if (!m) throw new Error("Appendix A doesn't list the kinds of piece");
  return [...m[1].matchAll(/`([a-z]+)`/g)].map((k) => k[1]);
})();
const MEASURED_HEADER = blockAfter(appendix, 'after `### Key item prices`').split('\n').slice(2, 4);
/** A Drops item in Appendix A's form: `<group> (<clear | per corpse | boss>) −<x>%`. */
const DROP_ITEM = /^\S.*\((?:clear|per corpse|boss)\) [−+]?\d+%$/;

const R1B_RAW = rawStage('R1b');
const R1B = folded(R1B_RAW);
/** R1b's section on a composite's pieces, up to the verification half. */
const PIECES_SECTION = between(R1B_RAW, "## A composite's pieces (D-433)", "## The card's verification half");

describe('AC-W85 (WU-106, D-433): R1b builds a composite\'s skeleton and measures each piece inside it', () => {
  it('a composite is any card with `### Pieces`; a plain card keeps 4 probes and no Pieces tables', () => {
    expect(R1B).toContain('On a **composite** (any card with `### Pieces`, whatever its id letter');
    expect(R1B).toContain('A plain card (no `### Pieces`) keeps 4 and has no Pieces tables');
    expect(R1B).toMatch(/its probes, `n` from 1 to 4 \(D-338\), to 8 on a composite \(D-433\)/);
    // The checker's caps, which R1b's numbers must equal (WU-105).
    expect(scriptConst(CHECK_RUN, 'PROBE_CAP')).toBe('4');
    expect(scriptConst(CHECK_RUN, 'COMPOSITE_PROBE_CAP')).toBe('8');
    expect(scriptConst(CHECK_RUN, 'LEAVE_ONE_OUT')).toBe('4');
  });

  it('the skeleton carries every piece in, a scheduled piece in its own group: a boss button single_target, a weapon set\'s skill with weaponSet', () => {
    const step4 = folded(between(R1B_RAW, '4. **Write the skeleton**', '5. **Validate**'));
    expect(step4).toMatch(/\*\*A composite's skeleton\*\* \(D-433\) carries \*\*every piece its `### Pieces` table has `in` or `scheduled`\*\*/);
    expect(step4).toMatch(/\*\*a scheduled piece in its own group\*\*: a boss button, a group with role `single_target`; a skill on one weapon set, a group with `weaponSet: <n>` \(amendment 9 §24\.2, D-426\), its figure from the record's `skillOutputs`, or `skillOutputsSet2` on set 2/);
    expect(step4).toMatch(/\*\*A second clear group keeps role `clear`\*\* and stays below the named source \(the D1 gate's `rolled-not-largest` check, as today\)/);
    expect(step4).toContain('A piece out stays out.');
  });

  it('measures three kinds of figure, per second for clear, per corpse and for bosses, never summed across groups', () => {
    expect(PIECES_SECTION).not.toBe('');
    // The section sits after the checklist and before the verification half.
    const h2 = R1B_RAW.split('\n').filter((l) => l.startsWith('## ')).map((l) => l.slice(3));
    const at = (t: string) => h2.findIndex((x) => x.startsWith(t));
    expect(at('Verification checklist')).toBeGreaterThan(0);
    expect(at("A composite's pieces")).toBe(at('Verification checklist') + 1);
    expect(at("The card's verification half")).toBe(at("A composite's pieces") + 1);
    const text = folded(PIECES_SECTION);
    expect(text).toContain('**The measure: three kinds of figure, never summed across groups.**');
    expect(text).toMatch(/`g<group>s<skill>p<statSet>` for the group's main active skill and stat set/);
    expect(text).toMatch(/\*\*Per second, for clear:\*\* each enabled `clear` group's figure, the named damage source's first, Count-scaled \(`countedSkillOutputs`/);
    expect(text).toMatch(/\*\*Per corpse:\*\* each of PoB's own on-kill groups \(a corpse explosion .*\): its hit, `AverageDamage` .*, and its ignite, `IgniteDPS`/);
    expect(text).toMatch(/\*\*For bosses:\*\* each enabled `single_target` group's figure/);
    expect(text).toMatch(/`skillOutputs`, or `skillOutputsSet2` for a group with `weaponSet: 2`/);
    expect(text).toContain('**Never add figures across groups**');
    expect(text).toContain("PoB's Full DPS still counts the named source only (D-337)");
    // The verification half keeps the figures apart too.
    expect(R1B).toMatch(/On a composite, that line names each figure of the measure, group by group: `Clear: <figure, its group>, for each clear group\. Per corpse: <hit and ignite, its group>\. Boss: <figure, its group>, for each boss group\. Kept separate, never summed\.`/);
  });

  it('leaves each kind of piece out its own way, a skill left out counting as 0', () => {
    const text = folded(PIECES_SECTION);
    expect(text).toContain('**Leaving a piece out,** by its kind, each probe a copy of the skeleton with that one change');
    // One rule per kind of Appendix A, by D-433's words.
    const BY_KIND: Record<string, string> = {
      skill: 'a **skill**: its group disabled (`enabled: false`)',
      support: 'a **support**: removed from its group',
      unique: "a **unique**: the slot's plain base of the same base type",
      mod: "a **rare's mod line**: removed from the item",
      node: 'a **node**: removed with every node that depends on it',
      keystone: 'a **keystone**: removed, with every custom modifier that stands for its mechanic',
      rune: 'a **rune**: removed from the item',
      config: 'a **config condition**: turned off',
    };
    expect(Object.keys(BY_KIND).sort()).toEqual([...KINDS].sort());
    for (const [kind, rule] of Object.entries(BY_KIND)) expect({ kind, ruled: text.includes(rule) }).toEqual({ kind, ruled: true });
    expect(text).toMatch(/\*\*A skill left out counts as 0\*\*: the compile measures every group as the main skill, a disabled one included, .* its drop on its own figure is −100%/);
    expect(text).toMatch(/other pieces among them are named in `How`/);
  });

  it('probes up to 4 pieces in, never the named source or its enabler, the least certain value first', () => {
    const text = folded(PIECES_SECTION);
    expect(text).toMatch(/\*\*Which pieces:\*\* up to 4 of the Pieces table's `in` rows, never the named damage source or its enabler/);
    const order = ['1. a piece the skeleton stands for with a custom modifier', '2. a layer on another group', "3. an ailment's carrier", "4. then the rest in the table's row order, the synthesis's own"].map((p) => text.indexOf(p));
    expect(order.every((i) => i > 0)).toBe(true);
    expect(order).toEqual([...order].sort((a, b) => a - b));
  });

  it("runs the checklist's probes before the leave-one-outs, within the cap of 8; a probe a failed compile cuts is `not measured (<why>)`", () => {
    const budget = folded(between(R1B_RAW, '**The probe budget.**', '## '));
    expect(budget).toMatch(/\*\*A composite's cap is 8\*\* \(D-433\): the checklist's 4 first, in this order, then the 4 leave-one-out probes/);
    expect(budget).toContain('A checklist probe left unrun frees no fifth leave-one-out.');
    expect(R1B).toMatch(/up to 4 per card \(D-292\), and up to 8 on a composite: the checklist's 4, then 4 leave-one-out probes \(D-433\)/);
    const text = folded(PIECES_SECTION);
    expect(text).toMatch(/\*\*The order and the cap:\*\* the checklist's probes 5–8 first, then the leave-one-outs, at most 8 in all\. A probe a failed compile cuts is `not measured \(<why>\)`/);
    expect(text).toContain("`not measured (the probe's compile failed: <the error>)`");
    expect(text).toMatch(/or the skeleton's, which cuts every row \(`not measured \(the skeleton didn't compile: <the first error>\)`/);
    // Step 8: the leave-one-outs come after the checklist, before the verification half.
    expect(R1B).toMatch(/run the verification checklist \(below\), on a composite then its leave-one-out probes \("A composite's pieces"\), then write the card's verification half/);
  });

  it('records a larger clear group as a stronger structure, the last line of `### Structure check`', () => {
    const stronger = scriptConst(RUN_LOG, 'STRONGER');
    const check = folded(between(R1B_RAW, '**The structure check** (D-406)', '1. **Tree targets.**'));
    expect(check).toContain(`\`- ${stronger} <the group's skill> as the named source\` (D-433)`);
    expect(check).toMatch(/compare each other enabled `clear` group's figure with the named damage source's/);
    expect(check).toMatch(/the user may make that card at the verification gate \(D-391\), and the next round's synthesis composes the structure/);
    expect(check).toContain('The section has one such line, its last');
  });

  it("marks an unmodelled piece's figure an estimate, never a ledger entry", () => {
    const text = folded(PIECES_SECTION);
    expect(text).toMatch(/\*\*A piece PoB doesn't model\*\* .*Battershout's detonation shows no DPS\): no probe\. Its Drops is the card's hand estimate, `estimate \(<reason>: <the figure it moves, about how much>\)`, never a ledger entry: a skeleton has no ledger/);
  });

  it("writes `### Pieces measured` in Appendix A's form, even when the attempt failed after its structure check", () => {
    const example = blockAfter(PIECES_SECTION, '```').split('\n');
    expect(example[0]).toBe('### Pieces measured');
    expect(example.slice(2, 4)).toEqual(MEASURED_HEADER);
    const rows = example.slice(4).map((l) => l.slice(1, -1).split('|').map((c) => c.trim()));
    expect(rows.length).toBeGreaterThan(1);
    for (const [, drops] of rows) {
      const ok = /^not measured \(.+\)$/.test(drops) || /^estimate \(.+\)$/.test(drops) || drops.split('; ').every((d) => DROP_ITEM.test(d));
      expect({ drops, ok }).toEqual({ drops, ok: true });
    }
    expect(folded(PIECES_SECTION)).toMatch(/\*\*`### Pieces measured`\*\* \(Appendix A\), in the verification half after `### Key item prices`, one row per piece left out/);
    expect(R1B).toMatch(/\*\*Whenever you write a composite's `### Structure check`, write its `### Pieces measured` before the verdict too\*\*, whatever happens after: a piece no probe measured is `not measured \(<why>\)`/);
    expect(R1B).toMatch(/- \*\*Pieces measured\*\*, on a composite only, after the key item prices: .* even when the attempt failed after its structure check/);
    expect(R1B).toMatch(/on a composite, then its pieces measured, `pieces <n> measured \(<n> not measured\)`/);
  });

  it('a gate change may add or drop a composite\'s pieces, and a card made from pieces is a composite (D-432)', () => {
    expect(R1B).toMatch(/\*\*A piece added or dropped on a composite\*\* \(D-432\), a revision whose words name a piece by its name or key \("add Blood Magic", "drop i1b-4"\): move the piece's `### Pieces` row/);
    expect(R1B).toMatch(/A dropped piece is `out`, Where `—`, Why `dropped at the gate \(visit <visit>\): <the user's words>`/);
    expect(R1B).toMatch(/\*\*A card made at the gate from pieces\*\* \(D-432\): when `from` names a piece key \(a Pieces row's or an Ideas line's\) or a composite, the new card is a composite/);
  });
});

describe("AC-W85 (WU-106, D-433): the dossier's twelfth column, `key pieces`, on a composite run only", () => {
  const template = read(path.join(SKILL_DIR, 'templates', 'dossier-template.md'));
  const header = (template.split('\n').find((l) => l.startsWith('| Card |')) ?? '').slice(1, -1).split('|').map((c) => c.trim());
  const checker = (name: string): string[] => JSON.parse((new RegExp(`export const ${name} = (\\[[^\\]]*\\]);`).exec(CHECK_RUN)?.[1] ?? '[]').replace(/'/g, '"'));

  it('the template has `key pieces`, last and lower case, the run checker\'s D-433 list; an older run keeps eleven', () => {
    expect(header[header.length - 1]).toBe('key pieces');
    expect(header).toEqual(checker('DOSSIER_COLUMNS_D433'));
    expect(header.slice(0, -1)).toEqual(checker('DOSSIER_COLUMNS_D407'));
    expect(folded(template)).toContain('A run whose brainstorm rounds R1a-assemble dealt keeps the first eleven columns, with no "key pieces"; the run checker rejects twelve there.');
  });

  it("R1b-assemble writes the twelve on a composite run, eleven on an older one, and each composite's measured pieces with their largest drops", () => {
    const text = stage('R1b-assemble');
    expect(text).toMatch(/On a composite run, its twelve columns exactly, in order: .* `Main risk`, `key pieces` \(D-433, in lower case, as written\)\. On a run whose brainstorm rounds R1a-assemble dealt, the first eleven, without `key pieces`: the run checker rejects twelve there/);
    expect(text).toMatch(/a \*\*composite run\*\* is one whose brainstorm rounds R1a-synthesize composed \(D-429\), its deck `cards\.md` opening with `## What the composites share`/);
    expect(text).toMatch(/its \*\*key pieces\*\* \(D-433\), from the card's Pieces measured: for a composite, each piece the table holds, by name, with its largest drop and the figure it falls on, `<piece> −<x>% \(<the group's skill>, <clear \| per corpse \| boss>\)`/);
    expect(text).toContain("A plain card's is `—`.");
    expect(text).toMatch(/and in its key pieces on a composite run/);
  });
});

describe('AC-W85 (WU-106, D-432): the brainstorm gate shows composites, takes piece changes, and piece keys in `from`', () => {
  const raw = rawRef('checkpoints.md');
  const gate = folded(between(raw, '## The brainstorm gate: pick cards to verify', '## The verification gate'));

  it('is shown after R1a-synthesize, R1a-assemble kept for runs whose first round used it', () => {
    expect(gate).toMatch(/Shown after every brainstorm round's R1a-synthesize \(D-429\), which composes the round's builds; in a run whose first brainstorm round ran R1a-assemble, after its R1a-assemble \(D-287\), for every later round too/);
    expect(gate).toMatch(/say so, with the reason R1a-synthesize gave, which the run log keeps as its `shortReason`/);
  });

  it('shows each composite with its pieces in short, then the obvious build\'s line, then every plain card\'s name and structure', () => {
    const order = [
      'then **each composite** not verified yet, numbered',
      'then its pieces in short, `in:`, `scheduled:` (each with where it goes) and `out:` (each with its reason in a few words)',
      "then **the obvious build's line**, the baseline as its card was written (D-403)",
      "then **every plain card's name and structure**, one line each, numbered on",
    ].map((p) => gate.indexOf(p));
    expect(order.every((i) => i > 0)).toBe(true);
    expect(order).toEqual([...order].sort((a, b) => a - b));
    // The display's own piece lines (run-log.mjs, Appendix A).
    for (const line of ['`  in: ${', '`  scheduled: ${', '`  out: ${']) expect({ line, printed: RUN_LOG.includes(line) }).toEqual({ line, printed: true });
  });

  it('verify takes 1–3 composites or cards by number or name; changes add or drop pieces; from names cards, composites and piece keys', () => {
    expect(gate).toMatch(/\*\*verify\*\* 1–3 composites or cards \(D-432\), picked and made at the gate together, each named by its number or its name/);
    expect(gate).toMatch(/\*\*`changes` on a picked composite\*\* may add or drop pieces, by name or key \("add Blood Magic", "drop i1b-4"\)/);
    expect(gate).toMatch(/\*\*A gate-made card's `from`\*\* may name cards, composites and piece keys: a `### Pieces` row's key, or an Ideas line's id/);
    expect(gate).toMatch(/One that draws on pieces \(a piece key, or a composite\) is a composite, with Pieces tables and leave-one-out probes/);
    expect(ref('checkpoints.md')).toMatch(/In a run that composes \(D-432\), `from` may also name piece keys/);
  });

  it('first-n picks the first n composites, never a superseded one or a plain card', () => {
    const row = raw.split('\n').find((l) => l.startsWith('| brainstorm gate |')) ?? '';
    expect(row).toMatch(/`first-n:<n>` \(`n` 1–3\) is the first `n` composites `cards\.md`'s `## Round <k>` lines list, not verified yet, in the deck's order, never a superseded composite or a plain card \(D-429\)/);
    expect(row).toMatch(/in a run that deals \(R1a-assemble\), the first `n` dealt cards not verified yet/);
  });
});

describe('AC-W85 (WU-106, D-429): SKILL.md names R1a-synthesize, its return and the short round', () => {
  it('step 2b is R1a-synthesize; R1a-assemble only for runs whose first round used it', () => {
    expect(SKILL_RAW).toContain('| 2b | R1a-synthesize | `build-guide-coordinator` |');
    expect(SKILL).toMatch(/- \*\*R1a-synthesize\*\* \(2b, D-429\), after the round's researchers, composes the round's builds, the composites; a run whose first brainstorm round ran \*\*R1a-assemble\*\* \(it deals cards\) keeps that step for every later round/);
    expect(SKILL).not.toMatch(/- \*\*R1a-assemble\*\* \(2b\)/);
  });

  it("its return is R1a-synthesize.md's, and the short round's reason goes into the run log as shortReason", () => {
    expect(SKILL).toContain('It returns `composites: <n>`, a line `r<k>-s-<n>: <name>` per composite, then `cards: <n> listed | not composed: <n> | superseded: <n>`.');
    const synth = stage('R1a-synthesize');
    expect(synth).toContain('`composites: <n>`, then one line per composite of the round, `r<k>-s-<n>: <name>`, then `cards: <n> listed | not composed: <n> | superseded: <n>`');
    expect(SKILL).toMatch(/\*\*A short round\*\*: it returns `short: <why>`; record the reason in the run log, as `shortReason` on its `stages\[\]` entry/);
  });

  it('the brainstorm gate verifies composites or cards, a composite\'s changes adding or dropping pieces, a new card from pieces', () => {
    expect(SKILL).toMatch(/Answers: \*\*verify\*\* 1–3 composites or cards, picked \(a composite's changes may add or drop pieces\) or made at the gate \(its `from` cards, composites or piece keys, D-432; step 3\)/);
  });
});

describe("AC-W85 (WU-106): the run checker accepts R1b's own Pieces measured example on a composite run (script check)", () => {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'pieces-measured-'));
  afterAll(() => fs.rmSync(TMP, { recursive: true, force: true }));

  it("R1b.md's example rows, keyed to the fixture composite's pieces, and a larger clear group's stronger-structure line pass check-run", () => {
    const dir = path.join(TMP, 'run-composite');
    fs.cpSync(path.join(REPO, 'tests', 'fixtures', 'pipeline', 'run-composite'), dir, { recursive: true });
    const cardFile = path.join(dir, 'cards', 'r1-s-1.md');
    const card = fs.readFileSync(cardFile, 'utf8');
    // R1b.md's example, its keys mapped onto r1-s-1's Pieces rows (Blistering Bond is i1b-1 there).
    const example = blockAfter(PIECES_SECTION, '```').replace(/\bi1b-4\b/g, 'i1b-1');
    const measured = /### Pieces measured\n\n[\s\S]*?(?=\n\n|\n?$)/.exec(card);
    expect(measured).not.toBeNull();
    let edited = card.replace(measured![0], example);
    const structure = /### Structure check\n\n((?:- .*\n)+)/.exec(edited);
    expect(structure).not.toBeNull();
    edited = edited.replace(structure![0], `### Structure check\n\n${structure![1]}- A stronger structure? Seismic Cry as the named source\n`);
    fs.writeFileSync(cardFile, edited);
    const r = spawnSync(process.execPath, [path.join(SCRIPTS, 'check-run.mjs'), dir], { cwd: TMP, env: { PATH: '/usr/bin:/bin', LANG: 'C' }, encoding: 'utf8', timeout: 30000 });
    const violations = String(r.stderr).split('\n').filter((l) => l.startsWith('check-run: ['));
    expect({ violations, code: r.status }).toEqual({ violations: [], code: 0 });
  });
});
