/**
 * WU-84 (amendment 8, D-400): the league digest, `.claude/skills/build-guide/scripts/league-digest.mjs`, spawned as a
 * real `node` process on handwritten pages in poe2db's structure (`tests/fixtures/poe2db/league/`), with the in-pin
 * flags checked against a fixture name list (`pin-names.json`), never `vendor/`, and no request (AC-W70, D-34): the
 * `--from` runs load a module that makes `fetch` throw, and the fetch path's own test serves the fixture pages from a
 * stubbed `fetch` and records the waits it asks for instead of waiting.
 *
 * The fixture list knows Eonyr's Thunder, "fist of kalguur" (another case), "Berek’s Grip" (a curly apostrophe), Legacy of
 * Facebreaker, Grasping Ring, Martial Artist and, from outside the section, Exalted Orb and Spirit Walker; the pinned
 * data knows more (Powered by Verisium, Way of the Stonefist), so a flag that reads "no" for those came from the list.
 * The fixture's rule-changer judgments (`runes-of-aldur.rule-changers.json`) name one socketable, Legacy of Northpaw.
 */
import { describe, it, expect, afterAll } from '@jest/globals';
import { spawnSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { pathToFileURL } from 'url';

const REPO = path.resolve(__dirname, '..', '..');
const SCRIPT = path.join(REPO, '.claude', 'skills', 'build-guide', 'scripts', 'league-digest.mjs');
const FIXTURES = path.join(REPO, 'tests', 'fixtures', 'poe2db', 'league');
const PIN_NAMES = path.join(FIXTURES, 'pin-names.json');
const RULE_CHANGERS = path.join(FIXTURES, 'runes-of-aldur.rule-changers.json');
const DIGEST = path.join(REPO, 'data', 'league', 'runes-of-aldur.md');
const VERSION = JSON.parse(fs.readFileSync(path.join(REPO, 'package.json'), 'utf8')).version as string;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'league-digest-'));

afterAll(() => fs.rmSync(TMP, { recursive: true, force: true }));

/** The saved pages' time, and the day the script reads from it. */
const SAVED = new Date('2026-10-18T12:00:00Z');
const day = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const SAVED_DAY = day(SAVED);

/** A module the child loads first: `fetch` throws, so a `--from` run that reached the network would be refused. */
const NO_NETWORK = path.join(TMP, 'no-network.mjs');
fs.writeFileSync(NO_NETWORK, "globalThis.fetch = () => { throw new Error('the test forbids the network'); };\n");

/**
 * A module the child loads first for the fetch path: `fetch` serves the fixture pages by URL and logs each request
 * with its headers and options; `setTimeout` logs each wait and fires at once. `STUB_FAIL` gives statuses to answer a
 * URL with before its page, as `[[url, [status, …]], …]`.
 */
const STUB = path.join(TMP, 'stub-fetch.mjs');
fs.writeFileSync(
  STUB,
  `import fs from 'node:fs';
import path from 'node:path';
const log = (entry) => fs.appendFileSync(process.env.STUB_LOG, JSON.stringify(entry) + '\\n');
const fail = new Map(JSON.parse(process.env.STUB_FAIL || '[]'));
const realSetTimeout = globalThis.setTimeout;
globalThis.setTimeout = (fn, ms, ...args) => { log({ wait: ms }); return realSetTimeout(fn, 0, ...args); };
globalThis.fetch = async (url, init = {}) => {
  log({ url: String(url), options: Object.keys(init).sort(), headers: init.headers });
  const queue = fail.get(String(url));
  if (queue && queue.length > 0) return new Response('busy', { status: queue.shift() });
  const name = String(url) === 'https://poe2db.tw/us/' ? 'home.html' : String(url).slice('https://poe2db.tw/us/'.length) + '.html';
  const file = path.join(process.env.STUB_PAGES, name);
  return fs.existsSync(file) ? new Response(fs.readFileSync(file, 'utf8'), { status: 200 }) : new Response('not found', { status: 404 });
};
`,
);

let dirs = 0;
const newDir = (name: string) => {
  const dir = path.join(TMP, `${name}-${++dirs}`);
  fs.mkdirSync(dir);
  return dir;
};

