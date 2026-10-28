/**
 * AC-W94 (WU-122, amendment 12 §17 D-462; static): the defence study's PoB gaps in `docs/build-guide/pob-gaps.md`, and
 * amendment 11's status paragraph.
 * - The section §17 names ("Found in the defence study (2026-10-26)") holds PG-83, PG-84 and PG-86 to PG-100 in order,
 *   each titled as §17 names it (read from the spec), with the kind and status the candidate list gives it (the
 *   candidate list lives in the user's private library, so its kinds and statuses are restated here; PG-91 is closed,
 *   fixed by §4; PG-100's comes from §17), a Where or Effect, and a Workaround exactly where the candidate list (for
 *   PG-100, §17) gives one. Every PoB `file:line` the section cites is read from the pin.
 * - No PG-85 entry: the user trusts PoB's block reading.
 * - PG-82 lists the figures §15's B4 says PoB has no single output for (read from the spec).
 * - Amendment 11's lines 3–10 say it was approved (the date and the user's words from the work-log's M-24 entry) and
 *   built as M-24, and that its live test (WU-116) runs with amendment 12's (WU-126); lines 1–2 and 11 are unchanged.
 */
import { describe, it, expect } from '@jest/globals';
import fs from 'fs';
import path from 'path';

const REPO = path.resolve(__dirname, '..', '..');
const GAPS_FILE = path.join(REPO, 'docs', 'build-guide', 'pob-gaps.md');
const SPEC_DIR = path.join(REPO, 'docs', 'build-guide', 'spec');
const PIN_SRC = path.join(REPO, 'vendor', 'PathOfBuilding-PoE2', 'src');

const read = (f: string) => fs.readFileSync(f, 'utf8');
const folded = (s: string) => s.replace(/\s*\n\s*/g, ' ').trim();

const GAPS = read(GAPS_FILE);
const SPEC = read(path.join(SPEC_DIR, 'amendment-12-defence-and-design.md'));
const A11 = read(path.join(SPEC_DIR, 'amendment-11-live-test-fixes.md'));
const WORKLOG = read(path.join(REPO, 'docs', 'build-guide', 'worklog.md'));

/** The body of the spec's `## <n>. …` section, up to the next `## `. */
const specSection = (n: number) => {
  const at = SPEC.search(new RegExp(`^## ${n}\\. `, 'm'));
  expect(at).toBeGreaterThanOrEqual(0);
  const next = SPEC.indexOf('\n## ', at + 1);
  return SPEC.slice(at, next > 0 ? next : undefined);
};
const S17 = folded(specSection(17));
const S15 = folded(specSection(15));
/** §4's decision id, which fixes PG-91 ("fixed by §4"). */
const S4_DECISION = /^## 4\. (D-\d+):/m.exec(SPEC)![1];

/** The entry `- **PG-<n>, …` up to the next entry or section, folded. */
const entryOf = (n: number, text = GAPS) => {
  const at = text.indexOf(`- **PG-${n}, `);
  expect({ n, listed: at >= 0 }).toEqual({ n, listed: true });
  const next = [text.indexOf('\n- **PG-', at + 1), text.indexOf('\n## ', at)].filter((x) => x > 0);
  return folded(text.slice(at, next.length ? Math.min(...next) : undefined));
};
const headingOf = (entry: string) => /^- \*\*PG-\d+, (.+?)\.\*\* /.exec(entry)![1];
const statusOf = (entry: string) => entry.slice(entry.indexOf('.** ') + 4);
const field = (entry: string, name: string) => {
  const m = new RegExp(`- \\*\\*${name}:\\*\\* (.*?)(?= - \\*\\*[A-Z][a-z ]+:\\*\\*|$)`).exec(entry);
  return m ? m[1] : null;
};

// The section §17 names, and its entries.
const SECTION_TITLE = /in a new section "([^"]+)"/.exec(S17)![1];
const sectionText = (() => {
  const at = GAPS.indexOf(`\n## ${SECTION_TITLE}\n`);
  const next = GAPS.indexOf('\n## ', at + 1);
  return at < 0 ? '' : GAPS.slice(at, next > 0 ? next : undefined);
})();
const NEW_IDS = [83, 84, ...Array.from({ length: 15 }, (_, i) => 86 + i)];

