#!/usr/bin/env node
// The build-guide run checker (slice 03 FR-W7, as amendments 1 to 3 change it).
//
//   node .claude/skills/build-guide/scripts/check-run.mjs <runFolder>
//
// It checks what the run folder holds, whatever the run's status; once a guide exists, every guide check
// applies. It checks the artifacts rather than self-reports:
//  - the layout (slice 03 §2): the cards `cards/<id>.md`, the deck `cards.md` and the probe variants
//    `probes/<card-id>/<n>/` among it (D-338), each card's probes at most 4 (D-292); the deck's rounds of 6–9
//    dealt cards with at least two under-played ones, or the short round's reason (D-287, D-339); the source
//    markers (§7.3), the dossier's and the guide's sections (§7.2, §8);
//  - amendment 2's guards on the reader layer (D-276, D-283): the 3,000-word cap, the 14 H2s, no marker,
//    confidence label or finding id in guide.md, one fixed-form verdict line per endgame rung compared with the
//    record (its Effective HP against `TotalEHP`, D-294), reward picks by name, Known issues by sentence with
//    their ids in audit.md, whose six H2s it checks too (§7.8, D-278); and the entering-maps rung's floor and
//    5-divine budget (D-281);
//  - the final record against the plan (`planSha1`, or after claims-only edits its `buildSha1`, computed with
//    the server's compiled projection, D-264, D-266), its PoB file (the decoded import code, one tree set per
//    plan stage) and its ledger (re-evaluated with the server's own compiled evaluator);
//  - the D1 gate, recomputed from the plan and the record: the floor, the budget, and the named damage source
//    (the part `rolledSkill`, D-295) with its figure's stat set, each figure read × its Count where the record
//    has a counted copy (D-340);
//  - every V4 finding open after the re-check listed under the guide's `Known issues`, and every campaign
//    reward choice the campaign passes picked in the plan and named in the guide (D-265);
//  - the run log (schema version 3, D-289; schema 2 only so recorded runs still check, D-326) and the control
//    flow it records, which stands in for the workflow harness tests amendment 1 deleted: steps in a legal
//    order, each gate's answer followed (the brainstorm, verification and final gates, D-287), the caps per
//    brainstorm and verification round, the retry caps (S6 honoured; an R1b `not-a-skill` failure is terminal,
//    D-334), one full V4 pass and at most one re-check per cycle, escalations only from the gates, and the rule
//    on every pre-supplied or default answer.
//
// Node built-ins only, plus the server's compiled ledger module `build/plan/ledger.js` (its imports are
// type-only, so it loads alone; amendment 1 §6 relaxes FR-W7's built-ins rule for it) and its build projection
// `build/plan/buildHash.js` (D-266; it imports only crypto). No network.
//
// Exit 0: every check passed (one line on stdout). Exit 1: each violation on stderr as
// `check-run: [<rule>] <message>`. Exit 2: usage error.
//
// The shapes it reads are documented in ../references/ (run-folder.md, run-log.md, gates.md,
// source-markers.md, pricing.md); keep them in step with this file.

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath, pathToFileURL } from 'node:url';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
/** The repository root: .claude/skills/build-guide/scripts -> the root. */
const REPO = path.resolve(SCRIPT_DIR, '..', '..', '..', '..');
/** The repo's C1/E1 data (C-35). */
const DATA_DIR = path.join(REPO, 'data');
/** The server's compiled ledger evaluator (C-33), the one `compile_plan` fills the record with. */
const LEDGER_MODULE = path.join(REPO, 'build', 'plan', 'ledger.js');
/** D-266: the server's compiled build projection, the one the compiler writes the record's `buildSha1` with. */
const BUILD_HASH_MODULE = path.join(REPO, 'build', 'plan', 'buildHash.js');

// ---------------------------------------------------------------------------------------------------
// Contracts (slice 03 and amendment 1; spine C-30, C-31, C-33, D-219, D-234)
// ---------------------------------------------------------------------------------------------------

/** §8, the reader layer (D-276): the guide's 14 H2s, in order. */
export const GUIDE_H2 = [
  'At a glance',
  'Your PoB file',
  'Survival by stage',
  'Gem and ascendancy timing',
  'Priorities',
  'Leveling',
  'Campaign route and rewards',
  'Endgame: entering maps',
  'Endgame: budget',
  'Endgame: non-budget',
  'How to play it',
  "What PoB can't show",
  'FAQ',
  'Changelog',
];
/** §7.8, the audit layer (D-278): audit.md's H2s, in order. */
export const AUDIT_H2 = ['Hand calculations', 'Stage detail', "What PoB doesn't model", 'Inputs by confidence', 'Run notes', 'Known issues'];
/** §7.2: the dossier's H2s, in order. */
export const DOSSIER_H2 = ['Roll and mode', 'Mechanics', 'Synergy search', 'Config gaps', 'Concepts', 'Not carried'];
/** The endgame ladder's rungs in order (D-281, D-282): `m`, `b`, `n`. */
const RUNGS = ['entering-maps', 'budget', 'non-budget'];
/** Each rung's guide H2, which holds the H3 `Checks` (§8). */
const VARIANT_H2 = { 'entering-maps': 'Endgame: entering maps', budget: 'Endgame: budget', 'non-budget': 'Endgame: non-budget' };
/** Each rung's label in its verdict line (D-283). */
const VARIANT_LABEL = { 'entering-maps': 'Entering maps', budget: 'Budget', 'non-budget': 'Non-budget' };
/** The H2 whose first fenced block is the import code, and which says when the run was offline (§8). */
const PRIMER_H2 = 'Your PoB file';
/** The H2 that holds one fixed-form verdict line per endgame rung (D-283). */
const SURVIVAL_H2 = 'Survival by stage';
/** The H2 that names every campaign reward pick (D-265 c, D-283). */
const REWARDS_H2 = 'Campaign route and rewards';
/** The H2 that ends with the H3 `Known issues` (D-276). */
const SHOW_H2 = "What PoB can't show";
/** The one heading for accepted gate findings and the open V4 findings: an H3 in the guide, an H2 in audit.md. */
const KNOWN_ISSUES = 'Known issues';
/** D-283: the guide's word cap, not counting the H1, the import code or the Known issues list. */
const WORD_CAP = 3000;
/** D-276, D-283: what marks pipeline text in the reader layer: a footnote marker, a confidence label, a V4 finding id. */
const CONFIDENCE_LABEL = /\b[Cc]onfidence\s*:?\s*[HML]\b/;
const FINDING_ID = /\bv4-(?:ledger|sources|prose)-\d+\b/;

const SOURCE_KINDS = ['pob-computed', 'pob-data', 'external', 'judgment', 'external-unavailable'];
const EXTERNAL_UNAVAILABLE_REF = 'external source unavailable (offline run)';
const NEEDS_CONFIDENCE = ['external', 'judgment', 'external-unavailable'];
const OFFLINE_NOTE = 'offline run';

/** `TradeErrorKind` (src/trade/errors.ts), the `<kind>` of a `[trade:<kind>]` error prefix (D-218). */
const TRADE_KINDS = [
  'no_session', 'session_rejected', 'too_complex', 'invalid_query', 'rate_limited', 'locked_out',
  'would_wait', 'auth', 'http', 'network', 'timeout', 'disabled',
];
/** A `priceOutcomes` key: `ok`, `error` (no prefix) or a trade kind. */
const PRICE_OUTCOMES = ['ok', 'error', ...TRADE_KINDS];
/** The steps that price (pricing.md): R1b, D1, the D1 gate's re-price pass and D2. */
const PRICING_STAGES = ['R1b', 'D1', 'D1-gate', 'D2'];

/** D-326: the run-log schema versions the checker reads: 3 (D-289), and 2 only so recorded runs still check. */
const SCHEMA_VERSIONS = [2, 3];
/** The run log's fields: schema 2 (amendment 1 §4.1, D-270); schema 3 adds the parsed brief (D-289, C-51). */
const RUN_LOG_FIELDS = {
  2: ['schemaVersion', 'runFolder', 'slug', 'roll', 'status', 'mode', 'testConfig', 'stages', 'checkpoints', 'escalations', 'faults', 'outputs'],
  3: ['schemaVersion', 'runFolder', 'slug', 'brief', 'roll', 'status', 'mode', 'testConfig', 'stages', 'checkpoints', 'escalations', 'faults', 'outputs'],
};
/** C-51, D-285, D-335: the brief's fields, every one optional. */
const BRIEF_FIELDS = ['ascendancy', 'skill', 'playstyle', 'budget', 'around', 'like', 'notes', 'popularity'];
/** C-51: the playstyle vocabulary (delivery, buttons, focus, defence, pace), which cards use too. */
const PLAYSTYLE_TAGS = ['melee', 'ranged-attack', 'spell', 'minion', 'totem-trap', 'mixed', 'one-button', 'few-buttons', 'combo', 'clear', 'boss', 'balanced', 'tanky', 'glass', 'fast', 'steady'];
/** Schema 3's gates and questions (D-287, D-289); schema 2 named the pick and the guide checkpoints 1 and 2. */
const CHECKPOINTS = { 2: [1, 2, 'unsaved-build', 'escalation'], 3: ['brainstorm', 'verification', 'final', 'unsaved-build', 'escalation'] };
const LENSES = ['ledger', 'sources', 'prose'];
const STATUSES = ['running', 'completed', 'not-accepted', 'stopped', 'escalated'];
/** An escalation's choices (D-236): schema 3 goes back to the verification gate, schema 2 to checkpoint 1 (D-289). */
const CHOICES = { 2: ['accept', 'retry', 'checkpoint-1', 'stop'], 3: ['accept', 'retry', 'verification', 'stop'] };
/** A schema-2 concept id (`c1`), and a schema-3 card id `r<round>-<researcher letter>-<n>` (`r1-a-2`, D-319). */
const CONCEPT_ID = 'c[1-9]\\d*';
const CARD_ID = 'r[1-9]\\d*-[a-c]-[1-9]\\d*';
/** The id form a run's steps, folders and files use: the card id in schema 3, the concept id in schema 2. */
const idSource = (schema) => (schema === 2 ? CONCEPT_ID : schema === 3 ? CARD_ID : `(?:${CONCEPT_ID}|${CARD_ID})`);
const idForm = (schema) => (schema === 2 ? 'the concept id c<n>' : 'the card id r<round>-<letter>-<n>');
/** D-292: a card's probe variants, beyond R1b's two compiles. */
const PROBE_CAP = 4;
/** D-287, D-339: a brainstorm round deals 6–9 cards, and the deck keeps at least two under-played ones. */
const DEAL = { min: 6, max: 9, underPlayed: 2 };
const UNDER_PLAYED = /under-played \(judgment\b/i;
const OWNERS = ['W1', 'D1', 'D2'];
/** §7.4: V4 checks the plan and the guide, and the prose lens reads "why this concept" in audit.md (D-279). */
const ARTIFACTS = ['plan.json', 'guide.md', 'audit.md'];
const PARTS = ['pass', 'fail', 'unverified'];
const GATE_STAGES = ['R1b', 'D1-gate', 'D2-gate'];
const GATE_PARTS = { R1b: ['compiled'], 'D1-gate': ['compiled', 'v1', 'v2', 'floor', 'budget', 'rolledSkill'], 'D2-gate': ['compiled', 'v1', 'v2'] };
/**
 * D-264: a fix-round (or revision) owner, D1 or D2, that edited claims in place and compiled nothing. No gate
 * follows it, the final record stays the last D2 gate's, and the re-check stays targeted.
 */
const CLAIMS_EDITED = 'claims-edited';
/** Each `stages[]` stage and the outcomes its entries may have (run-log.md); every step may miss its file. */
const STAGE_OUTCOMES = {
  R1a: ['done'],
  'R1a-assemble': ['done'],
  R1b: ['pass', 'fail'],
  'R1b-assemble': ['done'],
  D1: ['done', 'infeasible', CLAIMS_EDITED],
  'D1-gate': ['pass', 'fail', 'infeasible', 'escalated'],
  D2: ['done', CLAIMS_EDITED],
  'D2-gate': ['pass', 'fail', 'escalated'],
  W1: ['done'],
  ...Object.fromEntries(LENSES.flatMap((l) => [[`V4-${l}`, ['pass', 'fail']], [`V4-${l}-recheck`, ['pass', 'fail']]])),
};
const OUTCOMES = ['pass', 'fail', 'done', 'infeasible', 'escalated', 'missing', CLAIMS_EDITED];
/**
 * D-265 (a): the steps that write each V4-checked artifact (the runner's step-14 edit adds only `Known issues`
 * lines, which hold no claim or marker).
 */
const ARTIFACT_WRITERS = { 'plan.json': ['D1', 'D1-gate', 'D2'], 'guide.md': ['W1'], 'audit.md': ['W1'] };
/** The steps that write plan.json or compile it: after one of them, an earlier guide is out of date. */
const DESIGN_STAGES = ['D1', 'D1-gate', 'D2', 'D2-gate'];
/** The steps that concern no one concept or card. */
const ROUND_STAGES = ['R1a', 'R1a-assemble', 'R1b-assemble'];
/** Retries (SKILL.md "Retries, in full"; Q2): R1b makes at most 3 counted attempts; a gate allows 2 counted retries. */
const R1B_ATTEMPTS = 3;
const GATE_RETRIES = 2;
/**
 * NFR-23: R1a researchers per brainstorm round, and cards compiled per verification round (D-287); in a
 * schema-2 log, researchers and carried concepts per research round (D-235).
 */
const ROUND_CAP = 3;
/** offline-and-test.md: the step each fault directive targets. */
const FAULT_STAGE = { 'FI-1': 'R1b', 'FI-2': 'D1-gate', 'FI-3': 'D1-gate' };

const ELEMENTS = ['Fire', 'Cold', 'Lightning'];
const HIT_OPTION = /^enemy(Physical|Fire|Cold|Lightning|Chaos)Damage$/;
/**
 * D-254: every endgame stage holds a waystone-scaled reference hit of each type, each derived by a ledger
 * entry. D-256: PoB takes these options as whole numbers, so the scenario value is the ledger value rounded
 * to 2 decimals (which absorbs float32 noise in the inputs), then rounded up.
 */
const HIT_TYPES = ['Physical', 'Fire', 'Cold', 'Lightning', 'Chaos'];
/** Findings that report on a passing part (../references/gates.md): never failures. */
const INFO_CODES = ['chaos-exception', 'near-ceiling'];

/**
 * The gated budgets: D-219's budget variant (at most 20 divines passes; above 20 up to 22 passes with a "near the
 * ceiling" note; above 22 fails) and D-281's entering-maps rung (5, and 5.5 with the note). The non-budget
 * variant is reported against its reference, never gated.
 */
const BUDGETS = { budget: { ceiling: 20, tolerance: 22, why: 'D-219' }, 'entering-maps': { ceiling: 5, tolerance: 5.5, why: 'D-281' } };
const NEAR_CEILING = 'near the ceiling';

// ---------------------------------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------------------------------

const isObj = (v) => typeof v === 'object' && v !== null && !Array.isArray(v);
const isInt = (v, min = 0) => Number.isInteger(v) && v >= min;
const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const show = (v) => JSON.stringify(v);
const round2 = (x) => Math.round(x * 100) / 100;
const sha1 = (bytes) => crypto.createHash('sha1').update(bytes).digest('hex');
/** D-256: the scenario value of a reference hit whose ledger entry has `value`. */
export const hitCeiling = (value) => Math.ceil(round2(value));
/** Whether `word` occurs in `text` as a whole token (not inside a longer word), case-insensitively. */
const hasWord = (text, word) =>
  typeof word === 'string' && word !== '' && new RegExp(`(?<![A-Za-z0-9_-])${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![A-Za-z0-9_-])`, 'i').test(text);
const norm = (s) => String(s).replace(/[−–]/g, '-').replace(/\s+/g, ' ').trim().toLowerCase();
/** Whitespace collapsed and one closing period dropped: how a reader sentence and its Known issues line compare. */
const collapse = (s) => String(s).replace(/\s+/g, ' ').trim().replace(/\.$/, '');
const list = (v) => (Array.isArray(v) ? v.filter(isObj) : []);

/**
 * D-283: whether a number written in the guide ("2,740", "about 400", "438.55") matches `value`: the written
 * number equals the value rounded at the written number's own last significant digit, so "2,740" matches 2,736
 * and "400" matches 401.996. A whole number's last significant digit is its last non-zero one (0 rounds to units);
 * a decimal's is its last decimal place.
 */
export function matchesWritten(written, value) {
  const text = String(written).replace(/,/g, '').replace(/[−–]/g, '-');
  if (!/^-?\d+(\.\d+)?$/.test(text) || !isNum(value)) return false;
  const n = Number(text);
  const decimals = (text.split('.')[1] ?? '').length;
  let unit = 10 ** -decimals;
  if (decimals === 0 && n !== 0) {
    const zeros = /0*$/.exec(text.replace(/^-/, ''))[0].length;
    unit = 10 ** zeros;
  }
  const rounded = Math.sign(value) * Math.round(Math.abs(value) / unit) * unit;
  return Math.abs(rounded - n) < unit * 1e-6;
}

/**
 * D-283: the guide's words, not counting the H1, the import code or the Known issues list. A word is a run of
 * non-space characters that holds a letter or a digit, so table rules, list bullets and emphasis marks don't count.
 */
export function countWords(lines, skip = () => false) {
  let words = 0;
  lines.forEach((line, i) => {
    if (!skip(i)) words += line.split(/\s+/).filter((t) => /[\p{L}\p{N}]/u.test(t)).length;
  });
  return words;
}

/** §2's slug form: lower case, each run of characters outside [a-z0-9] one `-`, trimmed of `-`. */
const slugify = (text) => String(text).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

/** A schema-2 run's slug, from its roll: `<ascendancy>-<skill>` (§2 as built). */
export function slugOf(ascendancy, skill) {
  return slugify(`${ascendancy}-${skill}`);
}

/**
 * A schema-3 run's slug, from its brief (D-285, run-folder.md): `<ascendancy>-<skill>`; `<ascendancy>-open`;
 * `open-<skill>`; with neither, `open-<first playstyle tag>`, or `open` for a brief with no tag.
 */
export function slugOfBrief(brief) {
  const b = isObj(brief) ? brief : {};
  const named = (v) => (typeof v === 'string' && v.trim() !== '' ? v : null);
  const [ascendancy, skill] = [named(b.ascendancy), named(b.skill)];
  const tag = Array.isArray(b.playstyle) ? b.playstyle.find((t) => typeof t === 'string' && PLAYSTYLE_TAGS.includes(t.trim().toLowerCase())) : undefined;
  if (ascendancy && skill) return slugify(`${ascendancy}-${skill}`);
  if (ascendancy) return slugify(`${ascendancy}-open`);
  if (skill) return slugify(`open-${skill}`);
  return tag ? slugify(`open-${tag}`) : 'open';
}

/** A card id without its hyphens, then `e`: its skeleton's one stage (`r1a2e` for `r1-a-2`; `c1e` for `c1`). */
const skeletonStage = (id) => `${String(id).replace(/-/g, '')}e`;

/**
 * D-340: a compared figure `g<group>s<skill>p<statSet>.<Field>` of a stage's record, read × its group's Count
 * from `countedSkillOutputs` where the record has a counted copy of the field, else raw from `skillOutputs`
 * (the per-copy value; a record from before WU-55 has no counted copies).
 */
function figureOf(stageRecord, figure) {
  const m = /^(g\d+s\d+p\d+)\.(\w+)$/.exec(String(figure ?? ''));
  if (!m || !isObj(stageRecord)) return { value: undefined, counted: false };
  const counted = stageRecord.countedSkillOutputs?.[m[1]]?.fields?.[m[2]];
  if (isNum(counted)) return { value: counted, counted: true, count: stageRecord.countedSkillOutputs[m[1]].count };
  return { value: stageRecord.skillOutputs?.[m[1]]?.fields?.[m[2]], counted: false };
}

/** A PoB import code's XML bytes (C-42): base64url of zlib-deflated XML, as `src/utils/buildCode.ts` decodes it. */
export function decodeImportCode(code) {
  const b64 = String(code).trim().replace(/\s+/g, '').replace(/-/g, '+').replace(/_/g, '/');
  return zlib.inflateSync(Buffer.from(b64, 'base64'), { maxOutputLength: 64 * 1024 * 1024 });
}

const XML_ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };
const unescapeXml = (s) => s.replace(/&(amp|lt|gt|quot|apos);/g, (_, e) => XML_ENTITIES[e]);
/** The titles of a PoB XML's tree sets (`<Spec title="…">`), in file order. */
export function specTitles(xml) {
  return [...xml.matchAll(/<Spec\b[^>]*?\stitle="([^"]*)"/g)].map((m) => unescapeXml(m[1]));
}

// ---------------------------------------------------------------------------------------------------
// Markdown
// ---------------------------------------------------------------------------------------------------

