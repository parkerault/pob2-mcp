#!/usr/bin/env node
// The rule-changer index's script (amendment 8, D-401): the candidates from the pinned data, the format and
// vocabulary check of data/rules/, and the join of what entries create against what others pay off on.
//
//   mise exec -- node .claude/skills/build-guide/scripts/rules-index.mjs candidates [--kind <k>] [--type <t>] [--json]
//   node .claude/skills/build-guide/scripts/rules-index.mjs check [<dir>] [--text <candidates.json>]
//   node .claude/skills/build-guide/scripts/rules-index.mjs join [<dir>] [--write]
//
// `candidates` boots the pinned PathOfBuilding-PoE2 checkout headless (`luajit`, from mise, with the server's
// pob-api modules on the path) and lists what an agent reads to write the index: every ascendancy notable and
// keystone of the latest tree with its lines, every unique with its mod lines (every variant's, legacy "Pre x.y"
// variants left out, as the server's unique lookup does), and every gem whose text matches a rule-change phrase
// (RULE_PHRASES), found by the server's own mechanic lookup. Gems PoB marks legacy and uniques it marks no longer
// obtainable are left out by the server's own tests (`BuildOps.is_legacy_gem`, `BuildOps.is_unobtainable_unique`,
// D-384) and named at the end. `--kind` keeps one of `nodes`, `keystones`, `uniques` or `gems`; `--type` keeps the
// uniques of one PoB item type (such as `Gloves`); `--json` prints the whole list as JSON.
//
// `check` reads `<dir>` (default data/rules/): nodes.md, uniques.md, gems.md and pairs.md, against the families of
// `<dir>/vocabulary.md`, and prints one line per problem; it exits 1 when there is one. With `--text`, a JSON file
// `candidates --json` wrote, every quoted line of a block must be one of its entry's lines in that file, verbatim.
//
// `join` pairs every entry that creates a family with every other entry that pays off on it, one line per family
// and creator, and prints pairs.md; `--write` writes it to `<dir>/pairs.md`. The join reads only entries that pass
// the check.
//
// The formats (amendment 8 §3):
//
//   nodes.md, one line per node, under `## <Ascendancy>` (keystones last, under `## Keystones`):
//     - <Name> (<id>, <Ascendancy or keystone>) — <what it does>.
//     - <Name> (<id>, <Ascendancy or keystone>) [rule] — <the rule it changes>. creates: <families> | pays off on: <families> | PoB models it: <yes|partly|no>
//
//   uniques.md and gems.md, one block per rule changer, headed by a unique's item type and level requirement or a
//   gem's kind and tier:
//     ### <Name> (<item type>, level <n>)   or   ### <Name> (<gem kind>, tier <n>)
//     - Id: <id>
//     - Rule: <the rule it changes, in a sentence>
//     - Lines: "<a line, verbatim>", "<another>"
//     - Creates: <families> | Pays off on: <families>
//     - Penalties: "<an explicit penalty line, verbatim>", … | none
//     - PoB models it: <yes | partly | no>[ — <what a compile measures>]
//
// A families field is `none` or vocabulary words, comma-separated; a rule changer no family fits is `none` in both
// (a proposal for vocabulary.md, never a new word). A unique PoB models only partly or not at all says what a compile
// measures (UNIQUE_MODEL_NOTES). No block carries a price.

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(SCRIPT_DIR, '..', '..', '..', '..');
const POB_SRC = path.join(REPO, 'vendor', 'PathOfBuilding-PoE2', 'src');
const POB_API = path.join(REPO, 'pob-api');
const DEFAULT_DIR = path.join(REPO, 'data', 'rules');

/** The phrases a gem's text must hold to be a candidate (case-insensitive), as the server's mechanic lookup matches. */
export const RULE_PHRASES = ['in place of', 'count as', 'counts as', 'instead', 'treated as', 'rather than', 'as though', 'as if', 'always', 'never', 'only', 'does not', 'do not', 'regardless', 'no longer'];

/** The one-line penalty rule at the head of uniques.md (D-401). */
export const PENALTY_RULE = 'Most uniques give up the resistances, life and defences a rare provides; a block lists only the penalties its own lines state.';

/** What a unique's `PoB models it` adds when PoB models it only partly or not at all (D-401). */
export const UNIQUE_MODEL_NOTES = {
  no: 'a compile measures what it gives up, not what it adds',
  partly: 'a compile measures only part of what it adds',
};