/**
 * The candidate list's kind and status for each entry (amendment 12 §17: "each in the file's skeleton (kind and
 * status, …) as the candidate list states it"), and whether it gives a workaround. PG-91 is recorded closed (§17);
 * PG-100's is checked against §17's own words below.
 */
const CANDIDATES: Record<number, { status: string; workaround: boolean }> = {
  83: { status: 'gap, confirmed in code', workaround: true },
  84: { status: 'gap, reported (coverage)', workaround: true },
  86: { status: 'gap, reported (video study; code grep)', workaround: true },
  87: { status: 'bug (possible), reported (video frame)', workaround: true },
  88: { status: 'bug (possible), reported (video frame)', workaround: false },
  89: { status: 'bug, reported (code read in the video study)', workaround: true },
  90: { status: 'ours, confirmed', workaround: false },
  91: { status: 'ours, closed', workaround: false },
  92: { status: 'data, reported (video study)', workaround: false },
  93: { status: 'gap, reported (coverage)', workaround: false },
  94: { status: 'gap, reported (coverage across the 30 builds)', workaround: false },
  95: { status: 'bug (possible), confirmed in code', workaround: false },
  96: { status: 'bug (possible), measured', workaround: true },
  97: { status: 'gap, reported (the user)', workaround: true },
  98: { status: 'gap, confirmed in code', workaround: false },
  99: { status: 'gap, reported (sizing study; coverage)', workaround: true },
  100: { status: 'ours, confirmed (an approximation)', workaround: true },
};

/** A heading compared with §17's name for it: §17 drops "is" and "are" ("Pyromantic Pact's mana replacement unparsed"). */
const norm = (s: string) => s.toLowerCase().replace(/\b(is|are)\b/g, ' ').replace(/\s+/g, ' ').trim();

