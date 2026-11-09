/**
 * Amendment 16's M-30, WU-163 (D-520, C-64, Appendix A.10): `/pob2:pricing`'s rules in the run checker, each script
 * spawned as a real `node` process with an explicit env and the test clock (`BUILD_GUIDE_TEST_NOW`,
 * `tests/helpers/runningDigests.ts`'s `TEST_NOW`).
 *
 * AC-W155 (its unit parts):
 * - `placement` gives `m`, `b` and `n` on three fixture price sets and `n` for a dear unique (choice B), each placed
 *   right passing and placed wrong failing; it takes the player's word only when the cost can't place the character,
 *   fails a stage placed below the endgame, a slot priced by no entry and a place line that isn't the plan's; and on
 *   the importer fixture read at level 50 by the real file reader (choice A) the place is "in the campaign".
 * - `owned-spec` passes §16's spec on the importer fixture's owned rares (a fractured, a crafted and a desecrated line, a
 *   corrupted item's implicits left out, a roll read at its `{range:}`) and fails each planted fault.
 * - `upgrades.json` holds Appendix A.10's shape, a slot without a cookie its link alone, and fails each planted fault.
 * - The offline fixture run passes; its rules are pricing's, which a compile run isn't held to.
 * - The fix round: the gems count in the whole cost (a character they move off `m`); on `n` over 200 divines the place
 *   says so; an online run's searches line never exceeds its notice's bound; a thin retry's dropped must-have is in
 *   `leftOut`; an owned rare's `ok` price carries its spec; each depth-check fault fails on its own.
 *
 * check-run loads the server's compiled `build/plan/`: `mise run test` builds first.
 */
import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { spawnSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { startTestServer, type TestServer } from '../helpers/server';
import { TEST_NOW } from '../helpers/runningDigests';

type Json = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

const REPO = path.resolve(__dirname, '..', '..');
const SCRIPTS = path.join(REPO, 'skills', 'build-guide', 'scripts');
const CHECKER = path.join(SCRIPTS, 'check-run.mjs');
const RUN_LOG = path.join(SCRIPTS, 'run-log.mjs');
const PRICING_RUN = path.join(REPO, 'tests', 'fixtures', 'pieces', 'pricing-run');
const IMPORTER = path.join(REPO, 'tests', 'fixtures', 'builds', 'imported-character.xml');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'pricing-piece-'));
afterAll(() => fs.rmSync(TMP, { recursive: true, force: true }));

const ENV = { PATH: '/usr/bin:/bin', LANG: 'C', BUILD_GUIDE_TEST_NOW: TEST_NOW };
function node(script: string, args: string[]) {
  const r = spawnSync(process.execPath, [script, ...args], { cwd: TMP, env: ENV, encoding: 'utf8', timeout: 60000 });
  return { code: r.status, stdout: r.stdout, stderr: r.stderr };
}
const check = (dir: string) => node(CHECKER, [dir]);
/** The broken rule's lines on stderr. */
const lines = (stderr: string, rule: string) => stderr.split('\n').filter((l) => l.startsWith(`check-run: [${rule}] `));
/** Every rule a checker's stderr names. */
const rulesIn = (stderr: string) => [...new Set(stderr.split('\n').map((l) => /^check-run: \[([^\]]+)\] /.exec(l)?.[1]).filter((x): x is string => x !== undefined))];
function passes(dir: string): void {
  const r = check(dir);
  expect({ stderr: r.stderr, code: r.code }).toEqual({ stderr: '', code: 0 });
}
const readJson = (dir: string, rel: string): Json => JSON.parse(fs.readFileSync(path.join(dir, rel), 'utf8')) as Json;
const writeJson = (dir: string, rel: string, v: unknown) => fs.writeFileSync(path.join(dir, rel), `${JSON.stringify(v, null, 2)}\n`);
function editJson(dir: string, rel: string, edit: (v: Json) => void): void {
  const v = readJson(dir, rel);
  edit(v);
  writeJson(dir, rel, v);
}

let copies = 0;
/** A copy of the offline pricing fixture run in its own guides root, `<root>/pricing/<date>-1/`. */
function fixtureRun(): string {
  const dir = path.join(TMP, `root-${++copies}`, 'pricing', '2026-12-01-1');
  fs.mkdirSync(path.dirname(dir), { recursive: true });
  fs.cpSync(PRICING_RUN, dir, { recursive: true });
  editJson(dir, 'run-log.json', (l) => {
    l.runFolder = dir;
  });
  return dir;
}

const LEAGUE = 'Forbidden Rites';
/** Seen on day 36 of Forbidden Rites (2026-09-04, `data/economy/prices.json`): not late, so D-373's rows apply as they are. */
const SEEN = '2026-10-10';
const LIFE = 'explicit.stat_3299347043';
const COLD = 'explicit.stat_4220027924';
const FIRE = 'explicit.stat_3372524247';
const CHAOS = 'explicit.stat_2923486259';
const SPEED = 'explicit.stat_2250533757';
const tag = (what: string) => ({ kind: 'judgment', ref: `the character's own ${what}, from its file`, confidence: 'H' });
const VARIANT = { m: 'entering-maps', b: 'budget', n: 'non-budget' } as const;
const WORDS = { m: 'entering maps (m)', b: 'budget (b)', n: 'non-budget (n)', campaign: 'in the campaign' } as const;
type Place = keyof typeof WORDS;

/**
 * Three owned items, a rare helmet, a rare pair of boots with a rune in its socket and a unique amulet, on the pin's bases;
 * their specs' tiers are the pin's (`Data/ModItem.lua`, T1 the best the base can roll): the helmet's life 60 is Stout's
 * (60-69), T6 under Fecund's; cold 35 the Polar Bear's (31-35), T3; fire 28 the Furnace's (26-30), T4; the boots' 30%
 * movement speed Cheetah's, T2 under Hellion's 35%; life 70 Robust's (70-84), T4; lightning 30 the Tempest's (26-30), T4.
 */
