#!/usr/bin/env node
// The league digest (amendment 8, D-400): what one poe2db league or patch section adds, as a committed Markdown file
// that every R1a researcher and the rival read: data/league/<file slug>.md.
//
//   node .claude/skills/build-guide/scripts/league-digest.mjs <slug> [--from <folder>] [--save <folder>] [--out <dir>] [--pin-names <file.json>]
//   node .claude/skills/build-guide/scripts/league-digest.mjs --reflag <slug> [--out <dir>] [--pin-names <file.json>]
//
// <slug> is poe2db's name for the section, as its URLs spell it (`Runes_of_Aldur`). The digest's file is the slug in
// lowercase with hyphens (`runes-of-aldur.md`); `--reflag` takes either spelling.
//
// **Fetching** (no `--from`): the homepage https://poe2db.tw/us/ first, for the section's block, then each list page
// that block links: `<slug>_gems`, `<slug>_uniques`, `<slug>_items`. One request at a time, at least 3 s apart, with
// the server's User-Agent `pob2-mcp-server/<package.json version>` and no cookie or other identifying header; one
// retry after 60 s on HTTP 429 or 5xx; nothing fetched twice. poe2db's robots.txt disallows only /*/marked and
// /*/markdown_history. Each page is saved as it arrives (to `--save <folder>`, or a new temp folder), before any
// parse, so a parser fix re-runs with `--from` and no request.
//
// **`--from <folder>`** reads saved pages instead and makes no request: home.html, then <slug>_gems.html,
// <slug>_uniques.html and <slug>_items.html as the section's block links them. An entry's fetch date is the day its
// page was saved (the file's modification time).
//
// **What it keeps.** From the list pages: every gem (its tags and description), every unique (its base type and lines)
// and every item (its item class and lines), each with its poe2db URL. Currency is left out: the entries poe2db marks
// `item_currency` (orbs, catalysts, liquid emotions and the like). Socketables (runes, soul cores, idols) stay, since a
// build sockets them. From the section's block on the homepage: the new ascendancies (the anchors whose class is a
// character class, as the homepage's Ascendancy card lists them) and passives (class `PassiveSkills`), names and URLs
// only, since their text needs a request each. Entries of one kind with one name (a unique's variants, a quest item
// that is also a map fragment) are one entry, its distinct texts its variants. A list page whose entry count isn't the
// count in its own header, or a section block that isn't there, is refused: poe2db changed its pages and the parser
// needs a fix.
//
// **In the pin.** Each name is checked against the pinned PoB2 data, `vendor/PathOfBuilding-PoE2/src`: gems against
// Data/Gems.lua, uniques against Data/Uniques/ (Special/Generated.lua's built ones too), items against Data/Bases/ and
// Data/ModRunes.lua's socketables, and ascendancies and passives against the newest tree GameVersions.lua lists
// (TreeData/<version>/tree.json), since Data/ holds no tree. Names compare without case, accents or curly quotes.
// `--pin-names <file.json>`, `{"pin": "<label>", "gem": [names], "unique": […], "item": […], "ascendancy": […],
// "passive": […]}`, replaces the pinned data, for tests.
//
// **The file** (`--out <dir>`, default data/league): its first three lines name the section and its fetch date (the
// runner prints `head -3` at a run's start); then how to read and cite it; `## Head`, one line per entry (name, kind
// and first tag, the first clause of its text, and `[not in pin]`); `## Body`, one block per entry: `### <Name>`, then
// `- Id: <id>` (its name as a slug, unique in the file), kind, tags, in pin, URL, fetch date and text. After writing it
// prints the entries added since the file's previous version.
//
// **Socketables in the head.** The body holds every socketable; the head, which every researcher reads whole, holds
// one line in their place, `- Socketables (<n>): …; Grep it by mechanic.`, then a `[rule]` line for each socketable an
// agent judged a rule changer, with why in one clause. The judgments are `<out>/<file slug>.rule-changers.json`,
// `{"ruleChangers": {"<entry id>": "<why>", …}}`, committed beside the digest and read at each write; an id that
// isn't a socketable of the digest is refused, so a re-fetch that drops one says so.
//
// **`--reflag <slug>`**, offline, for a pin upgrade: re-checks only the in-pin flags of the committed digest (each
// block's `- In pin:`, its head line's marker, the count and the pin's name and date) and prints what changed.
//
// Exit 0: written. Exit 1: refused (stderr), the digest unwritten (pages fetched so far stay saved). Exit 2: usage error.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(SCRIPT_DIR, '..', '..', '..', '..');
const POE2DB = 'https://poe2db.tw/us/';
const LISTS = ['gems', 'uniques', 'items'];
export const KINDS = ['gem', 'unique', 'item', 'ascendancy', 'passive'];
const PLURAL = { gem: 'gems', unique: 'uniques', item: 'items', ascendancy: 'ascendancies', passive: 'passives' };
const ID = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const NOT_IN_PIN = ' [not in pin]';
/** poe2db's item class for socketables: runes, soul cores and idols. */
const SOCKETABLE = 'SoulCore';
const isSocketable = (e) => e.kind === 'item' && e.tags.includes(SOCKETABLE);

class Refusal extends Error {}
class Usage extends Error {}

// ---------------------------------------------------------------------------------------------------------------
// HTML: a small tree builder, enough for poe2db's well-formed markup. Text nodes are `{text}`, elements
// `{tag, attrs, children, parent}`.