/** A copy of the fixture pages, saved at SAVED, with `edit` applied to one page's text. */
function pages(edit?: { file: string; from: string; to: string }): string {
  const dir = newDir('pages');
  for (const f of fs.readdirSync(FIXTURES).filter((n) => n.endsWith('.html'))) {
    let text = fs.readFileSync(path.join(FIXTURES, f), 'utf8');
    if (edit && edit.file === f) {
      expect(text).toContain(edit.from);
      text = text.replace(edit.from, edit.to);
    }
    fs.writeFileSync(path.join(dir, f), text);
    fs.utimesSync(path.join(dir, f), SAVED, SAVED);
  }
  return dir;
}

function run(args: string[], opts: { preload?: string; env?: Record<string, string> } = {}) {
  const node = opts.preload ? ['--import', pathToFileURL(opts.preload).href] : [];
  const r = spawnSync(process.execPath, [...node, SCRIPT, ...args], { cwd: TMP, env: { PATH: '/usr/bin:/bin', LANG: 'C', ...opts.env }, encoding: 'utf8', timeout: 30000 });
  return { code: r.status, stdout: r.stdout, stderr: r.stderr };
}

/** A new output folder holding the fixture's rule-changer judgments beside where the digest goes. */
function outDir() {
  const out = newDir('out');
  fs.copyFileSync(RULE_CHANGERS, path.join(out, 'runes-of-aldur.rule-changers.json'));
  return out;
}

/** The digest of the fixture pages, written by a `--from` run that can't reach the network. */
function digestOf(dir = pages(), out = outDir(), pinNames = PIN_NAMES) {
  const r = run(['Runes_of_Aldur', '--from', dir, '--out', out, '--pin-names', pinNames], { preload: NO_NETWORK });
  expect({ code: r.code, stderr: r.stderr }).toEqual({ code: 0, stderr: '' });
  return { out, file: path.join(out, 'runes-of-aldur.md'), text: fs.readFileSync(path.join(out, 'runes-of-aldur.md'), 'utf8'), stdout: r.stdout };
}

type Block = { name: string; fields: Record<string, string>; texts: Array<{ label: string; lines: string[] }> };

/** The body's blocks: `### <Name>`, its `- Field: value` lines and its text lists. */
function blocks(text: string): Block[] {
  const lines = text.split('\n');
  const out: Block[] = [];
  let cur: Block | null = null;
  for (const line of lines.slice(lines.indexOf('## Body') + 1)) {
    if (line.startsWith('### ')) {
      cur = { name: line.slice(4), fields: {}, texts: [] };
      out.push(cur);
      continue;
    }
    if (!cur || line === '') continue;
    const sub = /^ {2}- (.*)$/.exec(line);
    const field = /^- ([^:]+):(?: (.*))?$/.exec(line);
    if (sub) cur.texts[cur.texts.length - 1].lines.push(sub[1]);
    else if (field && field[1].startsWith('Text') && field[2] === undefined) cur.texts.push({ label: field[1], lines: [] });
    else if (field) cur.fields[field[1]] = field[2] ?? '';
    else throw new Error(`a line outside the block form: ${line}`);
  }
  return out;
}
const headOf = (text: string) => {
  const lines = text.split('\n');
  return lines.slice(lines.indexOf('## Head') + 1, lines.indexOf('## Body')).filter((l) => l !== '');
};

const URL = (page: string) => `https://poe2db.tw/us/${page}`;
const entry = (name: string, id: string, kind: string, tags: string[] | null, inPin: boolean, url: string, texts: Array<{ label: string; lines: string[] }>): Block => ({
  name,
  fields: { Id: id, Kind: kind, ...(tags ? { Tags: tags.join(', ') } : {}), 'In pin': inPin ? 'yes' : 'no', URL: url, Fetched: SAVED_DAY, ...(texts.length === 0 && tags ? { Text: 'none' } : {}) },
  texts,
});
const one = (...lines: string[]) => [{ label: 'Text', lines }];

