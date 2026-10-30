/**
 * AC-W105 (WU-134, amendment 13 §17 D-476 and §15's M-25 leftovers; static): the PoB gaps and the fold's leftovers.
 * - `docs/build-guide/pob-gaps.md` has §17's section ("Found in amendment 13 (2026-10-30)") holding PG-101 and PG-102 in
 *   order, each titled as §17 names it, with §17's kind and status and a Where that cites §17's lines; every PoB
 *   `file:line` the section cites is in the pin and says what the entry says it does.
 * - Stabilization's `03-trade.md` gives 61 s, the first whole second over the 60 s wait caps (D-461), in AC-T6's and
 *   AC-T34 (a)'s refusal examples, as the unit tests that carry those ids do; the old 40 s is gone from both.
 * - Amendment 12's §19 lists `pob-api/API/Handlers.lua` under WU-117 (B8's `update_tree_delta` reply) and, under WU-120,
 *   the shared tests that moved with the key-figure line (`compileMinion.test.ts` and `compilePlainSummon.test.ts`,
 *   which WU-120's commit changed for the resisting figure); its §15 cites Voices' own code, apart from From Nothing's.
 */
import { describe, it, expect } from '@jest/globals';
import fs from 'fs';
import path from 'path';
import { DEFAULT_MAX_WAIT_MS } from '../../src/trade/rateLimiter';
import { SEARCH_MAX_WAIT_MS } from '../../src/trade/findUpgrades';

const REPO = path.resolve(__dirname, '..', '..');
const SPEC_DIR = path.join(REPO, 'docs', 'build-guide', 'spec');
const PIN_SRC = path.join(REPO, 'vendor', 'PathOfBuilding-PoE2', 'src');

const read = (f: string) => fs.readFileSync(f, 'utf8');
const folded = (s: string) => s.replace(/\s*\n\s*/g, ' ').trim();

const A13 = read(path.join(SPEC_DIR, 'amendment-13-tree-and-finishing-touches.md'));
const A12 = read(path.join(SPEC_DIR, 'amendment-12-defence-and-design.md'));
const GAPS = read(path.join(REPO, 'docs', 'build-guide', 'pob-gaps.md'));
const TRADE = read(path.join(REPO, 'docs', 'stabilization', 'spec', '03-trade.md'));

/** The body of a spec's `## <n>. …` section, up to the next `## `. */
const sectionOf = (spec: string, n: number) => {
  const at = spec.search(new RegExp(`^## ${n}\\. `, 'm'));
  expect({ n, found: at >= 0 }).toEqual({ n, found: true });
  const next = spec.indexOf('\n## ', at + 1);
  return spec.slice(at, next > 0 ? next : undefined);
};

/** The pin's lines `from`–`to` (1-based), joined. */
const pin = (rel: string) => read(path.join(PIN_SRC, rel)).split(/\r?\n/);
const lines = (rel: string, from: number, to = from) => pin(rel).slice(from - 1, to).join('\n');
const luaFiles = (dir: string): string[] =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((d) => {
    const p = path.join(dir, d.name);
    return d.isDirectory() ? luaFiles(p) : d.name.endsWith('.lua') ? [p] : [];
  });
/** Every Lua file of the pin, read once: its path under `src/` and its text. */
let PIN_LUA: { f: string; text: string }[] | null = null;
const pinLua = () => (PIN_LUA ??= luaFiles(PIN_SRC).map((f) => ({ f: path.relative(PIN_SRC, f), text: read(f) })));
/** Every `file:line` or `file:from-to` (hyphen or en dash) in a text, a bare `:line` taking the last file named. */
const citesIn = (text: string, re: RegExp) => {
  const out: { cite: string; file: string; from: number; to: number }[] = [];
  let last = '';
  for (const m of text.matchAll(re)) {
    last = m[1] ?? last;
    out.push({ cite: m[0], file: last, from: Number(m[2]), to: Number(m[3] ?? m[2]) });
  }
  return out;
};