const VOID = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr']);
const RAW = new Set(['script', 'style', 'textarea', 'title']);
const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', ndash: '–', mdash: '—', hellip: '…', rsquo: '’', lsquo: '‘', ldquo: '“', rdquo: '”', times: '×', middot: '·' };

export function decodeEntities(s) {
  return s.replace(/&(#[xX][0-9a-fA-F]+|#\d+|[a-zA-Z]+);?/g, (m, e) => {
    if (e[0] === '#') {
      const cp = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isInteger(cp) && cp > 0 && cp <= 0x10ffff ? String.fromCodePoint(cp) : m;
    }
    return ENTITIES[e.toLowerCase()] ?? m;
  });
}

function parseAttrs(s) {
  const attrs = {};
  const re = /([^\s"'=<>/]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
  let m;
  while ((m = re.exec(s))) {
    const key = m[1].toLowerCase();
    if (!(key in attrs)) attrs[key] = decodeEntities(m[2] ?? m[3] ?? m[4] ?? '');
  }
  return attrs;
}

export function parseHtml(html) {
  const root = { tag: '#root', attrs: {}, children: [], parent: null };
  let cur = root;
  let lower = null;
  const text = (t) => {
    if (t) cur.children.push({ text: decodeEntities(t), parent: cur });
  };
  let i = 0;
  while (i < html.length) {
    const lt = html.indexOf('<', i);
    if (lt < 0) {
      text(html.slice(i));
      break;
    }
    text(html.slice(i, lt));
    if (html.startsWith('<!--', lt)) {
      const end = html.indexOf('-->', lt + 4);
      i = end < 0 ? html.length : end + 3;
      continue;
    }
    if (html[lt + 1] === '!' || html[lt + 1] === '?') {
      const end = html.indexOf('>', lt);
      i = end < 0 ? html.length : end + 1;
      continue;
    }
    const closing = html[lt + 1] === '/';
    const nameAt = lt + (closing ? 2 : 1);
    const name = /^[a-zA-Z][a-zA-Z0-9-]*/.exec(html.slice(nameAt, nameAt + 64));
    if (!name) {
      text('<');
      i = lt + 1;
      continue;
    }
    let j = nameAt + name[0].length;
    for (let quote = null; j < html.length; j++) {
      const c = html[j];
      if (quote) {
        if (c === quote) quote = null;
      } else if (c === '"' || c === "'") quote = c;
      else if (c === '>') break;
    }
    const inner = html.slice(nameAt + name[0].length, j);
    i = j + 1;
    const tag = name[0].toLowerCase();
    if (closing) {
      let k = cur;
      while (k !== root && k.tag !== tag) k = k.parent;
      if (k !== root) cur = k.parent;
      continue;
    }
    if ((tag === 'li' || tag === 'p' || tag === 'option') && cur.tag === tag) cur = cur.parent;
    const el = { tag, attrs: parseAttrs(inner), children: [], parent: cur };
    cur.children.push(el);
    if (VOID.has(tag)) continue;
    if (RAW.has(tag)) {
      lower ??= html.toLowerCase();
      const end = lower.indexOf(`</${tag}`, i);
      const stop = end < 0 ? html.length : end;
      const content = html.slice(i, stop);
      if (content) el.children.push({ text: tag === 'title' || tag === 'textarea' ? decodeEntities(content) : content, parent: el });
      const gt = end < 0 ? -1 : html.indexOf('>', end);
      i = gt < 0 ? html.length : gt + 1;
      continue;
    }
    cur = el;
  }
  return root;
}

const classesOf = (el) => (el.attrs?.class ?? '').split(/\s+/).filter(Boolean);
const hasClass = (el, c) => Boolean(el.tag) && classesOf(el).includes(c);
const elementsOf = (el) => el.children.filter((c) => c.tag);
function* walk(el) {
  for (const c of el.children) {
    if (c.tag) {
      yield c;
      yield* walk(c);
    }
  }
}
const findAll = (el, pred) => [...walk(el)].filter(pred);
function find(el, pred) {
  for (const c of walk(el)) if (pred(c)) return c;
  return null;
}
const clean = (s) => s.replace(/\s+/g, ' ').trim();

/** Nodes' text, a `<br>` as a line break and the source's own line breaks as spaces: images and scripts say nothing,
 * and poe2db's `secondary` span (a stat it shows untranslated, by its id and value) is marked as one. */
function rawText(nodes) {
  let out = '';
  const visit = (n) => {
    if (!n.tag) {
      out += n.text.replace(/\s+/g, ' ');
      return;
    }
    if (n.tag === 'br') out += '\n';
    else if (n.tag === 'img' || n.tag === 'script' || n.tag === 'style') return;
    else if (hasClass(n, 'secondary')) out += ` (untranslated stat: ${lineOf(n.children)}) `;
    else n.children.forEach(visit);
  };
  nodes.forEach(visit);
  return out;
}
/** Nodes' text as one line, for a name or a tag. */
const lineOf = (nodes) => clean(rawText(nodes));
/** Nodes' text as the game's lines: a `<br>` starts a new one, as in the game's own text. */
const linesIn = (nodes) =>
  rawText(nodes)
    .split('\n')
    .map(clean)
    .filter(Boolean);
const textOf = (el) => lineOf([el]);

// ---------------------------------------------------------------------------------------------------------------
// Names and ids

/** A name as an id: lowercase ASCII words joined by hyphens, apostrophes dropped. */
export const slugify = (s) =>
  s
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/['’‘`]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

/** A name as the in-pin check compares it: no case, accents or curly quotes. */
export const nameKey = (s) =>
  s
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[’‘`]/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

const pageUrl = (slug, list) => `${POE2DB}${slug}_${list}`;
const absolute = (href, base) => new URL(href, base).href;
/** A link's page name on poe2db: `/us/Runes_of_Aldur_gems`, `Runes_of_Aldur_gems` and the full URL alike. */
function hrefPage(href) {
  const page = (href ?? '').replace(/^https?:\/\/poe2db\.tw/, '').replace(/^\/us\//, '').replace(/^\//, '');
  try {
    return decodeURIComponent(page);
  } catch {
    return page;
  }
}

function localDate(d) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

// ---------------------------------------------------------------------------------------------------------------
// The homepage's section block

/** The character classes the homepage's Ascendancy card heads its lists with. */
function characterClasses(home) {
  const set = new Set();
  for (const span of findAll(home, (el) => el.tag === 'span' && hasClass(el, 'disabled'))) {
    for (const a of elementsOf(span).filter((el) => el.tag === 'a')) for (const c of classesOf(a)) set.add(c);
  }
  return set;
}

export function parseSection(html, slug) {
  const home = parseHtml(html);
  const listOf = (a) => LISTS.find((l) => hrefPage(a.attrs.href) === `${slug}_${l}`);
  const block = findAll(home, (el) => hasClass(el, 'vte')).find((vte) => findAll(vte, (el) => el.tag === 'a' && listOf(el)).length > 0);
  if (!block) throw new Refusal(`the homepage has no section block linking ${slug}_gems, ${slug}_uniques or ${slug}_items: check the slug, or poe2db changed its homepage`);
  const header = find(block, (el) => hasClass(el, 'card-header'));
  const small = header && find(header, (el) => el.tag === 'small');
  const name = header ? lineOf(header.children.filter((c) => c !== small)) : '';
  const label = small ? clean(lineOf([small]).replace(/[<>]/g, '')) : '';
  if (!name) throw new Refusal(`the ${slug} block on the homepage has no name in its header`);
  const lists = [...new Set(findAll(block, (el) => el.tag === 'a' && listOf(el)).map(listOf))];
  const classes = characterClasses(home);
  if (classes.size === 0) throw new Refusal("the homepage's Ascendancy card lists no character class: poe2db changed its homepage");
  const entries = [];
  for (const a of findAll(block, (el) => el.tag === 'a' && el.attrs.href)) {
    const cls = classesOf(a);
    const kind = cls.includes('PassiveSkills') ? 'passive' : cls.some((c) => classes.has(c)) ? 'ascendancy' : null;
    if (!kind) continue;
    const entryName = textOf(a);
    if (!entryName) throw new Refusal(`an ${kind} in the ${slug} block has no name`);
    entries.push({ kind, name: entryName, tags: [], url: absolute(a.attrs.href, POE2DB), variants: [] });
  }
  return { name, label, lists, entries };
}

// ---------------------------------------------------------------------------------------------------------------
// The list pages

/** The list's columns, checked against the count its header gives (`… Gem /57`). */
function listColumns(html, what) {
  const page = parseHtml(html);
  const card = findAll(page, (el) => hasClass(el, 'card')).find((c) => {
    const h = elementsOf(c).find((el) => hasClass(el, 'card-header'));
    return h && /\/\s*\d+\s*$/.test(textOf(h));
  });
  if (!card) throw new Refusal(`the ${what} page has no list card headed with a count`);
  const expected = Number(/\/\s*(\d+)\s*$/.exec(textOf(elementsOf(card).find((el) => hasClass(el, 'card-header'))))[1]);
  const grid = find(card, (el) => hasClass(el, 'row') && hasClass(el, 'row-cols-1'));
  const cols = grid ? elementsOf(grid).filter((el) => hasClass(el, 'col')) : [];
  if (cols.length !== expected) throw new Refusal(`the ${what} page's header counts ${expected} entries but ${cols.length} were parsed: poe2db changed its page`);
  return cols.map((col) => {
    const body = find(col, (el) => hasClass(el, 'flex-grow-1'));
    if (!body) throw new Refusal(`an entry on the ${what} page has no body`);
    return body;
  });
}

/** An entry's lines, each typed (`requires`, `property` or `mod`) so that the head's clause skips requirements and
 * properties; a stack size says nothing about the game and is left out. */
function linesOf(divs) {
  const lines = [];
  for (const div of divs) {
    if (hasClass(div, 'separator')) continue;
    const type = hasClass(div, 'requirements') ? 'requires' : hasClass(div, 'property') || hasClass(div, 'enchantMod') ? 'property' : 'mod';
    linesIn([div]).forEach((text, i) => {
      if (type === 'property' && /^Stack Size:/.test(text)) return;
      // poe2db prints some quest items' lines twice over.
      if (lines.length > 0 && lines[lines.length - 1].text === text) return;
      // `wrapped`: the line goes on from the one before, as one line of the game's that wraps.
      lines.push(i > 0 ? { type, text, wrapped: true } : { type, text });
    });
  }
  return lines;
}

function need(value, what) {
  if (!value) throw new Refusal(`${what}: poe2db changed its page`);
  return value;
}

export function parseGems(html, base) {
  return listColumns(html, 'gems').map((body) => {
    const nameDiv = elementsOf(body)[0];
    const a = need(nameDiv && find(nameDiv, (el) => el.tag === 'a' && el.attrs.href), 'a gem with no name link');
    const name = need(textOf(a), 'a gem with no name');
    const tagsDiv = elementsOf(body).find((el) => hasClass(el, 'default'));
    const tags = tagsDiv ? findAll(tagsDiv, (el) => el.tag === 'a' && hasClass(el, 'GemTags')).map(textOf).filter(Boolean) : [];
    const after = tagsDiv ? body.children.slice(body.children.indexOf(tagsDiv) + 1) : body.children.slice(body.children.indexOf(nameDiv) + 1);
    const description = linesIn(after).map((text, i) => (i > 0 ? { type: 'mod', text, wrapped: true } : { type: 'mod', text }));
    return { kind: 'gem', name, tags, url: absolute(a.attrs.href, base), variants: [description] };
  });
}

export function parseUniques(html, base) {
  return listColumns(html, 'uniques').map((body) => {
    const a = need(find(body, (el) => el.tag === 'a' && hasClass(el, 'UniqueItem')), 'a unique with no name link');
    const nameSpan = find(a, (el) => hasClass(el, 'uniqueName'));
    const typeSpan = find(a, (el) => hasClass(el, 'uniqueTypeLine'));
    const name = need(nameSpan && textOf(nameSpan), 'a unique with no name');
    const baseType = typeSpan ? textOf(typeSpan) : '';
    const divs = elementsOf(body).filter((el) => el.tag === 'div' && !find(el, (x) => x === a));
    return { kind: 'unique', name, tags: baseType ? [baseType] : [], url: absolute(a.attrs.href, base), variants: [linesOf(divs)] };
  });
}

/** The items page; currency (poe2db's `item_currency`) is counted and left out. */
export function parseItems(html, base) {
  const entries = [];
  let currency = 0;
  for (const body of listColumns(html, 'items')) {
    const a = elementsOf(body).find((el) => el.tag === 'a' && el.attrs.href);
    if (!a) {
      // An item poe2db names without a page of its own: its name only.
      entries.push({ kind: 'item', name: need(textOf(body), 'an item with no name'), tags: [], url: null, variants: [] });
      continue;
    }
    const cls = classesOf(a);
    if (cls.includes('item_currency')) {
      currency++;
      continue;
    }
    const name = need(textOf(a), 'an item with no name');
    const wrapper = elementsOf(body).find((el) => el.tag === 'div');
    const divs = wrapper ? elementsOf(wrapper).filter((el) => el.tag === 'div') : [];
    entries.push({ kind: 'item', name, tags: cls.length > 0 ? [cls[cls.length - 1]] : [], url: absolute(a.attrs.href, base), variants: [linesOf(divs)] });
  }
  return { entries, currency };
}

/** Entries of one kind with one name become one entry: tags and URLs joined, distinct non-empty texts its variants;
 * then each gets its id, its name as a slug (with its kind after it when another kind has the name). */
export function mergeEntries(entries) {
  const byKey = new Map();
  for (const e of entries) {
    const key = `${e.kind}\u0000${nameKey(e.name)}`;
    const seen = byKey.get(key);
    if (!seen) {
      byKey.set(key, { ...e, tags: [...e.tags], urls: e.url ? [e.url] : [], variants: e.variants.filter((v) => v.length > 0) });
      continue;
    }
    for (const t of e.tags) if (!seen.tags.includes(t)) seen.tags.push(t);
    if (e.url && !seen.urls.includes(e.url)) seen.urls.push(e.url);
    for (const v of e.variants) {
      if (v.length > 0 && !seen.variants.some((w) => JSON.stringify(w) === JSON.stringify(v))) seen.variants.push(v);
    }
  }
  // By kind, in KINDS's order, and in the pages' order within a kind.
  const out = [...byKey.values()].map(({ url, ...rest }) => rest).sort((a, b) => KINDS.indexOf(a.kind) - KINDS.indexOf(b.kind));
  const ids = new Set();
  for (const e of out) {
    let id = slugify(e.name);
    if (!id) throw new Refusal(`"${e.name}" makes no id`);
    if (ids.has(id)) id = `${id}-${e.kind}`;
    for (let n = 2; ids.has(id); n++) id = `${slugify(e.name)}-${e.kind}-${n}`;
    if (!ID.test(id)) throw new Refusal(`"${e.name}" makes the id "${id}", not of the form ${ID}`);
    ids.add(id);
    e.id = id;
  }
  return out;
}

// ---------------------------------------------------------------------------------------------------------------
// The pin

function luaStrings(re, text) {
  return [...text.matchAll(re)].map((m) => m[1].replace(/\\(.)/g, '$1'));
}

/** The pinned PoB2 data's names, by kind. */
export function pinFromVendor(src) {
  if (!fs.existsSync(path.join(src, 'Data', 'Gems.lua'))) throw new Refusal(`no pinned PoB2 data at ${src}: run \`mise run pob:fetch\``);
  const read = (...p) => fs.readFileSync(path.join(src, ...p), 'utf8');
  const luaFiles = (dir) =>
    fs
      .readdirSync(path.join(src, dir))
      .filter((f) => f.endsWith('.lua'))
      .sort()
      .map((f) => read(dir, f));
  const gem = luaStrings(/^\s*name = "((?:[^"\\]|\\.)*)",\s*$/gm, read('Data', 'Gems.lua'));
  const unique = [];
  for (const text of [...luaFiles(path.join('Data', 'Uniques')), ...luaFiles(path.join('Data', 'Uniques', 'Special'))]) {
    for (const m of text.matchAll(/\[\[[ \t]*\r?\n[ \t]*([^\r\n]+?)[ \t]*\r?\n/g)) unique.push(m[1]);
  }
  // Special/Generated.lua builds some uniques from tables: `local x = { "<name>", "<base>", … }`, inserted by name.
  const generated = read('Data', 'Uniques', 'Special', 'Generated.lua');
  for (const m of generated.matchAll(/table\.insert\(data\.uniques\.generated,\s*table\.concat\((\w+),/g)) {
    const def = new RegExp(`local ${m[1]}\\s*=\\s*\\{\\s*"((?:[^"\\\\]|\\\\.)*)"`).exec(generated);
    if (def) unique.push(def[1]);
  }
  const item = [];
  for (const text of luaFiles(path.join('Data', 'Bases'))) item.push(...luaStrings(/^itemBases\["((?:[^"\\]|\\.)*)"\]/gm, text));
  item.push(...luaStrings(/^\t\["((?:[^"\\]|\\.)*)"\] = \{/gm, read('Data', 'ModRunes.lua')));
  const versions = /treeVersionList\s*=\s*\{([^}]*)\}/.exec(read('GameVersions.lua'));
  const latest = versions && [...versions[1].matchAll(/"([^"]+)"/g)].map((m) => m[1]).pop();
  if (!latest) throw new Refusal("GameVersions.lua's treeVersionList names no tree");
  const tree = JSON.parse(read('TreeData', latest, 'tree.json'));
  const ascendancy = (tree.classes ?? []).flatMap((c) => (c.ascendancies ?? []).map((a) => a.name ?? a.id));
  const passive = Object.values(tree.nodes ?? {})
    .map((n) => n.name)
    .filter(Boolean);
  let label = 'the PoB2 pin';
  try {
    const pin = JSON.parse(fs.readFileSync(path.join(REPO, 'pob-pin.json'), 'utf8'));
    label = `the PoB2 pin ${pin.tag}`;
  } catch {
    // a label only
  }
  return makePin(label, { gem, unique, item, ascendancy, passive });
}

function makePin(label, lists) {
  const sets = Object.fromEntries(KINDS.map((k) => [k, new Set((lists[k] ?? []).map(nameKey))]));
  return { label, has: (kind, name) => Boolean(sets[kind]?.has(nameKey(name))) };
}

export function pinFromNames(file) {
  let json;
  try {
    json = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (e) {
    throw new Refusal(`--pin-names ${file}: ${e.message}`);
  }
  for (const k of KINDS) {
    if (json[k] !== undefined && !(Array.isArray(json[k]) && json[k].every((n) => typeof n === 'string'))) throw new Refusal(`--pin-names ${file}: "${k}" isn't a list of names`);
  }
  return makePin(typeof json.pin === 'string' && json.pin ? json.pin : path.basename(file), json);
}

// ---------------------------------------------------------------------------------------------------------------
// The digest

/** The first clause of an entry's text: its first mod or description line (with the lines it wraps onto), else its
 * first property, to the end of its first sentence, at most 16 words. */
function clauseOf(entry) {
  const lines = entry.variants[0] ?? [];
  let at = lines.findIndex((l) => l.type === 'mod');
  if (at < 0) at = lines.findIndex((l) => l.type === 'property');
  if (at < 0) return '';
  let text = lines[at].text;
  for (let i = at + 1; i < lines.length && lines[i].wrapped; i++) text += ` ${lines[i].text}`;
  const sentence = text.split(/(?<=[.!?])\s+/)[0];
  const words = sentence.split(' ');
  return words.length > 16 ? `${words.slice(0, 16).join(' ')} …` : sentence;
}

function headLine(e, why) {
  const kind = e.tags.length > 0 && e.kind !== 'ascendancy' && e.kind !== 'passive' ? `${e.kind}, ${e.tags[0]}` : e.kind;
  const clause = why ?? clauseOf(e);
  return `- ${e.name} (${kind})${why ? ' [rule]' : ''}${clause ? `: ${clause}` : ''}${e.inPin ? '' : NOT_IN_PIN}`;
}

/** The head: a line per entry, except that the socketables give way, at the first one's place, to one line naming
 * them and a `[rule]` line for each one judged a rule changer. */
function headLines(entries, ruleChangers) {
  const out = [];
  const socketables = entries.filter(isSocketable);
  for (const e of entries) {
    if (!isSocketable(e)) out.push(headLine(e));
    else if (e === socketables[0]) {
      out.push(`- Socketables (${socketables.length}): runes, soul cores and idols, in the body; Grep it by mechanic.`);
      for (const r of socketables.filter((x) => ruleChangers.has(x.id))) out.push(headLine(r, ruleChangers.get(r.id)));
    }
  }
  return out;
}

/** The judged rule changers among the socketables, `<out>/<file slug>.rule-changers.json`: id → why. */
export function readRuleChangers(file, entries) {
  if (!fs.existsSync(file)) return new Map();
  let json;
  try {
    json = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (e) {
    throw new Refusal(`${file}: ${e.message}`);
  }
  const map = json?.ruleChangers;
  if (!map || typeof map !== 'object' || Array.isArray(map)) throw new Refusal(`${file}: no "ruleChangers" object of id → why`);
  const socketables = new Set(entries.filter(isSocketable).map((e) => e.id));
  for (const [id, why] of Object.entries(map)) {
    if (!socketables.has(id)) throw new Refusal(`${file}: "${id}" isn't a socketable of this digest`);
    if (typeof why !== 'string' || !why.trim() || /\n/.test(why)) throw new Refusal(`${file}: "${id}" needs its why as one line`);
  }
  return new Map(Object.entries(map).map(([id, why]) => [id, why.trim()]));
}

function countsLine(entries) {
  const parts = KINDS.map((k) => {
    const n = entries.filter((e) => e.kind === k).length;
    return `${n} ${n === 1 ? k : PLURAL[k]}`;
  });
  const inPin = entries.filter((e) => e.inPin).length;
  return `Entries: ${parts.join(', ')}; ${inPin} of the ${entries.length} in the pin.`;
}

const pinLine = (label, date) => `In-pin flags: checked against ${label} on ${date}.`;

export function renderDigest({ slug, fileSlug, section, entries, currency, pin, checked, sources, ruleChangers = new Map() }) {
  const dates = [...new Set(entries.map((e) => e.fetched))].sort();
  const fetched = dates.length > 1 ? `${dates[0]} to ${dates[dates.length - 1]}` : dates[0] ?? checked;
  const out = [
    `# League digest: ${section.name}`,
    '',
    `${section.name}${section.label ? ` (${section.label})` : ''} on poe2db.tw, fetched ${fetched}. ${pinLine(pin.label, checked)}`,
    '',
    `What this section adds, from poe2db: the gems, uniques and items its list pages show (${sources.join(', ')}), with ` +
      `poe2db's text, which is the game's own, and the new ascendancies and passives its block on the homepage names ` +
      `(${POE2DB}), as names and URLs only. Currency is left out (${currency} ${currency === 1 ? 'entry' : 'entries'}: what poe2db marks as ` +
      'currency). Socketables (runes, soul cores and idols) are in the body; the head names only those judged to change ' +
      `a rule, marked \`[rule]\` with why (\`${fileSlug}.rule-changers.json\`). ` +
      '`[not in pin]` marks an entry the PoB pin doesn\'t know: no plan can ' +
      "compile it, so a card that rests on one can't be finalized yet. Read the head whole; Grep the body by mechanic. " +
      `Cite an entry by its id: \`data | league/${fileSlug}.md#<id>\`. Written by ` +
      `\`.claude/skills/build-guide/scripts/league-digest.mjs ${slug}\`; re-run it rather than editing by hand, and ` +
      `\`--reflag ${slug}\` after a pin upgrade.`,
    '',
    countsLine(entries),
    '',
    '## Head',
    '',
    ...headLines(entries, ruleChangers),
    '',
    '## Body',
  ];
  for (const e of entries) {
    out.push('', `### ${e.name}`, `- Id: ${e.id}`, `- Kind: ${e.kind}`);
    if (e.kind !== 'ascendancy' && e.kind !== 'passive') out.push(`- Tags: ${e.tags.length > 0 ? e.tags.join(', ') : 'none'}`);
    out.push(`- In pin: ${e.inPin ? 'yes' : 'no'}`, `- URL: ${e.urls.length > 0 ? e.urls.join(', ') : 'none'}`, `- Fetched: ${e.fetched}`);
    if (e.kind === 'ascendancy' || e.kind === 'passive') continue;
    if (e.variants.length === 0) out.push('- Text: none');
    e.variants.forEach((v, i) => {
      out.push(e.variants.length > 1 ? `- Text (variant ${i + 1} of ${e.variants.length}):` : '- Text:');
      for (const l of v) out.push(`  - ${l.text}`);
    });
  }
  return `${out.join('\n')}\n`;
}

/** A digest's blocks, as `--reflag` and the added-entries list read them. */
export function readDigest(text) {
  const lines = text.split('\n');
  const head = lines.indexOf('## Head');
  const body = lines.indexOf('## Body');
  if (head < 0 || body < head) throw new Refusal('not a league digest: no `## Head` before `## Body`');
  const heads = [];
  for (let i = head + 1; i < body; i++) if (lines[i].startsWith('- ')) heads.push(i);
  const blocks = [];
  for (let i = body + 1; i < lines.length; i++) {
    if (!lines[i].startsWith('### ')) continue;
    const block = { name: lines[i].slice(4), at: i };
    for (let j = i + 1; j < lines.length && lines[j].startsWith('- '); j++) {
      const m = /^- (Id|Kind|Tags|In pin): (.*)$/.exec(lines[j]);
      if (m && m[1] === 'Id') block.id = m[2];
      if (m && m[1] === 'Kind') block.kind = m[2];
      if (m && m[1] === 'Tags') block.tags = m[2].split(', ');
      if (m && m[1] === 'In pin') {
        block.inPin = m[2] === 'yes';
        block.pinAt = j;
      }
    }
    if (!block.id || !KINDS.includes(block.kind) || block.pinAt === undefined) throw new Refusal(`the block "${block.name}" (line ${i + 1}) lacks its Id, Kind or In pin line`);
    blocks.push(block);
  }
  // Each block's head line, `- <Name> (<kind>…`; a socketable may have none, and the one line naming the
  // socketables is no block's.
  const claimed = new Set();
  for (const b of blocks) {
    const prefix = `- ${b.name} (${b.kind}`;
    const at = heads.filter((i) => lines[i].startsWith(prefix) && /[,)]/.test(lines[i][prefix.length] ?? ''));
    if (at.length > 1) throw new Refusal(`the head has ${at.length} lines for "${b.name}"`);
    if (at.length === 0 && !isSocketable({ kind: b.kind, tags: b.tags ?? [] })) throw new Refusal(`the head has no line for "${b.name}": the head and the body are out of step`);
    if (at.length === 1) {
      b.headAt = at[0];
      claimed.add(at[0]);
    }
  }
  const stray = heads.filter((i) => !claimed.has(i) && !/^- Socketables \(\d+\): /.test(lines[i]));
  if (stray.length > 0) throw new Refusal(`head line ${stray[0] + 1} names no block of the body`);
  return { lines, blocks };
}

export function reflag(text, pin, today) {
  const { lines, blocks } = readDigest(text);
  const changed = [];
  for (const b of blocks) {
    const inPin = pin.has(b.kind, b.name);
    if (inPin !== b.inPin) changed.push({ name: b.name, kind: b.kind, inPin });
    lines[b.pinAt] = `- In pin: ${inPin ? 'yes' : 'no'}`;
    if (b.headAt !== undefined) {
      const line = lines[b.headAt];
      const bare = line.endsWith(NOT_IN_PIN) ? line.slice(0, -NOT_IN_PIN.length) : line;
      lines[b.headAt] = inPin ? bare : `${bare}${NOT_IN_PIN}`;
    }
    b.inPin = inPin;
  }
  const pinAt = lines.findIndex((l) => / In-pin flags: checked against .+ on \d{4}-\d{2}-\d{2}\.$/.test(l));
  const countAt = lines.findIndex((l) => /^Entries: .*; \d+ of the \d+ in the pin\.$/.test(l));
  if (pinAt < 0 || countAt < 0) throw new Refusal("the digest's pin line or entries line is missing");
  lines[pinAt] = lines[pinAt].replace(/In-pin flags: checked against .+ on \d{4}-\d{2}-\d{2}\.$/, pinLine(pin.label, today));
  lines[countAt] = lines[countAt].replace(/; \d+ of the (\d+) in the pin\.$/, (_, total) => `; ${blocks.filter((b) => b.inPin).length} of the ${total} in the pin.`);
  return { text: lines.join('\n'), changed, inPin: blocks.filter((b) => b.inPin).length, total: blocks.length };
}

// ---------------------------------------------------------------------------------------------------------------
// Pages: saved or fetched

function packageVersion() {
  return JSON.parse(fs.readFileSync(path.join(REPO, 'package.json'), 'utf8')).version;
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** One request at a time, at least 3 s apart, one retry after 60 s on 429 or 5xx, nothing fetched twice. */
function fetcher(userAgent) {
  const done = new Set();
  let sent = false;
  return async (url) => {
    if (done.has(url)) throw new Refusal(`${url} was already fetched`);
    done.add(url);
    for (let attempt = 1; ; attempt++) {
      if (sent) await sleep(3000);
      sent = true;
      let res;
      try {
        res = await fetch(url, { headers: { 'User-Agent': userAgent, Accept: 'text/html' }, redirect: 'follow' });
      } catch (e) {
        throw new Refusal(`${url}: ${e.message}`);
      }
      if (res.ok) return await res.text();
      if ((res.status === 429 || res.status >= 500) && attempt === 1) {
        console.error(`[league-digest] ${url}: HTTP ${res.status}; one retry after 60 s`);
        await sleep(60000);
        continue;
      }
      throw new Refusal(`${url}: HTTP ${res.status}`);
    }
  };
}

/** The pages a run reads: `{home, lists: {gems?, uniques?, items?}}`, each `{html, date}`. */
async function loadPages(slug, opts) {
  if (opts.from) {
    const read = (file) => {
      const p = path.join(opts.from, file);
      if (!fs.existsSync(p)) throw new Refusal(`${p} is missing`);
      return { html: fs.readFileSync(p, 'utf8'), date: localDate(fs.statSync(p).mtime), url: file === 'home.html' ? POE2DB : pageUrl(slug, file.slice(slug.length + 1, -5)) };
    };
    const home = read('home.html');
    const section = parseSection(home.html, slug);
    const lists = Object.fromEntries(LISTS.filter((l) => section.lists.includes(l)).map((l) => [l, read(`${slug}_${l}.html`)]));
    return { home, section, lists };
  }
  const save = opts.save ?? fs.mkdtempSync(path.join(os.tmpdir(), 'league-digest-'));
  fs.mkdirSync(save, { recursive: true });
  console.log(`league-digest: saving the pages to ${save} (re-run with --from ${save} to make no request)`);
  const get = fetcher(`pob2-mcp-server/${packageVersion()}`);
  const fetchPage = async (url, file) => {
    const html = await get(url);
    fs.writeFileSync(path.join(save, file), html);
    return { html, date: localDate(new Date()), url };
  };
  const home = await fetchPage(POE2DB, 'home.html');
  const section = parseSection(home.html, slug);
  const lists = {};
  for (const l of LISTS.filter((x) => section.lists.includes(x))) lists[l] = await fetchPage(pageUrl(slug, l), `${slug}_${l}.html`);
  return { home, section, lists };
}

// ---------------------------------------------------------------------------------------------------------------
// The command line

function parseArgs(argv) {
  const opts = { slug: null, reflag: false, from: null, save: null, out: path.join(REPO, 'data', 'league'), pinNames: null };
  const args = argv.slice(2);
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    const value = () => {
      const v = args[++i];
      if (v === undefined || v.startsWith('--')) throw new Usage(`${a} needs a value`);
      return v;
    };
    if (a === '--reflag') opts.reflag = true;
    else if (a === '--from') opts.from = value();
    else if (a === '--save') opts.save = value();
    else if (a === '--out') opts.out = value();
    else if (a === '--pin-names') opts.pinNames = value();
    else if (a.startsWith('--')) throw new Usage(`unknown option ${a}`);
    else if (opts.slug === null) opts.slug = a;
    else throw new Usage(`one slug only, not "${a}"`);
  }
  if (!opts.slug) throw new Usage('a slug is required');
  if (opts.reflag && (opts.from || opts.save)) throw new Usage('--reflag reads the committed digest: no --from or --save');
  if (!opts.reflag && !/^[A-Za-z0-9_]+$/.test(opts.slug)) throw new Usage(`"${opts.slug}" isn't a poe2db slug (letters, digits and underscores, as in Runes_of_Aldur)`);
  if (!slugify(opts.slug)) throw new Usage(`"${opts.slug}" makes no file name`);
  return opts;
}

const USAGE =
  'usage: league-digest.mjs <slug> [--from <folder>] [--save <folder>] [--out <dir>] [--pin-names <file.json>]\n' +
  '       league-digest.mjs --reflag <slug> [--out <dir>] [--pin-names <file.json>]';

async function run(opts) {
  const fileSlug = slugify(opts.slug);
  const file = path.join(opts.out, `${fileSlug}.md`);
  const pin = opts.pinNames ? pinFromNames(opts.pinNames) : pinFromVendor(path.join(REPO, 'vendor', 'PathOfBuilding-PoE2', 'src'));
  const today = localDate(new Date());
  if (opts.reflag) {
    if (!fs.existsSync(file)) throw new Refusal(`${file} is missing`);
    const r = reflag(fs.readFileSync(file, 'utf8'), pin, today);
    fs.writeFileSync(file, r.text);
    console.log(`league-digest: re-flagged ${file} against ${pin.label}: ${r.inPin} of the ${r.total} in the pin.`);
    const now = r.changed.filter((c) => c.inPin);
    const gone = r.changed.filter((c) => !c.inPin);
    if (r.changed.length === 0) console.log('No flag changed.');
    if (now.length > 0) console.log(`Now in the pin: ${now.map((c) => `${c.name} (${c.kind})`).join(', ')}.`);
    if (gone.length > 0) console.log(`No longer in the pin: ${gone.map((c) => `${c.name} (${c.kind})`).join(', ')}.`);
    return;
  }
  const { home, section, lists } = await loadPages(opts.slug, opts);
  const raw = [];
  let currency = 0;
  const parsers = { gems: (p) => parseGems(p.html, p.url), uniques: (p) => parseUniques(p.html, p.url) };
  for (const l of LISTS) {
    if (!lists[l]) continue;
    const page = lists[l];
    let found;
    if (l === 'items') {
      const r = parseItems(page.html, page.url);
      found = r.entries;
      currency = r.currency;
    } else found = parsers[l](page);
    raw.push(...found.map((e) => ({ ...e, fetched: page.date })));
  }
  raw.push(...section.entries.map((e) => ({ ...e, fetched: home.date })));
  const entries = mergeEntries(raw).map((e) => ({ ...e, inPin: pin.has(e.kind, e.name) }));
  const sources = LISTS.filter((l) => section.lists.includes(l)).map((l) => pageUrl(opts.slug, l));
  const ruleChangers = readRuleChangers(path.join(opts.out, `${fileSlug}.rule-changers.json`), entries);
  const text = renderDigest({ slug: opts.slug, fileSlug, section, entries, currency, pin, checked: today, sources, ruleChangers });
  let before = null;
  if (fs.existsSync(file)) {
    try {
      before = readDigest(fs.readFileSync(file, 'utf8'));
    } catch {
      before = null;
    }
  }
  fs.mkdirSync(opts.out, { recursive: true });
  fs.writeFileSync(file, text);
  console.log(`league-digest: wrote ${file}. ${countsLine(entries)} Currency left out: ${currency}.`);
  if (!before) {
    console.log(`Added: the first digest of ${opts.slug}, so all ${entries.length} entries are new.`);
    return;
  }
  const had = new Set(before.lines.filter((l) => l.startsWith('- Id: ')).map((l) => l.slice(6)));
  const added = entries.filter((e) => !had.has(e.id));
  console.log(added.length === 0 ? 'Added since the last digest: none.' : `Added since the last digest (${added.length}):\n${added.map((e) => `- ${e.name} (${e.kind})`).join('\n')}`);
}

export async function main(argv) {
  let opts;
  try {
    opts = parseArgs(argv);
  } catch (e) {
    if (!(e instanceof Usage)) throw e;
    console.error(`league-digest: ${e.message}\n${USAGE}`);
    return 2;
  }
  try {
    await run(opts);
    return 0;
  } catch (e) {
    if (!(e instanceof Refusal)) throw e;
    console.error(`league-digest: refused: ${e.message}`);
    return 1;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = await main(process.argv);
}