const ID_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const MODEL_VALUES = ['yes', 'partly', 'no'];
const NODE_RE = /^- (.+?) \((\d+), ([^()]+)\)( \[rule\])? — (.+)$/;
const NODE_TAGS_RE = /^(.+?) creates: ([^|]+?) \| pays off on: ([^|]+?) \| PoB models it: (\S+)$/;
/** A block's heading: a unique's item type and level requirement, a gem's kind and tier. */
const HEADING_RE = { 'uniques.md': /^### (.+) \(([^(),]+), level (\d+)\)$/, 'gems.md': /^### (.+) \(([^(),]+), tier (\d+)\)$/ };
const BLOCK_FIELDS = ['Id', 'Rule', 'Lines', 'Creates', 'Penalties', 'PoB models it'];
/** A price: an amount of a currency, a currency orb, or a `price:` / `priced` label (a name like Blood Price is none). */
const PRICE_RE = /\b(\d+(\.\d+)?\s*(div|divines?|ex|exalts?|exalted)\b|divine orbs?|exalted orbs?|chaos orbs?|prices?:|priced)/i;
const BLOCK_FILES = ['uniques.md', 'gems.md'];

// ------------------------------------------------------------------------------------------------------------
// The vocabulary

/** The families `vocabulary.md` defines: the backticked words before the colon of each list item under an H2. */
export function parseVocabulary(text) {
  const families = new Set();
  let inSection = false;
  let item = null;
  const flush = () => {
    if (item === null) return;
    const end = item.search(/`:\s/);
    const head = end < 0 ? '' : item.slice(0, end + 1);
    for (const m of head.matchAll(/`([^`]+)`/g)) families.add(m[1]);
    item = null;
  };
  for (const line of text.split('\n')) {
    if (line.startsWith('## ')) {
      flush();
      inSection = true;
    } else if (inSection && line.startsWith('- ')) {
      flush();
      item = line.slice(2);
    } else if (inSection && item !== null && /^\s+\S/.test(line)) {
      item += ' ' + line.trim();
    } else {
      flush();
    }
  }
  flush();
  return families;
}

// ------------------------------------------------------------------------------------------------------------
// Parsing and checking

/** A families field: `none`, or vocabulary words, comma-separated. Returns the words, or an error. */
function parseFamilies(field, vocabulary) {
  const text = field.trim();
  if (text === 'none') return { families: [] };
  const words = text.split(',').map((w) => w.trim());
  const bad = words.filter((w) => !vocabulary.has(w));
  if (words.some((w) => w === '')) return { error: `an empty family in "${text}"` };
  if (bad.length > 0) return { error: `not in the vocabulary: ${bad.join(', ')}` };
  if (new Set(words).size !== words.length) return { error: `a family named twice in "${text}"` };
  return { families: words };
}

/** Quoted lines: `"a", "b"`. Returns the lines, or null when the field isn't in that form. */
function parseQuoted(field) {
  const text = field.trim();
  if (!/^"[^"]+"(, "[^"]+")*$/.test(text)) return null;
  return [...text.matchAll(/"([^"]+)"/g)].map((m) => m[1]);
}

/** nodes.md: its sections and lines, and the problems. */
export function checkNodes(text, vocabulary, file = 'nodes.md') {
  const problems = [];
  const entries = [];
  const ids = new Set();
  const sections = [];
  let section = null;
  text.split('\n').forEach((line, i) => {
    const at = `${file}:${i + 1}`;
    if (line.startsWith('## ')) {
      section = line.slice(3).trim();
      sections.push(section);
      return;
    }
    if (!line.startsWith('- ')) {
      if (section !== null && line.trim() !== '') problems.push(`${at}: a line in a section that isn't a node line`);
      return;
    }
    if (section === null) {
      problems.push(`${at}: a node line before the first section`);
      return;
    }
    const m = NODE_RE.exec(line);
    if (!m) {
      problems.push(`${at}: not a node line ("- <Name> (<id>, <Ascendancy>)[ [rule]] — <text>")`);
      return;
    }
    const [, name, id, group, rule, rest] = m;
    if (ids.has(id)) problems.push(`${at}: node ${id} listed twice`);
    ids.add(id);
    const expected = section === 'Keystones' ? 'keystone' : section;
    if (group !== expected) problems.push(`${at}: "${group}" under section "${section}" (expected "${expected}")`);
    const tags = NODE_TAGS_RE.exec(rest);
    if (!rule) {
      if (/creates:|pays off on:|PoB models it:/.test(rest)) problems.push(`${at}: tags on a line without [rule]`);
      else if (!/\.$/.test(rest)) problems.push(`${at}: the text doesn't end with a full stop`);
      return;
    }
    if (!tags) {
      problems.push(`${at}: a [rule] line needs "<text> creates: … | pays off on: … | PoB models it: …"`);
      return;
    }
    const [, sentence, creates, paysOff, model] = tags;
    const entry = { file, id, name, group, sentence, creates: [], paysOff: [], model, at };
    if (!/\.$/.test(sentence)) problems.push(`${at}: the rule sentence doesn't end with a full stop`);
    for (const [label, field, key] of [['creates', creates, 'creates'], ['pays off on', paysOff, 'paysOff']]) {
      const parsed = parseFamilies(field, vocabulary);
      if (parsed.error) problems.push(`${at}: ${label}: ${parsed.error}`);
      else entry[key] = parsed.families;
    }
    if (!MODEL_VALUES.includes(model)) problems.push(`${at}: PoB models it: "${model}" (expected yes, partly or no)`);
    entries.push(entry);
  });
  if (sections.length === 0) problems.push(`${file}: no sections`);
  else if (sections.indexOf('Keystones') !== sections.length - 1) problems.push(`${file}: "## Keystones" must be the last section`);
  if (new Set(sections).size !== sections.length) problems.push(`${file}: a section heading repeats`);
  return { problems, entries, nodes: ids.size };
}

/** uniques.md or gems.md: its blocks, and the problems. */
export function checkBlocks(text, vocabulary, file) {
  const problems = [];
  const entries = [];
  const ids = new Set();
  const lines = text.split('\n');
  const isUniques = path.basename(file) === 'uniques.md';
  const firstBlock = lines.findIndex((l) => l.startsWith('### '));
  const head = lines.slice(0, firstBlock < 0 ? lines.length : firstBlock).join('\n');
  if (isUniques && !head.includes(PENALTY_RULE)) problems.push(`${file}: the head lacks the penalty rule ("${PENALTY_RULE}")`);
  lines.forEach((line, i) => {
    if (PRICE_RE.test(line)) problems.push(`${file}:${i + 1}: a price ("${line.match(PRICE_RE)[0]}")`);
  });
  for (let i = firstBlock < 0 ? lines.length : firstBlock; i < lines.length; i++) {
    const line = lines[i];
    if (line.trim() === '') continue;
    const at = `${file}:${i + 1}`;
    if (!line.startsWith('### ')) {
      problems.push(`${at}: a line outside a block`);
      continue;
    }
    const h = (HEADING_RE[path.basename(file)] ?? HEADING_RE['uniques.md']).exec(line);
    if (!h) problems.push(`${at}: not a block heading ("### <Name> (${isUniques ? '<item type>, level <n>' : '<gem kind>, tier <n>'})")`);
    const fields = [];
    let j = i + 1;
    while (j < lines.length && lines[j].startsWith('- ')) fields.push({ text: lines[j], n: j + 1 }), j++;
    i = j - 1;
    const entry = { file, name: h ? h[1] : line.slice(4), kind: h ? h[2] : '', level: h ? Number(h[3]) : 0, id: '', creates: [], paysOff: [], lines: [], penalties: [], model: '', at };
    const got = fields.map((f) => (f.text.match(/^- ([^:]+):/) || [])[1]);
    const wanted = BLOCK_FIELDS.map((f) => (f === 'Creates' ? 'Creates' : f));
    if (got.length !== wanted.length || got.some((g, k) => g !== wanted[k])) {
      problems.push(`${at}: the fields must be ${BLOCK_FIELDS.map((f) => (f === 'Creates' ? 'Creates … | Pays off on' : f)).join(', ')}, in that order, one line each`);
      continue;
    }
    const value = (k) => fields[k].text.slice(fields[k].text.indexOf(':') + 1).trim();
    entry.id = value(0);
    if (!ID_RE.test(entry.id)) problems.push(`${at}: id "${entry.id}" isn't lowercase words joined by hyphens`);
    else if (ids.has(entry.id)) problems.push(`${at}: id "${entry.id}" used twice`);
    ids.add(entry.id);
    const rule = value(1);
    if (rule.length < 10 || !/\.$/.test(rule)) problems.push(`${at}: the rule sentence is missing or doesn't end with a full stop`);
    entry.sentence = rule;
    const quoted = parseQuoted(value(2));
    if (!quoted) problems.push(`${at}: Lines must be quoted lines, "<a line>", "<another>"`);
    else entry.lines = quoted;
    const cp = /^(.+?) \| Pays off on: (.+)$/.exec(value(3));
    if (!cp) problems.push(`${at}: the families line must be "- Creates: … | Pays off on: …"`);
    else {
      for (const [label, field, key] of [['Creates', cp[1], 'creates'], ['Pays off on', cp[2], 'paysOff']]) {
        const parsed = parseFamilies(field, vocabulary);
        if (parsed.error) problems.push(`${at}: ${label}: ${parsed.error}`);
        else entry[key] = parsed.families;
      }
    }
    const penalties = value(4);
    if (penalties !== 'none') {
      const p = parseQuoted(penalties);
      if (!p) problems.push(`${at}: Penalties must be "none" or quoted lines`);
      else entry.penalties = p;
    }
    const model = /^(yes|partly|no)(?: — (.+))?$/.exec(value(5));
    if (!model) problems.push(`${at}: PoB models it must be yes, partly or no`);
    else {
      entry.model = model[1];
      const note = model[2];
      if (isUniques && model[1] !== 'yes' && note !== UNIQUE_MODEL_NOTES[model[1]]) {
        problems.push(`${at}: a unique PoB models ${model[1] === 'no' ? 'not at all' : 'only partly'} says so: "PoB models it: ${model[1]} — ${UNIQUE_MODEL_NOTES[model[1]]}"`);
      } else if ((!isUniques || model[1] === 'yes') && note !== undefined) {
        problems.push(`${at}: PoB models it carries a note only on a unique PoB doesn't model fully`);
      }
    }
    entries.push(entry);
  }
  return { problems, entries };
}

/** pairs.md: its blocks must be the join of the entries. */
function checkPairs(text, expected, file) {
  if (text !== expected) return [`${file}: not the join of the entries (run \`rules-index.mjs join --write\`)`];
  return [];
}

/** Every quoted line of a block is one of its entry's lines in a `candidates --json` dump, verbatim. */
export function checkText(entries, candidates) {
  const problems = [];
  const byName = new Map();
  for (const u of candidates.uniques ?? []) byName.set(`uniques.md|${u.name}`, u.lines.map((l) => l.line));
  for (const g of candidates.gems ?? []) byName.set(`gems.md|${g.name}`, g.lines.map((l) => l.line));
  for (const e of entries) {
    if (!BLOCK_FILES.includes(path.basename(e.file))) continue;
    const known = byName.get(`${path.basename(e.file)}|${e.name}`);
    if (!known) {
      problems.push(`${e.at}: "${e.name}" isn't a candidate`);
      continue;
    }
    for (const l of [...e.lines, ...e.penalties]) {
      if (!known.some((k) => k === l)) problems.push(`${e.at}: "${l}" isn't one of ${e.name}'s lines`);
    }
  }
  return problems;
}

/** Every file of the index: its entries and its problems. */
export function checkIndex(dir) {
  const problems = [];
  const vocabFile = path.join(dir, 'vocabulary.md');
  if (!fs.existsSync(vocabFile)) return { problems: [`${vocabFile}: missing`], entries: [] };
  const vocabulary = parseVocabulary(fs.readFileSync(vocabFile, 'utf8'));
  const entries = [];
  const nodesFile = path.join(dir, 'nodes.md');
  if (!fs.existsSync(nodesFile)) problems.push('nodes.md: missing');
  else {
    const r = checkNodes(fs.readFileSync(nodesFile, 'utf8'), vocabulary);
    problems.push(...r.problems);
    entries.push(...r.entries);
  }
  for (const f of BLOCK_FILES) {
    const file = path.join(dir, f);
    if (!fs.existsSync(file)) {
      problems.push(`${f}: missing`);
      continue;
    }
    const r = checkBlocks(fs.readFileSync(file, 'utf8'), vocabulary, f);
    problems.push(...r.problems);
    entries.push(...r.entries);
  }
  const pairsFile = path.join(dir, 'pairs.md');
  if (problems.length === 0) {
    if (!fs.existsSync(pairsFile)) problems.push('pairs.md: missing');
    else problems.push(...checkPairs(fs.readFileSync(pairsFile, 'utf8'), joinPairs(entries), 'pairs.md'));
  }
  return { problems, entries };
}

// ------------------------------------------------------------------------------------------------------------
// The join

const PAIRS_HEAD = [
  '# Pairs: what one entry creates against what another pays off on',
  '',
  'Written by `.claude/skills/build-guide/scripts/rules-index.mjs join --write` from `nodes.md` (its `[rule]` lines),',
  '`uniques.md` and `gems.md`; never edit it by hand. One block per family of `vocabulary.md` that some entry creates',
  'and another pays off on. Each line names the family, an entry that creates it, and the entries that pay off on it;',
  'Grep for the family. A pair is a lead, not a proof: confirm the link with a lookup before a card relies on it.',
  '',
].join('\n');

function ref(e) {
  return `${e.name} (rules/${path.basename(e.file)}#${e.id})`;
}

/** pairs.md's text from the checked entries. */
export function joinPairs(entries) {
  const families = new Map();
  for (const e of entries) {
    for (const f of e.creates) (families.get(f) ?? families.set(f, { creates: [], pays: [] }).get(f)).creates.push(e);
    for (const f of e.paysOff) (families.get(f) ?? families.set(f, { creates: [], pays: [] }).get(f)).pays.push(e);
  }
  const order = (a, b) => a.name.localeCompare(b.name, 'en') || ref(a).localeCompare(ref(b), 'en');
  const blocks = [];
  for (const family of [...families.keys()].sort()) {
    const { creates, pays } = families.get(family);
    const rows = [];
    for (const c of [...creates].sort(order)) {
      const payers = pays.filter((p) => p !== c).sort(order);
      if (payers.length > 0) rows.push(`- ${family}: ${ref(c)} → ${payers.map(ref).join(', ')}`);
    }
    if (rows.length > 0) blocks.push([`### ${family}`, `- Id: ${family}`, ...rows].join('\n'));
  }
  return PAIRS_HEAD + (blocks.length > 0 ? '\n' + blocks.join('\n\n') + '\n' : '');
}

// ------------------------------------------------------------------------------------------------------------
// The candidates (the pinned PoB, booted headless)

const DRIVER = String.raw`
local apiDir, outPath, phrasesCsv = arg[1], arg[2], arg[3]
_G.POB_SCRIPT_DIR = apiDir
package.path = apiDir .. '/?.lua;' .. apiDir .. '/?/init.lua;' .. package.path
do
  local err = io.stderr
  print = function(...)
    local parts = {}
    for i = 1, select('#', ...) do parts[i] = tostring((select(i, ...))) end
    err:write(table.concat(parts, '\t') .. '\n')
  end
end
if type(_G.utf8) ~= 'table' then
  local ok, mod = pcall(require, 'utf8')
  if ok and type(mod) == 'table' then _G.utf8 = mod
  else
    local ok2, stub = pcall(dofile, apiDir .. '/utf8.lua')
    if ok2 and type(stub) == 'table' then _G.utf8 = stub end
  end
end
dofile('HeadlessWrapper.lua')
if _G.main then main.disableDevAutoSave = true end
if not _G.build and mainObject and mainObject.main and mainObject.main.modes then _G.build = mainObject.main.modes['BUILD'] end
if not (build and build.spec) then
  mainObject.main:SetMode('BUILD', false, 'rules-index')
  runCallback('OnFrame')
  build = mainObject.main.modes['BUILD']
end

local BuildOps = require('API.BuildOps')
local Lookup = require('API.Lookup')
local json = require('dkjson')
local out = { nodes = {}, ascendancies = {}, uniques = {}, gems = {}, legacyGems = {}, unobtainableUniques = {} }

local function oneLine(s) return (tostring(s):gsub('%s*\n%s*', ' ')) end

-- The tree: every ascendancy notable and keystone, the ascendancies in class order (as BuildOps.get_classes
-- lists them).
local tree = build.spec.tree
local classIds = {}
for classId, class in pairs(tree.classes or {}) do
  if type(class) == 'table' and class.name then table.insert(classIds, classId) end
end
table.sort(classIds)
for _, classId in ipairs(classIds) do
  local class = tree.classes[classId]
  local ascIds = {}
  for ascId, asc in pairs(class.classes or {}) do
    if ascId ~= 0 and type(asc) == 'table' and asc.name and asc.name ~= 'None' then table.insert(ascIds, ascId) end
  end
  table.sort(ascIds)
  for _, ascId in ipairs(ascIds) do
    table.insert(out.ascendancies, { name = class.classes[ascId].name, class = class.name })
  end
end
for id, node in pairs(tree.nodes) do
  local keystone = node.type == 'Keystone' or node.isKeystone == true
  local notable = node.type == 'Notable' or node.isNotable == true
  if (node.ascendancyName and notable and not node.isAscendancyStart) or (keystone and not node.ascendancyName) then
    local lines = {}
    for _, l in ipairs(node.sd or {}) do table.insert(lines, oneLine(l)) end
    -- A multiple-choice notable has no lines of its own: its options' lines, one option a line.
    if node.isMultipleChoice then
      local options = {}
      local specNode = build.spec.nodes and build.spec.nodes[id] or node
      for _, other in ipairs(specNode.linked or {}) do
        if other.isMultipleChoiceOption then
          local sd = {}
          for _, l in ipairs(other.sd or {}) do table.insert(sd, oneLine(l)) end
          table.insert(options, { id = other.id, line = 'Option ' .. (other.dn or other.name) .. ': ' .. table.concat(sd, ' / ') })
        end
      end
      table.sort(options, function(a, b) return a.id < b.id end)
      for _, o in ipairs(options) do table.insert(lines, o.line) end
    end
    table.insert(out.nodes, { id = tonumber(id) or id, name = node.dn or node.name, ascendancy = node.ascendancyName,
      keystone = keystone or nil, choice = node.isMultipleChoice or nil, lines = lines })
  end
end

-- Uniques: every variant's mod lines, a line only legacy variants have left out (as API/Lookup.lua's
-- uniqueModLines reads them); one PoB marks no longer obtainable is named, not listed (D-384).
local LISTS = { 'enchantModLines', 'runeModLines', 'implicitModLines', 'explicitModLines', 'classRequirementModLines' }
local function legacyVariant(name)
  return type(name) == 'string' and (name:find('^Pre %d') ~= nil or name:find('%(Pre %d') ~= nil)
end
for key, item in pairs(main.uniqueDB.list) do
  local name = item.title or item.name or key
  if BuildOps.is_unobtainable_unique(item) then
    table.insert(out.unobtainableUniques, name)
  else
    local lines = {}
    for _, list in ipairs(LISTS) do
      for _, modLine in ipairs(item[list] or {}) do
        if type(modLine.line) == 'string' then
          local entry = { line = oneLine(modLine.line) }
          if modLine.variantList and not Lookup.lineIsSelected(item, modLine) then
            local names = {}
            for index in pairs(modLine.variantList) do
              local v = type(item.variantList) == 'table' and item.variantList[index] or nil
              if not legacyVariant(v) then table.insert(names, v or ('#' .. index)) end
            end
            table.sort(names)
            entry.variants = names
          end
          if not entry.variants or #entry.variants > 0 then table.insert(lines, entry) end
        end
      end
    end
    local level = item.requirements and item.requirements.level or 0
    table.insert(out.uniques, { name = name, type = item.type, base = item.baseName, level = level, lines = lines,
      raw = item:BuildRaw() })
  end
end

-- Gems: the ones the server's mechanic lookup finds for a phrase, legacy ones left out by it and named.
local hitsByGem = {}
for phrase in phrasesCsv:gmatch('[^|]+') do
  local r = Lookup.handlers.lookup_game_data({ mode = 'mechanic', kind = 'gem', query = phrase, maxResults = 100000 })
  if not r.ok then error(r.error) end
  for _, hit in ipairs(r.result.results or {}) do
    local h = hitsByGem[hit.id] or { phrases = {}, matched = {} }
    hitsByGem[hit.id] = h
    h.phrases[phrase] = true
    h.matched[hit.line] = true
  end
end
for id, gem in pairs(data.gems) do
  if type(gem) == 'table' and gem.grantedEffect and BuildOps.is_legacy_gem(gem) then table.insert(out.legacyGems, gem.name) end
end
for id, h in pairs(hitsByGem) do
  local gem = data.gems[id]
  local ge = gem.grantedEffect
  local lines = {}
  if ge.description then table.insert(lines, { line = oneLine(ge.description), source = 'description' }) end
  local level = Lookup.defaultLevel(gem)
  for e, effect in ipairs(Lookup.gemEffects(gem)) do
    for i, statSet in ipairs(effect.statSets or {}) do
      for _, l in ipairs(Lookup.describeStatSet(effect, statSet, level, 0)) do
        table.insert(lines, { line = l, source = string.format('effect %d, stat set %d', e, i) })
      end
    end
  end
  local seen = {}
  for _, l in ipairs(lines) do seen[l.line] = true end
  for l in pairs(h.matched) do if not seen[l] then table.insert(lines, { line = l, source = 'quality' }) end end
  local phrases = {}
  for p in pairs(h.phrases) do table.insert(phrases, p) end
  table.sort(phrases)
  local req = ge.levels and ge.levels[1] and ge.levels[1].levelRequirement or 0
  local types = {}
  for t, on in pairs(ge.skillTypes or {}) do if on then types[#types + 1] = tostring(t) end end
  table.sort(types)
  table.insert(out.gems, { id = id, name = gem.name, gemType = gem.gemType, support = ge.support == true,
    tags = gem.tagString, tier = gem.Tier, level = req, phrases = phrases, lines = lines })
end

table.sort(out.nodes, function(a, b) return a.id < b.id end)
table.sort(out.uniques, function(a, b) return a.name < b.name end)
table.sort(out.gems, function(a, b) return a.name < b.name end)
table.sort(out.legacyGems)
table.sort(out.unobtainableUniques)
local f = assert(io.open(outPath, 'w'))
f:write(json.encode(out))
f:close()
os.exit(0)
`;

/** Boots the pinned PoB headless and returns the candidates' raw dump. */
function dumpPinned() {
  if (!fs.existsSync(path.join(POB_SRC, 'HeadlessWrapper.lua'))) {
    throw new Error(`the pinned PoB isn't fetched (${POB_SRC}); run \`mise run pob:fetch\``);
  }
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'rules-index-'));
  try {
    const driver = path.join(tmp, 'driver.lua');
    const outPath = path.join(tmp, 'dump.json');
    fs.writeFileSync(driver, DRIVER);
    const runtime = path.join(POB_SRC, '..', 'runtime');
    const env = {
      ...process.env,
      LUA_PATH: `${POB_API}/?.lua;${POB_API}/?/init.lua;${runtime}/lua/?.lua;${runtime}/lua/?/init.lua;;`,
      LUA_CPATH: `${runtime}/?.so;${path.join(os.homedir(), '.luarocks', 'lib', 'lua', '5.1')}/?.so;;`,
    };
    for (const k of ['POESESSID', 'POE_SESSION_ID']) delete env[k];
    const r = spawnSync('luajit', [driver, POB_API, outPath, RULE_PHRASES.join('|')], {
      cwd: POB_SRC, env, encoding: 'utf8', timeout: 300000, maxBuffer: 64 * 1024 * 1024, input: '',
    });
    if (r.error) throw new Error(r.error.code === 'ENOENT' ? 'luajit not found: run under `mise exec --`' : r.error.message);
    if (r.status !== 0 || !fs.existsSync(outPath)) throw new Error(`the PoB dump failed (exit ${r.status}):\n${(r.stderr || '').split('\n').slice(-15).join('\n')}`);
    return JSON.parse(fs.readFileSync(outPath, 'utf8'));
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

/** The dump, shaped: nodes by ascendancy in class order, then keystones; uniques by type; gems by name. */
export function shapeCandidates(dump) {
  const asc = new Map();
  for (const a of dump.ascendancies ?? []) if (!asc.has(a.name)) asc.set(a.name, a.class);
  const order = [...asc.keys()];
  const arr = (v) => (Array.isArray(v) ? v : []);
  const nodes = arr(dump.nodes).filter((n) => !n.keystone).map((n) => ({ ...n, lines: arr(n.lines) }));
  nodes.sort((a, b) => (order.indexOf(a.ascendancy) - order.indexOf(b.ascendancy)) || a.name.localeCompare(b.name, 'en'));
  const keystones = arr(dump.nodes).filter((n) => n.keystone).map((n) => ({ ...n, lines: arr(n.lines) }));
  keystones.sort((a, b) => a.name.localeCompare(b.name, 'en'));
  const uniques = arr(dump.uniques).map((u) => ({ ...u, lines: arr(u.lines) }));
  uniques.sort((a, b) => a.type.localeCompare(b.type, 'en') || a.name.localeCompare(b.name, 'en'));
  const gems = arr(dump.gems).map((g) => ({ ...g, lines: arr(g.lines), phrases: arr(g.phrases) }));
  return {
    ascendancies: order.filter((a) => nodes.some((n) => n.ascendancy === a)),
    nodes, keystones, uniques, gems,
    legacyGems: arr(dump.legacyGems), unobtainableUniques: arr(dump.unobtainableUniques),
  };
}

function printCandidates(c, kind, type) {
  const out = [];
  if (!kind || kind === 'nodes') {
    for (const a of c.ascendancies) {
      out.push(`## ${a}`);
      for (const n of c.nodes.filter((x) => x.ascendancy === a)) out.push(`- ${n.name} (${n.id})${n.choice ? ' [choice]' : ''}: ${n.lines.join(' | ')}`);
      out.push('');
    }
  }
  if (!kind || kind === 'keystones') {
    out.push('## Keystones');
    for (const n of c.keystones) out.push(`- ${n.name} (${n.id}): ${n.lines.join(' | ')}`);
    out.push('');
  }
  if (!kind || kind === 'uniques') {
    const list = c.uniques.filter((u) => !type || u.type.toLowerCase() === type.toLowerCase());
    for (const u of list) {
      out.push(`- ${u.name} (${u.type}, ${u.base}, level ${u.level})`);
      for (const l of u.lines) out.push(`    ${l.line}${l.variants ? `  [variants: ${l.variants.join(', ')}]` : ''}`);
    }
    out.push('');
  }
  if (!kind || kind === 'gems') {
    for (const g of c.gems) {
      out.push(`- ${g.name} (${g.support ? 'support' : g.gemType}, level ${g.level}; ${g.tags}) matches: ${g.phrases.join(', ')}`);
      for (const l of g.lines) out.push(`    ${l.line}`);
    }
    out.push('');
  }
  if (!kind) {
    out.push(`Left out (D-384): legacy gems: ${c.legacyGems.join(', ') || 'none'}.`);
    out.push(`Left out (D-384): uniques no longer obtainable: ${c.unobtainableUniques.join(', ') || 'none'}.`);
    out.push(`Counts: ${c.ascendancies.length} ascendancies, ${c.nodes.length} notables, ${c.keystones.length} keystones, ${c.uniques.length} uniques, ${c.gems.length} gems.`);
  }
  process.stdout.write(out.join('\n') + '\n');
}

// ------------------------------------------------------------------------------------------------------------
// The command line

function option(args, name) {
  const i = args.indexOf(name);
  if (i < 0) return undefined;
  const v = args[i + 1];
  args.splice(i, 2);
  return v;
}

function flag(args, name) {
  const i = args.indexOf(name);
  if (i < 0) return false;
  args.splice(i, 1);
  return true;
}

function usage(message) {
  process.stderr.write(`rules-index: ${message}\nusage: rules-index.mjs candidates [--kind nodes|keystones|uniques|gems] [--type <item type>] [--json]\n       rules-index.mjs check [<dir>] [--text <candidates.json>]\n       rules-index.mjs join [<dir>] [--write]\n`);
  process.exit(2);
}

function main(argv) {
  const args = [...argv];
  const command = args.shift();
  if (command === 'candidates') {
    const kind = option(args, '--kind');
    const type = option(args, '--type');
    const json = flag(args, '--json');
    if (args.length > 0) usage(`unexpected arguments: ${args.join(' ')}`);
    if (kind && !['nodes', 'keystones', 'uniques', 'gems'].includes(kind)) usage(`unknown --kind "${kind}"`);
    const c = shapeCandidates(dumpPinned());
    if (json) process.stdout.write(JSON.stringify(c, null, 1) + '\n');
    else printCandidates(c, kind, type);
    return 0;
  }
  if (command === 'check') {
    const text = option(args, '--text');
    if (args.length > 1) usage(`unexpected arguments: ${args.slice(1).join(' ')}`);
    const dir = path.resolve(args[0] ?? DEFAULT_DIR);
    const { problems, entries } = checkIndex(dir);
    if (text) problems.push(...checkText(entries, JSON.parse(fs.readFileSync(text, 'utf8'))));
    for (const p of problems) process.stdout.write(`${p}\n`);
    if (problems.length > 0) {
      process.stdout.write(`rules-index check: ${problems.length} problem(s)\n`);
      return 1;
    }
    const count = (f) => entries.filter((e) => path.basename(e.file) === f).length;
    process.stdout.write(`rules-index check: ok (${count('nodes.md')} [rule] nodes, ${count('uniques.md')} uniques, ${count('gems.md')} gems)\n`);
    return 0;
  }
  if (command === 'join') {
    const write = flag(args, '--write');
    if (args.length > 1) usage(`unexpected arguments: ${args.slice(1).join(' ')}`);
    const dir = path.resolve(args[0] ?? DEFAULT_DIR);
    const { problems, entries } = checkIndex(dir);
    const blocking = problems.filter((p) => !p.startsWith('pairs.md:'));
    if (blocking.length > 0) {
      for (const p of blocking) process.stderr.write(`${p}\n`);
      process.stderr.write(`rules-index join: the entries fail the check (${blocking.length} problem(s)); nothing joined\n`);
      return 1;
    }
    const text = joinPairs(entries);
    if (write) {
      fs.writeFileSync(path.join(dir, 'pairs.md'), text);
      const pairs = text.split('\n').filter((l) => l.startsWith('- ') && !l.startsWith('- Id:')).length;
      process.stdout.write(`rules-index join: wrote pairs.md (${pairs} lines)\n`);
    } else process.stdout.write(text);
    return 0;
  }
  usage(command ? `unknown command "${command}"` : 'a command is needed');
  return 2;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    process.exitCode = main(process.argv.slice(2));
  } catch (error) {
    process.stderr.write(`rules-index: ${error.message}\n`);
    process.exitCode = 1;
  }
}
