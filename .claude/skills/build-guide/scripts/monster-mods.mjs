#!/usr/bin/env node
// The rare monster modifier table's writer (amendment 8, D-402).
//
//   node .claude/skills/build-guide/scripts/monster-mods.mjs --from <folder> [--out <file>] [--date <YYYY-MM-DD>]
//
// Reads poe2db's two pages saved in <folder>, `Monster_Modifiers.html` (https://poe2db.tw/us/Monster_Modifiers) and
// `Tame_Beast.html` (https://poe2db.tw/us/Tame_Beast), and writes data/monsters/monster-mods.md, or <file>. Offline
// only: it never fetches. When poe2db changes, the user saves the two pages again and re-runs it.
//
// Each page's "Archnemesis Mods" tab is a list of rows: a name (plain, or a link to a keyword page), the modifier's
// lines (game text, or an internal stat id poe2db shows in a `secondary` span) and a hover icon. The table has one
// block per name, in the order Monster_Modifiers first shows it: its id (the name as a slug), kind (from the name's
// style: standard, abyss, abyss-special, corrupted), lines (each distinct line of the name's rows, internal ids
// marked), the keyword its name links to when that isn't its own page, its URL (its own poe2db page when its name
// links there, the list page otherwise), whether Tame_Beast's list has it, and the judgment below. Rows with no name
// are left out and counted: a block needs a name.
//
// The judgment per modifier (model, reach, config, Creates, Pays off on, note) is JUDGMENTS below, written from the
// lines, or from the name and its keyword where the page gives no lines. Creates and Pays off on use only the words
// of data/rules/vocabulary.md, or `none`.
//
// Exit 0: written, with a summary on stdout. Exit 1: a page is missing or doesn't parse (no "Archnemesis Mods" tab,
// its count differs from its rows), two names make one id, a named modifier has no judgment, or a judgment uses a
// word the vocabulary doesn't have; nothing is written (stderr says why). Exit 2: usage error.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(SCRIPT_DIR, '..', '..', '..', '..');
const DEFAULT_OUT = path.join(REPO, 'data', 'monsters', 'monster-mods.md');
const VOCABULARY = path.join(REPO, 'data', 'rules', 'vocabulary.md');
const BASE_URL = 'https://poe2db.tw/us/';
const PAGES = { mods: 'Monster_Modifiers', tame: 'Tame_Beast' };
const MODELS = ['stats', 'condition', 'none'];
/** The name's style on the page, as the table's kind. */
const KINDS = { strong: 'standard', archnemesismodabyss: 'abyss', archnemesismodabyssspecial: 'abyss-special', corrupted: 'corrupted' };
/** When a name's rows differ in style, the one that says more wins. */
const KIND_RANK = ['standard', 'abyss', 'abyss-special', 'corrupted'];

// ---------------------------------------------------------------------------------------------------------------
// The judgments, by id: how a plan models the modifier on a tamed beast (§4), who it reaches, PoB's config option for
// a condition, and the families it creates and pays off on.

const BEAST = 'the beast';
const ALLIES = 'its allies: the player and minions';
const HIT = 'enemies it hits';
const TRAIL = 'enemies on its trail';
const NEAR = 'enemies near it';
const DEATH = 'enemies where it dies';
const MINIONS = 'its minions';
const UNKNOWN = 'not on the page';

/** PoB's config options for the conditions a modifier supplies (`Modules/ConfigOptions.lua` at the pin). */
const CONFIG = {
  onChilledGround: 'conditionEnemyOnChilledGround ("Is the enemy on Chilled Ground?")',
  onShockedGround: 'conditionEnemyOnShockedGround ("Is the enemy on Shocked Ground?")',
  ignited: 'conditionEnemyIgnited ("Is the enemy Ignited?")',
  chilled: 'conditionEnemyChilled ("Is the enemy Chilled?")',
  shocked: 'conditionEnemyShocked ("Is the enemy Shocked?")',
  poisoned: 'conditionEnemyPoisoned ("Is the enemy Poisoned?")',
  bleeding: 'conditionEnemyBleeding ("Is the enemy Bleeding?")',
  hindered: 'conditionEnemyHindered ("Is the enemy Hindered?")',
  armourBroken: 'conditionEnemyArmourBroken ("Is enemy Armour Broken?")',
};

