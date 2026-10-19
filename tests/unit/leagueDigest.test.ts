/**
 * WU-84 (amendment 8, D-400): the league digest, `.claude/skills/build-guide/scripts/league-digest.mjs`, spawned as a
 * real `node` process on handwritten pages in poe2db's structure (`tests/fixtures/poe2db/league/`), with the in-pin
 * flags checked against a fixture name list (`pin-names.json`), never `vendor/`, and no request (AC-W70, D-34): the
 * `--from` runs load a module that makes `fetch` throw, and the fetch path's own test serves the fixture pages from a
 * stubbed `fetch` and records the waits it asks for instead of waiting.
 *
 * The fixture section, "Embers of Tarn" (slug `Embers_of_Tarn`), is invented, every name and line in it: no fixture text
 * comes from poe2db. Its name list knows Kerr's Cinder Lattice, "bellows of ruin" (another case), "Tarn’s Clasp" (a
 * curly apostrophe), Fourfold Cord, Ferryman's Lantern, Legacy of Cinderhelm, Coral Loop, Legacy of Ferrous Mantle,
 * Ashen Herald and, from outside the section, Orb of Kindling and Tidecaller. Its rule-changer judgments
 * (`embers-of-tarn.rule-changers.json`) name one socketable, Legacy of Ashen Grip.
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
const RULE_CHANGERS = path.join(FIXTURES, 'embers-of-tarn.rule-changers.json');
const SLUG = 'Embers_of_Tarn';
const FILE = 'embers-of-tarn.md';
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
 * URL with before its page, as `[[url, [status, …]], …]`; `STUB_REDIRECT` answers a URL with a 302 to a location, as
 * `[[url, location], …]`.
 */