describe('AC-W94 (WU-122): the defence study\'s PoB gaps in pob-gaps.md (amendment 12 §17, D-462)', () => {
  it(`has §17's section, "${SECTION_TITLE}", holding PG-83, PG-84 and PG-86 to PG-100 in order`, () => {
    expect(SECTION_TITLE).toBe('Found in the defence study (2026-10-26)');
    expect(sectionText).not.toBe('');
    const ids = [...sectionText.matchAll(/^- \*\*PG-(\d+), /gm)].map((m) => Number(m[1]));
    expect(ids).toEqual(NEW_IDS);
    // §17's list: PG-83, PG-84 and PG-86 to PG-99 by name, then PG-100.
    const named = [...S17.matchAll(/\bPG-(\d+) \(/g)].map((m) => Number(m[1]));
    expect(named).toEqual(NEW_IDS.filter((n) => n !== 100));
    expect(S17).toContain('and PG-100, which no candidate states');
  });

  it('has no PG-85 entry: the user trusts PoB\'s block reading, and its number is skipped', () => {
    expect(S17).toMatch(/PG-85 is dropped \(the user trusts PoB's block reading\) and its number skipped/);
    expect(GAPS).not.toMatch(/\*\*PG-85,/);
  });

  it('titles each entry as §17 names it', () => {
    const names = new Map([...S17.matchAll(/\bPG-(\d+) \(([^()]*)\)/g)].map((m) => [Number(m[1]), m[2]]));
    for (const n of NEW_IDS.filter((id) => id !== 100)) {
      const spec = names.get(n)!;
      const head = spec.split(/[,;]/)[0];
      expect({ n, heading: norm(headingOf(entryOf(n, sectionText))) }).toEqual({ n, heading: norm(head) });
    }
    // PG-86's name goes on: "with Frost Bomb's exposure and Thunderstorm's Wet".
    const [, exposure, wet] = /^curses ignore their monster-level cap, with (.+) and (.+)$/.exec(names.get(86)!)!;
    const e86 = entryOf(86, sectionText);
    expect(e86).toContain(exposure);
    expect(e86).toContain(wet);
    // PG-91's: "fixed by §4, recorded closed".
    expect(names.get(91)).toMatch(/; fixed by §4, recorded closed$/);
    const e91 = entryOf(91, sectionText);
    expect(statusOf(e91)).toMatch(new RegExp(`^ours, closed \\(fixed by amendment 12 §4, ${S4_DECISION}\\)`));
    expect(field(e91, 'Fixed')).toContain(S4_DECISION);
    // PG-100: "a companion's share of deflected hits ... so hits survived counts deflection partly twice and errs
    // optimistic at the floor".
    const where100 = /PG-100, which no candidate states: .*?; Where: [^,]+, (a companion's share of deflected hits) already in PoB's max hit, so (hits survived) counts (deflection partly twice) and errs (optimistic) at the floor;/.exec(S17)!;
    const e100 = entryOf(100, sectionText);
    for (const part of where100.slice(1)) expect(e100).toContain(part);
  });

  it("gives each entry the candidate list's kind and status (PG-100's from §17), and a Where or Effect", () => {
    const [, kind100, note100] = /PG-100, which no candidate states: \*\*(ours, confirmed)\*\* \(([^)]+)\)/.exec(S17)!;
    expect(CANDIDATES[100].status).toBe(`${kind100} (${note100})`);
    for (const n of NEW_IDS) {
      const e = entryOf(n, sectionText);
      expect({ n, status: statusOf(e).startsWith(CANDIDATES[n].status) }).toEqual({ n, status: true });
      expect({ n, whereOrEffect: field(e, 'Where') !== null || field(e, 'Effect') !== null }).toEqual({ n, whereOrEffect: true });
    }
  });

  it('gives a Workaround exactly where the candidate list (for PG-100, §17) gives one', () => {
    for (const n of NEW_IDS) {
      expect({ n, workaround: field(entryOf(n, sectionText), 'Workaround') !== null }).toEqual({ n, workaround: CANDIDATES[n].workaround });
    }
    const [, w100] = /PG-100, which no candidate states: .*?; Workaround: (.+?) \(§4\)\./.exec(S17)!;
    expect(field(entryOf(100, sectionText), 'Workaround')).toContain(w100);
    expect(field(entryOf(83, sectionText), 'Workaround')).toBe('treat the figure as an upper bound.');
    expect(field(entryOf(86, sectionText), 'Workaround')).toBe('gem level 18 or higher for areas 79 and 82.');
    expect(field(entryOf(96, sectionText), 'Workaround')).toBe('measure such a layer by its prevented share at two non-zero values, not by removing it.');
  });

  it('names where each was seen as the candidate list (and §17 for PG-100) gives it', () => {
    const seen = (n: number) => field(entryOf(n, sectionText), 'Seen in') ?? '';
    expect(seen(83)).toContain('five Gemlings');
    expect(seen(84)).toContain("Ignatius's Comet Infernalist");
    expect(seen(91)).toContain('Enfeeble casters');
    expect(seen(95)).toContain('none of the 30');
    expect(seen(96)).toContain("Snoobae's Twister");
    expect(seen(96)).toContain('the Beast Master');
    const [, none100, source100] = /PG-100, which no candidate states: .*?; Seen in: (none of the 30) \((Forgotten Warden) is the only source in the pinned data\)/.exec(S17)!;
    expect(seen(100)).toContain(none100);
    expect(seen(100)).toContain(source100);
  });

  it('cites PoB only at files and lines the pin holds', () => {
    let cites = 0;
    for (const n of NEW_IDS) {
      let last = '';
      for (const m of entryOf(n, sectionText).matchAll(/`((?:Modules|Data|Classes)\/[^`:]+\.lua)?:(\d+)(?:-(\d+))?`/g)) {
        last = m[1] ?? last;
        expect({ n, cite: m[0], file: last !== '' }).toEqual({ n, cite: m[0], file: true });
        const lines = read(path.join(PIN_SRC, last)).split(/\r?\n/).length;
        const to = Number(m[3] ?? m[2]);
        expect({ n, cite: m[0], inFile: Number(m[2]) >= 1 && Number(m[2]) <= to && to <= lines }).toEqual({ n, cite: m[0], inFile: true });
        cites++;
      }
    }
    expect(cites).toBeGreaterThan(30);
  });
});

describe('AC-W94 (WU-122): each cited PoB line says what the entry says it does', () => {
  const pin = (rel: string) => read(path.join(PIN_SRC, rel)).split(/\r?\n/);
  /** The pin's lines `from`–`to` (1-based), joined. */
  const lines = (rel: string, from: number, to = from) => pin(rel).slice(from - 1, to).join('\n');
  const cited = (n: number, cite: string) => expect({ n, cite, cited: entryOf(n, sectionText).includes(`\`${cite}\``) }).toEqual({ n, cite, cited: true });
  /** The `skills["…"]` entry a line of a skills file sits in. */
  const skillAt = (rel: string, line: number) => {
    const ls = pin(rel);
    for (let i = line - 1; i >= 0; i--) {
      const m = /^skills\["([^"]+)"\]/.exec(ls[i]);
      if (m) return m[1];
    }
    return null;
  };
  const luaFiles = (dir: string): string[] =>
    fs.readdirSync(dir, { withFileTypes: true }).flatMap((d) => {
      const p = path.join(dir, d.name);
      return d.isDirectory() ? luaFiles(p) : d.name.endsWith('.lua') ? [p] : [];
    });

  it("PG-83: PoB counts Virtuous Barrier's motes from the socketed gems, and nothing takes away the mote a hit removes", () => {
    cited(83, 'Modules/CalcSetup.lua:1485');
    expect(lines('Modules/CalcSetup.lua', 1485)).toContain('virtuousMoteSkillCount = accelerate.skills and env.virtuousMoteSkillCount or { Str = 3, Dex = 3, Int = 3 }');
    cited(83, ':1857-1871');
    expect(lines('Modules/CalcSetup.lua', 1857, 1871)).toContain('virtuousMoteSkillCount[attr] = virtuousMoteSkillCount[attr] + moteValue');
    cited(83, ':2096-2099');
    expect(lines('Modules/CalcSetup.lua', 2096, 2099)).toContain('env.modDB.multipliers.DexterityMoteSkillCount = virtuousMoteSkillCount.Dex');
    cited(83, 'Data/Skills/other.lua:19594');
    expect(lines('Data/Skills/other.lua', 19594)).toContain('loses a random Mote when you are Hit');
    expect(read(path.join(PIN_SRC, 'Modules', 'ConfigOptions.lua'))).not.toMatch(/mote/i);
  });

  it("PG-86: the curses' level cap and the two debuffs' caps are per-level stats that nothing computing reads", () => {
    cited(86, 'Data/Skills/act_int.lua:6047-6049');
    expect(skillAt('Data/Skills/act_int.lua', 6047)).toBe('ElementalWeaknessPlayer');
    expect(lines('Data/Skills/act_int.lua', 6047)).toMatch(/^\s*\[16\] = \{ \d+, \d+, -?\d+, 76,/);
    expect(lines('Data/Skills/act_int.lua', 6048)).toMatch(/^\s*\[17\] = \{ \d+, \d+, -?\d+, 78,/);
    expect(lines('Data/Skills/act_int.lua', 6049)).toMatch(/^\s*\[18\] = \{ \d+, \d+, -?\d+, 0,/);
    cited(86, 'Data/Skills/act_int.lua:9111');
    expect(skillAt('Data/Skills/act_int.lua', 9111)).toBe('FrostBombPlayer');
    expect(lines('Data/Skills/act_int.lua', 9111)).toContain('"frost_bomb_exposure_does_not_apply_to_enemies_of_level_higher_than_X"');
    cited(86, 'Data/Skills/act_str.lua:19537');
    expect(skillAt('Data/Skills/act_str.lua', 19537)).toBe('ThunderstormPlayer');
    expect(lines('Data/Skills/act_str.lua', 19537)).toContain('"thunderstorm_wet_debuff_cannot_apply_to_targets_above_level"');
    const stats = /skill_curses_cannot_apply_to_targets_above_level|frost_bomb_exposure_does_not_apply_to_enemies_of_level_higher_than_X|thunderstorm_wet_debuff_cannot_apply_to_targets_above_level/;
    const readers = [...luaFiles(path.join(PIN_SRC, 'Modules')), ...luaFiles(path.join(PIN_SRC, 'Classes')), path.join(PIN_SRC, 'Data', 'SkillStatMap.lua')]
      .filter((f) => stats.test(read(f)));
    expect(readers).toEqual([]);
  });

  it('PG-87 and PG-88: the gain reads the type after its conversions; the over-100% sum runs over the type itself', () => {
    cited(87, 'Modules/CalcOffence.lua:94-104');
    const gain = lines('Modules/CalcOffence.lua', 94, 104);
    expect(gain).toContain('output[otherType.."MinBase"] * activeSkill.conversionTable[otherType].mult');
    expect(gain).toContain('calcConvertedDamage(activeSkill, output, cfg, otherType)');
    cited(87, 'Data/Skills/sup_dex.lua:5604');
    expect(skillAt('Data/Skills/sup_dex.lua', 5604)).toBe('SupportTulsStillnessPlayer');
    expect(lines('Data/Skills/sup_dex.lua', 5604)).toContain('"non_skill_base_cold_damage_%_to_gain_as_chaos"');
    cited(87, 'Data/Uniques/ring.lua:260');
    expect(lines('Data/Uniques/ring.lua', 253)).toBe('Original Sin');
    expect(lines('Data/Uniques/ring.lua', 260)).toBe('100% of Elemental Damage Converted to Chaos Damage');
    cited(88, 'Modules/CalcOffence.lua:2262-2289');
    const conv = lines('Modules/CalcOffence.lua', 2262, 2289);
    expect(conv).toMatch(/^\s*for _, toType in ipairs\(dmgTypeList\) do/);
    expect(conv).not.toContain('toType ~= fromType');
    expect(conv).toContain('if total > 100 then');
  });

  it("PG-89: Yoke of Suffering's line counts Scorched, Brittle and Sapped beside PoB's four elemental ailments", () => {
    cited(89, 'Data/Uniques/amulet.lua:304');
    expect(lines('Data/Uniques/amulet.lua', 293)).toBe('Yoke of Suffering');
    expect(lines('Data/Uniques/amulet.lua', 304)).toContain('Enemies take (15-20)% increased Damage for each Elemental Ailment type among');
    cited(89, 'Modules/ModParser.lua:3827-3836');
    const parsed = lines('Modules/ModParser.lua', 3827, 3836);
    expect(parsed).toContain('["enemies take (%d+)%% increased damage for each elemental ailment type among your ailments on them"]');
    expect([...parsed.matchAll(/var = "(\w+)"/g)].map((m) => m[1])).toEqual(['Frozen', 'Chilled', 'Ignited', 'Shocked', 'Scorched', 'Brittle', 'Sapped', 'Electrocuted']);
    cited(89, 'Modules/Data.lua:405');
    expect(lines('Modules/Data.lua', 405)).toBe('data.elementalAilmentTypeList = { "Ignite", "Chill", "Freeze", "Shock" }');
  });

  it('PG-90 and PG-91: the map enemy resists nothing, the Pinnacle boss 50% of each element, and halves curses', () => {
    const facts = JSON.parse(read(path.join(REPO, 'data', 'enemies', 'map-monsters.json')));
    expect(facts.facts['pob-enemy-is-boss'].value).toBe('None');
    cited(90, 'Modules/ConfigOptions.lua:1969-1974');
    const none = lines('Modules/ConfigOptions.lua', 1969, 1974);
    expect(none).toContain('if val == "None" then');
    expect(none).toContain('local defaultResist = ""');
    cited(90, ':2053-2056');
    const pinnacle = lines('Modules/ConfigOptions.lua', 2053, 2056);
    expect(pinnacle).toContain('local defaultEleResist = 50');
    for (const el of ['Lightning', 'Cold', 'Fire']) expect(pinnacle).toContain(`varControls['enemy${el}Resist']:SetPlaceholder(defaultEleResist, true)`);
    cited(90, 'Data/Uniques/sceptre.lua:112');
    expect(lines('Data/Uniques/sceptre.lua', 103)).toBe('Sacred Flame');
    expect(lines('Data/Uniques/sceptre.lua', 112)).toBe('Enemies in your Presence Resist Elemental Damage based on their Lowest Resistance');
    cited(91, 'Modules/ConfigOptions.lua:2043');
    expect(lines('Modules/ConfigOptions.lua', 2039)).toContain('elseif val == "Pinnacle" then');
    expect(lines('Modules/ConfigOptions.lua', 2043)).toContain('enemyModList:NewMod("CurseEffectOnSelf", "MORE", -50,');
  });

  it("PG-92: PoB's stun chance is 2 × hit ÷ threshold with a 20% floor, beside the data's 44 and 15", () => {
    cited(92, 'Modules/Data.lua:279-280');
    expect(lines('Modules/Data.lua', 279)).toMatch(/^\s*MinStunChanceNeeded = 20,$/);
    expect(lines('Modules/Data.lua', 280)).toMatch(/^\s*StunBaseMult = 200,$/);
    cited(92, 'Modules/CalcDefence.lua:2649-2650');
    const stun = lines('Modules/CalcDefence.lua', 2649, 2650);
    expect(stun).toContain('data.misc.StunBaseMult * effectiveEnemyDamage / output.StunThreshold');
    expect(stun).toContain('baseStunChance > data.misc.MinStunChanceNeeded and baseStunChance or 0');
    cited(92, 'Data/Misc.lua:46-47');
    expect(lines('Data/Misc.lua', 46)).toMatch(/^\s*\["LightStunMinimumChancePlayer"\] = 15,$/);
    expect(lines('Data/Misc.lua', 47)).toMatch(/^\s*\["LightStunRatioScalePlayer"\] = 44,$/);
  });

  it("PG-95 and PG-96: Tailwind's increase is never summed; the hits-to-die count switches with no chance layer", () => {
    cited(95, 'Modules/CalcSetup.lua:726');
    expect(lines('Modules/CalcSetup.lua', 726)).toContain('modDB:NewMod("DeflectEffect", "INC", 1, "Base", { type = "Multiplier", var = "Tailwind", limit = 10 })');
    cited(95, 'Modules/CalcDefence.lua:1522');
    expect(lines('Modules/CalcDefence.lua', 1522)).toContain('output.DeflectEffect = m_min(m_max(data.misc.DeflectEffect + modDB:Sum("BASE", nil, "DeflectEffect"), 0), 100)');
    const modules = luaFiles(path.join(PIN_SRC, 'Modules')).map(read).join('\n');
    expect(modules).not.toMatch(/Sum\("INC"[^)]*"DeflectEffect"|calcLib\.mod\([^)]*"DeflectEffect"/);
    cited(95, 'Modules/ConfigOptions.lua:936');
    expect(lines('Modules/ConfigOptions.lua', 936)).toContain('var = "multiplierTailwind"');
    expect(lines('Modules/ConfigOptions.lua', 936)).not.toMatch(/[Dd]eflect/);
    cited(96, 'Modules/CalcDefence.lua:3311');
    expect(lines('Modules/CalcDefence.lua', 3311)).toContain('output["NumberOfMitigatedDamagingHits"] = (output["ConfiguredDamageChance"] ~= 100 or DamageIn["TrackRecoupable"]');
    expect(lines('Modules/CalcDefence.lua', 3311)).toContain('and numberOfHitsToDie(DamageIn) or output["NumberOfDamagingHits"]');
  });

  it("PG-97 and PG-98: the enemy's ailments come from the raw hit with no deflection; bleeding's chance stays 0", () => {
    cited(97, 'Modules/CalcDefence.lua:2219');
    expect(lines('Modules/CalcDefence.lua', 2219)).toContain('output[damageType.."TakenDamage"] = output[damageType.."EnemyDamage"]');
    cited(97, ':4086-4093');
    const ailment = lines('Modules/CalcDefence.lua', 4086, 4093);
    expect(ailment).toContain('baseVal = baseVal + output[damageType.."TakenDamage"]');
    expect(ailment).toContain('output[damageConvertedType.."TakenDotMult"]');
    expect(ailment).not.toMatch(/[Dd]eflect/);
    cited(98, 'Modules/CalcDefence.lua:4000');
    expect(lines('Modules/CalcDefence.lua', 4000)).toContain('local enemyBleedChance = 0');
    expect(read(path.join(PIN_SRC, 'Modules', 'CalcDefence.lua')).match(/enemyBleedChance =/g)).toHaveLength(1);
    cited(98, ':3999-4005');
    expect(lines('Modules/CalcDefence.lua', 3999)).toContain('local enemyCritThreshold = 10.1');
    expect(lines('Modules/CalcDefence.lua', 3999, 4005)).toContain('output.EnemyCritChance > enemyCritThreshold or enemyIgniteChance > 0');
    cited(98, ':4009');
    expect(lines('Modules/CalcDefence.lua', 4009)).toContain('enemyPoisonChance = enemyDB:Sum("BASE", nil, "PoisonChance")');
  });

  it("PG-99 and PG-100: nothing scales a jewel's own affixes; a companion's deflected share is already in the max hit", () => {
    cited(99, 'Data/ModJewel.lua:363-364');
    const crafted = lines('Data/ModJewel.lua', 363, 364);
    expect(crafted).toContain('"(40-60)% increased Effect of Prefixes"');
    expect(crafted).toContain('"(40-60)% increased Effect of Suffixes"');
    expect(read(path.join(PIN_SRC, 'Classes', 'Item.lua'))).not.toMatch(/Effect of (Prefixes|Suffixes)|LocalPrefixEffect|LocalSuffixEffect/i);
    cited(100, 'Modules/CalcDefence.lua:2960-2963');
    const companion = lines('Modules/CalcDefence.lua', 2960, 2963);
    expect(companion).toContain('-- from companions');
    expect(companion).toContain('output["CompanionAllyDamageMitigation"] = companionMitigation + companionMitigationFromDeflected * (output.DeflectChance or 0) / 100');
    cited(100, 'Data/Uniques/body.lua:747');
    const line = "of Damage from Deflected Hits is taken from Damageable Companion's Life before you";
    expect(lines('Data/Uniques/body.lua', 738)).toBe('Forgotten Warden');
    expect(lines('Data/Uniques/body.lua', 747)).toContain(line);
    // The only source in the pinned data: one unique carries the line.
    const carriers = luaFiles(path.join(PIN_SRC, 'Data', 'Uniques')).flatMap((f) =>
      read(f).split(/\r?\n/).flatMap((l, i) => (l.includes(line) ? [`${path.relative(PIN_SRC, f)}:${i + 1}`] : [])));
    expect(carriers).toEqual(['Data/Uniques/body.lua:747']);
  });
});

describe("AC-W94 (WU-122): PG-82 lists the figures B4 leaves unexposed (amendment 12 §15)", () => {
  it("names each figure §15 says PoB has no single output for", () => {
    const [, list] = /A figure PoB has no single output for \(([^)]+)\) goes in PG-82's list instead/.exec(S15)!;
    const figures = list.split(/, /);
    expect(figures).toEqual(["the damage-from-mana-first share", "a barrier's size", 'the physical-taken-as table']);
    const e82 = entryOf(82);
    expect(e82).toMatch(/^- \*\*PG-82, figures our tools don't expose\.\*\* ours, reported \(study\)\./);
    for (const f of figures) expect({ f, listed: e82.includes(f) }).toEqual({ f, listed: true });
  });
});

describe("AC-W94 (WU-122): amendment 11's status paragraph says it was approved and built (amendment 12 §17)", () => {
  const lines = A11.split(/\r?\n/);
  const status = folded(lines.slice(2, 10).join('\n'));

  it("gives the approval's date and the user's words from the work-log's M-24 entry, and M-24's build", () => {
    const m24 = WORKLOG.slice(WORKLOG.search(/^## \d{4}-\d{2}-\d{2}: M-24 \(amendment 11\) build started$/m));
    const [, date] = /^## (\d{4}-\d{2}-\d{2}): M-24/.exec(m24)!;
    const [, words] = /- \*\*Approved:\*\* amendment 11 revision 3 by the user \("([^"]+)"\)/.exec(m24)!;
    expect(m24).toContain("**M-24's gate passed**");
    expect(status).toMatch(new RegExp(`^\\*\\*Status: APPROVED by the user, ${date}\\*\\* \\("${words}"\\), as revision 3, and built as M-24 \\(work-log\\)\\.`));
    expect(status).not.toMatch(/Waiting for|REVISION 3/);
  });

  it("says its live test (WU-116) runs with amendment 12's (WU-126), after M-25, quoting the user's words at amendment 12's approval", () => {
    const [, approved, quote] = /The user approved it on (\d{4}-\d{2}-\d{2}): "The amendment is approved, start the build\. (I won't do any live tests until the amendment is built\.)"/.exec(folded(SPEC))!;
    expect(status).toContain(`Its live test (WU-116) hasn't run: at amendment 12's approval (${approved}) the user said "${quote.replace(/\.$/, '')}", so it runs with amendment 12's live test (WU-126), after M-25.`);
  });

  it('changes only lines 3–10: the title, the blank line and the "It carries:" list around them stand', () => {
    expect(lines[0]).toBe('# Amendment 11: builds a player would run');
    expect(lines[1]).toBe('');
    expect(lines[2]).toMatch(/^\*\*Status: /);
    expect(lines[9]).toMatch(/ It carries:$/);
    expect(lines[10]).toBe("- the user's notes during and after the open-brief half of the live test (WU-109, run `open-clear/2026-10-24-1`),");
  });
});