const NOTE = {
  internal: "Its only lines are internal stat ids, which PoB can't take as lines.",
  name: 'Judged from its name: the page gives no lines.',
  ownDamage: "Damage the beast deals on its own, which PoB can't add; the page gives no lines.",
  deathDamage: "Damage where the beast dies, which PoB can't add; the page gives no lines.",
  aura: 'Judged from its name: the page gives no lines, so a plan takes the figures from its poe2db page (the URL) ' +
    'before writing them as player lines and `Minions have` lines.',
  ignitedGround: 'PoB has no option for an enemy on Ignited Ground, so the plan takes an Ignited enemy.',
  onDeath: 'Only where the beast dies, so a reviving companion supplies it rarely.',
  minions: "What it does for a tamed beast's minions isn't on the page.",
};

/** A judgment: model, reach, creates and pays off on (space-separated families, '' for none), then config and note. */
const j = (model, reach, creates, pays, more = {}) => ({
  model,
  reach,
  creates: creates ? creates.split(' ') : [],
  pays: pays ? pays.split(' ') : [],
  ...more,
});
/** The beast's own stats, in player text: they make the beast hit harder or live longer. */
const own = (note) => j('stats', BEAST, '', 'companion', note ? { note } : {});

export const JUDGMENTS = {
  'extra-fire-damage': own(),
  'extra-cold-damage': own(),
  'extra-lightning-damage': own(),
  hasted: own("Its speed is the beast's own; Haste Aura is the modifier whose speed reaches its allies."),
  'extra-crits': own(),
  stuns: j('stats', BEAST, 'stun', 'companion', { note: "The buildup is the beast's: enemies it hits are stunned sooner." }),
  armoured: j('none', BEAST, '', 'companion', { note: NOTE.internal }),
  evasive: j('none', BEAST, '', 'companion', { note: NOTE.internal }),
  'extra-energy-shield': j('none', BEAST, '', 'companion', { note: NOTE.internal }),
  'always-poisons': j('condition', HIT, 'poison', '', { config: CONFIG.poisoned }),
  'always-bleeds': j('condition', HIT, 'bleed', '', { config: CONFIG.bleeding }),
  'periodically-unleashes-fire': j('none', NEAR, '', '', { note: NOTE.ownDamage }),
  'burning-ground-on-death': j('condition', DEATH, 'ignited-ground', 'minion-death', {
    config: CONFIG.ignited,
    note: `Judged from its name and the Ignited Ground keyword it links. ${NOTE.onDeath} ${NOTE.ignitedGround}`,
  }),
  'periodically-unleashes-ice': j('none', NEAR, '', '', { note: NOTE.ownDamage }),
  'chilled-ground-on-death': j('condition', DEATH, 'chilled-ground', 'minion-death', {
    config: CONFIG.onChilledGround,
    note: `${NOTE.name} ${NOTE.onDeath}`,
  }),
  'periodically-unleashes-lightning': j('none', NEAR, '', '', { note: NOTE.ownDamage }),
  'shocked-ground-on-death': j('condition', DEATH, 'shocked-ground', 'minion-death', {
    config: CONFIG.onShockedGround,
    note: `${NOTE.name} ${NOTE.onDeath}`,
  }),
  'increased-stun-threshold': own(),
  'stun-resistant': own(),
  'fire-resistant': own(),
  'cold-resistant': own(),
  'lightning-resistant': own(),
  'breaks-armour': j('condition', HIT, 'armour-break', '', { config: CONFIG.armourBroken, note: "The beast's physical hits break enemies' armour." }),
  accurate: own(),
  'extra-chaos-damage': own(),
  'regenerates-life': own(),
  'additional-projectiles': own("Worth something only when the beast's own skills fire projectiles."),
  'increased-area-of-effect': own("It widens the beast's own skills."),
  'all-damage-ignites': j('condition', HIT, 'ignite', '', { config: CONFIG.ignited }),
  'all-damage-chills': j('condition', HIT, 'chill', '', { config: CONFIG.chilled }),
  'all-damage-shocks': j('condition', HIT, 'shock', '', { config: CONFIG.shocked }),
  'trail-of-fire': j('condition', TRAIL, 'ignited-ground', '', {
    config: CONFIG.ignited,
    note: `Judged from its name and the Ignited Ground keyword it links: the page gives no lines. ${NOTE.ignitedGround}`,
  }),
  'trail-of-ice': j('condition', TRAIL, 'chilled-ground', '', {
    config: CONFIG.onChilledGround,
    note: 'Judged from its name and the Chilled Ground keyword it links: the page gives no lines. It is the only ice ' +
      'trail on either page, so it is taken to be the "Frozen Ground Trail" a guide names.',
  }),
  'trail-of-lightning': j('condition', TRAIL, 'shocked-ground', '', {
    config: CONFIG.onShockedGround,
    note: 'Judged from its name, as Trail of Fire and Trail of Ice are: the page gives no lines.',
  }),
  'slow-resistant': own(),
  'crit-resistant': own(),
  'chaos-resistant': own(),
  'periodic-fire-explosions': j('none', NEAR, '', '', { note: NOTE.ownDamage }),
  'periodic-cold-explosions': j('none', NEAR, '', '', { note: NOTE.ownDamage }),
  'periodic-lightning-explosions': j('none', NEAR, '', '', { note: NOTE.ownDamage }),
  'fire-explosion-on-death': j('none', DEATH, '', 'minion-death', { note: NOTE.deathDamage }),
  'cold-explosion-on-death': j('none', DEATH, '', 'minion-death', { note: NOTE.deathDamage }),
  'lightning-explosion-on-death': j('none', DEATH, '', 'minion-death', { note: NOTE.deathDamage }),
  'powerful-minions': j('none', MINIONS, '', '', { note: NOTE.minions }),
  empowered: own(),
  'extra-physical-damage-aura': j('stats', ALLIES, 'damage-conversion', '', {
    note: `${NOTE.aura} Like Extra Fire Damage's "Gain … of Damage as Extra … Damage", it is taken to add Physical damage.`,
  }),
  'haste-aura': j('stats', ALLIES, 'attack-speed cast-speed movement-speed', '', {
    note: `${NOTE.aura} Which speeds it raises is taken from Hasted's lines.`,
  }),
  'energy-shield-aura': j('stats', ALLIES, 'energy-shield', '', { note: NOTE.aura }),
  'elemental-resistance-aura': j('stats', ALLIES, 'resistance', '', { note: NOTE.aura }),
  'temporal-bubble': j('none', BEAST, '', 'companion', { note: NOTE.internal }),
  'hinder-aura': j('condition', NEAR, 'hinder', '', { config: CONFIG.hindered, note: NOTE.name }),
  'prevents-recovery-above-50': j('none', NEAR, '', '', { note: "It stops enemies' recovery, which PoB doesn't model; the page gives no lines." }),
  'periodic-invulnerability-aura': j('none', ALLIES, '', '', { note: `${NOTE.internal} The id names "monster allies".` }),
  'empowered-periodic-invulnerability-aura': j('none', ALLIES, '', '', { note: `${NOTE.internal} The id names "monster allies".` }),
  'increased-life': own(),
  'siphons-mana-and-deals-lightning-damage': j('none', NEAR, '', '', { note: NOTE.ownDamage }),
  'heals-allies-and-suppresses-foe-recovery': j('none', `${ALLIES}, and ${NEAR}`, 'recovery', '', {
    note: "Judged from its name: the page gives no lines, and PoB has no line for an ally's periodic heal.",
  }),
  'siphons-flask-charges': j('none', NEAR, '', '', { note: "It drains flask charges, which a tamed beast's enemies don't have." }),
  'reviving-minions': j('none', MINIONS, '', '', { note: NOTE.minions }),
  'empowered-reviving-minions': j('none', MINIONS, '', '', { note: NOTE.minions }),
  'damage-taken-from-minions-first': j('none', BEAST, '', 'companion', { note: NOTE.internal }),
  'shroud-walker': j('none', BEAST, '', '', { note: NOTE.name }),
  'periodically-enrages': j('none', BEAST, '', 'companion', { note: `${NOTE.name} A plan has no figure for the enrage.` }),
  enraged: j('none', BEAST, '', 'companion', { note: `${NOTE.name} A plan has no figure for the enrage.` }),
  'explodes-nearby-corpses': j('none', NEAR, '', 'corpse', { note: 'It uses up corpses near the beast; the page gives no lines.' }),
  'lightning-mirage-when-hit': j('none', BEAST, '', '', { note: NOTE.name }),
  'lightning-mirages-when-hit': j('none', BEAST, '', '', { note: NOTE.name }),
  'magma-barrier': j('none', BEAST, '', 'companion', { note: NOTE.name }),
  'conjures-ice-prisons': j('none', NEAR, '', '', { note: NOTE.ownDamage }),
  'conjures-flamewalls': j('none', NEAR, '', '', { note: NOTE.ownDamage }),
  'conjures-lightning-storms': j('none', NEAR, '', '', { note: NOTE.ownDamage }),
  'volatile-crystals': j('none', NEAR, '', '', { note: NOTE.ownDamage }),
  'volatile-plants': j('none', NEAR, '', '', { note: NOTE.ownDamage }),
  'empowering-volatile-plants': j('none', NEAR, '', '', { note: NOTE.ownDamage }),
  'volatile-crag': j('none', NEAR, '', '', { note: NOTE.ownDamage }),
  'empowering-volatile-crag': j('none', NEAR, '', '', { note: NOTE.ownDamage }),
  'proximal-tangibility': j('none', BEAST, '', 'companion', { note: NOTE.internal }),
  bombardier: j('none', NEAR, '', '', { note: NOTE.ownDamage }),
  'soul-eater': j('none', BEAST, '', '', { note: NOTE.name }),
  'conjures-elemental-hazards': j('none', NEAR, '', '', { note: NOTE.ownDamage }),
  'volatile-souls': j('none', NEAR, '', '', { note: NOTE.ownDamage }),
  'soul-siphoner': j('none', UNKNOWN, '', '', { note: NOTE.name }),
  'kurgals-last-gasp': j('none', UNKNOWN, '', '', { note: NOTE.name }),
  'undying-will': j('none', BEAST, '', 'companion', { note: NOTE.internal }),
  'lithomantic-runes': j('none', UNKNOWN, '', '', { note: NOTE.name }),
  'meteoric-demise': j('none', UNKNOWN, '', '', { note: NOTE.name }),
  'kulemaks-desecration': j('none', UNKNOWN, '', '', { note: NOTE.name }),
  'ulamans-legion': j('none', BEAST, '', '', { note: `${NOTE.internal} They name the "aura owner", the beast.` }),
  'amanamus-void': j('none', UNKNOWN, '', '', { note: NOTE.name }),
  'lifestealer-aura': j('none', NEAR, '', '', { note: NOTE.name }),
  'unstable-revenants': j('none', UNKNOWN, '', '', { note: NOTE.name }),
  'bubonic-trail': j('none', TRAIL, 'other-ground', '', {
    note: "Judged from its name, a trail as Trail of Ice is: the page gives no lines, so its ground's kind is unknown " +
      'and PoB has no option for it.',
  }),
  'crystalline-barrier': j('none', BEAST, '', 'companion', { note: NOTE.name }),
  'soulflame-geysers': j('none', NEAR, '', '', { note: NOTE.ownDamage }),
  'shade-walker': j('none', BEAST, '', '', { note: NOTE.name }),
  'eruption-of-souls': j('none', NEAR, '', '', { note: NOTE.ownDamage }),
  corrupted: j('none', BEAST, '', '', { note: `${NOTE.internal} Several rows share this name, each a different effect.` }),
};