const SLOTS = [
  { slot: 'Helmet', text: 'Rarity: RARE\nDoom Visor\nSoldier Greathelm\nItem Level: 82\nImplicits: 0\n+60 to maximum Life\n+35% to Cold Resistance\n+28% to Fire Resistance', owned: true },
  { slot: 'Boots', text: 'Rarity: RARE\nGale Stride\nLizardscale Boots\nItem Level: 80\nSockets: S\nRune: Greater Iron Rune\nImplicits: 1\n{enchant}{rune}18% increased Armour, Evasion and Energy Shield\n30% increased Movement Speed\n+70 to maximum Life\n+30% to Lightning Resistance', owned: true },
  { slot: 'Amulet', text: 'Rarity: UNIQUE\nChoir of the Storm\nJade Amulet\nImplicits: 2\nGrants Skill: Level 20 Lightning Bolt\n+12 to Dexterity\n+75% to Lightning Resistance', owned: true },
];
const HELMET_SPEC = {
  base: 'Soldier Greathelm',
  weights: [{ stat: 'FullDPS', weight: 1 }, { stat: 'TotalEHP', weight: 0.5 }],
  ranking: [{ affix: '# to maximum Life', gain: 1.9, weight: 0.0142 }, { affix: '#% to Cold Resistance', gain: 1.2, weight: 0.03 }, { affix: '#% to Fire Resistance', gain: 1.1, weight: 0.031 }, { affix: '#% increased Armour', gain: 0.6, weight: 0.006 }],
  mustHaves: [{ affix: '# to maximum Life', tradeId: LIFE, tier: 6, min: 60 }, { affix: '#% to Cold Resistance', tradeId: COLD, tier: 3, min: 31 }, { affix: '#% to Fire Resistance', tradeId: FIRE, tier: 4, min: 26 }],
  leftOut: [],
  searches: 1,
};
const BOOTS_SPEC = {
  base: 'Lizardscale Boots',
  weights: [{ stat: 'FullDPS', weight: 1 }, { stat: 'TotalEHP', weight: 0.5 }, { stat: 'EffectiveMovementSpeedMod', weight: 0.5, why: 'boots carry the movement speed the character runs with' }],
  ranking: null,
  mustHaves: [{ affix: '#% increased Movement Speed', tradeId: SPEED, tier: 2, min: 30, zeroScored: true }, { affix: '# to maximum Life', tradeId: LIFE, tier: 4, min: 70 }, { affix: '#% to Lightning Resistance', tradeId: 'explicit.stat_1671376347', tier: 4, min: 26 }],
  leftOut: [],
  searches: 1,
};
const depth = (base: string, spec: Json) => ({ league: LEAGUE, item_type: base, mods: spec.mustHaves.map((m: Json) => ({ stat_id: m.tradeId, min: m.min })), corrupted: false, limit: 10 });

/** The price entries of a set, in divines unless said: the helmet, the boots, the boots' rune and the amulet. */
function priceSet(d: { helmet: number; boots: number; rune: number; amulet: number }): Json[] {
  const ok = (id: string, item: string, query: Json, amount: number, currency = 'divine', extra: Json = {}) => ({ id, item, query, amount, currency, date: SEEN, league: LEAGUE, status: 'ok', note: '12 found, the 5th cheapest', ...extra });
  return [
    { id: 'rate-exalted', item: 'Exalted Orb', query: { rates: 'exalted', league: LEAGUE }, amount: 0.0025, currency: 'divine', date: SEEN, league: LEAGUE, status: 'ok', note: '400 exalts a divine' },
    ok('f-helmet', 'Soldier Greathelm: life, cold and fire resistance', { slot: 'Helmet', ...depth('Soldier Greathelm', HELMET_SPEC) }, d.helmet, 'divine', { listing: { corrupted: false, sockets: 0, count: 12, position: 5 }, spec: HELMET_SPEC }),
    ok('f-boots', 'Lizardscale Boots: movement speed, life, lightning resistance', { slot: 'Boots', ...depth('Lizardscale Boots', BOOTS_SPEC), min_rune_sockets: 1 }, d.boots, 'divine', { listing: { corrupted: false, sockets: 1, count: 12, position: 5 }, spec: BOOTS_SPEC }),
    ok('f-boots-socket-1', 'Greater Iron Rune', { slot: 'Boots', socket: 1, exchange: 'Runes', name: 'Greater Iron Rune' }, d.rune * 400, 'exalted', { note: 'exchange value' }),
    ok('f-amulet', 'Choir of the Storm', { slot: 'Amulet', item_name: 'Choir of the Storm', league: LEAGUE }, d.amulet),
  ];
}

/**
 * An online pricing run from the offline fixture: the three items owned on the read stage at `level`, the prices given,
 * placed on `place` (the stage renamed, A.5) with prices.md's place line on `basis`.
 */