/** What the fixture pages hold, in the spec's terms: every entry, its kind, tags, text and URL (AC-W70). */
const EXPECTED: Block[] = [
  entry("Eonyr's Thunder", 'eonyrs-thunder', 'gem', ['Support', 'Lineage', 'Spell', 'AoE', 'Trigger', 'Lightning'], true, URL('Eonyrs_Thunder'), one(
    'Supports any Skill which can deal damage. Lightning damage from Supported Skills can inflict Electrocute, but Supported Skills cannot inflict Shock. Enemies slain while Electrocuted by Supported Skills explode, dealing a percentage of their maximum Life as Lightning damage.',
  )),
  entry('Fist Of Kalguur', 'fist-of-kalguur', 'gem', ['Support', 'Attack', 'Slam'], true, URL('Fist_Of_Kalguur'), one(
    'Supports Slams you use yourself, allowing them to spend large amounts of Runic Ward to become Runically Boosted. Runically Boosted Slams are Empowered with extra Physical damage and create a rune the first time they hit an enemy.',
    'The rune erupts in an Aftershock after a duration. Cannot support Channelling Skills.',
  )),
  entry('Powered by Verisium', 'powered-by-verisium', 'gem', ['Spell', 'Repeatable', 'Cooldown'], false, URL('Powered_by_Verisium'), one(
    'Spends Ward to generate Verisium Infusions, which can be used in place of any Elemental Infusions.',
  )),
  entry("Berek's Grip", 'bereks-grip', 'unique', ['Two-Stone Ring'], true, URL('Bereks_Grip'), one(
    'Requires: Level 42',
    '+(12—16)% to Cold and Lightning Resistances',
    '+(10—20) to Dexterity and Intelligence',
    '+(10—20)% to Cold and Lightning Resistances',
    'Hits against you have (35—50)% reduced Critical Hit Chance while you are Chilled',
    'Wind Skills which can be boosted by Elemental Ground Surfaces count',
    'as being boosted by Shocked Ground',
  )),
  entry('Voices', 'voices', 'unique', ['Sapphire'], false, URL('Voices'), [
    { label: 'Text (variant 1 of 2)', lines: ['Allocates 3 Sinister Jewel sockets', 'Corrupted'] },
    { label: 'Text (variant 2 of 2)', lines: ['Allocates 4 Sinister Jewel sockets', 'Corrupted'] },
  ]),
  entry('Legacy of Facebreaker', 'legacy-of-facebreaker', 'item', ['SoulCore'], true, URL('Legacy_of_Facebreaker'), one(
    "Limited to: 1 Aldur's Legacy",
    'Requires: Level 65',
    'Gloves: +1 to Armour per Strength',
    'Bonded:',
    'Gloves: 1% increased Damage per 15 Strength',
  )),
  entry('Legacy of Northpaw', 'legacy-of-northpaw', 'item', ['SoulCore'], false, URL('Legacy_of_Northpaw'), one(
    "Limited to: 1 Aldur's Legacy",
    'Requires: Level 65',
    'Gloves: Base Critical Hit Chance for Attacks with Weapons is 7%',
    'Bonded:',
    'Gloves: 15% increased Critical Damage Bonus',
  )),
  entry('Rune of Confrontation', 'rune-of-confrontation', 'item', ['SoulCore'], false, URL('Rune_of_Confrontation'), one(
    'Requires: Level 15',
    'Socket-bound',
    'Quarterstaff or Spear: Gain 4 Rage on Melee Hit, -10 to Maximum Rage',
    'Quarterstaff or Spear: (untranslated stat: rage effect +% [10])',
  )),
  entry('Grasping Ring', 'grasping-ring', 'item', ['Ring'], true, URL('Grasping_Ring'), one(
    'Requires: Level 40',
    'This item gains bonuses from Socketed Items as though it was Gloves',
  )),
  entry('Head of the King', 'head-of-the-king', 'item', ['MapFragment', 'QuestItem'], false, URL('Head_of_the_King'), one(
    'Bring this proof of your victory to Aoife in Caer Tarth.',
  )),
  entry('Omen of Chaotic Effectiveness', 'omen-of-chaotic-effectiveness', 'item', ['Omen'], false, URL('Omen_of_Chaotic_Effectiveness'), one(
    'While this item is active in your inventory your next',
    'Chaos Orb will replace all Modifiers on a Waystone',
    'with Modifiers that do not grant Monster Effectiveness',
  )),
  { name: 'Legacy of Edyrns Tusks', fields: { Id: 'legacy-of-edyrns-tusks', Kind: 'item', Tags: 'none', 'In pin': 'no', URL: 'none', Fetched: SAVED_DAY, Text: 'none' }, texts: [] },
  entry('Martial Artist', 'martial-artist', 'ascendancy', null, true, URL('Martial_Artist'), []),
  entry('Way of the Stonefist', 'way-of-the-stonefist', 'passive', null, false, URL('Way_of_the_Stonefist'), []),
];