/** Headings, fenced blocks, footnote definitions and markers of a markdown text (fences excluded). */
export function parseMarkdown(text) {
  const lines = text.split(/\r?\n/);
  const headings = [];
  const fences = [];
  const definitions = [];
  const markers = [];
  let fence = null;
  lines.forEach((line, i) => {
    const f = /^\s*(```|~~~)(.*)$/.exec(line);
    if (f) {
      if (fence === null) fence = { start: i, info: f[2].trim(), lines: [] };
      else {
        fences.push({ ...fence, end: i, content: fence.lines.join('\n') });
        fence = null;
      }
      return;
    }
    if (fence !== null) {
      fence.lines.push(line);
      return;
    }
    const h = /^(#{1,6})\s+(.*?)\s*#*\s*$/.exec(line);
    if (h) {
      headings.push({ level: h[1].length, title: h[2].trim(), line: i });
      return;
    }
    const d = /^\[\^([^\]\s]+)\]:\s*(.*)$/.exec(line);
    if (d) {
      definitions.push({ id: d[1], body: d[2], line: i });
      return;
    }
    for (const m of line.matchAll(/\[\^([^\]\s]+)\]/g)) markers.push({ id: m[1], line: i });
  });
  const h2 = headings.filter((h) => h.level === 2);
  /** The H2 a line sits under, or null. */
  const h2Of = (line) => {
    let title = null;
    for (const h of h2) if (h.line <= line) title = h.title;
    return title;
  };
  /** The lines of the section a heading opens, up to the next heading of its level or higher. */
  const sectionOf = (heading) => {
    const next = headings.find((h) => h.line > heading.line && h.level <= heading.level);
    return { start: heading.line, end: next ? next.line : lines.length };
  };
  return { lines, headings, h2, fences, definitions, markers, h2Of, sectionOf };
}

function sectionText(md, heading) {
  const { start, end } = md.sectionOf(heading);
  return md.lines.slice(start + 1, end).join('\n');
}

function h2Named(md, title) {
  return md.h2.find((h) => h.title === title) ?? null;
}

/** The H3s under an H2, in order. */
function h3sUnder(md, h2) {
  const { start, end } = md.sectionOf(h2);
  return md.headings.filter((h) => h.level === 3 && h.line > start && h.line < end);
}

/** A definition line's body (§7.3): `<kind> | <ref> [| accessed: …] [| patch: …] [| confidence: …]`, or a citation. */
export function parseDefinition(body) {
  const parts = body.split('|').map((s) => s.trim());
  const kind = parts[0];
  if (kind === 'ledger' || kind === 'price') {
    if (parts.length !== 2 || parts[1] === '') return { error: `a ${kind} definition is "${kind} | <id>"` };
    return { kind, id: parts[1] };
  }
  if (kind === 'data') {
    const m = parts.length === 2 ? /^([^#\s]+)#(\S+)$/.exec(parts[1]) : null;
    if (!m) return { error: 'a data definition is "data | <file>#<key>"' };
    return { kind, file: m[1], key: m[2] };
  }
  if (!SOURCE_KINDS.includes(kind)) {
    return { error: `kind "${kind}" isn't one of ${[...SOURCE_KINDS, 'ledger', 'data', 'price'].join(', ')}` };
  }
  const tag = { kind, ref: parts[1] ?? '' };
  for (const extra of parts.slice(2)) {
    const m = /^(accessed|patch|confidence):\s*(.+)$/.exec(extra);
    if (!m) return { error: `"${extra}" isn't accessed:, patch: or confidence:` };
    tag[m[1]] = m[2].trim();
  }
  return { kind, tag };
}

// ---------------------------------------------------------------------------------------------------
// C1/E1 facts (C-35), as src/plan/referenceData.ts resolves them
// ---------------------------------------------------------------------------------------------------

const dataFiles = new Map();
/** A C1/E1 fact's value (`<file>` relative to data/), or undefined. */
function factValue(file, id) {
  resolveFact(file, id);
  const data = dataFiles.get(file);
  return isObj(data) && isObj(data.facts) && isObj(data.facts[id]) ? data.facts[id].value : undefined;
}
/**
 * D-254, D-281, D-327: a rung's area level: T5 (`area-level.offset` + 5) for the entering-maps rung, T15
 * (`area-level.offset` + 15) for the budget variant, `area-level.max` for the non-budget variant.
 */
function areaLevelOf(variant) {
  const tier = { 'entering-maps': 5, budget: 15 }[variant];
  const v = factValue('enemies/waystones.json', tier !== undefined ? 'area-level.offset' : 'area-level.max');
  return isNum(v) ? (tier !== undefined ? v + tier : v) : undefined;
}
function resolveFact(file, key) {
  if (!dataFiles.has(file)) {
    let parsed = null;
    try {
      const abs = path.resolve(DATA_DIR, file);
      if (abs.startsWith(DATA_DIR + path.sep)) parsed = JSON.parse(fs.readFileSync(abs, 'utf8'));
    } catch {
      parsed = null;
    }
    dataFiles.set(file, parsed);
  }
  const data = dataFiles.get(file);
  if (!isObj(data) || !isObj(data.facts)) return `no data file "${file}" under data/`;
  const m = /^([a-z0-9]+(?:[.-][a-z0-9]+)*)(?:\[([^\][]+)\])?$/.exec(key);
  if (!m) return `"${key}" isn't a fact id, optionally followed by [<member>]`;
  const fact = Object.prototype.hasOwnProperty.call(data.facts, m[1]) ? data.facts[m[1]] : undefined;
  if (fact === undefined) return `${file} has no fact "${m[1]}"`;
  if (m[2] === undefined) return null;
  const v = fact.value;
  const ok = Array.isArray(v) ? /^(0|[1-9]\d*)$/.test(m[2]) && Number(m[2]) < v.length : isObj(v) && Object.prototype.hasOwnProperty.call(v, m[2]);
  return ok ? null : `${file}#${m[1]} has no member [${m[2]}]`;
}

/** The server's ledger evaluator, or null when the server isn't built. */
/** The server's build projection (`buildSha1`), or null when the server isn't built. */
async function loadBuildHashModule() {
  if (!fs.existsSync(BUILD_HASH_MODULE)) return null;
  const mod = await import(pathToFileURL(BUILD_HASH_MODULE).href);
  return typeof mod.buildSha1 === 'function' ? mod : null;
}

async function loadLedgerModule() {
  if (!fs.existsSync(LEDGER_MODULE)) return null;
  const mod = await import(pathToFileURL(LEDGER_MODULE).href);
  return typeof mod.evaluateLedger === 'function' ? mod : null;
}

// ---------------------------------------------------------------------------------------------------
// The checker
// ---------------------------------------------------------------------------------------------------

export async function checkRun(runFolder) {
  const violations = [];
  const fail = (rule, message) => violations.push({ rule, message });
  const abs = (rel) => path.join(runFolder, ...rel.split('/'));
  const exists = (rel) => fs.existsSync(abs(rel));
  const isDir = (rel) => exists(rel) && fs.statSync(abs(rel)).isDirectory();
  const listDir = (rel) => (isDir(rel) ? fs.readdirSync(abs(rel)).sort() : []);
  const readText = (rel) => (exists(rel) && !isDir(rel) ? fs.readFileSync(abs(rel), 'utf8') : null);
  const readJson = (rel, rule = 'layout') => {
    const text = readText(rel);
    if (text === null) return null;
    try {
      return JSON.parse(text);
    } catch (e) {
      fail(rule, `${rel} isn't valid JSON: ${e.message}`);
      return null;
    }
  };

  if (!fs.existsSync(runFolder) || !fs.statSync(runFolder).isDirectory()) {
    fail('layout', `${runFolder} is not a folder`);
    return violations;
  }

  // ---- The run log (amendment 1 §4.1) and the control flow it records -------------------------------
  const log = readJson('run-log.json', 'run-log');
  if (!isObj(log)) {
    if (!exists('run-log.json')) fail('layout', 'run-log.json is missing; every run writes it from the start (FR-W2)');
    return violations;
  }
  // D-326: a schema-2 log is a run recorded before amendment 3, checked by its own rules; any other version is
  // checked as schema 3, the current one (a log of neither version fails checkRunLog).
  const schema = SCHEMA_VERSIONS.includes(log.schemaVersion) ? log.schemaVersion : null;
  const v3 = schema !== 2;
  const ID = new RegExp(`^${idSource(schema)}$`);
  checkRunLog(log, fail, schema);
  const mode = log.mode;
  const offline = mode === 'offline';
  const completed = log.status === 'completed';
  const stages = list(log.stages);
  const escalations = list(log.escalations);
  const runDir = typeof log.runFolder === 'string' ? log.runFolder.replace(/\\/g, '/').replace(/\/+$/, '') : '';
  const runName = runDir.split('/').slice(-2).join('-'); // <slug>-<YYYY-MM-DD>-<n>: the PoB file's build_name (§2)
  const runDate = (/(\d{4}-\d{2}-\d{2})-\d+$/.exec(runDir) ?? [])[1] ?? null;

  // ---- Layout (§2; the cards, the deck and the probes since amendment 3, D-338) ----------------------
  const KNOWN_TOP = ['run-log.json', 'research', 'cards', 'cards.md', 'concepts', 'probes', 'dossier.md', 'plan.json', 'compile-record.json', 'compiled-build.xml', 'guide.md', 'audit.md', 'reports'];
  for (const name of fs.readdirSync(runFolder)) {
    if (!KNOWN_TOP.includes(name)) fail('layout', `${name} isn't part of the run-folder layout (§2); agents write only the files §2 names`);
  }
  for (const [name, dir] of [['cards', true], ['cards.md', false], ['probes', true]]) {
    if (exists(name) && isDir(name) !== dir) fail('layout', `${name} is a ${dir ? 'file' : 'folder'}; §2 names ${dir ? `the folder ${name}/` : `the file ${name}`}`);
  }
  // C-52, D-319: R1a writes each card at cards/<id>.md, and R1b its verification half; nothing else goes there.
  const cardIds = new Set();
  for (const f of listDir('cards')) {
    const m = new RegExp(`^(${CARD_ID})\\.md$`).exec(f);
    if (!m || isDir(`cards/${f}`)) fail('layout', `cards/${f} isn't a card file cards/<id>.md, the id r<round>-<letter>-<n> (§2, D-319)`);
    else cardIds.add(m[1]);
  }
  if (completed) {
    for (const rel of ['plan.json', 'compile-record.json', 'dossier.md', 'guide.md', 'audit.md']) {
      if (!exists(rel)) fail('layout', `${rel} is missing; a completed run has plan.json, compile-record.json, dossier.md, guide.md and audit.md (§2)`);
    }
  }
  const researchFiles = listDir('research');
  for (const f of researchFiles) {
    if (!/^p[1-9]\d*-r1a-[1-9]\d*\.md$/.test(f)) fail('layout', `research/${f} isn't named p<round>-r1a-<n>.md (§2)`);
  }

  // A measure-only plan folder (a skeleton or a probe): its plan, and the record and XML compile_plan writes beside it.
  const PLAN_FILES = ['plan.json', 'compile-record.json', 'compiled-build.xml'];
  const measureOnlyFolder = (rel, what) => {
    for (const f of listDir(rel)) if (!PLAN_FILES.includes(f)) fail('layout', `${rel}/${f} isn't part of the layout (§2)`);
    const rec = readJson(`${rel}/compile-record.json`);
    if (rec === null) return;
    // D-208: it compiles measure-only; its record names the XML beside it.
    const named = isObj(rec.pobFile) ? String(rec.pobFile.path ?? '') : '';
    if (rec.mode !== 'measure-only' || rec.pobFile?.location !== 'run') {
      fail('layout', `${rel}/compile-record.json is a ${show(rec.mode)} compile; ${what} compile measure-only (D-208)`);
    } else if (!named.endsWith(`${rel}/${path.posix.basename(named)}`) || !exists(`${rel}/${path.posix.basename(named)}`)) {
      fail('layout', `${rel}/compile-record.json names ${show(named)}, which isn't the compiled XML beside it (D-208)`);
    }
  };

  // Plans: the run's own, the skeletons and the probes; prices and ledger ids resolve across the first two.
  const plan = readJson('plan.json');
  const conceptPlans = new Map();
  for (const id of listDir('concepts')) {
    if (!ID.test(id) || !isDir(`concepts/${id}`)) {
      fail('layout', `concepts/${id} isn't a skeleton folder named by ${idForm(schema)} (§2)`);
      continue;
    }
    if (!exists(`concepts/${id}/plan.json`)) fail('layout', `concepts/${id}/plan.json is missing; R1b writes the ${v3 ? "card's" : "concept's"} skeleton plan there (§2)`);
    const p = readJson(`concepts/${id}/plan.json`);
    if (p !== null) conceptPlans.set(id, p);
    measureOnlyFolder(`concepts/${id}`, 'skeletons');
  }
  // D-331, D-338: a card's probe variants, probes/<card-id>/<n>/ with n from 1 in run order, each a one-stage
  // plan with the measure-only record and XML beside it; at most 4 per card (D-292).
  const probePlans = new Map();
  const probeCounts = new Map();
  for (const id of listDir('probes')) {
    if (!new RegExp(`^${CARD_ID}$`).test(id) || !isDir(`probes/${id}`)) {
      fail('layout', `probes/${id} isn't a card's probe folder probes/<card-id>/, the id r<round>-<letter>-<n> (§2, D-331)`);
      continue;
    }
    const ns = [];
    for (const n of listDir(`probes/${id}`)) {
      if (!/^[1-9]\d*$/.test(n) || !isDir(`probes/${id}/${n}`)) {
        fail('layout', `probes/${id}/${n} isn't a probe variant folder probes/${id}/<n>/, n from 1 (§2, D-331)`);
        continue;
      }
      ns.push(Number(n));
      if (!exists(`probes/${id}/${n}/plan.json`)) fail('layout', `probes/${id}/${n}/plan.json is missing; R1b writes each probe's one-stage plan there (§7.7, D-338)`);
      const p = readJson(`probes/${id}/${n}/plan.json`);
      if (p !== null) probePlans.set(`${id}/${n}`, p);
      measureOnlyFolder(`probes/${id}/${n}`, 'probe variants');
    }
    ns.sort((a, b) => a - b);
    if (ns.some((n, k) => n !== k + 1)) fail('layout', `probes/${id}/ holds variants ${ns.join(', ')}; they are numbered from 1 in run order, with no gap (§7.7)`);
    if (ns.length > PROBE_CAP) fail('probes', `probes/${id}/ holds ${ns.length} probe variants; a card has at most ${PROBE_CAP} (D-292)`);
    probeCounts.set(id, ns.length);
  }
  const allPlans = [...(isObj(plan) ? [plan] : []), ...[...conceptPlans.values()].filter(isObj)];
  const ledgerIds = new Set(allPlans.flatMap((p) => (Array.isArray(p.ledger) ? p.ledger.map((e) => e?.id) : [])));
  const priceIds = new Set(allPlans.flatMap((p) => (Array.isArray(p.prices) ? p.prices.map((e) => e?.id) : [])));
  const record = readJson('compile-record.json');
  if (isObj(record) && record.mode === 'measure-only' && !exists('compiled-build.xml')) {
    fail('layout', "compile-record.json is a measure-only record, but compiled-build.xml isn't beside it (D-208)");
  }
  const finalRecord = isObj(record) && record.mode === 'final' ? record : null;
  const planStages = isObj(plan) && Array.isArray(plan.stages) ? plan.stages.filter(isObj) : [];
  const endgame = planStages.filter((s) => s.variant !== undefined);
  const campaign = planStages.filter((s) => s.variant === undefined);
  // Which artifacts are current, from the log (the runner can't delete files): the guide is current when no
  // design step ran after the last W1 (a revision, a fix round that escalated, or another concept's design
  // leaves an older guide behind), and the final record is current when no producer ran after the last D2 gate.
  const lastAt = (pred) => stages.reduce((at, s, i) => (pred(s) ? i : at), -1);
  const lastW1 = lastAt((s) => s.stage === 'W1' && s.outcome !== 'missing');
  const lastDesign = lastAt((s) => DESIGN_STAGES.includes(s.stage));
  const guideText0 = readText('guide.md');
  const guideCurrent = guideText0 !== null && (lastW1 < 0 || lastW1 > lastDesign);
  const guideText = guideCurrent ? guideText0 : null;
  if (guideText0 !== null && !guideCurrent && completed) {
    fail('layout', `status is "completed", but guide.md is from ${describe(stages[lastW1])}, and design steps ran after it; a completed run ends with a current guide`);
  }
  // A claims-only owner (D-264) compiles nothing, so it leaves the final record current.
  const lastFinalGate = lastAt((s) => s.stage === 'D2-gate' && s.outcome !== 'missing');
  const recordCurrent = finalRecord !== null && !(lastAt((s) => (s.stage === 'D1' || s.stage === 'D2') && s.outcome !== CLAIMS_EDITED) > lastFinalGate);
  /** The claims-only owner entries after the last D2 gate, whose edits the final record predates. */
  const claimsOnlyAfterFinal = stages.slice(lastFinalGate + 1).filter((s) => (s.stage === 'D1' || s.stage === 'D2') && s.outcome === CLAIMS_EDITED);
  if (guideText !== null && isObj(record) && !finalRecord) {
    fail('layout', `guide.md exists, but compile-record.json is a ${show(record.mode)} record; W1 writes the guide from the final compile's record (§5.3)`);
  }

  // ---- Outputs and the final record (§2, §4.1 outputs) --------------------------------------------
  if (completed && isObj(log.outputs)) {
    const o = log.outputs;
    for (const k of ['plan', 'record', 'dossier', 'guide']) {
      if (typeof o[k] !== 'string' || !exists(o[k])) fail('run-log', `outputs.${k} is ${show(o[k])}, which names no file in the run folder`);
    }
    if (finalRecord && o.pobFile !== finalRecord.pobFile?.path) fail('run-log', `outputs.pobFile is ${show(o.pobFile)}; the record's PoB file is ${show(finalRecord.pobFile?.path)}`);
  }
  if (finalRecord) {
    const pob = isObj(finalRecord.pobFile) ? finalRecord.pobFile : {};
    const base = path.posix.basename(String(pob.path ?? '')).replace(/\.xml$/i, '');
    if (pob.location !== 'builds' || base !== runName) {
      fail('layout', `the final compile wrote ${show(pob.path)}; its build_name is "${runName}", the run folder's last two segments joined (§2)`);
    }
    const compiled = Array.isArray(finalRecord.stagesCompiled) ? finalRecord.stagesCompiled : [];
    if (recordCurrent) for (const s of planStages) if (!compiled.includes(s.id)) fail('layout', `the final record didn't compile stage ${show(s.id)}`);
  }

  // ---- Offline mode (§11.1, D-233; AC-W2 k) -----------------------------------------------------
  if (offline) {
    const labelled = [['plan.json', plan], ...[...conceptPlans].map(([id, cp]) => [`concepts/${id}/plan.json`, cp]), ...[...probePlans].map(([at, pp]) => [`probes/${at}/plan.json`, pp])];
    for (const [label, p] of labelled) {
      if (!isObj(p)) continue;
      if (p.league !== null) fail('offline-prices', `${label}: league is ${show(p.league)}; offline, the plan's league is null (D-233)`);
      for (const pr of Array.isArray(p.prices) ? p.prices : []) {
        if (!isObj(pr)) continue;
        if (pr.status !== 'unavailable' || pr.note !== OFFLINE_NOTE || pr.league !== null) {
          fail('offline-prices', `${label}: price ${show(pr.id)} is ${show(pr.status)} (note ${show(pr.note)}); offline, every price is unavailable with note "${OFFLINE_NOTE}" and league null (§11.1)`);
        } else if (runDate && pr.date !== runDate) {
          fail('offline-prices', `${label}: price ${show(pr.id)} is dated ${show(pr.date)}; offline prices are dated the run folder's date ${runDate} (D-164)`);
        }
      }
    }
  }

  // ---- Source tags and markers (§7.3, C-30; AC-W2 d, e, f, g) -------------------------------------
  const checkTag = (where, tag) => {
    if (!isObj(tag) || typeof tag.kind !== 'string') return fail('source-tags', `${where}: not a source tag`);
    if (!SOURCE_KINDS.includes(tag.kind)) return fail('source-tags', `${where}: kind ${show(tag.kind)} isn't one of ${SOURCE_KINDS.join(', ')}`);
    if (typeof tag.ref !== 'string' || tag.ref.trim() === '') fail('source-tags', `${where}: a ${tag.kind} tag needs a ref`);
    if (tag.kind === 'external') {
      if (!/^https?:\/\//.test(tag.ref ?? '')) fail('source-tags', `${where}: an external tag's ref is a URL; got ${show(tag.ref)}`);
      if (tag.accessed === undefined) fail('source-tags', `${where}: an external tag has no accessed date (C-30)`);
    }
    if (tag.accessed !== undefined && !(typeof tag.accessed === 'string' && ISO_DATE.test(tag.accessed))) {
      fail('source-tags', `${where}: accessed ${show(tag.accessed)} isn't YYYY-MM-DD`);
    }
    if (NEEDS_CONFIDENCE.includes(tag.kind) && tag.confidence === undefined) {
      fail('source-tags', `${where}: a ${tag.kind} tag has no confidence (C-30: required for external, judgment and external-unavailable)`);
    }
    if (tag.confidence !== undefined && !['H', 'M', 'L'].includes(tag.confidence)) fail('source-tags', `${where}: confidence ${show(tag.confidence)} isn't H, M or L`);
    if (tag.kind === 'external-unavailable') {
      if (tag.ref !== EXTERNAL_UNAVAILABLE_REF) fail('source-tags', `${where}: an external-unavailable tag's ref is exactly "${EXTERNAL_UNAVAILABLE_REF}"`);
      if (!offline) fail('offline-tag', `${where}: an external-unavailable tag in a ${show(mode)} run; it is allowed only offline (C-30, D-201)`);
    }
  };
  const checkCitation = (where, cite, scope) => {
    if (cite.kind === 'ledger' && !scope.ledger.has(cite.id)) fail('markers', `${where}: ledger ${show(cite.id)} names no ledger entry`);
    if (cite.kind === 'price' && !scope.prices.has(cite.id)) fail('markers', `${where}: price ${show(cite.id)} names no prices[] entry (D-237)`);
    if (cite.kind === 'data') {
      const why = resolveFact(cite.file, cite.key);
      if (why !== null) fail('markers', `${where}: data ${cite.file}#${cite.key} names no C1/E1 fact (D-232): ${why}`);
    }
  };
  const planScope = (p) => ({
    ledger: new Set(isObj(p) && Array.isArray(p.ledger) ? p.ledger.map((e) => e?.id) : []),
    prices: new Set(isObj(p) && Array.isArray(p.prices) ? p.prices.map((e) => e?.id) : []),
  });
  const runScope = { ledger: ledgerIds, prices: priceIds };

  /** Claims of a plan: one per stages[].claims[] entry, with its kind and location. */
  const planClaims = (p, label) => {
    const out = [];
    if (!isObj(p) || !Array.isArray(p.stages)) return out;
    const scope = planScope(p);
    p.stages.filter(isObj).forEach((s, i) => {
      (Array.isArray(s.claims) ? s.claims : []).forEach((c, k) => {
        const where = `${label} stages[${i}].claims[${k}]`;
        if (!isObj(c)) return;
        if (typeof c.source === 'string') {
          const m = /^(?:(ledger|price):(\S+)|data:([^#\s]+)#(\S+))$/.exec(c.source);
          if (!m) return fail('source-tags', `${where}: source ${show(c.source)} is neither a tag nor ledger:, price: or data:`);
          const cite = m[1] ? { kind: m[1], id: m[2] } : { kind: 'data', file: m[3], key: m[4] };
          checkCitation(where, cite, scope);
          out.push({ kind: cite.kind, at: `stages[${i}].claims[${k}]` });
        } else {
          checkTag(where, c.source);
          out.push({ kind: c.source?.kind, at: `stages[${i}].claims[${k}]` });
        }
      });
    });
    return out;
  };

  /** Claims of a markdown artifact: one per definition line. */
  const markdownClaims = (md, label, scope) => {
    const out = [];
    const seen = new Map();
    const lastHeading = md.headings.length > 0 ? md.headings[md.headings.length - 1].line : -1;
    for (const d of md.definitions) {
      if (seen.has(d.id)) fail('markers', `${label}:${d.line + 1}: [^${d.id}] is defined twice (also line ${seen.get(d.id) + 1}); each id has one definition`);
      seen.set(d.id, d.line);
      if (d.line < lastHeading) fail('markers', `${label}:${d.line + 1}: the definition of [^${d.id}] isn't under the file's last heading (§7.3)`);
      const parsed = parseDefinition(d.body);
      const where = `${label}:${d.line + 1} [^${d.id}]`;
      if (parsed.error) {
        fail('source-tags', `${where}: ${parsed.error}`);
        continue;
      }
      if (parsed.tag) checkTag(where, parsed.tag);
      else checkCitation(where, parsed, scope);
      out.push({ kind: parsed.kind, id: d.id });
    }
    for (const m of md.markers) {
      if (!seen.has(m.id)) fail('markers', `${label}:${m.line + 1}: marker [^${m.id}] has no definition`);
    }
    return out;
  };

  const claims = { plan: [], guide: [] };
  if (isObj(plan)) claims.plan = planClaims(plan, 'plan.json');
  for (const [id, cp] of conceptPlans) planClaims(cp, `concepts/${id}/plan.json`);
  for (const [at, pp] of probePlans) planClaims(pp, `probes/${at}/plan.json`);
  for (const f of researchFiles) {
    const text = readText(`research/${f}`);
    if (text !== null) markdownClaims(parseMarkdown(text), `research/${f}`, runScope);
  }

  // ---- Dossier (§7.2) --------------------------------------------------------------------------
  const dossierText = readText('dossier.md');
  if (dossierText !== null) {
    const md = parseMarkdown(dossierText);
    const titles = md.h2.map((h) => h.title);
    if (show(titles) !== show(DOSSIER_H2)) {
      fail('dossier-sections', `dossier.md's H2s are ${show(titles)}; §7.2 wants ${show(DOSSIER_H2)} in that order`);
    }
    // Every concept R1b ran before the last assembly has its H3.
    const conceptsH2 = h2Named(md, 'Concepts');
    const h3 = conceptsH2 ? h3sUnder(md, conceptsH2).map((h) => h.title) : [];
    const lastAssembly = stages.reduce((at, s, i) => (s.stage === 'R1b-assemble' && s.outcome === 'done' ? i : at), -1);
    const assembled = new Set(stages.slice(0, lastAssembly + 1).filter((s) => s.stage === 'R1b').map((s) => s.concept));
    for (const c of assembled) {
      if (!h3.some((t) => t.startsWith(`${c}: `))) fail('dossier-sections', `dossier.md's Concepts has no H3 "${c}: <title>" for concept ${c}, which R1b ran before the last assembly (§7.2)`);
    }
    markdownClaims(md, 'dossier.md', runScope);
  }

  // ---- Reports: the gate verdicts and the V4 reports (§2, gates.md, source-markers.md) ---------------
  const gates = [];
  for (const f of listDir('reports/gates')) {
    const m = new RegExp(`^(R1b|D1-gate|D2-gate)-(${idSource(schema)})-a([1-9]\\d*)\\.json$`).exec(f);
    if (!m) fail('layout', `reports/gates/${f} isn't named <stage>-<${v3 ? 'card' : 'concept'}>-a<attempt>.json, with ${idForm(schema)} (§2)`);
    else gates.push({ file: `reports/gates/${f}`, stage: m[1], concept: m[2], attempt: Number(m[3]) });
  }
  const gateReports = new Map();
  for (const g of gates) {
    const rep = readJson(g.file, 'gate-report');
    if (rep === null) continue;
    checkGateReport(rep, g, fail);
    if (isObj(rep)) gateReports.set(g.file, rep);
  }
  const lastGate = (stage, concept) => gates.filter((g) => g.stage === stage && g.concept === concept).sort((a, b) => b.attempt - a.attempt)[0];

  const v4 = { full: new Map(), recheck: new Map() };
  for (const f of listDir('reports')) {
    if (f === 'gates') continue;
    const m = /^v4-(ledger|sources|prose)(-recheck)?\.json$/.exec(f);
    if (!m) {
      fail('layout', `reports/${f} isn't named v4-<lens>.json or v4-<lens>-recheck.json (§2)`);
      continue;
    }
    const r = { file: `reports/${f}`, lens: m[1], check: m[2] ? 'recheck' : 'full' };
    r.report = readJson(r.file, 'report-shape');
    if (isObj(r.report)) checkReportShape(r.report, r, mode, fail, schema);
    v4[r.check].set(r.lens, r);
  }

  // The concept designed last: the one whose D1 gate ran last (the log orders the files), or the only concept
  // with D1 gate reports. The gate file of a logged attempt is the one its log entry names.
  const d1Concepts = [...new Set(gates.filter((g) => g.stage === 'D1-gate').map((g) => g.concept))];
  const lastD1GateAt = lastAt((s) => s.stage === 'D1-gate' && s.outcome !== 'missing');
  let designConcept = lastD1GateAt >= 0 ? stages[lastD1GateAt].concept : null;
  if (designConcept === null && d1Concepts.length === 1) designConcept = d1Concepts[0];
  else if (designConcept === null && d1Concepts.length > 1) fail('reports', `D1 gate reports exist for ${d1Concepts.join(', ')}, and the run log doesn't say which ran last`);
  /** The verdict file of a gate's last logged attempt for `concept` before log index `before`, or its highest-numbered file. */
  const gateFor = (stage, concept, before = stages.length) => {
    const at = stages.slice(0, before).reduce((found, s, i) => (s.stage === stage && s.concept === concept && s.outcome !== 'missing' ? i : found), -1);
    if (at >= 0) return gates.find((g) => g.stage === stage && g.concept === concept && g.attempt === stages[at].attempt) ?? { file: `reports/gates/${stage}-${concept}-a${stages[at].attempt}.json`, stage, concept, attempt: stages[at].attempt };
    return stages.some((s) => s.stage === stage && s.concept === concept) ? undefined : lastGate(stage, concept);
  };
  // The concept the current guide is for: its last W1's.
  const guideConcept = guideText !== null ? (lastW1 >= 0 ? stages[lastW1].concept : designConcept) : null;
  const guideBefore = lastW1 >= 0 ? lastW1 : stages.length;
  if (guideText !== null) {
    if (guideConcept === null || !gateFor('D1-gate', guideConcept, guideBefore)) fail('reports', 'guide.md exists, but no reports/gates/D1-gate-<concept>-a<n>.json does; W1 runs only after the D1 gate passed (§5.3)');
    else if (!gateFor('D2-gate', guideConcept, guideBefore)) fail('reports', `guide.md exists, but no reports/gates/D2-gate-${guideConcept}-a<n>.json does; W1 runs only after the D2 gate passed (§5.3)`);
    for (const lens of LENSES) {
      if (!v4.full.has(lens)) fail('reports', `guide.md exists, but reports/v4-${lens}.json doesn't; every guide gets one full pass of the three lenses (S2)`);
    }
  }
  for (const r of [...v4.full.values(), ...v4.recheck.values()]) {
    if (isObj(r.report) && guideConcept !== null && r.report.concept !== guideConcept) {
      fail('reports', `${r.file} is about ${show(r.report.concept)}, but the guide's concept is ${guideConcept}`);
    }
  }

  // ---- Escalations name their verdict files; accepted gate findings (§5.4, D-236) ------------------
  const accepted = [];
  for (const [i, e] of escalations.entries()) {
    const want = `reports/gates/${e.stage}-${e.concept}-a`;
    const rep = typeof e.verdict === 'string' ? gateReports.get(e.verdict) : undefined;
    if (typeof e.verdict !== 'string' || !e.verdict.startsWith(want) || !rep) {
      fail('escalation', `escalations[${i}].verdict is ${show(e.verdict)}; it names the escalated attempt's verdict file, ${want}<n>.json (§4.1)`);
      continue;
    }
    if (e.choice !== 'accept') continue;
    for (const f of list(rep.findings)) {
      if (rep.verdict?.[f.part] !== 'fail' || INFO_CODES.includes(f.code)) continue;
      if (f.part === 'compiled') {
        fail('escalation', `escalations[${i}] accepts ${e.verdict}'s compile failure; accept isn't offered for a compile error (D-236)`);
        continue;
      }
      accepted.push({ gate: rep.stage, stage: typeof f.stage === 'string' ? f.stage : null, part: f.part, code: f.code, message: f.message });
    }
  }
  /** A gate failure the user accepted at an escalation (same plan stage, part and code) fails nothing. */
  const covered = (f) => accepted.some((a) => a.stage === (f.stage ?? null) && a.part === f.part && a.code === f.code);
  for (const [file, rep] of gateReports) {
    for (const f of list(rep.findings)) {
      if (f.accepted === true && !covered(f)) fail('gates', `${file} marks finding ${f.code} (stage ${f.stage}) accepted, but no escalation accepted it (§5.4)`);
    }
  }

  // ---- The control flow, read from the log and tied to the verdict files it routed on --------------------
  // FI-2 breaks the first endgame stage: the ladder's first rung (`m` when the plan has one), then plan order.
  const firstEndgame = [...endgame].sort((a, b) => RUNGS.indexOf(a.variant) - RUNGS.indexOf(b.variant))[0]?.id ?? null;
  const verdictOf = (s) => gateReports.get(`reports/gates/${s.stage}-${s.concept}-a${s.attempt}.json`);
  checkFlow(log, fail, {
    schema,
    verdict: verdictOf,
    /** The plan stage a fault directive breaks (offline-and-test.md): FI-1 the card's skeleton, FI-2 the first endgame stage. */
    faultedStage: (id, concept) => (id === 'FI-1' ? skeletonStage(concept) : id === 'FI-2' ? firstEndgame : null),
    /** D-334: an R1b attempt that compiled nothing because the card's damage source isn't a skill; no retry can compile it. */
    terminal: (s) => s.stage === 'R1b' && s.outcome === 'fail' && isTerminalR1b(verdictOf(s)),
    /** Whether the run holds the card a gate answer names (C-52). */
    cardExists: (id) => cardIds.has(id),
  });

  // ---- The deck and the probes (D-287, D-338, D-339), against the log ----------------------------------
  if (v3) {
    checkDeck(readText('cards.md'), stages, cardIds, fail);
    // D-338: each card's probes, as R1b's return counted them, are the folders under probes/<card-id>/.
    const logged = new Map();
    for (const s of stages) if (s.stage === 'R1b' && isInt(s.probes)) logged.set(s.concept, (logged.get(s.concept) ?? 0) + s.probes);
    const r1bCards = new Set(stages.filter((s) => s.stage === 'R1b').map((s) => s.concept));
    for (const [id, n] of probeCounts) {
      if (!r1bCards.has(id)) fail('probes', `probes/${id}/ holds ${n} probe variant(s), but run-log.json logs no R1b for ${id}; only its R1b step writes them (D-338)`);
    }
    for (const id of r1bCards) {
      const folders = probeCounts.get(id) ?? 0;
      const sum = logged.get(id) ?? 0;
      if (sum > PROBE_CAP) fail('probes', `run-log.json's R1b entries for ${id} log ${sum} probes; a card has at most ${PROBE_CAP} (D-292)`);
      if (sum !== folders) fail('probes', `run-log.json's R1b entries for ${id} log ${sum} probe(s), but probes/${id}/ holds ${folders}; the runner logs each R1b return's "probes <n>" (D-338)`);
    }
    // D-286: the card the verification gate finalized gives the run its roll, its skeleton's identity.
    const finalized = list(log.checkpoints).filter((c) => c.checkpoint === 'verification' && /^pick:/.test(String(c.answer))).map((c) => c.answer.slice(5)).pop();
    const skeleton = finalized !== undefined ? conceptPlans.get(finalized) : undefined;
    if (isObj(log.roll) && isObj(skeleton?.roll)) {
      const differs = ['className', 'ascendancy', 'skill'].filter((k) => log.roll[k] !== skeleton.roll[k]);
      if (differs.length > 0) fail('run-log', `run-log.json roll is ${show(log.roll)}, but the verification gate finalized ${finalized}, whose identity (concepts/${finalized}/plan.json's roll) is ${show(skeleton.roll)}; the finalized card's identity becomes the run's roll (D-286)`);
    }
  }

  // ---- Open V4 findings (S2): the re-check's unresolved ones, and the full pass's it didn't fix -------
  // A re-check report belongs to the last full pass only when the log runs it after that pass (a revision
  // rewrites the full-pass reports, and may leave an earlier cycle's re-check report behind).
  const lastRun = (stage) => lastAt((s) => s.stage === stage && s.outcome !== 'missing');
  const open = [];
  for (const lens of guideText !== null ? LENSES : []) {
    const full = v4.full.get(lens);
    if (!full || !isObj(full.report)) continue;
    const re = lastRun(`V4-${lens}-recheck`) > lastRun(`V4-${lens}`) ? v4.recheck.get(lens) : undefined;
    const reFindings = re && isObj(re.report) ? list(re.report.findings) : [];
    const ids = new Set();
    for (const f of [...reFindings, ...list(full.report.findings)]) {
      if (f.status !== 'unresolved' || ids.has(f.id)) continue;
      if (reFindings.some((g) => g.id === f.id && g.status === 'fixed')) continue;
      ids.add(f.id);
      open.push({ ...f, lens });
    }
  }

  // ---- Guide (§8: the reader layer, D-276) and the audit layer (§7.8, D-278) ------------------------
  // The guide renders the plan: it carries no markers, so the plan's claims hold its sources (claims.guide
  // stays empty, and an accepted-offline finding can name only a plan claim).
  let guide = null;
  let audit = null;
  if (guideText !== null) {
    guide = parseMarkdown(guideText);
    const h1 = guide.headings.filter((h) => h.level === 1);
    const roll = isObj(log.roll) ? log.roll : {};
    if (h1.length !== 1) fail('guide-sections', `guide.md has ${h1.length} H1s; it has one, naming the roll (§8)`);
    else if (!norm(h1[0].title).includes(norm(roll.ascendancy ?? '')) || !norm(h1[0].title).includes(norm(roll.skill ?? ''))) {
      fail('guide-sections', `guide.md's H1 "${h1[0].title}" doesn't name the roll ${roll.ascendancy} / ${roll.skill}`);
    }
    // (b) The reader layer's 14 H2s, in order, and no other (D-276, D-283).
    const titles = guide.h2.map((h) => h.title);
    if (show(titles) !== show(GUIDE_H2)) {
      const missing = GUIDE_H2.filter((t) => !titles.includes(t));
      const extra = titles.filter((t) => !GUIDE_H2.includes(t));
      const why = missing.length > 0 ? `missing ${show(missing)}` : extra.length > 0 ? `unexpected ${show(extra)}` : 'out of order';
      fail('guide-sections', `guide.md's H2s are ${why}; §8 wants ${show(GUIDE_H2)} in that order`);
    }
    for (const title of Object.values(VARIANT_H2)) {
      const h = h2Named(guide, title);
      if (h && !h3sUnder(guide, h).some((x) => x.title === 'Checks')) fail('guide-sections', `guide.md's "${title}" has no H3 "Checks" (§8)`);
    }
    const showH2 = h2Named(guide, SHOW_H2);
    const showH3 = showH2 ? h3sUnder(guide, showH2) : [];
    if (showH2 && showH3[showH3.length - 1]?.title !== KNOWN_ISSUES) {
      fail('guide-sections', `guide.md's "${SHOW_H2}" doesn't end with the H3 "${KNOWN_ISSUES}" (§8, D-276)`);
    }
    const primer = h2Named(guide, PRIMER_H2);
    if (primer && offline && !/offline/i.test(sectionText(guide, primer))) {
      fail('guide-sections', `guide.md's "${PRIMER_H2}" doesn't say the run was offline (§8)`);
    }

    // (h) The import code, the first fenced block of "Your PoB file", equals the record's (D-205).
    let importBlock = null;
    if (primer) {
      const { start, end } = guide.sectionOf(primer);
      importBlock = guide.fences.find((f) => f.start > start && f.start < end) ?? null;
      if (!importBlock) fail('import-code', `guide.md's "${PRIMER_H2}" has no fenced import code (§8)`);
      else if (isObj(record) && importBlock.content.trim() !== String(record.importCode ?? '').trim()) {
        fail('import-code', "guide.md's import code differs from compile-record.json's importCode (D-205)");
      }
    }

    // (c) Leveling: one H3 per campaign stage, in plan order, titled with the record's loadout name.
    const leveling = h2Named(guide, 'Leveling');
    if (leveling && isObj(record) && isObj(record.stages)) {
      const got = h3sUnder(guide, leveling).map((h) => h.title);
      const want = campaign.map((s) => record.stages[s.id]?.loadoutName ?? `<stage ${s.id} not in the record>`);
      if (show(got) !== show(want)) {
        fail('leveling', `guide.md's Leveling H3s are ${show(got)}; the record's campaign loadouts, in plan order, are ${show(want)} (§8)`);
      }
    }

    // (v) The word cap: at most 3,000 words, the H1, the import code and the Known issues list not counted (D-283).
    const kiH3 = showH3.find((h) => h.title === KNOWN_ISSUES) ?? null;
    const ki = kiH3 ? guide.sectionOf(kiH3) : null;
    const words = countWords(guide.lines, (i) =>
      h1.some((h) => h.line === i) || (importBlock !== null && i >= importBlock.start && i <= importBlock.end) || (ki !== null && i > ki.start && i < ki.end));
    if (words > WORD_CAP) {
      fail('word-cap', `guide.md has ${words} words, over the ${WORD_CAP}-word cap (the H1, the import code and the Known issues list not counted; D-276, D-283)`);
    }

    // (w) No pipeline text: no footnote marker, confidence label or finding id, anywhere outside the import code.
    // Only the import code's block is exempt; any other fenced block is guide text like the rest.
    guide.lines.forEach((line, i) => {
      if (importBlock !== null && i >= importBlock.start && i <= importBlock.end) return;
      const label = CONFIDENCE_LABEL.exec(line)?.[0];
      const id = FINDING_ID.exec(line)?.[0];
      const what = line.includes('[^') ? 'a footnote marker "[^"' : label ? `the confidence label "${label}"` : id ? `the finding id "${id}"` : null;
      if (what) fail('guide-markers', `guide.md:${i + 1} carries ${what}; the guide renders the plan with no markers, confidence labels or finding ids, and the plan's claims carry the sources (D-276, D-283)`);
    });
  }

  // The audit layer (§7.8, D-278): W1 writes audit.md beside the guide, with its six H2s.
  const auditText = readText('audit.md');
  if (guideText !== null) {
    if (auditText === null) fail('audit-sections', "guide.md exists, but audit.md doesn't; W1 writes the audit layer beside the guide (§7.8, D-278)");
    else {
      audit = parseMarkdown(auditText);
      const titles = audit.h2.map((h) => h.title);
      if (show(titles) !== show(AUDIT_H2)) {
        const missing = AUDIT_H2.filter((t) => !titles.includes(t));
        const extra = titles.filter((t) => !AUDIT_H2.includes(t));
        const why = missing.length > 0 ? `missing ${show(missing)}` : extra.length > 0 ? `unexpected ${show(extra)}` : 'out of order';
        fail('audit-sections', `audit.md's H2s are ${why}; §7.8 wants ${show(AUDIT_H2)} in that order (D-278)`);
      }
    }
  }

  if (guide !== null) {
    // (x) One fixed-form verdict line per endgame rung, each part compared with the record (D-283).
    const guideD1 = guideConcept !== null ? gateFor('D1-gate', guideConcept, guideBefore) : undefined;
    checkVerdictLines(guide, endgame, record, guideD1 ? gateReports.get(guideD1.file) : null, fail, v3);
    // (l) Known issues by sentence in the guide, with each finding's id in audit.md (D-276, D-283).
    checkKnownIssues(guide, audit, accepted, open, fail);
  }

  // ---- Campaign rewards (D-265 c): every reward choice the campaign passes is picked, and the guide says so ----
  if (isObj(plan) && campaign.length > 0) checkRewardPicks(planStages, campaign, guide, fail);

  // accepted-offline (C-30, §7.4): only for a claim tagged external-unavailable, which the location names. A report
  // superseded by one that checked every claim again (a full re-check after a fix round in which a gate re-ran, or a
  // revision's full pass) is held to the artifact as it was when it was written (D-265 a): once a step wrote that
  // artifact after the report's log entry, that version is gone, the location check skips it, and the later report
  // is what counts. A claims-only round edits claims in place and moves none, so its locations still hold.
  const changedSince = (artifact, at) => stages.slice(at + 1).some((s) => (ARTIFACT_WRITERS[artifact] ?? []).includes(s.stage));
  for (const r of guideText !== null ? [...v4.full.values(), ...v4.recheck.values()] : []) {
    if (!isObj(r.report)) continue;
    const at = lastRun(r.check === 'recheck' ? `V4-${r.lens}-recheck` : `V4-${r.lens}`);
    const later = lastRun(r.check === 'recheck' ? `V4-${r.lens}` : `V4-${r.lens}-recheck`);
    const gateBetween = stages.slice(at + 1, later).some((s) => (s.stage === 'D1-gate' || s.stage === 'D2-gate') && s.outcome !== 'missing');
    const superseded = at >= 0 && later > at && (r.check === 'recheck' || gateBetween);
    list(r.report.findings).forEach((f, i) => {
      if (f.status !== 'accepted-offline') return;
      if (superseded && changedSince(f.artifact, at)) return;
      const claim = claimAt(claims, f.artifact, f.location);
      if (!claim || claim.kind !== 'external-unavailable') {
        fail('report-shape', `${r.file}: findings[${i}] is accepted-offline, but ${show(f.artifact)} ${show(f.location)} names ${claim ? `a ${claim.kind} claim` : 'no claim'}; only a claim tagged external-unavailable is accepted offline (C-30)`);
      }
    });
  }

  // ---- The D1 gate, recomputed from the plan and the record (Q3; AC-W2 o, p, q, u) ------------------
  const ruleOf = (part) => (part === 'rolledSkill' ? 'rolled-skill' : ['floor', 'budget'].includes(part) ? part : 'gates');
  // The last D1 gate of the concept designed last. Only the budget may be unverified (D-164): a gate whose
  // compile ran reads every other part from its record, and a gate that didn't fail has that record.
  const d1 = designConcept !== null ? gateFor('D1-gate', designConcept) : undefined;
  const d1rep = d1 ? gateReports.get(d1.file) : null;
  const holdsEndgame = isObj(record) && isObj(record.stages) && endgame.length > 0 && endgame.every((s) => isObj(record.stages[s.id]?.outputs));
  const compileFailed = isObj(d1rep) && isObj(d1rep.verdict) && d1rep.verdict.compiled === 'fail';
  if (d1 && isObj(d1rep) && isObj(d1rep.verdict) && !compileFailed) {
    for (const part of GATE_PARTS['D1-gate'].filter((x) => x !== 'budget')) {
      if (d1rep.verdict[part] === 'unverified') fail(ruleOf(part), `${d1.file} says ${part}: "unverified"; only the budget may be unverified: a gate whose compile ran reads every other part from its record (gates.md)`);
    }
    if (!isObj(plan)) fail('layout', `${d1.file} exists, but plan.json doesn't; the gate can't be recomputed`);
    else if (!holdsEndgame) fail('gates', `${d1.file} doesn't fail its compile, but compile-record.json holds no values for the endgame stages; a gate that didn't fail has its compile's record`);
  }
  // The recompute runs whenever the record holds the endgame values. The gate's own verdict is compared only
  // when its compile ran and no D1 rewrote the plan after it; a current guide's concept passes it outright.
  if (isObj(plan) && holdsEndgame && (guideText !== null || (d1 && isObj(d1rep) && isObj(d1rep.verdict)))) {
    const said = (part) => (isObj(d1rep?.verdict) ? d1rep.verdict[part] : undefined);
    const parts = {
      floor: recomputeFloor(endgame, record, guide, fail),
      budget: recomputeBudget(endgame, plan, isObj(d1rep) ? d1rep : {}, guide, fail),
      rolledSkill: recomputeRolledSkill(endgame, plan, record, isObj(d1rep) ? d1rep : {}, fail),
    };
    const gateFresh = d1 && isObj(d1rep) && !compileFailed && stages.findLastIndex((s) => s.stage === 'D1' && s.outcome !== CLAIMS_EDITED) < lastD1GateAt;
    for (const [part, got] of Object.entries(parts)) {
      const openFailures = got.failures.filter((f) => !covered(f));
      const effective = openFailures.length > 0 ? 'fail' : got.verdict === 'fail' ? (got.unverified ? 'unverified' : 'pass') : got.verdict;
      const why = got.failures.map((f) => f.why).join('; ');
      // The gate's verdict must agree with the records (accepted failures may be counted either way).
      if (gateFresh && (['pass', 'fail'].includes(said(part)) || part === 'budget')) {
        if (said(part) !== got.verdict && said(part) !== effective) fail(ruleOf(part), `${d1.file} says ${part}: ${show(said(part))}, but the records give ${show(got.verdict)}${why ? `: ${why}` : ''}`);
      }
      // A guide is written only after the gate passed: no recomputed failure stands unless accepted.
      if (guideText !== null) for (const f of openFailures) fail(ruleOf(part), `the guide's concept fails the D1 gate's ${part} (${f.code}, stage ${f.stage}): ${f.why}; only a pass, or an unverified budget, proceeds to D2 (§5.3)`);
    }
  }
  // S7: a stage with the named damage source (its group is `rolledGroup`, D-295) makes it the main skill, so the
  // PoB file opens on it.
  for (const s of campaign) {
    if (s.skills?.rolledGroup !== undefined && s.skills?.main?.group !== s.skills.rolledGroup) {
      fail('rolled-skill', `campaign stage ${s.id}'s main group is ${show(s.skills?.main?.group)}, but its rolledGroup is ${s.skills.rolledGroup}; a stage with the named damage source makes it the main skill (S7)`);
    }
  }
  // Once a guide is current, the D1 and D2 gates it rests on (the last attempts before its W1) passed: a failing
  // part stands only where accepted findings cover it.
  if (guideText !== null && guideConcept !== null) {
    for (const stage of ['D1-gate', 'D2-gate']) {
      const g = gateFor(stage, guideConcept, guideBefore);
      const rep = g ? gateReports.get(g.file) : null;
      if (!isObj(rep) || !isObj(rep.verdict)) continue;
      for (const part of GATE_PARTS[stage]) {
        if (rep.verdict[part] !== 'fail') continue;
        const findings = list(rep.findings).filter((f) => f.part === part && !INFO_CODES.includes(f.code));
        const openFindings = findings.filter((f) => !covered(f));
        if (part === 'compiled' || findings.length === 0 || openFindings.length > 0) {
          fail(ruleOf(part), `${g.file} says ${part}: "fail"${openFindings.length > 0 ? ` (${openFindings.map((f) => f.code).join(', ')})` : ''}, and no accepted finding covers it; the guide's concept passed this gate (§5.3, §5.4)`);
        }
      }
    }
  }

  // ---- The final record (C-33; amendment 1 §4.2 new checks r, s, t) ---------------------------------
  if (finalRecord && isObj(finalRecord.stages)) {
    for (const [id, st] of Object.entries(finalRecord.stages)) {
      for (const check of ['v1', 'v2']) {
        const verdict = st?.[check];
        if (!isObj(verdict)) {
          fail('record-verdicts', `the final record's stage ${id} has no ${check.toUpperCase()} verdict (D-192)`);
          continue;
        }
        const openFindings = (Array.isArray(verdict.findings) ? verdict.findings : []).filter((f) => !covered({ stage: id, part: check, code: f?.code }));
        if (openFindings.length > 0) fail('record-verdicts', `the final record's stage ${id} fails ${check.toUpperCase()}: ${openFindings.map((f) => f?.code).join(', ')}`);
      }
    }
  }
  // D-264: a claims-only owner compiles nothing, so the record is still the final compile the last D2 gate ran.
  if (claimsOnlyAfterFinal.length > 0 && lastFinalGate >= 0) {
    const who = claimsOnlyAfterFinal.map(describe).join(', ');
    const gate = stages[lastFinalGate];
    const named = gateReports.get(`reports/gates/D2-gate-${gate.concept}-a${gate.attempt}.json`)?.finalCompile?.pobFile;
    if (isObj(record) && record.mode !== 'final') {
      fail('record-plan', `${who} edited claims without a compile (${CLAIMS_EDITED}), but compile-record.json is a ${show(record.mode)} record, not the final compile of ${describe(gate)}: a claims-only edit compiles nothing (D-264)`);
    } else if (finalRecord && typeof named === 'string' && finalRecord.pobFile?.path !== named) {
      fail('record-plan', `${who} edited claims without a compile (${CLAIMS_EDITED}), but the final record's PoB file ${show(finalRecord.pobFile?.path)} isn't ${show(named)}, the one ${describe(gate)} wrote (D-264)`);
    }
  }
  if (recordCurrent && exists('plan.json')) {
    // (r) The record is of this plan: the final compile validated it (D-163), so the plan validates too.
    const planSha1 = sha1(fs.readFileSync(abs('plan.json')));
    if (claimsOnlyAfterFinal.length === 0) {
      if (finalRecord.planSha1 !== planSha1) {
        fail('record-plan', `sha1(plan.json) is ${planSha1}, but the final record's planSha1 is ${show(finalRecord.planSha1)}: plan.json changed after the final compile`);
      }
    } else if (isObj(plan)) {
      // D-264, D-266: claims edited in place after the final compile change plan.json's sha1, never its build:
      // the projection without stages[].claims and the source and tag fields is still the one the final compile
      // built, its sha1 the record's buildSha1. A record without one predates D-266 and can't show it.
      const who = claimsOnlyAfterFinal.map(describe).join(', ');
      const hash = await loadBuildHashModule();
      if (hash === null) {
        fail('record-plan', `the server's build projection ${path.relative(REPO, BUILD_HASH_MODULE)} is missing; build the server (pnpm build) to check ${who}'s claims-only edit`);
      } else if (typeof finalRecord.buildSha1 !== 'string') {
        fail('record-plan', `${who} edited claims without a compile (${CLAIMS_EDITED}), but the final record has no buildSha1 to hold the plan's build to (D-266)`);
      } else if (hash.buildSha1(plan) !== finalRecord.buildSha1) {
        fail('record-plan', `${who} edited claims without a compile (${CLAIMS_EDITED}), but plan.json's build changed: the sha1 of its build-affecting part (everything but stages[].claims and the source and tag fields) is ${hash.buildSha1(plan)}, and the final record's buildSha1 is ${show(finalRecord.buildSha1)}; only a recompile changes the build (D-264, D-266)`);
      }
    }
  }
  if (finalRecord) {
    // (s) The PoB file equals the import code, with one loadout per plan stage (D-103, D-215).
    let xml = null;
    try {
      xml = decodeImportCode(finalRecord.importCode ?? '');
    } catch (e) {
      fail('pob-file', `the final record's importCode doesn't decode as a PoB code (zlib: ${e.message})`);
    }
    if (xml !== null) {
      const pob = isObj(finalRecord.pobFile) ? finalRecord.pobFile : {};
      if (sha1(xml) !== pob.sha1) fail('pob-file', `the decoded importCode's sha1 is ${sha1(xml)}, but the record's PoB file ${show(pob.path)} has sha1 ${show(pob.sha1)}: the import code isn't the file's`);
      const got = specTitles(xml.toString('utf8'));
      const ids = Array.isArray(finalRecord.stagesCompiled) ? finalRecord.stagesCompiled : [];
      const want = ids.map((id) => finalRecord.stages?.[id]?.loadoutName ?? `<stage ${id} not in the record>`);
      if (got.length !== want.length) fail('pob-file', `the import code's build holds ${got.length} tree set(s), but the record compiled ${want.length} stage(s); the file holds one loadout per stage (D-215)`);
      else if (show(got) !== show(want)) fail('pob-file', `the import code's tree sets are titled ${show(got)}; the record's loadout names, in plan order, are ${show(want)} (D-103, D-215)`);
    }
  }
  if (recordCurrent && isObj(plan) && Array.isArray(plan.ledger) && isObj(finalRecord.stages)) {
    // (t) Every ledger entry re-evaluates over the record, with the server's own evaluator, to the record's value.
    const ledgerModule = await loadLedgerModule();
    if (ledgerModule === null) {
      fail('ledger', `the server's ledger evaluator ${path.relative(REPO, LEDGER_MODULE)} is missing; build the server (pnpm build) to re-derive the ledger`);
    } else {
      const numbers = Object.fromEntries(Object.entries(finalRecord.stages).filter(([, s]) => isObj(s)).map(([id, s]) => [id, { outputs: isObj(s.outputs) ? s.outputs : {}, skillOutputs: isObj(s.skillOutputs) ? s.skillOutputs : {} }]));
      const entries = plan.ledger.filter((e) => isObj(e) && typeof e.id === 'string' && typeof e.formula === 'string').map((e) => ({ id: e.id, formula: e.formula, inputs: list(e.inputs) }));
      const results = ledgerModule.evaluateLedger(entries, { stageIds: planStages.map((s) => s.id), stages: numbers });
      for (const e of entries) {
        const got = results[e.id]?.value ?? null;
        const recorded = finalRecord.ledger?.[e.id]?.value ?? null;
        const equal = got === null ? recorded === null : isNum(recorded) && round2(got) === round2(recorded);
        if (!equal) {
          const why = got === null ? `doesn't evaluate (${results[e.id]?.error?.message ?? 'no value'})` : `re-evaluates to ${got}`;
          fail('ledger', `ledger entry ${e.id} ${why}, but the final record has ${show(recorded)} (compared to 2 decimals)`);
        }
      }
    }
  }
  return violations;
}

/**
 * D-265 (c): the campaign reward choices C1 lists (`q.<key>.options` in data/campaign/progress.json), each with
 * PoB's config option for it (`q.<key>.pob-config-key`) and its place in the progress order.
 */
function rewardChoices() {
  const file = 'campaign/progress.json';
  const order = factValue(file, 'order');
  const facts = dataFiles.get(file)?.facts;
  if (!Array.isArray(order) || !isObj(facts)) return { order: [], choices: [] };
  const choices = Object.keys(facts)
    .map((k) => /^(q\.[a-z0-9-]+)\.options$/.exec(k))
    .filter((m) => m !== null && Array.isArray(facts[m[0]].value))
    .map((m) => ({ quest: m[1], options: facts[m[0]].value, option: factValue(file, `${m[1]}.pob-config-key`), at: order.indexOf(m[1]) }))
    .filter((c) => typeof c.option === 'string' && c.at >= 0)
    .sort((a, b) => a.at - b.at);
  return { order, choices };
}

/**
 * D-265 (c): D2 picks every reward choice the campaign passes, and the endgame stages carry the picks. Every stage
 * at or after the choice's quest, the endgame stages included, lists its option with one of its values, the same
 * one on each (the player picks once, and the record's numbers include the reward); the guide's `Campaign route
 * and rewards` names the pick by its first line (D-283). A choice no campaign stage reaches needs no pick.
 */
function checkRewardPicks(planStages, campaign, guide, fail) {
  const { order, choices } = rewardChoices();
  for (const c of choices) {
    if (!campaign.some((s) => order.indexOf(s.progress) >= c.at)) continue;
    const passed = planStages.filter((s) => order.indexOf(s.progress) >= c.at);
    const picks = passed.map((s) => ({ id: s.id, value: [...list(s.config?.earned), ...list(s.config?.scenario)].find((o) => o.option === c.option)?.value }));
    const unpicked = picks.filter((p) => !c.options.includes(p.value));
    if (unpicked.length > 0) {
      fail('campaign-rewards', `stage${unpicked.length === 1 ? '' : 's'} ${unpicked.map((p) => p.id).join(', ')} pass${unpicked.length === 1 ? 'es' : ''} ${c.quest}, a reward choice the campaign makes, without picking it: list option ${show(c.option)} with one of the ${c.options.length} values of data/campaign/progress.json#${c.quest}.options in config.scenario, on every stage at or after the quest, the endgame stages included (D-265)`);
      continue;
    }
    const values = [...new Set(picks.map((p) => p.value))];
    if (values.length > 1) {
      fail('campaign-rewards', `stages ${picks.map((p) => p.id).join(', ')} pick ${c.quest}'s reward ${values.length} different ways; the player picks once, so every stage at or after the quest, the endgame stages included, lists the same pick (D-265)`);
      continue;
    }
    if (!guide) continue;
    // D-283: by name. The pick's first line (an option may run over several) appears in the section.
    const first = String(values[0]).split('\n')[0].trim();
    const h2 = h2Named(guide, REWARDS_H2);
    if (!h2 || !norm(sectionText(guide, h2)).includes(norm(first))) {
      fail('campaign-rewards', `the plan picks ${show(values[0])} for ${c.quest}, but guide.md's "${REWARDS_H2}" doesn't name it by its first line "${first}"; W1 writes every pick there (D-265, D-283)`);
    }
  }
}

// ---------------------------------------------------------------------------------------------------
// The reader layer's number check and its Known issues (D-276, D-283)
// ---------------------------------------------------------------------------------------------------

/** D-283, D-294: the verdict line's fixed form, as the guide template gives it. */
const VERDICT_FORM = '- **<Entering maps|Budget|Non-budget> (L<level>): <solid|watch|risky>.** Resistances <fire>/<cold>/<lightning>/<chaos>% at −60%. Max hit <n> physical against about <hit>, and at least <n> elemental or chaos against about <hit>. <Skill> about <n> DPS. Effective HP about <n>.';
/** D-326: a schema-2 run's guide predates D-294's Effective HP, so its verdict line may end at the DPS. */
const EHP_PART = ' Effective HP about <n>.';
const NUM = '[−-]?\\d[\\d,]*(?:\\.\\d+)?';
const VERDICT_LINE = new RegExp(
  `^[-*] \\*\\*(Entering maps|Budget|Non-budget) \\(L(\\d+)\\): (solid|watch|risky)\\.\\*\\* Resistances (${NUM})/(${NUM})/(${NUM})/(${NUM})% at [−-]60%\\. ` +
    `Max hit (${NUM}) physical against about (${NUM}), and at least (${NUM}) elemental or chaos against about (${NUM})\\. (.+?) about (${NUM}) DPS\\.` +
    `(?: Effective HP about (${NUM})\\.)?$`,
);
const OTHER_TYPES = ['Fire', 'Cold', 'Lightning', 'Chaos'];

/**
 * D-283's one number check: each endgame rung has one verdict line in `Survival by stage`, found by its label,
 * in the fixed form, and each written part matches the record by the rounding rule (`matchesWritten`): the level
 * the stage's `level`; the resistances `FireResist`, `ColdResist`, `LightningResist`, `ChaosResist`; the
 * physical max hit `PhysicalMaximumHitTaken` against `hit_<stage>_physical`; the other max hit the least of the
 * four other `<Type>MaximumHitTaken` against the largest of the four other hits; the DPS the named damage
 * source's figure the D1 gate's verdict names, × its Count where the record has a counted copy (D-294, D-340);
 * and the closing "Effective HP about <n>." the stage's `TotalEHP` (D-294), which a schema-3 run's line always
 * has. The verdict word stays judgment.
 */
function checkVerdictLines(guide, endgame, record, d1rep, fail, v3) {
  const h2 = h2Named(guide, SURVIVAL_H2);
  if (!h2) return;
  const { start, end } = guide.sectionOf(h2);
  const lines = guide.lines.slice(start + 1, end).map((text, k) => ({ text: text.trim(), n: start + k + 2 }));
  const where = `guide.md's "${SURVIVAL_H2}"`;
  const labels = new Set(endgame.map((s) => VARIANT_LABEL[s.variant]).filter(Boolean));
  for (const label of Object.values(VARIANT_LABEL)) {
    if (!labels.has(label) && lines.some((l) => l.text.startsWith(`- **${label} (L`))) fail('verdict-line', `${where} has a verdict line for the ${label} rung, but the plan has no such rung (D-283)`);
  }
  for (const s of endgame) {
    const label = VARIANT_LABEL[s.variant];
    if (!label) continue;
    const mine = lines.filter((l) => l.text.startsWith(`- **${label} (L`));
    if (mine.length === 0) {
      fail('verdict-line', `${where} has no verdict line for the ${label} rung, stage ${s.id}: "${VERDICT_FORM}" (D-283)`);
      continue;
    }
    if (mine.length > 1) fail('verdict-line', `${where} has ${mine.length} verdict lines for the ${label} rung; one per rung (D-283)`);
    const at = `guide.md:${mine[0].n}`;
    const m = VERDICT_LINE.exec(mine[0].text);
    if (!m) {
      fail('verdict-line', `${at}: the ${label} verdict line isn't in the fixed form "${v3 ? VERDICT_FORM : VERDICT_FORM.replace(EHP_PART, '')}" (D-283${v3 ? ', D-294' : ''})`);
      continue;
    }
    if (v3 && m[14] === undefined) {
      fail('verdict-line', `${at}: the ${label} verdict line doesn't end with "Effective HP about <n>.", the stage's TotalEHP beside its max hit: "${VERDICT_FORM}" (D-294)`);
    }
    if (Number(m[2]) !== s.level) fail('verdict-line', `${at}: the ${label} verdict line says level ${m[2]}, but stage ${s.id}'s level is ${show(s.level)} (D-283)`);
    const st = isObj(record?.stages) ? record.stages[s.id] : undefined;
    const out = isObj(st?.outputs) ? st.outputs : null;
    if (!out) {
      fail('verdict-line', `${at}: the record holds no outputs for stage ${s.id}, so its ${label} verdict line can't be compared (D-283)`);
      continue;
    }
    const hit = (t) => record.ledger?.[`hit_${s.id}_${t}`]?.value;
    const least = (xs) => (xs.every(isNum) ? Math.min(...xs) : undefined);
    const most = (xs) => (xs.every(isNum) ? Math.max(...xs) : undefined);
    const parts = [
      ['fire resistance', m[4], out.FireResist, `${s.id}.FireResist`],
      ['cold resistance', m[5], out.ColdResist, `${s.id}.ColdResist`],
      ['lightning resistance', m[6], out.LightningResist, `${s.id}.LightningResist`],
      ['chaos resistance', m[7], out.ChaosResist, `${s.id}.ChaosResist`],
      ['physical max hit', m[8], out.PhysicalMaximumHitTaken, `${s.id}.PhysicalMaximumHitTaken`],
      ['physical hit', m[9], hit('physical'), `the ledger's hit_${s.id}_physical`],
      ['elemental or chaos max hit', m[10], least(OTHER_TYPES.map((t) => out[`${t}MaximumHitTaken`])), `the least of ${s.id}'s ${OTHER_TYPES.map((t) => `${t}MaximumHitTaken`).join(', ')}`],
      ['elemental or chaos hit', m[11], most(OTHER_TYPES.map((t) => hit(t.toLowerCase()))), `the largest of the ledger's ${OTHER_TYPES.map((t) => `hit_${s.id}_${t.toLowerCase()}`).join(', ')}`],
    ];
    // The DPS is the named damage source's figure the D1 gate's verdict names for the stage's rolledGroup (§5.3),
    // × its Count where the record has a counted copy (D-294, D-340): the headline the PoB file shows.
    const fig = list(list(d1rep?.basis?.rolledSkill).find((b) => b.stage === s.id)?.figures).find((f) => f.group === s.skills?.rolledGroup)?.figure;
    const lg = /^ledger:(\w+)$/.exec(String(fig ?? ''));
    const read = lg ? { value: record.ledger?.[lg[1]]?.value, counted: false } : figureOf(st, fig);
    const named = read.counted ? `the named damage source's figure × its Count ${read.count}, ${s.id}.countedSkillOutputs.${fig}` : `the named damage source's figure ${s.id}.${fig}`;
    if (fig === undefined) fail('verdict-line', `${at}: the D1 gate's verdict names no figure for stage ${s.id}'s named damage source, so the ${label} verdict line's DPS can't be compared (D-283)`);
    else parts.push(['DPS', m[13], read.value, named]);
    if (m[14] !== undefined) parts.push(['Effective HP', m[14], out.TotalEHP, `${s.id}.TotalEHP`]);
    for (const [part, written, value, from] of parts) {
      if (!isNum(value)) fail('verdict-line', `${at}: the ${label} verdict line's ${part} can't be compared: the record has no value for ${from} (D-283)`);
      else if (!matchesWritten(written, value)) {
        fail('verdict-line', `${at}: the ${label} verdict line says ${part} ${written}, but ${from} is ${value}, which doesn't round to it at that number's last significant digit (D-283)`);
      }
    }
  }
}

/** The non-empty lines of a section, trimmed, with their 1-based line numbers. */
function sectionLines(md, heading) {
  const { start, end } = md.sectionOf(heading);
  return md.lines.slice(start + 1, end).map((raw, k) => ({ raw: raw.trim(), n: start + k + 2 })).filter((l) => l.raw !== '');
}
/** An audit row's stage cell for a finding about no one stage. */
const NO_STAGE = ['', '—', '-', '–'];

/**
 * D-276, D-278, D-283: Known issues by sentence. The guide's H3 `Known issues`, the last part of `What PoB can't
 * show`, lists one plain sentence per finding (`- <sentence>`), with no id; audit.md's `Known issues` table holds
 * each finding's row `| <id> | <lens or gate> | <stage> | <the sentence the guide prints> |`: an open V4 finding
 * by its id and lens, its sentence its `reader`; an accepted gate finding by its code, gate and plan stage (W1
 * writes its sentence). Both lists hold this cycle's findings alone (the runner replaces them whole at step 14,
 * D-265), and `None.` only when nothing is open or accepted.
 */
function checkKnownIssues(guide, audit, accepted, open, fail) {
  const total = accepted.length + open.length;
  const showH2 = h2Named(guide, SHOW_H2);
  const kiH3 = showH2 ? h3sUnder(guide, showH2).find((h) => h.title === KNOWN_ISSUES) : null;
  const kiH2 = audit ? h2Named(audit, KNOWN_ISSUES) : null;
  if (total > 0 && !kiH3) fail('known-issues', `${accepted.length} accepted gate finding(s) and ${open.length} open V4 finding(s), but guide.md has no "${KNOWN_ISSUES}" H3 under "${SHOW_H2}" (D-276)`);
  if (total > 0 && audit && !kiH2) fail('known-issues', `${accepted.length} accepted gate finding(s) and ${open.length} open V4 finding(s), but audit.md has no "${KNOWN_ISSUES}" H2 to hold their ids (D-278)`);
  const items = (kiH3 ? sectionLines(guide, kiH3) : []).map((l) => ({ ...l, text: l.raw === 'None.' ? l.raw : l.raw.replace(/^[-*]\s+/, '') }));
  const rows = [];
  for (const l of kiH2 ? sectionLines(audit, kiH2) : []) {
    if (l.raw === 'None.') {
      if (total > 0) fail('known-issues', `audit.md:${l.n}: ${KNOWN_ISSUES} says "None.", but ${open.length} V4 finding(s) are open and ${accepted.length} gate finding(s) accepted (D-265)`);
      continue;
    }
    const cells = l.raw.startsWith('|') ? l.raw.replace(/^\|/, '').replace(/\|$/, '').split('|').map((c) => c.trim()) : null;
    if (cells && (cells.every((c) => /^:?-+:?$/.test(c)) || cells[0] === 'Id')) continue;
    if (!cells || cells.length !== 4) {
      fail('known-issues', `audit.md:${l.n}: ${KNOWN_ISSUES} holds ${show(l.raw)}, which isn't a row "| <id> | <lens or gate> | <stage> | <the sentence the guide prints> |" (§7.8)`);
      continue;
    }
    const cell = (c) => c.replace(/`/g, '');
    rows.push({ id: cell(cells[0]), from: cell(cells[1]), stage: NO_STAGE.includes(cells[2]) ? null : cell(cells[2]), sentence: cells[3], n: l.n });
  }
  const used = new Set();
  const sentences = [];
  const listed = (sentence) => items.some((l) => collapse(l.text) === collapse(sentence));
  for (const f of open) {
    const row = rows.find((r) => r.id === f.id);
    const reader = typeof f.reader === 'string' && f.reader.trim() !== '' ? f.reader.trim() : null;
    if (!row) fail('known-issues', `V4 ${f.lens} finding ${show(f.id)} (${f.issue ?? 'no issue text'}) is open after the re-check, but audit.md's ${KNOWN_ISSUES} has no row "| ${f.id} | ${f.lens} | — | <its reader sentence> |" (D-276, D-278)`);
    else {
      used.add(row);
      if (row.from !== f.lens) fail('known-issues', `audit.md:${row.n}: the ${KNOWN_ISSUES} row for ${show(f.id)} names ${show(row.from)}, not its lens ${f.lens} (§7.8)`);
      if (reader && collapse(row.sentence) !== collapse(reader)) fail('known-issues', `audit.md:${row.n}: the ${KNOWN_ISSUES} row for ${show(f.id)} gives ${show(row.sentence)}, not the finding's reader sentence ${show(reader)} (D-265, §7.8)`);
    }
    if (reader) {
      sentences.push(collapse(reader));
      if (!listed(reader)) fail('known-issues', `V4 ${f.lens} finding ${show(f.id)} (${f.issue ?? 'no issue text'}) is open after the re-check, but guide.md's ${KNOWN_ISSUES} doesn't list its reader sentence, word for word, as "- ${reader}" (D-265, D-276)`);
    }
  }
  for (const a of accepted) {
    const row = rows.find((r) => r.id === a.code && r.from === a.gate && r.stage === (a.stage ?? null));
    if (!row) {
      fail('known-issues', `audit.md's ${KNOWN_ISSUES} has no row for accepted finding ${a.code} with its gate ${a.gate}${a.stage ? ` (stage ${a.stage})` : ''}: "| ${a.code} | ${a.gate} | ${a.stage ?? '—'} | <the sentence the guide prints> |" (D-276)`);
      continue;
    }
    used.add(row);
    sentences.push(collapse(row.sentence));
    if (!listed(row.sentence)) fail('known-issues', `guide.md's ${KNOWN_ISSUES} doesn't print ${show(row.sentence)}, the sentence audit.md gives accepted finding ${a.code} (${a.gate}${a.stage ? `, stage ${a.stage}` : ''}) (D-276)`);
  }
  for (const r of rows) {
    if (!used.has(r)) fail('known-issues', `audit.md:${r.n}: ${KNOWN_ISSUES} has a row for ${show(r.id)} (${r.from}), which is no finding open after this cycle's re-check and no accepted gate finding; the runner replaces the whole table at step 14 (D-265)`);
  }
  for (const l of items) {
    if (l.text === 'None.') {
      if (total > 0) fail('known-issues', `guide.md:${l.n}: ${KNOWN_ISSUES} says "None.", but ${open.length} V4 finding(s) are open and ${accepted.length} gate finding(s) accepted (D-265)`);
    } else if (!sentences.includes(collapse(l.text))) {
      fail('known-issues', `guide.md:${l.n}: ${KNOWN_ISSUES} lists ${show(l.raw.length > 80 ? `${l.raw.slice(0, 77)}...` : l.raw)}, which is the sentence of no finding open after this cycle's re-check and of no accepted gate finding; the runner replaces the whole list at step 14 (D-265)`);
    }
  }
}

// ---------------------------------------------------------------------------------------------------
// The run log (slice 03 §6: schema 3, D-289; schema 2, D-270, only for recorded runs, D-326)
// ---------------------------------------------------------------------------------------------------

/** C-51: the parsed brief, every field optional; a field the user's text doesn't give is left out. */
function checkBrief(brief, bad) {
  if (!isObj(brief)) return bad('brief', `is ${show(brief)}; it is the parsed brief, an object of the optional fields ${BRIEF_FIELDS.join(', ')} ({} for "surprise me", C-51)`);
  const text = (v) => typeof v === 'string' && v.trim() !== '';
  for (const [k, v] of Object.entries(brief)) {
    if (!BRIEF_FIELDS.includes(k)) bad(`brief.${k}`, `isn't a brief field; the brief holds ${BRIEF_FIELDS.join(', ')} (C-51)`);
    else if (k === 'playstyle') {
      if (!Array.isArray(v) || v.length === 0 || !v.every(text)) bad('brief.playstyle', `is ${show(v)}; it lists the playstyle tags (${PLAYSTYLE_TAGS.join(', ')}) and any free text, as strings`);
    } else if (k === 'budget') {
      if (!(v === 'budget' || v === 'non-budget' || (isNum(v) && v > 0))) bad('brief.budget', `is ${show(v)}; "budget", "non-budget" or a figure in divines (C-51)`);
    } else if (!text(v)) bad(`brief.${k}`, `is ${show(v)}; a field the brief gives is text, and one it doesn't give is left out`);
  }
}

/**
 * Schema 3's gate answers (D-287, D-288, D-323): the answer recorded at each gate, and the test-config answer
 * (`answers.brainstorm`, `answers.verification`, `answers.final`, `answers.escalation`, `answers.unsavedBuild`)
 * a pre-supplied entry's `rule` records exactly as written.
 */
const IDS = (n) => `${CARD_ID}(?:,${CARD_ID}){0,${n - 1}}`;
const GATE_ANSWERS = {
  brainstorm: new RegExp(`^(?:pick:${IDS(3)}|more|stop)$`),
  verification: new RegExp(`^(?:pick:${CARD_ID}|verify:${IDS(3)}|more|stop)$`),
  final: /^.+$/s,
  'unsaved-build': /^(?:proceed|stop)$/,
  escalation: /^(?:accept|retry:.+|verification|stop)$/s,
};
const GATE_RULES = {
  brainstorm: new RegExp(`^(?:pick:${IDS(3)}|first-n:[1-3]|more|stop)$`),
  verification: new RegExp(`^(?:first-viable|pick:${CARD_ID}|verify:${IDS(3)}|more|stop)$`),
  final: /^(?:accept|not-accept|revise:.+)$/s,
  'unsaved-build': /^(?:proceed|stop)$/,
  escalation: /^(?:accept|retry:.+|verification|stop)$/s,
};
/** What each gate's answers look like, for the messages. */
const ANSWER_FORMS = {
  brainstorm: 'pick:<id>[,<id>…] (1–3 cards), more or stop',
  verification: 'pick:<id> (finalize one card), verify:<id>[,<id>…] (1–3 cards), more or stop',
  final: 'accept, revise:<text> or the user\'s note',
  'unsaved-build': 'proceed or stop',
  escalation: 'accept, retry:<guidance>, verification or stop',
};

/** A schema-3 checkpoint entry's answer and rule (D-288, D-323; checkpoints.md's pre-supplied answers). */
function checkGateAnswer(c, at, bad) {
  const gate = c.checkpoint;
  if (!Object.prototype.hasOwnProperty.call(GATE_ANSWERS, gate) || typeof c.answer !== 'string') return;
  if (gate === 'escalation' && c.answer === 'checkpoint-1') {
    bad(at, 'answers "checkpoint-1", which schema 3 retires: going back to the verification gate is "verification" (D-289)');
  } else if (!GATE_ANSWERS[gate].test(c.answer)) bad(at, `answers ${show(c.answer)}; the ${gate} ${['unsaved-build', 'escalation'].includes(gate) ? 'question' : 'gate'}'s answer is ${ANSWER_FORMS[gate]} (D-287, D-289)`);
  const ids = /^(?:pick|verify):(.+)$/.exec(c.answer)?.[1]?.split(',') ?? [];
  if (new Set(ids).size !== ids.length) bad(at, `answers ${show(c.answer)}, which names a card twice`);
  if (typeof c.rule !== 'string' || c.rule.trim() === '') return;
  // D-323: the test config's keys and answers are schema 3's; checkpoint1, checkpoint2 and checkpoint-1 are retired.
  if (/checkpoint-?[12]/.test(c.rule)) bad(at, `has rule ${show(c.rule)}, which names a retired test-config key or answer (checkpoint1, checkpoint2, checkpoint-1); schema 3's are answers.brainstorm, answers.verification, answers.final and the escalation answer "verification" (D-323)`);
  if (c.answeredBy === 'default') {
    if (c.answer !== 'stop') bad(at, `is answered by default ${show(c.answer)}; with no test-config answer left, the default is "stop" (§11.2)`);
    return;
  }
  if (c.answeredBy !== 'pre-supplied') return;
  if (!GATE_RULES[gate].test(c.rule)) {
    bad(at, `has rule ${show(c.rule)}, which isn't an answers.${gate === 'unsaved-build' ? 'unsavedBuild' : gate} value of the test config (checkpoints.md)`);
    return;
  }
  // The answer is the rule as written, or what first-n:<n> and first-viable resolved to.
  const n = /^first-n:([1-3])$/.exec(c.rule)?.[1];
  const resolved = n !== undefined ? c.answer === 'stop' || (/^pick:/.test(c.answer) && ids.length <= Number(n))
    : c.rule === 'first-viable' ? c.answer === 'stop' || new RegExp(`^pick:${CARD_ID}$`).test(c.answer)
      : c.answer === c.rule;
  if (!resolved) bad(at, `answers ${show(c.answer)}, but its rule ${show(c.rule)} resolves to ${n !== undefined ? `pick: with at most ${n} card(s), or stop` : c.rule === 'first-viable' ? 'pick:<one card>, or stop' : show(c.rule)} (checkpoints.md)`);
}

function checkRunLog(log, fail, schema) {
  const v3 = schema !== 2;
  for (const k of RUN_LOG_FIELDS[v3 ? 3 : 2]) if (!(k in log)) fail('run-log', `run-log.json has no ${k} (§6)`);
  const bad = (field, why) => fail('run-log', `run-log.json ${field}: ${why}`);
  if ('schemaVersion' in log && !SCHEMA_VERSIONS.includes(log.schemaVersion)) {
    bad('schemaVersion', `is ${show(log.schemaVersion)}; it is 3, or 2 for a run recorded before amendment 3 (D-289, D-326)`);
  }
  const roll = log.roll;
  if (!v3) {
    if ('roll' in log && !(isObj(roll) && typeof roll.ascendancy === 'string' && typeof roll.skill === 'string')) bad('roll', 'is {ascendancy, skill}');
    if (isObj(roll) && 'slug' in log && log.slug !== slugOf(roll.ascendancy ?? '', roll.skill ?? '')) {
      bad('slug', `is ${show(log.slug)}; the roll's slug is "${slugOf(roll.ascendancy ?? '', roll.skill ?? '')}" (§2)`);
    }
  } else {
    if ('brief' in log) checkBrief(log.brief, bad);
    if ('slug' in log && isObj(log.brief) && log.slug !== slugOfBrief(log.brief)) {
      bad('slug', `is ${show(log.slug)}; the brief's slug is "${slugOfBrief(log.brief)}": the slug comes from the brief, and the card finalized later goes in roll, not in the folder name (§2, D-285)`);
    }
    // D-286: the roll is the finalized card's identity, null until the verification gate's pick.
    const picks = list(log.checkpoints).filter((c) => c.checkpoint === 'verification' && typeof c.answer === 'string' && c.answer.startsWith('pick:'));
    if ('roll' in log && roll !== null && !(isObj(roll) && ['className', 'ascendancy', 'skill'].every((k) => typeof roll[k] === 'string' && roll[k] !== ''))) {
      bad('roll', `is ${show(roll)}; it is null until the verification gate's pick, then the finalized card's identity {className, ascendancy, skill} (D-286, D-289)`);
    } else if (isObj(roll) && picks.length === 0) {
      bad('roll', `is ${show(roll)}, set before the verification gate finalized any card (no verification answer pick:<id>); the roll stays null until that pick (D-286, D-289)`);
    } else if (roll === null && picks.length > 0) {
      bad('roll', `is null, but the verification gate finalized ${picks[picks.length - 1].answer.slice(5)}; that card's identity becomes the run's roll (D-286)`);
    }
    // A card's identity never contradicts the brief's fixed pieces (R1a-assemble deals no such card).
    if (isObj(roll) && isObj(log.brief)) {
      for (const k of ['ascendancy', 'skill']) {
        if (typeof log.brief[k] === 'string' && typeof roll[k] === 'string' && norm(roll[k]) !== norm(log.brief[k])) bad('roll', `names ${k} ${show(roll[k])}, but the brief fixes ${show(log.brief[k])}; no card contradicting the brief's ${k} is dealt (R1a-assemble, D-285)`);
      }
    }
  }
  if ('runFolder' in log) {
    const rf = typeof log.runFolder === 'string' ? log.runFolder.replace(/\\/g, '/').replace(/\/+$/, '') : '';
    const segs = rf.split('/');
    if (!(path.isAbsolute(log.runFolder ?? '') || /^[A-Za-z]:\//.test(rf)) || segs[segs.length - 2] !== log.slug || !/^\d{4}-\d{2}-\d{2}-[1-9]\d*$/.test(segs[segs.length - 1] ?? '')) {
      bad('runFolder', `${show(log.runFolder)} isn't an absolute <root>/<slug>/<YYYY-MM-DD>-<n> path (C-34)`);
    }
  }
  const oneOf = (field, allowed) => {
    if (field in log && !allowed.includes(log[field])) bad(field, `is ${show(log[field])}; one of ${allowed.join(', ')}`);
  };
  oneOf('mode', ['offline', 'online']);
  oneOf('testConfig', ['none', 'accepted', 'refused']);
  oneOf('status', STATUSES);
  if (log.testConfig === 'accepted' && log.mode !== 'offline') bad('testConfig', 'is "accepted" in an online run; a test config is accepted only with --offline (§11.2)');

  const arr = (field) => {
    if (!(field in log)) return [];
    if (!Array.isArray(log[field])) {
      bad(field, 'is a list');
      return [];
    }
    return log[field];
  };
  const ID = new RegExp(`^${idSource(schema)}$`);
  arr('stages').forEach((s, i) => {
    const at = `stages[${i}]`;
    if (!isObj(s)) return bad(at, 'is an object');
    const known = Object.keys(STAGE_OUTCOMES).filter((x) => v3 || x !== 'R1a-assemble');
    if (!known.includes(s.stage)) return bad(at, `stage ${show(s.stage)} isn't one of ${known.join(', ')}`);
    if (ROUND_STAGES.includes(s.stage) ? s.concept !== undefined && s.concept !== null : !ID.test(s.concept ?? '')) {
      bad(at, ROUND_STAGES.includes(s.stage) ? `a ${s.stage} entry concerns no one ${v3 ? 'card' : 'concept'}` : `a ${s.stage} entry names its ${v3 ? 'card' : 'concept'}, ${idForm(schema)}`);
    }
    // D-339: a short brainstorm round's reason, on its R1a-assemble entry.
    if ('shortReason' in s && (s.stage !== 'R1a-assemble' || typeof s.shortReason !== 'string' || s.shortReason.trim() === '')) {
      bad(at, `has shortReason ${show(s.shortReason)}; only an R1a-assemble entry carries one, the reason its return gave for a short round (D-339)`);
    }
    // D-338: each R1b attempt's probe count, from its return's "probes <n>", so D-292's cap can be audited.
    if ('probes' in s && s.stage !== 'R1b') bad(at, `has probes, but only R1b writes probe variants (D-338)`);
    if (v3 && s.stage === 'R1b' && (s.outcome !== 'missing' || 'probes' in s)) {
      if (!isInt(s.probes)) bad(at, `probes is ${show(s.probes)}; an R1b entry logs the probe variants its attempt wrote, its return's "probes <n>" (D-338)`);
      else if (s.probes > PROBE_CAP) fail('probes', `run-log.json ${at}: R1b ${s.concept} logs ${s.probes} probes; a card has at most ${PROBE_CAP} (D-292)`);
      else if (s.outcome === 'fail' && s.probes > 0) fail('probes', `run-log.json ${at}: R1b ${s.concept} failed, but logs ${s.probes} probe(s); probes run only after the skeleton's last compile succeeded (§7.7)`);
    }
    if (!isInt(s.attempt, 1)) bad(at, 'attempt is an integer from 1');
    if (!OUTCOMES.includes(s.outcome)) bad(at, `outcome ${show(s.outcome)} isn't one of ${OUTCOMES.join(', ')}`);
    else if (s.outcome === 'escalated' && !['D1-gate', 'D2-gate'].includes(s.stage)) {
      fail('escalation', `run-log.json ${at}: ${s.stage} is logged escalated; only the D1 and D2 gates escalate, and verification never does (S2)`);
    } else if (s.outcome !== 'missing' && !STAGE_OUTCOMES[s.stage].includes(s.outcome)) {
      bad(at, `a ${s.stage} entry's outcome is one of ${[...STAGE_OUTCOMES[s.stage], 'missing'].join(', ')}, not ${show(s.outcome)}`);
    }
    if ('priceOutcomes' in s) {
      const p = s.priceOutcomes;
      if (!PRICING_STAGES.includes(s.stage)) bad(at, `has priceOutcomes, but ${s.stage} doesn't price (pricing.md)`);
      if (!isObj(p) || !Object.entries(p).every(([k, n]) => PRICE_OUTCOMES.includes(k) && isInt(n))) {
        bad(`${at}.priceOutcomes`, `is {<outcome>: <count>}, each outcome ok, error or a [trade:<kind>] kind (D-218)`);
      } else {
        const calls = Object.values(p).reduce((a, b) => a + b, 0);
        if (log.mode === 'offline' && calls > 0) fail('offline-prices', `run-log.json ${at}: an offline run made ${calls} price call(s); offline, no step calls a trade or poe.ninja tool (§11.1)`);
        if ((p.rate_limited ?? 0) > 0 || (p.locked_out ?? 0) > 0) {
          fail('nfr-22', `run-log.json ${at}: pricing hit ${p.rate_limited ?? 0} rate_limited and ${p.locked_out ?? 0} locked_out outcome(s); NFR-22 wants zero of each`);
        }
      }
    }
  });
  const visits = new Map();
  arr('checkpoints').forEach((c, i) => {
    const at = `checkpoints[${i}]`;
    if (!isObj(c)) return bad(at, 'is an object');
    if (!CHECKPOINTS[v3 ? 3 : 2].includes(c.checkpoint)) {
      bad(at, `checkpoint ${show(c.checkpoint)} isn't ${v3 ? '"brainstorm", "verification", "final", "unsaved-build" or "escalation" (D-289; schema 2\'s checkpoints 1 and 2 are the verification and final gates)' : '1, 2, "unsaved-build" or "escalation"'}`);
    }
    if (!isInt(c.visit, 1)) bad(at, 'visit is an integer from 1');
    else if (v3) {
      // visit counts that gate's or question's visits from 1, in log order.
      const want = (visits.get(c.checkpoint) ?? 0) + 1;
      visits.set(c.checkpoint, want);
      if (c.visit !== want) bad(at, `is visit ${c.visit} of ${show(c.checkpoint)}, but it is that checkpoint's entry ${want}; visit counts its visits from 1`);
    }
    if (v3) checkGateAnswer(c, at, bad);
    if (typeof c.answer !== 'string' || c.answer.trim() === '') bad(at, 'has its answer');
    if (!['user', 'pre-supplied', 'default'].includes(c.answeredBy)) bad(at, 'answeredBy is "user", "pre-supplied" or "default"');
    if (c.answeredBy !== 'user' && log.testConfig !== 'accepted') {
      bad(at, `answeredBy is ${show(c.answeredBy)} without an accepted test config; outside offline test mode the user answers (A-28, D-157)`);
    }
    // A pre-supplied or default answer records the rule behind it (the test config's answer as written, or
    // the default that applied), so the guide can say how its concept was picked; a user's answer has none.
    if (['pre-supplied', 'default'].includes(c.answeredBy) && !(typeof c.rule === 'string' && c.rule.trim() !== '')) {
      bad(at, `is answered ${show(c.answeredBy)} with no rule; it records the test config's answer as written (first-viable) or the default that applied`);
    }
    if (c.answeredBy === 'user' && c.rule !== undefined && c.rule !== null) bad(at, "has a rule, but the user answered; only a pre-supplied or default answer has one");
  });
  arr('escalations').forEach((e, i) => {
    const at = `escalations[${i}]`;
    if (!isObj(e)) return bad(at, 'is {stage, concept, verdict, choice, guidance?}');
    if (!['D1-gate', 'D2-gate'].includes(e.stage)) fail('escalation', `run-log.json ${at}: stage is ${show(e.stage)}; only the D1 and D2 gates escalate (S2)`);
    if (!ID.test(e.concept ?? '')) bad(at, `concept is ${idForm(schema)}`);
    if (typeof e.verdict !== 'string') bad(at, 'verdict is the path of the escalated attempt\'s verdict file; the log copies no findings (§6)');
    if ('findings' in e) bad(at, 'copies findings; the verdict file holds them, and verdict names it (§6)');
    if (v3 && e.choice === 'checkpoint-1') {
      fail('escalation', `run-log.json ${at}: choice is "checkpoint-1", which schema 3 retires: going back to the verification gate is the choice "verification" (D-289)`);
    } else if (!CHOICES[v3 ? 3 : 2].includes(e.choice)) bad(at, `choice is ${show(e.choice)}; one of ${CHOICES[v3 ? 3 : 2].join(', ')} (D-236${v3 ? ', D-289' : ''})`);
    if (e.guidance !== undefined && e.choice !== 'retry') bad(at, 'has guidance, which goes only with choice "retry"');
  });
  arr('faults').forEach((f, i) => {
    const t = isObj(f) ? f.target : undefined;
    const targetOk = isObj(t) && (t.concepts === 'all' || (Array.isArray(t.concepts) && t.concepts.every((c) => ID.test(c)))) && (t.persistent === undefined || typeof t.persistent === 'boolean');
    if (!isObj(f) || !Object.prototype.hasOwnProperty.call(FAULT_STAGE, f.id) || !targetOk || !isInt(f.applied)) {
      bad(`faults[${i}]`, `is {id: FI-1 | FI-2 | FI-3, target: {concepts: "all" | [<${v3 ? 'card' : 'concept'} id>, …], persistent?}, applied, observed}, each id ${idForm(schema)}`);
    }
  });
  if (Array.isArray(log.faults) && log.faults.length > 0 && log.testConfig !== 'accepted') bad('faults', 'fault directives apply only in offline test mode (§11.3)');
  if ('outputs' in log) {
    const o = log.outputs;
    if (!isObj(o) || !['plan', 'record', 'dossier', 'guide', 'pobFile'].every((k) => k in o)) {
      bad('outputs', 'is {plan, record, dossier, guide, pobFile}');
    }
    // D-260: the import code's one home is compile-record.json (and the guide W1 copies it into).
    if (isObj(o) && 'importCode' in o) bad('outputs', "has importCode; the import code's one home is compile-record.json, which outputs.record names (D-260)");
  }
}

// ---------------------------------------------------------------------------------------------------
// The control flow (SKILL.md's step list; amendment 1 §3, S6; the accepted cost of S1)
// ---------------------------------------------------------------------------------------------------

/** Whether a fault target names `concept`. */
const targets = (target, concept) => isObj(target) && (target.concepts === 'all' || (Array.isArray(target.concepts) && target.concepts.includes(concept)));
/** A step's family for the order rules: a V4 lens's full pass is `V4`, its re-check `V4r`. */
const familyOf = (s) => (/^V4-\w+-recheck$/.test(s.stage) ? 'V4r' : /^V4-/.test(s.stage) ? 'V4' : s.stage);
const lensOf = (s) => (/^V4-(ledger|sources|prose)/.exec(String(s.stage)) ?? [])[1];
const sameStep = (a, b) => a.stage === b.stage && (a.concept ?? null) === (b.concept ?? null);
const describe = (s) => `${s.stage}${s.concept ? ` ${s.concept}` : ''} attempt ${s.attempt}`;

/**
 * The run's control flow, read from `stages[]` with `checkpoints[]` and `escalations[]`. It stands in for the
 * workflow harness tests amendment 1 deleted (the accepted cost of S1):
 *  - `order`: the steps run in SKILL.md's order, each design through D1, its gate, D2, its gate and W1 for one
 *    card; attempts number every call; a missing return re-runs once, and a second miss ends the run. In a
 *    schema-3 log each gate visit has its answer, in order, and the next step is the one it leads to (D-287):
 *    the brainstorm gate's `pick:<ids>` a verification round of those cards, in that order; the verification
 *    gate's `pick:<id>` that card's design, `verify:<ids>` a verification round without a brainstorm; `more` a
 *    brainstorm round; `stop` the end of the run.
 *  - `caps`: per brainstorm round at most 3 R1a researchers and one R1a-assemble, per verification round at
 *    most 3 cards compiled (NFR-23, D-287; a schema-2 log's research round carries at most 3 concepts, D-235);
 *    R1b at most 3 counted attempts, none after a terminal `not-a-skill` failure (D-334); each gate at most 2
 *    counted retries, then an escalation (S6: an attempt-1 fault's failure is free, a persistent fault's
 *    attempts count; a guided retry and an accepted re-run escalate again on failure).
 *  - `verification`: one full pass of the three lenses per cycle, at most one re-check after the fix round, of
 *    all three lenses if and only if a gate re-ran in the fix round (an owner recompiled), else of the lenses
 *    that raised a finding and the sources lens, which always re-checks the changed locations (D-264); a
 *    claims-only owner (`claims-edited`) runs only before any gate of its fix round or revision, and no gate
 *    follows it; a new cycle only for a revision the final gate asked for.
 *  - `escalation`: only gates escalate, each escalation logged once, in order, and the choice followed.
 *  - `routing`: each gate attempt's logged outcome is the one its verdict file routes to (gates.md).
 * `ctx` gives the log's schema, a gate attempt's verdict file, the stage each fault breaks, whether an R1b
 * failure is terminal and whether a card exists; findings accepted at an escalation cover the gate attempts
 * after it.
 */
function checkFlow(log, fail, ctx) {
  if (!Array.isArray(log.stages) || !log.stages.every(isObj)) return;
  const stages = log.stages;
  const escalations = list(log.escalations);
  const checkpoints = list(log.checkpoints);
  const faults = list(log.faults);
  const at = (i) => `run-log.json stages[${i}] (${describe(stages[i])})`;
  const v3 = ctx.schema !== 2;
  /** The pick and the guide's gates: schema 3's verification and final gates were schema 2's checkpoints 1 and 2. */
  const G = v3 ? { pick: 'the verification gate', final: 'the final gate', finalKey: 'final' } : { pick: 'checkpoint 1', final: 'checkpoint 2', finalKey: 2 };

  // Attempts number every call of a (stage, concept), from 1 (run-log.md).
  const counts = new Map();
  stages.forEach((s, i) => {
    if (ROUND_STAGES.includes(s.stage)) return;
    const key = `${s.stage}|${s.concept}`;
    const want = (counts.get(key) ?? 0) + 1;
    counts.set(key, want);
    if (s.attempt !== want) fail('order', `${at(i)}: is call ${want} of ${s.stage} for ${s.concept}, so its attempt is ${want}; every call counts, re-runs included`);
  });

  // A missing return re-runs once, uncounted, within its block (the run of entries of its family: parallel
  // researchers or lenses finish in any order); a second miss of the step ends the run stopped.
  const blockOf = (i) => {
    let start = i;
    while (start > 0 && familyOf(stages[start - 1]) === familyOf(stages[i])) start -= 1;
    let end = i + 1;
    while (end < stages.length && familyOf(stages[end]) === familyOf(stages[i])) end += 1;
    return { start, end };
  };
  stages.forEach((s, i) => {
    if (s.outcome !== 'missing') return;
    const { start, end } = blockOf(i);
    const before = stages.slice(start, i).filter((x) => sameStep(x, s)).pop();
    const second = before !== undefined && before.outcome === 'missing';
    const rerun = stages.slice(i + 1, end).findIndex((x) => sameStep(x, s));
    if (second) {
      if (rerun >= 0) fail('order', `${at(i)}: is a second missing return of the step, which still re-ran; a second miss ends the run stopped`);
      else if (end < stages.length || log.status !== 'stopped') fail('order', `${at(i)}: is a second missing return of the step; the run then ends stopped, naming the step, but it ${end < stages.length ? 'goes on' : `ends ${show(log.status)}`}`);
    } else if (rerun < 0) {
      fail('order', `${at(i)}: returned without its file and never re-ran; a missing return re-runs once, uncounted`);
    }
  });

  // The findings accepted so far: an acceptance covers the gate attempts after its escalation, not before.
  const acceptedSoFar = [];
  const coveredSoFar = (f) => acceptedSoFar.some((a) => a.stage === (f.stage ?? null) && a.part === f.part && a.code === f.code);
  // S6: an attempt failed by a fault directive that applies to attempt 1 only counts against no cap, when its
  // verdict says the fault was applied and every failing finding is on the stage the fault breaks.
  const freeFault = (s) => {
    if (s.attempt !== 1 || s.outcome !== 'fail') return false;
    const rep = ctx.verdict(s);
    const failing = failingFindings(rep, s.stage, coveredSoFar);
    return faults.some(
      (f) =>
        ['FI-1', 'FI-2'].includes(f.id) && FAULT_STAGE[f.id] === s.stage && f.target?.persistent !== true && targets(f.target, s.concept) &&
        list(rep?.faultsApplied).some((a) => a.id === f.id) && failing.length > 0 && failing.every((x) => x.stage === ctx.faultedStage(f.id, s.concept)),
    );
  };
  // FI-3 forces the D1 gate's attempt (attempt 1 unless persistent) to infeasible.
  const forcedByFault = (s) => faults.some((f) => f.id === 'FI-3' && targets(f.target, s.concept) && (f.target?.persistent === true || s.attempt === 1));

  // Schema 2: the design picks and the research rounds are read from checkpoint 1's answers (D-235, D-270).
  const picks = v3 ? [] : checkpoints.filter((c) => c.checkpoint === 1 && typeof c.answer === 'string' && c.answer.startsWith('pick:')).map((c) => c.answer.slice(5));
  const mores = checkpoints.filter((c) => c.checkpoint === 1 && c.answer === 'more').length;
  const revises = checkpoints.filter((c) => c.checkpoint === G.finalKey && typeof c.answer === 'string' && c.answer.startsWith('revise')).length;
  // Schema 3: each visit of the brainstorm and verification gates takes that gate's next answer, in order (D-289).
  const answers = { brainstorm: checkpoints.filter((c) => c.checkpoint === 'brainstorm'), verification: checkpoints.filter((c) => c.checkpoint === 'verification') };
  const GATE_NAME = { brainstorm: 'the brainstorm gate', verification: 'the verification gate' };

  const steps = stages.map((s, i) => ({ s, i })).filter(({ s }) => s.outcome !== 'missing');
  let prev = null;
  let esc = 0;
  let lastEscalation = null;
  let round = null; // schema 2: a research round {n, r1a, concepts}; schema 3: a brainstorm round {n, r1a, assembles}
  let rounds = 0;
  let vround = null; // schema 3: the open verification round {n, gate, expected, cards}
  let vrounds = 0;
  let finalized = null; // schema 3: the card the verification gate's last pick finalized, whose design comes next
  const r1bSeen = new Map(); // concept -> {round, counted, passed, terminal}
  /** Whether a card's R1b failed with retries left: its next attempt runs before any other card's, or the assembly. */
  const retriesLeft = (c) => {
    const r = r1bSeen.get(c);
    return r !== undefined && !r.passed && !r.terminal && r.counted < R1B_ATTEMPTS;
  };
  const chains = new Map(); // `${gate}|${concept}` -> {counted, guided}
  let design = null; // {concept, verified}
  let designs = 0;
  let cycle = null; // {full: 'none' | 'open' | 'done', lenses: Set, failed: Set, fix, recheck: 'none' | 'open' | 'done', rechecked: Set}
  let revisions = 0;
  /** Schema 3: the gate a step ends at, when the step after it doesn't continue it (D-287). */
  const gateAfter = (p, next) => {
    if (!v3 || !p) return null;
    if (p.stage === 'R1a-assemble' && next?.stage !== 'R1a-assemble') return 'brainstorm';
    if (p.stage === 'R1b-assemble') return 'verification';
    if (p.stage === 'D1-gate' && p.outcome === 'infeasible') return 'verification';
    if (p.outcome === 'escalated' && lastEscalation?.choice === 'verification') return 'verification';
    return null;
  };

  const chain = (gate, concept) => {
    const key = `${gate}|${concept}`;
    if (!chains.has(key)) chains.set(key, { counted: 0, guided: false });
    return chains.get(key);
  };
  const freshChain = (gate, concept) => chains.set(`${gate}|${concept}`, { counted: 0, guided: false });
  const closeBlocks = (i) => {
    if (cycle?.full === 'open') {
      cycle.full = 'done';
      const missing = LENSES.filter((l) => !cycle.lenses.has(l));
      if (missing.length > 0) fail('verification', `run-log.json stages[${i}]: the full V4 pass before it ran without ${missing.join(', ')}; it runs all three lenses, with no sampling (S2)`);
    }
    if (cycle?.recheck === 'open') {
      cycle.recheck = 'done';
      const missing = LENSES.filter((l) => !cycle.rechecked.has(l));
      if (cycle.fixGate && missing.length > 0) {
        fail('verification', `run-log.json stages[${i}]: a gate re-ran in the fix round (an owner recompiled), so the re-check before it is a full pass of all three lenses over the new plan and guide, but it ran without ${missing.join(', ')} (D-264)`);
      }
      // A claims-only round: each lens that raised a finding re-checks it, and the sources lens always re-checks
      // the changed locations, whose citations may have changed (D-264).
      const wanted = LENSES.filter((l) => cycle.failed.has(l) || l === 'sources');
      const left = wanted.filter((l) => !cycle.rechecked.has(l));
      if (!cycle.fixGate && left.length > 0) {
        fail('verification', `run-log.json stages[${i}]: the claims-only fix round's re-check before it ran without ${left.join(', ')}; each lens that raised a finding re-checks it, and the sources lens always re-checks the changed locations (D-264)`);
      }
    }
  };
  /** A fresh design of `concept`, from the pick that finalized it (schema 2: checkpoint 1's next pick). */
  const freshDesign = (s, i) => {
    designs += 1;
    if (v3) {
      if (finalized === null) fail('order', `${at(i)}: starts a design, but no verification gate answer pick:<id> finalized a card for it (D-287)`);
      else if (finalized !== s.concept) fail('order', `${at(i)}: designs ${s.concept}, but the verification gate finalized ${finalized}`);
      finalized = null;
    } else {
      const pick = picks[designs - 1];
      if (pick === undefined) fail('order', `${at(i)}: starts design ${designs}, but ${G.pick} was answered pick:<id> only ${picks.length} time(s)`);
      else if (pick !== s.concept) fail('order', `${at(i)}: designs ${s.concept}, but ${G.pick}'s pick was ${pick}`);
    }
    design = { concept: s.concept, verified: false };
    cycle = null;
    freshChain('D1-gate', s.concept);
  };
  /**
   * Schema 3: the step after a gate visit follows that visit's answer, the gate's next one in checkpoints[]
   * (D-287, D-289). `pick:<ids>` (brainstorm) and `verify:<ids>` open a verification round of those cards;
   * `pick:<id>` (verification) finalizes a card verified in the run, whose design comes next; `more` opens a
   * brainstorm round; `stop` ends the run.
   */
  const followGate = (kind, s, i) => {
    const illegal = (why) => fail('order', `${at(i)}: ${why}`);
    const c = answers[kind].shift();
    const name = GATE_NAME[kind];
    if (c === undefined) return illegal(`follows a visit of ${name}, but checkpoints[] records no ${kind} answer for it; each visit records its answer (D-289)`);
    const a = String(c.answer);
    const m = /^(pick|verify):(.+)$/.exec(a);
    if (a === 'stop') return illegal(`follows ${name} answered "stop", which ends the run stopped`);
    if (a === 'more') {
      if (s.stage !== 'R1a') illegal(`follows ${name} answered "more", which starts a brainstorm round (R1a), not ${s.stage}`);
      return undefined;
    }
    if (m && ((kind === 'brainstorm' && m[1] === 'pick') || (kind === 'verification' && m[1] === 'verify'))) {
      const ids = m[2].split(',');
      for (const id of ids) if (!ctx.cardExists(id)) fail('deck', `run-log.json checkpoints: ${name} answered ${show(a)}, but ${id} is no card of the run (cards/${id}.md, C-52)`);
      if (s.stage !== 'R1b') illegal(`follows ${name} answered ${show(a)}, which starts a verification round (R1b), not ${s.stage}`);
      vrounds += 1;
      vround = { n: vrounds, gate: `${name}'s ${show(a)}`, expected: ids, cards: [] };
      return undefined;
    }
    if (m && kind === 'verification' && m[1] === 'pick') {
      const id = m[2];
      const r = r1bSeen.get(id);
      if (r === undefined) illegal(`follows the verification gate answered ${show(a)}, but no R1b verified ${id} in the run; the gate finalizes a verified card (D-287)`);
      else if (r.terminal) illegal(`follows the verification gate answered ${show(a)}, but ${id}'s damage source isn't a skill (its R1b ended not-a-skill), so it can't be finalized yet (D-303, D-334)`);
      if (s.stage !== 'D1') illegal(`follows the verification gate answered ${show(a)}, which finalizes ${id}: its design (D1) comes next, not ${s.stage}`);
      finalized = id;
      return undefined;
    }
    return illegal(`follows ${name} answered ${show(a)}, which isn't an answer of that gate`);
  };
  /** A producer after the V4 checks: the fix round when the full pass found something, else a revision. */
  const afterVerification = (s, i, pf) => {
    if (cycle === null || design === null || s.concept !== design.concept) {
      fail('order', `${at(i)}: follows the V4 checks of another design`);
      return;
    }
    if (pf === 'V4' && cycle.failed.size > 0 && !cycle.fix) cycle.fix = true;
    else {
      revisions += 1;
      cycle = { full: 'none', lenses: new Set(), failed: new Set(), fix: false, recheck: 'none', rechecked: new Set() };
    }
    design.verified = true;
  };

  for (const { s, i } of steps) {
    const f = familyOf(s);
    const pf = prev ? familyOf(prev.s) : 'start';
    const p = prev?.s;
    const same = p !== undefined && p.concept === s.concept;
    if (f !== pf) closeBlocks(i);
    const illegal = (why) => fail('order', `${at(i)}: ${why}`);
    // After the V4 checks: a full pass or a re-check.
    const postVerify = pf === 'V4' || pf === 'V4r';

    // What the previous step's outcome allows next: in a schema-3 log, a gate's answer (D-287).
    const gate = gateAfter(p, s);
    if (gate !== null) {
      followGate(gate, s, i);
    } else if (p && p.outcome === 'escalated') {
      const e = lastEscalation;
      const choice = e?.choice;
      const ok =
        choice === 'accept' ? same && (p.stage === 'D1-gate' ? s.stage === 'D2' || (design?.verified && s.stage === 'D2-gate') : s.stage === 'D2-gate')
          : choice === 'retry' ? same && s.stage === (p.stage === 'D1-gate' ? 'D1' : 'D2')
            : choice === 'checkpoint-1' && !v3 ? s.stage === 'D1' || s.stage === 'R1a'
              : false;
      if (!ok) illegal(`follows ${p.stage} ${p.concept}'s escalation answered ${show(choice)}, which ${choice === 'stop' ? 'ends the run escalated' : `doesn't lead to ${s.stage}`} (D-236)`);
    } else {
      // The research steps: schema 3's brainstorm round ends at R1a-assemble and the verification round at
      // R1b-assemble, each before a gate (above); schema 2's research round went from R1a to R1b-assemble.
      const research = v3 ? {
        start: ['R1a'],
        R1a: ['R1a', 'R1a-assemble'],
        // A second assembly in one brainstorm round: the caps name it (NFR-23).
        'R1a-assemble': ['R1a-assemble'],
        R1b: ['R1b', 'R1b-assemble'],
      } : {
        start: ['R1a'],
        R1a: ['R1a', 'R1b', 'R1b-assemble'],
        R1b: ['R1b', 'R1b-assemble'],
        'R1b-assemble': ['R1a', 'D1'],
      };
      const allowed = {
        ...research,
        // D-264: a claims-only D1 runs no gate; D2 (a claims-only one, or one that recompiles) or W1 follows.
        D1: p?.outcome === CLAIMS_EDITED ? ['D2', 'W1'] : ['D1-gate'],
        'D1-gate': p?.outcome === 'pass' ? ['D2', ...(design?.verified ? ['D2-gate'] : [])] : p?.outcome === 'fail' ? ['D1'] : ['D1', 'R1a'],
        D2: p?.outcome === CLAIMS_EDITED ? ['W1'] : ['D2-gate'],
        'D2-gate': p?.outcome === 'pass' ? ['W1'] : ['D2'],
        W1: cycle?.fix && cycle.full === 'done' ? ['V4r'] : ['V4'],
        V4: ['V4', 'D1', 'D2', 'W1'],
        V4r: ['V4r', 'D1', 'D2', 'W1'],
      }[pf] ?? [];
      const want = f === 'V4' || f === 'V4r' ? f : s.stage;
      if (!allowed.includes(want)) illegal(`can't follow ${p ? describe(p) : 'the start'} (outcome ${show(p?.outcome)}); SKILL.md's step list allows ${allowed.join(', ') || 'nothing'} next`);
      const keepsConcept = ['D1', 'D1-gate', 'D2', 'D2-gate', 'W1'].includes(pf) || ((pf === 'V4' || pf === 'V4r') && f !== 'R1a');
      if (keepsConcept && p && !ROUND_STAGES.includes(s.stage) && !(pf === 'D1-gate' && p.outcome === 'infeasible') && !same) {
        illegal(`is about ${s.concept}, but the design before it is ${p.concept}'s; a design runs through D1, its gate, D2, its gate, W1 and V4 for one ${v3 ? 'card' : 'concept'}`);
      }
    }
    // D-264: a claims-only owner edits in place before any gate of its fix round or revision: right after the V4
    // checks, or (D2) right after a claims-only D1. Once a gate re-ran, the final record is gone, so D2 runs its gate.
    if (s.outcome === CLAIMS_EDITED && !(postVerify || (s.stage === 'D2' && pf === 'D1' && p?.outcome === CLAIMS_EDITED))) {
      illegal(`edits claims without a compile (${CLAIMS_EDITED}), which an owner does only in the fix round or a revision, before any gate of it re-runs (D-264)`);
    }

    // Brainstorm rounds (schema 3: D-287, NFR-23) or research rounds (schema 2: D-235).
    const roundName = v3 ? 'brainstorm round' : 'research round';
    if (s.stage === 'R1a' && pf !== 'R1a') {
      rounds += 1;
      round = { n: rounds, r1a: 0, assembles: 0, concepts: new Set() };
      if (!v3 && rounds > 1 + mores) illegal(`starts research round ${rounds}, but ${G.pick} was answered "more" only ${mores} time(s); only that answer starts a round (D-235)`);
    }
    if (s.stage === 'R1a' && round) {
      round.r1a += 1;
      if (round.r1a > ROUND_CAP) fail('caps', `${at(i)}: ${roundName} ${round.n} runs ${round.r1a} R1a researchers; at most ${ROUND_CAP} (NFR-23)`);
    }
    if (s.stage === 'R1a-assemble' && round) {
      round.assembles += 1;
      if (round.assembles > 1) fail('caps', `${at(i)}: brainstorm round ${round.n} runs ${round.assembles} R1a-assemble steps; one deals the round's deck (D-287, NFR-23)`);
    }
    if (s.stage === 'R1b') {
      const seen = r1bSeen.get(s.concept);
      if (v3) {
        // Verification rounds (D-287): the picked cards in the order picked, at most 3 compiled per round.
        if (vround === null) illegal(`runs R1b for ${s.concept} outside a verification round; only a gate's pick:<ids> or verify:<ids> opens one`);
        else {
          if (seen && seen.round !== vround.n) illegal(`verifies ${s.concept} again in verification round ${vround.n}; a card is verified once, and "verify other cards" picks cards not verified yet (D-287)`);
          if (!vround.cards.includes(s.concept)) {
            const next = vround.expected[vround.cards.length];
            if (!vround.expected.includes(s.concept)) illegal(`runs R1b for ${s.concept}, which ${vround.gate} didn't pick for verification round ${vround.n}`);
            else if (next !== s.concept) illegal(`verifies ${s.concept} before ${next}; R1b runs the picked cards in the order picked (${vround.expected.join(', ')})`);
            vround.cards.push(s.concept);
            if (vround.cards.length > ROUND_CAP) fail('caps', `${at(i)}: verification round ${vround.n} compiles ${vround.cards.length} cards; at most ${ROUND_CAP} per verification round (D-287, NFR-23)`);
          }
        }
      } else {
        if (seen && round && seen.round !== round.n) illegal(`runs R1b for ${s.concept} again in research round ${round.n}; concept ids are unique across rounds`);
        if (round && !round.concepts.has(s.concept)) {
          round.concepts.add(s.concept);
          if (round.concepts.size > ROUND_CAP) fail('caps', `${at(i)}: research round ${round.n} carries ${round.concepts.size} concepts; at most ${ROUND_CAP} per round (D-235)`);
        }
      }
      const r = seen ?? { round: v3 ? vround?.n : round?.n, counted: 0, passed: false, terminal: false };
      r1bSeen.set(s.concept, r);
      if (r.terminal) illegal(`runs R1b for ${s.concept} again, but its last attempt ended not-a-skill with no compile: its damage source isn't a skill, so no retry can compile it (D-334)`);
      else if (r.passed) illegal(`runs R1b for ${s.concept} after it compiled`);
      else if (r.counted >= R1B_ATTEMPTS) fail('caps', `${at(i)}: is a counted R1b attempt for ${s.concept} after ${r.counted}; R1b allows 2 counted retries, then the ${v3 ? 'card' : 'concept'} is failed (Q2)`);
      if (p && p.stage === 'R1b' && p.outcome === 'fail' && p.concept !== s.concept && retriesLeft(p.concept)) {
        illegal(`R1b ${p.concept} failed with retries left, but the next R1b is ${s.concept}'s; a failed compile re-runs first`);
      }
      if (s.outcome === 'pass') r.passed = true;
      if (ctx.terminal(s)) r.terminal = true;
      if (s.outcome === 'pass' || !freeFault(s)) r.counted += 1;
    }
    if (s.stage === 'R1b-assemble') {
      if (p?.stage === 'R1b' && p.outcome === 'fail' && retriesLeft(p.concept)) illegal(`R1b ${p.concept} failed with retries left, but the round assembles; a failed compile re-runs first`);
      if (v3 && vround !== null) {
        const left = vround.expected.filter((c) => !vround.cards.includes(c));
        if (left.length > 0) illegal(`assembles verification round ${vround.n}, but no R1b ran for ${left.join(', ')}, which ${vround.gate} picked`);
        vround = null;
      }
    }

    // Designs, chains and caps (gates.md; S6).
    if (s.stage === 'D1') {
      if (pf === 'D1-gate' && p.outcome === 'fail' && same) {
        // a counted retry, or a free one after an attempt-1 fault
      } else if (pf === 'D1-gate' && p.outcome === 'escalated' && same && lastEscalation?.choice === 'retry') {
        chain('D1-gate', s.concept).guided = true;
      } else if (postVerify) {
        afterVerification(s, i, pf);
        freshChain('D1-gate', s.concept);
      } else if (s.outcome !== CLAIMS_EDITED) freshDesign(s, i);
    }
    if (s.stage === 'D2') {
      if (pf === 'D2-gate' && p.outcome === 'fail' && same) {
        // a retry
      } else if (pf === 'D2-gate' && p.outcome === 'escalated' && same && lastEscalation?.choice === 'retry') {
        chain('D2-gate', s.concept).guided = true;
      } else {
        if (postVerify) afterVerification(s, i, pf);
        freshChain('D2-gate', s.concept);
      }
    }
    // Flow invariant 3 (D-264): a gate that re-runs in the fix round compiles a new plan and record (an owner
    // recompiled), so the re-check is a full pass of all three lenses; a claims-only round runs no gate, and its
    // re-check stays with the lenses that raised a finding.
    if ((s.stage === 'D1-gate' || s.stage === 'D2-gate') && cycle?.fix && cycle.full === 'done' && cycle.recheck === 'none') cycle.fixGate = true;
    if (s.stage === 'D2-gate' && pf === 'D1-gate') freshChain('D2-gate', s.concept);
    if (s.stage === 'D2-gate' && pf === 'D2-gate' && p.outcome === 'escalated' && lastEscalation?.choice === 'accept') chain('D2-gate', s.concept).guided = true;
    if (s.stage === 'W1' && postVerify) afterVerification(s, i, pf);
    if (s.stage === 'W1' && pf === 'D2-gate' && cycle === null) cycle = { full: 'none', lenses: new Set(), failed: new Set(), fix: false, recheck: 'none', rechecked: new Set() };
    // Each gate attempt routes as its own verdict file says (gates.md's outcome tables).
    if (GATE_STAGES.includes(s.stage)) {
      const rep = ctx.verdict(s);
      const file = `reports/gates/${s.stage}-${s.concept}-a${s.attempt}.json`;
      const guided = s.stage !== 'R1b' && chain(s.stage, s.concept).guided;
      const counted = s.stage !== 'R1b' ? chain(s.stage, s.concept).counted : 0;
      if (!isObj(rep) || !isObj(rep.verdict)) fail('routing', `${at(i)}: has no verdict file ${file}; a gate step writes its own, and the runner routes on it (§3)`);
      else {
        const cls = gateClass(rep, s.stage, coveredSoFar);
        const claimedInfeasible = p?.stage === 'D1' && p.concept === s.concept && p.outcome === 'infeasible';
        const why = {
          pass: cls === 'pass' ? null : `its verdict ${describeClass(cls)}, which isn't a pass`,
          fail: cls === 'hard' || cls === 'soft' ? (guided ? 'a guided retry or an accepted re-run that fails escalates again' : null) : `its verdict ${describeClass(cls)}, which isn't a failure`,
          escalated: cls === 'hard' || (guided && cls === 'soft') ? null : `its verdict ${describeClass(cls)}; only a compile, V1 or V2 failure escalates, or any failure of a guided retry`,
          infeasible:
            cls === 'forced' ? (forcedByFault(s) ? null : 'its verdict is forced infeasible, but no FI-3 directive targets this attempt')
              : cls !== 'soft' ? `its verdict ${describeClass(cls)}; infeasible is FI-3's forced verdict, or a floor, budget or named-damage-source (rolledSkill) failure`
                : guided ? 'a guided retry that fails escalates again'
                  : claimedInfeasible || counted >= GATE_RETRIES ? null : `D1 claimed done and the gate has ${counted} counted retr${counted === 1 ? 'y' : 'ies'}; a floor, budget or named-damage-source (rolledSkill) failure re-runs D1 until its 2 counted retries, unless D1 claimed infeasible`,
        }[s.outcome];
        if (cls === 'forced' && s.outcome !== 'infeasible') fail('routing', `${at(i)}: is routed ${s.outcome}, but ${file} is forced infeasible (FI-3)`);
        else if (why) fail('routing', `${at(i)}: is routed ${s.outcome}, but ${s.outcome === 'pass' || s.outcome === 'fail' || s.outcome === 'escalated' || s.outcome === 'infeasible' ? why : 'that outcome'} (${file})`);
      }
    }
    if (s.stage === 'D1-gate' || s.stage === 'D2-gate') {
      const c = chain(s.stage, s.concept);
      if (s.outcome === 'fail' && !freeFault(s)) {
        if (c.guided) fail('caps', `${at(i)}: fails after a guided retry or an accepted re-run, and the producer re-runs; such a failure escalates again (D-236)`);
        c.counted += 1;
        if (c.counted > GATE_RETRIES) fail('caps', `${at(i)}: is counted failure ${c.counted} of ${s.stage} for ${s.concept} in one chain, and the producer re-runs again; a gate allows ${GATE_RETRIES} counted retries, then escalates (S6: only an attempt-1 fault's failure is free)`);
      }
      if (s.outcome === 'escalated' && !c.guided && c.counted < GATE_RETRIES) {
        fail('caps', `${at(i)}: escalates after ${c.counted} counted retr${c.counted === 1 ? 'y' : 'ies'}; a gate escalates only after its ${GATE_RETRIES} counted retries, or when a guided retry fails again`);
      }
      if (s.outcome === 'escalated') {
        const e = escalations[esc];
        esc += 1;
        lastEscalation = e ?? null;
        if (!e) fail('escalation', `${at(i)}: escalated, but escalations[] has no entry ${esc - 1} for it`);
        else if (e.stage !== s.stage || e.concept !== s.concept) fail('escalation', `${at(i)}: escalated, but escalations[${esc - 1}] is ${e.stage} ${e.concept}'s; the escalations are logged in stages[] order`);
        else if (!e.verdict?.endsWith?.(`-a${s.attempt}.json`)) fail('escalation', `${at(i)}: escalated, but escalations[${esc - 1}].verdict ${show(e.verdict)} isn't this attempt's verdict file`);
        if (e?.choice === 'accept') {
          for (const f of failingFindings(ctx.verdict(s), s.stage, coveredSoFar)) acceptedSoFar.push({ stage: typeof f.stage === 'string' ? f.stage : null, part: f.part, code: f.code });
        }
      }
    }

    // Verification cycles (S2; Q4).
    if (f === 'V4') {
      if (cycle === null) illegal('runs a V4 pass with no guide written for this design');
      else {
        if (cycle.full === 'done') fail('verification', `${at(i)}: starts a second full V4 pass in one cycle; after the fix round each lens that raised a finding re-checks it (step 13), and only a revision ${G.final} asked for starts a new cycle`);
        if (cycle.full === 'open' && cycle.lenses.has(lensOf(s))) fail('verification', `${at(i)}: runs the ${lensOf(s)} lens twice in one full pass`);
        cycle.full = 'open';
        cycle.lenses.add(lensOf(s));
        if (s.outcome === 'fail') cycle.failed.add(lensOf(s));
      }
    }
    if (f === 'V4r') {
      if (!cycle || cycle.full !== 'done' || !cycle.fix) fail('verification', `${at(i)}: re-checks with no full pass and fix round before it in this cycle`);
      else if (cycle.recheck === 'done') fail('verification', `${at(i)}: starts a second re-check in one cycle; there is no further round, what stays open is a known issue (S2)`);
      else {
        if (!cycle.fixGate && !cycle.failed.has(lensOf(s)) && lensOf(s) !== 'sources') fail('verification', `${at(i)}: re-checks the ${lensOf(s)} lens, which raised no finding in the full pass; after a claims-only round only a lens that raised one re-checks, with the sources lens, unless a gate re-ran in the fix round (D-264)`);
        if (cycle.rechecked.has(lensOf(s))) fail('verification', `${at(i)}: re-checks the ${lensOf(s)} lens twice`);
        cycle.recheck = 'open';
        cycle.rechecked.add(lensOf(s));
      }
    }
    prev = { s, i };
  }
  closeBlocks(stages.length);

  // Schema 3: a run that ends at a gate takes that visit's answer too; stop ends it stopped, and any other answer
  // leaves a step to come, so the run is still running. No gate has an answer left over (D-287, D-289).
  const end = gateAfter(prev?.s, undefined);
  if (end !== null) {
    const c = answers[end].shift();
    if (stages[stages.length - 1] === prev.s) {
      const name = GATE_NAME[end];
      if (c === undefined && log.status !== 'running') fail('order', `run-log.json: the run ends at ${name} with no ${end} answer recorded, but its status is ${show(log.status)}; a run that stops there records the answer stop`);
      else if (c?.answer === 'stop' && log.status !== 'stopped') fail('order', `run-log.json: ${name} answered "stop", which ends the run stopped, but its status is ${show(log.status)}`);
      else if (c !== undefined && c.answer !== 'stop' && log.status !== 'running') fail('order', `run-log.json: ${name} answered ${show(c.answer)}, but no step follows it and the run ends ${show(log.status)}`);
    }
  }
  for (const kind of v3 ? ['brainstorm', 'verification'] : []) {
    if (answers[kind].length > 0) fail('order', `run-log.json: checkpoints[] records ${answers[kind].length} ${kind} answer(s) more than the run visits ${GATE_NAME[kind]}; each visit records one answer, in order (D-289)`);
  }

  if (esc !== escalations.length) fail('escalation', `run-log.json escalations[] has ${escalations.length} entr${escalations.length === 1 ? 'y' : 'ies'}, but stages[] logs ${esc} escalated gate attempt(s); every escalation is logged once, in order`);
  if (revisions > revises) fail('verification', `run-log.json stages[] runs ${revisions} revision(s) after the V4 checks, but ${G.final} was answered revise:<text> ${revises} time(s); without findings to fix, only a revision runs the owners again`);
  const last = steps[steps.length - 1]?.s;
  if (last?.outcome === 'escalated' && lastEscalation?.choice === 'stop' && log.status !== 'escalated') {
    fail('escalation', `run-log.json: the last step is ${describe(last)}'s escalation, answered stop, but the status is ${show(log.status)}; the run ends escalated`);
  }
  if (log.status === 'escalated' && !(last?.outcome === 'escalated' && lastEscalation?.choice === 'stop')) {
    fail('escalation', 'run-log.json: status is "escalated", but the run doesn\'t end with a gate escalation answered stop');
  }
  const lastAnswer = checkpoints.filter((c) => c.checkpoint === G.finalKey).pop()?.answer;
  if (log.status === 'completed' && lastAnswer !== 'accept') {
    fail('order', `run-log.json: status is "completed", but ${G.final}'s last answer is ${show(lastAnswer)}; only an accept at ${G.final} completes a run`);
  }
  if (log.status === 'completed' && !(cycle && cycle.full === 'done' && (cycle.failed.size === 0 || cycle.recheck === 'done'))) {
    fail('verification', 'run-log.json: status is "completed", but the run doesn\'t end with a full V4 pass and, when it found anything, its re-check');
  }
}

/**
 * A gate verdict's failing findings: those of a part that fails, information codes and accepted findings aside.
 * A part other than the budget that is `unverified` fails too (only the budget may stay unverified, D-164).
 */
function failingFindings(rep, stage, covered) {
  if (!isObj(rep) || !isObj(rep.verdict)) return [];
  return list(rep.findings).filter((f) => GATE_PARTS[stage]?.includes(f.part) && ['fail', 'unverified'].includes(rep.verdict[f.part]) && !INFO_CODES.includes(f.code) && !covered(f));
}

/**
 * Where a gate verdict routes (gates.md): `forced` (FI-3), `hard` (a compile, V1 or V2 failure, or a part other
 * than the budget unverified), `soft` (only floor, budget or the named damage source's part rolledSkill), or `pass`. A failing part whose
 * findings an escalation accepted passes.
 */
function gateClass(rep, stage, covered) {
  if (rep.forced === 'infeasible') return 'forced';
  const failing = GATE_PARTS[stage].filter((part) => {
    const v = rep.verdict[part];
    if (v === 'unverified') return part !== 'budget';
    if (v !== 'fail') return v !== 'pass';
    const findings = list(rep.findings).filter((f) => f.part === part && !INFO_CODES.includes(f.code));
    return part === 'compiled' || findings.length === 0 || findings.some((f) => !covered(f));
  });
  if (failing.some((part) => ['compiled', 'v1', 'v2'].includes(part))) return 'hard';
  return failing.length > 0 ? 'soft' : 'pass';
}
const describeClass = (cls) => ({ pass: 'passes', hard: 'fails its compile, V1 or V2 (or leaves one unverified)', soft: 'fails only its floor, budget or named damage source (rolledSkill)', forced: 'is forced infeasible (FI-3)' })[cls];

/** The claim a V4 finding's location names: a plan claim `stages[i].claims[k]`, or a guide `[^id]`. */
function claimAt(claims, artifact, location) {
  if (typeof location !== 'string') return null;
  if (artifact === 'plan.json') {
    const m = /stages\[\d+\]\.claims\[\d+\]/.exec(location);
    return m ? (claims.plan.find((c) => c.at === m[0]) ?? null) : null;
  }
  const m = /\[\^([^\]\s]+)\]/.exec(location);
  return artifact === 'guide.md' && m ? (claims.guide.find((c) => c.id === m[1]) ?? null) : null;
}

// ---------------------------------------------------------------------------------------------------
// Reports (gates.md verdict files, source-markers.md V4 reports)
// ---------------------------------------------------------------------------------------------------

function checkGateReport(rep, g, fail) {
  const bad = (why) => fail('gate-report', `${g.file}: ${why}`);
  if (!isObj(rep)) return bad('is a JSON object');
  if (rep.stage !== g.stage || rep.concept !== g.concept || rep.attempt !== g.attempt) {
    bad(`says ${show({ stage: rep.stage, concept: rep.concept, attempt: rep.attempt })}; its name says ${show({ stage: g.stage, concept: g.concept, attempt: g.attempt })}`);
  }
  if (!isObj(rep.verdict)) return bad('has no verdict object');
  for (const part of GATE_PARTS[g.stage]) {
    if (!PARTS.includes(rep.verdict[part])) bad(`verdict.${part} is ${show(rep.verdict[part])}; one of ${PARTS.join(', ')}`);
  }
  if (!Array.isArray(rep.findings)) bad('has no findings list');
  if (g.stage === 'D1-gate') {
    const b = rep.basis;
    if (!isObj(b) || !isObj(b.budget) || !Array.isArray(b.budget.slots) || !Array.isArray(b.budget.rates) || !Array.isArray(b.rolledSkill)) {
      bad('has no basis {budget: {rates, slots}, rolledSkill: [...]}: the slot→price map, its rates and the figures the run checker recomputes the gate from (gates.md)');
    }
  }
}

/**
 * D-334: an R1b verdict for a card whose damage source isn't a skill: it compiled nothing (`compiles: 0`) and
 * failed with `not-a-skill`. It is terminal: no retry can compile it, and the card can't be finalized yet (D-303).
 */
function isTerminalR1b(rep) {
  return isObj(rep) && isObj(rep.verdict) && rep.verdict.compiled === 'fail' && rep.compiles === 0 && list(rep.findings).some((f) => f.code === 'not-a-skill');
}

/**
 * D-287, D-339: the deck `cards.md`, against the brainstorm rounds the log ran. It holds one `## Round <k>` per
 * round R1a-assemble dealt, each line `- <card id> …` a card of that round, then `## Not dealt`. A round deals
 * 6–9 cards, and the deck (every round's dealt cards so far) keeps at least two under-played cards, each line
 * labelled `under-played (judgment: …)`; a round short of either is accepted only with its reason, the
 * `shortReason` on its R1a-assemble entry. Every card of a dealt round is in the deck, dealt or not.
 */
function checkDeck(text, stages, cardIds, fail) {
  const rounds = [];
  let prev = null;
  stages.forEach((s, i) => {
    if (!isObj(s) || s.outcome === 'missing') return;
    if (s.stage === 'R1a' && prev !== 'R1a') rounds.push({ k: rounds.length + 1, assembly: null });
    if (s.stage === 'R1a-assemble' && rounds.length > 0) rounds[rounds.length - 1].assembly = { ...s, i };
    prev = s.stage;
  });
  const dealtRounds = rounds.filter((r) => r.assembly !== null);
  if (text === null) {
    if (dealtRounds.length > 0) fail('layout', `cards.md is missing, but R1a-assemble dealt ${dealtRounds.length} brainstorm round(s); it writes the deck there (§2, D-287)`);
    return;
  }
  const md = parseMarkdown(text);
  const titles = md.h2.map((h) => h.title);
  const want = [...dealtRounds.map((r) => `Round ${r.k}`), 'Not dealt'];
  if (show(titles) !== show(want)) fail('deck', `cards.md's H2s are ${show(titles)}; R1a-assemble writes one "Round <k>" per brainstorm round it dealt, then "Not dealt": ${show(want)} (§7.5)`);
  const entries = (h2) => sectionLines(md, h2).filter((l) => /^[-*]\s/.test(l.raw)).map((l) => ({ id: /^[-*]\s+(\S+)/.exec(l.raw)[1], raw: l.raw, n: l.n }));
  const listed = new Map();
  let underPlayed = 0;
  for (const r of dealtRounds) {
    const h2 = h2Named(md, `Round ${r.k}`);
    const dealt = h2 ? entries(h2) : [];
    for (const d of dealt) {
      if (!new RegExp(`^r${r.k}-[a-c]-[1-9]\\d*$`).test(d.id)) fail('deck', `cards.md:${d.n}: round ${r.k} deals ${show(d.id)}, which isn't a card of round ${r.k}, r${r.k}-<letter>-<n> (D-319)`);
      else if (!cardIds.has(d.id)) fail('deck', `cards.md:${d.n}: round ${r.k} deals ${d.id}, but cards/${d.id}.md doesn't exist (C-52)`);
      if (listed.has(d.id)) fail('deck', `cards.md:${d.n}: ${d.id} is dealt again (line ${listed.get(d.id)}); a later round adds only new cards (§7.5)`);
      listed.set(d.id, d.n);
    }
    underPlayed += dealt.filter((d) => UNDER_PLAYED.test(d.raw)).length;
    if (dealt.length > DEAL.max) fail('deck', `cards.md's round ${r.k} deals ${dealt.length} cards; a round deals ${DEAL.min} to ${DEAL.max} (D-287)`);
    const short = dealt.length < DEAL.min || underPlayed < DEAL.underPlayed;
    const reason = r.assembly.shortReason;
    if (short && !(typeof reason === 'string' && reason.trim() !== '')) {
      fail('deck', `cards.md's round ${r.k} deals ${dealt.length} card(s), and the deck holds ${underPlayed} under-played card(s), short of ${DEAL.min} to ${DEAL.max} dealt and two under-played (D-339), but its R1a-assemble entry, run-log.json stages[${r.assembly.i}], has no shortReason; a short round is accepted only with its reason`);
    }
  }
  const notDealt = h2Named(md, 'Not dealt');
  for (const d of notDealt ? entries(notDealt) : []) {
    if (!cardIds.has(d.id)) fail('deck', `cards.md:${d.n}: "Not dealt" names ${show(d.id)}, which is no card of the run (cards/<id>.md, C-52)`);
    else if (listed.has(d.id)) fail('deck', `cards.md:${d.n}: ${d.id} is under "Not dealt", but line ${listed.get(d.id)} lists it already`);
    listed.set(d.id, d.n);
  }
  const dealtK = new Set(dealtRounds.map((r) => r.k));
  for (const id of cardIds) {
    const k = Number(/^r(\d+)-/.exec(id)[1]);
    if (dealtK.has(k) && !listed.has(id)) fail('deck', `cards/${id}.md is a card of round ${k}, which R1a-assemble dealt, but cards.md neither deals it nor lists it under "Not dealt" (§7.5)`);
  }
}

function checkReportShape(rep, r, mode, fail, schema) {
  const bad = (why) => fail('report-shape', `${r.file}: ${why}`);
  if (rep.stage !== 'V4') bad(`stage is ${show(rep.stage)}; it is "V4"`);
  if (rep.lens !== r.lens) bad(`lens is ${show(rep.lens)}; its name says "${r.lens}"`);
  if (rep.check !== r.check) bad(`check is ${show(rep.check)}; its name says "${r.check}" (source-markers.md)`);
  if (!new RegExp(`^${idSource(schema)}$`).test(rep.concept ?? '')) bad(`concept is ${show(rep.concept)}; it is the guide's ${schema === 2 ? 'concept' : 'card'}, ${idForm(schema)}`);
  if (rep.mode !== mode) bad(`mode is ${show(rep.mode)}; the run is ${show(mode)}`);
  if (!Array.isArray(rep.findings)) return bad('has no findings list (§7.4)');
  if (!['pass', 'fail'].includes(rep.verdict)) bad(`verdict is ${show(rep.verdict)}; "pass" or "fail" (§7.4)`);
  const statuses = r.check === 'recheck' ? ['unresolved', 'accepted-offline', 'fixed'] : ['unresolved', 'accepted-offline'];
  const ids = new Set();
  let unresolved = 0;
  rep.findings.forEach((f, i) => {
    if (!isObj(f)) return bad(`findings[${i}] is an object`);
    for (const k of ['id', 'artifact', 'location', 'claim', 'issue', 'evidence', 'owner', 'status']) {
      if (!(k in f)) bad(`findings[${i}] has no ${k} (§7.4)`);
    }
    // D-265 (d): an unresolved finding (only it can become a known issue) has the plain sentence for the guide's
    // reader, which the runner copies into Known issues; a fixed or accepted-offline one needs none.
    if (f.status === 'unresolved' && (typeof f.reader !== 'string' || f.reader.trim() === '')) bad(`findings[${i}] is unresolved and has no reader: one plain sentence the guide's reader can act on (D-265)`);
    if (ids.has(f.id)) bad(`findings[${i}] reuses the id ${show(f.id)}; each finding has its own`);
    ids.add(f.id);
    if (!statuses.includes(f.status)) bad(`findings[${i}].status is ${show(f.status)}; one of ${statuses.join(', ')}`);
    if (f.status === 'accepted-offline' && mode !== 'offline') bad(`findings[${i}] is accepted-offline in an online run; only offline mode accepts external-unavailable (C-30)`);
    if (f.status === 'accepted-offline' && r.lens !== 'sources') bad(`findings[${i}] is accepted-offline in a ${r.lens} lens report; only the V4 sources lens marks an external-unavailable claim accepted-offline (C-30, §7.4)`);
    if ('artifact' in f && !ARTIFACTS.includes(f.artifact)) bad(`findings[${i}].artifact is ${show(f.artifact)}; V4 checks ${ARTIFACTS.join(' and ')} (the dossier isn't verified, S3)`);
    if ('owner' in f && !OWNERS.includes(f.owner)) bad(`findings[${i}].owner is ${show(f.owner)}; one of ${OWNERS.join(', ')}`);
    if (f.status === 'unresolved') unresolved += 1;
  });
  if (rep.verdict === 'pass' && unresolved > 0) bad(`says verdict "pass" alongside ${unresolved} unresolved finding(s); pass means none is unresolved (§7.4)`);
  if (rep.verdict === 'fail' && unresolved === 0) bad('says verdict "fail" with no unresolved finding; pass means none is unresolved (§7.4)');
}

// ---------------------------------------------------------------------------------------------------
// The D1 gate, recomputed (gates.md; Q3)
// ---------------------------------------------------------------------------------------------------

function checksText(guide, variant) {
  if (!guide) return null;
  const h2 = h2Named(guide, VARIANT_H2[variant] ?? '');
  const h3 = h2 ? h3sUnder(guide, h2).find((h) => h.title === 'Checks') : null;
  return h3 ? sectionText(guide, h3) : null;
}

/** A failure of a D1 gate part, with its plan stage and its canonical code (../references/gates.md). */
const failure = (part, stage, code, why) => ({ part, stage, code, why });

/** Whether a line states `value` as a number followed by `%` (rounded, truncated, to one decimal, or exact). */
function statesPercent(line, value) {
  const text = line.replace(/[−–]/g, '-');
  const forms = new Set([Math.round(value), Math.trunc(value), Number(value.toFixed(1)), value].map((x) => String(x)));
  return [...forms].some((s) => new RegExp(`(?<![\\d.])${s.replace(/[.-]/g, '\\$&')}\\s?%`).test(text));
}

/**
 * Survival floor (D-118, D-119, D-234, D-254, D-256), from the plan and the record alone: all four
 * resistances capped (chaos only by the exception); the five waystone-scaled reference hits present, each the
 * whole-number ceiling of its ledger entry; max hits above the hits.
 */
function recomputeFloor(endgame, record, guide, fail) {
  const failures = [];
  for (const s of endgame) {
    const out = record.stages[s.id]?.outputs;
    if (!isObj(out)) {
      failures.push(failure('floor', s.id, 'stage-not-compiled', `stage ${s.id} isn't in the record`));
      continue;
    }
    for (const e of ELEMENTS) {
      const v = out[`Missing${e}Resist`];
      const code = `missing-${e.toLowerCase()}-resist`;
      if (!isNum(v)) failures.push(failure('floor', s.id, code, `stage ${s.id} has no Missing${e}Resist in the record`));
      else if (v > 0) failures.push(failure('floor', s.id, code, `stage ${s.id} Missing${e}Resist is ${v}`));
    }
    const chaos = out.MissingChaosResist;
    if (!isNum(chaos)) failures.push(failure('floor', s.id, 'missing-chaos-resist', `stage ${s.id} has no MissingChaosResist in the record`));
    else if (chaos > 0) {
      const ex = s.chaosResistException;
      if (!isObj(ex) || typeof ex.reason !== 'string' || ex.reason.trim() === '') {
        failures.push(failure('floor', s.id, 'missing-chaos-resist', `stage ${s.id} MissingChaosResist is ${chaos} and it has no chaosResistException (D-234)`));
      } else if (guide) {
        // D-234: with the exception the floor passes, and one line of the guide's Checks states the
        // stage's uncapped chaos resistance (its number with %) and the exception's full reason.
        const text = checksText(guide, s.variant);
        const value = out.ChaosResist;
        const where = `the guide's "${VARIANT_H2[s.variant]}" Checks`;
        if (text === null) fail('floor', `stage ${s.id} keeps chaos resistance uncapped by its exception, but guide.md has no ${where} (D-234)`);
        else if (!isNum(value)) fail('floor', `stage ${s.id} keeps chaos resistance uncapped, but the record has no ChaosResist to state`);
        else if (!text.split('\n').some((l) => hasWord(norm(l), norm(ex.reason)) && statesPercent(l, value))) {
          fail('floor', `stage ${s.id} keeps chaos resistance uncapped by its exception, but no line of ${where} states its full reason "${ex.reason}" with the uncapped value ${value}% (D-234)`);
        }
      }
    }
    // D-254, D-256: the five waystone-scaled reference hits, each the ceiling of its ledger entry's value
    // rounded to 2 decimals (PoB's enemy<Type>Damage options take whole numbers).
    const scenario = Array.isArray(s.config?.scenario) ? s.config.scenario.filter(isObj) : [];
    for (const type of HIT_TYPES) {
      const t = type.toLowerCase();
      const opt = scenario.find((o) => o.option === `enemy${type}Damage` && isNum(o.value) && o.value > 0);
      if (!opt) {
        failures.push(failure('floor', s.id, `reference-hit-missing-${t}`, `stage ${s.id} has no waystone-scaled ${type} reference hit (enemy${type}Damage) (D-119, D-254)`));
        continue;
      }
      const entry = `hit_${s.id}_${t}`;
      const derived = record.ledger?.[entry]?.value;
      if (!isNum(derived)) {
        failures.push(failure('floor', s.id, `reference-hit-ledger-${t}`, `stage ${s.id}'s enemy${type}Damage ${opt.value} has no ledger entry ${entry} value in the record (D-254)`));
      } else if (opt.value !== hitCeiling(derived)) {
        failures.push(failure('floor', s.id, `reference-hit-ledger-${t}`, `stage ${s.id}'s enemy${type}Damage ${opt.value} isn't ${hitCeiling(derived)}, the ceiling of its ledger entry ${entry}'s value ${derived} rounded to 2 decimals (D-256)`));
      }
      // D-254 at the stage's area level: the hit cites the monster damage at the variant's area level, and its
      // ledger entry derives the hit from that damage and the tops of the waystone damage modifiers.
      const level = areaLevelOf(s.variant);
      const cited = /^damage\.by-level\[(\d+)\]$/.exec(String(opt.source?.key ?? ''));
      if (!isNum(level)) continue;
      if (opt.source?.file !== 'enemies/map-monsters.json' || !cited || Number(cited[1]) !== level) {
        failures.push(failure('floor', s.id, `reference-hit-ledger-${t}`, `stage ${s.id}'s enemy${type}Damage cites ${show(`${opt.source?.file}#${opt.source?.key}`)}; the ${s.variant} variant's area level is ${level}, so it cites enemies/map-monsters.json#damage.by-level[${level}] (D-254)`));
        continue;
      }
      const base = factValue('enemies/map-monsters.json', 'damage.by-level')?.[String(level)];
      const increased = factValue('enemies/waystones.json', 'mods.increased-monster-damage')?.max;
      const extra = factValue('enemies/waystones.json', 'mods.extra-damage-as-element')?.max;
      if (isNum(derived) && isNum(base) && isNum(increased) && isNum(extra)) {
        const expected = base * (1 + increased / 100) * (type === 'Physical' ? 1 : extra / 100);
        if (Math.abs(derived - expected) > 0.005 + 1e-9 * Math.abs(expected)) {
          failures.push(failure('floor', s.id, `reference-hit-ledger-${t}`, `stage ${s.id}'s ledger entry ${entry} is ${derived}, but the damage at its area level ${level} (enemies/map-monsters.json#damage.by-level[${level}], ${base}) × (1 + ${increased} / 100)${type === 'Physical' ? '' : ` × ${extra} / 100`} is ${round2(expected)} (D-254)`));
        }
      }
    }
    for (const opt of scenario) {
      const m = HIT_OPTION.exec(opt.option ?? '');
      if (!m || !isNum(opt.value) || opt.value <= 0) continue;
      const code = `max-hit-${m[1].toLowerCase()}`;
      const max = out[`${m[1]}MaximumHitTaken`];
      if (!isNum(max)) failures.push(failure('floor', s.id, code, `stage ${s.id} has no ${m[1]}MaximumHitTaken in the record`));
      else if (!(max > opt.value)) failures.push(failure('floor', s.id, code, `stage ${s.id} ${m[1]}MaximumHitTaken ${max} isn't above the ${opt.option} hit ${opt.value}`));
    }
  }
  return { verdict: failures.length > 0 ? 'fail' : 'pass', failures };
}

/**
 * Budget (D-116, D-164, D-219, D-249, D-281) from the plan's prices, the gate's map from filled slots and tree
 * jewels to price entries, and its recorded rates, for each gated rung: the budget variant (20 divines, 22 with
 * "near the ceiling") and the entering-maps rung (5, 5.5 with "near the ceiling"). Totals are compared rounded to
 * 2 decimals.
 */
function recomputeBudget(endgame, plan, rep, guide, fail) {
  const failures = [];
  const b = isObj(rep.basis?.budget) ? rep.basis.budget : {};
  const maps = list(b.slots);
  const rates = new Map(list(b.rates).map((r) => [String(r.currency).toLowerCase(), r.divines]));
  const prices = new Map(list(plan.prices).map((p) => [p.id, p]));
  let unverified = false;
  for (const s of endgame.filter((x) => Object.prototype.hasOwnProperty.call(BUDGETS, x.variant))) {
    const { ceiling, tolerance, why } = BUDGETS[s.variant];
    const filled = [
      ...list(s.items?.slots).map((it) => ({ what: `slot "${it.slot}"`, slot: it.slot, text: it.text })),
      ...list(s.items?.treeJewels).map((j) => ({ what: `tree jewel in node ${j.node}`, jewel: j.node, text: j.text })),
    ];
    let total = 0;
    let stageUnverified = false;
    const used = new Map();
    for (const it of filled) {
      const map = maps.find((x) => x.stage === s.id && (it.slot !== undefined ? x.slot === it.slot : x.jewel === it.jewel));
      const price = map ? prices.get(map.priceId) : undefined;
      if (!price) {
        fail('budget', `${s.variant} stage ${s.id}'s filled ${it.what} maps to no prices[] entry${map ? ` (the gate names ${show(map.priceId)})` : ''}; every filled slot and tree jewel is priced (§5.3, D-249)`);
        stageUnverified = true;
        continue;
      }
      if (used.has(map.priceId) && used.get(map.priceId).text !== it.text) {
        fail('budget', `${s.variant} stage ${s.id}'s ${it.what} and ${used.get(map.priceId).what} share price entry ${show(map.priceId)} but hold different items; each has its own entry unless the item text is identical`);
      }
      if (!used.has(map.priceId)) used.set(map.priceId, it);
      if (price.status !== 'ok' || !isNum(price.amount)) {
        stageUnverified = true;
        continue;
      }
      const currency = String(price.currency).toLowerCase();
      const rate = rates.has(currency) ? rates.get(currency) : /^divine/.test(currency) ? 1 : undefined;
      if (!isNum(rate)) {
        stageUnverified = true;
        continue;
      }
      total += price.amount * rate;
    }
    const mine = stageUnverified ? null : round2(total);
    if (mine === null) unverified = true;
    else if (mine > tolerance) failures.push(failure('budget', s.id, 'over-budget', `stage ${s.id} totals ${mine} divines, above ${tolerance} (${why})`));
    else if (mine > ceiling) {
      const text = checksText(guide, s.variant);
      if (guide && !(text !== null && norm(text).includes(NEAR_CEILING))) {
        fail('budget', `${s.variant} stage ${s.id} totals ${mine} divines, over ${ceiling}, but the guide's "${VARIANT_H2[s.variant]}" Checks lack "${NEAR_CEILING}" (${why})`);
      }
    }
  }
  return { verdict: failures.length > 0 ? 'fail' : unverified ? 'unverified' : 'pass', failures, unverified };
}

/**
 * The named damage source's gate, the part `rolledSkill` (D-122 and D-148 as D-295 words them, D-217; amendment
 * 1 S7): its group (`rolledGroup`) has role clear or single_target, its figure is the largest of that role, read
 * from the record for every group the gate compares, × each group's Count where the record has a counted copy
 * (`countedSkillOutputs`, D-294, D-340), and a `skillOutputs` figure of its group is of the stage's
 * `skills.main.statSet`, the set the PoB file opens on.
 */
function recomputeRolledSkill(endgame, plan, record, rep, fail) {
  const failures = [];
  const basis = list(rep.basis?.rolledSkill);
  const ledger = new Map(list(plan.ledger).map((e) => [e.id, e]));
  for (const s of endgame) {
    const groups = Array.isArray(s.skills?.groups) ? s.skills.groups : [];
    const rolled = s.skills?.rolledGroup;
    const main = isObj(s.skills?.main) ? s.skills.main : {};
    const role = groups[rolled - 1]?.role;
    if (!['clear', 'single_target'].includes(role)) {
      failures.push(failure('rolledSkill', s.id, 'rolled-role', `stage ${s.id}'s named damage source's group ${show(rolled)} (rolledGroup) has role ${show(role)}; the named damage source is clear or single_target, never a token role (D-122 as D-295 words it)`));
      continue;
    }
    // S7: the PoB file opens on the main skill's stat set, so the named damage source is the main skill.
    if (main.group !== rolled) {
      failures.push(failure('rolledSkill', s.id, 'rolled-not-main', `stage ${s.id}'s main group is ${show(main.group)}, but its named damage source's group (rolledGroup) is ${rolled}; the named source is the main skill, which the PoB file opens on (S7)`));
    }
    if (!isInt(main.statSet, 1)) {
      failures.push(failure('rolledSkill', s.id, 'rolled-stat-set', `stage ${s.id} sets no skills.main.statSet; D1 names the stat set the PoB file opens on (S7)`));
    }
    const mainKey = `g${main.group}s${main.activeSkill}p${main.statSet}`;
    const b = basis.find((x) => x.stage === s.id);
    if (!b) {
      fail('gate-report', `the D1 gate's basis.rolledSkill has no entry for endgame stage ${s.id} (gates.md)`);
      failures.push(failure('rolledSkill', s.id, 'rolled-not-compared', `stage ${s.id} has no figures to compare`));
      continue;
    }
    const figures = list(b.figures);
    const sameRole = groups.map((g, i) => ({ g, n: i + 1 })).filter(({ g }) => g?.role === role).map(({ n }) => n);
    const fields = new Set();
    const values = new Map();
    const counted = new Set();
    for (const n of sameRole) {
      const f = figures.find((x) => x.group === n);
      if (!f) {
        fail('rolled-skill', `the D1 gate compares no figure for stage ${s.id}'s group ${n}, which has the named damage source's role ${role} (gates.md)`);
        failures.push(failure('rolledSkill', s.id, 'rolled-not-compared', `group ${n} not compared`));
        continue;
      }
      let value;
      const sk = /^g(\d+)s(\d+)p(\d+)\.(\w+)$/.exec(String(f.figure));
      const lg = /^ledger:(\w+)$/.exec(String(f.figure));
      if (sk) {
        if (Number(sk[1]) !== n) fail('rolled-skill', `the D1 gate's figure ${show(f.figure)} for stage ${s.id} is another group's, not group ${n}'s`);
        fields.add(sk[4]);
        // D-340: × the group's Count where the record has a counted copy of the field, else the raw per-copy value.
        const read = figureOf(record.stages[s.id], f.figure);
        value = read.value;
        if (read.counted) counted.add(n);
        // S7: the named source's figure is the main skill's, of the stat set the PoB file opens on.
        if (n === rolled && isInt(main.statSet, 1) && `g${sk[1]}s${sk[2]}p${sk[3]}` !== mainKey) {
          failures.push(failure('rolledSkill', s.id, 'rolled-stat-set', `stage ${s.id}'s named damage source's figure ${f.figure} isn't the main skill's stat set ${mainKey} (skills.main); the PoB file opens on that set, so the gate compares its figure (S7)`));
        }
      } else if (lg) {
        value = record.ledger?.[lg[1]]?.value;
        // S7, inside a ledger figure: every breakdown field its formula reads is the main skill's stat set on this stage.
        if (n === rolled && isInt(main.statSet, 1)) {
          const refs = [...String(ledger.get(lg[1])?.formula ?? '').matchAll(/([A-Za-z0-9_]+)\.(g\d+s\d+p\d+)\.[A-Za-z_]\w*/g)];
          const off = refs.filter((m) => m[1] !== s.id || m[2] !== mainKey).map((m) => `${m[1]}.${m[2]}`);
          if (off.length > 0) {
            failures.push(failure('rolledSkill', s.id, 'rolled-stat-set', `stage ${s.id}'s named damage source's figure ${f.figure} reads ${[...new Set(off)].join(', ')}, not the main skill's stat set ${s.id}.${mainKey} (skills.main); the PoB file opens on that set (S7)`));
          }
        }
      } else {
        fail('rolled-skill', `the D1 gate's figure ${show(f.figure)} is neither a record skillOutputs field nor ledger:<id> (gates.md)`);
        continue;
      }
      if (!isNum(value)) {
        failures.push(failure('rolledSkill', s.id, 'rolled-no-figure', `stage ${s.id} group ${n}'s figure ${f.figure} isn't in the record`));
        continue;
      }
      values.set(n, value);
    }
    if (fields.size > 1) fail('rolled-skill', `the D1 gate compares stage ${s.id}'s groups by different fields ${show([...fields])}; it uses one field for every group (gates.md)`);
    const mine = values.get(rolled);
    for (const [n, v] of values) {
      if (n !== rolled && isNum(mine) && v > mine) {
        const how = (g) => (counted.has(g) ? ' (× its Count)' : '');
        failures.push(failure('rolledSkill', s.id, 'rolled-not-largest', `stage ${s.id}'s group ${n} (${role}) has ${v}${how(n)}, more than the named damage source's group ${rolled}'s ${mine}${how(rolled)} (D-340)`));
      }
    }
  }
  return { verdict: failures.length > 0 ? 'fail' : 'pass', failures };
}

// ---------------------------------------------------------------------------------------------------
// Command line
// ---------------------------------------------------------------------------------------------------

async function main(argv) {
  const args = argv.slice(2);
  if (args.length !== 1 || args[0].startsWith('--')) {
    process.stderr.write('usage: node check-run.mjs <runFolder>\n');
    return 2;
  }
  const folder = path.resolve(args[0]);
  const violations = await checkRun(folder);
  if (violations.length === 0) {
    process.stdout.write(`check-run: ok: ${folder}\n`);
    return 0;
  }
  for (const v of violations) process.stderr.write(`check-run: [${v.rule}] ${v.message}\n`);
  process.stderr.write(`check-run: ${violations.length} violation(s) in ${folder}\n`);
  return 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = await main(process.argv);
}