// ---------------------------------------------------------------------------------------------------------------
// Parsing.

export class ParseError extends Error {}

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
function decode(text) {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (whole, e) => {
    if (e[0] === '#') return String.fromCodePoint(e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : Number(e.slice(1)));
    return ENTITIES[e.toLowerCase()] ?? whole;
  });
}
/** An HTML fragment's text: tags dropped, entities decoded, white space collapsed. */
const textOf = (html) => decode(html.replace(/<[^>]*>/g, '')).replace(/\s+/g, ' ').trim();

/** A name as an entry id: lowercase words joined by hyphens, apostrophes and other marks dropped. */
export function slug(name) {
  return name.toLowerCase().replace(/['’]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

/**
 * The rows of a page's "Archnemesis Mods" tab: `{name, cls, link, lines}`, where `link` is the name's link
 * `{keyword, href, text}` or null and each line is `{text, internal}`. Throws a ParseError when the tab is missing or
 * its count differs from its rows.
 */
export function parseArchnemesisMods(html, page) {
  const start = html.indexOf('<div id="ArchnemesisMods"');
  if (start < 0) throw new ParseError(`${page}: no "Archnemesis Mods" tab (div#ArchnemesisMods)`);
  let section = html.slice(start);
  const next = section.indexOf('<div id="', 1);
  const footer = section.indexOf('<footer');
  const end = Math.min(...[next, footer].filter((i) => i > 0), section.length);
  section = section.slice(0, end);
  const header = /<h5 class="card-header">\s*Archnemesis Mods\s*\/(\d+)\s*<\/h5>/.exec(section);
  if (!header) throw new ParseError(`${page}: the "Archnemesis Mods" tab has no "Archnemesis Mods /<count>" header`);
  const rows = section.split('<div class="col">').slice(1).map((row, i) => parseRow(row, `${page} row ${i + 1}`));
  if (rows.length !== Number(header[1])) {
    throw new ParseError(`${page}: the "Archnemesis Mods" tab says ${header[1]} rows but holds ${rows.length}`);
  }
  return rows;
}

function parseRow(row, where) {
  const marker = '<div class="flex-grow-1 ms-2">';
  const at = row.indexOf(marker);
  if (at < 0) throw new ParseError(`${where}: no "flex-grow-1 ms-2" body`);
  let body = row.slice(at + marker.length);
  const icon = body.search(/<i\b/);
  body = icon >= 0 ? body.slice(0, icon) : body.replace(/(<\/div>\s*)+$/, '');
  let name = '';
  let cls = null;
  let link = null;
  const head = /^\s*<div class="([\w-]+)">([\s\S]*?)<\/div>/.exec(body);
  if (head) {
    cls = head[1];
    name = textOf(head[2]);
    const a = /<a\b[^>]*?data-keyword="([^"]*)"[^>]*?href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/.exec(head[2]);
    if (a) link = { keyword: a[1], href: a[2], text: textOf(a[3]) };
    body = body.slice(head[0].length);
  }
  const lines = body
    .split(/<br\s*\/?>/i)
    .map((part) => ({ text: textOf(part), internal: /class=["']secondary["']/.test(part) }))
    .filter((l) => l.text !== '');
  return { name, cls, link, lines };
}

/** The page title a poe2db href names: `Chilled_Ground` is "Chilled Ground". */
const hrefTitle = (href) => safeDecode(href).replace(/_/g, ' ');
function safeDecode(s) {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}

/**
 * The modifiers, one per name in the order Monster_Modifiers first shows it (then any name only Tame_Beast has), with
 * the rows each page holds for it, and the count of rows with no name.
 */
export function joinPages(modRows, tameRows) {
  const byName = new Map();
  const add = (row, page) => {
    if (!row.name) return;
    if (!byName.has(row.name)) byName.set(row.name, { name: row.name, rows: { mods: [], tame: [] } });
    byName.get(row.name).rows[page].push(row);
  };
  modRows.forEach((r) => add(r, 'mods'));
  tameRows.forEach((r) => add(r, 'tame'));
  const unnamed = { mods: modRows.filter((r) => !r.name).length, tame: tameRows.filter((r) => !r.name).length };
  const ids = new Map();
  const modifiers = [...byName.values()].map(({ name, rows }) => {
    const all = [...rows.mods, ...rows.tame];
    const id = slug(name);
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(id)) throw new ParseError(`"${name}" makes no id`);
    if (ids.has(id)) throw new ParseError(`"${name}" and "${ids.get(id)}" both make the id ${id}`);
    ids.set(id, name);
    const kind = all.map((r) => KINDS[r.cls] ?? r.cls ?? 'standard').sort((a, b) => rank(b) - rank(a))[0];
    const lines = [];
    for (const r of all) for (const l of r.lines) if (!lines.some((x) => x.text === l.text && x.internal === l.internal)) lines.push(l);
    const ownLink = all.find((r) => r.link && r.link.text === name && hrefTitle(r.link.href) === name);
    const other = all.find((r) => r.link && r !== ownLink && hrefTitle(r.link.href) !== name);
    return {
      name,
      id,
      kind,
      lines,
      url: ownLink ? BASE_URL + ownLink.link.href : BASE_URL + PAGES.mods,
      keyword: !ownLink && other ? { name: hrefTitle(other.link.href), url: BASE_URL + other.link.href } : null,
      keep: rows.tame.length > 0,
      rows: { mods: rows.mods.length, tame: rows.tame.length },
    };
  });
  return { modifiers, unnamed };
}
const rank = (kind) => {
  const i = KIND_RANK.indexOf(kind);
  return i < 0 ? KIND_RANK.length : i;
};

/** The families data/rules/vocabulary.md defines: each backticked word on a `- ` line. */
export function readVocabulary(file = VOCABULARY) {
  const words = new Set();
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    if (!line.startsWith('- `')) continue;
    for (const m of line.matchAll(/`([a-z0-9-]+)`/g)) words.add(m[1]);
  }
  return words;
}

/** The problems with the judgments of these modifiers: missing ones, a bad model, a word not in the vocabulary. */
export function checkJudgments(modifiers, vocabulary, judgments = JUDGMENTS) {
  const problems = [];
  for (const m of modifiers) {
    const jd = judgments[m.id];
    if (!jd) {
      problems.push(`no judgment for "${m.name}" (${m.id}): add one to JUDGMENTS in monster-mods.mjs`);
      continue;
    }
    if (!MODELS.includes(jd.model)) problems.push(`${m.id}: model "${jd.model}" isn't one of ${MODELS.join(', ')}`);
    if (jd.model === 'condition' && !jd.config) problems.push(`${m.id}: a condition names its config option`);
    for (const w of [...jd.creates, ...jd.pays]) if (!vocabulary.has(w)) problems.push(`${m.id}: "${w}" isn't in data/rules/vocabulary.md`);
  }
  return problems;
}

// ---------------------------------------------------------------------------------------------------------------
// Rendering.

const families = (list) => (list.length ? list.join(', ') : 'none');
const rowsOf = (n) => `${n} row${n === 1 ? '' : 's'}`;

/** A prose line wrapped at 120 columns, its continuation lines indented by `indent`; a code span is never split. */
export function wrap(text, indent = '  ', width = 120) {
  const out = [];
  let line = '';
  for (const word of text.match(/(?:`[^`]*`|[^\s`])+/g) ?? []) {
    const next = line ? `${line} ${word}` : word;
    if (next.length > width && line.trim()) {
      out.push(line);
      line = `${indent}${word}`;
    } else line = next;
  }
  out.push(line);
  return out.join('\n');
}

function renderBlock(m, jd) {
  const out = [`### ${m.name}`, `- Id: ${m.id}`, `- Kind: ${m.kind}`];
  if (m.lines.length === 0) out.push('- Lines: none on the page (poe2db shows them only in a hover)');
  else {
    out.push('- Lines:');
    for (const l of m.lines) out.push(l.internal ? `  - internal stat id: ${l.text}` : `  - "${l.text}"`);
  }
  out.push(`- URL: ${m.url}`);
  if (m.keyword) out.push(`- Keyword: ${m.keyword.name}, ${m.keyword.url}`);
  out.push(`- Tamed beast keeps it: ${m.keep ? 'yes' : 'no'}`);
  out.push(`- Model: ${jd.model}`);
  out.push(`- Reach: ${jd.reach}`);
  if (jd.config) out.push(`- Config: ${jd.config}`);
  out.push(`- Creates: ${families(jd.creates)} | Pays off on: ${families(jd.pays)}`);
  if (jd.note) out.push(wrap(`- Note: ${jd.note}`));
  return out.join('\n');
}

export function counts(modifiers, judgments = JUDGMENTS) {
  const byModel = Object.fromEntries(MODELS.map((x) => [x, modifiers.filter((m) => judgments[m.id].model === x).length]));
  return { modifiers: modifiers.length, keep: modifiers.filter((m) => m.keep).length, ...byModel };
}

export function render({ modifiers, unnamed, modRows, tameRows, date }, judgments = JUDGMENTS) {
  const c = counts(modifiers, judgments);
  const prose = [
    `Written by \`.claude/skills/build-guide/scripts/monster-mods.mjs\` from poe2db's pages saved ${date} ` +
      '(amendment 8, D-402). Re-run the script to change it; its judgments are in the script.',
    '',
    `- **Source.** ${BASE_URL}${PAGES.mods}, its "Archnemesis Mods" list (${modRows} rows), and ${BASE_URL}${PAGES.tame}, ` +
      `its own "Archnemesis Mods" list (${tameRows} rows). One block per name: ${c.modifiers} modifiers, ${c.keep} on ` +
      `Tame_Beast's list; ${c.stats} modelled as stats, ${c.condition} as a condition, ${c.none} not at all. Left out: ` +
      `${rowsOf(unnamed.mods)} with no name (league modifiers such as runes', many with internal stat ids or no lines).`,
    '- **Read it by Grep:** a family (`chilled-ground`) in the index below, then the block by its heading ' +
      "(`grep -n -A14 '^### Trail of Ice' data/monsters/monster-mods.md`). A citation is " +
      '`data | monsters/monster-mods.md#<id>`.',
    '- **Lines** are the game\'s words, quoted. `internal stat id:` marks a stat poe2db shows by its id with its value ' +
      'in brackets, which the game words differently. Many modifiers show their lines only in a hover the saved page ' +
      "doesn't hold: their judgment rests on the name and the keyword it links.",
    '- **Tamed beast keeps it:** the Tame Beast gem says "Tamed Beast retains up to four monster modifiers when ' +
      'summoned"; `yes` means Tame_Beast\'s list has the modifier.',
    '- **Model,** how a plan models the modifier on a tamed beast that keeps it: `stats`, its lines go in as custom ' +
      'modifiers (D-293), each an estimate the record marks; `condition`, what it supplies is the config entry its ' +
      "`Config` line names, as enemies on Chilled Ground are; `none`, PoB can't take it, and the card says so.",
    '- **Reach,** who the modifier acts on: `the beast`, lines for the companion alone; `its allies: the player and ' +
      'minions`, player lines and `Minions have` lines; enemies, for what it inflicts or leaves on the ground.',
    '- **Creates** is what the beast supplies to the build beyond its own stats; **Pays off on** is what makes the ' +
      "modifier worth more (`companion`: the beast's own damage or survival). Both use the words of " +
      '`data/rules/vocabulary.md`, or `none`.',
  ];
  const head = [
    '# Rare monster modifiers',
    '',
    ...prose.map((p) => wrap(p, p.startsWith('- ') ? '  ' : '')),
    '',
    '## Index',
    '',
    ...modifiers.map((m) => {
      const jd = judgments[m.id];
      return `- ${m.name} (${m.id}): ${jd.model}; creates ${families(jd.creates)}; pays off on ${families(jd.pays)}; ` +
        `keeps: ${m.keep ? 'yes' : 'no'}`;
    }),
    '',
    '## Modifiers',
  ];
  return [...head, ...modifiers.flatMap((m) => ['', renderBlock(m, judgments[m.id])]), ''].join('\n');
}

// ---------------------------------------------------------------------------------------------------------------

function usage(message) {
  process.stderr.write(`monster-mods: ${message}\nusage: monster-mods.mjs --from <folder> [--out <file>] [--date <YYYY-MM-DD>]\n`);
  return 2;
}

/** A file's modification day, local time, as YYYY-MM-DD. */
function dayOf(file) {
  const d = fs.statSync(file).mtime;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function main(argv) {
  const args = argv.slice(2);
  const opts = {};
  for (let i = 0; i < args.length; i++) {
    const flag = args[i];
    if (!['--from', '--out', '--date'].includes(flag)) return usage(`unknown argument ${flag}`);
    if (i + 1 >= args.length) return usage(`${flag} needs a value`);
    opts[flag.slice(2)] = args[++i];
  }
  if (!opts.from) return usage('--from <folder> is required: the script reads saved pages and never fetches');
  if (opts.date && !/^\d{4}-\d{2}-\d{2}$/.test(opts.date)) return usage(`--date ${opts.date} isn't YYYY-MM-DD`);
  const out = path.resolve(opts.out ?? DEFAULT_OUT);
  try {
    const files = Object.fromEntries(Object.entries(PAGES).map(([k, p]) => [k, path.join(opts.from, `${p}.html`)]));
    for (const f of Object.values(files)) if (!fs.existsSync(f)) throw new ParseError(`no saved page ${f}`);
    const modRows = parseArchnemesisMods(fs.readFileSync(files.mods, 'utf8'), PAGES.mods);
    const tameRows = parseArchnemesisMods(fs.readFileSync(files.tame, 'utf8'), PAGES.tame);
    const { modifiers, unnamed } = joinPages(modRows, tameRows);
    if (modifiers.length === 0) throw new ParseError('no named modifier on either page');
    const problems = checkJudgments(modifiers, readVocabulary());
    if (problems.length) throw new ParseError(problems.join('\n'));
    const text = render({ modifiers, unnamed, modRows: modRows.length, tameRows: tameRows.length, date: opts.date ?? dayOf(files.mods) });
    fs.mkdirSync(path.dirname(out), { recursive: true });
    const tmp = `${out}.tmp-${process.pid}`;
    fs.writeFileSync(tmp, text);
    fs.renameSync(tmp, out);
    const c = counts(modifiers);
    process.stdout.write(
      `monster-mods: wrote ${path.relative(process.cwd(), out) || out}: ${c.modifiers} modifiers, ${c.keep} a tamed beast ` +
        `keeps; stats ${c.stats}, condition ${c.condition}, none ${c.none}; ${rowsOf(unnamed.mods)} with no name left out\n`,
    );
    return 0;
  } catch (e) {
    if (!(e instanceof ParseError)) throw e;
    process.stderr.write(`monster-mods: ${e.message}\nnothing written\n`);
    return 1;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = main(process.argv);
}
