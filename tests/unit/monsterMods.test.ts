/**
 * WU-86 (D-402, AC-W72, script unit): `scripts/monster-mods.mjs --from <folder>` parses poe2db's Monster_Modifiers and
 * Tame_Beast pages, saved in a folder, and writes the rare monster modifier table. Spawned as a real `node` process on
 * handwritten fixture pages in the pages' HTML structure (`tests/fixtures/poe2db/monsters/`): each name's rows join
 * into one block with its lines (game text quoted, an internal stat id marked), URL, keyword, kind and keep flag (on
 * Tame_Beast's list), and its judgment (model, reach, Creates and Pays off on) in the vocabulary. The script reads
 * saved pages only: it never fetches.
 */
import { describe, it, expect, afterAll } from '@jest/globals';
import { spawnSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { blockProblems, creates, NO_LINES, parseMonsterTable, readVocabulary, type MonsterBlock } from '../helpers/monsterTable';

const REPO = path.resolve(__dirname, '..', '..');
const SCRIPT = path.join(REPO, '.claude', 'skills', 'build-guide', 'scripts', 'monster-mods.mjs');
const FIXTURES = path.join(REPO, 'tests', 'fixtures', 'poe2db', 'monsters');
const VOCABULARY = readVocabulary(path.join(REPO, 'data', 'rules', 'vocabulary.md'));
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'monster-mods-'));

afterAll(() => fs.rmSync(TMP, { recursive: true, force: true }));

function run(...args: string[]) {
  const r = spawnSync(process.execPath, [SCRIPT, ...args], { cwd: TMP, env: { PATH: '/usr/bin:/bin', LANG: 'C' }, encoding: 'utf8', timeout: 30000 });
  return { code: r.status, stdout: r.stdout, stderr: r.stderr };
}
let n = 0;
const outFile = () => path.join(TMP, `out-${++n}`, 'monster-mods.md');
/** A copy of the fixture pages, one of them edited. */
function editedFixtures(page: 'Monster_Modifiers' | 'Tame_Beast', edit: (html: string) => string): string {
  const dir = path.join(TMP, `pages-${++n}`);
  fs.cpSync(FIXTURES, dir, { recursive: true });
  const file = path.join(dir, `${page}.html`);
  fs.writeFileSync(file, edit(fs.readFileSync(file, 'utf8')));
  return dir;
}

describe('AC-W72 (WU-86): the monster-modifier script on fixture pages', () => {
  const out = outFile();
  const r = run('--from', FIXTURES, '--out', out, '--date', '2026-10-18');
  const text = r.code === 0 ? fs.readFileSync(out, 'utf8') : '';
  const table = r.code === 0 ? parseMonsterTable(text) : { head: '', index: [], blocks: [] };
  const block = (name: string): MonsterBlock => {
    const b = table.blocks.find((x) => x.name === name);
    if (!b) throw new Error(`no block ${name}`);
    return b;
  };

  it('writes the table and says what it wrote: 9 named modifiers, 8 on Tame_Beast\'s list, the unnamed row left out', () => {
    expect({ code: r.code, stderr: r.stderr }).toEqual({ code: 0, stderr: '' });
    expect(r.stdout).toBe(
      `monster-mods: wrote ${path.relative(TMP, out)}: 9 modifiers, 8 a tamed beast keeps; stats 3, condition 1, none 5; ` +
        '1 row with no name left out\n',
    );
    expect(table.head).toContain("from poe2db's pages saved 2026-10-18");
    expect(table.head).toContain('"Archnemesis Mods" list (13 rows)');
    expect(table.head).toContain('its own "Archnemesis Mods" list (9 rows)');
  });

  it('has one block per name, in the order Monster_Modifiers first shows it, each whole and in the vocabulary', () => {
    expect(table.blocks.map((b) => b.name)).toEqual([
      'Hasted',
      'Armoured',
      'Trail of Ice',
      'Haste Aura',
      'Prevents Recovery Above 50%',
      'Explodes Nearby Corpses',
      'Increased Life',
      'Bubonic Trail',
      "Kurgal's Last Gasp",
    ]);
    for (const b of table.blocks) expect({ name: b.name, problems: blockProblems(b, VOCABULARY) }).toEqual({ name: b.name, problems: [] });
    expect(table.blocks.map((b) => b.fields.get('Id'))).toEqual([
      'hasted',
      'armoured',
      'trail-of-ice',
      'haste-aura',
      'prevents-recovery-above-50',
      'explodes-nearby-corpses',
      'increased-life',
      'bubonic-trail',
      'kurgals-last-gasp',
    ]);
    // The index has one line per block, with the block's model and families.
    expect(table.index).toHaveLength(table.blocks.length);
    expect(table.index[2]).toBe('- Trail of Ice (trail-of-ice): condition; creates chilled-ground; pays off on none; keeps: yes');
  });

  it('"Hasted" carries its two speed lines once, though two rows show them, with its own page and model stats', () => {
    const b = block('Hasted');
    expect(b.lines).toEqual(['"30% increased Movement Speed"', '"30% increased Attack and Cast Speed"']);
    expect(b.fields.get('URL')).toBe('https://poe2db.tw/us/Hasted');
    expect(b.fields.get('Model')).toBe('stats');
    expect(b.fields.get('Reach')).toBe('the beast');
    expect(b.fields.get('Tamed beast keeps it')).toBe('yes');
  });

  it('the ice trail: no lines on the page, its name linking the Chilled Ground keyword, model condition, creates chilled-ground', () => {
    const b = block('Trail of Ice');
    expect(b.fields.get('Lines')).toBe(NO_LINES);
    expect(b.fields.get('URL')).toBe('https://poe2db.tw/us/Monster_Modifiers');
    expect(b.fields.get('Keyword')).toBe('Chilled Ground, https://poe2db.tw/us/Chilled_Ground');
    expect(b.fields.get('Model')).toBe('condition');
    expect(b.fields.get('Config')).toBe('conditionEnemyOnChilledGround ("Is the enemy on Chilled Ground?")');
    expect(creates(b).creates).toEqual(['chilled-ground']);
  });

  it("an aura's reach is its allies, the player and minions; its URL is its own page", () => {
    const b = block('Haste Aura');
    expect(b.fields.get('Reach')).toBe('its allies: the player and minions');
    expect(b.fields.get('URL')).toBe('https://poe2db.tw/us/Haste_Aura');
    expect(b.fields.get('Model')).toBe('stats');
    expect(creates(b).creates).toEqual(['attack-speed', 'cast-speed', 'movement-speed']);
  });

  it('keeps an internal stat id and marks it; keeps an encoded URL as the page gives it; a partly linked name gets its keyword', () => {
    expect(block('Armoured').lines).toEqual(['internal stat id: monster additional strength ratio % for armour [100]']);
    expect(block('Prevents Recovery Above 50%').fields.get('URL')).toBe('https://poe2db.tw/us/Prevents_Recovery_Above_50%25');
    expect(block('Explodes Nearby Corpses').fields.get('Keyword')).toBe('Corpses, https://poe2db.tw/us/Corpses');
    expect(creates(block('Explodes Nearby Corpses')).pays).toEqual(['corpse']);
  });

  it("the keep flag is Tame_Beast's list: a modifier only Monster_Modifiers lists is not kept", () => {
    expect(block('Increased Life').fields.get('Tamed beast keeps it')).toBe('no');
    expect(table.blocks.filter((b) => b.fields.get('Tamed beast keeps it') === 'yes')).toHaveLength(8);
  });

  it("the kind is the name's style on the page; an entity in a name is decoded and dropped from its id", () => {
    expect(block('Bubonic Trail').fields.get('Kind')).toBe('abyss');
    expect(block("Kurgal's Last Gasp").fields.get('Kind')).toBe('abyss-special');
    expect(block('Hasted').fields.get('Kind')).toBe('standard');
  });

  it('a second run over the same pages writes the same table', () => {
    const again = outFile();
    expect(run('--from', FIXTURES, '--out', again, '--date', '2026-10-18').code).toBe(0);
    expect(fs.readFileSync(again, 'utf8')).toBe(text);
  });
});