describe('AC-W105 (WU-134): PG-101 and PG-102 in pob-gaps.md (amendment 13 §17, D-476)', () => {
  const S17 = folded(sectionOf(A13, 17));
  const SECTION_TITLE = /in a new section "([^"]+)"/.exec(S17)![1];
  const sectionText = (() => {
    const at = GAPS.indexOf(`\n## ${SECTION_TITLE}\n`);
    const next = GAPS.indexOf('\n## ', at + 1);
    return at < 0 ? '' : GAPS.slice(at, next > 0 ? next : undefined);
  })();
  /** §17's entries: `PG-<n>, <name> (<kind>, <status>: `<file>`:<from>–<to> …)`. */
  const named = [...S17.matchAll(/PG-(\d+), ([^(]+?) \(([a-z]+), ([^:]+): `([^`]+)`:\s*(\d+)–(\d+)[^)]*\)/g)].map((m) => ({
    n: Number(m[1]), name: m[2], kind: m[3], status: m[4], file: m[5], from: Number(m[6]), to: Number(m[7]),
  }));
  const spec = (n: number) => named.find((e) => e.n === n)!;

  /** The entry `- **PG-<n>, …` up to the next entry or section, folded. */
  const entryOf = (n: number) => {
    const at = sectionText.indexOf(`- **PG-${n}, `);
    expect({ n, listed: at >= 0 }).toEqual({ n, listed: true });
    const next = [sectionText.indexOf('\n- **PG-', at + 1), sectionText.indexOf('\n## ', at)].filter((x) => x > 0);
    return folded(sectionText.slice(at, next.length ? Math.min(...next) : undefined));
  };
  const headingOf = (entry: string) => /^- \*\*PG-\d+, (.+?)\.\*\* /.exec(entry)![1];
  const statusOf = (entry: string) => entry.slice(entry.indexOf('.** ') + 4);
  const field = (entry: string, name: string) => {
    const m = new RegExp(`- \\*\\*${name}:\\*\\* (.*?)(?= - \\*\\*[A-Z][a-z ]+:\\*\\*|$)`).exec(entry);
    return m ? m[1] : null;
  };
  const GAP_CITE = /`((?:Modules|Data|Classes)\/[^`:]+\.lua)?:(\d+)(?:-(\d+))?`/g;
  const cited = (n: number, cite: string) =>
    expect({ n, cite, cited: entryOf(n).includes(`\`${cite}\``) }).toEqual({ n, cite, cited: true });

  it(`has §17's section, "${SECTION_TITLE}", holding PG-101 and PG-102 in order`, () => {
    expect(SECTION_TITLE).toBe('Found in amendment 13 (2026-10-30)');
    expect(named.map((e) => e.n)).toEqual([101, 102]);
    expect(sectionText).not.toBe('');
    expect([...sectionText.matchAll(/^- \*\*PG-(\d+), /gm)].map((m) => Number(m[1]))).toEqual([101, 102]);
    // Each id once in the file.
    for (const n of [101, 102]) expect({ n, count: GAPS.split(`**PG-${n},`).length - 1 }).toEqual({ n, count: 1 });
  });

  it("titles each entry as §17 names it, with §17's kind and status and a Where", () => {
    for (const e of named) {
      const entry = entryOf(e.n);
      expect({ n: e.n, heading: headingOf(entry) }).toEqual({ n: e.n, heading: e.name });
      expect({ n: e.n, status: statusOf(entry).startsWith(`${e.kind}, ${e.status}.`) }).toEqual({ n: e.n, status: true });
      expect({ n: e.n, where: field(entry, 'Where') !== null }).toEqual({ n: e.n, where: true });
    }
    expect(named.map((e) => `${e.kind}, ${e.status}`)).toEqual(['gap, confirmed in code', 'gap, confirmed in code']);
  });

  it("cites §17's lines in each Where: Bloodhound's Mark from its first line, the conquered-node code as §17 gives it", () => {
    const where101 = citesIn(field(entryOf(101), 'Where')!, GAP_CITE);
    const skill = where101.find((c) => path.basename(c.file) === spec(101).file && c.from === spec(101).from)!;
    expect(skill).toBeDefined();
    // The cite covers §17's range: the skill from its first line past its stat map.
    expect(skill.to).toBeGreaterThanOrEqual(spec(101).to);
    const where102 = citesIn(field(entryOf(102), 'Where')!, GAP_CITE);
    expect(where102.some((c) => path.basename(c.file) === spec(102).file && c.from === spec(102).from && c.to === spec(102).to)).toBe(true);
  });

  it('cites PoB only at files and lines the pin holds', () => {
    let count = 0;
    for (const n of [101, 102]) {
      for (const c of citesIn(entryOf(n), GAP_CITE)) {
        expect({ n, cite: c.cite, file: c.file !== '' }).toEqual({ n, cite: c.cite, file: true });
        const total = pin(c.file).length;
        expect({ n, cite: c.cite, inFile: c.from >= 1 && c.from <= c.to && c.to <= total }).toEqual({ n, cite: c.cite, inFile: true });
        count++;
      }
    }
    expect(count).toBeGreaterThanOrEqual(12);
  });

  it("PG-101: the skill maps only the explosion threshold; its build-up from Blood Loss has no map, and PoB's Heavy Stun reads hits", () => {
    const ACT_DEX = 'Data/Skills/act_dex.lua';
    const BUILD_UP = 'hunters_mark_%_of_phys_damage_over_time_as_build_up';
    const THRESHOLD = 'hunters_mark_%_of_max_threshold_to_trigger_explosion_on_death';
    // The skill: its first line is §17's, and the entry's range ends where it ends.
    cited(101, `${ACT_DEX}:496-620`);
    expect(lines(ACT_DEX, spec(101).from)).toBe('skills["BloodhoundsMarkPlayer"] = {');
    expect(lines(ACT_DEX, 620)).toBe('}');
    expect(lines(ACT_DEX, 621)).toMatch(/^skills\["BloodhoundsMarkExplosionPlayer"\] = \{$/);
    // §17: the lines it names map only the explosion threshold.
    const head = pin(ACT_DEX).slice(spec(101).from - 1, spec(101).to);
    const mapAt = head.findIndex((l) => /^\s*statMap = \{$/.test(l));
    expect(mapAt).toBeGreaterThan(0);
    const mapEnd = head.findIndex((l, i) => i > mapAt && /^\t\t\t\},$/.test(l));
    const mapped = head.slice(mapAt, mapEnd + 1).flatMap((l) => [...l.matchAll(/^\s*\["([^"]+)"\] = \{$/g)].map((m) => m[1]));
    expect(mapped).toEqual([THRESHOLD]);
    // The entry's `:556-560` is that stat map, and its mod is an `ExplosionThreshold` nothing reads.
    cited(101, ':556-560');
    expect(spec(101).from + mapAt).toBe(556);
    expect(spec(101).from + mapEnd).toBe(560);
    expect(lines(ACT_DEX, 558)).toContain('mod("ExplosionThreshold", "BASE"');
    const holders = pinLua().filter(({ text }) => text.includes('ExplosionThreshold')).map(({ f }) => f);
    expect(holders).toEqual([ACT_DEX]);
    // The build-up stat: its description, its base and quality values.
    const DESC = 'Data/StatDescriptions/Specific_Skill_Stat_Descriptions/bloodhounds_mark.lua';
    cited(101, `${DESC}:52`);
    expect(lines(DESC, 52)).toBe('\t\t\t\ttext="Marked target receives Heavy Stun buildup equal to\\n{0}% of Blood Loss"');
    expect(lines(DESC, 53, 56)).toContain(`[1]="${BUILD_UP}"`);
    cited(101, `${ACT_DEX}:570`);
    expect(lines(ACT_DEX, 570)).toBe(`\t\t\t\t{ "${BUILD_UP}", 300 },`);
    cited(101, ':505');
    expect(lines(ACT_DEX, 505)).toBe(`\t\t{ "${BUILD_UP}", 2.5, {  } },`);
    // No map for it anywhere PoB computes: the skill's stat map (above), SkillStatMap.lua or Modules/.
    const readers = [...luaFiles(path.join(PIN_SRC, 'Modules')), path.join(PIN_SRC, 'Data', 'SkillStatMap.lua')]
      .filter((f) => read(f).includes(BUILD_UP));
    expect(readers).toEqual([]);
    // PoB's Heavy Stun build-up: from the hit's damage, and only when the skill hits.
    cited(101, 'Modules/CalcOffence.lua:5404-5422');
    const stun = lines('Modules/CalcOffence.lua', 5404, 5422);
    expect(stun).toContain('for _, ailment in ipairs({"Freeze", "Electrocute", "HeavyStun", "Pin"}) do');
    expect(stun).toContain('= calcMinMaxPoiseSourceDamage(ailment, data.buildupTypes[ailment].ScalesFrom)');
    expect(stun).toContain('if skillFlags.hit and not skillModList:Flag(cfg, "Cannot"..ailment) then');
    expect(stun).toContain('globalOutput[ailment .. "BuildupAvg"] = 0');
    const source = read(path.join(PIN_SRC, 'Modules', 'CalcOffence.lua'));
    const fnAt = source.indexOf('local function calcMinMaxPoiseSourceDamage(');
    const fn = source.slice(fnAt, source.indexOf('return hitMin, hitMax, hitAvg, critMin, critMax, critAvg, poseDamageAvg', fnAt));
    expect(fn).toContain('output[damageType.."HitAverage"]');
    expect(fn).not.toMatch(/Bleed|BloodLoss|Blood Loss/);
  });

  it("PG-102: the seed is parsed but its lookup is commented out and never loaded; only keystones and Undying Hate's smalls change", () => {
    const SPEC_FILE = 'Classes/PassiveSpec.lua';
    cited(102, `${SPEC_FILE}:${spec(102).from}-${spec(102).to}`);
    const conquered = pin(SPEC_FILE).slice(spec(102).from - 1, spec(102).to);
    expect(conquered[0]).toContain('-- If node is conquered, replace it or add mods');
    expect(conquered.join('\n')).toContain('-- FIXME - continue implementing');
    expect(conquered.join('\n')).toContain('-- todo: update once we get seed data');
    const lookups = conquered.filter((l) => l.includes('data.readLUT('));
    expect(lookups.length).toBeGreaterThan(0);
    for (const l of lookups) expect(l.trim().startsWith('--')).toBe(true);
    // The seed and conqueror are parsed from the jewel's line.
    cited(102, 'Modules/ModParser.lua:6182-6187');
    const parse = lines('Modules/ModParser.lua', 6182, 6187);
    expect(parse).toContain('["remembrancing (%d+) songworthy deeds by the line of (.+)"]');
    expect(parse).toContain('["glorifying the defilement of (%d+) souls in tribute to (.+)"]');
    expect(parse.match(/key = "conqueredBy", value = \{ id = num, conqueror = conquerorList\[name:lower\(\)\] \}/g)).toHaveLength(2);
    // `data.readLUT` is defined nowhere, its helper is loaded by no file, and the pin ships no seed tables.
    const lua = pinLua();
    expect(lua.filter(({ text }) => /data\.readLUT\s*=|function data\.readLUT/.test(text)).map(({ f }) => f)).toEqual([]);
    expect(lua.filter(({ text }) => text.includes('DataLegionLookUpTableHelper')).map(({ f }) => f)).toEqual([]);
    expect(fs.readdirSync(path.join(PIN_SRC, 'Data', 'TimelessJewelData')).sort()).toEqual(['LegionPassives.lua', 'LegionTradeIds.lua', 'NodeIndexMapping.lua']);
    // The pin's two timeless jewels.
    cited(102, 'Data/Uniques/jewel.lua:98');
    cited(102, ':113');
    expect(lines('Data/Uniques/jewel.lua', 98, 99)).toBe('Heroic Tragedy\nTimeless Jewel');
    expect(lines('Data/Uniques/jewel.lua', 113, 114)).toBe('Undying Hate\nTimeless Jewel');
    expect(read(path.join(PIN_SRC, 'Data', 'Uniques', 'jewel.lua')).match(/^Timeless Jewel$/gm)).toHaveLength(2);
    // What does change: a keystone becomes the conqueror's; Undying Hate's (the Abyssals') small passives give Tribute.
    cited(102, `${SPEC_FILE}:1653-1660`);
    const keystone = lines(SPEC_FILE, 1653, 1660);
    expect(keystone).toMatch(/^\s*elseif node\.type == "Keystone" then/);
    expect(keystone).toContain('local matchStr = conqueredBy.conqueror.type .. "_keystone_" .. conqueredBy.conqueror.id');
    expect(keystone).toContain('self:ReplaceNode(node, legionNode)');
    cited(102, ':1699-1706');
    const smalls = lines(SPEC_FILE, 1699, 1706);
    expect(smalls).toMatch(/^\s*if conqueredBy\.conqueror\.type == "abyss" then/);
    expect(smalls).toContain('+3 to Tribute');
    expect(smalls).toContain('legionNodes[201] -- abyss_small_tribute');
    expect(lines('Modules/ModParser.lua', 1, 80)).toMatch(/\["kulemak"\]\s*=\s*\{ id = 2, type = "abyss" \}/);
    expect(lines('Data/Uniques/jewel.lua', 113, 130)).toContain('Passives in radius are Conquered by the Abyssals');
  });

  it('says where each was seen as amendment 13 gives it', () => {
    const S1 = folded(sectionOf(A13, 1));
    expect(S1).toMatch(/The answers of 2026-10-30, to the gap analysis: .*the bleed-to-stun example: "Bloodhound's Mark"/);
    expect(field(entryOf(101), 'Seen in')).toContain('bleed-to-stun example (2026-10-30)');
    const [, guides, timeless] = /Across the (\d+) endgame guides: .*?timeless jewels (\d+)/.exec(folded(sectionOf(A13, 2)))!;
    expect(field(entryOf(102), 'Seen in')).toContain(`${timeless} of the ${guides} endgame guides of the finishing-touches study`);
    expect(folded(sectionOf(A13, 14))).toMatch(/\*\*Timeless jewels are out\*\* \(the user: "Skip for now"; .*PG-102\)/);
  });
});

describe("AC-W105 (WU-134): 03-trade.md's refusal examples give 61 s (amendment 13 §15, the M-25 leftovers)", () => {
  /** An AC bullet `- **<id> (` of 03-trade.md, up to the next AC bullet, folded. */
  const acOf = (id: string) => {
    const at = TRADE.indexOf(`- **${id} (`);
    expect({ id, found: at >= 0 }).toEqual({ id, found: true });
    const next = TRADE.indexOf('\n- **AC-', at + 1);
    return folded(TRADE.slice(at, next > 0 ? next : undefined));
  };
  const S15 = folded(sectionOf(A13, 15));

  it("§15 names the two lines and the figure: 61 s for the old 40 s", () => {
    expect(S15).toMatch(/stabilization's `03-trade\.md`:738 and :923 give 61 s for the old 40 s refusal example/);
  });

  it("AC-T6's default-cap refusal is the first whole second over the limiter's cap, as rateLimiter.test.ts's AC-T6 has it", () => {
    const n = DEFAULT_MAX_WAIT_MS / 1000 + 1;
    expect(n).toBe(61);
    const t6 = acOf('AC-T6');
    expect(t6).toContain(`- A required wait of ${n} s with the default \`maxWaitMs\` → \`would_wait {waitS: ${n}}\`, with no sleep.`);
    expect(t6).not.toMatch(/\b40 s\b|waitS: 40/);
    const test = read(path.join(REPO, 'tests', 'unit', 'rateLimiter.test.ts'));
    const [, title, waitS] = /it\('AC-T6 \(D-461\): a required wait of (\d+) s with the default maxWaitMs throws would_wait \{waitS: (\d+)\}/.exec(test)!;
    expect([Number(title), Number(waitS)]).toEqual([n, n]);
  });

  it("AC-T34 (a)'s early stop is the first whole second over find_upgrades' search cap, as findUpgrades.test.ts's AC-T34 (a) has it", () => {
    const n = SEARCH_MAX_WAIT_MS / 1000 + 1;
    expect(n).toBe(61);
    const t34 = acOf('AC-T34');
    expect(t34).toContain(`- **(a)** A required wait of ${n} s on the second search → \`stoppedEarly\` with "${n} s", returned without sleeping.`);
    expect(t34).not.toMatch(/\b40 s\b/);
    const test = read(path.join(REPO, 'tests', 'unit', 'findUpgrades.test.ts'));
    const [, title, quoted] = /it\('AC-T34 \(a\) \(D-461\): a required wait of (\d+) s on the second search -> stoppedEarly "(\d+) s"/.exec(test)!;
    expect([Number(title), Number(quoted)]).toEqual([n, n]);
  });

  it('no refusal example in the file still gives 40 s', () => {
    expect(TRADE).not.toMatch(/A required wait of 40 s|waitS: 40\}|with "40 s"/);
  });
});

describe("AC-W105 (WU-134): amendment 12's §19 touches and §15's Voices lines (amendment 13 §15, the M-25 leftovers)", () => {
  /** A §19 table row's touches cell, by unit. */
  const touchesOf = (unit: string) => {
    const row = sectionOf(A12, 19).split('\n').find((l) => l.startsWith(`| ${unit} |`));
    expect({ unit, row: row !== undefined }).toEqual({ unit, row: true });
    const cells = row!.split(' | ');
    return cells[cells.length - 1].replace(/ \|$/, '');
  };

  it("WU-117's touches list `pob-api/API/Handlers.lua`, whose update_tree_delta reply carries B8's auto-pathed names", () => {
    const touches = touchesOf('WU-117');
    const luaGroup = touches.split('; ').find((g) => g.startsWith('`pob-api/API/'))!;
    expect(luaGroup).toMatch(/^`pob-api\/API\/NodePower\.lua`, .*`Handlers\.lua` \(`update_tree_delta`'s reply\)$/);
    // B8 (§15): "lists each auto-pathed node by name and id"; the reply's names are the one Handlers.lua line WU-117 added.
    expect(folded(sectionOf(A12, 15))).toContain('lists each auto-pathed node by name and id');
    const handlers = read(path.join(REPO, 'pob-api', 'API', 'Handlers.lua'));
    const fn = handlers.slice(handlers.indexOf('handlers.update_tree_delta = function(params)'));
    expect(fn.slice(0, fn.indexOf('\nend'))).toContain('autoPathedNames = res.autoPathedNames,');
  });

  it("WU-120's touches list the shared tests that moved with the key-figure line, each asserting its resisting figure", () => {
    const touches = touchesOf('WU-120');
    const integration = touches.slice(touches.indexOf('`tests/integration/'), touches.indexOf('`tests/unit/'));
    // WU-120's commit (D-454's resisting figure in the key-figure line) changed these two tests outside its touches.
    for (const file of ['compileMinion.test.ts', 'compilePlainSummon.test.ts']) {
      expect({ file, listed: integration.includes(`\`${file}\``) }).toEqual({ file, listed: true });
      const text = read(path.join(REPO, 'tests', 'integration', file));
      expect({ file, keyFigures: /`Key figures: damage \$\{[^}]+\} against map monsters, \$\{Math\.round\(s\.measures!\.damage!\.resisting!\)\} against resisting rares, `/.test(text) })
        .toEqual({ file, keyFigures: true });
    }
    expect(integration).toContain('`compileMinion.test.ts` and `compilePlainSummon.test.ts` (their key-figure lines)');
  });

  describe("§15's B3 cites Voices' own code, apart from From Nothing's", () => {
    const S15 = folded(sectionOf(A12, 15));
    const b3 = S15.slice(S15.indexOf('- **B3, radius jewels**'), S15.indexOf('- **B4, '));
    const SPEC_CITE = /(?:`((?:Modules|Data|Classes)\/[^`]+\.lua)`)?:(\d+)(?:–(\d+))?/g;
    const [, fromNothing, voices] = /\(From Nothing's code: (.+?); Voices' own code: (.+?)\)\. The check adds the radius nodes of the stage's radius jewel/.exec(b3) ?? [];

    it('keeps the bullet around the citation: the three jewels, then the check that adds the radius nodes', () => {
      expect(b3).toContain('so a node that a socketed From Nothing, Controlled Metamorphosis or Voices allocates without a path is refused, though PoB allows it (From Nothing\'s code: ');
      expect(fromNothing).toBeDefined();
      expect(voices).toBeDefined();
    });

    it("From Nothing's lines are From Nothing's code", () => {
      const cites = citesIn(fromNothing!, SPEC_CITE);
      expect(cites.map((c) => `${c.file}:${c.from}-${c.to}`)).toEqual([
        'Classes/PassiveSpec.lua:1378-1380', 'Classes/PassiveSpec.lua:1469-1471', 'Classes/PassiveSpec.lua:1887-1888',
      ]);
      for (const c of cites) expect({ cite: c.cite, fromNothing: /fromNothingKeystone/.test(lines(c.file, c.from, c.to)) }).toEqual({ cite: c.cite, fromNothing: true });
    });

    it("Voices' lines are its own: the line's parse, the Sinister sockets it resolves to, and their allocation while PoB calculates", () => {
      const cites = citesIn(voices!, SPEC_CITE);
      expect(cites.map((c) => `${c.file}:${c.from}-${c.to}`)).toEqual([
        'Modules/ModParser.lua:5870-5870', 'Classes/PassiveSpec.lua:1067-1093', 'Classes/PassiveSpec.lua:1215-1225',
        'Modules/CalcSetup.lua:875-883',
      ]);
      for (const c of cites) {
        const text = lines(c.file, c.from, c.to);
        expect({ cite: c.cite, inFile: c.to <= pin(c.file).length }).toEqual({ cite: c.cite, inFile: true });
        expect({ cite: c.cite, fromNothing: /fromNothing|intuitiveLeap/.test(text) }).toEqual({ cite: c.cite, fromNothing: false });
      }
      // The jewel's line, as the pin's Voices carries it, parses to a granted passive of Sinister sockets.
      expect(voices).toContain('its line "Allocates N Sinister Jewel sockets" parses to a granted passive');
      const jewels = read(path.join(PIN_SRC, 'Data', 'Uniques', 'jewel.lua'));
      const entry = jewels.slice(jewels.indexOf('[[\nVoices\n'), jewels.indexOf(']]', jewels.indexOf('[[\nVoices\n')));
      expect(entry.match(/^\{variant:\d\}Allocates \d Sinister Jewel sockets$/gm)).toHaveLength(3);
      expect(lines('Modules/ModParser.lua', 5870)).toContain('["allocates (%d+) sinister jewel sockets?"] = function(num) return { mod("GrantedPassive", "LIST", { type = "SinisterJewelSockets", count = num }) } end,');
      // ResolveGrantedPassiveNodes: the first N of the five aliased sockets.
      const resolve = lines('Classes/PassiveSpec.lua', 1067, 1093);
      expect(voices).toContain('`ResolveGrantedPassiveNodes` resolves to the first N of the sockets aliased `voices_jewel_slot1` to `voices_jewel_slot5`');
      expect(resolve).toMatch(/^local voicesSinisterSocketAliases = \{/);
      expect(resolve).toContain('"voices_jewel_slot1",');
      expect(resolve).toContain('"voices_jewel_slot5",');
      expect(resolve).toContain('function PassiveSpecClass:ResolveGrantedPassiveNodes(passive)');
      expect(resolve).toContain('if passive.type == "SinisterJewelSockets" then');
      expect(resolve).toContain('for i = 1, m_min(passive.count or 0, #voicesSinisterSocketAliases) do');
      // Allocated while PoB calculates: collected from the items, then added to the calculation's allocated nodes.
      const collect = lines('Classes/PassiveSpec.lua', 1215, 1225);
      expect(collect).toContain('if mod.name == "GrantedPassive" then');
      expect(collect).toContain('for _, node in ipairs(self:ResolveGrantedPassiveNodes(passive)) do');
      expect(collect).toContain('allocNodes[node.id] = specNode');
      const calc = lines('Modules/CalcSetup.lua', 875, 883);
      expect(calc).toContain('env.spec:CollectGrantedPassiveNodesFromItems(build.itemsTab, env.allocNodes');
      expect(calc).toContain('addGrantedPassiveNode(env, node)');
    });
  });
});