function onlineRun(prices: Json[], place: Place, basis = 'by the replace cost', level = 90): string {
  const dir = fixtureRun();
  editJson(dir, 'run-log.json', (l) => {
    l.mode = 'online';
    l.stages[1].priceOutcomes = { ok: 4, exchange: 1 };
  });
  editJson(dir, 'plan.json', (p) => {
    p.league = LEAGUE;
    const s = p.stages[0];
    s.level = level;
    s.items.slots = SLOTS.map((x) => ({ ...x }));
    p.prices = prices;
    placeStage(s, place, level);
  });
  writePlace(dir, place, basis);
  return dir;
}
/** Places a read stage on a rung (A.5), or leaves it `f`, in the campaign. */
function placeStage(s: Json, place: Place, level: number): void {
  for (const k of ['variant', 'ascendancyPoints', 'variantBasis']) delete s[k];
  if (place === 'campaign') {
    s.id = 'f';
    s.loadoutName = `Endgame (L${level}) {f}`;
    return;
  }
  // The read stage's fields in the schema's order: the variant fields after progress.
  const entries = Object.entries(s).filter(([k]) => !['id', 'loadoutName'].includes(k));
  for (const k of Object.keys(s)) delete s[k];
  Object.assign(s, { id: place, loadoutName: `Endgame (L${level}) {${place}}` });
  for (const [k, v] of entries) {
    s[k] = v;
    if (k === 'progress') Object.assign(s, { variant: VARIANT[place], ascendancyPoints: 0, variantBasis: { level: tag('level'), gemLevels: tag('gem levels'), ascendancyPoints: tag('ascendancy points') } });
  }
}
/** prices.md's head, its searches line (made of at most announced, price.md's cap) and its place line on `basis`. */
function writePlace(dir: string, place: Place, basis: string, searches = 'Searches: 5 of at most 12.', why = 'Against the targets.'): void {
  fs.writeFileSync(path.join(dir, 'prices.md'), `# Prices: Fixture Titan (Endgame, level 90)\n\nLeague: ${LEAGUE}. Rates: 400 exalts a divine, seen ${SEEN}.\n${searches}\n\n## Place\n\nPlace: ${WORDS[place]}, ${basis}.\n${why}\n`);
}
/** price.md's gem entries (§16: uncut gems from the exchange), the fixture's three gems at `each` divines. */
const gemPrices = (each: number): Json[] =>
  [[1, 1, 'Blood Hunt: Uncut Skill Gem (Level 20)'], [1, 2, 'Bloodlust: Uncut Support Gem (Level 2)'], [2, 1, 'Rolling Slam: Uncut Skill Gem (Level 20)']].map(([group, gem, item]) => ({
    id: `f-gem-${group}-${gem}`, item, query: { group, gem, exchange: 'UncutGems', name: String(item).split(': ')[1] }, amount: each, currency: 'divine', date: SEEN, league: LEAGUE, status: 'ok', note: 'exchange value',
  }));

// ---------------------------------------------------------------------------------------------------
// placement
// ---------------------------------------------------------------------------------------------------

/** Day 36: under 10 divines to day 7 is ×0.4–0.9 (midpoint ×0.65), 10 or more ×0.2–0.4 (×0.3) (data/economy/prices.json). */
const SETS: Array<{ name: string; set: Parameters<typeof priceSet>[0]; rung: 'm' | 'b' | 'n' }> = [
  // 2 + 1 + 0.1 + 2 divines: about 3.3 at day 7, within m's 5 in all.
  { name: 'm: the whole cost within 5 divines', set: { helmet: 2, boots: 1, rune: 0.1, amulet: 2 }, rung: 'm' },
  // 6 + 5 + 0.1 + 6: about 11 in all, over m's 5; each rare and the unique about 3.9 or less, within b's 5.
  { name: 'b: over 5 in all, no rare or unique over about 5', set: { helmet: 6, boots: 5, rune: 0.1, amulet: 6 }, rung: 'b' },
  // A 30-divine helmet: about 9 at day 7, over b's 5 for a rare.
  { name: 'n: a rare over about 5 divines', set: { helmet: 30, boots: 5, rune: 0.1, amulet: 6 }, rung: 'n' },
  // Choice B: cheap rares, a 30-divine unique (about 9): one dear unique places it on n.
  { name: 'n for a dear unique (choice B)', set: { helmet: 2, boots: 1, rune: 0.1, amulet: 30 }, rung: 'n' },
];