describe('league-digest.mjs (WU-84, D-400): a poe2db section as data/league/<slug>.md, flagged in the pin or not', () => {
  it('AC-W70: the parser yields every entry with its kind, tags, text and URL, and the ascendancies and passives with name and URL only', () => {
    const { text } = digestOf();
    expect(blocks(text)).toEqual(EXPECTED);
    // An ascendancy or a passive has no tags and no text; another block's ascendancy (Spirit Walker, in the 0.5.5
    // block) and the block's other links (Beast, Aldur's Legacy, the gem and unique lists) are no entries.
    for (const b of blocks(text).filter((x) => x.fields.Kind === 'ascendancy' || x.fields.Kind === 'passive')) {
      expect(Object.keys(b.fields)).toEqual(['Id', 'Kind', 'In pin', 'URL', 'Fetched']);
      expect(b.texts).toEqual([]);
    }
    expect(text).not.toMatch(/Spirit Walker|Invoker|### Beast|### Aldur's Legacy|Atziri's Soul Core/);
  });

  it('AC-W70: currency is left out: the entry poe2db marks as currency is in neither the head nor the body, even with its name in the pin', () => {
    const { text, stdout } = digestOf();
    expect(text).not.toContain('Exalted Orb');
    expect(text).not.toContain('Augments a Magic or Rare item');
    expect(text).toContain('Currency is left out (1 entry: what poe2db marks as currency). Socketables (runes, soul cores and idols) are in the body;');
    expect(stdout).toContain('Currency left out: 1.');
    // The socketables poe2db doesn't mark as currency stay.
    expect(blocks(text).filter((b) => b.fields.Tags === 'SoulCore').map((b) => b.name)).toEqual(['Legacy of Facebreaker', 'Legacy of Northpaw', 'Rune of Confrontation']);
  });

  it('AC-W70: the in-pin flag is right for a known and an unknown name, checked against the fixture name list, not vendor/', () => {
    const { text } = digestOf();
    const flag = (name: string) => blocks(text).find((b) => b.name === name)!.fields['In pin'];
    expect(flag("Eonyr's Thunder")).toBe('yes');
    expect(flag('Powered by Verisium')).toBe('no');
    expect(headOf(text)).toContain("- Eonyr's Thunder (gem, Support): Supports any Skill which can deal damage.");
    expect(headOf(text)).toContain('- Powered by Verisium (gem, Spell): Spends Ward to generate Verisium Infusions, which can be used in place of any Elemental Infusions. [not in pin]');
    // Names compare without case or curly quotes, and only within their kind.
    expect(flag('Fist Of Kalguur')).toBe('yes');
    expect(flag("Berek's Grip")).toBe('yes');
    expect(flag('Way of the Stonefist')).toBe('no');
    expect(text).toContain('In-pin flags: checked against the fixture name list on');
    expect(text).toContain('Entries: 3 gems, 2 uniques, 7 items, 1 ascendancy, 1 passive; 6 of the 14 in the pin.');
  });

  it('AC-W70: no test touches the network: a --from run never calls fetch (it throws in the child), and makes its file from the saved pages alone', () => {
    const dir = pages();
    const out = newDir('out');
    const r = run(['Runes_of_Aldur', '--from', dir, '--out', out, '--pin-names', PIN_NAMES], { preload: NO_NETWORK });
    expect({ code: r.code, stderr: r.stderr }).toEqual({ code: 0, stderr: '' });
    expect(r.stdout).not.toContain('saving the pages');
    expect(fs.readdirSync(out)).toEqual(['runes-of-aldur.md']);
    // The preload works: a run that fetches is refused under it.
    const live = run(['Runes_of_Aldur', '--save', newDir('save'), '--out', newDir('out'), '--pin-names', PIN_NAMES], { preload: NO_NETWORK });
    expect(live.code).toBe(1);
    expect(live.stderr).toBe('league-digest: refused: https://poe2db.tw/us/: the test forbids the network\n');
  });

  it("names the section and its fetch date in the first three lines (the runner's head -3), then a head line per entry in body order, the socketables giving way to one line and a [rule] line for each judged rule changer", () => {
    const { text } = digestOf();
    expect(text.split('\n').slice(0, 3)).toEqual([
      '# League digest: Runes of Aldur',
      '',
      `Runes of Aldur (Return of the Ancients 0.5) on poe2db.tw, fetched ${SAVED_DAY}. In-pin flags: checked against the fixture name list on ${day(new Date())}.`,
    ]);
    expect(text).toContain('Cite an entry by its id: `data | league/runes-of-aldur.md#<id>`.');
    expect(headOf(text)).toEqual([
      "- Eonyr's Thunder (gem, Support): Supports any Skill which can deal damage.",
      '- Fist Of Kalguur (gem, Support): Supports Slams you use yourself, allowing them to spend large amounts of Runic Ward to become …',
      '- Powered by Verisium (gem, Spell): Spends Ward to generate Verisium Infusions, which can be used in place of any Elemental Infusions. [not in pin]',
      "- Berek's Grip (unique, Two-Stone Ring): +(12—16)% to Cold and Lightning Resistances",
      '- Voices (unique, Sapphire): Allocates 3 Sinister Jewel sockets [not in pin]',
      '- Socketables (3): runes, soul cores and idols, in the body; Grep it by mechanic.',
      "- Legacy of Northpaw (item, SoulCore) [rule]: in gloves, weapon attacks' base Critical Hit Chance becomes 7%, whatever the weapon [not in pin]",
      '- Grasping Ring (item, Ring): This item gains bonuses from Socketed Items as though it was Gloves',
      '- Head of the King (item, MapFragment): Bring this proof of your victory to Aoife in Caer Tarth. [not in pin]',
      '- Omen of Chaotic Effectiveness (item, Omen): While this item is active in your inventory your next Chaos Orb will replace all Modifiers … [not in pin]',
      '- Legacy of Edyrns Tusks (item) [not in pin]',
      '- Martial Artist (ascendancy)',
      '- Way of the Stonefist (passive) [not in pin]',
    ]);
  });

  it('keeps every socketable in the body; with no judgments the head has only their one line, and a judgment naming no socketable of the digest is refused', () => {
    const { text } = digestOf(pages(), newDir('out'));
    expect(headOf(text).filter((l) => l.includes('SoulCore') || l.startsWith('- Socketables'))).toEqual(['- Socketables (3): runes, soul cores and idols, in the body; Grep it by mechanic.']);
    expect(blocks(text).filter((b) => b.fields.Tags === 'SoulCore').map((b) => b.fields.Id)).toEqual(['legacy-of-facebreaker', 'legacy-of-northpaw', 'rune-of-confrontation']);
    for (const [judgments, why] of [
      [{ ruleChangers: { 'grasping-ring': 'a ring that takes gloves socketables' } }, '"grasping-ring" isn\'t a socketable of this digest'],
      [{ ruleChangers: { 'legacy-of-northpaw': '' } }, '"legacy-of-northpaw" needs its why as one line'],
      [{ northpaw: 'no ruleChangers object' }, 'no "ruleChangers" object of id → why'],
    ] as const) {
      const out = newDir('out');
      const sidecar = path.join(out, 'runes-of-aldur.rule-changers.json');
      fs.writeFileSync(sidecar, JSON.stringify(judgments));
      const r = run(['Runes_of_Aldur', '--from', pages(), '--out', out, '--pin-names', PIN_NAMES], { preload: NO_NETWORK });
      expect({ code: r.code, stderr: r.stderr, files: fs.readdirSync(out) }).toEqual({ code: 1, stderr: `league-digest: refused: ${sidecar}: ${why}\n`, files: ['runes-of-aldur.rule-changers.json'] });
    }
  });

  it('fetches the homepage, then each list its block links, one at a time and 3 s apart, with the User-Agent and no cookie; a 429 waits 60 s for its one retry; each page is saved (stubbed fetch, no network)', () => {
    const served = pages();
    const save = newDir('save');
    const out = outDir();
    const log = path.join(newDir('log'), 'requests.jsonl');
    const uniques = URL('Runes_of_Aldur_uniques');
    const r = run(['Runes_of_Aldur', '--save', save, '--out', out, '--pin-names', PIN_NAMES], {
      preload: STUB,
      env: { STUB_PAGES: served, STUB_LOG: log, STUB_FAIL: JSON.stringify([[uniques, [429]]]) },
    });
    expect({ code: r.code, stderr: r.stderr }).toEqual({ code: 0, stderr: `[league-digest] ${uniques}: HTTP 429; one retry after 60 s\n` });
    const headers = { 'User-Agent': `pob2-mcp-server/${VERSION}`, Accept: 'text/html' };
    const request = (url: string) => ({ url, options: ['headers', 'redirect'], headers });
    const entries = fs.readFileSync(log, 'utf8').trim().split('\n').map((l) => JSON.parse(l));
    expect(entries).toEqual([
      request(URL('')),
      { wait: 3000 },
      request(URL('Runes_of_Aldur_gems')),
      { wait: 3000 },
      request(uniques),
      { wait: 60000 },
      { wait: 3000 },
      request(uniques),
      { wait: 3000 },
      request(URL('Runes_of_Aldur_items')),
    ]);
    expect(fs.readdirSync(save).sort()).toEqual(['Runes_of_Aldur_gems.html', 'Runes_of_Aldur_items.html', 'Runes_of_Aldur_uniques.html', 'home.html']);
    expect(r.stdout.split('\n')[0]).toBe(`league-digest: saving the pages to ${save} (re-run with --from ${save} to make no request)`);
    // The fetched digest is the saved pages' digest, fetched today.
    const fetched = fs.readFileSync(path.join(out, 'runes-of-aldur.md'), 'utf8');
    expect(fetched.replaceAll(`fetched ${day(new Date())}.`, `fetched ${SAVED_DAY}.`).replaceAll(`- Fetched: ${day(new Date())}`, `- Fetched: ${SAVED_DAY}`)).toBe(digestOf().text);
  });

  it('refuses after a second 429 or 5xx, writing no digest; the pages fetched so far stay saved', () => {
    const save = newDir('save');
    const out = newDir('out');
    const log = path.join(newDir('log'), 'requests.jsonl');
    const gems = URL('Runes_of_Aldur_gems');
    const r = run(['Runes_of_Aldur', '--save', save, '--out', out, '--pin-names', PIN_NAMES], {
      preload: STUB,
      env: { STUB_PAGES: pages(), STUB_LOG: log, STUB_FAIL: JSON.stringify([[gems, [503, 503]]]) },
    });
    expect(r.code).toBe(1);
    expect(r.stderr).toBe(`[league-digest] ${gems}: HTTP 503; one retry after 60 s\nleague-digest: refused: ${gems}: HTTP 503\n`);
    expect(fs.readFileSync(log, 'utf8').trim().split('\n').filter((l) => l.includes('"url"')).length).toBe(3);
    expect(fs.readdirSync(out)).toEqual([]);
    expect(fs.readdirSync(save)).toEqual(['home.html']);
  });

  it('--reflag re-checks only the in-pin flags of a committed digest: each block, its head marker, the count and the pin line; nothing else moves', () => {
    const { file, text, out } = digestOf();
    const names = JSON.parse(fs.readFileSync(PIN_NAMES, 'utf8'));
    const upgraded = path.join(newDir('pin'), 'upgraded.json');
    fs.writeFileSync(upgraded, JSON.stringify({ ...names, pin: 'the upgraded list', passive: ['Way of the Stonefist'], item: [...names.item.filter((n: string) => n !== 'Grasping Ring'), 'Legacy of Northpaw', 'Rune of Confrontation'] }));
    const r = run(['--reflag', 'runes-of-aldur', '--out', out, '--pin-names', upgraded], { preload: NO_NETWORK });
    expect({ code: r.code, stderr: r.stderr }).toEqual({ code: 0, stderr: '' });
    expect(r.stdout).toBe(`league-digest: re-flagged ${file} against the upgraded list: 8 of the 14 in the pin.\nNow in the pin: Legacy of Northpaw (item), Rune of Confrontation (item), Way of the Stonefist (passive).\nNo longer in the pin: Grasping Ring (item).\n`);
    const today = day(new Date());
    const expected = text
      .replace(`checked against the fixture name list on ${today}.`, `checked against the upgraded list on ${today}.`)
      .replace('- Grasping Ring (item, Ring): This item gains bonuses from Socketed Items as though it was Gloves', '- Grasping Ring (item, Ring): This item gains bonuses from Socketed Items as though it was Gloves [not in pin]')
      .replace('- Way of the Stonefist (passive) [not in pin]', '- Way of the Stonefist (passive)')
      .replace('whatever the weapon [not in pin]', 'whatever the weapon')
      .replace('; 6 of the 14 in the pin.', '; 8 of the 14 in the pin.')
      .replace(/(### Legacy of Northpaw\n(?:- .*\n)*?)- In pin: no/, '$1- In pin: yes')
      .replace(/(### Rune of Confrontation\n(?:- .*\n)*?)- In pin: no/, '$1- In pin: yes')
      .replace(/(### Grasping Ring\n(?:- .*\n)*?)- In pin: yes/, '$1- In pin: no')
      .replace(/(### Way of the Stonefist\n(?:- .*\n)*?)- In pin: no/, '$1- In pin: yes');
    expect(fs.readFileSync(file, 'utf8')).toBe(expected);
    // The Poe2db slug works as well, and the same list changes nothing.
    const again = run(['--reflag', 'Runes_of_Aldur', '--out', out, '--pin-names', upgraded]);
    expect(again.stdout).toBe(`league-digest: re-flagged ${file} against the upgraded list: 8 of the 14 in the pin.\nNo flag changed.\n`);
    expect(fs.readFileSync(file, 'utf8')).toBe(expected);
  });

  it('prints the entries added since the digest it replaces', () => {
    const dir = pages({ file: 'Runes_of_Aldur_gems.html', from: 'Runes of Aldur Gem /3 ', to: 'Runes of Aldur Gem /2 ' });
    // Drop the gem list's last column: Powered by Verisium.
    const gemsFile = path.join(dir, 'Runes_of_Aldur_gems.html');
    const gems = fs.readFileSync(gemsFile, 'utf8');
    const last = gems.lastIndexOf('<div class="col">');
    fs.writeFileSync(gemsFile, gems.slice(0, last) + gems.slice(gems.indexOf('</div></div></div>', last) + '</div></div></div>'.length));
    fs.utimesSync(gemsFile, SAVED, SAVED);
    const first = digestOf(dir);
    expect(first.stdout).toBe(`league-digest: wrote ${first.file}. Entries: 2 gems, 2 uniques, 7 items, 1 ascendancy, 1 passive; 6 of the 13 in the pin. Currency left out: 1.\nAdded: the first digest of Runes_of_Aldur, so all 13 entries are new.\n`);
    const second = digestOf(pages(), first.out);
    expect(second.stdout).toBe(`league-digest: wrote ${first.file}. Entries: 3 gems, 2 uniques, 7 items, 1 ascendancy, 1 passive; 6 of the 14 in the pin. Currency left out: 1.\nAdded since the last digest (1):\n- Powered by Verisium (gem)\n`);
    const third = digestOf(pages(), first.out);
    expect(third.stdout.split('\n')[1]).toBe('Added since the last digest: none.');
  });

  it("refuses, writing nothing, a list page whose entries aren't its header's count, a section the homepage doesn't link and a missing page; a bad command line is a usage error", () => {
    const refused = (args: string[], message: string) => {
      const out = newDir('out');
      const r = run([...args, '--out', out, '--pin-names', PIN_NAMES], { preload: NO_NETWORK });
      expect({ code: r.code, stderr: r.stderr, files: fs.readdirSync(out) }).toEqual({ code: 1, stderr: `league-digest: refused: ${message}\n`, files: [] });
    };
    refused(['Runes_of_Aldur', '--from', pages({ file: 'Runes_of_Aldur_items.html', from: 'Item /9 ', to: 'Item /10 ' })], "the items page's header counts 10 entries but 9 were parsed: poe2db changed its page");
    refused(['Runes_of_Aldur', '--from', pages({ file: 'Runes_of_Aldur_uniques.html', from: '<span class="uniqueName">Berek\'s Grip</span>', to: '' })], 'a unique with no name: poe2db changed its page');
    refused(['Mercenaries_of_Trarthus', '--from', pages()], 'the homepage has no section block linking Mercenaries_of_Trarthus_gems, Mercenaries_of_Trarthus_uniques or Mercenaries_of_Trarthus_items: check the slug, or poe2db changed its homepage');
    const dir = pages();
    refused(['Forbidden_Rites', '--from', dir], `${path.join(dir, 'Forbidden_Rites_items.html')} is missing`);
    const empty = newDir('out');
    const reflag = run(['--reflag', 'Runes_of_Aldur', '--out', empty, '--pin-names', PIN_NAMES], { preload: NO_NETWORK });
    expect({ code: reflag.code, stderr: reflag.stderr }).toEqual({ code: 1, stderr: `league-digest: refused: ${path.join(empty, 'runes-of-aldur.md')} is missing\n` });
    for (const args of [[], ['runes-of-aldur', '--from', dir], ['Runes_of_Aldur', '--bogus'], ['Runes_of_Aldur', 'Other'], ['--reflag', 'Runes_of_Aldur', '--from', dir], ['Runes_of_Aldur', '--out']]) {
      const r = run(args, { preload: NO_NETWORK });
      expect({ args, code: r.code }).toEqual({ args, code: 2 });
      expect(r.stderr).toMatch(/^league-digest: .*\nusage: league-digest\.mjs <slug>/);
    }
  });
});

/**
 * The committed digest's form, which holds through a re-fetch at a patch and a `--reflag` at a pin upgrade: these
 * check its shape, not its counts or dates.
 */
describe('the first digest, data/league/runes-of-aldur.md (WU-84, D-400): built from the pages saved on 2026-10-18', () => {
  const text = fs.readFileSync(DIGEST, 'utf8');
  const body = blocks(text);

  it('names its section and fetch date in its first three lines, and its entries line counts its blocks', () => {
    const top = text.split('\n').slice(0, 3);
    expect(top.slice(0, 2)).toEqual(['# League digest: Runes of Aldur', '']);
    expect(top[2]).toMatch(/^Runes of Aldur \(Return of the Ancients [\d.]+\) on poe2db\.tw, fetched \d{4}-\d{2}-\d{2}(?: to \d{4}-\d{2}-\d{2})?\. In-pin flags: checked against the PoB2 pin v[\d.]+ on \d{4}-\d{2}-\d{2}\.$/);
    const count = (kind: string) => body.filter((b) => b.fields.Kind === kind).length;
    const inPin = body.filter((b) => b.fields['In pin'] === 'yes').length;
    expect(text).toContain(`Entries: ${count('gem')} gems, ${count('unique')} uniques, ${count('item')} items, ${count('ascendancy')} ascendancies, ${count('passive')} passives; ${inPin} of the ${body.length} in the pin.`);
    for (const kind of ['gem', 'unique', 'item', 'ascendancy', 'passive']) expect({ kind, some: count(kind) > 0 }).toEqual({ kind, some: true });
  });

  it('has one block per entry in the entry-id form (`### <Name>`, then `- Id: <id>`), the ids unique; a head line per block in order, the socketables only as their one line and the judged rule changers', () => {
    const lines = text.split('\n');
    const ids = body.map((b) => b.fields.Id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
    lines.forEach((l, i) => {
      if (l.startsWith('### ')) expect(lines[i + 1]).toMatch(/^- Id: /);
    });
    const judged: Record<string, string> = JSON.parse(fs.readFileSync(path.join(path.dirname(DIGEST), 'runes-of-aldur.rule-changers.json'), 'utf8')).ruleChangers;
    const socketable = (b: Block) => b.fields.Kind === 'item' && b.fields.Tags.split(', ').includes('SoulCore');
    const first = body.findIndex(socketable);
    const shown = body.filter((b) => !socketable(b) || judged[b.fields.Id] !== undefined);
    const head = headOf(text);
    const at = shown.findIndex(socketable);
    expect(head[at]).toBe(`- Socketables (${body.filter(socketable).length}): runes, soul cores and idols, in the body; Grep it by mechanic.`);
    expect(first).toBeGreaterThan(0);
    const entryLines = [...head.slice(0, at), ...head.slice(at + 1)];
    expect(entryLines.length).toBe(shown.length);
    entryLines.forEach((l, i) => {
      const b = shown[i];
      const why = judged[b.fields.Id];
      expect(l.startsWith(why ? `- ${b.name} (item, SoulCore) [rule]: ${why}` : `- ${b.name} (${b.fields.Kind}`)).toBe(true);
      expect(l.endsWith(' [not in pin]')).toBe(b.fields['In pin'] === 'no');
    });
    // The judgments are the league's rule-changing socketables, the Legacy runes among them, and the head stays short.
    expect(Object.keys(judged).filter((id) => id.startsWith('legacy-of-')).length).toBeGreaterThan(0);
    expect(head.length).toBeLessThan(250);
  });

  it("holds the amendment's example citation, Powered by Verisium, with its game text; no currency; ascendancies and passives with name and URL only", () => {
    const verisium = body.find((b) => b.fields.Id === 'powered-by-verisium')!;
    expect(verisium.fields).toMatchObject({ Kind: 'gem', URL: 'https://poe2db.tw/us/Powered_by_Verisium' });
    expect(verisium.texts[0].lines[0]).toMatch(/^Spends Ward to generate Verisium Infusions/);
    expect(text).not.toMatch(/StackableCurrency|### Exalted Orb|### Kamasa's Orb of Sacrifice|### Liquid Verisium/);
    const named = body.filter((b) => b.fields.Kind === 'ascendancy' || b.fields.Kind === 'passive');
    expect(named.map((b) => b.name)).toEqual(expect.arrayContaining(['Martial Artist', 'Way of the Stonefist']));
    for (const b of named) expect({ name: b.name, fields: Object.keys(b.fields), texts: b.texts.length }).toEqual({ name: b.name, fields: ['Id', 'Kind', 'In pin', 'URL', 'Fetched'], texts: 0 });
  });
});