const STUB = path.join(TMP, 'stub-fetch.mjs');
fs.writeFileSync(
  STUB,
  `import fs from 'node:fs';
import path from 'node:path';
const log = (entry) => fs.appendFileSync(process.env.STUB_LOG, JSON.stringify(entry) + '\\n');
const fail = new Map(JSON.parse(process.env.STUB_FAIL || '[]'));
const redirect = new Map(JSON.parse(process.env.STUB_REDIRECT || '[]'));
const realSetTimeout = globalThis.setTimeout;
globalThis.setTimeout = (fn, ms, ...args) => { log({ wait: ms }); return realSetTimeout(fn, 0, ...args); };
globalThis.fetch = async (url, init = {}) => {
  log({ url: String(url), options: Object.keys(init).sort(), headers: init.headers });
  const queue = fail.get(String(url));
  if (queue && queue.length > 0) return new Response('busy', { status: queue.shift() });
  if (redirect.has(String(url))) return new Response(null, { status: 302, headers: { location: redirect.get(String(url)) } });
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

type Edit = { file: string; from: string; to: string };

/** A copy of the fixture pages, saved at SAVED, with each edit applied to its page's text. */
function pages(edits: Edit | Edit[] = []): string {
  const dir = newDir('pages');
  for (const f of fs.readdirSync(FIXTURES).filter((n) => n.endsWith('.html'))) {
    let text = fs.readFileSync(path.join(FIXTURES, f), 'utf8');
    for (const edit of [edits].flat().filter((e) => e.file === f)) {
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
  fs.copyFileSync(RULE_CHANGERS, path.join(out, 'embers-of-tarn.rule-changers.json'));
  return out;
}

/** The digest of the fixture pages, written by a `--from` run that can't reach the network. */
function digestOf(dir = pages(), out = outDir(), pinNames = PIN_NAMES) {
  const r = run([SLUG, '--from', dir, '--out', out, '--pin-names', pinNames], { preload: NO_NETWORK });
  expect({ code: r.code, stderr: r.stderr }).toEqual({ code: 0, stderr: '' });
  return { out, file: path.join(out, FILE), text: fs.readFileSync(path.join(out, FILE), 'utf8'), stdout: r.stdout };
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
  entry("Kerr's Cinder Lattice", 'kerrs-cinder-lattice', 'gem', ['Support', 'Fire', 'AoE'], true, URL('Kerrs_Cinder_Lattice'), one(
    'Supports Skills that deal Fire damage. Supported Skills leave a lattice of embers where they hit, which Ignites enemies standing in it.',
  )),
  entry('Bellows Of Ruin', 'bellows-of-ruin', 'gem', ['Support', 'Attack', 'Slam'], true, URL('Bellows_Of_Ruin'), one(
    'Supports Slams you use yourself, letting each one spend Runic Ward to Empower the next. An Empowered Slam leaves a burning crater.',
    'The crater collapses after a duration. Cannot support Channelling Skills.',
  )),
  entry('Tarnished Infusion', 'tarnished-infusion', 'gem', ['Spell', 'Cooldown'], false, URL('Tarnished_Infusion'), one(
    'Spends Ward to create Ember Infusions, which count as any Elemental Infusion.',
  )),
  entry("Tarn's Clasp", 'tarns-clasp', 'unique', ['Coral Ring'], true, URL('Tarns_Clasp'), one(
    'Requires: Level 30',
    '+(8—12)% to Fire Resistance',
    '+(5—10) to Strength',
    'Fire Skills which create Ground Surfaces count',
    'as creating Ignited Ground',
  )),
  entry('Echoes', 'echoes', 'unique', ['Opal'], false, URL('Echoes'), [
    { label: 'Text (variant 1 of 2)', lines: ['Grants 2 Hollow Jewel sockets', 'Corrupted'] },
    { label: 'Text (variant 2 of 2)', lines: ['Grants 3 Hollow Jewel sockets', 'Corrupted'] },
  ]),
  entry('Fourfold Cord', 'fourfold-cord', 'unique', ['Rope Belt'], true, URL('Fourfold_Cord'), one(
    'Has (1—2) Charm Slots',
    'Echoing Draught',
    'Echoing Draught',
    'Echoing Draught',
    'Charms gain 0.5 charges per second',
  )),
  entry("Ferryman's Lantern", 'ferrymans-lantern', 'unique', ['Brass Sceptre'], true, URL('Ferrymans_Lantern'), one(
    'Requires: Level 44, 60 Int',
    'Grants Skill: Level 14 Tollbearer',
    'Minions have +(10—15)% to all Elemental Resistances',
  )),
  entry('Legacy of Cinderhelm', 'legacy-of-cinderhelm', 'item', ['SoulCore'], true, URL('Legacy_of_Cinderhelm'), one(
    "Limited to: 1 Tarn's Legacy",
    'Requires: Level 60',
    'Helmets: +1 to maximum Runic Ward per 5 Intelligence',
    'Bonded:',
    'Helmets: 1% increased Spell Damage per 20 Intelligence',
  )),
  entry('Legacy of Ashen Grip', 'legacy-of-ashen-grip', 'item', ['SoulCore'], false, URL('Legacy_of_Ashen_Grip'), one(
    "Limited to: 1 Tarn's Legacy",
    'Requires: Level 65',
    'Gloves: Attacks with Weapons always deal their maximum Fire Damage',
    'Bonded:',
    'Gloves: 10% increased Fire Damage',
  )),
  entry('Rune of Smouldering', 'rune-of-smouldering', 'item', ['SoulCore'], false, URL('Rune_of_Smouldering'), one(
    'Requires: Level 20',
    'Socket-bound',
    'Spear or Flail: Gain 3 Embers on Hit, -5 to Maximum Embers',
    'Spear or Flail: (untranslated stat: ember decay rate +% [-10])',
  )),
  entry('Coral Loop', 'coral-loop', 'item', ['Ring'], true, URL('Coral_Loop'), one(
    'Requires: Level 38',
    'This item counts as a Belt for Socketed Items',
  )),
  // poe2db prints a quest item's lines twice over: one is kept. A unique's repeated lines (Fourfold Cord) are its own.
  entry('Crown of the Drowned', 'crown-of-the-drowned', 'item', ['MapFragment', 'QuestItem'], false, URL('Crown_of_the_Drowned'), one(
    'Take this to the Ferryman at Tarn Landing.',
  )),
  entry('Omen of Banked Embers', 'omen-of-banked-embers', 'item', ['Omen'], false, URL('Omen_of_Banked_Embers'), one(
    'While this item is active in your inventory your next',
    'Orb of Kindling adds two Ember modifiers',
    'instead of one',
  )),
  { name: 'Legacy of Ferrous Mantle', fields: { Id: 'legacy-of-ferrous-mantle', Kind: 'item', Tags: 'none', 'In pin': 'yes', URL: 'none', Fetched: SAVED_DAY, Text: 'none' }, texts: [] },
  entry('Ashen Herald', 'ashen-herald', 'ascendancy', null, true, URL('Ashen_Herald'), []),
  entry('Kindled Resolve', 'kindled-resolve', 'passive', null, false, URL('Kindled_Resolve'), []),
];

/** The fixture digest's head: a unique's line quotes its first explicit line, or a line that grants a skill, never its
 * base's implicit (Tarn's Clasp, Fourfold Cord, Ferryman's Lantern). */
const HEAD = [
  "- Kerr's Cinder Lattice (gem, Support): Supports Skills that deal Fire damage.",
  '- Bellows Of Ruin (gem, Support): Supports Slams you use yourself, letting each one spend Runic Ward to Empower the next.',
  '- Tarnished Infusion (gem, Spell): Spends Ward to create Ember Infusions, which count as any Elemental Infusion. [not in pin]',
  "- Tarn's Clasp (unique, Coral Ring): +(5—10) to Strength",
  '- Echoes (unique, Opal): Grants 2 Hollow Jewel sockets [not in pin]',
  '- Fourfold Cord (unique, Rope Belt): Echoing Draught',
  "- Ferryman's Lantern (unique, Brass Sceptre): Grants Skill: Level 14 Tollbearer",
  '- Socketables (3): runes, soul cores and idols, in the body; Grep it by mechanic.',
  '- Legacy of Ashen Grip (item, SoulCore) [rule]: in gloves, weapon attacks always deal their maximum Fire damage [not in pin]',
  '- Coral Loop (item, Ring): This item counts as a Belt for Socketed Items',
  '- Crown of the Drowned (item, MapFragment): Take this to the Ferryman at Tarn Landing. [not in pin]',
  '- Omen of Banked Embers (item, Omen): While this item is active in your inventory your next Orb of Kindling adds two Ember … [not in pin]',
  '- Legacy of Ferrous Mantle (item)',
  '- Ashen Herald (ascendancy)',
  '- Kindled Resolve (passive) [not in pin]',
];

describe('league-digest.mjs (WU-84, D-400): a poe2db section as data/league/<slug>.md, flagged in the pin or not', () => {
  it('AC-W70: the parser yields every entry with its kind, tags, text and URL, and the ascendancies and passives with name and URL only', () => {
    const { text } = digestOf();
    expect(blocks(text)).toEqual(EXPECTED);
    // An ascendancy or a passive has no tags and no text; another block's ascendancy (Tidecaller, in the 0.9.1 block),
    // one only a script names (Thornkeeper) and the block's other links (Ferryman, Tarn's Legacy, the lists) are no
    // entries.
    for (const b of blocks(text).filter((x) => x.fields.Kind === 'ascendancy' || x.fields.Kind === 'passive')) {
      expect(Object.keys(b.fields)).toEqual(['Id', 'Kind', 'In pin', 'URL', 'Fetched']);
      expect(b.texts).toEqual([]);
    }
    expect(text).not.toMatch(/Tidecaller|Thornkeeper|### Ferryman$|### Tarn's Legacy/m);
  });

  it('AC-W70: currency is left out: the entry poe2db marks as currency is in neither the head nor the body, even with its name in the pin', () => {
    const { text, stdout } = digestOf();
    expect(text).not.toContain('### Orb of Kindling');
    expect(text).not.toContain('Adds an Ember modifier to a Rare item');
    expect(text).toContain('Currency is left out (1 entry: what poe2db marks as currency). Socketables (runes, soul cores and idols) are in the body;');
    expect(stdout).toContain('Currency left out: 1.');
    // The socketables poe2db doesn't mark as currency stay.
    expect(blocks(text).filter((b) => b.fields.Tags === 'SoulCore').map((b) => b.name)).toEqual(['Legacy of Cinderhelm', 'Legacy of Ashen Grip', 'Rune of Smouldering']);
  });

  it('AC-W70: the in-pin flag is right for a known and an unknown name, checked against the fixture name list, not vendor/', () => {
    const { text } = digestOf();
    const flag = (name: string) => blocks(text).find((b) => b.name === name)!.fields['In pin'];
    expect(flag("Kerr's Cinder Lattice")).toBe('yes');
    expect(flag('Tarnished Infusion')).toBe('no');
    expect(headOf(text)).toContain("- Kerr's Cinder Lattice (gem, Support): Supports Skills that deal Fire damage.");
    expect(headOf(text)).toContain('- Tarnished Infusion (gem, Spell): Spends Ward to create Ember Infusions, which count as any Elemental Infusion. [not in pin]');
    // Names compare without case or curly quotes, and only within their kind.
    expect(flag('Bellows Of Ruin')).toBe('yes');
    expect(flag("Tarn's Clasp")).toBe('yes');
    expect(flag('Kindled Resolve')).toBe('no');
    expect(text).toContain('In-pin flags: checked against the fixture name list on');
    expect(text).toContain('Entries: 3 gems, 4 uniques, 7 items, 1 ascendancy, 1 passive; 9 of the 16 in the pin.');
  });

  it('AC-W70: no test touches the network: a --from run never calls fetch (it throws in the child), and makes its file from the saved pages alone', () => {
    const dir = pages();
    const out = newDir('out');
    const r = run([SLUG, '--from', dir, '--out', out, '--pin-names', PIN_NAMES], { preload: NO_NETWORK });
    expect({ code: r.code, stderr: r.stderr }).toEqual({ code: 0, stderr: '' });
    expect(r.stdout).not.toContain('saving the pages');
    expect(fs.readdirSync(out)).toEqual([FILE]);
    // The preload works: a run that fetches is refused under it.
    const live = run([SLUG, '--save', newDir('save'), '--out', newDir('out'), '--pin-names', PIN_NAMES], { preload: NO_NETWORK });
    expect(live.code).toBe(1);
    expect(live.stderr).toBe('league-digest: refused: https://poe2db.tw/us/: the test forbids the network\n');
  });

  it("names the section and its fetch date in the first three lines (the runner's head -3), then a head line per entry in body order, the socketables giving way to one line and a [rule] line for each judged rule changer", () => {
    const { text } = digestOf();
    expect(text.split('\n').slice(0, 3)).toEqual([
      '# League digest: Embers of Tarn',
      '',
      `Embers of Tarn (Sunken Crowns 0.9) on poe2db.tw, fetched ${SAVED_DAY}. In-pin flags: checked against the fixture name list on ${day(new Date())}.`,
    ]);
    expect(text).toContain('Cite an entry by its id: `data | league/embers-of-tarn.md#<id>`.');
    expect(headOf(text)).toEqual(HEAD);
  });

  it('keeps every socketable in the body; with no judgments the head has only their one line, and a judgment naming no socketable of the digest is refused', () => {
    const { text } = digestOf(pages(), newDir('out'));
    expect(headOf(text).filter((l) => l.includes('SoulCore') || l.startsWith('- Socketables'))).toEqual(['- Socketables (3): runes, soul cores and idols, in the body; Grep it by mechanic.']);
    expect(blocks(text).filter((b) => b.fields.Tags === 'SoulCore').map((b) => b.fields.Id)).toEqual(['legacy-of-cinderhelm', 'legacy-of-ashen-grip', 'rune-of-smouldering']);
    for (const [judgments, why] of [
      [{ ruleChangers: { 'coral-loop': 'a ring that takes belt socketables' } }, '"coral-loop" isn\'t a socketable of this digest'],
      [{ ruleChangers: { 'legacy-of-ashen-grip': '' } }, '"legacy-of-ashen-grip" needs its why as one line'],
      [{ ashenGrip: 'no ruleChangers object' }, 'no "ruleChangers" object of id → why'],
    ] as const) {
      const out = newDir('out');
      const sidecar = path.join(out, 'embers-of-tarn.rule-changers.json');
      fs.writeFileSync(sidecar, JSON.stringify(judgments));
      const r = run([SLUG, '--from', pages(), '--out', out, '--pin-names', PIN_NAMES], { preload: NO_NETWORK });
      expect({ code: r.code, stderr: r.stderr, files: fs.readdirSync(out) }).toEqual({ code: 1, stderr: `league-digest: refused: ${sidecar}: ${why}\n`, files: ['embers-of-tarn.rule-changers.json'] });
    }
  });

  it('fetches the homepage, then each list its block links, one at a time and 3 s apart, with the User-Agent and no cookie; a 429 waits 60 s for its one retry; each page is saved (stubbed fetch, no network)', () => {
    const served = pages();
    const save = newDir('save');
    const out = outDir();
    const log = path.join(newDir('log'), 'requests.jsonl');
    const uniques = URL('Embers_of_Tarn_uniques');
    const r = run([SLUG, '--save', save, '--out', out, '--pin-names', PIN_NAMES], {
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
      request(URL('Embers_of_Tarn_gems')),
      { wait: 3000 },
      request(uniques),
      { wait: 60000 },
      { wait: 3000 },
      request(uniques),
      { wait: 3000 },
      request(URL('Embers_of_Tarn_items')),
    ]);
    expect(fs.readdirSync(save).sort()).toEqual(['Embers_of_Tarn_gems.html', 'Embers_of_Tarn_items.html', 'Embers_of_Tarn_uniques.html', 'home.html']);
    expect(r.stdout.split('\n')[0]).toBe(`league-digest: saving the pages to ${save} (re-run with --from ${save} to make no request)`);
    // The fetched digest is the saved pages' digest, fetched today.
    const fetched = fs.readFileSync(path.join(out, FILE), 'utf8');
    expect(fetched.replaceAll(`fetched ${day(new Date())}.`, `fetched ${SAVED_DAY}.`).replaceAll(`- Fetched: ${day(new Date())}`, `- Fetched: ${SAVED_DAY}`)).toBe(digestOf().text);
  });

  it('refuses after a second 429 or 5xx, writing no digest; the pages fetched so far stay saved', () => {
    const save = newDir('save');
    const out = newDir('out');
    const log = path.join(newDir('log'), 'requests.jsonl');
    const gems = URL('Embers_of_Tarn_gems');
    const r = run([SLUG, '--save', save, '--out', out, '--pin-names', PIN_NAMES], {
      preload: STUB,
      env: { STUB_PAGES: pages(), STUB_LOG: log, STUB_FAIL: JSON.stringify([[gems, [503, 503]]]) },
    });
    expect(r.code).toBe(1);
    expect(r.stderr).toBe(`[league-digest] ${gems}: HTTP 503; one retry after 60 s\nleague-digest: refused: ${gems}: HTTP 503\n`);
    expect(fs.readFileSync(log, 'utf8').trim().split('\n').filter((l) => l.includes('"url"')).length).toBe(3);
    expect(fs.readdirSync(out)).toEqual([]);
    expect(fs.readdirSync(save)).toEqual(['home.html']);
  });

  it('follows a redirect to another poe2db.tw page as a request of its own, and refuses one that leaves poe2db.tw without a request to it (stubbed fetch, no network)', () => {
    const served = pages();
    fs.copyFileSync(path.join(served, 'Embers_of_Tarn_gems.html'), path.join(served, 'Embers_of_Tarn_gem_list.html'));
    const gems = URL('Embers_of_Tarn_gems');
    const moved = URL('Embers_of_Tarn_gem_list');
    const headers = { 'User-Agent': `pob2-mcp-server/${VERSION}`, Accept: 'text/html' };
    const request = (url: string) => ({ url, options: ['headers', 'redirect'], headers });
    const followed = (() => {
      const save = newDir('save');
      const log = path.join(newDir('log'), 'requests.jsonl');
      const r = run([SLUG, '--save', save, '--out', outDir(), '--pin-names', PIN_NAMES], { preload: STUB, env: { STUB_PAGES: served, STUB_LOG: log, STUB_REDIRECT: JSON.stringify([[gems, '/us/Embers_of_Tarn_gem_list']]) } });
      expect({ code: r.code, stderr: r.stderr }).toEqual({ code: 0, stderr: '' });
      return { log: fs.readFileSync(log, 'utf8').trim().split('\n').map((l) => JSON.parse(l)), save };
    })();
    expect(followed.log.filter((e) => e.url).map((e) => e.url)).toEqual([URL(''), gems, moved, URL('Embers_of_Tarn_uniques'), URL('Embers_of_Tarn_items')]);
    expect(followed.log.slice(2, 5)).toEqual([request(gems), { wait: 3000 }, request(moved)]);
    expect(fs.readdirSync(followed.save).sort()).toEqual(['Embers_of_Tarn_gems.html', 'Embers_of_Tarn_items.html', 'Embers_of_Tarn_uniques.html', 'home.html']);

    const items = URL('Embers_of_Tarn_items');
    const out = newDir('out');
    const log = path.join(newDir('log'), 'requests.jsonl');
    const r = run([SLUG, '--save', newDir('save'), '--out', out, '--pin-names', PIN_NAMES], { preload: STUB, env: { STUB_PAGES: served, STUB_LOG: log, STUB_REDIRECT: JSON.stringify([[items, 'https://mirror.example/Embers_of_Tarn_items']]) } });
    expect({ code: r.code, stderr: r.stderr }).toEqual({ code: 1, stderr: `league-digest: refused: ${items}: redirected off poe2db.tw, to https://mirror.example/Embers_of_Tarn_items; not followed\n` });
    const urls = fs.readFileSync(log, 'utf8').trim().split('\n').map((l) => JSON.parse(l)).filter((e) => e.url).map((e) => e.url);
    expect(urls).toEqual([URL(''), gems, URL('Embers_of_Tarn_uniques'), items]);
    expect(fs.readdirSync(out)).toEqual([]);
  });

  it("keeps an entry's id through a later digest that adds a same-name entry of another kind; a new entry takes its slug, or its slug and kind when another has it", () => {
    const gemNamedEchoes = {
      file: 'Embers_of_Tarn_gems.html',
      from: '<div class="row row-cols-1 row-cols-lg-2 g-2 bg-dark">',
      to: '<div class="row row-cols-1 row-cols-lg-2 g-2 bg-dark"><div class="col"><div class="d-flex border-top rounded"><div class="flex-shrink-0"></div><div class="flex-grow-1 ms-2"><div><a class="gemitem" href="/us/Echoes_gem">Echoes</a></div><div class="default"><a class="GemTags" href="Spell">Spell</a></div>Repeats your last Spell.</div></div></div>',
    };
    const recount = { file: 'Embers_of_Tarn_gems.html', from: 'Embers of Tarn Gem /3 ', to: 'Embers of Tarn Gem /4 ' };
    const ids = (text: string) => blocks(text).filter((b) => b.name === 'Echoes').map((b) => [b.fields.Kind, b.fields.Id]);
    const first = digestOf();
    expect(ids(first.text)).toEqual([['unique', 'echoes']]);
    const later = digestOf(pages([gemNamedEchoes, recount]), first.out);
    expect(ids(later.text)).toEqual([['gem', 'echoes-gem'], ['unique', 'echoes']]);
    expect(later.stdout).toContain('Added since the last digest (1):\n- Echoes (gem)\n');
    // Without a digest to replace, the ids follow the order of kinds: the gem takes the slug.
    expect(ids(digestOf(pages([gemNamedEchoes, recount])).text)).toEqual([['gem', 'echoes'], ['unique', 'echoes-unique']]);
  });

  it('--reflag re-checks only the in-pin flags of a committed digest: each block, its head marker, the count and the pin line; nothing else moves', () => {
    const { file, text, out } = digestOf();
    const names = JSON.parse(fs.readFileSync(PIN_NAMES, 'utf8'));
    const upgraded = path.join(newDir('pin'), 'upgraded.json');
    fs.writeFileSync(upgraded, JSON.stringify({ ...names, pin: 'the upgraded list', passive: ['Kindled Resolve'], item: [...names.item.filter((n: string) => n !== 'Coral Loop'), 'Legacy of Ashen Grip', 'Rune of Smouldering'] }));
    const r = run(['--reflag', 'embers-of-tarn', '--out', out, '--pin-names', upgraded], { preload: NO_NETWORK });
    expect({ code: r.code, stderr: r.stderr }).toEqual({ code: 0, stderr: '' });
    expect(r.stdout).toBe(`league-digest: re-flagged ${file} against the upgraded list: 11 of the 16 in the pin.\nNow in the pin: Legacy of Ashen Grip (item), Rune of Smouldering (item), Kindled Resolve (passive).\nNo longer in the pin: Coral Loop (item).\n`);
    const today = day(new Date());
    const expected = text
      .replace(`checked against the fixture name list on ${today}.`, `checked against the upgraded list on ${today}.`)
      .replace('- Coral Loop (item, Ring): This item counts as a Belt for Socketed Items', '- Coral Loop (item, Ring): This item counts as a Belt for Socketed Items [not in pin]')
      .replace('- Kindled Resolve (passive) [not in pin]', '- Kindled Resolve (passive)')
      .replace('maximum Fire damage [not in pin]', 'maximum Fire damage')
      .replace('; 9 of the 16 in the pin.', '; 11 of the 16 in the pin.')
      .replace(/(### Legacy of Ashen Grip\n(?:- .*\n)*?)- In pin: no/, '$1- In pin: yes')
      .replace(/(### Rune of Smouldering\n(?:- .*\n)*?)- In pin: no/, '$1- In pin: yes')
      .replace(/(### Coral Loop\n(?:- .*\n)*?)- In pin: yes/, '$1- In pin: no')
      .replace(/(### Kindled Resolve\n(?:- .*\n)*?)- In pin: no/, '$1- In pin: yes');
    expect(fs.readFileSync(file, 'utf8')).toBe(expected);
    // The poe2db slug works as well, and the same list changes nothing.
    const again = run(['--reflag', SLUG, '--out', out, '--pin-names', upgraded]);
    expect(again.stdout).toBe(`league-digest: re-flagged ${file} against the upgraded list: 11 of the 16 in the pin.\nNo flag changed.\n`);
    expect(fs.readFileSync(file, 'utf8')).toBe(expected);
  });

  it('prints the entries added since the digest it replaces', () => {
    const dir = pages({ file: 'Embers_of_Tarn_gems.html', from: 'Embers of Tarn Gem /3 ', to: 'Embers of Tarn Gem /2 ' });
    // Drop the gem list's last column: Tarnished Infusion.
    const gemsFile = path.join(dir, 'Embers_of_Tarn_gems.html');
    const gems = fs.readFileSync(gemsFile, 'utf8');
    const last = gems.lastIndexOf('<div class="col">');
    const end = '</div>\n          </div>\n        </div>\n';
    fs.writeFileSync(gemsFile, gems.slice(0, last) + gems.slice(gems.indexOf(end, last) + end.length));
    fs.utimesSync(gemsFile, SAVED, SAVED);
    const first = digestOf(dir);
    expect(first.stdout).toBe(`league-digest: wrote ${first.file}. Entries: 2 gems, 4 uniques, 7 items, 1 ascendancy, 1 passive; 9 of the 15 in the pin. Currency left out: 1.\nAdded: the first digest of Embers_of_Tarn, so all 15 entries are new.\n`);
    const second = digestOf(pages(), first.out);
    expect(second.stdout).toBe(`league-digest: wrote ${first.file}. Entries: 3 gems, 4 uniques, 7 items, 1 ascendancy, 1 passive; 9 of the 16 in the pin. Currency left out: 1.\nAdded since the last digest (1):\n- Tarnished Infusion (gem)\n`);
    const third = digestOf(pages(), first.out);
    expect(third.stdout.split('\n')[1]).toBe('Added since the last digest: none.');
  });

  it("refuses, writing nothing, a list page whose entries aren't its header's count, a section the homepage doesn't link and a missing page; a bad command line is a usage error", () => {
    const refused = (args: string[], message: string) => {
      const out = newDir('out');
      const r = run([...args, '--out', out, '--pin-names', PIN_NAMES], { preload: NO_NETWORK });
      expect({ code: r.code, stderr: r.stderr, files: fs.readdirSync(out) }).toEqual({ code: 1, stderr: `league-digest: refused: ${message}\n`, files: [] });
    };
    refused([SLUG, '--from', pages({ file: 'Embers_of_Tarn_items.html', from: 'Item /9 ', to: 'Item /10 ' })], "the items page's header counts 10 entries but 9 were parsed: poe2db changed its page");
    refused([SLUG, '--from', pages({ file: 'Embers_of_Tarn_uniques.html', from: '<span class="uniqueName">Tarn\'s Clasp</span>', to: '' })], 'a unique with no name: poe2db changed its page');
    refused(['Veiled_Tides', '--from', pages()], 'the homepage has no section block linking Veiled_Tides_gems, Veiled_Tides_uniques or Veiled_Tides_items: check the slug, or poe2db changed its homepage');
    const dir = pages();
    refused(['Saltmarsh_Rites', '--from', dir], `${path.join(dir, 'Saltmarsh_Rites_items.html')} is missing`);
    const empty = newDir('out');
    const reflag = run(['--reflag', SLUG, '--out', empty, '--pin-names', PIN_NAMES], { preload: NO_NETWORK });
    expect({ code: reflag.code, stderr: reflag.stderr }).toEqual({ code: 1, stderr: `league-digest: refused: ${path.join(empty, FILE)} is missing\n` });
    for (const args of [[], ['embers-of-tarn', '--from', dir], [SLUG, '--bogus'], [SLUG, 'Other'], ['--reflag', SLUG, '--from', dir], [SLUG, '--out']]) {
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
    const judgments = JSON.parse(fs.readFileSync(path.join(path.dirname(DIGEST), 'runes-of-aldur.rule-changers.json'), 'utf8'));
    // The judgments file opens with the criterion they were judged by.
    expect(Object.keys(judgments)).toEqual(['criterion', 'ruleChangers']);
    expect(judgments.criterion).toMatch(/^A socketable is a rule changer when .* It is not one when it adds or scales a number/);
    const judged: Record<string, string> = judgments.ruleChangers;
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