describe('AC-W155 (WU-163, D-520): placement places a priced character on the ladder by its replace cost', () => {
  for (const { name, set, rung } of SETS) {
    it(`${name}: placed on ${rung} it passes; placed on another rung it fails, naming ${rung}`, () => {
      passes(onlineRun(priceSet(set), rung));
      for (const other of (['m', 'b', 'n'] as const).filter((r) => r !== rung)) {
        const r = check(onlineRun(priceSet(set), other));
        expect(rulesIn(r.stderr)).toEqual(['placement']);
        expect(lines(r.stderr, 'placement')).toEqual([expect.stringMatching(new RegExp(`read stage is on ${other}, but its replace cost places it on ${rung}: the whole cost is about`))]);
      }
    });
  }

  it("the player's word places it only when the cost can't: a known cost overrules it, an unavailable price leaves it", () => {
    const set = { helmet: 6, boots: 5, rune: 0.1, amulet: 6 };
    expect(lines(check(onlineRun(priceSet(set), 'n', "the user's word")).stderr, 'placement')).toEqual([expect.stringMatching(/is on n, but its replace cost places it on b/)]);
    // One price unavailable: the cost can't place it, so the player's rung stands, and "by the replace cost" is refused.
    const unknown = () => priceSet(set).map((p) => (p.id === 'f-amulet' ? { ...p, amount: null, currency: null, status: 'unavailable', note: 'rate-limited' } : p));
    passes(onlineRun(unknown(), 'n', "the user's word"));
    expect(lines(check(onlineRun(unknown(), 'n')).stderr, 'placement')).toEqual([expect.stringMatching(/prices\.md places it by the replace cost, but the cost can't place it: "f-amulet" is unavailable \(rate-limited\); then the player names the rung/)]);
    // No rate for exalts: the rune's price can't be turned into divines, so the cost can't place it either.
    const noRate = priceSet(set).filter((p) => p.id !== 'rate-exalted');
    expect(lines(check(onlineRun(noRate, 'b')).stderr, 'placement')).toEqual([expect.stringMatching(/"f-boots-socket-1" is in exalted, which has no rate/)]);
    // The owner's word that the character is in the campaign stands at any level (choice A).
    passes(onlineRun(priceSet(set), 'campaign', "the user's word"));
  });

  it('fails a slot or a socket no entry prices, an entry naming no slot, a stage named against its variant, and a place line that isn\'t the plan\'s', () => {
    const set = { helmet: 6, boots: 5, rune: 0.1, amulet: 6 };
    const noRune = onlineRun(priceSet(set).filter((p) => p.id !== 'f-boots-socket-1'), 'b', "the user's word");
    expect(lines(check(noRune).stderr, 'placement')).toEqual([expect.stringMatching(/Boots's socket 1 \(Rune: Greater Iron Rune\) has no prices\[\] entry with query\.slot "Boots" and query\.socket 1/)]);
    const noHelmet = onlineRun(priceSet(set).filter((p) => p.id !== 'f-helmet'), 'b', "the user's word");
    expect(lines(check(noHelmet).stderr, 'placement')).toEqual([expect.stringMatching(/the read stage's Helmet has no prices\[\] entry naming it in query\.slot; the replace cost prices every filled slot and tree jewel, flasks and charms aside/)]);
    const stray = onlineRun([...priceSet(set), { ...priceSet(set)[4], id: 'f-ring', query: { slot: 'Ring 1', item_name: 'x', league: LEAGUE } }], 'b');
    expect(lines(check(stray).stderr, 'placement')).toEqual([expect.stringMatching(/"f-ring" names "Ring 1" in query\.slot, which isn't a filled slot or tree jewel of the read stage/)]);
    const misnamed = onlineRun(priceSet(set), 'b');
    editJson(misnamed, 'plan.json', (p) => {
      p.stages[0].variant = 'non-budget';
    });
    expect(lines(check(misnamed).stderr, 'placement')).toEqual(expect.arrayContaining([expect.stringMatching(/read stage is "b" with variant "non-budget"; placing renames it to its rung's id, n/)]));
    const said = onlineRun(priceSet(set), 'b');
    writePlace(said, 'n', 'by the replace cost');
    expect(lines(check(said).stderr, 'placement')).toEqual([expect.stringMatching(/prices\.md says "non-budget \(n\)", but plan\.json's read stage is on b/)]);
    const none = onlineRun(priceSet(set), 'b');
    fs.writeFileSync(path.join(none, 'prices.md'), '# Prices\n\nBudget.\n');
    expect(lines(check(none).stderr, 'placement')).toEqual([expect.stringMatching(/prices\.md has no place line; it says "Place: <entering maps \(m\) \| budget \(b\) \| non-budget \(n\) \| in the campaign>/)]);
  });

  it('a character below the endgame (under level 65) is placed on no rung: "in the campaign, by its level" (choice A)', () => {
    const set = { helmet: 2, boots: 1, rune: 0.1, amulet: 2 };
    passes(onlineRun(priceSet(set), 'campaign', 'by its level', 50));
    expect(lines(check(onlineRun(priceSet(set), 'm', 'by the replace cost', 50)).stderr, 'placement')).toEqual([expect.stringMatching(/placed on m, but its level 50 is below the endgame \(under 65, the first waystone tier's area level\): its place is "in the campaign", with no rung/)]);
    // By its level is a character below the endgame's basis only; at level 90 its cost places it on m besides.
    expect(lines(check(onlineRun(priceSet(set), 'campaign', 'by its level', 90)).stderr, 'placement')).toEqual([
      expect.stringMatching(/places it by its level, which only a character below the endgame \(under 65\) is/),
      expect.stringMatching(/read stage is unplaced, but its replace cost places it on m/),
    ]);
  });
});

describe('AC-W155 (WU-163, D-520, fix round): the gems, the over-200 line and the searches line', () => {
  it('the gems count in the whole cost: priced uncut gems move a character off m, onto b', () => {
    const set = { helmet: 2, boots: 1, rune: 0.1, amulet: 2 };
    // About 3.3 divines at day 7 without the gems (m); three 2-divine uncut gems add about 3.9, over m's 5 in all.
    passes(onlineRun([...priceSet(set), ...gemPrices(2)], 'b'));
    expect(lines(check(onlineRun([...priceSet(set), ...gemPrices(2)], 'm')).stderr, 'placement')).toEqual([expect.stringMatching(/is on m, but its replace cost places it on b: the whole cost is about 7\.\d+ divines at day 7/)]);
    // A cheap gem keeps it on m.
    passes(onlineRun([...priceSet(set), ...gemPrices(0.1)], 'm'));
    // An entry naming a gem the read stage lacks fails.
    const stray = [...priceSet(set), ...gemPrices(0.1), { ...gemPrices(0.1)[0], id: 'f-gem-3-1', query: { group: 3, gem: 1, exchange: 'UncutGems', name: 'Uncut Skill Gem (Level 20)' } }];
    expect(lines(check(onlineRun(stray, 'm')).stderr, 'placement')).toEqual([expect.stringMatching(/"f-gem-3-1" names group 3, gem 1, which isn't a gem of the read stage's groups/)]);
  });

  it('on n with the whole cost over 200 divines at day 21, the place says so', () => {
    // An 800-divine helmet: ×0.5–0.85 to day 21, about 540.
    const set = { helmet: 800, boots: 5, rune: 0.1, amulet: 6 };
    const quiet = onlineRun(priceSet(set), 'n');
    expect(lines(check(quiet).stderr, 'placement')).toEqual([expect.stringMatching(/places it on n, but doesn't say the whole cost is over 200 divines: about 5\d\d(?:\.\d+)? at day 21/)]);
    const said = onlineRun(priceSet(set), 'n');
    writePlace(said, 'n', 'by the replace cost', 'Searches: 5 of at most 12.', 'The helmet alone is over 5 divines, and the whole cost is over 200 divines.');
    passes(said);
  });

  it("an online run's prices.md says how many searches the step made of the bound its notice announced, never more", () => {
    const set = { helmet: 6, boots: 5, rune: 0.1, amulet: 6 };
    const over = onlineRun(priceSet(set), 'b');
    writePlace(over, 'b', 'by the replace cost', 'Searches: 13 of at most 12.');
    expect(rulesIn(check(over).stderr)).toEqual(['pricing']);
    expect(lines(check(over).stderr, 'pricing')).toEqual([expect.stringMatching(/prices\.md says the step made 13 trade searches, more than the 12 its notice announced/)]);
    const none = onlineRun(priceSet(set), 'b');
    writePlace(none, 'b', 'by the replace cost', 'No count.');
    expect(lines(check(none).stderr, 'pricing')).toEqual([expect.stringMatching(/prices\.md has no searches line; an online pricing run's says "Searches: <made> of at most <announced>\."/)]);
    // At the bound passes; offline there is no line to hold.
    const at = onlineRun(priceSet(set), 'b');
    writePlace(at, 'b', 'by the replace cost', 'Searches: 12 of at most 12.');
    passes(at);
    passes(fixtureRun());
  });
});

// ---------------------------------------------------------------------------------------------------
// The importer fixture through the real file reader: choice A at level 50, and the owned rares' specs
// ---------------------------------------------------------------------------------------------------

/** A pricing run made as the runner makes one: `pob2-run-log init`, then plan_from_build's first call on a builds-folder file. */
async function readRun(server: TestServer, guides: string, name: string, n: number): Promise<string> {
  const dir = path.join(guides, 'pricing', `2026-12-01-${n}`);
  fs.mkdirSync(dir, { recursive: true });
  const init = node(RUN_LOG, [dir, 'init', JSON.stringify({ piece: 'pricing', mode: 'offline', testConfig: 'none', noNinja: false, source: { kind: 'builds-folder', name } })]);
  expect(init.code).toBe(0);
  const r = (await server.client.callTool({ name: 'plan_from_build', arguments: { run_folder: dir, build_name: name } })) as { isError?: boolean; content: Array<{ text: string }> };
  expect({ isError: r.isError ?? false, head: r.content[0].text.split('\n')[0] }).toEqual({ isError: false, head: expect.stringMatching(/^Read /) });
  return dir;
}
/** price.md's offline replace cost for a read plan: every filled slot but flasks and charms, every tree jewel and socket. */
function offlineCost(plan: Json): Json[] {
  const s = plan.stages[0];
  const out: Json[] = [];
  const entry = (id: string, item: string, query: Json) => ({ id, item, query, amount: null, currency: null, date: '2026-12-01', league: null, status: 'unavailable', note: 'offline run' });
  for (const x of s.items.slots) {
    if (typeof x.text !== 'string' || /^(?:Flask|Charm) \d+$/.test(x.slot)) continue;
    const id = `f-${x.slot.toLowerCase().replace(/\s+/g, '-')}`;
    out.push(entry(id, x.text.split('\n')[2] ?? x.slot, { slot: x.slot }));
    x.text.split('\n').filter((l: string) => /^Rune:/.test(l)).forEach((l: string, k: number) => out.push(entry(`${id}-socket-${k + 1}`, l.slice(5).trim(), { slot: x.slot, socket: k + 1 })));
  }
  for (const j of s.items.treeJewels) out.push(entry(`f-jewel-${j.node}`, 'a tree jewel', { slot: `Jewel ${j.node}` }));
  return out;
}
const run = (dir: string, stages: Json[]) => editJson(dir, 'run-log.json', (l) => {
  l.stages = stages;
  l.status = 'completed';
});

describe('AC-W155 (WU-163, D-520): the importer fixture, read by plan_from_build', () => {
  let server: TestServer;
  let guides: string;
  let at50: string;
  let at90: string;
  beforeAll(async () => {
    const root = fs.mkdtempSync(path.join(TMP, 'reader-'));
    const builds = path.join(root, 'builds');
    guides = path.join(root, 'guides');
    fs.mkdirSync(builds);
    fs.mkdirSync(guides);
    const xml = fs.readFileSync(IMPORTER, 'utf8');
    // §20: the importer fixture read again at level 50, its <Build level> changed (here in a copy of it).
    fs.writeFileSync(path.join(builds, 'Importer at 50.xml'), xml.replace(/(<Build [^>]*\blevel=")90"/, '$150"'));
    fs.writeFileSync(path.join(builds, 'Importer.xml'), xml);
    server = await startTestServer({ pobDirectory: builds, stateDir: path.join(root, 'state'), guidesDirectory: guides, env: { POB_DIRECTORY: builds, XDG_STATE_HOME: path.join(root, 'xdg'), POB_GUIDES_DIRECTORY: guides } });
    at50 = await readRun(server, guides, 'Importer at 50', 1);
    at90 = await readRun(server, guides, 'Importer', 2);
  });
  afterAll(async () => server?.close());

  /** The read run, priced offline (every slot and socket unavailable) and placed as `place` says on `basis`. */
  function priced(dir: string, place: Place, basis: string, edit: (plan: Json) => void = () => undefined): string {
    const copy = path.join(TMP, `root-${++copies}`, 'pricing', '2026-12-01-1');
    fs.mkdirSync(path.dirname(copy), { recursive: true });
    fs.cpSync(dir, copy, { recursive: true });
    editJson(copy, 'run-log.json', (l) => {
      l.runFolder = copy;
    });
    run(copy, [{ stage: 'read', attempt: 1, outcome: 'done' }, { stage: 'price', attempt: 1, outcome: 'done', priceOutcomes: {} }]);
    editJson(copy, 'plan.json', (p) => {
      p.prices = offlineCost(p);
      placeStage(p.stages[0], place, p.stages[0].level);
      edit(p);
    });
    writePlace(copy, place, basis);
    // The run's compile record and XML are the measure-only compile's; here the offline fixture's stand in.
    for (const f of ['compile-record.json', 'compiled-build.xml']) fs.copyFileSync(path.join(PRICING_RUN, f), path.join(copy, f));
    return copy;
  }

  it('at level 50 (choice A) its place is "in the campaign": the read stage stays f, and a rung there fails', () => {
    expect(readJson(at50, 'plan.json').stages[0]).toMatchObject({ id: 'f', level: 50 });
    passes(priced(at50, 'campaign', 'by its level'));
    const placed = check(priced(at50, 'b', "the user's word"));
    expect(rulesIn(placed.stderr)).toEqual(['placement']);
    expect(lines(placed.stderr, 'placement')).toEqual([expect.stringMatching(/placed on b, but its level 50 is below the endgame/)]);
    // At its own level 90, offline, the player's rung stands.
    passes(priced(at90, 'n', "the user's word"));
  });

  /** §16's spec of the corrupted body armour, Loath Ward: its fractured life, crafted fire and desecrated chaos lines. */
  const ARMOUR_SPEC = {
    base: 'Slipstrike Vest',
    weights: [{ stat: 'FullDPS', weight: 1 }, { stat: 'TotalEHP', weight: 0.5 }],
    ranking: [{ affix: '# to maximum Life', gain: 2.1, weight: 0.014 }, { affix: '#% to Fire Resistance', gain: 1.1, weight: 0.031 }, { affix: '#% to Chaos Resistance', gain: 0.9, weight: 0.03 }, { affix: '#% increased Evasion Rating', gain: 0.5, weight: 0.004 }],
    mustHaves: [{ affix: '# to maximum Life', tradeId: LIFE, tier: 6, min: 85 }, { affix: '#% to Fire Resistance', tradeId: FIRE, tier: 4, min: 26 }, { affix: '#% to Chaos Resistance', tradeId: CHAOS, tier: 1, min: 24 }],
    leftOut: [{ affix: '#% increased Evasion Rating', why: 'the character holds its evasion on the tree; resistances gain more' }],
    searches: 1,
  };
  /** §16's spec of Gale Stride, its rolls read at their {range:}: fire 28 of (20-30), life 45 of (40-60). */
  const GALE_SPEC = {
    base: 'Lizardscale Boots',
    weights: [{ stat: 'FullDPS', weight: 1 }, { stat: 'TotalEHP', weight: 0.5 }],
    ranking: null,
    mustHaves: [{ affix: '#% increased Movement Speed', tradeId: SPEED, tier: 2, min: 30, zeroScored: true }, { affix: '# to maximum Life', tradeId: LIFE, tier: 6, min: 40 }, { affix: '#% to Fire Resistance', tradeId: FIRE, tier: 4, min: 26 }],
    leftOut: [],
    searches: 0,
  };
  function withSpecs(edit: (armour: Json, boots: Json) => void = () => undefined): (plan: Json) => void {
    return (p) => {
      const slotOf = (name: string) => p.stages[0].items.slots.find((x: Json) => typeof x.text === 'string' && x.text.split('\n')[1] === name).slot;
      const armour = p.prices.find((x: Json) => x.query.slot === slotOf('Loath Ward') && x.query.socket === undefined);
      const boots = p.prices.find((x: Json) => x.query.slot === slotOf('Gale Stride') && x.query.socket === undefined);
      Object.assign(armour, { item: 'Slipstrike Vest: life, fire and chaos resistance', spec: JSON.parse(JSON.stringify(ARMOUR_SPEC)) });
      Object.assign(boots, { item: 'Lizardscale Boots: movement speed, life, fire resistance', spec: JSON.parse(JSON.stringify(GALE_SPEC)) });
      edit(armour, boots);
    };
  }

  it("owned-spec passes §16's spec of the owned rares: fractured, crafted and desecrated lines as explicit mods, a corrupted item's implicits left out, rolls at their range", () => {
    passes(priced(at90, 'n', "the user's word", withSpecs()));
    // Priced online by its depth check: the query asks for the must-haves at their mins, uncorrupted.
    const online = priced(at90, 'n', "the user's word", withSpecs((armour) => {
      Object.assign(armour, { query: { ...armour.query, league: LEAGUE, item_type: 'Slipstrike Vest', mods: ARMOUR_SPEC.mustHaves.map((m) => ({ stat_id: m.tradeId, min: m.min })), corrupted: false, limit: 10 } });
    }));
    expect(lines(check(online).stderr, 'owned-spec')).toEqual([]);
  });

  const FAULTS: Array<{ name: string; edit: (armour: Json, boots: Json) => void; says: RegExp }> = [
    { name: 'a must-have the item doesn\'t carry', edit: (a) => a.spec.mustHaves.push({ affix: '#% to Cold Resistance', tradeId: COLD, tier: 3, min: 31 }), says: /must-have "#% to Cold Resistance" isn't one of the owned rare's explicit lines/ },
    { name: 'a must-have from a corrupted item\'s implicit (its bonded rune line)', edit: (a) => (a.spec.mustHaves[2] = { affix: '+#% to all Elemental Resistances', tradeId: 'explicit.stat_2901986750', tier: 1, min: 15 }), says: /must-have "\+#% to all Elemental Resistances" isn't one of the owned rare's explicit lines/ },
    { name: 'a min above the item\'s roll', edit: (a) => (a.spec.mustHaves[0].min = 100), says: /must-have "# to maximum Life" requires at least 100, above the owned rare's roll 92/ },
    { name: 'a min above a roll read at its range', edit: (_a, b) => (b.spec.mustHaves[1].min = 50), says: /must-have "# to maximum Life" requires at least 50, above the owned rare's roll 45/ },
    { name: 'a fractured line searched by the fractured filter', edit: (a) => (a.spec.mustHaves[0].tradeId = 'fractured.stat_3299347043'), says: /is searched by "fractured\.stat_3299347043"; an owned rare's lines are searched as explicit mods, a fractured line as a plain one/ },
    { name: 'a carried line of PoB\'s top 4 left out with no why', edit: (a) => (a.spec.leftOut = []), says: /leaves out "#% increased Evasion Rating", one of PoB's top 4 that the owned rare carries/ },
    { name: 'a base that isn\'t the item\'s', edit: (a) => (a.spec.base = 'Ironclad Vest'), says: /spec has base "Ironclad Vest"; the owned rare in Body Armour is a "Slipstrike Vest"/ },
    { name: 'five must-haves', edit: (a) => a.spec.mustHaves.push({ affix: '#% increased Evasion Rating', tradeId: 'explicit.stat_2106365538', tier: 1, min: 100, why: 'x' }, { affix: '#% increased Evasion Rating', tradeId: 'explicit.stat_2106365538', tier: 1, min: 100, why: 'x' }), says: /spec requires 5 affix\(es\); an owned rare's must-haves are the 3 or 4 of its own lines/ },
    {
      name: 'an ok depth check that is corrupted',
      edit: (a) => Object.assign(a, { status: 'ok', amount: 3, currency: 'divine', note: '12 found, the 5th cheapest', query: { ...a.query, mods: ARMOUR_SPEC.mustHaves.map((m) => ({ stat_id: m.tradeId, min: m.min })), corrupted: true } }),
      says: /depth check has corrupted true; an owned rare's spec is searched uncorrupted/,
    },
    {
      name: 'an ok depth check that leaves a must-have out',
      edit: (a) => Object.assign(a, { status: 'ok', amount: 3, currency: 'divine', note: '12 found, the 5th cheapest', query: { ...a.query, mods: [{ stat_id: LIFE, min: 85 }, { stat_id: FIRE, min: 26 }], corrupted: false } }),
      says: /depth check doesn't ask for its must-have "#% to Chaos Resistance"/,
    },
    {
      name: "an ok price of an owned rare with no spec",
      edit: (a) => {
        Object.assign(a, { status: 'ok', amount: 3, currency: 'divine', note: '12 found, the 5th cheapest' });
        delete a.spec;
      },
      says: /prices the owned rare in Body Armour, but has no spec; an owned rare is priced by its spec from its own lines/,
    },
    {
      name: "a thin retry's dropped must-have kept among the must-haves",
      edit: (a) => {
        // Four required, thin; the retry searched three, but the spec still lists the fourth.
        a.spec.mustHaves.push({ affix: '#% increased Evasion Rating', tradeId: 'explicit.stat_2106365538', tier: 2, min: 111 });
        a.spec.leftOut = [];
        Object.assign(a, { status: 'ok', amount: 3, currency: 'divine', note: '11 found, the 5th cheapest', query: { ...a.query, mods: ARMOUR_SPEC.mustHaves.map((m) => ({ stat_id: m.tradeId, min: m.min })), corrupted: false } });
        a.spec.searches = 2;
      },
      says: /depth check doesn't ask for its must-have "#% increased Evasion Rating"/,
    },
  ];
  for (const { name, edit, says } of FAULTS) {
    it(`owned-spec fails ${name}`, () => {
      const r = check(priced(at90, 'n', "the user's word", withSpecs(edit)));
      expect(lines(r.stderr, 'owned-spec')).toEqual(expect.arrayContaining([expect.stringMatching(says)]));
      // The rule is pricing's: the fault fails owned-spec, and the offline-prices rule the corrupted ok price trips besides.
      expect(rulesIn(r.stderr).filter((x) => !['offline-prices'].includes(x))).toEqual(['owned-spec']);
    });
  }

  it("a thin retry's dropped must-have goes to leftOut, its why thin with it: <count>; without it the retry fails owned-spec", () => {
    // Four required at first (evasion the fourth), 6 found; the retry without evasion found 11: its 5th cheapest prices it.
    const retried = (leftOut: Json[]) => withSpecs((a) => {
      Object.assign(a, { status: 'ok', amount: 3, currency: 'divine', note: '11 found, the 5th cheapest', query: { ...a.query, league: LEAGUE, item_type: 'Slipstrike Vest', mods: ARMOUR_SPEC.mustHaves.map((m) => ({ stat_id: m.tradeId, min: m.min })), corrupted: false, limit: 10 } });
      a.spec.leftOut = leftOut;
      a.spec.searches = 2;
    });
    const ok = check(priced(at90, 'n', "the user's word", retried([{ affix: '#% increased Evasion Rating', why: 'thin with it: 6' }])));
    expect(lines(ok.stderr, 'owned-spec')).toEqual([]);
    const missing = check(priced(at90, 'n', "the user's word", retried([])));
    expect(lines(missing.stderr, 'owned-spec')).toEqual([expect.stringMatching(/leaves out "#% increased Evasion Rating", one of PoB's top 4 that the owned rare carries, with no leftOut entry giving its why/)]);
  });
});

// ---------------------------------------------------------------------------------------------------
// upgrades.json (Appendix A.10)
// ---------------------------------------------------------------------------------------------------

const LISTING = { price: { amount: 12, currency: 'divine' }, gain: { fullDps: 0.08, ehp: 0.02, maxHit: { type: 'Cold', change: 120 } }, link: 'https://www.pathofexile.com/trade2/search/poe2/Forbidden%20Rites/abc' };
const UPGRADES = { budget: { divines: 50 }, league: LEAGUE, checked: '2026-10-10T18:00:00Z', slots: [{ slot: 'Helmet', listings: [LISTING] }, { slot: 'Boots', listings: [] }], chosen: [{ slot: 'Helmet', listing: 0 }], spent: 12 };

describe("AC-W155 (WU-163, D-520): upgrades.json holds Appendix A.10's shape", () => {
  const withUpgrades = (u: unknown) => {
    const dir = onlineRun(priceSet({ helmet: 6, boots: 5, rune: 0.1, amulet: 6 }), 'b');
    writeJson(dir, 'upgrades.json', u);
    return dir;
  };

  it("A.10's file passes, and so does a slot's link alone, without a cookie", () => {
    passes(withUpgrades(UPGRADES));
    const noCookie = { ...UPGRADES, slots: [{ slot: 'Helmet', listings: [], link: LISTING.link }, { slot: 'Boots', listings: [], link: LISTING.link }, { slot: 'Amulet', listings: [], link: LISTING.link }], chosen: [], spent: 0 };
    passes(withUpgrades(noCookie));
  });

  const BAD: Array<{ name: string; u: Json; says: RegExp }> = [
    { name: 'a missing field', u: { ...UPGRADES, spent: undefined }, says: /holds budget, league, checked, slots, chosen; Appendix A\.10's fields are/ },
    { name: 'another league', u: { ...UPGRADES, league: 'Standard' }, says: /league is "Standard", but the plan's is "Forbidden Rites"/ },
    { name: 'no budget', u: { ...UPGRADES, budget: { divines: 0 } }, says: /budget is \{"divines":0\}/ },
    { name: 'a checked time without its seconds', u: { ...UPGRADES, checked: '2026-10-10T18:00Z' }, says: /checked is "2026-10-10T18:00Z"/ },
    { name: 'a listing without its gains', u: { ...UPGRADES, slots: [{ slot: 'Helmet', listings: [{ price: LISTING.price, link: LISTING.link }] }] }, says: /slots\[0\]\.listings\[0\] is .*\{price: \{amount, currency\}, gain: \{fullDps, ehp, maxHit: \{type, change\}\}, link\}/ },
    { name: 'a slot the character has no gear in', u: { ...UPGRADES, slots: [{ slot: 'Ring 1', listings: [] }], chosen: [] }, says: /slots\[0\] names "Ring 1", which isn't a filled gear slot of the read stage/ },
    { name: 'a pick of no listing', u: { ...UPGRADES, chosen: [{ slot: 'Boots', listing: 0 }] }, says: /chosen\[0\] is \{"slot":"Boots","listing":0\}; a pick names a slot of the file and the index of one of its listings/ },
    { name: 'listings beside a link', u: { ...UPGRADES, slots: [{ slot: 'Helmet', listings: [LISTING], link: LISTING.link }] }, says: /has listings and a link of its own/ },
  ];
  for (const { name, u, says } of BAD) {
    it(`fails ${name}`, () => {
      const r = check(withUpgrades(JSON.parse(JSON.stringify(u))));
      expect(rulesIn(r.stderr)).toEqual(['upgrades']);
      expect(lines(r.stderr, 'upgrades')).toEqual(expect.arrayContaining([expect.stringMatching(says)]));
    });
  }

  it('an offline run writes none', () => {
    const dir = fixtureRun();
    writeJson(dir, 'upgrades.json', { ...UPGRADES, league: null });
    expect(lines(check(dir).stderr, 'upgrades')).toEqual(expect.arrayContaining([expect.stringMatching(/upgrades\.json is in an offline run; offline, no upgrade search runs/)]));
  });
});

// ---------------------------------------------------------------------------------------------------
// The offline fixture run
// ---------------------------------------------------------------------------------------------------

describe('AC-W155 (WU-163, D-520): the offline fixture pricing run', () => {
  it("passes the checker: every price unavailable, the rung the player's word, its owned rare's spec its own lines", () => {
    passes(fixtureRun());
    const plan = readJson(PRICING_RUN, 'plan.json');
    expect(plan.stages[0]).toMatchObject({ id: 'b', variant: 'budget', loadoutName: 'Endgame (L90) {b}' });
    expect(plan.prices).toEqual([
      expect.objectContaining({ id: 'f-helmet', status: 'unavailable', note: 'offline run', query: expect.objectContaining({ slot: 'Helmet' }) }),
      ...['f-gem-1-1', 'f-gem-1-2', 'f-gem-2-1'].map((id) => expect.objectContaining({ id, status: 'unavailable', note: 'offline run', query: { group: Number(id[6]), gem: Number(id[8]) } })),
    ]);
    expect(fs.readFileSync(path.join(PRICING_RUN, 'prices.md'), 'utf8')).toMatch(/^Place: budget \(b\), the user's word\.$/m);
  });

  it("each pricing rule is pricing's alone: a compile run isn't held to placement or owned-spec", () => {
    const stray = { id: 'f-x', item: 'nothing', query: { slot: 'Nowhere' }, amount: null, currency: null, date: '2026-12-01', league: null, status: 'unavailable', note: 'offline run', spec: { base: 'x' } };
    const pricing = fixtureRun();
    editJson(pricing, 'plan.json', (p) => p.prices.push(stray));
    expect(rulesIn(check(pricing).stderr)).toEqual(['placement', 'owned-spec']);
    const dir = path.join(TMP, `root-${++copies}`, 'compile', '2026-12-01-1');
    fs.mkdirSync(path.dirname(dir), { recursive: true });
    fs.cpSync(path.join(REPO, 'tests', 'fixtures', 'pieces', 'compile-run'), dir, { recursive: true });
    editJson(dir, 'run-log.json', (l) => {
      l.runFolder = dir;
    });
    editJson(dir, 'plan.json', (p) => p.prices.push(stray));
    passes(dir);
  });
});