describe('AC-W72 (WU-86): the script fails loudly and writes nothing', () => {
  it('without --from: a usage error, since it never fetches', () => {
    const r = run('--out', outFile());
    expect(r.code).toBe(2);
    expect(r.stderr).toContain('--from <folder> is required: the script reads saved pages and never fetches');
  });

  it('has no network code', () => {
    const source = fs.readFileSync(SCRIPT, 'utf8');
    expect(source).not.toMatch(/\bfetch\(|node:https?['"]|from ['"]https?['"]|require\(['"]https?['"]\)|node:net\b/);
  });

  it('when a page is missing', () => {
    const dir = path.join(TMP, `pages-${++n}`);
    fs.mkdirSync(dir);
    fs.copyFileSync(path.join(FIXTURES, 'Monster_Modifiers.html'), path.join(dir, 'Monster_Modifiers.html'));
    const out = outFile();
    const r = run('--from', dir, '--out', out);
    expect(r.code).toBe(1);
    expect(r.stderr).toContain(`no saved page ${path.join(dir, 'Tame_Beast.html')}`);
    expect(fs.existsSync(out)).toBe(false);
  });

  it('when a page has no "Archnemesis Mods" tab', () => {
    const dir = editedFixtures('Tame_Beast', (h) => h.replace('<div id="ArchnemesisMods"', '<div id="SomethingElse"'));
    const out = outFile();
    const r = run('--from', dir, '--out', out);
    expect(r.code).toBe(1);
    expect(r.stderr).toContain('Tame_Beast: no "Archnemesis Mods" tab');
    expect(fs.existsSync(out)).toBe(false);
  });

  it("when the tab's count differs from its rows", () => {
    const dir = editedFixtures('Monster_Modifiers', (h) => h.replace('<h5 class="card-header"> Archnemesis Mods /13 </h5>', '<h5 class="card-header"> Archnemesis Mods /14 </h5>'));
    const out = outFile();
    const r = run('--from', dir, '--out', out);
    expect(r.code).toBe(1);
    expect(r.stderr).toContain('Monster_Modifiers: the "Archnemesis Mods" tab says 14 rows but holds 13');
    expect(fs.existsSync(out)).toBe(false);
  });

  it('when a named modifier has no judgment yet', () => {
    const dir = editedFixtures('Monster_Modifiers', (h) => h.replace('<div class="strong">Increased Life</div>', '<div class="strong">Glowing Spores</div>'));
    const out = outFile();
    const r = run('--from', dir, '--out', out);
    expect(r.code).toBe(1);
    expect(r.stderr).toContain('no judgment for "Glowing Spores" (glowing-spores): add one to JUDGMENTS in monster-mods.mjs');
    expect(fs.existsSync(out)).toBe(false);
  });
});
